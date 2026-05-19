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

// Global Loader Utility
export function showGlobalLoader(text = "Loading...") {
    let loader = document.getElementById('global-cinematic-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-cinematic-loader';
        loader.className = 'global-loader-overlay';
        loader.innerHTML = `
            <div class="cinematic-ring"></div>
            <div class="loader-text" id="global-loader-text"></div>
        `;
        document.body.appendChild(loader);
    }
    const textEl = document.getElementById('global-loader-text');
    if (textEl) textEl.textContent = text;
    
    loader.classList.add('active');
    
    // HARD CAP: Max 100ms loader to prevent UI blocking (per user req)
    if (window._loaderTimeout) clearTimeout(window._loaderTimeout);
    window._loaderTimeout = setTimeout(() => {
        hideGlobalLoader();
    }, 100);
}

export function hideGlobalLoader() {
    const loader = document.getElementById('global-cinematic-loader');
    if (loader) {
        loader.classList.remove('active');
    }
    if (window._loaderTimeout) {
        clearTimeout(window._loaderTimeout);
        window._loaderTimeout = null;
    }
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
// MOCK BYPASS: On localhost, bypass SMTP check for any email containing "test"
export async function signInWithOTP(email) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && email.includes('test')) {
    console.log('[Auth] Local development bypass triggered for:', email);
    localStorage.setItem('cloasta_pending_mock_email', email);
    return { mock: true };
  }

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
// MOCK BYPASS: On localhost, verify instantly with any 6-digit code for "test" emails
export async function verifyOTP(email, token) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && email.includes('test')) {
    console.log('[Auth] Local verification bypass triggered for:', email);
    const mockUser = {
      id: 'mock-user-123456789',
      email: email,
      user_metadata: {
        full_name: email.split('@')[0],
        name: email.split('@')[0]
      }
    };
    const mockSession = {
      access_token: 'mock-token-123456789',
      user: mockUser
    };
    localStorage.setItem('cloasta_mock_session', JSON.stringify(mockSession));
    currentUser = mockUser;
    currentUserTimestamp = Date.now();
    
    // Auto-create local user profile
    await initUserProfile(mockUser);
    
    // Trigger State Change logic immediately
    setTimeout(() => {
      const mockProfile = JSON.parse(localStorage.getItem(`profile_${mockUser.id}`) || '{}');
      if (mockProfile.onboarding_completed) {
        window.location.replace('/dashboard.html');
      } else {
        window.location.replace('/onboarding.html');
      }
    }, 500);

    return { user: mockUser, session: mockSession };
  }

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
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && localStorage.getItem('cloasta_mock_session')) {
    const mockSession = JSON.parse(localStorage.getItem('cloasta_mock_session'));
    return mockSession.access_token;
  }
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null;
}

// Robust session retrieval with cache TTL and local mock bypass
export async function getCurrentUser() {
  const now = Date.now();
  if (currentUser && (now - currentUserTimestamp) < USER_CACHE_TTL) {
    return currentUser;
  }

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && localStorage.getItem('cloasta_mock_session')) {
    try {
      const mockSession = JSON.parse(localStorage.getItem('cloasta_mock_session'));
      currentUser = mockSession.user;
      currentUserTimestamp = now;
      return currentUser;
    } catch(e) {}
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
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, onboarding_completed, subscription_plan')
        .eq('id', user.id)
        .single();
      existing = data;
    } catch (e) {
      console.warn('[Auth] Database profile fetch failed, checking local backup...');
      const localProfileStr = localStorage.getItem(`profile_${user.id}`);
      if (localProfileStr) {
        existing = JSON.parse(localProfileStr);
      }
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
    try {
      const { data } = await supabase
        .from('usage_tracking')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
      usageExists = data;
    } catch (e) {
      const localUsageStr = localStorage.getItem(`usage_${user.id}`);
      if (localUsageStr) {
        usageExists = JSON.parse(localUsageStr);
      }
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
    
    try {
        await supabase.auth.signOut();
    } catch(e) {}
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
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!activeUser && isLocal && localStorage.getItem('cloasta_mock_session')) {
    activeUser = JSON.parse(localStorage.getItem('cloasta_mock_session')).user;
  }

  if (activeUser) {
    currentUser = activeUser;
    currentUserTimestamp = Date.now();

    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || (!session && isLocal)) {
      // Sync profile on sign-in
      if (event === 'SIGNED_IN' || (!session && isLocal)) {
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
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', activeUser.id)
            .single();
          if (profile) onboardingCompleted = profile.onboarding_completed;
        } catch (err) {
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
