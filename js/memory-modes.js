// js/memory-modes.js — Memory Modes Switcher Logic
import { $ } from './app.js';

export function initMemoryModes() {
    const container = $('modes-container');
    if(!container) return;

    // Load available modes from what was selected in Onboarding
    const savedModes = JSON.parse(localStorage.getItem('mindwave_modes') || '["Default"]');
    if(savedModes.length === 0) savedModes.push('Default');

    // Get active mode
    let activeMode = localStorage.getItem('mindwave_active_mode');
    if (!activeMode || !savedModes.includes(activeMode)) {
        activeMode = savedModes[0];
        localStorage.setItem('mindwave_active_mode', activeMode);
    }

    renderModes(container, savedModes, activeMode);
}

function renderModes(container, modes, activeMode) {
    container.innerHTML = modes.map(mode => {
        const isActive = mode === activeMode;
        return `
            <button class="mode-btn px-4 py-2 rounded-full text-xs font-bold transition-all ${
                isActive 
                ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                : 'bg-black text-gray-400 border border-[#222222] hover:border-white/50 hover:text-white'
            }" data-mode="${mode}">
                ${mode}
            </button>
        `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newMode = btn.dataset.mode;
            localStorage.setItem('mindwave_active_mode', newMode);
            renderModes(container, modes, newMode);
        });
    });
}
