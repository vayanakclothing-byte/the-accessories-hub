// js/auth.js — Unified Authentication Handler
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  // Show error from URL params (e.g. unauthorized admin access)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('error')) {
    const msg = document.getElementById('authMessage');
    if (msg) {
      msg.textContent = urlParams.get('error');
      msg.style.display = 'block';
      msg.style.color = 'var(--red, #E74C3C)';
    }
  }

  // ── Email/Password Login ──
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const isSignUp = document.getElementById('toggleSignUp').textContent.includes('Sign In');
      
      const msg = document.getElementById('authMessage');
      msg.style.display = 'none';

      try {
        let authResult;
        if (isSignUp) {
          authResult = await supabase.auth.signUp({ email, password });
        } else {
          authResult = await supabase.auth.signInWithPassword({ email, password });
        }

        if (authResult.error) throw authResult.error;
        
        const session = authResult.data.session;
        handleSuccessfulAuth(session);

      } catch (err) {
        msg.textContent = err.message;
        msg.style.display = 'block';
        msg.style.color = 'var(--red, #E74C3C)';
      }
    });
  }

  // ── Toggle Login / Signup UI ──
  const toggleBtn = document.getElementById('toggleSignUp');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const title = document.querySelector('.auth-title');
      const submitBtn = document.querySelector('button[type="submit"]');
      const isLogin = title.textContent === 'Welcome Back';

      if (isLogin) {
        title.textContent = 'Create Account';
        submitBtn.textContent = 'Sign Up';
        toggleBtn.previousSibling.textContent = 'Already have an account? ';
        toggleBtn.textContent = 'Sign In';
      } else {
        title.textContent = 'Welcome Back';
        submitBtn.textContent = 'Sign In';
        toggleBtn.previousSibling.textContent = 'New to the Hub? ';
        toggleBtn.textContent = 'Create an Account';
      }
    });
  }

  // ── Handle OAuth redirect (SIGNED_IN after Google callback) ──
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      // Only auto-redirect if we are on the login page
      const path = window.location.pathname;
      const isOnLogin = path.includes('login') || path === '/login' || path === '/login.html';
      
      if (isOnLogin) {
        handleSuccessfulAuth(session);
      }
    }
  });
});

// ── Shared redirect logic after successful auth ──
function handleSuccessfulAuth(session) {
  if (!session) return;
  
  const adminEmail = 'theaccessorieshub2530@gmail.com';
  const isAuthAdmin = session.user?.email === adminEmail;
  
  const storedReturn = sessionStorage.getItem('tah_return_url');
  let returnUrl;
  
  if (isAuthAdmin) {
    returnUrl = (storedReturn && storedReturn.includes('/admin')) ? storedReturn : '/admin/index.html';
  } else {
    returnUrl = storedReturn || '/';
  }
  
  sessionStorage.removeItem('tah_return_url');
  window.location.href = returnUrl;
}

// ── Google OAuth Sign-In ──
async function handleGoogleSignIn() {
  // Use window.location.origin so it always matches production or local
  const redirectTo = window.location.origin + '/login';
  console.log('[Auth] Initiating Google Sign-In. Redirect:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }
  });

  if (error) {
    const msg = document.getElementById('authMessage');
    if (msg) {
      msg.textContent = error.message;
      msg.style.display = 'block';
    } else {
      alert('Authentication Error: ' + error.message);
    }
  }
}
