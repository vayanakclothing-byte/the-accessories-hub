/* ============================================================
   THE ACCESSORIES HUB — Enterprise Jewellery ERP Shared App
   Universal Navigation, High-Performance Cached Data Layer & Modals
   ============================================================ */

// ===== GLOBAL ERROR BOUNDARY =====
window.addEventListener('error', function (e) {
  console.error('[ERP Admin] Uncaught error:', e.error || e.message);
  document.documentElement.style.visibility = 'visible';
  dismissLoader();
});

window.addEventListener('unhandledrejection', function (e) {
  console.error('[ERP Admin] Unhandled promise rejection:', e.reason);
  document.documentElement.style.visibility = 'visible';
  dismissLoader();
});

// ===== CACHED DATA LAYER WITH STALE-WHILE-REVALIDATE =====
const CACHE_KEY = 'tah_erp_data_v2';
const CACHE_TTL_MS = 90000; // 90 seconds local cache
let _loadDataPromise = null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

function normalizeToYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr !== 'string') dateStr = String(dateStr);
  if (dateStr.includes('-')) return dateStr.split('T')[0];
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (_) {}
  return dateStr;
}

function assetUrl(path) {
  const value = String(path || '');
  if (!value) return '/images/placeholder.webp';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) return value;
  return '/' + value;
}

// ===== DATABASE ACCESS LAYER =====
const DB = {
  _cache: {
    products: [], categories: [], orders: [], orderItems: [],
    invoices: [], stockHistory: [], customers: [], suppliers: [],
    purchaseOrders: [], expenses: [], shipments: [], returnsRefunds: [],
    coupons: [], auditLogs: [], notifications: [], reviews: [],
    profiles: [], settings: {}
  },
  _loadedModules: new Set(['core']),

  initFromStorage() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
          this._cache = Object.assign(this._cache, parsed.data);
          this._loadedModules = new Set(parsed.modules || ['core']);
          return true;
        }
      }
    } catch (e) {
      console.warn('[ERP Data] Failed to read session cache:', e);
    }
    return false;
  },

  saveToStorage() {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: this._cache,
        modules: Array.from(this._loadedModules)
      }));
    } catch (e) {
      console.warn('[ERP Data] Storage quota warning:', e);
    }
  },

  invalidate(modules = null) {
    if (!modules) {
      sessionStorage.removeItem(CACHE_KEY);
      this._loadedModules.clear();
    } else {
      (Array.isArray(modules) ? modules : [modules]).forEach(m => this._loadedModules.delete(m));
      this.saveToStorage();
    }
  },

  async reload(module = null) {
    this.invalidate(module);
    return loadData(true);
  },

  // Core Models
  products() {
    return (this._cache.products || []).map(p => {
      const stock = Number(p.stock) || 0;
      const reserved = Number(p.reserved_stock) || 0;
      const available = Math.max(0, stock - reserved);
      return {
        ...p,
        image: assetUrl(p.image),
        images: Array.isArray(p.images) && p.images.length ? p.images.map(assetUrl) : [assetUrl(p.image)],
        originalPrice: p.original_price,
        costPrice: Number(p.cost_price) || 0,
        inStock: p.in_stock !== false && stock > 0,
        isArchived: !!p.is_archived,
        reorderLevel: p.reorder_level || 5,
        stock,
        reservedStock: reserved,
        availableStock: available,
        color: p.color || '',
        audience: p.audience || 'unisex',
        location: p.location || 'Main Warehouse',
        variants: Array.isArray(p.variants) ? p.variants : []
      };
    });
  },

  categories() {
    const cats = this._cache.categories || [];
    if (cats.length > 0) return cats;
    return [
      { id: 'rings', name: 'Rings', slug: 'rings', description: 'Handcrafted luxury rings.', is_active: true, sort_order: 1 },
      { id: 'bracelets', name: 'Bracelets', slug: 'bracelets', description: 'Refined bangles & cuffs.', is_active: true, sort_order: 2 },
      { id: 'earrings', name: 'Earrings', slug: 'earrings', description: 'Dainty & statement earrings.', is_active: true, sort_order: 3 },
      { id: 'necklaces', name: 'Necklaces', slug: 'necklaces', description: 'Pendants & temple chokers.', is_active: true, sort_order: 4 }
    ];
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

  customers() {
    return (this._cache.customers || []).map(c => ({
      ...c,
      totalOrders: Number(c.total_orders) || 0,
      totalSpent: Number(c.total_spent) || 0,
      joinDate: c.join_date ? normalizeToYYYYMMDD(c.join_date) : '—'
    }));
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
      return {
        ...h,
        product: h.product || h.product_name || 'Item',
        productName: h.product_name || h.product || 'Item',
        date: rawDate ? normalizeToYYYYMMDD(rawDate) : '—',
        newStock: Number(h.new_stock) || 0,
        change: Number(h.change_amount) || 0,
        reason: h.reason || h.type || 'Adjustment'
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
      shippingProviders: s.shipping_providers || s.shippingProviders || [],
      currencySymbol: s.currency_symbol || s.currencySymbol || 'Rs.',
      currencyCode: s.currency_code || s.currencyCode || 'NPR',
      taxRate: s.tax_rate !== undefined ? s.tax_rate : 13,
      lowStockLimit: s.low_stock_limit || 5
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
      console.warn('[AuditLog] Non-blocking audit error:', e);
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
      this.invalidate('settings');
      await loadData(true);
      await this.logAudit('UPDATE_SETTINGS', 'settings', '1', 'Updated store configuration');
      showToast('Settings saved successfully!');
    }
  }
};

// Initialize cache from session storage immediately on script evaluation
DB.initFromStorage();

// ===== HIGH-PERFORMANCE DATA FETCHING =====
async function loadData(force = false) {
  if (!force && _loadDataPromise) return _loadDataPromise;
  if (!force && DB._loadedModules.has('core') && DB._cache.products.length > 0) {
    return Promise.resolve();
  }

  _loadDataPromise = (async () => {
    const fetchStart = Date.now();
    try {
      // Parallel fetch of core essentials (fast, non-blocking)
      const [
        { data: products },
        { data: categories },
        { data: orders },
        { data: orderItems },
        { data: settings },
        { data: notifications }
      ] = await Promise.all([
        supabase.from('products').select('*').order('id', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('orders').select('*').order('id', { ascending: false }).limit(200),
        supabase.from('order_items').select('*').limit(500),
        supabase.from('settings').select('*').single(),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
      ]);

      // Link order items to orders
      if (orders) {
        orders.forEach(o => {
          o.items = (orderItems || []).filter(i => i.order_id === o.id).map(i => ({
            productId: i.product_id, name: i.name, price: i.price, qty: i.qty, image: i.image
          }));
        });
      }

      DB._cache.products = products || DB._cache.products || [];
      if (categories && categories.length) DB._cache.categories = categories;
      DB._cache.orders = orders || DB._cache.orders || [];
      DB._cache.orderItems = orderItems || DB._cache.orderItems || [];
      if (settings) DB._cache.settings = settings;
      DB._cache.notifications = notifications || DB._cache.notifications || [];
      DB._loadedModules.add('core');

      DB.saveToStorage();
      console.log(`[ERP Admin] Core data loaded in ${Date.now() - fetchStart}ms (${DB._cache.products.length} products)`);

      // Trigger lazy background load for secondary tables
      lazyLoadSecondaryModules();

    } catch (err) {
      console.error('[ERP Admin] Error loading core data:', err);
    } finally {
      _loadDataPromise = null;
    }
  })();

  return _loadDataPromise;
}

// Background lazy loader for secondary modules so they never block page rendering
async function lazyLoadSecondaryModules() {
  if (DB._loadedModules.has('secondary')) return;
  try {
    const [
      { data: stockHistory },
      { data: customers },
      { data: suppliers },
      { data: purchaseOrders },
      { data: expenses },
      { data: shipments },
      { data: returnsRefunds },
      { data: coupons },
      { data: reviews },
      { data: profiles },
      { data: invoices },
      { data: auditLogs }
    ] = await Promise.all([
      supabase.from('stock_history').select('*').order('id', { ascending: false }).limit(150),
      supabase.from('customers').select('*').order('id', { ascending: false }).limit(200),
      supabase.from('suppliers').select('*').order('id', { ascending: true }),
      supabase.from('purchase_orders').select('*, purchase_order_items(*)').order('id', { ascending: false }).limit(50),
      supabase.from('expenses').select('*').order('date', { ascending: false }).limit(100),
      supabase.from('shipments').select('*').order('id', { ascending: false }).limit(50),
      supabase.from('returns_refunds').select('*').order('id', { ascending: false }).limit(50),
      supabase.from('coupons').select('*').order('id', { ascending: false }),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    if (stockHistory) DB._cache.stockHistory = stockHistory;
    if (customers) DB._cache.customers = customers;
    if (suppliers) DB._cache.suppliers = suppliers;
    if (purchaseOrders) DB._cache.purchaseOrders = purchaseOrders;
    if (expenses) DB._cache.expenses = expenses;
    if (shipments) DB._cache.shipments = shipments;
    if (returnsRefunds) DB._cache.returnsRefunds = returnsRefunds;
    if (coupons) DB._cache.coupons = coupons;
    if (reviews) DB._cache.reviews = reviews;
    if (profiles) DB._cache.profiles = profiles;
    if (invoices) DB._cache.invoices = invoices;
    if (auditLogs) DB._cache.auditLogs = auditLogs;

    DB._loadedModules.add('secondary');
    DB.saveToStorage();
    // Update sidebar badges if counts changed
    updateSidebarBadges();
  } catch (err) {
    console.warn('[ERP Admin] Secondary modules background sync warning:', err);
  }
}

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

  const navGroups = [
    {
      title: 'Core Operations',
      links: [
        { href: '/admin/index.html', label: 'Overview', icon: 'layout-dashboard' },
        { href: '/admin/products.html', label: 'Products & Catalogue', icon: 'gem' },
        { href: '/admin/categories.html', label: 'Categories & Collections', icon: 'folder-tree' },
        { href: '/admin/inventory.html', label: 'Inventory & Stock Ledger', icon: 'package', id: 'badge-inventory', badgeClass: 'badge-orange' },
        { href: '/admin/orders.html', label: 'Orders & Fulfilment', icon: 'shopping-bag', id: 'badge-orders', badgeClass: 'badge-blue' },
        { href: '/admin/shipping.html', label: 'Shipping & Delivery', icon: 'truck' },
        { href: '/admin/returns.html', label: 'Returns & Refunds', icon: 'rotate-ccw', id: 'badge-returns', badgeClass: 'badge-red' }
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
        { href: '/admin/notifications.html', label: 'Notifications & Tasks', icon: 'bell', id: 'badge-notifs', badgeClass: 'badge-gold' },
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
      const badgeIdAttr = link.id ? `id="${link.id}"` : '';
      navHtml += `
        <a href="${link.href}" class="sidebar-link ${isExact ? 'active' : ''}">
          <span class="link-icon"><i data-lucide="${link.icon}" style="width: 17px; height: 17px;"></i></span>
          <span class="link-text">${link.label}</span>
          <span class="badge ${link.badgeClass || ''}" ${badgeIdAttr} style="display:none;"></span>
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

  updateSidebarBadges();
  if (window.lucide) lucide.createIcons();
}

function updateSidebarBadges() {
  try {
    const products = DB.products();
    const lowStock = products.filter(p => p.stock <= p.reorderLevel).length;
    const orders = DB.orders();
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
    const returns = DB.returnsRefunds();
    const pendingReturns = returns.filter(r => r.status === 'requested').length;
    const notifs = DB.notifications();
    const unreadNotifs = notifs.filter(n => !n.is_read).length;

    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (count > 0) {
        el.textContent = count;
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    };

    setBadge('badge-inventory', lowStock);
    setBadge('badge-orders', pendingOrders);
    setBadge('badge-returns', pendingReturns);
    setBadge('badge-notifs', unreadNotifs);

    // Update topbar bell dot
    const bellDot = document.querySelector('#topbarNotifBtn .dot');
    if (bellDot) bellDot.style.display = unreadNotifs > 0 ? 'block' : 'none';
  } catch (_) {}
}

async function handleLogout() {
  sessionStorage.removeItem('tah_admin_role');
  sessionStorage.removeItem(CACHE_KEY);
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

  if (!document.getElementById('topbarNotifBtn')) {
    const notifBtn = document.createElement('a');
    notifBtn.id = 'topbarNotifBtn';
    notifBtn.href = '/admin/notifications.html';
    notifBtn.className = 'topbar-btn';
    notifBtn.title = 'Notifications & Tasks';
    notifBtn.innerHTML = `
      <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
      <span class="dot" style="${unreadCount > 0 ? 'display:block;' : 'display:none;'}"></span>
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
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin';

      if (avatarEl && avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Admin" style="width:100%; height:100%; object-fit:cover;">`;
      }
      if (nameEl) nameEl.textContent = fullName;
      if (breadcrumbEl && breadcrumbEl.textContent.includes('Welcome back')) {
        breadcrumbEl.textContent = `Welcome back, ${fullName.split(' ')[0]}`;
      }
    }
  } catch (e) {
    console.warn('[Admin] Auth info warning:', e);
  }
}

// ===== LOADER DISMISS =====
function dismissLoader() {
  const loader = document.getElementById('adminLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 250);
  }
}

// ===== AUTO-BOOTSTRAP =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // If cache is ready, initialize sidebar immediately for instant layout
    initSidebar();
    initTopBar();
    initAdminAuth();

    // Load/revalidate data
    await loadData();
    updateSidebarBadges();
    dismissLoader();
  } catch (e) {
    console.error('[ERP Admin] Bootstrap error:', e);
    dismissLoader();
  }
});

// Fallback safety timeout for loader
setTimeout(dismissLoader, 1500);
