// js/admin-guard.js
(function() {
    // List of authorized emails
    const AUTHORIZED_ADMIN = [
        'theaccessorieshub2530@gmail.com', 
        // Add more admin emails here
    ];

    async function checkAdminAuth() {
        // Wait for supabase to be defined if needed
        if (typeof supabase === 'undefined') {
            setTimeout(checkAdminAuth, 100);
            return;
        }

        // Check if we are in the middle of an auth redirect
        if (window.location.hash.includes('access_token=')) {
            // Give Supabase a moment to process the hash
            setTimeout(checkAdminAuth, 500);
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            // Not logged in at all
            window.location.href = '/admin-login.html';
            return;
        }

        const userEmail = session.user.email.toLowerCase();
        const isAuthorized = AUTHORIZED_ADMIN.some(email => email.toLowerCase() === userEmail);

        if (!isAuthorized) {
            console.error('Unauthorized access attempt by:', userEmail);
            await supabase.auth.signOut();
            window.location.href = '/admin-login.html?error=Unauthorized. Restricted Access: Authorized Personnel Only.';
        }
    }

    // Run auth check
    checkAdminAuth();
})();
