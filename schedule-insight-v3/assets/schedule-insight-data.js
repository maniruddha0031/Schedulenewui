/* ============================================================
   Schedule Insight — mock data
   Field names / labels follow the real KPI catalog found in
   AI Dashboard/HW Release/Rptkey_detail_franchise_data.csv
   (schHrs, fctStaff, splh, schLbrPerc, schDollar, schCompliance,
   variancePer, schedVsFcdHrs, overStaffedHrs, otHrs, ...).

   This file is pure data — swap it for a real API response later
   without touching any of the *-render.js files.
   ============================================================ */

/* store 007 - Encinitas, current week, matches Schedule_UI.html KPI row
   (Scheduled Hours 431.25 / Forecasted Sales $24,180.50 / Variance -12.75) */
const SI_WEEK_DAYS = [
  { day:'Mon', date:'Sep 01' },
  { day:'Tue', date:'Sep 02' },
  { day:'Wed', date:'Sep 03' },
  { day:'Thu', date:'Sep 04' },
  { day:'Fri', date:'Sep 05' },
  { day:'Sat', date:'Sep 06' },
  { day:'Sun', date:'Sep 07' },
];

const SI_ROSTER = [
  { name:'Kimberli Lopez', role:'Shift Leader', rate:19.5, color:'#1b3a63' },
  { name:'Sofia Bagley',   role:'GSA',          rate:16.5, color:'#2eb84c' },
  { name:'Graciela Atempa',role:'Asst. Manager',rate:23.0, color:'#8fb0a6' },
  { name:'Juan Lopez',     role:'Line Cook',    rate:17.0, color:'#1b3a63' },
  { name:'Austin Gray',    role:'GSA',          rate:16.5, color:'#9aa2ae' },
  { name:'Alex Garcia',    role:'Line Cook',    rate:17.0, color:'#7b3fe4' },
  { name:'Eliza Funes',    role:'Line Cook',    rate:17.0, color:'#2eb84c' },
  { name:'Cecilia Ramirez',role:'GSA',          rate:16.5, color:'#c62828' },
];

/* Tab 1 (Insights) now ports its own data shape — see insights-nui-data.js */

if (typeof window !== 'undefined') {
  window.SI_WEEK_DAYS = SI_WEEK_DAYS;
  window.SI_ROSTER = SI_ROSTER;
}
