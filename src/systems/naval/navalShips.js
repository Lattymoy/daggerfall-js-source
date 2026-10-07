// @ts-check
// NAV-A (2026-09-28, Mac: "introduce actual sailing ships to the world that players can encounter and pillage") -
// THE SHIPS: what each of Come Sail Away's five hulls carries into a fight, and the classes the Iliac Bay's
// captains sail them as. The port's own numbers - DFU has no cannon, and the mod's hulls none either.
//
// THE GUNS SIT WHERE THE HULLS ARE. Every muzzle below was measured off the hull that carries it: the mod's four off
// the vendored prefabs themselves (the hull's MeshCollider, `vendor/come-sail-away/Models/`, cast at from outside and
// from above at each station - the scratch probe the arc page records), a broadside's guns 0.9 m over the deck they
// are mounted on, along the waist where that deck runs clear, and a hair outside the planking at that height; hull 2's
// off Mac's galleon (world/galleonModel.js GALLEON_BATTERIES - AUDIT GN-G11): each broadside gun in the middle of its
// own port, 1.16 m over her gun deck, its muzzle 0.09 m outside her planking. A bow chaser on the forecastle, a stern
// gun over the transom. The numbers are in the boat ROOT's frame (Unity's: +x starboard, +y up, +z the
// bow), where SpawnBoat stands the hull - the root sits on the waterline. The port side is the starboard side
// mirrored (x negated); `batteryMuzzles` makes it.
//
// Black Flag's arsenal, on a Daggerfall deck:
//   long   - the broadside's long guns: laid square to the hull, the ship the traverse
//   swivel - a small boat's swivel guns: quick, light, short
//   heavy  - a galley's great bow guns, fired over the stem
//   chain  - the bow chasers loaded with chain: they cut rigging (sails) more than they hole a hull
//   barrel - fire barrels rolled off the stern: they float, and burst on the first hull that meets them
// Which the player fires is chosen by where they look (systems/naval/navalGunnery.js): the side a broadside, the
// bow the chasers, astern the barrels.
//
// SHIP CLASSES are the sea's captains: a class is a hull, a faction (pirates, merchantmen, a kingdom's navy), its
// own durability and crew, its speed and its handiness, and what its hold is worth. `classFor` picks one the way the
// encounter director asks (systems/naval/navalDirector.js): by faction and the player's level.
//
// NAMES are seeded - a ship's seed names it the same on every client in a room. A captain's name is DFU's own
// NameHelper.FullName over the region's bank (characters/nameHelper.js, verbatim), drawn on the seed's own DFRandom
// stream and the global stream put back after, so naming a ship moves no other system's rolls.

import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { fullName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { mulberry32 } from '../../combat/bloodArt.js';

/** Come Sail Away's hull indices (systems/comeSailAwayBoat.js HULL_NAMES). */
export const HULL = Object.freeze({ Rowboat: 0, LargeBoat: 1, SmallShip: 2, LargeGalley: 3, Carrack: 4 });

/**
 * The gun kinds. `speed` the muzzle speed (m/s); `minEl`/`maxEl` the carriage's elevation (degrees); `reload`
 * seconds with a full crew; `yawSpread`/`pitchSpread` degrees; `radius` the ball's (m, for the hit's sweep and the
 * draw); `hull`/`sail`/`crew` the damage one ball does to each. A barrel has no flight: it floats.
 *
 * AUDIT NAV1 (2026-09-29, the guns): the carriages DEPRESS as a gun deck's quoins let them - a long gun to -8, the
 * great and chase guns to -6, a swivel on its crutch to -10 - so a sloop come alongside to grapple is under a
 * broadside's fire and a Large Boat under a galley's (the audit measured none of them hit inside 25-60 m at -2 and
 * -3); and the galley's great guns are HEAVY - a fuller charge, 68 m/s, the carriage to 15 - so they outrange the
 * long guns (263 m against 211 from their decks) as a great gun should, where they fell 50 m short of them.
 */
export const GUNS = Object.freeze({
  long: Object.freeze({ speed: 62, minEl: -8, maxEl: 15, reload: 9, yawSpread: 1.6, pitchSpread: 0.9, radius: 0.11, hull: 14, sail: 3, crew: 1 }),
  swivel: Object.freeze({ speed: 55, minEl: -10, maxEl: 14, reload: 4, yawSpread: 1.3, pitchSpread: 0.8, radius: 0.07, hull: 5, sail: 2, crew: 2 }),
  heavy: Object.freeze({ speed: 68, minEl: -6, maxEl: 15, reload: 12, yawSpread: 2.0, pitchSpread: 1.0, radius: 0.15, hull: 30, sail: 4, crew: 2 }),
  chain: Object.freeze({ speed: 58, minEl: -6, maxEl: 16, reload: 7, yawSpread: 2.2, pitchSpread: 1.2, radius: 0.13, hull: 3, sail: 16, crew: 1 }),
  barrel: Object.freeze({ speed: 0, minEl: 0, maxEl: 0, reload: 6, yawSpread: 0, pitchSpread: 0, radius: 0.5, hull: 45, sail: 6, crew: 3 }),
});

/** A fire barrel's life afloat (s), the radius a hull sets it off within (m), and a burn it leaves (s). */
export const BARREL = Object.freeze({ life: 90, fuse: 7, burn: 12, burnPerSecond: 2.5, stock: 4 });

/** The four batteries, and the local direction each fires along. */
export const SIDES = Object.freeze(['starboard', 'port', 'bow', 'stern']);
export const SIDE_DIR = Object.freeze({ starboard: Object.freeze([1, 0, 0]), port: Object.freeze([-1, 0, 0]), bow: Object.freeze([0, 0, 1]), stern: Object.freeze([0, 0, -1]) });

/**
 * Each hull's fighting build, measured off its prefab. `broadside` lists the STARBOARD muzzles (the port side is
 * their mirror); `bow` and `stern` their own. `hullHp`, `sailHp` and `crew` are what the PLAYER's boat of that hull
 * stands with; a class scales them. `deck` is the height boarders stand on, `beam` the half beam at it, `ram` a bow
 * that rams (the galley's). AUDIT NAV1 (2026-09-29): `bowZ`, `aftZ` and `halfWidth` are the hull's own MeshCollider
 * bounds in the root's frame (its stem, its stern and its widest half beam - measured off the vendored prefabs
 * through the real pool): what a captain steers clear of, the length its turning circle is scaled by, and the stem a
 * ram strikes with; `keel` and `top` the same box's floor and roof - what a gun must lay between to strike her.
 * `rig` is her canvas and spars as boxes (`[min, max]` in the root's frame, as she stands at rest): the mod's hulls'
 * over that roof, their masts and yards measured off the same prefabs (their rigid meshes - a skinned sail's
 * bind-pose box is not where it hangs), the canvas hung from each yard - the galley's one square sail across her at the
 * mast, the Carrack's two square courses across and her lateen mizzen along; the Small Ship's (Mac's galleon, below)
 * her five sails as each hangs set, wherever it hangs (AUDIT GN-R5/G9). A box may say how it stands: `boom` (the k-th
 * of the boat's Booms, Come Sail Away's walk order) turns it about its `pivot` (that boom's mast's axis) by the boom's
 * own rotation, so it goes where the trim swings its canvas; `obb` is the box itself where it lies askew (`c` its middle,
 * `h` its half sizes along its own axes, the root's pitched `pitch` degrees about x), `[min, max]` then its bounds.
 * scenes/navalHost.js rigBoxesOf stands each in the world; a ball through one tears canvas and flies on
 * (systems/naval/navalShots.js). The rowboat carries none; the Large Galley's yard is 53 m end to end, but a box that
 * wide would be mostly air, so hers stops at the canvas's own 50. AUDIT NAV2 F28: `sailWay` is the prefab's sail
 * acceleration modifier (Come Sail Away's modifierMoveAccelerationSail) - the rate her way comes and goes under sail
 * and off it, the player's and the captains' alike (navalAI.js helm).
 *
 * TOUGHER-SHIPS (2026-10-03, Mac: "buff health of ships"): every ship stands SHIP_TOUGHNESS times the punishment she
 * first did - her hull and canvas that many times the points she was built with (`tough`), and her crew that many times
 * the balls and the fire to thin (navalDamage.js shotDamage and FIRE_CREW_S: a ball's men are its gun's over the
 * toughness, on the ball's own roll) - the player's boats and the captains' classes alike (a class scales its hull's
 * build). So a fight lasts that much longer before a ship strikes, sinks or is wrecked, and every duel's odds are what
 * they were (navalAI.js strikeTime: her hull and her men both). The yard's prices and a store's work went down with it
 * (navalDamage.js REPAIR_PRICE, navalYard.js STORE_POINTS), so making her whole costs what it did; a save from before
 * reads her hurts as the share of her old whole they were (navalHost.js savedHurts).
 */
export const SHIP_TOUGHNESS = 1.6;
/**
 * CREW-HOLD (2026-10-06, Mac: "Crew depletes too fast"): A PLAYER'S CREW STANDS TWICE WHAT A CAPTAIN'S DOES. The men a
 * blow takes are its men over her crew's toughness (navalDamage.js ballMen), and at SHIP_TOUGHNESS a player's crew went
 * before her hull under every gun - measured on navalAI.js strikeTime's own terms, a galleon's 24 men in 146 s of a
 * Pirate Brigantine's fire against 176 s for her hull, a Carrack's 30 in 182 s against 234 (1.21 and 1.29 times
 * faster), and a swivel boat's 2 men a ball (a Pirate Sloop's) emptied a galleon in 67 s that would need 451 s to sink
 * her. At twice it every ship of the line's fire leaves her crew standing when her hull is gone - a galleon's men in
 * 292 s of a brigantine's fire against 176 for her hull, a Carrack's 365 against 234; a swivel boat's balls still thin
 * them first (a galleon's in 134 s), its trade, at half the pace. A player's own ship
 * alone: every ball, fire, ram and serpent's blow on her (navalHost.js landHit, the galley's ram, serpentStrike; her
 * fire's `wound`). The captains' crews keep SHIP_TOUGHNESS, so a captain's ship strikes by her men as she did.
 */
export const PLAYER_CREW_TOUGHNESS = 2 * SHIP_TOUGHNESS;
/** A hull's points over its first build's, toughened. */
const tough = (hp) => Math.round(hp * SHIP_TOUGHNESS);
/** A hull's rig boxes, frozen (a box's `boom`, `pivot`, `obb` or `sail` riding on its pair). AUDIT GN2-RG3: `sail` the
 *  k-th of the boat's Sails (Come Sail Away's walk order) whose canvas the box holds - rigBoxesOf stands it only while
 *  that sail is shown and set; a box with none (the mod's hulls' still boxes) stands whatever their sails do. */
function rigOf(...boxes) { return Object.freeze(boxes.map((b) => Object.freeze(Object.assign(b.slice(0, 2).map((p) => Object.freeze([...p])), b[2] ?? {})))); }
/** AUDIT GN-R5: a box on the `k`-th boom, turned with it about `pivot` (`[min, max]` where it stands with the boom home),
 *  holding the `sail`-th sail's canvas. */
const onBoom = (k, pivot, min, max, sail) => [min, max, { boom: k, pivot: Object.freeze(pivot), sail }];
/** AUDIT GN-R5: a box askew - middle `c`, half sizes `h` along its own axes, the root's turned `pitch` degrees about x
 *  (Unity's turn: its y to (0, cos, sin), its z to (0, -sin, cos)) - with its bounds as its `[min, max]`. */
function pitched(c, h, pitch, sail) {
  const a = pitch * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = [c[0] + sx * h[0], c[1] + sy * h[1] * cs - sz * h[2] * sn, c[2] + sy * h[1] * sn + sz * h[2] * cs];
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  }
  return [min, max, { obb: Object.freeze({ c: Object.freeze(c), h: Object.freeze(h), pitch }), sail }];
}

export const HULL_BUILDS = Object.freeze([
  Object.freeze({   // 0 Rowboat - no guns; a rowboat is shot at, never fights
    hull: 0, gun: null, broadside: Object.freeze([]), bow: null, stern: null,
    hullHp: tough(60), sailHp: tough(0), crew: 0, deck: 0.1, beam: 1.0, ram: false, bowZ: 2.94, aftZ: -2.14, halfWidth: 1.08, keel: -0.23, top: 0.78, sailWay: 1,
    rig: Object.freeze([]),
  }),
  Object.freeze({   // 1 Large Boat - swivels on the gunwale (1.2 m), three a side and one in the bow
    hull: 1, gun: 'swivel',
    broadside: Object.freeze([[1.8, 1.3, -2.3], [2.05, 1.3, 0.3], [1.8, 1.3, 2.3]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'swivel', muzzles: Object.freeze([Object.freeze([0, 1.6, 5.9])]) }),
    stern: null,
    hullHp: tough(150), sailHp: tough(60), crew: 0, deck: 0.1, beam: 1.9, ram: false, bowZ: 6.51, aftZ: -5.99, halfWidth: 2.15, keel: -0.64, top: 1.59, sailWay: 1,
    rig: rigOf([[-1.7, 1.59, -5.44], [1.7, 9.27, 6.71]]),
  }),
  // GALLEON (2026-10-01, Mac: "ensuring cannon fire shoots from the cannon holes properly"): hull 2 is Mac's galleon now
  // (world/galleonModel.js) and every number here is hers, off her own model (test/galleon_model.test.js pins each to
  // it): a gun at each of her ten gunports, its muzzle a hair outside her planking at the port's middle - the ports
  // 1.56 to 2.93 m over the sea, her gun deck at 1.0829 - so a broadside leaves her through the holes it is fired from;
  // two chasers on swivels over her bow rail; the barrels over her stern under the castle. Her box is her hull's and
  // her castle's MeshCollider's bounds (GALLEON-2: her keel 4.64 m down on Mac's second export's deeper V). AUDIT GN-R5/
  // G9: her rig is each of her five sails as it hangs set in any wind (world/galleonRig.js's own canvas) - a square sail
  // with its yard and her gaff sail with its gaff on their booms, turning with them as the trim does (the boxes stood
  // still: at the auto-trim's 30 degrees a quarter of the fore topsail's canvas, a third of the main topsail's and 94% of
  // the gaff sail's stood outside every one, and all of the fore course's at any trim), the jib in three askew along its
  // luff, its leech and its foot (one box, from her roof to 27.9, held half of it) - each box three quarters and more
  // canvas across its face. Where her canvas is inside her hull's box (the fore course but its outer clews, the gaff
  // sail's foot, the jib aft of her stem and under her roof) a ball strikes her hull first; out of it (the course's outer
  // clews, the topsails, the gaff sail over her roof or swung out, the jib over her bowsprit) it tears.
  Object.freeze({   // 2 Small Ship - five ports a side on her gun deck (1.0829), the guns' axis at the ports' middle (2.24)
    hull: 2, gun: 'long',
    broadside: Object.freeze([[5.949, 2.2435, -7.595], [5.949, 2.2435, -4.417], [5.949, 2.2435, -0.714], [5.949, 2.2435, 2.8105], [5.949, 2.2435, 6.5135]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'chain', muzzles: Object.freeze([Object.freeze([-1.15, 7.45, 19.15]), Object.freeze([1.15, 7.45, 19.15])]) }),
    stern: Object.freeze({ gun: 'barrel', muzzles: Object.freeze([Object.freeze([0, 5.4, -20.6])]) }),
    hullHp: tough(420), sailHp: tough(160), crew: 24, deck: 6.2, beam: 5.4, ram: false, bowZ: 21.93, aftZ: -19.91, halfWidth: 5.86, keel: -4.64, top: 12.3, sailWay: 1,
    rig: rigOf(   // the fore mast's canvas over her roof, the main topsail and the gaff first, as they stood; then the rest
      onBoom(1, [0, 16, 8.772], [-5, 12.42, 9.34], [5, 16.17, 10.33], 1),           // the fore topsail and its yard
      onBoom(2, [0, 17.65, -0.191], [-5.2, 13.27, 0.42], [5.2, 17.82, 1.44], 2),    // the main topsail and its yard
      onBoom(3, [0, 7.75, -0.191], [-1.07, 8.07, -8.2], [1.07, 15.03, -0.79], 3),   // the gaff sail and its gaff
      onBoom(0, [0, 12.2, 8.772], [-6.3, 7.67, 9.34], [6.3, 12.37, 11.45], 0),       // the fore course and its yard
      pitched([0, 11.92, 17.932], [1.06, 1.06, 9.37], 22.79, 4),                     // the jib along its luff,
      pitched([0, 12.375, 15.832], [1.03, 0.96, 7.35], 40.93, 4),                    // its leech
      pitched([0, 9.286, 22.488], [1.06, 0.91, 4.54], -10.23, 4),                    // and its foot
    ),
  }),
  Object.freeze({   // 3 Large Galley - four long guns a side on the upper deck (10.25), three heavy guns over the stem, a ram
    hull: 3, gun: 'long',
    broadside: Object.freeze([[9.3, 11.1, -20], [9.3, 11.1, -8], [9.3, 11.1, 4], [9.3, 11.1, 16]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'heavy', muzzles: Object.freeze([Object.freeze([-1.6, 8.3, 45.0]), Object.freeze([0, 8.3, 46.0]), Object.freeze([1.6, 8.3, 45.0])]) }),
    stern: null,
    hullHp: tough(520), sailHp: tough(90), crew: 60, deck: 10.25, beam: 8.8, ram: true, bowZ: 51.27, aftZ: -41.89, halfWidth: 11.17, keel: -2.46, top: 14.09, sailWay: 0.5,
    rig: rigOf([[-25, 17, 12.5], [25, 36.9, 17]]),
  }),
  // SHIPS-2 (2026-10-07, Mac: "implement both of these new ship placement models ... ensure it matches the love we gave
  // the other new ship model"): hull 4 is Mac's carrack now (world/carrackModel.js) and every number here is hers, off
  // her own model (test/ships2_carrack.test.js pins each to it), as hull 2's are the galleon's: a gun at each of her ten
  // gunports, its muzzle 9 cm outside her planking at the port's middle - her ports 3.07 to 4.06 m over the sea, her guns
  // on platforms 0.45 m over her gun deck (1.9576) so their axis is the ports' - two chasers on swivels on her bow's
  // deck, the barrels over her quarter rail at her stern. Her box is her hull's, her houses' and her quarter rail's
  // MeshCollider's bounds (her stem's head, her stern rail, her knuckle's half beam, her keel, the aft house's ridge);
  // her deck her main deck, her half beam at it inside her rail's cap. Her rig is each of her five sails as it hangs
  // set in any wind, each on its boom about its mast's axis (the spritsail's about its slings under her bowsprit) - her
  // lateen in two (its canvas a sloping quad: its foot's band the length of it, its peak's over her middle house),
  // every box three quarters and more canvas across its face (test/ships2_carrack.test.js). Her hull points, canvas
  // points and crew are the Carrack's as the mod built it, and her handling with them (her Modifiers are its own).
  Object.freeze({   // 4 Carrack - five ports a side on her gun deck, the guns' axis at the ports' middle (3.5634)
    hull: 4, gun: 'long',
    broadside: Object.freeze([[6.785, 3.5634, -9.2435], [6.785, 3.5634, -5.6075], [6.785, 3.5634, -1.3762], [6.785, 3.5634, 2.6505], [6.785, 3.5634, 6.8825]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'chain', muzzles: Object.freeze([Object.freeze([-1.15, 9.95, 20.45]), Object.freeze([1.15, 9.95, 20.45])]) }),
    stern: Object.freeze({ gun: 'barrel', muzzles: Object.freeze([Object.freeze([0, 8.9, -23.6])]) }),
    hullHp: tough(560), sailHp: tough(220), crew: 30, deck: 7.81, beam: 6.0, ram: false, bowZ: 26.14, aftZ: -23.31, halfWidth: 6.7, keel: -4.59, top: 11.55, sailWay: 1,
    rig: rigOf(
      onBoom(0, [0, 9.35, 28.4], [-3.5, 6.17, 28.16], [3.5, 9.52, 29.3], 0),        // the spritsail and its yard
      onBoom(1, [0, 15.5, 17.2475], [-5.7, 10.77, 17.33], [5.7, 15.67, 19.78], 1),  // the fore course and its yard
      onBoom(2, [0, 15.2, 8.9293], [-5.6, 11.27, 9.01], [5.6, 15.37, 11.49], 2),    // the main course and its yard
      onBoom(3, [0, 18.9, 8.9293], [-4.7, 15.47, 9.01], [4.7, 19.07, 10.46], 3),    // the main topsail and its yard
      onBoom(4, [0, 15.54, -1.279], [-1.95, 12.4, -9.76], [0.21, 16.0, 2.28], 4),   // the lateen along its foot,
      onBoom(4, [0, 15.54, -1.279], [-1.73, 16.0, -10.08], [0.03, 20.91, -3.87], 4), // and its peak
    ),
  }),
]);

/** SHIPS-2: the mod's own Carrack's build - seven long guns a side on its main deck (3.64), chasers under its
 *  forecastle, barrels astern - which hull 4 is again when the new carrack's model will not load or build
 *  (systems/comeSailAwayModels.js falls back to the mod's own prefab, never no ship: AUDIT GN-G4's law). */
export const MOD_CARRACK_BUILD = Object.freeze({
  hull: 4, gun: 'long',
  broadside: Object.freeze([[6.3, 4.5, -16], [7.0, 4.5, -12], [7.7, 4.5, -8], [7.9, 4.5, -4.2], [7.4, 4.5, 0], [7.1, 4.5, 4.2], [5.8, 4.5, 8.4]].map(Object.freeze)),
  bow: Object.freeze({ gun: 'chain', muzzles: Object.freeze([Object.freeze([-1.2, 10.1, 19.5]), Object.freeze([1.2, 10.1, 19.5])]) }),
  stern: Object.freeze({ gun: 'barrel', muzzles: Object.freeze([Object.freeze([0, 7.6, -27.5])]) }),
  hullHp: tough(560), sailHp: tough(220), crew: 30, deck: 3.64, beam: 7.4, ram: false, bowZ: 23.71, aftZ: -28.24, halfWidth: 8.43, keel: -3.35, top: 11.82, sailWay: 1,
  rig: rigOf([[-13.8, 20, 14], [13.8, 39.6, 18.5]], [[-10.5, 26, -5], [10.5, 45.3, -1.5]], [[-3, 17, -31], [3, 39.7, -10.7]]),
});

/** AUDIT GN-G4: the mod's own Small Ship's build - the galleon Come Sail Away shipped, six long guns a side at her own
 *  ports - which hull 2 is again when the new galleon's model will not load or build (systems/comeSailAwayModels.js
 *  falls back to the mod's own prefab, never no ship): her guns, box, deck and rig must be that ship's, or she fires
 *  from 0.24-1.29 m inside her own planking and her berths and fires stand 2 m off. */
export const MOD_SMALL_SHIP_BUILD = Object.freeze({
  hull: 2, gun: 'long',
  broadside: Object.freeze([[7.2, 4.5, -12], [7.8, 4.5, -8], [8.1, 4.5, -4.5], [7.8, 4.5, -1], [7.4, 4.5, 2.5], [7.0, 4.5, 6]].map(Object.freeze)),
  bow: Object.freeze({ gun: 'chain', muzzles: Object.freeze([Object.freeze([-1.4, 7.6, 16.0]), Object.freeze([1.4, 7.6, 16.0])]) }),
  stern: Object.freeze({ gun: 'barrel', muzzles: Object.freeze([Object.freeze([0, 7.6, -23.0])]) }),
  hullHp: tough(420), sailHp: tough(160), crew: 24, deck: 3.64, beam: 7.4, ram: false, bowZ: 19.88, aftZ: -24.25, halfWidth: 8.43, keel: -3.35, top: 10.92, sailWay: 1,
  rig: rigOf([[-3.5, 10.92, -20.1], [3.5, 34, 26]]),
});
/** SHIPS-2: THE MOD'S OWN BUILD OF EACH HULL A SHIP OF THE PORT'S STANDS IN FOR - what that hull is while its own model
 *  does not stand (the galleon's, the carrack's, the large boat's: systems/comeSailAwayModels.js PORT_SHIPS). */
export const MOD_BUILDS = Object.freeze({ 2: MOD_SMALL_SHIP_BUILD, 4: MOD_CARRACK_BUILD });
/** Whether each such hull stands as the port's ship (true until the models say otherwise - the pool sets it as they load). */
const standing = { 2: true, 4: true };
/** AUDIT GN-G4: the models' answer for a hull - the port's ship over it (true) or the mod's own (false). AUDIT GN2-PF2:
 *  each switch a new `buildsStamp` - what is reckoned off the builds and kept (navalAI.js layMin, hitShare) is kept for one. */
let stamp = 0;
export function setShipStanding(hull, on) { if (standing[hull] !== !!on) stamp++; standing[hull] = !!on; }
/** AUDIT GN-G4: hull 2's - the new galleon over it, or the mod's own galleon. */
export function setGalleonStanding(on) { setShipStanding(2, on); }
export const buildsStamp = () => stamp;
/** A hull's build, or the rowboat's for anything unknown - a hull the port's ship stands in for the mod's own build's
 *  while its model does not stand (AUDIT GN-G4). */
export const hullBuild = (hull) => (MOD_BUILDS[hull] && !standing[hull] ? MOD_BUILDS[hull] : HULL_BUILDS[hull] ?? HULL_BUILDS[0]);
/** TOUGHER-SHIPS: the timbers and canvas a hull stood with before it was toughened - what a save from before measured
 *  her hurts against. */
export function firstBuildOf(hull) {
  const b = hullBuild(hull);
  return { hullHp: Math.round(b.hullHp / SHIP_TOUGHNESS), sailHp: Math.round(b.sailHp / SHIP_TOUGHNESS) };
}

/** A battery's muzzles in the root's frame, and its gun kind; null when the hull has none on that side. */
export function batteryOf(hull, side) {
  const b = hullBuild(hull);
  if (side === 'starboard' || side === 'port') {
    if (!b.gun || !b.broadside.length) return null;
    const s = side === 'port' ? -1 : 1;
    return { side, gun: b.gun, muzzles: b.broadside.map((m) => [m[0] * s, m[1], m[2]]) };
  }
  const k = side === 'bow' ? b.bow : side === 'stern' ? b.stern : null;
  return k ? { side, gun: k.gun, muzzles: k.muzzles.map((m) => [...m]) } : null;
}
/**
 * GALLEON-WEIGHT (2026-10-06, Mac: "The galleon has less cannons, so it needs a buff to account for that"): A PLAYER'S
 * GALLEON THROWS THE WEIGHT OF SIX GUNS FROM HER FIVE PORTS. Mac's galleon has a gun at each of her ten gunports
 * (GALLEON, HULL_BUILDS) where the galleon Come Sail Away shipped carried six a side (MOD_SMALL_SHIP_BUILD) - a sixth of
 * her broadside went with the model. So each ball of her broadside strikes MOD_SMALL_SHIP_BUILD's count over hers as
 * hard (6/5) - her hull and canvas harm (navalDamage.js shotDamage `weight`), never her men (a ball takes its gun's) -
 * and her broadside lands what the mod's six long guns did (5 x 14 x 6/5 = 84 = 6 x 14). 1 while the mod's own galleon
 * stands in for hers (six guns, hullBuild), and for her chasers and barrels. A PLAYER'S alone - mine (navalHost.js fire)
 * and a peer's (fireFromWord), riding each ball to its hit (navalGunnery.js volleyLaunches, navalShots.js) and the
 * captains' reckoning of her fire (navalAI.js strikeTime, a player's FighterMeasure): the captains' galleons - the
 * Pirate Brigantine, the Merchant Galleon, the Navy Cutter - keep the broadside every tuned duel was measured with
 * (AUDIT NAV2 F25, Mac's bar). SHIPS-2: and a player's carrack the weight of the mod's carrack's seven from her five
 * ports (MOD_CARRACK_BUILD's count over hers, 7/5) - every hull a ship of the port's stands in for throws its mod's
 * broadside (MOD_BUILDS), and 1 while the mod's own stands.
 */
export const playerBatteryWeight = (hull, side) => (MOD_BUILDS[hull] && (side === 'starboard' || side === 'port')
  ? MOD_BUILDS[hull].broadside.length / Math.max(1, hullBuild(hull).broadside.length) : 1);
/** Every battery a hull carries. */
export const batteriesOf = (hull) => SIDES.map((s) => batteryOf(hull, s)).filter(Boolean);

// ── factions and classes ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The three kinds of captain. `hostile` - fights on sight; `lawful` - boarding or sinking one is piracy (DFU's own
 * crime, `court.js` CRIMES.Piracy) in the waters' region; `flees` - runs once hurt rather than fights it out.
 * `flag` the colour the pennant flies (the port's; FlagMaterial's orange is the player's own boats).
 */
export const NAVAL_FACTIONS = Object.freeze({
  pirate: Object.freeze({ id: 'pirate', title: 'Pirates', hostile: true, lawful: false, flees: false, flag: Object.freeze([0.1, 0.09, 0.08]) }),
  merchant: Object.freeze({ id: 'merchant', title: 'Merchantman', hostile: false, lawful: true, flees: true, flag: Object.freeze([0.92, 0.82, 0.3]) }),
  navy: Object.freeze({ id: 'navy', title: 'Navy', hostile: false, lawful: true, flees: false, flag: Object.freeze([0.62, 0.1, 0.09]) }),
});
export const FACTION_IDS = Object.freeze(Object.keys(NAVAL_FACTIONS));

/**
 * The classes. `hullHp`/`sailHp`/`crew` scale the hull's own build; `speed` is the best way it makes with the wind
 * on the quarter at the rated wind (m/s; navalAI.js WIND_RATED - AUDIT NAV1 set it off the player's own hulls at
 * their best point of sail on Come Sail Away's runtime: a Small Ship 8.96 m/s, a Large Galley 6.75, a Large Boat
 * 4.5 - a pirate a touch under the player, a merchant slower, a navy cutter the swiftest hull at sea: they catch a
 * boat beating to windward or rowing and lose one running free), `turn` the most degrees a second she turns (her
 * steerage bounds it at way - navalAI.js maxTurnRate, HELM-WAY), `skill` the gunners' (0..1: the scatter halved at 1, and how
 * well they lead), `range` how close it likes to fight (m), `cargo` the hold's worth (1-4, navalPlunder.js),
 * `minLevel` the player's level it first sails against, `weight` how often among its faction, `boarders` the muster a
 * boarding meets, `tactic` how it fights ('broadside', or a galley's 'bow' - its great guns over the stem). A flagship
 * carries a named captain the quest makes its boss.
 */
export const SHIP_CLASSES = Object.freeze([
  cls('pirateSloop', 'pirate', HULL.LargeBoat, 'Pirate Sloop', { hullHp: 1.1, sailHp: 1, crew: 10, speed: 4.6, turn: 16, skill: 0.45, range: 55, cargo: 1, minLevel: 1, weight: 5, boarders: 8 }),
  cls('pirateBrig', 'pirate', HULL.SmallShip, 'Pirate Brigantine', { hullHp: 0.9, sailHp: 0.9, crew: 22, speed: 7.6, turn: 9, skill: 0.55, range: 95, cargo: 2, minLevel: 4, weight: 4, boarders: 13 }),
  cls('pirateGalley', 'pirate', HULL.LargeGalley, 'Corsair Galley', { hullHp: 0.85, sailHp: 1, crew: 40, speed: 6.6, turn: 8, skill: 0.5, range: 80, cargo: 2, minLevel: 7, weight: 2, boarders: 13, tactic: 'bow' }),
  cls('pirateFlagship', 'pirate', HULL.Carrack, 'Pirate Flagship', { hullHp: 1.15, sailHp: 1, crew: 34, speed: 6.4, turn: 6, skill: 0.7, range: 110, cargo: 4, minLevel: 9, weight: 1, boarders: 20, flagship: true }),
  cls('merchantCoaster', 'merchant', HULL.LargeBoat, 'Coasting Trader', { hullHp: 0.9, sailHp: 1, crew: 5, speed: 4.0, turn: 13, skill: 0.25, range: 60, cargo: 1, minLevel: 1, weight: 5, boarders: 5 }),
  cls('merchantGalleon', 'merchant', HULL.SmallShip, 'Merchant Galleon', { hullHp: 0.8, sailHp: 0.9, crew: 14, speed: 6.5, turn: 8, skill: 0.3, range: 110, cargo: 3, minLevel: 3, weight: 3, boarders: 9 }),
  cls('merchantCarrack', 'merchant', HULL.Carrack, 'Merchant Carrack', { hullHp: 0.9, sailHp: 0.9, crew: 18, speed: 5.4, turn: 5, skill: 0.3, range: 120, cargo: 4, minLevel: 5, weight: 2, boarders: 11 }),
  cls('navyCutter', 'navy', HULL.SmallShip, 'Navy Cutter', { hullHp: 1, sailHp: 1, crew: 26, speed: 8.0, turn: 10, skill: 0.75, range: 90, cargo: 2, minLevel: 1, weight: 3, boarders: 14 }),
  cls('navyGalley', 'navy', HULL.LargeGalley, 'War Galley', { hullHp: 1, sailHp: 1, crew: 60, speed: 6.8, turn: 9, skill: 0.7, range: 70, cargo: 2, minLevel: 6, weight: 2, boarders: 18, tactic: 'bow' }),
]);

function cls(id, faction, hull, title, o) {
  const b = hullBuild(hull);
  return Object.freeze({
    id, faction, hull, title,
    hullHp: Math.round(b.hullHp * o.hullHp), sailHp: Math.round(b.sailHp * o.sailHp), crew: o.crew,
    speed: o.speed, turn: o.turn, skill: o.skill, range: o.range, cargo: o.cargo, minLevel: o.minLevel,
    weight: o.weight, boarders: o.boarders, flagship: !!o.flagship, tactic: o.tactic ?? 'broadside',
  });
}
export const classById = (id) => SHIP_CLASSES.find((c) => c.id === id) ?? null;

/**
 * The class a spawn sails, by faction and the player's level: every class of the faction the level has reached,
 * weighed by `weight` - the draw `r` in [0, 1). A level below every class's still gets the faction's first.
 */
export function classFor(faction, level, r) {
  const pool = SHIP_CLASSES.filter((c) => c.faction === faction && c.minLevel <= Math.max(1, level | 0));
  const list = pool.length ? pool : SHIP_CLASSES.filter((c) => c.faction === faction).slice(0, 1);
  const total = list.reduce((s, c) => s + c.weight, 0);
  let x = Math.max(0, Math.min(0.999999, r)) * total;
  for (const c of list) { if ((x -= c.weight) < 0) return c; }
  return list[list.length - 1] ?? null;
}

// ── names ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The three great crowns of the Bay, and whose waters (Daggerfall's 3E 405 - Gothryd, Eadwyre, Akorithi). */
export const CROWNS = Object.freeze([
  Object.freeze({ region: 17, name: 'Daggerfall', ruler: 'Gothryd', ships: Object.freeze(["Gothryd's Resolve", 'King Lysandus', "Mynisera's Grace", 'Daggerfall Vigilant', 'Stalwart', 'Breton Crown']) }),
  Object.freeze({ region: 23, name: 'Wayrest', ruler: 'Eadwyre', ships: Object.freeze(["Eadwyre's Vigil", 'Queen Barenziah', 'Wayrest Sentinel', 'Illessan Guard', 'Loyalty', 'Iliac Warden']) }),
  Object.freeze({ region: 20, name: 'Sentinel', ruler: 'Akorithi', ships: Object.freeze(["Akorithi's Justice", 'Prince Lhotun', 'Sentinel Sun', 'Desert Falcon', 'Crowned Serpent', 'Hammerfell Pride']) }),
]);

export const PIRATE_NAMES = Object.freeze([
  'Black Kraken', "Dreugh's Maw", 'Sea Hag', 'Red Wake', 'Gallows Wind', "Dagon's Tooth", 'Rotting Oar',
  'Salt Reaver', 'Stormcrow', "Hircine's Grin", 'Bloody Gull', 'Drowned King', 'Iliac Wraith', 'Slaughterfish',
  'Scourge of Betony', 'Night Tide', 'Widowmaker', 'Crimson Gannet',
]);
export const MERCHANT_NAMES = Object.freeze([
  'Wayrest Trader', 'Pride of Camlorn', 'Gilded Cog', 'Daggerfall Merchant', 'Abibon-Gora Spice', 'Bountiful',
  'Lady of Anticlere', 'Northmoor Wool', 'Honest Scale', 'Orsinium Iron', 'Bay Pilgrim', 'Glenpoint Lass',
  'Menevian Rose', 'Kambria Barley', 'Satakalaam Silk', 'Fair Winds of Tulune',
]);

// SHIP-NAMES (2026-10-02, Mac: "Enemy and Friendly vessels need a large assortment of generated names") - every
// ship's name is drawn off her seed from a trade's own forms, word banks of the Iliac Bay's crowns, divines, princes,
// ports and goods: a crown's ship by her crown's royals and martial words (Wayrest's are not Sentinel's), a merchantman
// by her port, her cargo and her fortune, a pirate by her dark beasts, her Daedric patron and her deeds - thousands a
// trade, where each list held sixteen or eighteen (and a crown's six). The lists above are among the forms still. On its
// own stream (SHIP_NAME_SALT), so her captain - drawn after one draw of the ship's own - is the captain she always had, and
// a peer's copy, named off the same seed and region, is the same ship.
export const SHIP_NAME_SALT = 0x4e414d45;   // "NAME"
/** Each crown's own words: its royals, past and present (a ship "Gothryd's Resolve"), and its waters' places. */
export const CROWN_LORE = Object.freeze({
  Daggerfall: Object.freeze({ royals: Object.freeze(['Gothryd', 'Lysandus', 'Mynisera', 'Aubk-i', 'Nulfaga', 'Joile']),
    places: Object.freeze(['Daggerfall', 'Glenpoint', 'Kambria', 'Betony', 'Tulune', 'Glenumbra', 'Ilessan Hills', 'Daenia']) }),
  Wayrest: Object.freeze({ royals: Object.freeze(['Eadwyre', 'Barenziah', 'Helseth', 'Elysana', 'Morgiah', 'Emeric']),
    places: Object.freeze(['Wayrest', 'Menevia', 'Gavaudon', 'Anticlere', 'Northmoor', 'Evermor', 'Mournoth', 'Lainlyn']) }),
  Sentinel: Object.freeze({ royals: Object.freeze(['Akorithi', 'Camaron', 'Lhotun', 'Greklith', 'Aubk-i', 'Hunding']),
    places: Object.freeze(['Sentinel', 'Satakalaam', 'Abibon-Gora', 'Antiphyllos', 'Ayasofya', 'Cybiades', 'Bergama', 'Kozanset']) }),
});
export const NAME_WORDS = Object.freeze({
  virtues: Object.freeze(['Resolve', 'Vigil', 'Grace', 'Justice', 'Valor', 'Honor', 'Constancy', 'Fortitude', 'Wrath', 'Shield', 'Lance', 'Sword',
    'Herald', 'Pride', 'Triumph', 'Glory', 'Majesty', 'Defiance', 'Promise', 'Mercy', 'Faith', 'Oath', 'Banner', 'Bulwark', 'Gauntlet', 'Hammer',
    'Torch', 'Sceptre', 'Courage', 'Fury', 'Answer', 'Will', 'Word', 'Reach', 'Watch', 'Ward', 'Claim', 'Right', 'Command', 'Victory']),
  martial: Object.freeze(['Vigilant', 'Defiant', 'Intrepid', 'Invincible', 'Resolute', 'Indomitable', 'Dauntless', 'Valiant', 'Implacable', 'Steadfast',
    'Triumphant', 'Victorious', 'Formidable', 'Relentless', 'Unyielding', 'Gallant', 'Swiftsure', 'Audacious', 'Fearless', 'Glorious', 'Illustrious',
    'Magnificent', 'Majestic', 'Superb', 'Thunderer', 'Vengeance', 'Warden', 'Guardian', 'Avenger', 'Champion', 'Conqueror', 'Crusader', 'Defender',
    'Enforcer', 'Harrier', 'Lancer', 'Protector', 'Ranger', 'Paladin', 'Sovereign']),
  divines: Object.freeze(['Akatosh', 'Arkay', 'Dibella', 'Julianos', 'Kynareth', 'Mara', 'Stendarr', 'Zenithar']),
  favours: Object.freeze(['Wing', 'Shield', 'Mercy', 'Blessing', 'Grace', 'Wisdom', 'Hand', 'Light', 'Truth', 'Breath', 'Gift', 'Promise', 'Justice',
    'Peace', 'Ward', 'Flame', 'Eye', 'Favour', 'Hammer', 'Anvil', 'Lantern', 'Heart']),
  emblems: Object.freeze(['Pride', 'Glory', 'Shield', 'Sword', 'Star', 'Lion', 'Eagle', 'Hawk', 'Rose', 'Lily', 'Crown', 'Heart', 'Hope', 'Rampart', 'Banner',
    'Gryphon', 'Stag', 'Dragon']),
  ports: Object.freeze(['Daggerfall', 'Wayrest', 'Sentinel', 'Camlorn', 'Anticlere', 'Glenpoint', 'Menevia', 'Northmoor', 'Kambria', 'Betony', 'Tulune',
    'Gavaudon', 'Alcaire', 'Lainlyn', 'Daenia', 'Ykalon', 'Dwynnen', 'Urvaius', 'Satakalaam', 'Abibon-Gora', 'Antiphyllos', 'Ayasofya', 'Bergama',
    'Kozanset', 'Myrkwasa', 'Totambu', 'Tigonus', 'Cybiades', 'Bhoriane', 'Phrygias', 'Mournoth', 'Shalgora', 'Ephesus', 'Santaki', 'Pothago',
    'Kairou', 'Koegria', 'Evermor', 'Shornhelm', 'Jehanna', 'Farrun', 'Balfiera', 'Orsinium', 'Glenumbra']),
  callings: Object.freeze(['Trader', 'Merchant', 'Packet', 'Venture', 'Fortune', 'Lass', 'Belle', 'Maid', 'Rose', 'Pride', 'Star', 'Dawn', 'Courier',
    'Carrier', 'Gull', 'Swan', 'Heron', 'Wren', 'Queen', 'Duchess', 'Countess', 'Lady', 'Bride', 'Daughter', 'Promise', 'Bounty']),
  fair: Object.freeze(['Gilded', 'Honest', 'Bountiful', 'Fair', 'Laden', 'Thrifty', 'Prosperous', 'Golden', 'Silver', 'Merry', 'Fortunate', 'Steady',
    'Plump', 'Patient', 'Faithful', 'Wandering', 'Weathered', 'Lucky', 'Bonny', 'Sturdy', 'Swift', 'Gentle', 'Generous', 'Humble', 'Jolly', 'Kindly',
    'Quiet', 'Rosy', 'Sunny', 'Tidy', 'Willing', 'Bright', 'Copper', 'Amber', 'Ivory', 'Velvet', 'Spiced', 'Salted', 'Homeward', 'Outward']),
  wares: Object.freeze(['Cog', 'Scale', 'Purse', 'Ledger', 'Barrel', 'Cask', 'Bale', 'Bushel', 'Coin', 'Septim', 'Ingot', 'Wheel', 'Lantern', 'Compass',
    'Anchor', 'Gull', 'Heron', 'Cormorant', 'Pelican', 'Swan', 'Dove', 'Wren', 'Lark', 'Swallow', 'Goose', 'Otter', 'Seal', 'Mare', 'Bell', 'Hearth',
    'Harvest', 'Vintage', 'Venture', 'Bargain', 'Errand', 'Return', 'Welcome', 'Tidings', 'Penny', 'Fortune']),
  goods: Object.freeze(['Wool', 'Iron', 'Barley', 'Silk', 'Spice', 'Wine', 'Salt', 'Timber', 'Amber', 'Copper', 'Linen', 'Pearl', 'Dyes', 'Glass',
    'Honey', 'Cheese', 'Ale', 'Mead', 'Salmon', 'Olive', 'Pitch', 'Tallow', 'Leather', 'Fur', 'Grain', 'Oats', 'Hops', 'Rum', 'Saffron', 'Cinnamon',
    'Indigo', 'Cotton', 'Marble', 'Silver', 'Tin', 'Cloth', 'Rope', 'Cider', 'Brandy', 'Figs']),
  titles: Object.freeze(['Lady', 'Maid', 'Pride', 'Star', 'Rose', 'Lily', 'Pearl', 'Belle', 'Jewel', 'Daughter', 'Mother', 'Grace', 'Hope', 'Joy',
    'Glory', 'Fortune', 'Promise', 'Spirit', 'Wonder', 'Light', 'Queen', 'Swan', 'Dove', 'Treasure', 'Bounty']),
  dark: Object.freeze(['Black', 'Red', 'Bloody', 'Crimson', 'Grim', 'Cruel', 'Hungry', 'Drowned', 'Rotten', 'Salt', 'Storm', 'Night', 'Dread', 'Mad',
    'Howling', 'Wicked', 'Savage', 'Ragged', 'Rusted', 'Scarlet', 'Ashen', 'Ghostly', 'Cursed', 'Damned', 'Shrieking', 'Laughing', 'Gutted', 'Hanged',
    'Burning', 'Sunken', 'Blind', 'Broken', 'Bitter', 'Shadow', 'Iron', 'Bone', 'Grey', 'Wailing', 'Starving', 'Feral']),
  beasts: Object.freeze(['Kraken', 'Wake', 'Gull', 'Tide', 'Gannet', 'Wraith', 'Hag', 'Reaver', 'Crow', 'Slaughterfish', 'Dreugh', 'Wolf', 'Serpent',
    'Viper', 'Jackal', 'Hound', 'Raven', 'Harpy', 'Banshee', 'Skull', 'Cutlass', 'Blade', 'Hook', 'Fang', 'Claw', 'Maw', 'Grin', 'Noose', 'Gallows',
    'Corsair', 'Reaper', 'Revenant', 'Lamia', 'Spriggan', 'Imp', 'Daedroth', 'Dremora', 'Wereboar', 'Shark', 'Eel', 'Squall', 'Gale', 'Tempest',
    'Rogue', 'Marauder', 'Butcher', 'Widow', 'Orphan', 'Beggar', 'Jester']),
  princes: Object.freeze(['Dagon', 'Hircine', 'Sheogorath', 'Molag Bal', 'Namira', 'Peryite', 'Boethiah', 'Clavicus', 'Malacath', 'Mephala', 'Nocturnal',
    'Sanguine', 'Vaermina', 'Azura', 'Meridia', 'Hermaeus Mora']),
  boons: Object.freeze(['Tooth', 'Grin', 'Maw', 'Kiss', 'Bargain', 'Due', 'Debt', 'Hunger', 'Laughter', 'Whisper', 'Shadow', 'Blade', 'Thorn', 'Wager',
    'Revenge', 'Folly', 'Feast', 'Plague', 'Embrace', 'Gift', 'Jest', 'Bane', 'Claw', 'Curse', 'Dream', 'Eye', 'Hand', 'Mark', 'Price', 'Prize',
    'Rage', 'Ruin', 'Sting', 'Tithe', 'Touch', 'Wrath']),
  heads: Object.freeze(['Widow', 'Throat', 'Gold', 'Soul', 'Bone', 'Skull', 'Heart', 'Hull', 'Blood', 'Gut', 'Neck', 'Coin', 'Wreck', 'Grave', 'Corpse',
    'Purse', 'Spine', 'Rib', 'Tongue', 'Wrist']),
  deeds: Object.freeze(['maker', 'taker', 'breaker', 'cutter', 'eater', 'render', 'splitter', 'drinker', 'reaver', 'grinder', 'biter', 'ripper',
    'snatcher', 'slicer', 'gnawer', 'crusher', 'stealer', 'burner', 'sinker', 'seeker']),
  scourges: Object.freeze(['Scourge', 'Terror', 'Bane', 'Plague', 'Curse', 'Dread', 'Shame', 'Ruin', 'Doom', 'Nightmare', 'Butcher', 'Wolf', 'Reaper',
    'Widowmaker']),
});
/**
 * A ship's name off `r` (her name's own stream): the forms of her trade, each a weight - a crown's ship of her crown's
 * (`crown`, CROWNS'), else Daggerfall's. Answers the name with its article ("The Black Kraken", "Dagon's Tooth": a
 * name in the possessive takes none).
 */
export function shipNameOf(faction, r, crown = null) {
  const W = NAME_WORDS;
  const pick = (list) => list[Math.floor(r() * list.length) % list.length];
  const the = (n) => `The ${n}`;
  const c = crown ?? CROWNS[0], lore = CROWN_LORE[c.name] ?? CROWN_LORE.Daggerfall;   // a crown's ship's own words
  /** @type {[number, () => string][]} */
  const forms = faction === 'navy'
    ? [
      [3, () => the(pick(c.ships)).replace(/^The (\S+'s )/, '$1')],
      [5, () => `${pick(lore.royals)}'s ${pick(W.virtues)}`],
      [5, () => the(`${c.name} ${pick(W.martial)}`)],
      [3, () => `${pick(W.divines)}'s ${pick(W.favours)}`],
      [3, () => the(`${pick(W.emblems)} of ${pick(lore.places)}`)],
      [3, () => the(pick(W.martial))],
    ]
    : faction === 'pirate'
      ? [
        [2, () => the(pick(PIRATE_NAMES)).replace(/^The (\S+'s )/, '$1')],
        [6, () => the(`${pick(W.dark)} ${pick(W.beasts)}`)],
        [4, () => `${pick(W.princes)}'s ${pick(W.boons)}`],
        [3, () => { const h = pick(W.heads), d = pick(W.deeds); return the(h.slice(-1).toLowerCase() === d[0] ? `${h}-${d}` : `${h}${d}`); }],   // "Bone-eater", never "Boneeater"
        [3, () => the(`${pick(W.scourges)} of ${pick(W.ports)}`)],
      ]
      : [
        [2, () => the(pick(MERCHANT_NAMES))],
        [5, () => the(`${pick(W.ports)} ${pick(W.callings)}`)],
        [5, () => the(`${pick(W.fair)} ${pick(W.wares)}`)],
        [4, () => the(`${pick(W.ports)} ${pick(W.goods)}`)],
        [4, () => the(`${pick(W.titles)} of ${pick(W.ports)}`)],
      ];
  const total = forms.reduce((sum, [w]) => sum + w, 0);
  let x = r() * total;
  for (const [w, make] of forms) { if ((x -= w) < 0) return make(); }
  return forms[forms.length - 1][1]();
}

/**
 * The crown whose waters these are: the nearest of the three capitals to the map pixel, where the host has found
 * them on the player's own map (`capitals`: `[{ region, x, y }]`, the three cities' pixels) - else the region's own
 * crown when it is one of the three, else Daggerfall's.
 */
export function crownOf(px, py, capitals = null, regionIndex = -1) {
  let best = null, bd = Infinity;
  for (const c of capitals ?? []) {
    const crown = CROWNS.find((k) => k.region === c.region);
    if (!crown || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    const d = (c.x - px) ** 2 + (c.y - py) ** 2;
    if (d < bd) { bd = d; best = crown; }
  }
  return best ?? CROWNS.find((k) => k.region === regionIndex) ?? CROWNS[0];
}

/**
 * A ship's name and its captain's, from its seed: `{ name, captain, crown }`. Her name is SHIP-NAMES' (`shipNameOf`,
 * on its own stream: a navy ship's her crown's forms, a pirate's and a merchant's their trade's). The captain is
 * NameHelper.FullName over the region's bank on the seed's own DFRandom stream - the global stream put back as it
 * stood.
 * @param {any} shipClass
 * @param {number} seed
 * @param {{ regionIndex?: number, crown?: any }} [where] - the waters' region (the captain's name bank) and the crown
 *   a navy ship serves (crownOf's answer)
 */
export function shipNames(shipClass, seed, { regionIndex = 17, crown: crownIn = null } = {}) {
  const rng = mulberry32((seed ^ 0x5eaf00d) >>> 0);
  rng();   // SHIP-NAMES: the draw the name took off this stream - her captain's draws are the ones they always were
  const crown = shipClass.faction === 'navy' ? crownIn ?? crownOf(0, 0, null, regionIndex) : null;
  const name = shipNameOf(shipClass.faction, mulberry32(((seed >>> 0) ^ SHIP_NAME_SALT) >>> 0), crown);
  const saved = getSeed();
  let captain;
  try {
    srand((seed >>> 0) || 1);
    const bank = getNameBankOfRegion(regionIndex >= 0 && regionIndex < REGION_NAMES.length ? regionIndex : 17);
    captain = fullName(bank, rng() < 0.5 ? GENDERS.Male : GENDERS.Female);
  } finally { setSeed(saved); }
  return { name, captain, crown: crown?.name ?? null };
}

/** The line the target card reads under a ship's name: "Pirate Brigantine" / "Wayrest War Galley". */
export const classLine = (shipClass, crown = null) => (shipClass.faction === 'navy' && crown ? `${crown} ${shipClass.title}` : shipClass.title);
