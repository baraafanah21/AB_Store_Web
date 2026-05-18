let authCsrfToken = '';

async function loadAuthSession() {
  const response = await fetch('/api/session.php', {
    credentials: 'include',
  });
  const payload = await response.json();
  authCsrfToken = payload.csrf_token || '';

  if (payload.logged_in && payload.user) {
    const role = payload.user.role || 'user';
    window.location.href = role === 'admin'
      ? '/roles-dash/admin-dash.html'
      : role === 'employee'
        ? '/roles-dash/employee-dash.html'
        : '/index.html';
  }
}

function switchTab(name, idx) {
  document.querySelectorAll('.tab').forEach((tab, index) => tab.classList.toggle('active', index === idx));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
  const map = {
    login: 'panelLogin',
    register: 'panelRegister',
    verify: 'panelVerify',
    forgotRequest: 'panelForgotRequest',
    resetPassword: 'panelResetPassword',
  };
  document.getElementById(map[name]).classList.add('active');
  positionIndicator(idx);
}

function positionIndicator(idx) {
  const tabs = document.querySelectorAll('.tab');
  const indicator = document.getElementById('tabIndicator');
  if (idx >= tabs.length || idx < 0) {
    indicator.style.width = '0';
    return;
  }
  const tab = tabs[idx];
  indicator.style.left = `${tab.offsetLeft}px`;
  indicator.style.width = `${tab.offsetWidth}px`;
}

window.addEventListener('resize', () => {
  const activeIdx = [...document.querySelectorAll('.tab')].findIndex((tab) => tab.classList.contains('active'));
  if (activeIdx >= 0) positionIndicator(activeIdx);
});

function msg(id, text, type) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = `form-msg ${type}`;
}

function clearMsg(id) {
  const element = document.getElementById(id);
  element.textContent = '';
  element.className = 'form-msg';
}

function togglePwd(id, btn) {
  const input = document.getElementById(id);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'bi bi-eye';
  }
}

async function authRequest(payload) {
  const response = await fetch('/api/auth_action.php', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      csrf_token: authCsrfToken,
    }),
  });

  const json = await response.json();
  return { response, json };
}

async function doLogin() {
  clearMsg('loginMsg');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    msg('loginMsg', 'Please fill in all fields.', 'error');
    return;
  }

  const button = document.querySelector('#panelLogin .btn-submit');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'Signing In...';

  try {
    const { response, json } = await authRequest({
      action: 'login',
      email,
      password,
    });

    if (!response.ok || !json.success) {
      msg('loginMsg', json.error || 'Sign-in failed.', 'error');
      return;
    }

    window.location.href = json.redirect || '/index.html';
  } catch (error) {
    msg('loginMsg', 'Sign-in failed. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function fillAndLogin(email, password) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = password;
  switchTab('login', 0);
  setTimeout(() => { void doLogin(); }, 120);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.getElementById('panelLogin').classList.contains('active')) {
    void doLogin();
  }
});

async function doForgotPassword() {
  clearMsg('forgotMsg');
  const email = document.getElementById('forgotEmail').value.trim();

  if (!email) {
    msg('forgotMsg', 'Please enter your email address.', 'error');
    return;
  }

  const button = document.getElementById('forgotBtn');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'Sending...';

  try {
    const { response, json } = await authRequest({
      action: 'forgot_password',
      email,
    });

    if (!response.ok || !json.success) {
      msg('forgotMsg', json.error || 'Unable to send reset code.', 'error');
      return;
    }

    document.getElementById('resetEmail').value = email;
    switchTab('resetPassword', -1);
    document.getElementById('rp0').focus();
    msg('resetMsg', json.message || 'If that email is registered, a reset code has been sent.', 'success');
  } catch (error) {
    msg('forgotMsg', 'Unable to send reset code. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function doRegister() {
  clearMsg('registerMsg');
  const first = document.getElementById('regFirst').value.trim();
  const last = document.getElementById('regLast').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!first || !last || !email || !password || !confirm) {
    msg('registerMsg', 'Please fill in all fields.', 'error');
    return;
  }

  const button = document.getElementById('regBtn');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'Creating Account...';

  try {
    const { response, json } = await authRequest({
      action: 'register',
      name: `${first} ${last}`.trim(),
      email,
      password,
      confirm_password: confirm,
    });

    if (!response.ok || !json.success) {
      msg('registerMsg', json.error || 'Registration failed.', 'error');
      return;
    }

    switchTab('verify', -1);
    document.getElementById('c0').focus();
    msg('verifyMsg', json.demo_code ? `Verification code: ${json.demo_code}` : 'Enter the verification code sent to your email.', 'success');
  } catch (error) {
    msg('registerMsg', 'Registration failed. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function codeType(i, prefix = 'c') {
  const element = document.getElementById(`${prefix}${i}`);
  if (element.value) {
    element.classList.add('filled');
    if (i < 5) document.getElementById(`${prefix}${i + 1}`).focus();
  }
}

function codeDel(i, event, prefix = 'c') {
  if (event.key === 'Backspace' && !document.getElementById(`${prefix}${i}`).value && i > 0) {
    document.getElementById(`${prefix}${i - 1}`).focus();
  }
}

async function doVerify() {
  clearMsg('verifyMsg');
  const code = [0, 1, 2, 3, 4, 5].map((i) => document.getElementById(`c${i}`).value).join('');
  if (code.length < 6) {
    msg('verifyMsg', 'Please enter all 6 digits.', 'error');
    return;
  }

  const button = document.querySelector('#panelVerify .btn-submit');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'Verifying...';

  try {
    const { response, json } = await authRequest({
      action: 'verify',
      code,
    });

    if (!response.ok || !json.success) {
      msg('verifyMsg', json.error || 'Verification failed.', 'error');
      return;
    }

    msg('verifyMsg', 'Account verified. You can now sign in.', 'success');
    setTimeout(() => switchTab('login', 0), 900);
  } catch (error) {
    msg('verifyMsg', 'Verification failed. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function doResetPassword() {
  clearMsg('resetMsg');
  const email = document.getElementById('resetEmail').value.trim();
  const code = [0, 1, 2, 3, 4, 5].map((i) => document.getElementById(`rp${i}`).value).join('');
  const password = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetConfirm').value;

  if (!email || code.length < 6 || !password || !confirm) {
    msg('resetMsg', 'Please complete all reset fields.', 'error');
    return;
  }

  const button = document.getElementById('resetBtn');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'Updating...';

  try {
    const { response, json } = await authRequest({
      action: 'reset_password',
      email,
      code,
      password,
      confirm_password: confirm,
    });

    if (!response.ok || !json.success) {
      msg('resetMsg', json.error || 'Password reset failed.', 'error');
      return;
    }

    msg('resetMsg', json.message || 'Password updated. You can now sign in.', 'success');
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = '';
    setTimeout(() => switchTab('login', 0), 900);
  } catch (error) {
    msg('resetMsg', 'Password reset failed. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let pts = [];

function resize() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
resize();
window.addEventListener('resize', resize);

function spawn() {
  return {
    x: Math.random() * canvas.width,
    y: canvas.height + 5,
    r: Math.random() * 1.5 + .5,
    vx: (Math.random() - .5) * .4,
    vy: -(Math.random() * .8 + .3),
    life: 0,
    max: Math.random() * 180 + 100,
  };
}

const particlesEnabled = window.matchMedia('(min-width: 601px)').matches;
if (particlesEnabled) {
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pts.length < 45) pts.push(spawn());
    pts = pts.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      const alpha = (1 - p.life / p.max) * .55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,169,110,${alpha})`;
      ctx.fill();
      return p.life < p.max;
    });
    requestAnimationFrame(tick);
  })();
}

document.addEventListener('DOMContentLoaded', async () => {
  positionIndicator(0);
  await loadAuthSession();
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'register') {
    switchTab('register', 1);
  } else if (params.get('tab') === 'verify') {
    switchTab('verify', -1);
  } else if (params.get('tab') === 'forgot') {
    switchTab('forgotRequest', -1);
  }
});
