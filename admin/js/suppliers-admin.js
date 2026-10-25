/* ============================================================
   THE ACCESSORIES HUB — Suppliers & Purchase Order Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderSuppliersModule();
});

function switchTab(tab) {
  const isPos = tab === 'pos';
  document.getElementById('tabBtnPOs')?.classList.toggle('active', isPos);
  document.getElementById('tabBtnSuppliers')?.classList.toggle('active', !isPos);
  document.getElementById('tabContentPOs').style.display = isPos ? 'block' : 'none';
  document.getElementById('tabContentSuppliers').style.display = isPos ? 'none' : 'block';
}

function renderSuppliersModule() {
  const suppliers = DB.suppliers();
  const pos = DB.purchaseOrders();

  // KPIs
  document.getElementById('statSupplierCount').textContent = suppliers.length;
  document.getElementById('statActivePOCount').textContent = pos.filter(p => p.status !== 'received' && p.status !== 'cancelled').length;
  document.getElementById('statReceivedPOCount').textContent = pos.filter(p => p.status === 'received').length;
  const totalProcured = pos.filter(p => p.status === 'received').reduce((sum, p) => sum + (p.total || 0), 0);
  document.getElementById('statTotalProcured').textContent = formatPrice(totalProcured);

  renderPOTable(pos);
  renderSuppliersTable(suppliers);
}

function renderPOTable(pos) {
  const tbody = document.getElementById('poTableBody');
  if (!tbody) return;

  if (pos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--white-muted);">No purchase orders issued yet. Click "+ Create Purchase Order" to begin.</td></tr>';
    return;
  }

  tbody.innerHTML = pos.map(po => `
    <tr>
      <td><strong style="color:var(--gold-dark);">${escapeHtml(po.po_number || '#' + po.id)}</strong></td>
      <td><strong>${escapeHtml(po.supplier_name || '—')}</strong></td>
      <td>${formatDate(po.orderDate)}</td>
      <td>${escapeHtml(po.expectedDate || '—')}</td>
      <td><strong>${formatPrice(po.total)}</strong></td>
      <td>${statusBadge(po.status)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          ${po.status === 'draft' ? `<button onclick="updatePOStatus(${po.id}, 'approved')" class="btn btn-sm btn-outline">Approve</button>` : ''}
          ${po.status === 'approved' ? `<button onclick="updatePOStatus(${po.id}, 'ordered')" class="btn btn-sm btn-gold">Send</button>` : ''}
          ${po.status === 'ordered' || po.status === 'partially_received' ? `<button onclick="receivePurchaseOrder(${po.id})" class="btn btn-sm btn-gold" style="background:var(--green);border-color:var(--green);">Receive Goods</button>` : ''}
          ${po.status !== 'received' && po.status !== 'cancelled' ? `<button onclick="updatePOStatus(${po.id}, 'cancelled')" class="btn btn-sm btn-danger">Cancel</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderSuppliersTable(suppliers) {
  const tbody = document.getElementById('suppliersTableBody');
  if (!tbody) return;

  if (suppliers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--white-muted);">No suppliers added yet.</td></tr>';
    return;
  }

  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${escapeHtml(s.contact_name || '—')}</td>
      <td>${escapeHtml(s.phone || '—')}</td>
      <td>${escapeHtml(s.email || '—')}</td>
      <td><span class="badge badge-grey">${escapeHtml(s.payment_terms || 'Net 30')}</span></td>
      <td>${s.lead_time_days || 7} days</td>
      <td>
        <button onclick="editSupplier(${s.id})" class="btn btn-sm btn-outline"><i data-lucide="edit" style="width:14px;height:14px;"></i> Edit</button>
      </td>
    </tr>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function openSupplierModal() {
  document.getElementById('supplierForm').reset();
  document.getElementById('suppId').value = '';
  document.getElementById('supplierModalTitle').textContent = 'Add Supplier';
  openModal('supplierModal');
}

function editSupplier(id) {
  const s = DB.suppliers().find(x => x.id === id);
  if (!s) return;
  document.getElementById('suppId').value = s.id;
  document.getElementById('suppName').value = s.name;
  document.getElementById('suppContact').value = s.contact_name || '';
  document.getElementById('suppPhone').value = s.phone || '';
  document.getElementById('suppEmail').value = s.email || '';
  document.getElementById('suppTerms').value = s.payment_terms || 'Net 30';
  document.getElementById('suppAddress').value = s.address || '';
  document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
  openModal('supplierModal');
}

async function saveSupplier(e) {
  e.preventDefault();
  const id = document.getElementById('suppId').value;
  const payload = {
    name: document.getElementById('suppName').value.trim(),
    contact_name: document.getElementById('suppContact').value.trim(),
    phone: document.getElementById('suppPhone').value.trim(),
    email: document.getElementById('suppEmail').value.trim(),
    payment_terms: document.getElementById('suppTerms').value,
    address: document.getElementById('suppAddress').value.trim()
  };

  showToast('Saving supplier...', 'info');
  let err = null;
  if (id) {
    const { error } = await supabase.from('suppliers').update(payload).eq('id', id);
    err = error;
  } else {
    const { error } = await supabase.from('suppliers').insert([payload]);
    err = error;
  }

  if (err) {
    showToast('Failed to save supplier: ' + err.message, 'error');
  } else {
    await DB.logAudit(id ? 'UPDATE_SUPPLIER' : 'CREATE_SUPPLIER', 'suppliers', id || 'new', payload.name);
    showToast('Supplier saved successfully!');
    closeAllModals();
    await DB.reload();
    renderSuppliersModule();
  }
}

function openCreatePOModal() {
  const suppliers = DB.suppliers();
  const select = document.getElementById('poSupplierSelect');
  select.innerHTML = '<option value="">Select Supplier...</option>' + suppliers.map(s => `
    <option value="${s.id}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>
  `).join('');

  document.getElementById('poForm').reset();
  const container = document.getElementById('poItemsContainer');
  container.innerHTML = '';
  addPOItemRow();
  calculatePOTotal();
  openModal('poModal');
}

function addPOItemRow() {
  const container = document.getElementById('poItemsContainer');
  const products = DB.products();
  const rowId = 'poRow_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'form-row';
  row.style.marginBottom = '8px';
  row.innerHTML = `
    <div style="flex:2;">
      <select class="form-select po-item-prod" onchange="onPOItemProductChange('${rowId}')" required>
        <option value="">Select Product...</option>
        ${products.map(p => `<option value="${p.id}" data-cost="${p.costPrice || p.price * 0.45}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)} (Stock: ${p.stock})</option>`).join('')}
      </select>
    </div>
    <div style="flex:1;">
      <input type="number" class="form-input po-item-qty" placeholder="Qty" min="1" value="10" oninput="calculatePOTotal()" required>
    </div>
    <div style="flex:1;">
      <input type="number" class="form-input po-item-cost" placeholder="Unit Cost" min="0" value="0" oninput="calculatePOTotal()" required>
    </div>
    <div style="flex:0 0 36px;">
      <button type="button" class="btn btn-danger btn-icon" onclick="document.getElementById('${rowId}').remove(); calculatePOTotal();">✕</button>
    </div>
  `;
  container.appendChild(row);
}

function onPOItemProductChange(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const select = row.querySelector('.po-item-prod');
  const selectedOpt = select.options[select.selectedIndex];
  const cost = selectedOpt.getAttribute('data-cost');
  if (cost) {
    row.querySelector('.po-item-cost').value = Math.round(Number(cost));
  }
  calculatePOTotal();
}

function calculatePOTotal() {
  let subtotal = 0;
  document.querySelectorAll('#poItemsContainer .form-row').forEach(row => {
    const qty = Number(row.querySelector('.po-item-qty')?.value) || 0;
    const cost = Number(row.querySelector('.po-item-cost')?.value) || 0;
    subtotal += qty * cost;
  });
  const shipping = Number(document.getElementById('poShippingCost')?.value) || 0;
  const total = subtotal + shipping;
  document.getElementById('poTotalDisplay').textContent = formatPrice(total);
}

async function savePurchaseOrder(e) {
  e.preventDefault();
  const suppSelect = document.getElementById('poSupplierSelect');
  const supplierId = suppSelect.value;
  const supplierName = suppSelect.options[suppSelect.selectedIndex]?.getAttribute('data-name') || '';

  const expectedDate = document.getElementById('poExpectedDate').value;
  const shipping = Number(document.getElementById('poShippingCost').value) || 0;
  const notes = document.getElementById('poNotes').value.trim();

  // Gather items
  const items = [];
  let subtotal = 0;
  document.querySelectorAll('#poItemsContainer .form-row').forEach(row => {
    const select = row.querySelector('.po-item-prod');
    const prodId = Number(select.value);
    const prodName = select.options[select.selectedIndex]?.getAttribute('data-name') || '';
    const qty = Number(row.querySelector('.po-item-qty')?.value) || 1;
    const cost = Number(row.querySelector('.po-item-cost')?.value) || 0;
    const itemTotal = qty * cost;
    subtotal += itemTotal;
    if (prodId) {
      items.push({
        product_id: prodId,
        product_name: prodName,
        ordered_qty: qty,
        unit_cost: cost,
        total_cost: itemTotal
      });
    }
  });

  if (items.length === 0) {
    showToast('Please add at least one product to the purchase order.', 'error');
    return;
  }

  const poNumber = 'PO-' + Date.now().toString().slice(-6);
  const total = subtotal + shipping;

  showToast('Creating purchase order...', 'info');

  const { data: po, error: poErr } = await supabase.from('purchase_orders').insert([{
    po_number: poNumber,
    supplier_id: supplierId || null,
    supplier_name: supplierName,
    status: 'draft',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: expectedDate || null,
    subtotal,
    shipping,
    total,
    notes
  }]).select('id').single();

  if (poErr) {
    showToast('Failed to create PO: ' + poErr.message, 'error');
    return;
  }

  // Insert items
  const poItemsPayload = items.map(i => ({ ...i, po_id: po.id }));
  await supabase.from('purchase_order_items').insert(poItemsPayload);

  await DB.logAudit('CREATE_PURCHASE_ORDER', 'purchase_orders', po.id, `Created ${poNumber} for ${supplierName} (Total: Rs. ${total})`);
  showToast(`Purchase order ${poNumber} created successfully!`);
  closeAllModals();
  await DB.reload();
  renderSuppliersModule();
}

async function updatePOStatus(poId, newStatus) {
  showToast(`Updating status to ${newStatus}...`, 'info');
  const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId);
  if (error) {
    showToast('Error updating PO: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('UPDATE_PO_STATUS', 'purchase_orders', poId, `Transitioned to ${newStatus}`);
  showToast(`Purchase Order marked as ${newStatus}!`);
  await DB.reload();
  renderSuppliersModule();
}

async function receivePurchaseOrder(poId) {
  const po = DB.purchaseOrders().find(p => p.id === poId);
  if (!po) return;

  if (!confirm(`Confirm receipt of goods for PO #${po.po_number || po.id}? This will safely increase stock in the inventory ledger.`)) {
    return;
  }

  showToast('Receiving items and updating stock...', 'info');

  // Restock each item
  const today = new Date().toISOString().split('T')[0];
  const items = po.items || [];

  for (const item of items) {
    const prodId = item.product_id;
    const qty = Number(item.ordered_qty) || 0;
    if (prodId && qty > 0) {
      const prod = DB.products().find(p => p.id === prodId);
      const currentStock = prod ? (Number(prod.stock) || 0) : 0;
      const newStock = currentStock + qty;

      await supabase.from('products').update({
        stock: newStock,
        in_stock: true,
        cost_price: item.unit_cost > 0 ? item.unit_cost : undefined
      }).eq('id', prodId);

      await supabase.from('stock_history').insert([{
        product: item.product_name,
        product_name: item.product_name,
        type: 'Purchase Receipt',
        change_amount: qty,
        new_stock: newStock,
        date: today
      }]);
    }
  }

  // Update PO status to received
  await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', poId);

  await DB.logAudit('RECEIVE_PO', 'purchase_orders', poId, `Received stock for PO #${po.po_number || poId}`);
  showToast(`Purchase Order #${po.po_number || poId} received! Stock updated.`);
  await DB.reload();
  renderSuppliersModule();
}

function exportPOsCSV() {
  const pos = DB.purchaseOrders();
  exportTableToCSV(`purchase_orders_${new Date().toISOString().split('T')[0]}`, pos, {
    po_number: 'PO Number',
    supplier_name: 'Supplier',
    orderDate: 'Order Date',
    expectedDate: 'Expected Delivery',
    total: 'Total Cost (Rs.)',
    status: 'Status'
  });
}
