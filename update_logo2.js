const fs = require('fs');
const path = require('path');
const baseDir = 'e:/HUB WEBSITE';
const storeFiles = ['index.html', 'products.html', 'product-detail.html', 'checkout.html'];
const adminDir = path.join(baseDir, 'admin');
const adminFiles = ['index.html', 'products.html', 'inventory.html', 'orders.html', 'customers.html', 'invoices.html', 'settings.html'];

function updateLogoText(filepath, isAdmin) {
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    const logoRegex = /<a href="index\.html" class="logo">[\s\S]*?<\/a>/g;
    const logoPath = isAdmin ? '../images/logo.png' : 'images/logo.png';
    const newLogoHtml = `<a href="index.html" class="logo">\n        <img src="${logoPath}" alt="The Accessories Hub" style="height: 55px; width: auto;">\n        <span>THE ACCESSORIES HUB</span>\n      </a>`;
    content = content.replace(logoRegex, newLogoHtml);
    fs.writeFileSync(filepath, content);
  }
}

storeFiles.forEach(f => updateLogoText(path.join(baseDir, f), false));
adminFiles.forEach(f => updateLogoText(path.join(adminDir, f), true));
console.log('Restored text beside logo in all files.');
