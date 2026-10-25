/* ============================================================
   THE ACCESSORIES HUB — ERP Dashboard Overview Logic
   Multi-period Financial KPIs, Chart.js Visualizations & Live Feeds
   ============================================================ */

let salesChart = null;
let paymentChart = null;
let currentPeriod = '30d';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderDashboard();
  setupRealtimeSimulation();
});

function setDashboardPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-period') === period);
  });
  renderDashboard();
}

function filterByPeriod(records, dateField = 'date') {
  if (currentPeriod === 'all') return records;

  const now = new Date();
  let startMs = 0;

  if (currentPeriod === 'today') {
    startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (currentPeriod === '7d') {
    startMs = now.getTime() - 7 * 86400000;
  } else if (currentPeriod === '30d') {
    startMs = now.getTime() - 30 * 86400000;
  } else if (currentPeriod === 'year') {
    startMs = new Date(now.getFullYear(), 0, 1).getTime();
  }

  return records.filter(r => {
    const dStr = r[dateField] || r.created_at;
    if (!dStr) return true;
    const time = new Date(dStr).getTime();
    return !isNaN(time) ? time >= startMs : true;
  });
}

function renderDashboard() {
  const allOrders = DB.orders();
  const allProducts = DB.products();
  const allCustomers = DB.customers();
  const allExpenses = DB.expenses();
  const allReturns = DB.returnsRefunds();

  const periodOrders = filterByPeriod(allOrders, 'date');
  const periodExpenses = filterByPeriod(allExpenses, 'date');
  const periodReturns = filterByPeriod(allReturns, 'created_at');

  // --- Financial Formulas ---
  // 1. Gross Sales: Total merchandise value of non-cancelled orders before discounts
  const validOrders = periodOrders.filter(o => o.status !== 'cancelled');
  let grossSales = 0;
  let estimatedCOGS = 0;

  validOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 1;
      grossSales += price * qty;

      const prod = allProducts.find(p => String(p.id) === String(item.productId));
      const cost = prod && prod.costPrice > 0 ? prod.costPrice : price * 0.45; // 45% standard jewellery COGS fallback
      estimatedCOGS += cost * qty;
    });
  });

  // If no detailed order items available, fallback to subtotal
  if (grossSales === 0 && validOrders.length > 0) {
    grossSales = validOrders.reduce((sum, o) => sum + (o.subtotal || o.total), 0);
    estimatedCOGS = grossSales * 0.45;
  }

  // 2. Discounts & Returns
  const totalDiscounts = validOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
  const totalRefunds = periodReturns
    .filter(r => r.status === 'refunded')
    .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

  // 3. Net Sales = Gross Sales - Discounts - Returns
  const netSales = Math.max(0, grossSales - totalDiscounts - totalRefunds);

  // 4. Gross Profit = Net Sales - COGS
  const grossProfit = Math.max(0, netSales - estimatedCOGS);

  // 5. Operating Expenses
  const operatingExpenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 6. Net Profit = Gross Profit - Operating Expenses
  const netProfit = grossProfit - operatingExpenses;

  // 7. Collected Revenue
  const collectedRevenue = validOrders
    .filter(o => o.payment !== 'cod' || o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0);

  // 8. Inventory Valuation & Units
  let inventoryValue = 0;
  let totalStockUnits = 0;
  allProducts.forEach(p => {
    const stock = Math.max(0, Number(p.stock) || 0);
    const unitVal = p.costPrice > 0 ? p.costPrice : Number(p.price) || 0;
    inventoryValue += stock * unitVal;
    totalStockUnits += stock;
  });

  // 9. Low Stock Warnings
  const lowStockItems = allProducts.filter(p => Number(p.stock) <= Number(p.reorderLevel));

  // 10. Average Order Value
  const aov = validOrders.length > 0 ? Math.round(netSales / validOrders.length) : 0;

  // Update DOM Elements
  document.getElementById('statGrossSales').textContent = formatPrice(grossSales);
  document.getElementById('statNetSales').textContent = formatPrice(netSales);
  document.getElementById('statGrossProfit').textContent = formatPrice(grossProfit);
  document.getElementById('statNetProfit').textContent = formatPrice(netProfit);
  document.getElementById('statExpenses').textContent = formatPrice(operatingExpenses);
  document.getElementById('statTotalOrders').textContent = periodOrders.length;

  document.getElementById('statRevenueCollected').textContent = formatPrice(collectedRevenue);
  document.getElementById('statInventoryValuation').textContent = formatPrice(inventoryValue);
  document.getElementById('statTotalStockUnits').textContent = `${totalStockUnits.toLocaleString()} units on-hand`;
  document.getElementById('statLowStockCount').textContent = lowStockItems.length;
  document.getElementById('statAOV').textContent = formatPrice(aov);
  document.getElementById('statTotalCustomers').textContent = `${allCustomers.length} registered customers`;

  renderCharts(periodOrders);
  renderRecentOrders(allOrders);
  renderLowStockAlerts(lowStockItems);

  if (window.lucide) lucide.createIcons();
}

function renderCharts(orders) {
  if (typeof Chart === 'undefined') return;

  // 1. Sales & Revenue Trend
  const ctxSales = document.getElementById('salesChart')?.getContext('2d');
  if (ctxSales) {
    if (salesChart) salesChart.destroy();

    // Group orders by date (last 7 or 14 points)
    const pointsCount = currentPeriod === 'today' ? 1 : (currentPeriod === '7d' ? 7 : 10);
    const labels = [];
    const revenueData = [];
    const ordersData = [];

    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

      const dayOrders = orders.filter(o => o.date === dateKey && o.status !== 'cancelled');
      revenueData.push(dayOrders.reduce((sum, o) => sum + o.total, 0));
      ordersData.push(dayOrders.length);
    }

    salesChart = new Chart(ctxSales, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Net Revenue (Rs.)',
            data: revenueData,
            borderColor: '#C5A028',
            backgroundColor: 'rgba(197, 160, 40, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#C5A028',
            yAxisID: 'y'
          },
          {
            label: 'Orders Count',
            data: ordersData,
            borderColor: '#3498DB',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            borderWidth: 2,
            pointBackgroundColor: '#3498DB',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, color: '#4A4A4A' } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.yAxisID === 'y' ? ` Revenue: Rs. ${ctx.parsed.y.toLocaleString()}` : ` Orders: ${ctx.parsed.y}`
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#7A756D', font: { size: 10 } } },
          y: {
            type: 'linear', display: true, position: 'left',
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { color: '#7A756D', callback: v => `Rs. ${(v / 1000).toFixed(0)}k` }
          },
          y1: {
            type: 'linear', display: true, position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#3498DB', precision: 0 }
          }
        }
      }
    });
  }

  // 2. Payment Method Breakdown
  const ctxPay = document.getElementById('paymentChart')?.getContext('2d');
  if (ctxPay) {
    if (paymentChart) paymentChart.destroy();

    const counts = { cod: 0, esewa: 0, khalti: 0, fonepay: 0 };
    orders.forEach(o => {
      const p = String(o.payment || 'cod').toLowerCase();
      if (counts[p] !== undefined) counts[p] += o.total;
      else counts.cod += o.total;
    });

    paymentChart = new Chart(ctxPay, {
      type: 'doughnut',
      data: {
        labels: ['Cash on Delivery', 'eSewa', 'Khalti', 'FonePay'],
        datasets: [{
          data: [counts.cod, counts.esewa, counts.khalti, counts.fonepay],
          backgroundColor: ['#E8E2D6', '#2ECC71', '#9B59B6', '#3498DB'],
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, color: '#4A4A4A', font: { size: 11 } } },
          tooltip: {
            callbacks: { label: ctx => ` Rs. ${ctx.parsed.toLocaleString()}` }
          }
        },
        cutout: '70%'
      }
    });
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersBody');
  if (!tbody) return;

  const recent = orders.slice(0, 6);
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--white-muted);">No orders recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(o => `
    <tr>
      <td><strong style="color:var(--gold-dark);">#${escapeHtml(o.id)}</strong></td>
      <td>
        <div style="font-weight:600; color:var(--white);">${escapeHtml(o.customerName || 'Guest')}</div>
        <div style="font-size:0.75rem; color:var(--white-muted);">${escapeHtml(o.shippingAddress || '—')}</div>
      </td>
      <td>
        <span style="font-size:0.8rem;">${(o.items || []).length} item(s)</span>
      </td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatDate(o.date)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          ${o.status === 'pending' ? `<button onclick="updateQuickStatus(${o.id}, 'processing')" class="btn btn-sm btn-outline">Accept</button>` : ''}
          ${o.status === 'processing' ? `<button onclick="updateQuickStatus(${o.id}, 'shipped')" class="btn btn-sm btn-gold">Ship</button>` : ''}
          ${o.status === 'shipped' ? `<button onclick="updateQuickStatus(${o.id}, 'delivered')" class="btn btn-sm btn-outline" style="color:var(--green);border-color:var(--green);">Delivered</button>` : ''}
          <a href="orders.html" class="btn btn-sm btn-ghost" title="View Details"><i data-lucide="eye" style="width:14px;height:14px;"></i></a>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderLowStockAlerts(lowStockItems) {
  const container = document.getElementById('lowStockAlerts');
  if (!container) return;

  if (lowStockItems.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:var(--green);">
        <i data-lucide="check-circle" style="width:28px;height:28px;margin-bottom:6px;"></i>
        <div style="font-weight:600; font-size:0.85rem;">All stock healthy</div>
        <div style="font-size:0.75rem; color:var(--white-muted);">No products currently under reorder threshold.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = lowStockItems.slice(0, 5).map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="table-img" style="width:36px;height:36px;">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">
        </div>
        <div>
          <div style="font-size:0.85rem; font-weight:600; color:var(--white);">${escapeHtml(p.name)}</div>
          <div style="font-size:0.72rem; color:var(--red);">
            On-Hand: <strong>${p.stock}</strong> (Reorder at: ${p.reorderLevel})
          </div>
        </div>
      </div>
      <button onclick="quickRestock(${p.id}, 15)" class="btn btn-sm btn-outline" style="font-size:0.7rem; padding:4px 8px;">
        +15 Units
      </button>
    </div>
  `).join('');
}

async function updateQuickStatus(orderId, newStatus) {
  showToast(`Updating order #${orderId}...`, 'info');
  const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) {
    showToast('Status update failed: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('ORDER_STATUS_CHANGE', 'orders', orderId, `Status transitioned to ${newStatus}`);
  showToast(`Order #${orderId} marked as ${newStatus}!`);
  await DB.reload();
  renderDashboard();
}

async function quickRestock(productId, addedUnits) {
  const prod = DB.products().find(p => p.id === productId);
  if (!prod) return;
  const newStock = prod.stock + addedUnits;

  showToast(`Restocking ${prod.name}...`, 'info');
  const { error } = await supabase.from('products').update({ stock: newStock, in_stock: true }).eq('id', productId);
  if (error) {
    showToast('Restock failed: ' + error.message, 'error');
    return;
  }

  await supabase.from('stock_history').insert([{
    product: prod.name,
    product_name: prod.name,
    type: 'Adjustment',
    change_amount: addedUnits,
    new_stock: newStock,
    date: new Date().toISOString().split('T')[0]
  }]);

  await DB.logAudit('RESTOCK_PRODUCT', 'products', productId, `Added ${addedUnits} units (new stock: ${newStock})`);
  showToast(`Added ${addedUnits} units to ${prod.name}!`);
  await DB.reload();
  renderDashboard();
}

function exportDashboardSummary() {
  const orders = DB.orders();
  const summaryRows = [
    { Metric: 'Total Gross Sales', Value: document.getElementById('statGrossSales')?.textContent },
    { Metric: 'Total Net Sales', Value: document.getElementById('statNetSales')?.textContent },
    { Metric: 'Estimated Gross Profit', Value: document.getElementById('statGrossProfit')?.textContent },
    { Metric: 'Estimated Net Profit', Value: document.getElementById('statNetProfit')?.textContent },
    { Metric: 'Total Operating Expenses', Value: document.getElementById('statExpenses')?.textContent },
    { Metric: 'Total Orders', Value: document.getElementById('statTotalOrders')?.textContent },
    { Metric: 'Inventory Valuation', Value: document.getElementById('statInventoryValuation')?.textContent },
    { Metric: 'Average Order Value (AOV)', Value: document.getElementById('statAOV')?.textContent }
  ];

  exportTableToCSV(`erp_dashboard_summary_${new Date().toISOString().split('T')[0]}`, summaryRows, {
    Metric: 'Metric Name',
    Value: 'Calculated Amount / Value'
  });
}

function setupRealtimeSimulation() {
  if (typeof supabase === 'undefined' || !supabase.channel) return;
  try {
    supabase.channel('erp-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        await DB.reload();
        renderDashboard();
      })
      .subscribe();
  } catch (_) {}
}
