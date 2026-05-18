(function () {
  const AB = (window.AB = window.AB || {});

  function sync() {
    const session = typeof Auth !== 'undefined' && Auth.getSession ? Auth.getSession() : null;

    const authBtn = document.getElementById('navAuthBtn');
    const userMenu = document.getElementById('navUserMenu');
    const userName = document.getElementById('navUserName');
    const dashLink = document.getElementById('navDashLink');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');

    if (!authBtn && !userMenu && !mobileAuthBtn) return;

    if (!session) {
      if (authBtn) authBtn.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
      if (dashLink) dashLink.style.display = 'none';
      if (mobileAuthBtn) mobileAuthBtn.style.display = 'block';
      return;
    }

    if (authBtn) authBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (mobileAuthBtn) mobileAuthBtn.style.display = 'none';
    if (userName) userName.textContent = (session.name || '').split(' ')[0] || 'User';

    if (!dashLink) return;

    if (session.role === 'admin') {
      dashLink.style.display = 'inline-flex';
      dashLink.href = 'roles-dash/admin-dash.html';
      dashLink.textContent = 'Admin Panel';
    } else if (session.role === 'employee') {
      dashLink.style.display = 'inline-flex';
      dashLink.href = 'roles-dash/employee-dash.html';
      dashLink.textContent = 'Dashboard';
    } else {
      dashLink.style.display = 'none';
    }
  }

  function init() {
    sync();
    document.addEventListener('ab-auth-ready', sync);
  }

  AB.authUi = { init, sync };
})();
