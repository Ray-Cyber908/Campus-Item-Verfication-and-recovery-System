(function (C) {
  'use strict';
  const { $ } = C;
  const app = $('#app');

  const PUBLIC = ['login', 'register'];
  const ADMIN_ONLY = ['admin-lost', 'admin-found', 'matches', 'users'];
  const STUDENT_ONLY = ['report-lost', 'report-found', 'my-items', 'profile', 'submitted'];

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query || '') };
  }

  let seq = 0;
  C.route = async function route() {
    const my = ++seq; // ignore out-of-date async renders
    const ctx = parseHash();
    let name = ctx.parts[0] || '';
    const user = C.state.user;

    if (!user) { if (!PUBLIC.includes(name)) name = 'login'; }
    else {
      if (PUBLIC.includes(name) || !name) name = 'dashboard';
      const admin = user.role === 'admin';
      if ((admin && STUDENT_ONLY.includes(name)) || (!admin && ADMIN_ONLY.includes(name))) name = 'dashboard';
    }
    if (name === 'claims' && ctx.parts[1]) name = 'claim';

    const page = C.pages[name];
    if (!page) { return C.go(user ? '#/dashboard' : '#/login'); }
    // keep the address bar in sync when we redirected (e.g. logged-in user opening #/login)
    if (name !== (ctx.parts[0] || '') && name !== 'claim') history.replaceState(null, '', '#/' + name);

    try {
      if (user) C.state.stats = await C.api('/stats').catch(() => ({}));
      const out = await page(ctx);
      if (my !== seq) return;
      if (out.redirect) return C.go(out.redirect);

      app.innerHTML = out.raw ? out.html : C.shell(out.active, out.title, out.html);
      document.title = (out.title ? out.title + ' · ' : '') + 'Campus Lost & Found';
      const lo = $('#logout');
      if (lo) lo.addEventListener('click', (e) => { e.preventDefault(); C.logout(); });
      if (out.bind) out.bind();
      window.scrollTo(0, 0);
    } catch (err) {
      if (my !== seq) return;
      if (!C.state.user) return;
      app.innerHTML = C.shell('', 'Something went wrong',
        `<div class="card"><div class="alert">${C.esc(err.message)}</div><a class="btn ghost" href="#/dashboard">Back to dashboard</a></div>`);
      const lo = $('#logout');
      if (lo) lo.addEventListener('click', (e) => { e.preventDefault(); C.logout(); });
    }
  };

  window.addEventListener('hashchange', C.route);

  (async function start() {
    if (C.token()) {
      try { C.state.user = (await C.api('/auth/me')).user; }
      catch (e) { C.setToken(null); }
    }
    $('#boot').remove();
    C.route();
  })();
})(window.CLF);
