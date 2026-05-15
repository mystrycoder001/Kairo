const fetch = require('node-fetch');

/**
 * Intelligent AI Waterfall for Mindwave
 * Gemini 1.5 Flash -> Groq (Llama 3) -> OpenRouter (GPT-3.5)
 */
async function callAIWaterfall(systemPrompt, userMessage) {
  // 1. Try Gemini first
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            role: 'user', 
            parts: [{ text: `SYSTEM: ${systemPrompt}\n\nUSER: ${userMessage}` }] 
          }]
        })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
  } catch (e) { 
    console.error('Gemini failed:', e.message); 
  }

  // 2. Try Groq second
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) return text;
  } catch (e) { 
    console.error('Groq failed:', e.message); 
  }

  // 3. Try OpenRouter last
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) return text;
  } catch (e) { 
    console.error('OpenRouter failed:', e.message); 
  }

  throw new Error('All AI providers in waterfall failed. Please check your API keys.');
}

module.exports = { callAIWaterfall };
