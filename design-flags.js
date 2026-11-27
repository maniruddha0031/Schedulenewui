/* =====================================================================
   Design versions (internal)                                 prefix: df-
   An "i" button at the bottom of the left sidebar opens a large square
   pop-up with feature flags used to switch between design versions while
   reviewing. For design purposes only: NOT part of the product and not to
   be included in product documentation.

   Flags (localStorage 'zipDesignFlags'):
     availPanel  Availability: Regular + Temporary on one screen, editing in a side panel
     availFull   Availability: Regular + Temporary on one screen, editing full screen
     availTempReg Availability: current tabs, with temporary hours shown on the Regular view
   The availability flags are alternatives: only one can be on at a time.
   All off = current design (separate Regular / Temporary tabs).

   API: window.DFLAGS.get(name) · set(name, on) · availMode() → 'panel' | 'full' | null
   Event: window 'dflags:change' (also fired when another tab changes the flags)
   ===================================================================== */
(function () {
  'use strict';
  const KEY = 'zipDesignFlags';
  const SECTIONS = [
    { id: 'availability', title: 'Availability', icon: 'calendar-check',
      sub: 'Employee availability in Team Center (crew) and the Availability pop-up on Schedule Pad (manager).',
      group: 'avail',
      flags: [
        { key: 'availPanel', title: 'Availability feature with side panel',
          desc: 'Regular and temporary availability on one screen. "Add/Update Availability" opens the editor in a side panel from the right, like Add Shift.' },
        { key: 'availFull', title: 'Availability feature with full screen',
          desc: 'Regular and temporary availability on one screen. "Add/Update Availability" opens the editor full screen in place of the page.' },
        { key: 'availTempReg', title: 'Temporary availability on the Regular view',
          desc: 'Current design with tabs, but the Regular tab also shows temporary availability for the next 7 days: the temporary hours replace the bar on those days, the regular hours stay as a dashed outline, and a "Temp · dates" tag sits under the day.' },
      ] },
  ];

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const fire = () => window.dispatchEvent(new CustomEvent('dflags:change'));
  function get(name) { return !!read()[name]; }
  function set(name, on) {
    const v = read(); v[name] = !!on;
    const sec = SECTIONS.find(s => s.flags.some(f => f.key === name));
    if (on && sec && sec.group) sec.flags.forEach(f => { if (f.key !== name) v[f.key] = false; });   // one version per group
    write(v); fire();
  }
  const availMode = () => { const v = read(); return v.availPanel ? 'panel' : v.availFull ? 'full' : null; };
  window.DFLAGS = { get, set, availMode };
  window.addEventListener('storage', e => { if (e.key === KEY) { fire(); if (isOpen()) render(); } });

  /* ---------------- styles ---------------- */
  const CSS = `
  .df-btn{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;color:#fff;opacity:.9;background:none;border:0;cursor:pointer;border-radius:10px;font:inherit;text-align:left;white-space:nowrap}
  .df-btn:hover{opacity:1;background:rgba(255,255,255,.08)}
  .df-btn svg{width:22px;height:22px;flex:none;stroke-width:1.8}
  .df-btn .df-dot{position:absolute;left:33px;top:9px;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 2px #0b1f3f}
  .sidebar:not(:hover) .df-btn .label{display:none}
  .df-ov{position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;padding:16px}
  .df-ov.open{display:flex}
  .df-m{--df-s:#fff;--df-s2:#f6f8fb;--df-line:#e2e7ef;--df-ink:#142033;--df-mut:#5b6b80;--df-pri:#2457e6;--df-pri-soft:#e9efff;--df-ok:#1faa58;
    width:min(72vw,86vh,100%);height:min(72vw,86vh);max-height:100%;aspect-ratio:1/1;background:var(--df-s);color:var(--df-ink);border-radius:18px;
    box-shadow:0 30px 70px -12px rgba(15,23,42,.45);display:flex;flex-direction:column;overflow:hidden;font:14px/1.45 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  html.dark .df-m{--df-s:#121a27;--df-s2:#172131;--df-line:#243146;--df-ink:#e6ecf5;--df-mut:#9aa9bd;--df-pri:#5b84ff;--df-pri-soft:#1b2a4d;--df-ok:#2fc06b}
  .df-m *{box-sizing:border-box}
  .df-h{display:flex;align-items:flex-start;gap:14px;padding:22px 26px 18px;border-bottom:1px solid var(--df-line)}
  .df-h .ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--df-pri-soft);color:var(--df-pri);flex:none}
  .df-h .ic svg{width:22px;height:22px}
  .df-h h2{margin:0;font-size:19px;font-weight:700;letter-spacing:-.01em}
  .df-h p{margin:3px 0 0;color:var(--df-mut);font-size:13px}
  .df-h .x{margin-left:auto;width:34px;height:34px;border-radius:9px;border:1px solid var(--df-line);background:var(--df-s);color:var(--df-mut);display:grid;place-items:center;cursor:pointer;flex:none}
  .df-h .x:hover{color:var(--df-ink);background:var(--df-s2)}
  .df-note{margin:16px 26px 0;padding:10px 14px;border-radius:10px;background:#fff7e6;border:1px solid #f2cf85;color:#7a4b00;font-size:12.5px;display:flex;gap:8px;align-items:flex-start}
  html.dark .df-note{background:#33270e;border-color:#6b5016;color:#f6d28c}
  .df-note svg{width:16px;height:16px;flex:none;margin-top:1px}
  .df-b{flex:1;overflow:auto;padding:18px 26px 26px;display:flex;flex-direction:column;gap:18px}
  .df-sec{border:1px solid var(--df-line);border-radius:14px;overflow:hidden}
  .df-sh{display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--df-s2);border-bottom:1px solid var(--df-line)}
  .df-sh .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#dcf4e5;color:#17914a;flex:none}
  html.dark .df-sh .ic{background:#123222;color:#2fc06b}
  .df-sh .ic svg{width:18px;height:18px}
  .df-sh h3{margin:0;font-size:15px;font-weight:700}
  .df-sh small{display:block;color:var(--df-mut);font-size:12.5px}
  .df-sh .st{margin-left:auto;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--df-s);border:1px solid var(--df-line);color:var(--df-mut);white-space:nowrap}
  .df-sh .st.on{background:#dcf4e5;border-color:#a9e2bf;color:#17914a}
  html.dark .df-sh .st.on{background:#123222;border-color:#1f5a37;color:#2fc06b}
  .df-f{display:flex;align-items:flex-start;gap:14px;padding:16px 18px;cursor:pointer}
  .df-f + .df-f{border-top:1px solid var(--df-line)}
  .df-f:hover{background:var(--df-s2)}
  .df-f .n{width:26px;height:26px;border-radius:8px;background:var(--df-pri-soft);color:var(--df-pri);font-weight:700;font-size:13px;display:grid;place-items:center;flex:none}
  .df-f .tx{flex:1;min-width:0}
  .df-f b{display:block;font-size:14px;font-weight:600}
  .df-f span.d{display:block;color:var(--df-mut);font-size:12.5px;margin-top:2px}
  .df-sw{position:relative;width:42px;height:24px;flex:none;margin-top:1px}
  .df-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
  .df-sw i{position:absolute;inset:0;border-radius:999px;background:#cfd7e3;transition:background .15s}
  .df-sw i::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}
  .df-sw input:checked + i{background:var(--df-ok)}
  .df-sw input:checked + i::after{transform:translateX(18px)}
  .df-sw input:focus-visible + i{outline:2px solid var(--df-pri);outline-offset:2px}
  .df-def{padding:12px 18px;border-top:1px solid var(--df-line);color:var(--df-mut);font-size:12.5px;display:flex;gap:8px;align-items:center}
  .df-def svg{width:15px;height:15px;flex:none}
  .df-def.on{color:var(--df-ink);font-weight:600}`;

  /* ---------------- DOM ---------------- */
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const isOpen = () => { const o = document.getElementById('dfOv'); return !!(o && o.classList.contains('open')); };
  function anyOn() { const v = read(); return SECTIONS.some(s => s.flags.some(f => v[f.key])); }
  function mount() {
    if (document.getElementById('dfStyle')) return;
    const st = document.createElement('style'); st.id = 'dfStyle'; st.textContent = CSS; document.head.appendChild(st);
    const sb = document.querySelector('.sidebar');
    if (sb) {
      const bottom = sb.lastElementChild && sb.lastElementChild !== sb.firstElementChild ? sb.lastElementChild : sb;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'df-btn'; b.id = 'dfBtn'; b.title = 'Design versions (internal)';
      b.innerHTML = '<i data-lucide="info"></i><span class="df-dot" hidden></span><span class="label">Design Versions</span>';
      b.addEventListener('click', open);
      bottom.appendChild(b);
    }
    const ov = document.createElement('div');
    ov.className = 'df-ov'; ov.id = 'dfOv';
    ov.innerHTML = '<div class="df-m" role="dialog" aria-modal="true" aria-labelledby="dfTitle"></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-df="close"]')) return close();
    });
    ov.addEventListener('change', e => { const k = e.target.dataset.flag; if (k) { set(k, e.target.checked); render(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
    window.addEventListener('dflags:change', dot);
    dot(); icons();
  }
  function dot() { const d = document.querySelector('#dfBtn .df-dot'); if (d) d.hidden = !anyOn(); }
  function render() {
    const v = read();
    document.querySelector('#dfOv .df-m').innerHTML = `
      <div class="df-h"><span class="ic"><i data-lucide="flag"></i></span>
        <div><h2 id="dfTitle">Design Versions</h2><p>Switch features between design versions while reviewing. Changes apply right away on every page.</p></div>
        <button type="button" class="x" data-df="close" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="df-note"><i data-lucide="alert-triangle"></i><span>For design review and version tracking only. This page is not part of the product, so leave it out of product documents.</span></div>
      <div class="df-b">${SECTIONS.map(s => { const on = s.flags.find(f => v[f.key]);
        return `<section class="df-sec" aria-labelledby="dfs-${s.id}">
          <div class="df-sh"><span class="ic"><i data-lucide="${s.icon}"></i></span><div><h3 id="dfs-${s.id}">${s.title}</h3><small>${s.sub}</small></div>
            <span class="st ${on ? 'on' : ''}">${on ? 'Version ' + (s.flags.indexOf(on) + 1) + ' on' : 'Current design'}</span></div>
          ${s.flags.map((f, i) => `<label class="df-f"><span class="n">${i + 1}</span><span class="tx"><b>${f.title}</b><span class="d">${f.desc}</span></span>
            <span class="df-sw"><input type="checkbox" data-flag="${f.key}" ${v[f.key] ? 'checked' : ''} aria-label="${f.title}"><i></i></span></label>`).join('')}
          <div class="df-def ${on ? '' : 'on'}"><i data-lucide="${on ? 'circle' : 'check-circle-2'}"></i>All off: current design, with separate Regular and Temporary availability tabs.</div>
        </section>`; }).join('')}</div>`;
    icons();
  }
  function open() { mount(); render(); document.getElementById('dfOv').classList.add('open'); }
  function close() { const o = document.getElementById('dfOv'); if (o) o.classList.remove('open'); }
  window.openDesignFlags = open;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
