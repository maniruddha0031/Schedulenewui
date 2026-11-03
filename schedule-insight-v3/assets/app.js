/* ============================================================
   Schedule Insight — tab-switch controller + display settings
   ============================================================ */

function siSwitchTab(tab){
  // Eva chatbot is hidden on Deep Dive
  document.body.classList.toggle('si-on-deepdive', tab === 'deepdive');
  // page title follows the tab: "Schedule Deep Dive" (no AI tag) on Deep Dive
  const title = document.querySelector('.si-title');
  if (title) title.textContent = tab === 'deepdive' ? 'Schedule Deep Dive' : 'Schedule AI Insight';
  const aiTag = document.querySelector('.si-ai-badge');
  if (aiTag) aiTag.style.display = tab === 'deepdive' ? 'none' : '';
  // KPI tile arrows can only measure once the Deep Dive panel is visible
  if (tab === 'deepdive' && typeof ddKpiArrows === 'function') setTimeout(ddKpiArrows, 0);
  document.querySelectorAll('.si-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  // "Enable New Insight design_V2" on: the Insights tab shows Schedule
  // Insights.html (#tab-insights-v3) and wins over the V1 flag.
  // "Enable New Insight Design" on: the Insights tab shows the new screen
  // (#tab-insights-v2); off: the original panel, exactly as before
  const v3 = tab === 'insights' && siIsNewDesignV2();
  const newDesign = tab === 'insights' && !v3 && siIsNewDesign();
  const panelId = v3 ? 'tab-insights-v3' : newDesign ? 'tab-insights-v2' : 'tab-' + tab;
  document.querySelectorAll('.si-panel').forEach(p => p.classList.toggle('active', p.id === panelId));
  if (v3 || newDesign) return;
  // the Insights tab's "AI Hub" mode borrows the AI Hub screen — hand it back / re-borrow
  if (tab === 'aihub' && typeof siInsReturnHub === 'function') siInsReturnHub();
  if (tab === 'insights' && typeof SI_INS_STATE !== 'undefined' && SI_INS_STATE.mode === 'hub') siInsSetMode('hub');
}

/* ---- Account Settings flag: "Enable New Insight Design" (default off).
   On  -> body.si-newdesign: the Insights tab renders the redesigned AI
          Insight screen (insights-v2.js). Deep Dive stays as it is; the
          old AI Insights + AI Hub screen is untouched and comes back when
          the flag is off. Remembered per browser (localStorage). ---- */
const SI_NEWDESIGN_KEY = 'si-new-insight-design';
function siIsNewDesign(){ return document.body.classList.contains('si-newdesign'); }
function siSetNewDesign(on){
  document.body.classList.toggle('si-newdesign', !!on);
  const sw = document.getElementById('si-newdesign-switch');
  if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  try { localStorage.setItem(SI_NEWDESIGN_KEY, on ? '1' : '0'); } catch (e) {}
  if (on && typeof siV2Render === 'function') siV2Render();
  const cur = document.querySelector('.si-tab.active');
  if (cur) siSwitchTab(cur.dataset.tab);
}

/* ---- Account Settings flag: "Enable New Insight design_V2" (default ON).
   On  -> body.si-newdesign-v2: the Insights tab shows Schedule Insights.html
          in a frame under this page's sub-header (Schedule AI Insight, Back
          to Dashboard, Insights / Deep Dive). The page follows the profile
          menu's theme, reports its height and hands its toasts to us.
   Off -> the V1 flag / original Insights tab as before. ---- */
const SI_NEWDESIGN_V2_KEY = 'si-new-insight-design-v2';
function siIsNewDesignV2(){ return document.body.classList.contains('si-newdesign-v2'); }
function siSetNewDesignV2(on){
  document.body.classList.toggle('si-newdesign-v2', !!on);
  const sw = document.getElementById('si-newdesign-v2-switch');
  if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  try { localStorage.setItem(SI_NEWDESIGN_V2_KEY, on ? '1' : '0'); } catch (e) {}
  const f = siV3Frame();
  if (on && f && !f.getAttribute('src')) f.setAttribute('src', f.dataset.src);
  const cur = document.querySelector('.si-tab.active');
  if (cur) siSwitchTab(cur.dataset.tab);
}
function siV3Frame(){ return document.getElementById('si-v3-frame'); }
function siV3Post(msg){
  const f = siV3Frame();
  if (f && f.getAttribute('src') && f.contentWindow) f.contentWindow.postMessage(msg, '*');
}
function siV3Toast(msg, undo){
  let t = document.getElementById('si-v3-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'si-v3-toast'; t.className = 'si-v3-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span></span><button type="button">Undo</button>';
    t.querySelector('button').onclick = () => { siV3Post({ type:'si-v3-undo' }); t.classList.remove('on'); };
    document.body.appendChild(t);
  }
  t.querySelector('span').textContent = msg;
  t.querySelector('button').style.display = undo ? '' : 'none';
  t.classList.add('on');
  clearTimeout(siV3Toast.timer);
  siV3Toast.timer = setTimeout(() => t.classList.remove('on'), 2600);
}
/* the Insights screen keeps its problem feed inside the visible window, so it
   needs our viewport height and where its frame starts on this page */
function siV3Viewport(force){
  const f = siV3Frame();
  if (!f || !f.offsetParent) return;
  const vp = { vh: window.innerHeight, top: Math.round(f.getBoundingClientRect().top + window.scrollY) };
  const last = siV3Viewport.last;
  if (!force && last && last.vh === vp.vh && last.top === vp.top) return;
  siV3Viewport.last = vp;
  siV3Post(Object.assign({ type:'si-v3-viewport' }, vp));
}
window.addEventListener('resize', () => siV3Viewport());
window.addEventListener('message', e => {
  const f = siV3Frame();
  if (!f || e.source !== f.contentWindow) return;
  const d = e.data || {};
  if (d.type === 'si-v3-height') { f.style.height = d.h + 'px'; siV3Viewport(); }
  else if (d.type === 'si-v3-ready') { siV3Post({ type:'si-theme', theme:siCurrentTheme() }); siV3Viewport(true); }
  else if (d.type === 'si-v3-toast') siV3Toast(d.msg, d.undo);
});

/* ---- settings gear: "New UI" layout toggle ----
   On  -> body.si-newui; the Insights detail puts Root Cause and
          Recommendation side by side (evidence table below).
   Off -> the current layout, unchanged.
   Remembered per browser (localStorage, best-effort). */
const SI_NEWUI_KEY = 'si-new-ui';

function siIsNewUi(){ return document.body.classList.contains('si-newui'); }

function siSetNewUi(on){
  document.body.classList.toggle('si-newui', !!on);
  const sw = document.getElementById('si-newui-switch');
  if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  try { localStorage.setItem(SI_NEWUI_KEY, on ? '1' : '0'); } catch (e) {}
  // re-draw the open insight so the layout switches immediately
  if (typeof siInsRenderDetail === 'function' && typeof SI_INS_STATE !== 'undefined' && SI_INS_STATE.activeId != null) {
    siInsRenderDetail(SI_INS_STATE.activeId);
  }
}

/* ---- "Disable date range" flag: hides Deep Dive's From / To pickers
   (the Last 7 days / 2 / 4 / 8 weeks presets stay). Default: off. ---- */
const SI_NODATE_KEY = 'si-no-daterange-v2';   // v2: resets the flag to its default (off) for everyone

function siSetNoDateRange(on){
  document.body.classList.toggle('si-no-daterange', !!on);
  const sw = document.getElementById('si-nodate-switch');
  if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  try { localStorage.setItem(SI_NODATE_KEY, on ? '1' : '0'); } catch (e) {}
}

/* ---- Theme (Light default / Dark) — chosen in the profile menu,
   persisted in localStorage, applied pre-paint by index.html's head
   script. One class on <html> drives assets/dark-theme.css. ---- */
const SI_THEME_KEY = 'si-theme';
function siCurrentTheme(){ return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light'; }
function siSetTheme(theme){
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('theme-dark', dark);
  try { localStorage.setItem(SI_THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
  document.querySelectorAll('.pm-seg button').forEach(b => {
    const on = b.dataset.theme === (dark ? 'dark' : 'light');
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  // Chart.js (KPI trend modal): dark-compatible labels + gridlines, redraw open charts
  if (window.Chart && Chart.defaults) {
    Chart.defaults.color = dark ? '#94A3B8' : '#666';
    Chart.defaults.borderColor = dark ? 'rgba(148,163,184,.14)' : 'rgba(0,0,0,.1)';
    if (Chart.instances) Object.values(Chart.instances).forEach(c => {
      try {
        Object.values(c.options.scales || {}).forEach(s => {
          if (s.grid) s.grid.color = Chart.defaults.borderColor;
          if (s.ticks) s.ticks.color = Chart.defaults.color;
        });
        c.update('none');
      } catch (e) {}
    });
  }
  // Schedule Insights frame (design_V2) follows the app theme
  siV3Post({ type:'si-theme', theme: dark ? 'dark' : 'light' });
  // Eva chatbot has its own dark mode — follow the app theme
  const ov = document.getElementById('chatboxOverlay');
  if (ov) {
    if (typeof setDarkMode === 'function') setDarkMode(dark);
    else ov.classList.toggle('dark-mode', dark);
  }
}
/* ---- Account Settings flag: "Enable New Tiles for Insight" (default off).
   On  -> body.si-newtiles: AI Insights list tiles also show the impact
          value and data-point tags.
   Off -> tiles show only the status tag and the KPI name.
   Remembered per browser (localStorage, best-effort). ---- */
const SI_NEWTILES_KEY = 'si-new-tiles';
function siSetNewTiles(on){
  document.body.classList.toggle('si-newtiles', !!on);
  const sw = document.getElementById('si-newtiles-switch');
  if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  try { localStorage.setItem(SI_NEWTILES_KEY, on ? '1' : '0'); } catch (e) {}
}
function siToggleProfileMenu(){
  const w = document.getElementById('pmWrap');
  if (w) w.classList.toggle('open');
}
document.addEventListener('click', () => { const w = document.getElementById('pmWrap'); if (w) w.classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const w = document.getElementById('pmWrap'); if (w) w.classList.remove('open'); } });

function siToggleSettings(){
  const el = document.getElementById('si-settings');
  if (el) el.classList.toggle('open');
}

document.addEventListener('click', () => {
  const el = document.getElementById('si-settings');
  if (el) el.classList.remove('open');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const el = document.getElementById('si-settings'); if (el) el.classList.remove('open'); }
});

document.addEventListener('DOMContentLoaded', function(){
  // New UI: ON by default (only off if the user switched it off before)
  let on = true;
  // settings gear removed: New UI is always on (saved choices ignored)
  document.body.classList.toggle('si-newui', on);
  const sw = document.getElementById('si-newui-switch');
  if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');

  // Disable date range: OFF by default
  let noDate = false;
  // settings gear removed: date range always shown
  document.body.classList.toggle('si-no-daterange', noDate);
  const sw2 = document.getElementById('si-nodate-switch');
  if (sw2) sw2.setAttribute('aria-checked', noDate ? 'true' : 'false');

  // New Insight tiles: OFF by default
  let newTiles = false;
  try { newTiles = localStorage.getItem(SI_NEWTILES_KEY) === '1'; } catch (e) {}
  siSetNewTiles(newTiles);

  siRenderInsights();
  siRenderDeepDive();
  buildAiHub(); // ported verbatim from AI Dashboard/assets/ai-hub-render.js

  // New Insight Design: OFF by default
  let newDesign = false;
  try { newDesign = localStorage.getItem(SI_NEWDESIGN_KEY) === '1'; } catch (e) {}
  if (newDesign) siSetNewDesign(true);
  else { const sw3 = document.getElementById('si-newdesign-switch'); if (sw3) sw3.setAttribute('aria-checked', 'false'); }

  // New Insight design_V2: ON by default (only off if switched off before)
  let newDesignV2 = true;
  try { newDesignV2 = localStorage.getItem(SI_NEWDESIGN_V2_KEY) !== '0'; } catch (e) {}
  siSetNewDesignV2(newDesignV2);
  // sync theme-dependent pieces (switch state, Chart.js, Eva) once everything exists
  setTimeout(() => siSetTheme(siCurrentTheme()), 0);
});

/* re-measure when the Insights tab comes back into view */
if (typeof siSwitchTab === 'function') {
  const siSwitchTabBase = siSwitchTab;
  siSwitchTab = function (t) { siSwitchTabBase(t); setTimeout(() => siV3Viewport(true), 0); };
}
