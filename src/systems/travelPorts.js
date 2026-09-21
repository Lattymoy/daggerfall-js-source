// TO1: THE PORTS. TravelOptionsMapWindow.cs:875-989, the mod's own
// `portLocationIds` table, carried entry for entry in its own order.
//
// Daggerfall's map data does not say which towns have a harbour, so
// Hazelnut wrote the list by hand: every location a ship may sail from
// or to while "Only From Ports" / "Only To Ports" are set. It decides
// three things - the travel map's PORTS filter button, whether the
// popup will let the ship toggle be chosen at all, and the `hasPort`
// answer the mod hands to other mods (TravelOptionsMod.cs:1299).
//
// THE ID IS MASKED. A location's MapId carries flags in its top bits;
// `MaskMapId` keeps the low twenty (:855-858) and the table is written
// in those masked values. The port's own map summaries carry `mapId`
// the same way, so the mask is applied here and nowhere else.
//
// THE DUPLICATES ARE THE MOD'S. The table is 417 entries but only 378
// distinct ones: the "Extras allowing travel to" block at the end
// repeats thirty-nine ids already in the main block, each with the
// region and name Hazelnut noted beside it. `Array.Exists` does not
// care, and neither does the Set below; the numbers are kept as
// written because the comments beside the extras are the only record
// of WHY a given hamlet counts as a port.

/** :875-931 - the main block, in the mod's own rows of ten. */
export const PORT_LOCATION_IDS_MAIN = Object.freeze([
  443401, 280614, 285597, 485856, 86496, 137544, 139547, 143535, 143542, 149513,
  150625, 158629, 162631, 162646, 164648, 166644, 168652, 169640, 170654, 178663,
  182685, 188727, 192653, 195681, 201654, 202646, 203671, 225685, 234712, 22763,
  184263, 189097, 192248, 194242, 194279, 196245, 199102, 199111, 201125, 210132,
  212138, 213207, 226205, 228209, 235146, 236143, 239139, 239144, 239146, 241140,
  91170, 93168, 96150, 96212, 107137, 109167, 325404, 325406, 328409, 341392,
  342399, 343397, 344387, 345378, 345383, 346398, 347375, 348372, 348396, 350370,
  351392, 352369, 353387, 354364, 361382, 364381, 369385, 369388, 370441, 372411,
  372439, 373407, 373415, 373422, 373425, 373427, 373429, 374419, 120375, 121377,
  148460, 148463, 150459, 158499, 168357, 172455, 187406, 192361, 193358, 193366,
  195353, 195361, 197366, 200356, 277751, 278764, 279644, 279697, 279749, 279754,
  279766, 280747, 281656, 281658, 281663, 281699, 281702, 281704, 281741, 281770,
  282712, 282724, 282728, 282731, 282734, 282737, 283687, 283707, 284685, 285682,
  286674, 289737, 292695, 293697, 310763, 311766, 194855, 195860, 223828, 225840,
  229847, 236854, 240841, 242856, 243846, 244859, 247836, 249839, 249861, 249866,
  250875, 255876, 256887, 256900, 257889, 258892, 258907, 261923, 261925, 262907,
  262931, 264900, 264902, 264940, 264942, 265956, 266964, 273975, 5222, 5224,
  11215, 14210, 23240, 35152, 49219, 157795, 181800, 187807, 193793, 210785,
  215821, 216791, 112707, 133701, 133718, 134711, 135713, 135717, 135735, 138745,
  140758, 140760, 148782, 151788, 83668, 125675, 111631, 111645, 112652, 113637,
  113646, 113649, 115622, 118573, 134553, 137558, 137561, 137593, 138583, 139588,
  145609, 146607, 147614, 148589, 151591, 152587, 56637, 35449, 41483, 121473,
  129449, 29347, 40361, 69406, 160305, 451180, 451186, 453173, 455174, 457179,
  458198, 460176, 461173, 463171, 468168, 468188, 473169, 474207, 476162, 476164,
  477177, 478159, 483153, 493144, 495141, 422217, 432218, 433205, 435202, 455199,
  459220, 405246, 405263, 406266, 407241, 408235, 408249, 417227, 393300, 397296,
  403279, 406276, 418291, 364449, 370446, 402451, 276583, 279596, 290582, 294569,
  295564, 296558, 297552, 305534, 308524, 308527, 308530, 309521, 312518, 313516,
  316550, 318514, 334515, 339496, 341496, 346475, 351470, 337704, 263832, 264825,
  269847, 269849, 276835, 277798, 278817, 278843, 279815, 283779, 283782, 287827,
  287829, 289866, 294842, 302839, 306854, 337914, 338912, 341916, 346918, 351919,
  354916, 357915, 357918, 361913, 363915, 364868, 370908, 379876, 379888, 380885,
  381881, 382879, 278962, 281872, 281969, 324981, 469891, 437653, 446471, 472431,
  480415, 217966, 100086, 121067, 123073, 144059, 75104, 77077, 83137, 86218,
  86334, 89333, 343439,
]);

/** :932-989 - "Extras allowing travel to:", each with the mod's own
 *  note of the region and the location it stands for. */
export const PORT_LOCATION_IDS_EXTRAS = Object.freeze([
  205676,   // "Isle of Balfiera", "Blackhead"
  278901,   // "Mournoth", "Zagoparia"
  263119,   // "Betony", "Whitefort"
  148062,   // "Tulune", "The Citadel of Hearthham"
  144059,   // "Tulune", "The Elyzanna Assembly"
  343439,   // "Cybiades", "Ruins of Cosh Hall"
  243846,   // Wayrest	Penwall Derry
  273975,   // Wayrest	Tunmont
  255884,   // Wayrest	Eastwold
  256887,   // Wayrest	Chardale
  262931,   // Wayrest	Longmore Field
  106061,   // Tulune	Midmont
  164072,   // Tulune  Lambrugh
  157092,   // Tulune	Gallocart
  296558,   // Tigonus Antelibuton
  297552,   // Tigonus Wadijerareg
  308527,   // Tigonus Kalureg
  376329,   // Sentinel	Pibuda
  359347,   // Sentinel	Zenuhno
  357347,   // Sentinel	Mji-Ij
  358355,   // Sentinel	Antelajda
  350370,   // Sentinel	Naresa
  347375,   // Sentinel	Jalonia
  343397,   // Sentinel Sentinel
  373407,   // Sentinel	Cudakasa
  373415,   // Sentinel	Bubumbaret
  327404,   // Sentinel	Bubissidata
  283779,   // Satakalaam	Tulajidax
  406266,   // Pothago	Berbajan
  42127,    // Northmoor	Gothcroft
  5229,     // Northmoor	Knightshope
  8219,     // Northmoor	Stokwall
  34162,    // Northmoor	Vanpath
  38152,    // Northmoor	Pencart
  45124,    // Northmoor	Burgcart Heath
  403279,   // Myrkwasa	Elissinia
  285898,   // Mournoth	Wadijilanis
  278962,   // Mournoth	Meseraara
  216791,   // Menevia	Chesterbrugh
  279754,   // Lainlyn	Kalunnunu
  281658,   // Lainlyn	Syrotubu
  286674,   // Lainlyn	Papiladisu
  281699,   // Lainlyn	Syrallao
  281702,   // Lainlyn	Pythohajer
  73079,    // Glenumbra Moors	Tambridge
  77077,    // Glenumbra Moors	Deerpath
  223207,   // Daggerfall	Westhead Moor
  199102,   // Daggerfall	Whitecroft
  201118,   // Daggerfall	Holwych
  213285,   // Daggerfall	Ripmore
  214207,   // Daggerfall	Copperfield Manor
  221160,   // Daggerfall	Fontborne
  225169,   // Daggerfall	Longwich End
  224178,   // Daggerfall	Wilderham
  217198,   // Daggerfall	Midbrugh
  214294,   // Daggerfall	Vanvale
  214297,   // Daggerfall	Blackcart Hollow
  239144,   // Daggerfall	Aldpath Hall
  236143,   // Daggerfall	Grimton
  139588,   // Bhoriane	Wartale
  113637,   // Bhoriane	Fontbridge
  112652,   // Bhoriane	Stokbrone
  255114,   // Betony	Kirkbeth Hamlet
  364449,   // Ayasofya Umbopala
  183401,   // Anticlere	Aldwall Rock
  175401,   // Anticlere	Crossleigh
  187406,   // Anticlere	Cathwold Heath
  195353,   // Anticlere	Vanwood Hollow
  193358,   // Anticlere	Ipspath
  197366,   // Anticlere	Wilderbury Rock
  133718,   // Alcaire	Cathborne
  140760,   // Alcaire	Wargate
  455174,   // Abibon-Gora	Papyrydai
  202333,   // Shalgora Aldbrugh
]);

/** The whole table, as `Array.Exists` walks it. */
export const PORT_LOCATION_IDS = Object.freeze([...PORT_LOCATION_IDS_MAIN, ...PORT_LOCATION_IDS_EXTRAS]);

/** The membership set the lookup actually uses - 378 distinct ids of
 *  the table's 417 entries. */
const PORT_SET = new Set(PORT_LOCATION_IDS);

/** :855-858, MaskMapId. */
export function maskMapId(mapId) {
  return (mapId | 0) & 0x000FFFFF;
}

/** :870-873, HasPort(int mapId). The two overloads above it
 *  (:860-868) take a MapSummary or a RegionMapTable and reach the same
 *  place through their `.ID` / `.MapId`, so the port has one function
 *  and its callers pass the number. A null or undefined id - a pixel
 *  with no location - is not a port. */
export function hasPort(mapId) {
  if (mapId == null || !Number.isFinite(mapId)) return false;
  return PORT_SET.has(maskMapId(mapId));
}
