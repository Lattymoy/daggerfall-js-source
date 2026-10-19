import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import {
  createTownEconBook, TOWN_ECON_WATCH_KEY, TOWN_ECON_WATCH_HELD_MAX, TOWN_ECON_CLAIM_EVERY_MS, TOWN_ECON_REPORTED_KEY, TOWN_ECON_DONE, TOWN_ECON_STOPS,
  parseTownCommand, townAuditLines, TOWN_USAGE,
} from '../../src/net/townEconBook.js';
import { createTownEconHost, MARKET_BANDS_MAX } from '../../src/scenes/townEconHost.js';
import { accountTowns, SESSION_KEY } from '../../src/net/accountClient.js';
import { TOWN_WATCH_CLAIM_MAX, TOWN_ECON_KEPT_S, townProsperity, townKeyOf, townDayOf, TOWN_DAY_MS, TOWN_SEA_TICK_S } from '../../src/net/townEconLaw.js';

// TOWN-ECON TE2 (2026-10-18, bible/06-Systems/Town-Economy-Arc.md section 4): this device's half of the players' share -
// the shares read and held, the Watch's ticks kept at a town's pixel and claimed, a town witnessed once a day; the host
// module the world host wires, and the door.

const { subtle } = globalThis.crypto;
const ME = 'acct-me';
const T = 1_800_000_000;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const flush = () => new Promise((r) => setTimeout(r, 0));
let _key = null;
const key = async () => (_key ??= (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey);
const tick = async ({ s = ME, x = 212, y = 151, c = 1, nowS = T } = {}) => mintWatchReceipt({ s, x, y, c }, await key(), { subtle, nowS });

/** AUDIT TOWN-ECON 2 SVC-1: a map id names its own pixel (townEconLaw.js townPixelIdOf). */
const pixelMap = (px, py, hi = 3) => ((hi << 20) | (py * 1000 + px)) >>> 0;
const RIP = pixelMap(212, 151), CRYPT = pixelMap(10, 10);

function rig({ answers = {}, now = T * 1000 } = {}) {
  const calls = [], receipts = [];
  const door = {
    econ: async () => { calls.push(['econ']); return answers.econ ?? { ok: true, data: { towns: [] } }; },
    witness: async (t, receipt) => { calls.push(['witness', t]); receipts.push(receipt); return answers.witness ?? { ok: true, data: { counted: true } }; },
    watch: async (rs, sea = []) => { calls.push(['watch', rs.length, ...(sea.length ? [sea] : [])]); return answers.watch ?? { ok: true, data: { counted: rs.length, why: {} } }; },
  };
  const clock = { ms: now };
  const storage = memory();
  const book = createTownEconBook({ door, storage, nowMs: () => clock.ms, me: () => ME, isTownPixel: (x, y) => x === 212 && y === 151, relayNowS: () => Math.floor(clock.ms / 1000) });
  return { book, calls, clock, storage, answers, door, receipts };
}

test('TOWN-ECON TE2 the shares: read once a keeping and held, synchronous to every reader, a town\'s map id unsigned; 0 for a town not answered and until the first read; an account\'s refusal stops them for the page (mutants: TOWNECON2-book-unkept, TOWNECON2-book-unstopped)', async () => {
  const r = rig({ answers: { econ: { ok: true, data: { towns: [[11, 12.5], [0xfffffff0, 3], [12, 'x'], [13, 0]] } } } });
  assert.equal(r.book.shareOf(11), 0, 'until the first read answers');
  await flush(); await flush();
  assert.deepEqual([r.book.shareOf(11), r.book.shareOf(-16), r.book.shareOf(12), r.book.shareOf(13), r.book.shareOf(99)], [12.5, 3, 0, 0, 0]);
  r.book.shareOf(11);
  await flush(); await flush();
  assert.equal(r.calls.filter(([k]) => k === 'econ').length, 1, 'held');
  r.clock.ms += TOWN_ECON_KEPT_S * 1000;
  r.book.shareOf(11);
  await flush(); await flush();
  assert.equal(r.calls.filter(([k]) => k === 'econ').length, 2, 'read again past the keeping');
  for (const error of TOWN_ECON_STOPS) {
    const s = rig({ answers: { econ: { ok: false, error } } });
    s.book.shareOf(1); await flush(); await flush();
    s.clock.ms += TOWN_ECON_KEPT_S * 1000;
    s.book.shareOf(1); await flush();
    assert.equal(s.calls.length, 1, `${error}: asked no more`);
    assert.equal(s.book.stopped, true);
  }
});

test('TOWN-ECON TE2 the footsteps: a signed tick for this account at a town\'s pixel, alive, kept once on the device - another\'s, an unsigned one, one off a town and a dead one are not; a claim\'s worth is claimed, or the oldest after TOWN_ECON_CLAIM_EVERY_MS; an answer lets them go, no answer keeps them and waits; a young account\'s ticks are asked no more (mutants: TOWNECON2-book-keep-anywhere, TOWNECON2-book-claim-early, TOWNECON2-book-kept-on-fail)', async () => {
  const r = rig({ answers: { watch: { ok: false, error: 'offline' } } });
  assert.equal(r.book.keepWatch(await tick()), true);
  const again = JSON.parse(r.storage.getItem(TOWN_ECON_WATCH_KEY))[0].r;
  assert.equal(r.book.keepWatch(again), false, 'once');
  assert.equal(r.book.keepWatch(await tick({ s: 'acct-other', c: 2 })), false, 'another account\'s');
  assert.equal(r.book.keepWatch((await tick({ c: 3 })).replace(/\.[^.]+$/, '.')), false, 'unsigned');
  assert.equal(r.book.keepWatch(await tick({ x: 400, c: 4 })), false, 'off a town');
  assert.equal(r.book.keepWatch(await tick({ c: 5, nowS: T - 3 * 86_400 })), false, 'dead by the relay\'s clock');
  assert.equal(r.book.watchHeldCount(), 1);
  assert.equal(await r.book.claim(), null, 'not due: one tick, fresh');
  for (let c = 6; r.book.watchHeldCount() < TOWN_WATCH_CLAIM_MAX; c++) r.book.keepWatch(await tick({ c }));
  await flush();
  assert.deepEqual(r.calls.filter(([k]) => k === 'watch'), [['watch', TOWN_WATCH_CLAIM_MAX]], 'a claim\'s worth, claimed');
  assert.equal(r.book.watchHeldCount(), TOWN_WATCH_CLAIM_MAX, 'no answer keeps them');
  assert.equal(await r.book.claim(), null, 'and waits');
  r.answers.watch = { ok: true, data: { counted: 12, why: {} } };
  r.clock.ms += TOWN_ECON_CLAIM_EVERY_MS;
  assert.deepEqual(await r.book.claim(), { counted: 12, why: {} });
  assert.equal(r.book.watchHeldCount(), 0, 'an answer lets them go');
  // the oldest after its wait
  r.book.keepWatch(await tick({ c: 50, nowS: Math.floor(r.clock.ms / 1000) }));
  assert.equal(await r.book.claim(), null);
  r.clock.ms += TOWN_ECON_CLAIM_EVERY_MS;
  assert.equal((await r.book.claim())?.counted, 12);
  // the most held
  const h = rig({ answers: { watch: { ok: false, error: 'offline' } } });
  for (let c = 1; c <= TOWN_ECON_WATCH_HELD_MAX + 5; c++) h.book.keepWatch(await tick({ c }));
  assert.ok(JSON.parse(h.storage.getItem(TOWN_ECON_WATCH_KEY)).length <= TOWN_ECON_WATCH_HELD_MAX);
  // a young account
  const y = rig({ answers: { watch: { ok: true, data: { counted: 0, why: { young: 12 } } } } });
  for (let c = 1; c <= TOWN_WATCH_CLAIM_MAX; c++) y.book.keepWatch(await tick({ c }));
  await flush(); await flush();
  assert.equal(y.book.keepWatch(await tick({ c: 99 })), false, 'asked no more this page');
});

test('TOWN-ECON TE2 the registry: a town reported once a UTC day, its report canonical; counted or known, never again; a young account or a refusal stops it for the page. AUDIT TOWN-ECON 2 SVC-1: with this account\'s newest tick at its pixel - a town walked into before its first tick there waits and goes with it; CLI-3: `taken` asks again the next day, and a report answered late marks its town in the table as it stands (mutants: TOWNECON2-book-witness-daily, TOWNECON2-book-witness-done, TOWNECON-AUDIT2-SVC1-book-unwalked, TOWNECON-AUDIT2-SVC1-book-waiting, TOWNECON-AUDIT2-CLI3-taken-done, TOWNECON-AUDIT2-CLI3-stale-table)', async () => {
  const TOWN = { map: RIP, px: 212, py: 151, region: 17, location: 5 };
  const r = rig({ answers: { witness: { ok: true, data: { counted: false, why: 'ignored' } } } });
  assert.equal(await r.book.witness({ ...TOWN, px: 1000 }), false, 'no town');
  assert.equal(await r.book.witness({ ...TOWN, map: 11 }), false, 'a map id not its pixel\'s');
  assert.equal(await r.book.witness(TOWN), false, 'no tick of mine there yet: it waits');
  assert.deepEqual(r.calls, []);
  r.book.keepWatch(await tick({ s: 'acct-other', c: 50 }));
  r.book.keepWatch(await tick({ x: 213, c: 51 }));
  await flush();
  assert.deepEqual(r.calls, [], 'another\'s tick, another pixel\'s: still waiting');
  const first = await tick({ c: 52 });
  r.book.keepWatch(first);
  await flush();
  assert.deepEqual(r.calls, [['witness', TOWN]], 'its tick: the report goes with it');
  assert.equal(r.receipts.at(-1), first);
  assert.equal(await r.book.witness(TOWN), false, 'once a day');
  r.clock.ms += 86_400_000;
  assert.equal(await r.book.witness(TOWN), true, 'the next day, its tick still alive');
  r.answers.witness = { ok: true, data: { counted: true, confirmed: false, why: 'taken' } };
  r.clock.ms += 86_400_000;
  r.book.keepWatch(await tick({ c: 53, nowS: Math.floor(r.clock.ms / 1000) }));
  await r.book.witness(TOWN);
  r.clock.ms += 86_400_000;
  r.book.keepWatch(await tick({ c: 54, nowS: Math.floor(r.clock.ms / 1000) }));
  assert.equal(await r.book.witness(TOWN), true, 'taken: asked again the next day');
  r.answers.witness = { ok: true, data: { counted: true, confirmed: false } };
  r.clock.ms += 86_400_000;
  r.book.keepWatch(await tick({ c: 55, nowS: Math.floor(r.clock.ms / 1000) }));
  await r.book.witness(TOWN);
  assert.ok(JSON.parse(r.storage.getItem(TOWN_ECON_REPORTED_KEY))[String(RIP)] >= TOWN_ECON_DONE, 'counted: done');
  r.clock.ms += 86_400_000;
  r.book.keepWatch(await tick({ c: 56, nowS: Math.floor(r.clock.ms / 1000) }));
  assert.equal(await r.book.witness(TOWN), false, 'never again');
  const k = rig({ answers: { witness: { ok: true, data: { counted: false, why: 'known' } } } });
  k.book.keepWatch(await tick());
  await k.book.witness(TOWN);
  k.clock.ms += 86_400_000;
  assert.equal(await k.book.witness(TOWN), false, 'known: done');
  const y = rig({ answers: { witness: { ok: true, data: { counted: false, why: 'young' } } } });
  y.book.keepWatch(await tick());
  await y.book.witness(TOWN);
  const OTHER = { ...TOWN, map: pixelMap(212, 151, 5) };
  assert.equal(await y.book.witness(OTHER), false, 'young: no more this page');
  for (const error of ['towns-closed', 'towns-need-account']) {
    const z = rig({ answers: { witness: { ok: false, error } } });
    z.book.keepWatch(await tick());
    await z.book.witness(TOWN);
    assert.equal(await z.book.witness(OTHER), false, `${error}: no more this page (REC-10)`);
    assert.equal(z.calls.filter(([c]) => c === 'witness').length, 1);
  }
  // CLI-3: the table kept by recency - a town reported today outlives two hundred done ones
  const t = rig({ answers: { witness: { ok: true, data: { counted: false, why: 'ignored' } } } });
  t.storage.setItem(TOWN_ECON_REPORTED_KEY, JSON.stringify(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(900000 + i), TOWN_ECON_DONE + 1]))));
  t.book.keepWatch(await tick());
  await t.book.witness(TOWN);
  assert.ok(String(RIP) in JSON.parse(t.storage.getItem(TOWN_ECON_REPORTED_KEY)), 'today\'s row kept');
  assert.equal(await t.book.witness(TOWN), false, 'and so not sent again today');
  assert.equal(t.calls.filter(([c]) => c === 'witness').length, 1);
});

test('TOWN-ECON TE2 the host module (scenes/townEconHost.js): the reading\'s players\' share is the book\'s by the town\'s map id; the Watch\'s tick handed to the book where a town with an economy stands; the town walked into witnessed with its location - a town with an economy alone; offline no book, nothing asked (mutants: TOWNECON2-host-unshared, TOWNECON2-host-witness-any, TOWNECON2-reading-by-key)', async () => {
  const towns = new Map([[RIP, { name: 'Ripmarket', px: 212, py: 151, region: 17, type: 0, location: 5 }], [CRYPT, { name: 'The Crypt', px: 10, py: 10, region: 17, type: 4, location: 6 }]]);
  const r = rig({ answers: { econ: { ok: true, data: { towns: [[RIP, 20]] } } } });
  const clock = T * 1000;
  const host = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => clock,
    locAt: (x, y) => { const [id, t] = [...towns.entries()].find(([, t]) => t.px === x && t.py === y) ?? []; return t ? { mapId: id, locationType: t.type } : null; }, door: { ...r.door, me: () => ME }, storage: memory() });
  host.prosperityOf(RIP);
  await flush(); await flush();
  const day = townDayOf(clock);
  assert.equal(host.prosperityOf(RIP), townProsperity({ key: townKeyOf(212, 151), type: 0, day, players: 20 }), 'the share read in');
  assert.ok(host.prosperityOf(RIP) > townProsperity({ key: townKeyOf(212, 151), type: 0, day }));
  assert.equal(host.keepWatch(await tick({ nowS: Math.floor(clock / 1000) })), true, 'a town\'s pixel');
  assert.equal(host.keepWatch(await tick({ x: 10, y: 10, c: 2, nowS: Math.floor(clock / 1000) })), false, 'a dungeon\'s');
  assert.equal(host.witness(RIP), true);
  assert.equal(host.witness(CRYPT), false, 'a dungeon has no economy');
  await flush();
  assert.deepEqual(r.calls.filter(([k]) => k === 'witness'), [['witness', { map: RIP, px: 212, py: 151, region: 17, location: 5 }]]);
  const off = createTownEconHost({ online: () => false, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => clock });
  assert.equal(off.book, null);
  assert.equal(off.witness(RIP), false);
  assert.equal(off.keepWatch(await tick()), false);
  assert.equal(off.prosperityOf(RIP), null, 'offline the town economy does not run');
  assert.ok(TOWN_DAY_MS > 0);
});

test('TOWN-ECON TE2 the door and the wiring: the three routes; the world host builds the module with the town\'s location in its row, hands it the Watch beside the seats\' and the Motherlodes\', and witnesses the town at its entry (mutants: TOWNECON2-door-path, TOWNECON2-world-unwatched, TOWNECON2-world-unwitnessed, TOWNECON2-location-lost)', async () => {
  const sent = [];
  const storage = memory();
  storage.setItem(SESSION_KEY, JSON.stringify({ secret: 'sek', id: ME }));
  const door = accountTowns({ fetch: async (u, i) => { sent.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true,"towns":[]}', { status: 200 }); }, storage });
  assert.equal(door.me(), ME, 'the signed-in account');
  await door.econ();
  await door.witness({ map: 1 });
  await door.watch(['r']);
  await door.watch(['r', 's'], [1]);   // SEA-TRADE: the dealings' ticks
  assert.deepEqual(sent.map(([p, b]) => [p, Object.keys(b).filter((k) => k !== 'secret')]), [['/v1/towns/econ', []], ['/v1/towns/witness', ['town']], ['/v1/towns/watch', ['receipts']], ['/v1/towns/watch', ['receipts', 'sea']]]);
  assert.deepEqual(sent.at(-1)[1].sea, [1]);
  const w = rd('src/scenes/world.js');
  assert.match(w, /online\.onWatch = \(r\) => \{ seatBook\?\.keepWatch\(r\); motherlodeBook\?\.watch\(r\); townEcon\.keepWatch\(r\); \};/);
  assert.match(w, /revealMemberGuildHalls\(\{ witness: onlineOn \}\);[^\n]*\n\s*townEcon\.witness\(_musicLoc\?\.mapTableData\?\.mapId\);/);
  assert.match(w, /type: loc\.mapTableData\.locationType, location: l \}\);/);
  assert.match(w, /locAt: \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\)\?\.mapTableData \?\? null, portLanes: /);   // PIN MOVED (SEA-TRADE): the location, not its type alone
  assert.match(rd('src/scenes/townEconHost.js'), /reading\.online\(\) \? accountTowns\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage \}\) : null;/, 'the door the page\'s own online');
});

test('SEA-TRADE the book vouches a captain\'s dealing (seaDeal): the newest tick unspent for this account within TOWN_SEA_REACH_PX of the port and TOWN_SEA_TICK_S old flags `sea` - a tick kept, or one beside the town\'s pixel held now; one tick one dealing; another\'s, a stale one and one two pixels off none; the claim sends the flagged ticks\' indices, and the flag outlives a reload (mutants: TOWNECON4-book-unvouched, TOWNECON4-book-twice, TOWNECON4-book-stale, TOWNECON4-book-reach, TOWNECON4-book-unsent)', async () => {
  const r = rig({ answers: { watch: { ok: false, error: 'offline' } } });
  assert.equal(r.book.seaDeal(212, 151), false, 'no tick seen');
  assert.equal(r.book.keepWatch(await tick({ c: 1 })), true);
  assert.equal(r.book.seaDeal(212, 151), true, 'the tick kept vouches it');
  assert.equal(r.book.seaDeal(212, 151), false, 'one tick, one dealing');
  // a ship beside the town: its tick is no footstep there, but it vouches the dealing
  assert.equal(r.book.keepWatch(await tick({ x: 213, y: 150, c: 2 })), false, 'not a town\'s pixel');
  assert.equal(r.book.watchHeldCount(), 1);
  assert.equal(r.book.seaDeal(212, 151), true, 'the quay\'s tick');
  assert.equal(r.book.watchHeldCount(), 2, 'held for the claim now');
  assert.equal(r.book.keepWatch(await tick({ x: 214, y: 151, c: 3 })), false);
  assert.equal(r.book.seaDeal(212, 151), false, 'two pixels off');
  assert.equal(r.book.keepWatch(await tick({ s: 'acct-other', c: 4 })), false);
  assert.equal(r.book.seaDeal(212, 151), false, 'another account\'s');
  assert.equal(r.book.keepWatch(await tick({ c: 5, nowS: T - TOWN_SEA_TICK_S - 1 })), true, 'kept as a footstep');
  assert.equal(r.book.seaDeal(212, 151), false, 'too old to vouch');
  assert.equal(r.book.keepWatch(await tick({ c: 6, nowS: T - 5 })), true);
  assert.equal(r.book.keepWatch(await tick({ c: 7, nowS: T - 60 })), true);
  assert.equal(r.book.seaDeal(212, 151), true);
  const held = JSON.parse(r.storage.getItem(TOWN_ECON_WATCH_KEY));
  assert.deepEqual(held.filter((w) => w.sea).map((w) => w.i), [T, T, T - 5], 'the newest of the rest');
  // the claim: the flagged ticks' indices
  r.answers.watch = { ok: true, data: { counted: 4, sea: 3, why: {} } };
  await r.book.claim({ force: true });
  const sent = r.calls.filter(([k]) => k === 'watch').at(-1);
  assert.equal(sent[1], held.length);
  assert.deepEqual(sent[2], held.flatMap((w, k) => (w.sea ? [k] : [])));
  // the flag outlives a reload, and a reloaded tick vouches nothing twice
  const s = rig({ answers: { watch: { ok: false, error: 'offline' } } });
  s.book.keepWatch(await tick({ c: 8 }));
  s.book.seaDeal(212, 151);
  const again = createTownEconBook({ door: s.door, storage: s.storage, nowMs: () => s.clock.ms, me: () => ME, isTownPixel: (x, y) => x === 212 && y === 151, relayNowS: () => Math.floor(s.clock.ms / 1000) });
  assert.equal(again.seaDeal(212, 151), false, 'spent before the reload');
  await again.claim({ force: true });
  assert.deepEqual(s.calls.filter(([k]) => k === 'watch').at(-1), ['watch', 1, [0]]);
});

test('AUDIT TOWN-ECON 2 the client\'s fixes: a pixel the service says is full today keeps no more ticks until the day turns (SVC-5); a claim due is made at a reader\'s ask, not only at a new tick (CLI-4); the relay\'s clock read for a tick\'s life only once heard (CLI-6); the market band kept only once the shares and the seat list have answered, the trips then planned again (CLI-1), and its oldest let go one by one (LIV-8); the developer\'s `/town` words and the audit\'s lines, the door\'s two routes, and the world host\'s wiring (mutants: TOWNECON-AUDIT2-SVC5-book-full-kept, TOWNECON-AUDIT2-CLI4-no-clock, TOWNECON-AUDIT2-CLI6-device-clock, TOWNECON-AUDIT2-CLI1-frozen-early, TOWNECON-AUDIT2-CLI1-plans-kept, TOWNECON-AUDIT2-LIV8-wiped, TOWNECON-AUDIT2-SVC1-world-unwired)', async () => {
  // SVC-5: full today
  const r = rig({ answers: { watch: { ok: true, data: { counted: 1, sea: 0, why: {}, full: ['212,151'] } } } });
  assert.equal(r.book.keepWatch(await tick({ c: 1 })), true);
  await r.book.claim({ force: true });
  assert.equal(r.book.keepWatch(await tick({ c: 2 })), false, 'its footsteps full today');
  r.clock.ms += 86_400_000;
  assert.equal(r.book.keepWatch(await tick({ c: 3, nowS: Math.floor(r.clock.ms / 1000) })), true, 'the day turned');
  // CLI-4: the oldest's wait looked at by a reader's ask
  const c = rig({ answers: { watch: { ok: true, data: { counted: 1, sea: 0, why: {}, full: [] } } } });
  c.book.keepWatch(await tick({ c: 1 }));
  assert.equal(c.calls.filter(([k]) => k === 'watch').length, 0, 'not due');
  c.clock.ms += TOWN_ECON_CLAIM_EVERY_MS;
  c.book.shareOf(1);
  await flush();
  assert.equal(c.calls.filter(([k]) => k === 'watch').length, 1, 'claimed at an ask, with no new tick');
  // CLI-6: no relay clock heard - no tick judged dead by this device's
  let heard = false;
  const towns = new Map([[RIP, { name: 'Ripmarket', px: 212, py: 151, region: 17, type: 0, location: 5 }]]);
  const d = rig();
  const host = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => T * 1000 + 5 * 86_400_000,
    locAt: (x, y) => (x === 212 && y === 151 ? { mapId: RIP, locationType: 0 } : null), door: { ...d.door, me: () => ME }, storage: memory(), clockHeard: () => heard });
  assert.equal(host.keepWatch(await tick({ c: 9 })), true, 'unheard: the tick kept (its life is the relay\'s to say)');
  heard = true;
  assert.equal(host.keepWatch(await tick({ c: 10 })), false, 'heard: five days on, dead');
  // CLI-1: the market band kept once the shares and the seats have answered
  let seatsHeard = false, ready = 0;
  const m = rig({ answers: { econ: { ok: true, data: { towns: [] } } } });
  const mh = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => T * 1000,
    door: { ...m.door, me: () => ME }, storage: memory(), seatsHeard: () => seatsHeard, onBandsReady: () => { ready += 1; } });
  let band = 'Thriving';
  mh.bandOf = () => band;
  assert.equal(mh.marketBandOf({ mapId: RIP }, 900), 'Thriving');
  band = 'Booming';
  assert.equal(mh.marketBandOf({ mapId: RIP }, 900), 'Booming', 'nothing read yet: answered, never kept');
  mh.prosperityOf(RIP); await flush(); await flush();   // the shares answered
  assert.equal(mh.book.heard, true);
  assert.equal(mh.marketBandOf({ mapId: RIP }, 900), 'Booming', 'the seats not yet');
  seatsHeard = true;
  assert.equal(mh.marketBandOf({ mapId: RIP }, 900), 'Booming');
  band = 'Steady';
  assert.equal(mh.marketBandOf({ mapId: RIP }, 900), 'Booming', 'kept now');
  await flush();
  assert.equal(ready, 1, 'the trips planned before let go, once');
  // LIV-8: past MARKET_BANDS_MAX the oldest goes, never the whole
  for (let k = 0; k < MARKET_BANDS_MAX - 2; k++) mh.marketBandOf({ mapId: k + 1 }, 1);
  assert.equal(mh.marketBandOf({ mapId: RIP }, 901), 'Steady', 'the newest kept');
  mh.marketBandOf({ mapId: 999_999 }, 1);   // past the bound
  band = 'Destitute';
  assert.equal(mh.marketBandOf({ mapId: RIP }, 901), 'Steady', 'a day just kept is kept');
  assert.equal(mh.marketBandOf({ mapId: RIP }, 900), 'Destitute', 'the oldest let go, and read again');
  // SVC-1: the developer's words
  assert.equal(parseTownCommand('hello'), null);
  assert.deepEqual(parseTownCommand('/town audit'), { op: 'audit' });
  assert.deepEqual(parseTownCommand('/town strike 3358447'), { op: 'strike', key: 3358447 });
  for (const bad of ['/town', '/town strike', '/town strike x', '/town strike 0', '/town strike 1 2', '/town audit 5']) assert.deepEqual(parseTownCommand(bad), { error: TOWN_USAGE }, bad);
  assert.deepEqual(townAuditLines({ towns: [] }, () => null), ['No town of this region is confirmed in the registry.']);
  const lines = townAuditLines({ towns: [{ map: RIP, px: 212, py: 151, location: 5, by: ['Ada', 'Bel', 'Cyr'] }, { map: 77, px: 10, py: 10, location: 6, by: [] }] }, (x) => (x === 212 ? RIP : x === 10 ? 999 : null));
  assert.match(lines[0], /^Town \d+ at 212,151 \(location 5\): the town here; confirmed by Ada, Bel, Cyr$/);
  assert.match(lines[1], /FALSE - the town here is 999/);
  const said = [];
  const sent = [];
  const dh = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => T * 1000,
    door: { ...d.door, me: () => ME, strike: async (map) => { sent.push(['strike', map]); return { ok: true, data: { reports: 3 } }; }, audit: async (region) => { sent.push(['audit', region]); return { ok: true, data: { towns: [] } }; } },
    storage: memory(), regionHere: () => 17 });
  assert.equal(dh.command('/hall audit', (l) => said.push(l)), false, 'not its word');
  assert.equal(dh.command('/town strike 42', (l) => said.push(l)), true);
  assert.equal(dh.command('/town audit', (l) => said.push(l)), true);
  await flush();
  assert.deepEqual(sent, [['strike', 42], ['audit', 17]]);
  assert.deepEqual(said, ['Town 42 is struck from the registry (3 reports).', 'No town of this region is confirmed in the registry.']);
  // the door's routes
  const posted = [];
  const signed = memory();
  signed.setItem(SESSION_KEY, JSON.stringify({ secret: 'sek', id: ME }));
  const door = accountTowns({ fetch: async (u, i) => { posted.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true}', { status: 200 }); }, storage: signed });
  await door.strike(42); await door.audit(17); await door.witness({ map: 1 }, 'k1.r.s');
  assert.deepEqual(posted.map(([p, b]) => [p, Object.keys(b).filter((k) => k !== 'secret')]), [['/v1/towns/strike', ['map']], ['/v1/towns/audit', ['region']], ['/v1/towns/witness', ['town', 'receipt']]]);
  // the world host's wiring
  const w = rd('src/scenes/world.js');
  assert.match(w, /chapters: chapterSheet, clockHeard: \(\) => _sharedClockHeard,/);
  assert.match(w, /seatsHeard: \(\) => !seatBook \|\| seatBook\.open != null, onBandsReady: \(\) => _livingTripMemo\.clear\(\),/);
  assert.match(w, /regionHere: \(\) => \{ const p = playerTravelPixel\(\); try \{ return maps\.getRegionIndexAt\(p\.x, p\.y\); \} catch \{ return null; \} \},/);
  assert.match(w, /const hallCmd = parseHallCommand\(text\); if \(townEcon\.command\(text, \(line\) => chatLog\.push\(tabId, \{ text: line, system: true \}\)\)\) return true;/);
});
