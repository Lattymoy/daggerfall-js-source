// AUDIT INV2 - A DOM JUST REAL ENOUGH TO DRIVE A DRAG.
//
// The INV2 pins were sixty lines of greps over the module's own source
// text, and a lens proved what that is worth: DELETING THE ghostStart
// CALL left the whole suite green. Every assertion matched a
// declaration that still existed. A pin over a definition is not a pin
// over a feature.
//
// So the gesture is DRIVEN. This is the smallest document the pane's
// drag needs - element creation, classes, a tree, `closest`, a
// queryable root, an injectable `elementFromPoint`, and the WINDOW
// listeners the drag now lives on - and it is enough to press a row,
// move a pointer, read the ghost off document.body, and see what
// actually moved.
export function fakeDom({ w = 1280, h = 800 } = {}) {
  const listeners = new Map();
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), children: [], parent: null, style: {}, dataset: {}, attrs: {},
      className: '', textContent: '', title: '', type: '', disabled: false,
      onclick: null, onpointerdown: null, onpointermove: null, onpointerup: null, onpointercancel: null,
      scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      classList: {
        add: (...c) => { const s = new Set(n.className.split(/\s+/).filter(Boolean)); for (const x of c) s.add(x); n.className = [...s].join(' '); },
        remove: (...c) => { const s = new Set(n.className.split(/\s+/).filter(Boolean)); for (const x of c) s.delete(x); n.className = [...s].join(' '); },
        contains: (c) => n.className.split(/\s+/).includes(c),
        toggle: (c, on) => (on ? n.classList.add(c) : n.classList.remove(c)),
        // PLUS-DEFAULT / PLUS9: the Plus pack swaps a class in one call, as the DOM's own does
        replace: (a, b) => { if (!n.classList.contains(a)) return false; n.classList.remove(a); n.classList.add(b); return true; },
      },
      append(...cs) { for (const c of cs) { if (c == null) continue; c.parent = n; n.children.push(c); } },
      appendChild(c) { n.append(c); return c; },
      remove() { const i = n.parent?.children.indexOf(n) ?? -1; if (i >= 0) n.parent.children.splice(i, 1); n.parent = null; },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      getAttribute(k) { return n.attrs[k] ?? null; },
      addEventListener() {}, removeEventListener() {},
      setPointerCapture() {}, releasePointerCapture() {},
      focus() {},
      get innerHTML() { return ''; },
      set innerHTML(_v) { for (const c of [...n.children]) c.parent = null; n.children.length = 0; },
      closest(sel) { for (let p = n; p; p = p.parent) if (matches(p, sel)) return p; return null; },
      querySelector(sel) { return all(n).find((x) => matches(x, sel)) ?? null; },
      querySelectorAll(sel) { return all(n).filter((x) => matches(x, sel)); },
      getBoundingClientRect() { return { left: 0, top: 0, right: w, bottom: h, width: w, height: h }; },
    };
    return n;
  };
  const all = (n) => { const out = []; const walk = (x) => { for (const c of x.children) { out.push(c); walk(c); } }; walk(n); return out; };
  /** One selector, the shapes this pane actually writes: `.a`, `.a.b`, `tag`, and a comma list. */
  const matches = (n, sel) => String(sel).split(',').some((one) => {
    const s = one.trim();
    if (!s) return false;
    const tag = /^[a-zA-Z]+/.exec(s)?.[0];
    if (tag && n.tagName !== tag.toUpperCase()) return false;
    const cls = [...s.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    return cls.every((c) => n.classList.contains(c));
  });
  const body = mk('body');
  const head = mk('head');
  const doc = {
    body,
    head,
    getElementById: () => null,
    createElement: mk,
    createElementNS: (_ns, t) => mk(t),
    querySelector: (s) => body.querySelector(s),
    querySelectorAll: (s) => body.querySelectorAll(s),
    elementFromPoint: () => null,   // the test says what is under the pointer
    addEventListener() {}, removeEventListener() {},
  };
  // INV3: AND THE THIRD ARGUMENT IS PART OF THE FEATURE. A window
  // `touchmove` listener is PASSIVE by default in Chromium, so a drag
  // that holds the gesture with `preventDefault` is doing nothing at
  // all unless it registered with `{ passive: false }`. That is a fact
  // about the registration and not about the handler, so the options
  // are kept beside the listener and `opts(t)` hands them back - pinning
  // it by grepping the source is the thing AUDIT INV2 exists to stop.
  const options = new Map();
  const at = (t) => { if (!listeners.has(t)) { listeners.set(t, []); options.set(t, []); } return listeners.get(t); };
  const win = {
    addEventListener: (t, fn, o) => { at(t).push(fn); options.get(t).push(o); },
    removeEventListener: (t, fn) => { const a = listeners.get(t); const i = a?.indexOf(fn) ?? -1; if (i >= 0) { a.splice(i, 1); options.get(t).splice(i, 1); } },
    fire: (t, e) => { for (const fn of [...(listeners.get(t) ?? [])]) fn(e); },
    count: (t) => (listeners.get(t) ?? []).length,
    opts: (t) => [...(options.get(t) ?? [])],
  };
  return { doc, win, body, mk, all, matches, w, h };
}

/** Install a fake document + window listeners for the length of `fn`. */
export function withDom(fn, opts = {}) {
  const dom = fakeDom(opts);
  const saved = {
    doc: globalThis.document, hadDoc: 'document' in globalThis,
    add: globalThis.addEventListener, rem: globalThis.removeEventListener,
    raf: globalThis.requestAnimationFrame, iw: globalThis.innerWidth, ih: globalThis.innerHeight,
  };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.innerWidth = dom.w;
  globalThis.innerHeight = dom.h;
  try { return fn(dom); } finally {
    if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.rem;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.innerWidth = saved.iw;
    globalThis.innerHeight = saved.ih;
  }
}
