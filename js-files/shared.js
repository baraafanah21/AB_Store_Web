/*
 * Legacy entry-point — kept for backward compatibility.
 *
 * Pages should migrate to `js-files/shared/layout.js`, which is the single
 * canonical entry point. This file now just forwards to the modular shared
 * code so older pages that still load shared.js + shared-footer.js continue
 * to behave correctly without two competing initializers.
 */
(function () {
  const SHARED = [
    'js-files/roles-dash/Auth.js',
    'js-files/shared/utils.js',
    'js-files/shared/nav-controller.js',
    'js-files/shared/auth-ui.js',
    'js-files/shared/reveal.js',
  ];

  function alreadyLoaded(src) {
    if (document.querySelector(`script[data-ab-shared="${src}"]`)) return true;
    const existing = document.querySelectorAll('script[src]');
    for (const tag of existing) {
      const tagSrc = tag.getAttribute('src') || '';
      if (tagSrc === src || tagSrc.endsWith('/' + src) || tagSrc.endsWith(src)) return true;
    }
    return false;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (alreadyLoaded(src)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.dataset.abShared = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function bootCompat() {
    for (const path of SHARED) {
      try { await loadScript(path); } catch (err) { console.error(err); }
    }

    const AB = window.AB || {};
    if (AB.navController) AB.navController.init();
    if (AB.authUi) AB.authUi.init();
    if (AB.reveal) AB.reveal.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCompat, { once: true });
  } else {
    bootCompat();
  }
})();
