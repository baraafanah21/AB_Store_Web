(function () {
  const AB = (window.AB = window.AB || {});
  const SCROLL_CLASS_THRESHOLD = 24;

  let wired = false;

  function setActivePage(page) {
    if (!page) return;
    document.querySelectorAll('[data-nav-page]').forEach((link) => {
      link.classList.toggle('active', link.dataset.navPage === page);
    });
  }

  function syncCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    badge.textContent = String(AB.utils.readCartCount());
  }

  function openCart() {
    window.location.href = 'cart.html';
  }

  function doLogout() {
    window.location.href = '/auth/logout.php';
  }

  function closeMobileNav() {
    const mobileNav = document.getElementById('mobileNav');
    const hamburger = document.getElementById('hamburger');
    if (mobileNav) mobileNav.classList.remove('open');
    if (hamburger) hamburger.classList.remove('open');
    document.body.style.overflow = '';
  }

  function wireNav() {
    const nav = document.getElementById('mainNav');
    if (nav && !nav.dataset.abWired) {
      nav.dataset.abWired = '1';
      const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > SCROLL_CLASS_THRESHOLD);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');
    if (hamburger && mobileNav && !hamburger.dataset.abWired) {
      hamburger.dataset.abWired = '1';
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileNav.classList.toggle('open');
        document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
      });
    }
  }

  function init() {
    wireNav();
    setActivePage(document.body.dataset.page || '');
    syncCartBadge();

    if (!wired) {
      wired = true;
      window.addEventListener('storage', (event) => {
        if (event.key === 'abCartCount') syncCartBadge();
      });
    }
  }

  AB.navController = { init, setActivePage, syncCartBadge, closeMobileNav, openCart, doLogout };

  window.closeMobileNav = closeMobileNav;
  window.closeMobile = closeMobileNav;
  window.openCart = openCart;
  window.doLogout = doLogout;
  window.updateCartBadge = function (count) {
    AB.utils.writeCartCount(Number(count) || 0);
    syncCartBadge();
  };
})();
