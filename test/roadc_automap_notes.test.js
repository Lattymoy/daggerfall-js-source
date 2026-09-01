// ROAD-C c2/S8: USER NOTES, TELEPORTER CONNECTIONS AND THE CLICK
// GESTURES.
//
// Four surfaces, each failing differently:
//
//  1. THE ID LAW. SortedListExtensions.AddNext (Automap.cs:2704-2729)
//     REUSES freed keys, so a player who deletes the middle marker of
//     three and adds a new one gets id 1 back, not id 3. Pinned over
//     the exact insert/delete sequences the C# loop walks.
//  2. THE SPAWN LAW. hit.point + hit.normal * 0.7, refused when any
//     existing marker is within a STRICT 1.0 of that spawning position
//     (:773-782) - and the refusal must burn NO id, because DFU's
//     `return` is before AddNext.
//  3. THE KEY. `"position: " + entrance.position + ", rotation: " +
//     exit.rotation` (:130-137) is the dictionary key, the GameObject
//     names AND the save key at once, so its exact bytes are the
//     contract: it must round-trip through a save, it must not
//     duplicate when the same portal is walked twice, and it must mix
//     the ENTRANCE position with the EXIT rotation.
//  4. THE GESTURES. Five of them, two gated on being inside a building
//     and three not, one falling THROUGH a failed delete into the
//     rotation pivot, and a one-second tween during which nothing else
//     is accepted at all.
//
// Plus the discipline pin the c2 risk list demands: a record saved
// BEFORE this stage restores with empty collections and is not wiped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enterDungeonAutomap, snapshotAutomap, restoreAutomap, resetAutomapStore,
  getDungeonAutomap, bindAutomapLayout, buildRevealIndex,
  sortedListAddNext, tryAddOrEditUserNote, tryRemoveUserNote, setUserNote,
  userNoteIdFromName, USER_NOTE_MARKER_PREFIX,
  NOTE_SPAWN_NORMAL_OFFSET, NOTE_MIN_DISTANCE, NOTE_MAX_CHARACTERS, NOTE_WIDTH_OVERRIDE,
  formatF1, vector3String, quaternionString, yawQuaternion,
  teleporterDictKey, recordTeleporterConnection,
  TELEPORTER_ENTRANCE_OFFSET, TELEPORTER_EXIT_OFFSET,
  revealAllAutomap, hideAllAutomap,
  automapDebugTeleportMode, toggleAutomapDebugTeleportMode,
} from '../src/systems/automap.js';
import {
  BEACON_COLOURS, BEACON_SCALES, MARKER_TEX, MARKER_TEXELS, colour32,
  PORTAL_MARKER_LOCAL_EULER, PORTAL_PARENT_YAW_OFFSET, CONNECTION_RADIUS_SCALE,
  buildDiamondModel, markerModels, automapMarkerSet,
  teleporterMarkerRows, teleporterConnectionTransform, userNoteMarkerRows,
  fromToRotationUp,
} from '../src/ui/automapMarkers.js';
import { MARKER_NAMES, hoverKeyForHit } from '../src/systems/automapPick.js';
import {
  AutomapWindow, resetAutomapWindowState, signalAutomapReset, _setAutomapArt,
  automapCameraState, automapBackground, easeInOutSine, TELEPORT_JUMP_DURATION,
} from '../src/ui/automapWindow.js';
import { AUTOMAP_STRINGS } from '../src/ui/automapText.js';
import { CHROME_RECTS } from '../src/ui/automapChrome.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { _resetForTests, setValue } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, tol = 1e-5) => Math.abs(a - b) <= tol;

const freshRecord = () => ({
  revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false,
  lastVisited: 0, blockNames: null, notes: new Map(), teleporters: new Map(),
});

// ─────────────────────────────────────────────────────────────────────
// 1. THE ID LAW
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 AddNext reuses the lowest free key - the whole point of the extension', () => {
  const m = new Map();
  assert.equal(sortedListAddNext(m, 'a'), 0, 'an empty list mints 0');
  assert.equal(sortedListAddNext(m, 'b'), 1);
  assert.equal(sortedListAddNext(m, 'c'), 2);
  // delete the MIDDLE one: the next add takes its id back, which is the
  // behaviour the extension exists for ("we want to reuse id's if list
  // items have been deleted from the list and thus the id is free")
  m.delete(1);
  assert.equal(sortedListAddNext(m, 'd'), 1);
  assert.deepEqual([...m.keys()], [0, 1, 2], 'and the list stays sorted');

  // the gap at the FRONT
  const front = new Map([[1, 'x'], [2, 'y']]);
  assert.equal(sortedListAddNext(front, 'z'), 0);

  // a gap one further in, which is the arm the loop's SECOND lookahead
  // (`if (key != Keys[counter]) break`) exists for
  const inner = new Map([[0, 'a'], [1, 'b'], [3, 'c']]);
  assert.equal(sortedListAddNext(inner, 'd'), 2);

  // a two-wide gap, and a dense list appending at the end
  assert.equal(sortedListAddNext(new Map([[0, 'a'], [3, 'b']]), 'c'), 1);
  assert.equal(sortedListAddNext(new Map([[0, 'a'], [1, 'b'], [2, 'c'], [3, 'd']]), 'e'), 4);

  // INSERTION ORDER MUST NOT MATTER - the C# reads Keys[] positionally
  // off a SortedList, so a Map built out of order has to be sorted
  // first or the answer is wrong
  const outOfOrder = new Map([[2, 'c'], [0, 'a']]);
  assert.equal(sortedListAddNext(outOfOrder, 'b'), 1);
});

test('c2/S8 the marker NAME is the id, exactly as DFU parses it back', () => {
  assert.equal(USER_NOTE_MARKER_PREFIX, 'UserNoteMarker_');
  assert.equal(MARKER_NAMES.NOTE_PREFIX, USER_NOTE_MARKER_PREFIX);
  assert.equal(userNoteIdFromName('UserNoteMarker_7'), 7);
  assert.equal(userNoteIdFromName('UserNoteMarker_0'), 0);
  assert.equal(userNoteIdFromName('BeaconPlayerPosition'), null);
  assert.equal(userNoteIdFromName(null), null);
});

// ─────────────────────────────────────────────────────────────────────
// 2. THE SPAWN LAW
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 the note spawns at hit.point + normal * 0.7', () => {
  assert.equal(NOTE_SPAWN_NORMAL_OFFSET, 0.7);
  const rec = freshRecord();
  const r = tryAddOrEditUserNote(rec, { name: null, point: [1, 2, 3], normal: [0, 1, 0] });
  assert.deepEqual(r, { action: 'add', id: 0, edit: true });
  assert.deepEqual(rec.notes.get(0).position, [1, 2.7, 3]);
  assert.equal(rec.notes.get(0).note, '', 'a fresh marker carries an EMPTY note');
  // a wall normal, so the offset is not always in y
  const r2 = tryAddOrEditUserNote(rec, { name: null, point: [20, 0, 0], normal: [-1, 0, 0] });
  assert.equal(r2.action, 'add');
  assert.deepEqual(rec.notes.get(r2.id).position, [19.3, 0, 0]);
});

test('c2/S8 the 1.0-unit refusal is STRICT, and a refusal burns no id', () => {
  assert.equal(NOTE_MIN_DISTANCE, 1.0);
  // an existing marker sits at the origin
  const rec = freshRecord();
  rec.notes.set(0, { position: [0, 0, 0], note: 'first' });

  // a spawn 0.99 away is REFUSED - and mints nothing at all, because
  // DFU's `return` is before AddNext
  const close = tryAddOrEditUserNote(rec, { name: null, point: [0.99, -0.7, 0], normal: [0, 1, 0] });
  assert.deepEqual(close, { action: 'none', id: null, edit: false });
  assert.equal(rec.notes.size, 1, 'nothing was added');
  assert.deepEqual([...rec.notes.keys()], [0], 'and no id was consumed');

  // 1.01 away is allowed...
  const far = tryAddOrEditUserNote(rec, { name: null, point: [1.01, -0.7, 0], normal: [0, 1, 0] });
  assert.equal(far.action, 'add');
  assert.equal(far.id, 1);
  // ...and so is EXACTLY 1.0, because the C# test is `< 1.0f`
  const rec2 = freshRecord();
  rec2.notes.set(0, { position: [0, 0, 0], note: '' });
  assert.equal(tryAddOrEditUserNote(rec2, { name: null, point: [1, -0.7, 0], normal: [0, 1, 0] }).action, 'add');

  // the distance is measured from the SPAWNING position, not the hit:
  // a hit 0.5 above the marker spawns 1.2 above it and is allowed,
  // where testing the raw hit point would have refused it
  const rec3 = freshRecord();
  rec3.notes.set(0, { position: [0, 0, 0], note: '' });
  assert.equal(tryAddOrEditUserNote(rec3, { name: null, point: [0, 0.5, 0], normal: [0, 1, 0] }).action, 'add');
});

test('c2/S8 hitting a marker EDITS it, and the Ctrl arm only suppresses the prompt', () => {
  const rec = freshRecord();
  rec.notes.set(3, { position: [5, 5, 5], note: 'here be trolls' });
  const edit = tryAddOrEditUserNote(rec, { name: 'UserNoteMarker_3', point: [5, 5, 5], normal: [0, 1, 0] });
  assert.deepEqual(edit, { action: 'edit', id: 3, edit: true });
  assert.equal(rec.notes.size, 1, 'editing adds nothing');
  // editing an EXISTING marker always opens the box - DFU's else arm
  // calls EditUserNote unconditionally, Ctrl or no Ctrl
  assert.equal(
    tryAddOrEditUserNote(rec, { name: 'UserNoteMarker_3' }, { editOnCreation: false }).edit, true);
  // a NEW marker with Ctrl held is created and NOT opened for editing
  const bare = tryAddOrEditUserNote(rec, { name: null, point: [50, 0, 50], normal: [0, 1, 0] }, { editOnCreation: false });
  assert.equal(bare.action, 'add');
  assert.equal(bare.edit, false, 'Ctrl skips the note prompt, the marker still lands');
});

test('c2/S8 the note text truncates at 50 characters (the TextBox limit)', () => {
  assert.equal(NOTE_MAX_CHARACTERS, 50);
  assert.equal(NOTE_WIDTH_OVERRIDE, 306);
  const rec = freshRecord();
  rec.notes.set(0, { position: [0, 0, 0], note: '' });
  assert.equal(setUserNote(rec, 0, 'x'.repeat(80)), true);
  assert.equal(rec.notes.get(0).note.length, 50);
  assert.equal(setUserNote(rec, 0, null), true);
  assert.equal(rec.notes.get(0).note, '', 'a null answer clears rather than writing "null"');
  assert.equal(setUserNote(rec, 99, 'nope'), false, 'an absent id writes nothing');
});

test('c2/S8 removing a marker answers TRUE only for a marker hit - the fallthrough depends on it', () => {
  const rec = freshRecord();
  rec.notes.set(2, { position: [0, 0, 0], note: '' });
  assert.equal(tryRemoveUserNote(rec, { name: 'BeaconPlayerPosition' }), false);
  assert.equal(tryRemoveUserNote(rec, null), false);
  assert.equal(tryRemoveUserNote(rec, { name: 'UserNoteMarker_2' }), true);
  assert.equal(rec.notes.size, 0);
  // a marker NAME whose id is no longer in the list still answers true:
  // DFU destroys the GameObject either way and returns true regardless
  assert.equal(tryRemoveUserNote(rec, { name: 'UserNoteMarker_2' }), true);
});

test('c2/S8 a note answers ITS OWN TEXT as hover, not a localized string', () => {
  // GetMouseHoverOverText's first arm (:563-567) returns the note, and
  // there is no Internal_Strings row for it - so the dispatch table must
  // NOT name it, or every marker would say the same thing
  assert.equal(hoverKeyForHit({ name: 'UserNoteMarker_4', note: 'trapped floor' }), null);
  assert.equal(AUTOMAP_STRINGS.automapPlayerMarker, 'player marker');
  assert.equal(AUTOMAP_STRINGS.youNote, 'You note: ');
});

// ─────────────────────────────────────────────────────────────────────
// 3. THE KEY
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 F1 formatting is .NET\'s, sign and all', () => {
  assert.equal(formatF1(0), '0.0');
  assert.equal(formatF1(1), '1.0');
  assert.equal(formatF1(10.25), '10.3', 'half rounds AWAY from zero');
  assert.equal(formatF1(-10.25), '-10.3', 'and away from zero on the negative side too');
  assert.equal(formatF1(-0.04), '-0.0', 'the sign survives a magnitude that rounds to zero');
  assert.equal(formatF1(0.04), '0.0');
  assert.equal(formatF1(-123.456), '-123.5');
  assert.equal(vector3String([1, -0.04, 2.55]), '(1.0, -0.0, 2.6)');
  assert.equal(quaternionString([0, 0.7071, 0, 0.7071]), '(0.0, 0.7, 0.0, 0.7)');
});

test('c2/S8 yawQuaternion is Quaternion.Euler(0, yaw, 0)', () => {
  assert.deepEqual(yawQuaternion(0).map((v) => +v.toFixed(6)), [0, 0, 0, 1]);
  assert.deepEqual(yawQuaternion(90).map((v) => +v.toFixed(4)), [0, 0.7071, 0, 0.7071]);
  assert.deepEqual(yawQuaternion(180).map((v) => +v.toFixed(6)), [0, 1, 0, 0]);
  assert.deepEqual(yawQuaternion(270).map((v) => +v.toFixed(4)), [0, 0.7071, 0, -0.7071]);
});

test('c2/S8 the dictionary key mixes the ENTRANCE position with the EXIT rotation', () => {
  // the two offsets are applied in the TeleporterTransform constructor,
  // so they are inside the key
  assert.deepEqual([...TELEPORTER_ENTRANCE_OFFSET], [0, 1.0, 0]);
  assert.deepEqual([...TELEPORTER_EXIT_OFFSET], [0, 0.2, 0]);

  const rec = freshRecord();
  const r = recordTeleporterConnection(rec, { pos: [10, 2, 20], yawDeg: 0 }, { pos: [30, 2, 40], yawDeg: 90 });
  assert.equal(r.added, true);
  assert.equal(r.key, 'position: (10.0, 3.0, 20.0), rotation: (0.0, 0.7, 0.0, 0.7)');
  const conn = rec.teleporters.get(r.key);
  assert.deepEqual(conn.entrance.pos, [10, 3, 20], 'the entrance carries +up*1.0');
  assert.deepEqual(conn.exit.pos, [30, 2.2, 40], 'the exit carries +up*0.2');

  // THE MIX IS REAL, in both directions. Same entrance, DIFFERENT exit
  // rotation -> a different key; different exit POSITION with the same
  // rotation -> the SAME key, which is the C#'s own (surprising)
  // behaviour and is what the port must reproduce.
  const rot = teleporterDictKey({ pos: [10, 3, 20] }, { yawDeg: 180 });
  assert.notEqual(rot, r.key);
  assert.equal(teleporterDictKey({ pos: [10, 3, 20] }, { yawDeg: 90 }), r.key);
  assert.equal(teleporterDictKey({ pos: [10, 3, 20] }, { yawDeg: 90 }),
    teleporterDictKey({ pos: [10, 3, 20] }, { yawDeg: 90 }));
});

test('c2/S8 walking the same portal twice records it ONCE', () => {
  const rec = freshRecord();
  const a = recordTeleporterConnection(rec, { pos: [1, 0, 2], yawDeg: 45 }, { pos: [8, 0, 9], yawDeg: 45 });
  const b = recordTeleporterConnection(rec, { pos: [1, 0, 2], yawDeg: 45 }, { pos: [8, 0, 9], yawDeg: 45 });
  assert.equal(a.added, true);
  assert.equal(b.added, false);
  assert.equal(b.key, a.key);
  assert.equal(rec.teleporters.size, 1);
  // and a re-record does not overwrite the stored connection
  assert.deepEqual(rec.teleporters.get(a.key).exit.pos, [8, 0.2, 9]);
});

test('c2/S8 the key is BYTE-STABLE across a save/restore round trip', () => {
  _resetForTests();
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('17/Privateer\'s Hold', 100);
    const { key } = recordTeleporterConnection(rec, { pos: [-3.35, 0, 42.049 ] }, { pos: [7, 0, 1], yawDeg: 33 });
    rec.notes.set(0, { position: [1, 2, 3], note: 'lever behind the pillar' });

    const snap = JSON.parse(JSON.stringify(snapshotAutomap(100)));
    resetAutomapStore();
    restoreAutomap(snap);
    const back = getDungeonAutomap('17/Privateer\'s Hold');
    assert.deepEqual([...back.teleporters.keys()], [key], 'the exact bytes came back');
    assert.deepEqual(back.teleporters.get(key).entrance.pos, [-3.35, 1, 42.049]);
    assert.equal(back.notes.get(0).note, 'lever behind the pillar');
    assert.deepEqual(back.notes.get(0).position, [1, 2, 3]);
    // and RE-recording the same portal after the load still resolves to
    // the same key, so the load did not silently duplicate the portal
    const again = recordTeleporterConnection(back, { pos: [-3.35, 0, 42.049] }, { pos: [7, 0, 1], yawDeg: 33 });
    assert.equal(again.added, false);
    assert.equal(back.teleporters.size, 1);
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('c2/S8 notes and connections ride the save envelope THROUGH the LRU prune', () => {
  _resetForTests();
  resetAutomapStore();
  try {
    setValue('Map', 'AutomapNumberOfDungeons', 2);
    const older = enterDungeonAutomap('1/Old', 10);
    older.notes.set(0, { position: [0, 0, 0], note: 'forgotten' });
    enterDungeonAutomap('2/Mid', 20);
    const live = enterDungeonAutomap('3/New', 30);
    recordTeleporterConnection(live, { pos: [0, 0, 0] }, { pos: [5, 0, 5], yawDeg: 0 });

    const snap = snapshotAutomap(30);
    // the oldest is EVICTED with its notes - that is DFU's own law and
    // it reads as data loss on purpose (the c2 risk list says so)
    assert.deepEqual(Object.keys(snap).sort(), ['2/Mid', '3/New']);
    assert.equal(snap['3/New'].teleporters.length, 1);

    resetAutomapStore();
    restoreAutomap(JSON.parse(JSON.stringify(snap)));
    assert.equal(getDungeonAutomap('1/Old'), null);
    assert.equal(getDungeonAutomap('3/New').teleporters.size, 1);
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('c2/S8 DISCIPLINE: a record saved BEFORE this stage restores with EMPTY collections and is not wiped', () => {
  resetAutomapStore();
  try {
    // exactly the envelope c2/S1 wrote - no notes, no teleporters
    const preS8 = {
      '5/Scourg Barrow': {
        revealed: ['0:12', '0:13'],
        visitedThisRun: ['0:12'],
        entranceDiscovered: true,
        lastVisited: 4321,
        blockNames: ['S0000040.RDB'],
      },
    };
    restoreAutomap(preS8);
    const rec = getDungeonAutomap('5/Scourg Barrow');
    assert.ok(rec, 'the record survived a field it has never heard of being absent');
    assert.equal(rec.revealed.size, 2, 'and its discovery is untouched');
    assert.equal(rec.entranceDiscovered, true);
    assert.equal(rec.lastVisited, 4321);
    assert.ok(rec.notes instanceof Map);
    assert.equal(rec.notes.size, 0, 'the note list is EMPTY, not undefined');
    assert.ok(rec.teleporters instanceof Map);
    assert.equal(rec.teleporters.size, 0);
    // and the empty collections are usable straight away - a restore
    // that left them null would throw on the first double click
    assert.equal(tryAddOrEditUserNote(rec, { name: null, point: [0, 0, 0], normal: [0, 1, 0] }).id, 0);
    assert.equal(recordTeleporterConnection(rec, { pos: [0, 0, 0] }, { pos: [1, 0, 1], yawDeg: 0 }).added, true);
  } finally { resetAutomapStore(); }
});

test('c2/S8 a layout that no longer matches loses the notes and portals WITH the discovery', () => {
  // RestoreStateAutomapDungeon clears both collections before it reads
  // the state (:2356-2359) and every abort arm returns before the load
  // (:2373, :2378, :2385) - so a mismatch keeps neither half.
  const rec = freshRecord();
  rec.blockNames = ['OLD00000.RDB'];
  rec.revealed.add('0:1');
  rec.notes.set(0, { position: [0, 0, 0], note: 'stale' });
  recordTeleporterConnection(rec, { pos: [0, 0, 0] }, { pos: [1, 0, 1], yawDeg: 0 });
  const model = buildRevealIndex([{
    key: '0:1', aabb: { min: [0, 0, 0], max: [1, 1, 1] },
    blockIndex: 0, blockName: 'NEW00000.RDB', elementIndex: 0, elementName: 'Models', modelIndex: 0,
  }]);
  assert.equal(bindAutomapLayout(rec, model), false);
  assert.equal(rec.revealed.size, 0);
  assert.equal(rec.notes.size, 0, 'the notes went with it');
  assert.equal(rec.teleporters.size, 0, 'and so did the portals');
});

// ─────────────────────────────────────────────────────────────────────
// 4. THE MARKER TRANSFORMS
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 the diamond is Automap.cs\'s own 24-vertex, 8-triangle listing', () => {
  const d = buildDiamondModel(MARKER_TEX.NOTE);
  assert.equal(d.positions.length / 3, 24, '24 vertices, fully de-indexed');
  assert.equal(d.indices.length / 3, 8, '8 triangles');
  assert.deepEqual([...d.indices], [...Array(24).keys()], 'triangles[] is 0..23 in order');
  // the six points the listing names
  assert.deepEqual([...d.bounds.min], [-0.5, -1, -0.5]);
  assert.deepEqual([...d.bounds.max], [0.5, 1, 0.5]);
  // the two apexes appear once per triangle - four times each
  const ys = [...d.positions].filter((_, i) => i % 3 === 1);
  assert.equal(ys.filter((y) => y === 1).length, 4, 's1 tops four triangles');
  assert.equal(ys.filter((y) => y === -1).length, 4, 's2 bottoms four');
  assert.equal(ys.filter((y) => y === 0).length, 16, 'and the ring supplies the other sixteen');
  assert.equal(d.subMeshes[0].textureArchive, 'amap');
  assert.equal(d.subMeshes[0].textureRecord, MARKER_TEX.NOTE);
});

test('c2/S8 the four new colours, and the C# byte CAST that turns them into texels', () => {
  assert.deepEqual([...BEACON_COLOURS.note], [1.0, 0.55, 0.0, 1.0]);
  assert.deepEqual([...BEACON_COLOURS.portalEntrance], [0.513, 0.4, 1.0, 1.0]);
  assert.deepEqual([...BEACON_COLOURS.portalExit], [0.355, 0.279, 0.7, 1.0]);
  assert.deepEqual([...BEACON_COLOURS.connection], [0.43, 0.34, 0.85, 1.0]);
  // (byte)(f * 255f) TRUNCATES: 0.7 -> 178, where rounding gives 179,
  // and 0.55 -> 140. Packed ABGR, alpha forced opaque.
  assert.equal(colour32([0.7, 0, 0, 1]) & 0xff, 178);
  assert.equal(colour32([0.55, 0, 0, 1]) & 0xff, 140);
  assert.equal(MARKER_TEXELS[MARKER_TEX.NOTE], 0xff008cff, 'orange (255,140,0)');
  assert.equal(MARKER_TEXELS[MARKER_TEX.PORTAL_ENTRANCE], 0xffff6682);
  assert.equal(MARKER_TEXELS[MARKER_TEX.PORTAL_EXIT], 0xffb2475a);
  assert.equal(MARKER_TEXELS[MARKER_TEX.CONNECTION], 0xffd8566d);
  for (const record of Object.values(MARKER_TEX)) {
    assert.equal(MARKER_TEXELS[record] >>> 24, 0xff, `${record} draws opaque`);
  }
});

test('c2/S8 BOTH portal ends take the ENTRANCE\'s rotation, yawed +90', () => {
  assert.deepEqual([...PORTAL_MARKER_LOCAL_EULER], [0, 90, 90]);
  assert.equal(PORTAL_PARENT_YAW_OFFSET, 90);
  assert.deepEqual([...BEACON_SCALES.portal], [2.0, 0.1, 1.0]);

  const conn = {
    entrance: { pos: [10, 3, 20], yawDeg: 0 },
    exit: { pos: [30, 2.2, 40], yawDeg: 123 },   // deliberately NOT the entrance's
  };
  const rows = teleporterMarkerRows('K', conn);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.portal), ['entrance', 'exit']);
  for (const r of rows) {
    assert.equal(r.name, MARKER_NAMES.PORTAL);
    assert.equal(r.teleporterKey, 'K');
  }
  const t = (m) => [m[12], m[13], m[14]].map((v) => +v.toFixed(5));
  assert.deepEqual(t(rows[0].matrix), [10, 3, 20]);
  assert.deepEqual(t(rows[1].matrix), [30, 2.2, 40]);
  // the composed rotation of Ry(0+90) * Euler(0,90,90) is Ry(180)*Rz(90),
  // whose scaled columns are (0,2,0), (0.1,0,0), (0,0,-1)
  const cols = (m) => [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
  for (const r of rows) {
    const c = cols(r.matrix);
    assert.ok(near(c[0][0], 0) && near(c[0][1], 2) && near(c[0][2], 0), 'x column');
    assert.ok(near(c[1][0], 0.1) && near(c[1][1], 0) && near(c[1][2], 0), 'y column');
    assert.ok(near(c[2][0], 0) && near(c[2][1], 0) && near(c[2][2], -1), 'z column');
  }
  // THE EXIT'S OWN 123-degree yaw NEVER APPEARS - DFU's
  // `endPoint.rotation` line is commented out and replaced by
  // `startPoint.rotation` two lines later. Turn the ENTRANCE and BOTH
  // discs turn; turn the exit and neither does.
  const turned = teleporterMarkerRows('K', {
    entrance: { pos: [10, 3, 20], yawDeg: 90 }, exit: { pos: [30, 2.2, 40], yawDeg: 123 },
  });
  assert.ok(!near(turned[1].matrix[8], rows[1].matrix[8]), 'the exit disc followed the ENTRANCE');
});

test('c2/S8 the connection cylinder spans the two ends exactly', () => {
  assert.equal(CONNECTION_RADIUS_SCALE, 0.2);
  const conn = { entrance: { pos: [10, 3, 20] }, exit: { pos: [30, 2.2, 40] } };
  const m = teleporterConnectionTransform(conn);
  // position: the midpoint (:664)
  assert.deepEqual([m[12], m[13], m[14]].map((v) => +v.toFixed(5)), [20, 2.6, 30]);
  // localScale (0.2, |entrance - exit| * 0.5, 0.2) (:665) - the y half
  // because Unity's cylinder is TWO units tall, so it ends exactly on
  // the two portals
  const d = [-20, 0.8, -20];
  const half = Math.hypot(...d) * 0.5;
  const yCol = [m[4], m[5], m[6]];
  assert.ok(near(Math.hypot(...yCol), half, 1e-4), 'the cylinder is half the span long');
  assert.ok(near(Math.hypot(m[0], m[1], m[2]), 0.2, 1e-5), 'and 0.2 across');
  assert.ok(near(Math.hypot(m[8], m[9], m[10]), 0.2, 1e-5));
  // rotation FromToRotation(up, entrance - exit) (:666): the cylinder's
  // own +y ends up along the difference vector
  for (let i = 0; i < 3; i++) assert.ok(near(yCol[i] / half, d[i] / (half * 2), 1e-4), 'axis');
  assert.equal(teleporterConnectionTransform(null), null, 'a missing connection draws nothing');
});

test('c2/S8 FromToRotation\'s two degenerate arms', () => {
  assert.deepEqual(fromToRotationUp([0, 5, 0]).map((v) => +v.toFixed(6)), [0, 0, 0, 1], 'already up: identity');
  const down = fromToRotationUp([0, -5, 0]);
  assert.equal(Math.abs(down[3]) < 1e-6, true, 'straight down is a HALF turn, not a NaN');
  assert.equal(fromToRotationUp([0, 0, 0])[3], 1, 'a zero vector cannot rotate anything');
});

test('c2/S8 the marker SET grows the notes and the portals, and nothing else moved', () => {
  const notes = new Map([[0, { position: [1, 1, 1], note: 'a' }], [4, { position: [2, 2, 2], note: 'b' }]]);
  const teleporters = new Map([['K', { entrance: { pos: [0, 0, 0], yawDeg: 0 }, exit: { pos: [9, 0, 9], yawDeg: 0 } }]]);
  const withUser = automapMarkerSet({ playerPos: [0, 0, 0], notes, teleporters });
  const without = automapMarkerSet({ playerPos: [0, 0, 0] });
  assert.equal(withUser.length, without.length + 4, 'two diamonds and two discs');
  const diamonds = withUser.filter((r) => r.model === 'diamondNote');
  assert.deepEqual(diamonds.map((r) => r.name), ['UserNoteMarker_0', 'UserNoteMarker_4']);
  assert.deepEqual(diamonds.map((r) => r.note), ['a', 'b']);
  // uniform 0.6 scale (:1585) at the stored position
  assert.deepEqual([...BEACON_SCALES.note], [0.6, 0.6, 0.6]);
  assert.deepEqual([diamonds[0].matrix[12], diamonds[0].matrix[13], diamonds[0].matrix[14]], [1, 1, 1]);
  assert.ok(near(diamonds[0].matrix[0], 0.6));
  assert.equal(withUser.filter((r) => r.name === MARKER_NAMES.PORTAL).length, 2);
  // and the ROW SHAPE the picker needs is present on every one
  for (const r of withUser) assert.ok(r.matrix && r.model, 'every row draws');
  assert.ok(markerModels().diamondNote, 'the model is built once, at module scope');
});

test('c2/S8 the two portal hover strings still dispatch off the END TAG', () => {
  assert.equal(hoverKeyForHit({ name: MARKER_NAMES.PORTAL, portal: 'entrance' }), 'automapTeleporterEntrance');
  assert.equal(hoverKeyForHit({ name: MARKER_NAMES.PORTAL, portal: 'exit' }), 'automapTeleporterExit');
  assert.equal(hoverKeyForHit({ name: MARKER_NAMES.PORTAL, portal: null }), null);
});

// ─────────────────────────────────────────────────────────────────────
// 5. THE JUMP
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 easeInOutSine is iTween\'s, at the four points that identify it', () => {
  assert.equal(TELEPORT_JUMP_DURATION, 1.0);
  assert.equal(easeInOutSine(0), 0);
  assert.ok(near(easeInOutSine(0.25), 0.14644660940672627, 1e-12), 'NOT a lerp - 0.146, not 0.25');
  assert.ok(near(easeInOutSine(0.5), 0.5, 1e-12));
  assert.equal(easeInOutSine(1), 1);
  assert.equal(easeInOutSine(1.7), 1, 'clamped past the end');
  assert.equal(easeInOutSine(-0.3), 0, 'and before the start');
});

// ─────────────────────────────────────────────────────────────────────
// 6. THE GESTURES, THROUGH THE WINDOW
// ─────────────────────────────────────────────────────────────────────

const CANVAS = { width: 320, height: 200 };
function stub(log = []) {
  return {
    canvas: CANVAS,
    uploadTexture: (a, k) => `tex:${a}/${k}`,
    releaseTexture: () => {},
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: () => {},
    createMesh: (model) => ({ tag: model.subMeshes[0].textureRecord }),
    destroyMesh: () => {},
    drawBillboards: () => {},
    drawMesh: (mesh) => log.push(['drawMesh', mesh?.tag ?? mesh]),
    drawMeshWire: () => {},
    drawScreenQuad: () => {},
    setClipY: () => {}, setAutomapMode: () => {}, setAutomapWater: () => {},
    setFog: () => {}, setLighting: () => {}, setMoonlight: () => {},
    setPointLights: () => {}, setIndirectLight: () => {}, setWindowEmission: () => {},
    panelFrame: ({ setup }, body) => { setup?.(); body(); },
  };
}

/** A 60x60 floor slab at y=0, revealed - so a ray down the middle of
 *  the panel always lands on it and the hit's normal is +y. */
function floorModel() {
  const positions = new Float32Array([-30, 0, -30, 30, 0, -30, 30, 0, 30, -30, 0, 30]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return buildRevealIndex([{
    key: 'floor', aabb: { min: [-30, -0.1, -30], max: [30, 0.1, 30] },
    blockIndex: 0, blockName: 'W0000000.RDB', elementIndex: 0, elementName: 'Models', modelIndex: 0,
    positions, indices, matrix,
  }]);
}

function openWindow(over = {}) {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  signalAutomapReset();
  const rec = over.rec ?? freshRecord();
  rec.revealed.add('floor');
  rec.visitedThisRun.add('floor');
  const w = new AutomapWindow({
    record: () => rec,
    model: floorModel(),
    drawList: [], dynamicDraws: [], texRemap: null,
    player: () => ({ feet: [0, 0, 0], eye: [0, 1.7, 0], yaw: 0 }),
    startMarker: { x: 30, y: 0, z: 30 },
    blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }],
    arrowMesh: null, arrowBounds: null,
    dungeonName: 'D', insideBuilding: false,
    ...over,
  });
  w.draw(stub(), CANVAS, null, 1);   // the pass the gestures unproject through
  return { w, rec };
}

/** Two presses inside the double-click window at the same spot. */
function doubleClick(w, nx, ny, button = 0, mods = null) {
  w.pointer('down', nx, ny, button, mods);
  w.pointer('up', nx, ny, button);
  w.tick(0.05);
  w.pointer('down', nx, ny, button, mods);
  w.pointer('up', nx, ny, button);
}
// The click the gesture pins use, and where its ray lands. It is
// deliberately OFF-CENTRE: the panel centre is the player, and the red
// position beacon standing there is a 100-unit column that wins every
// pick made through it - which is correct behaviour and useless for
// testing the geometry arm.
const CLICK_X = CHROME_RECTS.panel.x + 200;
const CLICK_Y = CHROME_RECTS.panel.y + 84;
const FLOOR_HIT = [5.282, 0, 4.423];
// a second click, and where ITS ray lands - the two-portal quirk needs
// two portals at two distinct screen positions
const SECOND_CLICK_X = CHROME_RECTS.panel.x + 240;
const SECOND_FLOOR_HIT = [10.434, 0, 4.423];

test('c2/S8 a left double-click on the floor mints a note 0.7 above it', () => {
  const { w, rec } = openWindow();
  try {
    doubleClick(w, CLICK_X, CLICK_Y);
    assert.equal(rec.notes.size, 1, 'the gesture reached the model');
    assert.ok(near(rec.notes.get(0).position[1], 0.7), 'hit.point + normal * 0.7 off a floor');
    assert.ok(w.userNoteBox, 'and the note editor opened');
    assert.equal(w.userNoteBox.id, 0);
    // the editor owns the keyboard: typing goes into the note, not the
    // hotkey table
    w.input('KeyN', { code: 'KeyN', key: 'n' });
    w.input('KeyE', { code: 'KeyE', key: 'e' });
    w.input('Enter', { code: 'Enter' });
    assert.equal(w.userNoteBox, null, 'Enter commits and closes');
    assert.equal(rec.notes.get(0).note, 'ne');
    // ...and a second double click on the SAME spot edits rather than
    // adding, because the marker is now what the ray hits first (the
    // diamond joins the pickable set on the next frame, exactly as
    // CreateUserMarker's GameObject joins the automap layer)
    w.draw(stub(), CANVAS, null, 1);
    doubleClick(w, CLICK_X, CLICK_Y);
    assert.equal(rec.notes.size, 1, 'no second marker');
    assert.equal(w.userNoteBox?.id, 0);
    assert.equal(w.userNoteBox.value, 'ne', 'seeded with the existing note');
    w.input('Escape', { code: 'Escape' });
    assert.equal(rec.notes.get(0).note, 'ne', 'Escape writes nothing');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 Ctrl on the left double-click drops a bare marker with no editor', () => {
  const { w, rec } = openWindow();
  try {
    doubleClick(w, CLICK_X, CLICK_Y, 0, { ctrl: true });
    assert.equal(rec.notes.size, 1);
    assert.equal(w.userNoteBox, null, 'Ctrl skips the prompt');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 the left arm is GATED inside a building and the right arm is NOT', () => {
  {
    const { w, rec } = openWindow({ insideBuilding: true });
    try {
      doubleClick(w, CLICK_X, CLICK_Y);
      assert.equal(rec.notes.size, 0, 'no note markers inside a building (window :1871)');
      assert.equal(w.userNoteBox, null);
      // the RIGHT double click still places the rotation pivot, because
      // its handler carries no such gate
      const before = [...automapCameraState().pivot3D];
      doubleClick(w, CLICK_X, CLICK_Y, 2);
      assert.notDeepEqual([...automapCameraState().pivot3D], before);
    } finally { _resetForTests(); resetAutomapWindowState(); }
  }
});

test('c2/S8 the right double-click DELETES a marker, and otherwise falls through to the pivot', () => {
  const { w, rec } = openWindow();
  try {
    // (a) nothing to delete: the pivot moves to the hit + up * 1.0
    const start = [...automapCameraState().pivot3D];
    doubleClick(w, CLICK_X, CLICK_Y, 2);
    const moved = [...automapCameraState().pivot3D];
    assert.notDeepEqual(moved, start, 'the fallthrough ran');
    assert.ok(near(moved[1], 1.0), 'the pivot sits 1.0 above the floor it was placed on');
    // the OTHER mode's pivot is untouched - the window stores into the
    // active mode's slot alone
    assert.deepEqual([...automapCameraState().pivot2D], start);

    // (b) a marker under the cursor: it is REMOVED and the pivot does
    // NOT move ("if successful do nothing more")
    doubleClick(w, CLICK_X, CLICK_Y);           // mint one
    w.input('Escape', { code: 'Escape' });
    assert.equal(rec.notes.size, 1);
    w.draw(stub(), CANVAS, null, 1);                    // the marker joins the set
    const pivotBefore = [...automapCameraState().pivot3D];
    doubleClick(w, CLICK_X, CLICK_Y, 2);
    assert.equal(rec.notes.size, 0, 'the marker was deleted');
    assert.deepEqual([...automapCameraState().pivot3D], pivotBefore, 'and the pivot did NOT move');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 the middle double-click centres the camera keeping its distance to the player', () => {
  const { w } = openWindow();
  try {
    const cam = automapCameraState();
    const d = Math.hypot(cam.pos[0], cam.pos[1], cam.pos[2]);   // the player is at the origin
    doubleClick(w, CLICK_X, CLICK_Y, 1);
    const after = automapCameraState();
    assert.deepEqual([...after.fwd].map((v) => +v.toFixed(6)), [...cam.fwd].map((v) => +v.toFixed(6)),
      'the camera did not turn');
    assert.ok(!near(after.pos[0], cam.pos[0], 1e-3) || !near(after.pos[2], cam.pos[2], 1e-3), 'but it moved');
    // it sits `d` back along its own forward from the hit point, and
    // the hit is on the floor - so the new position projects onto y=0
    // exactly d units away
    const hit = [after.pos[0] + after.fwd[0] * d, after.pos[1] + after.fwd[1] * d, after.pos[2] + after.fwd[2] * d];
    assert.ok(near(hit[1], 0, 1e-3), 'the point it centred on is the floor it hit');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 a portal double-click jumps the camera by the connection\'s own delta - from BOTH ends', () => {
  for (const end of ['entrance', 'exit']) {
    const rec = freshRecord();
    // a portal pair straddling the panel centre; the ENTRANCE disc sits
    // where the ray lands so it wins the pick
    const conn = { entrance: { pos: [...FLOOR_HIT], yawDeg: 0 }, exit: { pos: [12, 0.5, -7], yawDeg: 0 } };
    if (end === 'exit') { conn.entrance.pos = [12, 0.5, -7]; conn.exit.pos = [...FLOOR_HIT]; }
    rec.teleporters.set('K', conn);
    const { w } = openWindow({ rec });
    try {
      const from = [...automapCameraState().pos];
      doubleClick(w, CLICK_X, CLICK_Y);
      assert.equal(w.iTweenCameraAnimationIsRunning, true, `${end}: the tween started`);
      assert.equal(rec.notes.size, 0, 'and NO note marker was dropped on the portal');
      // the near end is whichever disc the ray hit; the delta is
      // -(thatEnd - otherEnd)
      const hitEnd = end === 'exit' ? conn.exit.pos : conn.entrance.pos;
      const farEnd = end === 'exit' ? conn.entrance.pos : conn.exit.pos;
      w.tick(TELEPORT_JUMP_DURATION);
      const to = automapCameraState().pos;
      for (let i = 0; i < 3; i++) {
        assert.ok(near(to[i], from[i] - (hitEnd[i] - farEnd[i]), 1e-3), `${end}: axis ${i}`);
      }
      assert.equal(w.iTweenCameraAnimationIsRunning, false, 'and it completed');
    } finally { _resetForTests(); resetAutomapWindowState(); }
  }
});

test('c2/S8 the tween SWALLOWS every other input for its whole duration', () => {
  const rec = freshRecord();
  rec.teleporters.set('K', { entrance: { pos: [...FLOOR_HIT], yawDeg: 0 }, exit: { pos: [40, 0.5, 40], yawDeg: 0 } });
  const { w } = openWindow({ rec });
  try {
    doubleClick(w, CLICK_X, CLICK_Y);
    assert.equal(w.iTweenCameraAnimationIsRunning, true);
    assert.equal(automapBackground(), 'original');
    // a hotkey, a click and a wheel all reach nothing while it runs
    w.input('Digit2', { code: 'Digit2' });
    w.pointer('down', CHROME_RECTS.exit.x + 2, 175, 0);
    w.pointer('up', CHROME_RECTS.exit.x + 2, 175, 0);
    w.wheel(-1);
    assert.equal(w.done, false, 'the exit button did not close the window');
    // ...and the camera is still moving, half way through
    w.tick(0.5);
    assert.equal(w.iTweenCameraAnimationIsRunning, true, 'still running at 0.5s');
    const half = [...automapCameraState().pos];
    w.tick(0.5);
    assert.equal(w.iTweenCameraAnimationIsRunning, false);
    assert.notDeepEqual([...automapCameraState().pos], half, 'and it kept moving after the halfway point');
    // once it is over the SAME inputs land
    w.pointer('down', CHROME_RECTS.exit.x + 2, 175, 0);
    w.pointer('up', CHROME_RECTS.exit.x + 2, 175, 0);
    assert.equal(w.done, true, 'the exit button works again');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 the tween returns BEFORE base.Update() - a button still held does not act', () => {
  // The lockout that the three input doors cannot prove: DFU's Update
  // returns before `base.Update()`, which is what polls every held
  // button - so a button held down when the jump starts stops acting
  // until it is over. The portal delta here is purely HORIZONTAL, so
  // the tween never touches y and the held UPSTAIRS button (which moves
  // the camera up at 25/s) is the only thing that could.
  const rec = freshRecord();
  rec.teleporters.set('K', { entrance: { pos: [...FLOOR_HIT], yawDeg: 0 }, exit: { pos: [40, 0, 40], yawDeg: 0 } });
  const { w } = openWindow({ rec });
  try {
    w.pointer('down', CHROME_RECTS.upstairs.x + 2, 175, 0);   // held, and never released
    w.pointer('down', CLICK_X, CLICK_Y, 0);
    w.tick(0.05);
    const rising = automapCameraState().pos[1];
    assert.ok(rising > 0, 'the held button really does move the camera up while the map is live');
    w.pointer('down', CLICK_X, CLICK_Y, 0);                   // the second press: the jump
    assert.equal(w.iTweenCameraAnimationIsRunning, true);
    const y = automapCameraState().pos[1];
    w.tick(0.2);
    assert.ok(near(automapCameraState().pos[1], y, 1e-6),
      'the held button acted on NO frame of the tween');
    w.tick(1.0);
    assert.equal(w.iTweenCameraAnimationIsRunning, false);
    w.tick(0.05);
    assert.ok(automapCameraState().pos[1] > y, 'and it starts acting again the moment it is over');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 the hover connection appears over a portal and is destroyed on the way out', () => {
  const rec = freshRecord();
  rec.teleporters.set('K', { entrance: { pos: [...FLOOR_HIT], yawDeg: 0 }, exit: { pos: [20, 0.5, 20], yawDeg: 0 } });
  const { w } = openWindow({ rec });
  try {
    w.hover(CLICK_X, CLICK_Y);
    let log = [];
    w.draw(stub(log), CANVAS, null, 1);
    assert.equal(w.hoverText, AUTOMAP_STRINGS.automapTeleporterEntrance);
    assert.ok(log.some((c) => c[1] === MARKER_TEX.CONNECTION), 'the connection cylinder drew');
    // move off the portal onto bare floor: it goes
    w.hover(CHROME_RECTS.panel.x + 8, CHROME_RECTS.panel.y + 8);
    log = [];
    w.draw(stub(log), CANVAS, null, 1);
    assert.equal(log.some((c) => c[1] === MARKER_TEX.CONNECTION), false, 'and it was destroyed');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 QUIRK: portal to portal keeps the FIRST connection - it is created only when there is none', () => {
  // UpdateMouseHoverOverGameObjects creates the cylinder under
  // `gameobjectTeleporterConnection == null` (:629) and destroys it only
  // when the hit is NOT a portal (:668-688) - so sliding from one portal
  // straight onto another leaves the first connection drawn. A port that
  // recomputed it per frame would look tidier and be wrong.
  const rec = freshRecord();
  const A = { entrance: { pos: [...FLOOR_HIT], yawDeg: 0 }, exit: { pos: [40, 0, 40], yawDeg: 0 } };
  const B = { entrance: { pos: [...SECOND_FLOOR_HIT], yawDeg: 0 }, exit: { pos: [-40, 0, -40], yawDeg: 0 } };
  rec.teleporters.set('A', A);
  rec.teleporters.set('B', B);
  const { w } = openWindow({ rec });
  const seen = [];
  const matrixStub = () => {
    const r = stub();
    r.drawMesh = (mesh, matrix) => { if (mesh?.tag === MARKER_TEX.CONNECTION) seen.push([...matrix]); };
    return r;
  };
  try {
    w.hover(CLICK_X, CLICK_Y);
    w.draw(matrixStub(), CANVAS, null, 1);
    assert.equal(seen.length, 1, 'portal A is hovered and its connection drew');
    const wantA = [...teleporterConnectionTransform(A)];
    assert.deepEqual(seen[0].map((v) => +v.toFixed(4)), wantA.map((v) => +v.toFixed(4)));

    // straight onto portal B, with no bare-floor frame in between
    w.hover(SECOND_CLICK_X, CLICK_Y);
    seen.length = 0;
    w.draw(matrixStub(), CANVAS, null, 1);
    assert.equal(seen.length, 1, 'a connection is still drawn');
    assert.deepEqual(seen[0].map((v) => +v.toFixed(4)), wantA.map((v) => +v.toFixed(4)),
      'and it is STILL A\'s - the quirk');
    assert.notDeepEqual(
      [...teleporterConnectionTransform(B)].map((v) => +v.toFixed(4)), wantA.map((v) => +v.toFixed(4)),
      'B\'s own connection really is a different cylinder, so the pin is not vacuous');

    // one frame off the portals destroys it, and B's own then appears
    w.hover(CHROME_RECTS.panel.x + 8, CHROME_RECTS.panel.y + 8);
    seen.length = 0;
    w.draw(matrixStub(), CANVAS, null, 1);
    assert.equal(seen.length, 0);
    w.hover(SECOND_CLICK_X, CLICK_Y);
    w.draw(matrixStub(), CANVAS, null, 1);
    assert.deepEqual(seen[0].map((v) => +v.toFixed(4)),
      [...teleporterConnectionTransform(B)].map((v) => +v.toFixed(4)));
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// ─────────────────────────────────────────────────────────────────────
// 7. THE CONSOLE VERBS AND THE DEBUG TELEPORT
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 map_revealall reveals in COLOUR; map_hideall darkens without clearing the tier', () => {
  const rec = freshRecord();
  const model = floorModel();
  assert.equal(revealAllAutomap(rec, model), true);
  assert.deepEqual([...rec.revealed], ['floor']);
  assert.deepEqual([...rec.visitedThisRun], ['floor'], 'RevealAll DISABLES the grayscale keyword');
  assert.equal(rec.entranceDiscovered, true, 'and lights the entrance beacon');

  assert.equal(hideAllAutomap(rec), true);
  assert.equal(rec.revealed.size, 0, 'MeshRenderer.enabled off');
  assert.equal(rec.entranceDiscovered, false);
  assert.deepEqual([...rec.visitedThisRun], ['floor'],
    'but HideAll never touches the keyword - which is why `revealed` has to be the draw gate');
});

test('c2/S8 a hidden dungeon draws NOTHING even where visitedThisRun still holds the key', () => {
  const rec = freshRecord();
  rec.visitedThisRun.add('k');          // the keyword survived HideAll
  const drawn = [];
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  signalAutomapReset();
  const w = new AutomapWindow({
    record: () => rec,
    model: { rows: [], byKey: new Map(), exploredPercentage: () => 0, length: 0 },
    drawList: [{ mesh: { tag: 'wall' }, matrix: new Float32Array(16), key: 'k' }],
    dynamicDraws: [], texRemap: null,
    player: () => ({ feet: [0, 0, 0], eye: [0, 1.7, 0], yaw: 0 }),
    startMarker: null, blocks: [], arrowMesh: null, arrowBounds: null,
    dungeonName: 'D', insideBuilding: false,
  });
  try {
    w.draw(stub(drawn), CANVAS, null, 1);
    assert.equal(drawn.some((c) => c[1] === 'wall'), false, 'HideAll really hides');
    rec.revealed.add('k');
    const after = [];
    w.draw(stub(after), CANVAS, null, 1);
    assert.equal(after.some((c) => c[1] === 'wall'), true, 'and revealing brings it back');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S8 the debug teleport needs the MODE and BOTH modifiers, and never starts a drag', () => {
  const warps = [];
  const before = automapDebugTeleportMode();
  const { w } = openWindow({ debugTeleport: (p) => warps.push([...p]) });
  try {
    // off by default (and off unless map_teleportmode said otherwise)
    assert.equal(before, false);
    w.pointer('down', CLICK_X, CLICK_Y, 0, { ctrl: true, shift: true });
    assert.equal(warps.length, 0, 'the mode gates it');
    w.pointer('up', CLICK_X, CLICK_Y, 0);

    assert.equal(toggleAutomapDebugTeleportMode(), true);
    w.pointer('down', CLICK_X, CLICK_Y, 0, { ctrl: true });
    assert.equal(warps.length, 0, 'Ctrl alone is not enough');
    w.pointer('up', CLICK_X, CLICK_Y, 0);

    w.pointer('down', CLICK_X, CLICK_Y, 0, { ctrl: true, shift: true });
    assert.equal(warps.length, 1, 'Ctrl+Shift on the panel teleports');
    assert.ok(near(warps[0][1], 0.1), 'the hit point, raised 0.1 (:868)');
    // and it RETURNED before the drag flags were set (:735-737): a move
    // now must not pan the map
    const pos = [...automapCameraState().pos];
    w.pointer('move', CLICK_X + 30, CLICK_Y + 30, 0);
    assert.deepEqual([...automapCameraState().pos], pos, 'the press started no drag');
  } finally {
    if (automapDebugTeleportMode()) toggleAutomapDebugTeleportMode();
    _resetForTests(); resetAutomapWindowState();
  }
});

// ─────────────────────────────────────────────────────────────────────
// 8. SOURCE PINS
// ─────────────────────────────────────────────────────────────────────

test('c2/S8 SOURCE: the Teleport relay reports BOTH endpoints and still warps identically', () => {
  const a = new ActionSystem({ raycastHit: () => null, raycast: () => Infinity });
  const dests = new Map([
    ['0:60', { pos: [1, 0, 2], yawDeg: 10 }],     // the entrance object itself
    ['0:99', { pos: [10, 2, 30], yawDeg: 45 }],   // its destination
  ]);
  a.resolvePosition = (ns, key) => dests.get(`${ns}:${key}`) ?? null;
  const order = [];
  a.onTeleport = (d) => order.push(['warp', d]);
  a.onTeleportPortal = (from, to) => order.push(['portal', from, to]);
  const tele = a.addRelay(0, 60, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 99 });
  a.receive(tele, 'ActionObject');
  // the event fires BEFORE the warp, as RaiseOnTeleportActionEvent does
  assert.deepEqual(order.map((r) => r[0]), ['portal', 'warp']);
  assert.deepEqual(order[0][1], { pos: [1, 0, 2], yawDeg: 10 }, 'the trigger object');
  assert.deepEqual(order[0][2], { pos: [10, 2, 30], yawDeg: 45 }, 'and its NextObject');
  assert.deepEqual(order[1][1], { pos: [10, 2, 30], yawDeg: 45 }, 'the warp is unchanged');

  // a NULL destination reports nothing and warps nothing - the guard is
  // still the first statement
  order.length = 0;
  a.receive(a.addRelay(0, 61, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 500 }));
  assert.deepEqual(order, []);

  // ...and the whole chain still works with NO listener bound at all
  const bare = new ActionSystem({ raycastHit: () => null, raycast: () => Infinity });
  bare.resolvePosition = (ns, key) => dests.get(`${ns}:${key}`) ?? null;
  const warped = [];
  bare.onTeleport = (d) => warped.push(d);
  bare.receive(bare.addRelay(0, 60, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 99 }));
  assert.deepEqual(warped, [{ pos: [10, 2, 30], yawDeg: 45 }]);
});

test('c2/S8 SOURCE: the host installs the listener, the two dungeon hosts carry the modifiers', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  // the listener is on the CONTEXT, not in a host - both dungeon hosts
  // overwrite `actions.onTeleport` with their own motor warp, and
  // neither may need to know about this one
  assert.match(ctx, /actions\.onTeleportPortal = \(from, to\) => \{ recordTeleporterConnection\(automapRec, from, to\); \};/);
  assert.match(ctx, /debugTeleport: \(pos\) => actions\.onTeleport\?\.\(/, 'the debug click reuses the warp door');
  assert.match(ctx, /automapCommand\(name\)/, 'and the three console verbs have a home');
  for (const cmd of ['map_revealall', 'map_hideall', 'map_teleportmode']) {
    assert.ok(ctx.includes(cmd), `${cmd} is registered`);
  }
  assert.match(src('src/scenes/dungeon.js'), /window\.__automapCommand/, 'mounted on the probe surface');

  // BOTH hosts that route a pointer DOWN into the dungeon overlay must
  // carry the modifiers, or Ctrl+Shift and the Ctrl note arm are dead
  // in that host alone - the failure a source pin exists to catch
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.match(src(f), /overlayPointer\?\.\('down', [^)]*e\.button, \{ ctrl: !!e\.ctrlKey, shift: !!e\.shiftKey \}\)/,
      `${f} carries the modifiers on the down route`);
  }
  // and the relay reports before it warps, in the source too
  assert.match(src('src/world/actionSystem.js'),
    /if \(from\) this\.onTeleportPortal\?\.\(from, dest\);\n\s*this\.onTeleport\?\.\(dest\);/);
});
