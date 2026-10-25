/* ============================================================
   THE ACCESSORIES HUB — Shipping & Delivery Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderShippingModule();
});

function renderShippingModule() {
  const shipments = DB.shipments();
  const orders = DB.orders();

  const pendingOrders = orders.filter(o => o.status === 'processing' || o.status === 'pending');
  const inTransit = shipments.filter(s => s.status === 'in_transit' || s.status === 'picked_up');
  const delivered = shipments.filter(s => s.status === 'delivered');
  const returned = shipments.filter(s => s.status === 'returned' || s.status === 'failed');

  document.getElementById('statPendingDispatch').textContent = pendingOrders.length;
  document.getElementById('statInTransit').textContent = inTransit.length;
  document.getElementById('statDeliveredShipments').textContent = delivered.length;
  document.getElementById('statReturnedShipments').textContent = returned.length;

  renderShipmentsTable(shipments);
}

function renderShipmentsTable(shipments) {
  const tbody = document.getElementById('shipmentsTableBody');
  if (!tbody) return;

  const orders = DB.orders();

  if (shipments.length === 0) {
    // If no dedicated shipments rows yet, display from orders with status = shipped / delivered
    const shippedOrders = orders.filter(o => o.status === 'shipped' || o.status === 'delivered' || o.trackingId);
    if (shippedOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--white-muted);">No packages dispatched yet. Click "+ Dispatch Order" to assign tracking.</td></tr>';
      return;
    }

    tbody.innerHTML = shippedOrders.map(o => `
      <tr>
        <td><strong style="color:var(--gold-dark);">#${escapeHtml(o.id)}</strong></td>
        <td><strong>${escapeHtml(o.customerName || 'Customer')}</strong></td>
        <td>${escapeHtml(o.shippingAddress || '—')}</td>
        <td><span class="badge badge-grey">Nepal Post</span></td>
        <td><strong>${escapeHtml(o.trackingId || 'TRK-' + o.id)}</strong></td>
        <td>${formatDate(o.date)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button onclick="sendShipmentWhatsApp(${o.id}, '${escapeHtml(o.trackingId || 'TRK-' + o.id)}')" class="wa-btn" title="Send WhatsApp Tracking Update">
              <i data-lucide="message-circle" style="width:13px;height:13px;"></i> WhatsApp
            </button>
            ${o.status === 'shipped' ? `<button onclick="markShipmentDelivered(${o.id})" class="btn btn-sm btn-outline" style="color:var(--green);border-color:var(--green);">Delivered</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = shipments.map(s => {
    const o = orders.find(x => x.id === s.order_id) || {};
    return `
      <tr>
        <td><strong style="color:var(--gold-dark);">#${escapeHtml(s.order_id || '—')}</strong></td>
        <td><strong>${escapeHtml(o.customerName || 'Customer')}</strong></td>
        <td>${escapeHtml(o.shippingAddress || s.notes || '—')}</td>
        <td><span class="badge badge-grey">${escapeHtml(s.courier_name || 'Nepal Post')}</span></td>
        <td><strong>${escapeHtml(s.tracking_number || '—')}</strong></td>
        <td>${s.dispatchedAt || formatDate(s.created_at)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button onclick="sendShipmentWhatsApp(${s.order_id}, '${escapeHtml(s.tracking_number)}')" class="wa-btn" title="Send WhatsApp Tracking Update">
              <i data-lucide="message-circle" style="width:13px;height:13px;"></i> WhatsApp
            </button>
            ${s.status !== 'delivered' ? `<button onclick="markShipmentDelivered(${s.order_id}, ${s.id})" class="btn btn-sm btn-outline" style="color:var(--green);border-color:var(--green);">Delivered</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function openCreateShipmentModal() {
  const orders = DB.orders().filter(o => o.status === 'processing' || o.status === 'pending');
  const select = document.getElementById('shipOrderSelect');

  select.innerHTML = '<option value="">Choose an order to dispatch...</option>' + orders.map(o => `
    <option value="${o.id}" data-address="${escapeHtml(o.shippingAddress || '')}" data-phone="${escapeHtml(o.phone || '')}">
      Order #${o.id} — ${escapeHtml(o.customerName)} (${formatPrice(o.total)})
    </option>
  `).join('');

  document.getElementById('shipmentForm').reset();
  document.getElementById('shipTracking').value = 'TRK-' + Date.now().toString().slice(-6);
  openModal('shipmentModal');
}

function onShipOrderSelect() {
  const select = document.getElementById('shipOrderSelect');
  const opt = select.options[select.selectedIndex];
  const addr = opt?.getAttribute('data-address');
  if (addr) document.getElementById('shipNotes').value = addr;
}

async function saveShipment(e) {
  e.preventDefault();
  const orderId = Number(document.getElementById('shipOrderSelect').value);
  const courier = document.getElementById('shipCourier').value;
  const tracking = document.getElementById('shipTracking').value.trim();
  const cost = Number(document.getElementById('shipCost').value) || 0;
  const status = document.getElementById('shipStatus').value;
  const notes = document.getElementById('shipNotes').value.trim();

  if (!orderId) {
    showToast('Please select an order to dispatch.', 'error');
    return;
  }

  showToast('Creating dispatch record...', 'info');

  // 1. Insert shipment record
  const { error: shipErr } = await supabase.from('shipments').insert([{
    order_id: orderId,
    courier_name: courier,
    tracking_number: tracking,
    shipping_cost: cost,
    status: status,
    dispatched_at: new Date().toISOString(),
    notes: notes
  }]);

  if (shipErr) {
    showToast('Failed to record shipment: ' + shipErr.message, 'error');
    return;
  }

  // 2. Update order status to shipped and set tracking_id
  await supabase.from('orders').update({
    status: status === 'delivered' ? 'delivered' : 'shipped',
    tracking_id: tracking
  }).eq('id', orderId);

  await DB.logAudit('DISPATCH_ORDER', 'shipments', orderId, `Dispatched via ${courier} (${tracking})`);
  showToast(`Order #${orderId} dispatched with tracking ${tracking}!`);
  closeAllModals();
  await DB.reload();
  renderShippingModule();
}

async function markShipmentDelivered(orderId, shipmentId) {
  showToast(`Marking order #${orderId} delivered...`, 'info');

  if (shipmentId) {
    await supabase.from('shipments').update({
      status: 'delivered',
      delivered_at: new Date().toISOString()
    }).eq('id', shipmentId);
  }

  await supabase.from('orders').update({
    status: 'delivered'
  }).eq('id', orderId);

  await DB.logAudit('DELIVER_ORDER', 'orders', orderId, 'Confirmed delivery to customer');
  showToast(`Order #${orderId} delivered!`);
  await DB.reload();
  renderShippingModule();
}

function sendShipmentWhatsApp(orderId, trackingNumber) {
  const o = DB.orders().find(x => x.id === orderId);
  if (!o) return;

  const phone = o.phone || (DB.customers().find(c => c.id === o.customerId)?.phone) || '9805659501';
  const name = o.customerName || 'Valued Customer';
  const message = `Hello ${name}! 📦 Great news from The Accessories Hub! Your jewellery order #${orderId} has been dispatched.\nTracking ID: ${trackingNumber}\nExpected Delivery: 2-4 business days.\nThank you for shopping with us! 💎`;

  sendWhatsApp(phone, message);
}

function filterShipments() {
  const query = document.getElementById('shipmentSearch').value.toLowerCase().trim();
  const status = document.getElementById('shipmentStatusFilter').value;
  let shipments = DB.shipments();

  if (status) {
    shipments = shipments.filter(s => s.status === status);
  }
  if (query) {
    shipments = shipments.filter(s =>
      (s.tracking_number || '').toLowerCase().includes(query) ||
      String(s.order_id).includes(query)
    );
  }
  renderShipmentsTable(shipments);
}

function exportShipmentsCSV() {
  const shipments = DB.shipments();
  exportTableToCSV(`shipments_${new Date().toISOString().split('T')[0]}`, shipments, {
    order_id: 'Order ID',
    courier_name: 'Courier Partner',
    tracking_number: 'Tracking #',
    shippingCost: 'Shipping Cost (Rs.)',
    status: 'Delivery Status',
    dispatchedAt: 'Dispatched Date'
  });
}
