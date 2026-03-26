/* ============================================================
   Products Admin — CRUD with Multi-Image
   ============================================================ */
let editingProductId = null;
let uploadedImages = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderProductsTable();
  initImageUpload();
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
});

function renderProductsTable(filter = '') {
  let products = DB.products();
  if (filter) products = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()) || p.collection.includes(filter.toLowerCase()));

  const tbody = document.getElementById('productsBody');
  if (!tbody) return;

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <div class="table-product">
          <div class="table-img"><img src="${p.image}" alt="${p.name}"></div>
          <div>
            <div class="table-product-name">${p.name}</div>
            <div class="table-product-sub">${p.sku}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-gold">${p.collection}</span></td>
      <td>${p.category}</td>
      <td><strong style="color:var(--gold)">${formatPrice(p.price)}</strong></td>
      <td>
        <div class="stock-inline">
          <span>${p.stock}</span>
          <div class="stock-bar"><div class="stock-bar-fill ${p.stock > p.reorderLevel ? (p.stock > 20 ? 'high' : 'medium') : 'low'}" style="width:${Math.min(100, p.stock * 2)}%"></div></div>
        </div>
      </td>
      <td>${p.badge ? `<span class="badge badge-green">${p.badge}</span>` : '<span class="badge badge-grey">None</span>'}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="editProduct(${p.id})" title="Edit">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteProduct(${p.id})" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('productsCount').textContent = `${products.length} products`;
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
  uploadedImages = p.images || [p.image];
  document.getElementById('modalTitle').textContent = 'Edit Product';
  document.getElementById('pName').value = p.name;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pOriginalPrice').value = p.originalPrice || '';
  document.getElementById('pCollection').value = p.collection;
  document.getElementById('pCategory').value = p.category;
  document.getElementById('pMaterial').value = p.material;
  document.getElementById('pDescription').value = p.description;
  document.getElementById('pFeatures').value = (p.features || []).join(', ');
  document.getElementById('pBadge').value = p.badge || '';
  document.getElementById('pSku').value = p.sku || '';
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pReorderLevel').value = p.reorderLevel;
  renderImagePreviews();
  openModal('productModal');
}

async function saveProduct(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('pName').value,
    price: Number(document.getElementById('pPrice').value),
    original_price: document.getElementById('pOriginalPrice').value ? Number(document.getElementById('pOriginalPrice').value) : null,
    collection: document.getElementById('pCollection').value,
    category: document.getElementById('pCategory').value,
    material: document.getElementById('pMaterial').value,
    description: document.getElementById('pDescription').value,
    features: document.getElementById('pFeatures').value.split(',').map(f => f.trim()).filter(f => f),
    badge: document.getElementById('pBadge').value || null,
    sku: document.getElementById('pSku').value,
    stock: Number(document.getElementById('pStock').value),
    reorder_level: Number(document.getElementById('pReorderLevel').value),
    in_stock: Number(document.getElementById('pStock').value) > 0,
    images: uploadedImages.length ? uploadedImages : ['images/temple-necklace.png'],
    image: uploadedImages.length ? uploadedImages[0] : 'images/temple-necklace.png'
  };

  if (editingProductId) {
    await supabase.from('products').update(data).eq('id', editingProductId);
    showToast('Product updated successfully!');
  } else {
    data.sku = 'SKU-' + Math.floor(Math.random() * 10000);
    await supabase.from('products').insert([data]);
    showToast('Product added successfully!');
  }

  await loadData();
  closeAllModals();
  renderProductsTable();
}

function confirmDeleteProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  document.getElementById('deleteProductName').textContent = p.name;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteProduct(id);
  openModal('deleteModal');
}

async function deleteProduct(id) {
  await supabase.from('products').delete().eq('id', id);
  await loadData();
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
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.push(e.target.result);
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderImagePreviews() {
  const grid = document.getElementById('imagePreviewGrid');
  if (!grid) return;
  grid.innerHTML = uploadedImages.map((src, i) => `
    <div class="image-preview">
      <img src="${src}" alt="Preview ${i+1}">
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
