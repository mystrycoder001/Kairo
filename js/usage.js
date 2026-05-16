import { supabase, getCurrentUser } from './auth.js';
import { $ } from './app.js';

export async function isPro(user) {
    if (!user) return false;
    const { data } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
    
    return data?.subscription_plan === 'pro';
}

export async function checkPromptLimit(user) {
    if (!user) return false;
    
    const { data } = await supabase
        .from('profiles')
        .select('subscription_plan') // Removed prompts_used tracking from frontend for strictness
        .eq('id', user.id)
        .single();
        
    if (!data) return false;
    if (data.subscription_plan === 'pro' || data.subscription_plan === 'ultra') return true;
    
    // We rely on backend verification now for the prompt limits to be fully secure and synchronized.
    // The backend verifyAndLimit handles the 5 prompts limit.
    // So we just return true here to let it hit the backend and fail with a proper message if needed.
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
    if (profile.subscription_plan === 'ultra') return true;
    
    const { count } = await supabase
        .from('memory_modes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
    
    const limit = profile.subscription_plan === 'pro' ? 3 : 1;
    
    if (count >= limit) {
        showUpgradePrompt(`You've reached your limit of ${limit} AI Passport(s). Upgrade for more.`);
        return false;
    }
    
    return true;
}

export async function incrementPassportCount(user) {
    // Deprecated
}

export async function checkSessionAccess(user) {
    if (!user) return false;
    
    const { data } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
        
    if (data?.subscription_plan === 'pro' || data?.subscription_plan === 'ultra') return true;
    
    // Relying on backend verification for session limits.
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
