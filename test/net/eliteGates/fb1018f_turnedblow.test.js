// FIELD BUGS 2026-10-18f TURNED-BLOW (bible/01-Overview/bugs/ - Low_Poly_Gaming, "Weir Key Generated Elite Breach bugs":
// "Imps that follow you around won't die after hitting several times. Its an exploit for heals if you have a vampiric weapon
// to heal yourself during the breach run"). The imps are the legion's Harriers (net/eliteGates/egLegion.js), which on a span
// shadow the company along its platforms (bible/11-Multiplayer/Elite-Gates.md section 8.2). A blow struck from traversal
// ground strikes nothing (EG-ZB, section 11.7) - the relay refused every one, while the screen offered the Harrier as a target,
// bled it, flashed it, sent the blow and let every heal of a landed blow answer it: a vampiric blade healed the whole claim off
// a foe that never lost a point. The screen now asks the relay's own law (net/eliteGates/egBodies.js egStrikeTurned, over
// egStruckOff - the rule the relay's egBlow calls) and turns what the relay will refuse: the body's stand-in `warded`, the
// word every heal and power already refuses, its number "No footing", nothing sent. Driven on the real relay (egBrain over
// egBodies and egLegion), the real link (egLink foldEg), the real fight driver (scenes/eliteGates/egFight.js) over a stub
// renderer, and the real formula and strike listener (combat/formulas.js, systems/loot/lootPowers.js). On the code before the
// fix every assertion that the screen turns a blow fails - the stand-in was never warded, and the heal was the whole claim.
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL, egBodiesOf, egBodyWire, egStruckOff, egStrikeTurned, egLordAsleep, EG_TURNS_FL } from '../../../src/net/eliteGates/egBodies.js';
import { egStoreyApart, egOutOfReach, egRisen, egRadiusWire, egFightState } from '../../../src/net/eliteGates/egBodies.js';   // AUDIT FB1018f L3-4, L3-6
import { EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { EG_KIND, egLegionRaise } from '../../../src/net/eliteGates/egLegion.js';
import { egFightView, egGroundAt, EG_STRIKE_PAD_M } from '../../../src/net/eliteGates/egWalkGraph.js';
import { foldEg, EG_STATE_EMPTY, egBodyOf } from '../../../src/net/eliteGates/egLink.js';
import { validEgOut } from '../../../src/net/wire.js';
import { createEgFight, egNoFooting } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { calculateAttackDamage, setPlayerAttackHook } from '../../../src/combat/formulas.js';
import { createStandInSpell } from '../../../src/scenes/gate/standInSpell.js';   // FIELD BUGS 2026-10-19f STAND-IN-WHOLE: the spell doors, one
import { bossStandIn, crystalStandIn, hostStandIn, bossLookOf } from '../../../src/world/gate/gateBoss.js';
import { buildCustomSpell } from '../../../src/systems/spell/spellMaker.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { ENCHANTMENT_TYPES } from '../../../src/systems/enchantments.js';
import { numberFor } from '../../../src/ui/hitNumbers.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000, ME = 'acct-0', NOOP = () => {};
const tex = (archive) => ({ archive, recordCount: 30, getFrameCount: () => 5, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) });
const tick = () => new Promise((r) => setImmediate(r));

/**
 * A breach of two in hall `h` of `seed` (the law as it stands), its trial woken; the relay's frames folded through the real link
 * into the real fight driver over a stub renderer. `at(x, z, y)` stands me there on both sides (the relay's pose, my feet on the
 * screen), `step(ms)` beats the relay and the screen once, `sent` every blow the screen sent.
 */
async function spire(seed, h, { wake = true } = {}) {
  const spec = egHallOf(seed, h, 0);
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [[ME, 'M0', 30], ['acct-1', 'M1', 30]];
  let now = T0;
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'M0', ew: 0, rh: 0, seed, op: now - EG_SEALED_MS - 1000, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const arrive = { x: spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  const pos = { [ME]: { sx: spec.x0 + arrive.x, z: arrive.z, y: arrive.y }, 'acct-1': { sx: spec.x0 + arrive.x + 0.5, z: arrive.z, y: arrive.y } };
  let E = { ...EG_STATE_EMPTY, b: B.b, seed: B.seed, geo: 0 };   // the breach this screen stands in (its call's word), its stage and fight the room's
  const words = [];   // AUDIT FB1018f L3-1: every word the screen heard, in order
  const tell = (w) => { if (!w || (w.to && w.to !== ME)) return; const v = validEgOut(JSON.parse(JSON.stringify(w))); if (v) { words.push(v); E = foldEg(E, v, now); } };
  const centre = egHallCentre(spec), feet = [centre[0] + arrive.x, centre[1] + arrive.y, centre[2] + arrive.z], sent = [];
  const fight = createEgFight({ renderer: { textures: { has: () => true }, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 1] }), destroyBillboardBatch: NOOP },
    link: { state: () => E }, now: () => now, feet: () => feet, cam: () => [feet[0], feet[1] + 1.6, feet[2] - 6], player: () => ({ health: 100, maxHealth: 100 }), me: () => ME,
    getTexture: async (a) => tex(a), uploadRecordFrame: NOOP, strike: NOOP, save: () => 0, sendHit: (hh) => { sent.push(hh); return true; } });
  const at = (x, z, y = 0, who = ME) => { pos[who] = { sx: spec.x0 + x, z, y }; if (who === ME) { feet[0] = centre[0] + x; feet[1] = centre[1] + y; feet[2] = centre[2] + z; } };
  const step = async (ms = 250) => {
    now += ms;
    for (const w of egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng)) tell(w);
    fight.frame(); await tick(); fight.frame();
  };
  for (let k = 0; k < 60 && wake && B.sg !== 'trial'; k++) await step();
  if (wake) assert.equal(B.sg, 'trial', `hall ${h} woke`);
  assert.deepEqual([E.b, E.seed, E.h, E.fight.h], [B.b, B.seed, h, h], 'the screen holds the breach, its hall and its fight');
  /** The screen's target for body `i` this frame (its stand-in), or null. */
  const target = (i) => fight.hostTargets().find((q) => q.i === i) ?? null;
  /** A blow of 40 from where I stand on the relay - what it landed on body `i`. */
  let q = 1;
  const relayBlow = (i, r = HIT_KINDS.Melee) => { const b = B.F.bodies.find((x) => x.i === i), hp = b.hp; egBlow(B, ME, { k: 'hit', i, q: q++, d: 40, r }, pos[ME], now + 600 * q); return hp - b.hp; };
  return { B, spec, fight, at, step, target, relayBlow, sent, E: () => E, now: () => now, tell, words };
}
/** The first hall of `kind` in seed's first circles, the law as it stands. */
const hallOf = (seed, kind) => { for (let h = 1; h <= 15; h++) if (egHallOf(seed, h, 0).kind === kind) return h; return 0; };

test('TURNED-BLOW THE IMPS (Elite-Gates.md sections 8.2 and 11.7): on a span the Harriers shadow me along its platforms, and from a platform the relay takes nothing of ten blows (EG-ZB) - the screen, by the relay\'s own law, now turns each: its stand-in warded with "No footing", the blow neither sent nor flashed; from an island the relay lands it and the screen offers it whole (mutants: the ground rule gone from the law; the screen\'s turn dropped; the turn kept off the stand-in; the door that sends it unguarded; the ground\'s word dropped; the relay\'s call of the law dropped)', async () => {
  const h = hallOf(12345, 'span');
  assert.ok(h > 0, 'a span in the first circle');
  const S = await spire(12345, h), view = egFightView(S.spec);
  const plat = S.spec.steps.find((p) => !egGroundAt(view, p.x, p.y ?? 0, p.z, EG_STRIKE_PAD_M));
  const isle = S.spec.islands.find((i) => egGroundAt(view, i.x, i.y ?? 0, i.z, 0));
  assert.ok(plat && isle, 'a platform off the fight ground, an island on it');
  S.at(plat.x, plat.z, plat.y ?? 0);
  for (let k = 0; k < 80; k++) await S.step();
  const near = egBodiesOf(S.B.F, EG_ROLE.add).filter((a) => a.k === EG_KIND.harrier && Math.hypot(a.x - plat.x, a.z - plat.z) <= 2.5);
  assert.ok(near.length > 0, 'the Harriers shadow me on the platform');
  for (const a of near) {
    const t = S.target(a.i);
    assert.ok(t, 'offered as a body my swing meets');
    assert.equal(t.entity.warded, true, 'its stand-in warded: the relay will take nothing of a blow from here');
    assert.equal(t.entity.wardText, egNoFooting(), 'and the number says why');
    assert.deepEqual(numberFor({ hit: true, damage: 40, target: t.entity }), { kind: 'warded', text: 'No footing', tag: null }, 'never a number');
    const sent = S.sent.length, hurtAt = S.E().fight.bodies.find((b) => b.i === a.i).hurtAt;
    assert.equal(S.fight.hostHit({ i: a.i, d: 40, r: HIT_KINDS.Melee }), false, 'the blow is not sent');
    assert.equal(S.sent.length, sent);
    assert.equal(S.E().fight.bodies.find((b) => b.i === a.i).hurtAt, hurtAt, 'nor flashes it');
  }
  const a = near[0], hp0 = a.hp;
  let landed = 0;
  for (let k = 0; k < 10; k++) landed += S.relayBlow(a.i);
  assert.equal(landed, 0, 'the relay: ten blows from the platform land nothing');
  assert.equal(a.hp, hp0);
  assert.equal(egStruckOff(view, a, plat.x, plat.y ?? 0, plat.z), true, 'the one law says so');
  // on an island the shadow is struck, on both sides
  S.at(isle.x, isle.z, isle.y ?? 0);
  for (let k = 0; k < 40; k++) await S.step();
  const by = egBodiesOf(S.B.F, EG_ROLE.add).filter((b) => b.k === EG_KIND.harrier).sort((p, r) => Math.hypot(p.x - isle.x, p.z - isle.z) - Math.hypot(r.x - isle.x, r.z - isle.z))[0];
  const t = S.target(by.i);
  assert.equal(t.entity.warded, false, 'on the fight ground: whole');
  assert.equal(t.entity.wardText, null);
  assert.equal(S.fight.hostHit({ i: by.i, d: 40, r: HIT_KINDS.Melee }), true, 'sent');
  assert.equal(S.sent.at(-1).i, by.i);
  assert.ok(S.relayBlow(by.i) > 0, 'and the relay lands it');
  assert.equal(egStruckOff(view, by, isle.x, isle.y ?? 0, isle.z), false);
  // the one law: the relay's egBlow asks it, and no second copy of the rule stands in src/
  assert.match(rd('src/net/eliteGates/egBrain.js'), /if \(egStruckOff\(view, body, p\.x, p\.y, p\.z\)\) return land\(0\);/, 'the relay asks the law');   // PIN MOVED (FIELD BUGS 2026-10-20f LANDED-WORD): a blow it refuses lands 0 and says so to its striker
  assert.equal((rd('src/net/eliteGates/egBrain.js').match(/egGroundAt\(view, body\.x, egFeetY\(view, body\.y\)/g) ?? []).length, 0, 'no second copy of the rule');
});

test('TURNED-BLOW THE HEAL, END TO END: a vampiric blade (Vampiric Effect, when strikes) with a leech line, through the real formula and the real strike listener on the screen\'s own stand-in - a blow the relay will refuse heals nothing; the same blow on a body it will take heals the claim and its leech (mutants: the stand-in never warded; Vampiric Effect blind to the ward)', async () => {
  _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests();
  const h = hallOf(12345, 'span');
  const S = await spire(12345, h), view = egFightView(S.spec);
  const plat = S.spec.steps.find((p) => !egGroundAt(view, p.x, p.y ?? 0, p.z, EG_STRIKE_PAD_M));
  S.at(plat.x, plat.z, plat.y ?? 0);
  for (let k = 0; k < 80; k++) await S.step();
  const a = egBodiesOf(S.B.F, EG_ROLE.add).find((b) => b.k === EG_KIND.harrier && Math.hypot(b.x - plat.x, b.z - plat.z) <= 2.5);
  const standIn = S.target(a.i).entity;
  const blade = () => Object.assign(createWeapon(120, 0, () => 0.5), { rarity: 'rare', affixes: [{ id: 'leech', value: 10 }], enchantments: [{ type: ENCHANTMENT_TYPES.VampiricEffect, param: 1 }], currentCondition: 1000, maxCondition: 1000 });
  const me = () => ({ isPlayer: true, level: 30, items: [], career: {}, activeEffects: [], skills: new Array(35).fill(60), skillUses: new Array(35).fill(0), armor: 0, health: 100, maxHealth: 1000, magicka: 0, maxMagicka: 100,
    stats: { strength: 75, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 } });
  const swing = (k) => { const p = me(), d = calculateAttackDamage(p, standIn, { weapon: blade(), toHitMod: 1000, rolls: () => (k + 0.5) / 20 }); return { d, healed: p.health - 100 }; };
  assert.equal(standIn.warded, true);
  let claimed = 0;
  for (let k = 0; k < 20; k++) { const { d, healed } = swing(k); claimed += d; assert.equal(healed, 0, `a turned blow of ${d} heals nothing`); }
  assert.ok(claimed > 100, `the blows claimed ${claimed}`);
  // the same stand-in, the ward lifted (as the screen lifts it on the fight ground): the claim heals, and its leech
  standIn.warded = false;
  let any = 0;
  for (let k = 0; k < 20; k++) { const { d, healed } = swing(k); if (d > 0) { any++; assert.ok(healed >= d + Math.floor(d / 10) && healed <= d + Math.ceil(d / 10) + 1, `a blow of ${d} heals it and its tenth (${healed}; the leech carries its fractions - systems/playerHeal.js healMine)`); } }
  assert.ok(any > 0);
});

test('TURNED-BLOW THE WARDS AND THE SLEEPERS (sections 8.6 and 12): the relay takes nothing through a ward (a Vengeful Shade, warded from its rise) nor from a lord asleep (a Court\'s, before its wake ring) - the screen turns both, in the ward\'s own word; it never turns a woken lord, a mirror (stood awake, no phase said) or a body on the fight ground; an errand\'s object struck from traversal ground is turned in the ground\'s word, from the floor whole; the strike\'s pad is the relay\'s (mutants: the ward\'s flag out of the turned set; the sleeper\'s rule dropped; a mirror taken for a sleeper; the friend and the vanished out of the set; the ground\'s word on a ward\'s blow; the pad dropped; the object\'s turn dropped)', async () => {
  // a Vengeful Shade on a Yard's floor: the relay lands nothing through its ward; the screen's body of it turns
  const Y = await spire(12345, hallOf(12345, 'yard')), f = Y.spec.fl[0];
  Y.at(f.x, f.z, f.y ?? 0); Y.at(f.x + 1, f.z, f.y ?? 0, 'acct-1');
  await Y.step();
  const out = [];
  const [shade] = egLegionRaise(Y.B.F, [EG_KIND.shade], [[f.x + 1.5, f.z]], Y.now(), out);
  shade.up = Y.now();
  for (const w of out) Y.tell(w);
  await Y.step(100);
  assert.ok((shade.fl & EG_FL.ward) !== 0, 'the shade rises warded');
  assert.equal(Y.relayBlow(shade.i), 0, 'the relay: nothing through the ward');
  const ts = Y.target(shade.i);
  assert.ok(ts, 'the screen offers it');
  assert.equal(ts.entity.warded, true, 'and turns it');
  assert.equal(ts.entity.wardText, null, 'in the ward\'s own word');
  assert.deepEqual(numberFor({ hit: true, damage: 40, target: ts.entity }).text, 'Warded');
  for (const fl of [EG_FL.friend, EG_FL.hidden, EG_FL.ward]) assert.ok((EG_TURNS_FL & fl) !== 0, 'the turned set: a friend, a vanished lord, a ward');
  // the pad: struck from the fight ground within EG_STRIKE_PAD_M of its plan, never past it (the relay's own measure)
  const yv = egFightView(Y.spec);
  assert.equal(egStruckOff(yv, shade, f.x + f.r + EG_STRIKE_PAD_M - 0.1, f.y ?? 0, f.z), false, 'inside the pad: struck');
  assert.equal(egStruckOff(yv, shade, f.x + f.r + EG_STRIKE_PAD_M + 0.1, f.y ?? 0, f.z), true, 'past it: traversal ground');
  // an errand's object on the floor (a rift) struck from the arrival plate: refused by the relay, turned on the screen in the
  // ground's word; from beside it on the floor, whole on both
  const rift = Y.B.F.bodies.find((b) => b.role === EG_ROLE.obj && b.hp > 0 && !(b.fl & EG_FL.ward));
  Y.at(Y.spec.arrive.x, Y.spec.arrive.z, Y.spec.arrive.y ?? 0);
  await Y.step();
  assert.equal(Y.target(rift.i).entity.warded, true, 'a rift struck from the plate: turned');
  assert.equal(Y.target(rift.i).entity.wardText, egNoFooting());
  assert.equal(Y.relayBlow(rift.i), 0, 'the relay: nothing');
  Y.at(rift.x - (rift.x - f.x) * 0.1, rift.z - (rift.z - f.z) * 0.1, f.y ?? 0);
  await Y.step();
  assert.equal(Y.target(rift.i).entity.warded, false, 'from beside it on the floor: whole');
  assert.ok(Y.relayBlow(rift.i) > 0, 'and the relay lands it');
  // a Court's lord asleep: no blow lands until its wake ring; then it does, and the screen turns it no more
  const C = await spire(12345, hallOf(12345, 'court'));
  const L = C.B.F.bodies.find((b) => b.role === EG_ROLE.lord), ring = C.spec.ring;   // the wake ring (section 8.6)
  assert.ok(L && !L.up2, 'the lord stands asleep');
  C.at(L.x + 1.5, L.z, L.y ?? 0);
  await C.step();
  if (L.up2) assert.fail('woke before the pin could ask it asleep');
  assert.equal(C.relayBlow(L.i), 0, 'the relay: a lord asleep takes no blow');
  const tl = C.target(L.i);
  assert.equal(egLordAsleep(C.E().fight.bodies.find((b) => b.i === L.i)), true, 'the screen holds it asleep (no phase said)');
  assert.equal(tl.entity.warded, true, 'and turns the blow');
  // a mirror is stood awake and says no phase: never a sleeper
  const mirror = egBodyOf(Object.assign(egBodyWire(L), { 8: L.fl | EG_FL.mirror }), C.now());
  assert.equal(egLordAsleep(mirror), false, 'a mirror is no sleeper');
  // woken (the company in its ring): the blow lands, and the screen offers it whole
  C.at(ring.x, ring.z, ring.y ?? 0); C.at(ring.x + 1, ring.z, ring.y ?? 0, 'acct-1');
  for (let k = 0; k < 120 && !L.up2; k++) await C.step();
  assert.ok(L.up2, 'the wake ring woke it');
  for (let k = 0; k < 12; k++) await C.step();
  C.at(L.x + 1.5, L.z, L.y ?? 0);
  await C.step();
  assert.equal(C.target(L.i).entity.warded, false, 'awake on the fight ground: whole');
  assert.equal(egStrikeTurned(egFightView(C.spec), C.E().fight.bodies.find((b) => b.i === L.i), L.x + 1.5, L.y ?? 0, L.z), false);
});

test('TURNED-BLOW THE HOST\'S SWING AND SHAFT (scenes/dungeonContext.js - buildDungeonContext does not run in Node, so its wiring is pinned by its text): a swing or a shaft on a body whose stand-in is warded rings off it as the Warden\'s ward does - no blood, nothing sent - and a turned shaft flies no further (mutants: the swing\'s ring dropped; the shaft\'s ring dropped)', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  const swing = dc.slice(dc.indexOf('  function swingOnHost(hb, damage, lookDir) {'), dc.indexOf('  function spellOnHost('));
  assert.match(swing, /^ {2}function swingOnHost\(hb, damage, lookDir\) \{\n {4}if \(hb\.entity\.warded\) wardTurns\(hb\);[^\n]*\n {4}else if \(damage <= 0\) \{/, 'the swing: the ward\'s ring first, then a zero blow\'s parry, else the blood and the number out');
  // PIN MOVED (AUDIT FB1018f L3-7): the turned shaft says its word beside the ring (THE TURNED BLOW SAYS ITS WORD, below)
  assert.match(dc, /\n {12}if \(hb\.entity\.warded\) \{ wardTurns\(hb\); [^\n]*\}[^\n]*\n {12}else playerArrowHitFoe\(m, hb, \{[^\n]*landOnHost\(hb, d, HIT_KINDS\.Shaft\)[^\n]*\n {12}if \(!hb\.entity\.warded && techniquePierces\(m, hb\)\) continue;/, 'the shaft: the ward\'s ring, else the one player-arrow law');
  assert.match(dc, /function wardTurns\(boss\) \{ audio\.play3d\(SOUND\.Parry6, bossChest\(boss\)/, 'the ring is the ward\'s own, at the body\'s chest');
});

// ── AUDIT FB1018f lane L3 ─────────────────────────────────────────────────────────────────────────────────────────

test('TURNED-BLOW THE WAKE SAID AT ONCE (AUDIT FB1018f L3-1; section 8.6): a Court\'s lord woken by its wake ring says its first phase in the beat that wakes it (`eph` - the screen holds a lord asleep until it hears a phase, and the whole fight\'s word came up to two seconds later), so on the next frame the screen holds it awake and offers it whole, the blow sent and landed; that first phase turns no card (mutants: the wake\'s phase unsaid; the wake folded as a phase turn)', async () => {
  const C = await spire(12345, hallOf(12345, 'court'));
  const L = C.B.F.bodies.find((b) => b.role === EG_ROLE.lord), ring = C.spec.ring;
  assert.ok(L && !L.up2, 'the lord stands asleep');
  C.at(ring.x, ring.z, ring.y ?? 0); C.at(ring.x + 1, ring.z, ring.y ?? 0, 'acct-1');
  let from = C.words.length;
  for (let k = 0; k < 120 && !L.up2; k++) { from = C.words.length; await C.step(100); }
  assert.ok(L.up2, 'the wake ring woke it');
  const heard = C.words.slice(from);
  assert.ok(!heard.some((w) => w.k === 'efs'), 'no whole fight in the beat that woke it - its phase came by its own word');
  assert.deepEqual(heard.filter((w) => w.k === 'eph').map((w) => [w.i, w.ph]), [[L.i, 1]], 'its first phase, said at its wake');
  const seen = C.E().fight.bodies.find((b) => b.i === L.i);
  assert.equal(seen.ph, 1);
  assert.equal(egLordAsleep(seen), false, 'the screen holds it awake');
  assert.deepEqual(C.E().fight.phases.filter((p) => p.i === L.i), [], 'a wake turns no phase - no card, no growl');
  // beside it, the next frame - no beat of the relay between, so no other word could have woken it here
  C.at(L.x + 1.5, L.z, L.y ?? 0);
  C.fight.frame(); await tick(); C.fight.frame();
  const t = C.target(L.i);
  assert.equal(t.entity.warded, false, 'offered whole');
  assert.equal(C.fight.hostHit({ i: L.i, d: 40, r: HIT_KINDS.Melee }), true, 'and the blow sent');
  assert.ok(C.relayBlow(L.i) > 0, 'which the relay lands');
});

test('TURNED-BLOW THE STOREY (AUDIT FB1018f L3-6; Elite-Gates-Ascent.md section 2): on a span of THE ASCENT\'s law, a Harrier on an island 14 m over mine is turned on the screen (its stand-in warded, the ward\'s word, never sent) as the relay refuses it (five shafts land nothing); one on my own island whole on both - the one storey law (egStoreyApart) the relay\'s egHitBody and the screen\'s egStrikeTurned both call, and the screen asks it where the body stands now (mutants: the screen blind to the storey; the body\'s height read at its word, not where its walk has carried it; the relay\'s storey unasked)', async () => {
  const S = await spire(12345, 7), view = egFightView(S.spec);
  assert.equal(S.spec.kind, 'span');
  const isl = S.spec.islands.filter((i) => egGroundAt(view, i.x, i.y ?? 0, i.z, 0));
  let best = null;
  for (const a of isl) for (const b of isl) { const dy = (b.y ?? 0) - (a.y ?? 0); if (dy < 4.5) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (!best || d < best.d) best = { a, b, d }; }
  assert.ok(best, 'two islands a storey apart');
  const { a: lo, b: hi } = best;
  S.at(lo.x, lo.z, lo.y ?? 0); S.at(hi.x, hi.z, hi.y ?? 0, 'acct-1');
  for (let k = 0; k < 100; k++) await S.step();
  const near = (p) => egBodiesOf(S.B.F, EG_ROLE.add).filter((x) => x.k === EG_KIND.harrier && Math.abs((x.y ?? 0) - (p.y ?? 0)) < 2).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
  const up = near(hi), mine = near(lo);
  assert.ok(up && mine, 'a Harrier shadows each of us, on each island');
  // FB1018D BANNER-SHAFT, one law with it (merged): a swing is refused by the storey alone, a shaft or a spell only through a
  // floor - and two islands of a span stand in the open air, so a shaft from mine lands on the high one's Harrier, on both sides
  assert.equal(egStoreyApart(view, lo.x, lo.y ?? 0, lo.z, up.x, up.y, up.z, true), true, 'the law: a storey over me, for a swing');
  assert.equal(egStoreyApart(view, lo.x, lo.y ?? 0, lo.z, up.x, up.y, up.z, false), false, 'and no floor between us, for a shaft');
  // but an island is no piece of the hall's own fight floor, and from off it a blow reaches only so far (egOutOfReach - the
  // relay's egHitBody, found merging FB1018D: the storey had turned this one first, and the screen never asked the reach)
  assert.equal(egOutOfReach(S.spec, lo.x, lo.y ?? 0, lo.z, up, up.x, up.z), true, 'off the floor, past reach');
  const t = S.target(up.i);
  assert.ok(t, 'the screen still draws it');
  assert.equal(t.entity.warded, true, 'turned on the screen');
  const n = S.sent.length;
  assert.equal(S.fight.hostHit({ i: up.i, d: 40, r: HIT_KINDS.Shaft }), false, 'never sent');
  assert.equal(S.sent.length, n);
  let landed = 0;
  for (let k = 0; k < 5; k++) landed += S.relayBlow(up.i, HIT_KINDS.Shaft);
  assert.equal(landed, 0, 'as the relay lands nothing');
  assert.equal(S.target(mine.i).entity.warded, false, 'on my own storey: whole');
  // where the body stands NOW, through a floor: two floors stacked over one plan, a body walking from the lower to the upper,
  // asked once its walk has carried it there
  const stacked = { ...S.spec, kind: 'court', fl: [{ t: 'd', x: 0, z: 0, r: 20, y: 0 }, { t: 'd', x: 0, z: 0, r: 20, y: 8 }] };
  const walker = { i: 99, role: EG_ROLE.add, k: EG_KIND.harrier, x: 0, z: 0, y: 0, fl: 0, mv: { x: 0, z: 0, y: 0, tx: 1, tz: 0, ty: 8, v: 5, at: 0 } };
  assert.equal(egStrikeTurned(stacked, walker, 0.5, 0, 0, 0), false, 'at its word: on my floor');
  assert.equal(egStrikeTurned(stacked, walker, 0.5, 0, 0, 60_000), true, 'carried up: a floor between us');
  assert.equal(egStrikeTurned(stacked, walker, 0.5, 8, 0, 60_000), false, 'and on the upper floor with it');
  // one law: both sides call it, and no copy of the storey rule stands in egHitBody
  const src = rd('src/net/eliteGates/egBodies.js');
  assert.match(src, /if \(egStoreyApart\(F\.view \?\? spec, pose\.x, pose\.y, pose\.z, bx, b\.y, bz, r === HIT_KINDS\.Melee\)\) return \{ got: 0, b: null \};/, 'the relay asks the law, with the blow\'s kind');
  assert.equal((src.match(/!egOneStorey\(sm, sb\)/g) ?? []).length, 1, 'the rule written once');
  assert.equal((src.match(/!egOneStorey\(egStoreyY\(/g) ?? []).length, 0, 'and nowhere else');
});

test('TURNED-BLOW THE OBJECT\'S RADIUS (AUDIT FB1018f L3-4): an errand\'s object is struck from beside it off the floor by its own radius (egStruckOff) - a spark\'s 0.6, a chain\'s 0.8, an anchor\'s 0.9, a false wall\'s 1, a rift\'s 1.3, a Wellspring\'s spring 2.2 (a rift too: no kind says it) - and the screen now hears that radius, said beside each body\'s row of nineteen (`ead` and `efs`, through the real wire and link): at every gap off a floor\'s edge the screen judges a blow as the relay does; a word that says none (a relay before it) still folds, a malformed list is refused (mutants: the radius unsaid in a risen word or the whole fight; dropped by the wire; unfolded by the link; halved; a short or a negative list kept; one radius for every body)', () => {
  const spec = egHallOf(12345, 1, 0), view = egFightView(spec), d = view.fl.find((f) => f.t === 'd');
  const at = [d.x + d.r + EG_STRIKE_PAD_M + 3, d.y ?? 0, d.z];   // off the fight ground, at the floor's height
  const heard = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `${w.k} valid`); return foldEg({ ...EG_STATE_EMPTY }, v, T0).fight.bodies; };
  let differs = 0;
  for (const [t, r] of [['spark', 0.6], ['chain', 0.8], ['anchor', 0.9], ['fwall', 1.0], ['rift', 1.3], ['rift', 2.2]]) {
    for (const gap of [r - 0.05, r + 0.05, 0.95, 1.05]) {
      const o = { i: 9, role: EG_ROLE.obj, k: EG_OBJ[t], pt: 0, x: d.x + d.r + gap, z: d.z, y: d.y ?? 0, mv: null, hp: 50, max: 50, r, fl: 0, ws: 0, wsAt: 0 };
      const F = { h: 1, wokeAt: T0, bodies: [o], blows: [], tethers: [], marks: [], pg: {}, zones: [] };
      const relay = egStruckOff(view, o, ...at);
      for (const [w, b] of [['risen', heard(egRisen([o], T0))[0]], ['whole', heard(egFightState(F, T0))[0]]]) {
        assert.equal(b.r, r, `${t} ${r}: its radius heard (${w})`);
        assert.equal(egStruckOff(view, b, ...at), relay, `${t} ${r} at ${gap.toFixed(2)} m off the edge: the screen as the relay (${w})`);
      }
      if (egStruckOff(view, { ...o, r: undefined }, ...at) !== relay) differs++;
    }
  }
  assert.ok(differs >= 4, `the radius decides the blow off a floor's edge (${differs} of the cases)`);
  // the row is the row a build before this reads; the radius rides beside it
  const o = { i: 9, role: EG_ROLE.obj, k: EG_OBJ.rift, pt: 0, x: 0, z: 0, y: 0, mv: null, hp: 50, max: 50, r: 2.2, fl: 0 };
  const w = egRisen([o], T0);
  assert.equal(w.a[0].length, 19, 'nineteen in the row');
  assert.deepEqual(w.r, [egRadiusWire(o)]);
  assert.deepEqual([egRadiusWire({ r: 1.234 }), egRadiusWire({})], [1.23, 0.6], 'hundredths; a body with none, the relay\'s own 0.6');
  const old = heard({ k: 'ead', a: w.a, at: T0 })[0];
  assert.equal(old.r, undefined, 'a relay before it: no radius, the word kept');
  for (const bad of [[2.2, 1], [-1], ['2.2'], [NaN], 2.2]) assert.equal(validEgOut({ k: 'ead', a: w.a, r: bad, at: T0 }), null, `a radius list of ${JSON.stringify(bad)} refused`);
  assert.equal(validEgOut({ ...egFightState({ h: 1, wokeAt: T0, bodies: [o], blows: [], tethers: [], marks: [], pg: {}, zones: [] }, T0), r: [] }), null, 'the whole fight\'s too');
});

test('TURNED-BLOW AN OBJECT TURNED IS NEVER SENT (AUDIT FB1018f lane L3\'s survivor): an errand\'s rift struck from the arrival plate - the screen\'s door refuses it by the object\'s own stand-in, as it refuses a lord\'s or an add\'s, nothing sent and nothing flashed (mutants: the door\'s guard blind to the struck objects)', async () => {
  const Y = await spire(12345, hallOf(12345, 'yard'));
  const rift = Y.B.F.bodies.find((b) => b.role === EG_ROLE.obj && b.hp > 0 && !(b.fl & EG_FL.ward));
  assert.ok(rift, 'a rift to strike');
  Y.at(Y.spec.arrive.x, Y.spec.arrive.z, Y.spec.arrive.y ?? 0);
  await Y.step();
  assert.equal(Y.target(rift.i).entity.warded, true, 'turned from the plate');
  const n = Y.sent.length, hurtAt = Y.E().fight.bodies.find((b) => b.i === rift.i).hurtAt;
  assert.equal(Y.fight.hostHit({ i: rift.i, d: 40, r: HIT_KINDS.Melee }), false, 'not sent');
  assert.equal(Y.sent.length, n);
  assert.equal(Y.E().fight.bodies.find((b) => b.i === rift.i).hurtAt, hurtAt, 'nor flashed');
});

test('TURNED-BLOW THE TURNED BLOW SAYS ITS WORD AT EVERY DOOR (AUDIT FB1018f L3-2, L3-7; scenes/dungeonContext.js by its text - buildDungeonContext does not run in Node): a spell on a body of the court\'s or the Spire\'s pops its number by the stand-in it met, so a turned one says "No footing" or "Warded" (ui/hitNumbers.js numberFor), never the claim; a shaft a ward or the ground turns says its word beside the ring, as a swing\'s formula does on the same stand-in - one of his host\'s and the Warden\'s (mutants: each spell door\'s number blind to its body; each turned shaft silent)', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  // PIN MOVED (FIELD BUGS 2026-10-19f STAND-IN-WHOLE, HOST-SPLIT): the three spell doors are one door now
  // (scenes/gate/standInSpell.js), driven here on the real stand-ins - each number by the body it met, turned or not
  const heard = [], was = playerEntity.level;
  const bolt = buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 } }], rangeType: 1, element: 4, name: 'Bolt' });
  const cr = { crystal: 0, entity: crystalStandIn(bossLookOf('ruhn'), 0) }, hb = { host: 3, entity: hostStandIn({ mobile: 1, name: 'Imp' }, 3) }, boss = { boss: true, entity: bossStandIn(bossLookOf('ruhn'), 'The Warden') };
  const doors = createStandInSpell({
    player: playerEntity, say: NOOP, boss: () => boss, crystals: () => [cr], host: () => [hb], rival: () => null,
    landOnBoss: () => true, landOnCrystal: () => true, landOnHost: () => true, landOnRival: () => true, nextArenaQ: NOOP,
    trapNow: () => null, onTrap: () => false, rolls: () => 0.999,
  });
  setPlayerAttackHook((r) => heard.push(r));
  try {
    playerEntity.level = 20;
    for (const [cast, body, word] of [[() => doors.spellOnCrystal(bolt, 0), cr, egNoFooting()], [() => doors.spellOnHost(bolt, 3), hb, null], [() => doors.spellOnBoss(bolt), boss, null]]) {
      body.entity.warded = false; body.entity.wardText = null;
      cast();
      assert.equal(heard.at(-1).target, body.entity, 'its number by the body it met');
      assert.equal(numberFor(heard.at(-1)).text, '10', 'whole, its number');
      body.entity.warded = true; body.entity.wardText = word;
      cast();
      assert.equal(numberFor(heard.at(-1)).text, word ?? 'Warded', 'turned, its word - never the claim');
    }
  } finally { setPlayerAttackHook(null); playerEntity.level = was; }
  assert.match(dc, /\n {12}if \(hb\.entity\.warded\) \{ wardTurns\(hb\); reportPlayerAttack\(\{ hit: true, damage: 0, target: hb\.entity \}\); \}/, 'a shaft on one of the host, turned: its word');
  assert.match(dc, /\n {12}if \(boss\.warded\) \{ wardTurns\(boss\); reportPlayerAttack\(\{ hit: true, damage: 0, target: boss\.entity \}\); \}/, 'a shaft into his ward: its word');
  assert.match(dc, /b\.entity\.warded = !!b\.warded;/, 'his stand-in carries his ward, the word\'s source');
  // the word as the HUD shows it: the ground's, else the ward's; a body that takes it, its number
  assert.equal(numberFor({ hit: true, damage: 0, target: { warded: true, wardText: egNoFooting() } }).text, 'No footing');
  assert.equal(numberFor({ hit: true, damage: 0, target: { warded: true, wardText: null } }).text, 'Warded');
  assert.equal(numberFor({ hit: true, damage: 31, target: { warded: false } }).text, '31');
});
