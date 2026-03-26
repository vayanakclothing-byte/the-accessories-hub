const fs = require('fs');
const path = require('path');

const adminJsDir = 'e:/HUB WEBSITE/admin/js';

// 1. orders-admin.js
let ordersJs = fs.readFileSync(path.join(adminJsDir, 'orders-admin.js'), 'utf-8');
ordersJs = ordersJs.replace(/function updateOrderStatus\(id\) \{[\s\S]*?showToast\([^)]+\);\n\}/, 
`async function updateOrderStatus(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;
  const status = document.getElementById('statusSelect').value;
  const trackingId = document.getElementById('trackingInput').value || o.trackingId;
  await supabase.from('orders').update({status, tracking_id: trackingId}).eq('id', id);
  await loadData();
  closeAllModals();
  renderOrdersTable();
  renderOrderStats();
  showToast(\`Order #\${id} status updated to \${status}\`);
}`);
fs.writeFileSync(path.join(adminJsDir, 'orders-admin.js'), ordersJs);

// 2. inventory-admin.js
let invJs = fs.readFileSync(path.join(adminJsDir, 'inventory-admin.js'), 'utf-8');
invJs = invJs.replace(/function adjustStock\(id, delta\) \{[\s\S]*?renderInventoryStats\(\);\n\}/, 
`async function adjustStock(id, delta) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const newStock = Math.max(0, p.stock + delta);
  await supabase.from('products').update({stock: newStock, in_stock: newStock > 0}).eq('id', id);
  await logStockChange(p.name, delta > 0 ? 'restock' : 'adjustment', delta, newStock);
  await loadData();
  renderInventoryTable();
  renderInventoryStats();
}`);
invJs = invJs.replace(/function setStock\(id, value\) \{[\s\S]*?showToast\([^\)]+\);\n\}/, 
`async function setStock(id, value) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const oldStock = p.stock;
  const newStock = Math.max(0, parseInt(value) || 0);
  await supabase.from('products').update({stock: newStock, in_stock: newStock > 0}).eq('id', id);
  await logStockChange(p.name, 'adjustment', newStock - oldStock, newStock);
  await loadData();
  renderInventoryStats();
  showToast(\`Stock updated for \${p.name}\`);
}`);
invJs = invJs.replace(/function restockProduct\(id\) \{[\s\S]*?showToast\([^\)]+\);\n\}/, 
`async function restockProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const amount = 20;
  await supabase.from('products').update({stock: p.stock + amount, in_stock: true}).eq('id', id);
  await logStockChange(p.name, 'restock', amount, p.stock + amount);
  await loadData();
  renderInventoryTable();
  renderInventoryStats();
  showToast(\`Restocked \${p.name} with +\${amount} units\`, 'info');
}`);
invJs = invJs.replace(/function logStockChange\(product, type, change, newStock\) \{[\s\S]*?renderStockHistory\(\);\n\}/, 
`async function logStockChange(product, type, change, newStock) {
  const now = new Date();
  await supabase.from('stock_history').insert([{
    product, type, change_amount: change, new_stock: newStock,
    date: \`\${now.toISOString().split('T')[0]} \${now.toTimeString().slice(0,5)}\`
  }]);
}`);
fs.writeFileSync(path.join(adminJsDir, 'inventory-admin.js'), invJs);

// 3. customers-admin.js
let custJs = fs.readFileSync(path.join(adminJsDir, 'customers-admin.js'), 'utf-8');
custJs = custJs.replace(/function saveCustomer\(e\) \{/, 'async function saveCustomer(e) {');
custJs = custJs.replace(/if \(editingCustomerId\) \{([\s\S]*?)showToast\('Customer updated successfully!'\);[\s\S]*?\} else \{([\s\S]*?)showToast\('Customer added successfully!'\);[\s\S]*?\}/, 
`if (editingCustomerId) {
    await supabase.from('customers').update(data).eq('id', editingCustomerId);
    showToast('Customer updated successfully!');
  } else {
    await supabase.from('customers').insert([data]);
    showToast('Customer added successfully!');
  }`);
custJs = custJs.replace(/DB\.saveCustomers\(customers\);/, 'await loadData();');
custJs = custJs.replace(/function deleteCustomer\(id\) \{[\s\S]*?showToast\('Customer deleted\.', 'error'\);\n\}/, 
`async function deleteCustomer(id) {
  await supabase.from('customers').delete().eq('id', id);
  await loadData();
  closeAllModals();
  renderCustomersTable();
  showToast('Customer deleted.', 'error');
}`);
fs.writeFileSync(path.join(adminJsDir, 'customers-admin.js'), custJs);

// 4. invoices-admin.js
let invcJs = fs.readFileSync(path.join(adminJsDir, 'invoices-admin.js'), 'utf-8');
invcJs = invcJs.replace(/function saveInvoiceToDb\(invoiceObj\) \{[\s\S]*?renderInvoicesTable\(\);\n\}/, 
`async function saveInvoiceToDb(invoiceObj) {
  await supabase.from('invoices').insert([{
    id: invoiceObj.id,
    order_id: invoiceObj.orderId,
    customer_name: invoiceObj.customerName,
    amount: invoiceObj.amount,
    date: invoiceObj.date,
    status: invoiceObj.status
  }]);
  await loadData();
  renderInvoicesTable();
}`);
invcJs = invcJs.replace(/function deleteInvoice\(id\) \{[\s\S]*?showToast\('Invoice deleted\.', 'error'\);\n\}/, 
`async function deleteInvoice(id) {
  await supabase.from('invoices').delete().eq('id', id);
  await loadData();
  closeAllModals();
  renderInvoicesTable();
  showToast('Invoice deleted.', 'error');
}`);
fs.writeFileSync(path.join(adminJsDir, 'invoices-admin.js'), invcJs);

// 5. settings-admin.js
let setJs = fs.readFileSync(path.join(adminJsDir, 'settings-admin.js'), 'utf-8');
setJs = setJs.replace(/function saveBusinessInfo\(e\) \{[\s\S]*?showToast\('Business information updated\!'\);\n\}/, 
`async function saveBusinessInfo(e) {
  e.preventDefault();
  const data = {
    business_name: document.getElementById('bizName').value,
    business_address: document.getElementById('bizAddress').value,
    business_phone: document.getElementById('bizPhone').value,
    business_email: document.getElementById('bizEmail').value
  };
  await supabase.from('settings').update(data).eq('id', 1);
  await loadData();
  showToast('Business information updated!');
}`);
setJs = setJs.replace(/function saveWhatsAppSettings\(e\) \{[\s\S]*?showToast\('WhatsApp settings updated\!'\);\n\}/, 
`async function saveWhatsAppSettings(e) {
  e.preventDefault();
  const settings = DB.settings();
  const data = {
    whatsapp_number: document.getElementById('waPhone').value,
    whatsapp_templates: {
      orderConfirm: document.getElementById('waOrderConfirm').value,
      shipped: document.getElementById('waShipped').value,
      delivered: document.getElementById('waDelivered').value
    }
  };
  await supabase.from('settings').update(data).eq('id', 1);
  await loadData();
  showToast('WhatsApp settings updated!');
}`);
setJs = setJs.replace(/function saveProvider\(e\) \{[\s\S]*?showToast\('Provider updated\!'\);[\s\S]*?\} else \{[\s\S]*?showToast\('Provider added\!'\);[\s\S]*?\}/, 
`async function saveProvider(e) {
  e.preventDefault();
  const settings = DB.settings();
  let providers = settings.shipping_providers || [];
  const data = {
    name: document.getElementById('spName').value,
    type: document.getElementById('spType').value,
    rate: Number(document.getElementById('spRate').value),
    freeAbove: Number(document.getElementById('spFree').value) || null
  };
  if (editingProviderIndex !== null) {
    providers[editingProviderIndex] = data;
    showToast('Provider updated!');
  } else {
    providers.push(data);
    showToast('Provider added!');
  }
  await supabase.from('settings').update({shipping_providers: providers}).eq('id', 1);
  await loadData();
  closeAllModals();
  renderShippingProviders();
`);
setJs = setJs.replace(/DB\.saveSettings\(settings\);\n  closeAllModals\(\);\n  renderShippingProviders\(\);\n\}/, '}'); // cleanup

setJs = setJs.replace(/function deleteProvider\(index\) \{[\s\S]*?showToast\('Provider removed\.', 'error'\);\n\}/, 
`async function deleteProvider(index) {
  const settings = DB.settings();
  let providers = settings.shipping_providers || [];
  providers.splice(index, 1);
  await supabase.from('settings').update({shipping_providers: providers}).eq('id', 1);
  await loadData();
  closeAllModals();
  renderShippingProviders();
  showToast('Provider removed.', 'error');
}`);
fs.writeFileSync(path.join(adminJsDir, 'settings-admin.js'), setJs);

console.log("Secondary refactoring complete");
