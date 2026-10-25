/* ============================================================
   THE ACCESSORIES HUB — Customer Reviews & Moderation Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderReviewsModule();
});

function renderReviewsModule() {
  const reviews = DB.reviews();

  const approved = reviews.filter(r => r.is_approved);
  const pending = reviews.filter(r => !r.is_approved);
  let avgRating = 0;
  if (reviews.length > 0) {
    const sum = reviews.reduce((s, r) => s + (Number(r.rating) || 5), 0);
    avgRating = (sum / reviews.length).toFixed(1);
  }

  document.getElementById('statAverageRating').textContent = `${avgRating} / 5.0`;
  document.getElementById('statApprovedReviews').textContent = approved.length;
  document.getElementById('statPendingReviews').textContent = pending.length;
  document.getElementById('statTotalReviews').textContent = reviews.length;

  renderReviewsTable(reviews);
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--white-muted);">No reviews submitted yet. Click "+ Add Testimonial" to record feedback.</td></tr>';
    return;
  }

  tbody.innerHTML = reviews.map(r => {
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
    return `
      <tr>
        <td><strong>${escapeHtml(r.customer_name)}</strong></td>
        <td><span class="badge badge-grey">${escapeHtml(r.product_name || 'General')}</span></td>
        <td><span style="color:var(--gold); font-size:1rem; letter-spacing:1px;">${stars}</span></td>
        <td>
          <div style="font-size:0.85rem; color:var(--white-dim); max-width:380px;">${escapeHtml(r.comment)}</div>
        </td>
        <td>${formatDate(r.date)}</td>
        <td>
          ${r.is_approved ? '<span class="badge badge-green">Approved</span>' : '<span class="badge badge-orange">Pending</span>'}
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button onclick="toggleReviewApproved(${r.id}, ${!r.is_approved})" class="btn btn-sm btn-outline">
              ${r.is_approved ? 'Hide' : 'Approve'}
            </button>
            <button onclick="deleteReview(${r.id})" class="btn btn-sm btn-danger"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function openAddReviewModal() {
  const products = DB.products();
  const select = document.getElementById('revProductSelect');
  select.innerHTML = '<option value="">General Store Review</option>' + products.map(p => `
    <option value="${p.id}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>
  `).join('');

  document.getElementById('reviewForm').reset();
  openModal('reviewModal');
}

async function saveReview(e) {
  e.preventDefault();
  const customer = document.getElementById('revCustomer').value.trim();
  const select = document.getElementById('revProductSelect');
  const prodId = select.value ? Number(select.value) : null;
  const prodName = select.options[select.selectedIndex]?.getAttribute('data-name') || '';
  const rating = Number(document.getElementById('revRating').value) || 5;
  const comment = document.getElementById('revComment').value.trim();

  showToast('Saving testimonial...', 'info');

  const { error } = await supabase.from('reviews').insert([{
    customer_name: customer,
    product_id: prodId,
    product_name: prodName,
    rating,
    comment,
    is_approved: true
  }]);

  if (error) {
    showToast('Failed to save review: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('ADD_REVIEW', 'reviews', customer, `Added ${rating}-star review for ${prodName || 'Store'}`);
  showToast('Customer review published!');
  closeAllModals();
  await DB.reload();
  renderReviewsModule();
}

async function toggleReviewApproved(id, newStatus) {
  showToast('Updating review status...', 'info');
  const { error } = await supabase.from('reviews').update({ is_approved: newStatus }).eq('id', id);
  if (error) {
    showToast('Update failed: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('MODERATE_REVIEW', 'reviews', id, `Set is_approved to ${newStatus}`);
  showToast('Review visibility updated!');
  await DB.reload();
  renderReviewsModule();
}

async function deleteReview(id) {
  if (!confirm('Are you sure you want to delete this review?')) return;
  showToast('Deleting review...', 'info');
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message, 'error');
    return;
  }
  await DB.logAudit('DELETE_REVIEW', 'reviews', id, 'Deleted customer review');
  showToast('Review deleted!');
  await DB.reload();
  renderReviewsModule();
}

function filterReviews() {
  const query = document.getElementById('reviewSearch').value.toLowerCase().trim();
  const filter = document.getElementById('reviewFilter').value;
  let reviews = DB.reviews();

  if (filter === 'approved') reviews = reviews.filter(r => r.is_approved);
  if (filter === 'pending') reviews = reviews.filter(r => !r.is_approved);

  if (query) {
    reviews = reviews.filter(r =>
      (r.customer_name || '').toLowerCase().includes(query) ||
      (r.comment || '').toLowerCase().includes(query) ||
      (r.product_name || '').toLowerCase().includes(query)
    );
  }
  renderReviewsTable(reviews);
}

function exportReviewsCSV() {
  const reviews = DB.reviews();
  exportTableToCSV(`reviews_${new Date().toISOString().split('T')[0]}`, reviews, {
    customer_name: 'Customer',
    product_name: 'Product',
    rating: 'Star Rating',
    comment: 'Review Comment',
    is_approved: 'Is Approved',
    date: 'Date'
  });
}
