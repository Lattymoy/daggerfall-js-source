// TECH1 (bible/05-Combat/Weapon-Techniques.md): THE TECHNIQUE KEY AT WORK - the blow every host's swing and shaft resolve
// through (combat/techniqueBlow.js, PlayerWeapon.resolveHit, arrowFlight.js playerArrowHitFoe), the one runner every rig
// steps (combat/techniques.js), the motor's flight (player/motor.js techniqueLaunch), the marks on the ground and the chip.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as T from '../src/combat/techniques.js';
import { blowReaches, blowMult, scaleBlowDamage, playerBody, TECH_BODY_RADIUS } from '../src/combat/techniqueBlow.js';
import { TECHNIQUES, techniqueMult } from '../src/combat/techniqueRoster.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { ArrowFlight, playerArrowHitFoe, techniquePierces } from '../src/combat/arrowFlight.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { setSigilDueling } from '../src/systems/sigil.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { ARROW_TEMPLATE, ammoCountFor } from '../src/systems/inventory.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { SKILLS } from '../src/systems/skills.js';
import { PlayerMotor, GRAVITY } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { techniqueUniform, techniqueQuadHalf } from '../src/render/foeTelegraph.js';

const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = () => ({ strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (o = {}) => ({ isPlayer: true, level: 8, items: [], stats: stats(), skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [], ...o });
const foeAt = (x, z, o = {}) => ({ entity: { ...player({ isPlayer: false }), health: 100, maxHealth: 100 }, ai: { feet: [x, 0, z], height: 1.8, yaw: 0, ...(o.ai ?? {}) }, ...o });
/** A weapon of `make`, Rare, with the technique `id` at `value`. */
const piece = (make, id, value = 20, tier = 'rare') => {
  const it = LR.applyRarity(make(), tier, lcg(7));
  it.isIdentified = true;
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  return it;
};
const arrows = (n) => ({ ...createWeapon(ARROW_TEMPLATE, 0), stackCount: n });
/** The ground at y = 0, as the hosts' colliders answer it: a look's ray, a fall's cast, the terrain's height. */
const flatGround = () => ({
  raycast: (o, d, max) => { if (!(d[1] < 0)) return Infinity; const t = -o[1] / d[1]; return t <= max ? t : Infinity; },
  surfaceHit: (o, d, max) => (d[1] < 0 && o[1] >= 0 && o[1] <= max ? { dist: o[1], normal: [0, 1, 0] } : null),
  heightAt: () => 0,
});
const R1 = {}, R2 = {};
/** A rig's frame context over a fake host: what the rig hands the runner (combat/weaponRig.js frame). */
function rig({ pw, entity, door = null, cam = null, collider = flatGround(), rigId = R1 }) {
  const log = { said: [], started: [], shots: 0 };
  const ctx = (held, extra = {}) => ({
    rig: rigId, entity, pw, cam: cam ?? { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: [0, 0, 0] }, collider, held, ready: true, cancel: false,
    startSwing: (s) => { if (!pw.techniqueStrike(s)) return false; log.started.push(s); return true; },
    door, say: (l) => log.said.push(l), noteShot: () => { log.shots++; }, ...extra,
  });
  return { log, ctx };
}
const weaponOf = (it) => { const pw = new PlayerWeapon({ weapon: it, liveSpeed: 50 }); pw.sheathed = false; pw.update(0); return pw; };
const reset = () => { _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null); };

test('TECH1 THE BLOW\'S SHAPE: all round, a half-angle about the look, DFU\'s view, a dash\'s lane - each on the level and in sight; a player\'s body never (mutants: the arc\'s cosine; the lane\'s width; the level; the sight)', () => {
  const sight = { dist: 2, inView: true, losClear: true };
  const all = { reach: 3, arc: 'all', feet: [0, 0, 0], yaw: 0 };
  assert.equal(blowReaches(all, foeAt(0, -3.4), sight), true, 'behind, its capsule\'s edge inside the reach');
  assert.equal(blowReaches(all, foeAt(0, -3.5), { ...sight, dist: 9 }), false, 'past it');
  assert.equal(blowReaches(all, foeAt(0, 2), { ...sight, losClear: false }), false, 'never through a wall');
  assert.equal(blowReaches(all, foeAt(0, 2, { ai: { feet: [0, 2.3, 2], height: 1.8 } }), { ...sight, dist: 9 }), false, 'off the level');
  const cone = { reach: 3.2, arc: 80 * Math.PI / 180, feet: [0, 0, 0], yaw: 0 };
  assert.equal(blowReaches(cone, foeAt(2, 1), sight), true, 'inside 80 degrees of the look');
  assert.equal(blowReaches(cone, foeAt(2, -0.5), sight), false, 'outside it');
  assert.equal(blowReaches(cone, foeAt(0.3, -0.3), sight), true, 'point-blank: every arc');
  const view = { reach: 2.5, arc: 'view', feet: [0, 0, 0], yaw: 0 };
  assert.equal(blowReaches(view, foeAt(0, 2), { dist: 2.4, inView: true, losClear: true }), true);
  assert.equal(blowReaches(view, foeAt(0, 2), { dist: 2.4, inView: false, losClear: true }), false, 'DFU\'s view');
  assert.equal(blowReaches(view, foeAt(0, 2), { dist: 2.6, inView: true, losClear: true }), false);
  const lane = { lane: { from: [0, 0], dir: [0, 1], len: 5, halfW: 0.9 }, feet: [0, 0, 5], yaw: 0 };
  assert.equal(blowReaches(lane, foeAt(1.3, 3), sight), true, 'the lane and a body\'s radius');
  assert.equal(blowReaches(lane, foeAt(1.4, 3), sight), false);
  assert.equal(blowReaches(lane, foeAt(0, 5.4), sight), true);
  assert.equal(blowReaches(lane, foeAt(0, -1), sight), false, 'nothing behind where the dash began');
  assert.equal(TECH_BODY_RADIUS, 0.45);
  assert.equal(playerBody({ duel: true }), true);
  assert.equal(playerBody({ rival: 0 }), true);
  assert.equal(playerBody(foeAt(0, 0)), false);
});

test('TECH1 THE BLOW\'S WEIGHT: the multiplier on the formula\'s number - Headsman\'s Chop\'s share of what the foe has lost - a landed blow at least 1, a miss a miss (mutants: the wounded share; the floor)', () => {
  assert.equal(blowMult({ mult: 1.4 }, foeAt(0, 0)), 1.4);
  const hurt = foeAt(0, 0); hurt.entity.health = 25;
  assert.ok(Math.abs(blowMult({ mult: 1.2, wounded: 1 }, hurt) - 1.95) < 1e-12);
  assert.equal(blowMult({ mult: 1.2, wounded: 1 }, foeAt(0, 0)), 1.2, 'whole: no share');
  assert.equal(scaleBlowDamage(8, 1.2), 10);
  assert.equal(scaleBlowDamage(1, 0.4), 1, 'a landed blow lands');
  assert.equal(scaleBlowDamage(0, 3), 0, 'a miss is a miss');
});

test('TECH1 THE SWING: PlayerWeapon.resolveHit with a technique\'s blow - its reach and arc for the pools\' foes, its weight on the formula\'s own number and its to-hit beside the swing\'s; `single` the nearest; a player\'s body the plain swing\'s (mutants: the blow unread; the weight unread; single ignored)', () => {
  const SWORD = { ...createWeapon(120, 1), group: 'Weapons' };
  const pw = new PlayerWeapon({ weapon: SWORD, liveSpeed: 50 });
  pw.machine.state = 'StrikeLeft';
  const near = foeAt(0, 1.5), behind = foeAt(0, -2.4);
  const sight = (f) => ({ dist: Math.hypot(f.ai.feet[0], f.ai.feet[2]), inView: f.ai.feet[2] > 0, losClear: true });
  const plain = pw.resolveHit([near, behind], player(), sight, () => 0.01);
  assert.deepEqual(plain.map((r) => r.foe), [near], 'the plain swing: what is in view, in reach');
  pw.techniqueBlow = T.swingBlow('whirlwind', 20, { feet: [0, 0, 0], yaw: 0 });
  const tech = pw.resolveHit([near, behind], player(), sight, () => 0.01);
  assert.deepEqual(tech.map((r) => r.foe), [near, behind], 'Whirlwind: all round');
  assert.equal(tech[0].damage, scaleBlowDamage(plain[0].damage, techniqueMult(1, 20)), 'the formula\'s own number, weighed');
  pw.techniqueBlow = T.swingBlow('crush', 0, { feet: [0, 0, 0], yaw: 0 });
  const far = foeAt(0, 2.2);
  assert.deepEqual(pw.resolveHit([far, near], player(), sight, () => 0.01).map((r) => r.foe), [near], 'Skull Crack: the nearest alone');
  pw.techniqueBlow = T.swingBlow('whirlwind', 20, { feet: [0, 0, 0], yaw: 0 });
  const duellist = { ...foeAt(0, -2.4), duel: true };
  assert.deepEqual(pw.resolveHit([duellist], player(), sight, () => 0.01), [], 'a player\'s body behind me: the plain swing\'s view');
  // the to-hit: a roll the plain swing misses on, the technique's +30 lands
  let missAt = null;
  for (let r = 0.05; r < 1 && missAt == null; r += 0.01) {
    pw.techniqueBlow = null;
    const p = pw.resolveHit([near], player(), sight, () => r)[0].damage;
    pw.techniqueBlow = T.swingBlow('crush', 0, { feet: [0, 0, 0], yaw: 0 });
    const c = pw.resolveHit([near], player(), sight, () => r)[0].damage;
    if (p === 0 && c > 0) missAt = r;
  }
  assert.ok(missAt != null, 'a sure blow lands where a plain one missed');
});

test('TECH1 THE SHAFT: a technique\'s arrow weighed at the impact every host shares; a piercing shot flies on through its number of foes, each once; a player\'s body passed by (mutants: the weight unread; the pierce count; the player\'s body struck)', () => {
  const BOW = { ...createWeapon(130, 1), group: 'Weapons' };
  const pw = new PlayerWeapon({ weapon: BOW, liveSpeed: 50 });
  pw.machine.state = 'StrikeDown';
  const me = player();
  const dealt = [];
  const hit = (m, foe) => playerArrowHitFoe(m, foe, { playerEntity: me, playerWeapon: pw, playerFeet: [0, 0, 0], dealDamage: (f, d) => dealt.push(d), rolls: () => 0.01 });
  const plain = hit({ weapon: BOW, pos: [0, 1, 3] }, foeAt(0, 3));
  const tech = hit({ weapon: BOW, pos: [0, 1, 3], technique: { mult: 1.5 } }, foeAt(0, 3));
  assert.ok(plain > 0);
  assert.equal(tech, scaleBlowDamage(plain, 1.5));
  assert.equal(hit({ weapon: BOW, pos: [0, 1, 3], technique: { mult: 1.5 } }, { ...foeAt(0, 3), rival: 0 }), plain, 'a rival\'s stand-in: the plain number');
  // the flight: a piercing shot down a line of three, struck in order, past a duellist
  const m = { technique: { pierce: 2 } };
  const a = foeAt(0, 1), b = foeAt(0, 2);
  assert.equal(techniquePierces(m, a), true, 'one struck, one more to go');
  assert.equal(techniquePierces(m, b), false, 'its number struck: it stops');
  assert.equal(techniquePierces({ technique: { pierce: 1 } }, a), false);
  assert.equal(techniquePierces({}, a), false, 'a plain shaft stops on what it strikes');
  const flight = new ArrowFlight({ getGpuMesh: () => null, collider: { raycast: () => Infinity, heightAt: () => -100 } });
  const line = [{ ...foeAt(0, 4), duel: true }, foeAt(0, 6), foeAt(0, 8), foeAt(0, 10)];
  const struck = [];
  flight.fire([0, 1, 0], [0, 0, 1], { fromPlayer: true, weapon: BOW, muzzle: { world: [0, 1, 0] }, technique: { pierce: 2, mult: 1 } });
  for (let i = 0; i < 60; i++) flight.update(1 / 60, { foeTargets: line.map((r) => ({ feet: r.ai.feet, ref: r })), onPlayerArrowHitFoe: (mm, ref) => struck.push(ref) });
  assert.deepEqual(struck, [line[1], line[2]], 'past the duellist, through two foes, then spent');
  const plainStruck = [];
  flight.fire([0, 1, 0], [0, 0, 1], { fromPlayer: true, weapon: BOW, muzzle: { world: [0, 1, 0] } });
  for (let i = 0; i < 60; i++) flight.update(1 / 60, { foeTargets: line.map((r) => ({ feet: r.ai.feet, ref: r })), onPlayerArrowHitFoe: (mm, ref) => plainStruck.push(ref) });
  assert.deepEqual(plainStruck, [line[0]], 'a plain shaft stops on the first body');
});

test('TECH1 THE KEY - A SWING: a press starts the machine\'s own strike with the blow on it, pays the fatigue (the sheet\'s points, undrained by BALANCE1) and the cooldown; the blow goes when the swing is done; the cooldown ticks on the frame and says itself (mutants: the blow before the strike; the price; the cooldown\'s tick; the line)', () => {
  reset();
  const me = player();
  const sword = piece(() => createWeapon(120, 1), 'whirlwind', 20);
  const pw = weaponOf(sword);
  const { log, ctx } = rig({ pw, entity: me });
  T.stepTechnique(1 / 60, ctx(true));
  assert.deepEqual(log.started, ['StrikeLeft']);
  assert.equal(pw.techniqueBlow.arc, 'all');
  assert.equal(pw.techniqueBlow.reach, 3);
  assert.ok(Math.abs(pw.techniqueBlow.mult - 1.2) < 1e-12);
  assert.equal(me.fatigue, 6400 - 5 * FATIGUE_MULTIPLIER);
  assert.equal(T.techniqueWait('whirlwind'), 10);
  T.stepTechnique(1 / 60, ctx(true));
  assert.equal(log.started.length, 1, 'held: one press, one strike');
  for (let i = 0; i < 240 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);
  T.stepTechnique(1 / 60, ctx(false));
  assert.equal(pw.techniqueBlow, null, 'the swing done: its blow gone');
  T.stepTechnique(1 / 60, ctx(true));
  assert.match(log.said.at(-1), /^Whirlwind is not ready \(\d+s\)\.$/);
  T.stepTechnique(1 / 60, ctx(false));
  T.stepTechnique(5, ctx(false));
  assert.ok(T.techniqueWait('whirlwind') > 9, 'a long frame counts as MAX_FRAME_DT - the motor\'s own clamp');
  for (let i = 0; i < 48; i++) T.stepTechnique(0.25, ctx(false));
  assert.equal(T.techniqueWait('whirlwind'), 0);
  assert.equal(log.said.at(-1), 'Whirlwind is ready again.');
  T.stepTechnique(1 / 60, ctx(true));
  assert.equal(log.started.length, 2, 'ready, it goes again');
});

test('TECH1 THE KEY - REFUSALS: no technique, the beast, the ladder off, a duel, sheathed, busy hands, tired, no arrows, no ground under a leap - each said (or, busy, silent) and nothing paid (mutants: each gate)', () => {
  const said = (setup) => {
    reset();
    const me = player();
    const s = setup(me);
    const { log, ctx } = rig({ pw: s.pw, entity: me, door: s.door ?? null });
    T.stepTechnique(1 / 60, ctx(true, s.extra ?? {}));
    return { said: log.said.at(-1) ?? null, started: log.started.length, fatigue: me.fatigue };
  };
  assert.equal(said(() => ({ pw: weaponOf(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(1))) })).said, T.NO_TECHNIQUE_TEXT);
  assert.equal(said(() => { const pw = weaponOf(null); pw.weapon = { werecreatureClaws: true }; return { pw }; }).said, T.BEAST_TEXT);
  const off = said(() => { const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind')); setPref('lootRarity', false); return { pw }; });
  assert.deepEqual([off.said, off.started, off.fatigue], [T.LADDER_OFF_TEXT, 0, 6400]);
  assert.equal(said(() => { setSigilDueling(true); return { pw: weaponOf(piece(() => createWeapon(120, 1), 'whirlwind')) }; }).said, T.DUEL_TEXT);
  setSigilDueling(false);
  assert.equal(said(() => { const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind')); pw.sheathed = true; return { pw }; }).said, T.SHEATHED_TEXT);
  const busy = said(() => ({ pw: weaponOf(piece(() => createWeapon(120, 1), 'whirlwind')), extra: { ready: false } }));
  assert.deepEqual([busy.said, busy.started], [null, 0], 'a spell readied, a cast, a climb: silent');
  assert.equal(said((me) => { me.fatigue = 100; return { pw: weaponOf(piece(() => createWeapon(120, 1), 'whirlwind')) }; }).said, T.TIRED_TEXT);
  assert.equal(said(() => ({ pw: weaponOf(piece(() => createWeapon(130, 1), 'volley')), door: { fireArrow() {} } })).said, T.NO_AMMO_TEXT);
  assert.equal(said(() => ({ pw: weaponOf(piece(() => createWeapon(130, 1), 'volley')) })).said, T.NOT_HERE_TEXT, 'a host with no lane');
  assert.equal(said(() => ({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap')), door: { motor: () => ({ grounded: false, techniqueLaunch: () => true }) } })).said, T.CANNOT_LEAP_TEXT, 'in the air');
  assert.equal(said(() => ({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap')), door: { motor: () => ({ grounded: true, swimming: true }) } })).said, T.CANNOT_LEAP_TEXT, 'in the water');
  // bare-handed: the Gauntlets' technique; with none, none
  reset();
  const me = player();
  const g = piece(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: 103, material: 0x0201 })), 'haymaker');
  me.equip.slots[EQUIP_SLOTS.Gloves] = g;
  const fists = weaponOf(null);
  assert.equal(T.techniqueInHand(me, fists).id, 'haymaker');
  const { log, ctx } = rig({ pw: fists, entity: me });
  T.stepTechnique(1 / 60, ctx(true));
  assert.deepEqual(log.started, ['StrikeRight']);
  assert.equal(T.techniqueInHand(me, weaponOf(createWeapon(120, 1))), null, 'a weapon in hand: the gauntlets sleep');
  // asked again at the release: a duel begun while the aim is held - the key says so, and nothing goes or is paid
  reset();
  const me3 = player(); me3.items.push(arrows(9));
  const pw3 = weaponOf(piece(() => createWeapon(130, 1), 'volley'));
  const r3 = rig({ pw: pw3, entity: me3, door: { fireArrow() {}, drainFatigue: (n) => { me3.fatigue -= n; } } });
  T.stepTechnique(1 / 60, r3.ctx(true));
  assert.equal(T.techniqueState().aiming, true);
  setSigilDueling(true);
  T.stepTechnique(1 / 60, r3.ctx(false));
  assert.deepEqual(r3.log.said, [T.DUEL_TEXT]);
  assert.deepEqual(r3.log.started, []);
  assert.equal(me3.fatigue, 6400);
  assert.equal(T.techniqueWait('volley'), 0);
  setSigilDueling(false);
});

test('TECH1 THE KEY - A VOLLEY: held, it aims a disc where the look meets the ground; let go, the bow looses (its hit frame the technique\'s, not the host\'s); its shafts - as many as the quiver gives, each spent and tallied - fall on the disc from above, through the host\'s own lane, weighed (mutants: the hit frame left to the host; the arrows unspent; the sky origin; the weight)', () => {
  reset();
  const me = player({ skillUses: new Array(35).fill(0) });
  const bow = piece(() => createWeapon(130, 1), 'volley', 20);
  me.items.push(arrows(10));
  const pw = weaponOf(bow);
  const fired = [];
  const { log, ctx } = rig({ pw, entity: me, door: { fireArrow: (from, dir, o) => fired.push({ from, dir, o }), drainFatigue: (n) => { me.fatigue -= n; } } });
  T.stepTechnique(1 / 60, ctx(true));
  assert.equal(T.techniqueState().aiming, true);
  const aim = T.techniqueState().aim;
  assert.equal(aim.ok, true);
  assert.ok(Math.abs(aim.point[2] - 1.7 / Math.tan(0.2)) < 0.5 && aim.point[1] === 0, `the look's ground: ${aim.point}`);
  assert.equal(log.started.length, 0, 'aiming starts no shot');
  const marks = T.techniqueMarks(0);
  assert.equal(marks.length, 1);
  assert.deepEqual([marks[0].blow.kind, marks[0].blow.r, marks[0].blow.technique], ['leap', 3.5, true]);
  assert.deepEqual(marks[0].blow.color, T.TECH_COLOR);
  T.stepTechnique(1 / 60, ctx(true));
  T.stepTechnique(1 / 60, ctx(false));
  assert.deepEqual(log.started, ['StrikeDown'], 'let go: the bow looses');
  let evs = [];
  for (let i = 0; i < 120 && !evs.includes('hit'); i++) evs = pw.update(1 / 60);
  assert.ok(evs.includes('hit'));
  const out = T.claimShot(evs, ctx(false));
  assert.ok(!out.includes('hit'), 'the hit frame is the technique\'s - no host looses a plain arrow on it');
  assert.equal(ammoCountFor(me.items, bow), 4, 'six shafts spent');
  assert.deepEqual([me.skillUses[SKILLS.Archery], me.skillUses[SKILLS.CriticalStrike]], [6, 6], 'each a shot\'s tally');
  assert.equal(log.shots, 1, 'the peers see the loose');
  for (let i = 0; i < 180; i++) T.stepTechnique(1 / 60, ctx(false));
  assert.equal(fired.length, 6);
  for (const f of fired) {
    assert.equal(f.o.sky, true);
    assert.ok(Math.abs(f.o.technique.mult - 0.6) < 1e-12, 'Volley: half a shot, +20%');
    assert.ok(f.from[1] > 10 && f.dir[1] < -0.9, 'from the sky, falling');
    const land = [f.from[0] + f.dir[0] * (f.from[1] / -f.dir[1]), f.from[2] + f.dir[2] * (f.from[1] / -f.dir[1])];
    assert.ok(Math.hypot(land[0] - aim.point[0], land[1] - aim.point[2]) <= 3.5 + 1e-6, 'each on the disc');
  }
  assert.equal(T.techniqueState().act, null, 'all fallen');
  // a short quiver looses what it holds
  reset();
  const me2 = player(); me2.items.push(arrows(2));
  const pw2 = weaponOf(piece(() => createWeapon(130, 1), 'volley', 20));
  const f2 = [];
  const r2 = rig({ pw: pw2, entity: me2, door: { fireArrow: (a, b, o) => f2.push(o) } });
  T.stepTechnique(1 / 60, r2.ctx(true)); T.stepTechnique(1 / 60, r2.ctx(false));
  let e2 = [];
  for (let i = 0; i < 120 && !e2.includes('hit'); i++) e2 = pw2.update(1 / 60);
  T.claimShot(e2, r2.ctx(false));
  for (let i = 0; i < 180; i++) T.stepTechnique(1 / 60, r2.ctx(false));
  assert.equal(f2.length, 2);
  assert.equal(ammoCountFor(me2.items, pw2.weapon), 0);
});

test('TECH1 THE KEY - A PIERCING SHOT: a tap looses at the look - one shaft from the bow hand along it, flying faster, through five (mutants: the pierce count; the speed; the hand)', () => {
  reset();
  const me = player(); me.items.push(arrows(3));
  const pw = weaponOf(piece(() => createWeapon(129, 1), 'pierce', 10));
  const fired = [];
  const { ctx } = rig({ pw, entity: me, door: { fireArrow: (from, dir, o) => fired.push({ from, dir, o }) } });
  T.stepTechnique(1 / 60, ctx(true));
  const lane = T.techniqueMarks(0);
  assert.deepEqual(lane.map((m) => m.blow.kind), ['aimed'], 'the lane of the shot');
  T.stepTechnique(1 / 60, ctx(false));
  let evs = [];
  for (let i = 0; i < 120 && !evs.includes('hit'); i++) evs = pw.update(1 / 60);
  T.claimShot(evs, ctx(false));
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0].from, [0, 1.7, 0], 'the eye - the lane turns it to the bow hand');
  assert.equal(fired[0].o.sky, false);
  assert.equal(fired[0].o.technique.pierce, 5);
  assert.equal(fired[0].o.speedScale, 1.6);
  assert.ok(Math.abs(fired[0].o.technique.mult - 1.32) < 1e-12);
  assert.equal(ammoCountFor(me.items, pw.weapon), 2);
});

test('TECH1 THE LOOSE HELD: under the Morrowind arm the rig holds a shot\'s hit for the string\'s release (MW-D42) - the technique waits for it past the machine\'s idle, and gives up only on a loose that never comes (mutants: the hold unread; the give-up)', () => {
  reset();
  const me = player(); me.items.push(arrows(3));
  const pw = weaponOf(piece(() => createWeapon(129, 1), 'pierce', 10));
  const fired = [];
  const { ctx } = rig({ pw, entity: me, door: { fireArrow: (from, dir, o) => fired.push(o) } });
  T.stepTechnique(1 / 60, ctx(true)); T.stepTechnique(1 / 60, ctx(false));
  for (let i = 0; i < 200 && pw.machine.state !== 'Idle'; i++) pw.update(1 / 60);   // the machine's hit, held by the rig: never handed in
  for (let i = 0; i < 30; i++) T.stepTechnique(1 / 60, ctx(false, { holding: true }));
  assert.equal(T.techniqueState().act, 'shot', 'still waiting on the string');
  assert.deepEqual(T.claimShot(['hit'], ctx(false)), [], 'the held hit, flushed: the technique\'s');
  assert.equal(fired.length, 1);
  // a loose that never comes: let go
  reset();
  const pw2 = weaponOf(piece(() => createWeapon(129, 1), 'pierce', 10));
  const me2 = player(); me2.items.push(arrows(3));
  const r2 = rig({ pw: pw2, entity: me2, door: { fireArrow() {} } });
  T.stepTechnique(1 / 60, r2.ctx(true)); T.stepTechnique(1 / 60, r2.ctx(false));
  for (let i = 0; i < 200 && pw2.machine.state !== 'Idle'; i++) pw2.update(1 / 60);
  for (let i = 0; i < 5; i++) T.stepTechnique(1 / 60, r2.ctx(false));
  assert.equal(T.techniqueState().act, null);
  assert.deepEqual(T.claimShot(['hit'], r2.ctx(false)), ['hit'], 'a later hit is the host\'s own');
});

test('TECH1 THE KEY - A LEAP: aimed at the foe under the crosshair it lands before it, on the motor\'s own flight; the strike is started to land with the body and strikes all round the landing (mutants: the landing\'s place; the strike\'s time; the ring)', () => {
  reset();
  const me = player();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'leap', 20));
  const target = foeAt(0, 7);
  setPlayerDoor({ foes: () => [target] });
  let launched = null;
  const motor = { grounded: true, techniqueLaunch(dir, along, up) { launched = { dir, along, up }; this.grounded = false; return true; } };
  const { log, ctx } = rig({ pw, entity: me, door: { motor: () => motor }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.02, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, ctx(true));
  const aim = T.techniqueState().aim;
  assert.equal(aim.foe, target);
  assert.ok(Math.abs(aim.point[2] - (7 - (0.45 + 0.55))) < 1e-9, `before it: ${aim.point}`);
  T.stepTechnique(1 / 60, ctx(false));
  const fl = T.launchTo([0, 0, 0], aim.point, TECHNIQUES.leap.apex);
  assert.deepEqual(launched, { dir: fl.dir, along: fl.along, up: fl.up });
  assert.equal(T.techniqueState().act, 'flight');
  assert.equal(log.started.length, 0, 'not at the launch');
  let t = 0;
  while (log.started.length === 0 && t < 2) { T.stepTechnique(1 / 60, ctx(false)); t += 1 / 60; }
  assert.deepEqual(log.started, ['StrikeDown']);
  assert.ok(t < fl.time && t > fl.time - 0.9, `started in the air, to land with it (${t.toFixed(2)} of ${fl.time.toFixed(2)})`);
  assert.equal(pw.techniqueBlow.arc, 'all');
  assert.equal(pw.techniqueBlow.reach, 2.5);
  // the ground's own, with no foe under the look
  reset();
  setPlayerDoor({ foes: () => [] });
  const r2 = rig({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap', 20)), entity: player(), door: { motor: () => ({ grounded: true, techniqueLaunch: () => true }) }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.3, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, r2.ctx(true));
  const g = T.techniqueState().aim;
  assert.equal(g.foe ?? null, null);
  assert.ok(g.ok && Math.abs(g.point[2] - 1.7 / Math.tan(0.3)) < 0.5);
  // the look in the sky: the reach's own point along it, on the ground
  reset();
  setPlayerDoor({ foes: () => [] });
  const sky = rig({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap', 20)), entity: player(), door: { motor: () => ({ grounded: true, techniqueLaunch: () => true }) }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: 0.4, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, sky.ctx(true));
  assert.deepEqual(T.techniqueState().aim.point, [0, 0, 9]);
  // a drop past TECH_DROP_MAX: refused on release, nothing paid
  reset();
  setPlayerDoor({ foes: () => [] });
  const pit = { raycast: (o, d, max) => { if (!(d[1] < 0)) return Infinity; const t = (-6 - o[1]) / d[1]; return t <= max ? t : Infinity; }, surfaceHit: (o, d) => (d[1] < 0 ? { dist: o[1] + 6 } : null), heightAt: () => -6 };
  const me3 = player();
  const r3 = rig({ pw: weaponOf(piece(() => createWeapon(120, 1), 'leap', 20)), entity: me3, collider: pit, door: { motor: () => ({ grounded: true, techniqueLaunch: () => true }) }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.7, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, r3.ctx(true));
  assert.equal(T.techniqueMarks(0)[0].blow.color, T.TECH_BAD_COLOR, 'the mark says it, red');
  T.stepTechnique(1 / 60, r3.ctx(false));
  assert.equal(r3.log.said.at(-1), T.OUT_OF_REACH_TEXT, 'six metres down');
  assert.equal(me3.fatigue, 6400);
});

test('TECH1 THE KEY - SHADOWSTEP AND LUNGE: a dash behind the foe aimed (beside it where a wall stands), the view turned on it, the strike its alone; a lunge\'s strike is the lane it ran (mutants: the side; the turn; the lane)', () => {
  reset();
  const foe = foeAt(0, 5, { ai: { feet: [0, 0, 5], height: 1.8, yaw: Math.PI } });   // facing me
  setPlayerDoor({ foes: () => [foe] });
  let faced = null;
  const motor = { grounded: true, techniqueLaunch() { this.grounded = false; return true; } };
  const pw = weaponOf(piece(() => createWeapon(113, 1), 'shadowstep', 10));
  const { log, ctx } = rig({ pw, entity: player(), door: { motor: () => motor, face: (p) => { faced = p; } }, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.05, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, ctx(true));
  const aim = T.techniqueState().aim;
  assert.ok(Math.abs(aim.point[2] - 6) < 1e-9 && Math.abs(aim.point[0]) < 1e-9, `behind it: ${aim.point}`);
  T.stepTechnique(1 / 60, ctx(false));
  for (let i = 0; i < 90 && !log.started.length; i++) T.stepTechnique(1 / 60, ctx(false));
  assert.deepEqual(log.started, ['StrikeRight']);
  assert.deepEqual(faced, foe.ai.feet, 'turned on it');
  assert.equal(pw.techniqueBlow.target, foe);
  // no foe: no shadowstep
  reset();
  setPlayerDoor({ foes: () => [] });
  const r2 = rig({ pw: weaponOf(piece(() => createWeapon(113, 1), 'shadowstep')), entity: player(), door: { motor: () => ({ grounded: true, techniqueLaunch: () => true }) } });
  T.stepTechnique(1 / 60, r2.ctx(true)); T.stepTechnique(1 / 60, r2.ctx(false));
  assert.equal(r2.log.said.at(-1), T.NO_FOE_TEXT);
  // the lunge: its lane from where it began, along the look on the level, to its length or the wall
  reset();
  const lpw = weaponOf(piece(() => createWeapon(116, 1), 'lunge', 10));
  const r3 = rig({ pw: lpw, entity: player(), door: { motor: () => ({ grounded: true, techniqueLaunch() { this.grounded = false; return true; } }) }, cam: { pos: [0, 1.7, 0], yaw: Math.PI / 2, pitch: 0, feet: [0, 0, 0] } });
  T.stepTechnique(1 / 60, r3.ctx(true));
  assert.deepEqual(T.techniqueMarks(0).map((m) => m.blow.kind), ['lunge']);
  T.stepTechnique(1 / 60, r3.ctx(false));
  for (let i = 0; i < 90 && !r3.log.started.length; i++) T.stepTechnique(1 / 60, r3.ctx(false));
  const lane = lpw.techniqueBlow.lane;
  assert.deepEqual([lane.from, lane.len, lane.halfW], [[0, 0], 5, 0.9]);
  assert.ok(Math.abs(lane.dir[0] - 1) < 1e-9 && Math.abs(lane.dir[1]) < 1e-9, 'along the look');
});

test('TECH1 THE AIM SET ASIDE: the Activate press, a weapon changed, another rig\'s frame - and its blow taken off the weapon it was set on (mutants: the cancel; the rig\'s identity)', () => {
  reset();
  const pw = weaponOf(piece(() => createWeapon(130, 1), 'volley'));
  const me = player(); me.items.push(arrows(9));
  const { log, ctx } = rig({ pw, entity: me, door: { fireArrow() {} } });
  T.stepTechnique(1 / 60, ctx(true));
  T.stepTechnique(1 / 60, ctx(true, { cancel: true }));
  assert.equal(T.techniqueState().aiming, false);
  T.stepTechnique(1 / 60, ctx(false));
  assert.equal(log.started.length, 0, 'let go after: nothing');
  // a door crossed mid-aim: the next host's rig holds the same weapon for the same player, and the aim is set aside
  reset();
  const bow = piece(() => createWeapon(130, 1), 'volley');
  const me2 = player(); me2.items.push(arrows(9));
  const here = rig({ pw: weaponOf(bow), entity: me2, door: { fireArrow() {} } });
  const there = rig({ pw: weaponOf(bow), entity: me2, door: { fireArrow() {} }, rigId: R2 });
  T.stepTechnique(1 / 60, here.ctx(true));
  assert.equal(T.techniqueState().aiming, true);
  T.stepTechnique(1 / 60, there.ctx(true));
  assert.equal(T.techniqueState().aiming, false, 'the aim was the last rig\'s');
  T.stepTechnique(1 / 60, there.ctx(false));
  assert.deepEqual([here.log.started, there.log.started], [[], []], 'let go: nothing goes');
  // another rig steps mid-swing: the swing's blow comes off the first weapon
  reset();
  const pw1 = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  const a = rig({ pw: pw1, entity: player() });
  T.stepTechnique(1 / 60, a.ctx(true));
  assert.ok(pw1.techniqueBlow);
  const b = rig({ pw: weaponOf(createWeapon(120, 1)), entity: player(), rigId: R2 });
  T.stepTechnique(1 / 60, b.ctx(false));
  assert.equal(pw1.techniqueBlow, null);
  assert.equal(T.techniqueState().act, null);
  assert.equal(T.techniqueWait('whirlwind'), 10 - 1 / 60, 'its price stays paid');
});

test('TECH1 THE FLIGHT: launchTo lands where it aims on the motor\'s gravity, its run never past the relay\'s believing; the real motor flies it there, its air control unsteered, and refuses it in the water (mutants: the arc\'s time; the cap; the air control)', () => {
  for (const [to, apex] of [[[0, 0, 9], 1.6], [[3, 1.5, 4], 1.6], [[0, -3, 6], 1.2], [[0, 0, 8], 0.25]]) {
    const f = T.launchTo([0, 0, 0], to, apex);
    assert.ok(f.along <= 16 + 1e-9);
    const h = Math.hypot(to[0], to[2]);
    assert.ok(Math.abs(f.along * f.time - h) < 1e-6, 'the run covers the way in the time');
    const y = f.up * f.time - 0.5 * GRAVITY * f.time * f.time;
    assert.ok(Math.abs(y - to[1]) < 1e-6, 'and lands at its height');
  }
  assert.ok(T.launchTo([0, 0, 0], [0, 0, 8], 0.25).up > Math.sqrt(2 * GRAVITY * 0.25), 'a dash past the cap rises to keep under it');
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => ({ positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz], indices: [0, 1, 2, 0, 2, 3] });
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const fly = (input, enhanced) => {
    const col = new Collider(() => 0);
    const fl = quad(-30, 0, -30, 30, 0, -30, 30, 0, 30, -30, 0, 30);
    col.addMesh('floor', fl.positions, fl.indices, I);
    const m = new PlayerMotor(col, undefined, { enhancedJumping: () => enhanced });
    m.spawn(0, 0, 0);
    const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
    for (let i = 0; i < 20; i++) m.update(1 / 60, still, 0);
    const f = T.launchTo(m.pos, [0, 0, 9], 1.6);
    assert.equal(m.techniqueLaunch(f.dir, f.along, f.up), true);
    assert.equal(m.techFlight, true);
    for (let i = 0; i < 120; i++) { m.update(1 / 60, input, 0); if (i > 5 && m.grounded) break; }   // to the landing
    return m;
  };
  const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
  const m = fly(still, false);
  assert.ok(Math.abs(m.pos[2] - 9) < 0.35 && m.grounded, `landed by it: ${m.pos}`);
  m.update(1 / 60, still, 0);
  assert.equal(m.techFlight, false, 'the flight ends on the ground');
  const steered = fly({ ...still, strafe: 1 }, true);
  assert.ok(Math.abs(steered.pos[0]) < 0.35, 'a Jump spell\'s air control does not steer it');
  const wet = new PlayerMotor({ move: () => ({}), raycast: () => Infinity, heightAt: () => 0 });
  wet.swimming = true;
  assert.equal(wet.techniqueLaunch([0, 0, 1], 5, 5), false);
});

test('TECH1 THE AIM\'S MATH: the ground the look meets within the reach (pulled to it past it), a volley\'s points on its disc each apart, the foe nearest the look\'s line in sight (mutants: the reach clamp; the spiral; the cone)', () => {
  const g = T.groundAim([0, 1.7, 0], [0, 0, 1], [0, 0, 0], flatGround(), 20);
  assert.deepEqual(g.point, [0, 0, 20], 'level look: the reach\'s own point, on the ground');
  const pts = T.volleyPoints([5, 0, 5], 3.5, 6, 0.3);
  assert.equal(pts.length, 6);
  for (const p of pts) assert.ok(Math.hypot(p[0] - 5, p[2] - 5) <= 3.5);
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][2] - pts[j][2]) > 0.8, 'no two on one spot');
  const ahead = foeAt(0.4, 8), wide = foeAt(4, 8);
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, flatGround(), [wide, ahead]), ahead);
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, flatGround(), [wide]), null);
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, { raycast: () => 2 }, [ahead]), null, 'behind a wall');
  assert.equal(T.foeUnderLook([0, 1.7, 0], [0, 0, 1], 9, flatGround(), [{ ...ahead, duel: true }]), null, 'never a player\'s body');
});

test('TECH1 THE SCREEN: the marks in the ground pass at their own sizes, nothing added when none; the chip names the technique and its key or its seconds; a recentre moves every point (mutants: the uniform; the half; the chip\'s state)', () => {
  reset();
  assert.deepEqual(T.techniqueMarksNow(0), [], 'no marks: nothing for the pass to draw');
  assert.deepEqual(techniqueUniform({ kind: 'leap', r: 3.5, ahead: 0 }), [3.5, 0, 0, 0]);
  assert.deepEqual(techniqueUniform({ kind: 'lunge', len: 5, halfW: 0.9 }), [5, 0.9, 0, 0]);
  assert.deepEqual(techniqueUniform({ kind: 'aimed', ahead: 20, halfW: 0.3 }), [20, 0.3, 0, 0]);
  assert.ok(Math.abs(techniqueQuadHalf({ kind: 'leap', r: 3.5, ahead: 0 }) - 4.1) < 1e-12);
  assert.ok(Math.abs(techniqueQuadHalf({ kind: 'lunge', len: 5, halfW: 0.9 }) - 6.5) < 1e-12);
  const me = player();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  assert.deepEqual(T.techniqueHudChips(me, pw, 'MOUSE3'), [{ key: 'technique', set: 'technique', name: 'Whirlwind', text: 'MOUSE3', state: 'active' }]);
  const { ctx } = rig({ pw, entity: me });
  T.stepTechnique(1 / 60, ctx(true));
  assert.deepEqual(T.techniqueHudChips(me, pw, 'MOUSE3'), [{ key: 'technique', set: 'technique', name: 'Whirlwind', text: '10s', state: 'recovering' }]);
  assert.deepEqual(T.techniqueHudChips(me, weaponOf(createWeapon(120, 1))), [], 'no technique in hand');
  // the ring of a swing that strikes all round, and its recentre
  const ring = T.techniqueMarks(0);
  assert.deepEqual(ring.map((m) => [m.blow.kind, m.blow.r]), [['leap', 3]]);
  T.offsetTechniques([10, 0, -5]);
  assert.deepEqual(pw.techniqueBlow.feet, [10, 0, -5]);
  setPref('lootRarity', false);
  assert.deepEqual(T.techniqueHudChips(me, pw), [], 'the ladder off: no chip');
  _resetForTests();
});
