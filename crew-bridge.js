/* =====================================================================
   Manager → Crew bridge (loaded on Schedule Pad and the Dashboard)
   - Schedule Pad: writes what the crew app needs to localStorage
     'zipCrewData' (employees, weekly shifts + breaks, open-shift offers,
     availability versions) every time the schedule is saved.
   - Both pages: adds "Login as crew" + employee dropdown to the profile
     pop-up. Picking an employee opens crew.html for that employee.
   ===================================================================== */
(function () {
  'use strict';
  const KEY = 'zipCrewData';
  const IS_PAD = typeof employeeData !== 'undefined' && typeof _aiCurrent === 'function';
  const toH = v => typeof v === 'number' ? v : (+String(v).slice(0, 2) + (+String(v).slice(3, 5) || 0) / 60);

  /* ---------- export (Schedule Pad only) ---------- */
  function breaksOf(s, a) {
    if (a && a.breaks && a.breaks.length) return a.breaks.map(b => ({ type: b.type || 'Break', start: toH(b.start), end: toH(b.end) }));
    const len = s.end > s.start ? s.end - s.start : s.end + 24 - s.start;
    return len >= 6 ? [{ type: 'Meal', start: s.start + 3, end: s.start + 3.5 }] : [];
  }
  function crewExport() {
    if (!IS_PAD) return;
    try {
      const shifts = _aiCurrent().map(s => ({ empId: s.empId, day: s.day, start: s.start, end: s.end, position: s.position,
        breaks: breaksOf(s, shiftAssignments[`w_${s.empId}_${s.day}`]) }));
      const employees = employeeData.map(e => ({ id: e.id, name: e.name, position: e.position, avatar: e.avatar,
        unavailableDays: e.unavailableDays || [], skills: (typeof _skillsByPosition !== 'undefined' && _skillsByPosition[e.position]) || [e.position] }));
      const offers = [];
      (unassignedShifts || []).forEach((list, d) => (list || []).forEach(s => {
        if ((s.offers || []).length) offers.push({ id: s.id, day: d, start: s.start, end: s.end, position: s.position, dept: s.dept || '',
          offers: s.offers.map(o => ({ empId: o.empId, status: o.status })) });
      }));
      const availability = typeof window.__availAll === 'function' ? window.__availAll() : {};
      localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), employees, shifts, offers, availability }));
    } catch (e) { /* storage full / not ready */ }
  }
  window.crewExport = IS_PAD ? crewExport : undefined;
  if (IS_PAD && typeof schedStoreSave === 'function') {
    const base = schedStoreSave;
    let t = null;
    window.schedStoreSave = function () { const r = base.apply(this, arguments); clearTimeout(t); t = setTimeout(crewExport, 250); return r; };
  }

  /* ---------- "Login as crew" in the profile pop-up ---------- */
  function employeesList() {
    if (IS_PAD) return employeeData.map(e => ({ id: e.id, name: e.name, position: e.position }));
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.employees) return d.employees; } catch (e) {}
    try { const s = JSON.parse(localStorage.getItem('zipSchedStore') || 'null'); if (s && s.sum) return s.sum.employees; } catch (e) {}
    return [];
  }
  function addLoginRow() {
    const pop = document.getElementById('profilePopup');
    if (!pop || pop.querySelector('.crew-login')) return;
    const logout = [...pop.querySelectorAll('span')].find(s => s.textContent.trim() === 'Logout');
    const anchor = logout ? logout.closest('div') : null;
    const row = document.createElement('div');
    row.className = 'crew-login';
    row.innerHTML = `
      <div class="cl-top"><i data-lucide="users-round"></i><span>Login as crew</span></div>
      <select aria-label="Login as crew - choose employee">
        <option value="">Select employee…</option>
        ${employeesList().map(e => `<option value="${e.id}">${String(e.name).replace(/</g, '&lt;')} · ${String(e.position || '').replace(/</g, '&lt;')}</option>`).join('')}
      </select>`;
    if (anchor) anchor.parentElement.insertBefore(row, anchor); else pop.appendChild(row);
    row.querySelector('select').addEventListener('change', e => {
      const id = e.target.value; if (id === '') return;
      crewExport();
      location.href = 'crew.html?emp=' + encodeURIComponent(id);
    });
    row.addEventListener('click', e => e.stopPropagation());
    try { window.lucide && lucide.createIcons(); } catch (e) {}
  }
  const style = document.createElement('style');
  style.textContent = `
    .crew-login { padding: 10px 20px 12px; border-top: 1px solid #f1f5f9; }
    .crew-login .cl-top { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #334155; margin-bottom: 7px; }
    .crew-login .cl-top svg { width: 16px; height: 16px; color: #94a3b8; }
    .crew-login select { width: 100%; height: 34px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-size: 12.5px; color: #0f172a; cursor: pointer; }
    .crew-login select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
    html.dark .crew-login { border-color: #2d3f55; }
    html.dark .crew-login .cl-top { color: #e2e8f0; }
    html.dark .crew-login select { background: #0f172a; border-color: #3b4f6b; color: #e2e8f0; }`;
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLoginRow); else addLoginRow();
  if (IS_PAD) setTimeout(crewExport, 800);   // first write after the schedule has rendered
})();
