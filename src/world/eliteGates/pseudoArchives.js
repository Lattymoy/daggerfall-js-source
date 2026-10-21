// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.6 and 25.1 - EG1's
// registry): THE ONE REGISTRY OF PSEUDO-ARCHIVES - every texture archive the port answers that is not one of
// Daggerfall's own TEXTURE.000-511, in one place, so a new one is picked against all the others and never on top of one.
//
// A picture is kept by its archive and its record (renderer.uploadTexture(archive, record, ...)), so two owners that
// pick one number share every picture under it: whichever uploads first stands for both. That happened once (AUDIT SD IV
// R6: the large boat took 38151, the Shattered Hour's own, and was moved to 38171), and the numbers were scattered
// constants with nothing to say which were taken. Four kinds live here:
//   port       - painted in code by the port (bloodArt.js's law, BLOOD_ATLAS_ARCHIVE 38001, and every made level since);
//   mod        - a mod's own archive the port carries (Handheld Torches, the shields, Eye Of The Beholder, the waves);
//   data       - a number Daggerfall's own block data names that no catalogue holds, which the port answers with a
//                stand-in (the towns' clutter and gardens) - never to be taken by a picture of ours;
//   synthetic  - a number the port mints at runtime (the peers' dolls).
// A string key (`'cards'`, `'hcc'`) is a pseudo-archive too - the renderer keys a picture by `${archive}_${record}`, so a
// string can collide only with a string - and is registered beside the numbers.
//
// Each owner keeps its own constant (its module, its pins); this registry says the number is taken and by whom, and
// test/world/eliteGates/eglook_registry.test.js sweeps the source both ways - every `*ARCHIVE*` constant past TEXTURE.511 in src/ is
// registered here at its own value and owner, every registered constant still stands in its owner - and refuses any two
// entries that overlap.
//
// THE SPIRE'S (section 25.1). The page reserved 38231-38279 "free today from 38231 (after the merchant yard's 38221)",
// but the harbour's art took 38231 (world/portArt.js PORT_ARCHIVE) before the page was built. So the four bands keep the
// page's numbers (38241, 38251, 38261, 38271 - a block of nine each, the first painted, the rest held for the band's own
// later records: EG-ZL paints its Beats' pictures under the second - world/eliteGates/egBandArt.js egTellArchive), and the arch, the
// key and the beacon's block moves past them, to 38281-38289. Said in the arc's record.
// EG6c (2026-10-12, section 11.6): an AUTHORED hero fragment takes no number of its own - each face of its art wears a
// record of its band's dress (world/eliteGates/egBandArt.js EG_DRESS; tools/fragBake.mjs refuses any other material), so it draws
// under its band's archive here (world/eliteGates/egHeroFragModel.js) and Mac's fragments can never collide with anything.
//
// A leaf: no imports. Not a DFU member. Ledger A (ELITE-GATES).

/** The last of Daggerfall's own texture archives (TEXTURE.511 - scenes/dataPipeline.js LAST_CLASSIC_TEXTURE_ARCHIVE). A
 *  pseudo-archive number lies past it. */
export const PSEUDO_ARCHIVE_FLOOR = 511;

/** THE SPIRE'S BAND ARCHIVES (section 25.1), by band index (net/eliteGates/egLaw.js EG_BANDS order): the Galleries, the Cairn, the
 *  Shade, the Wellhead - each band's dress is painted under its first number (world/eliteGates/egBandArt.js). */
export const EG_BAND_ARCHIVES = Object.freeze([38241, 38251, 38261, 38271]);
/** Each band's block: its first number and the eight after it. */
export const EG_BAND_BLOCK = 9;
/** THE ARCH, THE KEY AND THE BEACON's block (section 25.1's 38231-38239, moved past the bands: 38231 is the harbour's). */
export const EG_ARCH_ARCHIVES = Object.freeze({ from: 38281, to: 38289 });
/** EG-ZH (2026-10-12, section 25.1): what the arch's block holds, in the page's order - the arch's skin at its first number
 *  (held for the arch's slice), the WEIR KEY's picture at the second (painted - world/eliteGates/egKeyArt.js), the beacon's at the
 *  third (held); the rest held for the Spire's later pictures. */
export const EG_ARCH_BLOCK = Object.freeze({ arch: EG_ARCH_ARCHIVES.from, key: EG_ARCH_ARCHIVES.from + 1, beacon: EG_ARCH_ARCHIVES.from + 2 });

/**
 * @typedef {{ from: number, to: number, owner: string, name: string, kind: 'port'|'mod'|'data'|'synthetic', what: string }} PseudoArchiveRange
 * @typedef {{ key: string, owner: string, name: string, what: string }} PseudoArchiveKey
 */
const N = (from, owner, name, kind, what, to = from) => Object.freeze({ from, to, owner, name, kind, what });
const K = (key, owner, name, what) => Object.freeze({ key, owner, name, what });

/** EVERY NUMBERED PSEUDO-ARCHIVE, lowest first: `from`-`to` inclusive, the owner's file (under src/), the constant that
 *  names its first number there (the Spire's and the reserved blocks name the registry's own), its kind and what it
 *  holds. @type {ReadonlyArray<PseudoArchiveRange>} */
export const PSEUDO_ARCHIVES = Object.freeze([
  N(560, 'characters/thunderlockIds.js', 'THUNDERLOCK_ARCHIVE', 'mod', "the Thunderlock's weapon art"),
  N(561, 'characters/thunderlockIds.js', 'PELLET_ARCHIVE', 'mod', "the Thunderlock's pellets"),
  N(10035, 'world/townStandIns.js', 'TOWN_GARDEN_ARCHIVE', 'data', "the temples' gardens Daggerfall's blocks name"),
  N(38001, 'combat/blood/bloodArt.js', 'BLOOD_ATLAS_ARCHIVE', 'port', 'the blood atlas'),
  N(38101, 'world/gate/gateModel.js', 'GATE_ARCHIVE', 'port', "Dagon's Breach's gate stone"),
  N(38111, 'world/gate/gateArena.js', 'COURT_ARCHIVE', 'port', 'the Burning Court'),
  N(38121, 'scenes/spoilsPool.js', 'SPOILS_ICON_ARCHIVE', 'port', "the gate's spoils' pictures"),
  N(38131, 'world/ships/galleonArt.js', 'GALLEON_ARCHIVE', 'port', 'the galleon'),
  N(38141, 'world/ships/carrackArt.js', 'CARRACK_ARCHIVE', 'port', 'the carrack'),
  N(38151, 'world/superDungeon/sdRealm.js', 'SD_REALM_ARCHIVE', 'port', 'the Shattered Hour'),
  N(38155, 'world/superDungeon/sdRemnantArt.js', 'SD_REMNANT_ARCHIVE', 'port', 'the Brass Remnant'),
  N(38161, 'scenes/physicalItemsLayer.js', 'PI_ICON_ARCHIVE', 'port', "the physical items' pictures"),
  N(38171, 'world/ships/largeBoatArt.js', 'LARGE_BOAT_ARCHIVE', 'port', 'the large boat (moved from 38151 - AUDIT SD IV R6)'),
  N(38181, 'world/wagonArt.js', 'WAGON_ARCHIVE', 'port', 'the wagons'),
  N(38191, 'systems/naval/shipLivery.js', 'LIVERY_ARCHIVE', 'port', "a ship's paint - her painted pictures, made at run time (SHIP-LIVERY)"),
  N(38192, 'scenes/cabinLook.js', 'CABIN_ARCHIVE', 'port', "a ship's cabin stained, made at run time (CABIN-LOOK)"),
  N(38193, 'scenes/comeSailAway/shipPlaque.js', 'PLAQUE_ARCHIVE', 'port', "a ship's name boards, painted at run time (SHIP-PLAQUE)"),
  N(38201, 'world/townStandIns.js', 'TOWN_BED_ARCHIVE', 'port', "the towns' beds"),
  N(38202, 'world/townPictures.js', 'TOWN_PICTURE_ARCHIVE', 'port', "the towns' pictures"),
  N(38211, 'world/lefayMonument.js', 'LEFAY_ARCHIVE', 'port', "Lefay's monument"),
  N(38221, 'world/merchantYards/merchantYardArt.js', 'YARD_ARCHIVE', 'port', "the merchant yards"),
  N(38231, 'world/portArt.js', 'PORT_ARCHIVE', 'port', "the harbour - the shipyard and the lighthouse"),
  N(38232, 'systems/lampKeeper.js', 'LAMP_ARCHIVE', 'port', "Kludge Town's lamp - the classic 197_6 under the port's own key (LAMP-KEEPER II; 38241, the Galleries' - world/eliteGates/egBandArt.js - until the merge of main into the Spire)"),
  N(EG_BAND_ARCHIVES[0], 'world/eliteGates/pseudoArchives.js', 'EG_BAND_ARCHIVES', 'port', "the Spire's Broken Galleries", EG_BAND_ARCHIVES[0] + EG_BAND_BLOCK - 1),
  N(EG_BAND_ARCHIVES[1], 'world/eliteGates/pseudoArchives.js', 'EG_BAND_ARCHIVES', 'port', "the Spire's Soul Cairn", EG_BAND_ARCHIVES[1] + EG_BAND_BLOCK - 1),
  N(EG_BAND_ARCHIVES[2], 'world/eliteGates/pseudoArchives.js', 'EG_BAND_ARCHIVES', 'port', "the Spire's Shade Perilous", EG_BAND_ARCHIVES[2] + EG_BAND_BLOCK - 1),
  N(EG_BAND_ARCHIVES[3], 'world/eliteGates/pseudoArchives.js', 'EG_BAND_ARCHIVES', 'port', "the Spire's Havoc Wellhead", EG_BAND_ARCHIVES[3] + EG_BAND_BLOCK - 1),
  N(38291, 'world/festivalArt.js', 'FESTIVAL_ARCHIVE', 'port', "the Witches' Festival - the Soul Cake, the Hearth Offering and the towns' turnip lanterns, effigies and ward-staves (WITCH1; a block of nine)", 38299),
  N(EG_ARCH_ARCHIVES.from, 'world/eliteGates/pseudoArchives.js', 'EG_ARCH_ARCHIVES', 'port', "the Spire's arch (held), the Weir Key (38282, painted - world/eliteGates/egKeyArt.js) and the beacon (held)", EG_ARCH_ARCHIVES.to),
  N(38301, 'world/starfall/starArt.js', 'STAR_ARCHIVE', 'port', 'the fallen star - its crater, its stone and its thread (STAR4)'),
  N(38302, 'world/starfall/starglassArt.js', 'STARGLASS_ARCHIVE', 'port', 'Starglass, the glass a held star leaves (STAR7)'),
  N(38990, 'tools/abyssLab.js', 'LAB_ARCHIVE', 'port', "the abyss lab's walls and floor"),
  N(56790, 'world/townStandIns.js', 'TOWN_CLUTTER_ARCHIVE', 'data', "the towns' clutter Daggerfall's blocks name"),
  N(112358, 'systems/handheldTorches.js', 'DROPPED_ARCHIVE', 'mod', 'Handheld Torches: a dropped torch'),
  N(112359, 'systems/handheldTorches.js', 'SPRITE_ARCHIVE', 'mod', 'Handheld Torches: the held torch'),
  N(112360, 'combat/shieldWidget.js', 'SHIELD_ARCHIVE_FIRST', 'mod', 'the shields: buckler, round, kite, tower', 112363),
  N(112364, 'player/eyeOfTheBeholder/eotbBillboard.js', 'ARCHIVE_FOOT', 'mod', 'Eye Of The Beholder: on foot, sixteen bodies', 112379),
  N(112380, 'player/eyeOfTheBeholder/eotbBillboard.js', 'ARCHIVE_LYCAN', 'mod', 'Eye Of The Beholder: the werewolf and the wereboar', 112381),
  N(112382, 'player/eyeOfTheBeholder/eotbBillboard.js', 'ARCHIVE_HORSE', 'mod', 'Eye Of The Beholder: mounted, five', 112386),
  N(112395, 'systems/comeSailAway/comeSailAwayWaves.js', 'WAVE_ARCHIVE', 'mod', "Come Sail Away's waves"),
  N(600000, 'poi/poiRuntime.js', 'POI_TEXTURE_ARCHIVE', 'port', "the POIs' textures, a record each look - poi/poiRuntime.js createTextureBook (POI-1, the merge of main)"),
  N(900000, 'net/remotePlayers.js', 'PEER_ARCHIVE', 'synthetic', "the peers' dolls"),
]);

/** EVERY STRING PSEUDO-ARCHIVE. @type {ReadonlyArray<PseudoArchiveKey>} */
export const PSEUDO_ARCHIVE_KEYS = Object.freeze([
  K('cards', 'render/cardTableDraw.js', 'CARD_ARCHIVE', "the tavern's cards"),
  K('cardtable', 'world/card/cardTableProp.js', 'CARD_TABLE_ARCHIVE', "the card table's cloth"),
  K('fxportal', 'scenes/portalFx.js', 'PORTAL_ARCHIVE', "the Portal Stone's vortex"),
  K('hcc', 'scenes/horseCartPool.js', 'HORSE_ARCHIVE', "Horses, Carts and Coaches"),
  K('htwaist-lantern', 'player/eyeOfTheBeholder/eotbLantern.js', 'LANTERN_ART_KEY', 'the waist lantern'),
  K('iliac-cards', 'render/iliacTableDraw.js', 'ILIAC_ARCHIVE', "Iliac Hand's cards"),
  K('kings-gambit', 'render/gambitTableDraw.js', 'GAMBIT_ARCHIVE', "The King's Gambit's board and pieces - render/gambitTableDraw.js (the merge of main)"),
  K('model-icon', 'ui/item/itemScroller.js', 'MODEL_ICON_ARCHIVE', "a model's icon in the item lists"),
  K('mw-stand', 'scenes/decor/decorRoom.js', 'MW_STAND_ARCHIVE', "a placed Morrowind stand's picture"),
]);

/** Where two numbered entries overlap: `[[a, b], ...]` by their names (pure - the test's refusal, and any slice's own
 *  check before it picks a number). */
export function pseudoArchiveCollisions(list = PSEUDO_ARCHIVES) {
  const out = [];
  const sorted = [...list].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    for (let j = 0; j < i; j++) if (sorted[i].from <= sorted[j].to && sorted[j].from <= sorted[i].to) out.push([`${sorted[j].name}:${sorted[j].from}`, `${sorted[i].name}:${sorted[i].from}`]);
  }
  return out;
}

/** The entry that holds archive `n` (a number or a string key), or null - a free number answers null. */
export function pseudoArchiveOwner(n) {
  if (typeof n === 'string') return PSEUDO_ARCHIVE_KEYS.find((e) => e.key === n) ?? null;
  return PSEUDO_ARCHIVES.find((e) => n >= e.from && n <= e.to) ?? null;
}

/** The first free block of `size` numbers at or past `from` (a slice's pick - section 11.6's "picked against all the
 *  others"). Pure. */
export function pseudoArchiveFree(from, size = 1) {
  let at = Math.max(from, PSEUDO_ARCHIVE_FLOOR + 1);
  for (;;) {
    const hit = PSEUDO_ARCHIVES.find((e) => at <= e.to && e.from <= at + size - 1);
    if (!hit) return at;
    at = hit.to + 1;
  }
}
