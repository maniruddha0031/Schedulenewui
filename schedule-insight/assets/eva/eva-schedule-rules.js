/* ============================================================
   Eva — Schedule context. Replaces the AI Dashboard's store-health
   fallback answers (CB_RULES in chatbot.js) with Schedule AI Insight
   facts, so free-text questions that miss the Q&A database answer in
   schedule terms. Load AFTER chatbot.js.
   ============================================================ */
(function(){
  if (typeof CB_RULES === 'undefined') return;
  CB_RULES.splice(0, CB_RULES.length,
    { kw:['over-scheduled','overscheduled','overstaff','over forecast'], reply:'This week (Sep 1–7) is <b>over-scheduled by 105.19 hrs (+19.1%)</b> vs forecast — <b>69%</b> of it on Saturday and Sunday. Thursday is the only weekday with a large gap (<b>+15.58 hrs</b>).' },
    { kw:['thursday'], reply:'<b>Thursday 09/04</b> is 15.58 hrs over forecast (89.06 vs 73.48). Most of it sits in the <b>2–5 PM lull</b>, where an extra 4th GSA shift overlaps. Removing 2 employees there saves ~<b>$164</b>.' },
    { kw:['break','meal'], reply:'<b>18 of 83</b> break-eligible shifts this week have no meal break assigned — 13 of them on the weekend. Saturday alone has 6, with <b>$147.50</b> of premium-pay exposure.' },
    { kw:['cook','friday'], reply:'<b>Friday dinner</b> (5–9 PM) needs 12.0 line-cook hours but only <b>4.0</b> are scheduled. Adding Kevin Tran and Maria Santos closes the 8-hour gap.' },
    { kw:['overtime','ot '], reply:'Scheduled OT this week is <b>27.74 hrs ($853.30)</b>, all from weekend shifts over 8 hours. Capping weekend shifts at 8 hours removes it without losing coverage.' },
    { kw:['labor','labour'], reply:'Scheduled Labor % is <b>22.0%</b> this week (target 22.2%). Scheduled labor dollars are <b>$12,210.48</b>, up 12.7% vs last week.' },
    { kw:['splh'], reply:'Scheduled <b>SPLH</b> is <b>$84.53</b> this week, down 6.1% vs last week — the weekend over-scheduling is spreading the same sales over more hours.' },
    { kw:['manager','pay rate','high rate','high-rate'], reply:'Both weekend days run a <b>General Manager plus 2 Assistant Managers</b>. Giving the second AM shift to an available Shift Leader saves <b>$68.89/week</b>.' },
    { kw:['forecast'], reply:'Forecasted hours this week are <b>551.15</b> against <b>656.34</b> scheduled. Forecasted sales are <b>$55,480.82</b>.' },
    { kw:['deep dive','breakdown'], reply:'<b>Deep Dive</b> breaks the schedule down by Week, Day, Position, Employee and Shift, with trends, comparisons and export. Use the calendar and Go to pick any range.' },
    { kw:['ai hub','root cause','insight'], reply:'The <b>Insights</b> tab lists this week\'s daily and weekly schedule insights with root cause and recommendations; switch to <b>AI Hub</b> for the KPI drilldown.' },
    { kw:['hi','hello','hey'], reply:'Hello! Ask me about over-scheduling, breaks, overtime, labor %, SPLH, cook coverage or manager pay mix for this week\'s schedule.' }
  );
})();

/* Idle "Stuck with something or want to deep dive? Ask Eva" nudge: turned
   off on every screen (the chatbot bubble itself stays). */
(function(){
  window.cbShowIdleNudge = function(){};
  const n = document.getElementById('cb-idle-nudge');
  if (n) n.remove();
  const st = document.createElement('style');
  st.textContent = '#cb-idle-nudge{display:none !important}';
  document.head.appendChild(st);
})();
