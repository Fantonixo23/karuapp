const API = '/api';

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
  const tabBtn = tab === 'login' ? document.querySelector('.tab:first-child') : document.querySelector('.tab:last-child');
  tabBtn.classList.add('active');
  document.getElementById(tab + 'Form').classList.add('active');
  hideError();
  hideSuccess();
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.add('show');
}

function hideError() {
  document.getElementById('errorMsg').classList.remove('show');
}

function showSuccess(msg) {
  const el = document.getElementById('successMsg');
  el.textContent = msg;
  el.classList.add('show');
}

function hideSuccess() {
  document.getElementById('successMsg').classList.remove('show');
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? '' : (btnId === 'loginBtn' ? 'Ingresar' : 'Crear cuenta');
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('registerBtn').addEventListener('click', doRegister);
});

async function doLogin(e) {
  e.preventDefault();
  hideError();
  hideSuccess();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) {
    showError('Completá todos los campos');
    return;
  }
  setLoading('loginBtn', true);
  try {
    const res = await fetch(API + '/auth/login-saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      showSuccess('Iniciando sesión...');
      setTimeout(function() { window.location.href = '/app/'; }, 500);
    } else {
      showError(data.error || 'Error al iniciar sesión');
    }
  } catch (e) {
    showError('Error de conexión');
  }
  setLoading('loginBtn', false);
}

async function doRegister(e) {
  e.preventDefault();
  hideError();
  hideSuccess();
  const nombre = document.getElementById('regNombre').value.trim();
  const nombreUser = document.getElementById('regNombreUser').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;
  if (!nombre || !nombreUser || !email || !password) {
    showError('Completá todos los campos');
    return;
  }
  if (password !== password2) {
    showError('Las contraseñas no coinciden');
    return;
  }
  setLoading('registerBtn', true);
  try {
    const res = await fetch(API + '/auth/register-saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_restaurante: nombre, nombre: nombreUser, email, password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      showSuccess('Cuenta creada. Redirigiendo...');
      setTimeout(function() { window.location.href = '/app/'; }, 800);
    } else {
      showError(data.error || 'Error al crear cuenta');
    }
  } catch (e) {
    showError('Error de conexión');
  }
  setLoading('registerBtn', false);
}

// Check if already logged in
fetch(API + '/auth/me', { credentials: 'include' })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.authenticated) window.location.href = '/app/';
  })
  .catch(function() {});