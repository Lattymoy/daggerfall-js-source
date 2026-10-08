// RAID3 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server" - the relay tracks each raid's kill
// count, kept even if everyone leaves, the cleanse and the participants, and signs the rewards): THE RELAY HOLDS THE
// RAID. The ledger's law in node (net/raidLaw.js: the window, the first word keeps, the cap, each account's share, the
// target, who earned it); the raid's receipt (net/raidReceipt.js: the gate's ladder, never mistaken for a gate's
// receipt or an identity); the `raid` frame both ways (net/wire.js); the relay over the real Room (server/src/index.js:
// a word's cell, pose and time, the count fanned, the cleanse said once with its receipts, the ledger kept through
// everyone leaving and a wake, the hub's word to everyone and to a later hello, a hub that did not answer told again,
// the ledger's end); the session (net/online.js: the word down the town cell's socket, the frames in); the raid on the
// client (systems/raidingParties.js: the word said, the relay's count and cleanse the raid's, the receipt kept); and
// the world host's wiring by source.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RAID_KEY_RE, RAID_DAY_MINUTES, RAID_WINDOW_MINUTES, RAID_START_LAST, RAID_TARGET_MIN, RAID_TARGET_MAX, RAID_TYPES,
  RAID_SLACK_MINUTES, RAID_WORD_KILLS_MAX, RAID_KILL_MS, RAID_KILLS_BURST, RAID_ACCOUNTS_MAX, RAID_PRESENT_MS, RAID_WORD_MS,
  RAID_KEEP_MS, RAID_LEDGERS_MAX, RAID_TOP_MAX, raidDayOfKey, raidWordFits, raidLedgerEndMinute, newRaidLedger, raidCap,
  foldRaidWord, raidCleansed, raidEarned, raidTop, raidLedgerState, raidSig, raidLedgerId, RAID_LEDGER_BUSY_MS, raidDaySlots,
} from '../src/net/raidLaw.js';
import { RAID_RECEIPT_V, RAID_RECEIPT_TTL_S, RAID_RECEIPT_MAX, raidReceiptValid, mintRaidReceipt, readRaidReceipt, verifyRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt, verifyReceipt, readReceipt } from '../src/net/gateReceipt.js';
import { verifyToken, mintToken } from '../src/net/identityToken.js';
import {
  parseClient, validRaidIn, validRaidOut, relaySupportsRaid, raidGate, RAID_RELAY_MIN, RAID_HZ_MAX, RAID_KINDS, RAID_OUT_KINDS,
  RAID_RECEIPT_WIRE_MAX, RAID_CLEANS_MAX, RAID_TELL_RETRY_MS, mapPixelOfWire, cellRoomOfWire, worldRoom, RELAY_VERSION,
  wallMsForClassicMinutes, SOCIAL_ROOM, DROP_STRIKES_MAX, raidLedgerKey, PIXEL_UNITS,
} from '../src/net/wire.js';
import {
  RAID_DURATION_MINUTES, RAID_START_SPAN, RAID_KILLS_MIN, RAID_KILLS_MAX_EXCLUSIVE, raidFrame as frame, raidRelayWord,
  raidRelayState, raidReceipt, raidRelayOn, restoreRaidSaveData as restoreSaveData, raidState, setRaidingPartiesHost,
  cleansedLine, defendedLine, withdrawnLine, raidKillTotal, _resetRaidingParties, RAID_RECEIPTS_KEPT,
} from '../src/systems/raidingParties.js';
import { RAID_KILLS_WIRE_MAX } from '../src/world/raidShared.js';
import { setSharedClock } from '../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { renownFoeStruck, _resetRenownKillsForTests } from '../src/net/renownTracker.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { fakeRooms } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const subtle = globalThis.crypto.subtle;
const keypair = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════

const D = 600;                      // the raid's day
/** RAID-ROLL: the relay hears only a raid the day drew - these raids are day D's own slots (net/raidLaw.js
 *  raidDaySlots): A the raid most tests fight, B and C two more open at its tenth minute, N one opening near its end. */
const SLOTS = [...raidDaySlots(D)].map((x) => { const [st, tg, ty] = x.split('.').map(Number); return { st, tg, ty }; });
const slotAt = (m) => { const at = SLOTS.find((x) => x.st === D * RAID_DAY_MINUTES + m); assert.ok(at, `day ${D} draws a raid at minute ${m}`); return at; };
const A = slotAt(587), B = slotAt(569), C = slotAt(559), N = slotAt(627);
const ST = A.st;                    // it began at 09:47
const KEY = `3:7:${D}`;
const PX = 100, PY = 200;           // the town's map pixel
const CELL = worldRoom(PX, PY);
const word = (o = {}) => ({ k: 'w', key: KEY, st: ST, tg: A.tg, ty: A.ty, px: PX, py: PY, n: 0, s: 0, ...o });
/** AUDIT RAID R1: a raid is its whole tuple - the signature its word names, and its ledger's storage key. */
const G = (o = {}) => raidSig(word(o));
const LED = (o = {}) => raidLedgerKey(raidLedgerId(word(o)));

test('RAID3 law: its numbers are the mod\'s own - the window, the latest start, the target\'s ends, the parties, the wire\'s bound on a share - and a raid\'s key has one home (mutants: any of them off by one)', () => {
  assert.equal(RAID_WINDOW_MINUTES, RAID_DURATION_MINUTES);
  assert.equal(RAID_START_LAST, RAID_START_SPAN - 1, 'Random.Range(0, 1321) never answers 1321');
  assert.equal(RAID_TARGET_MIN, RAID_KILLS_MIN);
  assert.equal(RAID_TARGET_MAX, RAID_KILLS_MAX_EXCLUSIVE - 1, 'Random.Range(15, 26) never answers 26');
  assert.equal(RAID_TYPES, 3, 'knights, bandits, orcs');
  assert.equal(RAID_WORD_KILLS_MAX, RAID_KILLS_WIRE_MAX, 'the relay\'s word and RAID2\'s word bound a share alike');
  assert.equal(RAID_DAY_MINUTES, MINUTES_PER_DAY);
  assert.ok(RAID_KEY_RE.test(KEY) && !RAID_KEY_RE.test('3:7') && !RAID_KEY_RE.test('3:7:x'));
  assert.equal(raidDayOfKey(KEY), D);
  assert.equal(raidDayOfKey('junk'), null);
  assert.equal(RAID_PRESENT_MS, 3 * RAID_WORD_MS, 'three words\' time - a word late on a slow link still stands');
  assert.equal(RAID_KILL_MS, 1000, 'the mod\'s shortest wait between raiders, Random.Range(1, 11) seconds');
  assert.equal(RAID_KILLS_BURST, 3, 'a few deaths\' slack at the first word - two runners racing, a spell over three');
});

test('RAID3 law: a word is heard inside its raid\'s time alone - the start in its key\'s day, the clock inside the window it names, a couple of minutes\' slack either side (mutants: the slack dropped at either end; a start in another day let in)', () => {
  assert.ok(raidWordFits(word(), ST + 10));
  assert.ok(raidWordFits(word(), ST - RAID_SLACK_MINUTES), 'a clock a little behind');
  assert.ok(!raidWordFits(word(), ST - RAID_SLACK_MINUTES - 0.01), 'before it began');
  assert.ok(raidWordFits(word(), ST + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES - 0.01), 'a clock a little ahead');
  assert.ok(!raidWordFits(word(), ST + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES), 'after it ended');
  assert.ok(!raidWordFits(word({ st: D * RAID_DAY_MINUTES - 1 }), D * RAID_DAY_MINUTES), 'a start the day before its key\'s');
  assert.ok(raidWordFits(word({ st: D * RAID_DAY_MINUTES + RAID_START_LAST }), D * RAID_DAY_MINUTES + RAID_START_LAST + 1), 'the latest start the roll makes');
  assert.ok(!raidWordFits(word({ st: D * RAID_DAY_MINUTES + RAID_START_LAST + 1 }), D * RAID_DAY_MINUTES + RAID_START_LAST + 2), 'one the roll never makes');
  assert.ok(!raidWordFits(word({ key: 'x' }), ST));
  assert.ok(!raidWordFits(word(), NaN));
  assert.equal(raidLedgerEndMinute({ st: ST }), ST + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES);
});

test('RAID3 law: THE LEDGER - a raid as its word names it (AUDIT RAID R1: its whole tuple); each account\'s share is the most it has said, credited as fast as raiders can stand (a burst, then one a second) and no further than the target; two accounts sum; a full ledger records no newcomer; nothing after the cleanse (mutants: the cap gone; the burst or the rate off; a share re-credited; the target overrun; the strike forgotten)', () => {
  const T = 1_000_000;
  const led = newRaidLedger(word({ tg: 20 }), T);
  assert.deepEqual(raidLedgerState(led), { k: 'st', key: KEY, n: 0, tg: 20, st: ST, c: 0, g: G({ tg: 20 }) });
  assert.equal(raidCap(led, T), RAID_KILLS_BURST);
  assert.deepEqual(foldRaidWord(led, 'acct-a', 'Ann', word({ n: 10 }), T), { credited: RAID_KILLS_BURST, known: true }, 'ten said at once: the burst believed');
  assert.deepEqual(foldRaidWord(led, 'acct-a', 'Ann', word({ n: 10 }), T), { credited: 0, known: true }, 'said again at once: nothing more');
  assert.deepEqual(foldRaidWord(led, 'acct-a', 'Ann', word({ n: 10 }), T + 2 * RAID_KILL_MS), { credited: 2, known: true }, 'two seconds on: two more of the same ten');
  assert.equal(led.a['acct-a'].n, RAID_KILLS_BURST + 2);
  assert.deepEqual(foldRaidWord(led, 'acct-a', 'Ann', word({ n: 4 }), T + 60_000), { credited: 0, known: true }, 'a smaller word takes nothing back and adds nothing');
  assert.deepEqual(foldRaidWord(led, 'acct-a', 'Ann', word({ n: 10 }), T + 60_000), { credited: 5, known: true }, 'the rest of the ten, once the raid has run on');
  assert.deepEqual(foldRaidWord(led, 'acct-b', 'Bran', word({ n: 3, s: 1 }), T + 60_000), { credited: 3, known: true }, 'a second owner\'s share sums');
  assert.equal(led.n, 13);
  assert.equal(led.a['acct-b'].s, 1);
  foldRaidWord(led, 'acct-b', 'Bran', word({ n: 3, s: 0 }), T + 61_000);
  assert.equal(led.a['acct-b'].s, 1, 'a strike is kept');
  assert.deepEqual(foldRaidWord(led, 'acct-b', 'Bran', word({ n: 99 }), T + 600_000), { credited: 7, known: true }, 'no further than the target');
  assert.equal(led.n, 20);
  assert.ok(raidCleansed(led));
  led.cl = { at: T + 600_000, top: [], n: 0 };
  assert.deepEqual(foldRaidWord(led, 'acct-c', 'Cora', word({ n: 5 }), T + 600_001), { credited: 0, known: false }, 'nothing after the cleanse');
  const full = newRaidLedger(word(), T);
  for (let i = 0; i < RAID_ACCOUNTS_MAX; i++) foldRaidWord(full, `acct-${i}`, `P${i}`, word(), T);
  assert.deepEqual(foldRaidWord(full, 'acct-late', 'Late', word({ n: 1 }), T + 60_000), { credited: 0, known: false }, 'a full ledger records no newcomer');
  assert.deepEqual(foldRaidWord(full, 'acct-0', 'P0', word({ n: 1 }), T + 60_000), { credited: 1, known: true }, 'and keeps counting those it has');
});

test('RAID3 law: WHO EARNED IT - struck a raider (said), and said so from the town within RAID_PRESENT_MS of the cleanse; the names said are the earners with the most deaths first, then by name, three at most (mutants: the strike or the presence not asked; the window off; the order reversed)', () => {
  const T = 5_000_000;
  const led = newRaidLedger(word(), T);
  led.a = {
    'acct-a': { nm: 'Ann', n: 2, s: 1, last: T },
    'acct-b': { nm: 'Bran', n: 0, s: 1, last: T - RAID_PRESENT_MS },
    'acct-c': { nm: 'Cora', n: 3, s: 0, last: T },
    'acct-d': { nm: 'Dag', n: 5, s: 1, last: T - RAID_PRESENT_MS - 1 },
    'acct-e': { nm: 'Eve', n: 2, s: 1, last: T },
    'acct-f': { nm: '', n: 9, s: 1, last: T },
    'acct-g': { nm: 'Abe', n: 2, s: 1, last: T },
  };
  const earned = raidEarned(led, T);
  assert.deepEqual(earned.map(([k]) => k), ['acct-a', 'acct-b', 'acct-e', 'acct-f', 'acct-g'], 'not the one who never struck, nor the one gone quiet');
  assert.deepEqual(raidTop(earned), ['Abe', 'Ann', 'Eve'], 'the most deaths first, then by name; a nameless one unsaid');
  assert.equal(RAID_TOP_MAX, 3);
});

// ═══ THE RECEIPT ═════════════════════════════════════════════════════════════════════════════════

test('RAID3 receipt: minted by the relay\'s one key and verified by its public half; unsigned is a real answer; never a gate\'s receipt nor an identity, whichever verifier is asked; refused, never repaired (mutants: the version not read first; a foreign claim let through; the expiry or the future ignored)', async () => {
  const kp = await keypair();
  const nowS = 1_900_000_000;
  const r = await mintRaidReceipt({ w: KEY, s: 'acct-peer-0001', c: 1234, y: 2 }, kp.privateKey, { subtle, nowS });
  assert.ok(r.startsWith(`${RAID_RECEIPT_V}.`) && r.length <= RAID_RECEIPT_MAX);
  const v = await verifyRaidReceipt(r, kp.publicKey, { subtle, nowS });
  assert.equal(v.ok, true);
  assert.deepEqual(v.claims, { w: KEY, s: 'acct-peer-0001', c: 1234, y: 2, i: nowS, e: nowS + RAID_RECEIPT_TTL_S });
  assert.deepEqual(readRaidReceipt(r), { ...v.claims, signed: true });
  const bare = await mintRaidReceipt({ w: KEY, s: 'acct-peer-0001', c: 1, y: 0 }, null, { subtle, nowS });
  assert.ok(bare.endsWith('.'));
  assert.equal(readRaidReceipt(bare).signed, false, 'the client reads an unsigned one');
  assert.deepEqual(await verifyRaidReceipt(bare, kp.publicKey, { subtle, nowS }), { ok: false, why: 'unsigned' }, 'the service declines it');
  // one key, two things, never confused
  const gate = await mintReceipt({ d: 5, b: 'ruhn', s: 'acct-peer-0001', c: 1, x: 'dealt' }, kp.privateKey, { subtle, nowS });
  assert.deepEqual(await verifyRaidReceipt(gate, kp.publicKey, { subtle, nowS }), { ok: false, why: 'version' });
  assert.equal(readRaidReceipt(gate), null);
  assert.deepEqual(await verifyReceipt(r, kp.publicKey, { subtle, nowS }), { ok: false, why: 'version' }, 'the gate\'s verifier refuses a raid\'s');
  assert.equal(readReceipt(r), null);
  assert.equal((await verifyToken(r, kp.publicKey, { subtle, nowS })).ok, false, 'and it is no identity');
  const ident = await mintToken({ s: 'acct-peer-0001', n: 'Ann', k: 'guest' }, kp.privateKey, { subtle, nowS });
  assert.deepEqual(await verifyRaidReceipt(ident, kp.publicKey, { subtle, nowS }), { ok: false, why: 'version' });
  // the body's own bytes are what was signed
  const [vv, body, sig] = r.split('.');
  const forged = JSON.parse(Buffer.from(body, 'base64url').toString());
  forged.c = 9999;
  assert.deepEqual(await verifyRaidReceipt(`${vv}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}`, kp.publicKey, { subtle, nowS }), { ok: false, why: 'signature' });
  assert.deepEqual(await verifyRaidReceipt(r, kp.publicKey, { subtle, nowS: nowS + RAID_RECEIPT_TTL_S }), { ok: false, why: 'expired' });
  assert.deepEqual(await verifyRaidReceipt(r, kp.publicKey, { subtle, nowS: nowS - 3600 }), { ok: false, why: 'future' });
  // the claims' own law
  const good = { w: KEY, s: 'acct-peer-0001', c: 0, y: 0, i: nowS, e: nowS + 60 };
  assert.ok(raidReceiptValid(good));
  for (const bad of [{ n: 'x' }, { k: 'guest' }, { t: 'founder' }, { o: 'mute' }, { d: 5 }, { b: 'ruhn' }, { w: '3:7' }, { s: 'x' }, { c: 2 ** 32 }, { y: RAID_TYPES }, { e: nowS }, { e: nowS + RAID_RECEIPT_TTL_S + 1 }]) {
    assert.equal(raidReceiptValid({ ...good, ...bad }), false, JSON.stringify(bad));
  }
  await assert.rejects(() => mintRaidReceipt({ w: 'junk', s: 'acct-peer-0001', c: 1, y: 0 }, null, { subtle, nowS }), /refused a claim set/);
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════

test('RAID3 wire: a word is projected - its fields, bounded, nothing else; a frame of the room\'s is projected for the client by its kind; the relay that keeps a raid is named by its version, and this build\'s is one (mutants: a bound off by one; the relay floor above this build\'s)', async () => {
  assert.deepEqual(RAID_KINDS, ['w']);
  assert.deepEqual(RAID_OUT_KINDS, ['st', 'cl', 'rc', 'cls', 'tw'], 'RAID-ROLL: `tw` the hub asking for the towns table');
  assert.deepEqual(validRaidIn({ ...word({ n: 3, s: 1 }), junk: 1 }), word({ n: 3, s: 1 }));
  assert.deepEqual(validRaidIn({ ...word(), s: undefined }), word({ s: 0 }));
  for (const bad of [{ k: 'x' }, { key: '3:7' }, { st: -1 }, { st: 1.5 }, { tg: RAID_TARGET_MIN - 1 }, { tg: RAID_TARGET_MAX + 1 }, { ty: RAID_TYPES }, { px: 1000 }, { py: 500 }, { px: -1 }, { n: RAID_WORD_KILLS_MAX + 1 }, { n: -1 }, { s: 2 }]) {
    assert.equal(validRaidIn(word(bad)), null, JSON.stringify(bad));
  }
  assert.equal(validRaidIn(word({ tg: RAID_TARGET_MAX, ty: RAID_TYPES - 1, px: 999, py: 499, n: RAID_WORD_KILLS_MAX })).n, RAID_WORD_KILLS_MAX, 'every top end is in');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'raid', ...word() })), { error: 'raid before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'raid', ...word({ n: -1 }) }), { hasHello: true }), { error: 'bad raid' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'raid', ...word() }), { hasHello: true }), { t: 'raid', ...word() });
  // out
  const g = G();
  assert.deepEqual(validRaidOut({ k: 'st', key: KEY, n: 3, tg: 15, st: ST, c: 0, g, x: 1 }), { k: 'st', key: KEY, n: 3, tg: 15, st: ST, c: 0, g });
  assert.equal(validRaidOut({ k: 'st', key: KEY, n: 16, tg: 15, st: ST, c: 0, g }), null, 'a count past its target');
  assert.equal(validRaidOut({ k: 'st', key: KEY, n: 3, tg: 14, st: ST, c: 0, g }), null, 'a target the roll never makes');
  assert.equal(validRaidOut({ k: 'st', key: KEY, n: 3, tg: 15, st: ST, c: -1, g }), null);
  assert.equal(validRaidOut({ k: 'st', key: KEY, n: 3, tg: 15, st: ST, c: 0 }), null, 'AUDIT RAID R1: no word of a raid without its signature');
  assert.equal(validRaidOut({ k: 'st', key: KEY, n: 3, tg: 15, st: ST, c: 0, g: 'x.1' }), null);
  assert.deepEqual(validRaidOut({ k: 'cl', key: KEY, at: 7, top: ['Ann', 5, '', 'Bran', 'Cora', 'Dag'], n: 4, g }), { k: 'cl', key: KEY, at: 7, top: ['Ann'], n: 4, g }, 'three names at most, then cleaned (the gate\'s own order - bounded before any work)');
  assert.equal(validRaidOut({ k: 'cl', key: KEY, at: 0, top: [], n: 1, g }), null);
  assert.equal(validRaidOut({ k: 'cl', key: KEY, at: 7, top: [], n: RAID_ACCOUNTS_MAX + 1, g }), null);
  assert.equal(validRaidOut({ k: 'cl', key: KEY, at: 7, top: [], n: 1 }), null, 'nor a cleanse');
  assert.deepEqual(validRaidOut({ k: 'cls', l: [[KEY, 9, g], ['junk', 9, g], [KEY, 0, g], [KEY, 9], 'x'] }), { k: 'cls', l: [[KEY, 9, g]] });
  assert.equal(validRaidOut({ k: 'cls', l: Array.from({ length: RAID_CLEANS_MAX + 5 }, () => [KEY, 1, g]) }).l.length, RAID_CLEANS_MAX);
  const kp = await keypair();
  const rc = await mintRaidReceipt({ w: KEY, s: 'acct-peer-0001', c: 5, y: 1 }, kp.privateKey, { subtle, nowS: 1_900_000_000 });
  assert.deepEqual(validRaidOut({ k: 'rc', r: rc }), { k: 'rc', r: rc }, 'the wire takes what the relay mints');
  assert.equal(validRaidOut({ k: 'rc', r: 'r1.abc.def' }), null, 'never a gate\'s');
  assert.equal(RAID_RECEIPT_WIRE_MAX, RAID_RECEIPT_MAX);
  assert.equal(validRaidOut({ k: 'dance' }), null);
  // the relay's number
  assert.equal(relaySupportsRaid(`world${RAID_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsRaid(`world${RAID_RELAY_MIN}`), true);
  assert.equal(relaySupportsRaid('junk'), false);
  assert.ok(relaySupportsRaid(RELAY_VERSION), 'this build\'s relay keeps raids');
  // a pose's map pixel is the cell's own arithmetic
  const p = { x: PX * PIXEL_UNITS + 5, z: (499 - PY) * PIXEL_UNITS + 5 };
  assert.deepEqual(mapPixelOfWire(p.x, p.z), [PX, PY]);
  assert.equal(cellRoomOfWire(p.x, p.z), CELL);
  let b = null, pass = 0;
  for (let i = 0; i < RAID_HZ_MAX + 3; i++) { const g = raidGate(b, 1000); b = g.bucket; if (g.pass) pass++; }
  assert.equal(pass, RAID_HZ_MAX, 'RAID_HZ_MAX at once');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════

const T0 = wallMsForClassicMinutes(ST + 10);   // ten game minutes into the raid
const ON = { x: PX * PIXEL_UNITS + 16384, y: 0, z: (499 - PY) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };
const OFF = { ...ON, x: ON.x + PIXEL_UNITS };   // the next pixel east, the same cell
const raids = (ws, k) => ws.sent.filter((m) => m.t === 'raid' && (!k || m.k === k));
async function withRaid(fn, { start = T0 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const r = world.room(CELL);
  const say = (ws, o = {}) => r.raw(ws, JSON.stringify({ t: 'raid', ...word(o) }));
  try { await fn({ world, r, say, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}

test('RAID3 relay: A WORD in the town\'s cell makes the raid\'s ledger and is answered with it - AUDIT RAID R1: the raid is its whole tuple, so a word naming another target, party or start is ANOTHER raid, never folded into this one; the ledger is written and the cell\'s alarm armed for its end (mutants: the ledger keyed by the key alone; the answer unsaid; the ledger unwritten; no alarm)', async () => {
  await withRaid(async ({ r, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, B);
    assert.deepEqual(raids(a), [{ t: 'raid', k: 'st', key: KEY, n: 0, tg: B.tg, st: B.st, c: 0, g: G(B) }]);
    await say(a, C);
    assert.deepEqual(raids(a).at(-1), { t: 'raid', k: 'st', key: KEY, n: 0, tg: C.tg, st: C.st, c: 0, g: G(C) }, 'another tuple: another raid, its own ledger');
    assert.equal(r.store.get(LED(C)).st, C.st);
    const kept = r.store.get(LED(B));
    assert.equal(kept.tg, B.tg); assert.equal(kept.ty, B.ty); assert.equal(kept.px, PX); assert.equal(kept.first, T0);
    assert.equal(r.alarm.at, wallMsForClassicMinutes(C.st + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES) + RAID_KEEP_MS, 'the sooner ledger\'s end');
    assert.ok(kept.a['acct-peer-0001'], 'the VERIFIED account is on it');
    assert.equal(kept.by, 'acct-peer-0001', 'and made it (AUDIT RAID R3: a speaker\'s places are bounded)');
  });
});

test('RAID3 relay: WHAT IT CHECKS - a word said in another cell or another kind of room is junk, and one no day could roll (AUDIT RAID R6); one outside its raid\'s time is kept nowhere and answered nothing; one from a pose off the town\'s pixel makes no raid (AUDIT RAID R1) and, the raid made, is answered but counts nothing and names nobody; a flood is struck out (mutants: the cell not asked; the pose not asked; a raid made off the town; the window not asked)', async () => {
  await withRaid(async ({ world, r, say, set, step }) => {
    const other = world.room(worldRoom(PX + 16, PY));
    const x = other.connect(); await other.hello(x, 'peer-0009', ON);
    await other.raw(x, JSON.stringify({ t: 'raid', ...word({ n: 1 }) }));
    assert.equal(x.meters.junk, 1, 'the town is not in this cell');
    assert.equal(other.store.size === 0 || ![...other.store.keys()].some((k) => k.startsWith('raid:')), true);
    const place = world.room('dungeon:m123456');
    const y = place.connect(); await place.hello(y, 'peer-0008', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 });
    await place.raw(y, JSON.stringify({ t: 'raid', ...word() }));
    assert.equal(y.meters.junk, 1, 'no raid in a dungeon');
    const a = r.connect(); await r.hello(a, 'peer-0001', OFF);
    await say(a, { n: 2, s: 1 });
    assert.deepEqual(raids(a), [], 'off the town\'s pixel no raid is made - and nothing said');
    assert.equal(r.store.has(LED()), false);
    await r.pose(a, ON);
    await say(a, { n: 2, s: 1 });
    assert.equal(raids(a).at(-1).n, 2, 'on the town it is made, and it counts');
    const b = r.connect(); await r.hello(b, 'peer-0005', OFF);
    await say(b, { n: 5, s: 1 });
    assert.deepEqual(raids(b), [{ t: 'raid', k: 'st', key: KEY, n: 2, tg: 15, st: ST, c: 0, g: G() }], 'made, a word off the town is answered - and counts nothing');
    assert.deepEqual(Object.keys(r.store.get(LED()).a), ['acct-peer-0001'], 'and names nobody');
    const junk = a.meters.junk ?? 0;
    step(1000);   // the raid meter's own second
    await say(a, { st: D * RAID_DAY_MINUTES + RAID_START_LAST + 1 });
    assert.equal(a.meters.junk, junk + 1, 'a start past its key\'s day: no day rolls that raid');
    set(wallMsForClassicMinutes(ST + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES));
    const had = raids(a).length;
    await say(a, { n: 3 });
    assert.equal(raids(a).length, had, 'past its time: nothing said back');
    assert.equal(r.store.get(LED()).n, 2, 'and nothing counted');
    assert.equal(a.meters.junk, junk + 1, 'a clock at the window\'s edge is dropped, never struck');
    await say(a, { n: 3, ...N });
    assert.equal(raids(a).at(-1).g, G(N), 'a word naming a later start is another raid - its own window, its own ledger');
    assert.equal(r.store.get(LED()).n, 2, 'the first untouched');
    const fresh = world.room(worldRoom(PX, PY + 32));
    const z = fresh.connect(); await fresh.hello(z, 'peer-0007', { ...ON, z: (499 - PY - 32) * PIXEL_UNITS + 16384 });
    await fresh.raw(z, JSON.stringify({ t: 'raid', ...word({ py: PY + 32, key: `3:8:${D}` }) }));
    assert.equal([...fresh.store.keys()].some((k) => k.startsWith('raid:')), false, 'a raid whose time is over is never made');
    const f = r.connect(); await r.hello(f, 'peer-0002', ON);
    for (let i = 0; i < RAID_HZ_MAX + DROP_STRIKES_MAX + 2; i++) await say(f);
    assert.ok(f.closed, 'a flood is struck out by the raid meter');
  });
});

test('RAID3 relay: THE COUNT - each account\'s deaths, the most it has said, credited as fast as raiders stand, and fanned to everyone in the cell when it moves; a word that moves nothing is answered to its speaker alone (mutants: the fan unsaid; the speaker unanswered; the cap not asked)', async () => {
  await withRaid(async ({ r, say: said, step }) => {
    const say = (ws, o = {}) => said(ws, { ...B, ...o });   // AUDIT RAID R1: every word of the one raid names its whole tuple
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { n: 9 });
    assert.equal(raids(a).at(-1).n, RAID_KILLS_BURST, 'nine said at the first word: the burst believed');
    assert.equal(raids(b).at(-1).n, RAID_KILLS_BURST, 'and the whole cell told');
    const heard = raids(b).length;
    await say(a, { n: 9 });
    assert.equal(raids(b).length, heard, 'the same again moves nothing - said to its speaker alone');
    assert.equal(raids(a).at(-1).n, RAID_KILLS_BURST);
    step(4 * RAID_KILL_MS);
    await say(a, { n: 9 });
    assert.equal(raids(b).at(-1).n, RAID_KILLS_BURST + 4, 'four seconds on, four more');
    await say(b, { n: 2 });
    assert.equal(raids(a).at(-1).n, RAID_KILLS_BURST + 4, 'the cap is the RAID\'s: a second share waits for it too');
    step(2 * RAID_KILL_MS);
    await say(b, { n: 2 });
    assert.equal(raids(a).at(-1).n, RAID_KILLS_BURST + 4 + 2, 'a second owner\'s share sums');
    assert.equal(r.store.get(LED(B)).n, 9, 'written as it moves');
  });
});

test('RAID3 relay: THE CLEANSE, said once - `cl` to everyone in the cell naming who held it, a receipt to exactly the accounts that struck and stood there (signed by GATE_SIGNING_KEY, which its public half verifies), the ledger written WITH them first; after it a word is answered with the cleanse and its speaker\'s receipt again, and counts nothing (mutants: a receipt to a player who never struck, or one gone quiet; the receipts unkept; said twice)', async () => {
  const kp = await keypair();
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  await withRaid(async ({ r, say, step, now }) => {
    r.env.GATE_SIGNING_KEY = pkcs8;
    const a = r.connect(), b = r.connect(), c = r.connect(), d = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON); await r.hello(c, 'peer-0003', ON); await r.hello(d, 'peer-0004', ON);
    // AUDIT WB A10's law: the ledger is written with its cleanse and receipts BEFORE a word of it is said - read off what
    // was PUT (this fake keeps a reference, where the runtime keeps a copy), at the moment the cleanse reaches a socket
    let written = null, keptWhenSaid = null;
    const put = r.state.storage.put;
    r.state.storage.put = async (k, v) => { const o = typeof k === 'object' ? k : { [k]: v }; if (o[LED()]) written = JSON.parse(JSON.stringify(o[LED()])); return put(k, v); };
    const send = c.send;
    c.send = function (s) { const m = JSON.parse(s); if (m.t === 'raid' && m.k === 'cl') keptWhenSaid = !!(written?.cl && Object.keys(written.rc).length === 2); return send.call(this, s); };
    await say(d, { s: 1 });   // struck, and then went quiet
    step(RAID_PRESENT_MS + 1000);
    await say(c, {});         // stands there and never strikes
    await say(b, { s: 1 });   // strikes, owns nothing
    await say(a, { n: 15, s: 1 });   // the runner: its raiders' deaths reach the target
    const cl = raids(c, 'cl');
    assert.equal(cl.length, 1, 'said once');
    assert.equal(keptWhenSaid, true, 'written before it was said');
    assert.deepEqual(cl[0], { t: 'raid', k: 'cl', key: KEY, at: now(), top: ['peer-0001', 'peer-0002'], n: 2, g: G() });
    assert.equal(raids(a, 'rc').length, 1); assert.equal(raids(b, 'rc').length, 1);
    assert.equal(raids(c, 'rc').length, 0, 'stood there, never struck');
    assert.equal(raids(d, 'rc').length, 0, 'struck, and was not there at the end');
    const ra = raids(a, 'rc')[0].r;
    const v = await verifyRaidReceipt(ra, kp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.equal(v.ok, true);
    assert.equal(v.claims.s, 'acct-peer-0001'); assert.equal(v.claims.w, KEY); assert.equal(v.claims.y, A.ty);
    const kept = r.store.get(LED());
    assert.deepEqual(Object.keys(kept.rc).sort(), ['acct-peer-0001', 'acct-peer-0002'], 'kept with the ledger');
    assert.equal(kept.cl.at, now());
    await say(a, { n: 19 });
    assert.deepEqual(raids(a).slice(-2), [{ t: 'raid', k: 'st', key: KEY, n: 15, tg: 15, st: ST, c: now(), g: G() }, { t: 'raid', k: 'rc', r: ra }], 'answered with the cleanse and its receipt again');
    await say(c, { n: 3, s: 1 });
    assert.equal(raids(c, 'rc').length, 0, 'a strike after the cleanse earns nothing');
    assert.equal(raids(c, 'cl').length, 1, 'and it is not said again');
  });
});

test('RAID3 relay: ONE CLEANSE, whatever lands while it is minted - a Durable Object\'s input gate holds for storage alone, and the receipts await the key and the signature; a word that lands meanwhile is not heard, and the cleanse is said once (mutants: the guard gone - two cleanses, two receipts an account)', async () => {
  await withRaid(async ({ r, say, step }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { s: 1 });
    step(20_000);
    await say(b, { s: 1 });   // b stands there at the cleanse
    let release = null;
    const held = new Promise((res) => { release = res; });
    const keyOf = r.room._receiptKeyOf.bind(r.room);
    r.room._receiptKeyOf = async () => { await held; return keyOf(); };
    const first = say(a, { n: 15, s: 1 });   // the count meets the target: the cleanse begins, and waits on the key
    await new Promise((res) => setImmediate(res));
    const second = say(b, { n: 4, s: 1 });   // lands mid-mint
    await new Promise((res) => setImmediate(res));
    release();
    await Promise.all([first, second]);
    assert.equal(raids(a, 'cl').length, 1, 'said once');
    assert.equal(raids(b, 'rc').length, 1, 'one receipt an account');
    assert.equal(r.store.get(LED()).n, 15, 'nothing counted past the cleanse');
  });
});

test('RAID3 relay: KEPT WHEN EVERYONE LEAVES - the count outlives every socket in the cell and the object\'s own sleep, and the next player to walk in fights on from it (Mac: "kept even if everyone leaves") (mutants: the ledger unread from storage; the instance\'s copy trusted over none)', async () => {
  await withRaid(async ({ r, say, step }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, { ...B, n: 3, s: 1 });
    await r.drop(a);
    r.wake();   // the object slept: a fresh instance over the same storage
    step(30_000);
    const b = r.connect(); await r.hello(b, 'peer-0002', ON);
    await say(b, B);
    assert.equal(raids(b).at(-1).n, 3, 'the count the town kept');
    await say(b, { ...B, n: 4 });
    assert.equal(raids(b).at(-1).n, 7, 'and it counts on from there');
  });
  // a ledger kept AT its target with no cleanse stamped (its count written, the object gone before its cleanse was)
  await withRaid(async ({ r, say, step }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, { s: 1 });
    const kept = r.store.get(LED());
    r.store.set(LED(), JSON.parse(JSON.stringify({ ...kept, n: kept.tg })));
    r.wake();
    step(1000);
    await say(a, { s: 1 });
    assert.equal(raids(a, 'cl').length, 1, 'the next word finds it at its target and stamps the cleanse - nothing credited, nothing needed');
  });
});

test('RAID3 relay: THE HUB - told of every cleanse, it says it to everyone online once and keeps it for a hello while its day is today or yesterday; a cell whose hub did not answer tells it again on its alarm (mutants: the hub untold; told twice; the hello\'s list unsaid; a failed tell never retried)', async () => {
  await withRaid(async ({ world, r, say, now, set, step }) => {
    const hub = world.room(SOCIAL_ROOM);
    const h1 = hub.connect(); await hub.hello(h1, 'peer-0009');
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, { s: 1 });
    step(20_000);   // raiders stand one a second
    await say(a, { n: 15, s: 1 });
    assert.deepEqual(raids(h1, 'cl'), [{ t: 'raid', k: 'cl', key: KEY, at: now(), top: ['peer-0001'], n: 1, g: G() }], 'everyone online hears it');
    assert.equal(r.store.get(LED()).told, true);
    await hub.room._raidCleanInternal(new Request('https://relay.internal/internal/raid/clean', { method: 'POST', body: JSON.stringify({ key: KEY, at: now(), top: [], n: 1, g: G() }) }));
    assert.equal(raids(h1, 'cl').length, 1, 'told again, not said again');
    const late = hub.connect(); await hub.hello(late, 'peer-0008');
    assert.deepEqual(raids(late, 'cls'), [{ t: 'raid', k: 'cls', l: [[KEY, now(), G()]] }], 'a later hello is told the day\'s cleanses');
    set(wallMsForClassicMinutes((D + 2) * RAID_DAY_MINUTES + 5));
    const later = hub.connect(); await hub.hello(later, 'peer-0007');
    assert.deepEqual(raids(later, 'cls'), [], 'two days on it is let go');
  });
  // a hub that does not answer
  await withRaid(async ({ world, r, say, now, step }) => {
    let answer = false;
    const env = r.env;
    env.ROOMS = { idFromName: (n) => n, get: (id) => ({ fetch: async (req) => (answer ? world.room(id).room.fetch(req) : new Response('no', { status: 503 })) }) };
    const hub = world.room(SOCIAL_ROOM);
    const h1 = hub.connect(); await hub.hello(h1, 'peer-0009');
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, { s: 1 });
    step(20_000);
    await quiet(() => say(a, { n: 15, s: 1 }));
    assert.equal(raids(h1, 'cl').length, 0);
    assert.equal(r.store.get(LED()).told, false);
    assert.equal(r.alarm.at, now() + RAID_TELL_RETRY_MS, 'told again soon');
    answer = true;
    step(RAID_TELL_RETRY_MS);
    await r.fire();
    assert.equal(raids(h1, 'cl').length, 1, 'the alarm told it');
    assert.equal(r.store.get(LED()).told, true);
    assert.equal(r.alarm.at, wallMsForClassicMinutes(ST + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES) + RAID_KEEP_MS, 'and the next thing owed is the ledger\'s end');
  });
});

test('RAID3 relay: THE END - the cell\'s alarm forgets a ledger past its end; a new raid in a full cell takes the place of the stalest one nobody is fighting (AUDIT RAID R3: never a cleansed one, never one fought within RAID_LEDGER_BUSY_MS) (mutants: the ledger kept for ever; the cell unbounded)', async () => {
  await withRaid(async ({ r, say, set }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, { n: 1 });
    const end = r.alarm.at;
    set(end);
    await r.fire();
    assert.equal(r.store.has(LED()), false, 'forgotten at its end');
    assert.equal(await r.room._raidSweep(end + 1), false, 'and the cell keeps no raid now');
  });
  await withRaid(async ({ r, step }) => {
    for (let i = 0; i <= RAID_LEDGERS_MAX; i++) {   // a speaker a raid - AUDIT RAID R3: one holds two places at most
      const a = r.connect(); await r.hello(a, `peer-00${10 + i}`, ON);
      if (i === RAID_LEDGERS_MAX) step(RAID_LEDGER_BUSY_MS);   // nobody has fought the first eight since
      await r.raw(a, JSON.stringify({ t: 'raid', ...word({ key: `3:${10 + i}:${D}` }) }));
      step(1000);
    }
    const kept = [...r.store.keys()].filter((k) => k.startsWith('raid:')).sort();
    assert.equal(kept.length, RAID_LEDGERS_MAX);
    assert.ok(!kept.includes(LED({ key: `3:10:${D}` })), 'the stalest made way');
    assert.ok(kept.includes(LED({ key: `3:${10 + RAID_LEDGERS_MAX}:${D}` })));
  });
});

// ═══ THE SESSION ═════════════════════════════════════════════════════════════════════════════════

function sessionRig(room, relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onRaid = (f, r) => got.push({ f, r });
  quiet(() => s.join(room, { x: ON.x / 1, y: 0, z: ON.z / 1, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'raid');
  return { s, ws, got, out, tick: (ms) => { t += ms; } };
}

test('RAID3 session: a word goes only to a relay that keeps raids, only down the town cell\'s own socket, through the wire\'s projection, RAID_HZ_MAX a second; a cell\'s and the hub\'s words come in projected, each kind only from the room that says it - AUDIT RAID R2: a receipt from the hub too (mutants: an old relay sent the frame that closes its socket; the cell not asked; a hub\'s list let in from a cell)', () => {
  const old = sessionRig(CELL, 'world122');
  assert.equal(old.s.raidOk, false);
  assert.equal(old.s.sendRaid(word(), CELL), false);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  const { s, ws, got, out, tick } = sessionRig(CELL);
  assert.equal(s.raidOk, true);
  assert.equal(s.sendRaid({ ...word(), junk: 1 }, CELL), true);
  assert.deepEqual(out().at(-1), { t: 'raid', ...word() }, 'the projection, not the caller\'s object');
  assert.equal(s.sendRaid(word(), worldRoom(PX + 48, PY)), false, 'no socket in that cell');
  assert.equal(s.sendRaid(word(), 'dungeon:m1'), false);
  assert.equal(s.sendRaid(word({ n: -1 }), CELL), false, 'the wire\'s own law first');
  for (let i = 1; i < RAID_HZ_MAX; i++) assert.equal(s.sendRaid(word(), CELL), true);
  assert.equal(s.sendRaid(word(), CELL), false, 'RAID_HZ_MAX a second');
  tick(1000);
  assert.equal(s.sendRaid(word(), CELL), true);
  ws.receive({ t: 'raid', k: 'st', key: KEY, n: 2, tg: 15, st: ST, c: 0, g: G(), junk: 1 });
  ws.receive({ t: 'raid', k: 'cls', l: [[KEY, 5, G()]] });
  ws.receive({ t: 'raid', k: 'st', key: KEY, n: 16, tg: 15, st: ST, c: 0, g: G() });
  assert.deepEqual(got, [{ f: { k: 'st', key: KEY, n: 2, tg: 15, st: ST, c: 0, g: G() }, r: CELL }], 'a hello\'s list is the hub\'s word, and a count past its target no word at all');
  const hub = sessionRig(SOCIAL_ROOM);
  hub.ws.receive({ t: 'raid', k: 'cl', key: KEY, at: 5, top: ['Ann'], n: 1, g: G() });
  hub.ws.receive({ t: 'raid', k: 'cls', l: [[KEY, 5, G()]] });
  hub.ws.receive({ t: 'raid', k: 'rc', r: 'w1.abc.' });
  hub.ws.receive({ t: 'raid', k: 'st', key: KEY, n: 2, tg: 15, st: ST, c: 0, g: G() });
  assert.deepEqual(hub.got.map((g) => g.f.k), ['cl', 'cls', 'rc'], 'the hub says cleanses, and hands an earner\'s receipt (AUDIT RAID R2); a ledger is a cell\'s');
});

// ═══ THE RAID, ON THE CLIENT ═════════════════════════════════════════════════════════════════════

const CDAY = 400;
const CAT = (min) => CDAY * MINUTES_PER_DAY + min;
const CKEY = `3:7:${CDAY}`;
const raidRec = (o = {}) => ({
  regionIndex: 3, locationIndex: 7, startDay: CDAY, locationName: 'Gothway Garden', type: 2,
  startMinute: CAT(600), endMinute: CAT(720), killed: 0, attackAmount: 3, cleansed: false,
  announced: true, struck: false, px: 200, py: 100, ...o,
});
/** AUDIT RAID R1: a held raid's signature - the tuple the day's roll made it. */
const CG = (o = {}) => { const r = raidRec(o); return raidSig({ st: r.startMinute, tg: r.attackAmount, ty: r.type, px: r.px, py: r.py }); };
/** RAID2's rig, at a relay that keeps raids: the words said are recorded, and the session may refuse one. */
function rig({ relay = true } = {}) {
  const at = { now: CAT(610), wall: 100000, me: 'mmm-0002', inTown: [], puppets: [], own: [], town: { regionIndex: 3, locationIndex: 7 }, pixel: { x: 200, y: 100 }, region: 3, roll: 0, allowed: true, relay, accept: true };
  const log = { said: [], raiders: [], defenders: [], words: [], receipts: [] };
  const player = { legalRep: {} };
  let seq = 0;
  const foe = (mobileType) => ({ mobileType, dead: false, corpse: false, entity: { health: 10 }, ai: { feet: [seq, 0, 0] }, uid: ++seq });
  setRaidingPartiesHost({
    now: () => at.now, random: () => at.roll, wallNow: () => at.wall, selfId: () => at.me, maps: () => null, picker: () => null,
    regionIndex: () => at.region, regionName: (r) => `Region${r}`, townHere: () => at.town, playerPixel: () => at.pixel,
    peersInTown: () => at.inTown, raidPuppets: () => at.puppets, ownRaidFoes: () => at.own,
    standRaider: (mt) => { const f = foe(mt); log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => { const g = foe(146); g.defender = true; log.defenders.push(g); return Promise.resolve(g); },
    defenderCount: () => log.defenders.filter((g) => !g.dead).length, defendersAllowed: () => at.allowed,
    removeFoe: (f) => { f.dead = true; }, outOfSight: () => true,
    reputation: () => ({ player, store: { dict: new Map() } }), say: (line) => log.said.push(line),
    relayRaids: () => at.relay, sendRaid: (w, cell) => { if (!at.accept) return false; log.words.push({ w, cell }); return true; },
    onRaidReceipt: (r, c) => log.receipts.push({ r, c }),
  });
  return { at, log, player };
}
const tick = () => new Promise((res) => setImmediate(res));

beforeEach(() => {
  _resetRaidingParties();
  _resetRenownKillsForTests();
  _resetModSettings();
  setSharedClock(null);
});

test('RAID3 client: standing in a raided town at a relay that keeps raids, I say my word to the town\'s cell - the raid as the roll made it, my raiders\' deaths, my strike - at once when either moves, else every RAID_WORD_MS; a word the session refused is said again; nothing at an older relay, offline, or out of the town (mutants: the word unsaid; said every frame; the cell miscounted; a refused word taken as said)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: CDAY, raids: [raidRec({ killed: 1 })] });
  setSharedClock(() => at.now);
  assert.equal(raidRelayOn(), true);
  frame(1);
  assert.deepEqual(log.words, [{ w: { k: 'w', key: CKEY, st: CAT(600), tg: 3, ty: 2, px: 200, py: 100, n: 1, s: 0 }, cell: worldRoom(200, 100) }]);
  frame(1);
  assert.equal(log.words.length, 1, 'nothing new to say');
  raidState().raids[0].struck = true;
  frame(1);
  assert.equal(log.words.at(-1).w.s, 1, 'my strike, at once');
  at.wall += RAID_WORD_MS;
  frame(1);
  assert.equal(log.words.length, 3, 'and again every RAID_WORD_MS');
  at.accept = false;
  raidState().raids[0].killed = 2;
  frame(1);
  at.accept = true;
  frame(1);
  assert.equal(log.words.at(-1).w.n, 2, 'a word the session refused is said again');
  const n = log.words.length;
  at.town = null;
  frame(1);
  assert.equal(log.words.length, n, 'out of the town: nothing');
  at.town = { regionIndex: 3, locationIndex: 7 };
  at.relay = false;
  at.wall += RAID_WORD_MS;
  frame(1);
  assert.equal(log.words.length, n, 'an older relay: nothing');
  at.relay = true;
  setSharedClock(null);
  frame(1);
  assert.equal(log.words.length, n, 'offline: nothing');
  await tick();
});

test('RAID3 client: at a relay that keeps raids the raid\'s cleanse is the relay\'s - my own deaths reaching the target cleanse nothing; its `cl` from the town\'s cell closes the raid, says the mod\'s line with who held the town, and pays RAID1\'s reward by RAID1\'s law (mutants: the local count still cleansing; the defenders unsaid; the reward paid without the strike)', async () => {
  const { at, log, player } = rig();
  restoreSaveData({ lastSelectedDay: CDAY, raids: [raidRec({ attackAmount: 1 })] });
  setSharedClock(() => at.now);
  at.allowed = false;
  frame(1);   // a raider in flight
  await tick();
  const f = log.raiders[0];
  renownFoeStruck(f, 1);
  f.dead = true; f.corpse = true;
  frame(1);
  assert.equal(raidState().raids[0].killed, 1, 'my raider\'s death is mine to say');
  assert.equal(raidState().raids[0].cleansed, false, 'and the relay\'s to count');
  assert.equal(raidKillTotal(raidState().raids[0]), 1);
  assert.equal(raidRelayWord({ k: 'cl', key: CKEY, at: 5, top: ['Mal'], n: 1, g: CG({ attackAmount: 25 }) }, worldRoom(200, 100)), false, 'AUDIT RAID R1: a cleanse of another tuple under my raid\'s key is not my raid\'s');
  assert.equal(raidState().raids[0].cleansed, false);
  raidRelayWord({ k: 'cl', key: CKEY, at: 5, top: ['Ann', 'Bran'], n: 4, g: CG({ attackAmount: 1 }) }, worldRoom(200, 100));
  const r = raidState().raids[0];
  assert.equal(r.cleansed, true);
  assert.equal(log.said.at(-1), `${cleansedLine('Gothway Garden', 'Region3', 2)} Defended by Ann, Bran and 2 others.`);
  assert.equal(player.legalRep[3], 5, 'struck, and on the pixel: RAID1\'s reward');
  assert.equal(raidRelayWord({ k: 'cl', key: CKEY, at: 5, top: [], n: 1, g: CG({ attackAmount: 1 }) }, worldRoom(200, 100)), false, 'said once');
  assert.equal(defendedLine([], 3), '');
  assert.equal(defendedLine(['Ann'], 1), 'Defended by Ann.');
  assert.equal(defendedLine(['Ann', 'Bran', 'Cora'], 3), 'Defended by Ann, Bran and Cora.');
  assert.equal(defendedLine(['Ann'], 2), 'Defended by Ann and 1 other.');
  // at an older relay RAID2's own law cleanses as it did
  _resetRaidingParties();
  const old = rig({ relay: false });
  restoreSaveData({ lastSelectedDay: CDAY, raids: [raidRec({ attackAmount: 1 })] });
  setSharedClock(() => old.at.now);
  old.at.allowed = false;
  frame(1);
  await tick();
  old.log.raiders[0].dead = true; old.log.raiders[0].corpse = true;
  frame(1);
  assert.equal(raidState().raids[0].cleansed, true, 'the owners\' shares cleanse it where the relay does not');
});

test('RAID3 client: a cleanse the hub says is said in its region to a player told of the raid, quietly anywhere else - and never said withdrawn after; a hello\'s list closes its raids quietly; a ledger that names a cleanse this machine missed closes it (mutants: every cleanse said Bay-wide; the list said aloud; the missed cleanse kept open)', () => {
  const { at, log } = rig();
  setSharedClock(() => at.now);
  restoreSaveData({ lastSelectedDay: CDAY, raids: [raidRec(), raidRec({ locationIndex: 8, locationName: 'Ashford', announced: false }), raidRec({ locationIndex: 9, locationName: 'Bracken' }), raidRec({ locationIndex: 10, locationName: 'Kirkbeth' })] });
  at.town = null;
  raidRelayWord({ k: 'cl', key: CKEY, at: 5, top: ['Ann'], n: 1, g: CG() }, SOCIAL_ROOM);
  assert.equal(log.said.at(-1), `${cleansedLine('Gothway Garden', 'Region3', 2)} Defended by Ann.`, 'told of it, in its region');
  const said = log.said.length;
  raidRelayWord({ k: 'cl', key: `3:8:${CDAY}`, at: 5, top: ['Ann'], n: 1, g: CG() }, SOCIAL_ROOM);
  assert.equal(log.said.length, said, 'never told of that one: closed quietly');
  assert.equal(raidState().raids[1].cleansed, true);
  at.region = 5;
  raidRelayWord({ k: 'cl', key: `3:9:${CDAY}`, at: 5, top: [], n: 0, g: CG() }, SOCIAL_ROOM);
  assert.equal(log.said.length, said, 'out of its region: quietly');
  raidRelayWord({ k: 'cls', l: [[`3:10:${CDAY}`, 5, CG({ attackAmount: 25 })]] }, SOCIAL_ROOM);
  assert.equal(raidState().raids[3].cleansed, false, 'AUDIT RAID R1: a hello\'s list names the tuple too - another\'s cleanse is not mine');
  raidRelayWord({ k: 'cls', l: [[`3:10:${CDAY}`, 5, CG()]] }, SOCIAL_ROOM);
  assert.equal(raidState().raids[3].cleansed, true);
  assert.equal(log.said.length, said, 'a hello\'s list is said by nobody');
  at.region = 3;
  at.now = CAT(730);
  frame(0);
  assert.ok(!log.said.some((l) => l === withdrawnLine('Gothway Garden', 'Region3') || l === withdrawnLine('Kirkbeth', 'Region3')), 'a cleansed raid never withdraws');
  // a ledger that names a cleanse I missed
  _resetRaidingParties();
  const b = rig();
  setSharedClock(() => b.at.now);
  restoreSaveData({ lastSelectedDay: CDAY, raids: [raidRec()] });
  assert.equal(raidRelayWord({ k: 'st', key: `9:9:${CDAY}`, n: 2, tg: 15, st: CAT(600), c: 0, g: CG() }, worldRoom(200, 100)), false);
  assert.equal(raidRelayState(`9:9:${CDAY}`), null, 'a raid this machine does not hold is not its to keep');
  assert.equal(raidRelayWord({ k: 'st', key: CKEY, n: 25, tg: 25, st: CAT(600), c: 77, g: CG({ attackAmount: 25 }) }, worldRoom(200, 100)), false, 'AUDIT RAID R1: nor another tuple\'s ledger under its key');
  assert.equal(raidState().raids[0].cleansed, false);
  raidRelayWord({ k: 'st', key: CKEY, n: 2, tg: 3, st: CAT(600), c: 0, g: CG() }, worldRoom(200, 100));
  assert.deepEqual(raidRelayState(CKEY), { n: 2, tg: 3, c: 0 });
  assert.equal(raidState().raids[0].cleansed, false);
  raidRelayWord({ k: 'st', key: CKEY, n: 3, tg: 3, st: CAT(600), c: 77, g: CG() }, worldRoom(200, 100));
  assert.equal(raidState().raids[0].cleansed, true, 'the town was cleansed while my link was down');
  assert.equal(b.log.said.at(-1), cleansedLine('Gothway Garden', 'Region3', 2));
});

test('RAID3 client: my receipt is kept, one a raid, and handed on once (RAID4 carries it); the same receipt again changes nothing, junk is refused, and the oldest go past RAID_RECEIPTS_KEPT (mutants: handed on twice; junk kept; unbounded)', async () => {
  const { log } = rig();
  const nowS = 1_900_000_000;
  const r1 = await mintRaidReceipt({ w: CKEY, s: 'acct-mmm-0002', c: 7, y: 2 }, null, { subtle, nowS });
  assert.equal(raidRelayWord({ k: 'rc', r: r1 }, worldRoom(200, 100)), true);
  assert.equal(raidReceipt(CKEY), r1);
  assert.equal(log.receipts.length, 1);
  assert.equal(log.receipts[0].c.c, 7, 'with its claims read');
  assert.equal(raidRelayWord({ k: 'rc', r: r1 }, worldRoom(200, 100)), false, 'the same again: a reconnect\'s echo');
  assert.equal(log.receipts.length, 1);
  assert.equal(raidRelayWord({ k: 'rc', r: 'w1.junk.' }, worldRoom(200, 100)), false);
  for (let i = 0; i < RAID_RECEIPTS_KEPT; i++) raidRelayWord({ k: 'rc', r: await mintRaidReceipt({ w: `3:${20 + i}:${CDAY}`, s: 'acct-mmm-0002', c: i, y: 0 }, null, { subtle, nowS }) });
  assert.equal(raidReceipt(CKEY), null, 'the oldest went');
  assert.ok(raidReceipt(`3:${20 + RAID_RECEIPTS_KEPT - 1}:${CDAY}`));
});

test('RAID3 the world host by source: the raid system is told whether the relay keeps raids and sends its word through the session; the session\'s raid words and the hub link\'s reach the raid; the relay\'s arm is in the relay and the hub\'s door in its fetch', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('  setRaidingPartiesHost({');
  const body = w.slice(at, w.indexOf('\n  });', at));
  assert.match(body, /relayRaids: \(\) => !!online\?\.raidOk,/);
  assert.match(body, /sendRaid: \(w, cell\) => !!online\?\.sendRaid\(w, cell\),/);
  assert.match(w, /online\.onRaid = \(f, room\) => raidRelayWord\(f, room\);/);
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onRaid = \(f, room\) => \(f\.k === 'tw' \? offerRaidTowns\(link, f\.h\) : raidRelayWord\(f, room\)\);/);   // RAID-ROLL: the hub's ask for the towns table beside it
  const relay = rd('server/src/index.js');
  assert.match(relay, /if \(path === RAID_INTERNAL_CLEAN\) return this\._raidCleanInternal\(request\);/);
  assert.match(relay, /if \(await this\._raidSweep\(Date\.now\(\)\)\) \{ if \(riteDue\) await this\._riteArm\(Date\.now\(\) \+ RITE_TELL_RETRY_MS\); if \(sdOwed\) await this\._sdCellArm\(Date\.now\(\) \+ SD_TELL_RETRY_MS\); return; \}/);   // WB12d: never past the rite's retry (AUDIT BROKER-CAGE R4: the local renamed off riteOwed)
  assert.match(relay, /if \(!this\._spend\(ws, now, raidGate, 'raidBucket', 'raidDrops', 'too many raid frames'\)\) return;\n\s+if \(!isCellRoom\(a\.key\)\) \{ this\._junk\(ws\); return; \}/);
});
