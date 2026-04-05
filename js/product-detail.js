/* ============================================================
   THE ACCESSORIES HUB — Product Detail Logic
   Gallery, Zoom, Sticky Cart, Quantity
   ============================================================ */

let currentProduct = null;

document.addEventListener('DOMContentLoaded', async () => {
  const products = await loadProducts();
  const params = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get('id'));

  currentProduct = products.find(p => p.id === productId);
  if (!currentProduct) {
    currentProduct = products[0]; // Fallback
  }

  renderProductDetail(currentProduct);
  renderRelatedProducts(products, currentProduct);
  initGallery();
  initQuantity();
  initStickyCart();
  initZoom();
  initScrollAnimations();
});

function renderProductDetail(product) {
  // Update page title
  document.title = `${product.name} — The Accessories Hub`;

  // Gallery
  const mainImg = document.getElementById('galleryMain');
  if (mainImg) mainImg.src = product.image;

  // Thumbnails
  const thumbs = document.getElementById('galleryThumbs');
  if (thumbs) {
    thumbs.innerHTML = `
      <div class="gallery-thumb active" onclick="changeImage('${product.image}', this)">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="gallery-thumb" onclick="changeImage('${product.image}', this)">
        <img src="${product.image}" alt="${product.name} angle 2">
      </div>
      <div class="gallery-thumb" onclick="changeImage('${product.image}', this)">
        <img src="${product.image}" alt="${product.name} angle 3">
      </div>
    `;
  }

  // Badge
  const badge = document.getElementById('productBadge');
  if (badge) {
    badge.textContent = product.badge || '';
    badge.style.display = product.badge ? 'inline-block' : 'none';
  }

  // Collection label
  const collLabel = document.getElementById('collectionLabel');
  if (collLabel) collLabel.textContent = `${product.collection} Collection`;

  // Title
  const title = document.getElementById('productTitle');
  if (title) title.textContent = product.name;

  // Price
  const price = document.getElementById('productPrice');
  if (price) price.textContent = `Rs. ${product.price.toLocaleString()}`;

  const originalPrice = document.getElementById('originalPrice');
  if (originalPrice) {
    if (product.originalPrice) {
      originalPrice.textContent = `Rs. ${product.originalPrice.toLocaleString()}`;
      originalPrice.style.display = 'inline';
      const discount = Math.round((1 - product.price / product.originalPrice) * 100);
      const discountEl = document.getElementById('discountBadge');
      if (discountEl) {
        discountEl.textContent = `-${discount}%`;
        discountEl.style.display = 'inline-block';
      }
    } else {
      originalPrice.style.display = 'none';
      const discountEl = document.getElementById('discountBadge');
      if (discountEl) discountEl.style.display = 'none';
    }
  }

  // Description
  const desc = document.getElementById('productDescription');
  if (desc) desc.textContent = product.description;

  // Features
  const features = document.getElementById('productFeatures');
  if (features && product.features) {
    features.innerHTML = product.features.map(f =>
      `<span class="feature-tag">✦ ${f}</span>`
    ).join('');
  }

  // Meta
  const material = document.getElementById('productMaterial');
  if (material) material.textContent = product.material;

  const collection = document.getElementById('productCollection');
  if (collection) collection.textContent = product.collection.charAt(0).toUpperCase() + product.collection.slice(1);

  const availability = document.getElementById('productAvailability');
  if (availability) {
    availability.textContent = product.inStock ? 'In Stock' : 'Out of Stock';
    availability.style.color = product.inStock ? 'var(--green)' : 'var(--red)';
  }

  // Sticky cart price
  const stickyPrice = document.getElementById('stickyPrice');
  if (stickyPrice) stickyPrice.textContent = `Rs. ${product.price.toLocaleString()}`;

  // Breadcrumb
  const breadcrumbName = document.getElementById('breadcrumbProduct');
  if (breadcrumbName) breadcrumbName.textContent = product.name;
}

function renderRelatedProducts(products, current) {
  const related = products
    .filter(p => p.id !== current.id && (p.collection === current.collection || p.category === current.category))
    .slice(0, 4);

  const grid = document.getElementById('relatedGrid');
  if (grid) {
    grid.innerHTML = related.map(p => renderProductCard(p)).join('');
    initScrollAnimations();
  }
}

function changeImage(src, thumbEl) {
  const mainImg = document.getElementById('galleryMain');
  if (mainImg) mainImg.src = src;

  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumbEl?.classList.add('active');
}

function initGallery() {
  // Hover zoom on main image
  const mainContainer = document.querySelector('.gallery-main');
  const mainImg = document.getElementById('galleryMain');

  if (mainContainer && mainImg) {
    let ticking = false;
    let rect;
    
    mainContainer.addEventListener('mouseenter', () => {
      rect = mainContainer.getBoundingClientRect();
    });

    mainContainer.addEventListener('mousemove', (e) => {
      if (!rect) rect = mainContainer.getBoundingClientRect();
      if (!ticking) {
        requestAnimationFrame(() => {
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          mainImg.style.transformOrigin = `${x}% ${y}%`;
          ticking = false;
        });
        ticking = true;
      }
    });

    mainContainer.addEventListener('mouseleave', () => {
      mainImg.style.transformOrigin = 'center center';
    });
  }
}

function initQuantity() {
  const qtyInput = document.getElementById('qtyInput');
  const minusBtn = document.getElementById('qtyMinus');
  const plusBtn = document.getElementById('qtyPlus');

  minusBtn?.addEventListener('click', () => {
    const val = parseInt(qtyInput.value) || 1;
    qtyInput.value = Math.max(1, val - 1);
  });

  plusBtn?.addEventListener('click', () => {
    const val = parseInt(qtyInput.value) || 1;
    qtyInput.value = Math.min(10, val + 1);
  });
}

function addToCartFromDetail() {
  if (!currentProduct) return;
  const qty = parseInt(document.getElementById('qtyInput')?.value) || 1;
  Cart.add({
    id: currentProduct.id,
    name: currentProduct.name,
    price: currentProduct.price,
    image: currentProduct.image
  }, qty);
}

function initStickyCart() {
  const stickyBar = document.querySelector('.sticky-cart-bar');
  const addToCartSection = document.querySelector('.add-to-cart-section');

  if (!stickyBar || !addToCartSection) return;

  // Only on mobile
  if (window.innerWidth > 992) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      stickyBar.style.display = entry.isIntersecting ? 'none' : 'flex';
    });
  }, { threshold: 0 });

  observer.observe(addToCartSection);
}

function initZoom() {
  const mainContainer = document.querySelector('.gallery-main');
  const zoomOverlay = document.getElementById('zoomOverlay');
  const zoomImg = document.getElementById('zoomImage');

  mainContainer?.addEventListener('click', () => {
    if (zoomOverlay && zoomImg) {
      zoomImg.src = document.getElementById('galleryMain').src;
      zoomOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  });

  zoomOverlay?.addEventListener('click', () => {
    zoomOverlay.classList.remove('active');
    document.body.style.overflow = '';
  });
}

// --- Buy Now Flow ---
async function handleBuyNow() {
  if (!currentProduct) return;

  const qty = parseInt(document.getElementById('qtyInput')?.value) || 1;
  
  // Add to cart and immediately go to checkout
  Cart.add({
    id: currentProduct.id,
    name: currentProduct.name,
    price: currentProduct.price,
    image: currentProduct.image
  }, qty);
  
  window.location.href = 'checkout.html';
}

function showOrderConfirmation(order) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.3s ease;
  `;
  overlay.innerHTML = `
    <div style="
      background: #111; border: 1px solid rgba(212,175,55,0.3);
      border-radius: 16px; padding: 3rem; max-width: 420px; width: 90%;
      text-align: center; box-shadow: 0 0 60px rgba(212,175,55,0.15);
    ">
      <div style="font-size: 3rem; margin-bottom: 1rem;">✨</div>
      <h2 style="color: #D4AF37; font-family: var(--font-serif); margin-bottom: 0.5rem;">Order Placed!</h2>
      <p style="color: #aaa; margin-bottom: 1.5rem;">
        Your order for <strong style="color:#fff;">${currentProduct.name}</strong> has been placed successfully.
        We'll send you a confirmation email shortly.
      </p>
      <p style="color: #D4AF37; font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem;">
        Total: Rs. ${order.total_price.toLocaleString()}
      </p>
      <button onclick="this.closest('div').parentElement.remove(); window.location.href='index.html';" 
        style="
          background: linear-gradient(135deg, #D4AF37, #E8C84A); color: #000;
          border: none; padding: 14px 40px; border-radius: 8px;
          font-weight: 700; font-size: 1rem; cursor: pointer; letter-spacing: 1px;
        ">CONTINUE SHOPPING</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

