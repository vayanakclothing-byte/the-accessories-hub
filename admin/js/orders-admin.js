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
  if (filterStatus) orders = orders.filter(o => o.status === filterStatus);

  const tbody = document.getElementById('ordersBody');
  if (!tbody) return;

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong style="color:var(--gold)">#${o.id}</strong></td>
      <td>${o.customerName}</td>
      <td>
        ${o.items.map(i => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <div class="table-img" style="width:32px;height:32px;"><img src="${i.image}" alt="${i.name}"></div>
            <span style="font-size:0.8rem;">${i.name} × ${i.qty}</span>
          </div>
        `).join('')}
      </td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td><span class="badge badge-gold">${o.payment}</span></td>
      <td>${formatDate(o.date)}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="viewOrder(${o.id})" title="View">👁️</button>
          <button class="btn btn-sm btn-ghost" onclick="openStatusUpdate(${o.id})" title="Update Status">📝</button>
          <button class="wa-btn" style="padding:5px 8px;font-size:0.7rem;" onclick="sendOrderWhatsApp(${o.id})" title="WhatsApp">💬</button>
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
      <div class="detail-item"><div class="label">Order ID</div><div class="value">#${o.id}</div></div>
      <div class="detail-item"><div class="label">Date</div><div class="value">${formatDate(o.date)}</div></div>
      <div class="detail-item"><div class="label">Customer</div><div class="value">${o.customerName}</div></div>
      <div class="detail-item"><div class="label">Status</div><div class="value">${statusBadge(o.status)}</div></div>
      <div class="detail-item"><div class="label">Payment</div><div class="value">${o.payment.toUpperCase()}</div></div>
      <div class="detail-item"><div class="label">Tracking</div><div class="value">${o.trackingId || 'Not assigned'}</div></div>
      <div class="detail-item" style="grid-column:1/-1"><div class="label">Shipping Address</div><div class="value">${o.shippingAddress}</div></div>
    </div>
    <hr style="border-color:var(--grey-mid);margin:16px 0;">
    <h4 style="color:var(--gold);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Order Items</h4>
    ${o.items.map(i => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--grey-mid);">
        <div class="table-img"><img src="${i.image}" alt="${i.name}"></div>
        <div style="flex:1;"><div style="font-weight:500;">${i.name}</div><div style="font-size:0.75rem;color:var(--white-muted);">Qty: ${i.qty}</div></div>
        <div style="color:var(--gold);font-weight:600;">${formatPrice(i.price * i.qty)}</div>
      </div>
    `).join('')}
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
  const status = document.getElementById('statusSelect').value;
  const trackingId = document.getElementById('trackingInput').value || o.trackingId;
  await supabase.from('orders').update({status, tracking_id: trackingId}).eq('id', id);
  await loadData();
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

  let template = '';
  if (o.status === 'shipped') template = settings.whatsappTemplates?.shipped || '';
  else if (o.status === 'delivered') template = settings.whatsappTemplates?.delivered || '';
  else template = settings.whatsappTemplates?.orderConfirm || '';

  const message = template
    .replace('{name}', customer.name)
    .replace('{orderId}', o.id)
    .replace('{total}', o.total.toLocaleString())
    .replace('{tracking}', o.trackingId || 'N/A');

  sendWhatsApp(customer.phone, message);
}

function filterOrders(status) {
  document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderOrdersTable(status);
}
