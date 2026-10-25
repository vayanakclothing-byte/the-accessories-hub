/* ============================================================
   THE ACCESSORIES HUB — Staff & Roles Admin Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderStaffModule();
});

function renderStaffModule() {
  const profiles = DB.profiles();

  const admins = profiles.filter(p => p.role === 'admin');
  const staff = profiles.filter(p => p.role === 'staff' || p.role === 'manager');
  const users = profiles.filter(p => p.role === 'user' || !p.role);

  document.getElementById('statAdminCount').textContent = admins.length;
  document.getElementById('statStaffCount').textContent = staff.length;
  document.getElementById('statUserCount').textContent = users.length;

  renderStaffTable(profiles);
}

function renderStaffTable(profiles) {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  if (profiles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--white-muted);">No profiles loaded. Profiles are generated upon user registration.</td></tr>';
    return;
  }

  tbody.innerHTML = profiles.map(p => {
    const roleKey = p.role || 'user';
    const roleBadgeMap = {
      admin: '<span class="badge badge-gold">Administrator</span>',
      manager: '<span class="badge badge-blue">Manager</span>',
      staff: '<span class="badge badge-green">Staff</span>',
      user: '<span class="badge badge-grey">Customer</span>'
    };
    const accessDescMap = {
      admin: 'Full Read/Write across all 20 ERP modules',
      manager: 'Catalogue, Inventory, Orders & Fulfillment',
      staff: 'Orders, Invoices & Dispatch management',
      user: 'Storefront purchase & customer account'
    };

    return `
      <tr>
        <td><code style="font-size:0.75rem; color:var(--white-muted);">${escapeHtml((p.id || '').substring(0, 16))}...</code></td>
        <td><strong>${escapeHtml(p.email || '—')}</strong></td>
        <td>${roleBadgeMap[roleKey] || `<span class="badge badge-grey">${roleKey}</span>`}</td>
        <td style="font-size:0.8rem; color:var(--white-dim);">${accessDescMap[roleKey] || 'Standard permissions'}</td>
        <td>${p.date || formatDate(p.created_at)}</td>
        <td>
          <button onclick="openChangeRoleModal('${p.id}', '${escapeHtml(p.email)}', '${roleKey}')" class="btn btn-sm btn-outline">
            <i data-lucide="shield" style="width:13px;height:13px;"></i> Change Role
          </button>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function openChangeRoleModal(userId, userEmail, currentRole) {
  document.getElementById('roleUserId').value = userId;
  document.getElementById('roleUserEmail').value = userEmail;
  document.getElementById('roleSelect').value = currentRole;
  openModal('roleModal');
}

async function saveUserRole(e) {
  e.preventDefault();
  const userId = document.getElementById('roleUserId').value;
  const newRole = document.getElementById('roleSelect').value;
  const userEmail = document.getElementById('roleUserEmail').value;

  showToast(`Updating role for ${userEmail}...`, 'info');

  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) {
    showToast('Failed to update role: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('CHANGE_USER_ROLE', 'profiles', userId, `Updated ${userEmail} role to ${newRole}`);
  showToast(`Role updated to ${newRole}!`);
  closeAllModals();
  await DB.reload();
  renderStaffModule();
}

function filterStaff() {
  const query = document.getElementById('staffSearch').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#staffTableBody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = text.includes(query) ? '' : 'none';
  });
}

function exportStaffCSV() {
  const profiles = DB.profiles();
  exportTableToCSV(`staff_roles_${new Date().toISOString().split('T')[0]}`, profiles, {
    id: 'User ID',
    email: 'Email',
    role: 'Role',
    date: 'Registered Date'
  });
}
