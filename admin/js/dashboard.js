/* ============================================================
   Dashboard Analytics — Chart.js
   ============================================================ */

let salesChart, collectionChart, topProductsChart;

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderStatCards();
  initCharts();
  renderRecentOrders();
  renderLowStockAlerts();
  
  // Real-time integration (simplified for demo, usually via Supabase Realtime)
  setupRealtimeSimulation();
});

function renderStatCards() {
  const orders = DB.orders();
  const products = DB.products();
  const customers = DB.customers();
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const activeProducts = products.filter(p => p.inStock).length;

  document.getElementById('statRevenue').textContent = formatPrice(totalRevenue);
  document.getElementById('statOrders').textContent = totalOrders;
  document.getElementById('statCustomers').textContent = customers.length;
  document.getElementById('statProducts').textContent = activeProducts;
}

function initCharts() {
  const orders = DB.orders();
  // Sales over time (last 7 days)
  const days = [];
  const revenue = [];
  const orderCounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const dayOrders = orders.filter(o => o.date === key);
    revenue.push(dayOrders.reduce((s, o) => s + o.total, 0));
    orderCounts.push(dayOrders.length);
  }

  // Add some sample data if all zeros
  if (revenue.every(v => v === 0)) {
    const sampleRevenue = [4500, 6200, 3800, 8600, 2600, 10850, 5350];
    const sampleOrders = [1, 2, 1, 2, 1, 2, 2];
    sampleRevenue.forEach((v, i) => { revenue[i] = v; orderCounts[i] = sampleOrders[i]; });
  }

  const ctx1 = document.getElementById('salesChart')?.getContext('2d');
  if (ctx1) {
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Revenue (Rs.)',
          data: revenue,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#D4AF37',
          pointBorderColor: '#000',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111',
            titleColor: '#D4AF37',
            bodyColor: '#FAFAFA',
            borderColor: '#D4AF37',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: ctx => `Rs. ${ctx.parsed.y.toLocaleString()}` }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(212, 175, 55, 0.05)' }, ticks: { color: '#999', font: { size: 11 } } },
          y: { grid: { color: 'rgba(212, 175, 55, 0.05)' }, ticks: { color: '#999', font: { size: 11 }, callback: v => `Rs. ${(v/1000).toFixed(0)}k` } }
        }
      }
    });
  }

  // Collection breakdown
  const collections = { korean: 0, temple: 0, oxidized: 0 };
  orders.forEach(o => {
    o.items.forEach(item => {
      const product = DB.products().find(p => p.id === item.productId);
      if (product) collections[product.collection] = (collections[product.collection] || 0) + (item.price * item.qty);
    });
  });
  if (Object.values(collections).every(v => v === 0)) {
    collections.korean = 8400; collections.temple = 24700; collections.oxidized = 5200;
  }

  const ctx2 = document.getElementById('collectionChart')?.getContext('2d');
  if (ctx2) {
    if (collectionChart) collectionChart.destroy();
    collectionChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Korean', 'Temple', 'Oxidized'],
        datasets: [{
          data: [collections.korean, collections.temple, collections.oxidized],
          backgroundColor: ['#3498DB', '#D4AF37', '#E74C3C'],
          borderColor: '#111',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#CCC', padding: 16, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: {
            backgroundColor: '#1A1A1A', titleColor: '#D4AF37', bodyColor: '#FAFAFA',
            borderColor: 'rgba(212,175,55,0.2)', borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => `Rs. ${ctx.parsed.toLocaleString()}` }
          }
        },
        cutout: '65%'
      }
    });
  }
}

function renderRecentOrders() {
  const orders = DB.orders().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const tbody = document.getElementById('recentOrdersBody');
  if (!tbody) return;

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong style="color:var(--gold)">#${o.id}</strong></td>
      <td>${o.customerName}</td>
      <td>${o.items.map(i => i.name).join(', ')}</td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatDate(o.date)}</td>
      <td>
        ${o.status === 'pending' ? `<button onclick="toggleOrderStatus(${o.id}, 'shipped')" class="quick-action-btn">Ship Now</button>` : ''}
        ${o.status === 'processing' ? `<button onclick="toggleOrderStatus(${o.id}, 'shipped')" class="quick-action-btn">Ship Now</button>` : ''}
        ${o.status === 'shipped' ? `<button onclick="toggleOrderStatus(${o.id}, 'delivered')" class="quick-action-btn">Delivered</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderLowStockAlerts() {
  const products = DB.products().filter(p => p.stock <= p.reorderLevel);
  const container = document.getElementById('lowStockAlerts');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<p style="color:var(--white-muted);font-size:0.85rem;padding:16px;">All products are well stocked! ✓</p>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(42,42,42,0.5);">
      <div class="table-img"><img src="${p.image}" alt="${p.name}"></div>
      <div style="flex:1;">
        <div style="font-size:0.85rem;font-weight:500; display: flex; align-items: center; gap: 8px;">
            ${p.name} 
            ${p.stock === 0 ? '<span class="flash-alert"><i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> OUT</span>' : ''}
        </div>
        <div style="font-size:0.75rem;color:var(--red);">Only ${p.stock} left (min: ${p.reorderLevel})</div>
      </div>
      <div>
        <button onclick="quickStockUpdate(${p.id}, 10)" class="quick-action-btn">+10</button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function toggleOrderStatus(orderId, newStatus) {
    showToast(`Updating order #${orderId}...`, 'info');
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
        showToast('Failed to update order', 'error');
    } else {
        showToast(`Order #${orderId} marked as ${newStatus}!`);
        await loadData();
        renderRecentOrders();
    }
}

async function quickStockUpdate(productId, amount) {
    const product = DB.products().find(p => p.id === productId);
    if (!product) return;
    
    const newStock = product.stock + amount;
    showToast(`Adding stock to ${product.name}...`, 'info');
    
    const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', productId);
    if (error) {
        showToast('Failed to update stock', 'error');
    } else {
        showToast(`Added ${amount} units to ${product.name}!`);
        await loadData();
        renderLowStockAlerts();
        renderStatCards();
    }
}

function setupRealtimeSimulation() {
    // Listen for changes in orders table if the project supports it
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
        console.log('Change received!', payload);
        await loadData();
        renderRecentOrders();
        renderStatCards();
        initCharts();
    })
    .subscribe();
}
