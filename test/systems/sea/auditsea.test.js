// AUDIT SEA VENTURES (2026-10-22, the owner: "Audit this and ensure perfection") - six cold lanes read SEA VENTURES at
// 886f2b4a6 (the relay and the wire, the account service, the open zone at sea, the ventures' law, the page's sea, the
// record's honesty): bible/01-Overview/audits/Audit-Sea-Ventures.md. Each finding fixed is pinned here by its id, the
// failure it was driven through made to fail again - tools/mutants/auditsea.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeaBounty, SEA_BOARD_FRESH_MS, SEA_BOARD_READ_RETRY_MS, boardRetryMs } from '../../../src/scenes/seaBountyHost.js';
import { createSeaSeason, SEA_SEASON_FRESH_MS, SEA_SEASON_RETRY_MS } from '../../../src/scenes/seaSeasonHost.js';
import { wantedText, seasonText } from '../../../src/ui/naval/navalYardWindow.js';
import * as P from '../../../src/net/sea/seaPrizeLaw.js';
import { tradeableRecord } from '../../../src/net/realm/realmTradeLaw.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seeded } from '../../honestItems.mjs';
import { mintDeed, mintParts } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { BAG_TEMPLATE } from '../../../src/net/bagLaw.js';
import { setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { mintSeaWreck, SEA_WRECK_GRACE_S } from '../../../src/net/wild/wildReceipt.js';
import { createSeaWreckHost, SEA_WRECK_SLACK_S, SEA_WRECK_RETRY_MS, SEA_WRECK_CAPTAIN_RETRY_MS, SEA_WRECK_TRANSIENT, SEA_WRECK_KEPT_KEY } from '../../../src/scenes/seaWreckHost.js';
import { seaWreck } from '../../../server-account/src/seaWreck.js';
import { gatePublicKey } from '../../../server-account/src/signing.js';
import { shutSeaHold, openSeaHold, seaHoldShut, SEA_HOLD_SHUT_MS, SEA_HOLD_SHUT_KEY } from '../../../src/systems/naval/seaHoldGuard.js';
import { createHoldDoor } from '../../../src/scenes/holdDoor.js';
import { createNavalPvp } from '../../../src/scenes/naval/navalPvp.js';
import { createShipDamage } from '../../../src/systems/naval/navalDamage.js';
import { appStorage } from '../../../src/systems/appStorage.js';
import { readFileSync } from 'node:fs';
import { SEA_REFUND_AFTER_S, SEA_ENDED_KEEP_S, seaSweeps } from '../../../server-account/src/seaBounty.js';
import { SEA_WANTED_DAYS } from '../../../src/net/sea/seaBountyLaw.js';
import { seaSeasonFigures, seaSeasonStartS, seaLegendsPossible, SEA_WORLD_DAY_S, SEA_SEASON_VENDOR } from '../../../src/net/sea/seaSeasonLaw.js';
import { worldRoom, validWildData, PIXEL_UNITS, SOCIAL_ROOM, seaVaultRoomId, seaVaultRoomMapId, seaVaultMapId, seaVaultKey, wdunRoomKey, seaRoomOf, seaRoomCell, SEA_VAULT_LANE, SEA_FLEET_OFFSET_MS, SEA_FLEET_SAIL_MS, SEA_FLEET_PERIOD_MS, spawnedHallMapId, WDUN_RESET_MS } from '../../../src/net/wire.js';
import { FLEET_OFFSET_MS, FLEET_SAIL_MS } from '../../../src/systems/sea/seaEvents.js';
import { etherPlaceId } from '../../../src/world/etherPlaces.js';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import * as R from '../../../src/net/sea/seaRef.js';
import { newWildRef, wildZone, wildPose, wildCarryOf, WILD_REF } from '../../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import { createSeaBroadsides, SEA_SHOT_HZ, SEA_SHOT_MS } from '../../../src/scenes/naval/seaBroadsides.js';
import { SEA_CAPTAIN_NEAR_M } from '../../../src/scenes/naval/navalPvp.js';
import { HOSTILE_NEAR_M } from '../../../src/scenes/naval/navalHost.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { createCaptainLedger, ETHER_FLEETS_KEEP, ETHER_WRACK_KEEP } from '../../../src/systems/naval/captainLedger.js';
import { createEtherHost } from '../../../src/scenes/etherHost.js';
import { createSeaVentures, FLEET_TELL_MS } from '../../../src/scenes/seaVenturesHost.js';
import { createTreasureFleet } from '../../../src/scenes/naval/treasureFleet.js';
import { legendTidemail, dueOnHull } from '../../../src/scenes/naval/navalSeaSet.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import * as SE from '../../../src/systems/sea/seaEvents.js';
import { BANDS, VEIL_X, LEAGUE_PX, etherBandAt } from '../../../src/world/ethericSea.js';
import { legendById } from '../../../src/systems/naval/etherShips.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { etherInPeace, etherWildRingAt, etherRisePort, ETHER_PEACE_PX, ETHER_RISE_PX, ETHER_KIND, ETHER_WILD_TEXT } from '../../../src/systems/wild/etherWild.js';
import { zoneWord, WILD_TEXT, wildMaskOf, WILD_REGION } from '../../../src/systems/wild/wildZone.js';
import { wildCartAway } from '../../../src/systems/wild/wildCart.js';
import { WAGON_MODE } from '../../../src/systems/horse/horseCartLaw.js';
import { worldCoordToMapPixel } from '../../../src/world/streamingWorld.js';
import { veilhaven, islesNear, inEther, inVeil } from '../../../src/world/ethericSea.js';
import * as CHART from '../../../src/ui/etherChartWindow.js';
import * as tm from '../../../src/systems/textManager.js';
import { etherWayWord, etherRingBonus } from '../../../src/systems/wild/etherWild.js';
import { standService } from '../../accountDb.mjs';
import { seatRealm, recordOf } from '../../realmSeat.mjs';

const { subtle } = globalThis.crypto;
const RC = 'r00000000000000000a01', RK = 'r00000000000000000a02';
const SEA_CELL = worldRoom(7800, -5000);
const sword = (m, extra = {}) => ({ ...createWeapon(120, m, seeded(9)), ...extra });
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
/** A realm session whose acts run at once over `seq`. */
const sessionAt = (seq = 3) => ({ transact: (fn) => fn({ id: RC, lease: 'lease', seq }) });

test('AUDIT SEA VENTURES E1: a board read the service refused is asked again SEA_BOARD_READ_RETRY_MS on, doubling to the fresh wait - never at once from the paint that ends it, never a page frozen in reads; a good read waits SEA_BOARD_FRESH_MS (mutants: the backoff, the failure\'s wait, the fresh wait)', async () => {
  assert.deepEqual([SEA_BOARD_READ_RETRY_MS, SEA_BOARD_FRESH_MS, SEA_SEASON_RETRY_MS, SEA_SEASON_FRESH_MS], [5_000, 30_000, 5_000, 60_000]);
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(boardRetryMs), [5_000, 10_000, 20_000, 30_000, 30_000, 30_000]);
  let now = 1_000_000, asked = 0, answer = { ok: false, error: 'rate' };
  const door = { board: async () => { asked++; return answer; } };
  const b = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet: () => null, character: () => RC, region: () => 19, door, now: () => now });
  for (let i = 0; i < 200; i++) { b.office(); await settle(); }   // every paint asks for the section, as the window does
  assert.equal(asked, 1, 'one refused read - and none again from the paints after it');
  assert.equal(b.office().line?.warn, true, 'its refusal said');
  now += SEA_BOARD_READ_RETRY_MS - 1; b.office(); await settle();
  assert.equal(asked, 1);
  now += 1; b.office(); await settle();
  assert.equal(asked, 2, 'asked again its wait on');
  now += SEA_BOARD_READ_RETRY_MS; b.office(); await settle();
  assert.equal(asked, 2, 'the wait doubled');
  now += SEA_BOARD_READ_RETRY_MS; b.office(); await settle();
  assert.equal(asked, 3);
  answer = { ok: true, data: { wanted: [], owed: 0, mine: 0 } };
  now += 4 * SEA_BOARD_READ_RETRY_MS; b.office(); await settle();
  assert.equal(asked, 4);
  assert.equal(b.office().line, null, 'a good read takes the refusal away');
  now += SEA_BOARD_FRESH_MS - 1; b.office(); await settle();
  assert.equal(asked, 4);
  now += 1; b.office(); await settle();
  assert.equal(asked, 5, 'fresh again SEA_BOARD_FRESH_MS on');
  // a door that throws is a refusal too, and waits as one
  let thrown = 0;
  const t2 = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet: () => null, character: () => RC, region: () => 19, door: { board: async () => { thrown++; throw new Error('gone'); } }, now: () => now });
  for (let i = 0; i < 50; i++) { t2.office(); await settle(); }
  assert.equal(thrown, 1, 'a throw waits too');
  // the season's boards, the same
  let seasonAsked = 0;
  const s = createSeaSeason({ live: () => true, session: sessionAt(), character: () => RC, door: { board: async () => { seasonAsked++; return { ok: false, error: 'server' }; } }, now: () => now });
  for (let i = 0; i < 200; i++) { s.office(); await settle(); }
  assert.equal(seasonAsked, 1);
  now += SEA_SEASON_RETRY_MS; s.office(); await settle();
  assert.equal(seasonAsked, 2);
  now += SEA_SEASON_RETRY_MS; s.office(); await settle();
  assert.equal(seasonAsked, 2, 'the season\'s wait doubles too');
});

test('AUDIT SEA VENTURES E7: a post that landed is said as landed though the read after it is refused; a later good read takes a refusal away; boards never read are still asked for, never an empty season; a post the purse and the bank cannot pay is greyed and never asked (mutants: the two lines, the asking, the purse)', async () => {
  let now = 1_000_000, purse = 5_000, reads = 0, posts = 0;
  const door = {
    board: async () => (++reads === 2 ? { ok: false, error: 'offline' } : { ok: true, data: { wanted: [{ char: 'r00000000000000000a02', name: 'kim', kills: 1, bounty: 500 }], owed: 0, mine: 0 } }),
    post: async ({ gold }) => { posts++; return { ok: true, data: { ok: true, gold, bounty: 500 + gold, realm: { seq: 4 } } }; },
  };
  const wallet = () => ({ gold: () => purse, pay: (n) => { purse -= n; return () => { purse += n; }; } });
  const b = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet, character: () => RC, region: () => 19, door, now: () => now });
  b.office(); await settle();
  b.office().post({ char: 'r00000000000000000a02', name: 'kim' }, 2_000); await settle();
  assert.equal(posts, 1);
  assert.equal(reads, 2, 'the read after the post was refused');
  assert.deepEqual(b.office().line, { text: 'You post 2,000 gold on kim\'s head. The bounty stands at 2,500 gold.', warn: false }, 'the post is said as landed');
  // the season's boards never read: asking, never an empty season
  const s = createSeaSeason({ live: () => true, session: sessionAt(), character: () => RC, door: { board: async () => ({ ok: false, error: 'offline' }) }, now: () => now });
  s.office(); await settle();
  const so = s.office();
  assert.equal(so.asking, true);
  assert.deepEqual(seasonText(so).lists, [], 'no lists - "no captain has sailed this season" is never said of boards unread');
  assert.equal(so.line?.warn, true);
  // the purse: a post past it greyed, and refused unasked
  purse = 300;
  const w = wantedText(b.office());
  assert.deepEqual(w.rows[0].presses.map((p) => [p.n, p.can]), [[500, false], [2_000, false], [10_000, false]]);
  purse = 2_000;
  assert.deepEqual(wantedText(b.office()).rows[0].presses.map((p) => [p.n, p.can]), [[500, true], [2_000, true], [10_000, false]]);
  b.office().post({ char: 'r00000000000000000a02', name: 'kim' }, 10_000); await settle();
  assert.equal(posts, 1, 'never asked');
  assert.equal(purse, 2_000, 'nothing held out');
  assert.deepEqual(b.office().line, { text: 'You do not have 10,000 gold to post.', warn: true });
  // a refusal stands only until a good read
  reads = 0;
  const r2 = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet, character: () => RC, region: () => 19, door: { board: async () => (++reads === 1 ? { ok: false, error: 'rate' } : { ok: true, data: { wanted: [], owed: 0, mine: 0 } }) }, now: () => now });
  r2.office(); await settle();
  assert.equal(r2.office().line?.warn, true);
  now += SEA_BOARD_READ_RETRY_MS; r2.office(); await settle();
  assert.equal(r2.office().line, null);
});

test('AUDIT SEA VENTURES E5/B1: a prize never takes a piece the realm never lets pass between players - a quest\'s, a summoned one, a boat\'s deed (a second ship) or parts (their cargo left behind), a Materials Bag - nor counts it toward the share (mutants: the trade law)', () => {
  const dagger = createWeapon(113, 0, seeded(9));
  const barred = {
    quest: sword(2, { questItem: true }),
    summoned: sword(2, { timeForItemToDisappear: 123_456 }),
    deed: mintDeed(2, 0, 4242, 9000),
    parts: mintParts(1, 0, 4343),
    bag: setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE, material: 0, stackCount: 1, value: 50 }),
  };
  for (const [name, it] of Object.entries(barred)) {
    assert.equal(tradeableRecord({ ...it, equipSlot: undefined }), false, name);
    assert.equal(P.prizeable(it), false, name);
    const hold = [dagger, it];
    assert.deepEqual(P.seaPrizePlaces(hold), [0], `${name}: the dagger, never it`);
  }
  assert.equal(P.prizeable(sword(2)), true, 'a plain sword is a prize');
  assert.equal(P.prizeable({ ...sword(2), equipSlot: 3 }), true, 'a hold\'s piece is worn by no one');
});

/** The service and two captains - kim's ship a hold of swords - over the wreck's own law (seaWreck.js). */
async function harbour() {
  const svc = await standService();
  const who = {}, R = {};
  for (const n of ['kim', 'hal']) {
    who[n] = await svc.registered(n);
    R[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000, modData: { 'come-sail-away': { placedBoats: [{ UID: 77, Hull: 2, Items: [sword(2, { uid: '00000000000000c1', magic: true }), sword(0)] }] } } });
  }
  let n = 0;
  const wreck = (o = {}) => mintSeaWreck({ f: who.kim.id, c: R.kim.id, k: who.hal.id, kc: R.hal.id, r: `${(++n).toString(16).padStart(12, '0')}`, u: 77, b: 1, m: SEA_CELL, ...o }, svc.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const rows = (sql, ...a) => svc.env.DB._raw.prepare(sql).all(...a).map((x) => ({ ...x }));
  const ctx = (o = {}) => ({ db: svc.env.DB, primary: svc.env.DB, bucket: svc.env.SAVES, subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: Math.floor(Date.now() / 1000), ...o });
  return { svc, who, R, wreck, rows, ctx };
}

test('AUDIT SEA VENTURES B2: each piece a prize took is written down as her own copy, in the wreck\'s batch - a game that kept it in its hold holds a copy, never the craft\'s original (mutants: the copies)', async () => {
  const h = await harbour();
  const res = await h.svc.call('/v1/sea/wreck', { receipt: await h.wreck(), realm: h.R.kim.at() }, h.who.kim.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.took.map((x) => x.u), ['00000000000000c1']);
  assert.deepEqual(h.rows('SELECT uid, char_id FROM item_dupes'), [{ uid: '00000000000000c1', char_id: h.R.kim.id }], 'her copy written down');
});

test('AUDIT SEA VENTURES B7, E3: a wreck that stands answers her killer within her grace (his prize waits on her carry alone); past it, a seize whose batch her own checkpoint beat answers \'seq\' - asked again, it lands (mutants: the order, the race)', async () => {
  const h = await harbour();
  const rc = await h.wreck();
  assert.equal((await h.svc.call('/v1/sea/wreck', { receipt: rc }, h.who.hal.secret)).body.error, 'grace', 'nothing stands yet: her grace');
  const mine = await h.svc.call('/v1/sea/wreck', { receipt: rc, realm: h.R.kim.at() }, h.who.kim.secret);
  assert.equal(mine.status, 200);
  const his = await h.svc.call('/v1/sea/wreck', { receipt: rc }, h.who.hal.secret);
  assert.deepEqual([his.status, his.body.again, his.body.n], [200, true, 1], 'her carry stands: his answer at once');
  // the race: past her grace, a seize whose batch fails as her checkpoint moved the record first
  const rc2 = await h.wreck();
  let failed = 0;
  const db = new Proxy(h.svc.env.DB, { get: (t, k) => (k === 'batch' ? async (steps) => { if (!failed++) throw new Error('CHECK constraint failed: moved = expected'); return t.batch(steps); } : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) });
  const nowS = Math.floor(Date.now() / 1000) + SEA_WRECK_GRACE_S + 1;
  const seize = async () => seaWreck(h.ctx({ db, nowS }), { id: h.who.hal.id }, { receipt: rc2 }, { gateKey: await gateKeyOf(h.svc) });
  assert.equal((await seaWreck(h.ctx({ db, nowS: nowS - 2 }), { id: h.who.hal.id }, { receipt: rc2 }, { gateKey: await gateKeyOf(h.svc) })).error, 'grace');
  assert.deepEqual(await seize(), { error: 'seq' }, 'the record moved under it: asked again, never a throw');
  assert.ok(SEA_WRECK_TRANSIENT.includes('seq'), 'the page asks again');
  assert.equal((await seize()).n, 1, 'asked again, it lands');
});

/** The gate's public key the service verifies with (standService's GATE_PUBLIC_KEY). */
const gateKeyOf = (svc) => gatePublicKey(svc.env, subtle);

test('AUDIT SEA VENTURES E2, E3, E4: the wreck\'s page half - her killer carries an unboarded wreck (a kill at sea) as a boarded one; her captain\'s carry only over a checkpoint that went, asked again while it cannot be; a refusal that says nothing of the wreck asked again; the carries owed kept across a reload (mutants: the unboarded, the checkpoint, the retries, the storage)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const T = 1_800_000_000;
  const mint = (o = {}) => mintSeaWreck({ f: 'acct-kim', c: RC, k: 'acct-hal', kc: RK, r: '0123456789ab', u: 77, b: 1, m: SEA_CELL, ...o }, kp.privateKey, { subtle, nowS: T });
  const host = (me, { answers = [], checkpoint = () => true, kept = new Map() } = {}) => {
    const st = { asked: [], said: [], now: T * 1000 };
    const door = {
      wreck: async (req) => { st.asked.push(['wreck', req]); return answers.shift() ?? { ok: true, data: { r: '0123456789ab', b: 1, took: [], n: 0, realm: { seq: 4 } } }; },
      collect: async (req) => { st.asked.push(['collect', req]); return { ok: true, data: { ok: true, items: [], realm: { seq: 5 } } }; },
    };
    const session = { transact: (fn) => fn({ id: me === 'acct-kim' ? RC : RK, lease: 'lease', seq: 3 }) };
    const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
    const w = createSeaWreckHost({ session, checkpoint, character: () => RK, me: () => me, naval: () => null, door, storage, say: (x) => st.said.push(x), now: () => st.now });
    return { w, st, kept };
  };
  // E2: her killer, unboarded - carried a moment on, nothing collected
  const ub = host('acct-hal');
  ub.w.receipt(await mint({ b: 0 }));
  ub.w.frame(); await settle();
  assert.equal(ub.st.asked.length, 0);
  ub.st.now += SEA_WRECK_SLACK_S * 1000; ub.w.frame(); await settle();
  assert.deepEqual(ub.st.asked.map(([k]) => k), ['wreck'], 'a wreck is a kill at sea, boarded or not');
  // her killer, refused 'grace' then carried: asked again SEA_WRECK_RETRY_MS on
  const k = host('acct-hal', { answers: [{ ok: false, error: 'grace' }] });
  k.w.receipt(await mint());
  k.st.now += SEA_WRECK_SLACK_S * 1000; k.w.frame(); await settle();
  k.st.now += SEA_WRECK_RETRY_MS - 1; k.w.frame(); await settle();
  assert.equal(k.st.asked.length, 1);
  k.st.now += 1; k.w.frame(); await settle();
  assert.deepEqual(k.st.asked.map(([x]) => x), ['wreck', 'wreck', 'collect'], 'asked again, then collected');
  // a refusal of the wreck itself: dropped
  const bad = host('acct-hal', { answers: [{ ok: false, error: 'receipt' }] });
  bad.w.receipt(await mint());
  bad.st.now += SEA_WRECK_SLACK_S * 1000; bad.w.frame(); await settle();
  bad.st.now += 10 * SEA_WRECK_RETRY_MS; bad.w.frame(); await settle();
  assert.equal(bad.st.asked.length, 1, 'never asked again');
  // E4: her captain - a checkpoint refused (a duel) asks the service nothing; allowed, carried
  let allowed = false;
  const cap = host('acct-kim', { checkpoint: () => allowed });
  cap.w.receipt(await mint());
  cap.w.frame(); await settle();
  assert.equal(cap.st.asked.length, 0, 'over a stale record: never');
  cap.st.now += SEA_WRECK_CAPTAIN_RETRY_MS - 1; cap.w.frame(); await settle();
  assert.equal(cap.st.asked.length, 0);
  allowed = true;
  cap.st.now += 1; cap.w.frame(); await settle();
  assert.deepEqual(cap.st.asked.map(([x, req]) => [x, req.realm?.seq]), [['wreck', 3]], 'carried once a checkpoint went');
  // E3: her captain's carry refused 'busy' (another act): asked again
  const busy = host('acct-kim', { answers: [{ ok: false, error: 'busy' }] });
  busy.w.receipt(await mint());
  busy.w.frame(); await settle();
  busy.st.now += SEA_WRECK_CAPTAIN_RETRY_MS; busy.w.frame(); await settle();
  assert.equal(busy.st.asked.length, 2, 'asked again');
  // E2: the carries owed kept across a reload - her killer's page reloaded before his grace
  const kept = new Map();
  const before = host('acct-hal', { kept });
  before.w.receipt(await mint());
  assert.ok(JSON.parse(kept.get(SEA_WRECK_KEPT_KEY)).length === 1, 'kept');
  const after = host('acct-hal', { kept });
  after.w.frame(); await settle();
  assert.deepEqual(after.st.asked.map(([x]) => x), ['wreck', 'collect'], 'the reloaded page carries it');
  assert.deepEqual(JSON.parse(kept.get(SEA_WRECK_KEPT_KEY)), [], 'and forgets it carried');
  // an expired receipt is dropped unasked - never owed, never said
  const old = host('acct-hal');
  old.st.now = (T + 3601) * 1000;
  old.w.receipt(await mint({ b: 0 }));
  assert.deepEqual([old.st.said, old.kept.get(SEA_WRECK_KEPT_KEY) ?? null], [[], null], 'past its hour: nothing owed, nothing said');
  const late = host('acct-hal');
  late.w.receipt(await mint());
  late.st.now += 3601 * 1000; late.w.frame(); await settle();
  assert.equal(late.st.asked.length, 0);
});

test('AUDIT SEA VENTURES E3: the seize waits SEA_WRECK_GRACE_S (300 s) - her own carry, asked every SEA_WRECK_CAPTAIN_RETRY_MS while her record is busy, has five minutes to land before her killer\'s takes the record (thirty seconds was a busy captain\'s hold seized), and her hold is shut no longer than the grace (mutants: the grace)', () => {
  assert.equal(SEA_WRECK_GRACE_S, 300);
  assert.ok(SEA_HOLD_SHUT_MS <= SEA_WRECK_GRACE_S * 1000, 'her hold shut within her grace');
  assert.ok(SEA_WRECK_GRACE_S * 1000 >= 100 * SEA_WRECK_CAPTAIN_RETRY_MS, 'a hundred of her own asks before his');
});

test('AUDIT SEA VENTURES B3: a wrecked ship\'s hold is shut while her wreck may be boarded - the referee\'s wreck shuts it, the door and the mod\'s own box open it to no one, she is neither packed nor laid up - and her carry settled opens it again; kept across a reload, never past SEA_HOLD_SHUT_MS (mutants: the shut, the door, the box, the pack, the lay-up, the open)', async () => {
  assert.equal(SEA_HOLD_SHUT_MS, 240_000);
  const boat = { uid: 77, hull: 2, Cargo: { Items: [{ name: 'Longsword' }] } };
  const dmg = createShipDamage({ hullHp: 600, sailHp: 200, crew: 10, player: true });
  const pvp = createNavalPvp({ enabled: () => true, boat: () => boat, stateOf: () => ({ damage: dmg }), clock: () => 5 });
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) };
  try {
  openSeaHold(77);
  pvp.wreck();
  assert.equal(seaHoldShut(77), true, 'the referee\'s wreck shuts her hold');
  assert.ok(JSON.parse(appStorage().getItem(SEA_HOLD_SHUT_KEY))['77'] > Date.now(), 'kept in the page\'s storage');
  const reloaded = await import(`../../../src/systems/naval/seaHoldGuard.js?reload=${Date.now()}`);
  assert.equal(reloaded.seaHoldShut(77), true, 'a reloaded page reads it back');
  const said = [];
  let opened = 0;
  const door = createHoldDoor({ csa: () => ({ AllBoats: [boat] }), ships: () => [{ uid: 77, hull: 2 }], openHold: () => { opened++; return true; }, say: (x) => said.push(x) });
  assert.equal(door.openShip(77), false);
  assert.deepEqual([opened, said], [0, ['Her hold is shut while her wreck may be boarded.']]);
  const csa = readFileSync(new URL('../../../src/systems/comeSailAway/comeSailAway.js', import.meta.url), 'utf8');
  assert.match(csa, /function OpenCargo\(boat\) \{ if \(seaHoldShut\(boat\?\.uid\)\) \{ deps\.messageBox\?\.\(seaHoldShutText\(\)\); return; \} deps\.openCargo\?\.\(boat\.Cargo\); \}/, 'the mod\'s own box');
  assert.match(csa, /if \(!lost && seaHoldShut\(boat\?\.uid\)\) \{ deps\.messageBox\?\.\(seaHoldShutText\(\)\); return false; \}/, 'never packed - a lost boat\'s recovery aside');
  assert.match(csa, /function LayUpBoat\(boat\) \{\n[^\n]*\n\s+if \(seaHoldShut\(boat\.uid\)\) \{ deps\.messageBox\?\.\(seaHoldShutText\(\)\); return false; \}/, 'nor laid up');
  // her carry settled: open again
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const rc = await mintSeaWreck({ f: 'acct-kim', c: RC, k: 'acct-hal', kc: RK, r: '0123456789ab', u: 77, b: 1, m: SEA_CELL }, kp.privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const w = createSeaWreckHost({ session: sessionAt(), checkpoint: () => true, character: () => RC, me: () => 'acct-kim', naval: () => ({ pvp }), door: { wreck: async () => ({ ok: true, data: { r: '0123456789ab', b: 1, took: [], n: 0, realm: { seq: 4 } } }) }, storage: { getItem: () => null, setItem: () => {} }, say: () => {} });
  w.receipt(rc); w.frame(); await settle();
  assert.equal(seaHoldShut(77), false, 'her carry landed: open');
  assert.equal(door.openShip(77), true);
  // never past SEA_HOLD_SHUT_MS
  shutSeaHold(78, 1_000);
  assert.deepEqual([seaHoldShut(78, 1_000 + SEA_HOLD_SHUT_MS - 1), seaHoldShut(78, 1_000 + SEA_HOLD_SHUT_MS)], [true, false]);
  } finally { delete globalThis.localStorage; }
});

test('AUDIT SEA VENTURES B4: a post on a head gone - deleted, or dead SEA_REFUND_AFTER_S - is owed back to its poster and paid by its collect, once; a character with bounties, prizes or hold goods waiting is not deleted until they come home (mutants: the refund, its wait, the delete\'s refusal)', async () => {
  const svc = await standService();
  const who = {}, R = {};
  for (const n of ['pat', 'kim', 'hal']) {
    who[n] = await svc.registered(n);
    R[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000 });
  }
  const raw = svc.env.DB._raw;
  const nowS = Math.floor(Date.now() / 1000);
  raw.prepare('INSERT INTO sea_kills (r, killer, killer_char, victim, victim_char, at) VALUES (?, ?, ?, ?, ?, ?)').run('k1', who.kim.id, R.kim.id, who.hal.id, R.hal.id, nowS);
  const post = await svc.call('/v1/sea/bounty/post', { character: R.pat.id, realm: R.pat.at(), region: 19, target: R.kim.id, gold: 2000, rid: 'sbaudit0001' }, who.pat.secret);
  assert.equal(post.status, 200, JSON.stringify(post.body));
  const board = async () => (await svc.call('/v1/sea/bounty/board', { character: R.pat.id }, who.pat.secret)).body;
  assert.equal((await board()).refund, 0, 'a living head: nothing back');
  assert.equal(SEA_REFUND_AFTER_S, 2 * 3600);
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(nowS - 60, R.kim.id);
  assert.equal((await board()).refund, 0, 'dead a moment: a fall that ended it may yet claim it');
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(nowS - 2 * 3600 + 60, R.kim.id);
  assert.equal((await board()).refund, 0, 'dead not two hours: still standing');
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(nowS - SEA_REFUND_AFTER_S - 1, R.kim.id);
  assert.equal((await board()).refund, 2000, 'dead past the wait: back to its poster');
  const before = recordOf(svc.env, R.pat.id);
  const got = await svc.call('/v1/sea/bounty/collect', { character: R.pat.id, realm: R.pat.at(), region: 19 }, who.pat.secret);
  assert.deepEqual([got.status, got.body.gold], [200, 2000], JSON.stringify(got.body));
  const after = recordOf(svc.env, R.pat.id);
  const goldOf = (rec) => (Number(rec.goldPieces) || 0) + (rec.bankAccounts ?? []).reduce((n, a) => n + (Number(a?.accountGold) || 0), 0);   // the region's bank, the purse where it keeps none
  assert.equal(goldOf(after) - goldOf(before), 2000, 'into the poster\'s record');
  assert.deepEqual((await svc.call('/v1/sea/bounty/collect', { character: R.pat.id, realm: R.pat.at(), region: 19 }, who.pat.secret)).body.gold, 0, 'once');
  assert.equal((await board()).refund, 0);
  // the delete waits for what is owed
  raw.prepare('INSERT INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at) VALUES (?, ?, ?, ?, ?, ?)').run('k9', who.hal.id, R.hal.id, R.kim.id, 500, nowS);
  assert.equal((await svc.call('/v1/realm/delete', { id: R.hal.id }, who.hal.secret)).body.error, 'sea-held');
  raw.prepare('UPDATE sea_bounty_owed SET paid_at = ? WHERE r = ?').run(nowS, 'k9');
  assert.equal((await svc.call('/v1/realm/delete', { id: R.hal.id }, who.hal.secret)).status, 200, 'collected: deleted as any other');
});

test('AUDIT SEA VENTURES B5: the sea\'s tables are swept - a kill past the Wanted window, a wreck past its hour, what has ended past its keeping - and never a bounty standing, a sum owed or a prize held; the reads walk their own indexes (mutants: each sweep, each keep)', async () => {
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const nowS = 2_000_000_000;
  const old = nowS - SEA_ENDED_KEEP_S - 1, young = nowS - 60;
  raw.prepare('INSERT INTO sea_kills (r, killer, killer_char, victim, victim_char, at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)').run('ka', 'a', 'ca', 'b', 'cb', nowS - SEA_WANTED_DAYS * 86_400 - 1, 'kb', 'a', 'ca', 'b', 'cb', young);
  raw.prepare('INSERT INTO sea_wrecks (r, victim, victim_char, killer, killer_char, boat, boarded, took, seq, at) VALUES (?, ?, ?, ?, ?, 1, 1, ?, NULL, ?), (?, ?, ?, ?, ?, 1, 1, ?, NULL, ?)').run('wa', 'b', 'cb', 'a', 'ca', '[]', nowS - 7201, 'wb', 'b', 'cb', 'a', 'ca', '[]', young);
  raw.prepare('INSERT INTO sea_bounties (id, poster, poster_char, rid, target_char, gold, at, claimed_r) VALUES (?, ?, ?, ?, ?, 100, ?, ?), (?, ?, ?, ?, ?, 100, ?, NULL)').run('ba', 'p', 'cp', 'r1', 'cb', old, 'ka', 'bb', 'p', 'cp', 'r2', 'cb', old);
  raw.prepare('INSERT INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at, paid_at) VALUES (?, ?, ?, ?, 100, ?, ?), (?, ?, ?, ?, 100, ?, NULL)').run('oa', 'a', 'ca', 'cb', old, old, 'ob', 'a', 'ca', 'cb', old);
  raw.prepare("INSERT INTO sea_prizes (r, i, victim, victim_char, killer, killer_char, rec, at, until_s, state, ended_at) VALUES (?, 0, 'b', 'cb', 'a', 'ca', '{}', ?, ?, 'collected', ?), (?, 0, 'b', 'cb', 'a', 'ca', '{}', ?, ?, 'held', NULL)").run('pa', old, old, old, 'pb', old, old);
  for (const [sql, cutoff] of seaSweeps(nowS)) raw.prepare(sql).run(cutoff, 500);
  const ids = (sql) => raw.prepare(sql).all().map((x) => Object.values(x)[0]);
  assert.deepEqual(ids('SELECT r FROM sea_kills'), ['kb'], 'a kill in the Wanted window kept');
  assert.deepEqual(ids('SELECT r FROM sea_wrecks'), ['wb'], 'a wreck within its hours kept');
  assert.deepEqual(ids('SELECT id FROM sea_bounties'), ['bb'], 'a bounty standing never swept');
  assert.deepEqual(ids('SELECT r FROM sea_bounty_owed'), ['ob'], 'a sum owed never swept');
  assert.deepEqual(ids('SELECT r FROM sea_prizes'), ['pb'], 'a prize held never swept');
  const plan = (sql) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((x) => x.detail).join(' | ');
  assert.match(plan('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties WHERE target_char = \'x\' AND claimed_r IS NULL'), /USING (COVERING )?INDEX sea_bounties_(standing|target)/);
  assert.match(plan('SELECT SUM(gold) FROM sea_bounties WHERE claimed_r = \'x\''), /USING (COVERING )?INDEX sea_bounties_claimed/);
  assert.match(plan('SELECT r FROM sea_kills WHERE at < 5'), /USING (COVERING )?INDEX sea_kills_at/);
  assert.match(plan('SELECT r FROM sea_wrecks WHERE at < 5'), /USING (COVERING )?INDEX sea_wrecks_at/);
});

test('AUDIT SEA VENTURES B6: the day a season turns in counts for the old one - a world day past the turn, a save filing the season before\'s figures is read for it, its legends bounded by that whole season; past the day, never (mutants: the day, the season before, the legends\' bound)', () => {
  assert.equal(SEA_WORLD_DAY_S, 7200);
  const turn = seaSeasonStartS(2);
  const save = (n, deepest = 900, legends = 1) => ({ modData: { [SEA_SEASON_VENDOR]: { ether: { season: { n, deepest, legends } } } } });
  assert.deepEqual(seaSeasonFigures(save(1), turn + 60), { n: 1, deepest: 900, legends: 1 }, 'the season before, the turn\'s day');
  assert.deepEqual(seaSeasonFigures(save(1), turn + SEA_WORLD_DAY_S - 1), { n: 1, deepest: 900, legends: 1 });
  assert.equal(seaSeasonFigures(save(1), turn + SEA_WORLD_DAY_S), null, 'past the day: never');
  assert.deepEqual(seaSeasonFigures(save(2), turn + 60), { n: 2, deepest: 900, legends: 1 }, 'the new season\'s too');
  assert.equal(seaSeasonFigures(save(0), turn + 60), null, 'two seasons back: never');
  const oldMost = seaLegendsPossible(turn - 1);
  assert.ok(oldMost > seaLegendsPossible(turn + 60), 'the old season had more legends to end than the new one\'s first day');
  assert.deepEqual(seaSeasonFigures(save(1, 0, oldMost), turn + 60)?.legends, oldMost, 'bounded by the old season\'s whole');
  assert.equal(seaSeasonFigures(save(1, 0, oldMost + 1), turn + 60), null);
});

/** A room's referee state: two captains in the zone, `gap` metres apart. */
function seaRoom(gap = 50, now = 1000) {
  const st = newWildRef();
  wildZone(st, 'a', { id: 'pa', lv: 10, ci: RK }, true, { x: 0, y: 0, z: 0 }, now);
  wildZone(st, 'b', { id: 'pb', lv: 10, ci: RC }, true, { x: gap * SIEGE_UNITS_PER_M, y: 0, z: 0 }, now);
  return st;
}
/** Her ship struck to about `share` of her bar by a's guns from `now`, the helms said as the page says them. */
function batter(st, share, now) {
  let t = now;
  R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, t); R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, t);
  for (let i = 0; i < 2000 && st.ships.get('b').hp / st.ships.get('b').max > share; i++) {
    t += 1000;
    if (i % 5 === 0) { R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, t); R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, t); }
    R.seaShot(st, 'a', 'b', { d: 5 }, t);
  }
  return t;
}

test('AUDIT SEA VENTURES E6A, F1/A1, E6B, A6: the referee - her target\'s helm word never asked to be fresh (a window open, a hidden tab, below: at sea all the same), a quiet captain in the zone never forgotten; a captain who leaves her helm, the zone or her socket leaves her ship off the guns with her bar kept until it would be whole, and one who crosses into another room carries it; canvas or a fire alone never claims a ship, and a ship the sea\'s guns broke is out of the fight both ways; a jumper boards nothing (mutants: the shooter\'s word alone, the quiet kept, the off, the carry, the bar\'s credit, the sea\'s wreck, the jump)', () => {
  // E6A: her page paused - no helm word a minute - my shots land
  let now = 1000;
  const st = seaRoom(50, now);
  R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now); R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, now);
  now += 60_000;
  R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now);
  const quiet = R.seaShot(st, 'a', 'b', { d: 5 }, now);
  assert.ok(quiet.ok && quiet.dealt > 0, `her helm unsaid a minute: ${quiet.why}`);
  assert.equal(R.seaShot(st, 'a', 'b', { d: 5 }, now + R.SEA_REF.helmMs + 1).why, 'helm', 'the shooter\'s own word stale: no shot');
  R.seaStep(st, now + 10 * R.SEA_REF.helmMs);
  assert.deepEqual([st.ships.has('b'), st.ships.get('b').off], [true, false], 'her quiet in the zone: kept, on the guns');
  // F1/A1: battered, she says she has left her helm - off the guns, her bar kept, back as she was
  const s1 = seaRoom(20, 1000);
  now = batter(s1, 0.3, 1000);
  const bar = s1.ships.get('b').hp;
  assert.ok(bar / s1.ships.get('b').max <= 0.3 && bar > 0);
  R.seaHelm(s1, 'b', { id: 'pb', ci: RC, hl: -1 }, now + 100);
  assert.deepEqual([s1.ships.has('b'), s1.ships.get('b').off], [true, true], 'off her helm: her ship kept, off the guns');
  assert.equal(R.seaShot(s1, 'a', 'b', { d: 5 }, now + 1100).why, 'ship', 'no shot lands on a ship off the guns');
  R.seaHelm(s1, 'b', { id: 'pb', ci: RC, hl: 1, u: 22, h: 1 }, now + 1800);
  assert.deepEqual([s1.ships.get('b').hp, s1.ships.get('b').off], [bar, false], 'back at her helm: her bar as she left it, never whole');
  R.seaGone(s1, 'b', now + 2000);
  assert.equal(s1.ships.get('b').off, true, 'her socket gone: off, kept');
  wildZone(s1, 'b', { id: 'pb' }, false, null, now + 2100);
  R.seaHelm(s1, 'b', { id: 'pb', ci: RC, hl: 1, u: 22, h: 1 }, now + 2200);
  assert.equal(s1.ships.get('b').off, true, 'a word out of the zone: off');
  wildZone(s1, 'b', { id: 'pb' }, true, null, now + 2300);
  R.seaHelm(s1, 'b', { id: 'pb', ci: RC, hl: 1, u: 22, h: 1 }, now + 2400);
  assert.equal(s1.ships.get('b').hp, bar, 'back in the zone: as she was');
  R.seaHelm(s1, 'b', { id: 'pb', ci: RC, hl: -1 }, now + 2500);
  R.seaStep(s1, now + R.SEA_REF.mendMs - 1);
  assert.equal(s1.ships.has('b'), true);
  R.seaStep(s1, now + R.SEA_REF.mendMs);
  assert.equal(s1.ships.has('b'), false, 'off the guns until her bar would be whole, then forgotten');
  const s2 = seaRoom(20, 1000);
  R.seaHelm(s2, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, 1000); R.seaHelm(s2, 'b', { id: 'pb', ci: RC, hl: -1 }, 2000);
  assert.equal(s2.ships.has('b'), false, 'never struck: forgotten at once');
  // F1/A1: the bar carried into another room - newer than her own there, younger than the mend
  const s3 = seaRoom(20, 1000);
  now = batter(s3, 0.5, 1000);
  const c = R.seaCarry(s3, 'b');
  assert.deepEqual([Math.round(c.h * 1000), c.at], [Math.round(s3.ships.get('b').hp / s3.ships.get('b').max * 1000), s3.ships.get('b').struckAt]);
  assert.equal(R.seaCarry(s3, 'a'), null, 'never struck: whole wherever she goes');
  assert.deepEqual(wildCarryOf(JSON.parse(JSON.stringify({ hp: 5, max: 9, down: false, downAt: 0, at: now, sea: c }))).sea, c, 'kept at the hub with the zone\'s carry');
  assert.equal(wildCarryOf({ hp: 5, max: 9, at: now, sea: { h: 'x', at: now } }).sea, undefined);
  assert.equal(wildCarryOf({ hp: 5, max: 9, at: now, sea: { h: 7, at: now } }).sea.h, 1);
  const next = seaRoom(20, now);
  next.fighters.get('b').seaCarry = c;
  R.seaHelm(next, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, now + 500);
  assert.equal(next.ships.get('b').hp, c.h * next.ships.get('b').max, 'her bar as she carried it');
  assert.equal(next.fighters.get('b').seaCarry, null, 'taken once');
  const stale = seaRoom(20, now);
  stale.fighters.get('b').seaCarry = { ...c, at: now - R.SEA_REF.mendMs };
  R.seaHelm(stale, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, now);
  assert.equal(stale.ships.get('b').hp, stale.ships.get('b').max, 'a carry past the mend: whole');
  // E6B: canvas and a fire take no bar - and claim no ship the sea's guns broke
  const s4 = seaRoom(20, 1000);
  R.seaHelm(s4, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, 1000); R.seaHelm(s4, 'b', { id: 'pb', ci: RC, hl: 2, u: 22 }, 1000);
  const sail = R.seaShot(s4, 'a', 'b', { d: 0, s: 30, f: true }, 20_000);
  assert.ok(sail.ok && sail.sail > 0 && sail.fire && sail.dealt === 0);
  assert.equal(s4.ships.get('b').by, null, 'no bar taken: no killer');
  assert.equal(R.seaHelm(s4, 'b', { id: 'pb', ci: RC, hl: 2, u: 22, h: 0 }, 21_000, { rid: 'aaaaaaaaaaaa' }), null, 'the sea broke her: no captain\'s wreck');
  assert.deepEqual([R.seaShot(s4, 'a', 'b', { d: 50, s: 5 }, 30_000).why, R.seaShot(s4, 'b', 'a', { d: 50 }, 30_000).why], ['ship', 'ship'], 'at none by the sea: out of the fight both ways');
  assert.equal(s4.ships.get('b').wrecked, false);
  R.seaHelm(s4, 'b', { id: 'pb', ci: RC, hl: 2, u: 22, h: 1 }, 20_000 + R.SEA_REF.mendMs); R.seaHelm(s4, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, 20_000 + R.SEA_REF.mendMs);
  assert.ok(R.seaShot(s4, 'a', 'b', { d: 5 }, 21_000 + R.SEA_REF.mendMs).dealt > 0, 'mended: on the guns again');
  // A6: a jumper boards nothing
  const s5 = seaRoom(10, 1000);
  R.seaHelm(s5, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, 1000); R.seaHelm(s5, 'b', { id: 'pb', ci: RC, hl: 0, u: 22 }, 1000);
  let wreck = null;
  for (let t = 2000; t < 400_000 && !wreck; t += 1000) { if (t % 5000 === 0) { R.seaHelm(s5, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, t); R.seaHelm(s5, 'b', { id: 'pb', ci: RC, hl: 0, u: 22 }, t); } wreck = R.seaShot(s5, 'a', 'b', { d: 20, rid: 'bbbbbbbbbbbb' }, t).wreck; now = t; }
  assert.ok(wreck);
  wildPose(s5, 'a', { x: -5000 * SIEGE_UNITS_PER_M, y: 0, z: 0 }, now + 100);
  wildPose(s5, 'a', { x: 10 * SIEGE_UNITS_PER_M, y: 0, z: 0 }, now + 116);
  assert.equal(R.seaBoard(s5, 'a', 'bbbbbbbbbbbb', now + 116), null, 'beside her in a jump: never');
  assert.equal(R.seaBoard(s5, 'a', 'bbbbbbbbbbbb', now + 116 + WILD_REF.jumpMs)?.boarded, true, 'the jump spent: boarded');
});

test('AUDIT SEA VENTURES A3, A4, F1/A1: the relay - what landed is said rounded down and her bar left rounded up, so a one-point word lays no more than it took; a hull said with no uid is no ship; a captain struck in one cell carries her bar into the next, kept at the hub (mutants: the floor, the ceiling, the uid, the carry put, the carry taken)', async () => {
  assert.equal(validWildData({ k: 'helm', hl: 2, t: 100, u: 0, h: 1000 }), null, 'a hull with no uid');
  assert.deepEqual(validWildData({ k: 'helm', hl: -1, t: 100, u: 0, h: 0 }), { k: 'helm', hl: -1, t: 100, u: 0, h: 0 }, 'her helm left');
  const T = 1_800_000_000, realNow = Date.now;
  let clock = T * 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const A = worldRoom(7800, -5000), B = worldRoom(7800 + 2 * 16, -5000);
    assert.notEqual(A, B, 'two cells');
    const base = (key) => { const m = /^world:(-?\d+),(-?\d+)$/.exec(key); return { x: Number(m[1]) * PIXEL_UNITS + 16384, z: (499 - Number(m[2])) * PIXEL_UNITS + 16384 }; };
    const join = async (key, id, x, ci) => {
      const r = world.room(key), b0 = base(key), ws = r.connect();
      await r.hello(ws, id, { x: b0.x + x * SIEGE_UNITS_PER_M, y: 0, z: b0.z, yaw: 0, pitch: 0 }, { lv: 10, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, rc: 1, ci });
      await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } }));
      return ws;
    };
    const ra = world.room(A);
    const a = await join(A, 'peer-0001', -5, RK), b = await join(A, 'peer-0002', 5, RC);
    const helm = (r, ws, hl, u, t = 240) => r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'helm', hl, t, u, h: 1000 } }));
    await helm(ra, a, 4, 11); await helm(ra, b, 4, 22);
    clock += 30_000;
    await helm(ra, a, 4, 11);
    for (let i = 0; i < 10; i++) { clock += 100; await ra.raw(a, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0002', d: 1, s: 0, f: 0 } })); }
    const hulls = b.sent.filter((m) => m.t === 'wref' && m.k === 'hull');
    assert.equal(hulls.length, 10);
    const ship = ra.room._wildRef.ships.get('acct-peer-0002') ?? [...ra.room._wildRef.ships.values()].find((x) => x.u === 22);
    assert.deepEqual(hulls.map((h) => h.d), Array(10).fill(0), 'a point of a 2,150-point bar is no thousandth of it');
    assert.equal(hulls.at(-1).h, Math.ceil(ship.hp / ship.max * 1000), 'her bar left rounded up - she is laid no lower than it');
    assert.ok(1000 - hulls.at(-1).h <= Math.ceil(10 / ship.max * 1000), 'ten points laid as ten points');
    // she is battered, and sails into the next cell
    for (let i = 0; i < 600 && ship.hp / ship.max > 0.6; i++) { clock += 1000; if (i % 5 === 0) { await helm(ra, a, 4, 11); await helm(ra, b, 4, 22); } await ra.raw(a, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0002', d: 40, s: 0, f: 0 } })); }
    const share = ship.hp / ship.max;
    assert.ok(share < 0.9 && share > 0, `battered: ${share}`);
    await ra.drop(b);
    for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res));
    const rb = world.room(B);
    const b2 = await join(B, 'peer-0002', 5, RC);
    await helm(rb, b2, 4, 22);
    const there = [...rb.room._wildRef.ships.values()].find((x) => x.u === 22);
    assert.ok(Math.abs(there.hp / there.max - share) < 1e-9, `her bar carried across the cell's line: ${there.hp / there.max} for ${share}`);
  } finally { Date.now = realNow; }
});

test('AUDIT SEA VENTURES E6A, E6B, E6C: the page\'s guns - stepped every online frame (the zone\'s), never the exterior\'s unpaused alone; a wreck of mine said at her helm at none; my shot words within SEA_SHOT_HZ a second over every ship under my guns, a word unsaid kept and gathered on; no cabin below with a stranger captain\'s ship near (mutants: the frame, the wreck\'s word, the budget, the kept, the cabin)', () => {
  assert.ok(SEA_SHOT_HZ < R.SEA_REF.hz, 'within the referee\'s word rate, with slack');
  assert.equal(SEA_CAPTAIN_NEAR_M, HOSTILE_NEAR_M, 'a stranger captain near as near as a hostile ship');
  const st = { now: 100_000, sent: [], ok: true, helm: { hl: 4, u: 22, t: 1, h: 1, wrecked: false, pos: [0, 0, 0] } };
  const naval = { pvp: { helm: () => st.helm, peerAt: () => null } };
  const b = createSeaBroadsides({ live: () => true, naval: () => naval, send: (d) => { if (!st.ok) return false; st.sent.push(d); return true; }, me: () => 'peer-me', stranger: () => true, now: () => st.now });
  b.step();
  // three ships under my guns, struck each frame for ten seconds
  for (let f = 0; f < 600; f++) {
    st.now += 1000 / 60;
    for (const p of ['p1', 'p2', 'p3']) b.shot(p, { hull: 1 });
    b.step();
  }
  const shots = st.sent.filter((d) => d.k === 'shot');
  assert.ok(shots.length <= SEA_SHOT_HZ * 10 + SEA_SHOT_HZ, `${shots.length} words in ten seconds`);
  assert.ok(shots.length >= SEA_SHOT_HZ * 10 - 2 * 1000 / SEA_SHOT_MS, `the purse spent: ${shots.length}`);
  for (let f = 0; f < 120; f++) { st.now += 1000 / 60; b.step(); }
  const laid = st.sent.filter((d) => d.k === 'shot').reduce((n, d) => n + d.d, 0);
  assert.equal(laid, 1800, 'every point said - a word the purse could not say gathered on, never dropped');
  // the socket shut: kept, said whole when it opens
  st.ok = false;
  b.shot('p1', { hull: 40 });
  st.now += 1000; b.step();
  b.shot('p1', { hull: 2 });
  st.ok = true;
  st.now += 1000; b.step();
  assert.equal(st.sent.filter((d) => d.k === 'shot').at(-1).d, 42, 'the word the socket refused, kept');
  // E6B: wrecked in my own game
  st.helm = { ...st.helm, wrecked: true, h: 0.3 };
  st.now += 1000; b.step();
  assert.deepEqual(st.sent.at(-1), { k: 'helm', hl: 4, t: 100, u: 22, h: 0 });
  // E6A: by source - the zone's frame steps them, the cabin asks the captains
  const sea = readFileSync(new URL('../../../src/scenes/seaVenturesHost.js', import.meta.url), 'utf8');
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(sea, /gather, step, guns: pvpStep,/);
  assert.doesNotMatch(sea, /function step\(strikes = 0\) \{\n\s+pvpStep\(\);/);
  const wf = world.slice(world.indexOf('const wildFrame = () => {'), world.indexOf('const takeSeat = () => {'));
  assert.match(wf, /\n\s+seaVentures\.guns\(\);/, 'every online frame, the dead\'s and the paused\'s');
  assert.match(world, /hostile: \(\) => navalHostileNear\(\) \|\| !!naval\?\.pvp\?\.captainNear\?\.\(\),/);
  // the cabin's captain near
  const guns = { live: true, open: (peer) => peer !== 'kin' };
  const peers = [];
  const pvp = createNavalPvp({ enabled: () => true, boat: () => ({ uid: 9, hull: 2 }), stateOf: () => ({ damage: createShipDamage({ hullHp: 600, sailHp: 200, crew: 10, player: true }) }), build: () => ({ hullHp: 600 }), pose: () => ({ position: [0, 0, 0] }), peers: () => peers, clock: () => 0, due: () => ({ hull: 1 }) });
  assert.equal(pvp.captainNear(), false, 'no guns attached: no captain');
  pvp.attach(guns);
  peers.push({ id: 'p1', pos: [SEA_CAPTAIN_NEAR_M + 1, 0, 0] }, { id: 'kin', pos: [10, 0, 0] });
  assert.equal(pvp.captainNear(), false, 'my party\'s at hand, a stranger past the reach');
  peers.push({ id: 'p2', pos: [0, 0, SEA_CAPTAIN_NEAR_M] });
  assert.equal(pvp.captainNear(), true, 'a stranger captain\'s ship near');
  guns.live = false;
  assert.equal(pvp.captainNear(), false, 'the open sea\'s guns shut here: none');
});

test('AUDIT SEA VENTURES D7, D8, A5: a vault of the deep stands in a room of its own lane - the one its gate let me into, or the day\'s I stand in - never its plain ruin\'s, so the hub\'s wipe on a client\'s word reaches no plain ruin and the day\'s turn never puts a vault and its ruin in one room; the hub wipes a hall at every size it is laid at (mutants: the lane, the room key, the sizes)', async () => {
  const [cx, cy] = [723, 240], place = etherPlaceId({ cx, cy }), H = seaVaultKey(cx, cy);
  assert.equal(seaVaultMapId(cx, cy), place);
  assert.equal(seaVaultRoomMapId(cx, cy) >>> 20, SEA_VAULT_LANE);
  assert.equal(seaVaultRoomMapId(cx, cy) & 0xfffff, place & 0xfffff, 'the same cell, its own lane');
  assert.notEqual(seaVaultRoomMapId(cx, cy), place, 'never the plain ruin\'s room');
  assert.equal(SEA_VAULT_LANE, 0xe8);
  assert.equal(seaVaultRoomId(place, H), seaVaultRoomMapId(cx, cy), 'the vault the gate let me into: its lane');
  assert.equal(seaVaultRoomId(place, null), place, 'its plain ruin: its own');
  assert.equal(seaVaultRoomId(place, seaVaultKey(cx + 1, cy)), place, 'another isle\'s vault: its own');
  assert.equal(seaVaultRoomId(place, '512,88'), place, 'a mountain hall: its own');
  assert.equal(seaVaultRoomId(777, H), 777, 'another dungeon');
  assert.equal(wdunRoomKey(H), `dungeon:m${seaVaultRoomMapId(cx, cy)}`, 'the hub wipes the vault\'s room alone');
  assert.ok(seaRoomOf(`dungeon:m${seaVaultRoomMapId(cx, cy)}.m`), 'a fall in a vault is the open sea\'s');
  assert.deepEqual(seaRoomCell(`dungeon:m${seaVaultRoomMapId(cx, cy)}`), [cx, cy], 'and keeps no instance');
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /mapId: ident\?\.kind === 'dungeon' \? seaVaultRoomId\(ident\.mapId \?\? null, _wdunInside\?\.h \?\? seaVentures\.vaultHere\(\)\?\.key\) :/);
  // A5: the hub's wipe at every size - a mountain hall laid small, a vault laid medium
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const ws = hub.connect();
    await hub.hello(ws, 'peer-a', null, { name: 'a', acct: 'acct-a', asecret: 'secret-a', kind: 'linked' }); clock += 700;
    for (const h of ['100,50', H]) {
      const base = wdunRoomKey(h), rooms = ['', '.m', '.s'].map((t) => world.room(`${base}${t}`));
      for (const r of rooms) r.store.set('world:snap', { foes: [1] });
      await hub.raw(ws, JSON.stringify({ t: 'wdun', k: 'in', h })); clock += 700;
      await hub.raw(ws, JSON.stringify({ t: 'wdun', k: 'out', h })); clock += WDUN_RESET_MS + 61 * 60_000;
      await hub.raw(ws, JSON.stringify({ t: 'wdun', k: 'in', h })); clock += 700;
      assert.deepEqual(rooms.map((r) => r.store.get('world:snap')), [undefined, undefined, undefined], `${h}: whole, medium and small wiped`);
    }
    assert.equal(wdunRoomKey('100,50'), `dungeon:m${spawnedHallMapId(100, 50)}`);
  } finally { Date.now = realNow; }
});

test('AUDIT SEA VENTURES A7, A10: the hub hears a treasure fleet\'s flagship sunk only while she is under way (her hour in port and the hour before scattered her before she sailed) and never from a guest; a page asks it only of a hub that reads it (mutants: the window, the guest, the gate)', async () => {
  assert.deepEqual([SEA_FLEET_OFFSET_MS, SEA_FLEET_SAIL_MS], [FLEET_OFFSET_MS, FLEET_SAIL_MS], 'the relay\'s copy is the sea\'s');
  const n = 9000, start = n * SEA_FLEET_PERIOD_MS + SEA_FLEET_OFFSET_MS, realNow = Date.now;
  let clock = start - 60_000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const join = async (id, kind) => { const ws = hub.connect(); await hub.hello(ws, id, null, { name: id, acct: `acct-${id}`, asecret: `s-${id}`, kind }); clock += 700; return ws; };
    const a = await join('peer-a', 'linked'), g = await join('peer-g', 'guest');
    const fd = () => a.sent.filter((m) => m.t === 'wdun' && m.k === 'fd');
    await hub.raw(a, JSON.stringify({ t: 'wdun', k: 'fk', n })); clock += 700;
    assert.equal(fd().length, 0, 'in port: nothing');
    clock = start + 60_000;
    await hub.raw(g, JSON.stringify({ t: 'wdun', k: 'fk', n })); clock += 700;
    assert.equal(fd().length, 0, 'a guest\'s word: nothing');
    await hub.raw(a, JSON.stringify({ t: 'wdun', k: 'fk', n })); clock += 700;
    assert.deepEqual(fd().at(-1)?.fleets, [n], 'under way, a registered captain\'s: scattered');
  } finally { Date.now = realNow; }
  // A10: never to a hub that would close the socket on it
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  s.join(SOCIAL_ROOM);
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: 'world241', peers: [], host: null, world: null });
  assert.equal(s.wdunOk, true);
  assert.equal(s.sendWdun({ k: 'fk', n }), false, 'an older hub: never said');
  assert.equal(s.sendWdun({ k: 'hi' }), true);
});

test('AUDIT SEA VENTURES A8: a receipt owed a captain away is kept in the room\'s storage - an object that slept hands it to her when she is back; a wreck nobody comes back to is signed on the room\'s alarm (mutants: the owed kept, the owed read, the alarm armed, the alarm\'s beat)', async () => {
  const T = 1_800_000_000, realNow = Date.now;
  let clock = T * 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const key = worldRoom(7800, -5000), r = world.room(key);
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
    const b0 = { x: 7800 * PIXEL_UNITS + 16384, z: (499 + 5000) * PIXEL_UNITS + 16384 };
    const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, { x: b0.x + x * SIEGE_UNITS_PER_M, y: 0, z: b0.z, yaw: 0, pitch: 0 }, { lv: 10, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, rc: 1, ci }); await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } })); return ws; };
    const helm = (ws, hl, u, h = 1000) => r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'helm', hl, t: 100, u, h } }));
    const wreckIt = async (a, b) => {
      let wreck = null;
      for (let k = 0; k < 600 && !wreck; k++) {
        clock += 1000;
        if (k % 5 === 0) { await helm(a, 4, 11); await helm(b, 0, 22); }
        await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0002', d: 40, s: 0, f: 0 } }));
        wreck = a.sent.find((m) => m.t === 'wref' && m.k === 'wreck') ?? null;
      }
      return wreck;
    };
    // boarded with her away; the object sleeps; she comes back
    let a = await join('peer-0001', -5, RK), b = await join('peer-0002', 5, RC);
    const w1 = await wreckIt(a, b);
    assert.ok(w1);
    await r.drop(b);
    await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'board', r: w1.r } }));
    assert.ok(a.sent.some((m) => m.t === 'wref' && m.k === 'wc'), 'signed for him');
    for (let i = 0; i < 4; i++) await new Promise((res) => setImmediate(res));
    assert.ok([...r.store.keys()].some((k) => k.startsWith('wildowed:')), 'hers kept in storage');
    await r.drop(a);
    r.wake();
    const b2 = await join('peer-0002', 5, RC);
    assert.ok(b2.sent.some((m) => m.t === 'wref' && m.k === 'wc' && m.r === w1.r), 'handed to her, back after a wake');
    for (let i = 0; i < 4; i++) await new Promise((res) => setImmediate(res));
    assert.equal([...r.store.keys()].some((k) => k.startsWith('wildowed:')), false, 'and forgotten once handed');
    // nobody comes back: the alarm signs it
    a = await join('peer-0001', -5, RK);
    const w2 = await wreckIt(a, b2), w2End = clock + R.SEA_REF.boardMs + 1000;
    assert.ok(w2);
    assert.ok(r.alarm.at != null && r.alarm.at <= clock + R.SEA_REF.boardMs + 1000, 'the room\'s alarm armed for her boarding\'s end');
    await r.drop(a); await r.drop(b2);
    r.wake();
    for (let i = 0; i < 6 && r.alarm.at != null && r.alarm.at <= w2End; i++) { clock = Math.max(clock, r.alarm.at + 1); await r.fire(); }
    assert.equal([...r.store.keys()].some((k) => k.startsWith('seawreck:')), false, 'signed on the alarm, nobody back');
    assert.ok([...r.store.keys()].filter((k) => k.startsWith('wildowed:')).length >= 1, 'its receipts owed both, kept');
  } finally { Date.now = realNow; }
});

test('AUDIT SEA VENTURES D1, D12: a legend\'s Tidemail comes with her purse alone - another\'s copy of her, sunk again before the aether raises her, gives none; the Captain\'s Due and the piece out of the naval host (mutants: the purse\'s gate)', () => {
  const legend = legendById('starless') ?? { name: 'a legend', band: 'abyss' };
  const out = { gave: [], said: [] };
  const o = { give: (items) => out.gave.push(...items), say: (x) => out.said.push(x) };
  assert.equal(legendTidemail({ ...legend, band: 'abyss' }, 1111, 0, o), null, 'no purse: no piece');
  assert.equal(legendTidemail({ ...legend, band: 'abyss' }, 1111, undefined, o), null);
  assert.deepEqual(out.gave, []);
  const piece = legendTidemail({ ...legend, band: 'abyss' }, 1111, 12000, o);
  assert.ok(piece, 'her purse paid: the Abyss\'s piece every time');
  assert.deepEqual(out.gave, [piece]);
  assert.deepEqual(dueOnHull({ hull: 10, sail: 4 }, { hull: 0.5 }), { hull: 5, sail: 2 });
  const n = readFileSync(new URL('../../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');
  assert.doesNotMatch(n, /function legendTidemail\(|function dueOnHull\(/, 'never inside createNavalHost');
});

test('AUDIT SEA VENTURES D2, D4, D5, D9, D10: a treasure fleet\'s flagship pays each captain once a sailing - kept in the save, so a second end, another\'s copy or a reload pays nothing and gives no piece - and a reload never stands her again; the hub\'s hello never puts my own sinking out, and the hub is told until it says so; her piece rolls the sailing\'s band; each ship stands on water deep enough for her own hull (mutants: the once, the save, the piece\'s gate, the stood, the hello, the telling, the band, the hull)', () => {
  // the ledger keeps them, newest ETHER_FLEETS_KEEP, through the save
  const L = createCaptainLedger();
  assert.deepEqual([L.endFleet(7), L.endFleet(7), L.fleetEnded(7), L.fleetEnded(8)], [true, false, true, false]);
  for (let n = 10; n < 20; n++) L.endFleet(n);
  assert.equal(L.getSaveData().ether.fleets.length, ETHER_FLEETS_KEEP);
  const back = createCaptainLedger();
  back.restoreSaveData(JSON.parse(JSON.stringify({ ...L.getSaveData(), ether: { ...L.getSaveData().ether, fleets: [19, 19, 'x', -1, 18] } })));
  assert.deepEqual(back.getSaveData().ether.fleets, [19, 18], 'read back: whole sailings, once each');
  // the sea's host: once a sailing, never put out by the hub, told until it hears
  let now = 0;
  for (let k = 9000; k < 9100 && !SE.fleetAt(now); k++) now = k * SEA_FLEET_PERIOD_MS + SEA_FLEET_OFFSET_MS + 60_000;
  const f = SE.fleetAt(now);
  assert.ok(f);
  const ledger = createCaptainLedger(), credits = [], sent = [], fed = [];
  const host = createEtherHost({ ledger, day: () => 1, credit: (x) => credits.push(x) });
  const make = () => createSeaVentures({
    live: () => false, day: () => 0, pixel: () => ({ x: Math.floor(f.from.x), y: Math.floor(f.from.y) }), locks: new Map(), crows: new Map(), mine: () => null,
    clock: () => now, naval: () => ({ fleet: (list, o) => fed.push(o) }), state: { localFromWorld: (x, z) => [x / 40, z / 40] },
    link: () => ({ wdunSeaOk: true, status: 'open', sendWdun: (w) => { sent.push(w); return true; } }), ether: host,
  });
  const v = make();
  assert.equal(v.fleetEnded(f.n, 'sink'), f.purse);
  assert.equal(v.fleetEnded(f.n, 'board'), 0, 'a second end of the sailing: nothing');
  assert.deepEqual(credits, [f.purse]);
  const fresh = make();
  fresh.step(0);
  assert.equal(fed.at(-1)?.sunk, true, 'after a reload she is never stood again - the save says so, before any word');
  assert.equal(fresh.chartWord().fleet.sunk, true);
  const reloaded = make();
  assert.equal(reloaded.fleetEnded(f.n, 'sink'), 0, 'after a reload: nothing (the save keeps it)');
  reloaded.step(0);
  assert.equal(fed.at(-1)?.sunk, true);
  reloaded.hubWord({ k: 'st', fleets: [] });
  assert.equal(reloaded.chartWord().fleet.sunk, true, 'the hub\'s hello puts my own sinking out never');
  sent.length = 0;
  now += FLEET_TELL_MS; reloaded.step(0);
  assert.deepEqual(sent, [{ k: 'fk', n: f.n }], 'the hub not having said it: told again');
  now += FLEET_TELL_MS - 1; reloaded.step(0);
  assert.equal(sent.length, 1, 'no sooner than FLEET_TELL_MS');
  reloaded.hubWord({ k: 'fd', fleets: [f.n] });
  now += FLEET_TELL_MS; reloaded.step(0);
  assert.equal(sent.length, 1, 'the hub has it: no more');
  // the fleet's module: no purse, no piece; the sailing's band; her hull's water
  const out = { gave: [], said: [], water: [] };
  let paid = 0;
  const sea = new Map();
  const fl = createTreasureFleet({
    sea, launch: (spec) => { const e = { id: `e${spec.seed}`, owner: null, ship: { seed: spec.seed, pos: spec.pos, names: { name: 'Her' }, damage: { state: SHIP_STATES.afloat } }, ether: spec.ether }; sea.set(e.id, e); return e; },
    retire: () => {}, busy: () => false, feet: () => [0, 0, 0], isWater: (x, z, hull) => { out.water.push(hull); return true; }, seaY: () => 0, launches: () => true,
    give: (items) => out.gave.push(...items), say: (x) => out.said.push(x), fleetEnded: () => paid,
  });
  const list = { n: f.n, band: f.band, ships: f.ships.map((s, i) => ({ seed: s.seed, classId: s.classId, flag: s.flag, pos: [i * 10, 0, 0], ahead: [i * 10, 0, 100], yaw: 0 })) };
  fl.step(list);
  assert.deepEqual(out.water, f.ships.map((s) => classById(s.classId).hull), 'each on water deep enough for her own hull');
  const flag = [...sea.values()].find((e) => e.fleet?.flag);
  flag.ether = 'reaches';   // a copy stood in the Reaches' waters
  assert.equal(fl.ended(flag, 'sink'), null, 'no purse: no piece');
  assert.deepEqual(out.gave, []);
  paid = f.purse;
  const piece = fl.ended(flag, 'sink');
  assert.ok(f.band === 'abyss' ? piece : true, 'the sailing\'s band rolls it, never the waters her copy stood in');
  if (piece) assert.deepEqual(out.gave, [piece]);
});

test('AUDIT SEA VENTURES D6, D11: a storm\'s wrack cask hauled is kept in the save - a reload floats it never again; a storm is born far enough west that its drift and reach never touch the Reaches (mutants: the haul kept, the haul read, the birth)', () => {
  const L = createCaptainLedger();
  assert.deepEqual([L.haulWrack('strand:wrack:5:1'), L.haulWrack('strand:wrack:5:1'), L.wrackHauled('strand:wrack:5:1')], [true, false, true]);
  for (let i = 0; i < 40; i++) L.haulWrack(`strand:wrack:6:${i}`);
  assert.equal(L.getSaveData().ether.wrack.length, ETHER_WRACK_KEEP);
  const back = createCaptainLedger();
  back.restoreSaveData(JSON.parse(JSON.stringify(L.getSaveData())));
  assert.equal(back.wrackHauled('strand:wrack:6:39'), true, 'read back');
  // the host over the ledger: hauled once, across a reload
  let s = null, now = 0;
  for (let n = 1000; n < 1100 && !s; n++) { s = SE.stormOf(n); now = s.start + 600_000; }
  const e = SE.stormEye(s, now), px = { x: Math.floor(e.x), y: Math.floor(e.y) };
  const ledger = createCaptainLedger();
  const host = createEtherHost({ ledger, day: () => 1 });
  const make = () => createSeaVentures({ live: () => false, day: () => 0, pixel: () => px, locks: new Map(), crows: new Map(), mine: () => null, clock: () => now, naval: () => null, state: { localFromWorld: (x, z) => [x, z] }, link: () => null, ether: host });
  const v = make();
  const site = v.wrackSites(px.x, px.y)[0];
  assert.ok(site);
  assert.ok(v.gather(site.id).items.length, 'hauled');
  const again = make();
  assert.deepEqual(again.wrackSites(px.x, px.y), [], 'a reload floats it never again');
  assert.deepEqual(again.gather(site.id).items, []);
  // D11: the storm's reach, its whole life, west of the Reaches
  const deepEast = VEIL_X - BANDS.find((b) => b.id === 'deep').from * LEAGUE_PX;
  for (let n = 0; n < 4000; n++) {
    const st = SE.stormOf(n);
    assert.ok(Math.max(st.x0, st.x1) + st.r <= deepEast + 1e-9, `storm ${n} reaches the Reaches`);
  }
  assert.equal(etherBandAt(deepEast - 1).id, 'deep');
});

test('AUDIT SEA VENTURES C2: Veilhaven\'s peace holds the way home - her own rows east of her to the Veil, so a captain reaches the crossing without a pixel of open zone; the chart draws that shape and no other (mutants: the corridor, the chart\'s band)', () => {
  const h = veilhaven();
  for (let x = h.px; x <= h.px + 60; x++) assert.equal(etherWildRingAt(x, h.py), 0, `her row at ${x}: peace`);
  for (const dy of [-ETHER_PEACE_PX, ETHER_PEACE_PX]) assert.equal(etherInPeace(h.px + 30, h.py + dy), true);
  for (const dy of [-ETHER_PEACE_PX - 1, ETHER_PEACE_PX + 1]) assert.equal(etherInPeace(h.px + 30, h.py + dy), false, 'a row past the band: open');
  assert.equal(etherInPeace(h.px - ETHER_PEACE_PX - 1, h.py), false, 'west of her: the ring alone');
  // reached from Veilhaven without leaving the peace: the Veil
  const seen = new Set([`${h.px},${h.py}`]), q = [[h.px, h.py]];
  let veil = false;
  while (q.length && !veil) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !inEther(nx, ny) || !etherInPeace(nx, ny)) continue;
      if (inVeil(nx, ny)) veil = true;
      seen.add(k); q.push([nx, ny]);
    }
  }
  assert.ok(veil, 'the Veil, by the peace alone');
  // the chart's shape is the peace's: each pixel's middle inside the ring or the band exactly when the pixel is peace
  for (const zoom of [1, 2, 4]) {
    const m = CHART.chartModel({ px: h.px - 18, py: h.py + 3, yaw: 0, charted: [h.key], legends: [], stats: {}, pvp: true }, { cx: h.px + 20.5, cy: h.py + 0.5, zoom }, 1064, 550);
    const k = CHART.CHART_ZOOMS[zoom], p = m.peace;
    const shape = (sx, sy) => Math.hypot(sx - p.x, sy - p.y) <= p.r + 1e-9 || (sx >= p.x && sx <= p.vx && Math.abs(sy - p.y) <= p.r + 1e-9);
    for (let x = h.px - 14; x < VEIL_X; x++) for (let y = h.py - 14; y <= h.py + 14; y++) {
      const sx = p.x + (x - h.px) * k, sy = p.y + (y - h.py) * k;
      assert.equal(shape(sx, sy), etherInPeace(x, y), `zoom ${zoom}: pixel ${x},${y}`);
    }
  }
});

test('AUDIT SEA VENTURES C1, C3, C4, C5/F2: the linked bank cabin is a teleport like any - never into, out of or about the open sea, nor across the Veil; a party\'s walk onto the open sea warns as one into the mountains does; a wagon parked on the open sea\'s ground is with its owner at a death there; a death past the Veil rises at the nearest freeport, however far (mutants: the cabin\'s refusals, the walk, the cart, the rise)', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const cab = w.slice(w.indexOf('async function enterLinkedBankCabin('), w.indexOf('async function boardOrDisembark('));
  const refuse = cab.indexOf('if (!loading && (wildTeleportRefused(boatPixelOf(boat)) || veilRefused(boatPixelOf(boat)))) return true;');
  assert.ok(refuse > 0 && refuse < cab.indexOf('await _teleportToPixel(boat.MapPixel.X, boat.MapPixel.Y);'), 'refused before the teleport');
  assert.match(w, /const boatPixelOf = \(boat\) => \(\{ x: boat\.MapPixel\.X, y: boat\.MapPixel\.Y \}\);/);
  assert.match(w, /const wildWalkRow = \(x, y\) => \{ const m = wildMask\(\); return !online\?\.wildOk \? null : etherSea && etherWildRingAt\(x, y\) > 0 \? zoneWord\('walkInto', ETHER_KIND\) : m && wildNear\(m, x, y\) \? WILD_TEXT\.walkInto : null; \};/);
  assert.equal(zoneWord('walkInto', ETHER_KIND), ETHER_WILD_TEXT.walkInto());
  assert.match(zoneWord('walkInto', ETHER_KIND), /open Eltheric Ocean past Veilhaven's peace, an open PvP zone/);
  // C4: a wagon parked on the open sea's ground is with its owner; one parked outside every zone is away
  const blob = (x, y) => { const dx = (x - 520) / 38, dy = (y - 110) / 24; return dx * dx + dy * dy < 1; };
  const mask = wildMaskOf({ getRegionIndexAt: (x, y) => (blob(x, y) ? WILD_REGION : 3), getLocationByName: () => null });
  const parked = (px) => ({ Mode: WAGON_MODE.Deployed, WorldX: px.x * 32768 + 16384, WorldZ: (499 - px.y) * 32768 + 16384 });
  const h = veilhaven(), isle = islesNear(h.px - 300, h.py, 40).find((i) => i.kind === 'wild' || i.kind === 'ruin');
  const at = { x: isle.px, y: isle.py };
  assert.deepEqual(worldCoordToMapPixel(parked(at).WorldX, parked(at).WorldZ), at);
  assert.ok(etherWildRingAt(at.x, at.y) > 0);
  assert.equal(wildCartAway(parked(at), mask), false, 'on the open sea: with its owner');
  assert.equal(wildCartAway(parked({ x: 200, y: 300 }), mask), true, 'in the Bay: away');
  let heart = null;
  for (let i = 0; i < mask.inside.length && !heart; i++) if (mask.inside[i]) heart = { x: i % mask.width, y: Math.floor(i / mask.width) };
  assert.equal(wildCartAway(parked(heart), mask), false, 'in the mountains: with its owner, as ever');
  // C5/F2: the nearest freeport, by distance, however far - Veilhaven only when she is the nearest
  for (const [x, y] of [[6900, -5108], [7699, -4976], [7000, -5400], [6950, -4800], [7500, -5600]]) {
    const port = etherRisePort(x, y);
    let best = null;
    for (const i of islesNear(x, y, 1400)) if (i.kind === 'port' && (!best || Math.hypot(i.px - x, i.py - y) < Math.hypot(best.px - x, best.py - y))) best = i;
    assert.equal(port.key, best.key, `${x},${y}: the nearest, ${Math.round(Math.hypot(best.px - x, best.py - y))} px`);
  }
  assert.equal(etherRisePort(h.px + 3, h.py).key, h.key, 'at Veilhaven: her');
  assert.equal(etherRisePort(NaN, 0).key, h.key, 'nowhere: Veilhaven');
  assert.equal(ETHER_RISE_PX, 60);
});

test('AUDIT SEA VENTURES C6, C7: the open sea says its own words - /unstuck outdoors, a second revenant, a party left, a drop answered after the rise (by the room the fall was in), and the zone gone while still past the peace (never "Veilhaven\'s peace" where she is not) (mutants: each word, each call)', () => {
  const sea = (k) => zoneWord(k, ETHER_KIND), hills = (k) => zoneWord(k, null);
  assert.equal(hills('unstuckOut'), '/unstuck does not work outdoors in the mountains.');
  assert.equal(sea('unstuckOut'), '/unstuck does not work outdoors on the open Eltheric Ocean.');
  assert.equal(hills('revenantOne'), 'Only one revenant may walk at your side in the Wrothgarian Mountains.');
  assert.equal(sea('revenantOne'), 'Only one revenant may walk at your side on the open Eltheric Ocean.');
  assert.equal(hills('truce'), WILD_TEXT.truce);
  assert.match(sea('truce'), /^No longer in your party\. On the open Eltheric Ocean/);
  assert.equal(hills('dropLate'), WILD_TEXT.dropLate);
  assert.match(sea('dropLate'), /when you died at sea/);
  assert.match(sea('burntLate')(), /when you died at sea .* frozen/);
  assert.equal(sea('quiet'), 'You are out of the open Eltheric Ocean\'s PvP zone. No player may attack you here.');
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /say\(zoneWord\('unstuckOut'\)\); return true; \}/);
  assert.match(w, /townTalk\.say\(zoneWord\('truce'\)\);/);
  assert.match(w, /townTalk\.say\(d\.burnt \? zoneWord\('burntLate', seaRoomOf\(room\) \? ETHER_KIND : null\)\(\) : zoneWord\('dropLate', seaRoomOf\(room\) \? ETHER_KIND : null\)\);/);
  assert.match(w, /zoneWord\(left === ETHER_KIND && !etherInPeace\(playerTravelPixel\(\)\?\.x, playerTravelPixel\(\)\?\.y\) \? 'quiet' : 'leave', left \|\| undefined\)/);
  assert.match(readFileSync(new URL('../../../src/systems/revenant/revenantCompanions.js', import.meta.url), 'utf8'), /revenantsWithYou\(\)\.length >= WILD_REVENANTS_MAX\) return zoneWord\('revenantOne'\);/);
  const was = tm.currentLocale();   // the mountains' two, as the sea's: through the text core (L10N4), read when said
  try {
    tm.setLocale(tm.PSEUDO_LOCALE);
    for (const k of ['unstuckOut', 'revenantOne']) {
      assert.notEqual(hills(k), k === 'unstuckOut' ? '/unstuck does not work outdoors in the mountains.' : 'Only one revenant may walk at your side in the Wrothgarian Mountains.', `${k}: said in the language`);
      assert.equal(typeof hills(k), 'string', `${k}: a string, where its callers read one`);
    }
  } finally { tm.setLocale(was); }
});

test('AUDIT SEA VENTURES F4: the sea\'s lines say a way and a ring\'s loot in the language of the moment - the sixteen points of the compass and "+75% loot" through the text core, in the harbourmaster\'s talk, the storm\'s and the fleet\'s words, the zone\'s ring lines and the chart\'s ways (mutants: the way, the bonus, the chart)', () => {
  const POINTS = ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east', 'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'];
  assert.deepEqual(POINTS.map(etherWayWord), POINTS, 'in English as they were');
  assert.deepEqual([etherWayWord(null), etherRingBonus(3)], ['', '+75% loot']);
  const was = tm.currentLocale();
  try {
    tm.setLocale(tm.PSEUDO_LOCALE);
    for (const p of POINTS) assert.notEqual(etherWayWord(p), p, `${p}: said in the language`);
    assert.notEqual(etherRingBonus(4), '+100% loot');
    assert.ok(ETHER_WILD_TEXT.ring(4).includes(etherRingBonus(4)), 'the ring line\'s loot');
    const english = /\b(north|south|east|west)(-|\b)/;
    const h = veilhaven();
    const v = createSeaVentures({ live: () => false, day: () => 0, pixel: () => ({ x: h.px, y: h.py }), locks: new Map(), crows: new Map(), mine: () => null, clock: () => 9000 * SEA_FLEET_PERIOD_MS + SEA_FLEET_OFFSET_MS + 60_000, naval: () => null, state: { localFromWorld: (x, z) => [x, z] }, link: () => null, ether: {} });
    for (const line of v.rumours({ px: h.px, py: h.py })) assert.doesNotMatch(line, english, line);
    assert.doesNotMatch(CHART.wayWords({ px: h.px, py: h.py }, { px: h.px - 300, py: h.py - 120 }), english);
  } finally { tm.setLocale(was); }
});

test('AUDIT SEA VENTURES F5: the referee\'s numbers pinned by value - the pins that read their offsets off SEA_REF (the boarding\'s window, the reach, the credit) moved with them and could not fail; and the rise\'s first reach (mutants: the window, the reach, the credit, the rise)', () => {
  assert.deepEqual({ ...R.SEA_REF }, {
    toughMax: 2.4, mendMs: 120_000, creditMs: 30_000, wreckMs: 600_000, boardMs: 180_000, boardM: 40,
    reachM: 300, slackM: 30, hz: 10, rateX: 1.5, depthX: 20, capX: 14, sailCapX: 4, fireMs: 10_000, helmMs: 20_000,
    shipsMax: 200, wrecksMax: 64,
  }, 'the record\'s numbers (bible/03-World/Eltheric-Ocean.md SHIP-PVP): three minutes to board, 300 m and 30 m of slack, 30 s of credit');
  assert.equal(ETHER_RISE_PX, 60, 'the rise sought from 60 px out, doubled until a freeport stands within it');
});
