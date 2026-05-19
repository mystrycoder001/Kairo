import { initVoice } from './voice.js';
import { generatePrompt } from './gemini.js';
import { initPassport, getPassportText } from './passport.js';
import { initSessionSync } from './session-sync.js';
import { getCurrentUser, logout, supabase, getAccessToken } from './auth.js';
import { initTour } from './tour.js';

// DOM Utilities
export const $ = (id) => document.getElementById(id);

export function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('opacity-0', 'translate-y-20');
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-20');
  }, 3000);
}

// Centralized Error Logging
export function logError(component, error) {
    console.error(`[Cloasta Error] Component: ${component} | Message: ${error.message || error}`, error);
}

// Safe Async Wrapper
async function safeRun(component, fn) {
    try {
        const result = await fn();
        return result;
    } catch (err) {
        logError(component, err);
        showToast(`⚠️ ${component} failed. Please refresh.`);
    }
}

export function cleanPrompt(text) {
    if (!text) return '';
    return text
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '').replace(/`{1,3}/g, '')
      .replace(/^\s*[-•]\s/gm, '').trim();
}

const memoryModes = [
  { id: 'founder', label: 'Founder', icon: '🚀' },
  { id: 'study', label: 'Study', icon: '📚' },
  { id: 'coding', label: 'Coding', icon: '💻' },
  { id: 'creator', label: 'Creator', icon: '🎨' },
  { id: 'freelancer', label: 'Freelancer', icon: '💼' }
];

// Cache profile data to avoid redundant fetches
let _cachedProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Auth Check
    const user = await safeRun('AuthInit', getCurrentUser);
    const isDashboard = window.location.pathname.includes('dashboard');

    if (!user && isDashboard) {
        window.location.href = '/login.html';
        return;
    }

    // 2. Initialize Core Modules Safely
    if (isDashboard) {
        // Show loading state
        showLoadingSkeleton(true);
        await safeRun('DashboardLoad', loadDashboard);
        showLoadingSkeleton(false);
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('upgraded') === 'true') {
            showToast('🎉 Welcome to Cloasta Pro! Unlimited access unlocked.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // 3. Initialize Secondary Modules
    safeRun('VoiceInit', () => initVoice(handleGeneration));
    safeRun('PassportInit', initPassport);
    safeRun('SessionSyncInit', initSessionSync);
    safeRun('TourInit', initTour);
    
    // Global Runtime Error Capture
    window.onerror = (msg, url, lineNo, columnNo, error) => {
        logError('Runtime', error || msg);
        return false;
    };

    window.onunhandledrejection = (event) => {
        logError('UnhandledPromise', event.reason);
    };

    // 4. Attach Global Listeners Defensively
    $('logout-btn')?.addEventListener('click', async () => await safeRun('Logout', logout));
    $('settings-logout-btn')?.addEventListener('click', async () => await safeRun('Logout', logout));
    
    safeRun('NavigationInit', initNavigation);

    $('mobile-menu-toggle')?.addEventListener('click', () => {
        const sidebar = $('sidebar');
        const overlay = $('sidebar-overlay');
        if (sidebar) {
            sidebar.classList.remove('hidden-mobile');
            if (overlay) overlay.classList.remove('hidden');
        }
    });

    // Mobile sidebar overlay close
    $('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

    $('close-upgrade-btn')?.addEventListener('click', hideUpgradeModal);
    $('banner-upgrade-btn')?.addEventListener('click', showUpgradeModal);
    $('sidebar-upgrade-btn')?.addEventListener('click', showUpgradeModal);
    $('checkout-btn')?.addEventListener('click', () => safeRun('Upgrade', handleUpgrade));

    // Settings save button
    $('save-settings-btn')?.addEventListener('click', () => safeRun('SettingsSave', saveSettings));
});

function closeMobileSidebar() {
    const sidebar = $('sidebar');
    const overlay = $('sidebar-overlay');
    if (sidebar) sidebar.classList.add('hidden-mobile');
    if (overlay) overlay.classList.add('hidden');
}

function showLoadingSkeleton(show) {
    const skeleton = $('loading-skeleton');
    const content = $('dashboard-content');
    if (skeleton) skeleton.classList.toggle('hidden', !show);
    if (content) content.classList.toggle('hidden', show);
}

async function loadDashboard() {
  const user = await getCurrentUser();
  if (!user) return;

  // Fetch Profile, Usage, and History in parallel
  const [profileResult, usageResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('usage_tracking').select('*').eq('user_id', user.id).single()
  ]);

  const profileErr = profileResult.error;
  const profile = profileResult.data;
  
  // No profile row (PGRST116) or null → onboarding
  if (!profile || (profileErr && profileErr.code === 'PGRST116')) {
    window.location.href = '/onboarding.html';
    return;
  }
  if (profileErr) throw profileErr;
  
  if (!profile.onboarding_completed) {
    window.location.href = '/onboarding.html';
    return;
  }

  _cachedProfile = profile;

  // 2. Update UI with real data
  const displayName = profile.full_name || user.email.split('@')[0];
  document.querySelectorAll('#user-name, .user-name, #sidebar-name, #sidebar-user').forEach(el => {
      el.textContent = displayName;
  });
  
  if ($('user-email')) $('user-email').textContent = user.email;
  if ($('user-plan')) $('user-plan').textContent = (profile.subscription_plan || 'FREE').toUpperCase();
  if ($('sidebar-tier')) $('sidebar-tier').textContent = (profile.subscription_plan || 'FREE').toUpperCase() + ' TIER';
  
  const avatarChar = displayName[0]?.toUpperCase() || 'U';
  document.querySelectorAll('#user-avatar, #sidebar-avatar').forEach(el => {
      el.textContent = avatarChar;
  });

  // 3. Profile Card Details
  updateProfileCard(profile);

  // 4. Load Usage
  const usage = usageResult.data;
  if (usage && $('prompts-used')) {
    $('prompts-used').textContent = usage.prompts_used || 0;
  }

  // 5. Memory Modes
  loadMemoryModes(profile);

  // 6. Check Usage Limits
  checkUsageLimit(usage, profile);
  
  // 7. Render History
  safeRun('HistoryLoad', renderHistory);
}

function loadMemoryModes(profile) {
  const container = $('modes-container');
  if (!container) return;

  const activeMode = profile.active_mode || 'founder';

  container.innerHTML = memoryModes.map(mode => `
    <button class="mode-card flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all cursor-pointer ${activeMode === mode.id ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}" 
            data-mode-id="${mode.id}">
      <span class="text-xl">${mode.icon}</span>
      <span class="font-bold text-sm tracking-tight">${mode.label}</span>
    </button>
  `).join('');

  // Attach listeners via delegation (no onclick in HTML)
  container.querySelectorAll('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const modeId = btn.getAttribute('data-mode-id');
      if (modeId) window.setActiveMode(modeId);
    });
  });
}

window.setActiveMode = async (modeId) => {
    await safeRun('SetMode', async () => {
        const user = await getCurrentUser();
        if (!user) return;
        const { error } = await supabase.from('profiles').update({ active_mode: modeId }).eq('id', user.id);
        if (error) throw error;
        showToast(`🧠 Switched to ${modeId.charAt(0).toUpperCase() + modeId.slice(1)} Memory`);
        
        // Only re-render the modes section, not the entire dashboard
        if (_cachedProfile) {
            _cachedProfile.active_mode = modeId;
            loadMemoryModes(_cachedProfile);
            if ($('summary-mode')) $('summary-mode').textContent = modeId.charAt(0).toUpperCase() + modeId.slice(1);
        }
    });
};

function checkUsageLimit(usage, profile) {
  const limit = 5;
  const promptsUsed = usage?.prompts_used || 0;
  const isFree = (profile.subscription_plan || 'free').toLowerCase() === 'free';
  
  const banner = $('upgrade-banner');
  const sidebarUpgrade = $('sidebar-upgrade-container');

  if (isFree) {
    if (sidebarUpgrade) sidebarUpgrade.classList.remove('hidden');
    if (promptsUsed >= limit) {
      if (banner) banner.classList.remove('hidden');
      if ($('generate-prompt-btn')) $('generate-prompt-btn').disabled = true;
    }
  }
}

function showUpgradeModal() {
    const modal = $('upgrade-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideUpgradeModal() {
    const modal = $('upgrade-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleUpgrade() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const loader = $('checkout-loader');
    const btn = $('checkout-btn');
    if (loader) loader.classList.remove('hidden');
    if (btn) btn.disabled = true;

    try {
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, plan_tier: 'pro' })
        });
        const data = await response.json();
        
        if (data.order_id) {
            const options = {
                "key": data.key_id,
                "amount": data.amount,
                "currency": data.currency,
                "name": "Cloasta",
                "description": "Cloasta Pro Subscription",
                "order_id": data.order_id,
                "handler": async function (response) {
                    showToast('✅ Payment successful. Upgrading account...');
                    setTimeout(() => window.location.href = '/dashboard.html?upgraded=true', 1500);
                },
                "prefill": { "email": user.email },
                "theme": { "color": "#000000" }
            };
            const rzp = new window.Razorpay(options);
            rzp.open();
        } else {
            throw new Error(data.error || 'Checkout initialization failed');
        }
    } catch (err) {
        showToast(`❌ ${err.message}`);
    } finally {
        if (loader) loader.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
}

export function navigateTo(screenId) {
    console.log(`[Navigation] Navigating to: ${screenId}`);
    const screens = document.querySelectorAll('.screen');
    if (screens.length === 0) return;

    // Support both 'screen-overview' and 'overview'
    const cleanId = screenId.replace('screen-', '');
    const targetId = `screen-${cleanId}`;

    screens.forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; // Ensure fully hidden
    });

    const targetScreen = $(targetId) || $(screenId) || $(cleanId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'block';
    } else {
        console.warn(`[Navigation] Screen not found: ${screenId}`);
    }

    // Update active class on nav elements
    document.querySelectorAll('[data-nav], [data-screen], .sidebar-item').forEach(item => {
        const navTarget = item.getAttribute('data-nav') || item.getAttribute('data-screen') || item.getAttribute('href')?.replace('#', '');
        if (navTarget === cleanId || navTarget === targetId || `screen-${navTarget}` === targetId) {
            item.classList.add('active', 'text-white');
            item.classList.remove('text-gray-400');
        } else {
            item.classList.remove('active', 'text-white');
            item.classList.add('text-gray-400');
        }
    });
}
window.navigateTo = navigateTo;
window.showScreen = navigateTo;

function updateProfileCard(profile) {
  if (!profile) return;
  
  if ($('summary-role')) $('summary-role').textContent = profile.role || 'AI Architect';
  
  if ($('summary-style')) {
    const style = profile.communication_style || 'Balanced';
    $('summary-style').textContent = style.includes('|') ? style.split('|')[0] : style;
  }
  
  if ($('summary-mode')) {
    const mode = profile.active_mode || 'founder';
    $('summary-mode').textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  }
  
  if ($('summary-tools')) {
    const toolCount = profile.favourite_tools ? profile.favourite_tools.split(',').length : 0;
    $('summary-tools').textContent = `${toolCount} Tool${toolCount === 1 ? '' : 's'} Connected`;
  }
}

function initNavigation() {
    const navElements = document.querySelectorAll('[data-screen], [data-nav], .nav-item, nav a, aside a, .sidebar a, .sidebar-item');
    navElements.forEach(item => {
        if (item.dataset.navBound) return;
        item.dataset.navBound = 'true';

        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-screen') || 
                           item.getAttribute('data-nav') || 
                           item.getAttribute('href')?.replace('.html', '').replace('#', '').replace('/', '');
            
            if (!target) return;
            
            if (target === 'upgrade') {
                e.preventDefault();
                showUpgradeModal();
            } else {
                e.preventDefault();
                navigateTo(target);
                if (target === 'settings') {
                    safeRun('SettingsLoad', loadSettings);
                }
            }
            closeMobileSidebar();
        });
    });
}

async function handleGeneration(text) {
    if (!text) return;
    await safeRun('Generation', async () => {
        const user = await getCurrentUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiles').select('subscription_plan').eq('id', user.id).single();
        const { data: usage } = await supabase.from('usage_tracking').select('prompts_used').eq('user_id', user.id).single();
        
        if ((profile?.subscription_plan || 'free') === 'free' && (usage?.prompts_used || 0) >= 5) {
            showUpgradeModal();
            return;
        }

        const loader = $('generate-loader');
        const btnText = $('generate-prompt-btn')?.querySelector('span');
        if (loader) loader.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Thinking...';

        const { data: p } = await supabase.from('profiles').select('active_mode').eq('id', user.id).single();
        const activeMode = p?.active_mode || 'founder';
        
        let prompt = await generatePrompt(text, activeMode);
        if (!prompt) throw new Error('AI failed to respond');
        prompt = cleanPrompt(prompt);

        window._CloastaGeneratedPrompt = prompt;
        navigateTo('output');
        initOutputScreen();
        await saveToHistory(prompt, text, activeMode);
        
        // NOTE: Removed client-side increment_prompts_used — backend handles this exclusively
        // to prevent double-counting

        // Refresh usage display
        const { data: updatedUsage } = await supabase.from('usage_tracking').select('prompts_used').eq('user_id', user.id).single();
        if (updatedUsage && $('prompts-used')) {
            $('prompts-used').textContent = updatedUsage.prompts_used || 0;
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
        if (toggle?.checked) {
            const passport = getPassportText();
            return passport ? `${passport}\n\n---\n\n${basePrompt}` : basePrompt;
        }
        return basePrompt;
    }

    outputEl.textContent = getFinalPrompt();

    if (toggle) {
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener('change', () => {
            if (outputEl) outputEl.textContent = getFinalPrompt();
            showToast(newToggle.checked ? '🪪 Identity Attached' : '🪪 Identity Removed');
        });
    }

    if (copyBtn) {
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        newCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(getFinalPrompt());
            showToast('📋 Prompt Copied');
        });
    }
}

async function saveToHistory(promptText, inputText, mode) {
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('prompts').insert({
        user_id: user.id,
        input_text: inputText,
        generated_prompt: promptText,
        memory_mode: mode
    });
}

async function renderHistory() {
    const historyContainer = $('recent-history-container');
    if(!historyContainer) return;

    const user = await getCurrentUser();
    if (!user) return;

    const { data: history, error } = await supabase.from('prompts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    if (error) throw error;

    if(!history || history.length === 0) {
        historyContainer.innerHTML = `
            <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-gray-600 text-3xl">history</span>
            </div>
            <p class="text-gray-400 font-medium">No recent syncs.</p>
        `;
        return;
    }

    historyContainer.innerHTML = history.map(item => `
        <div class="w-full bg-black border border-[#222222] p-4 rounded-xl text-left space-y-2 hover:border-white/20 transition-colors">
            <div class="flex justify-between">
                <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">${new Date(item.created_at).toLocaleDateString()}</span>
                <span class="text-[9px] px-2 py-0.5 rounded bg-white/10 text-gray-400 font-bold uppercase">${item.memory_mode || 'default'}</span>
            </div>
            <p class="text-xs text-gray-300 font-mono line-clamp-2">${cleanPrompt(item.generated_prompt).substring(0, 120)}...</p>
        </div>
    `).join('');
}

// ==========================================
// SETTINGS SYSTEM
// ==========================================
async function loadSettings() {
    const user = await getCurrentUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) return;

    if ($('settings-name')) $('settings-name').value = profile.full_name || '';
    if ($('settings-role')) $('settings-role').value = profile.role || '';
    if ($('settings-goals')) $('settings-goals').value = profile.goals || '';
    
    const commStyle = profile.communication_style || '';
    if ($('settings-comm-style')) {
        if (commStyle.includes('|')) {
            $('settings-comm-style').value = commStyle.split('|')[0] || 'Professional';
        } else {
            $('settings-comm-style').value = commStyle || 'Professional';
        }
    }

    if ($('settings-active-mode')) $('settings-active-mode').value = profile.active_mode || 'founder';
    if ($('settings-context')) $('settings-context').value = profile.active_context || '';
    if ($('settings-target-ai')) $('settings-target-ai').value = profile.target_ai || 'All';
    if ($('settings-plan')) $('settings-plan').textContent = (profile.subscription_plan || 'free').toUpperCase();
    if ($('settings-email')) $('settings-email').textContent = user.email;
}

async function saveSettings() {
    const user = await getCurrentUser();
    if (!user) return;

    const btn = $('save-settings-btn');
    if (btn) {
        btn.textContent = 'Saving...';
        btn.disabled = true;
    }

    try {
        const updateData = {
            full_name: $('settings-name')?.value || '',
            role: $('settings-role')?.value || '',
            goals: $('settings-goals')?.value || '',
            communication_style: $('settings-comm-style')?.value || 'Professional',
            active_mode: $('settings-active-mode')?.value || 'founder',
            active_context: $('settings-context')?.value || '',
            target_ai: $('settings-target-ai')?.value || 'All'
        };

        const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
        if (error) throw error;

        // Update cached profile
        _cachedProfile = { ..._cachedProfile, ...updateData };

        // Reflect changes in dashboard UI
        if ($('user-name')) $('user-name').textContent = updateData.full_name || 'User';
        if ($('sidebar-name')) $('sidebar-name').textContent = updateData.full_name || 'User';
        if ($('summary-role')) $('summary-role').textContent = updateData.role || 'Role';
        if ($('summary-style')) $('summary-style').textContent = updateData.communication_style.includes('|') ? updateData.communication_style.split('|')[0] : updateData.communication_style;
        if ($('summary-mode')) $('summary-mode').textContent = updateData.active_mode.charAt(0).toUpperCase() + updateData.active_mode.slice(1);
        
        const avatarChar = (updateData.full_name || 'U').charAt(0).toUpperCase();
        if ($('user-avatar')) $('user-avatar').textContent = avatarChar;
        if ($('sidebar-avatar')) $('sidebar-avatar').textContent = avatarChar;

        // Re-render memory modes
        loadMemoryModes({ ...(_cachedProfile || {}), active_mode: updateData.active_mode });

        showToast('✅ Settings saved');
    } catch (err) {
        showToast(`❌ Save failed: ${err.message}`);
    } finally {
        if (btn) {
            btn.textContent = 'Save Changes';
            btn.disabled = false;
        }
    }
}
