// js/session-sync.js — Session Sync Logic
import { $, showToast } from './app.js';

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

        if(loader) loader.classList.remove('hidden');
        runBtn.disabled = true;

        try {
            const block = await extractContextAPI(text);
            syncOutput.textContent = block;
            showToast('🔄 Context Extracted');
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
    const response = await fetch('/api/ai-waterfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', data: historyText })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result.text;
}
