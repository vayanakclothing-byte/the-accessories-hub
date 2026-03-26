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
  nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; }
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
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
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
  const ordersBadge = document.querySelector('.sidebar-link[href="orders.html"] .badge');
  if (ordersBadge) ordersBadge.textContent = pending;
  if (ordersBadge && pending === 0) ordersBadge.style.display = 'none';
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  
  initSidebar();
});
