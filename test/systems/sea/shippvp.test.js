// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - broadsides between
// captains in the open sea, a ship wrecked and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md SHIP-PVP): the
// wreck's receipt (net/wild/wildReceipt.js `n1`), the prize's law (net/sea/seaPrizeLaw.js), the relay's referee (net/sea/
// seaRef.js) pure and over the fake relay, the service's wreck, prizes, collect and reclaim over its real routes and records
// (server-account/src/seaWreck.js), the page's guns (scenes/naval/seaBroadsides.js), the naval host's seams (scenes/naval/
// navalPvp.js), the wreck's service half (scenes/seaWreckHost.js), the board's prize rows, the seams by source.
// tools/mutants/shippvp.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintSeaWreck, verifySeaWreck, readSeaWreck, seaWreckValid, verifyWildReceipt, SEA_WRECK_GRACE_S, SEA_WRECK_TTL_S, WILD_RECEIPT_MAX } from '../../../src/net/wild/wildReceipt.js';
import * as P from '../../../src/net/sea/seaPrizeLaw.js';
import * as R from '../../../src/net/sea/seaRef.js';
import { newWildRef, wildZone, wildPose, WILD_REF } from '../../../src/net/wild/wildRef.js';
import { SHIP_REF } from '../../../src/net/serpent/serpentBrain.js';
import { HULL_BUILDS } from '../../../src/systems/naval/navalShips.js';
import { refitShare, UPGRADE_TIERS } from '../../../src/systems/fleet.js';
import { validWildData, validWildRefOut, wildDirected, relaySupportsSeaPvp, SEA_PVP_KINDS, SEA_PVP_RELAY_MIN, SEA_SHOT_MAX, worldRoom, PIXEL_UNITS } from '../../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { itemWorth } from '../../../src/systems/item/itemLaw.js';
import { ENCHANTMENT_TYPES } from '../../../src/formats/magicDef.js';
import { createSeaBroadsides, SEA_SHOT_MS, SEA_HELM_SAY_MS, SEA_HELM_MIN_MS, SEA_BOARD_NEAR_M, SEA_BOARD_RETRY_MS, SEA_SAID_MS } from '../../../src/scenes/naval/seaBroadsides.js';
import { createNavalPvp, PVP_STRUCK_SHAKE } from '../../../src/scenes/naval/navalPvp.js';
import { createSeaWreckHost, SEA_WRECK_SLACK_S, SEA_WRECK_RETRY_MS, SEA_WRECK_CAPTAIN_RETRY_MS, SEA_WRECK_KEPT_MAX } from '../../../src/scenes/seaWreckHost.js';
import { createShipDamage, SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { wantedText, mountNavalYardWindow } from '../../../src/ui/naval/navalYardWindow.js';
import { accountSeaWreck, REFUSALS, SESSION_KEY } from '../../../src/net/accountClient.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { fakeRoom } from '../../fakeRoom.mjs';
import { standService } from '../../accountDb.mjs';
import { seatRealm, recordOf, realmJoinAt } from '../../realmSeat.mjs';
import { seeded } from '../../honestItems.mjs';
import { applyRarity } from '../../../src/systems/loot/lootRarity.js';
import worker from '../../../server-account/src/index.js';

const { subtle } = globalThis.crypto;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const keys = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const SEA_CELL = worldRoom(7800, -5000);
const RC = 'r00000000000000000d01', RK = 'r00000000000000000d02';
const sword = (m, extra = {}) => ({ ...createWeapon(120, m, seeded(9)), ...extra });

test('SHIP-PVP the wreck\'s receipt: its claims - both captains\' accounts and characters, the wreck\'s id, her uid, boarded or not, the room - within the wire\'s bounds; a fall\'s verifier refuses it, and it refuses a fall\'s own fields (mutants: each claim, the foreign, the version)', async () => {
  assert.deepEqual([SEA_WRECK_GRACE_S, SEA_WRECK_TTL_S], [300, 3600]);
  const ok = { f: 'acct-aaaa', c: RC, k: 'acct-bbbb', kc: RK, r: '0123456789ab', u: 77, b: 1, m: SEA_CELL, i: T, e: T + 60 };
  assert.ok(seaWreckValid(ok));
  assert.ok(seaWreckValid({ ...ok, b: 0 }));
  for (const bad of [{ f: 'acct-bbbb' }, { c: 'x' }, { kc: '' }, { kc: undefined }, { r: 'xyz' }, { u: 0 }, { u: 0x80000000 }, { u: 1.5 }, { b: 2 }, { b: true }, { m: 'Room' }, { m: undefined }, { e: T }, { e: T + 3601 }, { w: -1 }, { wt: [1, 2] }, { s: 1 }, { f: 5 }, { k: 'nope nope' }, { i: 1.5 }]) assert.equal(seaWreckValid({ ...ok, ...bad }), false, JSON.stringify(bad));
  assert.equal(seaWreckValid(null), false);
  assert.equal(seaWreckValid([ok]), false);
  const kp = await keys();
  const longest = await mintSeaWreck({ f: 'a'.repeat(40), c: RC, k: 'b'.repeat(40), kc: RK, r: '0123456789ab', u: 0x7fffffff, b: 1, m: `interior:m${'9'.repeat(10)}.4294967295.4294967295` }, kp.privateKey, { subtle, nowS: T });
  assert.ok(longest.length <= WILD_RECEIPT_MAX, `the longest fits: ${longest.length}`);
  const v = await verifySeaWreck(longest, kp.publicKey, { subtle, nowS: T + 1 });
  assert.deepEqual([v.ok, v.claims.u, v.claims.b, v.claims.kc], [true, 0x7fffffff, 1, RK]);
  assert.equal((await verifyWildReceipt(longest, kp.publicKey, { subtle, nowS: T + 1 })).why, 'version', 'never read as a fall');
  assert.equal((await verifySeaWreck(longest, kp.publicKey, { subtle, nowS: T + SEA_WRECK_TTL_S })).why, 'expired');
  assert.deepEqual(readSeaWreck(longest).u, 0x7fffffff);
  await assert.rejects(() => mintSeaWreck({ ...ok, u: 0 }, kp.privateKey, { subtle, nowS: T }), /refused/);
});

test('SHIP-PVP the prize\'s law: her hold the boat the wreck names; her best pieces while they come to a third of her hold\'s worth, her best always, eight at most; never one the ledger keeps back, classic, locked or bound; the places taken out in her own order (mutants: the share, the best, the most, the skips, the take)', () => {
  assert.deepEqual([P.SEA_PRIZE_SHARE, P.SEA_PRIZE_PIECES_MAX, P.SEA_PRIZE_HOLD_S, P.SEA_HOLD_VENDOR], [1 / 3, 8, 3 * 86_400, 'come-sail-away']);
  const hold = [sword(2), sword(2), sword(2), sword(1), sword(0), createWeapon(116, 1, seeded(9)), createWeapon(114, 1, seeded(9)), createWeapon(113, 0, seeded(9))];
  assert.deepEqual(hold.map(itemWorth), [180, 180, 180, 90, 45, 30, 18, 3]);
  assert.deepEqual(P.seaPrizePlaces(hold), [0, 4, 7], 'her best, then whatever more stays within a third (242 of 726)');
  assert.deepEqual(P.seaPrizePlaces([sword(4), sword(0)]), [0], 'her best always, past the third');
  assert.deepEqual(P.seaPrizePlaces(Array.from({ length: 30 }, () => createWeapon(113, 0, seeded(9)))).length, 8, 'eight at most');
  assert.deepEqual(P.seaPrizePlaces([sword(4, { locked: true }), sword(2, { bound: true }), sword(1)]), [2], 'never locked nor bound');
  assert.deepEqual(P.seaPrizePlaces([...hold, sword(4, { locked: true })]), [0, 4, 7], 'and what she may not give swells no share');
  assert.deepEqual(P.seaPrizePlaces([sword(4), sword(1)], (it) => it.material === 4), [1], 'nor one the ledger keeps back');
  const classic = [{ type: ENCHANTMENT_TYPES.PotentVs, param: 2 }, ...Array.from({ length: 9 }, () => ({ type: ENCHANTMENT_TYPES.None, param: -1 }))];
  assert.equal(P.prizeable({ ...sword(1), enchantments: classic }), false, 'a classic save\'s piece - "Keep all, can\'t sell"');
  assert.equal(P.prizeable(sword(1)), true);
  assert.deepEqual(P.seaPrizePlaces([]), []);
  assert.deepEqual(P.seaPrizePlaces(null), []);
  const save = { modData: { 'come-sail-away': { placedBoats: [{ UID: 5, Items: [sword(0)] }, { UID: 77, Items: hold.slice() }] } } };
  assert.equal(P.seaHoldOf(save, 77).length, 8);
  assert.equal(P.seaHoldOf(save, 6), null);
  assert.equal(P.seaHoldOf(save, 0), null);
  const taken = P.takeSeaPrize(save, 77, [0, 4, 7]);
  assert.deepEqual(taken.map(itemWorth), [180, 45, 3]);
  assert.deepEqual(P.seaHoldOf(save, 77).map(itemWorth), [180, 180, 90, 30, 18], 'the rest stays, in order');
  assert.equal(P.takeSeaPrize(save, 77, [9]), null, 'a place that is no piece of her: nothing taken');
  assert.equal(P.seaHoldOf(save, 77).length, 5);
});

/** A room's referee state: two captains in the zone, their places `gap` metres apart. */
function seaRoom(gap = 50, now = 1000) {
  const st = newWildRef();
  wildZone(st, 'a', { id: 'pa', lv: 10, ci: RK }, true, { x: 0, y: 0, z: 0 }, now);
  wildZone(st, 'b', { id: 'pb', lv: 10, ci: RC }, true, { x: gap * SIEGE_UNITS_PER_M, y: 0, z: 0 }, now);
  return st;
}

test('SHIP-PVP the referee (seaRef.js): a ship is a captain\'s at her helm in the zone, her bar her hull\'s player strength times her toughness (within the law), lowered by her own word, whole again unstruck; a shot lands only between two such captains, never kin, jumping or out of reach, at the word rate, on the shooter\'s own purse; a fire once so often; the wreck the referee\'s and her killer the last captain\'s shot (mutants: each refusal, the bar, the purse, the cap, the mend, the credit, the wreck)', () => {
  assert.deepEqual([...R.SEA_SHIP_HP], HULL_BUILDS.map((b) => b.hullHp), 'the player\'s own builds\'');
  assert.deepEqual([...R.SEA_SAIL_HP], HULL_BUILDS.map((b) => b.sailHp));
  assert.ok(R.SEA_REF.toughMax >= (1 + refitShare('hull', UPGRADE_TIERS)) / (1 - 0.25), 'the hardest a captain can make her');
  assert.ok(R.SEA_REF.helmMs >= 2 * SEA_HELM_SAY_MS && R.SEA_REF.boardM >= SEA_BOARD_NEAR_M, 'the page says within the referee\'s bounds');
  assert.deepEqual([R.seaTough(0.5), R.seaTough(1.5), R.seaTough(9), R.seaTough(NaN)], [1, 1.5, R.SEA_REF.toughMax, 1]);
  let now = 1000;
  const st = seaRoom(50, now);
  assert.equal(R.seaHelm(st, 'c', { id: 'pc', hl: 2 }, now), null);
  assert.equal(st.ships.has('c'), false, 'a fighter not in the zone keeps no ship');
  R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 2, t: 1, u: 11, h: 1 }, now);
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 2, t: 1.5, u: 22, h: 1 }, now);
  const her = st.ships.get('b');
  assert.deepEqual([her.max, her.hp, her.sailMax, her.u], [672 * 1.5, 672 * 1.5, 256 * 1.5, 22]);
  // the purse fills from her helm word, no faster
  const fresh = seaRoom(50, now);
  R.seaHelm(fresh, 'a', { id: 'pa', hl: 2, u: 1 }, now); R.seaHelm(fresh, 'b', { id: 'pb', hl: 2, u: 2 }, now);
  assert.equal(R.seaShot(fresh, 'a', 'b', { d: 100 }, now + 2000).dealt, 2 * R.SEA_REF.rateX * SHIP_REF[2], 'two seconds of her refill');
  assert.equal(R.seaShot(fresh, 'a', 'b', { d: 100 }, now + 2000).dealt, 0, 'and spent');
  // refusals
  assert.equal(R.seaShot(st, 'a', 'b', { d: 50, kin: true }, now).why, 'kin');
  assert.equal(R.seaShot(st, 'a', 'a', { d: 50 }, now).why, 'no-fighter');
  assert.equal(R.seaShot(st, 'a', 'z', { d: 50 }, now).why, 'no-fighter');
  now += 10_000;
  const first = R.seaShot(st, 'a', 'b', { d: 50, s: 20, f: true }, now);
  assert.ok(first.ok, first.why);
  const ref = SHIP_REF[2];
  assert.equal(first.dealt, Math.min(50, 10 * R.SEA_REF.rateX * ref), 'the purse filled from her helm, no faster');
  assert.equal(first.frac, first.dealt / her.max);
  assert.equal(first.sail, 20 / her.sailMax);
  assert.equal(first.fire, true);
  assert.equal(R.seaShot(st, 'a', 'b', { d: 0, s: 0, f: true }, now + 1000).fire, false, 'a fire once in SEA_REF.fireMs');
  assert.equal(R.seaShot(st, 'a', 'b', { d: 0, s: 0, f: true }, now + R.SEA_REF.fireMs).fire, true);
  now += 60_000;
  R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 2, t: 1, u: 11, h: 1 }, now);
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 2, t: 1.5, u: 22, h: 1 }, now);
  const big = R.seaShot(st, 'a', 'b', { d: 1e9, s: 1e9 }, now);
  assert.equal(big.dealt, R.SEA_REF.capX * ref, 'one word no more than its cap');
  assert.equal(big.sail, Math.min(1, R.SEA_REF.sailCapX * ref / her.sailMax));
  // the word rate
  let refused = 0;
  for (let i = 0; i < 20; i++) if (R.seaShot(st, 'a', 'b', { d: 1 }, now).why === 'rate') refused++;
  assert.ok(refused >= 20 - R.SEA_REF.hz, `past the rate: ${refused}`);
  // her own word lowers her bar, never raises it
  now += 1000;
  const was = her.hp;
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 2, t: 1.5, u: 22, h: 1 }, now);
  assert.equal(her.hp, was, 'her word of whole raises nothing');
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 2, t: 1.5, u: 22, h: 0.5 }, now);
  assert.equal(her.hp, Math.min(was, 0.5 * her.max));
  // a new hull or uid carries the share
  const share = her.hp / her.max;
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 4, t: 1, u: 23, h: 1 }, now);
  assert.deepEqual([her.max, her.hp / her.max], [896, share]);
  // whole again unstruck
  now += R.SEA_REF.mendMs;
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 4, t: 1, u: 23, h: 1 }, now);
  assert.equal(her.hp, her.max, 'mended');
  // reach, the jump, the helm's word stale, the shooter's guns
  const far = seaRoom(R.SEA_REF.reachM + R.SEA_REF.slackM + 5, now);
  R.seaHelm(far, 'a', { id: 'pa', hl: 2, u: 1 }, now); R.seaHelm(far, 'b', { id: 'pb', hl: 2, u: 2 }, now);
  assert.equal(R.seaShot(far, 'a', 'b', { d: 5 }, now + 5000).why, 'reach');
  const j = seaRoom(50, now);
  R.seaHelm(j, 'a', { id: 'pa', hl: 2, u: 1 }, now); R.seaHelm(j, 'b', { id: 'pb', hl: 2, u: 2 }, now);
  wildPose(j, 'a', { x: 9e6, y: 0, z: 0 }, now + 100);
  wildPose(j, 'a', { x: 0, y: 0, z: 0 }, now + 200);
  assert.equal(R.seaShot(j, 'a', 'b', { d: 5 }, now + 300).why, 'jump');
  assert.notEqual(R.seaShot(j, 'a', 'b', { d: 5 }, now + 300 + WILD_REF.jumpMs).why, 'jump');
  assert.equal(R.seaShot(j, 'a', 'b', { d: 5 }, now + R.SEA_REF.helmMs + 1).why, 'helm', 'a helm unsaid so long is no ship');
  const row = seaRoom(50, now);
  R.seaHelm(row, 'a', { id: 'pa', hl: 0, u: 1 }, now); R.seaHelm(row, 'b', { id: 'pb', hl: 2, u: 2 }, now);
  assert.equal(R.seaShot(row, 'a', 'b', { d: 5 }, now + 5000).why, 'guns', 'a rowboat has no guns');
  assert.equal(R.seaShot(row, 'b', 'a', { d: 5 }, now + 5000).ok, true, '...and is a target');
  const off = seaRoom(50, now);
  R.seaHelm(off, 'a', { id: 'pa', hl: 2, u: 1 }, now);
  assert.equal(R.seaShot(off, 'a', 'b', { d: 5 }, now + 5000).why, 'ship', 'no ship at her helm');
  wildZone(off, 'b', { id: 'pb' }, false, null, now);
  assert.equal(R.seaShot(off, 'a', 'b', { d: 5 }, now + 5000).why, 'zone');
  off.fighters.get('a').down = true; wildZone(off, 'b', { id: 'pb' }, true, null, now);
  assert.equal(R.seaShot(off, 'a', 'b', { d: 5 }, now + 5000).why, 'down');
});

test('SHIP-PVP the wreck (seaRef.js): her bar at none by a captain\'s shot, or by her own word within the credit of one - that captain her killer, her room, uid and place named; a wreck is shot no more and stays one; her killer alone boards her, in time, alongside her captain or where she lay - her captain gone or forgotten; one unboarded signed at the beat; a full room\'s oldest put out; the wreck read back from storage (mutants: the credit, the wreck, the place, the stay, the board, the step, the eviction, the read)', () => {
  let now = 1000;
  const st = seaRoom(20, now);
  R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now);
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, now);
  let res = null;
  for (let i = 0; i < 400 && !res?.wreck; i++) {
    now += 1000;
    if (i % 5 === 0) { R.seaHelm(st, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now); R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 1, u: 22 }, now); }
    res = R.seaShot(st, 'a', 'b', { d: 40, rid: '0123456789ab', room: SEA_CELL }, now);
  }
  assert.ok(res.wreck, 'wrecked');
  const lay = { ...st.fighters.get('b').pose };
  assert.deepEqual({ ...res.wreck }, { r: '0123456789ab', fallen: 'b', fallenId: 'pb', ci: RC, killer: 'a', killerId: 'pa', kc: RK, u: 22, m: SEA_CELL, x: lay.x, z: lay.z, at: now, boarded: false });
  assert.ok(lay.x > 0, 'where she lay - her captain\'s believed place');
  assert.equal(res.left, 0);
  assert.equal(R.seaShot(st, 'a', 'b', { d: 40 }, now + 1000).why, 'ship', 'a wreck is shot no more');
  R.seaHelm(st, 'b', { id: 'pb', ci: RC, hl: 1, u: 22, h: 1 }, now + 2000);
  assert.equal(st.ships.get('b').wrecked, true, 'and stays one');
  // boarding: her killer alone, alongside, in time
  assert.equal(R.seaBoard(st, 'b', '0123456789ab', now + 3000), null, 'never her captain');
  wildPose(st, 'a', { x: 10_000 * SIEGE_UNITS_PER_M, y: 0, z: 0 }, now + 3000);
  assert.equal(R.seaBoard(st, 'a', '0123456789ab', now + 3000), null, 'never from afar');
  st.fighters.get('a').pose = { x: lay.x + (R.SEA_REF.boardM + R.SEA_REF.slackM - 1) * SIEGE_UNITS_PER_M, y: 0, z: 0 };
  assert.equal(R.seaBoard(st, 'a', '0123456789ab', now + R.SEA_REF.boardMs + 1), null, 'never late');
  // she rows off - alongside where her captain is now, never where she was
  // PIN MOVED (AUDIT SEA VENTURES A6): the boards after the 10 km pose are past its jump - a jumper boards nothing
  st.fighters.get('b').pose = { x: lay.x + 1000 * SIEGE_UNITS_PER_M, y: 0, z: lay.z };
  st.fighters.get('a').pose = { x: lay.x + (1000 + R.SEA_REF.boardM + R.SEA_REF.slackM - 1) * SIEGE_UNITS_PER_M, y: 0, z: lay.z };
  assert.equal(R.seaBoard(st, 'a', '0123456789ab', now + 3000 + WILD_REF.jumpMs - 1), null, 'never in a jump (A6)');
  const past = now + 3000 + WILD_REF.jumpMs;
  st.fighters.get('a').pose = { x: lay.x + (1000 + R.SEA_REF.boardM + R.SEA_REF.slackM + 1) * SIEGE_UNITS_PER_M, y: 0, z: lay.z };
  assert.equal(R.seaBoard(st, 'a', '0123456789ab', past), null, 'out of reach of both');
  st.fighters.get('a').pose = { x: lay.x + (1000 + R.SEA_REF.boardM + R.SEA_REF.slackM - 1) * SIEGE_UNITS_PER_M, y: 0, z: lay.z };
  const w = R.seaBoard(st, 'a', '0123456789ab', past);
  assert.equal(w?.boarded, true, 'alongside her captain');
  assert.equal(st.wrecks.size, 0, 'off the list, to be signed');
  assert.equal(R.seaBoard(st, 'a', '0123456789ab', past), null, 'once');
  // a room that restarted: her captain forgotten, her wreck read back - boarded where she lay
  const back = newWildRef();
  wildZone(back, 'a', { id: 'pa', lv: 10, ci: RK }, true, { x: lay.x + (R.SEA_REF.boardM + R.SEA_REF.slackM + 1) * SIEGE_UNITS_PER_M, y: 0, z: lay.z }, now);
  back.wrecks = new Map([['0123456789ab', R.seaWreckOf({ ...w, boarded: false })]]);
  assert.equal(R.seaBoard(back, 'a', '0123456789ab', now + 5000), null, 'not alongside where she lay');
  back.fighters.get('a').pose = { x: lay.x + (R.SEA_REF.boardM + R.SEA_REF.slackM - 1) * SIEGE_UNITS_PER_M, y: 0, z: lay.z };
  assert.equal(R.seaBoard(back, 'a', '0123456789ab', now + 5000)?.boarded, true, 'alongside where she lay, her captain gone');
  const nowhere = newWildRef();
  wildZone(nowhere, 'a', { id: 'pa', lv: 10, ci: RK }, true, { x: lay.x, y: 0, z: lay.z }, now);
  nowhere.wrecks = new Map([['0123456789ab', R.seaWreckOf({ ...w, boarded: false, x: null, z: null })]]);
  assert.equal(R.seaBoard(nowhere, 'a', '0123456789ab', now + 5000), null, 'a wreck that lay nowhere known, her captain forgotten: never');
  // by her own word within a captain's shot's credit
  now += 1_000_000;
  const s2 = seaRoom(20, now);
  R.seaHelm(s2, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now); R.seaHelm(s2, 'b', { id: 'pb', ci: RC, hl: 2, u: 22 }, now);
  now += 20_000;
  assert.ok(R.seaShot(s2, 'a', 'b', { d: 10 }, now).dealt > 0);
  const late = R.seaHelm(s2, 'b', { id: 'pb', ci: RC, hl: 2, u: 22, h: 0 }, now + R.SEA_REF.creditMs + 1, { rid: 'aaaaaaaaaaaa', room: SEA_CELL });
  assert.equal(late, null, 'the sea\'s guns broke her past the credit: no captain\'s wreck');
  const s3 = seaRoom(20, now);
  R.seaHelm(s3, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now); R.seaHelm(s3, 'b', { id: 'pb', ci: RC, hl: 2, u: 22 }, now);
  now += 20_000;
  R.seaShot(s3, 'a', 'b', { d: 10 }, now);
  const mine = R.seaHelm(s3, 'b', { id: 'pb', ci: RC, hl: 2, u: 22, h: 0 }, now + R.SEA_REF.creditMs, { rid: 'bbbbbbbbbbbb', room: SEA_CELL });
  assert.deepEqual([mine?.wreck?.killer, mine?.wreck?.r, mine?.wreck?.u], ['a', 'bbbbbbbbbbbb', 22], 'within it: the last captain\'s');
  // the beat: unboarded past its time, and forgotten ships
  const aAt = s3.ships.get('a').at, wreckAt = s3.ships.get('b').wreckAt;
  assert.deepEqual(R.seaStep(s3, now + R.SEA_REF.creditMs + R.SEA_REF.boardMs).length, 0);
  assert.deepEqual(R.seaStep(s3, now + R.SEA_REF.creditMs + R.SEA_REF.boardMs + 1).map((x) => [x.r, x.boarded]), [['bbbbbbbbbbbb', false]]);
  // PIN MOVED (AUDIT SEA VENTURES E6A, F1/A1): a quiet ship whose captain stands in the zone is at sea all the same (a
  // hidden tab, a window open); one whose captain has left the zone is off the guns, forgotten when her bar is whole
  const struck = aAt + 9 * R.SEA_REF.helmMs;
  const s4 = { fighters: s3.fighters, ships: new Map([['a', { at: aAt, wrecked: false, struckAt: struck }], ['b', { wrecked: true, wreckAt }]]), wrecks: new Map() };
  R.seaStep(s4, aAt + 10 * R.SEA_REF.helmMs);
  assert.deepEqual([s4.ships.has('a'), s4.ships.get('a').off], [true, undefined], 'a quiet captain in the zone: her ship kept, on the guns');
  s3.fighters.get('a').zone = false;
  R.seaStep(s4, struck + R.SEA_REF.mendMs - 1);
  assert.deepEqual([s4.ships.has('a'), s4.ships.get('a').off], [true, true], 'her captain out of the zone: off the guns, her bar kept');
  R.seaStep(s4, struck + R.SEA_REF.mendMs);
  assert.equal(s4.ships.has('a'), false, 'forgotten when her bar would be whole');
  s3.fighters.get('a').zone = true;
  R.seaStep(s4, wreckAt + R.SEA_REF.wreckMs - 1);
  assert.equal(s4.ships.has('b'), true, 'a wreck stays one her while');
  R.seaStep(s4, wreckAt + R.SEA_REF.wreckMs);
  assert.equal(s4.ships.has('b'), false, 'a wreck past SEA_REF.wreckMs forgotten');
  // a full room's oldest wreck put out for the new
  const full = seaRoom(20, now);
  full.wrecks = new Map(Array.from({ length: R.SEA_REF.wrecksMax }, (_, i) => [`w${i}`, { r: `w${i}` }]));
  R.seaHelm(full, 'a', { id: 'pa', ci: RK, hl: 4, u: 11 }, now); R.seaHelm(full, 'b', { id: 'pb', ci: RC, hl: 2, u: 22 }, now);
  Object.assign(full.ships.get('b'), { hp: 1, struckAt: now });   // struck a moment ago: no mend
  const ev = R.seaShot(full, 'a', 'b', { d: 10, rid: 'cccccccccccc' }, now + 5000);
  assert.deepEqual([ev.wreck?.r, ev.evicted?.r, full.wrecks.size], ['cccccccccccc', 'w0', R.SEA_REF.wrecksMax]);
  // read back, and a captain gone
  const fb = full.fighters.get('b').pose;
  assert.deepEqual(R.seaWreckOf({ ...ev.wreck, junk: 1 }), { r: 'cccccccccccc', fallen: 'b', fallenId: 'pb', ci: RC, killer: 'a', killerId: 'pa', kc: RK, u: 22, m: '', x: fb.x, z: fb.z, at: now + 5000, boarded: false });
  assert.deepEqual([R.seaWreckOf({ ...ev.wreck, x: 'far', z: NaN }).x, R.seaWreckOf({ ...ev.wreck, x: 'far', z: NaN }).z], [null, null], 'a place read back a number, or none');
  assert.equal(R.seaWreckOf({ r: 'x' }), null);
  R.seaGone(full, 'a', now + 5000);
  R.seaGone(full, 'b', now + 5000);
  assert.deepEqual([full.ships.has('a'), full.ships.has('b')], [false, true], 'a wreck stays one when her captain goes');
  assert.equal(R.SEA_WRECK_PREFIX, 'seawreck:');
});

test('SHIP-PVP the wire: a captain\'s helm, shot and boarding projected within their bounds, a shot directed at her captain\'s room and a boarding the wreck\'s room\'s; the referee\'s hull, wreck and signed wreck; the relay that referees them (mutants: the bounds, the kinds, the gate)', () => {
  assert.deepEqual([...SEA_PVP_KINDS], ['helm', 'shot', 'board']);
  assert.equal(SEA_SHOT_MAX, 8000);
  assert.equal(SEA_PVP_RELAY_MIN, 246);   // PIN MOVED: world246 (world241 on its branch, then world242 and world245, renumbered at the merges)
  assert.deepEqual(['world245', 'world246', 'world300', 'x', null].map(relaySupportsSeaPvp), [false, true, true, false, false]);
  assert.deepEqual(validWildData({ k: 'helm', hl: 2, t: 150, u: 7, h: 900, junk: 1 }), { k: 'helm', hl: 2, t: 150, u: 7, h: 900 });
  for (const bad of [{ hl: 5 }, { hl: -2 }, { t: 99 }, { t: 241 }, { u: -1 }, { h: 1001 }, { h: 1.5 }]) assert.equal(validWildData({ k: 'helm', hl: 2, t: 150, u: 7, h: 900, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(validWildData({ k: 'shot', to: 'peer-0002', d: SEA_SHOT_MAX, s: 0, f: 1 }), { to: 'peer-0002', k: 'shot', d: SEA_SHOT_MAX, s: 0, f: 1 });
  for (const bad of [{ d: SEA_SHOT_MAX + 1 }, { s: -1 }, { f: 2 }, { to: '' }]) assert.equal(validWildData({ k: 'shot', to: 'peer-0002', d: 1, s: 1, f: 0, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(validWildData({ k: 'board', to: 'peer-0002', r: '0123456789ab' }), { k: 'board', r: '0123456789ab' }, 'the wreck alone - her captain may be gone');
  assert.equal(validWildData({ k: 'board', r: 'nope' }), null);
  assert.deepEqual(['shot', 'board', 'helm'].map((k) => wildDirected({ k })), [true, false, false]);
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'hull', by: 'peer-0001', to: 'peer-0002', d: 12, s: 3, f: 1, h: 880 }), { k: 'hull', by: 'peer-0001', to: 'peer-0002', d: 12, s: 3, f: 1, h: 880 });
  for (const bad of [{ d: 1001 }, { h: -1 }, { f: 3 }, { by: '' }]) assert.equal(validWildRefOut({ t: 'wref', k: 'hull', by: 'peer-0001', to: 'peer-0002', d: 12, s: 3, f: 1, h: 880, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'wreck', id: 'peer-0002', by: 'peer-0001', r: '0123456789ab' }), { k: 'wreck', id: 'peer-0002', by: 'peer-0001', r: '0123456789ab' });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'wc', r: '0123456789ab', rc: 'n1.x.y' }), { k: 'wc', r: '0123456789ab', rc: 'n1.x.y' });
  assert.equal(validWildRefOut({ t: 'wref', k: 'wc', r: '0123456789ab', rc: 'x'.repeat(513) }), null);
});

test('SHIP-PVP the relay, end to end over the fake room: two captains at their helms in a cell of the open sea - the shots refereed and said to both, her ship wrecked and said to the room, boarded alongside though her captain has gone, the wreck signed and handed to both - hers kept until she is back (mutants: the dispatch, the said, the wreck kept, the board, the sign, the hand)', async () => {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  try {
    const r = fakeRoom(SEA_CELL, { now: () => clock });
    const kp = await keys();
    r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
    const BASE = { x: 7800 * PIXEL_UNITS + 16384, z: (499 + 5000) * PIXEL_UNITS + 16384 };
    const P0 = (x) => ({ x: BASE.x + x * SIEGE_UNITS_PER_M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
    const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P0(x), { lv: 10, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, rc: 1, ci }); await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } })); return ws; };
    const a = await join('peer-0001', -5, RK), b = await join('peer-0002', 5, RC);
    const helm = (ws, hl, u) => r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'helm', hl, t: 100, u, h: 1000 } }));
    await helm(a, 4, 11); await helm(b, 1, 22);
    let hull = null, wreck = null;
    for (let k = 0; k < 600 && !hull; k++) {
      clock += 1000;
      if (k % 5 === 0) { await helm(a, 4, 11); await helm(b, 1, 22); }
      await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0002', d: 40, s: 2, f: 0 } }));
      hull = b.sent.find((m) => m.t === 'wref' && m.k === 'hull') ?? null;
    }
    assert.ok(hull, 'a shot said to her');
    assert.deepEqual([hull.by, hull.to, hull.f], ['peer-0001', 'peer-0002', 0]);
    assert.ok(hull.h < 1000 && hull.d > 0);
    assert.ok(a.sent.some((m) => m.t === 'wref' && m.k === 'hull'), 'and to its shooter');
    assert.equal(a.sent.some((m) => m.t === 'wref' && m.k === 'wreck'), false);
    // her own game reckons her hull at none, a moment after his shot: his wreck
    await r.raw(b, JSON.stringify({ t: 'wild', data: { k: 'helm', hl: 1, t: 100, u: 22, h: 0 } }));
    wreck = a.sent.find((m) => m.t === 'wref' && m.k === 'wreck') ?? null;
    assert.ok(wreck, 'wrecked, said to the room');
    assert.deepEqual([wreck.id, wreck.by], ['peer-0002', 'peer-0001']);
    assert.ok(b.sent.some((m) => m.t === 'wref' && m.k === 'wreck'));
    // her captain closes her tab: her wreck stays, where she lay
    await r.drop(b);
    await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'board', r: 'ffffffffffff' } }));
    assert.equal(a.sent.some((m) => m.t === 'wref' && m.k === 'wc'), false, 'never a wreck that is not his');
    await r.raw(a, JSON.stringify({ t: 'wild', data: { k: 'board', r: wreck.r } }));
    const wc = a.sent.find((m) => m.t === 'wref' && m.k === 'wc');
    assert.ok(wc, 'boarded alongside, her captain gone: signed');
    const b2 = await join('peer-0002', 5, RC);
    assert.ok(b2.sent.some((m) => m.t === 'wref' && m.k === 'wc' && m.rc === wc.rc), 'and handed to her captain, back');
    const v = await verifySeaWreck(wc.rc, kp.publicKey, { subtle, nowS: T + 700 });
    assert.ok(v.ok, v.why);
    assert.deepEqual([v.claims.f, v.claims.c, v.claims.k, v.claims.kc, v.claims.u, v.claims.b, v.claims.m, v.claims.r], ['acct-peer-0002', RC, 'acct-peer-0001', RK, 22, 1, SEA_CELL, wreck.r]);
    // a guildmate's guns land nothing; a shot at oneself is nobody's
    const G = { gi: 'gaaaaaaaaaa', gt: 'SEA', gm: 'm1' };
    const joinG = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P0(x), { lv: 10, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, rc: 1, ci, ...G }); await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } })); return ws; };
    const c = await joinG('peer-0003', -3, 'r00000000000000000d03'), e = await joinG('peer-0004', 3, 'r00000000000000000d04');
    await helm(c, 4, 33); await helm(e, 2, 44);
    clock += 20_000; await helm(c, 4, 33); await helm(e, 2, 44);
    await r.raw(c, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0004', d: 40, s: 2, f: 0 } }));
    assert.equal(e.sent.some((m) => m.t === 'wref' && m.k === 'hull'), false, 'one guild: kin');
    const n = c.sent.length;
    await r.raw(c, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0003', d: 40, s: 2, f: 0 } }));
    assert.equal(c.sent.length, n, 'nor at oneself');
    await helm(a, 4, 11);
    await r.raw(c, JSON.stringify({ t: 'wild', data: { k: 'shot', to: 'peer-0001', d: 40, s: 2, f: 0 } }));
    assert.ok(a.sent.some((m) => m.t === 'wref' && m.k === 'hull' && m.by === 'peer-0003'), 'a stranger of another guild: landed');
  } finally { Date.now = realNow; }
});

test('SHIP-PVP the socket\'s gate (online.js): the open sea\'s kinds go only to a relay that referees them - the socket each word leaves by: my cell\'s, a halo\'s its own, carried across a crossing (mutants: the gate, the halo, the crossing)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, rand: () => 0, now: () => 1e6 });
  const STILL = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:10,10', STILL); const A = sockets[0]; await A.onopen(); A.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: `world${SEA_PVP_RELAY_MIN}` });
  s.setHalo(['world:11,10']); const B = sockets[1]; await B.onopen(); B.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: `world${SEA_PVP_RELAY_MIN - 1}` });
  const said = (ws) => ws.sent.filter((x) => x.startsWith('{"t":"wild"')).map((x) => JSON.parse(x).data.k);
  const helm = { k: 'helm', hl: 2, t: 100, u: 5, h: 1000 }, board = { k: 'board', r: 'aaaaaaaaaaaa' };
  assert.deepEqual([s.seaPvpOk, s._halo.get('world:11,10').seaPvpOk, s._halo.get('world:11,10').wildOk], [true, false, true], 'the halo says for itself');
  assert.equal(s.sendWild(helm), true);
  assert.equal(s.sendWild(board, { room: 'world:11,10' }), false, 'never to a relay that does not referee them - it closes the socket');
  assert.equal(s.sendWild(board, { room: 'world:10,10' }), true);
  assert.deepEqual([said(A), said(B)], [['helm', 'board'], []]);
  s.join('world:11,10', STILL);
  assert.equal(s._ws, B, 'B promoted');
  assert.deepEqual([s.seaPvpOk, s._halo.get('world:10,10').seaPvpOk], [false, true], 'each word carried across the crossing');
  assert.equal(s.sendWild(helm), false, 'my cell\'s relay now does not');
  assert.equal(s.sendWild(board, { room: 'world:10,10' }), true, 'the halo\'s does');
  assert.deepEqual([said(A), said(B)], [['helm', 'board', 'board'], []]);
});

/** The service, two realm characters - kim's ship a hold of swords, hal her hunter - and the gate's key. */
async function harbour() {
  const svc = await standService();
  const who = {}, R2 = {};
  const hold = () => [sword(2), sword(2), sword(2), sword(1), sword(0), createWeapon(116, 1, seeded(9)), createWeapon(114, 1, seeded(9)), createWeapon(113, 0, seeded(9)), sword(4, { locked: true })];
  for (const n of ['kim', 'hal', 'val']) {
    who[n] = await svc.registered(n);
    R2[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000, modData: { 'come-sail-away': { placedBoats: [{ UID: 77, Hull: 2, Items: hold() }] } } });
  }
  const nowS = () => Math.floor(Date.now() / 1000);
  let n = 0;
  const wreck = (victim, killer, o = {}) => mintSeaWreck({ f: who[victim].id, c: R2[victim].id, k: who[killer].id, kc: R2[killer].id, r: `${(++n).toString(16).padStart(12, '0')}`, u: 77, b: 1, m: SEA_CELL, ...o }, svc.gatePriv, { subtle, nowS: nowS() });
  const bring = (nm, rc, realm = true) => svc.call('/v1/sea/wreck', { receipt: rc, ...(realm ? { realm: realm === true ? R2[nm].at() : realm } : {}) }, who[nm].secret);
  const collect = (nm) => svc.call('/v1/sea/prize/collect', { character: R2[nm].id, realm: R2[nm].at() }, who[nm].secret);
  const reclaim = (nm) => svc.call('/v1/sea/prize/reclaim', { character: R2[nm].id, realm: R2[nm].at() }, who[nm].secret);
  const holdOf = (nm) => P.seaHoldOf(recordOf(svc.env, R2[nm].id), 77);
  const rows = (sql, ...a) => svc.env.DB._raw.prepare(sql).all(...a).map((x) => ({ ...x }));
  return { svc, who, R: R2, wreck, bring, collect, reclaim, holdOf, rows };
}

test('SHIP-PVP the service, end to end over its routes and real records: her captain brings the wreck - boarded, her hold\'s share held for her killer and her game told the pieces by their marks; once a wreck - its pieces told again only to her tab from before the take; her killer\'s carry waits her grace; the killer collects into its record, once; unboarded no prize; a held record gives none, nor keeps a record unmade; a wreck is a kill at sea for the bounty board (mutants: the receipt, the once, the again, the grace, the prize, the hold, the collect, the kill)', async () => {
  const h = await harbour();
  const rc = await h.wreck('kim', 'hal');
  assert.equal((await h.bring('val', rc)).body.error, 'not-yours');
  assert.equal((await h.bring('val', rc, false)).body.error, 'not-yours', 'nor without a record');
  assert.equal((await h.bring('hal', rc, false)).body.error, 'grace', 'her killer waits her grace');
  assert.equal((await h.bring('kim', rc, false)).body.error, 'no-realm-character', 'her own tab names its record');
  const at0 = h.R.kim.at();
  const first = await h.bring('kim', rc);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const marks = (took) => took.map((x) => [x.g, x.t, x.m, x.n, x.u, x.p, x.f]);
  assert.deepEqual([first.body.b, marks(first.body.took), first.body.n], [1, [['Weapons', 120, 2, 1, null, null, 'hold'], ['Weapons', 120, 0, 1, null, null, 'hold'], ['Weapons', 113, 0, 1, null, null, 'hold']], 3], 'her best and what stays within a third - never the locked sword - by their marks');
  assert.equal(first.body.realm?.seq, at0.seq + 1, 'where her record stands now');
  assert.deepEqual(h.holdOf('kim').map(itemWorth), [180, 180, 90, 30, 18, 720], 'off her record');
  assert.deepEqual(h.rows('SELECT i, killer_char, state FROM sea_prizes ORDER BY i'), [0, 1, 2].map((i) => ({ i, killer_char: h.R.hal.id, state: 'held' })));
  assert.deepEqual(h.rows('SELECT seq FROM sea_wrecks'), [{ seq: at0.seq + 1 }], 'her record\'s sequence once they were taken');
  const again = await h.bring('kim', rc, at0);
  assert.deepEqual([again.body.again, again.body.took, again.body.n, again.body.realm?.seq], [true, first.body.took, 3, first.body.realm.seq], 'once a wreck: her tab from before the take (its first answer lost) told its pieces, where her record stands');
  assert.equal(h.holdOf('kim').length, 6, 'nothing taken twice');
  const since = await h.bring('kim', rc);
  assert.deepEqual([since.body.again, since.body.took, since.body.n, since.body.realm], [true, [], 3, undefined], 'her tab at the record since: its game holds none of them - told none to take');
  // a wreck is a kill at sea: hal wanted, the bounty board's
  assert.deepEqual(h.rows('SELECT killer_char, victim_char FROM sea_kills'), [{ killer_char: h.R.hal.id, victim_char: h.R.kim.id }]);
  assert.deepEqual((await h.svc.call('/v1/sea/bounty/board', { character: h.R.hal.id }, h.who.hal.secret)).body.prizes, 3, 'held for hal');
  // held for the character that boarded her alone - never another of its account's
  const hal2 = await seatRealm(h.svc.env, h.who.hal.secret, 'hal2', { name: 'hal2', level: 5, items: [], goldPieces: 5000 });
  assert.deepEqual((await h.svc.call('/v1/sea/prize/collect', { character: hal2.id, realm: hal2.at() }, h.who.hal.secret)).body, { ok: true, items: [] });
  await realmJoinAt(h.svc.env, h.who.hal.secret, h.R.hal.id);
  // hal collects, once
  const c1 = await h.collect('hal');
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  assert.deepEqual(c1.body.items.map(itemWorth), [180, 45, 3]);
  assert.deepEqual(recordOf(h.svc.env, h.R.hal.id).items.map(itemWorth), [180, 45, 3], 'into hal\'s record');
  assert.deepEqual((await h.collect('hal')).body, { ok: true, items: [] }, 'collected once');
  assert.deepEqual(h.rows('SELECT DISTINCT state, to_char FROM sea_prizes'), [{ state: 'collected', to_char: h.R.hal.id }]);
  assert.deepEqual((await h.collect('kim')).body, { ok: true, items: [] }, 'nothing held for her');
  // unboarded: a kill at sea, no prize
  const ub = await h.bring('val', await h.wreck('val', 'hal', { b: 0 }));
  assert.deepEqual([ub.body.b, ub.body.took, ub.body.n, ub.body.realm], [0, [], 0, undefined]);
  assert.equal(h.holdOf('val').length, 9, 'her hold whole');
  assert.deepEqual(h.rows('SELECT seq FROM sea_wrecks WHERE victim_char = ?', h.R.val.id), [{ seq: null }]);
  assert.equal(h.rows('SELECT r FROM sea_kills').length, 2);
  // a held record gives no prize
  h.svc.env.DB._raw.prepare('UPDATE realm_characters SET held = ?1 WHERE id = ?2').run('law', h.R.val.id);
  const held = await h.bring('val', await h.wreck('val', 'kim'));
  assert.deepEqual([held.body.took, held.body.n], [[], 0]);
  assert.equal(h.holdOf('val').length, 9);
  // a boarded hold with nothing to give: the record's move never made, and no object of it kept
  const objs = () => h.svc.env.SAVES._map.size;
  h.svc.env.DB._raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?1').run(h.R.val.id);
  const seqBefore = h.R.val.at().seq, nObj = objs();
  const bare = await h.bring('val', await h.wreck('val', 'kim', { u: 4242 }));
  assert.deepEqual([bare.body.b, bare.body.took, bare.body.n, bare.body.realm], [1, [], 0, undefined]);
  assert.deepEqual([h.R.val.at().seq, objs()], [seqBefore, nObj], 'nothing moved, nothing left behind');
  assert.equal(REFUSALS['sea-prize-realm'], 'Only an online character of the realm can take a prize from a wreck.');
});

test('SHIP-PVP the service\'s other ways: her killer carries the wreck past her grace and the record is seized; her captain reclaims what her killer left past the hold; a forged or foreign receipt refused (mutants: the seize, the reclaim\'s time, the receipt)', async () => {
  const realNow = Date.now;
  const h = await harbour();
  const rc = await h.wreck('kim', 'hal');
  Date.now = () => realNow() + (SEA_WRECK_GRACE_S + 1) * 1000;
  try {
    const stale = h.R.kim.at();
    const seized = await h.bring('hal', rc, false);
    assert.equal(seized.status, 200, JSON.stringify(seized.body));
    assert.deepEqual([seized.body.took.length, seized.body.realm], [3, undefined], 'taken by her killer, her record seized');
    assert.equal(h.holdOf('kim').length, 6);
    // her tab, its socket back but the page never reloaded: its game still holds them - told them, and nowhere its record stands
    const late = await h.bring('kim', rc, stale);
    assert.deepEqual([late.body.again, late.body.took, late.body.realm], [true, seized.body.took, undefined]);
    const [v, body, sig] = rc.split('.');   // the signature's FIRST character - every bit of it the signature's (its last carries padding)
    assert.equal((await h.svc.call('/v1/sea/wreck', { receipt: `${v}.${body}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}` }, h.who.hal.secret)).body.error, 'receipt');
    // she reclaims what hal never collected, once its hold has passed - her lease cleared by the seize, she joins again
    await realmJoinAt(h.svc.env, h.who.kim.secret, h.R.kim.id);
    assert.deepEqual((await h.bring('kim', rc)).body.took, [], 'joined since: her game holds none of them');
    assert.deepEqual((await h.reclaim('kim')).body, { ok: true, items: [] }, 'not before its hold');
    Date.now = () => realNow() + (SEA_WRECK_GRACE_S + 1 + P.SEA_PRIZE_HOLD_S + 60) * 1000;   // the hold, from the seize
    assert.deepEqual((await h.collect('hal')).body, { ok: true, items: [] }, 'her killer\'s time is out');
    const back = await h.reclaim('kim');
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.deepEqual(back.body.items.map(itemWorth), [180, 45, 3]);
    assert.deepEqual(recordOf(h.svc.env, h.R.kim.id).items.map(itemWorth), [180, 45, 3], 'back in her record');
    assert.deepEqual(h.rows('SELECT DISTINCT state, to_char FROM sea_prizes'), [{ state: 'returned', to_char: h.R.kim.id }]);
  } finally { Date.now = realNow; }
});

test('SHIP-PVP the ledger\'s word on her hold: a piece it keeps back (a copy of it known) is never a prize, nor swells the share; a prize taken goes into the service\'s hands - held in escrow by the ledger, never let go (mutants: the barred, the escrow)', async () => {
  const svc = await standService();
  const rare = (uid) => ({ ...applyRarity(createWeapon(120, 2, seeded(9)), 'rare', seeded(11)), uid });
  const who = {}, R2 = {};
  for (const n of ['kim', 'hal']) {
    who[n] = await svc.registered(n);
    R2[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000, modData: { 'come-sail-away': { placedBoats: [{ UID: 77, Hull: 2, Items: [rare('00000000000000a1'), rare('00000000000000a2'), sword(1)] }] } } });
  }
  // her record judged, its pieces in the ledger as hers
  const at = R2.kim.at();
  const put = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R2.kim.id}/data`, { method: 'PUT', headers: { authorization: `Bearer ${who.kim.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(recordOf(svc.env, R2.kim.id)) }), svc.env);
  assert.equal(put.status, 200);
  const ledger = () => svc.env.DB._raw.prepare('SELECT uid, char_id, state FROM item_uids ORDER BY uid').all().map((x) => ({ ...x }));
  assert.deepEqual(ledger(), [{ uid: '00000000000000a1', char_id: R2.kim.id, state: 'held' }, { uid: '00000000000000a2', char_id: R2.kim.id, state: 'held' }]);
  svc.env.DB._raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, ?)').run('00000000000000a1', R2.kim.id, 1);
  const rc = await mintSeaWreck({ f: who.kim.id, c: R2.kim.id, k: who.hal.id, kc: R2.hal.id, r: '0000000000b1', u: 77, b: 1, m: SEA_CELL }, svc.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = await svc.call('/v1/sea/wreck', { receipt: rc, realm: R2.kim.at() }, who.kim.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.took.map((x) => x.u), ['00000000000000a2'], 'the copy kept back - her other rare sword the prize, by its id');
  assert.deepEqual(ledger().find((x) => x.uid === '00000000000000a2'), { uid: '00000000000000a2', char_id: '', state: 'escrow' }, 'in the service\'s hands');
});

/** The page's guns over a fake naval host and socket. */
function guns({ live = true, stranger = true, helm = { hl: 2, u: 22, t: 1.25, h: 0.9, wrecked: false, pos: [0, 0, 0] } } = {}) {
  const st = { live, now: 100_000, sent: [], to: [], struck: [], wrecked: 0, said: [], mids: [], receipts: [], helm, peer: [100, 0, 0], stranger };
  const naval = { pvp: { helm: () => st.helm, struck: (w) => st.struck.push(w), wreck: () => { st.wrecked++; }, peerAt: () => st.peer } };
  const b = createSeaBroadsides({
    live: () => st.live, naval: () => naval, send: (d, o) => { st.sent.push(d); st.to.push(o?.room ?? null); return true; }, me: () => 'peer-me', stranger: () => st.stranger, name: (id) => (id === 'peer-her' ? 'Hera' : ''),
    receipt: (rc) => st.receipts.push(rc), say: (x) => st.said.push(x), mid: (x) => st.mids.push(x), now: () => st.now,
  });
  return { b, st };
}

test('SHIP-PVP the page\'s guns (seaBroadsides.js): my balls meet a stranger captain\'s ship where the open sea is open and my ship is no wreck, a peer\'s seen to meet another\'s; my shots gathered and said each SEA_SHOT_MS; my helm said on change and each SEA_HELM_SAY_MS, and left when I go; the referee\'s words laid on my ship and said; a wreck of mine boarded alongside, where I last saw her or where she lay, to the room that wrecked her, said again until answered; a signed wreck carried (mutants: the open, the gather, the helm, the hull, the wreck, the board, the place, the room, the carry)', () => {
  assert.deepEqual([SEA_SHOT_MS, SEA_HELM_SAY_MS, SEA_HELM_MIN_MS, SEA_BOARD_NEAR_M, SEA_BOARD_RETRY_MS, SEA_SAID_MS], [250, 5000, 500, 30, 2000, 60_000]);
  assert.ok(2 * 1000 / SEA_SHOT_MS <= R.SEA_REF.hz, 'two ships under my guns within the referee\'s word rate');
  const { b, st } = guns();
  assert.equal(b.open('peer-her', 'me:1', true), false, 'not stepped: not open');
  b.step();
  assert.deepEqual(st.sent, [{ k: 'helm', hl: 2, t: 125, u: 22, h: 900 }], 'my helm said');
  assert.equal(b.open('peer-her', 'me:1', true), true);
  assert.equal(b.open('peer-her', 'peer:x', false), true, 'a peer\'s ball seen on another\'s ship');
  assert.equal(b.open('peer-her', 'peer:peer-her', false), false, 'never her own');
  assert.equal(b.open('peer-her', 'ship:3', false), false);
  st.stranger = false;
  assert.equal(b.open('peer-her', 'me:1', true), false, 'never my party\'s or guild\'s');
  st.stranger = true;
  // shots gathered
  b.shot('peer-her', { hull: 5, sail: 0, fire: 'hull' });
  b.shot('peer-her', { hull: 10.4, sail: 2, crew: 1 });
  st.now += SEA_SHOT_MS; b.step();
  assert.deepEqual(st.sent.at(-1), { k: 'shot', to: 'peer-her', d: 15, s: 2, f: 1 }, 'gathered - a fire among them kept');
  b.step();
  st.now += SEA_SHOT_MS; b.step();
  assert.equal(st.sent.filter((d) => d.k === 'shot').length, 1, 'said once');
  st.now -= SEA_SHOT_MS;
  // the helm: unchanged each SEA_HELM_SAY_MS, changed no sooner than SEA_HELM_MIN_MS
  const helms = () => st.sent.filter((d) => d.k === 'helm').length;
  st.now += SEA_HELM_SAY_MS - SEA_SHOT_MS - 1; b.step();
  assert.equal(helms(), 1);
  st.now += 1; b.step();
  assert.equal(helms(), 2, 'kept said');
  st.helm = { ...st.helm, h: 0.5 };
  st.now += SEA_HELM_MIN_MS - 1; b.step();
  assert.equal(helms(), 2);
  st.now += 1; b.step();
  assert.deepEqual(st.sent.at(-1), { k: 'helm', hl: 2, t: 125, u: 22, h: 500 });
  // the referee's words
  b.hear({ k: 'hull', by: 'peer-her', to: 'peer-me', d: 120, s: 30, f: 1, h: 400 });
  assert.deepEqual(st.struck, [{ frac: 0.12, sail: 0.03, fire: true, left: 0.4 }]);
  assert.deepEqual(st.said, ['Hera\'s guns are on you!']);
  b.hear({ k: 'hull', by: 'peer-her', to: 'peer-me', d: 1, s: 0, f: 0, h: 390 });
  assert.equal(st.said.length, 1, 'said once a minute');
  b.hear({ k: 'hull', by: 'peer-me', to: 'peer-her', d: 1, s: 0, f: 0, h: 390 });
  assert.deepEqual(st.said.at(-1), 'Your broadside strikes Hera\'s ship.');
  assert.equal(st.struck.length, 2, 'my own shot laid on no ship of mine');
  b.hear({ k: 'wreck', id: 'peer-me', by: 'peer-her', r: '0123456789ab' });
  assert.deepEqual([st.wrecked, st.mids.at(-1)], [1, 'Your ship is wrecked by Hera\'s guns! She lies crippled.']);
  // a wreck of mine: boarded when alongside
  b.hear({ k: 'wreck', id: 'peer-her', by: 'peer-me', r: 'aaaaaaaaaaaa' }, 'cell-7800');
  assert.equal(st.mids.at(-1), 'Hera\'s ship is wrecked! Come alongside and board her for her hold.');
  st.now += 10; b.step();
  assert.equal(st.sent.filter((d) => d.k === 'board').length, 0, 'not alongside');
  st.peer = [SEA_BOARD_NEAR_M, 0, 0];
  b.step();
  const boards = () => st.sent.map((d, i) => [d, st.to[i]]).filter(([d]) => d.k === 'board');
  assert.deepEqual(boards(), [[{ k: 'board', r: 'aaaaaaaaaaaa' }, 'cell-7800']], 'to the room that wrecked her');
  assert.equal(st.mids.at(-1), 'You come alongside Hera\'s wreck and board her. Her hold is open to you.');
  st.now += SEA_BOARD_RETRY_MS - 1; b.step();
  assert.equal(st.sent.filter((d) => d.k === 'board').length, 1);
  st.now += 1; b.step();
  assert.equal(st.sent.filter((d) => d.k === 'board').length, 2, 'said again until answered');
  b.hear({ k: 'wc', r: 'aaaaaaaaaaaa', rc: 'n1.a.b' });
  assert.deepEqual(st.receipts, ['n1.a.b'], 'the signed wreck carried');
  st.now += SEA_BOARD_RETRY_MS; b.step();
  assert.equal(st.sent.filter((d) => d.k === 'board').length, 2, 'answered: no more');
  // her captain gone: where I last saw her - and where she lay
  const gone = guns();
  gone.b.step();
  gone.st.peer = [500, 0, 0];
  gone.b.hear({ k: 'wreck', id: 'peer-her', by: 'peer-me', r: 'bbbbbbbbbbbb' }, null);
  gone.st.peer = [80, 0, 0];
  gone.b.step();
  gone.st.peer = null;
  gone.st.now += 10; gone.b.step();
  assert.equal(gone.st.sent.some((d) => d.k === 'board'), false);
  gone.st.helm = { ...gone.st.helm, pos: [80 - SEA_BOARD_NEAR_M, 0, 0] };
  gone.b.step();
  assert.deepEqual(gone.st.sent.filter((d) => d.k === 'board'), [{ k: 'board', r: 'bbbbbbbbbbbb' }], 'where I last saw her');
  const lay = guns();
  lay.b.step();
  lay.b.hear({ k: 'wreck', id: 'peer-her', by: 'peer-me', r: 'cccccccccccc' });
  lay.st.peer[0] = 5000;   // her shown place moves - the array itself: where she lay was copied
  lay.st.helm = { ...lay.st.helm, pos: [100 + SEA_BOARD_NEAR_M, 0, 0] };
  lay.st.now += 10; lay.b.step();
  assert.deepEqual(lay.st.sent.filter((d) => d.k === 'board'), [{ k: 'board', r: 'cccccccccccc' }], 'where she lay, she rowed off');
  const far = guns();
  far.b.step();
  far.b.hear({ k: 'wreck', id: 'peer-her', by: 'peer-me', r: 'dddddddddddd' });
  far.st.peer = [5000, 0, 0];
  far.st.helm = { ...far.st.helm, pos: [100 + SEA_BOARD_NEAR_M + 1, 0, 0] };
  far.st.now += 10; far.b.step();
  assert.equal(far.st.sent.some((d) => d.k === 'board'), false, 'near neither: never');
  // left: the helm said off once
  st.live = false; b.step();
  assert.deepEqual(st.sent.at(-1), { k: 'helm', hl: -1, t: 100, u: 0, h: 0 });
  const n = st.sent.length;
  b.shot('peer-her', { hull: 9 });
  b.step(); st.now += SEA_HELM_SAY_MS; b.step();
  assert.equal(st.sent.length, n, 'nothing more while closed');
  assert.equal(b.open('peer-her', 'me:1', true), false);
  // a wrecked ship of mine opens no guns
  // PIN MOVED (AUDIT SEA VENTURES E6B): and is said at her helm at none - never left, so the referee's credit to the captain
  // whose shot broke her comes
  const w = guns({ helm: { hl: 2, u: 22, t: 1, h: 0.4, wrecked: true, pos: [0, 0, 0] } });
  w.b.step();
  assert.equal(w.b.open('peer-her', 'me:1', true), false);
  assert.deepEqual(w.st.sent, [{ k: 'helm', hl: 2, t: 100, u: 22, h: 0 }], 'a wreck says her helm at none');
});

test('SHIP-PVP the naval host\'s seams (navalPvp.js): my ship as the referee is told of her - her hull, uid, toughness over the Captain\'s Due and share; the referee\'s word laid in shares, her hull no higher than its bar; her wreck; a prize out of her hold by each piece\'s marks, never its place nor another list\'s; the guns asked through it (mutants: the toughness, the shares, the bar, the wreck, the take)', () => {
  const dmg = createShipDamage({ hullHp: 600, sailHp: 200, crew: 10, player: true });
  const piece = (name, o) => ({ name, group: 'Weapons', templateIndex: 120, material: 0, stackCount: 1, ...o });
  const boat = { uid: 22, hull: 2, Cargo: { Items: [piece('a', { uid: 'u1' }), piece('b', { material: 2 }), piece('c', { provenance: 'craft-1' }), piece('d', { material: 2 })] } };
  let shook = 0;
  let due = { hull: 1 };
  const pvp = createNavalPvp({ enabled: () => true, boat: () => boat, stateOf: () => ({ damage: dmg }), build: () => ({ hullHp: Math.round(HULL_BUILDS[2].hullHp * 1.3) }), pose: () => ({ position: [1, 2, 3] }), boats: () => [boat], peers: () => [{ id: 'p1', pos: [9, 0, 9] }], clock: () => 5, shake: () => { shook++; }, due: () => due });
  const h = pvp.helm();
  assert.deepEqual([h.hl, h.u, Math.round(h.t * 100) / 100, h.h, h.wrecked, h.pos], [2, 22, 1.3, 1, false, [1, 2, 3]]);
  due = { hull: 0.8 };
  assert.equal(pvp.helm().t, Math.round(HULL_BUILDS[2].hullHp * 1.3) / HULL_BUILDS[2].hullHp / 0.8, 'over the Captain\'s Due\'s share taken');
  pvp.struck({ frac: 0.1, sail: 0.25, fire: false, left: 0.95 });
  assert.deepEqual([dmg.hull, dmg.sail, shook, PVP_STRUCK_SHAKE], [540, 150, 1, 1.6], 'her bar\'s share - and no higher than its bar leaves her');
  pvp.struck({ frac: 0.01, sail: 0, left: 0.5 });
  assert.equal(dmg.hull, 300, 'the bar\'s word the lower');
  pvp.wreck();
  assert.equal(dmg.state, SHIP_STATES.wrecked);
  const whole = createShipDamage({ hullHp: 600, sailHp: 200, crew: 10, player: true });
  createNavalPvp({ enabled: () => true, boat: () => boat, stateOf: () => ({ damage: whole }), clock: () => 5 }).wreck();
  assert.equal(whole.state, SHIP_STATES.wrecked, 'from whole, at once');
  assert.equal(pvp.helm().wrecked, true);
  const tookOf = (it) => P.seaPrizeTook([it])[0];
  playerEntity.items ??= [];
  const bag = playerEntity.items.length;
  playerEntity.items.push(piece('mine', { uid: 'u9' }));
  assert.deepEqual(pvp.takeHold(22, [tookOf(piece('x', { material: 2 })), tookOf(piece('x', { provenance: 'craft-1' })), { ...tookOf(piece('x', { uid: 'u9' })), f: 'bag' }, tookOf(piece('x', { uid: 'gone' })), 7]).map((it) => it.name), ['b', 'c'], 'by its marks - the first of a kind, a craft by its provenance; never a piece of my bag, nor one not there');
  assert.deepEqual(boat.Cargo.Items.map((it) => it.name), ['a', 'd']);
  assert.equal(playerEntity.items.length, bag + 1, 'my bag untouched');
  playerEntity.items.length = bag;
  assert.deepEqual(pvp.takeHold(22, [tookOf(piece('x', { uid: 'u1' }))]).map((it) => it.name), ['a'], 'by its id');
  assert.deepEqual(pvp.takeHold(5, [tookOf(piece('x', { material: 2 }))]), []);
  assert.deepEqual(pvp.peerAt('p1'), [9, 0, 9]);
  assert.equal(pvp.peerAt('p2'), null);
  assert.equal(pvp.open('p1', 'me:1', true), false, 'no guns attached: never');
  const asked = [];
  pvp.attach({ open: (...a) => { asked.push(a); return true; }, shot: (...a) => asked.push(a) });
  assert.equal(pvp.open('p1', 'me:1', true), true);
  pvp.shot('p1', { hull: 3 });
  assert.deepEqual(asked, [['p1', 'me:1', true], ['p1', { hull: 3 }]]);
  const off = createNavalPvp({ enabled: () => false, boat: () => boat, stateOf: () => ({ damage: dmg }), build: () => ({ hullHp: 1 }), pose: () => ({ position: [0, 0, 0] }) });
  assert.equal(off.helm(), null, 'the sea fight not running');
  const nouid = createNavalPvp({ enabled: () => true, boat: () => ({ uid: 0, hull: 2 }), stateOf: () => ({ damage: dmg }), build: () => ({ hullHp: 1 }), pose: () => ({ position: [0, 0, 0] }) });
  assert.equal(nouid.helm(), null, 'no uid the referee can sign');
});

test('SHIP-PVP the wreck\'s service half (seaWreckHost.js) and its door: her captain carries a signed wreck at her next frame - the pieces taken out of her hold and said (her record already without them: said all the same); her killer asks a moment on and collects - into the pack, said; unboarded, carried all the same and said; the door\'s routes (mutants: the captain, the killer, the slack, the collect, the words, the routes)', async () => {
  assert.deepEqual([SEA_WRECK_SLACK_S, SEA_WRECK_RETRY_MS, SEA_WRECK_CAPTAIN_RETRY_MS, SEA_WRECK_KEPT_MAX, SEA_WRECK_GRACE_S], [5, 15_000, 2_000, 16, 300]);
  const kp = await keys();
  const mint = (o = {}) => mintSeaWreck({ f: 'acct-kim', c: RC, k: 'acct-hal', kc: RK, r: '0123456789ab', u: 77, b: 1, m: SEA_CELL, ...o }, kp.privateKey, { subtle, nowS: T });
  const host = (me, answers = {}) => {
    const st = { asked: [], said: [], took: [], now: 1_000_000 };
    const door = {
      wreck: async (req) => { st.asked.push(['wreck', req]); return answers.wreck ?? { ok: true, data: { r: '0123456789ab', b: 1, took: TOOK, n: 2, realm: { seq: 4 } } }; },
      collect: async (req) => { st.asked.push(['collect', req]); return { ok: true, data: { ok: true, items: [{ name: 'Longsword' }, { name: 'Dagger' }], realm: { seq: 5 } } }; },
    };
    const session = { transact: (fn) => fn({ id: me === 'acct-kim' ? RC : RK, lease: 'lease', seq: 3 }) };
    const naval = { pvp: { takeHold: (uid, took) => { st.took.push([uid, took]); return took.map((x) => `piece-${x.u}`); } } };
    const kept = new Map();
    const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
    const w = createSeaWreckHost({ session, checkpoint: () => {}, character: () => RK, me: () => me, naval: () => naval, door, storage, say: (x) => st.said.push(x), now: () => st.now });
    return { w, st, storage };
  };
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
  const TOOK = [{ g: 'Weapons', t: 120, m: 2, u: 'u1', p: null, n: 1, f: 'hold' }, { g: 'Weapons', t: 113, m: 0, u: 'u2', p: null, n: 1, f: 'hold' }];
  // her captain
  const cap = host('acct-kim');
  cap.w.receipt(await mint());
  await settle();
  assert.equal(cap.st.asked.length, 0, 'kept for the frame');
  cap.w.frame(); await settle();
  assert.deepEqual(cap.st.asked[0][1].realm, { id: RC, lease: 'lease', seq: 3 });
  assert.match(cap.st.asked[0][1].receipt, /^n1\./);
  assert.deepEqual(cap.st.took, [[77, TOOK]]);
  assert.deepEqual(cap.st.said, ['Your wreck was boarded and her hold plundered: 2 pieces taken.']);
  cap.w.receipt(await mint());
  cap.w.frame(); await settle();
  assert.equal(cap.st.asked.length, 1, 'carried once');
  const spared = host('acct-kim', { wreck: { ok: true, data: { r: '0123456789ab', b: 1, took: [], n: 0 } } });
  spared.w.receipt(await mint());
  spared.w.frame(); await settle();
  assert.deepEqual(spared.st.said, ['Your wreck was boarded, but nothing in her hold was worth the taking.']);
  const since = host('acct-kim', { wreck: { ok: true, data: { r: '0123456789ab', b: 1, took: [], n: 2, again: true } } });
  since.w.receipt(await mint());
  since.w.frame(); await settle();
  assert.deepEqual([since.st.took, since.st.said], [[], ['Your wreck was boarded and her hold plundered: 2 pieces taken.']], 'her record already without them: nothing taken, all the same said');
  // her killer
  const before = (playerEntity.items ??= []).length;
  const kil = host('acct-hal');
  kil.w.receipt(await mint());
  kil.w.frame(); await settle();
  assert.equal(kil.st.asked.length, 0, 'her own carry first');
  kil.st.now += SEA_WRECK_SLACK_S * 1000;
  kil.w.frame(); await settle();
  assert.deepEqual(kil.st.asked.map(([k, req]) => [k, req.realm ?? null]), [['wreck', null], ['collect', { id: RK, lease: 'lease', seq: 3 }]], 'carried without my record, then collected into it');
  assert.equal(kil.st.asked[1][1].character, RK);
  assert.deepEqual(playerEntity.items.slice(before).map((it) => it.name), ['Longsword', 'Dagger'], 'into my pack');
  assert.deepEqual(kil.st.said, ['Plunder from a wreck\'s hold is in your pack: 2 pieces.']);
  playerEntity.items.length = before;
  const ub = host('acct-hal');
  ub.w.receipt(await mint({ b: 0 }));
  ub.st.now += SEA_WRECK_SLACK_S * 1000;
  ub.w.frame(); await settle();
  assert.deepEqual([ub.st.said, ub.st.asked.map(([k]) => k)], [['You did not board her in time. Her hold stays her captain\'s.'], ['wreck']], 'unboarded, carried all the same - a kill at sea - and nothing collected');
  const stranger = host('acct-val');
  stranger.w.receipt(await mint());
  stranger.st.now += SEA_WRECK_SLACK_S * 1000;
  stranger.w.frame(); await settle();
  assert.equal(stranger.st.asked.length, 0, 'no wreck of mine');
  // the door
  const sent = [];
  const fetch = async (url, init) => { sent.push([new URL(url).pathname, JSON.parse(init.body)]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  const d = accountSeaWreck({ fetch, storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 'sek' }) : null) } });
  await d.wreck({ receipt: 'n1.x.y' }); await d.collect({ character: RK }); await d.reclaim({ character: RC });
  assert.deepEqual(sent.map((x) => x[0]), ['/v1/sea/wreck', '/v1/sea/prize/collect', '/v1/sea/prize/reclaim']);
});

test('SHIP-PVP the board\'s prize rows (navalYardWindow.js wantedText): a wreck\'s prizes held for me with Collect, my hold\'s goods due back with Reclaim, greyed while an answer is awaited, none without; the window\'s presses (mutants: the rows, the presses)', () => {
  const w = { rows: [], owed: 0, mine: 0, prizes: 3, back: 1, posts: [500], busy: false, line: null };
  const t = wantedText(w);
  assert.deepEqual(t.prizes, { title: 'Prizes taken at sea', words: '3 pieces from wrecks you boarded, held for you.', press: 'Collect', can: true });
  assert.deepEqual(t.back, { title: 'Your hold\'s goods', words: '1 piece of your hold, never collected by the captain who boarded you.', press: 'Reclaim', can: true });
  assert.equal(wantedText({ ...w, busy: true }).prizes.can, false);
  assert.equal(wantedText({ ...w, busy: true }).back.can, false);
  assert.deepEqual([wantedText({ ...w, prizes: 0, back: 0 }).prizes, wantedText({ ...w, prizes: 0, back: 0 }).back], [null, null]);
  const proto = Object.getPrototypeOf(globalThis.document.createElement('div'));
  proto.removeAttribute ??= function removeAttribute(k) { delete this.attrs[k]; };
  const pressed = [];
  const office = { ether: true, port: 'Pyrewatch', waters: 'The Deep Aether', charted: 0, rumours: [], chart: null, wanted: { ...w, collectPrizes: () => pressed.push('collect'), reclaim: () => pressed.push('reclaim'), post: () => {}, collect: () => {} } };
  const host = globalThis.document.createElement('div');
  const win = mountNavalYardWindow(host, { model: { name: 'Sloop', uid: 7, offer: () => ({ rows: [], whole: 0, gold: 100 }), ship: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 1, maxCrew: 1, barrels: 0 }), office: () => office } });
  byClass(host, 'dfnaval-tabs')[0].children[1].onclick({ stopPropagation() {} });
  const presses = byClass(host, 'dfnaval-officebuy');
  presses.find((p) => p.textContent === 'Collect').onclick({ stopPropagation() {} });
  presses.find((p) => p.textContent === 'Reclaim').onclick({ stopPropagation() {} });
  assert.deepEqual(pressed, ['collect', 'reclaim']);
  win.unmount();
});

test('SHIP-PVP the seams by source: the naval host\'s guns asked and its seams built; the sea\'s host builds the guns and the wreck\'s half, steps them and hears the referee; the world hands it my cell, a stranger and a name, and routes the referee\'s sea words; the socket\'s gate; the relay\'s dispatch, gone, beat and read-back; the routes; the deploy watches the law (mutants: each seam)', () => {
  const naval = src('src/scenes/naval/navalHost.js');
  assert.match(naval, /hitBy: \(s\) => shipShot\(s\) \|\| pvp\.open\(p\.id, s, isMine\(s\)\) \}\);/);
  assert.match(naval, /if \(typeof e\.target === 'string' && e\.target\.startsWith\('peer:'\)\) \{\n\s+if \(!isMine\(e\.shooter\)\) return;\n\s+const hurt = shotDamage\(gun, zone, \{ roll: random\(\), weight: e\.weight \}\);\n\s+if \(e\.type !== 'blast'\) gunsRefit\(hurt, e\.shooter\);\n\s+if \(fire\) hurt\.fire = fire;\n\s+pvp\.shot\(e\.target\.slice\(5\), hurt\);\n\s+return;\n\s+\}/);
  assert.match(naval, /const pvp = createNavalPvp\(\{\n\s+enabled: \(\) => enabled, boat: \(\) => boatInPlay\(\), stateOf: \(b\) => myBoatState\(b\), build: \(b\) => refitBuild\(b\), pose: \(b\) => boatPose\(b\),/);
  assert.match(naval, /\n {4}pvp,\n/);
  const sea = src('src/scenes/seaVenturesHost.js');
  assert.match(sea, /live: \(\) => live\(\) && !!deps\.cell\?\.\(\)\?\.seaPvpOk && wildHere\(\) && wildZoneKind\(\) === ETHER_KIND,/);
  assert.match(sea, /if \(nv && nv !== armed\) \{ nv\.pvp\?\.attach\?\.\(broadsides\); armed = nv; \}\n\s+broadsides\.step\(\);\n\s+wrecks\.frame\(\);/);
  // PIN MOVED (AUDIT SEA VENTURES E6A): the guns stepped every online frame (world.js wildFrame), never the exterior's alone
  assert.doesNotMatch(sea, /function step\(strikes = 0\) \{\n\s+pvpStep\(\);/);
  assert.match(sea, /gather, step, guns: pvpStep,/);
  assert.match(src('src/scenes/world.js'), /remainsMarkTick\(Date\.now\(\)\);[^\n]*\n\s+seaVentures\.guns\(\);/);
  assert.match(sea, /wref: \(g, room\) => broadsides\.hear\(g, room\),/);
  assert.match(sea, /name: \(id\) => \(deps\.name \? deps\.name\(id\) : deps\.cell\?\.\(\)\?\.peers\?\.get\?\.\(id\)\?\.name\) \|\| '',/, 'a peer\'s name the socket\'s own (HOST-SPLIT)');
  assert.match(sea, /const wrecks = createSeaWreckHost\(\{ session: deps\.session, checkpoint: deps\.checkpoint, character,/);
  assert.match(sea, /send: \(d, o\) => deps\.cell\?\.\(\)\?\.sendWild\?\.\(d, o\) === true,/);
  const w = src('src/scenes/world.js');
  assert.match(w, /cell: \(\) => online, foe: \(id\) => wildIsStranger\(id, online\?\.drawable\?\.\(\)\?\.find\(\(d\) => d\.id === id\)\?\.gt\),/);
  assert.match(w, /else if \(g\.k === 'rc'\) wildRcIn\(g, room\);\n\s+else seaVentures\.wref\(g, room\);/);
  const on = src('src/net/online.js');
  assert.match(on, /this\.seaPvpOk = relaySupportsSeaPvp\(relayV\);/);
  assert.match(on, /if \(SEA_PVP_KINDS\.includes\(d\.k\) && !this\._seaPvpOn\(ws\)\) return false;/);
  const relay = src('server/src/index.js');
  assert.match(relay, /if \(k === 'helm' \|\| k === 'shot' \|\| k === 'board'\) \{ await this\._seaWord\(a, m\.data, now\); return; \}/);
  assert.ok(relay.indexOf('if (d.k === \'board\') { const w = seaBoard(st, a.sub, d.r, now);') < relay.indexOf('const target = this._idFirst(d.to);\n    const tb = target?.[1];\n    if (!tb?.sub) return;\n    const fa = st.fighters.get(a.sub)'), 'a boarding asks nothing of her captain\'s socket');
  assert.match(relay, /wildGone\(this\._wildRef, a\.sub, Date\.now\(\)\); seaGone\(this\._wildRef, a\.sub, Date\.now\(\)\); \}/);
  assert.match(relay, /for \(const w of seaStep\(st, now\)\) await this\._seaSign\(w, now\);/);
  assert.match(relay, /for \(const \[, v\] of await this\.state\.storage\.list\(\{ prefix: SEA_WRECK_PREFIX \}\)\) \{ const w = seaWreckOf\(v\); if \(w\) \(st\.wrecks \?\?= new Map\(\)\)\.set\(w\.r, w\); \}/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /path === '\/v1\/sea\/wreck' \? await seaWreck\(sctx, who\.player, body, \{ gateKey: await gatePublicKey\(env, subtle\) \}\)/);
  assert.match(idx, /: path === '\/v1\/sea\/prize\/collect' \? await seaPrizeCollect\(sctx, who\.player, body\) : await seaPrizeReclaim\(sctx, who\.player, body\);/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/sea\/wreck', '\/v1\/sea\/prize\/collect', '\/v1\/sea\/prize\/reclaim',/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/sea\/seaPrizeLaw\.js"/);
});
