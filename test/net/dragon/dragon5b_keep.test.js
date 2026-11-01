// DRAGON5b (bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE TAMED DRAGON'S KEEP - off its back it waits where it was
// left; called, it flies in along its facing and lands behind the player; sent away, it climbs off; named; its saddlebags a
// storage beside the pack and counted wherever the save's held lists are read; its word on my foes frame and the others'
// dragons drawn off theirs (net/dragon/dragonKeepWire.js); its press and plaque raced with the mounts
// (player/activationRace.js); the transport window and the summon key through its door; the Stable page's card.
// tools/mutants/dragon5b.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DRAGON_WHERE, DRAGON_WAIT_BACK_M, DRAGON_NEAR_M, DRAGON_COME_FROM_M, DRAGON_COME_UP_M, DRAGON_COME_MS, DRAGON_LEAVE_MS, DRAGON_BAGS_KG,
  freshDragonKeep, dragonKeepRestored, dragonKeepSaved, normalizeDragonName, keepRidden, keepLeft, keepCalled, keepSentAway,
  keepShownAt, keepFlightAt, keepComing, dragonCallRefusal, dragonKeepDoor, dragonCardWords, DRAGON_KEEP_TEXT,
} from '../../../src/systems/dragon/dragonKeep.js';
import { dragonKeepWireRecord, validDragonKeepRecord, dragonKeepRecordKey } from '../../../src/net/dragon/dragonKeepWire.js';
import { createDragonKeep, DRAGON_KEEP_REACH, DRAGON_KEEP_SCALE } from '../../../src/scenes/dragonKeepHost.js';
import { newDragonMount, DRAGON_MOUNT_TEMPLATE } from '../../../src/systems/dragon/dragonMount.js';
import { dragonRideStep, setDragonMounter, _resetDragonFlight } from '../../../src/player/dragonRide.js';
import { TRANSPORT_MODES } from '../../../src/systems/transport.js';
import { ACTIVATE_MODE } from '../../../src/systems/horse/horseCartLaw.js';
import { raceActivation, raceWinner } from '../../../src/player/activationRace.js';
import { possessedItemLists } from '../../../src/systems/item/possessedItems.js';
import { stashedItemLists } from '../../../src/net/realm/realmGoldLaw.js';
import { InputMessageBoxWindow } from '../../../src/ui/inputMessageBox.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ID = 'dg0123456789abcdef';
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('DRAGON5b the keep\'s law: fresh away and nameless; a save round-trips its place, name, bags and last mount and repairs a bad one; a name trimmed, cleaned and cut at 31 (mutants: the bags dropped, a waiting keep with no place)', () => {
  assert.deepEqual(freshDragonKeep(), { where: DRAGON_WHERE.Away, nx: 0, nz: 0, yaw: 0, name: '', bags: [], last: false });
  const k = { where: DRAGON_WHERE.Waiting, nx: 4000, nz: -800, yaw: 1.25, name: 'Ember', bags: [{ templateIndex: 1, stackCount: 3 }], last: true, flight: { kind: 'in', at: 5 } };
  const saved = dragonKeepSaved(k);
  assert.equal(saved.flight, undefined, 'a flight is never saved: it ends where it lands');
  assert.deepEqual(dragonKeepRestored(JSON.parse(JSON.stringify(saved))), { where: DRAGON_WHERE.Waiting, nx: 4000, nz: -800, yaw: 1.25, name: 'Ember', bags: [{ templateIndex: 1, stackCount: 3 }], last: true });
  assert.notEqual(saved.bags[0], k.bags[0], 'its bags copied');
  assert.equal(dragonKeepRestored({ where: DRAGON_WHERE.Waiting }).where, DRAGON_WHERE.Away, 'waiting nowhere is away');
  assert.equal(dragonKeepRestored({ where: 'sky' }).where, DRAGON_WHERE.Away);
  assert.deepEqual(dragonKeepRestored({ bags: [null, 3, { a: 1 }] }).bags, [{ a: 1 }]);
  assert.equal(normalizeDragonName('  Ash\u0007wing  '), 'Ashwing');
  assert.equal(normalizeDragonName('x'.repeat(40)).length, 31);
  assert.equal(normalizeDragonName(7), '');
});

test('DRAGON5b its flight: called, it comes in from 320 m behind its spot and 120 m up, eased down onto the spot in 7 s; sent away it climbs off ahead for 6 s and is gone; a waiting keep shows on its spot (mutants: the flight never lands, never leaves)', () => {
  assert.deepEqual(keepFlightAt('in', 0), { back: DRAGON_COME_FROM_M, up: DRAGON_COME_UP_M, moving: true });
  const mid = keepFlightAt('in', DRAGON_COME_MS / 2);
  assert.ok(mid.back > 0 && mid.back < DRAGON_COME_FROM_M && mid.up > 0 && mid.up < DRAGON_COME_UP_M);
  assert.equal(keepFlightAt('in', DRAGON_COME_MS), null, 'landed');
  const out = keepFlightAt('out', DRAGON_LEAVE_MS * 0.9);
  assert.ok(out.back < 0 && out.up > 0, 'ahead, and up');
  assert.equal(keepFlightAt('out', DRAGON_LEAVE_MS), null);
  const k0 = freshDragonKeep();
  const called = keepCalled(k0, { nx: 10, nz: 20, yaw: 0.5, at: 1000 });
  assert.equal(called.where, DRAGON_WHERE.Waiting);
  assert.equal(keepComing(called, 1000 + DRAGON_COME_MS - 1), true);
  assert.equal(keepComing(called, 1000 + DRAGON_COME_MS), false);
  assert.equal(keepShownAt(called, 1000).kind, 'in');
  assert.deepEqual(keepShownAt(called, 1000 + DRAGON_COME_MS), { back: 0, up: 0, moving: false, kind: null, age: 0 }, 'on its spot');
  const gone = keepSentAway(called, 9000);
  assert.equal(gone.where, DRAGON_WHERE.Away);
  assert.equal(keepShownAt(gone, 9000).kind, 'out');
  assert.equal(keepShownAt(gone, 9000 + DRAGON_LEAVE_MS), null, 'gone');
  assert.equal(keepShownAt(keepRidden(called), 9000), null, 'ridden: never drawn apart from its rider');
  assert.equal(keepRidden(called).last, true, 'the last mount');
  assert.deepEqual(keepLeft(keepRidden(called), 1, 2, 3), { ...keepRidden(called), where: DRAGON_WHERE.Waiting, nx: 1, nz: 2, yaw: 3, flight: null });
});

test('DRAGON5b a call refused: indoors, aboard, riding it, or it already here - each in its own words (mutants: a call indoors)', () => {
  const k = { ...freshDragonKeep(), name: 'Ember' };
  const ok = { outdoors: true, aboard: false, riding: false, near: false };
  assert.equal(dragonCallRefusal(k, ok), null);
  assert.equal(dragonCallRefusal(k, { ...ok, outdoors: false }), DRAGON_KEEP_TEXT.outdoors);
  assert.equal(dragonCallRefusal(k, { ...ok, aboard: true }), DRAGON_KEEP_TEXT.aboard);
  assert.equal(dragonCallRefusal(k, { ...ok, riding: true }), DRAGON_KEEP_TEXT.riding('Ember'));
  assert.equal(dragonCallRefusal(k, { ...ok, near: true }), DRAGON_KEEP_TEXT.here('Ember'));
});

test('DRAGON5b the wire: my record\'s place, facing, flight, look and name round-trip through the reader; a bad record is dropped whole; a name passes the label door; the change key ignores a flight\'s age (mutants: an out-of-bounds place read, the name unfiltered)', () => {
  const rec = dragonKeepWireRecord({ spot: [12.345, 3.2, -40.5], yaw: 1.23456, kind: 'in', age: 812.4, look: 1, name: 'Ember' });
  assert.deepEqual(rec, { p: [12.35, 3.2, -40.5], yw: 1.2346, fl: [1, 812], lk: 1, n: 'Ember' });
  assert.deepEqual(validDragonKeepRecord(rec), { spot: [12.35, 3.2, -40.5], yaw: 1.2346, kind: 'in', age: 812, look: 1, name: 'Ember' });
  assert.deepEqual(validDragonKeepRecord({ p: [0, 0, 0], yw: 0 }), { spot: [0, 0, 0], yaw: 0, kind: null, age: 0, look: 0, name: '' });
  for (const bad of [null, [], { p: [0, 0] , yw: 0 }, { p: [1e9, 0, 0], yw: 0 }, { p: [0, 0, 0], yw: 99 }, { p: [0, 0, 0], yw: 0, fl: [3, 0] }, { p: [0, 0, 0], yw: 0, fl: [1, -1] }, { p: [0, 0, 0], yw: 0, n: 5 }]) {
    assert.equal(validDragonKeepRecord(bad), null, JSON.stringify(bad));
  }
  assert.equal(validDragonKeepRecord({ p: [0, 0, 0], yw: 0, fl: [2, 1e9] }).age, DRAGON_LEAVE_MS, 'an age past the flight is its end');
  assert.equal(dragonKeepWireRecord(null), null);
  assert.equal(dragonKeepRecordKey({ ...rec, fl: [1, 1] }), dragonKeepRecordKey({ ...rec, fl: [1, 900] }), 'the age moves every frame and is no news');
  assert.notEqual(dragonKeepRecordKey({ ...rec, fl: [1, 1] }), dragonKeepRecordKey({ ...rec, fl: [2, 1] }));
  assert.match(src('src/net/dragon/dragonKeepWire.js'), /export const dragonNameOnWire = \(name\) => \(typeof name === 'string' \? sanitizeLabel\(name, DRAGON_NAME_MAX\) : ''\);/);
});

/** The keep's host over a flat world: natives are scene metres x 40, the ground at 0. */
function world({ items = [newDragonMount({ id: ID })] } = {}) {
  const w = { t: 1000, feet: [0, 0, 0], street: true, aboard: false, said: [], overlays: [], windows: [], batches: 0, destroyed: 0 };
  const entity = { items };
  const renderer = {
    textures: new Map(),
    createBillboardBatch: (/** @type {any} */ _a, /** @type {any} */ _k, /** @type {any} */ size) => { w.batches++; w.made = size; return { bounds: [0, 0, 0, 0] }; },
    destroyBillboardBatch: () => { w.destroyed++; },
  };
  const keep = createDragonKeep({
    now: () => w.t, local: (nx, nz) => [nx / 40, nz / 40], native: (x, z) => [x * 40, z * 40], ground: () => 0,
    feet: () => w.feet, eye: () => [w.feet[0], 1.6, w.feet[2]], street: () => w.street, aboard: () => w.aboard, say: (l) => w.said.push(l),
    renderer, getTexture: () => ({ getFrameCount: () => 4, getSize: () => ({ width: 200, height: 160 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecordFrame: () => {},
    townTalk: { showOverlay: (o) => w.overlays.push(o) }, makeInventoryWindow: (o) => { w.windows.push(o); return { opened: o }; }, entity,
  });
  const step = (mode) => dragonRideStep(0.016, { transportMode: mode, grounded: true }, {});
  return { w, entity, keep, step };
}

test('DRAGON5b the keep on this screen: mounted it is ridden and the last mount; off its back it waits 7 m behind where I rode; called from afar it comes in behind me and says so; sent away it climbs off (mutants: the dismount never seen, the spot ahead of me)', () => {
  _resetDragonFlight();
  const { w, entity, keep, step } = world();
  step(TRANSPORT_MODES.Dragon); keep.tick();
  assert.equal(entity.dragonKeep.where, DRAGON_WHERE.Ridden);
  assert.equal(entity.dragonKeep.last, true);
  for (let z = 0; z <= 10; z += 2) { w.feet = [0, 0, z]; keep.tick(); }   // riding north
  step(TRANSPORT_MODES.Foot); keep.tick();
  const k = entity.dragonKeep;
  assert.equal(k.where, DRAGON_WHERE.Waiting);
  assert.ok(close(k.nx / 40, 0) && close(k.nz / 40, 10 - DRAGON_WAIT_BACK_M), `behind me: ${k.nx / 40}, ${k.nz / 40}`);
  assert.ok(close(k.yaw, 0));
  // far off, then called: it comes in, and the call says so
  w.feet = [500, 0, 500]; keep.tick();
  w.feet = [500, 0, 520]; keep.tick();
  const r = keep.door.call();
  assert.equal(r.ok, true);
  assert.equal(w.said.at(-1), DRAGON_KEEP_TEXT.coming('Your dragon'));
  assert.ok(close(entity.dragonKeep.nz / 40, 520 - DRAGON_WAIT_BACK_M) && close(entity.dragonKeep.nx / 40, 500));
  assert.equal(keep.door.call().ok, false, 'a second call while it flies in is no call');
  w.t += DRAGON_COME_MS;
  assert.equal(keep.door.call().ok, false, 'landed beside me: already here');
  assert.equal(w.said.at(-1), DRAGON_KEEP_TEXT.here('Your dragon'));
  assert.equal(keep.door.sendAway().ok, true);
  assert.equal(entity.dragonKeep.where, DRAGON_WHERE.Away);
  assert.equal(keep.door.sendAway().ok, false, 'away already');
  w.street = false;
  assert.equal(keep.door.call().ok, false, 'indoors');
  assert.equal(w.said.at(-1), DRAGON_KEEP_TEXT.outdoors);
  w.street = true; w.aboard = true;
  assert.equal(keep.door.call().ok, false, 'aboard a ship');
  assert.equal(w.said.at(-1), DRAGON_KEEP_TEXT.aboard);
  assert.equal(entity.dragonKeep.where, DRAGON_WHERE.Away, 'and it stays away');
});

test('DRAGON5b ride and the press: beside it waiting the Dragon row mounts it, from afar it calls it; the press names it (Info), opens its bags (Steal), sends it away (Talk), rides it (Grab); past its reach it says go closer (mutants: the bags opened from afar, the press\'s modes crossed)', () => {
  _resetDragonFlight();
  const { w, entity, keep, step } = world();
  let mounted = 0;
  setDragonMounter(() => { mounted++; });
  entity.dragonKeep = { ...freshDragonKeep(), where: DRAGON_WHERE.Waiting, nx: 0, nz: 400 };   // 10 m north of me
  keep.tick();
  assert.equal(keep.door.ride().ok, true);
  assert.equal(mounted, 1, 'beside it: the rig mounts it');
  w.feet = [0, 0, -300];
  keep.door.ride();
  assert.equal(mounted, 1);
  assert.equal(keepComing(entity.dragonKeep, w.t), true, 'from afar: called');
  w.t += DRAGON_COME_MS;
  w.feet = [0, 0, -300 + 2];
  assert.ok(keep.door.model().near, 'landed beside me');
  // the press
  const [mine] = keep.targets();
  assert.equal(mine.reach, DRAGON_KEEP_REACH);
  assert.equal(keep.activate(mine.key, 1, ACTIVATE_MODE.Info), true);
  assert.ok(w.overlays.at(-1) instanceof InputMessageBoxWindow, 'the name box');
  w.overlays.at(-1).onSubmit('Ember');
  assert.equal(entity.dragonKeep.name, 'Ember');
  w.overlays.at(-1).onSubmit('   ');
  assert.equal(entity.dragonKeep.name, 'Ember', 'an empty entry keeps its name');
  keep.activate(mine.key, 1, ACTIVATE_MODE.Steal);
  const loot = w.windows.at(-1).loot;
  assert.deepEqual([loot.storage, loot.capacity().kg, loot.items()], [true, DRAGON_BAGS_KG, entity.dragonKeep.bags]);
  keep.activate(mine.key, 1, ACTIVATE_MODE.Grab);
  assert.equal(mounted, 2);
  keep.activate(mine.key, DRAGON_KEEP_REACH + 1, ACTIVATE_MODE.Grab);
  assert.equal(mounted, 2);
  assert.equal(w.said.at(-1), DRAGON_KEEP_TEXT.tooFar('Ember'));
  keep.activate(mine.key, 1, ACTIVATE_MODE.Talk, null);
  assert.equal(entity.dragonKeep.where, DRAGON_WHERE.Away, 'Talk sends it away');
  // the bags from afar: refused
  entity.dragonKeep = { ...entity.dragonKeep, where: DRAGON_WHERE.Waiting, flight: null, nz: 40 * 200 };
  const opened = w.windows.length;
  assert.equal(keep.door.openBags().ok, false);
  assert.equal(w.windows.length, opened);
  // the plaque: its name and its four verbs
  entity.dragonKeep = { ...entity.dragonKeep, nz: -300 * 40 + 80 };
  const hover = keep.hoverName(keep.targets()[0].key);
  assert.deepEqual([hover.title, hover.actions.map((a) => a.id)], ['Ember', [ACTIVATE_MODE.Grab, ACTIVATE_MODE.Steal, ACTIVATE_MODE.Talk, ACTIVATE_MODE.Info]]);
  assert.equal(DRAGON_NEAR_M > DRAGON_WAIT_BACK_M, true, 'a dragon left behind me is in my reach');
});

test('DRAGON5b the cell: my word rides my foes frame when it moves and on a full frame, null when none stands; a peer\'s dragon is drawn and its box yields; the summon key\'s word goes to the last mount (mutants: the word never sent, a peer\'s box firm)', async () => {
  _resetDragonFlight();
  const { w, entity, keep } = world();
  entity.dragonKeep = { ...freshDragonKeep(), where: DRAGON_WHERE.Waiting, nx: 0, nz: 400, name: 'Ember' };
  const frame = {};
  keep.word(frame, false, (p) => p);
  assert.deepEqual(frame.dk, { p: [0, 0, 10], yw: 0, n: 'Ember' });
  const again = {};
  keep.word(again, false, (p) => p);
  assert.equal('dk' in again, false, 'unmoved: not said');
  keep.word(again, true, (p) => p);
  assert.deepEqual(again.dk, frame.dk, 'a full frame says it');
  entity.dragonKeep = { ...entity.dragonKeep, where: DRAGON_WHERE.Away, flight: null };
  const gone = {};
  keep.word(gone, false, (p) => p);
  assert.equal(gone.dk, null, 'none stands');
  // a peer's
  assert.equal(keep.peer('p1', { p: [30, 0, 30], yw: 0, n: 'Smoke' }), true);
  const t = keep.targets().find((x) => x.key.endsWith('p1'));
  assert.equal(t.yields, true);
  assert.equal(keep.hoverName(t.key).title, 'Smoke');
  keep.batches();   // its pictures asked
  await new Promise((r) => setTimeout(r, 0));
  const before = w.batches;
  keep.batches();
  assert.equal(w.batches, before + 1, 'its body drawn');
  assert.equal(keep.peer('p1', null), true);
  keep.batches();
  assert.equal(w.destroyed >= 1, true, 'and let go when its word is gone');
  assert.equal(keep.peer('p1', { p: [1e9, 0, 0], yw: 0 }), false);
  // the summon key: the last mount, or nothing else to call
  assert.equal(dragonKeepDoor(), keep.door);
  entity.dragonKeep = { ...entity.dragonKeep, last: false };
  assert.equal(keep.door.summonsFirst(), true, 'no horse, no wagon: the dragon');
  entity.items.push({ group: 'Transportation', templateIndex: 94 });
  assert.equal(keep.door.summonsFirst(), false, 'a horse owned and last ridden');
  entity.dragonKeep = { ...entity.dragonKeep, last: true };
  assert.equal(keep.door.summonsFirst(), true);
});

test('DRAGON5b the race: a dragon waiting races with the mounts - mine firm, another\'s yields to anything firm; the press and the plaque name the same winner (mutants: the dragon unraced)', () => {
  const dragon = { key: 'dragonkeep:mine', distance: 3, reach: 4 };
  const r = raceActivation({ dragon, door: { key: 'door', distance: 5 } });
  assert.equal(r.dragonWins, true);
  assert.equal(raceWinner({ dragon }).key, dragon.key);
  assert.equal(raceActivation({ dragon, corpse: { key: 'c', distance: 2, reach: 3 } }).dragonWins, false, 'a nearer body wins');
  const theirs = { ...dragon, key: 'dragonkeep:peer:p1', yields: true };
  assert.equal(raceActivation({ dragon: theirs, door: { key: 'door', distance: 9 } }).dragonWins, false, 'another\'s yields to a door behind it');
  assert.equal(raceActivation({ dragon: theirs }).dragonWins, true, 'and takes the ray from nothing');
});

test('DRAGON5b the saddlebags are held: the judge\'s and the ledger\'s lists and customs\' walk read them; the save writes the keep and reads it back (mutants: the bags left out of the held lists)', () => {
  const bag = [{ templateIndex: 1 }];
  const save = { items: [], dragonKeep: { where: DRAGON_WHERE.Away, bags: bag } };
  assert.ok(possessedItemLists(save).includes(bag));
  assert.ok(stashedItemLists(save).includes(bag));
  const s = src('src/systems/save/save.js');
  assert.match(s, /snap\.dragonKeep = entity\.dragonKeep \? dragonKeepSaved\(entity\.dragonKeep\) : null;/);
  assert.match(s, /entity\.dragonKeep = snap\.dragonKeep \? dragonKeepRestored\(snap\.dragonKeep, \(it\) => setItemFields\(it\)\) : null;/);
  assert.deepEqual(dragonKeepRestored({ bags: [{ a: 1 }] }, (it) => ({ ...it, b: 2 })).bags, [{ a: 1, b: 2 }], 'each piece through the save\'s repairs');
  assert.match(s, /count \+= removeOrphanedItems\(entity, entity\.dragonKeep\?\.bags \?\? \[\], getQuest\);/);
});

test('DRAGON5b the doors: the transport window\'s Dragon row and the summon key go through the keep; the Stable card says where it is; the host wires its pick, race, press, plaque and words (mutants: the row mounts from afar)', () => {
  assert.match(src('src/player/mountRig.js'), /if \(mode === TRANSPORT_MODES\.Dragon && dragonKeepDoor\(\)\) \{ dragonKeepDoor\(\)\.ride\(\); return; \}/);
  assert.match(src('src/player/mountRig.js'), /setDragonMounter\(\(\) => setMode\(TRANSPORT_MODES\.Dragon\)\);/);
  assert.match(src('src/systems/horse/horseCart.js'), /function handleSummonTransport\(\) \{\n\s*const d = dragonKeepDoor\(\);\n\s*if \(d\?\.summonsFirst\(\)\) \{\n\s*d\.call\(\);\n\s*return;\n\s*\}\n\s*say\(summonTransport\(\)\.text\);\n\s*\}/);
  assert.deepEqual(dragonCardWords({ where: DRAGON_WHERE.Ridden }).state, 'Riding');
  assert.deepEqual(dragonCardWords({ where: DRAGON_WHERE.Waiting, coming: true }).state, 'Coming');
  assert.match(dragonCardWords({ where: DRAGON_WHERE.Waiting, far: 42 }).line, /42 m away/);
  assert.equal(dragonCardWords({ where: DRAGON_WHERE.Away }).state, 'Away');
  const w = src('src/scenes/world.js');
  for (const re of [
    /const _dragonPick = dragonSky \? pickActivatableHit\(cam\.pos, useFwd, dragonSky\.keepTargets\(\), collider\) : null;/,
    /\n\s*dragon: _dragonPick,/,
    /else if \(_race\.dragonWins\) dragonSky\.keepActivate\(_dragonPick\.key, _dragonPick\.distance, getInteractionMode\(\), plaqueActionFor\(_dragonPick\.key\)\);/,
    /dragon: dragonSky \? pickActivatableHit\(cam\.pos, _hd, dragonSky\.keepTargets\(\), collider\) : null,/,
    /\(key\) => dragonSky\?\.keepHoverName\(key\) \?\? null,/,
    /frame\.wr = wagonRiders\?\.word\(\) \?\? null; if \(cell\) dragonSky\?\.keepWord\(frame, full, campToWire\);/,
    /exteriorFoes\.setOnDragonKeep\(\(from, dk\) => dragonSky\?\.keepPeer\(from, dk, campToScene\), \(\) => dragonSky\?\.keepPeersClear\(\)\);/,
    /townTalk, makeInventoryWindow,/,
    /\n\s*aboard: \(\) => isOnShip\(playerEntity, playerEntity\.boardShipPosition \?\? null, playerTravelPixel\(\)\) \|\| !!\(csaBoatUnderMe\(\) \?\? _csaBuckets\.get\(player\.groundKey\)\?\.boat\) \|\| !!naval\?\.aboard\?\.\(\),/,
  ]) assert.match(w, re);
  assert.match(src('src/scenes/exteriorFoes.js'), /if \(data\.dk !== undefined\) _onDragonKeep\?\.\(from, data\.dk, _now\(\)\);/);
  assert.match(src('src/scenes/dragonHost.js'), /keep\.tick\(\);/);
  assert.equal(DRAGON_MOUNT_TEMPLATE, 1820);
});

test('DRAGON-KEEP-SIZE (2026-10-31, the owner: "the dragon when in possession of a player is too large unmounted"): my tamed dragon waiting off its back is drawn at its sprite\'s own size - the size it is ridden at, as net/remotePlayers.js draws its rider - never the boss\'s DRAGON_SCALE (mutants: the boss\'s scale; the host handing it on)', async () => {
  const { w, entity, keep } = world();
  entity.dragonKeep = { ...freshDragonKeep(), where: DRAGON_WHERE.Waiting, nx: 0, nz: 400 };
  keep.tick();
  keep.batches();
  await new Promise((r) => setTimeout(r, 0));   // its pictures' texture, asked once
  const out = keep.batches();
  assert.equal(DRAGON_KEEP_SCALE, 1);
  assert.ok(out.length === 1 && w.made, 'drawn');
  assert.deepEqual([w.made.w, w.made.h, Math.abs(out[0].size.w), out[0].size.h], [200 * 0.025, 160 * 0.025, 200 * 0.025, 160 * 0.025], 'its sprite\'s own size (200 x 160 at GLOBAL_SCALE)');
  assert.doesNotMatch(src('src/scenes/dragonHost.js'), /createDragonKeep\(\{[^}]*scale/, 'the sky host hands it no scale of its own');
});
