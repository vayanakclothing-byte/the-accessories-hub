/* ============================================================
   Products Admin — CRUD with Multi-Image
   ============================================================ */
let editingProductId = null;
let uploadedImages = [];

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;   // reject sources bigger than this
const MAX_IMAGE_SIDE = 1000;                // stored images are resized to this
const FALLBACK_IMAGE = 'images/temple-necklace.png';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderProductsTable();
  initImageUpload();
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
});

function renderProductsTable(filter = '') {
  let products = DB.products();
  const catFilter = document.getElementById('categoryFilter')?.value?.toLowerCase();
  if (catFilter) {
    products = products.filter(p => String(p.category || '').toLowerCase() === catFilter);
  }
  if (filter) {
    const needle = filter.toLowerCase();
    products = products.filter(p =>
      String(p.name || '').toLowerCase().includes(needle) ||
      String(p.collection || '').toLowerCase().includes(needle) ||
      String(p.category || '').toLowerCase().includes(needle)
    );
  }

  const tbody = document.getElementById('productsBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--white-muted);padding:24px;">No products yet.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const stock = Number(p.stock) || 0;
    const reorder = Number(p.reorderLevel) || 0;
    return `
    <tr>
      <td>
        <div class="table-product">
          <div class="table-img"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>
          <div>
            <div class="table-product-name">${escapeHtml(p.name)}</div>
            <div class="table-product-sub">${escapeHtml(p.sku || '—')}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-gold">${escapeHtml(p.collection || '—')}</span></td>
      <td>${escapeHtml(p.category || '—')}</td>
      <td><strong style="color:var(--gold)">${formatPrice(p.price)}</strong></td>
      <td>
        <div class="stock-inline">
          <span>${stock}</span>
          <div class="stock-bar"><div class="stock-bar-fill ${stock > reorder ? (stock > 20 ? 'high' : 'medium') : 'low'}" style="width:${Math.min(100, stock * 2)}%"></div></div>
        </div>
      </td>
      <td>${p.badge ? `<span class="badge badge-green">${escapeHtml(p.badge)}</span>` : '<span class="badge badge-grey">None</span>'}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="editProduct(${Number(p.id)})" title="Edit" aria-label="Edit product">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteProduct(${Number(p.id)})" title="Delete" aria-label="Delete product">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  const count = document.getElementById('productsCount');
  if (count) count.textContent = `${products.length} products`;
}

function openAddProduct() {
  editingProductId = null;
  uploadedImages = [];
  document.getElementById('modalTitle').textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  document.getElementById('imagePreviewGrid').innerHTML = '';
  openModal('productModal');
}

function editProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  uploadedImages = Array.isArray(p.images) && p.images.length ? [...p.images] : (p.image ? [p.image] : []);

  document.getElementById('modalTitle').textContent = 'Edit Product';
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pPrice').value = p.price ?? '';
  document.getElementById('pCostPrice').value = p.costPrice ?? (p.cost_price ?? '');
  document.getElementById('pOriginalPrice').value = p.originalPrice ?? '';
  document.getElementById('pCollection').value = p.collection || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pMaterial').value = p.material || '';
  document.getElementById('pDescription').value = p.description || '';
  document.getElementById('pFeatures').value = (p.features || []).join(', ');
  document.getElementById('pBadge').value = p.badge || '';
  document.getElementById('pSku').value = p.sku || '';
  document.getElementById('pStock').value = p.stock ?? 0;
  document.getElementById('pReorderLevel').value = p.reorderLevel ?? 5;

  renderImagePreviews();
  openModal('productModal');
}

async function saveProduct(e) {
  e.preventDefault();

  const name = document.getElementById('pName').value.trim();
  const price = Number(document.getElementById('pPrice').value);
  if (!name) { showToast('Product name is required', 'error'); return; }
  if (!Number.isFinite(price) || price < 0) { showToast('Enter a valid price', 'error'); return; }

  const stock = Math.max(0, parseInt(document.getElementById('pStock').value, 10) || 0);
  const originalPriceRaw = document.getElementById('pOriginalPrice').value;
  const costPriceRaw = document.getElementById('pCostPrice')?.value;
  const images = uploadedImages.length ? uploadedImages : [FALLBACK_IMAGE];

  const data = {
    name,
    price,
    cost_price: costPriceRaw ? Number(costPriceRaw) : 0,
    original_price: originalPriceRaw ? Number(originalPriceRaw) : null,
    collection: document.getElementById('pCollection').value.trim(),
    category: document.getElementById('pCategory').value.trim().toLowerCase(),
    material: document.getElementById('pMaterial').value.trim(),
    description: document.getElementById('pDescription').value.trim(),
    features: document.getElementById('pFeatures').value.split(',').map(f => f.trim()).filter(Boolean),
    badge: document.getElementById('pBadge').value.trim() || null,
    sku: document.getElementById('pSku').value.trim(),
    stock,
    reorder_level: Math.max(0, parseInt(document.getElementById('pReorderLevel').value, 10) || 0),
    in_stock: stock > 0,
    images,
    image: images[0]
  };

  const matchedCat = DB.categories().find(c => (c.slug || '').toLowerCase() === data.category);
  if (matchedCat && matchedCat.id) {
    data.category_id = matchedCat.id;
  }

  if (!data.sku) data.sku = 'TAH-' + Math.floor(100000 + Math.random() * 900000);

  const { error } = editingProductId
    ? await supabase.from('products').update(data).eq('id', editingProductId)
    : await supabase.from('products').insert([data]);

  if (error) {
    showToast('Could not save the product: ' + error.message, 'error');
    return;
  }

  await DB.logAudit(editingProductId ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', 'products', editingProductId || data.sku, `Saved product "${name}" (Price: Rs. ${price})`);
  showToast(editingProductId ? 'Product updated successfully!' : 'Product added successfully!');
  await DB.reload();
  closeAllModals();
  renderProductsTable();
}

function exportProductsCSV() {
  const products = DB.products();
  exportTableToCSV(`catalogue_products_${new Date().toISOString().split('T')[0]}`, products, {
    id: 'Product ID',
    sku: 'SKU',
    name: 'Product Name',
    category: 'Category',
    collection: 'Collection',
    price: 'Selling Price (Rs.)',
    costPrice: 'Cost Price (Rs.)',
    stock: 'Stock On-Hand',
    inStock: 'In Stock'
  });
}

function confirmDeleteProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  document.getElementById('deleteProductName').textContent = p.name;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteProduct(id);
  openModal('deleteModal');
}

async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    showToast('Could not delete the product: ' + error.message, 'error');
    return;
  }
  await DB.reload();
  closeAllModals();
  renderProductsTable();
  showToast('Product deleted.', 'error');
}

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
      showToast(`${file.name} is not an image`, 'error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(`${file.name} is larger than 8 MB`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        uploadedImages.push(await resizeImage(e.target.result));
      } catch (err) {
        console.warn('[Products] Could not resize image, storing original:', err);
        uploadedImages.push(e.target.result);
      }
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

// Product images are stored in the products row, so shrink them before saving.
// (A Supabase Storage bucket with public URLs would be the better long-term home.)
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
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/webp', 0.82));
    };
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = dataUrl;
  });
}

function renderImagePreviews() {
  const grid = document.getElementById('imagePreviewGrid');
  if (!grid) return;
  grid.innerHTML = uploadedImages.map((src, i) => `
    <div class="image-preview">
      <img src="${escapeHtml(src)}" alt="Preview ${i + 1}">
      <span class="remove-img" onclick="removeImage(${i})">✕</span>
    </div>
  `).join('');
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

function searchProducts() {
  const q = document.getElementById('productSearch')?.value || '';
  renderProductsTable(q);
}

function filterProducts() {
  const q = document.getElementById('productSearch')?.value || '';
  renderProductsTable(q);
}
window.filterProducts = filterProducts;
