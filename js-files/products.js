let PRODUCTS = [];
let activeFilter = 'all';
let searchQuery = '';
let wishlist = JSON.parse(localStorage.getItem('abWishlist') || '[]');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function formatMoney(value) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlistBadge');
  if (badge) badge.textContent = String(wishlist.length);
}

function showToast(msg) {
  const toast = document.getElementById('cartToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function starsHTML(n) {
  const safe = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(safe) + '☆'.repeat(5 - safe);
}

function productMonogram(product) {
  return String(product?.brand || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

function productPlaceholderMarkup(product, compact = false) {
  const monogram = productMonogram(product);
  const brand = escapeHtml(String(product?.brand || 'AB Store'));
  const name = escapeHtml(String(product?.name || 'Fragrance'));
  const size = escapeHtml(String(product?.size || ''));

  return `
    <div class="product-img-placeholder${compact ? ' product-img-placeholder-compact' : ''}">
      <div class="product-placeholder-mark">${monogram}</div>
      <div class="product-placeholder-brand">${brand}</div>
      <div class="product-placeholder-name">${name}</div>
      ${size ? `<div class="product-placeholder-size">${size}</div>` : ''}
    </div>
  `;
}

function productImageMarkup(product) {
  if (!product.image_url) {
    return productPlaceholderMarkup(product);
  }
  const src = product.image_url.startsWith('http') || product.image_url.startsWith('/')
    ? product.image_url
    : `/${product.image_url}`;
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.brand)} ${escapeHtml(product.name)}" loading="lazy"/>`;
}

function renderGrid(products) {
  const grid = document.getElementById('productGrid');
  const none = document.getElementById('noResults');
  const count = document.getElementById('resultsCount');

  if (!grid || !none || !count) return;

  if (products.length === 0) {
    grid.innerHTML = '';
    none.style.display = 'block';
    count.textContent = 'Showing 0 products';
    return;
  }

  none.style.display = 'none';
  count.textContent = `Showing ${products.length} product${products.length !== 1 ? 's' : ''}`;

  grid.innerHTML = products.map((p) => `
    <div class="col-lg-3 col-md-4 col-sm-6 mb-2">
      <div class="product-card" data-id="${p.id}" data-category="${escapeHtml(p.category)}">
        ${p.badge ? `<span class="product-badge ${escapeHtml(p.badgeClass || '')}">${escapeHtml(p.badge)}</span>` : ''}
        <button class="wishlist-btn ${wishlist.includes(p.id) ? 'active' : ''}" onclick="toggleWishlist(${p.id}, this)" title="Wishlist">
          <i class="bi ${wishlist.includes(p.id) ? 'bi-heart-fill' : 'bi-heart'}"></i>
        </button>
        <div class="product-img-wrap">
          ${productImageMarkup(p)}
          <div class="product-quick">
            <button class="btn-quick" onclick="quickView(${p.id})">Quick View</button>
          </div>
        </div>
        <div class="product-body">
          <div class="product-brand">${escapeHtml(p.brand)}</div>
          <div class="product-name">${escapeHtml(p.name)}</div>
          <div class="product-type">${escapeHtml(`${p.size} · ${capitalize(p.category)}`)}</div>
          <div class="product-stars">${starsHTML(p.stars)}</div>
          <div class="product-footer">
            <div class="product-price">
              ${p.old_price ? `<span class="old-price">${formatMoney(p.old_price)}</span>` : ''}
              ${formatMoney(p.price)}
            </div>
            <button class="btn-add" id="addBtn${p.id}" onclick="addToCart(${p.id}, this)">Add to Cart</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function capitalize(value) {
  const stringValue = String(value || '');
  return stringValue.charAt(0).toUpperCase() + stringValue.slice(1);
}

function getFiltered() {
  let list;
  if (activeFilter === 'all') list = PRODUCTS;
  else if (activeFilter === 'sale') list = PRODUCTS.filter((p) => p.old_price !== null && Number(p.old_price) > Number(p.price));
  else if (activeFilter === 'wishlist') {
    const ids = new Set(wishlist.map(Number));
    list = PRODUCTS.filter((p) => ids.has(Number(p.id)));
  } else {
    list = PRODUCTS.filter((p) => p.category === activeFilter);
  }

  const query = searchQuery.trim().toLowerCase();
  if (!query) return list;
  return list.filter((p) => {
    const haystack = `${p.name || ''} ${p.brand || ''} ${p.category || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function getSorted(products) {
  const value = document.getElementById('sortSelect')?.value || 'default';
  const arr = [...products];
  if (value === 'price-asc') return arr.sort((a, b) => Number(a.price) - Number(b.price));
  if (value === 'price-desc') return arr.sort((a, b) => Number(b.price) - Number(a.price));
  if (value === 'name') return arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (value === 'rating') return arr.sort((a, b) => Number(b.stars) - Number(a.stars));
  return arr;
}

function applyFilterSort() {
  renderGrid(getSorted(getFiltered()));
}

function sortProducts() {
  applyFilterSort();
}

async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      csrf_token: Auth.getCsrfToken ? Auth.getCsrfToken() : '',
    }),
  });

  const json = await response.json();
  return { response, json };
}

// Reveal animation is owned by js-files/shared/reveal.js (AB.reveal.init),
// which runs after the page partial is mounted and before this file loads.
// Product cards rendered later do not use the .reveal class, so no extra
// observer is required here.

async function syncWishlist() {
  if (!window.Auth || !Auth.isLoggedIn()) return;
  try {
    const { response, json } = await apiPost('/api/wishlist.php', { action: 'get' });
    if (response.ok && json.success) {
      wishlist = (json.items || []).map((item) => Number(item.product_id));
      localStorage.setItem('abWishlist', JSON.stringify(wishlist));
      updateWishlistBadge();
    }
  } catch (error) {
  }
}

async function addToCart(id, btn) {
  await Auth.ready();
  btn.disabled = true;
  try {
    const { response, json } = await apiPost('/api/cart.php', {
      action: 'add',
      product_id: id,
      qty: 1,
    });

    if (!response.ok || !json.success) {
      if (response.status === 401) {
        showToast('Please sign in to add items to your cart');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
      }
      showToast(json.error || 'Could not add to cart.');
      btn.disabled = false;
      return;
    }

    updateCartBadge(Number(json.cart_count || 0));
    btn.textContent = '✓ Added';
    btn.classList.add('added');
    setTimeout(() => {
      btn.textContent = 'Add to Cart';
      btn.classList.remove('added');
      btn.disabled = false;
    }, 1800);
    showToast('Added to cart');
  } catch (error) {
    showToast('Network error. Please try again.');
    btn.disabled = false;
  }
}

async function toggleWishlist(id, btn) {
  await Auth.ready();
  const icon = btn.querySelector('i');
  const inList = wishlist.includes(id);

  if (inList) {
    wishlist = wishlist.filter((value) => value !== id);
    btn.classList.remove('active');
    icon.className = 'bi bi-heart';
    showToast('Removed from wishlist');
  } else {
    wishlist.push(id);
    btn.classList.add('active');
    icon.className = 'bi bi-heart-fill';
    showToast('Added to wishlist');
  }
  localStorage.setItem('abWishlist', JSON.stringify(wishlist));
  updateWishlistBadge();
  if (activeFilter === 'wishlist') applyFilterSort();

  if (window.Auth && Auth.isLoggedIn()) {
    try {
      await apiPost('/api/wishlist.php', {
        action: 'toggle',
        product_id: id,
      });
    } catch (error) {
    }
  }
}

function quickView(id) {
  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('quickViewBody');
  const product = PRODUCTS.find((item) => item.id === id);
  if (!modal || !body || !product) return;

  const inWish = wishlist.includes(product.id);
  body.innerHTML = `
      <div class="qv-img-wrap">
      ${product.image_url
        ? `<img src="${escapeHtml(product.image_url.startsWith('http') || product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`)}" alt="${escapeHtml(product.brand)} ${escapeHtml(product.name)}"/>`
        : productPlaceholderMarkup(product, true)}
      ${product.badge ? `<span class="product-badge ${escapeHtml(product.badgeClass || '')}">${escapeHtml(product.badge)}</span>` : ''}
    </div>
    <div class="qv-info">
      <div class="qv-brand">${escapeHtml(product.brand)}</div>
      <h2 class="qv-name">${escapeHtml(product.name)}</h2>
      <div class="qv-meta">${escapeHtml(`${product.size} · ${capitalize(product.category)}`)}</div>
      <div class="qv-stars">${starsHTML(product.stars)}</div>
      <div class="qv-price">
        ${product.old_price ? `<span class="qv-old-price">${formatMoney(product.old_price)}</span>` : ''}
        <span class="qv-cur-price">${formatMoney(product.price)}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:1.2rem;flex-wrap:wrap">
        <button class="btn-add qv-add" id="qvAddBtn" onclick="qvAddToCart(${product.id}, this)">Add to Cart</button>
        <button class="wishlist-btn ${inWish ? 'active' : ''}" onclick="toggleWishlist(${product.id}, this)" title="Wishlist" style="position:static;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center">
          <i class="bi ${inWish ? 'bi-heart-fill' : 'bi-heart'}"></i>
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function qvAddToCart(id, btn) {
  addToCart(id, btn);
}

function closeQuickView() {
  const modal = document.getElementById('quickViewModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function showSkeleton() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(`
    <div class="col-lg-3 col-md-4 col-sm-6 mb-2">
      <div class="product-card" style="min-height:320px;background:rgba(255,255,255,0.04);animation:pulse 1.4s infinite;"></div>
    </div>
  `).join('');
}

async function fetchProductsPage(page) {
  const { response, json } = await apiPost('/api/products.php', {
    action: 'filter',
    category: 'all',
    sort: 'newest',
    page,
  });

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to load products.');
  }

  return json;
}

async function loadProducts() {
  showSkeleton();
  try {
    let page = 1;
    let totalPages = 1;
    const allProducts = [];

    while (page <= totalPages) {
      const payload = await fetchProductsPage(page);
      totalPages = Number(payload.total_pages || 1);
      allProducts.push(...(payload.products || []));
      page += 1;
    }

    PRODUCTS = allProducts.map((product) => ({
      ...product,
      id: Number(product.id),
      price: Number(product.price),
      old_price: product.old_price === null ? null : Number(product.old_price),
      stars: Number(product.stars || 0),
      badgeClass: product.badge_class || (
        product.badge === 'Sale' ? 'badge-sale' :
        product.badge === 'New' ? 'badge-new' :
        product.badge === 'Limited' ? 'badge-limited' : ''
      ),
    }));

    const url = new URL(window.location.href);
    const requested = url.searchParams.get('filter') || url.searchParams.get('category');
    if (requested) {
      const filterButton = document.querySelector(`.filter-btn[data-filter="${requested}"]`);
      if (filterButton) {
        document.querySelectorAll('.filter-btn').forEach((button) => button.classList.remove('active'));
        filterButton.classList.add('active');
        activeFilter = requested;
      }
    }

    applyFilterSort();

    const qvId = Number(url.searchParams.get('quickview') || 0);
    if (qvId && PRODUCTS.some((p) => p.id === qvId)) {
      setTimeout(() => quickView(qvId), 80);
    }
  } catch (error) {
    const grid = document.getElementById('productGrid');
    if (grid) {
      grid.innerHTML = '<div class="col-12 text-center py-5" style="color:#c8a96e">Failed to load products. Please refresh.</div>';
    }
  }
}

async function initProductsPage() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((button) => button.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilterSort();
    });
  });

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', sortProducts);
  }

  const searchInput = document.getElementById('productSearch');
  const searchClear = document.getElementById('searchClear');
  if (searchInput) {
    const urlQuery = new URL(window.location.href).searchParams.get('q') || '';
    if (urlQuery) {
      searchInput.value = urlQuery;
      searchQuery = urlQuery;
      if (searchClear) searchClear.hidden = false;
    }
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      if (searchClear) searchClear.hidden = !searchQuery;
      applyFilterSort();
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (!searchInput) return;
      searchInput.value = '';
      searchQuery = '';
      searchClear.hidden = true;
      searchInput.focus();
      applyFilterSort();
    });
  }

  updateWishlistBadge();
  await Auth.ready();
  await syncWishlist();
  await loadProducts();
}

window.sortProducts = sortProducts;
window.addToCart = addToCart;
window.toggleWishlist = toggleWishlist;
window.quickView = quickView;
window.qvAddToCart = qvAddToCart;
window.closeQuickView = closeQuickView;

void initProductsPage();
