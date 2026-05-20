// js/session-sync.js — Session Sync Logic with Supabase
import { $, showToast, cleanPrompt } from './utils.js';
import { supabase, getCurrentUser, getAccessToken } from './auth.js';
import { checkSessionAccess } from './usage.js';

export function initSessionSync() {
    const syncInput = $('sync-input');
    const runBtn = $('run-sync-btn');
    const syncOutput = $('sync-output');
    const copyBtn = $('copy-sync-btn');
    const loader = $('sync-loader');

    runBtn?.addEventListener('click', async () => {
        if (!syncInput) return;
        const text = syncInput.value.trim();
        if (!text || text.length < 20) {
            return showToast('⚠️ Please paste a valid conversation history');
        }

        const user = await getCurrentUser();
        if (!user) return showToast('Please sign in first');

        // Check if user has session sync quota
        if (!(await checkSessionAccess(user))) return;

        if(loader) loader.classList.remove('hidden');
        if(runBtn) runBtn.disabled = true;

        try {
            const rawBlock = await extractContextAPI(text);
            const cleanBlock = cleanPrompt(rawBlock);
            const block = `${cleanBlock}\n\n[Cloasta Intelligence Continuity]`;
            if (syncOutput) syncOutput.textContent = block;

            // Save to Supabase
            const { error } = await supabase
                .from('sessions')
                .insert({
                    user_id: user.id,
                    session_input: text.substring(0, 500), // Store snippet
                    context_block: block,
                    session_type: 'sync'
                });

            if (error) console.error('Error saving session sync:', error);

            showToast('🔄 Context Extracted & Saved');
        } catch (err) {
            showToast(`❌ ${err.message}`);
        } finally {
            if(loader) loader.classList.add('hidden');
            if(runBtn) runBtn.disabled = false;
        }
    });

    copyBtn?.addEventListener('click', () => {
        if(syncOutput && syncOutput.textContent) {
            navigator.clipboard.writeText(syncOutput.textContent);
            showToast('📋 Copied to clipboard');
        }
    });
}

async function extractContextAPI(historyText) {
    const token = await getAccessToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/session-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ history: historyText })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Failed to sync session');
    return result.result || result.contextBlock || result.text;
}
