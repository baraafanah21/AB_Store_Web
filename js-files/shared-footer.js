/*
 * Legacy entry-point — kept for backward compatibility.
 *
 * Original responsibility was just to fetch components/shared/footer.html
 * into #footerMount. Pages should migrate to `js-files/shared/layout.js`,
 * which handles the full layout (nav + mobile-nav + footer + page scripts).
 *
 * This shim mounts the footer if it is the only mount on the page, and
 * re-wires shared behaviors so it composes cleanly with shared.js.
 */
(function () {
  async function mountFooter() {
    const mount = document.getElementById('footerMount');
    if (!mount || mount.dataset.abMounted === '1') return;
    try {
      const response = await fetch('components/shared/footer.html');
      if (!response.ok) throw new Error('Failed to load shared footer.');
      mount.innerHTML = await response.text();
      mount.dataset.abMounted = '1';
      document.dispatchEvent(new CustomEvent('ab:footer-loaded'));
    } catch (error) {
      console.error(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountFooter, { once: true });
  } else {
    mountFooter();
  }
})();
