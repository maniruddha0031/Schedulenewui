/* ============================================================
   Schedule Insight — Tab 2: Deep Dive (single store)
   Date-range bar -> KPI tiles -> fixed Week -> Day -> Position ->
   Employee drilldown table. Every number comes from aggregating
   deepdive-data.js's leaf records (deepdiveAggregate()) — this file
   only groups/sorts/renders, it never hand-types a KPI value.
   ============================================================ */

const DD_DIM_ORDER = ['week','day','position','employee','shift','event'];
const DD_DIM_LABEL = { week:'Week', day:'Day', position:'Position', employee:'Employee', shift:'Shift', event:'Exception' };
const DD_DIM_PLURAL = { week:'Weeks', day:'Days', position:'Positions', employee:'Employees', shift:'Shifts', event:'Exceptions' };

/* Exceptions: special conditions a shift can hit. The Exceptions level
   rolls the selected range up by these; clicking one lists the affected
   employees, and from there their matching shifts. A shift can fall in
   more than one exception (e.g. an OT shift that is also over forecast). */
const DD_EVENTS = [
  { id:'ot',         label:'Overtime shifts',       sub:'Shifts over 8 hrs (daily OT, 1.5x pay)',   tone:'#e11d48', bg:'#ffe4e6', pred:r => r.hours > 8 },
  { id:'long',       label:'Long shifts (10+ hrs)', sub:'Need a second meal break',                 tone:'#b45309', bg:'#fef3c7', pred:r => r.hours >= 10 },
  { id:'overfcst',   label:'Over forecast',         sub:'Scheduled 15%+ above forecasted hours',     tone:'#c2410c', bg:'#ffedd5', pred:r => siDdShiftWarnings(r).indexOf('Over forecast') >= 0 },
  { id:'compliance', label:'Low compliance',        sub:'Shift compliance under 95%',                tone:'#7c3aed', bg:'#ede9fe', pred:r => siDdShiftWarnings(r).indexOf('Compliance') >= 0 },
  { id:'anywarn',    label:'Any warning',           sub:'Shifts with at least one warning',          tone:'#dc2626', bg:'#fee2e2', pred:r => siDdShiftWarnings(r).length > 0 },
];
function ddEventDef(id){ return DD_EVENTS.find(e => e.id === id); }

const DD_RANGE_PRESETS = [
  { id:'curweek', label:'Current week', days:7 },
  { id:'lastweek', label:'Last week', days:7, endOffset:7 },
  { id:'last2weeks', label:'Last 2 weeks', days:14 },
  { id:'last4weeks', label:'Last 4 weeks', days:28 },
  { id:'all8weeks', label:'Last 8 weeks', days:56 },
];

const SI_DD_STATE = { rangePreset:'last4weeks', customStart:null, customEnd:null, dim:'week', path:[], zoom:null, zoomGran:'day', zoomBuckets:null, shifts:null, sort:null, q:'', menu:null, hiddenCols:(function(){ try { return JSON.parse(localStorage.getItem('si-dd-hidden-cols')) || {}; } catch (e) { return {}; } })(), lastView:null };
let SI_DD_CURRENT_GROUPS = [];

function ddChildDim(dim){
  const i = DD_DIM_ORDER.indexOf(dim);
  return i < DD_DIM_ORDER.length - 1 ? DD_DIM_ORDER[i + 1] : null;
}

function ddGlobalIdx(weekIdx, dayIdx){ return weekIdx * 7 + dayIdx; }

/* global day index <-> 'YYYY-MM-DD' for the From/To calendar inputs */
function ddIdxToIso(g){
  const d = new Date(SI_DD_ANCHOR.getTime());
  d.setDate(d.getDate() + g);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function ddIsoToIdx(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - SI_DD_ANCHOR) / 86400000);
}

function ddRangeIndices(presetId){
  if (presetId === 'custom') {
    const start = SI_DD_STATE.customStart, end = SI_DD_STATE.customEnd;
    return { start, end, days: end - start + 1 };
  }
  const preset = DD_RANGE_PRESETS.find(p => p.id === presetId) || DD_RANGE_PRESETS[2];
  const totalDays = SI_DD_WEEKS.length * 7;
  const end = totalDays - 1 - (preset.endOffset || 0);          // 'Last week' ends a week before the latest day
  const start = Math.max(0, end - preset.days + 1);
  return { start, end, days: end - start + 1 };
}

function ddRecordsInRange(presetId){
  const { start, end } = ddRangeIndices(presetId);
  return SI_DD_RECORDS.filter(r => { const g = ddGlobalIdx(r.weekIdx, r.dayIdx); return g >= start && g <= end; });
}

function ddPriorRecordsInRange(presetId){
  const { start, days } = ddRangeIndices(presetId);
  const priorEnd = start - 1;
  if (priorEnd < 0) return [];
  const priorStart = Math.max(0, priorEnd - days + 1);
  return SI_DD_RECORDS.filter(r => { const g = ddGlobalIdx(r.weekIdx, r.dayIdx); return g >= priorStart && g <= priorEnd; });
}

function ddApplyPath(records, path){
  let out = records;
  for (const p of path) {
    if (p.dim === 'week') out = out.filter(r => r.weekIdx === p.id);
    else if (p.dim === 'day') out = out.filter(r => ddGlobalIdx(r.weekIdx, r.dayIdx) === p.id);
    else if (p.dim === 'position') out = out.filter(r => r.position === p.id);
    else if (p.dim === 'employee') out = out.filter(r => r.employeeId === p.id);
    else if (p.dim === 'event') { const ev = ddEventDef(p.id); if (ev) out = out.filter(ev.pred); }
  }
  return out;
}

function ddGroupBy(records, dim){
  if (dim === 'event') {
    return DD_EVENTS.map(ev => ({ meta:{ dim:'event', id:ev.id }, records: records.filter(ev.pred) })).filter(g => g.records.length);
  }
  // Shift is the leaf level: one row per scheduled shift
  if (dim === 'shift') {
    return records.map((r, i) => {
      const g = ddGlobalIdx(r.weekIdx, r.dayIdx);
      return { meta: { dim:'shift', id: r.employeeId + '|' + g + '|' + i, g, weekIdx:r.weekIdx, dayIdx:r.dayIdx, rec:r }, records:[r] };
    });
  }
  const groups = new Map();
  for (const r of records) {
    let key, meta;
    if (dim === 'week') { key = 'w' + r.weekIdx; meta = { dim:'week', id:r.weekIdx }; }
    else if (dim === 'day') { const g = ddGlobalIdx(r.weekIdx, r.dayIdx); key = 'd' + g; meta = { dim:'day', id:g, weekIdx:r.weekIdx, dayIdx:r.dayIdx }; }
    else if (dim === 'position') { key = 'p' + r.position; meta = { dim:'position', id:r.position }; }
    else { key = 'e' + r.employeeId; meta = { dim:'employee', id:r.employeeId, name:r.employeeName, position:r.position }; }
    if (!groups.has(key)) groups.set(key, { meta, records: [] });
    groups.get(key).records.push(r);
  }
  return Array.from(groups.values());
}

/* week rows are named by their start date ("Week of Aug 11") with the
   full Mon–Sun span underneath, instead of a bare "Week 5" */
function ddDateOf(g){ const d = new Date(SI_DD_ANCHOR.getTime()); d.setDate(d.getDate() + g); return d; }
function ddMonDay(d){ return SI_DD_MONTH_NAMES[d.getMonth()] + ' ' + d.getDate(); }
function ddWeekName(w){ return 'Week of ' + ddMonDay(ddDateOf(w * 7)); }
function ddWeekDates(w){
  const a = ddDateOf(w * 7), b = ddDateOf(w * 7 + 6);
  return ddMonDay(a) + ' – ' + ddMonDay(b) + ', ' + b.getFullYear();
}

function ddRowLabel(group, dim){
  if (dim === 'week') return { name: ddWeekName(group.meta.id), sub: ddWeekDates(group.meta.id) };
  if (dim === 'day') { const { day, date } = siDdDayLabel(group.meta.weekIdx, group.meta.dayIdx); return { name: day + ', ' + date, sub: group.records.length + ' shifts' }; }
  if (dim === 'position') return { name: group.meta.id, sub: group.records.length + ' shifts' };
  if (dim === 'event') { const ev = ddEventDef(group.meta.id); return { name: ev.label, sub: ev.sub }; }
  if (dim === 'shift') { const { day, date } = siDdDayLabel(group.meta.weekIdx, group.meta.dayIdx); return { name: day + ', ' + date, sub: ddWeekName(group.meta.weekIdx) }; }
  return { name: group.meta.name, sub: group.meta.position };
}

function ddVarianceStr(fmt, variance){
  const sign = variance > 0 ? '+' : variance < 0 ? '-' : '';
  const abs = Math.abs(variance);
  if (fmt === 'dollar') return sign + '$' + abs.toFixed(2);
  if (fmt === 'percent') return sign + abs.toFixed(1) + ' pts';
  return sign + abs.toFixed(2) + ' hrs';
}

/* ---- KPI tiles: always reflect the whole selected date range,
   independent of how far the table below is drilled ---- */
function ddKpiTileData(kpiDef, agg, priorAgg){
  const v = agg[kpiDef.id];
  let compareLabel, compareValue, varianceLabel = 'Variance', flagged = false;

  if (kpiDef.id === 'schHrs') {
    compareLabel = 'Forecasted Hours'; compareValue = agg.fctStaff;
  } else if (kpiDef.id === 'fctStaff') {
    compareLabel = 'Prior Period'; compareValue = priorAgg.fctStaff || v; varianceLabel = 'Change';
  } else if (kpiDef.id === 'schDollar') {
    const blendedRate = agg.schHrs ? agg.schDollar / agg.schHrs : 0;
    compareLabel = 'Forecasted Labor $'; compareValue = agg.fctStaff * blendedRate;
  } else if (kpiDef.id === 'splh') {
    compareLabel = 'Target SPLH'; compareValue = kpiDef.target; varianceLabel = 'Gap';
  } else { // schLbrPerc, schCompliance
    compareLabel = 'Target'; compareValue = kpiDef.target;
  }

  const variance = v - compareValue;
  const variancePct = compareValue ? (variance / compareValue) * 100 : 0;
  if (kpiDef.thresholdPct != null) {
    flagged = kpiDef.fmt === 'percent' ? Math.abs(variance) >= kpiDef.thresholdPct : Math.abs(variancePct) >= kpiDef.thresholdPct;
  }
  return { value:v, compareLabel, compareValue, varianceLabel, variance, flagged, fmt:kpiDef.fmt, lowerIsBad:kpiDef.lowerIsBad };
}

/* Scheduled OT rules live in deepdive-data.js (siDdOtCalc) so the tiles
   and the Position/Employee OT columns share one calculation */
const DD_OT_MULT = SI_DD_OT_RULES.mult;
function ddOtCalc(records){ return siDdOtCalc(records); }

/* ---- KPI tile (redesigned): big tinted icon, label + value beside it,
   a daily trend line for the selected range, and a two-column footer ---- */
const DD_TILE_ICON = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bars: '<path d="M5 20V12M12 20V5M19 20v-9"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17v-4M12 17V8M16 17v-6"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4M12 2v3"/>',
  sales: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
};

function ddTileSpark(vals, color, id){
  const raw = vals.filter(v => v != null && isFinite(v));
  // light rolling average so weekday/weekend swings read as a trend, not noise
  const w = Math.max(1, Math.ceil(raw.length / 8));
  const pts = raw.map((v, i) => { const s = raw.slice(Math.max(0, i - w + 1), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
  if (pts.length < 2) return '<div class="kt-spark"></div>';
  const W = 100, H = 30, n = pts.length;
  const lo0 = Math.min.apply(null, pts), hi0 = Math.max.apply(null, pts);
  const pad = (hi0 - lo0) * 0.15 || Math.abs(hi0) * 0.1 || 1;
  const lo = (hi0 === 0 && lo0 === 0) ? 0 : lo0 - pad, hi = hi0 + pad;
  const X = i => (i / (n - 1)) * W;
  const Y = v => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
  const line = pts.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  const area = `M0,${H} L${line.split(' ').join(' L')} L${W},${H} Z`;
  return `<svg class="kt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="kt${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#kt${id})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function ddTileHtml(t, i){
  return `<div class="kpi-card kt-click" style="--accent:${t.accent};--chip:${t.chipBg}" onclick="ddOpenKpiTrend(${i})" title="Click to view the ${t.label} trend">
    <div class="kt-head">
      <div class="kt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DD_TILE_ICON[t.icon]}</svg></div>
      <div class="kt-tx">
        <div class="kt-top"><span class="label" title="${t.label}">${t.label}</span></div>
        <div class="value">${t.value}</div>
      </div>
    </div>
    <div class="kt-mid">${t.badge ? `<span class="badge-over">${t.badge}</span>` : '<span></span>'}${ddTileSpark(t.series, t.accent, i)}</div>
    <div class="foot">
      <div class="col"><div class="lbl" title="${t.footL}">${t.footL}</div><div class="val">${t.footLVal}</div></div>
      <div class="col r"><div class="lbl" title="${t.footR}">${t.footR}</div><div class="val">${t.footRVal}</div></div>
    </div>
  </div>`;
}

/* per-day record buckets across the selected range (trend lines + Avg.) */
function ddDailyBuckets(records){
  const { start, end } = ddRangeIndices(SI_DD_STATE.rangePreset);
  const days = [];
  for (let g = start; g <= end; g++) days.push([]);
  records.forEach(r => { const d = days[ddGlobalIdx(r.weekIdx, r.dayIdx) - start]; if (d) d.push(r); });
  return days;
}

function ddTilesHtml(rangeRecords, priorRecords){
  const agg = deepdiveAggregate(rangeRecords), priorAgg = deepdiveAggregate(priorRecords);
  const days = ddDailyBuckets(rangeRecords);
  const worked = days.filter(d => d.length);
  const dayAggs = worked.map(d => deepdiveAggregate(d));
  const series = id => dayAggs.map(a => a[id]);
  const avg = id => dayAggs.length ? dayAggs.reduce((s, a) => s + a[id], 0) / dayAggs.length : 0;
  const def = id => SI_DD_KPI_DEFS.find(k => k.id === id);
  const tile = id => ddKpiTileData(def(id), agg, priorAgg);
  const fmt = (v, f) => siFmtByType(v, f);
  const flagBadge = (id, t) => t.flagged ? (def(id).lowerIsBad ? 'Below Target' : 'Over') : '';

  const sh = tile('schHrs'), sp = tile('splh'), sd = tile('schDollar'), lb = tile('schLbrPerc'), fc = tile('fctStaff');
  const gap = agg.schHrs - agg.fctStaff;
  const gapPct = agg.fctStaff ? (gap / agg.fctStaff) * 100 : 0;
  const ot = ddOtCalc(rangeRecords), otPrior = ddOtCalc(priorRecords);
  const otDays = worked.map(d => ddOtCalc(d));
  // no data before the range (e.g. Last 8 weeks starts at the first week): show "—" instead of a fake comparison
  const hasPrior = priorRecords.length > 0;
  const NA = '—';

  const tiles = [
    { label:'Scheduled Hours', icon:'clock', accent:'#12a37f', chipBg:'#e3f7f0', value:fmt(sh.value,'hours'), series:series('schHrs'),
      footL:'Fct Hrs', footLVal:fmt(sh.compareValue,'hours'), footR:'Variance', footRVal:ddVarianceStr('hours', sh.variance) },
    { label:'SPLH', icon:'bars', accent:'#4d8cf5', chipBg:'#eaf1fe', value:fmt(sp.value,'dollar'), series:series('splh'), badge:flagBadge('splh', sp),
      footL:'Avg.', footLVal:fmt(avg('splh'),'dollar'), footR:'Gap', footRVal:ddVarianceStr('dollar', sp.variance) },
    { label:'Scheduled Dollar', icon:'dollar', accent:'#8b4fbe', chipBg:'#f2eafb', value:fmt(sd.value,'dollar'), series:series('schDollar'),
      footL:'Fct Labor $', footLVal:fmt(sd.compareValue,'dollar'), footR:'Variance', footRVal:ddVarianceStr('dollar', sd.variance) },
    { label:'Scheduled Labor %', icon:'percent', accent:'#f4685b', chipBg:'#fdeceb', value:fmt(lb.value,'percent'), series:series('schLbrPerc'), badge:flagBadge('schLbrPerc', lb),
      footL:'Avg.', footLVal:fmt(avg('schLbrPerc'),'percent'), footR:'Variance', footRVal:ddVarianceStr('percent', lb.variance) },
    { label:'Forecasted Sales', icon:'sales', accent:'#0891b2', chipBg:'#e0f7fb', value:fmt(agg.fctSales,'dollar'), series:series('fctSales'),
      footL:'Avg./Day', footLVal:fmt(worked.length ? agg.fctSales / worked.length : 0,'dollar'), footR:'Change', footRVal:hasPrior ? ddVarianceStr('dollar', agg.fctSales - priorAgg.fctSales) : NA },
    { label:'Forecasted Hours', icon:'chart', accent:'#4d8cf5', chipBg:'#eaf1fe', value:fmt(fc.value,'hours'), series:series('fctStaff'),
      footL:'Prior Period', footLVal:hasPrior ? fmt(fc.compareValue,'hours') : NA, footR:'Change', footRVal:hasPrior ? ddVarianceStr('hours', fc.variance) : NA },
    { label:'Fct vs Sch Hrs', icon:'clipboard', accent:'#f59e0b', chipBg:'#fef3c7', value:ddVarianceStr('hours', gap), series:dayAggs.map(a => a.schHrs - a.fctStaff),
      badge: Math.abs(gapPct) >= 5 ? (gap > 0 ? 'Over' : 'Under') : '',
      footL:'Variance %', footLVal:(gapPct > 0 ? '+' : '') + gapPct.toFixed(1) + '%', footR:'Aligned', footRVal:'0.00 hrs' },
    { label:'Scheduled OT Hrs', icon:'timer', accent:'#e11d48', chipBg:'#ffe4e6', value:fmt(ot.hrs,'hours'), series:otDays.map(o => o.hrs),
      badge: hasPrior && ot.hrs > otPrior.hrs ? 'Over' : '',
      footL:'OT Shifts', footLVal:String(ot.shifts), footR:'Prior Period', footRVal:hasPrior ? fmt(otPrior.hrs,'hours') : NA },
    { label:'Scheduled OT $', icon:'dollar', accent:'#e11d48', chipBg:'#ffe4e6', value:fmt(ot.dollar,'dollar'), series:otDays.map(o => o.dollar),
      badge: hasPrior && ot.dollar > otPrior.dollar ? 'Over' : '',
      footL:'Pay Rate', footLVal:DD_OT_MULT + 'x base', footR:'Prior Period', footRVal:hasPrior ? fmt(otPrior.dollar,'dollar') : NA },
  ];
  SI_DD_TILES = tiles;
  return tiles.map(ddTileHtml).join('');
}

/* ---- KPI tile → trend pop-up (the Schedule app's trend modal, ported as-is:
   trend-modal-engine.js + trend-modal.js adapter + trend-modal.css).
   Each tile is registered in the adapter's KPI_REGISTRY shape — label,
   value, % change, and its two footer figures as the supporting KPIs —
   then opened with the same engine call the Schedule app uses. ---- */
let SI_DD_TILES = [];
const DD_TREND_IDS = ['schHrs','splh','schDollar','schLbrPerc','fctSales','fctStaff','fctVsSch','otHrs','otDollar'];

/* week-over-week change shown in the pop-up header: average of the last 7
   days vs the 7 days before (a first-vs-last-day comparison would mostly
   measure weekday vs weekend) */
function ddTileChange(series){
  const s = (series || []).filter(v => v != null && isFinite(v));
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  let cur, prev;
  if (s.length >= 14) { cur = avg(s.slice(-7)); prev = avg(s.slice(-14, -7)); }
  else if (s.length >= 2) { cur = s[s.length - 1]; prev = s[0]; }
  if (!prev) return { txt:'0.0%', up:true };
  const pct = (cur - prev) / Math.abs(prev) * 100;
  return { txt:(pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', up: pct >= 0 };
}

function ddRegisterTrendTiles(){
  if (typeof KPI_REGISTRY === 'undefined' || !window.registerTrendKpi) return [];
  if (typeof TM_DASH_LABELS !== 'undefined') TM_DASH_LABELS.dd = 'Deep Dive';
  const ids = [];
  SI_DD_TILES.forEach((t, i) => {
    const id = 'dd-' + (DD_TREND_IDS[i] || i);
    const ch = ddTileChange(t.series);
    const footer = [[t.footL, t.footLVal], [t.footR, t.footRVal]]
      .filter(f => f[1] && f[1] !== '—' && !isNaN(parseFloat(String(f[1]).replace(/[,$%+]/g, ''))));
    KPI_REGISTRY[id] = { label:t.label, value:t.value, spark:'', cur:{ lw:ch.txt, lwUp:ch.up }, footer };
    const cfg = tmCfgFromTile(KPI_REGISTRY[id], id);
    cfg.color = t.accent;                       // keep each tile's own colour in the chart
    if (/hrs/.test(t.value)) cfg.unit = '';     // hours have no $/% unit
    window.registerTrendKpi(id, cfg);
    ids.push(id);
  });
  if (typeof tmMetricCatalog !== 'undefined') tmMetricCatalog = null;   // rebuild "Add Metric" list with current values
  return ids;
}

function ddOpenKpiTrend(i){
  if (!window.openLaborModal) return;
  const ids = ddRegisterTrendTiles();
  if (!ids[i]) return;
  window.openLaborModal(ids[i], ids, false);
}

/* ============================================================
   Range calendar: pill ("11 Aug 2026 – 07 Sep 2026") + a two-month
   popover. Click a start day, then an end day; days outside the data
   window are disabled. Apply sets a custom range (or lights the matching
   preset); quick chips on the left jump to the presets.
   ============================================================ */
const SI_DD_CAL = { open:false, a:null, b:null, hover:null, view:null, pa:null, pb:null };   // pa/pb = staged From/To awaiting Go
const DD_CAL_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DD_CAL_MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ddCalFmt(g){ const d = ddDateOf(g); return String(d.getDate()).padStart(2, '0') + ' ' + DD_CAL_MON[d.getMonth()] + ' ' + d.getFullYear(); }
function ddCalIdxOf(y, m, d){ return Math.round((new Date(y, m, d) - SI_DD_ANCHOR) / 86400000); }

function ddCalToggle(){
  if (SI_DD_CAL.open) { SI_DD_CAL.open = false; ddCalRender(); return; }
  const cur = ddRangeIndices(SI_DD_STATE.rangePreset);
  const start = SI_DD_CAL.pa != null ? SI_DD_CAL.pa : cur.start, end = SI_DD_CAL.pb != null ? SI_DD_CAL.pb : cur.end;
  const e = ddDateOf(end);
  SI_DD_CAL.open = true; SI_DD_CAL.a = start; SI_DD_CAL.b = end; SI_DD_CAL.hover = null;
  SI_DD_CAL.view = new Date(e.getFullYear(), e.getMonth() - 1, 1);   // show end month on the right
  ddCalRender();
}
function ddCalRender(){
  const pop = document.getElementById('dd-cal-pop');
  if (pop) pop.innerHTML = SI_DD_CAL.open ? ddCalPopHtml() : '';
  const pill = document.querySelector('.dd-cal-pill');
  if (pill) pill.classList.toggle('open', SI_DD_CAL.open);
}
function ddCalNav(step){ const v = SI_DD_CAL.view; SI_DD_CAL.view = new Date(v.getFullYear(), v.getMonth() + step, 1); ddCalRender(); }
function ddCalPick(g){
  if (SI_DD_CAL.a == null || SI_DD_CAL.b != null) { SI_DD_CAL.a = g; SI_DD_CAL.b = null; }
  else if (g < SI_DD_CAL.a) { SI_DD_CAL.b = SI_DD_CAL.a; SI_DD_CAL.a = g; }
  else SI_DD_CAL.b = g;
  ddCalRender();
}
/* hover preview while picking the To date: update classes in place (no
   re-render) so moving across into the other month stays smooth */
function ddCalHover(g){
  if (SI_DD_CAL.a == null || SI_DD_CAL.b != null || SI_DD_CAL.hover === g) return;
  SI_DD_CAL.hover = g;
  const a = SI_DD_CAL.a, fwd = g > a;
  document.querySelectorAll('#dd-cal-pop button.dd-cal-d').forEach(el => {
    const d = +el.dataset.g;
    el.classList.toggle('in', fwd && d > a && d < g);
    el.classList.toggle('sel', d === a || (fwd && d === g));
    el.classList.toggle('start', d === a && fwd);
    el.classList.toggle('end', fwd && d === g);
    el.classList.toggle('single', d === a && !fwd);
  });
}
function ddCalQuick(id){ SI_DD_CAL.open = false; SI_DD_CAL.pa = SI_DD_CAL.pb = null; ddSetRange(id); }
/* "Done" in the calendar only stages the From/To range — the table and
   tiles change when the user presses Go */
function ddCalDone(){
  const a = SI_DD_CAL.a, b = SI_DD_CAL.b == null ? SI_DD_CAL.a : SI_DD_CAL.b;
  if (a == null) return;
  SI_DD_CAL.open = false;
  const cur = ddRangeIndices(SI_DD_STATE.rangePreset);
  if (a === cur.start && b === cur.end) { SI_DD_CAL.pa = SI_DD_CAL.pb = null; }
  else { SI_DD_CAL.pa = a; SI_DD_CAL.pb = b; }
  ddCalRender();
  const lbl = document.getElementById("dd-cal-lbl");
  if (lbl) lbl.textContent = ddCalFmt(a) + " – " + ddCalFmt(b);
  const go = document.getElementById("dd-cal-go");
  if (go) go.classList.toggle("ready", SI_DD_CAL.pa != null);
  const pill = document.querySelector(".dd-cal-pill");
  if (pill) pill.classList.toggle("pending", SI_DD_CAL.pa != null);
}

function ddCalApply(){
  const a = SI_DD_CAL.pa, b = SI_DD_CAL.pb;
  if (a == null) return;
  SI_DD_CAL.open = false; SI_DD_CAL.pa = SI_DD_CAL.pb = null;
  SI_DD_STATE.customStart = a; SI_DD_STATE.customEnd = b;
  const match = DD_RANGE_PRESETS.find(p => { const r = ddRangeIndices(p.id); return r.start === a && r.end === b; });
  SI_DD_STATE.rangePreset = match ? match.id : 'custom';
  SI_DD_STATE.dim = 'week'; SI_DD_STATE.path = [];
  siRenderDeepDive();
}

function ddCalMonthHtml(y, m){
  const maxIdx = SI_DD_WEEKS.length * 7 - 1;
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;                         // Monday-first grid
  const a = SI_DD_CAL.a, b = SI_DD_CAL.b;
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="dd-cal-d empty"></span>';
  for (let d = 1; d <= days; d++) {
    const g = ddCalIdxOf(y, m, d);
    const off = g < 0 || g > maxIdx;
    const isA = g === a, isB = b != null && g === b;
    const inR = b != null && g > a && g < b;
    const cls = ['dd-cal-d', off ? 'off' : '', isA ? 'sel start' : '', isB ? 'sel end' : '', inR ? 'in' : '', (isA && (b == null || b === a)) ? 'single' : ''].join(' ');
    cells += off ? `<span class="${cls}">${d}</span>`
      : `<button class="${cls}" data-g="${g}" onclick="ddCalPick(${g})" onmouseenter="ddCalHover(${g})">${d}</button>`;
  }
  return `<div class="dd-cal-month">
    <div class="dd-cal-mh">${DD_CAL_MONTH[m]} ${y}</div>
    <div class="dd-cal-wk">${['Mo','Tu','We','Th','Fr','Sa','Su'].map(w => `<span>${w}</span>`).join('')}</div>
    <div class="dd-cal-grid">${cells}</div>
  </div>`;
}

function ddCalPopHtml(){
  const v = SI_DD_CAL.view, n = new Date(v.getFullYear(), v.getMonth() + 1, 1);
  const a = SI_DD_CAL.a, b = SI_DD_CAL.b;
  const sel = a == null ? 'Pick a start date' : b == null ? `${ddCalFmt(a)} – pick an end date` : `${ddCalFmt(a)} – ${ddCalFmt(b)} · ${b - a + 1} days`;
  return `<div class="dd-cal-card">
    <div class="dd-cal-main">
      <div class="dd-cal-nav">
        <button onclick="ddCalNav(-1)" title="Previous month"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <button onclick="ddCalNav(1)" title="Next month"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
      <div class="dd-cal-months">${ddCalMonthHtml(v.getFullYear(), v.getMonth())}${ddCalMonthHtml(n.getFullYear(), n.getMonth())}</div>
      <div class="dd-cal-foot">
        <span class="dd-cal-sel">${sel}</span>
        <button class="dd-cal-btn ghost" onclick="ddCalToggle()">Cancel</button>
        <button class="dd-cal-btn" onclick="ddCalDone()"${a == null ? " disabled" : ""}>Done</button>
      </div>
    </div>
  </div>`;
}

function ddRangeBarHtml(){
  const { start, end, days } = ddRangeIndices(SI_DD_STATE.rangePreset);
  const minIso = ddIdxToIso(0), maxIso = ddIdxToIso(SI_DD_WEEKS.length * 7 - 1);
  const startLbl = siDdDayLabel(Math.floor(start / 7), start % 7);
  const endLbl = siDdDayLabel(Math.floor(end / 7), end % 7);
  const recCount = ddRecordsInRange(SI_DD_STATE.rangePreset).length;
  return `<div class="dd-rangebar">
    <div class="dd-range-label dd-cal-wrap" onclick="event.stopPropagation()">
      <button class="dd-cal-pill${SI_DD_CAL.open ? " open" : ""}${SI_DD_CAL.pa != null ? " pending" : ""}" onclick="ddCalToggle()" title="Choose From and To dates">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/></svg>
        <span id="dd-cal-lbl">${SI_DD_CAL.pa != null ? ddCalFmt(SI_DD_CAL.pa) + " – " + ddCalFmt(SI_DD_CAL.pb) : ddCalFmt(start) + " – " + ddCalFmt(end)}</span>
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="dd-cal-pop" id="dd-cal-pop">${SI_DD_CAL.open ? ddCalPopHtml() : ""}</div>
      <button class="dd-cal-go${SI_DD_CAL.pa != null ? " ready" : ""}" id="dd-cal-go" onclick="ddCalApply()" title="Load the selected From / To range">Go</button>
    </div>
    <div class="dd-presets">
      ${DD_RANGE_PRESETS.map(p => `<button class="dd-preset ${p.id === SI_DD_STATE.rangePreset ? 'active' : ''}" onclick="ddSetRange('${p.id}')">${p.label}</button>`).join('')}
    </div>
  </div>`;
}

/* level chips (Week · Day · Position · Employee · Shift) — live in the
   table toolbar row, next to search / columns / export */
const DD_DIM_CHIP_ICON = {
  week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  day: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><rect x="8" y="13" width="4" height="4" rx="1"/>',
  position: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  employee: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  shift: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  event: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
};
function ddDimChipsHtml(){
  return `<div class="dd-dimchips" role="tablist">
    ${DD_DIM_ORDER.map(d => (d === 'event' ? '<span class="dd-dimsep"></span>' : '') + `<button class="dd-dimchip${d === 'event' ? ' ev' : ''}${SI_DD_STATE.dim === d ? ' active' : ''}" role="tab" aria-selected="${SI_DD_STATE.dim === d}" onclick="ddSetDim('${d}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DD_DIM_CHIP_ICON[d]}</svg>${DD_DIM_LABEL[d]}</button>`).join('')}
  </div>`;
}

/* Detailed view options: a row can be broken down by EVERY other level
   (incl. Shift), even one already pinned upstream — e.g. Week → Day →
   Employee rows still offer "by Week" and "by Day" for that person.
   Shift rows are the leaf, so they offer nothing. */
function ddBreakdownOptions(dim){
  if (dim === 'shift') return [];
  return DD_DIM_ORDER.filter(d => d !== dim);
}


/* ---- flexible drill (ported from the Deep Dive reference's drill()/setDim()):
   a row can break down by ANY dimension not already applied, not just the
   next one in Week -> Day -> Position -> Employee. Week is implied once a
   single day is pinned, so it's never offered under a day. ---- */
function ddUsedDims(path, dim){
  const used = path.map(p => p.dim);
  if (dim) used.push(dim);
  return used;
}

function ddRemainingDims(path, dim){
  const used = ddUsedDims(path, dim);
  return DD_DIM_ORDER.filter(d => used.indexOf(d) < 0 && !(d === 'week' && used.indexOf('day') >= 0));
}

/* what clicking a row NAME drills into: the next remaining dim after the
   current one in the fixed order (keeps the original Week -> Day -> Position
   -> Employee click-through); employee rows stay a leaf for name clicks */
function ddDefaultDrillDim(path, dim){
  if (dim === 'shift') return null;
  if (dim === 'event') return 'week';   // exception -> its weeks (then Day -> Position -> Employee -> Shift), rolled up from matching shifts only
  const remaining = ddRemainingDims(path, dim);
  const after = DD_DIM_ORDER.slice(DD_DIM_ORDER.indexOf(dim) + 1);
  return after.find(d => remaining.indexOf(d) >= 0) || null;
}

function ddDimTag(p){
  const lbl = DD_DIM_LABEL[p.dim];
  return p.label.toLowerCase().indexOf(lbl.toLowerCase()) === 0 ? p.label : lbl + ': ' + p.label;
}

function ddBreadcrumbHtml(){
  const path = SI_DD_STATE.path;
  if (!path.length) return '';
  let html = `<div class="dd-drillbar"><div class="si-crumbs"><span class="dd-drill-lbl">Drilldown</span><span class="crumb" onclick="ddJumpRoot()">All ${DD_DIM_PLURAL[path[0].dim]}</span>`;
  path.forEach((p, i) => {
    const isLast = i === path.length - 1;
    const lbl = i === 0 ? p.label : ddDimTag(p);
    html += `<span class="sep">›</span>`;
    html += isLast ? `<span class="crumb current">${lbl}</span>` : `<span class="crumb" onclick="ddJumpPath(${i})">${lbl}</span>`;
  });
  html += `<span class="dd-drill-lvl">› ${DD_DIM_PLURAL[SI_DD_STATE.dim]}</span></div>
    <button class="dd-clear-drill" onclick="ddJumpRoot()" title="Back to All ${DD_DIM_PLURAL[path[0].dim]}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>Clear drilldown
    </button></div>`;
  return html;
}

function ddSectionHeaderHtml(rowCount){
  const dim = SI_DD_STATE.dim;
  const childDim = ddDefaultDrillDim(SI_DD_STATE.path, dim);
  const desc = dim === 'shift'
    ? `Every scheduled shift — the underlying schedule detail`
    : childDim
      ? `Click a name to drill into its ${DD_DIM_PLURAL[childDim].toLowerCase()}, or an icon to break down by any level`
      : `Click an icon to break down by any level · click any trend line to enlarge it`;
  return `<div class="dd-section-row">
    <div class="dd-section">
      <div class="h">Breakdown by ${DD_DIM_LABEL[dim].toLowerCase()}</div>
      <div class="desc">${desc} · ${rowCount} rows</div>
    </div>
    <div class="dd-tb-row">
      ${ddDimChipsHtml()}
      ${ddToolbarHtml(dim)}
    </div>
  </div>`;
}

/* ============================================================
   Table toolbar: search · column picker · export
   ============================================================ */
const DD_TB_ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  cols: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  csv: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  xls: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};
function ddTbIcon(n, s){ return `<svg width="${s || 15}" height="${s || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DD_TB_ICON[n]}</svg>`; }

/* the toggleable columns: every KPI + Detailed view (the name column is fixed) */
function ddColDefs(){
  const cols = ddDimKpis(SI_DD_STATE.dim).map(k => ({ id: k.id, label: k.label }));
  if (SI_DD_STATE.dim === 'shift') return [{ id: 'employee', label: 'Employee' }, { id: 'position', label: 'Position' }, { id: 'schTime', label: 'Schedule Time' }].concat(cols);
  return cols.concat([{ id: 'drill', label: 'Detailed view' }]);
}
function ddColVisible(id){ return !SI_DD_STATE.hiddenCols[id]; }

function ddToolbarHtml(dim){
  const cols = ddColDefs();
  const shown = cols.filter(c => ddColVisible(c.id)).length;
  const menu = SI_DD_STATE.menu;
  const q = SI_DD_STATE.q || '';
  return `<div class="dd-toolbar">
    <div class="dd-tb-search${q ? ' has-q' : ''}">
      ${ddTbIcon('search', 15)}
      <input type="text" placeholder="Search ${DD_DIM_LABEL[dim].toLowerCase()}..." value="${q.replace(/"/g, '&quot;')}" oninput="ddFilterRows(this.value)">
      <button class="dd-tb-clear" title="Clear search" onclick="ddClearSearch()">${ddTbIcon('x', 13)}</button>
    </div>
    <div class="dd-tb-wrap">
      <button class="dd-tb-btn${menu === 'cols' ? ' open' : ''}" onclick="event.stopPropagation(); ddToggleMenu('cols')">
        ${ddTbIcon('cols')}<span>Columns</span><em>${shown}/${cols.length}</em>${ddTbIcon('chev', 13)}
      </button>
      ${menu === 'cols' ? `<div class="dd-tb-menu cols" onclick="event.stopPropagation()">
        <div class="dd-tb-menu-h">Show columns<button onclick="ddShowAllCols()">Show all</button></div>
        <label class="dd-tb-col fixed"><span class="dd-tb-cb on">${ddTbIcon('check', 11)}</span>${DD_DIM_LABEL[dim]}<i>Always shown</i></label>
        ${cols.map(c => `<label class="dd-tb-col" onclick="ddToggleCol('${c.id}')"><span class="dd-tb-cb${ddColVisible(c.id) ? ' on' : ''}">${ddTbIcon('check', 11)}</span>${c.label}</label>`).join('')}
      </div>` : ''}
    </div>
    <div class="dd-tb-wrap">
      <button class="dd-tb-btn primary${menu === 'export' ? ' open' : ''}" onclick="event.stopPropagation(); ddToggleMenu('export')">
        ${ddTbIcon('download')}<span>Export</span>${ddTbIcon('chev', 13)}
      </button>
      ${menu === 'export' ? `<div class="dd-tb-menu export" onclick="event.stopPropagation()">
        <div class="dd-tb-menu-h">Export ${DD_DIM_PLURAL[dim].toLowerCase()}</div>
        <button class="dd-tb-item" onclick="ddExport('csv')"><span class="ic csv">${ddTbIcon('csv', 16)}</span><span><b>CSV file</b><i>Opens in Excel, Sheets, Numbers</i></span></button>
        <button class="dd-tb-item" onclick="ddExport('xlsx')"><span class="ic xls">${ddTbIcon('xls', 16)}</span><span><b>Excel workbook</b><i>.xlsx with numeric cells</i></span></button>
        <button class="dd-tb-item" onclick="ddExport('copy')"><span class="ic copy">${ddTbIcon('copy', 16)}</span><span><b>Copy to clipboard</b><i>Paste straight into a sheet</i></span></button>
        <div class="dd-tb-menu-f">Visible columns · rows matching search</div>
      </div>` : ''}
    </div>
  </div>`;
}

function ddToggleMenu(m){
  SI_DD_STATE.menu = SI_DD_STATE.menu === m ? null : m;
  siRenderDeepDive();
}
function ddToggleCol(id){
  SI_DD_STATE.hiddenCols[id] = !SI_DD_STATE.hiddenCols[id];
  try { localStorage.setItem('si-dd-hidden-cols', JSON.stringify(SI_DD_STATE.hiddenCols)); } catch (e) {}
  siRenderDeepDive();
}
function ddShowAllCols(){
  SI_DD_STATE.hiddenCols = {};
  try { localStorage.removeItem('si-dd-hidden-cols'); } catch (e) {}
  siRenderDeepDive();
}
function ddClearSearch(){
  const inp = document.querySelector('#tab-deepdive .dd-tb-search input');
  if (inp) { inp.value = ''; inp.focus(); }
  ddFilterRows('');
}

/* rows + columns exactly as the table shows them (visible cols, search) */
function ddExportMatrix(){
  const dim = SI_DD_STATE.dim;
  const q = (SI_DD_STATE.q || '').trim().toLowerCase();
  const kpis = ddDimKpis(dim).filter(k => ddColVisible(k.id));
  const unit = { hours: ' (hrs)', dollar: ' ($)', percent: ' (%)', count: '' };
  if (dim === 'shift') {
    const showEmp = ddColVisible('employee'), showPos = ddColVisible('position'), showTime = ddColVisible('schTime');
    const header = ['Date'].concat(showEmp ? ['Employee'] : [], showPos ? ['Position'] : [], showTime ? ['Schedule Time'] : [], kpis.map(k => k.label + unit[k.fmt]), ['Warning Detail']);
    const rows = SI_DD_CURRENT_GROUPS.map(g => {
      const r = g.meta.rec;
      if (q && ddShiftSearchText(g).indexOf(q) < 0) return null;
      const agg = deepdiveAggregate(g.records);
      return [ddIdxToIso(g.meta.g)].concat(showEmp ? [r.employeeName] : [], showPos ? [r.position] : [], showTime ? [siDdShiftTime(r)] : [],
        kpis.map(k => Math.round(agg[k.id] * 100) / 100), [siDdShiftWarnings(r).join('; ')]);
    }).filter(Boolean);
    return { header, rows };
  }
  const header = [DD_DIM_LABEL[dim], 'Detail'].concat(kpis.map(k => k.label + unit[k.fmt]));
  const rows = SI_DD_CURRENT_GROUPS.map(g => {
    const { name, sub } = ddRowLabel(g, dim);
    if (q && name.toLowerCase().indexOf(q) < 0) return null;
    const agg = deepdiveAggregate(g.records);
    return [name, sub].concat(kpis.map(k => Math.round(agg[k.id] * 100) / 100));
  }).filter(Boolean);
  return { header, rows };
}

function ddExportName(ext){
  const { start, end } = ddRangeIndices(SI_DD_STATE.rangePreset);
  return `schedule-deep-dive_${SI_DD_STATE.dim}_${ddIdxToIso(start)}_to_${ddIdxToIso(end)}.${ext}`;
}

function ddDownload(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ddToast(msg){
  let t = document.getElementById('dd-toast');
  if (!t) { t = document.createElement('div'); t.id = 'dd-toast'; t.className = 'dd-toast'; document.body.appendChild(t); }
  t.innerHTML = ddTbIcon('check', 14) + '<span>' + msg + '</span>';
  t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

function ddExport(kind){
  const { header, rows } = ddExportMatrix();
  SI_DD_STATE.menu = null;
  siRenderDeepDive();
  ddExportData(kind, header, rows, ddExportName, DD_DIM_PLURAL[SI_DD_STATE.dim]);
}

/* shared writer for the table toolbar and the Shift records pop-up:
   nameFn(ext) -> file name, sheet -> Excel tab name */
function ddExportData(kind, header, rows, nameFn, sheet){
  if (kind === 'csv') {
    const esc = v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [header].concat(rows).map(r => r.map(esc).join(',')).join('\r\n');
    ddDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), nameFn('csv'));
    ddToast(`Exported ${rows.length} rows to CSV`);
  } else if (kind === 'copy') {
    const tsv = [header].concat(rows).map(r => r.join('\t')).join('\n');
    const done = () => ddToast(`Copied ${rows.length} rows — paste into any sheet`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(done, () => ddCopyFallback(tsv, done));
    else ddCopyFallback(tsv, done);
  } else if (kind === 'xlsx') {
    const write = () => {
      const ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
      ws['!cols'] = header.map((h, i) => ({ wch: i < 3 ? 22 : Math.max(12, h.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, String(sheet).slice(0, 31));
      XLSX.writeFile(wb, nameFn('xlsx'));
      ddToast(`Exported ${rows.length} rows to Excel`);
    };
    // SheetJS is only fetched the first time someone exports to Excel
    if (window.XLSX) return write();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = write;
    s.onerror = () => ddToast('Could not load the Excel exporter — try CSV instead');
    document.head.appendChild(s);
  }
}

function ddCopyFallback(text, done){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { ddToast('Copy failed — use CSV instead'); }
  ta.remove();
}

/* ============================================================
   Trend lines (ported from the reference's buildSpark / zoom)
   ============================================================ */
const DD_RED = '#B42318';
const DD_INK = '#111827';
const DD_PURPLE = '#6D28D9';
const DD_RATIO_KPIS = ['splh','schLbrPerc'];
let SI_DD_SPARKS = [];

function ddShortDate(g){ return siDdDayLabel(Math.floor(g / 7), g % 7).date; }

function ddFmtVal(v, fmt){
  if (fmt === 'count') return String(Math.round(v * 100) / 100);
  if (fmt === 'hours') return v.toFixed(2) + ' hrs';
  if (fmt === 'dollar') return siFmtDollar(v);
  return v.toFixed(2) + '%';
}
function ddFmtAxis(v, fmt){
  if (fmt === 'count') return String(Math.round(v * 10) / 10);
  if (fmt === 'hours') return v.toFixed(1) + 'h';
  if (fmt === 'dollar') return Math.abs(v) >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v.toFixed(0);
  return v.toFixed(2) + '%';
}
function ddFmtDelta(d, fmt){
  const sign = d >= 0 ? '+' : '-';
  if (fmt === 'count') return sign + String(Math.round(Math.abs(d) * 100) / 100);
  if (fmt === 'hours') return sign + Math.abs(d).toFixed(2) + ' hrs';
  if (fmt === 'dollar') return sign + siFmtDollar(Math.abs(d));
  return sign + Math.abs(d).toFixed(2) + 'pt';
}

/* "bad" = on the wrong side of the KPI's target (hours/$ have no target) */
function ddHasTarget(k){ return typeof k.target === 'number'; }
function ddIsBad(k, v){ return ddHasTarget(k) && (k.lowerIsBad ? v < k.target : v > k.target); }

/* buckets [{label, records}] -> [{label, value}] for one KPI. Empty buckets
   are real zeros for summed KPIs, but meaningless for ratio KPIs (no shifts
   means no SPLH), so those are dropped from the line instead. */
function ddSeriesValues(buckets, k){
  const ratio = DD_RATIO_KPIS.indexOf(k.id) >= 0;
  return buckets
    .filter(b => !ratio || b.records.length)
    .map(b => ({ label: b.label, value: deepdiveAggregate(b.records)[k.id] }));
}

/* the per-row series behind each little trend line — same bucketing as the
   reference: a week row plots its 7 days, a day row plots the trailing 14
   days up to it, anything else plots the selected range in <=14 day-buckets */
function ddRowBuckets(group, dim, scopedRecords){
  const path = SI_DD_STATE.path;
  if (dim === 'week') {
    const byDay = {};
    group.records.forEach(r => { (byDay[r.dayIdx] = byDay[r.dayIdx] || []).push(r); });
    return Object.keys(byDay).map(Number).sort((a, b) => a - b)
      .map(d => ({ label: SI_DD_DAY_NAMES[d] + ' ' + ddShortDate(ddGlobalIdx(group.meta.id, d)), records: byDay[d] }));
  }
  if (dim === 'day') {
    const look = ddApplyPath(SI_DD_RECORDS, path.filter(p => p.dim !== 'week' && p.dim !== 'day'));
    const g = group.meta.id, from = Math.max(0, g - 13);
    const out = [];
    for (let i = from; i <= g; i++) out.push({ label: ddShortDate(i), records: look.filter(r => ddGlobalIdx(r.weekIdx, r.dayIdx) === i) });
    return out;
  }
  const dayList = Array.from(new Set(scopedRecords.map(r => ddGlobalIdx(r.weekIdx, r.dayIdx)))).sort((a, b) => a - b);
  if (!dayList.length) return [];
  const nb = Math.max(1, Math.min(14, dayList.length));
  const bSize = Math.max(1, Math.ceil(dayList.length / nb));
  const bCount = Math.ceil(dayList.length / bSize);
  const pos = {}; dayList.forEach((d, i) => { pos[d] = i; });
  const out = [];
  for (let i = 0; i < bCount; i++) {
    const a = dayList[i * bSize], z = dayList[Math.min(dayList.length - 1, (i + 1) * bSize - 1)];
    out.push({ label: a === z ? ddShortDate(a) : ddShortDate(a) + '–' + ddShortDate(z), records: [] });
  }
  group.records.forEach(r => { const b = out[Math.floor(pos[ddGlobalIdx(r.weekIdx, r.dayIdx)] / bSize)]; if (b) b.records.push(r); });
  return out;
}

/* the filters a trend's pop-up re-aggregates over: the current drill path
   minus week/day (the pop-up picks its own time axis), plus the row itself
   when the row is a position or employee */
function ddRowCtx(group, dim, name){
  const filters = SI_DD_STATE.path.filter(p => p.dim !== 'week' && p.dim !== 'day');
  if (dim === 'position' || dim === 'employee' || dim === 'event') filters.push({ dim, id: group.meta.id, label: name });
  return filters;
}

/* smooth SVG path through points (Catmull-Rom -> cubic Bezier), y clamped
   to the box so curves never overshoot past the top/bottom edge */
function ddSmoothPath(pts, yMin, yMax){
  if (pts.length < 3) return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
  const c = v => Math.min(yMax, Math.max(yMin, v));
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = c(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = c(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/* row trend line — same look as the KPI tiles (smoothed line + soft
   gradient fill). Target line / miss dots are left to the enlarged pop-up
   so the table stays clean; a row that misses target still draws in red. */
function ddSparkHtml(points, k, color, title, ctxFilters, sub, dim){
  const SW = 100, SH = 28, n = points.length;
  if (n < 1) return '';
  const vals = points.map(p => p.value);
  const idx = SI_DD_SPARKS.push({ title, sub: sub || '', dim: dim || '', kpiId: k.id, color, labels: points.map(p => p.label), vals, ctx: ctxFilters }) - 1;
  // light rolling average on long series so day-to-day noise reads as a trend
  const w = n > 8 ? Math.ceil(n / 8) : 1;
  const sm = vals.map((v, i) => { const s = vals.slice(Math.max(0, i - w + 1), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
  const lo0 = Math.min.apply(null, sm), hi0 = Math.max.apply(null, sm);
  // nothing to trend (e.g. zero OT all period): quiet grey baseline, not a coloured line
  if (hi0 === 0 && lo0 === 0) color = "#d1d5db";
  const pad = (hi0 - lo0) * 0.15 || Math.abs(hi0) * 0.1 || 1;
  const lo = (hi0 === 0 && lo0 === 0) ? 0 : lo0 - pad, hi = hi0 + pad;
  const X = i => n === 1 ? SW / 2 : (i / (n - 1)) * SW;
  const Y = v => SH - 2 - ((v - lo) / (hi - lo)) * (SH - 5);
  const pts = sm.map((v, i) => [X(i), Y(v)]);
  const line = n === 1 ? `M0,${Y(sm[0]).toFixed(1)} L${SW},${Y(sm[0]).toFixed(1)}` : ddSmoothPath(pts, 1, SH - 1);
  const area = line + ` L${SW},${SH} L0,${SH} Z`;
  const step = n === 1 ? SW : SW / (n - 1);
  const hits = points.map((p, i) =>
    `<rect x="${Math.max(0, X(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${SH}" fill="transparent"><title>${p.label} · ${ddFmtVal(p.value, k.fmt)}</title></rect>`).join('');
  return `<svg class="dd-spark" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" onclick="event.stopPropagation(); ddOpenZoom(${idx})">
    <defs><linearGradient id="rs${idx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".14"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#rs${idx})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${hits}
  </svg>`;
}

/* ---- Detailed view icons (reference's drills + Transactions button) ---- */
const DD_ICON_TONE = {
  week:     { bg:'#DBEAFE', fg:'#1D4ED8' },
  day:      { bg:'#DBEAFE', fg:'#1D4ED8' },
  position: { bg:'#EDE9FE', fg:'#6D28D9' },
  employee: { bg:'#FEF3C7', fg:'#B45309' },
  shift:    { bg:'#DCFCE7', fg:'#15803D' },
  event:    { bg:'#FEE2E2', fg:'#DC2626' },
};
const DD_ICON_SVG = {
  cal: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  position: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  person: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
  receipt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5v17l2.5-1.6 2.5 1.6 2-1.6 2 1.6 2.5-1.6 2.5 1.6v-17z"/><path d="M9 8.5h6M9 12.5h6"/></svg>',
};

function ddDrillIconsHtml(i, dim){
  const icons = ddBreakdownOptions(dim).map(d => {
    const t = DD_ICON_TONE[d];
    const svg = d === 'event' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>' : d === 'employee' ? DD_ICON_SVG.person : d === 'position' ? DD_ICON_SVG.position : d === 'shift' ? DD_ICON_SVG.receipt : DD_ICON_SVG.cal;
    const title = d === 'shift' ? 'View shifts' : d === 'event' ? 'View exceptions (OT, warnings…)' : 'Break down by ' + DD_DIM_LABEL[d];
    return `<button class="dd-drill" title="${title}" style="background:${t.bg};color:${t.fg}" onclick="event.stopPropagation(); ddBreakDownRow(${i}, '${d}')">${svg}</button>`;
  }).join('');
  return `<div class="dd-drills">${icons}</div>`;
}

/* ---- header sorting: click a column to sort, click again to flip,
   a third click returns to the default order (chronological for
   week/day newest first, scheduled hours high-to-low otherwise) ---- */
function ddSortThHtml(key, label){
  const s = SI_DD_STATE.sort;
  const on = s && s.key === key;
  const arrow = on ? (s.dir === 'asc' ? '▲' : '▼') : '⇅';
  const def = ddKpiDef(key);
  const tip = 'Sort by ' + label + (def && def.info ? ' — ' + def.info : '');
  return `<th class="dd-sortable${on ? ' sorted' : ''}" onclick="ddSortBy('${key}')" title="${tip}">${label}<span class="dd-sort-ic">${arrow}</span></th>`;
}

/* ---- columns per breakdown level: Week/Day keep the full KPI set,
   Position and Employee get their own operational columns ---- */
const DD_DIM_COLS = {
  week:     ['schHrs', 'splh', 'schDollar', 'schLbrPerc', 'fctSales', 'fctStaff', 'otHrs', 'otDollar'],
  day:      ['schHrs', 'splh', 'schDollar', 'schLbrPerc', 'fctSales', 'fctStaff', 'otHrs', 'otDollar'],
  position: ['schHrs', 'schDollar', 'fctStaff', 'otHrs', 'otDollar', 'warnCount'],
  employee: ['schHrs', 'schDollar', 'otHrs', 'otDollar', 'warnCount', 'shiftCount'],
  shift:    ['schHrs', 'warnCount', 'avgRate', 'schDollar', 'otHrs', 'otDollar'],
  event:    ['shiftCount', 'empCount', 'schHrs', 'fctStaff', 'schDollar', 'otHrs', 'otDollar', 'warnCount'],
};
function ddKpiDef(id){
  return SI_DD_KPI_DEFS.find(k => k.id === id) || SI_DD_EXTRA_DEFS.find(k => k.id === id) || null;
}
/* hover text for a Warning Count cell: how many of each warning type */
function ddWarnBreakdown(records){
  const c = {};
  records.forEach(r => siDdShiftWarnings(r).forEach(w => { c[w] = (c[w] || 0) + 1; }));
  const parts = Object.keys(c).map(w => w + ': ' + c[w]);
  return parts.length ? parts.join(' · ') : 'No shift warnings';
}

/* Week/Day scoped to a position, employee or exception: store-level KPIs
   (SPLH, Labor %, Forecasted Sales) mean nothing for one role or person,
   so those rows get the operational column set instead */
const DD_SCOPED_TIME_COLS = ['schHrs', 'schDollar', 'fctStaff', 'otHrs', 'otDollar', 'warnCount', 'shiftCount'];
function ddScopePins(){
  return SI_DD_STATE.path.filter(p => p.dim === 'position' || p.dim === 'employee' || p.dim === 'event');
}
function ddDimKpis(dim){
  if ((dim === 'week' || dim === 'day') && ddScopePins().length) return DD_SCOPED_TIME_COLS.map(ddKpiDef);
  const ids = DD_DIM_COLS[dim];
  return ids ? ids.map(ddKpiDef) : SI_DD_KPI_DEFS;
}

function ddSortBy(key){
  const s = SI_DD_STATE.sort;
  const firstDir = (key === 'name' || key === 'employee' || key === 'position' || key === 'schTime') ? 'asc' : 'desc';
  if (!s || s.key !== key) SI_DD_STATE.sort = { key, dir: firstDir };
  else if (s.dir === firstDir) SI_DD_STATE.sort = { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
  else SI_DD_STATE.sort = null;
  siRenderDeepDive();
}

function ddApplySort(groups, dim){
  const s = SI_DD_STATE.sort;
  // a sort on a column this level doesn't show (e.g. SPLH, then switching
  // to Employee) is ignored instead of silently reordering the rows
  const textKey = dim === 'shift' && (s && (s.key === 'employee' || s.key === 'position' || s.key === 'schTime'));
  if (!s || (s.key !== 'name' && !textKey && !ddDimKpis(dim).some(k => k.id === s.key))) return;
  const sign = s.dir === 'asc' ? 1 : -1;
  if (textKey && s.key === 'schTime') {
    groups.sort((a, b) => sign * (a.meta.rec.start - b.meta.rec.start) || (b.meta.g - a.meta.g));
    return;
  }
  if (textKey) {
    const f = s.key === 'employee' ? 'employeeName' : 'position';
    groups.sort((a, b) => sign * a.meta.rec[f].localeCompare(b.meta.rec[f]) || (b.meta.g - a.meta.g));
    return;
  }
  if (s.key === 'name') {
    if (dim === 'shift') groups.sort((a, b) => sign * (a.meta.g - b.meta.g) || a.meta.rec.employeeName.localeCompare(b.meta.rec.employeeName));
    else if (dim === 'week' || dim === 'day') groups.sort((a, b) => sign * (a.meta.id - b.meta.id));
    else groups.sort((a, b) => sign * ddRowLabel(a, dim).name.localeCompare(ddRowLabel(b, dim).name));
    return;
  }
  const val = new Map(groups.map(g => [g, deepdiveAggregate(g.records)[s.key]]));
  groups.sort((a, b) => sign * (val.get(a) - val.get(b)));
}

/* ---- leading visual in the name cell: calendar tile for weeks, mini
   calendar page for days, role icon for positions, photo for employees ---- */
/* position -> role icon + tone (lucide-style strokes); the tone also
   colours each employee's avatar ring */
const DD_POSITION_ICON = {
  'General Manager':   { bg:'#dcfce7', fg:'#15803d', svg:'<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>' },
  'Assistant Manager': { bg:'#ede9fe', fg:'#6d28d9', svg:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' },
  'Shift Leader':      { bg:'#fef3c7', fg:'#b45309', svg:'<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>' },
  'Line Cook':         { bg:'#ffe4e6', fg:'#be123c', svg:'<path d="M6 13.9A4 4 0 0 1 7.6 6.1a5 5 0 0 1 8.8 0A4 4 0 0 1 18 13.9V21H6z"/><path d="M6 17h12"/>' },
  'Prep Cook':         { bg:'#ffedd5', fg:'#c2410c', svg:'<path d="M3 21 14 10M14 10l3-7 4 4-7 3"/><path d="M16 14h5M18.5 11.5v5"/>' },
  'GSA':               { bg:'#e0f2fe', fg:'#0369a1', svg:'<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7h10v4M9 3h6v4H9zM7 15h2M11 15h2M15 15h2M7 18h10"/>' },
  'Dishwasher':        { bg:'#e0e7ff', fg:'#4338ca', svg:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>' },
};

/* profile picture: stock portrait per employee (see SI_DD_ROSTER_RAW),
   coloured initials if the photo can't load */
function ddAvatarHtml(name){
  const emp = SI_DD_EMPLOYEES.find(e => e.name === name);
  const color = emp && DD_POSITION_ICON[emp.position] ? DD_POSITION_ICON[emp.position].fg : '#6D28D9';
  const initials = name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const src = emp && emp.photo ? 'https://randomuser.me/api/portraits/' + emp.photo + '.jpg' : '';
  if (!src) return `<span class="dd-avatar" style="--ring:${color}"><b>${initials}</b></span>`;
  return `<span class="dd-avatar" style="--ring:${color}">
    <img src="${src}" alt="${name}" loading="lazy" onerror="this.remove()">
    <b>${initials}</b>
  </span>`;
}

function ddRowLead(g, dim){
  if (dim === 'week') return `<span class="dd-row-ic">${DD_ICON_SVG.cal}</span>`;
  if (dim === 'employee') return ddAvatarHtml(g.meta.name);
  if (dim === 'event') { const ev = ddEventDef(g.meta.id); return `<span class="dd-row-ic" style="background:${ev.bg};color:${ev.tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DD_DIM_CHIP_ICON.event}</svg></span>`; }
  if (dim === 'day' || dim === 'shift') {
    // mini calendar page: weekday strip on top, date number below; weekends tinted
    const weekend = g.meta.dayIdx >= 5;
    const gi = dim === 'shift' ? g.meta.g : g.meta.id;
    return `<span class="dd-day-ic${weekend ? ' we' : ''}"><i>${SI_DD_DAY_NAMES[g.meta.dayIdx]}</i><b>${ddDateOf(gi).getDate()}</b></span>`;
  }
  if (dim === 'position') {
    const p = DD_POSITION_ICON[g.meta.id] || { bg:'#eef2ff', fg:'#4f46e5', svg:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>' };
    return `<span class="dd-row-ic" style="background:${p.bg};color:${p.fg}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.svg}</svg></span>`;
  }
  return '';
}

/* ---- period-over-period comparison (Week & Day rows only) ----
   Week row -> the previous week; Day row -> the same weekday last week.
   Uses the full dataset (not just the selected range) so the first row in
   the range still has something to compare against, and keeps any
   position/employee drill filters so it's like-for-like. */
function ddPriorFor(g, dim){
  if (dim !== 'week' && dim !== 'day') return null;
  const base = ddApplyPath(SI_DD_RECORDS, SI_DD_STATE.path.filter(p => p.dim !== 'week' && p.dim !== 'day'));
  let recs, label;
  if (dim === 'week') {
    const w = g.meta.id - 1;
    if (w < 0) return { none: true, label: 'previous week' };
    recs = base.filter(r => r.weekIdx === w);
    label = ddWeekName(w);
  } else {
    const d = g.meta.id - 7;
    if (d < 0) return { none: true, label: 'same day last week' };
    recs = base.filter(r => ddGlobalIdx(r.weekIdx, r.dayIdx) === d);
    const l = siDdDayLabel(Math.floor(d / 7), d % 7);
    label = l.day + ', ' + l.date;
  }
  return { agg: deepdiveAggregate(recs), empty: !recs.length, label };
}

/* which direction is "good" for each KPI (others are shown neutral grey) */
const DD_UP_GOOD = { splh: true, fctSales: true };
const DD_UP_BAD = { schDollar: true, schLbrPerc: true, otHrs: true, otDollar: true, warnCount: true };

function ddCmpChip(k, cur, prior){
  if (prior.none || prior.empty) return `<span class="dd-cmp na" title="No data for the ${prior.label}">—</span>`;
  const prev = prior.agg[k.id];
  const d = cur - prev;
  const flat = Math.abs(d) < 0.005;
  let txt;
  if (k.fmt === 'percent') txt = Math.abs(d).toFixed(1) + ' pts';
  else if (prev) txt = Math.abs(d / prev * 100).toFixed(1) + '%';
  else txt = ddFmtDelta(d, k.fmt).replace(/^[+-]/, '');   // prior was 0: show the absolute change
  const tone = flat ? 'flat' : DD_UP_GOOD[k.id] ? (d > 0 ? 'good' : 'bad') : DD_UP_BAD[k.id] ? (d > 0 ? 'bad' : 'good') : 'neutral';
  const arrow = flat ? '•' : d > 0 ? '▲' : '▼';
  return `<span class="dd-cmp ${tone}" title="vs ${prior.label}: ${ddFmtVal(prev, k.fmt)} (${ddFmtDelta(d, k.fmt)})">${arrow} ${flat ? '0%' : txt}</span>`;
}

/* cell value: the number stays prominent, the unit ("hrs") drops to a
   small muted suffix so the column reads as clean numbers */
function ddCellVal(v, fmt){
  if (fmt === 'hours') return `${siFmtHours(v)}<span class="u">hrs</span>`;
  return siFmtByType(v, fmt);
}

/* search text for one shift row: date, employee, position, plus keywords
   ("warning", the warning types, "ot") so those filters work too */
function ddShiftSearchText(g){
  const r = g.meta.rec, l = siDdDayLabel(r.weekIdx, r.dayIdx), w = siDdShiftWarnings(r);
  return (l.day + ' ' + l.date + ' ' + r.employeeName + ' ' + r.position + ' ' + siDdShiftTime(r).toLowerCase() +
    (w.length ? ' warning ' + w.join(' ') : '') + (siDdOtCalc([r]).hrs ? ' ot overtime' : '')).toLowerCase();
}

/* Shift level: one row per scheduled shift (the old pop-up, now inline) */
function ddShiftTableHtml(groups){
  const kpis = ddDimKpis('shift').filter(k => ddColVisible(k.id));
  const showEmp = ddColVisible('employee'), showPos = ddColVisible('position'), showTime = ddColVisible('schTime');
  const thead = `<tr>${ddSortThHtml('name', 'Date')}${showEmp ? ddSortThHtml('employee', 'Employee') : ''}${showPos ? ddSortThHtml('position', 'Position') : ''}${showTime ? ddSortThHtml('schTime', 'Schedule Time') : ''}${kpis.map(k => ddSortThHtml(k.id, k.label)).join('')}</tr>`;
  const rows = groups.map(g => {
    const r = g.meta.rec;
    const agg = deepdiveAggregate(g.records);
    const warns = siDdShiftWarnings(r);
    const pos = DD_POSITION_ICON[r.position];
    const cells = kpis.map(k => {
      let val;
      if (k.id === 'warnCount') val = `<span class="dd-warn-pill${warns.length ? ' on' : ''}" title="${warns.length ? warns.join(' · ') : 'No shift warnings'}">${warns.length ? '⚠ ' : ''}${warns.length}</span>`;
      else val = ddCellVal(agg[k.id], k.fmt);
      const zero = k.id !== 'warnCount' && Math.abs(agg[k.id]) < 0.005;
      const hot = (k.id === 'otHrs' || k.id === 'otDollar') && !zero;
      return `<td class="dd-metric-cell sh"><div class="v${zero ? ' zero' : ''}${hot ? ' flag' : ''}">${val}</div></td>`;
    }).join('');
    const { name, sub } = ddRowLabel(g, 'shift');
    return `<tr data-rowname="${ddShiftSearchText(g).replace(/"/g, '')}">
      <td class="dd-row-name"><div class="dd-row-flex">${ddRowLead(g, 'shift')}<div><div class="nm">${name}</div><div class="sub">${sub}</div></div></div></td>
      ${showEmp ? `<td class="dd-sh-emp"><div class="dd-row-flex">${ddAvatarHtml(r.employeeName)}<span>${r.employeeName}</span></div></td>` : ''}
      ${showPos ? `<td class="dd-sh-pos"><span class="dd-pos-tag" style="background:${pos ? pos.bg : '#eef2ff'};color:${pos ? pos.fg : '#4f46e5'}">${r.position}</span></td>` : ''}
      ${showTime ? `<td class="dd-sh-time"><span class="dd-time-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${siDdShiftTime(r)}</span></td>` : ''}
      ${cells}
    </tr>`;
  }).join('');
  return `<div class="dd-table-wrap"><table class="dd-table dd-table-shift"><thead>${thead}</thead><tbody>${rows}</tbody></table>
    <div class="dd-nomatch" style="display:none">No shifts match your search. <button onclick="ddClearSearch()">Clear search</button></div></div>`;
}

/* "drilled from" context columns: every level pinned upstream (e.g. the
   position or employee a week breakdown came from) is shown as its own
   column so rows are readable without looking at the breadcrumb */
function ddContextCols(dim){
  return SI_DD_STATE.path.filter(p => p.dim !== dim && !(dim === 'day' && p.dim === 'week'));
}
function ddContextCellHtml(p){
  if (p.dim === 'employee') return `<div class="dd-row-flex dd-ctx-emp">${ddAvatarHtml(p.label)}<span>${p.label}</span></div>`;
  if (p.dim === 'position') { const t = DD_POSITION_ICON[p.id] || { bg:'#eef2ff', fg:'#4f46e5' }; return `<span class="dd-ctx-tag" style="background:${t.bg};color:${t.fg}">${p.label}</span>`; }
  if (p.dim === 'event') { const ev = ddEventDef(p.id); return `<span class="dd-ctx-tag" style="background:${ev.bg};color:${ev.tone}">${p.label}</span>`; }
  return `<span class="dd-ctx-tag" style="background:#eef2ff;color:#4338ca">${p.label}</span>`;
}

function ddTableHtml(groups, dim, scopedRecords){
  if (dim === 'shift') return ddShiftTableHtml(groups);
  const ctxCols = ddContextCols(dim);
  const ctxTh = ctxCols.map(p => `<th class="dd-ctx-th">${DD_DIM_LABEL[p.dim]}</th>`).join('');
  const ctxTd = ctxCols.map(p => `<td class="dd-ctx-td">${ddContextCellHtml(p)}</td>`).join('');
  const lbrDef = SI_DD_KPI_DEFS.find(k => k.id === 'schLbrPerc');
  const kpis = ddDimKpis(dim).filter(k => ddColVisible(k.id));
  const showDrill = ddColVisible('drill');
  const thead = `<tr>${ddSortThHtml('name', DD_DIM_LABEL[dim])}${ctxTh}${kpis.map(k => ddSortThHtml(k.id, k.label)).join('')}${showDrill ? '<th>Detailed view</th>' : ''}</tr>`;
  const clickable = !!ddDefaultDrillDim(SI_DD_STATE.path, dim);
  const rows = groups.map((g, i) => {
    const agg = deepdiveAggregate(g.records);
    const { name, sub } = ddRowLabel(g, dim);
    // labor % is a store/period measure — per position or per person it just mirrors pay rate, so only flag Week/Day rows
    const overFlag = (dim === 'week' || dim === 'day') && (agg.schLbrPerc - lbrDef.target) >= lbrDef.thresholdPct;
    const buckets = ddRowBuckets(g, dim, scopedRecords);
    const ctx = ddRowCtx(g, dim, name);
    const prior = ddPriorFor(g, dim);
    const cells = kpis.map(k => {
      const flagCell = k.id === 'schLbrPerc' && overFlag;
      const color = ddIsBad(k, agg[k.id]) ? DD_RED : k.accent;
      const spark = ddSparkHtml(ddSeriesValues(buckets, k), k, color, name, ctx, sub, dim);
      const val = k.id === 'warnCount'
        ? `<span class="dd-warn-pill${agg.warnCount ? ' on' : ''}" title="${ddWarnBreakdown(g.records)}">${agg.warnCount ? '⚠ ' : ''}${agg.warnCount}</span>`
        : ddCellVal(agg[k.id], k.fmt);
      const cmp = prior ? ddCmpChip(k, agg[k.id], prior) : '';
      return `<td class="dd-metric-cell"><div class="mc"><div class="mc-l"><div class="v${flagCell ? ' flag' : ''}${k.id !== 'warnCount' && Math.abs(agg[k.id]) < 0.005 ? ' zero' : ''}">${val}</div>${spark}</div>${cmp ? `<div class="mc-r">${cmp}</div>` : ''}</div></td>`;
    }).join('');
    return `<tr class="${clickable ? 'clickable' : ''}" data-rowname="${name.toLowerCase()}" ${clickable ? `onclick="ddDrillRowByIndex(${i})"` : ''}>
      <td class="dd-row-name">${ddRowLead(g, dim) ? `<div class="dd-row-flex">${ddRowLead(g, dim)}<div>` : ''}<div class="nm">${name}${overFlag ? '<span class="dd-over-badge">Over</span>' : ''}</div><div class="sub">${sub}</div>${ddRowLead(g, dim) ? '</div></div>' : ''}</td>
      ${ctxTd}
      ${cells}
      ${showDrill ? `<td class="dd-drill-cell">${ddDrillIconsHtml(i, dim)}</td>` : ''}
    </tr>`;
  }).join('');
  return `<div class="dd-table-wrap"><table class="dd-table"><thead>${thead}</thead><tbody>${rows}</tbody></table>
    <div class="dd-nomatch" style="display:none">No ${DD_DIM_PLURAL[dim].toLowerCase()} match your search. <button onclick="ddClearSearch()">Clear search</button></div></div>`;
}

/* ============================================================
   Trend pop-up (reference's zoom modal: By day / By week,
   Latest / Change / Average / Peak, click a point to drill)
   ============================================================ */
function ddOpenZoom(i){
  const s = SI_DD_SPARKS[i];
  if (!s) return;
  SI_DD_STATE.zoom = s;

  ddRenderModal();
}

function ddCloseModal(){
  SI_DD_STATE.zoom = null;

  ddRenderModal();
}

function ddSetZoomGran(g){
  SI_DD_STATE.zoomGran = g;
  ddRenderModal();
}

/* re-aggregate the pop-up's series over the whole selected range at the
   chosen granularity, for the filters the clicked trend line carried */
function ddZoomBuckets(z, gran){
  const recs = ddApplyPath(ddRecordsInRange(SI_DD_STATE.rangePreset), z.ctx || []);
  const map = {};
  recs.forEach(r => {
    const key = gran === 'week' ? r.weekIdx : ddGlobalIdx(r.weekIdx, r.dayIdx);
    (map[key] = map[key] || { key, records: [] }).records.push(r);
  });
  return Object.keys(map).map(Number).sort((a, b) => a - b).map(key => {
    const b = map[key];
    b.label = gran === 'week' ? 'Wk ' + ddShortDate(key * 7) : ddShortDate(key);
    b.drillLabel = gran === 'week' ? ddWeekName(key) : (() => { const l = siDdDayLabel(Math.floor(key / 7), key % 7); return l.day + ', ' + l.date; })();
    return b;
  });
}

/* inline icons for the trend pop-up (lucide paths, drawn inline so the
   pop-up never waits on the icon CDN) */
const DD_ZI = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  bars: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  sigma: '<path d="M18 7V4H6l6 8-6 8h12v-3"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',
};
function ddZIcon(name, size){
  const s = size || 18;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DD_ZI[name]}</svg>`;
}

function ddZoomHtml(){
  const z = SI_DD_STATE.zoom;
  if (!z) return '';
  const k = ddKpiDef(z.kpiId);
  const gran = SI_DD_STATE.zoomGran || 'day';
  let labels = z.labels, vals = z.vals, buckets = null;
  const zb = ddZoomBuckets(z, gran);
  const pts = ddSeriesValues(zb, k);
  if (pts.length) {
    const ratio = DD_RATIO_KPIS.indexOf(k.id) >= 0;
    buckets = ratio ? zb.filter(b => b.records.length) : zb;
    labels = pts.map(p => p.label);
    vals = pts.map(p => p.value);
  }
  SI_DD_STATE.zoomBuckets = buckets;

  const n = vals.length;
  if (!n) return '';
  const W = 1000, H = 250, L = 8, R = 16, T = 14, B = 30;
  const hasThr = ddHasTarget(k);
  const thr = hasThr ? k.target : 0;
  const zlo0 = Math.min.apply(null, vals), zhi0 = Math.max.apply(null, vals);
  let zlo = zlo0, zhi = zhi0;
  if (hasThr) { if (thr > zhi) zhi = thr; if (thr < zlo) zlo = thr; }
  const zspan = zhi - zlo;
  const zpad = zspan > 0 ? zspan * 0.18 : (Math.abs(zhi) * 0.12 || 1);
  zlo -= zpad; zhi += zpad;
  if (zlo < 0 && zlo0 >= 0) zlo = 0;
  if (!(zhi > zlo)) zhi = zlo + 1;
  const X = i => n === 1 ? L + (W - L - R) / 2 : L + (i / (n - 1)) * (W - L - R);
  const Y = v => (H - B) - Math.min(1, Math.max(0, (v - zlo) / (zhi - zlo))) * (H - B - T);
  const step = n === 1 ? (W - L - R) : (W - L - R) / (n - 1);

  const last = vals[n - 1], first = vals[0], delta = last - first;
  const deltaPct = first ? (delta / Math.abs(first)) * 100 : 0;
  const peakVal = Math.max.apply(null, vals), peakIdx = vals.indexOf(peakVal);
  const lowVal = Math.min.apply(null, vals), lowIdx = vals.indexOf(lowVal);
  const sum = vals.reduce((a, v) => a + v, 0);
  const avg = sum / n;
  // targeted KPIs colour by good/bad direction; untargeted (hours, $) just by up/down
  const badDelta = ddHasTarget(k) ? (k.lowerIsBad ? delta < 0 : delta > 0) : delta < 0;
  const canDrill = !!buckets;
  const color = z.color === DD_RED ? DD_PURPLE : z.color;
  const unitWord = k.fmt === 'count' ? (k.id === 'warnCount' ? 'Warnings' : 'Shifts') : k.fmt === 'hours' ? 'Hours' : k.fmt === 'dollar' ? 'Dollars' : 'Percent';
  const kpiIcon = k.fmt === 'count' ? 'bars' : k.fmt === 'hours' ? 'clock' : k.fmt === 'dollar' ? 'dollar' : 'percent';
  const headIcon = z.dim === 'employee' ? 'user' : z.dim === 'position' ? 'briefcase' : 'calendar';
  const fullLabel = i => buckets && buckets[i] ? buckets[i].drillLabel : labels[i];
  const scope = (z.ctx || []).length ? z.ctx.map(c => c.label).join(' · ') : 'Store 007 - Encinitas';

  // hover data for ddZoomHover(): point position in % of the plot box
  SI_DD_STATE.zoomPts = vals.map((v, i) => ({ x: (X(i) / W) * 100, y: Y(v), val: ddFmtVal(v, k.fmt), label: fullLabel(i), bad: ddIsBad(k, v) }));

  const every = Math.max(1, Math.ceil(n / 14));
  const keep = [];
  for (let i = 0; i < n; i++) {
    if (!(i % every === 0 || i === n - 1)) continue;
    if (i === n - 1) { while (keep.length && X(i) - X(keep[keep.length - 1]) < (W - L - R) * 0.05) keep.pop(); }
    keep.push(i);
  }
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => { const gv = zlo + (zhi - zlo) * f; return { y: Y(gv).toFixed(1), label: ddFmtAxis(gv, k.fmt) }; });
  const poly = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  const area = 'M' + X(0).toFixed(1) + ',' + (H - B) + ' L' + vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' L') + ' L' + X(n - 1).toFixed(1) + ',' + (H - B) + ' Z';
  const showThr = hasThr && thr >= zlo && thr <= zhi;
  const lp = SI_DD_STATE.zoomPts[n - 1];

  const statCard = (tone, icon, lbl, val, foot, extra) => `
    <div class="dz-stat ${tone}">
      <div class="dz-stat-ic">${ddZIcon(icon, 22)}</div>
      <div class="dz-stat-body">
        <div class="dz-stat-lbl">${lbl}</div>
        <div class="dz-stat-val"${extra || ''}>${val}</div>
        ${foot}
      </div>
    </div>`;

  return `<div class="dd-modal-overlay" onclick="ddCloseModal()">
    <div class="dd-modal dz" onclick="event.stopPropagation()">
      <div class="dz-head">
        <div class="dz-head-ic">${ddZIcon(headIcon, 26)}</div>
        <div class="dz-head-tx">
          <div class="dz-title">${z.title}</div>
          <div class="dz-sub">${(z.sub || '').split(' · ').join(' &nbsp;•&nbsp; ')}</div>
        </div>
        <div class="dz-head-r">
          ${canDrill ? `<div class="dz-gran">${[['day','By day'],['week','By week']].map(g => `<button class="${gran === g[0] ? 'active' : ''}" onclick="ddSetZoomGran('${g[0]}')">${g[1]}</button>`).join('')}</div>` : ''}
          <button class="dz-x" onclick="ddCloseModal()" title="Close">×</button>
        </div>
      </div>

      <div class="dz-stats">
        ${statCard('purple', kpiIcon, 'Latest', ddFmtVal(last, k.fmt), `<div class="dz-stat-foot">${unitWord} · ${labels[n - 1]}</div>`)}
        ${statCard(badDelta ? 'red' : 'green', delta >= 0 ? 'up' : 'down', 'Change', ddFmtDelta(delta, k.fmt),
          `<div class="dz-pill">${ddZIcon(delta >= 0 ? 'up' : 'down', 11)} ${Math.abs(deltaPct).toFixed(1)}%</div><div class="dz-stat-foot">vs start of period</div>`)}
        ${statCard('blue', 'bars', 'Average', ddFmtVal(avg, k.fmt), `<div class="dz-stat-foot">${unitWord}</div>`)}
        ${statCard('pink', 'up', 'Highest', ddFmtVal(peakVal, k.fmt), `<div class="dz-stat-foot">${labels[peakIdx] || ''}</div>`,
          canDrill ? ` onclick="ddZoomDrill(${peakIdx})" title="Drill into ${fullLabel(peakIdx)}" style="cursor:pointer"` : '')}
        ${statCard('amber', 'down', 'Lowest', ddFmtVal(lowVal, k.fmt), `<div class="dz-stat-foot">${labels[lowIdx] || ''}</div>`,
          canDrill ? ` onclick="ddZoomDrill(${lowIdx})" title="Drill into ${fullLabel(lowIdx)}" style="cursor:pointer"` : '')}
      </div>

      <div class="dz-chart-card">
        <div class="dz-chart-head">
          <div class="dz-chart-ic">${ddZIcon(kpiIcon, 18)}</div>
          <div class="dz-chart-tx">
            <div class="dz-chart-title">${k.label} Trend <span class="dz-info" title="${gran === 'day' ? 'One point per day' : 'One point per week'} across the selected date range">${ddZIcon('info', 14)}</span></div>
            <div class="dz-chart-sub">${gran === 'day' ? 'Daily' : 'Weekly'} ${k.label.toLowerCase()} for ${scope} (${labels[0]} – ${labels[n - 1]})</div>
          </div>
          <div class="dz-legend">
            <span><i style="background:${color}"></i>${k.label}</span>
            ${showThr ? `<span><i class="dash"></i>Target ${ddFmtVal(thr, k.fmt)}</span>` : ''}
          </div>
        </div>
        <div class="dz-plot-wrap">
          <div class="dz-yaxis">${grid.map(g => `<div style="top:${g.y}px">${g.label}</div>`).join('')}</div>
          <div class="dz-plot" onmouseleave="ddZoomHover(${n - 1})">
            <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
              <defs><linearGradient id="dzFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>
              ${grid.map(g => `<line x1="${L}" y1="${g.y}" x2="${W - R}" y2="${g.y}" stroke="#eef0f5" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
              ${keep.map(i => `<line x1="${X(i).toFixed(1)}" y1="${T}" x2="${X(i).toFixed(1)}" y2="${H - B}" stroke="#f3f4f8" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
              <path d="${area}" fill="url(#dzFill)"/>
              ${showThr ? `<line x1="${L}" y1="${Y(thr).toFixed(1)}" x2="${W - R}" y2="${Y(thr).toFixed(1)}" stroke="${DD_RED}" stroke-width="1.2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>` : ''}
              <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
              ${vals.map((v, i) => `<rect x="${Math.max(0, X(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H - B}" fill="transparent" style="cursor:${canDrill ? 'pointer' : 'default'}" onmouseenter="ddZoomHover(${i})" ${canDrill ? `onclick="ddZoomDrill(${i})"` : ''}/>`).join('')}
            </svg>
            ${SI_DD_STATE.zoomPts.map(p => `<span class="dz-dot${p.bad ? ' bad' : ''}" style="left:${p.x}%;top:${p.y}px;--c:${color}"></span>`).join('')}
            <span class="dz-hl" id="dz-hl" style="left:${lp.x}%;top:${lp.y}px;--c:${color}"></span>
            <div class="dz-tip" id="dz-tip" style="left:${lp.x}%;top:${lp.y}px"><b style="color:${color}">${lp.val}</b><span>${lp.label}</span></div>
            <div class="dz-xaxis">${keep.map(i => `<span style="left:${((X(i) / W) * 100).toFixed(2)}%">${labels[i]}</span>`).join('')}</div>
          </div>
        </div>
      </div>

      <div class="dz-hint-line">${ddZIcon('bulb', 15)}<span>Hover over any point to see its exact value${canDrill ? ' · click a point to drill into that ' + (gran === 'day' ? 'day' : 'week') : ''}</span></div>
    </div>
  </div>`;
}

/* move the highlighted point + tooltip to point i (hover), back to the
   latest point when the pointer leaves the chart */
function ddZoomHover(i){
  const p = (SI_DD_STATE.zoomPts || [])[i];
  const tip = document.getElementById('dz-tip'), hl = document.getElementById('dz-hl');
  if (!p || !tip || !hl) return;
  hl.style.left = tip.style.left = p.x + '%';
  hl.style.top = tip.style.top = p.y + 'px';
  tip.querySelector('b').textContent = p.val;
  tip.querySelector('span').textContent = p.label;
  tip.classList.toggle('flip', p.x > 82);
  tip.classList.toggle('flipl', p.x < 12);
}

/* clicking a point (or Peak) in the pop-up drills the main table into that
   day/week, keeping the position/employee the trend line was scoped to */
function ddZoomDrill(i){
  const z = SI_DD_STATE.zoom, buckets = SI_DD_STATE.zoomBuckets;
  if (!z || !buckets || !buckets[i]) return;
  const gran = SI_DD_STATE.zoomGran || 'day';
  const b = buckets[i];
  const path = (z.ctx || []).concat([{ dim: gran, id: b.key, label: b.drillLabel }]);
  SI_DD_STATE.path = path;
  SI_DD_STATE.dim = ddRemainingDims(path, null)[0] || 'employee';
  SI_DD_STATE.zoom = null;
  siRenderDeepDive();
}

function ddRenderModal(){
  const host = document.getElementById('dd-modal-host');
  if (host) host.innerHTML = ddZoomHtml();
}

function ddFilterRows(q){
  SI_DD_STATE.q = q;
  const query = q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('#tab-deepdive .dd-table tbody tr').forEach(tr => {
    const name = tr.getAttribute('data-rowname') || '';
    const hit = !query || name.indexOf(query) !== -1;
    tr.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const nm = document.querySelector('#tab-deepdive .dd-nomatch');
  if (nm) nm.style.display = shown ? 'none' : '';
  const box = document.querySelector('#tab-deepdive .dd-tb-search');
  if (box) box.classList.toggle('has-q', !!query);
}

function ddDrillRowByIndex(i){
  const dim = SI_DD_STATE.dim;
  const nextDim = ddDefaultDrillDim(SI_DD_STATE.path, dim);
  if (!SI_DD_CURRENT_GROUPS[i] || !nextDim) return;
  ddBreakDownRow(i, nextDim);
}

/* Detailed view icon: pin this row, then break down by the chosen level
   directly (e.g. Week of Aug 11 -> its employees, skipping Day and Position).
   If that level is already pinned upstream, its filter is lifted so the
   breakdown is meaningful — e.g. Week → Day → Employee, then "by Week"
   shows that employee across every week, and "by Day" across every day of
   the pinned week. A pinned day is lifted too when breaking down by week. */
function ddBreakDownRow(i, targetDim){
  const g = SI_DD_CURRENT_GROUPS[i];
  const dim = SI_DD_STATE.dim;
  if (!g || ddBreakdownOptions(dim).indexOf(targetDim) < 0) return;
  const { name } = ddRowLabel(g, dim);
  let path = SI_DD_STATE.path.concat([{ dim, id: g.meta.id, label: name }]);
  path = path.filter(p => p.dim !== targetDim && !(targetDim === 'week' && p.dim === 'day'));
  SI_DD_STATE.path = path;
  SI_DD_STATE.dim = targetDim;
  siRenderDeepDive();
}

function ddSetDim(dim){
  SI_DD_STATE.dim = dim;
  SI_DD_STATE.path = [];
  siRenderDeepDive();
}

function ddSetRange(presetId){
  SI_DD_CAL.open = false; SI_DD_CAL.pa = SI_DD_CAL.pb = null;
  SI_DD_STATE.rangePreset = presetId;
  SI_DD_STATE.dim = 'week';
  SI_DD_STATE.path = [];
  siRenderDeepDive();
}

function ddSetCustomRange(which, iso){
  if (!iso) return;
  const cur = ddRangeIndices(SI_DD_STATE.rangePreset);
  const maxIdx = SI_DD_WEEKS.length * 7 - 1;
  let start = cur.start, end = cur.end;
  const g = Math.min(maxIdx, Math.max(0, ddIsoToIdx(iso)));
  if (which === 'from') { start = g; if (start > end) end = start; }
  else { end = g; if (end < start) start = end; }
  SI_DD_STATE.customStart = start;
  SI_DD_STATE.customEnd = end;
  // light up the matching preset pill if the picked range equals one
  const match = DD_RANGE_PRESETS.find(p => { const r = ddRangeIndices(p.id); return r.start === start && r.end === end; });
  SI_DD_STATE.rangePreset = match ? match.id : 'custom';
  SI_DD_STATE.dim = 'week';
  SI_DD_STATE.path = [];
  siRenderDeepDive();
}

/* breadcrumb jump: return to the level that was showing when path[i + 1]
   was pinned (drills can skip dims now, so it's that entry's dim, not the
   fixed child of path[i]) */
function ddJumpPath(i){
  const nextDim = SI_DD_STATE.path[i + 1] ? SI_DD_STATE.path[i + 1].dim : ddChildDim(SI_DD_STATE.path[i].dim);
  SI_DD_STATE.path = SI_DD_STATE.path.slice(0, i + 1);
  SI_DD_STATE.dim = nextDim;
  siRenderDeepDive();
}

function ddJumpRoot(){
  SI_DD_STATE.dim = SI_DD_STATE.path[0] ? SI_DD_STATE.path[0].dim : SI_DD_STATE.dim;
  SI_DD_STATE.path = [];
  siRenderDeepDive();
}

function siRenderDeepDive(){
  const root = document.getElementById('tab-deepdive');
  if (!root) return;

  const rangeRecords = ddRecordsInRange(SI_DD_STATE.rangePreset);
  const priorRecords = ddPriorRecordsInRange(SI_DD_STATE.rangePreset);
  const agg = deepdiveAggregate(rangeRecords);
  const priorAgg = deepdiveAggregate(priorRecords);
  const tiles = ddTilesHtml(rangeRecords, priorRecords);

  const scoped = ddApplyPath(rangeRecords, SI_DD_STATE.path);
  const groups = ddGroupBy(scoped, SI_DD_STATE.dim);
  // Week/Day default to newest first (latest date on top)
  if (SI_DD_STATE.dim === 'week' || SI_DD_STATE.dim === 'day') groups.sort((a, b) => b.meta.id - a.meta.id);
  else if (SI_DD_STATE.dim === 'shift') groups.sort((a, b) => (b.meta.g - a.meta.g) || a.meta.rec.employeeName.localeCompare(b.meta.rec.employeeName));   // Shift: newest day first
  else groups.sort((a, b) => deepdiveAggregate(b.records).schHrs - deepdiveAggregate(a.records).schHrs);   // Position/Employee: most scheduled hours first
  ddApplySort(groups, SI_DD_STATE.dim);
  SI_DD_CURRENT_GROUPS = groups;
  SI_DD_SPARKS = [];
  const view = SI_DD_STATE.dim + "|" + JSON.stringify(SI_DD_STATE.path);
  if (SI_DD_STATE.lastView && SI_DD_STATE.lastView !== view) SI_DD_STATE.q = "";
  SI_DD_STATE.lastView = view;

  root.innerHTML = `
    ${ddRangeBarHtml()}
    <div class="dd-kpiwrap" id="dd-kpiwrap">
      <button class="dd-kpi-arrow prev" onclick="ddKpiScroll(-1)" title="Previous tiles" aria-label="Previous tiles"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
      <div class="dd-kpirow" id="dd-kpirow" onscroll="ddKpiArrows()">${tiles}</div>
      <button class="dd-kpi-arrow next" onclick="ddKpiScroll(1)" title="More tiles" aria-label="More tiles"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
    </div>
    <div class="card" style="padding:16px 18px 10px;">
      ${SI_DD_STATE.path.length ? ddBreadcrumbHtml() + '<div style="height:10px;"></div>' : ''}
      ${ddSectionHeaderHtml(groups.length)}
      ${groups.length ? ddTableHtml(groups, SI_DD_STATE.dim, scoped) : `<div class="dd-empty-note">No schedule records in this range.</div>`}
    </div>
    <div id="dd-modal-host"></div>
  `;
  ddKpiArrows();
  SI_DD_STATE.zoom = null;

  if (SI_DD_STATE.q) ddFilterRows(SI_DD_STATE.q);
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && SI_DD_STATE.zoom) ddCloseModal();
    else if (e.key === 'Escape' && SI_DD_STATE.menu) { SI_DD_STATE.menu = null; siRenderDeepDive(); }
  });
  // click anywhere outside an open Columns / Export menu closes it
  document.addEventListener('click', () => {
    if (SI_DD_CAL.open) { SI_DD_CAL.open = false; ddCalRender(); }
    if (SI_DD_STATE.menu) { SI_DD_STATE.menu = null; siRenderDeepDive(); }
  });
}

if (typeof window !== 'undefined') {
  window.siRenderDeepDive = siRenderDeepDive;
  window.ddSetDim = ddSetDim;
  window.ddSortBy = ddSortBy;
  window.ddCalToggle = ddCalToggle; window.ddCalNav = ddCalNav; window.ddCalPick = ddCalPick;
  window.ddCalHover = ddCalHover; window.ddCalQuick = ddCalQuick; window.ddCalApply = ddCalApply; window.ddCalDone = ddCalDone;
  window.ddOpenKpiTrend = ddOpenKpiTrend;
  window.ddToggleMenu = ddToggleMenu;
  window.ddToggleCol = ddToggleCol;
  window.ddShowAllCols = ddShowAllCols;
  window.ddClearSearch = ddClearSearch;
  window.ddExport = ddExport;
  window.ddSetRange = ddSetRange;
  window.ddSetCustomRange = ddSetCustomRange;
  window.ddJumpPath = ddJumpPath;
  window.ddJumpRoot = ddJumpRoot;
  window.ddDrillRowByIndex = ddDrillRowByIndex;
  window.ddBreakDownRow = ddBreakDownRow;
  window.ddFilterRows = ddFilterRows;
  window.ddOpenZoom = ddOpenZoom;
  window.ddCloseModal = ddCloseModal;
  window.ddSetZoomGran = ddSetZoomGran;
  window.ddZoomDrill = ddZoomDrill;
  window.ddZoomHover = ddZoomHover;
}

/* KPI tiles stay on one row; when they don't fit (narrow window / zoomed in)
   arrows at the edges scroll to the hidden tiles */
function ddKpiArrows(){
  const row = document.getElementById('dd-kpirow'), wrap = document.getElementById('dd-kpiwrap');
  if (!row || !wrap) return;
  const max = row.scrollWidth - row.clientWidth;
  wrap.classList.toggle('can-prev', row.scrollLeft > 2);
  wrap.classList.toggle('can-next', row.scrollLeft < max - 2);
}
function ddKpiScroll(dir){
  const row = document.getElementById('dd-kpirow');
  if (!row) return;
  row.scrollBy({ left: dir * Math.max(200, row.clientWidth * 0.8), behavior: 'smooth' });
  setTimeout(ddKpiArrows, 400);
}
window.addEventListener('resize', ddKpiArrows);
if (typeof window !== 'undefined') { window.ddKpiScroll = ddKpiScroll; window.ddKpiArrows = ddKpiArrows; }
