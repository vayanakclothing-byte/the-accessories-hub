/* ============================================================
   THE ACCESSORIES HUB — Global JavaScript
   Navigation, Cart, Popup, Animations
   ============================================================ */

// --- Cart State ---
const Cart = {
  items: JSON.parse(localStorage.getItem('tah_cart') || '[]'),

  save() {
    localStorage.setItem('tah_cart', JSON.stringify(this.items));
    this.updateUI();
  },

  add(product, qty = 1) {
    const existing = this.items.find(i => i.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      this.items.push({ ...product, qty });
    }
    this.save();
    this.showNotification(product.name);
  },

  remove(productId) {
    this.items = this.items.filter(i => i.id !== productId);
    this.save();
  },

  updateQty(productId, qty) {
    const item = this.items.find(i => i.id === productId);
    if (item) {
      item.qty = Math.max(1, qty);
      this.save();
    }
  },

  getTotal() {
    return this.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  },

  getCount() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  },

  updateUI() {
    document.querySelectorAll('.cart-count').forEach(el => {
      const count = this.getCount();
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  showNotification(name) {
    const notif = document.createElement('div');
    notif.className = 'cart-notification';
    notif.innerHTML = `
      <span>✓</span> <strong>${name}</strong> added to cart
    `;
    notif.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: linear-gradient(135deg, #D4AF37, #E8C84A);
      color: #000;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      z-index: 10000;
      animation: fadeInUp 0.3s ease, fadeOut 0.3s ease 2.5s forwards;
      box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }
};

// --- Header Scroll Effect ---
function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
      header.classList.remove('transparent');
    } else {
      header.classList.remove('scrolled');
      if (header.dataset.transparent === 'true') {
        header.classList.add('transparent');
      }
    }
  };

  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
}

// --- Mobile Navigation ---
function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  const overlay = document.querySelector('.nav-overlay');

  if (!hamburger || !mobileNav) return;

  const toggle = () => {
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('open');
    overlay?.classList.toggle('active');
    document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
  };

  hamburger.addEventListener('click', toggle);
  overlay?.addEventListener('click', toggle);

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', toggle);
  });
}

// --- Newsletter Popup ---
function initPopup() {
  const popup = document.querySelector('.popup');
  const popupOverlay = document.querySelector('.popup-overlay');
  const popupClose = document.querySelector('.popup-close');

  if (!popup) return;

  // Check if already dismissed
  if (sessionStorage.getItem('tah_popup_dismissed')) return;

  setTimeout(() => {
    popup.classList.add('active');
    popupOverlay?.classList.add('active');
  }, 5000);

  const close = () => {
    popup.classList.remove('active');
    popupOverlay?.classList.remove('active');
    sessionStorage.setItem('tah_popup_dismissed', 'true');
  };

  popupClose?.addEventListener('click', close);
  popupOverlay?.addEventListener('click', close);

  // Handle form submission
  const form = popup.querySelector('.popup-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    if (input?.value) {
      popup.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">💎</div>
          <h3 style="color: var(--gold); margin-bottom: 0.5rem;">Thank You!</h3>
          <p style="color: var(--white-muted);">Your 10% discount code has been sent to your email.</p>
        </div>
      `;
      setTimeout(close, 3000);
    }
  });
}

// --- Scroll Animations ---
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}

// --- Product Card Rendering ---
function renderProductCard(product) {
  const badgeHTML = product.badge
    ? `<div class="product-badge">${product.badge}</div>`
    : '';

  const priceHTML = product.originalPrice
    ? `<span class="product-card-price">Rs. ${product.price.toLocaleString()} <span class="original">Rs. ${product.originalPrice.toLocaleString()}</span></span>`
    : `<span class="product-card-price">Rs. ${product.price.toLocaleString()}</span>`;

  return `
    <div class="product-card animate-on-scroll" data-id="${product.id}" data-collection="${product.collection}" data-category="${product.category}" data-price="${product.price}">
      <div class="product-card-image">
        ${badgeHTML}
        <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder.png'; this.style.objectFit='contain';">
        <div class="product-card-overlay">
          <button class="quick-view-btn" onclick="openQuickView(${product.id})">Quick View</button>
        </div>
      </div>
      <div class="product-card-info">
        <div class="product-card-collection">${product.collection} Collection</div>
        <h3 class="product-card-name">${product.name}</h3>
        ${priceHTML}
      </div>
    </div>
  `;
}

// --- Quick View Modal ---
let allProducts = [];

async function loadProducts() {
  try {
    const cacheKey = 'tah_products_cache';
    const cacheTimeKey = 'tah_products_cache_time';
    const cacheExp = 5 * 60 * 1000; // 5 minutes

    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);

    // If cache is valid and NOT empty, return it instantly
    if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime)) < cacheExp) {
      const parsed = JSON.parse(cachedData);
      if (parsed && parsed.length > 0) {
        allProducts = parsed;
        return allProducts;
      }
    }

    // Otherwise, fetch fresh data from Supabase
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
    if (error) throw error;
    
    allProducts = data;
    
    // Save to cache for subsequent page loads
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch(e) {
      console.warn("Could not cache products:", e);
    }
    
    return allProducts;
  } catch (err) {
    console.error('Failed to load products:', err);
    return [];
  }
}

function openQuickView(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('quickViewModal');
  if (!modal) return;

  const featuresHTML = product.features
    ? product.features.map(f => `<span style="display:inline-block;padding:4px 12px;border:1px solid var(--gold);border-radius:20px;font-size:0.75rem;color:var(--gold);margin-right:6px;margin-bottom:6px;">${f}</span>`).join('')
    : '';

  modal.querySelector('.quick-view-image').innerHTML = `<img src="${product.image}" alt="${product.name}" onerror="this.onerror=null; this.src='images/placeholder.png';">`;
  modal.querySelector('.quick-view-details').innerHTML = `
    <span style="font-size:0.75rem;color:var(--white-muted);text-transform:uppercase;letter-spacing:1.5px;">${product.collection} Collection</span>
    <h3>${product.name}</h3>
    <div class="price">Rs. ${product.price.toLocaleString()}${product.originalPrice ? `<span style="font-size:0.9rem;color:var(--white-muted);text-decoration:line-through;margin-left:10px;font-weight:400;">Rs. ${product.originalPrice.toLocaleString()}</span>` : ''}</div>
    <p class="description">${product.description}</p>
    <div>${featuresHTML}</div>
    <div style="display:flex;gap:10px;margin-top:auto;flex-wrap:wrap;">
      <button style="flex:1;padding:14px 20px;background:transparent;border:2px solid #D4AF37;color:#D4AF37;font-weight:700;font-size:0.85rem;letter-spacing:1.5px;text-transform:uppercase;border-radius:6px;cursor:pointer;" onclick="Cart.add({id:${product.id},name:'${product.name.replace(/'/g, "\\'")}',price:${product.price},image:'${product.image}'}); closeQuickView();">ADD TO CART</button>
      <button style="flex:1;padding:14px 20px;background:linear-gradient(135deg,#D4AF37,#E8C84A);color:#000;border:none;font-weight:800;font-size:0.85rem;letter-spacing:1.5px;text-transform:uppercase;border-radius:6px;cursor:pointer;box-shadow:0 0 15px rgba(212,175,55,0.4);" onclick="Cart.add({id:${product.id},name:'${product.name.replace(/'/g, "\\'")}',price:${product.price},image:'${product.image}'}); closeQuickView(); window.location.href='checkout.html';">BUY NOW</button>
    </div>
    <a href="product-detail.html?id=${product.id}" style="display:block;text-align:center;margin-top:8px;color:var(--white-muted);font-size:0.85rem;text-decoration:underline;">View Full Details →</a>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeQuickView() {
  const modal = document.getElementById('quickViewModal');
  modal?.classList.remove('active');
  document.body.style.overflow = '';
}

// --- Fade animation keyframes (added dynamically) ---
const fadeStyle = document.createElement('style');
fadeStyle.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(10px); }
  }
`;
document.head.appendChild(fadeStyle);

// --- Auth Status Header ---
async function initAuthStatus() {
  const userBtn = document.getElementById('navUserBtn');
  if (!userBtn) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const adminEmail = 'theaccessorieshub2530@gmail.com';
      const isAuthAdmin = session.user.email === adminEmail;
      
      if (isAuthAdmin) {
        // Change icon and add badge
        userBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-shield-check">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span style="position:absolute; top:-5px; right:-5px; width:10px; height:10px; background:var(--gold); border-radius:50%; box-shadow:0 0 5px var(--gold);"></span>
        `;
        userBtn.title = 'Admin Dashboard';
        userBtn.onclick = (e) => {
          e.preventDefault();
          window.location.href = '/admin/index.html';
        };
      } else {
        // Logged in user but not admin
        userBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-user">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        `;
        userBtn.title = 'My Account';
      }
    }
  } catch (e) {
    console.warn('Auth status check failed', e);
  }
}

// --- Initialize Everything ---
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileNav();
  initPopup();
  initScrollAnimations();
  initAuthStatus();
  Cart.updateUI();
});
