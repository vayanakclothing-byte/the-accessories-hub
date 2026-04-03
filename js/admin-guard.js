// js/admin-guard.js — Protects admin pages
(function() {
    const AUTHORIZED_ADMIN = [
        'theaccessorieshub2530@gmail.com',
    ];

    async function checkAdminAuth() {
        // Wait for supabase to be defined
        if (typeof supabase === 'undefined') {
            setTimeout(checkAdminAuth, 100);
            return;
        }

        // ── Detect OAuth callback (PKCE uses ?code= in query params) ──
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const isOAuthCallback = urlParams.has('code') || hashParams.has('access_token');

        if (isOAuthCallback) {
            // We're returning from Google OAuth — let Supabase process the code first
            // Listen for the session to be established, then re-check
            console.log('[AdminGuard] OAuth callback detected, waiting for session...');
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    console.log('[AdminGuard] Session established after OAuth callback');
                    validateSession(session);
                }
            });
            return; // Don't redirect — wait for session
        }

        // ── Normal page load: check existing session ──
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

            validateSession(session);
        } catch (e) {
            console.error('[AdminGuard] Unexpected error:', e);
            redirectToLogin();
        }
    }

    function validateSession(session) {
        const userEmail = session.user.email.toLowerCase();
        const isAuthorized = AUTHORIZED_ADMIN.some(email => email.toLowerCase() === userEmail);

        if (!isAuthorized) {
            console.error('[AdminGuard] Unauthorized access attempt by:', userEmail);
            supabase.auth.signOut().then(() => {
                window.location.href = '/login.html?error=Unauthorized. Restricted Access: Authorized Personnel Only.';
            });
        } else {
            console.log('[AdminGuard] Access granted for:', userEmail);
        }
    }

    function redirectToLogin() {
        sessionStorage.setItem('tah_return_url', window.location.href);
        window.location.href = '/login.html';
    }

    // Run the guard
    checkAdminAuth();
})();
