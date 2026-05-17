// js/gemini.js — Client wrapper for generating prompts via backend waterfall
import { getAccessToken } from './auth.js';

export async function generatePrompt(text, activeMode) {
    const token = await getAccessToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
            text,
            mode: activeMode 
        })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Failed to generate prompt');
    
    return result.result || result.text;
}
