/* ============================================================
   Inventory Admin — Stock Management
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderInventoryStats();
  renderInventoryTable();
  renderStockHistory();
});

function renderInventoryStats() {
  const products = DB.products();
  const inStock = products.filter(p => p.stock > p.reorderLevel).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.reorderLevel).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  document.getElementById('inStockCount').textContent = inStock;
  document.getElementById('lowStockCount').textContent = lowStock;
  document.getElementById('outStockCount').textContent = outOfStock;
}

function renderInventoryTable(filter = '') {
  let products = DB.products();
  if (filter === 'low') products = products.filter(p => p.stock > 0 && p.stock <= p.reorderLevel);
  else if (filter === 'out') products = products.filter(p => p.stock === 0);

  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;

  tbody.innerHTML = products.map(p => {
    const status = p.stock === 0 ? 'out' : p.stock <= p.reorderLevel ? 'low' : 'ok';
    const statusBadge = status === 'out' ? '<span class="badge badge-red">Out of Stock</span>' : status === 'low' ? '<span class="badge badge-orange">Low Stock</span>' : '<span class="badge badge-green">In Stock</span>';
    return `
      <tr>
        <td>
          <div class="table-product">
            <div class="table-img"><img src="${p.image}" alt="${p.name}"></div>
            <div><div class="table-product-name">${p.name}</div><div class="table-product-sub">${p.sku}</div></div>
          </div>
        </td>
        <td>
          <div class="stock-inline">
            <strong>${p.stock}</strong>
            <div class="stock-bar"><div class="stock-bar-fill ${status === 'ok' ? 'high' : status === 'low' ? 'medium' : 'low'}" style="width:${Math.min(100, p.stock * 2)}%"></div></div>
          </div>
        </td>
        <td>${p.reorderLevel}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-sm btn-ghost" onclick="adjustStock(${p.id}, -1)" ${p.stock===0?'disabled':''}>−</button>
            <input type="number" value="${p.stock}" min="0" style="width:60px;text-align:center;background:var(--grey);border:1px solid var(--grey-mid);border-radius:6px;color:var(--white);padding:6px;font-size:0.85rem;" onchange="setStock(${p.id}, this.value)" id="stockInput${p.id}">
            <button class="btn btn-sm btn-ghost" onclick="adjustStock(${p.id}, 1)">+</button>
            <button class="btn btn-sm btn-outline" onclick="restockProduct(${p.id})">Restock</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function adjustStock(id, delta) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const newStock = Math.max(0, p.stock + delta);
  await supabase.from('products').update({stock: newStock, in_stock: newStock > 0}).eq('id', id);
  await logStockChange(p.name, delta > 0 ? 'restock' : 'adjustment', delta, newStock);
  await loadData();
  renderInventoryTable();
  renderInventoryStats();
}

async function setStock(id, value) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const oldStock = p.stock;
  const newStock = Math.max(0, parseInt(value) || 0);
  await supabase.from('products').update({stock: newStock, in_stock: newStock > 0}).eq('id', id);
  await logStockChange(p.name, 'adjustment', newStock - oldStock, newStock);
  await loadData();
  renderInventoryStats();
  showToast(`Stock updated for ${p.name}`);
}

async function restockProduct(id) {
  const p = DB.products().find(x => x.id === id);
  if (!p) return;
  const amount = 20;
  await supabase.from('products').update({stock: p.stock + amount, in_stock: true}).eq('id', id);
  await logStockChange(p.name, 'restock', amount, p.stock + amount);
  await loadData();
  renderInventoryTable();
  renderInventoryStats();
  showToast(`Restocked ${p.name} with +${amount} units`, 'info');
}

async function logStockChange(product, type, change, newStock) {
  const now = new Date();
  await supabase.from('stock_history').insert([{
    product, type, change_amount: change, new_stock: newStock,
    date: `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0,5)}`
  }]);
}

function renderStockHistory() {
  const history = DB.stockHistory().slice(0, 8);
  const container = document.getElementById('stockTimeline');
  if (!container) return;

  container.innerHTML = history.map(h => `
    <div class="timeline-item">
      <div class="time">${h.date}</div>
      <div class="event">
        <strong>${h.product}</strong> — ${h.type === 'restock' ? '📦 Restocked' : h.type === 'sale' ? '🛒 Sold' : '🔧 Adjusted'}
        <span style="color:${h.change > 0 ? 'var(--green)' : 'var(--red)'};">${h.change > 0 ? '+' : ''}${h.change}</span>
        → Stock: ${h.newStock}
      </div>
    </div>
  `).join('');
}

function filterInventory(type) {
  document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderInventoryTable(type);
}
