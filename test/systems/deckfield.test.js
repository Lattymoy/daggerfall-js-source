// DECK-FIELD (2026-09-29) - three field bugs from one sailing session, each root-caused (Mac: "Walking on the deck gives
// water sounds, hunting notifications appear when sailing, shooting cannons should have attack canceling"):
//
//   SHIP-DECK - Immersive Footsteps read the terrain tile under the feet and nothing else (its own noted IsOnShip bug), so
//               a deck over the open sea stepped in deep water: the floor under the feet decides now (the host's `deck`
//               off the down probe's collider bucket), the mod's own wooden-floor rule for a deck.
//   SEA-HUNT  - the hunt's gate asked "outdoors and not swimming", which was the whole of "on land" before Come Sail Away
//               put a deck under the player, and the coast's first sea pixels read as land's climate: `afloat` rolled
//               nothing, off one predicate the hunt, a bounty's trail and a wilderness band all read. (The text hunt was
//               removed 2026-10-04; the trail and the band still read the predicate.)
//   GUN-HOLD  - a laid broadside could only be fired: Activate while the guns are laid puts them down unfired (the bow's own
//               cancel), before the helm's ladder boards or heaves to - and the readout says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createImmersiveFootsteps, readFootstepSettings, FIXED_DELTA_TIME, IMMERSIVE_FOOTSTEPS_VENDOR } from '../../src/systems/immersiveFootsteps.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { SEASON } from '../../src/world/climateSwaps.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { EQUIP_SLOTS } from '../../src/characters/paperdoll/paperdoll.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { equipTableOf } from '../../src/systems/equip.js';
import { navalHudText, navalPadPrompts } from '../../src/ui/naval/navalHud.js';
import { sea } from '../navalSea.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');

// ── SHIP-DECK ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Immersive Footsteps with its clips in (bytes of nothing), the settings' defaults, and a place to stand. */
async function strideRig() {
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_FOOTSTEPS_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const c = createImmersiveFootsteps({
    audio: { registerSound: async () => true, playOneShot() {} }, settings: () => readFootstepSettings(() => store), random: () => 0,
    fetchClip: async () => new Uint8Array([1]),
  });
  const entity = { items: [], activeEffects: [] };
  const slots = equipTableOf(entity);
  const outdoors = (o = {}) => ({
    paused: false, entity, grounded: true, standingStill: false, isRunning: false, movingLessThanHalfSpeed: false,
    transportMode: TRANSPORT_MODES.Foot, swimming: false, pos: [0, 0, 0], inside: false, inDungeon: false,
    season: SEASON.Summer, climateIndex: CLIMATES.Woodlands, tileMapIndex: 2, waterWalking: false, ...o,
  });
  c.update(0, outdoors());
  await c.settle();
  const setAt = (o) => { for (let i = 0; i < 30; i++) c.update(FIXED_DELTA_TIME, outdoors(o)); return c.status().currentSet; };
  return { c, entity, slots, setAt };
}
const boots = (material) => ({ group: 'Armor', templateIndex: 108, material });

test('SHIP-DECK: a deck over the open sea is a wooden floor - not tile 0\'s deep water - and stepping off it re-reads the ground under the same tile (mutants: the deck arm dropped, the re-read on leaving skipped)', async () => {
  const r = await strideRig();
  assert.equal(r.setAt({ tileMapIndex: 0 }), 'DeepWaterFootstepsMain', 'the water itself is still the water');
  assert.equal(r.setAt({ tileMapIndex: 0, deck: true, onStaticGeometry: true }), 'WoodFootstepsMain', 'a deck over the sea: the boards');
  assert.equal(r.c.status().floor, 'deck');
  assert.equal(r.setAt({ tileMapIndex: 0 }), 'DeepWaterFootstepsMain', 'over the side on the SAME tile: the ground is re-read, not held');
  assert.equal(r.c.status().floor, null);
  assert.equal(r.setAt({ tileMapIndex: 2, deck: true, onStaticGeometry: true }), 'WoodFootstepsMain', 'a boat drawn up over grass is still a deck');
  assert.equal(r.setAt({ tileMapIndex: 2 }), 'GrassFootstepsMain', 'and the grass is the grass again');
});

test('SHIP-DECK: the deck is the mod\'s own wooden-floor rule - iron boots and better ring plate on it, chain boots chain, leather or none the boards (mutant: the boots\' arm lost)', async () => {
  const r = await strideRig();
  const deck = { tileMapIndex: 0, deck: true, onStaticGeometry: true };
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Iron);
  r.c.onInventoryClose(r.entity);
  assert.equal(r.setAt(deck), 'PlateFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Chain);
  r.c.onInventoryClose(r.entity);
  assert.equal(r.setAt(deck), 'ChainmailFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = boots(ARMOR_MATERIAL.Leather);
  r.c.onInventoryClose(r.entity);
  assert.equal(r.setAt(deck), 'WoodFootstepsMain');
  r.slots[EQUIP_SLOTS.Feet] = null;
  r.c.onInventoryClose(r.entity);
  assert.equal(r.setAt(deck), 'WoodFootstepsMain');
});

test('SHIP-DECK: any other model over a water tile (a bridge) is walked on - the armour\'s ground, as a path is - while a model over land keeps the tile ladder verbatim (mutant: every model made a floor)', async () => {
  const r = await strideRig();
  assert.equal(r.setAt({ tileMapIndex: 0, onStaticGeometry: true }), 'UnarmoredFootstepsMain', 'a bridge over the water: no splash');
  assert.equal(r.c.status().floor, 'floor');
  assert.equal(r.setAt({ tileMapIndex: 2, onStaticGeometry: true }), 'GrassFootstepsMain', 'a model over grass: the mod\'s own ladder');
  assert.equal(r.c.status().floor, null);
});

test('SHIP-DECK: the host says what the feet stand on - the down probe keeps the bucket it struck, a boat\'s or a sea ship\'s hull bucket (csaSyncColliders\' `csaBoat:` keys) is a deck, and the stride is handed it; the helm\'s own footsteps-off reaches the mod\'s stride too', () => {
  assert.match(WORLD, /const isDeckBucket = \(key\) => typeof key === 'string' && key\.startsWith\('csaBoat:'\);/);
  assert.match(WORLD, /const _down = collider\.raycastHit\(\[player\.pos\[0\], cy, player\.pos\[2\]\], _SURFACE_DOWN, rayDistance \* 2\);/);
  assert.match(WORLD, /meshDist: _down\.dist,/);
  assert.match(WORLD, /surf\.deck = surf\.staticGeometry && isDeckBucket\(_down\.key\);/);
  assert.match(WORLD, /const key = `csaBoat:\$\{id\}:\$\{i\+\+\}`;/, 'the buckets are keyed as the predicate reads them');
  assert.match(WORLD, /deck: !!_surf\.deck, onStaticGeometry: !!_surf\.staticGeometry,/);
  assert.match(WORLD, /paused: _overlayHeld \|\| _seasonHeld \|\| _travelSoundsOff \|\| _csaFootstepsOff, entity: playerEntity,/);
});

// ── SEA-HUNT ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SEA-HUNT: one predicate for "afloat" - a helm, a boat\'s own deck, another player\'s boat, a sea ship\'s deck, the water - read by a bounty\'s trail and a wilderness band; the naval host says whether the player stands aboard', () => {
  assert.match(WORLD, /const playerAfloat = \(\) => !!csaRuntime\?\.isSailing\?\.\(\) \|\| \(playerEntity\.activeEffects \?\? \[\]\)\.some\(\(e\) => isBoatEffectBundle\(e\?\.bundleName\)\)\n\s+\|\| !!csaAboard\.aboard\?\.boat \|\| !!naval\?\.aboard\?\.\(\) \|\| \(walkMode && playerSpawned && !!player\.isPlayerSwimming\);/);
  assert.match(WORLD, /&& !travelOptions\?\.isTravelActive && !\(walkMode && player\.isPlayerSwimming\) && !playerAfloat\(\),/, 'a bounty\'s trail and pack');
  assert.match(WORLD, /const aboard = playerAfloat\(\);/, 'a wilderness band\'s chase');
  assert.match(src('src/scenes/naval/navalHost.js'), /aboard: \(\) => aboardShip\(\),/);
});

test('SEA-HUNT: the naval host\'s aboard - at the helm aboard, off every ship not (the same law SEA-PEACE reads)', async () => {
  const helm = await sea({ hull: 2 });
  assert.equal(helm.host.aboard(), true, 'at the helm');
  const foot = await sea({ hull: null });
  assert.equal(foot.host.aboard(), false, 'on foot, off every ship');
});

// ── GUN-HOLD ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUN-HOLD: Activate while the guns are laid holds fire - the aim put down, "Hold fire." said, the release then fires nothing and the guns stay loaded; with nothing laid it is not the hold\'s (mutants: the hold ignored, the release still firing)', async () => {
  const h = await sea({ hull: 2 });
  assert.equal(h.host.holdFire(), false, 'nothing laid: Activate is the helm\'s own');
  assert.equal(h.host.attackInput(true), true, 'laid');
  h.host.frame(0.1);
  assert.equal(h.host.aiming, true);
  assert.equal(h.host.holdFire(), true);
  assert.equal(h.host.aiming, false);
  assert.ok(h.log.say.includes('Hold fire.'));
  const before = h.host._shots.inFlight;
  h.host.attackInput(false);
  assert.equal(h.host._shots.inFlight, before, 'the release owes nothing');
  assert.ok(h.host.hudModel().batteries.every((b) => b.gun === 'barrel' || b.ready), 'every battery still loaded');
  // laid again, the release fires as ever
  h.host.attackInput(true);
  h.host.frame(0.1);
  h.host.attackInput(false);
  assert.ok(h.host._shots.inFlight > before, 'and a broadside when it is let go');
});

test('GUN-HOLD: the world gives Activate to the hold first - before the click casts a readied spell or the helm\'s ladder boards, heaves to or opens the yard; the attack\'s own order is the cast law\'s (a readied spell takes the press, NAV-H\'s)', () => {
  // PIN MOVED (AUDIT NAV2 F31): Interact - the readout's "E: hold fire" - holds it too, read before the hold
  // PIN MOVED (SPELL-HAND): the cast press says it is a cast's own - `interceptAttack(true, { cast: true })` (was:
  // `interceptAttack(true)`); the order did not move. PIN MOVED (AUDIT SPELL-HAND, HOST-SPLIT): the word is CAST_PRESS, imported
  assert.match(WORLD, /const useEdge = !travelView\?\.active && pressed\(latch\.edge, keys, 'Interact'\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const _holdFire = \(_act\.activate \|\| _act\.cast \|\| useEdge\) && !!naval\?\.aiming && naval\.holdFire\(\);\n\s+if \(_act\.cast && !_holdFire && !gatherHost\?\.acting\(\)\) magic\.interceptAttack\(true, CAST_PRESS\);/);
  // PIN MOVED (AUDIT 2026-10-01 part four, CLICK-LIFT): the click an act took is the act's to its release
  assert.match(WORLD, /if \(\(\(_act\.activate && !gatherHost\?\.acting\(\) && !_actClick && !nodeClicked\) \|\| \(useEdge && !nodeTook\)\) && !modes\.transitioning && !_holdFire\) \{/);   // PIN MOVED (the merge with AUDIT 32 H5: a click mid-act is the act's; PROF-MENU: a click a node's list took is the list's)
  assert.match(WORLD, /if \(magic\.interceptAttack\(true\)\) return; if \(naval\?\.attackInput\(true\)\) return; weaponRig\.attackInput\(0, 0, true\);/, 'the mouse: the cast law first, then the guns');
});

test('GUN-HOLD: the readout while the guns are laid names the hold - over any ship in reach to board - and the pad\'s Activate row says "Hold fire"; a wreck\'s way out still comes first', () => {
  const helm = (o = {}) => ({ ship: { name: 'Small Ship', hull: 0.8, sail: 0.5, crew: 0.9, fire: false, wrecked: false, braced: false }, armed: true, aiming: true, aim: null, board: null, boarding: null, target: null, batteries: [], notoriety: { crown: 'Wayrest', value: 0, level: 0 }, ...o });
  const KEYS = { aim: 'RIGHT CLICK', board: 'E', brace: 'C' };
  assert.equal(navalHudText(helm(), KEYS).plate.hint, 'Let go to fire - E: hold fire');
  assert.equal(navalHudText(helm({ board: { name: 'The Red Wake', kind: 'board' } }), KEYS).plate.hint, 'Let go to fire - E: hold fire');
  assert.equal(navalHudText(helm(), KEYS, { touch: true }).plate.hint, 'Lift to fire - Tap: hold fire');
  assert.equal(navalHudText(helm({ aiming: false, board: { name: 'The Red Wake', kind: 'board' } }), KEYS).plate.hint, 'E: board The Red Wake', 'not laid: Activate boards');
  assert.equal(navalHudText(helm({ ship: { name: 'Small Ship', hull: 0.1, sail: 0, crew: 0.2, fire: false, wrecked: true, braced: false } }), KEYS).plate.hint, 'Crippled. Make for port and a shipwright');
  const codes = { aim: 'RT', board: 'A', brace: 'LB' };
  assert.deepEqual(navalPadPrompts(helm({ board: { name: 'The Red Wake', kind: 'board' } }), codes), [[['RT'], 'Let go: fire'], [['LB'], 'Hold: brace'], [['A'], 'Hold fire']]);
  assert.deepEqual(navalPadPrompts(helm({ aiming: false, board: { name: 'The Red Wake', kind: 'board' } }), codes).at(-1), [['A'], 'Board The Red Wake']);
});
