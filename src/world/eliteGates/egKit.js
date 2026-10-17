// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md sections 1
// and 8): THE FRACTURED BATTLESPIRE'S KIT - the one table every builder of the Spire's look names its records and its forms
// from, so the ground (world/eliteGates/egHall.js), the ruin (world/eliteGates/egRuin.js), the wreck (world/eliteGates/egVista.js), the spans' pieces and the
// band art (world/eliteGates/egBandArt.js) dress one academy in each band's own way.
//
//   THE RECORDS - each band paints every one of them into its own archive (world/eliteGates/pseudoArchives.js EG_BAND_ARCHIVES), so
//     a builder names a record and the band's dress picks the picture: the ground's eight (EG_DRESS - the Hour's numbers
//     and the liquid's 33) and the kit's thirteen (section 8's table).
//   THE STYLE - each band's forms, by name: its column, capital, cornice, arch, statue, fixture, foundations, banner sigil
//     and its wreck's wings (section 1). A builder reads the name and lays the band's own shape.
//
// Pure: no DOM, no GL - the swap's worker reads it (world/eliteGates/egCircleWorker.js). Not a DFU member. Ledger A (ELITE-GATES).

/** THE KIT'S RECORDS (Elite-Gates-Look.md section 8), beside the ground's (world/eliteGates/egBandArt.js EG_DRESS: floor 0, brass 1,
 *  root 2, arena 4, cobble 31, edge 32, molten 33, pillar 56). */
export const EG_KIT_RECORD = Object.freeze({
  shaft: 60,      // a column's shaft, v along it (2 m a repeat): fluting, bone wrap, glass facets, basalt hex faces
  moulding: 61,   // the cornice's and capitals' profile across v
  voussoir: 62,   // an arch's and a vault rib's blocks
  relief: 63,     // a frieze panel
  banner: 64,     // cloth, its sigil, its torn edge a cutout
  coffer: 65,     // a vault's coffers, an entablature's soffit
  statue: 66,     // the figures' weathered stone
  fixture: 67,    // a lamp's fixture and its flame (the band's light - the ruin's one emissive)
  found: 68,      // the foundations' strata, top to tip (v down)
  wreck: 69,      // the far wings' stone
  crystal: 70,    // soul-gem, black glass, basalt prisms
  inlay: 71,      // the courts' sigil mosaics and the rims' borders: tesserae in the band's accent and metal, laid in the floor
  chain: 81,      // the band's metal in links
});
/** @type {ReadonlyArray<number>} */
export const EG_KIT_RECORDS = Object.freeze(Object.values(EG_KIT_RECORD));

/**
 * THE BANDS' FORMS (Elite-Gates-Look.md section 1), by band index (0 the Broken Galleries, 1 the Soul Cairn, 2 the Shade
 * Perilous, 3 the Havoc Wellhead). Each a name a builder knows:
 *   column    the shaft's section: 'fluted' (round, 16 flutes), 'bone' (round, wrapped), 'glass' (an octagon, faceted),
 *             'basalt' (a hexagon)
 *   capital   'scroll', 'skull', 'crescent', 'spiked'
 *   cornice   'egg-and-dart', 'skulls', 'facets', 'straps'
 *   arch      'round', 'pointed', 'lancet', 'squat'
 *   statue    'battlemage', 'mourner', 'raven', 'dremora'
 *   fixture   'tripod' (a bronze brazier), 'lantern' (a soul-gem cage on a chain), 'moonlamp' (a silver lamp on a post),
 *             'basket' (an iron fire basket on a spike)
 *   found     the foundations: 'courses' (stepped marble courses, rubble, red rock), 'ossuary' (bone and black roots),
 *             'stalactites' (black-glass clusters), 'prisms' (basalt prisms and iron girders)
 *   hanging   what hangs under a court: 'chandelier', 'cage', 'shards', 'girders'
 *   among     what stands among a court's columns: null, 'obelisk', 'thorns', 'pylon'
 *   sigil     the banner's and the courts' mosaic's sign: 'star' (the Battlemages' eight-pointed star in a ring), 'gem',
 *             'crescent', 'dagon'
 *   wreck     the far wings, by name: section 1's
 */
export const EG_KIT_STYLE = Object.freeze([
  Object.freeze({ column: 'fluted', capital: 'scroll', cornice: 'egg-and-dart', arch: 'round', statue: 'battlemage', fixture: 'tripod', found: 'courses', hanging: 'chandelier', among: null, sigil: 'star', wreck: Object.freeze(['rotunda', 'belltower', 'arcade', 'spiral']) }),
  Object.freeze({ column: 'bone', capital: 'skull', cornice: 'skulls', arch: 'pointed', statue: 'mourner', fixture: 'lantern', found: 'ossuary', hanging: 'cage', among: 'obelisk', sigil: 'gem', wreck: Object.freeze(['tomb', 'crypt', 'gem', 'sunken']) }),
  Object.freeze({ column: 'glass', capital: 'crescent', cornice: 'facets', arch: 'lancet', statue: 'raven', fixture: 'moonlamp', found: 'stalactites', hanging: 'shards', among: 'thorns', sigil: 'crescent', wreck: Object.freeze(['thorntower', 'shard', 'observatory', 'shard']) }),
  Object.freeze({ column: 'basalt', capital: 'spiked', cornice: 'straps', arch: 'squat', statue: 'dremora', fixture: 'basket', found: 'prisms', hanging: 'girders', among: 'pylon', sigil: 'dagon', wreck: Object.freeze(['siegetower', 'wargate', 'crag', 'crag']) }),
]);
/** A band's forms (clamped to 0-3). */
export const egKitStyle = (band) => EG_KIT_STYLE[Math.max(0, Math.min(3, band | 0))];

/** THE LORDS' PRESENCE (Elite-Gates-Look.md section 9): how much larger than its body a lord's sprite is drawn - the body's
 *  scale (net/eliteGates/egLaw.js EG_LORDS, the relay's bodyR and the client's hit target) is unchanged; the sprite alone grows.
 *  `lord` every Court lord (the Twins each), `valkynaz` the four of EG_LORDS `valk` (Ilthys, Morvayn, Seyth, Garoth),
 *  `champion` the Kyn ranks (net/eliteGates/egLaw.js EG_CHAMPIONS); a mirror its own lord's (scenes/eliteGates/egFight.js egPresenceOf). Over the
 *  bodies' own scales (2.5-5) the drawn order holds: a champion 3.5x, a Court lord 4-8x, a Valkynaz 5.4-7.2x growing band by
 *  band - and the champion and the Valkynaz wear the legion's Daedra Lord's sprite (mobile 31, drawn at 1.3), so the ranks
 *  read side by side: 2.7 and 4.2-5.5 times the add. */
export const EG_LORD_PRESENCE = Object.freeze({ lord: 1.6, valkynaz: 1.8, champion: 1.4 });
