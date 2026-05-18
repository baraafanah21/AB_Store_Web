const Auth = (() => {
  const STAFF_LOGIN_PATH = '/admin-login.html';
  const EMPTY_SESSION_PAYLOAD = { logged_in: false, user: null, csrf_token: '' };
  let session = null;
  let csrfToken = '';
  let loaded = false;
  let sessionPromise = null;

  function notify() {
    document.dispatchEvent(new CustomEvent('ab-auth-ready', {
      detail: {
        session,
        csrfToken,
      },
    }));
  }

  function applyPayload(payload) {
    session = payload && payload.logged_in ? (payload.user || null) : null;
    csrfToken = payload && payload.csrf_token ? payload.csrf_token : '';
    loaded = true;
    notify();
  }

  async function fetchSessionPayload() {
    const response = await fetch('/api/session.php', {
      credentials: 'include',
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Unable to load session.');
    }
    return payload;
  }

  function loadSession(forceRefresh = false) {
    if (!forceRefresh && loaded) {
      return Promise.resolve(session);
    }

    if (!forceRefresh && sessionPromise) {
      return sessionPromise;
    }

    sessionPromise = (async () => {
      try {
        const payload = await fetchSessionPayload();
        applyPayload(payload);
        return session;
      } catch (error) {
        applyPayload(EMPTY_SESSION_PAYLOAD);
        return null;
      }
    })();

    return sessionPromise;
  }

  async function refreshSession() {
    return loadSession(true);
  }

  async function authAction(body) {
    if (!loaded) {
      await loadSession();
    }

    const response = await fetch('/api/auth_action.php', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        csrf_token: csrfToken,
      }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Authentication request failed.');
    }

    await refreshSession();
    return payload;
  }

  function getSession() {
    return session;
  }

  function getRole() {
    return getSession() ? session.role : null;
  }

  function isLoggedIn() {
    return getSession() !== null;
  }

  async function login(email, password) {
    const payload = await authAction({
      action: 'login',
      email,
      password,
    });

    return {
      ok: true,
      role: payload.role || session?.role || 'user',
      redirect: payload.redirect || '/index.html',
      dashboard: getDashboardPathForRole(payload.role || session?.role || 'user'),
      user: session,
    };
  }

  async function register(name, email, password, confirmPassword) {
    const payload = await authAction({
      action: 'register',
      name,
      email,
      password,
      confirm_password: confirmPassword ?? password,
    });

    return {
      ok: true,
      msg: payload.message || 'Registration created.',
      code: payload.demo_code || '',
    };
  }

  async function verifyCode(code) {
    const payload = await authAction({
      action: 'verify',
      code,
    });

    return {
      ok: true,
      msg: payload.message || 'Account verified.',
    };
  }

  function logout() {
    window.location.href = '/auth/logout.php';
  }

  function getDashboardPathForRole(role) {
    if (role === 'admin') return '/roles-dash/admin-dash.html';
    if (role === 'employee') return '/roles-dash/employee-dash.html';
    return '/index.html';
  }

  function redirectToDashboard(role = getRole()) {
    window.location.href = getDashboardPathForRole(role);
  }

  async function requireRole(allowedRoles, options = {}) {
    const redirectTo = typeof options === 'string'
      ? options
      : (options.redirectTo || '/login.html');
    const currentSession = await refreshSession();
    const role = currentSession ? currentSession.role : null;

    if (!allowedRoles.includes(role)) {
      window.location.href = redirectTo;
      return false;
    }

    return true;
  }

  function updateNavbar() {
    const currentSession = getSession();
    const authBtn = document.getElementById('navAuthBtn');
    const userMenu = document.getElementById('navUserMenu');
    const dashLink = document.getElementById('navDashLink');
    const userName = document.getElementById('navUserName');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');

    if (!authBtn) return;

    if (!currentSession) {
      authBtn.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
      if (dashLink) dashLink.style.display = 'none';
      if (mobileAuthBtn) mobileAuthBtn.style.display = 'block';
      return;
    }

    authBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (userName) userName.textContent = (currentSession.name || '').split(' ')[0] || 'User';
    if (mobileAuthBtn) mobileAuthBtn.style.display = 'none';

    if (!dashLink) return;

    if (currentSession.role === 'admin') {
      dashLink.style.display = 'flex';
      dashLink.href = getDashboardPathForRole('admin');
      dashLink.textContent = 'Admin Panel';
    } else if (currentSession.role === 'employee') {
      dashLink.style.display = 'flex';
      dashLink.href = getDashboardPathForRole('employee');
      dashLink.textContent = 'Dashboard';
    } else {
      dashLink.style.display = 'none';
    }
  }

  void loadSession();

  return {
    login,
    register,
    verifyCode,
    logout,
    getSession,
    getRole,
    isLoggedIn,
    requireRole,
    updateNavbar,
    refreshSession,
    ready: () => loadSession(),
    getDashboardPathForRole,
    redirectToDashboard,
    staffLoginPath: STAFF_LOGIN_PATH,
    getCsrfToken: () => csrfToken || document.querySelector('meta[name="csrf-token"]')?.content || '',
  };
})();

window.Auth = Auth;
