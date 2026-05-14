const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, data, mode } = req.body || {};

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
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemPrompt });
                const result = await model.generateContent(userPrompt);
                const text = result.response.text();
                if (text) return res.status(200).json({ text });
            } catch (err1) {
                console.warn('Gemini failed:', err1.message);
            }
        }

        // 2. Fallback to Groq
        if (process.env.GROQ_API_KEY) {
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
                if (groqRes.ok && groqData.choices?.[0]?.message?.content) {
                    return res.status(200).json({ text: groqData.choices[0].message.content });
                }
            } catch (err2) {
                console.warn('Groq failed:', err2.message);
            }
        }

        // 3. Fallback to OpenRouter
        if (process.env.OPENROUTER_API_KEY) {
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
                if (orRes.ok && orData.choices?.[0]?.message?.content) {
                    return res.status(200).json({ text: orData.choices[0].message.content });
                }
            } catch (err3) {
                console.warn('OpenRouter failed:', err3.message);
            }
        }

        return res.status(500).json({ error: 'All AI providers failed. Check API keys in Vercel Environment Variables.' });

    } catch (e) {
        console.error('Waterfall crash:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
