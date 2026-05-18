(function initEmployeeDashboardPage() {
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

  const state = {
    session: null,
    csrfToken: '',
    products: [],
    messages: [],
    messagesConfigured: false,
    editProductId: null,
  };

  async function fetchProducts() {
    const payload = await requestJson('/api/admin_products.php');
    state.products = payload.products || [];
  }

  async function fetchMessages() {
    const payload = await requestJson('/api/admin_messages.php');
    state.messages = payload.messages || [];
    state.messagesConfigured = Boolean(payload.configured);
  }

  function renderProducts() {
    const tbody = document.getElementById('productTableBody');
    document.getElementById('productCount').textContent = String(state.products.length);

    if (state.products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--ivory-dim)">No products yet.</td></tr>';
      return;
    }

    tbody.innerHTML = state.products.map((product) => {
      const src = resolveImageUrl(product.image_url);
      return `
        <tr>
          <td>
            ${src
              ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.brand)}" class="prod-thumb"/>`
              : '<div class="prod-thumb-placeholder"><i class="bi bi-image"></i></div>'}
          </td>
          <td><span class="prod-name">${escapeHtml(product.brand)}</span><br><span style="font-size:.72rem">${escapeHtml(product.name)}</span></td>
          <td><span class="badge-pill badge-${escapeHtml(product.category)}">${escapeHtml(product.category)}</span></td>
          <td>${escapeHtml(product.size)}</td>
          <td>${formatMoney(product.price)}</td>
          <td style="white-space:nowrap">
            <button class="btn-outline" style="padding:.4rem .7rem;margin-right:.4rem" data-product-action="edit" data-product-id="${Number(product.id)}"><i class="bi bi-pencil"></i></button>
            <button class="btn-danger" data-product-action="delete" data-product-id="${Number(product.id)}"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderMessages() {
    const list = document.getElementById('messageList');
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
        <div class="msg-reply" id="reply-${Number(message.id)}">
          <textarea rows="3" placeholder="Type your reply…" id="replyText-${Number(message.id)}" style="width:100%;margin-top:.8rem;background:rgba(255,255,255,.04);border:1px solid rgba(200,169,110,.2);color:var(--ivory);font-family:'Jost',sans-serif;font-size:.82rem;padding:.65rem .9rem;outline:none;resize:none;"></textarea>
          <button class="btn-gold" style="margin-top:.5rem;" data-message-action="reply" data-message-id="${Number(message.id)}">Send Reply</button>
        </div>
        <div style="margin-top:.7rem;display:flex;gap:.6rem">
          <button class="btn-outline" data-message-action="toggle-reply" data-message-id="${Number(message.id)}"><i class="bi bi-reply"></i> Reply</button>
          <button class="btn-danger" data-message-action="delete" data-message-id="${Number(message.id)}"><i class="bi bi-trash"></i> Delete</button>
        </div>
      </div>
    `).join('');
  }

  function buildProductFormData(action) {
    const formData = new FormData();
    formData.append('action', action);
    formData.append('csrf_token', state.csrfToken);
    return formData;
  }

  async function addProduct() {
    const formData = buildProductFormData('create');
    formData.append('brand', document.getElementById('newBrand').value.trim());
    formData.append('name', document.getElementById('newName').value.trim());
    formData.append('price', document.getElementById('newPrice').value);
    formData.append('category', document.getElementById('newCategory').value);
    formData.append('size', document.getElementById('newSize').value.trim());

    const imageInput = document.getElementById('newImage');
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    try {
      await requestJson('/api/admin_products.php', {
        method: 'POST',
        body: formData,
      });

      ['newBrand', 'newName', 'newPrice', 'newSize'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      resetImagePreview('newImage', 'newImagePreviewImg', 'newImagePreview', 'newImageLabel', 'Click to upload image');
      await fetchProducts();
      renderProducts();
      showToast('Product added.');
    } catch (error) {
      showToast(error.message);
    }
  }

  function openProductModal(id) {
    const product = state.products.find((entry) => Number(entry.id) === Number(id));
    if (!product) return;

    state.editProductId = Number(id);
    document.getElementById('eBrand').value = product.brand || '';
    document.getElementById('eName').value = product.name || '';
    document.getElementById('ePrice').value = product.price || '';
    document.getElementById('eCategory').value = product.category || 'her';
    document.getElementById('eSize').value = product.size || '';
    document.getElementById('eImage').value = '';
    document.getElementById('eImageLabel').textContent = 'Click to change image';

    const preview = document.getElementById('eImagePreviewImg');
    const src = resolveImageUrl(product.image_url);
    preview.src = src;
    preview.style.display = src ? 'block' : 'none';

    document.getElementById('editModal').classList.add('open');
  }

  function closeProductModal() {
    state.editProductId = null;
    document.getElementById('editModal').classList.remove('open');
  }

  async function saveProductEdit() {
    if (state.editProductId === null) return;

    const formData = buildProductFormData('update');
    formData.append('id', String(state.editProductId));
    formData.append('brand', document.getElementById('eBrand').value.trim());
    formData.append('name', document.getElementById('eName').value.trim());
    formData.append('price', document.getElementById('ePrice').value);
    formData.append('category', document.getElementById('eCategory').value);
    formData.append('size', document.getElementById('eSize').value.trim());

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
      showToast('Product removed.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function sendReply(id) {
    const reply = document.getElementById(`replyText-${id}`)?.value.trim() || '';
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
      showToast('All messages cleared.');
    } catch (error) {
      showToast(error.message);
    }
  }

  function bindStaticEvents() {
    document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
    document.getElementById('addProductBtn').addEventListener('click', addProduct);
    document.getElementById('saveProductEditBtn').addEventListener('click', saveProductEdit);
    document.getElementById('clearAllMessagesBtn').addEventListener('click', clearAllMessages);

    document.getElementById('newImage').addEventListener('change', (event) => {
      previewImage(event.currentTarget, 'newImagePreviewImg', 'newImagePreview', 'newImageLabel', 'Click to upload image');
    });
    document.getElementById('eImage').addEventListener('change', (event) => {
      previewImage(event.currentTarget, 'eImagePreviewImg', 'eImagePreview', 'eImageLabel', 'Click to change image');
    });

    document.getElementById('productTableBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-product-action]');
      if (!button) return;
      const id = Number(button.dataset.productId);
      if (button.dataset.productAction === 'edit') openProductModal(id);
      if (button.dataset.productAction === 'delete') deleteProduct(id);
    });

    document.getElementById('messageList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-message-action]');
      if (!button) return;
      const id = Number(button.dataset.messageId);
      if (button.dataset.messageAction === 'toggle-reply') {
        document.getElementById(`reply-${id}`)?.classList.toggle('open');
      }
      if (button.dataset.messageAction === 'reply') sendReply(id);
      if (button.dataset.messageAction === 'delete') deleteMessage(id);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const allowed = await Auth.requireRole(['employee', 'admin'], { redirectTo: Auth.staffLoginPath || '/admin-login.html' });
    if (!allowed) return;

    state.session = Auth.getSession();
    state.csrfToken = Auth.getCsrfToken();

    document.getElementById('sidebarName').textContent = state.session?.name || 'Employee';
    document.getElementById('sidebarEmail').textContent = state.session?.email || '';

    setupDashboardNavigation({
      onChange(panelName) {
        if (panelName === 'products') renderProducts();
        if (panelName === 'messages') renderMessages();
      },
    });

    wireModal('editModal', ['[data-close-product-modal]']);
    bindStaticEvents();

    await Promise.all([
      fetchProducts(),
      fetchMessages(),
    ]);

    renderProducts();
    renderMessages();
  });
})();
