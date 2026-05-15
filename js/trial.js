// js/trial.js — 14-Day Free Trial Logic using Supabase
import { $, showToast } from './app.js';
import { supabase, getCurrentUser } from './auth.js';

export async function updateTrialUI() {
    const user = await getCurrentUser();
    if (!user) return;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('trial_start_date, trial_end_date, plan_tier')
        .eq('id', user.id)
        .single();

    if (error || !profile) return;

    const banner = $('trial-banner');
    const daysLeftSpan = $('trial-days-left');
    const progressBar = $('trial-progress-bar');
    const progressText = $('trial-progress-text');
    
    const trialEnd = new Date(profile.trial_end_date);
    const now = new Date();
    
    // Calculate days left
    const diffTime = trialEnd - now;
    const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    // Calculate progress (assuming 14 days)
    const totalTrialMs = 14 * 24 * 60 * 60 * 1000;
    const trialStart = profile.trial_start_date ? new Date(profile.trial_start_date) : new Date(trialEnd.getTime() - totalTrialMs);
    const msPassed = now - trialStart;
    const progressPercent = Math.max(0, Math.min(100, (msPassed / totalTrialMs) * 100));

    // Update Banner
    if (banner) {
        if (daysLeftSpan) daysLeftSpan.textContent = daysLeft;
        banner.classList.remove('hidden');
        
        if (daysLeft <= 0 || profile.plan_tier === 'expired') {
            banner.innerHTML = `⚠️ Trial Expired. <a href="pricing.html" class="underline hover:text-white font-extrabold">Upgrade to Pro</a>`;
            banner.classList.add('bg-red-600', 'text-white');
            banner.classList.remove('bg-yellow-500', 'text-black');
        } else {
            banner.classList.add('bg-yellow-500', 'text-black');
            banner.classList.remove('bg-red-600', 'text-white');
        }
    }

    // Update Progress Section (Sidebar)
    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }
    if (progressText) {
        progressText.textContent = daysLeft > 0 ? `${daysLeft} days left` : "Trial expired";
    }
}

export async function enforceTrial() {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, trial_end_date')
        .eq('id', user.id)
        .single();

    if (!profile) return false;

    const trialEnd = new Date(profile.trial_end_date);
    const now = new Date();
    
    if (now > trialEnd || profile.plan_tier === 'expired') {
        showToast('⚠️ Trial expired. Please upgrade.');
        window.location.href = 'pricing.html';
        return true;
    }

    return false;
}
