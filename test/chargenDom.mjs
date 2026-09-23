// DISC10 (2026-09-23): a minimal DOM, enough to mount the enhanced chargen wizard and drive it as a browser does -
// window capture listeners first, then the focused element's own handler. Imported for its side effect (globals).
class Node_ {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.style = {}; this.attrs = {}; this.listeners = {}; this._text = ''; this.className = ''; this.scrollTop = 0; this.scrollLeft = 0; this.disabled = false; this.value = ''; }
  append(...ns) { for (const n of ns) { if (typeof n === 'string') n = new Text_(n); n.parentNode = this; this.children.push(n); } }
  appendChild(n) { this.append(n); return n; }
  prepend(...ns) { this.children.unshift(...ns.map((n) => (n.parentNode = this, n))); }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } }
  set textContent(t) { this.children = []; this._text = String(t); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set innerHTML(v) { this.children = []; this._text = ''; }
  setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (c instanceof Node_) { out.push(c); walk(c); } } }; walk(this); return sel === '*' ? out : out.filter((n) => matches(n, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  focus() { globalThis.document.activeElement = this; }
  blur() {}
  click() { this.dispatch('click', {}); }
  dispatch(type, ev) { ev.target ??= this; ev.type = type; if (this.disabled && type === 'click') return; if (type === 'click' && this.onclick) this.onclick(ev); if (type === 'input' && this.oninput) this.oninput(ev); if (type === 'keydown' && this.onkeydown) this.onkeydown(ev); for (const f of this.listeners[type] ?? []) f(ev); }
  getContext() { return new Proxy({}, { get: (t, k) => k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'measureText' ? () => ({ width: 1 }) : (typeof k === 'string' ? () => {} : undefined), set: () => true }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  get classList() { const n = this; return { add: (c) => { n.className += ' ' + c; }, remove() {}, toggle() {}, contains: (c) => n.className.split(/\s+/).includes(c) }; }
}
class Text_ { constructor(t) { this._t = t; this.children = []; } get textContent() { return this._t; } }
function matches(n, sel) { if (sel.startsWith('.')) return n.className.split(/\s+/).includes(sel.slice(1)); return n.tagName === sel.toUpperCase(); }
const docListeners = {};
globalThis.document = {
  head: new Node_('head'), body: new Node_('body'), activeElement: null, pointerLockElement: null,
  createElement: (t) => new Node_(t), createElementNS: (_ns, t) => new Node_(t), createTextNode: (t) => new Text_(t),
  getElementById: () => null, addEventListener: (t, f) => (docListeners[t] ??= []).push(f), removeEventListener() {}, exitPointerLock() {},
};
const winListeners = {};
globalThis.addEventListener = (t, f) => { const l = (winListeners[t] ??= []); if (!l.includes(f)) l.push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter((x) => x !== f); };
globalThis.requestAnimationFrame = (f) => { f(); return 1; };
globalThis.matchMedia = () => ({ matches: true, addEventListener() {} });
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
/** dispatch a keydown the way a browser does: window capture listeners first */
export function keydown(key, target = globalThis.document.activeElement ?? globalThis.document.body) {
  const ev = { key, code: key, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
  for (const f of winListeners.keydown ?? []) f(ev);
  if (!ev.stopped && target?.onkeydown) target.onkeydown(ev);
  return ev;
}
export const byClass = (root, c) => root.querySelectorAll('.' + c);
export const text = (n) => n.textContent;
export { Node_ };
