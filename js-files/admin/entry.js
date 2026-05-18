(function initAdminEntryPage() {
  const STAFF_ROLES = ['admin', 'employee'];

  function setStatus(text) {
    const status = document.getElementById('adminEntryStatus');
    if (status) status.textContent = text;
  }

  function showMessage(text) {
    const msg = document.getElementById('adminEntryMsg');
    if (!msg) return;

    msg.hidden = false;
    msg.textContent = text;
    msg.className = 'form-msg';
  }

  function showActions(primaryHref, primaryLabel) {
    const actions = document.getElementById('adminEntryActions');
    const primary = document.getElementById('primaryEntryAction');
    if (primary) {
      primary.href = primaryHref;
      primary.textContent = primaryLabel;
    }
    if (actions) {
      actions.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const session = await Auth.refreshSession();

      if (!session) {
        setStatus('No active staff session found.');
        showActions('admin-login.html', 'Open Staff Sign In');
        return;
      }

      if (STAFF_ROLES.includes(session.role)) {
        setStatus(`Redirecting to your ${session.role} dashboard…`);
        Auth.redirectToDashboard(session.role);
        return;
      }

      setStatus('This account does not have staff access.');
      showMessage('Sign in with an admin or employee account to use the staff tools.');
      showActions('admin-login.html', 'Use Staff Account');
    } catch (error) {
      setStatus('Unable to verify your session right now.');
      showMessage(error.message || 'Please try again.');
      showActions('admin-login.html', 'Open Staff Sign In');
    }
  });
})();
