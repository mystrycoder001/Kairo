// js/memory-modes.js — Memory Modes Switcher Logic with Supabase
import { $ } from './app.js';
import { supabase, getCurrentUser } from './auth.js';

export async function initMemoryModes() {
    const container = $('modes-container');
    if(!container) return;

    const user = await getCurrentUser();
    if (!user) return;

    // Load available modes and active mode from Supabase
    let { data: profile } = await supabase
        .from('profiles')
        .select('active_mode')
        .eq('id', user.id)
        .single();

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

    // Get active mode from profile
    let activeMode = profile?.active_mode;
    if (!activeMode || !modes.includes(activeMode)) {
        activeMode = modes[0] || 'Founder Mode';
        await supabase.from('profiles').update({ active_mode: activeMode }).eq('id', user.id);
    }

    renderModes(container, modes, activeMode);
}

function renderModes(container, modes, activeMode) {
    container.innerHTML = modes.map(mode => {
        const isActive = mode === activeMode;
        return `
            <button class="mode-btn px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                isActive 
                ? 'bg-white text-black shadow-[0_0_25px_rgba(255,255,255,0.2)]' 
                : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-white'
            }" data-mode="${mode}">
                ${mode}
            </button>
        `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const newMode = btn.dataset.mode;
            const user = await getCurrentUser();
            if (user) {
                await supabase.from('profiles').update({ active_mode: newMode }).eq('id', user.id);
            }
            renderModes(container, modes, newMode);
        });
    });
}
