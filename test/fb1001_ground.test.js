// AUDIT 2026-10-01 part four (Mac: "...and also ensure the other professions are sound") - THE GROUND A CLIENT STANDS ITS
// NODES ON. A pixel's (or a dungeon's) witnessed state decides the draw: on ground three week-old accounts confirmed, the
// nodes come from the wider tiers (a Mountain's Iron becomes Silver to Adamantium, a Woodlands Oak a Cherry, a dungeon's
// Silver Gold). The service reads the witnesses fresh at every harvest; the client's book read a pixel once a UTC day.
//
// GROUND-STALE. The third witness's own harvest confirms the pixel in that very statement - and its client, and every
// client that read the pixel earlier that day, went on standing the ground's least: the prompt offered a novice "Mine Iron",
// the act played, the tool wore, and the service refused `prof-rank` (it rolled Silver), every try until midnight. Now a
// harvest's answer marks its ground stale: it stands as it did, the host's next ask reads it again, and a state that moved
// stands its nodes again (net/profBook.js staleGround, pixelWanted, dungeonWanted).
//
// GROUND-MIDNIGHT. At the UTC day's turn the host stood every pixel again before the new day's states were read - the
// ground's least for all of them - and the read stood again only a pixel whose state had CHANGED since yesterday: one
// confirmed yesterday and today stood unconfirmed the whole day (its signature veins gone), and so did the dungeon the
// player stood in. Now yesterday's word is no word. The real Worker over node:sqlite (test/accountDb.mjs), the real
// accountProf door, the real profBook and the real gathering host with Mining's kind - lane 5's reproductions, turned.
//
// And three things the book heard and dropped. STORES-ROOM: the kinds asked `held` (own and bought - what a station may
// spend) for the Stores' room, the service every origin (gold-bought too) - ready, played, worn, `stores-full`. Now the
// room is the service's count (professionLaw.js storesFullIn). REFUSALS-LEARNED: `prof-cap` and `stores-full` (another
// device took the day's room) now read the state again; `prof-account-cap` and `prof-deep-cap` (counts the state does
// not carry) close the craft, or the unvouched dungeons' veins, until the UTC day turns - the host says so instead of
// offering the act. CAP-OFF (2026-10-07): `prof-cap` and `prof-account-cap` are said no more - the day's cap is gone -
// and an old service's saying them moves nothing; `stores-full` and `prof-deep-cap` stand. RATE-KEPT: `prof-rate` ("Try again later") let the harvest go; it is kept and asked again now.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { veins, boulders, dungeonVeins, nodeKey, pixelReport } from '../src/net/nodeLaw.js';
import { xpForRank, storesFullIn } from '../src/net/professionLaw.js';
import { mineKind, mineRecord, standMineNodes } from '../src/scenes/mineHost.js';
import { createForagingItem } from '../src/systems/foragingInstall.js';
import { createGatherHost } from '../src/scenes/gatherHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { utcDay } from '../src/net/marksLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const DAY = 86_400;
const MOUNTAIN = 226, REGION = 6;   // the Ravennian Forest: no crown, no march - no signature slot to move the count
const D = utcDay(T0);
let _ms = (D * DAY + 13 * 3600) * 1000;
const realNow = Date.now;
Date.now = () => _ms;
test.after(() => { Date.now = realNow; });
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const flatPixel = () => ({ samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap: new Uint8Array(128 * 128).fill(3) });
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 15)); };
const wild = () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 13, climate: MOUNTAIN, region: REGION, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });
let _rid = 0;
const rid = () => `ground-${String(++_rid).padStart(8, '0')}`;

/** A Mountain pixel whose vein slot `k`, on `day`, is Iron (tier 1) unconfirmed and tier 3 or more confirmed. */
function ironPixel(day) {
  for (let x = 300; x < 700; x++) {
    const u = veins({ x, y: 200, day, climate: MOUNTAIN, region: REGION, confirmed: false });
    const c = veins({ x, y: 200, day, climate: MOUNTAIN, region: REGION, confirmed: true });
    const i = u.findIndex((v, j) => v.tier === 1 && c[j].tier >= 3);
    if (i >= 0) return { px: x, k: u[i].slot, confirmed: c[i] };
  }
  throw new Error('no such pixel');
}
/** The service, an account `name` (a week registered when `aged`), its book over the real door. */
async function bookOf(s, name, { aged = false } = {}) {
  const who = await s.registered(name);
  if (aged) s.env.DB._raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_ms / 1000 - 8 * DAY, who.id);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  return { who, book: createProfBook({ door, storage: memStorage(), character: () => who.character, now: () => _ms, sleep: () => Promise.resolve() }) };
}
let _w = 0;
const witness = (s, kind, key, n = 3) => (async () => {
  for (let i = 0; i < n; i++) {
    const w = await s.registered(`Wit${++_w}`);
    s.env.DB._raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)').run(kind, key, w.id, pixelReport(MOUNTAIN, REGION), REGION, _ms / 1000 - 3 * DAY);
  }
})();
/** The gathering host with Mining's kind over `built`, the player at the origin of `at`'s pixel. */
function mineHost(book, built, at, { underground = false } = {}) {
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  return createGatherHost({
    book, hud, kinds: [mineKind({ book })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = x === at ? 0 : 1e6; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: MOUNTAIN, region: REGION }), nowMs: () => _ms,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0],
    entity: () => ({ items: [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }], stats: {} }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => !underground, activeDungeon: () => underground,
  });
}
const entryOf = (px, days) => {
  const law = days.map((d) => veins({ x: px, y: 200, day: d, climate: MOUNTAIN, region: REGION, confirmed: true })).flat();
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  return { px, py: 200, ...flatPixel(), locationRect: null, batches: [], rocks };
};

test('GROUND-STALE: the third witness\'s own harvest confirms the pixel - its book reads it again on the answer and says it changed, so the host stands its nodes again: the vein a novice was offered as Iron stands as the service\'s Silver-or-better (mutants: the answer never marks the ground; the host never asks a known pixel again)', async () => {
  _ms = (D * DAY + 13 * 3600) * 1000;
  const day = utcDay(_ms / 1000);
  const { px, k, confirmed } = ironPixel(day);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  await witness(s, 'pixel', `${px},200`, 2);   // two witnesses: unconfirmed
  const { who, book } = await bookOf(s, 'Cyn', { aged: true });
  setForagingHost({ world: wild });
  try {
    assert.equal((await book.refresh()).ok, true);
    const built = new Map([[`${px},200`, entryOf(px, [day])]]);
    const host = mineHost(book, built, px);
    host.tick(0.016); await settle();
    host.onBuilt(built.get(`${px},200`)); await settle();
    _ms += 5_001; host.tick(0.016); await settle();
    assert.equal(book.pixel(px, 200)?.state, 'unconfirmed', 'two witnesses');
    assert.equal(book.pixelWanted(px, 200), false, 'known today');
    const before = host.nodesOf(px, 200).find((n) => n.what === 'vein' && n.slot === k);
    assert.deepEqual([before.material, before.tier], ['metal:iron', 1], 'the ground\'s least: Iron');
    // Cyn - a week registered - quarries a boulder there: the service writes the third witness in the same statement
    assert.ok(boulders({ x: px, y: 200, day, climate: MOUNTAIN }).length > 0);
    _ms += 20_000;
    const q = await book.harvest({ node: nodeKey({ kind: 'boulder', x: px, y: 200, day, slot: 0 }), kind: 'stone', climate: MOUNTAIN, region: REGION, act: { strikes: 4, glints: 0, clean: false }, at: Math.floor(_ms / 1000) - 2 });
    assert.equal(q.ok, true, JSON.stringify(q));
    assert.equal((await s.call('/v1/prof/pixels', { character: who.character, pixels: [[px, 200]] }, who.secret)).body.pixels[0].state, 'confirmed', 'the service: confirmed now');
    assert.equal(book.pixelWanted(px, 200), true, 'the answer marks its ground: asked again');
    assert.equal(book.pixel(px, 200)?.state, 'unconfirmed', 'and it stands as it did meanwhile');
    // the host's next ask reads it, and stands the pixel again
    _ms += 5_001; host.tick(0.016); await settle();
    assert.equal(book.pixel(px, 200)?.state, 'confirmed', 'read again');
    assert.equal(book.pixelWanted(px, 200), false);
    const after = host.nodesOf(px, 200).find((n) => n.what === 'vein' && n.slot === k);
    assert.deepEqual([after.material, after.tier], [confirmed.material, confirmed.tier], 'the vein stands as the service rolls it');
    host.dispose();
  } finally { setForagingHost(null); }
});

test('GROUND-STALE: a refusal marks its ground too - `prof-rank` on a node the client stood within the rank is the stale ground\'s word; a body names no ground (mutants: only an answer marks it)', async () => {
  _ms = (D * DAY + 13 * 3600) * 1000;
  const day = utcDay(_ms / 1000);
  const { px, k } = ironPixel(day);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  await witness(s, 'pixel', `${px},200`, 3);   // confirmed already - the client read it before
  const { book } = await bookOf(s, 'Dax');
  assert.equal((await book.refresh()).ok, true);
  // the client's morning read, before the witnesses (a stand-in for "earlier today"): unconfirmed
  s.env.DB._raw.prepare('DELETE FROM world_witness WHERE key = ?').run(`${px},200`);
  await book.askPixels([[px, 200]]);
  assert.equal(book.pixel(px, 200)?.state, 'none');
  await witness(s, 'pixel', `${px},200`, 3);
  // the novice is offered the slot's Iron (tier 1) and works it: the service rolls the confirmed tier - refused
  _ms += 20_000;
  const r = await book.harvest({ node: nodeKey({ kind: 'vein', x: px, y: 200, day, slot: k }), kind: 'ore', climate: MOUNTAIN, region: REGION, act: { strikes: 4, glints: 0, clean: false }, at: Math.floor(_ms / 1000) - 2 });
  assert.deepEqual(r, { ok: false, error: 'prof-rank' });
  assert.equal(book.pixelWanted(px, 200), true, 'the refusal marks the ground');
  const changed = await book.askPixels([[px, 200]]);
  assert.deepEqual(changed.map((p) => [p.x, p.state]), [[px, 'confirmed']], 'read again: changed, so the host stands it again');
  // a body's harvest names no ground - nothing to mark, nothing thrown
  const b = await book.harvest({ node: 'body:1:abc', kind: 'hide', climate: null, region: null, act: { clean: true, torn: 0 }, at: Math.floor(_ms / 1000) - 2, foe: 4 });
  assert.equal(b.ok, false);
});

test('GROUND-MIDNIGHT: a pixel confirmed yesterday and today, streamed across 00:00 UTC, stands its confirmed draw after the turn - the day\'s read says it changed from yesterday\'s word (mutants: yesterday\'s state compared as today\'s)', async () => {
  _ms = ((D + 1) * DAY - 120) * 1000;   // 23:58 UTC (the shared clock reads 13:29 at every UTC midnight - daylight anyway)
  const { px, k, confirmed } = ironPixel(D + 1);
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  await witness(s, 'pixel', `${px},200`, 3);
  const { book } = await bookOf(s, 'Mac');
  setForagingHost({ world: wild });
  try {
    const built = new Map([[`${px},200`, entryOf(px, [D, D + 1])]]);
    const host = mineHost(book, built, px);
    host.tick(0.016); await settle();
    host.onBuilt(built.get(`${px},200`)); await settle();
    for (let i = 0; i < 2; i++) { _ms += 5_001; host.tick(0.016); await settle(); }
    assert.equal(book.pixel(px, 200)?.state, 'confirmed', 'day D: confirmed');
    _ms = ((D + 1) * DAY + 1) * 1000;   // past midnight: the host's turn
    host.tick(0.016); await settle();
    for (let i = 0; i < 3; i++) { _ms += 5_001; host.tick(0.016); await settle(); }
    assert.equal(book.pixel(px, 200)?.state, 'confirmed', 'day D + 1: confirmed');
    const node = host.nodesOf(px, 200).find((n) => n.what === 'vein' && n.slot === k);
    assert.deepEqual([node.material, node.tier], [confirmed.material, confirmed.tier], 'the host stands today\'s confirmed draw - not the unconfirmed Iron');
    host.dispose();
  } finally { setForagingHost(null); }
});

test('GROUND-MIDNIGHT: the confirmed dungeon the player stands in across 00:00 UTC stands its confirmed veins after the turn (mutants: yesterday\'s dungeon state compared as today\'s)', async () => {
  _ms = ((D + 1) * DAY - 120) * 1000;
  let id = null;
  for (let d = 3000; d < 6000 && id === null; d++) {
    const c = dungeonVeins({ dungeon: d, day: D + 1, climate: MOUNTAIN, confirmed: true });
    const u = dungeonVeins({ dungeon: d, day: D + 1, climate: MOUNTAIN, confirmed: false });
    if (c.map((v) => mineRecord({ what: 'dvein', material: v.material })).sort().join() !== u.map((v) => mineRecord({ what: 'dvein', material: v.material })).sort().join()) id = d;
  }
  assert.ok(id !== null, 'a dungeon whose confirmed veins draw other pictures');
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const { who, book } = await bookOf(s, 'Mac');
  s.env.DB._raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)').run(who.id, who.character, 'mining', xpForRank(25), _ms / 1000);
  await witness(s, 'dungeon', String(id), 3);
  setForagingHost({ world: () => ({ ...wild(), inside: true, insideDungeon: true }) });
  try {
    const built = new Map([['500,200', { px: 500, py: 200, ...flatPixel(), batches: [], rocks: [] }]]);
    const host = mineHost(book, built, -1, { underground: true });
    host.tick(0.016); await settle();
    host.onBuilt(built.get('500,200'));
    const flats = new Set();   // the dungeon's flats standing now - each a vein's picture (its metal's record)
    host.enterDungeon({ id, climate: MOUNTAIN, region: REGION, wall: () => [0, 0, 0], stand: async (a, r) => { const b = { r }; flats.add(b); return b; }, drop: (b) => flats.delete(b) });
    for (let i = 0; i < 3; i++) { _ms += 5_001; host.tick(0.016); await settle(); }
    assert.equal(book.dungeon(id)?.state, 'confirmed');
    _ms = ((D + 1) * DAY + 1) * 1000;   // past midnight
    for (let i = 0; i < 4; i++) { host.tick(0.016); await settle(); _ms += 5_001; }
    const truth = dungeonVeins({ dungeon: id, day: D + 1, climate: MOUNTAIN, confirmed: true });
    const standing = [...flats].map((b) => b.r).sort();
    assert.deepEqual(standing, truth.map((v) => mineRecord({ what: 'dvein', material: v.material })).sort(), 'the host stands the service\'s confirmed draw');
    host.dispose();
  } finally { setForagingHost(null); }
});

// ─── STORES-ROOM, REFUSALS-LEARNED, RATE-KEPT ───────────────────────

/** A book over a stand-in door: the state as given, each harvest answered by `answers` in turn. */
function stubBook({ stores = [], answers = [] } = {}) {
  const asked = [];
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: utcDay(_ms / 1000), character: 'c1', tracks: [{ profession: 'mining', xp: xpForRank(100), rank: 100, specs: { 50: null, 100: null } }], today: {}, taken: [], stores, caps: { stores: 5000, withdraw: 200, highHides: 3 } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return answers.shift() ?? { ok: false, error: 'offline' }; },
  };
  return { asked, book: createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => _ms, sleep: () => Promise.resolve() }) };
}
const ore = (node) => ({ node, kind: 'ore', climate: MOUNTAIN, region: REGION, act: { strikes: 4, glints: 0, clean: false }, at: Math.floor(_ms / 1000) - 2 });

test('STORES-ROOM: 4,000 own and 1,000 bought with gold fill the Stores as the service counts them - the vein\'s prompt says the Stores are full, though a station may spend only the 4,000 (mutants: the room read off `held`)', async () => {
  _ms = (D * DAY + 13 * 3600) * 1000;
  const day = utcDay(_ms / 1000);
  const node = standMineNodes({ px: 400, py: 200, day, climate: MOUNTAIN, region: REGION, ...flatPixel() }).find((n) => n.what === 'vein');
  const { book } = stubBook({ stores: [{ material: node.material, own: 4000, bought: 0, gold: 1000 }] });
  assert.equal((await book.refresh()).ok, true);
  assert.equal(book.held(node.material), 4000, 'what a station may spend: never gold\'s');
  assert.equal(storesFullIn(book, node.material), true, 'the room: every origin');
  assert.equal(storesFullIn(book, 'metal:nothing'), false);
  const plan = mineKind({ book }).plan(node, { entity: { items: [createForagingItem(FT.PickAxe)] }, rank: () => 100 });
  assert.equal(plan.ready, false, 'never offered');
  assert.match(plan.rest, /^Stores full - /);
  // a book that keeps no origins (a stand-in's `held` alone) answers by it, as before
  assert.equal(storesFullIn({ held: () => 5000, state: { caps: { stores: 5000 } } }, 'x'), true);
  assert.equal(storesFullIn({ held: () => 4999, state: { caps: null } }, 'x'), false);
});

test('REFUSALS-LEARNED: the account\'s unvouched dungeon veins, refused once, close until the UTC day turns; the Stores, refused, read the state again. CAP-OFF: the day\'s caps an old service may still say - `prof-account-cap`, `prof-cap` - close nothing and read nothing (mutants: the deep cap forgotten; the state never read again; the old refusals learned again)', async () => {
  _ms = (D * DAY + 13 * 3600) * 1000;
  const day = utcDay(_ms / 1000);
  const { book } = stubBook({ answers: [{ ok: false, error: 'prof-account-cap' }, { ok: false, error: 'prof-deep-cap' }, { ok: false, error: 'prof-cap' }, { ok: false, error: 'stores-full' }] });
  assert.equal((await book.refresh()).ok, true);
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): `prof-account-cap` closed Mining for the
  // account until the UTC day turned, and `prof-cap` read the state again - the day's cap they said is gone
  assert.equal((await book.harvest(ore(nodeKey({ kind: 'vein', x: 400, y: 200, day, slot: 0 })))).error, 'prof-account-cap');
  assert.equal(book.closed('account:mining'), false, 'no craft closed for the account');
  assert.equal((await book.harvest(ore(`dvein:4000:${day}:0`))).error, 'prof-deep-cap');
  assert.equal(book.closed('deep'), true, 'the unvouched dungeons\' veins closed');
  assert.equal(book.stale(), false, 'neither asks the state again');
  assert.equal((await book.harvest(ore(nodeKey({ kind: 'vein', x: 400, y: 200, day, slot: 1 })))).error, 'prof-cap');
  _ms += 30_001;
  assert.equal(book.stale(), false, 'no day\'s count to read again');
  assert.equal((await book.harvest(ore(nodeKey({ kind: 'vein', x: 400, y: 200, day, slot: 2 })))).error, 'stores-full');
  _ms += 30_001;
  assert.equal(book.stale(), true, 'the Stores filled elsewhere: the state read again');
  assert.equal((await book.refresh()).ok, true);
  assert.equal(book.stale(), false, 'read');
  // the UTC day turns: what the refusals closed opens
  _ms = ((D + 1) * DAY + 60) * 1000;
  assert.equal(book.closed('deep'), false, 'a new day');
});

test('RATE-KEPT: a harvest refused for the hour\'s acts (`prof-rate`, "Try again later") is kept and asked again - not let go after the act and the tool were spent (mutants: the hour\'s refusal lets it go)', async () => {
  _ms = (D * DAY + 13 * 3600) * 1000;
  const day = utcDay(_ms / 1000);
  const node = nodeKey({ kind: 'vein', x: 400, y: 200, day, slot: 0 });
  const { asked, book } = stubBook({ answers: [{ ok: false, error: 'prof-rate' }, { ok: true, data: { node, kind: 'ore', material: 'metal:iron', qty: 2, xp: 15, track: { profession: 'mining', xp: xpForRank(100) + 15, rank: 100, specs: { 50: null, 100: null } }, today: 1, store: { material: 'metal:iron', own: 2, bought: 0 } } }] });
  assert.equal((await book.refresh()).ok, true);
  const r = await book.harvest(ore(node));
  assert.deepEqual([r.ok, r.kept, r.error], [false, true, 'prof-rate'], 'kept');
  assert.equal(book.pendingHarvests, 1);
  _ms += 60_000;
  const heard = [];
  await book.pump((h, a) => heard.push(a?.ok));
  assert.deepEqual([asked.length, heard, book.pendingHarvests, book.held('metal:iron')], [2, [true], 0, 2], 'asked again and answered');
});

test('GROUND-STALE underground, and REFUSALS-LEARNED\'s deep cap: a dungeon vein\'s answer marks the dungeon, the host asks it again and stands its veins anew; after `prof-deep-cap` an unvouched dungeon\'s vein is offered no more, its prompt saying why (mutants: the dungeon never asked again; the host never asks it again; the deep cap never asked at the host)', async () => {
  _ms = (D * DAY + 13 * 3600) * 1000;
  const day = utcDay(_ms / 1000);
  let id = null;
  for (let d = 3000; d < 6000 && id === null; d++) {
    const c = dungeonVeins({ dungeon: d, day, climate: MOUNTAIN, confirmed: true });
    const u = dungeonVeins({ dungeon: d, day, climate: MOUNTAIN, confirmed: false });
    if (c.map((v) => mineRecord({ what: 'dvein', material: v.material })).sort().join() !== u.map((v) => mineRecord({ what: 'dvein', material: v.material })).sort().join()) id = d;
  }
  let dstate = 'none';
  const answers = [];
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'mining', xp: xpForRank(100), rank: 100, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000, withdraw: 200, highHides: 3 } } }),
    pixels: async (c, px, ds) => ({ ok: true, data: { pixels: [], dungeons: (ds ?? []).map((x) => ({ id: x, state: dstate, ...(dstate === 'confirmed' ? { climate: MOUNTAIN, region: REGION } : {}) })) } }),
    harvest: async () => answers.shift() ?? { ok: false, error: 'offline' },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => _ms, sleep: () => Promise.resolve() });
  setForagingHost({ world: () => ({ ...wild(), inside: true, insideDungeon: true }) });
  const said = { prompt: null };
  const host = createGatherHost({
    book, kinds: [mineKind({ book })],
    hud: { setPrompt: (p) => { said.prompt = p; }, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map(), pixelTranslation: (x, y, out) => { out[0] = 1e6; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: MOUNTAIN, region: REGION }), nowMs: () => _ms,
    // every vein on one wall point at the origin, the eye a metre and a half south of it, looking at it
    eye: () => ({ pos: [0, 1.6, -1.5], dir: [0, (0.4 - 1.6) / 1.5, 1] }), view: () => ({ yaw: 0, pitch: -38.66 }), feet: () => [0, 0, -1.5],
    entity: () => ({ items: [createForagingItem(FT.PickAxe)], stats: {} }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => false, activeDungeon: () => true,
  });
  try {
    assert.equal((await book.refresh()).ok, true);
    const flats = new Set();
    host.enterDungeon({ id, climate: MOUNTAIN, region: REGION, wall: () => [0, 0, 0], stand: async (a, r) => { const b = { r }; flats.add(b); return b; }, drop: (b) => flats.delete(b) });
    for (let i = 0; i < 2; i++) { _ms += 5_001; host.tick(0.016); await settle(); }
    const recs = (confirmed) => dungeonVeins({ dungeon: id, day, climate: MOUNTAIN, confirmed }).map((v) => mineRecord({ what: 'dvein', material: v.material })).sort();
    assert.equal(book.dungeon(id)?.state, 'none');
    assert.deepEqual([...flats].map((b) => b.r).sort(), recs(false), 'nobody vouched: its least');
    // the dungeon's third witness, then a harvest of mine there answered: the dungeon is asked again, and stood anew
    dstate = 'confirmed';
    answers.push({ ok: true, data: { node: `dvein:${id}:${day}:0`, kind: 'ore', material: 'metal:silver', qty: 1, xp: 45, track: { profession: 'mining', xp: xpForRank(100) + 45, rank: 100, specs: { 50: null, 100: null } }, today: 1, store: { material: 'metal:silver', own: 1, bought: 0 } } });
    assert.equal((await book.harvest(ore(`dvein:${id}:${day}:0`))).ok, true);
    assert.equal(book.dungeonWanted(id), true, 'the answer marks the dungeon');
    for (let i = 0; i < 2; i++) { _ms += 5_001; host.tick(0.016); await settle(); }
    assert.equal(book.dungeon(id)?.state, 'confirmed');
    const left = dungeonVeins({ dungeon: id, day, climate: MOUNTAIN, confirmed: true }).filter((v) => v.slot !== 0).map((v) => mineRecord({ what: 'dvein', material: v.material })).sort();
    assert.deepEqual([...flats].map((b) => b.r).sort(), left, 'stood anew: the service\'s draw (the vein just mined taken)');
    // another, unvouched dungeon: the account's four veins there spent - refused once, offered no more today
    host.leaveDungeon();
    dstate = 'none';
    const other = id + 1;
    host.enterDungeon({ id: other, climate: MOUNTAIN, region: REGION, wall: () => [0, 0, 0], stand: async () => ({}), drop: () => {} });
    for (let i = 0; i < 2; i++) { _ms += 5_001; host.tick(0.016); await settle(); }
    host.tick(0.016);
    assert.ok(host.target?.node.what === 'dvein' && said.prompt?.rest?.startsWith('Mining 100'), `a vein under the look, ready: ${said.prompt?.rest}`);
    answers.push({ ok: false, error: 'prof-deep-cap' });
    assert.equal((await book.harvest(ore(`dvein:${other}:${day}:1`))).error, 'prof-deep-cap');
    host.tick(0.016);
    assert.equal(said.prompt?.rest, '4 veins today in dungeons nobody has vouched for', 'the prompt says the day is done there');
    assert.equal(host.press(), false, 'and E starts nothing');
  } finally { host.dispose(); setForagingHost(null); }
});

test('STORES-ROOM by source: every gathering kind asks the room as the service counts it - herbs, veins, trees, bodies and the net (mutants: a kind reads `held`)', () => {
  const read = (f) => readFileSync(new URL(`../src/scenes/${f}`, import.meta.url), 'utf8');
  for (const f of ['herbHost.js', 'mineHost.js', 'treeHost.js', 'huntHost.js', 'fishHost.js']) {
    const src = read(f);
    assert.match(src, /storesFull: (?:\(key\) => )?storesFullIn\(book, (?:key|FISH_KEY)\)/, `${f}: the room via storesFullIn`);
    assert.doesNotMatch(src, /storesFull[^\n]*book\.held\(/, `${f}: never \`held\` for the room`);
  }
});
