// WATCH-PROTECTS (2026-10-06, Mac: "improve the guards" - asked, "The watch protects people": a monster attacking
// townspeople draws the watch to defend them; bible/06-Systems/Living-World.md WATCH-PROTECTS): THE WATCH PROTECTS THE
// TOWN'S PEOPLE. Before it no monster could turn on a townsperson - DFU's enemy senses weigh other enemies and the
// player alone ("Civilian Mobile NPCs are not handled here", EnemySenses.cs:739-741) - and the watch's defenders came
// only to a monster hunting the player (systems/townWatch.js isTownThreat); a townsperson stood on beside a monster's
// fight. Pinned on the target chain's own EnemyAI over a floor, the town watch's decision, and the synthetic town.
import './modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTargets, huntsCivilians, PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { makeQuarry, QUARRY_BLOW, QUARRY_HEIGHT } from '../src/systems/livingWorld/quarry.js';
import { applyDamageToNonPlayer } from '../src/scenes/hostCombat.js';
import { isTownThreat, createTownWatch, runTownWatchFrame } from '../src/systems/townWatch.js';
import { synthTown } from './lwTown.mjs';
import { LivingTown, PANIC_M, FLEE_SPEED, FLEE_HOLD_S, FLEE_FAR_M, FLEE_WARY_M, SNAP_M } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED, PERSON_IDLE_RECORD, MOVE_RECORDS } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { createRelations, FRIEND_AT } from '../src/systems/livingWorld/relations.js';
import { streetGeometry } from '../src/systems/livingWorld/places.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const floored = () => { const c = new Collider(() => -100); c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4); return c; };
const COL = floored();
/** A foe of the pools' shape: its own EnemyAI over the floor, facing +z. */
const foe = (feet, team, { hostile = true, ranged = false, ...over } = {}) => {
  const ai = Object.assign(new EnemyAI(COL, feet, 0, { liveSpeed: 50, height: 1.8, centreOffset: 0.9 }), { wouldBeSpawned: true });
  ai.isHostile = hostile;
  return { ai, entity: { team, mobileTeam: team }, mobile: { basics: { hasRangedAttack1: ranged } }, ...over };
};
/** A townsperson's body at `feet`, as the host stands it. */
const quarry = (feet, struck = () => {}) => { const q = makeQuarry({ living: { id: 'L1.1' } }, struck); q.ai.feet = [...feet]; return q; };

test('WATCH-PROTECTS who hunts a townsperson (huntsCivilians): a hostile monster that fights hand to hand - never the watch, an ally, a companion, a quest\'s foe, a class, an archer or a caster, nor one not hostile; the target machine weighs the townsperson for it alone, as near as the player, no likelier (no "has no foe" weight); every other foe passes them by (mutants: each)', () => {
  assert.equal(huntsCivilians(foe([0, 0, 0], 'Wolves')), true, 'a wolf');
  for (const [why, f] of [
    ['the watch', foe([0, 0, 0], 'CityWatch')], ['an ally', foe([0, 0, 0], 'PlayerAlly')], ['a companion', foe([0, 0, 0], 'Wolves', { companion: 1 })],
    ['a quest\'s foe', foe([0, 0, 0], 'Wolves', { isQuestFoe: true })], ['not hostile', foe([0, 0, 0], 'Wolves', { hostile: false })],
    ['an archer', foe([0, 0, 0], 'Orcs', { ranged: true })], ['a caster', foe([0, 0, 0], 'Imps', { caster: {} })],
    ['one with spells', foe([0, 0, 0], 'Imps', { entity: { team: 'Imps', mobileTeam: 'Imps', spells: [1] } })],
    ['a class', foe([0, 0, 0], 'Thieves', { entity: { team: 'Thieves', mobileTeam: 'Thieves', isClass: true } })],
  ]) assert.equal(huntsCivilians(f), false, why);
  // the machine: the wolf takes the townsperson nearer than the player, the player nearer than the townsperson
  const wolf = foe([0, 0, 0], 'Wolves');
  const near = quarry([0, 0, 5]);
  assert.equal(getTargets(wolf, [near], [0, 0, 20], { infighting: false }).target, near, 'the townsperson, nearer');
  assert.equal(getTargets(wolf, [near], [0, 0, 3], { infighting: false }).target, PLAYER_TARGET, 'the player, nearer');
  // no likelier than the player: a foe with no foe of its own weighs 5 more (DFU's spread) - a townsperson does not
  const by = quarry([0, 0, 8]);
  assert.equal(getTargets(wolf, [by], [0, 0, 7], { infighting: false }).target, PLAYER_TARGET, 'a metre nearer, the player');
  // whatever the infighting setting, and never for the watch, an ally or the rest
  assert.equal(getTargets(wolf, [near], [0, 0, 20], { infighting: true }).target, near);
  for (const f of [foe([0, 0, 0], 'CityWatch'), foe([0, 0, 0], 'PlayerAlly'), foe([0, 0, 0], 'Orcs', { ranged: true })]) {
    assert.notEqual(getTargets(f, [near], [0, 0, 20], { infighting: true }).target, near);
  }
  // a townsperson struck down is nobody's quarry: the machine lets go of a body at no health
  near.hurtFromFoe(1, null, wolf);
  assert.equal(near.entity.health, 0);
});

test('WATCH-PROTECTS one landed blow: a townsperson\'s body falls to the first blow a monster lands, whatever it would deal (QUARRY_BLOW - the player\'s one hit on a civilian, DFU\'s), through the pools\' one non-player arm (the hit\'s sound and blood, the host\'s word once); the foe pool hands it that blow for a townsperson (mutants: the blow, the once, the arm)', () => {
  const struck = [];
  const q = quarry([0, 0, 1], (body, by) => struck.push([body, by]));
  assert.equal(q.ai.height, QUARRY_HEIGHT);
  const wolf = foe([0, 0, 0], 'Wolves');
  const played = [], blood = [];
  const dealt = applyDamageToNonPlayer(wolf, q, {
    calculateAttackDamage: QUARRY_BLOW, direction: [0, 0, 1], rolls: () => 0.5,
    dealDamage: (t, d) => t.hurtFromFoe(d, [0, 0, 1], wolf),
    audio: { play3d: (clip) => played.push(clip) }, hitEffects: { showBloodSplash: (...a) => blood.push(a) },
  });
  assert.equal(dealt, 1);
  assert.deepEqual(struck, [[q, wolf]], 'the host told, by whom');
  assert.ok(played.length > 0 && blood.length === 1, 'the blow heard and seen');
  assert.equal(q.hurtFromFoe(9, null, wolf), 0, 'once');
  assert.equal(struck.length, 1);
  const pool = rd('src/scenes/exteriorFoes.js');
  assert.match(pool, /calculateAttackDamage: _foeTarget\.civilian \? QUARRY_BLOW : calculateAttackDamage,/);
});

test('WATCH-PROTECTS the watch comes: a monster hunting a townsperson alive is the town\'s threat (isTownThreat), so the watch\'s defenders come to it after the arrival\'s countdown; one struck down is not (mutants: the clause, the alive)', () => {
  const rect = { inTownRect: () => true };
  const wolf = foe([0, 0, 0], 'Wolves');
  wolf.ai.target = quarry([0, 0, 2]);
  assert.equal(isTownThreat(wolf, rect), true);
  const watch = createTownWatch({ rand: () => 0 });
  const guards = { defenderCount: () => 0, summoned: 0, summonDefenders() { this.summoned++; return Promise.resolve(); }, dismissDefenders() {} };
  let act = null;
  for (let i = 0; i < 200 && act !== 'summon'; i++) act = runTownWatchFrame(watch, 0.1, { enabled: true, inTown: true, crime: false, locationKey: 'k', foes: [wolf], inTownRect: () => true, guards, playerFeet: [0, 0, 0], playerFwd: [0, 0, 1] });
  assert.equal(act, 'summon');
  assert.equal(guards.summoned, 1);
  wolf.ai.target.hurtFromFoe(1, null, wolf);
  assert.equal(isTownThreat(wolf, rect), false, 'struck down: no fight to come to');
});

const RATE = CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
function makeTown(minute, dangers) {
  const fx = synthTown();
  const clock = { t: minute }, killed = [];
  const relations = createRelations();
  const town = new LivingTown(fx.nav, {
    town: TOWN, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, relations: () => relations,
    dangers: () => dangers.list, killed: (res, t) => killed.push([res.id, t]),
  });
  const sq = town.places.square;
  return { town, clock, killed, relations, nav: fx.nav, at: [sq.x, 0, sq.z], street: streetGeometry(fx.nav, town.places) };
}
/** A frame of the town, the player at `at` (the square), `stops` the street's politeness gate. */
const frame = (t, dt = 1 / 30, at = t.at, stops = () => false) => { t.clock.t += RATE * dt; return t.town.update(dt, at, 0, at, true, stops); };

/** The town's people standing on the street, nearest a wall first: each with the way to the wall nearest them and how
 *  far it is (the street's reach over 64 headings). */
function standingAbout(t) {
  for (let i = 0; i < 60; i++) frame(t);
  const seats = t.town.update(0, t.at, 0, t.at, true, () => false);
  const wall = (p) => {
    let reach = Infinity, dir = 0;
    for (let k = 0; k < 64; k++) {
      const a = k * Math.PI / 32, r = t.street.reach(p.pos[0], p.pos[2], p.pos[0] + Math.sin(a) * 30, p.pos[2] + Math.cos(a) * 30);
      if (r < reach) { reach = r; dir = a; }
    }
    return { reach, dir };
  };
  return seats.filter((s) => !s.person.moving && t.town.pool.some((r) => r.person === s.person && r.visible))
    .map((s) => ({ p: s.person, ...wall(s.person) })).sort((a, b) => a.reach - b.reach);
}

test('WATCH-PROTECTS the street runs: one on the street a hostile monster comes within PANIC_M of runs straight from it at FLEE_SPEED, on the street, their day held for them (its minutes owed); kept clear while it stands within FLEE_WARY_M (standing, never their day back to it), and FLEE_HOLD_S after it is gone, then their day takes them on - and those beyond its reach never stirred (mutants: the reach, the pace, the away, the wary, the hold, the owed)', () => {
  assert.ok(FLEE_SPEED === PERSON_MOVE_SPEED * 2 && FLEE_FAR_M < SNAP_M && PANIC_M === 10 && FLEE_WARY_M === 2 * PANIC_M && FLEE_HOLD_S === 4);
  const dangers = { list: [] };
  const t = makeTown(100 * DAY_MIN + 13 * 60, dangers);
  for (let i = 0; i < 60; i++) frame(t);
  const seats = t.town.update(0, t.at, 0, t.at, true, () => false);
  const standing = seats.filter((s) => !s.person.moving);
  assert.ok(standing.length > 3, 'people standing about the square');
  const victim = standing[0].person;
  const at = [victim.pos[0] + 4, victim.pos[2]];   // a monster four metres east of them
  const others = seats.filter((s) => s.person !== victim && Math.hypot(s.person.pos[0] - at[0], s.person.pos[2] - at[1]) > PANIC_M + 1).map((s) => [s.person, [...s.person.pos]]);
  dangers.list = [at];
  const start = [victim.pos[0], victim.pos[2]];
  let ran = 0, last = Math.hypot(victim.pos[0] - at[0], victim.pos[2] - at[1]);
  for (let i = 0; i < 30; i++) {
    frame(t);
    const d = Math.hypot(victim.pos[0] - at[0], victim.pos[2] - at[1]);
    assert.ok(d >= last - 1e-9, 'away from it');
    assert.ok(t.street.holds(victim.pos[0], victim.pos[2]), 'on the street');
    ran = Math.max(ran, Math.hypot(victim.pos[0] - start[0], victim.pos[2] - start[1]));
    last = d;
  }
  assert.ok(ran > FLEE_SPEED * 0.6 && ran <= FLEE_SPEED * 1.05, `a second at the run (${ran.toFixed(2)} m)`);
  assert.ok(victim.moving, 'running');
  for (const [p, was] of others) if (p.living) assert.ok(!p.moving || Math.hypot(p.pos[0] - was[0], p.pos[2] - was[2]) < 3, 'beyond its reach, about their own day');
  // however long it stays, they keep clear of it: never their day back to it
  let nearest = Infinity;
  for (let i = 0; i < 30 * 15; i++) {
    frame(t);
    const d = Math.hypot(victim.pos[0] - at[0], victim.pos[2] - at[1]);
    if (i > 30 * 3) nearest = Math.min(nearest, d);
  }
  assert.ok(nearest >= PANIC_M - 1e-6, `kept clear while it stood (${nearest.toFixed(2)} m)`);
  // gone: they stand FLEE_HOLD_S, then their day takes them on
  dangers.list = [];
  const held = [...victim.pos];
  for (let i = 0; i < 30 * (FLEE_HOLD_S - 0.5); i++) frame(t);
  assert.ok(Math.hypot(victim.pos[0] - held[0], victim.pos[2] - held[2]) < 1e-6 && !victim.moving, 'standing clear');
  for (let i = 0; i < 30 * 2; i++) frame(t);
  assert.ok(Math.hypot(victim.pos[0] - held[0], victim.pos[2] - held[2]) > 0.5, 'their day again');
  // one walking their day when it comes: the walk's minutes owed while they run (taken up from where they ran to)
  const seats2 = t.town.update(0, t.at, 0, t.at, true, () => false);
  const walker = seats2.find((s) => t.town.where(s.person.living.res, t.clock.t, false)?.moving && !t.town._lag.get(s.person.living.id))?.person;
  assert.ok(walker, 'one walking');
  dangers.list = [[walker.pos[0] + 3, walker.pos[2]]];
  for (let i = 0; i < 30; i++) frame(t);
  assert.ok((t.town._lag.get(walker.living.id) ?? 0) > RATE * 0.9, 'their walk\'s minutes owed');
});

test('WATCH-PROTECTS cornered: one whose straight way from a monster is a wall turns along it, every stride on the street - never through the wall (mutants: the street)', () => {
  const dangers = { list: [] };
  const t = makeTown(100 * DAY_MIN + 13 * 60, dangers);
  const { p: victim, reach, dir } = standingAbout(t)[0];
  assert.ok(reach < 2, `one standing by a wall (${reach.toFixed(2)} m)`);
  const at = [victim.pos[0] - Math.sin(dir) * 3, victim.pos[2] - Math.cos(dir) * 3];   // three metres off, the wall at their back
  dangers.list = [at];
  const start = [victim.pos[0], victim.pos[2]];
  for (let i = 0; i < 60; i++) {
    frame(t);
    assert.ok(t.street.holds(victim.pos[0], victim.pos[2]), 'every stride on the street');
  }
  const dx = victim.pos[0] - start[0], dz = victim.pos[2] - start[1];
  assert.ok(dx * Math.sin(dir) + dz * Math.cos(dir) < reach, 'never through the wall');
  assert.ok(victim.moving && Math.abs(dx * Math.cos(dir) - dz * Math.sin(dir)) > FLEE_SPEED, 'along it, running');
  assert.ok(Math.hypot(victim.pos[0] - at[0], victim.pos[2] - at[1]) > 3 + 1, 'farther from it');
});

test('WATCH-PROTECTS chased: one a monster keeps at the heels of runs no farther than FLEE_FAR_M from where they took fright (inside SNAP_M: their day takes them up again on foot), then cowers where they stand though it stands within PANIC_M - a frame the clock stands still (a talk window open) leaves them cowering, never their day\'s walk back toward it (mutants: the far, the still frame)', () => {
  const dangers = { list: [] };
  const t = makeTown(100 * DAY_MIN + 13 * 60, dangers);
  const victim = standingAbout(t).at(-1).p;   // the one with the most room about them
  let at = [victim.pos[0] + 4, victim.pos[2]];
  dangers.list = [at];
  const start = [victim.pos[0], victim.pos[2]];
  let farthest = 0;
  for (let i = 0; i < 30 * 15; i++) {
    frame(t);
    const dx = victim.pos[0] - at[0], dz = victim.pos[2] - at[1], d = Math.hypot(dx, dz);
    at = [victim.pos[0] - dx / d * 5, victim.pos[2] - dz / d * 5];   // five metres behind them
    dangers.list = [at];
    farthest = Math.max(farthest, Math.hypot(victim.pos[0] - start[0], victim.pos[2] - start[1]));
  }
  assert.ok(farthest > FLEE_FAR_M - 1 && farthest <= FLEE_FAR_M + FLEE_SPEED / 30 + 1e-9, `as far as FLEE_FAR_M, no farther (${farthest.toFixed(2)} m)`);
  const cowering = [...victim.pos];
  for (let i = 0; i < 30; i++) frame(t);
  assert.ok(!victim.moving && Math.hypot(victim.pos[0] - cowering[0], victim.pos[2] - cowering[2]) < 1e-6, 'cowering where they stand');
  assert.ok(Math.hypot(victim.pos[0] - at[0], victim.pos[2] - at[1]) < PANIC_M, 'though it stands within PANIC_M');
  t.town.update(0, t.at, 0, t.at, true, () => false);
  assert.ok(!victim.moving && Math.hypot(victim.pos[0] - cowering[0], victim.pos[2] - cowering[2]) < 1e-6, 'the clock still, still cowering');
});

/** One walking far from the square (the player's), in no circle - nobody the player has passed. */
const farWalker = (t) => t.town.update(0, t.at, 0, t.at, true, () => false).map((s) => s.person)
  .find((p) => p.moving && Math.hypot(p.pos[0] - t.at[0], p.pos[2] - t.at[2]) > 30 && !t.town._inCircle.has(p.living.res.id));

test('WATCH-PROTECTS the frightened say nothing: a circle with any of it frightened is silent - a pair one of whom took fright and the other did not (its twin town, no monster, talks on) - and a greeting goes with the fright: none said while it lasts (said unseen, it would rest them GREET_REST_MIN past it), one said before it gone from over their head (mutants: the circle, the greeting, the speaker)', () => {
  const twin = makeTown(100 * DAY_MIN + 13 * 60, { list: [] });
  const dangers = { list: [] };
  const t = makeTown(100 * DAY_MIN + 13 * 60, dangers);
  for (let i = 0; i < 60; i++) { frame(twin); frame(t); }
  const rowOf = (town, id) => town.town.pool.find((r) => r.res?.id === id);
  const pair = [...t.town._inCircle.values()].map((x) => x.circle)
    .find((c) => c.members.length === 2 && c.members.every((m) => rowOf(t, m.id)?.visible && !rowOf(t, m.id).person.moving));
  assert.ok(pair, 'a pair standing together');
  const [one, other] = pair.members.map((m) => rowOf(t, m.id).person);
  const gap = Math.hypot(one.pos[0] - other.pos[0], one.pos[2] - other.pos[2]);
  // a monster just inside PANIC_M of the one, beyond it of the other: the one runs a step toward the other and stands
  const ux = (one.pos[0] - other.pos[0]) / gap, uz = (one.pos[2] - other.pos[2]) / gap;
  dangers.list = [[one.pos[0] + ux * (PANIC_M - 0.5), one.pos[2] + uz * (PANIC_M - 0.5)]];
  const eye = [one.pos[0], 0, one.pos[2]], ids = new Set(pair.members.map((m) => m.id));
  let talked = 0, silent = 0, frightened = 0;
  for (let i = 0; i < 30 * 60; i++) {
    frame(twin); frame(t);
    for (const l of twin.town.speech(eye)) if (ids.has(l.person.living?.res?.id)) talked++;
    for (const l of t.town.speech(eye)) if (ids.has(l.person.living?.res?.id)) silent++;
    if (rowOf(t, pair.members[0].id)?.flee && !rowOf(t, pair.members[1].id)?.flee) frightened++;
  }
  assert.ok(frightened > 30 * 20, `the one frightened, the other not (${frightened} frames)`);
  assert.ok(talked > 0, 'the twin pair talks');
  assert.equal(silent, 0, 'the pair silent');
  // a friend walking: frightened with the player at their side, then gone - they greet the player when it is over
  const near = { list: [] };
  const town = makeTown(100 * DAY_MIN + 13 * 60, near);
  for (let i = 0; i < 60; i++) frame(town);
  const friend = farWalker(town);
  town.relations.note(friend.living.res.id, 'saved', town.town.dayOf(town.clock.t), FRIEND_AT + 20);
  const greeting = () => town.town.speech(friend.pos).filter((l) => l.person === friend);
  near.list = [[friend.pos[0] + 3, friend.pos[2]]];
  for (let i = 0; i < 30; i++) { frame(town, 1 / 30, [...friend.pos]); assert.equal(greeting().length, 0, 'no word while frightened'); }
  near.list = [];
  for (let i = 0; i < 30 * (FLEE_HOLD_S + 1); i++) frame(town);
  for (let i = 0; i < 5 && !greeting().length; i++) frame(town, 1 / 30, [...friend.pos]);
  assert.equal(greeting().length, 1, 'the friend\'s word when it is over');
  // their word over their head, and a monster: it goes with the fright
  near.list = [[friend.pos[0] + 3, friend.pos[2]]];
  frame(town);
  assert.equal(greeting().length, 0, 'the word gone with the fright');
});

test('WATCH-PROTECTS the run\'s body: one running from a monster stops for nobody - the politeness gate is a walk\'s: the run drawn on the walk wheel, never the idle record that faces the player - at the run\'s cadence (pace: FLEE_SPEED to the walk\'s, the walker\'s frames as many times faster), the walk\'s again after (mutants: the gate, the cadence, the walk\'s again, the walker\'s pace)', () => {
  const dangers = { list: [] };
  const t = makeTown(100 * DAY_MIN + 13 * 60, dangers);
  for (let i = 0; i < 60; i++) frame(t);
  const runner = farWalker(t);
  const at = [runner.pos[0] + 3, runner.pos[2]];
  dangers.list = [at];
  for (let i = 0; i < 30; i++) {
    const seat = frame(t, 1 / 30, [...runner.pos], () => true).find((s) => s.person === runner);
    assert.ok(seat.out.record !== PERSON_IDLE_RECORD && MOVE_RECORDS.includes(seat.out.record), 'the walk wheel, though the player stands before them');
  }
  assert.ok(runner.moving && Math.hypot(runner.pos[0] - at[0], runner.pos[2] - at[1]) > 3 + FLEE_SPEED * 0.6, 'running');
  assert.equal(runner.pace, FLEE_SPEED / PERSON_MOVE_SPEED, 'the run\'s cadence');
  dangers.list = [];
  for (let i = 0; i < 30 * (FLEE_HOLD_S + 1); i++) frame(t);
  assert.ok(runner.moving && runner.pace === 1, 'walking their day, at the walk\'s');
  // the walker's frames: the walk's four a second, the run's twice that
  const w = new ResidentWalker(t.nav, { archive: 0, frameCount: () => 4, groundY: () => 0 });
  w.moving = true;
  w.update(1e-3, [0, 0, 10]);
  const f0 = w.frame;
  w.update(1, [0, 0, 10]);
  const walked = w.frame - f0;
  w.pace = 2;
  w.update(1, [0, 0, 10]);
  assert.equal(walked, 4);
  assert.equal(w.frame - f0 - walked, 8);
});

test('WATCH-PROTECTS a townsperson struck down: the host\'s word is the town\'s killed (another hand - nobody\'s regard of the player moves), and they leave the street at once (mutants: the death, the street)', () => {
  const t = makeTown(100 * DAY_MIN + 13 * 60, { list: [] });
  for (let i = 0; i < 60; i++) frame(t);
  const victim = t.town.update(0, t.at, 0, t.at, true, () => false)[0].person;
  const id = victim.living.id;
  const q = makeQuarry(victim, (body) => body.living.town.killed(body.person));
  q.hurtFromFoe(1, null, null);
  assert.deepEqual(t.killed.map((k) => k[0]), [id], 'killed by another hand');
  for (let i = 0; i < 10; i++) frame(t);
  assert.ok(!t.town.pool.some((r) => r.res?.id === id), 'off the street');
});

test('WATCH-PROTECTS the hosts: the world host hands the monsters the street\'s people of the living world (none of the watch, the dead let go) beside its foes and watchmen, and the street the monsters to run from (its own foes alive and hostile, no ally or companion, in the town\'s frame); classic play, and the fixed-city page, none (mutants: the host\'s quarry, its dangers)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /candidates: \(\) => \[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes, \.\.\.livingQuarry\(\)\]/);
  assert.match(w, /const livingQuarry = \(\) => \{\n\s+if \(!livingWorldOn\(\) \|\| _mode\(\) !== 'exterior'\) return \[\];/);
  assert.match(w, /if \(!living\?\.town \|\| p\.guard\) continue;/);
  assert.match(w, /q = makeQuarry\(p, \(body\) => body\.living\.town\.killed\(body\.person\)\)/);
  assert.match(w, /dangers: \(\) => livingDangers\(px, py, locOrigin\),/);
  assert.match(w, /if \(f\.dead \|\| !f\.ai\?\.isHostile \|\| f\.companion != null \|\| f\.entity\?\.team === 'PlayerAlly'\) continue;/);
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /livingQuarry|makeQuarry/, 'the fixed-city page: DFU\'s');
});
