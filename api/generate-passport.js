const { callAIWaterfall } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are creating an AI Passport for Mindwave — a reusable identity block. 
Based on the user's details, create a concise, powerful identity paragraph (max 120 words). 
Describe who they are, their role, and how AI should adapt to them. 
Output ONLY the block text, no preamble.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, role, goals, style, extra } = req.body || {};
  if (!name && !role) {
    return res.status(400).json({ error: 'Provide at least name or role' });
  }

  const userMessage = `Name: ${name || 'Not provided'}
Role: ${role || 'Not provided'}
Goals: ${goals || 'Not provided'}
Style: ${style || 'Not provided'}
Extra context: ${extra || 'None'}`;

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, userMessage);
    return res.status(200).json({ result, text: result });
  } catch (err) {
    console.error('generate-passport error:', err);
    return res.status(500).json({ error: err.message });
  }
};
