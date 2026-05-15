// js/session-sync.js — Session Sync Logic with Supabase
import { $, showToast } from './app.js';
import { supabase, getCurrentUser } from './auth.js';

export function initSessionSync() {
    const syncInput = $('sync-input');
    const runBtn = $('run-sync-btn');
    const syncOutput = $('sync-output');
    const copyBtn = $('copy-sync-btn');
    const loader = $('sync-loader');

    runBtn?.addEventListener('click', async () => {
        const text = syncInput.value.trim();
        if (!text || text.length < 20) {
            return showToast('⚠️ Please paste a valid conversation history');
        }

        const user = await getCurrentUser();
        if (!user) return showToast('Please sign in first');

        if(loader) loader.classList.remove('hidden');
        runBtn.disabled = true;

        try {
            const block = await extractContextAPI(text);
            syncOutput.textContent = block;

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
            runBtn.disabled = false;
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
    const response = await fetch('/api/session-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: historyText })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to sync session');
    return result.result || result.contextBlock || result.text;
}
