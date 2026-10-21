// FIELD BUGS 2026-10-20f - LANDED-WORD (bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md; ilovemybonk in #general, of the Elite
// Breach: "i cant tell how much and when my spells do as much damage as they do ... It just feels weird when i know ive dumped a
// literal million damage into a redoubt 16 boss and it says at the end it only took 31k damage"). A blow on a body the relay
// runs said its CLAIM on the striker's screen (the formula's number, a spell's held to one blow's cap) while the room landed what
// the member's purse, the lord's own weight and its health allowed - circle 16's lord holds 496.6 s of a solo level-60 member's
// reference, ~32k, and that is all a chart can ever count. Now the room tells the striker what each blow landed (`eland`, to it
// alone) and the screen shows that, as a duel shows the referee's word (INT8). Pinned here, on the director's own breach
// (egBreachNew, egEnter, egStep, egBlow) at the report's depth and every frame folded through the wire's validator:
//   THE WORD - every blow's word says what the lord lost, to its striker alone; their sum is its health gone, the member's
//     damage and its chart's; a blow the room refuses lands 0 and says so;
//   THE HELD LINE - a lord an errand holds at a threshold loses only what is above it, and the word, the member's damage and its
//     chart count that (the seam answered the purse's whole);
//   THE SCREEN - a hit on a body whose room says what lands shows no claim (ui/hitNumbers.js); the room's word shows its number;
//     a relay before the word keeps the claim; the breach client hands the word to the fight and tells it whether its relay says it;
//   THE WIRE - `eland` bounded, the first relay that says it, and the relay this tree builds says it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egFirstHallOf, egCirclePlan, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsAwake, egLordsOf, egTtkRef } from '../../../src/net/eliteGates/egLords.js';
import { egChartOf } from '../../../src/net/eliteGates/egTally.js';
import { egFairNew } from '../../../src/net/eliteGates/egFair.js';
import { EG_FL, egHas } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS, dpsRef } from '../../../src/net/gate/gateBrain.js';
import { validEgOut, EG_RUN_KINDS, RELAY_VERSION, relaySupportsEgLand, EG_LAND_RELAY_MIN } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { numberFor } from '../../../src/ui/hitNumbers.js';
import { setPlayerAttackHook } from '../../../src/combat/formulas.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { readFileSync } from 'node:fs';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LV = 60;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** The report's hall: circle 16's Court, the lord whose fall takes Redoubt 16. */
const C16 = Object.freeze({ seed: 2, c: 16 });

/** A solo member at level LV woken in the Court of circle `c` of `seed`, its lord awake: `cast` lands a spell of `d` on a body
 *  from beside it (`at` where it stands, else beside the body), every frame the room says folded into the screen's state `E()`. */
function court(seed, c) {
  const h = egFirstHallOf(c) + egCirclePlan(seed, c).findIndex((p) => p.kind === 'court'), rng = seeded(seed), co = [['acct-0', 'M0', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = ''; B.dc = [];
  let now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), LV, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 60 * 60_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  let pos = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  let E = { ...EG_STATE_EMPTY, seed, h, b: B.b };
  const fold = (o) => { for (const f of o) { const w = validEgOut(JSON.parse(JSON.stringify({ t: 'eg', ...f }))); if (w) E = foldEg(E, w, now); } return o; };
  const step = () => { now += 250; return fold(egStep(B, now, [{ sub: 'acct-0', ...pos, dead: false, at: now }], rng)); };
  for (let k = 0; k < 4 * 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  for (let k = 0; k < 4 * 30 && !egLordsAwake(B.F); k++) { pos = { sx: spec.x0 + spec.ring.x, z: spec.ring.z, y: spec.ring.y ?? 0 }; step(); }
  assert.ok(egLordsAwake(B.F), 'the lord woke in its ring');
  const lord = egLordsOf(B.F).find((L) => !egHas(L, EG_FL.mirror));
  let q = 1;
  const cast = (b, d, at = null) => { pos = at ?? { sx: spec.x0 + b.x + 1.5, z: b.z, y: b.y ?? 0 }; now += 250; return fold(egBlow(B, 'acct-0', { k: 'hit', i: b.i, q: q++, d, r: HIT_KINDS.Spell }, pos, now)); };
  return { B, spec, h, lord, cast, step, E: () => E, now: () => now, tick: (ms) => (now += ms) };
}
const words = (out) => out.filter((f) => f.k === 'eland');

test('LANDED-WORD (FIELD BUGS 2026-10-20f) THE REPORT: at circle 16\'s Court a solo level-60 member pours big spells on its lord - a million and more claimed - and every blow\'s word, to the member alone, says what the lord lost: their sum is its health gone, the member\'s damage and its chart\'s, all under the lord\'s whole (mutants: no word; the word the claim; the word to everyone; a refusal said nothing)', () => {
  const C = court(C16.seed, C16.c), L = C.lord, hp0 = L.hp;
  assert.ok(Math.abs(L.max - egTtkRef(16) * dpsRef(LV)) < 1, `the lord holds circle 16's ${egTtkRef(16).toFixed(1)} s of the member's reference (${L.max})`);
  let claimed = 0, said = 0, n = 0;
  for (let k = 0; k < 600 && L.hp > 0; k++) {
    const w = words(C.cast(L, 3000));
    claimed += 3000;
    assert.equal(w.length, 1, 'one word a blow');
    assert.deepEqual(Object.keys(w[0]).sort(), ['d', 'i', 'k', 'to']);
    assert.equal(w[0].to, 'acct-0', 'to its striker alone');
    assert.equal(w[0].i, L.i);
    assert.ok(Number.isInteger(w[0].d) && w[0].d >= 0 && w[0].d <= 3000);
    said += w[0].d; n++;
  }
  assert.ok(claimed > 1_000_000, `the claims ran past a million (${claimed})`);
  const lost = hp0 - L.hp, mine = C.B.mem['acct-0'].dh, chart = egChartOf(C.B)[0];
  assert.ok(Math.abs(said - lost) <= n * 0.5 + 1, `the words sum to the health it lost (${said} of ${lost.toFixed(1)})`);
  assert.ok(Math.abs(mine - lost) < 1e-6, 'the member\'s damage is what it lost');
  assert.ok(chart && Math.abs(chart[2] - lost) <= 1 && Math.abs(chart[3] - lost) <= 1, `the chart counts the same, all of it the lord's (${JSON.stringify(chart)})`);
  assert.ok(said <= L.max + n * 0.5, 'never past the lord\'s whole');
  // a refused blow lands nothing, and says so: a member whose trail broke twice in the hall
  const D = court(C16.seed, C16.c);
  D.B.mem['acct-0'].fair = { ...egFairNew(D.h), k: `${D.h}:0`, brk: 1, brks: 2, refuse: D.now() + 60_000 };
  const r = words(D.cast(D.lord, 500));
  assert.deepEqual(r, [{ k: 'eland', i: D.lord.i, d: 0, to: 'acct-0' }], 'the room refused it: 0');
});

test('LANDED-WORD (FIELD BUGS 2026-10-20f) THE HELD LINE: a lord an errand holds at a threshold loses only what stands above it - the word, the member\'s damage and its chart count that, never the purse\'s whole (mutant: the seam answering the purse\'s whole)', () => {
  const C = court(C16.seed, C16.c), L = C.lord;
  C.tick(5000);   // the purse full
  L.hold = 0.5; L.hpFloor = L.hp - 10;   // an errand's held line, ten points under it (net/eliteGates/egLords.js egHoldHp's)
  const hp0 = L.hp, dh0 = C.B.mem['acct-0'].dh;
  const w = words(C.cast(L, 975));
  assert.ok(Math.abs(hp0 - L.hp - 10) < 1e-9, 'it lost the ten above its line');
  assert.deepEqual(w.map((f) => f.d), [10], 'the word says ten');
  assert.ok(Math.abs(C.B.mem['acct-0'].dh - dh0 - 10) < 1e-9, 'the member\'s damage grew by ten');
});

test('LANDED-WORD (FIELD BUGS 2026-10-20f) THE SCREEN: a hit on a body whose room says what lands shows no claim, a miss and a turned blow still say theirs; the fight marks its stand-ins while its relay says the word and shows each word as a blow\'s number - 0 included; a relay before it keeps the claim; the breach client hands the word to the fight and tells it whether its relay says it (mutants: the claim shown beside the word; the stand-ins never marked; the word dropped; the client never asking its relay)', async () => {
  assert.equal(numberFor({ hit: true, damage: 780, target: { landsByWord: true } }), null, 'no claim');
  assert.equal(numberFor({ hit: false, target: { landsByWord: true } }).text, 'Miss');
  assert.equal(numberFor({ hit: true, damage: 780, target: { landsByWord: true, warded: true, wardText: 'No footing' } }).text, 'No footing');
  assert.equal(numberFor({ hit: true, damage: 780, target: { landsByWord: false } }).text, '780', 'a relay before the word: the claim');
  const C = court(C16.seed, C16.c), L = C.lord;
  const shown = [];
  setPlayerAttackHook((r) => shown.push(numberFor(r)));
  try {
    // the real fight driver over a stub renderer (fb1018f_turnedblow's): a body is drawn, and offered to my blows, once its look loads
    const tex = (archive) => ({ archive, recordCount: 30, getFrameCount: () => 5, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) });
    const feet = egToDungeon(C.spec, C.spec.ring.x, C.spec.ring.y ?? 0, C.spec.ring.z);
    const fight = createEgFight({ renderer: { textures: { has: () => true }, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 1] }), destroyBillboardBatch: () => {} },
      link: { state: () => C.E(), now: () => C.now() }, now: () => C.now(), feet: () => feet, cam: () => [feet[0], feet[1] + 1.6, feet[2] - 6], player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0',
      getTexture: async (a) => tex(a), uploadRecordFrame: () => {}, strike: () => {}, save: () => 0, sendHit: () => true, peerAt: () => null });
    fight.landsWord(true);
    fight.frame(); await new Promise((r) => setImmediate(r)); fight.frame();
    const t = fight.hostTargets().find((x) => x.i === L.i);
    assert.ok(t?.entity?.landsByWord === true, 'the lord\'s stand-in waits for the word');
    assert.equal(fight.landed(L.i, 123), true);
    assert.equal(fight.landed(L.i, 0), true);
    assert.deepEqual(shown.map((n) => n?.text), ['123', '0'], 'each word a number');
    fight.landsWord(false);
    fight.frame(); await new Promise((r) => setImmediate(r)); fight.frame();
    assert.equal(t.entity.landsByWord, false, 'a relay before the word: its claims shown again');
    assert.equal(fight.landed(L.i, 50), false, 'and no word shown');
    fight.leave?.();
  } finally { setPlayerAttackHook(null); }
  // the breach client: the word to the fight, and whether its relay says it
  const calls = [];
  const stub = { landed: (i, d) => calls.push(['landed', i, d]), landsWord: (on) => calls.push(['word', on]), frame() {}, leave() {} };
  const modes = { mode: 'dungeon', egHallBreach: () => C.B.b, egHallCircle: () => 16, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, egLandOk: true, sendEg: () => true };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => C.now(),
    entity: { level: LV, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] }, player: { pos: egToDungeon(C.spec, C.spec.ring.x, C.spec.ring.y ?? 0, C.spec.ring.z), height: 1.8, grounded: true, collider: { move: () => {} } }, cam: { pos: [0, 0, 0] },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], fight: () => stub });
  const { k: _k, ...st } = egStateOf(C.B, C.now());
  client.word(validEgOut(JSON.parse(JSON.stringify({ t: 'eg', k: 'st', ...st }))));
  client.frame();
  client.word(validEgOut({ t: 'eg', k: 'eland', i: L.i, d: 321 }));
  assert.deepEqual(calls.filter((c) => c[0] === 'landed'), [['landed', L.i, 321]], 'the word to the fight');
  assert.deepEqual(calls.find((c) => c[0] === 'word'), ['word', true], 'and whether the relay says it');
});

test('LANDED-WORD (FIELD BUGS 2026-10-20f) THE WIRE: `eland` is a body\'s number and whole points from nought, nothing else; the first relay that says it is world237, and the relay this tree builds says it (mutants: a fraction carried; the relay before it trusted)', () => {
  assert.ok(EG_RUN_KINDS.includes('eland'));
  assert.deepEqual(validEgOut({ t: 'eg', k: 'eland', i: 7, d: 780 }), { k: 'eland', i: 7, d: 780 });
  assert.deepEqual(validEgOut({ t: 'eg', k: 'eland', i: 7, d: 0 }), { k: 'eland', i: 7, d: 0 });
  for (const bad of [{ i: 7, d: -1 }, { i: 7, d: 1.5 }, { i: 0, d: 5 }, { i: 7 }, { i: 7, d: 2e8 }]) assert.equal(validEgOut({ t: 'eg', k: 'eland', ...bad }), null, JSON.stringify(bad));
  assert.equal(EG_LAND_RELAY_MIN, 237);
  assert.deepEqual([relaySupportsEgLand('world237'), relaySupportsEgLand('world236'), relaySupportsEgLand(''), relaySupportsEgLand(null)], [true, false, false, false]);
  assert.ok(relaySupportsEgLand(RELAY_VERSION), 'the relay this tree builds says the word');
  // the page reads it off its relay's welcome, as every relay's word is read (net/online.js - courtwatch.test.js's pin's shape)
  assert.match(readFileSync(new URL('../../../src/net/online.js', import.meta.url), 'utf8'), /if \(primary\) this\.egLandOk = relaySupportsEgLand\(relayV\);/, 'read off the welcome');
});

test('LANDED-WORD (FIELD BUGS 2026-10-20f) THE FOLLOW-UP: a follow-up blow on a body whose room says what lands (Many Endings\' echo, owed to the blow\'s one claim - systems/playerDoor.js oweFoe) raises no claim of its own: the room\'s word for that blow is its number; on a body the room does not answer for, it rises as before (mutants: the follow-up\'s claim shown on a breach body; the loot\'s or the martial path\'s target never handed over)', async () => {
  const LR = await import('../../../src/systems/loot/lootRarity.js');
  const LP = await import('../../../src/systems/loot/lootPowers.js');
  const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
  const { _resetSetPowersForTests } = await import('../../../src/systems/sigil/sigilSetPowers.js');
  const { setPlayerDoor, takeOwed } = await import('../../../src/systems/playerDoor.js');
  const { equipItem } = await import('../../../src/systems/equip.js');
  const { mintCondition } = await import('../../../src/systems/item/itemTemplates.js');
  const { mountHitNumbers, unmountHitNumbers } = await import('../../../src/ui/hitNumbers.js');
  const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
  const stats = () => ({ strength: 70, intelligence: 50, willpower: 50, agility: 70, endurance: 50, personality: 50, speed: 50, luck: 50 });
  const me = { isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(60), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 100 };
  // a breach body's stand-in, as the fight marks it (THE SCREEN above), and a local foe for the control
  const C = court(C16.seed, C16.c), standIn = { ...C.lord, landsByWord: true }, mob = { careerIndex: 7, career: {}, health: 5000, maxHealth: 5000, stats: stats(), skills: new Array(35).fill(10), level: 1, items: [], activeEffects: [], armorValues: new Array(7).fill(60) };
  const nodes = [];
  const fakeEl = (tag) => { const el = { tag, children: [], style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, className: '', textContent: '', append(...c) { this.children.push(...c); }, isConnected: true, addEventListener() {}, remove() { this.isConnected = false; }, setAttribute() {} }; nodes.push(el); return el; };
  globalThis.document = { createElement: fakeEl, getElementById: () => null, body: fakeEl('body') };
  const raised = () => nodes.filter((n) => n.className?.startsWith('hitnum ')).map((n) => [n.textContent, n.children[0]?.textContent ?? null]);
  try {
    _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests();
    mountHitNumbers();
    const rec = LR.legendaryById('warp-edge');
    const edge = LR.applyRarity(mintCondition({ group: rec.group, templateIndex: rec.templates[0], material: 0, flags: 0 }), 'legendary', lcg(1), [rec]);
    edge.isIdentified = true; me.items.push(edge); equipItem(me, edge);
    LP._setLootPowersRandForTests(() => 0);   // the echo every time
    setPlayerDoor({ foes: () => [{ entity: mob, ai: { feet: [0, 0, 0] }, dead: false }], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
    LP.lootStrike(me, standIn, 30, edge);
    assert.deepEqual(raised(), [], 'no claim on the breach body: the room\'s word is its number');
    assert.equal(takeOwed(standIn), 30, 'the echo still rides the blow\'s claim, which the room weighs');
    LP.lootStrike(me, mob, 30, edge);
    assert.deepEqual(raised(), [['30', 'Many Endings']], 'on a foe of this machine\'s, its number as before');
  } finally { LP._setLootPowersRandForTests(null); unmountHitNumbers(); setPlayerDoor(null); delete globalThis.document; }
  // the martial path hands its target the same way (systems/martialPowers.js again - its source, as AUDIT MARTIAL L1 N1 reads it)
  assert.match(readFileSync(new URL('../../../src/systems/martialPowers.js', import.meta.url), 'utf8'), /if \(!f\?\.dead\) showFollowUp\(n, word, entity\);/);
});
