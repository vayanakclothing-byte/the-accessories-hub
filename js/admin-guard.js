// js/admin-guard.js — High-Performance Admin RBAC Guard via Supabase profiles.role check
(function () {
  'use strict';

  // Fast-path: If user was verified as admin in this session, show immediately without flash
  const cachedRole = sessionStorage.getItem('tah_admin_role');
  if (cachedRole === 'admin') {
    document.documentElement.style.visibility = 'visible';
  } else {
    document.documentElement.style.visibility = 'hidden';
  }

  let initRetries = 0;
  async function checkAdminAuth() {
    // Wait for supabase client to be initialized
    if (typeof supabase === 'undefined' || !supabase.auth) {
      initRetries++;
      if (initRetries > 30) { // 3 seconds max wait
        console.error('[AdminGuard] Supabase failed to initialize after 3 seconds.');
        redirectToLogin();
        return;
      }
      setTimeout(checkAdminAuth, 80);
      return;
    }

    // ── Normal page load: retrieve existing session ──
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AdminGuard] Session error:', error.message);
        sessionStorage.removeItem('tah_admin_role');
        redirectToLogin();
        return;
      }

      if (session) {
        // We have a valid session — verify role immediately
        await verifyAdminRole(session.user);
        return;
      }

      // ── Detect OAuth callback if no session yet ──
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hasCode = urlParams.has('code');
      const hasToken = hashParams.has('access_token');

      if (hasCode || hasToken) {
        console.log('[AdminGuard] OAuth callback detected, waiting for session...');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            subscription.unsubscribe();
            await verifyAdminRole(session.user);
          }
        });
        
        // Safety timeout to prevent infinite hidden screen
        setTimeout(() => {
          if (document.documentElement.style.visibility === 'hidden') {
            console.warn('[AdminGuard] OAuth callback timed out.');
            redirectToLogin();
          }
        }, 5000);
      } else {
        // No session and not a callback
        sessionStorage.removeItem('tah_admin_role');
        redirectToLogin();
      }

    } catch (e) {
      console.error('[AdminGuard] Unexpected error:', e);
      sessionStorage.removeItem('tah_admin_role');
      redirectToLogin();
    }
  }

  /**
   * Query the profiles table to check if the user has role = 'admin'.
   * If not admin, redirect to /request-access with their user ID.
   */
  async function verifyAdminRole(user) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[AdminGuard] Profile query error:', error.message);
        sessionStorage.removeItem('tah_admin_role');
        redirectToRequestAccess(user.id, user.email);
        return;
      }

      if (profile.role !== 'admin') {
        console.warn('[AdminGuard] User is not admin. Role:', profile.role);
        sessionStorage.removeItem('tah_admin_role');
        redirectToRequestAccess(user.id, user.email);
        return;
      }

      // ✅ User is authorized admin
      sessionStorage.setItem('tah_admin_role', 'admin');
      document.documentElement.style.visibility = 'visible';

    } catch (e) {
      console.error('[AdminGuard] Role verification error:', e);
      sessionStorage.removeItem('tah_admin_role');
      redirectToRequestAccess(user.id, user.email);
    }
  }

  function redirectToLogin() {
    let returnUrl = window.location.href;
    try {
      const u = new URL(returnUrl);
      if (u.pathname === '/admin' || u.pathname === '/admin/') {
        returnUrl = u.origin + '/admin/index.html' + u.search + u.hash;
      } else if (!u.pathname.endsWith('.html') && u.pathname.startsWith('/admin/')) {
        returnUrl = u.origin + u.pathname + '.html' + u.search + u.hash;
      }
    } catch (_) {}
    sessionStorage.setItem('tah_return_url', returnUrl);
    document.documentElement.style.visibility = 'visible';
    window.location.href = '/admin/login.html';
  }

  function redirectToRequestAccess(userId, userEmail) {
    document.documentElement.style.visibility = 'visible';
    const params = new URLSearchParams({ uid: userId || '', email: userEmail || '' });
    window.location.href = '/request-access.html?' + params.toString();
  }

  // Run the guard
  checkAdminAuth();
})();
