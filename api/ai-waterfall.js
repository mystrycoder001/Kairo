// api/ai-waterfall.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, data, mode } = req.body;
    
    // Construct Prompt based on Action
    let systemPrompt = "You are an expert AI prompt engineer and architect.";
    let userPrompt = "";

    if (action === 'prompt') {
        systemPrompt += ` Generate a flawless, detailed architectural prompt that the user can paste into Claude or ChatGPT. Active Mode: ${mode}. Be concise and technical.`;
        userPrompt = `Raw thought: "${data}". Format the output cleanly using markdown.`;
    } else if (action === 'passport') {
        systemPrompt += ` The user is providing their identity details. Create a dense 'Identity Block' paragraph summarizing them.`;
        userPrompt = `Name: ${data.name}. Role: ${data.role}. Goals: ${data.goals}. Style: ${data.style}. Output ONLY the identity block.`;
    } else if (action === 'sync') {
        systemPrompt += ` The user is providing a messy session history from another AI. Extract the core state, context, and immediate next steps into a 'Session Sync Context Block'.`;
        userPrompt = `History:\n\n${data}\n\nOutput ONLY the context block.`;
    } else {
        return res.status(400).json({ error: 'Invalid action' });
    }

    // 1. Try Gemini
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest", systemInstruction: systemPrompt });
        const result = await model.generateContent(userPrompt);
        return res.status(200).json({ text: result.response.text() });
    } catch (err1) {
        console.warn('Gemini failed, falling back to Groq LLaMA 3', err1);
        
        // 2. Fallback to Groq
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama3-70b-8192',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                })
            });
            const groqData = await groqRes.json();
            if(groqRes.ok) return res.status(200).json({ text: groqData.choices[0].message.content });
        } catch (err2) {
            console.warn('Groq failed, falling back to OpenRouter Claude', err2);
            
            // 3. Fallback to OpenRouter (Claude 3 Haiku)
            try {
                const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'anthropic/claude-3-haiku',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ]
                    })
                });
                const orData = await orRes.json();
                if(orRes.ok) return res.status(200).json({ text: orData.choices[0].message.content });
                
                throw new Error('All AI providers failed.');
            } catch (err3) {
                return res.status(500).json({ error: 'AI Waterfall failed completely.' });
            }
        }
    }
}
