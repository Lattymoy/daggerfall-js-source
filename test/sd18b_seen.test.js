// SD18b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD18b;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S MARKS, SEEN (ui/sdMarksView.js) - its Ending
// and its omens as the gate shows the Warden's: the gate's own card as a fighter steps into the Hour, a row under the
// Remnant's bar all fight long, each in the Hour's own signs; its wake's card naming the Ending it keeps; its own blows'
// colours leaning to its element and its brass burning in it (rimed, charged, venomed, soul-lit - the gate's grains); a
// strike in its element softened by my resistance to it (the gate's saving throw, magic's added) and landing as that
// element; the Ending's own stone lit in the Orrery's hall; the fray's arc round once by the Hollow's own snap.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sdMarksViewOf, sdMarksCardModel, sdOmensLine, sdEndingCss, sdEndingStoneLight, SD_MARK_ICONS, SD_MARK_TIPS, SD_ELEMENT_WORD, SD_MARKS_ARRIVE_MS,
  SD_MARKS_FADE_MS, SD_MARKS_CARD_TEXT, SD_STONE_LIGHT,
} from '../src/ui/sdMarksView.js';
import { markIconHtml, markIconSvg, marksViewOf } from '../src/ui/gateMarksView.js';
import { SD_ENDINGS, SD_OMENS, sdMarksOf, sdEndingOf } from '../src/net/sdMarks.js';
import { SD_STONES, SD_STONE_POS, realmToDungeon, SD_FRAY_MAX, orreryOf } from '../src/net/sdBrain.js';
import { SD_BLOWS, newRemnantFight, joinRemnant, remnantStateOf } from '../src/net/sdRemnant.js';
import { createSdFightLink, SD_FIGHT_EMPTY } from '../src/net/sdFightLink.js';
import { validSdOut } from '../src/net/wire.js';
import { strikeDamage, savedShare } from '../src/net/gateStrike.js';
import {
  createSdRemnantBlows, sdTint, sdTelegraphShapes, sdPoolShapes, SD_BLOW_COLOR, SD_ELEMENT_COLOR, SD_ELEMENT_STYLE, SD_ELEMENT_GROUND, SD_TINT_LEAN, SD_POOL_COLOR,
} from '../src/scenes/sdRemnantBlows.js';
import { arenaToDungeon } from '../src/scenes/sdRemnant.js';
import { createSdBeats, sdGroundModel, sdWakeText, SD_BEAT_TEXT } from '../src/scenes/sdArenaRead.js';
import { remnantBarModel } from '../src/ui/sdRemnantBar.js';
import { createSdHall } from '../src/scenes/sdHall.js';
import { buildFrayModel, SD_FRAY_RING } from '../src/world/sdHall.js';
import { TELEGRAPH_STYLE, TELEGRAPH_EDGE_DAGON } from '../src/render/gateTelegraph.js';

const T0 = 1_800_000_000_000;
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const MK = ['wayrest', 'hardened', 'twin'];

test('SD18b THE MARKS AS THEY ARE SHOWN: the Ending first - its signature, its element, its light, its own sign - then its omens, each its sign, its line and how to meet it; kept; the gate\'s card and row draw the Hour\'s own signs and the gate\'s as they were', () => {
  const v = sdMarksViewOf(MK);
  assert.equal(v.key, MK.join(','));
  assert.deepEqual([v.aspect.kind, v.aspect.id, v.aspect.name, v.aspect.element, v.aspect.color], ['aspect', 'wayrest', 'The Turning Tide', 'Frost', sdEndingCss('wayrest')]);
  assert.equal(v.aspect.text, sdEndingOf(MK).text);
  assert.match(v.aspect.tip, /^Resist frost to blunt its own blows and brass\. Its Hand reaches three quarters round/);
  assert.equal(v.aspect.epithet, 'Keeper of the Ending of Wayrest');
  assert.deepEqual(v.trials.map((t) => [t.kind, t.name, t.tip]), [['trial', 'The Hardened Hearts', SD_MARK_TIPS.hardened], ['trial', 'The Twin Hands', SD_MARK_TIPS.twin]]);
  assert.equal(sdMarksViewOf(MK), v, 'kept');
  assert.equal(sdMarksViewOf(['nowhere', 'twin', 'short']), null); assert.equal(sdMarksViewOf(null), null);
  assert.match(sdMarksViewOf(['daggerfall', 'twin', 'short']).aspect.tip, /^Resist shock /, 'Lightning resisted as shock');
  assert.equal(sdOmensLine(MK), 'The Hardened Hearts - The Twin Hands');
  // every mark its sign and its tip; every element a word
  for (const m of [...SD_ENDINGS, ...SD_OMENS]) { assert.ok(SD_MARK_ICONS[m.id]?.d, `${m.id}: a sign`); assert.ok(SD_MARK_TIPS[m.id], `${m.id}: a tip`); }
  assert.ok(SD_ENDINGS.every((E) => SD_ELEMENT_WORD[E.el]));
  assert.equal(sdEndingCss('sentinel'), '#ff9e38');
  // the signs drawn: the Hour's own path, the gate's table for its own
  assert.match(markIconHtml(v.aspect, 20), new RegExp(`d="${SD_MARK_ICONS.wayrest.d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(markIconHtml(v.trials[0], 12), /stroke="currentColor"/);
  assert.match(markIconHtml(sdMarksViewOf(['orsinium', 'twin', 'short']).aspect), /fill="currentColor"/);
  const gate = marksViewOf(['burning', 'colossal', 'vengeful']);
  assert.equal(markIconHtml(gate.aspect, 20), markIconSvg('burning', 20), 'the gate\'s own as it was');
  // the gate's card's rows and its bar's chips draw a mark's own sign
  const gmv = readFileSync(new URL('../src/ui/gateMarksView.js', import.meta.url), 'utf8'), gbb = readFileSync(new URL('../src/ui/gateBossBar.js', import.meta.url), 'utf8');
  assert.match(gmv, /r\.icon\.innerHTML = markIconHtml\(m, 20\);/);
  assert.match(gbb, /c\.icon\.innerHTML = markIconHtml\(m, 12\);/);
});

test('SD18b THE HOUR\'S CARD as a fighter steps in: the gate\'s card\'s model, low on the right - none before the step, coming up, standing, fading, gone nine seconds on; its words; and the world draws it in the Hour, never hides it as the street\'s, and puts it away', () => {
  assert.equal(sdMarksCardModel(MK, { since: 1000, now: 999 }), null);
  const c = sdMarksCardModel(MK, { since: 1000, now: 1000 + 125 });
  assert.deepEqual([c.mode, c.key, c.alpha, c.title, c.sub], ['arrive', MK.join(','), 0.5, SD_MARKS_CARD_TEXT.title, 'The Brass Remnant keeps the Ending of Wayrest']);
  assert.equal(c.aspect, sdMarksViewOf(MK).aspect); assert.equal(c.trials, sdMarksViewOf(MK).trials);
  assert.equal(sdMarksCardModel(MK, { since: 1000, now: 5000 }).alpha, 1);
  assert.ok(near(sdMarksCardModel(MK, { since: 0, now: SD_MARKS_ARRIVE_MS - SD_MARKS_FADE_MS / 2 }).alpha, 0.5));
  assert.equal(sdMarksCardModel(MK, { since: 0, now: SD_MARKS_ARRIVE_MS }), null, 'gone');
  assert.equal(sdMarksCardModel(['nope'], { since: 0, now: 10 }), null);
  assert.equal(sdMarksCardModel(['blades', 'twin', 'short'], { since: 0, now: 10 }).sub, 'The Brass Remnant keeps the Ending of the Blades');
  assert.match(W, /marks = sdMarksCardModel\(sdFightLink\.state\(\)\?\.mk \?\? sdMarksOf\(modes\.sdRealmSlot\(\)\), \{ since: _sdMarksSince, now: nowMs \}\);/);
  assert.match(W, /if \(_sdMarksSince === null\) _sdMarksSince = nowMs;/);
  assert.match(W, /\} else _sdMarksSince = null;/);
  assert.match(W, /if \(marks \|\| _sdMarksUp\) \{ drawGateMarksCard\(marks, \{ hidden \}\); _sdMarksUp = !!marks; \}/);
  assert.match(W, /if \(_sdMarksUp\) \{ drawGateMarksCard\(null\); _sdMarksUp = false; \}/);
  assert.match(W, /modes\?\.gateArenaDay\?\.\(\) == null && modes\?\.sdRealmSlot\?\.\(\) == null\) drawGateMarksCard\(null\);/);
});

test('SD18b UNDER ITS BAR AND ON ITS WAKE: the row of its marks and the omens\' line, the phase\'s name kept over it; its wake\'s card names its signature and the Ending it keeps - the table\'s with none', () => {
  const f = newRemnantFight(4, 1, T0, MK);
  joinRemnant(f, 'a', 'A', 30, T0);
  const L = createSdFightLink({ now: () => T0 + 20_000 });
  L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  const bar = remnantBarModel(L.state(), T0 + 20_000);
  assert.equal(bar.marksView, sdMarksViewOf(MK));
  assert.equal(bar.trials, 'The Hardened Hearts - The Twin Hands');
  assert.deepEqual([bar.title, bar.epithet], ['The Walking Hour', ''], 'its phase over the row');
  const plain = newRemnantFight(4, 1, T0); joinRemnant(plain, 'a', 'A', 30, T0);
  const P = createSdFightLink({ now: () => T0 + 20_000 }); P.word(validSdOut({ ...remnantStateOf(plain), me: 1 }));
  assert.deepEqual([remnantBarModel(P.state(), T0 + 20_000).marksView, remnantBarModel(P.state(), T0 + 20_000).trials], [null, '']);
  // the wake
  assert.deepEqual(sdWakeText(MK), { ...SD_BEAT_TEXT.wake, sub: 'The Turning Tide - the Ending of Wayrest' });
  assert.equal(sdWakeText(null), SD_BEAT_TEXT.wake);
  const beats = createSdBeats();
  const s0 = { ...SD_FIGHT_EMPTY, fi: 1, s: 4, ph: 1, op: T0 + 100, mk: MK };
  beats.frame(s0, T0);
  assert.equal(beats.frame(s0, T0 + 200).sub, 'The Turning Tide - the Ending of Wayrest');
});

test('SD18b ITS ELEMENT ON THE FLOOR: its own blows\' colours leaning to it (kept apart), the Hour\'s own untouched; its brass in its element\'s colour, grain and name; the arena read and the ground view the same', () => {
  assert.equal(sdTint('stomp', null), SD_BLOW_COLOR.stomp);
  const t = sdTint('stomp', 'frost');
  assert.ok(t.every((v, i) => near(v, SD_BLOW_COLOR.stomp[i] + (SD_ELEMENT_COLOR.frost[i] - SD_BLOW_COLOR.stomp[i]) * SD_TINT_LEAN)));
  assert.equal(sdTint('stomp', 'frost'), t, 'kept');
  assert.notDeepEqual(sdTint('stomp', 'frost'), sdTint('volley', 'frost'), 'told apart');
  assert.deepEqual(Object.keys(SD_ELEMENT_COLOR).sort(), ['fire', 'frost', 'magic', 'poison', 'shock']);
  assert.deepEqual([SD_ELEMENT_STYLE.frost, SD_ELEMENT_STYLE.poison, SD_ELEMENT_STYLE.magic], [TELEGRAPH_STYLE.frost, TELEGRAPH_STYLE.poison, TELEGRAPH_STYLE.shock]);
  const atk = (A, more = {}) => ({ k: 'atk', b: 0, i: 3, a: A.id, at: T0 + 500, x: 0, z: 0, yw: 0, tg: [[3, 3]], ...more });
  assert.equal(sdTelegraphShapes(atk(SD_BLOWS.stomp, { sh: { el: 'frost' } }), 0, 1, T0)[0].color, sdTint('stomp', 'frost'));
  assert.equal(sdTelegraphShapes(atk(SD_BLOWS.stomp), 0, 1, T0)[0].color, SD_BLOW_COLOR.stomp);
  const reset = sdTelegraphShapes({ ...atk(SD_BLOWS.reset), b: 0 }, 0, 3, T0)[0];
  assert.deepEqual([reset.color, reset.edge], [SD_BLOW_COLOR.reset, TELEGRAPH_EDGE_DAGON], 'the Reset its own, its red edge');
  const pool = (el) => ({ x: 0, z: 0, r: 3, from: T0, until: T0 + 6000, pct: 0.06, base: 3, ...(el ? { el } : {}) });
  const ps = sdPoolShapes([pool('poison')], T0 + 1000)[0];
  assert.deepEqual([ps.color, ps.style], [SD_ELEMENT_COLOR.poison, TELEGRAPH_STYLE.poison]);
  assert.deepEqual([sdPoolShapes([pool(null)], T0 + 1000)[0].color, sdPoolShapes([pool(null)], T0 + 1000)[0].style], [SD_POOL_COLOR, TELEGRAPH_STYLE.fire], 'plain: the brass burning');
  assert.deepEqual(Object.values(SD_ELEMENT_GROUND), ['Burning brass', 'Rimed brass', 'Charged brass', 'Venomed brass', 'Soul-lit brass']);
  const g = sdGroundModel({ burning: true, el: 'frost', now: 1000 });
  assert.match(JSON.stringify(g), /Rimed brass/);
  assert.doesNotMatch(JSON.stringify(sdGroundModel({ burning: true, now: 1000 })), /Rimed/);
});

test('SD18b A STRIKE IN ITS ELEMENT: softened by my resistance (the save door - the gate\'s throw, magic\'s added) and landing as that element; its brass bites the same, by its element\'s name; a plain blow never asks', () => {
  const run = (sh, poolSh = null) => {
    let clock = T0 + 20_000;
    const L = createSdFightLink({ now: () => clock });
    const f = newRemnantFight(4, 1, T0); joinRemnant(f, 'a', 'A', 30, T0);
    L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
    const struck = [], asked = [];
    const e = { health: 200, maxHealth: 200 };
    const B = createSdRemnantBlows({ link: L, feet: () => arenaToDungeon(0, 6), grounded: () => true, player: () => e, strike: (dmg, how) => struck.push({ dmg, how }), save: (en, el) => { asked.push(el); return 40; } });
    const A0 = T0 + 21_000;
    if (sh !== undefined) L.word(validSdOut({ k: 'atk', b: 0, i: 5, a: SD_BLOWS.stomp.id, at: A0, x: 0, z: 8, yw: 0, tg: [], ...(sh ? { sh } : {}) }));
    if (poolSh !== undefined && poolSh !== null) L.word(validSdOut({ k: 'atk', b: 0, i: 6, a: SD_BLOWS.volley.id, at: A0, x: 0, z: 0, yw: 0, tg: [[0, 6]], sh: poolSh }));
    for (let t = A0 - 100; t <= A0 + 3500; t += 50) { clock = t; B.frame(); }
    return { struck, asked };
  };
  const frost = run({ el: 'frost' });
  assert.deepEqual(frost.struck.map((x) => [x.dmg, x.how.name, x.how.el]), [[savedShare(strikeDamage(SD_BLOWS.stomp.pct, 200, SD_BLOWS.stomp.base), 40), SD_BLOWS.stomp.name, 'frost']]);
  assert.deepEqual(frost.asked, ['frost']);
  const plain = run(null);
  assert.deepEqual(plain.struck.map((x) => [x.dmg, x.how.el]), [[strikeDamage(SD_BLOWS.stomp.pct, 200, SD_BLOWS.stomp.base), undefined]]);
  assert.deepEqual(plain.asked, [], 'never asked');
  const brass = run(undefined, { el: 'poison' });
  const bites = brass.struck.filter((x) => x.how.name === 'Venomed brass');
  assert.ok(bites.length >= 2 && bites.every((x) => x.how.el === 'poison' && x.dmg === savedShare(strikeDamage(SD_BLOWS.volley.pool.pct, 200, SD_BLOWS.volley.pool.base), 40)), `its brass, venomed: ${JSON.stringify(brass.struck.map((x) => x.how))}`);
  // the world's door and magic's place in it
  assert.match(W, /magic: Object\.freeze\(\[ELEMENTS\.Magic, EFFECT_FLAGS\.Magic\]\),/);
  assert.match(W, /save: \(e, el\) => \{ const w = GATE_SAVES\[el\]; return w \? savingThrow\(w\[0\], w\[1\], e\) : 100; \},/);
  assert.match(D, /magic: SPELL_CAST_SOUND\[4\] \}\);/);
});

test('SD18b THE HALL: the Ending\'s own stone lit in its light, breathing on the hall\'s clock - in the Hour\'s light channel; the fray\'s arc round once by the Hollow\'s own snap (the Fraying\'s thirty-six)', () => {
  const slot = 5, E = sdEndingOf(sdMarksOf(slot)), k = SD_STONES.findIndex((s) => s.key === E.id);
  const L0 = sdEndingStoneLight(slot, 0), L1 = sdEndingStoneLight(slot, 1);
  const d = realmToDungeon(SD_STONE_POS[k].x, SD_STONE_LIGHT.y, SD_STONE_POS[k].z);
  assert.deepEqual([L0.x, L0.y, L0.z, L0.range, L0.stone], [d[0], d[1], d[2], SD_STONE_LIGHT.range, k]);
  assert.ok(L0.color.every((v, i) => near(v, E.light[i] * SD_STONE_LIGHT.gain * (1 - SD_STONE_LIGHT.breathe))));
  assert.ok(L1.color[0] !== L0.color[0], 'breathing');
  assert.equal(sdEndingStoneLight(null, 0), null);
  assert.match(W, /const stone = sdEndingStoneLight\(modes\?\.sdRealmSlot\?\.\(\) \?\? null, deadlandsSeconds\(\)\);/);
  // the fray's arc by the Hollow's own snap
  const fraySlot = [...Array(216).keys()].map((x) => x + 1).find((sl) => sdMarksOf(sl).includes('fraying'));
  const plainSlot = [...Array(216).keys()].map((x) => x + 1).find((sl) => !sdMarksOf(sl).includes('fraying'));
  assert.equal(orreryOf(fraySlot).fray, 36);
  const arcOf = (s, f) => {
    const made = [];
    const renderer = { createMesh: (m) => { made.push(m); return { id: made.length }; }, destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} };
    const hall = createSdHall({ renderer, s, now: () => 10_000 });
    hall.stand({ dynamicDraws: [], collider: null });
    hall.frame(1 / 60, null, { k: 'pz', s, st: [0, 0, 0, 0, 0, 0], f, lit: 0, ok: false });
    const frays = made.filter((m) => m && m.positions && m.positions.length === (buildFrayModel(SD_FRAY_RING.steps)?.positions.length ?? -1) / SD_FRAY_RING.steps * Math.round((f * SD_FRAY_RING.steps) / orreryOf(s).fray));
    return frays.length;
  };
  assert.equal(arcOf(fraySlot, 18), 1, 'eighteen of thirty-six: half the arc');
  assert.equal(arcOf(plainSlot, 24), 1, 'twenty-four of forty-eight: half the arc');
  const half = buildFrayModel(SD_FRAY_RING.steps / 2).positions.length;
  assert.equal(half * 2, buildFrayModel(SD_FRAY_RING.steps).positions.length);
  assert.equal(SD_FRAY_MAX, 48);
});
