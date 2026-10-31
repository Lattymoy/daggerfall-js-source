// WITNESS-MAP (2026-10-31, Discord #feature-feedback, Sammy: "Display on the world map 'witnessed areas' for stuff like
// ores and pearls."; the original ask, FIELD BUGS 2026-10-11d: "how are we supposed to tell if higher tier veins have been
// unlocked in an area?"). The held map tints each pixel three accounts have confirmed, for the regions in view: the
// service answers a region's confirmed pixels off the writ board's kept ground (/v1/prof/ground), the professions' book
// keeps each region's for its UTC day, and the map reads them through the host's reader, beside a legend row and a switch.
// bible/06-Systems/Professions-Arc.md section 61, bible/10-UI/Held-Map-Arc.md WITNESS-MAP. tools/mutants/witness_map.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { GROUND_PIXELS_MAX } from '../../server-account/src/professions.js';
import { ROUTES, REPLICA_ROUTES, ACCOUNT_VERSION } from '../../server-account/src/service.js';
import { busyRead } from '../../src/net/busyLaw.js';
import { CLIMATES, REGION_NAMES, regionOfTheatre } from '../../src/formats/mapsTables.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { createProfBook, PROF_REFRESH_BACKOFF_MS } from '../../src/net/profBook.js';
import {
  witnessMapReader, regionsInView, paintWitnessedGround, WITNESS_TINT_CSS, WITNESS_SWATCH_CSS, WITNESS_LEGEND_TEXT, WITNESS_VIEW_REGIONS,
} from '../../src/ui/witnessMapMark.js';
import { paintInkOverlay } from '../../src/ui/ink/inkMap.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { travelMapFilters, resetTravelMapState, travelMapSaveData, restoreTravelMapSaveData } from '../../src/systems/travel/travelMapState.js';
import { CLIMATES as MAP_CLIMATES } from '../../src/formats/mapsFile.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const DAGGERFALL = 17, SKYRIM = regionOfTheatre(3), CYRODIIL = REGION_NAMES.length - 1;
const tick = () => new Promise((r) => setImmediate(r));

// ─── THE SERVICE ─────────────────────────────────────────────────────

async function stand(t, env = { PROFESSIONS_OPEN: 'on' }) {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const scans = { n: 0 };
  const prepare = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => { if (/kind = 'pixel' AND region = \?/.test(sql)) scans.n++; return prepare(sql); };
  /** A pixel's reports: `n` week-old accounts naming it `climate,region` (three confirm it). */
  const witness = (x, y, climate, region, n = 3, from = 0) => {
    for (let i = from; i < from + n; i++) {
      raw.prepare("INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'g', 1, 1)").run(`w${i}`);
      raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, ?, ?)").run(`${x},${y}`, `w${i}`, `${climate},${region}`, region, NOON - 86_400 + i);
    }
  };
  const who = await s.registered('Sammy');
  const ground = async (region, w = who) => (await s.call('/v1/prof/ground', { character: w.character, region }, w.secret)).body;
  return { s, raw, scans, witness, who, ground };
}

test('WITNESS-MAP the service: a region\'s confirmed pixels as [x, y] by row then column - a Bay region\'s and a province\'s past the Bay, never an unconfirmed pixel or one the witnesses confirmed for another region (mutants: the unconfirmed sent; x and y lost; the order dropped; another region\'s pixel sent)', async (t) => {
  const { witness, ground } = await stand(t);
  witness(410, 152, CLIMATES.Woodlands, DAGGERFALL);
  witness(404, 152, CLIMATES.Mountain, DAGGERFALL);
  witness(412, 150, CLIMATES.Woodlands, DAGGERFALL);
  witness(420, 160, CLIMATES.Woodlands, DAGGERFALL, 2);   // two accounts confirm nothing
  witness(430, 161, CLIMATES.Woodlands, DAGGERFALL, 1);   // one early report names Daggerfall...
  witness(430, 161, CLIMATES.Woodlands, DAGGERFALL + 1, 3, 3);   // ...three confirm another region
  witness(1569, -430, CLIMATES.Mountain, SKYRIM);   // Solitude's ground, past the Bay
  witness(1820, -300, CLIMATES.Ocean, SKYRIM);   // and the sea's, where the pearls are
  assert.deepEqual(await ground(DAGGERFALL), { region: DAGGERFALL, pixels: [[412, 150], [404, 152], [410, 152]], more: false });
  assert.deepEqual(await ground(SKYRIM), { region: SKYRIM, pixels: [[1569, -430], [1820, -300]], more: false });
  assert.deepEqual(await ground(DAGGERFALL + 1), { region: DAGGERFALL + 1, pixels: [[430, 161]], more: false });
  assert.deepEqual(await ground(CYRODIIL), { region: CYRODIIL, pixels: [], more: false }, 'the last region of the world is a region');
});

test('WITNESS-MAP the service: any region of the world\'s 0..70, a registered account\'s, the professions open - every other region refused, and the route a busy read on the binding (mutants: a region past the world taken; the switch unasked; the route unserved)', async (t) => {
  const { s, ground } = await stand(t);
  for (const bad of [-1, REGION_NAMES.length, 1000, 1.5, '17', null]) assert.deepEqual(await ground(bad), { error: 'bad-region' }, String(bad));
  const g = await s.guest();
  assert.deepEqual((await s.call('/v1/prof/ground', { character: 'char-guest', region: 1 }, g.secret)).body, { error: 'prof-need-account' });
  const off = await stand(t, { PROFESSIONS_OPEN: 'off' });
  assert.deepEqual(await off.ground(1), { error: 'prof-closed' });
  assert.ok(ROUTES.has('/v1/prof/ground'));
  assert.equal(busyRead('/v1/prof/ground', 'POST'), true, 'it stands back while the service is overloaded');
  assert.equal(REPLICA_ROUTES.has('/v1/prof/ground'), false, 'an isolate keeps its ground, so it stays on the binding (DISPLAY-REPLICA\'s law)');
  assert.equal(ACCOUNT_VERSION, 'acct235');
  assert.match(src('server-account/wrangler.toml'), /^ACCOUNT_VERSION = "acct235"$/m);
});

test('WITNESS-MAP the service: the ground is the writ board\'s kept read - a map\'s ask after a board read scans nothing, and the board still posts off the ground that now carries x and y (mutants: the map reads past the keep)', async (t) => {
  const { s, scans, witness, who, ground } = await stand(t);
  witness(410, 152, CLIMATES.Woodlands, DAGGERFALL);
  const board = (await s.call('/v1/writs/list', { character: who.character, region: DAGGERFALL }, who.secret)).body;
  assert.ok(board.writs.length > 0, 'the board posts off the ground');
  assert.equal(scans.n, 1);
  assert.deepEqual((await ground(DAGGERFALL)).pixels, [[410, 152]]);
  assert.deepEqual((await ground(DAGGERFALL)).pixels, [[410, 152]]);
  assert.equal(scans.n, 1, 'the map read the kept ground');
});

test('WITNESS-MAP the service: an answer holds GROUND_PIXELS_MAX pixels at most, the first by row then column, and says there are more (mutants: the cap gone; more unsaid)', async (t) => {
  const { raw, ground } = await stand(t);
  for (let i = 0; i < 3; i++) raw.prepare("INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'g', 1, 1)").run(`w${i}`);
  const put = raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, ?, ?)");
  const report = `${CLIMATES.Mountain},${SKYRIM}`;
  raw.exec('BEGIN');
  for (let k = 0; k <= GROUND_PIXELS_MAX; k++) for (let i = 0; i < 3; i++) put.run(`${1500 + (k % 128)},${-600 + Math.floor(k / 128)}`, `w${i}`, report, SKYRIM, NOON - 86_400 + i);
  raw.exec('COMMIT');
  const r = await ground(SKYRIM);
  assert.equal(GROUND_PIXELS_MAX, 8192);
  assert.equal(r.pixels.length, GROUND_PIXELS_MAX);
  assert.equal(r.more, true);
  assert.deepEqual([r.pixels[0], r.pixels.at(-1)], [[1500, -600], [1627, -600 + 63]], 'the rows from the north');
});

// ─── THE BOOK ────────────────────────────────────────────────────────

function bookRig({ answer = (region) => ({ ok: true, data: { region, pixels: [[region, 1], [region, 2]], more: false } }) } = {}) {
  const S = { now: NOON * 1000, asks: [], answer };
  const door = {
    account: () => 'acct1',
    state: async () => ({ ok: true, data: { day: Math.floor(S.now / 86_400_000), character: 'char-sammy', tracks: [] } }),
    ground: async (character, region) => { S.asks.push([character, region]); return S.answer(region); },
  };
  const book = createProfBook({ door, character: () => 'char-sammy', now: () => S.now, sleep: async () => {} });
  return { S, book };
}

test('WITNESS-MAP the book: a region\'s ground asked once a UTC day while the professions are open - one read in flight, a failure not asked again inside the backoff, a malformed pixel dropped, a shut switch heard (mutants: asked every poll; asked while shut; the backoff gone; a stale day kept)', async () => {
  const { S, book } = bookRig();
  assert.equal(await book.askGround(DAGGERFALL), false, 'the state unread: the professions not known open');
  assert.deepEqual(S.asks, []);
  await book.refresh();
  assert.equal(book.state.open, true);
  assert.equal(book.ground(DAGGERFALL), null);
  const first = book.askGround(DAGGERFALL);
  assert.equal(await book.askGround(SKYRIM), false, 'one read in flight');
  assert.equal(await first, true);
  assert.deepEqual(book.ground(DAGGERFALL), { day: Math.floor(S.now / 86_400_000), pixels: [[DAGGERFALL, 1], [DAGGERFALL, 2]], more: false });
  assert.equal(await book.askGround(DAGGERFALL), false, 'heard today');
  assert.equal(await book.askGround(SKYRIM), true, 'a province\'s region past the Bay');
  assert.deepEqual(S.asks, [['char-sammy', DAGGERFALL], ['char-sammy', SKYRIM]]);
  S.now += 86_400_000;
  assert.equal(book.ground(DAGGERFALL), null, 'yesterday\'s ground is no word');
  S.answer = () => ({ ok: false, error: 'server' });
  assert.equal(await book.askGround(DAGGERFALL), false);
  const n = S.asks.length;
  assert.equal(await book.askGround(DAGGERFALL), false);
  assert.equal(S.asks.length, n, 'a failure waits out the backoff');
  S.now += PROF_REFRESH_BACKOFF_MS;
  S.answer = () => ({ ok: true, data: { pixels: [[5, 6], [5], 'x', [1.5, 2], [9000, 1], [-7, -8]], more: true } });
  assert.equal(await book.askGround(DAGGERFALL), true, 'asked again after it');
  assert.deepEqual(book.ground(DAGGERFALL).pixels, [[5, 6], [-7, -8]], 'the world\'s pixels alone');
  assert.equal(book.ground(DAGGERFALL).more, true);
  S.answer = () => ({ ok: false, error: 'prof-closed' });
  assert.equal(await book.askGround(1), false);
  assert.equal(book.state.open, false, 'the switch shut');
  assert.equal(await book.askGround(2), false, 'and nothing asked while it is');
});

// ─── THE READER ──────────────────────────────────────────────────────

/** A map of vertical strips, `regions` left to right over `x0..x1`: a pixel's region its strip's. */
const strips = (x0, x1, regions) => (x) => regions[Math.max(0, Math.min(regions.length - 1, Math.floor(((x - x0) / (x1 - x0)) * regions.length)))];

test('WITNESS-MAP the reader: the regions in view nearest the middle first, WITNESS_VIEW_REGIONS at most; each not heard today asked, and the pixels of those heard handed on under a key that moves only when one lands - over the Bay and past it (mutants: the middle not first; no bound; nothing asked; the key never moving)', async () => {
  const box = { x0: 0, y0: 0, x1: 700, y1: 100 };
  assert.deepEqual(regionsInView(box, strips(0, 700, [1, 2, 3, 4, 5, 6, 7])), [4, 3, 5, 2, 6, 1].slice(0, WITNESS_VIEW_REGIONS));
  assert.equal(WITNESS_VIEW_REGIONS, 6);
  assert.deepEqual(regionsInView(box, strips(0, 700, [1, 2, 3, 4, 5, 6, 7]), 2), [4, 3]);
  assert.deepEqual(regionsInView(box, () => -1), [], 'no region is none');
  const { S, book } = bookRig();
  const reader = witnessMapReader(book, { getRegionIndexAt: strips(380, 440, [DAGGERFALL, DAGGERFALL + 1]) });
  assert.equal(reader.open(), false);
  assert.deepEqual(reader.read({ x0: 380, y0: 140, x1: 440, y1: 170 }), { key: '', pixels: [] }, 'shut: nothing read or asked');
  assert.deepEqual(S.asks, []);
  await book.refresh();
  assert.equal(reader.open(), true);
  const bay = { x0: 380, y0: 140, x1: 440, y1: 170 };
  assert.deepEqual(reader.read(bay), { key: '', pixels: [] }, 'nothing heard yet');
  await tick(); await tick();
  assert.deepEqual(S.asks, [['char-sammy', DAGGERFALL + 1]], 'the middle\'s region first');
  const one = reader.read(bay);
  assert.deepEqual(one.pixels, [[DAGGERFALL + 1, 1], [DAGGERFALL + 1, 2]]);
  assert.equal(reader.read(bay), one, 'nothing landed: the same answer');
  await tick(); await tick();
  const two = reader.read(bay);
  assert.notEqual(two.key, one.key, 'the second region landed');
  assert.deepEqual(two.pixels.length, 4);
  // past the Bay: Solitude's ground, a province's region
  const { S: S2, book: b2 } = bookRig({ answer: () => ({ ok: true, data: { pixels: [[1569, -430]], more: false } }) });
  await b2.refresh();
  const far = witnessMapReader(b2, { getRegionIndexAt: () => SKYRIM });
  far.read({ x0: 1540, y0: -460, x1: 1600, y1: -400 });
  await tick(); await tick();
  assert.deepEqual(S2.asks, [['char-sammy', SKYRIM]]);
  assert.deepEqual(far.read({ x0: 1540, y0: -460, x1: 1600, y1: -400 }).pixels, [[1569, -430]]);
});

// ─── THE PAINT ───────────────────────────────────────────────────────

function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (txt) => ({ width: String(txt).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

test('WITNESS-MAP the paint: each witnessed pixel in view one square of the copper wash, in one fill, under every ring and mark of the overlay (mutants: the cull gone; the wash over the rings; the square off its pixel)', () => {
  const ctx = recordingCtx();
  const view = { ox: 100, oy: 50, scale: 4 };
  paintInkOverlay(ctx, view, {
    paperW: 400, paperH: 200, clear: false,
    witnessed: [[110, 60], [100, 50], [500, 60], [110, -30]],
    lodes: [{ cx: 120.5, cy: 70.5, r: 4, label: 'Motherlode' }],
  });
  const rects = ctx.calls.filter((c) => c.fn === 'rect');
  assert.deepEqual(rects.map((c) => c.args), [[40, 40, 4, 4], [0, 0, 4, 4]], 'the two in view, each its own map pixel');
  const fills = ctx.calls.findIndex((c) => c.fn === 'fill' && c.fillStyle === WITNESS_TINT_CSS);
  assert.ok(fills >= 0, 'filled in the wash');
  assert.equal(ctx.calls.filter((c) => c.fn === 'fill' && c.fillStyle === WITNESS_TINT_CSS).length, 1, 'one fill');
  const ring = ctx.calls.findIndex((c) => c.fn === 'arc');
  assert.ok(ring > fills, 'the Motherlode\'s ring over the ground');
  const none = recordingCtx();
  paintWitnessedGround(none, view, [], () => true);
  assert.deepEqual(none.calls, [], 'no ground, no paint');
  assert.match(WITNESS_TINT_CSS, /^rgba\(184, 98, 36, 0\.42\)$/);
  assert.equal(WITNESS_SWATCH_CSS, '#b86224');
});

// ─── THE HELD MAP ────────────────────────────────────────────────────

function fakeDocument() {
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
    if (n.tagName === 'CANVAS') n.getContext = () => recordingCtx();
    return n;
  };
  return { createElement: (t) => node(t), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
const withDocument = (fn) => { globalThis.document = fakeDocument(); try { return fn(); } finally { delete globalThis.document; } };
const texts = (n) => [n.textContent, ...(n.children ?? []).flatMap(texts)].filter(Boolean);

/** A held map over a host reader that answers `pixels` for any view, its professions `open`. */
function mapRig({ pixels = [[410, 152], [404, 152]], open = true, ore = null } = {}) {
  const asked = [];
  const witnessed = { open: () => open, read: (box) => { asked.push(box); return { key: `k${pixels.length}`, pixels }; } };
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 405, y: 150 }), getClimateIndex: () => MAP_CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(1000 * 500).fill(10) }, mapSize: { width: 1000, height: 500 },
    maps: { getPoliticIndex: () => 128 + DAGGERFALL, regionCount: 62 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    witnessed, oreAt: ore,
  });
  win._paper = { w: 600, h: 300, dpr: 1, k: 1 };
  win._view = { ox: 380, oy: 140, scale: 6 };
  return { win, asked };
}

test('WITNESS-MAP the held map: the regions in view\'s witnessed ground read on the poll and painted, a legend row while any shows, a switch on the key (on by default) that hides it, none read in the far band; the ORE-MAP card still answers a witnessed pixel (mutants: the switch unread; the far band read; the legend row gone; the key row shown shut; the overlay never handed it)', () => withDocument(() => {
  resetTravelMapState();
  try {
    assert.equal(travelMapFilters().witnessed, false, 'shown by default (the store\'s inversion)');
    const card = { title: 'Ore here', lines: ['Witnessed ground: every vein can appear here'] };
    const { win, asked } = mapRig({ ore: () => card });
    win._refreshParty();
    assert.deepEqual(asked.at(-1), { x0: 380, y0: 140, x1: 480, y1: 190 }, 'the view\'s box in world pixels');
    assert.deepEqual(win._witnessed, [[410, 152], [404, 152]]);
    win._renderLegend();
    assert.ok(texts(win._chrome.legend).includes(WITNESS_LEGEND_TEXT), 'the legend names the wash');
    win._keySig = ''; win._renderKey();
    const sw = win._chrome.key.children.flatMap((r) => r.children?.[1]?.children ?? []).find((b) => b.dataset?.filter === 'witnessed');
    assert.ok(sw, 'the key\'s switch');
    assert.equal(sw.className.includes(' on'), true);
    // the overlay is handed the ground
    const ctx = recordingCtx();
    win._sheets.get('world').paintOverlay(ctx, { view: win._view, paperW: 600, paperH: 300, dpr: 1, pulse: 0 });
    assert.equal(ctx.calls.filter((c) => c.fn === 'rect').length, 2);
    // the switch hides it, and the poll lets it go
    win._phase = 'map';
    sw.onclick();
    assert.equal(travelMapFilters().witnessed, true);
    win._refreshParty();
    assert.deepEqual(win._witnessed, []);
    assert.equal(travelMapSaveData().filterWitnessed, true, 'kept with the save, as the roads\' switches are');
    restoreTravelMapSaveData({});
    assert.equal(travelMapFilters().witnessed, false, 'an older save shows it');
    // the far band reads none
    const far = mapRig();
    far.win._view = { ox: 0, oy: 0, scale: 1 };
    far.win._refreshParty();
    assert.deepEqual([far.asked, far.win._witnessed], [[], []]);
    // the ORE-MAP card over a witnessed pixel
    const hover = win._hoverLabel(30 * 6 + 3, 12 * 6 + 3);
    assert.deepEqual(hover.tip?.lines, card.lines, 'the card, not the wash, answers the hover');
    // professions shut: no row on the key
    const shut = mapRig({ open: false });
    shut.win._keySig = ''; shut.win._renderKey();
    assert.equal(shut.win._chrome.key.children.flatMap((r) => r.children?.[1]?.children ?? []).some((b) => b.dataset?.filter === 'witnessed'), false);
  } finally { resetTravelMapState(); }
}));

test('WITNESS-MAP the wiring: the world host hands the held map its reader in one entry, online alone; the classic region page is left as it was', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /\n {6}witnessed: profBook \? witnessMapReader\(profBook, maps\) : null,/);
  assert.equal([...w.matchAll(/witnessMapReader/g)].length, 2, 'the import and the one entry');
  assert.doesNotMatch(src('src/ui/travel/travelMapWindow.js'), /witness/i, 'the classic page paints no wash (Held-Map-Arc.md WITNESS-MAP)');
});
