// js/gemini.js — Client wrapper for generating prompts via backend waterfall
export async function generatePrompt(text, activeMode) {
    const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            text,
            mode: activeMode 
        })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to generate prompt');
    
    return result.result || result.text;
}
