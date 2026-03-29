// js/config.js
const CONFIG = {
    // Dynamically get the redirect URL based on environment
    getRedirectURL(path = '') {
        const origin = window.location.origin;
        // If we are on localhost, keep it
        // Otherwise, use the current origin
        return `${origin}${path}`;
    },
    
    // Business info
    business: {
        name: "The Accessories Hub",
        email: "theaccessorieshub2530@gmail.com",
        phone: "+977 9805659501",
        address: "Birgunj, Nepal"
    }
};

window.CONFIG = CONFIG;
