// WERE-FRIGHT (2026-09-29, Mac: "Can you make it where being a werewolf has a different interaction with guards?
// Where you cannot surrender, but instead a chance to frighten?" - and, asked: frightened, the guards "flee, crime
// dropped"; the chance "your level vs theirs"; "werewolves and wereboars").
//
// The port's own law - neither classic nor DFU has it. A transformed lycanthrope with a crime on record (one it
// carried into the change, or the passive levy on a hated name, WERE-LEVY) used to be asked "Halt! You are under
// arrest. Do you surrender?" like anyone, and a fatal blow forced the surrender. Now the halt is a beast's: F roars at
// the watch, N fights on. The roar rolls 50%, five points a level either way against the striking guard's level,
// held to 10-90; frightened, the crime is forgotten and every watchman runs from the beast and is gone. Driven through
// the real arrest flow, the real watch pool and the real enemy motor on a real collider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArrestFlow, BEAST_HALT_LINES, BEAST_FRIGHTENED_TEXT, BEAST_STOOD_TEXT } from '../../src/scenes/arrestFlow.js';
import { CRIMES } from '../../src/systems/court.js';
import {
  frightenChance, frightenRoar, FRIGHTEN_BASE_CHANCE, FRIGHTEN_CHANCE_PER_LEVEL, FRIGHTEN_MIN_CHANCE, FRIGHTEN_MAX_CHANCE,
} from '../../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { ATTRACT_RADIUS } from '../../src/characters/enemy/enemySounds.js';
import { EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { Collider } from '../../src/player/collider.js';
import { CLASSIC_TO_UNITY_RATIO } from '../../src/player/motor.js';
import { createCityGuards, GUARD_MOBILE_TYPE, FRIGHTENED_RUN_SECONDS } from '../../src/scenes/cityGuards.js';

const src = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
/** The curse entry as systems/lycanthropy.js mints it, reduced to what the beast-form reads look at. */
const curse = (infectionType = LYCANTHROPY_TYPES.Werewolf, isTransformed = true) => ({ kind: 'racialOverride', racial: 'lycanthropy', infectionType, isTransformed });
/** Wanted for Murder in region 17, level 10, the halt not yet shown - a werewolf in beast form unless told otherwise. */
const mkWanted = (over = {}) => ({
  name: 'Mack', level: 10, health: 30, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Murder, legalRep: {}, items: [], skills: 30,
  haveShownSurrenderDialogue: false, arrested: false, activeEffects: [curse()], ...over,
});
function mkTalk() {
  const slot = { win: null };
  return { slot, texts: () => null, showOverlay(win) { if (slot.win && slot.win !== win) slot.win.dispose?.(); slot.win = win; } };
}
/** The real flow, its three WERE-FRIGHT doors recorded. `roll` is the flow's dice (0-1). */
function mkFlow(player, { roll = 0.99 } = {}) {
  const talk = mkTalk();
  const said = []; const heard = []; let fled = 0;
  const flow = createArrestFlow({
    townTalk: talk, playerEntity: player, regionIndex: 17, rolls: () => roll,
    advanceDays: () => {}, advanceMinutes: () => {}, guildRankOf: () => null,
    clearEnemies: () => {}, positionPlayerAtLocationEntrance: () => {},
    say: (l) => said.push(l), playSound: (c) => heard.push(c), watchFlees: () => { fled++; return 3; },
  });
  return { flow, talk, said, heard, fled: () => fled };
}
const optionCodes = (win) => win.options.map((o) => o.code);

test('WERE-FRIGHT: the chance is the beast\'s level against the guard\'s - 50, five a level either way, held to 10-90', () => {
  assert.equal(FRIGHTEN_BASE_CHANCE, 50);
  assert.equal(FRIGHTEN_CHANCE_PER_LEVEL, 5);
  assert.equal(frightenChance(10, 10), 50, 'an even match is a coin flip');
  assert.equal(frightenChance(12, 10), 60);
  assert.equal(frightenChance(10, 13), 35);
  assert.equal(frightenChance(30, 1), FRIGHTEN_MAX_CHANCE, 'never certain');
  assert.equal(frightenChance(1, 30), FRIGHTEN_MIN_CHANCE, 'never hopeless');
  assert.deepEqual([FRIGHTEN_MIN_CHANCE, FRIGHTEN_MAX_CHANCE], [10, 90]);
  assert.equal(frightenChance(7), 50, 'a guard of unknown level is taken at the beast\'s own');
  assert.equal(frightenChance(7, null), 50);
  // what that means in the street: the watch is minted three to six levels above the player (DFU's Range(3, 7) on
  // Knight_CityWatch, characters/enemy/enemyEntity.js), so a roar at the watch runs 35% at best and 20% at worst
  const career = { name: 'Guard', strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, hitPointsPerLevel: 8, attackModifierFlags: 0 };
  const watchman = (roll) => makeEnemyEntity(GUARD_MOBILE_TYPE, ENEMY_BASICS[GUARD_MOBILE_TYPE], career, 10, () => roll);
  assert.deepEqual([watchman(0), watchman(0.999999)].map((g) => frightenChance(10, g.level)), [35, 20]);
});

test('WERE-FRIGHT: the roar is the strain\'s own bark - a werewolf\'s, a wereboar\'s, and nobody\'s out of beast form', () => {
  assert.equal(frightenRoar({ activeEffects: [curse(LYCANTHROPY_TYPES.Werewolf)] }), SOUND.EnemyWerewolfBark);
  assert.equal(frightenRoar({ activeEffects: [curse(LYCANTHROPY_TYPES.Wereboar)] }), SOUND.EnemyWereboarBark);
  assert.equal(frightenRoar({ activeEffects: [curse(LYCANTHROPY_TYPES.Werewolf, false)] }), null, 'a lycanthrope in human form');
  assert.equal(frightenRoar({ activeEffects: [] }), null);
});

test('WERE-FRIGHT: THE CHANGE - a beast halted by the watch is never asked to surrender; a man still is', () => {
  // the man: DFU's own box, TEXT.RSC 15 and Y/N, unchanged
  const man = mkFlow(mkWanted({ activeEffects: [curse(LYCANTHROPY_TYPES.Werewolf, false)] }));
  assert.equal(man.flow.onGuardHit(6, () => {}), true);
  assert.deepEqual(optionCodes(man.talk.slot.win), ['KeyY', 'KeyN']);
  assert.deepEqual(man.talk.slot.win.lines, ['Halt! You are under arrest. Do you surrender?']);
  man.flow.dispose();
  // the beast, werewolf and wereboar alike: the same halt, the same one moment, the same reputation lost - no Y
  for (const type of [LYCANTHROPY_TYPES.Werewolf, LYCANTHROPY_TYPES.Wereboar]) {
    const player = mkWanted({ activeEffects: [curse(type)] });
    const beast = mkFlow(player);
    let landed = 0;
    assert.equal(beast.flow.onGuardHit(6, () => { landed++; }, { guardLevel: 10 }), true, 'the blow is withheld while the box stands');
    assert.equal(landed, 0);
    const box = beast.talk.slot.win;
    assert.deepEqual(optionCodes(box), ['KeyF', 'KeyN'], 'frighten or fight - no surrender');
    assert.deepEqual(box.options.map((o) => o.label), ['F - frighten', 'N - fight on']);
    assert.deepEqual(box.lines, [...BEAST_HALT_LINES]);
    assert.equal(player.haveShownSurrenderDialogue, true, 'once a watch, as the surrender is');
    assert.ok((player.legalRep[17] ?? 0) < 0, 'the halt costs the crime\'s reputation as it always did');
    box.input('KeyY');
    assert.equal(player.arrested, false, 'Y is no answer a beast has');
    assert.equal(landed, 0);
    beast.flow.dispose();
  }
});

test('WERE-FRIGHT: the roar that works - the crime forgotten, the watch sent running, the blow never lands', () => {
  const player = mkWanted();
  const f = mkFlow(player, { roll: 0.3 });   // 30 < 50
  let landed = 0;
  f.flow.onGuardHit(6, () => { landed++; }, { guardLevel: 10 });
  f.talk.slot.win.input('KeyF');
  assert.deepEqual(f.heard, [SOUND.EnemyWerewolfBark], 'the roar is heard');
  assert.equal(player.crimeCommitted, 0, 'the crime is forgotten');
  assert.equal(f.fled(), 1, 'the host sends its watch running');
  assert.deepEqual(f.said, [BEAST_FRIGHTENED_TEXT]);
  assert.equal(landed, 0, 'the withheld blow never lands');
  assert.equal(player.arrested, false);
  assert.equal(f.flow.inCourt(), false, 'the question is answered - nothing withheld from here');
  f.flow.dispose();
});

test('WERE-FRIGHT: the roar that fails - the watch stands its ground, the blow lands, the crime stands', () => {
  const player = mkWanted();
  const f = mkFlow(player, { roll: 0.7 });   // 70 >= 50
  let landed = 0;
  f.flow.onGuardHit(6, () => { landed++; }, { guardLevel: 10 });
  f.talk.slot.win.input('KeyF');
  assert.deepEqual(f.heard, [SOUND.EnemyWerewolfBark], 'roared all the same');
  assert.equal(landed, 1, 'the blow the question withheld lands, as N lands it');
  assert.equal(player.crimeCommitted, CRIMES.Murder);
  assert.equal(f.fled(), 0);
  assert.deepEqual(f.said, [BEAST_STOOD_TEXT]);
  // N is plain fighting on
  const n = mkFlow(mkWanted(), { roll: 0 });
  let nLanded = 0;
  n.flow.onGuardHit(6, () => { nLanded++; }, { guardLevel: 10 });
  n.talk.slot.win.input('KeyN');
  assert.equal(nLanded, 1);
  assert.deepEqual([n.heard, n.said, n.fled()], [[], [], 0], 'no roar, no line, no flight');
  assert.deepEqual([f.flow.inCourt(), n.flow.inCourt()], [false, false], 'either answer ends the question - the beast can be hurt again');
  f.flow.dispose(); n.flow.dispose();
});

test('WERE-FRIGHT: the striking guard\'s level is what is rolled against', () => {
  // the same dice (0.62), the same beast (level 10): an even guard stands (62 >= 50), one three levels under flees
  // (62 < 65), and one never named is taken at the beast's level
  const outcome = (guardLevel) => {
    const player = mkWanted();
    const f = mkFlow(player, { roll: 0.62 });
    f.flow.onGuardHit(6, () => {}, guardLevel === undefined ? undefined : { guardLevel });
    f.talk.slot.win.input('KeyF');
    f.flow.dispose();
    return player.crimeCommitted === 0;
  };
  assert.equal(outcome(10), false);
  assert.equal(outcome(7), true);
  assert.equal(outcome(undefined), false);
});

test('WERE-FRIGHT: a beast cannot surrender - the fatal blow that forces a man into court lands on the beast', () => {
  // legal reputation above 0: SurrenderToCityGuards accepts a forced surrender - the man is carried into court
  const man = mkWanted({ health: 5, legalRep: { 17: 5 }, haveShownSurrenderDialogue: true, activeEffects: [] });
  const m = mkFlow(man);
  assert.equal(m.flow.onGuardHit(6, () => {}), true, 'the fatal blow is the court\'s');
  assert.equal(man.arrested, true);
  m.flow.abandon(); m.flow.dispose();
  const beast = mkWanted({ health: 5, legalRep: { 17: 5 }, haveShownSurrenderDialogue: true });
  const b = mkFlow(beast);
  assert.equal(b.flow.onGuardHit(6, () => {}), false, 'the blow is not withheld - it lands');
  assert.equal(beast.arrested, false);
  assert.equal(beast.health, 5, 'and no surrender set it to 1 on the way');
  b.flow.dispose();
});

test('WERE-FRIGHT: a man asked to surrender who is a beast before he answers does not walk into court', () => {
  const player = mkWanted({ activeEffects: [curse(LYCANTHROPY_TYPES.Werewolf, false)], legalRep: { 17: 5 } });
  const f = mkFlow(player);
  let landed = 0;
  f.flow.onGuardHit(6, () => { landed++; });
  const box = f.talk.slot.win;
  assert.deepEqual(optionCodes(box), ['KeyY', 'KeyN'], 'asked as a man');
  player.activeEffects[0].isTransformed = true;   // the moon's round, online, under the box
  box.input('KeyY');
  assert.equal(player.arrested, false, 'no beast is tried');
  assert.equal(landed, 1, 'it fights, as a beast must');
  f.flow.dispose();
});

test('WERE-FRIGHT: the beast\'s halt is withdrawn as the man\'s is - F or N on a withdrawn box, or on a crime gone, roars at no one and lands nothing', () => {
  for (const answer of ['KeyF', 'KeyN']) {
    // a load under the box withdraws it (AUDIT DISC28 AR-1) - and a key that reaches it before it drains answers nothing
    const player = mkWanted();
    const f = mkFlow(player, { roll: 0 });   // a roar would work
    let landed = 0;
    f.flow.onGuardHit(6, () => { landed++; }, { guardLevel: 10 });
    const box = f.talk.slot.win;
    f.flow.abandon();
    assert.equal(box.done, true);
    assert.equal(f.flow.inCourt(), false, `${answer}: the withdrawn halt shields no one`);
    box.input(answer);
    assert.deepEqual([landed, f.heard.length, f.fled(), player.crimeCommitted], [0, 0, 0, CRIMES.Murder], `${answer}: nothing answered`);
    f.flow.dispose();
    // the crime gone under a box nobody withdrew (AR-3): the answer re-reads it
    const cleared = mkWanted();
    const g = mkFlow(cleared, { roll: 0 });
    let hit = 0;
    g.flow.onGuardHit(6, () => { hit++; }, { guardLevel: 10 });
    cleared.crimeCommitted = CRIMES.None;
    g.talk.slot.win.input(answer);
    assert.deepEqual([hit, g.heard.length, g.fled()], [0, 0, 0], `${answer}: no roar and no blow for a crime that is gone`);
    assert.equal(g.flow.inCourt(), false, `${answer}: the answer closed the question`);
    g.flow.dispose();
  }
});

// ── the watch runs ─────────────────────────────────────────────────────────────────────────────────────────────────
const quad = new Uint32Array([0, 1, 2, 0, 2, 3]);
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** An open square of floor, 160 across, and an optional wall across x at z = `wall`. */
function field({ wall = null } = {}) {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), quad, I4);
  if (wall != null) c.addMesh('wall', new Float32Array([-80, 0, wall, 80, 0, wall, 80, 4, wall, -80, 4, wall]), quad, I4);
  return c;
}
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const SENSES = { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 };

test('WERE-FRIGHT: a frightened foe runs - away from the beast, turning its back, through the collider, striking no one', () => {
  const c = field();
  const beast = [0, 0, 0];
  const ai = new EnemyAI(c, [0, 0, 2], Math.PI, { liveSpeed: 50 });   // two units north, facing the beast
  Object.assign(ai, { inSight: true, detected: true, justEncountered: true, canAct: true });   // it had the beast in its eye
  ai.flee(beast, 3);
  assert.equal(ai.target, null, 'it drops its target (AUDIT WERE-FRIGHT F3: and keeps its hostility - routed, not pacified)');
  assert.deepEqual([ai.inSight, ai.detected, ai.justEncountered, ai.canAct], [false, false, false, false],
    'it senses nothing from the fright on - no alert to raise, no first meeting for a tongue to answer');
  const d0 = flat(ai.feet, beast);
  for (let i = 0; i < 6; i++) ai.update(1 / 60, beast, SENSES, false);
  assert.equal(flat(ai.feet, beast), d0, 'it turns before it runs - in place, never a step towards the beast');
  for (let i = 0; i < 84; i++) ai.update(1 / 60, beast, SENSES, false);
  assert.ok(flat(ai.feet, beast) > d0 + 4, `a second and a half on, it is well away (${flat(ai.feet, beast).toFixed(2)})`);
  assert.ok(ai.feet[2] > 2, 'north, the way away from the beast');
  assert.ok(Math.cos(ai.yaw) > 0.9, `its back to the beast (yaw ${ai.yaw.toFixed(2)})`);
  assert.equal(ai.canAct, false, 'it decides nothing while it runs');
  assert.ok(Math.abs(ai.feet[1]) < 1e-3, 'on the floor, gravity and all');
  for (let i = 0; i < 120; i++) ai.update(1 / 60, beast, SENSES, false);   // 3.5 s all told, past the 3 s run
  assert.ok(!(ai.fleeLeft > 0), 'the run is spent after its seconds');
  // a wall across its way: it veers along it rather than pressing into it
  const w = new EnemyAI(field({ wall: 3 }), [0, 0, 2], 0, { liveSpeed: 50 });
  w.flee([0, 0, 0], 3);
  for (let i = 0; i < 120; i++) w.update(1 / 60, [0, 0, 0], SENSES, false);
  assert.ok(w.feet[2] < 3, 'never through the wall');
  assert.ok(Math.abs(w.feet[0]) > 1, `it ran off along the wall (${w.feet[0].toFixed(2)})`);
  // a blow as it runs shoves it as it shoves any foe (KnockbackMovement), the hurt anim with it - and it runs on
  const k = new EnemyAI(c, [0, 0, 2], 0, { liveSpeed: 50 });   // two units north, its back already to the beast
  k.flee(beast, 3);
  k.knockbackSpeed = 20 / (CLASSIC_TO_UNITY_RATIO / 10);   // a blow of 20, classic units
  k.knockbackDir = [1, 0, 0];
  k.update(1 / 60, beast, SENSES, false);
  assert.equal(k.hurtKnock, true, 'the hurt anim plays');
  assert.ok(k.feet[0] > 0 && Math.abs(k.feet[2] - 2) < 1e-6, `shoved east along the blow, not a step of the run (${k.feet.map((v) => v.toFixed(3))})`);
  for (let i = 0; i < 60; i++) k.update(1 / 60, beast, SENSES, false);
  assert.equal(k.knockbackSpeed, 0, 'the shove is spent');
  assert.ok(k.feet[2] > 3 && k.fleeLeft > 0, `and it runs on (${k.feet[2].toFixed(2)})`);
  // the floating origin carries the point it runs from, as it carries every point the motor holds
  const o = new EnemyAI(c, [0, 0, 2], 0, { liveSpeed: 50 });
  o.flee([1, 0, 1], 3);
  o.offsetOrigin([10, 0, -5]);
  assert.deepEqual(o.fleeFrom, [11, 0, -4]);
});

const stubTex = { getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) };
/** The real watch pool on `c`, its doors counted: blows on the player, batches freed, watchmen sent for (a fetch is
 *  counted and never answered, so none is minted). */
function watchPool(c, player) {
  const seen = { hurt: 0, freed: 0, asked: 0 };
  const pool = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => { seen.freed++; }, textures: new Map() },
    collider: c, fetchBytes: () => { seen.asked++; return new Promise(() => {}); }, getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 0,
    playerEntity: player, audio: null, onPlayerHurt: () => { seen.hurt++; }, rand: () => 0.9,
  });
  return { pool, seen };
}
/** A townsperson twenty units north, facing the beast: sees the crime, is no guard - the watch is sent for, and
 *  comes in Random.Range(5, 11) seconds (10 at the pool's 0.9). */
const witness = () => ({ pos: [0, 0, 20], fwdYaw: Math.PI, guard: false, disable() {} });

test('WERE-FRIGHT: the watch frightened off runs, swings at nothing, and is gone when the run ends - no body, no save, no halt left standing, none sent for', async () => {
  const c = field();
  const player = mkWanted({ crimeCommitted: 0 });   // the fright forgot the crime; the beast keeps the watch (GUARD1's fourth clause) until it runs
  const beastAt = [0, 0, 0];
  const eleven = 11 * 30;   // frames: past the run and past the witness's watch
  // the control: unfrightened, the watch a witness sent for comes to the beast
  const ctl = watchPool(c, player);
  await ctl.pool.spawnCityGuards(false, { playerFeet: beastAt, playerFwd: [0, 0, 1], pool: [witness()] });
  for (let i = 0; i < eleven; i++) ctl.pool.update(1 / 30, beastAt, [0, 1.7, 0], SENSES);
  assert.ok(ctl.seen.asked > 0, 'the witness\'s watch comes when nobody frightens it off');
  const { pool, seen } = watchPool(c, player);
  const watchman = (id, feet, { defender = false } = {}) => ({
    id, dead: false, defender, batch: {}, mobileType: GUARD_MOBILE_TYPE, _swingSeq: 0, _mout: null, archive: 399, tex: stubTex,
    entity: { health: 40, maxHealth: 40, level: 10, activeEffects: [], items: [], stats: { speed: 50 } },
    mobile: { update: () => ({ record: 0, frame: 0, flip: false }), doMeleeDamage: true },   // a damage frame due: a fleer must not land it
    ai: new EnemyAI(c, feet, Math.PI, { liveSpeed: 50 }),
    attack: { machine: { state: 'Idle' }, swingSeq: 0, ticks: 0, update() { this.ticks++; } },   // the pool ticks it only at a target
    sounds: { ticks: 0, near: 0, tick(dt, dist) { this.ticks++; if (dist < ATTRACT_RADIUS) this.near++; return null; } },   // the attract bark's clock - the watch's "Halt!"
    concealment: () => 0,
  });
  pool.guards.push(watchman(1, [0, 0, 1.5]), watchman(2, [1.5, 0, 0]), watchman(3, [0, 0, -30], { defender: true }));
  await pool.spawnCityGuards(false, { playerFeet: beastAt, playerFwd: [0, 0, 1], pool: [witness()] });
  const [fleers, defender] = [pool.guards.slice(0, 2), pool.guards[2]];
  assert.equal(pool.anyWatchStanding(), true, 'the watch is up');
  assert.equal(pool.frighten(beastAt), 2, 'the crime\'s two ran; the defender holds his post');
  assert.equal(pool.anyWatchStanding(), false, 'a man running is not the watch standing - the next watch is halted afresh');
  pool.handleAttackFromPlayer(fleers[0], beastAt);
  assert.equal(pool.anyWatchStanding(), false, 'nor is a man the beast strikes as he runs');
  assert.deepEqual(pool.snapshotWorld((p) => ({ x: p[0], z: p[2] })), [], 'nor is he saved: a load does not set him on the beast again');
  const start = fleers.map((g) => flat(g.ai.feet, beastAt));
  for (let i = 0; i < 45; i++) pool.update(1 / 30, beastAt, [0, 1.7, 0], SENSES);   // a second and a half: the turn, then the run
  const mid = fleers.map((g) => flat(g.ai.feet, beastAt));
  assert.ok(mid.every((d, k) => d > start[k] + 2), `both are running from the beast, the struck one too (${mid.map((d) => d.toFixed(1))})`);
  assert.deepEqual([seen.hurt, ...fleers.map((g) => g.attack.ticks)], [0, 0, 0], 'no swing, and no blow on the beast they fled');
  assert.ok(defender.attack.ticks > 0, 'the pool does tick a watchman\'s attack at his target - the fleers\' zero is theirs');
  assert.ok(fleers.every((g) => g.sounds.ticks > 0), 'the attract cadence still steps for every watchman');
  assert.deepEqual(fleers.map((g) => g.sounds.near), [0, 0], 'but no one stands in a fleeing man\'s radius - he calls no "Halt!" at the beast a few strides off');
  for (let i = 0; i < eleven; i++) pool.update(1 / 30, beastAt, [0, 1.7, 0], SENSES);
  assert.deepEqual(pool.guards.map((g) => g.id), [3], 'the two are gone - walked away, no corpse left - and the defender stands');
  assert.equal(seen.freed, 2);
  assert.equal(seen.asked, 0, 'the watch the witness sent for is called off with the rest');
  assert.equal(pool.frighten(beastAt), 0, 'no crime\'s watch left to frighten');
});

test('WERE-FRIGHT: every door is wired - the striker\'s level rides from the pool to the flow, and each host sends all its watch running', () => {
  assert.match(src('src/scenes/cityGuards.js'), /onPlayerHurt\?\.\(dmg, wpn, \{ guardLevel: g\.entity\.level \}\)/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    assert.match(s, /onPlayerHurt: \(dmg, wpn, hit\) => \{/, `${host}: the pool's third argument is taken`);
    assert.match(s, /if \(!arrestFlow\.onGuardHit\(dmg, apply, hit\)\) apply\(\);/, `${host}: and handed to the flow`);
    assert.match(s, /onGuardHit: \(dmg, apply, hit\) => arrestFlow\.onGuardHit\(dmg, apply, hit\),/, `${host}: the building's watch rides the same seam`);
    assert.match(s, /say: \(l\) => townTalk\.say\(l\),\n    playSound: \(clip\) => audio\.playOneShot\(clip, 1\),\n    watchFlees: \(\) => cityGuards\.frighten\(/, `${host}: the roar's three doors`);
  }
  assert.match(src('src/scenes/world.js'), /watchFlees: \(\) => cityGuards\.frighten\(walkMode && playerSpawned \? player\.pos : cam\.pos\) \+ \(modes\?\.frightenWatch\?\.\(\) \?\? 0\),/, 'the street\'s watch and a building\'s');
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /if \(!\(host\.onGuardHit\?\.\(dmg, apply, hit\) \?\? false\)\) apply\(\);/);
  assert.match(modes, /frightenWatch: \(\) => interiorGuards\?\.frighten\(player\.pos\) \?\? 0,/);
});
