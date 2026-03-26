/* ============================================================
   THE ACCESSORIES HUB — Products Listing Logic
   Filtering, Sorting, URL params
   ============================================================ */

let filteredProducts = [];

const state = {
  collection: [],
  category: [],
  material: [],
  sort: 'featured',
  view: 'grid',
  search: ''
};

// --- Initialize ---
document.addEventListener('DOMContentLoaded', async () => {
  const products = await loadProducts();

  // Read URL params
  const params = new URLSearchParams(window.location.search);
  if (params.get('collection')) state.collection = [params.get('collection')];
  if (params.get('category')) state.category = [params.get('category')];
  if (params.get('badge')) {
    const badgeMap = { 'new': 'New Arrival', 'best': 'Best Seller', 'trending': 'Trending' };
    state.badge = badgeMap[params.get('badge')] || '';
  }

  syncSidebarCheckboxes();

  applyFilters(products);
  
  bindSidebarFilters(products);
  bindSortEvent(products);
  bindViewToggle();
  
  initScrollAnimations();
});

function syncSidebarCheckboxes() {
  document.querySelectorAll('.shop-sidebar input[type="checkbox"]').forEach(cb => {
    if (cb.name === 'collection' && state.collection.some(c => c.toLowerCase() === cb.value.toLowerCase())) {
      cb.checked = true;
    }
    if (cb.name === 'category' && state.category.some(c => c.toLowerCase() === cb.value.toLowerCase())) {
      cb.checked = true;
    }
  });
}

function bindSidebarFilters(products) {
  document.querySelectorAll('.shop-sidebar input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const value = e.target.value;
      const type = e.target.name;
      
      if (e.target.checked) {
        if (!state[type].includes(value)) state[type].push(value);
      } else {
        state[type] = state[type].filter(item => item.toLowerCase() !== value.toLowerCase());
      }
      
      applyFilters(products);
    });
  });
}

function updatePageHeader() {
  const headerContainer = document.getElementById('pageHeaderContainer');
  if (!headerContainer) return;

  let title = 'Shop All Products';
  let subtitle = 'Discover the perfect piece that speaks to your style';
  let breadcrumb = 'Shop';

  if (state.collection.length === 1 && state.category.length === 0) {
    const col = state.collection[0].charAt(0).toUpperCase() + state.collection[0].slice(1);
    title = col + ' Collection';
    subtitle = `Explore our exclusive ${col} pieces`;
    breadcrumb = title;
  } else if (state.category.length === 1 && state.collection.length === 0) {
    const cat = state.category[0].charAt(0).toUpperCase() + state.category[0].slice(1);
    title = cat;
    subtitle = `Browse our beautiful selection of ${cat.toLowerCase()}`;
    breadcrumb = title;
  } else if (state.badge) {
    title = state.badge;
    subtitle = `Discover our ${state.badge.toLowerCase()} products`;
    breadcrumb = title;
  } else if (state.search) {
    title = `Search Results for "${state.search}"`;
    subtitle = `Showing products matching your search`;
    breadcrumb = 'Search';
  } else if (state.collection.length > 0 || state.category.length > 0) {
     title = 'Filtered Results';
     subtitle = 'Showing products matching your selected filters';
     breadcrumb = 'Filtered';
  }

  headerContainer.innerHTML = `
    <div class="breadcrumbs">
      <a href="index.html">Home</a>
      <span class="separator">›</span>
      <span>${breadcrumb}</span>
    </div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
  `;
}


function applyFilters(products) {
  filteredProducts = products.filter(p => {
    // Case-insensitive matching for collection
    if (state.collection.length) {
      const match = state.collection.some(c => (p.collection || '').toLowerCase() === c.toLowerCase());
      if (!match) return false;
    }
    
    // Case-insensitive matching for category
    if (state.category.length) {
      const match = state.category.some(c => (p.category || '').toLowerCase() === c.toLowerCase());
      if (!match) return false;
    }
    
    // Case-insensitive matching for material
    if (state.material.length) {
      const match = state.material.some(c => (p.material || '').toLowerCase() === c.toLowerCase());
      if (!match) return false;
    }
    
    // Partial case-insensitive match for badge
    if (state.badge && !(p.badge || '').toLowerCase().includes(state.badge.toLowerCase())) {
        return false;
    }
    
    // Case-insensitive search 
    if (state.search && !(p.name || '').toLowerCase().includes(state.search.toLowerCase())) {
        return false;
    }
    
    return true;
  });

  // Sort
  switch (state.sort) {
    case 'price-low':
      filteredProducts.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      filteredProducts.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'newest':
      filteredProducts.sort((a, b) => b.id - a.id);
      break;
  }

  renderProducts();
  updateCount();
  updatePageHeader();
  
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="no-results" style="text-align: center; padding: 4rem 1rem; width: 100%; grid-column: 1 / -1;">
        <div class="icon" style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
        <h3 style="color: var(--gold); margin-bottom: 0.5rem;">No products found</h3>
        <p style="color: var(--white-muted); margin-bottom: 1.5rem;">Try adjusting your filters or browse our full collection.</p>
        <button onclick="window.location.href='products.html'" class="btn btn-gold">Remove Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredProducts.map(p => renderProductCard(p)).join('');
  initScrollAnimations();
}

function updateCount() {
  const el = document.getElementById('productsCount');
  if (el) {
    el.innerHTML = `Showing <strong>${filteredProducts.length}</strong> of <strong>${allProducts.length}</strong> products`;
  }
}

function bindSortEvent(products) {
  const sortSelect = document.getElementById('sortSelect');
  sortSelect?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    applyFilters(products);
  });
}

function bindViewToggle() {
  document.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const grid = document.getElementById('productsGrid');
      if (btn.dataset.view === 'list') {
        grid?.classList.add('list-view');
      } else {
        grid?.classList.remove('list-view');
      }
    });
  });
}


