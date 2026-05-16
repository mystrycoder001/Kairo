import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ibsngqwkaasswscqnlhl.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_CXDhFswPYDJPIgEFisN8pQ_hiptOkMT'

// Initialize Supabase with explicit auth settings for reliability
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Global auth state cache
let currentUser = null;

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

// OTP Sign In (Request Code)
export async function requestOtp(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: null
    }
  })
  if (error) throw error
  return data
}

// Verify OTP Code
export async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  })
  if (error) throw error
  return data
}

// Email Sign In (Legacy/Alternative)
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  })
  if (error) throw error
  if (data.user) {
    await initUserProfile(data.user)
  }
  return data.user
}

// Email Sign Up
export async function signUpWithEmail(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { 
        data: { full_name: name },
        emailRedirectTo: window.location.origin + '/dashboard.html'
    }
  })
  if (error) throw error
  if (data.user) {
    await initUserProfile(data.user, name)
  }
  return data.user
}

// Initialize user profile
export async function initUserProfile(user, name = null) {
  if (!user) return;
  const displayName = name 
    || user?.user_metadata?.full_name 
    || user?.user_metadata?.name 
    || user?.email?.split('@')[0] 
    || 'User';

  const avatarUrl = user?.user_metadata?.avatar_url || '';

  // Update profile and last login
  try {
    await supabase.from('profiles')
        .upsert({ 
            id: user.id,
            full_name: displayName, 
            avatar_url: avatarUrl,
            email: user.email,
            last_login: new Date().toISOString()
        }, { onConflict: 'id' });
  } catch (err) {
      console.error("Profile sync error:", err);
  }
}

// Robust session retrieval
export async function getCurrentUser() {
  if (currentUser) return currentUser;

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
      console.error("Session fetch error:", error);
      return null;
  }
  
  if (session?.user) {
      currentUser = session.user;
      return currentUser;
  }
  
  return null;
}

// Get user subscription plan
export async function getUserPlan(userId) {
  try {
      const { data: profile } = await supabase.from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single()
      
      return profile?.subscription_plan || 'free';
  } catch (err) {
      return 'free';
  }
}

// Logout
export async function logout() {
    currentUser = null;
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Logout error:', error)
    window.location.href = '/login.html';
}

// Centralized Auth State Handler
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("Auth Event:", event);
  
  if (session?.user) {
    currentUser = session.user;
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await initUserProfile(session.user);
    }
  } else {
    currentUser = null;
  }

  const path = window.location.pathname;
  const isAuthPage = path.includes('login.html') || path.includes('signup.html') || path === '/' || path === '';
  const isDashboard = path.includes('dashboard.html');

  if (event === 'SIGNED_IN' && isAuthPage) {
    window.location.href = '/dashboard.html';
  }
  
  if (event === 'SIGNED_OUT' && isDashboard) {
    window.location.href = '/login.html';
  }
});

// Route Guard helper
export async function checkAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const path = window.location.pathname;
    if (!path.includes('login.html') && !path.includes('signup.html') && path !== '/' && path !== '') {
        window.location.href = '/login.html';
    }
  }
}

// Run immediately on every page load to process Magic Link callbacks
export async function handleAuthCallback() {
  const hash = window.location.hash
  
  if (hash && hash.includes('access_token')) {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (session) {
      const { data: profile } = await supabase.from('profiles')
      .select('full_name, onboarding_completed')
      .eq('id', session.user.id)
      .single()
      
      window.history.replaceState({}, document.title, window.location.pathname)
      
      if (!profile || !profile.onboarding_completed) {
        window.location.href = '/onboarding.html'
        return
      }
      window.location.href = '/dashboard.html'
      return
    }
  }
}

// Onboarding data saving helper
export async function saveOnboardingStep(data) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  
  const { error } = await supabase.from('profiles').update(data).eq('id', user.id)
  if (error) throw error
}

// Call callback handler immediately
handleAuthCallback();

export { supabase }

