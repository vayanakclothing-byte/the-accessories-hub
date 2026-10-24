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
      if (authText) authText.innerHTML = '👤 Guest Checkout — <a href="login.html" style="color:var(--gold);">Sign in</a> for faster checkout';
    }
  } catch (e) {
    if (authText) authText.innerHTML = '👤 Guest Checkout';
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

    if (error) throw new Error(error.message || 'Could not place the order.');

    const result = data || {};
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

  if (window.TAH_DEMO_MODE) {
    if (titleEl) titleEl.textContent = 'Demo order — not sent to the shop';
    if (textEl) {
      textEl.textContent = 'This site is running without a database, so this order was NOT saved and no one was notified. '
        + 'Please send your order on WhatsApp instead.';
    }
    if (!document.getElementById('demoWhatsappLink')) {
      const link = document.createElement('a');
      link.id = 'demoWhatsappLink';
      link.href = 'https://wa.me/9779805659501?text=' + encodeURIComponent(`Hi! I'd like to order (${orderNumber}).`);
      link.className = 'btn btn-gold';
      link.textContent = 'Order on WhatsApp';
      link.style.marginBottom = '12px';
      link.style.display = 'inline-block';
      confirmation.insertBefore(link, orderNumEl || null);
    }
  } else {
    if (titleEl) titleEl.textContent = 'Order Placed Successfully!';
    if (textEl && result && result.total != null) {
      textEl.textContent = 'Thank you for shopping with The Accessories Hub. '
        + `Your total is Rs. ${Number(result.total).toLocaleString()} and you will receive a confirmation on WhatsApp shortly.`;
    }
  }

  confirmation.style.display = 'block';
  if (content) content.style.display = 'none';
}
