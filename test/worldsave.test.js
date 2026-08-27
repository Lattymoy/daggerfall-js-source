// P-slice: the ABOVE-GROUND QUICKSAVE. The envelope is the dungeon's
// snapshotPlayer; the world half stores the map pixel + NATIVE world
// coordinates so a save survives every floating-origin recenter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('worldsave: the envelope round-trips the world half and the streamer inverts natives exactly', () => {
  const entity = {
    name: 'T', level: 3, health: 20, maxHealth: 30, fatigue: 100, magicka: 10, maxMagicka: 40,
    stats: { strength: 50 }, skills: new Array(35).fill(20), items: [], spells: [],
  };
  const snap = snapshotPlayer(entity, {
    classicMinutes: 999999, readiedSpellIndex: 7, locationKey: 'world',
    world: { pixel: { x: 207, y: 213 }, nativeX: 6789012, nativeZ: 9372160, y: 379.1 },
  });
  const restored = { stats: {}, skills: [], items: [] };
  const extras = restorePlayer(restored, JSON.parse(JSON.stringify(snap)), null);
  assert.ok(extras, 'the version round-trips');
  assert.equal(extras.classicMinutes, 999999);
  assert.equal(extras.readiedSpellIndex, 7);
  assert.equal(extras.locationKey, 'world');
  assert.deepEqual(extras.world.pixel, { x: 207, y: 213 });
  assert.equal(extras.world.nativeX, 6789012);
  assert.equal(extras.world.y, 379.1);
  // the streamer's native inverse: worldCoords(localFromWorld(n)) === n,
  // under a re-origined state (the load teleports first)
  const st = new StreamingWorldState();
  st.init(207, 213);
  const [lx, lz] = st.localFromWorld(extras.world.nativeX, extras.world.nativeZ);
  const back = st.worldCoords([lx, 0, lz]);
  assert.ok(Math.abs(back.x - extras.world.nativeX) < 1e-6 && Math.abs(back.z - extras.world.nativeZ) < 1e-6,
    'localFromWorld is the exact inverse of worldCoords');
  // ...and under a RECENTERED state (nonzero compensation) - the whole
  // point of storing natives is surviving the floating origin
  st.compensation = [819.2, 3, -819.2];
  const [cx, cz] = st.localFromWorld(extras.world.nativeX, extras.world.nativeZ);
  const cback = st.worldCoords([cx, 0, cz]);
  assert.ok(Math.abs(cback.x - extras.world.nativeX) < 1e-6 && Math.abs(cback.z - extras.world.nativeZ) < 1e-6,
    'the inverse holds through compensation');
});

test('worldsave: the world host wires F9/F11 with the native envelope and the load-time guards', () => {
  const s = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');
  assert.ok(s.includes("act === 'QuickSave'") && s.includes('worldQuickSave()'), 'the QuickSave action saves (I2; F9 is its registry default, InputManager.SetupDefaults)');
  assert.ok(s.includes("act === 'QuickLoad'") && s.includes('worldQuickLoad()'), 'and QuickLoad loads (F11 default)');
  const i = s.indexOf('function worldQuickSave');
  const fn = s.slice(i, i + 2600);   // TK-iv widened it; AUDIT 26 F216/F222 widened it again (the pose + the foe/guard pools ride the envelope)
  assert.ok(fn.includes('state.worldCoords(pf)'), 'the save stores NATIVES, not local scene positions');
  assert.ok(fn.includes('pf[1] - state.compensation[1]'), 'the height sheds the vertical compensation');
  // AUDIT 26 F216/F217: the live pools ride the envelope in natives
  assert.ok(fn.includes('foes: exteriorFoes.snapshotWorld('), 'the encounter pool is saved');
  assert.ok(fn.includes('guards: cityGuards.snapshotWorld('), 'and the watch');
  assert.ok(fn.includes('pose: { yaw: cam.yaw, pitch: cam.pitch'), 'F222/F223/F101: the pose rides too');
  // B4: the quest+talk envelope moved into the ONE composer both hosts
  // call (the laws themselves are pinned in sessionsave.test.js) - this
  // host must still ride it, with the live bridge and the full trio
  assert.ok(fn.includes('...composeSessionState({ questBridge, talk: { mill: rumorMill, tree: topicTree, session: npcSession } })'), 'Q4-v/TK-iv via B4: quest + SaveDataConversation ride the quicksave through the composer');
  const j = s.indexOf('async function worldQuickLoad');
  const lf = s.slice(j, j + 4200);   // Q4-v widened the function (the quest envelope restore); TK-iv widened it again (the conversation halves)
  assert.ok(lf.includes('restoreSessionState(extras, { questBridge, talk: { mill: rumorMill, tree: topicTree, session: npcSession } })'), 'Q4-v via B4: the quest envelope restores through the composer');
  assert.ok(lf.includes('_questStarted = true'), 'a restored quest latches the start guard - initAtGameStart must not re-run over it');
  assert.ok(lf.includes('await _teleportToPixel(w.pixel.x, w.pixel.y)'), 'the load teleports through the travel core');
  assert.ok(lf.includes('state.localFromWorld(w.nativeX, w.nativeZ)'), 'and lands at the exact native spot');
  assert.ok(lf.includes('_lastEncMinutes = Math.floor(playerTicker.classicMinutes)'), 'no encounter catch-up across a load (LoadInProgress parity)');
  assert.ok(lf.includes('exteriorFoes.restoreWorld(w.foes,') && lf.includes('cityGuards.restoreWorld(w.guards,'),
    'F216/F217: both pools restore after the teleport, the pile law');
  assert.ok(lf.includes("extras.locationKey !== 'world'"), 'a dungeon-side save restores the character and says so');
});
