// AUDIT RPT1026 E3 (the audit of FIELD BUGS 2026-10-26r, lane FIGHTS): RPT1026-FIGHTS RETIRED-BLOW's law at the Ketch's
// relay - a word aboard is judged from a pose no older than KT_POSE_FRESH_MS, the census's own age
// (`server/src/index.js` _ktWord) - was pinned by its source text alone, where the real Room runs under test/fakeRoom.mjs
// (ketch_relay.test.js, ketch_audit2_relay.test.js drive it). Driven here: a crewmate who stops posing strikes a risen
// construct of the Watch from that stale pose and lands nothing; posing again, its blow lands. tools/mutants/audit_rpt1026_fights.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM } from '../../../src/net/wire.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { ketchRoomKey, ketchVoyageOf } from '../../../src/net/ketch/ketchLaw.js';
import { deckToDungeon } from '../../../src/net/ketch/ketchDeck.js';
import { KT_POSE_FRESH_MS } from '../../../src/net/ketch/ketchBrain.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';

/** The captain alice's ship on voyage 1, her party of two aboard (ketch_audit2_relay.test.js's harness). */
async function withShip(t0, fn) {
  const realNow = Date.now, warn = console.warn, info = console.info;
  const C = { t: t0 };
  Date.now = () => C.t; console.warn = () => {}; console.info = () => {};
  try {
    const world = fakeRooms({ now: () => C.t });
    const hub = world.room(SOCIAL_ROOM), members = ['acct-alice', 'acct-bobby'];
    for (const m of members) hub.store.set(`acct:${m}`, { name: m.slice(5), party: 'p1' });
    hub.store.set('party:p1', { id: 'p1', leader: members[0], members, invites: [], away: {} });
    const ship = world.room(ketchRoomKey(1, await instanceOwnerOf('acct-alice')));
    await fn({ C, ship });
  } finally { Date.now = realNow; console.warn = warn; console.info = info; }
}
const at = (x, y, z) => { const [a, b, c] = deckToDungeon(x, y, z); return { x: a, y: b, z: c, yaw: 0, pitch: 0, mv: 0 }; };

test('AUDIT RPT1026 E3 THE KETCH\'S RELAY JUDGES A WORD FROM A FRESH POSE, DRIVEN: a crewmate posing strikes a risen construct and lands; gone quiet past KT_POSE_FRESH_MS (the census has dropped it) its blow from that stale pose lands nothing; posing again, it lands (mutants: the word\'s pose never aged)', async () => {
  const V1 = ketchVoyageOf(1);
  await withShip(V1.at + 60_000, async ({ C, ship }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30), { charLevel: 30 });
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(1, 0, 30), { charLevel: 30 });
    const V = ship.room._kt;
    const beat = async () => { C.t += 250; await ship.fire(); };
    let q = 1;
    const strike = async (B) => { const h0 = B.h; await ship.raw(bob, JSON.stringify({ t: 'kt', k: 'hit', o: B.id, q: q++, d: 5, r: HIT_KINDS.Shaft })); return h0 - B.h; };
    // the Watch's first wave risen on the waist, both posing
    let B = null;
    for (let k = 0; k < 120 && !B; k++) {
      await ship.pose(alice, at(0, 0, 30)); await ship.pose(bob, at(1, 0, 30 + (k % 2) * 0.2)); await beat();
      B = V.bodies.find((o) => o.floor === 'waist' && o.h > 0 && C.t >= o.upAt) ?? null;
    }
    assert.ok(B, 'a construct risen on the waist');
    await ship.pose(bob, at(1, 0, 30.4));
    assert.ok(await strike(B) > 0, 'a blow from a fresh pose lands');
    // bob falls quiet - alice keeps the ship's census
    const quietFrom = C.t;
    while (C.t - quietFrom <= KT_POSE_FRESH_MS + 1000) { await ship.pose(alice, at(0, 0, 30 + ((C.t / 1000) % 2) * 0.2)); for (let k = 0; k < 4; k++) await beat(); }
    const b = ship.room._all().get(bob);
    assert.ok(C.t - (b.pAt ?? b.since) > KT_POSE_FRESH_MS, 'his last pose is older than the census keeps');
    assert.ok(B.h > 0, 'the construct still stands');
    C.t += 600;
    assert.equal(await strike(B), 0, 'a blow from a stale pose speaks for no body - it lands nothing');
    C.t += 600;
    await ship.pose(bob, at(1, 0, 30));
    assert.ok(await strike(B) > 0, 'posing again, his blow lands');
  });
});
