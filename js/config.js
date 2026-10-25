// js/config.js
const CONFIG = {
  // Normalize clean URLs to physical .html files for static / localhost compatibility
  normalizePath(urlOrPath = '') {
    if (!urlOrPath) return '/';
    try {
      const u = new URL(urlOrPath, window.location.origin);
      let p = u.pathname;
      if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
      else if (p === '/admin/login' || p === '/admin/login/') p = '/admin/login.html';
      else if (p === '/login' || p === '/login/') p = '/login.html';
      else if (p === '/checkout' || p === '/checkout/') p = '/checkout.html';
      else if (p === '/products' || p === '/products/') p = '/products.html';
      else if (p === '/product-detail' || p === '/product-detail/') p = '/product-detail.html';
      else if (p === '/request-access' || p === '/request-access/') p = '/request-access.html';
      return u.origin + p + u.search + u.hash;
    } catch (_) {
      return urlOrPath;
    }
  },

  // Dynamically get the redirect URL based on environment (always targeting valid .html endpoints)
  getRedirectURL(path = 'login.html') {
      const origin = window.location.origin;
      let cleanPath = path.startsWith('/') ? path : `/${path}`;
      if (cleanPath === '/login' || cleanPath === 'login') cleanPath = '/login.html';
      else if (cleanPath === '/admin/login' || cleanPath === 'admin/login') cleanPath = '/admin/login.html';
      else if (cleanPath === '/admin' || cleanPath === 'admin' || cleanPath === '/admin/') cleanPath = '/admin/index.html';
      return `${origin}${cleanPath}`;
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
