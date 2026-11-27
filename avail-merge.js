/* =====================================================================
   Merged availability screen (design versions)               prefix: avx-
   Regular + Temporary availability on ONE screen instead of two tabs.
   Turned on from Design Versions (design-flags.js):
     'panel' → "Add/Update Availability" opens the editor in a side panel (like Add Shift)
     'full'  → the editor takes the whole screen in place of the page
   Used by employee-availability.js (crew, Team Center) and availability-modal.js
   (manager pop-up on Schedule Pad). Both keep their own editors; this file only
   moves things around:
     · section heads for Regular / Temporary, the Add/Update dropdown
     · panel: the live editor element is moved into a right-side drawer and a frozen
       copy of the page stays behind it; it moves back when the edit ends
     · full: the other section is hidden while one is being edited
   ===================================================================== */
(function () {
  'use strict';
  const KEY = 'zipDesignFlags';
  function mode() {
    if (window.DFLAGS) return DFLAGS.availMode();
    try { const v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; return v.availPanel ? 'panel' : v.availFull ? 'full' : null; } catch (e) { return null; }
  }
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const HOSTS = [];
  const TONE_IC = { reg: 'calendar-check', temp: 'calendar-clock' };

  /* ---------------- markup ---------------- */
  function headHTML(o) {
    return `<div class="avx-ic ${o.tone}"><i data-lucide="${TONE_IC[o.tone]}"></i></div>
      <div class="avx-sh-tx"><h2>${o.title}${o.count ? ` <span class="avx-n" title="${o.countTitle || ''}">${o.count}</span>` : ''}</h2><small>${o.sub}</small></div>
      <span class="avx-grow"></span>${o.right || ''}`;
  }
  function ddHTML(items) {
    return `<div class="avx-dd">
      <button type="button" class="vbtn primary" data-avx="dd" aria-haspopup="menu" aria-expanded="false"><i data-lucide="pencil"></i>Add/Update Availability<i data-lucide="chevron-down" class="avx-car"></i></button>
      <div class="avx-ddm" role="menu" hidden>${items.map(it => `<button type="button" role="menuitem" class="avx-ddi" data-avx-act="${it.act}">
        <span class="avx-ic ${it.tone}"><i data-lucide="${TONE_IC[it.tone]}"></i></span><span class="tx"><b>${it.title}</b><small>${it.sub}</small></span></button>`).join('')}</div>
    </div>`;
  }
  function closeMenus(except) { document.querySelectorAll('.avx-ddm:not([hidden])').forEach(m => { if (m !== except) { m.hidden = true; const b = m.previousElementSibling; if (b) b.setAttribute('aria-expanded', 'false'); } }); }
  document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('.avx-dd')) closeMenus(); });

  /* ---------------- host ----------------
     cfg: { root, frame, top, regMain, regSec, regHead, tempWrap, tempHead, tempEl,
            regEditing(), tempEditing(), titles:{reg,temp}, acts:{reg:[cancel,ok], temp:[cancel,ok]}, onAct(act) } */
  function host(cfg) {
    const H = Object.assign({ dr: null }, cfg);
    H.top.addEventListener('click', e => {
      const b = e.target.closest('[data-avx="dd"]');
      if (b) { const m = b.nextElementSibling, open = m.hidden; closeMenus(m); m.hidden = !open; b.setAttribute('aria-expanded', String(open)); return; }
      const it = e.target.closest('[data-avx-act]');
      if (it) { closeMenus(); H.onAct(it.dataset.avxAct); }
    });
    HOSTS.push(H);
    return H;
  }

  /* call at the START of the host's render: in panel mode the page is frozen behind the drawer
     before the section switches to its editor */
  function pre(H) {
    if (mode() !== 'panel') return;
    const want = H.regEditing() ? 'reg' : H.tempEditing() ? 'temp' : null;
    if (want && (!H.dr || H.dr.kind !== want)) { close(H); openDrawer(H, want); }
  }
  /* call at the END of the host's render (and after the temporary view renders) */
  function sync(H) {
    const M = mode(), rE = H.regEditing(), tE = H.tempEditing();
    if (!M) { close(H); H.regMain.hidden = false; H.tempWrap.hidden = false; H.regHead.hidden = true; H.tempHead.hidden = true; return; }
    if (M === 'full') {
      close(H);
      H.regMain.hidden = tE; H.tempWrap.hidden = rE;
      H.regHead.hidden = rE; H.tempHead.hidden = tE;
      return;
    }
    H.regMain.hidden = false; H.tempWrap.hidden = false; H.regHead.hidden = false; H.tempHead.hidden = false;
    const want = rE ? 'reg' : tE ? 'temp' : null;
    if (!want) return close(H);
    if (!H.dr || H.dr.kind !== want) { close(H); openDrawer(H, want); }
    syncDrawer(H);
  }

  /* ---------------- drawer ---------------- */
  function openDrawer(H, kind) {
    const src = kind === 'reg' ? H.regSec : H.tempEl;
    const ghost = src.cloneNode(true);
    ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    ghost.setAttribute('inert', ''); ghost.setAttribute('aria-hidden', 'true'); ghost.classList.add('avx-ghost'); ghost.hidden = false;
    src.parentNode.insertBefore(ghost, src);
    const scrim = document.createElement('div'); scrim.className = 'avx-scrim';
    const dr = document.createElement('aside');
    dr.className = `avx-drawer v2 avx-${kind}`; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true'); dr.setAttribute('aria-labelledby', 'avxDrT');
    dr.innerHTML = `<div class="avx-dh"><div class="avx-ic ${kind}"><i data-lucide="${TONE_IC[kind]}"></i></div>
        <div class="avx-sh-tx"><h2 id="avxDrT">${titleOf(H, kind)}</h2><small class="avx-dsub"></small></div>
        <button type="button" class="avx-x" data-avx="x" aria-label="Close" title="Close"><i data-lucide="x"></i></button></div>
      <div class="avx-db"></div>
      <div class="avx-df"></div>`;
    dr.querySelector('.avx-db').appendChild(src);
    H.root.appendChild(scrim); H.root.appendChild(dr); H.root.classList.add('avx-lock');
    scrim.addEventListener('click', () => cancel(H));
    dr.querySelector('[data-avx="x"]').addEventListener('click', () => cancel(H));
    dr.querySelector('.avx-df').addEventListener('click', e => {
      const b = e.target.closest('[data-avx-proxy]'); if (!b || b.disabled) return;
      const o = H.dr && H.dr.src.querySelector(H.acts[H.dr.kind][+b.dataset.avxProxy]); if (o) o.click();
    });
    let q = false;
    const mo = new MutationObserver(() => { if (q) return; q = true; Promise.resolve().then(() => { q = false; if (H.dr) syncDrawer(H); }); });
    mo.observe(dr.querySelector('.avx-db'), { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    H.dr = { kind, src, ghost, scrim, dr, mo, sig: '' };
    place(H);
    requestAnimationFrame(() => { dr.classList.add('in'); scrim.classList.add('in'); });
    icons();
  }
  const titleOf = (H, kind) => { const t = H.titles[kind]; return typeof t === 'function' ? t() : t; };
  function syncDrawer(H) {
    const D = H.dr, src = D.src;
    D.dr.querySelector('#avxDrT').textContent = titleOf(H, D.kind);
    const sub = src.querySelector('.ea-bar .ti small, .tv-head p');
    D.dr.querySelector('.avx-dsub').textContent = sub ? sub.textContent : '';
    const origs = H.acts[D.kind].map(s => src.querySelector(s));
    origs.forEach(o => o && o.classList.add('avx-hid'));
    const sig = origs.map(o => o ? o.innerHTML + '|' + o.disabled + '|' + (o.title || '') : '').join('#');
    if (sig === D.sig) return;
    D.sig = sig;
    D.dr.querySelector('.avx-df').innerHTML = origs.map((o, i) => o
      ? `<button type="button" class="vbtn ${i ? 'primary' : 'ghost'}" data-avx-proxy="${i}" ${o.disabled ? 'disabled' : ''} title="${(o.title || '').replace(/"/g, '&quot;')}">${o.innerHTML}</button>` : '').join('');
    icons();
  }
  function close(H) {
    const D = H.dr; if (!D) return;
    D.mo.disconnect();
    D.src.querySelectorAll('.avx-hid').forEach(n => n.classList.remove('avx-hid'));
    D.ghost.replaceWith(D.src);
    D.scrim.remove(); D.dr.remove(); H.root.classList.remove('avx-lock');
    H.dr = null;
  }
  function cancel(H) {
    const D = H.dr; if (!D) return;
    const o = D.src.querySelector(H.acts[D.kind][0]);
    if (o) o.click(); else close(H);
  }
  /* the drawer covers the host's screen area (Team Center page below the top bar, or the whole window) */
  function place(H) {
    const D = H.dr; if (!D) return;
    const f = H.frame && H.frame();
    const r = f ? f.getBoundingClientRect() : { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
    const box = { top: r.top + 'px', left: r.left + 'px', right: (innerWidth - r.right) + 'px', bottom: (innerHeight - r.bottom) + 'px' };
    Object.assign(D.scrim.style, box);
    Object.assign(D.dr.style, { top: box.top, right: box.right, bottom: box.bottom });
  }
  window.addEventListener('resize', () => HOSTS.forEach(place));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const H = HOSTS.find(h => h.dr && h.dr.dr.isConnected); if (!H) return;
    if (document.querySelector('.avm-dlg-wrap.open, .ea-dw.open, .ta-dw.open, .ta-rv-wrap.open, #tvLayer:not(:empty)')) return;
    e.stopImmediatePropagation(); e.preventDefault(); cancel(H);
  }, true);

  /* regular card bar (view mode): Current / Requested chips stay in one fixed place next to the weekly
     hours; when another version is selected, a second row shows its effective date + its actions */
  function barLayout(bar, chips, info) {
    const r = bar && bar.querySelector('.r'); if (!r) return;
    r.querySelectorAll(':scope > .ea-btn[data-sel="current"]').forEach(b => b.remove());   // no "Back to current": the Current chip does that
    const btns = [...r.querySelectorAll(':scope > .ea-btn')];
    r.insertAdjacentHTML('afterbegin', chips);
    if (!info && !btns.length) return;
    const row = document.createElement('div');
    row.className = 'avx-brow';
    row.innerHTML = `<div class="avx-binfo">${info || ''}</div><span class="avx-grow"></span>`;
    btns.forEach(b => row.appendChild(b));
    bar.appendChild(row);
  }
  const effHTML = (date, rest) => `<span class="avx-eff"><i data-lucide="calendar-days"></i>Effective from <b>${date}</b></span>${(rest || []).filter(Boolean).map(x => `<span class="avx-bsep"></span><span>${x}</span>`).join('')}`;

  window.AVMERGE = { mode, host, pre, sync, close, headHTML, ddHTML, icons, barLayout, effHTML };
})();
