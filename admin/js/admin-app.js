/* ============================================================
   THE ACCESSORIES HUB — Admin Shared JavaScript
   Seed data, sidebar, toasts, helpers
   ============================================================ */

// ===== GLOBAL ERROR BOUNDARY =====
// Catches any unhandled errors and prevents blank screens
window.addEventListener('error', function (e) {
  console.error('[Admin] Uncaught error:', e.error || e.message);
  // Make sure the page is always visible even on errors
  document.documentElement.style.visibility = 'visible';
  const loader = document.getElementById('adminLoader');
  if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
});

window.addEventListener('unhandledrejection', function (e) {
  console.error('[Admin] Unhandled promise rejection:', e.reason);
  document.documentElement.style.visibility = 'visible';
  const loader = document.getElementById('adminLoader');
  if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
});

// ===== SEED DATA =====
// ===== DATA HELPERS =====

let _dataLoaded = false;
let _lastDataLoad = 0;
const DATA_CACHE_EXPIRY = 60000; // 1 minute session cache

async function loadData(force = false) {
  // Return early if data is fresh enough (prevents multiple fetches in same session)
  if (_dataLoaded && !force && (Date.now() - _lastDataLoad < DATA_CACHE_EXPIRY)) {
    return;
  }

  try {
    const fetchStart = Date.now();
    const [
      {data: products, error: e1},
      {data: customers, error: e2},
      {data: orders, error: e3},
      {data: orderItems, error: e4},
      {data: invoices, error: e5},
      {data: stockHistory, error: e6},
      {data: settings, error: e7}
    ] = await Promise.all([
      supabase.from('products').select('*').order('id', {ascending:true}),
      supabase.from('customers').select('*').order('id', {ascending:true}),
      supabase.from('orders').select('*').order('id', {ascending:false}),
      supabase.from('order_items').select('*'),
      supabase.from('invoices').select('*').order('created_at', {ascending:false}),
      supabase.from('stock_history').select('*').order('id', {ascending:false}),
      supabase.from('settings').select('*').single()
    ]);

    console.log(`[Admin] Data loaded in ${Date.now() - fetchStart}ms`);

    // Log any errors but don't crash
    [e1,e2,e3,e4,e5,e6,e7].forEach((err, i) => {
      if (err) console.warn(`[LoadData] Query ${i} error:`, err.message);
    });

    if(orders && orderItems) {
      orders.forEach(o => {
        o.items = (orderItems || []).filter(i => i.order_id === o.id).map(i => ({
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
    _dataLoaded = true;
  } catch (err) {
    console.error('[LoadData] Critical error loading data:', err);
    // Initialize empty cache so DB methods don't crash
    DB._cache = {
      products: [], customers: [], orders: [],
      invoices: [], stockHistory: [], settings: {}
    };
    _dataLoaded = true;
  }
}

const DB = {
  _cache: { products: [], customers: [], orders: [], invoices: [], stockHistory: [], settings: {} },
  products() { return (this._cache.products || []).map(p => ({...p, originalPrice: p.original_price, inStock: p.in_stock, reorderLevel: p.reorder_level})); },
  customers() { return (this._cache.customers || []).map(c => ({...c, totalOrders: c.total_orders, totalSpent: c.total_spent, joinDate: c.join_date})); },
  orders() { return (this._cache.orders || []).map(o => ({...o, customerId: o.customer_id, customerName: o.customer_name, trackingId: o.tracking_id, shippingAddress: o.shipping_address})); },
  invoices() { return (this._cache.invoices || []).map(i => ({...i, orderId: i.order_id, customerName: i.customer_name})); },
  stockHistory() { return (this._cache.stockHistory || []).map(h => ({...h, newStock: h.new_stock, change: h.change_amount})); },
  settings() { return this._cache.settings || {}; },
  nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; },
  async saveSettings(data) {
    const payload = {
      id: 1,
      business_name: data.businessName || data.business_name,
      business_address: data.businessAddress || data.business_address,
      business_phone: data.businessPhone || data.business_phone,
      business_email: data.businessEmail || data.business_email,
      whatsapp_number: data.whatsappNumber || data.whatsapp_number,
      whatsapp_templates: data.whatsappTemplates || data.whatsapp_templates,
      shipping_providers: data.shippingProviders || data.shipping_providers
    };
    const { error } = await supabase.from('settings').upsert(payload);
    if (error) { showToast('Error saving settings', 'error'); console.error(error); }
    else { await loadData(); showToast('Settings saved successfully!'); }
  },
  async saveInvoices(invoices) {
    const payload = invoices.map(inv => ({
      id: inv.id,
      order_id: inv.orderId || inv.order_id,
      customer_name: inv.customerName || inv.customer_name,
      amount: inv.amount,
      status: inv.status,
      date: inv.date
    }));
    const { error } = await supabase.from('invoices').upsert(payload);
    if (error) { showToast('Error saving invoices', 'error'); console.error(error); }
    else await loadData();
  }
};

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="width: 18px; height: 18px;"></i> ${message}`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== SIDEBAR NAVIGATION =====
function initSidebar() {
  const hamburger = document.querySelector('.admin-hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  hamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('active');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  });

  // Mark active link
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (path === href || (path === '/admin' && href === '/admin/index.html') || path === href.replace('.html', '')) {
      link.classList.add('active');
    }
  });

  // Low stock badge (safe: DB._cache is always initialized)
  try {
    const products = DB.products();
    const lowStock = products.filter(p => p.stock <= p.reorderLevel).length;
    const inventoryBadge = document.querySelector('.sidebar-link[href*="inventory"] .badge');
    if (inventoryBadge) inventoryBadge.textContent = lowStock;
    if (inventoryBadge && lowStock === 0) inventoryBadge.style.display = 'none';

    // Pending orders badge
    const orders = DB.orders();
    const pending = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
    const ordersBadge = document.querySelector('.sidebar-link[href*="orders"] .badge');
    if (ordersBadge) ordersBadge.textContent = pending;
    if (ordersBadge && pending === 0) ordersBadge.style.display = 'none';
  } catch (e) {
    console.warn('[Sidebar] Badge count error:', e);
  }
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) showToast('Logout failed', 'error');
  else window.location.href = '/login.html';
}

// ===== MODAL HELPERS =====
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
  document.querySelector('.modal-overlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
  const anyOpen = document.querySelector('.modal.active');
  if (!anyOpen) {
    document.querySelector('.modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.querySelector('.modal-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

// ===== FORMATTING =====
function formatPrice(n) { return `Rs. ${Number(n).toLocaleString()}`; }
function formatDate(d) { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
function statusBadge(status) {
  const map = { pending:'orange', processing:'blue', shipped:'gold', 'in-transit':'blue', delivered:'green', cancelled:'red', paid:'green', unpaid:'orange', draft:'grey' };
  return `<span class="badge badge-${map[status]||'grey'}">${status}</span>`;
}

// ===== WHATSAPP =====
function sendWhatsApp(phone, message) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
}

// ===== INFO & AUTH =====
async function initAdminAuth() {
  const avatarEl = document.getElementById('adminAvatar');
  const nameEl = document.getElementById('adminName');
  const breadcrumbEl = document.querySelector('.topbar-breadcrumb');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const user = session.user;

      // Don't do a blocking second role check — the guard already ran.
      // Just populate the UI with user info.
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      const fullName = user.user_metadata?.full_name || 'Admin';

      if (avatarEl && avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Admin" style="width:100%; height:100%; object-fit:cover;">`;
      }
      if (nameEl) nameEl.textContent = fullName;
      if (breadcrumbEl) breadcrumbEl.textContent = `Welcome back, ${fullName.split(' ')[0]}`;

    } else {
      sessionStorage.setItem('tah_return_url', window.location.href);
      window.location.href = '/login.html';
    }
  } catch (e) {
    console.warn('Admin auth init failed', e);
  }
}

// ===== LOADER DISMISS =====
function dismissLoader() {
  const loader = document.getElementById('adminLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Start auth UI population (non-blocking for admin check — guard handles that)
    initAdminAuth();

    // 2. Load all data FIRST, then init sidebar (which depends on data)
    await loadData();
    initSidebar();

    // 3. Dismiss the loader now that everything is ready
    dismissLoader();

  } catch (e) {
    console.error('[Admin Init] Error during initialization:', e);
    // Always dismiss loader even on error so user isn't stuck
    dismissLoader();
  }
});
