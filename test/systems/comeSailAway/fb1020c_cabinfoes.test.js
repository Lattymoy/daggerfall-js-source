// FB1020c CABIN-FOES (the field, 2026-10-20: "you can despawn pirates by entering your cabin on a ship") - THE CABIN'S
// DOOR ASKS THE SEA'S OWN QUESTION (systems/sailingCabin.js cabinEntryRefusal `hostile`, scenes/sailingCabin.js, the
// world's two doors into it).
//
// A sailing cabin is an interior: its door runs the world's interior transition (worldModes.js enterSailingCabin ->
// interiorTransition -> host.onTransitionInterior), and that empties the sea (world.js navalTransition -> naval.clear():
// every ship of it dropped, a boarding's raid withdrawn - NAV-H, "a building has no sea"). SAILING-CABINS (2026-10-03)
// opened that door on the deck with no word of the sea, so a pirate alongside - or her boarders on the deck - was taken
// off the sea for good by stepping below and back up. The rest, the journey, the time scale and the yard already
// refuse with a hostile ship near (navalHost.js hostileNear, HOSTILE_NEAR_M); the door asks it now, on the deck's door
// and on Transport > Ship's (world.js enterLinkedBankCabin).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from '../../navalSea.mjs';
import { HOSTILE_NEAR_M } from '../../../src/scenes/naval/navalHost.js';
import { cabinEntryRefusal, CABIN_REFUSAL } from '../../../src/systems/sailingCabin.js';
import { createSailingCabinAccess } from '../../../src/scenes/sailingCabin.js';
import { hostText } from '../../hostText.mjs';

const W = hostText('src/scenes/world.js');

test('FB1020c CABIN-FOES the law: a hostile ship near refuses the cabin in its own plain words, after the door\'s other refusals and only with every one of them met; none near, the door opens (mutants: the enemies\' arm dropped; read before the helm\'s)', () => {
  assert.equal(CABIN_REFUSAL.enemies, 'You cannot enter the cabin with enemies nearby.');
  const boat = { uid: 101, hull: 3, GameObject: { activeSelf: true } };
  const ok = { boats: [boat], aboard: true };
  assert.equal(cabinEntryRefusal(boat, ok), null, 'no foe near: the door opens');
  assert.equal(cabinEntryRefusal(boat, { ...ok, hostile: false }), null);
  assert.equal(cabinEntryRefusal(boat, { ...ok, hostile: true }), CABIN_REFUSAL.enemies);
  assert.equal(cabinEntryRefusal(boat, { ...ok, hostile: true, sailing: true }), CABIN_REFUSAL.helm, 'at her helm the helm is said first');
  assert.equal(cabinEntryRefusal(boat, { ...ok, hostile: true, aboard: false }), CABIN_REFUSAL.aboard);
  assert.equal(cabinEntryRefusal(boat, { boats: [], hostile: true }), CABIN_REFUSAL.unavailable);
});

/** The sea with my Small Ship (uid 42) and me off her helm on her deck, the cabin's door over it as the world builds it. */
async function deckAndDoor() {
  const h = await sea({ hull: 2 });
  h.runtime.sailing = false;
  h.view.feet = [...h.boat.DrivePosition.position];   // on her deck, by the helm
  const entered = [], said = [];
  const access = createSailingCabinAccess({
    available: () => true, boats: () => h.runtime.state.AllBoats, mode: () => 'exterior', busy: () => false,
    csa: () => h.runtime, hostile: () => h.host.hostileNear(), aboard: () => true, nearby: () => true,
    feet: () => [...h.view.feet], yaw: () => 0, toNative: (p) => p, fromNative: (p) => p,
    enterInterior: async (c) => { entered.push(c); return true; }, say: (line) => said.push(line),
  });
  return { h, access, entered, said };
}

test('FB1020c CABIN-FOES on the real sea: a bold pirate brigantine alongside and the player off the helm on her deck - the door says so, no room is entered and the pirate is still on the sea; with no ship near the same door opens (the bug\'s record: the door opened and the sea emptied behind it) (mutants: the door\'s hostile unread; the world hands no hostile)', async () => {
  const { h, access, entered, said } = await deckAndDoor();
  assert.equal(h.host.hostileNear(), false, 'an empty sea');
  const id = h.host.spawnShip('pirateBrig', { range: 120, bearing: Math.PI / 2, yaw: -Math.PI / 2 });
  const pirate = h.host._sea.get(id);
  pirate.ship.temper = 'bold';
  pirate.ship.pos = [120, 0, 0];
  assert.ok(120 < HOSTILE_NEAR_M);
  h.host.frame(0.1);
  assert.equal(h.host.hostileNear(), true, 'a bold pirate within the sea\'s reach of her deck');
  assert.equal(await access.enter(h.boat), false, 'refused');
  assert.deepEqual(said, [CABIN_REFUSAL.enemies]);
  assert.deepEqual(entered, [], 'no room entered - so no transition empties the sea');
  assert.equal(h.host._sea.get(id), pirate, 'the pirate still sails');
  // the sea cleared as the transition clears it (another way off it - a jump, a load): the door opens again
  h.host.clear();
  assert.equal(h.host.hostileNear(), false);
  assert.equal(await access.enter(h.boat), true, 'no foe near: below she goes');
  assert.equal(entered.length, 1);
});

test('FB1020c CABIN-FOES the world\'s doors by source: the deck door is handed the hostile ship near and the helm off the runtime (two seams where there were two of the helm alone - bootWorld\'s ceiling); Transport > Ship\'s door refuses on the same two, in the door\'s own words (mutants: the deck door handed no hostile; the bank door asks the helm alone)', () => {
  // PIN MOVED (AUDIT SEA VENTURES E6A): the hostile ship near, or a stranger captain's in the open sea (navalPvp.js captainNear)
  assert.match(W, /const sailingCabins = createSailingCabinAccess\(\{[\s\S]{0,400}csa: \(\) => csaRuntime, hostile: \(\) => navalHostileNear\(\) \|\| !!naval\?\.pvp\?\.captainNear\?\.\(\),/);
  assert.doesNotMatch(W, /sailing: \(\) => !!csaRuntime\?\.isSailing\(\), disembarking:/, 'the two helm seams folded into the runtime\'s own');
  assert.match(W, /if \(csaRuntime\.isSailing\(\) \|\| navalHostileNear\(\)\) \{ townTalk\.say\(csaRuntime\.isSailing\(\) \? CABIN_REFUSAL\.helm : CABIN_REFUSAL\.enemies\); return true; \}/);
  const adapter = readFileSync(new URL('../../../src/scenes/sailingCabin.js', import.meta.url), 'utf8');
  assert.match(adapter, /aboard: deps\.aboard\(boat\), hostile: !!deps\.hostile\?\.\(\),/);
});
