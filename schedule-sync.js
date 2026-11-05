/* ============================================================
   Dashboard ⇄ Schedule Pad sync
   Schedule Pad writes its shifts, unassigned shifts, offers and a summary
   (hours, cost, OT, today's shifts, employees) to localStorage
   'zipSchedStore'. The dashboard reads it for the stat tiles, their
   pop-ups and the Unassigned Shifts panel, and writes back when an
   unassigned shift is deleted, assigned or an offer is withdrawn. A hidden
   Schedule Pad frame recomputes the summary after a write (or builds the
   store the first time), and 'storage' events keep open tabs in step.
   ============================================================ */
(function () {
    const KEY = 'zipSchedStore';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
    const write = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
    let frame = null;
    function recompute() {
        if (!frame) {
            frame = document.createElement('iframe');
            frame.setAttribute('aria-hidden', 'true');
            frame.tabIndex = -1;
            frame.style.cssText = 'position:absolute;left:-9999px;width:1200px;height:800px;border:0;visibility:hidden';
            document.body.appendChild(frame);
        }
        frame.src = 'Schedule Pad.html?sync=' + Date.now();
    }

    /* ---- formatting ---- */
    const hm = h => { const m = Math.round(h * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    const money = v => v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(v));
    const t12 = h => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${String(H % 12 || 12).padStart(2, '0')}:${String(M).padStart(2, '0')} ${H < 12 ? 'AM' : 'PM'}`; };
    const tShort = h => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${H % 12 || 12}:${String(M).padStart(2, '0')}${H < 12 ? 'a' : 'p'}`; };
    const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]);
    const hrs = (s, e) => e > s ? e - s : e + 24 - s;
    const hhmm = h => { const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    // Schedule Pad days are Sun..Sat; the dashboard week starts on Monday
    function dateOf(c) {
        const m = (document.getElementById('weekDisplay')?.innerText || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const mon = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(2026, 1, 16);
        return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + (c + 6) % 7);
    }
    const dayLbl = c => { const d = dateOf(c); return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
    const longDate = c => { const d = dateOf(c); return `${ord(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getFullYear()}`; };
    const shiftLbl = s => { const d = dateOf(s.day); return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • ${tShort(s.start)}–${tShort(s.end)}`; };
    const brkLbl = s => (s.breaks || []).length ? s.breaks.map(b => `${tShort(+b.start.slice(0, 2) + +b.start.slice(3) / 60)}–${tShort(+b.end.slice(0, 2) + +b.end.slice(3) / 60)} (${b.type || 'Meal'})`).join('<br>') : '--';

    /* ---- stat tiles (both dashboard UIs) ---- */
    function renderTiles(sum) {
        const d = sum.days, T = sum.today, wk = k => d.reduce((a, x) => a + x[k], 0);
        const vals = {
            'openUpcomingModal()': String(sum.upcoming.length),
            "openKpiModal('currentlyIn')": String(sum.current.length),
            "openKpiModal('todayHours')": hm(d[T].hrs),
            "openKpiModal('weeklyHours')": hm(wk('hrs')),
            "openKpiModal('todayOT')": hm(d[T].ot),
            "openKpiModal('weeklyOT')": hm(wk('ot')),
            "openDollarModal('todayDollar')": money(d[T].cost),
            "openDollarModal('weeklyDollar')": money(wk('cost')),
        };
        Object.entries(vals).forEach(([fn, v]) => document.querySelectorAll(`[onclick="${fn}"]`).forEach(el => {
            const box = el.querySelector('.sd-stat-val') || el.querySelector('.font-bold.text-xl');
            if (box) box.textContent = v;
        }));
    }

    /* ---- Unassigned Shifts panel ---- */
    const keyMap = {};   // 'ua-<id>' → { day, id }
    function renderUA(st) {
        const sum = st.sum, emp = id => sum.employees.find(e => e.id === id) || { name: 'Employee', position: '', avatar: '' };
        const list = [];
        st.ua.forEach((day, c) => (day || []).forEach(s => list.push({ ...s, day: c })));
        list.sort((a, b) => (a.day + 6) % 7 - (b.day + 6) % 7 || a.start - b.start);
        Object.keys(keyMap).forEach(k => delete keyMap[k]);
        if (typeof dashUaOffers !== 'undefined') Object.keys(dashUaOffers).forEach(k => delete dashUaOffers[k]);
        list.forEach(s => {
            const key = 'ua-' + s.id;
            keyMap[key] = { day: s.day, id: s.id };
            if (typeof dashUaOffers !== 'undefined' && (s.offers || []).length)
                dashUaOffers[key] = s.offers.map(o => { const e = emp(o.empId); return { empId: o.empId, name: e.name, pos: e.position, avatar: e.avatar, img: 0, status: o.status }; });
        });
        document.querySelectorAll('.ua-count').forEach(badge => {
            const panel = badge.closest('.draggable-card');
            const box = panel && panel.querySelector('.sd-list, .overflow-y-auto');
            if (!box) return;
            const isNew = box.classList.contains('sd-list');
            badge.textContent = list.length;
            box.innerHTML = list.length ? list.map(s => {
                const when = `${longDate(s.day)} • ${t12(s.start)} - ${t12(s.end)}`, pos = s.position, dept = s.dept || 'Front';
                return isNew ? `
        <div class="sd-row">
            <div class="sd-row-main"><div class="sd-row-name">${pos}</div><div class="sd-row-sub">${when}</div></div>
            <div class="sd-row-actions ua-actions">
                <button onclick="openAssignModal('ua-${s.id}', '${dept}', '${pos}')" class="sd-icon-btn sd-icon-btn--blue" title="Assign"><i data-lucide="user-plus"></i></button>
                <button onclick="deleteUnassignedShift(this, '${pos}')" class="sd-icon-btn sd-icon-btn--no" title="Delete Shift"><i data-lucide="trash-2"></i></button>
            </div>
        </div>` : `
    <div class="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm hover:shadow-md transition cursor-pointer">
        <div><div class="font-bold text-[13px] text-slate-800">${pos}</div><div class="text-[11px] text-slate-500 font-medium">${when}</div></div>
        <div class="ua-actions flex items-center gap-3">
            <button onclick="openAssignModal('ua-${s.id}', '${dept}', '${pos}')" class="text-blue-600 text-[12px] font-bold flex items-center gap-1 hover:underline"><i data-lucide="edit-3" class="w-4 h-4"></i> Assign</button>
            <button onclick="deleteUnassignedShift(this, '${pos}')" class="text-red-500 hover:text-red-600 transition" title="Delete Shift"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
    </div>`;
            }).join('') : '<div class="py-8 text-center text-[13px] text-slate-500">No unassigned shifts this week.</div>';
        });
        if (typeof _daEmps !== 'undefined')
            _daEmps.splice(0, _daEmps.length, ...sum.employees.map(e => ({ id: e.id, name: e.name, pos: e.position, avatar: e.avatar, img: 0, wk: +e.wk.toFixed(1) })));
        if (typeof renderDashUaStatus === 'function') renderDashUaStatus();
        if (window.lucide) lucide.createIcons();
    }

    function apply() {
        const st = read();
        if (!st || st.v !== 1 || !st.sum) return false;
        renderTiles(st.sum);
        renderUA(st);
        return true;
    }

    /* ---- pop-up data (used by openKpiModal / openDollarModal) ---- */
    window.schedSyncRows = function (type) {
        const st = read(); if (!st || !st.sum) return null;
        const s = st.sum, T = s.today;
        const shiftRows = list => list.map(x => [x.name, shiftLbl(x), brkLbl(x), x.position]);
        if (type === 'upcoming') return { title: 'Upcoming Shifts', cols: ['Employee', 'Shift Time', 'Breaks', 'Position'], rows: shiftRows(s.upcoming) };
        if (type === 'currentlyIn') return { title: 'Current Shift', cols: ['Employee', 'Shift Time', 'Breaks', 'Position'], rows: shiftRows(s.current) };
        if (type === 'todayHours') return { title: 'Todays Sch Hrs.', cols: ['Employee', 'Shift Time', 'Sch. Hrs.', 'Position'],
            rows: s.todayShifts.map(x => [x.name, shiftLbl(x), +hrs(x.start, x.end).toFixed(2) + 'h', x.position]) };
        if (type === 'todayOT') return { title: 'Todays Sch. OT', cols: ['Employee', 'Shift Time', 'Scheduled Hrs', 'OT Hours', 'Position'],
            rows: s.todayShifts.filter(x => x.ot > 0).map(x => [x.name, shiftLbl(x), +hrs(x.start, x.end).toFixed(2) + 'h', +x.ot.toFixed(2) + 'h', x.position]) };
        const order = [1, 2, 3, 4, 5, 6, 0];
        if (type === 'weeklyHours') return { title: 'Weekly Sch Hrs.', cols: ['Day / Date', 'Forecasted Hrs.', 'Total Sch. Hrs.', 'Variance (Fct vs Sch)'],
            rows: order.map(c => { const d = s.days[c], v = d.fct - d.hrs; return [dayLbl(c), d.fct.toFixed(1) + 'h', d.hrs.toFixed(1) + 'h', (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + 'h']; }) };
        if (type === 'weeklyOT') return { title: 'Weekly Sch. OT', cols: ['Day / Date', 'Scheduled Hrs', 'Scheduled OT'],
            rows: order.map(c => [dayLbl(c), s.days[c].hrs.toFixed(1) + 'h', s.days[c].ot.toFixed(1) + 'h']) };
        return null;
    };
    function syncDollar() {
        const st = read(); if (!st || !st.sum || typeof _dmToday === 'undefined') return;
        _dmToday.sch = st.sum.hourly.slice();
        _dmWeek.sch = st.sum.days.map(d => d.cost);
        _dmWeek.dates = st.sum.days.map((_, c) => { const d = dateOf(c); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; });
    }

    /* ---- write-backs ---- */
    function edit(fn) {
        const st = read(); if (!st) return;
        fn(st);
        write(st);
        recompute();
    }
    const removeUa = (st, key) => { const m = keyMap[key]; if (m) st.ua[m.day] = (st.ua[m.day] || []).filter(x => x.id !== m.id); };
    const keyOfRow = row => ((row && row.querySelector('[onclick^="openAssignModal(\'ua-"]')?.getAttribute('onclick')) || '').match(/'(ua-[^']+)'/)?.[1];
    function pushOffers() {
        edit(st => Object.entries(keyMap).forEach(([key, m]) => {
            const s = (st.ua[m.day] || []).find(x => x.id === m.id);
            if (s) s.offers = (dashUaOffers[key] || []).map(o => ({ empId: o.empId, status: o.status }));
        }));
    }

    document.addEventListener('DOMContentLoaded', () => {
        // wrap the dashboard's own handlers so their changes reach the store
        const wrap = (name, before, after) => {
            const base = window[name]; if (typeof base !== 'function') return;
            window[name] = function () { const ctx = before ? before.apply(this, arguments) : null; const r = base.apply(this, arguments); if (after) after(ctx); return r; };
        };
        wrap('confirmUaDelete', () => keyOfRow(uaPendingRow), key => { if (key && keyMap[key]) edit(st => removeUa(st, key)); });
        wrap('confirmDashAssign', () => _da && _da.sel != null ? { key: _da.key, empId: _da.sel } : null, ctx => {
            if (!ctx || !keyMap[ctx.key]) return;
            edit(st => {
                const m = keyMap[ctx.key], s = (st.ua[m.day] || []).find(x => x.id === m.id); if (!s) return;
                const a = hhmm(s.start), b = hhmm(s.end);
                st.sa[`w_${ctx.empId}_${m.day}`] = { start: Math.floor(s.start), end: Math.floor(s.end), startHHMM: a, endHHMM: b, time: `${a} - ${b}`, position: s.position, notes: '', breaks: [] };
                removeUa(st, ctx.key);
            });
        });
        ['withdrawDashUaOffer', 'withdrawAllDashUaOffers', 'amWithdrawOffer'].forEach(n => wrap(n, null, () => setTimeout(pushOffers, 300)));
        wrap('renderDashboardUI', null, apply);
        wrap('handleDateSelect', null, apply);
        wrap('openDollarModal', syncDollar, null);
        if (!apply()) recompute();   // first visit: let Schedule Pad build the store
    });
    window.addEventListener('storage', e => { if (e.key === KEY) apply(); });
})();
