let featuredProducts = [];
let selectedRating = 0;

function formatMoney(value) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function starsHTML(n) {
  const safe = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(safe) + '☆'.repeat(5 - safe);
}

function escapeHtmlLocal(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function productImageMarkup(product) {
  if (!product.image_url) {
    return '<div class="product-img-placeholder"><i class="bi bi-droplet-fill"></i></div>';
  }

  const source = product.image_url.startsWith('http') || product.image_url.startsWith('/')
    ? product.image_url
    : `/${product.image_url}`;

  return `<img src="${escapeHtmlLocal(source)}" alt="${escapeHtmlLocal(product.brand)} ${escapeHtmlLocal(product.name)}" loading="lazy" />`;
}

function showToast(message) {
  const toast = document.getElementById('cartToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timerId);
  showToast.timerId = setTimeout(() => toast.classList.remove('show'), 2800);
}

function updateCartBadge(count) {
  const safeCount = Number(count) || 0;
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = String(safeCount);
  }
  localStorage.setItem('abCartCount', String(safeCount));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
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

function renderFeatured() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  if (featuredProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="comment-empty">No featured products available yet.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = featuredProducts.map((product) => `
    <div class="col-lg-3 col-md-6">
      <div class="product-card h-100">
        ${product.badge ? `<span class="product-badge ${escapeHtmlLocal(product.badge_class || '')}">${escapeHtmlLocal(product.badge)}</span>` : ''}
        <div class="product-img-wrap">
          ${productImageMarkup(product)}
          <div class="product-quick">
            <button onclick="quickView(${Number(product.id)})">Quick View</button>
          </div>
        </div>
        <div class="product-body">
          <div class="product-brand">${escapeHtmlLocal(product.brand)}</div>
          <div class="product-name">${escapeHtmlLocal(product.name)}</div>
          <div class="product-stars">${starsHTML(product.stars)}</div>
          <div class="product-size">${escapeHtmlLocal(product.size)}</div>
          <div class="product-footer">
            <div class="product-price">${formatMoney(product.price)}</div>
            <button class="btn-add" id="addBtn${Number(product.id)}" onclick="addToCart(${Number(product.id)}, this)">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function populateReviewProducts() {
  const select = document.getElementById('cmtPerfume');
  if (!select) return;

  const options = ['<option value="">— Select a perfume —</option>'];
  featuredProducts.forEach((product) => {
    options.push(
      `<option value="${Number(product.id)}">${escapeHtmlLocal(product.brand)} ${escapeHtmlLocal(product.name)}</option>`
    );
  });
  select.innerHTML = options.join('');
}

function renderComments(reviews) {
  const list = document.getElementById('commentList');
  if (!list) return;

  if (!reviews.length) {
    list.innerHTML = '<div class="comment-empty">No reviews yet — be the first!</div>';
    return;
  }

  list.innerHTML = reviews.map((review) => `
    <div class="comment-card">
      <div class="cc-header">
        <div class="cc-avatar">${escapeHtmlLocal(review.author_name).charAt(0).toUpperCase()}</div>
        <div>
          <div class="cc-name">${escapeHtmlLocal(review.author_name)}</div>
          <div class="cc-date">${escapeHtmlLocal(review.created_at)}</div>
        </div>
      </div>
      <span class="cc-perfume">${escapeHtmlLocal(review.product_name)}</span>
      <div class="cc-stars">${starsHTML(review.rating)}</div>
      <p class="cc-text">${escapeHtmlLocal(review.body)}</p>
    </div>
  `).join('');
}

async function loadFeaturedProducts() {
  const { response, json } = await postJson('/api/products.php', {
    action: 'filter',
    category: 'all',
    sort: 'stars',
    page: 1,
  });

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to load featured products.');
  }

  featuredProducts = (json.products || []).slice(0, 4).map((product) => ({
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    stars: Number(product.stars || 0),
    old_price: product.old_price === null ? null : Number(product.old_price),
  }));

  renderFeatured();
  populateReviewProducts();
}

async function loadReviews() {
  const response = await fetch('/api/reviews.php?limit=6', {
    credentials: 'include',
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to load reviews.');
  }

  renderComments(payload.reviews || []);
}

async function addToCart(id, button) {
  await Auth.ready();
  button.disabled = true;
  try {
    const { response, json } = await postJson('/api/cart.php', {
      action: 'add',
      product_id: id,
      qty: 1,
    });

    if (!response.ok || !json.success) {
      if (response.status === 401) {
        showToast('Please sign in to add items to your cart');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
        return;
      }
      throw new Error(json.error || 'Could not add to cart.');
    }

    updateCartBadge(Number(json.cart_count || 0));
    button.textContent = '✓ Added';
    button.classList.add('added');
    setTimeout(() => {
      button.textContent = 'Add to Cart';
      button.classList.remove('added');
      button.disabled = false;
    }, 1800);
    showToast('Added to cart');
  } catch (error) {
    showToast(error.message || 'Could not add to cart.');
    button.disabled = false;
  }
}

function quickView(id) {
  const product = featuredProducts.find((item) => Number(item.id) === Number(id));
  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('quickViewBody');
  if (!modal || !body || !product) return;

  body.innerHTML = `
    <div class="qv-img-wrap">
      ${product.image_url
        ? `<img src="${escapeHtmlLocal(product.image_url.startsWith('http') || product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`)}" alt="${escapeHtmlLocal(product.brand)} ${escapeHtmlLocal(product.name)}" />`
        : `<div class="qv-img-ph"><i class="bi bi-image"></i></div>`}
      ${product.badge ? `<span class="product-badge ${escapeHtmlLocal(product.badge_class || '')}">${escapeHtmlLocal(product.badge)}</span>` : ''}
    </div>
    <div class="qv-info">
      <div class="qv-brand">${escapeHtmlLocal(product.brand)}</div>
      <h2 class="qv-name">${escapeHtmlLocal(product.name)}</h2>
      <div class="qv-meta">${escapeHtmlLocal(`${product.size} · ${product.category.charAt(0).toUpperCase()}${product.category.slice(1)}`)}</div>
      <div class="qv-stars">${starsHTML(product.stars)}</div>
      <div class="qv-price">
        ${product.old_price ? `<span class="qv-old-price">${formatMoney(product.old_price)}</span>` : ''}
        <span class="qv-cur-price">${formatMoney(product.price)}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:1.2rem;flex-wrap:wrap">
        <button class="btn-add qv-add" id="qvAddBtn" onclick="qvAddToCart(${product.id}, this)">Add to Cart</button>
      </div>
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function qvAddToCart(id, button) {
  addToCart(id, button);
}

function closeQuickView() {
  const modal = document.getElementById('quickViewModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

async function submitComment() {
  await Auth.ready();
  if (!Auth.isLoggedIn()) {
    alert('Please sign in to post a review.');
    window.location.href = 'login.html';
    return;
  }

  const productId = Number(document.getElementById('cmtPerfume').value || 0);
  const text = document.getElementById('cmtText').value.trim();

  if (!productId) {
    alert('Please select a perfume.');
    return;
  }
  if (!selectedRating) {
    alert('Please choose a star rating.');
    return;
  }
  if (!text) {
    alert('Please write a short review.');
    return;
  }

  try {
    const { response, json } = await postJson('/api/reviews.php', {
      product_id: productId,
      rating: selectedRating,
      body: text,
    });

    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to post review.');
    }

    await loadReviews();

    const nameInput = document.getElementById('cmtName');
    if (nameInput) nameInput.value = '';
    document.getElementById('cmtPerfume').value = '';
    document.getElementById('cmtText').value = '';
    selectedRating = 0;
    document.querySelectorAll('#starPicker span').forEach((star) => star.classList.remove('active'));

    showToast('Thank you! Your review has been posted.');
  } catch (error) {
    alert(error.message || 'Failed to post review.');
  }
}

// Reveal animation is owned by js-files/shared/reveal.js (AB.reveal.init).
// home.js does not need its own observer — the page partial is mounted and
// observed before this script loads.

(function initHeroVideo() {
  const video = document.getElementById('heroVideo');
  const sprayLogo = document.getElementById('sprayLogo');
  const triggerAt = 2.2;
  if (!video || !sprayLogo) return;

  if (window.matchMedia('(max-width: 600px)').matches) {
    video.removeAttribute('src');
    video.load();
    return;
  }

  video.addEventListener('canplay', () => video.classList.add('loaded'), { once: true });

  let triggered = false;
  let lastTime = 0;

  video.addEventListener('timeupdate', () => {
    const time = video.currentTime;

    if (time < lastTime - 1) {
      triggered = false;
      sprayLogo.classList.remove('spray-active', 'spray-resting');
    }
    lastTime = time;

    if (!triggered && time >= triggerAt) {
      triggered = true;
      sprayLogo.classList.remove('spray-resting');
      sprayLogo.classList.add('spray-active');

      setTimeout(() => {
        sprayLogo.classList.add('spray-resting');
      }, 6100);
    }
  });
})();

document.querySelectorAll('#starPicker span').forEach((star) => {
  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.val, 10);
    document.querySelectorAll('#starPicker span').forEach((entry, index) => {
      entry.classList.toggle('active', index < selectedRating);
    });
  });
});

async function syncCartBadge() {
  if (!Auth.isLoggedIn()) {
    updateCartBadge(parseInt(localStorage.getItem('abCartCount') || '0', 10));
    return;
  }

  try {
    const { response, json } = await postJson('/api/cart.php', { action: 'get' });
    if (response.ok && json.success) {
      updateCartBadge(Number(json.cart_count || 0));
    }
  } catch (error) {
  }
}

async function initHomePage() {
  try {
    await Auth.ready();
    await Promise.all([
      loadFeaturedProducts(),
      loadReviews(),
      syncCartBadge(),
    ]);
  } catch (error) {
    showToast(error.message || 'Failed to load live home page data.');
  }

}

window.addToCart = addToCart;
window.quickView = quickView;
window.qvAddToCart = qvAddToCart;
window.closeQuickView = closeQuickView;
window.submitComment = submitComment;

void initHomePage();
