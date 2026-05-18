const DEMO_USER = {
  name: 'AB Store Member',
  memberId: 'AB-00000',
  points: 0,
};

const TIERS = {
  bronze: {
    min: 0,
    max: 999,
    label: 'Bronze Member',
    watermark: 'Bronze',
    icon: '🥉',
    colorA: '#cd7f32',
    colorB: '#e8a96e',
    cardClass: 'bronze',
    nextName: 'Gold',
    nextAt: 1000,
    heroBg: 'rgba(205,127,50,0.15)',
    bodyBg: '#0c0804',
    sliderColor: '#cd7f32',
  },
  gold: {
    min: 1000,
    max: 2999,
    label: 'Gold Member',
    watermark: 'Gold',
    icon: '⭐',
    colorA: '#c8a96e',
    colorB: '#e2cc9a',
    cardClass: 'gold',
    nextName: 'Platinum',
    nextAt: 3000,
    heroBg: 'rgba(200,169,110,0.15)',
    bodyBg: '#09080a',
    sliderColor: '#c8a96e',
  },
  platinum: {
    min: 3000,
    max: 5000,
    label: 'Platinum Member',
    watermark: 'Platinum',
    icon: '💎',
    colorA: '#c8d8e8',
    colorB: '#e8f0f8',
    cardClass: 'platinum',
    nextName: null,
    nextAt: null,
    heroBg: 'rgba(180,210,240,0.15)',
    bodyBg: '#080a0c',
    sliderColor: '#c8d8e8',
  },
};

function getTier(points) {
  if (points >= 3000) return TIERS.platinum;
  if (points >= 1000) return TIERS.gold;
  return TIERS.bronze;
}

const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animFrame = null;
let particleColor = '#c8a96e';
let maxParticles = 60;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnParticle() {
  const isDiamond = document.body.classList.contains('diamond-mode');
  const colors = isDiamond
    ? ['#c8e8ff', '#e8f4ff', '#a0c8f0', '#ffffff', '#b0d8ff']
    : [particleColor];

  return {
    x: Math.random() * canvas.width,
    y: canvas.height + 10,
    size: isDiamond ? Math.random() * 3.5 + 1.2 : Math.random() * 2.5 + 1,
    speedY: -(Math.random() * (isDiamond ? 1.6 : 1.2) + 0.4),
    speedX: (Math.random() - 0.5) * (isDiamond ? 1 : 0.6),
    alpha: Math.random() * 0.7 + 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 0,
    maxLife: Math.random() * 200 + 120,
  };
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (particles.length < maxParticles) particles.push(spawnParticle());

  particles.forEach((particle, index) => {
    particle.x += particle.speedX;
    particle.y += particle.speedY;
    particle.life += 1;
    const alpha = particle.alpha * (1 - particle.life / particle.maxLife);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color || particleColor;
    ctx.translate(particle.x, particle.y);
    ctx.beginPath();
    for (let corner = 0; corner < 4; corner += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.lineTo(0, -particle.size * 2);
      ctx.lineTo(0, -particle.size * 0.5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (particle.life >= particle.maxLife) particles.splice(index, 1);
  });

  animFrame = requestAnimationFrame(animateParticles);
}

function startParticles(color, count = 60) {
  particleColor = color;
  maxParticles = count;
  canvas.classList.add('active');
  if (!animFrame) animateParticles();
}

function stopParticles() {
  canvas.classList.remove('active');
  cancelAnimationFrame(animFrame);
  animFrame = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = [];
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function updateLoyalty(points, profile = DEMO_USER) {
  const safePoints = parseInt(points, 10) || 0;
  const tier = getTier(safePoints);
  const totalJourneyPoints = TIERS.platinum.max;
  const overallPercent = Math.max(0, Math.min(100, (Math.min(safePoints, totalJourneyPoints) / totalJourneyPoints) * 100));

  const card = document.getElementById('memberCard');
  card.className = `member-card ${tier.cardClass}`;
  document.getElementById('cardWatermark').textContent = tier.watermark;
  document.getElementById('cardBrand').textContent = 'AB Store';
  document.getElementById('cardBadge').textContent = tier.label;
  document.getElementById('cardIcon').textContent = tier.icon;
  document.getElementById('cardPoints').textContent = safePoints.toLocaleString();
  document.getElementById('cardName').textContent = profile.name;
  document.getElementById('cardMemberId').textContent = `Member ID: ${profile.memberId}`;

  const fill = document.getElementById('progressFill');
  fill.className = 'progress-fill';
  fill.classList.add(tier.cardClass);

  let progressPercent = 100;
  let toLabel = 'Maximum Level Reached';
  let note = 'You have reached the highest tier.';

  if (tier.cardClass !== 'platinum') {
    const range = tier.nextAt - tier.min;
    const done = safePoints - tier.min;
    progressPercent = Math.round((done / range) * 100);
    toLabel = `${tier.nextName} at ${tier.nextAt.toLocaleString()} pts`;
    note = `${(tier.nextAt - safePoints).toLocaleString()} pts to ${tier.nextName}`;
  }

  requestAnimationFrame(() => {
    fill.style.width = `${progressPercent}%`;
  });
  document.getElementById('progressFrom').textContent = `${tier.watermark} · ${safePoints.toLocaleString()} pts`;
  document.getElementById('progressTo').textContent = toLabel;
  document.getElementById('progressNote').textContent = note;

  document.getElementById('tierBronze').classList.remove('current-tier');
  document.getElementById('tierGold').classList.remove('current-tier');
  document.getElementById('tierPlatinum').classList.remove('current-tier');
  document.querySelectorAll('.current-badge').forEach((badge) => badge.remove());

  const activeTier = document.getElementById(`tier${capitalize(tier.cardClass)}`);
  activeTier.classList.add('current-tier');
  const currentBadge = document.createElement('span');
  currentBadge.className = 'current-badge';
  currentBadge.textContent = 'Your Level';
  activeTier.appendChild(currentBadge);

  document.body.style.background = tier.bodyBg;
  document.getElementById('heroBg').style.background =
    `radial-gradient(ellipse at 50% 0%, ${tier.heroBg} 0%, transparent 65%)`;
  document.getElementById('tierLabel').style.color = tier.colorB;
  document.getElementById('historyLabel').style.color = tier.colorB;
  document.getElementById('historyIcon').style.color = tier.colorB;
  document.getElementById('heroEyebrow').style.color = tier.colorA;

  const rewardLineFill = document.getElementById('pointsLineFill');
  requestAnimationFrame(() => {
    rewardLineFill.style.width = `${overallPercent}%`;
  });
  rewardLineFill.style.background = `linear-gradient(90deg, ${tier.colorA}, ${tier.colorB})`;

  if (tier.cardClass === 'bronze') {
    stopParticles();
    document.body.classList.remove('diamond-mode');
  } else if (tier.cardClass === 'gold') {
    startParticles(tier.colorA, 60);
    document.body.classList.remove('diamond-mode');
  } else {
    startParticles(tier.colorB, 120);
    document.body.classList.add('diamond-mode');
  }
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function renderHistory(rows) {
  const historyRows = document.getElementById('historyRows');
  if (!rows.length) {
    historyRows.innerHTML = `
      <div class="history-empty">
        Your loyalty activity will appear here after your first purchase.
      </div>`;
    return;
  }

  historyRows.innerHTML = rows.map((row) => {
    const isRedeem = String(row.transaction_type) === 'redeem';
    const icon = isRedeem ? 'bi-arrow-down-circle' : 'bi-bag-check';
    const delta = Number(row.points_delta || 0);
    const sign = delta > 0 ? '+' : '';
    return `
      <div class="history-row">
        <div class="history-icon ${isRedeem ? 'redeem' : 'earn'}"><i class="bi ${icon}"></i></div>
        <div class="history-desc">
          <div class="h-title">${row.description}</div>
          <div class="h-date">${formatHistoryDate(row.created_at)}</div>
        </div>
        <div class="history-pts ${isRedeem ? 'redeem' : 'earn'}">${sign}${delta} pts</div>
      </div>`;
  }).join('');
}

function updateRewardPanel(reward, points) {
  const note = document.getElementById('rewardPanelNote');
  if (!reward) {
    note.textContent = `Keep shopping to collect more points. You currently have ${points.toLocaleString()} points.`;
    return;
  }

  note.textContent = `You can redeem ${reward.discount_percent}% off your next order for ${reward.discount_cost_points.toLocaleString()} points.`;
}

async function loadLoyaltyProfile() {
  const response = await fetch('/api/loyalty.php', {
    credentials: 'include',
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to load loyalty profile.');
  }
  return payload;
}

const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach((element) => revealObs.observe(element));

function syncCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const safeCount = parseInt(localStorage.getItem('abCartCount') || '0', 10);
  badge.textContent = String(Number.isNaN(safeCount) ? 0 : safeCount);
}

function updateLoyaltyAccess() {
  const session = Auth.getSession();
  const gate = document.getElementById('loyaltyGate');

  if (!session) {
    document.body.classList.add('guest');
    gate.style.display = 'flex';
    return false;
  }

  document.body.classList.remove('guest');
  gate.style.display = 'none';
  return true;
}

async function initLoyaltyPage() {
  updateLoyalty(0, DEMO_USER);
  syncCartBadge();
  await Auth.refreshSession();

  if (!updateLoyaltyAccess()) {
    return;
  }

  const payload = await loadLoyaltyProfile();
  const user = payload.user || {};

  updateLoyalty(Number(user.loyalty_points || 0), {
    name: user.name || DEMO_USER.name,
    memberId: user.member_id || DEMO_USER.memberId,
  });
  updateRewardPanel(payload.available_reward, Number(user.loyalty_points || 0));
  renderHistory(payload.history || []);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

void initLoyaltyPage().catch(() => {
  updateLoyaltyAccess();
});
