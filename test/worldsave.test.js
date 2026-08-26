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

/** The `{ ... }` block containing index `i`, matched rather than
 *  guessed at by character count. */
function braceBlock(text, i) {
  const open = text.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === '{') depth++;
    else if (text[k] === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  return text.slice(open);
}

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
  // SAVE WAVE 5.2: brace-MATCHED, like the restore half below. The
  // 1000-character window this used to be was a guess, and the wave
  // that added weaponDrawn/yaw/pitch/isCrouching (SerializablePlayer
  // .cs:175, :212-214) pushed the compensation assert out of it.
  const fn = braceBlock(s, i);
  assert.ok(fn.includes('state.worldCoords(pf)'), 'the save stores NATIVES, not local scene positions');
  assert.ok(fn.includes('pf[1] - state.compensation[1]'), 'the height sheds the vertical compensation');
  // B4: the quest+talk envelope moved into the ONE composer both hosts
  // call (the laws themselves are pinned in sessionsave.test.js) - this
  // host must still ride it, with the live bridge and the full trio
  assert.ok(fn.includes('...composeSessionState({ questBridge, talk: { mill: rumorMill, tree: topicTree, session: npcSession } })'), 'Q4-v/TK-iv via B4: quest + SaveDataConversation ride the quicksave through the composer');
  const j = s.indexOf('async function worldQuickLoad');
  // AUDIT 26: brace-MATCHED, not a fixed character count. Every wave
  // that touched this restore arm (Q4-v's quest envelope, TK-iv's
  // conversation halves, F216's enemy set, this wave's maxHealth/
  // fatigue/bundles/equip-link) pushed the tail asserts out of a
  // window that was a guess rather than a block.
  const lf = braceBlock(s, j);
  assert.ok(lf.includes('restoreSessionState(extras, { questBridge, talk: { mill: rumorMill, tree: topicTree, session: npcSession } })'), 'Q4-v via B4: the quest envelope restores through the composer');
  assert.ok(lf.includes('_questStarted = true'), 'a restored quest latches the start guard - initAtGameStart must not re-run over it');
  // SAVE WAVE S1 corrected the two below. The teleport moved INTO the
  // restore seam (world.js:restorePositionHelper, the port of
  // PlayerEnterExit.RestorePositionHelper), because DFU teleports
  // inside RespawnPlayer for all three of its arms and the port needs
  // the same one door for the dungeon arm - so the load's apply half
  // no longer carries a teleport of its own. The seam's own arms are
  // pinned, executed, in audit26_s1_restore.test.js.
  assert.ok(lf.includes('await restorePositionHelper(snap)'), 'the load respawns through the ONE seam (SaveLoadManager.cs:1476)');
  assert.ok(lf.includes('state.localFromWorld(w.nativeX, w.nativeZ)'), 'and lands at the exact native spot');
  assert.ok(lf.includes('_lastEncMinutes = Math.floor(playerTicker.classicMinutes)'), 'no encounter catch-up across a load (LoadInProgress parity)');
  // ...and this one PINNED THE BUG. It read "a dungeon-side save
  // restores the character and says so" - which is what the port did
  // and is not what DFU does: RestorePositionHelper's first arm
  // (PlayerEnterExit.cs:622-627) respawns the player INSIDE the saved
  // dungeon. The stranding message survives only for an envelope the
  // seam cannot respawn into (a pre-S1 save with no map pixel, or a
  // location with no dungeon entrance), which is DFU's own
  // "all else fails" arm at :645-654.
  assert.ok(lf.includes("restoredHost === 'dungeon'") && lf.includes('modes?.restoreDungeonScene(extras)'),
    'a dungeon-side save respawns INTO its dungeon and the saved scene is applied there');
  assert.ok(lf.includes("extras.locationKey !== 'world'"), 'and only an unrespawnable envelope is left standing outside, said out loud');
});
