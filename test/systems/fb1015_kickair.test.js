// FIELD BUGS 2026-10-15d KICK-AIR (a player, 2026-10-14: "Flying kick doesn't work ... tried doing it mid-air, off ledges,
// flat ground aiming up aiming down etc nothing works" - the HUD: "You cannot leap from here."). The technique key's one
// gate refused every leap and dash off the ground (combat/techniques.js refusal), asked on the press and again on the
// release, so a kick pressed in a jump, in a fall or off a ledge - or pressed on the ground and let go after the takeoff -
// said it. Mac's call (2026-10-15): the Flying Kick goes from the air - the roster marks it `airborne`
// (combat/technique/techniqueRoster.js) and the gate reads the mark; every other leap and dash stays on the ground, and every other
// refusal is the kick's too. A flight launched mid-fall keeps that fall's start (player/motor.js techniqueLaunch), so a
// kick is no feather fall. Driven through the runner's press, hold and release on a REAL PlayerMotor over a real
// Collider, built as the hosts build theirs (exterior.js, world.js: motorStats, the Jumping skill's boost, the Jump
// spell's air control). bible/05-Combat/Weapon-Techniques.md; the Field-Bugs page of 2026-10-15.
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
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { jumpSpeedMultiplier, isEnhancedJumping } from '../../src/systems/skills.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { PlayerMotor, FALL_DAMAGE_THRESHOLD } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { motorStats, applyMotorEffectFlags } from '../../src/scenes/shared.js';

const DT = 1 / 60;
const STILL = Object.freeze({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false });
const JUMP = Object.freeze({ ...STILL, jump: true });
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = () => ({ strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (o = {}) => ({ isPlayer: true, level: 8, items: [], stats: stats(), skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [], ...o });
const foeAt = (x, z) => ({ entity: { ...player({ isPlayer: false }), health: 100, maxHealth: 100 }, ai: { feet: [x, 0, z], height: 1.8, yaw: Math.PI } });
/** A piece of `make`, Rare, its technique line `id` - lootRarity's own roll (tech1_runner.test.js's shape). */
const piece = (make, id, value = 20) => {
  const it = LR.applyRarity(make(), 'rare', lcg(7));
  it.isIdentified = true;
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  return it;
};
const gauntlets = (id = 'kick') => piece(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: 103, material: 0x0201 })), id);
const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => ({ positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz], indices: [0, 1, 2, 0, 2, 3] });
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const reset = () => { _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null); };
const R = {};

/**
 * A street: the open ground at 0 (the exterior's terrain, never a mesh), a ledge's top `ledge` metres up over z -6..1
 * when asked, the player's body on it - a REAL PlayerMotor as the hosts make it - and the technique key in hand
 * (`weapon` drawn, or the bare hands and the Gauntlets worn). `frame(input, held)` is one host frame: the motor's step,
 * the rig's technique step, then the weapon's (its 'hit' resolved on the foes as a host resolves it).
 */
function street({ weapon = null, gloves = null, foes = [], ledge = 0, look = { yaw: 0, pitch: -0.15 } } = {}) {
  reset();
  setPlayerDoor({ foes: () => foes });
  const me = player();
  if (gloves) me.equip.slots[EQUIP_SLOTS.Gloves] = gloves;
  const pw = new PlayerWeapon({ weapon, liveSpeed: 50 });
  pw.sheathed = false; pw.update(0);
  const col = new Collider(() => 0);
  if (ledge > 0) { const q = quad(-6, ledge, -6, 6, ledge, -6, 6, ledge, 1, -6, ledge, 1); col.addMesh('ledge', q.positions, q.indices, I); }
  const m = new PlayerMotor(col, motorStats(me), { jumpBoost: () => jumpSpeedMultiplier(me), enhancedJumping: () => isEnhancedJumping(me) });
  m.spawn(0, ledge, 0);
  const log = { said: [], started: [], hits: [], fell: 0 };
  const ctx = (held) => ({
    rig: R, entity: me, pw, cam: { pos: m.eyeAt(), yaw: look.yaw, pitch: look.pitch, feet: m.pos }, collider: col, held, ready: true, cancel: false,
    startSwing: (s) => { if (!pw.techniqueStrike(s)) return false; log.started.push(s); return true; },
    door: { motor: () => m, drainFatigue: (n) => { me.fatigue -= n; } }, say: (l) => log.said.push(l),
  });
  const sight = (f) => ({ dist: Math.hypot(f.ai.feet[0] - m.pos[0], f.ai.feet[2] - m.pos[2]), inView: true, losClear: true });
  const frame = (input = STILL, held = false) => {
    m.update(DT, input, look.yaw, look.pitch);
    if (m.landedFallDistance > 0) log.fell = m.landedFallDistance;
    T.stepTechnique(DT, ctx(held));
    if (pw.update(DT).includes('hit')) log.hits.push(...pw.resolveHit(foes, me, sight, () => 0.01));
  };
  for (let i = 0; i < 20; i++) frame();   // settled on the ground, past the jump's 0.1 s gate
  assert.equal(m.grounded, true, 'the body stands');
  return { me, pw, m, log, frame };
}
/** Into the air off a jump: `n` frames after the takeoff, the key held or not. */
const jump = (s, n = 6, held = false) => { s.frame(JUMP, held); for (let i = 0; i < n; i++) s.frame(STILL, held); assert.equal(s.m.grounded, false, 'in the air'); };
/** The key pressed for a frame and let go the next. */
const tap = (s) => { s.frame(STILL, true); s.frame(STILL, false); };
/** On until the body is down and the technique done. */
const settle = (s) => { for (let i = 0; i < 240 && (!s.m.grounded || T.techniqueState().act); i++) s.frame(); };
/** On to the landing's strike: the blow it set and whether the body was still in the air. */
const toStrike = (s) => {
  for (let i = 0; i < 240 && !s.log.started.length; i++) s.frame();
  return { blow: s.pw.techniqueBlow ? { ...s.pw.techniqueBlow } : null, inAir: !s.m.grounded };
};
const blowOf = (b) => ({ id: b.id, mult: b.mult, reach: b.reach, arc: b.arc, toHit: b.toHit, single: b.single });

test('KICK-AIR THE KICK FROM A JUMP: Gauntlets\' Flying Kick pressed and let go mid-jump aims at the foe from the airborne feet, launches the real motor (its price paid), lands before the foe as a kick from the ground lands, and strikes all round the landing - the same blow, the foe struck (mutants: the airborne mark dropped from the kick; the gate blind to the mark)', () => {
  const foe = foeAt(0, 5);
  // the ground's own kick: the measure
  const g = street({ gloves: gauntlets(), foes: [foe] });
  tap(g);
  assert.equal(T.techniqueState().act, 'flight', 'from the ground it goes');
  const groundBlow = blowOf(toStrike(g).blow);
  settle(g);
  const groundLand = g.m.pos[2];
  // the same kick, from the air
  const s = street({ gloves: gauntlets(), foes: [foe] });
  jump(s);
  const from = s.m.pos[1];
  assert.ok(from > 0.3, `well off the ground: ${from}`);
  s.frame(STILL, true);
  assert.deepEqual(s.log.said, [], 'no "You cannot leap from here."');
  assert.equal(T.techniqueState().aiming, true, 'held: it aims');
  assert.equal(T.techniqueState().aim.foe, foe, 'at the foe under the look');
  assert.equal(T.techniqueState().aim.ok, true);
  s.frame(STILL, false);
  assert.equal(s.m.grounded, false, 'let go in the air');
  assert.deepEqual(s.log.said, []);
  assert.equal(T.techniqueState().act, 'flight', 'it goes');
  assert.equal(s.m.techFlight, true, 'the motor flies it');
  assert.ok(s.m.velY > 0, 'up off the jump\'s arc');
  assert.equal(s.me.fatigue, 6400 - TECHNIQUES.kick.fatigue * FATIGUE_MULTIPLIER, 'its price paid');
  assert.equal(T.techniqueWait('kick'), TECHNIQUES.kick.cooldown);
  const st = toStrike(s);
  assert.deepEqual(s.log.started, ['StrikeDown'], 'the kick\'s strike');
  assert.equal(st.inAir, true, 'started in the air, to land with the body');
  assert.deepEqual(blowOf(st.blow), groundBlow, 'the blow a kick from the ground strikes');
  assert.equal(st.blow.arc, 'all');
  assert.equal(st.blow.reach, TECHNIQUES.kick.radius);
  settle(s);
  assert.equal(s.m.grounded, true, 'down');
  assert.equal(s.m.techFlight, false, 'the landing ends the flight');
  assert.ok(Math.abs(s.m.pos[2] - groundLand) < 0.35 && Math.abs(s.m.pos[2] - 4) < 0.35, `before the foe, where the ground's kick lands (${s.m.pos[2].toFixed(2)} / ${groundLand.toFixed(2)})`);
  assert.deepEqual(s.log.hits.map((h) => h.foe), [foe], 'the foe struck');
  assert.ok(s.log.hits[0].damage > 0);
  assert.equal(T.techniqueState().act, null, 'done');
});

test('KICK-AIR PRESSED ON THE GROUND, LET GO IN THE AIR: the aim held through a jump goes on the release - the release\'s own ask reads the mark too; a Leap Strike held the same way still says "You cannot leap from here." and pays nothing (mutants: the mark dropped; the gate blind to it)', () => {
  const foe = foeAt(0, 5);
  const s = street({ gloves: gauntlets(), foes: [foe] });
  s.frame(STILL, true);
  assert.equal(T.techniqueState().aiming, true, 'pressed on the ground: it aims');
  jump(s, 6, true);
  s.frame(STILL, false);
  assert.deepEqual(s.log.said, []);
  assert.equal(T.techniqueState().act, 'flight', 'let go in the air: it goes');
  settle(s);
  assert.deepEqual(s.log.started, ['StrikeDown']);
  assert.deepEqual(s.log.hits.map((h) => h.foe), [foe]);
  // the long blade's leap: the ground's alone, at the release as at the press
  const foe2 = foeAt(0, 7);
  const l = street({ weapon: piece(() => createWeapon(120, 1), 'leap'), foes: [foe2] });
  l.frame(STILL, true);
  assert.equal(T.techniqueState().aiming, true);
  jump(l, 6, true);
  l.frame(STILL, false);
  assert.deepEqual(l.log.said, [T.CANNOT_LEAP_TEXT]);
  assert.equal(T.techniqueState().act, null);
  assert.equal(l.me.fatigue, 6400, 'nothing paid');
  assert.equal(T.techniqueWait('leap'), 0);
});

test('KICK-AIR EVERY OTHER LEAP AND DASH STAYS ON THE GROUND: a Leap Strike, a Lunge and a Shadowstep pressed mid-jump each say "You cannot leap from here." and pay nothing - only the kick is marked (mutants: the gate blind to the mark - every leap from the air; the grounded term dropped)', () => {
  assert.deepEqual(Object.keys(TECHNIQUES).filter((id) => TECHNIQUES[id].airborne), ['kick'], 'the kick alone is marked');
  for (const [make, id] of [[() => createWeapon(120, 1), 'leap'], [() => createWeapon(116, 1), 'lunge'], [() => createWeapon(113, 1), 'shadowstep']]) {
    const s = street({ weapon: piece(make, id), foes: [foeAt(0, 5)] });
    jump(s);
    tap(s);
    assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT], `${id} from the air`);
    assert.equal(T.techniqueState().aiming, false);
    assert.equal(T.techniqueState().act, null);
    assert.equal(s.me.fatigue, 6400, `${id}: nothing paid`);
    assert.equal(T.techniqueWait(id), 0);
    settle(s);
    tap(s);
    assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT], `${id} from the ground: no refusal`);
    assert.equal(T.techniqueState().act, 'flight', `${id} from the ground: it goes`);
  }
});

test('KICK-AIR THE KICK\'S OTHER REFUSALS STAND: in the saddle mid-jump, on a slow fall mid-jump, swimming and levitating - the motor\'s flags as the hosts write them - the kick says "You cannot leap from here." on the press, takes no aim and pays nothing (mutants: the saddle, the slow fall, the levitation unread by the gate)', () => {
  const refused = (setup) => {
    const s = street({ gloves: gauntlets(), foes: [foeAt(0, 5)] });
    setup(s);
    for (let i = 0; i < 4; i++) s.frame();
    s.frame(STILL, true);
    assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT], 'said on the press');
    assert.equal(T.techniqueState().aiming, false, 'no aim taken');
    s.frame(STILL, false);
    assert.deepEqual(s.log.said, [T.CANNOT_LEAP_TEXT]);
    assert.equal(T.techniqueState().act, null);
    assert.equal(s.me.fatigue, 6400, 'nothing paid');
    assert.equal(T.techniqueWait('kick'), 0);
    return s.m;
  };
  const horse = refused((s) => { s.m.setTransportMode(TRANSPORT_MODES.Horse); for (let i = 0; i < 20; i++) s.frame(); s.frame(JUMP); });
  assert.deepEqual([horse.riding, horse.grounded], [true, false], 'a horse\'s jump: in the air, in the saddle');
  const slow = refused((s) => { s.me.activeEffects.push({ kind: 'slowfall', roundsRemaining: 4 }); applyMotorEffectFlags(s.m, s.me); s.frame(JUMP); });
  assert.deepEqual([slow.slowFalling, slow.grounded], [true, false], 'a jump on a slow fall');
  assert.equal(refused((s) => applyMotorEffectFlags(s.m, s.me, { swimming: true })).swimming, true);
  assert.equal(refused((s) => { s.me.activeEffects.push({ kind: 'levitate', roundsRemaining: 4 }); applyMotorEffectFlags(s.m, s.me); }).levitating, true);
});

test('KICK-AIR NO FEATHER FALL: off a 7 m ledge, the kick goes once the ground is in its reach, lands its strike - and the landing\'s fall is measured from the ledge, past the damage threshold, not from where the kick left; from a jump\'s rise it counts from the launch, as from the ground (mutant: the fall\'s start reset at the launch)', () => {
  const foe = foeAt(0, 8);
  const s = street({ gloves: gauntlets(), foes: [foe], ledge: 7, look: { yaw: 0, pitch: -0.75 } });   // the look down at the foe below
  assert.ok(Math.abs(s.m.pos[1] - 7) < 0.05, `on the ledge: ${s.m.pos[1]}`);
  let off = 0;
  for (; off < 240 && s.m.grounded; off++) s.frame({ ...STILL, forward: 1 });   // walked off its edge - no jump
  assert.equal(s.m.grounded, false, 'off the edge, falling');
  for (let i = 0; i < 120 && s.m.pos[1] > 3.5; i++) s.frame();
  assert.ok(s.m.pos[1] <= 3.5 && !s.m.grounded, `the ground within a kick's drop: ${s.m.pos[1]}`);
  const began = s.m.fallStart;
  assert.ok(s.m.falling && began > 6.5, `the fall began at the ledge: ${began}`);
  tap(s);
  const launchY = s.m.pos[1];   // the release's frame: the motor stepped, then the kick launched from here
  assert.deepEqual(s.log.said, []);
  assert.equal(T.techniqueState().act, 'flight', 'from a fall it goes');
  settle(s);
  assert.deepEqual(s.log.started, ['StrikeDown']);
  assert.deepEqual(s.log.hits.map((h) => h.foe), [foe], 'the foe struck');
  assert.ok(Math.abs(s.log.fell - began) < 0.05, `the fall from the ledge (${began.toFixed(2)}): ${s.log.fell}`);
  assert.ok(s.log.fell > FALL_DAMAGE_THRESHOLD && launchY < FALL_DAMAGE_THRESHOLD, 'a fall that hurts, never cancelled by the kick');
  // from a jump's rise: the launch is the higher - the fall counts from it
  const j = street({ gloves: gauntlets(), foes: [foeAt(0, 5)] });
  jump(j, 3);
  tap(j);
  const up = j.m.pos[1];
  assert.ok(j.m.velY > 0 && up > 0.2, `launched on the rise at ${up}`);
  assert.equal(T.techniqueState().act, 'flight');
  settle(j);
  assert.ok(Math.abs(j.log.fell - up) < 0.12, `from the launch at ${up.toFixed(2)}: ${j.log.fell}`);
});
