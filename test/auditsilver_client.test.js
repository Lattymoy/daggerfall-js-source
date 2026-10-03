// AUDIT SILVER-WAYS (2026-10-03, Mac: "Audit this") - THE CLIENT'S FINDINGS, each pinned: D1 the day's turn read once a
// retry, at the device's own moment in it; D2 a strike's refusal learned; D3 the Watch's words; D4 a Motherlode stood
// where its heart cannot hold it; D5 the receipt asked at the act's end; D6 another account's receipts let go; D7 the
// frame's costs (the account read once a second, the compass's list its own). bible/06-Systems/Online-Arc.md SILVER-WAYS
// (the audit); bible/06-Systems/Professions-Arc.md 38.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { T0 } from './accountDb.mjs';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import {
  createMotherlodeBook, MOTHERLODE_TEXT, MOTHERLODE_RETRY_MS, MOTHERLODE_TURN_SPREAD_MS, MOTHERLODE_ME_MS,
} from '../src/net/motherlodeBook.js';
import { motherlodeKey, MOTHERLODE_STRIKERS } from '../src/net/motherlodeLaw.js';
import { standMotherlodes, mineKind } from '../src/scenes/mineHost.js';
import { guildDeedsText } from '../src/ui/socialPanel.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../src/world/terrainTiles.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const tick = () => new Promise((r) => setTimeout(r, 0));
const DAY0 = Math.floor(T0 / 86400);
const lode = (k, over = {}) => ({ k, key: motherlodeKey(DAY0, k), x: 300 + k, y: 120, climate: 226, region: 21, material: 'ore:ebony', opensAt: DAY0 * 86400 + k * 28800 + 3600, closesAt: DAY0 * 86400 + k * 28800 + 3600 + 7200, struck: 0, ...over });
async function relayKey() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
}
function rig({ rand = () => 0, ok = () => true } = {}) {
  let nowS = DAY0 * 86400 + 60, nowMs = 1_000_000, me = 'acct-1', meCalls = 0;
  const changed = [], reads = [];
  const door = {
    motherlodes: async (c) => {
      reads.push(c);
      return ok() ? { ok: true, data: { day: Math.floor(nowS / 86400), lodes: [lode(0), lode(1), lode(2)], found: null } } : { ok: false, error: 'offline' };
    },
  };
  const b = createMotherlodeBook({
    door, character: () => 'char-1', me: () => { meCalls++; return me; }, nowS: () => nowS, nowMs: () => nowMs, onChange: (l) => changed.push(l.key), rand,
  });
  return {
    b, changed, reads, at: (s) => { nowS = s; }, ms: (m) => { nowMs = m; }, msNow: () => nowMs, now: () => nowS,
    sign: (m) => { me = m; }, meCalls: () => meCalls,
  };
}

test('AUDIT SILVER-WAYS A3 (the Guild tab): the silver treasury says the day\'s guild deeds against their four, and what earns one (mutants: the line unsaid)', () => {
  assert.equal(guildDeedsText(2, 4), 'Guild deeds today: 2 of 4. When 3 members of 7 days defend the same town or close the same gate, the treasury earns 25 silver.');
  assert.match(src('src/ui/socialPanel.js'), /if \(Number\.isSafeInteger\(v\.deedsMax\)\) out\.push\(el\('div', 'dfsocial-note', guildDeedsText\(v\.deeds, v\.deedsMax\)\)\);/);
});

test('AUDIT SILVER-WAYS D1: the UTC day\'s turn is read at this device\'s own moment in its spread, and a turn whose read fails (offline over midnight) is asked again once a retry - never every frame (mutants: the turn unrated; the spread unread)', async () => {
  let online = true;
  const r = rig({ rand: () => 0.5, ok: () => online });
  r.b.tick(); await tick();
  assert.equal(r.reads.length, 1);
  // midnight, offline: two minutes of frames
  online = false;
  const turn = (DAY0 + 1) * 86400;
  r.at(turn + 1); r.ms(r.msNow() + MOTHERLODE_RETRY_MS);   // a retry since the last read, short of the five-minute read
  for (let i = 0; i < 120; i++) { r.b.tick(); await tick(); r.ms(r.msNow() + 16); }
  assert.equal(r.reads.length, 1, 'not before the device\'s moment in the turn');
  r.at(turn + Math.ceil(MOTHERLODE_TURN_SPREAD_MS * 0.5 / 1000));
  for (let i = 0; i < 120; i++) { r.b.tick(); await tick(); r.ms(r.msNow() + 16); }
  assert.equal(r.reads.length, 2, 'asked at its moment - once, its failure not asked again each frame');
  r.ms(r.msNow() + MOTHERLODE_RETRY_MS);
  online = true;
  r.b.tick(); await tick();
  assert.equal(r.reads.length, 3, 'again a retry on');
  assert.equal(r.b.state.day, DAY0 + 1);
});

test('AUDIT SILVER-WAYS D2: a strike\'s refusal is learned - `motherlode-full` its twenty struck and its standing let go, `motherlode-found` the day\'s find, `motherlode-closed` the list read again; any other refusal is not the book\'s; the mining kind hands a Motherlode\'s refusal on, a vein\'s never; the gathering host hands every refusal to its kinds (mutants: the refusal unlearned; the host\'s hand-off)', async () => {
  const r = rig();
  r.b.tick(); await tick();
  const [l0, l1] = r.b.state.lodes;
  r.at(l0.opensAt + 60); r.b.tick();
  assert.deepEqual(r.b.standingAll().map((l) => l.key), [l0.key]);
  const before = r.changed.length;
  assert.equal(r.b.refused(l0.key, 'motherlode-full'), true);
  assert.equal(r.b.lodeOf(l0.key).struck, MOTHERLODE_STRIKERS);
  assert.deepEqual(r.b.standingAll(), []);
  assert.deepEqual(r.changed.slice(before), [l0.key], 'its pixel stood again');
  assert.equal(r.b.refused(l1.key, 'prof-rate'), false, 'not the book\'s');
  const reads = r.reads.length;
  assert.equal(r.b.refused(l1.key, 'motherlode-closed'), true);
  await tick();
  assert.equal(r.reads.length, reads + 1, 'the list read again');
  const f = rig();
  f.b.tick(); await tick();
  assert.equal(f.b.refused(f.b.state.lodes[2].key, 'motherlode-found'), true);
  assert.equal(f.b.found(), f.b.state.lodes[2].key);
  // the mining kind: a Motherlode's refusal to the book, a vein's never
  const told = [];
  const k = mineKind({ book: { taken: () => false, counting: () => false, state: {} }, lodes: { refused: (key, e) => told.push([key, e]) } });
  k.refused(l0.key, 'motherlode-full');
  k.refused('vein:1:2:3:4', 'node-taken');
  assert.deepEqual(told, [[l0.key, 'motherlode-full']]);
  assert.match(src('src/scenes/gatherHost.js'), /if \(typeof key === 'string'\) for \(const k of kinds\) \{ try \{ k\.refused\?\.\(key, r\?\.error \?\? null\); \}/);
});

test('AUDIT SILVER-WAYS D3: the Watch\'s refusal tells a miner to move on the Motherlode\'s ground - the relay marks a pose that moved (mutants: "stand")', () => {
  assert.match(MOTHERLODE_TEXT.watch, /Walk about on it/);
  assert.doesNotMatch(MOTHERLODE_TEXT.watch, /Stand a moment/);
  assert.match(src('src/net/watchReceipt.js'), /export const watchDue = \(w, now\) => now - w\.moved <= WATCH_MOVED_MS/);
});

test('AUDIT SILVER-WAYS D4: a Motherlode whose pixel\'s heart is a town\'s, with no rock and no stone near, stands the nearest place outside the town its pixel holds - the same for every client; a pixel of water stands none (mutants: the fallback unasked; the town unasked)', () => {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25);
  const tilemap = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM).fill(2);
  const c = WORLD_MAP_TILE_DIM / 2;
  const locationRect = { xMin: c - 24, xMax: c + 24, yMin: c - 24, yMax: c + 24 };
  const [n] = standMotherlodes({ lodes: [lode(0)], samples, tilemap, locationRect, rocks: [] });
  assert.ok(n, 'stood');
  const tile = (m) => Math.floor((m / TERRAIN_SIZE) * WORLD_MAP_TILE_DIM);
  const [tx, tz] = [tile(n.local[0]), tile(n.local[2])];
  assert.ok(!(tx >= locationRect.xMin && tx < locationRect.xMax && tz >= locationRect.yMin && tz < locationRect.yMax), `outside the town: ${tx},${tz}`);
  assert.deepEqual(standMotherlodes({ lodes: [lode(0)], samples, tilemap, locationRect, rocks: [] })[0].local, n.local, 'every client alike');
  assert.deepEqual(standMotherlodes({ lodes: [lode(0)], samples, tilemap: new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM).fill(0), locationRect, rocks: [] }), [], 'water holds none');
});

test('AUDIT SILVER-WAYS D5: a Motherlode\'s strike asks its receipt again at the act\'s end - the newest standing then, the start\'s where none newer stands (mutants: the start\'s alone)', async () => {
  const key = await relayKey();
  const r = rig();
  const t = r.now();
  const old = await mintWatchReceipt({ s: 'acct-1', x: 300, y: 120, c: 1 }, key, { subtle, nowS: t - 400 });
  r.b.watch(old);
  assert.equal(r.b.watchFor(300, 120), old, 'fresh enough to begin');
  r.at(t + 300);
  assert.equal(r.b.watchFor(300, 120, 0), null, 'the act ran long: the start\'s has gone stale');
  const fresh = await mintWatchReceipt({ s: 'acct-1', x: 300, y: 120, c: 1 }, key, { subtle, nowS: t + 240 });
  r.b.watch(fresh);
  assert.equal(r.b.watchFor(300, 120, 0), fresh, 'the one handed during the act');
  // the kind's ask: the end's, else the start's
  let end = null;
  const calls = [];
  const lodes = { watchFor: (x, y, ahead) => { calls.push(ahead); return ahead === 0 ? end : old; }, standingOn: () => [], found: () => null };
  const k = mineKind({ book: { taken: () => false, counting: () => false, state: {} }, lodes });
  const n = { what: 'motherlode', key: lode(0).key, tier: 6, lode: lode(0) };
  const { setForagingHost } = await import('../src/systems/foragingInstall.js');
  const { FT } = await import('../src/systems/foragingLaw.js');
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 226, region: 21, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  try {
    const entity = { items: [{ itemGroup: 'Foraging', groupIndex: FT.PickAxe, templateIndex: FT.PickAxe, currentCondition: 100, maxCondition: 100 }] };
    const a = k.start(n, { harvest: 'ore' }, { entity, rank: () => 30 });
    assert.equal(typeof a.ask, 'function');
    assert.deepEqual(a.ask(), { watch: old }, 'none newer: the start\'s');
    end = fresh;
    assert.deepEqual(a.ask(), { watch: fresh });
  } finally { setForagingHost(null); }
  assert.match(src('src/scenes/gatherHost.js'), /\.\.\.\(\(typeof a\.ask === 'function' \? a\.ask\(\) : a\.ask\) \?\? \{\}\),/);
});

test('AUDIT SILVER-WAYS D6: a receipt is carried only for the account signed in now - another account signed in, the last one\'s are let go (mutants: the account unread at the strike)', async () => {
  const key = await relayKey();
  const r = rig();
  const w = await mintWatchReceipt({ s: 'acct-1', x: 300, y: 120, c: 1 }, key, { subtle, nowS: r.now() - 30 });
  assert.equal(r.b.watch(w), true);
  assert.equal(r.b.watchFor(300, 120), w);
  r.sign('acct-2'); r.ms(r.msNow() + MOTHERLODE_ME_MS);
  assert.equal(r.b.watchFor(300, 120), null, 'another account\'s');
  r.sign('acct-1'); r.ms(r.msNow() + MOTHERLODE_ME_MS);
  assert.equal(r.b.watchFor(300, 120), null, 'let go, not kept for its return');
});

test('AUDIT SILVER-WAYS D7: the frame\'s costs - the signed-in account read once a second, not a frame; the compass\'s Motherlodes into its own list; the world host\'s marks of its own pooled pieces (mutants: the account each frame; a list a frame)', async () => {
  const r = rig();
  r.b.tick(); await tick();
  const calls = r.meCalls();
  for (let i = 0; i < 50; i++) { r.b.tick(); r.ms(r.msNow() + 16); }
  assert.ok(r.meCalls() - calls <= 1, `read ${r.meCalls() - calls} times in 800 ms`);
  const [l0] = r.b.state.lodes;
  r.at(l0.opensAt + 1);
  const out = [];
  assert.equal(r.b.standingAll(out), out);
  assert.deepEqual(out.map((l) => l.key), [l0.key]);
  r.b.standingAll(out);
  assert.equal(out.length, 1, 'emptied first');
  const w = src('src/scenes/world.js');
  assert.match(w, /const _lodeMarks = \[\], _lodesUp = \[\], _lodeTr = \[0, 0, 0\], _lodePool = \[\];/);
  assert.match(w, /const tr = state\.pixelTranslation\(l\.x, l\.y, _lodeTr\), m = _lodePool\[_lodeMarks\.length\] \?\?= \{ profession: 'mining', at: \[0, 0, 0\], d: 0, reach: 1 \};/);
});
