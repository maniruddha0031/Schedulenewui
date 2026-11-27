/* =====================================================================
   Manage Account → App Settings (hash routes)
     #               app tiles (only Zip Schedules opens)
     #zip            Zip Schedules: Global + Site settings
     #positions      Scheduling Positions (add / edit / delete, colour palette)
     #schedule-settings
     #certs          Certifications
     #cloud          Cloud Connection
     #matrix, #matrix/<id|new>
     #labor,  #labor/<id|new>/<rule|minor|sites|audit>
     #site-days, #site-labor, #site-pref   (Site Settings, needs a site)
   Data is kept in localStorage 'zipAppSettings'.
   ===================================================================== */
(function () {
  'use strict';
  const KEY = 'zipAppSettings';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => { try { lucide.createIcons(); } catch (e) {} };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const PALETTE = ['#607d8b', '#ff0000', '#4a9fd8', '#b59b72', '#e8a066', '#4ccf7a', '#f0573e', '#3fb5b0', '#a3165a', '#d39a3e', '#45719b', '#8ea9dd',
    '#8a4b4b', '#138a80', '#8ba838', '#d96aa8', '#6f4f9a', '#cc4b5c', '#7a2a14', '#9c8c2a', '#e05a1a'];

  /* ---------- seed ---------- */
  const SITES = ['012 - Irvine', '181 - Bakersfield - Rosedale Hwy & Main Plaza', '242 - El Segundo - LAX', '056 - El Cajon - Rancho San Diego', '034 - Mission Viejo',
    '004 - Point Loma', '076 - La Verne', '124 - Coronado', '127 - Redlands', '134 - Mira Mesa', '110 - Norco', '149 - La Quinta', '183 - San Marcos - Nordahl',
    '059 - Chula Vista - Rancho Del Rey', '237 - Murrieta', '085 - Del Mar', '171 - Palmdale', '215 - Lancaster', '279 - Menifee', '275 - San Diego - Aero Drive',
    '086 - Santa Ana', '087 - Riverside', '101 - Tempe', '102 - Scottsdale', '103 - Phoenix - Camelback', '104 - Mesa', '105 - Chandler', '120 - Carlsbad',
    '121 - Encinitas', '122 - Oceanside', '130 - Temecula', '131 - Escondido', '140 - Pasadena', '141 - Glendale', '142 - Burbank', '150 - Long Beach', '151 - Torrance',
    '160 - Fullerton', '161 - Anaheim', '162 - Orange', '170 - Ontario', '172 - Rancho Cucamonga', '180 - Fresno', '190 - Sacramento', '200 - RSC Office'];
  function seed() {
    const T = new Date();
    const d = (days, h, m) => { const x = new Date(T); x.setDate(x.getDate() - days); x.setHours(h, m); return x.toISOString(); };
    const rule = (on) => ({ dailyOT: on, dailyDT: on, otDays: Array(7).fill(on ? '08:00' : ''), dtDays: Array(7).fill(on ? '12:00' : ''),
      weeklyOT: on, weeklyOTh: on ? '40:00' : '', weeklyDT: false, weeklyDTh: '', meal: on, mealMin: on ? '04:59' : '', mealLen: on, mealLenH: on ? '00:30' : '',
      wage: on, wageV: on ? '20.00' : '', rest: on, restH: on ? '01:00' : '', d7: on, waiver: on, waiverH: on ? '01:01' : '', consent: false, exMgr: false, exShift: false, term: false });
    return {
      v: 1,
      positions: [['Assistant Manager', '#a3165a'], ['General Manager', '#6f4f9a'], ['GSA', '#4a9fd8'], ['Line 1-2 Cook', '#4ccf7a'], ['Line 3-4 Cook', '#8ba838'],
        ['Manager in Charge', '#e8a066'], ['Manager In Training - Assistant Manager', '#ff0000'], ['Manager In Training - General Manager', '#f0573e'],
        ['No Position', '#0a0aa8'], ['Shift Leader', '#cc4b5c'], ['Shift Leader D/L', '#cc4b5c']].map(([n, c], i) => ({ id: 'p' + i, name: n, color: c, exclude: false, pos: '' })),
      certs: ['Alcohol', 'ServSafe', 'Work Permit'].map((n, i) => ({ id: 'c' + i, name: n })),
      settings: { swap: false, minMin: '16', minMax: '18', dept: false, fixed: false, month: true, interval: '15', budget: true, autoOffer: false,
        mgrPay: true, offer: true, siteView: true, incPay: true, restrictTO: false },
      cloud: null,
      matrices: [{ id: 'm0', name: 'Default Forecast Matrix', drivers: 'Sales', staff: ['1'], exclude: {} }],
      zones: [
        { id: 'z0', name: 'Arizona', by: 'Kim Shockley', sites: ['101 - Tempe', '102 - Scottsdale'].slice(0, 0), rule: rule(false), minor: {}, audit: [] },
        { id: 'z1', name: 'California', by: "Rubio's Coastal grill", sites: SITES.filter(s => !/^(10[1-5]) /.test(s)).slice(0, 44), rule: rule(true), minor: {},
          audit: [{ at: d(35, 14, 24), by: 'Brad Beardsley', a: 'Labor Law Updated.', p: '', c: '' }, { at: d(131, 9, 49), by: 'Brad Beardsley', a: 'Updated', p: '', c: '' },
            { at: d(264, 15, 49), by: 'Desiree Castillo', a: 'RSC - Corporate removed from Labour Law Group.', p: '', c: '' },
            { at: d(276, 13, 45), by: 'Brad Beardsley', a: 'Enable Minimum Time Off Between Shifts', p: 'FALSE', c: 'TRUE | 01:00' },
            { at: d(286, 18, 34), by: 'F Beardsley', a: 'Labor Law Updated.', p: '', c: '' }] },
        { id: 'z2', name: 'California - RSC', by: 'Desiree Castillo', sites: [], rule: rule(true), minor: {}, audit: [] },
        { id: 'z3', name: 'RSC - Corporate', by: "Rubio's Coastal grill", sites: [], rule: rule(false), minor: {}, audit: [] },
      ],
      siteDays: {},
    };
  }
  let DB;
  try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
  if (!DB || DB.v !== 1) DB = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} };
  let SITE = sessionStorage.getItem('asSite') || '';

  /* ---------- helpers ---------- */
  function toast(m, err) { const t = $('asToast'); t.textContent = m; t.className = 'as-toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => { t.className = 'as-toast'; }, 2600); }
  const tg = (on, attr, dis) => `<button type="button" class="as-tg ${on ? 'on' : ''}" ${attr} ${dis ? 'disabled' : ''} aria-pressed="${!!on}"></button>`;
  const card = (title, icon, right, body, desc) => `<div class="as-card"><div class="as-hd">${icon ? `<span class="ic"><i data-lucide="${icon}"></i></span>` : ''}<h2>${title}</h2><div class="r">${right || ''}</div></div>${desc ? `<div class="as-desc">${desc}</div>` : ''}<div class="as-body">${body}</div></div>`;
  const sortIc = '<i data-lucide="chevrons-up-down"></i>';
  function crumbs(list) {
    $('asCrumb').innerHTML = `<a href="settings.html" class="font-medium text-slate-500 hover:text-slate-700">Manage Account</a>` +
      list.map((c, i) => `<i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>${i === list.length - 1 ? `<span class="font-medium text-[#3b82f6]">${esc(c[0])}</span>` : `<a href="#${c[1]}" class="font-medium text-slate-500 hover:text-slate-700">${esc(c[0])}</a>`}`).join('');
  }
  const ZC = [['App Settings', ''], ['Zip Schedules', 'zip']];

  /* ---------- modal ---------- */
  let mOk = null;
  function modal(title, body, okLabel, onOk) {
    $('asMw').innerHTML = `<div class="as-m" role="dialog" aria-modal="true" aria-labelledby="asMt"><div class="mh"><h3 id="asMt">${title}</h3><button type="button" class="mx" data-m="x" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="mb">${body}</div><div class="mf"><button type="button" class="as-btn pri" data-m="ok"><i data-lucide="${okLabel === 'Update' ? 'check' : 'plus'}"></i>${okLabel}</button></div></div>`;
    mOk = onOk; $('asMw').classList.add('open'); icons();
    const f = $('asMw').querySelector('input'); if (f) f.focus();
  }
  const closeM = () => $('asMw').classList.remove('open');
  function confirmDel(what, onOk) {
    $('asMw').innerHTML = `<div class="as-m" role="alertdialog" aria-modal="true"><div class="mh"><h3>Delete ${esc(what)}?</h3><button type="button" class="mx" data-m="x" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="mb" style="display:block;font-size:13px;color:#475569">This can't be undone.</div><div class="mf"><button type="button" class="as-btn" data-m="x">Cancel</button><button type="button" class="as-btn no" data-m="ok"><i data-lucide="trash-2"></i>Delete</button></div></div>`;
    mOk = onOk; $('asMw').classList.add('open'); icons();
  }

  /* ================= views ================= */
  const APPS = [['BI Reporting', 'presentation', '#047857', '#d1fae5'], ['Zip Clock', 'clock', '#0ea5e9', '#e0f2fe'], ['Zip Forecasting', 'trending-up', '#10b981', '#d1fae5'],
    ['Zip HACCP', 'check-check', '#ea580c', '#ffedd5'], ['Zip Inventory', 'clipboard-list', '#6366f1', '#e0e7ff'], ['Zip Ordering', 'shopping-cart', '#a21caf', '#fae8ff'],
    ['Zip Prep & Pull', 'chef-hat', '#7c3aed', '#ede9fe'], ['Zip Schedules', 'calendar-clock', '#2563eb', '#dbeafe'], ['Workflow', 'list-checks', '#1e3a8a', '#e0e7ff']];
  function vApps() {
    crumbs([['App Settings', '']]);
    return `<div class="as-card"><div class="as-hd"><span class="ic"><i data-lucide="shapes"></i></span><h2>App Settings</h2></div>
      <div class="as-apps">${APPS.map(([n, ic, c, bg]) => n === 'Zip Schedules'
        ? `<a class="as-app on" href="#zip"><span class="ai" style="background:${bg};color:${c}"><i data-lucide="${ic}"></i></span>${n}</a>`
        : `<div class="as-app off" title="Not available in this prototype"><span class="ai" style="background:${bg};color:${c}"><i data-lucide="${ic}"></i></span>${n}</div>`).join('')}</div></div>`;
  }

  const opt = (href, ic, color, t, d, dis) => `<a class="as-opt ${dis ? 'dis' : ''}" href="#${href}"><span class="oi"><i data-lucide="${ic}" style="color:${color}"></i></span><span class="tx"><b>${t}</b><span class="d" title="${esc(d)}">${d}</span></span></a>`;
  function vZip() {
    crumbs(ZC.slice(0, 1).concat([['Zip Schedules', 'zip']]));
    return `<div class="as-card"><div class="as-hd"><span class="ic"><i data-lucide="calendar-cog"></i></span><h2>Global Settings</h2></div>
      <div class="as-desc">You can configure your organization's Global Settings from here only.</div>
      <div class="as-body"><div class="as-grid">
        ${opt('positions', 'users-round', '#3b82f6', 'Scheduling Positions', 'Add/Update Scheduling Positions for your organization to be used by all sites.')}
        ${opt('schedule-settings', 'calendar-cog', '#6366f1', 'Schedule Settings', 'Adjust settings with the multiple features of Zip Schedules.')}
        ${opt('certs', 'award', '#f59e0b', 'Certifications', 'Add/Update certifications of the employees in your organization.')}
        ${opt('cloud', 'cloud', '#0ea5e9', 'Cloud Connection', 'Manage your cloud connections to store your data related to this application.')}
        ${opt('matrix', 'workflow', '#10b981', 'Matrix Settings', 'Setup your forecast matrix here as you want to see it on the schedule pad.')}
        ${opt('labor', 'scale', '#8b5cf6', 'Labor Rules', 'Setup Labor Rules for the company that comply with local laws.')}
      </div></div></div>
      <div class="as-card"><div class="as-hd"><span class="ic"><i data-lucide="store"></i></span><h2>Site Settings</h2></div>
      <div class="as-body"><select class="as-sel" id="asSite" style="width:300px;margin-bottom:14px"><option value="">Select Site</option>${SITES.map(s => `<option ${s === SITE ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <div class="as-grid">
          ${opt('site-days', 'calendar-check', '#3b82f6', 'Operational Days', 'Set up the weekly operational days for this store.', !SITE)}
          ${opt('site-labor', 'scale', '#8b5cf6', 'Labor Rules', 'Setup the Labor rules for this store that comply with the local laws.', !SITE)}
          ${opt('site-pref', 'calendar-plus', '#4f46e5', 'Schedule Preference', 'Choose how new weeks are auto-created on the schedule pad for this store.')}
        </div>${SITE ? '' : '<div class="as-note" style="margin-top:8px">Select a site to open its settings.</div>'}</div></div>`;
  }

  /* --- positions --- */
  let posSort = 1, posQ = '';
  function vPositions() {
    crumbs(ZC.concat([['Scheduling Positions', 'positions']]));
    const list = DB.positions.filter(p => p.name.toLowerCase().includes(posQ.toLowerCase())).sort((a, b) => posSort * a.name.localeCompare(b.name));
    return card('Scheduling Positions', 'users-round', `<label class="as-search"><i data-lucide="search"></i><input id="asQ" placeholder="Search positions" value="${esc(posQ)}"></label><button type="button" class="as-btn pri" data-act="pos-add"><i data-lucide="plus"></i>Add</button>`,
      `<table class="as-tbl"><thead><tr><th class="c sort" data-act="pos-sort">Position Name${sortIc}</th><th class="c" style="width:16%">Color</th><th class="c" style="width:12%">Exclude from Variable Coverage</th><th class="c" style="width:11%">Action(s)</th></tr></thead><tbody>
        ${list.map(p => `<tr><td>${esc(p.name)}</td><td class="c"><span class="as-sw" style="background:${p.color}"></span></td><td class="c">${p.exclude ? 'Yes' : 'No'}</td>
          <td class="c"><button type="button" class="as-ib" data-act="pos-edit|${p.id}" title="Edit"><i data-lucide="square-pen"></i></button><button type="button" class="as-ib del" data-act="pos-del|${p.id}" title="Delete"><i data-lucide="trash-2"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="as-empty">No positions found.</td></tr>'}
      </tbody></table>`, 'Add/Update Scheduling Positions for your organization to be used by all sites. Also, assign departments to the position. The color assigned to the position will reflect on the schedule pad. Examples: cashier(green), cook(brown) or server(blue).');
  }
  function posForm(p) {
    const color = p ? p.color : PALETTE[12];
    modal(p ? 'Edit Position' : 'Add Position', `
      <label class="as-lbl" for="pName">Position Name <em>*</em></label><input class="as-in" id="pName" placeholder="Position Name" value="${esc(p ? p.name : '')}"><div class="er" id="pErr"></div>
      <span class="as-lbl">Position Color</span><div class="as-cp"><button type="button" id="pColorBtn" style="background:${color}" data-color="${color}" aria-label="Choose colour"></button>
        <div class="as-pal" id="pPal">${PALETTE.map(c => `<button type="button" data-pc="${c}" class="${c === color ? 'sel' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
      <span class="as-lbl">Exclude From Variable Coverage</span><div>${tg(p && p.exclude, 'id="pEx"')}</div>
      <label class="as-lbl" for="pPos">POS Job Code ID</label><input class="as-in" id="pPos" value="${esc(p ? p.pos : '')}">`, p ? 'Update' : 'Add', () => {
      const name = $('pName').value.trim();
      if (!name) { $('pErr').textContent = 'Position name is required.'; $('pName').classList.add('err'); return false; }
      if (DB.positions.some(x => x.name.toLowerCase() === name.toLowerCase() && (!p || x.id !== p.id))) { $('pErr').textContent = 'This position already exists.'; return false; }
      const v = { name, color: $('pColorBtn').dataset.color, exclude: $('pEx').classList.contains('on'), pos: $('pPos').value.trim() };
      if (p) Object.assign(p, v); else DB.positions.push({ id: 'p' + Date.now(), ...v });
      save(); toast(p ? 'Position updated' : 'Position added'); route();
    });
  }

  /* --- certifications --- */
  let certSort = 1;
  function vCerts() {
    crumbs(ZC.concat([['Certifications', 'certs']]));
    const list = DB.certs.slice().sort((a, b) => certSort * a.name.localeCompare(b.name));
    return card('Certifications', 'award', `<button type="button" class="as-btn pri" data-act="cert-add"><i data-lucide="plus"></i>Add</button>`,
      `<table class="as-tbl"><thead><tr><th class="c sort" data-act="cert-sort">Certification Name${sortIc}</th><th class="c" style="width:11%">Action(s)</th></tr></thead><tbody>
        ${list.map(c => `<tr><td>${esc(c.name)}</td><td class="c"><button type="button" class="as-ib" data-act="cert-edit|${c.id}" title="Edit"><i data-lucide="square-pen"></i></button><button type="button" class="as-ib del" data-act="cert-del|${c.id}" title="Delete"><i data-lucide="trash-2"></i></button></td></tr>`).join('') || '<tr><td colspan="2" class="as-empty">No certifications yet.</td></tr>'}
      </tbody></table>`, 'Add/Update certifications of employees in your organization to be used by all sites. Examples: Bartender Certification, Food Handler Certification.');
  }
  function certForm(c) {
    modal(c ? 'Edit Certification' : 'Add Certification', `<label class="as-lbl" for="cName">Certification Name <em>*</em></label><input class="as-in" id="cName" placeholder="Certification Name" value="${esc(c ? c.name : '')}"><div class="er" id="cErr"></div>`, c ? 'Update' : 'Add', () => {
      const name = $('cName').value.trim();
      if (!name) { $('cErr').textContent = 'Certification name is required.'; $('cName').classList.add('err'); return false; }
      if (DB.certs.some(x => x.name.toLowerCase() === name.toLowerCase() && (!c || x.id !== c.id))) { $('cErr').textContent = 'This certification already exists.'; return false; }
      if (c) c.name = name; else DB.certs.push({ id: 'c' + Date.now(), name });
      save(); toast(c ? 'Certification updated' : 'Certification added'); route();
    });
  }

  /* --- schedule settings --- */
  let draftS = null;
  function vSchedSettings() {
    crumbs(ZC.concat([['Schedule Settings', 'schedule-settings']]));
    draftS = draftS || JSON.parse(JSON.stringify(DB.settings));
    const s = draftS;
    const row = (k, t, d, extra) => `<div class="as-row"><div class="t"><b>${t}</b><div class="as-note">${d}</div></div>${extra || tg(s[k], `data-st="${k}"`)}</div>`;
    return card('Schedule Settings', '', `<button type="button" class="as-btn ok" data-act="st-save"><i data-lucide="save"></i>Save</button>`, `
      <div class="as-sec">Employee Requests</div>
      <div class="as-rows">${row('swap', 'Enable Swap Shift', "By enabling this flag to Yes, Swap Shift requests will be automatically approved without manager's approval.")}</div>
      <div class="as-sec">Minor Setting</div>
      <div style="display:grid;grid-template-columns:180px 220px;gap:12px 16px;align-items:center">
        <label class="as-lbl" for="stMin">Minimum Age To Categorise Minor</label><input class="as-in" id="stMin" type="number" min="10" max="21" value="${esc(s.minMin)}" data-sv="minMin">
        <label class="as-lbl" for="stMax">Maximum Age To Categorise Minor</label><input class="as-in" id="stMax" type="number" min="10" max="21" value="${esc(s.minMax)}" data-sv="minMax"></div>
      <div class="as-sec">Miscellaneous</div>
      <div class="as-rows">
        ${row('dept', 'Enable Department', 'By enabling this flag, you can add multiple departments for your organization.')}
        ${row('mgrPay', 'Include manager pay rate in labor dollar', "By enabling this flag, manager's payrate will be included in labor dollars. This works in conjunction with Zip Schedules and Zip Clock.")}
        ${row('fixed', 'Enable Fixed Labor Hours', 'By enabling this flag, you can set number of hours you want to allocate to your Fixed Labor for Ideal Coverage.')}
        ${row('offer', 'Allow employees to offer shifts', 'By enabling this flag, employees in your organization are able to offer shifts to their co-workers.')}
        ${row('month', 'Enable Month View', 'By enabling this flag, you can view monthly schedule.')}
        ${row('siteView', 'Allow Crew To View Site Schedule', 'By enabling this flag, Crew members are able to view the Site Schedule.')}
        ${row('interval', 'Hourly Availability Interval', 'Select the availability time frame interval as you want it shown on the availability section by 15 min, 30 min or 60 min.',
          `<select class="as-sel" data-sv="interval" style="width:180px">${['15', '30', '60'].map(v => `<option value="${v}" ${s.interval === v ? 'selected' : ''}>${v} Minutes</option>`).join('')}</select>`)}
        ${row('incPay', 'Enable Incremental Pay in Positions', 'By enabling this flag, you are able to add an Incremental Pay rate to assigned Scheduling Positions of employees.')}
        ${row('budget', 'Enable Labor Budget.', 'By enabling this flag, you are able to view budget details on the schedule pad and also configure Labor Budget amount for each site from Site Settings.')}
        ${row('restrictTO', 'Restrict Time Off Requests For Scheduled Published Days', "By enabling this flag, employees won't be able to request a time-off on their own, if the time-off request lies between the scheduled hours.")}
        ${row('autoOffer', 'Enable Auto Offer Feature for Unassigned Shifts', 'By enabling this flag, System will auto offer the unassigned shifts when user published the weekly schedule.')}
      </div>`, 'Adjust your settings with the multiple features of Zip Schedules to customize your day to day scheduling per your business requirements.');
  }

  /* --- site: schedule preference --- */
  // Auto-create shifts from preferences, per site. Shared with the Schedule Pad's Create Schedule
  // menu (read-only there) through localStorage 'zipSchedPref' = { [site]: { on, method, tpl } }.
  // Only one method at a time.
  const SP_KEY = 'zipSchedPref';
  const AC_METHODS = [
    ['copy', 'copy', 'Copy Schedule', "Duplicate the previous week's schedule"],
    ['template', 'file-text', 'Load Template', 'Apply a saved staffing template'],
    ['aiStd', 'calendar-clock', 'AI Scheduling Using Standard Shift', 'Build an AI roster from your standard shifts'],
    ['ai', 'sparkles', 'AI Scheduling', 'Build shifts from the forecast and assign them'],
  ];
  const AC_TEMPLATES = ['Balanced Week', 'Peak Sales Template', 'Weekend Heavy', 'Minimal Labor'];
  function spAll() { try { return JSON.parse(localStorage.getItem(SP_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function spLoad(site) {
    const a = { on: true, method: 'copy', tpl: 0 };
    Object.assign(a, spAll()[site] || {});
    if (!AC_METHODS.some(m => m[0] === a.method)) a.method = 'copy';
    return { on: !!a.on, method: a.method, tpl: String(a.tpl || 0), _site: site };
  }
  let pDraft = null;
  function vSitePref() {
    if (!SITE) { location.hash = 'zip'; return ''; }
    crumbs(ZC.concat([[SITE, 'zip'], ['Schedule Preference', 'site-pref']]));
    if (!pDraft || pDraft._site !== SITE) pDraft = spLoad(SITE);
    const p = pDraft;
    const opts = AC_METHODS.map(([v, ic, name, desc]) => `
        <label class="as-ac-opt ${p.method === v ? 'sel' : ''} ${p.on ? '' : 'dis'}">
          <input type="radio" name="spMethod" value="${v}" ${p.method === v ? 'checked' : ''} ${p.on ? '' : 'disabled'}>
          <span class="ic"><i data-lucide="${ic}"></i></span><span class="tx"><b>${name}</b><small>${desc}</small></span></label>`).join('');
    const tpl = p.on && p.method === 'template' ? `
        <div class="as-ac-tpl"><label class="as-lbl" for="spTpl">Template</label>
          <select class="as-sel" id="spTpl" style="width:240px">${AC_TEMPLATES.map((n, i) => `<option value="${i}" ${p.tpl === String(i) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : '';
    return card('Schedule Preference', 'calendar-plus', `<button type="button" class="as-btn ok" data-act="sp-save"><i data-lucide="save"></i>Save</button>`, `
      <div class="as-rows"><div class="as-row"><div class="t"><b>Auto-create shifts from preferences</b>
        <div class="as-note">By enabling this flag, new weeks on the Schedule Pad for this site are created automatically using the option selected below.</div></div>
        ${tg(p.on, 'data-sp="on"')}</div></div>
      <div class="as-ac ${p.on ? '' : 'off'}">
        <div class="as-ac-lbl">Auto-create using <span>Select one</span></div>
        <div class="as-ac-opts" role="radiogroup" aria-label="Auto-create using">${opts}</div>${tpl}
      </div>`);
  }

  /* --- cloud --- */
  function vCloud() {
    crumbs(ZC.concat([['Cloud Connection', 'cloud']]));
    const box = (k, name, logo) => { const on = DB.cloud === k; return `<div class="as-cc ${on ? 'conn' : ''}"><div class="lg">${logo}</div><b>${name}</b>
      ${on ? `<button type="button" class="as-btn" data-act="cloud|">Disconnect</button><div class="as-note" style="color:#16a34a;font-style:normal;margin-top:8px;font-weight:600">Connected</div>` : `<button type="button" class="as-btn pri" data-act="cloud|${k}" style="min-width:110px;justify-content:center">Connect</button>`}</div>`; };
    const drop = '<svg width="92" height="84" viewBox="0 0 92 84" aria-hidden="true"><g fill="#0d7ff0"><path d="M23 0 0 15l23 15 23-15zM69 0 46 15l23 15 23-15zM0 45l23 15 23-15-23-15zM69 30 46 45l23 15 23-15z"/><path d="M23 64l23 15 23-15-23-15z"/></g></svg>';
    const s3 = '<svg width="80" height="88" viewBox="0 0 80 88" aria-hidden="true"><g fill="#f7b500"><path d="M2 8 20 0l18 8v20L20 36 2 28zM42 8 60 0l18 8v20l-18 8-18-8zM22 48l18-8 18 8v20l-18 8-18-8z"/></g><g fill="#d18a00"><path d="M20 16v20l18-8V8zM60 16v20l18-8V8zM40 56v20l18-8V48z"/></g></svg>';
    return card('Setup your Cloud Connection', '', '', `<div class="as-cloud">${box('dropbox', 'Dropbox', drop)}${box('s3', 'Amazon S3', s3)}</div>
      <div class="as-note">Note: After you switch cloud connections, you will no longer be able to access file uploaded from the current cloud storage.</div>`,
      "Manage your cloud connections to store your organization's data related to this application.");
  }

  /* --- matrix --- */
  let mDraft = null;
  function vMatrix(id) {
    if (id) return vMatrixEdit(id);
    crumbs(ZC.concat([['Matrix Settings', 'matrix']]));
    return card('Matrix Settings', '', `<button type="button" class="as-btn pri" data-act="go|matrix/new"><i data-lucide="plus"></i>ADD</button>`,
      `<table class="as-tbl"><thead><tr><th class="c">Matrix Name${sortIc}</th><th class="c">Drivers${sortIc}</th><th class="c" style="width:11%">Action(s)</th></tr></thead><tbody>
        ${DB.matrices.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.drivers)}</td><td class="c"><button type="button" class="as-ib" data-act="go|matrix/${m.id}" title="Edit"><i data-lucide="square-pen"></i></button><button type="button" class="as-ib del" data-act="mx-del|${m.id}" title="Delete"><i data-lucide="trash-2"></i></button></td></tr>`).join('') || '<tr><td colspan="3" class="as-empty">No matrix yet.</td></tr>'}
      </tbody></table>`, 'Setup your forecast matrix here as you want to see it on the schedule pad.');
  }
  function vMatrixEdit(id) {
    crumbs(ZC.concat([['Matrix Settings', 'matrix'], [id === 'new' ? 'Add Matrix' : 'Edit Matrix', 'matrix/' + id]]));
    if (!mDraft || mDraft._id !== id) { const m = DB.matrices.find(x => x.id === id); mDraft = m ? JSON.parse(JSON.stringify(m)) : { id: 'm' + Date.now(), name: '', drivers: 'Sales', staff: ['1'], exclude: {} }; mDraft._id = id; }
    const m = mDraft;
    return card('Matrix Settings', '', `<button type="button" class="as-btn ok" data-act="mx-save"><i data-lucide="save"></i>Save</button><button type="button" class="as-btn no" data-act="go|matrix"><i data-lucide="x-circle"></i>Close</button>`, `
      <div style="display:grid;grid-template-columns:200px 440px;gap:12px;align-items:center;margin-bottom:6px"><label class="as-lbl" for="mxName">Matrix Settings <em>*</em></label><input class="as-in" id="mxName" placeholder="Matrix Settings" value="${esc(m.name)}" data-mx="name"></div>
      <div class="as-sec">Matrix Setup</div>
      <table class="as-tbl"><thead><tr><th class="c" style="width:50%"># of Staff</th><th class="c">Actions</th></tr></thead><tbody>
        ${m.staff.map((v, i) => `<tr><td><input class="as-in" style="width:100%" type="number" min="1" value="${esc(v)}" data-mxs="${i}" aria-label="Number of staff, row ${i + 1}"></td><td class="c">${m.staff.length > 1 ? `<button type="button" class="as-ib del" data-act="mx-rm|${i}" title="Delete row"><i data-lucide="trash-2"></i></button>` : ''}</td></tr>`).join('')}
        <tr><td colspan="2" style="text-align:right;background:#f8fafc"><button type="button" class="as-btn pri sm" data-act="mx-row"><i data-lucide="plus"></i>Add New Row</button></td></tr></tbody></table>
      <div class="as-sec">Positions</div>
      <div class="as-pos"><div style="text-align:center;font-size:17px;color:#1e293b">Position(s)</div><div style="text-align:center"><div style="font-size:17px;color:#1e293b">Exclude From Variable Coverage</div><div class="as-note" style="font-style:normal">By Enabling this flag position(s) corresponding to this flag will not be included in forecasted staff.</div></div>
        ${DB.positions.filter(p => p.name !== 'No Position').map(p => `<div class="bar" style="background:${p.color}">${esc(p.name)}</div><div style="text-align:center"><button type="button" class="as-yn ${m.exclude[p.id] ? 'on' : ''}" data-act="mx-ex|${p.id}">${m.exclude[p.id] ? 'YES' : 'NO'}</button></div>`).join('')}</div>`);
  }

  /* --- labor rules --- */
  let lDraft = null;
  function vLabor(id, tab) {
    if (id) return vLaborEdit(id, tab || 'rule');
    crumbs(ZC.concat([['Labor Rules', 'labor']]));
    return card('Labor Rules', '', `<button type="button" class="as-btn pri" data-act="go|labor/new/rule"><i data-lucide="plus"></i>Add</button>`,
      `<table class="as-tbl"><thead><tr><th class="c">Zone(s)${sortIc}</th><th class="c">#Site Assign(s)${sortIc}</th><th class="c">Last Updated By${sortIc}</th><th class="c" style="width:11%">Action(s)</th></tr></thead><tbody>
        ${DB.zones.map(z => `<tr><td>${esc(z.name)}</td><td class="c">${z.sites.length}</td><td>${esc(z.by)}</td><td class="c"><button type="button" class="as-ib" data-act="go|labor/${z.id}/rule" title="Edit"><i data-lucide="square-pen"></i></button><button type="button" class="as-ib del" data-act="lz-del|${z.id}" title="Delete"><i data-lucide="trash-2"></i></button></td></tr>`).join('')}
      </tbody></table>`);
  }
  function vLaborEdit(id, tab) {
    crumbs(ZC.concat([['Labor Rules', 'labor'], [id === 'new' ? 'Add Zone' : (DB.zones.find(z => z.id === id) || {}).name || 'Zone', `labor/${id}/rule`]]));
    if (!lDraft || lDraft._id !== id) {
      const z = DB.zones.find(x => x.id === id);
      lDraft = z ? JSON.parse(JSON.stringify(z)) : { id: 'z' + Date.now(), name: '', by: 'Store Manager', sites: [], rule: seed().zones[0].rule, minor: {}, audit: [] };
      lDraft._id = id; lDraft._page = 0;
    }
    const z = lDraft, r = z.rule;
    const T = (k, d) => tg(r[k], `data-lr="${k}"`, d);
    const In = (k, on, ph, req) => `<input class="as-in" data-lv="${k}" value="${esc(r[k])}" placeholder="${ph || 'hh:mm'}" ${on ? '' : 'disabled'} aria-label="${k}">`;
    const tabs = [['rule', 'user-round-cog', 'Labor Rule'], ['minor', 'baby', 'Minor Rule'], ['sites', 'map-pinned', 'Assign Sites'], ['audit', 'history', 'Audit']];
    const head = `<div class="as-hd"><div class="as-tabs">${tabs.map(([k, ic, l]) => `<button type="button" class="as-tab ${tab === k ? 'on' : ''}" data-act="go|labor/${id}/${k}"><i data-lucide="${ic}"></i>${l}</button>`).join('')}</div>
      <div class="r"><button type="button" class="as-btn gry" data-act="go|labor"><i data-lucide="arrow-left"></i>Back</button>${tab !== 'audit' ? '<button type="button" class="as-btn ok" data-act="lz-save"><i data-lucide="save"></i>Save</button>' : ''}</div></div>`;
    let body = '';
    if (tab === 'rule') {
      const req = on => on ? ' <em>*</em>' : '';
      const line = (k, l, vk, vl, ph, extra) => `<span class="as-lbl" style="font-weight:500">${l}</span>${T(k)}<span class="as-lbl" style="font-weight:500">${vl}${req(r[k] && vk)}</span>${vk ? In(vk, r[k], ph) : '<span></span>'}<span style="grid-column:span 6"></span>`;
      body = `<div style="max-width:400px;margin-bottom:6px"><label class="as-lbl" for="lzName">Zone Name <em>*</em></label><input class="as-in" id="lzName" style="width:100%;margin-top:4px" value="${esc(z.name)}" placeholder="Zone Name" ${id === 'new' ? '' : 'disabled'} data-lzn="1"></div>
        <div class="as-sec">Daily Labor Rules</div>
        <div class="as-lr"><span></span><span></span><span></span>${DAYS.map(d => `<span class="h">${d}</span>`).join('')}
          <span class="as-lbl" style="font-weight:500">Enable Daily Over Time</span>${T('dailyOT')}<span class="as-lbl" style="font-weight:500">Daily hours prior to Overtime${req(r.dailyOT)}</span>${r.otDays.map((v, i) => `<input class="as-in" data-ld="otDays|${i}" value="${esc(v)}" placeholder="hh:mm" ${r.dailyOT ? '' : 'disabled'} aria-label="Overtime ${DAYS[i]}">`).join('')}
          <span class="as-lbl" style="font-weight:500">Enable Daily Double Time</span>${T('dailyDT')}<span class="as-lbl" style="font-weight:500">Daily hours prior to Double Time${req(r.dailyDT)}</span>${r.dtDays.map((v, i) => `<input class="as-in" data-ld="dtDays|${i}" value="${esc(v)}" placeholder="hh:mm" ${r.dailyDT ? '' : 'disabled'} aria-label="Double time ${DAYS[i]}">`).join('')}</div>
        <div class="as-sec">Weekly Labor Rules</div>
        <div class="as-lr">
          ${line('weeklyOT', 'Enable Weekly Overtime', 'weeklyOTh', 'Weekly hours prior to Overtime')}
          ${line('weeklyDT', 'Enable Weekly Double Time', 'weeklyDTh', 'Weekly hours prior to Double Time')}
          ${line('meal', 'Enable Meal Break', 'mealMin', 'Minimum Shift Length for Meal Break')}
          ${line('mealLen', 'Enable Minimum Meal Break Length', 'mealLenH', 'Minimum Meal Break Length')}
          ${line('wage', 'Enable Minimum Wage', 'wageV', 'Minimum Wage', '$0.00')}
          ${line('rest', 'Enable Minimum Time Off Between Shifts', 'restH', 'Minimum Time Off Between Shifts')}</div>
        <div class="as-sec">Misc. Configuration</div>
        <div class="as-lr">
          ${line('d7', 'Enable 7th Day Premium Pay', '', '')}
          ${line('waiver', 'Enable Meal Break Waiver', 'waiverH', 'Offset Adjustment to Waive Meal Break')}
          <span class="as-lbl" style="font-weight:500">Capture Meal Waiver Consent</span>${T('consent', !r.waiver)}<span style="grid-column:span 8"></span>
          ${line('exMgr', 'Exclude Manager in OT/DT', '', '')}
          ${line('exShift', 'Exclude Shift Manager in OT/DT', '', '')}
          ${line('term', 'Termination Special Check', '', '')}</div>`;
    } else if (tab === 'minor') {
      const age = z._age || '';
      const mr = age ? (z.minor[age] = z.minor[age] || { maxDay: '08:00', maxWeek: '40:00', school: '04:00', schoolWeek: '18:00', start: '07:00', end: '22:00' }) : null;
      body = `<select class="as-sel" id="lzAge" style="width:220px"><option value="">Select Age</option>${['16', '17', '18'].map(a => `<option value="${a}" ${a === age ? 'selected' : ''}>Age ${a}</option>`).join('')}</select>
        ${mr ? `<div class="as-sec" style="margin-top:16px">Rules for age ${age}</div><div style="display:grid;grid-template-columns:260px 160px 260px 160px;gap:12px 16px;align-items:center">
          ${[['maxDay', 'Max hours per day'], ['maxWeek', 'Max hours per week'], ['school', 'Max hours on a school day'], ['schoolWeek', 'Max hours in a school week'], ['start', 'Earliest start time'], ['end', 'Latest end time']]
            .map(([k, l]) => `<span class="as-lbl" style="font-weight:500">${l}</span><input class="as-in" data-mn="${k}" value="${esc(mr[k])}" placeholder="hh:mm">`).join('')}</div>`
          : `<div class="as-empty"><i data-lucide="package-open" style="width:56px;height:56px;color:#cbd5e1"></i><div style="margin-top:8px">No data to display</div></div>`}`;
    } else if (tab === 'sites') {
      const per = 20, pages = Math.max(1, Math.ceil(z.sites.length / per)); z._page = Math.min(z._page || 0, pages - 1);
      const avail = SITES.filter(s => !z.sites.includes(s));
      const rows = z.sites.slice(z._page * per, z._page * per + per);
      body = `<div style="display:flex;align-items:flex-end;gap:10px;margin-bottom:12px"><div><div style="display:flex;justify-content:space-between"><span class="as-lbl" style="font-weight:500">Select Site to Add</span><a href="#" data-act="ls-all" style="font-size:12.5px;color:#2563eb;text-decoration:underline">Add All</a></div>
        <select class="as-sel" id="lsAdd" style="width:460px;margin-top:4px"><option value="">Select Site to Add</option>${avail.map(s => `<option>${esc(s)}</option>`).join('')}</select></div></div>
        <table class="as-tbl"><thead><tr><th class="c" style="width:11%">ID${sortIc}</th><th class="c">Name${sortIc}</th><th class="c" style="width:15%">Type${sortIc}</th><th class="c" style="width:11%">Action(s)</th></tr></thead><tbody>
          ${rows.map(s => `<tr><td>${esc(s.split(' - ')[0])}</td><td>${esc(s)}</td><td>Site</td><td class="c"><button type="button" class="as-ib del" data-act="ls-rm|${esc(s)}" title="Remove"><i data-lucide="trash-2"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="as-empty">No sites assigned to this zone.</td></tr>'}
        </tbody></table>
        <div class="as-pager"><button type="button" class="as-ib" data-act="ls-pg|0" aria-label="First page"><i data-lucide="chevrons-left"></i></button><button type="button" class="as-ib" data-act="ls-pg|${z._page - 1}" aria-label="Previous page"><i data-lucide="chevron-left"></i></button>
          <span>${z._page + 1}/${pages}</span><button type="button" class="as-ib" data-act="ls-pg|${z._page + 1}" aria-label="Next page"><i data-lucide="chevron-right"></i></button><button type="button" class="as-ib" data-act="ls-pg|${pages - 1}" aria-label="Last page"><i data-lucide="chevrons-right"></i></button></div>`;
    } else {
      const fmt = iso => { const d = new Date(iso); const h = d.getHours(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} ${String(h % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
      const list = (DB.zones.find(x => x.id === id) || z).audit.slice().sort((a, b) => b.at.localeCompare(a.at));
      body = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px"><button type="button" class="as-btn pri sm" data-act="au-csv"><i data-lucide="file-down"></i>Download CSV</button></div>
        <table class="as-tbl"><thead><tr><th class="c" style="width:14%">Date &amp; Time${sortIc}</th><th class="c" style="width:14%">Action Performed By${sortIc}</th><th class="c">Actions${sortIc}</th><th class="c" style="width:11%">Previous Value${sortIc}</th><th class="c" style="width:18%">Current Value${sortIc}</th></tr></thead><tbody>
          ${list.map(a => `<tr><td>${fmt(a.at)}</td><td>${esc(a.by)}</td><td>${esc(a.a)}</td><td>${esc(a.p)}</td><td>${esc(a.c)}</td></tr>`).join('') || '<tr><td colspan="5" class="as-empty">No changes recorded yet.</td></tr>'}
        </tbody></table>`;
    }
    return `<div class="as-card">${head}<div class="as-body">${body}</div></div>`;
  }
  function saveZone() {
    const z = lDraft, r = z.rule;
    if (!z.name.trim()) { toast('Zone name is required', true); const n = $('lzName'); if (n) { n.classList.add('err'); n.focus(); } return; }
    const need = [['weeklyOT', 'weeklyOTh'], ['weeklyDT', 'weeklyDTh'], ['meal', 'mealMin'], ['mealLen', 'mealLenH'], ['wage', 'wageV'], ['rest', 'restH'], ['waiver', 'waiverH']];
    const hm = /^\d{1,2}:\d{2}$/;
    for (const [k, v] of need) if (r[k] && !(k === 'wage' ? /^\d+(\.\d{1,2})?$/.test(String(r[v]).replace('$', '').trim()) : hm.test(r[v]))) { toast('Fill in the required values (hh:mm) for every rule that is turned on', true); return; }
    if ((r.dailyOT && r.otDays.some(v => !hm.test(v))) || (r.dailyDT && r.dtDays.some(v => !hm.test(v)))) { toast('Fill in hh:mm for every day', true); return; }
    const old = DB.zones.find(x => x.id === z.id);
    const clean = JSON.parse(JSON.stringify(z)); delete clean._id; delete clean._page; delete clean._age;
    clean.by = 'Store Manager';
    clean.audit = (old ? old.audit : []).concat([{ at: new Date().toISOString(), by: 'Store Manager', a: old ? 'Labor Law Updated.' : 'Labor Law Created.', p: '', c: '' }]);
    if (old) Object.assign(old, clean); else DB.zones.push(clean);
    lDraft = null; save(); toast('Labor rules saved'); location.hash = 'labor';
  }

  /* --- site settings --- */
  function vSiteDays() {
    if (!SITE) { location.hash = 'zip'; return ''; }
    crumbs(ZC.concat([[SITE, 'zip'], ['Operational Days', 'site-days']]));
    const d = DB.siteDays[SITE] = DB.siteDays[SITE] || DAYS.map(() => ({ open: true, from: '06:00', to: '22:00' }));
    return card('Operational Days', 'calendar-check', `<button type="button" class="as-btn ok" data-act="sd-save"><i data-lucide="save"></i>Save</button>`,
      `<table class="as-tbl" style="max-width:760px"><thead><tr><th>Day</th><th class="c">Open</th><th class="c">Opens at</th><th class="c">Closes at</th></tr></thead><tbody>
        ${DAYS.map((n, i) => `<tr><td>${n}</td><td class="c">${tg(d[i].open, `data-sd="${i}"`)}</td><td class="c"><input type="time" class="as-in" data-sdt="${i}|from" value="${d[i].from}" ${d[i].open ? '' : 'disabled'} aria-label="${n} opens at"></td><td class="c"><input type="time" class="as-in" data-sdt="${i}|to" value="${d[i].to}" ${d[i].open ? '' : 'disabled'} aria-label="${n} closes at"></td></tr>`).join('')}
      </tbody></table>`, `Set up the weekly operational days for <b>${esc(SITE)}</b>. Closed days are greyed out on the schedule pad.`);
  }
  function vSiteLabor() {
    if (!SITE) { location.hash = 'zip'; return ''; }
    crumbs(ZC.concat([[SITE, 'zip'], ['Labor Rules', 'site-labor']]));
    const cur = DB.zones.find(z => z.sites.includes(SITE));
    return card('Labor Rules', 'scale', '', `<div style="display:grid;grid-template-columns:180px 360px auto;gap:12px;align-items:center">
        <label class="as-lbl" for="slZone">Labor rule zone</label><select class="as-sel" id="slZone"><option value="">No zone</option>${DB.zones.map(z => `<option value="${z.id}" ${cur && cur.id === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select>
        ${cur ? `<a class="as-btn" href="#labor/${cur.id}/rule"><i data-lucide="external-link"></i>View zone rules</a>` : '<span></span>'}</div>
        <div class="as-note" style="margin-top:10px">The store follows the overtime, meal break and minor rules of the selected zone.</div>`,
      `Setup the Labor rules for <b>${esc(SITE)}</b> that comply with the local laws.`);
  }

  /* ================= router ================= */
  function route() {
    const [a, b, c] = (location.hash || '#').slice(1).split('/');
    if (a !== 'schedule-settings') draftS = null;
    if (a !== 'site-pref') pDraft = null;
    if (a !== 'matrix' || !b) mDraft = null;
    if (a !== 'labor' || !b) lDraft = null;
    const v = { '': vApps, zip: vZip, positions: vPositions, 'schedule-settings': vSchedSettings, certs: vCerts, cloud: vCloud,
      matrix: () => vMatrix(b), labor: () => vLabor(b, c), 'site-days': vSiteDays, 'site-labor': vSiteLabor, 'site-pref': vSitePref }[a] || vApps;
    $('asMain').innerHTML = `<div class="as-wrap">${v()}</div>`;
    icons();
  }
  window.addEventListener('hashchange', route);

  /* ================= events ================= */
  document.addEventListener('click', e => {
    const t = e.target;
    // Schedule Preference is always clickable; without a site it points to the site picker
    if (t.closest('a[href="#site-pref"]') && !SITE) {
      e.preventDefault();
      const s = $('asSite'); if (s) { s.classList.add('err'); s.focus(); }
      toast('Select a site first to open Schedule Preference', true); return;
    }
    // modal
    const mb = t.closest('[data-m]');
    if (mb) { if (mb.dataset.m === 'ok' && mOk && mOk() === false) return; closeM(); return; }
    if (t === $('asMw')) return closeM();
    if (t.closest('#pColorBtn')) { $('pPal').classList.toggle('open'); return; }
    const pc = t.closest('[data-pc]');
    if (pc) { const b = $('pColorBtn'); b.style.background = b.dataset.color = pc.dataset.pc; $('pPal').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === pc)); $('pPal').classList.remove('open'); return; }
    if (t.closest('#pEx')) { $('pEx').classList.toggle('on'); return; }
    // toggles inside views
    const st = t.closest('[data-st]'); if (st) { draftS[st.dataset.st] = !draftS[st.dataset.st]; st.classList.toggle('on'); return; }
    if (t.closest('[data-sp]')) { pDraft.on = !pDraft.on; return route(); }
    const lr = t.closest('[data-lr]'); if (lr && !lr.disabled) { lDraft.rule[lr.dataset.lr] = !lDraft.rule[lr.dataset.lr]; return route(); }
    const sd = t.closest('[data-sd]'); if (sd) { const d = DB.siteDays[SITE][+sd.dataset.sd]; d.open = !d.open; return route(); }
    const a = t.closest('[data-act]'); if (!a) return;
    e.preventDefault();
    const [act, arg] = a.dataset.act.split('|');
    switch (act) {
      case 'go': location.hash = arg; return;
      case 'pos-add': return posForm(null);
      case 'pos-edit': return posForm(DB.positions.find(p => p.id === arg));
      case 'pos-del': { const p = DB.positions.find(x => x.id === arg); return confirmDel(`position "${p.name}"`, () => { DB.positions = DB.positions.filter(x => x.id !== arg); save(); toast('Position deleted'); route(); }); }
      case 'pos-sort': posSort *= -1; return route();
      case 'cert-add': return certForm(null);
      case 'cert-edit': return certForm(DB.certs.find(c => c.id === arg));
      case 'cert-del': { const c = DB.certs.find(x => x.id === arg); return confirmDel(`certification "${c.name}"`, () => { DB.certs = DB.certs.filter(x => x.id !== arg); save(); toast('Certification deleted'); route(); }); }
      case 'cert-sort': certSort *= -1; return route();
      case 'st-save': {
        const mn = +draftS.minMin, mx = +draftS.minMax;
        if (!mn || !mx || mn > mx) { toast('Minimum minor age must be less than or equal to the maximum', true); return; }
        DB.settings = JSON.parse(JSON.stringify(draftS)); save(); toast('Schedule settings saved'); return;
      }
      case 'sp-save': {
        const all = spAll();
        all[SITE] = { on: pDraft.on, method: pDraft.method, tpl: +pDraft.tpl || 0 };
        try { localStorage.setItem(SP_KEY, JSON.stringify(all)); } catch (e) {}
        toast('Schedule preference saved'); return;
      }
      case 'cloud': DB.cloud = arg || null; save(); toast(arg ? `Connected to ${arg === 's3' ? 'Amazon S3' : 'Dropbox'}` : 'Cloud connection removed'); return route();
      case 'mx-row': mDraft.staff.push(String((+mDraft.staff[mDraft.staff.length - 1] || 0) + 1)); return route();
      case 'mx-rm': mDraft.staff.splice(+arg, 1); return route();
      case 'mx-ex': mDraft.exclude[arg] = !mDraft.exclude[arg]; return route();
      case 'mx-save': {
        if (!mDraft.name.trim()) { toast('Matrix name is required', true); $('mxName').classList.add('err'); $('mxName').focus(); return; }
        if (mDraft.staff.some(v => !(+v >= 1))) { toast('# of Staff must be 1 or more in every row', true); return; }
        const clean = JSON.parse(JSON.stringify(mDraft)); delete clean._id;
        const i = DB.matrices.findIndex(m => m.id === clean.id); if (i >= 0) DB.matrices[i] = clean; else DB.matrices.push(clean);
        mDraft = null; save(); toast('Matrix saved'); location.hash = 'matrix'; return;
      }
      case 'mx-del': { const m = DB.matrices.find(x => x.id === arg); return confirmDel(`matrix "${m.name}"`, () => { DB.matrices = DB.matrices.filter(x => x.id !== arg); save(); toast('Matrix deleted'); route(); }); }
      case 'lz-save': return saveZone();
      case 'lz-del': { const z = DB.zones.find(x => x.id === arg); return confirmDel(`zone "${z.name}"`, () => { DB.zones = DB.zones.filter(x => x.id !== arg); save(); toast('Zone deleted'); route(); }); }
      case 'ls-all': lDraft.sites = lDraft.sites.concat(SITES.filter(s => !lDraft.sites.includes(s))); return route();
      case 'ls-rm': lDraft.sites = lDraft.sites.filter(s => s !== arg); return route();
      case 'ls-pg': lDraft._page = Math.max(0, +arg); return route();
      case 'au-csv': {
        const z = DB.zones.find(x => x.id === lDraft.id) || lDraft;
        const csv = 'Date & Time,Action Performed By,Actions,Previous Value,Current Value\n' + z.audit.map(x => [x.at, x.by, x.a, x.p, x.c].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); l.download = `labor-rules-audit-${z.name || 'zone'}.csv`; l.click(); return;
      }
      case 'sd-save': save(); toast('Operational days saved'); return;
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'asQ') { posQ = t.value; const p = t.selectionStart; route(); const n = $('asQ'); n.focus(); n.setSelectionRange(p, p); return; }
    if (t.dataset.sv) draftS[t.dataset.sv] = t.value;
    if (t.dataset.mx) mDraft[t.dataset.mx] = t.value;
    if (t.dataset.mxs) mDraft.staff[+t.dataset.mxs] = t.value;
    if (t.dataset.lzn) lDraft.name = t.value;
    if (t.dataset.lv) lDraft.rule[t.dataset.lv] = t.value;
    if (t.dataset.ld) { const [k, i] = t.dataset.ld.split('|'); lDraft.rule[k][+i] = t.value; }
    if (t.dataset.mn) lDraft.minor[lDraft._age][t.dataset.mn] = t.value;
    if (t.dataset.sdt) { const [i, k] = t.dataset.sdt.split('|'); DB.siteDays[SITE][+i][k] = t.value; }
    if (t.classList.contains('err')) t.classList.remove('err');
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'asSite') { SITE = t.value; sessionStorage.setItem('asSite', SITE); return route(); }
    if (t.dataset.sv) draftS[t.dataset.sv] = t.value;
    if (t.name === 'spMethod') { pDraft.method = t.value; return route(); }   // one option at a time; shows the template picker
    if (t.id === 'spTpl') { pDraft.tpl = t.value; return; }
    if (t.id === 'lzAge') { lDraft._age = t.value; return route(); }
    if (t.id === 'lsAdd' && t.value) { lDraft.sites.push(t.value); return route(); }
    if (t.id === 'slZone') {
      DB.zones.forEach(z => { z.sites = z.sites.filter(s => s !== SITE); });
      const z = DB.zones.find(x => x.id === t.value); if (z) z.sites.push(SITE);
      save(); toast(z ? `${SITE} now follows ${z.name}` : 'Zone removed for this site'); return route();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeM();
    if (e.key === 'Enter' && $('asMw').classList.contains('open') && e.target.tagName === 'INPUT') { e.preventDefault(); $('asMw').querySelector('[data-m="ok"]').click(); }
  });
  route();
})();
