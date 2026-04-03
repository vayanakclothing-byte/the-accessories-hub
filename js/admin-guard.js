// js/admin-guard.js — Protects admin pages via Supabase profiles.role check
(function () {
  'use strict';

  // Hide page content until authorized (prevents flash)
  document.documentElement.style.visibility = 'hidden';

  async function checkAdminAuth() {
    // Wait for supabase client to be initialized
    if (typeof supabase === 'undefined') {
      setTimeout(checkAdminAuth, 100);
      return;
    }

    // ── Detect OAuth callback (PKCE uses ?code= in query params) ──
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isOAuthCallback = urlParams.has('code') || hashParams.has('access_token');

    if (isOAuthCallback) {
      console.log('[AdminGuard] OAuth callback detected, waiting for session...');
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          console.log('[AdminGuard] Session established after OAuth callback');
          verifyAdminRole(session.user);
        }
      });
      return; // Don't redirect — wait for session
    }

    // ── Normal page load: retrieve existing session ──
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AdminGuard] Session error:', error.message);
        redirectToLogin();
        return;
      }

      if (!session) {
        console.log('[AdminGuard] No session found, redirecting to login');
        redirectToLogin();
        return;
      }

      // We have a valid session — now verify the role in profiles table
      await verifyAdminRole(session.user);

    } catch (e) {
      console.error('[AdminGuard] Unexpected error:', e);
      redirectToLogin();
    }
  }

  /**
   * Query the profiles table to check if the user has role = 'admin'.
   * If not admin, redirect to /request-access with their user ID.
   */
  async function verifyAdminRole(user) {
    try {
      console.log('[AdminGuard] Verifying admin role for user:', user.id);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[AdminGuard] Profile query error:', error.message);
        // Profile might not exist yet (race condition on first sign-up)
        // Redirect to request-access so user can see their ID
        redirectToRequestAccess(user.id, user.email);
        return;
      }

      if (profile.role !== 'admin') {
        console.warn('[AdminGuard] User is not admin. Role:', profile.role);
        redirectToRequestAccess(user.id, user.email);
        return;
      }

      // ✅ User is authorized admin
      console.log('[AdminGuard] ✅ Admin access granted for:', user.email);
      document.documentElement.style.visibility = 'visible';

    } catch (e) {
      console.error('[AdminGuard] Role verification error:', e);
      redirectToRequestAccess(user.id, user.email);
    }
  }

  function redirectToLogin() {
    sessionStorage.setItem('tah_return_url', window.location.href);
    document.documentElement.style.visibility = 'visible';
    window.location.href = '/login.html';
  }

  function redirectToRequestAccess(userId, userEmail) {
    document.documentElement.style.visibility = 'visible';
    const params = new URLSearchParams({ uid: userId || '', email: userEmail || '' });
    window.location.href = '/request-access.html?' + params.toString();
  }

  // Run the guard
  checkAdminAuth();
})();
