/* ============================================================
   Settings — Financial, Shipping, WhatsApp, Business ERP
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  loadSettings();
  document.getElementById('financeForm')?.addEventListener('submit', saveFinanceSettings);
  document.getElementById('businessForm')?.addEventListener('submit', saveBusinessSettings);
  document.getElementById('whatsappForm')?.addEventListener('submit', saveWhatsAppSettings);
});

function loadSettings() {
  const s = DB.settings();

  // Financial info
  const currSym = document.getElementById('cfgCurrencySymbol');
  if (currSym) currSym.value = s.currencySymbol || 'Rs.';
  const currCode = document.getElementById('cfgCurrencyCode');
  if (currCode) currCode.value = s.currencyCode || 'NPR';
  const taxRate = document.getElementById('cfgTaxRate');
  if (taxRate) taxRate.value = s.taxRate !== undefined ? s.taxRate : 13;
  const lowStock = document.getElementById('cfgLowStockLimit');
  if (lowStock) lowStock.value = s.lowStockLimit !== undefined ? s.lowStockLimit : 5;
  const invPrefix = document.getElementById('cfgInvoicePrefix');
  if (invPrefix) invPrefix.value = s.invoicePrefix || 'INV-';

  // Business info
  document.getElementById('bizName').value = s.businessName || '';
  document.getElementById('bizAddress').value = s.businessAddress || '';
  document.getElementById('bizPhone').value = s.businessPhone || '';
  document.getElementById('bizEmail').value = s.businessEmail || '';

  // WhatsApp
  document.getElementById('waNumber').value = s.whatsappNumber || '';
  document.getElementById('waOrderConfirm').value = s.whatsappTemplates?.orderConfirm || '';
  document.getElementById('waShipped').value = s.whatsappTemplates?.shipped || '';
  document.getElementById('waDelivered').value = s.whatsappTemplates?.delivered || '';

  // Shipping providers
  renderShippingProviders(s.shippingProviders || []);
}

async function saveFinanceSettings(e) {
  e.preventDefault();
  const s = DB.settings();
  s.currencySymbol = document.getElementById('cfgCurrencySymbol').value.trim() || 'Rs.';
  s.currencyCode = document.getElementById('cfgCurrencyCode').value.trim() || 'NPR';
  s.taxRate = Number(document.getElementById('cfgTaxRate').value) || 0;
  s.lowStockLimit = parseInt(document.getElementById('cfgLowStockLimit').value, 10) || 5;
  s.invoicePrefix = document.getElementById('cfgInvoicePrefix').value.trim() || 'INV-';

  await DB.saveSettings(s);
  if (typeof DB.logAudit === 'function') {
    DB.logAudit('update', 'settings', 'financial', { taxRate: s.taxRate, currency: s.currencyCode, lowStock: s.lowStockLimit });
  }
  showToast('Financial & currency settings saved successfully!');
}

async function saveBusinessSettings(e) {
  e.preventDefault();
  const s = DB.settings();
  s.businessName = document.getElementById('bizName').value;
  s.businessAddress = document.getElementById('bizAddress').value;
  s.businessPhone = document.getElementById('bizPhone').value;
  s.businessEmail = document.getElementById('bizEmail').value;
  await DB.saveSettings(s);
  if (typeof DB.logAudit === 'function') {
    DB.logAudit('update', 'settings', 'business_info', { name: s.businessName, email: s.businessEmail });
  }
  showToast('Business information saved!');
}

async function saveWhatsAppSettings(e) {
  e.preventDefault();
  const s = DB.settings();
  s.whatsappNumber = document.getElementById('waNumber').value;
  s.whatsappTemplates = {
    orderConfirm: document.getElementById('waOrderConfirm').value,
    shipped: document.getElementById('waShipped').value,
    delivered: document.getElementById('waDelivered').value
  };
  await DB.saveSettings(s);
  if (typeof DB.logAudit === 'function') {
    DB.logAudit('update', 'settings', 'whatsapp', { number: s.whatsappNumber });
  }
  showToast('WhatsApp templates saved!');
}

function renderShippingProviders(providers) {
  const container = document.getElementById('shippingProviders');
  if (!container) return;

  if (!providers.length) {
    container.innerHTML = '<p style="color:var(--white-muted);font-size:0.85rem;">No shipping providers configured yet.</p>';
    return;
  }

  container.innerHTML = providers.map((p, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--grey);border-radius:10px;border:1px solid var(--grey-mid);margin-bottom:10px;">
      <div style="flex:1;">
        <div style="font-weight:600;">${escapeHtml(p.name)}</div>
        <div style="font-size:0.8rem;color:var(--white-muted);">${p.type === 'express' ? 'Express Delivery' : 'Standard Delivery'} — Rs. ${Number(p.rate) || 0} (Free above Rs. ${Number(p.freeAbove) || 0})</div>
      </div>
      <button class="btn btn-sm btn-ghost" onclick="editShippingProvider(${i})" title="Edit Provider" aria-label="Edit provider">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button class="btn btn-sm btn-danger" onclick="removeShippingProvider(${i})" title="Remove Provider" aria-label="Remove provider">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
      </button>
    </div>
  `).join('');
}

function addShippingProvider() {
  document.getElementById('spName').value = '';
  document.getElementById('spType').value = 'standard';
  document.getElementById('spRate').value = '';
  document.getElementById('spFreeAbove').value = '';
  document.getElementById('spEditIndex').value = '-1';
  document.getElementById('shippingModalTitle').textContent = 'Add Shipping Provider';
  openModal('shippingModal');
}

function editShippingProvider(index) {
  const s = DB.settings();
  const p = s.shippingProviders[index];
  if (!p) return;
  document.getElementById('spName').value = p.name;
  document.getElementById('spType').value = p.type;
  document.getElementById('spRate').value = p.rate;
  document.getElementById('spFreeAbove').value = p.freeAbove;
  document.getElementById('spEditIndex').value = index;
  document.getElementById('shippingModalTitle').textContent = 'Edit Shipping Provider';
  openModal('shippingModal');
}

async function saveShippingProvider(e) {
  e.preventDefault();
  const s = DB.settings();
  const data = {
    name: document.getElementById('spName').value,
    type: document.getElementById('spType').value,
    rate: Number(document.getElementById('spRate').value),
    freeAbove: Number(document.getElementById('spFreeAbove').value)
  };
  const index = parseInt(document.getElementById('spEditIndex').value);
  if (index >= 0) {
    s.shippingProviders[index] = data;
  } else {
    s.shippingProviders.push(data);
  }
  await DB.saveSettings(s);
  closeAllModals();
  renderShippingProviders(s.shippingProviders);
  showToast('Shipping provider saved!');
}

async function removeShippingProvider(index) {
  if (!confirm('Remove this shipping provider?')) return;
  const s = DB.settings();
  s.shippingProviders.splice(index, 1);
  await DB.saveSettings(s);
  renderShippingProviders(s.shippingProviders);
  showToast('Shipping provider removed');
}

function testWhatsApp() {
  const number = document.getElementById('waNumber').value;
  if (!number) { showToast('Enter a WhatsApp number first', 'error'); return; }
  sendWhatsApp(number, 'Hello! 💎 This is a test message from The Accessories Hub Admin Dashboard.');
}

function exportDataBackup() {
  const backup = {
    timestamp: new Date().toISOString(),
    business: DB.settings(),
    products_count: DB.products().length,
    orders_count: DB.orders().length,
    customers_count: DB.customers().length,
    suppliers_count: DB.suppliers().length,
    purchase_orders_count: DB.purchaseOrders().length,
    expenses_count: DB.expenses().length,
    coupons_count: DB.coupons().length,
    returns_count: DB.returnsRefunds().length,
    data: {
      products: DB.products(),
      categories: DB.categories(),
      orders: DB.orders(),
      customers: DB.customers(),
      suppliers: DB.suppliers(),
      purchaseOrders: DB.purchaseOrders(),
      expenses: DB.expenses(),
      shipments: DB.shipments(),
      returnsRefunds: DB.returnsRefunds(),
      coupons: DB.coupons(),
      reviews: DB.reviews()
    }
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tah_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Full ERP backup downloaded successfully!');
}

async function refreshAdminData() {
  showToast('Syncing ERP data from Supabase...');
  await loadData();
  loadSettings();
  showToast('ERP data synchronized!');
}
