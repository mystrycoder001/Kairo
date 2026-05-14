// js/app.js — Main Controller for Dashboard
import { initVoice } from './voice.js';
import { generatePrompt } from './gemini.js';
import { initPassport, getPassportText } from './passport.js';
import { initSessionSync } from './session-sync.js';
import { updateTrialUI, enforceTrial } from './trial.js';
import { initAuth, getCurrentUser, logout } from './auth.js';
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
    // 1. Initialize Auth
    await initAuth();
    const user = getCurrentUser();
    if (!user) {
        // If not logged in and not in onboarding, redirect might be needed 
        // For now, allow local access if onboarding is complete
        const onboarded = localStorage.getItem('mindwave_onboarding_complete');
        if (!onboarded && window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'onboarding.html';
            return;
        }
    } else {
        if ($('sidebar-name')) $('sidebar-name').textContent = user.email || 'User';
        if ($('sidebar-avatar')) $('sidebar-avatar').textContent = (user.email || 'U').charAt(0).toUpperCase();
    }

    $('logout-btn')?.addEventListener('click', async () => {
        await logout();
        window.location.href = 'index.html';
    });

    // 2. Initialize Trial
    updateTrialUI();
    setInterval(updateTrialUI, 60000); // Check trial every minute

    // 3. Navigation inside Dashboard
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-nav');
            if (enforceTrial()) return;
            navigateTo(target);
        });
    });

    // 4. Initialize Sub-modules
    initVoice(handleGeneration);
    initPassport();
    initSessionSync();
    initMemoryModes();
    
    // 5. App Tour (Runs once)
    initTour();
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
    if (enforceTrial()) return;

    const loader = $('generate-loader');
    const btnText = $('generate-prompt-btn').querySelector('span');
    
    if(loader) loader.classList.remove('hidden');
    if(btnText) btnText.textContent = 'Generating...';

    try {
        const activeMode = localStorage.getItem('mindwave_active_mode') || 'Default';
        const prompt = await generatePrompt(text, activeMode);
        if (!prompt) throw new Error('Empty response from AI');

        window._mindwaveGeneratedPrompt = prompt;
        navigateTo('output');
        initOutputScreen();
        
        // Save to history
        saveToHistory(prompt);
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

    toggle?.addEventListener('change', () => {
        if (outputEl) outputEl.textContent = getFinalPrompt();
        showToast(toggle.checked ? '🪪 Identity Attached' : '🪪 Identity Removed');
    });

    copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(getFinalPrompt());
        showToast('📋 Prompt Copied to Clipboard');
    });
}

function saveToHistory(promptText) {
    const historyContainer = $('recent-history-container');
    if(!historyContainer) return;

    let history = JSON.parse(localStorage.getItem('mindwave_history') || '[]');
    history.unshift({ text: promptText, time: new Date().toLocaleString() });
    if(history.length > 50) history.pop(); // Limit to 50
    localStorage.setItem('mindwave_history', JSON.stringify(history));

    renderHistory();
}

export function renderHistory() {
    const historyContainer = $('recent-history-container');
    if(!historyContainer) return;

    const history = JSON.parse(localStorage.getItem('mindwave_history') || '[]');
    
    if(history.length === 0) {
        historyContainer.innerHTML = '<p class="text-gray-500 text-sm text-center pt-10 italic">No prompts generated yet.</p>';
        return;
    }

    historyContainer.innerHTML = history.map(item => `
        <div class="bg-black border border-[#222222] p-4 rounded-xl mb-3 space-y-2">
            <div class="flex justify-between">
                <span class="text-[10px] text-gray-500 font-bold uppercase">${item.time}</span>
            </div>
            <p class="text-sm text-gray-300 font-mono line-clamp-2">${item.text.substring(0, 150)}...</p>
        </div>
    `).join('');
}
