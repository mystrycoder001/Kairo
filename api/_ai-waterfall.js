const fetch = require('node-fetch');

/**
 * Intelligent AI Waterfall for Cloasta
 * Gemini 1.5 Flash -> Groq (Llama 3) -> OpenRouter (GPT-3.5)
 */
async function callAIWaterfall(systemPrompt, userMessage) {
  const errors = [];

  // 1. Try Gemini first
  if (process.env.GEMINI_API_KEY) {
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
  if (process.env.GROQ_API_KEY) {
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
  if (process.env.OPENROUTER_API_KEY) {
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

  console.error('All AI providers failed:', errors);
  throw new Error('AI service error. Please try again.');
}

const { createClient } = require('@supabase/supabase-js');

// Use SUPABASE_SERVICE_ROLE_KEY if available, fall back to anon key
const supabaseUrl = process.env.SUPABASE_URL || 'https://ibsngqwkaasswscqnlhl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

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
