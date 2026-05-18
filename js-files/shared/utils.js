(function () {
  const AB = (window.AB = window.AB || {});

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function readCartCount() {
    const raw = parseInt(localStorage.getItem('abCartCount') || '0', 10);
    return Number.isFinite(raw) ? raw : 0;
  }

  function writeCartCount(count) {
    localStorage.setItem('abCartCount', String(count));
  }

  AB.utils = { escapeHtml, readCartCount, writeCartCount };

  window.escapeHtml = window.escapeHtml || escapeHtml;
})();
