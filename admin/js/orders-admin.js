/* ============================================================
   Orders Admin — Management & Tracking
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderOrderStats();
  renderOrdersTable();
});

function renderOrderStats() {
  const orders = DB.orders();
  document.getElementById('totalOrdersCount').textContent = orders.length;
  document.getElementById('pendingCount').textContent = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  document.getElementById('shippedCount').textContent = orders.filter(o => o.status === 'shipped').length;
  document.getElementById('deliveredCount').textContent = orders.filter(o => o.status === 'delivered').length;
}

function renderOrdersTable(filterStatus = '') {
  let orders = DB.orders().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filterStatus) orders = orders.filter(o => o.status === String(filterStatus).toLowerCase());

  const tbody = document.getElementById('ordersBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--white-muted);padding:24px;">No orders yet.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong style="color:var(--gold)">#${escapeHtml(o.id)}</strong></td>
      <td>${escapeHtml(o.customerName)}</td>
      <td>
        ${(o.items || []).map(i => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <div class="table-img" style="width:32px;height:32px;"><img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.name)}"></div>
            <span style="font-size:0.8rem;">${escapeHtml(i.name)} × ${Number(i.qty) || 0}</span>
          </div>
        `).join('') || '<span style="color:var(--white-muted);font-size:0.8rem;">—</span>'}
      </td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td><span class="badge badge-gold">${escapeHtml(o.payment)}</span></td>
      <td>${formatDate(o.date)}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="viewOrder(${Number(o.id)})" title="View Order" aria-label="View order">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-sm btn-ghost" onclick="openStatusUpdate(${Number(o.id)})" title="Update Status" aria-label="Update status">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="wa-btn" style="padding:5px 8px;display:inline-flex;align-items:center;justify-content:center;" onclick="sendOrderWhatsApp(${Number(o.id)})" title="WhatsApp Customer" aria-label="WhatsApp customer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function viewOrder(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;

  const content = document.getElementById('orderDetailContent');
  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="label">Order ID</div><div class="value">#${escapeHtml(o.id)}</div></div>
      <div class="detail-item"><div class="label">Date</div><div class="value">${formatDate(o.date)}</div></div>
      <div class="detail-item"><div class="label">Customer</div><div class="value">${escapeHtml(o.customerName)}</div></div>
      <div class="detail-item"><div class="label">Status</div><div class="value">${statusBadge(o.status)}</div></div>
      <div class="detail-item"><div class="label">Payment</div><div class="value">${escapeHtml(String(o.payment || 'cod').toUpperCase())}</div></div>
      <div class="detail-item"><div class="label">Tracking</div><div class="value">${escapeHtml(o.trackingId || 'Not assigned')}</div></div>
      <div class="detail-item" style="grid-column:1/-1"><div class="label">Shipping Address</div><div class="value">${escapeHtml(o.shippingAddress || '—')}</div></div>
    </div>
    <hr style="border-color:var(--grey-mid);margin:16px 0;">
    <h4 style="color:var(--gold);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Order Items</h4>
    ${(o.items || []).map(i => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--grey-mid);">
        <div class="table-img"><img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.name)}"></div>
        <div style="flex:1;"><div style="font-weight:500;">${escapeHtml(i.name)}</div><div style="font-size:0.75rem;color:var(--white-muted);">Qty: ${Number(i.qty) || 0}</div></div>
        <div style="color:var(--gold);font-weight:600;">${formatPrice((Number(i.price) || 0) * (Number(i.qty) || 0))}</div>
      </div>
    `).join('') || '<p style="color:var(--white-muted);">No line items recorded.</p>'}
    <div style="margin-top:16px;text-align:right;">
      <div style="font-size:0.85rem;color:var(--white-muted);margin-bottom:4px;">Subtotal: ${formatPrice(o.subtotal)}</div>
      <div style="font-size:0.85rem;color:var(--white-muted);margin-bottom:4px;">Shipping: ${o.shipping === 0 ? 'Free' : formatPrice(o.shipping)}</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--gold);">Total: ${formatPrice(o.total)}</div>
    </div>
  `;
  openModal('orderDetailModal');
}

function openStatusUpdate(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;
  document.getElementById('statusOrderId').textContent = `#${o.id}`;
  document.getElementById('statusSelect').value = o.status;
  document.getElementById('trackingInput').value = o.trackingId || '';
  document.getElementById('saveStatusBtn').onclick = () => updateOrderStatus(id);
  openModal('statusModal');
}

async function updateOrderStatus(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;
  const status = String(document.getElementById('statusSelect').value).toLowerCase();
  const trackingId = document.getElementById('trackingInput').value || o.trackingId;

  const { error } = await supabase.from('orders').update({ status, tracking_id: trackingId }).eq('id', id);
  if (error) {
    showToast('Could not update the order: ' + error.message, 'error');
    return;
  }

  await DB.reload();
  closeAllModals();
  renderOrdersTable();
  renderOrderStats();
  showToast(`Order #${id} status updated to ${status}`);
}

function sendOrderWhatsApp(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;
  const settings = DB.settings();
  const customer = DB.customers().find(c => c.id === o.customerId);
  if (!customer) { showToast('Customer not found', 'error'); return; }

  const templates = settings.whatsappTemplates || {};
  let template = '';
  if (o.status === 'shipped') template = templates.shipped || '';
  else if (o.status === 'delivered') template = templates.delivered || '';
  else template = templates.orderConfirm || '';

  const message = template
    .replace('{name}', customer.name)
    .replace('{orderId}', o.id)
    .replace('{total}', Number(o.total).toLocaleString())
    .replace('{tracking}', o.trackingId || 'N/A');

  sendWhatsApp(customer.phone, message);
}

function filterOrders(status, evt) {
  const clicked = (evt && evt.currentTarget) || (typeof event !== 'undefined' ? event.target : null);
  document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
  clicked?.classList.add('active');
  renderOrdersTable(status);
}
