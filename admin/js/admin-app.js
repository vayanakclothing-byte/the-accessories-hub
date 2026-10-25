/* ============================================================
   THE ACCESSORIES HUB — Enterprise Jewellery ERP Shared App
   Universal Navigation, Supabase ERP Data Layer, Audit & Helpers
   ============================================================ */

// ===== GLOBAL ERROR BOUNDARY =====
window.addEventListener('error', function (e) {
  console.error('[ERP Admin] Uncaught error:', e.error || e.message);
  document.documentElement.style.visibility = 'visible';
  const loader = document.getElementById('adminLoader');
  if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
});

window.addEventListener('unhandledrejection', function (e) {
  console.error('[ERP Admin] Unhandled promise rejection:', e.reason);
  document.documentElement.style.visibility = 'visible';
  const loader = document.getElementById('adminLoader');
  if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
});

// ===== DATA CACHE & HELPERS =====
let _dataLoaded = false;
let _lastDataLoad = 0;
const DATA_CACHE_EXPIRY = 60000; // 1 minute session cache

async function loadData(force = false) {
  if (_dataLoaded && !force && (Date.now() - _lastDataLoad < DATA_CACHE_EXPIRY)) {
    return;
  }

  try {
    const fetchStart = Date.now();
    const [
      { data: products, error: e1 },
      { data: customers, error: e2 },
      { data: orders, error: e3 },
      { data: orderItems, error: e4 },
      { data: invoices, error: e5 },
      { data: stockHistory, error: e6 },
      { data: settings, error: e7 },
      { data: categories, error: e8 },
      { data: suppliers, error: e9 },
      { data: purchaseOrders, error: e10 },
      { data: expenses, error: e11 },
      { data: shipments, error: e12 },
      { data: returnsRefunds, error: e13 },
      { data: coupons, error: e14 },
      { data: auditLogs, error: e15 },
      { data: notifications, error: e16 },
      { data: reviews, error: e17 },
      { data: profiles, error: e18 }
    ] = await Promise.all([
      supabase.from('products').select('*').order('id', { ascending: true }),
      supabase.from('customers').select('*').order('id', { ascending: true }),
      supabase.from('orders').select('*').order('id', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_history').select('*').order('id', { ascending: false }),
      supabase.from('settings').select('*').single(),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('suppliers').select('*').order('id', { ascending: true }),
      supabase.from('purchase_orders').select('*, purchase_order_items(*)').order('id', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('shipments').select('*').order('id', { ascending: false }),
      supabase.from('returns_refunds').select('*').order('id', { ascending: false }),
      supabase.from('coupons').select('*').order('id', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false })
    ]);

    console.log(`[ERP Admin] Data loaded in ${Date.now() - fetchStart}ms`);

    // Link order items to orders
    if (orders) {
      orders.forEach(o => {
        o.items = (orderItems || []).filter(i => i.order_id === o.id).map(i => ({
          productId: i.product_id, name: i.name, price: i.price, qty: i.qty, image: i.image
        }));
      });
    }

    DB._cache = {
      products: products || [],
      categories: (categories && categories.length > 0) ? categories : [
        { id: 'c1', name: 'Rings', slug: 'rings', description: 'Handcrafted luxury rings.', is_active: true, sort_order: 1 },
        { id: 'c2', name: 'Bracelets', slug: 'bracelets', description: 'Refined bangles & cuffs.', is_active: true, sort_order: 2 },
        { id: 'c3', name: 'Earrings', slug: 'earrings', description: 'Dainty & statement earrings.', is_active: true, sort_order: 3 },
        { id: 'c4', name: 'Necklaces', slug: 'necklaces', description: 'Pendants & temple chokers.', is_active: true, sort_order: 4 }
      ],
      customers: customers || [],
      orders: orders || [],
      invoices: invoices || [],
      stockHistory: stockHistory || [],
      suppliers: suppliers || [],
      purchaseOrders: purchaseOrders || [],
      expenses: expenses || [],
      shipments: shipments || [],
      returnsRefunds: returnsRefunds || [],
      coupons: coupons || [],
      auditLogs: auditLogs || [],
      notifications: notifications || [],
      reviews: reviews || [],
      profiles: profiles || [],
      settings: (settings && Object.keys(settings).length > 0) ? settings : {
        business_name: "The Accessories Hub",
        currency: "NPR",
        tax_rate: 0,
        whatsapp_templates: {
          orderConfirm: "Hello {name}! 🎉 Your order #{orderId} has been confirmed. Total: Rs. {total}. Thank you for shopping with The Accessories Hub! 💎",
          shipped: "Hi {name}! 📦 Great news! Your order #{orderId} has been shipped. Tracking: {tracking}. Expected delivery: 3-5 days.",
          delivered: "Hello {name}! ✅ Your order #{orderId} has been delivered! We hope you love your purchase. Leave us a review! 💛"
        },
        shipping_providers: [
          { name: "Nepal Post", type: "standard", rate: 150, freeAbove: 2000 },
          { name: "Pathao Courier", type: "express", rate: 250, freeAbove: 3000 }
        ]
      }
    };
    _dataLoaded = true;
    _lastDataLoad = Date.now();
  } catch (err) {
    console.error('[ERP Admin] Error loading data:', err);
    DB._cache = DB._cache || {
      products: [], customers: [], orders: [], invoices: [],
      stockHistory: [], suppliers: [], purchaseOrders: [], expenses: [],
      shipments: [], returnsRefunds: [], coupons: [], auditLogs: [],
      notifications: [], reviews: [], profiles: [], settings: {}
    };
    _dataLoaded = true;
  }
}

function normalizeToYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr !== 'string') dateStr = String(dateStr);
  if (dateStr.includes('-')) {
    return dateStr.split('T')[0];
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (e) {}
  return dateStr;
}

function assetUrl(path) {
  const value = String(path || '');
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) return value;
  return '/' + value;
}

// ===== DATABASE ACCESS LAYER =====
const DB = {
  _cache: {
    products: [], customers: [], orders: [], invoices: [],
    stockHistory: [], categories: [], suppliers: [], purchaseOrders: [],
    expenses: [], shipments: [], returnsRefunds: [], coupons: [],
    auditLogs: [], notifications: [], reviews: [], profiles: [], settings: {}
  },
  async reload() { return loadData(true); },
  
  products() {
    return (this._cache.products || []).map(p => ({
      ...p,
      image: assetUrl(p.image),
      images: Array.isArray(p.images) ? p.images.map(assetUrl) : [],
      originalPrice: p.original_price,
      costPrice: Number(p.cost_price) || 0,
      inStock: p.in_stock,
      reorderLevel: p.reorder_level || 5
    }));
  },
  categories() { return this._cache.categories || []; },
  customers() {
    return (this._cache.customers || []).map(c => ({
      ...c,
      totalOrders: Number(c.total_orders) || 0,
      totalSpent: Number(c.total_spent) || 0,
      joinDate: c.join_date ? normalizeToYYYYMMDD(c.join_date) : '—'
    }));
  },
  orders() {
    return (this._cache.orders || []).map(o => {
      const rawDate = o.date || o.created_at;
      return {
        ...o,
        date: normalizeToYYYYMMDD(rawDate),
        status: String(o.status || 'pending').toLowerCase(),
        payment: o.payment || o.payment_method || 'cod',
        subtotal: Number(o.subtotal) || 0,
        shipping: Number(o.shipping) || 0,
        discountAmount: Number(o.discount_amount) || 0,
        total: Number(o.total) || 0,
        customerId: o.customer_id,
        customerName: o.customer_name,
        trackingId: o.tracking_id,
        shippingAddress: o.shipping_address,
        items: (o.items || []).map(item => ({ ...item, image: assetUrl(item.image) }))
      };
    });
  },
  invoices() {
    return (this._cache.invoices || []).map(i => ({
      ...i,
      date: normalizeToYYYYMMDD(i.date || i.created_at),
      orderId: i.order_id,
      customerName: i.customer_name,
      amount: Number(i.amount) || 0
    }));
  },
  stockHistory() {
    return (this._cache.stockHistory || []).map(h => {
      const rawDate = h.date || h.created_at;
      let formattedDate = rawDate ? normalizeToYYYYMMDD(rawDate) : '—';
      return {
        ...h,
        product: h.product || h.product_name,
        date: formattedDate,
        newStock: h.new_stock,
        change: h.change_amount
      };
    });
  },
  suppliers() { return this._cache.suppliers || []; },
  purchaseOrders() {
    return (this._cache.purchaseOrders || []).map(po => ({
      ...po,
      orderDate: normalizeToYYYYMMDD(po.order_date || po.created_at),
      expectedDate: po.expected_date ? normalizeToYYYYMMDD(po.expected_date) : '—',
      total: Number(po.total) || 0,
      subtotal: Number(po.subtotal) || 0,
      tax: Number(po.tax) || 0,
      shipping: Number(po.shipping) || 0,
      items: po.purchase_order_items || po.items || []
    }));
  },
  expenses() {
    return (this._cache.expenses || []).map(e => ({
      ...e,
      date: normalizeToYYYYMMDD(e.date || e.created_at),
      amount: Number(e.amount) || 0
    }));
  },
  shipments() {
    return (this._cache.shipments || []).map(s => ({
      ...s,
      shippingCost: Number(s.shipping_cost) || 0,
      dispatchedAt: s.dispatched_at ? normalizeToYYYYMMDD(s.dispatched_at) : '—',
      deliveredAt: s.delivered_at ? normalizeToYYYYMMDD(s.delivered_at) : '—'
    }));
  },
  returnsRefunds() {
    return (this._cache.returnsRefunds || []).map(r => ({
      ...r,
      refundAmount: Number(r.refund_amount) || 0,
      date: normalizeToYYYYMMDD(r.created_at)
    }));
  },
  coupons() {
    return (this._cache.coupons || []).map(c => ({
      ...c,
      discountValue: Number(c.discount_value) || 0,
      minOrderAmount: Number(c.min_order_amount) || 0,
      maxDiscount: Number(c.max_discount) || 0,
      timesUsed: Number(c.times_used) || 0
    }));
  },
  auditLogs() {
    return (this._cache.auditLogs || []).map(l => ({
      ...l,
      date: l.created_at ? new Date(l.created_at).toLocaleString() : '—'
    }));
  },
  notifications() {
    return (this._cache.notifications || []).map(n => ({
      ...n,
      date: n.created_at ? new Date(n.created_at).toLocaleString() : '—'
    }));
  },
  reviews() {
    return (this._cache.reviews || []).map(r => ({
      ...r,
      date: r.created_at ? normalizeToYYYYMMDD(r.created_at) : '—'
    }));
  },
  profiles() {
    return (this._cache.profiles || []).map(p => ({
      ...p,
      date: p.created_at ? normalizeToYYYYMMDD(p.created_at) : '—'
    }));
  },
  settings() {
    const s = this._cache.settings || {};
    return {
      ...s,
      businessName: s.business_name || s.businessName || 'The Accessories Hub',
      businessAddress: s.business_address || s.businessAddress || 'Birgunj, Nepal',
      businessPhone: s.business_phone || s.businessPhone || '+977 9805659501',
      businessEmail: s.business_email || s.businessEmail || 'theaccessorieshub2530@gmail.com',
      whatsappNumber: s.whatsapp_number || s.whatsappNumber || '9805659501',
      whatsappTemplates: s.whatsapp_templates || s.whatsappTemplates || {},
      shippingProviders: s.shipping_providers || s.shippingProviders || []
    };
  },

  async logAudit(action, entityType, entityId, details) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      await supabase.from('audit_logs').insert([{
        user_id: user?.id || null,
        user_email: user?.email || 'admin',
        action,
        entity_type: entityType,
        entity_id: String(entityId || ''),
        details: String(details || '')
      }]);
    } catch (e) {
      console.warn('[AuditLog] Non-blocking audit log error:', e);
    }
  },

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
    if (error) {
      showToast('Error saving settings: ' + error.message, 'error');
    } else {
      await loadData(true);
      await this.logAudit('UPDATE_SETTINGS', 'settings', '1', 'Updated store configuration');
      showToast('Settings saved successfully!');
    }
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
  toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="width: 18px; height: 18px;"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== UNIVERSAL 20-MODULE ERP SIDEBAR =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const currentPath = window.location.pathname;

  // Calculate live badge alerts from loaded data
  let lowStockCount = 0;
  let pendingOrdersCount = 0;
  let pendingReturnsCount = 0;
  let unreadNotifsCount = 0;

  try {
    const products = DB.products();
    lowStockCount = products.filter(p => p.stock <= p.reorderLevel).length;
    const orders = DB.orders();
    pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
    const returns = DB.returnsRefunds();
    pendingReturnsCount = returns.filter(r => r.status === 'requested').length;
    const notifs = DB.notifications();
    unreadNotifsCount = notifs.filter(n => !n.is_read).length;
  } catch (_) {}

  const navGroups = [
    {
      title: 'Core Operations',
      links: [
        { href: '/admin/index.html', label: 'Overview', icon: 'layout-dashboard' },
        { href: '/admin/products.html', label: 'Products & Catalogue', icon: 'gem' },
        { href: '/admin/categories.html', label: 'Categories & Collections', icon: 'folder-tree' },
        { href: '/admin/inventory.html', label: 'Inventory & Stock Ledger', icon: 'package', badge: lowStockCount, badgeClass: 'badge-orange' },
        { href: '/admin/orders.html', label: 'Orders & Fulfilment', icon: 'shopping-bag', badge: pendingOrdersCount, badgeClass: 'badge-blue' },
        { href: '/admin/shipping.html', label: 'Shipping & Delivery', icon: 'truck' },
        { href: '/admin/returns.html', label: 'Returns & Refunds', icon: 'rotate-ccw', badge: pendingReturnsCount, badgeClass: 'badge-red' }
      ]
    },
    {
      title: 'Finance & Commerce',
      links: [
        { href: '/admin/invoices.html', label: 'Billing & Invoices', icon: 'receipt' },
        { href: '/admin/sales.html', label: 'Sales & Revenue', icon: 'trending-up' },
        { href: '/admin/expenses.html', label: 'Expenses & Finance', icon: 'credit-card' },
        { href: '/admin/suppliers.html', label: 'Suppliers & Purchasing', icon: 'factory' },
        { href: '/admin/customers.html', label: 'Customers & CRM', icon: 'users' }
      ]
    },
    {
      title: 'Growth & Feedback',
      links: [
        { href: '/admin/marketing.html', label: 'Marketing & Promotions', icon: 'megaphone' },
        { href: '/admin/coupons.html', label: 'Discounts & Coupons', icon: 'tag' },
        { href: '/admin/reviews.html', label: 'Customer Reviews', icon: 'star' },
        { href: '/admin/reports.html', label: 'Reports & Analytics', icon: 'bar-chart-3' }
      ]
    },
    {
      title: 'System & Admin',
      links: [
        { href: '/admin/staff.html', label: 'Staff & Permissions', icon: 'shield-check' },
        { href: '/admin/notifications.html', label: 'Notifications & Tasks', icon: 'bell', badge: unreadNotifsCount, badgeClass: 'badge-gold' },
        { href: '/admin/audit-logs.html', label: 'Security & Audit Logs', icon: 'scroll-text' },
        { href: '/admin/settings.html', label: 'Settings & Config', icon: 'settings' }
      ]
    }
  ];

  let navHtml = '';
  navGroups.forEach(group => {
    navHtml += `<div class="sidebar-section"><div class="sidebar-section-title">${group.title}</div>`;
    group.links.forEach(link => {
      const isExact = currentPath === link.href || (currentPath === '/admin' && link.href === '/admin/index.html') || currentPath === link.href.replace('.html', '');
      const badgeHtml = link.badge && link.badge > 0
        ? `<span class="badge ${link.badgeClass || ''}">${link.badge}</span>`
        : '';
      navHtml += `
        <a href="${link.href}" class="sidebar-link ${isExact ? 'active' : ''}">
          <span class="link-icon"><i data-lucide="${link.icon}" style="width: 17px; height: 17px;"></i></span>
          <span class="link-text">${link.label}</span>
          ${badgeHtml}
        </a>
      `;
    });
    navHtml += `</div>`;
  });

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <span class="icon"><i data-lucide="gem" style="color: var(--gold); width: 22px; height: 22px;"></i></span>
      <div>
        <span class="brand">The Accessories Hub</span>
        <span class="sub">Jewellery ERP System</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${navHtml}
    </nav>
    <div class="sidebar-footer">
      <a href="/" target="_blank"><i data-lucide="globe" style="width: 16px; height: 16px; margin-right: 8px;"></i> View Storefront</a>
      <a href="#" onclick="handleLogout()" style="margin-top: 6px; color: var(--red);"><i data-lucide="log-out" style="width: 16px; height: 16px; margin-right: 8px;"></i> Logout</a>
    </div>
  `;

  // Hamburger and mobile overlay binding
  const hamburger = document.querySelector('.admin-hamburger');
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  if (window.lucide) lucide.createIcons();
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) showToast('Logout failed', 'error');
  else window.location.href = '/admin/login.html';
}

// ===== TOPBAR & GLOBAL SEARCH =====
function initTopBar() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  const notifs = DB.notifications ? DB.notifications() : [];
  const unreadCount = notifs.filter(n => !n.is_read).length;

  // Insert notification bell if not present
  if (!document.getElementById('topbarNotifBtn')) {
    const notifBtn = document.createElement('a');
    notifBtn.id = 'topbarNotifBtn';
    notifBtn.href = '/admin/notifications.html';
    notifBtn.className = 'topbar-btn';
    notifBtn.title = 'Notifications & Tasks';
    notifBtn.innerHTML = `
      <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
      ${unreadCount > 0 ? '<span class="dot"></span>' : ''}
    `;
    topbarRight.insertBefore(notifBtn, topbarRight.firstChild);
  }

  if (window.lucide) lucide.createIcons();
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

// ===== FORMATTING & HELPERS =====
function formatPrice(n) { return `Rs. ${Number(n || 0).toLocaleString()}`; }
function formatDate(d) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status) {
  const key = String(status || '').toLowerCase();
  const map = {
    pending: 'orange', processing: 'blue', shipped: 'gold', 'in-transit': 'blue',
    delivered: 'green', cancelled: 'red', paid: 'green', unpaid: 'orange',
    draft: 'grey', approved: 'blue', received: 'green', requested: 'orange',
    refunded: 'purple', restocked: 'green', rejected: 'red'
  };
  return `<span class="badge badge-${map[key] || 'grey'}">${escapeHtml(key || 'unknown')}</span>`;
}

function sendWhatsApp(phone, message) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
}

// ===== CSV EXPORT UTILITY =====
function exportTableToCSV(filename, rows, headers) {
  if (!rows || !rows.length) {
    showToast('No records available to export', 'info');
    return;
  }
  const keys = Object.keys(headers);
  const headerLabels = keys.map(k => `"${headers[k].replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(r => {
    return keys.map(k => {
      let val = r[k] == null ? '' : String(r[k]);
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent([headerLabels, ...rowLines].join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : filename + '.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast(`Exported ${rows.length} records to ${filename}`);
}

// ===== ADMIN AUTH & PROFILE =====
async function initAdminAuth() {
  const avatarEl = document.getElementById('adminAvatar');
  const nameEl = document.getElementById('adminName');
  const breadcrumbEl = document.querySelector('.topbar-breadcrumb');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const user = session.user;
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      const fullName = user.user_metadata?.full_name || 'Admin';

      if (avatarEl && avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Admin" style="width:100%; height:100%; object-fit:cover;">`;
      }
      if (nameEl) nameEl.textContent = fullName;
      if (breadcrumbEl && breadcrumbEl.textContent.includes('Welcome back')) {
        breadcrumbEl.textContent = `Welcome back, ${fullName.split(' ')[0]}`;
      }
    }
  } catch (e) {
    console.warn('[Admin] Auth info population warning:', e);
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
    initAdminAuth();
    await loadData();
    initSidebar();
    initTopBar();
    dismissLoader();
  } catch (e) {
    console.error('[ERP Admin] Init error:', e);
    dismissLoader();
  }
});

setTimeout(() => {
  const loader = document.getElementById('adminLoader');
  if (loader && loader.style.display !== 'none') {
    dismissLoader();
  }
}, 4000);
