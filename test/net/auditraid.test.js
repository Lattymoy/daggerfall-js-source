// AUDIT RAID (2026-09-28, Mac: "1. Audit this properly 2. Ensure online functionality is perfect"): the raid's online
// arm, audited against its own tree (RAID3's relay ledger, RAID4a's claim, RAID4b's thanks) and each finding pinned
// here - driven through the real Room (fakeRoom.mjs), the real account service over node:sqlite and its real
// migrations, the real session and the real device queue. bible/03-World/Raiding-Parties.md, "AUDIT RAID".
//   R1 a raid is its whole tuple (key + signature), its ledger made only from its town's pixel, and a client hears only
//      its own raid's words;
//   R2 an earner's receipt kept by the hub - handed wherever the earner stands, and at a hello for a day;
//   R3 a cell's place never taken from a cleansed raid or one being fought; a speaker holds two at most;
//   R4 a town's thanks once a (raid, account) - the account service's word, keyed to the device's claim id;
//   R5 a raid's key canonical, and its Renown the account's hour's;
//   R6 a word judged by its own law and time before any read, and the cell's copies bounded;
//   R7 the hub's list of cleanses written before its copy moves;
//   R8 the raid thanks' own crash records, a halo's own relay's word, a page's hook kept from the carrier.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  RAID_KEY_RE, RAID_DAY_MINUTES, RAID_START_LAST, RAID_TARGET_MIN, RAID_LEDGERS_MAX, RAID_LEDGER_BUSY_MS,
  RAID_LEDGERS_BY_MAX, RAID_KILLS_BURST, RAID_KILL_MS, RAID_SIG_RE, raidSig, raidLedgerId, raidWordSane, raidEvictPick,
  raidLedgerLast, newRaidLedger, raidDayOfKey, raidDaySlots,
} from '../../src/net/raid/raidLaw.js';
import { mintRaidReceipt, readRaidReceipt } from '../../src/net/raid/raidReceipt.js';
import {
  raidLedgerKey, raidReceiptKeyOf, RAID_RC_KEEP, RAID_RC_KEEP_MS, RAID_RELAY_MIN, relaySupportsRaid, worldRoom,
  wallMsForClassicMinutes, SOCIAL_ROOM, PIXEL_UNITS, RELAY_VERSION,
} from '../../src/net/wire.js';
import { fakeRooms } from '../fakeRoom.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { createGuest } from '../../server-account/src/accounts.js';
import { claimRaid, RAID_CID_RE } from '../../server-account/src/raids.js';
import { reportRenownXp } from '../../server-account/src/renownTracks.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../src/net/identityToken.js';
import { renownRaidXp, renownForXp, RENOWN_XP_HOUR_MAX } from '../../src/net/renown.js';
import { createRaidClaims, RAID_CLAIMS_KEY, RAID_SETTLED_KEY, RAID_CID_RE as CLIENT_CID_RE } from '../../src/net/raid/raidClaims.js';
import { createSpoilsPool, recoverSpoils, SPOILS_RECORDS_MAX } from '../../src/scenes/spoilsPool.js';
import { RAID_SPOILS_KEYS, RAID_SPOILS_RECORDS_MAX, RAID_SPOILS_TEXT } from '../../src/systems/raidSpoils.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const subtle = globalThis.crypto.subtle;
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

// ═══ THE RIG ══════════════════════════════════════════════════════════════════════════════════════

const D = 600;
/** RAID-ROLL: the relay hears only a raid the day drew - A (the honest raid) and B are day D's own slots. */
const SLOTS = [...raidDaySlots(D)].map((x) => { const [st, tg, ty] = x.split('.').map(Number); return { st, tg, ty }; });
const slotAt = (m) => { const at = SLOTS.find((x) => x.st === D * RAID_DAY_MINUTES + m); assert.ok(at, `day ${D} draws a raid at minute ${m}`); return at; };
const A = slotAt(587), B = slotAt(569);
const ST = A.st;
const KEY = `3:7:${D}`;
const PX = 100, PY = 200;
const CELL = worldRoom(PX, PY);
const word = (o = {}) => ({ k: 'w', key: KEY, st: ST, tg: A.tg, ty: A.ty, px: PX, py: PY, n: 0, s: 0, ...o });
const G = (o = {}) => raidSig(word(o));
const LED = (o = {}) => raidLedgerKey(raidLedgerId(word(o)));
const T0 = wallMsForClassicMinutes(ST + 10);
const ON = { x: PX * PIXEL_UNITS + 16384, y: 0, z: (499 - PY) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };
const OFF = { ...ON, x: ON.x + PIXEL_UNITS };
const raids = (ws, k) => ws.sent.filter((m) => m.t === 'raid' && (!k || m.k === k));
async function withRaid(fn) {
  const realNow = Date.now; let clock = T0; Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const r = world.room(CELL);
  const say = (ws, o = {}) => r.raw(ws, JSON.stringify({ t: 'raid', ...word(o) }));
  try { await fn({ world, r, say, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
const signing = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') };
};
const ledgers = (r) => [...r.store.keys()].filter((k) => k.startsWith('raid:'));

// ═══ THE LAW ══════════════════════════════════════════════════════════════════════════════════════

test('AUDIT RAID R1/R5/R6 law: a raid key is canonical (no leading zero - forty spellings of one raid were forty rows); a raid is its whole tuple - its key and its signature (start, target, party, town pixel), which every honest machine computes alike; a word no day could roll is not sane (mutants: the old key law; the signature missing a field; sanity by the window alone)', () => {
  for (const ok of ['3:7:600', '0:0:0', '61:9999:9999999', '10:100:1']) assert.ok(RAID_KEY_RE.test(ok), ok);
  for (const bad of ['3:07:600', '03:7:600', '3:7:0600', '00:1:1', '3:7:', '3:7:12345678', '100:1:1']) assert.equal(RAID_KEY_RE.test(bad), false, bad);
  assert.equal(raidDayOfKey('3:07:600'), null, 'and a key no honest machine makes has no day');
  assert.equal(raidSig(word()), `${ST}.${A.tg}.${A.ty}.100.200`);
  for (const o of [{ st: ST + 1 }, { tg: 16 }, { ty: 1 }, { px: 101 }, { py: 201 }]) assert.notEqual(G(o), G(), `a different ${Object.keys(o)[0]} is a different raid`);
  assert.equal(G({ n: 9, s: 1 }), G(), 'a word\'s deaths and strike are not what the raid is');
  assert.equal(raidLedgerId(word()), `${KEY}|${G()}`);
  assert.ok(RAID_SIG_RE.test(G()));
  assert.ok(RAID_SIG_RE.test(raidSig({ st: 9_999_999 * RAID_DAY_MINUTES + RAID_START_LAST, tg: 25, ty: 2, px: 999, py: 499 })), 'the key\'s last day\'s start');
  assert.equal(raidWordSane(word()), true);
  assert.equal(raidWordSane(word({ st: D * RAID_DAY_MINUTES + RAID_START_LAST + 1 })), false, 'a start past its day\'s last');
  assert.equal(raidWordSane(word({ st: D * RAID_DAY_MINUTES - 1 })), false, 'a start before its day');
  assert.equal(raidWordSane(word({ key: '3:07:600' })), false);
});

test('AUDIT RAID R3 law: WHICH LEDGER GIVES ITS PLACE - never a cleansed one (its receipts and its hub word owed), never one fought within RAID_LEDGER_BUSY_MS; one that counted nothing first, then the stalest; none, and the new raid waits (mutants: a cleansed one taken; a busy one taken; the counted one before the empty; the freshest taken)', () => {
  const T = 5_000_000;
  const mk = (key, first, o = {}) => ({ ...newRaidLedger(word({ key }), first, 'acct-x'), ...o });
  const busy = mk('3:1:600', T), cleansed = mk('3:2:600', T - 10 * RAID_LEDGER_BUSY_MS, { cl: { at: T, top: [], n: 0 } });
  const counted = mk('3:3:600', T - 5 * RAID_LEDGER_BUSY_MS, { n: 4 }), empty = mk('3:4:600', T - 2 * RAID_LEDGER_BUSY_MS);
  assert.equal(raidEvictPick([busy, cleansed, counted, empty], T), empty, 'nothing counted goes first, though the counted one is staler');
  assert.equal(raidEvictPick([busy, cleansed, counted], T), counted, 'then the stalest idle');
  assert.equal(raidEvictPick([busy, cleansed], T), null, 'never cleansed, never busy');
  const fought = mk('3:5:600', T - 9 * RAID_LEDGER_BUSY_MS, { a: { 'acct-y': { nm: 'Y', n: 0, s: 0, last: T - 1000 } } });
  assert.equal(raidLedgerLast(fought), T - 1000, 'a ledger\'s last moment is its newest word');
  assert.equal(raidEvictPick([fought], T), null, 'a word a second ago: being fought');
  const older = mk('3:6:600', T - 3 * RAID_LEDGER_BUSY_MS), oldest = mk('3:7:600', T - 4 * RAID_LEDGER_BUSY_MS);
  assert.equal(raidEvictPick([older, oldest], T), oldest);
  assert.equal(RAID_LEDGERS_MAX, 8); assert.equal(RAID_LEDGERS_BY_MAX, 2);
});

// ═══ THE RELAY ════════════════════════════════════════════════════════════════════════════════════

test('AUDIT RAID R1 relay: A SOCKET\'S FIRST WORD NO LONGER DECIDES AN HONEST RAID - a word off the town\'s pixel makes nothing; a forged tuple on its own pixel is its own ledger and cleanse; the honest defenders\' words make theirs, count, and cleanse it at ITS target, and the cleanse carries its signature (mutants: the ledger made off the town; the key alone the ledger\'s identity; the cleanse unsigned)', async () => {
  const { pkcs8 } = await signing();
  await withRaid(async ({ r, say, step }) => {
    r.env.GATE_SIGNING_KEY = pkcs8;
    const grief = r.connect(); await r.hello(grief, 'peer-0666', OFF);
    await say(grief, { ...B, px: PX, py: PY });   // the honest pixel named, stood beside (RAID-ROLL: a raid the day drew - no table held, its town is its word's)
    assert.equal(ledgers(r).length, 0, 'off the town: no raid made');
    step(1000);
    await say(grief, { ...B, px: PX + 1 });   // its own pixel, the honest key, another of the day's raids
    assert.equal(ledgers(r).length, 1);
    assert.ok(r.store.has(LED({ ...B, px: PX + 1 })), 'a ledger of its own tuple');
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { s: 1 });
    step(20_000);
    await say(b, { s: 1 });
    await say(a, { n: 15, s: 1 });
    const cl = raids(a, 'cl');
    assert.equal(cl.length, 1, 'the honest raid cleansed at its own target - fifteen');
    assert.equal(cl[0].g, G(), 'and says which raid it is');
    assert.equal(r.store.get(LED()).n, 15);
    assert.equal(r.store.get(LED({ ...B, px: PX + 1 })).n, 0, 'the forged ledger untouched');
    assert.equal(raids(grief, 'cl').length, 1, 'the cell hears the honest cleanse - a client matches its signature (raid3 client pins)');
  });
});

test('AUDIT RAID R3 relay: A PLACE IN A FULL CELL - refused while every raid in it is being fought, given by the stalest one nobody is fighting once there is one, never by a cleansed one; one speaker holds two places at most (mutants: the busy evicted; the cleansed evicted; the speaker unbounded)', async () => {
  await withRaid(async ({ r, step }) => {
    const speak = async (id, key, pose = ON) => { const ws = r.connect(); await r.hello(ws, id, pose); await r.raw(ws, JSON.stringify({ t: 'raid', ...word({ key }) })); return ws; };
    for (let i = 0; i < RAID_LEDGERS_MAX; i++) { await speak(`peer-01${10 + i}`, `3:${10 + i}:${D}`); step(1000); }
    assert.equal(ledgers(r).length, RAID_LEDGERS_MAX);
    const late = await speak('peer-0200', `3:99:${D}`);
    assert.equal(ledgers(r).length, RAID_LEDGERS_MAX, 'every raid here fought within the minute: no place');
    assert.deepEqual(raids(late), [], 'and nothing said');
    // the first cleansed (its ledger as storage holds it, the object awake again), the rest left idle
    const first = LED({ key: `3:10:${D}` });
    r.store.set(first, { ...JSON.parse(JSON.stringify(r.store.get(first))), cl: { at: T0, top: [], n: 0 }, told: true });
    r.wake();
    step(RAID_LEDGER_BUSY_MS);
    await speak('peer-0201', `3:100:${D}`);
    assert.ok(r.store.has(LED({ key: `3:100:${D}` })), 'nobody fighting: a place given');
    assert.ok(r.store.has(first), 'never by the cleansed raid - its receipts and its hub word are owed');
    assert.equal(r.store.has(LED({ key: `3:11:${D}` })), false, 'the stalest idle one gave it');
    // one speaker: two places at most
    const ws = r.connect(); await r.hello(ws, 'peer-0300', ON);
    step(RAID_LEDGER_BUSY_MS);
    for (const k of [101, 102, 103]) { await r.raw(ws, JSON.stringify({ t: 'raid', ...word({ key: `3:${k}:${D}` }) })); step(1000); }
    assert.ok(r.store.has(LED({ key: `3:101:${D}` })) && r.store.has(LED({ key: `3:102:${D}` })));
    assert.equal(r.store.has(LED({ key: `3:103:${D}` })), false, 'a third of one speaker\'s: refused');
  });
});

test('AUDIT RAID R6 relay: A WORD OUT OF ITS TIME COSTS NOTHING - no storage read, no copy kept; one no day could roll is struck; and the cell\'s copies stay bounded however many invented keys arrive (mutants: the read before the window; the copies unbounded)', async () => {
  await withRaid(async ({ r, set, step }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    const get = r.state.storage.get; let reads = 0;
    r.state.storage.get = async (...x) => { reads++; return get(...x); };
    set(wallMsForClassicMinutes(ST + 400));
    await r.raw(a, JSON.stringify({ t: 'raid', ...word() }));
    assert.equal(reads, 0, 'judged by its own time before any read');
    assert.equal(r.room._raids.size, 0, 'and nothing kept of it');
    assert.equal(a.meters.junk ?? 0, 0, 'a clock at a window\'s edge is not struck');
    set(T0);
    step(1000);
    await r.raw(a, JSON.stringify({ t: 'raid', ...word({ st: (D + 1) * RAID_DAY_MINUTES }) }));
    assert.equal(a.meters.junk, 1, 'a start in another day than its key\'s: junk');
    let most = 0;
    for (let i = 0; i < 90; i++) {   // invented keys, each read once from storage and kept as a miss
      step(1000);   // the raid meter's own second
      await r.raw(a, JSON.stringify({ t: 'raid', ...word({ key: `3:${500 + i}:${D}` }) }));
      most = Math.max(most, r.room._raids.size);
    }
    assert.ok(most > 32, `the misses were kept (${most})`);
    assert.ok(most <= 64, `the copies bounded (${most})`);
  });
});

test('AUDIT RAID R2 relay: THE HUB KEEPS AN EARNER\'S RECEIPT - an earner with no socket in the town\'s cell at the cleanse is handed it on its hub socket, and again at its next hello for a day; a hub told again hands none twice; an unsigned one is not kept; the sweep lets a spent keep go (mutants: the receipts not carried to the hub; the hello unhanded; handed twice; kept for ever)', async () => {
  const { pkcs8 } = await signing();
  await withRaid(async ({ world, r, say, step }) => {
    r.env.GATE_SIGNING_KEY = pkcs8;
    const hub = world.room(SOCIAL_ROOM);
    const ha = hub.connect(); await hub.hello(ha, 'peer-0001');
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(b, { s: 1 });   // the raid made, and b fighting it
    step(12_000);
    await say(a, { s: 1 });   // a strikes...
    await r.drop(a);          // ...and steps into the tavern: no cell socket at the cleanse
    step(1000);
    await say(b, { n: 15, s: 1 });   // the count at its target a second later (the cap: three, then one a second)
    const kept = r.store.get(LED());
    assert.ok(kept.rc['acct-peer-0001'], 'a is an earner - struck, and stood there within RAID_PRESENT_MS');
    const handed = raids(ha, 'rc');
    assert.equal(handed.length, 1, 'handed on the hub');
    assert.equal(handed[0].r, kept.rc['acct-peer-0001']);
    assert.deepEqual(hub.store.get(raidReceiptKeyOf('acct-peer-0001')).map((e) => e.r), [kept.rc['acct-peer-0001']], 'and kept for its account');
    await hub.room._raidCleanInternal(new Request('https://relay.internal/internal/raid/clean', { method: 'POST', body: JSON.stringify({ key: KEY, at: kept.cl.at, top: [], n: 2, g: G(), rc: kept.rc }) }));
    assert.equal(raids(ha, 'rc').length, 1, 'told again: nothing handed twice');
    step(1000);
    const again = hub.connect(); await hub.hello(again, 'peer-0001');
    assert.deepEqual(raids(again, 'rc').map((m) => m.r), [kept.rc['acct-peer-0001']], 'a later hello is handed it');
    const had = raids(again, 'rc').length;
    await hub.room._raidReceiptsTo(again, 'acct-peer-0001', Date.now() + RAID_RC_KEEP_MS);   // the hello's own door, a day on (this harness mints one identity's tokens backwards from its first)
    assert.equal(raids(again, 'rc').length, had, 'a day on, nothing handed');
    assert.equal(hub.store.has(raidReceiptKeyOf('acct-peer-0001')), false, 'and let go');
    // unsigned: a relay with no key - no service would take it
    const nokey = await mintRaidReceipt({ w: `3:9:${D}`, s: 'acct-peer-0077', c: 1, y: 2 }, null, { subtle, nowS: Math.floor(Date.now() / 1000) });
    await hub.room._raidCleanInternal(new Request('https://relay.internal/internal/raid/clean', { method: 'POST', body: JSON.stringify({ key: `3:9:${D}`, at: Date.now(), top: [], n: 1, g: G({ key: `3:9:${D}` }), rc: { 'acct-peer-0077': nokey } }) }));
    assert.equal(hub.store.has(raidReceiptKeyOf('acct-peer-0077')), false, 'an unsigned receipt is not kept');
    // the sweep: a keep none of whose receipts is good goes
    hub.store.set(raidReceiptKeyOf('acct-gone'), [{ r: 'w1.x.y', until: Date.now() - 1 }]);
    await hub.room._sweepHub(Date.now());
    assert.equal(hub.store.has(raidReceiptKeyOf('acct-gone')), false, 'the sweep let it go');
    assert.equal(RAID_RC_KEEP, 8);
  });
});

test('AUDIT RAID R7 relay: THE HUB\'S LIST IS WRITTEN BEFORE ITS COPY MOVES - a put that throws leaves the copy as storage has it, so the cell\'s retry finds the cleanse new and everyone is told (mutants: the copy pushed first - the retry answered "known", nobody ever told)', async () => {
  await withRaid(async ({ world }) => {
    const hub = world.room(SOCIAL_ROOM);
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    const put = hub.state.storage.put;
    let fail = true;
    hub.state.storage.put = async (...x) => { if (fail && x[0] === 'raidcl') { fail = false; throw new Error('storage'); } return put(...x); };
    const tell = () => hub.room._raidCleanInternal(new Request('https://relay.internal/internal/raid/clean', { method: 'POST', body: JSON.stringify({ key: KEY, at: T0, top: [], n: 1, g: G() }) }));
    await assert.rejects(tell());
    assert.equal(raids(h, 'cl').length, 0);
    assert.equal((await hub.room._raidCleansOf(T0)).length, 0, 'the copy is storage\'s');
    await tell();
    assert.equal(raids(h, 'cl').length, 1, 'the retry is news, and told');
  });
});

// ═══ THE SESSION ══════════════════════════════════════════════════════════════════════════════════

test('AUDIT RAID R8b session: A HALO SAYS FOR ITSELF - a raid word goes down a halo only when the halo\'s own relay keeps raids (a halo on an older object, a deploy under way, closed on the frame); the primary\'s word is the primary\'s (mutants: the halo sent on the primary\'s word)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const log = console.info; console.info = () => {};
  try {
    s.join(CELL, { x: ON.x, y: 0, z: ON.z, yaw: 0 });
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION });
    const other = worldRoom(PX + 16, PY);
    s.setHalo([other]);
    const halo = sockets[1];
    halo.open();
    halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: `world${RAID_RELAY_MIN - 1}` });
    assert.equal(s.raidOk, true);
    assert.equal(s.sendRaid(word({ px: PX + 16 }), other), false, 'the halo\'s relay would close the socket for it');
    assert.equal(halo.sent.filter((x) => JSON.parse(x).t === 'raid').length, 0);
    halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION });
    const before = sockets[0].sent.filter((x) => JSON.parse(x).t === 'raid').length;
    assert.equal(s.sendRaid(word({ px: PX + 16 }), other), true, 'its own relay keeps raids');
    assert.equal(halo.sent.filter((x) => JSON.parse(x).t === 'raid').length, 1, 'down the halo\'s own socket');
    assert.equal(sockets[0].sent.filter((x) => JSON.parse(x).t === 'raid').length, before, 'never the primary\'s (the relay strikes a word said in the wrong cell)');
    assert.equal(relaySupportsRaid('world122'), false, 'world122 never carried a signature');
  } finally { console.info = log; }
});

// ═══ THE ACCOUNT SERVICE ══════════════════════════════════════════════════════════════════════════

const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(rd(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const x = stmt.run(...args); return { meta: { changes: Number(x.changes) } }; },
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const S0 = 1_800_000_000;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const guest = async (db) => (await createGuest({ db, subtle, rand, nowS: S0 }, { deviceLabel: null })).id;
let _h = 0;
const member = async (db) => { const id = await guest(db); const h = `Keep${++_h}`; db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id); return { id, handle: h }; };
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}
const raidFor = (s, key, priv, nowS = S0) => mintRaidReceipt({ w: key, s, c: 777, y: 2 }, priv, { subtle, nowS });
const CID1 = '0123456789abcdef', CID2 = 'fedcba9876543210';

test('AUDIT RAID R4 service: A TOWN\'S THANKS ONCE A (RAID, ACCOUNT) - the first claim to ask writes the thanks row with its device\'s claim id and is answered `spoils: true`; the same device asking again (an answer it lost) is answered the same; another device, and a claim without a claim id, never; a guest is thanked once and, registered later, counted without being thanked again (mutants: the thanks by the claim rather than the row; the row unkeyed; a guest unthanked; a claim without an id thanked)', async () => {
  const db = d1();
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: S0 + 60, subtle, rand };
  const A = await member(db);
  const r1 = await raidFor(A.id, `3:7:${D}`, priv);
  const pc = await claimRaid(ctx, A, { receipt: r1, character: 'char-0001', cid: CID1 }, pubKey);
  assert.equal(pc.recorded, true); assert.equal(pc.spoils, true, 'the first claim: thanked');
  assert.deepEqual(await claimRaid(ctx, A, { receipt: r1, character: 'char-0001', cid: CID1 }, pubKey), { recorded: false, why: 'claimed', defended: 1, spoils: true }, 'the same device again: the same answer');
  assert.deepEqual(await claimRaid(ctx, A, { receipt: r1, character: 'char-0001', cid: CID2 }, pubKey), { recorded: false, why: 'claimed', defended: 1, spoils: false }, 'a second browser: counted before, thanked before');
  assert.equal((await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:8:${D}`, priv), character: 'char-0001' }, pubKey)).spoils, false, 'no claim id: no thanks');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM raid_spoils WHERE account = ?').get(A.id).n, 1, 'and no row for it');
  assert.equal((await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${D}`, priv), character: 'char-0001', cid: 'XYZ' }, pubKey)).spoils, false, 'nor for a claim id out of its shape');
  const g = await guest(db);
  const rg = await raidFor(g, `3:7:${D}`, priv);
  assert.deepEqual(await claimRaid(ctx, { id: g, handle: null }, { receipt: rg, character: 'char-0001', cid: CID2 }, pubKey), { recorded: false, why: 'guest', defended: 0, spoils: true }, 'a guest is thanked');
  assert.equal((await claimRaid(ctx, { id: g, handle: null }, { receipt: rg, character: 'char-0001', cid: CID1 }, pubKey)).spoils, false, 'once');
  const reg = await claimRaid(ctx, { id: g, handle: 'Late' }, { receipt: rg, character: 'char-0001', cid: CID1 }, pubKey);
  assert.equal(reg.recorded, true, 'registered, counted');
  assert.equal(reg.spoils, false, 'and not thanked again');
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(A.id);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM raid_spoils WHERE account = ?').get(A.id).n, 0, 'an account gone takes its thanks');
  assert.ok(RAID_CID_RE.test(CID1) && !RAID_CID_RE.test('0123'));
  assert.equal(String(RAID_CID_RE), String(CLIENT_CID_RE), 'the client mints what the service reads');
  const sql = rd('server-account/migrations/0017_raid_spoils.sql');
  assert.match(sql, /PRIMARY KEY \(raid, account\)/);
  assert.match(sql, /FOREIGN KEY \(account\) REFERENCES players\(id\) ON DELETE CASCADE/);
});

test('AUDIT RAID R5 service: A RAID\'S RENOWN IS THE HOUR\'S - charged to the account\'s hour as a report is: paid what the hour has left, the raid counted whatever it has; the row says what was paid; a report after it finds the hour spent (mutants: the raid outside the hour; the hour unspent by it)', async () => {
  const db = d1();
  const { priv, pubKey } = await relayPair();
  const A = await member(db);
  const nowS = S0 + 60, hour = Math.floor(nowS / 3600);
  db._raw.prepare('UPDATE players SET renown_hour = ?, renown_hour_xp = ? WHERE id = ?').run(hour, RENOWN_XP_HOUR_MAX - 100, A.id);
  const c1 = await claimRaid({ db, nowS, subtle, rand }, A, { receipt: await raidFor(A.id, `3:7:${D}`, priv), character: 'char-0001' }, pubKey);
  assert.equal(c1.recorded, true, 'counted');
  assert.equal(c1.renown.credited, 100, 'paid what the hour had left');
  assert.equal(c1.renown.xp, 100);
  assert.equal(db._raw.prepare('SELECT xp FROM raid_cleanses WHERE account = ?').get(A.id).xp, 100, 'the row says what was paid');
  assert.equal(db._raw.prepare('SELECT renown_hour_xp AS x FROM players WHERE id = ?').get(A.id).x, RENOWN_XP_HOUR_MAX, 'the hour spent');
  const c2 = await claimRaid({ db, nowS, subtle, rand }, A, { receipt: await raidFor(A.id, `3:8:${D}`, priv), character: 'char-0001' }, pubKey);
  assert.equal(c2.recorded, true); assert.equal(c2.defended, 2, 'the hour spent: still counted');
  assert.equal(c2.renown.credited, 0, 'and paid nothing');
  const rep = await reportRenownXp({ db, nowS }, A, { character: 'char-0001', xp: 50 });
  assert.equal(rep.credited, 0, 'a report after it finds the hour spent');
  const next = await claimRaid({ db, nowS: nowS + 3600, subtle, rand }, A, { receipt: await raidFor(A.id, `3:9:${D}`, priv, nowS + 3600), character: 'char-0001' }, pubKey);
  assert.equal(next.renown.credited, renownRaidXp(renownForXp(100)), 'a new hour pays it whole (at the track\'s own Renown)');
  // a new character past the tracks' bound: counted, paid nothing - and the hour not spent on it
  const B = await member(db);
  for (let i = 0; i < 60; i++) db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(B.id, `char-t${i}`, 'T', 0, S0, S0);
  const none = await claimRaid({ db, nowS, subtle, rand }, B, { receipt: await raidFor(B.id, `3:7:${D}`, priv), character: 'char-new1' }, pubKey);
  assert.equal(none.recorded, true); assert.equal(none.renown.credited, 0);
  assert.equal(db._raw.prepare('SELECT renown_hour_xp AS x FROM players WHERE id = ?').get(B.id).x, 0, 'no place to pay: the hour untouched');
});

// ═══ THE DEVICE ═══════════════════════════════════════════════════════════════════════════════════

const memStore = () => { const m = new Map(); return { get: (k) => (m.has(k) ? JSON.parse(m.get(k)) : undefined), set: (k, v) => m.set(k, JSON.stringify(v)), remove: (k) => m.delete(k), m }; };

test('AUDIT RAID R4/R8e device: a receipt is kept with the level and character that fought it and this device\'s claim id; the town\'s thanks are given only on the service\'s `spoils: true`; a receipt this device settled is never claimed again, whoever hands it; a page hook that throws is the page\'s - the receipt still settles (mutants: the thanks on the receipt\'s arrival; the claim id unsent; the settled forgotten; the hook\'s throw left the entry unsettled)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_900_000_000;
  const r1 = await mintRaidReceipt({ w: KEY, s: 'acct-me', c: 5, y: 2 }, kp.privateKey, { subtle, nowS });
  const r2 = await mintRaidReceipt({ w: `3:8:${D}`, s: 'acct-me', c: 6, y: 2 }, kp.privateKey, { subtle, nowS });
  const st = memStore();
  const asked = [], thanked = [];
  let answer = { ok: true, data: { recorded: true, defended: 1, spoils: false } };
  const q = createRaidClaims({
    claim: async (r, ch, nm, cid) => { asked.push({ r, ch, cid }); return answer; }, store: st, nowS: () => nowS, nowMs: () => 0,
    me: () => 'acct-me', onSpoils: (e) => thanked.push(e), onRecorded: () => { throw new Error('the page\'s own bug'); }, cid: () => CID1,
  });
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((res) => setImmediate(res)); };
  await quiet(async () => { q.add(r1, 'char-0001', 'Ann', 12); await settle(); });
  assert.equal(asked[0].cid, CID1, 'the claim carries this device\'s id');
  assert.deepEqual(thanked, [], 'counted, not thanked: the service said no');
  assert.deepEqual(st.get(RAID_CLAIMS_KEY), [], 'the page\'s hook threw, and the receipt settled all the same');
  assert.deepEqual(st.get(RAID_SETTLED_KEY), [`${KEY}|acct-me`]);
  assert.equal(q.add(r1, 'char-0001', 'Ann', 12), false, 'settled here: the hub\'s next hello hands it for nothing');
  const q2 = createRaidClaims({ claim: async () => answer, store: st, nowS: () => nowS, nowMs: () => 0, me: () => 'acct-me' });
  assert.equal(q2.add(r1, 'char-0001', 'Ann', 12), false, 'and in the next session, the device remembers');
  answer = { ok: true, data: { recorded: false, why: 'guest', defended: 0, spoils: true } };
  await quiet(async () => { q.add(r2, 'char-0001', 'Ann', 12); await settle(); });
  assert.equal(thanked.length, 1, 'the service\'s word: thanked');
  assert.equal(thanked[0].lv, 12); assert.equal(thanked[0].ch, 'char-0001'); assert.equal(thanked[0].cid, CID1);
  assert.equal(st.get(RAID_CLAIMS_KEY).length, 1, 'a guest\'s receipt is kept for its registering');
  st.set(RAID_CLAIMS_KEY, [{ r: r2, ch: 'char-0001', nm: null }]);
  assert.deepEqual(q.kept(), [], 'an entry with no claim id is none (no build ever shipped one)');
});

test('AUDIT RAID R4/R8a device: ANOTHER CHARACTER\'S THANKS are kept for it - never in this pack - and the crash\'s door hands them over when it stands up; the town\'s pool keeps RAID_SPOILS_RECORDS_MAX crash records, a boss\'s SPOILS_RECORDS_MAX (mutants: taken into the wrong pack; the owner ignored; the cap shared)', () => {
  const st = memStore();
  const took = [], said = [];
  let who = 'char-B';
  const pool = createSpoilsPool({ ray: () => null, now: () => 0, take: (p) => took.push(p), say: (x) => said.push(x), store: st, who: () => who, keys: RAID_SPOILS_KEYS, recordsMax: RAID_SPOILS_RECORDS_MAX });
  const list = [{ kind: 'gold', gold: 40, tier: 'common' }];
  assert.equal(pool.grant({ day: 'raid:3:7:600', acct: 'acct-me', roll: () => list, owner: 'char-A', kept: RAID_SPOILS_TEXT.kept('Ann') }), true);
  assert.deepEqual(took, [], 'not into B\'s pack');
  assert.deepEqual(said, ['The town\'s thanks wait for Ann.']);
  assert.equal(pool.grant({ day: 'raid:3:7:600', acct: 'acct-me', roll: () => list, owner: 'char-A' }), false, 'once a receipt');
  const handed = [];
  assert.equal(recoverSpoils(st, (p) => handed.push(p), { who: 'char-B', key: RAID_SPOILS_KEYS.store }), 0, 'B stands up: not B\'s');
  assert.equal(recoverSpoils(st, (p) => handed.push(p), { who: 'char-A', key: RAID_SPOILS_KEYS.store }), 1, 'A stands up: A\'s');
  who = 'char-A';
  for (let i = 0; i < SPOILS_RECORDS_MAX + 4; i++) pool.grant({ day: `raid:3:${20 + i}:600`, acct: 'acct-me', roll: () => list });
  assert.equal(st.get(RAID_SPOILS_KEYS.store).length, SPOILS_RECORDS_MAX + 5, 'past a boss\'s eight - every unsaved town\'s thanks kept');
  assert.equal(RAID_SPOILS_RECORDS_MAX, 32);
});

test('AUDIT RAID wiring by source: the relay keeps receipts at the hub and hands them at the hello, sweeps them, and makes a raid only from its pixel; the hub\'s list is put before its copy moves; the client matches a relay\'s word by its signature; the session takes a receipt from the hub (mutants: each line undone)', () => {
  const idx = rd('server/src/index.js');
  assert.match(idx, /if \(!here\) return;   \/\/ AUDIT RAID R1/);
  assert.match(idx, /if \(!\(await this\._raidMakeRoom\(now, acct\)\)\) return;/);
  assert.match(idx, /if \(!raidWordSane\(m\)\) \{ this\._junk\(ws\); return; \}/);
  assert.match(idx, /if \(!raidWordFits\(m, sharedClassicMinutes\(now\)\)\) return;   \/\/ outside its raid's time: nothing read, kept or said\n(?:[^\n]*\n){0,8}?\s*const id = raidLedgerId\(m\);/);   // RAID-ROLL's reads of the day's roll sit between (test/systems/raidroll.test.js)
  assert.match(idx, /await this\.state\.storage\.put\('raidcl', next\);\n\s*this\._raidCleans = next;/);
  assert.match(idx, /await this\._raidReceiptsKeep\(cl, body\?\.rc, now\);/);
  assert.match(idx, /if \(sub\) \{ try \{ await this\._raidReceiptsTo\(ws, sub, now\); \}/);
  assert.match(idx, /g: raidSig\(led\), rc: led\.rc \?\? \{\} \}/);
  const rp = rd('src/systems/raidingParties.js');
  assert.match(rp, /const raidOfWord = \(key, g\) => \{ const r = raidByKey\(key\); return r && raidSigOf\(r\) === g \? r : null; \};/);
  assert.match(rp, /for \(const \[key, , g\] of Array\.isArray\(f\.l\) \? f\.l : \[\]\) \{ const r = raidOfWord\(key, g\);/);
  assert.match(rp, /const raid = raidOfWord\(f\.key, f\.g\);/);
  const on = rd('src/net/online.js');
  assert.match(on, /r\.k === 'cl' \|\| r\.k === 'rc' \? isCellRoom\(room\) \|\| isSocialRoom\(room\)/);
  assert.match(on, /if \(!\(cell === this\.room \? this\.raidOk : halo\?\.raidOk\)\) return false;/);
  assert.match(on, /else \{ const h = this\._halo\.get\(room\); if \(h\) h\.raidOk = relaySupportsRaid\(relayV\); \}/);
  assert.match(rd('src/net/accountClient.js'), /claim: async \(receipt, character, name = null, cid = null\) =>/);
  assert.match(rd('server-account/src/index.js'), /cid: body\.cid \?\? null \}/);
  assert.ok(readRaidReceipt, 'the relay reads its own receipts back');
});
