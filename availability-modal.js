/* =====================================================================
   Employee Availability modal — Schedule Pad
   Open: employee popup (left list) → "Availability" tile
         or openAvailabilityModal(empId)

   Data model (per employee):
     AvailabilityVersion { id, effectiveFrom 'YYYY-MM-DD' (store-local),
                           grid[7][24] bool, updatedAt 'YYYY-MM-DDTHH:MM', updatedBy }
     CURRENT  = latest version with effectiveFrom <= today (store timezone)
     UPCOMING = the version with effectiveFrom > today (max ONE)
   Depends on Schedule Pad globals: employeeData, _empAvail, _aiCurrent,
   _skillsByPosition, showToast, lucide.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- Config ---------------- */
  const STORE_TZ = 'America/Chicago';
  const STORE_TZ_LABEL = 'America/Chicago (CT)';
  const MANAGER = 'Store Manager';
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PUBLISHED_WEEKS = 2;            // published schedule horizon used for the shift-conflict check
  const NO_AVAIL_IDS = [7];             // demo: employee with no availability saved yet (C19)
  const UPCOMING_IDS = [0, 3, 6];       // demo: employees that already have an upcoming version

  /* ---------------- Date helpers (store timezone, C21) ---------------- */
  function storeParts() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return p;
  }
  const today = () => { const p = storeParts(); return `${p.year}-${p.month}-${p.day}`; };
  const nowStamp = () => { const p = storeParts(); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
  const toD = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toIso = dt => dt.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = toD(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
  const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const weekday = iso => toD(iso).getUTCDay();
  const fmt = iso => { const d = toD(iso); return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const fmtShort = iso => { const d = toD(iso); return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]}`; };
  const fmtDT = s => { const [dp, tp] = s.split('T'); let [h, m] = tp.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${fmt(dp)}, ${h}:${String(m).padStart(2, '0')} ${ap}`; };
  const localIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hourLbl = h => h === 0 ? '12A' : h < 12 ? h + 'A' : h === 12 ? '12P' : (h - 12) + 'P';
  const tLbl = h => { const hh = ((h % 24) + 24) % 24; return `${hh % 12 || 12}:00${hh < 12 ? 'a' : 'p'}`; };   // 24 → "12:00a" (C22)
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- Grid helpers ---------------- */
  const emptyGrid = () => DAYS.map(() => Array(24).fill(false));
  const fullGrid = () => DAYS.map(() => Array(24).fill(true));
  const cloneGrid = g => g.map(r => r.slice());
  const ranges = row => { const out = []; let s = null; for (let h = 0; h <= 24; h++) { const on = h < 24 && row[h]; if (on && s === null) s = h; if (!on && s !== null) { out.push([s, h]); s = null; } } return out; };
  const rangeText = row => { const r = ranges(row); if (!r.length) return 'Unavailable'; if (r.length === 1 && r[0][0] === 0 && r[0][1] === 24) return 'All day'; return r.map(([a, b]) => `${tLbl(a)} – ${tLbl(b)}`).join(', '); };
  const rowHrs = row => row.filter(Boolean).length;
  const gridHrs = g => g.reduce((a, r) => a + rowHrs(r), 0);
  const sameGrid = (a, b) => a.every((r, d) => r.every((v, h) => v === b[d][h]));

  /* ---------------- Store (seeded from the schedule's existing availability) ---------------- */
  const baseAvail = window._empAvail;            // the schedule's original mock availability
  const STORE = {};                              // empId → [versions]
  let _vid = 1;
  /* saved in the browser so changes survive a reload and reach the crew app (crew.html) */
  const AV_KEY = 'zipAvailStore';
  try { const raw = JSON.parse(localStorage.getItem(AV_KEY) || 'null'); if (raw && raw.v === 1 && raw.store) { Object.assign(STORE, raw.store); _vid = Math.max(_vid, raw.vid || 1); } } catch (e) {}
  function persist(exportCrew) {
    try { localStorage.setItem(AV_KEY, JSON.stringify({ v: 1, store: STORE, vid: _vid })); } catch (e) {}
    if (exportCrew !== false && typeof window.crewExport === 'function') window.crewExport();
  }

  function gridFromBase(emp) {
    const g = emptyGrid();
    for (let d = 0; d < 7; d++) {
      const slots = baseAvail ? baseAvail(emp, d) : null;
      (slots || []).forEach(s => { for (let h = Math.floor(s.start); h < Math.min(24, Math.ceil(s.end)); h++) g[d][h] = true; });
    }
    return g;
  }
  function versionsOf(empId) {
    if (STORE[empId]) return STORE[empId];
    const emp = employeeData.find(e => e.id == empId);
    const T = today();
    const list = [];
    if (emp && !NO_AVAIL_IDS.includes(emp.id)) {
      const cur = gridFromBase(emp);
      list.push({ id: 'v' + (_vid++), eff: '2025-12-01', grid: cur, updatedAt: '2025-11-28T10:05', updatedBy: 'Priya Sharma', seed: true });
      if (UPCOMING_IDS.includes(emp.id)) {
        const up = cloneGrid(cur);
        for (let d = 1; d <= 5; d++) for (let h = 9; h < 17; h++) up[d][h] = true;   // adds weekday daytime
        for (let h = 0; h < 24; h++) up[0][h] = false;                              // Sundays off
        list.push({ id: 'v' + (_vid++), eff: addDays(T, 14), grid: up, updatedAt: `${addDays(T, -5)}T16:16`, updatedBy: 'Corporate' });
      }
    }
    STORE[empId] = list;
    return list;
  }
  const sortedV = id => versionsOf(id).slice().sort((a, b) => a.eff.localeCompare(b.eff));
  const currentV = id => { const T = today(); const p = sortedV(id).filter(v => v.eff <= T); return p[p.length - 1] || null; };
  const upcomingV = id => { const T = today(); return sortedV(id).find(v => v.eff > T) || null; };
  const lastUpdatedV = id => versionsOf(id).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;

  /* Schedule integration: the schedule grid reads availability from the version in effect
     on the date being shown (falls back to the original mock until the store has data). */
  if (typeof baseAvail === 'function') {
    window._empAvail = function (emp, dow) {
      if (!emp) return null;
      const list = STORE[emp.id];
      if (!list) return baseAvail(emp, dow);
      if (!list.length) return null;
      let dateIso;
      try {
        const ad = window.activeDate || (typeof activeDate !== 'undefined' ? activeDate : new Date());
        const d = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate() - ad.getDay() + dow);
        dateIso = localIso(d);
      } catch (e) { dateIso = today(); }
      const s = list.slice().sort((a, b) => a.eff.localeCompare(b.eff));
      const v = s.filter(x => x.eff <= dateIso).pop() || (s[0].seed ? s[0] : null);
      if (!v) return null;
      const r = ranges(v.grid[dow]);
      return r.length ? r.map(([start, end]) => ({ start, end })) : null;
    };
  }

  /* =====================================================================
     Modal (v2 layout, same theme as Team Center › My availability)
       Top row:  Regular | Temporary tabs  ·  version tiles + Update button
       Regular:  bar (title / actions / weekly hours) · note · tools · week grid · legend
       Temporary: temp-availability.js renders the manager view into #avmTemp
     Only two versions show at once: Current + Requested (employee's pending
     request) or Current + Upcoming.
     ===================================================================== */
  let S = null;   // { empId, tab, sel: current|up|req, mode, baseKey, draft, eff, triedSave, selRow }
  const $ = id => document.getElementById(id);
  const emp = () => employeeData.find(e => e.id == S.empId) || { name: 'Employee', position: '' };
  const first = n => String(n || '').split(' ')[0];
  const cur = () => currentV(S.empId);
  const upc = () => upcomingV(S.empId);
  const TA = () => window.TA || null;
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const KIND = { current: '#16a34a', up: '#7c3aed', req: '#f59e0b' };
  const ORDER = [1, 2, 3, 4, 5, 6, 0];

  /* ---------- the employee's pending regular-availability request (sent from the crew app) ---------- */
  const REQ_KEY = 'zipCrewAvailReq';
  const readReqs = () => { try { return JSON.parse(localStorage.getItem(REQ_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const writeReqs = all => { try { localStorage.setItem(REQ_KEY, JSON.stringify(all)); } catch (e) {} };
  const pendReq = () => { const m = readReqs()[S.empId]; return m && m.req && m.req.status === 'pending' ? m.req : null; };
  function setReq(fn) { const all = readReqs(), m = all[S.empId]; if (!m || !m.req) return; fn(m.req); writeReqs(all); }
  const secondKey = () => pendReq() ? 'req' : upc() ? 'up' : null;

  const gridFor = k => k === 'req' ? (pendReq() || {}).grid : k === 'up' ? (upc() || {}).grid : (cur() || {}).grid;
  const baseGrid = () => S.baseKey === '__blank' ? emptyGrid() : (gridFor(S.baseKey) || emptyGrid());
  const editingUpcoming = () => S.baseKey === 'up' && !!upc();
  const hoursChanged = () => S.mode === 'edit' && !sameGrid(S.draft, baseGrid());
  const hasChanges = () => hoursChanged() || ((S.baseKey === 'up' || S.baseKey === 'req') && !!S.eff && S.eff !== (S.baseKey === 'up' ? upc().eff : pendReq().eff));   // C5
  function analyse(E) { if (!E) return 'empty'; const T = today(); if (E < T) return 'past'; return E === T ? 'today' : 'future'; }

  /* re-read the shared store: the crew app may have changed it (e.g. a request replaced the upcoming version) */
  function reloadStore() {
    try { const raw = JSON.parse(localStorage.getItem(AV_KEY) || 'null'); if (raw && raw.v === 1 && raw.store) { Object.keys(raw.store).forEach(k => { STORE[k] = raw.store[k]; }); _vid = Math.max(_vid, raw.vid || 1); } } catch (e) {}
  }

  /* ---------------- DOM shell ---------------- */
  function ensureDom() {
    if ($('avmOverlay')) return;
    const wrap = document.createElement('div');
    wrap.className = 'avm-root';
    wrap.innerHTML = `
      <div class="avm-overlay" id="avmOverlay" role="dialog" aria-modal="true" aria-labelledby="avmTitle">
        <div class="avm-modal av2-modal v2">
          <div class="avm-head">
            <img id="avmAvatar" alt="">
            <div class="min-w-0">
              <h2 id="avmTitle">Availability</h2>
              <div class="sub" id="avmSub"></div>
            </div>
            <div class="spacer"></div>
            <button type="button" class="avm-x" id="avmClose" aria-label="Close" title="Close"><i data-lucide="x" style="width:20px;height:20px"></i></button>
          </div>
          <div class="av2-body">
            <div class="v2-top">
              <div class="v2-tabs" id="avmModes" role="tablist" aria-label="Availability type"></div>
              <span class="grow"></span>
              <div class="v2-topr" id="avmTopR"></div>
            </div>
            <div id="avmRegMain">
              <div class="avx-sh" id="avmRegHead" hidden></div>
              <section class="v2-card v2-reg">
                <div class="ea-bar" id="avmBar"></div>
                <div id="avmNote"></div>
                <div id="avmTools"></div>
                <div class="v2-gridbox" id="avmGrid"></div>
                <div class="v2-foot" id="avmFoot"></div>
              </section>
            </div>
            <div id="avmTempWrap"><div class="avx-sh" id="avmTempHead" hidden></div><div id="avmTemp" hidden></div></div>
          </div>
        </div>
      </div>
      <div class="avm-dlg-wrap" id="avmDlgWrap">
        <div class="avm-dlg" role="alertdialog" aria-modal="true" aria-labelledby="avmDlgTitle">
          <div class="dh"><div class="ic" id="avmDlgIc"></div><h3 id="avmDlgTitle"></h3></div>
          <div class="db" id="avmDlgBody"></div>
          <div class="df"><button type="button" class="avm-btn" id="avmDlgCancel">Cancel</button><button type="button" class="avm-btn primary" id="avmDlgOk">OK</button></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    bindEvents();
    const ov = $('avmOverlay');
    if (window.AVMERGE) MX = AVMERGE.host({
      root: ov, frame: null, top: $('avmTopR'),
      regMain: $('avmRegMain'), regSec: ov.querySelector('.v2-reg'), regHead: $('avmRegHead'),
      tempWrap: $('avmTempWrap'), tempHead: $('avmTempHead'), tempEl: $('avmTemp'),
      regEditing: () => !!S && S.mode === 'edit', tempEditing: () => !!(TA() && TA().crewEditing($('avmTemp'))),
      titles: { reg: () => S && S.baseKey === 'up' ? 'Edit Upcoming Availability' : S && S.baseKey === 'req' ? 'Edit Availability Request' : 'Update Regular Availability',
        temp: () => { const h = ov.querySelector('#avmTemp .tv-head h1'); return h ? h.textContent : 'Add Temporary Availability'; } },
      acts: { reg: ['#avmCancel', '#avmSave'], temp: ['.tv-head [data-tv="cancel"]', '.tv-head [data-tv="review"]'] },
      onAct: a => {
        if (a === 'reg') { startEdit(); if (merged() === 'full') ov.scrollTop = 0; return; }
        if (TA()) TA().crewNew({ noScroll: true });
      },
    });
  }

  /* ---------------- Merged screen (Design Versions flag, avail-merge.js) ----------------
     Regular + Temporary on one screen; "Add/Update Availability" opens the editor in a side
     panel ('panel') or full screen ('full'). Both flags off -> the Regular | Temporary tabs. */
  let MX = null;
  const merged = () => (MX && window.AVMERGE ? AVMERGE.mode() : null);
  function renderMergedChrome() {
    const tE = !!(TA() && TA().crewEditing($('avmTemp'))), editing = S.mode === 'edit' || tE;
    const e = emp(), fn = esc(first(e.name)), r = pendReq(), u = upc();
    $('avmModes').className = 'avx-title'; $('avmModes').removeAttribute('role');
    $('avmModes').innerHTML = `<p>${fn}’s weekly hours, plus any dates with different hours.</p>`;
    $('avmTopR').innerHTML = merged() === 'full' && editing ? '' : AVMERGE.ddHTML([
      { act: 'reg', tone: 'reg', title: r ? `Edit ${fn}’s request` : u ? 'Edit upcoming availability' : 'Update regular availability', sub: `Change the hours ${fn} can work every week, from a date you pick.` },
      { act: 'temp', tone: 'temp', title: 'Add temporary availability', sub: 'Different hours for specific dates. No approval needed.' }]);
    $('avmRegHead').innerHTML = '';
    const n = TA() ? TA().mgrPending(S.empId) : 0;
    $('avmTempHead').innerHTML = AVMERGE.headHTML({ tone: 'temp', title: 'Temporary availability', sub: 'Different hours for specific dates. They take priority over regular hours on those dates.', count: n, countTitle: `${n} pending request${n > 1 ? 's' : ''}` });
  }
  function renderMerged() {
    $('avmOverlay').classList.add('avx-on');
    AVMERGE.pre(MX);
    renderHead();
    $('avmRegMain').hidden = false; $('avmTemp').hidden = false;
    const k2 = secondKey(); if (S.sel !== 'current' && S.sel !== k2) S.sel = 'current';
    renderMergedChrome();
    renderBar(); renderNote(); renderGrid(); renderTools(); renderFoot();
    if (S.mode === 'view') {   // Current / Requested chips inside the card; the selected version's date + actions on a second row
      const u = upc(), r = pendReq(), T = today();
      const inN = iso => { const n = daysBetween(T, iso); return n <= 0 ? 'Starts today' : `Starts in ${n} day${n === 1 ? '' : 's'}`; };
      const info = S.sel === 'up' && u ? AVMERGE.effHTML(fmt(u.eff), [inN(u.eff), 'Saved by ' + esc(u.updatedBy)])
        : S.sel === 'req' && r ? AVMERGE.effHTML(fmt(r.eff), ['<span class="ea-chip st-pending">Pending approval</span>', r.submittedAt ? 'Submitted ' + fmt(r.submittedAt.split('T')[0]) : '']) : '';
      AVMERGE.barLayout($('avmBar'), vstripHTML(), info);
    }
    if (TA()) TA().renderCrew($('avmTemp'), { role: 'manager', empId: S.empId, me: { name: MANAGER }, top: null,
      onChange: () => render(),
      beforeRender: () => AVMERGE.pre(MX), onRender: () => { if (merged()) { renderMergedChrome(); AVMERGE.sync(MX); icons(); } } });
    AVMERGE.sync(MX); icons();
  }
  window.addEventListener('dflags:change', () => {
    const ov = $('avmOverlay'); if (!ov || !ov.classList.contains('open') || !S) return;
    if (!merged() && TA() && TA().crewEditing($('avmTemp'))) S.tab = 'temp';
    render();
  });

  /* ---------------- Render ---------------- */
  function render() {
    if (merged()) return renderMerged();
    if (MX) { AVMERGE.sync(MX); $('avmOverlay').classList.remove('avx-on'); $('avmModes').className = 'v2-tabs'; $('avmModes').setAttribute('role', 'tablist'); }
    renderHead(); renderModes();
    const temp = S.tab === 'temp' && TA();
    $('avmRegMain').hidden = !!temp; $('avmTemp').hidden = !temp;
    if (temp) { TA().renderCrew($('avmTemp'), { role: 'manager', empId: S.empId, me: { name: MANAGER }, top: $('avmTopR'), onChange: () => { renderModes(); icons(); } }); icons(); return; }
    const k2 = secondKey(); if (S.sel !== 'current' && S.sel !== k2) S.sel = 'current';
    renderTopR(); renderBar(); renderNote(); renderGrid(); renderTools(); renderFoot(); icons();
  }
  function renderHead() {
    const e = emp();
    const roles = [e.position, ...((window._skillsByPosition || (typeof _skillsByPosition !== 'undefined' ? _skillsByPosition : {}))[e.position] || [])]
      .filter((p, i, a) => p && a.indexOf(p) === i);
    $('avmAvatar').src = e.avatar || '';
    $('avmTitle').textContent = `Availability of ${e.name}`;
    $('avmSub').innerHTML = `<span>${esc(roles.join(', ') || 'Employee')}</span><span class="sep"></span><span>Store timezone: ${STORE_TZ_LABEL}</span>`;
  }
  function renderModes() {
    const n = TA() ? TA().mgrPending(S.empId) : 0, rq = pendReq() ? 1 : 0;
    $('avmModes').innerHTML = `<button type="button" role="tab" data-mtab="regular" aria-selected="${S.tab !== 'temp'}"><i data-lucide="calendar-check"></i>Regular Availability${rq ? '<span class="n" title="1 pending request">1</span>' : ''}</button>
      ${TA() ? `<button type="button" role="tab" data-mtab="temp" class="temp" aria-selected="${S.tab === 'temp'}"><i data-lucide="calendar-clock"></i>Temporary Availability${n ? `<span class="n" title="${n} pending request${n > 1 ? 's' : ''}">${n}</span>` : ''}</button>` : ''}`;
  }
  function switchTab(tab) {
    if (merged()) { const w = $(tab === 'temp' ? 'avmTempWrap' : 'avmRegMain'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (tab === S.tab) return;
    const go = () => { S.tab = tab; render(); };
    if (S.tab === 'temp' && TA()) return TA().crewGuard(go);
    guardDiscard(() => { if (S.mode === 'edit') exitEdit(); go(); });
  }

  /* version tiles (top right) + Update */
  function renderTopR() {
    $('avmTopR').innerHTML = `${vstripHTML()}
      ${S.mode === 'view' ? '<button type="button" class="vbtn primary" id="avmStartEdit"><i data-lucide="pencil"></i>Update Regular Availability</button>' : ''}`;
  }
  function vstripHTML() {
    const c = cur(), u = upc(), r = pendReq(), k2 = secondKey();
    const vp = (key, k, v) => { const on = S.sel === key && S.mode === 'view';
      return `<button type="button" class="vp ${on ? 'on' : ''}" data-sel="${key}" style="--c:${KIND[key]}" aria-pressed="${on}" title="Show in the grid below"><span class="dot"></span><span class="tx"><span class="k">${k}</span><span class="v">${v}</span></span>${on ? '<i data-lucide="check" class="ck"></i>' : ''}</button>`; };
    let h = vp('current', 'Current', c ? `Since ${fmtShort(c.eff)} · ${gridHrs(c.grid)} hrs` : 'Not set');
    if (k2 === 'req') h += vp('req', `Requested <span class="ea-chip st-pending">Pending approval</span>`, `From ${fmtShort(r.eff)} · ${gridHrs(r.grid)} hrs`);
    else if (k2 === 'up') h += vp('up', `Upcoming · ${esc(u.updatedBy)}`, `From ${fmtShort(u.eff)} · ${gridHrs(u.grid)} hrs`);
    return `<div class="v2-vstrip" role="group" aria-label="Availability versions">${h}</div>`;
  }

  function renderBar() {
    const c = cur(), u = upc(), r = pendReq(), T = today(), e = emp();
    if (S.mode === 'edit') {
      const nextMon = addDays(T, ((8 - weekday(T)) % 7) || 7), k = analyse(S.eff), can = hasChanges() && k !== 'past';
      const q = (iso, lbl) => `<button type="button" data-q="${iso}" class="${S.eff === iso ? 'on' : ''}">${lbl}</button>`;
      const title = S.baseKey === 'up' ? 'Edit upcoming availability' : S.baseKey === 'req' ? `Edit ${esc(first(e.name))}’s request` : 'Update availability';
      const from = S.baseKey === 'up' ? `the upcoming availability from ${fmt(u.eff)}` : S.baseKey === 'req' ? `${esc(first(e.name))}’s pending request` : S.baseKey === '__blank' ? 'a blank week' : 'the current availability';
      $('avmBar').innerHTML = `
        <div class="ti"><span class="ic" style="--c:var(--a-primary)"><i data-lucide="pencil"></i></span><div><b>${title}</b><small>Starting from ${from}</small></div></div>
        <div class="r">
          <div class="ea-eff"><label for="avmEff">Effective from <em>*</em></label>
            <input type="date" id="avmEff" min="${T}" value="${S.eff}" aria-required="true" class="${(S.triedSave && !S.eff) || k === 'past' ? 'err' : ''}">
            <div class="ea-quick">${q(T, 'Today')}${q(addDays(T, 1), 'Tomorrow')}${q(nextMon, 'Next Mon')}</div></div>
          <button type="button" class="ea-btn" id="avmCancel">Cancel</button>
          <button type="button" class="ea-btn primary" id="avmSave" ${can ? '' : 'disabled'} title="${hasChanges() ? '' : 'Change hours or the effective date to save'}"><i data-lucide="check"></i>${S.baseKey === 'req' ? 'Save &amp; approve' : 'Save availability'}</button>
        </div>`;
      return;
    }
    const tot = (g, ref) => { const d = ref ? gridHrs(g) - gridHrs(ref) : 0;
      return `<div class="v2-htot"><small>Weekly available hours</small><b>${gridHrs(g)} hrs${d ? ` <span class="delta ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${d} vs current</span>` : ''}</b></div>`; };
    const back = '<button type="button" class="ea-btn" data-sel="current"><i data-lucide="arrow-left"></i>Back to current</button>';
    let h;
    if (S.sel === 'up' && u) {
      const n = daysBetween(T, u.eff);
      h = `<div class="ti"><span class="ic" style="--c:${KIND.up}"><i data-lucide="calendar-clock"></i></span><div><b>Upcoming availability</b><small>Effective ${fmt(u.eff)} · starts in ${n} day${n === 1 ? '' : 's'} · saved by ${esc(u.updatedBy)}</small></div></div>
        <div class="r"><button type="button" class="ea-btn gd" id="avmDelUp"><i data-lucide="trash-2"></i>Delete upcoming</button>
          <button type="button" class="ea-btn" id="avmChgDate"><i data-lucide="calendar"></i>Change effective date</button>${back}${tot(u.grid, c && c.grid)}</div>`;
    } else if (S.sel === 'req' && r) {
      const sub = (r.submittedAt || '').split('T')[0];
      h = `<div class="ti"><span class="ic" style="--c:${KIND.req}"><i data-lucide="send"></i></span><div><b>Requested by ${esc(first(e.name))}</b><small>Pending approval · from ${fmt(r.eff)}${sub ? ` · submitted ${fmt(sub)}` : ''}</small></div></div>
        <div class="r"><button type="button" class="ea-btn gd" id="avmDecline"><i data-lucide="x"></i>Decline</button>
          <button type="button" class="ea-btn ok" id="avmApprove"><i data-lucide="check"></i>Approve</button>${back}${tot(r.grid, c && c.grid)}</div>`;
    } else if (c) {
      h = `<div class="ti"><span class="ic" style="--c:${KIND.current}"><i data-lucide="calendar-check"></i></span><div><b>Current availability</b><small>In effect since ${fmt(c.eff)} · set by ${esc(c.updatedBy)}</small></div></div>
        <div class="r">${tot(c.grid)}</div>`;
    } else {
      h = `<div class="ti"><span class="ic" style="--c:var(--a-faint)"><i data-lucide="calendar-x"></i></span><div><b>No availability set</b><small>${esc(e.name)} doesn’t have any availability saved yet</small></div></div><div class="r"></div>`;
    }
    $('avmBar').innerHTML = h;
  }

  const NOTE_IC = { 'n-muted': 'info', 'n-info': 'info', 'n-warn': 'alert-triangle', 'n-err': 'alert-circle' };
  function renderNote() {
    const c = cur(), u = upc(), r = pendReq(), e = emp(), T = today();
    let t = '', cls = '', act = '';
    if (S.mode === 'edit') {
      const k = analyse(S.eff), overridesUp = u && !editingUpcoming();
      if (k === 'empty') { t = S.triedSave ? 'Select an effective date before saving.' : 'Choose the effective date above. It can be today or any later date.'; cls = S.triedSave ? 'n-err' : 'n-muted'; }
      else if (k === 'past') { t = 'The effective date can’t be in the past. Pick today or a later date.'; cls = 'n-err'; }
      else if (k === 'today') {
        t = 'Applies from <b>today</b> and replaces the current availability immediately.';
        if (u) t += editingUpcoming() ? ` The upcoming availability from ${fmt(u.eff)} will apply from today instead.` : ` The upcoming availability from <b>${fmt(u.eff)}</b> will be removed.`;
        cls = overridesUp ? 'n-warn' : 'n-info';
      } else if (overridesUp) { t = `Becomes the upcoming availability from <b>${fmt(S.eff)}</b> and <b>replaces</b> the existing upcoming one from ${fmt(u.eff)}. You’ll be asked to confirm.`; cls = 'n-warn'; }
      else if (editingUpcoming()) { t = S.eff !== u.eff ? `Upcoming availability moves from ${fmt(u.eff)} to <b>${fmt(S.eff)}</b>.` : `Updates the upcoming availability from <b>${fmt(S.eff)}</b>.`; cls = 'n-info'; }
      else { t = `Becomes the upcoming availability from <b>${fmt(S.eff)}</b>. Current availability applies until ${fmt(addDays(S.eff, -1))}.`; cls = 'n-info'; }
      if (r && k !== 'empty' && k !== 'past') {
        t += S.baseKey === 'req' ? ` Saving <b>approves ${esc(first(e.name))}’s request</b> with your changes.` : ` ${esc(first(e.name))}’s <b>pending request</b> from ${fmt(r.eff)} will be closed — your update replaces it.`;
        if (S.baseKey !== 'req') cls = 'n-warn';
      }
      if (k !== 'empty' && k !== 'past' && gridHrs(S.draft) === 0) t += ` <b>${esc(e.name)} will show as unavailable all week</b> from ${k === 'today' ? 'today' : fmt(S.eff)}.`;   // C11
    } else if (S.sel === 'up' && u) {
      t = `Takes effect on <b>${fmt(u.eff)}</b>. Until ${fmt(addDays(u.eff, -1))}, the current availability applies. Grey bars show the current hours.`; cls = 'n-info';
    } else if (S.sel === 'req' && r) {
      t = `${esc(first(e.name))} asked for these hours from <b>${fmt(r.eff)}</b>. Approving makes it the upcoming availability${u ? ` and replaces the one from ${fmt(u.eff)}` : ''}. Grey bars show the current hours.`; cls = u ? 'n-warn' : 'n-info';
    } else if (!c) {
      t = `${esc(e.name)} doesn’t have any availability saved yet. Use <b>Update Regular Availability</b> to add it — you’ll start from a blank week.`; cls = 'n-muted';   // C19
    } else {
      const tn = TA() && TA().activeNotice(S.empId);
      if (tn) { t = `<b>Temporary availability ${tn.start <= T ? 'is in effect' : 'is scheduled'}</b> for ${TA().fmtRange(tn.start, tn.end)} and takes priority over these regular hours on those dates.`; cls = 'n-info'; act = '<button type="button" class="ta-link" data-mtab="temp">View</button>'; }
    }
    $('avmNote').innerHTML = t ? `<div class="ea-note ${cls}"><i data-lucide="${NOTE_IC[cls]}"></i><div class="tx">${t}</div>${act}</div>` : '';
  }

  function renderTools() {
    if (S.mode !== 'edit') { $('avmTools').innerHTML = ''; return; }
    if (!window.AVED) { $('avmTools').innerHTML = ''; return; }
    const time = S.imode === 'time';
    $('avmTools').innerHTML = `<div class="v2-tools">
      <div class="v2-imode" role="tablist" aria-label="How to set hours">
        <button type="button" role="tab" data-imode="drag" aria-selected="${!time}"><i data-lucide="mouse-pointer-2"></i>Drag on grid</button>
        <button type="button" role="tab" data-imode="time" aria-selected="${time}"><i data-lucide="clock-3"></i>Enter times</button></div>
      ${AVED.toolsHTML('avm', edCfg())}</div>`;
  }
  /* the hours editor (avail-editor.js) — same as Team Center: Drag on grid | Enter times */
  function edCfg() {
    const ref = refInfo(), td = weekday(today()), fn = first(emp().name);
    return { keys: ORDER.map(d => ({ k: 'd' + d, w: d, today: d === td })),
      get: k => S.draft[+k.slice(1)], set: (k, r) => { S.draft[+k.slice(1)] = r; }, ref: k => ref ? ref.g[+k.slice(1)] : null,
      mode: S.imode === 'time' ? 'time' : 'drag', refShort: ref ? ref.short : '',
      refLegend: S.baseKey === 'req' ? `${fn}’s request` : S.baseKey === 'up' ? 'Upcoming hours' : 'Current hours', own: false,
      onChange: render };
  }

  function refInfo() {
    if (S.mode === 'edit') return S.baseKey === '__blank' ? null : { g: baseGrid(), name: S.baseKey === 'up' ? 'Upcoming' : S.baseKey === 'req' ? 'Request' : 'Current', short: S.baseKey === 'up' ? 'upcoming' : S.baseKey === 'req' ? 'request' : 'current', legend: 'Hours you started from' };
    if (S.sel !== 'current' && cur()) return { g: cur().grid, name: 'Current', short: 'current', legend: 'Current hours' };
    return null;
  }
  function renderGrid() {
    if (!TA()) { $('avmGrid').innerHTML = ''; return; }
    const edit = S.mode === 'edit', g = edit ? S.draft : (gridFor(S.sel) || emptyGrid()), ref = refInfo(), td = weekday(today());
    const rows = ORDER.map(d => ({ k: 'd' + d, w: d, label: DAYS_FULL[d] + 's', title: 'Every ' + DAYS_FULL[d], sub: 'Every ' + DAYS_FULL[d], row: g[d], ref: ref ? ref.g[d] : null,
      today: d === td, badge: d === td ? ' <span class="wg-today">Today</span>' : '' }));
    if (window.AVED) {
      if (edit) return AVED.mount($('avmGrid'), 'avm', edCfg());
      $('avmGrid').innerHTML = AVED.viewHTML({ keys: ORDER.map(d => ({ k: 'd' + d, w: d, today: d === td })), get: k => g[+k.slice(1)], ref: k => ref ? ref.g[+k.slice(1)] : null, refShort: ref ? ref.short : '', sumHead: 'Hours' });
      return;
    }
    TA().wgBind('avm', { get: k => S.draft[+k.slice(1)], set: (k, r) => { S.draft[+k.slice(1)] = r; }, setSel: k => { S.selRow = k; }, rerender: render,
      keys: () => ORDER.map(d => 'd' + d), weekday: k => +k.slice(1) });
    $('avmGrid').innerHTML = TA().wgHTML('avm', { rows, sel: S.selRow, edit, colHead: 'Weekday', sumHead: 'Hours', refName: ref ? ref.name : '', refShort: ref ? ref.short : '', copyAllLabel: 'Copy to every day', bars: !edit });
  }
  function renderFoot() {
    const edit = S.mode === 'edit', g = edit ? S.draft : (gridFor(S.sel) || emptyGrid()), ref = refInfo(), diff = ref ? gridHrs(g) - gridHrs(ref.g) : 0;
    $('avmFoot').style.display = edit && window.AVED ? 'none' : ''; if (edit && window.AVED) return;
    $('avmFoot').innerHTML = `<div class="vlegend"><span><i class="vsw" style="background:var(--a-avail)"></i>Available</span><span><i class="vsw" style="border:1px solid var(--a-line-2)"></i>Unavailable</span>
        ${ref ? `<span><i class="vsw" style="border:1px dashed var(--a-primary);background:transparent"></i>${ref.legend}</span><span><span class="vtag diff">Changed</span>Differs from ${ref.short}</span>` : ''}</div>
      <span class="grow"></span>
      ${edit ? `<div class="vtotal">Weekly available hours ${ref && diff ? `<span class="delta ${diff > 0 ? 'up' : 'dn'}">${diff > 0 ? '+' : ''}${diff} hrs</span>` : ''}<b>${gridHrs(g)} hrs</b>${ref ? `<span>vs ${gridHrs(ref.g)} hrs</span>` : ''}</div>` : ''}`;
  }

  /* ---------------- Actions ---------------- */
  /* Update starts from the newest version: the pending request, else the upcoming one, else current (or the tile being viewed) */
  function startEdit() {
    const c = cur(), u = upc(), r = pendReq();
    const key = S.sel !== 'current' ? S.sel : (r ? 'req' : u ? 'up' : 'current');
    S.mode = 'edit';
    S.baseKey = key === 'current' && !c ? '__blank' : key;                                  // C19: no availability → blank week
    S.draft = cloneGrid(baseGrid());
    S.eff = key === 'up' ? u.eff : key === 'req' ? (r.eff >= today() ? r.eff : '') : '';     // C4
    S.triedSave = false; S.selRow = null;
    if (window.AVED) AVED.reset('avm');
    render();
  }
  function exitEdit() { S.mode = 'view'; S.draft = null; S.baseKey = null; S.eff = ''; S.triedSave = false; S.selRow = null; }
  function guardDiscard(then) {                           // C16
    if (!S || S.mode !== 'edit' || !hasChanges()) return then();
    dialog({ tone: 'warn', icon: 'alert-triangle', title: 'Discard your changes?', body: '<p>Your changes to this availability haven’t been saved. Leaving now discards them.</p>', ok: 'Discard changes', okCls: 'danger', onOk: then });
  }

  /* C10: published shifts on/after E that fall outside the new hours (weekly pattern, next PUBLISHED_WEEKS weeks) */
  function conflictsFor(E, grid) {
    let shifts = [];
    try { shifts = (typeof _aiCurrent === 'function' ? _aiCurrent() : []).filter(s => s.empId == S.empId); } catch (e) {}
    const T = today(), out = [];
    const startIso = E > T ? E : T;
    for (let i = 0; i < PUBLISHED_WEEKS * 7; i++) {
      const iso = addDays(T, i);
      if (iso < startIso) continue;
      const dow = weekday(iso);
      shifts.filter(s => s.day === dow).forEach(s => {
        const end = s.end > s.start ? s.end : s.end + 24;
        let bad = false;
        for (let h = Math.floor(s.start); h < Math.ceil(end); h++) { if (!grid[(dow + Math.floor(h / 24)) % 7][h % 24]) { bad = true; break; } }
        if (bad) out.push({ date: iso, start: s.start, end: s.end, role: s.position || emp().position });
      });
    }
    return out;
  }
  const hm = h => { const hh = Math.floor(((h % 24) + 24) % 24), m = Math.round((h % 1) * 60); return `${hh % 12 || 12}:${String(m).padStart(2, '0')}${hh < 12 ? 'a' : 'p'}`; };
  const conflictHTML = (list, lead) => { const shown = list.slice(0, 6);
    return `${lead || ''}<p><b>${list.length} scheduled shift${list.length > 1 ? 's' : ''}</b> fall outside the new availability:</p>
      <ul>${shown.map(s => `<li>${DAYS[weekday(s.date)]}, ${fmt(s.date)}: ${hm(s.start)} – ${hm(s.end)} (${esc(s.role)})</li>`).join('')}${list.length > shown.length ? `<li>+${list.length - shown.length} more</li>` : ''}</ul>
      <p>These shifts stay on the schedule and are flagged for review.</p>`; };

  function trySave() {
    S.triedSave = true;
    const k = analyse(S.eff);
    if (k === 'empty' || k === 'past') { render(); const i = $('avmEff'); i && i.focus(); return; }   // C1, C2
    if (!hasChanges()) return;
    const E = S.eff, u = upc(), r = pendReq(), e = emp();
    const overriding = !!(u && !editingUpcoming());        // C8 (C9: editing upcoming never asks)
    const closingReq = !!(r && S.baseKey !== 'req');
    const conflicts = conflictsFor(E, S.draft);
    const empty = gridHrs(S.draft) === 0;
    if (!overriding && !closingReq && !conflicts.length && !empty) return commit(E);
    let body = '';
    if (overriding) body += `<p>An upcoming availability is already scheduled. Only one upcoming availability can exist, so saving will replace it:</p>
      <div class="box">Upcoming from <b>${fmt(u.eff)}</b> · ${gridHrs(u.grid)} hrs/week · saved by ${esc(u.updatedBy)}</div>
      <p>The new availability will apply from <b>${E === today() ? 'today' : fmt(E)}</b>.</p>`;
    if (closingReq) body += `<p>${esc(first(e.name))} has a <b>pending request</b> from ${fmt(r.eff)} (${gridHrs(r.grid)} hrs/week). Saving closes it — ${esc(first(e.name))} sees that you updated the availability instead.</p>`;
    if (conflicts.length) body += conflictHTML(conflicts, overriding || closingReq ? '<div class="sec">Shift conflicts</div>' : '');
    if (empty) body += `<p>No hours are marked available. <b>${esc(e.name)} will show as unavailable all week from ${E === today() ? 'today' : fmt(E)}.</b></p>`;   // C11
    const strong = overriding || closingReq;
    dialog({ tone: strong ? 'danger' : 'warn', icon: 'alert-triangle',
      title: overriding ? 'Replace upcoming availability?' : closingReq ? 'Replace the pending request?' : 'Check before saving', body,
      ok: strong ? 'Replace and save' : 'Save anyway', okCls: strong ? 'danger' : 'primary', onOk: () => commit(E) });
  }

  /* C6/C7/C8/C9: drop any upcoming (single-upcoming rule) and any version starting on E, then add the new one */
  function addVersion(E, grid) {
    const T = today();
    STORE[S.empId] = versionsOf(S.empId).filter(v => !(v.eff > T) && v.eff !== E);
    STORE[S.empId].push({ id: 'v' + (_vid++), eff: E, grid: cloneGrid(grid), updatedAt: nowStamp(), updatedBy: MANAGER });
  }
  function commit(E) {
    const T = today(), r = pendReq(), fromReq = S.baseKey === 'req';
    addVersion(E, S.draft);
    if (r) setReq(q => {
      if (fromReq) { q.status = E <= T ? 'effective' : 'approved'; q.eff = E; q.grid = cloneGrid(S.draft); q.log = q.log || []; q.log.push({ t: 'Approved', at: nowStamp(), by: MANAGER, note: 'approved with changes' }); }
      else { q.status = 'rejected'; q.log = q.log || []; q.log.push({ t: 'Rejected', at: nowStamp(), by: MANAGER, note: 'Your manager updated your availability directly.' }); }
    });
    exitEdit(); S.sel = E > T ? 'up' : 'current';            // C12
    render(); refreshSchedule(); persist();
    toast(fromReq ? `${first(emp().name)}’s request approved with your changes, effective ${E === T ? 'today' : fmt(E)}` : `Availability saved, effective ${E === T ? 'today' : fmt(E)}`);
  }

  /* employee's pending request: approve as-is / decline with a note */
  function approveReq() {
    const r = pendReq(), u = upc(), e = emp(), T = today(), E = r.eff < T ? T : r.eff;
    const conflicts = conflictsFor(E, r.grid);
    let body = `<p>${esc(first(e.name))}’s availability (${gridHrs(r.grid)} hrs/week) becomes effective from <b>${E === T ? 'today' : fmt(E)}</b>.</p>`;
    if (u) body += `<p>It replaces the upcoming availability from <b>${fmt(u.eff)}</b>.</p>`;
    if (conflicts.length) body += conflictHTML(conflicts, '<div class="sec">Shift conflicts</div>');
    dialog({ tone: u || conflicts.length ? 'warn' : 'info', icon: 'check-circle-2', title: `Approve ${first(e.name)}’s request?`, body, ok: 'Approve', okCls: 'green',
      onOk: () => {
        addVersion(E, r.grid);
        setReq(q => { q.status = E <= T ? 'effective' : 'approved'; q.log = q.log || []; q.log.push({ t: 'Approved', at: nowStamp(), by: MANAGER }); });
        S.sel = E > T ? 'up' : 'current'; render(); refreshSchedule(); persist();
        toast(`${first(e.name)}’s availability approved — effective ${E === T ? 'today' : fmt(E)}`);
      } });
  }
  function declineReq() {
    const r = pendReq(), e = emp();
    dialog({ tone: 'danger', icon: 'x-circle', title: `Decline ${first(e.name)}’s request?`,
      body: `<p>The request from <b>${fmt(r.eff)}</b> won’t be applied. The current availability stays in effect.</p>
        <label for="avmDlgNote">Note to ${esc(first(e.name))} <span style="font-weight:500;color:var(--avm-ink-3)">(optional — shown in the crew app)</span></label>
        <textarea id="avmDlgNote" rows="3" style="width:100%;box-sizing:border-box;border:1px solid var(--avm-line-2);border-radius:8px;padding:8px;font:inherit;background:var(--avm-surface);color:var(--avm-ink)" placeholder="e.g. We need coverage on Friday evenings."></textarea>`,
      ok: 'Decline request', okCls: 'danger',
      onOk: () => {
        const note = ($('avmDlgNote') || {}).value || '';
        setReq(q => { q.status = 'rejected'; q.log = q.log || []; q.log.push({ t: 'Rejected', at: nowStamp(), by: MANAGER, note }); });
        S.sel = 'current'; render(); persist();
        toast(`${first(e.name)}’s availability request declined`);
      } });
  }

  function changeUpcomingDate() {                          // C13
    const u = upc(), T = today();
    dialog({
      tone: 'info', icon: 'calendar', title: 'Change effective date',
      body: `<p>Upcoming availability currently starts on <b>${fmt(u.eff)}</b>. You can change the date until it takes effect.</p>
        <label for="avmDlgDate">New effective date <span style="color:#f43f5e">*</span></label>
        <input type="date" id="avmDlgDate" min="${T}" value="${u.eff}"><div class="err-t" id="avmDlgErr"></div>
        <p style="font-size:12px;color:var(--avm-ink-3);margin-top:2px">Choosing today makes it the current availability immediately.</p>`,
      ok: 'Update date', okCls: 'primary',
      onOk: () => {
        const d = $('avmDlgDate').value, err = $('avmDlgErr');
        if (!d) { err.textContent = 'Select a date.'; return false; }
        if (d < T) { err.textContent = 'The date can’t be in the past.'; return false; }
        if (d === u.eff) { err.textContent = 'Pick a different date to update.'; return false; }
        if (d === T) STORE[S.empId] = versionsOf(S.empId).filter(v => v.id === u.id || v.eff !== T);
        u.eff = d; u.updatedAt = nowStamp(); u.updatedBy = MANAGER;
        S.sel = d === T ? 'current' : 'up'; render(); refreshSchedule(); persist();
        toast(d === T ? 'Upcoming availability is now current' : `Effective date updated to ${fmt(d)}`);
      }
    });
  }
  function deleteUpcoming() {                              // C14
    const u = upc();
    dialog({
      tone: 'danger', icon: 'trash-2', title: 'Delete upcoming availability?',
      body: `<p>The availability scheduled from <b>${fmt(u.eff)}</b> will be removed. The current availability keeps applying after that date.</p>`,
      ok: 'Delete upcoming', okCls: 'danger',
      onOk: () => { STORE[S.empId] = versionsOf(S.empId).filter(v => v.id !== u.id); S.sel = 'current'; render(); refreshSchedule(); persist(); toast('Upcoming availability deleted'); }
    });
  }

  function refreshSchedule() {
    try {
      if (document.getElementById('empSearch') && typeof filterEmployees === 'function') filterEmployees();
      else if (typeof renderScheduleTable === 'function') renderScheduleTable();
    } catch (e) {}
  }

  /* ---------------- Dialog + toast ---------------- */
  let dlgOk = null;
  function dialog({ tone = 'warn', icon = 'alert-triangle', title, body, ok = 'OK', okCls = 'primary', onOk }) {
    $('avmDlgIc').className = 'ic ' + tone;
    $('avmDlgIc').innerHTML = `<i data-lucide="${icon}"></i>`;
    $('avmDlgTitle').textContent = title;
    $('avmDlgBody').innerHTML = body;
    $('avmDlgOk').textContent = ok;
    $('avmDlgOk').className = 'avm-btn ' + okCls;
    dlgOk = onOk;
    $('avmDlgWrap').classList.add('open');
    icons();
    ($('avmDlgBody').querySelector('input, textarea') || $('avmDlgOk')).focus();
  }
  const dlgOpen = () => $('avmDlgWrap').classList.contains('open');
  const closeDlg = () => $('avmDlgWrap').classList.remove('open');
  function toast(t) { if (typeof window.showToast === 'function') window.showToast(t, 'info'); }

  /* ---------------- Events ---------------- */
  function bindEvents() {
    const ov = $('avmOverlay');
    ov.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('#avmClose')) return closeModal();
      const mt = t.closest('[data-mtab]'); if (mt) return switchTab(mt.dataset.mtab);
      if (merged() ? t.closest('#avmTemp') : S.tab === 'temp') return;   // temporary availability handles its own clicks
      if (t.closest('#avmStartEdit')) return startEdit();
      const sv = t.closest('[data-sel]');
      if (sv) { if (S.mode === 'edit') return guardDiscard(() => { exitEdit(); S.sel = sv.dataset.sel; render(); }); S.sel = sv.dataset.sel; return render(); }
      if (t.closest('#avmDelUp')) return deleteUpcoming();
      if (t.closest('#avmChgDate')) return changeUpcomingDate();
      if (t.closest('#avmApprove')) return approveReq();
      if (t.closest('#avmDecline')) return declineReq();
      if (t.closest('#avmCancel')) return guardDiscard(() => { const k = S.baseKey; exitEdit(); S.sel = k && k !== '__blank' ? k : 'current'; render(); });
      if (t.closest('#avmSave')) return trySave();
      if (S.mode !== 'edit') return;
      const f = t.closest('[data-fill]');
      if (f) { S.draft = f.dataset.fill === 'base' ? cloneGrid(baseGrid()) : f.dataset.fill === 'all' ? fullGrid() : emptyGrid(); return render(); }
      if (t.closest('#avmUndoAll')) { S.draft = cloneGrid(baseGrid()); return render(); }                 // C18
      const q = t.closest('[data-q]'); if (q) { S.eff = q.dataset.q; return render(); }
      const im = t.closest('[data-imode]'); if (im) { S.imode = im.dataset.imode; return render(); }                    // C3
    });
    ov.addEventListener('change', e => { if (e.target.id === 'avmEff') { S.eff = e.target.value; render(); } });
    $('avmDlgCancel').onclick = closeDlg;
    $('avmDlgOk').onclick = () => { if (dlgOk && dlgOk() === false) return; closeDlg(); };
    $('avmDlgWrap').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') $('avmDlgOk').click(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !ov.classList.contains('open')) return;
      e.stopPropagation(); e.preventDefault();
      if (dlgOpen()) closeDlg(); else closeModal();
    }, true);
  }

  /* ---------------- Open / close ---------------- */
  function openAvailabilityModal(empId, opts) {
    ensureDom();
    reloadStore();
    S = { empId, tab: (opts && opts.tab) || 'regular', sel: 'current', mode: 'view', baseKey: null, draft: null, eff: '', triedSave: false, selRow: null };
    $('avmOverlay').classList.add('open');
    render();
  }
  function closeModal() {
    const hide = () => { if (S && S.mode === 'edit') exitEdit(); if (MX) AVMERGE.close(MX); $('avmOverlay').classList.remove('open'); };
    if (merged() && TA()) return TA().crewGuard(() => guardDiscard(hide));
    if (S && S.tab === 'temp' && TA()) return TA().crewGuard(hide);
    guardDiscard(hide);
  }

  window.openAvailabilityModal = openAvailabilityModal;
  window.__availVersions = id => versionsOf(id);
  /* every employee's versions (seeds the ones not opened yet) — used by the crew export */
  window.__availAll = function () {
    const out = {};
    (typeof employeeData !== 'undefined' ? employeeData : []).forEach(e => { out[e.id] = versionsOf(e.id).map(v => ({ eff: v.eff, grid: v.grid, updatedAt: v.updatedAt, updatedBy: v.updatedBy })); });
    persist(false);
    return out;
  };
  window.openAvailabilityFromAction = function () {
    const id = typeof _empActionId !== 'undefined' ? _empActionId : null;
    if (typeof closeActionModal === 'function') closeActionModal();
    if (id !== null && id !== undefined) openAvailabilityModal(id);
  };
})();
