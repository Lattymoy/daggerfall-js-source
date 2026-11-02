// AUDIT INSTALL R2 (lane E): the launcher's page, run in node - app/launcher/index.html parsed into a small DOM that
// holds what launcher.js reads and writes (ids, classes, attributes, `hidden`, `disabled`, focus), and launcher.js
// itself evaluated against it with a stub bridge. Not a browser: layout, CSS and the real focus fixup are
// tools/appShellProbe.mjs's, in Electron. This is what lets the page's own laws run in the suite - which region shows,
// what is rebuilt and what is left alone, where focus goes.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr']);

class Text_ {
  constructor(t) { this.data = String(t); this.parentNode = null; }
  get textContent() { return this.data; }
  get isConnected() { return !!this.parentNode?.isConnected; }
}

export class El {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.attributes = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = {};
    this.style = {};
    this.checked = false;
    this.replaced = 0;   // how many times replaceChildren ran - the "rebuilt" count the redraw cache is judged by
  }
  get children() { return this.childNodes.filter((c) => c instanceof El); }
  get lastElementChild() { return this.children.at(-1) ?? null; }
  get id() { return this.attributes.get('id') ?? ''; }
  get className() { return this.attributes.get('class') ?? ''; }
  set className(v) { this.attributes.set('class', String(v)); }
  get classList() {
    const e = this;
    const list = () => e.className.split(/\s+/).filter(Boolean);
    return { contains: (c) => list().includes(c), add: (c) => { if (!list().includes(c)) e.className = [...list(), c].join(' '); }, [Symbol.iterator]: () => list()[Symbol.iterator]() };
  }
  get dataset() {
    const e = this;
    return new Proxy({}, {
      get: (_t, k) => e.attributes.get(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`),
      set: (_t, k, v) => { e.attributes.set(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, String(v)); return true; },
    });
  }
  get hidden() { return this.attributes.has('hidden'); }
  set hidden(v) { if (v) this.attributes.set('hidden', ''); else this.attributes.delete('hidden'); }
  get disabled() { return this.attributes.has('disabled'); }
  set disabled(v) { if (v) this.attributes.set('disabled', ''); else this.attributes.delete('disabled'); }
  get type() { return this.attributes.get('type') ?? ''; }
  set type(v) { this.attributes.set('type', String(v)); }
  get title() { return this.attributes.get('title') ?? ''; }
  set title(v) { this.attributes.set('title', String(v)); }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }
  toggleAttribute(k, on) { const want = on === undefined ? !this.attributes.has(k) : !!on; if (want) this.attributes.set(k, ''); else this.attributes.delete(k); return want; }
  get isConnected() { return this === this.ownerDocument.documentElement || !!this.parentNode?.isConnected; }
  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new Text_(n) : n;
      node.parentNode?.childNodes && (node.parentNode.childNodes = node.parentNode.childNodes.filter((c) => c !== node));
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.replaced++;
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(t) { this.replaceChildren(...(String(t) ? [new Text_(t)] : [])); this.replaced--; }
  addEventListener(type, f) { (this.listeners[type] ??= []).push(f); }
  dispatchEvent(ev) {
    ev.target ??= this;
    for (let n = this; n; n = n.parentNode) for (const f of n.listeners?.[ev.type] ?? []) f(ev);
    for (const f of this.ownerDocument.listeners[ev.type] ?? []) f(ev);
  }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click' }); }
  focus() { if (this.isConnected && !this.disabled) this.ownerDocument.activeElement = this; }
  matches(sel) { return sel.split(',').some((s) => matchChain(this, s.trim().split(/\s+/))); }
  closest(sel) { for (let n = this; n instanceof El; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  /** Chromium's own answer for a node in a hidden region (display: none from [hidden]) - the launcher's stylesheet
   *  makes `hidden` win over every region's own display. */
  checkVisibility() { return this.isConnected && !this.closest('[hidden]'); }
}

/** One compound selector: tag, #id, .class (any number), [attr] and [attr="v"]. */
function matchOne(el, sel) {
  const re = /(^[a-z][a-z0-9]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/gi;
  let m;
  let used = 0;
  while ((m = re.exec(sel))) {
    used += m[0].length;
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && el.id !== m[2]) return false;
    if (m[3] && !el.classList.contains(m[3])) return false;
    if (m[4] && (!el.attributes.has(m[4]) || (m[5] !== undefined && el.attributes.get(m[4]) !== m[5]))) return false;
  }
  if (used !== sel.length) throw new Error(`launcherDom: selector not understood: ${sel}`);
  return true;
}
/** A descendant chain, right to left. */
function matchChain(el, parts) {
  if (!matchOne(el, parts[parts.length - 1])) return false;
  let rest = parts.slice(0, -1);
  for (let n = el.parentNode; rest.length && n instanceof El; n = n.parentNode) if (matchOne(n, rest[rest.length - 1])) rest = rest.slice(0, -1);
  return rest.length === 0;
}

/** index.html's body, as a tree (the markup is the launcher's own: well formed, no scripts inline). */
function parse(html, doc) {
  const root = new El('html', doc);
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[a-z0-9:-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) { while (stack.length > 1 && stack.pop().tagName !== m[1].toUpperCase()); continue; }
    if (m[2]) {
      const e = new El(m[2], doc);
      for (const a of m[3].matchAll(/([a-z0-9:-]+)(?:="([^"]*)")?/gi)) e.attributes.set(a[1].toLowerCase(), (a[2] ?? '').replace(/&amp;/g, '&'));
      top.append(e);
      if (!VOID.has(m[2].toLowerCase())) stack.push(e);
      continue;
    }
    if (m[4] && m[4].trim()) top.append(new Text_(m[4].replace(/\s+/g, ' ')));
  }
  return root;
}

/**
 * The launcher page, booted: { doc, $, sent, show(view) } - `sent` every act the page sent the shell, `show` a view
 * delivered as the shell delivers it.
 */
export function bootLauncher() {
  const doc = { listeners: {}, activeElement: null };
  const html = readFileSync(new URL('../app/launcher/index.html', import.meta.url), 'utf8');
  doc.documentElement = parse(html, doc);
  doc.body = doc.documentElement.querySelector('body');
  doc.activeElement = doc.body;
  doc.getElementById = (id) => doc.documentElement.querySelector(`#${id}`);
  doc.querySelector = (s) => doc.documentElement.querySelector(s);
  doc.querySelectorAll = (s) => doc.documentElement.querySelectorAll(s);
  doc.createElement = (t) => new El(t, doc);
  doc.createTextNode = (t) => new Text_(t);
  doc.addEventListener = (t, f) => (doc.listeners[t] ??= []).push(f);
  const sent = [];
  let onView = null;
  const bridge = { onView: (cb) => { onView = cb; }, act: (action, arg) => sent.push(arg === undefined || arg === null ? [action] : [action, arg]) };
  const ctx = vm.createContext({ window: { daggerLauncher: bridge }, document: doc, JSON, String, Object, Math, Map, Number, Symbol });
  vm.runInContext(readFileSync(new URL('../app/launcher/launcher.js', import.meta.url), 'utf8'), ctx, { filename: 'launcher.js' });
  return { doc, $: (id) => doc.getElementById(id), sent, show: (v) => onView(v) };
}
