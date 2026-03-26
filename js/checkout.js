/* ============================================================
   THE ACCESSORIES HUB — Checkout Logic (Single-Page Flow)
   Auth check, stock validation, order creation, inventory sync
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  renderOrderSummary();
  initDeliveryToggle();
  initPaymentCards();
  initGiftOption();
  checkAuthStatus();
});

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
          <img src="${item.image}" alt="${item.name}" onerror="this.src='images/placeholder.png'">
        </div>
        <div class="order-item-info">
          <div class="order-item-name">${item.name}</div>
          <div class="order-item-qty">Qty: ${item.qty}</div>
        </div>
        <div class="order-item-price">Rs. ${(item.price * item.qty).toLocaleString()}</div>
        <span class="order-item-remove" onclick="removeCartItem(${item.id})">✕</span>
      </div>
    `).join('');
  }

  updateTotals();
}

function updateTotals() {
  const subtotal = Cart.getTotal();
  const deliveryMethod = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
  
  let shipping;
  if (subtotal >= 2000) {
    shipping = 0;
  } else if (deliveryMethod === 'express') {
    shipping = 250;
  } else {
    shipping = 150;
  }

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
      updateTotals(); // Recalculate when delivery changes
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

      // Pre-fill name
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

// --- Stock Validation ---
async function validateStock() {
  for (const item of Cart.items) {
    try {
      const { data: product } = await supabase.from('products').select('stock, name').eq('id', item.id).single();
      if (product && product.stock !== null && product.stock < item.qty) {
        alert(`Sorry, "${product.name}" only has ${product.stock} left in stock. Please adjust your quantity.`);
        return false;
      }
    } catch (e) {
      // If stock check fails, continue — don't block the order
      console.warn('Stock check failed for item', item.id, e);
    }
  }
  return true;
}

// --- Place Order (Main Function) ---
async function placeOrder() {
  if (!validateForm()) return;

  const btn = document.getElementById('confirmOrderBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'PROCESSING...';
  }

  try {
    // 1. Validate stock
    const stockOk = await validateStock();
    if (!stockOk) {
      if (btn) { btn.disabled = false; btn.textContent = 'CONFIRM ORDER'; }
      return;
    }

    // 2. Collect form data
    const name = document.getElementById('fullName')?.value || '';
    const whatsapp = document.getElementById('whatsapp')?.value || '';
    const city = document.getElementById('city')?.value || '';
    const landmark = document.getElementById('landmark')?.value || '';
    const address = document.getElementById('address')?.value || '';
    const fullAddress = `${address}, ${landmark}, ${city}`;
    const deliveryMethod = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';
    const isGift = document.getElementById('isGift')?.checked || false;
    const giftNote = document.getElementById('giftNote')?.value || '';

    const subtotal = Cart.getTotal();
    let shipping;
    if (subtotal >= 2000) {
      shipping = 0;
    } else if (deliveryMethod === 'express') {
      shipping = 250;
    } else {
      shipping = 150;
    }
    const total = subtotal + shipping;

    // 3. Upsert Customer
    let customerId;
    const { data: existingCustomers } = await supabase.from('customers').select('*').eq('phone', whatsapp);
    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      await supabase.from('customers').update({
        total_orders: existingCustomers[0].total_orders + 1,
        total_spent: existingCustomers[0].total_spent + total,
        address: fullAddress,
        phone: whatsapp
      }).eq('id', customerId);
    } else {
      const { data: newCustomer, error: cErr } = await supabase.from('customers').insert([{
        name, email: '', phone: whatsapp, address: fullAddress,
        notes: isGift ? `🎁 Gift: ${giftNote}` : '',
        total_orders: 1, total_spent: total
      }]).select();
      if (cErr) throw cErr;
      customerId = newCustomer[0].id;
    }

    // 4. Insert Order
    const { data: newOrder, error: oErr } = await supabase.from('orders').insert([{
      customer_id: customerId,
      customer_name: name,
      subtotal,
      shipping,
      total,
      status: 'Pending',
      payment: paymentMethod,
      shipping_address: fullAddress,
      date: new Date().toLocaleDateString('en-GB')
    }]).select();
    if (oErr) throw oErr;
    const orderId = newOrder[0].id;

    // 5. Insert Order Items & Update Stock
    for (const item of Cart.items) {
      await supabase.from('order_items').insert([{
        order_id: orderId,
        product_id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        image: item.image
      }]);

      // Update inventory
      const { data: pData } = await supabase.from('products').select('stock').eq('id', item.id).single();
      if (pData && pData.stock !== null) {
        const newStock = Math.max(0, pData.stock - item.qty);
        await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

        await supabase.from('stock_history').insert([{
          product: item.name,
          type: 'Sold',
          change_amount: -item.qty,
          new_stock: newStock,
          date: new Date().toLocaleDateString('en-GB')
        }]);
      }
    }

    // 6. Handle Payment Method Redirect
    if (paymentMethod === 'esewa' || paymentMethod === 'khalti' || paymentMethod === 'fonepay') {
      // For digital wallets, show success first then would redirect to gateway
      // In production, these would redirect to the actual payment API
      console.log(`Payment gateway: ${paymentMethod} — Order #TAH-${orderId.toString().padStart(5, '0')}`);
    }

    // 7. Show Success UI
    const orderNumber = 'TAH-' + orderId.toString().padStart(5, '0');
    const confirmation = document.getElementById('orderConfirmation');
    const content = document.getElementById('checkoutContent');

    if (confirmation) {
      const orderNumEl = confirmation.querySelector('.order-number');
      if (orderNumEl) orderNumEl.textContent = `Order #${orderNumber}`;
      confirmation.style.display = 'block';
    }
    if (content) content.style.display = 'none';

    // Clear cart
    Cart.items = [];
    Cart.save();

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Checkout error:', err);
    alert('There was an error processing your order. Please try again.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'CONFIRM ORDER';
    }
  }
}
