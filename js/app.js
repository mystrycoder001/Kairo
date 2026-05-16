import { initVoice } from './voice.js';
import { generatePrompt } from './gemini.js';
import { initPassport, getPassportText } from './passport.js';
import { initSessionSync } from './session-sync.js';
import { getCurrentUser, logout, supabase } from './auth.js';
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

document.addEventListener('DOMContentLoaded', async () => {
    const user = await getCurrentUser();
    const isDashboard = window.location.pathname.includes('dashboard.html');

    if (!user && isDashboard) {
        window.location.href = '/login.html';
        return;
    }

    if (isDashboard) {
        await loadDashboard();
        
        // Handle URL params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('upgraded') === 'true') {
            showToast('🎉 Welcome to MindWave Pro! Unlimited access unlocked.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Initialize Global Modules
    initVoice(handleGeneration);
    await initPassport();
    initSessionSync();
    initTour();
    
    // Global Event Listeners
    $('logout-btn')?.addEventListener('click', async () => await logout());
    
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-nav');
            if (target === 'upgrade') {
                showUpgradeModal();
            } else {
                navigateTo(target);
            }
        });
    });

    $('close-upgrade-btn')?.addEventListener('click', hideUpgradeModal);
    $('banner-upgrade-btn')?.addEventListener('click', showUpgradeModal);
    $('sidebar-upgrade-btn')?.addEventListener('click', showUpgradeModal);

    $('checkout-btn')?.addEventListener('click', handleUpgrade);
});

async function loadDashboard() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const user = session.user;

  // 1. Get Profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  
  if (!profile || !profile.onboarding_completed) {
    window.location.href = '/onboarding.html';
    return;
  }

  // 2. Update UI with real data
  const displayName = profile.full_name || user.email.split('@')[0];
  if ($('user-name')) $('user-name').textContent = displayName;
  if ($('sidebar-name')) $('sidebar-name').textContent = displayName;
  if ($('user-email')) $('user-email').textContent = user.email;
  if ($('user-plan')) $('user-plan').textContent = (profile.subscription_plan || 'FREE').toUpperCase();
  if ($('sidebar-tier')) $('sidebar-tier').textContent = (profile.subscription_plan || 'FREE').toUpperCase() + ' TIER';
  
  const avatarChar = displayName[0].toUpperCase();
  if ($('user-avatar')) $('user-avatar').textContent = avatarChar;
  if ($('sidebar-avatar')) $('sidebar-avatar').textContent = avatarChar;

  // 3. Issue 6: Active Profile Card Details
  if ($('summary-role')) $('summary-role').textContent = profile.role || 'AI Architect';
  if ($('summary-style')) $('summary-style').textContent = profile.comm_style || 'Balanced';
  if ($('summary-mode')) $('summary-mode').textContent = (profile.active_mode || 'founder').charAt(0).toUpperCase() + (profile.active_mode || 'founder').slice(1);
  if ($('summary-tools')) {
      const toolCount = profile.favourite_tools ? profile.favourite_tools.split(',').length : 0;
      $('summary-tools').textContent = `${toolCount} Tool${toolCount === 1 ? '' : 's'} Connected`;
  }

  // 4. Load Usage
  const { data: usage } = await supabase.from('usage_tracking').select('*').eq('user_id', user.id).single();
  if (usage && $('prompts-used')) {
    $('prompts-used').textContent = usage.prompts_used || 0;
  }

  // 5. Memory Modes
  loadMemoryModes(profile);

  // 6. Check Usage Limits
  checkUsageLimit(usage, profile);
  
  // Render History
  renderHistory();
}

function loadMemoryModes(profile) {
  const container = $('modes-container');
  if (!container) return;

  const activeMode = profile.active_mode || 'founder';

  container.innerHTML = memoryModes.map(mode => `
    <button class="mode-card flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all ${activeMode === mode.id ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}" 
            onclick="window.setActiveMode('${mode.id}')">
      <span class="text-xl">${mode.icon}</span>
      <span class="font-bold text-sm tracking-tight">${mode.label}</span>
    </button>
  `).join('');
}

window.setActiveMode = async (modeId) => {
    const user = await getCurrentUser();
    if (!user) return;

    try {
        const { error } = await supabase.from('profiles').update({ active_mode: modeId }).eq('id', user.id);
        if (error) throw error;
        showToast(`🧠 Switched to ${modeId.charAt(0).toUpperCase() + modeId.slice(1)} Memory`);
        await loadDashboard(); // Refresh UI
    } catch (err) {
        showToast('❌ Failed to switch mode');
    }
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
                "name": "MindWave",
                "description": "MindWave Pro Subscription",
                "order_id": data.order_id,
                "handler": async function (response) {
                    showToast('✅ Payment successful. Upgrading account...');
                    // Ideally verify on server, but for now we redirect to a success state
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
        showToast('❌ Error: ' + err.message);
    } finally {
        if (loader) loader.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
}

function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`screen-${screenId}`)?.classList.add('active');

    document.querySelectorAll('.sidebar-item').forEach(item => {
        if(item.getAttribute('data-nav') === screenId) {
            item.classList.add('active', 'text-white');
            item.classList.remove('text-gray-400');
        } else {
            item.classList.remove('active', 'text-white');
            item.classList.add('text-gray-400');
        }
    });
}

async function handleGeneration(text) {
    if (!text) return;
    const user = await getCurrentUser();
    if (!user) return;

    // Check limit again before generation
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

    try {
        const { data: p } = await supabase.from('profiles').select('active_mode').eq('id', user.id).single();
        const activeMode = p?.active_mode || 'founder';
        
        let prompt = await generatePrompt(text, activeMode);
        if (!prompt) throw new Error('AI failed to respond');
        prompt = cleanPrompt(prompt);

        window._mindwaveGeneratedPrompt = prompt;
        navigateTo('output');
        initOutputScreen();
        await saveToHistory(prompt, text, activeMode);
        
        // Increment usage
        await supabase.rpc('increment_prompts_used', { user_id_param: user.id });
        await loadDashboard(); // Refresh usage count
    } catch (err) {
        showToast(`❌ Error: ${err.message}`);
    } finally {
        if (loader) loader.classList.add('hidden');
        if (btnText) btnText.textContent = 'Generate Perfect Prompt';
    }
}

function initOutputScreen() {
    const outputEl = $('final-prompt-display');
    const toggle = $('inject-passport');
    const copyBtn = $('copy-final-btn');

    let basePrompt = window._mindwaveGeneratedPrompt || '';
    
    function getFinalPrompt() {
        if (toggle?.checked) {
            const passport = getPassportText();
            return passport ? `${passport}\n\n---\n\n${basePrompt}` : basePrompt;
        }
        return basePrompt;
    }

    if (outputEl) outputEl.textContent = getFinalPrompt();

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

    const { data: history } = await supabase.from('prompts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    
    if(!history || history.length === 0) {
        historyContainer.innerHTML = `
            <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-gray-600 text-3xl">history</span>
            </div>
            <p class="text-gray-400 font-medium">No recent syncs.</p>
            <p class="text-xs text-gray-600">Your memory will appear here after capture.</p>
        `;
        return;
    }

    historyContainer.innerHTML = history.map(item => `
        <div class="w-full bg-black border border-[#222222] p-4 rounded-xl text-left space-y-2 hover:border-white/20 transition-colors">
            <div class="flex justify-between">
                <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">${new Date(item.created_at).toLocaleDateString()}</span>
                <span class="text-[9px] px-2 py-0.5 rounded bg-white/10 text-gray-400 font-bold uppercase">${item.memory_mode}</span>
            </div>
            <p class="text-xs text-gray-300 font-mono line-clamp-2">${cleanPrompt(item.generated_prompt).substring(0, 120)}...</p>
        </div>
    `).join('');
}
