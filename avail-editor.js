/* =====================================================================
   Weekly hours editor — two views of the same hours            prefix: ae-
     'time' : table   — tick days, Available / All day / Unavailable, type or pick hours
     'drag' : timeline — drag to add, drag a block's edges to resize, click a block,
                        side panel with exact times + "Also apply to"
   Hour based: one bool[24] per day (same model as the rest of the app).

   AVED.mount(el, id, cfg)      cfg = { keys:[{k,w,today}], get(k), set(k,row), ref(k)|null,
                                        mode:'time'|'drag', refShort, refLegend, onChange() }
   AVED.toolsHTML(id, cfg)      the "Select … / Reset to …" strip for the host's tool row
   AVED.reset(id)               forget selection (call when an edit starts)
   ===================================================================== */
(function () {
  'use strict';
  const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const L1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const ED = {};
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const empty = () => Array(24).fill(false);
  const fill = (row, a, b, v = true) => { const r = row.slice(); for (let h = Math.max(0, a); h < Math.min(24, b); h++) r[h] = v; return r; };
  const rowOf = (a, b) => fill(empty(), a, b);
  const hrs = r => r.filter(Boolean).length;
  const same = (a, b) => a.every((v, i) => v === b[i]);
  function ranges(row) { const o = []; let s = null; for (let h = 0; h <= 24; h++) { const on = h < 24 && row[h]; if (on && s === null) s = h; if (!on && s !== null) { o.push([s, h]); s = null; } } return o; }
  const fromRanges = rs => rs.reduce((r, [a, b]) => fill(r, a, b), empty());
  const pct = h => (h / 24 * 100) + '%';
  const tLong = h => h === 24 ? 'Midnight' : `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
  const tS = h => `${h % 12 || 12}${h % 24 < 12 ? 'a' : 'p'}`;
  const hv = h => String(h % 24).padStart(2, '0') + ':00';
  const rtext = row => { const rs = ranges(row); return rs.length ? rs.map(([a, b]) => `${tLong(a)} – ${tLong(b)}`).join(', ') : 'Unavailable'; };
  const status = row => { const n = hrs(row); return n === 0 ? 'off' : n === 24 ? 'all' : 'on'; };
  const icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };

  /* a free spot for one more slot (keeps a 1-hour gap to its neighbours) */
  function addSlot(row) {
    if (!hrs(row)) return rowOf(9, 17);
    const gaps = ranges(row.map(v => !v)).map(([a, b]) => [a > 0 ? a + 1 : a, b < 24 ? b - 1 : b]).filter(([a, b]) => b - a >= 1);
    if (!gaps.length) return null;
    const last = ranges(row).pop()[1];
    const g = gaps.find(([a]) => a >= last) || gaps[gaps.length - 1];
    return fill(row, g[0], Math.min(g[1], g[0] + 3));
  }
  /* type a time into slot i — minutes snap to the hour; an end of 00:00 means midnight */
  function parseT(v, end) { if (!v) return null; const [H, M] = v.split(':').map(Number); let h = H + (M >= 30 ? 1 : 0); if (end && h === 0) h = 24; return Math.min(24, h); }
  function setSlot(row, i, which, h) {
    const rs = ranges(row); if (!rs[i]) return row;
    let [a, b] = rs[i];
    if (which === 's') { a = Math.min(h, 23); if (b <= a) b = a + 1; } else { b = Math.max(h, 1); if (a >= b) a = b - 1; }
    rs[i] = [a, b]; return fromRanges(rs);
  }

  const cfgOf = id => ED[id] && ED[id].cfg;
  function st(id) { return ED[id] || (ED[id] = { sel: new Set(), day: null, blk: null, also: new Set() }); }
  const nameOf = (E, k) => { const x = E.cfg.keys.find(o => o.k === k); return x ? x.w : 0; };
  const keyO = (E, k) => E.cfg.keys.find(o => o.k === k) || { k, w: 0 };
  const LB = {
    name: o => o.label || FULL[o.w] + 's',              // table: main line
    sub: o => o.sub != null ? o.sub : 'Every ' + FULL[o.w],
    short: o => o.short || SHORT[o.w],                  // timeline label / Apply button
    title: o => o.title || FULL[o.w],                   // panel heading
    chip: o => o.chip || L1[o.w],                       // Also apply to
    date: o => o.date ? o.date + ' · ' : '',            // small line prefix on the timeline
  };
  const changed = (cfg, k) => { const r = cfg.ref(k); return !!r && !same(cfg.get(k), r); };

  /* write a day; in the table a change to a ticked day goes to every ticked day */
  function put(E, k, row, spread) {
    E.cfg.set(k, row);
    if (spread && E.cfg.mode === 'time' && E.sel.has(k)) E.sel.forEach(o => { if (o !== k) E.cfg.set(o, row.slice()); });
  }
  function byStatus(E, k, s) {
    const row = E.cfg.get(k), ref = E.cfg.ref(k);
    if (s === 'off') return empty();
    if (s === 'all') return fill(empty(), 0, 24);
    if (status(row) === 'on') return row;
    return ref && status(ref) === 'on' ? ref.slice() : rowOf(9, 17);
  }

  /* ---------------- shared bits ---------------- */
  const seg = (k, row, label) => { const s = status(row);
    return `<div class="ae-seg" role="radiogroup" aria-label="${esc(label)} status">${[['on', 'Available'], ['all', 'All day'], ['off', 'Unavailable']].map(([v, t]) =>
      `<button type="button" role="radio" data-aest="${v}" aria-checked="${s === v}" class="${s === v ? 'on' : ''}">${s === v && v === 'on' ? '<i data-lucide="check"></i>' : ''}${t}</button>`).join('')}</div>`; };
  const slotIn = (i, a, b, label, rm) => `<span class="ae-slot"><input type="time" step="3600" data-aet="s" data-i="${i}" value="${hv(a)}" aria-label="${esc(label)} slot ${i + 1} start"><span class="to">to</span><input type="time" step="3600" data-aet="e" data-i="${i}" value="${hv(b)}" aria-label="${esc(label)} slot ${i + 1} end">${rm ? `<button type="button" class="ae-rm" data-aeact="rm" data-i="${i}" title="Remove this time slot" aria-label="Remove slot ${i + 1}"><i data-lucide="x"></i></button>` : ''}</span>`;
  const vsOf = (row, ref) => {
    if (!ref) return ['', ''];
    if (same(row, ref)) return ['Same', 'same'];
    const d = hrs(row) - hrs(ref);
    return d ? [`${d > 0 ? '+' : '−'}${Math.abs(d)}h`, d > 0 ? 'up' : 'dn'] : ['Moved', 'mv'];
  };
  function total(E) {
    const c = E.cfg; let n = 0, r = 0, hasRef = false;
    c.keys.forEach(({ k }) => { n += hrs(c.get(k)); const x = c.ref(k); if (x) { hasRef = true; r += hrs(x); } });
    const d = n - r;
    return `<div class="ae-total"><span>${esc(c.totalLabel || 'Weekly available hours')}</span><b>${n} hrs</b>${hasRef ? (d ? `<em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d)} hrs vs ${esc(c.refShort)}</em>` : `<em>same as ${esc(c.refShort)}</em>`) : ''}</div>`;
  }

  /* ---------------- 'time' — the table ---------------- */
  function timeRow(E, o) {
    const c = E.cfg, row = c.get(o.k), ref = c.ref(o.k), s = status(row), rs = ranges(row), chg = changed(c, o.k), on = E.sel.has(o.k);
    const label = LB.name(o), [vs, vc] = vsOf(row, ref), add = addSlot(row);
    return `<div class="ae-tr ${o.today ? 'today' : ''} ${chg ? 'chg' : ''} ${on ? 'sel' : ''}" data-aek="${o.k}">
      <label class="ae-ck"><input type="checkbox" data-aesel ${on ? 'checked' : ''} aria-label="Tick ${label}"></label>
      <div class="ae-day"><b>${label}${o.today ? ' <span class="ae-today">Today</span>' : ''}</b><small>${esc(LB.sub(o))}</small></div>
      ${seg(o.k, row, label)}
      <div class="ae-slots">${s === 'on' ? rs.map(([a, b], i) => slotIn(i, a, b, label, rs.length > 1)).join('') + `<button type="button" class="ae-add" data-aeact="add" ${add ? '' : 'disabled'} title="Add a time slot" aria-label="Add a time slot to ${label}"><i data-lucide="plus"></i></button>`
        : `<span class="ae-note">${s === 'all' ? '12:00 AM – Midnight' : 'Not available'}</span>`}</div>
      <b class="ae-tot">${hrs(row) ? hrs(row) + 'h' : '—'}</b>
      <div class="ae-bar">${ref ? ranges(ref).map(([a, b]) => `<i class="ref" style="left:${pct(a)};width:${pct(b - a)}"></i>`).join('') : ''}${rs.map(([a, b]) => `<b style="left:${pct(a)};width:${pct(b - a)}"></b>`).join('')}</div>
      <span class="ae-vs ${vc}">${vs}</span>
      <div class="ae-act">
        <button type="button" class="ae-ib" data-aeact="copy" title="${E.sel.size > 1 && on ? 'Copy to the other ticked days' : 'Copy to every day'}" aria-label="Copy ${label}"><i data-lucide="copy"></i></button>
        ${ref ? `<button type="button" class="ae-ib" data-aeact="reset" ${chg ? '' : 'disabled'} title="Back to your ${esc(c.refShort)}" aria-label="Reset ${label}"><i data-lucide="rotate-ccw"></i></button>` : ''}
      </div>
    </div>`;
  }
  function timeView(E) {
    const c = E.cfg, all = E.sel.size === c.keys.length;
    const two = c.keys.some(({ k }) => status(c.get(k)) === 'on' && ranges(c.get(k)).length > 1);
    return `<div class="ae ae-time ${two ? 'two' : ''}">
      <div class="ae-tbl">
        <div class="ae-th"><label class="ae-ck"><input type="checkbox" data-aeall ${all ? 'checked' : ''} aria-label="Tick every day"></label><span>Day</span><span>Status</span><span>Hours <em>(type or pick)</em></span><span>Total</span>
          <span class="ae-ticks"><em>12a</em><em>6a</em><em>12p</em><em>6p</em><em>12a</em></span><span>${c.refShort ? 'vs ' + esc(c.refShort) : ''}</span><span></span></div>
        ${c.keys.map(o => timeRow(E, o)).join('')}
      </div>
      <div class="ae-foot"><div class="ae-legend"><span><i class="sw av"></i>Available</span>${c.refShort ? `<span><i class="sw rf"></i>${esc(c.refLegend)}</span><span><span class="ae-tag">Changed</span>Differs from ${esc(c.refShort)}</span>` : ''}</div>${total(E)}</div>
    </div>`;
  }

  /* ---------------- 'drag' — timeline + side panel ---------------- */
  function blockLabel(a, b) { const n = b - a; return n >= 5 ? `${tLong(a)} – ${tLong(b)}` : n >= 2 ? `${tS(a)} – ${tS(b)}` : ''; }
  function dragRow(E, o) {
    const c = E.cfg, row = c.get(o.k), ref = c.ref(o.k), chg = changed(c, o.k), on = E.day === o.k, also = E.also.has(o.k);
    return `<div class="ae-lr ${on ? 'on' : ''} ${also ? 'also' : ''}" data-aek="${o.k}">
      <button type="button" class="ae-lbl" data-aeday="${o.k}" aria-pressed="${on}" title="Edit ${esc(LB.title(o))} · Shift-click to add it to “Also apply to”"><b>${esc(LB.short(o))}${o.today ? ' <span class="ae-today">Today</span>' : ''}</b><small>${LB.date(o)}${hrs(row) ? hrs(row) + 'h' : 'Off'}${chg ? ' · <em>Changed</em>' : ''}</small></button>
      <div class="ae-trk" data-aetrk="${o.k}">
        ${chg && ref ? ranges(ref).map(([a, b]) => `<i class="ae-rf" style="left:${pct(a)};width:${pct(b - a)}"></i>`).join('') : ''}
        ${ranges(row).map(([a, b]) => `<div class="ae-blk ${on && E.blk === a ? 'on' : ''}" data-aeblk="${a}" style="left:${pct(a)};width:${pct(b - a)}" title="${tLong(a)} – ${tLong(b)} · drag the edges to resize"><i class="ae-hd s" data-edge="s"></i><span>${blockLabel(a, b)}</span><i class="ae-hd e" data-edge="e"></i></div>`).join('')}
      </div>
    </div>`;
  }
  function panel(E) {
    const c = E.cfg, k = E.day, w = nameOf(E, k), row = c.get(k), ref = c.ref(k), s = status(row), rs = ranges(row), chg = changed(c, k);
    const others = [...E.also].filter(x => x !== k), order = c.keys.map(o => o.k);
    const targets = [k, ...others].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(x => LB.short(keyO(E, x)));
    const ko = keyO(E, k), T = LB.title(ko);
    const d = ref ? hrs(row) - hrs(ref) : 0;
    return `<aside class="ae-pnl" data-aek="${k}">
      <div class="ae-ph"><b>${esc(T)}</b>${ref ? `<button type="button" class="ae-link" data-aeact="reset" ${chg ? '' : 'disabled'}>Reset to ${esc(c.refShort)}</button>` : ''}</div>
      ${seg(k, row, T)}
      <div class="ae-lab">Time slots</div>
      ${s === 'on' ? `<div class="ae-pslots">${rs.map(([a, b], i) => slotIn(i, a, b, T, true)).join('')}</div>
        <button type="button" class="ae-addln" data-aeact="add" ${addSlot(row) ? '' : 'disabled'}><i data-lucide="plus"></i>Add time slot</button>`
        : `<p class="ae-note">${s === 'all' ? 'Available all day — 12:00 AM to Midnight.' : 'Not available this day. Pick <b>Available</b> or drag on the timeline to add hours.'}</p>`}
      <div class="ae-lab">Also apply to</div>
      <div class="ae-dchips" role="group" aria-label="Also apply to">${c.keys.map(o => `<button type="button" data-aealso="${o.k}" class="${o.k === k ? 'self' : E.also.has(o.k) ? 'on' : ''}" aria-pressed="${o.k === k || E.also.has(o.k)}" title="${esc(LB.title(o))}">${esc(LB.chip(o))}</button>`).join('')}</div>
      <button type="button" class="ae-apply" data-aeact="apply" ${others.length ? '' : 'disabled'}>${others.length ? `Apply to ${targets.join(', ')}` : 'Pick days to copy these hours to'}</button>
      ${ref ? `<div class="ae-cmp"><b>Compared with ${c.own === false ? 'the' : 'your'} ${esc(c.refShort)}</b>
        ${same(row, ref) ? '<span>No change</span>' : `<span>Was ${rtext(ref)} (${hrs(ref)}h)</span><span>Now ${rtext(row)} (${hrs(row)}h)${d ? ` · <em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d)}h</em>` : ''}</span>`}</div>` : ''}
    </aside>`;
  }
  function dragView(E) {
    const c = E.cfg;
    return `<div class="ae ae-drag">
      <div class="ae-tl">
        <div class="ae-tlh"><span></span><div class="ae-hrs">${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<em style="left:${pct(h)}">${tS(h)}</em>`).join('')}</div></div>
        <div class="ae-rows">${c.keys.map(o => dragRow(E, o)).join('')}</div>
        <div class="ae-hints"><span>Drag across empty hours to add</span><span>Drag a block’s edges to resize</span><span>Click a block to type exact times</span><span>Shift-click day names to edit several</span></div>
        <div class="ae-foot">${total(E)}</div>
      </div>
      ${panel(E)}
    </div>`;
  }

  /* ---------------- paint / commit ---------------- */
  function view(E) { return E.cfg.mode === 'drag' ? dragView(E) : timeView(E); }
  function paint(E) {
    E.el.innerHTML = view(E);
    const a = E.el.querySelector('[data-aeall]'); if (a) a.indeterminate = E.sel.size > 0 && E.sel.size < E.cfg.keys.length;
    icons();
  }
  function commit(E) {
    const ae = document.activeElement, key = ae && E.el.contains(ae) && ae.matches('[data-aet]') ? { k: ae.closest('[data-aek]').dataset.aek, t: ae.dataset.aet, i: ae.dataset.i } : null;
    E.cfg.onChange();
    if (key) { const n = E.el.querySelector(`[data-aek="${key.k}"] [data-aet="${key.t}"][data-i="${key.i}"]`); if (n) n.focus(); }
  }
  /* while someone types in a time box: refresh everything except that box */
  function soft(E) {
    const ae = document.activeElement, tmp = document.createElement('div'); tmp.innerHTML = view(E);
    if (E.cfg.mode === 'drag') {
      E.el.querySelector('.ae-tl').innerHTML = tmp.querySelector('.ae-tl').innerHTML;
      const p = E.el.querySelector('.ae-pnl'), np = tmp.querySelector('.ae-pnl');
      ['.ae-ph', '.ae-cmp', '.ae-apply'].forEach(s => { const a = p.querySelector(s), b = np.querySelector(s); if (a && b) a.outerHTML = b.outerHTML; });
    } else {
      E.el.querySelectorAll('.ae-tr').forEach(r => {
        const nr = tmp.querySelector(`.ae-tr[data-aek="${r.dataset.aek}"]`); if (!nr) return;
        if (!r.contains(ae)) { r.outerHTML = nr.outerHTML; return; }
        r.className = nr.className;
        ['.ae-tot', '.ae-bar', '.ae-vs', '.ae-act'].forEach(s => { r.querySelector(s).outerHTML = nr.querySelector(s).outerHTML; });
      });
      E.el.querySelector('.ae-foot').innerHTML = tmp.querySelector('.ae-foot').innerHTML;
    }
    icons();
  }

  /* ---------------- events (document level, once) ---------------- */
  const rootOf = t => { const r = t.closest && t.closest('[data-aved]'); return r ? st(r.dataset.aved) : null; };
  const keyOf = t => { const r = t.closest('[data-aek]'); return r ? r.dataset.aek : null; };
  document.addEventListener('click', e => {
    const t = e.target, E = rootOf(t); if (!E || !E.cfg) return;
    const c = E.cfg, k = keyOf(t);
    const q = t.closest('[data-aeq]');
    if (q) { const v = q.dataset.aeq; E.sel = new Set(v === 'clear' ? [] : c.keys.filter(o => v === 'all' || (v === 'wd' ? o.w >= 1 && o.w <= 5 : o.w === 0 || o.w === 6)).map(o => o.k)); return commit(E); }
    const sb = t.closest('[data-aest]');
    if (sb && k) { put(E, k, byStatus(E, k, sb.dataset.aest), true); return commit(E); }
    const dl = t.closest('[data-aeday]');
    if (dl) { const d = dl.dataset.aeday;
      if (e.shiftKey && d !== E.day) { E.also.has(d) ? E.also.delete(d) : E.also.add(d); }
      else { E.day = d; E.blk = null; E.also.delete(d); }
      return paint(E); }
    const al = t.closest('[data-aealso]');
    if (al) { const d = al.dataset.aealso; if (d !== E.day) { E.also.has(d) ? E.also.delete(d) : E.also.add(d); } return paint(E); }
    const b = t.closest('[data-aeact]'); if (!b || b.disabled) return;
    const act = b.dataset.aeact;
    if (act === 'resetall') { c.keys.forEach(o => { const r = c.ref(o.k); if (r) c.set(o.k, r.slice()); }); return commit(E); }
    if (!k) return;
    const row = c.get(k);
    if (act === 'rm') { const rs = ranges(row); rs.splice(+b.dataset.i, 1); put(E, k, fromRanges(rs), true); E.blk = null; }
    else if (act === 'add') { const r = addSlot(row); if (r) { put(E, k, r, true); const n = ranges(r).find(([a]) => !row[a]); if (n) E.blk = n[0]; } }
    else if (act === 'reset') { const r = c.ref(k); if (r) c.set(k, r.slice()); E.blk = null; }
    else if (act === 'copy') {
      const to = E.sel.size > 1 && E.sel.has(k) ? [...E.sel] : c.keys.map(o => o.k);
      to.forEach(o => { if (o !== k) c.set(o, row.slice()); });
      toast(`${LB.title(keyO(E, k))}’s hours copied to ${to.length === c.keys.length ? 'every day' : (to.length - 1) + ' more day' + (to.length > 2 ? 's' : '')}`);
    }
    else if (act === 'apply') { const n = E.also.size; E.also.forEach(o => c.set(o, row.slice())); E.also.clear(); toast(`Applied to ${n + 1} days`); }
    commit(E);
  });
  document.addEventListener('change', e => {
    const t = e.target, E = rootOf(t); if (!E || !E.cfg) return;
    const c = E.cfg;
    if (t.matches('[data-aeall]')) { E.sel = new Set(t.checked ? c.keys.map(o => o.k) : []); return commit(E); }
    if (t.matches('[data-aesel]')) { const k = keyOf(t); t.checked ? E.sel.add(k) : E.sel.delete(k); return commit(E); }
    if (t.matches('[data-aet]')) {
      const k = keyOf(t), h = parseT(t.value, t.dataset.aet === 'e'); if (h === null) return;
      put(E, k, setSlot(c.get(k), +t.dataset.i, t.dataset.aet, h), true);
      E.dirtyType = true; soft(E);
    }
  });
  /* leaving a time box: tidy the values (snap to the hour, start before end) and redraw */
  document.addEventListener('focusout', e => {
    const t = e.target; if (!t.matches || !t.matches('[data-aet]')) return;
    const E = rootOf(t); if (!E || !E.dirtyType) return;
    setTimeout(() => { if (!E.dirtyType) return; E.dirtyType = false; commit(E); }, 0);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-aet]')) { e.target.blur(); return; }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    Object.values(ED).forEach(E => {
      if (!E.cfg || E.cfg.mode !== 'drag' || E.blk === null || !E.el.isConnected || !E.el.offsetParent) return;
      const row = E.cfg.get(E.day), r = ranges(row).find(([a]) => a === E.blk); if (!r) return;
      e.preventDefault(); E.cfg.set(E.day, fill(row, r[0], r[1], false)); E.blk = null; commit(E);
    });
  });

  /* timeline: drag to add / resize */
  let D = null;
  const hourAt = (trk, x, round) => { const r = trk.getBoundingClientRect(), f = (x - r.left) / r.width * 24; return Math.max(0, Math.min(24, round ? Math.round(f) : Math.floor(f))); };
  const trkOf = (E, k) => E.el.querySelector(`[data-aetrk="${k}"]`);
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const trk = e.target.closest && e.target.closest('[data-aetrk]'); if (!trk) return;
    const E = rootOf(trk); if (!E || !E.cfg) return;
    const k = trk.dataset.aetrk, row = E.cfg.get(k), blk = e.target.closest('[data-aeblk]'), edge = e.target.closest('[data-edge]');
    e.preventDefault();
    if (E.day !== k) { E.also.delete(k); }
    E.day = k;
    if (blk) {
      const a = +blk.dataset.aeblk, r = ranges(row).find(([x]) => x === a);
      E.blk = a;
      D = edge ? { E, k, mode: edge.dataset.edge, a: r[0], b: r[1], snap: row.slice(), moved: false } : { E, k, mode: 'pick' };
    } else {
      const h = Math.min(23, hourAt(trk, e.clientX));
      D = { E, k, mode: 'add', anchor: h, snap: row.slice(), moved: true };
      E.cfg.set(k, fill(row, h, h + 1)); E.blk = ranges(E.cfg.get(k)).find(([a, b]) => h >= a && h < b)[0];
    }
    paint(E);
  });
  document.addEventListener('pointermove', e => {
    if (!D) return ghost(e);
    if (D.mode === 'pick') return;
    const E = D.E, trk = trkOf(E, D.k); if (!trk) return;
    let row;
    if (D.mode === 'add') {
      const h = Math.min(23, hourAt(trk, e.clientX)), lo = Math.min(D.anchor, h), hi = Math.max(D.anchor, h) + 1;
      row = fill(D.snap, lo, hi);
      E.blk = ranges(row).find(([a, b]) => D.anchor >= a && D.anchor < b)[0];
    } else {
      const h = hourAt(trk, e.clientX, true), base = fill(D.snap, D.a, D.b, false);
      const a = D.mode === 's' ? Math.min(h, D.b - 1) : D.a, b = D.mode === 'e' ? Math.max(h, D.a + 1) : D.b;
      row = fill(base, a, b);
      const keep = D.mode === 's' ? b - 1 : a;
      E.blk = ranges(row).find(([x, y]) => keep >= x && keep < y)[0];
    }
    if (same(row, E.cfg.get(D.k))) return;
    D.moved = true; E.cfg.set(D.k, row); paint(E);
  });
  const endDrag = () => { if (!D) return; const d = D; D = null; if (d.moved) commit(d.E); };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  /* "Drag to add" hint under the pointer on empty hours */
  function ghost(e) {
    const old = document.querySelector('.ae-ghost');
    const trk = e.target.closest && e.target.closest('[data-aetrk]');
    if (!trk || e.target.closest('[data-aeblk]')) { if (old) old.remove(); return; }
    const E = rootOf(trk); if (!E || !E.cfg) return;
    const row = E.cfg.get(trk.dataset.aetrk), h = Math.min(23, hourAt(trk, e.clientX));
    if (row[h]) { if (old) old.remove(); return; }
    let b = h; while (b < 24 && b < h + 3 && !row[b]) b++;
    const g = old && old.parentNode === trk ? old : (old && old.remove(), trk.appendChild(Object.assign(document.createElement('div'), { className: 'ae-ghost' })));
    g.style.left = pct(h); g.style.width = pct(b - h); g.textContent = b - h >= 3 ? 'Drag to add' : '+';
  }
  const toast = t => { if (typeof window.showToast === 'function') window.showToast(t, 'success'); };

  /* read-only timeline — same look as the Drag view; hours listed in the last column */
  function viewHTML(c) {
    const fmtR = row => ranges(row).map(([a, b]) => `${tS(a)}–${tS(b)}`).join(', ') || 'Unavailable';
    /* c.dateRows: label = day + date ("27 Nov · Today"); hours column = "8 hrs / −3h vs regular" */
    const diffTx = (row, ref) => { if (!ref) return ''; if (same(row, ref)) return 'same as ' + esc(c.refShort); const d = hrs(row) - hrs(ref); return d ? `${d > 0 ? '+' : '−'}${Math.abs(d)}h vs ${esc(c.refShort)}` : 'different times'; };
    return `<div class="ae ae-view ${c.tone ? 'tone-' + c.tone : ''} ${c.flat ? 'flat' : ''}">
      <div class="ae-tlh"><span class="ae-vh">${esc(c.dayHead || '')}</span><div class="ae-hrs">${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<em style="left:${pct(h)}">${tS(h)}</em>`).join('')}</div><span class="ae-vh">${esc(c.sumHead || 'Your hours')}</span></div>
      <div class="ae-rows">${c.keys.map(o => { const row = c.get(o.k), ref = c.ref(o.k), chg = !!ref && !same(row, ref);
        if (c.dateRows) return `<div class="ae-lr ${o.today ? 'today' : ''}" data-aek="${o.k}">
          <div class="ae-lbl"><b>${esc(LB.short(o))}</b><small>${esc(o.date || '')}${o.today ? ' · Today' : ''}</small></div>
          <div class="ae-trk ro">${ref ? ranges(ref).map(([a, b]) => `<i class="ae-rf" style="left:${pct(a)};width:${pct(b - a)}"></i>`).join('') : ''}${ranges(row).map(([a, b]) => `<div class="ae-blk" style="left:${pct(a)};width:${pct(b - a)}" title="${tLong(a)} – ${tLong(b)}"><span>${blockLabel(a, b)}</span></div>`).join('')}</div>
          <div class="ae-vsum"><b>${hrs(row) ? hrs(row) + ' hrs' : 'Off'}</b><small class="${chg ? 'chg' : ''}">${diffTx(row, ref)}</small></div>
        </div>`;
        // day label only (hours are already in the "Your hours" column); keeps the date / "Changed" note when there is one
        const sub = [o.date || '', chg ? '<em>Changed</em>' : ''].filter(Boolean).join(' · ');
        return `<div class="ae-lr" data-aek="${o.k}">
          <div class="ae-lbl"><b>${esc(LB.short(o))}${o.today ? ' <span class="ae-today">Today</span>' : ''}</b>${sub ? `<small>${sub}</small>` : ''}</div>
          <div class="ae-trk ro">${chg ? ranges(ref).map(([a, b]) => `<i class="ae-rf" style="left:${pct(a)};width:${pct(b - a)}"></i>`).join('') : ''}${ranges(row).map(([a, b]) => `<div class="ae-blk" style="left:${pct(a)};width:${pct(b - a)}" title="${tLong(a)} – ${tLong(b)}"><span>${blockLabel(a, b)}</span></div>`).join('')}</div>
          <div class="ae-vsum"><b>${fmtR(row)}</b><small>${hrs(row)} hrs${chg ? ` · ${hrs(row) - hrs(ref) > 0 ? '+' : hrs(row) - hrs(ref) < 0 ? '−' : ''}${hrs(row) - hrs(ref) ? Math.abs(hrs(row) - hrs(ref)) + ' vs ' + esc(c.refShort) : 'different times'}` : ''}</small></div>
        </div>`; }).join('')}</div>
    </div>`;
  }

  /* ---------------- API ---------------- */
  window.AVED = {
    viewHTML,
    mount(el, id, cfg) {
      const E = st(id); E.el = el; E.cfg = cfg;
      if (!E.day || !cfg.keys.some(o => o.k === E.day)) E.day = cfg.keys[0].k;
      el.dataset.aved = id; paint(E);
    },
    reset(id) { ED[id] = { sel: new Set(), day: null, blk: null, also: new Set() }; },
    toolsHTML(id, cfg) {
      const E = st(id), any = cfg.keys.some(({ k }) => changed(cfg, k));
      const chip = (v, t) => { const on = v === 'clear' ? false : cfg.keys.filter(o => v === 'all' || (v === 'wd' ? o.w >= 1 && o.w <= 5 : o.w === 0 || o.w === 6)).map(o => o.k);
        const act = on && on.length === E.sel.size && on.every(k => E.sel.has(k));
        return `<button type="button" data-aeq="${v}" class="${act ? 'on' : ''}">${t}</button>`; };
      return `<div class="ae-tools" data-aved="${id}">
        ${cfg.mode === 'time' ? `<span class="ae-sl">Select</span>${chip('all', 'All days')}${chip('wd', 'Weekdays')}${chip('we', 'Weekends')}${chip('clear', 'Clear')}<span class="ae-sep"></span>
          <span class="ae-hint">Type times in any row, or tick several days to give them the same hours in one go.</span>`
          : `<span class="ae-hint">Click a day or a block to edit it in the panel on the right. Minutes snap to the hour.</span>`}
        ${cfg.refShort ? `<button type="button" class="ae-link" data-aeact="resetall" ${any ? '' : 'disabled'}><i data-lucide="rotate-ccw"></i>Reset to ${esc(cfg.refShort)}</button>` : ''}
      </div>`;
    },
  };
})();
