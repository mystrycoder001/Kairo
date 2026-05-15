// js/passport.js — AI Passport Identity Manager with Supabase
import { $, showToast } from './app.js';
import { supabase, getCurrentUser } from './auth.js';

export async function initPassport() {
    const editForm = $('passport-edit-form');
    const saveBtn = $('save-passport-btn');
    const nameInput = $('edit-name');
    const roleInput = $('edit-role');
    const goalsInput = $('edit-goals');
    
    const exportBtn = $('export-passport-btn');
    const copyBtn = $('copy-passport-btn');
    const shareBtn = $('share-passport-btn');

    // Load initial data from Supabase
    const user = await getCurrentUser();
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, role, goals')
            .eq('id', user.id)
            .single();

        if (profile) {
            if (nameInput) nameInput.value = profile.name || '';
            if (roleInput) roleInput.value = profile.role || '';
            if (goalsInput) goalsInput.value = profile.goals || '';
            updateSummaryCard(profile);
            
            if ($('passport-output-text')) {
                $('passport-output-text').textContent = profile.passport_text || 'Fill out the form and generate your passport block.';
            }
        }
    }

    saveBtn?.addEventListener('click', async () => {
        if (!user) return showToast('Please sign in first');

        const data = {
            name: nameInput ? nameInput.value : '',
            role: roleInput ? roleInput.value : '',
            goals: goalsInput ? goalsInput.value : ''
        };
        
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            // Update profile in Supabase
            const { error: updateError } = await supabase
                .from('profiles')
                .update(data)
                .eq('id', user.id);

            if (updateError) throw updateError;
            
            updateSummaryCard(data);
            
            // Save generated text to Supabase
            saveBtn.textContent = 'Saving...';
            const { error: textError } = await supabase
                .from('profiles')
                .update({ passport_text: block })
                .eq('id', user.id);

            if (textError) throw textError;
            
            renderPassportText();
            showToast('🪪 Passport Updated');
        } catch (err) {
            showToast(`❌ ${err.message}`);
        } finally {
            saveBtn.textContent = 'Save Changes & Regenerate';
            saveBtn.disabled = false;
        }
    });

    // ... rest of export, copy, share logic ...
    exportBtn?.addEventListener('click', () => {
        const text = getPassportText();
        if(!text) return showToast('No passport generated yet');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindwave-passport-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    copyBtn?.addEventListener('click', () => {
        const text = getPassportText();
        if(!text) return showToast('No passport generated yet');
        navigator.clipboard.writeText(text);
        showToast('📋 Copied to clipboard');
    });

    shareBtn?.addEventListener('click', () => {
        showToast('🖼️ Generating Image (Mocked)');
    });
}

function updateSummaryCard(data) {
    if($('summary-name')) $('summary-name').textContent = data.name || 'User';
    if($('summary-role')) $('summary-role').textContent = data.role || 'Role';
    if($('summary-avatar') && data.name) $('summary-avatar').textContent = data.name.charAt(0).toUpperCase();
}

export function getPassportText() {
    const el = $('passport-output-text');
    return el ? el.textContent : '';
}

function renderPassportText() {
    const el = $('passport-output-text');
    if(el) {
        el.textContent = getPassportText() || 'Fill out the form and generate your passport block.';
    }
}

async function generatePassportAPI(data) {
    const response = await fetch('/api/generate-passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to generate passport');
    return result.result || result.text;
}
