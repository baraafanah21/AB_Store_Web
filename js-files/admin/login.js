(function initStaffLoginPage() {
  const STAFF_ROLES = ['admin', 'employee'];

  function showMessage(text, kind = 'error') {
    const msg = document.getElementById('msg');
    if (!msg) return;

    msg.hidden = false;
    msg.textContent = text;
    msg.className = `form-msg ${kind}`.trim();
  }

  async function redirectIfAlreadySignedIn() {
    const session = await Auth.refreshSession();
    if (session && STAFF_ROLES.includes(session.role)) {
      Auth.redirectToDashboard(session.role);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await redirectIfAlreadySignedIn();

    const form = document.getElementById('staffLoginForm');
    const button = document.getElementById('submitBtn');
    if (!form || !button) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const originalLabel = button.innerHTML;
      const msg = document.getElementById('msg');

      if (msg) msg.hidden = true;
      button.disabled = true;
      button.innerHTML = '<i class="bi bi-hourglass-split"></i> Signing in…';

      try {
        const result = await Auth.login(email, password);
        if (!STAFF_ROLES.includes(result.role)) {
          Auth.logout();
          return;
        }

        window.location.href = result.dashboard || result.redirect;
      } catch (error) {
        showMessage(error.message || 'Sign-in failed.');
        button.disabled = false;
        button.innerHTML = originalLabel;
      }
    });
  });
})();
