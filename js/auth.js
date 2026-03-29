// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
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
        const adminEmail = 'theaccessorieshub2530@gmail.com';
        const isAuthAdmin = session?.user?.email === adminEmail;
        
        // Success - redirect to intended page or index (or admin if authorized)
        const returnUrl = isAuthAdmin ? '/admin/index.html' : (sessionStorage.getItem('tah_return_url') || 'index.html');
        window.location.href = returnUrl;

      } catch (err) {
        msg.textContent = err.message;
        msg.style.display = 'block';
      }
    });
  }

  // Toggle Login / Signup UI
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

  // Check if we just returned from OAuth and have a session
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const adminEmail = 'theaccessorieshub2530@gmail.com';
      const isAuthAdmin = session.user.email === adminEmail;
      
      const returnUrl = isAuthAdmin ? '/admin/index.html' : (sessionStorage.getItem('tah_return_url') || 'index.html');
      sessionStorage.removeItem('tah_return_url');
      
      if (window.location.pathname.includes('login.html') || window.location.pathname.includes('admin-login.html')) {
        window.location.href = returnUrl;
      }
    }
  });
});

async function handleGoogleSignIn() {
  // Store the current page as return URL if not on login pages
  if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('admin-login.html')) {
      sessionStorage.setItem('tah_return_url', window.location.href);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/login.html', // Redirect to login page to handle the session transition
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
