// AUDIT 39 - the save/settings group's four envelope holes.
//
//  #121 snapshotPlayer named nine options and both hosts passed twelve:
//       travelMap, escortingFaces and smallerDungeonsState were dropped
//       in silence, so every load took the null arm - escort portraits
//       cleared, travel-map filters reset, the SmallerDungeons warp dead.
//  #97  snapshotFactionRep persisted rep/flags/power alone while the
//       region sim rewrites ally1-3, enemy1-3, ruler, rulerPowerBonus
//       and rulerNameSeed (DFU's FactionData_v2 round-trips the whole
//       record).
//  #24  transportMode is SerializablePlayer.cs:179's line, saved beside
//       the boarding memory the port already took (:180) and restored at
//       :423 - the port had neither half.
//  #124 resetToDefaults dropped every override without publishing, so
//       Reset left a looping song at the old volume - the exact contract
//       the publish channel was added for.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  snapshotPlayer, restorePlayer, snapshotFactionRep, restoreFactionRep,
  FACTION_RELATION_COLUMNS,
} from '../src/systems/save.js';
import {
  setValue, resetToDefaults, onSettingChange, getString, _resetForTests,
} from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const mkEntity = () => ({
  name: 'Mac', stats: { strength: 40, endurance: 40 }, skills: [30], skillUses: [0],
  items: [], spells: [], career: null,
});

// ── #121: the three dropped options ───────────────────────────────
test('AUDIT 39 #121: travelMap, escortingFaces and smallerDungeonsState ride the envelope', () => {
  const travelMap = { filters: { dungeons: true }, popup: { speed: 1 } };
  const escortingFaces = [{ factionFaceIndex: 3 }];
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), {
    travelMap, escortingFaces, smallerDungeonsState: 2,
  })));
  assert.deepEqual(snap.travelMap, travelMap, 'TravelMapSaveData (SaveLoadManager.cs:871)');
  assert.deepEqual(snap.escortingFaces, escortingFaces, 'saveData.escortingFaces (:869)');
  assert.equal(snap.smallerDungeonsState, 2, 'PlayerPositionData_v1.smallerDungeonsState (:224)');
  const extras = restorePlayer(mkEntity(), snap, null);
  assert.deepEqual(extras.travelMap, travelMap);
  assert.deepEqual(extras.escortingFaces, escortingFaces);
  assert.equal(extras.smallerDungeonsState, 2, 'and the dungeon host can compare it against the live setting');
});

test('AUDIT 39 #121: a save from before them restores the null/0 the arms already handle', () => {
  const old = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), {})));
  delete old.travelMap; delete old.escortingFaces; delete old.smallerDungeonsState;
  const extras = restorePlayer(mkEntity(), old, null);
  assert.equal(extras.travelMap, null, 'SetTravelMapFromSaveData(null) is DFU\'s own no-block arm');
  assert.equal(extras.escortingFaces, null);
  assert.equal(extras.smallerDungeonsState, 0, 'QuestSmallerDungeonsState.NotSet - never warps');
});

test('AUDIT 39 #121: both hosts really pass all three (the options were never the problem)', () => {
  const s = read('src/systems/save.js');
  assert.match(s, /travelMap: travelMapSaveData\(\),/, 'composeSessionState composes the travel map');
  assert.match(s, /escortingFaces: getEscortFacesSaveData\(\),/);
  assert.match(read('src/scenes/dungeonContext.js'),
    /smallerDungeonsState: getBool\('Experimental', 'SmallerDungeons'\) \? 2 : 1,/);
});

// ── #97: the faction record's other mutable columns ───────────────
const mkFaction = (id) => ({
  id, rep: 0, flags: 0, power: 5,
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
  ruler: 1, rulerPowerBonus: 0, rulerNameSeed: 0,
});

test('AUDIT 39 #97: allies, enemies and the ruler survive a save (FactionData_v2 round-trips the record)', () => {
  const live = { dict: new Map([[10, mkFaction(10)], [20, mkFaction(20)]]) };
  // what the region sim writes: a war declared, an alliance ended, a
  // new ruler crowned.
  Object.assign(live.dict.get(10), { rep: 7, enemy1: 20, ally2: 30, ruler: 4, rulerPowerBonus: 42, rulerNameSeed: 0xdeadbeef });
  const snap = JSON.parse(JSON.stringify(snapshotFactionRep(live)));
  for (const k of FACTION_RELATION_COLUMNS) assert.equal(snap[k].length, 2, `${k} is a full column`);

  // a LOAD rebuilds the store from FACTION.TXT, then writes the save in
  const fresh = { dict: new Map([[10, mkFaction(10)], [20, mkFaction(20)]]) };
  assert.equal(restoreFactionRep(fresh, snap), true);
  const f = fresh.dict.get(10);
  assert.equal(f.rep, 7);
  assert.equal(f.enemy1, 20, 'the war enemy the lit WarOngoing flag needs');
  assert.equal(f.ally2, 30);
  assert.equal(f.ruler, 4);
  assert.equal(f.rulerPowerBonus, 42, 'without it the power walk collapses - the shipped file carries 0');
  assert.equal(f.rulerNameSeed, 0xdeadbeef);
});

test('AUDIT 39 #97: presence is per COLUMN - a pre-fix save leaves FACTION.TXT standing', () => {
  const store = { dict: new Map([[10, mkFaction(10)]]) };
  Object.assign(store.dict.get(10), { ally1: 99, rulerPowerBonus: 33 });
  assert.equal(restoreFactionRep(store, { ids: [10], rep: [4], flags: [1], power: [8] }), true);
  const f = store.dict.get(10);
  assert.deepEqual([f.rep, f.flags, f.power], [4, 1, 8], 'the three old columns still write');
  assert.equal(f.ally1, 99, 'and the untravelled columns are not blanked');
  assert.equal(f.rulerPowerBonus, 33);
});

// ── #24: the transport mode ───────────────────────────────────────
test('AUDIT 39 #24: the pose bag carries the mount and the ONE builder puts you back on it', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /camera: mwCamera\.state\(\), transport: player\.transportMode \}/,
    'SerializablePlayer.cs:179 beside the weapon and the camera');
  // The restore goes through setTransportModeHere, not player.setTransportMode:
  // the mount's sprite, hoof loop and ride bob re-arm only there (U53).
  assert.match(w, /if \(pose\.transport != null\) setTransportModeHere\(pose\.transport\);/);
  // presence-gated, like every other pose field - an older save and the
  // classic import (a .SAV carries no mode) leave the live mode standing.
  const apply = w.slice(w.indexOf('function applyPose'), w.indexOf('function applyPose') + 1400);
  assert.ok(apply.includes('if (!pose) return;'), 'and no pose at all is a no-op');
});

// ── #124: Reset publishes ─────────────────────────────────────────
test('AUDIT 39 #124: resetToDefaults publishes every dropped override, with the default\'s string', () => {
  _resetForTests();
  setValue('Controls', 'MusicVolume', '0.1');
  setValue('Video', 'FieldOfView', '90');
  const seen = [];
  const off = onSettingChange((section, key, str) => seen.push([section, key, str]));
  resetToDefaults();
  off();
  assert.deepEqual(seen.sort(), [['Controls', 'MusicVolume', '0.5'], ['Video', 'FieldOfView', '65']].sort(),
    'the value as stored - the default\'s string, exactly what setValue\'s drop-the-override arm publishes');
  assert.equal(getString('Controls', 'MusicVolume'), '0.5', 'and the override really went');
  _resetForTests();
});

test('AUDIT 39 #124: a listener that throws is warned and skipped, and Reset still completes', () => {
  _resetForTests();
  setValue('Controls', 'MusicVolume', '0.1');
  const off1 = onSettingChange(() => { throw new Error('bad listener'); });
  const seen = [];
  const off2 = onSettingChange((s, k) => seen.push(`${s}/${k}`));
  const warn = console.warn; console.warn = () => {};
  try { assert.doesNotThrow(() => resetToDefaults()); } finally { console.warn = warn; off1(); off2(); }
  assert.deepEqual(seen, ['Controls/MusicVolume']);
  assert.equal(getString('Controls', 'MusicVolume'), '0.5');
  _resetForTests();
});
