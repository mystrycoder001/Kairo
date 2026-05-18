# Cloasta — FIX ALL ERRORS MASTER PROMPT

You have full permission to read and modify every file in this project.

---

## STEP 1 — READ EVERYTHING FIRST

Before changing anything, read these files completely:
- index.html
- js/app.js
- js/auth.js
- js/voice.js
- js/gemini.js
- js/passport.js
- js/session-sync.js
- js/trial.js
- api/generate-prompt.js
- api/generate-passport.js
- api/session-sync.js
- api/_ai-waterfall.js
- vercel.json
- package.json

Open the browser console (F12) and note every single red error. Fix all of them.

---

## STEP 2 — FIX ALL NULL REFERENCE ERRORS

Search every JS file for ANY line that does:
```
document.getElementById('...').addEventListener
document.getElementById('...').textContent
document.getElementById('...').style
document.querySelector('...').addEventListener
document.querySelector('...').classList
```

Wrap EVERY single one in a null check like this:

```javascript
// WRONG — crashes if element missing
document.getElementById('btn').addEventListener('click', handler);

// CORRECT — safe always
const btn = document.getElementById('btn');
if (btn) btn.addEventListener('click', handler);
```

Do this for every file. No exceptions.

---

## STEP 3 — FIX API ERRORS (405 / 500 / CORS)

### api/_ai-waterfall.js — rewrite completely:

```javascript
const fetch = require('node-fetch');

async function callAIWaterfall(systemPrompt, userMessage) {
  // Try Gemini first
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userMessage }] }]
        })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
  } catch (e) { console.log('Gemini failed:', e.message); }

  // Try Groq second
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) return text;
  } catch (e) { console.log('Groq failed:', e.message); }

  // Try OpenRouter last
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) return text;
  } catch (e) { console.log('OpenRouter failed:', e.message); }

  throw new Error('All AI providers failed');
}

module.exports = { callAIWaterfall };
```

### api/generate-prompt.js — rewrite completely:

```javascript
const { callAIWaterfall } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are an expert AI prompt engineer. Transform the user's rough idea or voice transcript into a clear, detailed, structured AI prompt that gets excellent results from any AI tool. Output ONLY the final prompt text. No explanation. No preamble. No markdown fences. Just the prompt, ready to copy-paste.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = req.body?.text || req.body?.transcript || req.body?.input || '';
  if (!text || text.trim().length < 3) {
    return res.status(400).json({ error: 'Provide at least 3 characters of input' });
  }

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, text.trim());
    return res.status(200).json({ result, prompt: result });
  } catch (err) {
    console.error('generate-prompt error:', err);
    return res.status(500).json({ error: 'All AI providers failed. Check your API keys in Vercel environment variables.' });
  }
};
```

### api/generate-passport.js — rewrite completely:

```javascript
const { callAIWaterfall } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are creating an AI Passport — a reusable identity block a user prepends to every AI chat. Based on the user's answers, create a concise, powerful paragraph (max 120 words) that describes who they are, what they do, their communication style, and how AI should respond to them. Output ONLY the passport text, ready to copy-paste.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, role, aiTool, useCase, extra } = req.body || {};
  if (!name && !role) {
    return res.status(400).json({ error: 'Provide at least name or role' });
  }

  const userMessage = `Name: ${name || 'Not provided'}
Role: ${role || 'Not provided'}
Primary AI tool: ${aiTool || 'Not provided'}
Main use case: ${useCase || 'Not provided'}
Additional context: ${extra || 'None'}`;

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, userMessage);
    return res.status(200).json({ result, passport: result });
  } catch (err) {
    console.error('generate-passport error:', err);
    return res.status(500).json({ error: 'Failed to generate passport. Check API keys.' });
  }
};
```

### api/session-sync.js — rewrite completely:

```javascript
const { callAIWaterfall } = require('./_ai-waterfall');

const SYSTEM_PROMPT = `You are creating a Session Sync block — a compact summary a user pastes at the start of a new AI chat to resume context. Based on the user's session history and passport, write a crisp context block (max 150 words) that tells any AI exactly where they left off and what to know. Output ONLY the context block text, ready to paste.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { passport, sessionHistory, currentGoal } = req.body || {};
  if (!currentGoal && !sessionHistory) {
    return res.status(400).json({ error: 'Provide session history or current goal' });
  }

  const userMessage = `AI Passport: ${passport || 'Not set'}
Session history: ${sessionHistory || 'None'}
Current goal: ${currentGoal || 'Continue previous work'}`;

  try {
    const result = await callAIWaterfall(SYSTEM_PROMPT, userMessage);
    return res.status(200).json({ result, contextBlock: result });
  } catch (err) {
    console.error('session-sync error:', err);
    return res.status(500).json({ error: 'Failed to generate context block. Check API keys.' });
  }
};
```

---

## STEP 4 — FIX vercel.json

Replace vercel.json with exactly this:

```json
{
  "version": 2,
  "functions": {
    "api/*.js": {
      "runtime": "nodejs18.x"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## STEP 5 — FIX package.json

Make sure package.json has node-fetch as a dependency:

```json
{
  "name": "Cloasta",
  "version": "1.0.0",
  "dependencies": {
    "node-fetch": "^2.6.9"
  }
}
```

Run: `npm install`

---

## STEP 6 — FIX VOICE → GENERATE FLOW

In js/voice.js, make sure when recording stops:

1. The raw transcript goes into a textarea with id="transcript-edit"
2. A "Done — Generate Prompt ✦" button appears (id="done-generate-btn")
3. Clicking that button:
   - Gets the edited text from the textarea
   - Calls generatePrompt(editedText) from js/gemini.js
   - Shows a loading spinner
   - On success: puts the result in the output screen and navigates there
   - On error: shows a toast with the error message

```javascript
// At the end of stopRecording():
function showTranscriptEditor(transcript) {
  const container = document.getElementById('transcript-edit-container');
  const textarea = document.getElementById('transcript-edit');
  const doneBtn = document.getElementById('done-generate-btn');

  if (!container || !textarea || !doneBtn) {
    // Create them if they don't exist
    const voiceScreen = document.getElementById('screen-voice');
    if (!voiceScreen) return;

    const div = document.createElement('div');
    div.id = 'transcript-edit-container';
    div.innerHTML = `
      <p style="font-size:13px;color:#888;margin-bottom:8px;">
        Review and edit before generating:
      </p>
      <textarea id="transcript-edit" rows="5" style="
        width:100%;background:#111;color:#fff;
        border:1px solid #333;border-radius:12px;
        padding:12px;font-size:14px;resize:vertical;
        box-sizing:border-box;
      "></textarea>
      <button id="done-generate-btn" style="
        margin-top:12px;width:100%;
        background:#ffffff;color:#000000;
        border:none;border-radius:12px;
        padding:14px;font-size:15px;
        font-weight:600;cursor:pointer;
      ">Done — Generate Prompt ✦</button>
    `;
    voiceScreen.appendChild(div);
  }

  const ta = document.getElementById('transcript-edit');
  const btn = document.getElementById('done-generate-btn');
  const cont = document.getElementById('transcript-edit-container');

  if (ta) ta.value = transcript;
  if (cont) cont.style.display = 'block';

  if (btn) {
    btn.onclick = async () => {
      const text = ta?.value?.trim();
      if (!text) {
        showToast('Please record or type something first');
        return;
      }
      btn.textContent = 'Generating...';
      btn.disabled = true;
      try {
        const result = await generatePrompt(text);
        const outputEl = document.getElementById('prompt-output') || document.getElementById('output-text');
        if (outputEl) {
          outputEl.textContent = result;
          outputEl.style.display = 'block';
        }
        navigateTo('screen-output');
      } catch (err) {
        showToast('Generation failed: ' + err.message);
      } finally {
        btn.textContent = 'Done — Generate Prompt ✦';
        btn.disabled = false;
      }
    };
  }
}
```

---

## STEP 7 — FIX js/gemini.js (the generatePrompt function)

Replace the generatePrompt function with this:

```javascript
async function generatePrompt(text) {
  // Try backend first (works on Vercel)
  try {
    const response = await fetch('/api/generate-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, transcript: text })
    });

    if (response.ok) {
      const data = await response.json();
      const result = data.result || data.prompt || data.text || '';
      if (result) return result;
    }
  } catch (e) {
    console.log('Backend unavailable, trying direct API...');
  }

  // Fallback: call Gemini directly from frontend (works on localhost)
  const apiKey = window.ENV_GEMINI_KEY || '';
  if (!apiKey) {
    throw new Error('No API key available. On Vercel, set GEMINI_API_KEY. For local testing, set window.ENV_GEMINI_KEY.');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert AI prompt engineer. Transform this rough idea into a perfect, copy-paste ready AI prompt. Output ONLY the final prompt, no explanation:\n\n${text}`
          }]
        }]
      })
    }
  );

  const data = await res.json();
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result) throw new Error('Gemini returned empty response');
  return result;
}
```

For local testing, add this to the top of index.html (replace with your actual key):
```html
<script>window.ENV_GEMINI_KEY = '';</script>
```
Leave it blank for production — the backend handles it on Vercel.

---

## STEP 8 — FIX NAVIGATION (sidebar links)

In js/app.js, replace the navigation init with this bulletproof version:

```javascript
function initNavigation() {
  // Map of text content / data attributes to screen IDs
  const navMap = {
    'dashboard': 'screen-landing',
    'home': 'screen-landing',
    'voice': 'screen-voice',
    'voice record': 'screen-voice',
    'record': 'screen-voice',
    'passport': 'screen-passport',
    'ai passport': 'screen-passport',
    'session': 'screen-sync',
    'session sync': 'screen-sync',
    'sync': 'screen-sync',
    'output': 'screen-output',
    'history': 'screen-sync',
  };

  // Attach to all nav links
  document.querySelectorAll('nav a, .sidebar a, [data-screen], .nav-link').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const text = el.textContent.trim().toLowerCase();
      const dataScreen = el.dataset?.screen?.toLowerCase();
      const target = navMap[dataScreen] || navMap[text] || dataScreen || null;
      if (target) navigateTo(target);
    });
  });

  // CTA buttons
  const ctaMap = {
    'start free trial': 'screen-voice',
    'get started': 'screen-voice',
    'try now': 'screen-voice',
    'view demo': 'screen-voice',
    'start recording': 'screen-voice',
    'open voice': 'screen-voice',
  };

  document.querySelectorAll('button, a').forEach(el => {
    const text = el.textContent.trim().toLowerCase();
    if (ctaMap[text]) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(ctaMap[text]);
      });
    }
  });
}

function navigateTo(screenId) {
  const allScreens = document.querySelectorAll('[id^="screen-"]');
  allScreens.forEach(s => {
    s.style.display = 'none';
    s.style.opacity = '0';
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.style.display = 'block';
    target.style.opacity = '1';

    // Update active state in sidebar
    document.querySelectorAll('nav a, .sidebar a, [data-screen]').forEach(el => {
      el.classList.remove('active');
    });
    const activeLink = document.querySelector(`[data-screen="${screenId}"], nav a[href="#${screenId}"]`);
    if (activeLink) activeLink.classList.add('active');
  } else {
    console.warn(`navigateTo: screen "${screenId}" not found in DOM`);
  }
}
```

---

## STEP 9 — FIX TOAST FUNCTION

Make sure showToast exists and works everywhere:

```javascript
function showToast(message, type = 'info') {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const colors = { info: '#333', error: '#ff4444', success: '#00c853', warning: '#ff8800' };

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: ${colors[type] || colors.info}; color: white;
    padding: 12px 24px; border-radius: 100px;
    font-size: 14px; font-weight: 500;
    z-index: 9999; white-space: nowrap;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: fadeIn 0.2s ease;
  `;
  document.head.insertAdjacentHTML('beforeend', `
    <style>@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>
  `);
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 3500);
}

// Make globally available
window.showToast = showToast;
```

---

## STEP 10 — AFTER ALL FIXES, VERIFY

Open browser console (F12) and confirm:

1. Zero red errors on page load
2. Click every sidebar link → correct screen loads
3. Click mic → recording starts
4. Stop recording → textarea appears with transcript
5. Click "Done — Generate Prompt" → spinner shows → result appears on output screen
6. Trial days display correctly in sidebar

Then push:

```bash
npm install
git add .
git commit -m "fix: resolve all errors — null refs, API 405, navigation, voice flow"
git push origin main
```

Vercel will auto-deploy. Test on the live URL — that's where the API actually runs.

---

## IF YOU STILL GET 405 ON VERCEL

It means the API route isn't being hit. Check:
1. The file is at `api/generate-prompt.js` (not `src/api/` or nested)
2. `vercel.json` has the rewrites above
3. The function exports `module.exports = async function handler(req, res)`
4. Environment variables are set in Vercel → Settings → Environment Variables

Run `vercel logs` in the terminal to see what's actually happening on the server.
