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
export function showGlobalLoader(text = "Syncing...") {
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
    
    // Force reflow and show
    void loader.offsetWidth;
    loader.classList.add('active');
    
    // Safety timeout
    if (window._loaderTimeout) clearTimeout(window._loaderTimeout);
    window._loaderTimeout = setTimeout(() => {
        hideGlobalLoader();
    }, 10000);
}

export function hideGlobalLoader() {
    const loader = document.getElementById('global-cinematic-loader');
    if (loader) {
        loader.classList.remove('active');
    }
}

// ==========================================
// AUTH METHODS
// ==========================================

// Google Sign In
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/login.html',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  })
  if (error) throw error
  return data
}

// Email OTP — Send code
export async function signInWithOTP(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: true
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
  return session?.access_token || null
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

// Get user profile from Supabase
export async function initUserProfile(user) {
  if (!user) return;
  const displayName = user?.user_metadata?.full_name 
    || user?.user_metadata?.name 
    || user?.email?.split('@')[0] 
    || 'User';

  const avatarUrl = user?.user_metadata?.avatar_url || '';

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
    await supabase.auth.signOut()
    window.location.href = '/login.html';
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

// Check onboarding status and redirect accordingly
async function handleAuthRedirect(user) {
  if (_authRedirecting || !user) return;
  
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html') || path.includes('signup.html');
  const isIndexPage = path === '/' || path === '' || path.endsWith('/index.html');

  // Only auto-redirect from login/index pages, NOT from dashboard/onboarding
  if (!isLoginPage && !isIndexPage) return;

  try {
    const { data: profile } = await supabase.from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    const onboarded = profile?.onboarding_completed === true;

    _authRedirecting = true;
    if (onboarded) {
      window.location.replace('/dashboard.html');
    } else {
      window.location.replace('/onboarding.html');
    }
  } catch (err) {
    console.error('[Auth] Redirect error:', err);
    // On error, fallback to dashboard to prevent loops!
    _authRedirecting = true;
    window.location.replace('/dashboard.html');
  }
}

// Onboarding data saving helper
export async function saveOnboardingStep(data) {
  const user = await getCurrentUser();
  if (!user) return
  
  const { error } = await supabase.from('profiles').update(data).eq('id', user.id)
  if (error) throw error
}

// ==========================================
// AUTH STATE CHANGE HANDLER (Single source of truth)
// ==========================================
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] State change:', event);

  if (session?.user) {
    currentUser = session.user;
    currentUserTimestamp = Date.now();

    // Handle both SIGNED_IN (new login) and INITIAL_SESSION (page reload with existing session)
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (event === 'SIGNED_IN') {
        try {
          await initUserProfile(session.user);
        } catch (err) {
          console.error('[Auth] initUserProfile failed:', err);
        }
      }
      
      const currentPage = window.location.pathname
      
      // If already on dashboard, do nothing
      if (currentPage.includes('dashboard')) return
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed, full_name')
          .eq('id', session.user.id)
          .single()
        
        console.log('Auth check profile:', profile, error)
        
        // If profile exists and onboarding done
        if (profile && profile.onboarding_completed === true) {
          console.log('Returning user - going to dashboard')
          if (!currentPage.includes('dashboard')) {
            window.location.replace('/dashboard.html')
          }
          return
        }
        
        // If no profile or onboarding not done
        if (!currentPage.includes('onboarding')) {
          console.log('New user - going to onboarding')
          window.location.replace('/onboarding.html')
        }
        
      } catch(err) {
        console.error('Auth check error:', err)
        // On error, go to dashboard anyway
        if (!currentPage.includes('dashboard')) {
          window.location.replace('/dashboard.html')
        }
      }
    }
  } else {
    currentUser = null;
    currentUserTimestamp = 0;
  }
});

export { supabase }
