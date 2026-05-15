// js/memory-modes.js — Memory Modes Switcher Logic with Supabase
import { $ } from './app.js';
import { supabase, getCurrentUser } from './auth.js';

export async function initMemoryModes() {
    const container = $('modes-container');
    if(!container) return;

    const user = await getCurrentUser();
    if (!user) return;

    // Load available modes from Supabase
    let { data: savedModes } = await supabase
        .from('memory_modes')
        .select('mode_name')
        .eq('user_id', user.id);

    let modes = savedModes?.map(m => m.mode_name) || [];
    if(modes.length === 0) {
        modes = ["Default", "Professional", "Creative"]; // Default set
        // Insert defaults if none exist
        await supabase.from('memory_modes').insert(
            modes.map(m => ({ user_id: user.id, mode_name: m }))
        );
    }

    // Get active mode
    let activeMode = localStorage.getItem('mindwave_active_mode');
    if (!activeMode || !modes.includes(activeMode)) {
        activeMode = modes[0];
        localStorage.setItem('mindwave_active_mode', activeMode);
    }

    renderModes(container, modes, activeMode);
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
