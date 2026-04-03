/* ============================================================
   THE ACCESSORIES HUB — Admin Shared JavaScript
   Seed data, sidebar, toasts, helpers
   ============================================================ */

// ===== SEED DATA =====
// ===== DATA HELPERS =====

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
    // Usually we only save the latest one, but upserting the whole array is safer if needed.
    // However, Supabase upsert handles array of objects.
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

  // Low stock badge
  const products = DB.products();
  const lowStock = products.filter(p => p.stock <= p.reorderLevel).length;
  const inventoryBadge = document.querySelector('.sidebar-link[href="inventory.html"] .badge');
  if (inventoryBadge) inventoryBadge.textContent = lowStock;
  if (inventoryBadge && lowStock === 0) inventoryBadge.style.display = 'none';

  // Pending orders badge
  const orders = DB.orders();
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  // Match both 'orders.html' and 'Sales' text
  const ordersBadge = document.querySelector('.sidebar-link[href*="orders.html"] .badge');
  if (ordersBadge) ordersBadge.textContent = pending;
  if (ordersBadge && pending === 0) ordersBadge.style.display = 'none';
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

      // Verify admin role from profiles table (secondary check — guard already ran)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || !profile || profile.role !== 'admin') {
        // Guard should have caught this, but just in case
        const params = new URLSearchParams({ uid: user.id, email: user.email });
        window.location.href = '/request-access.html?' + params.toString();
        return;
      }

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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
  initSidebar();
});
