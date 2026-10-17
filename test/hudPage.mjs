// HUD-SADDLE / HUD-HELM: A PAGE HUD-MOVE CAN READ - one home for the suites that drive the movable HUD's real sweep,
// editor and pieces over a document (decorFakes.mjs's lesson, AUDIT WORLD D10: copies grow apart, and a fake that lies
// makes a pin pass that production would fail). It answers the selectors HUD-MOVE asks as a browser does - a class, an
// id, an attribute with or without its value, a comma list, and descendants (a panel's bar stands inside its
// whole-screen layer) - and nothing else: a selector it does not speak matches no node. A node's `dataset` is its data-
// attributes, by their camelled names; `closest` and `querySelector(All)` walk the tree; the window's listeners are the
// test's to fire (`doc.fire`).
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { HUD_LAYOUT_PREF, _resetHudLayoutForTests } from '../src/ui/hud/hudLayout.js';

/** A compound selector - `.a`, `#b`, `[c]`, `[c="v"]`, `.a[c="v"]` - against one node. */
function matchesCompound(n, sel) {
  const re = /([.#])([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  let m, any = false, at = 0;
  while ((m = re.exec(sel))) {
    if (m.index !== at) return false;   // anything this page does not speak matches nothing
    at = re.lastIndex; any = true;
    if (m[1] === '.' && !String(n.className).split(/\s+/).includes(m[2])) return false;
    if (m[1] === '#' && n.id !== m[2]) return false;
    if (m[3] && !(m[3] in n.attrs)) return false;
    if (m[3] && m[4] != null && n.attrs[m[3]] !== m[4]) return false;
  }
  return any && at === sel.length;
}
/** A selector with descendants (`.a .b`): the last compound on the node, the others on its ancestors, in order. */
function matchesSelector(n, sel) {
  const parts = sel.trim().split(/\s+/);
  if (!matchesCompound(n, parts.pop())) return false;
  let up = n.parentElement;
  while (parts.length) {
    const want = parts.pop();
    while (up && !matchesCompound(up, want)) up = up.parentElement;
    if (!up) return false;
    up = up.parentElement;
  }
  return true;
}
const kebab = (k) => `data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
export function fakePage() {
  const doc = {};
  const walk = (n, out = []) => { for (const c of n.children) { out.push(c); walk(c, out); } return out; };
  const node = (tag) => {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], parentElement: null, className: '', id: '', attrs: {}, listeners: {}, disabled: false, type: '', title: '',
      _text: '',
      get textContent() { return n._text + n.children.map((c) => c.textContent).join(''); },
      set textContent(v) { for (const c of n.children) c.parentElement = null; n.children = []; n._text = String(v ?? ''); },
      style: { props: {}, display: '', setProperty(k, v) { this.props[k] = String(v); }, removeProperty(k) { delete this.props[k]; }, getPropertyValue(k) { return this.props[k] ?? ''; } },
      append(...cs) { for (const c of cs) { if (!c) continue; c.remove?.(); c.parentElement = n; n.children.push(c); } },
      replaceChildren(...cs) { for (const c of n.children) c.parentElement = null; n.children = []; n.append(...cs); },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      getAttribute(k) { return k in n.attrs ? n.attrs[k] : null; },
      hasAttribute(k) { return k in n.attrs; },
      removeAttribute(k) { delete n.attrs[k]; },
      addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
      matches(sel) { return sel.split(',').some((s) => matchesSelector(n, s)); },
      closest(sel) { for (let c = n; c; c = c.parentElement) if (c.matches(sel)) return c; return null; },
      querySelector(sel) { return walk(n).find((c) => c.matches(sel)) ?? null; },
      querySelectorAll(sel) { return walk(n).filter((c) => c.matches(sel)); },
      remove() { const p = n.parentElement; if (p) { p.children.splice(p.children.indexOf(n), 1); n.parentElement = null; } },
      blur() {},
      getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    };
    // the browser's dataset: the data- attributes, by their camelled names
    n.dataset = new Proxy({}, {
      get: (_, k) => (typeof k === 'string' && kebab(k) in n.attrs ? n.attrs[kebab(k)] : undefined),
      set: (_, k, v) => { n.attrs[kebab(k)] = String(v); return true; },
      deleteProperty: (_, k) => { delete n.attrs[kebab(k)]; return true; },
    });
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const everything = () => [...walk(doc.head), ...walk(doc.body)];
  doc.querySelectorAll = (sel) => everything().filter((c) => c.matches(sel));
  doc.querySelector = (sel) => everything().find((c) => c.matches(sel)) ?? null;
  doc.getElementById = (id) => everything().find((c) => c.id === id) ?? null;
  // a window whose listeners the test fires: the editor's key and its presses
  const on = {};
  doc.defaultView = { addEventListener(t, fn) { (on[t] ??= []).push(fn); }, removeEventListener() {} };
  doc.fire = (t, ev) => { const e = { type: t, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...ev }; for (const fn of on[t] ?? []) fn(e); return e; };
  return doc;
}

/** The enhanced skin (the movable HUD and its panels are Enhanced Plus's), `layout` saved, a fresh HUD-MOVE and shelf
 *  on a fresh page - torn down after, and `teardown` (the panel's own hide) first. */
export async function withHudPage(layout, fn, { teardown = () => {} } = {}) {
  const had = { loc: Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined, doc: Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined };
  globalThis.location = { search: '?skin=enhanced' };
  const doc = fakePage();
  globalThis.document = doc;
  resetPrefs(); _resetHudLayoutForTests();
  if (layout) setPref(HUD_LAYOUT_PREF, layout);
  try { return await fn(doc); } finally {
    teardown();
    _resetHudLayoutForTests(); resetPrefs();
    if (had.loc === undefined) delete globalThis.location; else globalThis.location = had.loc;
    if (had.doc === undefined) delete globalThis.document; else globalThis.document = had.doc;
  }
}
/** A node's first child of class `cls`, or undefined. */
export const childOf = (n, cls) => n.children.find((c) => String(c.className).split(/\s+/).includes(cls));
