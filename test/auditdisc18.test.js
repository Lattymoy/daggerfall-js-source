// AUDIT DISC18 (2026-09-24, Mac: "Do an audit on this") - four lenses over the DISC18 batch (the watch, the saves,
// the Light / chunk / door fixes, and the pins themselves). Every confirmed finding was reproduced in node first, fixed
// at its root, and is pinned here BY EXECUTION where the seam is a function (bible/01-Overview/Field-Bugs-2026-09-24.md,
// "AUDIT DISC18"):
//   W1 the defenders walked away mid-melee - a monster fighting one read as a quiet town (isTownThreat).
//   W2 a blow on a defender levied no crime and made a rogue that turned the town's guards; now it is Assault and the
//      whole squad is the crime's watch.
//   W3 an armour farm - a defender a monster killed kept his kit, and the town sent a fresh squad for every one lost.
//   W4 the player's splash, area, missile, touch, shaft and thrown torch struck the defenders.
//   W5 the attack grunt rolled once per pool, up to three for one swing; the cross-pool sparing ignored the
//      MeleeAttackFriendlyProtection setting; a summon still loading read as no defenders and summoned twice.
//   W6 the host's frame is townWatch.js's runTownWatchFrame now, run here, not read.
//   S1 a save the curse bug had already rewritten kept Silver-only hits and the curse's undeletable spells.
//   S2 an exit autosave under the vampire's death video stranded the infection for ever.
//   S3 the exit autosave named a namesake's slots and minted them for this character.
//   S4 the online revival stood an exhausted corpse up at zero fatigue.
//   E1 the swing's first-surface cast stopped at the weapon's reach, short of a door mesh inside its box.
//   E2 the pick/swing clauses the batch's pins left open: a mover's own mesh, a flat lever, special doors.
//   D1 the stale-chunk notice was set mid-build at 1.5 s and ran off the classic panel.
//   B1 the underground candle burned the dungeon's shared colour, not its own white.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createTownWatch, isTownThreat, runTownWatchFrame,
  TOWN_WATCH_MAX_WAVES, TOWN_WATCH_STAND_DOWN_SECONDS, TOWN_WATCH_ARRIVAL_MIN_SECONDS,
} from '../src/systems/townWatch.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { setValue } from '../src/systems/settings.js';
import { createLycanthropyCurse, liveLycanthropy, LYCANTHROPY_SPELL_TAG, VAMPIRE_SPELL_TAG } from '../src/systems/lycanthropy.js';
import { createVampirismCurse } from '../src/systems/vampirism.js';
import { LYCANTHROPY_TYPES, VAMPIRE_CLANS, INFECTION, startInfection, liveInfection } from '../src/systems/infection.js';
import { runMagicRoundsFor, resetMagicRoundMarker, setWorldMinutes } from '../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { reviveForPlay, respawnHealth } from '../src/systems/deathRespawn.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { saveSlot, exitAutosaveNames, QUICK_SAVE_NAME } from '../src/systems/saveSlots.js';
import { DeathScreen } from '../src/ui/deathScreen.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { Collider } from '../src/player/collider.js';
import { activationTargets, pickActivatableHit, hasMeshCollider } from '../src/player/activate.js';
import { envAttack } from '../src/combat/weaponRig.js';
import { WEAPON_REACH } from '../src/combat/playerWeapon.js';
import { STALE_CHUNK_IN_PLAY_TEXT, STALE_CHUNK_IN_PLAY_SECONDS } from '../src/systems/staleChunk.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ═══ W: the watch ═════════════════════════════════════════════════════════════════════════════════════════════════
const inside = () => true;
const hunter = (target = PLAYER_TARGET) => ({ ai: { isHostile: true, target, feet: [1, 0, 1] }, entity: { team: 'Centaurs' } });

test('AUDIT DISC18 W1: a monster fighting a standing defender is still the town\'s threat - a dead one\'s, or a crime watchman\'s, is not', () => {
  const defender = { defender: true, dead: false };
  assert.equal(isTownThreat(hunter(defender), { inTownRect: inside }), true, 'the fight the watch came for');
  assert.equal(isTownThreat(hunter({ defender: true, dead: true }), { inTownRect: inside }), false, 'a fallen defender is no fight');
  assert.equal(isTownThreat(hunter({ defender: false, dead: false }), { inTownRect: inside }), false, 'a monster at odds with the crime\'s watch is not the town\'s to answer');
  assert.equal(isTownThreat(hunter(defender), { inTownRect: () => false }), false, 'and still only inside the rect');
});

/** A guard pool's watch surface, counted. */
const fakeGuards = (n = 0) => {
  const log = { summons: [], dismissals: 0 };
  return {
    log,
    defenders: n,
    defenderCount() { return this.defenders; },
    summonDefenders(o) { log.summons.push(o); return Promise.resolve(0); },
    dismissDefenders() { log.dismissals++; return this.defenders; },
  };
};
const FRAME = { enabled: true, inTown: true, crime: false, locationKey: '3,12', inTownRect: inside, playerFeet: [0, 0, 0], playerFwd: [0, 0, 1] };

test('AUDIT DISC18 W1, driven: the squad stays while the monster fights it, and leaves ten seconds after it falls', () => {
  const watch = createTownWatch({ rand: () => 0 });
  const guards = fakeGuards(0);
  const centaur = hunter();
  let t = 0;
  while (!guards.log.summons.length && t < 30) { runTownWatchFrame(watch, 0.25, { ...FRAME, foes: [centaur], guards }); t += 0.25; }
  assert.equal(guards.log.summons.length, 1, 'the watch came');
  guards.defenders = 3;
  centaur.ai.target = { defender: true, dead: false };   // it turns on the squad - the player loses the tie
  for (let i = 0; i < 240; i++) runTownWatchFrame(watch, 0.25, { ...FRAME, foes: [centaur], guards });
  assert.equal(guards.log.dismissals, 0, 'a minute of melee and nobody walked away');
  centaur.dead = true;
  let left = 0;
  for (let i = 0; i < 44 && !guards.log.dismissals; i++) { runTownWatchFrame(watch, 0.25, { ...FRAME, foes: [centaur], guards }); left += 0.25; }
  assert.equal(guards.log.dismissals, 1);
  assert.equal(left, TOWN_WATCH_STAND_DOWN_SECONDS, 'the stand-down, to the tick');
});

test('AUDIT DISC18 W3: one incident brings at most TOWN_WATCH_MAX_WAVES squads - and the count starts over once the town has been quiet a stand-down\'s length', () => {
  const w = createTownWatch({ rand: () => 0 });   // Random.Range(5, 11) -> 5
  const T = { enabled: true, playerInTown: true, crime: false, threats: 1, defenders: 0, locationKey: '3,12' };
  let summons = 0;
  for (let i = 0; i < 800; i++) if (w.tick(0.25, T) === 'summon') summons++;   // every squad dies the moment it lands
  assert.equal(summons, 3, 'two hundred seconds against a monster no squad can beat: three squads, the port\'s own number');
  assert.equal(w.waves, TOWN_WATCH_MAX_WAVES);
  for (let i = 0; i < 39; i++) w.tick(0.25, { ...T, threats: 0 });
  assert.equal(w.waves, TOWN_WATCH_MAX_WAVES, 'not yet: nine and three-quarter quiet seconds');
  w.tick(0.25, { ...T, threats: 0 });
  assert.equal(w.waves, 0, 'ten quiet seconds end the incident');
  let t = 0, act = null;
  while (act !== 'summon' && t < 30) { act = w.tick(0.25, T); t += 0.25; }
  assert.equal(act, 'summon', 'the next monster brings the watch again');
  assert.equal(t, TOWN_WATCH_ARRIVAL_MIN_SECONDS + 0.25, 'after the countdown (armed on the first tick)');
});

test('AUDIT DISC18 W3, through the frame: a player out of town for a stand-down\'s length ends the incident even with the monster still after them - the frame counts no threat outside the town', () => {
  const w = createTownWatch({ rand: () => 0 });
  const guards = fakeGuards(0);
  const centaur = hunter();
  for (let i = 0; i < 800; i++) runTownWatchFrame(w, 0.25, { ...FRAME, foes: [centaur], guards });
  assert.equal(guards.log.summons.length, 3, 'the incident\'s three squads, all lost');
  for (let i = 0; i < 40; i++) runTownWatchFrame(w, 0.25, { ...FRAME, inTown: false, foes: [centaur], guards });
  assert.equal(w.waves, 0, 'ten seconds out of town, the monster at their heels: the town is quiet');
  for (let i = 0; i < 40; i++) runTownWatchFrame(w, 0.25, { ...FRAME, foes: [centaur], guards });
  assert.equal(guards.log.summons.length, 4, 'back in town with it, the watch comes again');
});

test('AUDIT DISC18: the countdown\'s top is Random.Range(5, 11)\'s ten; standing defenders are never summoned again, through a whole countdown; one threat\'s moment resets the stand-down', () => {
  const top = createTownWatch({ rand: () => 0.999 });
  const T = { enabled: true, playerInTown: true, crime: false, threats: 1, defenders: 0, locationKey: '3,12' };
  let t = 0, act = top.tick(0, T);
  while (!act && t < 30) { act = top.tick(0.25, T); t += 0.25; }
  assert.equal(act, 'summon');
  assert.equal(t, 10, 'Random.Range(5, 11) never answers eleven');
  const standing = createTownWatch({ rand: () => 0 });
  for (let i = 0; i < 80; i++) assert.notEqual(standing.tick(0.25, { ...T, defenders: 3 }), 'summon', 'a squad is standing');
  const calm = createTownWatch();
  for (let i = 0; i < 24; i++) assert.equal(calm.tick(0.25, { ...T, threats: 0, defenders: 3 }), null);   // six quiet seconds
  calm.tick(0.25, { ...T, threats: 1, defenders: 3 });   // a monster shows itself
  for (let i = 0; i < 36; i++) assert.equal(calm.tick(0.25, { ...T, threats: 0, defenders: 3 }), null, 'the quiet starts over - nine seconds is not ten');
  let out = null;
  for (let i = 0; i < 8 && !out; i++) out = calm.tick(0.25, { ...T, threats: 0, defenders: 3 });
  assert.equal(out, 'dismiss');
});

test('AUDIT DISC18 W6: the host\'s frame - the threats it hands the summon are the filtered ones, the defenders are the pool\'s count, the dismissal reaches the pool, and a player out of town has no threats', () => {
  const w = createTownWatch({ rand: () => 0 });
  const guards = fakeGuards(0);
  const threat = hunter();
  const idle = hunter(null);
  const outside = { ...hunter(), outside: true };
  const rect = (f) => !f.outside;
  let pooled = 0;
  const pool = () => { pooled++; return [{ guard: true }]; };
  let act = null;
  for (let i = 0; i < 40 && act !== 'summon'; i++) act = runTownWatchFrame(w, 0.25, { ...FRAME, inTownRect: rect, foes: [threat, idle, outside], guards, pool });
  assert.equal(act, 'summon');
  assert.equal(guards.log.summons.length, 1);
  const s = guards.log.summons[0];
  assert.deepEqual(s.threats, [threat], 'only the monster hunting inside the rect');
  assert.deepEqual([s.playerFeet, s.playerFwd, s.pool], [FRAME.playerFeet, FRAME.playerFwd, [{ guard: true }]]);
  assert.equal(pooled, 1, 'the wandering guards are read on the summon alone');
  const busy = createTownWatch({ rand: () => 0 });
  const three = fakeGuards(3);
  for (let i = 0; i < 80; i++) runTownWatchFrame(busy, 0.25, { ...FRAME, foes: [threat], guards: three });
  assert.equal(three.log.summons.length, 0, 'the pool\'s own count stands a squad');
  const away = fakeGuards(2);
  assert.equal(runTownWatchFrame(createTownWatch(), 0.25, { ...FRAME, inTown: false, foes: [threat], guards: away }), 'dismiss');
  assert.equal(away.log.dismissals, 1, 'out of town: no threats, and the squad sent home');
  const off = fakeGuards(2);
  assert.equal(runTownWatchFrame(createTownWatch(), 0.25, { ...FRAME, enabled: false, foes: [threat], guards: off }), 'dismiss');
  assert.equal(off.log.dismissals, 1);
});

test('AUDIT DISC18 W6 by source: the world host answers the frame with the strict town test, its own rect for the foes\' feet, the travel pixel and the whole guard pool - nothing more', () => {
  const w = rd('src/scenes/world.js');
  const body = (head, end) => { const at = w.indexOf(head); assert.ok(at > 0, head); return w.slice(at, w.indexOf(end, at) + end.length); };
  assert.equal(body('  function _townWatchFrame(dt) {', '\n  }'), `  function _townWatchFrame(dt) {
    const px = playerTravelPixel();
    const feet = walkMode && playerSpawned ? player.pos : cam.pos;
    runTownWatchFrame(townWatch, dt, {
      enabled: getPref('townWatch') !== false && !isTransformedLycanthrope(playerEntity),
      inTown: _isPlayerInTownStrict(), crime: !!playerEntity.crimeCommitted, locationKey: \`\${px.x},\${px.y}\`,
      foes: exteriorFoes.foes, inTownRect: _foeInTownRect, guards: cityGuards,
      playerFeet: [...feet], playerFwd: [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)], pool: _guardPool,
    });
  }`);
  assert.equal(body('  const _foeInTownRect = (f) => {', '\n  };'), `  const _foeInTownRect = (f) => {
    if (!_musicLoc || !f?.ai?.feet) return false;
    const px = playerTravelPixel();
    const wc = state.worldCoords(f.ai.feet);
    return isInLocationRect(wc.x, wc.z, locationWorldRect(_musicLoc, px.x, px.y));
  };`);
  assert.match(w, /const townWatch = createTownWatch\(\);/);
});

// the watch1 rig (disc18.test.js's): a synthetic CLASS18.CFG and MONSTER.BSA, a flat open world
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
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
const rig = (playerEntity, over = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...over,
});
const FEET0 = [0, 0, 0], EYE0 = [0, 1.6, 0], FWD0 = [0, 0, 1];
const npcGuard = (pos, log = []) => ({ pos, fwdYaw: 0, guard: true, disable: () => log.push(pos) });
async function town(p, { guardsOver = {}, foesOver = {}, at = [3, 0, 3], n = 1 } = {}) {
  const guards = createCityGuards(rig(p, guardsOver));
  const monsters = createExteriorFoes(rig(p, foesOver));
  const centaur = await monsters.spawnFoe(0, [8, 0, 8], { feetGiven: true });
  centaur.ai.target = PLAYER_TARGET;
  const pool = Array.from({ length: n }, (_, i) => npcGuard([at[0] + i * 0.5, at[1], at[2]]));
  await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool, threats: [centaur] });
  return { guards, monsters, centaur };
}

test('AUDIT DISC18 W2: a blow on a defender is Assault - the whole squad is the crime\'s watch at once (both teams, the pursuit), and no half-reset defender reads as a standing watch', async () => {
  const p = townsman();
  const { guards } = await town(p, { n: 2 });
  const [a, b] = guards.guards;
  assert.deepEqual([a.defender, b.defender], [true, true]);
  b.ai.isHostile = false; b.ai.giveUpTimer = 0; b.ai.lastKnownTargetPos = null;   // the one the blow never touched
  a.ai.isHostile = true; a.entity.team = 'CityWatch';   // the half-reset the old door left behind
  assert.equal(guards.anyWatchStanding(), false, 'a defender is never the crime\'s watch - no wandering guard turns for him');
  a.entity.team = 'PlayerAlly';
  guards.handleAttackFromPlayer(a, FEET0);   // the door every player blow reaches - the swing, a shaft, a spell
  assert.equal(p.crimeCommitted, 4, 'Assault');
  for (const g of [a, b]) {
    assert.equal(g.defender, false, 'enlisted');
    assert.deepEqual([g.entity.team, g.entity.mobileTeam], ['CityWatch', 'CityWatch']);
    assert.equal(g.ai.isHostile, true);
  }
  assert.equal(a.ai.target, PLAYER_TARGET, 'the struck one turns on the one who struck');
  assert.equal(b.ai.giveUpTimer, 600, 'and the rest are seeded with the crime watch\'s pursuit - GiveUpTimer tripled');
  assert.deepEqual(b.ai.lastKnownTargetPos, FEET0, 'from where the blow came');
  assert.equal(guards.anyWatchStanding(), true, 'now they are the watch');
  const q = townsman();
  const { guards: g2 } = await town(q);
  q.crimeCommitted = 5;   // a murder already on the books, the squad not yet enlisted this frame
  g2.handleAttackFromPlayer(g2.guards[0], FEET0);
  assert.equal(q.crimeCommitted, 5, 'a held crime is never lowered to Assault');
});

test('AUDIT DISC18 W3: a defender a monster kills carries nothing - a crime watchman it kills keeps his kit, and one the player kills is the player\'s', async () => {
  const p = townsman();
  const { guards } = await town(p);
  const d = guards.guards[0];
  const KIT = () => [{ name: 'Chain Cuirass' }, { name: 'Longsword' }];
  d.entity.items = KIT();   // the watch's kit (this rig's class file carries none)
  d.hurtFromFoe(1e6, null);
  assert.equal(d.dead, true);
  assert.deepEqual(d.entity.items, [], 'the town sent him - nothing to strip');
  const q = townsman();
  const { guards: g2 } = await town(q);
  const w = g2.guards[0];
  w.defender = false;   // a watchman of a crime, the same record
  w.entity.items = KIT();
  w.hurtFromFoe(1e6, null);
  assert.equal(w.entity.items.length, 2, 'the crime watch\'s body keeps its kit, as before');
  const r = townsman();
  const { guards: g3 } = await town(r);
  const m = g3.guards[0];
  m.entity.items = KIT();
  g3.hurtGuard(m, 1e6, FEET0);
  assert.equal(m.dead, true);
  assert.equal(r.crimeCommitted, 5, 'murder');
  assert.equal(m.entity.items.length, 2, 'a body the player felled is theirs to strip, as any watchman\'s');
});

test('AUDIT DISC18 W5: a summon still loading counts - the watch reads a squad from the first mint', async () => {
  const p = townsman();
  const guards = createCityGuards(rig(p));
  const monsters = createExteriorFoes(rig(p));
  const centaur = await monsters.spawnFoe(0, [8, 0, 8], { feetGiven: true });
  const pending = guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [npcGuard([3, 0, 3])], threats: [centaur] });
  assert.equal(guards.defenderCount(), 1, 'in flight, and counted');
  assert.equal(await pending, 1);
  assert.equal(guards.defenderCount(), 1, 'landed, and counted once');
});

test('AUDIT DISC18: the summon converts the wandering GUARDS in range and nobody else - a townsperson is not one, and a guard past 77.5 is not in range - else 2-5 come at the spawner\'s band', async () => {
  const p = townsman();
  const guards = createCityGuards(rig(p, { rand: () => 0.3 }));
  const monsters = createExteriorFoes(rig(p));
  const centaur = await monsters.spawnFoe(0, [8, 0, 8], { feetGiven: true });
  const disabled = [];
  const came = await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, threats: [centaur], pool: [
    { pos: [2, 0, 2], fwdYaw: 0, guard: false, disable: () => disabled.push('townsperson') },
    { pos: [80, 0, 0], fwdYaw: 0, guard: true, disable: () => disabled.push('far guard') },
  ] });
  assert.deepEqual(disabled, [], 'neither was converted');
  assert.equal(came, 2 + Math.floor(0.3 * 4), 'Random.Range(2, 6) at the band instead');
  assert.ok(guards.guards.every((g) => g.defender && g.entity.team === 'PlayerAlly'), 'every one of them the player\'s ally');
  const q = townsman();
  const g2 = createCityGuards(rig(q, { rand: () => 0.3 }));
  assert.equal(await g2.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, threats: [centaur], pool: [] }), 3, 'an empty street: the band');
});

test('AUDIT DISC18 W5: with MeleeAttackFriendlyProtection off the first pass strikes a defender in front like anything else, and the second has nothing to offer', async () => {
  const p = townsman();
  const guards = createCityGuards(rig(p));
  const monsters = createExteriorFoes(rig(p));
  const centaur = await monsters.spawnFoe(0, [9, 0, 9], { feetGiven: true });
  await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [{ pos: [0, 0, 1.2], fwdYaw: Math.PI, guard: true, disable: () => {} }], threats: [centaur] });
  const d = guards.guards[0];
  d.entity.health = 10000;
  setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', false);
  try {
    assert.equal(guards.resolvePlayerHit(new PlayerWeapon({}), EYE0, FWD0, FEET0, () => true, null, { defendersOnly: true }), false, 'the fallback pass has nothing to offer - the first already had him');
    assert.equal(d.entity.health, 10000);
    assert.equal(d.defender, true, 'untouched');
    assert.equal(guards.resolvePlayerHit(new PlayerWeapon({}), EYE0, FWD0, FEET0, () => true, null, { spareDefenders: true }), true, 'no protection: the watch\'s own pass reaches him');
  } finally { setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', true); }
});

test('AUDIT DISC18 W5: one swing, one attack grunt - the host offers it to the watch, the monsters and the defenders, and only the first pool with anyone in it rolls', async () => {
  setValue('Enhancements', 'CombatVoices', true);
  try {
    const plays = [];
    const audio = { playOneShot: (clip) => plays.push(clip), play3d() {} };
    const p = townsman();
    const guards = createCityGuards(rig(p, { audio, rand: () => 0.05 }));
    const monsters = createExteriorFoes(rig(p, { audio, rolls: () => 0.05 }));
    const centaur = await monsters.spawnFoe(0, [9, 0, 9], { feetGiven: true });
    await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [npcGuard([3, 0, 3])], threats: [centaur] });
    plays.length = 0;
    const AWAY = [0, 0, -1];   // a swing at the air behind: every pool misses
    const w = new PlayerWeapon({});
    const swing = {};
    assert.equal(guards.resolvePlayerHit(w, EYE0, AWAY, FEET0, () => true, null, { spareDefenders: true, swing }), false);
    assert.equal(monsters.resolvePlayerHit(w, EYE0, AWAY, FEET0, () => true, null, { swing }), false);
    assert.equal(guards.resolvePlayerHit(w, EYE0, AWAY, FEET0, () => true, null, { defendersOnly: true, swing }), false);
    assert.equal(plays.length, 1, 'one grunt');
    assert.equal(swing.voiced, true);
    plays.length = 0;
    guards.resolvePlayerHit(w, EYE0, AWAY, FEET0, () => true, null, { defendersOnly: true });
    assert.equal(plays.length, 1, 'a pool offered a swing on its own still rolls its own');
    guards.guards[0].defender = false;   // a watchman of a crime stands in the watch's pool - it is the first with anyone in it
    plays.length = 0;
    const second = {};
    guards.resolvePlayerHit(w, EYE0, AWAY, FEET0, () => true, null, { spareDefenders: true, swing: second });
    monsters.resolvePlayerHit(w, EYE0, AWAY, FEET0, () => true, null, { swing: second });
    assert.equal(plays.length, 1, 'the watch rolled it, the monsters did not');
  } finally { setValue('Enhancements', 'CombatVoices', false); }
});

test('AUDIT DISC18 W5 by source: every host that offers one swing to more than one pool hands them the one token', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const swing = \{\};\n\s*if \(!cityGuards\.resolvePlayerHit\([^\n]*\{ spareDefenders: true, swing \}\)\) \{/);
  assert.match(w, /if \(exteriorFoes\.resolvePlayerHit\([^\n]*guardHitSound, \{ swing \}\)\) \{/);
  assert.match(w, /\{ defendersOnly: true, swing \}\)\)/);
  assert.match(w, /\{ onMurder: \(\) => _crimeResponse\(\), onHitSound: guardHitSound, swing \}\)\.then/);
  const e = rd('src/scenes/exterior.js');
  assert.equal((e.match(/guardHitSound, \{ swing \}\)\)/g) ?? []).length, 2, 'the fixed-city host\'s two pools');
  assert.match(e, /onHitSound: guardHitSound, swing \}\)\.then/);
  const m = rd('src/scenes/worldModes.js');
  assert.equal((m.match(/interiorHitSound, \{ swing \}\)\)/g) ?? []).length, 2, 'the interior\'s two pools');
  assert.match(rd('src/scenes/cityGuards.js'), /const carriedHit = resolvePlayerHit\([^\n]*onHitSound, \{ swing \}\);/, 'and the Assault conversion\'s re-pointed swing is the same swing');
});

test('AUDIT DISC18 W4: the player\'s shaft flies through a defender to the monster behind him; an enemy\'s shaft still stops on one', () => {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: null });
  const defender = { id: 'defender', defender: true, dead: false, ai: { height: 1.8 } };
  const centaur = { id: 'centaur', dead: false, ai: { height: 1.8 } };
  f.fire([0, 0.9, 0], [0, 0, 1], { fromPlayer: true, weapon: {} });
  const hits = [];
  const targets = [{ feet: [0, 0, 1.5], ref: defender }, { feet: [0, 0, 4], ref: centaur }];
  for (let i = 0; i < 20 && !hits.length; i++) f.update(0.05, { foeTargets: targets, onPlayerArrowHitFoe: (m, t) => hits.push(t.id) });
  assert.deepEqual(hits, ['centaur']);
  const g = new ArrowFlight({ getGpuMesh: () => null, collider: null });
  g.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 'archer' }, weapon: {}, aimFoe: centaur });
  const got = [];
  for (let i = 0; i < 20 && !g.arrows[0].dead; i++) g.update(0.05, { foeTargets: targets, onFoeHit: (m, t) => got.push(t.id) });
  assert.equal(g.arrows[0].dead, true, 'stopped on the defender in its path');
  assert.deepEqual(got, [], 'and dealt nothing: it was loosed at the centaur (:669)');
});

const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const DAMAGE = fx(4, 0);
const spellOf = (rangeType, name) => ({ name, index: 90, element: 4, rangeType, effects: [DAMAGE, EMPTY, EMPTY] });
const foeRec = (id, feet, extra = {}) => ({
  id, ai: { feet, height: 1.8, isHostile: true }, dead: false,
  entity: { health: 100, maxHealth: 100, level: 1, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, activeEffects: [], skills: new Array(40).fill(0) },
  ...extra,
});
function spellRig(foes) {
  const hurt = [];
  const player = { isPlayer: true, level: 4, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => foes,
    foeSinks: (f) => ({ hurt: (n) => hurt.push([f.id, n]), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.5,
    startCastAnim: null,
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, hurt, player };
}
const struck = (hurt) => [...new Set(hurt.map(([id]) => id))].sort();

test('AUDIT DISC18 W4: the player\'s spells pass the town\'s defenders by - the area around the caster, the touch, the missile and the blast', () => {
  const near = () => [foeRec('defender', [0, 0, 1.2], { defender: true }), foeRec('centaur', [1.5, 0, 2.5])];
  const area = spellRig(near());
  area.magic.readySpell(spellOf(3, 'Aura'));
  area.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.deepEqual(struck(area.hurt), ['centaur'], 'the area around the caster');
  const touch = spellRig([foeRec('defender', [0, 0, 1.2], { defender: true })]);
  touch.magic.readySpell(spellOf(1, 'Touch'));
  assert.equal(touch.magic.castInput([0, 0.9, 0], [0, 0, 1]), false, 'a touch with only a defender in reach finds no target - nothing spent');
  const line = () => [foeRec('defender', [0, 0, 2], { defender: true }), foeRec('centaur', [0, 0, 6])];
  const bolt = spellRig(line());
  bolt.magic.readySpell(spellOf(2, 'Bolt'));
  bolt.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  for (let i = 0; i < 60 && !bolt.hurt.length; i++) bolt.magic.update(0.05, [0, 0, 0]);
  assert.deepEqual(struck(bolt.hurt), ['centaur'], 'the missile flies through him');
  const ball = spellRig(line());
  ball.magic.readySpell(spellOf(4, 'Fireball'));
  ball.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  for (let i = 0; i < 60 && !ball.hurt.length; i++) ball.magic.update(0.05, [0, 0, 0]);
  assert.deepEqual(struck(ball.hurt), ['centaur'], 'and the blast at the monster leaves him standing, four metres off or not');
  const nearBlast = spellRig([foeRec('defender', [0, 0, 5], { defender: true }), foeRec('centaur', [0, 0, 6])]);
  nearBlast.magic.readySpell(spellOf(4, 'Fireball'));
  nearBlast.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  for (let i = 0; i < 60 && !nearBlast.hurt.length; i++) nearBlast.magic.update(0.05, [0, 0, 0]);
  assert.deepEqual(struck(nearBlast.hurt), ['centaur'], 'a defender inside the radius of the blast is spared');
});

test('AUDIT DISC18 W4 by source: a thrown torch passes the defenders by (the world host\'s torch pool), and a monster\'s blast still lands on them', () => {
  assert.match(rd('src/scenes/world.js'), /foes: \(\) => \[\.\.\.cityGuards\.guards\.filter\(\(g\) => !g\.defender\), \.\.\.exteriorFoes\.foes\], foeSinks: \(f\) => foeSinks\(f\), makeEnemiesHostile/);
  assert.match(rd('src/scenes/hostMagic.js'), /if \(caster\?\.entity === playerEntity && sparedFromPlayer\(t\)\) continue;/);
});

// ═══ S: the saves ═════════════════════════════════════════════════════════════════════════════════════════════════
const T0 = 523530 + 10 * MINUTES_PER_DAY;
const mortal = () => ({
  isPlayer: true, name: 'Mac', race: 'Nord', gender: 'male', level: 10, reflexes: 2,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 },
  items: [], activeEffects: [], spells: [], health: 100, maxHealth: 100, crimeCommitted: 0, lastGameMinutes: T0,
});
const reload = (p) => { const q = { isPlayer: true }; restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: T0 })))); return q; };
const FIREBALL = { name: 'My Fireball', custom: true, rangeType: 4, element: 0, effects: [] };

test('AUDIT DISC18 S1: a save the curse bug had already rewritten - no curse, but Silver-only hits and the curse\'s spells - loads a plain mortal', () => {
  const p = mortal();
  p.minMetalToHit = WEAPON_MATERIALS.Silver;
  p.spells = [{ name: 'Lycanthropy', tag: LYCANTHROPY_SPELL_TAG, custom: true }, { name: 'Vampire Charm', tag: VAMPIRE_SPELL_TAG, custom: true }, FIREBALL];
  const q = reload(p);
  assert.equal(q.minMetalToHit, undefined, 'iron and steel hurt them again');
  assert.deepEqual(q.spells.map((s) => s.name), ['My Fireball'], 'the curse\'s spells gone, the player\'s own kept');
});

test('AUDIT DISC18 S1: a living curse, or one pending its deploy, keeps both', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const wolf = mortal();
  createLycanthropyCurse(wolf, LYCANTHROPY_TYPES.Werewolf, { now: T0 });
  wolf.minMetalToHit = WEAPON_MATERIALS.Silver;   // transformed
  wolf.spells.push(FIREBALL);
  const tagged = wolf.spells.filter((s) => s.tag === LYCANTHROPY_SPELL_TAG).length;
  const w = reload(wolf);
  assert.ok(liveLycanthropy(w));
  assert.equal(w.minMetalToHit, WEAPON_MATERIALS.Silver);
  assert.equal(w.spells.filter((s) => s.tag === LYCANTHROPY_SPELL_TAG).length, tagged);
  const vamp = mortal();
  createVampirismCurse(vamp, VAMPIRE_CLANS.Lyrezi, { now: T0 });
  runMagicRoundsFor(vamp, T0, T0 + 1, {});   // the round puts the silver on
  assert.equal(vamp.minMetalToHit, WEAPON_MATERIALS.Silver);
  assert.equal(reload(vamp).minMetalToHit, WEAPON_MATERIALS.Silver, 'a vampire is still hurt by silver alone');
  const pending = mortal();
  pending.racialOverridePending = { infectionType: LYCANTHROPY_TYPES.Werewolf };
  pending.minMetalToHit = WEAPON_MATERIALS.Iron;
  pending.spells = [{ name: 'Lycanthropy', tag: LYCANTHROPY_SPELL_TAG, custom: true }];
  const pq = reload(pending);
  assert.equal(pq.minMetalToHit, WEAPON_MATERIALS.Iron);
  assert.equal(pq.spells.length, 1, 'the curse is on its way: nothing is cleared');
  resetMagicRoundMarker(null);
});

test('AUDIT DISC18 S2: a save taken under the vampire\'s death video brings the video back - the close it waited for never comes in the loaded game', () => {
  const p = mortal();
  startInfection(p, INFECTION.Vampirism, { day: Math.floor(T0 / MINUTES_PER_DAY) });
  const e = liveInfection(p);
  e.dreamPlayed = true; e.deathScheduled = true;
  const q = reload(p);
  const r = liveInfection(q);
  assert.equal(r.infection, INFECTION.Vampirism);
  assert.equal(r.deathScheduled, false, 'pushed again at the next round past the day');
  assert.equal(r.dreamPlayed, true, 'the dream it had is not had again');
});

test('AUDIT DISC18: an old save\'s INFECTION - no flag, the null round count - is repaired too, and lives on through the rounds', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const p = mortal();
  startInfection(p, INFECTION.Werewolf, { day: Math.floor(T0 / MINUTES_PER_DAY) });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: T0 })));
  const old = snap.activeEffects.find((a) => a.infection);
  delete old.permanent;
  old.roundsRemaining = null;
  const q = { isPlayer: true };
  restorePlayer(q, snap);
  runMagicRoundsFor(q, T0, T0 + 3, {});
  assert.equal(liveInfection(q)?.infection, INFECTION.Werewolf);
  resetMagicRoundMarker(null);
});

const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
};

test('AUDIT DISC18 S3: the online exit autosave names this character\'s own slots - never a namesake\'s - and always the QuickSave', () => {
  const storage = memStorage();
  const me = mortal();
  const namesake = mortal();
  saveSlot(me.name, 'Backup', snapshotPlayer(me, { classicMinutes: T0 }), { storage });
  saveSlot(namesake.name, 'Dungeon run', snapshotPlayer(namesake, { classicMinutes: T0 }), { storage });
  saveSlot(namesake.name, 'Before the Mages', snapshotPlayer(namesake, { classicMinutes: T0 }), { storage });
  assert.notEqual(me.characterId, namesake.characterId, 'two characters, one name');
  assert.deepEqual(exitAutosaveNames(me, { storage }).sort(), ['Backup', QUICK_SAVE_NAME].sort(), 'mine, and the QuickSave I have not made yet');
  const legacy = { ...mortal(), characterId: undefined };
  assert.deepEqual(exitAutosaveNames(legacy, { storage }).sort(), ['Backup', 'Before the Mages', 'Dungeon run', QUICK_SAVE_NAME].sort(), 'no id to give: the name decides, as findSave does');
});

test('AUDIT DISC18 S4: the revival stands an exhausted corpse up with the same fraction of its fatigue - and never touches a living player\'s', () => {
  const dead = { health: 0, maxHealth: 80, fatigue: 0, stats: { strength: 50, endurance: 60 } };
  reviveForPlay(dead);
  assert.equal(dead.fatigue, respawnHealth(maxFatigue(dead)));
  assert.ok(dead.fatigue > 1);
  const tired = { health: 30, maxHealth: 80, fatigue: 0, stats: { strength: 50, endurance: 60 } };
  reviveForPlay(tired);
  assert.equal(tired.fatigue, 0, 'a prison release is not a rest');
  const rested = { health: 0, maxHealth: 80, fatigue: 900, stats: { strength: 50, endurance: 60 } };
  reviveForPlay(rested, { force: true });
  assert.equal(rested.fatigue, 900, 'fatigue left is fatigue kept');
  const respawn = { health: 12, maxHealth: 80, fatigue: 0, stats: { strength: 50, endurance: 60 } };
  reviveForPlay(respawn, { force: true });
  assert.equal(respawn.fatigue, respawnHealth(maxFatigue(respawn)), 'the respawn pays it too');
});

test('AUDIT DISC18: the online death screen names its respawn and no key that does nothing', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search: '?online=1&load=1', pathname: '/' }, configurable: true, writable: true });
  try {
    const hint = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8 }).hint;
    assert.match(hint, /respawn/i);
    assert.doesNotMatch(hint, /F11|load|end/i);
  } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
});

// ═══ E: the pick and the swing ════════════════════════════════════════════════════════════════════════════════════
function boxMesh(min, max) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  return { positions: new Float32Array(p), indices: new Uint32Array(BOX_FACES) };
}
const BOX_FACES = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
/** A slab turned 45 degrees about Y, in world coordinates, corners in boxMesh's order: its box runs well ahead of its
 *  faces along X - the shape of a door placed on a diagonal. */
function turnedSlab(c, halfThick = 0.05, halfWide = 0.5, y0 = 0, y1 = 2.2) {
  const r = Math.SQRT1_2;
  const at = (a, b, y) => [c[0] + (a - b) * r, y, c[2] + (a + b) * r];
  const corners = [
    at(-halfThick, -halfWide, y0), at(halfThick, -halfWide, y0), at(halfThick, -halfWide, y1), at(-halfThick, -halfWide, y1),
    at(-halfThick, halfWide, y0), at(halfThick, halfWide, y0), at(halfThick, halfWide, y1), at(-halfThick, halfWide, y1),
  ];
  return { positions: new Float32Array(corners.flat()), indices: new Uint32Array(BOX_FACES) };
}
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const DOOR_TEXT = { actionFlag: ACTION_FLAGS.DoorText, triggerFlag: TRIGGER_FLAGS.None, index: 72, nextObject: -1, duration: 0, magnitude: 0, axisRaw: 5 };
const EYE = [0, 1.2, 0], EAST = [1, 0, 0];

test('AUDIT DISC18 E1: the swing finds a door whose box is inside the reach and whose mesh lies just past it - the relay in front does not keep the blow (Orsinium, 12631 behind 12080)', () => {
  const collider = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider, { rolls: () => 0 });
  const door = actions.addDoor(turnedSlab([2.85, 0, 0]), IDENTITY, { ns: 0, positionKey: 12631, startingLockValue: 0, action: DOOR_TEXT });
  const relay = actions.addRelay(0, 12080, { actionFlag: ACTION_FLAGS.DoorText, triggerFlag: TRIGGER_FLAGS.MultiTrigger, index: 0, nextObject: -1, axisRaw: 50 },
    { min: [1, 0, -3], max: [6, 3, 3] }, [3, 0, 0], 1234);
  const box = pickBox(actions, door);
  assert.ok(box < WEAPON_REACH, `the door's box is inside the reach (${box.toFixed(2)})`);
  const mesh = collider.raycastHit(EYE, EAST, 10);
  assert.equal(mesh.key, door.key);
  assert.ok(mesh.dist > WEAPON_REACH, `and its mesh past it (${mesh.dist.toFixed(2)})`);
  const bashed = [], received = [];
  actions.onDoorBash = (o) => bashed.push(o.key);
  const receive = actions.receive.bind(actions);
  actions.receive = (o, how) => { received.push(o.key); return receive(o, how); };
  assert.equal(envAttack(actions, collider, EYE, EAST, () => 0.5), true, 'the swing is the door\'s');
  assert.deepEqual(bashed, [door.key]);
  assert.ok(!received.includes(relay.key), 'the relay\'s record never heard it');
});
/** Where the press ray from EYE along EAST enters an object's box. */
function pickBox(actions, o) {
  return activationTargets(actions.objects).find((x) => x.key === o.key).aabb.min[0] - EYE[0];
}

test('AUDIT DISC18 E2: a mover met at its own mesh is the press\'s and the swing\'s - the first surface being its own never skips it', () => {
  const collider = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider, { rolls: () => 0 });
  const lever = boxMesh([1.5, 0.8, -0.2], [1.7, 1.6, 0.2]);
  const mover = actions.addAction(0, 501, { ...lever, modelIdNum: 777 }, IDENTITY, { index: 0, duration: 20, rotation: [0, 0, 0], translation: [0, 0, 0], nextObject: -1, triggerFlag: TRIGGER_FLAGS.Direct });
  assert.equal(hasMeshCollider(mover), true);
  const hit = pickActivatableHit(EYE, EAST, activationTargets(actions.objects), collider);
  assert.equal(hit?.key, mover.key, 'the press');
  const received = [];
  actions.receive = (o) => { received.push(o.key); return false; };
  envAttack(actions, collider, EYE, EAST, () => 0.5);
  assert.deepEqual(received, [mover.key], 'the swing');
});

test('AUDIT DISC18 E2: a flat lever in front of a door is the press\'s - a flat is a BoxCollider, never skipped for the surface behind it', () => {
  const collider = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider, { rolls: () => 0 });
  const door = actions.addDoor(boxMesh([2.2, 0, -0.6], [2.3, 2.2, 0.6]), IDENTITY, { ns: 0, positionKey: 1, startingLockValue: 0, action: DOOR_TEXT });
  const flat = actions.addRelay(0, 2, { actionFlag: ACTION_FLAGS.DoorText, triggerFlag: TRIGGER_FLAGS.Direct, index: 0, nextObject: -1, axisRaw: 5 },
    { min: [1.2, 0.8, -0.3], max: [1.3, 1.6, 0.3] }, [1.25, 0.8, 0], null);
  assert.equal(hasMeshCollider(flat), false);
  const hit = pickActivatableHit(EYE, EAST, activationTargets(actions.objects), collider);
  assert.equal(hit?.key, flat.key);
  assert.notEqual(hit?.key, door.key);
});

test('AUDIT DISC18 E2: the mesh colliders are DFU\'s placed models - movers, special doors, model relays and effects; action doors and flats are boxes', () => {
  assert.equal(hasMeshCollider({ kind: 'action' }), true);
  assert.equal(hasMeshCollider({ kind: 'door', special: true }), true, 'a special door is a standalone model');
  assert.equal(hasMeshCollider({ kind: 'door' }), false, 'an action door is a BoxCollider');
  assert.equal(hasMeshCollider({ kind: 'relay', modelIdNum: 63107 }), true);
  assert.equal(hasMeshCollider({ kind: 'relay', modelIdNum: null }), false);
  assert.equal(hasMeshCollider({ kind: 'effect', modelIdNum: 41000 }), true);
  assert.equal(hasMeshCollider({ kind: 'effect' }), false);
  assert.equal(hasMeshCollider({ kind: 'moveFlat', modelIdNum: 5 }), false);
  assert.equal(hasMeshCollider(null), false);
});

// ═══ D and B ══════════════════════════════════════════════════════════════════════════════════════════════════════
test('AUDIT DISC18 D1: the stale-chunk notice fits one line of the classic panel and is said on the level\'s first frame, long enough to read', () => {
  assert.ok(STALE_CHUNK_IN_PLAY_TEXT.length <= 50, `${STALE_CHUNK_IN_PLAY_TEXT.length} characters`);
  assert.match(STALE_CHUNK_IN_PLAY_TEXT, /reload/i);
  assert.ok(STALE_CHUNK_IN_PLAY_SECONDS >= 10);
  const dc = rd('src/scenes/dungeonContext.js');
  const c = dc.slice(dc.indexOf('} catch (err) {', dc.indexOf('if (opts.foes && palette) {')));
  assert.match(c.slice(0, 1200), /if \(isStaleChunk\(err\)\) _staleChunkNotice = true;/);
  assert.ok(!c.slice(0, 1200).includes('setMidScreenText('), 'nothing is said mid-build');
  assert.match(dc, /function drawFoes\([^\n]*\) \{\n\s*if \(_staleChunkNotice\) \{ _staleChunkNotice = false; setMidScreenText\(STALE_CHUNK_IN_PLAY_TEXT, STALE_CHUNK_IN_PLAY_SECONDS\); \}/);
});

test('AUDIT DISC18 B1: underground the candle burns its own white - every other light keeps the dungeon\'s colour', () => {
  const src = rd('src/scenes/worldModes.js');
  const at = src.indexOf("if (mode === 'dungeon') {\n      if (pendingDungeonExit)");
  const branch = src.slice(at, src.indexOf('\n    }\n', at));
  assert.match(branch, /const _dgColor = lanternColor\(!!renderer\.lightingLane, new Float32Array\(DUNGEON_LIGHT_COLOR\)\);/);
  assert.match(branch, /nearestLights\(dungeonCtx\.lights, cam\.pos, renderer\.maxPointLights, dungeonCtx\.flicker\.ranges, \(\) => _dgColor, DUNGEON_LIGHT_BLOCK_RANGE\),/);
  assert.match(branch, /\n\s*dungeonCtx\.candleLight\(\), _dgTint\(playerTorchLight\([^\n]*\)\), _dgTint\(thunderlockMuzzleLight\([^\n]*\)\), \.\.\.dungeonCtx\.campLights\(\)\.map\(_dgTint\), \.\.\.dungeonCtx\.torchLights\(\)\.map\(_dgTint\)\);/);
  assert.match(branch, /renderer\.setPointLights\(_dgLit\.data, null, _dgLit\.colors\);/);
});
