/* ============================================================
   Customer CRM
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderCustomersTable();
});

function renderCustomersTable(filter = '') {
  let customers = DB.customers();
  if (filter) customers = customers.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.email.toLowerCase().includes(filter.toLowerCase()) || c.phone.includes(filter));

  const tbody = document.getElementById('customersBody');
  if (!tbody) return;

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="admin-avatar" style="width:36px;height:36px;font-size:0.75rem;">${c.name.split(' ').map(n => n[0]).join('')}</div>
          <div>
            <div style="font-weight:500;">${c.name}</div>
            <div style="font-size:0.75rem;color:var(--white-muted);">${c.email}</div>
          </div>
        </div>
      </td>
      <td>${c.phone}</td>
      <td>${c.address}</td>
      <td><strong>${c.totalOrders}</strong></td>
      <td><strong style="color:var(--gold)">${formatPrice(c.totalSpent)}</strong></td>
      <td>${formatDate(c.joinDate)}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" onclick="viewCustomer(${c.id})">👁️</button>
          <button class="btn btn-sm btn-ghost" onclick="editCustomer(${c.id})">✏️</button>
          <button class="wa-btn" style="padding:5px 8px;font-size:0.7rem;" onclick="sendCustomerWhatsApp(${c.id})">💬</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function viewCustomer(id) {
  const c = DB.customers().find(x => x.id === id);
  if (!c) return;

  const orders = DB.orders().filter(o => o.customerId === id).sort((a, b) => new Date(b.date) - new Date(a.date));

  const content = document.getElementById('customerDetailContent');
  content.innerHTML = `
    <div style="display:flex;gap:20px;align-items:center;margin-bottom:24px;">
      <div class="admin-avatar" style="width:64px;height:64px;font-size:1.3rem;">${c.name.split(' ').map(n => n[0]).join('')}</div>
      <div>
        <h3 style="color:var(--white);font-size:1.2rem;">${c.name}</h3>
        <div style="font-size:0.85rem;color:var(--white-muted);">Customer since ${formatDate(c.joinDate)}</div>
      </div>
    </div>
    <div class="detail-grid" style="margin-bottom:20px;">
      <div class="detail-item"><div class="label">Email</div><div class="value">${c.email}</div></div>
      <div class="detail-item"><div class="label">Phone</div><div class="value">${c.phone}</div></div>
      <div class="detail-item"><div class="label">Address</div><div class="value">${c.address}</div></div>
      <div class="detail-item"><div class="label">Total Spent</div><div class="value" style="color:var(--gold)">${formatPrice(c.totalSpent)}</div></div>
    </div>
    ${c.notes ? `<div class="alert alert-info" style="margin-bottom:20px;">📝 <strong>Notes:</strong> ${c.notes}</div>` : ''}
    <h4 style="color:var(--gold);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Order History (${orders.length})</h4>
    ${orders.length === 0 ? '<p style="color:var(--white-muted);">No orders yet.</p>' :
      orders.map(o => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--grey-mid);">
          <div>
            <strong style="color:var(--gold)">#${o.id}</strong>
            <span style="color:var(--white-muted);font-size:0.8rem;margin-left:8px;">${formatDate(o.date)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            ${statusBadge(o.status)}
            <strong>${formatPrice(o.total)}</strong>
          </div>
        </div>
      `).join('')}
  `;
  openModal('customerDetailModal');
}

let editingCustomerId = null;

function openAddCustomer() {
  editingCustomerId = null;
  document.getElementById('customerModalTitle').textContent = 'Add Customer';
  document.getElementById('customerForm').reset();
  openModal('customerModal');
}

function editCustomer(id) {
  const c = DB.customers().find(x => x.id === id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById('customerModalTitle').textContent = 'Edit Customer';
  document.getElementById('cName').value = c.name;
  document.getElementById('cEmail').value = c.email;
  document.getElementById('cPhone').value = c.phone;
  document.getElementById('cAddress').value = c.address;
  document.getElementById('cNotes').value = c.notes || '';
  openModal('customerModal');
}

async function saveCustomer(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('cName').value,
    email: document.getElementById('cEmail').value,
    phone: document.getElementById('cPhone').value,
    address: document.getElementById('cAddress').value,
    notes: document.getElementById('cNotes').value
  };

  if (editingCustomerId) {
    const { error } = await supabase.from('customers').update(data).eq('id', editingCustomerId);
    if (!error) showToast('Customer updated!');
    else console.error(error);
  } else {
    const { error } = await supabase.from('customers').insert([data]);
    if (!error) showToast('Customer added!');
    else console.error(error);
  }

  await loadData();
  closeAllModals();
  renderCustomersTable();
}

function sendCustomerWhatsApp(id) {
  const c = DB.customers().find(x => x.id === id);
  if (!c) return;
  sendWhatsApp(c.phone, `Hello ${c.name}! 💎 Thank you for being a valued customer of The Accessories Hub. Check out our latest collection!`);
}

function searchCustomers() {
  const q = document.getElementById('customerSearch')?.value || '';
  renderCustomersTable(q);
}
