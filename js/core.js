window.CLF = window.CLF || { pages: {} };

(function (C) {
  'use strict';

  C.state = { user: null, stats: {} };

  // ---------- small helpers ----------
  C.$ = (sel, root) => (root || document).querySelector(sel);
  C.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  C.esc = (s) =>
    String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  C.fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  C.today = () => new Date().toISOString().slice(0, 10);

  C.go = (hash) => {
    if (location.hash === hash) C.route();
    else location.hash = hash;
  };

  // ---------- icons (feather-style) ----------
  const ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    lost: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    found: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    items: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
    claims: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    matches: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  };
  C.icon = (name) =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // ---------- API ----------
  C.token = () => localStorage.getItem('clf_token');
  C.setToken = (t) => (t ? localStorage.setItem('clf_token', t) : localStorage.removeItem('clf_token'));

  C.api = async (path, opts) => {
    const o = opts || {};
    const headers = {};
    if (C.token()) headers.Authorization = 'Bearer ' + C.token();
    let body;
    if (o.form) body = o.form;
    else if (o.body) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body); }
    let res;
    try {
      res = await fetch((window.CLF_API_BASE || '') + '/api' + path, { method: o.method || 'GET', headers, body });
    } catch (e) {
      throw new Error('Cannot reach the server. Check that the backend is running.');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && C.token() && !path.startsWith('/auth/')) {
      C.logout();
      throw new Error(data.error || 'Please log in again.');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  };

  C.logout = () => {
    C.setToken(null);
    C.state.user = null;
    C.state.stats = {};
    C.go('#/login');
  };

  C.photoUrl = (p) => (p ? (window.CLF_API_BASE || '') + p : null);

  // ---------- badges ----------
  const ITEM_STATUS = { open: ['Open', 'blue'], claim_pending: ['Claim pending', 'amber'], returned: ['Returned', 'green'] };
  C.itemBadge = (s) => { const x = ITEM_STATUS[s] || [s, 'blue']; return `<span class="badge ${x[1]}">${C.esc(x[0])}</span>`; };

  const CLAIM_STATUS = { pending: ['Pending', 'amber'], approved: ['Approved', 'green'], rejected: ['Rejected', 'red'] };
  C.claimBadge = (s) => { const x = CLAIM_STATUS[s] || [s, 'blue']; return `<span class="badge ${x[1]}">${C.esc(x[0])}</span>`; };

  C.scorePill = (n) => `<span class="score ${n >= 85 ? 'hi' : n >= 70 ? 'mid' : 'lo'}">${n}%</span>`;

  // ---------- UI pieces ----------
  C.showError = (form, msg) => {
    const el = C.$('.alert', form);
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  };

  C.empty = (title, text, link) =>
    `<div class="empty"><strong>${C.esc(title)}</strong><p>${C.esc(text || '')}</p>${link ? `<a class="btn primary" href="${link[0]}">${C.esc(link[1])}</a>` : ''}</div>`;

  C.modal = (html, bind) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => e.key === 'Escape' && close();
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    if (bind) bind(overlay, close);
    return close;
  };

  C.kv = (label, value) => `<div class="kv"><span>${C.esc(label)}</span><b>${value === undefined || value === null || value === '' ? '—' : value}</b></div>`;

  // ---------- layout ----------
  C.logoSvg = (size) =>
    `<svg class="logo" width="${size || 44}" height="${size || 44}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#2f7bf6"/><circle cx="14" cy="13" r="6.2" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M18.6 17.6L25 24" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;

  C.shell = (active, title, inner) => {
    const admin = C.state.user.role === 'admin';
    const s = C.state.stats || {};
    const badge = (n) => (n > 0 ? `<span class="count">${n}</span>` : '');
    const nav = admin
      ? [
          ['dashboard', 'Dashboard', 'home'],
          ['admin-lost', 'Lost Items', 'lost'],
          ['admin-found', 'Found Items', 'found'],
          ['matches', 'Matches', 'matches', s.open_matches],
          ['claims', 'Claim Requests', 'claims', s.pending_claims],
          ['users', 'Users', 'users'],
        ]
      : [
          ['dashboard', 'Dashboard', 'home'],
          ['report-lost', 'Report Lost Item', 'lost'],
          ['report-found', 'Report Found Item', 'found'],
          ['my-items', 'My Items', 'items'],
          ['claims', 'Claim Requests', 'claims', s.pending_claims],
          ['profile', 'Profile', 'user'],
        ];
    const links = nav
      .map((n) => `<a href="#/${n[0]}" class="${active === n[0] ? 'active' : ''}" ${active === n[0] ? 'aria-current="page"' : ''}>${C.icon(n[2])}<span>${n[1]}</span>${badge(n[3])}</a>`)
      .join('');
    return `
      <div class="app">
        <aside class="side">
          <div class="brand">${C.logoSvg(30)}<span>Campus Lost &amp; Found</span></div>
          <nav>${links}<a href="#/login" id="logout">${C.icon('logout')}<span>Logout</span></a></nav>
        </aside>
        <main class="main">
          <header class="top">
            <h1>${C.esc(title)}</h1>
            <div class="who"><span class="avatar">${C.esc((C.state.user.name || '?')[0].toUpperCase())}</span>
              <span>${C.esc(C.state.user.name)}${admin ? ' <em>Admin</em>' : ''}</span></div>
          </header>
          <section class="content">${inner}</section>
        </main>
      </div>`;
  };
})(window.CLF);
