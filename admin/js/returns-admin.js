/* ============================================================
   THE ACCESSORIES HUB — Returns & Refunds Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderReturnsModule();
});

function renderReturnsModule() {
  const returns = DB.returnsRefunds();
  const orders = DB.orders();

  const pending = returns.filter(r => r.status === 'requested' || r.status === 'approved');
  const restocked = returns.filter(r => r.status === 'restocked');
  const totalRefunded = returns.filter(r => r.status === 'refunded' || r.status === 'restocked').reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const returnRate = orders.length > 0 ? ((returns.length / orders.length) * 100).toFixed(1) : 0;

  document.getElementById('statPendingReturns').textContent = pending.length;
  document.getElementById('statRestockedCount').textContent = restocked.length;
  document.getElementById('statTotalRefunded').textContent = formatPrice(totalRefunded);
  document.getElementById('statReturnRate').textContent = `${returnRate}%`;

  renderReturnsTable(returns);
}

function renderReturnsTable(returns) {
  const tbody = document.getElementById('returnsTableBody');
  if (!tbody) return;

  if (returns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--white-muted);">No returns or refunds logged.</td></tr>';
    return;
  }

  tbody.innerHTML = returns.map(r => `
    <tr>
      <td><strong style="color:var(--gold-dark);">${escapeHtml(r.return_number || '#' + r.id)}</strong></td>
      <td><strong>#${escapeHtml(r.order_id)}</strong></td>
      <td>
        <div style="font-weight:600; color:var(--white);">${escapeHtml(r.customer_name || 'Customer')}</div>
        <div style="font-size:0.72rem; color:var(--white-muted);">${escapeHtml(r.customer_phone || '—')}</div>
      </td>
      <td><span class="badge badge-grey">${escapeHtml(r.type || 'return')}</span></td>
      <td>${escapeHtml(r.reason || '—')}</td>
      <td><span class="badge ${r.condition === 'good' || r.condition === 'unopened' ? 'badge-green' : 'badge-orange'}">${escapeHtml(r.condition || 'good')}</span></td>
      <td><strong>${formatPrice(r.refundAmount)}</strong></td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          ${r.status === 'requested' ? `<button onclick="updateReturnStatus(${r.id}, 'approved')" class="btn btn-sm btn-outline">Approve</button>` : ''}
          ${r.status === 'approved' ? `<button onclick="updateReturnStatus(${r.id}, 'received')" class="btn btn-sm btn-gold">Receive</button>` : ''}
          ${r.status === 'received' ? `<button onclick="completeRestockAndRefund(${r.id})" class="btn btn-sm btn-gold" style="background:var(--green);border-color:var(--green);">Refund & Restock</button>` : ''}
          ${r.status !== 'refunded' && r.status !== 'restocked' && r.status !== 'rejected' ? `<button onclick="updateReturnStatus(${r.id}, 'rejected')" class="btn btn-sm btn-danger">Reject</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function openNewReturnModal() {
  const orders = DB.orders();
  const select = document.getElementById('retOrderSelect');
  select.innerHTML = '<option value="">Select Order...</option>' + orders.map(o => `
    <option value="${o.id}" data-name="${escapeHtml(o.customerName)}" data-phone="${escapeHtml(o.phone || '')}" data-total="${o.total}">
      Order #${o.id} — ${escapeHtml(o.customerName)} (${formatPrice(o.total)})
    </option>
  `).join('');

  document.getElementById('returnForm').reset();
  document.getElementById('retId').value = '';
  openModal('returnModal');
}

function onReturnOrderSelect() {
  const select = document.getElementById('retOrderSelect');
  const opt = select.options[select.selectedIndex];
  if (!opt) return;
  document.getElementById('retCustomerName').value = opt.getAttribute('data-name') || '';
  document.getElementById('retCustomerPhone').value = opt.getAttribute('data-phone') || '';
  document.getElementById('retAmount').value = opt.getAttribute('data-total') || 0;
}

async function saveReturn(e) {
  e.preventDefault();
  const orderId = Number(document.getElementById('retOrderSelect').value);
  const type = document.getElementById('retType').value;
  const reason = document.getElementById('retReason').value;
  const condition = document.getElementById('retCondition').value;
  const refundAmount = Number(document.getElementById('retAmount').value) || 0;
  const refundMethod = document.getElementById('retMethod').value;
  const restockApproved = document.getElementById('retRestock').checked;
  const customerName = document.getElementById('retCustomerName').value;
  const customerPhone = document.getElementById('retCustomerPhone').value;

  const returnNumber = 'RET-' + Date.now().toString().slice(-6);

  showToast('Saving return request...', 'info');

  const { error } = await supabase.from('returns_refunds').insert([{
    return_number: returnNumber,
    order_id: orderId,
    customer_name: customerName,
    customer_phone: customerPhone,
    type,
    reason,
    condition,
    refund_amount: refundAmount,
    refund_method: refundMethod,
    restock_approved: restockApproved,
    status: 'requested'
  }]);

  if (error) {
    showToast('Failed to record return: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('LOG_RETURN', 'returns_refunds', returnNumber, `Return logged for order #${orderId} (Rs. ${refundAmount})`);
  showToast(`Return ${returnNumber} logged successfully!`);
  closeAllModals();
  await DB.reload();
  renderReturnsModule();
}

async function updateReturnStatus(id, newStatus) {
  showToast(`Updating status to ${newStatus}...`, 'info');
  const { error } = await supabase.from('returns_refunds').update({ status: newStatus }).eq('id', id);
  if (error) {
    showToast('Update failed: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('UPDATE_RETURN_STATUS', 'returns_refunds', id, `Status updated to ${newStatus}`);
  showToast(`Return #${id} updated to ${newStatus}!`);
  await DB.reload();
  renderReturnsModule();
}

async function completeRestockAndRefund(returnId) {
  const ret = DB.returnsRefunds().find(r => r.id === returnId);
  if (!ret) return;

  if (!confirm(`Complete refund of ${formatPrice(ret.refundAmount)} for Return #${ret.return_number || ret.id}? This will safely update stock if restocking was approved.`)) {
    return;
  }

  showToast('Processing refund and restocking...', 'info');

  // Restock items if approved and condition is good/unopened
  if (ret.restock_approved && (ret.condition === 'good' || ret.condition === 'unopened')) {
    const order = DB.orders().find(o => o.id === ret.order_id);
    if (order && order.items) {
      for (const item of order.items) {
        const prod = DB.products().find(p => p.id === item.productId);
        if (prod) {
          const qty = Number(item.qty) || 1;
          const newStock = prod.stock + qty;

          await supabase.from('products').update({ stock: newStock, in_stock: true }).eq('id', prod.id);

          await supabase.from('stock_history').insert([{
            product: prod.name,
            product_name: prod.name,
            type: 'Return Restock',
            change_amount: qty,
            new_stock: newStock,
            date: new Date().toISOString().split('T')[0]
          }]);
        }
      }
    }
  }

  // Mark return refunded
  await supabase.from('returns_refunds').update({
    status: 'refunded',
    resolved_at: new Date().toISOString()
  }).eq('id', returnId);

  await DB.logAudit('COMPLETE_REFUND', 'returns_refunds', returnId, `Processed refund for ${formatPrice(ret.refundAmount)}`);
  showToast(`Return #${ret.return_number || returnId} refunded and closed!`);
  await DB.reload();
  renderReturnsModule();
}

function filterReturns() {
  const query = document.getElementById('returnSearch').value.toLowerCase().trim();
  const status = document.getElementById('returnStatusFilter').value;
  let returns = DB.returnsRefunds();

  if (status) returns = returns.filter(r => r.status === status);
  if (query) {
    returns = returns.filter(r =>
      (r.return_number || '').toLowerCase().includes(query) ||
      (r.customer_name || '').toLowerCase().includes(query) ||
      String(r.order_id).includes(query)
    );
  }
  renderReturnsTable(returns);
}

function exportReturnsCSV() {
  const returns = DB.returnsRefunds();
  exportTableToCSV(`returns_${new Date().toISOString().split('T')[0]}`, returns, {
    return_number: 'Return #',
    order_id: 'Order ID',
    customer_name: 'Customer',
    type: 'Type',
    reason: 'Reason',
    condition: 'Condition',
    refundAmount: 'Refund Amount (Rs.)',
    status: 'Status'
  });
}
