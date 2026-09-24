/* ═══════════════════════════════════════════
   READIFY ADMIN — admin.js
   API_BASE: http://localhost:5000/api
═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   READIFY ADMIN — JAVASCRIPT
   All real API connections from admin.js preserved.
   API_BASE: 'http://localhost:5000/api'
═══════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:5000/api';
const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_EMAIL_KEY = 'adminEmail';
let token = localStorage.getItem(ADMIN_TOKEN_KEY);
let currentView = 'dashboard';
let timeFmt = '12h';

// cache loaded data for tables/search
let _allUsers = [];
let _allBooks = [];
let _bookSearchQuery = '';
let _bookSectionFilter = 'all';
let _userSearchQuery = '';
let _userStatusFilter = 'all';
let _userRoleFilter = 'all';
let _userSortMode = 'recent';
let _refundRequests = [];

// Support chat realtime state
let supportSocket = null;
let supportConversations = [];
let activeSupportConversationId = '';
let selectedSupportAgent = '';
let supportMediaRecorder = null;
let supportVoiceChunks = [];
let supportVoiceStream = null;
let supportVoiceRecordingStart = 0;
const supportVoicePlayers = new Map();
let scrollGlideObserver = null;
let scrollGlideMutationObserver = null;
let scrollGlideRefreshTimer = null;
const SCROLL_GLIDE_ITEM_SELECTOR = [
  '.stat-card',
  '.chart-card',
  '.table-card',
  '.metric-card',
  '.settings-card',
  '.user-insight-card',
  '.book-highlight-card',
  '.activity-item',
  '.support-sidebar',
  '.support-chat-main'
].join(',');

/* ══════════════ INIT ══════════════ */
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
  }
  startClock();
  initScrollGlidePopAnimation();
  initNotifs();
  if (token) {
    validateAdminSession();
  } else {
    showLogin();
  }
});

async function parseApiError(res, fallback = 'Request failed') {
  try {
    const data = await res.json();
    return data?.message || fallback;
  } catch (_) {
    return fallback;
  }
}

async function validateAdminSession() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_EMAIL_KEY);
      token = null;
      showLogin();
      showLoginError('Admin session expired. Please login again.');
      return;
    }

    showAdmin();
  } catch (err) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    token = null;
    showLogin();
    showLoginError('Unable to verify admin session. Please login again.');
  }
}

/* ══════════════ LOGIN ══════════════ */
function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('adminSection').classList.remove('active');
}

/* ══════════════ LOGIN HANDLER ══════════════ */
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';

  // Show loading state
  btn.classList.add('loading');

  fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
    .then(res => res.json())
    .then(data => {
      btn.classList.remove('loading');
      if (data.status === 'success') {
        // Store token and email
        token = data.token;
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        localStorage.setItem(ADMIN_EMAIL_KEY, email);
        if (document.getElementById('loginForm')) document.getElementById('loginForm').reset();
        showAdmin();
      } else {
        showLoginError(data.message || 'Invalid credentials. Please try again.');
      }
    })
    .catch(err => {
      btn.classList.remove('loading');
      console.error(err);
      showLoginError('Unable to reach the server. Please check your connection and try again.');
    });
}

function showLoginError(msg) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = msg;
  errorDiv.style.display = 'flex';
}

function togglePw() {
  const pw = document.getElementById('password');
  const eyeOpen = document.getElementById('pwEyeOpen');
  const eyeClosed = document.getElementById('pwEyeClosed');
  if (pw.type === 'password') {
    pw.type = 'text';
    eyeOpen.style.display = 'none';
    eyeClosed.style.display = 'block';
  } else {
    pw.type = 'password';
    eyeOpen.style.display = 'block';
    eyeClosed.style.display = 'none';
  }
}

/* ══════════════ SHOW ADMIN ══════════════ */
function showAdmin() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('adminSection').classList.add('active');
  loadDashboard();
  initCharts();
  startUserPolling();
  initSupportSocket();
  requestAnimationFrame(() => {
    replayActiveViewGlidePopAnimation();
    refreshScrollGlidePopAnimation();
  });
}

function logout() {
  if (!confirm('Are you sure you want to logout?')) return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
  token = null;
  stopUserPolling();
  if (supportSocket) {
    supportSocket.disconnect();
    supportSocket = null;
  }
  stopSupportVoiceRecording(true);
  if (document.getElementById('emailForm')) document.getElementById('emailForm').reset();
  if (document.getElementById('otpForm')) document.getElementById('otpForm').reset();
  if (document.getElementById('passwordForm')) document.getElementById('passwordForm').reset();
  killCharts();
  showLogin();
}

/* ══════════════ MOBILE SIDEBAR TOGGLE ══════════════ */
function toggleMobileSidebar() {
  document.querySelector('.sidebar').classList.toggle('mobile-open');
  document.getElementById('sidebar-backdrop').classList.toggle('visible');
}
function closeMobileSidebar() {
  document.querySelector('.sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

/* ══════════════ NAV ══════════════ */
function goTo(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + page).classList.add('active');
  currentView = page;
  const T = { dashboard: 'Dashboard', users: 'User Management', books: 'Book Catalog', activities: 'Activity Log', analytics: 'Analytics', support: 'Support Chat', settings: 'Settings' };
  document.getElementById('topbar-title').textContent = T[page] || page;

  // Close sidebar on mobile after navigation
  closeMobileSidebar();

  if (page === 'users') loadUsers();
  if (page === 'books') loadBooks();
  if (page === 'analytics') { initAnalyticsCharts(); if (_allBooks.length) loadAnalyticsCharts(); else loadBooks().then(loadAnalyticsCharts); }
  if (page === 'activities') loadRefundRequests();
  if (page === 'support') renderSupportRequests();
  requestAnimationFrame(() => {
    replayActiveViewGlidePopAnimation();
    refreshScrollGlidePopAnimation(document.getElementById('view-' + page));
  });
}

function initScrollGlidePopAnimation() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll(SCROLL_GLIDE_ITEM_SELECTOR).forEach(el => {
      el.classList.add('scroll-glide-item', 'in-view', 'sg-seen');
    });
    return;
  }

  const scrollRoot = document.querySelector('.content');
  scrollGlideObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view', 'sg-seen');
        scrollGlideObserver.unobserve(entry.target);
      });
    },
    {
      root: scrollRoot || null,
      threshold: 0.14,
      rootMargin: '0px 0px -8% 0px'
    }
  );

  if (scrollRoot && !scrollGlideMutationObserver) {
    scrollGlideMutationObserver = new MutationObserver(() => {
      clearTimeout(scrollGlideRefreshTimer);
      scrollGlideRefreshTimer = setTimeout(() => {
        refreshScrollGlidePopAnimation(scrollRoot);
      }, 50);
    });
    scrollGlideMutationObserver.observe(scrollRoot, { childList: true, subtree: true });
  }
}

function refreshScrollGlidePopAnimation(scope = document) {
  const items = scope.querySelectorAll(SCROLL_GLIDE_ITEM_SELECTOR);
  let staggerIndex = 0;

  items.forEach(item => {
    if (item.classList.contains('sg-seen')) return;
    item.classList.add('scroll-glide-item');
    item.style.setProperty('--sg-delay', `${Math.min(staggerIndex, 8) * 55}ms`);
    staggerIndex += 1;
    if (scrollGlideObserver) {
      scrollGlideObserver.observe(item);
    } else {
      item.classList.add('in-view', 'sg-seen');
    }
  });
}

function replayActiveViewGlidePopAnimation() {
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;

  activeView.querySelectorAll(SCROLL_GLIDE_ITEM_SELECTOR).forEach(item => {
    item.classList.remove('scroll-glide-item', 'in-view', 'sg-seen');
    item.style.removeProperty('--sg-delay');
  });

  // Force reflow so transitions replay after class reset.
  void activeView.offsetWidth;
}

/* ══════════════ LOAD DASHBOARD ══════════════ */
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Failed to load dashboard');
      throw new Error(msg);
    }
    const data = await res.json();
    const tu = data.totalUsers || 0;
    const tb = data.totalBooks || 0;
    const to = data.totalOrders || 0;
    const pr = data.pendingRefundRequests || 0;
    document.getElementById('sv-users').textContent = tu.toLocaleString();
    document.getElementById('sv-books').textContent = tb.toLocaleString();
    const oe = document.getElementById('sv-orders'); if (oe) oe.textContent = to.toLocaleString();
    const re = document.getElementById('sv-refunds'); if (re) re.textContent = pr.toLocaleString();
    document.getElementById('nb-u').textContent = tu;
    document.getElementById('nb-b').textContent = tb;
    // Seed counts for polling (first load only)
    if (_lastUserCount === null) _lastUserCount = tu;
    if (_lastBookCount === null) _lastBookCount = tb;
    if (_lastOrderCount === null) _lastOrderCount = to;
    if (_lastPendingRefundCount === null) _lastPendingRefundCount = pr;
    if (_lastLoginTime === null) _lastLoginTime = data.lastLoginTime || null;
  } catch (err) {
    console.error('Dashboard error:', err);
    document.getElementById('sv-users').textContent = '—';
    document.getElementById('sv-books').textContent = '—';
  }
}

function refreshData() {
  loadDashboard();
  if (currentView === 'users') loadUsers();
  if (currentView === 'books') loadBooks();
  if (currentView === 'activities') loadRefundRequests();
  if (currentView === 'analytics') loadAnalyticsCharts();
  showToast('↻ Data refreshed', 'info');
}

function formatRefundDetails(r) {
  const d = r?.refundDetailsRequested || {};
  const method = String(r?.refundMethodRequested || '').toLowerCase();
  if (method === 'upi') return d.upiId || '—';
  if (method === 'debit' || method === 'credit') return d.cardLast4 ? `•••• ${d.cardLast4}` : '—';
  if (method === 'netbanking') return d.accountNumber ? `A/C ${String(d.accountNumber).slice(-4)} • ${d.ifsc || ''}` : '—';
  if (method === 'wallet') return d.walletType && d.walletMobile ? `${d.walletType} • ${d.walletMobile}` : (d.walletType || d.walletMobile || '—');
  return '—';
}

async function loadRefundRequests() {
  const tbody = document.getElementById('refunds-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">Loading…</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/refunds/requests`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await parseApiError(res, 'Failed to load refund requests'));

    const data = await res.json();
    _refundRequests = Array.isArray(data.requests) ? data.requests : [];

    if (_refundRequests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">No pending refund requests</td></tr>';
      return;
    }

    tbody.innerHTML = _refundRequests.map((r) => `
      <tr>
        <td>
          <div style="font-weight:600">${r.userName || 'User'}</div>
          <div class="cell-sub">${r.userEmail || ''}</div>
        </td>
        <td>
          <div style="font-weight:600" title="${r.title || ''}">${r.title || 'Untitled'}</div>
          <div class="cell-sub">${r.author || 'Unknown'} • ${r.invoiceNumber || ''}</div>
        </td>
        <td class="cell-truncate" title="${r.cancelReason || ''}">${r.cancelReason || '—'}</td>
        <td>
          <select id="rm-${r.orderId}-${r.bookId}" class="btn btn-outline btn-sm" style="padding:6px 10px;outline:none;cursor:pointer">
            ${['upi', 'debit', 'credit', 'netbanking', 'wallet'].map(m => `<option value="${m}" ${String(r.refundMethodRequested || '').toLowerCase() === m ? 'selected' : ''}>${m.toUpperCase()}</option>`).join('')}
          </select>
          <div class="cell-sub" style="margin-top:4px" title="${formatRefundDetails(r)}">${formatRefundDetails(r)}</div>
        </td>
        <td>${r.cancelRequestedAt ? new Date(r.cancelRequestedAt).toLocaleString() : '—'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="action-btn edit" onclick="approveRefundRequest('${r.orderId}','${r.bookId}')">✓ Approve</button>
            <button class="action-btn del" onclick="rejectRefundRequest('${r.orderId}','${r.bookId}')">✕ Reject</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

async function approveRefundRequest(orderId, bookId) {
  const methodEl = document.getElementById(`rm-${orderId}-${bookId}`);
  const refundMethod = (methodEl?.value || 'upi').toLowerCase();

  if (!confirm('Approve this refund request and cancel the purchased book?')) return;

  try {
    const res = await fetch(`${API_BASE}/admin/refunds/${orderId}/items/${bookId}/approve`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refundMethod }),
    });
    if (!res.ok) throw new Error(await parseApiError(res, 'Failed to approve refund request'));

    showToast('✅ Refund approved and cancellation completed', 'success');
    _pushNotif('Refund approved', 'A cancellation request has been approved', 'order');
    await loadRefundRequests();
    await loadDashboard();
    if (currentView === 'analytics') await loadAnalyticsCharts();
  } catch (err) {
    showToast(`⚠ ${err.message}`, 'error');
  }
}

async function rejectRefundRequest(orderId, bookId) {
  const reason = prompt('Enter rejection reason:');
  if (!reason || reason.trim().length < 3) {
    showToast('⚠ Rejection reason is required', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/refunds/${orderId}/items/${bookId}/reject`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (!res.ok) throw new Error(await parseApiError(res, 'Failed to reject refund request'));

    showToast('ℹ Refund request rejected', 'info');
    _pushNotif('Refund rejected', 'A cancellation request has been rejected', 'system');
    await loadRefundRequests();
    await loadDashboard();
    if (currentView === 'analytics') await loadAnalyticsCharts();
  } catch (err) {
    showToast(`⚠ ${err.message}`, 'error');
  }
}

/* ══════════════ LOAD USERS ══════════════ */
let uPage = 1;
const PER = 10;
const COLORS = ['#f59e0b', '#22c55e', '#24f0e0', '#c2440e', '#a78bfa', '#ef4444'];

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">Loading…</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Failed to load users');
      throw new Error(msg);
    }
    const users = await res.json();
    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">No users found</td></tr>';
      return;
    }
    _allUsers = users;
    renderUserInsights(_allUsers);
    applyUsersFilters();
  } catch (err) {
    console.error('Users error:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

function renderUserInsights(users) {
  const wrap = document.getElementById('users-insights');
  if (!wrap || !Array.isArray(users)) return;

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const total = users.length;
  const active = users.filter(u => u.enabled !== false).length;
  const admins = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;
  const newWeek = users.filter(u => {
    const created = new Date(u.createdAt || 0).getTime();
    return created && (now - created) <= weekMs;
  }).length;

  wrap.innerHTML = `
    <div class="user-insight-card">
      <div class="ui-label">Total Users</div>
      <div class="ui-value">${total}</div>
      <div class="ui-sub">All registered accounts</div>
    </div>
    <div class="user-insight-card">
      <div class="ui-label">Active Users</div>
      <div class="ui-value">${active}</div>
      <div class="ui-sub">Enabled user accounts</div>
    </div>
    <div class="user-insight-card">
      <div class="ui-label">Admins</div>
      <div class="ui-value">${admins}</div>
      <div class="ui-sub">Accounts with admin role</div>
    </div>
    <div class="user-insight-card">
      <div class="ui-label">New This Week</div>
      <div class="ui-value">${newWeek}</div>
      <div class="ui-sub">Joined in last 7 days</div>
    </div>
  `;
}

function applyUsersFilters() {
  let list = [..._allUsers];
  const q = (_userSearchQuery || '').trim().toLowerCase();

  if (q) {
    list = list.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }

  if (_userStatusFilter === 'active') list = list.filter(u => u.enabled !== false);
  if (_userStatusFilter === 'inactive') list = list.filter(u => u.enabled === false);

  if (_userRoleFilter !== 'all') {
    list = list.filter(u => (u.role || 'user').toLowerCase() === _userRoleFilter);
  }

  if (_userSortMode === 'recent') {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (_userSortMode === 'oldest') {
    list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (_userSortMode === 'name-az') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (_userSortMode === 'name-za') {
    list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  }

  renderUsersTable(list);
}

function renderUsersTable(data, pg = 1) {
  uPage = pg;
  const tbody = document.getElementById('users-tbody');
  const start = (pg - 1) * PER;
  const slice = data.slice(start, start + PER);
  if (slice.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">No results</td></tr>';
    document.getElementById('users-count').textContent = 'No users';
    document.getElementById('users-pg').innerHTML = '';
    return;
  }
  tbody.innerHTML = slice.map((u, i) => {
    const idx = (start + i) % COLORS.length;
    const ini = (u.name || u.email || '?').charAt(0).toUpperCase();
    const idShort = (u._id || String(u.id || '')).substring(0, 8) + '…';
    return `<tr>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--text2)">${idShort}</span></td>
      <td><div class="user-cell"><div class="u-avatar" style="background:${COLORS[idx]}">${ini}</div><div><div style="font-weight:500">${u.name || '—'}</div><div class="cell-sub">${u.email}</div></div></div></td>
      <td><span class="cell-sub">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</span></td>
      <td><strong>${u.purchasedBooks?.length || 0}</strong></td>
      <td><span class="badge badge-active">Active</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="action-btn del" onclick="deleteUser('${u._id}')">🗑 Delete</button>
      </div></td>
    </tr>`;
  }).join('');
  makePagination('users-pg', data.length, PER, pg, p => renderUsersTable(data, p));
  document.getElementById('users-count').textContent = `Showing ${slice.length} of ${data.length} users`;
}

function filterUsersTable(q) {
  _userSearchQuery = q || '';
  applyUsersFilters();
}
function filterUserStatus(s) {
  _userStatusFilter = (s || 'all').toLowerCase();
  applyUsersFilters();
}
function filterUserRole(role) {
  _userRoleFilter = (role || 'all').toLowerCase();
  applyUsersFilters();
}
function sortUsersSection(mode) {
  _userSortMode = mode || 'recent';
  applyUsersFilters();
}

/* ══════════════ DELETE USER ══════════════ */
async function deleteUser(userId) {
  if (!confirm('Delete this user permanently?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showMsg('msg-users', 'User deleted successfully.', 'success');
      showToast('🗑 User deleted', 'success');
      loadUsers();
      loadDashboard();
    } else {
      const d = await res.json();
      showMsg('msg-users', d.message || 'Error deleting user.', 'error');
      showToast('⚠ Delete failed', 'error');
    }
  } catch (err) {
    showMsg('msg-users', 'Error: ' + err.message, 'error');
    showToast('⚠ ' + err.message, 'error');
  }
}

/* ══════════════ LOAD BOOKS ══════════════ */
let bPage = 1;

async function loadBooks() {
  const tbody = document.getElementById('books-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2)">Loading…</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/admin/books`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Failed to load books');
      throw new Error(msg);
    }
    const books = await res.json();
    if (!Array.isArray(books) || books.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2)">No books found</td></tr>';
      return;
    }
    _allBooks = books;
    renderBookHighlights(_allBooks);
    applyBooksFilters();
  } catch (err) {
    console.error('Books error:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

function coverSrcForBook(book) {
  const rawCover = book?.coverUrl || '';
  if (!rawCover) return '';
  return rawCover.startsWith('/') ? `http://localhost:5000${rawCover}` : rawCover;
}

function pickTopBook(books, metric) {
  if (!Array.isArray(books) || books.length === 0) return null;
  const list = [...books];
  if (metric === 'recent') {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (metric === 'purchased') {
    list.sort((a, b) => Number(b.purchaseCount || 0) - Number(a.purchaseCount || 0));
  } else if (metric === 'rated') {
    list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  }
  return list[0] || null;
}

function renderBookHighlights(books) {
  const wrap = document.getElementById('books-highlights');
  if (!wrap) return;

  if (!Array.isArray(books) || books.length === 0) {
    wrap.innerHTML = `<div class="book-highlight-card empty"><div class="bh-title">No books available yet</div><div class="bh-meta">Add books to see dynamic highlights.</div></div>`;
    return;
  }

  const recent = pickTopBook(books, 'recent');
  const purchased = pickTopBook(books, 'purchased');
  const rated = pickTopBook(books, 'rated');

  const cards = [
    {
      key: 'recent',
      label: 'Recently Uploaded',
      icon: '🆕',
      book: recent,
      stat: recent?.createdAt ? new Date(recent.createdAt).toLocaleDateString() : 'Recently added'
    },
    {
      key: 'purchased',
      label: 'Most Purchased',
      icon: '🔥',
      book: purchased,
      stat: `${Number(purchased?.purchaseCount || 0)} purchases`
    },
    {
      key: 'rated',
      label: 'Top Rated',
      icon: '⭐',
      book: rated,
      stat: `${Number(rated?.rating || 0).toFixed(1)} rating`
    }
  ];

  wrap.innerHTML = cards.map(({ key, label, icon, book, stat }) => {
    if (!book) {
      return `<div class="book-highlight-card ${key}"><div class="bh-label">${label}</div><div class="bh-title">No data</div><div class="bh-meta">Not enough catalog data</div></div>`;
    }

    const cover = coverSrcForBook(book);
    const category = book.category?.name || book.category || 'Uncategorized';
    const imageStyle = cover ? `style="background-image:url('${cover.replace(/'/g, "%27")}')"` : '';
    return `
      <div class="book-highlight-card ${key}">
        <div class="bh-cover" ${imageStyle}></div>
        <div class="bh-overlay"></div>
        <div class="bh-content">
          <div class="bh-label">${icon} ${label}</div>
          <div class="bh-title" title="${book.title || ''}">${book.title || 'Untitled'}</div>
          <div class="bh-meta">${book.author || 'Unknown author'} • ${category}</div>
          <div class="bh-stat">${stat}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getBookSortValue(book, key) {
  if (key === 'recent') return new Date(book.createdAt || 0).getTime();
  if (key === 'purchased') return Number(book.purchaseCount ?? book.views ?? 0);
  if (key === 'rated') return Number(book.rating ?? 0);
  if (key === 'viewed') return Number(book.views ?? 0);
  if (key === 'price-high' || key === 'price-low') return Number(book.price ?? 0);
  return 0;
}

function applyBooksFilters() {
  let list = [..._allBooks];

  // Search filter
  const query = (_bookSearchQuery || '').trim().toLowerCase();
  if (query) {
    list = list.filter(b =>
      (b.title || '').toLowerCase().includes(query) ||
      (b.author || '').toLowerCase().includes(query) ||
      (b.category?.name || '').toLowerCase().includes(query)
    );
  }

  // Section filter / sort
  switch (_bookSectionFilter) {
    case 'in-stock':
      list = list.filter(b => b.inStock !== false);
      break;
    case 'out-of-stock':
      list = list.filter(b => b.inStock === false);
      break;
    case 'recent':
      list.sort((a, b) => getBookSortValue(b, 'recent') - getBookSortValue(a, 'recent'));
      break;
    case 'purchased':
      list.sort((a, b) => getBookSortValue(b, 'purchased') - getBookSortValue(a, 'purchased'));
      break;
    case 'rated':
      list.sort((a, b) => getBookSortValue(b, 'rated') - getBookSortValue(a, 'rated'));
      break;
    case 'viewed':
      list.sort((a, b) => getBookSortValue(b, 'viewed') - getBookSortValue(a, 'viewed'));
      break;
    case 'new-release':
      list = list
        .filter(b => b.newRelease)
        .sort((a, b) => getBookSortValue(b, 'recent') - getBookSortValue(a, 'recent'));
      break;
    case 'featured':
      list = list
        .filter(b => b.featured)
        .sort((a, b) => getBookSortValue(b, 'rated') - getBookSortValue(a, 'rated'));
      break;
    case 'price-high':
      list.sort((a, b) => getBookSortValue(b, 'price-high') - getBookSortValue(a, 'price-high'));
      break;
    case 'price-low':
      list.sort((a, b) => getBookSortValue(a, 'price-low') - getBookSortValue(b, 'price-low'));
      break;
    case 'all':
    default:
      // keep backend order (recent first in API)
      break;
  }

  renderBooksTable(list);
}

function renderBooksTable(data, pg = 1) {
  bPage = pg;
  const tbody = document.getElementById('books-tbody');
  const start = (pg - 1) * PER;
  const slice = data.slice(start, start + PER);
  if (slice.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2)">No results</td></tr>';
    document.getElementById('books-count').textContent = 'No books';
    document.getElementById('books-pg').innerHTML = '';
    return;
  }
  tbody.innerHTML = slice.map(b => {
    const idShort = (b._id || '').substring(0, 8) + '…';
    const rawCover = b.coverUrl || '';
    const coverSrc = rawCover.startsWith('/') ? 'http://localhost:5000' + rawCover : rawCover;
    const cover = coverSrc
      ? `<img src="${coverSrc}" alt="cover" style="width:38px;height:52px;object-fit:cover;border-radius:4px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.4)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div style="display:none;width:38px;height:52px;border-radius:4px;background:rgba(245,158,11,.15);align-items:center;justify-content:center;font-size:1.2rem">📖</div>`
      : `<div style="display:flex;width:38px;height:52px;border-radius:4px;background:rgba(245,158,11,.15);align-items:center;justify-content:center;font-size:1.2rem">📖</div>`;
    return `<tr class="${b.inStock === false ? 'book-row-out' : ''}">
      <td>${cover}</td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--text2)">${idShort}</span></td>
      <td class="cell-truncate" style="font-weight:500" title="${b.title}">${b.title}</td>
      <td class="cell-truncate cell-sub">${b.author}</td>
      <td><span class="badge badge-user">${b.category?.name || b.category || '—'}</span></td>
      <td><span class="badge ${b.inStock === false ? 'badge-danger' : 'badge-active'}">${b.inStock === false ? 'Out' : 'In'}</span></td>
      <td style="color:var(--accent);font-weight:600">₹${b.price || '—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="action-btn edit" onclick="openEditBook('${b._id}')">✏ Edit</button>
          <button class="action-btn del" onclick="deleteBook('${b._id}')">🗑 Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  makePagination('books-pg', data.length, PER, pg, p => renderBooksTable(data, p));
  document.getElementById('books-count').textContent = `Showing ${slice.length} of ${data.length} books`;
}

function filterBooksTable(q) {
  _bookSearchQuery = q || '';
  applyBooksFilters();
}

function filterBooksBySection(section) {
  _bookSectionFilter = section || 'all';
  applyBooksFilters();
}

/* ══════════════ DELETE BOOK ══════════════ */
async function deleteBook(bookId) {
  if (!confirm('Delete this book permanently?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/books/${bookId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showMsg('msg-books', 'Book deleted successfully.', 'success');
      showToast('🗑 Book deleted', 'success');
      loadBooks();
      loadDashboard();
    } else {
      const d = await res.json();
      showMsg('msg-books', d.message || 'Error deleting book.', 'error');
      showToast('⚠ Delete failed', 'error');
    }
  } catch (err) {
    showMsg('msg-books', 'Error: ' + err.message, 'error');
    showToast('⚠ ' + err.message, 'error');
  }
}

/* ══════════════ HELPERS ══════════════ */
function showMsg(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'msg-bar ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function makePagination(id, total, per, cur, cb) {
  const pages = Math.ceil(total / per);
  const el = document.getElementById(id);
  if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
  let h = `<button class="pg-btn" onclick="_pgGo('${id}',${Math.max(1, cur - 1)})">‹</button>`;
  const start = Math.max(1, cur - 2);
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i++)
    h += `<button class="pg-btn ${i === cur ? 'active' : ''}" onclick="_pgGo('${id}',${i})">${i}</button>`;
  h += `<button class="pg-btn" onclick="_pgGo('${id}',${Math.min(pages, cur + 1)})">›</button>`;
  el.innerHTML = h;
  el._cb = cb;   // store callback on element
}
function _pgGo(id, page) {
  const el = document.getElementById(id);
  if (el && el._cb) el._cb(page);
}

function handleSearch(q) {
  if (currentView === 'users') filterUsersTable(q);
  if (currentView === 'books') filterBooksTable(q);
}

/* ══════════════ ACTIVITIES (static log) ══════════════ */
const ACTS_DATA = [
  { icon: '📚', cls: 'act-blue', title: 'New book added', sub: 'Clean Code by Robert Martin was added', time: '2 min ago' },
  { icon: '👤', cls: 'act-green', title: 'User registered', sub: 'New user signed up via /register', time: '5 min ago' },
  { icon: '📥', cls: 'act-amber', title: 'Book borrowed', sub: 'User borrowed "Atomic Habits"', time: '8 min ago' },
  { icon: '⚠', cls: 'act-red', title: 'Overdue alert', sub: '"Dune" is 3 days overdue', time: '15 min ago' },
  { icon: '🔄', cls: 'act-blue', title: 'Book returned', sub: 'User returned "The Alchemist"', time: '22 min ago' },
  { icon: '⚙', cls: 'act-green', title: 'Settings updated', sub: 'Admin updated notification prefs', time: '1 hr ago' },
  { icon: '📊', cls: 'act-blue', title: 'Report exported', sub: 'Monthly analytics report generated', time: '2 hr ago' },
  { icon: '🔑', cls: 'act-amber', title: 'Admin login', sub: 'Admin logged in successfully', time: '3 hr ago' },
  { icon: '🗑', cls: 'act-red', title: 'Book removed', sub: 'Outdated book removed from catalog', time: '4 hr ago' },
  { icon: '📚', cls: 'act-blue', title: 'New book added', sub: '"The Pragmatic Programmer" added', time: '5 hr ago' },
];

function renderActs(data = ACTS_DATA) {
  document.getElementById('act-list').innerHTML = data.map(a => `
    <div class="activity-item">
      <div class="act-icon ${a.cls}">${a.icon}</div>
      <div class="act-text"><div class="act-title">${a.title}</div><div class="act-sub">${a.sub}</div></div>
      <div class="act-time">${a.time}</div>
    </div>`).join('');
}
function filterActs(q) {
  renderActs(q ? ACTS_DATA.filter(a => a.title.toLowerCase().includes(q.toLowerCase()) || a.sub.toLowerCase().includes(q.toLowerCase())) : ACTS_DATA);
}

/* ══════════════ EXPORT (EXCEL) ══════════════ */
function exportData(type) {
  showToast('📊 Preparing Excel export…', 'info');
  setTimeout(() => {
    let rows = [];
    let sheetName = 'Sheet1';
    let fileName = `readify_${type}`;

    if (type === 'users' && _allUsers.length) {
      sheetName = 'Users';
      fileName = 'Readify_Users';
      rows = _allUsers.map((u, i) => ({
        '#': i + 1,
        'User ID': u._id,
        'Name': u.name || '—',
        'Email': u.email || '—',
        'Role': u.role || 'user',
        'Joined': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        'Status': u.isActive === false ? 'Inactive' : 'Active',
      }));
    } else if (type === 'books' && _allBooks.length) {
      sheetName = 'Books';
      fileName = 'Readify_Books';
      rows = _allBooks.map((b, i) => ({
        '#': i + 1,
        'Book ID': b._id,
        'Title': b.title || '—',
        'Author': b.author || '—',
        'Category': b.category?.name || '—',
        'Stock': b.inStock === false ? 'Out of Stock' : 'In Stock',
        'Price (₹)': b.price != null ? b.price : '—',
        'Language': b.language || '—',
        'Pages': b.pages || '—',
        'Published': b.publishedYear || '—',
        'Description': b.description ? b.description.slice(0, 120) + '…' : '—',
      }));
    } else if (type === 'activities') {
      sheetName = 'Activities';
      fileName = 'Readify_Activities';
      rows = ACTS_DATA.map((a, i) => ({ '#': i + 1, 'Event': a.title, 'Description': a.sub, 'Time': a.time }));
    } else {
      sheetName = 'Dashboard';
      fileName = 'Readify_Dashboard';
      rows = [
        { 'Metric': 'Total Users', 'Value': document.getElementById('sv-users').textContent },
        { 'Metric': 'Total Books', 'Value': document.getElementById('sv-books').textContent },
        { 'Metric': 'Overdue Returns', 'Value': '14' },
        { 'Metric': 'Export Date', 'Value': new Date().toLocaleString() },
      ];
    }

    if (!rows.length) { showToast('⚠ No data to export', 'warning'); return; }

    const ws = XLSX.utils.json_to_sheet(rows);

    /* Auto column widths */
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length))
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('✅ Excel file downloaded!', 'success');
  }, 600);
}

/* ══════════════ NOTIFICATIONS ══════════════ */
const _DEFAULT_NOTIFS = [
  { title: 'New User Signup', desc: 'Someone just registered', time: '2 min ago', unread: true, type: 'user' },
  { title: 'Overdue Alert', desc: '3 books are currently overdue', time: '1 hr ago', unread: true, type: 'system' },
  { title: 'System Alert', desc: 'Backup completed successfully', time: '3 hr ago', unread: true, type: 'system' },
  { title: 'Book Added', desc: '"Clean Code" added to catalog', time: '5 hr ago', unread: false, type: 'book' },
  { title: 'Weekly Report', desc: 'Your weekly stats are ready', time: '1 day ago', unread: false, type: 'system' },
];

/* Load notifications from localStorage or use defaults */
function _loadNotifs() {
  try {
    const saved = localStorage.getItem('admin_notifs');
    if (saved) return JSON.parse(saved);
  } catch (e) { }
  return JSON.parse(JSON.stringify(_DEFAULT_NOTIFS));
}
function _saveNotifs() {
  try { localStorage.setItem('admin_notifs', JSON.stringify(NOTIFS)); } catch (e) { }
}

const NOTIFS = _loadNotifs();

/* -------- Notification Sounds (Web Audio API) -------- */
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _playTones(tones) {
  try {
    const ctx = _getAudioCtx();
    const now = ctx.currentTime;
    tones.forEach(([freq, start, dur, vol, waveType]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = waveType || 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(vol, now + start);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (e) { /* Audio not available */ }
}

/* Resume AudioContext on first user interaction (required by browsers) */
document.addEventListener('click', () => { try { _getAudioCtx(); } catch (e) { } }, { once: true });

/* Generic notification ding */
function playNotifSound() {
  _playTones([[880, 0, 0.15, 0.12, 'sine'], [1174.66, 0.12, 0.25, 0.1, 'sine']]);
}
/* New user signup: rising two-tone chime */
function playSoundUserSignup() {
  _playTones([[523.25, 0, 0.12, 0.13, 'sine'], [659.25, 0.10, 0.12, 0.12, 'sine'], [783.99, 0.20, 0.22, 0.10, 'sine']]);
}
/* New book added: soft bell */
function playSoundBookAdded() {
  _playTones([[1046.5, 0, 0.18, 0.10, 'triangle'], [1318.5, 0.15, 0.25, 0.09, 'triangle']]);
}
/* New order/purchase: cash register ka-ching */
function playSoundOrder() {
  _playTones([[1200, 0, 0.06, 0.14, 'square'], [1500, 0.06, 0.06, 0.13, 'square'], [2000, 0.12, 0.15, 0.11, 'sine'], [2400, 0.22, 0.25, 0.09, 'sine']]);
}
/* User login: subtle low ping */
function playSoundLogin() {
  _playTones([[440, 0, 0.1, 0.08, 'sine'], [554.37, 0.08, 0.18, 0.07, 'sine']]);
}

/* -------- Real-time Event Polling -------- */
let _lastUserCount = null;
let _lastBookCount = null;
let _lastOrderCount = null;
let _lastPendingRefundCount = null;
let _lastLoginTime = null;
let _pollTimer = null;

function _pushNotif(title, desc, type) {
  NOTIFS.unshift({ title, desc, time: 'Just now', unread: true, type: type || 'system' });
  // Keep max 30 notifications
  if (NOTIFS.length > 30) NOTIFS.length = 30;
  _saveNotifs();
  initNotifs();
  const dot = document.getElementById('notif-dot');
  if (dot) dot.classList.add('show');
}

function startEventPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  // Run poll function
  const doPoll = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const curUsers = data.totalUsers || 0;
      const curBooks = data.totalBooks || 0;
      const curOrders = data.totalOrders || 0;
      const curPendingRefunds = data.pendingRefundRequests || 0;
      const curLoginTime = data.lastLoginTime || null;

      console.log('[AdminPoll]', { curUsers, curBooks, curOrders, curLoginTime, _lastUserCount, _lastBookCount, _lastOrderCount, _lastLoginTime });

      // --- New User Registration ---
      if (_lastUserCount !== null && curUsers > _lastUserCount) {
        const n = curUsers - _lastUserCount;
        _pushNotif(
          `New User Signup${n > 1 ? 's' : ''}`,
          `${n} new user${n > 1 ? 's' : ''} just registered`,
          'user'
        );
        playSoundUserSignup();
        showToast(`👤 ${n} new user${n > 1 ? 's' : ''} registered!`, 'success');
        document.getElementById('sv-users').textContent = curUsers.toLocaleString();
        document.getElementById('nb-u').textContent = curUsers;
      }

      // --- New Book Added ---
      if (_lastBookCount !== null && curBooks > _lastBookCount) {
        const n = curBooks - _lastBookCount;
        _pushNotif(
          `New Book${n > 1 ? 's' : ''} Added`,
          `${n} new book${n > 1 ? 's' : ''} added to catalog`,
          'book'
        );
        playSoundBookAdded();
        showToast(`📚 ${n} new book${n > 1 ? 's' : ''} added!`, 'success');
        document.getElementById('sv-books').textContent = curBooks.toLocaleString();
        document.getElementById('nb-b').textContent = curBooks;
      }

      // --- New Order / Purchase ---
      if (_lastOrderCount !== null && curOrders > _lastOrderCount) {
        const n = curOrders - _lastOrderCount;
        _pushNotif(
          `New Order${n > 1 ? 's' : ''}`,
          `${n} book${n > 1 ? 's' : ''} purchased`,
          'order'
        );
        playSoundOrder();
        showToast(`🛒 ${n} new order${n > 1 ? 's' : ''}!`, 'success');
        const oe = document.getElementById('sv-orders');
        if (oe) oe.textContent = curOrders.toLocaleString();
      }

      // --- New Refund Requests ---
      if (_lastPendingRefundCount !== null && curPendingRefunds > _lastPendingRefundCount) {
        const n = curPendingRefunds - _lastPendingRefundCount;
        _pushNotif(
          `Refund Request${n > 1 ? 's' : ''}`,
          `${n} new refund request${n > 1 ? 's are' : ' is'} waiting for approval`,
          'order'
        );
        playSoundOrder();
        showToast(`💸 ${n} new refund request${n > 1 ? 's' : ''}`, 'info');
        const re = document.getElementById('sv-refunds');
        if (re) re.textContent = curPendingRefunds.toLocaleString();
        if (currentView === 'activities') loadRefundRequests();
      }

      // --- User Login (detect by timestamp change) ---
      if (_lastLoginTime !== null && curLoginTime && curLoginTime !== _lastLoginTime) {
        _pushNotif(
          'User Login',
          'A user just logged in',
          'login'
        );
        playSoundLogin();
        showToast('🔓 A user just logged in', 'info');
      }

      _lastUserCount = curUsers;
      _lastBookCount = curBooks;
      _lastOrderCount = curOrders;
      _lastPendingRefundCount = curPendingRefunds;
      _lastLoginTime = curLoginTime;
    } catch (e) { console.error('[AdminPoll] error:', e); }
  };
  // First poll after 2 seconds (let dashboard seed first)
  setTimeout(doPoll, 2000);
  _pollTimer = setInterval(doPoll, 10000); // Then every 10 seconds
}

function stopEventPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

/* Aliases for backward compat */
const startUserPolling = startEventPolling;
const stopUserPolling = stopEventPolling;

function initNotifs() {
  const typeIcons = { user: '👤', book: '📚', order: '🛒', login: '🔓', system: '⚙️' };
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (NOTIFS.length === 0) {
    list.innerHTML = '<div style="padding:24px 20px;text-align:center;color:var(--text3);font-size:.85rem">No notifications</div>';
  } else {
    list.innerHTML = NOTIFS.map(n => `
      <div class="notif-item ${n.unread ? 'unread' : ''}" data-type="${n.type || 'system'}">
        <div class="n-icon">${typeIcons[n.type] || '🔔'}</div>
        <div><div class="n-title">${n.title}</div><div class="n-desc">${n.desc}</div><div class="n-time">${n.time}</div></div>
      </div>`).join('');
  }
  // Update unread badge count
  const unreadCount = NOTIFS.filter(n => n.unread).length;
  const badge = document.getElementById('notif-dot');
  if (badge) {
    badge.textContent = unreadCount > 0 ? unreadCount : '';
    badge.classList.toggle('show', unreadCount > 0);
  }
}

let notifOpen = false;
function toggleNotif() {
  notifOpen = !notifOpen;
  document.getElementById('notif-panel').classList.toggle('open', notifOpen);
  // Always play the ding when opening (user click resumes AudioContext)
  if (notifOpen) {
    playNotifSound();
  }
}
function markAllRead() {
  NOTIFS.forEach(n => n.unread = false);
  _saveNotifs();
  initNotifs();
  showToast('✅ All notifications read', 'success');
}
function clearAllNotifs() {
  NOTIFS.length = 0;
  _saveNotifs();
  initNotifs();
  showToast('🗑 Notifications cleared', 'info');
}
document.addEventListener('click', e => {
  if (notifOpen && !e.target.closest('.notif-panel') && !e.target.closest('[title="Notifications"]')) {
    notifOpen = false;
    document.getElementById('notif-panel').classList.remove('open');
  }
});

/* ══════════════ SUPPORT CHAT ══════════════ */
function playSoundEmergencySupport() {
  _playTones([
    [880, 0, 0.10, 0.16, 'square'],
    [660, 0.10, 0.10, 0.14, 'square'],
    [990, 0.20, 0.16, 0.12, 'triangle']
  ]);
}

function initSupportSocket() {
  if (supportSocket || typeof io !== 'function') return;

  supportSocket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });

  supportSocket.on('connect', () => {
    supportSocket.emit('support:admin:subscribe');
  });

  supportSocket.on('support:list', (sessions) => {
    supportConversations = Array.isArray(sessions) ? sessions : [];
    renderSupportRequests();
    if (activeSupportConversationId) renderSupportChat();
  });

  supportSocket.on('support:request', (payload) => {
    _pushNotif('Emergency support request', `${payload.userName || 'User'} needs live support`, 'system');
    playSoundEmergencySupport();
    showToast('🚨 Emergency support request needs attention', 'error');
    goTo('support', document.querySelector('.nav-item[onclick*="support"]'));
  });

  supportSocket.on('support:message', (message) => {
    if (!message || !activeSupportConversationId) return;
    renderSupportChat();
  });

  supportSocket.on('support:agent-joined', () => {
    renderSupportChat();
  });

  supportSocket.on('support:deleted', (payload) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;

    supportConversations = supportConversations.filter((session) => session.conversationId !== conversationId);
    if (activeSupportConversationId === conversationId) {
      activeSupportConversationId = '';
    }
    renderSupportRequests();
    renderSupportChat();
  });

  supportSocket.on('support:ended', (payload) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;

    supportConversations = supportConversations.filter((session) => session.conversationId !== conversationId);
    if (activeSupportConversationId === conversationId) {
      activeSupportConversationId = '';
      setSupportVoiceHint(`Conversation ended by ${payload.endedBy || 'user'}.`);
    }
    renderSupportRequests();
    renderSupportChat();
  });
}

function setSupportVoiceHint(text) {
  const hint = document.getElementById('support-voice-hint');
  if (!hint) return;
  hint.textContent = text || '';
}

function updateSupportVoiceButtonState() {
  const button = document.getElementById('support-voice-btn');
  if (!button) return;
  if (supportMediaRecorder && supportMediaRecorder.state === 'recording') {
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg><span>Rec</span>';
    button.classList.add('recording');
    return;
  }
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm5-3a1 1 0 112 0 7 7 0 01-6 6.93V20h2a1 1 0 110 2H9a1 1 0 110-2h2v-2.07A7 7 0 015 11a1 1 0 112 0 5 5 0 0010 0z"/></svg><span>Voice</span>';
  button.classList.remove('recording');
}

function formatSupportAudioTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min)}:${String(sec).padStart(2, '0')}`;
}

function syncSupportAudioPlayerUi(playerId) {
  const player = supportVoicePlayers.get(playerId);
  if (!player) return;

  const { audio, playBtn, progress, timeEl } = player;
  const duration = Math.max(1, Number(audio.duration || player.durationHint || 1));
  const current = Math.min(duration, Math.max(0, Number(audio.currentTime || 0)));

  progress.max = String(duration);
  progress.value = String(current);
  timeEl.textContent = `${formatSupportAudioTime(current)} / ${formatSupportAudioTime(duration)}`;
  playBtn.innerHTML = audio.paused
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3v12H8zm5 0h3v12h-3z"/></svg>';
}

function attachSupportAudioPlayers() {
  supportVoicePlayers.clear();

  const nodes = document.querySelectorAll('.support-audio-hidden[data-player-id]');
  nodes.forEach((audio) => {
    const playerId = String(audio.dataset.playerId || '').trim();
    if (!playerId) return;

    const playBtn = document.querySelector(`.support-audio-play[data-player-id="${playerId}"]`);
    const progress = document.querySelector(`.support-audio-progress[data-player-id="${playerId}"]`);
    const timeEl = document.querySelector(`.support-audio-time[data-player-id="${playerId}"]`);
    const durationHint = Number(audio.dataset.durationHint || 0);
    if (!playBtn || !progress || !timeEl) return;

    supportVoicePlayers.set(playerId, { audio, playBtn, progress, timeEl, durationHint });

    audio.addEventListener('loadedmetadata', () => syncSupportAudioPlayerUi(playerId));
    audio.addEventListener('timeupdate', () => syncSupportAudioPlayerUi(playerId));
    audio.addEventListener('ended', () => {
      audio.currentTime = 0;
      syncSupportAudioPlayerUi(playerId);
    });

    syncSupportAudioPlayerUi(playerId);
  });
}

function toggleSupportAudioPlayer(playerId) {
  const player = supportVoicePlayers.get(String(playerId || ''));
  if (!player) return;

  const { audio } = player;

  if (!audio.paused) {
    audio.pause();
    syncSupportAudioPlayerUi(playerId);
    return;
  }

  supportVoicePlayers.forEach((entry, key) => {
    if (key === playerId) return;
    entry.audio.pause();
    syncSupportAudioPlayerUi(key);
  });

  audio.play().then(() => {
    syncSupportAudioPlayerUi(playerId);
  }).catch(() => {
    syncSupportAudioPlayerUi(playerId);
  });
}

function seekSupportAudioPlayer(playerId, nextValue) {
  const player = supportVoicePlayers.get(String(playerId || ''));
  if (!player) return;

  const next = Math.max(0, Number(nextValue || 0));
  player.audio.currentTime = next;
  syncSupportAudioPlayerUi(playerId);
}

function getAdminDisplayName() {
  if (selectedSupportAgent) return selectedSupportAgent;

  const email = String(localStorage.getItem(ADMIN_EMAIL_KEY) || '').trim();
  const nameFromEmail = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!nameFromEmail) return 'Support Agent';

  return nameFromEmail
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pickSupportConversation(conversationId) {
  activeSupportConversationId = conversationId;
  const current = supportConversations.find(s => s.conversationId === conversationId);
  if (current && current.unreadForAdmin) {
    current.unreadForAdmin = false;
  }
  renderSupportRequests();
  renderSupportChat();
}

function renderSupportRequests() {
  const wrap = document.getElementById('support-requests');
  if (!wrap) return;

  if (!supportConversations.length) {
    wrap.innerHTML = '<div style="padding:12px;color:var(--text2)">No active support requests</div>';
    return;
  }

  const sorted = [...supportConversations].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  wrap.innerHTML = sorted.map((session) => {
    const isActive = session.conversationId === activeSupportConversationId;
    const conversationIdSafe = String(session.conversationId || '').replace(/'/g, "\\'");
    const reason = (session.lastMessage && session.lastMessage.text) ? session.lastMessage.text : 'Live support requested';
    return `
      <div class="support-req-item ${isActive ? 'active' : ''}" onclick="pickSupportConversation('${conversationIdSafe}')">
        <div class="support-req-top">
          <div class="support-req-name">${escapeHtml(session.userName || 'Readify User')}</div>
          <div class="support-req-actions">
            ${session.unreadForAdmin ? '<span class="support-req-badge">Emergency</span>' : ''}
            <button class="support-req-delete" onclick="deleteSupportConversation('${conversationIdSafe}', event)" title="Delete chat">Delete</button>
          </div>
        </div>
        <div class="support-req-email">${escapeHtml(session.userEmail || '')}</div>
        <div class="support-req-reason">${escapeHtml(reason.slice(0, 90))}</div>
        <div class="support-req-time">${new Date(session.updatedAt || Date.now()).toLocaleString()}</div>
      </div>
    `;
  }).join('');
}

function renderSupportChat() {
  const titleEl = document.getElementById('support-chat-title');
  const subEl = document.getElementById('support-chat-sub');
  const feed = document.getElementById('support-chat-feed');
  if (!titleEl || !subEl || !feed) return;

  const session = supportConversations.find(s => s.conversationId === activeSupportConversationId);
  if (!session) {
    titleEl.textContent = 'No conversation selected';
    subEl.textContent = 'Pick a request to start chatting';
    feed.innerHTML = '<div class="support-msg system"><div class="support-msg-text">Select an emergency request from left panel.</div></div>';
    return;
  }

  titleEl.textContent = `${session.userName || 'Readify User'} (${session.userEmail || ''})`;
  subEl.textContent = session.assignedAdmin
    ? `Assigned to ${session.assignedAdmin}`
    : 'Not assigned yet. Pick an agent and send a greeting.';

  const messages = Array.isArray(session.messages) ? session.messages : [];
  feed.innerHTML = messages.map((message) => {
    const cls = message.senderType === 'admin' ? 'admin' : message.senderType === 'user' ? 'user' : 'system';
    const isAudio = message.messageType === 'audio' && message.audioUrl;
    const playerId = escapeHtml(String(message.id || `${session.conversationId}-${Math.random().toString(36).slice(2, 8)}`));
    return `
      <div class="support-msg ${cls}">
        <div class="support-msg-name">${escapeHtml(message.senderName || (cls === 'admin' ? 'Support Agent' : 'Readify User'))}</div>
        ${isAudio
        ? `<div class="support-audio-wrap">
               <audio class="support-audio-hidden" data-player-id="${playerId}" data-duration-hint="${Number(message.durationSec || 0)}" preload="metadata" src="${escapeHtml(message.audioUrl)}"></audio>
               <div class="support-audio-player">
                 <button class="support-audio-play" data-player-id="${playerId}" onclick="toggleSupportAudioPlayer('${playerId}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
                 <input type="range" class="support-audio-progress" data-player-id="${playerId}" min="0" max="1" step="0.1" value="0" oninput="seekSupportAudioPlayer('${playerId}', this.value)">
                 <span class="support-audio-time" data-player-id="${playerId}">0:00 / ${formatSupportAudioTime(Number(message.durationSec || 0) || 1)}</span>
               </div>
               <div class="support-audio-meta">Voice note${message.durationSec ? ` • ${Number(message.durationSec)}s` : ''}</div>
             </div>`
        : `<div class="support-msg-text">${escapeHtml(message.text || '')}</div>`}
        <div class="support-msg-time">${new Date(message.createdAt || Date.now()).toLocaleTimeString()}</div>
      </div>
    `;
  }).join('');
  attachSupportAudioPlayers();
  feed.scrollTop = feed.scrollHeight;
}

function selectSupportAgent(name) {
  selectedSupportAgent = name;
  document.querySelectorAll('.agent-pill').forEach(pill => {
    pill.classList.toggle('active', pill.textContent.trim() === name);
  });
  showToast(`Agent selected: ${name}`, 'info');

  if (activeSupportConversationId && supportSocket) {
    supportSocket.emit('support:admin:joinConversation', {
      conversationId: activeSupportConversationId,
      adminName: selectedSupportAgent,
    });
  }
}

function deleteSupportConversation(conversationId, event) {
  if (event?.stopPropagation) event.stopPropagation();

  const id = String(conversationId || '').trim();
  if (!id) return;
  if (!confirm('Delete this support chat permanently?')) return;

  const adminName = getAdminDisplayName();
  if (supportSocket) {
    supportSocket.emit('support:admin:deleteConversation', {
      conversationId: id,
      adminName,
    });
  }

  supportConversations = supportConversations.filter((session) => session.conversationId !== id);
  if (activeSupportConversationId === id) {
    activeSupportConversationId = '';
  }

  renderSupportRequests();
  renderSupportChat();
  showToast('🗑 Support chat deleted', 'info');
}

function deleteActiveSupportConversation() {
  if (!activeSupportConversationId) {
    showToast('⚠ Select a support request first', 'warning');
    return;
  }
  deleteSupportConversation(activeSupportConversationId);
}

function sendSupportMessage() {
  const input = document.getElementById('support-chat-input');
  const text = input ? String(input.value || '').trim() : '';
  if (!text) return;
  if (!activeSupportConversationId) {
    showToast('⚠ Select a support request first', 'warning');
    return;
  }
  if (!supportSocket) {
    showToast('⚠ Support socket is not connected', 'warning');
    return;
  }

  const adminName = getAdminDisplayName();
  const session = supportConversations.find((item) => item.conversationId === activeSupportConversationId);
  if (!session || session.assignedAdmin !== adminName) {
    supportSocket.emit('support:admin:joinConversation', {
      conversationId: activeSupportConversationId,
      adminName,
    });
  }
  supportSocket.emit('support:message', {
    conversationId: activeSupportConversationId,
    senderType: 'admin',
    senderName: adminName,
    text,
  });

  if (input) input.value = '';
}

async function startSupportVoiceRecording() {
  if (!activeSupportConversationId) {
    showToast('⚠ Select a support request first', 'warning');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    setSupportVoiceHint('Voice recording is not supported in this browser.');
    return;
  }

  try {
    supportVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    supportMediaRecorder = new MediaRecorder(supportVoiceStream);
    supportVoiceChunks = [];
    supportVoiceRecordingStart = Date.now();

    supportMediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        supportVoiceChunks.push(event.data);
      }
    };

    supportMediaRecorder.onstop = () => {
      const chunks = [...supportVoiceChunks];
      supportVoiceChunks = [];

      if (supportVoiceStream) {
        supportVoiceStream.getTracks().forEach((track) => track.stop());
        supportVoiceStream = null;
      }

      const durationSec = Math.max(1, Math.round((Date.now() - supportVoiceRecordingStart) / 1000));
      supportMediaRecorder = null;
      updateSupportVoiceButtonState();

      if (!chunks.length) {
        setSupportVoiceHint('Voice note discarded.');
        return;
      }

      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const audioUrl = typeof reader.result === 'string' ? reader.result : '';
        sendSupportAudioMessage(audioUrl, durationSec);
      };
      reader.readAsDataURL(blob);
    };

    supportMediaRecorder.start();
    setSupportVoiceHint('Recording voice note... click Stop when done.');
    updateSupportVoiceButtonState();
  } catch (_) {
    setSupportVoiceHint('Microphone access denied. Please allow access and try again.');
    stopSupportVoiceRecording(true);
  }
}

function stopSupportVoiceRecording(discard = false) {
  if (discard) {
    supportVoiceChunks = [];
  }
  if (supportMediaRecorder && supportMediaRecorder.state !== 'inactive') {
    supportMediaRecorder.stop();
  }
  if (supportVoiceStream) {
    supportVoiceStream.getTracks().forEach((track) => track.stop());
    supportVoiceStream = null;
  }
  if (!supportMediaRecorder) {
    updateSupportVoiceButtonState();
  }
}

function toggleSupportVoiceRecording() {
  if (supportMediaRecorder && supportMediaRecorder.state === 'recording') {
    stopSupportVoiceRecording(false);
    return;
  }
  startSupportVoiceRecording();
}

function sendSupportAudioMessage(audioUrl, durationSec) {
  if (!audioUrl) return;
  if (!activeSupportConversationId) {
    showToast('⚠ Select a support request first', 'warning');
    return;
  }
  if (!supportSocket) {
    showToast('⚠ Support socket is not connected', 'warning');
    return;
  }

  const adminName = getAdminDisplayName();
  const session = supportConversations.find((item) => item.conversationId === activeSupportConversationId);
  if (!session || session.assignedAdmin !== adminName) {
    supportSocket.emit('support:admin:joinConversation', {
      conversationId: activeSupportConversationId,
      adminName,
    });
  }

  supportSocket.emit('support:message', {
    conversationId: activeSupportConversationId,
    senderType: 'admin',
    senderName: adminName,
    messageType: 'audio',
    audioUrl,
    durationSec,
  });
  setSupportVoiceHint('Voice note sent.');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ══════════════ CLOCK ══════════════ */
function startClock() { updateClock(); setInterval(updateClock, 1000); }
function updateClock() {
  const now = new Date();
  let s = '';
  if (timeFmt === 'utc') {
    s = now.toUTCString().split(' ').slice(4, 5).join(' ') + ' UTC';
  } else if (timeFmt === '12h') {
    s = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } else {
    s = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const sc = document.getElementById('sb-clock'); if (sc) sc.textContent = s;
  const sd = document.getElementById('sb-date'); if (sd) sd.textContent = dateStr;
  const tc = document.getElementById('tb-clock'); if (tc) tc.textContent = s;
  const td2 = document.getElementById('tb-date'); if (td2) td2.textContent = dateStr;
  const tp = document.getElementById('time-preview'); if (tp) tp.textContent = s;
}
function setTimeFmt(fmt, el) {
  timeFmt = fmt;
  document.querySelectorAll('.time-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  updateClock();
}

/* ══════════════ THEME ══════════════ */
function toggleTheme() { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-btn').textContent = t === 'dark' ? '🌙' : '☀️';
  document.getElementById('opt-dark').classList.toggle('active', t === 'dark');
  document.getElementById('opt-light').classList.toggle('active', t === 'light');
  setTimeout(() => { killCharts(); initCharts(); if (currentView === 'analytics') { initAnalyticsCharts(); loadAnalyticsCharts(); } }, 80);
}

/* ══════════════ PASSWORD CHANGE ══════════════ */
function showCaptcha() {
  document.getElementById('pass-locked').style.display = 'none';
  document.getElementById('captcha-area').classList.add('show');
}
function captchaChecked(el) {
  if (el.checked) {
    document.getElementById('captcha-area').classList.remove('show');
    document.getElementById('pass-form').classList.add('show');
    showToast('✅ Identity verified', 'success');
  }
}
function submitPasswordChange() {
  const cur = document.getElementById('p-cur').value;
  const nw = document.getElementById('p-new').value;
  const cf = document.getElementById('p-cfm').value;
  if (!cur || !nw || !cf) { showToast('⚠ Fill all fields', 'error'); return; }
  if (nw !== cf) { showToast('⚠ Passwords do not match', 'error'); return; }
  if (nw.length < 8) { showToast('⚠ Min 8 characters', 'error'); return; }
  // In real app: POST /api/admin/change-password with bearer token
  showToast('✅ Password updated', 'success');
  ['p-cur', 'p-new', 'p-cfm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pass-form').classList.remove('show');
  document.getElementById('captcha-chk').checked = false;
  document.getElementById('pass-locked').style.display = 'flex';
}

/* ══════════════ TOAST ══════════════ */
function showToast(msg, type = 'info') {
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* ══════════════ CHARTS ══════════════ */
const S = { charts: {} };
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const gc = () => isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
const tc = () => isDark() ? '#7f9ab8' : '#5c5650';
const CLR = ['#f59e0b', '#22c55e', '#24f0e0', '#c2440e', '#a78bfa', '#ef4444'];
const CLR_GLOW = ['rgba(245,158,11,.55)', 'rgba(34,197,94,.55)', 'rgba(36,240,224,.45)', 'rgba(194,68,14,.50)', 'rgba(167,139,250,.45)', 'rgba(239,68,68,.50)'];

/* ---------- Chart.js Glow Plugin ---------- */
const glowPlugin = {
  id: 'glowPlugin',
  beforeDatasetsDraw(chart, _args, _opts) {
    const ctx = chart.ctx;
    ctx.save();
    const type = chart.config.type;
    if (type === 'bar') { ctx.shadowColor = 'rgba(245,158,11,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; }
    else if (type === 'line') { ctx.shadowColor = 'rgba(245,158,11,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 0; }
    else if (type === 'doughnut' || type === 'pie') { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; }
    else if (type === 'radar') { ctx.shadowColor = 'rgba(245,158,11,.25)'; ctx.shadowBlur = 12; }
  },
  afterDatasetsDraw(chart) { chart.ctx.restore(); }
};
Chart.register(glowPlugin);

/* ---------- Helper: vertical / horizontal gradient ---------- */
function barGradient(ctx, area, color1, color2, horizontal) {
  const g = horizontal
    ? ctx.createLinearGradient(area.left, 0, area.right, 0)
    : ctx.createLinearGradient(0, area.bottom, 0, area.top);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  return g;
}
/* gradient per-bar from CLR array */
function clrBarGradients(ctx, area, horizontal) {
  const pairs = [
    ['#b45309', '#fbbf24'], ['#15803d', '#4ade80'], ['#0e7490', '#67e8f9'],
    ['#9a3412', '#fb923c'], ['#6d28d9', '#c4b5fd'], ['#b91c1c', '#fca5a5']
  ];
  return pairs.map(([c1, c2]) => barGradient(ctx, area, c1, c2, horizontal));
}

function lineGradientFill(ctx, area, r, g, b, opacity) {
  const gr = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gr.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},${opacity * 0.35})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  return gr;
}

function baseOpts() {
  return {
    responsive: true, maintainAspectRatio: true,
    animation: {
      duration: 1800, easing: 'easeOutQuart',
      delay: (ctx) => ctx.type === 'data' ? ctx.dataIndex * 120 + ctx.datasetIndex * 200 : 0
    },
    transitions: {
      active: { animation: { duration: 300 } }
    },
    plugins: {
      legend: { labels: { color: tc(), font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 12 } },
      tooltip: { animation: { duration: 250, easing: 'easeOutCubic' } }
    },
    scales: {
      x: { grid: { color: gc() }, ticks: { color: tc(), font: { family: 'DM Sans', size: 11 } } },
      y: { grid: { color: gc() }, ticks: { color: tc(), font: { family: 'DM Sans', size: 11 } } }
    }
  };
}

/* Shared animated options for doughnut / pie charts */
function doughnutOpts(extra) {
  return {
    responsive: true, maintainAspectRatio: true,
    animation: {
      animateRotate: true, animateScale: true,
      duration: 2000, easing: 'easeOutCirc',
      delay: (ctx) => ctx.type === 'data' ? ctx.dataIndex * 150 : 0
    },
    transitions: { active: { animation: { duration: 300 } } },
    plugins: {
      legend: { position: 'bottom', labels: { color: tc(), font: { family: 'DM Sans', size: 11 }, padding: 10, boxWidth: 10 } },
      tooltip: { animation: { duration: 250, easing: 'easeOutCubic' } }
    },
    ...extra
  };
}

function killCharts() { Object.values(S.charts).forEach(c => { try { c.destroy(); } catch (e) { } }); S.charts = {}; }

function initCharts() {
  const b = baseOpts();

  S.charts['c-growth'] = new Chart(document.getElementById('c-growth'), {
    type: 'line', data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'New Users', data: [12, 19, 8, 24, 17, 31, 26],
        borderColor: '#f59e0b', borderWidth: 2.5,
        backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return 'rgba(245,158,11,.1)'; return lineGradientFill(ctx.chart.ctx, a, 245, 158, 11, .25); },
        fill: true, tension: .4, pointRadius: 5, pointHoverRadius: 7,
        pointBackgroundColor: '#f59e0b', pointBorderColor: '#0f172a', pointBorderWidth: 2,
        pointHoverBackgroundColor: '#fbbf24', pointHoverBorderColor: '#fff'
      }]
    }, options: b
  });

  S.charts['c-cats'] = new Chart(document.getElementById('c-cats'), {
    type: 'doughnut', data: {
      labels: ['Fiction', 'Self-Help', 'Sci-Fi', 'History', 'Mystery', 'Other'],
      datasets: [{
        data: [320, 240, 180, 160, 140, 207], backgroundColor: CLR, borderWidth: 2, borderColor: 'rgba(11,18,32,.6)',
        hoverOffset: 10, hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: doughnutOpts({ cutout: '65%' })
  });

  S.charts['c-top'] = new Chart(document.getElementById('c-top'), {
    type: 'bar', data: {
      labels: ['Atomic Habits', 'Dune', '1984', 'Alchemist', 'Sapiens'],
      datasets: [{
        label: 'Borrows', data: [489, 412, 387, 356, 320],
        backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return CLR; return clrBarGradients(ctx.chart.ctx, a, true); },
        borderColor: CLR, borderWidth: 1, borderRadius: 8, borderSkipped: false,
        hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: { ...b, indexAxis: 'y', plugins: { legend: { display: false } } }
  });

  S.charts['c-users-trend'] = new Chart(document.getElementById('c-users-trend'), {
    type: 'line', data: {
      labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      datasets: [{
        label: 'Registrations', data: [40, 55, 70, 62, 80, 95, 110],
        borderColor: '#22c55e', borderWidth: 2.5,
        backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return 'rgba(34,197,94,.1)'; return lineGradientFill(ctx.chart.ctx, a, 34, 197, 94, .25); },
        fill: true, tension: .4, pointRadius: 5, pointHoverRadius: 7,
        pointBackgroundColor: '#22c55e', pointBorderColor: '#0f172a', pointBorderWidth: 2,
        pointHoverBackgroundColor: '#4ade80', pointHoverBorderColor: '#fff'
      }]
    }, options: b
  });

  S.charts['c-users-status'] = new Chart(document.getElementById('c-users-status'), {
    type: 'pie', data: {
      labels: ['Active', 'Inactive', 'Pending'],
      datasets: [{
        data: [198, 36, 14], backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        borderWidth: 2, borderColor: 'rgba(11,18,32,.6)', hoverOffset: 10,
        hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: doughnutOpts({})
  });

  S.charts['c-books-monthly'] = new Chart(document.getElementById('c-books-monthly'), {
    type: 'bar', data: {
      labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      datasets: [{
        label: 'Books Added', data: [80, 120, 95, 140, 110, 160, 130],
        backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return 'rgba(245,158,11,.75)'; return barGradient(ctx.chart.ctx, a, '#b45309', '#fbbf24', false); },
        borderColor: '#f59e0b', borderWidth: 1, borderRadius: 8, borderSkipped: false,
        hoverBackgroundColor: '#fbbf24', hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: b
  });

  S.charts['c-formats'] = new Chart(document.getElementById('c-formats'), {
    type: 'doughnut', data: {
      labels: ['eBook', 'Physical', 'Audio'],
      datasets: [{
        data: [620, 430, 197], backgroundColor: ['#24f0e0', '#22c55e', '#c2440e'],
        borderWidth: 2, borderColor: 'rgba(11,18,32,.6)', hoverOffset: 10,
        hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: doughnutOpts({ cutout: '60%' })
  });

  S.charts['c-hourly'] = new Chart(document.getElementById('c-hourly'), {
    type: 'line', data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Events', data: [2, 1, 0, 0, 1, 3, 8, 22, 34, 41, 38, 29, 44, 38, 32, 28, 35, 40, 38, 30, 24, 18, 12, 6],
        borderColor: '#f59e0b', borderWidth: 2.5,
        backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return 'rgba(245,158,11,.08)'; return lineGradientFill(ctx.chart.ctx, a, 245, 158, 11, .2); },
        fill: true, tension: .4, pointRadius: 2, pointHoverRadius: 6,
        pointBackgroundColor: '#f59e0b', pointBorderColor: '#0f172a', pointBorderWidth: 2,
        pointHoverBackgroundColor: '#fbbf24', pointHoverBorderColor: '#fff'
      }]
    }, options: b
  });

  S.charts['c-events'] = new Chart(document.getElementById('c-events'), {
    type: 'doughnut', data: {
      labels: ['Borrow', 'Return', 'Login', 'Register', 'Admin', 'Other'],
      datasets: [{
        data: [380, 310, 140, 98, 52, 67], backgroundColor: CLR,
        borderWidth: 2, borderColor: 'rgba(11,18,32,.6)', hoverOffset: 10,
        hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: doughnutOpts({ cutout: '60%' })
  });
}

function initAnalyticsCharts() {
  if (S.charts['c-revenue']) return;
  const b = baseOpts();
  S.charts['c-revenue'] = new Chart(document.getElementById('c-revenue'), {
    type: 'bar', data: {
      labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      datasets: [{
        label: 'Revenue (₹)', data: [2400, 3100, 2800, 4000, 3600, 4200],
        backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return 'rgba(194,68,14,.75)'; return barGradient(ctx.chart.ctx, a, '#7c2d12', '#fb923c', false); },
        borderColor: '#c2440e', borderWidth: 1, borderRadius: 8, borderSkipped: false,
        hoverBackgroundColor: '#fb923c', hoverBorderColor: '#fff', hoverBorderWidth: 2
      }]
    }, options: b
  });

  S.charts['c-peak'] = new Chart(document.getElementById('c-peak'), {
    type: 'radar', data: {
      labels: ['6am', '9am', '12pm', '3pm', '6pm', '9pm'],
      datasets: [{
        label: 'Activity', data: [20, 55, 85, 70, 90, 60],
        backgroundColor: 'rgba(245,158,11,.15)', borderColor: '#f59e0b', borderWidth: 2.5,
        pointBackgroundColor: '#f59e0b', pointBorderColor: '#0f172a', pointBorderWidth: 2,
        pointRadius: 5, pointHoverRadius: 7, pointHoverBackgroundColor: '#fbbf24', pointHoverBorderColor: '#fff'
      }]
    }, options: { responsive: true, maintainAspectRatio: true, animation: { duration: 2000, easing: 'easeOutQuart', animateScale: true }, transitions: { active: { animation: { duration: 300 } } }, plugins: { legend: { labels: { color: tc(), font: { family: 'DM Sans', size: 12 } } }, tooltip: { animation: { duration: 250 } } }, scales: { r: { grid: { color: gc() }, ticks: { color: tc(), backdropColor: 'transparent' }, pointLabels: { color: tc(), font: { family: 'DM Sans', size: 12 } } } } }
  });

  S.charts['c-refunds'] = new Chart(document.getElementById('c-refunds'), {
    type: 'bar',
    data: {
      labels: ['UPI', 'DEBIT', 'CREDIT', 'NETBANKING', 'WALLET'],
      datasets: [{
        label: 'Approved Refunds',
        data: [0, 0, 0, 0, 0],
        backgroundColor: ['#24f0e0', '#22c55e', '#f59e0b', '#c2440e', '#a78bfa'],
        borderRadius: 8,
      }],
    },
    options: b,
  });
}

async function loadAnalyticsCharts() {
  const CLR = ['#f59e0b', '#24f0e0', '#22c55e', '#c2440e', '#a78bfa', '#fb7185', '#34d399', '#60a5fa', '#fbbf24', '#e879f9'];
  const b = baseOpts();

  /* ─ Top 10 Books by Price (Most Purchased proxy) ─ */
  if (_allBooks.length) {
    const sorted = [..._allBooks].sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 10);
    const labels = sorted.map(b => b.title.length > 20 ? b.title.slice(0, 19) + '…' : b.title);
    const data = sorted.map(b => b.price || 0);
    if (S.charts['c-top-purchased']) S.charts['c-top-purchased'].destroy();
    S.charts['c-top-purchased'] = new Chart(document.getElementById('c-top-purchased'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Price (₹)', data, backgroundColor: labels.map((_, i) => CLR[i % CLR.length]), borderRadius: 6 }] },
      options: { ...b, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
  }

  /* ─ Books by Category (Most Searched / Browsed) ─ */
  if (_allBooks.length) {
    const catMap = {};
    _allBooks.forEach(bk => {
      const name = bk.category?.name || bk.category || 'Unknown';
      catMap[name] = (catMap[name] || 0) + 1;
    });
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(e => e[0]);
    const data = sorted.map(e => e[1]);
    if (S.charts['c-most-searched']) S.charts['c-most-searched'].destroy();
    S.charts['c-most-searched'] = new Chart(document.getElementById('c-most-searched'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CLR.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }] },
      options: doughnutOpts({ cutout: '60%' })
    });
  }

  /* ─ Daily User Registrations (Logins proxy) ─ */
  try {
    const r = await fetch(`${API_BASE}/admin/analytics/logins`, { headers: { Authorization: `Bearer ${token}` } });
    const days = await r.json();
    if (S.charts['c-logins']) S.charts['c-logins'].destroy();
    S.charts['c-logins'] = new Chart(document.getElementById('c-logins'), {
      type: 'line',
      data: {
        labels: days.map(d => d.date),
        datasets: [{
          label: 'New Registrations', data: days.map(d => d.count),
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.12)',
          fill: true, tension: .45, pointRadius: 5, pointBackgroundColor: '#22c55e'
        }]
      },
      options: b
    });
  } catch (e) { console.warn('logins analytics:', e); }

  /* ─ Refund Analytics ─ */
  try {
    const rr = await fetch(`${API_BASE}/admin/analytics/refunds`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await rr.json();
    if (!rr.ok) throw new Error(payload?.message || 'Failed to load refund analytics');

    const summary = payload?.summary || {};
    const byMethod = Array.isArray(payload?.byMethod) ? payload.byMethod : [];
    const order = ['upi', 'debit', 'credit', 'netbanking', 'wallet'];
    const methodMap = Object.fromEntries(byMethod.map((m) => [String(m.method || '').toLowerCase(), Number(m.count || 0)]));
    const values = order.map((m) => methodMap[m] || 0);

    if (S.charts['c-refunds']) {
      S.charts['c-refunds'].data.datasets[0].data = values;
      S.charts['c-refunds'].update();
    }

    const p = document.getElementById('ra-pending');
    const a = document.getElementById('ra-approved');
    const j = document.getElementById('ra-rejected');
    if (p) p.textContent = String(summary.pending || 0);
    if (a) a.textContent = String(summary.approved || 0);
    if (j) j.textContent = String(summary.rejected || 0);
  } catch (e) {
    console.warn('refund analytics:', e);
  }
}

/* ══════════════ ADD BOOK MODAL ══════════════ */
async function openAddBook() {
  // Load categories into select
  const sel = document.getElementById('ab-category');
  try {
    const r = await fetch(`${API_BASE}/admin/categories`, { headers: { Authorization: `Bearer ${token}` } });
    const cats = await r.json();
    sel.innerHTML = '<option value="">Select category…</option>' +
      cats.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Could not load categories</option>';
  }
  document.getElementById('add-book-form').reset();
  document.getElementById('ab-in-stock').value = 'true';
  document.getElementById('ab-cover-preview').style.display = 'none';
  document.getElementById('msg-add-book').style.display = 'none';
  document.getElementById('add-book-modal').classList.add('open');
}

function closeAddBook(e) {
  if (e && e.target !== document.getElementById('add-book-modal')) return;
  document.getElementById('add-book-modal').classList.remove('open');
}

function previewCover(input) {
  const preview = document.getElementById('ab-cover-preview');
  if (input.files && input.files[0]) {
    const url = URL.createObjectURL(input.files[0]);
    preview.src = url; preview.style.display = 'block';
    document.getElementById('ab-cover-url').value = '';
  }
}

async function submitAddBook(e) {
  e.preventDefault();
  const btn = document.getElementById('ab-submit-btn');
  btn.disabled = true; btn.textContent = 'Adding…';

  const form = document.getElementById('add-book-form');
  const fd = new FormData(form);

  // If no file chosen but URL provided, remove the file key so backend uses coverUrl text
  const fileInput = document.getElementById('ab-cover-file');
  if (!fileInput.files.length) fd.delete('coverImage');

  // Validate PDF file
  const pdfInput = document.getElementById('ab-pdf-file');
  if (!pdfInput.files.length) {
    showMsg('msg-add-book', '❌ Please select a PDF file', 'error');
    btn.disabled = false; btn.textContent = 'Add Book';
    return;
  }
  if (pdfInput.files[0].size > 50 * 1024 * 1024) {
    showMsg('msg-add-book', '❌ PDF file must be under 50 MB', 'error');
    btn.disabled = false; btn.textContent = 'Add Book';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd      // multipart — DO NOT set Content-Type manually
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add book');

    showMsg('msg-add-book', '✅ Book added successfully!', 'success');
    showToast('📚 Book added: ' + data.book.title, 'success');
    setTimeout(() => {
      document.getElementById('add-book-modal').classList.remove('open');
      loadBooks();
      loadDashboard();
    }, 1000);
  } catch (err) {
    showMsg('msg-add-book', '❌ ' + err.message, 'error');
    showToast('⚠ ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Add Book';
  }
}

async function openEditBook(bookId) {
  const book = _allBooks.find(b => b._id === bookId);
  if (!book) {
    showToast('⚠ Book not found in current list', 'error');
    return;
  }

  const categorySelect = document.getElementById('eb-category');
  try {
    const r = await fetch(`${API_BASE}/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const cats = await r.json();
    categorySelect.innerHTML = '<option value="">Select category...</option>' +
      cats.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  } catch (_) {
    categorySelect.innerHTML = '<option value="">Could not load categories</option>';
  }

  document.getElementById('eb-book-id').value = book._id || '';
  document.getElementById('eb-title').value = book.title || '';
  document.getElementById('eb-author').value = book.author || '';
  document.getElementById('eb-price').value = book.price ?? '';
  document.getElementById('eb-language').value = book.language || '';
  document.getElementById('eb-pages').value = book.pages ?? '';
  document.getElementById('eb-publish-year').value = book.publishYear ?? '';
  document.getElementById('eb-in-stock').value = book.inStock === false ? 'false' : 'true';
  document.getElementById('eb-description').value = book.description || '';
  document.getElementById('eb-cover-url').value = book.coverUrl || '';

  const categoryId = typeof book.category === 'object' ? (book.category?._id || '') : (book.category || '');
  if (categoryId) categorySelect.value = categoryId;

  const currentPdf = document.getElementById('eb-current-pdf');
  currentPdf.textContent = `Current: ${book.pdfUrl || 'No PDF linked'}`;

  const preview = document.getElementById('eb-cover-preview');
  const cover = coverSrcForBook(book);
  if (cover) {
    preview.src = cover;
    preview.style.display = 'block';
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }

  const form = document.getElementById('edit-book-form');
  form.reset();

  // Restore values after reset
  document.getElementById('eb-book-id').value = book._id || '';
  document.getElementById('eb-title').value = book.title || '';
  document.getElementById('eb-author').value = book.author || '';
  document.getElementById('eb-price').value = book.price ?? '';
  document.getElementById('eb-language').value = book.language || '';
  document.getElementById('eb-pages').value = book.pages ?? '';
  document.getElementById('eb-publish-year').value = book.publishYear ?? '';
  document.getElementById('eb-in-stock').value = book.inStock === false ? 'false' : 'true';
  document.getElementById('eb-description').value = book.description || '';
  document.getElementById('eb-cover-url').value = book.coverUrl || '';
  if (categoryId) categorySelect.value = categoryId;
  currentPdf.textContent = `Current: ${book.pdfUrl || 'No PDF linked'}`;
  if (cover) {
    preview.src = cover;
    preview.style.display = 'block';
  }

  document.getElementById('msg-edit-book').style.display = 'none';
  document.getElementById('edit-book-modal').classList.add('open');
}

function closeEditBook(e) {
  if (e && e.target !== document.getElementById('edit-book-modal')) return;
  document.getElementById('edit-book-modal').classList.remove('open');
}

function previewEditCover(input) {
  const preview = document.getElementById('eb-cover-preview');
  if (input.files && input.files[0]) {
    const url = URL.createObjectURL(input.files[0]);
    preview.src = url;
    preview.style.display = 'block';
    document.getElementById('eb-cover-url').value = '';
  }
}

async function submitEditBook(e) {
  e.preventDefault();
  const btn = document.getElementById('eb-submit-btn');
  const bookId = document.getElementById('eb-book-id').value;
  if (!bookId) {
    showMsg('msg-edit-book', '❌ Invalid book id', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  const form = document.getElementById('edit-book-form');
  const fd = new FormData(form);

  const coverInput = document.getElementById('eb-cover-file');
  if (!coverInput.files.length) fd.delete('coverImage');

  const pdfInput = document.getElementById('eb-pdf-file');
  if (!pdfInput.files.length) {
    fd.delete('pdfFile');
  } else if (pdfInput.files[0].size > 50 * 1024 * 1024) {
    showMsg('msg-edit-book', '❌ PDF file must be under 50 MB', 'error');
    btn.disabled = false;
    btn.textContent = 'Save Changes';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/books/${bookId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update book');

    showMsg('msg-edit-book', '✅ Book updated successfully!', 'success');
    showToast('✅ Updated: ' + (data.book?.title || 'Book'), 'success');

    setTimeout(() => {
      document.getElementById('edit-book-modal').classList.remove('open');
      loadBooks();
      loadDashboard();
    }, 850);
  } catch (err) {
    showMsg('msg-edit-book', '❌ ' + err.message, 'error');
    showToast('⚠ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

function switchGrowthPeriod(p, btn) {
  document.querySelectorAll('.chart-actions .chart-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const D = {
    '7d': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], data: [12, 19, 8, 24, 17, 31, 26] },
    '1m': { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], data: [48, 72, 63, 89] },
    '6m': { labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'], data: [180, 220, 195, 280, 240, 310] },
  };
  const c = S.charts['c-growth'];
  if (c && D[p]) { c.data.labels = D[p].labels; c.data.datasets[0].data = D[p].data; c.update(); }
}