const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

function observeRevealElements(root = document) {
  root.querySelectorAll('.reveal').forEach((element) => {
    if (!element.classList.contains('visible')) {
      revealObs.observe(element);
    }
  });
}

observeRevealElements();
document.addEventListener('ab:about-team-loaded', () => observeRevealElements());
