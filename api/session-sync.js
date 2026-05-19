const { callAIWaterfall, verifyAndLimit } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are an expert AI context engineer.
Analyze this conversation and create a military-grade briefing that lets any AI continue exactly where this left off.

Output EXACTLY this format:

═══════════════════════════════
Cloasta SESSION SYNC
Transferred: [datetime]
═══════════════════════════════

[MISSION BRIEF]
{One powerful sentence about what this session was about}

[DECISIONS MADE]
These are final. Do not revisit:
- {decision 1}
- {decision 2}
- {decision 3}

[WORK COMPLETED]
- {item 1}
- {item 2}

[CURRENT STATUS]
{Exactly where conversation stopped}

[NEXT ACTION]
{The very next thing to do}

[CRITICAL CONTEXT]
- {context 1}
- {context 2}

[NEVER REPEAT]
Already covered - skip these:
- {topic 1}
- {topic 2}

[CONTINUATION PROMPT]
Paste this after the block:
"Full context received. Continue from exactly: {next action}"
═══════════════════════════════
Powered by Cloasta
═══════════════════════════════`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await verifyAndLimit(req, 'sync');
  } catch (authErr) {
    return res.status(authErr.status || 401).json({ 
      error: authErr.error || 'auth_error', 
      message: authErr.message || 'Authentication failed.'
    });
  }

  const history = req.body?.history || req.body?.data || '';
  if (!history || history.length < 10) {
    return res.status(400).json({ error: 'Provide valid session history (at least 10 characters)' });
  }

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, history);
    return res.status(200).json({ result, text: result, contextBlock: result });
  } catch (err) {
    console.error('session-sync error:', err);
    return res.status(500).json({ error: 'AI service error. Please try again.' });
  }
};
