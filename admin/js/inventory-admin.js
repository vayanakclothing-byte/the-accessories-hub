/* ============================================================
   Inventory Admin — Real-Time Stock Ledger & Controlled Adjustments
   ============================================================ */

let currentFilter = '';
let currentCategory = '';
let currentSearch = '';
let currentPage = 1;
const PAGE_SIZE = 12;

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderInventoryStats();
  renderInventoryTable();
  renderStockHistory();
  initImageUpload();
  populateSuppliersDropdown();
  document.getElementById('productForm')?.addEventListener('submit', saveProductFromInventory);
  document.getElementById('stockAdjustmentForm')?.addEventListener('submit', submitStockAdjustment);
});

function populateSuppliersDropdown() {
  const select = document.getElementById('pSupplier');
  if (!select) return;
  const suppliers = DB.suppliers();
  let html = '<option value="">None / Direct Sourcing</option>';
  suppliers.forEach(s => {
    html += `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
  });
  select.innerHTML = html;
}

function renderInventoryStats() {
  const products = DB.products();
  const inStock = products.filter(p => !p.isArchived && Number(p.stock) > Number(p.reorderLevel)).length;
  const lowStock = products.filter(p => !p.isArchived && Number(p.stock) > 0 && Number(p.stock) <= Number(p.reorderLevel)).length;
  const outOfStock = products.filter(p => !p.isArchived && Number(p.stock) === 0).length;

  let totalAsset = 0;
  let totalUnits = 0;
  products.forEach(p => {
    if (!p.isArchived) {
      const units = Number(p.stock) || 0;
      const cost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;
      totalAsset += units * cost;
      totalUnits += units;
    }
  });

  const inStockEl = document.getElementById('inStockCount');
  const lowStockEl = document.getElementById('lowStockCount');
  const outStockEl = document.getElementById('outStockCount');
  const totalAssetEl = document.getElementById('totalAssetValue');

  if (inStockEl) inStockEl.textContent = inStock;
  if (lowStockEl) lowStockEl.textContent = lowStock;
  if (outStockEl) outStockEl.textContent = outOfStock;
  if (totalAssetEl) {
    totalAssetEl.innerHTML = `${formatPrice(totalAsset)} <span style="font-size:0.75rem; color:var(--white-muted); font-weight:normal;">(${totalUnits} units)</span>`;
  }
}

function renderInventoryTable() {
  let products = DB.products().filter(p => !p.isArchived);

  // Status Filter
  if (currentFilter === 'low') {
    products = products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.reorderLevel));
  } else if (currentFilter === 'out') {
    products = products.filter(p => Number(p.stock) === 0);
  } else if (currentFilter === 'instock') {
    products = products.filter(p => Number(p.stock) > Number(p.reorderLevel));
  }

  // Category Filter
  if (currentCategory) {
    products = products.filter(p => String(p.category || '').toLowerCase() === currentCategory);
  }

  // Search Filter
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    products = products.filter(p =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.location || '').toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--white-muted);padding:32px;">No inventory items match the selected filter.</td></tr>';
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  currentPage = Math.min(currentPage, totalPages || 1);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageProducts = products.slice(startIdx, startIdx + PAGE_SIZE);

  tbody.innerHTML = pageProducts.map(p => {
    const stock = Number(p.stock) || 0;
    const reserved = Number(p.reservedStock) || 0;
    const available = Math.max(0, stock - reserved);
    const reorder = Number(p.reorderLevel) || 5;
    const cost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;

    const status = stock === 0 ? 'out' : available <= reorder ? 'low' : 'ok';
    const badge = status === 'out'
      ? '<span class="badge badge-red">Out of Stock</span>'
      : status === 'low'
        ? '<span class="badge badge-orange">Low Stock</span>'
        : '<span class="badge badge-green">In Stock</span>';

    return `
      <tr>
        <td>
          <div class="table-product">
            <div class="table-img"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='/images/placeholder.webp'"></div>
            <div>
              <div class="table-product-name" style="font-weight:600;">${escapeHtml(p.name)}</div>
              <div class="table-product-sub" style="font-family:monospace; color:var(--gold);">${escapeHtml(p.sku || 'SKU-' + p.id)}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="text-transform:capitalize; font-weight:500;">${escapeHtml(p.category || 'Jewellery')}</div>
          <div style="font-size:0.75rem; color:var(--white-muted);"><i data-lucide="map-pin" style="width:11px;height:11px;display:inline;"></i> ${escapeHtml(p.location || 'Warehouse')}</div>
        </td>
        <td>
          <strong>${formatPrice(cost)}</strong>
          <div style="font-size:0.75rem; color:var(--white-muted);">Retail: ${formatPrice(p.price)}</div>
        </td>
        <td>
          <span style="font-size:1.05rem; font-weight:700; color:var(--white);">${stock}</span>
        </td>
        <td>
          <span style="font-size:0.85rem; color:${reserved > 0 ? 'var(--orange)' : 'var(--white-muted)'};">${reserved}</span>
        </td>
        <td>
          <div class="stock-inline">
            <strong style="color:${available > 0 ? 'var(--green)' : 'var(--red)'}; font-size:1rem;">${available}</strong>
            <div class="stock-bar"><div class="stock-bar-fill ${status === 'ok' ? 'high' : status === 'low' ? 'medium' : 'low'}" style="width:${Math.min(100, available * 2.5)}%"></div></div>
          </div>
        </td>
        <td>${badge}</td>
        <td>
          <div style="display:flex;gap:4px;align-items:center;">
            <button class="btn btn-sm btn-ghost" onclick="quickStockDelta(${Number(p.id)}, -1)" title="Deduct 1 unit" ${stock === 0 ? 'disabled' : ''}>−</button>
            <button class="btn btn-sm btn-ghost" onclick="quickStockDelta(${Number(p.id)}, 1)" title="Add 1 unit">+</button>
            <button class="btn btn-sm btn-outline" onclick="openStockAdjustmentModal(${Number(p.id)})" title="Adjust stock with audit note">Adjust</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(totalPages);
  if (window.lucide) lucide.createIcons();
}

function renderPagination(totalPages) {
  let pagEl = document.getElementById('inventoryPagination');
  if (!pagEl) {
    pagEl = document.createElement('div');
    pagEl.id = 'inventoryPagination';
    pagEl.style.display = 'flex';
    pagEl.style.justifyContent = 'space-between';
    pagEl.style.alignItems = 'center';
    pagEl.style.padding = '14px 18px';
    pagEl.style.borderTop = '1px solid var(--grey-mid)';
    document.querySelector('.table-card')?.appendChild(pagEl);
  }

  if (totalPages <= 1) {
    pagEl.style.display = 'none';
    return;
  }

  pagEl.style.display = 'flex';
  pagEl.innerHTML = `
    <div style="font-size:0.85rem; color:var(--white-muted);">
      Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong>
    </div>
    <div style="display:flex; gap:6px;">
      <button class="btn btn-sm btn-ghost" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <button class="btn btn-sm btn-ghost" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function changePage(p) {
  currentPage = p;
  renderInventoryTable();
}

// ===== QUICK STOCK DELTA =====
async function quickStockDelta(id, delta) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const currentStock = Number(p.stock) || 0;
  const newStock = Math.max(0, currentStock + delta);
  if (newStock === currentStock) return;

  try {
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock, in_stock: newStock > 0 })
      .eq('id', id);

    if (error) throw error;

    await logStockChange(p.id, p.name, delta > 0 ? 'restock' : 'adjustment', delta, newStock, delta > 0 ? 'Quick Restock' : 'Quick Adjustment');
    await DB.logAudit('ADJUST_STOCK', 'inventory', id, `${p.name}: ${delta > 0 ? '+' : ''}${delta} units`);

    DB.invalidate();
    await DB.reload();
    renderInventoryStats();
    renderInventoryTable();
    renderStockHistory();
    showToast(`Stock updated: ${p.name} is now ${newStock}`);
  } catch (err) {
    showToast('Failed to update stock: ' + err.message, 'error');
  }
}

// ===== CONTROLLED STOCK ADJUSTMENT MODAL =====
let adjustingProductId = null;

function openStockAdjustmentModal(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  adjustingProductId = id;

  document.getElementById('adjProductName').textContent = p.name;
  document.getElementById('adjProductSku').textContent = p.sku || 'SKU-' + p.id;
  document.getElementById('adjCurrentStock').textContent = p.stock;
  document.getElementById('adjQuantity').value = '5';
  document.getElementById('adjType').value = 'restock';
  document.getElementById('adjReason').value = 'Supplier Restock';
  updateAdjPreview();
  openModal('stockAdjustmentModal');
}

function updateAdjPreview() {
  const p = DB.products().find(x => x.id === adjustingProductId);
  if (!p) return;
  const current = Number(p.stock) || 0;
  const qty = parseInt(document.getElementById('adjQuantity').value, 10) || 0;
  const type = document.getElementById('adjType').value;

  let delta = qty;
  if (type === 'damage' || type === 'shrinkage' || type === 'sale') {
    delta = -qty;
  }
  const result = Math.max(0, current + delta);
  const previewEl = document.getElementById('adjNewStockPreview');
  if (previewEl) {
    previewEl.textContent = result;
    previewEl.style.color = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--white)';
  }
}

async function submitStockAdjustment(e) {
  e.preventDefault();
  const p = DB.products().find(x => x.id === adjustingProductId);
  if (!p) return;

  const qty = parseInt(document.getElementById('adjQuantity').value, 10) || 0;
  const type = document.getElementById('adjType').value;
  const reason = document.getElementById('adjReason').value.trim() || 'Manual Adjustment';

  if (qty <= 0) {
    showToast('Quantity must be greater than 0', 'error');
    return;
  }

  let delta = qty;
  if (type === 'damage' || type === 'shrinkage' || type === 'sale') {
    delta = -qty;
  }

  const currentStock = Number(p.stock) || 0;
  const newStock = Math.max(0, currentStock + delta);

  try {
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock, in_stock: newStock > 0 })
      .eq('id', p.id);

    if (error) throw error;

    await logStockChange(p.id, p.name, type, delta, newStock, reason);
    await DB.logAudit('CONTROLLED_STOCK_ADJUSTMENT', 'inventory', p.id, `${p.name} ${delta > 0 ? '+' : ''}${delta} units (${reason})`);

    DB.invalidate();
    await DB.reload();

    closeAllModals();
    renderInventoryStats();
    renderInventoryTable();
    renderStockHistory();
    showToast(`Stock adjusted successfully: ${p.name} (${newStock} on hand)`);
  } catch (err) {
    showToast('Adjustment failed: ' + err.message, 'error');
  }
}

async function logStockChange(productId, productName, type, change, newStock, reason) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || 'admin';
    const now = new Date();

    await supabase.from('stock_history').insert([{
      product_id: productId || null,
      product: productName,
      product_name: productName,
      type,
      change_amount: change,
      new_stock: newStock,
      reason: reason || type,
      user_email: userEmail,
      date: `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`
    }]);
  } catch (e) {
    console.warn('[Inventory] Ledger logging warning:', e);
  }
}

function renderStockHistory() {
  const history = DB.stockHistory().slice(0, 15);
  const container = document.getElementById('stockTimeline');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<p style="color:var(--white-muted);font-size:0.85rem;padding:12px;">No stock movements recorded yet.</p>';
    return;
  }

  container.innerHTML = history.map(h => {
    const change = Number(h.change) || 0;
    return `
      <div class="timeline-item">
        <div class="time">${escapeHtml(h.date || '—')}</div>
        <div class="event">
          <strong>${escapeHtml(h.product || 'Product')}</strong>
          <span style="color:${change > 0 ? 'var(--green)' : 'var(--red)'}; font-weight:700; margin-left:4px;">
            ${change > 0 ? '+' : ''}${change}
          </span>
          <div style="font-size:0.75rem; color:var(--white-muted); margin-top:2px;">
            Reason: <em>${escapeHtml(h.reason || h.type || 'Movement')}</em> → New Stock: <strong>${Number(h.newStock) || 0}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterInventory(type, evt) {
  currentFilter = type;
  currentPage = 1;
  const clicked = (evt && evt.currentTarget) || (typeof event !== 'undefined' ? event.target : null);
  document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
  clicked?.classList.add('active');
  renderInventoryTable();
}

function handleSearch(val) {
  currentSearch = val;
  currentPage = 1;
  renderInventoryTable();
}

function handleCategoryFilter(cat) {
  currentCategory = cat.toLowerCase();
  currentPage = 1;
  renderInventoryTable();
}

function exportInventoryCSV() {
  const products = DB.products().filter(p => !p.isArchived);
  exportTableToCSV(`inventory_ledger_${new Date().toISOString().split('T')[0]}`, products, {
    sku: 'SKU',
    name: 'Product Name',
    category: 'Category',
    location: 'Location',
    stock: 'On-Hand Stock',
    reservedStock: 'Reserved',
    availableStock: 'Available to Sell',
    reorderLevel: 'Reorder Level',
    price: 'Selling Price (Rs.)',
    costPrice: 'Unit Cost (Rs.)'
  });
}

// ===== ADD PRODUCT DIRECTLY FROM INVENTORY MODAL =====
let uploadedImages = [];

function openAddProductFromInventory() {
  uploadedImages = [];
  document.getElementById('productForm').reset();
  document.getElementById('pSku').value = 'TAH-' + Math.floor(100000 + Math.random() * 900000);
  document.getElementById('pStock').value = '10';
  document.getElementById('pReorderLevel').value = '5';
  document.getElementById('pStockReason').value = 'Initial Inventory Receipt';
  document.getElementById('imagePreviewGrid').innerHTML = '';
  populateSuppliersDropdown();
  openModal('productModal');
}

async function saveProductFromInventory(e) {
  e.preventDefault();

  const name = document.getElementById('pName').value.trim();
  const price = Number(document.getElementById('pPrice').value);
  const costPrice = Number(document.getElementById('pCostPrice')?.value) || 0;
  const originalPriceRaw = document.getElementById('pOriginalPrice')?.value;
  const originalPrice = originalPriceRaw ? Number(originalPriceRaw) : null;
  const stock = Math.max(0, parseInt(document.getElementById('pStock').value, 10) || 0);
  const reorderLevel = Math.max(0, parseInt(document.getElementById('pReorderLevel').value, 10) || 5);
  const stockReason = document.getElementById('pStockReason')?.value?.trim() || 'Initial Inventory Entry';

  if (!name) { showToast('Product name is required', 'error'); return; }
  if (!Number.isFinite(price) || price <= 0) { showToast('Price must be greater than 0', 'error'); return; }

  const submitBtn = document.querySelector('#productForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding to Inventory...';
  }

  try {
    const images = uploadedImages.length ? uploadedImages : ['/images/placeholder.webp'];
    const category = document.getElementById('pCategory').value.trim().toLowerCase();
    const collection = document.getElementById('pCollection').value.trim().toLowerCase();
    const material = document.getElementById('pMaterial').value.trim();
    const color = document.getElementById('pColor')?.value?.trim() || '';
    const audience = document.getElementById('pAudience')?.value || 'unisex';
    const location = document.getElementById('pLocation')?.value?.trim() || 'Main Warehouse';
    const supplierId = document.getElementById('pSupplier')?.value ? Number(document.getElementById('pSupplier').value) : null;
    let sku = document.getElementById('pSku').value.trim();
    if (!sku) sku = 'TAH-' + Math.floor(100000 + Math.random() * 900000);

    const payload = {
      name,
      price,
      cost_price: costPrice,
      original_price: originalPrice,
      collection,
      category,
      material,
      color,
      audience,
      location,
      supplier_id: supplierId,
      description: document.getElementById('pDescription').value.trim(),
      features: document.getElementById('pFeatures').value.split(',').map(f => f.trim()).filter(Boolean),
      badge: document.getElementById('pBadge').value.trim() || null,
      sku,
      stock,
      reorder_level: reorderLevel,
      in_stock: stock > 0,
      images,
      image: images[0]
    };

    const matchedCat = DB.categories().find(c => (c.slug || '').toLowerCase() === category);
    if (matchedCat && isValidUUID(matchedCat.id)) {
      payload.category_id = matchedCat.id;
    }

    const { data: newProd, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    if (stock > 0) {
      await logStockChange(newProd.id, name, 'initial_stock', stock, stock, stockReason);
    }

    await DB.logAudit('CREATE_PRODUCT_INVENTORY', 'inventory', newProd.id || sku, `Added ${name} to stock (${stock} units)`);

    DB.invalidate();
    await DB.reload();

    closeAllModals();
    renderInventoryStats();
    renderInventoryTable();
    renderStockHistory();
    showToast(`Added "${name}" with ${stock} units to inventory!`);

  } catch (err) {
    console.error('[Inventory] Add product error:', err);
    showToast('Failed to create product: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Product to Inventory';
    }
  }
}

// Multi-image upload handlers
function initImageUpload() {
  const zone = document.getElementById('imageUploadZone');
  const input = document.getElementById('imageFileInput');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => handleFiles(input.files));
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const compressed = await resizeImage(e.target.result);
        uploadedImages.push(compressed);
      } catch (_) {
        uploadedImages.push(e.target.result);
      }
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl, maxSide = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = dataUrl;
  });
}

function renderImagePreviews() {
  const grid = document.getElementById('imagePreviewGrid');
  if (!grid) return;
  grid.innerHTML = uploadedImages.map((src, i) => `
    <div style="position:relative; width:56px; height:56px; border-radius:6px; overflow:hidden; border:1px solid var(--grey-mid);">
      <img src="${escapeHtml(src)}" alt="Preview" style="width:100%; height:100%; object-fit:cover;">
      <span onclick="removeImage(${i})" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.7); color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer;">✕</span>
    </div>
  `).join('');
}

function removeImage(idx) {
  uploadedImages.splice(idx, 1);
  renderImagePreviews();
}
