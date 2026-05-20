import { supabase, getCurrentUser } from './auth.js';
import { $ } from './utils.js';

export async function initTour() {
    const user = await getCurrentUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('tour_completed')
        .eq('id', user.id)
        .single();

    if (profile?.tour_completed) return;

    const steps = [
        { target: 'tour-voice', text: 'Record your idea here', side: 'right' },
        { target: 'tour-passport', text: 'Save your identity once', side: 'right' },
        { target: 'tour-sync', text: 'Continue any AI session', side: 'right' }
    ];

    let currentStep = 0;

    function showStep(index) {
        // Remove existing tooltips
        document.querySelectorAll('.tour-tooltip').forEach(el => el.remove());

        if (index >= steps.length) {
            finishTour();
            return;
        }

        const step = steps[index];
        const targetEl = $(step.target);
        if (!targetEl) {
            showStep(index + 1);
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'tour-tooltip fixed z-[100] bg-white text-black px-4 py-3 rounded-xl font-bold shadow-2xl animate-bounce-subtle flex flex-col gap-2 max-w-[200px]';
        tooltip.style.left = `${rect.right + 20}px`;
        tooltip.style.top = `${rect.top + (rect.height / 2) - 30}px`;
        
        tooltip.innerHTML = `
            <p class="text-sm">${step.text}</p>
            <button class="bg-black text-white text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-widest hover:scale-105 transition-transform">
                ${index === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
            <div class="absolute left-[-8px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-right-[8px] border-r-white"></div>
        `;

        document.body.appendChild(tooltip);

        tooltip.querySelector('button').onclick = () => {
            showStep(index + 1);
        };
    }

    async function finishTour() {
        if (user) {
            await supabase.from('profiles').update({ tour_completed: true }).eq('id', user.id);
        }
    }

    // Start tour
    setTimeout(() => showStep(0), 1000);
}
