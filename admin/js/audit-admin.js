/* ============================================================
   THE ACCESSORIES HUB — Security & Audit Logs Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderAuditModule();
});

function renderAuditModule() {
  const logs = DB.auditLogs();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => (l.created_at || '').startsWith(todayStr));

  document.getElementById('statAuditCount').textContent = logs.length;
  document.getElementById('statTodayEvents').textContent = todayLogs.length;

  renderAuditTable(logs);
}

function renderAuditTable(logs) {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--white-muted);">No audit logs recorded yet. Changes to products, orders, inventory, settings, and staff are tracked here automatically.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const actionColorMap = {
      UPDATE_PRICE: 'badge-gold',
      RESTOCK_PRODUCT: 'badge-green',
      ORDER_STATUS_CHANGE: 'badge-blue',
      DISPATCH_ORDER: 'badge-blue',
      LOG_RETURN: 'badge-orange',
      COMPLETE_REFUND: 'badge-red',
      CREATE_COUPON: 'badge-gold',
      CHANGE_USER_ROLE: 'badge-red',
      UPDATE_SETTINGS: 'badge-grey'
    };

    return `
      <tr>
        <td style="font-size:0.8rem; color:var(--white-muted); white-space:nowrap;">
          ${l.date || formatDate(l.created_at)}
        </td>
        <td><strong>${escapeHtml(l.user_email || 'admin')}</strong></td>
        <td>
          <span class="badge ${actionColorMap[l.action] || 'badge-grey'}">${escapeHtml(l.action)}</span>
        </td>
        <td><span class="badge badge-grey">${escapeHtml(l.entity_type)}</span></td>
        <td><code>#${escapeHtml(l.entity_id || '—')}</code></td>
        <td style="font-size:0.85rem; color:var(--white-dim);">${escapeHtml(l.details || '—')}</td>
      </tr>
    `;
  }).join('');
}

function filterAuditLogs() {
  const query = document.getElementById('auditSearch').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#auditTableBody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = text.includes(query) ? '' : 'none';
  });
}

function exportAuditCSV() {
  const logs = DB.auditLogs();
  exportTableToCSV(`audit_trail_${new Date().toISOString().split('T')[0]}`, logs, {
    date: 'Timestamp',
    user_email: 'Actor Email',
    action: 'Action',
    entity_type: 'Entity Type',
    entity_id: 'Record ID',
    details: 'Summary & Details'
  });
}
