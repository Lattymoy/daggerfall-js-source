// DISC10 (2026-09-23): a minimal DOM, enough to mount the enhanced chargen wizard and drive it as a browser does -
// window capture listeners first, then the focused element's own handler. Imported for its side effect (globals).
class Node_ {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.style = { setProperty() {} }; this.attrs = {}; this.listeners = {}; this._text = ''; this.className = ''; this.scrollTop = 0; this.scrollLeft = 0; this.disabled = false; this.value = ''; }
  append(...ns) { for (const raw of ns) { const n = toNode(raw); n.parentNode = this; this.children.push(n); } }   // AUDIT 68 X2-chargendom-append-throws: a string used to reassign the loop's const and throw
  appendChild(n) { this.append(n); return n; }
  prepend(...ns) { const nodes = ns.map(toNode); for (const n of nodes) n.parentNode = this; this.children.unshift(...nodes); }
  replaceChildren(...ns) { for (const c of this.children) { unfocus(c); c.parentNode = null; } this.children = []; this._text = ''; this.append(...ns); }   // AUDIT 28: the Notice Board's window repaints so
  remove() { if (this.parentNode) { unfocus(this); this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } }
  set textContent(t) { for (const c of this.children) unfocus(c); this.children = []; this._text = String(t); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set innerHTML(v) { for (const c of this.children) unfocus(c); this.children = []; this._text = ''; }
  /** AUDIT 31 U1: as a browser's - whether `n` is this node or inside it, and whether this node is in the document. */
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  get isConnected() { let x = this; while (x.parentNode) x = x.parentNode; return x === globalThis.document.body || x === globalThis.document.head; }
  setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; if (k === 'class') this.className = ''; }   // L10N merge: the enhanced hotbar empties a slot's icon so
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (c instanceof Node_) { out.push(c); walk(c); } } }; walk(this); return sel === '*' ? out : out.filter((n) => matches(n, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  focus() { globalThis.document.activeElement = this; }
  blur() {}
  click() { this.dispatch('click', { stopPropagation() {}, preventDefault() {} }); }
  dispatch(type, ev) { ev.target ??= this; ev.type = type; if (this.disabled && type === 'click') return; if (type === 'click' && this.onclick) this.onclick(ev); if (type === 'input' && this.oninput) this.oninput(ev); if (type === 'keydown' && this.onkeydown) this.onkeydown(ev); for (const f of this.listeners[type] ?? []) f(ev); }
  getContext() { return new Proxy({}, { get: (t, k) => k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'measureText' ? () => ({ width: 1 }) : (typeof k === 'string' ? () => {} : undefined), set: () => true }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  get childNodes() { return this.children; }   // GUIDE2: the pause journal's PX22 meta line asks it (a real node's live NodeList)
  get dataset() { return (this._dataset ??= {}); }   // L10N merge: the enhanced hotbar's slots (enhancedHotbar.js) tag themselves, as a real node's DOMStringMap
  set dataset(v) { this._dataset = v; }   // ...and a test that hands a node its own keeps it
  get classList() { const n = this; return { add: (c) => { n.className += ' ' + c; }, remove() {}, toggle() {}, contains: (c) => n.className.split(/\s+/).includes(c) }; }
}
/** AUDIT 31 U1: A NODE TAKEN OUT OF THE DOCUMENT TAKES THE FOCUS WITH IT, as a browser's does - the focus falls to the
 *  body. Without it a window that emptied itself before a tab looked for the focused field found it still "focused",
 *  and the Market and Work tabs' keep-the-focus (AUDIT 30 U8) passed here and never once worked in a browser. */
function unfocus(n) {
  const d = globalThis.document;
  const a = d?.activeElement;
  if (a && typeof n?.contains === 'function' && n.contains(a)) d.activeElement = d.body;
}
class Text_ { constructor(t) { this._t = t; this.children = []; this.parentNode = null; } get textContent() { return this._t; } }
/** A string child is a text node, as the DOM's append/prepend make it. */
const toNode = (n) => (typeof n === 'string' ? new Text_(n) : n);
function matches(n, sel) {
  if (sel.includes(',')) return sel.split(',').some((s) => matches(n, s.trim()));   // AUDIT 31 U1: a list - 'input, select'
  if (sel.startsWith('.')) return n.className.split(/\s+/).includes(sel.slice(1));
  return n.tagName === sel.toUpperCase();
}
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
export function keydown(key, target = globalThis.document.activeElement ?? globalThis.document.body, extra = {}) {
  const ev = { type: 'keydown', key, code: key, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
  for (const f of winListeners.keydown ?? []) f(ev);
  if (!ev.stopped && target?.onkeydown) target.onkeydown(ev);
  return ev;
}
/** ...and its release, the same way (AUDIT DISC28 UI-2: the pause face answers on the keyup of a press it saw) */
export function keyup(key, target = globalThis.document.activeElement ?? globalThis.document.body, extra = {}) {
  const ev = { type: 'keyup', key, code: key, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
  for (const f of winListeners.keyup ?? []) f(ev);
  if (!ev.stopped && target?.onkeyup) target.onkeyup(ev);
  return ev;
}
/** How many listeners of a type the window holds - an owner's teardown leaves none behind */
export const windowListenerCount = (type) => (winListeners[type] ?? []).length;
export const byClass = (root, c) => root.querySelectorAll('.' + c);
export const text = (n) => n.textContent;
export { Node_ };
