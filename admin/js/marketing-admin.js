/* ============================================================
   THE ACCESSORIES HUB — Marketing & Promotions Admin Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderMarketingModule();
});

function renderMarketingModule() {
  const settings = DB.settings();
  const marketing = settings.marketing || {};
  const orders = DB.orders();

  const isPopupEnabled = marketing.popupEnabled !== false;
  const promoCode = marketing.promoCode || 'TAH10';

  // Calculate attributed sales from orders with promo code
  let promoRev = 0;
  orders.forEach(o => {
    if (o.coupon_code && o.status !== 'cancelled') {
      promoRev += o.total || 0;
    }
  });

  document.getElementById('statPopupStatus').textContent = isPopupEnabled ? 'Active' : 'Disabled';
  document.getElementById('statPromoCode').textContent = promoCode;
  document.getElementById('statMarketingRevenue').textContent = formatPrice(promoRev);

  // Form values
  document.getElementById('popupEnabled').value = isPopupEnabled ? 'true' : 'false';
  document.getElementById('popupDelay').value = marketing.popupDelay || 5;
  document.getElementById('popupHeadline').value = marketing.popupHeadline || 'Get 10% Off Your First Order';
  document.getElementById('popupSubtext').value = marketing.popupSubtext || 'Enjoy handcrafted rings, necklaces & earrings with free Birgunj delivery on orders above Rs. 2,000.';
  document.getElementById('popupCouponCode').value = promoCode;
  document.getElementById('popupFrequency').value = marketing.popupFrequency || '7days';

  document.getElementById('bannerEnabled').value = marketing.bannerEnabled !== false ? 'true' : 'false';
  document.getElementById('bannerMessage').value = marketing.bannerMessage || '✨ Free Delivery on Orders Above Rs. 2,000 across Nepal! Express Delivery inside Birgunj.';
  document.getElementById('bannerLink').value = marketing.bannerLink || '/products.html';
}

async function savePopupConfig(e) {
  e.preventDefault();
  const currentSettings = DB.settings();
  const currentMarketing = currentSettings.marketing || {};

  const updatedMarketing = {
    ...currentMarketing,
    popupEnabled: document.getElementById('popupEnabled').value === 'true',
    popupDelay: Number(document.getElementById('popupDelay').value) || 5,
    popupHeadline: document.getElementById('popupHeadline').value.trim(),
    popupSubtext: document.getElementById('popupSubtext').value.trim(),
    promoCode: document.getElementById('popupCouponCode').value.toUpperCase().trim(),
    popupFrequency: document.getElementById('popupFrequency').value
  };

  showToast('Saving popup settings...', 'info');

  const { error } = await supabase.from('settings').update({
    marketing: updatedMarketing
  }).eq('id', 1);

  if (error) {
    showToast('Failed to save: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('UPDATE_MARKETING', 'settings', 'popup', 'Updated promotional welcome popup settings');
  showToast('Storefront popup configuration saved!');
  await DB.reload();
  renderMarketingModule();
}

async function saveBannerConfig(e) {
  e.preventDefault();
  const currentSettings = DB.settings();
  const currentMarketing = currentSettings.marketing || {};

  const updatedMarketing = {
    ...currentMarketing,
    bannerEnabled: document.getElementById('bannerEnabled').value === 'true',
    bannerMessage: document.getElementById('bannerMessage').value.trim(),
    bannerLink: document.getElementById('bannerLink').value.trim()
  };

  showToast('Saving announcement bar...', 'info');

  const { error } = await supabase.from('settings').update({
    marketing: updatedMarketing
  }).eq('id', 1);

  if (error) {
    showToast('Failed to save announcement: ' + error.message, 'error');
    return;
  }

  await DB.logAudit('UPDATE_BANNER', 'settings', 'banner', 'Updated storefront header announcement');
  showToast('Header announcement banner updated!');
  await DB.reload();
  renderMarketingModule();
}
