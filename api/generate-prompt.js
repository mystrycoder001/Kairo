const { callAIWaterfall, verifyAndLimit } = require('./_ai-waterfall');

const SYSTEM_PROMPT_FREE = `You are a standard AI prompt formatter. 
Transform the user's input into a basic, structured prompt.
Do not invent extensive deep context. Keep it generic and standard.
Output ONLY the final prompt text. No explanation. No preamble. No markdown fences.`;

const SYSTEM_PROMPT_PRO = `You are an elite AI prompt engineer for Mindwave.
Transform the user's rough idea or voice transcript into a DEEP, highly structured, memory-aware AI prompt.
Incorporate advanced context optimization and formatting suited perfectly for elite AI (ChatGPT/Claude/Gemini).
Make it feel 10x more intelligent. 
Output ONLY the final prompt text. No explanation. No preamble. No markdown fences. 
Just the prompt, ready to copy-paste.`;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = req.body?.text || req.body?.transcript || req.body?.input || '';
  const mode = req.body?.mode || 'Default';

  if (!text || text.trim().length < 3) {
    return res.status(400).json({ error: 'Provide at least 3 characters of input' });
  }

  try {
    let profile;
    try {
      profile = await verifyAndLimit(req, 'prompt');
    } catch (authErr) {
      return res.status(authErr.status || 401).json({ error: authErr.error || 'auth_error', message: authErr.message });
    }

    const isFree = profile.plan_tier === 'free';
    const basePrompt = isFree ? SYSTEM_PROMPT_FREE : SYSTEM_PROMPT_PRO;
    
    const finalSystemPrompt = `${basePrompt}\nActive Mode Context: ${mode}`;
    const result = await callAIWaterfall(finalSystemPrompt, text.trim());
    return res.status(200).json({ result, text: result });
  } catch (err) {
    console.error('generate-prompt error:', err);
    return res.status(500).json({ error: err.message });
  }
};
