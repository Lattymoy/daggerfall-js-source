import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isOnShip, shipTransition, REPOSITION } from '../src/systems/ship.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { SHIP_TYPES, shipCoords } from '../src/systems/banking.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

// TR4 - THE SHIP: TransportManager's ship arm (:79-84, :360-402), the
// last slice of the transport arc. "Ship" is not a mode you travel IN -
// DFU's own comment on the enum says so - it is a TELEPORT that lands
// back on Foot, and `boardShipPosition` is the whole of its state.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const owner = () => ({ ownedShip: SHIP_TYPES.Small });
const at = (c) => ({ x: c.x, y: c.y });

test('TR4: IsOnShip is a remembered boarding AND standing on the ship\'s own pixel (:79-84)', () => {
  const p = owner();
  const c = shipCoords(p);
  assert.ok(c, 'an owner has coords');
  const memory = { mapPixel: { x: 40, y: 50 }, pos: [1, 2, 3], yaw: 0.5 };
  assert.equal(isOnShip(p, memory, at(c)), true);
  assert.equal(isOnShip(p, null, at(c)), false, 'no memory: not aboard');
  assert.equal(isOnShip(p, memory, { x: 40, y: 50 }), false, 'memory but standing elsewhere: not aboard');
  assert.equal(isOnShip({ ownedShip: SHIP_TYPES.None }, memory, at(c)), false, 'no ship at all');
});

test('TR4: boarding remembers where you were and lands at a start marker; disembarking goes back exactly and forgets', () => {
  const p = owner();
  const c = shipCoords(p);
  const here = { x: 40, y: 50 };
  const position = { mapPixel: here, pos: [10, 2, 30], yaw: 1.25 };
  const board = shipTransition(p, { boardShipPosition: null, mapPixel: here, position });
  assert.deepEqual(board.go, { x: c.x, y: c.y });
  assert.equal(board.reposition, REPOSITION.RandomStartMarker);
  assert.equal(board.restore, null, 'a start marker, not a remembered spot');
  assert.equal(board.boardShipPosition, position, 'and the memory is taken');
  assert.equal(board.mode, TRANSPORT_MODES.Foot, 'Ship is not a mode you travel in');
  // Now aboard: the same call disembarks.
  const off = shipTransition(p, { boardShipPosition: position, mapPixel: at(c), position: { mapPixel: at(c), pos: [0, 0, 0], yaw: 0 } });
  assert.deepEqual(off.go, here, 'back to the remembered pixel');
  assert.equal(off.reposition, REPOSITION.None, 'exactly where you were, no reposition');
  assert.equal(off.restore, position);
  assert.equal(off.boardShipPosition, null, 'and the memory is forgotten');
  assert.equal(off.mode, TRANSPORT_MODES.Foot);
});

test('TR4: no ship, no transition - the port answers null where DFU would reach a null coord', () => {
  assert.equal(shipTransition({ ownedShip: SHIP_TYPES.None }, { mapPixel: { x: 1, y: 1 } }), null);
  assert.equal(shipTransition({}, { mapPixel: { x: 1, y: 1 } }), null);
});

test('TR4: the boarding memory SURVIVES a save (SerializablePlayer :180, :425)', () => {
  const e = { ...owner(), stats: {}, skills: [], items: [] };
  const memory = { mapPixel: { x: 40, y: 50 }, pos: [10, 2, 30], yaw: 1.25 };
  e.boardShipPosition = memory;
  const snap = snapshotPlayer(e, { position: [0, 0, 0], classicMinutes: 0 });
  assert.deepEqual(snap.boardShipPosition, memory, 'saved beside the deed');
  const loaded = { stats: {}, skills: [], items: [] };
  restorePlayer(loaded, snap);
  assert.deepEqual(loaded.boardShipPosition, memory, 'and restored');
  // Without it, a save taken at sea loads with no way back: IsOnShip
  // would answer false and disembarking would BOARD again, overwriting
  // the real position. An older envelope restores null, which is the
  // "never boarded" state rather than a broken one.
  const older = { ...snap }; delete older.boardShipPosition;
  const old = { stats: {}, skills: [], items: [] };
  restorePlayer(old, older);
  assert.equal(old.boardShipPosition, null);
});

test('TR4: the picker\'s row is live for an owner, and Ship routes to the teleport rather than the mode', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /shipAvailable: ownsShip\(playerEntity\),/, 'the row the bank arc has been able to answer since H3');
  assert.match(world, /if \(mode === TRANSPORT_MODES\.Ship\) \{ boardOrDisembark\(\); return; \}/);
  // The host half: the decision comes from ship.js, the teleport and
  // the remembered yaw are the host's.
  assert.match(world, /const t = shipTransition\(playerEntity, \{/);
  // F-F1 (the parity audit): the host READS the reposition rather than
  // inferring it from `restore`, so the two encodings cannot drift.
  assert.match(world, /const localPos = t\.reposition === REPOSITION\.None \? t\.restore\.pos : null;/);
  assert.match(world, /await _teleportToPixel\(t\.go\.x, t\.go\.y, localPos\);/);
  assert.match(world, /playerEntity\.boardShipPosition = t\.boardShipPosition;/);
  assert.match(world, /setTransportModeHere\(t\.mode\);/, 'and it lands on Foot through the one seam');
});
