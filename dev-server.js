const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const REWRITES = [
  { from: /^\/$/, to: '/index.html' },
  { from: /^\/shop\/?$/, to: '/shop.html' },
  { from: /^\/collections\/rings\/?$/, to: '/collections/rings.html' },
  { from: /^\/collections\/bracelets\/?$/, to: '/collections/bracelets.html' },
  { from: /^\/collections\/earrings\/?$/, to: '/collections/earrings.html' },
  { from: /^\/collections\/necklaces\/?$/, to: '/collections/necklaces.html' },
  { from: /^\/products\/?$/, to: '/products.html' },
  { from: /^\/product-detail\/?$/, to: '/product-detail.html' },
  { from: /^\/checkout\/?$/, to: '/checkout.html' },
  { from: /^\/login\/?$/, to: '/login.html' },
  { from: /^\/admin\/?$/, to: '/admin/index.html' },
  { from: /^\/admin\/index\/?$/, to: '/admin/index.html' },
  { from: /^\/admin\/products\/?$/, to: '/admin/products.html' },
  { from: /^\/admin\/categories\/?$/, to: '/admin/categories.html' },
  { from: /^\/admin\/inventory\/?$/, to: '/admin/inventory.html' },
  { from: /^\/admin\/orders\/?$/, to: '/admin/orders.html' },
  { from: /^\/admin\/customers\/?$/, to: '/admin/customers.html' },
  { from: /^\/admin\/invoices\/?$/, to: '/admin/invoices.html' },
  { from: /^\/admin\/settings\/?$/, to: '/admin/settings.html' },
  { from: /^\/admin\/login\/?$/, to: '/admin/login.html' }
];

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];

  for (const rule of REWRITES) {
    if (rule.from.test(reqUrl)) {
      reqUrl = rule.to;
      break;
    }
  }

  // Prevent directory traversal
  const safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${req.url}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[DevServer] Running at http://localhost:${PORT}/`);
});
