const { callAIWaterfall, verifyAndLimit } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are an elite AI identity engineer.
Create a structured AI Passport that makes any AI instantly understand this user deeply.

Output EXACTLY this format:

═══════════════════════════════
MINDWAVE AI PASSPORT v2.0
Generated: [date]
═══════════════════════════════

[IDENTITY LAYER]
Name: {name}
Role: {role}
Primary Focus: {focus}

[PERSONALITY LAYER]
Communication Style:
- {style 1}
- {style 2}
- {style 3}

Preferred Responses:
- {pref 1}
- {pref 2}

[ACTIVE CONTEXT]
Current Projects:
- {project 1}
- {project 2}

Current Goals:
- {goal 1}
- {goal 2}
- {goal 3}

[BEHAVIORAL PATTERNS]
- {pattern 1}
- {pattern 2}
- {pattern 3}

[NEVER FORGET]
- {most important fact}
- {second important fact}
- {third important fact}

[AI INSTRUCTIONS]
You have been fully briefed.
Never ask repetitive questions.
Continue naturally from this context.
Adapt your tone to match user style.
═══════════════════════════════
Powered by Mindwave
═══════════════════════════════`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await verifyAndLimit(req, 'prompt'); // passport uses prompt limit or its own? Let's just pass auth
  } catch (authErr) {
    return res.status(authErr.status || 401).json({ error: authErr.error || 'auth_error', message: authErr.message });
  }

  const { name, role, goals, communication_style, active_context, behavioral_memory, never_forget, target_ai } = req.body || {};

  const userMessage = `
1. Identity: Name is ${name || 'User'}, Role is ${role || 'Not specified'}. Primary Focus: ${goals || 'Not specified'}.
2. Communication Style: ${communication_style || 'Not specified'}.
3. Active Context (Current Projects & Goals): ${active_context || 'Not specified'}.
4. Behavioral Memory (How I work): ${behavioral_memory || 'Not specified'}.
5. Never Forget (Critical Permanent Context): ${never_forget || 'Not specified'}.
6. Target AI Optimization: ${target_ai || 'All'}.

Synthesize this into the final AI Passport instruction block using exactly the format requested.`;

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, userMessage);
    return res.status(200).json({ result, text: result });
  } catch (err) {
    console.error('generate-passport error:', err);
    return res.status(500).json({ error: err.message });
  }
};
