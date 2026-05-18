function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

const ADMIN_AVATARS = {
  bara: 'images/bara.webp',
  ali: 'images/ali.webp',
  sufyan: 'images/Sufyan.webp',
  maysoon: 'images/maysoon.webp',
};

const TEAM_PROFILES = {
  'bara afanah': {
    role: 'Co-Owner',
    tag: 'Leadership',
    description: 'Helps lead AB Store with a focus on shaping the project vision, guiding the team, and keeping the platform aligned with its goals.',
    avatar: 'images/bara.webp',
  },
  'ali zaid': {
    role: 'Co-Owner',
    tag: 'Leadership',
    description: 'Supports the growth of AB Store by contributing to project planning, coordination, and the day-to-day direction of the store experience.',
    avatar: 'images/ali.webp',
  },
  'dr sufyan samara': {
    role: 'Course Doctor',
    tag: 'Academic Support',
    description: 'Provides academic guidance for the course project, helping ensure the work stays structured, relevant, and aligned with the course objectives.',
    avatar: 'images/Sufyan.webp',
  },
  'eng maysoon ashayer': {
    role: 'Project Discussion Engineer',
    tag: 'Engineering Mentor',
    description: 'Leads the engineering-side project discussions and offers practical feedback that helps refine the technical direction and presentation of the work.',
    avatar: 'images/maysoon.webp',
  },
};

const DEFAULT_TEAM = [
  { name: 'Bara Afanah', role: 'co-owner', email: 'bara@abstore.com', member_id: 'AB-001', loyalty_points: 0 },
  { name: 'Ali Zaid', role: 'co-owner', email: 'ali@abstore.com', member_id: 'AB-002', loyalty_points: 0 },
  { name: 'Dr.Sufyan Samara', role: 'course doctor', email: 'sufyan@abstore.com', member_id: 'AB-003', loyalty_points: 0 },
  { name: 'Eng.Maysoon Ashayer', role: 'project engineer', email: 'maysoon@abstore.com', member_id: 'AB-004', loyalty_points: 0 },
];

function normalizeProfileKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCuratedTeam(liveMembers = []) {
  const liveMemberMap = new Map(
    liveMembers.map((member) => [normalizeProfileKey(member.name), member])
  );

  return DEFAULT_TEAM.map((defaultMember) => {
    const liveMatch = liveMemberMap.get(normalizeProfileKey(defaultMember.name));
    return liveMatch ? { ...defaultMember, ...liveMatch, name: defaultMember.name } : defaultMember;
  });
}

function buildAboutTeamCard(teamMember) {
  const memberName = String(teamMember.name ?? 'AB Store');
  const profile = TEAM_PROFILES[normalizeProfileKey(memberName)] ?? null;
  const memberRole = String(profile?.role ?? teamMember.role ?? 'Team Member');
  const memberDescription = String(
    profile?.description ?? 'A valued member of the AB Store team helping bring the project to life.'
  );
  const memberTag = String(profile?.tag ?? 'AB Store Team');
  const memberId = String(teamMember.member_id ?? 'AB Team');
  const memberInitials = memberName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((namePart) => namePart.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'AB';

  const firstNameKey = (memberName.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  const avatarSrc = String(profile?.avatar ?? ADMIN_AVATARS[firstNameKey] ?? '');
  const imageMarkup = avatarSrc
    ? `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(memberName)}" onerror="this.remove();this.parentNode.querySelector('.team-initials').style.display='block';">
       <div class="team-initials" style="display:none">${escapeHtml(memberInitials)}</div>`
    : `<div class="team-initials">${escapeHtml(memberInitials)}</div>`;

  return `
    <div class="col-lg-3 col-md-6 reveal">
      <div class="team-card h-100">
        <div class="team-img-wrap d-flex align-items-center justify-content-center">
          ${imageMarkup}
          <div class="team-overlay"></div>
        </div>
        <div class="team-body">
          <span class="team-tag">${escapeHtml(memberTag)}</span>
          <div class="team-head">
            <div class="team-name">${escapeHtml(memberName)}</div>
            <div class="team-role">${escapeHtml(memberRole)}</div>
          </div>
          <p class="team-bio">${escapeHtml(memberDescription)}</p>
          <div class="team-meta">${escapeHtml(memberId)}</div>
        </div>
      </div>
    </div>
  `;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function updateSharedFooter(payload) {
  const stats = payload.stats ?? {};

  setText(
    'shared-footer-copy',
    `Explore ${Number(stats.products_count ?? 0)} live products across ${Number(stats.brands_count ?? 0)} brands, supported by ${Number(stats.staff_count ?? 0)} staff and ${Number(stats.members_count ?? 0)} registered members.`
  );

  setText('shared-footer-year', `© ${Number(payload.year ?? new Date().getFullYear())} AB Store. All rights reserved.`);
  setText(
    'shared-footer-meta',
    `Products: ${Number(stats.products_count ?? 0)} · Brands: ${Number(stats.brands_count ?? 0)} · Support: Sun - Thu 10:00 - 20:00`
  );
}

async function loadStoreInfo() {
  const response = await fetch('/api/store_info.php');
  if (!response.ok) {
    throw new Error('Failed to load store information.');
  }

  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error ?? 'Failed to load store information.');
  }

  return payload;
}

function updateAboutPage(payload) {
  const stats = payload.stats ?? {};
  const teamMembers = Array.isArray(payload.team_members) ? payload.team_members : [];
  const supportEmail = String(payload.support_email ?? '');

  setText(
    'about-hero-copy',
    `AB Store currently showcases ${Number(stats.products_count ?? 0)} fragrances across ${Number(stats.brands_count ?? 0)} brands, supported by ${Number(stats.staff_count ?? 0)} staff members and ${Number(stats.members_count ?? 0)} registered clients.`
  );
  setText('about-products-count', String(Number(stats.products_count ?? 0)));
  setText('about-brands-count', String(Number(stats.brands_count ?? 0)));
  setText('about-members-count', String(Number(stats.members_count ?? 0)));
  setText('about-staff-count', String(Number(stats.staff_count ?? 0)));
  setText(
    'about-story-copy-1',
    `The about page now reads directly from the AB Store database. Our catalog currently includes ${Number(stats.products_count ?? 0)} fragrances curated from ${Number(stats.brands_count ?? 0)} brands.`
  );
  setText(
    'about-story-copy-2',
    `We currently serve ${Number(stats.members_count ?? 0)} registered clients, while ${Number(stats.staff_count ?? 0)} staff accounts help manage the store, the catalog, and customer support.`
  );
  setText('about-value-products', `${Number(stats.products_count ?? 0)} live products are currently available in the store database.`);
  setText('about-value-brands', `${Number(stats.brands_count ?? 0)} unique fragrance brands are represented in the current catalog.`);
  setText('about-value-members', `${Number(stats.members_count ?? 0)} registered user accounts are currently stored in the platform.`);
  setText('about-value-staff', `${Number(stats.staff_count ?? 0)} admin and employee accounts are configured to manage operations.`);
  setText(
    'about-cta-copy',
    `Browse the current collection of ${Number(stats.products_count ?? 0)} fragrances or contact the store team through ${supportEmail || 'our live support records'}.`
  );
  const teamGrid = document.getElementById('about-team-grid');
  if (teamGrid) {
    const displayTeam = buildCuratedTeam(teamMembers);
    teamGrid.innerHTML = displayTeam.map(buildAboutTeamCard).join('');
    document.dispatchEvent(new CustomEvent('ab:about-team-loaded'));
  }
}

let latestStorePayload = null;

async function initStoreLive() {
  try {
    const payload = await loadStoreInfo();
    latestStorePayload = payload;
    updateSharedFooter(payload);

    if (document.getElementById('about-hero-copy')) {
      updateAboutPage(payload);
    }
  } catch (error) {
    setText('shared-footer-copy', 'Live store details are unavailable right now.');
    console.warn('[store-live] Failed to load store info:', error);
    const teamGrid = document.getElementById('about-team-grid');
    if (teamGrid) {
      teamGrid.innerHTML = buildCuratedTeam().map(buildAboutTeamCard).join('');
      document.dispatchEvent(new CustomEvent('ab:about-team-loaded'));
    }
  }
}

document.addEventListener('ab:footer-loaded', () => {
  if (latestStorePayload !== null) {
    updateSharedFooter(latestStorePayload);
  }
});

void initStoreLive();
