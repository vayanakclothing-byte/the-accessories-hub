/* ============================================================
   Settings — Shipping, WhatsApp, Business
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  loadSettings();
  document.getElementById('businessForm')?.addEventListener('submit', saveBusinessSettings);
  document.getElementById('whatsappForm')?.addEventListener('submit', saveWhatsAppSettings);
});

function loadSettings() {
  const s = DB.settings();

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

async function saveBusinessSettings(e) {
  e.preventDefault();
  const s = DB.settings();
  s.businessName = document.getElementById('bizName').value;
  s.businessAddress = document.getElementById('bizAddress').value;
  s.businessPhone = document.getElementById('bizPhone').value;
  s.businessEmail = document.getElementById('bizEmail').value;
  await DB.saveSettings(s);
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
}

function renderShippingProviders(providers) {
  const container = document.getElementById('shippingProviders');
  if (!container) return;

  container.innerHTML = providers.map((p, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--grey);border-radius:10px;border:1px solid var(--grey-mid);margin-bottom:10px;">
      <div style="flex:1;">
        <div style="font-weight:600;">${p.name}</div>
        <div style="font-size:0.8rem;color:var(--white-muted);">${p.type === 'express' ? '⚡ Express' : '📦 Standard'} — Rs. ${p.rate} (Free above Rs. ${p.freeAbove})</div>
      </div>
      <button class="btn btn-sm btn-ghost" onclick="editShippingProvider(${i})">✏️</button>
      <button class="btn btn-sm btn-danger" onclick="removeShippingProvider(${i})">🗑️</button>
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
}

async function removeShippingProvider(index) {
  const s = DB.settings();
  s.shippingProviders.splice(index, 1);
  await DB.saveSettings(s);
  renderShippingProviders(s.shippingProviders);
}

function testWhatsApp() {
  const number = document.getElementById('waNumber').value;
  if (!number) { showToast('Enter a WhatsApp number first', 'error'); return; }
  sendWhatsApp(number, 'Hello! 💎 This is a test message from The Accessories Hub Admin Dashboard.');
}

function resetData() {
  if (confirm('Are you sure? This will reset ALL admin data to defaults.')) {
    localStorage.removeItem('tah_admin_seeded');
    localStorage.removeItem('tah_products');
    localStorage.removeItem('tah_customers');
    localStorage.removeItem('tah_orders');
    localStorage.removeItem('tah_invoices');
    localStorage.removeItem('tah_stock_history');
    localStorage.removeItem('tah_settings');
    location.reload();
  }
}
