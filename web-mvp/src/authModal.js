// authModal.js — Auth modal UI controller for Dice Rush (Firebase)
import { signUp, signIn, signInWithGoogle, signOut, resetPassword } from './auth.js';

var modal        = null;
var overlay      = null;
var currentTab   = 'login';
var onAuthChange = null;
var onEntryAuth  = null;

export function initAuthModal(authChangeCallback, entryAuthCallback) {
  onAuthChange = authChangeCallback;
  onEntryAuth  = entryAuthCallback;
  modal   = document.getElementById('auth-modal');
  overlay = document.getElementById('auth-overlay');

  // ── Entry screen forms ──
  document.getElementById('entry-tab-signup').addEventListener('click', () => showEntryTab('signup'));
  document.getElementById('entry-tab-login').addEventListener('click',  () => showEntryTab('login'));
  document.getElementById('entry-signup-form').addEventListener('submit', handleEntrySignup);
  document.getElementById('entry-login-form').addEventListener('submit',  handleEntryLogin);
  document.getElementById('entry-reset-form').addEventListener('submit',  handleEntryReset);
  document.getElementById('entry-forgot-link').addEventListener('click',  () => showEntryTab('reset'));
  document.getElementById('entry-back-link').addEventListener('click',    () => showEntryTab('login'));

  // ── Google SSO buttons (entry screen) ──
  var entryGoogleBtn = document.getElementById('entry-google-btn');
  if (entryGoogleBtn) entryGoogleBtn.addEventListener('click', handleEntryGoogle);

  // ── Badge dropdown (game screen) ──
  var logoutBtn = document.getElementById('auth-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  var badge = document.getElementById('auth-badge');
  if (badge) badge.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('auth-dropdown').classList.toggle('visible');
  });
  document.addEventListener('click', function() {
    var dd = document.getElementById('auth-dropdown');
    if (dd) dd.classList.remove('visible');
  });

  // ── Floating modal (game-over guest prompt) ──
  if (modal && overlay) {
    document.getElementById('auth-tab-login').addEventListener('click',  () => showTab('login'));
    document.getElementById('auth-tab-signup').addEventListener('click', () => showTab('signup'));
    document.getElementById('auth-login-form').addEventListener('submit',  handleLogin);
    document.getElementById('auth-signup-form').addEventListener('submit', handleSignup);
    document.getElementById('auth-reset-form').addEventListener('submit',  handleReset);
    document.getElementById('auth-forgot-link').addEventListener('click',  () => showTab('reset'));
    document.getElementById('auth-back-link').addEventListener('click',    () => showTab('login'));
    overlay.addEventListener('click', hideAuthModal);
    document.getElementById('auth-close').addEventListener('click', hideAuthModal);

    // Google SSO in floating modal
    var modalGoogleBtn = document.getElementById('modal-google-btn');
    if (modalGoogleBtn) modalGoogleBtn.addEventListener('click', handleModalGoogle);
  }
}

export function showAuthModal(tab) {
  showTab(tab || 'login');
  modal.classList.add('visible');
  overlay.classList.add('visible');
}

export function hideAuthModal() {
  modal.classList.remove('visible');
  overlay.classList.remove('visible');
  clearErrors();
}

export function updateAuthUI(user) {
  var badge        = document.getElementById('auth-badge');
  var loginLinks   = document.getElementById('auth-name-links');
  var guestPrompt  = document.getElementById('auth-guest-prompt');

  if (user) {
    var username = user.displayName || user.email || '?';
    var initials = username.slice(0, 2).toUpperCase();
    if (badge)       { badge.textContent = initials; badge.classList.add('visible'); }
    if (loginLinks)  loginLinks.style.display = 'none';
    if (guestPrompt) guestPrompt.style.display = 'none';
  } else {
    if (badge)       badge.classList.remove('visible');
    if (loginLinks)  loginLinks.style.display = 'flex';
    if (guestPrompt) guestPrompt.style.display = 'flex';
  }
}

// ─── Entry screen handlers ───────────────────────────────────────────────────

function showEntryTab(tab) {
  ['signup', 'login', 'reset'].forEach(function(t) {
    var panel = document.getElementById('entry-panel-' + t);
    var btn   = document.getElementById('entry-tab-' + t);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  var card = document.querySelector('.name-card');
  if (card) card.scrollTop = 0;
  clearEntryErrors();
}

async function handleEntryGoogle() {
  clearEntryErrors();
  setEntryGoogleLoading(true);
  try {
    var user = await signInWithGoogle();
    if (onEntryAuth) onEntryAuth(user);
  } catch (err) {
    // User closed popup — not really an error
    if (err.code !== 'auth/popup-closed-by-user') {
      showEntryError('login', err.message);
    }
  } finally {
    setEntryGoogleLoading(false);
  }
}

async function handleEntrySignup(e) {
  e.preventDefault();
  clearEntryErrors();
  var username  = document.getElementById('entry-signup-username').value.trim();
  var email     = document.getElementById('entry-signup-email').value.trim();
  var password  = document.getElementById('entry-signup-password').value;
  var password2 = document.getElementById('entry-signup-password2').value;
  if (!username)              return showEntryError('signup', 'Please enter a username.');
  if (password !== password2) return showEntryError('signup', 'Passwords do not match.');
  if (password.length < 6)   return showEntryError('signup', 'Password must be at least 6 characters.');
  setEntryLoading('signup', true);
  try {
    var user = await signUp(email, password, username);
    if (onEntryAuth) onEntryAuth(user);
  } catch (err) {
    showEntryError('signup', friendlyError(err));
  } finally {
    setEntryLoading('signup', false);
  }
}

async function handleEntryLogin(e) {
  e.preventDefault();
  clearEntryErrors();
  var email    = document.getElementById('entry-login-email').value.trim();
  var password = document.getElementById('entry-login-password').value;
  setEntryLoading('login', true);
  try {
    var user = await signIn(email, password);
    if (onEntryAuth) onEntryAuth(user);
  } catch (err) {
    showEntryError('login', friendlyError(err));
  } finally {
    setEntryLoading('login', false);
  }
}

async function handleEntryReset(e) {
  e.preventDefault();
  clearEntryErrors();
  var email = document.getElementById('entry-reset-email').value.trim();
  setEntryLoading('reset', true);
  try {
    await resetPassword(email);
    showEntryError('reset', 'Password reset email sent — check your inbox.', 'good');
  } catch (err) {
    showEntryError('reset', friendlyError(err));
  } finally {
    setEntryLoading('reset', false);
  }
}

function showEntryError(form, msg, type) {
  var el = document.getElementById('entry-' + form + '-error');
  if (el) { el.textContent = msg; el.className = 'auth-error' + (type === 'good' ? ' auth-success' : ''); }
}

function clearEntryErrors() {
  ['signup', 'login', 'reset'].forEach(function(f) {
    var el = document.getElementById('entry-' + f + '-error');
    if (el) { el.textContent = ''; el.className = 'auth-error'; }
  });
}

function setEntryLoading(form, loading) {
  var btn = document.getElementById('entry-' + form + '-submit');
  if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Please wait…' : btn.dataset.label; }
}

function setEntryGoogleLoading(loading) {
  var btn = document.getElementById('entry-google-btn');
  if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Signing in…' : 'Continue with Google'; }
}

// ─── Floating modal handlers ──────────────────────────────────────────────────

async function handleModalGoogle() {
  clearErrors();
  try {
    var user = await signInWithGoogle();
    hideAuthModal();
    if (onAuthChange) onAuthChange(user);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showError('login', err.message);
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearErrors();
  var email    = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  setLoading('login', true);
  try {
    var user = await signIn(email, password);
    hideAuthModal();
    if (onAuthChange) onAuthChange(user);
  } catch (err) {
    showError('login', friendlyError(err));
  } finally {
    setLoading('login', false);
  }
}

async function handleSignup(e) {
  e.preventDefault();
  clearErrors();
  var username  = document.getElementById('signup-username').value.trim();
  var email     = document.getElementById('signup-email').value.trim();
  var password  = document.getElementById('signup-password').value;
  var password2 = document.getElementById('signup-password2').value;

  if (!username) return showError('signup', 'Please enter a username.');
  if (password !== password2) return showError('signup', 'Passwords do not match.');
  if (password.length < 6) return showError('signup', 'Password must be at least 6 characters.');

  setLoading('signup', true);
  try {
    var user = await signUp(email, password, username);
    hideAuthModal();
    if (onAuthChange) onAuthChange(user);
  } catch (err) {
    showError('signup', friendlyError(err));
  } finally {
    setLoading('signup', false);
  }
}

async function handleReset(e) {
  e.preventDefault();
  clearErrors();
  var email = document.getElementById('reset-email').value.trim();
  setLoading('reset', true);
  try {
    await resetPassword(email);
    showError('reset', 'Password reset email sent — check your inbox.', 'good');
  } catch (err) {
    showError('reset', friendlyError(err));
  } finally {
    setLoading('reset', false);
  }
}

async function handleLogout() {
  try {
    await signOut();
    if (onAuthChange) onAuthChange(null);
    document.getElementById('auth-dropdown').classList.remove('visible');
    var screenGame = document.getElementById('screen-game');
    var screenName = document.getElementById('screen-name');
    if (screenGame) screenGame.classList.remove('active');
    if (screenName) screenName.classList.add('active');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showTab(tab) {
  currentTab = tab;
  ['login', 'signup', 'reset'].forEach(function(t) {
    var panel = document.getElementById('auth-panel-' + t);
    var btn   = document.getElementById('auth-tab-' + t);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  clearErrors();
}

function showError(form, msg, type) {
  var el = document.getElementById(form + '-error');
  if (el) {
    el.textContent = msg;
    el.className   = 'auth-error' + (type === 'good' ? ' auth-success' : '');
  }
}

function clearErrors() {
  ['login', 'signup', 'reset'].forEach(function(f) {
    var el = document.getElementById(f + '-error');
    if (el) { el.textContent = ''; el.className = 'auth-error'; }
  });
}

function setLoading(form, loading) {
  var btn = document.getElementById(form + '-submit');
  if (btn) {
    btn.disabled     = loading;
    btn.textContent  = loading ? 'Please wait…' : btn.dataset.label;
  }
}

// Convert Firebase error codes to friendly messages
function friendlyError(err) {
  switch (err.code) {
    case 'auth/email-already-in-use':    return 'That email is already registered.';
    case 'auth/invalid-email':           return 'Please enter a valid email address.';
    case 'auth/weak-password':           return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':          return 'No account found with that email.';
    case 'auth/wrong-password':          return 'Incorrect password.';
    case 'auth/invalid-credential':      return 'Incorrect email or password.';
    case 'auth/too-many-requests':       return 'Too many attempts — please try again later.';
    case 'auth/network-request-failed':  return 'Network error — check your connection.';
    default:                             return err.message;
  }
}
