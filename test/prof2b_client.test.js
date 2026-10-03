// PROF2b (2026-10-03, Mac: "plus we need to build motherloads"): THE MOTHERLODES ON THE CLIENT - the device's book
// (net/motherlodeBook.js: today's three read and read again, the warning ten minutes ahead and a Sense's thirty, the
// rising said once, the relay's Watch receipts kept the newest a pixel and this account's alone, a strike's answer
// heard), the mining host's half (scenes/mineHost.js: where a Motherlode stands on its pixel, its heap, its plan, its
// act refused with no Watch and carrying it with one, its silver said), the professions' book carrying the receipt to
// the service, and the world host's seams by source. bible/06-Systems/Professions-Arc.md 38.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { T0 } from './accountDb.mjs';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { createMotherlodeBook, MOTHERLODE_TEXT, MOTHERLODE_READ_MS, MOTHERLODE_RETRY_MS, MOTHERLODE_WATCH_KEPT, MOTHERLODE_ACT_S } from '../src/net/motherlodeBook.js';
import { motherlodeKey, MOTHERLODE_RANK, MOTHERLODE_WATCH_S } from '../src/net/motherlodeLaw.js';
import {
  standMotherlodes, motherlodePlan, mineKind, mineFlats, MOTHERLODE_FLATS, MOTHERLODE_SCALE, MOTHERLODE_MARK, NODE_SPACING_M, ROCK_OFFSET,
} from '../src/scenes/mineHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { createMarksBook } from '../src/net/marksBook.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const tick = () => new Promise((r) => setTimeout(r, 0));
const DAY0 = Math.floor(T0 / 86400);
const flatPixel = (tile = 2) => ({ samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap: new Uint8Array(128 * 128).fill(tile) });
const lode = (k, over = {}) => ({ k, key: motherlodeKey(DAY0, k), x: 300 + k, y: 120, climate: 226, region: 21, material: 'ore:ebony', opensAt: DAY0 * 86400 + k * 28800 + 3600, closesAt: DAY0 * 86400 + k * 28800 + 3600 + 7200, struck: 0, ...over });
async function relayKey() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
}
// AUDIT SILVER-WAYS D1 (PIN MOVED): the rig's device turns the day at its first moment (`rand` 0) - the spread is pinned
// in test/auditsilver_client.test.js
function bookRig({ lodes = [lode(0), lode(1), lode(2)], found = null, rand = () => 0 } = {}) {
  let nowS = DAY0 * 86400 + 60, nowMs = 1_000_000;
  const said = [], changed = [], reads = [];
  const door = { motherlodes: async (c) => { reads.push(c); return { ok: true, data: { day: Math.floor(nowS / 86400), lodes: lodes.map((l) => ({ ...l })), found } }; } };
  const b = createMotherlodeBook({
    door, character: () => 'char-1', me: () => 'acct-1', nowS: () => nowS, nowMs: () => nowMs, say: (t) => said.push(t), onChange: (l) => changed.push(l.key),
    regionName: (r) => (r === 21 ? 'Wrothgarian Mountains' : `R${r}`), oreName: (m) => (m === 'ore:ebony' ? 'Ebony' : m), rand,
  });
  return { b, said, changed, reads, at: (s) => { nowS = s; }, ms: (m) => { nowMs = m; }, now: () => nowS };
}

// ─── THE BOOK ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('PROF2b the book: today\'s three read on arrival and again every five minutes, at the UTC day\'s turn and for another character; warned of ten minutes ahead (a Sense\'s thirty), once; its rising said once; standing handed on as it rises and as it goes (mutants: the warning\'s ten; the Sense unread; a line twice; the read never again)', async () => {
  const r = bookRig();
  const [l0] = r.b.state.lodes.length ? r.b.state.lodes : [lode(0)];
  r.b.tick();
  await tick();
  assert.deepEqual(r.reads, ['char-1']);
  assert.equal(r.b.state.lodes.length, 3);
  // ten minutes ahead, not eleven
  r.at(l0.opensAt - 660); r.b.tick();
  assert.deepEqual(r.said, []);
  r.at(l0.opensAt - 600); r.b.tick();
  assert.deepEqual(r.said, [MOTHERLODE_TEXT.warn('Ebony', 'Wrothgarian Mountains', 10)]);
  r.b.tick();
  assert.equal(r.said.length, 1, 'once');
  // its rising: said once, its pixel stood again
  r.at(l0.opensAt); r.b.tick();
  assert.equal(r.said.at(-1), MOTHERLODE_TEXT.risen('Ebony', 'Wrothgarian Mountains'));
  assert.ok(r.changed.includes(l0.key));
  assert.deepEqual(r.b.standingOn(l0.x, l0.y).map((l) => l.key), [l0.key]);
  assert.deepEqual(r.b.standingAll().map((l) => l.key), [l0.key]);
  // its going
  const before = r.changed.length;
  r.at(l0.closesAt); r.b.tick();
  assert.equal(r.changed.length, before + 1);
  assert.deepEqual(r.b.standingOn(l0.x, l0.y), []);
  // five minutes on: read again
  r.ms(1_000_000 + MOTHERLODE_READ_MS); r.b.tick(); await tick();
  assert.equal(r.reads.length, 2);
  // a Sense hears of the next one half an hour ahead
  const s = bookRig();
  s.b.tick(); await tick();
  const l1 = s.b.state.lodes[1];
  s.at(l1.opensAt - 1800); s.b.tick({ sense: true });
  assert.deepEqual(s.said, [MOTHERLODE_TEXT.warn('Ebony', 'Wrothgarian Mountains', 30)]);
  // the day's turn reads again - AUDIT SILVER-WAYS D1 (PIN MOVED): a retry's minute since the last asked at least (the
  // rig's milliseconds stood still across the day)
  s.ms(1_000_000 + MOTHERLODE_RETRY_MS); s.at((DAY0 + 1) * 86400 + 5); s.b.tick(); await tick();
  assert.equal(s.reads.length, 2);
});

test('PROF2b the book\'s Watch: a receipt kept the newest for its pixel, this account\'s and signed alone, eight pixels at most; a strike begun carries one that will still be fresh at the act\'s end, or none (mutants: another account\'s kept; an older one over a newer; the freshness unread)', async () => {
  const key = await relayKey();
  const r = bookRig();
  const t = r.now();
  const mine = (x, y, i) => mintWatchReceipt({ s: 'acct-1', x, y, c: 1 }, key, { subtle, nowS: i });
  const newer = await mine(300, 120, t - 60);
  assert.equal(r.b.watch(newer), true);
  assert.equal(r.b.watch(await mine(300, 120, t - 300)), false, 'an older one never over a newer');
  assert.equal(r.b.watch(await mintWatchReceipt({ s: 'acct-2', x: 300, y: 120, c: 1 }, key, { subtle, nowS: t })), false, 'another account\'s');
  assert.equal(r.b.watch(await mintWatchReceipt({ s: 'acct-1', x: 301, y: 120, c: 1 }, null, { subtle, nowS: t })), false, 'unsigned');
  assert.equal(r.b.watchFor(300, 120), newer);
  assert.equal(r.b.watchFor(301, 120), null);
  // fresh enough to stand at the act's end: issued within the Watch's ten minutes less the act's two
  const stale = bookRig();
  stale.b.watch(await mine(5, 5, stale.now() - (MOTHERLODE_WATCH_S - MOTHERLODE_ACT_S) - 1));
  assert.equal(stale.b.watchFor(5, 5), null);
  for (let i = 0; i < MOTHERLODE_WATCH_KEPT + 3; i++) r.b.watch(await mine(400 + i, 1, t));
  assert.equal(r.b.watchFor(300, 120), null, 'the oldest pixel let go past eight');
  assert.ok(r.b.watchFor(400 + MOTHERLODE_WATCH_KEPT + 2, 1));
});

test('PROF2b the book\'s find: a strike\'s answer makes the day\'s find and its count; every Motherlode stops standing for this account, each pixel stood again; a read that says one found stands none (mutants: the find unheard; standing past the find)', async () => {
  const r = bookRig();
  r.b.tick(); await tick();
  const [l0, l1] = r.b.state.lodes;
  r.at(l0.opensAt + 60); r.b.tick();
  assert.deepEqual(r.b.standingAll().map((l) => l.key), [l0.key]);
  const before = r.changed.length;
  r.b.heard({ motherlode: true, node: l0.key, lode: { struck: 4, strikers: 20 } });
  assert.equal(r.b.found(), l0.key);
  assert.equal(r.b.lodeOf(l0.key).struck, 4);
  assert.deepEqual(r.b.standingAll(), []);
  assert.deepEqual(r.changed.slice(before), [l0.key], 'its pixel stood again');
  r.at(l1.opensAt + 60); r.b.tick();
  assert.deepEqual(r.b.standingAll(), [], 'the next rises for others');
  r.b.heard({ node: l1.key });
  assert.equal(r.b.found(), l0.key, 'a vein\'s answer is no find');
  const f = bookRig({ found: motherlodeKey(DAY0, 2) });
  f.b.tick(); await tick();
  f.at(f.b.state.lodes[0].opensAt + 1); f.b.tick();
  assert.deepEqual(f.b.standingAll(), []);
  // a spent one stands for none
  const full = bookRig({ lodes: [lode(0, { struck: 20 })] });
  full.b.tick(); await tick();
  full.at(full.b.state.lodes[0].opensAt + 1); full.b.tick();
  assert.deepEqual(full.b.standingAll(), []);
});

// ─── THE MINING HOST ─────────────────────────────────────────────────────────────────────────────────────────────────

test('PROF2b stand: a Motherlode stands at the foot of the rock piece nearest its pixel\'s heart, clear of the nodes already stood; with no piece, on the stone near its heart; its heap seven of its ore at twice a vein\'s size (mutants: the heart; the clearance; the heap)', () => {
  const { samples, tilemap } = flatPixel(3);
  const c = TERRAIN_SIZE / 2;
  const rock = [c - 10, 0, c + 4, c + 10, 6, c + 24];
  const [n] = standMotherlodes({ lodes: [lode(1)], samples, tilemap, rocks: [rock] });
  assert.deepEqual([n.key, n.what, n.slot, n.tier, n.material], [motherlodeKey(DAY0, 1), 'motherlode', 1, 6, 'ore:ebony']);
  assert.deepEqual(n.rock, rock);
  assert.ok(Math.abs(n.local[0] - c) < 1e-9 && Math.abs(n.local[2] - (c + 4 - ROCK_OFFSET)) < 1e-9, 'facing the heart, at the foot');
  // a vein already at that foot: the next side
  const [m] = standMotherlodes({ lodes: [lode(1)], samples, tilemap, rocks: [rock], taken: [n.local] });
  assert.ok(Math.hypot(m.local[0] - n.local[0], m.local[2] - n.local[2]) >= NODE_SPACING_M);
  // no piece: the stone
  const [s] = standMotherlodes({ lodes: [lode(0)], samples, tilemap, rocks: [] });
  assert.ok(s && s.rock === null);
  assert.equal(mineFlats(n).length, MOTHERLODE_FLATS);
  assert.deepEqual([MOTHERLODE_FLATS, MOTHERLODE_SCALE, MOTHERLODE_MARK.reach], [7, 3.3, 400]);
});

test('PROF2b plan: struck today, being counted, the account\'s one found, an Apprentice\'s Mining (not tier 6\'s), the Pick-Axe, the Stores\' room - the day\'s sixty are a vein\'s and never asked (mutants: the rank; the find; the Stores)', () => {
  const node = { what: 'motherlode', material: 'ore:ebony', tier: 6 };
  const base = { node, taken: false, counting: false, found: false, rank: MOTHERLODE_RANK, pick: true, storesFull: () => false };
  assert.deepEqual(motherlodePlan(base), { harvest: 'ore', verb: 'Strike the Motherlode of Ebony Ore', rest: 'Mining 25', ready: true });
  assert.equal(motherlodePlan({ ...base, taken: true }).ready, false);
  assert.equal(motherlodePlan({ ...base, counting: true }).rest, 'being counted');
  assert.equal(motherlodePlan({ ...base, found: true }).rest, 'your Motherlode today is found');
  assert.deepEqual([motherlodePlan({ ...base, rank: 24 }).rest, motherlodePlan({ ...base, rank: 24 }).needsRank], ['needs Mining 25', 25]);
  assert.equal(motherlodePlan({ ...base, pick: false }).rest, 'needs a Pick-Axe');
  assert.equal(motherlodePlan({ ...base, storesFull: () => true }).rest, 'Stores full - Ebony Ore');
});

test('PROF2b the kind: a pixel\'s nodes take the Motherlodes standing on it; its mark from 400 m; no Watch, no act - and with one, the act at tier 6 carries it; its answer tells the book and says the silver (mutants: the lode unstood; the act without the Watch; the receipt unsent; the silver unsaid)', async () => {
  const key = await relayKey();
  const w = await mintWatchReceipt({ s: 'acct-1', x: 300, y: 120, c: 1 }, key, { subtle, nowS: T0 });
  const heard = [];
  let watch = null;
  const lodes = { standingOn: (x, y) => (x === 300 && y === 120 ? [lode(0)] : []), found: () => null, watchFor: () => watch, heard: (d) => heard.push(d) };
  const profBook = { taken: () => false, counting: () => false, held: () => 0, state: { today: {}, caps: {}, stores: {} }, track: () => ({ rank: 30 }) };
  const marks = createMarksBook({ door: { account: () => 'acct-1' } });
  const k = mineKind({ book: profBook, lodes, marks });
  const { samples, tilemap } = flatPixel(3);
  const entry = { samples, tilemap, rocks: [] };
  const nodes = k.nodesOf({ px: 300, py: 120, day: DAY0, info: { climate: 231, region: 21 }, confirmed: false, entry });
  const n = nodes.find((x) => x.what === 'motherlode');
  assert.ok(n, 'stood beside the veins');
  assert.equal(k.nodesOf({ px: 301, py: 120, day: DAY0, info: { climate: 231, region: 21 }, confirmed: false, entry }).some((x) => x.what === 'motherlode'), false);
  assert.deepEqual(k.mark(n, { specs: () => ({ 50: null }) }), MOTHERLODE_MARK);
  assert.equal(k.flatsOf(n)[0].scale, MOTHERLODE_SCALE);
  assert.equal(k.nodeName(n), 'Motherlode of Ebony');
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 226, region: 21, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  try {
    const entity = { items: [{ itemGroup: 'Foraging', groupIndex: FT.PickAxe, templateIndex: FT.PickAxe, currentCondition: 100, maxCondition: 100 }] };
    const ctx = { entity, rank: () => 30 };
    const plan = k.plan(n, ctx);
    assert.deepEqual(k.start(n, plan, ctx), { refused: MOTHERLODE_TEXT.watch });
    watch = w;
    const a = k.start(n, plan, ctx);
    assert.ok(a.act, 'the act');
    assert.equal(a.act.state.need, 7, 'tier 6\'s seven points');
    assert.deepEqual(a.ask(), { watch: w }, 'AUDIT SILVER-WAYS D5 (PIN MOVED): the receipt asked at the act\'s end');
  } finally { setForagingHost(null); }
  const toasts = [];
  k.answered({ motherlode: true, node: n.key, marks: { struck: 10, balance: 60 } }, (t) => toasts.push(t));
  assert.deepEqual(toasts, ['10 silver struck to your account. You hold 60 silver.']);
  assert.equal(heard.length, 1);
  k.answered({ node: 'vein:1:2:3:4' }, (t) => toasts.push(t));
  assert.equal(toasts.length, 1, 'a vein\'s answer says nothing of silver');
});

// ─── THE SEAMS ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('PROF2b the seams by source: the professions\' book sends a harvest\'s Watch; the world host builds the book with the shared clock, hands it the relay\'s Watch beside the seats\', ticks it on the frame with the Sense read, gives it to Mining\'s kind with the silver\'s book, restands its pixel, marks every Motherlode standing on the compass; the Sense\'s card is chosen as any; every strike refusal has its sentence (mutants: each seam)', () => {
  assert.match(src('src/net/profBook.js'), /\.\.\.\(typeof h\.watch === 'string' \? \{ watch: h\.watch \} : \{\}\),/);
  const w = src('src/scenes/world.js');
  assert.match(w, /const motherlodeBook = motherlodeDoor \? createMotherlodeBook\(\{/);
  assert.match(w, /nowS: \(\) => Math\.floor\(\(Date\.now\(\) \+ _sharedOffsetMs\) \/ 1000\),/);
  assert.match(w, /onChange: \(l\) => gatherHost\?\.restandAt\(l\.x, l\.y\),/);
  assert.match(w, /online\.onWatch = \(r\) => \{ seatBook\?\.keepWatch\(r\); motherlodeBook\?\.watch\(r\); \};/);
  assert.match(w, /motherlodeBook\?\.tick\(\{ sense: profBook\.track\('mining'\)\.specs\?\.\[100\] === 'motherlode-sense' \}\)/);
  assert.match(w, /mineKind\(\{ book: profBook, lodes: motherlodeBook, marks: marksBook \}\)/);
  assert.match(w, /for \(const l of motherlodeBook\.standingAll\(_lodesUp\)\) \{/);   // AUDIT SILVER-WAYS D7 (PIN MOVED): into the frame's own list
  assert.match(w, /return nodeCompassPoints\(far\.length \? \[\.\.\.\(near \?\? \[\]\), \.\.\.far\] : near, trackerAnimals\(\)\);/);
  assert.match(src('src/scenes/gatherHost.js'), /restandAt\(px, py\) \{ restandAt\(px, py\); \},/);
  assert.doesNotMatch(src('src/ui/profPages.js'), /PROF2b/, 'no card waits on the Motherlodes');
  for (const e of ['motherlode-closed', 'motherlode-watch', 'motherlode-found', 'motherlode-full']) assert.ok(REFUSALS[e], e);
  const svc = src('server-account/src/index.js');
  assert.match(svc, /'\/v1\/prof\/harvest': \(\) => \(isMotherlodeNode\(body\?\.node\) \? strikeMotherlode\(ctx, who\.player, env, body\) : harvestNode\(ctx, who\.player, env, body\)\),/);
  assert.match(svc, /'\/v1\/prof\/motherlodes': \(\) => motherlodesRead\(ctx, who\.player, env, body\),/);
});
