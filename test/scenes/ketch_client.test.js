// AUDIT KETCH L1-6 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 1): THE SHIP I RIDE UP TO - the one the room's
// `st` named me of this voyage, whoever leads the party since; else my party leader's, else my own. A `st` keeps it only
// from the ship under me, naming me. tools/mutants/ketch_client.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ketchShipChoice, ketchShipKept, KT_SHIP_KEY, ketchPressSpot, ketchPressFar, KT_PRESS_REACH, ketchCarryStep, KT_LET_GO_MS, ketchShipUnheard, KT_DOOR_MS } from '../../src/scenes/ketch/ketchClient.js';
import { KT_CRADLES, KT_SOCKETS, KT_RESONATORS, KT_BRIDGE_CRADLES, KT_REACH } from '../../src/net/ketch/ketchDeck.js';

const AT = { n: 3, owner: 'aaaaaaaaaaaaaaaa', key: 'kt:00000003.aaaaaaaaaaaaaaaa' };

test('KETCH MY SHIP THIS VOYAGE: the room\'s `st` naming me keeps the ship under me; one not naming me, another voyage\'s, or no ship keeps nothing (mutants: kept without my name)', () => {
  assert.equal(KT_SHIP_KEY, 'ketch.myShip');
  const st = { k: 'st', n: 3, cr: [['acct-a', 'A'], ['acct-b', 'B']] };
  assert.deepEqual(ketchShipKept(st, 'acct-b', AT), { n: 3, a: 'acct-b', o: AT.owner, p: null });
  assert.deepEqual(ketchShipKept(st, 'acct-b', AT, 'party-1'), { n: 3, a: 'acct-b', o: AT.owner, p: 'party-1' }, 'the party it was kept in');
  assert.equal(ketchShipKept(st, 'acct-c', AT), null, 'not of its crew');
  assert.equal(ketchShipKept({ ...st, n: 2 }, 'acct-b', AT), null, 'another voyage\'s');
  assert.equal(ketchShipKept({ ...st, k: 'cl' }, 'acct-b', AT), null);
  assert.equal(ketchShipKept(st, 'acct-b', null), null);
  assert.equal(ketchShipKept(st, null, AT), null);
});

test('KETCH THE SHIP I RIDE UP TO: the one I was taken into, though the lead has passed on; else the leader\'s, else my own - never another voyage\'s ship, never another account\'s (AUDIT KETCH L1-6; AUDIT SHIP 1 - the ship kept only in the party it was kept in; mutants: the leader over the ship kept; another voyage\'s ship ridden to; the party unread)', () => {
  const kept = { n: 3, a: 'acct-b', o: AT.owner, p: 'party-1' };
  assert.deepEqual(ketchShipChoice(3, 'acct-b', 'acct-c', kept, 'party-1'), { owner: AT.owner }, 'the lead passed to c: still a\'s ship');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', 'acct-y', { ...kept, p: null }, 'party-2'), { captain: 'acct-y' }, 'up alone first, then into y\'s party: y\'s ship (AUDIT SHIP 1)');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', 'acct-y', kept, 'party-2'), { captain: 'acct-y' }, 'into another party: its leader\'s');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', null, { ...kept, p: null }, null), { owner: AT.owner }, 'alone still: the ship kept');
  assert.deepEqual(ketchShipChoice(4, 'acct-b', 'acct-c', kept), { captain: 'acct-c' }, 'next voyage: the leader\'s');
  assert.deepEqual(ketchShipChoice(3, 'acct-d', 'acct-c', kept), { captain: 'acct-c' }, 'another account signed in');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', null, null), { captain: 'acct-b' }, 'alone: my own');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', 'acct-a', { ...kept, o: '' }), { captain: 'acct-a' });
});

test('KETCH A PRESS GOES ONLY FROM WHERE THE ROOM TAKES IT: a cradle\'s, a lying cell\'s, a socket\'s and a resonator\'s spot, my feet within the room\'s reach less a step - further, the page says so and sends nothing (AUDIT KETCH L3-5; mutants: the reach the box\'s)', () => {
  assert.ok(KT_PRESS_REACH < KT_REACH + 0.6, 'inside the room\'s own');
  assert.deepEqual(ketchPressSpot('kt:cr:2', null), KT_CRADLES[2]);
  assert.deepEqual(ketchPressSpot('kt:bc:1', null), KT_BRIDGE_CRADLES[1]);
  assert.deepEqual(ketchPressSpot('kt:sk:4', null), KT_SOCKETS[4]);
  assert.deepEqual(ketchPressSpot('kt:rs:3', null), KT_RESONATORS[3]);
  assert.deepEqual(ketchPressSpot('kt:lo:7', { lo: [[7, 1, -12, 2, 9]] }), [1, 2]);
  assert.equal(ketchPressSpot('kt:lo:8', { lo: [[7, 1, -12, 2, 9]] }), null);
  assert.equal(ketchPressSpot('kt:line', null), null, 'the line, the lifts, the chest - their own reach');
  const [x, z] = KT_CRADLES[0];
  assert.equal(ketchPressFar('kt:cr:0', null, [x + KT_PRESS_REACH - 0.01, -12, z]), false);
  assert.equal(ketchPressFar('kt:cr:0', null, [x + KT_PRESS_REACH + 0.01, -12, z]), true);
  assert.equal(ketchPressFar('kt:cr:0', null, [x + 3.4, -12, z]), true, 'where the eye could reach the box, the room would not');
  assert.equal(ketchPressFar('kt:line', null, [999, 0, 999]), false);
});

test('KETCH THE HANDS FULL: a carrier\'s readied weapon put up and said once; readied again, the cell let go - said only when the word left, else put up again and asked next frame; the hands given back KT_LET_GO_MS while the room hears it (AUDIT KETCH L3-6; mutants: let go said whether it went)', () => {
  let sent = 0, ok = true;
  const drop = () => { sent++; return ok; };
  const st = { carrying: true, sheathed: false, forced: false, letGoAt: -Infinity };
  assert.deepEqual(ketchCarryStep(st, 0, drop), { forced: true, sheathe: true, say: 'handsFull' });
  assert.deepEqual(ketchCarryStep({ ...st, sheathed: true, forced: true }, 1, drop), { forced: true }, 'put up: nothing more');
  ok = false;
  assert.deepEqual(ketchCarryStep({ ...st, forced: true }, 2, drop), { forced: true, sheathe: true }, 'the drop did not go: put up again, nothing said');
  ok = true;
  assert.deepEqual(ketchCarryStep({ ...st, forced: true }, 3, drop), { forced: false, letGoAt: 3, say: 'letGo' }, 'it went: said');
  assert.equal(sent, 2);
  assert.deepEqual(ketchCarryStep({ ...st, letGoAt: 3 }, 3 + KT_LET_GO_MS - 1, drop), { forced: false }, 'the hands given back meanwhile');
  assert.deepEqual(ketchCarryStep({ ...st, carrying: false, forced: true }, 9, drop), { forced: false });
});

test('KETCH A SHIP NEVER HEARD WALKS ME DOWN: no word of her KT_DOOR_MS after the step aboard (a busy door, tried again) - down, with its word; a ship heard, never (AUDIT KETCH L3-11; mutants: an empty deck kept)', () => {
  assert.equal(ketchShipUnheard({ n: -1 }, KT_DOOR_MS - 1), false, 'the door has its time');
  assert.equal(ketchShipUnheard({ n: -1 }, KT_DOOR_MS + 1), true);
  assert.equal(ketchShipUnheard(null, KT_DOOR_MS + 1), true);
  assert.equal(ketchShipUnheard({ n: 3 }, 10 * KT_DOOR_MS), false, 'heard: aboard');
});
