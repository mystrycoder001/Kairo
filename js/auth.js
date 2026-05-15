import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ibsngqwkaasswscqnlhl.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_CXDhFswPYDJPIgEFisN8pQ_hiptOkMT'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Google Sign In
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/dashboard.html',
      queryParams: {
        prompt: 'select_account'
      }
    }
  })
  if (error) throw error
  return data
}

// Email Sign In  
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  })
  if (error) throw error
  if (data.user) {
    await initUserProfile(data.user)
    window.location.href = '/dashboard.html'
  }
  return data.user
}

// Email Sign Up
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email, password
  })
  if (error) throw error
  if (data.user) {
    await initUserProfile(data.user)
    window.location.href = '/onboarding.html'
  }
  return data.user
}

// Initialize user profile
export async function initUserProfile(user) {
  const { data: existing } = await supabase.from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()
  
  if (!existing) {
    await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      trial_start_date: new Date(),
      trial_end_date: new Date(
        Date.now() + 14*24*60*60*1000
      ),
      plan_tier: 'trial'
    })
  }
}

// Check auth state on every page
export async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    window.location.href = '/index.html'
    return null
  }
  
  return session.user
}

// Get current session user without redirecting
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? session.user : null
}

// Check trial status
export async function checkTrial(userId) {
  const { data: profile } = await supabase.from('profiles')
  .select('plan_tier, trial_end_date')
  .eq('id', userId)
  .single()
  
  if (!profile) return 'trial'

  const now = new Date()
  const trialEnd = new Date(profile.trial_end_date)
  
  if (now > trialEnd && profile.plan_tier === 'trial') {
    await supabase
    .from('profiles')
    .update({ plan_tier: 'expired' })
    .eq('id', userId)
    return 'expired'
  }
  
  return profile.plan_tier
}

// Logout
export async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Logout error:', error)
    window.location.href = '/index.html'
}

// Export supabase client for other modules
export { supabase }
