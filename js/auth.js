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
      redirectTo: window.location.origin + '/dashboard.html',
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
  const isOnboardingPage = path.includes('onboarding.html');
  const isDashboardPage = path.includes('dashboard.html');

  try {
    const { data: profile } = await supabase.from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    const onboarded = profile?.onboarding_completed === true;

    // Login/Index → route based on onboarding status
    if (isLoginPage || isIndexPage) {
      _authRedirecting = true;
      window.location.href = onboarded ? '/dashboard.html' : '/onboarding.html';
      return;
    }

    // Dashboard → if NOT onboarded, force onboarding
    if (isDashboardPage && !onboarded) {
      _authRedirecting = true;
      window.location.href = '/onboarding.html';
      return;
    }

    // Onboarding → if already onboarded, go to dashboard
    if (isOnboardingPage && onboarded) {
      _authRedirecting = true;
      window.location.href = '/dashboard.html';
      return;
    }
  } catch (err) {
    console.error('[Auth] Redirect error:', err);
    // Fallback: send to onboarding (safer than dashboard)
    if (isLoginPage || isIndexPage) {
      window.location.href = '/onboarding.html';
    }
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
  if (session?.user) {
    currentUser = session.user;
    currentUserTimestamp = Date.now();

    if (event === 'SIGNED_IN') {
      await initUserProfile(session.user);
      await handleAuthRedirect(session.user);
    }
  } else {
    currentUser = null;
    currentUserTimestamp = 0;
  }
});

// Clean URL hash from OAuth callback (runs once on load)
window.addEventListener('load', () => {
  if (window.location.hash.includes('access_token')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

export { supabase }
