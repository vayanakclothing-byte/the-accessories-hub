/* ============================================================
   THE ACCESSORIES HUB — Collection Page Engine
   Dynamic Category Products, Faceted Filters, Sorting, SEO
   ============================================================ */

(function() {
  'use strict';

  // Category State
  const state = {
    category: '',
    materials: [],
    collections: [],
    inStockOnly: false,
    maxPrice: null,
    sort: 'featured',
    page: 1,
    pageSize: 12
  };

  let allCategoryProducts = [];
  let filteredProducts = [];

  document.addEventListener('DOMContentLoaded', async () => {
    state.category = (document.body.dataset.category || '').toLowerCase();
    if (!state.category) {
      const pathParts = window.location.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1].replace('.html', '');
      state.category = lastPart.toLowerCase();
    }

    // Read initial URL params if any
    const params = new URLSearchParams(window.location.search);
    if (params.get('material')) state.materials = [params.get('material')];
    if (params.get('collection')) state.collections = [params.get('collection')];
    if (params.get('sort')) state.sort = params.get('sort');

    await initCollection();
    bindEvents();
  });

  async function initCollection() {
    const grid = document.getElementById('collectionGrid');
    if (grid) {
      grid.innerHTML = getSkeletonHTML(6);
    }

    try {
      const products = await loadProducts();
      // Filter by category slug
      allCategoryProducts = (products || []).filter(p => (p.category || '').toLowerCase() === state.category);

      renderDynamicFilters(allCategoryProducts);
      applyFiltersAndSort();
    } catch (err) {
      console.error('[Collection] Failed to load collection products:', err);
      showErrorState();
    }
  }

  function renderDynamicFilters(products) {
    const materialsContainer = document.getElementById('filterMaterials');
    const collectionsContainer = document.getElementById('filterCollections');
    const priceSlider = document.getElementById('filterPriceSlider');
    const priceDisplay = document.getElementById('priceDisplay');

    // Extract unique materials present in this category
    const materialCounts = {};
    const collectionCounts = {};
    let minP = Infinity;
    let maxP = 0;

    products.forEach(p => {
      const mat = (p.material || '').trim();
      if (mat) {
        materialCounts[mat] = (materialCounts[mat] || 0) + 1;
      }
      const col = (p.collection || '').trim();
      if (col) {
        collectionCounts[col] = (collectionCounts[col] || 0) + 1;
      }
      const pr = Number(p.price) || 0;
      if (pr < minP) minP = pr;
      if (pr > maxP) maxP = pr;
    });

    if (minP === Infinity) minP = 0;
    if (maxP === 0) maxP = 5000;

    // Render Material Filters
    if (materialsContainer) {
      const materials = Object.keys(materialCounts);
      if (materials.length > 0) {
        materialsContainer.innerHTML = materials.map(mat => `
          <label class="filter-option">
            <input type="checkbox" name="material" value="${escapeHtml(mat)}" ${state.materials.includes(mat) ? 'checked' : ''}>
            <span>${escapeHtml(mat)}</span>
            <span class="filter-count">(${materialCounts[mat]})</span>
          </label>
        `).join('');
      } else {
        const group = materialsContainer.closest('.filter-group');
        if (group) group.style.display = 'none';
      }
    }

    // Render Collection / Style Filters
    if (collectionsContainer) {
      const collections = Object.keys(collectionCounts);
      if (collections.length > 0) {
        collectionsContainer.innerHTML = collections.map(col => `
          <label class="filter-option">
            <input type="checkbox" name="collection" value="${escapeHtml(col)}" ${state.collections.includes(col) ? 'checked' : ''}>
            <span style="text-transform: capitalize;">${escapeHtml(col)}</span>
            <span class="filter-count">(${collectionCounts[col]})</span>
          </label>
        `).join('');
      } else {
        const group = collectionsContainer.closest('.filter-group');
        if (group) group.style.display = 'none';
      }
    }

    // Render Price Slider
    if (priceSlider) {
      priceSlider.min = minP;
      priceSlider.max = maxP;
      priceSlider.value = state.maxPrice || maxP;
      if (priceDisplay) {
        priceDisplay.textContent = `Up to Rs. ${Number(priceSlider.value).toLocaleString()}`;
      }
    }
  }

  function applyFiltersAndSort() {
    filteredProducts = allCategoryProducts.filter(p => {
      // Material filter
      if (state.materials.length > 0) {
        const pMat = (p.material || '').toLowerCase();
        if (!state.materials.some(m => m.toLowerCase() === pMat)) return false;
      }
      // Collection filter
      if (state.collections.length > 0) {
        const pCol = (p.collection || '').toLowerCase();
        if (!state.collections.some(c => c.toLowerCase() === pCol)) return false;
      }
      // In stock only
      if (state.inStockOnly) {
        if (!p.in_stock || (p.stock !== undefined && p.stock <= 0)) return false;
      }
      // Max price
      if (state.maxPrice != null) {
        if ((Number(p.price) || 0) > state.maxPrice) return false;
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
        // Featured keeps natural curated order, giving preference to badge items
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
    const grid = document.getElementById('collectionGrid');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (!grid) return;

    if (filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 4rem 1rem; grid-column: 1 / -1; width: 100%;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #FAF8F5; border: 1px solid rgba(197, 160, 40, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: var(--gold-dark);">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
          </div>
          <h3 style="font-family: var(--font-serif); font-size: 1.5rem; margin-bottom: 0.5rem; color: #1A1A1A;">No pieces found</h3>
          <p style="color: #666666; margin-bottom: 1.5rem; max-width: 450px; margin-left: auto; margin-right: auto;">
            We couldn't find any products matching your chosen filters in this collection.
          </p>
          <button id="resetFiltersBtn" class="btn btn-gold" style="padding: 10px 24px; cursor: pointer;">Clear All Filters</button>
        </div>
      `;
      document.getElementById('resetFiltersBtn')?.addEventListener('click', clearAllFilters);
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    // Pagination
    const displayedCount = state.page * state.pageSize;
    const itemsToDisplay = filteredProducts.slice(0, displayedCount);

    grid.innerHTML = itemsToDisplay.map(product => renderCollectionCard(product)).join('');

    // Load More Controls
    if (loadMoreContainer) {
      if (displayedCount < filteredProducts.length) {
        loadMoreContainer.style.display = 'block';
        loadMoreContainer.innerHTML = `
          <button id="collectionLoadMoreBtn" class="btn btn-outline" style="padding: 12px 36px; font-size: 0.9rem; cursor: pointer; border-radius: 6px;">
            Load More Products (${filteredProducts.length - displayedCount} remaining)
          </button>
        `;
        document.getElementById('collectionLoadMoreBtn')?.addEventListener('click', () => {
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

  function renderCollectionCard(product) {
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

    // Handle relative pathing for images when loaded from /collections/
    const imgSrc = cleanImg.startsWith('http') || cleanImg.startsWith('/') ? cleanImg : `../${cleanImg}`;

    return `
      <div class="product-card animate-on-scroll" data-id="${id}" onclick="if(!event.target.closest('.quick-view-btn') && !event.target.closest('.card-add-btn')) window.location.href='../product-detail.html?id=${id}';">
        <div class="product-card-image" style="aspect-ratio: 1; position: relative; overflow: hidden; background: #F5EFE3;">
          ${badgeHTML}
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" width="400" height="400" onerror="this.onerror=null; this.src='../images/placeholder.png'; this.style.objectFit='contain';">
          <div class="product-card-overlay">
            <button class="quick-view-btn" onclick="openQuickView(${id})">Quick View</button>
          </div>
        </div>
        <div class="product-card-info" style="padding: 16px;">
          <div class="product-card-collection" style="font-size: 0.75rem; text-transform: uppercase; color: #888888; letter-spacing: 1.5px; margin-bottom: 4px;">
            ${escapeHtml(product.collection || 'Luxury')} Collection
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
    const product = allCategoryProducts.find(p => Number(p.id) === Number(productId));
    if (product && typeof Cart !== 'undefined') {
      Cart.add(product, 1);
    }
  };

  function renderActiveFilterPills() {
    const container = document.getElementById('activeFiltersBar');
    if (!container) return;

    const pills = [];

    state.materials.forEach(mat => {
      pills.push({ type: 'material', value: mat, label: `Material: ${mat}` });
    });

    state.collections.forEach(col => {
      pills.push({ type: 'collection', value: col, label: `Style: ${col}` });
    });

    if (state.inStockOnly) {
      pills.push({ type: 'inStock', value: true, label: 'In Stock Only' });
    }

    if (state.maxPrice != null) {
      pills.push({ type: 'price', value: state.maxPrice, label: `Up to Rs. ${state.maxPrice.toLocaleString()}` });
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
          <button type="button" aria-label="Remove filter" onclick="removeFilter('${p.type}', '${escapeHtml(p.value)}')">✕</button>
        </span>
      `).join('')}
      <button type="button" id="clearAllFiltersBtn" style="background: none; border: none; color: var(--gold-dark); font-size: 0.8rem; cursor: pointer; text-decoration: underline; margin-left: 8px;">
        Clear All
      </button>
    `;

    document.getElementById('clearAllFiltersBtn')?.addEventListener('click', clearAllFilters);
  }

  window.removeFilter = function(type, value) {
    if (type === 'material') {
      state.materials = state.materials.filter(m => m !== value);
      const cb = document.querySelector(`input[name="material"][value="${value}"]`);
      if (cb) cb.checked = false;
    } else if (type === 'collection') {
      state.collections = state.collections.filter(c => c !== value);
      const cb = document.querySelector(`input[name="collection"][value="${value}"]`);
      if (cb) cb.checked = false;
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
    }
    state.page = 1;
    applyFiltersAndSort();
  };

  function clearAllFilters() {
    state.materials = [];
    state.collections = [];
    state.inStockOnly = false;
    state.maxPrice = null;
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

    applyFiltersAndSort();
  }

  function updateProductCount() {
    const el = document.getElementById('collectionCount');
    if (el) {
      const displayed = Math.min(state.page * state.pageSize, filteredProducts.length);
      el.innerHTML = `Showing <strong>${displayed}</strong> of <strong>${filteredProducts.length}</strong> pieces`;
    }
  }

  function bindEvents() {
    // Sort change
    const sortSelect = document.getElementById('sortSelect');
    sortSelect?.addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.page = 1;
      applyFiltersAndSort();
    });

    // Material & Collection Checkboxes
    document.querySelector('.filters-sidebar')?.addEventListener('change', (e) => {
      if (e.target.name === 'material') {
        const val = e.target.value;
        if (e.target.checked) {
          if (!state.materials.includes(val)) state.materials.push(val);
        } else {
          state.materials = state.materials.filter(m => m !== val);
        }
        state.page = 1;
        applyFiltersAndSort();
      } else if (e.target.name === 'collection') {
        const val = e.target.value;
        if (e.target.checked) {
          if (!state.collections.includes(val)) state.collections.push(val);
        } else {
          state.collections = state.collections.filter(c => c !== val);
        }
        state.page = 1;
        applyFiltersAndSort();
      } else if (e.target.id === 'filterInStock') {
        state.inStockOnly = e.target.checked;
        state.page = 1;
        applyFiltersAndSort();
      }
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

  function getSkeletonHTML(count = 6) {
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
    const grid = document.getElementById('collectionGrid');
    if (grid) {
      grid.innerHTML = `
        <div style="text-align:center;padding:4rem 1rem;grid-column:1/-1;">
          <h3 style="color:#C62828;margin-bottom:0.5rem;font-family:var(--font-serif);">Unable to load collection</h3>
          <p style="color:#666;margin-bottom:1.5rem;">There was a problem connecting to the catalogue. Please check your connection and try again.</p>
          <button onclick="location.reload()" class="btn btn-gold" style="padding:10px 24px;">Retry Loading</button>
        </div>
      `;
    }
  }

})();
