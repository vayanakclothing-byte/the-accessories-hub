/* ============================================================
   THE ACCESSORIES HUB — Notifications & Business Tasks Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderNotificationsModule();
});

function renderNotificationsModule() {
  const container = document.getElementById('notificationsFeedContainer');
  if (!container) return;

  const products = DB.products();
  const orders = DB.orders();
  const returns = DB.returnsRefunds();
  const dbNotifs = DB.notifications();

  const alerts = [];

  // 1. Critical Low-Stock Alerts
  products.forEach(p => {
    if (Number(p.stock) <= Number(p.reorderLevel)) {
      alerts.push({
        type: 'stock',
        title: `Low Stock Alert: ${p.name}`,
        message: `Current stock has fallen to ${p.stock} units (Threshold: ${p.reorderLevel}). Reorder recommended.`,
        link: 'inventory.html',
        linkText: 'Restock in Inventory',
        badge: 'badge-red',
        icon: 'alert-triangle',
        time: 'Active now'
      });
    }
  });

  // 2. Orders Awaiting Processing
  const pendingOrders = orders.filter(o => o.status === 'pending');
  if (pendingOrders.length > 0) {
    alerts.push({
      type: 'order',
      title: `${pendingOrders.length} New Orders Awaiting Processing`,
      message: `You have ${pendingOrders.length} unfulfilled customer orders ready to be confirmed and packed.`,
      link: 'orders.html',
      linkText: 'View Orders',
      badge: 'badge-blue',
      icon: 'shopping-bag',
      time: 'Action required'
    });
  }

  // 3. Pending Return Requests
  const pendingReturns = returns.filter(r => r.status === 'requested');
  if (pendingReturns.length > 0) {
    alerts.push({
      type: 'return',
      title: `${pendingReturns.length} Return Requests Awaiting Review`,
      message: `Customer return requests require inspection decision and restocking authorization.`,
      link: 'returns.html',
      linkText: 'Inspect Returns',
      badge: 'badge-orange',
      icon: 'rotate-ccw',
      time: 'Action required'
    });
  }

  // 4. DB Notifications
  dbNotifs.forEach(n => {
    alerts.push({
      type: n.type || 'info',
      title: n.title,
      message: n.message,
      link: n.link || 'index.html',
      linkText: 'View Details',
      badge: n.is_read ? 'badge-grey' : 'badge-gold',
      icon: 'bell',
      time: n.date || 'Recent'
    });
  });

  if (alerts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px 20px; color:var(--green);">
        <i data-lucide="check-circle-2" style="width:48px;height:48px;margin-bottom:12px;"></i>
        <h3>All Clear!</h3>
        <p style="color:var(--white-muted); font-size:0.85rem;">No critical tasks or pending notifications requiring immediate attention.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px;border-bottom:1px solid rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div style="width:38px;height:38px;border-radius:8px;background:rgba(197,160,40,0.1);display:flex;align-items:center;justify-content:center;color:var(--gold-dark);flex-shrink:0;">
          <i data-lucide="${a.icon}" style="width:18px;height:18px;"></i>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="color:var(--white);font-size:0.95rem;">${escapeHtml(a.title)}</strong>
            <span class="badge ${a.badge}">${a.time}</span>
          </div>
          <p style="font-size:0.85rem;color:var(--white-dim);margin:0 0 6px 0;">${escapeHtml(a.message)}</p>
        </div>
      </div>
      <div>
        <a href="${a.link}" class="btn btn-sm btn-outline" style="white-space:nowrap;">
          ${a.linkText} →
        </a>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function markAllNotificationsRead() {
  showToast('Marking notifications as read...', 'info');
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    showToast('All notifications marked as read.');
    await DB.reload();
    renderNotificationsModule();
  } catch (e) {
    showToast('Failed to update notifications', 'error');
  }
}
