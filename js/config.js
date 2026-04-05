// js/config.js
const CONFIG = {
  // Dynamically get the redirect URL based on environment
  getRedirectURL(path = '') {
      const origin = window.location.origin;
      // Normalizes the redirect path to avoid double slashes and ensure correctness
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${origin}${cleanPath}`;
      return url;
  },
  
  // Is this running on localhost?
  isLocal() {
      return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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
