const fs = require('fs');
const path = require('path');

const adminJsDir = 'e:/HUB WEBSITE/admin/js';

// 1. Refactor admin-app.js
let appJs = fs.readFileSync(path.join(adminJsDir, 'admin-app.js'), 'utf-8');
// Remove seedData completely
appJs = appJs.replace(/function seedData\(\) \{[\s\S]*?\}\s*\/\/ ===== DATA HELPERS =====/, '// ===== DATA HELPERS =====');
appJs = appJs.replace(/seedData\(\);/, '');

// Add loadData
const loadDataCode = `
async function loadData() {
  const [
    {data: products},
    {data: customers},
    {data: orders},
    {data: orderItems},
    {data: invoices},
    {data: stockHistory},
    {data: settings}
  ] = await Promise.all([
    supabase.from('products').select('*').order('id', {ascending:true}),
    supabase.from('customers').select('*').order('id', {ascending:true}),
    supabase.from('orders').select('*').order('id', {ascending:false}),
    supabase.from('order_items').select('*'),
    supabase.from('invoices').select('*').order('created_at', {ascending:false}),
    supabase.from('stock_history').select('*').order('id', {ascending:false}),
    supabase.from('settings').select('*').single()
  ]);

  if(orders && orderItems) {
    orders.forEach(o => {
      o.items = orderItems.filter(i => i.order_id === o.id).map(i => ({
        productId: i.product_id, name: i.name, price: i.price, qty: i.qty, image: i.image
      }));
    });
  }

  DB._cache = {
    products: products || [],
    customers: customers || [],
    orders: orders || [],
    invoices: invoices || [],
    stockHistory: stockHistory || [],
    settings: (settings && Object.keys(settings).length > 0) ? settings : {
      business_name: "The Accessories Hub",
      whatsapp_templates: {
        orderConfirm: "Hello {name}! 🎉 Your order #{orderId} has been confirmed. Total: Rs. {total}. Thank you for shopping with The Accessories Hub! 💎",
        shipped: "Hi {name}! 📦 Great news! Your order #{orderId} has been shipped. Tracking: {tracking}. Expected delivery: 3-5 days.",
        delivered: "Hello {name}! ✅ Your order #{orderId} has been delivered! We hope you love your purchase. Leave us a review! 💛"
      },
      shipping_providers: [
        { name:"Nepal Post", type:"standard", rate:150, freeAbove:2000 },
        { name:"Pathao Courier", type:"express", rate:250, freeAbove:3000 }
      ]
    }
  };
}

const DB = {
  _cache: {},
  products() { return this._cache.products.map(p => ({...p, originalPrice: p.original_price, inStock: p.in_stock, reorderLevel: p.reorder_level})); },
  customers() { return this._cache.customers.map(c => ({...c, totalOrders: c.total_orders, totalSpent: c.total_spent, joinDate: c.join_date})); },
  orders() { return this._cache.orders.map(o => ({...o, customerId: o.customer_id, customerName: o.customer_name, trackingId: o.tracking_id, shippingAddress: o.shipping_address})); },
  invoices() { return this._cache.invoices.map(i => ({...i, orderId: i.order_id, customerName: i.customer_name})); },
  stockHistory() { return this._cache.stockHistory.map(h => ({...h, newStock: h.new_stock, change: h.change_amount})); },
  settings() { return this._cache.settings; },
  nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; }
};
`;

appJs = appJs.replace(/const DB = \{[\s\S]*?\/\/ ===== TOAST NOTIFICATIONS =====/m, loadDataCode + '\n// ===== TOAST NOTIFICATIONS =====');
fs.writeFileSync(path.join(adminJsDir, 'admin-app.js'), appJs);


// 2. Refactor all controllers DOMContentLoaded
const files = ['dashboard.js', 'products-admin.js', 'inventory-admin.js', 'orders-admin.js', 'invoices-admin.js', 'customers-admin.js', 'settings-admin.js'];
files.forEach(f => {
  const p = path.join(adminJsDir, f);
  let content = fs.readFileSync(p, 'utf-8');
  content = content.replace(/document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{/, "document.addEventListener('DOMContentLoaded', async () => {\n  await loadData();");
  
  if (f === 'products-admin.js') {
    content = content.replace(/function saveProduct\(e\) \{/, 'async function saveProduct(e) {');
    content = content.replace(/if \(editingProductId\) \{([\s\S]*?)showToast\('Product updated successfully!'\);[\s\S]*?\} else \{([\s\S]*?)showToast\('Product added successfully!'\);[\s\S]*?\}/, 
      `if (editingProductId) {
    await supabase.from('products').update(data).eq('id', editingProductId);
    showToast('Product updated successfully!');
  } else {
    data.sku = 'SKU-' + Math.floor(Math.random() * 10000);
    await supabase.from('products').insert([data]);
    showToast('Product added successfully!');
  }`);
    // clean up the rest of DB.saveProducts
    content = content.replace(/DB\.saveProducts\(products\);/, 'await loadData();');

    content = content.replace(/function deleteProduct\(id\) \{[\s\S]*?showToast\('Product deleted.', 'error'\);\n\}/, 
      `async function deleteProduct(id) {
  await supabase.from('products').delete().eq('id', id);
  await loadData();
  closeAllModals();
  renderProductsTable();
  showToast('Product deleted.', 'error');
}`);
  }
  
  fs.writeFileSync(p, content);
});

console.log("Refactoring complete");
