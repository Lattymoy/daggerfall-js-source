// COST-2 (2026-10-24; bible/11-Multiplayer/Scale-Arc.md COST-2): A NODE'S ROWS HANDED OVER (server/src/cellHandover.js).
// When the tree moves, the departing node's parked teams and overworld ledger go to the nodes that hold them now, by
// pixel; its config is copied; its looks and secrets go with its drain; and any other key it holds - a fight, a debt, a
// key this file does not know - keeps it from moving at all. Over real Rooms on the pins' fake objects (test/fakeRoom.mjs
// fakeRooms), through the take door a departing node posts to.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms } from '../fakeRoom.mjs';
import {
  KEY_CLASSES, keyClass, blockersOf, handoverPayloads, handOver, takeHandover, parkPixel, CELL_INTERNAL_TAKE, HANDOVER_V,
} from '../../server/src/cellHandover.js';
import { childNodes, parentNode, nodeHolds } from '../../src/net/cellTree.js';
import { owLedgerOf, owSpawnsDungeon, owIdPixel } from '../../src/net/overworldLaw.js';
import { OW_LEDGER_KEY, PIXEL_UNITS, parkKey, sharedClassicMinutes, RAID_LEDGER_PREFIX, STAR_LEDGER_PREFIX } from '../../src/net/wire.js';
import { WILD_REMAINS_PREFIX } from '../../src/net/wild/wildLaw.js';

const NOW = 1_800_000_000_000;
const NODE = 'cell:1:12,4';   // map pixels [384, 416) x [128, 160): its children world:24,8 25,8 24,9 25,9
const KIDS = childNodes(NODE);
/** A park record standing its wagon at map pixel (px, py) - its spot in natives, as a park word says it. */
const park = (k, px, py) => [parkKey(k), { k, sub: `acct-${k}`, id: `peer-${k}`, name: k, at: NOW - 1000, r: { w: [1, px * PIXEL_UNITS + 10, 1, (499 - py) * PIXEL_UNITS + 10, 0, 0, 0, 1, 50, 0] } }];
/** The first pixels in a square that spawn a dungeon (a ledger row the law keeps). */
const dungeonPixels = (x0, y0, x1, y1, n) => { const out = []; for (let x = x0; x < x1 && out.length < n; x++) for (let y = y0; y < y1 && out.length < n; y++) if (owSpawnsDungeon(x, y)) out.push([x, y]); return out; };

/** The node's storage seeded with a park in each child, ledger rows in each child (a spent band, a raider, a dungeon,
 *  a grave), a row past the node's edge (the seam's margin), its looks and secrets and the relay's settings. */
function seed(store) {
  const min = Math.floor(sharedClassicMinutes(NOW));
  const parks = [park('aaaaaaaaaaaaaaaaaaaaaaaa', 390, 130), park('bbbbbbbbbbbbbbbbbbbbbbbb', 405, 131), park('cccccccccccccccccccccccc', 386, 150), park('dddddddddddddddddddddddd', 410, 158)];
  for (const [k, v] of parks) store.set(k, v);
  const dg = {};
  for (const [x, y] of [...dungeonPixels(384, 128, 400, 144, 1), ...dungeonPixels(400, 144, 416, 160, 1)]) dg[`${x},${y}`] = [x, y, min];
  const led = { sp: [['r65.22.1', NOW + 3_600_000], ['b195.175.2', NOW + 3_600_000], ['b192.186.7', NOW + 7_200_000]], dg, gr: { '401,129|0|acct-g': [401, 129, 0, min, 'acct-g', 'Gil'] } };
  store.set(OW_LEDGER_KEY, owLedgerOf(led));
  store.set('look:peer-x', { race: 'Nord' });
  store.set('secret:peer-x', 's');
  store.set('relaycfg', { gateThread: '1' });
  return { parks, led: owLedgerOf(led) };
}
const take = (W) => async (target, payload) => (await W.room(target).room.fetch(new Request(`https://relay.internal${CELL_INTERNAL_TAKE}`, { method: 'POST', body: JSON.stringify(payload) }))).ok;
const ledOf = (W, k) => owLedgerOf(W.room(k).store.get(OW_LEDGER_KEY));

test('COST-2 EVERY KEY HAS A CLASS, AND WHAT IS NOT HANDED OVER BLOCKS: the parked teams and the ledger are partitioned, the settings, bans and freezes copied, the looks and secrets dropped with the drain - and any other key, a fight\'s, a debt\'s, a raid\'s, a star\'s, the wild\'s remains, one nobody has named, blocks the move; the blockers listed a page at a time (mutants: an unknown key handed; a raid let through; a prefix read as exact)', async () => {
  assert.deepEqual(KEY_CLASSES.map(([k, c]) => `${k}=${c}`), ['park:=part', `${OW_LEDGER_KEY}=part`, 'relaycfg=copy', 'bans=copy', 'freezes=copy', 'look:=drop', 'secret:=drop', 'hellos=drop', 'cellmoved=drop', 'cellpulled=drop']);   // PIN MOVED (COST-2 part two): a node's moved mark and its pulled cells, never handed over - test/server/cellmoves.test.js
  assert.equal(keyClass(parkKey('aaaaaaaaaaaaaaaaaaaaaaaa')), 'part');
  assert.equal(keyClass('park'), 'block', 'a prefix is a prefix');
  assert.equal(keyClass('hellosx'), 'block', 'an exact key exactly');
  for (const k of [`${RAID_LEDGER_PREFIX}x`, `${STAR_LEDGER_PREFIX}x`, `${WILD_REMAINS_PREFIX}x`, 'serpent', 'serpentsite', 'gatesite', 'wildowed:a', 'sevl:1', 'egbreach', 'world:0', 'nobody-named-this']) assert.equal(keyClass(k), 'block', k);
  const W = fakeRooms({ now: () => NOW });
  const s = W.room(NODE).store;
  seed(s);
  assert.deepEqual(await blockersOf(W.room(NODE).state.storage), [], 'a cell of parks, a ledger, looks and settings: nothing blocks');
  s.set(`${RAID_LEDGER_PREFIX}r1`, { k: 'r1' });
  for (let i = 0; i < 300; i++) s.set(`a-filler:${String(i).padStart(3, '0')}`, i);   // past a page
  s.set('zz-last', 1);
  const b = await blockersOf(W.room(NODE).state.storage, 400);
  assert.ok(b.includes(`${RAID_LEDGER_PREFIX}r1`) && b.includes('zz-last'), 'every page read');
  assert.equal(b.length, 302);
  assert.equal((await blockersOf(W.room(NODE).state.storage)).length, 8, 'eight at most by default');
});

test('COST-2 A SPLIT HANDS EACH CHILD ITS OWN ROWS, AND A MERGE GIVES THEM BACK WHOLE: each park and ledger entry to the child holding its pixel (a row past the node\'s edge to the nearest), the settings copied to each, nothing left behind on the departing node, nothing a child did not get; the four merged into their parent hold the node\'s rows as they were; asked again, a take changes nothing (mutants: a row to the wrong child; the clamp; the rows kept behind; the take not idempotent; the newer park kept over the older)', async () => {
  const W = fakeRooms({ now: () => NOW });
  const { parks, led } = seed(W.room(NODE).store);
  assert.deepEqual([led.sp.length, Object.keys(led.dg).length, Object.keys(led.gr).length], [3, 2, 1], 'the fixture holds every kind of row');
  const out = await handOver(W.room(NODE).room, KIDS, take(W), NOW);
  assert.equal(out.ok, true, JSON.stringify(out));
  // each park in the child that holds its spot
  for (const [k, rec] of parks) {
    const [px, py] = parkPixel(rec);
    const home = KIDS.find((c) => nodeHolds(c, px, py));
    for (const c of KIDS) assert.equal(W.room(c).store.has(k), c === home, `${k} in ${c}`);
  }
  // each ledger entry in the child that holds its pixel - the band met past the node's edge clamped in
  const pixelOfId = (id) => { const p = owIdPixel(id); return [Math.min(Math.max(p.x, 384), 415), Math.min(Math.max(p.y, 128), 159)]; };
  for (const [id] of led.sp) {
    const [x, y] = pixelOfId(id);
    for (const c of KIDS) assert.equal(ledOf(W, c).sp.some((e) => e[0] === id), nodeHolds(c, x, y), `${id} in ${c}`);
  }
  assert.ok(owIdPixel('b192.186.7').y < 128, 'the fixture holds a band whose cell origin is past the node\'s edge');
  for (const r of Object.values(led.dg)) for (const c of KIDS) assert.equal(!!ledOf(W, c).dg[`${r[0]},${r[1]}`], nodeHolds(c, r[0], r[1]));
  assert.ok(ledOf(W, 'world:25,8').gr['401,129|0|acct-g'], 'the grave with its stone');
  for (const c of KIDS) assert.deepEqual(W.room(c).store.get('relaycfg'), { gateThread: '1' }, `${c}: the settings copied`);
  for (const c of KIDS) assert.equal(W.room(c).store.has('look:peer-x'), false, 'a look is no row to hand over');
  // the departing node let go of what it handed
  const left = W.room(NODE).store;
  assert.deepEqual([...left.keys()].filter((k) => k.startsWith('park:') || k === OW_LEDGER_KEY), []);
  // asked again: the children unchanged
  const before = KIDS.map((c) => JSON.stringify([...W.room(c).store]));
  const again = handoverPayloads({ parks, led, copy: {} }, KIDS);
  for (const c of KIDS) assert.equal(await takeHandover(W.room(c).room, again.get(c), NOW), 0, `${c}: nothing new`);
  assert.deepEqual(KIDS.map((c) => JSON.stringify([...W.room(c).store])), before);
  // a newer park under the same key wins, an older one does not
  const [k0, r0] = parks[0];
  const home = KIDS.find((c) => W.room(c).store.has(k0));
  await takeHandover(W.room(home).room, { v: HANDOVER_V, parks: [[k0, { ...r0, at: r0.at - 5, name: 'older' }]] }, NOW);
  assert.equal(W.room(home).store.get(k0).name, r0.name);
  await takeHandover(W.room(home).room, { v: HANDOVER_V, parks: [[k0, { ...r0, at: r0.at + 5, name: 'newer' }]] }, NOW);
  assert.equal(W.room(home).store.get(k0).name, 'newer');
  await takeHandover(W.room(home).room, { v: HANDOVER_V, parks: [[k0, r0]] }, NOW);
  // MERGED BACK: the four into their parent, which holds the node's rows as seeded
  const parent = parentNode(KIDS[0]);
  assert.equal(parent, NODE);
  const back = fakeRooms({ now: () => NOW });
  for (const c of KIDS) for (const [k, v] of W.room(c).store) back.room(c).store.set(k, v);
  for (const c of KIDS) assert.equal((await handOver(back.room(c).room, [parent], take(back), NOW)).ok, true);
  const whole = owLedgerOf(back.room(parent).store.get(OW_LEDGER_KEY));
  assert.deepEqual(new Set(whole.sp.map((e) => e[0])), new Set(led.sp.map((e) => e[0])));
  assert.deepEqual(Object.keys(whole.dg).sort(), Object.keys(led.dg).sort());
  assert.deepEqual(Object.keys(whole.gr), Object.keys(led.gr));
  assert.deepEqual(parks.map(([k]) => k).filter((k) => back.room(parent).store.has(k)), parks.map(([k]) => k));
});

test('COST-2 A NODE THAT CANNOT HAND OVER MOVES NOTHING: a blocking key hands nothing and names it; a child that never answers (asked twice) leaves every row on the departing node, and the handover asked again later leaves every child as one would; a take of anything but a handover is refused (mutants: rows let go on a partial failure; a blocked node handed anyway; a miss asked once)', async () => {
  const W = fakeRooms({ now: () => NOW });
  seed(W.room(NODE).store);
  W.room(NODE).store.set('serpentsite', { at: 1 });
  const blocked = await handOver(W.room(NODE).room, KIDS, take(W), NOW);
  assert.deepEqual(blocked, { ok: false, blocked: ['serpentsite'] });
  for (const c of KIDS) assert.equal(W.room(c).store.size, 0, 'nothing handed');
  W.room(NODE).store.delete('serpentsite');
  // the last child never answers: asked twice, the rows stay
  let asks = 0;
  const flaky = (target, payload) => { if (target === KIDS[3]) { asks++; return Promise.reject(new Error('reset')); } return take(W)(target, payload); };
  const miss = await handOver(W.room(NODE).room, KIDS, flaky, NOW);
  assert.deepEqual(miss, { ok: false, failed: [KIDS[3]] });
  assert.equal(asks, 2, 'asked again once');
  assert.ok(W.room(NODE).store.has(OW_LEDGER_KEY) && [...W.room(NODE).store.keys()].some((k) => k.startsWith('park:')), 'every row still here');
  const firstThree = KIDS.slice(0, 3).map((c) => JSON.stringify([...W.room(c).store]));
  assert.equal((await handOver(W.room(NODE).room, KIDS, take(W), NOW)).ok, true, 'asked again: whole');
  assert.deepEqual(KIDS.slice(0, 3).map((c) => JSON.stringify([...W.room(c).store])), firstThree, 'the children that took it once are as they were');
  // the door
  const res = await W.room(KIDS[0]).room.fetch(new Request(`https://relay.internal${CELL_INTERNAL_TAKE}`, { method: 'POST', body: '{"v":2}' }));
  assert.equal(res.status, 400);
});
