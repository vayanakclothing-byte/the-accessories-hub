/* ============================================================
   THE ACCESSORIES HUB — Unified Shop All Catalogue Engine
   Multi-faceted filters, deduplication, sorting, pagination
   ============================================================ */

(function() {
  'use strict';

  const state = {
    categories: [],
    collections: [],
    materials: [],
    badges: [],
    inStockOnly: false,
    maxPrice: null,
    search: '',
    sort: 'featured',
    page: 1,
    pageSize: 12
  };

  let allCatalogueProducts = [];
  let filteredProducts = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // Read initial URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('category')) state.categories = [params.get('category').toLowerCase()];
    if (params.get('collection')) state.collections = [params.get('collection').toLowerCase()];
    if (params.get('material')) state.materials = [params.get('material')];
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('search')) state.search = params.get('search').toLowerCase();
    if (params.get('badge')) {
      const bMap = { 'new': 'New Arrival', 'best': 'Best Seller', 'trending': 'Trending' };
      state.badges = [bMap[params.get('badge')] || params.get('badge')];
    }

    await initShop();
    bindEvents();
  });

  async function initShop() {
    const grid = document.getElementById('shopGrid');
    if (grid) {
      grid.innerHTML = getSkeletonHTML(8);
    }

    try {
      const rawProducts = await loadProducts();

      // Deduplicate products by id to strictly satisfy specification:
      // "Products must not appear more than once in the same listing"
      const seen = new Set();
      allCatalogueProducts = (rawProducts || []).filter(p => {
        if (!p || !p.id) return false;
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      renderFilterOptions(allCatalogueProducts);
      syncCheckboxesWithState();
      applyFiltersAndSort();
    } catch (err) {
      console.error('[Shop] Failed to load shop catalogue:', err);
      showErrorState();
    }
  }

  function renderFilterOptions(products) {
    const categoriesContainer = document.getElementById('filterCategories');
    const collectionsContainer = document.getElementById('filterCollections');
    const materialsContainer = document.getElementById('filterMaterials');
    const priceSlider = document.getElementById('filterPriceSlider');
    const priceDisplay = document.getElementById('priceDisplay');

    const catCounts = { rings: 0, bracelets: 0, earrings: 0, necklaces: 0 };
    const colCounts = {};
    const matCounts = {};
    let minP = Infinity;
    let maxP = 0;

    products.forEach(p => {
      const cat = (p.category || '').toLowerCase().trim();
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;

      const col = (p.collection || '').trim();
      if (col) colCounts[col] = (colCounts[col] || 0) + 1;

      const mat = (p.material || '').trim();
      if (mat) matCounts[mat] = (matCounts[mat] || 0) + 1;

      const price = Number(p.price) || 0;
      if (price < minP) minP = price;
      if (price > maxP) maxP = price;
    });

    if (minP === Infinity) minP = 0;
    if (maxP === 0) maxP = 6000;

    // 1. Categories Filter
    if (categoriesContainer) {
      const standardCats = [
        { slug: 'rings', name: 'Rings' },
        { slug: 'bracelets', name: 'Bracelets' },
        { slug: 'earrings', name: 'Earrings' },
        { slug: 'necklaces', name: 'Necklaces' }
      ];

      categoriesContainer.innerHTML = standardCats.map(c => `
        <label class="filter-option">
          <input type="checkbox" name="category" value="${c.slug}" ${state.categories.includes(c.slug) ? 'checked' : ''}>
          <span>${c.name}</span>
          <span class="filter-count">(${catCounts[c.slug] || 0})</span>
        </label>
      `).join('');
    }

    // 2. Collections Filter
    if (collectionsContainer) {
      const collections = Object.keys(colCounts);
      collectionsContainer.innerHTML = collections.map(col => `
        <label class="filter-option">
          <input type="checkbox" name="collection" value="${escapeHtml(col.toLowerCase())}" ${state.collections.includes(col.toLowerCase()) ? 'checked' : ''}>
          <span style="text-transform: capitalize;">${escapeHtml(col)}</span>
          <span class="filter-count">(${colCounts[col]})</span>
        </label>
      `).join('');
    }

    // 3. Materials Filter
    if (materialsContainer) {
      const materials = Object.keys(matCounts);
      materialsContainer.innerHTML = materials.map(mat => `
        <label class="filter-option">
          <input type="checkbox" name="material" value="${escapeHtml(mat)}" ${state.materials.includes(mat) ? 'checked' : ''}>
          <span>${escapeHtml(mat)}</span>
          <span class="filter-count">(${matCounts[mat]})</span>
        </label>
      `).join('');
    }

    // 4. Price Slider
    if (priceSlider) {
      priceSlider.min = minP;
      priceSlider.max = maxP;
      priceSlider.value = state.maxPrice || maxP;
      if (priceDisplay) {
        priceDisplay.textContent = `Up to Rs. ${Number(priceSlider.value).toLocaleString()}`;
      }
    }
  }

  function syncCheckboxesWithState() {
    document.querySelectorAll('.filters-sidebar input[type="checkbox"]').forEach(cb => {
      if (cb.name === 'category') {
        cb.checked = state.categories.includes(cb.value.toLowerCase());
      }
      if (cb.name === 'collection') {
        cb.checked = state.collections.includes(cb.value.toLowerCase());
      }
      if (cb.name === 'material') {
        cb.checked = state.materials.includes(cb.value);
      }
    });

    const inStockCb = document.getElementById('filterInStock');
    if (inStockCb) inStockCb.checked = state.inStockOnly;
  }

  function applyFiltersAndSort() {
    filteredProducts = allCatalogueProducts.filter(p => {
      // Category filter
      if (state.categories.length > 0) {
        const pCat = (p.category || '').toLowerCase();
        if (!state.categories.includes(pCat)) return false;
      }

      // Collection filter
      if (state.collections.length > 0) {
        const pCol = (p.collection || '').toLowerCase();
        if (!state.collections.includes(pCol)) return false;
      }

      // Material filter
      if (state.materials.length > 0) {
        const pMat = (p.material || '').toLowerCase();
        if (!state.materials.some(m => m.toLowerCase() === pMat)) return false;
      }

      // Badge filter
      if (state.badges.length > 0) {
        const pBadge = (p.badge || '').toLowerCase();
        if (!state.badges.some(b => pBadge.includes(b.toLowerCase()))) return false;
      }

      // In stock only
      if (state.inStockOnly) {
        if (!p.in_stock || (p.stock !== undefined && p.stock <= 0)) return false;
      }

      // Max price
      if (state.maxPrice != null) {
        if ((Number(p.price) || 0) > state.maxPrice) return false;
      }

      // Search keyword
      if (state.search) {
        const query = state.search;
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesDesc = (p.description || '').toLowerCase().includes(query);
        const matchesMat = (p.material || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesMat) return false;
      }

      return true;
    });

    // Sorting
    switch (state.sort) {
      case 'price-low':
        filteredProducts.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case 'price-high':
        filteredProducts.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case 'newest':
        filteredProducts.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
        break;
      case 'name':
        filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'featured':
      default:
        filteredProducts.sort((a, b) => {
          if (a.badge && !b.badge) return -1;
          if (!a.badge && b.badge) return 1;
          return 0;
        });
        break;
    }

    renderProductsGrid();
    renderActiveFilterPills();
    updateProductCount();
  }

  function renderProductsGrid() {
    const grid = document.getElementById('shopGrid');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (!grid) return;

    if (filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 4rem 1rem; grid-column: 1 / -1; width: 100%;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #FAF8F5; border: 1px solid rgba(197, 160, 40, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: var(--gold-dark);">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <h3 style="font-family: var(--font-serif); font-size: 1.5rem; margin-bottom: 0.5rem; color: #1A1A1A;">No pieces match your selection</h3>
          <p style="color: #666666; margin-bottom: 1.5rem; max-width: 450px; margin-left: auto; margin-right: auto;">
            Try adjusting or clearing your chosen filters to view our full collection of handcrafted jewellery.
          </p>
          <button id="resetFiltersBtn" class="btn btn-gold" style="padding: 10px 24px; cursor: pointer;">Reset All Filters</button>
        </div>
      `;
      document.getElementById('resetFiltersBtn')?.addEventListener('click', clearAllFilters);
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    const displayedCount = state.page * state.pageSize;
    const itemsToDisplay = filteredProducts.slice(0, displayedCount);

    grid.innerHTML = itemsToDisplay.map(product => renderShopProductCard(product)).join('');

    // Load More Controls
    if (loadMoreContainer) {
      if (displayedCount < filteredProducts.length) {
        loadMoreContainer.style.display = 'block';
        loadMoreContainer.innerHTML = `
          <button id="shopLoadMoreBtn" class="btn btn-outline" style="padding: 12px 36px; font-size: 0.9rem; cursor: pointer; border-radius: 6px;">
            Load More Products (${filteredProducts.length - displayedCount} remaining)
          </button>
        `;
        document.getElementById('shopLoadMoreBtn')?.addEventListener('click', () => {
          state.page += 1;
          renderProductsGrid();
          updateProductCount();
        });
      } else {
        loadMoreContainer.style.display = 'none';
      }
    }

    if (typeof initScrollAnimations === 'function') {
      initScrollAnimations();
    }
  }

  function renderShopProductCard(product) {
    const id = Number(product.id);
    const price = Number(product.price) || 0;
    const originalPrice = product.original_price != null ? Number(product.original_price) : (product.originalPrice != null ? Number(product.originalPrice) : null);
    const inStock = product.in_stock !== false && (product.stock === undefined || product.stock > 0);

    const badgeHTML = product.badge
      ? `<div class="product-badge">${escapeHtml(product.badge)}</div>`
      : (!inStock ? `<div class="product-badge" style="background:#777;color:#fff;">Out of Stock</div>` : '');

    const priceHTML = originalPrice
      ? `<span class="product-card-price">Rs. ${price.toLocaleString()} <span class="original">Rs. ${originalPrice.toLocaleString()}</span></span>`
      : `<span class="product-card-price">Rs. ${price.toLocaleString()}</span>`;

    const rawImg = product.image || (Array.isArray(product.images) && product.images[0]) || '';
    const cleanImg = safeImageUrl(rawImg).replace(/\.(png|jpe?g)$/i, '.webp');

    return `
      <div class="product-card animate-on-scroll" data-id="${id}" onclick="if(!event.target.closest('.quick-view-btn') && !event.target.closest('.card-add-btn')) window.location.href='product-detail.html?id=${id}';">
        <div class="product-card-image" style="aspect-ratio: 1; position: relative; overflow: hidden; background: #F5EFE3;">
          ${badgeHTML}
          <img src="${escapeHtml(cleanImg)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" width="400" height="400" onerror="this.onerror=null; this.src='images/placeholder.png'; this.style.objectFit='contain';">
          <div class="product-card-overlay">
            <button class="quick-view-btn" onclick="openQuickView(${id})">Quick View</button>
          </div>
        </div>
        <div class="product-card-info" style="padding: 16px;">
          <div class="product-card-collection" style="font-size: 0.75rem; text-transform: uppercase; color: #888888; letter-spacing: 1.5px; margin-bottom: 4px;">
            ${escapeHtml(product.category || 'Jewellery')} • ${escapeHtml(product.collection || 'Collection')}
          </div>
          <h3 class="product-card-name" style="font-family: var(--font-serif); font-size: 1.05rem; margin-bottom: 6px; color: #1A1A1A; font-weight: 600;">
            ${escapeHtml(product.name)}
          </h3>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
            ${priceHTML}
            <button class="card-add-btn btn btn-gold" style="padding: 6px 14px; font-size: 0.75rem; border-radius: 4px; cursor: pointer;" onclick="event.stopPropagation(); handleDirectAddToCart(${id});" ${!inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              ${inStock ? 'Add to Cart' : 'Sold Out'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  window.handleDirectAddToCart = function(productId) {
    const product = allCatalogueProducts.find(p => Number(p.id) === Number(productId));
    if (product && typeof Cart !== 'undefined') {
      Cart.add(product, 1);
    }
  };

  function renderActiveFilterPills() {
    const container = document.getElementById('activeFiltersBar');
    if (!container) return;

    const pills = [];

    state.categories.forEach(cat => {
      pills.push({ type: 'category', value: cat, label: `Category: ${cat.charAt(0).toUpperCase() + cat.slice(1)}` });
    });

    state.collections.forEach(col => {
      pills.push({ type: 'collection', value: col, label: `Style: ${col.charAt(0).toUpperCase() + col.slice(1)}` });
    });

    state.materials.forEach(mat => {
      pills.push({ type: 'material', value: mat, label: `Material: ${mat}` });
    });

    state.badges.forEach(b => {
      pills.push({ type: 'badge', value: b, label: `Featured: ${b}` });
    });

    if (state.inStockOnly) {
      pills.push({ type: 'inStock', value: true, label: 'In Stock Only' });
    }

    if (state.maxPrice != null) {
      pills.push({ type: 'price', value: state.maxPrice, label: `Up to Rs. ${state.maxPrice.toLocaleString()}` });
    }

    if (state.search) {
      pills.push({ type: 'search', value: state.search, label: `Search: "${state.search}"` });
    }

    if (pills.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
      <span style="font-size: 0.8rem; font-weight: 600; color: #555; margin-right: 4px;">Active Filters:</span>
      ${pills.map(p => `
        <span class="filter-pill">
          ${escapeHtml(p.label)}
          <button type="button" aria-label="Remove filter" onclick="removeShopFilter('${p.type}', '${escapeHtml(p.value)}')">✕</button>
        </span>
      `).join('')}
      <button type="button" id="clearAllFiltersBtn" style="background: none; border: none; color: var(--gold-dark); font-size: 0.8rem; cursor: pointer; text-decoration: underline; margin-left: 8px;">
        Clear All
      </button>
    `;

    document.getElementById('clearAllFiltersBtn')?.addEventListener('click', clearAllFilters);
  }

  window.removeShopFilter = function(type, value) {
    if (type === 'category') {
      state.categories = state.categories.filter(c => c !== value);
      const cb = document.querySelector(`input[name="category"][value="${value}"]`);
      if (cb) cb.checked = false;
    } else if (type === 'collection') {
      state.collections = state.collections.filter(c => c !== value);
      const cb = document.querySelector(`input[name="collection"][value="${value}"]`);
      if (cb) cb.checked = false;
    } else if (type === 'material') {
      state.materials = state.materials.filter(m => m !== value);
      const cb = document.querySelector(`input[name="material"][value="${value}"]`);
      if (cb) cb.checked = false;
    } else if (type === 'badge') {
      state.badges = state.badges.filter(b => b !== value);
    } else if (type === 'inStock') {
      state.inStockOnly = false;
      const cb = document.getElementById('filterInStock');
      if (cb) cb.checked = false;
    } else if (type === 'price') {
      state.maxPrice = null;
      const slider = document.getElementById('filterPriceSlider');
      if (slider) {
        slider.value = slider.max;
        const display = document.getElementById('priceDisplay');
        if (display) display.textContent = `Up to Rs. ${Number(slider.max).toLocaleString()}`;
      }
    } else if (type === 'search') {
      state.search = '';
    }

    state.page = 1;
    applyFiltersAndSort();
  };

  function clearAllFilters() {
    state.categories = [];
    state.collections = [];
    state.materials = [];
    state.badges = [];
    state.inStockOnly = false;
    state.maxPrice = null;
    state.search = '';
    state.page = 1;

    document.querySelectorAll('.filters-sidebar input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    const slider = document.getElementById('filterPriceSlider');
    if (slider) {
      slider.value = slider.max;
      const display = document.getElementById('priceDisplay');
      if (display) display.textContent = `Up to Rs. ${Number(slider.max).toLocaleString()}`;
    }

    // Clean URL query without page reload
    if (window.history.pushState) {
      const cleanUrl = window.location.pathname;
      window.history.pushState({}, '', cleanUrl);
    }

    applyFiltersAndSort();
  }

  function updateProductCount() {
    const el = document.getElementById('shopCount');
    if (el) {
      const displayed = Math.min(state.page * state.pageSize, filteredProducts.length);
      el.innerHTML = `Showing <strong>${displayed}</strong> of <strong>${filteredProducts.length}</strong> products`;
    }
  }

  function bindEvents() {
    // Sort Select
    const sortSelect = document.getElementById('sortSelect');
    sortSelect?.addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.page = 1;
      applyFiltersAndSort();
    });

    // Checkbox Listeners
    document.querySelector('.filters-sidebar')?.addEventListener('change', (e) => {
      const name = e.target.name;
      const val = e.target.value;

      if (name === 'category') {
        if (e.target.checked) {
          if (!state.categories.includes(val.toLowerCase())) state.categories.push(val.toLowerCase());
        } else {
          state.categories = state.categories.filter(c => c !== val.toLowerCase());
        }
      } else if (name === 'collection') {
        if (e.target.checked) {
          if (!state.collections.includes(val.toLowerCase())) state.collections.push(val.toLowerCase());
        } else {
          state.collections = state.collections.filter(c => c !== val.toLowerCase());
        }
      } else if (name === 'material') {
        if (e.target.checked) {
          if (!state.materials.includes(val)) state.materials.push(val);
        } else {
          state.materials = state.materials.filter(m => m !== val);
        }
      } else if (e.target.id === 'filterInStock') {
        state.inStockOnly = e.target.checked;
      }

      state.page = 1;
      applyFiltersAndSort();
    });

    // Price Slider
    const priceSlider = document.getElementById('filterPriceSlider');
    const priceDisplay = document.getElementById('priceDisplay');
    priceSlider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (priceDisplay) priceDisplay.textContent = `Up to Rs. ${val.toLocaleString()}`;
    });
    priceSlider?.addEventListener('change', (e) => {
      state.maxPrice = Number(e.target.value);
      state.page = 1;
      applyFiltersAndSort();
    });

    // Mobile Filter Drawer Toggle
    const mobileFilterBtn = document.getElementById('mobileFilterBtn');
    const sidebar = document.querySelector('.filters-sidebar');
    const overlay = document.querySelector('.nav-overlay');

    mobileFilterBtn?.addEventListener('click', () => {
      sidebar?.classList.add('open');
      overlay?.classList.add('active');
    });

    overlay?.addEventListener('click', () => {
      sidebar?.classList.remove('open');
    });

    const closeDrawer = () => {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('active');
    };

    document.getElementById('closeSidebarBtn')?.addEventListener('click', closeDrawer);
    document.getElementById('sidebarApplyBtn')?.addEventListener('click', closeDrawer);
    document.getElementById('sidebarResetBtn')?.addEventListener('click', () => {
      clearAllFilters();
      closeDrawer();
    });
  }

  function getSkeletonHTML(count = 8) {
    let out = '';
    for (let i = 0; i < count; i++) {
      out += `
        <div class="product-card skeleton-card">
          <div class="product-card-image skeleton-shimmer" style="aspect-ratio:1;background:#EDE8DF;border-radius:8px;"></div>
          <div class="product-card-info" style="padding:16px;">
            <div style="height:12px;width:40%;background:#E2DDD5;margin-bottom:8px;border-radius:4px;"></div>
            <div style="height:16px;width:75%;background:#E2DDD5;margin-bottom:12px;border-radius:4px;"></div>
            <div style="height:18px;width:30%;background:#E2DDD5;border-radius:4px;"></div>
          </div>
        </div>
      `;
    }
    return out;
  }

  function showErrorState() {
    const grid = document.getElementById('shopGrid');
    if (grid) {
      grid.innerHTML = `
        <div style="text-align:center;padding:4rem 1rem;grid-column:1/-1;">
          <h3 style="color:#C62828;margin-bottom:0.5rem;font-family:var(--font-serif);">Unable to load catalogue</h3>
          <p style="color:#666;margin-bottom:1.5rem;">There was a problem connecting to the catalogue. Please check your connection and try again.</p>
          <button onclick="location.reload()" class="btn btn-gold" style="padding:10px 24px;">Retry Loading</button>
        </div>
      `;
    }
  }

})();
