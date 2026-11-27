/* =====================================================================
   Dashboard → Needing Action: real requests sent from the crew app
   - Time Off            ('zipCrewTimeOff')   approve / disapprove (+ note)
   - Shift Swap          ('zipCrewSwaps')     a co-worker requested someone's
                                              offered shift; approve moves it
   - Availability Request('zipCrewAvailReq')  review in the request pop-up;
                                              approve saves it as the upcoming
                                              availability ('zipAvailStore')
   - Temporary Availability('zipTempAvail')   same pane, tagged "Temporary";
                                              handled by temp-availability.js
   Decisions are written back, so the crew member sees them on their next view.
   ===================================================================== */
(function () {
  'use strict';
  const K = { to: 'zipCrewTimeOff', ar: 'zipCrewAvailReq', sw: 'zipCrewSwaps', data: 'zipCrewData', sch: 'zipSchedStore', av: 'zipAvailStore' };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };

  /* ---------- dates (store time zone) ---------- */
  const TZ = 'America/Chicago';
  function parts() { const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; }); return p; }
  const TODAY = () => { const p = parts(); return `${p.year}-${p.month}-${p.day}`; };
  const NOW = () => { const p = parts(); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]);
  const dLong = iso => { const [y, m, d] = iso.split('-').map(Number); return `${ord(d)} ${MON[m - 1]} ${y}`; };
  const t12 = h => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${String(H % 12 || 12).padStart(2, '0')}:${String(M).padStart(2, '0')} ${H < 12 ? 'AM' : 'PM'}`; };
  const hm12 = s => { const [h, m] = s.split(':').map(Number); return t12(h + m / 60); };
  const hhmm = h => { const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const gridHrs = g => g.reduce((a, r) => a + r.filter(Boolean).length, 0);

  const data = () => read(K.data) || { employees: [], availability: {}, shifts: [] };
  const emp = id => (data().employees || []).find(e => e.id === id) || { id, name: 'Employee', position: '', avatar: '' };

  /* ---------- collect pending requests ---------- */
  function pending() {
    const T = TODAY();
    const to = [], ar = [], sw = [];
    Object.entries(read(K.to) || {}).forEach(([id, list]) => (list || []).forEach(t => { if (t.status === 'Pending') to.push({ empId: +id, t }); }));
    Object.entries(read(K.ar) || {}).forEach(([id, m]) => { if (m && m.req && m.req.status === 'pending') ar.push({ empId: +id, r: m.req }); });
    (read(K.sw) || []).forEach(s => { if (s.status === 'Requested' && s.date >= T) sw.push(s); });
    return { to, ar, sw };
  }

  /* ---------- render into Needing Action ---------- */
  function panel() { return [...document.querySelectorAll('.sd-panel')].find(p => (p.querySelector('.sd-panel-title') || {}).textContent?.trim().startsWith('Needing Action')); }
  const pill = '<span class="sd-pill sd-pill--pending">Pending</span>';
  const tag = '<span class="crq-tag">Crew app</span>';
  function render() {
    const p = panel(); if (!p) return;
    const panes = p.querySelectorAll('.sd-pane'), chips = p.querySelectorAll('.sd-chip .sd-chip-n'), total = p.querySelector('.sd-panel-title .sd-count');
    if (!p.dataset.crqBase) p.dataset.crqBase = JSON.stringify({ chips: [...chips].map(c => +c.textContent || 0), total: +(total && total.textContent) || 0 });
    const base = JSON.parse(p.dataset.crqBase);
    p.querySelectorAll('.crq-row').forEach(r => r.remove());
    const { to, ar, sw } = pending();
    const add = (pane, html) => { if (pane) pane.insertAdjacentHTML('afterbegin', html); };
    add(panes[0], to.map(({ empId, t }) => { const e = emp(empId);
      const when = t.start === t.end ? dLong(t.start) : `${dLong(t.start)} - ${dLong(t.end)}`;
      return `<div class="sd-row crq-row"><img src="${esc(e.avatar)}" class="sd-avatar" alt="">
        <div class="sd-row-main"><div class="sd-row-name">${esc(e.name)} ${tag}</div><div class="sd-row-sub">${when} • ${t.type === 'PARTIAL' ? `${hm12(t.from)} - ${hm12(t.to)}` : 'All Day'}${t.reason ? ' • ' + esc(t.reason) : ''}</div></div>
        <div class="sd-row-actions">${pill}
          <button type="button" class="sd-icon-btn sd-icon-btn--ok" title="Approve" data-crq="to|ok|${empId}|${t.id}"><i data-lucide="check"></i></button>
          <button type="button" class="sd-icon-btn sd-icon-btn--no" title="Decline" data-crq="to|no|${empId}|${t.id}"><i data-lucide="x"></i></button></div></div>`; }).join(''));
    add(panes[1], sw.map(s => { const f = emp(s.from), r = emp(s.requestedBy);
      return `<div class="sd-row crq-row"><img src="${esc(r.avatar)}" class="sd-avatar" alt="">
        <div class="sd-row-main"><div class="sd-row-pre">Offered By: ${esc(f.name)}</div><div class="sd-row-name">${esc(r.name)} ${tag}</div><div class="sd-row-sub">${esc(s.position)} • ${dLong(s.date)} • ${t12(s.start)} - ${t12(s.end)}</div></div>
        <div class="sd-row-actions">${pill}
          <button type="button" class="sd-icon-btn sd-icon-btn--ok" title="Approve" data-crq="sw|ok|0|${s.id}"><i data-lucide="check"></i></button>
          <button type="button" class="sd-icon-btn sd-icon-btn--no" title="Decline" data-crq="sw|no|0|${s.id}"><i data-lucide="x"></i></button></div></div>`; }).join(''));
    add(panes[2], ar.map(({ empId, r }) => { const e = emp(empId);
      return `<div class="sd-row crq-row"><img src="${esc(e.avatar)}" class="sd-avatar" alt="">
        <div class="sd-row-main"><div class="sd-row-name">${esc(e.name)} ${tag}</div><div class="sd-row-sub">Availability Update Request • effective ${dLong(r.eff)}</div></div>
        <div class="sd-row-actions">${pill}
          <button type="button" class="sd-icon-btn sd-icon-btn--blue" title="View Availability Grid" data-crq="ar|view|${empId}|0"><i data-lucide="layout-grid"></i></button>
          <button type="button" class="sd-icon-btn sd-icon-btn--ok" title="Approve" data-crq="ar|ok|${empId}|0"><i data-lucide="check"></i></button>
          <button type="button" class="sd-icon-btn sd-icon-btn--no" title="Decline" data-crq="ar|no|${empId}|0"><i data-lucide="x"></i></button></div></div>`; }).join(''));
    const ta = window.TA ? window.TA.dashRows() : { html: '', n: 0 };
    add(panes[2], ta.html);
    typeFilter(panes[2]);
    const extra = [to.length, sw.length, ar.length + ta.n];
    chips.forEach((c, i) => { c.textContent = (base.chips[i] || 0) + (extra[i] || 0); });
    if (total) total.textContent = base.total + to.length + sw.length + ar.length + ta.n;
    icons();
  }
  /* Availability Request pane: tell regular (weekly) and temporary (date range) requests apart */
  let TYPE = 'all';
  function typeFilter(pane) {
    if (!pane || !window.TA) return;
    pane.querySelectorAll('.sd-row').forEach(r => {
      if (r.dataset.atype) return;
      r.dataset.atype = 'regular';
      const nm = r.querySelector('.sd-row-name');
      if (nm && !r.querySelector('.ta-type')) nm.insertAdjacentHTML('beforebegin', '<div class="sd-row-pre"><span class="ta-type reg"><i data-lucide="calendar-check"></i>Regular availability</span></div>');
    });
    let f = pane.querySelector('.ta-dfilter');
    if (!f) { f = document.createElement('div'); f.className = 'ta-dfilter'; f.setAttribute('role', 'group'); f.setAttribute('aria-label', 'Request type'); }
    pane.prepend(f);
    const rows = [...pane.querySelectorAll('.sd-row')], n = t => rows.filter(r => r.dataset.atype === t).length;
    f.innerHTML = [['all', 'All', rows.length], ['regular', 'Regular', n('regular')], ['temporary', 'Temporary', n('temporary')]]
      .map(([k, l, c]) => `<button type="button" data-tafilter="${k}" class="${TYPE === k ? 'on' : ''}" aria-pressed="${TYPE === k}">${l} <span>${c}</span></button>`).join('');
    rows.forEach(r => r.classList.toggle('ta-dhide', TYPE !== 'all' && r.dataset.atype !== TYPE));
  }

  /* ---------- decisions ---------- */
  function decideTimeOff(empId, id, ok, note) {
    const all = read(K.to) || {};
    (all[empId] || []).forEach(t => { if (t.id === id) { t.status = ok ? 'Approved' : 'Disapproved'; t.note = note || ''; } });
    write(K.to, all);
  }
  function decideSwap(id, ok, note) {
    const list = read(K.sw) || [], s = list.find(x => x.id === id); if (!s) return;
    if (ok) {
      const st = read(K.sch);
      if (st && st.sa) {
        const a = hhmm(s.start), b = hhmm(s.end);
        st.sa[`w_${s.from}_${s.day}`] = null;                                   // leaves the person who offered it
        st.sa[`w_${s.requestedBy}_${s.day}`] = { start: Math.floor(s.start), end: Math.floor(s.end), startHHMM: a, endHHMM: b, time: `${a} - ${b}`,
          position: s.position, notes: '', breaks: (s.breaks || []).map(x => ({ type: x.type || 'Meal', start: hhmm(x.start), end: hhmm(x.end) })) };
        write(K.sch, st);
      }
      s.status = 'Approved';
    } else { s.status = 'Declined'; s.note = note || ''; }
    s.decidedAt = new Date().toISOString();
    write(K.sw, list);
  }
  function versionsOf(empId) {
    const av = read(K.av);
    if (av && av.store && av.store[empId]) return av.store[empId];
    return ((data().availability || {})[empId] || []).map((v, i) => ({ id: `vc${empId}_${i}`, ...v }));
  }
  function decideAvail(empId, ok, note) {
    const all = read(K.ar) || {}, mine = all[empId]; if (!mine || !mine.req) return;
    const r = mine.req, T = TODAY(), at = NOW();
    r.log = r.log || [];
    if (ok) {
      // one upcoming version only: the approved request replaces any upcoming one
      const av = read(K.av) || { v: 1, store: {}, vid: 1 };
      av.store = av.store || {};
      const vs = versionsOf(empId).filter(v => !(v.eff > T) && v.eff !== r.eff);
      vs.push({ id: 'v' + Date.now(), eff: r.eff, grid: r.grid, updatedAt: at, updatedBy: 'Store Manager' });
      av.store[empId] = vs; write(K.av, av);
      const d = data(); d.availability = d.availability || {}; d.availability[empId] = vs.map(v => ({ eff: v.eff, grid: v.grid, updatedAt: v.updatedAt, updatedBy: v.updatedBy })); write(K.data, d);
      r.status = r.eff <= T ? 'effective' : 'approved';
      r.log.push({ t: 'Approved', at, by: 'Store Manager' });
    } else {
      r.status = 'rejected';
      r.log.push({ t: 'Rejected', at, by: 'Store Manager', note: note || '' });
    }
    write(K.ar, all);
  }
  function openAvail(empId) {
    const m = (read(K.ar) || {})[empId]; if (!m || !m.req || typeof window.openAvailabilityModal !== 'function') return;
    const r = m.req, e = emp(empId), T = TODAY();
    const vs = versionsOf(empId).slice().sort((a, b) => a.eff.localeCompare(b.eff));
    const cur = vs.filter(v => v.eff <= T).pop(), up = vs.find(v => v.eff > T && v.eff !== r.eff);
    const empty = Array.from({ length: 7 }, () => Array(24).fill(false));
    const sub = (r.submittedAt || NOW()).split('T');
    window.openAvailabilityModal(e.name, 'crew-' + empId, {
      role: e.position, cur: cur ? cur.grid : empty, req: r.grid, curSince: cur ? cur.eff : T, eff: r.eff, sub: [sub[0], sub[1] || '09:00'],
      reason: '', shifts: (data().shifts || []).filter(s => s.empId === empId).map(s => ({ dow: s.day, s: s.start, e: s.end > s.start ? s.end : s.end + 24, role: s.position })),
      mgrUp: up ? { eff: up.eff, hrs: gridHrs(up.grid), by: up.updatedBy || 'Store Manager' } : null,
      onDecide: (kind, note) => { decideAvail(empId, kind === 'approved', note); setTimeout(render, 50); },
    });
  }

  /* small "decline with a note" dialog */
  function askNote(title, subtitle, onOk) {
    let w = document.getElementById('crqDlg');
    if (!w) { w = document.createElement('div'); w.id = 'crqDlg'; document.body.appendChild(w); }
    w.innerHTML = `<div class="crq-box" role="dialog" aria-modal="true" aria-labelledby="crqT"><h3 id="crqT">${esc(title)}</h3><p>${esc(subtitle)}</p>
      <label for="crqNote">Note to the employee <span>(optional)</span></label><textarea id="crqNote" placeholder="e.g. We are short staffed that day."></textarea>
      <div class="crq-ft"><button type="button" data-crqd="cancel">Cancel</button><button type="button" class="no" data-crqd="ok">Decline</button></div></div>`;
    w.className = 'open';
    w.onclick = e => { const b = e.target.closest('[data-crqd]'); if (!b && e.target !== w) return; if (b && b.dataset.crqd === 'ok') onOk(document.getElementById('crqNote').value.trim()); w.className = ''; };
    setTimeout(() => document.getElementById('crqNote').focus(), 0);
  }
  function toast(m) {
    if (typeof window.showToast === 'function') return window.showToast(m, 'info');
    const t = document.createElement('div'); t.className = 'du-toast'; t.style.zIndex = '10050'; t.innerHTML = `<i data-lucide="check-circle-2"></i><span>${esc(m)}</span>`;
    document.body.appendChild(t); icons(); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
  }

  document.addEventListener('click', e => {
    const tf = e.target.closest('[data-tafilter]'); if (tf) { TYPE = tf.dataset.tafilter; return render(); }
    const b = e.target.closest('[data-crq]'); if (!b) return;
    e.stopPropagation();
    const [kind, act, empId, id] = b.dataset.crq.split('|');
    if (kind === 'ta') {                                                         // temporary availability request
      const r = window.TA && window.TA.byId(id); if (!r) return;
      const nm = r.empName || 'Employee';
      if (act === 'view') return window.TA.openReview(id, { onDone: render });
      if (act === 'ok') { window.TA.decide(id, true); render(); return toast(`${nm}'s temporary availability approved — effective ${window.TA.fmtRange(r.start, r.end)}`); }
      return askNote(`Decline ${nm}'s temporary availability request?`, `${window.TA.fmtRange(r.start, r.end)} · regular availability stays in effect. The employee sees your note in the crew app.`, note => {
        window.TA.decide(id, false, note); render(); toast(`${nm}'s temporary availability request declined`);
      });
    }
    const name = kind === 'sw' ? emp(((read(K.sw) || []).find(x => x.id === id) || {}).requestedBy).name : emp(+empId).name;
    if (kind === 'ar' && act === 'view') return openAvail(+empId);
    const done = msg => { render(); toast(msg); };
    if (act === 'ok') {
      if (kind === 'to') decideTimeOff(+empId, id, true);
      if (kind === 'sw') decideSwap(id, true);
      if (kind === 'ar') decideAvail(+empId, true);
      return done(`${name}'s ${kind === 'to' ? 'time off' : kind === 'sw' ? 'shift swap' : 'availability request'} approved`);
    }
    askNote(`Decline ${name}'s ${kind === 'to' ? 'time off' : kind === 'sw' ? 'shift swap' : 'availability request'}?`, 'The employee sees your note in the crew app.', note => {
      if (kind === 'to') decideTimeOff(+empId, id, false, note);
      if (kind === 'sw') decideSwap(id, false, note);
      if (kind === 'ar') decideAvail(+empId, false, note);
      done(`${name}'s request declined`);
    });
  }, true);
  window.addEventListener('storage', e => { if ([K.to, K.ar, K.sw, 'zipTempAvail'].includes(e.key)) render(); });

  const css = document.createElement('style');
  css.textContent = `
    .crq-tag { display: inline-block; vertical-align: 1px; margin-left: 6px; font-size: 9.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; background: #dcfce7; color: #15803d; }
    .crq-row { box-shadow: inset 3px 0 0 #22c55e; }
    #crqDlg { position: fixed; inset: 0; z-index: 10040; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,.5); padding: 16px; }
    #crqDlg.open { display: flex; }
    .crq-box { width: 100%; max-width: 440px; background: #fff; border-radius: 14px; padding: 18px 20px; box-shadow: 0 25px 50px -12px rgba(15,23,42,.4); font-size: 13px; color: #475569; }
    .crq-box h3 { margin: 0 0 4px; font-size: 15.5px; font-weight: 700; color: #0f172a; }
    .crq-box p { margin: 0 0 12px; }
    .crq-box label { display: block; font-size: 12.5px; font-weight: 700; color: #0f172a; margin-bottom: 5px; }
    .crq-box label span { font-weight: 500; color: #94a3b8; }
    .crq-box textarea { width: 100%; min-height: 70px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; color: #0f172a; resize: vertical; box-sizing: border-box; }
    .crq-ft { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .crq-ft button { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #475569; font-weight: 700; cursor: pointer; }
    .crq-ft button.no { background: #dc2626; border-color: #dc2626; color: #fff; }
    html.dark .crq-box { background: #1e293b; color: #cbd5e1; } html.dark .crq-box h3, html.dark .crq-box label { color: #f1f5f9; }
    html.dark .crq-box textarea { background: #0f172a; border-color: #3b4f6b; color: #e2e8f0; } html.dark .crq-ft button { background: #1e293b; border-color: #3b4f6b; color: #cbd5e1; }
    html.dark .crq-tag { background: rgba(34,197,94,.18); color: #86efac; }`;
  document.head.appendChild(css);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  setTimeout(render, 1500);   // after the dashboard re-renders its panels
})();
