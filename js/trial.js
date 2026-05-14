// js/trial.js — 14-Day Free Trial Logic
import { $, showToast } from './app.js';

const TRIAL_DAYS = 14;

export function updateTrialUI() {
    const trialStartStr = localStorage.getItem('mindwave_trial_start');
    const banner = $('trial-banner');
    const daysLeftSpan = $('trial-days-left');
    
    if (!trialStartStr) return; // Not started yet

    const trialStart = parseInt(trialStartStr, 10);
    const now = Date.now();
    const msPassed = now - trialStart;
    const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, TRIAL_DAYS - daysPassed);

    if (banner && daysLeftSpan) {
        banner.classList.remove('hidden');
        daysLeftSpan.textContent = daysLeft;
        
        if (daysLeft <= 0) {
            banner.innerHTML = `⚠️ 14-Day Free Trial Expired. <a href="pricing.html" class="underline hover:text-white font-extrabold">Upgrade to Pro to restore access</a>`;
            banner.classList.replace('bg-yellow-500', 'bg-red-600');
            banner.classList.replace('text-black', 'text-white');
        } else if (daysLeft <= 3) {
            banner.classList.replace('bg-yellow-500', 'bg-orange-500');
        }
    }
}

export function enforceTrial() {
    const trialStartStr = localStorage.getItem('mindwave_trial_start');
    if (!trialStartStr) return false;

    const trialStart = parseInt(trialStartStr, 10);
    const now = Date.now();
    const msPassed = now - trialStart;
    const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));
    
    if (daysPassed >= TRIAL_DAYS) {
        showToast('⚠️ Trial expired. Please upgrade.');
        // Optionally redirect to pricing
        window.location.href = 'pricing.html';
        return true; // Enforced
    }

    return false; // Not enforced
}
