// MOVED-NOTICE (FIELD BUGS 2026-10-03, SylviaB on Discord: "If I move my notifications/quest updated to the top
// center, it momentarily spawns in its original location and slides in from the side which looks bad. This can be
// easily improved by changing it to a fade in/out at the updated location instead of a slide in.")
//
// Two halves, each red on the record's own code. The notice stack is built anew for every burst and HUD-MOVE's
// offset reached it only on the 250 ms sweep, so its first panel was drawn at the sheet's place and then warped; and
// a moved stack still slid in from the screen's right edge. Driven over a fake document that answers the few
// selectors HUD-MOVE asks (a class, an id, an attribute), the real hudLayout sweep and the real notice module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawEnhancedNotice, releaseEnhancedNotice, destroyEnhancedNotice, _setNoticeClockForTests, ENHANCED_NOTICE_ID, NOTICE_SLIDE_MS } from '../../../src/ui/enhanced/enhancedNotice.js';
import { sweepHudLayout, tickHudLayout, _resetHudLayoutForTests, HUD_LAYOUT_PREF } from '../../../src/ui/hud/hudLayout.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';

/** One simple selector - `.a`, `#b`, `[c]`, `.a[c="v"]` - against a node; anything with a space matches nothing here. */
function matchesOne(n, sel) {
  if (/\s/.test(sel.trim())) return false;
  const re = /([.#])([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  let m, any = false;
  while ((m = re.exec(sel.trim()))) {
    any = true;
    if (m[1] === '.' && !String(n.className).split(/\s+/).includes(m[2])) return false;
    if (m[1] === '#' && n.id !== m[2]) return false;
    if (m[3] && !(m[3] in n.attrs) && !(m[3].startsWith('data-') && n.dataset[m[3].slice(5)] != null)) return false;
    if (m[3] && m[4] != null && n.attrs[m[3]] !== m[4]) return false;
  }
  return any;
}
function fakeDocument() {
  const doc = { log: [] };
  const node = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', attrs: {}, dataset: {},
      style: { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } },
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      insertBefore(c, ref) { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      getAttribute(k) { return n.attrs[k] ?? null; },
      hasAttribute(k) { return k in n.attrs; },
      removeAttribute(k) { delete n.attrs[k]; },
      matches(sel) { return sel.split(',').some((s) => matchesOne(n, s)); },
      querySelector() { return null; },
      remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
      // the panel's flush (enhancedNotice buildPanel): what the browser computes as the transition's "before"
      get offsetWidth() {
        const st = n.parent;
        if (st?.id === ENHANCED_NOTICE_ID) doc.log.push({ hmx: st.style.props['--hmx'] ?? null, moved: st.hasAttribute('data-hm-moved') });
        return 0;
      },
    };
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const all = () => { const out = []; const walk = (n) => { for (const c of n.children) { out.push(c); walk(c); } }; walk(doc.head); walk(doc.body); return out; };
  doc.querySelectorAll = (sel) => all().filter((n) => n.matches(sel));
  doc.getElementById = (id) => all().find((n) => n.id === id) ?? null;
  return doc;
}

/** The enhanced skin, a layout with the notices moved, a fresh HUD-MOVE and notice module; torn down after. */
function withPage(layout, fn) {
  const hadLoc = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: '?skin=enhanced' };
  const doc = fakeDocument();
  globalThis.document = doc;
  resetPrefs(); _resetHudLayoutForTests();
  setPref(HUD_LAYOUT_PREF, layout);
  _setNoticeClockForTests(() => null, () => {});
  try { return fn(doc); } finally {
    destroyEnhancedNotice();
    _setNoticeClockForTests((f, ms) => setTimeout(f, ms), (t) => clearTimeout(t));
    _resetHudLayoutForTests(); resetPrefs();
    if (hadLoc === undefined) delete globalThis.location; else globalThis.location = hadLoc;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
  }
}
const box = (text) => ({ rows: [text] });

test('MOVED-NOTICE: a new notice stack stands where the player moved it BEFORE its first panel is flushed - no frame at the sheet\'s place (mutant: the build\'s sweep dropped)', () => {
  withPage({ notices: { x: -640, y: -300 } }, (doc) => {
    tickHudLayout(doc, 0);   // HUD-MOVE started, as the HUD's first frame starts it
    drawEnhancedNotice(box('Journal updated'), doc, 'box1');
    const stack = doc.getElementById(ENHANCED_NOTICE_ID);
    assert.ok(stack, 'the stack is built');
    assert.equal(doc.log.length, 1, 'one panel flushed');
    assert.deepEqual(doc.log[0], { hmx: '-640px', moved: true }, 'placed and marked moved at the flush, not a sweep later');
    // the burst ends: the stack goes with its last panel, and the NEXT burst's stack is placed at once too
    releaseEnhancedNotice('box1');
    destroyEnhancedNotice();
    assert.equal(doc.getElementById(ENHANCED_NOTICE_ID), null);
    drawEnhancedNotice(box('Quest updated'), doc, 'box2');
    assert.deepEqual(doc.log[1], { hmx: '-640px', moved: true });
  });
});

test('MOVED-NOTICE: a stack left where the sheet stands it is not marked moved - it slides from the edge as it always has; one only scaled is not moved either (mutants: moved always; moved by scale)', () => {
  withPage({}, (doc) => {
    tickHudLayout(doc, 0);
    drawEnhancedNotice(box('Journal updated'), doc, 'box1');
    assert.deepEqual(doc.log[0], { hmx: null, moved: false });
  });
  withPage({ notices: { s: 1.5 } }, (doc) => {
    tickHudLayout(doc, 0);
    drawEnhancedNotice(box('Journal updated'), doc, 'box1');
    assert.deepEqual(doc.log[0], { hmx: null, moved: false });
  });
  // put back (a reset or a double-click): the mark comes off with the offset
  withPage({ notices: { x: 20, y: 0 } }, (doc) => {
    tickHudLayout(doc, 0);
    drawEnhancedNotice(box('Journal updated'), doc, 'box1');
    const stack = doc.getElementById(ENHANCED_NOTICE_ID);
    assert.ok(stack.hasAttribute('data-hm-moved'));
    setPref(HUD_LAYOUT_PREF, {});
    sweepHudLayout(doc);
    assert.equal(stack.hasAttribute('data-hm-moved'), false);
    assert.equal(stack.style.props['--hmx'], undefined);
  });
});

test('MOVED-NOTICE: a moved stack\'s panels FADE where they stand - no slide in, no slide out - for notices and revenant cards alike; the rule outweighs the sheets\' own (mutants: the rule dropped; the out-state left sliding)', () => {
  const hud = readFileSync(new URL('../../../src/ui/hud/hudLayout.js', import.meta.url), 'utf8');
  const style = (withPage({}, (doc) => { tickHudLayout(doc, 0); return doc.getElementById('hud-layout-style')?.textContent; })) ?? '';
  for (const [stack, card, inCls, outCls] of [['notice-stack', 'notice', 'notice-in', 'notice-out'], ['rvncard-stack', 'rvncard', 'rvncard-in', 'rvncard-out']]) {
    const rule = new RegExp(`\\.${stack}\\[data-hm-moved\\] > \\.${card}, \\.${stack}\\[data-hm-moved\\] > \\.${card}\\.${inCls},\\s*\\n\\.${stack}\\[data-hm-moved\\] > \\.${card}\\.${outCls} \\{ transform: none; \\}`);
    assert.match(style, rule, `${stack}: the moved stack's ${card} rests, enters and leaves untranslated`);
  }
  // SPECIFICITY: the out-state's selector (0,4,0) outweighs every sheet rule that translates a panel - the notice's
  // own .notice.notice-out (0,2,0), the toast's .notice.notice-toast.notice-out (0,3,0), the card's
  // body .rvncard.rvncard-out (0,2,1) - so no stylesheet order can put the slide back
  assert.match(hud, /\.notice-stack\[data-hm-moved\] > \.notice\.notice-out/);
  assert.match(hud, /\.rvncard-stack\[data-hm-moved\] > \.rvncard\.rvncard-out/);
  // the fade is the sheets' own opacity transition, which leaves before the node is taken
  const sheet = readFileSync(new URL('../../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
  const fade = Number(/\.notice \{[^}]*transition: transform \d+ms cubic-bezier\([^)]*\), opacity (\d+)ms/.exec(sheet)?.[1]);
  assert.ok(fade > 0 && fade <= NOTICE_SLIDE_MS, `the notice fades (${fade} ms) within the ${NOTICE_SLIDE_MS} ms the node stands`);
});
