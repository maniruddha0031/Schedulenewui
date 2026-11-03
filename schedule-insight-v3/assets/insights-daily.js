/* ============================================================
   Schedule Insight — DAILY insights, generated for the date picked
   in the "Insights for" bar (any day in the Deep Dive data,
   Jul 14 – Sep 07, 2026). Each insight is built from that day's
   shifts (deepdive-data.js) with Zip Schedule rules (HW Release):

     Schedule Compliance  schedule-pad warnings with the product's own text:
                          Daily OT (> 8 hrs), Meal Break (> 10 hrs), Minor
                          (4 hrs on a school day, not after 10:00 PM before a
                          school day), Availability, Time-off overlap,
                          unpublished shift (employee doesn't have it yet)
     Overstaffing /       store-level Forecasted Staff vs Scheduled Staff per
     Understaffing        hour (Staff O/S report). The forecast is for the
                          store, not per position, so staffing is never
                          judged by position.
     Labor Budget         Labor Budget % 20.0 · Labor Budget Hrs = budget $ ÷
                          Average Pay Rate $18.60
     Overtime             hours past 8 in a shift, paid at 1.5×
     Time Off             requests touching the day (Approved / Pending)
   ============================================================ */

const SI_DAILY_CFG = {
  BUDGET_PCT: 20,          // configured Labor Budget %
  AVG_RATE: 12210.48 / 656.34,   // configured Average Pay Rate ($18.60)
  AVG_CHECK: 12.50,        // forecast $ per transaction (Fcst Transactions)
  SCHOOL_HOLIDAYS: ['2026-09-01'],          // Labor Day
  MINORS: { 'Mia Lee':16, 'Noah Davis':17 },
  MINOR_SCHOOL_DAY_MAX: { 16:4, 17:8 },     // max hrs on a school day, by age
  AVAIL_UNTIL: { 'Ava Thompson':21 },       // available until 9:00 PM
  TIMEOFF: [
    { emp:'Luis Hernandez', date:'2026-09-05', reason:'Family trip',        status:'Approved', requested:'08/18' },
    { emp:'Diego Ruiz',     date:'2026-09-05', reason:'Moving apartments',  status:'Approved', requested:'08/25' },
    { emp:'Maria Santos',   date:'2026-09-05', reason:'Doctor appointment', status:'Approved', requested:'09/04' },
    { emp:'Juan Lopez',     date:'2026-09-06', reason:'Family wedding',     status:'Approved', requested:'08/20', action:'08/22' },
    { emp:'Sofia Bagley',   date:'2026-09-06', reason:'Personal errand',    status:'Pending',  requested:'08/28' },
  ],
  /* Unassigned Shifts (no employee on the shift — "Cannot publish unassigned
     Shifts"): approved time off moved these shifts to Unassigned */
  UNASSIGNED: [
    { date:'2026-09-05', pos:'Line Cook', start:10.5, end:17, reason:'Time off approved: Diego Ruiz' },
    { date:'2026-09-05', pos:'Line Cook', start:15,   end:21, reason:'Time off approved: Luis Hernandez' },
    { date:'2026-09-05', pos:'Line Cook', start:16,   end:21, reason:'Time off approved: Maria Santos' },
  ],
};
const SI_MGR_POS = { 'General Manager':'GM', 'Assistant Manager':'AM', 'Shift Leader':'SL' };

/* ---- small formatters ---- */
const siD2 = n => (Math.round(n * 100) / 100).toFixed(2);
const siDHrs = n => siD2(n) + ' hrs';
const siDMoney = n => (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
const siDSigned = (n, unit) => (n > 0 ? '+' : n < 0 ? '−' : '') + siD2(Math.abs(n)) + (unit || '');
const siDIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const siDDayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function siDDateOfIdx(g){ const d = new Date(SI_DD_ANCHOR.getTime()); d.setDate(d.getDate() + g); return d; }
function siDLabel(g){ const d = siDDateOfIdx(g); return siDDayName[g % 7] + ' ' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'); }
function siDIsSchoolDay(g){ return g % 7 < 5 && SI_DAILY_CFG.SCHOOL_HOLIDAYS.indexOf(siDIso(siDDateOfIdx(g))) < 0; }
const siDOverlap = (r, a, b) => Math.max(0, Math.min(b, r.start + r.hours) - Math.max(a, r.start));
const siDFirst = n => n.split(' ')[0];

/* store-level demand curve: the week's normal Mon–Wed staffing shape for
   weekdays, Sat/Sun shape for the weekend, Friday weighted to 5:00 – 9:00 PM */
function siDHourModel(weekRecs, dayRecs, dayIdx){
  const HS = []; for (let h = 6; h < 25; h++) HS.push(h);
  const shape = (days, boost) => HS.map(h => days.reduce((s, d) => s + weekRecs.filter(r => r.dayIdx === d).reduce((t, r) => t + siDOverlap(r, h, h + 1), 0), 0) * (boost && h >= 17 && h < 21 ? boost : 1));
  const W = dayIdx >= 5 ? shape([5, 6]) : dayIdx === 4 ? shape([0, 1, 2], 1.9) : shape([0, 1, 2]);
  const sw = W.reduce((s, x) => s + x, 0) || 1;
  const agg = deepdiveAggregate(dayRecs);
  return HS.map((h, i) => {
    const fc = agg.fctStaff * W[i] / sw;
    const on = dayRecs.filter(r => siDOverlap(r, h, h + 1) > 0);
    const sc = dayRecs.reduce((s, r) => s + siDOverlap(r, h, h + 1), 0);
    return { h, fc, sc, v: sc - fc, on, trans: Math.round(agg.fctSales * (fc / (agg.fctStaff || 1)) / SI_DAILY_CFG.AVG_CHECK) };
  });
}
const siDHourLbl = h => siDdClock(h) + ' – ' + (h + 1 >= 25 ? 'close' : siDdClock(h + 1));

/* ---- warnings for one day (schedule-pad rules) ---- */
function siDWarnings(dayRecs, g){
  const W = [];
  const dateIso = siDIso(siDDateOfIdx(g));
  const nextSchool = siDIsSchoolDay(g + 1);
  dayRecs.forEach(r => {
    const end = r.start + r.hours;
    if (SI_DAILY_CFG.MINORS[r.employeeName]) {
      const mx = SI_DAILY_CFG.MINOR_SCHOOL_DAY_MAX[SI_DAILY_CFG.MINORS[r.employeeName]];
      if (siDIsSchoolDay(g) && r.hours > mx) W.push({ r, type:'Minor', legal:true, msg:'Maximum Hrs Per Day rule of ' + mx + ' Hrs has breached.', fix:'End at ' + siDdClock(r.start + mx) });
      if (nextSchool && end > 22) W.push({ r, type:'Minor', legal:true, msg:'Minor Employee cannot be scheduled after 10:00 PM.', fix:'End at 10:00 PM' });
    }
    if (r.hours > 10) W.push({ r, type:'Meal Break', legal:true, prem:r.rate, msg:'Meal Break rule breached. A break to be provided in a shift more than 10 Hrs.', fix:'End at ' + siDdClock(r.start + 8) + ' (8 hrs), or add a 2nd meal break' });
    const until = SI_DAILY_CFG.AVAIL_UNTIL[r.employeeName];
    if (until && end > until) W.push({ r, type:'Availability', msg:'Employee is not available. Employee is available between ' + siDdClock(r.start) + ' and ' + siDdClock(until) + '.', fix:'End at ' + siDdClock(until) });
    const to = SI_DAILY_CFG.TIMEOFF.find(t => t.emp === r.employeeName && t.date === dateIso);
    if (to) W.push({ r, type:'Time-Off Overlap', legal:to.status === 'Approved', msg: to.status === 'Approved' ? 'Shift overlapping with Timeoff.' : 'Overlapping Approved/Pending Time Off exists.', fix: to.status === 'Approved' ? 'Remove the shift (time off approved ' + (to.action || to.requested) + ')' : 'Approve or Disapprove the request, then update the shift' });
    if (r.compliance < 95) W.push({ r, type:'Unpublished', msg:'Unpublished shift: the employee has not received this shift.', fix:'Publish the schedule so the employee gets the shift' });
    if (r.hours > 8) W.push({ r, type:'Daily OT', msg:'Daily OT rule of 8 Hrs has breached.', fix:'End at ' + siDdClock(r.start + 8) });
  });
  const order = { 'Minor':0, 'Meal Break':1, 'Time-Off Overlap':2, 'Availability':3, 'Unpublished':4, 'Daily OT':5 };
  return W.sort((a, b) => order[a.type] - order[b.type] || b.r.hours - a.r.hours);
}

/* employees free that day: not scheduled, no time off, lowest hours this week */
function siDAvailable(weekRecs, dayRecs, g, n){
  const on = new Set(dayRecs.map(r => r.employeeName));
  const off = new Set(SI_DAILY_CFG.TIMEOFF.filter(t => t.date === siDIso(siDDateOfIdx(g))).map(t => t.emp));
  const hrs = {}; weekRecs.forEach(r => { hrs[r.employeeName] = (hrs[r.employeeName] || 0) + r.hours; });
  return SI_DD_EMPLOYEES.filter(e => !on.has(e.name) && !off.has(e.name) && !SI_DAILY_CFG.MINORS[e.name])
    .map(e => ({ name:e.name, pos:e.position, hrs:hrs[e.name] || 0 })).sort((a, b) => a.hrs - b.hrs).slice(0, n);
}


/* the schedule pad has no dayparts: staffing problems are named by the
   contiguous run of hours where they happen ("4:00 PM – close") */
function siDWindow(hours, pred, weight){
  let best = { a:6, b:7, sum:0, fc:0, sc:0 }, cur = null;
  hours.forEach(x => {
    if (pred(x)) { if (!cur) cur = { a:x.h, b:x.h + 1, sum:0, fc:0, sc:0 }; cur.b = x.h + 1; cur.sum += weight(x); cur.fc += x.fc; cur.sc += x.sc; }
    else { if (cur && cur.sum > best.sum) best = cur; cur = null; }
  });
  if (cur && cur.sum > best.sum) best = cur;
  return best;
}
function siDWinLbl(hours, win){
  const later = hours.some(x => x.h >= win.b && (x.fc > 0.05 || x.sc > 0));
  return siDdClock(win.a) + ' – ' + (later ? siDdClock(win.b) : 'close');
}

/* best available employee for a shift: free that day (no shift, no time off,
   not a minor, available for the hours), same position first, then fewest
   hours this week; never pushes anyone past 40 hrs */
function siDBestMatches(weekRecs, dayRecs, g, pos, start, end, used, n){
  const dateIso = siDIso(siDDateOfIdx(g));
  const on = new Set(dayRecs.map(r => r.employeeName));
  const off = new Set(SI_DAILY_CFG.TIMEOFF.filter(t => t.date === dateIso).map(t => t.emp));
  const hrs = {}; weekRecs.forEach(r => { hrs[r.employeeName] = (hrs[r.employeeName] || 0) + r.hours; });
  const len = end - start;
  return SI_DD_EMPLOYEES
    .filter(e => !on.has(e.name) && !off.has(e.name) && !SI_DAILY_CFG.MINORS[e.name] && !(used && used.has(e.name)))
    .filter(e => !(SI_DAILY_CFG.AVAIL_UNTIL[e.name] && end > SI_DAILY_CFG.AVAIL_UNTIL[e.name]))
    .filter(e => (hrs[e.name] || 0) + len <= 40)
    .map(e => ({ name:e.name, pos:e.position, hrs:hrs[e.name] || 0, same: e.position === pos }))
    .sort((a, b) => (b.same - a.same) || (a.hrs - b.hrs))
    .slice(0, n || 1);
}

/* =============== build the daily list for a date =============== */
function siInsBuildDaily(date){
  const g = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - SI_DD_ANCHOR) / 86400000);
  const wk = Math.floor(g / 7), dIdx = ((g % 7) + 7) % 7;
  const lbl = siDLabel(Math.max(0, g));
  if (g < 0 || wk >= SI_DD_WEEKS.length) {
    return [{ id:0, group:'daily', badge:'sev-info', badgeText:'Info', short:'No Schedule', icon:'calendar', impact:'', tags:[],
      title:'No published schedule for this date', meta:'Pick a date between Jul 14 and Sep 07, 2026 to see that day\'s insights.',
      chips:[], rootPoints:['Daily insights are generated from the published schedule for the selected day.'], recommendation:'Choose another date in the "Insights for" picker.', actions:[] }];
  }
  const weekRecs = SI_DD_RECORDS.filter(r => r.weekIdx === wk);
  const dayRecs = weekRecs.filter(r => r.dayIdx === dIdx);
  const agg = deepdiveAggregate(dayRecs);
  const hours = siDHourModel(weekRecs, dayRecs, dIdx);
  const out = [];
  const T = r => siDdShiftTime(r);
  const add = o => { o.id = out.length; o.group = 'daily'; out.push(o); };

  /* ---- 1. Schedule Compliance ---- */
  const warns = siDWarnings(dayRecs, g);
  if (warns.length) {
    const cnt = t => warns.filter(w => w.type === t).length;
    const legal = warns.filter(w => w.legal);
    const shifts = new Set(warns.map(w => w.r)).size;
    const prem = warns.filter(w => w.prem).reduce((s, w) => s + w.prem, 0);
    const ot = dayRecs.filter(r => r.hours > 8);
    const otHrs = ot.reduce((s, r) => s + r.hours - 8, 0), otD = ot.reduce((s, r) => s + (r.hours - 8) * r.rate * 1.5, 0);
    const pts = [];
    if (cnt('Daily OT')) pts.push(`<b>${cnt('Daily OT')} of ${dayRecs.length} shifts</b> are longer than 8 hrs → "Daily OT rule of 8 Hrs has breached." (${siDHrs(otHrs)} OT, <b>${siDMoney(otD)}</b>)`);
    warns.filter(w => w.type !== 'Daily OT' && w.type !== 'Unpublished').slice(0, 3).forEach(w =>
      pts.push(`<b>${w.r.employeeName}</b>${SI_DAILY_CFG.MINORS[w.r.employeeName] ? ' (age ' + SI_DAILY_CFG.MINORS[w.r.employeeName] + ')' : ''}, ${T(w.r)} (${siDHrs(w.r.hours)}) → "${w.msg}"`));
    if (cnt('Unpublished')) pts.push(`<b>${cnt('Unpublished')} shift${cnt('Unpublished') > 1 ? 's are' : ' is'} unpublished</b>, so the employee${cnt('Unpublished') > 1 ? 's don\'t' : ' doesn\'t'} have the details of ${cnt('Unpublished') > 1 ? 'these shifts' : 'this shift'} yet`);
    const maxWk = Math.max(...Object.values(weekRecs.reduce((o, r) => (o[r.employeeName] = (o[r.employeeName] || 0) + r.hours, o), {})));
    pts.push(`No weekly OT (highest week ${siDHrs(maxWk)}), no Daily DT (12 hrs) and no short turnaround between shifts`);
    const acts = [];
    if (legal.length) acts.push({ title:'Manager · today', body: legal.slice(0, 3).map(w => `${w.r.employeeName}: ${w.fix.charAt(0).toLowerCase() + w.fix.slice(1)}`).join('; ') + '. These are legal risks, so fix them before the shift is worked.' });
    if (cnt('Availability')) { const w = warns.find(x => x.type === 'Availability'); acts.push({ title:'Manager · today', body:`${w.r.employeeName}: ${w.fix.charAt(0).toLowerCase() + w.fix.slice(1)} to match availability.` }); }
    if (ot.length) acts.push({ title:'Manager · before the shift', body:`Cut the ${ot.length} shifts over 8 hrs to 8 hrs (e.g. ${ot.sort((a, b) => b.hours - a.hours).slice(0, 2).map(r => r.employeeName + ' ends ' + siDdClock(r.start + 8)).join(', ')}). Removes ${siDMoney(otD)} of OT.` });
    if (cnt('Unpublished')) acts.push({ title:'Manager · today', body:`Publish the schedule so the ${cnt('Unpublished')} unpublished shift${cnt('Unpublished') > 1 ? 's reach' : ' reaches'} the employee${cnt('Unpublished') > 1 ? 's' : ''}.` });
    const chip = (l, v) => ({ l, v:String(v), c: v ? 'neg' : 'pos' });
    add({ badge: legal.length ? 'sev-alert' : 'sev-warn', badgeText: legal.length ? 'Alert' : 'Warning', short:'Schedule Compliance', icon:'alert', noTotal:true,
      title:`${warns.length} schedule warning${warns.length > 1 ? 's' : ''} on ${shifts} shift${shifts > 1 ? 's' : ''}${legal.length ? ', ' + legal.length + ' of them legal risks' : ''}`,
      meta:`${lbl} · ${['Daily OT','Meal Break','Minor','Time-Off Overlap','Availability','Unpublished'].filter(cnt).map(t => cnt(t) + ' ' + t).join(' · ')}`,
      impact:`${warns.length} violation${warns.length > 1 ? 's' : ''}`, tags:['Daily OT','Minor','Meal Break','Time-Off Overlap','Availability','Unpublished'].filter(cnt).slice(0, 2).map(t => cnt(t) + ' ' + t),
      chips:[chip('Daily OT (8 Hrs)', cnt('Daily OT')), chip('Meal Break', cnt('Meal Break')), chip('Minor', cnt('Minor')), chip('Time-Off Overlap', cnt('Time-Off Overlap')),
             chip('Availability', cnt('Availability')), chip('Unpublished', cnt('Unpublished')), { l:'Weekly OT (40 Hrs)', v:'0', c:'pos' }, { l:'Daily DT (12 Hrs)', v:'0', c:'pos' }],
      rootPoints:pts,
      tableLabel:'Violation details', tableSub:`One line per violation · ${lbl} · warning text as shown on the schedule pad`,
      tableHeaders:['Employee','Role','Shift Schedule Time','Sch Hrs','Violation Type','How to Fix'],
      tableRows: warns.map(w => [w.r.employeeName, w.r.position + (SI_DAILY_CFG.MINORS[w.r.employeeName] ? ' · age ' + SI_DAILY_CFG.MINORS[w.r.employeeName] : ''), T(w.r), siDHrs(w.r.hours), w.msg, w.fix]),
      tableRowTone: warns.map(w => w.legal ? 'bad' : 'warn'),
      recommendation:`${acts.length} action${acts.length > 1 ? 's' : ''} for the manager, before ${lbl}\'s shifts start${legal.length ? '. Fix the legal risks first.' : '.'}`,
      actions:acts });
  }

  /* ---- 2. Understaffing (store level, per hour — the schedule pad has no
     dayparts, so problems are named by their time window) ---- */
  const under = hours.reduce((s, x) => s + Math.max(0, -x.v), 0);
  const over = hours.reduce((s, x) => s + Math.max(0, x.v), 0);
  const openHrs = hours.filter(x => x.fc > 0.05 || x.sc > 0);
  const hourRow = x => {
    const mg = x.on.filter(r => SI_MGR_POS[r.position]).map(r => r.employeeName + ' (' + SI_MGR_POS[r.position] + ')');
    return [siDHourLbl(x.h), String(x.trans), siD2(x.fc), siD2(x.sc), siDSigned(x.v), mg.length ? mg.join(', ') : 'None', x.on.length ? x.on.length + ' · ' + x.on.map(r => siDFirst(r.employeeName)).join(', ') : 'No one scheduled'];
  };
  if (under >= 2) {
    const win = siDWindow(hours, x => x.v < -0.1, x => -x.v);
    const wLbl = siDWinLbl(hours, win);
    const lastEnd = Math.max(...dayRecs.map(r => r.start + r.hours));
    const lastEmp = dayRecs.find(r => r.start + r.hours === lastEnd);
    const toApproved = SI_DAILY_CFG.TIMEOFF.filter(t => t.date === siDIso(siDDateOfIdx(g)) && t.status === 'Approved' && !dayRecs.some(r => r.employeeName === t.emp));
    const normal = [0, 1, 2].map(d => weekRecs.filter(r => r.dayIdx === d).length);
    const normalN = Math.round(normal.reduce((s, x) => s + x, 0) / 3);
    const avail = siDAvailable(weekRecs, dayRecs, g, 3);
    const peak = hours.slice().sort((a, b) => a.v - b.v)[0];
    const pts = [
      `<b>${wLbl}</b>: ${siDHrs(win.sc)} scheduled vs ${siDHrs(win.fc)} Forecasted Staff → <b>${siDSigned(-win.sum, ' hrs')}</b>`,
      `Shortest hour is <b>${siDHourLbl(peak.h)}</b>: ${siD2(peak.sc)} scheduled vs ${siD2(peak.fc)} forecasted, with ${peak.on.length} employee${peak.on.length === 1 ? '' : 's'} on shift`,
      `The last shift (${lastEmp.employeeName}) ends at <b>${siDdClock(lastEnd)}</b>; ${dayRecs.length < normalN ? `<b>${dayRecs.length} shifts</b> are scheduled vs ${normalN} on a normal Mon–Wed` : `${dayRecs.length} shifts are scheduled but most end before ${siDdClock(win.a)}`}`,
    ];
    if (toApproved.length) pts.push(`<b>${toApproved.length} employee${toApproved.length > 1 ? 's' : ''} on approved time off</b> (${toApproved.map(t => t.emp).join(', ')}) and their shifts are still <b>Unassigned</b> (see Unassigned Shifts)`);
    if (over >= 2) pts.push(`The same day is <b>${siDHrs(over)} over</b> in other hours, so part of the fix is moving hours, not adding them`);
    const rows = hours.filter(x => x.h >= win.a - 2 && (x.fc > 0.05 || x.sc > 0));
    add({ badge: under >= 5 ? 'sev-alert' : 'sev-warn', badgeText: under >= 5 ? 'Alert' : 'Warning', short:'Understaffing', icon:'users',
      title:`Understaffed by ${siD2(under)} staff-hours, most from ${wLbl}`,
      meta:`${lbl} · Forecasted Staff vs Scheduled Staff per hour, whole store · ${dayRecs.length} shifts`,
      impact:siDSigned(-under, ' hrs short'), tags:[wLbl, toApproved.length ? toApproved.length + ' time off' : 'Last out ' + siDdClock(lastEnd)],
      chips:[{ l:'Understaffed Hrs', v:siDHrs(under), c:'neg' }, { l:'Short Window', v:wLbl, c:'neg' }, { l:'Scheduled Shifts', v:String(dayRecs.length), c:'' }, { l:'Last Employee Out', v:siDdClock(lastEnd), c:'' }, { l:'Forecasted Sales', v:siDMoney(agg.fctSales), c:'' }],
      rootPoints:pts,
      tableLabel:'Staff Over/Short by hour', tableSub:`Staff O/S Report view · ${lbl} · negative Staff Variance = understaffed`,
      tableHeaders:['Time Interval','Fcst Transactions','Forecasted Staff','Scheduled Staff','Staff Variance','Management Coverage','On Shift'],
      tableRowIcon: rows.map(x => x.v < -0.1 ? 'alert' : 'clock'),
      tableRows: rows.map(hourRow),
      tableRowTone: rows.map(x => x.v < -1 ? 'bad' : x.v < -0.1 ? 'warn' : 'ok'),
      recommendation:`2 actions for the manager before ${lbl}\'s schedule posts.`,
      actions:[
        { title:'Manager · before the shift', body:`Add ${Math.max(1, Math.round(win.sum / 4))} shift${Math.round(win.sum / 4) > 1 ? 's' : ''} covering ${wLbl} (≈ ${siDHrs(win.sum)}). Available that day with no time off: ${avail.map(a => a.name + ' (' + siD2(a.hrs) + ' hrs this week)').join(', ')}.` },
        { title:'Manager · before the shift', body: over >= 2 ? `Pay for it by shortening shifts in the overstaffed hours (${siDHrs(over)} over forecast), so total hours stay about the same.` : `Extend ${lastEmp.employeeName} to close so the store is never left without staff.` },
      ] });
  }

  /* ---- 3. Overstaffing (store level, per hour) ---- */
  if (over >= 4) {
    const win = siDWindow(hours, x => x.v >= 1, x => x.v);
    const any = win.sum > 0 ? win : siDWindow(hours, x => x.v > 0, x => x.v);
    const wLbl = siDWinLbl(hours, any);
    const overHrs = openHrs.filter(x => x.v > 0.1).length;
    const peak = hours.slice().sort((a, b) => b.v - a.v)[0];
    const ot = dayRecs.filter(r => r.hours > 8);
    const late = dayRecs.filter(r => r.start + r.hours > 23.5);
    const inWin = dayRecs.filter(r => siDOverlap(r, any.a, any.b) > 0).sort((a, b) => b.hours - a.hours);
    const whole = (any.b - any.a) >= 0.7 * openHrs.length;   // over almost all day: name the peak hour instead
    const where = whole ? `in ${overHrs} of ${openHrs.length} hours, peak ${siDHourLbl(peak.h)}` : `most from ${wLbl}`;
    const pts = [
      `<b>${siDHrs(agg.schHrs)}</b> scheduled vs <b>${siDHrs(agg.fctStaff)}</b> Forecasted Staff: <b>${siDHrs(over)} overstaffed</b>${under > 0.5 ? ' and ' + siDHrs(under) + ' understaffed in other hours' : ''}`,
      `Overstaffed in <b>${overHrs} of ${openHrs.length} hours</b>; the biggest stretch is <b>${wLbl} (${siDSigned(any.sum, ' hrs')})</b> with ${inWin.length} shifts on`,
      `Peak hour <b>${siDHourLbl(peak.h)}</b>: ${siD2(peak.sc)} scheduled vs ${siD2(peak.fc)} forecasted (${siDSigned(peak.v)})`,
    ];
    if (ot.length) pts.push(`<b>${ot.length} shifts</b> run past 8 hrs, adding ${siDHrs(ot.reduce((s, r) => s + r.hours - 8, 0))} the forecast doesn't need`);
    if (late.length) pts.push(`<b>${late.length} closer${late.length > 1 ? 's' : ''}</b> stay past 11:30 PM (${late.map(r => siDFirst(r.employeeName) + ' to ' + siDdClock(r.start + r.hours)).join(', ')}) after the forecast drops off`);
    const acts = [];
    if (ot.length) acts.push({ title:'Manager · before the shift', body:`Cap every shift at 8 hrs. Removes ${siDHrs(ot.reduce((s, r) => s + r.hours - 8, 0))} of the overstaffing and all daily OT.` });
    acts.push({ title:'Manager · before the shift', body: whole ? `Shorten the longest shifts so fewer people overlap around ${siDHourLbl(peak.h)}: ${inWin.slice(0, 3).map(r => r.employeeName + ' (' + siDdShiftTime(r) + ')').join(', ')}.` : `Reduce overlap from ${wLbl}: start or end ${inWin.slice(0, 3).map(r => r.employeeName + ' (' + siDdShiftTime(r) + ')').join(', ')} about an hour earlier or later (${siDSigned(any.sum, ' hrs')} over in that window).` });
    if (late.length) acts.push({ title:'Manager · next schedule', body:`End closers by 11:00 PM; ${late.length} shift${late.length > 1 ? 's run' : ' runs'} past 11:30 PM.` });
    add({ badge: over >= 15 ? 'sev-alert' : 'sev-warn', badgeText: over >= 15 ? 'Alert' : 'Warning', short:'Overstaffing', icon:'users',
      title:`Overstaffed by ${siD2(over)} staff-hours, ${where}`,
      meta:`${lbl} · ${siDHrs(agg.schHrs)} sch. vs ${siDHrs(agg.fctStaff)} fcst. (${siDSigned((agg.schHrs / agg.fctStaff - 1) * 100, '%')}) · whole store, by hour`,
      impact:siDSigned(over, ' hrs over'), tags:[whole ? 'Peak ' + siDdClock(peak.h) : wLbl, ot.length ? ot.length + ' shifts > 8 hrs' : overHrs + ' hrs over'],
      chips:[{ l:'Scheduled Hours', v:siDHrs(agg.schHrs), c:'' }, { l:'Forecasted Staff Hrs', v:siDHrs(agg.fctStaff), c:'' }, { l:'Overstaffed Hrs', v:siDHrs(over), c:'neg' }, { l:'Labor $ Over Forecast', v:siDMoney(over * SI_DAILY_CFG.AVG_RATE), c:'neg' }, { l:'Scheduled Labor %', v:agg.schLbrPerc.toFixed(1) + '%', c: agg.schLbrPerc > SI_DAILY_CFG.BUDGET_PCT ? 'neg' : '' }],
      rootPoints:pts,
      tableLabel:'Staff Over/Short by hour', tableSub:`Staff O/S Report view · ${lbl} · positive Staff Variance = overstaffed`,
      tableHeaders:['Time Interval','Fcst Transactions','Forecasted Staff','Scheduled Staff','Staff Variance','Management Coverage','On Shift'],
      tableRowIcon: openHrs.map(x => x.v >= 1 ? 'alert' : 'clock'),
      tableRows: openHrs.map(hourRow),
      tableRowTone: openHrs.map(x => x.v >= 2 ? 'bad' : x.v >= 1 ? 'warn' : x.v < -0.5 ? 'good' : 'ok'),
      recommendation:`${acts.length} action${acts.length > 1 ? 's' : ''} for the manager on ${lbl}\'s schedule.`, actions:acts });
  }

  /* ---- 4. Labor Budget — as on the schedule pad: "Budget (By Configured
     Forecast Percentage)". The budget is a % per day (no budget $):
       Budget    = Budget Hrs | Labor Budget %
       Variance  = (Budget Hrs − Sch Hrs) | (Budget % − Sch Labor %)
     Negative variance = over budget (shown red on the pad). ---- */
  const budPct = SI_DAILY_CFG.BUDGET_PCT;
  const budH = agg.fctSales * budPct / 100 / SI_DAILY_CFG.AVG_RATE;
  const varH = budH - agg.schHrs, varP = budPct - agg.schLbrPerc;
  if (varH < -2 || (varH > 4 && under >= 2)) {
    const overB = varH < 0;
    const otRecs = dayRecs.filter(r => r.hours > 8);
    const otH = otRecs.reduce((s, r) => s + r.hours - 8, 0);
    const longest = dayRecs.slice().sort((a, b) => b.hours - a.hours);
    const afterCap = varH + otH;
    const pts = overB ? [
      `Budget for the day is <b>${siDHrs(budH)} | ${budPct.toFixed(2)}%</b> on ${siDMoney(agg.fctSales)} of forecasted sales`,
      `Scheduled: <b>${siDHrs(agg.schHrs)} | ${agg.schLbrPerc.toFixed(2)}%</b> → Variance <b>${siDSigned(varH)} hrs | ${siDSigned(varP)}%</b> (over budget)`,
      otRecs.length ? `<b>${otRecs.length} shifts</b> run past 8 hrs and add <b>${siDHrs(otH)}</b>, ${Math.round(otH / -varH * 100)}% of the hours over budget` : `No shift runs past 8 hrs: the extra hours come from ${dayRecs.length} shifts of normal length`,
      `Forecast Hrs for the day are ${siDHrs(agg.fctStaff)}, so the schedule is also ${siDSigned(agg.schHrs - agg.fctStaff)} hrs vs forecast`,
    ] : [
      `Budget for the day is <b>${siDHrs(budH)} | ${budPct.toFixed(2)}%</b>; scheduled <b>${siDHrs(agg.schHrs)} | ${agg.schLbrPerc.toFixed(2)}%</b>`,
      `Variance <b>${siDSigned(varH)} hrs | ${siDSigned(varP)}%</b> (under budget), but the day is also <b>${siDHrs(under)} understaffed</b>, so the unused budget comes from missing coverage`,
    ];
    add({ badge: overB ? (varH < -15 ? 'sev-alert' : 'sev-warn') : 'sev-info', badgeText: overB ? (varH < -15 ? 'Alert' : 'Warning') : 'Info',
      short: overB ? 'Over Labor Budget' : 'Under Labor Budget', icon:'dollar',
      title: overB ? `${siD2(-varH)} hrs over the daily labor budget (${siD2(-varP)}% over)` : `${siD2(varH)} hrs under the daily labor budget, because the day is understaffed`,
      meta:`${lbl} · Budget ${siDHrs(budH)} | ${budPct.toFixed(2)}% · Scheduled ${siDHrs(agg.schHrs)} | ${agg.schLbrPerc.toFixed(2)}% · Labor Budget % set by day`,
      impact: overB ? siDSigned(varH) + ' hrs · Over' : siDSigned(varH) + ' hrs · Under', tags:[siDSigned(varP) + '% variance', agg.schLbrPerc.toFixed(1) + '% vs ' + budPct.toFixed(1) + '%'],
      chips:[{ l:'Labor Budget %', v:budPct.toFixed(2) + '%', c:'' }, { l:'Budget Hrs', v:siDHrs(budH), c:'' }, { l:'Scheduled Labor %', v:agg.schLbrPerc.toFixed(2) + '%', c: overB ? 'neg' : 'pos' }, { l:'Scheduled Hrs', v:siDHrs(agg.schHrs), c:'' },
             { l:'Variance Hrs', v:siDSigned(varH) + ' hrs', c: overB ? 'neg' : 'pos' }, { l:'Variance %', v:siDSigned(varP) + '%', c: overB ? 'neg' : 'pos' }, { l:'Budget Status', v: overB ? 'Over budget' : 'Under budget', c: overB ? 'neg' : 'pos' }, { l:'Forecast Hrs', v:siDHrs(agg.fctStaff), c:'' }],
      rootPoints:pts,
      tableLabel:'Budget (By Configured Forecast Percentage)', tableSub:`${lbl} · Hrs | % as shown on the schedule pad · negative variance = over budget`,
      tableHeaders:['Row','Hrs','%','Status'],
      tableRowIcon:['dollar','users','alert'],
      tableRows:[
        ['Budget', siDHrs(budH), budPct.toFixed(2) + '%', 'Labor Budget % for ' + lbl],
        ['Scheduled', siDHrs(agg.schHrs), agg.schLbrPerc.toFixed(2) + '%', dayRecs.length + ' shifts'],
        ['Variance', siDSigned(varH) + ' hrs', siDSigned(varP) + '%', overB ? 'Over budget' : 'Under budget'],
      ],
      tableRowTone:['ok', 'ok', overB ? 'bad' : 'good'],
      noTotal:true,
      table2: overB ? {
        label:'Longest shifts of the day', sub:'Where the hours over budget can come back from', noTotal:true,
        headers:['Employee','Role','Shift Schedule Time','Sch Hrs','Hrs Over 8'],
        rows: longest.slice(0, 8).map(r => [r.employeeName, r.position, T(r), siDHrs(r.hours), siDHrs(Math.max(0, r.hours - 8))]),
        tone: longest.slice(0, 8).map(r => r.hours > 8 ? 'bad' : 'ok') } : null,
      recommendation: overB ? `Actions for the manager to bring ${lbl} back to its ${siDHrs(budH)} budget.` : 'Use the unused budget hours to cover the understaffed hours.',
      actions: overB ? [
        otRecs.length ? { title:'Manager · before the shift', body:`Cap every shift at 8 hrs. Removes ${siDHrs(otH)}, which takes the variance to ${siDSigned(afterCap)} hrs${afterCap >= 0 ? ' (back within budget)' : ''}.` } : null,
        afterCap < 0 ? { title:'Manager · before the shift', body:`Trim about ${siDHrs(-afterCap)}${otRecs.length ? " more" : ""}, starting with the longest shifts (${longest.slice(0, 2).map(r => r.employeeName + ' ' + siDHrs(r.hours)).join(', ')}).` } : null,
      ].filter(Boolean) : [
        { title:'Manager · before the shift', body:`Spend part of the ${siDHrs(varH)} left in the budget on shifts for the understaffed hours (see Understaffing).` },
      ] });
  }

  /* ---- 5. Overtime ---- */
  const otR = dayRecs.filter(r => r.hours > 8).sort((a, b) => (b.hours - 8) * b.rate - (a.hours - 8) * a.rate);
  if (otR.length) {
    const otHrs = otR.reduce((s, r) => s + r.hours - 8, 0), otD = otR.reduce((s, r) => s + (r.hours - 8) * r.rate * 1.5, 0);
    const mgr = otR.filter(r => SI_MGR_POS[r.position]);
    add({ badge: otD > 200 ? 'sev-warn' : 'sev-info', badgeText: otD > 200 ? 'Warning' : 'Info', short:'Overtime', icon:'clock',
      title:`${siD2(otHrs)} hours of daily overtime across ${otR.length} shift${otR.length > 1 ? 's' : ''}`,
      meta:`${lbl} · ${otR.length} shift${otR.length > 1 ? 's' : ''} over 8 hrs · ${siDMoney(otD)} scheduled OT · paid at 1.5×`,
      impact:siDMoney(otD) + ' OT', tags:[otR.length + ' shifts > 8 hrs'],
      chips:[{ l:'Scheduled OT Hours', v:siDHrs(otHrs), c:'neg' }, { l:'Scheduled OT $', v:siDMoney(otD), c:'neg' }, { l:'Shifts Over 8 Hrs', v:otR.length + ' of ' + dayRecs.length, c:'' }, { l:'Over Forecast', v:siDSigned(agg.schHrs - agg.fctStaff, ' hrs'), c: agg.schHrs > agg.fctStaff ? 'neg' : '' }],
      rootPoints:[
        `<b>${otR.length} of ${dayRecs.length}</b> shifts are scheduled past 8 hrs, and every hour past 8 is paid at <b>1.5×</b> (California daily OT)`,
        mgr.length ? `${mgr.length} manager/lead shifts carry <b>${siDHrs(mgr.reduce((s, r) => s + r.hours - 8, 0))}</b> of the OT at the highest rates` : 'No manager shifts are in overtime',
        agg.schHrs > agg.fctStaff ? `The day is already <b>${siDHrs(agg.schHrs - agg.fctStaff)} over</b> Forecasted Staff, so the OT hours aren\'t needed for coverage` : 'The day is at or under forecast, so split long shifts instead of cutting them',
      ],
      // the suggested employee (free that day, same position first, stays
      // under 40 hrs) sits in the same row as the OT shift it would relieve
      ...(() => {
        const used = new Set();
        const sug = otR.map(r => { const m = siDBestMatches(weekRecs, dayRecs, g, r.position, r.start + 8, r.start + r.hours, used, 1)[0]; if (m) used.add(m.name); return m; });
        return {
          tableLabel:'Scheduled OT by shift', tableSub:`Hours past 8 in each shift, paid at 1.5× · suggested employee is free on ${lbl}, no time off, same position first, stays under 40 hrs`,
          tableHeaders:['Employee','Role','Shift Schedule Time','OT Hrs','OT $','Cut to 8h','Suggested Employee','Covers'],
          tableRows: otR.map((r, i) => [r.employeeName, r.position, T(r), siDHrs(r.hours - 8), siDMoney((r.hours - 8) * r.rate * 1.5),
            (r.start + r.hours > 22 ? 'Start ' + siDdClock(r.start + r.hours - 8) : 'End ' + siDdClock(r.start + 8)),
            sug[i] ? sug[i].name + (sug[i].same ? '' : ' (' + sug[i].pos + ')') + ' (' + siD2(sug[i].hrs) + ' hrs)' : 'No free employee',
            siDdClock(r.start + 8) + ' – ' + siDdClock(r.start + r.hours)]),
        };
      })(),
      tableRowTone: otR.map(r => (r.hours - 8) * r.rate * 1.5 > 45 ? 'bad' : 'warn'),
      recommendation: agg.schHrs > agg.fctStaff ? 'No cover is needed: the day stays over forecast after the cuts.' : 'Split the long shifts with an available employee instead of cutting coverage.',
      actions:[
        { title:'Manager · before the shift', body:`${otR.slice(0, 2).map(r => (r.start + r.hours > 22 ? r.employeeName + ' starts ' + siDdClock(r.start + r.hours - 8) : r.employeeName + ' ends ' + siDdClock(r.start + 8))).join(', ')}. These are the 2 costliest OT shifts (${siDMoney(otR.slice(0, 2).reduce((s, r) => s + (r.hours - 8) * r.rate * 1.5, 0))}).` },
        { title:'Manager · before the shift', body:`Cut the other ${otR.length - 2 > 0 ? otR.length - 2 : 0} shifts to 8 hrs using the "Cut to 8h" column. Removes all ${siDMoney(otD)} of OT.` },
        { title:'Manager · if you need the coverage', body:`Give the hours past 8 to an available employee instead of paying OT (see the Suggested Employee column), e.g. ${(() => { const m = siDBestMatches(weekRecs, dayRecs, g, otR[0].position, otR[0].start + 8, otR[0].start + otR[0].hours, null, 1)[0]; return m ? m.name + ' for ' + otR[0].employeeName + '\'s ' + siDdClock(otR[0].start + 8) + ' – ' + siDdClock(otR[0].start + otR[0].hours) : 'a lower-hours employee'; })()}.` },
      ].filter(a => !/other 0 shifts/.test(a.body)) });
  }

  /* ---- 6. Time Off ---- */
  const tos = SI_DAILY_CFG.TIMEOFF.filter(t => t.date === siDIso(siDDateOfIdx(g)));
  if (tos.length) {
    const rows = tos.map(t => { const s = dayRecs.find(r => r.employeeName === t.emp); const e = SI_DD_EMPLOYEES.find(x => x.name === t.emp);
      return { t, s, e, impact: s ? (t.status === 'Approved' ? 'Still scheduled ' + T(s) : 'Scheduled ' + T(s)) : (t.status === 'Approved' ? 'Shift left Unassigned' : 'Decide before publish') }; });
    const conflicts = rows.filter(x => x.s), notFilled = rows.filter(x => !x.s && x.t.status === 'Approved'), pending = rows.filter(x => x.t.status === 'Pending');
    const avail = siDAvailable(weekRecs, dayRecs, g, 2);
    const pts = [];
    conflicts.forEach(x => pts.push(`<b>${x.t.emp}</b> has <b>${x.t.status.toLowerCase()}</b> All Day time off but is scheduled ${T(x.s)} → "${x.t.status === 'Approved' ? 'Shift overlapping with Timeoff.' : 'Overlapping Approved/Pending Time Off exists.'}"`));
    if (notFilled.length) pts.push(`<b>${notFilled.length} approved request${notFilled.length > 1 ? 's' : ''}</b> (${notFilled.map(x => x.t.emp).join(', ')}): their shifts were moved to <b>Unassigned</b> and nobody has been assigned yet${under >= 2 ? ', which adds to the understaffing' : ''}`);
    if (pending.length) pts.push(`<b>${pending.length} request${pending.length > 1 ? 's are' : ' is'} still pending</b> (${pending.map(x => x.t.emp + ' since ' + x.t.requested).join(', ')})`);
    const acts = [];
    conflicts.filter(x => x.t.status === 'Approved').forEach(x => acts.push({ title:'Manager · today', body:`Remove ${x.t.emp}'s ${T(x.s)} shift${agg.schHrs > agg.fctStaff ? '; the day stays over forecast without it' : ''}.` }));
    pending.forEach(x => acts.push({ title:'Manager · today', body:`Approve or Disapprove ${x.t.emp}'s request now${x.s ? ', then update the ' + T(x.s) + ' shift' : ''}.` }));
    if (notFilled.length) acts.push({ title:'Manager · before the shift', body:`Assign the ${notFilled.length} Unassigned shift${notFilled.length > 1 ? 's' : ''} to the best-match employees listed under Unassigned Shifts (e.g. ${avail.map(a => a.name).join(', ')}).` });
    add({ badge: conflicts.length ? 'sev-warn' : 'sev-info', badgeText: conflicts.length ? 'Warning' : 'Info', short:'Time Off', icon:'calendar',
      title: conflicts.length ? `${conflicts.length} scheduled shift${conflicts.length > 1 ? 's overlap' : ' overlaps'} time off` : `${notFilled.length} approved time-off request${notFilled.length > 1 ? 's' : ''} left shifts unfilled`,
      meta:`${lbl} · ${tos.filter(t => t.status === 'Approved').length} Approved · ${pending.length} Pending`,
      impact: conflicts.length ? conflicts.length + ' conflict' + (conflicts.length > 1 ? 's' : '') : notFilled.length + ' left unassigned', tags:[tos.filter(t => t.status === 'Approved').length + ' Approved', pending.length + ' Pending'].filter(s => !/^0/.test(s)),
      chips:[{ l:'Requests', v:String(tos.length), c:'' }, { l:'Approved', v:String(tos.filter(t => t.status === 'Approved').length), c:'' }, { l:'Pending', v:String(pending.length), c: pending.length ? 'neg' : 'pos' }, { l:'Overlap a Shift', v:String(conflicts.length), c: conflicts.length ? 'neg' : 'pos' }, { l:'Left Unassigned', v:String(notFilled.length), c: notFilled.length ? 'neg' : 'pos' }],
      rootPoints:pts,
      tableLabel:'Time-off requests', tableSub:`Requests for ${lbl}`,
      tableHeaders:['Employee','Role','Requested Date','Time Off Day(s)','Requested Reason','Status','Schedule Impact'],
      tableRows: rows.map(x => [x.t.emp, x.e ? x.e.position : '', x.t.requested, lbl + ' · All Day', x.t.reason, x.t.status, x.impact]),
      tableRowTone: rows.map(x => x.s && x.t.status === 'Approved' ? 'bad' : 'warn'),
      recommendation:`${acts.length} action${acts.length > 1 ? 's' : ''} for the manager.`, actions:acts });
  }

  /* ---- 7. Unassigned Shifts (shift with no employee: can't be published) ---- */
  const ua = SI_DAILY_CFG.UNASSIGNED.filter(u => u.date === siDIso(siDDateOfIdx(g)));
  if (ua.length) {
    const used = new Set();
    const picks = ua.map(u => { const m = siDBestMatches(weekRecs, dayRecs, g, u.pos, u.start, u.end, used, 3); if (m[0]) used.add(m[0].name); return { u, m }; });
    const uaHrs = ua.reduce((s, u) => s + u.end - u.start, 0);
    const shortCovered = hours.filter(x => x.v < -0.1).reduce((s, x) => s + Math.min(-x.v, ua.filter(u => x.h >= u.start && x.h < u.end).length), 0);
    const hrsOf = name => weekRecs.filter(r => r.employeeName === name).reduce((s, r) => s + r.hours, 0);
    add({ badge: under >= 2 ? 'sev-alert' : 'sev-warn', badgeText: under >= 2 ? 'Alert' : 'Warning', short:'Unassigned Shifts', icon:'calendar',
      title:`${ua.length} Unassigned shift${ua.length > 1 ? 's' : ''} (${siDHrs(uaHrs)}) with no employee, and they can't be published`,
      meta:`${lbl} · ${ua.map(u => u.pos + ' ' + siDdClock(u.start) + ' – ' + siDdClock(u.end)).join(' · ')}`,
      impact:`${ua.length} unassigned`, tags:[siDHrs(uaHrs), picks.filter(p => p.m[0]).length + ' best matches'],
      chips:[{ l:'Unassigned Shifts', v:String(ua.length), c:'neg' }, { l:'Unassigned Hrs', v:siDHrs(uaHrs), c:'neg' }, { l:'Best Matches Found', v:picks.filter(p => p.m[0]).length + ' of ' + ua.length, c:'pos' },
             { l:'Understaffed Hrs They Cover', v:siDHrs(shortCovered), c: shortCovered ? 'neg' : '' }, { l:'Position', v:[...new Set(ua.map(u => u.pos))].join(', '), c:'' }],
      rootPoints:[
        `<b>${ua.length} shift${ua.length > 1 ? 's are' : ' is'} on the Unassigned row</b> of the schedule pad; the pad shows "Cannot publish unassigned Shifts" until someone is assigned`,
        under >= 2 ? `Without them the day is <b>${siDHrs(under)} understaffed</b>; filling them covers <b>${siDHrs(shortCovered)}</b> of the short hours` : 'The day is at or over forecast without them, so check whether each shift is still needed',
        `Best matches are free that day, have no time off, are in the same position and stay under 40 hrs for the week`,
      ],
      tableLabel:'Unassigned shifts', tableSub:`${lbl} · shifts with no employee, from the Unassigned row`,
      tableHeaders:['Unassigned Shift','Position','Hrs','Status','Best Match','Week Hrs After'],
      tableRowIcon: ua.map(() => 'alert'),
      tableRows: picks.map(p => [siDdClock(p.u.start) + ' – ' + siDdClock(p.u.end), p.u.pos, siDHrs(p.u.end - p.u.start), 'Unassigned · cannot be published',
        p.m[0] ? p.m[0].name : 'No match', p.m[0] ? siDHrs(p.m[0].hrs + p.u.end - p.u.start) : '—']),
      tableRowTone: ua.map(() => 'bad'),
      noTotal:true,
      table2:{ label:'Suggested employees', sub:'Available and best match for each unassigned shift (same position, no time off, fewest hours)', noTotal:true,
        headers:['Employee','Role','For Shift','Hrs This Week','Time Off','Availability','Match'],
        rows: picks.flatMap(p => p.m.map((m, i) => [m.name, m.pos, siDdClock(p.u.start) + ' – ' + siDdClock(p.u.end), siDHrs(hrsOf(m.name)), 'None', 'Available', i === 0 ? 'Best match' : 'Backup'])),
        tone: picks.flatMap(p => p.m.map((m, i) => i === 0 ? 'good' : 'ok')) },
      recommendation:`${ua.length + 1} actions for the manager before ${lbl}'s schedule is published.`,
      actions: picks.map(p => ({ title:'Manager · today', body: p.m[0] ? `Assign ${p.m[0].name} to the ${siDdClock(p.u.start)} – ${siDdClock(p.u.end)} ${p.u.pos} shift (week goes to ${siDHrs(p.m[0].hrs + p.u.end - p.u.start)})${p.m[1] ? '; backup ' + p.m[1].name : ''}.` : `No free ${p.u.pos} found for ${siDdClock(p.u.start)} – ${siDdClock(p.u.end)}; offer it with "Unassign and Offer Shift".` }))
        .concat([{ title:'Manager · then', body:'Publish the schedule once every shift has an employee.' }]) });
  }

  if (!out.length) add({ badge:'sev-good', badgeText:'On Track', short:'Schedule On Track', icon:'check', impact:'', tags:[],
    title:'No schedule issues found for this day', meta:`${lbl} · ${dayRecs.length} shifts · ${siDHrs(agg.schHrs)} scheduled`,
    chips:[{ l:'Scheduled Hours', v:siDHrs(agg.schHrs), c:'' }, { l:'Scheduled Labor %', v:agg.schLbrPerc.toFixed(1) + '%', c:'pos' }],
    rootPoints:['Staffing is within forecast, the day is within its labor budget and there are no schedule warnings.'], recommendation:'No action needed.', actions:[] });
  // most severe first
  const rank = { 'sev-alert':0, 'sev-warn':1, 'sev-info':2, 'sev-good':3 };
  out.sort((a, b) => rank[a.badge] - rank[b.badge]).forEach((o, i) => { o.id = i; });
  return out;
}

if (typeof window !== 'undefined') window.siInsBuildDaily = siInsBuildDaily;
