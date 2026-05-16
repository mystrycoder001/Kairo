import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ibsngqwkaasswscqnlhl.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_CXDhFswPYDJPIgEFisN8pQ_hiptOkMT'

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Global auth state cache
let currentUser = null;

// Google Sign In (ONLY AUTH METHOD)
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

// Get user profile
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
      console.error("Profile sync error:", err);
  }
}

// Robust session retrieval
export async function getCurrentUser() {
  if (currentUser) return currentUser;

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) return null;
  
  if (session?.user) {
      currentUser = session.user;
      return currentUser;
  }
  return null;
}

// Logout
export async function logout() {
    currentUser = null;
    await supabase.auth.signOut()
    window.location.href = '/login.html';
}

// Route Guard
export async function checkAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const path = window.location.pathname;
    if (!path.includes('login.html') && !path.includes('signup.html') && path !== '/' && path !== '') {
        window.location.href = '/login.html';
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

// Handle Auth State Changes & Redirects
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    if (event === 'SIGNED_IN') {
        await initUserProfile(session.user);
        
        // Check onboarding status
        const { data: profile } = await supabase.from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();
            
        const path = window.location.pathname;
        if (path.includes('login.html') || path === '/' || path === '') {
            if (!profile || !profile.onboarding_completed) {
                window.location.href = '/onboarding.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        }
    }
  } else {
    currentUser = null;
  }
});

// Process Google OAuth Callback & Routing
window.addEventListener('load', async () => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    const { data: profile } = await supabase.from('profiles')
    .select('onboarding_completed')
    .eq('id', session.user.id)
    .single()
    
    // Clean URL hash
    if (window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title, window.location.pathname)
    }

    // Only redirect if on login/index page
    const path = window.location.pathname;
    if (path.includes('login.html') || path === '/' || path === '') {
        if (!profile || !profile.onboarding_completed) {
            window.location.href = '/onboarding.html'
        } else {
            window.location.href = '/dashboard.html'
        }
    }
  }
})

export { supabase }
