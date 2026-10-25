/* ============================================================
   Products Admin — High-Performance Catalogue & Inventory CRUD
   ============================================================ */

let editingProductId = null;
let uploadedImages = [];
let currentPage = 1;
const PAGE_SIZE = 15;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB max per image
const MAX_IMAGE_SIDE = 1200;              // High-res optimized WebP
const FALLBACK_IMAGE = '/images/placeholder.webp';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  populateSuppliersDropdown();
  renderProductsTable();
  initImageUpload();
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
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

function renderProductsTable(searchTerm = '') {
  let products = DB.products();

  // Category filter
  const catFilter = document.getElementById('categoryFilter')?.value?.toLowerCase();
  if (catFilter) {
    products = products.filter(p => String(p.category || '').toLowerCase() === catFilter);
  }

  // Audience filter
  const audFilter = document.getElementById('audienceFilter')?.value?.toLowerCase();
  if (audFilter) {
    products = products.filter(p => String(p.audience || 'unisex').toLowerCase() === audFilter);
  }

  // Search filter
  const query = (searchTerm || document.getElementById('productSearch')?.value || '').toLowerCase().trim();
  if (query) {
    products = products.filter(p =>
      String(p.name || '').toLowerCase().includes(query) ||
      String(p.sku || '').toLowerCase().includes(query) ||
      String(p.category || '').toLowerCase().includes(query) ||
      String(p.collection || '').toLowerCase().includes(query) ||
      String(p.material || '').toLowerCase().includes(query)
    );
  }

  const tbody = document.getElementById('productsBody');
  if (!tbody) return;

  const countEl = document.getElementById('productsCount');
  if (countEl) countEl.textContent = `${products.length} products`;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--white-muted);padding:32px;">No products found matching your criteria.</td></tr>';
    renderPagination(0);
    return;
  }

  // Pagination
  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  currentPage = Math.min(currentPage, totalPages || 1);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageProducts = products.slice(startIdx, startIdx + PAGE_SIZE);

  tbody.innerHTML = pageProducts.map(p => {
    const stock = Number(p.stock) || 0;
    const reserved = Number(p.reservedStock) || 0;
    const available = Math.max(0, stock - reserved);
    const reorder = Number(p.reorderLevel) || 5;
    const isArchived = !!p.isArchived;

    const stockStatus = isArchived
      ? '<span class="badge badge-grey">Archived</span>'
      : stock === 0
        ? '<span class="badge badge-red">Out of Stock</span>'
        : available <= reorder
          ? '<span class="badge badge-orange">Low Stock</span>'
          : '<span class="badge badge-green">In Stock</span>';

    return `
      <tr style="${isArchived ? 'opacity: 0.6;' : ''}">
        <td>
          <div class="table-product">
            <div class="table-img" style="position:relative;">
              <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='/images/placeholder.webp'">
            </div>
            <div>
              <div class="table-product-name" style="font-weight:600;">${escapeHtml(p.name)}</div>
              <div class="table-product-sub" style="font-family:monospace; color:var(--gold);">${escapeHtml(p.sku || 'SKU-' + p.id)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-gold" style="text-transform:capitalize;">${escapeHtml(p.category || 'Jewellery')}</span></td>
        <td>
          <div style="font-size:0.85rem; color:var(--white);">${escapeHtml(p.material || 'Standard')}</div>
          <div style="font-size:0.75rem; color:var(--white-muted); text-transform:capitalize;">${escapeHtml(p.audience || 'Unisex')}</div>
        </td>
        <td>
          <strong style="color:var(--gold); font-size:0.95rem;">${formatPrice(p.price)}</strong>
          ${p.costPrice > 0 ? `<div style="font-size:0.75rem; color:var(--white-muted);">Cost: ${formatPrice(p.costPrice)}</div>` : ''}
        </td>
        <td>
          <div class="stock-inline">
            <div>
              <strong>${stock}</strong> <span style="font-size:0.75rem; color:var(--white-muted);">on hand</span>
            </div>
            <div class="stock-bar">
              <div class="stock-bar-fill ${stock > reorder ? (stock > 20 ? 'high' : 'medium') : 'low'}" style="width:${Math.min(100, stock * 2)}%"></div>
            </div>
            <div style="font-size:0.75rem; color:${available > 0 ? 'var(--green)' : 'var(--red)'};">
              ${available} available to sell
            </div>
          </div>
        </td>
        <td>${stockStatus}</td>
        <td>${p.badge ? `<span class="badge badge-green">${escapeHtml(p.badge)}</span>` : '<span style="color:var(--white-muted);font-size:0.8rem;">—</span>'}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-ghost" onclick="editProduct(${Number(p.id)})" title="Edit Product Details" aria-label="Edit product">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn btn-sm ${isArchived ? 'btn-gold' : 'btn-ghost'}" onclick="toggleArchiveProduct(${Number(p.id)}, ${!isArchived})" title="${isArchived ? 'Restore to Catalogue' : 'Archive Product'}" aria-label="Archive toggle">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-archive"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            </button>
            <button class="btn btn-sm btn-danger" onclick="confirmDeleteProduct(${Number(p.id)})" title="Delete Product" aria-label="Delete product">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  let pagEl = document.getElementById('productsPagination');
  if (!pagEl) {
    pagEl = document.createElement('div');
    pagEl.id = 'productsPagination';
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

function changePage(newPage) {
  currentPage = newPage;
  renderProductsTable();
}

function openAddProduct() {
  editingProductId = null;
  uploadedImages = [];
  document.getElementById('modalTitle').textContent = 'Add New Product to Inventory';
  document.getElementById('productForm').reset();
  document.getElementById('pSku').value = 'TAH-' + Math.floor(100000 + Math.random() * 900000);
  document.getElementById('pStock').value = '10';
  document.getElementById('pReorderLevel').value = '5';
  document.getElementById('pStockReason').value = 'Initial Stock Receipt';
  document.getElementById('imagePreviewGrid').innerHTML = '';
  populateSuppliersDropdown();
  openModal('productModal');
}

function editProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  uploadedImages = Array.isArray(p.images) && p.images.length ? [...p.images] : (p.image ? [p.image] : []);

  document.getElementById('modalTitle').textContent = `Edit Product: ${p.name}`;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pPrice').value = p.price ?? '';
  document.getElementById('pCostPrice').value = p.costPrice || '';
  document.getElementById('pOriginalPrice').value = p.originalPrice || '';
  document.getElementById('pCollection').value = p.collection || 'korean';
  document.getElementById('pCategory').value = p.category || 'rings';
  document.getElementById('pMaterial').value = p.material || '';
  document.getElementById('pColor').value = p.color || '';
  document.getElementById('pAudience').value = p.audience || 'unisex';
  document.getElementById('pVariants').value = p.variants ? (Array.isArray(p.variants) ? p.variants.map(v => typeof v === 'object' ? `${v.type}: ${v.options ? v.options.join('/') : ''}` : String(v)).join('; ') : '') : '';
  document.getElementById('pDescription').value = p.description || '';
  document.getElementById('pFeatures').value = (p.features || []).join(', ');
  document.getElementById('pBadge').value = p.badge || '';
  document.getElementById('pSku').value = p.sku || '';
  document.getElementById('pStock').value = p.stock ?? 0;
  document.getElementById('pReorderLevel').value = p.reorderLevel ?? 5;
  document.getElementById('pLocation').value = p.location || 'Main Warehouse';
  document.getElementById('pStockReason').value = 'Stock Correction';
  if (document.getElementById('pSupplier')) {
    document.getElementById('pSupplier').value = p.supplier_id || '';
  }

  renderImagePreviews();
  openModal('productModal');
}

async function saveProduct(e) {
  e.preventDefault();

  const name = document.getElementById('pName').value.trim();
  const price = Number(document.getElementById('pPrice').value);
  const costPrice = Number(document.getElementById('pCostPrice')?.value) || 0;
  const originalPriceRaw = document.getElementById('pOriginalPrice')?.value;
  const originalPrice = originalPriceRaw ? Number(originalPriceRaw) : null;
  const stock = Math.max(0, parseInt(document.getElementById('pStock').value, 10) || 0);
  const reorderLevel = Math.max(0, parseInt(document.getElementById('pReorderLevel').value, 10) || 5);
  const stockReason = document.getElementById('pStockReason')?.value?.trim() || 'Inventory Entry';

  // Validation
  if (!name) {
    showToast('Product name is required', 'error');
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    showToast('Selling price must be greater than 0', 'error');
    return;
  }
  if (originalPrice !== null && originalPrice < price) {
    showToast('Original / Sale price should be equal to or higher than the selling price', 'error');
    return;
  }

  const submitBtn = document.querySelector('#productForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving to Database...';
  }

  try {
    const images = uploadedImages.length ? uploadedImages : [FALLBACK_IMAGE];
    const category = document.getElementById('pCategory').value.trim().toLowerCase();
    const collection = document.getElementById('pCollection').value.trim().toLowerCase();
    const material = document.getElementById('pMaterial').value.trim();
    const color = document.getElementById('pColor')?.value?.trim() || '';
    const audience = document.getElementById('pAudience')?.value || 'unisex';
    const location = document.getElementById('pLocation')?.value?.trim() || 'Main Warehouse';
    const supplierId = document.getElementById('pSupplier')?.value ? Number(document.getElementById('pSupplier').value) : null;
    const badge = document.getElementById('pBadge').value.trim() || null;
    let sku = document.getElementById('pSku').value.trim();
    if (!sku) sku = 'TAH-' + Math.floor(100000 + Math.random() * 900000);

    // Parse variants
    const rawVariants = document.getElementById('pVariants')?.value?.trim();
    let variants = [];
    if (rawVariants) {
      variants = rawVariants.split(';').map(v => {
        const parts = v.split(':');
        if (parts.length === 2) {
          return { type: parts[0].trim(), options: parts[1].split('/').map(o => o.trim()).filter(Boolean) };
        }
        return { type: 'Option', options: [v.trim()] };
      });
    }

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
      variants,
      badge,
      sku,
      stock,
      reorder_level: reorderLevel,
      in_stock: stock > 0,
      images,
      image: images[0]
    };

    // Safely assign category_id ONLY if it's a valid Postgres UUID
    const matchedCat = DB.categories().find(c => (c.slug || '').toLowerCase() === category);
    if (matchedCat && isValidUUID(matchedCat.id)) {
      payload.category_id = matchedCat.id;
    }

    let savedProductId = editingProductId;
    let oldStock = 0;

    if (editingProductId) {
      // Find old stock for ledger history
      const existing = DB.products().find(p => p.id === editingProductId);
      oldStock = existing ? existing.stock : 0;

      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProductId);

      if (error) throw error;

      // If stock changed during edit, record in stock_history ledger
      const stockDiff = stock - oldStock;
      if (stockDiff !== 0) {
        await logStockMovement(editingProductId, name, stockDiff > 0 ? 'restock' : 'adjustment', stockDiff, stock, stockReason);
      }

      await DB.logAudit('UPDATE_PRODUCT', 'products', editingProductId, `Updated "${name}" (Price: Rs. ${price}, Stock: ${stock})`);
      showToast(`Product "${name}" updated successfully!`);

    } else {
      // Create New Product
      const { data: newProd, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      savedProductId = newProd.id;

      // Record initial stock in stock_history ledger
      if (stock > 0) {
        await logStockMovement(newProd.id, name, 'initial_stock', stock, stock, stockReason);
      }

      await DB.logAudit('CREATE_PRODUCT', 'products', savedProductId || sku, `Created "${name}" with initial stock ${stock}`);
      showToast(`Product "${name}" created and added to inventory!`);
    }

    // Invalidate caches and reload
    DB.invalidate();
    await DB.reload();

    closeAllModals();
    renderProductsTable();

  } catch (err) {
    console.error('[Products] Save error:', err);
    showToast('Failed to save product: ' + (err.message || 'Database error'), 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Product';
    }
  }
}

async function logStockMovement(productId, productName, type, changeAmount, newStock, reason) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || 'admin';
    const now = new Date();

    await supabase.from('stock_history').insert([{
      product_id: productId || null,
      product: productName,
      product_name: productName,
      type,
      change_amount: changeAmount,
      new_stock: newStock,
      reason: reason || type,
      user_email: userEmail,
      date: `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`
    }]);
  } catch (e) {
    console.warn('[Products] Non-blocking stock ledger log warning:', e);
  }
}

async function toggleArchiveProduct(id, shouldArchive) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;

  const actionName = shouldArchive ? 'Archive' : 'Restore';
  if (!confirm(`Are you sure you want to ${actionName.toLowerCase()} "${p.name}"?`)) return;

  try {
    const { error } = await supabase
      .from('products')
      .update({ is_archived: shouldArchive, in_stock: shouldArchive ? false : p.stock > 0 })
      .eq('id', id);

    if (error) throw error;

    await DB.logAudit(shouldArchive ? 'ARCHIVE_PRODUCT' : 'RESTORE_PRODUCT', 'products', id, `${actionName} product ${p.name}`);
    showToast(`Product "${p.name}" ${shouldArchive ? 'archived' : 'restored'}!`);

    DB.invalidate();
    await DB.reload();
    renderProductsTable();
  } catch (err) {
    showToast('Action failed: ' + err.message, 'error');
  }
}

function confirmDeleteProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;

  // Safety check: is product referenced in existing orders?
  const hasOrders = DB.orders().some(o => (o.items || []).some(item => String(item.productId) === String(id)));
  if (hasOrders) {
    alert(`Cannot permanently delete "${p.name}" because it is part of existing customer order history.\n\nPlease use "Archive" instead to deactivate the product while preserving business records.`);
    return;
  }

  document.getElementById('deleteProductName').textContent = p.name;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteProduct(id);
  openModal('deleteModal');
}

async function deleteProduct(id) {
  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    await DB.logAudit('DELETE_PRODUCT', 'products', id, `Permanently deleted product ID ${id}`);
    showToast('Product deleted.');

    DB.invalidate();
    await DB.reload();
    closeAllModals();
    renderProductsTable();
  } catch (err) {
    showToast('Could not delete product: ' + err.message, 'error');
  }
}

// ===== MULTI-IMAGE UPLOAD WITH RESIZE & PREVIEWS =====
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
    if (!file.type.startsWith('image/')) {
      showToast(`${file.name} is not a valid image format`, 'error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(`${file.name} exceeds 5 MB limit`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const compressedWebp = await resizeImage(e.target.result);
        uploadedImages.push(compressedWebp);
      } catch (err) {
        console.warn('[Products] Fallback to raw data url:', err);
        uploadedImages.push(e.target.result);
      }
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl, maxSide = MAX_IMAGE_SIDE) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = dataUrl;
  });
}

function renderImagePreviews() {
  const grid = document.getElementById('imagePreviewGrid');
  if (!grid) return;
  grid.innerHTML = uploadedImages.map((src, i) => `
    <div class="image-preview" style="position:relative; width:64px; height:64px; border-radius:6px; overflow:hidden; border:1px solid var(--grey-mid);">
      <img src="${escapeHtml(src)}" alt="Preview ${i + 1}" style="width:100%; height:100%; object-fit:cover;">
      <span class="remove-img" onclick="removeImage(${i})" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.7); color:#fff; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer;" title="Remove Image">✕</span>
    </div>
  `).join('');
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

function searchProducts() {
  renderProductsTable();
}

function filterProducts() {
  renderProductsTable();
}

function exportProductsCSV() {
  const products = DB.products();
  exportTableToCSV(`catalogue_products_${new Date().toISOString().split('T')[0]}`, products, {
    sku: 'SKU',
    name: 'Product Name',
    category: 'Category',
    audience: 'Audience',
    price: 'Selling Price (Rs.)',
    costPrice: 'Cost Price (Rs.)',
    stock: 'Stock On-Hand',
    availableStock: 'Available to Sell',
    location: 'Location'
  });
}
