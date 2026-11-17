/* =====================================================================
   Team Center — left-sidebar sub menu + tiles page
   - Adds an expand chevron + sub menu to the sidebar "Team Center" item.
   - Clicking "Team Center" opens the tiles page (hosted in Schedule Pad,
     like Reports). On other pages it links to Schedule Pad.html#team-center.
   ===================================================================== */
(function () {
  'use strict';

  const ITEMS = [
    { id: 'requests',   name: 'Requests',            icon: 'clipboard-check', color: '#2563eb',
      desc: 'Easily manage and take action on things that need your attention, as well as keep track of things you have requested.' },
    { id: 'myschedule', name: 'My Schedule',         icon: 'calendar-clock',  color: '#7c3aed',
      desc: 'View your published schedules along with time off and offer your shifts to co-workers.' },
    { id: 'availability', name: 'Availability',      icon: 'user-check',      color: '#16a34a',
      desc: 'Set up your availability preferences and let the manager know when you are available to work.' },
    { id: 'timeoff',    name: 'Time Off',            icon: 'umbrella',        color: '#db2777',
      desc: 'Request partial day or all day time off, as well as track the status of your requested time off.' },
    { id: 'contacts',   name: 'Contacts',            icon: 'contact',         color: '#0891b2',
      desc: 'View contact information of your co-workers who have shared it with you.' },
    { id: 'siteschedule', name: 'Site Schedule',     icon: 'map-pinned',      color: '#ea580c',
      desc: 'View published schedule(s) of your co-workers who have shared it with you.' },
    { id: 'restricted', name: 'Restricted Time Off', icon: 'calendar-off',    color: '#dc2626',
      desc: 'Track and manage restricted leave requests.' },
  ];
  const HOST = !!document.getElementById('schedulePadView');   // Schedule Pad hosts the tiles page
  const ACTIVE = 'bg-[#1d3b6a]';
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };

  /* ---------------- Sidebar ---------------- */
  let parent = null, sub = null;
  function buildSidebar() {
    parent = [...document.querySelectorAll('.sidebar .menu-item')]
      .find(el => (el.querySelector('.label') || {}).textContent?.trim() === 'Team Center');
    if (!parent) return;
    parent.classList.add('tc-parent');
    parent.setAttribute('role', 'button');
    parent.setAttribute('aria-expanded', 'false');
    if (parent.tagName === 'A') parent.setAttribute('href', HOST ? '#team-center' : 'Schedule Pad.html#team-center');

    const chev = document.createElement('span');
    chev.className = 'tc-chev';
    chev.title = 'Show / hide Team Center menu';
    chev.innerHTML = '<i data-lucide="chevron-down"></i>';
    parent.appendChild(chev);

    sub = document.createElement('div');
    sub.className = 'tc-sub';
    sub.innerHTML = ITEMS.map(it =>
      `<a href="${HOST ? '#team-center/' + it.id : 'Schedule Pad.html#team-center/' + it.id}" data-tc="${it.id}"><i data-lucide="${it.icon}"></i><span>${it.name}</span></a>`).join('');
    parent.insertAdjacentElement('afterend', sub);

    chev.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); setExpanded(!sub.classList.contains('open')); });
    parent.addEventListener('click', e => {
      e.preventDefault();
      setExpanded(true);
      if (HOST) openTeamCenter(); else location.href = 'Schedule Pad.html#team-center';
    });
    sub.addEventListener('click', e => {
      const a = e.target.closest('[data-tc]'); if (!a) return;
      if (!HOST) return;                       // normal link to Schedule Pad
      e.preventDefault();
      openTeamCenter(a.dataset.tc);
    });
    // remember expanded state
    let open = false; try { open = localStorage.getItem('tcMenuOpen') === '1'; } catch (e) {}
    setExpanded(open);
    icons();
  }
  function setExpanded(open) {
    if (!sub) return;
    sub.classList.toggle('open', open);
    parent.classList.toggle('tc-open', open);
    parent.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { localStorage.setItem('tcMenuOpen', open ? '1' : '0'); } catch (e) {}
  }
  function markSub(id) { if (sub) sub.querySelectorAll('[data-tc]').forEach(a => a.classList.toggle('active', a.dataset.tc === id)); }

  /* ---------------- Tiles page (Schedule Pad only) ---------------- */
  function buildView() {
    if (document.getElementById('teamCenterView')) return;
    const v = document.createElement('div');
    v.id = 'teamCenterView';
    v.innerHTML = `
      <div class="tc-wrap">
        <div class="tc-head">
          <span class="tc-head-ic"><i data-lucide="users" style="width:20px;height:20px"></i></span>
          <div><h1>Team Center</h1><p>Requests, schedules, availability and time off for your team in one place.</p></div>
        </div>
        <div class="tc-grid">${ITEMS.map(it => `
          <div class="tc-card" style="--tc:${it.color}" data-tc-card="${it.id}" tabindex="0" role="button">
            <span class="tc-ic"><i data-lucide="${it.icon}"></i></span>
            <div class="min-w-0 flex-1">
              <div class="tc-name">${it.name}</div>
              <div class="tc-desc">${it.desc}</div>
            </div>
            <i data-lucide="chevron-right" class="tc-go" style="width:18px;height:18px"></i>
          </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(v);
    const pick = el => { const c = el.closest('[data-tc-card]'); if (!c) return; openItem(c.dataset.tcCard); };
    v.addEventListener('click', e => pick(e.target));
    v.addEventListener('keydown', e => { if (e.key === 'Enter') pick(e.target); });
  }
  /* items that have their own screen */
  const SCREENS = { availability: () => window.openMyAvailability && window.openMyAvailability() };
  function openItem(id) {
    const it = ITEMS.find(x => x.id === id); if (!it) return;
    if (SCREENS[id] && window.openMyAvailability) return openTeamCenter(id);
    markSub(id);
    flash(id);
    if (typeof window.showToast === 'function') window.showToast(`${it.name} opens here — screen not built yet in this prototype.`, 'info');
  }
  function flash(id) {
    document.querySelectorAll('.tc-card.flash').forEach(c => c.classList.remove('flash'));
    const c = document.querySelector(`[data-tc-card="${id}"]`);
    if (!c) return;
    c.classList.add('flash');
    c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('flash'), 1800);
  }

  const isOpen = () => { const v = document.getElementById('teamCenterView'); return !!v && v.style.display === 'block'; };
  function openTeamCenter(itemId) {
    buildView();
    // close the other full-page views (same behaviour as Reports / Standard Shifts)
    const rv = document.getElementById('reportsView'), sv = document.getElementById('standardShiftsView');
    if (rv && rv.style.display === 'block' && typeof _closeReports === 'function') _closeReports();
    if (sv && sv.style.display === 'block' && typeof _closeStd === 'function') _closeStd();
    document.getElementById('teamCenterView').style.display = 'block';
    document.querySelector('.sidebar a[href="Schedule Pad.html"]')?.classList.remove(ACTIVE);
    parent && parent.classList.add(ACTIVE);
    setExpanded(true);
    const hash = itemId ? '#team-center/' + itemId : '#team-center';
    if (location.hash !== hash) history.replaceState(null, '', hash);
    markSub(itemId || null);
    icons();
    if (itemId && SCREENS[itemId] && window.openMyAvailability) { SCREENS[itemId](); return; }
    if (window.closeMyAvailability) window.closeMyAvailability(true);
    if (itemId) setTimeout(() => flash(itemId), 50);
  }
  function closeTeamCenter() {
    if (window.closeMyAvailability) window.closeMyAvailability(true);
    const v = document.getElementById('teamCenterView'); if (!v) return;
    v.style.display = 'none';
    parent && parent.classList.remove(ACTIVE);
    markSub(null);
  }

  /* Reports / Standard Shifts close Team Center when they open */
  let _closeReports = null, _closeStd = null;
  function wrapOthers() {
    if (typeof window.closeReports === 'function') _closeReports = window.closeReports;
    if (typeof window.closeStandardShifts === 'function') _closeStd = window.closeStandardShifts;
    ['openReports', 'openStandardShifts'].forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = function () { if (isOpen()) closeTeamCenter(); return orig.apply(this, arguments); };
    });
  }

  function fromHash() {
    const m = location.hash.match(/^#team-center(?:\/([\w-]+))?$/);
    if (m) openTeamCenter(m[1]);
  }

  function init() {
    buildSidebar();
    if (!HOST) return;
    wrapOthers();
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }
  window.openTeamCenter = openTeamCenter;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
