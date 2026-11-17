/* =====================================================================
   Team Center → Availability  (the EMPLOYEE's own availability)
   Separate from the manager's availability pop-up on the schedule.
   Open:  window.openMyAvailability()   (Team Center tile / sub menu)
   Layout: left panel  = profile, availability timeline, details of the selected version
           right panel = action bar, note, week board (fitted to the screen), legend
   Data:
     current   { eff, grid[7][24], src }
     mgrUp     { eff, grid, by, at, reason }      manager's upcoming change (max ONE upcoming)
     req       { status, eff, grid, submittedAt, log[] }   one open request (pending | approved)
     history   older requests
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- Config ---------------- */
  const STORE_TZ = 'America/Chicago', STORE_TZ_LABEL = 'America/Chicago (CT)';
  const MIN_NOTICE_DAYS = 1;                    // earliest request date = today + N (store setting)
  const MGR = 'Priya Sharma';
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PARTS = [
    { name: 'Early morning', s: 0, e: 8, lbl: '12a – 8a' },
    { name: 'Morning', s: 8, e: 11, lbl: '8a – 11a' },
    { name: 'Afternoon', s: 11, e: 16, lbl: '11a – 4p' },
    { name: 'Evening', s: 16, e: 19, lbl: '4p – 7p' },
    { name: 'Night', s: 19, e: 24, lbl: '7p – 12a' },
  ];
  const ALL = [0, 1, 2, 3, 4, 5, 6];
  const STATUS = { pending: 'Pending approval', approved: 'Approved', effective: 'Effective', rejected: 'Rejected', cancelled: 'Cancelled' };
  const KIND = {   // colour + icon per version type
    current: { c: 'var(--ea-avail)', icon: 'calendar-check', label: 'Current availability' },
    mgr: { c: 'var(--ea-mgr)', icon: 'user-cog', label: 'Change by your manager' },
    req: { c: 'var(--ea-req)', icon: 'send', label: 'My request' },
  };

  /* ---------------- Dates (store timezone, R14) ---------------- */
  function parts() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return p;
  }
  const TODAY = () => { const p = parts(); return `${p.year}-${p.month}-${p.day}`; };
  const nowStamp = () => { const p = parts(); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
  const toD = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toIso = dt => dt.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = toD(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
  const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const weekday = iso => toD(iso).getUTCDay();
  const fmt = iso => { const d = toD(iso); return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const fmtDT = s => { const [dp, tp] = s.split('T'); let [h, m] = tp.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${fmt(dp)}, ${h}:${String(m).padStart(2, '0')} ${ap}`; };
  const minEff = () => addDays(TODAY(), MIN_NOTICE_DAYS);
  const tS = h => { const x = h % 24; return `${x % 12 || 12}${x < 12 ? 'a' : 'p'}`; };
  const inDays = iso => { const n = daysBetween(TODAY(), iso); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? `in ${n} days` : `${-n} days ago`; };

  /* ---------------- Grid helpers ---------------- */
  const emptyGrid = () => DAYS.map(() => Array(24).fill(false));
  const clone = g => g.map(r => r.slice());
  const same = (a, b) => a.every((r, d) => r.every((v, h) => v === b[d][h]));
  const rowHrs = r => r.filter(Boolean).length;
  const gridHrs = g => g.reduce((a, r) => a + rowHrs(r), 0);
  function ranges(row, s = 0, e = 24) { const o = []; let st = null; for (let h = s; h <= e; h++) { const on = h < e && row[h]; if (on && st === null) st = h; if (!on && st !== null) { o.push([st, h]); st = null; } } return o; }
  const rtext = (row, s, e) => ranges(row, s, e).map(([a, b]) => `${tS(a)}–${tS(b)}`).join(', ');
  function stateOf(g, days, s, e) { let n = 0, t = 0; days.forEach(d => { for (let h = s; h < e; h++) { t++; if (g[d][h]) n++; } }); return n === 0 ? 'off' : n === t ? 'on' : 'part'; }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICO = `<svg class="i-c" width="11" height="11" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.5l2.6 2.6L11 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="i-d" width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const chip = (st, txt) => `<span class="ea-chip st-${st}">${txt || STATUS[st]}</span>`;
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const spark = (g, c) => `<span class="ea-spark" style="--c:${c}" aria-hidden="true">${g.map((r, d) => { const n = rowHrs(r); return `<span><i class="${n ? '' : 'z'}" style="height:${Math.max(2, Math.round(n / 24 * 18))}px"></i><em>${DAYS[d][0]}</em></span>`; }).join('')}</span>`;

  /* ---------------- Me (logged-in employee) ---------------- */
  function me() {
    const e = (typeof employeeData !== 'undefined' && employeeData[0]) || { name: 'Angie Vasquez', position: 'Shift Leader', avatar: '' };
    return { name: e.name, role: e.position || 'Employee', avatar: e.avatar || '' };
  }

  /* ---------------- Data / scenarios ---------------- */
  let S = null;
  function gCurrent() { const g = emptyGrid(); for (let d = 0; d < 7; d++) for (let h = 8; h < 22; h++) g[d][h] = true; for (let h = 8; h < 12; h++) g[2][h] = false; return g; }
  function gMgr() { const g = gCurrent(); for (let d = 1; d <= 5; d++) for (let h = 19; h < 22; h++) g[d][h] = false; return g; }
  function gReq() { const g = emptyGrid(); for (let d = 1; d <= 5; d++) for (let h = 8; h < 19; h++) g[d][h] = true; for (let h = 10; h < 24; h++) { g[0][h] = true; g[6][h] = true; } return g; }
  function scenario(name) {
    const T = TODAY(), ME = me().name;
    S = {
      current: { eff: addDays(T, -14), grid: gCurrent(), src: 'Your request, approved by ' + MGR },
      mgrUp: null, req: null,
      history: [{ status: 'rejected', eff: addDays(T, -60), submittedAt: `${addDays(T, -67)}T11:02`,
        log: [{ t: 'Submitted', at: `${addDays(T, -67)}T11:02`, by: ME }, { t: 'Rejected', at: `${addDays(T, -66)}T10:30`, by: MGR, note: 'We need coverage on Sunday nights.' }] }],
      sel: 'current', compare: false, mode: 'view', baseKey: null, draft: null, eff: '', tried: false, mDay: weekday(T),
    };
    if (['both', 'mgr'].includes(name)) S.mgrUp = { eff: addDays(T, 7), grid: gMgr(), by: MGR, at: `${addDays(T, -2)}T09:40`, reason: 'Weekday late evenings removed' };
    if (['both', 'pending', 'approved'].includes(name)) {
      S.req = { status: 'pending', eff: addDays(T, 14), grid: gReq(), submittedAt: `${addDays(T, -7)}T10:20`,
        log: [{ t: 'Submitted', at: `${addDays(T, -7)}T10:20`, by: ME, note: 'Effective ' + fmt(addDays(T, 7)) },
              { t: 'Updated', at: `${addDays(T, -5)}T16:16`, by: ME, note: `Effective date changed from ${fmt(addDays(T, 7))} to ${fmt(addDays(T, 14))}` }] };
      if (name === 'approved') { S.req.status = 'approved'; S.req.log.push({ t: 'Approved', at: `${addDays(T, -3)}T12:05`, by: MGR }); }
    }
    if (name === 'rejected') S.req = { status: 'rejected', eff: addDays(T, 7), grid: gReq(), submittedAt: `${addDays(T, -5)}T08:30`,
      log: [{ t: 'Submitted', at: `${addDays(T, -5)}T08:30`, by: ME }, { t: 'Rejected', at: `${addDays(T, -4)}T17:10`, by: MGR, note: 'Weekday evenings are short-staffed. Please keep Tue and Thu evenings available.' }] };
  }
  const isOpen = r => r && ['pending', 'approved'].includes(r.status);
  const openReq = () => isOpen(S.req) ? S.req : null;
  const lastAct = r => r.log[r.log.length - 1];
  const gridOf = k => k === 'mgr' && S.mgrUp ? S.mgrUp.grid : k === 'req' && S.req ? S.req.grid : S.current.grid;
  const prevKey = k => (k === 'req' && S.mgrUp && S.req && S.mgrUp.eff <= S.req.eff) ? 'mgr' : 'current';
  const baseGrid = () => gridOf(S.baseKey);
  const editingOpen = () => S.baseKey === 'req' && !!openReq();
  const hoursChanged = () => S.mode === 'edit' && !same(S.draft, baseGrid());
  const hasChanges = () => hoursChanged() || (editingOpen() && !!S.eff && S.eff !== S.req.eff);      // R2

  /* ---------------- DOM ---------------- */
  const $ = id => document.getElementById(id);
  function ensureDom() {
    if ($('eaView')) return;
    const v = document.createElement('div');
    v.id = 'eaView';
    v.innerHTML = `
      <div class="ea-page">
        <aside class="ea-panel ea-side">
          <div class="ea-prof">
            <button type="button" class="ea-icon-btn" id="eaBack" title="Back to Team Center" aria-label="Back to Team Center"><i data-lucide="arrow-left"></i></button>
            <div class="min-w-0"><div class="nm">My availability</div><div class="rl" id="eaSub"></div></div>
            <div class="ea-demo">
              <button type="button" class="ea-icon-btn" id="eaDemoBtn" title="Prototype: switch scenario or act as the manager" aria-label="Prototype controls"><i data-lucide="flask-conical"></i></button>
              <div class="ea-demo-menu" id="eaDemoMenu">
                <div class="cap">Prototype · scenario</div>
                <button type="button" data-sc="both">Manager change + my request</button>
                <button type="button" data-sc="mgr">Manager change only</button>
                <button type="button" data-sc="pending">My request only</button>
                <button type="button" data-sc="approved">Request approved</button>
                <button type="button" data-sc="rejected">Request rejected</button>
                <button type="button" data-sc="none">Nothing upcoming</button>
                <hr><div class="cap">Act as manager</div>
                <button type="button" id="eaMgrApprove"><i data-lucide="check"></i>Approve my request</button>
                <button type="button" id="eaMgrReject"><i data-lucide="x"></i>Reject my request</button>
              </div>
            </div>
          </div>
          <div class="ea-side-scroll">
            <div class="ea-sec"><span>Availability timeline</span><span id="eaTlCount"></span></div>
            <div class="ea-tl" id="eaTl" aria-label="Availability timeline"></div>
            <div class="ea-sec"><span>Details</span></div>
            <div id="eaDet"></div>
          </div>
        </aside>
        <section class="ea-panel ea-main">
          <div class="ea-bar" id="eaBar"></div>
          <div id="eaSub2"></div>
          <div id="eaNote"></div>
          <div class="ea-bw" id="eaBw"><div class="ea-daypick" id="eaDaypick"></div><div id="eaBoard"></div></div>
          <div class="ea-legend" id="eaLegend"></div>
        </section>
      </div>`;
    document.body.appendChild(v);
    const dw = document.createElement('div');
    dw.className = 'ea-dw'; dw.id = 'eaDw';
    dw.innerHTML = `<div class="ea-dlg" role="alertdialog" aria-modal="true" aria-labelledby="eaDTitle">
        <div class="dh"><div class="ic" id="eaDIc"></div><h3 id="eaDTitle"></h3></div>
        <div class="db" id="eaDBody"></div>
        <div class="df"><button type="button" class="ea-btn" id="eaDCancel">Cancel</button><button type="button" class="ea-btn primary" id="eaDOk">OK</button></div>
      </div>`;
    document.body.appendChild(dw);
    bindEvents();
  }

  /* ---------------- Render ---------------- */
  function render() { renderHead(); renderTimeline(); renderDetail(); renderBar(); renderSub(); renderNote(); renderBoard(); renderLegend(); icons(); fit(); }

  function renderHead() {
    // the logged-in employee's own page (manager or crew) — no name / avatar needed
    $('eaSub').innerHTML = `<span class="tz" title="Store timezone: ${STORE_TZ_LABEL}"><i data-lucide="globe"></i>${STORE_TZ_LABEL}</span>`;
  }

  function verCard(key, cls, top, v, m, g) {
    const K = KIND[key];
    return `<button type="button" class="ea-ver ${cls}" data-sel="${key}" style="--c:${K.c}">
      <span class="top"><span class="k">${K.label}</span>${top}</span>
      <span class="v">${v}</span>
      <span class="row"><span class="m">${m}</span>${spark(g, K.c)}</span></button>`;
  }
  function renderTimeline() {
    const view = S.mode === 'view', items = [];
    const selCls = k => (S.sel === k && view ? 'sel' : '');
    items.push(verCard('current', selCls('current'), chip('current', 'In effect'), `Since ${fmt(S.current.eff)}`, `<b>${gridHrs(S.current.grid)}</b> hrs / week`, S.current.grid));
    const ups = [];
    if (S.mgrUp) ups.push({ eff: S.mgrUp.eff, html: verCard('mgr', selCls('mgr'), chip('manager', 'By ' + esc(S.mgrUp.by.split(' ')[0])), `From ${fmt(S.mgrUp.eff)}`, `<b>${gridHrs(S.mgrUp.grid)}</b> hrs / week · ${inDays(S.mgrUp.eff)}`, S.mgrUp.grid) });
    if (S.req) ups.push({ eff: S.req.eff, html: verCard('req', `${isOpen(S.req) ? '' : 'muted'} ${selCls('req')}`, chip(S.req.status), `From ${fmt(S.req.eff)}`, `<b>${gridHrs(S.req.grid)}</b> hrs / week`, S.req.grid) });
    ups.sort((a, b) => a.eff.localeCompare(b.eff)).forEach(u => items.push('<div class="ea-conn"></div>' + u.html));
    if (!openReq()) items.push(`<div class="ea-conn"></div><button type="button" class="ea-ver add" data-start="1"><span class="pl"><i data-lucide="plus"></i></span>
      <span><span class="v" style="display:block">Request a change</span><span class="m">Choose your hours and the date they start</span></span></button>`);
    $('eaTl').innerHTML = items.join('');
    $('eaTlCount').textContent = `${1 + (S.mgrUp ? 1 : 0) + (S.req ? 1 : 0)} version${(S.mgrUp || S.req) ? 's' : ''}`;
  }

  function stepsFor(r) {
    const sub = r.log.find(x => x.t === 'Submitted'), ap = r.log.filter(x => x.t === 'Approved').pop();
    const ok = '<i data-lucide="check"></i>', no = '<i data-lucide="x"></i>';
    const s1 = { c: 'done', i: ok, t: 'Submitted', m: fmtDT(sub.at) };
    if (r.status === 'pending') return [s1, { c: 'now', i: '', t: 'Manager review', m: 'Waiting for approval' }, { c: '', i: '', t: 'Approved', m: '—' }, { c: '', i: '', t: 'Effective', m: fmt(r.eff) }];
    if (r.status === 'approved') return [s1, { c: 'done', i: ok, t: 'Manager review', m: ap.by }, { c: 'done', i: ok, t: 'Approved', m: fmtDT(ap.at) }, { c: 'now', i: '', t: 'Effective', m: `${fmt(r.eff)} · ${inDays(r.eff)}` }];
    if (r.status === 'effective') return [s1, { c: 'done', i: ok, t: 'Manager review', m: ap.by }, { c: 'done', i: ok, t: 'Approved', m: fmtDT(ap.at) }, { c: 'done', i: ok, t: 'Effective', m: fmt(r.eff) }];
    if (r.status === 'rejected') return [s1, { c: 'bad', i: no, t: 'Rejected', m: `${lastAct(r).by}, ${fmtDT(lastAct(r).at)}` }];
    return [s1, { c: 'bad', i: no, t: 'Cancelled', m: fmtDT(lastAct(r).at) }];
  }
  function renderDetail() {
    const o = openReq(); let h = '';
    if (S.sel === 'current') {
      h = `<div class="d">In effect since <b>${fmt(S.current.eff)}</b>. ${esc(S.current.src)}.</div>
        <dl class="ea-kv"><dt>Hours / week</dt><dd>${gridHrs(S.current.grid)} hrs</dd><dt>Days available</dt><dd>${S.current.grid.filter(r => rowHrs(r)).length} of 7</dd>
        <dt>Next change</dt><dd>${S.mgrUp || o ? fmt([S.mgrUp && S.mgrUp.eff, o && o.eff].filter(Boolean).sort()[0]) : 'None scheduled'}</dd></dl>
        ${S.history.length ? '<div class="ea-det-acts"><button type="button" class="ea-btn sm" id="eaShowAct"><i data-lucide="history"></i>Past requests</button></div>' : ''}`;
    } else if (S.sel === 'mgr' && S.mgrUp) {
      h = `<div class="d"><b>${esc(S.mgrUp.by)}</b> changed your availability from <b>${fmt(S.mgrUp.eff)}</b>. Until then, your current availability applies.</div>
        <dl class="ea-kv"><dt>Reason</dt><dd>${esc(S.mgrUp.reason)}</dd><dt>Set on</dt><dd>${fmtDT(S.mgrUp.at)}</dd><dt>Starts</dt><dd>${inDays(S.mgrUp.eff)}</dd>
        <dt>Hours / week</dt><dd>${gridHrs(S.current.grid)} → ${gridHrs(S.mgrUp.grid)} hrs</dd></dl>`;
    } else if (S.sel === 'req' && S.req) {
      const r = S.req, rj = r.status === 'rejected' ? lastAct(r) : null;
      const d = r.status === 'pending' ? `Waiting for manager approval. If approved, applies from <b>${fmt(r.eff)}</b>.`
        : r.status === 'approved' ? `Approved. Becomes your availability on <b>${fmt(r.eff)}</b>.`
        : r.status === 'effective' ? `Approved and in effect since <b>${fmt(r.eff)}</b>.`
        : r.status === 'rejected' ? 'Not approved. You can send a new request.' : 'Cancelled. You can send a new request.';
      h = `<div class="d">${d}</div>
        <ol class="ea-vsteps">${stepsFor(r).map(s => `<li class="${s.c}"><div class="ea-sd">${s.i}</div><div><div class="t">${s.t}</div><div class="m">${esc(s.m)}</div></div></li>`).join('')}</ol>
        ${rj && rj.note ? `<div class="ea-reason"><b>Manager’s note:</b> “${esc(rj.note)}”</div>` : ''}
        <div class="ea-det-acts"><button type="button" class="ea-btn sm" id="eaShowAct"><i data-lucide="history"></i>Activity &amp; past requests</button>
          ${o ? '<button type="button" class="ea-btn sm gd" id="eaCancelReq"><i data-lucide="x-circle"></i>Cancel request</button>' : ''}</div>`;
    }
    $('eaDet').innerHTML = `<div class="ea-det">${h}</div>`;
  }

  function renderBar() {
    const o = openReq();
    if (S.mode === 'edit') {
      const T = TODAY(), nm = addDays(T, ((8 - weekday(T)) % 7) || 7), bad = S.eff && S.eff < minEff();
      const q = (iso, lbl) => `<button type="button" data-q="${iso}" class="${S.eff === iso ? 'on' : ''}">${lbl}</button>`;
      const from = S.baseKey === 'req' ? `your ${o ? o.status : ''} request` : S.baseKey === 'mgr' ? 'your manager’s change' : 'your current availability';
      $('eaBar').innerHTML = `
        <div class="ti"><span class="ic" style="--c:var(--ea-brand)"><i data-lucide="pencil"></i></span>
          <div><b>${editingOpen() ? 'Update my request' : 'Request a change'}</b><small>Starting from ${from}</small></div></div>
        <div class="r">
          <div class="ea-eff"><label for="eaEff">Effective from <em>*</em></label>
            <input type="date" id="eaEff" min="${minEff()}" value="${S.eff}" aria-required="true" class="${(S.tried && !S.eff) || bad ? 'err' : ''}">
            <div class="ea-quick">${q(minEff(), 'Tomorrow')}${q(nm, 'Next Mon')}${q(addDays(nm, 7), 'Mon after')}</div></div>
          <button type="button" class="ea-btn" id="eaCancelEdit">Cancel</button>
          <button type="button" class="ea-btn primary" id="eaSubmit" ${hasChanges() && !bad ? '' : 'disabled'} title="${hasChanges() ? '' : 'Change your hours or effective date to submit'}"><i data-lucide="send"></i>${editingOpen() ? 'Update request' : 'Submit request'}</button>
        </div>`;
      return;
    }
    const K = KIND[S.sel];
    const sub = S.sel === 'current' ? `In effect since ${fmt(S.current.eff)}`
      : S.sel === 'mgr' ? `Set by ${esc(S.mgrUp.by)} · from ${fmt(S.mgrUp.eff)}`
      : `${STATUS[S.req.status]} · from ${fmt(S.req.eff)}`;
    const cmp = S.sel !== 'current' ? `<label class="ea-tog"><input type="checkbox" id="eaCmp" ${S.compare ? 'checked' : ''}><i data-lucide="git-compare"></i>Compare with ${prevKey(S.sel) === 'mgr' ? 'manager’s change' : 'current'}</label>` : '';
    $('eaBar').innerHTML = `<div class="ti"><span class="ic" style="--c:${K.c}"><i data-lucide="${K.icon}"></i></span><div><b>${K.label}</b><small>${sub}</small></div></div>
      <div class="r">${cmp}<button type="button" class="ea-btn primary" data-start="1"><i data-lucide="${o ? 'pencil' : 'plus'}"></i>${o ? 'Update my request' : 'Request a change'}</button></div>`;
  }

  function renderSub() {
    if (S.mode !== 'edit') { $('eaSub2').innerHTML = ''; return; }
    $('eaSub2').innerHTML = `<div class="ea-sub"><span class="ea-hint"><i data-lucide="mouse-pointer-click"></i><span>Tick a <b>whole day</b>, a <b>day part</b>, or tap / drag <b>single hours</b>. The left column applies to <b>all days</b>.</span></span>
      <button type="button" class="ea-btn sm" id="eaUndo" ${hoursChanged() ? '' : 'disabled'}><i data-lucide="undo-2"></i>Undo changes</button></div>`;
  }

  const NOTE_IC = { 'n-muted': 'info', 'n-info': 'info', 'n-warn': 'alert-triangle', 'n-err': 'alert-circle' };
  function renderNote() {
    const o = openReq(); let t = '', cls = '';
    if (S.mode === 'edit') {
      const mgrLine = S.mgrUp ? ` Your manager has a change scheduled from ${fmt(S.mgrUp.eff)}; if your request is approved, it <b>replaces</b> that change.` : '';   // R6
      if (!S.eff) { t = (S.tried ? 'Select an effective date before submitting.' : `Choose the date your new availability starts (earliest ${fmt(minEff())}).`) + mgrLine; cls = S.tried ? 'n-err' : 'n-muted'; }
      else if (S.eff < minEff()) { t = `The effective date must be ${fmt(minEff())} or later.`; cls = 'n-err'; }           // R1
      else if (o && o.status === 'approved') { t = 'This request is already approved. Updating it sends it back to your manager for approval.' + mgrLine; cls = 'n-warn'; }
      else if (o) { t = `Updates your pending request${S.eff !== o.eff ? `; the effective date moves from ${fmt(o.eff)} to <b>${fmt(S.eff)}</b>` : ''}.` + mgrLine; cls = S.mgrUp ? 'n-warn' : 'n-info'; }
      else { t = `If approved, this applies from <b>${fmt(S.eff)}</b>.` + mgrLine; cls = S.mgrUp ? 'n-warn' : 'n-info'; }
    } else if (S.sel === 'req' && o && S.mgrUp) { t = `Your manager also scheduled a change from ${fmt(S.mgrUp.eff)}. If your request is approved, it replaces that change.`; cls = 'n-warn'; }
    else if (S.sel === 'req' && S.req && S.req.status === 'rejected') { t = 'Your manager didn’t approve this request. Use <b>Request a change</b> to send a new one.'; cls = 'n-err'; }
    $('eaNote').innerHTML = t ? `<div class="ea-note ${cls}"><i data-lucide="${NOTE_IC[cls]}"></i><div>${t}</div></div>` : '';
  }

  function cb(st, key, label, lbText, edit) {
    const aria = `${label}: ${st === 'on' ? 'available' : st === 'part' ? 'partly available' : 'unavailable'}`;
    const inner = `<span class="bx">${ICO}</span>${lbText != null ? `<span class="lb">${lbText}</span>` : ''}`;
    return edit ? `<button type="button" class="ea-cb ${st}" role="checkbox" aria-checked="${st === 'on' ? 'true' : st === 'part' ? 'mixed' : 'false'}" aria-label="${aria}" data-k="${key}">${inner}</button>`
      : `<span class="ea-cb ${st}" aria-label="${aria}">${inner}</span>`;
  }

  function renderBoard() {
    const edit = S.mode === 'edit';
    const grid = edit ? S.draft : gridOf(S.sel);
    const base = edit ? baseGrid() : (S.compare && S.sel !== 'current' ? gridOf(prevKey(S.sel)) : null);
    const td = weekday(TODAY());
    $('eaDaypick').innerHTML = DAYS.map((d, i) => `<button type="button" class="${i === S.mDay ? 'on' : ''}" data-day="${i}">${d}<small>${rowHrs(grid[i])}h</small></button>`).join('');
    let h = `<div class="ea-board ${edit ? 'edit' : ''}" id="eaBd">`;
    h += `<div class="ea-col gut"><div class="ea-ch"><span class="cap">${edit ? 'All days' : 'Time'}</span>${edit ? cb(stateOf(grid, ALL, 0, 24), 'w', 'Whole week', 'Whole week', true) : ''}</div>`;
    PARTS.forEach((p, pi) => {
      h += `<div class="ea-bh" title="${p.name} · ${p.lbl}">${edit ? cb(stateOf(grid, ALL, p.s, p.e), `pa|${pi}`, `${p.name} on all days`, `<span class="bn">${p.name}</span>`, true) : `<span class="bn">${p.name}</span>`}<span class="br">${p.lbl}</span></div>`;
      for (let hr = p.s; hr < p.e; hr++) h += edit ? `<button type="button" class="ea-sl" data-k="ha|${hr}" title="Toggle ${tS(hr)}–${tS(hr + 1)} on all days">${tS(hr)}</button>` : `<div class="ea-sl">${tS(hr)}</div>`;
    });
    h += `</div>`;
    DAYS.forEach((dn, d) => {
      const row = grid[d];
      h += `<div class="ea-col ${d === S.mDay ? 'show' : ''}"><div class="ea-ch ${d === td ? 'today' : ''}" ${d === td ? 'title="Today"' : ''}>
        <span class="dn">${dn}<small>${rowHrs(row)} hrs</small></span>${cb(stateOf(grid, [d], 0, 24), `d|${d}`, `${DAYS_FULL[d]} all day`, 'All day', edit)}</div>`;
      PARTS.forEach((p, pi) => {
        const st = stateOf(grid, [d], p.s, p.e);
        const txt = st === 'on' ? 'Available' : st === 'off' ? '—' : rtext(row, p.s, p.e);
        h += `<div class="ea-bh">${cb(st, `p|${pi}|${d}`, `${DAYS_FULL[d]} ${p.name}`, txt, edit)}</div>`;
        for (let hr = p.s; hr < p.e; hr++) {
          const on = row[hr], top = on && (hr === p.s || !row[hr - 1]);
          let end = hr; while (end < p.e && row[end]) end++;
          const lab = top ? `<span class="lab">${tS(hr)}–${tS(end)}</span>` : '';
          let cls = on ? 'on' : '';
          if (top) cls += ' top';
          if (base && base[d][hr] !== on) cls += edit ? ' chg' : (on ? ' new' : ' gone');
          h += `<div class="ea-sl ${cls}" data-d="${d}" data-h="${hr}" title="${DAYS_FULL[d]} ${tS(hr)}–${tS(hr + 1)}">${lab}</div>`;
        }
      });
      h += `</div>`;
    });
    $('eaBoard').innerHTML = h + `</div>`;
    if (edit) bindPaint();
  }

  function renderLegend() {
    const edit = S.mode === 'edit', g = edit ? S.draft : gridOf(S.sel), cmp = !edit && S.compare && S.sel !== 'current';
    let it = `<span><i style="background:var(--ea-avail);border-color:var(--ea-avail)"></i>Available</span><span><i style="background:var(--ea-cell)"></i>Unavailable</span>`;
    if (edit) it += `<span><i style="background:var(--ea-brand);width:8px;height:8px;border-radius:50%;border:0;vertical-align:0"></i>Changed hour</span>`;
    if (cmp) it += `<span><i style="box-shadow:inset 3px 0 0 var(--ea-brand);background:var(--ea-avail)"></i>Added</span><span><i style="background:repeating-linear-gradient(135deg,var(--ea-cell),var(--ea-cell) 3px,var(--ea-ghost) 3px,var(--ea-ghost) 5px)"></i>Removed</span>`;
    const refG = edit ? baseGrid() : cmp ? gridOf(prevKey(S.sel)) : null;
    const diff = refG ? gridHrs(g) - gridHrs(refG) : 0;
    const delta = refG && diff ? `<span class="delta ${diff > 0 ? 'up' : 'dn'}">${diff > 0 ? '+' : ''}${diff} hrs</span>` : '';
    const tot = cmp ? `${gridHrs(refG)} → ${gridHrs(g)} hrs` : `${gridHrs(g)} hrs`;
    $('eaLegend').innerHTML = it + `<span class="tot">Weekly available hours ${delta}<b>${tot}</b></span>`;
  }

  /* Fit the board to the screen: hour rows share the space left in the right panel */
  function fit() {
    const v = $('eaView'), bw = $('eaBw');
    if (!v || v.style.display !== 'block' || !bw) return;
    if (window.matchMedia('(max-width: 860px)').matches) { v.style.setProperty('--ea-slot', '18px'); return; }
    const avail = bw.clientHeight - 12;                        // minus top padding
    const head = 54, band = 26, borders = 4;
    const slot = Math.max(11, Math.min(26, Math.floor((avail - head - 5 * band - borders) / 24)));
    v.style.setProperty('--ea-slot', slot + 'px');
  }
  window.addEventListener('resize', () => { if (S) fit(); });

  /* ---------------- Editing ---------------- */
  function setRange(days, s, e) { const val = stateOf(S.draft, days, s, e) !== 'on'; days.forEach(d => { for (let h = s; h < e; h++) S.draft[d][h] = val; }); }
  function applyKey(k) {
    const p = k.split('|');
    if (p[0] === 'w') setRange(ALL, 0, 24);
    if (p[0] === 'pa') { const x = PARTS[+p[1]]; setRange(ALL, x.s, x.e); }
    if (p[0] === 'ha') setRange(ALL, +p[1], +p[1] + 1);
    if (p[0] === 'd') setRange([+p[1]], 0, 24);
    if (p[0] === 'p') { const x = PARTS[+p[1]]; setRange([+p[2]], x.s, x.e); }
    render();
    const again = document.querySelector(`#eaView [data-k="${k}"]`); if (again) again.focus();
  }
  let painting = false, paintVal = true;
  function paint(c) { const d = +c.dataset.d, h = +c.dataset.h; if (S.draft[d][h] === paintVal) return; S.draft[d][h] = paintVal; c.classList.toggle('on', paintVal); c.classList.toggle('chg', baseGrid()[d][h] !== paintVal); }
  function bindPaint() {
    const b = $('eaBd'); b.style.touchAction = 'none';
    b.addEventListener('pointerdown', e => { const c = e.target.closest('.ea-sl[data-d]'); if (!c) return; e.preventDefault(); painting = true; paintVal = !S.draft[+c.dataset.d][+c.dataset.h]; paint(c); });
    b.addEventListener('pointermove', e => { if (!painting) return; const t = document.elementFromPoint(e.clientX, e.clientY); const c = t && t.closest && t.closest('.ea-sl[data-d]'); if (c && b.contains(c)) paint(c); });
  }
  const endPaint = () => { if (painting) { painting = false; render(); } };
  window.addEventListener('pointerup', endPaint);
  window.addEventListener('pointercancel', endPaint);

  /* ---------------- Actions ---------------- */
  function startEdit() {
    if (S.mode === 'edit') return;
    const o = openReq();
    S.mode = 'edit';
    S.baseKey = o ? 'req' : (S.sel === 'mgr' && S.mgrUp ? 'mgr' : 'current');
    S.draft = clone(baseGrid());
    S.eff = o && o.eff >= minEff() ? o.eff : '';
    S.tried = false; S.compare = false;
    render();
  }
  function exitEdit() { S.mode = 'view'; S.draft = null; S.baseKey = null; S.eff = ''; S.tried = false; }
  function guard(then) {                                                                           // R13
    if (!S || S.mode !== 'edit' || !hasChanges()) return then();
    dialog({ tone: 'warn', icon: 'alert-triangle', title: 'Discard your changes?', body: '<p>Your changes haven’t been submitted. Leaving now discards them.</p>', ok: 'Discard changes', okCls: 'danger', onOk: then });
  }

  function trySubmit() {
    S.tried = true;
    if (!S.eff || S.eff < minEff()) { render(); const i = $('eaEff'); i && i.focus(); return; }   // R1
    if (!hasChanges()) return;
    const o = openReq(), E = S.eff;
    const willApply = (S.mgrUp && S.mgrUp.eff <= E) ? S.mgrUp.grid : S.current.grid;
    if (!o && same(S.draft, willApply)) {                                                        // R3
      dialog({ tone: 'info', icon: 'info', title: 'Nothing to request', body: `<p>These hours match the availability that will already apply on ${fmt(E)}. Change at least one day, day part or hour.</p>`, ok: 'OK', noCancel: true });
      return;
    }
    let body = '', title = '', tone = 'warn', ok = 'Submit request';
    if (o && !editingOpen()) {                                                                   // R4
      title = 'Replace your existing request?'; tone = 'danger'; ok = 'Replace request';
      body += `<p>You can only have one open request. Submitting replaces:</p><div class="box">${chip(o.status)} From <b>${fmt(o.eff)}</b> · ${gridHrs(o.grid)} hrs/week</div>`;
    } else if (o && o.status === 'approved') {                                                   // R5
      title = 'Send for approval again?'; ok = 'Update request';
      body += '<p>Your manager already approved this request. Updating it sets it back to <b>Pending approval</b>.</p>';
    }
    if (gridHrs(S.draft) === 0) { title = title || 'Submit with no available hours?'; body += `<p>Nothing is marked available. If approved, you’ll show as <b>unavailable all week</b> from ${fmt(E)}.</p>`; }   // R7
    if (body && S.mgrUp) body += `<p>If approved, this also replaces your manager’s change from ${fmt(S.mgrUp.eff)}.</p>`;
    if (!body) return commit(E);
    dialog({ tone, icon: tone === 'danger' ? 'alert-triangle' : 'send', title, body, ok, okCls: tone === 'danger' ? 'danger' : 'primary', onOk: () => commit(E) });
  }
  function commit(E) {                                                                             // R4: one open request
    const o = openReq(), at = nowStamp(), ME = me().name;
    if (o) {
      const ch = [];
      if (o.eff !== E) ch.push(`effective date changed from ${fmt(o.eff)} to ${fmt(E)}`);
      if (!same(o.grid, S.draft)) ch.push('availability changed');
      const wasAp = o.status === 'approved';
      o.grid = clone(S.draft); o.eff = E; o.status = 'pending';
      o.log.push({ t: 'Updated', at, by: ME, note: (ch.join('; ') || 'resubmitted') + (wasAp ? '; needs approval again' : '') });
      toast('Request updated');
    } else {
      if (S.req) S.history.unshift(S.req);
      S.req = { status: 'pending', eff: E, grid: clone(S.draft), submittedAt: at, log: [{ t: 'Submitted', at, by: ME, note: 'Effective ' + fmt(E) }] };
      toast('Request submitted');
    }
    exitEdit(); S.sel = 'req'; render();
  }
  function cancelRequest() {                                                                       // R8
    const o = openReq();
    dialog({ tone: 'danger', icon: 'x-circle', title: 'Cancel your request?',
      body: `<p>Your ${o.status} request from <b>${fmt(o.eff)}</b> will be withdrawn. Your availability stays as it is${S.mgrUp ? `, including your manager’s change from ${fmt(S.mgrUp.eff)}` : ''}.</p>`,
      ok: 'Cancel request', okCls: 'danger',
      onOk: () => {
        // cancelled requests leave the timeline entirely; only a record stays in "Past requests"
        o.status = 'cancelled'; o.log.push({ t: 'Cancelled', at: nowStamp(), by: me().name });
        S.history.unshift(o); S.req = null;
        S.sel = 'current'; S.compare = false;
        render(); toast('Request cancelled and removed');
      } });
  }
  function showActivity() {
    const r = S.req, ME = me().name;
    dialog({ tone: 'info', icon: 'history', title: 'Activity & past requests', noCancel: true, ok: 'Close',
      body: `${r ? `<h4>Request from ${fmt(r.eff)} ${chip(r.status)}</h4><ul class="ea-log">${r.log.slice().reverse().map(x => `<li><b>${x.t}</b>${x.note ? ` – ${esc(x.note)}` : ''}<div class="w">${fmtDT(x.at)} · ${x.by === ME ? 'You' : esc(x.by)}</div></li>`).join('')}</ul>` : ''}
        ${S.history.length ? `<h4>Past requests</h4><ul class="ea-past">${S.history.map(x => `<li><div>From ${fmt(x.eff)}<div class="w">Submitted ${fmtDT(x.submittedAt)}</div></div>${chip(x.status)}</li>`).join('')}</ul>` : ''}` });
  }
  /* Manager simulation (prototype only) — R9 / R10 */
  function mgrApprove() {
    const o = openReq(); if (!o || o.status !== 'pending') return toast('No pending request to approve', 'warning');
    o.status = 'approved'; o.log.push({ t: 'Approved', at: nowStamp(), by: MGR });
    if (S.mgrUp) { o.log.push({ t: 'Replaced manager’s change', at: nowStamp(), by: 'System', note: `change from ${fmt(S.mgrUp.eff)} removed` }); S.mgrUp = null; }
    if (o.eff <= TODAY()) { S.current = { eff: TODAY(), grid: clone(o.grid), src: 'Your request, approved by ' + MGR }; o.status = 'effective'; }
    exitEdit(); S.sel = o.status === 'effective' ? 'current' : 'req'; render(); toast('Manager approved the request');
  }
  function mgrReject() {
    const o = openReq(); if (!o || o.status !== 'pending') return toast('No pending request to reject', 'warning');
    o.status = 'rejected'; o.log.push({ t: 'Rejected', at: nowStamp(), by: MGR, note: 'Please keep Saturday evening available.' });
    exitEdit(); S.sel = 'req'; render(); toast('Manager rejected the request');
  }
  function rollForward() {                                                                         // R12
    const T = TODAY();
    if (S.mgrUp && S.mgrUp.eff <= T) { S.current = { eff: S.mgrUp.eff, grid: S.mgrUp.grid, src: 'Set by ' + S.mgrUp.by }; S.mgrUp = null; }
    if (S.req && S.req.status === 'approved' && S.req.eff <= T) { S.current = { eff: S.req.eff, grid: clone(S.req.grid), src: 'Your request, approved by ' + MGR }; S.req.status = 'effective'; }
  }

  /* ---------------- Dialog + toast ---------------- */
  let dOk = null;
  function dialog({ tone = 'warn', icon = 'alert-triangle', title, body, ok = 'OK', okCls = 'primary', onOk, noCancel }) {
    $('eaDIc').className = 'ic ' + tone; $('eaDIc').innerHTML = `<i data-lucide="${icon}"></i>`;
    $('eaDTitle').textContent = title; $('eaDBody').innerHTML = body;
    $('eaDOk').textContent = ok; $('eaDOk').className = 'ea-btn ' + okCls;
    $('eaDCancel').style.display = noCancel ? 'none' : '';
    dOk = onOk || null; $('eaDw').classList.add('open'); icons(); $('eaDOk').focus();
  }
  const closeD = () => $('eaDw').classList.remove('open');
  function toast(t, type) { if (typeof window.showToast === 'function') window.showToast(t, type || 'info'); }

  /* ---------------- Events ---------------- */
  function bindEvents() {
    const v = $('eaView');
    v.addEventListener('click', e => {
      const t = e.target;
      const menu = $('eaDemoMenu');
      if (t.closest('#eaDemoBtn')) { menu.classList.toggle('open'); return; }
      if (!t.closest('#eaDemoMenu')) menu.classList.remove('open');
      const sc = t.closest('[data-sc]'); if (sc) { menu.classList.remove('open'); scenario(sc.dataset.sc); render(); return toast('Scenario loaded'); }
      if (t.closest('#eaMgrApprove')) { menu.classList.remove('open'); return mgrApprove(); }
      if (t.closest('#eaMgrReject')) { menu.classList.remove('open'); return mgrReject(); }
      if (t.closest('#eaBack')) return closeMyAvailability();
      const dy = t.closest('[data-day]'); if (dy) { S.mDay = +dy.dataset.day; return render(); }
      if (t.closest('[data-start]')) return startEdit();
      const sv = t.closest('[data-sel]');
      if (sv) {
        if (S.mode === 'edit') return guard(() => { exitEdit(); S.sel = sv.dataset.sel; render(); });
        S.sel = sv.dataset.sel; if (S.sel === 'current') S.compare = false; return render();
      }
      if (t.closest('#eaCancelReq')) return cancelRequest();
      if (t.closest('#eaShowAct')) return showActivity();
      if (t.closest('#eaCancelEdit')) return guard(() => { exitEdit(); render(); });
      if (t.closest('#eaSubmit')) return trySubmit();
      if (S.mode !== 'edit') return;
      const k = t.closest('[data-k]'); if (k) return applyKey(k.dataset.k);
      if (t.closest('#eaUndo')) { S.draft = clone(baseGrid()); return render(); }
      const q = t.closest('[data-q]'); if (q) { S.eff = q.dataset.q; return render(); }
    });
    v.addEventListener('change', e => {
      if (e.target.id === 'eaCmp') { S.compare = e.target.checked; render(); }
      if (e.target.id === 'eaEff') { S.eff = e.target.value; render(); }
    });
    $('eaDCancel').onclick = closeD;
    $('eaDOk').onclick = () => { if (dOk && dOk() === false) return; closeD(); };
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if ($('eaDw').classList.contains('open')) { e.stopPropagation(); closeD(); }
      else if ($('eaDemoMenu').classList.contains('open')) $('eaDemoMenu').classList.remove('open');
    }, true);
  }

  /* ---------------- Open / close ---------------- */
  function openMyAvailability() {
    ensureDom();
    if (!S) scenario('both');
    rollForward();
    if (S.mode !== 'edit') { S.sel = 'current'; S.compare = false; }   // always land on the current availability
    $('eaView').style.display = 'block';
    render();
  }
  function closeMyAvailability(force) {
    const v = $('eaView'); if (!v || v.style.display !== 'block') return;
    const hide = () => {
      if (S && S.mode === 'edit') exitEdit();
      v.style.display = 'none';
      if (location.hash === '#team-center/availability') history.replaceState(null, '', '#team-center');
      document.querySelectorAll('.sidebar .tc-sub a.active').forEach(a => a.classList.remove('active'));
    };
    if (force === true) return hide();
    guard(hide);
  }
  window.openMyAvailability = openMyAvailability;
  window.closeMyAvailability = closeMyAvailability;
})();
