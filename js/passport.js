// js/passport.js — AI Passport Identity Manager
import { $, showToast } from './app.js';

export function initPassport() {
    const editForm = $('passport-edit-form');
    const saveBtn = $('save-passport-btn');
    const nameInput = $('edit-name');
    const roleInput = $('edit-role');
    const goalsInput = $('edit-goals');
    
    const exportBtn = $('export-passport-btn');
    const copyBtn = $('copy-passport-btn');
    const shareBtn = $('share-passport-btn');

    // Load initial data
    const savedData = getPassportData();
    if(savedData && nameInput && roleInput) {
        nameInput.value = savedData.name || '';
        roleInput.value = savedData.role || '';
        goalsInput.value = savedData.goals || '';
        updateSummaryCard(savedData);
    }
    
    renderPassportText();

    saveBtn?.addEventListener('click', async () => {
        const data = {
            name: nameInput.value,
            role: roleInput.value,
            goals: goalsInput.value,
            style: savedData.style || 'Professional'
        };
        
        savePassportData(data);
        updateSummaryCard(data);
        
        saveBtn.textContent = 'Generating...';
        saveBtn.disabled = true;

        try {
            const block = await generatePassportAPI(data);
            localStorage.setItem('mindwave_passport_text', block);
            renderPassportText();
            showToast('🪪 Passport Updated');
        } catch (err) {
            showToast(`❌ ${err.message}`);
        } finally {
            saveBtn.textContent = 'Save Changes & Regenerate';
            saveBtn.disabled = false;
        }
    });

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
        // To fully implement, we would draw the summary card to a canvas and export as PNG.
        // For now, this is a placeholder to satisfy the UI requirement.
    });
}

function updateSummaryCard(data) {
    if($('summary-name')) $('summary-name').textContent = data.name || 'User';
    if($('summary-role')) $('summary-role').textContent = data.role || 'Role';
    if($('summary-avatar') && data.name) $('summary-avatar').textContent = data.name.charAt(0).toUpperCase();
}

export function getPassportData() {
    return JSON.parse(localStorage.getItem('mindwave_passport') || 'null');
}

function savePassportData(data) {
    localStorage.setItem('mindwave_passport', JSON.stringify(data));
}

export function getPassportText() {
    return localStorage.getItem('mindwave_passport_text') || '';
}

function renderPassportText() {
    const el = $('passport-output-text');
    if(el) {
        el.textContent = getPassportText() || 'Fill out the form and generate your passport block.';
    }
}

async function generatePassportAPI(data) {
    const response = await fetch('/api/_ai-waterfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'passport', data })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result.text;
}
