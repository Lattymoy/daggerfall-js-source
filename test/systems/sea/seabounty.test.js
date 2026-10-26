// SEA-BOUNTY (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - a freeport's
// bounty board on the Eltheric Ocean's killers; bible/03-World/Eltheric-Ocean.md SEA-BOUNTY): a fall's receipt names its
// room and its killer's character (net/wild/wildReceipt.js, signed by the relay that refereed it); the open sea's rooms
// (net/wire.js seaRoomOf); the service's board, posts, claims and collects over its real routes and a real record
// (server-account/src/seaBounty.js, wild.js); the page's half (scenes/seaBountyHost.js) and the tab's words
// (ui/naval/navalYardWindow.js wantedText); the seams by source. tools/mutants/seabounty.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintWildReceipt, verifyWildReceipt, wildReceiptValid, wildCollectValid, WILD_RECEIPT_MAX, WILD_ROOM_RE } from '../../../src/net/wild/wildReceipt.js';
import { seaRoomOf, seaVaultMapId, WILD_SEA_BOX, worldRoom, PIXEL_UNITS, DUEL_REF_RECEIPT_MAX, WILD_COLLECT_MAX, validWildRefOut } from '../../../src/net/wire.js';
import { ETHER_BOX } from '../../../src/world/ethericSea.js';
import { SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import * as B from '../../../src/net/sea/seaBountyLaw.js';
import { SEA_COLLECT_ROWS, seaKillSteps } from '../../../server-account/src/seaBounty.js';
import { REALM_EMPIRE_ACCOUNT } from '../../../src/net/realm/realmGoldLaw.js';
import { accountSeaBounty, REFUSALS, SESSION_KEY } from '../../../src/net/accountClient.js';
import { createSeaBounty, SEA_BOARD_FRESH_MS } from '../../../src/scenes/seaBountyHost.js';
import { wantedText, etherOfficeText, mountNavalYardWindow } from '../../../src/ui/naval/navalYardWindow.js';
import { payableOf } from '../../../src/net/realm/realmGoldLaw.js';
import { fakeRoom } from '../../fakeRoom.mjs';
import { standService } from '../../accountDb.mjs';
import { seatRealm, recordOf } from '../../realmSeat.mjs';

const { subtle } = globalThis.crypto;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const keys = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const SEA_CELL = worldRoom(7800, -5000);
const BAY_CELL = worldRoom(400, 120);
const RC = 'r00000000000000000b01', RK = 'r00000000000000000b02';

test('SEA-BOUNTY the receipt and the sea\'s rooms: a fall names the room it fell in and its killer\'s character (both optional - an older relay\'s names neither), within the wire\'s bounds; a collect names neither; a room is the open sea\'s by its cell in the sea\'s box or an isle place\'s map id (mutants: the claims\' shapes, the bounds, the box, the lane)', async () => {
  assert.deepEqual([WILD_RECEIPT_MAX, DUEL_REF_RECEIPT_MAX, WILD_COLLECT_MAX], [512, 512, 512]);
  const ok = { f: 'acct-aaaa', c: RC, k: 'acct-bbbb', r: '0123456789ab', w: -1, i: T, e: T + 60 };
  assert.ok(wildReceiptValid(ok), 'an older relay\'s: neither');
  assert.ok(wildReceiptValid({ ...ok, m: SEA_CELL, kc: RK }));
  for (const bad of [{ m: '' }, { m: 'room' }, { m: 'World:1,2' }, { m: `world:${'1'.repeat(81)}` }, { m: 'world:1 2' }, { m: 5 }, { m: [SEA_CELL] }, { kc: 'nope' }, { kc: [RK] }, { kc: '' }, { kc: 7 }]) assert.equal(wildReceiptValid({ ...ok, ...bad }), false, JSON.stringify(bad));
  assert.ok(WILD_ROOM_RE.test(`interior:m${seaVaultMapId(805, 498)}.4294967295.12345678`));
  assert.equal(wildCollectValid({ r: '0123456789ab', k: 'acct-bbbb', c: RK, i: T, e: T + 60, m: SEA_CELL }), false, 'a collect never carries a fall\'s room');
  assert.equal(wildCollectValid({ r: '0123456789ab', k: 'acct-bbbb', c: RK, i: T, e: T + 60, kc: RK }), false);
  assert.ok(wildCollectValid({ r: '0123456789ab', k: 'acct-bbbb', c: RK, i: T, e: T + 60 }));
  const kp = await keys();
  const longest = await mintWildReceipt({ f: 'a'.repeat(40), c: RC, k: 'b'.repeat(40), r: '0123456789ab', w: 15, wt: [65535, 65535], m: `interior:m${seaVaultMapId(805, 498)}.4294967295.4294967295`, kc: RK }, kp.privateKey, { subtle, nowS: T });
  assert.ok(longest.length <= WILD_RECEIPT_MAX, `the longest fits: ${longest.length}`);
  assert.ok(validWildRefOut({ t: 'wref', k: 'rc', r: '0123456789ab', rc: longest }), 'and the wire carries it');
  const v = await verifyWildReceipt(longest, kp.publicKey, { subtle, nowS: T + 1 });
  assert.deepEqual([v.ok, v.claims.kc], [true, RK]);
  const plain = await mintWildReceipt({ f: 'acct-aaaa', c: RC, k: 'acct-bbbb', r: '0123456789ab', w: -1 }, kp.privateKey, { subtle, nowS: T });
  assert.deepEqual(Object.keys((await verifyWildReceipt(plain, kp.publicKey, { subtle, nowS: T + 1 })).claims).sort(), ['c', 'e', 'f', 'i', 'k', 'r', 'w'], 'none minted where none is given');
  // the open sea's rooms
  assert.deepEqual({ ...WILD_SEA_BOX }, { x0: ETHER_BOX.x0, x1: ETHER_BOX.x1, y0: ETHER_BOX.y0, y1: ETHER_BOX.y1 }, 'the relay\'s copy of the sea\'s box is the sea\'s');
  assert.equal(seaRoomOf(SEA_CELL), true);
  assert.equal(seaRoomOf(BAY_CELL), false, 'the Bay');
  assert.deepEqual(['world:3,-300', 'world:4,-300', 'world:507,-300', 'world:508,-300'].map(seaRoomOf), [false, true, true, false], 'its west and east edges, by a cell\'s middle');
  assert.deepEqual(['world:100,-481', 'world:100,-480', 'world:100,-169', 'world:100,-168'].map(seaRoomOf), [false, true, true, false], 'its north and south edges');
  const id = seaVaultMapId(400, 13);
  assert.deepEqual([`dungeon:m${id}`, `dungeon:m${id}.m`, `interior:m${id}.123.0`].map(seaRoomOf), [true, true, true], 'an isle place\'s dungeon, re-laid, and its buildings');
  assert.deepEqual(['dungeon:m187853213', 'interior:m187853213.1.0', `dungeon:m${(0xe6 << 20) | 500005}`, `town:m${id}`, `dungeonx:m${id}`, `dungeon:m${id}x`, 'world:1,2,3', `${SEA_CELL},3`, `${SEA_CELL}.5`, 'world:a,b', '', null, 5, `world:${'1'.repeat(100)},1`].map(seaRoomOf), new Array(14).fill(false), 'nothing else');
});

test('SEA-BOUNTY the relay signs the room and the killer\'s character: a fall in a cell of the open sea, end to end over the fake relay, its receipt naming that cell and the killer\'s realm character (mutants: the room unpassed, the character unkept, the mint\'s)', async () => {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  try {
    const PX = 7800, PY = -5000;
    const r = fakeRoom(SEA_CELL, { now: () => clock });
    const kp = await keys();
    r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
    const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
    const P = (x) => ({ x: BASE.x + x * SIEGE_UNITS_PER_M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
    const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, rc: 1, ci }); await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } })); return ws; };
    const a = await join('peer-0001', -1, RK), b = await join('peer-0002', 1, RC);
    let fell = null;
    for (let k = 0; k < 400 && !fell; k++) {
      clock += 300;
      await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0002', n: 100 + k, by: 'melee', p: [BASE.x - SIEGE_UNITS_PER_M, 0, BASE.z], d: 999 } }));
      fell = b.sent.find((m) => m.t === 'wref' && m.k === 'fell') ?? null;
    }
    assert.ok(fell, 'the fallen');
    await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'pick', r: fell.r, w: -1 } }));
    const rc = a.sent.find((m) => m.t === 'wref' && m.k === 'rc');
    assert.ok(rc, 'signed');
    const v = await verifyWildReceipt(rc.rc, kp.publicKey, { subtle, nowS: T + 60 });
    assert.ok(v.ok, v.why);
    assert.deepEqual([v.claims.m, v.claims.kc, v.claims.c, v.claims.k], [SEA_CELL, RK, RC, 'acct-peer-0001']);
    assert.equal(seaRoomOf(v.claims.m), true);
  } finally { Date.now = realNow; }
});

/** The service, four realm characters - kim the killer, val her victim, pat a poster, hal the hunter - each with 5,000 gold
 *  in the purse and an empty Empire account. */
async function harbour() {
  const svc = await standService();
  const who = {}, R = {};
  for (const n of ['kim', 'val', 'pat', 'hal']) {
    who[n] = await svc.registered(n);
    R[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000, bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
  }
  const nowS = () => Math.floor(Date.now() / 1000);
  const fall = async (killer, fallen, r, o = {}) => {
    const receipt = await mintWildReceipt({ f: who[fallen].id, c: R[fallen].id, k: who[killer].id, r, w: -1, m: SEA_CELL, kc: R[killer].id, ...o }, svc.gatePriv, { subtle, nowS: nowS() });
    return svc.call('/v1/wild/fall', { receipt, realm: R[fallen].at(), room: o.m ?? SEA_CELL }, who[fallen].secret);
  };
  const call = (n, path, body) => svc.call(path, body, who[n].secret);
  const board = async (n) => (await call(n, '/v1/sea/bounty/board', { character: R[n].id })).body;
  const post = (n, target, gold, rid = `rid-${Math.random().toString(36).slice(2, 12)}`) => call(n, '/v1/sea/bounty/post', { character: R[n].id, realm: R[n].at(), region: 19, target: R[target].id, gold, rid });
  const collect = (n) => call(n, '/v1/sea/bounty/collect', { character: R[n].id, realm: R[n].at(), region: 19 });
  const gold = (n) => payableOf(recordOf(svc.env, R[n].id), 19);
  const rows = (sql, ...a) => svc.env.DB._raw.prepare(sql).all(...a);
  const record = (n) => recordOf(svc.env, R[n].id);
  const raw = (sql, ...a) => svc.env.DB._raw.prepare(sql).run(...a);
  return { svc, who, R, fall, board, post, collect, gold, rows, record, raw, nowS };
}

test('SEA-BOUNTY the service, end to end over its routes and real records: a kill at sea makes its killer wanted; a post leaves its poster\'s record onto a wanted head, once a request; the wanted captain\'s fall at sea at another\'s hand claims it all for that hand\'s character, once a fall; the hand collects it into its record, once; no gold made (mutants: the kill, the claim, the once, the wanted, the self, the gold, the owed, the collect)', async () => {
  const h = await harbour();
  assert.deepEqual(await h.board('pat'), { wanted: [], owed: 0, refund: 0, mine: 0, prizes: 0, back: 0 }, 'a quiet sea');   // PIN MOVED (SHIP-PVP): and no prize held either way; PIN MOVED (AUDIT SEA VENTURES B4): nor posts on a head gone
  assert.equal((await h.post('pat', 'kim', 500)).body.error, 'sea-bounty-not-wanted', 'nobody is wanted yet');
  // kim kills val at sea
  const f1 = await h.fall('kim', 'val', 'aaaaaaaaaaaa');
  assert.equal(f1.status, 200, JSON.stringify(f1.body));
  assert.deepEqual((await h.board('pat')).wanted, [{ char: h.R.kim.id, name: 'kim', kills: 1, bounty: 0 }], 'kim is wanted');
  assert.deepEqual(h.rows('SELECT killer, killer_char, victim, victim_char FROM sea_kills').map((x) => ({ ...x })), [{ killer: h.who.kim.id, killer_char: h.R.kim.id, victim: h.who.val.id, victim_char: h.R.val.id }]);
  // a fall not at sea, and one an older relay signed: no kill at sea
  assert.equal((await h.fall('kim', 'val', 'cccccccccccc', { m: BAY_CELL })).status, 200);
  assert.equal((await h.fall('kim', 'val', 'dddddddddddd', { kc: undefined })).status, 200);
  assert.equal(h.rows('SELECT r FROM sea_kills').length, 1, 'the Bay\'s fall and the unnamed character\'s are no kills at sea');
  // pat posts on kim
  const p1 = await h.post('pat', 'kim', 2000, 'rid-pat-0001');
  assert.equal(p1.status, 200, JSON.stringify(p1.body));
  assert.deepEqual([p1.body.gold, p1.body.bounty], [2000, 2000]);
  assert.equal(h.gold('pat'), 3000, 'off pat\'s own record');
  const again = await h.post('pat', 'kim', 2000, 'rid-pat-0001');
  assert.deepEqual([again.body.repeat, again.body.bounty, h.gold('pat')], [true, 2000, 3000], 'asked twice, one post');
  assert.equal((await h.post('pat', 'kim', B.SEA_BOUNTY_MIN - 1)).body.error, 'sea-bounty-gold');
  assert.equal((await h.post('pat', 'kim', B.SEA_BOUNTY_MAX + 1)).body.error, 'sea-bounty-gold');
  assert.equal((await h.post('kim', 'kim', 500)).body.error, 'sea-bounty-self', 'never on one\'s own head');
  assert.equal((await h.post('pat', 'val', 500)).body.error, 'sea-bounty-not-wanted', 'a victim is no killer');
  assert.equal((await h.svc.call('/v1/sea/bounty/post', { character: h.R.pat.id, realm: h.R.pat.at(), region: 19, target: 'nope', gold: 500, rid: 'rid-pat-0002' }, h.who.pat.secret)).body.error, 'sea-bounty-target');
  assert.equal((await h.svc.call('/v1/sea/bounty/post', { character: h.R.pat.id, realm: h.R.pat.at(), region: 99, target: h.R.kim.id, gold: 500, rid: 'rid-pat-0003' }, h.who.pat.secret)).body.error, 'bad-region');
  assert.equal((await h.svc.call('/v1/sea/bounty/post', { character: h.R.pat.id, realm: h.R.pat.at(), region: 19, target: h.R.kim.id, gold: 500, rid: 'x' }, h.who.pat.secret)).body.error, 'bad-rid');
  assert.equal((await h.svc.call('/v1/sea/bounty/post', { region: 19, target: h.R.kim.id, gold: 500, rid: 'rid-pat-0004' }, h.who.pat.secret)).body.error, 'sea-bounty-realm', 'a realm character\'s act alone');
  assert.equal((await h.svc.call('/v1/sea/bounty/collect', { region: 19 }, h.who.pat.secret)).body.error, 'sea-bounty-realm');
  h.raw('UPDATE realm_characters SET held = ?1 WHERE id = ?2', 'law', h.R.pat.id);
  assert.equal((await h.post('pat', 'kim', 500)).body.error, 'trade-held', 'a held record hands no gold toward another\'s hand');
  h.raw('UPDATE realm_characters SET held = NULL WHERE id = ?1', h.R.pat.id);
  assert.equal(h.gold('val'), 3645, 'three falls, a tenth of her purse each');   // PIN MOVED (FOE-KEEPS, bible/11-Multiplayer/Wild-Zone.md section 4): a tenth, the usual death's share - it was half (625)
  assert.equal((await h.post('val', 'kim', 4000)).body.error, 'realm-gold', 'more than her record holds');   // PIN MOVED (FOE-KEEPS): her 3,645 - it was 1,000 past her 625
  assert.equal((await h.post('val', 'kim', 500)).status, 200, 'the victim posts too');
  assert.equal((await h.board('kim')).mine, 2500, 'kim sees the bounty on her own head');
  assert.equal((await h.board('pat')).wanted[0].bounty, 2500);
  // hal kills kim at sea: every standing post claimed for hal's character, once
  const f2 = await h.fall('hal', 'kim', 'bbbbbbbbbbbb');
  assert.equal(f2.status, 200, JSON.stringify(f2.body));
  assert.equal((await h.fall('hal', 'kim', 'bbbbbbbbbbbb')).status, 200, 'asked again');
  assert.deepEqual(h.rows('SELECT killer, killer_char, target_char, gold, paid_at FROM sea_bounty_owed').map((x) => ({ ...x })), [{ killer: h.who.hal.id, killer_char: h.R.hal.id, target_char: h.R.kim.id, gold: 2500, paid_at: null }], 'owed once');
  const hb = await h.board('hal');
  assert.equal(hb.owed, 2500);
  assert.deepEqual(hb.wanted.map((w) => [w.name, w.kills, w.bounty]), [['hal', 1, 0], ['kim', 1, 0]], 'hal wanted now too; kim\'s head clear');
  assert.equal((await h.board('pat')).owed, 0, 'owed to hal\'s character alone');
  // a post after the claim stands for the next hand
  assert.equal((await h.post('pat', 'kim', 500)).body.bounty, 500);
  assert.deepEqual((await h.board('val')).wanted.map((w) => [w.name, w.kills, w.bounty]), [['kim', 1, 500], ['hal', 1, 0]], 'the largest bounty first');
  // hal collects
  const before = h.gold('hal');
  const c1 = await h.collect('hal');
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  assert.equal(c1.body.gold, 2500);
  assert.equal(h.gold('hal'), before + 2500, 'into hal\'s record');
  assert.deepEqual([h.record('hal').bankAccounts[REALM_EMPIRE_ACCOUNT].accountGold, h.record('hal').goldPieces], [2500, 5000], 'banked in the Empire\'s account, as a market\'s gold is collected - the purse untouched');
  assert.deepEqual((await h.collect('hal')).body, { ok: true, gold: 0 }, 'collected once');
  assert.equal((await h.board('hal')).owed, 0, 'and owed no more');
  assert.deepEqual((await h.collect('pat')).body, { ok: true, gold: 0 }, 'nothing owed pat');
  // hal ends val at sea too, and pat ends kim: the 500 standing claimed for pat - this fall's posts, never an earlier one's
  assert.equal((await h.fall('hal', 'val', 'eeeeeeeeeeee')).status, 200);
  assert.equal((await h.fall('pat', 'kim', 'ffffffffffff')).status, 200);
  assert.deepEqual(h.rows('SELECT killer_char, gold FROM sea_bounty_owed WHERE r = ?', 'ffffffffffff').map((x) => ({ ...x })), [{ killer_char: h.R.pat.id, gold: 500 }]);
  assert.equal((await h.board('pat')).owed, 500);
  assert.deepEqual((await h.board('val')).wanted.map((w) => [w.name, w.kills, w.bounty]), [['hal', 2, 0], ['kim', 1, 0], ['pat', 1, 0]], 'the most kills first where no bounty stands');
  // two tabs bring one fall at once (wild.js answers a fall asked again from its row - this is the batch's own guard): the
  // second claims nothing posted since, writes no second kill and owes nothing twice
  const db = h.svc.env.DB;
  const race = { r: 'abababababab', f: h.who.kim.id, c: h.R.kim.id, k: h.who.pat.id, kc: h.R.pat.id, m: SEA_CELL };
  assert.equal((await h.post('hal', 'kim', 500)).status, 200);
  await db.batch(seaKillSteps(db, race, h.nowS()));
  assert.equal((await h.post('hal', 'kim', 500)).body.bounty, 500, 'a post after the race\'s first batch');
  await db.batch(seaKillSteps(db, race, h.nowS()));
  assert.deepEqual([h.rows('SELECT gold FROM sea_bounty_owed WHERE r = ?', race.r).map((x) => x.gold), h.rows('SELECT r FROM sea_kills WHERE r = ?', race.r).length, (await h.board('val')).wanted[0].bounty], [[500], 1, 500]);
  assert.deepEqual(seaKillSteps(db, { ...race, kc: '' }, h.nowS()), [], 'no character named: no kill at sea');
  assert.deepEqual(seaKillSteps(db, { ...race, m: BAY_CELL }, h.nowS()), [], 'nor in the Bay');
  // fifteen days on: a kill makes its captain wanted no more; a bounty standing still does
  const realNow = Date.now;
  Date.now = () => realNow() + (B.SEA_WANTED_DAYS * 86_400 + 3600) * 1000;
  try {
    assert.deepEqual((await h.board('val')).wanted.map((w) => [w.name, w.kills, w.bounty]), [['kim', 0, 500]]);
    assert.equal((await h.post('hal', 'pat', 100)).body.error, 'sea-bounty-not-wanted', 'pat\'s kills are old');
    assert.equal((await h.post('hal', 'kim', 500)).body.bounty, 1000, 'kim\'s bounty keeps her wanted');
  } finally { Date.now = realNow; }
  // a second character of kim's own account (seated, it takes the account's lease)
  const kim2 = await seatRealm(h.svc.env, h.who.kim.secret, 'kim2', { name: 'kim2', level: 5, items: [], goldPieces: 5000 });
  assert.equal((await h.svc.call('/v1/sea/bounty/post', { character: kim2.id, realm: kim2.at(), region: 19, target: h.R.kim.id, gold: 500, rid: 'rid-kim2-001' }, h.who.kim.secret)).body.error, 'sea-bounty-self', 'nor from another character of one\'s own account');
  // a dead captain is wanted no more
  h.raw('UPDATE realm_characters SET dead_at = ?1 WHERE id = ?2', h.nowS(), h.R.kim.id);
  assert.deepEqual((await h.board('val')).wanted.map((w) => w.name), ['hal', 'pat']);
  assert.equal((await h.post('hal', 'kim', 500)).body.error, 'sea-bounty-not-wanted');
  // no gold made: what left the posters is what was owed, or still stands
  const posted = h.rows('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties')[0].n;
  const owed = h.rows('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounty_owed')[0].n;
  const standing = h.rows('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties WHERE claimed_r IS NULL')[0].n;
  assert.deepEqual([posted, owed + standing], [4500, 4500]);
  assert.equal(SEA_COLLECT_ROWS, 64);
});

test('SEA-BOUNTY the board\'s law: its bounds and presses, a wanted captain for SEA_WANTED_DAYS, its rows at most SEA_BOARD_MAX; an answer read safely (mutants: the bounds, the read)', () => {
  assert.deepEqual([B.SEA_BOUNTY_MIN, B.SEA_BOUNTY_MAX, B.SEA_WANTED_DAYS, B.SEA_BOARD_MAX], [100, 50_000, 14, 12]);
  assert.deepEqual([...B.SEA_BOUNTY_POSTS], [500, 2000, 10_000]);
  assert.deepEqual([99, 100, 50_000, 50_001, 100.5, '500'].map(B.seaBountyGoldOk), [false, true, true, false, false, false]);
  assert.equal(B.readSeaBoard(null), null);
  assert.equal(B.readSeaBoard({ wanted: 'x' }), null);
  const many = Array.from({ length: 20 }, (_, i) => ({ char: `r${i}`, name: `n${i}`, kills: i, bounty: i * 10 }));
  assert.equal(B.readSeaBoard({ wanted: many }).wanted.length, B.SEA_BOARD_MAX);
  assert.deepEqual(B.readSeaBoard({ wanted: [{ char: 'r1', name: 'kim', kills: -3, bounty: 1.5 }, { char: 'r2', name: '' }, { name: 'x' }, null], owed: 'x', mine: 40 }), { wanted: [{ char: 'r1', name: 'kim', kills: 0, bounty: 0 }], owed: 0, refund: 0, mine: 40, prizes: 0, back: 0 });   // PIN MOVED (SHIP-PVP): the prizes' counts; PIN MOVED (AUDIT SEA VENTURES B4): the refund's
});

/** The page's half over a fake door, session and wallet. */
function page({ live = true, board = { wanted: [{ char: RK, name: 'kim', kills: 3, bounty: 2500 }], owed: 900, mine: 0 }, postAnswer = null } = {}) {
  const st = { live, now: 10_000_000, paid: [], undone: [], banked: [], asked: [], checks: 0 };
  const door = {
    board: async (req) => { st.asked.push(['board', req]); return { ok: true, data: board }; },
    post: async (req) => { st.asked.push(['post', req]); return postAnswer ?? { ok: true, data: { ok: true, id: 'p1', gold: req.gold, bounty: board.wanted[0].bounty + req.gold, realm: { seq: 4 } } }; },
    collect: async (req) => { st.asked.push(['collect', req]); return { ok: true, data: { ok: true, gold: board.owed, realm: { seq: 4 } } }; },
  };
  const session = { transact: (fn) => fn({ id: RC, lease: 'lease', seq: 3 }) };
  const wallet = (region) => ({ pay: (n) => { st.paid.push([region, n]); return () => st.undone.push(n); }, bank: (n) => st.banked.push([region, n]) });
  const b = createSeaBounty({ live: () => st.live, session, checkpoint: () => { st.checks++; }, wallet, character: () => RC, region: () => 19, door, now: () => st.now });
  return { b, st };
}
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

test('SEA-BOUNTY the door (accountClient.js accountSeaBounty): the board, a post and a collect each to its own route behind the session, the body as asked; the refusals said (mutants: the routes, the words)', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push([new URL(url).pathname, JSON.parse(init.body), init.headers.authorization]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  const door = accountSeaBounty({ fetch, storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 'sek' }) : null) } });
  await door.board({ character: RC });
  await door.post({ character: RC, gold: 500 });
  await door.collect({ character: RC, region: 19 });
  assert.deepEqual(sent, [['/v1/sea/bounty/board', { character: RC }, 'Bearer sek'], ['/v1/sea/bounty/post', { character: RC, gold: 500 }, 'Bearer sek'], ['/v1/sea/bounty/collect', { character: RC, region: 19 }, 'Bearer sek']]);
  assert.deepEqual(['sea-bounty-realm', 'sea-bounty-gold', 'sea-bounty-target', 'sea-bounty-self', 'sea-bounty-not-wanted', 'sea-bounty-failed'].map((k) => REFUSALS[k]), [
    'Only an online character of the realm can post or collect a bounty.', 'A bounty is between 100 and 50,000 gold.', 'There is no such captain on the board.',
    'You cannot put a bounty on your own head, or on a character of your own account.', 'That captain is no longer wanted.', 'The harbormaster could not record that. Try again in a moment.',
  ]);
});

test('SEA-BOUNTY the page\'s half (seaBountyHost.js): no section offline; the board read when the tab is shown and again SEA_BOARD_FRESH_MS on; a post a record act - its gold held out of the purse, given back on a refusal - and said; a collect banked in the region\'s account as the service banks it, and said (mutants: the gate, the read, the stale, the reserve, the undo, the bank, the words)', async () => {
  assert.equal(SEA_BOARD_FRESH_MS, 30_000);
  const off = page({ live: false });
  assert.equal(off.b.office(), null, 'offline: no section');
  const { b, st } = page();
  assert.equal(b.office().asking, true, 'shown: read');
  b.office(); void b.read();
  await settle();
  const o = b.office();
  assert.deepEqual([o.asking, o.rows, o.owed, [...o.posts]], [false, [{ char: RK, name: 'kim', kills: 3, bounty: 2500 }], 900, [500, 2000, 10_000]]);
  assert.equal(st.asked.filter(([k]) => k === 'board').length, 1, 'read once at a time');
  assert.deepEqual(st.asked[0][1], { character: RC });
  st.now += SEA_BOARD_FRESH_MS - 1; b.office(); await settle();
  assert.equal(st.asked.filter(([k]) => k === 'board').length, 1, 'fresh: not read again');
  st.now += 1; b.office(); await settle();
  assert.equal(st.asked.filter(([k]) => k === 'board').length, 2, 'stale: read again');
  o.post({ char: RK, name: 'kim' }, 500);
  o.post({ char: RK, name: 'kim' }, 500);
  assert.equal(b.office().busy, true, 'an answer awaited');
  await settle();
  assert.equal(st.asked.filter(([k]) => k === 'post').length, 1, 'pressed twice while asked: one post');
  assert.equal(st.asked.filter(([k]) => k === 'board').length, 3, 'the board read again on its answer');
  assert.equal(b.office().busy, false);
  const posted = st.asked.find(([k]) => k === 'post')[1];
  assert.deepEqual([posted.character, posted.region, posted.target, posted.gold, posted.realm], [RC, 19, RK, 500, { id: RC, lease: 'lease', seq: 3 }]);
  assert.match(posted.rid, /^[A-Za-z0-9_-]{8,40}$/);
  assert.deepEqual(st.paid, [[19, 500]], 'held out of the purse');
  assert.deepEqual(st.undone, []);
  assert.deepEqual(b.office().line, { text: 'You post 500 gold on kim\'s head. The bounty stands at 3,000 gold.', warn: false });
  b.office().collect();
  await settle();
  assert.deepEqual(st.banked, [[19, 900]], 'banked where the service banks it');
  assert.deepEqual(b.office().line, { text: 'You collect 900 gold in bounties. It is in your account here.', warn: false });
  const no = page({ postAnswer: { ok: false, error: 'sea-bounty-not-wanted' } });
  no.b.office(); await settle();
  no.b.office().post({ char: RK, name: 'kim' }, 2000);
  await settle();
  assert.deepEqual([no.st.paid, no.st.undone], [[[19, 2000]], [2000]], 'refused: the purse given back');
  assert.deepEqual(no.b.office().line, { text: 'That captain is no longer wanted.', warn: true });
});

test('SEA-BOUNTY the tab\'s words (navalYardWindow.js wantedText): each wanted captain\'s kills and bounty with a press a post, the owed and its press, the bounty on one\'s own head; presses greyed while an answer is awaited; the section a freeport\'s alone (mutants: the rows, the presses, the owed, the mine, the lede)', () => {
  const w = { rows: [{ char: RK, name: 'kim', kills: 3, bounty: 2500 }, { char: RC, name: 'pat', kills: 0, bounty: 100 }], owed: 1200, mine: 300, posts: [500, 2000, 10_000], busy: false, line: { text: 'x', warn: false } };
  const t = wantedText(w);
  assert.deepEqual(t.head, ['Wanted', 'the open sea\'s killers']);
  assert.deepEqual(t.rows.map((r) => [r.id, r.title, r.words]), [[RK, 'kim', '3 kills at sea - 2,500 gold on their head'], [RC, 'pat', 'No kills at sea of late - 100 gold on their head']]);
  assert.deepEqual(t.rows[0].presses.map((p) => [p.label, p.can, p.n]), [['Post 500', true, 500], ['Post 2,000', true, 2000], ['Post 10,000', true, 10_000]]);
  assert.deepEqual(t.owed, { title: 'Bounties owed you', words: '1,200 gold for the wanted captains you ended at sea.', press: 'Collect', can: true });
  assert.equal(t.mine, 'A bounty of 300 gold stands on your own head.');
  assert.equal(t.lede, 'Gold posted on a captain\'s head is paid to whoever ends them at sea: a death at their hand, or a wreck at their guns. Each post is your own gold.');   // PIN MOVED (AUDIT SEA VENTURES F10): a bounty is claimed by a kill at sea or a wreck, never a sinking alone
  assert.deepEqual(t.line, { text: 'x', warn: false });
  const busy = wantedText({ ...w, busy: true });
  assert.ok(busy.rows[0].presses.every((p) => !p.can) && !busy.owed.can, 'greyed while an answer is awaited');
  assert.equal(wantedText({ ...w, owed: 0, mine: 0 }).owed, null);
  assert.equal(wantedText({ ...w, owed: 0, mine: 0 }).mine, null);
  assert.equal(wantedText({ ...w, rows: [], asking: true }).lede, 'The harbormaster is reading the board...');
  assert.equal(wantedText({ ...w, rows: [] }).lede, 'No captain of the open sea is wanted.');
  const office = { ether: true, port: 'Veilhaven', waters: 'The Shallows', charted: 1, rumours: [], chart: null };
  assert.equal(etherOfficeText(office).wanted, null, 'offline: no section');
  assert.equal(etherOfficeText({ ...office, wanted: w }).wanted.rows.length, 2);
  const win = src('src/ui/naval/navalYardWindow.js');
  assert.match(win, /renderWanted\(ot\.wanted, o\.wanted\);/);
  assert.match(win, /body\.append\(tabs, lede, sec, pSec, oLede, boardSec, wantedSec, seasonSec, heldSec, lettersSec, tLede, tradeSec\);/);   // PIN MOVED (SEA-SEASON): and the season's captains after it
  assert.match(win, /\(\) => w\.post\(\{ char: r\.id, name: r\.title \}, p\.n\)/);
  assert.match(win, /officeRow\(wt\.owed\.title, wt\.owed\.words, null, wt\.owed\.press, wt\.owed\.can, \(\) => w\.collect\(\)\)/);
});

test('SEA-BOUNTY the Wanted section in the shipwright\'s window: a freeport\'s tab shows it - its rows, a press a post, the owed\'s Collect, the answer\'s line; a Bay port\'s tab, and a freeport\'s offline, hide it (mutants: the section\'s display, its presses)', () => {
  const proto = Object.getPrototypeOf(globalThis.document.createElement('div'));
  proto.removeAttribute ??= function removeAttribute(k) { delete this.attrs[k]; };   // the stand-in DOM's missing one
  const pressed = [];
  const wanted = { rows: [{ char: RK, name: 'kim', kills: 3, bounty: 2500 }], owed: 900, mine: 0, posts: [500, 2000, 10_000], busy: false, line: { text: 'Refused.', warn: true }, post: (row, n) => pressed.push(['post', row, n]), collect: () => pressed.push(['collect']) };
  let office = { ether: true, port: 'Pyrewatch', waters: 'The Deep Aether', charted: 0, rumours: [], chart: null, wanted };
  const model = { name: 'Sloop', uid: 7, offer: () => ({ rows: [], whole: 0, gold: 100 }), ship: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 1, maxCrew: 1, barrels: 0 }), office: () => office };
  const host = globalThis.document.createElement('div');
  const win = mountNavalYardWindow(host, { model });
  const [tabs] = byClass(host, 'dfnaval-tabs');
  const [, officeTab] = tabs.children;
  officeTab.onclick({ stopPropagation() {} });
  const sec = (h) => byClass(h, 'dfnaval-sec').find((x) => x.children[0]?.children[0]?.textContent === 'Wanted');
  const ws = sec(host);
  assert.ok(ws && ws.style.display !== 'none', 'shown at a freeport, online');
  const rows = byClass(ws, 'dfnaval-officerow');
  assert.deepEqual(rows.map((r) => r.getAttribute?.('data-row') ?? r.attrs?.['data-row']).filter(Boolean), [RK]);
  const posts = byClass(ws, 'dfnaval-tradebuy');
  const off = (b) => (b.getAttribute?.('disabled') ?? b.attrs?.disabled) != null;
  assert.deepEqual(posts.map((p) => [p.textContent, off(p)]), [['Post 500', false], ['Post 2,000', false], ['Post 10,000', false]]);
  posts[1].onclick({ stopPropagation() {} });
  byClass(ws, 'dfnaval-officebuy').find((p) => p.textContent === 'Collect').onclick({ stopPropagation() {} });
  assert.deepEqual(pressed, [['post', { char: RK, name: 'kim' }, 2000], ['collect']]);
  const line = byClass(ws, 'dfnaval-note')[0];
  assert.deepEqual([line.textContent, line.className], ['Refused.', 'dfnaval-note warn']);
  office = { ...office, wanted: { ...wanted, busy: true } };
  win.repaint();
  assert.ok(byClass(sec(host), 'dfnaval-tradebuy').every(off), 'greyed while an answer is awaited');
  tabs.children[0].onclick({ stopPropagation() {} });
  assert.equal(sec(host).style.display, 'none', 'the shipwright\'s own tab: hidden');
  officeTab.onclick({ stopPropagation() {} });
  assert.equal(sec(host).style.display, '');
  office = { ...office, wanted: null };
  win.repaint();
  assert.equal(sec(host).style.display, 'none', 'offline: hidden');
  win.unmount();
});

test('SEA-BOUNTY the seams by source: the relay passes the room and signs it with the killer\'s character; the fall\'s batch writes the kill; the routes; the world hands the sea\'s host the record\'s gold acts and the harbourmaster\'s tab its Wanted section; the deploy watches the law (mutants: each seam)', () => {
  const relay = src('server/src/index.js');
  assert.match(relay, /wildBlow\(st, a\.sub, tb\.sub, \{ d: d\.d, r, held, wa: a\.wa \?\? null, kin, rid, room: a\.key \}, now\)/);
  assert.match(relay, /mintWildReceipt\(\{ f: fall\.fallen, c: fall\.ci, k: fall\.killer, r: fall\.r, w: fall\.w, wt: fall\.wt, m: fall\.m, kc: fall\.kc, g: fallenGone \}/);   // PIN MOVED (WILD-REJOIN): and whether its fallen had gone from the room
  const ref = src('src/net/wild/wildRef.js');
  assert.match(ref, /killerId: a\.id, kc: a\.ci \|\| '', m: typeof room === 'string' \? room : '',/);
  assert.match(ref, /kc: typeof v\.kc === 'string' \? v\.kc : '', m: typeof v\.m === 'string' \? v\.m : '',/);
  const wild = src('server-account/src/wild.js');
  assert.match(wild, /sea = c;/);
  assert.match(wild, /\.\.\.seaKillSteps\(ctx\.db, sea, ctx\.nowS\),\n {2}\];/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'\/v1\/sea\/bounty\/board': async \(\) => seaBountyBoard\(sctx, who\.player, body\),/);
  assert.match(idx, /'\/v1\/sea\/bounty\/post': async \(\) => seaBountyPost\(sctx, who\.player, body\),/);
  assert.match(idx, /'\/v1\/sea\/bounty\/collect': async \(\) => seaBountyCollect\(sctx, who\.player, body\),/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/sea\/bounty\/board', '\/v1\/sea\/bounty\/post', '\/v1\/sea\/bounty\/collect',/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/sea\/seaBountyLaw\.js"/);
  const w = src('src/scenes/world.js');
  assert.match(w, /session: realmSession, checkpoint: onlineCheckpoint, wallet: realmWallet, region: _questRegionIndex,/);
  assert.match(src('src/scenes/seaVenturesHost.js'), /const character = deps\.character \?\? \(\(\) => characterIdOf\(playerEntity\)\);/, 'the character I play, the sea\'s host\'s own (HOST-SPLIT)');
  assert.match(w, /rumours: \[\.\.\.o\.rumours, \.\.\.seaVentures\.rumours\(port\)\], \.\.\.seaVentures\.office\(\),/);   // PIN MOVED (SEA-SEASON): the tab's sections, the Wanted and the season's, spread from the sea's host
  assert.match(src('src/scenes/seaVenturesHost.js'), /office: \(\) => \(\{ wanted: bounty\.office\(\), season: season\.office\(\) \}\),/);
  assert.match(src('src/scenes/seaVenturesHost.js'), /const bounty = createSeaBounty\(\{ live, session: deps\.session, checkpoint: deps\.checkpoint, wallet: deps\.wallet, character, region: deps\.region, door: deps\.bountyDoor, now: clock \}\);/);
  assert.match(src('src/ui/naval/navalPlunderDoor.js'), /export const repaintNavalYard = \(\) => \{ YARD\.open\?\.repaint\?\.\(\); \};/);
});
