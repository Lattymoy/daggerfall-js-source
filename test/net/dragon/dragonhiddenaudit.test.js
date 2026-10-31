// AUDIT DRAGON-HIDDEN (2026-10-30, the owner: "Audit this"; bible/01-Overview/audits/Audit-Dragon-Hidden.md): THE AUDIT'S
// PINS. A forged site held to its theatre's side of the Bay's edge and a pixel's centre (A1); a fight an older law made
// let go when its cell wakes, a slain one kept (A4); an `ask` answered in a battle and heard from there (PIN MOVED, AUDIT
// DRAGON-CELL II E12: in a room that judges a pose), a fight's word still its cell's (B1); the Aetherbright's look on its fight, its receipt and a party's share (A3, C2); the omen word
// the host's (B4); the ask's bounds and the sighting's look (B5); the fight's gate named in its own note (A6).
// tools/mutants/dragonhiddenaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { DRAGON_SEAM } from '../../../src/net/bossSeam.js';
import { roostLeg } from '../../../src/net/dragon/dragonBody.js';
import { DRAGON_TICK_MS } from '../../../src/net/dragon/dragonBrain.js';
import { mintDragonReceipt, readDragonReceipt, verifyDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { cellRoomOfWire, DRAGON_FIGHT_KEY, DRAGON_FIGHTS_KEY, DRAGON_RC_PREFIX, DRAGON_RELAY_MIN, SOCIAL_ROOM, RELAY_VERSION } from '../../../src/net/wire.js';
import { siegeRoomKey } from '../../../src/net/siege/siegeRef.js';
import { OnlineSession } from '../../../src/net/online.js';
import { createDragonHost, createDragonSky, DRAGON_ASK_RETRY_MS, DRAGON_NOTICE_WAIT_MS } from '../../../src/scenes/dragonHost.js';
import { createDragonLink } from '../../../src/net/dragon/dragonLink.js';
import { dragonFights, dragonFellInternal, DRAGON_TELL_DWELL_MS } from '../../../server/src/dragonFights.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { RELAY_KEY, dragonOmenFrom, siteOf, aged } from '../../dragonOmen.mjs';

const subtle = globalThis.crypto.subtle;
const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN);
const FAR = await dragonOmenFrom(W + 1, { bay: false });   // a dragon past the Bay's edge (DRAGON-CELL: in a cell off it)
const SHINY = await dragonOmenFrom(W + 1, { look: 1 });   // the Aetherbright, in the Bay
const { px: PX, py: PY, sx: SX, sz: SZ } = siteOf(OMEN), CELL = cellRoomOfWire(SX, SZ);
const at = (mx, mz) => ({ x: SX + mx * Law.DRAGON_NATIVE_PER_M, y: 0, z: SZ + mz * Law.DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0 });
const IN = (o = {}) => ({ k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: SX, sz: SZ, ...o });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'dragon' && (!k || m.k === k));

async function withRelay(fn, { start = TT.landAt + 60_000, key = CELL } = {}) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = aged(world.room(key));
    r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8;
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += DRAGON_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    await fn({ world, r, say, tick, now: () => clock });
  } finally { Date.now = realNow; }
}

test('AUDIT DRAGON-HIDDEN A1 the site: a relay with no map holds a forged one to what it can judge - a pixel\'s centre on its omen\'s side of the Bay\'s edge; off it, the dragon is gone there and no fight stands (mutants: the theatre unchecked; the centre unchecked; its north unchecked; the cell\'s check dropped)', async () => {
  assert.equal(Law.dragonSiteOk(OMEN, SX, SZ), true, 'its dragon at a pixel\'s centre in its cell');
  assert.equal(Law.dragonSiteOk(OMEN, SX + 1, SZ), false, 'east of its centre');
  assert.equal(Law.dragonSiteOk(OMEN, SX, SZ - 1), false, 'south of it');
  const next = Law.pixelCentreNative(PX + Law.DRAGON_CELL_PX, PY);
  assert.equal(Law.dragonSiteOk(OMEN, next.sx, next.sz), false, 'DRAGON-CELL: never in the next cell');
  const F = siteOf(FAR);
  assert.equal(Law.dragonSiteOk(FAR, F.sx, F.sz), true, 'past the Bay\'s edge, in its own cell');
  assert.equal(Law.dragonSiteOk(FAR, SX, SZ), false, 'a province\'s dragon never in the Bay\'s cell');
  await withRelay(async ({ r, say }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', at(40, 0));
    await say(a, IN({ sx: SX + 1 }));
    assert.deepEqual([words(a, 'no').map((m) => m.m), r.room._dg.fights.size], [['gone'], 0], 'off its centre: gone, no fight');
    await say(a, IN());
    assert.equal(words(a, 'st').length, 1, 'its own site stands');
  });
  await withRelay(async ({ r, say }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', at(40, 0));
    await say(a, IN({ w: FAR.w }));
    assert.deepEqual([words(a, 'no').map((m) => m.m), r.room._dg.fights.size], [['gone'], 0], 'a province\'s dragon stands no fight in a Bay cell');
  }, { start: Law.dragonTimes(FAR).landAt + 60_000 });
});

test('AUDIT DRAGON-HIDDEN A4 the deploy: a cell waking lets go of an unslain fight a law older than DRAGON_BRAIN_MIN made - record and index - and keeps a slain one (its receipts) and its own law\'s (mutants: none let go; a slain one let go too; its record kept)', async () => {
  await withRelay(async ({ r }) => {
    const mk = (k) => { const s = Law.pixelCentreNative(PX + k, PY); return [Law.dragonFightId(W, s.sx, s.sz), DRAGON_SEAM.new({ w: W, b: 0, sx: s.sx, sz: s.sz, now: TT.landAt, leaveAt: TT.leaveAt, roost: roostLeg(OMEN) })]; };
    const [oldId, old] = mk(0), [slainId, slain] = mk(1), [curId, cur] = mk(2);
    old.v = 1; slain.v = 1; slain.fell = { at: TT.landAt + 1000, top: [], n: 1 };
    assert.equal(cur.v, Law.DRAGON_BRAIN_V);
    r.store.set(DRAGON_FIGHTS_KEY, [oldId, slainId, curId]);
    for (const [id, f] of [[oldId, old], [slainId, slain], [curId, cur]]) r.store.set(`${DRAGON_FIGHT_KEY}:${id}`, f);
    assert.deepEqual([...(await dragonFights(r.room)).keys()], [slainId, curId]);
    assert.equal(r.store.has(`${DRAGON_FIGHT_KEY}:${oldId}`), false, 'its record gone');
    assert.deepEqual(r.store.get(DRAGON_FIGHTS_KEY), [slainId, curId], 'and from the index');
  });
});

test('AUDIT DRAGON-HIDDEN B1 the relay: an `ask` is answered in a siege\'s battle - PIN MOVED (AUDIT DRAGON-CELL II E12): its pose judged on its map frame, a far one told null once it has stood (D6, II E1) - while an `in` and a blow there are junk, a fight being its cell\'s (mutants: an ask in a battle junked; a battle\'s blow let through)', async () => {
  await withRelay(async ({ r, say, tick }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { glyphs: ['dev'] });
    await say(a, { k: 'ask', w: W });
    await tick(Math.ceil(DRAGON_TELL_DWELL_MS / DRAGON_TICK_MS));
    await say(a, { k: 'ask', w: W });
    assert.deepEqual(words(a, 'omen').map(({ w, s }) => [w, s]), [[W, null]]);
    assert.equal(a.meters.junk ?? 0, 0);
    await say(a, { k: 'hit', d: 10, r: 0 });
    assert.equal(a.meters.junk, 1, 'a blow is a cell\'s');
    await say(a, IN());
    assert.equal(a.meters.junk, 2, 'and an `in`');
    assert.equal(r.room._dg.fights, undefined, 'no fight read here');
  }, { key: siegeRoomKey(3021, 20), start: Law.dragonQuietAt(W) });
});

test('AUDIT DRAGON-HIDDEN B1 the client: an `ask` goes down my primary whatever its room, at a relay that answers it, and its omen is heard there - never the hub\'s; a fight\'s word still wants its cell\'s socket (mutants: the ask wants a cell; the battle\'s omen dropped)', () => {
  const link = (room, v = RELAY_VERSION) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, acct: 'acct-me', asecret: 'secret-of-acct-me' });
    o.join(room, null);
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
    const heard = [];
    o.onDragon = (w, from) => heard.push([w.k, from]);
    return { o, ws, heard, sent: () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'dragon') };
  };
  const BATTLE = siegeRoomKey(3021, 20);
  const b = link(BATTLE);
  assert.equal(b.o.sendDragon({ k: 'ask', w: W }), true);
  assert.deepEqual(b.sent(), [{ t: 'dragon', k: 'ask', w: W }]);
  assert.equal(b.o.sendDragon(IN(), CELL), false, 'no cell\'s socket here: no `in`');
  b.ws.receive({ t: 'dragon', k: 'omen', w: W, s: OMEN.s });
  assert.deepEqual(b.heard, [['omen', BATTLE]]);
  const hub = link(SOCIAL_ROOM);
  hub.ws.receive({ t: 'dragon', k: 'omen', w: W, s: OMEN.s });
  assert.deepEqual(hub.heard, [], 'the hub tells no omen');
  assert.equal(link(BATTLE, `world${DRAGON_RELAY_MIN - 1}`).o.sendDragon({ k: 'ask', w: W }), false, 'a relay that would close on it');
});

test('AUDIT DRAGON-HIDDEN A3, C2 the Aetherbright: its omen\'s look is its fight\'s, its killer\'s receipt\'s, and - the hub rolling no watch - a party-mate\'s share takes it from a dealer\'s receipt (mutants: the fight brass; the share brass)', async () => {
  const S = siteOf(SHINY), atS = (mx, mz) => ({ x: S.sx + mx * Law.DRAGON_NATIVE_PER_M, y: 0, z: S.sz + mz * Law.DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0 });   // DRAGON-CELL: its own cell
  await withRelay(async ({ world, r, say, tick, now }) => {
    const a = r.connect();
    await r.hello(a, 'peer-0001', atS(40, 0));
    await say(a, IN({ w: SHINY.w, sx: S.sx, sz: S.sz }));
    assert.equal(words(a, 'st')[0].b, 1, 'its fight');
    const f = r.room._dg.fights.get(Law.dragonFightId(SHINY.w, S.sx, S.sz));
    await tick(1);
    f.hp = 5; f.players['acct-peer-0001'].dealt = 1000;
    await say(a, { k: 'hit', d: 40, r: 1 });
    const ok = await verifyDragonReceipt(words(a, 'rcpt')[0].r, RELAY_KEY.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.deepEqual([ok.ok, ok.claims.b, ok.claims.x], [true, 1, 'dealt'], 'its receipt');
    const hub = world.room(SOCIAL_ROOM);
    hub.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8;
    const kin = hub.connect(); await hub.hello(kin, 'peer-0007');
    for (const id of ['acct-deal', 'acct-peer-0007']) await hub.room._putAcct(id, { ...((await hub.room._acct(id)) ?? {}), name: id, party: 'pty-a' });
    await hub.room._putParty({ id: 'pty-a', leader: 'acct-deal', members: ['acct-deal', 'acct-peer-0007'], invites: [], away: {}, at: now() });
    const priv = await subtle.importKey('pkcs8', Buffer.from(RELAY_KEY.pkcs8, 'base64'), { name: 'Ed25519' }, false, ['sign']);
    const dealt = await mintDragonReceipt({ q: SHINY.w, b: 1, s: 'acct-deal', c: 7, x: 'dealt', l: 20 }, priv, { subtle, nowS: Math.floor(now() / 1000) });
    const body = { w: SHINY.w, rc: [['acct-deal', dealt]], here: [], kin: [['acct-peer-0007', 18]] };
    assert.equal((await dragonFellInternal(hub.room, new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify(body) }))).status, 200);
    const c = readDragonReceipt(hub.store.get(`${DRAGON_RC_PREFIX}acct-peer-0007`)?.l?.[0]?.r);   // PIN MOVED (DRAGON-EACH): the hub keeps a list, one a dragon
    assert.deepEqual([c?.s, c?.x, c?.l, c?.b], ['acct-peer-0007', 'stood', 18, 1], 'a party-mate\'s share, the Aetherbright\'s');
  }, { start: Law.dragonTimes(SHINY).landAt + 60_000, key: cellRoomOfWire(S.sx, S.sz) });
});

test('AUDIT DRAGON-HIDDEN B4 the omen word is the host\'s, every other the fight\'s link\'s (mutant: the omen to the link)', () => {
  const got = [];
  const fake = { omen: (o) => got.push(['host', o.w]), refused: (c) => got.push(['link', c]), site: () => ({ w: W, sx: SX, sz: SZ }), receipt: () => {}, tick: () => {}, frame: () => false, leave: () => {}, bar: () => null };
  const sky = createDragonSky({ bayScan: () => null, theatres: () => [], street: () => true, drawBar: () => {}, now: () => TT.landAt, makeHost: () => fake });
  sky.word({ k: 'omen', w: W, s: OMEN.s });
  sky.word({ k: 'no', m: 'gone' });
  assert.deepEqual(got, [['host', W], ['link', 'gone']]);
});

/** A screen at `t0` with my feet `me` metres from the site, its omens told as `told` lists them. */
function screen(t0, told = [], me = [0, -1400]) {
  const M = 40, S = { t: t0, sent: [], mid: [] };
  const sites = { of: (o) => ({ w: o.w, lane: 0, px: PX, py: PY, sx: SX, sz: SZ, near: 'Here' }) };
  const link = createDragonLink({ now: () => S.t, site: () => S.host.site() });
  S.host = createDragonHost({
    now: () => S.t, link, sites, online: { ready: () => true, send: (w) => { S.sent.push(w); return true; } },
    local: (nx, nz) => [nx / M, nz / M], native: (x, z) => [x * M, z * M], ground: () => 0,
    feet: () => [SX / M + me[0], 0, SZ / M + me[1]], eye: () => [SX / M + me[0], 1.6, SZ / M + me[1]], level: () => 20, mid: (x) => S.mid.push(x),
  });
  for (const o of told) S.host.omen(o);
  S.asks = (w) => S.sent.filter((x) => x.k === 'ask' && x.w === w).length;
  S.run = (ms, step = 50) => { for (let k = 0; k < ms; k += step) { S.host.frame(); S.t += step; } };
  return S;
}

test('AUDIT DRAGON-HIDDEN B5 the ask\'s bounds: soon again after an ask before the relay\'s landing, never again once told none, never once its remains are gone; and an Aetherbright\'s sighting names it before any fight is mine (mutants: again only at fifteen seconds; asked after a null omen; asked past its remains; the sighting brass)', () => {
  assert.equal(DRAGON_ASK_RETRY_MS, 15_000, 'DRAGON-HIDDEN-TIME: asked from the watch\'s start, a landing heard within fifteen seconds, four asks a minute');
  const S = screen(TT.landAt);
  S.run(DRAGON_ASK_RETRY_MS + 50);
  assert.equal(S.asks(W), 2, 'again while unanswered');
  S.host.omen({ w: W, s: null });
  S.run(3 * DRAGON_ASK_RETRY_MS);
  assert.equal(S.asks(W), 2, 'no secret there: asked no more');
  const late = Law.dragonAskEnd(W);   // DRAGON-HIDDEN-TIME: the latest any dragon of the watch may still lie
  assert.equal(Law.dragonWatchesAbout(late).includes(W), true, 'still a watch about');
  const L = screen(late - 1); L.host.frame();
  assert.equal(L.asks(W), 1, 'its remains still lie');
  const G = screen(late); G.host.frame();
  assert.equal(G.asks(W), 0, 'its remains gone: nothing to ask for');
  const B = screen(Law.dragonTimes(SHINY).landAt + 1000, [SHINY]);
  B.run(DRAGON_NOTICE_WAIT_MS + 2000);
  assert.equal(B.mid.filter((x) => /A blue dragon circles/.test(x)).length, 1, B.mid.join(' | '));
});

test('AUDIT DRAGON-HIDDEN A6 the fight\'s gate is the relay that answers an `ask`: its version\'s note names DRAGON-CELL (PIN MOVED: DRAGON-HIDDEN\'s until the relay told an omen near its cell alone), so a renumbering past another\'s number shows', () => {
  const wire = readFileSync(new URL('../../../src/net/wire.js', import.meta.url), 'utf8');
  assert.match(wire, new RegExp(`(?:RELAY_VERSION = 'world${DRAGON_RELAY_MIN}';\\s+)?// world${DRAGON_RELAY_MIN}: [^\\n]*DRAGON-CELL`));
});
