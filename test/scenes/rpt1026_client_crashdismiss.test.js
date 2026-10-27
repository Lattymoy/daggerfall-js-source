// RPT1026-CLIENT (private reports, 2026-10-23 and 10-24: the Firmament's Accept threw, and the report covered the lower
// screen, the Health bar and the hotkeys with it, until the game was left and loaded again; a pad's A on the world map,
// whose report stayed until the page was reloaded). main.js's crash report had no way off it (FIELD BUGS 2026-10-02c
// KEY-BOOT: "no dismiss") over a session that ran on. main.js touches the DOM at import, so its two functions run here
// against a document that keeps a real element's rules: textContent replaces the children, remove() takes it down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
/** The whole statement that starts at `needle` (balanced braces). */
function statementAt(src, needle) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `main.js still holds ${needle}`);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, src[i + 1] === ')' ? src.indexOf(';', i) + 1 : i + 1);   // a listener's call closes after its body
  }
  return assert.fail('unbalanced');
}

function page() {
  const els = new Map();
  class El {
    constructor(tag) { this.tag = tag; this.style = {}; this.children = []; this._text = ''; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set textContent(v) { this._text = String(v); this.children = []; }
    appendChild(c) { this.children.push(c); c.parent = this; return c; }
    remove() { if (els.get(this.id) === this) els.delete(this.id); }
  }
  const document = {
    getElementById: (id) => els.get(id) ?? null,
    createElement: (tag) => new El(tag),
    body: { appendChild: (el) => els.set(el.id, el) },
  };
  const code = `${statementAt(main, 'function crashOverlay(msg) {')}\n${statementAt(main, 'function crashDismiss(el) {')}\nreturn crashOverlay;`;
  return { els, crashOverlay: new Function('document', code)(document) };
}

const pointerOf = (style) => style.pointerEvents || /pointer-events:\s*([a-z]+)/.exec(style.cssText ?? '')?.[1];

test('RPT1026-CLIENT: the crash report can be dismissed, and its body still lets every click through', () => {
  const { els, crashOverlay } = page();
  const el = crashOverlay('IndexSizeError: an arc of negative radius');
  assert.equal(els.get('crash'), el);
  assert.equal(pointerOf(el.style), 'none', 'PL3: the report is no wall');
  assert.match(el.textContent.split('\n')[1], /^IndexSizeError/, 'the first line under CRASH is still the error');
  const button = el.children.find((c) => c.tag === 'button');
  assert.ok(button, 'a Dismiss button');
  assert.equal(pointerOf(button.style), 'auto', 'which takes the click the body lets through');
  // a second throw replaces the text (and the children with it) - the button comes back once
  crashOverlay('NotFoundError: no pointer of that id to capture');
  assert.match(el.textContent, /^CRASH \(2\)\nNotFoundError/);
  assert.equal(el.children.filter((c) => c.tag === 'button').length, 1);
  let stopped = 0;
  el.children[0].onclick({ stopPropagation: () => stopped++ });
  assert.equal(els.get('crash'), undefined, 'dismissed: the HUD under it is seen again');
  assert.equal(stopped, 1, 'and the click goes no further (a lost context\'s tap-to-reload sits under it)');
  // the next throw puts up a fresh report
  const next = crashOverlay('TypeError: x is undefined');
  assert.notEqual(next, el);
  assert.match(next.textContent, /^CRASH\nTypeError/);
});

test('RPT1026-CLIENT: a lost graphics context says what the browser knows - a card reset or short of memory - and blames no phone on a PC', () => {
  const { els, crashOverlay } = page();
  let lost = null;
  const canvas = { addEventListener: (ev, fn) => { if (ev === 'webglcontextlost') lost = fn; } };
  const document = { getElementById: (id) => (id === 'c' ? canvas : null) };
  const handler = statementAt(main, "document.getElementById('c')?.addEventListener('webglcontextlost'");
  new Function('document', 'crashOverlay', 'location', 'pageGoing', handler)(document, crashOverlay, { reload() {} }, false);
  lost({ preventDefault() {} });
  const text = els.get('crash').textContent;
  assert.match(text, /^CRASH\nthe graphics stopped: the graphics card was reset, or ran short of memory\n\nclick or tap here to reload/);
  assert.doesNotMatch(text, /phone/);
});
