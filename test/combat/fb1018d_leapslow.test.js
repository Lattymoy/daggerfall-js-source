// FIELD BUGS 2026-10-18d LEAP-SLOW (Warrgrim, "Please Fix Leaping Strike Weapon Techniques. items": "leaping strikes/ any
// weapon ability that allows you to leap and perform an aoe attack have been completely disabled/broken ... 'you cannot
// leap from here' ... It's broken the functionality of numerous legendary weapons ... the unarmed versions of this
// technique as well, such as flying kick"; and the 2026-10-14 kick report's "flat ground ... nothing works"). The
// technique key's gate refused every leap and dash to a body wearing a slow fall's spell, on the ground too
// (combat/techniques.js refusal, player/motor.js techniqueLaunch) - and a piece that casts Slowfalling while held, a Rare
// armour flavour or The Raven's Wings (systems/loot/lootRarity.js), is on for as long as it is worn: LEGEND-HELD made the
// Legendary free to put on, JUMP-SLOW gave the plain jump back under the spell, and the leaps and dashes stayed refused.
// JUMP-SLOW's law carried to the techniques' leaps: the spell refuses a flight in the air alone; the flight a grounded body launches under it is
// its own arc (ApplyGravity), landing on its aim on its strike's clock, billing no fall; the glide takes the body again
// once the flight is over - the ground, a placement, a levitation, a catch and the parkour leap out of it. Driven through
// the runner's press and release on a REAL PlayerMotor over a real Collider; the spell put on through the real equip door
// by The Raven's Wings minted from its own Legendary record. bible/05-Combat/Weapon-Techniques.md LEAP-SLOW.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as T from '../../src/combat/techniques.js';
import { TECHNIQUES } from '../../src/combat/technique/techniqueRoster.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { setSigilDueling } from '../../src/systems/sigil/sigil.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { FATIGUE_MULTIPLIER } from '../../src/systems/statMods.js';
import { EQUIP_SLOTS, equipItem } from '../../src/systems/equip.js';
import { ENCHANTMENT_TYPES, setDefaultEnchantCtx } from '../../src/systems/enchantments.js';
import '../../src/systems/effects.js';   // the held spell's cast door (setEnchantmentEffectDoors, registered at its tail)
import { jumpSpeedMultiplier, isEnhancedJumping } from '../../src/systems/skills.js';
import { PlayerMotor, SLOWFALL_VELOCITY } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { motorStats, applyMotorEffectFlags } from '../../src/scenes/shared.js';

const DT = 1 / 60;
const STILL = Object.freeze({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false });
const JUMP = Object.freeze({ ...STILL, jump: true });
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = () => ({ strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, level: 8, items: [], stats: stats(), skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, career: {}, activeEffects: [] });
const foeAt = (x, y, z) => ({ entity: { ...player(), isPlayer: false, health: 100, maxHealth: 100 }, ai: { feet: [x, y, z], height: 1.8, yaw: Math.PI } });
/** A piece of `make`, Rare, its technique line `id` - lootRarity's own roll (tech1_runner.test.js's shape). */
const piece = (make, id, value = 20) => {
  const it = LR.applyRarity(make(), 'rare', lcg(7));
  it.isIdentified = true;
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  return it;
};
const sword = () => piece(() => createWeapon(120, 1), 'leap');
const gauntlets = () => piece(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: 103, material: 0x0201 })), 'kick');
/** Classic SPELLS.STD record 37, Slowfalling - CasterOnly, its one Slowfall effect (25) - the spell the Cast When Held row
 *  casts (no ARENA2 here: the record's shape is the classic one the hosts' spellsByIndex hands the door). */
const SLOWFALLING = Object.freeze({ index: 37, name: 'Slowfalling', rangeType: 0, element: 4, effects: [{ type: 25, subType: 255, durationBase: 1, durationMod: 2, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] });
/** The Raven's Wings, from the Legendary's own record: the pauldrons that cast Slowfalling while held. */
const ravensWings = () => LR.applyRarity(mintCondition(setItemFields({ group: 'Armor', templateIndex: 105, material: 0x0201 })), 'legendary', lcg(3), [LR.legendaryById('ravens-wings')]);
const reset = () => { _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null); };
const R = {};

/**
 * A street on a 3 m platform (its top over z -6..12, the open ground at 0 under it), the player's body on it - a REAL
 * PlayerMotor as the hosts make it - with the technique key in hand (`weapon` drawn, or the bare hands and `gloves`
 * worn), and The Raven's Wings put on through the equip door when `slow`. `frame(input, held)` is one host frame: the
 * effect flags the hosts write (shared.js applyMotorEffectFlags), the motor's step, the rig's technique step, then the
 * weapon's (its 'hit' resolved on the foes as a host resolves it).
 */
function street({ weapon = null, gloves = null, foes = [], slow = false, spawn = [0, 3, 0] } = {}) {
  reset();
  setPlayerDoor({ foes: () => foes });
  const me = player();
  if (slow) {
    setDefaultEnchantCtx({ spellsByIndex: () => new Map([[37, SLOWFALLING]]), now: () => 1000 });
    try { const w = ravensWings(); me.items.push(w); equipItem(me, w); } finally { setDefaultEnchantCtx(null); }
  }
  if (gloves) (me.equip ??= { slots: [] }).slots[EQUIP_SLOTS.Gloves] = gloves;   // worn straight into the slot, as KICK-AIR's (their own Rare flavour is not this pin's)
  const pw = new PlayerWeapon({ weapon, liveSpeed: 50 });
  pw.sheathed = false; pw.update(0);
  const col = new Collider(() => 0);
  col.addMesh('platform', [-6, 3, -6, 6, 3, -6, 6, 3, 12, -6, 3, 12], [0, 1, 2, 0, 2, 3], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const m = new PlayerMotor(col, motorStats(me), { jumpBoost: () => jumpSpeedMultiplier(me), enhancedJumping: () => isEnhancedJumping(me) });
  m.spawn(...spawn);
  const log = { said: [], started: [], hits: [], fell: 0, steps: 0 };
  const look = { yaw: 0, pitch: -0.15 };
  const ctx = (held) => ({
    rig: R, entity: me, pw, cam: { pos: m.eyeAt(), yaw: look.yaw, pitch: look.pitch, feet: m.pos }, collider: col, held, ready: true, cancel: false,
    startSwing: (s) => { if (!pw.techniqueStrike(s)) return false; log.started.push(s); return true; },
    door: { motor: () => m, drainFatigue: (n) => { me.fatigue -= n; } }, say: (l) => log.said.push(l),
  });
  const sight = (f) => ({ dist: Math.hypot(f.ai.feet[0] - m.pos[0], f.ai.feet[2] - m.pos[2]), inView: true, losClear: true });
  const frame = (input = STILL, held = false) => {
    applyMotorEffectFlags(m, me);
    m.update(DT, input, look.yaw, look.pitch);
    log.steps++;
    if (m.landedFallDistance > 0) log.fell = Math.max(log.fell, m.landedFallDistance);
    T.stepTechnique(DT, ctx(held));
    if (pw.update(DT).includes('hit')) log.hits.push(...pw.resolveHit(foes, me, sight, () => 0.01));
  };
  for (let i = 0; i < 20; i++) frame();   // settled on the platform, past the jump's 0.1 s gate
  assert.equal(m.grounded, true, 'the body stands');
  assert.equal(m.slowFalling, slow, slow ? 'The Raven\'s Wings worn: the slow fall\'s flag on, standing' : 'no spell');
  return { me, pw, m, log, frame, look };
}
/** The key pressed for a frame and let go the next - and the frames until the body is down again, counted from the
 *  release (the launch): its landing, the time it flew, the blow it struck. */
function leap(s) {
  s.frame(STILL, true);
  s.frame(STILL, false);
  const launched = T.techniqueState().act === 'flight' && s.m.techFlight;
  let air = 0;
  for (; air < 240 && !s.m.grounded; air++) s.frame();
  for (let i = 0; i < 120 && T.techniqueState().act; i++) s.frame();
  return { launched, air: air * DT, z: s.m.pos[2], y: s.m.pos[1] };
}
/** Into the air off a jump: `n` frames after the takeoff. */
const jump = (s, n = 6) => { s.frame(JUMP); for (let i = 0; i < n; i++) s.frame(); assert.equal(s.m.grounded, false, 'in the air'); };
/** A fall watched to its landing: the fastest the body went down, the fall billed. */
function fallOf(s, input = STILL) {
  let fastest = 0;
  for (let i = 0; i < 600 && !(s.m.grounded && i > 2); i++) { s.frame(input); fastest = Math.min(fastest, s.m.velY); }
  return { fastest, fell: s.m.landedFallDistance };
}

test('LEAP-SLOW THE GROUND: The Raven\'s Wings worn - their held Slowfalling on, the body standing - a Leap Strike at the foe 10 m off goes: no "You cannot leap from here.", and it flies the arc it flies without the spell, landing on its aim inside its strike\'s clock (launchTo\'s 0.80 s) and striking the foe, billing none of its fall but the last step\'s (mutants: the gate\'s and the launch\'s slow fall read on the ground; the glide taking the flight)', () => {
  const plain = street({ weapon: sword(), foes: [foeAt(0, 3, 10)] });
  const p = leap(plain);
  assert.equal(p.launched, true, 'without the spell it goes');
  const s = street({ weapon: sword(), foes: [foeAt(0, 3, 10)], slow: true });
  const held = s.me.activeEffects.find((a) => a.kind === 'slowfall');
  assert.equal(held?.heldItem?.legendary, 'ravens-wings', 'the spell is the Wings\' held one');
  assert.deepEqual(held.heldItem.enchantments, [{ type: ENCHANTMENT_TYPES.CastWhenHeld, param: SLOWFALLING.index }], 'their record\'s Cast When Held: Slowfalling');
  s.frame(STILL, true);
  assert.deepEqual(s.log.said, [], 'pressed under the spell: no refusal');
  assert.equal(T.techniqueState().aiming, true, 'it aims');
  const aim = T.techniqueState().aim;
  assert.equal(aim.ok, true);
  const planned = T.launchTo([...s.m.pos], aim.point, aim.apex).time;
  const r = leap(s);
  assert.deepEqual(s.log.said, []);
  assert.equal(r.launched, true, 'the spell worn on the ground: it goes');
  assert.ok(Math.abs(r.z - p.z) < 0.05 && Math.abs(r.z - aim.point[2]) < 0.25, `on its aim at ${aim.point[2].toFixed(2)}, where the leap without the spell lands (${r.z.toFixed(2)} / ${p.z.toFixed(2)})`);
  assert.ok(Math.abs(r.air - p.air) < DT + 1e-9 && Math.abs(r.air - planned) < 2 * DT + 1e-9, `in the air ${r.air.toFixed(2)} s - the arc's ${planned.toFixed(2)} s, without the spell ${p.air.toFixed(2)} s`);
  assert.ok(Math.abs(planned - 0.8) < 0.05, `launchTo's 9 m Leap Strike: ${planned.toFixed(2)} s`);
  assert.deepEqual(s.log.started, ['StrikeDown'], 'the landing\'s strike');
  assert.equal(s.log.hits.length, 1, 'the foe struck as the body lands');
  assert.ok(s.log.fell < 0.2, `the spell bills none of its fall but the last step's (${s.log.fell.toFixed(3)} m)`);
  assert.equal(s.m.techFlight, false, 'the landing ends the flight');
});

test('LEAP-SLOW THE PRICE: under the spell the leap pays as it pays without it - its fatigue and its cooldown, once', () => {
  const s = street({ weapon: sword(), foes: [foeAt(0, 3, 10)], slow: true });
  s.frame(STILL, true);
  s.frame(STILL, false);
  assert.equal(T.techniqueState().act, 'flight');
  assert.equal(s.me.fatigue, 6400 - TECHNIQUES.leap.fatigue * FATIGUE_MULTIPLIER, 'its price paid');
  assert.equal(T.techniqueWait('leap'), TECHNIQUES.leap.cooldown);
});

test('LEAP-SLOW THE AIR STILL REFUSES: under the spell the Flying Kick pressed mid-jump says "You cannot leap from here.", takes no aim and pays nothing (KICK-AIR\'s refusal stands), and the motor launches no flight in the air under it - without the spell, mid-jump, it does (mutants: the gate\'s and the launch\'s slow fall unread)', () => {
  const s = street({ gloves: gauntlets(), foes: [foeAt(0, 3, 5)], slow: true });
  jump(s);
  s.frame(STILL, true);
  assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT], 'said on the press');
  assert.equal(T.techniqueState().aiming, false, 'no aim taken');
  s.frame(STILL, false);
  assert.equal(T.techniqueState().act, null);
  assert.equal(s.me.fatigue, 6400, 'nothing paid');
  assert.equal(T.techniqueWait('kick'), 0);
  // the kick from the ground under the spell goes
  for (let i = 0; i < 120 && !s.m.grounded; i++) s.frame();
  for (let i = 0; i < 10; i++) s.frame();
  s.log.said.length = 0;
  assert.equal(leap(s).launched, true, 'from the ground it goes');
  assert.deepEqual(s.log.said, []);
  // the motor's own door, mid-jump: refused under the spell, a flight without it
  const motorIn = (slow) => {
    const m = new PlayerMotor(new Collider(() => 0), { speed: 50, running: 50, swimming: 50 });
    m.spawn(0, 0, 0);
    m.slowFalling = slow;
    for (let i = 0; i < 20; i++) m.update(DT, STILL, 0);
    m.update(DT, JUMP, 0);
    for (let i = 0; i < 6; i++) m.update(DT, STILL, 0);
    assert.equal(m.grounded, false);
    return m.techniqueLaunch([0, 0, 1], 4, 6);
  };
  assert.equal(motorIn(true), false, 'in the air under the spell: no flight');
  assert.equal(motorIn(false), true, 'in the air without it: the flight goes (the gate\'s to refuse)');
});

test('LEAP-SLOW THE GLIDE AFTER: once the leap is down, the spell takes every fall again - a jump\'s descent and a walk off the platform\'s edge at its 2.1 m/s, billing nothing (mutants: the flight read with either Jumping or the flight; the ground leaving the flight on)', () => {
  const s = street({ weapon: sword(), foes: [foeAt(0, 3, 10)], slow: true });
  assert.equal(leap(s).launched, true);
  for (let i = 0; i < 20; i++) s.frame();
  s.frame(JUMP);
  const j = fallOf(s);
  assert.ok(Math.abs(j.fastest + SLOWFALL_VELOCITY) < 1e-9, `a jump after it comes down at the spell's speed (${j.fastest.toFixed(2)} m/s)`);
  assert.ok(j.fell < 0.1, `billing no fall (${j.fell.toFixed(3)} m)`);
  for (let i = 0; i < 20; i++) s.frame();
  for (let i = 0; i < 600 && s.m.grounded; i++) s.frame({ ...STILL, forward: 1 });   // walked off the edge - no jump
  assert.equal(s.m.grounded, false, 'off the edge');
  const w = fallOf(s);
  assert.ok(s.m.pos[1] < 0.05 && s.m.pos[2] > 12, `off the edge, down on the ground under it (z ${s.m.pos[2].toFixed(2)})`);
  assert.ok(Math.abs(w.fastest + SLOWFALL_VELOCITY) < 1e-9, `the walk off the edge glides (${w.fastest.toFixed(2)} m/s)`);
  assert.ok(w.fell < 0.1, `a 3 m drop billing nothing (${w.fell.toFixed(3)} m)`);
});

test('LEAP-SLOW THE FLIGHT CUT SHORT: a placement mid-flight, a levitation let go mid-flight, and a catch in a hang the parkour leaps out of each end the flight - the fall after it glides at the spell\'s 2.1 m/s (mutants: the flight read without Jumping; the water and the air\'s own branch, the parkour leap leaving the flight on)', () => {
  const launched = () => {
    const m = new PlayerMotor(new Collider(() => 0), { speed: 50, running: 50, swimming: 50 });
    m.spawn(0, 0, 0);
    m.slowFalling = true;
    for (let i = 0; i < 20; i++) m.update(DT, STILL, 0);
    const fl = T.launchTo([...m.pos], [0, 0, 9], TECHNIQUES.leap.apex);
    assert.equal(m.techniqueLaunch(fl.dir, fl.along, fl.up), true, 'the leap goes under the spell');
    for (let i = 0; i < 12; i++) m.update(DT, STILL, 0);
    assert.equal(m.techFlight, true);
    return m;
  };
  const descent = (m) => { let fastest = 0; for (let i = 0; i < 600 && !m.grounded; i++) { m.update(DT, STILL, 0); fastest = Math.min(fastest, m.velY); } return { fastest, fell: m.landedFallDistance }; };
  // a placement: the body stood 6 m up mid-flight (a door's landing, a load, a teleport)
  const placed = launched();
  placed.spawn(placed.pos[0], 6, placed.pos[2]);
  const pd = descent(placed);
  assert.ok(Math.abs(pd.fastest + SLOWFALL_VELOCITY) < 1e-9 && pd.fell < 0.1, `placed mid-flight, the fall glides (${pd.fastest.toFixed(2)} m/s, ${pd.fell.toFixed(3)} m)`);
  // a levitation taken mid-flight and let go in the air
  const lev = launched();
  lev.levitating = true;
  for (let i = 0; i < 10; i++) lev.update(DT, { ...STILL, up: true }, 0);
  lev.levitating = false;
  const ld = descent(lev);
  assert.ok(Math.abs(ld.fastest + SLOWFALL_VELOCITY) < 1e-9 && ld.fell < 0.1, `let go of the levitation, the fall glides (${ld.fastest.toFixed(2)} m/s)`);
  // a catch: the leap at a wall with a 2.4 m sill and no top, Jump held - caught in a hang - then Back and Jump, the eject
  const BOX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  const col = new Collider(() => 0);
  let n = 0;
  const box = (...b) => col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  box(-3, 0, 1.3, 3, 9, 4); box(-3, 2.2, 1.15, 3, 2.4, 1.3);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 50, jumping: 50 }), say: () => {}, tally: () => {} } });
  m.spawn(0, 0.02, -3);
  for (let i = 0; i < 30; i++) m.update(DT, STILL, 0);
  m.slowFalling = true;
  const fl = T.launchTo([...m.pos], [0, 0, 0.7], TECHNIQUES.leap.apex);
  assert.equal(m.techniqueLaunch(fl.dir, fl.along, fl.up), true);
  let hung = -1;
  for (let i = 0; i < 120 && hung < 0; i++) { m.update(DT, JUMP, 0); if (m.hanging) hung = i; }
  assert.ok(hung >= 0 && m.hanging, 'the flight caught in a hang');
  for (let i = 0; i < 20; i++) m.update(DT, STILL, 0);
  m.update(DT, { ...STILL, jump: true, forward: -1 }, 0);
  assert.ok(!m.onWall && !m.grounded && m.velY > 0, 'ejected off the wall');
  const ed = descent(m);
  assert.ok(Math.abs(ed.fastest + SLOWFALL_VELOCITY) < 1e-9 && ed.fell < 0.1, `the eject's descent glides (${ed.fastest.toFixed(2)} m/s)`);
});

test('LEAP-SLOW (AUDIT FB1018D L2-3): A FALL THAT IS NO JUMP IS THE AIR TOO, AND A FLIGHT DOWN BILLS NOTHING - under the spell, a Flying Kick pressed while the body glides off the platform\'s edge is refused at the press; a Leap Strike pressed on the platform and let go in that glide does not fly; and a Leap Strike from the platform down to the ground 3 m below lands billing none of its 3 m (mutants: the gate\'s air read off Jumping alone; the flight\'s fall never re-anchored)', () => {
  const FWD = { ...STILL, forward: 1 };
  let s = street({ gloves: gauntlets(), foes: [foeAt(0, 0, 16)], slow: true, spawn: [0, 3, 10] });
  for (let i = 0; i < 900 && s.m.grounded; i++) s.frame(FWD);
  for (let i = 0; i < 10; i++) s.frame();
  assert.equal(s.m.grounded, false, 'off the edge, gliding');
  s.frame(STILL, true);
  assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT], 'the kick refused in the glide');
  assert.equal(T.techniqueState().aiming, false);
  s = street({ weapon: sword(), foes: [foeAt(0, 0, 18)], slow: true, spawn: [0, 3, 11] });
  s.look.pitch = -0.35;
  s.frame(STILL, true);
  assert.equal(T.techniqueState().aiming, true, 'aimed on the platform');
  for (let i = 0; i < 900 && s.m.grounded; i++) s.frame(FWD, true);
  for (let i = 0; i < 6; i++) s.frame(STILL, true);
  assert.equal(s.m.grounded, false, 'walked off, still holding');
  s.frame(STILL, false);
  assert.equal(T.techniqueState().act, null, 'let go in the glide: no flight');
  assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT]);
  s = street({ weapon: sword(), foes: [foeAt(0, 0, 15)], slow: true, spawn: [0, 3, 9] });
  s.look.pitch = -0.3;
  s.frame(STILL, true);
  s.frame(STILL, false);
  assert.equal(T.techniqueState().act, 'flight', 'the leap down goes');
  for (let i = 0; i < 240 && !s.m.grounded; i++) s.frame();
  s.frame();
  assert.ok(s.m.pos[1] < 0.05, `down on the ground (${s.m.pos[1].toFixed(2)})`);
  assert.ok(s.log.fell < 0.3, `none of its 3 m billed (${s.log.fell.toFixed(3)} m)`);
});

test('LEAP-SLOW (AUDIT FB1018D L2-2): A FLIGHT CAUGHT ENDS THERE - a Leap Strike\'s flight under the spell caught in a hang on a thin wall, then over the top: the hang ends the technique\'s flight, and the drop past the wall glides at the spell\'s 2.1 m/s as the same clamber does from a plain jump (mutant: the catch leaving techFlight set, the clamber\'s exit Jumping at plain gravity)', () => {
  const BOX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  const ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const pk = { enabled: () => true, inputs: () => ({ climbing: 50, jumping: 50 }), say: () => {}, tally: () => {} };
  const run = (how) => {
    const col = new Collider(() => 0);
    let n = 0;
    const box = (x0, y0, z0, x1, y1, z1) => col.addMesh(`b${n++}`, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), BOX, ID);
    box(-3, 0, 1.3, 3, 2.4, 1.5);   // a thin wall, its lip at 2.4
    box(-3, 0, 1.5, 3, 1.0, 8);     // the floor beyond it, 1.4 m under the lip
    const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: pk });
    m.spawn(0, 0.02, how === 'tech' ? -3 : 0.7);
    for (let i = 0; i < 30; i++) m.update(DT, STILL, 0);
    m.slowFalling = true;
    if (how === 'tech') { const fl = T.launchTo([...m.pos], [0, 0, 1.2], TECHNIQUES.leap.apex); assert.equal(m.techniqueLaunch(fl.dir, fl.along, fl.up), true, 'launched'); }
    let hung = false;
    for (let i = 0; i < 180 && !hung; i++) { m.update(DT, JUMP, 0); hung = !!m.hanging; }
    assert.ok(hung, `${how}: caught in a hang`);
    for (let i = 0; i < 20; i++) m.update(DT, STILL, 0);
    const inHang = m.techFlight;
    let moved = false, after = false, fastest = 0;
    for (let i = 0; i < 400; i++) {
      m.update(DT, { ...STILL, forward: 1 }, 0);
      if (m.parkoured) moved = true;
      if (moved && !m._pkMove && !m._wall) after = true;
      if (after) { fastest = Math.min(fastest, m.velY); if (m.grounded) break; }
    }
    assert.ok(after && m.grounded, `${how}: over the top and down (${m.pos.map((v) => v.toFixed(2))})`);
    return { inHang, fastest };
  };
  const jumped = run('jump'), flown = run('tech');
  assert.equal(flown.inHang, false, 'the hang ends the technique\'s flight');
  assert.ok(flown.fastest > -SLOWFALL_VELOCITY - 0.05, `the drop after the clamber glides (${flown.fastest.toFixed(2)} m/s; the spell's ${(-SLOWFALL_VELOCITY).toFixed(2)})`);
  assert.ok(Math.abs(flown.fastest - jumped.fastest) < 0.05, `as the plain jump's clamber does (${jumped.fastest.toFixed(2)})`);
});

test('LEAP-SLOW (AUDIT FB1018D L2-2): A WALL TAKEN ENDS A FLIGHT - a Leap Strike\'s flight under the spell, Forward and Jump held into a climbable face, grabs it mid-air (no move: _pkGrab), and the technique\'s flight ends on the wall (mutant: a wall taken leaving techFlight set)', () => {
  const BOX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  const ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const pk = { enabled: () => true, inputs: () => ({ climbing: 90, jumping: 50 }), say: () => {}, tally: () => {} };
  const col = new Collider(() => 0);
  col.addMesh('wall', new Float32Array([-3, 0, 1.3, 3, 0, 1.3, 3, 12, 1.3, -3, 12, 1.3, -3, 0, 3, 3, 0, 3, 3, 12, 3, -3, 12, 3]), BOX, ID);   // a face with no lip in reach
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: pk });
  m.spawn(0, 0.02, -3);
  for (let i = 0; i < 30; i++) m.update(DT, STILL, 0);
  m.slowFalling = true;
  const fl = T.launchTo([...m.pos], [0, 0, 1.4], TECHNIQUES.leap.apex);
  assert.equal(m.techniqueLaunch(fl.dir, fl.along, fl.up), true, 'launched');
  assert.equal(m.techFlight, true);
  let mode = null;
  for (let i = 0; i < 120 && !mode; i++) { m.update(DT, { ...STILL, forward: 1, jump: true }, 0); mode = m._wall?.mode ?? null; }
  assert.equal(mode, 'climb', 'grabbed the face mid-flight');
  assert.equal(m.techFlight, false, 'the wall ends the technique\'s flight');
});

test('LEAP-SLOW (AUDIT FB1018D L2-2): A FLIGHT THAT MANTLES ENDS THERE - a Leap Strike\'s flight under the spell, Forward and Jump held, mantles a 1.4 m wall straight from the air (a move, no hang), and the drop past it glides at the spell\'s 2.1 m/s (mutant: a parkour move leaving techFlight set - its exit sets Jumping again, at plain gravity)', () => {
  const BOX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  const ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const pk = { enabled: () => true, inputs: () => ({ climbing: 50, jumping: 50 }), say: () => {}, tally: () => {} };
  const col = new Collider(() => 0);
  col.addMesh('wall', new Float32Array([-3, 0, 1.3, 3, 0, 1.3, 3, 1.4, 1.3, -3, 1.4, 1.3, -3, 0, 1.5, 3, 0, 1.5, 3, 1.4, 1.5, -3, 1.4, 1.5]), BOX, ID);   // 0.2 m thick, open ground past it
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: pk });
  m.spawn(0, 0.02, -3);
  for (let i = 0; i < 30; i++) m.update(DT, STILL, 0);
  m.slowFalling = true;
  const fl = T.launchTo([...m.pos], [0, 0, 0.9], TECHNIQUES.leap.apex);
  assert.equal(m.techniqueLaunch(fl.dir, fl.along, fl.up), true, 'launched');
  let moved = null, after = false, fastest = 0;
  for (let i = 0; i < 600; i++) {
    m.update(DT, { ...STILL, jump: true, forward: 1 }, 0);
    if (m.parkoured && !moved) moved = m.parkoured;
    if (moved && !m._pkMove) after = true;
    if (after) { fastest = Math.min(fastest, m.velY); if (m.grounded) break; }
  }
  assert.equal(moved, 'mantle', 'mantled from the flight, no hang');
  assert.ok(after && m.grounded && m.pos[2] > 1.5, `over and down (${m.pos.map((v) => v.toFixed(2))})`);
  assert.equal(m.techFlight, false);
  assert.ok(fastest > -SLOWFALL_VELOCITY - 0.05, `the drop glides (${fastest.toFixed(2)} m/s; the spell's ${(-SLOWFALL_VELOCITY).toFixed(2)})`);
});
