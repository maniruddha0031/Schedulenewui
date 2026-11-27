/* =====================================================================
   Temporary Availability + manual time entry            (prefix: ta-)
   Loaded on Schedule Pad, the Dashboard (index.html) and the crew app.

   Temporary availability = different hours for a DATE RANGE. It never
   changes the employee's regular (weekly) availability.

   Record (localStorage 'zipTempAvail' → { v:1, recs:[...] }):
     { id, empId, empName, start, end 'YYYY-MM-DD' (store tz),
       days: { 'YYYY-MM-DD': bool[24] },          // all-false = unavailable
       source: 'manager' | 'employee',
       status: 'active'    (manager assigned, no approval)
             | 'pending' | 'approved' | 'declined'   (employee request)
             | 'cancelled' | 'removed' | 'replaced',
       reason, note, createdAt/By, decidedAt/By, updatedAt, log[] }

   Effective availability for (employee, date):
     1. an 'active' or 'approved' record that covers the date → use it
        (newest wins if two overlap; saving trims the older one)
     2. otherwise → regular availability in effect on that date
     Pending / declined requests never affect it.

   Also exports the manual time-slot panel (windowsPanel) used by every
   availability editor so dragging and typed times stay in sync.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- Config ---------------- */
  const TZ = 'America/Chicago', TZ_LABEL = 'America/Chicago (CT)';
  const KEY = 'zipTempAvail';
  const MAX_DAYS = 60;            // longest temporary range
  const CREW_NOTICE = 0;          // crew requests can start today
  const RIBBON_DAYS = 21;         // "effective availability" preview
  const HORIZON = 14;             // published schedule horizon for shift conflicts
  const MGR = 'Store Manager';
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const STATUS = { active: 'Assigned', pending: 'Pending', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled', removed: 'Removed', replaced: 'Replaced', expired: 'Expired' };

  /* ---------------- Dates (store time zone) ---------------- */
  function parts() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return p;
  }
  const TODAY = () => { const p = parts(); return `${p.year}-${p.month}-${p.day}`; };
  const NOW = () => { const p = parts(); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
  const toD = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toIso = dt => dt.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = toD(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
  const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const weekday = iso => toD(iso).getUTCDay();
  const dd = iso => String(toD(iso).getUTCDate()).padStart(2, '0');
  const fmt = iso => `${dd(iso)} ${MON[toD(iso).getUTCMonth()]} ${toD(iso).getUTCFullYear()}`;
  const fmtS = iso => `${dd(iso)} ${MON[toD(iso).getUTCMonth()]}`;
  const fmtW = iso => `${DAYS[weekday(iso)]}, ${fmtS(iso)}`;
  const fmtRange = (a, b) => a === b ? fmt(a) : (a.slice(0, 4) === b.slice(0, 4) ? `${fmtS(a)} – ${fmt(b)}` : `${fmt(a)} – ${fmt(b)}`);
  const fmtDT = s => { if (!s) return '—'; const [dp, tp] = s.split('T'); let [h, m] = (tp || '00:00').split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${fmt(dp)}, ${h}:${String(m).padStart(2, '0')} ${ap}`; };
  const localIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isoRange = (a, b) => { const o = []; const n = daysBetween(a, b); for (let i = 0; i <= n; i++) o.push(addDays(a, i)); return o; };
  const inDays = iso => { const n = daysBetween(TODAY(), iso); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? `in ${n} days` : `${-n} days ago`; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------------- Hours / rows ---------------- */
  const tL = h => { const x = ((h % 24) + 24) % 24; return `${x % 12 || 12}:00 ${x < 12 ? 'AM' : 'PM'}`; };   // 24 → 12:00 AM (midnight)
  const tS = h => { const x = ((h % 24) + 24) % 24; return `${x % 12 || 12}${x < 12 ? 'a' : 'p'}`; };
  const hourLbl = h => h === 0 ? '12A' : h < 12 ? h + 'A' : h === 12 ? '12P' : (h - 12) + 'P';
  const emptyRow = () => Array(24).fill(false);
  const rowOf = (...pairs) => { const r = emptyRow(); for (let i = 0; i < pairs.length; i += 2) for (let h = pairs[i]; h < pairs[i + 1]; h++) r[h] = true; return r; };
  const rowHrs = r => r.filter(Boolean).length;
  function ranges(row) { const o = []; let s = null; for (let h = 0; h <= 24; h++) { const on = h < 24 && row[h]; if (on && s === null) s = h; if (!on && s !== null) { o.push([s, h]); s = null; } } return o; }
  const rangeText = row => { const r = ranges(row); if (!r.length) return 'Unavailable'; if (r.length === 1 && r[0][0] === 0 && r[0][1] === 24) return 'All day'; return r.map(([a, b]) => `${tL(a)} – ${tL(b)}`).join(', '); };
  const rangeShort = row => { const r = ranges(row); if (!r.length) return 'Off'; if (r.length === 1 && r[0][0] === 0 && r[0][1] === 24) return 'All day'; return r.map(([a, b]) => `${tS(a)}–${tS(b)}`).join(', '); };
  const sameRow = (a, b) => a.every((v, i) => v === b[i]);
  const cloneDays = d => { const o = {}; Object.keys(d || {}).forEach(k => { o[k] = d[k].slice(); }); return o; };
  const daysHrs = d => Object.values(d).reduce((a, r) => a + rowHrs(r), 0);

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const same = (a, b) => String(a) === String(b);

  /* ---------------- Employees ---------------- */
  const EMP_NAMES = ['Angie Vasquez', 'Benjamin Limon', 'Daniel Garcia', 'Daniel Velazquez', 'David Acosta', 'Evelia Gonzalez', 'James Rodriguez', 'Jessica Smith'];
  const fallbackEmp = id => { const i = +id || 0; return { id: i, name: EMP_NAMES[i % 8], avatar: `https://i.pravatar.cc/150?u=${i + 10}`, position: i % 3 === 0 ? 'General Manager' : i % 2 === 0 ? 'Shift Leader' : 'Line Cook' }; };
  function empInfo(id) {
    try { if (typeof employeeData !== 'undefined') { const e = employeeData.find(x => same(x.id, id)); if (e) return e; } } catch (e) {}
    const d = read('zipCrewData'); const e = d && (d.employees || []).find(x => same(x.id, id));
    return e || fallbackEmp(id);
  }
  function allEmployees() {
    try { if (typeof employeeData !== 'undefined' && employeeData.length) return employeeData; } catch (e) {}
    const d = read('zipCrewData'); if (d && d.employees && d.employees.length) return d.employees;
    return EMP_NAMES.map((n, i) => fallbackEmp(i));
  }
  const first = n => String(n || '').split(' ')[0];

  /* ---------------- Regular availability (read only) ---------------- */
  function regVersions(empId) {
    if (typeof window.__availVersions === 'function') { try { return window.__availVersions(empId) || []; } catch (e) {} }
    const av = read('zipAvailStore'); if (av && av.store && av.store[empId]) return av.store[empId];
    if (window.CREW_CTX && same(window.CREW_CTX.empId, empId)) return window.CREW_CTX.versions || [];
    const d = read('zipCrewData'); if (d && d.availability && d.availability[empId]) return d.availability[empId];
    return null;   // unknown (dashboard opened before the schedule)
  }
  function regularRow(empId, iso) {
    const vs = regVersions(empId);
    if (!vs) { const d = weekday(iso); return d === 0 ? rowOf(10, 18) : rowOf(9, 17); }
    if (!vs.length) return emptyRow();
    const s = vs.slice().sort((a, b) => a.eff.localeCompare(b.eff));
    const v = s.filter(x => x.eff <= iso).pop() || s[0];
    return v.grid[weekday(iso)].slice();
  }

  /* ---------------- Store ---------------- */
  let CACHE = null;
  const listeners = [];
  function seed() {
    const T = TODAY(), at = (n, hm) => `${addDays(T, n)}T${hm}`;
    const mk = (id, empId, start, n, fn, extra) => {
      const e = fallbackEmp(empId), days = {};
      isoRange(start, addDays(start, n - 1)).forEach((iso, i) => { days[iso] = fn(weekday(iso), i); });
      return Object.assign({ id, empId, empName: e.name, start, end: addDays(start, n - 1), days, source: 'employee', status: 'pending',
        reason: '', note: '', createdAt: '', createdBy: e.name, decidedAt: '', decidedBy: '', updatedAt: '', log: [] }, extra);
    };
    const recs = [
      mk('ta-s1', 0, T, 5, () => rowOf(7, 15), { source: 'manager', status: 'active', reason: 'Holiday week — covering opening shifts', createdAt: at(-1, '10:05'), createdBy: 'Priya Sharma' }),
      mk('ta-s2', 3, addDays(T, 10), 11, d => d === 0 || d === 6 ? emptyRow() : rowOf(7, 12), { status: 'approved', reason: 'Final exams — I can only work mornings', createdAt: at(-4, '19:12'), decidedAt: at(-3, '09:30'), decidedBy: 'Priya Sharma' }),
      mk('ta-s3', 1, addDays(T, 3), 4, (d, i) => i < 2 ? emptyRow() : i === 2 ? rowOf(16, 22) : rowOf(10, 14, 17, 21), { reason: 'Out of town for a family wedding until Monday', createdAt: at(-1, '18:20') }),
      mk('ta-s4', 6, addDays(T, 7), 11, d => d === 0 ? emptyRow() : rowOf(6, 14), { reason: 'Evening course for two weeks — mornings only', createdAt: at(0, '08:10') }),
      mk('ta-s5', 7, addDays(T, 2), 4, () => emptyRow(), { status: 'declined', reason: 'Visiting family', createdAt: at(-3, '12:40'), decidedAt: at(-2, '16:05'), decidedBy: 'Priya Sharma',
        note: 'We’re short-staffed over the holiday weekend. Please request time off for specific days instead.' }),
      mk('ta-s6', 5, addDays(T, 14), 3, () => rowOf(12, 20), { reason: 'Childcare schedule change that week', createdAt: at(-2, '14:25') }),
    ];
    recs.forEach(r => {
      r.log = [{ t: r.source === 'manager' ? 'Assigned' : 'Submitted', at: r.createdAt, by: r.createdBy }];
      if (r.decidedAt) r.log.push({ t: r.status === 'approved' ? 'Approved' : 'Declined', at: r.decidedAt, by: r.decidedBy, note: r.note });
    });
    return { v: 1, seededOn: T, recs };
  }
  function load() {
    if (CACHE) return CACHE;
    let s = read(KEY);
    if (!s || s.v !== 1 || !Array.isArray(s.recs)) { s = seed(); write(KEY, s); }
    if (!s.recs.some(r => r.id === 'ta-s7')) {          // demo: a second (upcoming, approved) period for the first crew member
      const T = TODAY(), st = addDays(T, 16), e = fallbackEmp(0), days = {};
      isoRange(st, addDays(st, 4)).forEach(iso => { days[iso] = rowOf(7, 12); });
      s.recs.push({ id: 'ta-s7', empId: 0, empName: e.name, start: st, end: addDays(st, 4), days, source: 'employee', status: 'approved', reason: 'Final exams — mornings only',
        note: '', createdAt: `${addDays(T, -2)}T18:40`, createdBy: e.name, decidedAt: `${addDays(T, -1)}T09:15`, decidedBy: 'Priya Sharma', updatedAt: '',
        log: [{ t: 'Submitted', at: `${addDays(T, -2)}T18:40`, by: e.name }, { t: 'Approved', at: `${addDays(T, -1)}T09:15`, by: 'Priya Sharma' }] });
      write(KEY, s);
    }
    CACHE = s; return s;
  }
  function save() { write(KEY, load()); notify(false); }
  function notify(remote) { listeners.forEach(f => { try { f(remote); } catch (e) {} }); }
  window.addEventListener('storage', e => { if (e.key === KEY) { CACHE = null; notify(true); } });

  const recs = () => load().recs;
  const byId = id => recs().find(r => r.id === id);
  const forEmp = empId => recs().filter(r => same(r.empId, empId));
  const isEff = r => r.status === 'active' || r.status === 'approved';
  const prio = r => [r.createdAt, r.decidedAt, r.updatedAt].filter(Boolean).sort().pop() || '';
  const recDates = r => Object.keys(r.days).sort();
  const recHrs = r => daysHrs(r.days);
  const isPending = r => r.status === 'pending' && r.end >= TODAY();
  const statusOf = r => (r.status === 'pending' && r.end < TODAY()) ? 'expired' : r.status;

  function effective(empId, iso) {
    let best = null;
    recs().forEach(r => { if (!same(r.empId, empId) || !isEff(r) || !r.days[iso]) return; if (!best || prio(r) > prio(best)) best = r; });
    return best ? { rec: best, row: best.days[iso] } : null;
  }
  function resolve(empId, iso) {
    const t = effective(empId, iso);
    return t ? { src: 'temp', row: t.row.slice(), rec: t.rec } : { src: 'regular', row: regularRow(empId, iso) };
  }
  /* newer record wins: remove its dates from older effective records of the same employee */
  function trimOverlaps(rec) {
    let n = 0;
    recs().forEach(o => {
      if (o === rec || !same(o.empId, rec.empId) || !isEff(o)) return;
      const hit = Object.keys(rec.days).filter(iso => o.days[iso]);
      if (!hit.length) return;
      hit.forEach(iso => delete o.days[iso]); n += hit.length;
      const left = recDates(o);
      if (!left.length) { o.status = 'replaced'; o.log.push({ t: 'Replaced', at: NOW(), by: 'System', note: `by temporary availability ${fmtRange(rec.start, rec.end)}` }); }
      else { o.start = left[0]; o.end = left[left.length - 1]; o.log.push({ t: 'Dates replaced', at: NOW(), by: 'System', note: `${plural(hit.length, 'date')} now covered by ${fmtRange(rec.start, rec.end)}` }); }
    });
    return n;
  }
  function overlapping(empId, start, end, pred, exceptId) {
    return recs().filter(r => same(r.empId, empId) && r.id !== exceptId && pred(r) && recDates(r).some(iso => iso >= start && iso <= end));
  }

  function slotSummary(r) {
    const rows = recDates(r).map(iso => r.days[iso]);
    const off = rows.filter(x => !rowHrs(x)).length;
    const on = [...new Set(rows.filter(x => rowHrs(x)).map(rangeShort))];
    if (!on.length) return 'Unavailable on all dates';
    const offTxt = off ? ` · ${off} unavailable` : '';
    return on.length === 1 ? `${on[0]} on available days${offTxt}` : `Hours vary by day${offTxt}`;
  }
  function shiftConflicts(empId, days) {
    let shifts = [];
    try {
      if (typeof _aiCurrent === 'function') shifts = _aiCurrent().filter(s => same(s.empId, empId));
      else { const d = read('zipCrewData'); shifts = ((d && d.shifts) || []).filter(s => same(s.empId, empId)); }
    } catch (e) {}
    const T = TODAY(), out = [];
    Object.keys(days).sort().forEach(iso => {
      if (iso < T || daysBetween(T, iso) >= HORIZON) return;
      shifts.filter(s => s.day === weekday(iso)).forEach(s => {
        const end = Math.min(24, s.end > s.start ? s.end : 24);
        for (let h = Math.floor(s.start); h < Math.ceil(end); h++) if (!days[iso][h]) { out.push({ iso, s: s.start, e: s.end, role: s.position || '' }); break; }
      });
    });
    return out;
  }
  const hm = h => { const x = ((h % 24) + 24) % 24, H = Math.floor(x), M = Math.round((x - H) * 60); return `${H % 12 || 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'AM' : 'PM'}`; };

  function refreshSchedule() {
    try {
      if (document.getElementById('empSearch') && typeof filterEmployees === 'function') filterEmployees();
      else if (typeof renderScheduleTable === 'function') renderScheduleTable();
    } catch (e) {}
  }

  /* Schedule Pad: the schedule grid reads availability through _empAvail(emp, dow).
     Temporary availability for that exact date takes priority over regular availability. */
  if (typeof window._empAvail === 'function') {
    const prevAvail = window._empAvail;
    window._empAvail = function (emp, dow) {
      if (!emp) return null;
      let iso = null;
      try {
        const ad = typeof activeDate !== 'undefined' ? activeDate : new Date();
        iso = localIso(new Date(ad.getFullYear(), ad.getMonth(), ad.getDate() - ad.getDay() + dow));
      } catch (e) {}
      const t = iso && effective(emp.id, iso);
      if (!t) return prevAvail(emp, dow);
      const r = ranges(t.row);
      if (!r.length) return null;
      const out = r.map(([start, end]) => ({ start, end }));
      out.temp = true;
      return out;
    };
  }
  listeners.push(remote => { if (remote) refreshSchedule(); });

  /* =====================================================================
     Manual time entry — shared time-slot panel
     key   = unique id per editable day (e.g. 'avm:1', 'tm:2026-11-28')
     HOSTS[key] = { getRow, setRow, rerender, defaultRow }
     Typed times sync to the timeline and vice versa: the timeline row is
     the single source of truth; the panel is rebuilt from it every render.
     ===================================================================== */
  const HOSTS = {}, BAD = {}, DRAFT = {};
  function host(key, h) { HOSTS[key] = h; }
  /* only the day being edited keeps un-applied typed values; switching days drops them */
  function keepOnly(prefix, key) { [BAD, DRAFT].forEach(m => Object.keys(m).forEach(k => { if (k.startsWith(prefix) && k !== key) delete m[k]; })); }
  function resetKeys(prefix) { [BAD, DRAFT, HOSTS].forEach(m => Object.keys(m).forEach(k => { if (k.startsWith(prefix)) delete m[k]; })); }
  function hasErrors(prefix) {
    const msgs = [];
    Object.keys(BAD).forEach(k => { if (k.startsWith(prefix) && HOSTS[k] && BAD[k].sig === HOSTS[k].getRow().join('')) Object.values(BAD[k].items).forEach(x => msgs.push(x.msg)); });
    Object.keys(DRAFT).forEach(k => { if (k.startsWith(prefix)) DRAFT[k].forEach(d => { if (!!d.s.trim() !== !!d.e.trim()) msgs.push('A time slot is missing its start or end time.'); }); });
    return msgs.length ? msgs : null;
  }
  const fieldParts = h => { const x = h === 24 ? 0 : h; return { t: `${String(x % 12 || 12).padStart(2, '0')}:00`, ap: x < 12 ? 'AM' : 'PM' }; };
  function parseTime(text, ap, isEnd) {
    const s = String(text || '').trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    if (!s) return { empty: true };
    const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
    if (!m) return { err: 'Enter a time like 8:00 AM.' };
    const h = +m[1], mi = m[2] ? +m[2] : 0, suf = m[3];
    if (mi > 59) return { err: 'Minutes must be 00–59.' };
    if (mi !== 0) return { err: 'Use whole hours (e.g. 8:00) — availability is set in 1-hour blocks.' };
    let h24;
    if (suf) { if (h < 1 || h > 12) return { err: 'With AM/PM, use an hour from 1 to 12.' }; h24 = (h % 12) + (suf[0] === 'p' ? 12 : 0); }
    else if (h > 12) { if (h > 24) return { err: 'Enter an hour from 1 to 12.' }; h24 = h; }
    else if (h === 0) h24 = 0;
    else h24 = (h % 12) + (ap === 'PM' ? 12 : 0);
    if (isEnd && h24 === 0) h24 = 24;
    if (!isEnd && h24 === 24) return { err: 'Start time must be before midnight.' };
    return { h: h24 };
  }

  function windowsPanel(key, row, o) {
    o = o || {};
    const sig = row.join('');
    if (BAD[key] && BAD[key].sig !== sig) delete BAD[key];
    const bad = BAD[key] ? BAD[key].items : {};
    const drafts = DRAFT[key] || [];
    const wins = ranges(row);
    const avail = wins.length > 0 || drafts.length > 0;
    const tf = (id, f, h, label, draft) => {
      const b = bad[id];
      let t, ap;
      if (b) { t = b[f][0]; ap = b[f][1]; }
      else if (draft) { t = draft[f]; ap = draft[f + 'ap']; }
      else { const p = fieldParts(h); t = p.t; ap = p.ap; }
      return `<span class="ta-time ${b ? 'err' : ''}" data-ap="${ap}"><i data-lucide="clock-3"></i><input type="text" class="ta-tin" autocomplete="off" spellcheck="false" maxlength="8" value="${esc(t)}" placeholder="--:--" data-f="${f}" aria-label="${esc(label)}" ${b ? 'aria-invalid="true"' : ''}>`
        + `<span class="ta-ap" role="group" aria-label="AM or PM"><button type="button" data-ap="AM" class="${ap === 'AM' ? 'on' : ''}" aria-pressed="${ap === 'AM'}">AM</button><button type="button" data-ap="PM" class="${ap === 'PM' ? 'on' : ''}" aria-pressed="${ap === 'PM'}">PM</button></span></span>`;
    };
    let w = '';
    wins.forEach(([a, b], i) => {
      w += `<div class="ta-win ${bad[i] ? 'err' : ''}" data-win="${i}"><span class="n" title="Time slot ${i + 1}">${i + 1}</span>${tf(String(i), 's', a, `Slot ${i + 1} start time`)}<span class="to">to</span>${tf(String(i), 'e', b, `Slot ${i + 1} end time`)}
        <span class="dur">${b - a}h</span><button type="button" class="ta-xbtn" data-wact="rm" data-wi="${i}" title="Remove this time slot" aria-label="Remove time slot ${i + 1}"><i data-lucide="x"></i></button></div>`;
    });
    drafts.forEach((d, i) => {
      const id = 'd' + i;
      w += `<div class="ta-win draft ${bad[id] ? 'err' : ''}" data-win="${id}"><span class="n">${wins.length + i + 1}</span>${tf(id, 's', null, 'New slot start time', d)}<span class="to">to</span>${tf(id, 'e', null, 'New slot end time', d)}
        <span class="dur">new</span><button type="button" class="ta-xbtn" data-wact="rmd" data-wi="${i}" title="Remove this time slot" aria-label="Remove new time slot"><i data-lucide="x"></i></button></div>`;
    });
    const errs = Object.values(bad).map(x => x.msg);
    return `<div class="ta-wp ${o.compact ? 'compact' : ''}" data-wkey="${esc(key)}">
      <div class="ta-wp-t"><b>${o.title || ''}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</div>
      <div class="ta-seg" role="group" aria-label="Availability for ${esc(String(o.title || '').replace(/<[^>]+>/g, ''))}">
        <button type="button" data-wact="avail" class="${avail ? 'on ok' : ''}" aria-pressed="${avail}"><i data-lucide="check"></i>Available</button>
        <button type="button" data-wact="unavail" class="${!avail ? 'on no' : ''}" aria-pressed="${!avail}"><i data-lucide="ban"></i>Unavailable</button></div>
      <div class="ta-wins">${avail ? w + `<button type="button" class="ta-add" data-wact="add"><i data-lucide="plus"></i>Add time slot</button>` : `<span class="ta-off"><i data-lucide="moon"></i>Not available — choose <b>Available</b> or drag on the timeline to add hours</span>`}</div>
      ${o.extra ? `<div class="ta-wp-x">${o.extra}</div>` : ''}
      ${errs.length ? `<div class="ta-werr" role="alert"><i data-lucide="alert-circle"></i><span>${errs.map(esc).join(' ')}</span></div>` : ''}
    </div>`;
  }

  function fieldVals(box) {
    const g = f => { const i = box.querySelector(`.ta-tin[data-f="${f}"]`); return [i ? i.value : '', i ? i.closest('.ta-time').dataset.ap : 'AM']; };
    return { s: g('s'), e: g('e') };
  }
  function rerenderKey(key, focus) {
    const H = HOSTS[key]; if (!H) return;
    H.rerender();
    if (focus) {
      const p = [...document.querySelectorAll('.ta-wp')].find(x => x.dataset.wkey === focus.key);
      const el = p && p.querySelector(`[data-win="${focus.win}"] .ta-tin[data-f="${focus.f}"]`);
      if (el) { el.focus(); try { el.select(); } catch (e) {} }
    }
  }
  function commitWin(wp, box, opts) {
    const key = wp.dataset.wkey, H = HOSTS[key]; if (!H) return;
    const id = box.dataset.win, isDraft = id[0] === 'd', wi = parseInt(isDraft ? id.slice(1) : id, 10);
    const v = fieldVals(box);
    const row0 = H.getRow();
    const fail = msg => {
      BAD[key] = BAD[key] && BAD[key].sig === row0.join('') ? BAD[key] : { sig: row0.join(''), items: {} };
      BAD[key].items[id] = { s: v.s, e: v.e, msg };
      if (isDraft && DRAFT[key] && DRAFT[key][wi]) Object.assign(DRAFT[key][wi], { s: v.s[0], sap: v.s[1], e: v.e[0], eap: v.e[1] });
      rerenderKey(key, opts && opts.focus);
    };
    const ok = () => { if (BAD[key]) { delete BAD[key].items[id]; if (!Object.keys(BAD[key].items).length) delete BAD[key]; } };
    const s = parseTime(v.s[0], v.s[1], false), e = parseTime(v.e[0], v.e[1], true);
    if (isDraft) {
      const d = DRAFT[key] && DRAFT[key][wi]; if (!d) return;
      Object.assign(d, { s: v.s[0], sap: v.s[1], e: v.e[0], eap: v.e[1] });
      if (s.empty || e.empty) { if (s.err || e.err) return fail((s.err ? 'Start: ' + s.err : 'End: ' + e.err)); ok(); return; }
    } else if (s.empty || e.empty) return fail('Enter both a start and an end time — or remove the slot.');
    if (s.err) return fail('Start: ' + s.err);
    if (e.err) return fail('End: ' + e.err);
    if (e.h <= s.h) return fail('End time must be later than start time. For overnight hours, end this day at 12:00 AM and add the rest to the next day.');
    const row = row0.slice();
    if (!isDraft) { const w = ranges(row0)[wi]; if (w) for (let h = w[0]; h < w[1]; h++) row[h] = false; }
    const ov = ranges(row).find(([a, b]) => a < e.h && b > s.h);
    if (ov) return fail(`Overlaps ${tL(ov[0])} – ${tL(ov[1])}. Adjust the times or edit that slot instead.`);
    for (let h = s.h; h < e.h; h++) row[h] = true;
    ok();
    if (BAD[key]) BAD[key].sig = row.join('');
    if (isDraft) DRAFT[key].splice(wi, 1);
    H.setRow(row);
    rerenderKey(key, opts && opts.focus);
  }
  const focusInfo = () => {
    const ae = document.activeElement;
    if (!ae || !ae.classList || !ae.classList.contains('ta-tin')) return null;
    const wp = ae.closest('.ta-wp'), win = ae.closest('.ta-win');
    return wp && win ? { key: wp.dataset.wkey, win: win.dataset.win, f: ae.dataset.f } : null;
  };
  document.addEventListener('change', e => {
    const inp = e.target.closest && e.target.closest('.ta-tin'); if (!inp) return;
    const wp = inp.closest('.ta-wp'), box = inp.closest('.ta-win'); if (!wp || !box) return;
    // let focus move first (Tab to the next field), then rebuild and put focus back
    setTimeout(() => commitWin(wp, box, { focus: focusInfo() }), 0);
  });
  document.addEventListener('keydown', e => {
    const inp = e.target.closest && e.target.closest('.ta-tin'); if (!inp) return;
    const wp = inp.closest('.ta-wp'), box = inp.closest('.ta-win');
    if (e.key === 'Enter') { e.preventDefault(); commitWin(wp, box, { focus: { key: wp.dataset.wkey, win: box.dataset.win, f: inp.dataset.f } }); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const wrap = inp.closest('.ta-time'), isEnd = inp.dataset.f === 'e';
      const p = parseTime(inp.value, wrap.dataset.ap, isEnd);
      let h = p.h != null ? p.h : (isEnd ? 17 : 9);
      h += e.key === 'ArrowUp' ? 1 : -1;
      h = isEnd ? Math.max(1, Math.min(24, h)) : Math.max(0, Math.min(23, h));
      const fp = fieldParts(h); inp.value = fp.t; wrap.dataset.ap = fp.ap;
      wrap.querySelectorAll('[data-ap]').forEach(b => { b.classList.toggle('on', b.dataset.ap === fp.ap); b.setAttribute('aria-pressed', b.dataset.ap === fp.ap); });
      commitWin(wp, box, { focus: { key: wp.dataset.wkey, win: box.dataset.win, f: inp.dataset.f } });
    }
  });
  document.addEventListener('click', e => {
    const t = e.target;
    const wp = t.closest && t.closest('.ta-wp'); if (!wp) return;
    const key = wp.dataset.wkey, H = HOSTS[key]; if (!H) return;
    const apb = t.closest('.ta-time [data-ap]');
    if (apb) {
      const wrap = apb.closest('.ta-time'); wrap.dataset.ap = apb.dataset.ap;
      wrap.querySelectorAll('[data-ap]').forEach(b => { b.classList.toggle('on', b === apb); b.setAttribute('aria-pressed', b === apb); });
      const box = apb.closest('.ta-win'), inp = wrap.querySelector('.ta-tin');
      if (!inp.value.trim()) { inp.focus(); if (box.dataset.win[0] === 'd') { const d = DRAFT[key][+box.dataset.win.slice(1)]; if (d) d[inp.dataset.f + 'ap'] = apb.dataset.ap; } return; }
      return commitWin(wp, box, { focus: null });
    }
    const a = t.closest('[data-wact]'); if (!a) return;
    const row = H.getRow(), act = a.dataset.wact;
    if (act === 'avail') { if (!rowHrs(row) && !(DRAFT[key] || []).length) { H.setRow((H.defaultRow && rowHrs(H.defaultRow) ? H.defaultRow : rowOf(9, 17)).slice()); } return rerenderKey(key); }
    if (act === 'unavail') { delete DRAFT[key]; delete BAD[key]; H.setRow(emptyRow()); return rerenderKey(key); }
    if (act === 'rm') { const w = ranges(row)[+a.dataset.wi]; if (!w) return; const r = row.slice(); for (let h = w[0]; h < w[1]; h++) r[h] = false; delete BAD[key]; H.setRow(r); return rerenderKey(key); }
    if (act === 'rmd') { (DRAFT[key] || []).splice(+a.dataset.wi, 1); if (BAD[key]) { delete BAD[key].items['d' + a.dataset.wi]; } return rerenderKey(key); }
    if (act === 'add') {
      const w = ranges(row), last = w.length ? w[w.length - 1][1] : 8;
      const s = Math.min(23, last + 1), e2 = Math.min(24, s + 4);
      const r = row.slice(); let free = s < 24 && e2 > s && !r.slice(s, e2).some(Boolean);
      if (free) { for (let h = s; h < e2; h++) r[h] = true; H.setRow(r); return rerenderKey(key, { key, win: String(ranges(r).findIndex(([x]) => x === s)), f: 's' }); }
      (DRAFT[key] = DRAFT[key] || []).push({ s: '', sap: 'AM', e: '', eap: 'PM' });
      return rerenderKey(key, { key, win: 'd' + (DRAFT[key].length - 1), f: 's' });
    }
  });

  /* =====================================================================
     Date-range editor (temporary availability, manager + crew)
     ===================================================================== */
  const EDS = {};   // gid → { E, rerender }
  function newEditor(o) { return Object.assign({ empId: null, start: '', end: '', days: {}, base: null, page: 0, active: null, prefill: 'regular', reason: '', editingId: null, tried: false, role: 'manager', gid: 'tm' }, o); }
  const minStart = E => E.role === 'crew' ? addDays(TODAY(), CREW_NOTICE) : TODAY();
  function edRange(E) {
    if (!E.start || !E.end || E.end < E.start || daysBetween(E.start, E.end) + 1 > MAX_DAYS) return [];
    return isoRange(E.start, E.end);
  }
  function edPages(E) {
    const r = edRange(E); if (!r.length) return [];
    if (r.length < 7) return [r];                                   // under a week: only the chosen dates
    const out = [];                                                 // a week or more: full Sun–Sat weeks
    for (let s = addDays(r[0], -weekday(r[0])); s <= r[r.length - 1]; s = addDays(s, 7)) out.push(isoRange(s, addDays(s, 6)));
    return out;
  }
  const inRange = (E, iso) => iso >= E.start && iso <= E.end;
  function edSync(E) {
    edRange(E).forEach(iso => { if (!E.days[iso]) E.days[iso] = E.prefill === 'regular' ? regularRow(E.empId, iso) : emptyRow(); });
    const pg = edPages(E);
    E.page = Math.max(0, Math.min(E.page, pg.length - 1));
    if (!E.active || !inRange(E, E.active)) { const p = pg[E.page] || []; E.active = p.find(iso => inRange(E, iso)) || null; }
  }
  const edDays = E => { const o = {}; edRange(E).forEach(iso => { o[iso] = E.days[iso].slice(); }); return o; };
  function edDirty(E) {
    if (!E) return false;
    if (E.base) return E.start !== E.base.start || E.end !== E.base.end || JSON.stringify(edDays(E)) !== JSON.stringify(E.base.days) || (E.reason || '') !== (E.base.reason || '');
    return !!(E.start || E.end);
  }
  function edIssues(E) {
    const out = { err: '', warn: [] };
    const orig = E.editingId ? byId(E.editingId) : null;
    if (!E.start || !E.end) { if (E.tried) out.err = 'Select both a start date and an end date.'; return out; }
    if (E.end < E.start) { out.err = 'The end date must be on or after the start date.'; return out; }
    const minS = minStart(E);
    if (E.start < minS && !(orig && orig.start === E.start)) { out.err = E.role === 'crew' && CREW_NOTICE ? `Requests need at least ${plural(CREW_NOTICE, 'day')}’ notice — start on ${fmt(minS)} or later.` : 'The start date can’t be in the past.'; return out; }
    const n = daysBetween(E.start, E.end) + 1;
    if (n > MAX_DAYS) { out.err = `Temporary availability can cover up to ${MAX_DAYS} days (you picked ${n}). For a lasting change, update regular availability instead.`; return out; }
    if (E.role === 'crew') {
      const mine = overlapping(E.empId, E.start, E.end, r => r.status === 'pending', E.editingId);
      if (mine.length) { out.err = `You already have a pending request for ${fmtRange(mine[0].start, mine[0].end)}. Edit or cancel that request first.`; return out; }
      const eff = overlapping(E.empId, E.start, E.end, isEff, E.editingId);
      if (eff.length) out.warn.push(`You already have temporary availability for ${eff.map(r => fmtRange(r.start, r.end)).join(', ')}. If this request is approved, it replaces those hours on the overlapping dates.`);
    } else {
      const eff = overlapping(E.empId, E.start, E.end, isEff, E.editingId);
      if (eff.length) out.warn.push(`Overlaps temporary availability ${eff.map(r => fmtRange(r.start, r.end)).join(', ')}. Saving replaces it on the overlapping dates.`);
      const pend = overlapping(E.empId, E.start, E.end, isPending, E.editingId);
      if (pend.length) out.warn.push(`${first(empInfo(E.empId).name)} has a pending request for ${pend.map(r => fmtRange(r.start, r.end)).join(', ')}. It stays pending; if you approve it later, it takes priority on its dates.`);
    }
    return out;
  }
  function diffTag(row, ref) {
    if (sameRow(row, ref)) return `<span class="ta-tag same">Same as regular</span>`;
    const d = rowHrs(row) - rowHrs(ref);
    return `<span class="ta-tag diff">${d === 0 ? 'Changed' : (d > 0 ? '+' : '') + d + 'h vs regular'}</span>`;
  }

  /* rows: [{ iso, row, ref, locked, active, panel }] */
  function rowsHTML(list, o) {
    o = o || {};
    const T = TODAY();
    let h = `<div class="ta-grid ${o.ro ? 'ro' : 'edit'}" data-tagrid="${o.gid || ''}">
      <div class="ta-row head"><div></div><div class="ta-hours">${Array.from({ length: 24 }, (_, i) => `<span>${hourLbl(i)}</span>`).join('')}</div><div class="ta-sumh">${o.sumHead || 'Hours'}</div></div>`;
    list.forEach(x => {
      const dw = weekday(x.iso);
      h += `<div class="ta-row ${x.locked ? 'locked' : ''} ${x.active ? 'act' : ''} ${x.iso === T ? 'today' : ''}" data-iso="${x.iso}">
        <button type="button" class="ta-date" ${x.locked || o.ro ? 'tabindex="-1" disabled' : `data-taact="focusrow" data-iso="${x.iso}" title="Type exact times for ${fmtW(x.iso)}"`}>
          <b>${DAYS[dw]}</b><span>${fmtS(x.iso)}</span>${x.iso === T ? '<em>Today</em>' : ''}</button>
        <div class="ta-track">
          <div class="ta-cells">${(x.locked ? emptyRow() : x.row).map((on, hr) => `<i class="ta-c ${on ? 'on' : ''} ${x.ref && !x.locked && !o.noChg && x.ref[hr] !== on ? 'chg' : ''}" data-h="${hr}" title="${DAYS_FULL[dw]} ${fmtS(x.iso)} · ${tL(hr)} – ${tL(hr + 1)}"></i>`).join('')}</div>
          ${x.ref ? `<div class="ta-ref" title="Regular availability: ${esc(rangeText(x.ref))}">${x.ref.map(on => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        </div>
        <div class="ta-sum">${x.locked ? '<span class="lk"><i data-lucide="lock"></i>Outside selected dates</span>'
          : `<div class="r ${rowHrs(x.row) ? '' : 'none'}">${rangeText(x.row)}</div><div class="h">${rowHrs(x.row)} hrs${x.ref && !o.noTag ? diffTag(x.row, x.ref) : ''}</div>`}</div>
      </div>`;
      if (x.panel) h += `<div class="ta-inline">${x.panel}</div>`;
    });
    return h + `</div>`;
  }
  function legendHTML(o) {
    o = o || {};
    let h = `<span><i class="sw av"></i>Available</span><span><i class="sw off"></i>Unavailable</span><span><i class="sw ref"></i>Regular availability (reference)</span>`;
    if (o.chg) h += `<span><i class="sw chg"></i>Differs from regular</span>`;
    if (o.lock) h += `<span><i class="sw lock"></i>Outside selected dates</span>`;
    return `<div class="ta-legend">${h}${o.tot ? `<span class="tot">${o.tot}</span>` : ''}</div>`;
  }

  /* the full editor block below the date bar (tools, week nav, rows, legend) */
  function editorBody(E, rerender) {
    const pages = edPages(E);
    if (!pages.length) return `<div class="ta-empty"><span class="ic"><i data-lucide="calendar-range"></i></span><b>Pick a start and end date</b>
      <span>The availability grid appears for exactly those dates. Fewer than 7 days shows just those dates; 7 days or more shows full weeks you can page through.</span></div>`;
    const page = pages[E.page], rng = edRange(E);
    const gid = E.gid;
    EDS[gid] = { E, rerender };
    keepOnly(gid + ':', `${gid}:${E.active}`);
    const list = page.map(iso => {
      const locked = !inRange(E, iso);
      const ref = regularRow(E.empId, iso);
      const x = { iso, row: locked ? emptyRow() : E.days[iso], ref, locked, active: !locked && E.active === iso };
      if (x.active) {
        const key = `${gid}:${iso}`;
        host(key, { getRow: () => E.days[iso], setRow: r => { E.days[iso] = r; }, rerender, defaultRow: rowHrs(ref) ? ref : rowOf(9, 17) });
        x.panel = windowsPanel(key, E.days[iso], {
          title: `${DAYS_FULL[weekday(iso)]}, ${fmtS(iso)}`, sub: `Regular: ${esc(rangeText(ref))}`,
          extra: `<button type="button" class="ta-btn sm" data-taact="usereg" data-iso="${iso}" ${sameRow(E.days[iso], ref) ? 'disabled' : ''}><i data-lucide="rotate-ccw"></i>Use regular hours</button>
                  <button type="button" class="ta-btn sm" data-taact="copyall" data-iso="${iso}" title="Copy these hours to every selected date"><i data-lucide="copy"></i>Copy to all dates</button>`,
        });
      }
      return x;
    });
    const regTot = rng.reduce((a, iso) => a + rowHrs(regularRow(E.empId, iso)), 0), tmpTot = rng.reduce((a, iso) => a + rowHrs(E.days[iso]), 0);
    const nav = pages.length > 1 ? `<div class="ta-nav">
        <button type="button" class="ta-icon" data-taact="pg" data-d="-1" ${E.page === 0 ? 'disabled' : ''} aria-label="Previous week"><i data-lucide="chevron-left"></i></button>
        <div class="t"><b>Week ${E.page + 1} of ${pages.length}</b><span>${fmtS(page[0])} – ${fmtS(page[6])}</span></div>
        <button type="button" class="ta-icon" data-taact="pg" data-d="1" ${E.page === pages.length - 1 ? 'disabled' : ''} aria-label="Next week"><i data-lucide="chevron-right"></i></button>
        <div class="dots">${pages.map((p, i) => `<button type="button" data-taact="pgto" data-i="${i}" class="${i === E.page ? 'on' : ''}" aria-label="Week ${i + 1}"></button>`).join('')}</div>
        ${page.some(iso => !inRange(E, iso)) ? '<span class="lkn"><i data-lucide="lock"></i>Dates outside the selected range are locked</span>' : ''}</div>`
      : `<div class="ta-nav single"><div class="t"><b>${plural(rng.length, 'date')}</b><span>Only the selected dates are shown</span></div></div>`;
    return `<div class="ta-tools">
        <span class="hint"><i data-lucide="mouse-pointer-click"></i>Drag across hours to mark them, or pick a date and type exact times. Grey bars show regular availability.</span>
        <div class="ta-seg sm" role="group" aria-label="Start from"><span class="cap">Start from</span>
          <button type="button" data-taact="prefill" data-v="regular" class="${E.prefill === 'regular' ? 'on' : ''}">Regular hours</button>
          <button type="button" data-taact="prefill" data-v="blank" class="${E.prefill === 'blank' ? 'on' : ''}">Unavailable</button></div>
        <button type="button" class="ta-btn sm" data-taact="allday"><i data-lucide="sun"></i>All dates all day</button>
      </div>
      ${nav}
      <div class="ta-gridwrap">${rowsHTML(list, { gid, sumHead: E.role === 'crew' ? 'Requested hours' : 'Temporary hours' })}</div>
      ${legendHTML({ chg: true, lock: page.some(iso => !inRange(E, iso)), tot: `${E.role === 'crew' ? 'Requested' : 'Temporary'} hours <b>${tmpTot} hrs</b> <small>regular for these dates: ${regTot} hrs</small>` })}`;
  }
  /* editor actions shared by manager + crew; returns true when handled */
  function edClick(E, t, rerender) {
    const a = t.closest('[data-taact]'); if (!a) return false;
    const act = a.dataset.taact;
    if (act === 'focusrow') { E.active = a.dataset.iso; rerender(); return true; }
    if (act === 'pg') { E.page += +a.dataset.d; E.active = null; edSync(E); rerender(); return true; }
    if (act === 'pgto') { E.page = +a.dataset.i; E.active = null; edSync(E); rerender(); return true; }
    if (act === 'usereg') { E.days[a.dataset.iso] = regularRow(E.empId, a.dataset.iso); resetKeys(`${E.gid}:${a.dataset.iso}`); rerender(); return true; }
    if (act === 'copyall') { const src = E.days[a.dataset.iso].slice(); edRange(E).forEach(iso => { E.days[iso] = src.slice(); }); resetKeys(E.gid + ':'); rerender(); toast(`Copied to all ${edRange(E).length} dates`); return true; }
    if (act === 'allday') { edRange(E).forEach(iso => { E.days[iso] = Array(24).fill(true); }); resetKeys(E.gid + ':'); rerender(); return true; }
    if (act === 'prefill') {
      const v = a.dataset.v; if (v === E.prefill) return true;
      const apply = () => { E.prefill = v; edRange(E).forEach(iso => { E.days[iso] = v === 'regular' ? regularRow(E.empId, iso) : emptyRow(); }); resetKeys(E.gid + ':'); rerender(); };
      const changed = edRange(E).some(iso => !sameRow(E.days[iso], E.prefill === 'regular' ? regularRow(E.empId, iso) : emptyRow()));
      if (!changed) apply();
      else dialog({ tone: 'warn', icon: 'refresh-ccw', title: 'Reset all selected dates?', body: `<p>Every selected date will start again from <b>${v === 'regular' ? 'the regular hours' : 'unavailable'}</b>. Changes you made to individual dates are lost.</p>`, ok: 'Reset dates', okCls: 'danger', onOk: apply });
      return true;
    }
    return false;
  }
  function edDateChange(E, field, val) {
    E[field] = val;
    if (field === 'start' && E.end && val && E.end < val) E.end = '';
    if (field === 'start' && val && !E.end) E.end = val;
    E.page = 0; E.active = null; edSync(E);
  }
  /* painting on the timeline */
  let PAINT = null;
  document.addEventListener('pointerdown', e => {
    const c = e.target.closest && e.target.closest('.ta-grid.edit .ta-row:not(.locked):not(.head) .ta-c'); if (!c) return;
    const g = c.closest('.ta-grid'), ed = EDS[g.dataset.tagrid]; if (!ed) return;
    e.preventDefault();
    const iso = c.closest('.ta-row').dataset.iso, row = ed.E.days[iso]; if (!row) return;
    PAINT = { ed, grid: g, val: !row[+c.dataset.h], last: null };
    ed.E.active = iso;
    paintCell(c);
  });
  document.addEventListener('pointermove', e => {
    if (!PAINT) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const c = t && t.closest && t.closest('.ta-row:not(.locked) .ta-c');
    if (c && PAINT.grid.contains(c)) paintCell(c);
  });
  function paintCell(c) {
    const rowEl = c.closest('.ta-row'), iso = rowEl.dataset.iso, row = PAINT.ed.E.days[iso]; if (!row) return;
    const h = +c.dataset.h, L = PAINT.last && PAINT.last.iso === iso ? PAINT.last.h : h;
    const cells = rowEl.querySelectorAll('.ta-c');
    for (let x = Math.min(L, h); x <= Math.max(L, h); x++) if (row[x] !== PAINT.val) { row[x] = PAINT.val; cells[x].classList.toggle('on', PAINT.val); }
    PAINT.last = { iso, h };
  }
  const endPaint = () => { if (!PAINT) return; const ed = PAINT.ed; PAINT = null; ed.rerender(); };
  window.addEventListener('pointerup', endPaint);
  window.addEventListener('pointercancel', endPaint);

  /* =====================================================================
     Shared pieces: chips, effective-availability ribbon, record cards
     ===================================================================== */
  function timing(r) {
    const T = TODAY();
    if (r.end < T) return { cls: 'ended', t: 'Ended' };
    if (r.start <= T) return { cls: 'now', t: 'In effect' };
    return { cls: 'soon', t: 'Starts ' + inDays(r.start) };
  }
  const statusChip = r => { const s = statusOf(r); return `<span class="ta-chip st-${s}">${STATUS[s]}</span>`; };
  const srcChip = (r, crew) => r.source === 'manager' ? `<span class="ta-src mgr"><i data-lucide="user-cog"></i>${crew ? 'Set by your manager' : 'Manager assigned'}</span>` : `<span class="ta-src emp"><i data-lucide="send"></i>${crew ? 'My request' : 'Employee requested'}</span>`;
  const spark = r => { const ds = recDates(r), show = ds.slice(0, 14); return `<span class="ta-spark" aria-hidden="true">${show.map(iso => { const n = rowHrs(r.days[iso]); return `<i class="${n ? '' : 'z'}" style="height:${Math.max(3, Math.round(n / 24 * 22))}px" title="${fmtW(iso)}: ${esc(rangeText(r.days[iso]))}"></i>`; }).join('')}${ds.length > 14 ? `<em>+${ds.length - 14}</em>` : ''}</span>`; };

  function groups(list) {
    const T = TODAY();
    const g = { pending: [], upcoming: [], history: [] };
    list.forEach(r => {
      if (isPending(r)) g.pending.push(r);
      else if (isEff(r) && r.end >= T) g.upcoming.push(r);
      else g.history.push(r);
    });
    g.pending.sort((a, b) => a.start.localeCompare(b.start));
    g.upcoming.sort((a, b) => a.start.localeCompare(b.start));
    g.history.sort((a, b) => prio(b).localeCompare(prio(a)));
    return g;
  }

  function ribbonHTML(empId, crew) {
    const T = TODAY();
    let h = '';
    for (let i = 0; i < RIBBON_DAYS; i++) {
      const iso = addDays(T, i), r = resolve(empId, iso), pend = recs().filter(x => same(x.empId, empId) && isPending(x) && x.days[iso]);
      const n = rowHrs(r.row);
      const tip = `${fmtW(iso)} — ${r.src === 'temp' ? 'Temporary' : 'Regular'}: ${rangeText(r.row)}${r.src === 'temp' ? ` (regular would be ${rangeText(regularRow(empId, iso))})` : ''}${pend.length ? ' · Pending request not applied' : ''}`;
      h += `<div class="ta-rb-d ${r.src} ${iso === T ? 'today' : ''} ${pend.length ? 'pend' : ''} ${weekday(iso) === 0 ? 'wk' : ''}" title="${esc(tip)}">
        <span class="dw">${DAYS[weekday(iso)]}</span><span class="dn">${toD(iso).getUTCDate()}</span>
        <span class="bar">${r.row.map(on => `<i class="${on ? 'on' : ''}"></i>`).join('')}</span>
        <span class="hh">${n ? n + 'h' : 'Off'}</span><span class="src">${r.src === 'temp' ? 'Temp' : 'Reg'}</span></div>`;
    }
    return `<div class="ta-ribbon">
      <div class="ta-rb-h"><b><i data-lucide="calendar-search"></i>Effective availability · next ${RIBBON_DAYS / 7} weeks</b>
        <span class="lg"><span><i class="k reg"></i>Regular</span><span><i class="k temp"></i>Temporary (takes priority)</span><span><i class="k pend"></i>Pending request — not applied</span></span></div>
      <div class="ta-rb">${h}</div>
      <p class="ta-rb-f">${crew ? 'This is what your manager schedules against.' : 'What the schedule uses for each date.'} Temporary availability replaces regular hours only on its dates; regular availability applies before and after.</p></div>`;
  }

  function cardHTML(r, o) {
    o = o || {};
    const e = empInfo(r.empId), tm = timing(r), st = statusOf(r);
    const open = o.open, n = recDates(r).length;
    let acts = '';
    if (o.role === 'manager') {
      if (isPending(r)) acts = `<button type="button" class="ta-btn sm" data-taact="review" data-id="${r.id}"><i data-lucide="eye"></i>Review</button>
        <button type="button" class="ta-btn sm ok" data-taact="approve" data-id="${r.id}"><i data-lucide="check"></i>Approve</button>
        <button type="button" class="ta-btn sm no" data-taact="decline" data-id="${r.id}"><i data-lucide="x"></i>Decline</button>`;
      else if (isEff(r) && r.end >= TODAY()) acts = `<button type="button" class="ta-btn sm" data-taact="toggle" data-id="${r.id}"><i data-lucide="${open ? 'chevron-up' : 'chevron-down'}"></i>${open ? 'Hide days' : 'View days'}</button>
        <button type="button" class="ta-btn sm" data-taact="edit" data-id="${r.id}"><i data-lucide="pencil"></i>Edit</button>
        <button type="button" class="ta-btn sm gd" data-taact="remove" data-id="${r.id}" title="Remove"><i data-lucide="trash-2"></i></button>`;
      else acts = `<button type="button" class="ta-btn sm" data-taact="toggle" data-id="${r.id}"><i data-lucide="${open ? 'chevron-up' : 'chevron-down'}"></i>${open ? 'Hide' : 'View'}</button>`;
    }
    const by = r.source === 'manager' ? `by ${esc(r.createdBy)}` : `by ${esc(o.scopeAll ? first(e.name) : r.createdBy)}`;
    return `<div class="ta-card st-${st} ${o.flash ? 'flash' : ''}" data-card="${r.id}">
      <div class="ta-card-m">
        ${o.scopeAll ? `<img src="${esc(e.avatar)}" alt="" class="ta-av">` : ''}
        <div class="ta-card-t">
          ${o.scopeAll ? `<div class="nm">${esc(e.name)}</div>` : ''}
          <div class="l1"><b>${fmtRange(r.start, r.end)}</b>${statusChip(r)}${isEff(r) || isPending(r) ? `<span class="ta-chip tm-${tm.cls}">${tm.t}</span>` : ''}</div>
          <div class="l2">${srcChip(r)}<span>${plural(n, 'day')}</span><span>${recHrs(r)} hrs</span><span title="${esc(slotSummary(r))}">${esc(slotSummary(r))}</span><span>${r.source === 'manager' ? 'Created' : 'Requested'} ${fmtS(r.createdAt.slice(0, 10))} ${by}</span></div>
          ${r.reason ? `<div class="l3"><i data-lucide="message-square-quote"></i>“${esc(r.reason)}”</div>` : ''}
          ${st === 'declined' && r.note ? `<div class="l3 bad"><i data-lucide="message-square-x"></i>Manager’s note: “${esc(r.note)}”</div>` : ''}
        </div>
        ${spark(r)}
        <div class="ta-card-a">${acts}</div>
      </div>
      ${open ? `<div class="ta-card-b">${rowsHTML(recDates(r).map(iso => ({ iso, row: r.days[iso], ref: regularRow(r.empId, iso) })), { ro: true, noChg: true })}${legendHTML({})}</div>` : ''}
    </div>`;
  }

  /* =====================================================================
     MANAGER — Schedule Pad › employee › Availability › Temporary tab
     ===================================================================== */
  let MH = { empId: null, mode: 'view', scope: 'emp', E: null, open: {}, flash: null, carry: null };
  function renderManager(el, ctx) {
    if (!same(MH.empId, ctx.empId)) {
      const carry = MH.carry && same(MH.carry.empId, ctx.empId) ? MH.carry : null;
      MH = { empId: ctx.empId, mode: carry ? 'edit' : 'view', scope: MH.scope || 'emp', E: carry, open: {}, flash: null, carry: null };
    }
    MH.el = el; MH.ctx = ctx;
    if (!el._taBound) {
      el._taBound = true;
      el.addEventListener('click', e => mgrClick(e));
      el.addEventListener('change', e => mgrChange(e));
      el.addEventListener('input', e => { if (e.target.dataset.tafield === 'reason' && MH.E) MH.E.reason = e.target.value; });
    }
    el.innerHTML = MH.mode === 'edit' ? mgrEdit() : mgrView();
    icons();
    if (MH.flash) {
      const c = el.querySelector(`[data-card="${MH.flash}"]`);
      if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      MH.flash = null;
    }
  }
  const mgrRerender = () => { if (MH.el && MH.ctx) renderManager(MH.el, MH.ctx); };
  const mgrPending = empId => forEmp(empId).filter(isPending).length;

  function mgrView() {
    const e = empInfo(MH.empId), all = MH.scope === 'all';
    const list = all ? recs() : forEmp(MH.empId);
    const g = groups(list);
    const flashId = MH.flashId; MH.flashId = null;
    const card = r => cardHTML(r, { role: 'manager', open: !!MH.open[r.id], scopeAll: all, flash: flashId === r.id });
    const sec = (title, sub, items, cls, empty) => `<section class="ta-sec ${cls}"><div class="ta-sec-h"><b>${title}</b><span class="ta-count">${items.length}</span><small>${sub}</small></div>
      ${items.length ? items.map(card).join('') : `<div class="ta-none">${empty}</div>`}</section>`;
    return `<div class="ta-wrap">
      <div class="ta-hero">
        <span class="ta-ic"><i data-lucide="calendar-range"></i></span>
        <div class="tx"><b>Temporary availability</b><small>Different hours for specific dates. It takes priority over regular availability on those dates only — regular availability itself never changes.</small></div>
        <div class="r"><button type="button" class="ta-btn primary" data-taact="new"><i data-lucide="plus"></i>Add temporary availability</button></div>
      </div>
      ${ribbonHTML(MH.empId)}
      <div class="ta-lhead"><div class="ta-seg sm" role="tablist" aria-label="Whose records">
          <button type="button" role="tab" data-taact="scope" data-v="emp" class="${!all ? 'on' : ''}" aria-selected="${!all}">${esc(first(e.name))}</button>
          <button type="button" role="tab" data-taact="scope" data-v="all" class="${all ? 'on' : ''}" aria-selected="${all}">All employees</button></div>
        <span class="ta-lnote">${all ? 'Every employee in this store' : `Only ${esc(e.name)}`}</span></div>
      ${sec('Pending requests', 'Sent from the crew app · not applied until you approve', g.pending, 'pend', 'No temporary availability requests waiting for review.')}
      ${sec('Upcoming & in effect', 'Manager-assigned and approved · overrides regular availability', g.upcoming, 'up', `No upcoming temporary availability. Use <b>Add temporary availability</b> to set different hours for specific dates.`)}
      ${g.history.length ? `<details class="ta-hist"><summary><i data-lucide="history"></i>History <span class="ta-count">${g.history.length}</span><small>Declined, cancelled, replaced and past records</small></summary>${g.history.map(card).join('')}</details>` : ''}
    </div>`;
  }

  function mgrEdit() {
    const E = MH.E; edSync(E);
    const e = empInfo(E.empId), iss = edIssues(E), rng = edRange(E), T = TODAY();
    const nextSun = addDays(T, 7 - weekday(T));
    const q = (a, b, lbl) => `<button type="button" data-taact="quick" data-a="${a}" data-b="${b}" class="${E.start === a && E.end === b ? 'on' : ''}">${lbl}</button>`;
    const emps = (MH.ctx.employees || allEmployees());
    const editing = E.editingId ? byId(E.editingId) : null;
    const startLocked = editing && editing.start < T;
    const notes = [];
    if (iss.err) notes.push(`<div class="ta-note err"><i data-lucide="alert-circle"></i><div>${iss.err}</div></div>`);
    else if (rng.length) notes.push(`<div class="ta-note info"><i data-lucide="info"></i><div><b>${plural(rng.length, 'day')}</b> · ${fmtW(E.start)} → ${fmtW(E.end)}. Saves <b>without approval</b> and takes effect immediately for these dates. Regular availability is not changed and applies again from ${fmt(addDays(E.end, 1))}.</div></div>`);
    iss.warn.forEach(w => notes.push(`<div class="ta-note warn"><i data-lucide="alert-triangle"></i><div>${w}</div></div>`));
    const errs = hasErrors(E.gid + ':');
    if (E.tried && errs) notes.push(`<div class="ta-note err"><i data-lucide="alert-circle"></i><div>Fix the highlighted time slot before saving.</div></div>`);
    return `<div class="ta-wrap edit">
      <div class="ta-edbar">
        <div class="ta-edt"><span class="ta-ic"><i data-lucide="${editing ? 'pencil' : 'calendar-plus'}"></i></span>
          <div><b>${editing ? 'Edit temporary availability' : 'Add temporary availability'}</b><small>${editing ? `${editing.source === 'manager' ? 'Manager assigned' : 'Approved employee request'} · ${fmtRange(editing.start, editing.end)}` : 'Assign different hours for a date range — no approval needed'}</small></div></div>
        <div class="r"><button type="button" class="ta-btn" data-taact="cancel">Cancel</button>
          <button type="button" class="ta-btn primary" data-taact="save" ${rng.length && !iss.err ? '' : 'disabled'}><i data-lucide="check"></i>Save temporary availability</button></div>
      </div>
      <div class="ta-form">
        <label class="ta-fld emp"><span>Employee <em>*</em></span>
          <span class="ta-empsel"><img src="${esc(e.avatar)}" alt=""><select data-tafield="emp" ${editing ? 'disabled' : ''} aria-label="Employee">${emps.map(x => `<option value="${x.id}" ${same(x.id, E.empId) ? 'selected' : ''}>${esc(x.name)} · ${esc(x.position || '')}</option>`).join('')}</select></span></label>
        <label class="ta-fld"><span>Start date <em>*</em></span><input type="date" data-tafield="start" value="${E.start}" min="${startLocked ? '' : minStart(E)}" ${startLocked ? 'disabled title="Already in effect — the start date can’t change"' : ''} class="${E.tried && !E.start ? 'err' : ''}" aria-required="true"></label>
        <span class="ta-arrow"><i data-lucide="arrow-right"></i></span>
        <label class="ta-fld"><span>End date <em>*</em></span><input type="date" data-tafield="end" value="${E.end}" min="${E.start || minStart(E)}" class="${(E.tried && !E.end) || (E.end && E.start && E.end < E.start) ? 'err' : ''}" aria-required="true"></label>
        <div class="ta-quick"><span class="cap">Quick pick</span>${q(T, addDays(T, 4), 'Next 5 days')}${q(nextSun, addDays(nextSun, 6), 'Next week')}${q(nextSun, addDays(nextSun, 13), 'Next 2 weeks')}</div>
        <label class="ta-fld grow"><span>Reason <small>(optional, shown to the employee)</small></span><input type="text" data-tafield="reason" maxlength="140" value="${esc(E.reason)}" placeholder="e.g. Holiday week coverage"></label>
      </div>
      ${notes.length ? `<div class="ta-notes">${notes.join('')}</div>` : ''}
      ${editorBody(E, mgrRerender)}
    </div>`;
  }

  function mgrClick(e) {
    const t = e.target;
    if (MH.mode === 'edit') {
      const E = MH.E;
      if (edClick(E, t, mgrRerender)) return;
      const a = t.closest('[data-taact]'); if (!a) return;
      if (a.dataset.taact === 'quick') { E.start = a.dataset.a; E.end = a.dataset.b; E.page = 0; E.active = null; edSync(E); return mgrRerender(); }
      if (a.dataset.taact === 'cancel') return managerGuard(() => { exitMgrEdit(); mgrRerender(); });
      if (a.dataset.taact === 'save') return mgrSave();
      return;
    }
    const a = t.closest('[data-taact]'); if (!a) return;
    const act = a.dataset.taact, r = a.dataset.id ? byId(a.dataset.id) : null;
    if (act === 'new') { MH.mode = 'edit'; MH.E = newEditor({ empId: MH.empId, gid: 'tm', role: 'manager' }); return mgrRerender(); }
    if (act === 'scope') { MH.scope = a.dataset.v; return mgrRerender(); }
    if (act === 'toggle' && r) { MH.open[r.id] = !MH.open[r.id]; return mgrRerender(); }
    if (act === 'review' && r) return openReview(r.id, { onDone: () => { mgrRerender(); MH.ctx.onChange && MH.ctx.onChange(); } });
    if (act === 'approve' && r) return quickApprove(r, () => { MH.flashId = r.id; mgrRerender(); MH.ctx.onChange && MH.ctx.onChange(); });
    if (act === 'decline' && r) return quickDecline(r, () => { mgrRerender(); MH.ctx.onChange && MH.ctx.onChange(); });
    if (act === 'edit' && r) {
      if (!same(r.empId, MH.empId)) { MH.carry = editorFor(r); return MH.ctx.switchEmp(r.empId); }
      MH.mode = 'edit'; MH.E = editorFor(r); return mgrRerender();
    }
    if (act === 'remove' && r) return dialog({ tone: 'danger', icon: 'trash-2', title: 'Remove temporary availability?',
      body: `<p>${esc(empInfo(r.empId).name)}’s temporary availability for <b>${fmtRange(r.start, r.end)}</b> will be removed. <b>Regular availability</b> applies again on these dates.</p>${r.source === 'employee' ? '<p>This was the employee’s approved request — they’ll see it as removed.</p>' : ''}`,
      ok: 'Remove', okCls: 'danger',
      onOk: () => { r.status = 'removed'; r.updatedAt = NOW(); r.log.push({ t: 'Removed', at: NOW(), by: MGR }); save(); refreshSchedule(); mgrRerender(); MH.ctx.onChange && MH.ctx.onChange(); toast('Temporary availability removed — regular availability applies'); } });
  }
  function editorFor(r) {
    const E = newEditor({ empId: r.empId, gid: 'tm', role: 'manager', start: r.start, end: r.end, days: cloneDays(r.days), editingId: r.id, reason: r.reason || '' });
    edSync(E);
    E.base = { start: E.start, end: E.end, days: edDays(E), reason: E.reason };
    return E;
  }
  function mgrChange(e) {
    const f = e.target.dataset.tafield; if (!f || !MH.E) return;
    const E = MH.E;
    if (f === 'start' || f === 'end') { edDateChange(E, f, e.target.value); return mgrRerender(); }
    if (f === 'emp') {
      const id = e.target.value;
      E.empId = isNaN(+id) ? id : +id; E.days = {}; resetKeys('tm:'); edSync(E);
      MH.carry = E;
      return MH.ctx.switchEmp(E.empId);
    }
  }
  function exitMgrEdit() { MH.mode = 'view'; MH.E = null; resetKeys('tm:'); }
  const managerDirty = () => MH.mode === 'edit' && edDirty(MH.E);
  function managerGuard(then) {
    if (!managerDirty()) { if (MH.mode === 'edit') exitMgrEdit(); return then(); }
    dialog({ tone: 'warn', icon: 'alert-triangle', title: 'Discard temporary availability?', body: '<p>Your temporary availability hasn’t been saved. Leaving now discards it.</p>', ok: 'Discard', okCls: 'danger', onOk: () => { exitMgrEdit(); then(); } });
  }

  function mgrSave() {
    const E = MH.E; E.tried = true;
    const iss = edIssues(E);
    if (iss.err || !edRange(E).length) return mgrRerender();
    if (hasErrors(E.gid + ':')) { mgrRerender(); return toast('Fix the highlighted time slot before saving', 'warning'); }
    const days = edDays(E), emp = empInfo(E.empId), n = Object.keys(days).length;
    const hrs = daysHrs(days), reg = Object.keys(days).reduce((a, iso) => a + rowHrs(regularRow(E.empId, iso)), 0);
    const cf = shiftConflicts(E.empId, days);
    const off = Object.values(days).filter(r => !rowHrs(r)).length;
    let body = `<div class="ta-sumbox"><img src="${esc(emp.avatar)}" alt=""><div><b>${esc(emp.name)}</b><span>${fmtRange(E.start, E.end)} · ${plural(n, 'day')}</span></div>
      <div class="hrs"><b>${hrs} hrs</b><span>regular ${reg} hrs</span></div></div>
      <p>No approval needed — this <b>takes priority over regular availability</b> on these dates as soon as you save. Regular availability stays as it is and applies again from <b>${fmt(addDays(E.end, 1))}</b>.</p>`;
    if (off === n) body += `<p class="w"><b>${esc(first(emp.name))} will show as unavailable on every selected date.</b></p>`;
    else if (off) body += `<p>${plural(off, 'date')} marked unavailable.</p>`;
    iss.warn.forEach(w => { body += `<p class="w">${w}</p>`; });
    if (cf.length) body += `<div class="sec">Shift conflicts</div><p><b>${plural(cf.length, 'scheduled shift')}</b> fall outside these hours. They stay on the schedule and are flagged for review:</p>
      <ul>${cf.slice(0, 5).map(s => `<li>${fmtW(s.iso)}: ${hm(s.s)} – ${hm(s.e)}${s.role ? ` (${esc(s.role)})` : ''}</li>`).join('')}${cf.length > 5 ? `<li>+${cf.length - 5} more</li>` : ''}</ul>`;
    dialog({ tone: cf.length || off === n ? 'warn' : 'info', icon: 'calendar-check', title: E.editingId ? 'Save changes?' : 'Assign temporary availability?', body,
      ok: E.editingId ? 'Save changes' : 'Assign now', okCls: 'primary', wide: true,
      onOk: () => {
        let r;
        if (E.editingId) {
          r = byId(E.editingId);
          Object.assign(r, { start: E.start, end: E.end, days, reason: E.reason, updatedAt: NOW() });
          if (r.status === 'approved' || r.status === 'active') r.log.push({ t: 'Edited', at: NOW(), by: MGR, note: fmtRange(E.start, E.end) });
        } else {
          r = { id: 'ta' + Date.now().toString(36), empId: E.empId, empName: emp.name, start: E.start, end: E.end, days, source: 'manager', status: 'active',
            reason: E.reason, note: '', createdAt: NOW(), createdBy: MGR, decidedAt: '', decidedBy: '', updatedAt: '', log: [{ t: 'Assigned', at: NOW(), by: MGR, note: fmtRange(E.start, E.end) }] };
          recs().push(r);
        }
        const trimmed = trimOverlaps(r);
        save(); refreshSchedule();
        exitMgrEdit(); MH.flash = r.id; MH.flashId = r.id; MH.scope = 'emp';
        mgrRerender(); MH.ctx.onChange && MH.ctx.onChange();
        toast(`Temporary availability saved for ${first(emp.name)} · ${fmtRange(r.start, r.end)}${trimmed ? ` (replaced ${plural(trimmed, 'overlapping date')})` : ''}`);
      } });
  }

  /* ---------- approve / decline (dashboard, Schedule Pad, review modal) ---------- */
  function decide(id, ok, note) {
    const r = byId(id); if (!r || r.status !== 'pending') return null;
    r.status = ok ? 'approved' : 'declined';
    r.decidedAt = NOW(); r.decidedBy = MGR; r.note = note || '';
    r.log.push({ t: ok ? 'Approved' : 'Declined', at: r.decidedAt, by: MGR, note: note || '' });
    if (ok) trimOverlaps(r);
    save(); refreshSchedule();
    return r;
  }
  function quickApprove(r, done) {
    const eff = overlapping(r.empId, r.start, r.end, isEff, r.id);
    dialog({ tone: 'info', icon: 'check-circle-2', title: `Approve ${first(empInfo(r.empId).name)}’s request?`,
      body: `<p>Temporary availability for <b>${fmtRange(r.start, r.end)}</b> (${plural(recDates(r).length, 'day')}, ${recHrs(r)} hrs) becomes effective and <b>takes priority over regular availability</b> on those dates.</p>${eff.length ? `<p class="w">Replaces existing temporary availability on overlapping dates (${eff.map(x => fmtRange(x.start, x.end)).join(', ')}).</p>` : ''}`,
      ok: 'Approve', okCls: 'ok solid', onOk: () => { decide(r.id, true); toast(`${first(empInfo(r.empId).name)}’s temporary availability approved`); done && done(); } });
  }
  function quickDecline(r, done) {
    dialog({ tone: 'danger', icon: 'x-circle', title: `Decline ${first(empInfo(r.empId).name)}’s request?`,
      body: `<p>Temporary availability for <b>${fmtRange(r.start, r.end)}</b> won’t be applied. Regular availability stays in effect.</p>
        <label for="taDNote">Note to ${esc(first(empInfo(r.empId).name))} <small>(optional — shown in the crew app)</small></label><textarea id="taDNote" placeholder="e.g. We need coverage on Friday evenings."></textarea>`,
      ok: 'Decline request', okCls: 'danger', onOk: () => { decide(r.id, false, (document.getElementById('taDNote') || {}).value || ''); toast(`${first(empInfo(r.empId).name)}’s temporary availability request declined`); done && done(); } });
  }

  /* ---------- review modal ---------- */
  let RV = null;
  function openReview(id, o) {
    const r = byId(id); if (!r) return;
    let w = document.getElementById('taRv');
    if (!w) {
      w = document.createElement('div'); w.id = 'taRv'; w.className = 'ta-rv-wrap ta-scope';
      w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'taRvT');
      w.innerHTML = '<div class="ta-rv" id="taRvBox"></div>';
      document.body.appendChild(w);
      w.addEventListener('click', rvClick);
    }
    RV = { id, declining: false, done: o && o.onDone, decided: null };
    w.classList.add('open'); renderReview();
  }
  function closeReview() { const w = document.getElementById('taRv'); if (w) w.classList.remove('open'); if (RV && RV.decided && RV.done) RV.done(); RV = null; }
  function renderReview() {
    const r = byId(RV.id), e = empInfo(r.empId), st = statusOf(r), T = TODAY();
    const ds = recDates(r), n = ds.length, hrs = recHrs(r), reg = ds.reduce((a, iso) => a + rowHrs(regularRow(r.empId, iso)), 0), diff = hrs - reg;
    const off = ds.filter(iso => !rowHrs(r.days[iso])).length;
    const cf = shiftConflicts(r.empId, r.days);
    const eff = overlapping(r.empId, r.start, r.end, isEff, r.id);
    const notes = [];
    if (r.reason) notes.push(`<div class="ta-note quote"><i data-lucide="message-square-quote"></i><div><b>${esc(first(e.name))}’s note:</b> <i>“${esc(r.reason)}”</i></div></div>`);
    if (eff.length && st === 'pending') notes.push(`<div class="ta-note warn"><i data-lucide="layers"></i><div>Overlaps existing temporary availability (${eff.map(x => fmtRange(x.start, x.end)).join(', ')}). Approving replaces it on the overlapping dates.</div></div>`);
    if (cf.length && st === 'pending') notes.push(`<div class="ta-note warn"><i data-lucide="alert-triangle"></i><div><b>${plural(cf.length, 'scheduled shift')}</b> fall outside the requested hours. They stay on the schedule and get flagged if you approve.
      <ul>${cf.slice(0, 4).map(s => `<li>${fmtW(s.iso)}: ${hm(s.s)} – ${hm(s.e)}${s.role ? ` (${esc(s.role)})` : ''}</li>`).join('')}${cf.length > 4 ? `<li>+${cf.length - 4} more</li>` : ''}</ul></div></div>`);
    if (st === 'declined' && r.note) notes.push(`<div class="ta-note err"><i data-lucide="message-square-x"></i><div><b>Your note:</b> “${esc(r.note)}”</div></div>`);
    const sd = daysBetween(T, r.start);
    let foot;
    if (st !== 'pending') foot = `<span class="hint"><i data-lucide="${st === 'approved' ? 'check-circle-2' : 'info'}"></i>${st === 'approved' ? `Approved${r.decidedAt ? ' ' + fmtDT(r.decidedAt) : ''} — effective for ${fmtRange(r.start, r.end)}.` : st === 'declined' ? `Declined${r.decidedAt ? ' ' + fmtDT(r.decidedAt) : ''} — not applied.` : STATUS[st] + '.'}</span><button type="button" class="ta-btn" data-rv="close">Close</button>`;
    else if (RV.declining) foot = `<div class="ta-rv-dec"><label for="taRvNote">Note to ${esc(first(e.name))} <small>(optional — shown in the crew app)</small></label><textarea id="taRvNote" placeholder="e.g. We need coverage on the weekend. Please keep Saturday available."></textarea></div>
      <span class="hint"><i data-lucide="info"></i>Regular availability stays in effect.</span><button type="button" class="ta-btn" data-rv="back">Back</button><button type="button" class="ta-btn danger" data-rv="confirm-no"><i data-lucide="x"></i>Decline request</button>`;
    else foot = `<span class="hint"><i data-lucide="calendar-clock"></i>Approving makes it effective for ${fmtRange(r.start, r.end)} — it overrides regular availability on those dates only.</span>
      <button type="button" class="ta-btn no" data-rv="no"><i data-lucide="x"></i>Decline</button><button type="button" class="ta-btn ok solid" data-rv="ok"><i data-lucide="check"></i>Approve</button>`;
    document.getElementById('taRvBox').innerHTML = `
      <div class="ta-rv-hd"><img src="${esc(e.avatar)}" alt="">
        <div class="min-w-0"><h2 id="taRvT">${esc(e.name)}’s temporary availability request</h2>
          <div class="sub"><span class="ta-type tmp"><i data-lucide="calendar-range"></i>Temporary availability</span><span>${esc(e.position || '')}</span><span class="sep"></span><span>Store timezone: ${TZ_LABEL}</span><span class="sep"></span>${statusChip(r)}</div></div>
        <button type="button" class="ta-icon" data-rv="close" aria-label="Close" title="Close"><i data-lucide="x"></i></button></div>
      <div class="ta-rv-stats">
        <div class="s main"><div class="k"><i data-lucide="calendar-range"></i>Dates</div><div class="v">${fmtRange(r.start, r.end)}</div><div class="m">${DAYS_FULL[weekday(r.start)]} → ${DAYS_FULL[weekday(r.end)]} · ${sd > 0 ? 'starts in ' + plural(sd, 'day') : sd === 0 ? 'starts today' : 'started ' + plural(-sd, 'day') + ' ago'}</div></div>
        <div class="s"><div class="k"><i data-lucide="calendar-days"></i>Requested days</div><div class="v">${plural(n, 'day')}</div><div class="m">${n - off} available · ${off} unavailable</div></div>
        <div class="s"><div class="k"><i data-lucide="clock"></i>Hours for these dates</div><div class="v">${reg} → ${hrs} hrs <span class="ta-delta ${diff > 0 ? 'up' : diff < 0 ? 'dn' : 'eq'}">${diff === 0 ? 'No change' : (diff > 0 ? '+' : '') + diff + ' hrs'}</span></div><div class="m">regular → requested</div></div>
        <div class="s"><div class="k"><i data-lucide="send"></i>Submitted</div><div class="v">${fmtDT(r.createdAt)}</div><div class="m">by ${esc(r.createdBy)}</div></div>
      </div>
      <div class="ta-rv-scroll">
        ${notes.length ? `<div class="ta-notes">${notes.join('')}</div>` : ''}
        <div class="ta-rv-lbl"><b>Requested time slots</b><span>Green = requested hours · grey bar = regular availability on that date</span></div>
        ${rowsHTML(ds.map(iso => ({ iso, row: r.days[iso], ref: regularRow(r.empId, iso) })), { ro: true, sumHead: 'Requested hours' })}
      </div>
      ${legendHTML({ chg: true, tot: `Requested <b>${hrs} hrs</b> <small>regular ${reg} hrs</small>` })}
      <div class="ta-rv-ft">${foot}</div>`;
    icons();
  }
  function rvClick(e) {
    const b = e.target.closest('[data-rv]'); if (!b || !RV) return;
    const act = b.dataset.rv, r = byId(RV.id);
    if (act === 'close') return closeReview();
    if (act === 'no') { RV.declining = true; renderReview(); const n = document.getElementById('taRvNote'); n && n.focus(); return; }
    if (act === 'back') { RV.declining = false; return renderReview(); }
    if (act === 'ok') { decide(r.id, true); RV.decided = 'approved'; RV.declining = false; renderReview(); return toast(`${first(empInfo(r.empId).name)}’s temporary availability approved — effective ${fmtRange(r.start, r.end)}`); }
    if (act === 'confirm-no') { decide(r.id, false, (document.getElementById('taRvNote') || {}).value || ''); RV.decided = 'declined'; RV.declining = false; renderReview(); return toast(`${first(empInfo(r.empId).name)}’s temporary availability request declined`); }
  }

  /* ---------- dashboard rows (Needing Action → Availability Request) ---------- */
  function dashRows() {
    const T = TODAY(), cut = addDays(T, -3);
    const list = recs().filter(r => r.source === 'employee' && (isPending(r) || ((r.status === 'approved' || r.status === 'declined') && r.decidedAt && r.decidedAt.slice(0, 10) >= cut)))
      .sort((a, b) => (isPending(b) - isPending(a)) || b.createdAt.localeCompare(a.createdAt));
    const pill = r => isPending(r) ? '<span class="sd-pill sd-pill--pending">Pending</span>'
      : r.status === 'approved' ? '<span class="sd-pill" style="background:#dcfce7;color:#15803d">Approved</span>' : '<span class="sd-pill" style="background:#fee2e2;color:#b91c1c">Declined</span>';
    const html = list.map(r => {
      const e = empInfo(r.empId), p = isPending(r);
      return `<div class="sd-row crq-row ta-drow ${p ? '' : 'done'}" data-atype="temporary"><img src="${esc(e.avatar)}" class="sd-avatar" alt="">
        <div class="sd-row-main"><div class="sd-row-pre"><span class="ta-type tmp"><i data-lucide="calendar-range"></i>Temporary availability</span></div>
          <div class="sd-row-name">${esc(e.name)}</div>
          <div class="sd-row-sub" title="${esc(fmtRange(r.start, r.end) + ' · ' + slotSummary(r))}">${fmtRange(r.start, r.end)} • ${plural(recDates(r).length, 'day')} • ${recHrs(r)} hrs</div>
          <div class="sd-row-sub ta-dsub" title="${esc(slotSummary(r))}">${esc(slotSummary(r))} • ${p ? 'submitted' : r.status} ${fmtS((p ? r.createdAt : r.decidedAt).slice(0, 10))}</div></div>
        <div class="sd-row-actions">${pill(r)}
          <button type="button" class="sd-icon-btn sd-icon-btn--blue" title="Review request" data-crq="ta|view|0|${r.id}"><i data-lucide="layout-grid"></i></button>
          ${p ? `<button type="button" class="sd-icon-btn sd-icon-btn--ok" title="Approve" data-crq="ta|ok|0|${r.id}"><i data-lucide="check"></i></button>
          <button type="button" class="sd-icon-btn sd-icon-btn--no" title="Decline" data-crq="ta|no|0|${r.id}"><i data-lucide="x"></i></button>` : ''}</div></div>`;
    }).join('');
    return { html, n: list.filter(isPending).length };
  }

  /* =====================================================================
     WEEK GRID (crew screens) — one row per weekday / date, 24 hourly cells.
     Drag a rectangle across rows to mark or clear hours; select a row to
     open the editor with time dropdowns. The row data is the single source
     of truth, so dragging and the dropdowns always agree.
       wgHTML(id, { rows:[{k,label,sub,title,row,ref,dis,w,badge}], sel, edit,
                    colHead, sumHead, refName, copyAllLabel, copyWd })
       wgBind(id, { get(k), set(k,row), setSel(k), rerender(), keys(), weekday(k) })
     ===================================================================== */
  const WG = {};
  const h12 = h => { const x = h % 24; return `${x % 12 || 12}${x < 12 ? 'a' : 'p'}`; };
  const pct = h => (h / 24 * 100).toFixed(4) + '%';
  function wgBind(id, api) { WG[id] = Object.assign(WG[id] || {}, { api }); }
  function wgHTML(id, o) {
    WG[id] = Object.assign(WG[id] || {}, { rows: o.rows, o });
    const head = `<div class="wg-head"><span class="rh">${o.colHead || 'Weekday'}</span><div class="hrs">${Array.from({ length: 24 }, (_, h) => `<span>${h12(h)}</span>`).join('')}</div><span class="rh">${o.sumHead || 'Your hours'}</span></div>`;
    return `<div class="wg-wrap"><div class="wg ${o.edit ? 'edit' : 'ro'}" data-wg="${id}">${head}${o.rows.map(r => wgRow(id, r, o)).join('')}</div></div>`;
  }
  function wgRow(id, r, o) {
    const rs = ranges(r.row), sel = o.edit && o.sel === r.k && !r.dis;
    const tag = !rs.length ? '<span class="vtag off">Unavailable</span>' : r.ref ? (sameRow(r.row, r.ref) ? `<span class="vtag">Same as ${o.refShort || 'regular'}</span>` : '<span class="vtag diff">Changed</span>') : '';
    const lab = o.edit && !r.dis ? `<button type="button" class="rlab" data-wgsel="${esc(r.k)}" aria-expanded="${sel}" title="Type exact times">` : '<div class="rlab">';
    const track = o.bars && !o.edit
      ? `<div class="bartrack"><div class="cells">${r.row.map((_, i) => `<i data-c="${i}"></i>`).join('')}</div>${rs.map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}" title="${tL(a)} – ${tL(b)}">${b - a >= 2 ? `${h12(a)} – ${h12(b)}` : ''}</b>`).join('')}${rs.length ? '' : '<span class="boff">Unavailable</span>'}</div>`
      : `<div class="cells">${r.row.map((v, i) => `<i data-c="${i}" class="${v && !r.dis ? 'on' : ''}"></i>`).join('')}</div>`;
    return `<div class="wg-row ${sel ? 'sel' : ''} ${r.dis ? 'dis' : ''} ${r.today ? 'today' : ''}" data-k="${esc(r.k)}">
      <div class="wg-line">
        ${lab}<b>${r.label}${r.badge || ''}</b><small>${r.dis ? 'Not in this request' : r.sub}</small>${o.edit && !r.dis ? '</button>' : '</div>'}
        <div class="trk">${track}
          <div class="refbar" ${r.ref ? `title="${esc((o.refName || 'Regular') + ': ' + rangeText(r.ref))}"` : ''}>${r.ref ? ranges(r.ref).map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}"></b>`).join('') : ''}</div></div>
        <div class="rsum">${r.dis ? '<span class="h">—</span>' : `<div class="r">${rangeShort(r.row)}</div><div class="h">${rowHrs(r.row)} hrs ${tag}</div>`}</div>
      </div>
      ${sel ? wgEditor(r, o) : ''}
    </div>`;
  }
  function wgEditor(r, o) {
    const rs = ranges(r.row), full = r.row.every(Boolean);
    const opts = (from, to, v) => { let s = ''; for (let h = from; h <= to; h++) s += `<option value="${h}" ${h === v ? 'selected' : ''}>${h === 24 ? '12:00 AM (midnight)' : tL(h)}</option>`; return s; };
    const tsel = (i, end, v, from, to, lbl) => `<span class="tsel"><i data-lucide="clock-3" class="ci"></i><select data-wgslot="${i}" data-end="${end}" aria-label="${lbl}">${opts(from, to, v)}</select><i data-lucide="chevron-down" class="cv"></i></span>`;
    return `<div class="wg-editor">
      <div><h3>${r.title || r.label}</h3>${r.ref ? `<div class="regl">${o.refName || 'Regular'}: ${rangeText(r.ref)}</div>` : ''}
        <div class="av" role="group" aria-label="Availability"><button type="button" class="ya" aria-pressed="${rs.length > 0}" data-wged="avail"><i data-lucide="check"></i>Available</button><button type="button" class="na" aria-pressed="${!rs.length}" data-wged="unavail"><i data-lucide="ban"></i>Unavailable</button></div></div>
      <div class="slots">
        ${rs.length ? rs.map(([s, e], i) => `<div class="slot"><span class="num">${i + 1}</span>${tsel(i, 0, s, 0, 23, `Slot ${i + 1} start`)}<span class="to">to</span>${tsel(i, 1, e, s + 1, 24, `Slot ${i + 1} end`)}<span class="dur">${e - s}h</span>
          <button type="button" class="xb" data-wged="rm" data-i="${i}" aria-label="Remove slot ${i + 1}" title="Remove slot"><i data-lucide="x"></i></button></div>`).join('')
          : `<div class="unav">Not available this day. Choose <b>Available</b> or drag on the grid to add hours.</div>`}
        <button type="button" class="addslot" data-wged="add" ${full ? 'disabled' : ''}><i data-lucide="plus"></i>Add time slot</button>
      </div>
      <div class="eact">
        ${r.ref ? `<button type="button" class="vbtn sm" data-wged="ref" ${sameRow(r.row, r.ref) ? 'disabled' : ''}><i data-lucide="rotate-ccw"></i>Use ${o.refShort || 'regular'} hours</button>` : ''}
        <button type="button" class="vbtn sm" data-wged="copyall"><i data-lucide="copy"></i>${o.copyAllLabel || 'Copy to every day'}</button>
        ${o.copyWd && r.w != null ? `<button type="button" class="vbtn sm" data-wged="copywd"><i data-lucide="copy"></i>Copy to every ${DAYS[r.w]}</button>` : ''}
        <button type="button" class="vbtn sm ghost" data-wged="close">Done</button>
      </div></div>`;
  }
  function wgEdit(id, op, btn) {
    const W = WG[id]; if (!W || !W.api) return;
    const k = W.o.sel, r = W.rows.find(x => x.k === k); if (!r) return;
    const row = W.api.get(k), rs = ranges(row);
    if (op === 'close') W.api.setSel(null);
    else if (op === 'unavail') W.api.set(k, emptyRow());
    else if (op === 'avail') { if (!rs.length) W.api.set(k, r.ref && rowHrs(r.ref) ? r.ref.slice() : rowOf(9, 17)); }
    else if (op === 'ref') W.api.set(k, r.ref.slice());
    else if (op === 'rm') { const w = rs[+btn.dataset.i]; const n = row.slice(); for (let h = w[0]; h < w[1]; h++) n[h] = false; W.api.set(k, n); }
    else if (op === 'add') {
      const last = rs.length ? rs[rs.length - 1][1] : 8, n = row.slice();
      const fits = s => s < 24 && !n.slice(Math.max(0, s - 1), Math.min(24, s + 3)).some(Boolean);
      let s = [last + 1, ...Array.from({ length: 24 }, (_, i) => i)].find(fits);
      if (s == null) s = n.findIndex(v => !v);
      if (s >= 0) { for (let h = s; h < Math.min(24, s + 2); h++) n[h] = true; W.api.set(k, n); }
    }
    else if (op === 'copyall') { W.api.keys().forEach(x => W.api.set(x, row.slice())); toast(W.o.copyAllLabel ? W.o.copyAllLabel.replace('Copy to', 'Copied to') : 'Copied to every day'); }
    else if (op === 'copywd') { W.api.keys().filter(x => W.api.weekday(x) === r.w).forEach(x => W.api.set(x, row.slice())); toast(`Copied to every ${DAYS_FULL[r.w]}`); }
    W.api.rerender();
  }
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-wg]'); if (!g) return;
    const id = g.dataset.wg, W = WG[id]; if (!W || !W.api) return;
    const s = e.target.closest('[data-wgsel]');
    if (s) { W.api.setSel(W.o.sel === s.dataset.wgsel ? null : s.dataset.wgsel); return W.api.rerender(); }
    const b = e.target.closest('[data-wged]'); if (b) wgEdit(id, b.dataset.wged, b);
  });
  document.addEventListener('change', e => {
    const s = e.target.closest && e.target.closest('select[data-wgslot]'); if (!s) return;
    const id = s.closest('[data-wg]').dataset.wg, W = WG[id]; if (!W || !W.api) return;
    const k = W.o.sel, rs = ranges(W.api.get(k)), i = +s.dataset.wgslot, v = +s.value, end = s.dataset.end === '1';
    if (!rs[i]) return;
    if (end) rs[i][1] = v; else { rs[i][0] = v; if (rs[i][1] <= v) rs[i][1] = Math.min(24, v + 1); }
    W.api.set(k, rowOf(...rs.flat()));
    W.api.rerender();
    const n = ranges(W.api.get(k)).length;
    const again = document.querySelector(`[data-wg="${id}"] select[data-wgslot="${Math.min(i, n - 1)}"][data-end="${end ? 1 : 0}"]`);
    if (again) again.focus();
  });
  /* rectangle drag: rows × hours, add when starting on an empty hour, remove when starting on a green one */
  let WD = null;
  document.addEventListener('pointerdown', e => {
    const c = e.target.closest && e.target.closest('.wg.edit .cells i'); if (!c) return;
    const rowEl = c.closest('.wg-row'); if (rowEl.classList.contains('dis')) return;
    const id = c.closest('.wg').dataset.wg, W = WG[id]; if (!W || !W.api) return;
    e.preventDefault();
    const vis = W.rows.filter(r => !r.dis).map(r => r.k), k = rowEl.dataset.k, ci = +c.dataset.c;
    WD = { id, el: c.closest('.wg'), vis, ar: vis.indexOf(k), ac: ci, mode: !W.api.get(k)[ci], snap: Object.fromEntries(vis.map(x => [x, W.api.get(x).slice()])) };
    wdPaint(WD.ar, ci);
  });
  document.addEventListener('pointermove', e => {
    if (!WD) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = el && el.closest && el.closest('.wg-row');
    if (!rowEl || !WD.el.contains(rowEl) || rowEl.classList.contains('dis')) return;
    const box = rowEl.querySelector('.cells'), b = box.getBoundingClientRect();
    const ci = Math.max(0, Math.min(23, Math.floor((e.clientX - b.left) / b.width * 24)));
    const ri = WD.vis.indexOf(rowEl.dataset.k); if (ri >= 0) wdPaint(ri, ci);
  });
  function wdPaint(ri, ci) {
    const W = WG[WD.id], r0 = Math.min(WD.ar, ri), r1 = Math.max(WD.ar, ri), c0 = Math.min(WD.ac, ci), c1 = Math.max(WD.ac, ci);
    WD.vis.forEach((k, idx) => {
      const a = WD.snap[k].slice();
      if (idx >= r0 && idx <= r1) for (let i = c0; i <= c1; i++) a[i] = WD.mode;
      W.api.set(k, a);
      const rowEl = [...WD.el.querySelectorAll('.wg-row')].find(x => x.dataset.k === k);
      if (rowEl) [...rowEl.querySelector('.cells').children].forEach((x, i) => x.classList.toggle('on', a[i]));
    });
  }
  const wdEnd = () => { if (!WD) return; const W = WG[WD.id], k = WD.vis[WD.ar]; WD = null; W.api.setSel(k); W.api.rerender(); };
  window.addEventListener('pointerup', wdEnd);
  window.addEventListener('pointercancel', wdEnd);

  /* =====================================================================
     TIME ENTRY view — the alternative to dragging on the grid.
     One row per weekday with start / end dropdowns (several slots per day),
     plus a "same hours for several days" panel that applies one set of
     hours to all days, weekdays, weekends or any days you pick.
       tlHTML(id, { rows:[{k,w,label,sub,row,ref,today}], refName, refShort })
       tlBind(id, { get(k), set(k,row), rerender(), keys(), weekday(k) })
     ===================================================================== */
  const TL = {};
  function tlBind(id, api) { TL[id] = Object.assign(TL[id] || {}, { api }); }
  const tlOpts = (from, to, v) => { let s = ''; for (let h = from; h <= to; h++) s += `<option value="${h}" ${h === v ? 'selected' : ''} ${h === 24 ? 'title="Midnight"' : ''}>${tL(h)}</option>`; return s; };
  function tlSlots(key, row, label) {
    const rs = ranges(row), full = row.every(Boolean), on = rs.length > 0;
    const sel = (i, end, v, from, to) => `<select data-tlslot="${i}" data-end="${end}" aria-label="${esc(label)} slot ${i + 1} ${end ? 'end' : 'start'}">${tlOpts(from, to, v)}</select>`;
    return `<div class="tl-ed">
      <button type="button" class="tl-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-tlact="toggle" title="${on ? 'Available — click to mark unavailable' : 'Unavailable — click to add hours'}" aria-label="${esc(label)} available"><i></i></button>
      ${on ? rs.map(([s, e], i) => `<span class="tl-slot">${sel(i, 0, s, 0, 23)}<span class="to">–</span>${sel(i, 1, e, s + 1, 24)}<button type="button" class="tl-rm" data-tlact="rm" data-i="${i}" aria-label="Remove slot ${i + 1}" title="Remove slot"><i data-lucide="x"></i></button></span>`).join('')
        + `<button type="button" class="tl-add" data-tlact="add" ${full ? 'disabled' : ''} title="Add another time slot" aria-label="Add time slot"><i data-lucide="plus"></i></button>`
        : '<span class="tl-off">Unavailable</span>'}
    </div>`;
  }
  const tlBar = (row, ref) => `<div class="tl-bar">${ranges(row).map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}"></b>`).join('')}${ref ? `<span class="tl-ref">${ranges(ref).map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}"></b>`).join('')}</span>` : ''}</div>`;
  function tlHTML(id, o) {
    const T = TL[id] = Object.assign(TL[id] || {}, { rows: o.rows, o });
    if (!T.tpl) T.tpl = rowOf(9, 17);
    if (!T.days) T.days = [0, 1, 2, 3, 4, 5, 6];
    const on = d => T.days.includes(d);
    const quick = (lbl, ds) => `<button type="button" data-tlquick="${ds.join(',')}" class="${T.days.length === ds.length && ds.every(on) ? 'on' : ''}">${lbl}</button>`;
    const order = [1, 2, 3, 4, 5, 6, 0];
    let h = `<div class="tl" data-tl="${id}">
      <section class="tl-all" data-tlrow="__tpl">
        <span class="tl-all-t"><i data-lucide="copy"></i>Same hours</span>
        ${tlSlots('__tpl', T.tpl, 'Same hours')}
        <span class="tl-for">for</span>
        <div class="tl-quick">${quick('All', [0, 1, 2, 3, 4, 5, 6])}${quick('Weekdays', [1, 2, 3, 4, 5])}${quick('Weekends', [0, 6])}</div>
        <div class="tl-days" role="group" aria-label="Days">${order.map(d => `<button type="button" data-tlday="${d}" aria-pressed="${on(d)}" class="${on(d) ? 'on' : ''}" title="${DAYS_FULL[d]}">${DAYS[d][0]}${DAYS[d][1]}</button>`).join('')}</div>
        <button type="button" class="vbtn primary sm" data-tlact="apply" ${T.days.length ? '' : 'disabled'}><i data-lucide="check-check"></i>Apply${T.days.length === 7 ? ' to all' : ` to ${T.days.length}`}</button>
      </section>
      <div class="tl-list">
        <div class="tl-head"><span>Day</span><span>Hours</span><span class="tl-ticks"><em>12a</em><em>6a</em><em>12p</em><em>6p</em><em>12a</em></span><span></span></div>`;
    o.rows.forEach(r => {
      const changed = r.ref && !sameRow(r.row, r.ref);
      h += `<div class="tl-row ${r.today ? 'today' : ''} ${changed ? 'chg' : ''}" data-tlrow="${esc(r.k)}">
        <div class="tl-day"><b>${DAYS_FULL[r.w]}</b>${r.today ? '<span class="wg-today">Today</span>' : ''}</div>
        ${tlSlots(r.k, r.row, r.label)}
        <div class="tl-sum">${tlBar(r.row, r.ref)}<span class="tl-h">${rowHrs(r.row) ? rowHrs(r.row) + 'h' : 'Off'}</span>${changed ? '<span class="tl-dot" title="Changed"></span>' : '<span class="tl-dot none"></span>'}</div>
        <div class="tl-x">
          <button type="button" class="tl-ib" data-tlact="copy" title="Copy ${esc(DAYS_FULL[r.w])} to all days" aria-label="Copy ${esc(DAYS_FULL[r.w])} to all days"><i data-lucide="copy"></i></button>
          ${r.ref ? `<button type="button" class="tl-ib" data-tlact="ref" ${changed ? '' : 'disabled'} title="Undo this day" aria-label="Undo ${esc(DAYS_FULL[r.w])}"><i data-lucide="rotate-ccw"></i></button>` : ''}
        </div>
      </div>`;
    });
    return h + '</div></div>';
  }
  function tlRow(T, key) { return key === '__tpl' ? { get: () => T.tpl, set: r => { T.tpl = r; }, ref: null } : { get: () => T.api.get(key), set: r => T.api.set(key, r), ref: (T.rows.find(x => x.k === key) || {}).ref }; }
  document.addEventListener('click', e => {
    const box = e.target.closest && e.target.closest('[data-tl]'); if (!box) return;
    const id = box.dataset.tl, T = TL[id]; if (!T || !T.api) return;
    const qd = e.target.closest('[data-tlquick]'); if (qd) { T.days = qd.dataset.tlquick.split(',').map(Number); return T.api.rerender(); }
    const dy = e.target.closest('[data-tlday]'); if (dy) { const d = +dy.dataset.tlday; T.days = T.days.includes(d) ? T.days.filter(x => x !== d) : T.days.concat(d); return T.api.rerender(); }
    const b = e.target.closest('[data-tlact]'); if (!b) return;
    const key = b.closest('[data-tlrow]').dataset.tlrow, R = tlRow(T, key), row = R.get(), rs = ranges(row), act = b.dataset.tlact;
    if (act === 'toggle') { if (rs.length) R.set(emptyRow()); else R.set(R.ref && rowHrs(R.ref) ? R.ref.slice() : rowOf(9, 17)); }
    if (act === 'avail') { if (!rs.length) R.set(R.ref && rowHrs(R.ref) ? R.ref.slice() : rowOf(9, 17)); }
    else if (act === 'unavail') R.set(emptyRow());
    else if (act === 'rm') { const w = rs[+b.dataset.i], n = row.slice(); for (let h = w[0]; h < w[1]; h++) n[h] = false; R.set(n); }
    else if (act === 'add') { const n = row.slice(), last = rs.length ? rs[rs.length - 1][1] : 8; let s = [last + 1, ...Array.from({ length: 24 }, (_, i) => i)].find(h => h < 24 && !n.slice(Math.max(0, h - 1), Math.min(24, h + 3)).some(Boolean)); if (s == null) s = n.findIndex(v => !v); if (s >= 0) { for (let h = s; h < Math.min(24, s + 2); h++) n[h] = true; R.set(n); } }
    else if (act === 'ref') R.set(R.ref.slice());
    else if (act === 'copy') { T.api.keys().forEach(k => T.api.set(k, row.slice())); toast('Copied to all days'); }
    else if (act === 'apply') { const ks = T.api.keys().filter(k => T.days.includes(T.api.weekday(k))); ks.forEach(k => T.api.set(k, T.tpl.slice())); toast(`Applied to ${ks.length === 7 ? 'all days' : plural(ks.length, 'day')}`); }
    T.api.rerender();
  });
  document.addEventListener('change', e => {
    const s = e.target.closest && e.target.closest('select[data-tlslot]'); if (!s) return;
    const box = s.closest('[data-tl]'), T = TL[box.dataset.tl]; if (!T || !T.api) return;
    const key = s.closest('[data-tlrow]').dataset.tlrow, R = tlRow(T, key), rs = ranges(R.get()), i = +s.dataset.tlslot, v = +s.value, end = s.dataset.end === '1';
    if (!rs[i]) return;
    if (end) rs[i][1] = v; else { rs[i][0] = v; if (rs[i][1] <= v) rs[i][1] = Math.min(24, v + 1); }
    R.set(rowOf(...rs.flat()));
    T.api.rerender();
    const n = ranges(R.get()).length;
    const again = [...document.querySelectorAll(`[data-tl="${box.dataset.tl}"] [data-tlrow]`)].find(x => x.dataset.tlrow === key);
    const sel = again && again.querySelector(`select[data-tlslot="${Math.min(i, n - 1)}"][data-end="${end ? 1 : 0}"]`); if (sel) sel.focus();
  });

  /* =====================================================================
     CREW — My availability › Temporary availability
     (crew app + Team Center). View: hero, periods, hourly view of the
     selected period. Request: dates (calendar), hours (week grid), review.
     ===================================================================== */
  let CH = { empId: null, list: 'current', selP: null, mode: 'view', R: null };
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fD = iso => `${DAYS[weekday(iso)]} ${toD(iso).getUTCDate()} ${MON[toD(iso).getUTCMonth()]}`;
  const fDY = iso => `${fD(iso)} ${toD(iso).getUTCFullYear()}`;
  const mondayOf = iso => addDays(iso, -((weekday(iso) + 6) % 7));
  const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  function phase(r) {
    const T = TODAY();
    if (r.status === 'pending') return r.end >= T ? 'pending' : 'past';
    if (r.status === 'declined') return 'declined';
    if (!isEff(r)) return 'past';
    if (r.end < T) return 'past';
    return r.start <= T ? 'active' : 'upcoming';
  }
  const tile = (iso, l, cls) => `<div class="dtile ${cls || ''}"><div class="cal"><div class="m">${MON[toD(iso).getUTCMonth()].toUpperCase()}</div><div class="d">${toD(iso).getUTCDate()}</div></div><div><div class="lbl">${l}</div><div class="val">${DAYS[weekday(iso)]}, ${toD(iso).getUTCFullYear()}</div></div></div>`;
  const bars = (row, col, labels) => ranges(row).map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)};background:${col}">${labels && b - a >= 2 ? `${h12(a)}–${h12(b)}` : ''}</b>`).join('');
  const refBars = row => ranges(row).map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}"></b>`).join('');

  /* the strip + main action live in the page's top row (right side), next to the tabs */
  function tvTop(html) { if (CH.ctx && CH.ctx.top) CH.ctx.top.innerHTML = html; return ''; }
  /* role: 'crew' (own availability, needs approval) | 'manager' (Schedule Pad pop-up: assigns directly, approves requests) */
  const isMgr = () => !!(CH.ctx && CH.ctx.role === 'manager');
  const EN = () => first(empInfo(CH.empId).name);
  function renderCrew(main, ctx) {
    const role = ctx.role || 'crew';
    if (!same(CH.empId, ctx.empId) || CH.role !== role) CH = { empId: ctx.empId, role, list: 'current', selP: null, mode: 'view', R: null };
    CH.main = main; CH.ctx = ctx;
    if (!main._tvBound) {
      main._tvBound = true;
      main.addEventListener('click', tvClick);
      main.addEventListener('input', e => { if (e.target.id === 'tvReason' && CH.R) CH.R.reason = e.target.value; });
    }
    if (ctx.top && !ctx.top._tvBound) { ctx.top._tvBound = true; ctx.top.addEventListener('click', e => { if (S_TAB_TEMP()) tvClick(e); }); }
    if (ctx.top) ctx.top.innerHTML = '';
    main.innerHTML = CH.mode === 'request' ? tvRequest() : tvView();
    if (CH.mode === 'request' && window.AVED) AVED.mount(main.querySelector('#tvEd'), 'tvr', reqCfg());
    icons();
  }
  const crewRerender = () => { if (CH.main) renderCrew(CH.main, CH.ctx); };
  const S_TAB_TEMP = () => !!(CH.main && !CH.main.hidden);

  /* ---------- view ---------- */
  function tvView() {
    const mine = forEmp(CH.empId).filter(r => r.status !== 'replaced' || recDates(r).length);
    const a = mine.filter(r => phase(r) === 'active').sort((x, y) => x.start.localeCompare(y.start))[0];
    const cur = mine.filter(r => ['active', 'upcoming', 'pending'].includes(phase(r))).sort((x, y) => x.start.localeCompare(y.start));
    const past = mine.filter(r => ['past', 'declined'].includes(phase(r))).sort((x, y) => y.start.localeCompare(x.start));
    const list = CH.list === 'current' ? cur : past;
    if (!list.find(r => r.id === CH.selP)) CH.selP = (list.find(r => phase(r) === 'active') || list[0] || {}).id || null;
    const sel = list.find(r => r.id === CH.selP);
    if (window.AVED) return tvSplit(cur, past, list, sel);
    return `<div class="tv">
      ${tvTop(`<button type="button" class="vbtn primary" data-tv="new"><i data-lucide="calendar-plus"></i>${isMgr() ? 'Add temporary availability' : 'Request temporary availability'}</button>`)}
      <section class="v2-card">
        <div class="tv-sech"><h2><i data-lucide="calendar-range"></i>${isMgr() ? esc(EN()) + '’s temporary availability' : 'Your temporary availability'} <span class="v2-count">${list.length}</span></h2><span class="grow"></span>
          <div class="vseg" role="group" aria-label="Filter">
            <button type="button" aria-pressed="${CH.list === 'current'}" data-tvlist="current">Current &amp; upcoming (${cur.length})</button>
            <button type="button" aria-pressed="${CH.list === 'past'}" data-tvlist="past">Past (${past.length})</button></div></div>
        <div class="tv-plist">${list.length ? list.map(tvCard).join('') : `<div class="tv-empty">${CH.list === 'current' ? (isMgr() ? `No temporary availability coming up for ${esc(EN())}. Use <b>Add temporary availability</b> to set different hours for specific dates.` : 'No temporary availability coming up. Use <b>Request temporary availability</b> when you need different hours.') : 'Nothing here yet.'}</div>`}</div>
      </section>
      ${sel ? tvHours(sel) : ''}
    </div>`;
  }
  /* Team Center (crew): periods on the left, the selected period's hours on the right */
  function tvSplit(cur, past, list, sel) {
    return `<div class="tv">
      ${tvTop(`<button type="button" class="vbtn primary" data-tv="new"><i data-lucide="calendar-plus"></i>${isMgr() ? 'Add temporary availability' : 'Request temporary availability'}</button>`)}
      <div class="tv-split">
        <aside class="v2-card tv-side">
          <h2>${isMgr() ? esc(EN()) + '’s temporary availability' : 'Your temporary availability'}</h2>
          <div class="vseg tv-seg" role="group" aria-label="Filter">
            <button type="button" aria-pressed="${CH.list === 'current'}" data-tvlist="current">Current &amp; upcoming (${cur.length})</button>
            <button type="button" aria-pressed="${CH.list === 'past'}" data-tvlist="past">Past (${past.length})</button></div>
          <div class="tv-mlist">${list.length ? list.map(tvMini).join('') : `<div class="tv-empty">${CH.list === 'current' ? (isMgr() ? `Nothing coming up for ${esc(EN())}. Use <b>Add temporary availability</b> to set different hours for specific dates.` : 'Nothing coming up. Use <b>Request temporary availability</b> when you need different hours.') : 'Nothing here yet.'}</div>`}</div>
        </aside>
        ${sel ? tvDetail(sel) : `<section class="v2-card tv-detail tv-none"><i data-lucide="calendar-range"></i><b>No temporary availability</b><span>${isMgr() ? `Set different hours for ${esc(EN())} on specific dates — it takes priority over regular hours on those dates.` : 'When you need different hours for a few days, request it here — your manager approves it before it applies.'}</span></section>`}
      </div>
    </div>`;
  }
  const tvTone = ph => ph === 'pending' ? 'pend' : (ph === 'past' || ph === 'declined') ? 'past' : '';
  function tvChip(r) {
    const ph = phase(r), mgr = r.source === 'manager';
    return {
      active: `<span class="vchip active">In effect${mgr ? ' · Assigned' : ''}</span>`,
      upcoming: `<span class="vchip active">${mgr ? 'Assigned' : 'Approved'} · starts ${fD(r.start)}</span>`,
      pending: `<span class="vchip pending">${isMgr() ? 'Waiting for your approval' : 'Waiting for manager'}</span>`,
      declined: '<span class="vchip declined">Declined</span>',
      past: `<span class="vchip past">${r.status === 'pending' ? 'Expired' : isEff(r) ? 'Ended' : STATUS[r.status]}</span>`,
    }[ph];
  }
  function tvMini(r) {
    const sel = CH.selP === r.id, a = toD(r.start), b = toD(r.end), sm = a.getUTCMonth() === b.getUTCMonth();
    const m = sm ? MON[a.getUTCMonth()].toUpperCase() : `${MON[a.getUTCMonth()]}–${MON[b.getUTCMonth()]}`.toUpperCase();
    const d = r.start === r.end ? a.getUTCDate() : `${a.getUTCDate()}–${b.getUTCDate()}`;
    return `<article class="tv-mini ${sel ? 'is-sel' : ''} ${tvTone(phase(r))} ${r.source === 'manager' ? 'mgr' : ''}" data-tv="pick" data-id="${r.id}" tabindex="0" aria-pressed="${sel}">
      <div class="cal"><div class="m">${m}</div><div class="d">${d}</div></div>
      <div class="tx"><b title="${esc(r.reason || 'Temporary availability')}">${esc(r.reason || 'Temporary availability')}</b><span>${plural(recDates(r).length, 'day')} · ${recHrs(r)} hrs</span>${tvChip(r)}</div>
    </article>`;
  }
  function tvDetail(r) {
    const ph = phase(r), mgr = r.source === 'manager', ds = recDates(r), reg = ds.reduce((x, k) => x + rowHrs(regularRow(r.empId, k)), 0);
    const who = isMgr() ? (mgr ? 'Assigned by ' + esc(r.createdBy) : `Requested by ${esc(EN())}${ph === 'pending' ? ' · sent ' + fD(r.createdAt.slice(0, 10)) : ''}`)
      : mgr ? 'Set by your manager' : ph === 'pending' ? 'Sent ' + fD(r.createdAt.slice(0, 10)) : 'Requested by you';
    const act = isMgr() ? (ph === 'pending' ? `<button type="button" class="vbtn sm" data-tv="rvw" data-id="${r.id}"><i data-lucide="eye"></i>Review</button><button type="button" class="vbtn sm ok" data-tv="approve" data-id="${r.id}"><i data-lucide="check"></i>Approve</button><button type="button" class="vbtn sm ghost danger" data-tv="decline" data-id="${r.id}"><i data-lucide="x"></i>Decline</button>`
        : (ph === 'active' || ph === 'upcoming') ? `<button type="button" class="vbtn sm" data-tv="edit" data-id="${r.id}"><i data-lucide="pencil"></i>Edit</button><button type="button" class="vbtn sm ghost danger" data-tv="withdraw" data-id="${r.id}"><i data-lucide="trash-2"></i>Remove</button>` : '')
      : ph === 'pending' ? `<button type="button" class="vbtn sm" data-tv="edit" data-id="${r.id}"><i data-lucide="pencil"></i>Edit</button><button type="button" class="vbtn sm ghost danger" data-tv="withdraw" data-id="${r.id}"><i data-lucide="trash-2"></i>Withdraw</button>`
      : ph === 'upcoming' ? `<button type="button" class="vbtn sm" data-tv="edit" data-id="${r.id}" title="Changes go to your manager for approval"><i data-lucide="pencil"></i>Edit</button><button type="button" class="vbtn sm ghost danger" data-tv="withdraw" data-id="${r.id}"><i data-lucide="x-circle"></i>Cancel</button>`
      : ph === 'active' ? `<span class="tv-dnote">${mgr ? 'Set by your manager — ask them to change it' : 'In effect — ask your manager to change it'}</span>` : '';
    const tone = ph === 'pending' ? 'pending' : (ph === 'past' || ph === 'declined') ? 'past' : '';
    return `<section class="v2-card tv-detail">
      <div class="tv-dh"><div class="min-w-0"><h2>${esc(r.reason || 'Temporary availability')} ${tvChip(r)}</h2>
          <p>${fD(r.start)} – ${fD(r.end)} · ${plural(ds.length, 'day')} · ${recHrs(r)} hrs · ${who}</p>
          ${ph === 'declined' && r.note ? `<p class="mnote"><b>${isMgr() ? 'Your note' : 'Manager’s note'}:</b> “${esc(r.note)}”</p>` : ''}</div>
        <span class="grow"></span><div class="tv-dact">${act}</div></div>
      <div class="tv-dbody">${AVED.viewHTML({ keys: ds.map(k => dateKey(k)), get: k => r.days[k], ref: k => regularRow(r.empId, k), refShort: 'regular', dayHead: 'Day', sumHead: 'Hours', dateRows: true, flat: true, tone })}</div>
      <div class="tv-dfoot"><div class="vlegend"><span><i class="vsw" style="background:${tone === 'pending' ? 'var(--a-pending)' : tone === 'past' ? 'var(--a-faint)' : 'var(--a-avail)'}"></i>${ph === 'pending' ? 'Requested hours — waiting for approval' : ph === 'declined' ? 'Requested hours — declined' : isMgr() ? 'Hours on these days' : 'Your hours on these days'}</span><span><i class="vsw" style="border:1px dashed var(--a-muted);background:transparent"></i>${isMgr() ? 'Regular hours' : 'Your regular hours'}</span></div>
        <span class="grow"></span><div class="ae-total"><span>Total</span><b>${recHrs(r)} hrs</b><em>regular ${reg} hrs</em></div></div>
    </section>`;
  }
  function tvHero(r) {
    const T = TODAY(), n = daysBetween(r.start, r.end) + 1, di = daysBetween(r.start, T), tr = r.days[T] || emptyRow();
    return `<section class="v2-card tv-hero">
      <div class="l">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="tv-live"><i></i>In effect now</span>${r.source === 'manager' ? `<span class="vchip manager"><i data-lucide="user-cog"></i>${isMgr() ? 'Set by manager' : 'Set by your manager'}</span>` : isMgr() ? `<span class="vchip info"><i data-lucide="send"></i>Requested by ${esc(EN())}</span>` : ''}</div>
        <div class="tv-range">${tile(r.start, 'Starts')}<span class="tv-arrow"><i data-lucide="arrow-right"></i></span>${tile(r.end, 'Ends')}
          <div style="margin-left:auto;text-align:right"><div style="font-size:22px;font-weight:700">${plural(n, 'day')}</div><div style="font-size:12px;color:var(--a-muted)">${recHrs(r)} hrs total</div></div></div>
        <div class="tv-prog" aria-label="Day ${di + 1} of ${n}">${Array.from({ length: n }, (_, i) => `<span class="${i < di ? 'done' : i === di ? 'today' : ''}"></span>`).join('')}</div>
      </div>
      <div class="r">
        <p class="tv-today-h"><b style="color:var(--a-text)">Today · ${fD(T)}</b><span>${rowHrs(tr)} hrs</span></p>
        <div class="tv-big24">${ranges(tr).map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}"></b>`).join('')}</div>
        <div class="tv-ticks"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>
        <div class="tv-tlist">${ranges(tr).length ? ranges(tr).map(([a, b]) => `<div><span>${tL(a)} – ${tL(b)}</span><em>${b - a} hrs</em></div>`).join('') : '<div><span>Unavailable today</span></div>'}
          <div class="reg"><em>Regular on ${DAYS[weekday(T)]}</em><em>${rangeShort(regularRow(r.empId, T))}</em></div></div>
      </div></section>`;
  }
  function tvCard(r) {
    const ph = phase(r), n = recDates(r).length, sel = CH.selP === r.id, mgr = r.source === 'manager';
    const chip = {
      active: '<span class="vchip active">In effect</span>',
      upcoming: `<span class="vchip active">${mgr ? 'Assigned' : 'Approved'} · starts ${fD(r.start)}</span>`,
      pending: `<span class="vchip pending"><i data-lucide="clock"></i>${isMgr() ? 'Waiting for your approval' : 'Waiting for manager'}</span>`,
      declined: '<span class="vchip declined">Declined</span>',
      past: `<span class="vchip past">${r.status === 'pending' ? 'Expired' : isEff(r) ? 'Ended' : STATUS[r.status]}</span>`,
    }[ph];
    const cls = ph === 'pending' ? 'pend' : (ph === 'past' || ph === 'declined') ? 'past' : mgr ? 'mgr' : '';
    const who = isMgr()
      ? (mgr ? 'Assigned by ' + esc(r.createdBy) : `Requested by ${esc(EN())}${ph === 'pending' ? ' · sent ' + fD(r.createdAt.slice(0, 10)) : ''}`)
      : (mgr ? 'Set by your manager' : ph === 'pending' ? 'Sent ' + fD(r.createdAt.slice(0, 10)) : 'Requested by you');
    return `<article class="tv-pcard ${ph === 'active' ? 'is-active' : ph === 'pending' ? 'is-pending' : ''} ${sel ? 'is-sel' : ''}" data-tv="pick" data-id="${r.id}" tabindex="0" aria-pressed="${sel}">
      <div class="tv-prow">
        <div class="tv-range" style="margin:0;gap:10px">${tile(r.start, 'Start', cls)}<span class="tv-arrow"><i data-lucide="arrow-right"></i></span>${tile(r.end, 'End', cls)}</div>
        <div class="tv-pinfo"><b>${esc(r.reason || 'Temporary availability')}</b>
          <div class="s">${plural(n, 'day')} · ${recHrs(r)} hrs · ${who}</div>
          ${ph === 'declined' && r.note ? `<div class="mnote"><b>${isMgr() ? 'Your note' : 'Manager’s note'}:</b> “${esc(r.note)}”</div>` : ''}</div>
        <div class="tv-pchips">${chip}${mgr ? '<span class="vchip manager"><i data-lucide="user-cog"></i>Assigned</span>' : ''}</div>
        <div class="tv-pact">
          ${isMgr() ? (ph === 'pending' ? `<button type="button" class="vbtn sm" data-tv="rvw" data-id="${r.id}"><i data-lucide="eye"></i>Review</button><button type="button" class="vbtn sm ok" data-tv="approve" data-id="${r.id}"><i data-lucide="check"></i>Approve</button><button type="button" class="vbtn sm ghost danger" data-tv="decline" data-id="${r.id}"><i data-lucide="x"></i>Decline</button>`
            : (ph === 'active' || ph === 'upcoming') ? `<button type="button" class="vbtn sm" data-tv="edit" data-id="${r.id}"><i data-lucide="pencil"></i>Edit</button><button type="button" class="vbtn sm ghost danger" data-tv="withdraw" data-id="${r.id}"><i data-lucide="trash-2"></i>Remove</button>` : '') : ''}
          ${!isMgr() && ph === 'pending' ? `<button type="button" class="vbtn sm" data-tv="edit" data-id="${r.id}"><i data-lucide="pencil"></i>Edit</button><button type="button" class="vbtn sm ghost danger" data-tv="withdraw" data-id="${r.id}"><i data-lucide="trash-2"></i>Withdraw</button>` : ''}
          ${!isMgr() && ph === 'upcoming' ? `<button type="button" class="vbtn sm" data-tv="edit" data-id="${r.id}" title="Changes go to your manager for approval"><i data-lucide="pencil"></i>Edit</button><button type="button" class="vbtn sm ghost danger" data-tv="withdraw" data-id="${r.id}"><i data-lucide="x-circle"></i>Cancel</button>` : ''}
          <span class="tv-selhint">${sel ? '<i data-lucide="check"></i>Showing details below' : 'Show details'}</span>
        </div>
      </div>
    </article>`;
  }
  function tvHours(r) {
    const ph = phase(r), col = ph === 'pending' ? 'var(--a-pending)' : (ph === 'past' || ph === 'declined') ? 'var(--a-faint)' : 'var(--a-temp)';
    const ds = recDates(r), T = TODAY(), reg = ds.reduce((x, k) => x + rowHrs(regularRow(r.empId, k)), 0);
    return `<section class="v2-card"><div class="tv-sech"><h2><i data-lucide="clock-3"></i>Hourly availability <small>${esc(r.reason || fmtRange(r.start, r.end))}</small></h2><span class="grow"></span>
        <span class="sub2">${fD(r.start)} – ${fD(r.end)} · ${plural(ds.length, 'day')} · <b style="color:var(--a-text)">${recHrs(r)} hrs</b> (regular ${reg} hrs)</span></div>
      ${window.AVED ? `<div class="tv-strip">${AVED.viewHTML({ keys: ds.map(k => dateKey(k)), get: k => r.days[k], ref: k => regularRow(r.empId, k), refShort: 'regular', sumHead: 'Hours', tone: ph === 'pending' ? 'pending' : (ph === 'past' || ph === 'declined') ? 'past' : '' })}
        <div class="vlegend" style="margin-top:12px"><span><i class="vsw" style="background:${ph === 'pending' ? 'var(--a-pending)' : (ph === 'past' || ph === 'declined') ? 'var(--a-faint)' : 'var(--a-avail)'}"></i>${ph === 'pending' ? 'Requested hours — waiting for approval' : ph === 'declined' ? 'Requested hours — declined' : isMgr() ? 'Hours on these days' : 'Your hours on these days'}</span><span><i class="vsw" style="border:1px dashed var(--a-primary);background:transparent"></i>${isMgr() ? 'Regular hours' : 'Your regular hours'}</span><span><span class="vtag diff">Changed</span>Differs from regular</span></div></div></section>` : `
      <div class="tv-strip">
        <div class="vlegend"><span><i class="vsw" style="background:${col}"></i>${ph === 'pending' ? 'Requested hours — waiting for approval' : ph === 'declined' ? 'Requested hours — declined' : isMgr() ? 'Hours on these days' : 'Your hours on these days'}</span><span><i class="vsw" style="background:var(--a-ref);height:4px"></i>${isMgr() ? 'Regular hours' : 'Your regular hours'}</span></div>
        <div class="wg-wrap" style="margin-top:10px"><div class="wg ro" style="min-width:760px">
          <div class="wg-head"><span class="rh">Day</span><div class="hrs">${Array.from({ length: 24 }, (_, h) => `<span>${h12(h)}</span>`).join('')}</div><span class="rh">Hours</span></div>
          ${ds.map(k => { const row = r.days[k], ref = regularRow(r.empId, k), sm = sameRow(row, ref);
            return `<div class="wg-row ${k === T ? 'sel' : ''}"><div class="wg-line">
              <div class="rlab"><b>${DAYS[weekday(k)]} ${k === T ? '<span class="vtag diff">Today</span>' : ''}</b><small>${fDY(k).slice(4)}</small></div>
              <div class="trk"><div class="tv-htrack">${bars(row, col, true)}${rowHrs(row) ? '' : '<span class="tv-hoff">Unavailable</span>'}</div><div class="refbar">${refBars(ref)}</div></div>
              <div class="rsum one"><b>${rowHrs(row) ? rowHrs(row) + ' hrs' : 'Off'}</b><span class="vtag">${sm ? 'Same as regular' : 'Regular: ' + rangeShort(ref)}</span></div>
            </div></div>`; }).join('')}
        </div></div></div></section>`}`;
  }
  /* one date as a row of the hours editor / timeline */
  const dateKey = k => { const w = weekday(k), d = toD(k).getUTCDate(), m = MON[toD(k).getUTCMonth()];
    return { k, w, today: k === TODAY(), label: DAYS_FULL[w], sub: `${d} ${m} ${k.slice(0, 4)}`, short: DAYS[w], date: `${d} ${m}`, title: `${DAYS_FULL[w]}, ${d} ${m}`, chip: String(d) }; };

  /* ---------- request ---------- */
  const minReq = () => { const R = CH.R, o = R && R.editId && byId(R.editId); return isMgr() ? (o && o.start < TODAY() ? o.start : TODAY()) : addDays(TODAY(), CREW_NOTICE); };
  function newReq(r) {
    const T = TODAY();
    const R = { start: r ? r.start : '', end: r ? r.end : '', reason: r ? r.reason || '' : '', editId: r ? r.id : null, pat: {}, cells: {}, sel: null, week: 0, pop: null, calBase: null, hover: null };
    for (let w = 0; w < 7; w++) R.pat['p' + w] = regularRow(CH.empId, addDays(T, (w - weekday(T) + 7) % 7 || 7));
    if (r) Object.keys(r.days).forEach(k => { R.cells[k] = r.days[k].slice(); });
    R.base = r ? JSON.stringify({ s: r.start, e: r.end, d: r.days, re: r.reason || '' }) : null;
    CH.R = R; reqSync();
    if (window.AVED) AVED.reset('tvr');
  }
  const reqDates = () => { const R = CH.R; if (!R.start || !R.end || R.end < R.start) return []; return isoRange(R.start, R.end); };
  function reqSync() { const R = CH.R; reqDates().forEach(k => { if (!R.cells[k]) R.cells[k] = R.pat['p' + weekday(k)].slice(); }); }
  function reqWeeks() { const R = CH.R, o = []; for (let m = mondayOf(R.start); m <= R.end; m = addDays(m, 7)) o.push(m); return o; }
  function reqRows() {
    const R = CH.R, ds = reqDates();
    if (!ds.length) return [1, 2, 3, 4, 5, 6, 0].map(w => ({ k: 'p' + w, w, label: DAYS_FULL[w] + 's', title: 'Every ' + DAYS_FULL[w], sub: 'Weekly pattern', row: R.pat['p' + w], ref: regularRow(CH.empId, addDays(TODAY(), (w - weekday(TODAY()) + 7) % 7 || 7)) }));
    const mk = k => ({ k, w: weekday(k), label: DAYS[weekday(k)], title: `${DAYS_FULL[weekday(k)]}, ${fmtS(k)}`, sub: fmtS(k), row: R.cells[k] || emptyRow(), ref: regularRow(CH.empId, k), badge: k === TODAY() ? ' <span class="vtag diff">Today</span>' : '' });
    if (ds.length < 7) return ds.map(mk);
    const wk = reqWeeks(); R.week = Math.min(R.week, wk.length - 1);
    return isoRange(wk[R.week], addDays(wk[R.week], 6)).map(k => { const x = mk(k); x.dis = k < R.start || k > R.end; if (x.dis) x.row = emptyRow(); return x; });
  }
  const reqGet = k => k[0] === 'p' ? CH.R.pat[k] : CH.R.cells[k];
  const reqSet = (k, row) => { if (k[0] === 'p') CH.R.pat[k] = row; else CH.R.cells[k] = row; };
  function reqIssues() {
    const R = CH.R, ds = reqDates(), out = { err: '', warn: [] };
    if (!ds.length) return out;
    if (ds.length > MAX_DAYS) out.err = `Temporary availability can cover up to ${MAX_DAYS} days (you picked ${ds.length}). For a lasting change, request a change to your regular availability instead.`;
    const ov = recs().filter(r => same(r.empId, CH.empId) && r.id !== R.editId && (isPending(r) || (isEff(r) && r.end >= TODAY())) && recDates(r).some(k => k >= R.start && k <= R.end));
    ov.forEach(r => out.warn.push(isMgr()
      ? (isPending(r) ? `${esc(EN())} has a pending request for <b>${fD(r.start)} – ${fD(r.end)}</b>. It stays pending — if you approve it later, it takes priority on its dates.`
        : `Overlaps temporary availability <b>${fD(r.start)} – ${fD(r.end)}</b>. Saving replaces it on the overlapping dates.`)
      : `You already have ${isPending(r) ? 'a pending request' : 'temporary availability'} for <b>${fD(r.start)} – ${fD(r.end)}</b>. If this request is approved, it replaces those hours on the overlapping dates.`));
    return out;
  }
  function tvRequest() {
    const R = CH.R, ds = reqDates(), n = ds.length, iss = reqIssues();
    const reqH = ds.reduce((t, k) => t + rowHrs(R.cells[k]), 0), regH = ds.reduce((t, k) => t + rowHrs(regularRow(CH.empId, k)), 0);
    const ms = minReq(), nm = addDays(mondayOf(TODAY()), 7);
    const q = (a, b, lbl) => `<button type="button" class="q ${R.start === a && R.end === b ? 'on' : ''}" data-tvq="${a}|${b}">${lbl}</button>`;
    wgBind('tvr', { get: reqGet, set: reqSet, setSel: k => { CH.R.sel = k; }, rerender: crewRerender,
      keys: () => ds.length ? ds : Object.keys(R.pat), weekday: k => k[0] === 'p' ? +k.slice(1) : weekday(k) });
    return `<div class="tv">
      <section class="v2-card tv-merged"><div class="tv-head">
        <div><h1>${isMgr() ? (R.editId ? 'Edit temporary availability' : `Add temporary availability for ${esc(EN())}`) : R.editId ? (isEff(byId(R.editId)) ? 'Change upcoming temporary availability' : 'Edit request') : 'Request temporary availability'}</h1><p>Choose your dates, then set the hours you can work on each day.</p></div>
        <span class="grow"></span>
        <button type="button" class="vbtn ghost" data-tv="cancel">Cancel</button>
        <button type="button" class="vbtn primary" data-tv="review" ${n && !iss.err ? '' : 'disabled'} title="${n ? '' : 'Pick a start and end date first'}"><i data-lucide="${isMgr() ? 'check' : 'send'}"></i>${isMgr() ? 'Review &amp; save' : 'Review &amp; submit'}</button>
      </div>
      <div class="tv-step">
        <div class="tv-dates">
          <div class="tv-field"><label>Start date <i>*</i></label><button type="button" class="tv-dbtn ${R.pop === 'start' ? 'on' : ''}" data-tvpop="start"><i data-lucide="calendar"></i><span>${R.start ? `<span class="v">${fD(R.start)}</span><small>${R.start.slice(0, 4)}</small>` : '<span class="ph">Select start date</span>'}</span></button></div>
          <span class="tv-arrow" style="padding-bottom:12px"><i data-lucide="arrow-right"></i></span>
          <div class="tv-field"><label>End date <i>*</i></label><button type="button" class="tv-dbtn ${R.pop === 'end' ? 'on' : ''}" data-tvpop="end"><i data-lucide="calendar"></i><span>${R.end ? `<span class="v">${fD(R.end)}</span><small>${R.end.slice(0, 4)}</small>` : '<span class="ph">Select end date</span>'}</span></button></div>
          <div class="tv-field"><label>Quick pick</label><div class="tv-quick">${q(ms, addDays(ms, 3), 'Next 4 days')}${q(nm, addDays(nm, 6), 'Next week')}${q(nm, addDays(nm, 13), 'Next 2 weeks')}
            ${n ? '<button type="button" class="q" data-tvq="clear" style="background:transparent"><i data-lucide="x"></i>Clear</button>' : ''}</div></div>
          <div class="tv-field tv-reason"><label>Reason <span>(optional — ${isMgr() ? 'shown to the employee' : 'your manager sees this'})</span></label><input id="tvReason" value="${esc(R.reason)}" placeholder="e.g. Final exams, travelling" maxlength="80"></div>
          ${R.pop ? tvCalendar() : ''}
        </div>
        ${n || iss.warn.length ? `<div class="tv-notes">
          ${iss.err ? `<div class="vnote err"><i data-lucide="alert-circle"></i><div>${iss.err}</div></div>`
            : n ? `<div class="vnote info"><i data-lucide="info"></i><div><b>${fD(ds[0])} → ${fDY(ds[n - 1])}</b> · ${plural(n, 'day')}. ${n <= 7 ? 'Only these dates are shown below.' : 'Shown one week at a time — use the week tabs to move between weeks.'} ${isMgr() ? '<b>No approval needed</b> — it takes priority over regular hours on these dates as soon as you save.' : 'Your manager approves it before it replaces your regular hours on these dates.'}</div></div>` : ''}
          ${iss.warn.map(w => `<div class="vnote warn"><i data-lucide="alert-triangle"></i><div>${w}</div></div>`).join('')}</div>` : ''}
      </section>
      <section class="v2-card tv-step tv-hours">
        <div class="tv-sth"><span class="n"><i data-lucide="clock-3"></i></span><h2>Set your hours</h2>
          <span class="tv-sub">${n ? `${plural(n, 'day')} · only the dates you picked are shown` : 'No dates picked yet — showing every weekday filled with your regular hours. Pick dates and only those days are shown.'}</span></div>
        <div class="v2-tools">
          <div class="v2-imode" role="tablist" aria-label="How to set hours">
            <button type="button" role="tab" data-imode="drag" aria-selected="${CH.imode !== 'time'}"><i data-lucide="mouse-pointer-2"></i>Drag on grid</button>
            <button type="button" role="tab" data-imode="time" aria-selected="${CH.imode === 'time'}"><i data-lucide="clock-3"></i>Enter times</button></div>
          ${window.AVED ? AVED.toolsHTML('tvr', reqCfg()) : ''}</div>
        ${n > 7 ? tvWeekTabs() : ''}
        <div class="v2-gridbox" id="tvEd"></div>
      </section>
    </div>`;
  }
  /* the hours editor (avail-editor.js) for the request: weekly pattern before dates, the picked dates after */
  function reqKeys() {
    const R = CH.R, ds = reqDates();
    if (!ds.length) return [1, 2, 3, 4, 5, 6, 0].map(w => ({ k: 'p' + w, w, sub: 'Every ' + DAYS_FULL[w] }));
    if (ds.length <= 7) return ds.map(dateKey);
    const wk = reqWeeks(); R.week = Math.min(R.week, wk.length - 1);
    return isoRange(wk[R.week], addDays(wk[R.week], 6)).filter(k => k >= R.start && k <= R.end).map(dateKey);
  }
  const patRef = w => regularRow(CH.empId, addDays(TODAY(), (w - weekday(TODAY()) + 7) % 7 || 7));
  function reqCfg() {
    const n = reqDates().length;
    return { keys: reqKeys(), get: reqGet, set: reqSet, ref: k => k[0] === 'p' ? patRef(+k.slice(1)) : regularRow(CH.empId, k),
      mode: CH.imode === 'time' ? 'time' : 'drag', refShort: 'regular', refLegend: isMgr() ? 'Regular hours' : 'Your regular hours',
      totalLabel: n ? (isMgr() ? 'Hours on these days' : 'Requested hours') : 'Weekly pattern', own: !isMgr(), onChange: crewRerender };
  }
  function tvWeekTabs() {
    const R = CH.R, wk = reqWeeks();
    return `<div class="tv-wtabs" role="group" aria-label="Weeks">${wk.map((m, i) => {
      let c = 0, h = 0; isoRange(m, addDays(m, 6)).forEach(k => { if (k >= R.start && k <= R.end) { c++; h += rowHrs(R.cells[k]); } });
      return `<button type="button" aria-pressed="${i === R.week}" data-tvweek="${i}"><b>Week ${i + 1} · ${fmtS(m)} – ${fmtS(addDays(m, 6))}</b><small>${plural(c, 'day')} · ${h} hrs</small></button>`; }).join('')}
      ${wk.length > 1 ? '<button type="button" class="cp" data-tv="copyweek"><b><i data-lucide="copy"></i>Copy this week to all weeks</b><small>Same hours, every week</small></button>' : ''}</div>`;
  }
  function tvCalendar() {
    const R = CH.R, T = TODAY();
    if (!R.calBase) { const b = R.start || T; R.calBase = [+b.slice(0, 4), +b.slice(5, 7) - 1]; }
    const [y, m] = R.calBase, m2 = m === 11 ? [y + 1, 0] : [y, m + 1];
    const atMin = y === +T.slice(0, 4) && m === +T.slice(5, 7) - 1;
    return `<div class="tv-pop" id="tvPop" role="dialog" aria-label="Choose dates">
      <div class="tv-pop-h"><button type="button" class="vicon" data-tvcal="-1" aria-label="Previous month" ${atMin ? 'disabled' : ''}><i data-lucide="chevron-left"></i></button>
        <span class="grow">${R.pop === 'start' ? 'Select the <b>first day</b> you need different hours' : 'Select the <b>last day</b>'}</span>
        <button type="button" class="vicon" data-tvcal="1" aria-label="Next month"><i data-lucide="chevron-right"></i></button></div>
      <div class="tv-months">${tvMonth(y, m)}${tvMonth(m2[0], m2[1])}</div>
      <div class="tv-pop-f"><span><i class="vsw" style="background:var(--a-temp);width:7px;height:7px;border-radius:50%"></i>Temporary hours already set</span><span><i class="vsw" style="background:var(--a-pending);width:7px;height:7px;border-radius:50%"></i>Pending request</span><span class="grow"></span><button type="button" class="vbtn sm" data-tv="closepop">Done</button></div>
    </div>`;
  }
  function tvMonth(y, m) {
    const R = CH.R, T = TODAY(), ms = minReq();
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const ee = R.end || (R.pop === 'end' && R.start && R.hover && R.hover >= R.start ? R.hover : '');
    let h = `<div class="tv-mo"><h5>${MONL[m]} ${y}</h5><div class="tv-cg">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span class="wd">${x}</span>`).join('')}`;
    for (let i = 0; i < first; i++) h += '<span></span>';
    for (let d = 1; d <= dim; d++) {
      const k = isoOf(y, m, d), c = [];
      if (R.start && k === R.start) c.push('s'); if (ee && k === ee) c.push('e'); if (R.start && ee && k > R.start && k < ee) c.push('inr'); if (k === T) c.push('tod');
      const t = recs().find(r => same(r.empId, CH.empId) && r.id !== R.editId && (isPending(r) || isEff(r)) && r.days[k]);
      h += `<button type="button" data-tvd="${k}" class="${c.join(' ')}" ${k < ms ? 'disabled' : ''} aria-label="${fDY(k)}">${d}${t ? `<span class="dot" style="background:${isPending(t) ? 'var(--a-pending)' : 'var(--a-temp)'}"></span>` : ''}</button>`;
    }
    return h + '</div></div>';
  }
  function reqSetRange(s, e) { const R = CH.R; R.start = s || ''; R.end = e || ''; R.week = 0; R.sel = null; reqSync(); }
  function tvReview() {
    const R = CH.R, ds = reqDates(), iss = reqIssues();
    if (!ds.length || iss.err) return;
    const reqH = ds.reduce((t, k) => t + rowHrs(R.cells[k]), 0), regH = ds.reduce((t, k) => t + rowHrs(regularRow(CH.empId, k)), 0);
    const days = {}; ds.forEach(k => { days[k] = R.cells[k].slice(); });
    if (R.base && R.base === JSON.stringify({ s: R.start, e: R.end, d: days, re: R.reason || '' })) return toast('Nothing changed in this request', 'warning');
    if (ds.every(k => sameRow(days[k], resolve(CH.empId, k).row)))
      return dialog({ tone: 'info', icon: 'info', title: isMgr() ? 'Nothing to change' : 'Nothing to request', body: '<p>These hours match the availability that already applies on every selected date. Change at least one day or time slot.</p>', ok: 'OK', noCancel: true });
    const chg = ds.filter(k => !sameRow(days[k], regularRow(CH.empId, k))).length;
    let L = document.getElementById('tvLayer');
    if (!L) { L = document.createElement('div'); L.id = 'tvLayer'; L.className = 'v2'; document.body.appendChild(L); L.addEventListener('click', tvLayerClick); }
    L.innerHTML = `<div class="tv-ov"><div class="tv-modal" role="dialog" aria-modal="true" aria-labelledby="tvMh">
      <div class="tv-modal-h"><h3 id="tvMh">${isMgr() ? `Review temporary availability · ${esc(EN())}` : 'Review your request'}</h3><button type="button" class="vicon" data-tvm="close" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="tv-modal-b">
        <div class="tv-range" style="margin:0">${tile(ds[0], 'Start', 'pend')}<span class="tv-arrow"><i data-lucide="arrow-right"></i></span>${tile(ds[ds.length - 1], 'End', 'pend')}</div>
        <div class="tv-stats"><div class="tv-stat"><small>Days</small><b>${ds.length}</b></div><div class="tv-stat"><small>Requested hours</small><b>${reqH} hrs</b></div><div class="tv-stat"><small>Days changed from regular</small><b>${chg}</b></div></div>
        ${R.reason ? `<p style="margin:0 0 10px;font-size:13px"><span style="color:var(--a-muted)">Reason:</span> ${esc(R.reason)}</p>` : ''}
        ${iss.warn.map(w => `<div class="vnote warn" style="margin:0 0 10px"><i data-lucide="alert-triangle"></i><div>${w}</div></div>`).join('')}
        <div class="tv-rvlist">${ds.map(k => { const c = !sameRow(days[k], regularRow(CH.empId, k)); return `<div class="tv-rv ${c ? 'chg' : ''}"><b>${fD(k)}</b><span>${rangeShort(days[k])}${c ? ' <span class="vtag diff">Changed</span>' : ''}</span><span class="x">${rowHrs(days[k])}h</span></div>`; }).join('')}</div>
        ${isMgr() ? (() => { const cf = shiftConflicts(CH.empId, days); return cf.length ? `<div class="vnote warn" style="margin:10px 0 0"><i data-lucide="alert-triangle"></i><div><b>${plural(cf.length, 'scheduled shift')}</b> fall outside these hours. They stay on the schedule and are flagged for review.<ul style="margin:4px 0 0;padding-left:18px">${cf.slice(0, 4).map(x => `<li>${fD(x.iso)}: ${hm(x.s)} – ${hm(x.e)}${x.role ? ` (${esc(x.role)})` : ''}</li>`).join('')}${cf.length > 4 ? `<li>+${cf.length - 4} more</li>` : ''}</ul></div></div>` : ''; })() : ''}
        <p style="font-size:12px;color:var(--a-muted);margin:12px 0 0">Regular hours for these dates: ${regH} hrs. ${isMgr() ? `<b>No approval needed</b> — this takes priority over ${esc(EN())}’s regular hours on these dates as soon as you save. Regular availability itself doesn’t change.` : '<b>Nothing changes until your manager approves.</b>'}${!isMgr() && R.editId ? (isEff(byId(R.editId)) ? ' Until then, your <b>regular hours</b> apply on these dates instead of the current temporary hours.' : ' Updating sends it for review again.') : ''}</p>
      </div>
      <div class="tv-modal-f"><button type="button" class="vbtn" data-tvm="close">Back to editing</button><button type="button" class="vbtn primary" data-tvm="submit"><i data-lucide="${isMgr() ? 'check' : 'send'}"></i>${isMgr() ? (R.editId ? 'Save changes' : 'Assign now') : R.editId ? 'Update request' : 'Send request'}</button></div>
    </div></div>`;
    icons();
    L.querySelector('.vbtn.primary').focus();
  }
  function tvLayerClick(e) {
    const L = document.getElementById('tvLayer');
    if (e.target.classList.contains('tv-ov')) { L.innerHTML = ''; return; }
    const b = e.target.closest('[data-tvm]'); if (!b) return;
    if (b.dataset.tvm === 'close') { L.innerHTML = ''; return; }
    const R = CH.R, ds = reqDates(), me = CH.ctx.me, days = {};
    ds.forEach(k => { days[k] = R.cells[k].slice(); });
    let r = R.editId ? byId(R.editId) : null;
    if (isMgr()) {
      if (r) { Object.assign(r, { start: R.start, end: R.end, days, reason: R.reason.trim(), updatedAt: NOW() }); r.log.push({ t: 'Edited', at: NOW(), by: MGR, note: fmtRange(R.start, R.end) }); }
      else {
        r = { id: 'ta' + Date.now().toString(36), empId: CH.empId, empName: empInfo(CH.empId).name, start: R.start, end: R.end, days, source: 'manager', status: 'active',
          reason: R.reason.trim(), note: '', createdAt: NOW(), createdBy: MGR, decidedAt: '', decidedBy: '', updatedAt: '', log: [{ t: 'Assigned', at: NOW(), by: MGR, note: fmtRange(R.start, R.end) }] };
        recs().push(r);
      }
      const n = trimOverlaps(r), was = !!R.editId;
      save(); refreshSchedule(); L.innerHTML = '';
      CH.mode = 'view'; CH.list = 'current'; CH.selP = r.id; CH.R = null;
      crewRerender(); CH.ctx.onChange && CH.ctx.onChange();
      return toast(`${was ? 'Temporary availability updated' : 'Temporary availability assigned'} for ${EN()} · ${fmtRange(r.start, r.end)}${n ? ` (replaced ${plural(n, 'overlapping date')})` : ''}`);
    }
    if (r) {
      const wasEff = isEff(r);
      Object.assign(r, { start: R.start, end: R.end, days, reason: R.reason.trim(), updatedAt: NOW(), status: 'pending' });
      if (wasEff) Object.assign(r, { source: 'employee', createdAt: NOW(), createdBy: me.name, decidedAt: '', decidedBy: '', note: '' });
      r.log.push({ t: wasEff ? 'Changed — sent for approval' : 'Updated', at: NOW(), by: me.name, note: fmtRange(R.start, R.end) });
      if (wasEff) refreshSchedule();
    }
    else {
      r = { id: 'ta' + Date.now().toString(36), empId: CH.empId, empName: me.name, start: R.start, end: R.end, days, source: 'employee', status: 'pending',
        reason: R.reason.trim(), note: '', createdAt: NOW(), createdBy: me.name, decidedAt: '', decidedBy: '', updatedAt: '', log: [{ t: 'Submitted', at: NOW(), by: me.name, note: fmtRange(R.start, R.end) }] };
      recs().push(r);
    }
    const was = !!R.editId;
    save(); L.innerHTML = '';
    CH.mode = 'view'; CH.list = 'current'; CH.selP = r.id; CH.R = null;
    crewRerender(); CH.ctx.onChange && CH.ctx.onChange();
    toast(was ? 'Request updated — your manager will review it' : 'Request sent to your manager');
  }
  /* back to the top of the page so the tabs row stays visible (scrolls the page container, not the section into view) */
  function toTop() { const sc = CH.main && CH.main.closest('#eaView'); if (sc) sc.scrollTop = 0; else window.scrollTo(0, 0); }
  function tvClick(e) {
    const t = e.target, b = t.closest('button, [data-tv]');
    const R = CH.R;
    if (R && R.pop && !t.closest('#tvPop') && !t.closest('[data-tvpop]')) { R.pop = null; R.hover = null; if (!b) return crewRerender(); }
    if (!b) return;
    const d = b.dataset;
    if (d.tvlist) { CH.list = d.tvlist; return crewRerender(); }
    if (d.imode && CH.R) { CH.imode = d.imode; return crewRerender(); }
    if (d.tv === 'pick' && !t.closest('.tv-pact button')) {
      CH.selP = d.id; if (d.strip) CH.list = 'current'; crewRerender();
      if (d.strip) { const h = CH.main.querySelector('.tv-pcard.is-sel'); if (h) h.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }
    if (d.tv === 'new') { newReq(); CH.mode = 'request'; crewRerender(); return toTop(); }
    if (d.tv === 'edit') { newReq(byId(d.id)); CH.mode = 'request'; crewRerender(); return toTop(); }
    if (d.tv === 'rvw') return openReview(d.id, { onDone: () => { crewRerender(); CH.ctx.onChange && CH.ctx.onChange(); } });
    if (d.tv === 'approve') return quickApprove(byId(d.id), () => { CH.selP = d.id; crewRerender(); CH.ctx.onChange && CH.ctx.onChange(); });
    if (d.tv === 'decline') return quickDecline(byId(d.id), () => { crewRerender(); CH.ctx.onChange && CH.ctx.onChange(); });
    if (d.tv === 'withdraw' && isMgr()) { const r = byId(d.id);
      return dialog({ tone: 'danger', icon: 'trash-2', title: 'Remove temporary availability?',
        body: `<p>${esc(EN())}’s temporary availability for <b>${fmtRange(r.start, r.end)}</b> will be removed. <b>Regular availability</b> applies again on these dates.</p>${r.source === 'employee' ? '<p>This was the employee’s approved request — they’ll see it as removed.</p>' : ''}`,
        ok: 'Remove', okCls: 'danger',
        onOk: () => { r.status = 'removed'; r.updatedAt = NOW(); r.log.push({ t: 'Removed', at: NOW(), by: MGR }); save(); refreshSchedule(); crewRerender(); CH.ctx.onChange && CH.ctx.onChange(); toast('Temporary availability removed — regular availability applies'); } }); }
    if (d.tv === 'withdraw') { const r = byId(d.id), pend = r.status === 'pending';
      return dialog({ tone: 'danger', icon: 'x-circle', title: pend ? 'Withdraw this request?' : 'Cancel this temporary availability?',
        body: pend ? `<p>Your temporary availability request for <b>${fmtRange(r.start, r.end)}</b> will be withdrawn. Your availability stays as it is.</p>`
          : `<p>Your temporary availability for <b>${fmtRange(r.start, r.end)}</b> will be cancelled. Your <b>regular hours</b> apply on these dates again.</p>`,
        ok: pend ? 'Withdraw' : 'Cancel availability', okCls: 'danger', cancel: pend ? 'Keep request' : 'Keep it',
        onOk: () => { r.status = 'cancelled'; r.updatedAt = NOW(); r.log.push({ t: 'Cancelled', at: NOW(), by: CH.ctx.me.name }); save(); refreshSchedule(); crewRerender(); CH.ctx.onChange && CH.ctx.onChange(); toast(pend ? 'Request withdrawn' : 'Temporary availability cancelled'); } }); }
    if (d.tv === 'cancel') return crewGuard(() => crewRerender());
    if (d.tv === 'review') return tvReview();
    if (!R) return;
    if (d.tvpop) { R.pop = R.pop === d.tvpop ? null : d.tvpop; R.calBase = null; return crewRerender(); }
    if (d.tv === 'closepop') { R.pop = null; return crewRerender(); }
    if (d.tvcal) { let [y, m] = R.calBase; m += +d.tvcal; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } R.calBase = [y, m]; return crewRerender(); }
    if (d.tvd) {
      const k = d.tvd;
      if (R.pop === 'start' || !R.start) { const e2 = R.end && R.end >= k ? R.end : ''; reqSetRange(k, e2); R.pop = e2 ? null : 'end'; }
      else if (k < R.start) { reqSetRange(k, R.end && R.end >= k ? R.end : ''); R.pop = 'end'; }
      else { reqSetRange(R.start, k); R.pop = null; }
      R.hover = null; return crewRerender();
    }
    if (d.tvq) { if (d.tvq === 'clear') reqSetRange('', ''); else { const [a, z] = d.tvq.split('|'); reqSetRange(a, z); } R.pop = null; return crewRerender(); }
    if (d.tvweek) { R.week = +d.tvweek; R.sel = null; return crewRerender(); }
    if (d.tv === 'copyweek') {
      const m = reqWeeks()[R.week];
      for (let i = 0; i < 7; i++) { const src = R.cells[addDays(m, i)]; if (!src || addDays(m, i) < R.start || addDays(m, i) > R.end) continue; reqDates().forEach(k => { if ((weekday(k) + 6) % 7 === i) R.cells[k] = src.slice(); }); }
      crewRerender(); return toast('Copied to all weeks');
    }
    if (d.tvfill) {
      const ds = reqDates();
      const targets = ds.length ? ds.map(k => [k, regularRow(CH.empId, k)]) : reqRows().map(r => [r.k, r.ref]);
      targets.forEach(([k, ref]) => reqSet(k, d.tvfill === 'reg' ? ref.slice() : Array(24).fill(d.tvfill === 'all')));
      return crewRerender();
    }
  }
  document.addEventListener('mouseover', e => {
    const R = CH.R; if (!R || R.pop !== 'end' || !R.start || R.end) return;
    const b = e.target.closest && e.target.closest('.tv-cg button[data-tvd]'); const k = b ? b.dataset.tvd : null;
    if (k === R.hover) return; R.hover = k;
    const p = document.querySelector('#tvPop .tv-months'); if (!p) return;
    const [y, m] = R.calBase, m2 = m === 11 ? [y + 1, 0] : [y, m + 1];
    p.innerHTML = tvMonth(y, m) + tvMonth(m2[0], m2[1]);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const L = document.getElementById('tvLayer');
      if (L && L.innerHTML) { e.stopImmediatePropagation(); L.innerHTML = ''; return; }
      if (CH.R && CH.R.pop && CH.main && CH.main.isConnected) { e.stopImmediatePropagation(); CH.R.pop = null; crewRerender(); return; }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article[data-tv="pick"]')) { e.preventDefault(); e.target.click(); }
  }, true);
  function reqDirty() {
    const R = CH.R; if (!R) return false;
    if (R.base) { const days = {}; reqDates().forEach(k => { days[k] = R.cells[k]; }); return R.base !== JSON.stringify({ s: R.start, e: R.end, d: days, re: R.reason || '' }); }
    return !!(R.start || R.end);
  }
  function exitCrewEdit() { CH.mode = 'view'; CH.R = null; const L = document.getElementById('tvLayer'); if (L) L.innerHTML = ''; }
  const crewDirty = () => CH.mode === 'request' && reqDirty();
  function crewGuard(then) {
    if (!crewDirty()) { if (CH.mode === 'request') exitCrewEdit(); return then(); }
    dialog({ tone: 'warn', icon: 'alert-triangle', title: 'Discard your request?', body: '<p>Your temporary availability request hasn’t been submitted. Leaving now discards it.</p>', ok: 'Discard', okCls: 'danger', cancel: 'Keep editing', onOk: () => { exitCrewEdit(); then(); } });
  }

  /* notice used on the regular tabs: temporary availability in effect today or soon */
  function activeNotice(empId) {
    const T = TODAY(), lim = addDays(T, RIBBON_DAYS);
    const list = forEmp(empId).filter(r => isEff(r) && r.end >= T && r.start <= lim).sort((a, b) => a.start.localeCompare(b.start));
    return list[0] || null;
  }

  /* ---------------- Dialog + toast ---------------- */
  let dOk = null;
  function dialog({ tone = 'info', icon = 'info', title, body, ok = 'OK', okCls = 'primary', onOk, noCancel, cancel = 'Cancel', wide }) {
    let w = document.getElementById('taDw');
    if (!w) {
      w = document.createElement('div'); w.id = 'taDw'; w.className = 'ta-dw ta-scope';
      w.innerHTML = `<div class="ta-dlg" role="alertdialog" aria-modal="true" aria-labelledby="taDT"><div class="dh"><div class="ic" id="taDIc"></div><h3 id="taDT"></h3></div>
        <div class="db" id="taDB"></div><div class="df"><button type="button" class="ta-btn" id="taDC">Cancel</button><button type="button" class="ta-btn primary" id="taDO">OK</button></div></div>`;
      document.body.appendChild(w);
      document.getElementById('taDC').onclick = closeDlg;
      document.getElementById('taDO').onclick = () => { const f = dOk; if (f && f() === false) return; closeDlg(); };
    }
    w.querySelector('.ta-dlg').classList.toggle('wide', !!wide);
    document.getElementById('taDIc').className = 'ic ' + tone;
    document.getElementById('taDIc').innerHTML = `<i data-lucide="${icon}"></i>`;
    document.getElementById('taDT').textContent = title;
    document.getElementById('taDB').innerHTML = body;
    const okB = document.getElementById('taDO'); okB.textContent = ok; okB.className = 'ta-btn ' + okCls;
    const cB = document.getElementById('taDC'); cB.textContent = cancel; cB.style.display = noCancel ? 'none' : '';
    dOk = onOk || null;
    w.classList.add('open'); icons();
    (w.querySelector('.db textarea, .db input') || okB).focus();
  }
  function closeDlg() { const w = document.getElementById('taDw'); if (w) w.classList.remove('open'); dOk = null; }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const dw = document.getElementById('taDw'), rv = document.getElementById('taRv');
    if (dw && dw.classList.contains('open')) { e.stopImmediatePropagation(); e.preventDefault(); closeDlg(); }
    else if (rv && rv.classList.contains('open')) { e.stopImmediatePropagation(); e.preventDefault(); closeReview(); }
  }, true);
  function toast(msg, type) {
    if (typeof window.showToast === 'function') return window.showToast(esc(msg), type || 'info');
    const t = document.createElement('div'); t.className = 'du-toast'; t.style.zIndex = '10050';
    t.innerHTML = `<i data-lucide="check-circle-2"></i><span>${esc(msg)}</span>`;
    document.body.appendChild(t); icons();
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
  }

  /* re-render open views when another tab / page changes the store */
  listeners.push(remote => {
    if (!remote) return;
    if (MH.el && MH.el.isConnected && MH.mode === 'view' && MH.el.offsetParent) mgrRerender();
    if (CH.main && CH.main.isConnected && CH.mode === 'view' && CH.main.offsetParent) crewRerender();
  });

  window.TA = {
    // data
    load, recs, byId, forEmp, effective, resolve, regularRow, decide, pendingCount: () => recs().filter(isPending).length, mgrPending, activeNotice, onChange: fn => listeners.push(fn),
    // manual time entry
    windowsPanel, host, hasErrors, resetKeys, keepOnly, wgHTML, wgBind, tlHTML, tlBind,
    // views
    renderManager, managerDirty, managerGuard, resetManager: () => { MH = { empId: null, mode: 'view', scope: 'emp', E: null, open: {}, flash: null, carry: null }; },
    renderCrew, crewDirty, crewGuard, crewDiscard: () => { if (CH.mode === 'request') exitCrewEdit(); }, crewPending: empId => forEmp(empId).filter(isPending).length,
    openReview, dashRows,
    // formatting helpers
    fmt, fmtRange, rangeText, slotSummary, recHrs, recDates, isPending, TODAY,
  };
})();
