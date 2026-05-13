import { callAIWaterfall } from './_ai-waterfall.js';

const SYSTEM_PROMPT = `You are an AI identity specialist.
The user will provide their personal details, goals, and preferences.
Your job: create a concise, reusable "AI Passport" — a context block they can paste at the start of ANY AI conversation.

Format the passport clearly with these sections:
## About Me
## My Goals
## Communication Preferences
## Context for AI Tools

Rules:
- Write in first person ("I am...", "My goal is...")
- Be specific and actionable — not generic fluff
- Keep it under 200 words total
- Make it feel personal and authentic
- Output ONLY the passport text, no explanations`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userData = req.body || {};

  const userMsg = `Please create my AI Passport from these details:
Name: ${userData.name || 'Not provided'}
Age: ${userData.age || 'Not provided'}
Role: ${userData.role || 'Not provided'}
Goals: ${userData.goals || 'Not provided'}
Communication Style: ${userData.style || 'Not provided'}
Favourite AI Tools: ${userData.tools?.join(', ') || 'Not provided'}
Additional Context: ${userData.context || 'None'}`;

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, userMsg);
    return res.status(200).json({ result });
  } catch (err) {
    console.error('generate-passport error:', err);
    return res.status(500).json({ error: 'Failed to generate passport. Please try again.' });
  }
}
