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
        await handleSuccessfulAuth(session);

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
async function handleSuccessfulAuth(session) {
  if (!session) return;

  let storedReturn = sessionStorage.getItem('tah_return_url');
  sessionStorage.removeItem('tah_return_url');

  if (storedReturn) {
    try {
      const u = new URL(storedReturn, window.location.origin);
      if (u.pathname === '/admin' || u.pathname === '/admin/') {
        storedReturn = u.origin + '/admin/index.html' + u.search + u.hash;
      } else if (!u.pathname.endsWith('.html') && u.pathname.startsWith('/admin/')) {
        storedReturn = u.origin + u.pathname + '.html' + u.search + u.hash;
      }
    } catch (_) {}
  }

  // Only redirect to admin if the user was explicitly navigating to an admin page
  if (storedReturn && storedReturn.includes('/admin') && !storedReturn.includes('/login')) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile && profile.role === 'admin') {
        window.location.href = storedReturn;
        return;
      }
    } catch (e) {
      console.warn('[Auth] Role check error:', e);
    }
  }

  // If returning to a storefront page (e.g. checkout), resume there
  if (storedReturn && !storedReturn.includes('/admin') && !storedReturn.includes('/login')) {
    window.location.href = storedReturn;
    return;
  }

  // Otherwise, default to the storefront homepage
  window.location.href = '/';
}

// ── Google OAuth Sign-In ──
async function handleGoogleSignIn() {
  try {
    // Show a small loader or feedback
    const msg = document.getElementById('authMessage');
    if (msg) {
        msg.textContent = 'Connecting to Google...';
        msg.style.display = 'block';
        msg.style.color = 'var(--gold)';
    }

    // Use normalized redirect URL from config (targeting valid .html endpoint)
    const redirectTo = CONFIG.getRedirectURL('login.html');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
    });

    if (error) throw error;
  } catch (err) {
    console.error('[Auth] Google Sign-In Error:', err);
    const msg = document.getElementById('authMessage');
    if (msg) {
      msg.textContent = err.message || 'Failed to connect to Google';
      msg.style.display = 'block';
      msg.style.color = 'var(--red, #E74C3C)';
    } else {
      alert('Authentication Error: ' + err.message);
    }
  }
}
