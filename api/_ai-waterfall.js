const fetch = require('node-fetch');

/**
 * Intelligent AI Waterfall for Cloasta
 * Gemini 1.5 Flash -> Groq (Llama 3) -> OpenRouter (GPT-3.5)
 */
async function callAIWaterfall(systemPrompt, userMessage) {
  // 1. Try Gemini first
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
  } catch (e) { 
    console.error('Gemini failed:', e.message); 
  }

  // 2. Try Groq second
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
  } catch (e) { 
    console.error('Groq failed:', e.message); 
  }

  // 3. Try OpenRouter last
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
  } catch (e) { 
    console.error('OpenRouter failed:', e.message); 
  }

  throw new Error('All AI providers in waterfall failed. Please check your API keys.');
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ibsngqwkaasswscqnlhl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here' // Need service role to bypass RLS in edge functions if needed, or anon key if passing auth
);

async function verifyAndLimit(req, actionType = 'prompt') {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw { status: 401, message: 'Missing authorization token' };

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) throw { status: 401, message: 'Invalid token' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) throw { status: 404, message: 'Profile not found' };

  const isFree = profile.subscription_plan === 'free';
  
  // Get usage tracking
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!usage && isFree) throw { status: 404, message: 'Usage record not found' };

  if (isFree) {
      // Reset daily count if new day
      const today = new Date().toDateString();
      const resetDate = new Date(usage.reset_date).toDateString();
      
      if (resetDate !== today) {
        usage.prompts_used = 0;
        usage.ai_generations = 0;
        usage.uploads = 0;
        await supabase.from('usage_tracking').update({ 
            prompts_used: 0, 
            ai_generations: 0,
            uploads: 0,
            reset_date: new Date() 
        }).eq('user_id', user.id);
      }

      if (actionType === 'prompt') {
        if (usage.prompts_used >= 5) {
          throw { status: 429, error: 'limit_reached', message: 'Free daily limit reached. Upgrade to Pro for unlimited.' };
        }
        await supabase.from('usage_tracking').update({ prompts_used: usage.prompts_used + 1 }).eq('user_id', user.id);
      }

      if (actionType === 'sync') {
        // Assume weekly limit logic requires quota_usage JSON to be implemented. For now, fallback to basic limit.
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const lastSync = usage.quota_usage?.last_sync ? new Date(usage.quota_usage.last_sync) : new Date(0);
        let syncsThisWeek = usage.quota_usage?.syncs_this_week || 0;

        if (lastSync < weekAgo) {
            syncsThisWeek = 0;
        }

        if (syncsThisWeek >= 2) {
          throw { status: 429, error: 'limit_reached', message: 'Free weekly sync limit reached. Upgrade to Pro for unlimited.' };
        }

        const updatedQuota = {
            ...usage.quota_usage,
            last_sync: new Date().toISOString(),
            syncs_this_week: syncsThisWeek + 1
        };

        await supabase.from('usage_tracking').update({ quota_usage: updatedQuota }).eq('user_id', user.id);
      }
  }

  return profile;
}

module.exports = { callAIWaterfall, verifyAndLimit };
