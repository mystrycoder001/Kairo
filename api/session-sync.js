import { callAIWaterfall } from './_ai-waterfall.js';

const SYSTEM_PROMPT = `You are a Session Sync AI.
The user is providing a summary or transcript of a previous AI conversation from ChatGPT, Claude, or Gemini.
Your job is to read this conversation, extract the crucial context, summarize any key decisions made, and formulate a clear "Continue From Here" block.

The output must be formatted like this:
**Previous Context:** [Brief summary of what was being discussed]
**Key Decisions:** [Bullet points of established facts or decisions]
**Current Goal:** [What the user was about to do next]

Do not include any other conversational fluff. Only output the block.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Please paste a valid conversation summary (at least 10 chars)' });
  }

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, text.trim());
    return res.status(200).json({ result });
  } catch (err) {
    console.error('Session Sync error:', err);
    return res.status(500).json({ error: 'Failed to generate sync block. Please try again later.' });
  }
}
