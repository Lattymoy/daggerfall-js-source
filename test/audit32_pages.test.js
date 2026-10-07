// AUDIT 32 (2026-09-30, Mac: "Audit this") - PROF7'S PAGES AND HUD AS THE AUDIT FOUND THEM (src/ui/profPages.js,
// profHud.js, domRepaint.js, enhancedMenu.js, enhancedPlusStyle.js; src/systems/stitchAct.js, heatAct.js): a press
// judged at its own moment, the act's button pressed on the pointer's down and its Space and Enter the act's (P1); one
// act a page (P2); a held key's repeats no presses (P4); the loom's cures held while it sews, a craft's own flag in
// flight (P5); the Weavers' purchase said before the press where the Marks cannot meet it, "1 Drake" (P6, R13); the work rows and the
// body's prompt inside a phone (P7, P9 - measured in Chromium, their rules pinned here); Standard-bearer's Silk said for
// what it waits on, the skins at their pelts' ranks (P8, R4); the trace's line drawn, its first point marked, a degree
// the same across as up (P11); Escape sets an act down before the window (P12); the pause window keeps the focus and
// the caret (P3, P13). bible/06-Systems/Online-Arc.md "AUDIT 32"; bible/06-Systems/Professions-Arc.md 29.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { xpForRank } from '../src/net/professionLaw.js';
import { STITCH_ACT, beatAt, onBeat, glowAt } from '../src/net/recipeLaw.js';
import { createStitchAct, PRESS_LEAD_MAX_S } from '../src/systems/stitchAct.js';
import { createHeatAct } from '../src/systems/heatAct.js';
import { createTraceAct } from '../src/systems/traceAct.js';
import { createProfHud } from '../src/ui/profHud.js';
import { repaintKeepingScroll } from '../src/ui/domRepaint.js';
import {
  setProfessionsPages, drawStoresPage, drawProfessionsPage, resetProfPages, setDownProfAct, profActUnderWay, _loomForTests,
} from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
// the act loops' capture listeners on the document, heard as a browser dispatches them (a stopImmediatePropagation ends it)
const docKeys = new Set();
const realAdd = document.addEventListener, realRemove = document.removeEventListener;
document.addEventListener = (t, f, c) => { if (t === 'keydown') docKeys.add(f); return realAdd.call(document, t, f, c); };
document.removeEventListener = (t, f, c) => { if (t === 'keydown') docKeys.delete(f); return realRemove?.call(document, t, f, c); };
const key = (ev) => {
  let stopped = false;
  const e = { code: 'Space', target: document.body, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() { stopped = true; }, ...ev };
  for (const f of [...docKeys]) { if (stopped) break; f(e); }
  return e;
};

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
/** The Stores page over a stub book - the anvil and the loom at home, `over` the provider's own. */
function pages(over = {}, heldIn = {}) {
  resetProfPages();
  setPref('gentleActs', false);
  const held = new Map(Object.entries({ 'ingot:iron': 9, 'metal:tin': 9, 'cloth:linen': 9, 'hide:rat': 4, ...heldIn }));
  const tracks = new Map([['outfitting', { profession: 'outfitting', xp: xpForRank(60), rank: 60, specs: { 50: null, 100: null } }], ['smithing', { profession: 'smithing', xp: xpForRank(60), rank: 60, specs: { 50: null, 100: null } }], ['hunting', { profession: 'hunting', xp: 0, rank: 0, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: { highHides: 3 }, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const calls = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'home', fee: 0 }), workbench: () => null, loom: () => ({ kind: 'home', fee: 0 }),
    smelt: async (r, n) => { calls.push(['smelt', r, n]); return { ok: true, text: 'worked' }; },
    craft: async (recipe, o) => { calls.push(['craft', recipe, o.clean, o.dye ?? null]); return { ok: true, text: 'made' }; },
    stock: async (m, n) => { calls.push(['stock', m, n]); return { ok: true, text: 'bought' }; },
    heatBand: () => 1, stitchBand: () => 1, clothing: () => 'MensClothing', ...over,
  });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const buttons = () => [...root.querySelectorAll('button')];
  const btn = (words, which = 0) => buttons().filter((b) => b.textContent.startsWith(words))[which];
  return { calls, draw, get root() { return root; }, buttons, btn, text: () => root.textContent, held };
}
/** The loom's garment picked: Clothing, Men's, the Short Shirt, Linen. PIN MOVED (CRAFT2): the pattern, then its cloth in
 *  the box (Linen chosen already - the cloth held - and pressed to say so). */
const pickShirt = (p) => { p.btn('Clothing').onclick(); p.btn('Men\'s').onclick(); p.btn('Short Shirt').onclick(); p.btn('Linen').onclick(); };

// ─── P1: A PRESS AT ITS OWN MOMENT ───────────────────────────────────

test('AUDIT 32 P1: a stitch and a strike judged at the press\'s own moment (`lead`, a tenth at most); the act\'s button pressed on the pointer\'s down - its click after it no second press, a click nobody pointed pressed once; its Space the act\'s', () => {
  // a moment off the beat at the last frame, on it at the press
  const at = STITCH_ACT.beatS * (1 - STITCH_ACT.bandW / 2 - 0.05);   // just before the band opens
  const late = createStitchAct();
  late.tick(at);
  assert.equal(onBeat(beatAt(at), late.state.w), false);
  const plain = createStitchAct();
  plain.tick(at);
  assert.equal(plain.stitch(), false, 'at the frame: off the beat');
  const lead = createStitchAct();
  lead.tick(at);
  assert.equal(lead.stitch(0.06), true, 'at the press: on it');
  const far = createStitchAct();
  far.tick(at);
  far.stitch(5);
  assert.ok(Math.abs(far.state.lastAt - (at + PRESS_LEAD_MAX_S)) < 1e-9, 'a lead is a tenth at most');
  // the heat the same: a strike judged where the glow is at the press
  const heat = createHeatAct();
  let t = 0;
  while (t < 30 && !(glowAt(t) < heat.state.lo && glowAt(t + 0.05) >= heat.state.lo && glowAt(t + 0.05) <= heat.state.hi)) t += 0.001;
  heat.tick(t);
  assert.equal(heat.strike(0.05), true);
  // the Stitch button: the pointer's down stitches, its click after is no second stitch; an unpointed click stitches once
  const p = pages();
  try {
    pickShirt(p);
    p.btn('Craft').onclick();
    const act = _loomForTests().act;
    const stitch = p.btn('Stitch');
    stitch.onpointerdown({ preventDefault() {} });
    act.tick(0.3);   // a press held past the stitch's gap: its click on the release would be a second stitch
    stitch.onclick({});
    assert.equal(act.state.stitches.length, 1, 'one press, one stitch');
    act.tick(0.5);
    p.btn('Stitch').onclick({});
    assert.equal(act.state.stitches.length, 2, 'a screen reader\'s click');
    act.tick(0.5);
    key({ target: p.btn('Stitch') });
    assert.equal(act.state.stitches.length, 3, 'Space on the focused Stitch is the act\'s');
  } finally { resetProfPages(); setProfessionsPages(null); }
});

// ─── P2 + P4: ONE ACT A PAGE; NO REPEATS ─────────────────────────────

test('AUDIT 32 P2/P4: one act a page - the loom\'s Craft held while the anvil\'s heat is under way, and said; a held key\'s repeats no presses', () => {
  const p = pages();
  try {
    p.btn('Dagger').onclick();   // PIN MOVED (CRAFT2): the pattern - its Iron the metal held
    p.btn('Craft').onclick();   // the anvil's heat begins
    assert.ok(p.btn('Strike'), 'the heat under way');
    pickShirt(p);
    const loomCraft = p.buttons().filter((b) => b.textContent === 'Craft').at(-1);
    assert.equal(loomCraft.disabled, true, 'the loom waits');
    assert.match(p.text(), /Your hands are at the anvil - finish there first\./);
    assert.equal(docKeys.size, 1, 'one act, one loop');
    setDownProfAct();
    p.draw();
    pickShirt(p);
    p.buttons().filter((b) => b.textContent === 'Craft').at(-1).onclick();   // the stitch now
    const act = _loomForTests().act;
    key({ repeat: true });
    assert.equal(act.state.stitches.length, 0, 'a repeat is no press');
    key({});
    assert.equal(act.state.stitches.length, 1);
  } finally { resetProfPages(); setProfessionsPages(null); }
});

// ─── P5: THE LOOM'S FLAGS ────────────────────────────────────────────

test('AUDIT 32 P5: the loom\'s cures held while it sews; a craft in flight keeps Craft held though a cure answers under it', async () => {
  let answerCraft;
  const p = pages({ craft: () => new Promise((r) => { answerCraft = r; }) });
  try {
    pickShirt(p);
    p.btn('Craft').onclick();
    assert.equal(p.btn('Cure').disabled, true, 'held under the stitch');
    setDownProfAct();
    p.draw();
    pickShirt(p);
    p.btn('Quick craft').onclick();   // a craft in flight
    await tick();
    assert.equal(p.btn('Cure').disabled, false);
    await p.btn('Cure').onclick();   // a cure asked and answered under it
    assert.deepEqual([p.btn('At the loom...')?.disabled, p.btn('Quick craft').disabled], [true, true], 'the craft still in flight');
    answerCraft({ ok: true, text: 'made' });
    await tick();
    assert.equal(p.btn('Craft').disabled, false);
  } finally { resetProfPages(); setProfessionsPages(null); }
});

// ─── P6: THE WEAVERS' PURCHASE SAID FIRST ────────────────────────────

test('AUDIT 32 P6: at a Clothing Store the Weavers\' purchase the Marks cannot meet is held and said (R13: "1 Drake", as the Market tab says it); with no Marks struck, not offered', () => {
  for (const [marks, open, want] of [[3, true, 'held'], [1, true, 'held'], [99, true, 'offered'], [99, false, 'none']]) {
    const p = pages({ loom: () => ({ kind: 'shop', fee: 0 }), marks: () => marks, marksOpen: () => open }, { 'cloth:linen': 0 });
    try {
      pickShirt(p);
      const buy = p.btn('Buy 2 from the Weavers');
      if (want === 'none') assert.equal(buy, undefined);
      else assert.equal(buy.disabled, want === 'held', `${marks} Marks`);
      if (want === 'held') assert.match(p.text(), marks === 1 ? /you hold 1 silver/ : /you hold 3 silver/);
    } finally { resetProfPages(); setProfessionsPages(null); }
  }
});

// ─── P8 + R4: THE SILK'S WORD; THE UNLOCKS ───────────────────────────

test('AUDIT 32 P8/R4: Standard-bearer\'s Silk says what it waits on; the Outfitting unlocks put the skins at their pelts\' ranks', () => {
  const p = pages();
  try {
    p.btn('Clothing').onclick();
    p.btn('Straps').onclick();   // PIN MOVED (CRAFT2): a garment, then its cloth in the box
    p.btn('Standard-bearer\'s Silk').onclick();
    assert.match(p.text(), /cloth:standard comes with the sieges - a Siege Honour's Spoils\./);   // PIN MOVED (AUDIT-SEATS): the sieges yield it now
    assert.doesNotMatch(p.text(), /Nothing yields it yet/);
    const root = el('div');
    document.body.append(root);
    drawProfessionsPage(root, () => {}, kit);
    [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith('Outfitting'))?.onclick?.();
    const again = el('div');
    document.body.append(again);
    drawProfessionsPage(again, () => {}, kit);
    const t = again.textContent;
    assert.match(t, /Linen clothing; the Rat's skins; the Fishing-Netrank 0/);
    assert.match(t, /the Bat's and the Bear's skinsrank 10/);
    assert.match(t, /The Tiger's skinsrank 25/);
    root.remove(); again.remove();
  } finally { resetProfPages(); setProfessionsPages(null); }
});

// ─── P11: THE TRACE'S METER ──────────────────────────────────────────

test('AUDIT 32 P11: the trace\'s meter draws the line through its points, marks the first, and keeps a degree the same across as up; a slip is said', () => {
  const hud = createProfHud({ doc: document });
  try {
    const act = createTraceAct({ tier: 1, rng: () => 0.5 });
    hud.setMeter(act, 'E');
    const face = document.body.querySelector('.prof-face');
    assert.ok(face.classList.contains('prof-traceface'));
    const line = face.querySelector('POLYLINE');
    assert.ok(line, 'the line');
    assert.equal(line.getAttribute('points').split(' ').length, act.state.points.length);
    // PROF-RETICLE: the line laid on the body through the frame's lens - one focal length across and up
    line.getAttribute('points').split(' ').forEach((s, i) => {
      const [x, y] = s.split(',').map(Number), [yaw, pitch] = act.state.points[i];
      assert.ok(Math.abs(x - 500 * Math.tan(yaw * Math.PI / 180)) < 0.06 && Math.abs(y + 500 * Math.tan(pitch * Math.PI / 180)) < 0.06, `point ${i}: a degree the same across as up`);
    });
    assert.equal(face.querySelectorAll('.first').length, 1, 'the first point marked');
    act.tick(0.05, { held: true, aim: { yaw: act.state.points[0][0], pitch: act.state.points[0][1] } });
    act.tick(0.05, { held: false });
    hud.setMeter(act, 'E');
    assert.match(document.body.querySelector('.prof-meter').textContent, /let go - hold E on the first point again/);
  } finally { hud.dispose(); }
});

// ─── P12: ESCAPE SETS THE ACT DOWN ───────────────────────────────────

test('AUDIT 32 P12: Escape sets an act under way down before it closes the window - nothing spent, said', () => {
  const p = pages();
  try {
    pickShirt(p);
    p.btn('Craft').onclick();
    assert.equal(profActUnderWay(), true);
    assert.equal(setDownProfAct(), true);
    assert.deepEqual([profActUnderWay(), setDownProfAct()], [false, false]);
    p.draw();
    assert.match(p.text(), /You set the needle down; nothing is spent\./);
    assert.deepEqual(p.calls.filter((c) => c[0] === 'craft'), []);
    assert.match(src('src/ui/enhancedMenu.js'), /: profActUnderWay\(\) \? \(\) => \{ setDownProfAct\(\); render\(\); \}\n\s*: confirming/, 'the back stack asks it first');
  } finally { resetProfPages(); setProfessionsPages(null); }
});

// ─── P3 + P13: THE FOCUS AND THE CARET ───────────────────────────────

test('AUDIT 32 P3/P13: the pause window\'s redraw keeps the field typed in and its caret, and a keyboard\'s button though its class changed; the Stores search no longer throws its caret to the end', () => {
  const host = el('div');
  document.body.append(host);
  let on = false;
  const build = () => {
    const i = el('input');
    i.setAttribute('data-focus', 'q');
    i.selectionStart = 0; i.selectionEnd = 0;
    i.setSelectionRange = function (a, b) { this.selectionStart = a; this.selectionEnd = b; };
    const b = el('button', on ? 'prof-family on' : 'prof-family', 'Clothing');
    host.replaceChildren(i, b);
    return { i, b };
  };
  let n = build();
  n.i.focus(); n.i.selectionStart = 3; n.i.selectionEnd = 3;
  repaintKeepingScroll(host, () => { n = build(); }, { focus: true });
  assert.equal(document.activeElement, n.i, 'the field kept');
  assert.deepEqual([n.i.selectionStart, n.i.selectionEnd], [3, 3], 'its caret where the typing left it');
  n.b.focus(); on = true;
  repaintKeepingScroll(host, () => { n = build(); }, { focus: true });
  assert.equal(document.activeElement, n.b, 'the button pressed, drawn again picked');
  // the page's shape moved (a line drawn above it): the button found by its words
  repaintKeepingScroll(host, () => { n = build(); host.prepend(el('p', null, 'a word')); }, { focus: true });
  assert.equal(document.activeElement, n.b, 'found again by its words');
  repaintKeepingScroll(host, () => { n = build(); });
  assert.equal(document.activeElement, document.body, 'without the option (the inventory, the wizard) nothing is kept');
  host.remove();
  assert.match(src('src/ui/enhancedMenu.js'), /repaintKeepingScroll\(app, \(\) => renderInto\(\), \{ focus: true \}\);/);
  assert.doesNotMatch(src('src/ui/profPages.js'), /setSelectionRange\?\.\(s\.value\.length, s\.value\.length\)/, 'P13');
});

// ─── P7 + P9: THE RULES CHROMIUM MEASURED ────────────────────────────

test('AUDIT 32 P7/P9: the work rows placed, never flowed (measured in Chromium at 360 and 800); the body\'s prompt wraps inside the screen, the choice key\'s line its own on a phone', () => {
  const css = src('src/ui/enhancedPlusStyle.js');
  assert.match(css, /\.prof-smelt \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 64px auto;/);
  assert.match(css, /\.prof-smelt b \{ grid-column: 1; grid-row: 1; \} \.prof-smelt \.prof-qty \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(css, /\.prof-smelt \.act \{ grid-column: 3; grid-row: 1; \} \.prof-smelt \.prof-split \{ grid-column: 1 \/ -1; grid-row: 2; \}/);
  assert.match(css, /\.prof-prompt \{ position: fixed;[\s\S]*?width: max-content; max-width: calc\(100vw - 24px\); box-sizing: border-box; white-space: normal;/);
  assert.match(css, /@media \(max-width: 560px\) \{ \.prof-prompt \.prof-alt \{ display: block; \} \}/);
  assert.match(src('src/ui/profHud.js'), /d\.className = 'dim prof-alt';/);
});
