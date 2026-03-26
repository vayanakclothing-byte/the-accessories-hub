const fs = require('fs');
const path = require('path');

const baseDir = 'e:/HUB WEBSITE';

const importTagsStore = `  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
  <script src="js/app.js"></script>`;

const importTagsAdmin = `  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../js/supabase-client.js"></script>
  <script src="js/admin-app.js"></script>`;

const storeFiles = ['index.html', 'products.html', 'product-detail.html', 'checkout.html'];
storeFiles.forEach(f => {
  const filepath = path.join(baseDir, f);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    if (!content.includes('supabase-js@2')) {
      content = content.replace('<script src="js/app.js"></script>', importTagsStore);
      fs.writeFileSync(filepath, content);
      console.log('Updated ' + f);
    }
  }
});

const adminDir = path.join(baseDir, 'admin');
const adminFiles = ['index.html', 'products.html', 'inventory.html', 'orders.html', 'customers.html', 'invoices.html', 'settings.html'];
adminFiles.forEach(f => {
  const filepath = path.join(adminDir, f);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    if (!content.includes('supabase-js@2')) {
      content = content.replace('<script src="js/admin-app.js"></script>', importTagsAdmin);
      fs.writeFileSync(filepath, content);
      console.log('Updated admin/' + f);
    }
  }
});
