// WATCH-LEAVES (bible/01-Overview/bugs/Field-Bugs-2026-10-12e.md; the owner, 2026-10-12: "I notice sometimes guards will
// spawn randomly to attack nearby enemies in towns and then despawn" - asked, "Walk in, walk off"). The town watch's
// defenders (DISC19-F, systems/town/townWatch.js) were stood down by deleting them where they stood - the crime watch's
// despawn (EnemyEntity.cs:184-191), never this squad's - so a player watching the fight saw them vanish. They walk off
// now, and go from the world only where DFU's PopulationManager lets any walker go (popAllowChange: beyond
// allowVisiblePopRange, or behind the player). Pinned BY EXECUTION on the real pool, the real motor on a real collider:
//   the stand-down - not gone, not counted, no fight, walking away, gone only out of sight, no body;
//   set upon - he fights, still stood down, and walks on; never turned to and fro by the watch's dismissal;
//   the call back - the next summons, a raid, a crime;
//   the living world's resident - lent while he walks, back to their day once he is gone, never killed;
//   the one law - popAllowChange, read by the street's pool, the living town and the watch; the host's yaw.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCityGuards, DEFENDER_LEAVE_LEG_SECONDS } from '../../src/scenes/cityGuards.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { PLAYER_TARGET } from '../../src/characters/enemy/enemyTargets.js';
import { Collider } from '../../src/player/collider.js';
import { createTownWatch, runTownWatchFrame, TOWN_WATCH_STAND_DOWN_SECONDS } from '../../src/systems/town/townWatch.js';
import { popAllowChange, POP_VISIBLE_RANGE } from '../../src/systems/town/townPopulation.js';
import { watchStep } from '../../src/scenes/livingWorld/livingWatch.js';
import { setRaidingPartiesHost, raidFrame, restoreRaidSaveData, _resetRaidingParties, _raidRuntime, RAIDING_PARTIES_VENDOR } from '../../src/systems/raidingParties.js';
import { setModSetting } from '../../src/systems/modSettings.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

// the watch1 rig (disc19.test.js's): a synthetic CLASS18.CFG and MONSTER.BSA - on a real collider, so the motor walks
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const townsman = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, health: 100, maxHealth: 100, crimeCommitted: 0 });
const quad = new Uint32Array([0, 1, 2, 0, 2, 3]);
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** An open square of street, 600 across - room to walk past allowVisiblePopRange. */
function street() {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-300, 0, -300, 300, 0, -300, 300, 0, 300, -300, 0, 300]), quad, I4);
  return c;
}
const rig = (playerEntity, collider, over = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider, fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...over,
});
const FEET0 = [0, 0, 0], EYE0 = [0, 1.6, 0], FWD0 = [0, 0, 1];
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const npcGuard = (pos, log = []) => ({ pos, fwdYaw: 0, guard: true, disable: () => log.push(pos) });

/** A town with one defender: the street guard at [3, 0, 3] turned by the summons, sent at a centaur hunting the
 *  player. `view.yaw` is the camera's - 0 looks north (+z), at him. */
async function town({ view = { yaw: 0 }, guardsOver = {} } = {}) {
  const p = townsman();
  const c = street();
  const guards = createCityGuards(rig(p, c, { viewYaw: () => view.yaw, ...guardsOver }));
  const monsters = createExteriorFoes(rig(p, c));
  const centaur = await monsters.spawnFoe(0, [8, 0, 8], { feetGiven: true });
  centaur.ai.target = PLAYER_TARGET;
  const turned = [];
  assert.equal(await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [npcGuard([3, 0, 3], turned)], threats: [centaur] }), 1);
  return { p, c, guards, monsters, centaur, d: guards.guards[0], view, turned };
}
const frames = (guards, n, dt = 0.05, senses = {}) => { for (let i = 0; i < n; i++) guards.update(dt, FEET0, EYE0, senses); };

test('WATCH-LEAVES: stood down, a defender is not taken where he stands - he drops his fight, is no longer the town\'s answer, and walks away from the player, never gone while in view and within allowVisiblePopRange', async () => {
  const { guards, d, centaur } = await town();
  centaur.dead = true;   // the fight is won
  assert.equal(guards.defenderCount(), 1);
  assert.equal(guards.dismissDefenders(), 1, 'one stood down');
  assert.equal(guards.dismissDefenders(), 0, 'and not twice');
  assert.deepEqual([d.dead, d.leaving, d.defender], [false, true, true], 'still in the street - a defender walking off');
  assert.equal(guards.defenderCount(), 0, 'not the town\'s answer any more: the watch decides on the ones standing');
  const d0 = flat(d.ai.feet, FEET0);
  let nearest = Infinity;
  for (let i = 0; i < 400; i++) {   // twenty seconds, the player watching him the whole way
    frames(guards, 1);
    if (d.dead) break;
    nearest = Math.min(nearest, flat(d.ai.feet, FEET0));
    assert.equal(d.ai.target, null, 'he fights nobody on his way');
  }
  assert.equal(d.dead, false, 'watched, and within allowVisiblePopRange, he is never taken');
  assert.ok(nearest >= d0 - 1e-6, `never a step back towards the player (${nearest.toFixed(2)} from ${d0.toFixed(2)})`);
  const far = flat(d.ai.feet, FEET0);
  assert.ok(far > d0 + 60, `twenty seconds on he is well away (${far.toFixed(1)} m)`);
  assert.ok(far <= POP_VISIBLE_RANGE, 'and still in sight');
  assert.ok(d.ai.feet[0] > 3 && d.ai.feet[2] > 3, 'away from the player, the way he stood from them');
});

test('WATCH-LEAVES: one walking off strikes nobody - a blow his brain still held when he was stood down (TACT2\'s forced swing) never lands on the player beside him', async () => {
  const { p, guards, d, centaur } = await town();
  centaur.dead = true;
  d.ai.feet[0] = 0; d.ai.feet[2] = 1.2; d.ai.yaw = Math.PI;   // in reach, facing the player
  guards.dismissDefenders();
  d.ai._blowSwing = true;   // the brain's swing, decided before the stand-down ('engage': breakWindup keeps it)
  const seq = d.attack.swingSeq;
  frames(guards, 10);
  assert.equal(d.attack.swingSeq, seq, 'no swing begun');
  assert.equal(p.health, 100, 'and nothing landed');
});

test('WATCH-LEAVES: he goes from the world only where a walker may - past allowVisiblePopRange in view, or at once behind the player - with no body; each leg of the walk is aimed from where the player stands then', async () => {
  const watched = await town();
  watched.centaur.dead = true;
  watched.guards.dismissDefenders();
  let t = 0;
  while (!watched.d.dead && t < 60) { frames(watched.guards, 1); t += 0.05; }
  assert.equal(watched.d.dead, true, 'he walked out of sight');
  assert.ok(flat(watched.d.ai.feet, FEET0) > POP_VISIBLE_RANGE - 1, `at the range's edge (${flat(watched.d.ai.feet, FEET0).toFixed(1)} m)`);
  assert.ok(flat(watched.d.ai.feet, FEET0) < POP_VISIBLE_RANGE + 1, 'not a step further');
  assert.ok(!watched.d.corpse, 'walked away: no body, nothing to loot');
  const behind = await town({ view: { yaw: 0 } });
  behind.centaur.dead = true;
  behind.guards.dismissDefenders();
  frames(behind.guards, 1);
  assert.equal(behind.d.dead, false, 'in front of the player, the first frame');
  behind.view.yaw = Math.PI;   // the player turns away
  frames(behind.guards, 1);
  assert.equal(behind.d.dead, true, 'behind them, he goes');
  assert.ok(!behind.d.corpse);
  // a host that hands no yaw: the distance term alone, never a view it cannot read
  const blind = await town({ guardsOver: { viewYaw: () => null } });
  blind.centaur.dead = true;
  blind.guards.dismissDefenders();
  blind.d.ai.feet[0] = 0; blind.d.ai.feet[2] = -POP_VISIBLE_RANGE + 1;   // behind, but no view to say so
  frames(blind.guards, 1);
  assert.equal(blind.d.dead, false, 'no yaw: within range he stays');
  blind.d.ai.feet[2] = -POP_VISIBLE_RANGE - 1;
  frames(blind.guards, 1);
  assert.equal(blind.d.dead, true, 'and past it he goes');
  // the leg: aimed afresh from where the player stands when it ends
  const legs = await town();
  legs.centaur.dead = true;
  legs.guards.dismissDefenders();
  frames(legs.guards, 1);
  assert.ok(legs.d.ai.fleeLeft > 0 && legs.d.ai.fleeLeft <= DEFENDER_LEAVE_LEG_SECONDS, 'a leg of the walk');
  assert.deepEqual(legs.d.ai.fleeFrom, FEET0, 'away from the player\'s feet');
  for (let i = 0; i < DEFENDER_LEAVE_LEG_SECONDS * 20 + 2; i++) legs.guards.update(0.05, [0, 0, -10], EYE0, {});
  assert.deepEqual(legs.d.ai.fleeFrom, [0, 0, -10], 'the next leg from where the player stands now');
});

test('WATCH-LEAVES: a target he held at the stand-down goes with his fight - a monster passing by is no call back - but set upon on his way he stands and fights it, still stood down, and walks on once it is gone; the town watch\'s own dismissal never turns him to and fro', async () => {
  const { guards, monsters, d, centaur } = await town();
  const bystander = await monsters.spawnFoe(0, [-4, 0, 9], { feetGiven: true });
  bystander.entity.health = bystander.entity.maxHealth = 100000;   // it outlasts the frames below
  d.entity.health = d.entity.maxHealth = 100000;
  d.ai.target = bystander; d.ai.secondaryTarget = bystander;   // a monster he had his eye on, hunting no one
  centaur.dead = true;
  const armed = { candidates: () => [bystander] };   // the world host's senses (_foeSenses): the street's foes on the target machine
  guards.dismissDefenders();
  frames(guards, 10, 0.05, armed);
  assert.deepEqual([d.leaving, d.ai.target], [true, null], 'he walks off - the stand-down took his target');
  // the bystander comes for him: its blow (applyDamageToNonPlayer's MakeEnemyHostileToAttacker)
  d.ai.makeEnemyHostileToAttacker(bystander, bystander.ai.feet);
  const watch = createTownWatch({ rand: () => 0 });
  const away = { enabled: true, inTown: false, crime: false, locationKey: '3,12', inTownRect: () => true, guards, playerFeet: FEET0, playerFwd: FWD0, foes: [bystander] };
  const before = flat(d.ai.feet, bystander.ai.feet);
  const seq = d.attack.swingSeq;
  for (let i = 0; i < 200; i++) {   // ten seconds, the player out of town: the watch dismisses any standing defender every frame
    frames(guards, 1, 0.05, armed);
    assert.equal(runTownWatchFrame(watch, 0.05, away), null, 'one set upon is still stood down - nothing for the watch to dismiss again');
    assert.equal(d.leaving, true);
    assert.equal(guards.defenderCount(), 0, 'not the town\'s answer: that is the town watch\'s word');
  }
  assert.equal(d.dead, false);
  assert.equal(d.ai.fleeLeft, 0, 'he stands - his walk held');
  assert.ok(flat(d.ai.feet, bystander.ai.feet) < before, `he went to it (${before.toFixed(1)} -> ${flat(d.ai.feet, bystander.ai.feet).toFixed(1)})`);
  assert.ok(d.attack.swingSeq > seq, 'and swung at it (whether a blow lands is the to-hit roll\'s)');
  assert.equal(d.ai.target, bystander, 'at the one that set upon him');
  bystander.dead = true;   // it falls
  frames(guards, 2, 0.05, armed);
  assert.ok(d.ai.fleeLeft > 0, 'its end: he walks on');
  assert.deepEqual([d.leaving, d.ai.target], [true, null]);
});

test('WATCH-LEAVES: the next summons calls the walking squad back before any walker is turned or anyone minted - each sent at the threat nearest him', async () => {
  const { guards, monsters, d, centaur } = await town();
  centaur.dead = true;
  guards.dismissDefenders();
  frames(guards, 40);
  const ogre = await monsters.spawnFoe(0, [-10, 0, 0], { feetGiven: true });
  ogre.ai.target = PLAYER_TARGET;
  const turned = [];
  const came = await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [npcGuard([2, 0, 2], turned)], threats: [ogre] });
  assert.equal(came, 1, 'the one walking off came');
  assert.deepEqual(turned, [], 'no street guard turned');
  assert.equal(guards.guards.length, 1, 'nobody minted');
  assert.deepEqual([d.leaving, d.defender, d.ai.target], [false, true, ogre]);
  assert.equal(guards.defenderCount(), 1);
  const before = flat(d.ai.feet, ogre.ai.feet);
  frames(guards, 40);   // he turns in place first (the classic turn), then walks
  assert.ok(flat(d.ai.feet, ogre.ai.feet) < before - 4, `he walks back to the fight (${before.toFixed(1)} -> ${flat(d.ai.feet, ogre.ai.feet).toFixed(1)})`);
  // a raid's defender (RAID1 standDefender) is the one walking off too, before one is minted
  guards.dismissDefenders();
  const back = await guards.standDefender({ playerFeet: FEET0, playerFwd: FWD0, threats: [ogre], minDistance: 10, maxDistance: 35 });
  assert.equal(back, d, 'the raid gets him back');
  assert.deepEqual([d.leaving, d.ai.target, guards.guards.length], [false, ogre, 1]);
});

test('WATCH-LEAVES: a crime turns one walking off into the crime\'s watch, hunting the player - his walk over', async () => {
  const { p, guards, d, centaur } = await town();
  centaur.dead = true;
  guards.dismissDefenders();
  frames(guards, 10);
  p.crimeCommitted = 4;   // Assault
  frames(guards, 1);
  assert.deepEqual([d.defender, d.leaving, d.dead], [false, false, false], 'enlisted where he walked');
  assert.equal(d.ai.fleeLeft, 0, 'no longer walking off');
  assert.deepEqual([d.entity.team, d.ai.isHostile], ['CityWatch', true], 'the crime\'s watch');
  const before = flat(d.ai.feet, FEET0);
  frames(guards, 40);
  assert.ok(flat(d.ai.feet, FEET0) < before - 1, `and comes for the criminal (${before.toFixed(1)} -> ${flat(d.ai.feet, FEET0).toFixed(1)})`);
});

test('WATCH-LEAVES: the living world\'s resident a defender stands for is lent while he walks off, and back to their day once he is gone - never killed, never slain', async () => {
  const log = [];
  const res = { id: 'r1', guard: true };
  const liveTown = { lend: () => log.push('lend'), back: () => log.push('back'), killed: () => log.push('killed'), slain: () => log.push('slain') };
  const p = townsman();
  const c = street();
  const view = { yaw: 0 };
  const guards = createCityGuards(rig(p, c, { viewYaw: () => view.yaw }));
  const monsters = createExteriorFoes(rig(p, c));
  const centaur = await monsters.spawnFoe(0, [8, 0, 8], { feetGiven: true });
  centaur.ai.target = PLAYER_TARGET;
  await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, threats: [centaur], pool: [
    { pos: [3, 0, 3], fwdYaw: 0, guard: true, person: { living: { id: res.id, res, town: liveTown } }, live: () => true, disable() {} },
  ] });
  const turnedWatch = [];
  watchStep(turnedWatch, guards.guards);
  assert.deepEqual(log, ['lend'], 'off the street while he stands');
  centaur.dead = true;
  guards.dismissDefenders();
  for (let i = 0; i < 60; i++) { frames(guards, 1); watchStep(turnedWatch, guards.guards); }
  assert.deepEqual(log, ['lend'], 'walking off, he still stands for them');
  view.yaw = Math.PI;
  frames(guards, 1);
  watchStep(turnedWatch, guards.guards);
  assert.deepEqual(log, ['lend', 'back'], 'gone with no body: back to their day');
});

test('WATCH-LEAVES through the town watch\'s frame: the squad stands down ten quiet seconds after the fight and walks off; the next monster\'s countdown calls it back instead of a fresh squad', async () => {
  const { guards, monsters, d, centaur, turned } = await town();
  const watch = createTownWatch({ rand: () => 0 });   // Random.Range(5, 11) -> 5
  const F = { enabled: true, inTown: true, crime: false, locationKey: '3,12', inTownRect: () => true, guards, playerFeet: FEET0, playerFwd: FWD0 };
  const street = [npcGuard([4, 0, -4], turned)];
  let foes = [centaur];
  const armed = { candidates: () => foes };   // the world host's senses: the street's foes on the target machine (_foeSenses)
  centaur.dead = true;
  let act = null, t = 0;
  while (act !== 'dismiss' && t < 20) { act = runTownWatchFrame(watch, 0.25, { ...F, foes: [centaur], pool: () => street }); frames(guards, 5, 0.05, armed); t += 0.25; }
  assert.equal(act, 'dismiss');
  assert.equal(t, TOWN_WATCH_STAND_DOWN_SECONDS, 'ten quiet seconds, to the tick');
  assert.deepEqual([d.dead, d.leaving], [false, true], 'he walks off - not taken where he stood');
  for (let i = 0; i < 8; i++) assert.equal(runTownWatchFrame(watch, 0.25, { ...F, foes: [centaur], pool: () => street }), null, 'one walking off is no squad to dismiss again');
  const wolf = await monsters.spawnFoe(0, [0, 0, -12], { feetGiven: true });
  wolf.ai.target = PLAYER_TARGET;
  foes = [centaur, wolf];
  act = null; t = 0;
  while (act !== 'summon' && t < 20) { act = runTownWatchFrame(watch, 0.25, { ...F, foes: [wolf], pool: () => street }); frames(guards, 5, 0.05, armed); t += 0.25; }
  assert.equal(act, 'summon', 'the next monster brings the watch');
  await tick(); await tick();
  assert.deepEqual([d.leaving, d.ai.target], [false, wolf], 'and the watch is the man still in the street');
  assert.deepEqual(turned, [[3, 0, 3]], 'no second street guard turned');
  assert.equal(guards.guards.length, 1, 'nobody minted');
});

test('WATCH-LEAVES: a defender the raid gets back is the one it already holds - one entry, not two', async () => {
  setModSetting(RAIDING_PARTIES_VENDOR, 'Enabled', true);
  setSharedClock(null);
  _resetRaidingParties();
  try {
    const DAY = 400;
    const AT = (min) => DAY * MINUTES_PER_DAY + min;
    const watchman = { mobileType: 146, defender: true, dead: false, entity: { health: 10 }, ai: { feet: [5, 0, 5] } };
    let asked = 0;
    setRaidingPartiesHost({
      now: () => AT(610), random: () => 0, regionIndex: () => 3, regionName: (r) => `Region${r}`,
      townHere: () => ({ regionIndex: 3, locationIndex: 7 }), playerPixel: () => ({ x: 200, y: 100 }),
      standRaider: () => null,
      standDefender: () => { asked++; return Promise.resolve(watchman); },   // walked off and called back: the same man
      defenderCount: () => 0, defendersAllowed: () => true, removeFoe: () => {}, outOfSight: () => true,
      reputation: () => null, say: () => {},
    });
    restoreRaidSaveData({ lastSelectedDay: DAY, raids: [{ regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: 'Gothway Garden', type: 2,
      startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 3, cleansed: false, announced: false, struck: false, px: 200, py: 100 }] });
    for (let i = 0; i < 12 && asked < 2; i++) { raidFrame(1); await tick(); }
    assert.equal(asked, 2, 'the raid asked for a defender twice');
    assert.equal(_raidRuntime().live.filter((e) => e.foe === watchman).length, 1, 'and holds him once');
  } finally {
    _resetRaidingParties();
    setModSetting(RAIDING_PARTIES_VENDOR, 'Enabled', false);
  }
});

test('WATCH-LEAVES: popAllowChange is UpdateMobiles\' allowChange - beyond allowVisiblePopRange, or outside the 180-degree forward view - and the one law the street\'s pool, the living town and the watch read', () => {
  assert.equal(POP_VISIBLE_RANGE, 120, 'allowVisiblePopRange');
  assert.equal(popAllowChange(0, 120, 0), false, 'in front at the range: in sight');
  assert.equal(popAllowChange(0, 120.01, 0), true, 'past it: hidden');
  assert.equal(popAllowChange(0, 5, 0, 121), true, 'the caller\'s own measure (the manager\'s is 3D)');
  assert.equal(popAllowChange(0, -5, 0), true, 'behind: hidden');
  assert.equal(popAllowChange(5, 0, 0), true, 'square to the side: outside Vector3.Angle <= 90\'s strict half');
  assert.equal(popAllowChange(5, 0.01, 0), false, 'a hair forward of it: in sight');
  assert.equal(popAllowChange(0, -5, Math.PI), false, 'the view turned: what was behind is in front');
  const pop = rd('src/systems/town/townPopulation.js');
  assert.match(pop, /const allowChange = popAllowChange\(dx, dz, viewYaw, dist\);/);
  const lt = rd('src/systems/livingWorld/livingTown.js');
  assert.match(lt, /_hidden\(dx, dz, viewYaw\) \{ return popAllowChange\(dx, dz, viewYaw\); \}/);
  for (const f of ['src/systems/town/townPopulation.js', 'src/systems/livingWorld/livingTown.js', 'src/scenes/cityGuards.js']) {
    assert.doesNotMatch(rd(f).replace(/^export function popAllowChange[^\n]*\n[^\n]*\n/m, ''), /> POP_VISIBLE_RANGE \|\| !/, `${f}: no second copy of the law`);
  }
});

test('WATCH-LEAVES: the world host hands the guard pool the camera\'s yaw - the one its street\'s population is handed', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('  const cityGuards = createCityGuards({');
  const body = w.slice(at, w.indexOf('\n  });', at));
  assert.match(body, /\n {4}viewYaw: \(\) => cam\.yaw,/);
  assert.match(w, /p\.population\.update\([^\n]*, local, cam\.yaw, local,/);
});
