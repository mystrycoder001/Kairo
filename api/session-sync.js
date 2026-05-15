const { callAIWaterfall } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are creating a Mindwave Session Sync block. 
Based on the messy session history provided, write a crisp, dense summary (max 150 words). 
Tell a new AI exactly where the user left off and the core context needed to continue. 
Output ONLY the context block text.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const history = req.body?.history || req.body?.data || '';
  if (!history || history.length < 10) {
    return res.status(400).json({ error: 'Provide valid session history' });
  }

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, history);
    return res.status(200).json({ result, text: result });
  } catch (err) {
    console.error('session-sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};
