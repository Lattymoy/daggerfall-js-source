// CABIN-TITLES (2026-10-04, "cabins specifically are broken ... check past commits (before the recent naval overhaul)").
// SAILING-CABINS (#574) links a bank ship's furnished cabin to ONE sailing ship of her size, and only when that ship is
// unambiguous: world.js's legacyCabinItems handed boatCabinOwnership.bankCabinCandidates the pack and the wagon, where
// every ship's deed rode until HOLDINGS (#549) entered deeds in the Fleet's book instead (systems/fleet.js titleDeed).
// From then a ship laid up in the book was no candidate: with a second ship of the bank ship's size afloat, the link
// read that one as the only one and moved the bank cabin's contents into her; with none afloat it read no ship at all.
// Every fixture from its real producer (TEST THE SHAPE THE PRODUCER MINTS): the deeds minted by Come Sail Away's own
// mintDeed and entered by the Fleet's titleDeed (worldModes.js commitTrade's call), the afloat ship launched from her
// title by the real runtime over the vendored hulls (test/csaScene.mjs), the link by the shipped linkBankCabin, and the
// host's own legacyCabinItems lifted from world.js's source. THE FOUR HOSTS: world.js is the one host with a bank cabin
// link (fixed here); worldModes.js asks it (host.linkedBankCabin, unchanged); exterior.js has no sailing runtime and
// dungeonContext.js no exterior fleet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, terrain } from '../csaScene.mjs';
import { titleDeed, titleOf, fleetBook, knowShip, retitle, _resetFleetForTests } from '../../src/systems/fleet.js';
import { mintDeed, mintBoatItem } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { linkBankCabin, readBankCabinLink } from '../../src/systems/boatCabinOwnership.js';
import { cabinSceneName } from '../../src/systems/sailingCabin.js';
import { SHIP_INTERIOR_MAP_IDS, SHIP_TYPES } from '../../src/systems/banking.js';
import { BUILDING_KEY_0 } from '../../src/systems/talk/talkTopics.js';
import { createSceneCache, interiorSceneName } from '../../src/systems/sceneCache.js';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const cutLine = (start) => { const i = WORLD.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
const SMALL_SHIP = 2, LARGE_GALLEY = 3, CARRACK = 4;

/** world.js's own legacyCabinItems, over `playerEntity` and the Fleet's book. */
function hostItems(playerEntity) {
  // eslint-disable-next-line no-new-func
  return new Function('playerEntity', 'fleetBook', `${cutLine('  const legacyCabinItems = () =>')} return legacyCabinItems;`)(playerEntity, fleetBook);
}

/** Come Sail Away's real runtime with the world host's item seams (the pack, the Fleet's book and its retitle), and a
 *  bank ship of `type` owned with her cabin furnished (her scene saved and kept, as the bank ship's interior leaves it). */
function rig(type) {
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20)] });
  const pack = [];
  let uid = 8000;
  s.deps.items = {
    create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack,
    titles: () => fleetBook(), retitle: (boat, parts) => { knowShip(boat.uid, boat.hull, boat.variant, parts?.value); return !!retitle(boat.uid); },
  };
  const cache = createSceneCache();
  const bankKey = interiorSceneName(SHIP_INTERIOR_MAP_IDS[type], BUILDING_KEY_0);
  const furnished = { furniture: ['a chest she was given'] };
  cache.scenes.set(bankKey, furnished);
  cache.permanent.add(bankKey);
  const player = { ownedShip: type, sceneCache: cache, items: pack, wagonItems: [] };
  return { s, pack, player, cache, bankKey, furnished, items: hostItems(player) };
}

test('CABIN-TITLES: a ship laid up in the Fleet\'s book still counts - a large bank cabin is not auto-linked to the one large ship afloat while another lies laid up; the choice is asked and the cabin stays where it was (mutant: the book left out of legacyCabinItems)', () => {
  const r = rig(SHIP_TYPES.Large);
  titleDeed(mintDeed(LARGE_GALLEY, 0, 801, 100000), { from: r.pack });   // bought, laid up: her title in the book, nothing in the pack
  titleDeed(mintDeed(CARRACK, 0, 802, 100000), { from: r.pack });
  const carrack = r.s.rt.LaunchFromDeed(titleOf(802), () => fleetBook(), [100, 34, 200], [0, 0, 1], r.s.terrains[0]);
  assert.ok(carrack && r.s.rt.AllBoats.includes(carrack), 'the Carrack afloat');
  assert.ok(titleOf(801) && !r.s.rt.AllBoats.some((b) => b.uid === 801), 'the Galley laid up: her title in the book, no boat');
  assert.equal(r.pack.length, 0, 'no deed rides the pack (HOLDINGS)');

  const result = linkBankCabin(r.player, r.s.rt.AllBoats, r.items());
  assert.equal(result.status, 'choose', 'two large ships held: the link is the player\'s choice');
  assert.deepEqual(result.candidates.map((c) => [c.uid, c.hull]).sort((a, b) => a[0] - b[0]), [[801, LARGE_GALLEY], [802, CARRACK]]);
  assert.equal(readBankCabinLink(r.player.boatCabinLink), null, 'nothing linked');
  assert.equal(r.cache.scenes.get(r.bankKey), r.furnished, 'the bank cabin\'s contents stay in the bank ship');
  assert.equal(r.cache.scenes.has(cabinSceneName(802)), false, 'never moved into the Carrack');
});

test('CABIN-TITLES: a lone ship laid up in the book is her size\'s one match, as her deed in the pack was - the small bank cabin links to her and its contents move to her cabin intact (mutant: the book left out of legacyCabinItems)', () => {
  const r = rig(SHIP_TYPES.Small);
  titleDeed(mintDeed(SMALL_SHIP, 0, 811, 50000), { from: r.pack });
  assert.equal(r.s.rt.AllBoats.length, 0, 'laid up, none afloat');

  const result = linkBankCabin(r.player, r.s.rt.AllBoats, r.items());
  assert.equal(result.status, 'linked');
  assert.deepEqual(readBankCabinLink(r.player.boatCabinLink), { v: 1, uid: 811, hull: SMALL_SHIP, type: SHIP_TYPES.Small });
  assert.equal(r.cache.scenes.has(r.bankKey), false, 'moved out of the bank ship');
  assert.equal(r.cache.scenes.get(cabinSceneName(811)), r.furnished, 'into her cabin, intact');
  assert.ok(r.cache.permanent.has(cabinSceneName(811)) && !r.cache.permanent.has(r.bankKey), 'and kept under her key');
});

test('CABIN-TITLES: a ship picked up is her parts in the pack, her title gone from the book (AUDIT HOLDINGS F1) - still her size\'s one match, so the pack is asked beside the book (mutant: the pack left out of legacyCabinItems)', () => {
  const r = rig(SHIP_TYPES.Large);
  titleDeed(mintDeed(CARRACK, 0, 821, 100000), { from: r.pack });
  const b = r.s.rt.LaunchFromDeed(titleOf(821), () => fleetBook(), [100, 34, 200], [0, 0, 1], r.s.terrains[0]);
  assert.equal(r.s.rt.PackBoat(b, true), true, 'picked up');
  assert.equal(titleOf(821), null, 'her title left the book with her');
  assert.equal(r.pack.length, 1, 'her parts in the pack');

  const result = linkBankCabin(r.player, r.s.rt.AllBoats, r.items());
  assert.equal(result.status, 'linked');
  assert.deepEqual(readBankCabinLink(r.player.boatCabinLink), { v: 1, uid: 821, hull: CARRACK, type: SHIP_TYPES.Large });
});

test('CABIN-TITLES: a linked ship not afloat is called from the Fleet - the refusal names Holdings > Fleet, never a deed the pack no longer holds (mutant: the old line)', () => {
  const i = WORLD.indexOf('  async function enterLinkedBankCabin(');
  assert.ok(i >= 0, 'lifted: enterLinkedBankCabin');
  const body = WORLD.slice(i, WORLD.indexOf('\n  }\n', i));
  const said = /if \(!boat\?\.MapPixel\) \{ townTalk\.say\('([^']*)'\)/.exec(body);
  assert.ok(said, 'the not-afloat refusal');
  assert.equal(said[1], 'Summon your linked ship from Holdings > Fleet, or place its parts, first.');
});
