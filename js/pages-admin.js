(function (C) {
  'use strict';
  const { $, $$, esc, kv, fmtDate } = C;
  const pages = C.pages;

  // ---------- Matches table (used on dashboard + Matches page) ----------
  function matchesTable(matches) {
    if (!matches.length) return C.empty('No possible matches right now', 'New lost and found reports are compared automatically.');
    return `<div class="card table-wrap"><table>
      <thead><tr><th>Match ID</th><th>Lost item</th><th>Found item</th><th>Match score</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${matches.map((m) => `<tr>
        <td><b>${esc(m.match_code)}</b></td><td>${esc(m.lost_code)}</td><td>${esc(m.found_code)}</td>
        <td>${C.scorePill(m.score)}</td>
        <td>${m.status === 'open' ? '<span class="badge blue">Open</span>' : m.status === 'claimed' ? '<span class="badge amber">Claim raised</span>'
          : m.status === 'approved' ? '<span class="badge green">Returned</span>' : '<span class="badge red">Rejected</span>'}</td>
        <td><button class="btn primary sm" data-match="${m.id}">View</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function bindMatches() {
    $$('[data-match]').forEach((b) => b.addEventListener('click', () => openMatch(b.dataset.match)));
  }

  async function openMatch(id) {
    let m;
    try { m = (await C.api('/matches/' + id)).match; } catch (e) { return alert(e.message); }
    const L = m.lost, F = m.found;
    const lostMarks = [(L.identifiers || []).join(', '), L.identification_details].filter(Boolean).join(' — ');
    const col = (title, i, who, secretLabel, secret) => `
      <div class="pane"><h4>${title}</h4>
        ${kv('ID', esc(i.report_code))}${kv('Category', esc(i.category))}${kv('Brand', esc(i.brand))}${kv('Color', esc(i.color))}
        ${kv('Location', esc(i.last_seen_location || i.found_location))}${kv('Date', fmtDate(i.date_lost || i.date_found))}
        ${i.condition ? kv('Condition', esc(i.condition)) : ''}
        ${kv('Description', esc(i.description))}
        ${kv('Reported by', esc(who))}
        ${kv('Identifications', secret ? `${esc(secret)} <em class="hide">${secretLabel}</em>` : '<em>Not provided</em>')}
        ${i.photo_path ? `<img class="thumb" src="${esc(C.photoUrl(i.photo_path))}" alt="">` : ''}
      </div>`;
    C.modal(`
      <div class="modal-head"><h3>Match details · ${esc(m.match_code)}</h3><button class="x" data-close aria-label="Close">×</button></div>
      <div class="modal-body">
        <div class="panes">${col('Lost item', L, m.lost_reporter, '(hidden)', lostMarks)}${col('Found item', F, m.found_reporter, '(not visible to public)', F.hidden_details)}</div>
        <p class="match-line">Match score: ${C.scorePill(m.score)}</p>
        <div class="alert" role="alert" hidden></div>
      </div>
      <div class="modal-foot">
        ${m.status === 'open' ? '<button class="btn primary" id="mk-claim">Create claim request</button>'
          : m.claim_code ? `<span class="muted">Claim ${esc(m.claim_code)} already raised</span>` : ''}
        <button class="btn ghost" data-close>Close</button>
      </div>`, (root, close) => {
      const btn = $('#mk-claim', root);
      if (btn) btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const r = await C.api(`/matches/${m.id}/claim`, { method: 'POST' });
          close();
          C.go('#/claims/' + r.claim.id);
        } catch (e) { const a = $('.alert', root); a.textContent = e.message; a.hidden = false; btn.disabled = false; }
      });
    });
  }

  // ---------- Admin dashboard ----------
  pages._adminDashboard = async () => {
    const [stats, { matches }] = await Promise.all([C.api('/stats'), C.api('/matches?status=open')]);
    return {
      active: 'dashboard', title: 'Dashboard',
      html: `
        <div class="stats">
          <div class="stat"><b>${stats.open_matches}</b><span>Possible matches</span></div>
          <div class="stat"><b>${stats.pending_claims}</b><span>Claims to verify</span></div>
          <div class="stat"><b>${stats.lost_total} / ${stats.found_total}</b><span>Lost / found reports</span></div>
          <div class="stat"><b>${stats.returned_total}</b><span>Items returned</span></div>
        </div>
        <h2>Possible matches</h2>${matchesTable(matches)}`,
      bind: bindMatches,
    };
  };

  pages.matches = async () => {
    const { matches } = await C.api('/matches');
    return { active: 'matches', title: 'Matches', html: matchesTable(matches), bind: bindMatches };
  };

  // ---------- Admin: all lost / found ----------
  const itemsTable = (items, locKey, dateKey) => items.length
    ? `<div class="card table-wrap"><table>
      <thead><tr><th>Report ID</th><th>Category</th><th>Brand</th><th>Color</th><th>Location</th><th>Date</th><th>Reported by</th><th>Status</th></tr></thead>
      <tbody>${items.map((i) => `<tr><td>${esc(i.report_code)}</td><td>${esc(i.category)}</td><td>${esc(i.brand) || '—'}</td><td>${esc(i.color) || '—'}</td>
        <td>${esc(i[locKey])}</td><td>${fmtDate(i[dateKey])}</td><td>${esc(i.reporter_name)}<br><small>${esc(i.reporter_student_id)}</small></td>
        <td>${C.itemBadge(i.status)}</td></tr>`).join('')}</tbody></table></div>`
    : C.empty('Nothing here yet', 'Reports will appear as students submit them.');

  pages['admin-lost'] = async () => {
    const { items } = await C.api('/lost');
    return { active: 'admin-lost', title: 'Lost Items', html: itemsTable(items, 'last_seen_location', 'date_lost') };
  };
  pages['admin-found'] = async () => {
    const { items } = await C.api('/found');
    return { active: 'admin-found', title: 'Found Items', html: itemsTable(items, 'found_location', 'date_found') };
  };

  pages.users = async () => {
    const { users } = await C.api('/users');
    return {
      active: 'users', title: 'Users',
      html: `<div class="card table-wrap"><table>
        <thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Role</th><th>Lost</th><th>Found</th><th>Joined</th></tr></thead>
        <tbody>${users.map((u) => `<tr><td>${esc(u.student_id)}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td>
          <td>${u.lost_count}</td><td>${u.found_count}</td><td>${fmtDate(u.created_at)}</td></tr>`).join('')}</tbody></table></div>`,
    };
  };

  // ---------- Admin: claim list ----------
  pages._adminClaims = async () => {
    const { claims } = await C.api('/claims');
    return {
      active: 'claims', title: 'Claim Requests',
      html: claims.length ? `<div class="card table-wrap"><table>
        <thead><tr><th>Claim ID</th><th>Student</th><th>Lost item</th><th>Found item</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${claims.map((c) => `<tr><td><b>${esc(c.claim_code)}</b></td><td>${esc(c.student_name)}<br><small>${esc(c.student_id)}</small></td>
          <td>${esc(c.lost_code)}</td><td>${esc(c.found_code)}</td><td>${C.claimBadge(c.status)}</td>
          <td><a class="btn primary sm" href="#/claims/${c.id}">${c.status === 'pending' ? 'Verify' : 'View'}</a></td></tr>`).join('')}</tbody></table></div>`
        : C.empty('No claim requests', 'Create one from a possible match on the dashboard.', ['#/dashboard', 'See possible matches']),
    };
  };

  // ---------- Claim detail (student + admin) ----------
  pages.claim = async (ctx) => {
    const { claim: c } = await C.api('/claims/' + ctx.parts[1]);
    const admin = C.state.user.role === 'admin';
    const L = c.lost;

    // Student: approved
    if (!admin && c.status === 'approved') {
      return {
        active: 'claims', title: 'Claim Approved',
        html: `<div class="card success"><div class="tick">✓</div><h2>Claim approved</h2>
          <p>The item has been marked as returned. Collect it from the admin office.</p>
          <div class="narrow-kv">${kv('Claim ID', esc(c.claim_code))}${kv('Lost item ID', esc(L.report_code))}${kv('Found item ID', esc(c.found.report_code))}
          ${c.verification_note ? kv('Admin note', esc(c.verification_note)) : ''}</div>
          <a class="btn primary" href="#/my-items">View details</a></div>`,
      };
    }

    const summary = `
      ${kv('Claim ID', esc(c.claim_code))}${kv('Status', C.claimBadge(c.status))}
      ${kv('Lost item ID', esc(L.report_code))}${kv('Found item ID', esc(c.found.report_code))}
      ${kv('Student', `${esc(c.student_name)} (${esc(c.student_id)})`)}
      ${kv('Item', `${esc(L.category)}${L.brand ? ', ' + esc(L.brand) : ''}${L.color ? ', ' + esc(L.color) : ''}`)}`;

    if (!admin) {
      const open = c.status === 'pending';
      return {
        active: 'claims', title: `Claim ${c.claim_code}`,
        html: `<div class="card form narrow">${summary}
          ${c.status === 'rejected' ? `<div class="alert">This claim was rejected.${c.verification_note ? ' Admin note: ' + esc(c.verification_note) : ''}</div>` : ''}
          <form id="f">
            <div class="alert" role="alert" hidden></div>
            <label class="field"><span>Prove it's yours</span>
              <textarea name="response" rows="4" ${open ? '' : 'disabled'}
                placeholder="Describe something only the owner would know, such as marks, contents or initials.">${esc(c.student_response)}</textarea></label>
            <div class="row-end"><a class="btn ghost" href="#/claims">Back</a>
              ${open ? '<button class="btn primary">Send answer</button>' : ''}</div>
          </form></div>`,
        bind() {
          const f = $('#f');
          f.addEventListener('submit', async (e) => {
            e.preventDefault(); C.showError(f, '');
            try {
              await C.api(`/claims/${c.id}/response`, { method: 'PUT', body: { response: f.response.value } });
              C.showError(f, ''); $('button.primary', f).textContent = 'Answer sent';
            } catch (err) { C.showError(f, err.message); }
          });
        },
      };
    }

    // Admin verify view
    const pending = c.status === 'pending';
    const F = c.found;
    return {
      active: 'claims', title: 'Verify Claim Request',
      html: `<div class="card form narrow">${summary}
        <div class="sep"></div>
        ${kv("Student's answer", esc(c.student_response) || '<em>Not answered yet</em>')}
        ${kv("Owner's secret details (lost report)", esc([(L.identifiers || []).join(', '), L.identification_details].filter(Boolean).join(' — ')))}
        ${kv('Hidden marks (found report)', esc(F.hidden_details))}
        <form id="f">
          <div class="alert" role="alert" hidden></div>
          <label class="field"><span>Verification notes</span>
            <textarea name="note" rows="3" ${pending ? '' : 'disabled'} placeholder="Record how you verified the owner, e.g. initials matched.">${esc(c.verification_note)}</textarea></label>
          <div class="row-end"><a class="btn ghost" href="#/claims">Back</a>
            ${pending ? '<button type="button" class="btn danger" data-decide="rejected">Reject</button><button type="button" class="btn success" data-decide="approved">Approve</button>' : ''}</div>
        </form></div>`,
      bind() {
        const f = $('#f');
        $$('[data-decide]', f).forEach((b) => b.addEventListener('click', async () => {
          C.showError(f, '');
          const status = b.dataset.decide;
          if (!confirm(status === 'approved' ? 'Approve this claim and mark the item as returned?' : 'Reject this claim?')) return;
          $$('[data-decide]', f).forEach((x) => (x.disabled = true));
          try {
            await C.api(`/claims/${c.id}/verify`, { method: 'PUT', body: { status, note: f.note.value } });
            C.go('#/claims');
          } catch (err) { C.showError(f, err.message); $$('[data-decide]', f).forEach((x) => (x.disabled = false)); }
        }));
      },
    };
  };
})(window.CLF);
