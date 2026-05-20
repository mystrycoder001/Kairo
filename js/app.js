import { initVoice } from './voice.js';
import { generatePrompt } from './gemini.js';
import { initPassport, getPassportText } from './passport.js';
import { initSessionSync } from './session-sync.js';
import { getCurrentUser, logout, supabase, getAccessToken } from './auth.js';
import { initTour } from './tour.js';

window.logout = logout;

export const $ = (id) => document.getElementById(id);

export function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('opacity-0', 'translate-y-20');
  setTimeout(() => toast.classList.add('opacity-0', 'translate-y-20'), 3000);
}

export function logError(component, error) {
  console.error(`[Cloasta] ${component}:`, error?.message || error);
}

async function safeRun(component, fn) {
  try { return await fn(); } catch (err) {
    logError(component, err);
    showToast(`⚠️ ${component} failed. Please refresh.`);
  }
}

export function cleanPrompt(text) {
  if (!text) return '';
  return text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#{1,6}\s/g,'').replace(/`{1,3}/g,'').replace(/^\s*[-•]\s/gm,'').trim();
}

const memoryModes = [
  { id: 'founder', label: 'Founder', icon: '🚀' },
  { id: 'study', label: 'Study', icon: '📚' },
  { id: 'coding', label: 'Coding', icon: '💻' },
  { id: 'creator', label: 'Creator', icon: '🎨' },
  { id: 'freelancer', label: 'Freelancer', icon: '💼' }
];

let _cachedProfile = null;

// ==========================================
// PLAN CONFIG
// ==========================================
const PLAN_CONFIG = {
  free: { label: 'FREE', promptLimit: 5, syncLimit: 2, passportLimit: 1 },
  pro: { label: 'PRO', promptLimit: Infinity, syncLimit: Infinity, passportLimit: 5 },
  ultra: { label: 'ULTRA', promptLimit: Infinity, syncLimit: Infinity, passportLimit: Infinity }
};

// ==========================================
// DOM READY — Wire up UI immediately (no auth dependency)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  window.onerror = (msg, url, lineNo, columnNo, error) => { logError('Runtime', error || msg); return false; };
  window.onunhandledrejection = (event) => { logError('UnhandledPromise', event.reason); };

  // Wire static button listeners immediately
  $('logout-btn')?.addEventListener('click', logout);
  $('settings-logout-btn')?.addEventListener('click', logout);
  $('mobile-menu-toggle')?.addEventListener('click', () => {
    const sidebar = $('sidebar');
    const overlay = $('sidebar-overlay');
    if (sidebar) { sidebar.classList.remove('sidebar-hidden'); if (overlay) overlay.classList.remove('hidden'); }
  });
  $('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);
  $('close-upgrade-btn')?.addEventListener('click', hideUpgradeModal);
  $('banner-upgrade-btn')?.addEventListener('click', showUpgradeModal);
  $('sidebar-upgrade-btn')?.addEventListener('click', showUpgradeModal);
  $('upgrade-pro-btn')?.addEventListener('click', () => safeRun('UpgradePro', () => handleUpgrade('pro')));
  $('upgrade-ultra-btn')?.addEventListener('click', () => safeRun('UpgradeUltra', () => handleUpgrade('ultra')));
  $('save-settings-btn')?.addEventListener('click', () => safeRun('SettingsSave', saveSettings));

  // FIX: Initialize navigation IMMEDIATELY on DOMContentLoaded
  // Navigation is purely DOM-based and has ZERO auth dependency.
  // This prevents "dead clicks" on sidebar items during dashboard load.
  const isDashboard = window.location.pathname.includes('dashboard');
  if (isDashboard) {
    initNavigation();
  }
});

function closeMobileSidebar() {
  const sidebar = $('sidebar');
  const overlay = $('sidebar-overlay');
  if (sidebar) sidebar.classList.add('sidebar-hidden');
  if (overlay) overlay.classList.add('hidden');
}

async function loadDashboard(existingSession) {
  console.log('loadDashboard() called');
  try {
    let session = existingSession;
    if (!session) {
      const { data: sessionData } = await supabase.auth.getSession();
      session = sessionData?.session;
    }
    if (!session) { window.location.replace('/login.html'); return; }

    const quickName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
    
    // Instant UI update from session
    updateNameUI(quickName);
    updateAvatarUI(quickName);
    if ($('user-email')) $('user-email').textContent = session.user.email;

    // Run both queries in parallel to drastically improve perceived load time
    const [profileRes, usageRes] = await Promise.allSettled([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('usage_tracking').select('*').eq('user_id', session.user.id).single()
    ]);

    let profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
    let usage = usageRes.status === 'fulfilled' ? usageRes.value.data : null;

    if (!profile) { window.location.replace('/onboarding.html'); return; }
    if (!profile.onboarding_completed) { window.location.replace('/onboarding.html'); return; }

    _cachedProfile = profile;
    const finalName = profile.full_name || quickName;
    updateNameUI(finalName);
    updateAvatarUI(finalName);

    const plan = (profile.subscription_plan || 'free').toLowerCase();
    const planConfig = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
    
    if ($('user-plan')) $('user-plan').textContent = planConfig.label;
    if ($('sidebar-tier')) $('sidebar-tier').textContent = planConfig.label + ' TIER';

    // Sync name silently in background if missing
    if (!profile.full_name && finalName !== 'User') {
      supabase.from('profiles').update({ full_name: finalName }).eq('id', session.user.id).then(()=>{});
    }

    safeRun('ProfileCardUpdate', () => updateProfileCard(profile));

    // Handle usage data
    if (usage && usage.reset_date) {
      const today = new Date().toDateString();
      const resetDate = new Date(usage.reset_date).toDateString();
      if (resetDate !== today) {
        usage.prompts_used = 0;
        supabase.from('usage_tracking').update({ prompts_used: 0, reset_date: new Date().toISOString() }).eq('user_id', session.user.id).then(()=>{});
      }
    }

    const promptsUsed = usage?.prompts_used || 0;
    if ($('prompts-used')) $('prompts-used').textContent = promptsUsed;
    if ($('prompts-remaining')) {
      $('prompts-remaining').textContent = plan === 'free' ? Math.max(0, 5 - promptsUsed) : '∞';
    }
    if ($('sync-usage')) {
      const syncsToday = usage?.quota_usage?.syncs_today || 0;
      $('sync-usage').textContent = plan === 'free' ? `${syncsToday}/2` : '∞';
    }

    safeRun('MemoryModesLoad', () => loadMemoryModes(profile));
    if (usage) safeRun('UsageLimitCheck', () => checkUsageLimit(usage, profile));
    safeRun('HistoryLoad', renderHistory);

    // Initialize feature modules directly — no lazy loading delay
    safeRun('VoiceInit', () => initVoice(handleGeneration));
    safeRun('PassportInit', initPassport);
    safeRun('SessionSyncInit', initSessionSync);
    safeRun('TourInit', initTour);

    console.log('Dashboard load complete');
  } catch (err) {
    console.error('loadDashboard crashed:', err.message, err.stack);
  }
}

function updateNameUI(name) {
  document.querySelectorAll('#user-name, .user-name, #sidebar-name, .sidebar-name, #sidebar-user-name, [data-user-name], #display-name').forEach(el => el.textContent = name);
}

function updateAvatarUI(name) {
  const char = (name || 'U')[0].toUpperCase();
  document.querySelectorAll('#user-avatar, .user-avatar, #sidebar-avatar, .avatar-initial').forEach(el => el.textContent = char);
}

function loadMemoryModes(profile) {
  const container = $('modes-container');
  if (!container) return;
  const activeMode = profile.active_mode || 'founder';
  container.innerHTML = memoryModes.map(mode => `
    <button class="mode-card flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all cursor-pointer ${activeMode === mode.id ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}" data-mode-id="${mode.id}">
      <span class="text-xl">${mode.icon}</span>
      <span class="font-bold text-sm tracking-tight">${mode.label}</span>
    </button>
  `).join('');
  container.querySelectorAll('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => { const modeId = btn.getAttribute('data-mode-id'); if (modeId) window.setActiveMode(modeId); });
  });
}

window.setActiveMode = async (modeId) => {
  await safeRun('SetMode', async () => {
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('profiles').update({ active_mode: modeId }).eq('id', user.id);
    showToast(`🧠 Switched to ${modeId.charAt(0).toUpperCase() + modeId.slice(1)} Memory`);
    if (_cachedProfile) { _cachedProfile.active_mode = modeId; loadMemoryModes(_cachedProfile); if ($('summary-mode')) $('summary-mode').textContent = modeId.charAt(0).toUpperCase() + modeId.slice(1); }
  });
};

function checkUsageLimit(usage, profile) {
  const promptsUsed = usage?.prompts_used || 0;
  const plan = (profile.subscription_plan || 'free').toLowerCase();
  const isFree = plan === 'free';
  const banner = $('upgrade-banner');
  const sidebarUpgrade = $('sidebar-upgrade-container');
  if (isFree) {
    if (sidebarUpgrade) sidebarUpgrade.classList.remove('hidden');
    if (promptsUsed >= 5) {
      if (banner) banner.classList.remove('hidden');
      if ($('generate-prompt-btn')) $('generate-prompt-btn').disabled = true;
    }
  } else {
    if (sidebarUpgrade) sidebarUpgrade.classList.add('hidden');
    if (banner) banner.classList.add('hidden');
  }
}

function showUpgradeModal() {
  const modal = $('upgrade-modal');
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function hideUpgradeModal() {
  const modal = $('upgrade-modal');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function handleUpgrade(planTier = 'pro') {
  const user = await getCurrentUser();
  if (!user) return;
  const btn = planTier === 'ultra' ? $('upgrade-ultra-btn') : $('upgrade-pro-btn');
  if (btn) btn.disabled = true;

  try {
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, plan_tier: planTier })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || 'Payment initialization failed');
    
    if (data.order_id) {
      const priceLabel = planTier === 'ultra' ? '$15.99/mo' : '$7.99/mo';
      const options = {
        key: data.key_id, amount: data.amount, currency: data.currency,
        name: "Cloasta", description: `Cloasta ${planTier.charAt(0).toUpperCase() + planTier.slice(1)} — ${priceLabel}`,
        order_id: data.order_id,
        handler: async function () {
          showToast('✅ Payment successful. Upgrading account...');
          setTimeout(() => window.location.href = '/dashboard.html?upgraded=true', 1500);
        },
        prefill: { email: user.email },
        theme: { color: "#000000" }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    }
  } catch (err) {
    showToast(`❌ ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function showScreen(screenId) {
  // Hide ALL screens efficiently
  const screens = document.querySelectorAll('.screen');
  for (let i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  
  // Normalize the ID
  const cleanId = screenId.replace('screen-', '');
  const target = document.getElementById('screen-' + cleanId) || document.getElementById(screenId);
  
  if (target) { 
    target.classList.add('active'); 
  } else {
    console.warn('[Nav] Screen not found:', screenId, '→ falling back to overview');
    const fallback = document.getElementById('screen-overview');
    if (fallback) fallback.classList.add('active');
  }
  
  // Update sidebar active states
  document.querySelectorAll('.sidebar-item').forEach(item => {
    const navTarget = item.getAttribute('data-nav');
    if (navTarget === cleanId) { 
      item.classList.add('active', 'text-white'); 
      item.classList.remove('text-gray-400'); 
    } else { 
      item.classList.remove('active', 'text-white'); 
      item.classList.add('text-gray-400'); 
    }
  });
}

export function navigateTo(screenId) { 
  showScreen(screenId); 
  // Auto-load settings data when navigating to settings
  if (screenId === 'settings') safeRun('SettingsLoad', loadSettings);
}
window.navigateTo = navigateTo;
window.showScreen = showScreen;
window.loadDashboard = loadDashboard;
window.initNavigation = initNavigation;

function updateProfileCard(profile) {
  if (!profile) return;
  if ($('summary-role')) $('summary-role').textContent = profile.role || 'AI Architect';
  if ($('summary-style')) { const s = profile.communication_style || 'Balanced'; $('summary-style').textContent = s.includes('|') ? s.split('|')[0] : s; }
  if ($('summary-mode')) { const m = profile.active_mode || 'founder'; $('summary-mode').textContent = m.charAt(0).toUpperCase() + m.slice(1); }
  if ($('summary-tools')) { const c = profile.favourite_tools ? profile.favourite_tools.split(',').length : 0; $('summary-tools').textContent = `${c} Tool${c === 1 ? '' : 's'} Connected`; }
}

function initNavigation() {
  // Bind sidebar items
  document.querySelectorAll('.sidebar-item').forEach(item => {
    if (item.dataset.navBound) return;
    item.dataset.navBound = 'true';
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-nav');
      if (!target) return;
      if (target === 'upgrade') { showUpgradeModal(); }
      else { navigateTo(target); }
      closeMobileSidebar();
    });
  });
  
  // Bind ALL data-nav elements (including in-content buttons like "Capture", "Manage Passport")
  document.querySelectorAll('[data-nav]').forEach(item => {
    if (item.dataset.navBound) return;
    item.dataset.navBound = 'true';
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-nav');
      if (!target) return;
      if (target === 'upgrade') { showUpgradeModal(); }
      else { navigateTo(target); }
      closeMobileSidebar();
    });
  });
}

async function handleGeneration(text) {
  if (!text) return;
  await safeRun('Generation', async () => {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Single parallel fetch for both profile AND usage (was 2 sequential queries + 1 duplicate)
    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('subscription_plan, active_mode, target_ai').eq('id', user.id).single(),
      supabase.from('usage_tracking').select('prompts_used').eq('user_id', user.id).single()
    ]);
    const profile = profileRes.data;
    const usage = usageRes.data;
    
    if ((profile?.subscription_plan || 'free') === 'free' && (usage?.prompts_used || 0) >= 5) {
      showUpgradeModal();
      return;
    }
    const loader = $('generate-loader');
    const btnText = $('generate-prompt-btn')?.querySelector('span');
    if (loader) loader.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Thinking...';
    let prompt = await generatePrompt(text, profile?.active_mode || 'founder');
    if (!prompt) throw new Error('AI failed to respond');
    prompt = cleanPrompt(prompt);
    window._CloastaGeneratedPrompt = prompt;
    navigateTo('output');
    initOutputScreen();
    await saveToHistory(prompt, text, profile?.active_mode || 'founder');
    const { data: updatedUsage } = await supabase.from('usage_tracking').select('prompts_used').eq('user_id', user.id).single();
    if (updatedUsage && $('prompts-used')) $('prompts-used').textContent = updatedUsage.prompts_used || 0;
    if (updatedUsage && $('prompts-remaining')) {
      const plan = (profile?.subscription_plan || 'free').toLowerCase();
      $('prompts-remaining').textContent = plan === 'free' ? Math.max(0, 5 - (updatedUsage.prompts_used || 0)) : '∞';
    }
    if (loader) loader.classList.add('hidden');
    if (btnText) btnText.textContent = 'Generate Perfect Prompt';
  });
}

function initOutputScreen() {
  const outputEl = $('final-prompt-display');
  if (!outputEl) return;
  const toggle = $('inject-passport');
  const copyBtn = $('copy-final-btn');
  let basePrompt = window._CloastaGeneratedPrompt || '';
  function getFinalPrompt() {
    if (toggle?.checked) { const passport = getPassportText(); return passport ? `${passport}\n\n---\n\n${basePrompt}` : basePrompt; }
    return basePrompt;
  }
  outputEl.textContent = getFinalPrompt();
  if (toggle) { const nt = toggle.cloneNode(true); toggle.parentNode.replaceChild(nt, toggle); nt.addEventListener('change', () => { outputEl.textContent = getFinalPrompt(); showToast(nt.checked ? '🪪 Identity Attached' : '🪪 Identity Removed'); }); }
  if (copyBtn) { const nc = copyBtn.cloneNode(true); copyBtn.parentNode.replaceChild(nc, copyBtn); nc.addEventListener('click', () => { navigator.clipboard.writeText(getFinalPrompt()); showToast('📋 Prompt Copied'); }); }
}

async function saveToHistory(promptText, inputText, mode) {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('prompts').insert({ user_id: user.id, input_text: inputText, generated_prompt: promptText, memory_mode: mode });
}

async function renderHistory() {
  const c = $('recent-history-container');
  if (!c) return;
  const user = await getCurrentUser();
  if (!user) return;
  const { data: history, error } = await supabase.from('prompts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  if (!history || history.length === 0) {
    c.innerHTML = `<div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4"><span class="material-symbols-outlined text-gray-600 text-3xl">history</span></div><p class="text-gray-400 font-medium">No recent syncs.</p>`;
    return;
  }
  c.innerHTML = history.map(item => `<div class="w-full bg-black border border-[#222222] p-4 rounded-xl text-left space-y-2 hover:border-white/20 transition-colors"><div class="flex justify-between"><span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">${new Date(item.created_at).toLocaleDateString()}</span><span class="text-[9px] px-2 py-0.5 rounded bg-white/10 text-gray-400 font-bold uppercase">${item.memory_mode || 'default'}</span></div><p class="text-xs text-gray-300 font-mono line-clamp-2">${cleanPrompt(item.generated_prompt).substring(0, 120)}...</p></div>`).join('');
}

// ==========================================
// SETTINGS
// ==========================================
async function loadSettings() {
  const user = await getCurrentUser();
  if (!user) return;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) return;
  if ($('settings-name')) $('settings-name').value = profile.full_name || '';
  if ($('settings-role')) $('settings-role').value = profile.role || '';
  if ($('settings-goals')) $('settings-goals').value = profile.goals || '';
  const cs = profile.communication_style || '';
  if ($('settings-comm-style')) $('settings-comm-style').value = cs.includes('|') ? cs.split('|')[0] : cs || 'Professional';
  if ($('settings-active-mode')) $('settings-active-mode').value = profile.active_mode || 'founder';
  if ($('settings-context')) $('settings-context').value = profile.active_context || '';
  if ($('settings-target-ai')) $('settings-target-ai').value = profile.target_ai || 'Common AI';
  if ($('settings-plan')) $('settings-plan').textContent = (profile.subscription_plan || 'free').toUpperCase();
  if ($('settings-email')) $('settings-email').textContent = user.email;
}

async function saveSettings() {
  const user = await getCurrentUser();
  if (!user) return;
  const btn = $('save-settings-btn');
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
  try {
    const updateData = {
      full_name: $('settings-name')?.value || '',
      role: $('settings-role')?.value || '',
      goals: $('settings-goals')?.value || '',
      communication_style: $('settings-comm-style')?.value || 'Professional',
      active_mode: $('settings-active-mode')?.value || 'founder',
      active_context: $('settings-context')?.value || '',
      target_ai: $('settings-target-ai')?.value || 'Common AI'
    };
    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
    if (error) throw error;
    _cachedProfile = { ..._cachedProfile, ...updateData };
    updateNameUI(updateData.full_name || 'User');
    updateAvatarUI(updateData.full_name || 'User');
    if ($('summary-role')) $('summary-role').textContent = updateData.role || 'Role';
    if ($('summary-style')) $('summary-style').textContent = updateData.communication_style;
    if ($('summary-mode')) $('summary-mode').textContent = updateData.active_mode.charAt(0).toUpperCase() + updateData.active_mode.slice(1);
    loadMemoryModes({ ...(_cachedProfile || {}), active_mode: updateData.active_mode });
    showToast('✅ Settings saved');
  } catch (err) { showToast(`❌ Save failed: ${err.message}`); }
  finally { if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; } }
}

// ==========================================
// AUTH STATE → DASHBOARD LOADER
// ==========================================
let _dashboardLoaded = false;
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    const isDashboard = window.location.pathname.includes('dashboard');
    if (session && isDashboard) {
      if (_dashboardLoaded) return;
      _dashboardLoaded = true;
      await loadDashboard(session);
      initNavigation();
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('upgraded') === 'true') {
        showToast('🎉 Welcome to Cloasta Pro! Unlimited access unlocked.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (!session && isDashboard) {
      window.location.replace('/login.html');
    }
  }
  if (event === 'SIGNED_OUT') { window.location.replace('/login.html'); }
});
