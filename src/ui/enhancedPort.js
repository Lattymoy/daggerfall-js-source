// PORT2: THE ENHANCED PORT - a classic window, worn in the enhanced skin.
//
// THE PROBLEM. The service windows (the guild's and the coven's menus,
// the bank, the house and ship lists, the transport picker, the daedra's
// offer, and the three makers) were only ever canvas windows: DFU's art
// at 320x200, drawn under BOTH skins. Rewriting each as a DOM window
// would mean rewriting its LOGIC too - the bank's transaction ladder,
// the enchanter's picker chain, the spell maker's cost law - and every
// one of those is ported line for line from DFU with its own tests.
//
// THE SHAPE HERE. The classic window is kept WHOLE and wrapped. The
// wrapper is a Proxy the host holds in the window's place, so every
// field, getter and method the host or the window's own hooks touch is
// the real window's. Three things are the wrapper's own:
//
//   draw     the classic draw still RUNS, every frame, but onto a quiet
//            renderer that paints nothing - so its sub-steps take their
//            own enhanced faces exactly as they do everywhere (a Yes/No
//            box -> the decision box, a click-anywhere box -> the notice
//            panel, a text field -> the input box, a list -> the
//            enhanced list), and the layouts a click is hit-tested
//            against are still made. Then the port draws ITS window:
//            the spec turns the live window into a small view model
//            (title, readouts, buttons, lists, fields) and the DOM is
//            rebuilt only when that model changes.
//   done     reading it also takes the DOM down when the window is done.
//   dispose  the same, then the window's own.
//
// A press in the DOM calls what the spec says - almost always the
// window's own click(vx, vy) at the classic button's centre, so the
// window's own sound, guard and order all run, or the window's own
// method where the classic hit-test is a grid of item slots. The
// KEYBOARD never passes through here: the host routes keys to the
// window as it always has, so every hotkey and Y/N still works.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

/** A renderer that paints nothing and answers the canvas. */
export function quietRenderer(renderer) {
  const noop = () => undefined;
  return new Proxy(renderer ?? {}, {
    get(t, k) {
      if (k === 'canvas') return t.canvas;
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? noop : v;
    },
  });
}

/** How long after its last draw a port is taken to be gone (ms). A
 *  window pushed under another stops drawing; it comes back when the
 *  top one closes, and the port mounts again. */
export const PORT_WATCHDOG_MS = 250;

const el = (doc, tag, cls, text) => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The native-coordinate centre of a panel-relative rect. */
export const centreOf = ([x, y, w, h], ox = 0, oy = 0) => [ox + x + w / 2, oy + y + h / 2];

// ── THE VIEW -> DOM ────────────────────────────────────────────────
// A view is plain data: { title, sub, size, blocks: [...], foot: [...] }.
// Every actionable thing carries `act`, a function; the DOM carries its
// index into the flat list of the view's acts, so a press always runs
// the LATEST view's function for that slot.

function buttonNode(doc, b, acts, extra = '') {
  const n = el(doc, 'button', `act port-btn${b.primary ? ' primary' : ''}${b.on ? ' on' : ''}${extra}`);
  n.type = 'button';
  n.tabIndex = -1;
  if (b.key) n.append(el(doc, 'span', 'dlg-key', b.key));
  n.append(el(doc, 'span', 'port-btnlabel', b.label));
  if (b.disabled) n.disabled = true;
  if (b.act && !b.disabled) n.dataset.a = String(acts.push(b.act) - 1);
  if (b.title) n.title = b.title;
  return n;
}

function tileNode(doc, t, acts) {
  const n = el(doc, t.act && !t.disabled ? 'button' : 'div', `port-tile${t.on ? ' on' : ''}${t.disabled ? ' off' : ''}${t.wide ? ' wide' : ''}`);
  if (n.tagName === 'BUTTON') { n.type = 'button'; n.tabIndex = -1; n.dataset.a = String(acts.push(t.act) - 1); }
  const pic = el(doc, 'span', 'port-pic');
  if (t.icon) { const img = el(doc, 'img'); img.src = t.icon; img.alt = ''; pic.append(img); }
  else pic.textContent = (t.label ?? '').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  n.append(pic);
  if (t.showLabel) {
    const words = el(doc, 'span', 'port-tilewords');
    words.append(el(doc, 'span', 'port-tilename', t.label));
    if (t.sub) words.append(el(doc, 'span', 'port-tilesub', t.sub));
    n.append(words);
  }
  if (t.badge != null && t.badge !== '') n.append(el(doc, 'span', 'port-badge', String(t.badge)));
  n.title = t.sub ? `${t.label} - ${t.sub}` : (t.label ?? '');
  return n;
}

function blockNode(doc, b, acts, canvases) {
  switch (b.type) {
    case 'stats': {
      const n = el(doc, 'dl', 'port-stats');
      for (const [k, v, cls] of b.items) {
        const row = el(doc, 'div', `port-stat${cls ? ` ${cls}` : ''}`);
        row.append(el(doc, 'dt', null, k), el(doc, 'dd', null, v == null || v === '' ? '-' : String(v)));
        n.append(row);
      }
      return n;
    }
    case 'heading': return el(doc, 'h3', 'port-heading', b.text);
    case 'text': {
      const n = el(doc, 'div', `port-text${b.center ? ' center' : ''}`);
      for (const r of b.rows) n.append(el(doc, 'p', null, typeof r === 'string' ? r : (r?.text ?? '')));
      return n;
    }
    case 'actions': {
      const n = el(doc, 'div', `port-actions ${b.layout ?? 'column'}`);
      for (const it of b.items) n.append(buttonNode(doc, it, acts));
      return n;
    }
    case 'chips': {
      const n = el(doc, 'div', 'port-chiprow');
      if (b.label) n.append(el(doc, 'span', 'port-chiplabel', b.label));
      const set = el(doc, 'div', 'port-chips');
      for (const it of b.items) {
        const c = buttonNode(doc, it, acts, ' port-chip');
        if (it.icon) { const img = el(doc, 'img', 'port-chipicon'); img.src = it.icon; img.alt = ''; c.prepend(img); }
        set.append(c);
      }
      n.append(set);
      return n;
    }
    case 'tiles': {
      const n = el(doc, 'div', 'port-tiles-wrap');
      if (b.title) n.append(el(doc, 'h3', 'port-heading', b.title));
      const grid = el(doc, 'div', `port-tiles${b.list ? ' list' : ''} port-scroll`);
      grid.dataset.scrollKey = b.key ?? b.title ?? 'tiles';
      if (b.maxHeight) grid.style.maxHeight = `${b.maxHeight}px`;
      if (!b.items.length) grid.append(el(doc, 'p', 'port-empty', b.empty ?? 'Nothing here.'));
      for (const t of b.items) grid.append(tileNode(doc, { ...t, showLabel: b.list || t.showLabel }, acts));
      n.append(grid);
      return n;
    }
    case 'rows': {
      const n = el(doc, 'div', 'port-rows-wrap');
      if (b.title) n.append(el(doc, 'h3', 'port-heading', b.title));
      const list = el(doc, 'div', 'port-rows port-scroll');
      list.dataset.scrollKey = b.key ?? b.title ?? 'rows';
      if (b.maxHeight) list.style.maxHeight = `${b.maxHeight}px`;
      if (!b.items.length) list.append(el(doc, 'p', 'port-empty', b.empty ?? 'Nothing here.'));
      for (const r of b.items) {
        const row = el(doc, r.act && !r.disabled ? 'button' : 'div', `port-row${r.on ? ' on' : ''}${r.muted ? ' muted' : ''}`);
        if (row.tagName === 'BUTTON') { row.type = 'button'; row.tabIndex = -1; row.dataset.a = String(acts.push(r.act) - 1); }
        row.append(el(doc, 'span', 'port-rowmark', '\u25c6'));
        const words = el(doc, 'span', 'port-rowwords');
        words.append(el(doc, 'span', 'port-rowname', r.label));
        if (r.sub) words.append(el(doc, 'span', 'port-rowsub', r.sub));
        row.append(words);
        if (r.value != null) row.append(el(doc, 'span', 'port-rowvalue', String(r.value)));
        if (r.hint) row.title = r.hint;
        list.append(row);
      }
      n.append(list);
      return n;
    }
    case 'field': {
      const n = el(doc, 'div', `port-fieldrow${b.active ? ' active' : ''}`);
      if (b.label) n.append(el(doc, 'span', 'port-fieldlabel', b.label));
      const f = el(doc, 'span', 'port-field');
      f.append(el(doc, 'span', 'port-fieldvalue', b.value || (b.active ? '' : (b.placeholder ?? ''))));
      if (b.active) f.append(el(doc, 'span', 'port-caret', '_'));
      n.append(f);
      if (b.button) n.append(buttonNode(doc, b.button, acts));
      return n;
    }
    case 'spinner': {
      const n = el(doc, 'div', `port-spin${b.disabled ? ' off' : ''}`);
      n.append(el(doc, 'span', 'port-spinlabel', b.label));
      n.append(buttonNode(doc, { label: '\u2212', act: b.down, disabled: b.disabled }, acts, ' port-spinbtn'));
      n.append(el(doc, 'span', 'port-spinvalue', b.disabled ? '-' : String(b.value)));
      n.append(buttonNode(doc, { label: '+', act: b.up, disabled: b.disabled }, acts, ' port-spinbtn'));
      return n;
    }
    case 'group': {
      const n = el(doc, 'section', `port-group${b.cls ? ` ${b.cls}` : ''}`);
      if (b.title) n.append(el(doc, 'h3', 'port-heading', b.title));
      for (const c of b.blocks) if (c) n.append(blockNode(doc, c, acts, canvases));
      return n;
    }
    case 'cols': {
      const n = el(doc, 'div', `port-cols${b.cls ? ` ${b.cls}` : ''}`);
      n.style.setProperty('--port-cols', b.template ?? `repeat(${b.cols.length}, minmax(0, 1fr))`);
      for (const col of b.cols) {
        const c = el(doc, 'div', 'port-col');
        for (const x of col) if (x) c.append(blockNode(doc, x, acts, canvases));
        n.append(c);
      }
      return n;
    }
    case 'picture': {
      const n = el(doc, 'div', `port-picture${b.cls ? ` ${b.cls}` : ''}`);
      if (b.src) { const img = el(doc, 'img'); img.src = b.src; img.alt = b.alt ?? ''; n.append(img); }
      else n.append(el(doc, 'span', 'port-pictureword', b.alt ?? ''));
      return n;
    }
    case 'canvas': {
      const n = el(doc, 'div', 'port-screen');
      const cv = el(doc, 'canvas', 'port-canvas');
      n.append(cv);
      canvases.push({ cv, paint: b.paint });
      return n;
    }
    case 'iconGrid': {
      const n = el(doc, 'div', 'port-icongrid port-scroll');
      n.dataset.scrollKey = b.key ?? 'icons';
      for (const it of b.items) {
        const c = el(doc, 'button', `port-iconcell${it.on ? ' on' : ''}`);
        c.type = 'button'; c.tabIndex = -1;
        c.dataset.a = String(acts.push(it.act) - 1);
        if (it.icon) { const img = el(doc, 'img'); img.src = it.icon; img.alt = ''; c.append(img); }
        else c.append(el(doc, 'span', 'port-iconnum', String(it.label ?? '')));
        c.title = it.title ?? '';
        n.append(c);
      }
      return n;
    }
    default: return null;
  }
}

/** The part of a view that decides its DOM (functions dropped, canvases
 *  are live and never part of it). */
const viewSig = (view) => JSON.stringify(view, (k, v) => (typeof v === 'function' ? undefined : v));

/**
 * Wrap `win` so it wears the enhanced skin. `spec.view(win)` returns
 * the view model; `spec.kind` names the port for its CSS hooks.
 */
export function portWindow(win, spec, doc = globalThis.document) {
  let host = null, winEl = null, body = null, sig = '', acts = [], canvases = [], watchdog = null;
  const scrolls = new Map();

  const unmount = () => {
    clearTimeout(watchdog);
    watchdog = null;
    if (!host) return;
    try { host.remove(); } catch { /* gone */ }
    host = null; winEl = null; body = null; sig = ''; acts = []; canvases = [];
  };

  const mount = () => {
    injectEnhancedStyle(doc);
    injectEnhancedFonts(doc);
    host = el(doc, 'div', `port-host port-${spec.kind}`);
    const shell = el(doc, 'div', 'px-home px-over port-shell');
    winEl = el(doc, 'section', 'px-win port-win');
    winEl.setAttribute('role', 'dialog');
    body = el(doc, 'div', 'port-inner');
    winEl.append(body);
    shell.append(winEl);
    host.append(shell);
    // one listener for every press: the index is the latest view's act
    host.addEventListener('pointerdown', (e) => { if (e.target.closest?.('button')) e.preventDefault(); e.stopPropagation(); });
    host.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-a]');
      e.stopPropagation();
      if (!b || b.disabled) return;
      const fn = acts[Number(b.dataset.a)];
      if (typeof fn === 'function') fn();
    });
    host.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    doc.body.append(host);
  };

  const render = (view) => {
    for (const s of body.querySelectorAll('[data-scroll-key]')) scrolls.set(s.dataset.scrollKey, s.scrollTop);
    body.replaceChildren();
    acts = [];
    canvases = [];
    winEl.className = `px-win port-win size-${view.size ?? 'medium'}`;
    const head = el(doc, 'header', 'port-head');
    const titles = el(doc, 'div', 'port-titles');
    titles.append(el(doc, 'h2', 'port-title', view.title ?? ''));
    if (view.sub) titles.append(el(doc, 'span', 'port-sub', view.sub));
    head.append(titles);
    const main = el(doc, 'div', 'port-body');
    for (const b of view.blocks ?? []) { const n = b && blockNode(doc, b, acts, canvases); if (n) main.append(n); }
    body.append(head, main);
    if (view.foot?.length) {
      const foot = el(doc, 'footer', 'port-foot');
      for (const f of view.foot) foot.append(buttonNode(doc, f, acts));
      body.append(foot);
    }
    for (const s of body.querySelectorAll('[data-scroll-key]')) {
      const v = scrolls.get(s.dataset.scrollKey);
      if (v) s.scrollTop = v;
    }
  };

  /** The acts of the latest view, in the order render() numbered them. */
  const collectActs = (view) => {
    const out = [];
    const walk = (b) => {
      if (!b) return;
      switch (b.type) {
        case 'actions': case 'chips': for (const it of b.items) if (it.act && !it.disabled) out.push(it.act); return;
        case 'tiles': for (const t of b.items) if (t.act && !t.disabled) out.push(t.act); return;
        case 'rows': for (const r of b.items) if (r.act && !r.disabled) out.push(r.act); return;
        case 'field': if (b.button?.act && !b.button.disabled) out.push(b.button.act); return;
        case 'spinner': if (!b.disabled) { if (b.down) out.push(b.down); if (b.up) out.push(b.up); } return;
        case 'iconGrid': for (const it of b.items) out.push(it.act); return;
        case 'group': for (const c of b.blocks) walk(c); return;
        case 'cols': for (const col of b.cols) for (const c of col) walk(c); return;
        default:
      }
    };
    for (const b of view.blocks ?? []) walk(b);
    for (const f of view.foot ?? []) if (f.act && !f.disabled) out.push(f.act);
    return out;
  };

  const draw = (renderer, canvas, font, ...rest) => {
    try { win.draw(quietRenderer(renderer), canvas, font, ...rest); } catch (e) { console.warn(`[port] ${spec.kind}: the classic draw threw`, e); }
    if (win.done) { unmount(); return; }
    let view = null;
    try { view = spec.view(proxy); } catch (e) { console.warn(`[port] ${spec.kind}: the view threw`, e); }
    if (!view) { unmount(); return; }
    if (!host) mount();
    const s = viewSig(view);
    if (s !== sig) { sig = s; render(view); } else acts = collectActs(view);
    for (const c of canvases) { try { c.paint?.(c.cv); } catch { /* a live picture never takes the window down */ } }
    clearTimeout(watchdog);
    watchdog = setTimeout(unmount, PORT_WATCHDOG_MS);
  };

  const proxy = new Proxy(win, {
    get(t, k, r) {
      if (k === 'draw') return draw;
      if (k === 'done') { const d = Reflect.get(t, k, r); if (d) unmount(); return d; }
      if (k === 'dispose') return (...a) => { unmount(); return t.dispose?.apply(r, a); };
      if (k === '__port') return spec.kind;
      return Reflect.get(t, k, r);
    },
  });
  return proxy;
}
