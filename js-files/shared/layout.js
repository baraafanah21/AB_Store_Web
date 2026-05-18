/*
 * AB Store — shared layout orchestrator.
 *
 * Single entry script for every page. Loads the shared utility modules,
 * mounts shared partials (nav, mobile-nav, footer, optional page partial),
 * wires shared behaviors, then loads any page-specific scripts declared in
 * `data-page-scripts` on <body>.
 *
 * Page convention:
 *   <body data-page="cart"
 *         data-page-partial="components/pages/cart.html"        (optional)
 *         data-page-scripts="js-files/pages/cart.js,...">       (optional)
 *     <div id="navMount"></div>                                  (optional)
 *     <div id="mobileNavMount"></div>                            (optional)
 *     <main id="pageMount">                                      (inline OR mounted)
 *       ...page content...
 *     </main>
 *     <div id="footerMount"></div>                               (optional)
 *
 *     <script src="js-files/roles-dash/Auth.js"></script>
 *     <script src="js-files/shared/layout.js"></script>
 *   </body>
 *
 * If `data-page-partial` is set, the orchestrator fetches that file into
 * `#pageMount`. Otherwise it leaves existing inline content in place.
 */
(function () {
  const SHARED_MODULES = [
    'js-files/roles-dash/Auth.js',
    'js-files/shared/utils.js',
    'js-files/shared/nav-controller.js',
    'js-files/shared/auth-ui.js',
    'js-files/shared/reveal.js',
  ];

  const PARTIALS = [
    { selector: '#navMount', path: 'components/shared/nav.html' },
    { selector: '#mobileNavMount', path: 'components/shared/mobile-nav.html' },
    { selector: '#footerMount', path: 'components/shared/footer.html' },
  ];

  function currentScriptDir() {
    const tag = document.currentScript;
    if (!tag) return '';
    const src = tag.getAttribute('src') || '';
    const idx = src.lastIndexOf('/');
    return idx >= 0 ? src.slice(0, idx + 1) : '';
  }

  const SCRIPT_DIR = currentScriptDir();

  function alreadyLoaded(src) {
    if (document.querySelector(`script[data-ab-shared="${src}"]`)) return true;
    const existing = document.querySelectorAll('script[src]');
    for (const tag of existing) {
      const tagSrc = tag.getAttribute('src') || '';
      if (tagSrc === src || tagSrc.endsWith('/' + src) || tagSrc.endsWith(src)) {
        return true;
      }
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
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadSharedModules() {
    for (const path of SHARED_MODULES) {
      await loadScript(path);
    }
  }

  async function fetchText(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.text();
  }

  async function mountPartial(selector, path) {
    const mount = document.querySelector(selector);
    if (!mount || !path) return;
    if (mount.dataset.abMounted === '1') return;
    mount.innerHTML = await fetchText(path);
    mount.dataset.abMounted = '1';
  }

  async function mountAll() {
    const body = document.body;
    const tasks = PARTIALS.map(({ selector, path }) => mountPartial(selector, path));

    if (body.dataset.pagePartial) {
      tasks.push(mountPartial('#pageMount', body.dataset.pagePartial));
    }

    await Promise.all(tasks);
  }

  async function loadPageScripts() {
    const list = (document.body.dataset.pageScripts || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    for (const src of list) {
      await loadScript(src);
    }
  }

  function wireBehaviors() {
    const AB = window.AB || {};
    if (AB.navController) AB.navController.init();
    if (AB.authUi) AB.authUi.init();
    if (AB.reveal) AB.reveal.init();
  }

  async function boot() {
    await loadSharedModules();
    try {
      await mountAll();
    } catch (error) {
      console.error('[ab-layout] mount failed:', error);
      const fallback = document.getElementById('pageMount');
      if (fallback && !fallback.children.length) {
        fallback.innerHTML = '<div class="container py-5"><p>Unable to load page components. Run this project through a local server so HTML partials can be fetched.</p></div>';
      }
    }

    wireBehaviors();

    try {
      await loadPageScripts();
    } catch (error) {
      console.error('[ab-layout] page script failed:', error);
    }

    document.dispatchEvent(new CustomEvent('ab:layout-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  void SCRIPT_DIR;
})();
