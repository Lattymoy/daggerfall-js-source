// OW6L (2026-09-29, the product owner: "Everything needs that persistence between players in the overworld."): THE
// OVERWORLD'S LEDGER, KEPT BY THE RELAY - one a cell room. The law in node (net/overworldLaw.js: the ids, their lives,
// their pixels round-tripped against the bands' and the raiders' own rolls, the min-merge, the bounds, the prune, the
// junk); its pinned copies held to their homes (travelBands.js, seaRaiders.js, spawnedDungeons.js - never imported: the
// relay's graph stays flat); the `ow` frame both ways (net/wire.js); the relay over the real Room (server/src/index.js: a
// word folded, written and fanned, junk outside a cell or its margin, the bucket, a later hello's welcome, the ledger
// through an empty room and a wake, the prune on load, the speaker behind the ledger, the fan's budget); the session
// (net/online.js: the word down the primary cell's socket only at a relay that keeps it, the frames and the welcome in -
// a halo's too); and the spawn ledger's merge (world/spawnedDungeons.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  OW_BAND_LIFE_MS, OW_RAIDER_LIFE_MS, OW_BAND_CELL_PX, OW_RAIDER_CELL_PX, OW_WORLD_SALT, OW_SPAWN_CHANCE, OW_CELL_MARGIN_PX,
  OW_ROW_KEEP_MS, OW_ROW_KEEP_MIN, OW_ROW_SLACK_MIN, OW_WORD_IDS_MAX, OW_WORD_ROWS_MAX, OW_CELL_SPENT_MAX, OW_CELL_ROWS_MAX,
  owIdKind, owIdLife, owIdLive, owIdUntil, owIdPixel, owLifeMs, owCellSquare, owIdInCell, owRowInCell, owSpawnsDungeon,
  owRowKey, owRowSane, owRowFits, newOwLedger, owLedgerEmpty, owLedgerOf, owFoldSpent, owFoldRows, owRowsBehind, owPrune,
  toWelcome,
} from '../src/net/overworldLaw.js';
import {
  parseClient, validOwIn, validOwOut, owGate, owRoomGate, relaySupportsOverworld, OW_RELAY_MIN, OW_HZ_MAX, OW_BURST_MAX,
  OW_ROOM_HZ_MAX, OW_KINDS, OW_LEDGER_KEY, OW_BAND_ID_RE, OW_RAIDER_ID_RE, owWireRow, cellOfRoom, RELAY_VERSION,
  worldRoom, WORLD_CELL, PIXEL_UNITS, DROP_STRIKES_MAX, sharedClassicMinutes, ONLINE_MINUTES_PER_MS,
} from '../src/net/wire.js';
import { BAND_LIFE_MS, BAND_CELL_PX, BAND_ID_RE, bandsNear, bandPixelOf, wanderAt, BAND_WANDER_MPS } from '../src/systems/travelBands.js';
import { RAIDER_LIFE_MS, RAIDER_CELL_PX, RAIDER_SAIL_MPS, raidersNear, pixelOfNative } from '../src/systems/seaRaiders.js';
import { WORLD_SALT, ANY_SPAWN_CHANCE, spawnsDungeon, createSpawnLedger } from '../src/world/spawnedDungeons.js';
import { RAID_SLACK_MINUTES } from '../src/net/raidLaw.js';
import { fakeRooms } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

// ═══ THE FIXTURES ═════════════════════════════════════════════════════════════════════════════════

const T0 = Date.UTC(2027, 3, 1, 12, 0, 0);   // a moment of the shared clock, wall ms - past the keep's own length from the epoch, so its whole window is real minutes
const M0 = sharedClassicMinutes(T0);         // ...and in classic minutes
const PX = 100, PY = 200;                    // a pixel of the cell: world:6,12 - [96,112) x [192,208), widened [88,120) x [184,216)
const CELL = worldRoom(PX, PY);
const lifeB = (ms = T0) => Math.floor(ms / BAND_LIFE_MS);
const lifeR = (ms = T0) => Math.floor(ms / RAIDER_LIFE_MS);
/** A band whose cell origin is inside CELL's widened square: x = 2cx in [88, 120), y = 499 - 2cy in [184, 216). */
const bandIn = (i = 0, ms = T0) => `b${44 + (i % 16)}.${142 + Math.floor(i / 16)}.${lifeB(ms)}`;
/** A raider whose cell origin (6cx, 6cy) = (96, 192) is inside it. */
const raiderIn = (ms = T0) => `r16.32.${lifeR(ms)}`;
/** Spawn pixels (the roll's own) inside the cell's square, and one it leaves empty. */
const SPAWNS = [];
for (let py = 192; py < 208; py++) for (let px = 96; px < 112; px++) if (spawnsDungeon(WORLD_SALT, px, py)) SPAWNS.push([px, py]);
const [S1, S2, S3] = SPAWNS;
let EMPTY = null;
for (let py = 192; py < 208 && !EMPTY; py++) for (let px = 96; px < 112 && !EMPTY; px++) if (!spawnsDungeon(WORLD_SALT, px, py)) EMPTY = [px, py];
/** A spawn pixel in the margin (west of the square, inside the widening), and one just past it. */
const firstSpawn = (xs, y) => { for (const x of xs) if (spawnsDungeon(WORLD_SALT, x, y)) return [x, y]; return null; };
const EDGE = firstSpawn([88, 89, 90, 91, 92, 93, 94, 95], 200);
const BEYOND = firstSpawn([87, 86, 85, 84, 83, 82, 81, 80], 200);
const ON = { x: PX * PIXEL_UNITS + 16384, y: 0, z: (499 - PY) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };

test('OW6L law: THE PINNED COPIES are their homes\' own - the lives, the cells, the band\'s id shape, the salt and the chance - and the spawn roll agrees with spawnsDungeon on every pixel of the map; the keep is sixty real days of the shared clock, the slack two clocks\' skew (mutants: a life, a cell, the chance or the salt off; the roll off its lane)', () => {
  assert.equal(OW_BAND_LIFE_MS, BAND_LIFE_MS, 'travelBands.js BAND_LIFE_MS');
  assert.equal(OW_RAIDER_LIFE_MS, RAIDER_LIFE_MS, 'seaRaiders.js RAIDER_LIFE_MS');
  assert.equal(OW_BAND_CELL_PX, BAND_CELL_PX);
  assert.equal(OW_RAIDER_CELL_PX, RAIDER_CELL_PX);
  assert.equal(String(OW_BAND_ID_RE), String(BAND_ID_RE), 'the wire\'s band id is travelBands.js\'s own');
  assert.equal(String(OW_RAIDER_ID_RE), String(BAND_ID_RE).replace('^b', '^r'), 'a raider\'s is the band\'s shape under its own letter');
  assert.equal(OW_WORLD_SALT, WORLD_SALT);
  assert.equal(OW_SPAWN_CHANCE, ANY_SPAWN_CHANCE, 'either kind of spawn - an elite one is a spawn too');
  let off = 0;
  for (let px = 0; px < 1000; px++) for (let py = 0; py < 500; py++) if (owSpawnsDungeon(px, py) !== spawnsDungeon(WORLD_SALT, px, py)) off++;
  assert.equal(off, 0, 'the relay\'s roll is the world\'s, pixel for pixel');
  assert.equal(OW_ROW_KEEP_MS, 60 * 24 * 3600 * 1000);
  assert.equal(OW_ROW_KEEP_MIN, sharedClassicMinutes(T0 + OW_ROW_KEEP_MS) - M0, 'the wire\'s minutes-per-ms law');
  assert.equal(OW_ROW_KEEP_MIN, OW_ROW_KEEP_MS * ONLINE_MINUTES_PER_MS);
  assert.equal(OW_ROW_SLACK_MIN, RAID_SLACK_MINUTES);
  const r = raidersNear({ at: { x: PX, y: PY }, ms: T0, open: () => true, sea: () => true });
  assert.ok(r.length && r.every((x) => owIdKind(x.id) === 'raider'), 'seaRaiders.js\'s own ids are raiders\' ids');
  assert.ok(bandsNear({ at: bandPixelOf({ x: PX, y: PY }), ms: T0, night: false, ok: () => true }).every((b) => owIdKind(b.id) === 'band'));
});

test('OW6L law: THE IDS - a kind by its letter, a life by its tail; live while its life is this one or the last on the shared clock, each kind by its own life; spent until the end of the life after its own; anything else is no id (mutants: the last life refused; the next let in; one kind\'s life for both; the end one life short)', () => {
  const b = bandIn(), r = raiderIn();
  assert.equal(owIdKind(b), 'band'); assert.equal(owIdKind(r), 'raider');
  for (const junk of ['x1.2.3', 'b1.2', 'b1.2.x', 'b12345.1.1', 'b1.2.1234567890', '', null, 7, 'B1.2.3', 'r1..3']) assert.equal(owIdKind(junk), null, String(junk));
  assert.equal(owIdKind('b-3.-4.5'), 'band', 'the shape admits a sign, as BAND_ID_RE does');
  assert.equal(owIdLife(b), lifeB()); assert.equal(owIdLife('junk'), null);
  assert.equal(owLifeMs('band'), BAND_LIFE_MS); assert.equal(owLifeMs('raider'), RAIDER_LIFE_MS); assert.ok(Number.isNaN(owLifeMs(null)));
  assert.ok(owIdLive(b, T0));
  assert.ok(owIdLive(bandIn(0, T0 - BAND_LIFE_MS), T0), 'the life just over');
  assert.ok(!owIdLive(bandIn(0, T0 - 2 * BAND_LIFE_MS), T0), 'two lives gone');
  assert.ok(!owIdLive(bandIn(0, T0 + BAND_LIFE_MS), T0), 'a life not yet begun');
  assert.ok(owIdLive(raiderIn(T0 - RAIDER_LIFE_MS), T0), 'a raider\'s last life, by its own twenty minutes');
  assert.ok(!owIdLive(raiderIn(T0 - 2 * RAIDER_LIFE_MS), T0));
  const edge = (lifeB() + 1) * BAND_LIFE_MS;   // the life's own boundary
  assert.ok(owIdLive(b, edge) && !owIdLive(b, edge + BAND_LIFE_MS), 'live through the next life, not a millisecond past it');
  assert.ok(!owIdLive(b, NaN) && !owIdLive('junk', T0));
  assert.equal(owIdUntil(b), (lifeB() + 2) * BAND_LIFE_MS, 'remembered through its own life and the next (bandPrune\'s own)');
  assert.equal(owIdUntil(r), (lifeR() + 2) * RAIDER_LIFE_MS);
  assert.ok(Number.isNaN(owIdUntil('junk')));
});

test('OW6L law: THE PIXEL - a real band (bandsNear) and a real raider (raidersNear) round-trip through owIdPixel to within one cell of where each was born, and of where each is now within its walk: the bands in their own rows (bandY = 499 - mapY), the raiders in the map\'s; the cell\'s square widened by the margin (mutants: a band\'s row unflipped; a raider\'s flipped; a cell\'s size off; the margin dropped at any edge)', () => {
  const bands = bandsNear({ at: bandPixelOf({ x: PX, y: PY }), ms: T0, night: false, ok: () => true });
  assert.ok(bands.length >= 8, 'a reach of bands about the pixel');
  const walk = (BAND_WANDER_MPS * BAND_LIFE_MS / 1000) / 819.2;   // the most pixels a band walks in its life
  for (const b of bands) {
    const at = owIdPixel(b.id);
    const bx = Math.floor(b.born.x / 32768), by = 499 - Math.floor(b.born.z / 32768);   // its birth's MAP pixel
    assert.ok(Math.abs(bx - at.x) < BAND_CELL_PX && Math.abs(by - at.y) < BAND_CELL_PX, `${b.id}: born at ${bx},${by}, its cell's origin ${at.x},${at.y}`);
    const now = wanderAt(b, T0 + BAND_LIFE_MS - 1, () => true);
    assert.ok(Math.abs(Math.floor(now.x / 32768) - at.x) <= BAND_CELL_PX + walk && Math.abs(499 - Math.floor(now.z / 32768) - at.y) <= BAND_CELL_PX + walk);
  }
  assert.deepEqual(owIdPixel(`b50.150.${lifeB()}`), { x: 100, y: 199 });
  const raiders = raidersNear({ at: { x: PX, y: PY }, ms: T0, open: () => true, sea: () => true });
  const sail = (RAIDER_SAIL_MPS * RAIDER_LIFE_MS / 1000) / 819.2;
  for (const r of raiders) {
    const at = owIdPixel(r.id), born = pixelOfNative(r.born.x, r.born.z), now = pixelOfNative(r.x, r.z);
    assert.ok(born.x - at.x >= 0 && born.x - at.x < RAIDER_CELL_PX && born.y - at.y >= 0 && born.y - at.y < RAIDER_CELL_PX, `${r.id}: born at ${born.x},${born.y}, its cell's origin ${at.x},${at.y}`);
    assert.ok(Math.abs(now.x - at.x) <= RAIDER_CELL_PX + sail && Math.abs(now.y - at.y) <= RAIDER_CELL_PX + sail);
  }
  assert.deepEqual(owIdPixel(raiderIn()), { x: 96, y: 192 });
  assert.equal(owIdPixel('junk'), null);
  // the square
  assert.deepEqual(cellOfRoom(CELL), [6, 12]); assert.equal(cellOfRoom('dungeon:m123'), null);
  assert.deepEqual(owCellSquare(CELL), { x0: 6 * WORLD_CELL - OW_CELL_MARGIN_PX, y0: 12 * WORLD_CELL - OW_CELL_MARGIN_PX, x1: 7 * WORLD_CELL + OW_CELL_MARGIN_PX, y1: 13 * WORLD_CELL + OW_CELL_MARGIN_PX });
  assert.equal(OW_CELL_MARGIN_PX, 8);
  assert.equal(owCellSquare('dungeon:m123'), null);
  for (const [x, y, inside] of [[88, 200, true], [87, 200, false], [119, 200, true], [120, 200, false], [100, 184, true], [100, 183, false], [100, 215, true], [100, 216, false]]) {
    assert.equal(owRowInCell([x, y, M0], CELL), inside, `${x},${y}`);
  }
  assert.ok(owIdInCell(bandIn(), CELL) && owIdInCell(raiderIn(), CELL));
  assert.ok(!owIdInCell(`b30.150.${lifeB()}`, CELL), 'a band thirty pixels west');
  assert.ok(!owIdInCell(`b50.130.${lifeB()}`, CELL), 'a band\'s rows are its own: cy 130 is map row 239');
  assert.ok(!owIdInCell(bandIn(), 'dungeon:m123') && !owIdInCell('junk', CELL));
});

test('OW6L law: THE SPENT, FOLDED - a live id is taken once, with its end; the same again, one of another life or no id at all changes nothing; the spent past their end go first, then the oldest past OW_CELL_SPENT_MAX; a word\'s ids bounded (mutants: an id taken twice; a stale id taken; the cap gone; the newest dropped instead of the oldest)', () => {
  const led = newOwLedger();
  assert.ok(owLedgerEmpty(led));
  assert.deepEqual(owFoldSpent(led, [bandIn(0), raiderIn(), bandIn(0)], T0), [bandIn(0), raiderIn()], 'each once');
  assert.deepEqual(led.sp, [[bandIn(0), owIdUntil(bandIn(0))], [raiderIn(), owIdUntil(raiderIn())]]);
  assert.deepEqual(owFoldSpent(led, [bandIn(0)], T0 + 1000), [], 'held already');
  assert.deepEqual(owFoldSpent(led, [bandIn(1, T0 - 2 * BAND_LIFE_MS), 'junk', 7], T0), [], 'another life, and no id at all');
  assert.ok(!owLedgerEmpty(led));
  // the end, then the bound
  const later = owIdUntil(bandIn(0));
  assert.deepEqual(owFoldSpent(led, [bandIn(1, later)], later), [bandIn(1, later)]);
  assert.deepEqual(led.sp.map((e) => e[0]), [raiderIn(), bandIn(1, later)], 'the band past its end went; the raider\'s twenty minutes still run');
  const full = newOwLedger();
  for (let i = 0; i < OW_CELL_SPENT_MAX + 3; i += 1) owFoldSpent(full, [bandIn(i)], T0);
  assert.equal(full.sp.length, OW_CELL_SPENT_MAX);
  assert.equal(full.sp[0][0], bandIn(3), 'the oldest out');
  assert.equal(full.sp.at(-1)[0], bandIn(OW_CELL_SPENT_MAX + 2), 'the newest kept');
  assert.equal(owFoldSpent(newOwLedger(), Array.from({ length: OW_WORD_IDS_MAX + 4 }, (_, i) => bandIn(i)), T0).length, OW_WORD_IDS_MAX, 'a word\'s own bound');
  assert.deepEqual(owFoldSpent(led, 'x', T0), []); assert.deepEqual(owFoldSpent(led, [bandIn(2)], NaN), []);
});

test('OW6L law: THE ROWS, MIN-MERGED - a row is its pixel\'s earliest first sight and earliest clear, never raised, the same in any order; the rows that changed are answered, and the speaker\'s rows the ledger beats; a row is sane on the spawn roll with its clear after its sight, and fits inside the keep\'s window, a clock a little ahead taken at now (mutants: the merge keeps the later; a clear raised; the roll not asked; the window or the slack off; an unchanged row re-said)', () => {
  const [x, y] = S1, [x2, y2] = S2;
  const led = newOwLedger();
  assert.deepEqual(owFoldRows(led, [[x, y, M0 - 100]], M0), [[x, y, M0 - 100]], 'a new row, whole');
  assert.deepEqual(owFoldRows(led, [[x, y, M0 - 50]], M0), [], 'a later sight changes nothing');
  assert.deepEqual(owFoldRows(led, [[x, y, M0 - 200, M0 - 10]], M0), [[x, y, M0 - 200, M0 - 10]], 'an earlier sight, and a clear');
  assert.deepEqual(owFoldRows(led, [[x, y, M0 - 150, M0 - 5]], M0), [], 'a later clear changes nothing');
  assert.deepEqual(owFoldRows(led, [[x, y, M0 - 100]], M0), [], 'nor a word without the clear');
  assert.deepEqual(owFoldRows(led, [[x, y, M0 - 150, M0 - 20]], M0), [[x, y, M0 - 200, M0 - 20]], 'an earlier clear moves the clear alone');
  assert.deepEqual(led.dg[owRowKey(x, y)], [x, y, M0 - 200, M0 - 20]);
  // any order, one row (the merge commutes)
  const words = [[x2, y2, M0 - 30], [x2, y2, M0 - 90, M0 - 40], [x2, y2, M0 - 60, M0 - 45], [x2, y2, M0 - 10]];
  const a = newOwLedger(), b = newOwLedger();
  for (const w of words) owFoldRows(a, [w], M0);
  for (const w of [...words].reverse()) owFoldRows(b, [w], M0);
  assert.deepEqual(a.dg, b.dg);
  assert.deepEqual(a.dg[owRowKey(x2, y2)], [x2, y2, M0 - 90, M0 - 45]);
  assert.deepEqual(owFoldRows(newOwLedger(), [[x2, y2, M0 - 30], [x2, y2, M0 - 40]], M0), [[x2, y2, M0 - 40]], 'a pixel twice in a word: answered once, as it stands');
  // the speaker behind
  assert.deepEqual(owRowsBehind(led, [[x, y, M0 - 100]]), [[x, y, M0 - 200, M0 - 20]], 'a later sight and no clear: told the ledger\'s');
  assert.deepEqual(owRowsBehind(led, [[x, y, M0 - 200, M0 - 20]]), [], 'a word as the ledger holds it is behind nothing');
  assert.deepEqual(owRowsBehind(led, [[x, y, M0 - 200, M0 - 1]]), [[x, y, M0 - 200, M0 - 20]], 'a later clear');
  assert.deepEqual(owRowsBehind(led, [[x, y, M0 - 100, M0 - 20]]), [[x, y, M0 - 200, M0 - 20]], 'a later sight, the clear the same');
  const uncleared = newOwLedger();
  owFoldRows(uncleared, [[x2, y2, M0 - 50]], M0);
  assert.deepEqual(owRowsBehind(uncleared, [[x2, y2, M0 - 10]]), [[x2, y2, M0 - 50]], 'a later sight of a row nobody cleared');
  assert.deepEqual(owRowsBehind(uncleared, [[x2, y2, M0 - 50, M0 - 5]]), [], 'a word AHEAD of the ledger is behind nothing');
  assert.deepEqual(owRowsBehind(led, [[x, y, M0 - 100]], [[x, y, M0 - 200, M0 - 20]]), [], 'a row the fold moved is fanned, not answered again');
  assert.deepEqual(owRowsBehind(led, [S3.concat(M0)]), [], 'a pixel the ledger holds no row for');
  // sanity: the roll and the clear's order - junk
  assert.ok(owRowSane([x, y, 5]) && owRowSane([x, y, 5, 5]) && owRowSane([x, y, 5, null]));
  assert.ok(!owRowSane([EMPTY[0], EMPTY[1], 5]), 'a pixel the roll leaves empty');
  assert.ok(!owRowSane([x, y, 5, 4]), 'cleared before it was seen');
  for (const bad of [[x, y], [x, y, -1], [x, y, NaN], [1000, 1, 5], [x, 500, 5], [x + 0.5, y, 5], [x, y, 5, 6, 7], 'x', null]) assert.ok(!owRowSane(bad), JSON.stringify(bad));
  // fit: the keep's window, and the slack
  assert.deepEqual(owRowFits([x, y, M0 - OW_ROW_KEEP_MIN], M0), [x, y, M0 - OW_ROW_KEEP_MIN], 'the keep\'s first minute');
  assert.equal(owRowFits([x, y, M0 - OW_ROW_KEEP_MIN - 1], M0), null, 'past the keep: dropped');
  assert.deepEqual(owRowFits([x, y, M0 + OW_ROW_SLACK_MIN], M0), [x, y, M0], 'a clock a little ahead is taken at now');
  assert.equal(owRowFits([x, y, M0 + OW_ROW_SLACK_MIN + 1], M0), null, 'one further is no clock');
  assert.deepEqual(owRowFits([x, y, M0 - 5, M0 + 1], M0), [x, y, M0 - 5, M0]);
  assert.equal(owRowFits([x, y, M0 - 5, M0 + OW_ROW_SLACK_MIN + 1], M0), null);
  assert.equal(owRowFits([EMPTY[0], EMPTY[1], M0], M0), null); assert.equal(owRowFits([x, y, M0], NaN), null);
  assert.deepEqual(owFoldRows(newOwLedger(), [[x, y, M0 - OW_ROW_KEEP_MIN - 1], [EMPTY[0], EMPTY[1], M0], 'x'], M0), [], 'nothing a ledger may take');
});

test('OW6L law: THE BOUNDS AND THE PRUNE - OW_CELL_ROWS_MAX rows, the oldest first sight out first; a row past the keep and a spent id past its end pruned (answered: something went); the welcome is the live ledger, bounded, and never touches it; a stored ledger reads back only what is well formed (mutants: the rows unbounded; the newest sight dropped; the prune never answering; the welcome stale)', () => {
  const led = newOwLedger();
  const pixels = [];
  for (let py = 0; py < 500 && pixels.length < OW_CELL_ROWS_MAX + 2; py++) for (let px = 0; px < 1000 && pixels.length < OW_CELL_ROWS_MAX + 2; px++) if (owSpawnsDungeon(px, py)) pixels.push([px, py]);
  for (let i = 0; i < pixels.length; i += OW_WORD_ROWS_MAX) owFoldRows(led, pixels.slice(i, i + OW_WORD_ROWS_MAX).map(([px, py], j) => [px, py, M0 - 1000 + i + j]), M0);
  assert.equal(Object.keys(led.dg).length, OW_CELL_ROWS_MAX);
  assert.equal(led.dg[owRowKey(...pixels[0])], undefined, 'the oldest sight went');
  assert.equal(led.dg[owRowKey(...pixels[1])], undefined);
  assert.ok(led.dg[owRowKey(...pixels[2])] && led.dg[owRowKey(...pixels.at(-1))], 'the newest kept');
  // the prune
  const p = newOwLedger();
  owFoldSpent(p, [bandIn(0), raiderIn()], T0);
  owFoldRows(p, [[...S1, M0 - 10], [...S2, M0 - OW_ROW_KEEP_MIN + 5]], M0);
  assert.equal(owPrune(p, T0), false, 'nothing due');
  const w = toWelcome(p, T0);
  assert.deepEqual(w, { sp: [bandIn(0), raiderIn()], dg: [[...S1, M0 - 10], [...S2, M0 - OW_ROW_KEEP_MIN + 5]] });
  const t1 = owIdUntil(bandIn(0));
  assert.deepEqual(toWelcome(p, t1).sp, [raiderIn()], 'the welcome says the live alone...');
  assert.equal(p.sp.length, 2, '...and touches nothing');
  const t2 = T0 + 10 / ONLINE_MINUTES_PER_MS;   // ten classic minutes on: the second row is past the keep
  assert.equal(toWelcome(p, t2).dg.length, 1);
  assert.equal(owPrune(p, owIdUntil(raiderIn())), true, 'the spent past their end, the row past the keep');
  assert.deepEqual(p.sp, []);
  assert.deepEqual(Object.keys(p.dg), [owRowKey(...S1)]);
  assert.equal(owPrune(newOwLedger(), NaN), false);
  const big = newOwLedger();
  for (let i = 0; i < OW_CELL_SPENT_MAX; i += 1) owFoldSpent(big, [bandIn(i)], T0);
  big.sp.push([bandIn(OW_CELL_SPENT_MAX), T0 + 1]);
  assert.equal(owPrune(big, T0), true, 'past the bound: pruned');
  assert.equal(big.sp.length, OW_CELL_SPENT_MAX);
  // storage read back
  assert.deepEqual(owLedgerOf(undefined), newOwLedger());
  assert.deepEqual(owLedgerOf({ sp: [[bandIn(0), 5], [bandIn(0), 6], ['junk', 5], [bandIn(1), 'x'], 'x'], dg: { a: [...S1, 7], b: [...EMPTY, 7], c: [...S2, 9, 8], d: 'x' } }),
    { sp: [[bandIn(0), 5]], dg: { [owRowKey(...S1)]: [...S1, 7] } });
  const copy = owLedgerOf(p);
  assert.deepEqual(copy, p); assert.notEqual(copy.dg[owRowKey(...S1)], p.dg[owRowKey(...S1)], 'a copy, never the live rows');
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════

test('OW6L wire: the `ow` word - after a hello, projected by validOwIn, the whole word refused for one bad entry or past its bound; a cell\'s frames and welcome halves projected by validOwOut, cut at the cell\'s bounds; the frames\' own bucket; the relay that keeps the ledger is world127 and this build\'s (mutants: a bound off by one; the relay floor below or above 127; a bad entry let through)', () => {
  assert.deepEqual(OW_KINDS, ['sp', 'dg']);
  assert.equal(OW_WORD_IDS_MAX, 8); assert.equal(OW_WORD_ROWS_MAX, 8); assert.equal(OW_CELL_SPENT_MAX, 64); assert.equal(OW_CELL_ROWS_MAX, 512);
  const sp = { t: 'ow', k: 'sp', ids: [bandIn(0), raiderIn()] }, dg = { t: 'ow', k: 'dg', rows: [[...S1, M0], [...S2, M0 - 5, M0]] };
  assert.deepEqual(parseClient(JSON.stringify(sp)), { error: 'ow before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ ...sp, junk: 1 }), { hasHello: true }), { t: 'ow', k: 'sp', ids: [bandIn(0), raiderIn()] });
  assert.deepEqual(parseClient(JSON.stringify(dg), { hasHello: true }), { t: 'ow', ...dg });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'ow', k: 'dg', rows: [[...S1, M0, null]] }), { hasHello: true }), { t: 'ow', k: 'dg', rows: [[...S1, M0]] }, 'a null clear is none');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'ow', k: 'xx', ids: [] }), { hasHello: true }), { error: 'bad ow' });
  assert.deepEqual(validOwIn({ k: 'sp', ids: [bandIn(0), bandIn(0)] }), { k: 'sp', ids: [bandIn(0)] }, 'each id once');
  for (const bad of [{ k: 'sp', ids: [] }, { k: 'sp', ids: 'x' }, { k: 'sp', ids: [bandIn(0), 'x1.2.3'] }, { k: 'sp', ids: Array.from({ length: OW_WORD_IDS_MAX + 1 }, (_, i) => bandIn(i)) },
    { k: 'dg', rows: [] }, { k: 'dg', rows: [[...S1]] }, { k: 'dg', rows: [[...S1, M0], [1000, 1, M0]] }, { k: 'dg', rows: [[...S1, -1]] }, { k: 'dg', rows: [[...S1, M0, 'x']] },
    { k: 'dg', rows: Array.from({ length: OW_WORD_ROWS_MAX + 1 }, () => [...S1, M0]) }, { k: 'dg', ids: [bandIn(0)] }, null, 'ow']) {
    assert.equal(validOwIn(bad), null, JSON.stringify(bad));
  }
  assert.equal(validOwIn({ k: 'sp', ids: Array.from({ length: OW_WORD_IDS_MAX }, (_, i) => bandIn(i)) }).ids.length, OW_WORD_IDS_MAX, 'the top end is in');
  assert.equal(validOwIn({ k: 'dg', rows: Array.from({ length: OW_WORD_ROWS_MAX }, () => [...S1, M0]) }).rows.length, OW_WORD_ROWS_MAX);
  assert.deepEqual(owWireRow([999, 499, 0]), [999, 499, 0]); assert.equal(owWireRow([999, 499, 0, -1]), null);
  // out
  assert.deepEqual(validOwOut({ k: 'sp', ids: [bandIn(0), 'junk', bandIn(0), 5, raiderIn()], x: 1 }), { k: 'sp', ids: [bandIn(0), raiderIn()] }, 'the good ones, each once');
  assert.deepEqual(validOwOut({ k: 'dg', rows: [[...S1, M0], 'x', [1, 2], [...S2, M0, M0]] }), { k: 'dg', rows: [[...S1, M0], [...S2, M0, M0]] });
  assert.equal(validOwOut({ k: 'sp', ids: ['junk'] }), null, 'nothing left: no word');
  assert.equal(validOwOut({ k: 'dg', rows: 'x' }), null); assert.equal(validOwOut({ k: 'st' }), null); assert.equal(validOwOut(null), null);
  assert.equal(validOwOut({ k: 'sp', ids: Array.from({ length: OW_CELL_SPENT_MAX + 5 }, (_, i) => bandIn(i)) }).ids.length, OW_CELL_SPENT_MAX, 'cut at the cell\'s own bound');
  assert.equal(validOwOut({ k: 'dg', rows: Array.from({ length: OW_CELL_ROWS_MAX + 5 }, () => [...S1, M0]) }).rows.length, OW_CELL_ROWS_MAX);
  // the bucket, and the relay's number
  let bucket = null, pass = 0;
  for (let i = 0; i < OW_BURST_MAX + 3; i++) { const g = owGate(bucket, 1000); bucket = g.bucket; if (g.pass) pass++; }
  assert.equal(pass, OW_BURST_MAX, 'a burst deep');
  assert.equal(owGate(bucket, 1000 + 1000).pass, true, 'and refilled at OW_HZ_MAX a second');
  assert.equal(OW_HZ_MAX, 4); assert.equal(OW_BURST_MAX, 8); assert.equal(OW_ROOM_HZ_MAX, 16);
  let rb = null, rpass = 0;
  for (let i = 0; i < OW_ROOM_HZ_MAX + 3; i++) { const g = owRoomGate(rb, 1000); rb = g.bucket; if (g.pass) rpass++; }
  assert.equal(rpass, OW_ROOM_HZ_MAX);
  assert.equal(OW_RELAY_MIN, 127, 'world125 (VOICE1, reverted) and world126 (DISCORD-GATES\' branch) are never reused');
  assert.deepEqual(['world124', 'world125', 'world126', 'world127', 'world130', 'junk', null].map(relaySupportsOverworld), [false, false, false, true, true, false, false]);
  assert.equal(RELAY_VERSION, 'world155');   // ARENA4 moved it on last (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT's badge vocabulary (world129); before it THE MERGE with PR 418: WB8 moved it on last (world128 - world126 on its branch, one relay past OW6L's world127); relaySupportsOverworld holds past it
  assert.ok(relaySupportsOverworld(RELAY_VERSION), 'this build\'s relay keeps the ledger');
  assert.equal(OW_LEDGER_KEY, 'ow:led'); assert.ok(!OW_LEDGER_KEY.startsWith('world:'), 'never under the prefix a cell\'s alarm sweeps');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════

const ows = (ws, k) => ws.sent.filter((m) => m.t === 'ow' && (!k || m.k === k));
const welcomeOf = (ws) => ws.sent.filter((m) => m.t === 'welcome').at(-1);
async function withOw(fn, { start = T0 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const r = world.room(CELL);
  const say = (ws, o, room = r) => room.raw(ws, JSON.stringify({ t: 'ow', ...o }));
  try { await fn({ world, r, say, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}

test('OW6L relay: A WORD in its cell is folded, WRITTEN and FANNED to everyone hello\'d there - its speaker too (the raid\'s law: its machine min-merges the cell\'s word back, and hearing it is how it knows the cell took it); the same again moves nothing and says nothing; a row the fold moved is fanned as it now stands (mutants: the fan unsaid; the speaker left out; the ledger unwritten; a word that moved nothing re-said)', async () => {
  await withOw(async ({ r, say, step }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { k: 'sp', ids: [bandIn(0), raiderIn()] });
    assert.deepEqual(ows(b), [{ t: 'ow', k: 'sp', ids: [bandIn(0), raiderIn()] }], 'the cell told');
    assert.deepEqual(ows(a), ows(b), 'the speaker too');
    assert.deepEqual(r.store.get(OW_LEDGER_KEY).sp.map((e) => e[0]), [bandIn(0), raiderIn()], 'written');
    step(300);
    await say(b, { k: 'sp', ids: [bandIn(0)] });
    assert.equal(ows(a).length, 1, 'held already: nothing said');
    await say(b, { k: 'sp', ids: [bandIn(0), bandIn(1)] });
    assert.deepEqual(ows(a).at(-1), { t: 'ow', k: 'sp', ids: [bandIn(1)] }, 'what the cell did not hold, alone');
    step(300);
    await say(a, { k: 'dg', rows: [[...S1, M0 - 50]] });
    assert.deepEqual(ows(b, 'dg'), [{ t: 'ow', k: 'dg', rows: [[...S1, M0 - 50]] }]);
    await say(b, { k: 'dg', rows: [[...S1, M0 - 70, M0 - 20]] });
    assert.deepEqual(ows(a, 'dg').at(-1), { t: 'ow', k: 'dg', rows: [[...S1, M0 - 70, M0 - 20]] }, 'the merge, as it stands');
    assert.deepEqual(r.store.get(OW_LEDGER_KEY).dg[owRowKey(...S1)], [...S1, M0 - 70, M0 - 20]);
    const heard = ows(a).length;
    step(300);
    await say(b, { k: 'dg', rows: [[...S1, M0 - 60, M0 - 10]] });
    assert.equal(ows(a).length, heard, 'a later sight and a later clear move nothing');
  });
});

test('OW6L relay: WHAT IT CHECKS - a word in any room but a cell is junk; an id or a row outside the cell\'s square widened by OW_CELL_MARGIN_PX is junk (one in the margin is taken), and so is a pixel the spawn roll leaves empty or a clear before its sight - nothing of a junk word is kept; an id of a life gone or a row out of its window is dropped quietly, never struck; a flood is struck out by the word\'s own bucket (mutants: the cell not asked; the margin not asked or not widened; the roll not asked; a stale word struck)', async () => {
  await withOw(async ({ world, r, say, step }) => {
    const place = world.room('dungeon:m123456');
    const y = place.connect(); await place.hello(y, 'peer-0008', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 });
    await say(y, { k: 'sp', ids: [bandIn(0)] }, place);
    assert.equal(y.meters.junk, 1, 'no ledger in a dungeon');
    assert.equal(place.store.has(OW_LEDGER_KEY), false);
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    const junk = async (o, why) => { const had = a.meters.junk ?? 0; step(300); await say(a, o); assert.equal(a.meters.junk, had + 1, why); };
    await junk({ k: 'sp', ids: [bandIn(0), `b30.150.${lifeB()}`] }, 'a band thirty pixels west, beside one that is here');
    await junk({ k: 'sp', ids: [`r20.32.${lifeR()}`] }, 'a raider\'s cell past the margin (120, 192)');
    await junk({ k: 'dg', rows: [[...BEYOND, M0]] }, 'a dungeon one pixel past the margin');
    await junk({ k: 'dg', rows: [[...EMPTY, M0]] }, 'a pixel the roll leaves empty');
    await junk({ k: 'dg', rows: [[...S1, M0, M0 - 1]] }, 'cleared before it was seen');
    assert.equal(r.store.has(OW_LEDGER_KEY), false, 'nothing of a junk word kept');
    assert.deepEqual(ows(b), [], 'and nothing said');
    const had = a.meters.junk;
    step(300);
    await say(a, { k: 'dg', rows: [[...EDGE, M0 - 5]] });
    assert.deepEqual(ows(b).at(-1), { t: 'ow', k: 'dg', rows: [[...EDGE, M0 - 5]] }, 'a dungeon in the margin is this cell\'s to hear');
    step(300);
    await say(a, { k: 'sp', ids: [bandIn(0, T0 - 2 * BAND_LIFE_MS)] });
    await say(a, { k: 'dg', rows: [[...S2, M0 - OW_ROW_KEEP_MIN - 1]] });
    await say(a, { k: 'dg', rows: [[...S2, M0 + OW_ROW_SLACK_MIN + 3]] });
    assert.equal(a.meters.junk, had, 'out of its time: dropped, never struck');
    assert.equal(ows(b).length, 1, 'and nothing said');
    assert.equal(r.store.get(OW_LEDGER_KEY).sp.length, 0);
    const f = r.connect(); await r.hello(f, 'peer-0003', ON);
    for (let i = 0; i < OW_BURST_MAX + DROP_STRIKES_MAX + 2; i++) await say(f, { k: 'sp', ids: [bandIn(0)] });
    assert.ok(f.closed, 'a flood is struck out by the word\'s own bucket');
    assert.equal(a.closed, null);
  });
});

test('OW6L relay: A LATER HELLO\'S WELCOME carries the cell\'s ledger (`ow`: the live spent and the kept rows) - none while it is empty, and no other room\'s ever; the ledger outlives the room emptying and the object\'s sleep; read back it is PRUNED - the spent past their end and the rows past the keep go, and the key with them once nothing is left (mutants: the welcome unsaid; the ledger unread from storage; the prune on load skipped)', async () => {
  await withOw(async ({ world, r, say, set }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    assert.equal('ow' in welcomeOf(a), false, 'an empty ledger: no field');
    await say(a, { k: 'sp', ids: [bandIn(0), raiderIn()] });
    await say(a, { k: 'dg', rows: [[...S1, M0 - 50, M0 - 20], [...S2, M0 - OW_ROW_KEEP_MIN + 1]] });
    const b = r.connect(); await r.hello(b, 'peer-0002', ON);
    assert.deepEqual(welcomeOf(b).ow, { sp: [bandIn(0), raiderIn()], dg: [[...S1, M0 - 50, M0 - 20], [...S2, M0 - OW_ROW_KEEP_MIN + 1]] }, 'the whole ledger, to a later hello');
    const place = world.room('dungeon:m123456');
    const d = place.connect(); await place.hello(d, 'peer-0004', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 });
    assert.equal('ow' in welcomeOf(d), false, 'no other room has one');
    await r.drop(a); await r.drop(b);
    r.wake();   // the object slept: a fresh instance over the same storage
    const c = r.connect(); await r.hello(c, 'peer-0003', ON);
    assert.deepEqual(welcomeOf(c).ow.sp, [bandIn(0), raiderIn()], 'kept through everyone leaving and a wake');
    await r.drop(c);
    // past the band's end and the second row's keep, a new instance reads it back pruned
    set(owIdUntil(bandIn(0)));
    r.wake();
    const e = r.connect(); await r.hello(e, 'peer-0005', ON);
    assert.deepEqual(welcomeOf(e).ow, { sp: [raiderIn()], dg: [[...S1, M0 - 50, M0 - 20]] });
    assert.deepEqual(r.store.get(OW_LEDGER_KEY).sp.map((x) => x[0]), [raiderIn()], 'and written back pruned');
    await r.drop(e);
    set(owIdUntil(raiderIn()) + OW_ROW_KEEP_MS);
    r.wake();
    const g = r.connect(); await r.hello(g, 'peer-0006', ON);
    assert.equal('ow' in welcomeOf(g), false, 'all of it past its time');
    assert.equal(r.store.has(OW_LEDGER_KEY), false, 'the key let go');
  });
});

test('OW6L relay: A SPEAKER BEHIND THE LEDGER is answered alone with the cell\'s own rows (a machine that forgot a spawn and met it again - RAID3\'s law); a HALO\'s hello hears the next cell\'s ledger; over the cell\'s fan budget a change is kept and said to its speaker alone, and the next welcome says it (mutants: the behind answer unsaid, or fanned; the budget gone)', async () => {
  await withOw(async ({ world, r, say, step }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { k: 'dg', rows: [[...S1, M0 - 500, M0 - 400]] });
    const heardA = ows(a).length;
    step(300);
    await say(b, { k: 'dg', rows: [[...S1, M0 - 3], [...S2, M0 - 2]] });
    assert.deepEqual(ows(b).slice(-2), [{ t: 'ow', k: 'dg', rows: [[...S2, M0 - 2]] }, { t: 'ow', k: 'dg', rows: [[...S1, M0 - 500, M0 - 400]] }], 'the new row fanned; the row it was behind on, answered');
    assert.deepEqual(ows(a).slice(heardA), [{ t: 'ow', k: 'dg', rows: [[...S2, M0 - 2]] }], 'the answer is its speaker\'s alone');
    // a halo's hello: a player in the next cell west, at the seam
    const west = world.room(worldRoom(PX - 16, PY));
    const h = west.connect(); await west.hello(h, 'peer-0003', { ...ON, x: ON.x - 16 * PIXEL_UNITS });
    assert.equal('ow' in welcomeOf(h), false, 'the next cell keeps its own');
    const hh = r.connect(); await r.hello(hh, 'peer-0003', ON);   // the same player's halo socket into this cell
    assert.deepEqual(welcomeOf(hh).ow.dg, [[...S1, M0 - 500, M0 - 400], [...S2, M0 - 2]]);
  });
  await withOw(async ({ r, say }) => {
    const speakers = [];
    for (let i = 0; i < 3; i++) { const s = r.connect(); await r.hello(s, `peer-001${i}`, ON); speakers.push(s); }
    const l = r.connect(); await r.hello(l, 'peer-0020', ON);
    let n = 0;
    for (const s of speakers) for (let k = 0; k < OW_BURST_MAX && n < OW_ROOM_HZ_MAX + 1; k++, n++) await say(s, { k: 'sp', ids: [bandIn(n)] });
    assert.equal(ows(l).length, OW_ROOM_HZ_MAX, 'the cell fans OW_ROOM_HZ_MAX a second');
    assert.deepEqual(ows(speakers[2]).at(-1), { t: 'ow', k: 'sp', ids: [bandIn(OW_ROOM_HZ_MAX)] }, 'the one over it is said to its speaker');
    assert.equal(r.store.get(OW_LEDGER_KEY).sp.length, OW_ROOM_HZ_MAX + 1, 'and kept');
    const late = r.connect(); await r.hello(late, 'peer-0021', ON);
    assert.ok(welcomeOf(late).ow.sp.includes(bandIn(OW_ROOM_HZ_MAX)), 'the next welcome says it');
  });
});

// ═══ THE SESSION ═════════════════════════════════════════════════════════════════════════════════

function sessionRig(room, relayV = RELAY_VERSION, welcome = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onOverworld = (msg, r) => got.push({ msg, r });
  quiet(() => s.join(room, { x: ON.x, y: 0, z: ON.z, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: relayV, ...welcome }));
  const out = (w = ws) => w.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'ow');
  return { s, ws, got, out, sockets, tick: (ms) => { t += ms; } };
}

test('OW6L session: sendOverworld says a word down the PRIMARY cell\'s socket alone, at a relay that keeps the ledger, through the cell\'s own law at home (an entry the cell would strike is never sent) and its bucket - answering the entries that went; a cell\'s frames and its welcome\'s halves reach onOverworld, a halo\'s too, and nothing from any other room (mutants: an old relay sent the frame that closes its socket; a halo\'s room used; the margin not asked at home; the welcome unread; a halo\'s welcome dropped)', () => {
  const old = sessionRig(CELL, 'world126');
  assert.equal(old.s.owOk, false);
  assert.deepEqual(old.s.sendOverworld('sp', [bandIn(0)]), []);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  const place = sessionRig('dungeon:m123456');
  assert.deepEqual(place.s.sendOverworld('sp', [bandIn(0)]), [], 'a cell\'s word, never a place\'s');
  const { s, ws, got, out, sockets, tick } = sessionRig(CELL, RELAY_VERSION, { ow: { sp: [bandIn(0), 'junk'], dg: [[...S1, M0 - 5]] } });
  assert.equal(s.owOk, true);
  assert.deepEqual(got, [{ msg: { k: 'sp', ids: [bandIn(0)] }, r: CELL }, { msg: { k: 'dg', rows: [[...S1, M0 - 5]] }, r: CELL }], 'the welcome\'s ledger, half by half, projected');
  assert.deepEqual(s.sendOverworld('sp', [bandIn(1), `b30.150.${lifeB()}`, 'junk', bandIn(1)]), [bandIn(1)], 'what the cell would strike stays home');
  assert.deepEqual(out().at(-1), { t: 'ow', k: 'sp', ids: [bandIn(1)] });
  assert.deepEqual(s.sendOverworld('dg', [[...S2, M0], [...EMPTY, M0], [...BEYOND, M0], [...S3, M0, M0 - 1], [...EDGE, M0 - 1, M0]]), [[...S2, M0], [...EDGE, M0 - 1, M0]]);
  assert.deepEqual(s.sendOverworld('dg', [[...EMPTY, M0]]), [], 'nothing the cell takes: no word');
  assert.deepEqual(s.sendOverworld('xx', [bandIn(2)]), []); assert.deepEqual(s.sendOverworld('sp', 'x'), []);
  const many = Array.from({ length: OW_WORD_IDS_MAX + 3 }, (_, i) => bandIn(10 + i));
  assert.deepEqual(s.sendOverworld('sp', many), many.slice(0, OW_WORD_IDS_MAX), 'a word\'s bound; the caller says the rest');
  for (let i = 3; i < OW_BURST_MAX; i++) assert.equal(s.sendOverworld('sp', [bandIn(40 + i)]).length, 1);
  assert.deepEqual(s.sendOverworld('sp', [bandIn(60)]), [], 'the relay\'s bucket at home');
  tick(1000);
  assert.equal(s.sendOverworld('sp', [bandIn(60)]).length, 1);
  // frames in
  got.length = 0;
  ws.receive({ t: 'ow', k: 'sp', ids: [raiderIn(), 'junk'], x: 1 });
  ws.receive({ t: 'ow', k: 'dg', rows: [[...S2, M0 - 7, M0 - 1]] });
  ws.receive({ t: 'ow', k: 'sp', ids: ['junk'] });
  assert.deepEqual(got, [{ msg: { k: 'sp', ids: [raiderIn()] }, r: CELL }, { msg: { k: 'dg', rows: [[...S2, M0 - 7, M0 - 1]] }, r: CELL }]);
  // a halo: its welcome's ledger and its frames reach the host too, with its room - and my word never goes down it
  const west = worldRoom(PX - 16, PY);
  quiet(() => s.setHalo([west]));
  const halo = sockets[1];
  halo.open();
  quiet(() => halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION, ow: { dg: [[...EDGE, M0 - 9]] } }));
  halo.receive({ t: 'ow', k: 'sp', ids: [bandIn(5)] });
  assert.deepEqual(got.slice(-2), [{ msg: { k: 'dg', rows: [[...EDGE, M0 - 9]] }, r: west }, { msg: { k: 'sp', ids: [bandIn(5)] }, r: west }]);
  tick(1000);
  const sentHalo = out(halo).length;
  assert.equal(s.sendOverworld('sp', [bandIn(6)]).length, 1);
  assert.equal(out(halo).length, sentHalo, 'down the primary alone');
  // nothing from a room that keeps no ledger
  const hub = sessionRig('chat:world');
  hub.ws.receive({ t: 'ow', k: 'sp', ids: [bandIn(0)] });
  quiet(() => hub.ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION, ow: { sp: [bandIn(0)] } }));
  assert.deepEqual(hub.got, []);
});

// ═══ THE SPAWN LEDGER ════════════════════════════════════════════════════════════════════════════

test('OW6L spawn ledger: merge MIN-MERGES a heard row - a row never met is made, the earlier sight and the earlier clear of the two are kept, nothing is ever raised, a non-finite sight is no row and a non-finite clear none - answering whether anything changed; wireRow is the `dg` row a key says (mutants: the merge keeps the later sight; a clear raised; a missing row not made; a non-finite clear stored)', () => {
  const L = createSpawnLedger();
  assert.equal(L.merge('100,200', 50), true, 'a row never met is made');
  assert.deepEqual(L.toJSON(), [['100,200', 50]]);
  assert.equal(L.merge('100,200', 60), false, 'a later sight changes nothing');
  assert.equal(L.merge('100,200', 40, 70), true);
  assert.deepEqual(L.toJSON(), [['100,200', 40, 70]]);
  assert.equal(L.merge('100,200', 45, 80), false, 'a later clear changes nothing');
  assert.equal(L.merge('100,200', 40, NaN), false, 'a clear that is no number is none');
  assert.equal(L.merge('100,200', 45, 65), true, 'an earlier clear');
  assert.deepEqual(L.toJSON(), [['100,200', 40, 65]]);
  assert.equal(L.merge('100,200', NaN, 1), false, 'no sight: no row');
  assert.equal(L.merge('', 5), false);
  assert.equal(L.merge('7,8', 9, undefined), true);
  assert.deepEqual(L.toJSON(), [['100,200', 40, 65], ['7,8', 9]], 'no clear stored for none');
  L.note('3,4', 12); L.clear('3,4', 20);
  assert.equal(L.merge('3,4', 15, 25), false, 'my own clocks are the earlier');
  assert.ok(L.expired('100,200', 40 + 7 * 1440), 'a merged sight runs the long clock');
  // the wire's row
  assert.deepEqual(L.wireRow('100,200'), [100, 200, 40, 65]);
  assert.deepEqual(L.wireRow('7,8'), [7, 8, 9]);
  assert.equal(L.wireRow('9,9'), null, 'none held');
  const M = createSpawnLedger();
  M.note('junk-key', 5);
  assert.equal(M.wireRow('junk-key'), null, 'a key that is not a pixel');
  assert.deepEqual(validOwIn({ k: 'dg', rows: [L.wireRow('100,200')] }), { k: 'dg', rows: [[100, 200, 40, 65]] }, 'the wire takes what the ledger says');
});

test('OW6L by source: the relay\'s arm spends its own bucket before it asks for a cell, and its welcome reads the ledger before it is built; the session reads its word\'s relay off the primary\'s welcome; the worker\'s graph grows by the law alone', () => {
  const relay = rd('server/src/index.js');
  assert.match(relay, /if \(!this\._spend\(ws, now, owGate, 'owBucket', 'owDrops', 'too many overworld frames'\)\) return;\n\s+if \(!isCellRoom\(a\.key\)\) \{ this\._junk\(ws\); return; \}/);
  assert.match(relay, /const ow = isCellRoom\(a\.key\) \? await this\._owWelcome\(Date\.now\(\)\) : '';/);
  assert.match(relay, /"host":\$\{JSON\.stringify\(host\)\}\$\{ow\},"world":\$\{world \?\? 'null'\},"now":\$\{Date\.now\(\)\},"v":/, 'the field before the memory, the clock (stamped as the welcome is built) and the version, which close the frame as they always have');
  const online = rd('src/net/online.js');
  assert.match(online, /if \(primary\) this\.owOk = relaySupportsOverworld\(relayV\);/);
  const law = rd('src/net/overworldLaw.js');
  const from = [...law.matchAll(/\bfrom\s+'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(from, ['./wire.js', './gateLaw.js', './raidLaw.js'], 'the relay\'s own files alone - never a systems or world module');
});

// ═══ THE HOST (scenes/world.js) - lifted and RUN ═══════════════════════════════════════════════════════════════════
import { bandLifeOf } from '../src/systems/travelBands.js';
import { raiderLifeOf } from '../src/systems/seaRaiders.js';

/** The host's ledger block (world.js OW6L: what is owed, said, heard; the spawn's first-sight door), lifted and mounted. */
function ledgerHost({ online, clockMin = M0, ms = T0 } = {}) {
  const W = rd('src/scenes/world.js');
  const a = W.indexOf('  const OW_SAY_MS = 1000;'), b = W.indexOf('\n  }\n', W.indexOf('  function _spawnSeen(key) {'));
  assert.ok(a > 0 && b > a, 'the host\'s ledger block lifted');
  const d = {
    online, _spawnLedger: createSpawnLedger(), clockMin, ms, t: 0,
    _bandSpent: new Set(), _bandChase: new Map(), _bandPeer: new Map(), tvRaid: { spent: new Set(), chase: new Map(), peer: new Map() }, tvDng: { at: {} },
  };
  const scope = {
    online: d.online, _spawnLedger: d._spawnLedger, _spawnClock: () => d.clockMin, bandNowMs: () => d.ms, raidNowMs: () => d.ms,
    BAND_LIFE_MS, RAIDER_LIFE_MS, bandLifeOf, raiderLifeOf, _bandSpent: d._bandSpent, _bandChase: d._bandChase, _bandPeer: d._bandPeer,
    tvRaid: d.tvRaid, tvDng: d.tvDng, performance: { now: () => d.t },
  };
  const names = Object.keys(scope);
  const h = new Function(...names, `${W.slice(a, b + 4)}
    return { owSaySpent, owSayRow, overworldLedgerFrame, overworldLedgerHeard, _spawnSeen, owed: () => ({ sp: [..._owSay.sp.keys()], dg: [..._owSay.dg.keys()] }), OW_SAY_MS, OW_SAY_KEEP_MS };`)(...names.map((k) => scope[k]));
  return { d, ...h };
}

test('OW6L host run: WHAT I SPEND AND MY SPAWNS\' CLOCKS ARE OWED TO THE CELL until it takes them - a spent band or raider, a spawn\'s first sight (and never a sight already in my ledger), its clear; said a second apart at most, what the cell did not take said again, nothing said to a relay that keeps no ledger (and nothing lost); a spent id of a life gone and a row owed too long let go (mutants: the first sight unsaid, the rest dropped, an old relay spoken to)', () => {
  const sent = [];
  let take = Infinity;
  const online = { owOk: false, sendOverworld: (k, payload) => { const went = payload.slice(0, take); sent.push([k, went]); return went; } };
  const h = ledgerHost({ online });
  const key = `${S1[0]},${S1[1]}`;
  h._spawnSeen(key);
  h._spawnSeen(key);
  h.owSaySpent(bandIn(0)); h.owSaySpent(bandIn(1)); h.owSaySpent(raiderIn());
  assert.deepEqual(h.owed(), { sp: [bandIn(0), bandIn(1), raiderIn()], dg: [key] }, 'owed: the three spent, the one first sight');
  h.overworldLedgerFrame(10_000);
  assert.deepEqual(sent, [], 'a relay that keeps no ledger is told nothing');
  assert.equal(h.owed().sp.length, 3, 'and nothing is lost');
  online.owOk = true; take = 1;
  h.overworldLedgerFrame(20_000);
  assert.deepEqual(sent, [['sp', [bandIn(0)]], ['dg', [[...S1, M0]]]], 'said: the cell takes one of each');
  h.overworldLedgerFrame(20_000 + h.OW_SAY_MS - 1);
  assert.equal(sent.length, 2, 'not again within the second');
  take = Infinity;
  h.overworldLedgerFrame(20_000 + h.OW_SAY_MS);
  assert.deepEqual(sent.at(-1), ['sp', [bandIn(1), raiderIn()]], 'the rest said again');
  assert.deepEqual(h.owed(), { sp: [], dg: [] }, 'all taken');
  h._spawnSeen(key);
  assert.deepEqual(h.owed().dg, [], 'a sight already in my ledger (its pixel rebuilt) owes nothing');
  // the clear: the row again, with its clear
  h.d.clockMin = M0 + 30;
  h.d._spawnLedger.clear(key, M0 + 30); h.owSayRow(key);
  h.overworldLedgerFrame(40_000);
  assert.deepEqual(sent.at(-1), ['dg', [[...S1, M0, M0 + 30]]]);
  // let go: a spent id two lives gone; a row owed past OW_SAY_KEEP_MS
  const gone = `b44.142.${lifeB() - 2}`;
  online.owOk = false;
  h.owSaySpent(gone); h.d.t = 50_000; h.owSayRow(key);
  online.owOk = true; take = 0;
  h.overworldLedgerFrame(50_000 + h.OW_SAY_KEEP_MS + 1);
  assert.deepEqual(h.owed(), { sp: [], dg: [] }, 'both let go');
});

test('OW6L host run: THE CELL\'S WORD HEARD - a spent band is spent here and its chase ends, a spent raider too; a row min-merged into my spawn ledger, the Overworld\'s dungeons read again only when it moved (mutants: a band unspent, a raider taken for a band, the list never re-read)', () => {
  const h = ledgerHost({ online: { owOk: true, sendOverworld: () => [] } });
  h.d._bandChase.set(bandIn(0), {}); h.d._bandPeer.set(bandIn(0), {}); h.d.tvRaid.chase.set(raiderIn(), {});
  h.overworldLedgerHeard({ k: 'sp', ids: [bandIn(0), raiderIn()] });
  assert.ok(h.d._bandSpent.has(bandIn(0)) && !h.d._bandChase.has(bandIn(0)) && !h.d._bandPeer.has(bandIn(0)), 'the band: spent, its chase ended');
  assert.ok(h.d.tvRaid.spent.has(raiderIn()) && !h.d.tvRaid.chase.has(raiderIn()) && !h.d._bandSpent.has(raiderIn()), 'the raider: spent as a raider');
  const key = `${S1[0]},${S1[1]}`;
  h.d._spawnLedger.note(key, M0);
  h.overworldLedgerHeard({ k: 'dg', rows: [[...S1, M0 - 100]] });
  assert.equal(h.d.tvDng.at, null, 'moved: the Overworld\'s list read again');
  assert.deepEqual(h.d._spawnLedger.wireRow(key), [...S1, M0 - 100], 'the earlier sight kept');
  h.d.tvDng.at = {};
  h.overworldLedgerHeard({ k: 'dg', rows: [[...S1, M0 - 50]] });
  assert.notEqual(h.d.tvDng.at, null, 'a later sight moves nothing, and nothing is read again');
  assert.deepEqual(h.d._spawnLedger.wireRow(key), [...S1, M0 - 100]);
});

test('OW6L END TO END: A spends a band and first sees a spawn; the relay\'s cell keeps both; B, standing in the cell, hears them; C, walking in later, is told in its welcome - each through its own host\'s heard door (mutants anywhere on the way)', async () => {
  await withOw(async ({ r, say }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    const pending = [];
    const bridge = { owOk: true, sendOverworld: (k, payload) => { pending.push(say(a, k === 'sp' ? { k, ids: payload } : { k, rows: payload })); return payload; } };
    const A = ledgerHost({ online: bridge }), B = ledgerHost({ online: bridge }), C = ledgerHost({ online: bridge });
    const key = `${S2[0]},${S2[1]}`;
    A._spawnSeen(key); A.owSaySpent(bandIn(3));
    A.overworldLedgerFrame(10_000);   // the frame's clock is performance.now()'s (requestAnimationFrame's), as the owed rows' own
    await Promise.all(pending);
    for (const m of ows(b)) B.overworldLedgerHeard(m);
    assert.ok(B.d._bandSpent.has(bandIn(3)), 'B: the band A fought is gone');
    assert.deepEqual(B.d._spawnLedger.wireRow(key), [...S2, M0], 'B: the spawn\'s clock is A\'s sight');
    const c = r.connect();
    await r.hello(c, 'peer-0003', ON);
    const w = welcomeOf(c);
    assert.ok(w.ow, 'the welcome carries the cell\'s ledger');
    C.overworldLedgerHeard({ k: 'sp', ids: w.ow.sp }); C.overworldLedgerHeard({ k: 'dg', rows: w.ow.dg });
    assert.ok(C.d._bandSpent.has(bandIn(3)), 'C, later: gone for C too');
    assert.deepEqual(C.d._spawnLedger.wireRow(key), [...S2, M0], 'C, later: the same clock');
  });
});

test('OW6L host wiring: a band\'s spend and a raider\'s owe themselves to the cell; the spawn\'s one first-sight door is the roll\'s and the dungeon\'s; the clear owes its row; the session\'s word is heard; what is owed is said every online frame; a load forgets it (mutants: any of them unwired)', () => {
  const W = rd('src/scenes/world.js');
  assert.match(W, /function bandSpend\(id\) \{\n\s*_bandSpent\.add\(id\);\n\s*owSaySpent\(id\);/);
  assert.match(W, /function seaRaidSpend\(id\) \{\n\s*tvRaid\.spent\.add\(id\);\n\s*owSaySpent\(id\);/);
  assert.match(W, /_spawnSeen\(key\);   \/\/ TTL1: first sight starts the seven-day clock/);
  assert.match(W, /onDungeonSpawned: \(\) => \{ const p = playerTravelPixel\(\); _spawnSeen\(`\$\{p\.x\},\$\{p\.y\}`\); \},/);
  assert.doesNotMatch(W, /_spawnLedger\.note\(key, _spawnClock\(\)\);   \/\/ TTL1/, 'no other first-sight door');
  assert.match(W, /_spawnLedger\.clear\(key, _spawnClock\(\)\);\n\s*owSayRow\(key\);/);
  assert.match(W, /online\.onOverworld = \(msg\) => overworldLedgerHeard\(msg\);/);
  assert.match(W, /hccParkTick\(now\);[^\n]*\n\s*overworldLedgerFrame\(now\);/);
  const reset = W.slice(W.indexOf('  function overworldLoadReset() {'), W.indexOf('\n  }\n', W.indexOf('  function overworldLoadReset() {')));
  assert.match(reset, /travelView\?\.exit\('load', true\);[^\n]*\n\s*_owSay\.sp\.clear\(\); _owSay\.dg\.clear\(\);/, 'the load forgets what was owed - after the view\'s exit, the last thing that could owe');
  assert.ok(W.indexOf('  const _owSay = ') < W.indexOf('  const spawnedDungeonAt = '), 'BOOT-TDZ: declared ahead of the roll that says its first sight');
});
