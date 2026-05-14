// js/gemini.js — Client wrapper for generating prompts via backend waterfall
export async function generatePrompt(text, activeMode) {
    const response = await fetch('/api/_ai-waterfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'prompt', 
            data: text,
            mode: activeMode 
        })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to generate prompt');
    
    return result.text;
}
