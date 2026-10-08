// WB9a (2026-09-30, Mac: "Can we add the modifers below his health bar? Allow people to see the modifers/trial as a
// popup before it starts.") - THE WARDEN'S MARKS, SEEN.
//
// WB8b gave the Warden an aspect and two trials every gate and said them in words; nothing showed what a mark DOES while
// the fight was on, and nothing showed them before the step. Now: a row of the night's marks under his health (each its
// sign, name and line, his aspect in its colour), and the marks' card - near the gate before it is entered, and as a
// fighter steps into the court - each mark with its line and how to meet it.
//
// Pinned here: the view (ui/gateMarksView.js marksViewOf - every mark in the tables has a sign and a way to meet it),
// the card's clock (it stands while he is read and fades), its node (made once, written on change, hidden with the
// HUD), the bar's row (written when the marks change, never a frame), the gate's card (near an unentered gate, gone
// when it collapses), and the court's card (from the step in, never for a Warden already fallen, never over the fire).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  marksViewOf, marksCardModel, drawGateMarksCard, destroyGateMarksCard, markIconSvg, aspectCss,
  MARK_ICONS, MARK_TIPS, ASPECT_ELEMENT, MARKS_CARD_ARRIVE_MS, MARKS_CARD_FADE_MS, MARKS_CARD_TEXT, MARKS_CARD_CSS,
} from '../src/ui/gateMarksView.js';
import { GATE_ASPECTS, GATE_TRIALS } from '../src/net/gateMods.js';
import { ASPECT_COLORS, EMBER_COLOR } from '../src/world/gateBoss.js';
import { bossBarModel, drawGateBossBar, destroyGateBossBar } from '../src/ui/gateBossBar.js';
import { createGatePool } from '../src/scenes/gatePool.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { gateTimes, gateModsOf, gateBossOf } from '../src/net/gateLaw.js';
import { GATE_RISE_MS } from '../src/net/gateLaw.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { OPENING_MS } from '../src/net/gateBrain.js';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BOSS = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };

/** A document of plain objects: nodes that remember what was written to them. */
function fakeDoc() {
  const made = [];
  const node = (tag) => {
    const n = { tag, style: {}, className: '', textContent: '', children: [], writes: 0, append(...c) { this.children.push(...c); }, remove() { this.gone = true; } };
    let html = '';
    Object.defineProperty(n, 'innerHTML', { get: () => html, set: (v) => { html = v; n.writes++; } });
    made.push(n);
    return n;
  };
  const styles = [];
  return { made, styles, doc: { createElement: node, body: node('body'), head: { append: (s) => styles.push(s) }, getElementById: (id) => styles.find((s) => s.id === id) ?? null } };
}

test('WB9a the view: the aspect first in its colour and element, then each trial with its line - every mark in the tables has a sign and a way to meet it; the unmarked Warden shows none; made once a marks array (mutants: a trial dropped, the colour lost)', () => {
  assert.equal(marksViewOf(null), null);
  assert.equal(marksViewOf([]), null);
  const md = ['rime', 'colossal', 'echoing'];
  const v = marksViewOf(md);
  assert.equal(v.aspect.id, 'rime'); assert.equal(v.aspect.kind, 'aspect');
  assert.equal(v.aspect.name, 'Rime-Wrought'); assert.equal(v.aspect.epithet, 'the Rime-Wrought'); assert.equal(v.aspect.element, 'Frost');
  assert.equal(v.aspect.text, GATE_ASPECTS.find((a) => a.id === 'rime').omen);
  assert.equal(v.aspect.color, aspectCss('rime'));
  assert.equal(aspectCss('rime'), `#${ASPECT_COLORS.rime.ember.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`);
  assert.equal(aspectCss('burning'), `#${EMBER_COLOR.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`, 'the Burning wears the court\'s own ember');
  assert.deepEqual(v.trials.map((t) => [t.id, t.name, t.text]), [['colossal', 'Colossal', GATE_TRIALS.find((t) => t.id === 'colossal').text], ['echoing', 'Echoing', 'Every meteor falls twice']]);
  assert.equal(v.key, 'rime,colossal,echoing');
  assert.equal(marksViewOf(md), v, 'kept by its array');
  assert.notEqual(marksViewOf([...md]), null);
  for (const a of GATE_ASPECTS) { assert.ok(MARK_ICONS[a.id], `${a.id} has a sign`); assert.ok(MARK_TIPS[a.id], `${a.id} has a way to meet it`); assert.ok(ASPECT_ELEMENT[a.id], `${a.id} names its element`); }
  for (const t of GATE_TRIALS) { assert.ok(MARK_ICONS[t.id], `${t.id} has a sign`); assert.ok(MARK_TIPS[t.id], `${t.id} has a way to meet it`); }
  // a sign is static markup of the port's own: a solid one filled, a drawn one stroked
  assert.match(markIconSvg('storm', 20), /^<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M13\.5 1\.5/);
  assert.match(markIconSvg('rime'), /fill="none" stroke="currentColor"/);
  assert.equal(markIconSvg('nothing'), '');
});

test('WB9a the card\'s clock: stepping in it stands MARKS_CARD_ARRIVE_MS - in over a quarter second, out over its last MARKS_CARD_FADE_MS - and is gone; by the gate it stands while the player does; none for the Warden unmarked (mutants: it never goes; it never fades)', () => {
  const md = ['venom', 'scarring', 'grudge'];
  assert.equal(marksCardModel(null, BOSS), null);
  assert.equal(marksCardModel(md, BOSS, { since: 1000, now: 999 }), null, 'not before the step');
  const early = marksCardModel(md, BOSS, { since: 1000, now: 1100 });
  assert.equal(early.mode, 'arrive'); assert.equal(early.alpha, 0.4);
  const full = marksCardModel(md, BOSS, { since: 1000, now: 4000 });
  assert.equal(full.alpha, 1);
  assert.equal(full.title, MARKS_CARD_TEXT.title);
  assert.equal(full.sub, 'Valkynaz Ruhn comes the Venom-Blooded tonight');
  assert.deepEqual([full.aspect.id, ...full.trials.map((t) => t.id)], ['venom', 'scarring', 'grudge']);
  const late = marksCardModel(md, BOSS, { since: 1000, now: 1000 + MARKS_CARD_ARRIVE_MS - MARKS_CARD_FADE_MS / 2 });
  assert.equal(late.alpha, 0.5);
  assert.equal(marksCardModel(md, BOSS, { since: 1000, now: 1000 + MARKS_CARD_ARRIVE_MS }), null, 'gone');
  const gate = marksCardModel(md, BOSS, { mode: 'gate', now: 9e12 });
  assert.equal(gate.mode, 'gate'); assert.equal(gate.alpha, 1);
  assert.equal(gate.sub, 'Valkynaz Ruhn comes the Venom-Blooded tonight', 'WB13b: one subtitle near the gate and inside');
  assert.ok(MARKS_CARD_ARRIVE_MS >= OPENING_MS, 'the card stands at least while he does');
});

test('WB9a the card\'s node: made once, written when its marks change (never its signs a frame), its mode a class, hidden with the HUD - and its sheet in once (mutants: rebuilt; rewritten every draw)', () => {
  const { made, styles, doc } = fakeDoc();
  destroyGateMarksCard();
  drawGateMarksCard(null, { doc });
  assert.equal(made.length, 1, 'nothing made for nothing');
  const a = marksCardModel(['storm', 'unyielding', 'favoured'], BOSS, { since: 0, now: 3000 });
  drawGateMarksCard(a, { doc });
  const count = made.length;
  const root = doc.body.children[0];
  assert.equal(root.className, 'wb-marks-card wb-marks-arrive');
  assert.equal(root.children[0].textContent, MARKS_CARD_TEXT.title);
  assert.equal(root.children[1].textContent, 'Valkynaz Ruhn comes the Storm-Crowned tonight');
  const rows = root.children.slice(2);
  assert.deepEqual(rows.map((r) => r.children[1].children[0].textContent), ['Storm-Crowned - Lightning', 'Unyielding', 'Dagon\'s Favoured']);
  assert.equal(rows[0].children[1].children[2].textContent, MARK_TIPS.storm);
  const writes = made.reduce((n, m) => n + m.writes, 0);
  drawGateMarksCard({ ...a, alpha: 0.7 }, { doc });
  drawGateMarksCard(a, { doc });
  assert.equal(made.length, count, 'updated, not rebuilt');
  assert.equal(made.reduce((n, m) => n + m.writes, 0), writes, 'its signs written once, for its marks');
  drawGateMarksCard(marksCardModel(['storm', 'unyielding', 'favoured'], BOSS, { mode: 'gate' }), { doc });
  assert.equal(root.className, 'wb-marks-card wb-marks-gate');
  drawGateMarksCard(a, { doc, hidden: true });
  assert.equal(root.style.display, 'none');
  drawGateMarksCard(a, { doc });
  assert.equal(root.style.display, '');
  assert.equal(styles.filter((s) => s.textContent === MARKS_CARD_CSS).length, 1, 'the sheet, once');
  for (const c of ['wb-marks-card', 'wb-marks-title', 'wb-marks-sub', 'wb-marks-name', 'wb-marks-text', 'wb-marks-tip']) {
    assert.match(MARKS_CARD_CSS, new RegExp(`\\.${c} \\{`), c);
    assert.match(read('src/ui/enhancedPlusStyle.js'), new RegExp(`body \\.${c}\\b`), `${c} is dressed under Plus`);
  }
  destroyGateMarksCard();
  assert.ok(root.gone);
});

test('WB9a the bar\'s row: the night\'s marks under his health, a chip a mark - his aspect\'s sign and name in its colour, each trial\'s (WB13c: no line under each) - written when the marks change and never a frame, the row hidden for the Warden unmarked (mutants: the row rewritten every frame; the aspect\'s colour lost)', () => {
  const md = ['burning', 'vengeful', 'soulhungry'];
  const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 5, boss: 'ruhn', hp: 800, max: 1000, wrathAt: 1e12, fighters: 3, ...over });
  const m = bossBarModel(state({ md }), 1000, BOSS);
  assert.deepEqual(m.marksView, marksViewOf(md), 'the view the card reads');
  assert.equal(bossBarModel(state({ md }), 2000, BOSS).marksView, m.marksView, 'made once - read off the profile\'s own marks, every frame the same');
  assert.equal(bossBarModel(state(), 1000, BOSS).marksView, null);
  const { made, doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(m, { doc });
  const root = doc.body.children[0];
  const row = root.children[3];
  assert.equal(row.className, 'wb-boss-marks'); assert.equal(row.style.display, '');
  const head = (i) => row.children[i].children[0];
  assert.deepEqual(row.children.map((c, i) => head(i).children[1].textContent), ['Burning', 'Vengeful', 'Soul-Hungry']);
  assert.deepEqual(row.children.map((c) => c.children.length), [1, 1, 1], 'WB13c: a sign and a name each - the card says what each does');
  assert.equal(head(0).children[1].style.color, aspectCss('burning'));
  assert.match(head(0).children[0].innerHTML, /<svg/);
  const writes = made.reduce((n, x) => n + x.writes, 0);
  for (let i = 0; i < 5; i++) drawGateBossBar({ ...m, frac: 0.8 - i * 0.01 }, { doc });
  assert.equal(made.reduce((n, x) => n + x.writes, 0), writes, 'no sign written again while the marks stand');
  drawGateBossBar(bossBarModel(state({ md: ['rime', 'colossal', 'echoing'] }), 1000, BOSS), { doc });
  assert.equal(head(0).children[1].textContent, 'Rime-Wrought');
  assert.equal(made.reduce((n, x) => n + x.writes, 0), writes + 3, 'written again when the marks are another night\'s');
  drawGateBossBar(bossBarModel(state(), 1000, BOSS), { doc });
  assert.equal(row.style.display, 'none', 'no row for the Warden unmarked');
  destroyGateBossBar();
});

/** A gate the pool stands (wb2_gate.test.js's world, trimmed): a flat ground, a clock, feet, the banner and the card. */
function gateWorld(day = 700) {
  const t = gateTimes(day);
  const clock = { now: t.openAt + 1000 };
  const cards = [], banners = [];
  const g = { day, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham' };
  let feetAt = [409.6, 12, 430];
  const pool = createGatePool({
    renderer: null, gl: null, collider: () => ({ addMesh() {}, removeBucket() {} }),
    standing: () => ({ ...g, phase: clock.now < t.riseAt + GATE_RISE_MS ? 'rising' : clock.now < t.openAt ? 'sealed' : clock.now < t.sealAt ? 'open' : 'closed' }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 12, now: () => clock.now, feet: () => feetAt,
    banner: (s) => banners.push(s), marks: (c) => cards.push(c),
  });
  return { t, clock, pool, cards, banners, g, move: (f) => { feetAt = f; } };
}

test('WB9a the gate\'s card: tonight\'s marks beside the countdown, from the day\'s draw the relay\'s fight is born under - near the gate while it stands, none away from it, none as it collapses (mutants: shown far off; shown collapsing)', () => {
  const w = gateWorld();
  w.pool.frame(0.016);
  const c = w.cards.at(-1);
  assert.ok(c && w.banners.at(-1), 'the card beside the banner');
  assert.equal(c.mode, 'gate');
  const md = gateModsOf(700);
  assert.deepEqual([c.aspect.id, ...c.trials.map((t) => t.id)], [...md]);
  assert.equal(c.sub, MARKS_CARD_TEXT.gate(gateBossOf(700).name, c.aspect.epithet));
  w.move([409.6, 12, 409.6 + 500]);
  w.pool.frame(0.016);
  assert.equal(w.cards.at(-1), null, 'none away from it');
  w.move([409.6, 12, 430]);
  w.g.fellAt = w.clock.now - 1000;   // his master fell: the gate collapses
  w.pool.frame(0.016);
  assert.equal(w.cards.at(-1), null, 'none as it collapses');
});

test('WB9a the court\'s card: from the step in, while he stands to be read, then gone - never for a Warden already fallen, never over the step\'s fire, and put away with the court (mutants: shown for the fallen; shown under the veil; left standing after the court)', () => {
  const made = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); }, remove() {} }; Object.defineProperty(n, 'innerHTML', { set() {}, get: () => '' }); made.push(n); return n; };
  const saved = globalThis.document;
  globalThis.document = /** @type {any} */ ({ createElement: node, body: node('body'), head: { append() {} }, getElementById: () => null });
  try {
    destroyGateMarksCard(); destroyGateBossBar();
    const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
    const clock = { t: 50_000 };
    let veil = true;
    const c = createGateCourt({ link, now: () => clock.t, feet: () => [0, 0, 0], player: () => ({ health: 100, maxHealth: 100 }), veiled: () => veil });
    const md = ['storm', 'colossal', 'grudge'];
    link.st = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', hp: 1000, max: 1000, wrathAt: 1e12, fighters: 1, md };
    c.frame();
    const card = () => made.find((n) => typeof n.className === 'string' && n.className.startsWith('wb-marks-card'));
    assert.equal(card(), undefined, 'nothing drawn under the fire');
    veil = false;
    clock.t += 1000;
    c.frame();
    assert.ok(card(), 'the card as the fire opens');
    assert.equal(card().style.display, '');
    assert.equal(card().children[1].textContent, 'Valkynaz Ruhn comes the Storm-Crowned tonight');
    clock.t = 50_000 + MARKS_CARD_ARRIVE_MS + 10;
    c.frame();
    assert.equal(card().style.display, 'none', 'gone once read');
    // a court whose Warden has already fallen: no card
    c.leave();
    link.st = { ...GATE_STATE_EMPTY, day: 10, boss: 'ruhn', hp: 0, max: 1000, wrathAt: 1e12, fighters: 1, md, fell: { at: 40_000, top: [], n: 1 } };
    clock.t = 60_000;
    c.frame();
    assert.equal(card().style.display, 'none', 'none for the fallen');
    // put away with the court
    link.st = { ...GATE_STATE_EMPTY, day: 11, boss: 'ruhn', hp: 1000, max: 1000, wrathAt: 1e12, fighters: 1, md };
    clock.t = 70_000;
    c.frame();
    assert.equal(card().style.display, '');
    link.st = GATE_STATE_EMPTY;
    c.frame();
    assert.equal(card().style.display, 'none', 'the court put away takes its card');
  } finally {
    destroyGateMarksCard(); destroyGateBossBar();
    globalThis.document = saved;
  }
});

test('WB9a the seams, by source: the world host hands the pool the card beside its banner (never over the fire), clears it outside the street and the court, and tells the court when the fire is over the screen', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /marks: \(card\) => \{ _gateMarksWish = card; \},/);   // SD19 (PIN MOVED): the gate's card a wish the presence frame draws, before a Hollow's door's
  assert.match(world, /drawGateMarksCard\(_gateMarksWish \?\? sb\?\.card \?\? null, \{ hidden \}\);/);
  assert.match(world, /if \(\(gatePool \|\| sdHost\) && \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' && modes\?\.gateArenaDay\?\.\(\) == null && modes\?\.sdRealmSlot\?\.\(\) == null\) drawGateMarksCard\(null\);/);   // SD18b (PIN MOVED): the Hour draws its own marks on the card; SD19 (PIN MOVED): a Hollow's door's card too
  assert.match(world, /veiled: \(\) => !!gateVeil\?\.busy,/);
  assert.match(world, /drawGateBanner\(null\); drawGateMarksCard\(null\);( drawGateDamageChart\(null\);)?( drawGateGround\(null\);)? travelView/, 'a held frame takes it with the banner');   // WB9d: and his ground's rim; GATE-UX: and the damage chart
});
