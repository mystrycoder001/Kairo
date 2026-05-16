import { initVoice } from './voice.js';
import { generatePrompt } from './gemini.js';
import { initPassport, getPassportText } from './passport.js';
import { initSessionSync } from './session-sync.js';
// trial.js logic removed for Free-Forever model
import { getCurrentUser, logout, supabase } from './auth.js';
import { initTour } from './tour.js';
import { initMemoryModes } from './memory-modes.js';
import { checkPromptLimit } from './usage.js';

export function cleanPrompt(text) {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '').replace(/`{1,3}/g, '')
    .replace(/^\s*[-•]\s/gm, '').trim();
}

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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth
    const user = await getCurrentUser();
    
    const isDashboard = window.location.pathname.includes('dashboard.html');

    if (!user && isDashboard) {
        window.location.href = 'login.html';
        return;
    }

    if (isDashboard) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('upgraded') === 'true') {
            showToast('🎉 Welcome to Mindwave Pro! Unlimited access unlocked.');
            // Remove the param from URL without refreshing
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    if (user) {
        // Fetch profile data for summary and sidebar
        const { data: profile } = await supabase.from('profiles').select('full_name, role, active_mode').eq('id', user.id).single();
        
        const displayName = profile?.full_name 
            || user?.user_metadata?.full_name 
            || user?.user_metadata?.name 
            || user?.email?.split('@')[0] 
            || 'User';

        if ($('sidebar-name')) $('sidebar-name').textContent = displayName;
        if ($('sidebar-avatar')) $('sidebar-avatar').textContent = displayName.charAt(0).toUpperCase();
        if ($('summary-name')) $('summary-name').textContent = displayName;
        if ($('summary-role')) $('summary-role').textContent = profile?.role || 'Role';
    }

    $('logout-btn')?.addEventListener('click', async () => {
        await logout();
    });

    // 2. (Removed Trial Logic)
    
    // 3. Navigation inside Dashboard
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.getAttribute('data-nav');
            navigateTo(target);
        });
    });

    // Handle Upgrade Modal
    const upgradeModal = $('upgrade-modal');
    $('close-upgrade-btn')?.addEventListener('click', () => {
        upgradeModal.classList.add('hidden');
        upgradeModal.classList.remove('flex');
    });

    $('upgrade-btn-sidebar')?.addEventListener('click', () => {
        upgradeModal.classList.remove('hidden');
        upgradeModal.classList.add('flex');
    });

    $('checkout-btn')?.addEventListener('click', async () => {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;
        
        const loader = $('checkout-loader');
        const text = $('checkout-btn').querySelector('span');
        if (loader) loader.classList.remove('hidden');
        if (text) text.textContent = 'Preparing...';
        
        try {
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id, plan_tier: 'pro' })
            });
            const data = await response.json();
            if (data.order_id) {
                const options = {
                    "key": data.key_id,
                    "amount": data.amount,
                    "currency": data.currency,
                    "name": "Mindwave",
                    "description": "Mindwave Pro Subscription",
                    "order_id": data.order_id,
                    "handler": function (response){
                        showToast('✅ Payment successful. Upgrading account...');
                        setTimeout(() => window.location.href = '/dashboard.html?upgraded=true', 1500);
                    },
                    "prefill": {
                        "email": currentUser.email
                    },
                    "theme": {
                        "color": "#000000"
                    }
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
            } else {
                throw new Error(data.error || 'No order ID returned');
            }
        } catch (err) {
            showToast('❌ Failed to start checkout');
            console.error(err);
        } finally {
            if (loader) loader.classList.add('hidden');
            if (text) text.textContent = 'Upgrade Now ($4.99/mo)';
        }
    });

    // 4. Initialize Sub-modules
    initVoice(handleGeneration);
    await initPassport();
    initSessionSync();
    initMemoryModes();
    
    // 5. App Tour (Runs once)
    initTour();

    // 6. Initial History Render
    renderHistory();
});

function navigateTo(screenId) {
    // Update Screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`screen-${screenId}`)?.classList.add('active');

    // Update Sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        if(item.getAttribute('data-nav') === screenId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

async function handleGeneration(text) {
    if (!text) return;
    const user = await getCurrentUser();
    if (!user) {
        showToast('Please sign in to generate prompts.');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    if (!(await checkPromptLimit(user))) return;

    const loader = $('generate-loader');
    const generateBtn = $('generate-prompt-btn');
    const btnText = generateBtn ? generateBtn.querySelector('span') : null;
    
    if(loader) loader.classList.remove('hidden');
    if(btnText) btnText.textContent = 'Generating...';

    try {
        const { data: profile } = await supabase.from('profiles').select('active_mode').eq('id', user.id).single();
        const activeMode = profile?.active_mode || 'Founder Mode';
        let prompt = await generatePrompt(text, activeMode);
        if (!prompt) throw new Error('Empty response from AI');
        prompt = cleanPrompt(prompt);

        window._mindwaveGeneratedPrompt = prompt;
        window._lastInputText = text;
        navigateTo('output');
        initOutputScreen();
        
        // Save to history (Supabase)
        await saveToHistory(prompt, text);
    } catch (err) {
        showToast(`❌ Error: ${err.message}`);
    } finally {
        if(loader) loader.classList.add('hidden');
        if(btnText) btnText.textContent = 'Generate Perfect Prompt';
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

    if (outputEl) {
        outputEl.textContent = getFinalPrompt();
    }

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
            showToast('📋 Prompt Copied to Clipboard');
        });
    }
}

async function saveToHistory(promptText, inputText) {
    const user = await getCurrentUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('active_mode').eq('id', user.id).single();

    const { error } = await supabase
        .from('prompts')
        .insert({
            user_id: user.id,
            input_text: inputText,
            generated_prompt: promptText,
            memory_mode: profile?.active_mode || 'Founder Mode'
        });
    
    if (error) console.error('Error saving prompt:', error);
    renderHistory();
}

export async function renderHistory() {
    const historyContainer = $('recent-history-container');
    if(!historyContainer) return;

    const user = await getCurrentUser();
    if (!user) return;

    const { data: history, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if(error || !history || history.length === 0) {
        historyContainer.innerHTML = '<p class="text-gray-500 text-sm text-center pt-10 italic">No prompts generated yet.</p>';
        return;
    }

    historyContainer.innerHTML = history.map(item => `
        <div class="bg-black border border-[#222222] p-4 rounded-xl mb-3 space-y-2">
            <div class="flex justify-between">
                <span class="text-[10px] text-gray-500 font-bold uppercase">${new Date(item.created_at).toLocaleString()}</span>
                <span class="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-400">${item.memory_mode}</span>
            </div>
            <p class="text-sm text-gray-300 font-mono line-clamp-2">${cleanPrompt(item.generated_prompt).substring(0, 150)}...</p>
        </div>
    `).join('');
}
