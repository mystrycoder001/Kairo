const { callAIWaterfall } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are an expert AI prompt engineer for Mindwave. 
Transform the user's rough idea or voice transcript into a clear, detailed, structured AI prompt. 
Output ONLY the final prompt text. No explanation. No preamble. No markdown fences. 
Just the prompt, ready to copy-paste.`;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = req.body?.text || req.body?.transcript || req.body?.input || '';
  const mode = req.body?.mode || 'Default';

  if (!text || text.trim().length < 3) {
    return res.status(400).json({ error: 'Provide at least 3 characters of input' });
  }

  try {
    const finalSystemPrompt = `${SYSTEM_PROMPT}\nActive Mode Context: ${mode}`;
    const result = await callAIWaterfall(finalSystemPrompt, text.trim());
    return res.status(200).json({ result, text: result });
  } catch (err) {
    console.error('generate-prompt error:', err);
    return res.status(500).json({ error: err.message });
  }
};
