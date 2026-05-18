// Nav scroll, hamburger, closeMobileNav, reveal observer and auth-driven
// navbar updates are all owned by js-files/shared/layout.js (nav-controller +
// auth-ui + reveal modules). cart.js intentionally does not re-wire any of
// them — duplicating those listeners caused the hamburger to double-toggle.

const LOCAL_CART_KEY = 'abCartItems';
const LOCAL_COUNT_KEY = 'abCartCount';

let cartState = {
  items: [],
  loyalty: null,
};

function escapeHtmlLocal(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function formatMoney(value) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function paymentMethodLabel(value) {
  const labels = {
    card: 'Card',
    paypal: 'PayPal',
    cod: 'Cash on Delivery',
  };
  return labels[String(value || '').toLowerCase()] || String(value || 'Card');
}

function formatInvoiceDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function renderInvoice(order, loyalty) {
  const customer = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const fallbackSubtotal = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const subtotal = Number(order.subtotal ?? fallbackSubtotal);
  const shippingAmount = Number(order.shipping_amount ?? 0);
  const discountAmount = Number(order.discount_amount ?? 0);
  const totalAmount = Number(order.total_amount ?? ((subtotal - discountAmount) + shippingAmount));

  document.getElementById('invoiceCustomerName').textContent = customer.name || 'AB Store Customer';
  document.getElementById('invoiceCustomerEmail').textContent = customer.email || 'contact@abstore.com';
  document.getElementById('invoiceCustomerMember').textContent = customer.member_id
    ? `Member ID: ${customer.member_id}`
    : 'Guest purchase';

  document.getElementById('invoiceOrderNumber').textContent = `Invoice #${order.order_number || '—'}`;
  document.getElementById('invoiceOrderDate').textContent = `Issued: ${formatInvoiceDate(order.created_at)}`;
  document.getElementById('invoicePaymentMethod').textContent = `Payment: ${paymentMethodLabel(order.payment_method)}`;

  document.getElementById('invoiceItems').innerHTML = items.length > 0
    ? items.map((item) => `
    <tr>
      <td>
        <div class="invoice-product-brand">${escapeHtmlLocal(item.brand || '')}</div>
        <div class="invoice-product-name">${escapeHtmlLocal(item.name || '')}</div>
      </td>
      <td>${escapeHtmlLocal(item.size || '—')}</td>
      <td>${Number(item.qty || 0)}</td>
      <td>${formatMoney(item.unit_price)}</td>
      <td>${formatMoney(item.line_total)}</td>
    </tr>
  `).join('')
    : `
    <tr>
      <td colspan="5">No order items were returned for this invoice.</td>
    </tr>
  `;

  document.getElementById('invoiceSubtotal').textContent = formatMoney(subtotal);
  document.getElementById('invoiceShipping').textContent = shippingAmount === 0 ? 'Free' : formatMoney(shippingAmount);
  document.getElementById('invoiceDiscountLabel').textContent = Number(order.discount_percent || 0) > 0
    ? `Discount (${Number(order.discount_percent)}%)`
    : 'Discount';
  document.getElementById('invoiceDiscount').textContent = `-${formatMoney(discountAmount)}`;
  document.getElementById('invoiceDiscountRow').style.display = discountAmount > 0 ? 'flex' : 'none';
  document.getElementById('invoicePointsEarned').textContent = String(Number(order.points_earned || 0));
  document.getElementById('invoicePointsRedeemed').textContent = String(Number(order.points_redeemed || 0));
  document.getElementById('invoicePointsRedeemedRow').style.display = Number(order.points_redeemed || 0) > 0 ? 'flex' : 'none';
  document.getElementById('invoiceTotal').textContent = formatMoney(totalAmount);
}

function handleCheckoutSuccess(payload) {
  cartState.items = [];
  cartState.loyalty = payload.loyalty || null;
  setCartBadge(0);

  document.getElementById('cartSection').style.display = 'none';
  const confirm = document.getElementById('orderConfirm');
  confirm.style.display = 'flex';

  const order = payload.order || {};
  document.getElementById('orderConfirmText').textContent =
    `Order ${order.order_number || ''} has been received. You earned ${Number(order.points_earned || 0)} loyalty points${Number(order.points_redeemed || 0) > 0 ? ` and redeemed ${Number(order.points_redeemed)} points.` : '.'}`;
  document.getElementById('orderConfirmMeta').textContent =
    `Total ${formatMoney(order.total_amount)} · Points balance ${Number(payload.loyalty?.points || 0)}`;

  renderInvoice(order, payload.loyalty || null);

  setTimeout(() => {
    confirm.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }, 80);

  void Auth.refreshSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function printInvoice() {
  const previousTitle = document.title;
  const orderNumber = document.getElementById('invoiceOrderNumber')?.textContent?.trim();

  if (orderNumber && orderNumber !== '—') {
    document.title = `AB Store — ${orderNumber}`;
  }

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  window.addEventListener('afterprint', restoreTitle);
  window.print();

  // Some browsers do not reliably emit afterprint when the dialog is dismissed.
  setTimeout(restoreTitle, 1000);
}

// Override the shared nav-controller's openCart on this page: clicking the
// cart icon on the cart page itself should scroll to top, not navigate.
function openCart() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.openCart = openCart;

function setCartBadge(count) {
  const safeCount = Number(count || 0);
  localStorage.setItem(LOCAL_COUNT_KEY, String(safeCount));
  document.getElementById('cartBadge').textContent = String(safeCount);
}

function setPlaceOrderDisabled(disabled) {
  const placeBtn = document.getElementById('placeOrderBtn');
  const purchaseBtn = document.getElementById('purchaseBtn');
  if (placeBtn) placeBtn.disabled = disabled;
  if (purchaseBtn) purchaseBtn.disabled = disabled;
}

async function cartRequest(body) {
  const response = await fetch('/api/cart.php', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      csrf_token: Auth.getCsrfToken(),
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const error = new Error(payload.error || 'Cart request failed.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function isAuthError(error) {
  return Number(error?.status || 0) === 401;
}

async function syncLocalCartToServer() {
  const rawItems = JSON.parse(localStorage.getItem(LOCAL_CART_KEY) || '[]');
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return;
  }

  for (const item of rawItems) {
    if (!item || !item.id || !item.qty) {
      continue;
    }

    await cartRequest({
      action: 'add',
      product_id: Number(item.id),
      qty: Number(item.qty),
    });
  }

  localStorage.removeItem(LOCAL_CART_KEY);
  localStorage.setItem(LOCAL_COUNT_KEY, '0');
}

function renderLoginRequired() {
  document.getElementById('cartItemsList').innerHTML = `
    <div class="cart-empty">
      <i class="bi bi-person-lock"></i>
      <p>Please sign in to load your saved cart, checkout, and collect loyalty points.</p>
      <a href="login.html" class="btn-shop">Sign In</a>
    </div>`;
  document.getElementById('summarySection').style.display = 'none';
  document.getElementById('paymentSection').style.display = 'none';
  document.getElementById('placeOrderWrap').style.display = 'none';
  document.getElementById('cartCountLabel').textContent = '0 items';
  setCartBadge(0);
}

function renderCartLoadError(message) {
  const confirm = document.getElementById('orderConfirm');
  if (confirm) {
    confirm.classList.add('is-hidden');
    confirm.style.display = 'none';
  }
  const cartSection = document.getElementById('cartSection');
  if (cartSection) {
    cartSection.style.display = '';
  }
  document.getElementById('cartItemsList').innerHTML = `
    <div class="cart-empty">
      <i class="bi bi-exclamation-diamond"></i>
      <p>${escapeHtmlLocal(message || 'We could not load your cart right now. Please try again.')}</p>
      <button type="button" class="btn-shop" onclick="window.location.reload()">Retry</button>
    </div>`;
  document.getElementById('summarySection').style.display = 'none';
  document.getElementById('paymentSection').style.display = 'none';
  document.getElementById('placeOrderWrap').style.display = 'none';
}

function resetCartViewState() {
  const cartSection = document.getElementById('cartSection');
  if (cartSection) {
    cartSection.style.display = '';
  }

  const confirm = document.getElementById('orderConfirm');
  if (confirm) {
    confirm.classList.add('is-hidden');
    confirm.style.display = 'none';
  }
}

function getPreviewSummary(items, loyalty, useLoyalty) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const shipping = subtotal >= 200 ? 0 : 15;
  const canRedeem = loyalty && Number(loyalty.available_discount_percent || 0) > 0;
  const discountPercent = useLoyalty && canRedeem ? Number(loyalty.available_discount_percent) : 0;
  const discountAmount = Number((subtotal * (discountPercent / 100)).toFixed(2));
  const total = Number(((subtotal - discountAmount) + shipping).toFixed(2));

  return {
    subtotal,
    shipping,
    discountPercent,
    discountAmount,
    total,
  };
}

function renderSummary(items, loyalty) {
  const useLoyalty = document.getElementById('useLoyaltyDiscount').checked;
  const summary = getPreviewSummary(items, loyalty, useLoyalty);

  document.getElementById('sumSubtotal').textContent = formatMoney(summary.subtotal);
  document.getElementById('sumShipping').textContent = summary.shipping === 0 ? 'Free' : formatMoney(summary.shipping);
  document.getElementById('sumTotal').textContent = formatMoney(summary.total);

  const discountRow = document.getElementById('loyaltyDiscountRow');
  if (summary.discountAmount > 0) {
    discountRow.classList.remove('is-hidden');
    document.getElementById('sumLoyaltyDiscount').textContent = `-${formatMoney(summary.discountAmount)}`;
  } else {
    discountRow.classList.add('is-hidden');
    document.getElementById('sumLoyaltyDiscount').textContent = `-${formatMoney(0)}`;
  }

  const shipNote = document.getElementById('shipNote');
  if (summary.shipping === 0) {
    shipNote.innerHTML = '<p class="ship-tag"><i class="bi bi-check2-circle"></i> Free shipping applied</p>';
  } else {
    shipNote.innerHTML = `<p class="ship-note">Spend ${formatMoney(200 - summary.subtotal)} more to unlock free shipping</p>`;
  }

  const loyaltyPanel = document.getElementById('loyaltySummaryPanel');
  const loyaltyLabel = document.getElementById('loyaltyDiscountLabel');
  const loyaltyHint = document.getElementById('loyaltyPointsHint');
  const loyaltyToggle = document.getElementById('useLoyaltyDiscount');

  loyaltyPanel.classList.remove('is-hidden');

  if (!loyalty) {
    loyaltyLabel.textContent = 'Loyalty discount (optional)';
    loyaltyHint.textContent = 'Sign in to redeem loyalty points on this order.';
    loyaltyToggle.checked = false;
    loyaltyToggle.disabled = true;
    return;
  }

  const availablePercent = Number(loyalty.available_discount_percent || 0);
  const costPoints = Number(loyalty.discount_cost_points || 0);
  const userPoints = Number(loyalty.points || 0);

  loyaltyLabel.textContent = availablePercent > 0
    ? `Use ${availablePercent}% loyalty discount (optional)`
    : `Loyalty discount (optional) · Tier: ${String(loyalty.tier || 'bronze').toUpperCase()}`;
  loyaltyHint.textContent = availablePercent > 0
    ? `Optional: ${costPoints} points will be redeemed if applied. You have ${userPoints} points.`
    : `You have ${userPoints} points. Reach ${costPoints} points to unlock your tier discount reward.`;

  loyaltyToggle.disabled = availablePercent <= 0;
  if (availablePercent <= 0) {
    loyaltyToggle.checked = false;
  }
}

function renderCart() {
  const items = cartState.items;
  const countLabel = document.getElementById('cartCountLabel');

  countLabel.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

  if (items.length === 0) {
    document.getElementById('cartItemsList').innerHTML = `
      <div class="cart-empty">
        <i class="bi bi-bag"></i>
        <p>Your cart is empty.<br>Discover our luxury fragrances and add your favourites.</p>
        <a href="products.html" class="btn-shop">Browse Products</a>
      </div>`;
    document.getElementById('summarySection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('placeOrderWrap').style.display = 'none';
    renderSummary([], cartState.loyalty);
    return;
  }

  document.getElementById('summarySection').style.display = '';
  document.getElementById('paymentSection').style.display = '';
  document.getElementById('placeOrderWrap').style.display = '';

  document.getElementById('cartItemsList').innerHTML = items.map((item) => {
    const productId = Number(item.product_id);
    const qty = Number(item.qty) || 0;
    return `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image_url
          ? `<img src="${escapeHtmlLocal(item.image_url)}" alt="${escapeHtmlLocal(item.name)}">`
          : '<i class="bi bi-droplet no-img"></i>'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-brand">${escapeHtmlLocal(item.brand)}</div>
        <div class="cart-item-name">${escapeHtmlLocal(item.name)}</div>
        <div class="cart-item-size">${escapeHtmlLocal(item.size || '')}</div>
        <div class="cart-item-price">${formatMoney(item.subtotal)}</div>
      </div>
      <div class="cart-item-actions">
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${productId}, -1)" title="Decrease"><i class="bi bi-dash"></i></button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="changeQty(${productId}, 1)" title="Increase"><i class="bi bi-plus"></i></button>
        </div>
        <button class="btn-remove" onclick="removeItem(${productId})">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
    </div>
  `;
  }).join('');

  renderSummary(items, cartState.loyalty);
}

async function loadCart() {
  const payload = await cartRequest({ action: 'get' });
  cartState.items = payload.items || [];
  cartState.loyalty = payload.loyalty || null;

  const totalCount = cartState.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  setCartBadge(totalCount);
  renderCart();
}

async function changeQty(id, delta) {
  const item = cartState.items.find((entry) => Number(entry.product_id) === Number(id));
  if (!item) return;

  const nextQty = Math.max(0, Number(item.qty) + Number(delta));
  const action = nextQty === 0 ? 'remove' : 'update';

  await cartRequest({
    action,
    product_id: Number(id),
    qty: nextQty,
  });

  await loadCart();
}

async function removeItem(id) {
  await cartRequest({
    action: 'remove',
    product_id: Number(id),
  });
  await loadCart();
  showToast('Item removed from cart');
}

function selectPayMethod(method) {
  document.querySelectorAll('.pay-tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.pay-form').forEach((form) => form.classList.remove('active'));
  document.getElementById('tab-' + method).classList.add('active');
  document.getElementById('form-' + method).classList.add('active');
  document.getElementById('placeOrderWrap').style.display = method === 'paypal' ? 'none' : '';
}

function fmtCard(input) {
  let value = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = value.replace(/(.{4})/g, '$1 ').trim();
}

function fmtExpiry(input) {
  let value = input.value.replace(/\D/g, '').slice(0, 4);
  if (value.length >= 3) {
    value = value.slice(0, 2) + ' / ' + value.slice(2);
  }
  input.value = value;
}

function setFieldValidationState(input, feedbackId, valid, message) {
  const feedback = document.getElementById(feedbackId);
  input.classList.remove('is-valid', 'is-invalid');

  if (valid === true) {
    input.classList.add('is-valid');
    input.setAttribute('aria-invalid', 'false');
  } else if (valid === false) {
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }

  if (feedback) {
    feedback.textContent = message || '';
    feedback.classList.toggle('is-valid', valid === true);
    feedback.classList.toggle('is-invalid', valid === false);
  }
}

function isValidCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 16) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function validateCardForm(showErrors = false) {
  const cardNumber = document.getElementById('cardNumber');
  const cardName = document.getElementById('cardName');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCvv = document.getElementById('cardCvv');
  const note = document.getElementById('cardValidationNote');

  const numberDigits = cardNumber.value.replace(/\D/g, '');
  const nameValue = cardName.value.trim();
  const expiryDigits = cardExpiry.value.replace(/\D/g, '');
  const cvvDigits = cardCvv.value.replace(/\D/g, '');

  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;

  const expiryMonth = Number(expiryDigits.slice(0, 2));
  const expiryYear = Number(expiryDigits.slice(2, 4));
  const expiryComplete = expiryDigits.length === 4;
  const expiryMonthValid = expiryMonth >= 1 && expiryMonth <= 12;
  const expiryFutureValid = expiryComplete
    && expiryMonthValid
    && (expiryYear > currentYear || (expiryYear === currentYear && expiryMonth >= currentMonth));

  const numberValid = isValidCardNumber(numberDigits);
  const nameValid = nameValue.length >= 4 && /\s/.test(nameValue);
  const expiryValid = expiryFutureValid;
  const cvvValid = /^\d{3,4}$/.test(cvvDigits);

  if (showErrors || cardNumber.value.trim() !== '') {
    setFieldValidationState(
      cardNumber,
      'cardNumberFeedback',
      numberValid,
      numberValid ? 'Visa number looks valid.' : 'Enter a valid 16-digit card number.'
    );
  }
  if (showErrors || cardName.value.trim() !== '') {
    setFieldValidationState(
      cardName,
      'cardNameFeedback',
      nameValid,
      nameValid ? 'Cardholder name looks good.' : 'Enter first and last name as shown on the card.'
    );
  }
  if (showErrors || cardExpiry.value.trim() !== '') {
    setFieldValidationState(
      cardExpiry,
      'cardExpiryFeedback',
      expiryValid,
      expiryValid ? 'Expiry date is valid.' : 'Use MM / YY and choose a future date.'
    );
  }
  if (showErrors || cardCvv.value.trim() !== '') {
    setFieldValidationState(
      cardCvv,
      'cardCvvFeedback',
      cvvValid,
      cvvValid ? 'Security code looks valid.' : 'Enter a 3 or 4 digit CVV.'
    );
  }

  const allValid = numberValid && nameValid && expiryValid && cvvValid;
  if (note) {
    note.textContent = allValid
      ? 'Validation is active and all Visa fields are ready.'
      : 'Demo Visa fields are editable. Update them to see live validation before placing the order.';
    note.classList.toggle('is-valid', allValid);
  }

  return allValid;
}

function bindCardValidation() {
  const fieldBindings = [
    ['cardNumber', fmtCard],
    ['cardName', null],
    ['cardExpiry', fmtExpiry],
    ['cardCvv', null],
  ];

  fieldBindings.forEach(([id, formatter]) => {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }

    input.addEventListener('input', () => {
      if (typeof formatter === 'function') {
        formatter(input);
      }
      validateCardForm(false);
    });
    input.addEventListener('blur', () => {
      validateCardForm(true);
    });
  });

  validateCardForm(false);
}

async function purchaseNow() {
  if (cartState.items.length === 0) {
    showToast('Your cart is empty');
    return;
  }

  const activeTab = document.querySelector('.pay-tab.active');
  const method = activeTab ? activeTab.dataset.method : 'card';

  setPlaceOrderDisabled(true);

  try {
    const payload = await cartRequest({
      action: 'checkout',
      payment_method: method,
      apply_loyalty: document.getElementById('useLoyaltyDiscount').checked,
    });

    handleCheckoutSuccess(payload);
  } catch (error) {
    showToast(error.message);
    setPlaceOrderDisabled(false);
  }
}

async function placeOrder() {
  if (cartState.items.length === 0) {
    return;
  }

  const activeTab = document.querySelector('.pay-tab.active');
  const method = activeTab ? activeTab.dataset.method : 'card';

  if (method === 'card') {
    if (!validateCardForm(true)) {
      showToast('Please correct the highlighted card details');
      return;
    }
  }

  setPlaceOrderDisabled(true);

  try {
    const payload = await cartRequest({
      action: 'checkout',
      payment_method: method,
      apply_loyalty: document.getElementById('useLoyaltyDiscount').checked,
    });

    handleCheckoutSuccess(payload);
  } catch (error) {
    showToast(error.message);
    setPlaceOrderDisabled(false);
  }
}

function showToast(message) {
  const toast = document.getElementById('cartToast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2700);
}

async function initCartPage() {
  resetCartViewState();
  setCartBadge(parseInt(localStorage.getItem(LOCAL_COUNT_KEY) || '0', 10));
  selectPayMethod('card');
  bindCardValidation();

  try {
    await Auth.ready();

    try {
      await syncLocalCartToServer();
      await loadCart();
    } catch (error) {
      if (isAuthError(error)) {
        renderLoginRequired();
        return;
      }

      renderCartLoadError(error.message || 'We could not load your cart right now. Please try again.');
    }
  } catch (error) {
    if (isAuthError(error)) {
      renderLoginRequired();
      return;
    }

    renderCartLoadError(error.message || 'We could not load your cart right now. Please try again.');
  }
}

document.getElementById('useLoyaltyDiscount').addEventListener('change', () => {
  renderSummary(cartState.items, cartState.loyalty);
});

function bootCartPage() {
  if (typeof Auth !== 'undefined') {
    void initCartPage();
    return;
  }

  document.addEventListener('ab:layout-ready', () => {
    if (typeof Auth !== 'undefined') {
      void initCartPage();
    } else {
      renderCartLoadError('Shared page modules did not finish loading. Please refresh and try again.');
    }
  }, { once: true });
}

bootCartPage();
