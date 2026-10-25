/* ============================================================
   THE ACCESSORIES HUB — Sales & Profitability Analysis Logic
   ============================================================ */

let catSalesChart = null;
let payMethodsChart = null;
let activeRange = '30d';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderSalesModule();
});

function setSalesRange(range) {
  activeRange = range;
  document.querySelectorAll('.date-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-range') === range);
  });
  renderSalesModule();
}

function filterByRange(orders) {
  if (activeRange === 'all') return orders;
  const now = new Date();
  let startMs = 0;
  if (activeRange === '7d') startMs = now.getTime() - 7 * 86400000;
  else if (activeRange === '30d') startMs = now.getTime() - 30 * 86400000;
  else if (activeRange === 'year') startMs = new Date(now.getFullYear(), 0, 1).getTime();

  return orders.filter(o => {
    const d = o.date || o.created_at;
    if (!d) return true;
    const time = new Date(d).getTime();
    return !isNaN(time) ? time >= startMs : true;
  });
}

function renderSalesModule() {
  const allOrders = DB.orders();
  const allProducts = DB.products();
  const rangeOrders = filterByRange(allOrders).filter(o => o.status !== 'cancelled');

  let grossRev = 0;
  let totalDiscounts = 0;
  let totalCOGS = 0;
  let unitsCount = 0;

  // Track product performance
  const prodPerfMap = {};
  allProducts.forEach(p => {
    prodPerfMap[p.id] = {
      product: p,
      unitsSold: 0,
      revenue: 0,
      cogs: 0
    };
  });

  rangeOrders.forEach(o => {
    totalDiscounts += o.discountAmount || 0;
    (o.items || []).forEach(item => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 1;
      const lineTotal = price * qty;
      grossRev += lineTotal;
      unitsCount += qty;

      const prod = allProducts.find(p => String(p.id) === String(item.productId));
      const unitCost = prod && prod.costPrice > 0 ? prod.costPrice : price * 0.45;
      const lineCOGS = unitCost * qty;
      totalCOGS += lineCOGS;

      if (item.productId && prodPerfMap[item.productId]) {
        prodPerfMap[item.productId].unitsSold += qty;
        prodPerfMap[item.productId].revenue += lineTotal;
        prodPerfMap[item.productId].cogs += lineCOGS;
      }
    });
  });

  if (grossRev === 0 && rangeOrders.length > 0) {
    grossRev = rangeOrders.reduce((sum, o) => sum + (o.subtotal || o.total), 0);
    totalCOGS = grossRev * 0.45;
  }

  const netRev = Math.max(0, grossRev - totalDiscounts);
  const grossProfit = Math.max(0, netRev - totalCOGS);
  const marginPct = netRev > 0 ? Math.round((grossProfit / netRev) * 100) : 0;

  document.getElementById('statGrossRevenue').textContent = formatPrice(grossRev);
  document.getElementById('statNetRevenue').textContent = formatPrice(netRev);
  document.getElementById('statEstimatedMargin').textContent = `${marginPct}%`;
  document.getElementById('statUnitsSold').textContent = unitsCount.toLocaleString();

  renderCharts(rangeOrders, allProducts);
  renderProductPerformanceTable(Object.values(prodPerfMap));
}

function renderCharts(orders, products) {
  if (typeof Chart === 'undefined') return;

  // 1. Sales by Jewellery Category
  const ctxCat = document.getElementById('categorySalesChart')?.getContext('2d');
  if (ctxCat) {
    if (catSalesChart) catSalesChart.destroy();

    const catTotals = { rings: 0, bracelets: 0, earrings: 0, necklaces: 0, other: 0 };
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const prod = products.find(p => String(p.id) === String(item.productId));
        const cat = (prod && prod.category) ? String(prod.category).toLowerCase() : 'other';
        const lineTotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
        if (catTotals[cat] !== undefined) catTotals[cat] += lineTotal;
        else catTotals.other += lineTotal;
      });
    });

    catSalesChart = new Chart(ctxCat, {
      type: 'bar',
      data: {
        labels: ['Rings', 'Bracelets', 'Earrings', 'Necklaces', 'Other'],
        datasets: [{
          label: 'Revenue (Rs.)',
          data: [catTotals.rings, catTotals.bracelets, catTotals.earrings, catTotals.necklaces, catTotals.other],
          backgroundColor: '#C5A028',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` Rs. ${ctx.parsed.y.toLocaleString()}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4A4A4A' } },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { color: '#7A756D', callback: v => `Rs. ${(v / 1000).toFixed(0)}k` }
          }
        }
      }
    });
  }

  // 2. Revenue by Payment Method
  const ctxPay = document.getElementById('paymentMethodsChart')?.getContext('2d');
  if (ctxPay) {
    if (payMethodsChart) payMethodsChart.destroy();

    const paySums = { cod: 0, esewa: 0, khalti: 0, fonepay: 0 };
    orders.forEach(o => {
      const p = String(o.payment || 'cod').toLowerCase();
      if (paySums[p] !== undefined) paySums[p] += o.total;
      else paySums.cod += o.total;
    });

    payMethodsChart = new Chart(ctxPay, {
      type: 'doughnut',
      data: {
        labels: ['Cash on Delivery', 'eSewa', 'Khalti', 'FonePay'],
        datasets: [{
          data: [paySums.cod, paySums.esewa, paySums.khalti, paySums.fonepay],
          backgroundColor: ['#DDD6C8', '#2ECC71', '#9B59B6', '#3498DB'],
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, color: '#4A4A4A' } }
        },
        cutout: '70%'
      }
    });
  }
}

function renderProductPerformanceTable(items) {
  const tbody = document.getElementById('productPerfTableBody');
  if (!tbody) return;

  const sorted = items.sort((a, b) => b.revenue - a.revenue);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--white-muted);">No product sales data available for this range.</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(row => {
    const p = row.product;
    const estProfit = Math.max(0, row.revenue - row.cogs);
    const margin = row.revenue > 0 ? Math.round((estProfit / row.revenue) * 100) : 0;
    const unitCost = p.costPrice > 0 ? p.costPrice : p.price * 0.45;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="table-img" style="width:36px;height:36px;"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>
            <div>
              <div style="font-weight:600; color:var(--white);">${escapeHtml(p.name)}</div>
              <div style="font-size:0.72rem; color:var(--white-muted);">${escapeHtml(p.sku || 'SKU-' + p.id)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-grey">${escapeHtml(p.category || 'Jewellery')}</span></td>
        <td><strong>${formatPrice(p.price)}</strong></td>
        <td>${formatPrice(unitCost)}</td>
        <td><span class="badge badge-blue">${row.unitsSold} units</span></td>
        <td><strong>${formatPrice(row.revenue)}</strong></td>
        <td style="color:var(--green); font-weight:600;">${formatPrice(estProfit)}</td>
        <td><span class="badge badge-gold">${margin}%</span></td>
      </tr>
    `;
  }).join('');
}

function filterProductPerformance() {
  const query = document.getElementById('prodPerfSearch').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#productPerfTableBody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = text.includes(query) ? '' : 'none';
  });
}

function exportSalesCSV() {
  const orders = filterByRange(DB.orders()).filter(o => o.status !== 'cancelled');
  exportTableToCSV(`sales_report_${activeRange}_${new Date().toISOString().split('T')[0]}`, orders, {
    id: 'Order ID',
    customerName: 'Customer',
    date: 'Order Date',
    status: 'Status',
    payment: 'Payment Method',
    subtotal: 'Subtotal (Rs.)',
    discountAmount: 'Discount (Rs.)',
    shipping: 'Shipping (Rs.)',
    total: 'Total (Rs.)'
  });
}
