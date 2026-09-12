// MAC6 (Mac, 2026-09-12: "A bug. 1. When playing online it doesnt place
// you where you last saved your account"). #1: THE DUNGEON SAVE COMES
// HOME. A save taken inside a world-hosted dungeon is the dungeon
// host's own envelope - keyed dungeon:<id>, a dungeon-local position,
// no map pixel - and the world host's boot load (the Load door and the
// Online door alike) answered it with "(saved elsewhere - character
// restored; travel there yourself)" and left the player at the start
// cell. DFU's load respawns at the save's own map pixel and re-enters
// the dungeon BEFORE it restores the position - RespawnPlayer's
// insideDungeon arm (PlayerEnterExit.cs:534-537: TeleportToCoordinates,
// GetLocation, StartDungeonInterior) then RestorePosition
// (SerializablePlayer.cs:441-454) - off worldPosX/worldPosZ saved
// beside insideDungeon (:215-217). THE ARM EXECUTES: the envelope
// carries `dungeon` (the pixel and map id) and hands it back; a save
// from before it did is found by its id across the locations; the
// dungeon host's load arm is split so the world host can hand it an
// envelope it already restored, without a second session restore; the
// mode machine forwards with the key route's own position applier;
// the boot's load arm teleports, enters, and restores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snapshotPlayer, restorePlayer, dungeonPixelFor } from '../src/systems/save.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const mkEntity = () => ({
  name: 'Mac', gender: 'female', careerIndex: 4, level: 3, reflexes: 2,
  health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
  startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120,
  readyToLevelUp: false, pendingLevel: null, chargenDone: true,
  stats: { strength: 55, luck: 60 },
  skills: [30, 28], skillUses: [100, 0],
  career: { name: 'Healer', hitPointsPerLevel: 8 },
  items: [], spells: [], activeEffects: [],
});

test('MAC6 #1: the envelope carries where the dungeon stands - `dungeon` {pixel, mapId} rides snapshotPlayer beside the interior half and comes back out of restorePlayer; a save from before it reads null; the finder resolves an old save by its dungeon id across the locations, through the host\'s pixel law, and answers null for anything else', () => {
  const dungeon = { pixel: { x: 109, y: 158 }, mapId: 187 };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), { position: [1, 2, 3], locationKey: 'dungeon:1234', dungeon })));
  assert.deepEqual(snap.dungeon, dungeon, 'PlayerPositionData_v1.worldPosX/worldPosZ beside insideDungeon (SerializablePlayer.cs:215-217)');
  const extras = restorePlayer(mkEntity(), snap, null);
  assert.deepEqual(extras.dungeon, dungeon, 'and the boot load reads it back');
  assert.equal(extras.locationKey, 'dungeon:1234');
  const old = JSON.parse(JSON.stringify(snap)); delete old.dungeon;
  assert.equal(restorePlayer(mkEntity(), old, null).dungeon, null, 'a save from before the field: null, never undefined');
  assert.equal(snapshotPlayer(mkEntity(), { locationKey: 'world' }).dungeon, null, 'anywhere but a dungeon: null');
  // the finder, for the old save: the dungeon's own record id, the host's pixel law injected
  const loc = (id, longitude, latitude, hasDungeon = true) => ({ hasDungeon, dungeon: { recordElement: { header: { locationId: id } } }, mapTableData: { longitude, latitude } });
  const toPixel = (mt) => ({ x: mt.longitude, y: mt.latitude });
  const locations = [loc(7, 1, 2), loc(1234, 5, 6, false), { hasDungeon: true, dungeon: null, mapTableData: { longitude: 0, latitude: 0 } }, { ...loc(1234, 3, 4), mapTableData: null }, loc(1234, 109, 158)];   // AUDIT WORLD D5: the decoys sit BEFORE the match, so every guard is walked
  assert.deepEqual(dungeonPixelFor('dungeon:1234', locations, toPixel), { x: 109, y: 158 }, 'found by id, a location with no dungeon skipped');
  assert.equal(dungeonPixelFor('dungeon:99', locations, toPixel), null, 'no such dungeon');
  assert.equal(dungeonPixelFor('world', locations, toPixel), null, 'not a dungeon key');
  assert.equal(dungeonPixelFor('dungeon:probe', locations, toPixel), null, 'the probe\'s key names no id');
  assert.equal(dungeonPixelFor(null, locations, toPixel), null);
  assert.equal(dungeonPixelFor('dungeon:1234', null, toPixel), null, 'no locations to walk');
  let walked = 0;
  const lazy = { *[Symbol.iterator]() { walked++; yield loc(1234, 3, 4); walked++; yield loc(5, 9, 9); } };
  assert.deepEqual(dungeonPixelFor('dungeon:1234', lazy, toPixel), { x: 3, y: 4 });
  assert.equal(walked, 1, 'any iterable, and the walk stops at the first match');
});

test('MAC6 #1: the hosts by source - the dungeon host\'s composer names its pixel and its load arm is split (restoreSaved after restorePlayer, the session restore gated); the mode machine forwards a restored envelope to its dungeon with the key route\'s own position applier and no second session restore; the world host\'s boot load teleports to the save\'s pixel (the envelope\'s, or the finder\'s for an old one), enters through StartDungeonInterior and restores over the enter marker; "saved elsewhere" is what is left', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /import \{ longitudeLatitudeToMapPixel \} from '\.\.\/formats\/mapsFile\.js';/, 'the pixel law, MapsFile\'s own');
  assert.match(d, /const dungeonHome = \(\) => \{\s*const mt = dfLocation\?\.mapTableData;\s*if \(!mt \|\| !Number\.isFinite\(mt\.longitude\) \|\| !Number\.isFinite\(mt\.latitude\)\) return null;\s*const p = longitudeLatitudeToMapPixel\(mt\.longitude, mt\.latitude\);\s*return \{ pixel: \{ x: p\.x, y: p\.y \}, mapId: mt\.mapId \?\? null \};/, 'where the dungeon stands, from its own map row');
  assert.match(d, /locationKey: _locationKey,(?:\s*\/\/[^\n]*\n)*\s*dungeon: dungeonHome\(\),/, 'the composer carries it beside the key');
  assert.match(d, /quickLoad\(setPlayerPos, key = null\) \{[\s\S]*?const extras = restorePlayer\(playerEntity, snap, spellsByIndex\);[\s\S]*?this\.restoreSaved\(extras, setPlayerPos\);\s*\},/, 'the key route\'s load is restorePlayer then the second half');
  assert.match(d, /restoreSaved\(extras, setPlayerPos, \{ session = true, announce = session \} = \{\}\) \{/, 'the second half on its own, the session restore a switch');
  assert.match(d, /if \(session && restoreSessionState\(extras, \{ questBridge: opts\.questBridge, talk: opts\.talkSave, entity: playerEntity \}\)\) opts\.onQuestRestored\?\.\(\);/, 'gated: the world host restored the machines before it teleported');
  assert.match(d, /if \(extras\.position && extras\.locationKey === _locationKey && setPlayerPos\) setPlayerPos\(extras\.position\);/, 'the saved position lands through the applier - RestorePosition');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /restoreDungeonSave\(extras\) \{\s*if \(mode !== 'dungeon' \|\| !dungeonCtx\) return false;\s*dungeonCtx\.restoreSaved\(extras, \(p\) => player\.spawn\(p\[0\], p\[1\], p\[2\]\), \{ session: false \}\);\s*return true;\s*\},/, 'the mode machine forwards with the key route\'s applier and no second session restore');
  assert.match(m, /routeKey\(e, dungeonCtx, \(p\) => player\.spawn\(p\[0\], p\[1\], p\[2\]\), keys\)/, 'the same applier the key route hands the context');
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ [^}]*restoreSessionState, dungeonPixelFor \} from '\.\.\/systems\/save\.js';/);
  assert.match(w, /\} else if \(String\(extras\.locationKey \?\? ''\)\.startsWith\('dungeon:'\)\) \{/, 'the dungeon arm, before "saved elsewhere"');
  assert.match(w, /const pixel = extras\.dungeon\?\.pixel \?\? dungeonPixelFor\(extras\.locationKey, locationIndex\.values\(\), \(mt\) => longitudeLatitudeToMapPixel\(mt\.longitude, mt\.latitude\)\);/, 'the envelope\'s pixel, or the finder\'s for a save from before it');
  assert.match(w, /await _teleportToPixel\(pixel\.x, pixel\.y, null, \{ modEvent: 'load' \}\);[^\n]*\n\s*const entered = await \(modes\?\.startInDungeon\?\.\(\) \?\? false\);[^\n]*\n\s*if \(entered\) \{ playerSpawned = true; modes\?\.restoreDungeonSave\?\.\(extras\); \}/, 'TeleportToCoordinates, StartDungeonInterior, RestorePosition - DFU\'s order');
  assert.match(w, /else townTalk\.say\('\(the dungeon has no entrance here - character restored at its door\)'\);/, 'never silent when the entrance is not found');
  assert.match(w, /if \(!pixel\) townTalk\.say\('\(saved in a dungeon this world cannot find - character restored; travel there yourself\)'\);/);
  assert.match(w, /\} else if \(extras\.locationKey && extras\.locationKey !== 'world'\) \{\s*townTalk\.say\('\(saved elsewhere - character restored; travel there yourself\)'\);/, 'what is left: a save from another host');
  const worldArm = w.indexOf("if (extras.locationKey === 'world' && extras.world?.pixel) {");
  const dungeonArm = w.indexOf("startsWith('dungeon:')) {");
  const elsewhere = w.indexOf("'(saved elsewhere - character restored; travel there yourself)'");
  assert.ok(worldArm > 0 && worldArm < dungeonArm && dungeonArm < elsewhere, 'the arms in that order');
});
