// LEGACY7 part three (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9; Mac: "online integration with permadeath
// (Bloodline) or non-permadeath (Enduring)" - the design's "two players' characters may wed: both in the same temple,
// both asking the priest, the service records the union (each family names the other's member as spouse)"): TWO
// PLAYERS WED. The account service's union (server-account/src/legacy.js realmWed - the REAL Worker over the REAL
// migrations), the `wed` frame's law (net/wire.js validWedData) and the relay's arm over the real Room, the handshake's
// state machine (net/wedSession.js) - two of them driven against each other over a fake wire and the real Worker - the
// house's record (systems/legacy/marriage.js wedPlayer, the host's wedRefusal / wedPlayer / unionsHeard), the faces
// (the tree, the card, the inspect card's Propose) and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from './accountDb.mjs';
import { ROUTES } from '../server-account/src/service.js';
import { WED_HALF_LIFE_S, wedCardOf } from '../server-account/src/legacy.js';
import { REFUSALS } from '../src/net/accountClient.js';
import {
  parseClient, validWedData, relaySupportsWed, RELAY_VERSION, WED_RELAY_MIN, WED_KINDS, WED_WHY, WED_FRAME_MAX, WED_HZ_MAX,
  WED_IN_HZ_MAX,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { createWedManager, wedWhyText, wedMineText, WED_ASK_TTL_MS, WED_DONE_WAIT_MS, WED_REASK_MS } from '../src/net/wedSession.js';
import { createRealmSession } from '../src/systems/realmSaves.js';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { foundFamily, readFamily, personOf, familyRng, MODELS, addChild, isAlive } from '../src/systems/legacy/family.js';
import { mergeFacts } from '../src/systems/legacy/store.js';
import { wedPlayer, unionSpouse, playerSpouseLost, spouseOf, childStep, MARRIAGE_TEXT, CHILD_DAYS } from '../src/systems/legacy/marriage.js';
import { layoutTree } from '../src/systems/legacy/tree.js';
import { personChips, identityLine, livesLine } from '../src/ui/familyPages.js';
import { profileView, createProfileWindow } from '../src/ui/profileWindow.js';
import { BLOODLINE_MARK } from '../src/net/houseLaw.js';
import { _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { LEGACY_MOD } from '../src/systems/legacy/family.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((r) => { setImmediate(r); }); };

// ─── THE ACCOUNT SERVICE ────────────────────────────────────────────────────────────────────────────────────────

/** A player of a house: an account, its line (one member - `given` of `surname`), and a realm character born as them. */
async function houseOf(S, fam, surname, given, { gender = 'female', race = 'DarkElf', face = 3, model = 'bloodline', line = true } = {}) {
  const g = await S.guest();
  const call = (p, b) => S.call(p, b, g.secret);
  if (line) await call('/v1/realm/lineage', { id: fam, record: { v: 1, id: fam, surname, model, rev: 1, people: [{ id: 1, given, surname, gender, race, face }] } });
  const c = (await call('/v1/realm/create', line ? { name: `${given} ${surname}`, lineage: fam, person: 1 } : { name: `${given} ${surname}` })).body;
  const who = { g, call, id: c.id, lease: c.lease };
  who.half = (sid, partner, over = {}) => call('/v1/realm/wed', { id: who.id, lease: who.lease, sid, partner, ...over });
  /** The wedding manager's `half`, through the real route. */
  who.halfFn = async (sid, partner) => { const r = await who.half(sid, partner); return r.status === 200 ? { ok: true, wed: r.body.wed === true, union: r.body.union ?? null } : { ok: false, error: r.body?.error }; };
  return who;
}
const unionsOf = async (who) => (await who.call('/v1/realm/unions', {})).body.unions;

test('LEGACY7 part three the service: a union made only when both halves of one wedding are there, each naming the other\'s account - each side\'s card kept as it stood; asked again, the same union; another pair\'s sid spent', async () => {
  for (const r of ['/v1/realm/wed', '/v1/realm/unions']) assert.ok(ROUTES.has(r), r);
  for (const w of ['wed-no-line', 'wed-already', 'wed-partner', 'wed-spent']) assert.ok(typeof REFUSALS[w] === 'string' && REFUSALS[w].length > 10, `${w} is said`);
  const S = await standService();
  const ys = await houseOf(S, 'fam-k1-aaaaaa', 'Hlaalu', 'Ysolde');
  const iz = await houseOf(S, 'fam-k2-bbbbbb', 'Dres', 'Iszara', { gender: 'male', race: 'Redguard', face: 7, model: 'enduring' });
  const SID = 'wedAbc123';
  const first = await ys.half(SID, iz.g.id);
  assert.deepEqual([first.status, first.body], [200, { ok: true, wed: false }], 'mine waits for theirs');
  const second = await iz.half(SID, ys.g.id);
  assert.equal(second.status, 200);
  assert.equal(second.body.wed, true);
  const u = second.body.union;
  assert.equal(u.sid, SID);
  assert.equal(u.mine, iz.id);
  assert.deepEqual(u.partner, { player: ys.g.id, char: ys.id, name: 'Ysolde Hlaalu', house: { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 }, gender: 'female', race: 'DarkElf', face: 3 }, 'her card, off her own line');
  assert.deepEqual([u.endedAt, u.endedWhy, u.endedBy], [null, null, null]);
  // asked again by the first: the same union, seen from her side
  const again = (await ys.half(SID, iz.g.id)).body;
  assert.equal(again.wed, true);
  assert.equal(again.union.mine, ys.id);
  assert.deepEqual(again.union.partner, { player: iz.g.id, char: iz.id, name: 'Iszara Dres', house: { hn: 'Dres', hc: 'Iszara' }, gender: 'male', race: 'Redguard', face: 7 }, 'his card - an Enduring house wears no skull');
  // the account's unions, each side's own view
  assert.deepEqual((await unionsOf(ys)).map((x) => [x.sid, x.mine, x.partner.char]), [[SID, ys.id, iz.id]]);
  assert.deepEqual((await unionsOf(iz)).map((x) => [x.sid, x.mine, x.partner.char]), [[SID, iz.id, ys.id]]);
  // another pair's sid is spent; a third account cannot answer it
  const third = await houseOf(S, 'fam-k3-cccccc', 'Indoril', 'Aldo');
  const spent = await third.half(SID, ys.g.id);
  assert.deepEqual([spent.status, spent.body.error], [409, 'wed-spent']);
  // wed already: a new wedding of either is refused at its own half
  assert.equal((await ys.half('wedOther1', third.g.id)).body.error, 'wed-already');
  assert.equal((await wedCardOf(S.env.DB, ys.g.id, 'r0000000000000000000a')), null, 'no such character: no card');
});

test('LEGACY7 part three the service\'s refusals: a character of no line weds nobody; one wedding at a time an account; the other wed in a race or fallen since their half; a tombstone; a lease not the playing one; a body out of shape; a half older than WED_HALF_LIFE_S is nobody\'s word', async () => {
  const S = await standService();
  const a = await houseOf(S, 'fam-k1-aaaaaa', 'Hlaalu', 'Ysolde');
  const b = await houseOf(S, 'fam-k2-bbbbbb', 'Dres', 'Iszara');
  const c = await houseOf(S, 'fam-k3-cccccc', 'Indoril', 'Aldo');
  const none = await houseOf(S, 'fam-k4-dddddd', 'Nobody', 'Plain', { line: false });
  const r1 = await none.half('wedNone01', a.g.id);
  assert.deepEqual([r1.status, r1.body.error], [409, 'wed-no-line']);
  // one wedding at a time an account: her half waits on him, then she weds another - her first word taken back by her
  // second, so his late answer finds none (the table holds one row an account)
  assert.equal((await a.half('wedLate01', b.g.id)).body.wed, false);
  await a.half('wedNow001', c.g.id);
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM realm_wed_halves WHERE player = ?').get(a.g.id).n, 1, 'one row an account');
  assert.equal((await c.half('wedNow001', a.g.id)).body.wed, true);
  assert.deepEqual((await b.half('wedLate01', a.g.id)).body, { ok: true, wed: false }, 'her word was taken back by her wedding');
  // ...and a union a race landed between the checks and the write: the write itself refuses to wed her twice
  const m1 = await houseOf(S, 'fam-k9-iiiiii', 'Hlaalu', 'Mira');
  const m2 = await houseOf(S, 'fam-ka-jjjjjj', 'Dres', 'Llevel');
  const m3 = await houseOf(S, 'fam-kb-kkkkkk', 'Indoril', 'Faral');
  assert.equal((await m1.half('wedRace01', m2.g.id)).body.wed, false);
  S.env.DB._raw.prepare('INSERT INTO realm_unions (sid, a_player, a_char, b_player, b_char, a_card, b_card, wed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('wedRaced1', m1.g.id, m1.id, m3.g.id, m3.id, '{}', '{}', 1);
  const late = await m2.half('wedRace01', m1.g.id);
  assert.deepEqual([late.status, late.body.error, (await unionsOf(m2)).length], [409, 'wed-partner', 0]);
  // ...or fallen since her half was written: a tombstone weds nobody
  const f = await houseOf(S, 'fam-k7-gggggg', 'Dres', 'Tilse');
  const g = await houseOf(S, 'fam-k8-hhhhhh', 'Indoril', 'Gilvas');
  assert.equal((await f.half('wedFell01', g.g.id)).body.wed, false);
  await f.call('/v1/realm/die', { id: f.id, lease: f.lease });
  assert.deepEqual([(await g.half('wedFell01', f.g.id)).body.error, (await unionsOf(g)).length], ['wed-partner', 0], 'her half is a dead woman\'s word');
  // the shape
  for (const [sid, partner, over] of [['short', a.g.id, {}], ['wed-bad!x', a.g.id, {}], ['wedShape1', b.g.id, {}], ['wedShape1', 'x', {}], ['wedShape1', a.g.id, { id: 'nope' }], ['wedShape1', a.g.id, { lease: 'f' }]]) {
    assert.equal((await b.half(sid, partner, over)).status, 400, JSON.stringify([sid, partner === b.g.id ? 'self' : partner, over]));
  }
  // a lease not the playing one
  assert.equal((await b.half('wedLease1', a.g.id, { lease: '0'.repeat(32) })).body.error, 'lease');
  // a tombstone
  await b.call('/v1/realm/die', { id: b.id, lease: b.lease });
  assert.equal((await b.half('wedDead01', none.g.id)).body.error, 'dead');
  // a half older than its life: nobody's word - the other's answer waits as a first half
  const d = await houseOf(S, 'fam-k5-eeeeee', 'Redoran', 'Brara');
  const e = await houseOf(S, 'fam-k6-ffffff', 'Telvanni', 'Neloth');
  const realNow = Date.now;
  try {
    let clock = realNow();
    Date.now = () => clock;
    assert.equal((await d.half('wedSlow01', e.g.id)).body.wed, false);
    clock += (WED_HALF_LIFE_S + 1) * 1000;
    assert.deepEqual((await e.half('wedSlow01', d.g.id)).body, { ok: true, wed: false }, 'hers lapsed: his waits now');
    assert.equal((await d.half('wedSlow01', e.g.id)).body.wed, true, 'and hers again, in time, makes it');
  } finally { Date.now = realNow; }
});

test('LEGACY7 part three the union\'s end: a death ends it (died, by whose); a retirement keeps it - the elder lives on, wed; a delete ends it (gone); either may wed again', async () => {
  const S = await standService();
  const a = await houseOf(S, 'fam-k1-aaaaaa', 'Hlaalu', 'Ysolde');
  const b = await houseOf(S, 'fam-k2-bbbbbb', 'Dres', 'Iszara');
  await a.half('wedEnd001', b.g.id);
  await b.half('wedEnd001', a.g.id);
  // a retirement keeps it
  assert.equal((await b.call('/v1/realm/die', { id: b.id, lease: b.lease, why: 'retired' })).status, 200);
  assert.equal((await unionsOf(a))[0].endedAt, null, 'the elder lives on, wed');
  assert.equal((await b.call('/v1/realm/die', { id: b.id, lease: b.lease, why: 'bored' })).status, 400, 'a why of no shape');
  // ...and a death after it (the retry's own door) ends it
  assert.equal((await b.call('/v1/realm/die', { id: b.id, lease: b.lease })).status, 200);
  const seen = (await unionsOf(a))[0];
  assert.deepEqual([seen.endedWhy, seen.endedBy, typeof seen.endedAt], ['died', 'partner', 'number'], 'her side: his death ended it');
  assert.equal((await unionsOf(b))[0].endedBy, 'mine', 'his side: his own');
  // she may wed again - and a delete ends that one, gone
  const c = await houseOf(S, 'fam-k3-cccccc', 'Indoril', 'Aldo');
  await a.half('wedEnd002', c.g.id);
  assert.equal((await c.half('wedEnd002', a.g.id)).body.wed, true, 'a widow weds again');
  assert.equal((await c.call('/v1/realm/delete', { id: c.id })).status, 200);
  const gone = (await unionsOf(a)).find((x) => x.sid === 'wedEnd002');
  assert.deepEqual([gone.endedWhy, gone.endedBy], ['gone', 'partner']);
  assert.equal(gone.partner.name, 'Aldo Indoril', 'his card kept - the record of a character no longer in the realm');
  // a death ends it at the first stamp too
  const d = await houseOf(S, 'fam-k4-dddddd', 'Redoran', 'Brara');
  await a.half('wedEnd003', d.g.id);
  await d.half('wedEnd003', a.g.id);
  await a.call('/v1/realm/die', { id: a.id, lease: a.lease });
  assert.deepEqual([(await unionsOf(d)).find((x) => x.sid === 'wedEnd003').endedWhy, (await unionsOf(d)).find((x) => x.sid === 'wedEnd003').endedBy], ['died', 'partner']);
});

// ─── THE WIRE AND THE RELAY ─────────────────────────────────────────────────────────────────────────────────────

const S = 'wedAbc1234';
test('LEGACY7 part three the wire: a wed frame carries a peer, a kind and the handshake - a reason on a `no` alone, of the list; parsed only after a hello, inside its bound; the relay that first routes it is this one', () => {
  assert.deepEqual(WED_KINDS, ['ask', 'yes', 'no', 'done']);
  for (const k of WED_KINDS) assert.deepEqual(validWedData({ to: 'peer-0002', k, s: S, extra: 1 }), { to: 'peer-0002', k, s: S });
  for (const why of WED_WHY) assert.deepEqual(validWedData({ to: 'peer-0002', k: 'no', s: S, why }), { to: 'peer-0002', k: 'no', s: S, why });
  for (const bad of [{ k: 'yes', why: 'declined' }, { k: 'no', why: 'bored' }, { k: 'hug' }, { k: 'ask', s: 'short' }, { k: 'ask', to: 'x' }, { k: 'ask', s: 'a b c d e f' }]) {
    assert.equal(validWedData({ to: 'peer-0002', s: S, ...bad }), null, JSON.stringify(bad));
  }
  assert.equal(validWedData(null), null);
  assert.equal(validWedData([]), null);
  assert.equal(WED_RELAY_MIN, Number(/^world(\d+)$/.exec(RELAY_VERSION)[1]), 'this relay is the first that routes it');
  assert.equal(relaySupportsWed(RELAY_VERSION), true);
  assert.equal(relaySupportsWed(`world${WED_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsWed(null), false);
  const frame = (data) => JSON.stringify({ t: 'wed', data });
  assert.deepEqual(parseClient(frame({ to: 'peer-0002', k: 'ask', s: S }), { hasHello: true }), { t: 'wed', data: { to: 'peer-0002', k: 'ask', s: S } });
  assert.equal(parseClient(frame({ to: 'peer-0002', k: 'ask', s: S }), { hasHello: false }).error, 'wed before hello');
  assert.equal(parseClient(frame({ to: 'peer-0002', k: 'hug', s: S }), { hasHello: true }).error, 'bad wed');
  assert.equal(parseClient(JSON.stringify({ t: 'wed', data: { to: 'peer-0002', k: 'ask', s: S }, pad: 'x'.repeat(WED_FRAME_MAX) }), { hasHello: true }).error, 'frame too large');
});

async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms = 1000) => { clock += ms; } }); } finally { Date.now = realNow; }
}
const weds = (ws) => ws.sent.filter((m) => m.t === 'wed');

test('LEGACY7 part three the relay: a wed frame reaches the one player it names, stamped with the sender\'s id AND the account its token verified - never the frame\'s word; nobody else hears it; a channel is nowhere to wed; a frame at myself is junk; its funnel onto a destination is its own, per sender', () => withRoom('interior:m1234.5', async ({ r, tick }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  const c = r.connect(); await r.hello(c, 'peer-0003');
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'wed', data: { to: 'peer-0002', s: S, k: 'ask', sub: 'acct-forged' } }));
  assert.deepEqual(weds(b), [{ t: 'wed', id: 'peer-0001', sub: 'acct-peer-0001', data: { to: 'peer-0002', s: S, k: 'ask' } }]);
  assert.equal(weds(a).length + weds(c).length, 0);
  await r.raw(a, JSON.stringify({ t: 'wed', data: { to: 'peer-0001', s: S, k: 'ask' } }));
  assert.equal(a.meters.junk, 1, 'a proposal at my own id is junk');
  await r.raw(b, JSON.stringify({ t: 'wed', data: { to: 'peer-0099', s: S, k: 'no' } }));
  assert.equal(b.meters.junk ?? 0, 0, 'a leave races a frame - not junk');
  // the funnel: the destination takes WED_HZ_MAX a second from one sender, on slots of its own
  tick(5000);
  b.sent.length = 0;
  for (let i = 0; i < WED_HZ_MAX + 1; i++) await r.raw(c, JSON.stringify({ t: 'wed', data: { to: 'peer-0002', s: S, k: 'no' } }));
  assert.equal(weds(b).length, WED_HZ_MAX);
  assert.deepEqual(b.meters.wein.map((x) => x.id).sort(), ['peer-0001', 'peer-0003'], 'the wedding\'s slots are their own list, one a sender');
}).then(() => withRoom('chat:world', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'wed', data: { to: 'peer-0002', s: S, k: 'ask' } }));
  assert.equal(weds(b).length, 0, 'a channel is nowhere to wed');
})));

test('LEGACY7 part three the session: a wed frame goes only to a relay that routes it, through the wire\'s projection, WED_HZ_MAX a second; one in is delivered only when a peer\'s and addressed to me, with the relay\'s account stamp, WED_IN_HZ_MAX a second per sender', () => {
  const rig = (relayV) => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
    const got = []; s.onWed = (id, d, sub) => got.push({ id, d, sub });
    quiet(() => s.join('interior:m1234.5', { x: 1, y: 0, z: 1, yaw: 0 }));
    const ws = sockets[0]; ws.open();
    quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: relayV }));
    return { s, ws, got, out: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'wed'), tick: (ms) => { t += ms; } };
  };
  const old = rig('world171');
  assert.equal(old.s.wedOk, false);
  assert.equal(old.s.sendWed({ to: 'peer-0002', s: S, k: 'ask' }), false, 'never at a relay that would close the socket for it');
  const { s, ws, got, out, tick } = rig(RELAY_VERSION);
  assert.equal(s.wedOk, true);
  assert.equal(s.sendWed({ to: 'peer-0002', s: S, k: 'ask', extra: 1 }), true);
  assert.deepEqual(out().at(-1), { t: 'wed', data: { to: 'peer-0002', k: 'ask', s: S } });
  assert.equal(s.sendWed({ to: 'aaaa-0001', s: S, k: 'ask' }), false, 'never at myself');
  assert.equal(s.sendWed({ to: 'peer-0009', s: S, k: 'ask' }), false, 'nobody reports them');
  for (let i = 1; i < WED_HZ_MAX; i++) assert.equal(s.sendWed({ to: 'peer-0002', s: S, k: 'no' }), true);
  assert.equal(s.sendWed({ to: 'peer-0002', s: S, k: 'no' }), false, 'WED_HZ_MAX a second');
  tick(1000);
  assert.equal(s.sendWed({ to: 'peer-0002', s: S, k: 'no' }), true);
  ws.receive({ t: 'wed', id: 'peer-0002', sub: 'acct-bran', data: { to: 'aaaa-0001', s: S, k: 'ask' } });
  ws.receive({ t: 'wed', id: 'peer-0002', sub: 'acct-bran', data: { to: 'peer-0003', s: S, k: 'ask' } });
  ws.receive({ t: 'wed', id: 'peer-0002', data: { to: 'aaaa-0001', s: S, k: 'hug' } });
  assert.deepEqual(got.map((x) => [x.id, x.d.k, x.sub]), [['peer-0002', 'ask', 'acct-bran']]);
  for (let i = 0; i < WED_IN_HZ_MAX + 4; i++) quiet(() => ws.receive({ t: 'wed', id: 'peer-0002', data: { to: 'aaaa-0001', s: S, k: 'no' } }));
  assert.ok(got.length <= WED_IN_HZ_MAX + 1, 'the inbound gate per sender');
});

// ─── THE HANDSHAKE ──────────────────────────────────────────────────────────────────────────────────────────────

/** Two players' wedding managers on one fake wire, each with its half at the REAL Worker. `pump` delivers the wire's
 *  frames until nothing is on it AND no half is in flight at the service - never a count of turns, which a busy machine
 *  outruns (a crafted yes's answer landed after a fixed pump had returned). */
function pairOver(a, b, o = {}) {
  const q = [];
  let t = 0;
  let inflight = 0;
  const side = (me, other, id, otherId) => {
    const s = { said: [], wed: [], prompts: [], unprompts: [], can: null, peerCan: true, lose: false };
    s.mgr = createWedManager({
      send: (d) => { if (s.lose && d.k === 'done') return true; q.push({ to: d.to, from: id, d }); return true; },
      now: () => t, say: (l) => s.said.push(l), peerName: (p) => (p === otherId ? other.name : null), selfId: () => id,
      can: () => s.can, peerCan: () => s.peerCan,
      half: async (sid, partner) => { inflight++; try { return await me.halfFn(sid, partner); } finally { inflight--; } },
      onPrompt: (p) => s.prompts.push(p), onUnprompt: (p) => s.unprompts.push(p), onWed: (u, p) => s.wed.push({ u, p }),
      refusalText: (e) => `refused:${e}`, rand: o.rand,
    });
    return s;
  };
  const A = side(a, b, 'peer-000a', 'peer-000b');
  const B = side(b, a, 'peer-000b', 'peer-000a');
  const subs = { 'peer-000a': a.g.id, 'peer-000b': b.g.id };
  const mgrs = { 'peer-000a': A, 'peer-000b': B };
  const deliverable = () => q.length > 0 && !!mgrs[q[0].to];
  const pump = async () => {
    for (let i = 0; i < 100_000; i++) {
      while (deliverable()) { const f = q.shift(); mgrs[f.to].mgr.onFrame(f.from, f.d, subs[f.from]); }
      await settle(1);
      if (!inflight && !deliverable()) { await settle(2); if (!inflight && !deliverable()) return; }
    }
    throw new Error('the wire never settled');
  };
  return { A, B, q, pump, tick: (ms) => { t += ms; } };
}

test('LEGACY7 part three the handshake: asked, prompted, said yes (her half first), then his - the union the service made recorded on both sides, once; each knows the other by the card the service read', async () => {
  const Sv = await standService();
  const a = await houseOf(Sv, 'fam-k1-aaaaaa', 'Hlaalu', 'Ysolde'); a.name = 'Ysolde';
  const b = await houseOf(Sv, 'fam-k2-bbbbbb', 'Dres', 'Iszara', { gender: 'male', race: 'Redguard' }); b.name = 'Iszara';
  const { A, B, pump } = pairOver(a, b);
  assert.deepEqual(A.mgr.request('peer-000b'), { ok: true });
  assert.equal(A.mgr.stateFor('peer-000b'), 'outgoing');
  await pump();
  assert.deepEqual(B.prompts, ['peer-000a'], 'his prompt');
  assert.equal(B.mgr.stateFor('peer-000a'), 'incoming');
  assert.deepEqual(await B.mgr.accept('peer-000a'), { ok: true });
  await pump();
  assert.equal(A.wed.length, 1, 'her side recorded it');
  assert.equal(B.wed.length, 1, 'his side too - on the done, asked of the service');
  assert.equal(A.wed[0].u.sid, B.wed[0].u.sid);
  assert.equal(A.wed[0].u.partner.char, b.id);
  assert.equal(B.wed[0].u.partner.char, a.id);
  assert.deepEqual(B.wed[0].u.partner.house, { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 });
  assert.equal(A.mgr.stateFor('peer-000b'), 'none');
  assert.equal(B.mgr.stateFor('peer-000a'), 'none');
  assert.ok(A.said.some((l) => /You ask Iszara for their hand/.test(l)));
});

test('LEGACY7 part three the handshake\'s nos: declined (and a second ask at once answered unprompted); the asked side\'s own reason (no temple, no house); a peer of no house never asked; a proposal lapsed; one taken back closes the prompt', async () => {
  const Sv = await standService();
  const a = await houseOf(Sv, 'fam-k1-aaaaaa', 'Hlaalu', 'Ysolde'); a.name = 'Ysolde';
  const b = await houseOf(Sv, 'fam-k2-bbbbbb', 'Dres', 'Iszara'); b.name = 'Iszara';
  const { A, B, pump, tick } = pairOver(a, b);
  A.mgr.request('peer-000b');
  await pump();
  assert.deepEqual(B.mgr.decline('peer-000a'), { ok: true });
  await pump();
  assert.ok(A.said.includes(wedWhyText('declined', 'Iszara')));
  A.mgr.request('peer-000b');
  await pump();
  assert.equal(B.prompts.length, 1, 'declined a moment ago: no second prompt');
  assert.ok(A.said.filter((l) => l === wedWhyText('declined', 'Iszara')).length === 2, 'answered no, unprompted');
  tick(WED_REASK_MS + 1);
  // his own reason
  B.can = 'temple';
  A.mgr.request('peer-000b');
  await pump();
  assert.ok(A.said.includes(wedWhyText('temple', 'Iszara')));
  B.can = null;
  // a peer of no house is never asked
  A.peerCan = false;
  assert.deepEqual(A.mgr.request('peer-000b'), { ok: false, why: 'house' });
  A.peerCan = true;
  // my own reason
  A.can = 'wed';
  assert.deepEqual(A.mgr.request('peer-000b'), { ok: false, why: 'wed' });
  assert.equal(wedMineText('wed'), 'You are wed already.');
  A.can = null;
  // lapsed: unanswered past WED_ASK_TTL_MS, mine says so and theirs closes
  tick(WED_REASK_MS + 1);
  A.mgr.request('peer-000b');
  await pump();
  assert.equal(B.prompts.length, 2);
  tick(WED_ASK_TTL_MS + 1);
  A.mgr.tick();
  await pump();
  assert.ok(A.said.includes(wedWhyText('timeout')));
  assert.deepEqual(B.unprompts, ['peer-000a'], 'its prompt closes on her word, before its own clock says so');
  assert.ok(B.said.includes('Ysolde\'s proposal lapsed.'));
  assert.equal(B.mgr.stateFor('peer-000a'), 'none');
  B.mgr.tick();
  assert.deepEqual(B.unprompts, ['peer-000a'], 'once');
  // taken back
  tick(WED_REASK_MS + 1);
  A.mgr.request('peer-000b');
  await pump();
  assert.equal(B.prompts.length, 3);
  A.mgr.withdraw();
  await pump();
  assert.equal(B.unprompts.length, 2, 'taken back: the prompt closes');
  assert.ok(B.said.includes(wedWhyText('cancelled', 'Ysolde')));
  assert.equal(A.wed.length + B.wed.length, 0, 'nothing wed');
});

test('LEGACY7 part three the handshake\'s edges: crossed proposals make one wedding; a lost done is asked of the service at its time; a crafted yes with no half behind it makes nothing; a third proposal while one stands is answered busy', async () => {
  const Sv = await standService();
  const a = await houseOf(Sv, 'fam-k1-aaaaaa', 'Hlaalu', 'Ysolde'); a.name = 'Ysolde';
  const b = await houseOf(Sv, 'fam-k2-bbbbbb', 'Dres', 'Iszara'); b.name = 'Iszara';
  // crossed: both ask at once - the larger id takes the smaller's up
  const x = pairOver(a, b);
  x.A.mgr.request('peer-000b');
  x.B.mgr.request('peer-000a');
  await x.pump();
  assert.equal(x.A.wed.length, 1);
  assert.equal(x.B.wed.length, 1);
  assert.equal(x.A.wed[0].u.sid, x.B.wed[0].u.sid, 'one wedding, both words given');
  assert.equal((await unionsOf(a)).length, 1);
  // a lost done: his side asks the service itself after WED_DONE_WAIT_MS
  const c = await houseOf(Sv, 'fam-k3-cccccc', 'Indoril', 'Aldo'); c.name = 'Aldo';
  const d = await houseOf(Sv, 'fam-k4-dddddd', 'Redoran', 'Brara'); d.name = 'Brara';
  const y = pairOver(c, d);
  y.A.lose = true;   // her done never leaves
  y.A.mgr.request('peer-000b');
  await y.pump();
  await y.B.mgr.accept('peer-000a');
  await y.pump();
  assert.equal(y.A.wed.length, 1);
  assert.equal(y.B.wed.length, 0, 'no done yet');
  y.tick(WED_DONE_WAIT_MS + 1);
  y.B.mgr.tick();
  await y.pump();
  assert.equal(y.B.wed.length, 1, 'asked of the service: wed');
  // a crafted yes with no half behind it: her half waits, nothing is made, and she says so
  const e = await houseOf(Sv, 'fam-k5-eeeeee', 'Telvanni', 'Neloth'); e.name = 'Neloth';
  const f = await houseOf(Sv, 'fam-k6-ffffff', 'Hlaalu', 'Mira'); f.name = 'Mira';
  const z = pairOver(e, f);
  z.A.mgr.request('peer-000b');
  const askSid = z.q.find((fr) => fr.d.k === 'ask').d.s;
  await z.pump();
  assert.equal(z.B.mgr.stateFor('peer-000a'), 'incoming');
  // he never says yes at the service - a crafted yes on the wire
  z.A.mgr.onFrame('peer-000b', { k: 'yes', to: 'peer-000a', s: askSid }, f.g.id);
  await z.pump();
  assert.equal(z.A.wed.length, 0, 'nothing made');
  assert.ok(z.A.said.some((l) => /The wedding did not happen/.test(l)));
  assert.equal(z.B.mgr.stateFor('peer-000a'), 'none', 'his prompt answered by her no');
  // busy: a third proposal while his yes stands
  const g = await houseOf(Sv, 'fam-k7-gggggg', 'Dres', 'Tilse'); g.name = 'Tilse';
  const h = await houseOf(Sv, 'fam-k8-hhhhhh', 'Indoril', 'Gilvas'); h.name = 'Gilvas';
  const w = pairOver(g, h);
  w.A.lose = true;
  w.A.mgr.request('peer-000b');
  await w.pump();
  await w.B.mgr.accept('peer-000a');
  await w.pump();
  assert.equal(w.B.mgr.stateFor('peer-000a'), 'waiting');
  w.B.mgr.onFrame('peer-000c', { k: 'ask', to: 'peer-000b', s: 'otherSid01' }, 'acct-other');
  assert.ok(w.q.some((fr) => fr.to === 'peer-000c' && fr.d.k === 'no' && fr.d.why === 'busy'), 'answered busy');
  assert.equal(w.B.prompts.length, 1, 'and never prompted');
});

// ─── THE HOUSE ──────────────────────────────────────────────────────────────────────────────────────────────────

const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (cid, name = 'Ysolde Hlaalu') => ({
  name, gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});
const CARD = { player: 'acct-iszara', char: 'r0123456789abcdef0123', name: 'Iszara Dres', house: { hn: 'Dres', hc: 'Iszara', hb: 1, hg: 2 }, gender: 'male', race: 'Redguard', face: 7 };
const union = (sid, extra = {}) => ({ sid, mine: 'r-ysolde', partner: CARD, at: 5, endedAt: null, endedWhy: null, endedBy: null, ...extra });

function house({ temple = 77, realm = 'r-ysolde', online = true, model = MODELS.bloodline } = {}) {
  _resetModSaveData();
  _resetModSettings();
  const storage = mem(), tab = mem();
  const w = { said: [], tombs: [], storage, temple, realm, online, fight: false, own: 0 };
  w.host = createLegacyHost({
    entity: ent('r-ysolde'), storage: () => storage, tab: () => tab, on: () => true, online: () => w.online, now: () => 100, own: () => w.own,
    here: () => null, town: () => null, nearestTown: () => null, gold: () => 0, say: (l) => w.said.push(l), boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => w.fight, rng: familyRng(5),
    templeOf: () => w.temple, realmId: () => w.realm, sky: () => 1000,
    tombstone: (why) => { w.tombs.push(why); return Promise.resolve(true); },
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(model);
  _resetModSettings();
  return w;
}

test('LEGACY7 part three the house\'s law: who may wed online - a realm character of the house, alive, of the blood and of age, wed to nobody, no Succession waiting, out of a fight, in a temple', () => {
  const w = house();
  assert.equal(w.host.wedRefusal(), null);
  w.temple = null; assert.equal(w.host.wedRefusal(), 'temple'); w.temple = 77;
  w.fight = true; assert.equal(w.host.wedRefusal(), 'busy'); w.fight = false;
  w.realm = 'r-other'; assert.equal(w.host.wedRefusal(), 'house', 'the realm character this tab plays is not this person'); w.realm = 'r-ysolde';
  w.online = false; assert.equal(w.host.wedRefusal(), 'house', 'offline weds no other player'); w.online = true;
  w.host.current().minor = true; assert.equal(w.host.wedRefusal(), 'busy'); w.host.current().minor = false;
  w.host.wedPlayer(union('wedAbc1234'));
  assert.equal(w.host.wedRefusal(), 'wed');
});

test('LEGACY7 part three the record: the other player\'s character as the spouse - their own name and house, their sex, race and face off their own line - once a union; children on the member\'s own clock; a union the other\'s death or delete ended ends here, one this house\'s own death ended needs nothing', () => {
  const w = house();
  const me = w.host.current();
  const s = w.host.wedPlayer(union('wedAbc1234'));
  assert.ok(s);
  assert.deepEqual([s.kind, s.given, s.surname, s.gender, s.race, s.face, s.spouse], ['player', 'Iszara', 'Dres', 'male', 'Redguard', 7, me.id]);
  assert.deepEqual(s.realm, { sid: 'wedAbc1234', player: 'acct-iszara', char: 'r0123456789abcdef0123', house: { hn: 'Dres', hc: 'Iszara', hb: 1, hg: 2 } });
  assert.equal(me.spouse, s.id);
  assert.ok(w.said.includes(MARRIAGE_TEXT.wedPlayer('Iszara Dres')));
  assert.equal(w.host.wedPlayer(union('wedAbc1234')), s, 'once a union');
  assert.equal(w.host.family.people.filter((p) => p.kind === 'player').length, 1);
  assert.equal(w.host.family.news?.at(-1)?.k, 'wed', 'the towns hear of it');
  // the record read back keeps the union's shape
  const back = readFamily(JSON.parse(JSON.stringify(w.host.family)));
  assert.deepEqual(personOf(back, s.id).realm, s.realm);
  const junk = readFamily({ ...JSON.parse(JSON.stringify(w.host.family)), people: w.host.family.people.map((p) => (p.id === s.id ? { ...p, realm: { sid: 'x' } } : p)) });
  assert.equal(personOf(junk, s.id).realm, null, 'a union of no shape is none');
  // children on the member's own clock, the player spouse a parent like any
  let kid = null;
  for (let day = CHILD_DAYS; day < CHILD_DAYS * 40 && !kid; day += CHILD_DAYS) kid = childStep(w.host.family, me, { day, rng: familyRng(day), at: 100 });
  assert.ok(kid, 'a child, in time');
  assert.ok(kid.parents.includes(me.id) && kid.parents.includes(s.id));
  assert.equal(kid.surname, w.host.family.surname, 'of this house');
  // unions heard: one ended by this house's own death needs nothing; the other's death ends it here
  assert.equal(w.host.unionsHeard([union('wedAbc1234', { endedAt: 9, endedWhy: 'died', endedBy: 'mine' })]), 0);
  assert.ok(isAlive(s));
  assert.equal(w.host.unionsHeard([union('wedAbc1234', { endedAt: 9, endedWhy: 'died', endedBy: 'partner' })]), 1);
  assert.equal(s.died?.cause, 'fell');
  assert.ok(w.said.includes(MARRIAGE_TEXT.lost('Iszara Dres')));
  assert.equal(spouseOf(w.host.family, me), null, 'the member may wed again');
  assert.equal(w.host.wedRefusal(), null);
  // a union made while this device was away: recorded at the boot's read; one ended before it was heard, recorded ended
  const CARD2 = { ...CARD, char: 'r0123456789abcdef0124', name: 'Aldo Indoril', house: { hn: 'Indoril', hc: 'Aldo' } };
  assert.equal(w.host.unionsHeard([union('wedNew0001', { partner: CARD2, endedAt: 12, endedWhy: 'gone', endedBy: 'partner' })]), 2);
  const gone = unionSpouse(w.host.family, 'wedNew0001');
  assert.equal(gone.died.cause, 'gone');
  assert.ok(w.said.includes(MARRIAGE_TEXT.gone('Aldo Indoril')));
  assert.equal(w.host.unionsHeard(null), 0);
});

test('LEGACY7 part three the law beneath: wedPlayer and its end held to their own shapes; a wedding a fact as a death is when two copies merge; the tree hangs a player spouse beside their member; the card names their house; the tombstone says a retirement', async () => {
  const fam = foundFamily(ent('r1'), { id: 'fam-k1-abc123', model: MODELS.bloodline });
  const me = personOf(fam, 1);
  const s = wedPlayer(fam, me, { player: 'acct-x', char: 'r-x', name: 'Mira Hlaalu', house: { hn: 'Bad<', hc: 'Mira' }, gender: 'female', race: 'Nope', face: -2 }, 'wedShape01', 50);
  assert.deepEqual([s.given, s.surname, s.race, s.face, s.realm.house], ['Mira', 'Hlaalu', 'Breton', 0, null], 'a house that does not fit its law: the realm name and the defaults');
  assert.equal(playerSpouseLost(fam, me, 60, 'died'), false, 'only a player spouse');
  assert.equal(playerSpouseLost(fam, s, 60, 'died'), true);
  assert.equal(playerSpouseLost(fam, s, 61, 'died'), false, 'once');
  // the merge: the copy that lost the member's word that they were wed takes it back
  const a = foundFamily(ent('r2'), { id: 'fam-k2-abc123', model: MODELS.bloodline });
  const stale = readFamily(JSON.parse(JSON.stringify(a)));
  wedPlayer(a, personOf(a, 1), CARD, 'wedMerge01', 70);
  mergeFacts(stale, a);
  assert.equal(personOf(stale, 1).spouse, personOf(a, 1).spouse, 'the wedding stands in the merged copy');
  // the tree: beside their member, never a root of their own
  const sib = addChild(a, null, { rng: familyRng(3) }).person;
  sib.parents = [];
  const t = layoutTree(a);
  const sp = personOf(a, 1).spouse;
  assert.ok(t.couples.some((c) => c.a === 1 && c.b === sp), 'a couple');
  assert.equal(t.nodes.filter((n) => n.id === sp).length, 1);
  // the card's words
  const ps = personOf(a, sp);
  assert.ok(personChips(a, ps, 0).some((c) => c.text === 'Wed from another house'));
  assert.equal(identityLine(ps), `Redguard - ${BLOODLINE_MARK} Iszara II of House Dres`);
  assert.equal(livesLine(a, ps), 'With their own house, wherever its road leads');
  ps.died = { at: 1, cause: 'gone' };
  assert.ok(personChips(a, ps, 0).some((c) => c.text === 'Gone from the realm'));
  // the tombstone of a retirement says so
  const w = house({ model: MODELS.enduring });
  w.host.current().toll = 100;
  assert.equal(w.host.passMantle().ok, true);
  await settle(2);
  assert.deepEqual(w.tombs, ['retired']);
  const v = house();
  v.host.deathOutcome();
  await settle(2);
  assert.deepEqual(v.tombs, ['fell']);
  // and the session carries it
  const asked = [];
  const fetch = async (url, init) => { asked.push(JSON.parse(init.body)); return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, deadAt: 5 }) }; };
  const sess = createRealmSession({ io: { fetch, base: 'https://a', secret: 's', storage: null }, id: 'r0123456789abcdef0123', lease: 'f'.repeat(32), seq: 3, later: () => () => {}, watchHidden: () => {} });
  assert.equal(await sess.die('retired'), true);
  assert.deepEqual(asked[0], { id: 'r0123456789abcdef0123', lease: 'f'.repeat(32), why: 'retired' });
});

// ─── THE FACES AND THE WIRING ───────────────────────────────────────────────────────────────────────────────────

test('LEGACY7 part three the inspect card: the Propose button beside the Challenge, its reason under a disabled one, its press the host\'s; and the world host\'s wiring', () => {
  const v = profileView({ name: 'Iszara', peer: {}, wed: { label: 'Propose marriage', enabled: false, why: 'You are wed already.' } });
  assert.deepEqual(v.wed, { label: 'Propose marriage', enabled: false, why: 'You are wed already.' });
  assert.equal(profileView({ name: 'Iszara', peer: {} }).wed, null);
  assert.deepEqual(profileView({ name: 'I', peer: {}, wed: { label: 'Propose marriage', enabled: true, why: 'x' } }).wed, { label: 'Propose marriage', enabled: true, why: null });
  const w = rd('src/scenes/world.js');
  assert.match(w, /online\.onWed = \(id, d, sub = null\) => \{ wedMgr\.onFrame\(id, d, sub\); \};/);
  assert.match(w, /onWed: \(peerId\) => wedPropose\(peerId\),/);
  assert.match(w, /wed: wedButtonFor\(peerId\),/);
  assert.match(w, /half: \(sid, partner\) => \(realmSession && !realmSession\.lost \? realmSession\.wed\(sid, partner\)/);
  assert.match(w, /onWed: \(union\) => \{ legacyHost\?\.wedPlayer\(union\); \},/);
  assert.match(w, /peerCan: \(id\) => !!online\?\.peers\.get\(id\)\?\.house,/);
  assert.match(w, /wedFrame\(\);/);
  assert.match(w, /tombstone: \(why\) => \(realmSession \? realmSession\.die\(why\) : false\),/);
  assert.match(w, /realmId: \(\) => realmSession\?\.id \?\? null,/);
  assert.match(w, /realmUnions\(realmIoNow\(\)\)\.then\(\(r\) => \{ if \(r\.ok\) legacyHost\?\.unionsHeard\(r\.unions\); \}\)/);
  assert.match(rd('server/src/index.js'), /this\._send\(tws, JSON\.stringify\(\{ t: 'wed', id: a\.id, \.\.\.\(typeof a\.sub === 'string' && a\.sub \? \{ sub: a\.sub \} : \{\}\), data: m\.data \}\)\);/);
});
