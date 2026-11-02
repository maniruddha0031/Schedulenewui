/* ============================================================
   Schedule Insight — NEW AI Insight design (behind the profile-menu
   flag "Enable New Insight Design"; body.si-newdesign). The old
   Insights tab (AI Insights list + AI Hub) is untouched: this file
   only renders into #tab-insights-v2.

   Feedback it answers: the old view repeated the same data KPI by KPI
   (12 shifts over 8 hrs showed up as Compliance, Overstaffing, Labor
   Budget AND Overtime). Here the day / week is told as:
     1. What's going well
     2. What went wrong  — one card per ROOT CAUSE, not per KPI; each
        card says which KPIs it shows up in
     3. The problem      — why it happened
     4. How to fix it    — ordered steps, each with its expected result
     5. Related data     — the old evidence tables, on demand
   plus an AI briefing hero and one fix plan for the whole page.

   Numbers come from the same sources as the old insights: daily from
   the day's shifts (deepdive-data.js) with the helpers and rules in
   insights-daily.js; weekly from the published week (insights-nui-data.js).
   ============================================================ */

const SI_V2 = { date:null, open:{}, dataOpen:{}, dataTab:{}, updatedAt:null };
const SI_V2_DONE_KEY = 'si-v2-done';

/* ---------- small helpers ---------- */
const siV2Plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
const siV2Strip = s => String(s || '').replace(/<[^>]+>/g, '');
const siV2Join = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
function siV2DoneMap(){ try { return JSON.parse(localStorage.getItem(SI_V2_DONE_KEY)) || {}; } catch (e) { return SI_V2._done || (SI_V2._done = {}); } }
function siV2SaveDone(m){ try { localStorage.setItem(SI_V2_DONE_KEY, JSON.stringify(m)); } catch (e) { SI_V2._done = m; } }

const SI_V2_ICON = {
  spark:'<path d="M9.9 4.6 11 8.2a3 3 0 0 0 2 2l3.6 1.1-3.6 1.1a3 3 0 0 0-2 2L9.9 18l-1.1-3.6a3 3 0 0 0-2-2L3.2 11.3l3.6-1.1a3 3 0 0 0 2-2z"/><path d="M18 3v4M16 5h4M19 16v3M17.5 17.5h3"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  x:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.6-.6-.6-2.6z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><circle cx="17.5" cy="8.5" r="2.5"/><path d="M15.8 13.7c2.8.5 4.7 2.6 4.7 5.3"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/>',
  send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  calendar:'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  dollar:'<path d="M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  flag:'<path d="M4 22V4M4 4h12l-2 4 2 4H4"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
};
const siV2Ic = (n, s, w) => `<svg width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${SI_V2_ICON[n] || SI_V2_ICON.spark}</svg>`;

/* the KPI (old insight) a root cause shows up in */
const SI_V2_THEME = {
  hours:    { icon:'clock',  label:'Hours & cost' },
  coverage: { icon:'users',  label:'Coverage' },
  rules:    { icon:'shield', label:'Labor rules' },
  publish:  { icon:'send',   label:'Schedule hygiene' },
};

/* health score: 100 minus weighted problems (same weights for day + week) */
function siV2Health(p){
  let s = 100;
  s -= Math.min(30, (p.over || 0) * 0.8);
  s -= Math.min(20, Math.max(0, p.budOver || 0) * 0.8);
  s -= Math.min(20, (p.under || 0) * 2.5);
  s -= Math.min(24, (p.legal || 0) * 8) + Math.min(8, (p.avail || 0) * 4) + Math.min(12, (p.unassigned || 0) * 4) + Math.min(8, (p.unpub || 0) * 2);
  s = Math.round(Math.max(15, Math.min(100, s)));
  return { score:s, label: s >= 85 ? 'On track' : s >= 65 ? 'Needs attention' : 'At risk', tone: s >= 85 ? 'good' : s >= 65 ? 'warn' : 'bad' };
}

/* ============================================================
   DAY: build the briefing for one date from that day's shifts
   ============================================================ */
function siV2BuildDay(date){
  const g = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - SI_DD_ANCHOR) / 86400000);
  const wk = Math.floor(g / 7), dIdx = ((g % 7) + 7) % 7;
  if (g < 0 || wk >= SI_DD_WEEKS.length) return { empty:true, lbl:siInsIso(date) };
  const lbl = siDLabel(g);
  const weekRecs = SI_DD_RECORDS.filter(r => r.weekIdx === wk);
  const dayRecs = weekRecs.filter(r => r.dayIdx === dIdx);
  const agg = deepdiveAggregate(dayRecs);
  const hours = siDHourModel(weekRecs, dayRecs, dIdx);
  const open = hours.filter(x => x.fc > 0.05 || x.sc > 0);
  const over = hours.reduce((s, x) => s + Math.max(0, x.v), 0);
  const under = hours.reduce((s, x) => s + Math.max(0, -x.v), 0);
  const warns = siDWarnings(dayRecs, g);
  const L = siInsBuildDaily(date);
  const by = short => L.find(i => i.short === short);
  const rate = SI_DAILY_CFG.AVG_RATE;
  const budgetHrs = agg.fctSales * SI_DAILY_CFG.BUDGET_PCT / 100 / rate;
  const budVar = budgetHrs - agg.schHrs;                       // negative = over budget
  const budVarPct = SI_DAILY_CFG.BUDGET_PCT - agg.schLbrPerc;
  const otR = dayRecs.filter(r => r.hours > 8).sort((a, b) => b.hours - a.hours);
  const otHrs = otR.reduce((s, r) => s + r.hours - 8, 0);
  const otD = otR.reduce((s, r) => s + (r.hours - 8) * r.rate * 1.5, 0);
  const dateIso = siDIso(siDDateOfIdx(g));
  const ua = SI_DAILY_CFG.UNASSIGNED.filter(u => u.date === dateIso);
  const tos = SI_DAILY_CFG.TIMEOFF.filter(t => t.date === dateIso);
  const T = r => siDdShiftTime(r);
  const problems = [];
  const cnt = t => warns.filter(w => w.type === t).length;

  /* ---- 1. hours & cost: overstaffing + over budget + overtime + Daily OT
     warnings are ONE problem when they come from the same shifts ---- */
  if (over >= 2 || budVar < -1 || otR.length) {
    const win = siDWindow(hours, x => x.v > 0.1, x => x.v);
    const wLbl = siDWinLbl(hours, win);
    // a stretch covering most of the open day reads better as "the whole day"
    const allDay = (win.b - win.a) >= open.length * 0.8;
    const winShifts = dayRecs.filter(r => siDOverlap(r, win.a, win.b) > 0).length;
    const late = dayRecs.filter(r => r.start + r.hours > 23.5).sort((a, b) => (b.start + b.hours) - (a.start + a.hours));
    const lateHrs = late.reduce((s, r) => s + Math.max(0, r.start + r.hours - 23), 0);
    const mgr = otR.filter(r => SI_MGR_POS[r.position]);
    const avgLen = agg.schHrs / (dayRecs.length || 1);
    const affects = [over >= 2 && 'Overstaffing', budVar < -0.5 && 'Labor Budget', otR.length && 'Overtime', otR.length && 'Daily OT warnings'].filter(Boolean);
    const wrong = [];
    if (over >= 2) wrong.push(`<b>${siD2(over)} staff-hours over forecast</b>`);
    if (budVar < -0.5) wrong.push(`<b>${siD2(-budVar)} hrs (${siD2(-budVarPct)}%) over the labor budget</b>`);
    if (otR.length) wrong.push(`<b>${siDMoney(otD)} of daily overtime</b>`);
    const why = [];
    if (otR.length) why.push(`<b>${siV2Plural(otR.length, 'shift')}</b> run past 8 hrs and add <b>${siDHrs(otHrs)}</b>${budVar < 0 ? ` (${Math.min(100, Math.round(otHrs / -budVar * 100))}% of the hours over budget)` : ''}, every one paid at 1.5×`);
    else why.push(`No shift runs past 8 hrs: the extra hours come from <b>${dayRecs.length} shifts</b> of normal length (${siD2(avgLen)} hrs on average)`);
    if (over >= 2) why.push(`Overstaffed in <b>${hours.filter(x => x.v > 0.1).length} of ${open.length} hours</b>; the biggest stretch is <b>${wLbl}</b> (+${siD2(win.sum)} hrs) with ${winShifts} shifts on`);
    if (mgr.length) why.push(`${siV2Plural(mgr.length, 'manager/lead shift')} carry <b>${siDHrs(mgr.reduce((s, r) => s + r.hours - 8, 0))}</b> of the OT, at the highest pay rates`);
    if (late.length >= 2) why.push(`<b>${late.length} closers</b> stay past 11:30 PM (${late.slice(0, 3).map(r => siDFirst(r.employeeName) + ' to ' + siDdClock(r.start + r.hours)).join(', ')}) after the forecast drops off`);
    if (over >= 2 && budVar < 0) why.push(`Forecasted Staff for the day is ${siDHrs(agg.fctStaff)}, so the extra hours aren't needed for coverage`);

    const fixes = [];
    if (otR.length) fixes.push({ when:'Before the shift', title:'Cap every shift at 8 hrs',
      detail: otR.slice(0, 3).map(r => r.start + r.hours > 22 ? `${r.employeeName} starts ${siDdClock(r.start + r.hours - 8)}` : `${r.employeeName} ends ${siDdClock(r.start + 8)}`).join(' · ') + (otR.length > 3 ? ` · +${otR.length - 3} more` : ''),
      outcome:`−${siDHrs(otHrs)} · −${siDMoney(otD)} OT · clears ${siV2Plural(otR.length, 'Daily OT warning')}` });
    const ovIns = by('Overstaffing');
    const stag = ovIns && ovIns.actions.find(a => !/^Cap every shift|^End closers/.test(a.body));
    // drop the lead-in ("Reduce overlap from 1:00 PM – 6:00 PM: ") — the time itself has colons, so match up to "AM:/PM:/close:"
    if (stag && over >= 2) fixes.push({ when:'Before the shift', title: allDay ? 'Shorten the longest overlapping shifts' : `Stagger the overlap in ${wLbl}`,
      detail: stag.body.replace(/^(Reduce overlap from|Shorten the longest shifts so fewer people overlap around)\s.*?(?:AM|PM|close):\s*/, ''),
      outcome:`up to −${siD2(Math.min(win.sum, Math.max(0, over - otHrs)))} staff-hours` });
    if (late.length >= 2 && lateHrs > 0.5) fixes.push({ when:'Next schedule', title:'End closers by 11:00 PM', detail: late.map(r => siDFirst(r.employeeName)).join(', '), outcome:`−${siDHrs(lateHrs)}` });
    const rem = -budVar - otHrs;
    if (budVar < 0 && rem > 1) fixes.push({ when:'Before the shift', title:`Trim about ${siDHrs(rem)}${otR.length ? ' more' : ''}`,
      detail:'Start with the longest shifts: ' + dayRecs.slice().sort((a, b) => b.hours - a.hours).slice(0, 2).map(r => `${r.employeeName} ${siDHrs(r.hours)}`).join(', '),
      outcome:`${lbl} lands on its ${siD2(SI_DAILY_CFG.BUDGET_PCT)}% budget` });
    const fixHrs = budVar < 0 ? -budVar : otHrs;
    problems.push({ theme:'hours', sev: (over >= 15 || budVar < -10 || otD > 200) ? 'alert' : 'warn',
      title: otR.length ? `${otR.length} of ${dayRecs.length} shifts are built longer than 8 hours` : `More people are scheduled than ${lbl} needs, ${allDay ? 'across the whole day' : 'mostly ' + wLbl}`,
      wrong:`${lbl} ends up ${siV2Join(wrong)}.`,
      cause: otR.length ? `Shifts are built ${siD2(avgLen)} hrs long on average. Every hour past 8 is an hour the forecast doesn't need, paid at 1.5×. It's one problem that shows up in ${affects.length} places.`
                        : `${winShifts} shifts overlap in ${wLbl}, when the forecast needs fewer people. The total is right for a busy day, but the hours sit in the wrong place.`,
      affects, why, fixes,
      impact:[ over >= 2 && { l:'Over forecast', v:'+' + siDHrs(over), tone:'bad' },
               budVar < -0.5 && { l:'Over labor budget', v:'−' + siD2(-budVar) + ' hrs | −' + siD2(-budVarPct) + '%', tone:'bad' },
               otR.length && { l:'Daily overtime', v:siDMoney(otD), sub:siDHrs(otHrs), tone:'bad' },
               over >= 2 && { l:'Labor $ over forecast', v:siDMoney(over * rate), tone:'warn' } ].filter(Boolean),
      payoff:{ hrs: fixHrs, money: otD + Math.max(0, fixHrs - otHrs) * rate, warnings: otR.length },
      data:[by('Overtime'), by('Overstaffing'), by('Over Labor Budget')].filter(Boolean),
      headlineImpact: budVar < -0.5 ? '−' + siD2(-budVar) + ' hrs vs budget' : '+' + siD2(over) + ' hrs over' });
  }

  /* ---- 2. coverage: understaffing + unassigned shifts + time off not
     backfilled (+ budget "under") are one problem ---- */
  const toApproved = tos.filter(t => t.status === 'Approved' && !dayRecs.some(r => r.employeeName === t.emp));
  if (under >= 2 || ua.length || toApproved.length) {
    const win = siDWindow(hours, x => x.v < -0.1, x => -x.v);
    const wLbl = siDWinLbl(hours, win);
    const unIns = by('Understaffing'), uaIns = by('Unassigned Shifts');
    const uaHrs = ua.reduce((s, u) => s + u.end - u.start, 0);
    const used = new Set();
    const picks = ua.map(u => { const m = siDBestMatches(weekRecs, dayRecs, g, u.pos, u.start, u.end, used, 2); if (m[0]) used.add(m[0].name); return { u, m }; });
    // each assigned shift covers up to 1 person per short hour, from what is still short
    // (shifts overlap, so the same hour is never counted twice; totals match Unassigned Shifts)
    const shortLeft = {}; hours.forEach(x => { if (x.v < -0.1) shortLeft[x.h] = -x.v; });
    const coverMemo = new Map();
    const covers = u => {
      if (coverMemo.has(u)) return coverMemo.get(u);
      let c = 0;
      hours.forEach(x => { if (shortLeft[x.h] > 0 && x.h >= u.start && x.h < u.end) { const t = Math.min(shortLeft[x.h], 1); shortLeft[x.h] -= t; c += t; } });
      coverMemo.set(u, c); return c;
    };
    const why = [];
    if (under >= 2) why.push(`<b>${wLbl}</b>: ${siDHrs(win.sc)} scheduled vs ${siDHrs(win.fc)} Forecasted Staff → <b>−${siDHrs(win.sum)}</b>`);
    if (toApproved.length) why.push(`<b>${siV2Join(toApproved.map(t => t.emp))}</b> ${toApproved.length > 1 ? 'have' : 'has'} approved time off; ${toApproved.length > 1 ? 'their shifts' : 'the shift'} moved to the <b>Unassigned</b> row and nobody was assigned`);
    if (ua.length) why.push(`The schedule pad shows "Cannot publish unassigned Shifts" until ${ua.length > 1 ? 'each of the ' + ua.length + ' shifts has' : 'the shift has'} an employee`);
    if (unIns && unIns.rootPoints[2]) why.push(unIns.rootPoints[2]);
    if (budVar > 1) why.push(`${lbl} is ${siDHrs(budVar)} <b>under</b> budget, but that's missing coverage, not a saving`);
    const fixes = picks.map(p => ({ when:'Today', title: p.m[0] ? `Assign ${p.m[0].name}` : `Offer the ${p.u.pos} shift`,
      detail:`${siDdClock(p.u.start)} – ${siDdClock(p.u.end)} ${p.u.pos}` + (p.m[0] ? ` · free that day, ${siDHrs(p.m[0].hrs)} this week` + (p.m[1] ? ` · backup ${p.m[1].name}` : '') : ' · use "Unassign and Offer Shift"'),
      outcome: covers(p.u) > 0.05 ? `covers ${siDHrs(covers(p.u))} of the short hours` : 'shift can be published' }));
    if (!ua.length && under >= 2) {
      const avail = siDAvailable(weekRecs, dayRecs, g, 3);
      fixes.push({ when:'Before the shift', title:`Add ${under > 6 ? 2 : 1} shift${under > 6 ? 's' : ''} for ${wLbl}`, detail:'Free that day: ' + avail.map(a => `${a.name} (${siDHrs(a.hrs)})`).join(', '), outcome:`covers ${siDHrs(under)} short` });
    }
    if (over >= 2 && under >= 2) fixes.push({ when:'Before the shift', title:'Pay for it with the overstaffed hours', detail:`${lbl} is also ${siDHrs(over)} over in other hours`, outcome:'total hours stay about the same' });
    if (ua.length) fixes.push({ when:'Today', title:'Publish the schedule', detail:'Once every shift has an employee', outcome:'employees get their shifts' });
    const coveredHrs = picks.reduce((s, p) => s + (p.m[0] ? covers(p.u) : 0), 0);
    problems.push({ theme:'coverage', sev: (under >= 5 || ua.length) ? 'alert' : 'warn',
      title: toApproved.length ? `${siV2Plural(toApproved.length, 'approved time-off request')} ${toApproved.length > 1 ? 'were' : 'was'} never backfilled` : `${wLbl} is short-staffed`,
      wrong:`${lbl} is <b>${siD2(under)} staff-hours short</b>${under >= 2 ? `, mostly ${wLbl}` : ''}` + (ua.length ? `, and <b>${siV2Plural(ua.length, 'shift')} (${siDHrs(uaHrs)})</b> sit Unassigned, so the schedule can't be published.` : '.'),
      cause: toApproved.length ? `Time off was approved and the shifts were moved to Unassigned, but nobody was put on them. Each one has a free, same-position employee who stays under 40 hrs.`
                               : `Most shifts end before ${siDdClock(win.a)}, so too few people are on for ${wLbl}.`,
      affects:[under >= 2 && 'Understaffing', ua.length && 'Unassigned Shifts', tos.length && 'Time Off', budVar > 1 && 'Labor Budget (under)'].filter(Boolean),
      why, fixes,
      impact:[ under >= 2 && { l:'Short staff-hours', v:'−' + siDHrs(under), sub:wLbl, tone:'bad' },
               ua.length && { l:'Unassigned shifts', v:String(ua.length), sub:siDHrs(uaHrs), tone:'bad' },
               ua.length && { l:'Best matches found', v:picks.filter(p => p.m[0]).length + ' of ' + ua.length, tone:'good' },
               budVar > 1 && { l:'Unused budget', v:'+' + siDHrs(budVar), sub:'not a saving', tone:'warn' } ].filter(Boolean),
      payoff:{ covered: coveredHrs || (!ua.length ? under : 0), shifts: picks.filter(p => p.m[0]).length },
      data:[unIns, uaIns, by('Time Off')].filter(Boolean),
      headlineImpact:'−' + siD2(under) + ' hrs short' });
  }

  /* ---- 3. labor rules: minor, meal break, availability, time-off overlap ---- */
  const ruleW = warns.filter(w => ['Minor', 'Meal Break', 'Availability', 'Time-Off Overlap'].indexOf(w.type) >= 0);
  const legal = ruleW.filter(w => w.legal), avail = ruleW.filter(w => w.type === 'Availability');
  const comp = by('Schedule Compliance');
  if (ruleW.length) {
    const age = n => SI_DAILY_CFG.MINORS[n] ? ` (age ${SI_DAILY_CFG.MINORS[n]})` : '';
    const types = [...new Set(ruleW.map(w => w.type))];
    problems.push({ theme:'rules', sev: legal.length ? 'alert' : 'warn',
      title: legal.length ? `${siV2Plural(legal.length, 'shift breaks', 'shifts break')} labor law` : `${siV2Plural(ruleW.length, 'shift conflicts', 'shifts conflict')} with availability`,
      wrong:`${siV2Join(ruleW.map(w => `<b>${w.r.employeeName}</b>${age(w.r.employeeName)}`))} ${ruleW.length > 1 ? 'are' : 'is'} scheduled outside the rules. ${legal.length ? 'These are legal risks: fix them before the shift is worked.' : ''}`,
      cause:`The schedule was built without the ${siV2Join(types.map(t => ({ 'Minor':'minor-hours', 'Meal Break':'meal-break', 'Availability':'availability', 'Time-Off Overlap':'time-off' })[t]))} check${types.length > 1 ? 's' : ''} on these shifts.`,
      affects:['Schedule Compliance'].concat(types),
      why: ruleW.map(w => `<b>${w.r.employeeName}</b>${age(w.r.employeeName)}, ${T(w.r)} (${siDHrs(w.r.hours)}) → "${w.msg}"`),
      fixes: ruleW.map(w => ({ when:'Today', title:`${w.r.employeeName}: ${w.fix.charAt(0).toLowerCase() + w.fix.slice(1)}`, detail:`${T(w.r)} · ${w.type}`, outcome: w.legal ? 'legal risk cleared' : 'matches availability' })),
      impact:[ legal.length && { l:'Legal risks', v:String(legal.length), tone:'bad' },
               cnt('Minor') && { l:'Minor rule', v:String(cnt('Minor')), tone:'bad' },
               cnt('Meal Break') && { l:'Meal break', v:String(cnt('Meal Break')), tone:'bad' },
               avail.length && { l:'Availability', v:String(avail.length), tone:'warn' },
               cnt('Time-Off Overlap') && { l:'Time-off overlap', v:String(cnt('Time-Off Overlap')), tone:'warn' } ].filter(Boolean),
      payoff:{ legal: legal.length, conflicts: ruleW.length - legal.length },
      data: comp ? [siV2FilterIns(comp, 'Rule violations', r => !/Daily OT|Unpublished/.test(r[4]))] : [],
      headlineImpact: legal.length ? siV2Plural(legal.length, 'legal risk') : siV2Plural(ruleW.length, 'conflict') });
  }

  /* ---- 4. schedule hygiene: unpublished shifts + pending time off ---- */
  const unpub = warns.filter(w => w.type === 'Unpublished');
  const pending = tos.filter(t => t.status === 'Pending');
  if (unpub.length || pending.length) {
    const fixes = [];
    pending.forEach(t => { const s = dayRecs.find(r => r.employeeName === t.emp); fixes.push({ when:'Today', title:`Decide ${t.emp}'s time-off request`, detail:`Pending since ${t.requested}${s ? ' · scheduled ' + T(s) : ''}`, outcome:'no surprise no-show' }); });
    if (unpub.length) fixes.push({ when:'Today', title:'Publish the schedule', detail: unpub.map(w => siDFirst(w.r.employeeName)).join(', '), outcome:`${siV2Plural(unpub.length, 'employee')} get their shift details` });
    problems.push({ theme:'publish', sev:'warn',
      title: unpub.length ? `${siV2Plural(unpub.length, 'shift is', 'shifts are')} not published yet` : `${siV2Plural(pending.length, 'time-off request')} still waiting for a decision`,
      wrong: (unpub.length ? `<b>${siV2Join(unpub.map(w => w.r.employeeName))}</b> ${unpub.length > 1 ? "don't" : "doesn't"} have the details of ${unpub.length > 1 ? 'their shifts' : 'the shift'} yet.` : '') + (pending.length ? ` ${siV2Join(pending.map(t => t.emp))}'s request is pending.` : ''),
      cause: unpub.length ? 'Shifts were changed after the schedule went out and were never re-published.' : 'The request is still open, so the shift may not be worked.',
      affects:['Schedule Compliance', unpub.length && 'Unpublished Shifts', pending.length && 'Time Off'].filter(Boolean),
      why: unpub.map(w => `<b>${w.r.employeeName}</b> (${w.r.position}), ${T(w.r)}: unpublished, the employee has not received this shift`)
        .concat(pending.map(t => `<b>${t.emp}</b> asked for ${lbl} off on ${t.requested} (${t.reason}): still Pending`)),
      fixes,
      impact:[ unpub.length && { l:'Unpublished shifts', v:String(unpub.length), tone:'warn' }, pending.length && { l:'Pending requests', v:String(pending.length), tone:'warn' } ].filter(Boolean),
      payoff:{ published: unpub.length },
      data: comp && unpub.length ? [siV2FilterIns(comp, 'Unpublished shifts', r => /Unpublished/i.test(r[4]))] : [],
      headlineImpact: siV2Plural(unpub.length || pending.length, unpub.length ? 'shift' : 'request') });
  }

  /* ---- what's going well ---- */
  const wins = [];
  const onF = open.filter(x => Math.abs(x.v) <= 0.5);
  if (onF.length >= 3) {
    const run = siDWindow(hours, x => (x.fc > 0.05 || x.sc > 0) && Math.abs(x.v) <= 0.5, () => 1);
    wins.push({ icon:'target', title:`${onF.length} of ${open.length} hours staffed right on forecast`, detail:`Longest on-forecast stretch: ${siDWinLbl(hours, run)}` });
  }
  if (!otR.length) wins.push({ icon:'clock', title:'No shift runs past 8 hours', detail:'No daily overtime and no Daily OT warnings' });
  const wkHrs = {}; weekRecs.forEach(r => { wkHrs[r.employeeName] = (wkHrs[r.employeeName] || 0) + r.hours; });
  const topEmp = Object.keys(wkHrs).sort((a, b) => wkHrs[b] - wkHrs[a])[0];
  if (wkHrs[topEmp] < 40) wins.push({ icon:'checkCircle', title:'No weekly overtime, double time or short turnarounds', detail:`Highest week: ${topEmp} at ${siDHrs(wkHrs[topEmp])}` });
  const cleanTypes = ['Minor', 'Meal Break', 'Availability', 'Time-Off Overlap'].filter(t => !cnt(t));
  if (cleanTypes.length === 4) wins.push({ icon:'shield', title:'No labor-rule conflicts', detail:'Minor, meal-break, availability and time-off rules are all met' });
  if (budVar >= -0.5 && under < 2) wins.push({ icon:'dollar', title:'On the labor budget', detail:`${siD2(agg.schLbrPerc)}% scheduled vs a ${siD2(SI_DAILY_CFG.BUDGET_PCT)}% budget` });
  const mgrHours = open.filter(x => x.on.some(r => SI_MGR_POS[r.position])).length;
  if (mgrHours === open.length) wins.push({ icon:'users', title:'A manager or shift lead is on every open hour', detail:`${open.length} of ${open.length} hours have management coverage` });
  const warnShifts = new Set(warns.map(w => w.r));
  const clean = dayRecs.length - warnShifts.size;
  if (clean / (dayRecs.length || 1) >= 0.5) wins.push({ icon:'check', title:`${clean} of ${dayRecs.length} shifts have no warnings`, detail:`${Math.round(clean / dayRecs.length * 100)}% warning-free` });
  if (!unpub.length && !ua.length) wins.push({ icon:'send', title:'Every shift is assigned and published', detail:'Employees have all their shift details' });

  return siV2Finish({ scope:'day', lbl, sub:`${dayRecs.length} shifts · ${siDHrs(agg.schHrs)} scheduled · ${siDHrs(agg.fctStaff)} forecasted`,
    problems, wins:wins.slice(0, 6),
    health:siV2Health({ over, budOver:-budVar, under, legal:legal.length, avail:avail.length, unassigned:ua.length, unpub:unpub.length }),
    stats:[ { l:'Scheduled vs forecast', v:siDSigned(agg.schHrs - agg.fctStaff, ' hrs'), tone: Math.abs(agg.schHrs - agg.fctStaff) > 3 ? 'bad' : 'good' },
            { l:'Labor budget', v:(budVar < 0 ? '−' : '+') + siD2(Math.abs(budVar)) + ' hrs', sub: budVar < 0 ? 'over' : 'under', tone: budVar < -0.5 ? 'bad' : 'good' },
            { l:'Daily overtime', v:siDMoney(otD), tone: otD > 0 ? 'bad' : 'good' },
            { l:'Legal risks', v:String(legal.length), tone: legal.length ? 'bad' : 'good' } ],
    oldCount: L.filter(i => i.short !== 'Schedule On Track').length });
}

/* the old compliance insight, cut down to the rows one problem is about */
function siV2FilterIns(ins, label, pred){
  const keep = ins.tableRows.map((r, i) => pred(r) ? i : -1).filter(i => i >= 0);
  return Object.assign({}, ins, { tableLabel:label, tableRows:keep.map(i => ins.tableRows[i]), tableRowTone:keep.map(i => (ins.tableRowTone || [])[i]), tableRowIcon:null });
}

/* ============================================================
   WEEK: the published week (Sep 01 – 07), told by root cause.
   Figures are the weekly insights' own (insights-nui-data.js).
   ============================================================ */
function siV2BuildWeek(){
  const W = id => SI_INS_WEEKLY.find(i => i.id === id);
  const problems = [
    { wid:'weekend', days:[5,6], theme:'hours', sev:'alert', title:'Weekend shifts are built 9 to 10 hours long',
      wrong:'The week ends up <b>59.90 hrs (2.01%) over the labor budget</b> and pays <b>$853.30 of overtime</b>, and Saturday and Sunday are <b>+73.02 staff-hours over forecast</b>.',
      cause:'The weekend template puts 24 of 34 shifts past 8 hrs. Nobody is near 40 hrs, so every OT hour comes from shift length. The weekday template works: Mon–Wed sit within 4–6 hrs of forecast.',
      affects:['Weekly Labor Budget','Over & Understaffing','Weekend Overtime','Schedule Compliance (24 Daily OT)'],
      why:[ '<b>24 weekend shifts</b> run past 8 hrs and add <b>27.74 hrs</b>: 46% of the hours over budget',
            '<b>Saturday (+36.97)</b> and <b>Sunday (+36.05)</b> are overstaffed in almost every hour of the day',
            'Managers hold <b>49% of the OT $</b> ($417.27): an OT hour costs $42.00 for a GM and $34.50 for an AM',
            '3 closers stay past midnight on the weekend, after the forecast drops off' ],
      fixes:[ { when:'Next schedule', title:'Cap Sat/Sun shifts at 8 hrs', detail:'Start with the 6 GM/AM shifts ($417.27)', outcome:'−27.74 hrs · −$853.30 OT · clears 24 Daily OT warnings' },
              { when:'Next schedule', title:'End the 3 past-midnight closers by 11:00 PM', detail:'Together with the 8-hr cap', outcome:'about −29 of the 73 weekend overstaffed hrs' },
              { when:'Before publish', title:'Turn on the 8-hour daily check', detail:'Any shift over 8 hrs is flagged before the schedule goes out', outcome:'stops it from coming back' } ],
      impact:[ { l:'Over labor budget', v:'−59.90 hrs | −2.01%', tone:'bad' }, { l:'Scheduled overtime', v:'$853.30', sub:'27.74 hrs', tone:'bad' },
               { l:'Weekend over forecast', v:'+73.02 hrs', tone:'bad' }, { l:'Daily OT warnings', v:'24', tone:'warn' } ],
      payoff:{ hrs:27.74, money:853.30, warnings:24 },
      data:[W(104), W(101), W(100)], headlineImpact:'$853.30 OT' },
    { wid:'friday', days:[4], theme:'coverage', sev:'alert', title:'Friday lost 3 line cooks to approved time off, and nobody replaced them',
      wrong:'Friday is <b>7.89 staff-hours short from 4:00 PM to close</b> and <b>3 shifts (17.50 hrs) sit Unassigned</b>, so the schedule can\'t be published. Friday shows as 12.94 hrs under budget, but that\'s missing coverage, not a saving.',
      cause:'Luis Hernandez, Diego Ruiz and Maria Santos were approved for Fri 09/05. Their shifts moved to the Unassigned row and nobody was assigned. Each one has a free Line Cook who stays well under 40 hrs.',
      affects:['Over & Understaffing','Unassigned Shifts','Time Off','Weekly Labor Budget (Fri under)'],
      why:[ '3 approved requests left <b>3 Line Cook shifts Unassigned</b> on Fri 09/05',
            'Friday runs <b>9.26 hrs scheduled vs 17.15 hrs</b> Forecasted Staff from 4:00 PM to close',
            'The pad shows "Cannot publish unassigned Shifts" until each shift has an employee',
            'Filling the 3 shifts covers <b>7.15 of the 7.89</b> short hours, inside Friday\'s budget' ],
      fixes:[ { when:'Today', title:'Assign Kevin Tran', detail:'10:30 AM – 5:00 PM Line Cook · week goes to 11.87 hrs · backup Carlos Mendoza', outcome:'shift can be published' },
              { when:'Today', title:'Assign Carlos Mendoza', detail:'3:00 PM – 9:00 PM Line Cook · week goes to 11.39 hrs · backup Rosa Delgado', outcome:'covers the dinner rush' },
              { when:'Today', title:'Assign Rosa Delgado', detail:'4:00 PM – 9:00 PM Line Cook · week goes to 10.87 hrs · backup Andre Wilson', outcome:'covers the dinner rush' },
              { when:'Going forward', title:'Open the shift for pick-up when time off is approved', detail:'Instead of leaving it Unassigned', outcome:'no silent gaps' } ],
      impact:[ { l:'Short staff-hours', v:'−7.89 hrs', sub:'4:00 PM – close', tone:'bad' }, { l:'Unassigned shifts', v:'3', sub:'17.50 hrs', tone:'bad' },
               { l:'Best matches found', v:'3 of 3', tone:'good' }, { l:'Friday unused budget', v:'+12.94 hrs', sub:'not a saving', tone:'warn' } ],
      payoff:{ covered:7.15, shifts:3 },
      data:[W(106), W(103), W(101)], headlineImpact:'−7.89 hrs short' },
    { wid:'rules', days:[0,1,2,3,4,5,6], theme:'rules', sev:'alert', title:'4 shifts break labor law, and 2 more overlap time off',
      wrong:'<b>Mia Lee</b> (16) and <b>Noah Davis</b> (17) are scheduled past their minor limits, <b>Daniel Reyes</b> and <b>Omar Haddad</b> have shifts over 10 hrs with no 2nd meal break, and <b>Juan Lopez</b> is still on Saturday after his vacation was approved.',
      cause:'These shifts were built without the minor, meal-break and time-off checks. They are legal risks, so fix them before the shifts are worked.',
      affects:['Schedule Compliance','Minor','Meal Break','Time-Off Overlap','Time Off'],
      why:[ '<b>Mia Lee</b> (16), Fri: 5.08 hrs on a school day → "Maximum Hrs Per Day rule of 4 Hrs has breached."',
            '<b>Noah Davis</b> (17), Sun 4:15 PM – 12:25 AM → "Minor Employee cannot be scheduled after 10:00 PM."',
            '<b>Daniel Reyes</b> (Sat) and <b>Omar Haddad</b> (Sun) over 10 hrs → "Meal Break rule breached."',
            '<b>Juan Lopez</b> approved for Sat 09/06, still scheduled 4:00 PM – 11:30 PM; <b>Sofia Bagley</b>\'s Sat request is still pending' ],
      fixes:[ { when:'Today', title:'Mia Lee ends 3:15 PM on Friday', detail:'Minor, age 16, school day', outcome:'legal risk cleared' },
              { when:'Today', title:'Noah Davis ends 10:00 PM on Sunday', detail:'Minor, age 17, school day next', outcome:'legal risk cleared' },
              { when:'Today', title:'Cut Daniel Reyes and Omar Haddad to 8 hrs', detail:'Or add a 2nd meal break', outcome:'2 legal risks cleared' },
              { when:'Today', title:'Remove Juan Lopez\'s Saturday shift', detail:'Approved vacation · Saturday stays over forecast without it', outcome:'time-off conflict cleared' } ],
      impact:[ { l:'Legal risks', v:'4', tone:'bad' }, { l:'Minor rule', v:'2', tone:'bad' }, { l:'Meal break', v:'2', tone:'bad' }, { l:'Time-off overlap', v:'2', tone:'warn' } ],
      payoff:{ legal:4, conflicts:2 },
      data:[siV2FilterIns(W(102), 'Rule violations', r => !/Daily OT|Unpublished/.test(r[0])), W(103)], headlineImpact:'4 legal risks' },
    { wid:'thursday', days:[3], theme:'hours', sev:'warn', title:'Thursday has one closing shift more than it needs',
      wrong:'Thursday is <b>+15.58 staff-hours over forecast</b> and <b>18.54 hrs (5.11%) over its labor budget</b>, the worst day of the week by %.',
      cause:'Thursday runs 14 shifts instead of the usual 13, and each runs about 40 minutes longer. The extra 4:00 – 10:55 PM closer is also the shift that breaks Ava Thompson\'s availability (until 9:00 PM).',
      affects:['Weekly Labor Budget','Over & Understaffing','Schedule Compliance (Availability)'],
      why:[ '<b>14 shifts</b> on Thursday vs 13 on a normal Mon–Wed', 'No shift runs past 8 hrs: the extra hours come from one more shift plus ~40 min of padding on each',
            'Overstaffed in <b>17 of 17 hours</b>; the biggest stretch is 1:00 PM – 6:00 PM (+7.37 hrs)' ],
      fixes:[ { when:'Next schedule', title:'Drop the extra 4:00 – 10:55 PM closing shift', detail:'6.95 hrs · also clears Ava Thompson\'s availability warning', outcome:'−6.95 hrs · 1 warning cleared' },
              { when:'Next schedule', title:'Remove the ~40 min padding per shift', detail:'Start or end Daniel Reyes, Hannah Cho, Mei Tanaka about an hour earlier or later', outcome:'about −8.6 hrs' } ],
      impact:[ { l:'Over forecast', v:'+15.58 hrs', tone:'bad' }, { l:'Over labor budget', v:'−18.54 hrs | −5.11%', tone:'bad' }, { l:'Extra shifts', v:'1', sub:'4:00 – 10:55 PM', tone:'warn' } ],
      payoff:{ hrs:15.55, money:15.55 * SI_DAILY_CFG.AVG_RATE, warnings:1 },
      data:[W(100), W(101)], headlineImpact:'−18.54 hrs vs budget' },
    { wid:'publish', days:[0,1,2,3,4,5,6], theme:'publish', sev:'warn', title:'8 shifts are unpublished and 5 time-off requests are waiting',
      wrong:'<b>7 employees</b> don\'t have the details of 8 shifts (44.56 hrs), and <b>5 requests</b> are still pending, 4 of them for Sep 18 – 20.',
      cause:'Shifts on Tue, Wed and Fri were changed and never re-published, and pending requests weren\'t decided before the next schedule is built.',
      affects:['Unpublished Shifts','Time Off','Schedule Compliance (8 Unpublished)'],
      why:[ 'All 8 are opening and mid-day shifts on Tue, Wed and Fri; Priya Nair (GM) has 2 of them',
            'Sofia Bagley\'s Sat 09/06 request has waited <b>9 days</b> and overlaps a scheduled shift',
            'Two employees ask for Sat 09/19 off, so cover needs lining up before approving' ],
      fixes:[ { when:'Today', title:'Publish the schedule', detail:'All 8 shifts reach the 7 employees', outcome:'7 employees get their shifts' },
              { when:'Today', title:'Decide Sofia Bagley\'s Sat 09/06 request', detail:'Waiting 9 days · overlaps her 4:00 – 10:50 PM shift', outcome:'no surprise no-show' },
              { when:'Before publish', title:'Decide the 4 pending requests for Sep 18 – 20', detail:'Liam Rodriguez and Isabella Flores are under 11 hrs and can cover Sat 09/19', outcome:'next schedule built on decided time off' } ],
      impact:[ { l:'Unpublished shifts', v:'8', sub:'44.56 hrs', tone:'warn' }, { l:'Employees affected', v:'7', tone:'warn' }, { l:'Pending requests', v:'5', tone:'warn' } ],
      payoff:{ published:8 },
      data:[W(105), W(103)], headlineImpact:'8 unpublished' },
  ];
  const wins = [
    { icon:'target', title:'Mon–Wed sit within 4–6 hours of forecast', detail:'The weekday template works: the problems are weekend and Thursday only' },
    { icon:'checkCircle', title:'No weekly overtime, double time or clopenings', detail:'Highest week: Priya Nair at 29.45 hrs · no 7th consecutive day' },
    { icon:'dollar', title:'Tuesday and Wednesday are on budget', detail:'20.32% and 20.65% scheduled vs a 20.00% budget' },
    { icon:'check', title:'62 of 98 shifts have no warnings', detail:'63.3% warning-free · Monday is a clean day' },
    { icon:'users', title:'Every open shift has a ready replacement', detail:'3 of 3 Unassigned shifts and 24 of 24 OT hours have a free, same-position match' },
  ];
  return siV2Finish({ scope:'week', lbl:'Week of Sep 01 – Sep 07', sub:'98 shifts · 656.34 hrs scheduled · 551.15 hrs forecasted',
    problems, wins,
    health:siV2Health({ over:114.54 / 7, budOver:59.90 / 7, under:9.35 / 7, legal:4, avail:1, unassigned:3, unpub:8 }),   // weekly figures as a per-day average
    stats:[ { l:'Scheduled vs forecast', v:'+105.19 hrs', tone:'bad' }, { l:'Labor budget', v:'−59.90 hrs', sub:'over', tone:'bad' },
            { l:'Scheduled overtime', v:'$853.30', tone:'bad' }, { l:'Legal risks', v:'4', tone:'bad' } ],
    oldCount: SI_INS_WEEKLY.length });
}

/* shared tail: order problems, number fix steps, total the payoff */
function siV2Finish(b){
  const rank = { alert:0, warn:1 };
  b.problems.sort((x, y) => rank[x.sev] - rank[y.sev]);
  b.problems.forEach((p, i) => { p.key = b.scope + ':' + (b.lbl || '') + ':' + p.theme + i; p.fixes.forEach((f, j) => { f.id = p.key + ':' + j; f.pIdx = i; }); });
  const P = k => b.problems.reduce((s, p) => s + ((p.payoff && p.payoff[k]) || 0), 0);
  b.payoff = { hrs:P('hrs'), money:P('money'), warnings:P('warnings'), legal:P('legal'), covered:P('covered'), shifts:P('shifts'), published:P('published'), conflicts:P('conflicts') };
  b.fixCount = b.problems.reduce((s, p) => s + p.fixes.length, 0);
  const top = b.problems[0];
  b.headline = !top ? `${b.lbl} is on track: nothing needs fixing.`
    : b.scope === 'week' ? 'The week is 59.90 hrs over budget. One template change, capping weekend shifts at 8 hrs, fixes almost half of it.'
    : `${top.title}. ${b.problems.length > 1 ? `That and ${siV2Plural(b.problems.length - 1, 'other problem')} need a fix before the shifts start.` : 'Fix it before the shifts start.'}`;
  b.summary = !top ? 'Every check passed for this schedule.'
    : `The old view showed this as ${siV2Plural(b.oldCount, 'separate insight')}. They come down to ${siV2Plural(b.problems.length, 'root cause')}, with ${siV2Plural(b.fixCount, 'fix', 'fixes')} below.`;
  return b;
}

/* ============================================================
   ALL: one list, no Day / Week switch. The published week's root causes
   plus the selected day's problems. A day problem that is part of a weekly
   root cause (Sun's long shifts → "Weekend shifts are built 9–10 hrs long")
   is shown INSIDE that card as "On <day>", never as a second card. Day
   problems no weekly cause explains get their own card.
   ============================================================ */
function siV2BuildAll(date){
  const day = siV2BuildDay(date);
  if (day.empty) return day;
  const g = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - SI_DD_ANCHOR) / 86400000);
  const inPublishedWeek = Math.floor(g / 7) === SI_DD_WEEKS.length - 1;
  if (!inPublishedWeek) return day;                 // weekly insights exist for the published week only
  const week = siV2BuildWeek();
  const dIdx = ((g % 7) + 7) % 7;                   // 0 = Mon
  const problems = week.problems.map(p => Object.assign({}, p, { scope:week.lbl, today:null }));
  const extra = [];
  day.problems.forEach(dp => {
    // hours: weekend / Thursday each have their own weekly cause; other themes have one each
    const host = problems.find(p => p.theme === dp.theme && p.days.indexOf(dIdx) >= 0);
    if (host) {
      // keep only the day's steps no weekly card already has (same person or same step)
      const names = s => (s.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || []);
      const same = (h, f) => h.title.toLowerCase() === f.title.toLowerCase() || names(f.title).some(n => (h.title + ' ' + h.detail).indexOf(n) >= 0);
      const weekFixes = problems.flatMap(p => p.fixes);
      const fixes = dp.fixes.filter(f => !weekFixes.some(h => same(h, f)));
      host.today = Object.assign({ lbl:day.lbl }, dp, { fixes, covered: dp.fixes.length - fixes.length });
    }
    else extra.push(Object.assign({}, dp, { scope:day.lbl }));
  });
  const rank = { alert:0, warn:1 };
  // weekly causes that touch the selected day come first, then the day-only ones, then the rest
  const all = problems.filter(p => p.today).concat(extra, problems.filter(p => !p.today))
    .sort((x, y) => rank[x.sev] - rank[y.sev]);
  const seen = new Set(), wins = [];
  day.wins.map(w => Object.assign({ scope:day.lbl }, w)).concat(week.wins.map(w => Object.assign({ scope:'This week' }, w))).forEach(w => {
    const k = w.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 18);
    if (!seen.has(k) && wins.length < 8) { seen.add(k); wins.push(w); }
  });
  const P = k => all.reduce((s, p) => s + ((p.payoff && p.payoff[k]) || 0), 0);   // a day block is part of its weekly cause: not added again
  const fixCount = all.reduce((s, p) => s + p.fixes.length + (p.today ? p.today.fixes.length : 0), 0);
  const topDay = day.problems[0];
  return { scope:'all', lbl:day.lbl, sub:`${day.sub} · ${week.lbl}: ${week.sub}`,
    problems:all, wins, health:week.health, stats:week.stats, fixCount,
    payoff:{ hrs:P('hrs'), money:P('money'), warnings:P('warnings'), legal:P('legal'), covered:P('covered'), shifts:P('shifts'), published:P('published'), conflicts:P('conflicts') },
    headline: week.headline,
    summary:`${topDay ? `<b>${day.lbl}:</b> ${topDay.title}${day.problems.length > 1 ? ` (+${siV2Plural(day.problems.length - 1, 'more problem')})` : ''}. ` : `<b>${day.lbl}</b> is on track. `}`
      + `The old view showed the week and this day as ${siV2Plural(week.oldCount + day.oldCount, 'separate insight')}; here they come down to ${siV2Plural(all.length, 'root cause')}, with ${siV2Plural(fixCount, 'fix', 'fixes')}.` };
}

/* ============================================================
   Rendering
   ============================================================ */
function siV2Fmt$(n){ return '$' + Math.round(n).toLocaleString('en-US'); }

function siV2ToolbarHtml(b){
  const d = SI_V2.date, t = SI_V2.updatedAt || new Date();
  const time = ((t.getHours() + 11) % 12 + 1) + ':' + String(t.getMinutes()).padStart(2, '0') + (t.getHours() < 12 ? ' AM' : ' PM');
  const left = typeof siInsRefreshesLeft === 'function' ? siInsRefreshesLeft() : 3;
  return `<div class="v2-bar">
    <div class="v2-bar-l">
      <span class="v2-bar-lbl">${siV2Ic('calendar', 14)}Insights for</span>
      <label class="v2-date"><input type="date" value="${siInsIso(d)}" min="2026-07-14" max="2026-09-07" onkeydown="return false" onclick="this.showPicker && this.showPicker()" onchange="siV2SetDate(this.value)"></label>
      <span class="v2-chip">Week of ${siInsWeekLabel(d)}</span>
    </div>
    <div class="v2-bar-r">
      <span class="v2-updated">Updated ${time}</span>
      <button class="v2-refresh${left ? '' : ' off'}" onclick="siV2Refresh()" title="${left} refreshes left today">${siV2Ic('refresh', 14)}Refresh</button>
    </div>
  </div>`;
}

function siV2RingHtml(h){
  const R = 46, C = 2 * Math.PI * R, off = C * (1 - h.score / 100);
  return `<div class="v2-ring t-${h.tone}" title="Schedule health ${h.score}/100">
    <svg viewBox="0 0 110 110" width="118" height="118"><circle cx="55" cy="55" r="${R}" class="trk"/><circle cx="55" cy="55" r="${R}" class="val" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>
    <div class="v2-ring-tx"><b>${h.score}</b><span>/ 100</span></div>
  </div>`;
}

function siV2HeroHtml(b){
  const done = siV2DoneMap();
  const doneN = b.problems.reduce((s, p) => s + siV2AllFixes(p).filter(f => done[f.id]).length, 0);
  return `<section class="v2-hero">
    <div class="v2-hero-main">
      <div class="v2-eyebrow"><span class="v2-ai">${siV2Ic('spark', 13)}AI briefing</span><span>${b.lbl}</span><span class="dot">•</span><span>${b.sub}</span></div>
      <h2 class="v2-headline">${b.headline}</h2>
      <p class="v2-summary">${b.summary}</p>
      <div class="v2-story">
        <a class="v2-story-i good" href="#v2-wins" onclick="return siV2Jump('v2-wins')">${siV2Ic('checkCircle', 15)}<b>${b.wins.length}</b> going well</a>
        <span class="v2-story-sep">${siV2Ic('arrow', 13)}</span>
        <a class="v2-story-i bad" href="#v2-probs" onclick="return siV2Jump('v2-probs')">${siV2Ic('x', 15)}<b>${b.problems.length}</b> went wrong</a>
        <span class="v2-story-sep">${siV2Ic('arrow', 13)}</span>
        <a class="v2-story-i fix" href="#v2-plan" onclick="return siV2Jump('v2-plan')">${siV2Ic('wrench', 15)}<b>${doneN}/${b.fixCount}</b> fixes done</a>
      </div>
    </div>
    <div class="v2-hero-side">
      <div class="v2-health">
        ${siV2RingHtml(b.health)}
        <div><div class="v2-health-l">Schedule health</div><div class="v2-health-v t-${b.health.tone}">${b.health.label}</div></div>
      </div>
      <div class="v2-hstats">${b.stats.map(s => `<div class="v2-hstat t-${s.tone}"><span>${s.l}</span><b>${s.v}${s.sub ? `<em>${s.sub}</em>` : ''}</b></div>`).join('')}</div>
    </div>
  </section>`;
}

function siV2WinsHtml(b){
  if (!b.wins.length) return '';
  return `<section class="v2-sec" id="v2-wins">
    <div class="v2-sec-h"><span class="v2-sec-ic good">${siV2Ic('checkCircle', 16)}</span><div><h3>What's going well</h3><p>Keep doing this. These parts of the schedule need no change.</p></div></div>
    <div class="v2-wins">${b.wins.map(w => `<div class="v2-win"><span class="v2-win-ic">${siV2Ic(w.icon, 16)}</span><div>${w.scope ? `<em class="v2-win-scope">${w.scope}</em>` : ''}<b>${w.title}</b><span>${w.detail}</span></div></div>`).join('')}</div>
  </section>`;
}

/* fix steps list (used for a card's own steps and for its "On <day>" block) */
function siV2FixesHtml(fixes, done){
  return `<ol class="v2-fixes">${fixes.map(f => `<li class="${done[f.id] ? 'done' : ''}">
    <button class="v2-tick" onclick="siV2ToggleDone('${f.id}')" title="${done[f.id] ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${!!done[f.id]}">${siV2Ic('check', 13, 3)}</button>
    <div class="v2-fix-tx"><div class="v2-fix-t"><span class="v2-when">${f.when}</span>${f.title}</div><div class="v2-fix-d">${f.detail}</div>
      <div class="v2-out">${siV2Ic('arrow', 12)}${f.outcome}</div></div>
  </li>`).join('')}</ol>`;
}
const siV2AllFixes = p => p.fixes.concat(p.today ? p.today.fixes : []);

function siV2ProblemHtml(p, i){
  const done = siV2DoneMap();
  const isOpen = SI_V2.open[p.key] != null ? SI_V2.open[p.key] : i === 0;
  const th = SI_V2_THEME[p.theme];
  const allFixes = siV2AllFixes(p);
  const doneN = allFixes.filter(f => done[f.id]).length;
  const t = p.today;
  const dataOpen = !!SI_V2.dataOpen[p.key];
  const tab = Math.min(SI_V2.dataTab[p.key] || 0, Math.max(0, p.data.length - 1));
  const d = p.data[tab];
  return `<article class="v2-prob s-${p.sev}${isOpen ? ' open' : ''}${doneN === allFixes.length && allFixes.length ? ' solved' : ''}">
    <button class="v2-prob-h" onclick="siV2Toggle('${p.key}')" aria-expanded="${isOpen}">
      <span class="v2-prob-n">${i + 1}</span>
      <span class="v2-prob-ic">${siV2Ic(th.icon, 18)}</span>
      <span class="v2-prob-tx">
        <span class="v2-prob-top"><span class="v2-sev">${p.sev === 'alert' ? 'Fix first' : 'Fix soon'}</span><span class="v2-theme">${th.label}</span>
          ${p.scope ? `<span class="v2-scope">${siV2Ic('calendar', 11)}${p.scope}</span>` : ''}${t ? `<span class="v2-scope day">${siV2Ic('flag', 11)}Also on ${t.lbl}</span>` : ''}
          ${doneN ? `<span class="v2-prog">${doneN}/${allFixes.length} fixed</span>` : ''}</span>
        <span class="v2-prob-t">${p.title}</span>
        <span class="v2-affects">${siV2Ic('link', 12)}Shows up in ${p.affects.map(a => `<i>${a}</i>`).join('')}</span>
      </span>
      <span class="v2-prob-imp">${p.headlineImpact}</span>
      <span class="v2-chev">${siV2Ic('chev', 18)}</span>
    </button>
    <div class="v2-prob-b">
      <div class="v2-step-h"><span class="v2-step bad">1</span>What went wrong</div>
      <p class="v2-wrong">${p.wrong}</p>
      ${p.impact.length ? `<div class="v2-impact">${p.impact.map(m => `<div class="v2-imp t-${m.tone}"><span>${m.l}</span><b>${m.v}</b>${m.sub ? `<em>${m.sub}</em>` : ''}</div>`).join('')}</div>` : ''}
      ${t ? `<div class="v2-today">
        <div class="v2-today-h">${siV2Ic('flag', 14)}On ${t.lbl}<span>the selected day, part of this same root cause</span></div>
        <div class="v2-today-t">${t.title}</div>
        <p class="v2-today-w">${t.wrong}</p>
        ${t.impact.length ? `<div class="v2-today-imp">${t.impact.map(m => `<span class="t-${m.tone}">${m.l} <b>${m.v}</b></span>`).join('')}</div>` : ''}
        ${t.fixes.length ? `<div class="v2-today-f">${siV2FixesHtml(t.fixes, done)}</div>` : ''}
        ${t.covered ? `<div class="v2-today-note">${siV2Ic('check', 12, 3)}${t.fixes.length ? `${siV2Plural(t.covered, 'more fix', 'more fixes')} for ${t.lbl} ${t.covered > 1 ? 'are' : 'is'} already in the steps below` : `The steps below already fix ${t.lbl}`}</div>` : ''}
      </div>` : ''}
      <div class="v2-cols">
        <div class="v2-col">
          <div class="v2-step-h"><span class="v2-step warn">2</span>The problem</div>
          <div class="v2-cause">${p.cause}</div>
          <div class="v2-why-h">Why it happened</div>
          <ul class="v2-why">${p.why.map(w => `<li>${w}</li>`).join('')}</ul>
        </div>
        <div class="v2-col">
          <div class="v2-step-h"><span class="v2-step good">3</span>How to fix it</div>
          ${siV2FixesHtml(p.fixes, done)}
        </div>
      </div>
      ${p.data.length ? `<div class="v2-data${dataOpen ? ' open' : ''}">
        <button class="v2-data-h" onclick="siV2ToggleData('${p.key}')"><span class="v2-step info">4</span>Related data<span class="v2-data-n">${siV2Plural(p.data.length, 'table')}</span><span class="v2-chev">${siV2Ic('chev', 16)}</span></button>
        ${dataOpen ? `<div class="v2-data-b">
          ${p.data.length > 1 ? `<div class="v2-tabs">${p.data.map((x, k) => `<button class="${k === tab ? 'on' : ''}" onclick="siV2DataTab('${p.key}', ${k})">${x.tableLabel}</button>`).join('')}</div>` : ''}
          <div class="v2-tbl-sub">${d.tableSub || ''}</div>
          <div class="v2-tbl">${siInsRenderModernTable(d)}</div>
          ${d.table2 ? `<div class="v2-tbl-sub">${d.table2.label} · ${d.table2.sub}</div><div class="v2-tbl">${siInsRenderModernTable({ tableHeaders:d.table2.headers, tableRows:d.table2.rows, tableRowTone:d.table2.tone, noTotal:true })}</div>` : ''}
        </div>` : ''}
      </div>` : ''}
    </div>
  </article>`;
}

function siV2PlanHtml(b){
  const done = siV2DoneMap();
  const all = b.problems.flatMap((p, i) => p.fixes.map(f => Object.assign({ p, i }, f))
    .concat(p.today ? p.today.fixes.map(f => Object.assign({ p, i, day:p.today.lbl }, f)) : []));
  const doneN = all.filter(f => done[f.id]).length;
  const order = ['Today', 'Before the shift', 'Before publish', 'Next schedule', 'Going forward'];
  const groups = order.map(w => ({ w, items: all.filter(f => f.when === w) })).filter(g => g.items.length);
  const pct = all.length ? Math.round(doneN / all.length * 100) : 100;
  const pay = b.payoff, out = [];
  if (pay.hrs) out.push(`<li><b>−${siD2(pay.hrs)} hrs</b> of labor${pay.money ? `, about <b>${siV2Fmt$(pay.money)}</b>` : ''}</li>`);
  if (pay.warnings) out.push(`<li><b>${siV2Plural(Math.round(pay.warnings), 'warning')}</b> cleared</li>`);
  if (pay.legal) out.push(`<li><b>${siV2Plural(pay.legal, 'legal risk')}</b> removed</li>`);
  if (pay.shifts) out.push(`<li><b>${siV2Plural(pay.shifts, 'open shift')}</b> filled${pay.covered ? `, covering ${siD2(pay.covered)} short hrs` : ''}</li>`);
  else if (pay.covered) out.push(`<li><b>${siD2(pay.covered)} short hrs</b> covered</li>`);
  if (pay.published) out.push(`<li><b>${siV2Plural(pay.published, 'shift')}</b> published</li>`);
  return `<aside class="v2-plan" id="v2-plan">
    <div class="v2-plan-h"><div><h3>Your fix plan</h3><p>${siV2Plural(all.length, 'step')} across ${siV2Plural(b.problems.length, 'problem')}</p></div>
      <div class="v2-plan-pct"><b>${pct}%</b><span>done</span></div></div>
    <div class="v2-plan-bar"><i style="width:${pct}%"></i></div>
    ${groups.map(g => `<div class="v2-plan-g"><div class="v2-plan-w">${g.w}</div>
      ${g.items.map(f => `<label class="v2-plan-i${done[f.id] ? ' done' : ''}">
        <button class="v2-tick" onclick="siV2ToggleDone('${f.id}')" aria-pressed="${!!done[f.id]}">${siV2Ic('check', 12, 3)}</button>
        <span class="v2-plan-tx"><b>${f.title}</b><span onclick="siV2OpenProblem('${f.p.key}')">#${f.i + 1}${f.day ? ' · ' + f.day : ''} ${f.p.title}</span></span>
      </label>`).join('')}</div>`).join('')}
    ${out.length ? `<div class="v2-payoff"><div class="v2-payoff-h">${siV2Ic('trend', 15)}If you do all of this</div><ul>${out.join('')}</ul></div>` : ''}
  </aside>`;
}

/* no Day / Week switch: one list with the week's root causes and the selected day's problems */
function siV2Build(){ return siV2BuildAll(SI_V2.date); }

function siV2Render(){
  const root = document.getElementById('tab-insights-v2');
  if (!root) return;
  if (!SI_V2.date) SI_V2.date = new Date(2026, 8, 7);          // latest scheduled day in the data
  if (!SI_V2.updatedAt) SI_V2.updatedAt = new Date();
  const b = siV2Build();
  if (b.empty) {
    root.innerHTML = `<div class="v2">${siV2ToolbarHtml({ lbl:'' })}<div class="v2-empty">${siV2Ic('calendar', 28)}<h3>No published schedule for this date</h3><p>Pick a day between Jul 14 and Sep 07, 2026.</p></div></div>`;
    return;
  }
  SI_V2.current = b;
  root.innerHTML = `<div class="v2">
    ${siV2ToolbarHtml(b)}
    ${siV2HeroHtml(b)}
    <div class="v2-grid">
      <div class="v2-main">
        ${siV2WinsHtml(b)}
        <section class="v2-sec" id="v2-probs">
          <div class="v2-sec-h"><span class="v2-sec-ic bad">${siV2Ic('x', 16)}</span><div><h3>What went wrong</h3><p>${b.problems.length ? 'One card per root cause, not per KPI. Each card lists the KPIs it shows up in.' : 'Nothing. Every check passed.'}</p></div></div>
          ${b.problems.length ? b.problems.map(siV2ProblemHtml).join('') : `<div class="v2-allgood">${siV2Ic('checkCircle', 26)}<div><b>${b.lbl} is on track</b><span>No over- or understaffing, no budget gap and no rule warnings.</span></div></div>`}
        </section>
      </div>
      ${b.problems.length ? siV2PlanHtml(b) : ''}
    </div>
  </div>`;
}

/* ---------- interactions (keep scroll, re-render) ---------- */
function siV2Rerender(){ const y = window.scrollY, body = document.querySelector('.si-body'), by = body ? body.scrollTop : 0; siV2Render(); window.scrollTo(0, y); if (body) body.scrollTop = by; }
function siV2SetDate(iso){ if (!iso) return; const [y, m, d] = iso.split('-').map(Number); SI_V2.date = new Date(y, m - 1, d); SI_V2.open = {}; siV2Render(); }
function siV2Toggle(key){ const b = SI_V2.current, i = b ? b.problems.findIndex(p => p.key === key) : -1; const cur = SI_V2.open[key] != null ? SI_V2.open[key] : i === 0; SI_V2.open[key] = !cur; siV2Rerender(); }
function siV2ToggleData(key){ SI_V2.dataOpen[key] = !SI_V2.dataOpen[key]; siV2Rerender(); }
function siV2DataTab(key, k){ SI_V2.dataTab[key] = k; siV2Rerender(); }
function siV2ToggleDone(id){ const m = siV2DoneMap(); if (m[id]) delete m[id]; else m[id] = 1; siV2SaveDone(m); siV2Rerender(); }
function siV2OpenProblem(key){ SI_V2.open[key] = true; siV2Rerender(); const el = [...document.querySelectorAll('.v2-prob')].find(a => a.querySelector(`[onclick="siV2Toggle('${key}')"]`)); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }
function siV2Jump(id){ const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); return false; }
function siV2Refresh(){
  const left = typeof siInsRefreshesLeft === 'function' ? siInsRefreshesLeft() : 1;
  if (left <= 0) { if (typeof siInsToast === 'function') siInsToast('No refreshes left today. You can refresh again tomorrow.'); return; }
  try { const k = siInsRefreshKey(); localStorage.setItem(k, String((parseInt(localStorage.getItem(k), 10) || 0) + 1)); } catch (e) {}
  const btn = document.querySelector('.v2-refresh'); if (btn) btn.classList.add('spin');
  setTimeout(() => { SI_V2.updatedAt = new Date(); siV2Render(); if (typeof siInsToast === 'function') siInsToast(`Insights refreshed. ${Math.max(0, left - 1)} refresh${left - 1 === 1 ? '' : 'es'} left today.`); }, 450);
}

if (typeof window !== 'undefined') Object.assign(window, { siV2Render, siV2SetDate, siV2Toggle, siV2ToggleData, siV2DataTab, siV2ToggleDone, siV2OpenProblem, siV2Jump, siV2Refresh });
