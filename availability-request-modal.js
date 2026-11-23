/* =====================================================================
   Dashboard → Needing Action → Availability Request  (manager approval)
   Replaces the old side-by-side "Current | Requested" pop-up.
   Keeps the same entry point: openAvailabilityModal(name, userId)
   Shows: effective date (when the request starts), hours change,
   per-day compare bars (current vs requested), employee's reason,
   conflicts with scheduled shifts, and Approve / Disapprove (with note).
   ===================================================================== */
(function () {
  'use strict';

  const STORE_TZ = 'America/Chicago', STORE_TZ_LABEL = 'America/Chicago (CT)';
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- dates (store timezone) ---------- */
  function TODAY() {
    const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}`;
  }
  const toD = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const addDays = (iso, n) => { const d = toD(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const weekday = iso => toD(iso).getUTCDay();
  const fmt = iso => { const d = toD(iso); return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const fmtDT = (iso, hm) => { let [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${fmt(iso)}, ${h}:${String(m).padStart(2, '0')} ${ap}`; };
  const tL = h => { const x = ((h % 24) + 24) % 24; return `${x % 12 || 12}:00${x < 12 ? 'a' : 'p'}`; };
  const hS = h => { const x = h % 24; return x === 0 ? '12A' : x < 12 ? x + 'A' : x === 12 ? '12P' : (x - 12) + 'P'; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- grid helpers ---------- */
  const full = () => DAYS.map(() => Array(24).fill(true));
  const empty = () => DAYS.map(() => Array(24).fill(false));
  const set = (g, d, s, e, v) => { for (let h = s; h < e; h++) g[d][h] = v; };
  const rowHrs = r => r.filter(Boolean).length;
  const gridHrs = g => g.reduce((a, r) => a + rowHrs(r), 0);
  function ranges(row) { const o = []; let s = null; for (let h = 0; h <= 24; h++) { const on = h < 24 && row[h]; if (on && s === null) s = h; if (!on && s !== null) { o.push([s, h]); s = null; } } return o; }
  const rangeText = row => { const r = ranges(row); if (!r.length) return 'Unavailable'; if (r.length === 1 && r[0][0] === 0 && r[0][1] === 24) return 'All day'; return r.map(([a, b]) => `${tL(a)} – ${tL(b)}`).join(', '); };

  /* ---------- demo requests (keyed by userId used in the Needing Action list) ---------- */
  function buildRequests() {
    const T = TODAY();
    const R = {};
    // Sarah — the case from the old pop-up: Friday 4p–7p no longer available
    { const c = full(), r = full(); set(r, 5, 16, 19, false);
      R['sarah.jenkins'] = { role: 'Cashier, Crew', cur: c, req: r, curSince: addDays(T, -120), eff: addDays(T, 12), sub: [addDays(T, -1), '09:42'],
        reason: 'I have a weekly class on Friday evenings starting next month.', shifts: [{ dow: 5, s: 16, e: 21, role: 'Cashier' }] }; }
    // Ben — weekdays mornings only; manager already has an upcoming change
    { const c = empty(), r = empty(); for (let d = 0; d < 7; d++) set(c, d, 6, 22, true); for (let d = 1; d <= 5; d++) set(r, d, 6, 15, true); set(r, 6, 8, 16, true);
      R['ben.carter'] = { role: 'Line Cook', cur: c, req: r, curSince: addDays(T, -60), eff: addDays(T, 7), sub: [addDays(T, -2), '18:05'],
        reason: 'Starting a second job in the evenings.', shifts: [{ dow: 2, s: 14, e: 22, role: 'Line Cook' }, { dow: 4, s: 16, e: 22, role: 'Line Cook' }],
        mgrUp: { eff: addDays(T, 14), hrs: 80, by: 'Priya Sharma' } }; }
    // Maria — weekends off
    { const c = empty(), r = empty(); for (let d = 0; d < 7; d++) { set(c, d, 9, 21, true); set(r, d, 9, 21, true); } set(r, 0, 0, 24, false); set(r, 6, 0, 24, false);
      R['maria.lopez'] = { role: 'Shift Leader', cur: c, req: r, curSince: addDays(T, -200), eff: addDays(T, 21), sub: [addDays(T, -3), '11:20'],
        reason: 'Family commitments on weekends.', shifts: [] }; }
    // Omar — adds evenings (more availability)
    { const c = empty(), r = empty(); for (let d = 1; d <= 5; d++) { set(c, d, 9, 17, true); set(r, d, 9, 22, true); }
      R['omar.haddad'] = { role: 'Prep Cook, Dishwasher', cur: c, req: r, curSince: addDays(T, -90), eff: addDays(T, 3), sub: [T, '08:15'],
        reason: 'Can now work evenings on weekdays.', shifts: [] }; }
    // Aisha — Tuesday off, Thursday shorter
    { const c = empty(), r = empty(); for (let d = 0; d < 7; d++) { set(c, d, 7, 19, true); set(r, d, 7, 19, true); } set(r, 2, 0, 24, false); set(r, 4, 15, 19, false);
      R['aisha.khan'] = { role: 'Crew', cur: c, req: r, curSince: addDays(T, -30), eff: addDays(T, 10), sub: [addDays(T, -1), '16:48'],
        reason: '', shifts: [{ dow: 2, s: 8, e: 14, role: 'Crew' }] }; }
    return R;
  }
  let REQ = null;
  const reqFor = id => { REQ = REQ || buildRequests(); return REQ[id] || REQ['sarah.jenkins']; };

  /* published shifts on/after the effective date that fall outside the requested hours (next 2 weeks) */
  function conflicts(q) {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const iso = addDays(q.eff, i), dow = weekday(iso);
      q.shifts.filter(s => s.dow === dow).forEach(s => {
        for (let h = s.s; h < s.e; h++) if (!q.req[dow][h % 24]) { out.push({ iso, ...s }); break; }
      });
    }
    return out;
  }

  /* ---------- DOM ---------- */
  const $ = id => document.getElementById(id);
  let S = null;   // { name, id, q, view, declining, decided }

  function ensureDom() {
    if ($('arqWrap')) return;
    const w = document.createElement('div');
    w.className = 'arq-wrap'; w.id = 'arqWrap';
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'arqTitle');
    w.innerHTML = `<div class="arq" id="arq"></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', onClick);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && w.classList.contains('open')) { e.stopPropagation(); close(); } }, true);
  }
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };

  function render() {
    const q = S.q, T = TODAY(), cur = gridHrs(q.cur), req = gridHrs(q.req), diff = req - cur;
    const n = daysBetween(T, q.eff);
    const changed = DAYS.map((d, i) => q.cur[i].some((v, h) => v !== q.req[i][h]) ? d : null).filter(Boolean);
    const cf = conflicts(q);
    const td = weekday(T);
    const status = S.decided ? (S.decided === 'approved' ? '<span class="arq-pill approved">Approved</span>' : '<span class="arq-pill rejected">Disapproved</span>') : '<span class="arq-pill pending">Pending approval</span>';

    /* notes */
    const notes = [];
    if (q.mgrUp) notes.push(`<div class="arq-note mgr"><i data-lucide="user-cog"></i><div>${esc(S.name.split(' ')[0])} already has an <b>upcoming change from ${fmt(q.mgrUp.eff)}</b> (${q.mgrUp.hrs} hrs/week, set by ${esc(q.mgrUp.by)}). Only one upcoming availability can exist, so approving this request <b>replaces</b> it.</div></div>`);
    if (cf.length) notes.push(`<div class="arq-note warn"><i data-lucide="alert-triangle"></i><div><b>${cf.length} scheduled shift${cf.length > 1 ? 's' : ''}</b> fall outside the requested hours. They stay on the schedule and get flagged if you approve.
      <ul>${cf.slice(0, 4).map(s => `<li>${DAYS[s.dow]}, ${fmt(s.iso)}: ${tL(s.s)} – ${tL(s.e)} (${esc(s.role)})</li>`).join('')}${cf.length > 4 ? `<li>+${cf.length - 4} more</li>` : ''}</ul></div></div>`);
    if (q.reason) notes.push(`<div class="arq-note quote"><i data-lucide="message-square-quote"></i><div><b>${esc(S.name.split(' ')[0])}’s note:</b> <i>“${esc(q.reason)}”</i></div></div>`);

    /* compare grid */
    const mode = S.view;   // compare | req | cur
    let g = `<div class="arq-grid"><div class="arq-day head"><div></div><div class="arq-line"><div></div>${Array.from({ length: 24 }, (_, i) => `<div class="hc">${hS(i)}</div>`).join('')}</div><div class="arq-sum"><span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--arq-ink-3)">${mode === 'cur' ? 'Current hours' : 'Requested hours'}</span></div></div>`;
    DAYS.forEach((dn, d) => {
      const diffDay = q.cur[d].some((v, h) => v !== q.req[d][h]);
      const curLine = `<div class="arq-line cur"><div class="lbl">Current</div>${q.cur[d].map(v => `<div class="c ${v ? 'on' : ''}"></div>`).join('')}</div>`;
      const reqLine = `<div class="arq-line req"><div class="lbl">Requested</div>${q.req[d].map((v, h) => { const was = q.cur[d][h]; const cls = v ? ('on' + (!was ? ' add' : '')) : (was && mode === 'compare' ? 'rem' : ''); return `<div class="c ${cls}"></div>`; }).join('')}</div>`;
      const lines = mode === 'compare' ? curLine + reqLine : mode === 'req' ? reqLine : curLine;
      const row = mode === 'cur' ? q.cur[d] : q.req[d];
      const was = mode === 'compare' && diffDay ? `<div class="was">was ${rangeText(q.cur[d])}</div>` : '';
      g += `<div class="arq-day ${diffDay && mode !== 'cur' ? 'chg' : ''}"><div class="arq-dn ${d === td ? 'today' : ''}" ${d === td ? 'title="Today"' : ''}>${dn}</div><div class="arq-lines">${lines}</div>
        <div class="arq-sum"><div class="r ${rowHrs(row) ? '' : 'none'}">${rangeText(row)}</div>${was}
        ${mode !== 'cur' ? `<span class="arq-tag ${diffDay ? 'diff' : 'same'}">${diffDay ? `Changed · ${rowHrs(q.cur[d])} → ${rowHrs(q.req[d])} hrs` : 'No change'}</span>` : ''}</div></div>`;
    });
    g += `</div>`;

    const legend = mode === 'compare'
      ? `<span><i style="background:var(--arq-cur);border-color:var(--arq-cur)"></i>Current</span><span><i style="background:var(--arq-avail);border-color:var(--arq-avail)"></i>Requested</span><span><i style="background:var(--arq-avail);box-shadow:inset 0 -3px 0 var(--arq-brand)"></i>Added hour</span><span><i style="background:repeating-linear-gradient(135deg,var(--arq-danger-soft),var(--arq-danger-soft) 3px,#f87171 3px,#f87171 5px)"></i>Removed hour</span>`
      : `<span><i style="background:${mode === 'cur' ? 'var(--arq-cur)' : 'var(--arq-avail)'}"></i>Available</span><span><i style="background:var(--arq-off)"></i>Unavailable</span>`;
    const deltaCls = diff > 0 ? 'up' : diff < 0 ? 'dn' : 'eq';
    const deltaTxt = diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff} hrs`;

    $('arq').innerHTML = `
      <div class="arq-hd">
        <img src="https://i.pravatar.cc/80?u=${encodeURIComponent(S.id)}" alt="">
        <div class="min-w-0"><h2 id="arqTitle">${esc(S.name)}’s availability request</h2>
          <div class="sub"><span>${esc(q.role)}</span><span class="sep"></span><span>Store timezone: ${STORE_TZ_LABEL}</span><span class="sep"></span>${status}</div></div>
        <button type="button" class="arq-x" data-act="close" aria-label="Close" title="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="arq-stats">
        <div class="arq-stat eff"><div class="k"><i data-lucide="calendar-check"></i>Effective from</div><div class="v">${fmt(q.eff)}</div>
          <div class="m">${n <= 0 ? 'Starts today if approved' : `${DAYS_FULL[weekday(q.eff)]} · in ${n} day${n === 1 ? '' : 's'}`}</div>
          <div class="m" style="color:var(--arq-ink-3)">Current applies until ${fmt(addDays(q.eff, -1))}</div></div>
        <div class="arq-stat"><div class="k"><i data-lucide="clock"></i>Weekly hours</div><div class="v">${cur} → ${req} hrs <span class="arq-delta ${deltaCls}">${deltaTxt}</span></div>
          <div class="m">${changed.length ? `${changed.length} day${changed.length > 1 ? 's' : ''} changed` : 'Same hours as now'}</div></div>
        <div class="arq-stat"><div class="k"><i data-lucide="history"></i>Current since</div><div class="v">${fmt(q.curSince)}</div>
          <div class="m">${gridHrs(q.cur)} available hrs / week</div></div>
        <div class="arq-stat"><div class="k"><i data-lucide="send"></i>Submitted</div><div class="v">${fmtDT(q.sub[0], q.sub[1])}</div>
          <div class="m">by ${esc(S.name)}</div></div>
      </div>
      <div class="arq-scroll">
      ${notes.length ? `<div class="arq-notes">${notes.join('')}</div>` : ''}
      <div class="arq-bar">
        <div class="arq-seg" role="tablist">
          <button type="button" data-view="compare" class="${mode === 'compare' ? 'on' : ''}"><i data-lucide="git-compare"></i>Compare</button>
          <button type="button" data-view="req" class="${mode === 'req' ? 'on' : ''}">Requested</button>
          <button type="button" data-view="cur" class="${mode === 'cur' ? 'on' : ''}">Current</button>
        </div>
        <div class="arq-chg-days">${changed.length ? `Changed days ${changed.map(d => `<b>${d}</b>`).join('')}` : 'No day changes'}</div>
      </div>
      <div class="arq-body">${g}</div>
      </div>
      <div class="arq-legend">${legend}<span class="tot">Weekly available hours <b>${mode === 'compare' ? `${cur} → ${req} hrs` : `${mode === 'cur' ? cur : req} hrs`}</b></span></div>
      <div class="arq-ft">${footer()}</div>`;
    icons();
  }

  function footer() {
    if (S.decided) return `<span class="hint"><i data-lucide="check-circle-2"></i>${S.decided === 'approved' ? 'Approved' : 'Disapproved'} — ${esc(S.name.split(' ')[0])} has been notified.</span><button type="button" class="arq-btn" data-act="close">Close</button>`;
    if (S.declining) return `<div class="arq-decline"><label for="arqNote">Note to ${esc(S.name.split(' ')[0])} <span>(optional — shown with the disapproval)</span></label>
        <textarea id="arqNote" placeholder="e.g. We need coverage on Friday evenings. Please keep 4–7 PM available."></textarea></div>
      <span class="hint"><i data-lucide="info"></i>The current availability stays in effect.</span>
      <button type="button" class="arq-btn" data-act="back">Back</button>
      <button type="button" class="arq-btn no solid" data-act="confirm-no"><i data-lucide="x"></i>Disapprove request</button>`;
    return `<span class="hint"><i data-lucide="calendar-clock"></i>Approving schedules it from ${fmt(S.q.eff)}.</span>
      <button type="button" class="arq-btn no" data-act="no"><i data-lucide="x"></i>Disapprove</button>
      <button type="button" class="arq-btn ok" data-act="ok"><i data-lucide="check"></i>Approve</button>`;
  }

  function onClick(e) {
    const t = e.target;
    if (t === $('arqWrap')) return;                     // clicks on the backdrop do nothing
    const v = t.closest('[data-view]'); if (v) { S.view = v.dataset.view; return render(); }
    const a = t.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'close') return close();
    if (act === 'no') { S.declining = true; render(); const n = $('arqNote'); n && n.focus(); return; }
    if (act === 'back') { S.declining = false; return render(); }
    if (act === 'ok') return decide('approved');
    if (act === 'confirm-no') return decide('rejected', ($('arqNote') || {}).value || '');
  }

  function decide(kind, note) {
    S.decided = kind; S.declining = false;
    if (typeof S.onDecide === 'function') S.onDecide(kind, note || '');   // real crew request: save the decision
    markRow(kind);
    toast(kind === 'approved' ? `${S.name}’s availability approved — effective ${fmt(S.q.eff)}` : `${S.name}’s availability request disapproved`);
    render();
  }
  /* update the row in Needing Action → Availability Request */
  function markRow(kind) {
    document.querySelectorAll(`[onclick*="'${S.id}'"]`).forEach(b => {
      const row = b.closest('.sd-row') || (b.parentElement && b.parentElement.parentElement); if (!row) return;
      const pill = row.querySelector('.sd-pill'); if (pill) {
        pill.textContent = kind === 'approved' ? 'Approved' : 'Disapproved';
        pill.className = 'sd-pill';
        pill.style.cssText = kind === 'approved' ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#b91c1c';
      }
      row.querySelectorAll('.sd-icon-btn--ok, .sd-icon-btn--no').forEach(x => { x.disabled = true; x.style.opacity = '.35'; x.style.pointerEvents = 'none'; });
      const sub = row.querySelector('.sd-row-sub'); if (sub && kind === 'approved') sub.textContent = `Availability update · effective ${fmt(S.q.eff)}`;
    });
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'du-toast';
    t.style.zIndex = '10050';
    t.innerHTML = `<i data-lucide="check-circle-2"></i><span>${esc(msg)}</span>`;
    document.body.appendChild(t); icons();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  /* custom (optional): a real request from the crew app — { role, cur, req, curSince, eff, sub, reason, shifts, mgrUp, onDecide } */
  function open(name, userId, custom) {
    ensureDom();
    S = { name, id: userId, q: custom || reqFor(userId), view: 'compare', declining: false, decided: null, onDecide: custom && custom.onDecide };
    $('arqWrap').classList.add('open');
    render();
  }
  function close() { const w = $('arqWrap'); if (w) w.classList.remove('open'); }

  /* replace the old pop-up's entry points */
  window.openAvailabilityModal = open;
  window.closeAvailabilityModal = close;
})();
