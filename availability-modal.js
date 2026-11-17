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

  /* ---------------- Modal state ---------------- */
  let S = null;   // { empId, view, mode, baseId, draft, eff, triedSave }
  const $ = id => document.getElementById(id);
  const emp = () => employeeData.find(e => e.id == S.empId) || { name: 'Employee', position: '' };
  const cur = () => currentV(S.empId);
  const upc = () => upcomingV(S.empId);
  const byId = id => versionsOf(S.empId).find(v => v.id === id);
  const baseGrid = () => (S.baseId && S.baseId !== '__blank' && byId(S.baseId)) ? byId(S.baseId).grid : emptyGrid();
  const editingUpcoming = () => { const u = upc(); return !!(u && S.baseId === u.id); };
  const hoursChanged = () => S.mode === 'edit' && !sameGrid(S.draft, baseGrid());
  const hasChanges = () => hoursChanged() || (editingUpcoming() && !!S.eff && S.eff !== upc().eff);   // C5
  function analyse(E) { if (!E) return 'empty'; const T = today(); if (E < T) return 'past'; return E === T ? 'today' : 'future'; }

  /* ---------------- DOM shell ---------------- */
  function ensureDom() {
    if ($('avmOverlay')) return;
    const wrap = document.createElement('div');
    wrap.className = 'avm-root';
    wrap.innerHTML = `
      <div class="avm-overlay" id="avmOverlay" role="dialog" aria-modal="true" aria-labelledby="avmTitle">
        <div class="avm-modal">
          <div class="avm-head">
            <img id="avmAvatar" alt="">
            <div class="min-w-0">
              <h2 id="avmTitle">Availability</h2>
              <div class="sub" id="avmSub"></div>
            </div>
            <div class="spacer"></div>
            <button type="button" class="avm-x" id="avmClose" aria-label="Close" title="Close"><i data-lucide="x" style="width:20px;height:20px"></i></button>
          </div>
          <div class="avm-status" id="avmStatus"></div>
          <div class="avm-bar" id="avmBar"></div>
          <div id="avmTools"></div>
          <div id="avmNote"></div>
          <div class="avm-scroll"><div id="avmBody"></div></div>
          <div class="avm-legend" id="avmLegend"></div>
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
  }
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };

  /* ---------------- Render ---------------- */
  function render() {
    renderHead(); renderStatus(); renderBar(); renderTools(); renderNote(); renderBody(); renderLegend(); icons();
  }

  function renderHead() {
    const e = emp();
    const roles = [e.position, ...((window._skillsByPosition || (typeof _skillsByPosition !== 'undefined' ? _skillsByPosition : {}))[e.position] || [])]
      .filter((p, i, a) => p && a.indexOf(p) === i);
    $('avmAvatar').src = e.avatar || '';
    $('avmTitle').textContent = `Availability of ${e.name}`;
    $('avmSub').innerHTML = `<span>${esc(roles.join(', ') || 'Employee')}</span><span class="sep"></span><span>Store timezone: ${STORE_TZ_LABEL}</span>`;
  }

  function renderStatus() {
    const c = cur(), u = upc(), lu = lastUpdatedV(S.empId), T = today();
    const n = u ? daysBetween(T, u.eff) : 0;
    $('avmStatus').innerHTML = `
      <div class="avm-stat">
        <div class="k"><i style="background:var(--avm-avail)"></i>Current availability effective</div>
        <div class="v">${c ? 'Since ' + fmt(c.eff) : 'Not set'}</div>
        <div class="m">${c ? gridHrs(c.grid) + ' available hrs / week' : 'No availability saved yet'}</div>
      </div>
      <div class="avm-stat">
        <div class="k"><i style="background:var(--avm-info)"></i>Upcoming availability</div>
        <div class="v">${u ? 'Effective ' + fmt(u.eff) : 'None scheduled'}</div>
        <div class="m">${u ? `Starts in ${n} day${n === 1 ? '' : 's'}${S.mode === 'view' && S.view !== u.id ? ` · <button type="button" class="avm-link" data-view="${u.id}">View</button>` : ''}` : 'A change saved with a future date shows here'}</div>
      </div>
      <div class="avm-stat">
        <div class="k"><i style="background:var(--avm-ink-3)"></i>Last updated</div>
        <div class="v">${lu ? fmtDT(lu.updatedAt) : '—'}</div>
        <div class="m">${lu ? 'by ' + esc(lu.updatedBy) : ''}</div>
      </div>`;
  }

  function renderBar() {
    const c = cur(), u = upc(), T = today();
    if (S.mode === 'edit') {
      const nextMon = addDays(T, ((8 - weekday(T)) % 7) || 7);
      const k = analyse(S.eff);
      const can = hasChanges() && k !== 'past';
      const chip = (iso, lbl) => `<button type="button" data-q="${iso}" class="${S.eff === iso ? 'on' : ''}">${lbl}</button>`;
      $('avmBar').innerHTML = `
        <div class="left">
          <div class="avm-eff">
            <label for="avmEff">Effective from <em>*</em></label>
            <input type="date" id="avmEff" min="${T}" value="${S.eff}" aria-required="true" class="${(S.triedSave && !S.eff) || k === 'past' ? 'err' : ''}">
            <div class="avm-quick">${chip(T, 'Today')}${chip(addDays(T, 1), 'Tomorrow')}${chip(nextMon, 'Next Mon')}</div>
          </div>
        </div>
        <div class="right">
          <button type="button" class="avm-btn" id="avmCancel">Cancel</button>
          <button type="button" class="avm-btn primary" id="avmSave" ${can ? '' : 'disabled'} title="${hasChanges() ? '' : 'Change hours or the effective date to save'}"><i data-lucide="check"></i>Save availability</button>
        </div>`;
      return;
    }
    const tabs = [];
    if (c) tabs.push(`<button type="button" role="tab" class="avm-tab ${S.view === c.id ? 'on' : ''}" data-view="${c.id}">Current<span class="avm-pill cur">Since ${fmtShort(c.eff)}</span></button>`);
    if (u) tabs.push(`<button type="button" role="tab" class="avm-tab ${S.view === u.id ? 'on' : ''}" data-view="${u.id}">Upcoming<span class="avm-pill up">From ${fmtShort(u.eff)}</span></button>`);
    if (c && u) tabs.push(`<button type="button" role="tab" class="avm-tab ${S.view === 'compare' ? 'on' : ''}" data-view="compare"><i data-lucide="git-compare" style="width:14px;height:14px"></i>Compare</button>`);
    const onUp = u && S.view === u.id;
    $('avmBar').innerHTML = `
      <div class="left">${tabs.length ? `<div class="avm-tabs" role="tablist">${tabs.join('')}</div>` : '<span class="muted">No availability set</span>'}</div>
      <div class="right">
        ${onUp ? `<button type="button" class="avm-btn ghost-danger" id="avmDelUp"><i data-lucide="trash-2"></i>Delete upcoming</button>
                  <button type="button" class="avm-btn" id="avmChgDate"><i data-lucide="calendar"></i>Change effective date</button>` : ''}
        <button type="button" class="avm-btn primary" id="avmStartEdit"><i data-lucide="pencil"></i>${onUp ? 'Edit upcoming' : 'Update availability'}</button>
      </div>`;
  }

  function renderTools() {
    if (S.mode !== 'edit') { $('avmTools').innerHTML = ''; return; }
    $('avmTools').innerHTML = `<div class="avm-tools">
      <span class="hint"><i data-lucide="mouse-pointer-click"></i>Click or drag across hours to mark them available. Click a green hour to remove it. Changed hours show a dot.</span>
      <button type="button" class="avm-btn sm tint-green" id="avmAllWeek"><i data-lucide="calendar-check"></i>Mark whole week available</button>
      <button type="button" class="avm-btn sm tint-red" id="avmClearWeek"><i data-lucide="eraser"></i>Clear week</button>
      <button type="button" class="avm-btn sm" id="avmUndoAll" ${hoursChanged() ? '' : 'disabled'}><i data-lucide="undo-2"></i>Undo changes</button>
    </div>`;
  }

  const NOTE_IC = { 'n-muted': 'info', 'n-info': 'info', 'n-warn': 'alert-triangle', 'n-err': 'alert-circle' };
  const note = (cls, html) => `<div class="avm-note ${cls}"><i data-lucide="${NOTE_IC[cls]}"></i><div>${html}</div></div>`;

  function renderNote() {
    const c = cur(), u = upc();
    if (S.mode === 'edit') {
      const k = analyse(S.eff); let t, cls;
      const overridesOther = u && !editingUpcoming();
      if (k === 'empty') {
        t = S.triedSave ? 'Select an effective date before saving.' : 'Choose the effective date above. It can be today or any later date.';
        cls = S.triedSave ? 'n-err' : 'n-muted';
      } else if (k === 'past') {
        t = 'The effective date can’t be in the past. Pick today or a later date.'; cls = 'n-err';
      } else if (k === 'today') {
        t = 'Applies from <b>today</b> and replaces the current availability immediately.';
        if (u) t += editingUpcoming() ? ` The upcoming availability from ${fmt(u.eff)} will apply from today instead.` : ` The upcoming availability from <b>${fmt(u.eff)}</b> will be removed.`;
        cls = overridesOther ? 'n-warn' : 'n-info';
      } else if (overridesOther) {
        t = `This becomes the upcoming availability from <b>${fmt(S.eff)}</b> and <b>overrides</b> the existing upcoming one from ${fmt(u.eff)}. You’ll be asked to confirm.`; cls = 'n-warn';
      } else if (editingUpcoming()) {
        t = S.eff !== u.eff ? `Upcoming availability moves from ${fmt(u.eff)} to <b>${fmt(S.eff)}</b>.` : `Updates the upcoming availability from <b>${fmt(S.eff)}</b>.`; cls = 'n-info';
      } else {
        t = `Becomes the upcoming availability from <b>${fmt(S.eff)}</b>. Current availability applies until ${fmt(addDays(S.eff, -1))}.`; cls = 'n-info';
      }
      if (k !== 'empty' && k !== 'past' && gridHrs(S.draft) === 0) t += ` <b>${esc(emp().name)} will show as unavailable all week</b> from ${k === 'today' ? 'today' : fmt(S.eff)}.`;   // C11
      $('avmNote').innerHTML = note(cls, t);
      return;
    }
    if (S.view === 'compare' && c && u) { $('avmNote').innerHTML = note('n-info', `Comparing <b>Current</b> (since ${fmt(c.eff)}) with <b>Upcoming</b> (from ${fmt(u.eff)}). Underlined hours change.`); return; }
    if (u && S.view === u.id) { $('avmNote').innerHTML = note('n-info', `Takes effect on <b>${fmt(u.eff)}</b>. Until ${fmt(addDays(u.eff, -1))}, the current availability applies. Saved ${fmtDT(u.updatedAt)} by ${esc(u.updatedBy)}.`); return; }   // C15
    $('avmNote').innerHTML = '';
  }

  function gridHTML(grid, editable, base) {
    const td = weekday(today());
    let h = `<div class="avm-grid ${editable ? 'edit' : ''}" id="avmGrid"><div class="avm-row head"><div></div>${Array.from({ length: 24 }, (_, i) => `<div class="hc">${hourLbl(i)}</div>`).join('')}<div class="sumh">Available hours</div></div>`;
    grid.forEach((row, d) => {
      h += `<div class="avm-row"><div class="avm-day ${d === td ? 'today' : ''}" ${d === td ? 'title="Today"' : ''}>${DAYS[d]}</div>`;
      row.forEach((on, hr) => {
        const chg = base && base[d][hr] !== on, was = base && base[d][hr];
        h += `<div class="avm-cell ${on ? 'on' : ''} ${chg ? 'chg' : ''} ${was ? 'was' : ''}" data-d="${d}" data-h="${hr}" title="${DAYS[d]} ${tLbl(hr)} – ${tLbl(hr + 1)}"></div>`;
      });
      h += `<div class="avm-sum"><div class="r ${rowHrs(row) ? '' : 'none'}">${rangeText(row)}</div><div class="h">${rowHrs(row)} hrs</div>`;
      if (editable) h += `<div class="avm-acts"><button type="button" data-act="all" data-d="${d}">All day</button><button type="button" data-act="clear" data-d="${d}">Clear</button><button type="button" data-act="copy" data-d="${d}">Copy to all days</button></div>`;
      h += `</div></div>`;
    });
    return h + `</div>`;
  }

  function compareHTML(a, b) {
    let h = `<div class="avm-grid"><div class="avm-cmp-day" style="border-top:0;padding:0 0 4px"><div></div><div class="avm-cmp-line"><div></div>${Array.from({ length: 24 }, (_, i) => `<div style="font-size:10.5px;font-weight:600;color:var(--avm-ink-3)">${hourLbl(i)}</div>`).join('')}</div><div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--avm-ink-3);padding-left:14px">What changes</div></div>`;
    DAYS.forEach((dn, d) => {
      const diff = a.grid[d].some((v, i) => v !== b.grid[d][i]);
      const line = (g, cls, lbl) => `<div class="avm-cmp-line ${cls}"><div class="lbl">${lbl}</div>${g[d].map((v, i) => `<div class="c ${v ? 'on' : ''} ${cls === 'new' && a.grid[d][i] !== b.grid[d][i] ? 'diff' : ''}"></div>`).join('')}</div>`;
      h += `<div class="avm-cmp-day"><div class="avm-day">${dn}</div><div class="avm-cmp-lines">${line(a.grid, 'cur', 'Current')}${line(b.grid, 'new', 'From ' + fmtShort(b.eff))}</div>
        <div class="avm-sum" style="border:0"><div class="r ${rowHrs(b.grid[d]) ? '' : 'none'}">${rangeText(b.grid[d])}</div>
        <span class="avm-chg ${diff ? 'diff' : 'same'}">${diff ? `Changed (${rowHrs(a.grid[d])} → ${rowHrs(b.grid[d])} hrs)` : 'No change'}</span></div></div>`;
    });
    return h + `</div>`;
  }

  function renderBody() {
    if (S.mode === 'edit') { $('avmBody').innerHTML = gridHTML(S.draft, true, baseGrid()); bindPaint(); return; }
    if (S.view === 'compare' && cur() && upc()) { $('avmBody').innerHTML = compareHTML(cur(), upc()); return; }
    const v = byId(S.view);
    $('avmBody').innerHTML = v ? gridHTML(v.grid, false, null)
      : `<div class="avm-empty"><div class="ic"><i data-lucide="calendar-clock"></i></div><div class="t">No availability set</div>
         <div>${esc(emp().name)} doesn’t have any availability saved yet. Use <b>Update availability</b> to add it — you’ll start from a blank week.</div></div>`;   // C19
  }

  function renderLegend() {
    const sw = s => `<i style="${s}"></i>`;
    let items;
    if (S.mode === 'edit') items = `<span>${sw('background:var(--avm-avail)')}Available</span><span>${sw('background:var(--avm-cell)')}Unavailable</span><span>${sw('background:repeating-linear-gradient(135deg,var(--avm-cell),var(--avm-cell) 4px,var(--avm-ghost) 4px,var(--avm-ghost) 6px)')}Removed (was available)</span><span>${sw('background:var(--avm-brand);border-radius:50%;width:8px;height:8px;border:0;vertical-align:0')}Changed hour</span>`;
    else if (S.view === 'compare') items = `<span>${sw('background:var(--avm-cur-bar)')}Current</span><span>${sw('background:var(--avm-avail)')}Upcoming</span><span>${sw('background:var(--avm-surface-2);box-shadow:inset 0 -3px 0 var(--avm-brand)')}Changed hour</span>`;
    else items = `<span>${sw('background:var(--avm-avail)')}Available</span><span>${sw('background:var(--avm-cell)')}Unavailable</span>`;
    let tot;
    if (S.mode !== 'edit' && S.view === 'compare' && cur() && upc()) tot = `${gridHrs(cur().grid)} → ${gridHrs(upc().grid)} hrs`;
    else { const g = S.mode === 'edit' ? S.draft : (byId(S.view) || {}).grid; tot = (g ? gridHrs(g) : 0) + ' hrs'; }
    $('avmLegend').innerHTML = items + `<span class="tot">Weekly available hours<b>${tot}</b></span>`;
  }

  /* ---------------- Painting (click / drag, mouse + touch) ---------------- */
  let painting = false, paintVal = true;
  function setCell(cell) {
    const d = +cell.dataset.d, h = +cell.dataset.h;
    if (S.draft[d][h] === paintVal) return;
    S.draft[d][h] = paintVal;
    cell.classList.toggle('on', paintVal);
    cell.classList.toggle('chg', baseGrid()[d][h] !== paintVal);
  }
  function bindPaint() {
    const g = $('avmGrid'); if (!g) return;
    g.style.touchAction = 'none';
    g.addEventListener('pointerdown', e => {
      const c = e.target.closest('.avm-cell'); if (!c) return;
      e.preventDefault(); painting = true;
      paintVal = !S.draft[+c.dataset.d][+c.dataset.h];       // first cell decides add vs remove
      setCell(c);
    });
    g.addEventListener('pointermove', e => {
      if (!painting) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const c = t && t.closest && t.closest('.avm-cell');
      if (c && g.contains(c)) setCell(c);
    });
  }
  window.addEventListener('pointerup', () => { if (painting) { painting = false; render(); } });
  window.addEventListener('pointercancel', () => { if (painting) { painting = false; render(); } });

  /* ---------------- Actions ---------------- */
  function startEdit() {
    const c = cur(), u = upc();
    const v = S.view === 'compare' ? u : (byId(S.view) || c);
    S.mode = 'edit';
    S.baseId = v ? v.id : '__blank';                       // C19: no availability → blank week
    S.draft = v ? cloneGrid(v.grid) : emptyGrid();
    S.eff = (u && v && v.id === u.id) ? u.eff : '';         // C4
    S.triedSave = false;
    render();
  }
  function exitEdit() { S.mode = 'view'; S.draft = null; S.baseId = null; S.eff = ''; S.triedSave = false; }
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

  function trySave() {
    S.triedSave = true;
    const k = analyse(S.eff);
    if (k === 'empty' || k === 'past') { render(); const i = $('avmEff'); i && i.focus(); return; }   // C1, C2
    if (!hasChanges()) return;
    const E = S.eff, u = upc();
    const overriding = !!(u && !editingUpcoming());        // C8 (C9: editing upcoming never asks)
    const conflicts = conflictsFor(E, S.draft);
    const empty = gridHrs(S.draft) === 0;
    if (!overriding && !conflicts.length && !empty) return commit(E);

    let body = '';
    if (overriding) body += `<p>An upcoming availability is already scheduled. Only one upcoming availability can exist, so saving will replace it:</p>
      <div class="box">Upcoming from <b>${fmt(u.eff)}</b> · ${gridHrs(u.grid)} hrs/week · saved by ${esc(u.updatedBy)}</div>
      <p>The new availability will apply from <b>${E === today() ? 'today' : fmt(E)}</b>.</p>`;
    if (conflicts.length) {
      const shown = conflicts.slice(0, 6);
      body += `${overriding ? '<div class="sec">Shift conflicts</div>' : ''}<p><b>${conflicts.length} scheduled shift${conflicts.length > 1 ? 's' : ''}</b> fall outside the new availability:</p>
        <ul>${shown.map(s => `<li>${DAYS[weekday(s.date)]}, ${fmt(s.date)}: ${hm(s.start)} – ${hm(s.end)} (${esc(s.role)})</li>`).join('')}${conflicts.length > shown.length ? `<li>+${conflicts.length - shown.length} more</li>` : ''}</ul>
        <p>These shifts stay on the schedule and are flagged for review.</p>`;
    }
    if (empty) body += `<p>No hours are marked available. <b>${esc(emp().name)} will show as unavailable all week from ${E === today() ? 'today' : fmt(E)}.</b></p>`;   // C11
    dialog({
      tone: overriding ? 'danger' : 'warn', icon: 'alert-triangle',
      title: overriding ? 'Override upcoming availability?' : 'Check before saving', body,
      ok: overriding ? 'Override and save' : 'Save anyway', okCls: overriding ? 'danger' : 'primary',
      onOk: () => commit(E)
    });
  }

  /* C6/C7/C8/C9: drop any upcoming (single-upcoming rule) and any version starting on E, then add the new one */
  function commit(E) {
    const T = today();
    STORE[S.empId] = versionsOf(S.empId).filter(v => !(v.eff > T) && v.eff !== E);
    const nv = { id: 'v' + (_vid++), eff: E, grid: cloneGrid(S.draft), updatedAt: nowStamp(), updatedBy: MANAGER };
    STORE[S.empId].push(nv);
    exitEdit(); S.view = nv.id;                            // C12
    render(); refreshSchedule();
    toast(`Availability saved, effective ${E === T ? 'today' : fmt(E)}`);
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
        S.view = u.id; render(); refreshSchedule();
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
      onOk: () => { STORE[S.empId] = versionsOf(S.empId).filter(v => v.id !== u.id); S.view = cur() ? cur().id : null; render(); refreshSchedule(); toast('Upcoming availability deleted'); }
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
    ($('avmDlgBody').querySelector('input') || $('avmDlgOk')).focus();
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
      const vb = t.closest('[data-view]'); if (vb && S.mode === 'view') { S.view = vb.dataset.view; return render(); }
      if (t.closest('#avmStartEdit')) return startEdit();
      if (t.closest('#avmDelUp')) return deleteUpcoming();
      if (t.closest('#avmChgDate')) return changeUpcomingDate();
      if (t.closest('#avmCancel')) return guardDiscard(() => { const keep = S.baseId; exitEdit(); S.view = byId(keep) ? keep : (cur() ? cur().id : null); render(); });
      if (t.closest('#avmSave')) return trySave();
      if (t.closest('#avmAllWeek')) { S.draft = fullGrid(); return render(); }
      if (t.closest('#avmClearWeek')) { S.draft = emptyGrid(); return render(); }
      if (t.closest('#avmUndoAll')) { S.draft = cloneGrid(baseGrid()); return render(); }                 // C18
      const q = t.closest('[data-q]'); if (q) { S.eff = q.dataset.q; return render(); }                    // C3
      const act = t.closest('[data-act]');
      if (act) {
        const d = +act.dataset.d;
        if (act.dataset.act === 'all') S.draft[d] = Array(24).fill(true);
        if (act.dataset.act === 'clear') S.draft[d] = Array(24).fill(false);
        if (act.dataset.act === 'copy') S.draft = DAYS.map(() => S.draft[d].slice());
        return render();
      }
    });
    ov.addEventListener('change', e => {
      if (e.target.id === 'avmEff') { S.eff = e.target.value; render(); }
    });
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
  function openAvailabilityModal(empId) {
    ensureDom();
    S = { empId, view: null, mode: 'view', baseId: null, draft: null, eff: '', triedSave: false };
    const c = cur();
    S.view = c ? c.id : (upc() ? upc().id : null);
    $('avmOverlay').classList.add('open');
    render();
  }
  function closeModal() { guardDiscard(() => { if (S && S.mode === 'edit') exitEdit(); $('avmOverlay').classList.remove('open'); }); }

  window.openAvailabilityModal = openAvailabilityModal;
  window.openAvailabilityFromAction = function () {
    const id = typeof _empActionId !== 'undefined' ? _empActionId : null;
    if (typeof closeActionModal === 'function') closeActionModal();
    if (id !== null && id !== undefined) openAvailabilityModal(id);
  };
})();
