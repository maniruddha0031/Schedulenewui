/* =====================================================================
   Schedule Pad → Unassigned row → "Offer"
   Replaces the old static pop-up (openUnassignedModal) with a working one:
   - Filters (department / position) for the unassigned shifts of the week
   - Pick ONE shift → Eligible / Others employees, sort, select all, Send Offer
   - "Select all shifts" → employees hidden, Send Offer off, Auto Offer on
   - Auto Offer → "Review Auto Offers" (who gets which shift) → Confirm and Send All
   Works on the schedule's real data: unassignedShifts, employeeData,
   _uaEligibility, _uaWeekDate, uaFmtTime, showToast, renderScheduleTable.
   ===================================================================== */
(function () {
  'use strict';

  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const SORTS = {
    hrsAsc: { label: 'Work hours', dir: 'Low → high', fn: (a, b) => (+a.totalHours) - (+b.totalHours) },
    hrsDesc: { label: 'Work hours', dir: 'High → low', fn: (a, b) => (+b.totalHours) - (+a.totalHours) },
    rateAsc: { label: 'Pay rate', dir: 'Low → high', fn: (a, b) => (+a.payrate) - (+b.payrate) },
    rateDesc: { label: 'Pay rate', dir: 'High → low', fn: (a, b) => (+b.payrate) - (+a.payrate) },
    name: { label: 'Name', dir: 'A → Z', fn: (a, b) => a.name.localeCompare(b.name) },
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const $ = id => document.getElementById(id);

  /* ---------- data source ----------
     Schedule Pad: live schedule globals.
     Dashboard:    the shared store 'zipSchedStore' written by Schedule Pad (see schedule-sync.js). */
  const IS_PAD = typeof unassignedShifts !== 'undefined' && typeof employeeData !== 'undefined';
  const STORE_KEY = 'zipSchedStore';
  const SKILLS = {
    'General Manager': ['General Manager', 'Assistant Manager', 'Shift Leader', 'Cashier', 'Crew'],
    'Assistant Manager': ['Assistant Manager', 'Shift Leader', 'Cashier', 'Crew'],
    'Shift Leader': ['Shift Leader', 'Cashier', 'Crew'],
    'Line Cook': ['Line Cook', 'Prep Cook', 'Dishwasher'], 'Prep Cook': ['Prep Cook', 'Line Cook', 'Dishwasher'],
    'Cashier': ['Cashier', 'Crew'], 'Crew': ['Crew', 'Cashier'], 'Dishwasher': ['Dishwasher', 'Prep Cook'],
  };
  const POS_DOT = { 'General Manager': '#7c3aed', 'Assistant Manager': '#7c3aed', 'Shift Leader': '#d97706', 'Line Cook': '#16a34a',
    'Prep Cook': '#16a34a', 'Dishwasher': '#0d9488', 'Cashier': '#2563eb', 'Crew': '#e11d48' };
  let DS = null;   // dashboard: { st, emps }
  function loadStore() {
    let st = null; try { st = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
    if (!st || !st.ua || !st.sum) return null;
    const list = (st.sum.employees || []).map(e => ({ id: e.id, name: e.name, position: e.position, avatar: e.avatar,
      payrate: (18 + ((e.id * 37) % 100) / 10).toFixed(2), totalHours: e.wk || 0, isMinor: e.id === 1, unavailableDays: e.id === 2 ? [0, 1, 2, 3, 4, 5, 6] : [] }));
    return { st, emps: list };
  }
  const ua = () => (IS_PAD ? unassignedShifts : (DS ? DS.st.ua : []));
  const emps = () => (IS_PAD ? employeeData : (DS ? DS.emps : []));
  const t12 = h => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60), d = H % 12 === 0 ? 12 : H % 12; return `${String(d).padStart(2, '0')}:${String(M).padStart(2, '0')}${H >= 12 ? 'P' : 'A'}`; };
  const tm = h => (typeof uaFmtTime === 'function' ? uaFmtTime(h % 24) : t12(h));
  const span = s => `${tm(s.start)} - ${tm(s.end)}`;
  const posColor = p => ((typeof _empPosDot !== 'undefined' && _empPosDot[p]) || POS_DOT[p] || '#64748b');
  function dayDate(d) {
    if (IS_PAD) { try { return _uaWeekDate(d); } catch (e) { return null; } }
    // dashboard week runs Mon → Sun
    const m = ((document.getElementById('weekDisplay') || {}).innerText || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const mon = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(2026, 1, 16);
    return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + (d + 6) % 7);
  }
  const DAY_ORDER = () => (IS_PAD ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0]);
  const key = (d, s) => `${d}:${s.id}`;
  const findShift = k => { const [d, id] = k.split(':'); return { d: +d, s: (ua()[+d] || []).find(x => String(x.id) === id) }; };
  function elig(emp, s, d) {
    if (IS_PAD) { try { return _uaEligibility(emp, s, d); } catch (e) { return { ok: true, tone: 'ok', note: 'Eligible' }; } }
    if (emp.unavailableDays && emp.unavailableDays.includes(d)) return { ok: false, tone: 'bad', note: 'Unavailable' };
    const sk = SKILLS[emp.position] || [emp.position];
    if (!sk.includes(s.position)) return { ok: false, tone: 'warn', note: `Not trained: ${s.position}` };
    return { ok: true, tone: 'ok', note: emp.position === s.position ? 'Position match' : 'Skill match' };
  }
  /* dashboard: persist offers to the shared store + refresh the Unassigned Shifts panel */
  function saveDash() {
    if (IS_PAD || !DS) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DS.st)); } catch (e) {}
    if (typeof dashUaOffers !== 'undefined') {
      ua().forEach(list => (list || []).forEach(s => {
        const k = 'ua-' + s.id;
        if ((s.offers || []).length) dashUaOffers[k] = s.offers.map(o => { const e = emps().find(x => x.id === o.empId) || {}; return { empId: o.empId, name: e.name, pos: e.position, avatar: e.avatar, img: 0, status: o.status }; });
      }));
    }
    try { renderDashUaStatus(); } catch (e) {}
  }
  const offerOf = (s, empId) => (s.offers || []).find(o => o.empId === empId);
  function breaksOf(s) {
    if (s.breaks && s.breaks.length) return s.breaks.map(b => `${b.type || 'Break'}: ${tm(b.start)} - ${tm(b.end)}`).join(', ');
    const len = s.end - s.start;
    if (len >= 6) return `Meal: ${tm(s.start + 3)} - ${tm(s.start + 3.5)}, Rest: ${tm(s.start + 5)} - ${tm(s.start + 5.25)}`;
    if (len >= 4) return `Rest: ${tm(s.start + 2)} - ${tm(s.start + 2.25)}`;
    return '';
  }
  const allPositions = () => [...new Set(ua().flat().map(s => s.position))].sort();
  const allDepts = () => [...new Set(ua().flat().map(s => s.dept).filter(Boolean))].sort();

  /* ---------- state ---------- */
  let S = null;
  function fresh() {
    return { view: 'offer', depts: new Set(allDepts()), poses: new Set(allPositions()), draftDepts: null, draftPoses: null,
      allShifts: false, shift: null, tab: 'eligible', sort: 'hrsAsc', sel: new Set(), review: null, menu: null };
  }
  const visibleShifts = () => {
    const out = [];
    ua().forEach((list, d) => (list || []).forEach(s => { if (S.poses.has(s.position) && (!s.dept || S.depts.has(s.dept))) out.push({ d, s }); }));
    return out;
  };

  /* ---------- DOM ---------- */
  function ensureDom() {
    if ($('ofxWrap')) return;
    const w = document.createElement('div');
    w.className = 'ofx-wrap'; w.id = 'ofxWrap';
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'ofxTitle');
    w.innerHTML = '<div class="ofx" id="ofx"></div>';
    document.body.appendChild(w);
    w.addEventListener('click', onClick);
    w.addEventListener('change', onChange);
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !w.classList.contains('open')) return;
      e.stopPropagation();
      if (S.menu) { S.menu = null; render(); } else if (S.view === 'review') { S.view = 'offer'; render(); } else close();
    }, true);
  }

  function render() { $('ofx').innerHTML = S.view === 'review' ? reviewHtml() : offerHtml(); icons(); }

  /* ---------- Offer view ---------- */
  function offerHtml() {
    const vis = visibleShifts();
    const total = ua().flat().length;
    const wk = dayDate(DAY_ORDER()[0]), wkTxt = wk ? `Week of ${wk.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '';
    const nFilt = (allDepts().length - S.depts.size) + (allPositions().length - S.poses.size);
    const sh = S.shift ? findShift(S.shift) : null;
    if (S.shift && (!sh.s || !vis.some(v => key(v.d, v.s) === S.shift))) S.shift = null;

    /* shift week */
    let week = '';
    for (const d of DAY_ORDER()) {
      const dt = dayDate(d);
      const list = vis.filter(v => v.d === d);
      week += `<div><div class="ofx-dh">${DOW[d]}<b>${dt ? dt.getDate() : ''}</b><small>${list.length} shift${list.length === 1 ? '' : 's'}</small></div>
        ${list.length ? list.map(({ s }) => {
          const k = key(d, s), on = S.allShifts || S.shift === k, n = (s.offers || []).length, br = breaksOf(s);
          return `<button type="button" class="ofx-sh ${on ? 'sel' : ''}" data-shift="${k}" style="--pc:${posColor(s.position)}" title="${esc(s.position)} · ${span(s)}${br ? ' · ' + br : ''}">
            <span class="t">${span(s)}${br ? '<span class="br"><i data-lucide="coffee"></i></span>' : ''}</span>
            <span class="b"><span class="ofx-pos">${esc(s.position)}</span>${n ? `<span class="ofx-off"><i data-lucide="send"></i>${n}</span>` : ''}</span></button>`;
        }).join('') : '<div class="ofx-none">No shifts</div>'}</div>`;
    }

    /* filter menu */
    const draftD = S.draftDepts || S.depts, draftP = S.draftPoses || S.poses;
    const fltMenu = S.menu === 'flt' ? `<div class="ofx-menu flt"><div class="ofx-cols">
        <div class="ofx-col"><h4>Departments</h4>
          <label class="ofx-opt all"><input type="checkbox" data-fall="d" ${draftD.size === allDepts().length ? 'checked' : ''}>All departments</label>
          ${allDepts().map(x => `<label class="ofx-opt"><input type="checkbox" data-fd="${esc(x)}" ${draftD.has(x) ? 'checked' : ''}>${esc(x)}</label>`).join('')}</div>
        <div class="ofx-col"><h4>Positions</h4>
          <label class="ofx-opt all"><input type="checkbox" data-fall="p" ${draftP.size === allPositions().length ? 'checked' : ''}>All positions</label>
          ${allPositions().map(x => `<label class="ofx-opt"><input type="checkbox" data-fp="${esc(x)}" ${draftP.has(x) ? 'checked' : ''}><span class="dot" style="background:${posColor(x)}"></span>${esc(x)}</label>`).join('')}</div>
      </div><div class="ofx-menu-ft"><button type="button" class="ofx-btn sm lnk" data-act="fclear">Clear</button><button type="button" class="ofx-btn sm pri" data-act="fapply">Apply</button></div></div>` : '';

    /* employees */
    const so = SORTS[S.sort];
    const srtMenu = S.menu === 'srt' ? `<div class="ofx-menu srt">${['Work hours', 'Pay rate', 'Name'].map(g => `<div class="ofx-sorth">${g}</div>` +
      Object.entries(SORTS).filter(([, v]) => v.label === g).map(([k, v]) => `<label class="ofx-opt"><input type="radio" name="ofxSort" data-sort="${k}" ${S.sort === k ? 'checked' : ''}>${v.dir}</label>`).join('')).join('')}</div>` : '';
    let rows = [], counts = { eligible: 0, others: 0 };
    if (sh && sh.s) {
      const all = emps().map(e => ({ e, el: elig(e, sh.s, sh.d), off: offerOf(sh.s, e.id) }));
      counts.eligible = all.filter(r => r.el.ok).length; counts.others = all.length - counts.eligible;
      rows = all.filter(r => (S.tab === 'eligible') === !!r.el.ok).sort((a, b) => so.fn(a.e, b.e));
    }
    const selectable = rows.filter(r => !r.off);
    const allSel = selectable.length > 0 && selectable.every(r => S.sel.has(r.e.id));

    let body;
    if (S.allShifts) body = empty('layers', `All ${vis.length} shifts selected`, 'Employees aren’t listed when every shift is selected. Use <b>Auto Offer</b> to offer each shift to its best-matched eligible employees — you can review the list before anything is sent.');
    else if (!sh || !sh.s) body = empty('mouse-pointer-click', 'Select a shift', vis.length ? 'Pick an unassigned shift above to see who can take it, or tick <b>Select all shifts</b> to auto-offer them all at once.' : 'No unassigned shifts match the filters.');
    else if (!rows.length) body = empty('users', S.tab === 'eligible' ? 'No eligible employees' : 'No other employees', S.tab === 'eligible' ? 'Nobody is free and trained for this shift. Check <b>Others</b> to offer it anyway.' : 'Everyone is eligible for this shift.');
    else body = `<div class="ofx-grid">${rows.map(({ e, el, off }) => {
      const on = S.sel.has(e.id);
      const tag = off ? `<span class="ofx-tag vio"><i data-lucide="send"></i>Offered · ${esc(off.status)}</span>`
        : `<span class="ofx-tag ${el.tone === 'ok' ? 'ok' : el.tone === 'bad' ? 'bad' : 'warn'}"><i data-lucide="${el.ok ? 'check' : 'alert-triangle'}"></i>${esc(el.note)}</span>`;
      return `<button type="button" class="ofx-emp ${on ? 'sel' : ''} ${off ? 'done' : ''}" ${off ? 'disabled' : ''} data-emp="${e.id}" aria-pressed="${on}">
        <span class="top"><img src="${esc(e.avatar || '')}" alt=""><span class="min-w-0"><span class="nm" style="display:block">${esc(e.name)}</span><span class="ps" style="display:block">${esc(e.position)}</span></span>
          ${off ? '' : '<span class="ck"><i data-lucide="check"></i></span>'}</span>
        <span class="ofx-stats"><span style="display:contents"><div><span>Rate</span><b class="rate">$${(+e.payrate || 0).toFixed(2)}</b></div>
          <div><span>Min</span><b>${e.isMinor ? 'Max 28h' : '20h'}</b></div><div><span>Worked</span><b class="hrs">${(+e.totalHours || 0).toFixed(1)}h</b></div></span></span>
        ${tag}</button>`;
    }).join('')}</div>`;

    const ctx = S.allShifts ? `<span class="ofx-ctx">Auto Offer will pick employees for <b>${vis.length}</b> shifts</span>`
      : sh && sh.s ? `<span class="ofx-ctx on" style="--pc:${posColor(sh.s.position)}"><i data-lucide="send"></i>Offering <b>${esc(sh.s.position)}</b><span class="sep"></span>${DOW[sh.d]} ${dayDate(sh.d) ? dayDate(sh.d).getDate() : ''}<span class="sep"></span>${span(sh.s)}</span>` : '<span class="ofx-ctx">No shift selected</span>';
    const nSel = S.sel.size;
    const hint = S.allShifts ? '<i data-lucide="info"></i>Send Offer works on one shift at a time. Use Auto Offer for all shifts.'
      : sh && sh.s ? (nSel ? `<i data-lucide="users"></i>${nSel} employee${nSel > 1 ? 's' : ''} selected` : '<i data-lucide="info"></i>Select employees to offer this shift to.')
      : '<i data-lucide="info"></i>Tick “Select all shifts” to use Auto Offer.';

    return `
      <div class="ofx-hd"><span class="ic"><i data-lucide="send"></i></span>
        <div><h2 id="ofxTitle">Offer</h2><p>${wkTxt} · ${total} unassigned shift${total === 1 ? '' : 's'}</p></div>
        <button type="button" class="ofx-x" data-act="close" aria-label="Close" title="Close"><i data-lucide="x"></i></button></div>
      <div class="ofx-tb">
        <div class="l"><span class="ttl">Unassigned shifts</span><span class="ofx-cnt b">${vis.length}${vis.length !== total ? ` of ${total}` : ''}</span></div>
        <div class="ofx-dd ${S.menu === 'flt' ? 'open' : ''}"><button type="button" class="ofx-ddbtn" data-act="mflt"><i data-lucide="sliders-horizontal"></i>Filters${nFilt ? `<span class="n">${nFilt}</span>` : ''}<i data-lucide="chevron-down"></i></button>${fltMenu}</div>
        <div class="r"><label class="ofx-chk ${vis.length ? '' : 'dis'}"><input type="checkbox" data-act="allshifts" ${S.allShifts ? 'checked' : ''}>Select all shifts</label></div>
      </div>
      <div class="ofx-shifts"><div class="ofx-week">${week}</div></div>
      <div class="ofx-emps">
        <div class="ofx-tb ofx-tb-emp" style="grid-template-columns:auto 1fr auto">
          <div class="l">
            <div class="ofx-seg ${sh && sh.s && !S.allShifts ? '' : 'dis'}" role="tablist">
              <button type="button" data-tab="eligible" class="${S.tab === 'eligible' ? 'on' : ''}">Eligible${sh && sh.s && !S.allShifts ? `<span class="c">${counts.eligible}</span>` : ''}</button>
              <button type="button" data-tab="others" class="${S.tab === 'others' ? 'on' : ''}">Others${sh && sh.s && !S.allShifts ? `<span class="c">${counts.others}</span>` : ''}</button></div>
            <div class="ofx-dd ${S.menu === 'srt' ? 'open' : ''}"><button type="button" class="ofx-ddbtn" data-act="msrt"><i data-lucide="arrow-up-down"></i>Sort: ${so.label} <span style="font-weight:500;color:var(--ofx-ink-3)">${so.dir}</span><i data-lucide="chevron-down"></i></button>${srtMenu}</div>
          </div>
          <div class="l" style="justify-content:center;min-width:0">${ctx}</div>
          <div class="r"><label class="ofx-chk ${selectable.length && !S.allShifts ? '' : 'dis'}"><input type="checkbox" data-act="allemps" ${allSel && !S.allShifts ? 'checked' : ''}>Select all</label></div>
        </div>
        <div class="ofx-list">${body}</div>
      </div>
      <div class="ofx-ft"><span class="hint">${hint}</span>
        <button type="button" class="ofx-btn grn" data-act="auto" ${S.allShifts && vis.length ? '' : 'disabled'} title="${S.allShifts ? '' : 'Select all shifts to use Auto Offer'}"><i data-lucide="wand-2"></i>Auto Offer</button>
        <button type="button" class="ofx-btn pri" data-act="send" ${!S.allShifts && sh && sh.s && nSel ? '' : 'disabled'}><i data-lucide="send"></i>Send Offer${nSel && !S.allShifts ? ` (${nSel})` : ''}</button></div>`;
  }
  const empty = (ic, t, p) => `<div class="ofx-empty"><span class="ic"><i data-lucide="${ic}"></i></span><b>${t}</b><p>${p}</p></div>`;

  /* ---------- Auto offer: suggestions + review ---------- */
  function buildSuggestions() {
    const map = {};
    visibleShifts().forEach(({ d, s }) => {
      const want = 2 + (s.id % 3);                      // 2–4 people per shift
      map[key(d, s)] = emps()
        .filter(e => elig(e, s, d).ok && !offerOf(s, e.id))
        .sort((a, b) => ((+a.totalHours) - (+b.totalHours)) || ((+a.payrate) - (+b.payrate)))
        .slice(0, want).map(e => e.id);
    });
    return map;
  }
  function reviewHtml() {
    const items = Object.entries(S.review).map(([k, ids]) => ({ k, ids, ...findShift(k) })).filter(x => x.s)
      .sort((a, b) => DAY_ORDER().indexOf(a.d) - DAY_ORDER().indexOf(b.d) || a.s.start - b.s.start);
    const people = new Set(items.flatMap(x => x.ids)).size, offers = items.reduce((a, x) => a + x.ids.length, 0), none = items.filter(x => !x.ids.length).length;
    const rows = items.map(({ k, ids, d, s }) => {
      const dt = dayDate(d), br = breaksOf(s);
      return `<tr class="${ids.length ? '' : 'empty'}">
        <td><div class="dt">${DOW[d]} ${dt ? dt.getDate() : ''}</div><div class="tm">${span(s)}</div></td>
        <td><span class="ofx-pos" style="--pc:${posColor(s.position)}">${esc(s.position)}</span></td>
        <td>${br ? `<span class="ofx-brk"><i data-lucide="coffee"></i>${br}</span>` : '<span class="tm">—</span>'}</td>
        <td>${ids.length ? `<div class="ofx-pills">${ids.map(id => { const e = emps().find(x => x.id === id) || { name: 'Employee' };
          return `<span class="ofx-pill"><img src="${esc(e.avatar || '')}" alt="">${esc(e.name)}<button type="button" data-rm="${k}|${id}" title="Remove ${esc(e.name)}" aria-label="Remove ${esc(e.name)}"><i data-lucide="x"></i></button></span>`; }).join('')}</div>`
          : '<span class="ofx-nop"><i data-lucide="alert-triangle"></i>No one selected — this shift won’t be offered</span>'}</td></tr>`;
    }).join('');
    return `
      <div class="ofx-hd"><button type="button" class="ofx-back" data-act="back" aria-label="Back to Offer" title="Back"><i data-lucide="arrow-left"></i></button>
        <div><h2 id="ofxTitle">Review Auto Offers</h2><p>Verify suggested employees for each unassigned shift before sending</p></div>
        <button type="button" class="ofx-x" data-act="close" aria-label="Close" title="Close"><i data-lucide="x"></i></button></div>
      <div class="ofx-rv">
        <div class="ofx-sum"><div><span>Shifts</span><b>${items.length - none}</b></div><div><span>Employees</span><b>${people}</b></div><div><span>Offers to send</span><b>${offers}</b></div>
          ${none ? `<div class="warn"><span>Without anyone</span><b>${none}</b></div>` : ''}</div>
        <table class="ofx-tbl"><thead><tr><th style="width:15%">Date &amp; time</th><th style="width:14%">Position</th><th style="width:25%">Break schedule</th><th>Eligible employees</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="ofx-ft"><span class="hint"><i data-lucide="info"></i>Picked by fewest hours worked, then lowest pay rate. Remove anyone you don’t want to offer.</span>
        <button type="button" class="ofx-btn" data-act="close">Cancel</button>
        <button type="button" class="ofx-btn grn" data-act="confirm" ${offers ? '' : 'disabled'}><i data-lucide="check-circle-2"></i>Confirm and Send All</button></div>`;
  }

  /* ---------- actions ---------- */
  function addOffers(s, ids) {
    const prev = s.offers || [];
    const add = ids.filter(id => !prev.some(o => o.empId === id)).map(empId => ({ empId, at: new Date(), status: 'Pending' }));
    s.offers = prev.concat(add);
    return add.length;
  }
  function refresh() { if (IS_PAD) { try { renderScheduleTable(); } catch (e) {} } else saveDash(); }
  function toast(m) { if (typeof showToast === 'function') showToast(m, 'info'); }

  function onClick(e) {
    const t = e.target;
    if (t === $('ofxWrap')) return;
    if (S.menu && !t.closest('.ofx-dd')) { S.menu = null; S.draftDepts = S.draftPoses = null; return render(); }
    const rm = t.closest('[data-rm]');
    if (rm) { const [k, id] = rm.dataset.rm.split('|'); S.review[k] = S.review[k].filter(x => String(x) !== id); return render(); }
    const shb = t.closest('[data-shift]');
    if (shb) { S.allShifts = false; S.shift = S.shift === shb.dataset.shift ? null : shb.dataset.shift; S.sel.clear(); return render(); }
    const tb = t.closest('[data-tab]'); if (tb) { S.tab = tb.dataset.tab; S.sel.clear(); return render(); }
    const em = t.closest('[data-emp]');
    if (em && !em.disabled) { const id = +em.dataset.emp; S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); return render(); }
    const a = t.closest('[data-act]'); if (!a) return;
    switch (a.dataset.act) {
      case 'close': return close();
      case 'mflt': S.menu = S.menu === 'flt' ? null : 'flt'; S.draftDepts = new Set(S.depts); S.draftPoses = new Set(S.poses); return render();
      case 'msrt': S.menu = S.menu === 'srt' ? null : 'srt'; return render();
      case 'fclear': S.draftDepts = new Set(allDepts()); S.draftPoses = new Set(allPositions()); return render();
      case 'fapply':
        if (!S.draftDepts.size || !S.draftPoses.size) { toast('Pick at least one department and one position.'); return; }
        S.depts = S.draftDepts; S.poses = S.draftPoses; S.draftDepts = S.draftPoses = null; S.menu = null; return render();
      case 'auto': S.review = buildSuggestions(); S.view = 'review'; S.menu = null; return render();
      case 'back': S.view = 'offer'; return render();
      case 'send': {
        const { s } = findShift(S.shift); if (!s || !S.sel.size) return;
        const n = addOffers(s, [...S.sel]);
        toast(`${s.position} shift (${span(s)}) offered to ${n} employee${n === 1 ? '' : 's'}.`);
        S.sel.clear(); refresh(); return render();
      }
      case 'confirm': {
        let shifts = 0, offers = 0;
        Object.entries(S.review).forEach(([k, ids]) => { const { s } = findShift(k); if (s && ids.length) { offers += addOffers(s, ids); shifts++; } });
        toast(`Offers sent: ${shifts} shift${shifts === 1 ? '' : 's'}, ${offers} offer${offers === 1 ? '' : 's'}.`);
        refresh(); return close();
      }
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.act === 'allshifts') { S.allShifts = t.checked; S.shift = null; S.sel.clear(); return render(); }
    if (t.dataset.act === 'allemps') {
      const { s, d } = findShift(S.shift || '0:x'); if (!s) return;
      const ids = emps().filter(x => (S.tab === 'eligible') === !!elig(x, s, d).ok && !offerOf(s, x.id)).map(x => x.id);
      ids.forEach(id => t.checked ? S.sel.add(id) : S.sel.delete(id)); return render();
    }
    if (t.dataset.sort) { S.sort = t.dataset.sort; S.menu = null; return render(); }
    if (t.dataset.fall === 'd') { S.draftDepts = new Set(t.checked ? allDepts() : []); return render(); }
    if (t.dataset.fall === 'p') { S.draftPoses = new Set(t.checked ? allPositions() : []); return render(); }
    if (t.dataset.fd) { t.checked ? S.draftDepts.add(t.dataset.fd) : S.draftDepts.delete(t.dataset.fd); return render(); }
    if (t.dataset.fp) { t.checked ? S.draftPoses.add(t.dataset.fp) : S.draftPoses.delete(t.dataset.fp); return render(); }
  }

  /* preselectId: an unassigned shift id → that shift opens selected with its eligible employees */
  function open(preselectId) {
    if (!IS_PAD) { DS = loadStore(); if (!DS) return false; }
    ensureDom(); S = fresh();
    if (preselectId != null) {
      ua().forEach((list, d) => (list || []).forEach(s => { if (String(s.id) === String(preselectId)) S.shift = key(d, s); }));
    }
    $('ofxWrap').classList.add('open'); render();
    if (S.shift) { const el = document.querySelector(`#ofxWrap [data-shift="${S.shift}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }
    return true;
  }
  function close() { const w = $('ofxWrap'); if (w) w.classList.remove('open'); }

  window.closeUnassignedModal = close;
  if (IS_PAD) {
    window.openUnassignedModal = () => open();   // the "Offer" button next to "Show" in the Unassigned row
  } else {
    // Dashboard → Unassigned Shifts → Offer (send icon): same pop-up with that shift pre-selected
    const base = window.openAssignModal;
    window.openAssignModal = function (shiftKey) {
      const id = String(shiftKey || '').replace(/^ua-/, '');
      if (open(id) && S.shift) return;
      close();
      if (typeof base === 'function') return base.apply(this, arguments);   // store not built yet → old pop-up
    };
  }
})();
