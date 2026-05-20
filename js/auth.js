import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ibsngqwkaasswscqnlhl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlic25ncXdrYWFzc3dzY3FubGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTMwMTAsImV4cCI6MjA5NDMyOTAxMH0.Obb19o0RfcPfyh_R1ygowBLiUtUDr7dz38978tb9nG0'

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Global auth state
let currentUser = null;
let currentUserTimestamp = 0;
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let _authRedirecting = false; // Guard against redirect loops

// Global Loader Utility (Disabled per user request)
export function showGlobalLoader(text = "Loading...") {
    // Disabled
}

export function hideGlobalLoader() {
    // Disabled
}

// ==========================================
// AUTH METHODS
// ==========================================

// Google Sign In — FIX: removed prompt:'consent' to not force re-consent for returning users
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/login.html'
    }
  })
  if (error) throw error
  return data
}

// Email OTP — Send code (Magic Link)
export async function signInWithOTP(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin + '/login.html'
    }
  })
  if (error) throw error
  return data
}

// Email OTP — Verify code
export async function verifyOTP(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email,
    token: token,
    type: 'email'
  })
  if (error) throw error
  return data
}

// ==========================================
// SESSION & USER
// ==========================================

// Get current access token for API calls
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null;
}

// Robust session retrieval with cache TTL
export async function getCurrentUser() {
  const now = Date.now();
  if (currentUser && (now - currentUserTimestamp) < USER_CACHE_TTL) {
    return currentUser;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.user) {
      currentUser = null;
      currentUserTimestamp = 0;
      return null;
    }
    currentUser = session.user;
    currentUserTimestamp = now;
    return currentUser;
  } catch (err) {
    console.error('[Auth] getCurrentUser error:', err);
    return null;
  }
}

// Ensure user profile exists in Supabase, with complete localStorage backup
export async function initUserProfile(user) {
  if (!user) return;
  const displayName = user?.user_metadata?.full_name 
    || user?.user_metadata?.name 
    || user?.email?.split('@')[0] 
    || 'User';

  const avatarUrl = user?.user_metadata?.avatar_url || '';

  try {
    // First check if profile exists, falling back to local storage on error
    let existing = null;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, onboarding_completed, subscription_plan')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.warn('[Auth] Database profile fetch failed or no profile found:', error.message);
      const localProfileStr = localStorage.getItem(`profile_${user.id}`);
      if (localProfileStr) {
        existing = JSON.parse(localProfileStr);
      }
    } else {
      existing = data;
    }
    
    if (existing) {
      // RETURNING USER — update login metadata, NEVER touch critical fields
      const updatedFields = { 
        avatar_url: avatarUrl,
        last_login: new Date().toISOString()
      };
      
      try {
        await supabase.from('profiles')
          .update(updatedFields)
          .eq('id', user.id);
      } catch(e) {
        console.warn('[Auth] Profiles database sync failed, using offline state.');
      }
      
      const merged = { ...existing, ...updatedFields };
      localStorage.setItem(`profile_${user.id}`, JSON.stringify(merged));
    } else {
      // NEW USER — insert with safe defaults
      const newProfile = { 
        id: user.id,
        full_name: displayName, 
        avatar_url: avatarUrl,
        email: user.email,
        last_login: new Date().toISOString(),
        onboarding_completed: false,
        subscription_plan: 'free'
      };
      
      try {
        await supabase.from('profiles').insert(newProfile);
      } catch(e) {
        console.warn('[Auth] Profiles database insert failed, caching locally.');
      }
      localStorage.setItem(`profile_${user.id}`, JSON.stringify(newProfile));
    }
    
    // Ensure usage_tracking row exists, with offline fallback
    let usageExists = null;
    const { data: usageData, error: usageError } = await supabase
      .from('usage_tracking')
      .select('user_id')
      .eq('user_id', user.id)
      .single();
    
    if (usageError) {
      const localUsageStr = localStorage.getItem(`usage_${user.id}`);
      if (localUsageStr) {
        usageExists = JSON.parse(localUsageStr);
      }
    } else {
      usageExists = usageData;
    }
    
    if (!usageExists) {
      const newUsage = {
        user_id: user.id,
        prompts_used: 0,
        ai_generations: 0,
        uploads: 0,
        reset_date: new Date().toISOString(),
        quota_usage: {}
      };
      try {
        await supabase.from('usage_tracking').insert(newUsage);
      } catch(e) {
        console.warn('[Auth] Usage insert failed, caching locally.');
      }
      localStorage.setItem(`usage_${user.id}`, JSON.stringify(newUsage));
    }
  } catch (err) {
      console.error("[Auth] Profile sync error:", err);
  }
}

// ==========================================
// ROUTING LOGIC
// ==========================================

// Logout
export async function logout() {
    currentUser = null;
    currentUserTimestamp = 0;
    _authRedirecting = false;
    
    // Clear storage to prevent stale UI
    try {
        window.localStorage.clear();
        window.sessionStorage.clear();
    } catch(e) {}
    
    // Fire and forget signOut so it doesn't block the UI redirect
    supabase.auth.signOut().catch(err => console.error('[Auth] SignOut error:', err));
    
    window.location.replace('/login.html');
}

// Route Guard — redirect to login if not authenticated
export async function checkAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const path = window.location.pathname;
    if (!path.includes('login.html') && !path.includes('signup.html') && path !== '/' && !path.endsWith('/index.html')) {
        window.location.href = '/login.html';
    }
  }
  return user;
}

// Onboarding data saving helper
export async function saveOnboardingStep(data) {
  const user = await getCurrentUser();
  if (!user) return
  
  try {
    await supabase.from('profiles').update(data).eq('id', user.id);
  } catch(e) {}

  // Also sync locally
  const localProfileStr = localStorage.getItem(`profile_${user.id}`);
  if (localProfileStr) {
    const p = JSON.parse(localProfileStr);
    localStorage.setItem(`profile_${user.id}`, JSON.stringify({ ...p, ...data }));
  }
}

// ==========================================
// AUTH STATE CHANGE HANDLER (Single source of truth)
// Only handles redirects from login/signup/index pages.
// Dashboard page handles its own loading via app.js.
// ==========================================
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] State change:', event);

  let activeUser = session?.user;

  if (activeUser) {
    currentUser = activeUser;
    currentUserTimestamp = Date.now();

    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      // Sync profile on sign-in
      if (event === 'SIGNED_IN') {
        try {
          await initUserProfile(activeUser);
        } catch (err) {
          console.error('[Auth] initUserProfile failed:', err);
        }
      }
      
      const currentPage = window.location.pathname;
      
      // ONLY redirect from login/signup/index pages
      // Dashboard and onboarding manage their own state
      const isLoginPage = currentPage.includes('login.html') || currentPage.includes('signup.html');
      const isIndexPage = currentPage === '/' || currentPage === '' || currentPage.endsWith('/index.html');
      
      if (!isLoginPage && !isIndexPage) return;
      if (_authRedirecting) return;
      
      try {
        let onboardingCompleted = false;
        
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', activeUser.id)
          .single();
          
        if (profile) {
          onboardingCompleted = profile.onboarding_completed;
        } else {
          const localProfileStr = localStorage.getItem(`profile_${activeUser.id}`);
          if (localProfileStr) {
            onboardingCompleted = JSON.parse(localProfileStr).onboarding_completed;
          }
        }
        
        _authRedirecting = true;
        
        if (onboardingCompleted === true) {
          console.log('[Auth] Returning user → dashboard');
          window.location.replace('/dashboard.html');
        } else {
          console.log('[Auth] New user → onboarding');
          window.location.replace('/onboarding.html');
        }
      } catch(err) {
        console.error('[Auth] Redirect error:', err);
        _authRedirecting = true;
        window.location.replace('/dashboard.html');
      }
    }
  } else {
    currentUser = null;
    currentUserTimestamp = 0;
  }
});

export { supabase }
