const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach((element) => revealObs.observe(element));

function highlightToday() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = days[new Date().getDay()];
  const row = document.getElementById(`day${today}`);
  if (row) row.classList.add('today');
}

function clearError(id) {
  document.getElementById(id).classList.remove('error');
  const err = document.getElementById(`${id}Err`);
  if (err) err.classList.remove('show');
}

['firstName', 'lastName', 'email', 'subject', 'message'].forEach((id) => {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener('input', () => clearError(id));
  }
});

async function submitForm() {
  let valid = true;

  const checks = [
    { id: 'firstName', test: (value) => value.trim().length > 0 },
    { id: 'lastName', test: (value) => value.trim().length > 0 },
    { id: 'email', test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) },
    { id: 'subject', test: (value) => value !== '' },
    { id: 'message', test: (value) => value.trim().length > 0 },
  ];

  checks.forEach(({ id, test }) => {
    const element = document.getElementById(id);
    const err = document.getElementById(`${id}Err`);
    if (!test(element.value)) {
      element.classList.add('error');
      if (err) err.classList.add('show');
      valid = false;
    }
  });

  if (!valid) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split spin-icon"></i> Sending…';

  if (typeof Auth !== 'undefined' && Auth.ready) {
    await Auth.ready();
  }

  const payload = {
    name: [
      document.getElementById('firstName').value.trim(),
      document.getElementById('lastName').value.trim(),
    ].join(' ').trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    subject: document.getElementById('subject').value,
    message: document.getElementById('message').value.trim(),
    csrf_token: (typeof Auth !== 'undefined' && Auth.getCsrfToken) ? Auth.getCsrfToken() : '',
  };

  try {
    const response = await fetch('/api/contact.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || 'Unable to send your request right now.');
    }

    const form = document.getElementById('contactForm');
    const success = document.getElementById('formSuccess');
    form.style.transition = 'opacity .4s';
    form.style.opacity = '0';

    setTimeout(() => {
      form.style.display = 'none';
      success.style.display = 'block';
      success.style.opacity = '0';
      success.style.transition = 'opacity .5s';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          success.style.opacity = '1';
        });
      });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1400);
    }, 420);
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = 'Send Request &nbsp;<i class="bi bi-send"></i>';
    alert(error.message || 'Unable to send your request right now.');
  }
}

function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = btn.classList.contains('open');

  document.querySelectorAll('.faq-question.open').forEach((question) => {
    question.classList.remove('open');
    question.nextElementSibling.classList.remove('open');
  });

  if (!isOpen) {
    btn.classList.add('open');
    answer.classList.add('open');
  }
}

function initStoreMap() {
  if (typeof L === 'undefined' || !document.getElementById('storeMap')) return;

  const map = L.map('storeMap', {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView([32.1889, 34.9707], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  const goldIcon = L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#c8a96e;border:2px solid #080808;
      box-shadow:0 0 0 4px rgba(200,169,110,.35),0 0 14px rgba(200,169,110,.5);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  L.marker([32.1889, 34.9707], { icon: goldIcon })
    .addTo(map)
    .bindPopup('<strong style="font-family:serif">AB Store</strong><br>Qalqilya, Palestine')
    .openPopup();
}

highlightToday();
initStoreMap();

window.submitForm = submitForm;
window.toggleFaq = toggleFaq;
