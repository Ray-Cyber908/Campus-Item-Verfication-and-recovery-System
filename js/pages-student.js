(function (C) {
  'use strict';
  const { $, $$, esc, kv, fmtDate } = C;
  const pages = C.pages;

  const COLORS = ['Black', 'White', 'Grey', 'Silver', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Pink', 'Purple', 'Gold', 'Multicolor'];
  const IDENTIFIERS = ['Scratch / Crack', 'Sticker', 'Initials / Name', 'Specific Mark', 'Missing Component', 'Other'];

  const options = (list, placeholder) =>
    `<option value="">${esc(placeholder)}</option>` + list.map((o) => `<option>${esc(o)}</option>`).join('');

  async function categories() {
    if (!C.state.categories) C.state.categories = (await C.api('/lost/categories')).categories;
    return C.state.categories;
  }

  // ---------- Dashboard (student) / dispatcher ----------
  pages.dashboard = async (ctx) => {
    if (C.state.user.role === 'admin') return pages._adminDashboard(ctx);
    const [stats, items, claims] = await Promise.all([C.api('/stats'), C.api('/items/mine'), C.api('/claims/mine')]);
    const recent = [...items.lost.map((i) => ({ ...i, kind: 'Lost' })), ...items.found.map((i) => ({ ...i, kind: 'Found' }))]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    const waiting = claims.claims.filter((c) => c.status === 'pending');

    return {
      active: 'dashboard', title: 'Dashboard',
      html: `
        ${waiting.length ? `<div class="notice"><b>Good news.</b> Your lost item may have been found.
          <a href="#/claims">Review ${waiting.length} claim request${waiting.length > 1 ? 's' : ''}</a></div>` : ''}
        <div class="stats">
          <div class="stat"><b>${stats.lost_total}</b><span>Lost reports</span></div>
          <div class="stat"><b>${stats.found_total}</b><span>Found reports</span></div>
          <div class="stat"><b>${stats.returned_total}</b><span>Items returned</span></div>
          <div class="stat"><b>${stats.pending_claims}</b><span>Claims waiting</span></div>
        </div>
        <div class="actions">
          <a class="btn primary" href="#/report-lost">Report a lost item</a>
          <a class="btn ghost" href="#/report-found">Report a found item</a>
        </div>
        <h2>Recent reports</h2>
        ${recent.length ? `<div class="card table-wrap"><table>
          <thead><tr><th>Report ID</th><th>Type</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${recent.map((i) => `<tr><td>${esc(i.report_code)}</td><td>${i.kind}</td><td>${esc(i.category)}</td>
            <td>${C.itemBadge(i.status)}</td><td>${fmtDate(i.created_at)}</td></tr>`).join('')}</tbody></table></div>`
          : C.empty('No reports yet', 'Lost something or found something? Start with a report.', ['#/report-lost', 'Report a lost item'])}`,
    };
  };

  // ---------- Report Lost ----------
  pages['report-lost'] = async () => {
    const cats = await categories();
    return {
      active: 'report-lost', title: 'Report Lost Item',
      html: `
      <form id="f" class="card form" novalidate>
        <div class="alert" role="alert" hidden></div>
        <div class="grid2">
          <label class="field"><span>Item category *</span><select name="category" required>${options(cats, 'Select category')}</select></label>
          <label class="field"><span>Brand (if any)</span><input name="brand"></label>
          <label class="field"><span>Colour</span><select name="color">${options(COLORS, 'Not sure')}</select></label>
          <label class="field"><span>Last seen location *</span><input name="last_seen_location" placeholder="e.g. Drawing Lab" required></label>
          <label class="field"><span>Date lost (approx.) *</span><input name="date_lost" type="date" max="${C.today()}" value="${C.today()}" required></label>
        </div>
        <label class="field"><span>Description *</span>
          <textarea name="description" rows="3" placeholder="What does it look like? Size, condition, what's inside." required></textarea></label>

        <fieldset class="field">
          <legend>Unique identification details <small>(important)</small></legend>
          <div class="checks">${IDENTIFIERS.map((o) => `<label><input type="checkbox" name="identifiers" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div>
          <textarea name="identification_details" rows="3"
            placeholder="Something only the owner would know, e.g. initials written inside, a broken corner. This is hidden from everyone except admins."></textarea>
          <p class="hint">${C.icon('lock')} Only you and the admin can see this. It is used to verify your claim.</p>
        </fieldset>

        <label class="field"><span>Photo (optional)</span><input name="photo" type="file" accept="image/*"></label>
        <div class="row-end"><button class="btn primary">Submit report</button></div>
      </form>`,
      bind() { bindReport($('#f'), '/lost'); },
    };
  };

  // ---------- Report Found ----------
  pages['report-found'] = async () => {
    const cats = await categories();
    return {
      active: 'report-found', title: 'Report Found Item',
      html: `
      <form id="f" class="card form" novalidate>
        <div class="alert" role="alert" hidden></div>
        <div class="grid2">
          <label class="field"><span>Item category *</span><select name="category" required>${options(cats, 'Select category')}</select></label>
          <label class="field"><span>Brand (if any)</span><input name="brand"></label>
          <label class="field"><span>Colour</span><select name="color">${options(COLORS, 'Not sure')}</select></label>
          <label class="field"><span>Found location *</span><input name="found_location" placeholder="e.g. Drawing Lab" required></label>
          <label class="field"><span>Date found *</span><input name="date_found" type="date" max="${C.today()}" value="${C.today()}" required></label>
          <label class="field"><span>Condition</span><input name="condition" placeholder="e.g. Right corner damaged"></label>
        </div>
        <label class="field"><span>Description *</span>
          <textarea name="description" rows="3" placeholder="Describe the item. This helps match it to its owner." required></textarea></label>
        <label class="field"><span>Hidden identification marks (optional)</span>
          <textarea name="hidden_details" rows="2" placeholder="Anything private, e.g. initials inside. Not visible to the public — only the admin sees this."></textarea></label>
        <p class="hint">${C.icon('lock')} Hidden marks are never shown to students. The admin uses them to check the real owner.</p>
        <label class="field"><span>Photo (optional)</span><input name="photo" type="file" accept="image/*"></label>
        <div class="row-end"><button class="btn primary">Submit report</button></div>
      </form>`,
      bind() { bindReport($('#f'), '/found'); },
    };
  };

  function bindReport(form, endpoint) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      C.showError(form, '');
      const btn = $('button.primary', form); btn.disabled = true;
      try {
        const fd = new FormData(form);
        if (!fd.get('photo') || !fd.get('photo').size) fd.delete('photo');
        const r = await C.api(endpoint, { method: 'POST', form: fd });
        C.state.submitted = { kind: endpoint === '/lost' ? 'Lost' : 'Found', code: r.report_code };
        C.go('#/submitted');
      } catch (err) { C.showError(form, err.message); btn.disabled = false; window.scrollTo(0, 0); }
    });
  }

  // ---------- Confirmation ----------
  pages.submitted = async () => {
    const s = C.state.submitted;
    if (!s) return { redirect: '#/my-items' };
    return {
      active: s.kind === 'Lost' ? 'report-lost' : 'report-found', title: `${s.kind} Item Submitted`,
      html: `<div class="card success">
        <div class="tick">✓</div>
        <h2>${s.kind} item reported successfully</h2>
        <p>Your ${s.kind.toLowerCase()} item report ID is</p>
        <div class="code">${esc(s.code)}</div>
        <p class="muted">Keep this ID for future reference. We'll look for matches automatically.</p>
        <a class="btn primary" href="#/my-items">Go to My Items</a></div>`,
    };
  };

  // ---------- My Items ----------
  pages['my-items'] = async (ctx) => {
    const data = await C.api('/items/mine');
    const tab = ctx.query.get('tab') === 'found' ? 'found' : 'lost';
    const list = tab === 'found' ? data.found : data.lost;
    const loc = (i) => i.last_seen_location || i.found_location;
    const dt = (i) => i.date_lost || i.date_found;
    return {
      active: 'my-items', title: 'My Items',
      html: `
        <div class="tabs">
          <a href="#/my-items?tab=lost" class="${tab === 'lost' ? 'on' : ''}">Lost Items (${data.lost.length})</a>
          <a href="#/my-items?tab=found" class="${tab === 'found' ? 'on' : ''}">Found Items (${data.found.length})</a>
        </div>
        ${list.length ? list.map((i, n) => `
          <article class="card item">
            <header><h3>${esc(i.report_code)}</h3>${C.itemBadge(i.status)}</header>
            <div class="item-body">
              ${i.photo_path ? `<img src="${esc(C.photoUrl(i.photo_path))}" alt="Photo of ${esc(i.category)}">` : ''}
              <div>
                ${kv('Category', esc(i.category))}${kv('Brand', esc(i.brand))}${kv('Color', esc(i.color))}
                ${kv(tab === 'found' ? 'Found at' : 'Location', esc(loc(i)))}${kv('Date', fmtDate(dt(i)))}
              </div>
            </div>
            <button class="btn primary sm" data-view="${n}">View details</button>
          </article>`).join('')
          : C.empty(`No ${tab} items yet`, `Reports you submit will show up here with their status.`,
              [tab === 'found' ? '#/report-found' : '#/report-lost', tab === 'found' ? 'Report a found item' : 'Report a lost item'])}`,
      bind() {
        $$('[data-view]').forEach((b) => b.addEventListener('click', () => {
          const i = list[+b.dataset.view];
          C.modal(`<div class="modal-head"><h3>${esc(i.report_code)}</h3><button class="x" data-close aria-label="Close">×</button></div>
            <div class="modal-body">
              ${kv('Status', C.itemBadge(i.status))}${kv('Category', esc(i.category))}${kv('Brand', esc(i.brand))}${kv('Color', esc(i.color))}
              ${kv(tab === 'found' ? 'Found at' : 'Last seen', esc(loc(i)))}${kv('Date', fmtDate(dt(i)))}
              ${i.condition ? kv('Condition', esc(i.condition)) : ''}
              ${kv('Description', esc(i.description))}
              ${i.identifiers && i.identifiers.length ? kv('Marks', esc(i.identifiers.join(', '))) : ''}
              ${kv('Hidden details', esc(i.identification_details || i.hidden_details))}
              ${i.photo_path ? `<img class="big" src="${esc(C.photoUrl(i.photo_path))}" alt="">` : ''}
            </div>`);
        }));
      },
    };
  };

  // ---------- Claim requests: list (student) / dispatcher ----------
  pages.claims = async (ctx) => {
    if (C.state.user.role === 'admin') return pages._adminClaims(ctx);
    const { claims } = await C.api('/claims/mine');
    return {
      active: 'claims', title: 'My Claim Requests',
      html: claims.length ? `<div class="card table-wrap"><table>
        <thead><tr><th>ID</th><th>Item</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${claims.map((c) => `<tr><td>${esc(c.claim_code)}</td><td>${esc(c.item)}</td><td>${C.claimBadge(c.status)}</td>
          <td><a class="btn ghost sm" href="#/claims/${c.id}">View</a></td></tr>`).join('')}</tbody></table></div>`
        : C.empty('No claim requests yet', 'When the admin finds a match for your lost item, the claim appears here.'),
    };
  };

  // ---------- Profile ----------
  pages.profile = async () => {
    const u = C.state.user;
    return {
      active: 'profile', title: 'Profile',
      html: `<div class="card form narrow">${kv('Name', esc(u.name))}${kv('Student ID', esc(u.student_id))}${kv('Email', esc(u.email))}
        ${kv('Role', esc(u.role))}${kv('Member since', fmtDate(u.created_at))}</div>`,
    };
  };
})(window.CLF);
