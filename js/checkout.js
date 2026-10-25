/* ============================================================
   THE ACCESSORIES HUB — Checkout Logic (Single-Page Flow)

   The browser only sends product ids and quantities. Prices, stock and the
   final total are resolved by public.place_order() inside the database (see
   supabase/schema.sql), so a tampered cart cannot change what is charged.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  renderOrderSummary();
  initDeliveryToggle();
  initPaymentCards();
  initGiftOption();
  checkAuthStatus();
});

// escapeHtml() and safeImageUrl() come from js/app.js, which loads first.

// --- Render Order Summary (Left Side) ---
function renderOrderSummary() {
  const itemsContainer = document.getElementById('orderItems');
  const emptyCart = document.getElementById('emptyCart');
  const checkoutContent = document.getElementById('checkoutContent');

  if (Cart.items.length === 0) {
    if (emptyCart) emptyCart.style.display = 'block';
    if (checkoutContent) checkoutContent.style.display = 'none';
    return;
  }

  if (emptyCart) emptyCart.style.display = 'none';
  if (checkoutContent) checkoutContent.style.display = 'grid';

  if (itemsContainer) {
    itemsContainer.innerHTML = Cart.items.map(item => `
      <div class="order-item">
        <div class="order-item-img">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='images/placeholder.png'">
        </div>
        <div class="order-item-info">
          <div class="order-item-name">${escapeHtml(item.name)}</div>
          <div class="order-item-qty">Qty: ${Number(item.qty) || 1}</div>
        </div>
        <div class="order-item-price">Rs. ${(Number(item.price) * (Number(item.qty) || 1)).toLocaleString()}</div>
        <span class="order-item-remove" onclick="removeCartItem(${Number(item.id)})">✕</span>
      </div>
    `).join('');
  }

  updateTotals();
}

function deliveryFeeFor(subtotal, method) {
  if (subtotal >= 2000) return 0;
  return method === 'express' ? 250 : 150;
}

function updateTotals() {
  const subtotal = Cart.getTotal();
  const deliveryMethod = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
  const shipping = deliveryFeeFor(subtotal, deliveryMethod);
  const total = subtotal + shipping;

  const subtotalEl = document.getElementById('orderSubtotal');
  const shippingEl = document.getElementById('orderShipping');
  const totalEl = document.getElementById('orderTotal');

  if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
  if (shippingEl) shippingEl.textContent = shipping === 0 ? 'Free' : `Rs. ${shipping}`;
  if (totalEl) totalEl.textContent = `Rs. ${total.toLocaleString()}`;
}

function removeCartItem(id) {
  Cart.remove(id);
  renderOrderSummary();
}

// --- Delivery Toggle ---
function initDeliveryToggle() {
  document.querySelectorAll('.delivery-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.delivery-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      const radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      updateTotals();
    });
  });
}

// --- Payment Card Selection ---
function initPaymentCards() {
  document.querySelectorAll('.payment-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });
}

// --- Gift Option ---
function initGiftOption() {
  const checkbox = document.getElementById('isGift');
  const textarea = document.getElementById('giftNote');

  if (checkbox && textarea) {
    checkbox.addEventListener('change', () => {
      textarea.style.display = checkbox.checked ? 'block' : 'none';
      if (checkbox.checked) textarea.focus();
    });
  }
}

// --- Auth Status Check ---
async function checkAuthStatus() {
  const authEl = document.getElementById('authStatus');
  const authText = document.getElementById('authText');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const name = session.user.user_metadata?.full_name || session.user.email;
      if (authText) authText.textContent = `✓ Logged in as ${name}`;
      if (authEl) authEl.style.borderColor = 'rgba(39, 174, 96, 0.4)';

      const nameField = document.getElementById('fullName');
      if (nameField && !nameField.value) nameField.value = name;
    } else {
      if (authText) authText.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Guest Checkout — <a href="login.html" style="color:var(--gold);">Sign in</a> for faster checkout</span>';
    }
  } catch (e) {
    if (authText) authText.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Guest Checkout</span>';
  }
}

// --- Form Validation ---
function validateForm() {
  const required = document.querySelectorAll('#checkoutForm input[required], #checkoutForm select[required]');
  let valid = true;

  required.forEach(input => {
    if (!input.value.trim()) {
      input.style.borderColor = '#e74c3c';
      valid = false;
      input.addEventListener('input', () => {
        input.style.borderColor = '';
      }, { once: true });
    }
  });

  if (!valid) {
    const first = document.querySelector('#checkoutForm input[required]:not(:valid), #checkoutForm input[style*="e74c3c"]');
    first?.focus();
  }

  return valid;
}

// --- Place Order (Main Function) ---
async function placeOrder() {
  if (!validateForm()) return;

  const btn = document.getElementById('confirmOrderBtn');
  const setBusy = (busy) => {
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? 'PROCESSING...' : 'CONFIRM ORDER';
  };

  if (Cart.items.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  setBusy(true);

  try {
    const name = document.getElementById('fullName')?.value.trim() || '';
    const whatsapp = document.getElementById('whatsapp')?.value.trim() || '';
    const city = document.getElementById('city')?.value || '';
    const landmark = document.getElementById('landmark')?.value.trim() || '';
    const address = document.getElementById('address')?.value.trim() || '';
    const fullAddress = [address, landmark, city].filter(Boolean).join(', ');
    const deliveryMethod = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';
    const isGift = document.getElementById('isGift')?.checked || false;
    const giftNote = isGift ? (document.getElementById('giftNote')?.value.trim() || '') : '';

    // Only ids and quantities travel to the database.
    const items = Cart.items.map(item => ({
      product_id: item.id,
      qty: Math.max(1, parseInt(item.qty, 10) || 1)
    }));

    let result;
    const { data, error } = await supabase.rpc('place_order', {
      p_customer: {
        name: name || 'Guest',
        phone: whatsapp,
        address: fullAddress,
        notes: giftNote ? `🎁 Gift: ${giftNote}` : ''
      },
      p_items: items,
      p_delivery: deliveryMethod,
      p_payment: paymentMethod,
      p_gift_note: giftNote ? `🎁 Gift: ${giftNote}` : null
    });

    if (error) {
      // If RPC is missing on the remote DB, seamlessly fall back to direct table insertion
      const isMissingRpc = /place_order/i.test(error.message || '') || error.code === 'PGRST202';
      if (isMissingRpc) {
        console.warn('[Checkout] place_order RPC not found in schema cache. Falling back to direct database insertion.');
        result = await placeOrderDirectFallback({ name, whatsapp, fullAddress, deliveryMethod, paymentMethod, giftNote });
      } else {
        throw new Error(error.message || 'Could not place the order.');
      }
    } else {
      result = data || {};
    }

    const orderNumber = result.order_number || (result.order_id ? 'TAH-' + String(result.order_id).padStart(5, '0') : 'TAH-?????');

    Cart.items = [];
    Cart.save();

    showConfirmation(orderNumber, result);
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Checkout error:', err);
    alert(friendlyOrderError(err));
    setBusy(false);
  }
}

// Fallback when place_order RPC is not installed in Supabase
async function placeOrderDirectFallback({ name, whatsapp, fullAddress, deliveryMethod, paymentMethod, giftNote }) {
  const subtotal = Cart.getTotal();
  const shipping = deliveryFeeFor(subtotal, deliveryMethod);
  const total = subtotal + shipping;

  // 1. Customer record lookup or insert
  let customerId = null;
  try {
    const { data: existingCust } = await supabase
      .from('customers')
      .select('id, total_orders, total_spent, notes')
      .eq('phone', whatsapp)
      .maybeSingle();

    if (existingCust) {
      customerId = existingCust.id;
      const updatedNotes = giftNote
        ? (existingCust.notes ? existingCust.notes + '\n' + giftNote : giftNote)
        : existingCust.notes;
      await supabase.from('customers').update({
        name: name || 'Guest',
        address: fullAddress,
        total_orders: (existingCust.total_orders || 0) + 1,
        total_spent: (Number(existingCust.total_spent) || 0) + total,
        notes: updatedNotes
      }).eq('id', customerId);
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{
          name: name || 'Guest',
          phone: whatsapp,
          address: fullAddress,
          total_orders: 1,
          total_spent: total,
          notes: giftNote || '',
          join_date: new Date().toISOString().split('T')[0]
        }])
        .select('id')
        .single();
      if (!custErr && newCust) {
        customerId = newCust.id;
      }
    }
  } catch (custEx) {
    console.warn('[Checkout Fallback] Customer record error:', custEx);
  }

  // 2. Insert into orders table
  const orderDate = new Date().toLocaleDateString('en-GB');
  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .insert([{
      customer_id: customerId,
      customer_name: name || 'Guest',
      subtotal,
      shipping,
      total,
      status: 'pending',
      payment: paymentMethod,
      shipping_address: fullAddress,
      date: orderDate
    }])
    .select('id')
    .single();

  if (orderErr) {
    throw new Error(orderErr.message || 'Failed to record your order.');
  }

  const orderId = orderData.id;

  // 3. Insert into order_items
  try {
    const orderItems = Cart.items.map(item => ({
      order_id: orderId,
      product_id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      qty: Math.max(1, parseInt(item.qty, 10) || 1),
      image: item.image || ''
    }));
    await supabase.from('order_items').insert(orderItems);
  } catch (itemEx) {
    console.warn('[Checkout Fallback] Order items insert error:', itemEx);
  }

  // 4. Update stock in products and add stock_history
  try {
    for (const item of Cart.items) {
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
      if (prod && prod.stock != null) {
        const newStock = Math.max(0, prod.stock - qty);
        await supabase.from('products').update({ stock: newStock, in_stock: newStock > 0 }).eq('id', item.id);
        await supabase.from('stock_history').insert([{
          product: item.name,
          type: 'Sold',
          change_amount: -qty,
          new_stock: newStock,
          date: orderDate
        }]);
      }
    }
  } catch (stockEx) {
    console.warn('[Checkout Fallback] Stock update error:', stockEx);
  }

  return {
    order_id: orderId,
    order_number: 'TAH-' + String(orderId).padStart(5, '0'),
    subtotal,
    shipping,
    total
  };
}

// Turn Postgres/PostgREST failures into something a shopper can act on.
function friendlyOrderError(err) {
  const message = String((err && err.message) || '');

  if (/place_order/i.test(message) && /(does not exist|could not find|schema cache)/i.test(message)) {
    return 'Ordering is not switched on yet: the place_order function is missing from the database.\n\n'
      + 'Run supabase/schema.sql in the Supabase SQL editor, then try again.';
  }
  if (/only \d+ left in stock/i.test(message) || /no longer available/i.test(message)) {
    return message;
  }
  if (/row-level security|permission denied/i.test(message)) {
    return 'The shop could not save this order (permission denied). Please contact us on WhatsApp.';
  }
  return message || 'There was an error processing your order. Please try again.';
}

function showConfirmation(orderNumber, result) {
  const confirmation = document.getElementById('orderConfirmation');
  const content = document.getElementById('checkoutContent');
  if (!confirmation) return;

  const orderNumEl = confirmation.querySelector('.order-number');
  const titleEl = confirmation.querySelector('h2');
  const textEl = confirmation.querySelector('p');

  if (orderNumEl) orderNumEl.textContent = orderNumber;
  if (titleEl) titleEl.textContent = 'Order Placed Successfully!';

  if (textEl) {
    if (result && result.total != null) {
      textEl.textContent = 'Thank you for shopping with The Accessories Hub. '
        + `Your total is Rs. ${Number(result.total).toLocaleString()} and you will receive a confirmation on WhatsApp shortly.`;
    } else {
      textEl.textContent = 'Thank you for shopping with The Accessories Hub. Your order has been placed and you will receive a confirmation shortly.';
    }
  }

  // Ensure there is a direct WhatsApp order confirmation button
  let waBtn = document.getElementById('checkoutWhatsappBtn');
  if (!waBtn) {
    waBtn = document.createElement('a');
    waBtn.id = 'checkoutWhatsappBtn';
    waBtn.className = 'btn btn-gold';
    waBtn.target = '_blank';
    waBtn.rel = 'noopener noreferrer';
    waBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;margin:14px 0 16px 0;padding:12px 24px;border-radius:4px;font-weight:600;text-decoration:none;';
    const msg = encodeURIComponent(`Hi! I just placed order (${orderNumber}) on The Accessories Hub.`);
    waBtn.href = `https://wa.me/9779805659501?text=${msg}`;
    waBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
      </svg>
      Confirm on WhatsApp
    `;
    if (orderNumEl) {
      orderNumEl.parentNode.insertBefore(waBtn, orderNumEl.nextSibling);
    } else {
      confirmation.appendChild(waBtn);
    }
  } else {
    const msg = encodeURIComponent(`Hi! I just placed order (${orderNumber}) on The Accessories Hub.`);
    waBtn.href = `https://wa.me/9779805659501?text=${msg}`;
  }

  // Remove any obsolete demo link
  const oldDemo = document.getElementById('demoWhatsappLink');
  if (oldDemo) oldDemo.remove();

  confirmation.style.display = 'block';
  if (content) content.style.display = 'none';
}
