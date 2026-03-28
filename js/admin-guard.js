// js/admin-guard.js
(function() {
    // List of authorized emails
    const AUTHORIZED_ADMIN = [
        'your-email@gmail.com', // Replace with David's actual email as per prompt
        // Add more admin emails here
    ];

    async function checkAdminAuth() {
        // Wait for supabase to be defined if needed
        if (typeof supabase === 'undefined') {
            // If supabase script hasn't loaded (unlikely if script order is right), we wait
            setTimeout(checkAdminAuth, 100);
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            // Not logged in at all
            window.location.href = '/admin-login.html';
            return;
        }

        const userEmail = session.user.email;
        const isAuthorized = AUTHORIZED_ADMIN.includes(userEmail);

        if (!isAuthorized) {
            console.error('Unauthorized access attempt by:', userEmail);
            // Sign out the current session and redirect
            await supabase.auth.signOut();
            window.location.href = '/admin-login.html?error=Unauthorized. Restricted Access: Authorized Personnel Only.';
        }
    }

    // Run auth check
    checkAdminAuth();
})();
