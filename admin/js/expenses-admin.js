/* ============================================================
   THE ACCESSORIES HUB — Expenses Management Logic
   ============================================================ */

let expenseChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderExpensesModule();
});

function renderExpensesModule() {
  const expenses = DB.expenses();

  // Calculate KPIs
  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const paid = expenses.filter(e => e.payment_status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0);
  const pending = expenses.filter(e => e.payment_status !== 'paid').reduce((sum, e) => sum + (e.amount || 0), 0);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthTotal = expenses
    .filter(e => (e.date || '').startsWith(currentMonth))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  document.getElementById('statTotalExpenses').textContent = formatPrice(total);
  document.getElementById('statPaidExpenses').textContent = formatPrice(paid);
  document.getElementById('statPendingExpenses').textContent = formatPrice(pending);
  document.getElementById('statMonthExpenses').textContent = formatPrice(monthTotal);

  renderExpensesTable(expenses);
  renderCategoryChart(expenses);
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--white-muted);">No expenses recorded yet. Click "+ Record Expense" to log costs.</td></tr>';
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td><strong style="color:var(--gold-dark);">${escapeHtml(e.reference_no || '#' + e.id)}</strong></td>
      <td>${formatDate(e.date)}</td>
      <td><span class="badge badge-grey">${escapeHtml(e.category)}</span></td>
      <td>
        <div style="font-weight:600; color:var(--white);">${escapeHtml(e.description)}</div>
      </td>
      <td>${escapeHtml(e.payee || '—')}</td>
      <td><strong>${formatPrice(e.amount)}</strong></td>
      <td>
        <span class="badge ${e.payment_status === 'paid' ? 'badge-green' : (e.payment_status === 'pending' ? 'badge-orange' : 'badge-red')}">
          ${escapeHtml(e.payment_status || 'paid')}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button onclick="editExpense(${e.id})" class="btn btn-sm btn-outline"><i data-lucide="edit" style="width:13px;height:13px;"></i></button>
          <button onclick="deleteExpense(${e.id})" class="btn btn-sm btn-danger"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function renderCategoryChart(expenses) {
  const ctx = document.getElementById('expenseCategoryChart')?.getContext('2d');
  if (!ctx || typeof Chart === 'undefined') return;

  if (expenseChart) expenseChart.destroy();

  const categories = {};
  expenses.forEach(e => {
    const cat = e.category || 'Other';
    categories[cat] = (categories[cat] || 0) + (e.amount || 0);
  });

  const labels = Object.keys(categories);
  const data = Object.values(categories);

  const colors = [
    '#C5A028', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6',
    '#F39C12', '#1ABC9C', '#34495E', '#D35400', '#7F8C8D'
  ];

  expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No Expenses'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: labels.length ? colors.slice(0, labels.length) : ['#DDD6C8'],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, color: '#4A4A4A', font: { size: 10 } } },
        tooltip: {
          callbacks: { label: ctx => ` Rs. ${ctx.parsed.toLocaleString()}` }
        }
      },
      cutout: '65%'
    }
  });
}

function filterExpenses() {
  const query = document.getElementById('expenseSearch').value.toLowerCase().trim();
  const category = document.getElementById('expenseCategoryFilter').value;
  let filtered = DB.expenses();

  if (category) {
    filtered = filtered.filter(e => e.category === category);
  }
  if (query) {
    filtered = filtered.filter(e =>
      (e.description || '').toLowerCase().includes(query) ||
      (e.payee || '').toLowerCase().includes(query) ||
      (e.reference_no || '').toLowerCase().includes(query)
    );
  }

  renderExpensesTable(filtered);
}

function openExpenseModal() {
  document.getElementById('expenseForm').reset();
  document.getElementById('expId').value = '';
  document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expenseModalTitle').textContent = 'Record Operating Expense';
  openModal('expenseModal');
}

function editExpense(id) {
  const e = DB.expenses().find(x => x.id === id);
  if (!e) return;
  document.getElementById('expId').value = e.id;
  document.getElementById('expCategory').value = e.category || 'Other';
  document.getElementById('expDate').value = e.date || new Date().toISOString().split('T')[0];
  document.getElementById('expDescription').value = e.description || '';
  document.getElementById('expAmount').value = e.amount || 0;
  document.getElementById('expPayee').value = e.payee || '';
  document.getElementById('expPaymentMethod').value = e.payment_method || 'Cash';
  document.getElementById('expPaymentStatus').value = e.payment_status || 'paid';
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  openModal('expenseModal');
}

async function saveExpense(e) {
  e.preventDefault();
  const id = document.getElementById('expId').value;
  const payload = {
    reference_no: id ? undefined : 'EXP-' + Date.now().toString().slice(-6),
    category: document.getElementById('expCategory').value,
    date: document.getElementById('expDate').value,
    description: document.getElementById('expDescription').value.trim(),
    amount: Number(document.getElementById('expAmount').value) || 0,
    payee: document.getElementById('expPayee').value.trim(),
    payment_method: document.getElementById('expPaymentMethod').value,
    payment_status: document.getElementById('expPaymentStatus').value
  };

  showToast('Saving expense record...', 'info');
  let err = null;

  if (id) {
    const { error } = await supabase.from('expenses').update(payload).eq('id', id);
    err = error;
  } else {
    const { error } = await supabase.from('expenses').insert([payload]);
    err = error;
  }

  if (err) {
    showToast('Failed to save expense: ' + err.message, 'error');
  } else {
    await DB.logAudit(id ? 'UPDATE_EXPENSE' : 'CREATE_EXPENSE', 'expenses', id || 'new', `${payload.description} (Rs. ${payload.amount})`);
    showToast('Expense recorded successfully!');
    closeAllModals();
    await DB.reload();
    renderExpensesModule();
  }
}

async function deleteExpense(id) {
  if (!confirm('Are you sure you want to delete this expense record?')) return;
  showToast('Deleting expense...', 'info');
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) {
    showToast('Failed to delete expense: ' + error.message, 'error');
  } else {
    await DB.logAudit('DELETE_EXPENSE', 'expenses', id, 'Deleted expense record');
    showToast('Expense deleted!');
    await DB.reload();
    renderExpensesModule();
  }
}

function exportExpensesCSV() {
  const expenses = DB.expenses();
  exportTableToCSV(`expenses_${new Date().toISOString().split('T')[0]}`, expenses, {
    reference_no: 'Reference #',
    date: 'Date',
    category: 'Category',
    description: 'Description',
    payee: 'Payee / Vendor',
    amount: 'Amount (Rs.)',
    payment_method: 'Payment Method',
    payment_status: 'Payment Status'
  });
}
