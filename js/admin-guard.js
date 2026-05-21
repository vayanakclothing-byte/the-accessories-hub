// js/admin-guard.js — Protects admin pages via Supabase profiles.role check
(function () {
  'use strict';

  // Hide page content until authorized (prevents flash)
  document.documentElement.style.visibility = 'hidden';

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
      setTimeout(checkAdminAuth, 100);
      return;
    }

    // ── Normal page load: retrieve existing session ──
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AdminGuard] Session error:', error.message);
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
        // Wait for onAuthStateChange to pick up the hash/code
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
        redirectToLogin();
      }

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
