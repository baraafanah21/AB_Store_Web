(function () {
  const AB = (window.AB = window.AB || {});

  function init(root) {
    const scope = root || document;
    const targets = scope.querySelectorAll('.reveal:not([data-ab-revealed])');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => {
        el.classList.add('visible');
        el.dataset.abRevealed = '1';
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    targets.forEach((el) => {
      el.dataset.abRevealed = '1';
      observer.observe(el);
    });
  }

  AB.reveal = { init };
})();
