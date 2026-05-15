import { initVoice } from './voice.js';
import { generatePrompt } from './gemini.js';
import { initPassport, getPassportText } from './passport.js';
import { initSessionSync } from './session-sync.js';
import { updateTrialUI, enforceTrial } from './trial.js';
import { getCurrentUser, logout, supabase } from './auth.js';
import { initTour } from './tour.js';
import { initMemoryModes } from './memory-modes.js';

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

    if (user) {
        if ($('sidebar-name')) $('sidebar-name').textContent = user.email || 'User';
        if ($('sidebar-avatar')) $('sidebar-avatar').textContent = (user.email || 'U').charAt(0).toUpperCase();
        if ($('summary-name')) $('summary-name').textContent = user.email ? user.email.split('@')[0] : 'User Identity';
        
        // Fetch profile data for summary
        const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single();
        if (profile) {
            if ($('summary-name')) $('summary-name').textContent = profile.name || user.email.split('@')[0];
            if ($('summary-role')) $('summary-role').textContent = profile.role || 'Role';
            if ($('sidebar-name')) $('sidebar-name').textContent = profile.name || user.email;
        }
    }

    $('logout-btn')?.addEventListener('click', async () => {
        await logout();
    });

    // 2. Initialize Trial
    await updateTrialUI();
    setInterval(updateTrialUI, 60000); // Check trial every minute

    // 3. Navigation inside Dashboard
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.getAttribute('data-nav');
            if (await enforceTrial()) return;
            navigateTo(target);
        });
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
    if (await enforceTrial()) return;

    const loader = $('generate-loader');
    const generateBtn = $('generate-prompt-btn');
    const btnText = generateBtn ? generateBtn.querySelector('span') : null;
    
    if(loader) loader.classList.remove('hidden');
    if(btnText) btnText.textContent = 'Generating...';

    try {
        const activeMode = localStorage.getItem('mindwave_active_mode') || 'Default';
        const prompt = await generatePrompt(text, activeMode);
        if (!prompt) throw new Error('Empty response from AI');

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

    const { error } = await supabase
        .from('prompts')
        .insert({
            user_id: user.id,
            input_text: inputText,
            generated_prompt: promptText,
            memory_mode: localStorage.getItem('mindwave_active_mode') || 'Default'
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
            <p class="text-sm text-gray-300 font-mono line-clamp-2">${item.generated_prompt.substring(0, 150)}...</p>
        </div>
    `).join('');
}
