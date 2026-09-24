// DISC17 (2026-09-24, Discord through Mac: "I want to fix these issues + enhance guard interaction"), each report
// reproduced in node before it was touched, fixed at its root and pinned BY EXECUTION where the seam is a function.
//   A - "leaving the game undoes your lycanthropy/vampirism" and "Playing online makes my vampire character human
//       again": the curse entry (and the infection before it) carried neither `permanent` nor a round count, so
//       every live round took an absent roundsRemaining to NaN, the save's JSON wrote the NaN as null, and the first
//       round after ANY load read `null <= 0` and dropped the entry - the spell stayed in the book and did nothing.
//   B - "Light spell does not work in dungeons": the world host's dungeon frame lit its point lights with ITS OWN
//       engine's candle, while every cast underground is the dungeon context's engine's and the world's engine is not
//       updated below ground - the candle drew as a flame and lit nothing (or stood lit at the street it was cast on).
//   C - "rested while poisoned put me into an infinite death loop ... it overwrote all my saves": the online exit
//       autosave wrote the dead, poisoned player into EVERY slot of the character, and the online load's revival ran
//       before the save's effects and survival were restored - so each slot loaded at half health with the poison
//       back on and died again. The death screen told an online player "ENTER end   F11 load", two keys that do neither.
//   F - "guards will arrest and attack me for resting within city limits but will not protect me from 5 angry centaur
//       invaders ... in town?": the resting arrest is DFU's law and stays; the five centaurs were a wilderness camp
//       pitched inside a town (its gate read the PREVIOUS pixel's location on the frame a new one is entered, and never
//       where the group lands); and, Mac's ask, THE WATCH DEFENDS THE TOWN - the port's own, behind its Features row.
//   E - "Cant enter Mannimarcos room ... even if i bash it doesnt make a sound": the throne-room door (S0000205 object
//       20251, lock 2) stands 5 cm inside the placement box of the corridor piece in front of it, which carries a
//       Collision01 DoorText record. The press and the swing both picked the nearest BOX, the relay, which refuses a
//       Direct or an Attack - so nothing answered, not even the bash sound DFU plays before any lock check.
//   D - "In a dungeon that I cant hurt enemy's": one cause found in code - the dungeon's foe subsystem lazily imported
//       the one module nothing else imports (ai/enhancedMotor.js), a lazy-only chunk a deploy deletes under an open
//       tab; the import failed, the subsystem was skipped, and every enemy stood as a flat no blow could reach.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLycanthropyCurse, liveLycanthropy, cureLycanthropy } from '../src/systems/lycanthropy.js';
import { createVampirismCurse, liveVampirism, cureVampirism } from '../src/systems/vampirism.js';
import { endDisease } from '../src/systems/diseases.js';
import { LYCANTHROPY_TYPES, VAMPIRE_CLANS, INFECTION, startInfection, liveInfection } from '../src/systems/infection.js';
import { runMagicRoundsFor, setSharedClock, alignEntityClocks, resetMagicRoundMarker, setWorldMinutes } from '../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { startPoison, POISONS } from '../src/systems/poisons.js';
import { respawnHealth } from '../src/systems/deathRespawn.js';
import { saveSlot, exitAutosaveNames, QUICK_SAVE_NAME } from '../src/systems/saveSlots.js';
import { DeathScreen, ONLINE_DEATH_HINT } from '../src/ui/deathScreen.js';
import { createTownWatch, isTownThreat, TOWN_WATCH_STAND_DOWN_SECONDS } from '../src/systems/townWatch.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { getTargets, PLAYER_TARGET, staticTeamOf } from '../src/characters/enemyTargets.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { Collider } from '../src/player/collider.js';
import { activationTargets, pickActivatableHit } from '../src/player/activate.js';
import { envAttack } from '../src/combat/weaponRig.js';
import { isStaleChunk, STALE_CHUNK_IN_PLAY_TEXT } from '../src/systems/staleChunk.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ═══ A: the curse through a load ═════════════════════════════════════════════════════════════════════════════════
const T0 = 523530 + 10 * MINUTES_PER_DAY;
const mortal = () => ({
  isPlayer: true, name: 'Mac', race: 'Nord', gender: 'male', level: 10, reflexes: 2,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 },
  items: [], activeEffects: [], spells: [], health: 100, maxHealth: 100, crimeCommitted: 0, lastGameMinutes: T0,
});
/** The slot's own path: the envelope through JSON, into a fresh entity. */
const reload = (p, minutes) => { const q = { isPlayer: true }; restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: minutes })))); return q; };
const live = (e) => liveLycanthropy(e) ?? liveVampirism(e);

test('DISC17-A: a werewolf and a vampire who have lived a round come back from a load still cursed - through the next rounds offline, and through the online arrival', () => {
  for (const make of [(p) => createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: T0 }), (p) => createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: T0 })]) {
    setWorldMinutes(T0); resetMagicRoundMarker(null);
    const p = mortal();
    const racial = make(p).racial;
    runMagicRoundsFor(p, T0, T0 + 5, {});   // the curse lives a few rounds before the save, as every real one does
    const strength = live(p).statMods.strength;
    assert.ok(strength > 0, `${racial}: the advantages are on`);
    const q = reload(p, T0 + 5);
    runMagicRoundsFor(q, T0 + 5, T0 + 8, {});
    assert.ok(live(q), `${racial}: the curse survives the first rounds after a load`);
    assert.equal(q.racialOverride, live(q));
    assert.equal(live(q).statMods.strength, strength, `${racial}: the stats are the cursed ones`);
    // online: the shared clock stands elsewhere and the arrival shifts every marker onto it
    const W = T0 + 37 * MINUTES_PER_DAY + 123;
    const o = reload(p, T0 + 5);
    setSharedClock(() => W);
    try {
      alignEntityClocks(o, W);
      runMagicRoundsFor(o, W, W + 3, {});
      assert.ok(live(o), `${racial}: and the first online rounds`);
    } finally { setSharedClock(null); resetMagicRoundMarker(null); }
  }
});

test('DISC17-A: an infection that has ticked survives a load - the bite is not cured by reloading', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const p = mortal();
  startInfection(p, INFECTION.Werewolf, { day: Math.floor(T0 / MINUTES_PER_DAY) });
  runMagicRoundsFor(p, T0, T0 + 5, {});
  const q = reload(p, T0 + 5);
  runMagicRoundsFor(q, T0 + 5, T0 + 8, {});
  assert.equal(liveInfection(q)?.infection, INFECTION.Werewolf);
  resetMagicRoundMarker(null);
});

test('DISC17-A: a save written before the fix - the curse with a null round count and no flag - gives the player the curse back', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const p = mortal();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Wereboar, { now: T0 });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: T0 })));
  const old = snap.activeEffects.find((a) => a.kind === 'racialOverride');
  delete old.permanent;
  old.roundsRemaining = null;   // what JSON made of the NaN
  const q = { isPlayer: true };
  restorePlayer(q, snap);
  runMagicRoundsFor(q, T0, T0 + 3, {});
  assert.equal(liveLycanthropy(q)?.infectionType, LYCANTHROPY_TYPES.Wereboar);
  resetMagicRoundMarker(null);
});

test('DISC17-A: in the session itself the round clock never touches a curse or an infection, and an ended one leaves the list at the next round (forcedRoundsRemaining = 0)', () => {
  const lives = [
    ['werewolf', (p) => createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: T0 }), (p) => cureLycanthropy(p, { nowMinutes: T0 + 2 })],
    ['vampire', (p) => createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: T0 }), (p) => cureVampirism(p)],
    ['infection', (p) => startInfection(p, INFECTION.Vampirism, { day: Math.floor(T0 / MINUTES_PER_DAY) }), (p) => { endDisease(liveInfection(p)); return true; }],
  ];
  for (const [what, make, end] of lives) {
    setWorldMinutes(T0); resetMagicRoundMarker(null);
    const p = mortal();
    const entry = make(p);
    runMagicRoundsFor(p, T0, T0 + 2, {});
    assert.equal(Number.isNaN(entry.roundsRemaining), false, `${what}: no round count ever counted down to NaN - the seed of the load's loss`);
    assert.equal(p.activeEffects.includes(entry), true, `${what}: alive while it lasts`);
    assert.equal(end(p), true);
    runMagicRoundsFor(p, T0 + 2, T0 + 3, {});
    assert.equal(p.activeEffects.includes(entry), false, `${what}: ended, it leaves the list as DFU's bundle does`);
  }
  resetMagicRoundMarker(null);
});

// ═══ B: the Light spell underground ═══════════════════════════════════════════════════════════════════════════════
test('DISC17-B: the world host\'s dungeon frame lights the DUNGEON engine\'s candle - the engine every cast down there goes through - and never its own', () => {
  const src = rd('src/scenes/worldModes.js');
  const at = src.indexOf("if (mode === 'dungeon') {\n      if (pendingDungeonExit)");   // the frame's own branch, not the one-line dispatches
  const branch = src.slice(at, src.indexOf('\n    }\n', at));
  assert.ok(at > 0 && branch.includes('dungeonCtx.drawFoes('), 'the branch was found whole');
  const lights = branch.slice(branch.indexOf('withPlayerLights('));
  assert.match(lights.slice(0, lights.indexOf('renderer.setClearColor')), /^withPlayerLights\(nearestLights\([^\n]*\n\s*dungeonCtx\.candleLight\(\), playerTorchLight\(/);
  assert.ok(!branch.includes('magic?.candleLight()') && !branch.includes('magic.candleLight()'), 'this host\'s own engine is not updated underground');
  assert.ok(!/\bmagic\??\.update\(/.test(branch), 'and nothing here updates it - so its candle is never the dungeon\'s');
  assert.match(rd('src/scenes/dungeonContext.js'), /candleLight: \(\) => magic\.candleLight\(\),/, 'the context hands out its own engine\'s candle');
});

// ═══ C: the death loop ═══════════════════════════════════════════════════════════════════════════════════════════
const withSearch = (search, fn) => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search, pathname: '/' }, configurable: true, writable: true });
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
};
/** A slot store with the enumeration surface the slot module walks. */
const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
};
/** The corpse the exit autosave wrote: dead, the poison that did it still on, soaked and frozen. */
const corpse = () => {
  const p = mortal();
  startPoison(p, POISONS.Arsenic, T0, () => 0.5);
  p.survival = { exposure: 600, wet: 300 };
  p.health = 0;
  return p;
};

test('DISC17-C: an online load of a dead save revives the SAVE\'s player - its poison and its exposure ended - and it stays alive', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(corpse(), { classicMinutes: T0 })));
  const q = { isPlayer: true };
  withSearch('?online=1&load=1', () => assert.ok(restorePlayer(q, snap)));
  assert.equal(q.health, respawnHealth(100));
  assert.deepEqual(q.activeEffects.filter((a) => a.kind === 'poison'), [], 'the poison that killed them is not loaded back on');
  assert.deepEqual([q.survival.exposure, q.survival.wet], [0, 0], 'nor the cold');
  let hurt = 0;
  runMagicRoundsFor(q, T0, T0 + 60, { sinks: { hurt: (n) => { hurt += n; q.health -= n; } } });
  assert.equal(hurt, 0, 'an hour on, nothing has taken a point');
  assert.ok(q.health > 0);
  resetMagicRoundMarker(null);
});

test('DISC17-C: the online exit autosave writes every slot of a living player and NO slot of a dead one or under a death screen', () => {
  const storage = memStorage();
  const p = mortal();
  for (const name of [QUICK_SAVE_NAME, 'Backup', 'Before online']) saveSlot(p.name, name, snapshotPlayer(p, { classicMinutes: T0 }), { storage });
  assert.deepEqual(exitAutosaveNames(p, { storage }).sort(), ['Backup', 'Before online', QUICK_SAVE_NAME].sort(), 'alive: every slot, as ONLINE-AUTOSAVE1 was asked');
  assert.deepEqual(exitAutosaveNames(p, { storage, deathUp: true }), [], 'the death screen is up: none');
  assert.deepEqual(exitAutosaveNames({ ...p, health: 0 }, { storage }), [], 'dead: none');
  // and the handler writes only through that answer, with every host's death read
  const w = rd('src/scenes/world.js');
  const at = w.indexOf("addEventListener('beforeunload', () => {\n    if (!online || !playerSpawned) return;");
  const handler = w.slice(at, w.indexOf('\n  });', at));
  assert.ok(at > 0, 'the online exit autosave was found');
  assert.match(handler, /for \(const saveName of exitAutosaveNames\(playerEntity, \{ deathUp: townTalk\.overlay instanceof DeathScreen \|\| !!modes\?\.deathUp\?\.\(\) \}\)\) save\(saveName\);/);
  assert.ok(!handler.includes('saveKeysOfCharacter('), 'no second list of slots beside the guarded one');
});

test('DISC17-C: an online page\'s death screen says its respawn; offline keeps the full hint', () => {
  withSearch('?online=1&load=1', () => assert.equal(new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8 }).hint, ONLINE_DEATH_HINT));
  withSearch('?load=1', () => assert.equal(new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8 }).hint, 'ENTER end   F11 load'));
});

// ═══ F: the watch and the town ════════════════════════════════════════════════════════════════════════════════════
const TOWN = { enabled: true, playerInTown: true, crime: false, threats: 1, defenders: 0, locationKey: '3,12' };

test('DISC17-F: the watch comes to a monster hunting the player in town after the witnessed-crime countdown, not for a wanted player, not after the player left - and walks away when the town is quiet', () => {
  const w = createTownWatch({ rand: () => 0.5 });   // Random.Range(5, 11) -> 8
  let t = 0, act = w.tick(0, TOWN);
  while (!act && t < 30) { act = w.tick(0.25, TOWN); t += 0.25; }
  assert.equal(act, 'summon');
  assert.equal(t, 8, 'the witnessed-crime arrival, to the second');
  assert.equal(w.tick(0.25, { ...TOWN, defenders: 3 }), null, 'standing defenders are not summoned twice');
  const gone = createTownWatch({ rand: () => 0 });
  gone.tick(0, TOWN);
  assert.equal(gone.tick(6, { ...TOWN, locationKey: '4,12' }), null, 'the player left inside the window: nobody comes (PlayerEntity.cs:355-359)');
  const wanted = createTownWatch({ rand: () => 0 });
  for (let i = 0; i < 40; i++) assert.equal(wanted.tick(0.5, { ...TOWN, crime: true }), null, 'a wanted player gets the ordinary watch, never defenders');
  const quiet = createTownWatch();
  assert.equal(quiet.tick(TOWN_WATCH_STAND_DOWN_SECONDS - 1, { ...TOWN, threats: 0, defenders: 3 }), null);
  assert.equal(quiet.tick(1.01, { ...TOWN, threats: 0, defenders: 3 }), 'dismiss', 'ten quiet seconds and they walk away');
  assert.equal(createTownWatch().tick(0.1, { ...TOWN, enabled: false, defenders: 2 }), 'dismiss', 'the switch off sends them home');
  assert.equal(createTownWatch().tick(0.1, { ...TOWN, playerInTown: false, defenders: 2 }), 'dismiss', 'so does leaving the town');
});

test('DISC17-F: a threat is a live hostile foe of this client HUNTING a player inside the town rect - never a puppet, a quest foe, a pacified or allied one, or one minding its own business', () => {
  const hunter = () => ({ ai: { isHostile: true, target: PLAYER_TARGET, feet: [1, 0, 1] }, entity: { team: 'Centaurs' } });
  const inside = () => true;
  assert.equal(isTownThreat(hunter(), { inTownRect: inside }), true);
  assert.equal(isTownThreat(hunter(), { inTownRect: () => false }), false, 'outside the rect');
  for (const [why, patch] of [['a peer\'s puppet', { puppet: {} }], ['a quest foe', { isQuestFoe: true }], ['dead', { dead: true }]]) {
    assert.equal(isTownThreat({ ...hunter(), ...patch }, { inTownRect: inside }), false, why);
  }
  const calm = hunter(); calm.ai.isHostile = false;
  assert.equal(isTownThreat(calm, { inTownRect: inside }), false, 'pacified');
  const ally = hunter(); ally.entity.team = 'PlayerAlly';
  assert.equal(isTownThreat(ally, { inTownRect: inside }), false, 'the player\'s own summon');
  const idle = hunter(); idle.ai.target = null;
  assert.equal(isTownThreat(idle, { inTownRect: inside }), false, 'a rat minding its own business');
});

// the watch1 rig: a synthetic CLASS18.CFG and MONSTER.BSA, a flat open world
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
const rig = (playerEntity) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },   // a flat open world the watch can walk
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});
const FEET0 = [0, 0, 0], EYE0 = [0, 1.6, 0], FWD0 = [0, 0, 1];

test('DISC17-F: the defenders come as the player\'s allies, sent at the monster - DFU\'s own target chain never picks the player - outlive the crime-clear walk-away, are not saved, turn into the watch at a crime, and walk away with no body', async () => {
  const p = townsman();
  const guards = createCityGuards(rig(p));
  const monsters = createExteriorFoes(rig(p));
  const centaur = await monsters.spawnFoe(0, [8, 0, 8], { feetGiven: true });
  centaur.ai.target = PLAYER_TARGET;
  let disabled = 0;
  const came = await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [{ pos: [3, 0, 3], fwdYaw: 0, guard: true, disable: () => { disabled++; } }], threats: [centaur] });
  assert.equal(came, 1, 'the wandering guard near the player answers first');
  assert.equal(disabled, 1, 'and the NPC he was is disabled');
  const g = guards.guards[0];
  assert.equal(g.defender, true);
  assert.deepEqual([g.entity.team, g.entity.mobileTeam], ['PlayerAlly', 'PlayerAlly'], 'both per-instance teams, the allied summon\'s shape');
  assert.equal(g.ai.target, centaur, 'sent at the threat');
  assert.equal(getTargets(g, [centaur], FEET0).target, centaur, 'GetTargets picks the monster');
  assert.equal(getTargets(g, [], FEET0).target, null, 'and never the player, even with nothing else to pick');
  guards.update(0.016, FEET0, EYE0, {});
  assert.equal(g.dead, false, 'no crime is standing, and the defender does not walk away with the crime watch');
  assert.deepEqual(guards.snapshotWorld((f) => ({ x: f[0], z: f[2] })), [], 'a defender is not saved');
  p.crimeCommitted = 4;   // Assault
  guards.update(0.016, FEET0, EYE0, {});
  assert.equal(g.defender, false, 'a crime makes him the watch');
  assert.deepEqual([g.entity.team, g.entity.mobileTeam], [staticTeamOf(GUARD_MOBILE_TYPE), staticTeamOf(GUARD_MOBILE_TYPE)]);
  assert.equal(getTargets(g, [], FEET0).target, PLAYER_TARGET, 'and the watch hunts the criminal');
  p.crimeCommitted = 0;
  guards.update(0.016, FEET0, EYE0, {});
  assert.equal(g.dead, true, 'as the watch, he walks away when the crime clears');
  await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [{ pos: [2, 0, 2], fwdYaw: 0, guard: true, disable: () => {} }], threats: [centaur] });
  const d = guards.guards.find((x) => !x.dead);
  assert.equal(guards.defenderCount(), 1);
  assert.equal(guards.dismissDefenders(), 1);
  assert.equal(d.dead, true);
  assert.ok(!d.corpse, 'walked away: no body, nothing to loot');
});

test('DISC17-F: the player\'s swing spares a defender while the monsters\' pool has not been offered it - and strikes him only when he is all that is in front', async () => {
  const p = townsman();
  const guards = createCityGuards(rig(p));
  const monsters = createExteriorFoes(rig(p));
  const centaur = await monsters.spawnFoe(0, [9, 0, 9], { feetGiven: true });
  centaur.ai.target = PLAYER_TARGET;
  await guards.summonDefenders({ playerFeet: FEET0, playerFwd: FWD0, pool: [{ pos: [0, 0, 1.2], fwdYaw: Math.PI, guard: true, disable: () => {} }], threats: [centaur] });
  const d = guards.guards[0];
  d.entity.health = 10000;
  const swing = new PlayerWeapon({});
  assert.equal(guards.resolvePlayerHit(swing, EYE0, FWD0, FEET0, () => true, null, { spareDefenders: true }), false, 'the watch\'s pass leaves him for last');
  assert.equal(d.entity.health, 10000);
  assert.equal(guards.resolvePlayerHit(swing, EYE0, FWD0, FEET0, () => true, null, { defendersOnly: true }), true, 'with nothing else in front, the swing reaches him (friendly protection\'s fallback)');
});

test('DISC17-F by source: the host runs the town watch after the pools move, resolves the swing watch -> monsters -> defenders -> townsfolk, and keeps camps out of every location\'s rect', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /exteriorFoes\.update\(dt, _pf, cam\.pos, _foeSenses\(\)\);[^\n]*\n\s*livePersonBatches\.push\(\.\.\.exteriorFoes\.batches\(\)\);\n\s*if \(playerSpawned\) _townWatchFrame\(dt\);/);
  assert.match(w, /enabled: getPref\('townWatch'\) !== false && !isTransformedLycanthrope\(playerEntity\),\n\s*playerInTown: inTown, crime: !!playerEntity\.crimeCommitted,/);
  const swingAt = w.indexOf("guardHitSound, { spareDefenders: true })) {");
  const order = ['guardHitSound, { spareDefenders: true })) {', 'if (exteriorFoes.resolvePlayerHit(', "guardHitSound, { defendersOnly: true }))", 'cityGuards.resolveCivilianHit('].map((k) => w.indexOf(k, swingAt));
  assert.ok(swingAt > 0 && order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), `the four passes in order: ${order}`);
  assert.match(w, /inside: false, inLocationRect: _inAnyLocationRect\(walkMode \? player\.pos : cam\.pos\),/, 'the chunk roll asks the pixel just entered');
  assert.match(w, /anchor = placeFoeFreely\(anchorEnv, [^\n]*\n\s*if \(anchor && _inAnyLocationRect\(\[anchor\.x, anchor\.y, anchor\.z\]\)\) anchor = null;/, 'the camp is never pitched in a town');
  assert.match(w, /spot = placeFoeFreely\(memberEnv, [^\n]*\n\s*if \(spot && _inAnyLocationRect\(\[spot\.x, spot\.y, spot\.z\]\)\) spot = null;/, 'nor a member over its line');
  assert.match(w, /const loc = locationIndex\.get\(`\$\{px\.x \+ dx\},\$\{px\.y \+ dy\}`\);\n\s*if \(loc\?\.exterior\?\.exteriorData && isInLocationRect\(wc\.x, wc\.z, locationWorldRect\(loc, px\.x \+ dx, px\.y \+ dy\)\)\) return true;/, 'every location\'s widened rect, the pixel and its neighbours');
});

// ═══ E: the King of Worms' door ═══════════════════════════════════════════════════════════════════════════════════
/** An axis-aligned box as twelve triangles. */
function boxMesh(min, max) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const f = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: new Float32Array(p), indices: new Uint32Array(f) };
}
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** S0000205 as the data has it: the door (object 20251, model 55000, lock 2, DoorText idx 72, trigger None) at
 *  x 0.05..0.20, 5 cm inside the placement box (x 0..6.4) of the corridor piece in front (object 15785, model
 *  63107, DoorText on Collision01), whose walls ride the static bucket - here one side wall, off the doorway. */
function scourgBarrow() {
  const collider = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider, { rolls: () => 0 });
  const door = actions.addDoor(boxMesh([0.05, 12.825, 34.6], [0.2, 15.025, 35.8]), IDENTITY, {
    ns: 0, positionKey: 20251, startingLockValue: 2,
    action: { actionFlag: ACTION_FLAGS.DoorText, triggerFlag: TRIGGER_FLAGS.None, index: 72, nextObject: -1, duration: 0, magnitude: 0, axisRaw: 5 },
  });
  const wall = boxMesh([0, 12.8, 33.0], [6.4, 15.95, 33.2]);
  collider.addMesh('dungeon', wall.positions, wall.indices, IDENTITY);
  const relay = actions.addRelay(0, 15785, { actionFlag: ACTION_FLAGS.DoorText, triggerFlag: TRIGGER_FLAGS.Collision01, index: 0, nextObject: -1, axisRaw: 5 },
    { min: [0, 12.8, 33.0], max: [6.4, 15.95, 37.4] }, [4.8, 12.8, 33.6], 63107);
  return { actions, collider, door, relay };
}
const T_CORRIDOR = [-2, 14.425, 35.2], EAST = [1, 0, 0];

test('DISC17-E: the press from the T-corridor reaches the King of Worms\' door - its lock speaks - not the corridor\'s walk-on record', () => {
  const { actions, collider, door } = scourgBarrow();
  const hit = pickActivatableHit(T_CORRIDOR, EAST, activationTargets(actions.objects), collider);
  assert.equal(hit?.key, door.key);
  const locks = [];
  actions.onLockedDoor = (o) => locks.push(o.currentLockValue);
  actions.activate(hit.key);
  assert.deepEqual(locks, [2], 'lock 2: pickable, openable by spell, bashable');
});

test('DISC17-E: the swing reaches AttemptBash on that door, and its sound', () => {
  const { actions, collider, door } = scourgBarrow();
  const bashed = [];
  actions.onDoorBash = (o) => bashed.push(o.key);
  assert.equal(envAttack(actions, collider, T_CORRIDOR, EAST, () => 0.5), true);
  assert.deepEqual(bashed, [door.key]);
});

test('DISC17-E: the corridor piece still owns what its own geometry meets - a ray whose first surface is the static wall inside its box picks the record, as before', () => {
  const { actions, collider, relay } = scourgBarrow();
  const hit = pickActivatableHit([3, 14, 38], [0, 0, -1], activationTargets(actions.objects), collider);
  assert.equal(hit?.key, relay.key, 'the static bucket names nobody - the box decides, as it always did');
});

// ═══ D: the enemies no blow could reach ═══════════════════════════════════════════════════════════════════════════
const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
/** Every module some file under src/ imports STATICALLY - a chunk the page has already fetched when anything asks. */
function staticallyImported() {
  const out = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.js')) continue;
      for (const m of readFileSync(p, 'utf8').matchAll(/^(?:import|export)\s[^;]*?\sfrom\s'(\.[^']+)'/gm)) out.add(resolve(dirname(p), m[1]));
    }
  };
  walk(SRC_ROOT);
  return out;
}

test('DISC17-D: every module the dungeon\'s foe subsystem loads lazily is one the page already holds - no chunk there is lazy-only, so no deploy can delete it under an open tab', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  const at = dc.indexOf('if (opts.foes && palette) {');
  const block = dc.slice(at, dc.indexOf('} catch (err) {', at));
  const lazy = [...block.matchAll(/import\('(\.[^']+)'\)/g)].map((m) => resolve(SRC_ROOT, 'scenes', m[1]));
  assert.ok(at > 0 && lazy.length >= 8, `the foe block's lazy imports were found (${lazy.length})`);
  const held = staticallyImported();
  const lazyOnly = lazy.filter((p) => !held.has(p)).map((p) => p.slice(SRC_ROOT.length + 1));
  assert.deepEqual(lazyOnly, [], 'a lazy-only chunk in the foe block is a dungeon of flats after the next deploy');
  assert.ok(held.has(resolve(SRC_ROOT, 'ai/enhancedMotor.js')), 'the enhanced motor is imported statically');
});

test('DISC17-D: a chunk gone mid-session is said on the screen, not swallowed - and the log names what really failed', () => {
  assert.equal(isStaleChunk(new TypeError('Failed to fetch dynamically imported module: https://daggerfalljs.dev/play/assets/enhancedMotor-CPTnjkkD.js')), true);
  assert.match(STALE_CHUNK_IN_PLAY_TEXT, /Reload the page/);
  const dc = rd('src/scenes/dungeonContext.js');
  const c = dc.slice(dc.indexOf('} catch (err) {', dc.indexOf('if (opts.foes && palette) {')));
  assert.match(c.slice(0, 900), /if \(isStaleChunk\(err\)\) setMidScreenText\(STALE_CHUNK_IN_PLAY_TEXT\);/);
  assert.match(c.slice(0, 900), /the dungeon builds with no live enemies/);
});
