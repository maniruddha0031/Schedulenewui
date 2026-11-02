/* ============================================================
   Schedule Insight — Deep Dive data model
   Single store, 8-week window ending on the current week used
   elsewhere in the app (Sep 01-07). Drill hierarchy is fixed:
     Week -> Day -> Position -> Employee
   Every KPI at every level is computed by AGGREGATING this file's
   leaf-level records (deepdiveAggregate()) — nothing is hand-typed
   per week/day, so rollups always sum back up consistently, and
   swapping this generator for a real API only means replacing
   SI_DD_RECORDS with real rows of the same shape.
   ============================================================ */

const SI_DD_WEEKS = [
  { idx:0, label:'Week 1', range:'Jul 14 – Jul 20' },
  { idx:1, label:'Week 2', range:'Jul 21 – Jul 27' },
  { idx:2, label:'Week 3', range:'Jul 28 – Aug 03' },
  { idx:3, label:'Week 4', range:'Aug 04 – Aug 10' },
  { idx:4, label:'Week 5', range:'Aug 11 – Aug 17' },
  { idx:5, label:'Week 6', range:'Aug 18 – Aug 24' },
  { idx:6, label:'Week 7', range:'Aug 25 – Aug 31' },
  { idx:7, label:'Week 8', range:'Sep 01 – Sep 07' }, // current week
];

const SI_DD_DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SI_DD_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SI_DD_ANCHOR = new Date(2026, 6, 14); // Week 1 Mon = Jul 14, 2026 (month is 0-indexed)

/* Real Date arithmetic (not string/int math) — Week 3 ("Jul 28 – Aug 03")
   crosses a month boundary, so naive "startDay + dayIdx" would produce an
   invalid "Jul 32". Date.setDate() rolls the month over correctly. */
function siDdDayLabel(weekIdx, dayIdx){
  const g = weekIdx * 7 + dayIdx;
  const d = new Date(SI_DD_ANCHOR.getTime());
  d.setDate(d.getDate() + g);
  return { day: SI_DD_DAY_NAMES[dayIdx], date: SI_DD_MONTH_NAMES[d.getMonth()] + ' ' + String(d.getDate()).padStart(2,'0') };
}

/* ---- positions: pay rate, shift-length band and daily coverage slots
   (weekday / weekend). ~13 shifts a weekday, ~17 a weekend day. ---- */
const SI_DD_POSITION_DEFS = [
  { name:'General Manager',   rate:28.00, len:[6.5, 7.75], slots:[1, 1] },
  { name:'Assistant Manager', rate:23.00, len:[6.0, 7.5],  slots:[1, 2] },
  { name:'Shift Leader',      rate:19.50, len:[5.5, 7.0],  slots:[2, 2] },
  { name:'Line Cook',         rate:17.00, len:[4.5, 7.0],  slots:[3, 4] },
  { name:'Prep Cook',         rate:16.00, len:[4.0, 6.0],  slots:[2, 2] },
  { name:'GSA',               rate:16.50, len:[4.0, 6.5],  slots:[3, 4] },
  { name:'Dishwasher',        rate:15.50, len:[4.0, 6.0],  slots:[1, 2] },
];
/* shift start times (decimal hours) per position slot — the i-th person
   scheduled in a role that day takes the i-th start; deterministic, so the
   seeded numbers are untouched */
const SI_DD_SHIFT_STARTS = {
  'General Manager':[7], 'Assistant Manager':[10, 14.5], 'Shift Leader':[6.5, 14],
  'Line Cook':[8, 10.5, 15, 16], 'Prep Cook':[6, 9], 'GSA':[10, 11, 15, 16], 'Dishwasher':[10.5, 16],
};
const SI_DD_POSITIONS = SI_DD_POSITION_DEFS.map(p => p.name);

/* ---- 52-person roster. The original 8 (from SI_ROSTER) keep their roles,
   rates and photos so the Insights / AI Hub stories still line up.
   photo = randomuser.me portrait id (stock stand-ins for HR photos). ---- */
const SI_DD_ROSTER_RAW = [
  // General Manager (2)
  ['Daniel Reyes','General Manager','men/52'], ['Priya Nair','General Manager','women/21'],
  // Assistant Manager (4)
  ['Graciela Atempa','Assistant Manager','women/65'], ['Marcus Bell','Assistant Manager','men/11'],
  ['Hannah Cho','Assistant Manager','women/12'], ['Omar Haddad','Assistant Manager','men/61'],
  // Shift Leader (6)
  ['Kimberli Lopez','Shift Leader','women/44'], ['Tyler Brooks','Shift Leader','men/22'],
  ['Mei Tanaka','Shift Leader','women/57'], ['Jordan Price','Shift Leader','men/36'],
  ['Ana Morales','Shift Leader','women/29'], ['Chris Walker','Shift Leader','men/83'],
  // Line Cook (14)
  ['Juan Lopez','Line Cook','men/32'], ['Alex Garcia','Line Cook','men/46'], ['Eliza Funes','Line Cook','women/90'],
  ['Luis Hernandez','Line Cook','men/14'], ['Diego Ruiz','Line Cook','men/67'], ['Maria Santos','Line Cook','women/47'],
  ['Kevin Tran','Line Cook','men/25'], ['Rosa Delgado','Line Cook','women/72'], ['Andre Wilson','Line Cook','men/86'],
  ['Carlos Mendoza','Line Cook','men/41'], ['Jasmine Ortiz','Line Cook','women/37'], ['Ethan Kim','Line Cook','men/18'],
  ['Pedro Alvarez','Line Cook','men/58'], ['Nicole Ramos','Line Cook','women/81'],
  // Prep Cook (8)
  ['Miguel Torres','Prep Cook','men/71'], ['Lily Nguyen','Prep Cook','women/15'], ['Samuel Okafor','Prep Cook','men/90'],
  ['Grace Park','Prep Cook','women/26'], ['Ricardo Silva','Prep Cook','men/29'], ['Emma Johnson','Prep Cook','women/53'],
  ['Victor Castillo','Prep Cook','men/64'], ['Ivy Chen','Prep Cook','women/8'],
  // GSA (12)
  ['Sofia Bagley','GSA','women/68'], ['Austin Gray','GSA','men/75'], ['Cecilia Ramirez','GSA','women/33'],
  ['Olivia Martinez','GSA','women/49'], ['Noah Davis','GSA','men/7'], ['Ava Thompson','GSA','women/62'],
  ['Liam Rodriguez','GSA','men/43'], ['Mia Lee','GSA','women/3'], ['Isabella Flores','GSA','women/76'],
  ['Lucas White','GSA','men/55'], ['Chloe Adams','GSA','women/40'], ['Mason Clark','GSA','men/5'],
  // Dishwasher (6)
  ['Jose Ramirez','Dishwasher','men/38'], ['Brian Scott','Dishwasher','men/80'], ['Fatima Khan','Dishwasher','women/19'],
  ['Tomas Vega','Dishwasher','men/27'], ['Aaliyah Brown','Dishwasher','women/85'], ['Hector Cruz','Dishwasher','men/48'],
];
const SI_DD_EMPLOYEES = SI_DD_ROSTER_RAW.map(([name, position, photo], i) => {
  const def = SI_DD_POSITION_DEFS.find(p => p.name === position);
  return { id:'emp' + i, name, position, rate:def.rate, photo };
});

/* ---- deterministic seeded RNG (mulberry32) so the demo data is stable
   across reloads instead of re-randomizing every time the page opens ---- */
function siDdRng(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const siDdRand = siDdRng(20260907);

/* ---- generate leaf records: one per scheduled shift ----
   Each day fills every position's coverage slots by rotating through that
   position's employees (so nobody works twice in a day and hours spread
   evenly). Built-in stories used across the app:
     - current week (Sep 01–07) weekend is over-scheduled vs forecast
     - Thursdays run over forecast, worst in the current week (extra GSA)
     - Friday dinner is short on line cooks in recent weeks */
const SI_DD_RECORDS = (function build(){
  const records = [];
  const CURRENT_WEEK = 7;
  const FRI_LINE_COOKS = { 4:1, 5:2, 6:1, 7:1 };      // recent Fridays run short on cooks
  const ptr = {};                                        // rotation pointer per position
  SI_DD_POSITIONS.forEach(p => { ptr[p] = 0; });

  for (let w = 0; w < SI_DD_WEEKS.length; w++) {
    for (let d = 0; d < 7; d++) {
      const isWeekend = d >= 5;
      const isCurrentWeek = w === CURRENT_WEEK;
      const isThursday = d === 3;
      const isFriday = d === 4;

      // coverage slots per position for this day
      const plan = SI_DD_POSITION_DEFS.map(p => {
        let n = p.slots[isWeekend ? 1 : 0];
        if (p.name === 'Line Cook' && isFriday) n = FRI_LINE_COOKS[w] != null ? FRI_LINE_COOKS[w] : 2;
        if (p.name === 'GSA' && isThursday && isCurrentWeek) n += 1;   // the extra afternoon GSA
        return { def: p, n };
      });
      const staffCount = plan.reduce((s, x) => s + x.n, 0);

      // day-level forecasted sales (weekend runs higher), ±8% noise
      const daySales = (isWeekend ? 11000 : 6200) * (0.92 + siDdRand() * 0.16);

      let slotIdx = 0;
      plan.forEach(({ def, n }) => {
        const pool = SI_DD_EMPLOYEES.filter(e => e.position === def.name);
        for (let i = 0; i < n; i++) {
          const emp = pool[ptr[def.name] % pool.length];
          ptr[def.name]++;

          let hours = def.len[0] + siDdRand() * (def.len[1] - def.len[0]);
          if (isWeekend) hours += 0.75;
          if (isCurrentWeek && isWeekend) hours *= 1.28;        // weekend over-scheduling
          if (isCurrentWeek && isThursday) hours *= 1.10;       // Thursday excess
          else if (isThursday) hours *= 1.03 + w * 0.004;       // Thursdays creep up week over week
          hours = Math.round(hours * 100) / 100;

          // forecasted hours normally track ~90–98% of scheduled; the flagged
          // windows are forecast-under-scheduled on purpose
          let fcstFactor = 0.90 + siDdRand() * 0.08;
          if (isCurrentWeek && isWeekend) fcstFactor = 0.72 + siDdRand() * 0.06;
          if (isCurrentWeek && isThursday) fcstFactor = 0.80 + siDdRand() * 0.05;
          if (isThursday && !isCurrentWeek) fcstFactor = 0.88 + siDdRand() * 0.06;
          const fcstHours = Math.round(hours * fcstFactor * 100) / 100;

          const salesShare = Math.round((daySales / staffCount) * (0.85 + siDdRand() * 0.3) * 100) / 100;

          // compliance: mostly on-time; Tue/Wed/Fri dip in the current week
          let compliance = 96 + siDdRand() * 4;
          if (isCurrentWeek && (d === 1 || d === 2 || d === 4) && slotIdx % 6 === 0) compliance = 82 + siDdRand() * 8;
          compliance = Math.round(compliance * 10) / 10;

          records.push({
            weekIdx:w, dayIdx:d, employeeId:emp.id, employeeName:emp.name, position:emp.position,
            hours, rate:emp.rate, fcstHours, sales:salesShare, compliance,
            start: (SI_DD_SHIFT_STARTS[def.name] || [9])[i % (SI_DD_SHIFT_STARTS[def.name] || [9]).length] + ((w + d) % 2) * 0.25,
          });
          slotIdx++;
        }
      });
    }
  }
  return records;
})();

/* "7:00 AM – 5:25 PM": start + scheduled hours, end rounded to 5 min */
function siDdClock(h){
  const m = Math.round(h * 12) * 5 % 1440;
  const hh = Math.floor(m / 60), mm = m % 60;
  return ((hh % 12) || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (hh < 12 ? 'AM' : 'PM');
}
function siDdShiftTime(r){ return r.start == null ? '' : siDdClock(r.start) + ' – ' + siDdClock(r.start + r.hours); }

/* ---- per-shift schedule warnings (feeds the Warning Count column):
     - OT: shift runs past 8 hrs (California daily overtime)
     - Over forecast: scheduled hrs more than 15% above forecasted hrs
     - Compliance: shift compliance under 95% (late/edited after publish) ---- */
const SI_DD_WARN_RULES = { otHours: 8, overFcstPct: 15, minCompliance: 95 };
function siDdShiftWarnings(r){
  const w = [];
  if (r.hours > SI_DD_WARN_RULES.otHours) w.push('OT shift');
  if (r.fcstHours && (r.hours / r.fcstHours - 1) * 100 > SI_DD_WARN_RULES.overFcstPct) w.push('Over forecast');
  if (r.compliance < SI_DD_WARN_RULES.minCompliance) w.push('Compliance');
  return w;
}

/* ---- Scheduled OT (California, store is Encinitas, CA): hours past 8 in
   a shift are daily OT; straight-time hours past 40 in an employee's week
   are weekly OT on top of that. OT $ is paid at 1.5x the employee's rate.
   Shared by the Deep Dive OT tiles and the Position/Employee OT columns. ---- */
const SI_DD_OT_RULES = { daily: 8, weekly: 40, mult: 1.5 };
function siDdOtCalc(records){
  let hrs = 0, dollar = 0, shifts = 0;
  const byEmpWeek = {};
  records.forEach(r => {
    const daily = Math.max(0, r.hours - SI_DD_OT_RULES.daily);
    if (daily > 0) shifts++;
    hrs += daily; dollar += daily * r.rate * SI_DD_OT_RULES.mult;
    const k = r.weekIdx + '|' + r.employeeId;
    const e = byEmpWeek[k] || (byEmpWeek[k] = { straight: 0, rate: r.rate });
    e.straight += r.hours - daily;
  });
  Object.values(byEmpWeek).forEach(e => {
    const weekly = Math.max(0, e.straight - SI_DD_OT_RULES.weekly);
    hrs += weekly; dollar += weekly * e.rate * SI_DD_OT_RULES.mult;
  });
  return { hrs, dollar, shifts };
}

/* ---- aggregation: turns any subset of records into the 6 Schedule KPIs ---- */
function deepdiveAggregate(records){
  if (!records.length) {
    return { schHrs:0, fctStaff:0, schDollar:0, splh:0, schLbrPerc:0, schCompliance:0, fctSales:0, warnCount:0, shiftCount:0, otHrs:0, otDollar:0, avgRate:0, empCount:0 };
  }
  const ot = siDdOtCalc(records);
  let hrs=0, fcst=0, dollar=0, sales=0, compWeighted=0;
  for (const r of records) {
    hrs += r.hours;
    fcst += r.fcstHours;
    dollar += r.hours * r.rate;
    sales += r.sales;
    compWeighted += r.hours * r.compliance;
  }
  return {
    schHrs: hrs,
    fctStaff: fcst,
    schDollar: dollar,
    splh: sales / hrs,
    schLbrPerc: (dollar / sales) * 100,
    schCompliance: compWeighted / hrs,
    fctSales: sales,
    warnCount: records.reduce((n, r) => n + siDdShiftWarnings(r).length, 0),
    shiftCount: records.length,
    otHrs: ot.hrs,
    otDollar: ot.dollar,
    avgRate: dollar / hrs,
    empCount: new Set(records.map(r => r.employeeId)).size,
  };
}

/* ---- KPI display metadata (targets are business constants; hours/$
   comparisons are always derived from the data, never hand-typed) ---- */
const SI_DD_KPI_DEFS = [
  { id:'schHrs', label:'Scheduled Hours', glyph:'⏱', accent:'#12a37f', chipBg:'#e3f7f0', fmt:'hours' },
  { id:'splh', label:'SPLH', glyph:'$', accent:'#4d8cf5', chipBg:'#eaf1fe', fmt:'dollar', target:58.00, thresholdPct:5, lowerIsBad:true },
  { id:'schDollar', label:'Scheduled Dollar', glyph:'$', accent:'#8b4fbe', chipBg:'#f2eafb', fmt:'dollar' },
  { id:'schLbrPerc', label:'Scheduled Labor %', glyph:'%', accent:'#f4685b', chipBg:'#fdeceb', fmt:'percent', target:22.2, thresholdPct:2 },
  { id:'fctSales', label:'Forecasted Sales', glyph:'$', accent:'#0891b2', chipBg:'#e0f7fb', fmt:'dollar' },
  { id:'fctStaff', label:'Forecasted Hours', glyph:'⏱', accent:'#4d8cf5', chipBg:'#eaf1fe', fmt:'hours' },
];

/* ---- extra columns used only by the Position / Employee breakdowns ---- */
const SI_DD_EXTRA_DEFS = [
  { id:'warnCount', label:'Warning Count', glyph:'!', accent:'#d97706', chipBg:'#fef3c7', fmt:'count', target:0,
    info:'Shift warnings: OT (>8 hrs), >15% over forecast, or compliance under 95%' },
  { id:'shiftCount', label:'Total Shifts', glyph:'#', accent:'#0f766e', chipBg:'#ccfbf1', fmt:'count' },
  { id:'empCount', label:'Employees', glyph:'#', accent:'#4f46e5', chipBg:'#eef2ff', fmt:'count' },
  { id:'avgRate', label:'Rate', glyph:'$', accent:'#64748b', chipBg:'#f1f5f9', fmt:'dollar' },
  { id:'otHrs', label:'Scheduled OT Hrs', glyph:'⏱', accent:'#e11d48', chipBg:'#ffe4e6', fmt:'hours', target:0,
    info:'Hours past 8 in a shift, plus straight time past 40 in a week' },
  { id:'otDollar', label:'Scheduled OT $', glyph:'$', accent:'#be123c', chipBg:'#ffe4e6', fmt:'dollar', target:0,
    info:'OT hours paid at 1.5x the employee rate' },
];

if (typeof window !== 'undefined') {
  window.SI_DD_WEEKS = SI_DD_WEEKS;
  window.SI_DD_POSITIONS = SI_DD_POSITIONS;
  window.SI_DD_POSITION_DEFS = SI_DD_POSITION_DEFS;
  window.SI_DD_EMPLOYEES = SI_DD_EMPLOYEES;
  window.SI_DD_RECORDS = SI_DD_RECORDS;
  window.SI_DD_KPI_DEFS = SI_DD_KPI_DEFS;
  window.siDdDayLabel = siDdDayLabel;
  window.deepdiveAggregate = deepdiveAggregate;
  window.siDdShiftWarnings = siDdShiftWarnings;
  window.SI_DD_EXTRA_DEFS = SI_DD_EXTRA_DEFS;
  window.siDdOtCalc = siDdOtCalc;
}
