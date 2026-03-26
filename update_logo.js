const fs = require('fs');
const path = require('path');

const baseDir = 'e:/HUB WEBSITE';

const storeFiles = ['index.html', 'products.html', 'product-detail.html', 'checkout.html'];
const adminDir = path.join(baseDir, 'admin');
const adminFiles = ['index.html', 'products.html', 'inventory.html', 'orders.html', 'customers.html', 'invoices.html', 'settings.html'];

function updateFile(filepath, isAdmin) {
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    // 1. Replace Favicon
    // Storefront: <link rel="icon" href="...">
    // Admin: might be <link rel="icon" href="...">
    const faviconRegex = /<link rel="icon" href="data:image\/svg\+xml,[^"]+">/g;
    const faviconPath = isAdmin ? '../images/favicon.png' : 'images/favicon.png';
    content = content.replace(faviconRegex, `<link rel="icon" type="image/png" href="${faviconPath}">`);
    
    // 2. Replace Logo
    // Storefront:
    /*
      <a href="index.html" class="logo">
        <span class="icon">💎</span>
        <span>THE ACCESSORIES HUB</span>
      </a>
    */
    const logoRegex = /<a href="index\.html" class="logo">[\s\S]*?<\/a>/g;
    const logoPath = isAdmin ? '../images/logo.png' : 'images/logo.png';
    const newLogoHtml = `<a href="index.html" class="logo">\n        <img src="${logoPath}" alt="The Accessories Hub" style="height: 45px; width: auto;">\n      </a>`;
    
    content = content.replace(logoRegex, newLogoHtml);
    
    fs.writeFileSync(filepath, content);
    console.log('Updated ' + filepath);
  }
}

storeFiles.forEach(f => updateFile(path.join(baseDir, f), false));
adminFiles.forEach(f => updateFile(path.join(adminDir, f), true));
