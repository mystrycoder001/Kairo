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

    const trialEnd = new Date(profile.trial_end_date);
    const now = new Date();
    
    // Calculate days left
    const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
    const percent = (daysLeft / 14) * 100;
    
    const daysText = $('trial-days-text');
    const progressBar = $('trial-progress-bar');

    if (daysText) daysText.textContent = daysLeft + ' days left';
    if (progressBar) {
        progressBar.style.width = percent + '%';
        // Turn red when 3 days left
        if (daysLeft <= 3) {
            progressBar.style.background = '#ef4444';
        }
    }

    // Update Top Banner if exists
    const banner = $('trial-banner');
    if (banner) {
        const daysLeftSpan = $('trial-days-left');
        if (daysLeftSpan) daysLeftSpan.textContent = daysLeft;
        banner.classList.toggle('hidden', false);
        
        if (daysLeft <= 0 || profile.plan_tier === 'expired') {
            banner.innerHTML = `⚠️ Trial Expired. <a href="pricing.html" class="underline hover:text-white font-extrabold">Upgrade to Pro</a>`;
            banner.classList.add('bg-red-600', 'text-white');
            banner.classList.remove('bg-yellow-500', 'text-black');
        }
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
