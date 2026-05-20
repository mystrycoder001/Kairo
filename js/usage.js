import { supabase, getCurrentUser } from './auth.js';
import { $ } from './utils.js';

// Plan hierarchy: free < pro < ultra
const PLAN_HIERARCHY = { free: 0, pro: 1, ultra: 2 };

export function isPaidPlan(plan) {
    return PLAN_HIERARCHY[(plan || 'free').toLowerCase()] >= 1;
}

export async function isPro(user) {
    if (!user) return false;
    const { data } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
    
    return isPaidPlan(data?.subscription_plan);
}

export async function checkPromptLimit(user) {
    if (!user) return false;
    
    const { data } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
        
    if (!data) return false;
    if (isPaidPlan(data.subscription_plan)) return true;
    
    // Free users: backend verifyAndLimit enforces 5/day limit
    // Return true here to let the request flow through to the backend
    return true;
}

export async function checkPassportLimit(user) {
    if (!user) return false;
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
        
    if (!profile) return false;
    
    const plan = (profile.subscription_plan || 'free').toLowerCase();
    if (plan === 'ultra') return true; // Unlimited passports
    
    const { count } = await supabase
        .from('memory_modes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
    
    // Free: 1 passport, Pro: 5 passports, Ultra: unlimited
    const limit = plan === 'pro' ? 5 : 1;
    
    if ((count || 0) >= limit) {
        showUpgradePrompt(`You've reached your limit of ${limit} AI Passport(s). Upgrade for more.`);
        return false;
    }
    
    return true;
}

export async function checkSessionAccess(user) {
    if (!user) return false;
    
    const { data } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
    
    if (isPaidPlan(data?.subscription_plan)) return true;
    
    // Free users: backend verifyAndLimit enforces 2/day sync limit
    return true;
}

export function showUpgradePrompt(message) {
    const modal = $('upgrade-modal');
    if (!modal) return;
    
    const textEl = $('upgrade-message');
    if (textEl) textEl.textContent = message;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
