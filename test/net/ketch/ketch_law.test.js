// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 1 and 2): THE SKY-KETCH'S LAW - the voyage on the real
// clock (Loredas, the epoch, the sighting, the station, the crews' last minutes), a crew's ship's room and its door (the
// crew's eight, the captain's party, staff, a member who comes back), the stages and the relay's own words (the door's
// refusals - the page's words of the voyage are test/systems/ketch/ketch_words.test.js).
// tools/mutants/ketch_law.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KT_EVERY_MS, KT_EPOCH_MS, KT_SIGHT_MS, KT_STATION_MS, KT_LAST_MS, KT_CREW_MAX, KT_PHASES, KT_STAGES, KT_STAGE, KT_TEXT,
  ketchVoyageOf, ketchVoyageAt, ketchBoards, ketchHolds, ketchRoomKey, ketchRoomOf, isKetchRoom, ketchRoomHolds, ketchAdmits,
} from '../../../src/net/ketch/ketchLaw.js';
import { PARTY_MAX } from '../../../src/net/wire.js';

const OWNER = '0123456789abcdef';
const H = 3600 * 1000;

test('KETCH THE VOYAGE ON THE REAL CLOCK: voyage 0 arrives 2026-10-25 at midnight UTC, the first after she goes live, and every voyage ten hours on; sighted an hour before, at station seven hours, the crews\' last forty-five minutes after - away an hour and a quarter of every round (KETCH-EVERY, AUDIT KETCH II L5-1; mutants: the epoch moved; a round of nine hours; the station shortened)', () => {
  assert.equal(new Date(KT_EPOCH_MS).toISOString(), '2026-10-25T00:00:00.000Z');   // PIN MOVED (KETCH-EVERY): it was Saturday 2026-10-24, a week a voyage
  assert.equal(KT_EVERY_MS, 10 * H);
  assert.deepEqual([KT_SIGHT_MS, KT_STATION_MS, KT_LAST_MS], [1 * H, 7 * H, 45 * 60 * 1000]);   // PIN MOVED (AUDIT KETCH II L5-1): twenty minutes, shorter than a KETCH-LONGER voyage
  assert.ok(KT_SIGHT_MS + KT_STATION_MS + KT_LAST_MS < KT_EVERY_MS, 'gone before she is sighted again');
  const v3 = ketchVoyageOf(3);
  assert.deepEqual(v3, { n: 3, sightAt: KT_EPOCH_MS + 3 * KT_EVERY_MS - H, at: KT_EPOCH_MS + 3 * KT_EVERY_MS, departAt: KT_EPOCH_MS + 3 * KT_EVERY_MS + 7 * H, endAt: KT_EPOCH_MS + 3 * KT_EVERY_MS + 7 * H + 45 * 60 * 1000 });
  assert.equal(new Date(v3.at).toISOString(), '2026-10-26T06:00:00.000Z', 'ten hours a round, round the clock');
  assert.deepEqual(ketchVoyageOf(-4).n, 0, 'no voyage before the first');
  assert.deepEqual([...KT_PHASES], ['away', 'sighted', 'docked', 'departing']);
});

test('KETCH THE VOYAGE AT A MOMENT: away before its sighting (the next voyage named), sighted, docked, departing, and away again at its end with the next one\'s times - each instant\'s edge on the later side (mutants: the sighting late; the station\'s end inclusive; away naming the voyage gone)', () => {
  const v = ketchVoyageOf(1);
  const at = (t) => { const x = ketchVoyageAt(t); return [x.n, x.phase]; };
  assert.deepEqual(at(KT_EPOCH_MS - KT_SIGHT_MS - 1), [0, 'away'], 'before the first sighting the first voyage is the next');
  assert.deepEqual(at(KT_EPOCH_MS - KT_SIGHT_MS), [0, 'sighted']);
  assert.deepEqual(at(v.sightAt - 1), [1, 'away']);
  assert.deepEqual(at(v.sightAt), [1, 'sighted']);
  assert.deepEqual(at(v.at - 1), [1, 'sighted']);
  assert.deepEqual(at(v.at), [1, 'docked']);
  assert.deepEqual(at(v.departAt - 1), [1, 'docked']);
  assert.deepEqual(at(v.departAt), [1, 'departing']);
  assert.deepEqual(at(v.endAt - 1), [1, 'departing']);
  assert.deepEqual(at(v.endAt), [2, 'away'], 'gone: the next voyage, away');
  assert.equal(ketchVoyageAt(v.endAt).at, ketchVoyageOf(2).at);
  assert.deepEqual(at(NaN), [0, 'away']);
});

test('KETCH BOARDING AND HOLDING: a crew boards while she keeps station (her anchor-lift down), and her ship holds its crews from her arrival to her going - the crews\' last minutes hold but board nobody (mutants: boarding through the last minutes; holding before the arrival)', () => {
  const v = ketchVoyageOf(2);
  assert.equal(ketchBoards(2, v.at - 1), false);
  assert.equal(ketchBoards(2, v.at), true);
  assert.equal(ketchBoards(2, v.departAt - 1), true);
  assert.equal(ketchBoards(2, v.departAt), false, 'weighing anchor: the lift is drawn up');
  assert.equal(ketchHolds(2, v.at - 1), false);
  assert.equal(ketchHolds(2, v.departAt + 1), true);
  assert.equal(ketchHolds(2, v.endAt - 1), true);
  assert.equal(ketchHolds(2, v.endAt), false);
});

test('KETCH A CREW\'S SHIP\'S ROOM: `kt:<voyage in eight hex>.<captain\'s digest in sixteen>` - keyed, read back, refused for a bad voyage or owner; the Worker mints one only while its voyage holds its crews (mutants: the voyage in decimal; an owner of fifteen; minting a gone voyage)', () => {
  assert.equal(ketchRoomKey(0, OWNER), 'kt:00000000.0123456789abcdef');
  assert.equal(ketchRoomKey(255, OWNER), 'kt:000000ff.0123456789abcdef');
  for (const [n, o] of [[-1, OWNER], [1.5, OWNER], [2 ** 32, OWNER], [3, 'abc'], [3, OWNER.toUpperCase()], [3, `${OWNER}0`], [3, OWNER.slice(1)], [3, null]]) assert.equal(ketchRoomKey(n, o), null, `${n} ${o}`);
  assert.deepEqual(ketchRoomOf('kt:000000ff.0123456789abcdef'), { n: 255, owner: OWNER });
  for (const k of ['kt:ff.0123456789abcdef', 'sd:3', 'kt:000000ff.0123456789abcdeg', null, 42]) assert.equal(ketchRoomOf(k), null, String(k));
  assert.equal(isKetchRoom('kt:00000001.0123456789abcdef'), true);
  assert.equal(isKetchRoom('eg:abc'), false);
  const v = ketchVoyageOf(1), key = ketchRoomKey(1, OWNER);
  assert.equal(ketchRoomHolds(key, v.at - 1), false);
  assert.equal(ketchRoomHolds(key, v.at), true);
  assert.equal(ketchRoomHolds(key, v.endAt), false);
});

test('KETCH THE ROOM\'S DOOR: a newcomer with a right while she boards, never the ninth (staff neither), never without a right, never while she weighs anchor; a member of the crew comes back while she holds; nobody once she is gone; the crew\'s eight the party\'s own bound (mutants: the ninth let in; a member refused in the last minutes; a newcomer let in while she weighs anchor; no right let in)', () => {
  assert.equal(KT_CREW_MAX, 8);
  assert.equal(KT_CREW_MAX, PARTY_MAX, 'one party, one ship');
  const key = ketchRoomKey(1, OWNER), v = ketchVoyageOf(1), t = v.at + H;
  const crew = Array.from({ length: 7 }, (_, i) => `a${i}`);
  assert.equal(ketchAdmits(key, 'z', 'owner', crew, t), null);
  assert.equal(ketchAdmits(key, 'z', 'party', crew, t), null);
  assert.equal(ketchAdmits(key, 'z', null, crew, t), 'crew');
  assert.equal(ketchAdmits(key, 'z', 'party', [...crew, 'a7'], t), 'full', 'never nine');
  assert.equal(ketchAdmits(key, 'z', 'staff', [...crew, 'a7'], t), 'full', 'staff neither: the wire\'s crew is eight (AUDIT KETCH L1-4) - a full ship is watched hidden');
  assert.equal(ketchAdmits(key, 'z', 'staff', crew, t), null, 'staff while there is a place');
  assert.equal(ketchAdmits(key, 'a3', null, crew, t), null, 'a member comes back');
  assert.equal(ketchAdmits(key, 'a3', null, crew, v.departAt + 1), null, 'and in her last minutes');
  assert.equal(ketchAdmits(key, 'z', 'party', crew, v.departAt + 1), 'closed');
  assert.equal(ketchAdmits(key, 'a3', null, crew, v.endAt), 'gone');
  assert.equal(ketchAdmits(key, 'z', 'party', crew, v.at - 1), 'gone', 'not yet arrived: no ship');
  assert.equal(ketchAdmits('sd:1', 'z', 'owner', [], t), 'crew');
  assert.equal(ketchAdmits(key, '', 'owner', [], t), 'crew');
  assert.deepEqual(Object.keys(KT_TEXT.refuse), ['closed', 'gone', 'crew', 'full'], 'a word for each refusal the door says');
  for (const w of Object.values(KT_TEXT.refuse)) assert.ok(w.length > 0);
});

test('KETCH THE STAGES: the Watch, the Gallery, the Engine, the Sailwalk, the Warden, the Cabin - numbered in the order a crew takes them', () => {
  assert.deepEqual([...KT_STAGES], ['watch', 'gallery', 'engine', 'sailwalk', 'bridge', 'vault']);
  assert.deepEqual(KT_STAGES.map((k) => KT_STAGE[k]), [0, 1, 2, 3, 4, 5]);
});
