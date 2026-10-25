/* ============================================================
   Orders Admin — Management & Tracking
   ============================================================ */
let activeUpdatingOrderId = null;

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
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--white-muted);padding:24px;">No orders found.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong style="color:var(--gold-dark)">#${escapeHtml(o.id)}</strong></td>
      <td>
        <div style="font-weight:600; color:var(--white);">${escapeHtml(o.customerName || 'Customer')}</div>
        <div style="font-size:0.75rem; color:var(--white-muted);">${escapeHtml(o.shippingAddress || '—')}</div>
      </td>
      <td>
        ${(o.items || []).map(i => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <div class="table-img" style="width:28px;height:28px;"><img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.name)}"></div>
            <span style="font-size:0.8rem;">${escapeHtml(i.name)} × ${Number(i.qty) || 1}</span>
          </div>
        `).join('') || '<span style="color:var(--white-muted);font-size:0.8rem;">—</span>'}
      </td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td><span class="badge badge-gold">${escapeHtml(String(o.payment || 'cod').toUpperCase())}</span></td>
      <td>${formatDate(o.date)}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="viewOrder(${Number(o.id)})" title="View Order & Packing Slip">
            <i data-lucide="eye" style="width:14px;height:14px;"></i>
          </button>
          <button class="btn btn-sm btn-outline" onclick="openStatusUpdate(${Number(o.id)})" title="Update Status">
            <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
          </button>
          <button class="wa-btn" style="padding:5px 8px;" onclick="sendOrderWhatsApp(${Number(o.id)})" title="WhatsApp Customer">
            <i data-lucide="message-circle" style="width:13px;height:13px;"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function viewOrder(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;

  const content = document.getElementById('orderDetailContent');
  content.innerHTML = `
    <div style="border-bottom:1px solid rgba(197,160,40,0.2); padding-bottom:14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h3 style="margin:0; font-family:var(--font-serif); color:var(--gold-dark);">The Accessories Hub</h3>
        <div style="font-size:0.75rem; color:var(--white-muted);">Official Jewellery Dispatch Packing Slip</div>
      </div>
      <div style="text-align:right;">
        <strong style="color:var(--gold-dark); font-size:1.1rem;">ORDER #${escapeHtml(o.id)}</strong>
        <div style="font-size:0.75rem; color:var(--white-muted);">${formatDate(o.date)}</div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-item"><div class="label">Customer Name</div><div class="value">${escapeHtml(o.customerName)}</div></div>
      <div class="detail-item"><div class="label">Payment Method</div><div class="value">${escapeHtml(String(o.payment || 'cod').toUpperCase())}</div></div>
      <div class="detail-item"><div class="label">Order Status</div><div class="value">${statusBadge(o.status)}</div></div>
      <div class="detail-item"><div class="label">Tracking Number</div><div class="value">${escapeHtml(o.trackingId || 'Not assigned')}</div></div>
      <div class="detail-item" style="grid-column:1/-1"><div class="label">Delivery Address</div><div class="value">${escapeHtml(o.shippingAddress || '—')}</div></div>
    </div>
    <hr style="border-color:rgba(197,160,40,0.15);margin:16px 0;">
    <h4 style="color:var(--gold-dark);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Enclosed Jewellery Items</h4>
    ${(o.items || []).map(i => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div class="table-img" style="width:36px;height:36px;"><img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.name)}"></div>
        <div style="flex:1;"><div style="font-weight:600;">${escapeHtml(i.name)}</div><div style="font-size:0.75rem;color:var(--white-muted);">Quantity: ${Number(i.qty) || 1}</div></div>
        <div style="color:var(--gold-dark);font-weight:600;">${formatPrice((Number(i.price) || 0) * (Number(i.qty) || 1))}</div>
      </div>
    `).join('') || '<p style="color:var(--white-muted);">No line items recorded.</p>'}
    <div style="margin-top:16px;text-align:right;">
      <div style="font-size:0.85rem;color:var(--white-muted);margin-bottom:4px;">Subtotal: ${formatPrice(o.subtotal)}</div>
      <div style="font-size:0.85rem;color:var(--white-muted);margin-bottom:4px;">Shipping: ${o.shipping === 0 ? 'Free' : formatPrice(o.shipping)}</div>
      <div style="font-size:1.15rem;font-weight:700;color:var(--gold-dark);">Total Amount: ${formatPrice(o.total)}</div>
    </div>
  `;
  openModal('orderDetailModal');
}

function openStatusUpdate(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;
  activeUpdatingOrderId = id;
  document.getElementById('statusOrderId').textContent = `#${o.id}`;
  document.getElementById('newStatus').value = o.status;
  document.getElementById('trackingNumber').value = o.trackingId || '';
  document.getElementById('trackingGroup').style.display = o.status === 'shipped' ? 'block' : 'none';

  document.getElementById('newStatus').onchange = (e) => {
    document.getElementById('trackingGroup').style.display = e.target.value === 'shipped' ? 'block' : 'none';
  };

  openModal('statusModal');
}

async function saveOrderStatus() {
  if (!activeUpdatingOrderId) return;
  const id = activeUpdatingOrderId;
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;

  const status = document.getElementById('newStatus').value;
  const trackingId = document.getElementById('trackingNumber').value.trim() || o.trackingId;

  showToast(`Updating order #${id}...`, 'info');

  const { error } = await supabase.from('orders').update({
    status,
    tracking_id: trackingId
  }).eq('id', id);

  if (error) {
    showToast('Could not update order: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('ORDER_STATUS_CHANGE', 'orders', id, `Status updated to ${status}`);
  showToast(`Order #${id} marked as ${status}!`);
  closeAllModals();
  await DB.reload();
  renderOrdersTable();
  renderOrderStats();
}

function sendOrderWhatsApp(id) {
  const o = DB.orders().find(x => x.id === id);
  if (!o) return;
  const settings = DB.settings();
  const customer = DB.customers().find(c => c.id === o.customerId);

  const phone = (customer && customer.phone) || o.phone || '9805659501';
  const name = (customer && customer.name) || o.customerName || 'Valued Customer';

  const templates = settings.whatsappTemplates || {};
  let template = '';
  if (o.status === 'shipped') template = templates.shipped || 'Hi {name}! Your order #{orderId} has been shipped (Tracking: {tracking}).';
  else if (o.status === 'delivered') template = templates.delivered || 'Hello {name}! Your order #{orderId} has been delivered!';
  else template = templates.orderConfirm || 'Hello {name}! Your order #{orderId} is confirmed. Total: Rs. {total}.';

  const message = template
    .replace(/{name}/g, name)
    .replace(/{orderId}/g, o.id)
    .replace(/{total}/g, Number(o.total).toLocaleString())
    .replace(/{tracking}/g, o.trackingId || 'N/A');

  sendWhatsApp(phone, message);
}

function filterOrders(status, evt) {
  const clicked = (evt && evt.currentTarget) || (typeof event !== 'undefined' ? event.target : null);
  document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
  clicked?.classList.add('active');
  renderOrdersTable(status);
}

function exportOrdersCSV() {
  const orders = DB.orders();
  exportTableToCSV(`orders_report_${new Date().toISOString().split('T')[0]}`, orders, {
    id: 'Order ID',
    customerName: 'Customer',
    date: 'Date',
    payment: 'Payment Method',
    status: 'Status',
    subtotal: 'Subtotal (Rs.)',
    shipping: 'Shipping (Rs.)',
    total: 'Total (Rs.)',
    shippingAddress: 'Address'
  });
}
