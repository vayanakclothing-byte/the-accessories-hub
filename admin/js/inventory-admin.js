/* ============================================================
   Inventory Admin — Stock Management & Ledger
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderInventoryStats();
  renderInventoryTable();
  renderStockHistory();
});

function renderInventoryStats() {
  const products = DB.products();
  const inStock = products.filter(p => Number(p.stock) > Number(p.reorderLevel)).length;
  const lowStock = products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.reorderLevel)).length;
  const outOfStock = products.filter(p => Number(p.stock) === 0).length;

  let totalAsset = 0;
  products.forEach(p => {
    const cost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;
    totalAsset += (Number(p.stock) || 0) * cost;
  });

  document.getElementById('inStockCount').textContent = inStock;
  document.getElementById('lowStockCount').textContent = lowStock;
  document.getElementById('outStockCount').textContent = outOfStock;
  if (document.getElementById('totalAssetValue')) {
    document.getElementById('totalAssetValue').textContent = formatPrice(totalAsset);
  }
}

function renderInventoryTable(filter = '') {
  let products = DB.products();
  if (filter === 'low') products = products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.reorderLevel));
  else if (filter === 'out') products = products.filter(p => Number(p.stock) === 0);

  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--white-muted);padding:24px;">No products match this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const stock = Number(p.stock) || 0;
    const reorder = Number(p.reorderLevel) || 0;
    const cost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;
    const status = stock === 0 ? 'out' : stock <= reorder ? 'low' : 'ok';
    const badge = status === 'out'
      ? '<span class="badge badge-red">Out of Stock</span>'
      : status === 'low'
        ? '<span class="badge badge-orange">Low Stock</span>'
        : '<span class="badge badge-green">In Stock</span>';

    return `
      <tr>
        <td>
          <div class="table-product">
            <div class="table-img"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>
            <div>
              <div class="table-product-name">${escapeHtml(p.name)}</div>
              <div class="table-product-sub">${escapeHtml(p.sku || 'SKU-' + p.id)}</div>
            </div>
          </div>
        </td>
        <td><strong>${formatPrice(cost)}</strong></td>
        <td>
          <div class="stock-inline">
            <strong>${stock}</strong>
            <div class="stock-bar"><div class="stock-bar-fill ${status === 'ok' ? 'high' : status === 'low' ? 'medium' : 'low'}" style="width:${Math.min(100, stock * 2)}%"></div></div>
          </div>
        </td>
        <td>${reorder}</td>
        <td>${badge}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-sm btn-ghost" onclick="adjustStock(${Number(p.id)}, -1)" ${stock === 0 ? 'disabled' : ''}>−</button>
            <input type="number" value="${stock}" min="0" style="width:60px;text-align:center;background:var(--grey);border:1px solid var(--grey-mid);border-radius:6px;color:var(--white);padding:6px;font-size:0.85rem;" onchange="setStock(${Number(p.id)}, this.value)">
            <button class="btn btn-sm btn-ghost" onclick="adjustStock(${Number(p.id)}, 1)">+</button>
            <button class="btn btn-sm btn-outline" onclick="restockProduct(${Number(p.id)})">+20</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function adjustStock(id, delta) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const newStock = Math.max(0, (Number(p.stock) || 0) + delta);

  const { error } = await supabase.from('products').update({ stock: newStock, in_stock: newStock > 0 }).eq('id', id);
  if (error) { showToast('Could not update stock: ' + error.message, 'error'); return; }

  await logStockChange(p.name, delta > 0 ? 'restock' : 'adjustment', delta, newStock);
  await DB.logAudit('ADJUST_STOCK', 'inventory', id, `${p.name}: ${delta > 0 ? '+' : ''}${delta} units`);
  await DB.reload();
  renderInventoryTable();
  renderInventoryStats();
  renderStockHistory();
}

async function setStock(id, value) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const oldStock = Number(p.stock) || 0;
  const newStock = Math.max(0, parseInt(value, 10) || 0);
  if (newStock === oldStock) return;

  const { error } = await supabase.from('products').update({ stock: newStock, in_stock: newStock > 0 }).eq('id', id);
  if (error) { showToast('Could not update stock: ' + error.message, 'error'); return; }

  const diff = newStock - oldStock;
  await logStockChange(p.name, 'adjustment', diff, newStock);
  await DB.logAudit('SET_STOCK', 'inventory', id, `${p.name}: manual set to ${newStock} (${diff > 0 ? '+' : ''}${diff})`);
  await DB.reload();
  renderInventoryTable();
  renderInventoryStats();
  renderStockHistory();
  showToast(`Stock updated for ${p.name}`);
}

async function restockProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const amount = 20;
  const newStock = (Number(p.stock) || 0) + amount;

  const { error } = await supabase.from('products').update({ stock: newStock, in_stock: true }).eq('id', id);
  if (error) { showToast('Could not restock: ' + error.message, 'error'); return; }

  await logStockChange(p.name, 'restock', amount, newStock);
  await DB.logAudit('RESTOCK_PRODUCT', 'inventory', id, `${p.name}: restocked +${amount} units`);
  await DB.reload();
  renderInventoryTable();
  renderInventoryStats();
  renderStockHistory();
  showToast(`Restocked ${p.name} with +${amount} units`, 'info');
}

async function logStockChange(product, type, change, newStock) {
  const now = new Date();
  const { error } = await supabase.from('stock_history').insert([{
    product,
    product_name: product,
    type,
    change_amount: change,
    new_stock: newStock,
    date: `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`
  }]);
  if (error) console.warn('[Inventory] Could not write stock history:', error.message);
}

function renderStockHistory() {
  const history = DB.stockHistory().slice(0, 10);
  const container = document.getElementById('stockTimeline');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<p style="color:var(--white-muted);font-size:0.85rem;">No stock movements recorded yet.</p>';
    return;
  }

  container.innerHTML = history.map(h => {
    const change = Number(h.change) || 0;
    return `
    <div class="timeline-item">
      <div class="time">${escapeHtml(h.date || '—')}</div>
      <div class="event">
        <strong>${escapeHtml(h.product || '—')}</strong> — ${escapeHtml(h.type || 'Movement')}
        <span style="color:${change > 0 ? 'var(--green)' : 'var(--red)'}; font-weight:600;">${change > 0 ? '+' : ''}${change}</span>
        → On-Hand: <strong>${Number(h.newStock) || 0}</strong>
      </div>
    </div>
  `;
  }).join('');
}

function filterInventory(type, evt) {
  const clicked = (evt && evt.currentTarget) || (typeof event !== 'undefined' ? event.target : null);
  document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
  clicked?.classList.add('active');
  renderInventoryTable(type);
}

function exportInventoryCSV() {
  const products = DB.products();
  exportTableToCSV(`inventory_ledger_${new Date().toISOString().split('T')[0]}`, products, {
    sku: 'SKU',
    name: 'Product Name',
    category: 'Category',
    stock: 'Stock On-Hand',
    reorderLevel: 'Reorder Level',
    price: 'Retail Price (Rs.)',
    costPrice: 'Unit Cost (Rs.)',
    inStock: 'In Stock'
  });
}
