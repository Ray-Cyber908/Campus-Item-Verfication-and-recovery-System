(function (C) {
  'use strict';
  const { $, esc } = C;

  /* --- Updated authFrame with your texture image filename --- */
const authFrame = (inner) => `
    <div class="auth-split" style="display: flex; min-height: 100vh; width: 100%; background: linear-gradient(135deg, rgba(8, 21, 41, 0.85), rgba(18, 41, 77, 0.80)), url('OIP-507091142.jpg') center/cover no-repeat;">
      <div class="auth-banner" style="flex: 1.2; background: transparent; display: flex; align-items: center; justify-content: center; padding: 4rem; color: #fff;">
        <div class="auth-banner-inner">
          ${C.logoSvg(60)}
          <h1>Campus Lost &amp; Found</h1>
          <p class="tag">Find what's lost, bring what's found</p>
          <p class="story">Because every item has a story…</p>
        </div>
      </div>
      <div class="auth-main" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; background: transparent;">
        <div class="auth-card">
          <h2>Welcome</h2>
          <p class="tag">Please enter your account details</p>
          ${inner}
        </div>
      </div>
    </div>`;

  async function finishLogin(data) {
    C.setToken(data.token);
    C.state.user = data.user;
    C.go('#/dashboard');
  }

  C.pages.login = async () => ({
    raw: true,
    html: authFrame(`
      <form id="f" novalidate>
        <div class="alert" role="alert" hidden></div>
        <label class="field"><span>Student ID or email</span>
          <input name="identifier" autocomplete="username" required></label>
        <label class="field"><span>Password</span>
          <input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn primary block">Log in</button>
      </form>
      <p class="small">Don't have an account? <a href="#/register">Register</a></p>`),
    bind() {
      const f = $('#f');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        C.showError(f, '');
        const btn = $('button', f); btn.disabled = true;
        try {
          const d = Object.fromEntries(new FormData(f));
          await finishLogin(await C.api('/auth/login', { method: 'POST', body: d }));
        } catch (err) { C.showError(f, err.message); btn.disabled = false; }
      });
    },
  });

  C.pages.register = async () => ({
    raw: true,
    html: authFrame(`
      <form id="f" novalidate>
        <div class="alert" role="alert" hidden></div>
        <label class="field"><span>Student ID</span><input name="student_id" required></label>
        <label class="field"><span>Full name</span><input name="name" autocomplete="name" required></label>
        <label class="field"><span>College email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Password (min. 6 characters)</span>
          <input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
        <button class="btn primary block">Create account</button>
      </form>
      <p class="small">Already registered? <a href="#/login">Log in</a></p>`),
    bind() {
      const f = $('#f');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        C.showError(f, '');
        const btn = $('button', f); btn.disabled = true;
        try {
          const d = Object.fromEntries(new FormData(f));
          await finishLogin(await C.api('/auth/register', { method: 'POST', body: d }));
        } catch (err) { C.showError(f, err.message); btn.disabled = false; }
      });
    },
  });
})(window.CLF);