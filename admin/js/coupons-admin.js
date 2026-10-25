/* ============================================================
   THE ACCESSORIES HUB — Discounts & Coupons Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderCouponsModule();
});

function renderCouponsModule() {
  const coupons = DB.coupons();
  const orders = DB.orders();

  const active = coupons.filter(c => c.is_active);
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.timesUsed || 0), 0);

  let discountsGiven = 0;
  let attributedSales = 0;
  orders.forEach(o => {
    if (o.coupon_code) {
      discountsGiven += o.discountAmount || 0;
      attributedSales += o.total || 0;
    }
  });

  document.getElementById('statActiveCoupons').textContent = active.length;
  document.getElementById('statRedemptionsCount').textContent = totalRedemptions;
  document.getElementById('statDiscountsGiven').textContent = formatPrice(discountsGiven);
  document.getElementById('statAttributedSales').textContent = formatPrice(attributedSales);

  renderCouponsTable(coupons);
}

function renderCouponsTable(coupons) {
  const tbody = document.getElementById('couponsTableBody');
  if (!tbody) return;

  if (coupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--white-muted);">No coupons created yet. Click "+ Create Coupon" to launch a promotion.</td></tr>';
    return;
  }

  tbody.innerHTML = coupons.map(c => {
    const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
    const discountLabel = c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `Rs. ${c.discount_value} OFF`;

    return `
      <tr>
        <td>
          <span style="font-family:monospace; font-weight:700; font-size:0.95rem; color:var(--gold-dark); background:rgba(197,160,40,0.1); padding:4px 8px; border-radius:4px; border:1px dashed var(--gold);">
            ${escapeHtml(c.code)}
          </span>
          ${c.description ? `<div style="font-size:0.75rem; color:var(--white-muted); margin-top:4px;">${escapeHtml(c.description)}</div>` : ''}
        </td>
        <td><strong>${discountLabel}</strong></td>
        <td>${c.minOrderAmount > 0 ? formatPrice(c.minOrderAmount) : 'No minimum'}</td>
        <td>
          <span class="badge badge-blue">${c.timesUsed} / ${c.usage_limit || '∞'}</span>
        </td>
        <td>${c.expires_at ? formatDate(c.expires_at) : 'Never'}</td>
        <td>
          ${isExpired
            ? '<span class="badge badge-red">Expired</span>'
            : (c.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-grey">Inactive</span>')}
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button onclick="toggleCouponActive(${c.id}, ${!c.is_active})" class="btn btn-sm btn-outline">
              ${c.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button onclick="deleteCoupon(${c.id})" class="btn btn-sm btn-danger"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function openCouponModal() {
  document.getElementById('couponForm').reset();
  document.getElementById('coupId').value = '';
  document.getElementById('couponModalTitle').textContent = 'Create Promotional Coupon';
  openModal('couponModal');
}

async function saveCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupCode').value.toUpperCase().trim();
  const type = document.getElementById('coupType').value;
  const value = Number(document.getElementById('coupValue').value) || 0;
  const minSpend = Number(document.getElementById('coupMinSpend').value) || 0;
  const limit = Number(document.getElementById('coupLimit').value) || 100;
  const expires = document.getElementById('coupExpires').value || null;
  const desc = document.getElementById('coupDesc').value.trim();

  showToast('Saving coupon...', 'info');

  const { error } = await supabase.from('coupons').insert([{
    code,
    discount_type: type,
    discount_value: value,
    min_order_amount: minSpend,
    usage_limit: limit,
    expires_at: expires,
    description: desc,
    is_active: true
  }]);

  if (error) {
    showToast('Failed to save coupon: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('CREATE_COUPON', 'coupons', code, `Created coupon ${code} (${value} ${type})`);
  showToast(`Coupon ${code} created successfully!`);
  closeAllModals();
  await DB.reload();
  renderCouponsModule();
}

async function toggleCouponActive(id, newActive) {
  showToast('Updating coupon status...', 'info');
  const { error } = await supabase.from('coupons').update({ is_active: newActive }).eq('id', id);
  if (error) {
    showToast('Update failed: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('TOGGLE_COUPON', 'coupons', id, `Set is_active to ${newActive}`);
  showToast('Coupon status updated!');
  await DB.reload();
  renderCouponsModule();
}

async function deleteCoupon(id) {
  if (!confirm('Are you sure you want to delete this coupon?')) return;
  showToast('Deleting coupon...', 'info');
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('DELETE_COUPON', 'coupons', id, 'Deleted coupon');
  showToast('Coupon deleted!');
  await DB.reload();
  renderCouponsModule();
}

function filterCoupons() {
  const query = document.getElementById('couponSearch').value.toUpperCase().trim();
  const rows = document.querySelectorAll('#couponsTableBody tr');
  rows.forEach(r => {
    const text = r.textContent.toUpperCase();
    r.style.display = text.includes(query) ? '' : 'none';
  });
}

function exportCouponsCSV() {
  const coupons = DB.coupons();
  exportTableToCSV(`coupons_${new Date().toISOString().split('T')[0]}`, coupons, {
    code: 'Coupon Code',
    discount_type: 'Discount Type',
    discountValue: 'Discount Value',
    minOrderAmount: 'Min Order Amount (Rs.)',
    timesUsed: 'Times Used',
    usage_limit: 'Usage Limit',
    is_active: 'Is Active'
  });
}
