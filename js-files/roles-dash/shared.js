window.RoleDashShared = (() => {
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

  function resolveImageUrl(path) {
    if (!path) return '';
    return path.startsWith('http') || path.startsWith('/') ? path : `/${path}`;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`Invalid server response (${response.status}).`);
    }

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Request failed.');
    }

    return payload;
  }

  function showToast(message, toastId = 'toast') {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timerId);
    showToast.timerId = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setupDashboardNavigation({ onChange }) {
    const navItems = Array.from(document.querySelectorAll('.nav-item[data-panel]'));
    const panels = Array.from(document.querySelectorAll('.panel'));

    function activate(panelName) {
      panels.forEach((panel) => {
        const isActive = panel.id === `panel${panelName.charAt(0).toUpperCase()}${panelName.slice(1)}`;
        panel.classList.toggle('active', isActive);
      });

      navItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.panel === panelName);
      });

      if (typeof onChange === 'function') {
        onChange(panelName);
      }
    }

    navItems.forEach((item) => {
      item.addEventListener('click', () => activate(item.dataset.panel));
    });

    return { activate };
  }

  function wireModal(modalId, closeSelectors) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    closeSelectors.forEach((selector) => {
      modal.querySelectorAll(selector).forEach((element) => {
        element.addEventListener('click', () => modal.classList.remove('open'));
      });
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.remove('open');
      }
    });
  }

  function previewImage(input, previewImageId, previewWrapId, labelId, defaultLabel) {
    const file = input.files && input.files[0];
    if (!file) return;

    const previewImageEl = document.getElementById(previewImageId);
    const previewWrapEl = document.getElementById(previewWrapId);
    const labelEl = document.getElementById(labelId);
    const reader = new FileReader();

    reader.onload = (event) => {
      if (previewImageEl) {
        previewImageEl.src = String(event.target?.result || '');
        previewImageEl.style.display = 'block';
      }
      if (previewWrapEl) {
        previewWrapEl.style.display = 'block';
      }
      if (labelEl) {
        labelEl.textContent = file.name || defaultLabel;
      }
    };

    reader.readAsDataURL(file);
  }

  function resetImagePreview(inputId, previewImageId, previewWrapId, labelId, defaultLabel) {
    const input = document.getElementById(inputId);
    const previewImageEl = document.getElementById(previewImageId);
    const previewWrapEl = document.getElementById(previewWrapId);
    const labelEl = document.getElementById(labelId);

    if (input) input.value = '';
    if (previewImageEl) {
      previewImageEl.src = '';
      previewImageEl.style.display = 'none';
    }
    if (previewWrapEl) {
      previewWrapEl.style.display = 'none';
    }
    if (labelEl) {
      labelEl.textContent = defaultLabel;
    }
  }

  return {
    escapeHtml,
    formatMoney,
    resolveImageUrl,
    requestJson,
    showToast,
    setupDashboardNavigation,
    wireModal,
    previewImage,
    resetImagePreview,
  };
})();
