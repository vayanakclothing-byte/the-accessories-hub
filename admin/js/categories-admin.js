/* ============================================================
   Categories Admin — Management, SEO, & Category Assignment
   ============================================================ */

let editingCategoryId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderCategoriesTable();
  updateCategoryStats();
  document.getElementById('categoryForm')?.addEventListener('submit', saveCategory);
});

function renderCategoriesTable() {
  const categories = DB.categories();
  const products = DB.products();

  const tbody = document.getElementById('categoriesBody');
  if (!tbody) return;

  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--white-muted);padding:24px;">No categories configured yet.</td></tr>';
    return;
  }

  tbody.innerHTML = categories.map(cat => {
    // Count how many products belong to this category
    const catSlug = (cat.slug || '').toLowerCase();
    const matchingProducts = products.filter(p => (p.category || '').toLowerCase() === catSlug);
    const count = matchingProducts.length;

    const isActive = cat.is_active !== false;
    const imgUrl = cat.image_url ? (cat.image_url.startsWith('/') || cat.image_url.startsWith('http') ? cat.image_url : `/${cat.image_url}`) : '/images/placeholder.webp';

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:6px; overflow:hidden; background:#222; border:1px solid rgba(197,160,40,0.3); flex-shrink:0;">
              <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(cat.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='/images/placeholder.webp';">
            </div>
            <div>
              <div style="font-weight:600; color:var(--white);">${escapeHtml(cat.name)}</div>
              <div style="font-size:0.75rem; color:var(--gold); font-family:monospace;">/collections/${escapeHtml(cat.slug)}</div>
            </div>
          </div>
        </td>
        <td style="max-width:280px; font-size:0.85rem; color:var(--white-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(cat.description || '—')}
        </td>
        <td>
          <span class="badge ${count > 0 ? 'badge-gold' : 'badge-grey'}" style="font-size:0.8rem; padding:4px 10px;">
            ${count} ${count === 1 ? 'product' : 'products'}
          </span>
        </td>
        <td style="font-size:0.85rem; color:var(--white-muted);">
          ${cat.sort_order ?? 0}
        </td>
        <td>
          <span class="badge ${isActive ? 'badge-green' : 'badge-red'}" style="cursor:pointer;" onclick="toggleCategoryActive('${cat.id}', ${!isActive})" title="Click to toggle active state">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style="font-size:0.8rem; color:var(--white-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(cat.seo_title || cat.name + ' | The Accessories Hub')}
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-ghost" onclick="editCategory('${cat.id}')" title="Edit Category" aria-label="Edit category" style="display:inline-flex;align-items:center;gap:4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Edit</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="attemptDeleteCategory('${cat.id}', '${escapeHtml(cat.name)}', ${count})" title="Delete Category" aria-label="Delete category" ${count > 0 ? 'style="opacity:0.6;"' : ''}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateCategoryStats() {
  const categories = DB.categories();
  const products = DB.products();

  const totalEl = document.getElementById('statTotalCategories');
  const activeEl = document.getElementById('statActiveCategories');
  const assignedEl = document.getElementById('statCategorizedProducts');

  if (totalEl) totalEl.textContent = categories.length;
  if (activeEl) activeEl.textContent = categories.filter(c => c.is_active !== false).length;

  if (assignedEl) {
    const validSlugs = new Set(categories.map(c => (c.slug || '').toLowerCase()));
    const categorized = products.filter(p => validSlugs.has((p.category || '').toLowerCase())).length;
    assignedEl.textContent = `${categorized} / ${products.length}`;
  }
}

function openAddCategory() {
  editingCategoryId = null;
  document.getElementById('categoryModalTitle').textContent = 'Add New Category';
  document.getElementById('categoryForm').reset();
  document.getElementById('catActive').checked = true;
  openModal('categoryModal');
}

function editCategory(id) {
  const cat = DB.categories().find(c => String(c.id) === String(id));
  if (!cat) return;

  editingCategoryId = cat.id;
  document.getElementById('categoryModalTitle').textContent = 'Edit Category: ' + cat.name;
  document.getElementById('catName').value = cat.name || '';
  document.getElementById('catSlug').value = cat.slug || '';
  document.getElementById('catDescription').value = cat.description || '';
  document.getElementById('catImageUrl').value = cat.image_url || '';
  document.getElementById('catSeoTitle').value = cat.seo_title || '';
  document.getElementById('catSeoDescription').value = cat.seo_description || '';
  document.getElementById('catSortOrder').value = cat.sort_order ?? 0;
  document.getElementById('catActive').checked = cat.is_active !== false;

  openModal('categoryModal');
}

async function saveCategory(e) {
  e.preventDefault();

  const name = document.getElementById('catName').value.trim();
  const slug = document.getElementById('catSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const description = document.getElementById('catDescription').value.trim();
  const image_url = document.getElementById('catImageUrl').value.trim();
  const seo_title = document.getElementById('catSeoTitle').value.trim();
  const seo_description = document.getElementById('catSeoDescription').value.trim();
  const sort_order = parseInt(document.getElementById('catSortOrder').value, 10) || 0;
  const is_active = document.getElementById('catActive').checked;

  if (!name || !slug) {
    showToast('Name and Slug are required.', 'error');
    return;
  }

  const payload = {
    name,
    slug,
    description,
    image_url,
    seo_title,
    seo_description,
    sort_order,
    is_active,
    updated_at: new Date().toISOString()
  };

  try {
    let error = null;
    if (editingCategoryId) {
      const res = await supabase.from('categories').update(payload).eq('id', editingCategoryId);
      error = res.error;
    } else {
      payload.created_at = new Date().toISOString();
      const res = await supabase.from('categories').insert([payload]);
      error = res.error;
    }

    if (error) {
      showToast('Could not save category: ' + error.message, 'error');
      return;
    }

    showToast(editingCategoryId ? 'Category updated successfully!' : 'Category created successfully!');
    closeAllModals();
    await DB.reload();
    renderCategoriesTable();
    updateCategoryStats();
  } catch (err) {
    showToast('An error occurred while saving: ' + err.message, 'error');
  }
}

async function toggleCategoryActive(id, newActive) {
  try {
    const { error } = await supabase.from('categories').update({ is_active: newActive }).eq('id', id);
    if (error) {
      showToast('Failed to update category status: ' + error.message, 'error');
      return;
    }
    showToast(`Category marked as ${newActive ? 'Active' : 'Inactive'}.`);
    await DB.reload();
    renderCategoriesTable();
    updateCategoryStats();
  } catch (err) {
    showToast('Error updating status: ' + err.message, 'error');
  }
}

function attemptDeleteCategory(id, name, productCount) {
  // Safety rule from specification:
  // "Prevent accidental deletion of categories containing products.
  // When deactivating a category, handle affected products gracefully."
  if (productCount > 0) {
    alert(`Cannot Delete "${name}"!\n\nThis category currently has ${productCount} assigned products. To protect database integrity, reassign or remove these products before deleting the category, or deactivate it instead.`);
    return;
  }

  if (confirm(`Are you sure you want to permanently delete the "${name}" category? This action cannot be undone.`)) {
    deleteCategory(id);
  }
}

async function deleteCategory(id) {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      showToast('Could not delete category: ' + error.message, 'error');
      return;
    }
    showToast('Category deleted successfully.');
    await DB.reload();
    renderCategoriesTable();
    updateCategoryStats();
  } catch (err) {
    showToast('Error deleting category: ' + err.message, 'error');
  }
}
