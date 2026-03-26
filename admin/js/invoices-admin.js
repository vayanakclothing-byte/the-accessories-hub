/* ============================================================
   Invoice Generator — jsPDF
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderInvoicesTable();
});

function renderInvoicesTable() {
  const invoices = DB.invoices().sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('invoicesBody');
  if (!tbody) return;

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><strong style="color:var(--gold)">${inv.id}</strong></td>
      <td>#${inv.orderId}</td>
      <td>${inv.customerName}</td>
      <td><strong>${formatPrice(inv.amount)}</strong></td>
      <td>${formatDate(inv.date)}</td>
      <td>${statusBadge(inv.status)}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-gold" onclick="downloadInvoice('${inv.id}')">📄 PDF</button>
          <button class="btn btn-sm btn-ghost" onclick="viewInvoiceOrder(${inv.orderId})">👁️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openGenerateInvoice() {
  const orders = DB.orders();
  const existingInvOrders = DB.invoices().map(i => i.orderId);
  const available = orders.filter(o => !existingInvOrders.includes(o.id));

  const select = document.getElementById('invoiceOrderSelect');
  select.innerHTML = '<option value="">Select an order...</option>' +
    available.map(o => `<option value="${o.id}">#${o.id} — ${o.customerName} — ${formatPrice(o.total)}</option>`).join('');

  openModal('generateModal');
}

function generateInvoice() {
  const orderId = parseInt(document.getElementById('invoiceOrderSelect').value);
  if (!orderId) { showToast('Please select an order', 'error'); return; }

  const order = DB.orders().find(o => o.id === orderId);
  if (!order) return;

  const invoices = DB.invoices();
  const invId = `INV-${String(invoices.length + 1).padStart(3, '0')}`;
  invoices.push({
    id: invId,
    orderId: order.id,
    customerName: order.customerName,
    amount: order.total,
    date: new Date().toISOString().split('T')[0],
    status: 'paid'
  });
  DB.saveInvoices(invoices);
  closeAllModals();
  renderInvoicesTable();
  showToast(`Invoice ${invId} generated!`);

  // Auto-download PDF
  setTimeout(() => downloadInvoice(invId), 500);
}

function downloadInvoice(invId) {
  const inv = DB.invoices().find(i => i.id === invId);
  if (!inv) return;
  const order = DB.orders().find(o => o.id === inv.orderId);
  if (!order) return;
  const settings = DB.settings();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Gold header bar
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 0, 210, 35, 'F');

  // Company name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('THE ACCESSORIES HUB', 15, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Premium Handcrafted Jewelry', 15, 26);

  // Invoice label
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 195, 22, { align: 'right' });

  // Invoice details
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let y = 48;
  doc.text(`Invoice: ${inv.id}`, 15, y);
  doc.text(`Date: ${formatDate(inv.date)}`, 15, y + 7);
  doc.text(`Order: #${inv.orderId}`, 15, y + 14);
  doc.text(`Status: ${inv.status.toUpperCase()}`, 15, y + 21);

  // Customer
  doc.text('Bill To:', 130, y);
  doc.setFont('helvetica', 'bold');
  doc.text(order.customerName, 130, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(order.shippingAddress || 'N/A', 130, y + 14);

  // Divider
  y = 82;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);

  // Table header
  y += 10;
  doc.setFillColor(40, 40, 40);
  doc.rect(15, y - 5, 180, 10, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM', 18, y + 1);
  doc.text('QTY', 120, y + 1);
  doc.text('PRICE', 140, y + 1);
  doc.text('TOTAL', 170, y + 1);

  // Items
  y += 12;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  order.items.forEach(item => {
    doc.text(item.name, 18, y);
    doc.text(String(item.qty), 123, y);
    doc.text(`Rs. ${item.price.toLocaleString()}`, 140, y);
    doc.text(`Rs. ${(item.price * item.qty).toLocaleString()}`, 170, y);
    y += 9;
  });

  // Totals
  y += 5;
  doc.line(120, y, 195, y);
  y += 10;
  doc.setFontSize(9);
  doc.text('Subtotal:', 140, y);
  doc.text(`Rs. ${order.subtotal.toLocaleString()}`, 170, y);
  y += 8;
  doc.text('Shipping:', 140, y);
  doc.text(order.shipping === 0 ? 'Free' : `Rs. ${order.shipping}`, 170, y);
  y += 10;
  doc.setDrawColor(212, 175, 55);
  doc.line(120, y - 3, 195, y - 3);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.text('TOTAL:', 140, y + 4);
  doc.text(`Rs. ${order.total.toLocaleString()}`, 170, y + 4);

  // Footer
  const footerY = 265;
  doc.setDrawColor(212, 175, 55);
  doc.line(15, footerY - 10, 195, footerY - 10);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for shopping with The Accessories Hub! 💎', 105, footerY, { align: 'center' });
  doc.text(`${settings.businessAddress} | ${settings.businessPhone} | ${settings.businessEmail}`, 105, footerY + 6, { align: 'center' });

  // Payment badge
  doc.setFillColor(212, 175, 55);
  doc.roundedRect(15, footerY - 28, 40, 14, 3, 3, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID ✓', 35, footerY - 19, { align: 'center' });

  doc.save(`${inv.id}_${order.customerName.replace(/\s/g, '_')}.pdf`);
  showToast(`Invoice ${inv.id} downloaded!`);
}

function viewInvoiceOrder(orderId) {
  window.location.href = `orders.html`;
}
