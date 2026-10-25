/* ============================================================
   THE ACCESSORIES HUB — Business Intelligence Reports Logic
   ============================================================ */

let currentReport = 'sales';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderReportView();
});

function switchReportTab(reportName) {
  currentReport = reportName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('tabBtn' + reportName.charAt(0).toUpperCase() + reportName.slice(1));
  if (activeBtn) activeBtn.classList.add('active');
  renderReportView();
}

function renderReportView() {
  const thead = document.getElementById('reportTableHead');
  const tbody = document.getElementById('reportTableBody');
  const title = document.getElementById('reportTitle');
  if (!thead || !tbody) return;

  if (currentReport === 'sales') {
    title.innerHTML = '<i data-lucide="trending-up" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;"></i> Sales Performance Report';
    thead.innerHTML = `
      <tr>
        <th>Order #</th>
        <th>Date</th>
        <th>Customer</th>
        <th>Payment</th>
        <th>Status</th>
        <th>Subtotal</th>
        <th>Discount</th>
        <th>Shipping</th>
        <th>Total</th>
      </tr>
    `;
    const orders = DB.orders();
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>#${escapeHtml(o.id)}</strong></td>
        <td>${formatDate(o.date)}</td>
        <td>${escapeHtml(o.customerName)}</td>
        <td><span class="badge badge-grey">${escapeHtml(o.payment)}</span></td>
        <td>${statusBadge(o.status)}</td>
        <td>${formatPrice(o.subtotal)}</td>
        <td>${formatPrice(o.discountAmount || 0)}</td>
        <td>${formatPrice(o.shipping)}</td>
        <td><strong>${formatPrice(o.total)}</strong></td>
      </tr>
    `).join('');

  } else if (currentReport === 'inventory') {
    title.innerHTML = '<i data-lucide="package" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;"></i> Inventory Valuation & Stock Report';
    thead.innerHTML = `
      <tr>
        <th>Product SKU</th>
        <th>Product Name</th>
        <th>Category</th>
        <th>On-Hand Stock</th>
        <th>Reorder Level</th>
        <th>Unit Selling Price</th>
        <th>Est. Unit Cost</th>
        <th>Total Stock Asset Value</th>
        <th>Status</th>
      </tr>
    `;
    const products = DB.products();
    tbody.innerHTML = products.map(p => {
      const unitCost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;
      const totalVal = (Number(p.stock) || 0) * unitCost;
      const isLow = Number(p.stock) <= Number(p.reorderLevel);

      return `
        <tr>
          <td><strong style="color:var(--gold-dark);">${escapeHtml(p.sku || 'SKU-' + p.id)}</strong></td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.category)}</td>
          <td><strong>${p.stock} units</strong></td>
          <td>${p.reorderLevel} units</td>
          <td>${formatPrice(p.price)}</td>
          <td>${formatPrice(unitCost)}</td>
          <td><strong>${formatPrice(totalVal)}</strong></td>
          <td>
            ${isLow ? '<span class="badge badge-red">Low Stock</span>' : '<span class="badge badge-green">Healthy</span>'}
          </td>
        </tr>
      `;
    }).join('');

  } else if (currentReport === 'profit') {
    title.innerHTML = '<i data-lucide="dollar-sign" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;"></i> Product Margin & Profitability';
    thead.innerHTML = `
      <tr>
        <th>Product</th>
        <th>Category</th>
        <th>Retail Price</th>
        <th>Unit Cost</th>
        <th>Gross Profit / Unit</th>
        <th>Unit Margin %</th>
        <th>Total Units Sold</th>
        <th>Total Realized Profit</th>
      </tr>
    `;
    const products = DB.products();
    const orders = DB.orders().filter(o => o.status !== 'cancelled');

    // Count units sold
    const soldCounts = {};
    orders.forEach(o => {
      (o.items || []).forEach(i => {
        soldCounts[i.productId] = (soldCounts[i.productId] || 0) + (Number(i.qty) || 1);
      });
    });

    tbody.innerHTML = products.map(p => {
      const unitCost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;
      const profitPerUnit = Math.max(0, p.price - unitCost);
      const margin = p.price > 0 ? Math.round((profitPerUnit / p.price) * 100) : 0;
      const totalSold = soldCounts[p.id] || 0;
      const realizedProfit = totalSold * profitPerUnit;

      return `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.category)}</td>
          <td>${formatPrice(p.price)}</td>
          <td>${formatPrice(unitCost)}</td>
          <td style="color:var(--green); font-weight:600;">${formatPrice(profitPerUnit)}</td>
          <td><span class="badge badge-gold">${margin}%</span></td>
          <td><span class="badge badge-blue">${totalSold}</span></td>
          <td><strong>${formatPrice(realizedProfit)}</strong></td>
        </tr>
      `;
    }).join('');

  } else if (currentReport === 'customers') {
    title.innerHTML = '<i data-lucide="users" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;"></i> Customer Retention & Lifetime Value';
    thead.innerHTML = `
      <tr>
        <th>Customer Name</th>
        <th>Phone</th>
        <th>Address</th>
        <th>Total Orders</th>
        <th>Lifetime Value (LTV)</th>
        <th>Average Order Value</th>
        <th>Customer Segment</th>
      </tr>
    `;
    const customers = DB.customers();
    tbody.innerHTML = customers.map(c => {
      const ordersCount = c.totalOrders || 0;
      const totalSpent = c.totalSpent || 0;
      const aov = ordersCount > 0 ? Math.round(totalSpent / ordersCount) : 0;
      const segment = ordersCount >= 3 ? 'VIP Patron' : (ordersCount > 1 ? 'Repeat Customer' : 'First-time Shopper');

      return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${escapeHtml(c.phone)}</td>
          <td>${escapeHtml(c.address || '—')}</td>
          <td><span class="badge badge-blue">${ordersCount} orders</span></td>
          <td><strong>${formatPrice(totalSpent)}</strong></td>
          <td>${formatPrice(aov)}</td>
          <td><span class="badge ${ordersCount >= 3 ? 'badge-gold' : (ordersCount > 1 ? 'badge-green' : 'badge-grey')}">${segment}</span></td>
        </tr>
      `;
    }).join('');

  } else if (currentReport === 'expenses') {
    title.innerHTML = '<i data-lucide="credit-card" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;"></i> Operating Expenses Report';
    thead.innerHTML = `
      <tr>
        <th>Reference #</th>
        <th>Date</th>
        <th>Category</th>
        <th>Description</th>
        <th>Payee</th>
        <th>Payment Method</th>
        <th>Amount</th>
        <th>Status</th>
      </tr>
    `;
    const expenses = DB.expenses();
    tbody.innerHTML = expenses.map(e => `
      <tr>
        <td><strong>${escapeHtml(e.reference_no || '#' + e.id)}</strong></td>
        <td>${formatDate(e.date)}</td>
        <td><span class="badge badge-grey">${escapeHtml(e.category)}</span></td>
        <td>${escapeHtml(e.description)}</td>
        <td>${escapeHtml(e.payee || '—')}</td>
        <td>${escapeHtml(e.payment_method || 'Cash')}</td>
        <td><strong>${formatPrice(e.amount)}</strong></td>
        <td><span class="badge ${e.payment_status === 'paid' ? 'badge-green' : 'badge-orange'}">${escapeHtml(e.payment_status || 'paid')}</span></td>
      </tr>
    `).join('');

  } else if (currentReport === 'tax') {
    title.innerHTML = '<i data-lucide="receipt" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;"></i> Tax & Billing Summary';
    thead.innerHTML = `
      <tr>
        <th>Invoice #</th>
        <th>Order ID</th>
        <th>Customer</th>
        <th>Date</th>
        <th>Gross Amount</th>
        <th>Tax (VAT) Rate</th>
        <th>Tax Amount</th>
        <th>Net Amount</th>
        <th>Status</th>
      </tr>
    `;
    const invoices = DB.invoices();
    const settings = DB.settings();
    const taxRate = Number(settings.tax_rate) || 0; // standard tax percentage if configured

    tbody.innerHTML = invoices.map(inv => {
      const gross = Number(inv.amount) || 0;
      const taxAmt = Math.round(gross * (taxRate / 100));
      const net = gross - taxAmt;

      return `
        <tr>
          <td><strong style="color:var(--gold-dark);">${escapeHtml(inv.id)}</strong></td>
          <td>#${escapeHtml(inv.orderId)}</td>
          <td>${escapeHtml(inv.customerName)}</td>
          <td>${formatDate(inv.date)}</td>
          <td>${formatPrice(gross)}</td>
          <td>${taxRate}%</td>
          <td>${formatPrice(taxAmt)}</td>
          <td><strong>${formatPrice(net)}</strong></td>
          <td>${statusBadge(inv.status)}</td>
        </tr>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

function exportCurrentReport() {
  const dateStr = new Date().toISOString().split('T')[0];

  if (currentReport === 'sales') {
    exportTableToCSV(`sales_report_${dateStr}`, DB.orders(), {
      id: 'Order ID',
      date: 'Date',
      customerName: 'Customer',
      payment: 'Payment',
      status: 'Status',
      subtotal: 'Subtotal (Rs.)',
      discountAmount: 'Discount (Rs.)',
      shipping: 'Shipping (Rs.)',
      total: 'Total (Rs.)'
    });
  } else if (currentReport === 'inventory') {
    exportTableToCSV(`inventory_valuation_${dateStr}`, DB.products(), {
      sku: 'SKU',
      name: 'Product Name',
      category: 'Category',
      stock: 'Stock Units',
      reorderLevel: 'Reorder Level',
      price: 'Retail Price (Rs.)',
      costPrice: 'Unit Cost (Rs.)'
    });
  } else if (currentReport === 'customers') {
    exportTableToCSV(`customer_retention_${dateStr}`, DB.customers(), {
      name: 'Name',
      phone: 'Phone',
      address: 'Address',
      totalOrders: 'Total Orders',
      totalSpent: 'Lifetime Value (Rs.)',
      joinDate: 'Joined Date'
    });
  } else if (currentReport === 'expenses') {
    exportTableToCSV(`expenses_report_${dateStr}`, DB.expenses(), {
      reference_no: 'Reference #',
      date: 'Date',
      category: 'Category',
      description: 'Description',
      payee: 'Payee',
      amount: 'Amount (Rs.)',
      payment_status: 'Status'
    });
  } else if (currentReport === 'tax') {
    exportTableToCSV(`tax_billing_${dateStr}`, DB.invoices(), {
      id: 'Invoice #',
      orderId: 'Order ID',
      customerName: 'Customer Name',
      date: 'Date',
      amount: 'Amount (Rs.)',
      status: 'Status'
    });
  }
}
