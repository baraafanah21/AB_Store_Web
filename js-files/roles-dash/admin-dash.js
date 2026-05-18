(function initAdminDashboardPage() {
  const {
    escapeHtml,
    formatMoney,
    resolveImageUrl,
    requestJson,
    showToast,
    setupDashboardNavigation,
    wireModal,
    previewImage,
    resetImagePreview,
  } = window.RoleDashShared;

  const ALLOWED_BADGE_CLASSES = ['badge-new', 'badge-sale', 'badge-niche'];
  const state = {
    session: null,
    csrfToken: '',
    users: [],
    products: [],
    messages: [],
    messagesConfigured: false,
    reviews: [],
    reviewsConfigured: false,
    editUserId: null,
    editProductId: null,
  };

  function normalizeBadgeClass(value) {
    const cls = String(value || '').trim();
    return ALLOWED_BADGE_CLASSES.includes(cls) ? cls : '';
  }

  function loyaltyTierFor(points) {
    const value = Number(points) || 0;
    if (value >= 3000) return { key: 'platinum', label: 'Platinum', discount_percent: 20 };
    if (value >= 1000) return { key: 'gold', label: 'Gold', discount_percent: 10 };
    return { key: 'bronze', label: 'Bronze', discount_percent: 5 };
  }

  function loyaltyTierBadge(points) {
    const tier = loyaltyTierFor(points);
    return `<span class="role-badge-sm role-${escapeHtml(tier.key)}" style="text-transform:capitalize">${escapeHtml(tier.label)}</span>`;
  }

  function formatRoleBadge(role) {
    return `<span class="role-badge-sm role-${escapeHtml(role)}">${escapeHtml(role)}</span>`;
  }

  function applyBadgePreview(previewId, emptyId, rawText, rawClass) {
    const previewEl = document.getElementById(previewId);
    const emptyEl = document.getElementById(emptyId);
    if (!previewEl || !emptyEl) return;

    const text = String(rawText || '').trim();
    const cls = normalizeBadgeClass(rawClass);

    if (text === '') {
      previewEl.hidden = true;
      previewEl.textContent = '';
      previewEl.className = 'product-badge';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    previewEl.hidden = false;
    previewEl.textContent = text;
    previewEl.className = `product-badge${cls ? ` ${cls}` : ''}`;
  }

  function updateAddBadgePreview() {
    applyBadgePreview('aBadgePreview', 'aBadgeEmpty', document.getElementById('aBadge').value, document.getElementById('aBadgeClass').value);
  }

  function updateEditBadgePreview() {
    applyBadgePreview('eBadgePreview', 'eBadgeEmpty', document.getElementById('eBadge').value, document.getElementById('eBadgeClass').value);
  }

  function clearAddBadge() {
    document.getElementById('aBadge').value = '';
    document.getElementById('aBadgeClass').value = '';
    updateAddBadgePreview();
  }

  function clearEditBadge() {
    document.getElementById('eBadge').value = '';
    document.getElementById('eBadgeClass').value = '';
    updateEditBadgePreview();
  }

  async function fetchOverview() {
    return requestJson('/api/admin_overview.php');
  }

  async function fetchUsers() {
    const payload = await requestJson('/api/admin_users.php');
    state.users = payload.users || [];
  }

  async function fetchProducts() {
    const payload = await requestJson('/api/admin_products.php');
    state.products = payload.products || [];
  }

  async function fetchMessages() {
    const payload = await requestJson('/api/admin_messages.php');
    state.messages = payload.messages || [];
    state.messagesConfigured = Boolean(payload.configured);
  }

  async function fetchReviews() {
    const payload = await requestJson('/api/admin_reviews.php');
    state.reviews = payload.reviews || [];
    state.reviewsConfigured = Boolean(payload.configured);
  }

  async function renderOverview() {
    try {
      const payload = await fetchOverview();
      const stats = payload.stats || {};
      const roleCounts = payload.role_counts || {};
      const recentUsers = payload.recent_users || [];
      const categoryTotals = payload.category_totals || {};

      document.getElementById('statUsers').textContent = String(stats.users ?? 0);
      document.getElementById('statProducts').textContent = String(stats.products ?? 0);
      document.getElementById('statMessages').textContent = String(stats.messages ?? 0);
      document.getElementById('statCart').textContent = String(stats.cart ?? 0);

      const categoryLabels = {
        her: 'For Her',
        him: 'For Him',
        unisex: 'Unisex',
        niche: 'Niche',
      };
      const maxValue = Math.max(1, ...Object.values(categoryTotals).map((value) => Number(value || 0)));
      document.getElementById('barChart').innerHTML = Object.entries(categoryTotals).map(([category, value]) => `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(categoryLabels[category] || category)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((Number(value || 0) / maxValue) * 100)}%"></div></div>
          <div class="bar-val">${formatMoney(value)}</div>
        </div>
      `).join('');

      const roleColors = { user: '#90b4e8', employee: '#c8a96e', admin: '#e8a0a0' };
      document.getElementById('donutChart').innerHTML = Object.entries(roleCounts).map(([role, count]) => `
        <div class="donut-row">
          <div class="donut-dot" style="background:${roleColors[role] || '#c8a96e'}"></div>
          <div class="donut-lbl">${escapeHtml(role.charAt(0).toUpperCase() + role.slice(1))}</div>
          <div class="donut-pct">${Number(count || 0)}</div>
        </div>
      `).join('');

      document.getElementById('recentUsers').innerHTML = recentUsers.map((user) => `
        <tr>
          <td><strong>${escapeHtml(user.name)}</strong></td>
          <td>${escapeHtml(user.email)}</td>
          <td>${formatRoleBadge(user.role)}</td>
          <td>${escapeHtml(user.joined_at || '—')}</td>
        </tr>
      `).join('');
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderUsers() {
    const tbody = document.getElementById('userTableBody');
    document.getElementById('userCount').textContent = String(state.users.length);

    tbody.innerHTML = state.users.map((user) => {
      const points = Number(user.loyalty_points || 0);
      const isCurrentUser = Number(user.id) === Number(state.session?.id);
      return `
        <tr>
          <td><strong>${escapeHtml(user.name)}</strong></td>
          <td>${escapeHtml(user.email)}</td>
          <td>${formatRoleBadge(user.role)}</td>
          <td>${loyaltyTierBadge(points)}</td>
          <td><strong>${points.toLocaleString()}</strong></td>
          <td>${escapeHtml(user.joined_at || '—')}</td>
          <td>
            <button class="btn-outline" style="padding:.4rem .7rem;margin-right:.4rem" data-user-action="edit" data-user-id="${Number(user.id)}"><i class="bi bi-pencil"></i> Edit</button>
            ${isCurrentUser
              ? '<span style="font-size:.68rem;color:var(--ivory-dim)">You</span>'
              : `<button class="btn-danger" data-user-action="delete" data-user-id="${Number(user.id)}"><i class="bi bi-trash"></i> Remove</button>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  function productImageCell(product) {
    const src = resolveImageUrl(product.image_url);
    if (!src) {
      return '<div class="prod-thumb-placeholder"><i class="bi bi-image"></i></div>';
    }
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.brand)}" class="prod-thumb"/>`;
  }

  function badgeCellHtml(product) {
    const text = String(product.badge || '').trim();
    if (text === '') return '<span style="color:var(--muted)">—</span>';
    const cls = normalizeBadgeClass(product.badge_class);
    return `<span class="product-badge ${cls}">${escapeHtml(text)}</span>`;
  }

  function renderProducts() {
    document.getElementById('adminProdCount').textContent = String(state.products.length);
    document.getElementById('adminProdBody').innerHTML = state.products.map((product) => `
      <tr>
        <td>${productImageCell(product)}</td>
        <td><strong>${escapeHtml(product.brand)}</strong></td>
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.category)}</td>
        <td>${escapeHtml(product.size)}</td>
        <td>${formatMoney(product.price)}</td>
        <td>${product.old_price != null ? formatMoney(product.old_price) : '—'}</td>
        <td>${Number(product.stars || 0)}</td>
        <td>${badgeCellHtml(product)}</td>
        <td style="white-space:nowrap">
          <button class="btn-outline" style="padding:.4rem .7rem;margin-right:.4rem" data-product-action="edit" data-product-id="${Number(product.id)}"><i class="bi bi-pencil"></i></button>
          <button class="btn-danger" data-product-action="delete" data-product-id="${Number(product.id)}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  function renderMessages() {
    const list = document.getElementById('adminMsgList');
    if (!state.messagesConfigured) {
      list.innerHTML = '<div class="card-box"><p style="color:var(--ivory-dim);margin:0">Messages storage is not configured in the database yet.</p></div>';
      return;
    }

    if (state.messages.length === 0) {
      list.innerHTML = '<div class="card-box"><p style="color:var(--ivory-dim);margin:0">No messages found.</p></div>';
      return;
    }

    list.innerHTML = state.messages.map((message) => `
      <div class="msg-card">
        <div class="msg-meta">
          <div>
            <div class="msg-sender">${escapeHtml(message.name)} &lt;${escapeHtml(message.email)}&gt;</div>
            <div class="msg-subject">${escapeHtml(message.subject || 'General enquiry')}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem">
            <span class="msg-date">${escapeHtml(message.sent_at || '—')}</span>
            <span class="msg-status ${escapeHtml(message.status || 'new')}">${escapeHtml(message.status || 'new')}</span>
          </div>
        </div>
        <p class="msg-body">${escapeHtml(message.message || '')}</p>
        ${message.reply ? `<div style="margin-top:.6rem;padding:.6rem .8rem;border-left:2px solid var(--gold);font-size:.76rem;color:var(--ivory-dim);"><strong style="color:var(--gold);font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;">Reply</strong><br>${escapeHtml(message.reply)}</div>` : ''}
        <div class="msg-reply" id="messageReply-${Number(message.id)}">
          <textarea rows="3" placeholder="Type your reply…" id="messageReplyText-${Number(message.id)}" style="width:100%;margin-top:.8rem;background:rgba(255,255,255,.04);border:1px solid rgba(200,169,110,.2);color:var(--ivory);font-family:'Jost',sans-serif;font-size:.82rem;padding:.65rem .9rem;outline:none;resize:none;"></textarea>
          <button class="btn-gold" style="margin-top:.5rem;" data-message-action="reply" data-message-id="${Number(message.id)}">Send Reply</button>
        </div>
        <div style="margin-top:.7rem;display:flex;gap:.6rem">
          <button class="btn-outline" data-message-action="toggle-reply" data-message-id="${Number(message.id)}"><i class="bi bi-reply"></i> Reply</button>
          <button class="btn-danger" data-message-action="delete" data-message-id="${Number(message.id)}"><i class="bi bi-trash"></i> Delete</button>
        </div>
      </div>
    `).join('');
  }

  function reviewStars(n) {
    const safe = Math.max(0, Math.min(5, Number(n) || 0));
    return '★'.repeat(safe) + '☆'.repeat(5 - safe);
  }

  function renderReviews() {
    const list = document.getElementById('adminReviewList');
    if (!state.reviewsConfigured) {
      list.innerHTML = '<div class="card-box"><p style="color:var(--ivory-dim);margin:0">Reviews storage is not configured in the database yet.</p></div>';
      return;
    }

    if (state.reviews.length === 0) {
      list.innerHTML = '<div class="card-box"><p style="color:var(--ivory-dim);margin:0">No reviews yet.</p></div>';
      return;
    }

    list.innerHTML = state.reviews.map((review) => `
      <div class="msg-card">
        <div class="msg-meta">
          <div>
            <div class="msg-sender">${escapeHtml(review.author_name)}</div>
            <div class="msg-subject">${escapeHtml(review.product_name)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem">
            <span class="msg-date">${escapeHtml(review.created_at || '—')}</span>
            <span style="color:var(--gold);letter-spacing:2px;font-size:.85rem">${reviewStars(review.rating)}</span>
          </div>
        </div>
        <p class="msg-body">${escapeHtml(review.body)}</p>
        <div style="margin-top:.7rem;display:flex;gap:.6rem">
          <button class="btn-danger" data-review-action="delete" data-review-id="${Number(review.id)}"><i class="bi bi-trash"></i> Delete</button>
        </div>
      </div>
    `).join('');
  }

  function refreshPointsTierHint() {
    const value = Number(document.getElementById('uLoyaltyPoints').value || 0);
    const tier = loyaltyTierFor(value);
    document.getElementById('uPointsTier').textContent = `· ${tier.label} (${tier.discount_percent}% off)`;
  }

  function applyPointsDelta() {
    const deltaInput = document.getElementById('uPointsDelta');
    const balanceInput = document.getElementById('uLoyaltyPoints');
    const delta = Number(deltaInput.value);

    if (deltaInput.value === '' || Number.isNaN(delta) || delta === 0) {
      showToast('Enter a non-zero number.');
      return;
    }

    const next = Math.max(0, Math.trunc(Number(balanceInput.value || 0) + delta));
    balanceInput.value = String(next);
    deltaInput.value = '';
    refreshPointsTierHint();
  }

  function openUserModal(id) {
    const user = state.users.find((entry) => Number(entry.id) === Number(id));
    if (!user) return;

    state.editUserId = Number(id);
    document.getElementById('uName').value = user.name || '';
    document.getElementById('uEmail').value = user.email || '';
    document.getElementById('uRole').value = user.role || 'user';
    document.getElementById('uPassword').value = '';
    document.getElementById('uLoyaltyPoints').value = String(Number(user.loyalty_points || 0));
    document.getElementById('uPointsDelta').value = '';
    document.getElementById('editUserHint').textContent = user.member_id
      ? `Member ID: ${user.member_id} • Joined ${user.joined_at || '—'}`
      : `Joined ${user.joined_at || '—'}`;
    refreshPointsTierHint();
    document.getElementById('userEditModal').classList.add('open');
  }

  function closeUserModal() {
    state.editUserId = null;
    document.getElementById('userEditModal').classList.remove('open');
  }

  function openProductModal(id) {
    const product = state.products.find((entry) => Number(entry.id) === Number(id));
    if (!product) return;

    state.editProductId = Number(id);
    document.getElementById('eBrand').value = product.brand || '';
    document.getElementById('eName').value = product.name || '';
    document.getElementById('ePrice').value = product.price || '';
    document.getElementById('eOldPrice').value = product.old_price != null ? product.old_price : '';
    document.getElementById('eCategory').value = product.category || 'her';
    document.getElementById('eSize').value = product.size || '';
    document.getElementById('eStars').value = product.stars != null ? product.stars : 0;
    document.getElementById('eBadge').value = product.badge || '';
    document.getElementById('eBadgeClass').value = normalizeBadgeClass(product.badge_class);
    document.getElementById('eImage').value = '';
    document.getElementById('eImageLabel').textContent = 'Click to change image';

    const preview = document.getElementById('eImagePreviewImg');
    const src = resolveImageUrl(product.image_url);
    preview.src = src;
    preview.style.display = src ? 'block' : 'none';

    updateEditBadgePreview();
    document.getElementById('editModal').classList.add('open');
  }

  function closeProductModal() {
    state.editProductId = null;
    document.getElementById('editModal').classList.remove('open');
  }

  function buildProductFormData(action) {
    const data = new FormData();
    data.append('action', action);
    data.append('csrf_token', state.csrfToken);
    return data;
  }

  async function addUser() {
    try {
      await requestJson('/api/admin_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: document.getElementById('newUserName').value.trim(),
          email: document.getElementById('newUserEmail').value.trim(),
          password: document.getElementById('newUserPwd').value,
          role: document.getElementById('newUserRole').value,
          csrf_token: state.csrfToken,
        }),
      });

      document.getElementById('newUserName').value = '';
      document.getElementById('newUserEmail').value = '';
      document.getElementById('newUserPwd').value = '';
      await fetchUsers();
      renderUsers();
      await renderOverview();
      showToast('User added.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function saveUserEdit() {
    if (state.editUserId === null) return;

    const payload = {
      action: 'update',
      id: state.editUserId,
      name: document.getElementById('uName').value.trim(),
      email: document.getElementById('uEmail').value.trim(),
      role: document.getElementById('uRole').value,
      password: document.getElementById('uPassword').value,
      loyalty_points: Math.max(0, Math.trunc(Number(document.getElementById('uLoyaltyPoints').value || 0))),
      csrf_token: state.csrfToken,
    };

    try {
      const response = await requestJson('/api/admin_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (Number(state.editUserId) === Number(state.session?.id)) {
        state.session = {
          ...state.session,
          ...(response.user || {}),
          name: payload.name,
          email: payload.email,
          role: payload.role,
        };
        document.getElementById('sidebarName').textContent = state.session.name || 'Admin';
        document.getElementById('sidebarEmail').textContent = state.session.email || '';
      }

      closeUserModal();
      await fetchUsers();
      renderUsers();
      await renderOverview();
      showToast('User updated.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function deleteUser(id) {
    const target = state.users.find((entry) => Number(entry.id) === Number(id));
    const label = target ? `${target.name} <${target.email}>` : `user #${id}`;
    if (!window.confirm(`Remove ${label}? This will also delete their orders, cart, wishlist, and loyalty history.`)) {
      return;
    }

    try {
      await requestJson('/api/admin_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: Number(id),
          csrf_token: state.csrfToken,
        }),
      });

      await fetchUsers();
      renderUsers();
      await renderOverview();
      showToast('User removed.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function addProduct() {
    const badgeText = document.getElementById('aBadge').value.trim();
    const badgeClass = normalizeBadgeClass(document.getElementById('aBadgeClass').value);
    const formData = buildProductFormData('create');
    formData.append('brand', document.getElementById('aBrand').value.trim());
    formData.append('name', document.getElementById('aName').value.trim());
    formData.append('price', document.getElementById('aPrice').value);
    formData.append('old_price', document.getElementById('aOldPrice').value);
    formData.append('category', document.getElementById('aCategory').value);
    formData.append('size', document.getElementById('aSize').value.trim());
    formData.append('stars', document.getElementById('aStars').value || '0');
    formData.append('badge', badgeText);
    formData.append('badge_class', badgeText === '' ? '' : badgeClass);

    const imageInput = document.getElementById('aImage');
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    try {
      await requestJson('/api/admin_products.php', {
        method: 'POST',
        body: formData,
      });

      ['aBrand', 'aName', 'aPrice', 'aOldPrice', 'aSize', 'aStars'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      resetImagePreview('aImage', 'aImagePreviewImg', 'aImagePreview', 'aImageLabel', 'Click to upload image');
      clearAddBadge();
      await fetchProducts();
      renderProducts();
      await renderOverview();
      showToast('Product added.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function saveProductEdit() {
    if (state.editProductId === null) return;

    const badgeText = document.getElementById('eBadge').value.trim();
    const badgeClass = normalizeBadgeClass(document.getElementById('eBadgeClass').value);
    const formData = buildProductFormData('update');
    formData.append('id', String(state.editProductId));
    formData.append('brand', document.getElementById('eBrand').value.trim());
    formData.append('name', document.getElementById('eName').value.trim());
    formData.append('price', document.getElementById('ePrice').value);
    formData.append('old_price', document.getElementById('eOldPrice').value);
    formData.append('category', document.getElementById('eCategory').value);
    formData.append('size', document.getElementById('eSize').value.trim());
    formData.append('stars', document.getElementById('eStars').value || '0');
    formData.append('badge', badgeText);
    formData.append('badge_class', badgeText === '' ? '' : badgeClass);

    const imageInput = document.getElementById('eImage');
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    try {
      await requestJson('/api/admin_products.php', {
        method: 'POST',
        body: formData,
      });

      closeProductModal();
      await fetchProducts();
      renderProducts();
      await renderOverview();
      showToast('Product updated.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function deleteProduct(id) {
    try {
      await requestJson('/api/admin_products.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id,
          csrf_token: state.csrfToken,
        }),
      });

      await fetchProducts();
      renderProducts();
      await renderOverview();
      showToast('Product removed.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function replyToMessage(id) {
    const reply = document.getElementById(`messageReplyText-${id}`)?.value.trim() || '';
    try {
      await requestJson('/api/admin_messages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          id,
          reply,
          csrf_token: state.csrfToken,
        }),
      });

      await fetchMessages();
      renderMessages();
      showToast('Reply saved.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function deleteMessage(id) {
    try {
      await requestJson('/api/admin_messages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id,
          csrf_token: state.csrfToken,
        }),
      });

      await fetchMessages();
      renderMessages();
      await renderOverview();
      showToast('Message deleted.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function clearAllMessages() {
    try {
      await requestJson('/api/admin_messages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          csrf_token: state.csrfToken,
        }),
      });

      await fetchMessages();
      renderMessages();
      await renderOverview();
      showToast('All messages cleared.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function deleteReview(id) {
    if (!window.confirm('Delete this review?')) return;
    try {
      await requestJson('/api/admin_reviews.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id,
          csrf_token: state.csrfToken,
        }),
      });

      await fetchReviews();
      renderReviews();
      showToast('Review deleted.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function clearAllReviews() {
    if (!window.confirm('Delete ALL reviews? This cannot be undone.')) return;
    try {
      await requestJson('/api/admin_reviews.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          csrf_token: state.csrfToken,
        }),
      });

      await fetchReviews();
      renderReviews();
      showToast('All reviews cleared.');
    } catch (error) {
      showToast(error.message);
    }
  }

  function bindStaticEvents() {
    document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
    document.getElementById('exportRevenueBtn').addEventListener('click', () => {
      window.location.href = '/api/admin_revenue_export.php';
    });
    document.getElementById('addUserBtn').addEventListener('click', addUser);
    document.getElementById('addProductBtn').addEventListener('click', addProduct);
    document.getElementById('saveUserEditBtn').addEventListener('click', saveUserEdit);
    document.getElementById('saveProductEditBtn').addEventListener('click', saveProductEdit);
    document.getElementById('applyPointsDeltaBtn').addEventListener('click', applyPointsDelta);
    document.getElementById('clearAllMessagesBtn').addEventListener('click', clearAllMessages);
    document.getElementById('clearAllReviewsBtn').addEventListener('click', clearAllReviews);
    document.getElementById('uLoyaltyPoints').addEventListener('input', refreshPointsTierHint);

    document.getElementById('aBadge').addEventListener('input', updateAddBadgePreview);
    document.getElementById('aBadgeClass').addEventListener('change', updateAddBadgePreview);
    document.getElementById('clearAddBadgeBtn').addEventListener('click', clearAddBadge);
    document.getElementById('eBadge').addEventListener('input', updateEditBadgePreview);
    document.getElementById('eBadgeClass').addEventListener('change', updateEditBadgePreview);
    document.getElementById('clearEditBadgeBtn').addEventListener('click', clearEditBadge);

    document.getElementById('aImage').addEventListener('change', (event) => {
      previewImage(event.currentTarget, 'aImagePreviewImg', 'aImagePreview', 'aImageLabel', 'Click to upload image');
    });
    document.getElementById('eImage').addEventListener('change', (event) => {
      previewImage(event.currentTarget, 'eImagePreviewImg', 'eImagePreview', 'eImageLabel', 'Click to change image');
    });

    document.getElementById('userTableBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-action]');
      if (!button) return;
      const id = Number(button.dataset.userId);
      if (button.dataset.userAction === 'edit') openUserModal(id);
      if (button.dataset.userAction === 'delete') deleteUser(id);
    });

    document.getElementById('adminProdBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-product-action]');
      if (!button) return;
      const id = Number(button.dataset.productId);
      if (button.dataset.productAction === 'edit') openProductModal(id);
      if (button.dataset.productAction === 'delete') deleteProduct(id);
    });

    document.getElementById('adminMsgList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-message-action]');
      if (!button) return;
      const id = Number(button.dataset.messageId);
      if (button.dataset.messageAction === 'toggle-reply') {
        document.getElementById(`messageReply-${id}`)?.classList.toggle('open');
      }
      if (button.dataset.messageAction === 'reply') replyToMessage(id);
      if (button.dataset.messageAction === 'delete') deleteMessage(id);
    });

    document.getElementById('adminReviewList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-review-action]');
      if (!button) return;
      deleteReview(Number(button.dataset.reviewId));
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const allowed = await Auth.requireRole(['admin'], { redirectTo: Auth.staffLoginPath || '/admin-login.html' });
    if (!allowed) return;

    state.session = Auth.getSession();
    state.csrfToken = Auth.getCsrfToken();

    document.getElementById('sidebarName').textContent = state.session?.name || 'Admin';
    document.getElementById('sidebarEmail').textContent = state.session?.email || '';

    setupDashboardNavigation({
      onChange(panelName) {
        if (panelName === 'overview') renderOverview();
        if (panelName === 'users') renderUsers();
        if (panelName === 'products') renderProducts();
        if (panelName === 'messages') renderMessages();
        if (panelName === 'reviews') renderReviews();
      },
    });

    wireModal('userEditModal', ['[data-close-user-modal]']);
    wireModal('editModal', ['[data-close-product-modal]']);
    bindStaticEvents();
    clearAddBadge();
    clearEditBadge();

    await Promise.all([
      fetchUsers(),
      fetchProducts(),
      fetchMessages(),
      fetchReviews(),
    ]);

    renderUsers();
    renderProducts();
    renderMessages();
    renderReviews();
    await renderOverview();
  });
})();
