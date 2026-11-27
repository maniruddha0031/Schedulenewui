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
  const MIN_NOTICE_DAYS = 0;                    // earliest request date = today + N (store setting) — today is allowed
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
  /* Crew app (crew.html) sets window.CREW_CTX = { me, versions, storeKey, empId }:
     real availability from the manager + the crew member's own saved requests. */
  const CREW = window.CREW_CTX || null;
  function me() {
    if (CREW) return CREW.me;
    const e = (typeof employeeData !== 'undefined' && employeeData[0]) || { name: 'Angie Vasquez', position: 'Shift Leader', avatar: '' };
    return { name: e.name, role: e.position || 'Employee', avatar: e.avatar || '' };
  }

  /* ---------------- Data / scenarios ---------------- */
  let S = null;
  function crewLoadAll() { try { return JSON.parse(localStorage.getItem(CREW.storeKey) || '{}') || {}; } catch (e) { return {}; } }
  function crewSave() {
    if (!CREW || !S) return;
    const all = crewLoadAll();
    all[CREW.empId] = { req: S.req, history: S.history };
    try { localStorage.setItem(CREW.storeKey, JSON.stringify(all)); } catch (e) {}
    if (typeof window.onCrewAvailChange === 'function') window.onCrewAvailChange();
  }
  function crewScenario() {
    const T = TODAY();
    const vs = (CREW.versions || []).slice().sort((a, b) => a.eff.localeCompare(b.eff));
    const cur = vs.filter(v => v.eff <= T).pop();
    const mine = crewLoadAll()[CREW.empId] || {};
    // an approved request is already saved by the manager as the upcoming version: show it once, as "My request"
    const up = vs.find(v => v.eff > T && !(mine.req && mine.req.status === 'approved' && v.eff === mine.req.eff));
    S = {
      current: cur ? { eff: cur.eff, grid: cur.grid, src: cur.updatedBy ? 'Set by ' + cur.updatedBy : 'Set by your manager' }
                   : { eff: T, grid: emptyGrid(), src: 'No availability has been saved for you yet' },
      mgrUp: up ? { eff: up.eff, grid: up.grid, by: up.updatedBy || 'Store Manager', at: up.updatedAt || `${T}T09:00`, reason: 'Updated by your manager' } : null,
      req: mine.req || null, history: mine.history || [],
      sel: 'current', compare: false, mode: 'view', baseKey: null, draft: null, eff: '', tried: false, mDay: weekday(T),
    };
  }
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

  /* ---------------- DOM ----------------
     Top bar: Regular | Temporary tabs (left) · version tiles (right, collapsed by default)
     Regular: action bar (effective date etc.) · note · tools · week grid · legend
     Temporary: rendered by temp-availability.js into #taMain */
  const $ = id => document.getElementById(id);
  const fmtS = iso => fmt(iso).slice(0, 6);
  function ensureDom() {
    if ($('eaView')) return;
    const v = document.createElement('div');
    v.id = 'eaView'; v.className = 'v2';
    v.innerHTML = `
      <div class="v2-page">
        <div class="v2-top">
          <div class="v2-tabs" id="eaModes" role="tablist" aria-label="Availability type"></div>
          <span class="grow"></span>
          <div class="v2-topr" id="eaTopR"></div>
        </div>
        <div id="eaRegMain">
          <div class="avx-sh" id="eaRegHead" hidden></div>
          <section class="v2-card v2-reg">
            <div class="ea-bar" id="eaBar"></div>
            <div id="eaNote"></div>
            <div id="eaTools"></div>
            <div class="v2-gridbox" id="eaGrid"></div>
            <div class="v2-foot" id="eaFoot"></div>
          </section>
        </div>
        <div id="eaTempWrap"><div class="avx-sh" id="eaTempHead" hidden></div><div id="taMain" hidden></div></div>
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
    if (window.AVMERGE) MX = AVMERGE.host({
      root: v, frame: () => v, top: $('eaTopR'),
      regMain: $('eaRegMain'), regSec: v.querySelector('.v2-reg'), regHead: $('eaRegHead'),
      tempWrap: $('eaTempWrap'), tempHead: $('eaTempHead'), tempEl: $('taMain'),
      regEditing: () => !!S && S.mode === 'edit', tempEditing: () => !!(TA() && TA().crewEditing($('taMain'))),
      titles: { reg: () => editingOpen() ? 'Update Regular Availability Request' : 'Update Regular Availability',
        temp: () => { const h = v.querySelector('#taMain .tv-head h1'); return h ? h.textContent : 'Request Temporary Availability'; } },
      acts: { reg: ['#eaCancelEdit', '#eaSubmit'], temp: ['.tv-head [data-tv="cancel"]', '.tv-head [data-tv="review"]'] },
      onAct: a => {
        if (a === 'reg') { startEdit(); if (merged() === 'full') v.scrollTop = 0; return; }
        if (TA()) TA().crewNew({ noScroll: merged() === 'panel' });
      },
    });
  }

  /* ---------------- Merged screen (Design Versions flag, avail-merge.js) ----------------
     Regular + Temporary on one page; "Add/Update Availability" opens the editor in a side
     panel ('panel') or full screen ('full'). Both flags off -> the Regular | Temporary tabs. */
  let MX = null;
  const merged = () => (MX && window.AVMERGE ? AVMERGE.mode() : null);
  function renderMergedChrome() {
    const tE = !!(TA() && TA().crewEditing($('taMain'))), editing = S.mode === 'edit' || tE, o = openReq();
    $('eaModes').className = 'avx-title'; $('eaModes').removeAttribute('role');
    $('eaModes').innerHTML = '<h1>My Availability</h1><p>Your weekly hours, plus any dates where you can work different hours.</p>';
    $('eaTopR').innerHTML = merged() === 'full' && editing ? '' : AVMERGE.ddHTML([
      { act: 'reg', tone: 'reg', title: o ? 'Update regular availability request' : 'Update regular availability', sub: 'Change the hours you can work every week, from a date you pick.' },
      { act: 'temp', tone: 'temp', title: 'Request temporary availability', sub: 'Different hours for specific dates, like exams or a trip.' }]);
    $('eaRegHead').innerHTML = '';
    const n = TA() ? TA().crewPending(myId()) : 0;
    $('eaTempHead').innerHTML = AVMERGE.headHTML({ tone: 'temp', title: 'Temporary availability', sub: 'Different hours for specific dates. They replace your regular hours on those dates only.', count: n, countTitle: `${n} waiting for your manager` });
  }
  function renderMerged() {
    $('eaView').classList.add('avx-on');
    AVMERGE.pre(MX);
    $('eaRegMain').hidden = false; $('taMain').hidden = false;
    renderMergedChrome();
    renderBar(); renderNote(); renderGrid(); renderTools(); renderFoot();
    if (S.mode === 'view') {   // Current / Requested chips inside the card; the selected version's date + actions on a second row
      const sub = S.req && S.req.submittedAt ? 'Submitted ' + fmt(S.req.submittedAt.split('T')[0]) : '';
      const info = S.sel === 'req' && S.req ? AVMERGE.effHTML(fmt(S.req.eff), [chip(S.req.status), inDays(S.req.eff) !== 'today' && S.req.eff > TODAY() ? 'Starts ' + inDays(S.req.eff) : '', sub])
        : S.sel === 'mgr' && S.mgrUp ? AVMERGE.effHTML(fmt(S.mgrUp.eff), ['Starts ' + inDays(S.mgrUp.eff), 'Set by ' + esc(S.mgrUp.by)]) : '';
      AVMERGE.barLayout($('eaBar'), vstripHTML(), info);
    }
    if (TA()) TA().renderCrew($('taMain'), { top: null, empId: myId(), me: me(),
      onChange: () => { render(); if (typeof window.onCrewAvailChange === 'function') window.onCrewAvailChange(); },
      beforeRender: () => AVMERGE.pre(MX), onRender: () => { if (merged()) { renderMergedChrome(); AVMERGE.sync(MX); icons(); } } });
    AVMERGE.sync(MX); icons();
  }
  window.addEventListener('dflags:change', () => {
    const v = $('eaView'); if (!v || v.style.display !== 'block' || !S) return;
    if (!merged() && TA() && TA().crewEditing($('taMain'))) S.tab = 'temp';
    render();
  });

  /* ---------------- Render ---------------- */
  const TA = () => window.TA || null;
  const myId = () => CREW ? CREW.empId : ((typeof employeeData !== 'undefined' && employeeData[0]) ? employeeData[0].id : 0);
  function render() {
    if (merged()) return renderMerged();
    if (MX) { AVMERGE.sync(MX); $('eaView').classList.remove('avx-on'); $('eaModes').className = 'v2-tabs'; $('eaModes').setAttribute('role', 'tablist'); }
    renderModes();
    const temp = S.tab === 'temp' && TA();
    $('eaRegMain').hidden = !!temp; $('taMain').hidden = !temp;
    if (temp) { TA().renderCrew($('taMain'), { top: $('eaTopR'), empId: myId(), me: me(), onChange: () => { renderModes(); icons(); if (typeof window.onCrewAvailChange === 'function') window.onCrewAvailChange(); } }); icons(); return; }
    renderVstrip(); renderBar(); renderNote(); renderGrid(); renderTools(); renderFoot(); icons();
  }
  /* Regular | Temporary (temporary availability: temp-availability.js) */
  function renderModes() {
    const n = TA() ? TA().crewPending(myId()) : 0;
    $('eaModes').innerHTML = `<button type="button" role="tab" data-eatab="regular" aria-selected="${S.tab !== 'temp'}"><i data-lucide="calendar-check"></i>Regular Availability</button>
      ${TA() ? `<button type="button" role="tab" data-eatab="temp" class="temp" aria-selected="${S.tab === 'temp'}"><i data-lucide="calendar-clock"></i>Temporary Availability${n ? `<span class="n" title="${n} waiting for your manager">${n}</span>` : ''}</button>` : ''}`;
  }
  function switchTab(tab) {
    if (merged()) { const w = $(tab === 'temp' ? 'eaTempWrap' : 'eaRegMain'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (tab === S.tab) return;
    const go = () => { S.tab = tab; render(); };
    if (S.tab === 'temp') return TA().crewGuard(go);
    guard(() => { if (S.mode === 'edit') exitEdit(); go(); });
  }

  /* version tiles — collapsed strip (top right) */
  /* Only two versions are ever shown: Current + Requested, or Current + Upcoming.
     An open request (pending / approved) wins; otherwise the manager's upcoming change;
     a rejected request shows only when nothing is upcoming. */
  function secondKey() {
    if (openReq()) return 'req';
    if (S.mgrUp) return 'mgr';
    if (S.req && S.req.status === 'rejected') return 'req';
    return null;
  }
  function renderVstrip() {
    $('eaTopR').innerHTML = `${vstripHTML()}
      ${S.mode === 'view' ? `<button type="button" class="vbtn primary" data-start="1"><i data-lucide="pencil"></i>Update Regular Availability</button>` : ''}`;
  }
  function vstripHTML() {
    const k2 = secondKey(); if (S.sel !== 'current' && S.sel !== k2) S.sel = 'current';
    const vp = (key, k, v, cls) => { const on = S.sel === key && S.mode === 'view';
      return `<button type="button" class="vp ${on ? 'on' : ''} ${cls || ''}" data-sel="${key}" style="--c:${KIND[key].c}" aria-pressed="${on}" title="Show ${KIND[key].label.toLowerCase()} in the grid below"><span class="dot"></span><span class="tx"><span class="k">${k}</span><span class="v">${v}</span></span>${on ? '<i data-lucide="check" class="ck"></i>' : ''}</button>`; };
    let h = vp('current', 'Current', `Since ${fmtS(S.current.eff)} · ${gridHrs(S.current.grid)} hrs`);
    if (k2 === 'req' && S.req.status === 'approved') h += vp('req', 'Upcoming · approved', `From ${fmtS(S.req.eff)} · ${gridHrs(S.req.grid)} hrs`);
    else if (k2 === 'req') h += vp('req', `Requested ${chip(S.req.status)}`, `From ${fmtS(S.req.eff)} · ${gridHrs(S.req.grid)} hrs`, isOpen(S.req) ? '' : 'muted');
    else if (k2 === 'mgr') h += vp('mgr', 'Upcoming · manager', `From ${fmtS(S.mgrUp.eff)} · ${gridHrs(S.mgrUp.grid)} hrs`);
    return `<div class="v2-vstrip" role="group" aria-label="Availability versions">${h}</div>`;
  }
  function renderBar() {
    const o = openReq();
    if (S.mode === 'edit') {
      const T = TODAY(), nm = addDays(T, ((8 - weekday(T)) % 7) || 7), bad = S.eff && S.eff < minEff();
      const q = (iso, lbl) => `<button type="button" data-q="${iso}" class="${S.eff === iso ? 'on' : ''}">${lbl}</button>`;
      const keep = o && o.eff >= minEff() ? o.eff : (S.baseKey === 'mgr' && S.mgrUp.eff >= minEff() ? S.mgrUp.eff : '');
      const from = S.baseKey === 'req' ? `your ${o ? o.status : ''} request` : S.baseKey === 'mgr' ? 'your manager’s change' : 'your current availability';
      $('eaBar').innerHTML = `
        <div class="ti"><span class="ic" style="--c:var(--ea-brand)"><i data-lucide="pencil"></i></span>
          <div><b>${editingOpen() ? 'Update my request' : 'Request a change'}</b><small>Starting from ${from}</small></div></div>
        <div class="r">
          <div class="ea-eff"><label for="eaEff">Effective from <em>*</em></label>
            <input type="date" id="eaEff" min="${minEff()}" value="${S.eff}" aria-required="true" class="${(S.tried && !S.eff) || bad ? 'err' : ''}">
            <div class="ea-quick">${q(T, 'Today')}${q(addDays(T, 1), 'Tomorrow')}${q(nm, 'Next Mon')}${q(addDays(nm, 7), 'Mon after')}${keep && keep !== T && keep !== addDays(T, 1) && keep !== nm && keep !== addDays(nm, 7) ? q(keep, 'Keep ' + fmt(keep).slice(0, 6)) : ''}</div></div>
          <button type="button" class="ea-btn" id="eaCancelEdit">Cancel</button>
          <button type="button" class="ea-btn primary" id="eaSubmit" ${hasChanges() && !bad ? '' : 'disabled'} title="${hasChanges() ? '' : 'Change your hours or effective date to submit'}"><i data-lucide="send"></i>${editingOpen() ? 'Update request' : 'Submit request'}</button>
        </div>`;
      return;
    }
    const K = KIND[S.sel];
    const sub = S.sel === 'current' ? `In effect since ${fmt(S.current.eff)}`
      : S.sel === 'mgr' ? `Set by ${esc(S.mgrUp.by)} · from ${fmt(S.mgrUp.eff)}`
      : `${STATUS[S.req.status]} · from ${fmt(S.req.eff)}`;
    const g = gridOf(S.sel), dh = S.sel !== 'current' ? gridHrs(g) - gridHrs(S.current.grid) : 0;
    $('eaBar').innerHTML = `<div class="ti"><span class="ic" style="--c:${K.c}"><i data-lucide="${K.icon}"></i></span><div><b>${K.label}</b><small>${sub}</small></div></div>
      <div class="r">${S.sel === 'req' ? `<button type="button" class="ea-btn" id="eaShowAct"><i data-lucide="history"></i>Activity</button>${o ? '<button type="button" class="ea-btn gd" id="eaCancelReq"><i data-lucide="x-circle"></i>Cancel request</button>' : ''}` : ''}
        ${S.sel !== 'current' ? '<button type="button" class="ea-btn" data-sel="current"><i data-lucide="arrow-left"></i>Back to current</button>' : ''}
        <div class="v2-htot"><small>Weekly available hours</small><b>${gridHrs(g)} hrs${dh ? ` <span class="delta ${dh > 0 ? 'up' : 'dn'}">${dh > 0 ? '+' : ''}${dh} vs current</span>` : ''}</b></div></div>`;
  }

  const NOTE_IC = { 'n-muted': 'info', 'n-info': 'info', 'n-warn': 'alert-triangle', 'n-err': 'alert-circle' };
  function renderNote() {
    const o = openReq(); let t = '', cls = '', act = '';
    if (S.mode === 'edit') {
      const mgrLine = S.baseKey === 'mgr' && S.mgrUp ? ` Submitting <b>replaces your manager’s upcoming availability</b> from ${fmt(S.mgrUp.eff)} — your request then goes to your manager for approval.` : '';   // R6
      if (!S.eff) { t = (S.tried ? 'Select an effective date before submitting.' : `Choose the date your new availability starts (earliest ${fmt(minEff())}).`) + mgrLine; cls = S.tried ? 'n-err' : 'n-muted'; }
      else if (S.eff < minEff()) { t = `The effective date must be ${fmt(minEff())} or later.`; cls = 'n-err'; }           // R1
      else if (o && o.status === 'approved') { t = 'This request is already approved. Updating it sends it back to your manager for approval.' + mgrLine; cls = 'n-warn'; }
      else if (o) { t = `Updates your pending request${S.eff !== o.eff ? `; the effective date moves from ${fmt(o.eff)} to <b>${fmt(S.eff)}</b>` : ''}.`; cls = 'n-info'; }
      else { t = `If approved, this applies from <b>${fmt(S.eff)}</b>.` + mgrLine; cls = mgrLine ? 'n-warn' : 'n-info'; }
    } else if (S.sel === 'req' && S.req && S.req.status === 'rejected') { t = 'Your manager didn’t approve this request. Use <b>Request a change</b> to send a new one.'; cls = 'n-err'; }
    else if (S.sel === 'current' && TA() && TA().activeNotice(myId())) {
      const tn = TA().activeNotice(myId());
      t = `<b>Temporary availability ${tn.start <= TODAY() ? 'is in effect' : 'is coming up'}</b> for ${TA().fmtRange(tn.start, tn.end)} — it replaces these regular hours on those dates only.`; cls = 'n-info'; act = '<button type="button" class="ta-link" data-eatab="temp">View</button>';
    }
    $('eaNote').innerHTML = t ? `<div class="ea-note ${cls}"><i data-lucide="${NOTE_IC[cls]}"></i><div class="tx">${t}</div>${act}</div>` : '';
  }

  function renderTools() {
    if (S.mode !== 'edit') { $('eaTools').innerHTML = ''; return; }
    const time = S.imode === 'time';
    $('eaTools').innerHTML = `<div class="v2-tools">
      <div class="v2-imode" role="tablist" aria-label="How to set hours">
        <button type="button" role="tab" data-imode="drag" aria-selected="${!time}"><i data-lucide="mouse-pointer-2"></i>Drag on grid</button>
        <button type="button" role="tab" data-imode="time" aria-selected="${time}"><i data-lucide="clock-3"></i>Enter times</button></div>
      ${window.AVED ? AVED.toolsHTML('ea', edCfg()) : ''}</div>`;
  }
  /* the hours editor (avail-editor.js): Drag on grid | Enter times */
  function edCfg() {
    const ref = refInfo(), td = weekday(TODAY()), o = openReq();
    return { keys: ORDER.map(d => ({ k: 'd' + d, w: d, today: d === td })),
      get: k => S.draft[+k.slice(1)], set: (k, r) => { S.draft[+k.slice(1)] = r; }, ref: k => ref ? ref.g[+k.slice(1)] : null,
      mode: S.imode === 'time' ? 'time' : 'drag', refShort: ref ? ref.short : '',
      refLegend: S.baseKey === 'req' ? `Your ${o ? o.status : ''} request` : S.baseKey === 'mgr' ? 'Your manager’s upcoming hours' : 'Your regular hours',
      onChange: render };
  }

  /* the availability window: one row per weekday (shared week grid from temp-availability.js) */
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  function refInfo() {
    if (S.mode === 'edit') return { g: baseGrid(), name: S.baseKey === 'current' ? 'Regular' : S.baseKey === 'mgr' ? 'Manager’s change' : 'Your request', short: S.baseKey === 'current' ? 'regular' : S.baseKey === 'mgr' ? 'upcoming' : 'request', legend: S.baseKey === 'current' ? 'Your regular hours' : 'Hours you started from' };
    if (S.sel !== 'current') return { g: S.current.grid, name: 'Current', short: 'current', legend: 'Your current hours' };
    return null;
  }
  function renderGrid() {
    if (!TA()) { $('eaGrid').innerHTML = ''; return; }
    const edit = S.mode === 'edit', g = edit ? S.draft : gridOf(S.sel), ref = refInfo(), td = weekday(TODAY());
    const rows = ORDER.map(d => ({ k: 'd' + d, w: d, label: DAYS_FULL[d] + 's', title: 'Every ' + DAYS_FULL[d], sub: 'Every ' + DAYS_FULL[d], row: g[d], ref: ref ? ref.g[d] : null,
      today: d === td, badge: d === td ? ' <span class="wg-today">Today</span>' : '' }));
    TA().wgBind('ea', { get: k => S.draft[+k.slice(1)], set: (k, r) => { S.draft[+k.slice(1)] = r; }, setSel: k => { S.selRow = k; }, rerender: render,
      keys: () => ORDER.map(d => 'd' + d), weekday: k => +k.slice(1) });
    if (edit && window.AVED) return AVED.mount($('eaGrid'), 'ea', edCfg());
    if (window.AVED) { const td2 = weekday(TODAY()), tw = tempOnReg(); $('eaGrid').innerHTML = AVED.viewHTML({ keys: ORDER.map(d => ({ k: 'd' + d, w: d, today: d === td2 })), get: k => g[+k.slice(1)], ref: k => ref ? ref.g[+k.slice(1)] : null, refShort: ref ? ref.short : '', temp: tw ? k => tw.map[k] : null }); return; }
    $('eaGrid').innerHTML = TA().wgHTML('ea', { rows, sel: S.selRow, edit, colHead: 'Weekday', sumHead: 'Your hours', refName: ref ? ref.name : '', refShort: ref ? ref.short : '', copyAllLabel: 'Copy to every day', bars: !edit });
  }
  /* Design Versions flag 'availTempReg': temporary hours of the next 7 days on the Regular view (current version only) */
  function tempOnReg() {
    if (!(window.DFLAGS && DFLAGS.get('availTempReg') && TA() && window.AVED && AVED.tempWeek) || S.mode !== 'view' || S.sel !== 'current' || merged()) return null;
    return AVED.tempWeek(iso => TA().effective(myId(), iso), TODAY());
  }
  function renderFoot() {
    const edit = S.mode === 'edit', g = edit ? S.draft : gridOf(S.sel), ref = refInfo(), tw = tempOnReg();
    const diff = ref ? gridHrs(g) - gridHrs(ref.g) : 0;
    $('eaFoot').style.display = edit && window.AVED ? 'none' : ''; if (edit && window.AVED) return;
    $('eaFoot').innerHTML = `<div class="vlegend"><span><i class="vsw" style="background:var(--a-avail)"></i>${tw ? 'Regular' : 'Available'}</span>${tw ? `<span><i class="vsw" style="background:var(--ae-tmp)"></i>Temporary (${tw.range})</span>` : ''}<span><i class="vsw" style="border:1px solid var(--a-line-2)"></i>Unavailable</span>
        ${ref ? `<span><i class="vsw" style="border:1px dashed var(--a-primary);background:transparent"></i>${ref.legend}</span><span><span class="vtag diff">Changed</span>Differs from ${ref.short}</span>` : ''}</div>
      <span class="grow"></span>
      ${edit ? `<div class="vtotal">Weekly available hours ${ref && diff ? `<span class="delta ${diff > 0 ? 'up' : 'dn'}">${diff > 0 ? '+' : ''}${diff} hrs</span>` : ''}<b>${gridHrs(g)} hrs</b>${ref ? `<span>vs ${gridHrs(ref.g)} hrs</span>` : ''}</div>` : ''}`;
  }

  /* ---------------- Actions ---------------- */
  function startEdit() {
    if (S.mode === 'edit') return;
    const o = openReq();
    S.mode = 'edit';
    S.baseKey = o ? 'req' : (S.mgrUp ? 'mgr' : 'current');       // no request of mine → edit the upcoming version if there is one
    S.draft = clone(baseGrid());
    S.eff = o && o.eff >= minEff() ? o.eff : (!o && S.mgrUp && S.mgrUp.eff >= minEff() ? S.mgrUp.eff : '');
    S.tried = false; S.compare = false; S.selRow = null;
    if (window.AVED) AVED.reset('ea');
    render();
  }
  function exitEdit() { S.mode = 'view'; S.draft = null; S.baseKey = null; S.eff = ''; S.tried = false; S.selRow = null; }
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
    if (S.mgrUp && S.baseKey === 'mgr') {
      title = title || 'Replace the upcoming availability?'; ok = 'Submit request';
      body += `<p>Your manager’s upcoming availability from <b>${fmt(S.mgrUp.eff)}</b> (${gridHrs(S.mgrUp.grid)} hrs/week) will be <b>replaced by this request</b>.</p>
        <p>The request goes to your manager as <b>Pending approval</b>. Until it’s approved, your current availability keeps applying.</p>`;
    }
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
    if (S.mgrUp) {                                       // the request replaces the manager's upcoming change
      S.req.log.push({ t: 'Replaced upcoming', at, by: 'System', note: `manager’s upcoming availability from ${fmt(S.mgrUp.eff)} removed` });
      dropMgrUp(S.mgrUp.eff); S.mgrUp = null;
    }
    exitEdit(); S.sel = 'req'; render(); crewSave();
  }
  /* remove the manager's upcoming version from the shared stores (crew app) so the schedule and the manager see it gone */
  function dropMgrUp(eff) {
    if (!CREW) return;
    const id = CREW.empId, rd = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const av = rd('zipAvailStore'); if (av && av.store && av.store[id]) { av.store[id] = av.store[id].filter(v => v.eff !== eff); wr('zipAvailStore', av); }
    const d = rd('zipCrewData'); if (d && d.availability && d.availability[id]) { d.availability[id] = d.availability[id].filter(v => v.eff !== eff); wr('zipCrewData', d); }
    CREW.versions = (CREW.versions || []).filter(v => v.eff !== eff);
  }
  function cancelRequest() {                                                                       // R8
    const o = openReq();
    dialog({ tone: 'danger', icon: 'x-circle', title: 'Cancel your request?',
      body: `<p>Your ${o.status} request from <b>${fmt(o.eff)}</b> will be withdrawn. Your availability stays as it is${S.mgrUp ? `, including your manager’s change from ${fmt(S.mgrUp.eff)}` : ''}.</p>`,
      ok: 'Cancel request', okCls: 'danger',
      onOk: () => {
        // cancelled requests leave the timeline entirely; only a record stays in "Past requests"
        o.status = 'cancelled'; o.log.push({ t: 'Cancelled', at: nowStamp(), by: me().name });
        S.history.unshift(o); S.req = null; crewSave();
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
      const tb = t.closest('[data-eatab]'); if (tb) return switchTab(tb.dataset.eatab);
      if (merged() ? t.closest('#taMain') : S.tab === 'temp') return;   // temporary availability handles its own clicks
      if (t.closest('[data-start]')) return startEdit();
      const sv = t.closest('[data-sel]');
      if (sv) {
        if (S.mode === 'edit') return guard(() => { exitEdit(); S.sel = sv.dataset.sel; render(); });
        S.sel = sv.dataset.sel; return render();
      }
      if (t.closest('#eaCancelReq')) return cancelRequest();
      if (t.closest('#eaShowAct')) return showActivity();
      if (t.closest('#eaCancelEdit')) return guard(() => { exitEdit(); render(); });
      if (t.closest('#eaSubmit')) return trySubmit();
      if (S.mode !== 'edit') return;
      const im = t.closest('[data-imode]'); if (im) { S.imode = im.dataset.imode; S.selRow = null; return render(); }
      const f = t.closest('[data-fill]');
      if (f) { S.draft = f.dataset.fill === 'base' ? clone(baseGrid()) : DAYS.map(() => Array(24).fill(f.dataset.fill === 'all')); return render(); }
      if (t.closest('#eaUndo')) { S.draft = clone(baseGrid()); return render(); }
      const q = t.closest('[data-q]'); if (q) { S.eff = q.dataset.q; return render(); }
    });
    v.addEventListener('change', e => {
      if (e.target.id === 'eaEff') { S.eff = e.target.value; render(); }
    });
    $('eaDCancel').onclick = closeD;
    $('eaDOk').onclick = () => { if (dOk && dOk() === false) return; closeD(); };
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if ($('eaDw').classList.contains('open')) { e.stopPropagation(); closeD(); }
    }, true);
  }

  /* ---------------- Open / close ---------------- */
  function openMyAvailability(opts) {
    ensureDom();
    const keepTab = S ? S.tab : 'regular';
    if (CREW) crewScenario();          // always fresh: the manager may have changed something
    else if (!S) scenario('both');
    S.tab = (opts && opts.tab) || keepTab || 'regular';
    rollForward();
    if (S.mode !== 'edit') { S.sel = 'current'; S.compare = false; S.selRow = null; }   // land on the current availability
    $('eaView').style.display = 'block';
    render();
  }
  function closeMyAvailability(force) {
    const v = $('eaView'); if (!v || v.style.display !== 'block') return;
    const hide = () => {
      if (S && S.mode === 'edit') exitEdit();
      if (MX) AVMERGE.close(MX);
      v.style.display = 'none';
      if (location.hash === '#team-center/availability') history.replaceState(null, '', '#team-center');
      document.querySelectorAll('.sidebar .tc-sub a.active').forEach(a => a.classList.remove('active'));
    };
    if (force === true) { if (TA()) TA().crewDiscard(); return hide(); }
    if (merged() && TA()) return TA().crewGuard(() => guard(hide));
    if (S && S.tab === 'temp' && TA()) return TA().crewGuard(hide);
    guard(hide);
  }
  window.openMyAvailability = openMyAvailability;
  window.closeMyAvailability = closeMyAvailability;
})();
