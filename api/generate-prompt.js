import { callAIWaterfall } from './_ai-waterfall.js';

const SYSTEM_PROMPT = `You are an expert AI prompt engineer. 
The user will give you a rough idea, voice note transcription, or vague request.
Your job: transform it into a clear, detailed, structured AI prompt that will get excellent results from any AI tool (ChatGPT, Gemini, Claude, etc.).

Rules:
- Start with a clear role/context assignment for the AI
- Include specific instructions, desired format, tone, and constraints
- Add relevant examples or context if helpful
- Make it copy-paste ready
- Do NOT include any explanation or preamble — output ONLY the final prompt text
- Keep it under 300 words unless the task genuinely requires more detail`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return res.status(400).json({ error: 'Please provide your idea (at least 3 characters)' });
  }

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, \`Here is my rough idea:\n\n\${text.trim()}\`);
    return res.status(200).json({ result });
  } catch (err) {
    console.error('generate-prompt error:', err);
    return res.status(500).json({ error: 'Failed to generate prompt. Please try again.' });
  }
}
