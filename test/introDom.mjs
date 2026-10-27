// TITLE-DOOR (2026-10-27): a page small enough to hold the film (src/ui/intro/introScreen.js runIntro) and drive it the
// way a browser does - its nodes, clicks that bubble, a window whose frames and timers the test turns by hand, and no
// WebGL (the film's own ground stands, as on a machine without it). Nothing global: every page is the test's own.
class El {
  constructor(doc, tag) {
    this.doc = doc; this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.style = {}; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.className = ''; this.id = '';
    this.hidden = false; this.disabled = false; this.inert = false; this.textContent = '';
  }
  get classList() {
    const n = this, list = () => n.className.split(/\s+/).filter(Boolean);
    return { add: (c) => { if (!list().includes(c)) n.className = [...list(), c].join(' '); }, remove: (c) => { n.className = list().filter((x) => x !== c).join(' '); }, contains: (c) => list().includes(c) };
  }
  append(...nodes) { for (const n of nodes) { if (typeof n === 'string') continue; n.remove(); n.parentNode = this; this.children.push(n); } }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.doc.documentElement; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); }
  /** A click (or any event) at this node, bubbling through its ancestors as a browser's does. */
  dispatch(type, extra = {}) {
    const ev = { type, target: this, stopPropagation() {}, preventDefault() {}, stopImmediatePropagation() {}, ...extra };
    for (let n = this; n; n = n.parentNode) for (const f of [...(n.listeners[type] ?? [])]) f(ev);
    return ev;
  }
  matches(sel) {
    const [base, not] = sel.split(':not(');
    if (not?.startsWith(':disabled') && this.disabled) return false;
    if (base.startsWith('.')) return this.classList.contains(base.slice(1));
    if (base.startsWith('#')) return this.id === base.slice(1);
    return this.tagName === base.toUpperCase();
  }
  closest(sel) { for (let n = this; n; n = n.parentNode) if (n.matches?.(sel)) return n; return null; }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  focus() { this.doc.activeElement = this; }
  animate(keyframes, options) { this.faded = [keyframes, options]; }   // the Web Animations call, kept to be read
  getContext() { return null; }   // no WebGL: the film's ground and its mark, no map
  decode() { return Promise.resolve(); }   // a picture decodes at once
  get naturalWidth() { return 1; }
}

/** A page and its window. `frame()` runs the animation frames asked for so far; `timers()` the timeouts; `fire(type)`
 *  a window event (capture listeners - the film's own and the duck's). */
export function introPage() {
  const doc = { activeElement: null, hidden: false, listeners: {} };
  doc.createElement = (tag) => new El(doc, tag);
  doc.documentElement = new El(doc, 'html');
  doc.head = new El(doc, 'head'); doc.body = new El(doc, 'body');
  doc.documentElement.append(doc.head, doc.body);
  doc.getElementById = (id) => doc.documentElement.querySelector(`#${id}`);
  doc.addEventListener = (t, f) => { (doc.listeners[t] ??= []).push(f); };
  doc.removeEventListener = (t, f) => { doc.listeners[t] = (doc.listeners[t] ?? []).filter((x) => x !== f); };
  let nextId = 1;
  const frames = new Map(), timeouts = new Map(), listeners = {};
  const win = {
    listeners,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (f) => { const id = nextId++; frames.set(id, f); return id; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
    setTimeout: (f) => { const id = nextId++; timeouts.set(id, f); return id; },
    clearTimeout: (id) => { timeouts.delete(id); },
    addEventListener: (t, f) => { (listeners[t] ??= []).push(f); },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] ?? []).filter((x) => x !== f); },
  };
  doc.defaultView = win;
  let stamp = 0;
  return {
    doc, win,
    /** how many animation frames are waiting */
    get pending() { return frames.size; },
    frame() { const due = [...frames.values()]; frames.clear(); stamp += 16.7; for (const f of due) f(stamp); return due.length; },
    timers() { const due = [...timeouts.values()]; timeouts.clear(); for (const f of due) f(); return due.length; },
    fire(type, extra = {}) { const ev = { type, target: doc.body, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra }; for (const f of [...(listeners[type] ?? [])]) f(ev); return ev; },
    /** a stand-in for the menu runEnhancedMenu mounts: #enhanced-menu with a door in it */
    mountMenu() {
      const menu = doc.createElement('div'); menu.id = 'enhanced-menu';
      const door = doc.createElement('button'); door.className = 'doorbtn door-online'; menu.append(door);
      doc.body.append(menu);
      return menu;
    },
  };
}

/** A theme that records what is asked of it - the IntroTheme calls the film and the front door make. */
export function fakeTheme({ time = 0 } = {}) {
  const calls = [];
  return {
    calls, source: null, disposed: false, context: null, level: 1, now: time,
    time() { return this.now; },
    unlock() { calls.push('unlock'); return Promise.resolve(true); },
    prepare() { calls.push('prepare'); return Promise.resolve(true); },
    setLevel(level, seconds) { this.level = level; calls.push(['setLevel', level, seconds]); },
    start() { calls.push('start'); this.source ??= {}; this.context = { state: 'running' }; return true; },
    async pause() {},
    async dispose() { this.disposed = true; calls.push('dispose'); },
  };
}

export const settle = () => new Promise((r) => setImmediate(r));
