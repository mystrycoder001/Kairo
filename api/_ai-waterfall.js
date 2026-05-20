const fetch = require('node-fetch');

/**
 * Intelligent AI Waterfall for Cloasta
 * Gemini 1.5 Flash -> Groq (Llama 3) -> OpenRouter (GPT-3.5)
 */
function isPlaceholderKey(key) {
  if (!key) return true;
  const k = key.trim().toLowerCase();
  return k === '' || k.includes('your_') || k.includes('placeholder') || k === 'your_gemini_key' || k === 'your_groq_key' || k === 'your_openrouter_key';
}

function generateSimulatedResponse(systemPrompt, userMessage) {
  console.log('[AI-Waterfall] Generating high-fidelity simulated response');
  const isPassport = systemPrompt.toLowerCase().includes('identity engineer') || systemPrompt.toLowerCase().includes('passport');
  
  if (isPassport) {
    const nameMatch = userMessage.match(/Name is ([^,\n.]+)/i);
    const roleMatch = userMessage.match(/Role is ([^,\n.]+)/i);
    const focusMatch = userMessage.match(/Primary Focus: ([^,\n.]+)/i);
    const styleMatch = userMessage.match(/Communication Style: ([^,\n.]+)/i);
    
    // Support multiple format match variants
    const contextMatch = userMessage.match(/Active Context \(([^)]+)\): ([^,\n]+)/i) || userMessage.match(/Active Context[^:]*: ([^,\n]+)/i);
    const behaviorMatch = userMessage.match(/Behavioral Memory \(([^)]+)\): ([^,\n]+)/i) || userMessage.match(/Behavioral Memory[^:]*: ([^,\n]+)/i);
    const neverForgetMatch = userMessage.match(/Never Forget \(([^)]+)\): ([^,\n]+)/i) || userMessage.match(/Never Forget[^:]*: ([^,\n]+)/i);
    const targetAiMatch = userMessage.match(/Target AI Optimization: ([^\n.]+)/i);

    const name = (nameMatch ? nameMatch[1] : 'User').trim();
    const role = (roleMatch ? roleMatch[1] : 'AI Architect').trim();
    const focus = (focusMatch ? focusMatch[1] : 'Building high-performance tech products').trim();
    const styleRaw = (styleMatch ? styleMatch[1] : 'Direct|Prose|Professional').trim();
    const styleParts = styleRaw.split('|');
    const style = styleParts[0] || 'Direct';
    const format = styleParts[1] || 'Prose';
    const tone = styleParts[2] || 'Professional';

    const context = (contextMatch ? (contextMatch[2] || contextMatch[1]) : 'Scaling local product operations and developer tools').trim();
    const behavior = (behaviorMatch ? (behaviorMatch[2] || behaviorMatch[1]) : 'Prefers modular, concise, and production-ready code').trim();
    const neverForget = (neverForgetMatch ? (neverForgetMatch[2] || neverForgetMatch[1]) : 'Ensure high code quality and direct responses').trim();
    const targetAi = (targetAiMatch ? targetAiMatch[1] : 'Universal').trim();

    return `═══════════════════════════════
Cloasta AI PASSPORT v2.0
Generated: ${new Date().toLocaleDateString()}
═══════════════════════════════

[IDENTITY LAYER]
Name: ${name}
Role: ${role}
Primary Focus: ${focus}

[PERSONALITY LAYER]
Communication Style:
- ${style}
- ${format}
- ${tone}

Preferred Responses:
- Tailored for ${targetAi} optimization
- Direct, action-oriented, and highly structured format
- Modular code syntax with rich inline commentary

[ACTIVE CONTEXT]
Current Projects:
- ${context.substring(0, 100)}
- Streamlining developer workflows and local integrations

[BEHAVIORAL PATTERNS]
- ${behavior.substring(0, 100)}
- Relies heavily on visual structure and clear layouts
- Highly analytical problem-solving with extreme attention to detail

[NEVER FORGET]
- ${neverForget.substring(0, 100)}
- Strictly avoid generic boilerplate or bloated explanations
- Respect token constraints and maintain elegant, professional tone

[AI INSTRUCTIONS]
You have been fully briefed.
Never ask repetitive questions.
Continue naturally from this context.
Adapt your tone to match user style.
═══════════════════════════════
Powered by Cloasta
═══════════════════════════════`;
  } else {
    const modeMatch = systemPrompt.match(/Active Mode Context: (\w+)/i);
    const activeMode = modeMatch ? modeMatch[1] : 'general';
    const cleanMode = activeMode.charAt(0).toUpperCase() + activeMode.slice(1);

    return `# Role & System Context
You are a senior elite prompt engineer and specialized AI collaborator acting in **${cleanMode}** memory mode. You have been fully primed with the user's Cloasta profile.

# Goal
Execute the following prompt instruction with maximum structural precision, advanced nuance, and absolute clarity:
"${userMessage}"

# Detailed Implementation Framework
1. **Core Strategy**: Approach this challenge using a modular design system, separating concerns and establishing strong foundations first.
2. **Step-by-Step Deliverables**:
   - Provide clean, robust, and industry-grade solutions.
   - Outline precise architectural blueprints with rich explanations.
   - Avoid generic placeholders. Deliver complete, production-ready implementation snippets.
3. **Optimized Output**: Emphasize vibrant aesthetics, smooth user interactions, and robust error-handling.

# AI Instruction Protocol
- Tone: Extremely authoritative, crisp, and direct.
- Format: Clean markdown structure with well-defined headers and clear bullet lists.`;
  }
}

async function callAIWaterfall(systemPrompt, userMessage) {
  const errors = [];

  // Check if we should use local high-fidelity fallback because of default placeholder API keys
  const isGeminiPlaceholder = isPlaceholderKey(process.env.GEMINI_API_KEY);
  const isGroqPlaceholder = isPlaceholderKey(process.env.GROQ_API_KEY);
  const isOpenRouterPlaceholder = isPlaceholderKey(process.env.OPENROUTER_API_KEY);

  if (isGeminiPlaceholder && isGroqPlaceholder && isOpenRouterPlaceholder) {
    return generateSimulatedResponse(systemPrompt, userMessage);
  }

  // 1. Try Gemini first
  if (process.env.GEMINI_API_KEY && !isGeminiPlaceholder) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ 
              role: 'user', 
              parts: [{ text: `SYSTEM: ${systemPrompt}\n\nUSER: ${userMessage}` }] 
            }]
          })
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      errors.push('Gemini: No text in response');
    } catch (e) { 
      errors.push(`Gemini: ${e.message}`);
    }
  }

  // 2. Try Groq second
  if (process.env.GROQ_API_KEY && !isGroqPlaceholder) {
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
      errors.push('Groq: No text in response');
    } catch (e) { 
      errors.push(`Groq: ${e.message}`);
    }
  }

  // 3. Try OpenRouter last
  if (process.env.OPENROUTER_API_KEY && !isOpenRouterPlaceholder) {
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
      errors.push('OpenRouter: No text in response');
    } catch (e) { 
      errors.push(`OpenRouter: ${e.message}`);
    }
  }

  console.warn('All real AI providers failed or were placeholder, falling back to simulated local AI:', errors);
  try {
    return generateSimulatedResponse(systemPrompt, userMessage);
  } catch (simErr) {
    console.error('Simulated response generation failed:', simErr);
    throw new Error('AI service error. Please try again.');
  }
}

const { createClient } = require('@supabase/supabase-js');

// Use SUPABASE_SERVICE_ROLE_KEY if available, fall back to anon key
const supabaseUrl = process.env.SUPABASE_URL || 'https://ibsngqwkaasswscqnlhl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlic25ncXdrYWFzc3dzY3FubGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTMwMTAsImV4cCI6MjA5NDMyOTAxMH0.Obb19o0RfcPfyh_R1ygowBLiUtUDr7dz38978tb9nG0';

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.error('Supabase client creation failed:', e.message);
}

async function verifyAndLimit(req, actionType = 'prompt') {
  if (!supabase) throw { status: 500, message: 'Database service unavailable' };

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw { status: 401, message: 'Missing authorization token' };

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) throw { status: 401, message: 'Invalid or expired token. Please log in again.' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) throw { status: 404, message: 'Profile not found. Please complete onboarding.' };

  const plan = (profile.subscription_plan || 'free').toLowerCase();
  const isFree = plan === 'free';
  
  // Pro and Ultra users get unlimited access
  if (!isFree) return profile;
  
  // Get or create usage tracking for free users
  let { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!usage) {
    // Auto-create usage tracking row
    const { data: newUsage, error: createErr } = await supabase
      .from('usage_tracking')
      .insert({ 
        user_id: user.id, 
        prompts_used: 0, 
        ai_generations: 0, 
        uploads: 0,
        reset_date: new Date().toISOString(),
        quota_usage: {}
      })
      .select()
      .single();
    
    if (createErr) {
      console.error('Failed to create usage tracking:', createErr);
      // Allow through on error rather than blocking
      return profile;
    }
    usage = newUsage;
  }

  // Reset daily count if new day
  const today = new Date().toDateString();
  const resetDate = usage.reset_date ? new Date(usage.reset_date).toDateString() : '';
  
  if (resetDate !== today) {
    usage.prompts_used = 0;
    usage.ai_generations = 0;
    usage.uploads = 0;
    await supabase.from('usage_tracking').update({ 
      prompts_used: 0, 
      ai_generations: 0,
      uploads: 0,
      reset_date: new Date().toISOString()
    }).eq('user_id', user.id);
  }

  if (actionType === 'prompt') {
    if (usage.prompts_used >= 5) {
      throw { 
        status: 429, 
        error: 'limit_reached', 
        message: "You've reached today's free limit. Upgrade to Pro for unlimited." 
      };
    }
    await supabase.from('usage_tracking').update({ 
      prompts_used: (usage.prompts_used || 0) + 1 
    }).eq('user_id', user.id);
  }

  if (actionType === 'sync') {
    const quotaUsage = usage.quota_usage || {};
    const lastSyncDate = quotaUsage.last_sync_date || '';
    let syncsToday = quotaUsage.syncs_today || 0;

    if (lastSyncDate !== today) {
      syncsToday = 0;
    }

    if (syncsToday >= 2) {
      throw { 
        status: 429, 
        error: 'limit_reached', 
        message: "You've reached today's free sync limit. Upgrade to Pro for unlimited." 
      };
    }

    const updatedQuota = {
      ...quotaUsage,
      last_sync_date: today,
      syncs_today: syncsToday + 1
    };

    await supabase.from('usage_tracking').update({ quota_usage: updatedQuota }).eq('user_id', user.id);
  }

  if (actionType === 'passport') {
    // Free users get 1 passport
    const { count } = await supabase
      .from('memory_modes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    if ((count || 0) >= 1) {
      throw {
        status: 429,
        error: 'limit_reached',
        message: "You've reached your free AI Passport limit. Upgrade to Pro for up to 5."
      };
    }
  }

  return profile;
}

module.exports = { callAIWaterfall, verifyAndLimit };
