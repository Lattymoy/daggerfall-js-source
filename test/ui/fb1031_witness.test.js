// AUDIT FB1031 W1-W7 (2026-10-31, WITNESS-MAP's audit; bible/06-Systems/Professions-Arc.md section 61, bible/10-UI/
// Held-Map-Arc.md WITNESS-MAP, bible/11-Multiplayer/Scale-Arc.md WITNESS-TILES). The held map asked a region's ground: a
// sample of six regions of up to 35 in view, a province one region, the sea past the Bay region 0 cut at 8,192 pixels,
// and every ask past the writ board's ten-minute keep a scan of the region's witness rows. Now the day's Motherlodes pick
// lays the confirmed ground in 64-pixel tiles keyed by the world pixel, the map reads every tile in view by its key, the
// wash is kept on the sheet's static layer, and a pixel heard confirmed joins it at once. Each pin failed on cbb31b8de5.
// tools/mutants/fb1031_witness.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { standService, T0 } from '../accountDb.mjs';
import { runCron, CRON_MINUTE, MINUTE_JOBS, _resetCronForTests } from '../../server-account/src/cron.js';
import { witnessTileStatements, TILES_LAID_CHARS } from '../../server-account/src/witnessTiles.js';
import { ROUTES, REPLICA_ROUTES, ACCOUNT_VERSION } from '../../server-account/src/service.js';
import { D1_BOOKMARK_READS } from '../../src/net/accountClient.js';
import { busyRead } from '../../src/net/busyLaw.js';
import { witnessedFact, factConfirmed, pixelOk } from '../../src/net/nodeLaw.js';
import { WITNESS_TILE, WITNESS_TILES_ASK, TILES_SPAN, tileOf, tileKey, tileOk, packTile, unpackTile, tileRange } from '../../src/net/witnessTileLaw.js';
import { CLIMATES, REGION_NAMES, regionOfTheatre } from '../../src/formats/mapsTables.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { createProfBook, PROF_REFRESH_BACKOFF_MS, PROF_GROUND_ASK_GAP_MS } from '../../src/net/profBook.js';
import {
  witnessMapReader, tilesInView, syncWashLayer, blitWashLayer, paintWitnessedGround, WITNESS_TINT_RGBA, WITNESS_TINT_CSS, WITNESS_WASH_MARGIN,
} from '../../src/ui/witnessMapMark.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { travelMapFilters, resetTravelMapState, restoreTravelMapSaveData } from '../../src/systems/travel/travelMapState.js';
import { CLIMATES as MAP_CLIMATES } from '../../src/formats/mapsFile.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DAY = utcDay(T0);
const NOON = DAY * 86_400 + 12 * 3600;
const DAGGERFALL = 17, SKYRIM = regionOfTheatre(3), MORROWIND = regionOfTheatre(4);
const tick = () => new Promise((r) => setImmediate(r));

// ─── THE SERVICE ─────────────────────────────────────────────────────

async function stand(t, env = { PROFESSIONS_OPEN: 'on' }) {
  t.mock.method(Date, 'now', () => NOON * 1000);
  _resetCronForTests();
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const said = [];
  const prepare = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => { said.push(sql); return prepare(sql); };
  /** `n` accounts report (x, y) as `climate,region`, from account `from`, a second apart from `at`. */
  const witness = (x, y, climate, region, n = 3, from = 0, at = NOON - 86_400) => {
    for (let i = from; i < from + n; i++) {
      raw.prepare("INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'g', 1, 1)").run(`w${i}`);
      raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, ?, ?)").run(`${x},${y}`, `w${i}`, `${climate},${region}`, region, at + i);
    }
  };
  const minute = () => runCron(s.env, { cron: CRON_MINUTE, nowS: NOON, jobs: MINUTE_JOBS.filter(([n]) => n === 'motherlodes') });
  const who = await s.registered('Sammy');
  const ground = async (tiles, w = who) => (await s.call('/v1/prof/ground', { character: w.character, tiles }, w.secret)).body;
  const laid = () => raw.prepare('SELECT day, tx, ty, px FROM witness_tiles ORDER BY day, ty, tx').all().map((r) => ({ ...r }));
  return { s, raw, said, witness, minute, who, ground, laid };
}

/** The tiles a scan of every pixel's reports before the day says - the law read by hand, beside the service's. */
function tilesByHand(raw) {
  const rows = raw.prepare("SELECT key, account, report, at FROM world_witness WHERE kind = 'pixel' AND at < ?").all(DAY * 86_400);
  const by = new Map();
  for (const r of rows) { if (!by.has(r.key)) by.set(r.key, []); by.get(r.key).push({ account: r.account, report: r.report, at: Number(r.at) }); }
  const tiles = new Map();
  for (const [key, rs] of by) {
    const [x, y] = key.split(',').map(Number);
    if (!factConfirmed(witnessedFact(rs)) || !pixelOk(x, y)) continue;
    const [tx, ty] = tileOf(x, y);
    if (!tiles.has(tileKey(tx, ty))) tiles.set(tileKey(tx, ty), { tx, ty, pixels: [] });
    tiles.get(tileKey(tx, ty)).pixels.push([x, y]);
  }
  return [...tiles.values()].map((t) => ({ day: DAY, tx: t.tx, ty: t.ty, px: packTile(t.tx, t.ty, t.pixels) }))
    .sort((a, b) => (a.ty - b.ty) || (a.tx - b.tx));
}

test('FB1031 W3 W4 the day\'s laying: the tiles match a scan of the confirmed facts - the Bay\'s, a province\'s, the sea\'s past the Bay, a disputed one, one confirmed for another region - never an unconfirmed pixel, one confirmed today or one off the grid; yesterday\'s go (mutants: the laying off the pick; the grid unbounded; the laying the Bay\'s alone; yesterday\'s tiles or mark kept)', async (t) => {
  const { raw, said, witness, minute, laid } = await stand(t);
  witness(410, 152, CLIMATES.Woodlands, DAGGERFALL);
  witness(404, 152, CLIMATES.Mountain, DAGGERFALL);
  witness(420, 160, CLIMATES.Woodlands, DAGGERFALL, 2);   // two confirm nothing
  witness(430, 161, CLIMATES.Woodlands, DAGGERFALL, 1);   // one names Daggerfall, three another region: confirmed ground
  witness(430, 161, CLIMATES.Woodlands, DAGGERFALL + 1, 3, 3);
  witness(440, 170, CLIMATES.Woodlands, DAGGERFALL);   // three confirm, two dispute after: disputed, confirmed still
  witness(440, 170, CLIMATES.Mountain, DAGGERFALL, 2, 6, NOON - 3600 * 20);
  witness(1569, -430, CLIMATES.Mountain, SKYRIM);   // Solitude's ground
  witness(-300, -200, CLIMATES.Ocean, 0);   // the sea past the Bay, as the host's maps read it (region 0)
  witness(-8191, 8191, CLIMATES.Ocean, 0);   // the grid's corner
  witness(450, 175, CLIMATES.Woodlands, DAGGERFALL, 3, 0, NOON - 3600);   // confirmed today: tomorrow's
  witness(9000, 5, CLIMATES.Ocean, 0);   // off the world's grid
  raw.prepare('INSERT INTO witness_tile_days (day, tiles, pixels, n) VALUES (?, 1, 1, ?)').run(DAY - 1, 'old');
  raw.prepare('INSERT INTO witness_tiles (day, tx, ty, px) VALUES (?, 6, 2, ?)').run(DAY - 1, 'AA');
  said.length = 0;
  await minute();
  const want = tilesByHand(raw);
  assert.deepEqual(laid(), want, 'the service\'s tiles are the law\'s');
  assert.deepEqual(want.map((r) => [r.tx, r.ty]), [[24, -7], [-5, -4], [6, 2], [-128, 127]], 'Solitude\'s, the sea\'s, Daggerfall\'s and the corner\'s');
  assert.deepEqual(unpackTile(6, 2, want.find((r) => r.tx === 6).px), [[404, 152], [410, 152], [430, 161], [440, 170]]);
  assert.deepEqual(raw.prepare('SELECT day, tiles, pixels FROM witness_tile_days').all().map((r) => ({ ...r })), [{ day: DAY, tiles: 4, pixels: 7 }], 'the day marked, yesterday\'s gone');
  assert.equal(said.filter((q) => /FROM world_witness/.test(q)).length, 1, 'one scan: the pick\'s');
  assert.ok(raw.prepare('SELECT COUNT(*) AS n FROM motherlode_days WHERE day = ?').get(DAY).n === 1, 'beside the day\'s pick');
});

test('FB1031 W3 a day picked before the tiles (the deploy\'s): the minute\'s job lays them with a scan of its own, and a laid day costs it one read; two layings racing keep the first (mutants: the deploy\'s day never laid; a laid day scanned again; the laying unguarded; a statement unbounded)', async (t) => {
  const { raw, said, witness, minute, laid } = await stand(t);
  witness(410, 152, CLIMATES.Woodlands, DAGGERFALL);
  raw.prepare('INSERT INTO motherlode_days (day, picked, n) VALUES (?, 0, ?)').run(DAY, 'acct240');   // an older service's pick
  await minute();
  assert.deepEqual(laid(), tilesByHand(raw));
  _resetCronForTests();
  said.length = 0;
  await minute();
  assert.equal(said.filter((q) => /world_witness/.test(q)).length, 0, 'laid: no scan');
  assert.equal(said.filter((q) => /witness_tile_days/.test(q)).length, 1, 'one read of the mark');
  // two layings of one day: the second's tiles are never written
  const fresh = await stand(t);
  const db = fresh.s.env.DB;
  await db.batch(witnessTileStatements(db, DAY, [{ x: 1, y: 1 }], 'first').statements);
  await db.batch(witnessTileStatements(db, DAY, [{ x: 200, y: 200 }], 'second').statements);
  assert.deepEqual(fresh.laid().map((r) => [r.tx, r.ty]), [[0, 0]]);
  // a statement binds TILES_LAID_CHARS at most: full tiles split across statements
  const full = [];
  for (let k = 0; k < 20; k++) for (let y = 0; y < WITNESS_TILE; y++) for (let x = 0; x < WITNESS_TILE; x++) full.push({ x: k * WITNESS_TILE + x, y });
  const many = witnessTileStatements(db, DAY + 1, full, 'n');
  assert.equal(many.tiles, 20);
  assert.equal(many.statements.length, 1 + Math.ceil(20 / Math.floor(TILES_LAID_CHARS / (2 * WITNESS_TILE * WITNESS_TILE))) + 2);
});

test('FB1031 W3 W4 the map\'s read: the tiles asked that hold ground, by their keys - two statements, neither of world_witness, the tiles\' a primary-key search; before the day is laid it says so and scans nothing; more than 8,192 of a province\'s pixels all answered (mutants: the read scans; laid unsaid; a tile answered twice; the plan a scan)', async (t) => {
  const { s, raw, said, witness, minute, ground } = await stand(t);
  witness(410, 152, CLIMATES.Woodlands, DAGGERFALL);
  witness(-300, -200, CLIMATES.Ocean, 0);
  said.length = 0;
  assert.deepEqual(await ground([[6, 2]]), { day: DAY, laid: false }, 'not laid yet: said, and nothing scanned');
  assert.equal(said.filter((q) => /world_witness/.test(q)).length, 0);
  // a province's ground past the old cap: 9,000 of Morrowind's pixels
  raw.exec('BEGIN');
  const put = raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, ?, ?)");
  for (let i = 0; i < 3; i++) raw.prepare("INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'g', 1, 1)").run(`w${i}`);
  for (let k = 0; k < 9000; k++) for (let i = 0; i < 3; i++) put.run(`${4480 + (k % 150)},${-600 + Math.floor(k / 150)}`, `w${i}`, `${CLIMATES.Mountain},${MORROWIND}`, MORROWIND, NOON - 86_400 + i);
  raw.exec('COMMIT');
  await minute();
  said.length = 0;
  const marks = s.env.DB._sessions.length;
  const r = await ground([[6, 2], [0, 0], [-5, -4], [6, 2]]);
  assert.deepEqual(r, { day: DAY, laid: true, tiles: [[6, 2, packTile(6, 2, [[410, 152]])], [-5, -4, packTile(-5, -4, [[-300, -200]])]] }, 'the asked tiles holding ground, each once');
  const mine = said.filter((q) => /witness_tile|world_witness/.test(q));
  assert.deepEqual(mine.map((q) => /world_witness/.test(q)), [false, false], 'two statements, no scan');
  assert.ok(s.env.DB._sessions.length > marks && s.env.DB._sessions.at(-1).statements.some((q) => /witness_tiles/.test(q)), 'read on the request\'s D1 session (a replica\'s)');
  const plan = raw.prepare(`EXPLAIN QUERY PLAN ${mine[1]}`).all(DAY, '[[6,2]]').map((p) => p.detail).join(' | ');
  assert.match(plan, /SEARCH t USING PRIMARY KEY \(day=\? AND tx=\? AND ty=\?\)/, plan);
  const mw = [];
  const range = tileRange({ x0: 4480, y0: -600, x1: 4630, y1: -540 });
  for (let ty = range.ty0; ty <= range.ty1; ty++) for (let tx = range.tx0; tx <= range.tx1; tx++) mw.push([tx, ty]);
  const got = (await ground(mw)).tiles.flatMap(([tx, ty, px]) => unpackTile(tx, ty, px));
  assert.equal(got.length, 9000, 'every pixel of the province\'s ground, where one answer held 8,192');
});

test('FB1031 W3 the read\'s door: 1..64 tiles of the world\'s grid, a registered account\'s, the professions open; a replica\'s read, a busy read; acct242 (mutants: the grid unbounded; more than 64 asked; the switch unasked; the route off the replica, on either end)', async (t) => {
  const { s, ground } = await stand(t);
  for (const bad of [[], [[0]], [[1.5, 2]], [[TILES_SPAN, 0]], [[0, -TILES_SPAN - 1]], ['x'], null, Array.from({ length: WITNESS_TILES_ASK + 1 }, (_, i) => [i % 100, 0])]) {
    assert.deepEqual(await ground(bad), { error: 'bad-pixels' }, JSON.stringify(bad)?.slice(0, 40));
  }
  assert.deepEqual(await ground([[-TILES_SPAN, TILES_SPAN - 1]]), { day: DAY, laid: false }, 'the grid\'s corner tile is the world\'s');
  assert.equal(TILES_SPAN, 128);
  assert.equal((await ground(Array.from({ length: WITNESS_TILES_ASK }, (_, i) => [i, 0]))).laid, false, '64 asked');
  const g = await s.guest();
  assert.deepEqual((await s.call('/v1/prof/ground', { character: 'char-guest', tiles: [[0, 0]] }, g.secret)).body, { error: 'prof-need-account' });
  const off = await stand(t, { PROFESSIONS_OPEN: 'off' });
  assert.deepEqual(await off.ground([[0, 0]]), { error: 'prof-closed' });
  assert.ok(ROUTES.has('/v1/prof/ground'));
  assert.equal(REPLICA_ROUTES.get('/v1/prof/ground'), 'POST', 'it writes nothing and keeps nothing an isolate shares');
  assert.equal(D1_BOOKMARK_READS.get('/v1/prof/ground'), 'POST');
  assert.equal(busyRead('/v1/prof/ground', 'POST'), true);
  assert.equal(ACCOUNT_VERSION, 'acct242');
  assert.match(src('server-account/wrangler.toml'), /^ACCOUNT_VERSION = "acct242"$/m);
  assert.doesNotMatch(src('server-account/src/professions.js'), /profGround|GROUND_PIXELS_MAX|x, y, climate: f\.climate/, 'the writ board\'s kept ground is as it was before WITNESS-MAP');
});

test('FB1031 the law: a tile\'s pixels packed two characters each, by row then column, each once, and read back; a tile is 64 pixels of the world\'s grid (mutants: the order dropped; a pixel off its tile packed; a bad string read)', () => {
  assert.equal(WITNESS_TILE, 64);
  assert.deepEqual(tileOf(-1, -1), [-1, -1]);
  assert.deepEqual(tileOf(8191, -8191), [127, -128]);
  assert.equal(tileOk(127, -128), true);
  assert.equal(tileOk(128, 0), false);
  const s = packTile(-1, 2, [[-1, 191], [-64, 128], [-64, 128], [-2, 128], [0, 128], [-1, 192], [9000, 128]]);
  assert.equal(s, 'AAA-__');
  assert.deepEqual(unpackTile(-1, 2, s), [[-64, 128], [-2, 128], [-1, 191]]);
  for (const bad of ['A', 'A!', 7]) assert.equal(unpackTile(0, 0, bad), null);
  assert.equal(unpackTile(128, 0, 'AA'), null);
  assert.deepEqual(tileRange({ x0: -1, y0: 0, x1: 64, y1: 64.5 }), { tx0: -1, ty0: 0, tx1: 0, ty1: 1 });
  assert.deepEqual(tileRange({ x0: -9000, y0: 0, x1: 9000, y1: 1 }, 2), { tx0: -128, ty0: -2, tx1: 127, ty1: 2 });
});

// ─── THE BOOK ────────────────────────────────────────────────────────

/** A book over a door that answers the day's tiles of `ground` ([x, y]...) as the service does. */
function bookRig({ ground = [[410, 152], [-300, -200]], laid = true, day = null } = {}) {
  const S = { now: NOON * 1000, asks: [], ground, laid, day, answer: null, pixels: [] };
  const door = {
    account: () => 'acct1',
    state: async () => ({ ok: true, data: { day: Math.floor(S.now / 86_400_000), character: 'char-sammy', tracks: [] } }),
    ground: async (character, tiles) => {
      S.asks.push(tiles);
      if (S.answer) return S.answer(tiles);
      const d = S.day ?? Math.floor(S.now / 86_400_000);
      if (!S.laid) return { ok: true, data: { day: d, laid: false } };
      const out = [];
      for (const [tx, ty] of tiles) {
        const px = S.ground.filter(([x, y]) => tileKey(...tileOf(x, y)) === tileKey(tx, ty));
        if (px.length) out.push([tx, ty, packTile(tx, ty, px)]);
      }
      return { ok: true, data: { day: d, laid: true, tiles: out } };
    },
    pixels: async (character, list) => ({ ok: true, data: { pixels: list.map(([x, y]) => S.pixels.find((p) => p.x === x && p.y === y) ?? { x, y, state: 'none' }), dungeons: [] } }),
  };
  const book = createProfBook({ door, character: () => 'char-sammy', now: () => S.now, sleep: async () => {} });
  return { S, book };
}

test('FB1031 W1 W4 the book: every tile asked once a UTC day, 64 at a time, one read in flight; a tile asked and not answered holds none; an answer unlaid, failed or of an older day waited out (mutants: asked every poll; the 64 unbounded; unlaid kept as none; an older day asked every poll; the wait gone; the slot unchecked; the day out of the key)', async () => {
  const { S, book } = bookRig();
  assert.equal(await book.askGround([[6, 2]]), false, 'the state unread: the professions not known open');
  assert.deepEqual(S.asks, []);
  await book.refresh();
  const many = Array.from({ length: 70 }, (_, i) => [i - 10, 2]);
  const first = book.askGround(many);
  assert.equal(await book.askGround([[6, 2]]), false, 'one read in flight');
  assert.equal(await first, true);
  assert.equal(S.asks[0].length, WITNESS_TILES_ASK);
  assert.deepEqual(book.groundTile(6, 2), { day: DAY, pixels: [[410, 152]] });
  assert.deepEqual(book.groundTile(0, 2), { day: DAY, pixels: [] }, 'asked, and none');
  assert.equal(book.groundTile(-5, -4), null, 'not yet asked');
  assert.equal(await book.askGround(many), false, 'AUDIT FB1031 II T2: not inside the gap after a landing');
  S.now += PROF_GROUND_ASK_GAP_MS;
  assert.equal(await book.askGround(many), true, 'the rest');
  assert.deepEqual(S.asks[1], many.slice(WITNESS_TILES_ASK));
  assert.equal(await book.askGround(many), false, 'heard today: not asked again');
  assert.equal(S.asks.length, 2);
  // unlaid: waited out
  S.now += PROF_GROUND_ASK_GAP_MS;
  S.laid = false;
  assert.equal(await book.askGround([[-5, -4]]), false);
  assert.equal(await book.askGround([[-5, -4]]), false);
  assert.equal(S.asks.length, 3, 'the day not laid: asked again only after the wait');
  S.now += PROF_REFRESH_BACKOFF_MS;
  S.laid = true;
  assert.equal(await book.askGround([[-5, -4]]), true);
  assert.deepEqual(book.groundTile(-5, -4).pixels, [[-300, -200]]);
  // an older day's answer (this device past midnight first): waited out, not asked every poll
  const k = book.groundKey();
  S.now += 86_400_000;
  assert.notEqual(book.groundKey(), k, 'the day turned: the map reads again');
  S.day = DAY;
  assert.equal(await book.askGround([[6, 2]]), false);
  assert.equal(await book.askGround([[6, 2]]), false);
  assert.equal(S.asks.length, 5);
  assert.equal(book.groundTile(6, 2), null, 'yesterday\'s tile is no word today');
  // a shut switch heard, and nothing asked while it is
  S.now += PROF_REFRESH_BACKOFF_MS;
  S.answer = () => ({ ok: false, error: 'prof-closed' });
  assert.equal(await book.askGround([[6, 2]]), false);
  assert.equal(book.state.open, false, 'the switch shut');
  S.now += PROF_REFRESH_BACKOFF_MS;
  const shut = S.asks.length;
  assert.equal(await book.askGround([[7, 2]]), false);
  assert.equal(S.asks.length, shut, 'nothing asked while shut');
  S.answer = null;
  // an answer for a slot no longer played is dropped
  S.now += PROF_REFRESH_BACKOFF_MS;
  S.day = null;
  let who = 'char-sammy';
  const door = {
    account: () => 'acct1',
    state: async () => ({ ok: true, data: { day: DAY, character: 'char-sammy', tracks: [] } }),
    ground: async () => { who = 'char-other'; return { ok: true, data: { day: DAY, laid: true, tiles: [[6, 2, 'Ya']] } }; },
  };
  const b2 = createProfBook({ door, character: () => who, now: () => NOON * 1000, sleep: async () => {} });
  await b2.refresh();
  assert.equal(await b2.askGround([[6, 2]]), false);
  assert.equal(b2.groundTile(6, 2), null, 'another character\'s answer');
});

test('FB1031 W6 a pixel a read hears confirmed - after the harvest that confirmed it, or the ore card\'s - joins the wash at once, its tile held or not yet (mutants: heard unkept; the held tile unmoved; the key unmoved; a landing without it)', async () => {
  const { S, book } = bookRig({ ground: [[410, 152]] });
  await book.refresh();
  await book.askGround([[6, 2]]);
  const k0 = book.groundKey();
  S.pixels = [{ x: 411, y: 153, state: 'confirmed', climate: CLIMATES.Woodlands, region: DAGGERFALL }, { x: 412, y: 153, state: 'unconfirmed' }, { x: -299, y: -199, state: 'disputed', climate: CLIMATES.Ocean, region: 0 }];
  await book.askPixels([[411, 153], [412, 153], [-299, -199]]);
  assert.deepEqual(book.groundTile(6, 2).pixels, [[410, 152], [411, 153]], 'the held tile at once; an unconfirmed pixel never');
  assert.notEqual(book.groundKey(), k0, 'the map reads it again');
  S.now += PROF_GROUND_ASK_GAP_MS;
  await book.askGround([[-5, -4]]);
  assert.deepEqual(book.groundTile(-5, -4).pixels, [[-299, -199]], 'a tile landing after: the heard pixel in it (the day\'s tiles were laid at its start)');
});

// ─── THE READER ──────────────────────────────────────────────────────

test('FB1031 W1 the reader: every tile the view touches is asked, nearest the middle first, over the Bay and past it - the whole view, where six regions\' sample left 55% of its land unasked; the read hands the tiles a margin past it, its key moving with a landing or the view past its range (mutants: the middle not first; a tile unasked; the margin dropped; the range never held; the key never moving)', async () => {
  const box = { x0: 100, y0: 100, x1: 720, y1: 478 };   // the mid band's view at 1920 x 1080
  const all = tilesInView(box);
  const r = tileRange(box);
  assert.equal(all.length, (r.tx1 - r.tx0 + 1) * (r.ty1 - r.ty0 + 1));
  assert.deepEqual(all[0], tileOf(410, 289), 'the middle\'s tile first');
  for (const [x0, y0] of [[100, 100], [4300, -800], [-1200, -900]]) {   // the Bay, Morrowind, the sea past the Bay
    const { S, book } = bookRig({ ground: [[x0 + 5, y0 + 5], [x0 + 610, y0 + 370]] });
    await book.refresh();
    const reader = witnessMapReader(book);
    const view = { x0, y0, x1: x0 + 620, y1: y0 + 378 };
    let last = reader.read(view);
    for (let i = 0; i < 6; i++) { await tick(); await tick(); S.now += PROF_GROUND_ASK_GAP_MS; last = reader.read(view); }
    const asked = new Set(S.asks.flat().map((t) => tileKey(...t)));
    for (let y = y0; y < y0 + 378; y += 7) for (let x = x0; x < x0 + 620; x += 7) assert.ok(asked.has(tileKey(...tileOf(x, y))), `(${x}, ${y}) asked`);
    assert.deepEqual(last.tiles.flatMap((t) => t.pixels).sort(), [[x0 + 5, y0 + 5], [x0 + 610, y0 + 370]].sort(), 'both corners washed');
    const m = tileRange(view, WITNESS_WASH_MARGIN);
    assert.deepEqual([last.x0, last.y0, last.x1, last.y1], [m.tx0 * 64, m.ty0 * 64, (m.tx1 + 1) * 64, (m.ty1 + 1) * 64], 'its box a margin past the view');
    assert.equal(reader.read(view), last, 'nothing new: the same read');
    assert.equal(reader.read({ ...view, x0: x0 + 64, x1: x0 + 684 }).key, last.key, 'a tile on, inside the range: held');
    const on = reader.read({ ...view, x0: x0 + 192, x1: x0 + 812 });
    assert.notEqual(on.key, last.key, 'past the range: the key moves');
    assert.equal(on.x1, (tileRange({ ...view, x0: x0 + 192, x1: x0 + 812 }, WITNESS_WASH_MARGIN).tx1 + 1) * 64, 'its range the view\'s again');
  }
  const { S, book } = bookRig({ ground: [] });
  const empty = witnessMapReader(book);
  assert.equal(empty.open(), false);
  assert.equal(empty.read(box).key, '', 'shut: nothing read');
  await tick();
  assert.deepEqual(S.asks, [], 'or asked');
  await book.refresh();
  assert.equal(empty.open(), true);
  empty.read(box); await tick(); await tick();
  assert.deepEqual(empty.read(box).key, '', 'no ground: no key');
});

// ─── THE WASH ────────────────────────────────────────────────────────

/** A 2D context that records its calls and keeps image data as a canvas would. */
function fakeCtx() {
  const calls = [];
  const state = { imageSmoothingEnabled: true };
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'createImageData') return (w, h) => { calls.push({ fn: k, args: [w, h] }); return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
      if (k === 'measureText') return (txt) => ({ width: String(txt).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, smooth: state.imageSmoothingEnabled, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const fakeCanvas = () => { const ctx = fakeCtx(); return { width: 0, height: 0, ctx, getContext: () => ctx }; };

test('FB1031 W2 the wash kept: a read\'s pixels as texels of one bitmap, built once a read and blitted in one drawImage, its texel a pixel\'s square (smoothing off); no image data, each pixel\'s square (mutants: built every frame; a texel off its pixel; the blit off its box; smoothing on)', () => {
  const read = { key: 'k1', x0: 384, y0: 128, x1: 512, y1: 192, tiles: [{ tx: 6, ty: 2, pixels: [[410, 152], [384, 128]] }] };
  const canvas = fakeCanvas();
  const layer = syncWashLayer(null, read, canvas);
  assert.deepEqual([canvas.width, canvas.height, layer.w, layer.h], [128, 64, 128, 64]);
  const d = canvas.ctx.calls.find((c) => c.fn === 'putImageData').args[0].data;
  const at = (x, y) => [...d.slice(4 * ((y - 128) * 128 + (x - 384)), 4 * ((y - 128) * 128 + (x - 384)) + 4)];
  assert.deepEqual(at(410, 152), [...WITNESS_TINT_RGBA]);
  assert.deepEqual(at(384, 128), [...WITNESS_TINT_RGBA]);
  assert.equal(d.reduce((n, v, i) => n + (i % 4 === 3 && v > 0 ? 1 : 0), 0), 2, 'two texels, nothing else');
  assert.equal(WITNESS_TINT_RGBA[3], 107, 'the wash\'s 0.42');
  assert.equal(syncWashLayer(layer, read, canvas), layer, 'the same read: kept');
  assert.equal(canvas.ctx.calls.filter((c) => c.fn === 'putImageData').length, 1);
  const moved = syncWashLayer(layer, { ...read, key: 'k2', tiles: [{ tx: 6, ty: 2, pixels: [[400, 140]] }] }, canvas);
  assert.notEqual(moved, layer);
  assert.equal(canvas.ctx.calls.filter((c) => c.fn === 'putImageData').length, 2, 'a read moved: built again');
  const dest = fakeCtx();
  blitWashLayer(dest, moved, { ox: 380, oy: 120, scale: 3 });
  const blit = dest.calls.filter((c) => c.fn === 'drawImage');
  assert.equal(blit.length, 1);
  assert.deepEqual(blit[0].args, [canvas, 12, 24, 384, 192]);
  assert.equal(blit[0].smooth, false, 'each texel a crisp square');
  assert.equal(dest.imageSmoothingEnabled, true, 'and put back');
  // no image data: the squares, a tile out of view passed over
  assert.equal(syncWashLayer(null, read, { width: 0, height: 0, getContext: () => ({}) }), null);
  const sq = fakeCtx();
  const visible = (x, y, pad = 2) => x >= 380 - pad && y >= 120 - pad && x <= 420 + pad && y <= 160 + pad;
  paintWitnessedGround(sq, { ox: 380, oy: 120, scale: 3 }, [...read.tiles, { tx: 60, ty: 60, pixels: [[3840, 3840]] }], visible);
  assert.deepEqual(sq.calls.filter((c) => c.fn === 'rect').map((c) => c.args), [[90, 96, 3, 3], [12, 24, 3, 3]]);
  assert.equal(sq.calls.filter((c) => c.fn === 'fill' && c.fillStyle === WITNESS_TINT_CSS).length, 1);
});

function fakeDocument(canvases) {
  const node = (tag = 'div') => {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, attrs: {}, className: '', textContent: '', id: '', title: '',
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      replaceChildren(...k) { n.children = [...k]; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    if (n.tagName === 'CANVAS') { const c = fakeCanvas(); Object.assign(n, { getContext: c.getContext, ctx: c.ctx, width: 0, height: 0 }); canvases.push(n); }
    return n;
  };
  return { createElement: (t) => node(t), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}

function mapRig(read) {
  const canvases = [];
  globalThis.document = fakeDocument(canvases);
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 405, y: 150 }), getClimateIndex: () => MAP_CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(1000 * 500).fill(10) }, mapSize: { width: 1000, height: 500 },
    maps: { getPoliticIndex: () => 128 + DAGGERFALL, regionCount: 62 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    witnessed: { open: () => true, read: () => read() },
  });
  win._paper = { w: 600, h: 300, dpr: 1, k: 1 };
  win._view = { ox: 380, oy: 140, scale: 6 };
  return { win, canvases };
}

test('FB1031 W2 the held map: the wash is the sheet\'s kept layer - its read in the static key (never the marks\' bake), painted from its bitmap, the overlay painting none; a pulse frame repaints nothing of it, a pan frame one drawImage (mutants: a static paint without the wash; the read out of the static key; the read in the marks\' key; the read unkept)', () => {
  resetTravelMapState();
  try {
    let read = { key: 'k1', x0: 256, y0: 0, x1: 640, y1: 320, tiles: [{ tx: 6, ty: 2, pixels: [[410, 152], [404, 152]] }] };
    const { win, canvases } = mapRig(() => read);
    const sheet = win._sheets.get('world');
    const marks0 = sheet.marksKey(), key0 = sheet.staticKey();
    win._refreshParty();
    assert.equal(win._witnessRead, read);
    assert.equal(sheet.marksKey(), marks0, 'the marks\' bake never reads the wash');
    assert.notEqual(sheet.staticKey(), key0, 'the kept layer does');
    assert.match(sheet.staticKey(), /\|k1$/);
    assert.match(src('src/ui/heldMap.js'), /contentKey: \[env\.view\.scale, env\.band, env\.dpr, env\.paperW, env\.paperH, sheet\.marksKey\(\)\]/, 'the marks\' bake keyed on the marks alone');
    const ov = fakeCtx();
    sheet.paintOverlay(ov, { view: win._view, paperW: 600, paperH: 300, dpr: 1, pulse: 0.5 });
    assert.equal(ov.calls.some((c) => (c.fn === 'rect' && c.fillStyle === WITNESS_TINT_CSS) || c.fn === 'putImageData'), false, 'the overlay paints no wash');
    const env = { view: win._view, paperW: 600, paperH: 300, dpr: 1, band: 'near' };
    const st = fakeCtx();
    win._paintWash(st, env);
    const wash = canvases.find((c) => c.ctx.calls.some((k) => k.fn === 'putImageData'));
    assert.ok(wash, 'the wash\'s own bitmap');
    assert.deepEqual(st.calls.filter((c) => c.fn === 'drawImage').map((c) => c.args), [[wash, (256 - 380) * 6, (0 - 140) * 6, 384 * 6, 320 * 6]]);
    // a pan frame: one drawImage, the bitmap kept
    const pan = fakeCtx();
    win._paintWash(pan, { ...env, view: { ox: 381, oy: 140, scale: 6 } });
    assert.equal(pan.calls.filter((c) => c.fn === 'drawImage').length, 1);
    assert.equal(wash.ctx.calls.filter((c) => c.fn === 'putImageData').length, 1, 'built once');
    // the paint calls it on the kept layer
    const paintStatic = src('src/ui/heldMap.js').slice(src('src/ui/heldMap.js').indexOf('      paintStatic: (ctx, env) => {'), src('src/ui/heldMap.js').indexOf('      paintOverlay: (ctx, env) => {'));
    assert.equal([...paintStatic.matchAll(/this\._paintWash\(ctx, env\);/g)].length, 2, 'both of the static paint\'s ends');
    // a landing moves the read: built again
    read = { ...read, key: 'k2', tiles: [{ tx: 6, ty: 2, pixels: [[410, 152]] }] };
    win._refreshParty();
    win._paintWash(fakeCtx(), env);
    assert.equal(wash.ctx.calls.filter((c) => c.fn === 'putImageData').length, 2);
  } finally { resetTravelMapState(); delete globalThis.document; }
});

test('FB1031 W7 the Ground switch: kept in the save both ways, and the key redrawn when it is pressed (mutants: the restore unread; the key\'s signature blind to the switch)', () => {
  resetTravelMapState();
  try {
    restoreTravelMapSaveData({ filterWitnessed: true });
    assert.equal(travelMapFilters().witnessed, true, 'a save that hid it hides it');
    restoreTravelMapSaveData({ filterWitnessed: false });
    assert.equal(travelMapFilters().witnessed, false);
    const { win } = mapRig(() => ({ key: '', tiles: [] }));
    win._phase = 'map';
    win._keySig = ''; win._renderKey();
    const sw = () => win._chrome.key.children.flatMap((r) => r.children?.[1]?.children ?? []).find((b) => b.dataset?.filter === 'witnessed');
    assert.equal(sw().className.includes(' on'), true);
    sw().onclick();
    assert.equal(sw().className.includes(' on'), false, 'pressed: the key redrawn off');
    assert.equal(sw().attrs['aria-pressed'], 'false');
  } finally { resetTravelMapState(); delete globalThis.document; }
});

// ─── THE PLAYER'S OWN FILES ──────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('FB1031 W5 (ARENA2): the sea past the Bay and Morrowind\'s ground as the host\'s own maps read them - Ocean and region 0, a province\'s region - witnessed, laid, asked and washed (mutants: the laying the Bay\'s alone)', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, async (t) => {
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { groundMaps } = await import('../../src/world/tamriel/tamrielGround.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  groundMaps(maps);
  const sea = [-300, -200], mw = [4571, -551];
  assert.deepEqual([maps.getClimateIndex(...sea), maps.getRegionIndexAt(...sea)], [MAP_CLIMATES.Ocean, 0], 'the sea past the Bay is Ocean, region 0, on the host\'s maps');
  assert.equal(maps.getRegionIndexAt(...mw), MORROWIND);
  assert.equal(REGION_NAMES[MORROWIND], 'Morrowind');
  const { witness, minute, who, s } = await stand(t);
  for (const p of [sea, mw]) witness(p[0], p[1], maps.getClimateIndex(...p), maps.getRegionIndexAt(...p));
  await minute();
  const door = { account: () => who.id, state: async () => ({ ok: true, data: { day: DAY, character: who.character, tracks: [] } }),
    ground: async (c, tiles) => { const r = await s.call('/v1/prof/ground', { character: c, tiles }, who.secret); return { ok: r.status === 200, data: r.body }; } };
  let clock = NOON * 1000;
  const book = createProfBook({ door, character: () => who.character, now: () => (clock += 250), sleep: async () => {} });
  await book.refresh();
  const reader = witnessMapReader(book);
  for (const [x, y] of [sea, mw]) {
    const view = { x0: x - 100, y0: y - 60, x1: x + 100, y1: y + 60 };
    reader.read(view);
    for (let i = 0; i < 200 && !reader.read(view).tiles.length; i++) await new Promise((r) => setTimeout(r, 5));   // the service's own round trip
    assert.deepEqual(reader.read(view).tiles.flatMap((tl) => tl.pixels), [[x, y]], `(${x}, ${y}) washed`);
  }
});

// AUDIT FB1031 II T1: the wash's bitmap (up to 9 MB at 4K, doubled by its backing) and its kept image outlived the window
// and the world sheet's unmount, where the marks' bitmap is let go.
test('AUDIT FB1031 II T1: the wash\'s bitmap goes with the window and the world sheet - its canvas emptied, its layer and read forgotten (mutants: kept by dispose; kept by the sheet\'s unmount)', () => {
  resetTravelMapState();
  try {
    const read = { key: 'k1', x0: 256, y0: 0, x1: 640, y1: 320, tiles: [{ tx: 6, ty: 2, pixels: [[410, 152]] }] };
    const built = () => {
      const { win, canvases } = mapRig(() => read);
      win._refreshParty();
      win._paintWash(fakeCtx(), { view: win._view, paperW: 600, paperH: 300, dpr: 1, band: 'near' });
      const wash = canvases.find((c) => c.ctx.calls.some((k) => k.fn === 'putImageData'));
      assert.ok(wash && wash.width > 0 && win._washLayer, 'built');
      return { win, wash };
    };
    const a = built();
    a.win._sheets.get('world').unmount();
    assert.deepEqual([a.wash.width, a.wash.height, a.win._washCanvas, a.win._washLayer, a.win._witnessRead], [0, 0, null, null, null], 'the sheet unmounted');
    const b = built();
    b.win.dispose();
    assert.deepEqual([b.wash.width, b.wash.height, b.win._washCanvas, b.win._washLayer], [0, 0, null, null], 'the window gone');
  } finally { resetTravelMapState(); delete globalThis.document; }
});

// AUDIT FB1031 II T2: a pan asked at the map's 4 Hz poll, a thin strip each time: 235-240 asks a minute, the account's
// whole door rate (accounts.js ACCOUNT_MAX), so its harvests and saves were refused.
test('AUDIT FB1031 II T2: a pan across the continent asks at most one ground read a second, each carrying the ring past the view (mutants: no gap after a landing; the view alone asked)', async () => {
  const { ACCOUNT_WINDOW_S } = await import('../../server-account/src/accounts.js');
  const DAYMS = 86_400_000, start = 20_000 * DAYMS + 12 * 3600_000;
  let now = start;
  const asks = [];
  const door = { account: () => 'a1', state: async () => ({ ok: true, data: { day: 20_000, character: 'c', tracks: [] } }),
    ground: async (c, tiles) => { asks.push({ at: now, n: tiles.length }); return { ok: true, data: { day: 20_000, laid: true, tiles: [] } }; } };
  const book = createProfBook({ door, character: () => 'c', now: () => now, sleep: async () => {} });
  await book.refresh();
  const reader = witnessMapReader(book);
  const vw = 1920 / 2.4, vh = 1080 / 2.4, step = (600 / 2.4) * 0.25;
  let x = 400, y = 300;
  for (let t = 0; t < 480; t++) {   // two minutes of a 600 paper px/s drag, eastward
    now += 250; x += step;
    reader.read({ x0: x, y0: y, x1: x + vw, y1: y + vh });
    for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
  }
  let worst = 0;
  for (const a of asks) worst = Math.max(worst, asks.filter((b) => b.at >= a.at && b.at < a.at + ACCOUNT_WINDOW_S * 1000).length);
  assert.ok(worst <= 61, `at most one a second: ${worst} in a minute`);
  assert.ok(asks.slice(2).every((a) => a.n > 13), `each ask carries the ring ahead, not a strip: ${asks.slice(2, 8).map((a) => a.n)}`);
  // a still view: the ring past it held before any pan reaches it
  const still = { x0: 4000, y0: 1000, x1: 4000 + vw, y1: 1000 + vh };
  for (let i = 0; i < 8; i++) { now += 1000; reader.read(still); for (let j = 0; j < 4; j++) await new Promise((r) => setImmediate(r)); }
  const ahead = tileRange(still, WITNESS_WASH_MARGIN);
  assert.notEqual(book.groundTile(ahead.tx1, ahead.ty1), null, 'the ring\'s far corner asked ahead of the pan');
});

// AUDIT FB1031 II T3: the kept image is reused for a read of the same size - the old range's texels must be cleared, and
// a read of a new size must build a new image.
test('AUDIT FB1031 II T3: a moved read of the same size clears the old texels; a read of another size builds an image of its size (mutants: the fill dropped; the size unchecked)', () => {
  const canvas = fakeCanvas();
  const a = { key: 'k1', x0: 384, y0: 128, x1: 512, y1: 192, tiles: [{ tx: 6, ty: 2, pixels: [[410, 152]] }] };
  const la = syncWashLayer(null, a, canvas);
  const b = { key: 'k2', x0: 448, y0: 128, x1: 576, y1: 192, tiles: [{ tx: 8, ty: 2, pixels: [[520, 140]] }] };
  const lb = syncWashLayer(la, b, canvas);
  const d = canvas.ctx.calls.filter((c) => c.fn === 'putImageData').at(-1).args[0].data;
  assert.equal(d.reduce((n, v, i) => n + (i % 4 === 3 && v > 0 ? 1 : 0), 0), 1, 'only the new read\'s texel');
  const c = { key: 'k3', x0: 384, y0: 128, x1: 576, y1: 256, tiles: [{ tx: 6, ty: 2, pixels: [[410, 152]] }] };
  const lc = syncWashLayer(lb, c, canvas);
  assert.deepEqual([lc.w, lc.h, canvas.ctx.calls.filter((k) => k.fn === 'putImageData').at(-1).args[0].width], [192, 128, 192]);
});
