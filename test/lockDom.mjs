// LOCKPICK (AUDIT LOCKPICK A1, A8 - bible/06-Systems/Lockpicking.md): a minimal DOM for the lock's real door and window
// (ui/lockpickDoor.js, ui/lockpickWindow.js) in Node - elements, a body, the window's keydown listeners (dispatched capture
// first) and a hand-pumped requestAnimationFrame. Install it BEFORE the scene modules load, as test/chargenDom.mjs is.
class El {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parent = null; this.className = ''; this.style = {}; this.attrs = {}; this.listeners = {}; this.textContent = ''; this.id = ''; this.disabled = false;
    const self = this; this.classList = { add: (c) => { const s = new Set(self.className.split(' ').filter(Boolean)); s.add(c); self.className = [...s].join(' '); }, remove: (c) => { self.className = self.className.split(' ').filter((x) => x && x !== c).join(' '); }, toggle: (c, on) => { const has = self.className.split(' ').includes(c); const want = on ?? !has; if (want) self.classList.add(c); else self.classList.remove(c); return want; }, contains: (c) => self.className.split(' ').includes(c) }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  append(...cs) { for (const c of cs) { if (typeof c === 'string') { this.textContent += c; continue; } c.remove(); c.parent = this; this.children.push(c); } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...cs) { for (const c of this.children) c.parent = null; this.children = []; this.append(...cs); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } }
  addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] ?? []).filter((f) => f !== fn); }
  getContext() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 520, height: 260 }; }
  focus() {}
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === this.ownerDocument.body || n === this.ownerDocument.head; }
  /** a compound selector (`tag`, `.cls`, `[attr="v"]`, joined) - enough for the window's own `closest` reads */
  matches(sel) {
    return sel.split(',').some((alt) => {
      const parts = alt.trim().split(/\s+/);
      const one = (n, c) => { const m = c.match(/^([a-z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i); if (!m) return false;
        if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
        const cls = (n.className || '').split(' ');
        if (m[2] && !m[2].split('.').filter(Boolean).every((k) => cls.includes(k))) return false;
        for (const [, k, v] of m[3].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) if (!(k in n.attrs) || (v != null && String(n.attrs[k]) !== v)) return false;
        return true; };
      if (!one(this, parts.at(-1))) return false;
      let n = this.parent, i = parts.length - 2;
      while (i >= 0 && n) { if (one(n, parts[i])) i--; n = n.parent; }
      return i < 0;
    });
  }
  closest(sel) { for (let n = this; n; n = n.parent) if (n.matches?.(sel)) return n; return null; }
  getAttribute(k) { return k in this.attrs ? String(this.attrs[k]) : null; }
  dispatchEvent(e) { for (const fn of [...(this.listeners[e.type] ?? [])]) fn(e); return true; }
  find(pred) { if (pred(this)) return this; for (const c of this.children) { const r = c.find(pred); if (r) return r; } return null; }
}
export function installDom() {
  const doc = { pointerLockElement: null };
  doc.createElement = (t) => new El(t, doc);
  doc.body = new El('body', doc); doc.head = new El('head', doc);
  doc.getElementById = (id) => doc.head.find((e) => e.id === id) ?? doc.body.find((e) => e.id === id);
  globalThis.document = doc;
  globalThis.window = globalThis;
  const winL = [];
  globalThis.addEventListener = (t, fn, o) => { winL.push({ t, fn, capture: !!(o === true || o?.capture) }); };
  globalThis.removeEventListener = (t, fn, o) => { const c = !!(o === true || o?.capture); const i = winL.findIndex((l) => l.t === t && l.fn === fn && l.capture === c); if (i >= 0) winL.splice(i, 1); };
  let rafQ = [], rafId = 0, now = 1000;
  globalThis.requestAnimationFrame = (cb) => { rafQ.push({ id: ++rafId, cb }); return rafId; };
  globalThis.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((r) => r.id !== id); };
  const api = {
    doc,
    /** a keydown through the window's listeners, capture first; answers whether anything stopped it */
    key(code, extra = {}) {
      let stopped = false, prevented = false;
      const e = { code, key: code, repeat: false, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: doc.body, ...extra,
        preventDefault() { prevented = true; }, stopPropagation() { stopped = true; }, stopImmediatePropagation() { stopped = true; } };
      for (const l of [...winL].filter((l) => l.t === 'keydown' && l.capture)) { l.fn(e); if (stopped) break; }
      return { stopped, prevented };
    },
    /** pump the animation frames for `secs` at `fps` */
    frames(secs, fps = 60) { const n = Math.round(secs * fps); for (let k = 0; k < n; k++) { now += 1000 / fps; const q = rafQ; rafQ = []; for (const r of q) r.cb(now); } },
    listeners: () => winL.length,
    click(el) { el.onclick?.({ preventDefault() {} }); },
  };
  return api;
}
