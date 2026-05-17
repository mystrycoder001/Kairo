// js/passport.js — AI Passport Identity Manager with Supabase
import { $, showToast, cleanPrompt } from './app.js';
import { supabase, getCurrentUser, getAccessToken } from './auth.js';
import { checkPassportLimit, incrementPassportCount } from './usage.js';

export async function initPassport() {
    const editForm = $('passport-edit-form');
    const saveBtn = $('save-passport-btn');
    
    // Layer inputs
    const nameInput = $('edit-name');
    const roleInput = $('edit-role');
    const focusInput = $('edit-focus');
    const commStyleInput = $('edit-comm-style');
    const commFormatInput = $('edit-comm-format');
    const commToneInput = $('edit-comm-tone');
    const contextInput = $('edit-context');
    const behaviorInput = $('edit-behavior');
    const neverForgetInput = $('edit-never-forget');
    const targetAiInput = $('edit-target-ai');
    
    const exportBtn = $('export-passport-btn');
    const copyBtn = $('copy-passport-btn');
    const shareBtn = $('share-passport-btn');

    // Load initial data from Supabase
    const user = await getCurrentUser();
    if (user) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, role, goals, communication_style, active_context, behavioral_memory, never_forget, target_ai, passport_text')
                .eq('id', user.id)
                .single();

            if (profile) {
                if (nameInput) nameInput.value = profile.full_name || '';
                if (roleInput) roleInput.value = profile.role || 'Founder';
                if (focusInput) focusInput.value = profile.goals || '';
                
                if (profile.communication_style) {
                    const parts = profile.communication_style.split('|');
                    if (commStyleInput) commStyleInput.value = parts[0] || 'Balanced';
                    if (commFormatInput) commFormatInput.value = parts[1] || 'Mixed';
                    if (commToneInput) commToneInput.value = parts[2] || 'Professional';
                }
                
                if (contextInput) contextInput.value = profile.active_context || '';
                if (behaviorInput) behaviorInput.value = profile.behavioral_memory || '';
                if (neverForgetInput) neverForgetInput.value = profile.never_forget || '';
                if (targetAiInput) targetAiInput.value = profile.target_ai || 'All';
                
                if ($('passport-output-text')) {
                    $('passport-output-text').textContent = profile.passport_text || 'Fill out the form and generate your passport block.';
                }
            }
        } catch (err) {
            console.error('[Passport] Load error:', err);
        }
    }

    saveBtn?.addEventListener('click', async () => {
        if (!user) return showToast('Please sign in first');
        
        if (!(await checkPassportLimit(user))) return;

        const data = {
            full_name: nameInput ? nameInput.value : '',
            role: roleInput ? roleInput.value : '',
            goals: focusInput ? focusInput.value : '',
            communication_style: `${commStyleInput?.value || ''}|${commFormatInput?.value || ''}|${commToneInput?.value || ''}`,
            active_context: contextInput ? contextInput.value : '',
            behavioral_memory: behaviorInput ? behaviorInput.value : '',
            never_forget: neverForgetInput ? neverForgetInput.value : '',
            target_ai: targetAiInput ? targetAiInput.value : 'All'
        };
        
        saveBtn.textContent = 'Saving & Generating...';
        saveBtn.disabled = true;

        try {
            // Update profile in Supabase
            const { error: updateError } = await supabase
                .from('profiles')
                .update(data)
                .eq('id', user.id);

            if (updateError) throw updateError;
            
            // Generate passport via API with auth token
            const generatedPrompt = await generatePassportAPI(data);
            const block = cleanPrompt(generatedPrompt);
            
            // Save generated text to Supabase
            const { error: textError } = await supabase
                .from('profiles')
                .update({ passport_text: block })
                .eq('id', user.id);

            if (textError) throw textError;
            
            await incrementPassportCount(user);
            
            if ($('passport-output-text')) {
                $('passport-output-text').textContent = block;
            }

            // Update dashboard summary cards without full reload
            if ($('user-name')) $('user-name').textContent = data.full_name || 'User';
            if ($('sidebar-name')) $('sidebar-name').textContent = data.full_name || 'User';
            if ($('summary-role')) $('summary-role').textContent = data.role || 'Role';
            if ($('user-avatar')) $('user-avatar').textContent = (data.full_name || 'U').charAt(0).toUpperCase();
            if ($('sidebar-avatar')) $('sidebar-avatar').textContent = (data.full_name || 'U').charAt(0).toUpperCase();

            showToast('🪪 Passport Updated & Generated');
        } catch (err) {
            showToast(`❌ ${err.message}`);
        } finally {
            saveBtn.textContent = 'Save Changes & Regenerate';
            saveBtn.disabled = false;
        }
    });

    exportBtn?.addEventListener('click', () => {
        const text = getPassportText();
        if(!text || text.includes('Fill out the form')) return showToast('No passport generated yet');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindwave-profile-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    copyBtn?.addEventListener('click', () => {
        const text = getPassportText();
        if(!text || text.includes('Fill out the form')) return showToast('No passport generated yet');
        navigator.clipboard.writeText(text);
        showToast('📋 Copied to clipboard');
    });

    shareBtn?.addEventListener('click', () => {
        showToast('🖼️ Generating Image (Mocked)');
    });
}

export function getPassportText() {
    const el = $('passport-output-text');
    return el ? el.textContent : '';
}

async function generatePassportAPI(data) {
    const token = await getAccessToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/generate-passport', {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Failed to generate passport');
    return result.result || result.text;
}
