// DRAGON-EACH (2026-10-31, the owner: "open up the rewards", of AUDIT DRAGON-CELL D4; bible/11-Multiplayer/Dwarven-Dragon.md
// DRAGON-EACH). A watch holds up to four dragons, and each pays: a receipt signs its dragon's place (its cell's number,
// dragonPlaceOf), the hub keeps one a dragon of an account's newest watch, the account service counts a kill, its hoard and
// its tame once a (watch, place, account), and the client settles and spends one a dragon. A receipt from before it carries
// no place and counts as before, one a watch. tools/mutants/dragoneach.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { mintDragonReceipt, readDragonReceipt, dragonReceiptValid } from '../../../src/net/dragon/dragonReceipt.js';
import { cellRoomOfWire, DRAGON_RC_PREFIX, DRAGON_INTERNAL_FELL, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { DRAGON_TICK_MS } from '../../../src/net/dragon/dragonBrain.js';
import { dragonFellInternal, sweepDragonReceipts } from '../../../server/src/dragonFights.js';
import { createDragonClaims, DRAGON_SETTLED_KEY } from '../../../src/net/dragon/dragonClaims.js';
import { createDragonLink } from '../../../src/net/dragon/dragonLink.js';
import { dragonSpoilsDay } from '../../../src/systems/dragon/dragonSpoils.js';
import { claimDragon } from '../../../server-account/src/dragons.js';
import { createGuest } from '../../../server-account/src/accounts.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../../src/net/identityToken.js';
import { d1 } from '../../accountDb.mjs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, dragonOmenFrom, siteOf, aged } from '../../dragonOmen.mjs';

const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN), S = siteOf(OMEN);
const words = (ws, k) => ws.sent.filter((m) => m.t === 'dragon' && (!k || m.k === k));
const placeOfCell = (cx, cy) => (cy - Law.DRAGON_CELLS.cy0) * Law.DRAGON_CELLS.cols + (cx - Law.DRAGON_CELLS.cx0);
const siteIn = (cx, cy) => Law.pixelCentreNative(cx * Law.DRAGON_CELL_PX + 3, cy * Law.DRAGON_CELL_PX + 9);
const priv = await subtle.importKey('pkcs8', Buffer.from(RELAY_KEY.pkcs8, 'base64'), { name: 'Ed25519' }, false, ['sign']);
const SUB = 'acct-peer-0001';
const mint = (o, nowS) => mintDragonReceipt({ q: W, b: 0, s: 'acct-0001', c: 7, x: 'dealt', l: 20, ...o }, priv, { subtle, nowS });

async function withWorld(fn, start = TT.landAt + 60_000) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const room = (key) => { const r = world.room(key); r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8; return r; };
    const hub = room(SOCIAL_ROOM);
    const fell = (body) => dragonFellInternal(hub.room, new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify(body) })).then((r) => r.status);
    await fn({ world, room, hub, fell, now: () => clock, set: (t) => { clock = t; }, nowS: () => Math.floor(clock / 1000) });
  } finally { Date.now = realNow; }
}

test('DRAGON-EACH the place: a site\'s cell numbered row by row in DRAGON_CELLS - the frame\'s first cell 0, its last DRAGON_PLACES - 1, an omen\'s site its own cell\'s - and -1 outside the frame; a receipt carries one in that range or none (mutants: the rows and columns crossed; the frame\'s edge let through; the receipt\'s place unchecked; its bound one past)', async () => {
  const { cx0, cy0, cols, rows } = Law.DRAGON_CELLS;
  assert.equal(Law.DRAGON_PLACES, cols * rows);
  const c = Law.dragonCellOf(OMEN);
  assert.equal(Law.dragonPlaceOf(S.sx, S.sz), placeOfCell(c.cx, c.cy), 'an omen\'s site: its cell\'s');
  for (const [cx, cy, want] of [[cx0, cy0, 0], [cx0 + 1, cy0, 1], [cx0, cy0 + 1, cols], [cx0 + cols - 1, cy0 + rows - 1, Law.DRAGON_PLACES - 1], [cx0 + 5, cy0 + 2, 2 * cols + 5],
    [cx0 - 1, cy0, -1], [cx0 - 1, cy0 + 1, -1], [cx0, cy0 - 1, -1], [cx0 + cols, cy0, -1], [cx0, cy0 + rows, -1]]) {
    const s = siteIn(cx, cy);
    assert.equal(Law.dragonPlaceOf(s.sx, s.sz), want, `cell ${cx},${cy}`);
  }
  const base = { q: W, b: 0, s: 'acct-0001', c: 1, x: 'dealt', l: 20, i: 100, e: 200 };
  for (const p of [undefined, 0, Law.DRAGON_PLACES - 1]) assert.equal(dragonReceiptValid({ ...base, p }), true, `p ${p}`);
  for (const p of [-1, Law.DRAGON_PLACES, 1.5, '3', null]) assert.equal(dragonReceiptValid({ ...base, p }), false, `p ${p}`);
  assert.equal(readDragonReceipt(await mint({ p: 42 }, 100)).p, 42, 'minted with its place');
  assert.equal('p' in readDragonReceipt(await mint({}, 100)), false, 'and none without');
});

test('DRAGON-EACH the fall: each earner\'s receipt signs its dragon\'s place, and the hub is told it (mutants: the place unminted; the hub untold)', async () => {
  await withWorld(async ({ room, hub, now, set }) => {
    const told = [];
    const fetch = hub.room.fetch.bind(hub.room);
    hub.room.fetch = async (req) => { if (new URL(req.url).pathname === DRAGON_INTERNAL_FELL) told.push(await req.clone().json()); return fetch(req); };
    const r = aged(room(cellRoomOfWire(S.sx, S.sz))), a = r.connect();
    await r.hello(a, 'peer-0001', { x: S.sx + 40 * Law.DRAGON_NATIVE_PER_M, y: 0, z: S.sz, yaw: 0, pitch: 0 });
    await r.raw(a, JSON.stringify({ t: 'dragon', k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: S.sx, sz: S.sz }));
    const f = r.room._dg.fights.get(Law.dragonFightId(W, S.sx, S.sz));
    set(now() + DRAGON_TICK_MS); if (r.alarm.at != null && now() >= r.alarm.at) await r.fire();
    f.hp = 5; f.players['acct-peer-0001'].dealt = 1000;
    await r.raw(a, JSON.stringify({ t: 'dragon', k: 'hit', d: 40, r: 1 }));
    const c = readDragonReceipt(words(a, 'rcpt')[0]?.r);
    assert.deepEqual([c?.q, c?.p, c?.x], [W, Law.dragonPlaceOf(S.sx, S.sz), 'dealt'], 'its receipt');
    assert.deepEqual(told.map((b) => [b.w, b.p]), [[W, Law.dragonPlaceOf(S.sx, S.sz)]], 'the hub told its place');
  });
});

test('DRAGON-EACH the hub: an account\'s receipts of one watch kept one a dragon and each handed at its hello - a second kill at one place its own again, an older watch\'s never over them, a newer watch\'s in their stead, a keep from before kept beside; a receipt not of the told place refused, a place out of range refused; a party-mate\'s share signs the place; the sweep keeps a list while one is good (mutants: one a watch kept; the place unread; a newer watch merged; the share unplaced; the sweep reads the first alone)', async () => {
  await withWorld(async ({ hub, fell, now, nowS }) => {
    const kept = () => hub.store.get(`${DRAGON_RC_PREFIX}${SUB}`);
    const places = () => kept()?.l?.map((x) => [x.p, readDragonReceipt(x.r)?.c]);
    hub.store.set(`${DRAGON_RC_PREFIX}${SUB}`, { q: W, r: await mint({ s: SUB, c: 1 }, nowS()), e: nowS() + 600 });   // a keep from before DRAGON-EACH
    assert.equal(await fell({ w: W, p: 10, rc: [[SUB, await mint({ s: SUB, p: 10, c: 2 }, nowS())]] }), 200);
    assert.equal(await fell({ w: W, p: 20, rc: [[SUB, await mint({ s: SUB, p: 20, c: 3 }, nowS())]] }), 200);
    assert.deepEqual(places(), [[-1, 1], [10, 2], [20, 3]], 'three dragons of one watch, the one from before beside');
    assert.equal(await fell({ w: W, p: 10, rc: [[SUB, await mint({ s: SUB, p: 10, c: 4 }, nowS())]] }), 200);
    assert.deepEqual(places(), [[-1, 1], [20, 3], [10, 4]], 'one place once');
    assert.equal(await fell({ w: W, p: 30, rc: [[SUB, await mint({ s: SUB, p: 31, c: 5 }, nowS())]] }), 200);
    assert.equal(await fell({ w: W, rc: [[SUB, await mint({ s: SUB, p: 30, c: 6 }, nowS())]] }), 200);
    assert.deepEqual(places(), [[-1, 1], [20, 3], [10, 4]], 'a receipt not of the told place: refused');
    for (const p of [-1, Law.DRAGON_PLACES, 2.5]) assert.equal(await fell({ w: W, p, rc: [] }), 400, `place ${p}`);
    const kin = hub.connect(); await hub.hello(kin, 'peer-0001');
    assert.deepEqual(words(kin, 'rcpt').map((m) => readDragonReceipt(m.r).c).sort(), [1, 3, 4], 'each handed at the hello');
    assert.equal(await fell({ w: W - 1, p: 40, rc: [[SUB, await mint({ s: SUB, q: W - 1, p: 40, c: 7 }, nowS())]] }), 200);
    assert.deepEqual(places(), [[-1, 1], [20, 3], [10, 4]], 'an older watch: never over them');
    assert.equal(await fell({ w: W + 1, p: 50, rc: [[SUB, await mint({ s: SUB, q: W + 1, p: 50, c: 8 }, nowS())]] }), 200);
    assert.deepEqual([kept().q, places()], [W + 1, [[50, 8]]], 'a newer watch: in their stead');
    // a party-mate's share
    for (const id of [SUB, 'acct-peer-0007']) await hub.room._putAcct(id, { ...((await hub.room._acct(id)) ?? {}), name: id, party: 'pty-a' });
    await hub.room._putParty({ id: 'pty-a', leader: SUB, members: [SUB, 'acct-peer-0007'], invites: [], away: {}, at: now() });
    assert.equal(await fell({ w: W + 1, p: 60, rc: [[SUB, await mint({ s: SUB, q: W + 1, p: 60, c: 9 }, nowS())]], kin: [['acct-peer-0007', 18]] }), 200);
    const share = readDragonReceipt(hub.store.get(`${DRAGON_RC_PREFIX}acct-peer-0007`)?.l?.[0]?.r);
    assert.deepEqual([share?.q, share?.p, share?.x], [W + 1, 60, 'stood'], 'the share signs the place');
    // the sweep
    const t = now(), mk = (es) => ({ q: W, l: es.map((e, i) => ({ p: i, r: 'z1.a.b', e })) });
    const store = new Map([['a', mk([t / 1000 - 1, t / 1000 + 600])], ['b', mk([t / 1000 - 1, t / 1000 - 1])], ['c', { q: W, r: 'z1.a.b', e: t / 1000 + 600 }]].map(([k, v]) => [`${DRAGON_RC_PREFIX}acct-${k}`, v]));
    const room = { state: { storage: { list: async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix))) } } };
    const dead = [];
    await sweepDragonReceipts(room, t, null, dead, 10);
    assert.deepEqual(dead, [`${DRAGON_RC_PREFIX}acct-b`], 'a list with one good kept; one all spent swept');
  });
});

async function member(db, n) {
  const id = (await createGuest({ db, subtle, rand, nowS: 1_800_000_000 }, { deviceLabel: null })).id;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(`Each${n}`, `each${n}`, id);
  return { id, handle: `Each${n}` };
}

test('DRAGON-EACH the claim: two dragons of one watch both counted, each its own hoard; one place claimed twice counted once; a receipt from before counts beside them; a tame names its own place, and a claim at another place of the watch is told none (mutants: the kill keyed by watch; the hoard keyed by watch; the tame read by watch)', async () => {
  const db = d1(), T = 1_800_000_000;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const key = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const a = await member(db, 1);
  const r = (o) => mintDragonReceipt({ q: W, b: 0, s: a.id, c: 7, x: 'dealt', l: 20, ...o }, key, { subtle, nowS: T });
  const tames = (seed) => (b) => (b.length === 4 ? (b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]), b) : rand(b));
  const { dragonTameRoll } = await import('../../../server-account/src/dragons.js');
  let yes = 1; while (!dragonTameRoll(yes)) yes++;
  let no = 1; while (dragonTameRoll(no)) no++;
  const claim = (rc, cid, seed = no, character = 'char-0001') => claimDragon({ db, nowS: T + 60, subtle, rand: tames(seed) }, a, { receipt: rc, character, cid }, pub);
  const one = await claim(await r({ p: 10 }), 'a1b2c3d4e5f60718', yes);
  assert.deepEqual([one.recorded, one.slain, one.spoils, one.tamed?.character], [true, 1, true, 'char-0001'], 'the first: counted, its hoard, tamed');
  const two = await claim(await r({ p: 20 }), '0f0e0d0c0b0a0908');
  assert.deepEqual([two.recorded, two.slain, two.spoils, two.tamed], [true, 2, true, null], 'the second of the watch: counted, its own hoard, no tame of its own');
  const again = await claim(await r({ p: 20 }), '1111111111111111');
  assert.deepEqual([again.recorded, again.why, again.slain, again.spoils], [false, 'claimed', 2, false], 'one place once');
  const back = await claim(await r({ p: 10 }), 'a1b2c3d4e5f60718');
  assert.equal(back.tamed?.character, 'char-0001', 'the tame told again at its own place');
  const old = await claim(await r({}), '2222222222222222');
  assert.deepEqual([old.recorded, old.slain], [true, 3], 'a receipt from before: one a watch, beside them');
  assert.deepEqual(db._raw.prepare('SELECT place FROM dragon_kills WHERE account = ? ORDER BY place').all(a.id).map((x) => x.place), [-1, 10, 20]);
  assert.deepEqual(db._raw.prepare('SELECT place FROM dragon_mounts WHERE account = ?').all(a.id).map((x) => x.place), [10]);
});

test('DRAGON-EACH the client: two receipts of one watch both kept, carried and settled one a dragon; a receipt from before keeps its watch\'s key; each dragon\'s hoard spent under its own day (mutants: kept one a watch; settled one a watch; the link one a watch; the hoard spent one a watch)', async () => {
  const nowS = Math.floor(Date.now() / 1000), kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const R = (o) => mintDragonReceipt({ q: W, b: 0, s: 'acct-0001', c: 42, x: 'dealt', l: 20, ...o }, kp.privateKey, { subtle, nowS });
  const m = new Map(), store = { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, JSON.parse(JSON.stringify(v))) };
  let up = false;
  const C = createDragonClaims({ claim: async () => (up ? { ok: true, data: { recorded: true, slain: 1, spoils: false } } : { ok: false, error: 'offline' }), store, me: () => 'acct-0001', nowS: () => nowS });
  const [r10, r20, r0] = [await R({ p: 10 }), await R({ p: 20 }), await R({})];
  for (const rc of [r10, r20, r0]) assert.equal(C.add(rc, 'char-0001', 'Ama', 20), true);
  await new Promise((d) => setTimeout(d, 20));
  assert.equal(C.kept().length, 3, 'kept one a dragon');
  up = true;
  await C.flush();
  assert.deepEqual(m.get(DRAGON_SETTLED_KEY), [`${W}|10|acct-0001`, `${W}|20|acct-0001`, `${W}|acct-0001`], 'settled one a dragon; one from before by its watch');
  assert.equal(C.add(await R({ p: 10, c: 9 }), 'char-0001'), false, 'a dragon settled is never kept again');
  const got = [];
  const link = createDragonLink({ now: () => 0, onReceipt: (rc) => got.push(rc) });
  for (const rc of [r10, r20, r10, r0]) link.word({ k: 'rcpt', r: rc });
  assert.deepEqual([got, link.receipt(W, 20), link.receipt(W)], [[r10, r20, r0], r20, r0], 'the link: one a dragon');
  assert.deepEqual([dragonSpoilsDay(W, 10), dragonSpoilsDay(W, 20), dragonSpoilsDay(W)], [`dragon:${W}:10`, `dragon:${W}:20`, `dragon:${W}`]);
});

test('DRAGON-EACH the hoards: two dragons of one watch, two hoards into the pack - each spent under its own day (mutants: the rewards spend one a watch)', async () => {
  const { createDragonRewards } = await import('../../../src/scenes/dragonRewards.js');
  const nowS = Math.floor(Date.now() / 1000), kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const R = (o) => mintDragonReceipt({ q: W, b: 0, s: 'acct-0001', c: 42, x: 'dealt', l: 20, ...o }, kp.privateKey, { subtle, nowS });
  const taken = [], storage = new Map();
  const host = { rewardsStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    takeSpoil: (p) => taken.push(p.kind), relayNowS: () => nowS, chatNotice: () => {},
    dragonAccount: { me: () => 'acct-0001', claim: async () => ({ ok: true, data: { recorded: true, slain: 1, spoils: true, tamed: null } }) } };
  const rw = createDragonRewards(host);
  for (const [p, c] of [[10, 9], [20, 11]]) {
    rw.receipt(await R({ p, c }));
    await rw.claims.flush();
    for (let i = 0; i < 40 && taken.filter((k) => k === 'gold').length < (p === 10 ? 1 : 2); i++) await new Promise((d) => setTimeout(d, 5));
  }
  assert.equal(taken.filter((k) => k === 'gold').length, 2, JSON.stringify(taken));
});
