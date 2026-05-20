const { callAIWaterfall, verifyAndLimit } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are an expert AI prompt engineer.
The user will give you a rough idea, voice transcription, 
or vague request in plain language.

Your job: Transform it into a perfect, structured AI prompt
that gets excellent results from ANY AI tool (ChatGPT, Claude, Gemini).

Rules:
1. Start with a clear role: "You are a [role]..."
2. Include specific instructions, format, tone, constraints
3. Add context that helps the AI understand the goal
4. Make it copy-paste ready for any AI tool
5. Output ONLY the final prompt — no explanation, no preamble
6. No asterisks, no markdown, no bullet symbols
7. Clean plain text only
8. Maximum 250 words

Example input: "help me write youtube video about AI"
Example output:
You are an expert YouTube content strategist and scriptwriter.
Write a compelling 8-minute YouTube video script about artificial 
intelligence for a general audience. Include: an attention-grabbing 
hook in the first 30 seconds, 3 main sections explaining what AI is, 
how it affects daily life, and what the future holds, relatable 
examples and analogies throughout, and a strong call to action at 
the end. Tone: conversational, engaging, and optimistic. Format the 
script with clear section headers and estimated timing for each part.`;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = req.body?.text || req.body?.transcript || req.body?.input || '';
  const mode = req.body?.mode || 'Default';
  const targetAi = (req.body?.target_ai || 'common').toLowerCase();

  if (!text || text.trim().length < 3) {
    return res.status(400).json({ error: 'Provide at least 3 characters of input' });
  }

  try {
    let profile;
    try {
      profile = await verifyAndLimit(req, 'prompt');
    } catch (authErr) {
      return res.status(authErr.status || 401).json({ 
        error: authErr.error || 'auth_error', 
        message: authErr.message || 'Authentication failed.' 
      });
    }

    let finalSystemPrompt = SYSTEM_PROMPT;
    if (mode && mode !== 'Default') {
      finalSystemPrompt += `\nActive Mode Context: ${mode}`;
    }
    if (targetAi && targetAi !== 'common') {
      finalSystemPrompt += `\nOptimization target: ${targetAi}`;
    }
    
    const result = await callAIWaterfall(finalSystemPrompt, text.trim());
    
    let cleanPrompt = result || '';
    cleanPrompt = cleanPrompt
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`/g, '')
      .trim();

    if (!cleanPrompt) {
      cleanPrompt = `You are a helpful assistant. Please perform the following task: ${text}`;
    }

    return res.status(200).json({ result: cleanPrompt, prompt: cleanPrompt });
  } catch (err) {
    console.error('generate-prompt error:', err);
    return res.status(500).json({ error: 'AI service error. Please try again.' });
  }
};
