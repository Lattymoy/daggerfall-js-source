// FIELD BUGS 2026-10-04d QUEST-MARKERS: THE TOWN PACKS' QUEST MARKERS NO PLAYER CAN REACH, STOOD ON THE FLOOR.
//
// A quest's person, foe or item stands at the building marker its Place picks (Place.cs AssignQuestResource ->
// GetSiteMarker; a person snapped to the floor within 4 m, an item never). The town-mods audit (2026-10-04) measured
// every quest marker (editor flats 199.11 and 199.18) of every interior both town packs lay out, against the interior the
// port builds, and six of the packs' interior designs hold one no player can reach: a House2 one of whose two person
// markers is 3.75 m under its floor; a House2 whose only one stands in the attic of the exterior model the author placed
// inside it; two House4 designs with an item marker inside the stairs; and Beautiful Cities' library (DALIBRBL01/03,
// the author's own interior over LIBRAL01/03 - Daggerfall's libraries are sound) with one person marker four metres
// outside its east wall and another inside a solid. The door serves them in 1,105 buildings of 665 towns, none of them
// a block of Daggerfall's own. DFU stands the quest's people and things there all the same, and the quest cannot be done.
//
// FIELD BUGS 2026-10-05 SEALED-CELLAR (Discord: "Can't access building basement to continue quest" - "In tigonus" -
// "Supposed to be stairs down"; The Possessed Child's child in Beautiful Cities' GEMSAL00 #7): fourteen more designs,
// whose quest marker stands on a sound floor past a stair the author shut with a floor tile (and marked with the
// editor's 199.14 and 199.13, which no game reads) - eleven cellars and three lofts, 128 buildings. THE RAY passed them;
// the walk from the hatch's far side reaches each, and its floor spot is by the hatch's near side (the tool's
// SEALED-CELLAR, tools/townQuestMarkers.mjs).
//
// THE PORT'S CURATION, as layoutPins.js CURATED_CLASSIC curates the TVRNAS blocks: each such marker, keyed by the pack
// that lays it out, the block, the building's record and the marker's own position, STANDS AT ITS MEASURED FLOOR SPOT -
// the nearest floor a person walks to from the room's entrance, with half a metre of floor round it
// (tools/townQuestMarkers.mjs measured it off the player's own ARCH3D, and test/fb1004d_questmarkers.test.js measures it
// again). A MOVE, not a drop: the building keeps every marker DFU's quest law counts and indexes - `marker N`,
// anymarker's two lists, the spawn-to-item fallback, every draw over the lists - and only where one stands changes.
import { worldDataVendorCarries, blockReplacementFilename } from '../../formats/worldDataReplacement.js';

/** The list tools/townQuestMarkers.mjs prints: per interior design, where it stands ([pack, block, record]) and each
 *  marker no player reaches - its record (11 a person or foe, 18 an item), its position `at` and the floor spot `to`,
 *  both in the block's own units (xPos, yPos, zPos; y down). */
export const CURATED_QUEST_MARKERS = Object.freeze([
  {
    design: 'PAWNGM00.RMB#0', buildingType: 20,
    where: [
      ['beautiful-villages', 'PAWNGM00.RMB', 0], ['beautiful-villages', 'RESIBM01.RMB', 3], ['beautiful-villages', 'RESIGM02.RMB', 2],
      ['beautiful-villages', 'TVRNBM00.RMB', 2], ['beautiful-cities', 'MAGEGA04.RMB', 9], ['beautiful-cities', 'MANRBL00.RMB', 1],
      ['beautiful-cities', 'PAWNBL00.RMB', 9], ['beautiful-cities', 'PAWNBL00.RMB', 14], ['beautiful-cities', 'PAWNGL00.RMB', 2],
      ['beautiful-cities', 'PAWNGL00.RMB', 7], ['beautiful-cities', 'RESIBL00.RMB', 0], ['beautiful-cities', 'RESIBL00.RMB', 3],
      ['beautiful-cities', 'RESIGL00.RMB', 0], ['beautiful-cities', 'RESIGL04.RMB', 0], ['beautiful-cities', 'TVRNBL01.RMB', 4],
      ['beautiful-cities', 'TVRNBL04.RMB', 2], ['beautiful-cities', 'TVRNBL04.RMB', 4], ['beautiful-cities', 'TVRNBL04.RMB', 5],
      ['beautiful-cities', 'TVRNGL01.RMB', 4], ['beautiful-cities', 'TVRNGL01.RMB', 5],
    ],
    markers: [{ record: 18, at: [-354, 0, -100], to: [-300, 0, -43] }],
  },
  {
    design: 'RESIGM02.RMB#3', buildingType: 20,
    where: [
      ['beautiful-villages', 'RESIGM02.RMB', 3], ['beautiful-villages', 'RESIGM02.RMB', 5], ['beautiful-villages', 'TVRNBM00.RMB', 5],
      ['beautiful-villages', 'TVRNBM01.RMB', 4], ['beautiful-villages', 'TVRNBS00.RMB', 0], ['beautiful-villages', 'TVRNGM01.RMB', 4],
      ['beautiful-cities', 'ARMRBL00.RMB', 15], ['beautiful-cities', 'MAGEBA02.RMB', 4], ['beautiful-cities', 'MAGEBA02.RMB', 7],
      ['beautiful-cities', 'MANRBL00.RMB', 3], ['beautiful-cities', 'PAWNGL00.RMB', 12], ['beautiful-cities', 'RESIBL04.RMB', 0],
      ['beautiful-cities', 'TVRNBL01.RMB', 2], ['beautiful-cities', 'TVRNBL04.RMB', 0], ['beautiful-cities', 'TVRNBL04.RMB', 1],
      ['beautiful-cities', 'TVRNGL04.RMB', 5], ['beautiful-cities', 'WALLAA09.TVRNBS00.RMB', 4],
    ],
    markers: [{ record: 18, at: [-354, 0, -100], to: [-300, 0, -43] }],
  },
  {
    design: 'GENRAS03.RMB#4', buildingType: 18,
    where: [
      ['beautiful-villages', 'GENRAS03.RMB', 4], ['beautiful-villages', 'MANRAS02.RMB', 0], ['beautiful-villages', 'RESIAS02.RMB', 7],
      ['beautiful-villages', 'TEMPASA1.RMB', 2], ['beautiful-villages', 'TEMPASD1.RMB', 4], ['beautiful-villages', 'TVRNAM03.RMB', 10],
      ['beautiful-cities', 'BANKAL03.RMB', 13], ['beautiful-cities', 'BOOKAL01.RMB', 12], ['beautiful-cities', 'GENRAL02.RMB', 1],
      ['beautiful-cities', 'KOWLAL00.RMB', 14], ['beautiful-cities', 'KSCAAL01.RMB', 7], ['beautiful-cities', 'MAGEAA12.RMB', 4],
      ['beautiful-cities', 'TVRNAL10.RMB', 2], ['beautiful-cities', 'WALLAA10.TVRNAS01.RMB', 5], ['beautiful-cities', 'WALLAA11.TVRNAS00.RMB', 9],
      ['beautiful-cities', 'WALLAA11.TVRNAS02.RMB', 8],
    ],
    markers: [{ record: 18, at: [-131, 131, 100], to: [-108, 0, 132] }],
  },
  {
    design: 'ARMRAM02.RMB#4', buildingType: 18,
    where: [
      ['beautiful-villages', 'ARMRAM02.RMB', 4], ['beautiful-villages', 'BANKAM02.RMB', 3], ['beautiful-villages', 'BANKAM02.RMB', 13],
      ['beautiful-villages', 'GEMSAM02.RMB', 10], ['beautiful-villages', 'PAWNAM01.RMB', 4], ['beautiful-villages', 'TVRNAS04.RMB', 3],
      ['beautiful-cities', 'ARMRAL01.RMB', 13], ['beautiful-cities', 'DARKAA02.RMB', 8], ['beautiful-cities', 'KHORAL00.RMB', 12],
      ['beautiful-cities', 'MAGEAA04.RMB', 2], ['beautiful-cities', 'TEMPAAD0.RMB', 10], ['beautiful-cities', 'TVRNAL09.RMB', 2],
      ['beautiful-cities', 'TVRNAL09.RMB', 8],
    ],
    markers: [{ record: 11, at: [36, 148, -72], to: [30, 0, -80] }],
  },
  {
    design: 'ALCHAM00.RMB#4', buildingType: 18,
    where: [
      ['beautiful-villages', 'ALCHAM00.RMB', 4], ['beautiful-villages', 'GENRAS04.RMB', 4], ['beautiful-villages', 'TEMPASG0.RMB', 8],
      ['beautiful-cities', 'DARKAA01.RMB', 2], ['beautiful-cities', 'DARKAA01.RMB', 8], ['beautiful-cities', 'FIGHAA00.RMB', 7],
      ['beautiful-cities', 'KSCAAL00.RMB', 9], ['beautiful-cities', 'LIBRAL02.RMB', 1], ['beautiful-cities', 'TEMPAAD0.RMB', 5],
      ['beautiful-cities', 'TEMPAAD0.RMB', 21], ['beautiful-cities', 'TEMPAAG0.RMB', 6], ['beautiful-cities', 'TVRNAL08.RMB', 6],
    ],
    markers: [{ record: 11, at: [52, 128, -192], to: [4, 0, -100] }],
  },
  {
    design: 'BANKAM01.RMB#4', buildingType: 18,
    where: [
      ['beautiful-villages', 'BANKAM01.RMB', 4], ['beautiful-villages', 'MANRAS02.RMB', 3], ['beautiful-villages', 'PAWNAM00.RMB', 7],
      ['beautiful-villages', 'TVRNAM07.RMB', 9], ['beautiful-villages', 'TVRNAS08.RMB', 5], ['beautiful-cities', 'GEMSAL00.RMB', 7],
      ['beautiful-cities', 'GEMSAL00.RMB', 8], ['beautiful-cities', 'KRAVAL01.RMB', 11], ['beautiful-cities', 'KROSAL01.RMB', 9],
      ['beautiful-cities', 'LIBRAL01.RMB', 4], ['beautiful-cities', 'LIBRAL02.RMB', 11], ['beautiful-cities', 'WALLAA11.TVRNAS01.RMB', 8],
    ],
    markers: [{ record: 11, at: [4, 126, 256], to: [-64, 0, 60] }],
  },
  {
    design: 'GEMSAM01.RMB#12', buildingType: 18,
    where: [
      ['beautiful-villages', 'GEMSAM01.RMB', 12], ['beautiful-villages', 'TEMPASD0.RMB', 1], ['beautiful-cities', 'BOOKAL00.RMB', 12],
      ['beautiful-cities', 'BOOKAL01.RMB', 13], ['beautiful-cities', 'KDRAAL00.RMB', 9], ['beautiful-cities', 'KOWLAL00.RMB', 5],
      ['beautiful-cities', 'TEMPAAD0.RMB', 0], ['beautiful-cities', 'TEMPAAD0.RMB', 17], ['beautiful-cities', 'TEMPAAE0.RMB', 11],
      ['beautiful-cities', 'THIEAL00.RMB', 13], ['beautiful-cities', 'TVRNAL09.RMB', 4], ['beautiful-cities', 'WALLAA10.TVRNAS01.RMB', 6],
    ],
    markers: [{ record: 11, at: [-24, 125, 52], to: [28, -2, 216] }],
  },
  {
    design: 'GENRAM00.RMB#8', buildingType: 18,
    where: [
      ['beautiful-villages', 'GENRAM00.RMB', 8], ['beautiful-villages', 'GENRAM02.RMB', 3], ['beautiful-cities', 'ALCHAL01.RMB', 7],
      ['beautiful-cities', 'DARKAA02.RMB', 2], ['beautiful-cities', 'KHORAL01.RMB', 8], ['beautiful-cities', 'KROSAL00.RMB', 1],
      ['beautiful-cities', 'KROSAL00.RMB', 10], ['beautiful-cities', 'MAGEAA04.RMB', 13], ['beautiful-cities', 'TEMPAAC0.RMB', 16],
      ['beautiful-cities', 'TVRNAL06.RMB', 4], ['beautiful-cities', 'TVRNAL08.RMB', 10],
    ],
    markers: [{ record: 18, at: [-192, -128, 44], to: [-198, 0, 170] }],
  },
  {
    design: 'BANKAM00.RMB#2', buildingType: 18,
    where: [
      ['beautiful-villages', 'BANKAM00.RMB', 2], ['beautiful-villages', 'BANKAM02.RMB', 10], ['beautiful-villages', 'CLOTAS01.RMB', 6],
      ['beautiful-villages', 'GEMSAM00.RMB', 7], ['beautiful-villages', 'THIEAM00.RMB', 3], ['beautiful-cities', 'KHORAL00.RMB', 14],
      ['beautiful-cities', 'MAGEAA04.RMB', 7], ['beautiful-cities', 'MAGEAA13.RMB', 1], ['beautiful-cities', 'PAWNAL03.RMB', 7],
    ],
    markers: [{ record: 11, at: [-194, -128, 62], to: [-216, 0, 170] }],
  },
  {
    design: 'BANKAM00.RMB#7', buildingType: 18,
    where: [
      ['beautiful-villages', 'BANKAM00.RMB', 7], ['beautiful-villages', 'GENRAM00.RMB', 3], ['beautiful-villages', 'MANRAS01.RMB', 0],
      ['beautiful-villages', 'THIEAM00.RMB', 9], ['beautiful-cities', 'BANKAL01.RMB', 2], ['beautiful-cities', 'BANKAL01.RMB', 9],
      ['beautiful-cities', 'KHORAL01.RMB', 4], ['beautiful-cities', 'PAWNAL03.RMB', 4], ['beautiful-cities', 'TVRNAL04.RMB', 13],
    ],
    markers: [{ record: 11, at: [-184, -128, -7], to: [-194, 0, 180] }],
  },
  {
    design: 'GEMSAM03.RMB#12', buildingType: 18,
    where: [
      ['beautiful-villages', 'GEMSAM03.RMB', 12], ['beautiful-villages', 'TEMPASA0.RMB', 18], ['beautiful-villages', 'TVRNAM05.RMB', 0],
      ['beautiful-cities', 'FIGHAA01.RMB', 13], ['beautiful-cities', 'KOWLAL01.RMB', 11], ['beautiful-cities', 'TEMPAAA0.RMB', 7],
      ['beautiful-cities', 'TVRNAL05.RMB', 8], ['beautiful-cities', 'WALLAA10.TVRNAS01.RMB', 11],
    ],
    markers: [{ record: 11, at: [80, 128, 234], to: [-148, 1, 154] }],
  },
  {
    design: 'BANKAM01.RMB#1', buildingType: 18,
    where: [
      ['beautiful-villages', 'BANKAM01.RMB', 1], ['beautiful-cities', 'BANKAL01.RMB', 10], ['beautiful-cities', 'GEMSAL01.RMB', 11],
      ['beautiful-cities', 'KFLAAL00.RMB', 6], ['beautiful-cities', 'KFLAAL00.RMB', 10], ['beautiful-cities', 'MAGEAA11.RMB', 5],
      ['beautiful-cities', 'TEMPAAD0.RMB', 3],
    ],
    markers: [{ record: 11, at: [120, 128, 8], to: [160, -2, -214] }],
  },
  {
    design: 'TEMPASF0.RMB#7', buildingType: 18,
    where: [
      ['beautiful-villages', 'TEMPASF0.RMB', 7], ['beautiful-cities', 'GENRAL01.RMB', 16], ['beautiful-cities', 'MAGEAA10.RMB', 1],
      ['beautiful-cities', 'MAGEAA10.RMB', 10], ['beautiful-cities', 'TEMPAAF0.RMB', 16], ['beautiful-cities', 'TVRNAL00.RMB', 15],
      ['beautiful-cities', 'TVRNAL00.RMB', 16],
    ],
    markers: [{ record: 11, at: [-118, 127, -324], to: [-38, 0, -152] }],
  },
  {
    design: 'DARKAA01.RMB#11', buildingType: 18,
    where: [
      ['beautiful-cities', 'DARKAA01.RMB', 11], ['beautiful-cities', 'GEMSAL02.RMB', 8], ['beautiful-cities', 'KFLAAL00.RMB', 8],
      ['beautiful-cities', 'MAGEAA01.RMB', 7], ['beautiful-cities', 'MAGEAA06.RMB', 8], ['beautiful-cities', 'TVRNAL08.RMB', 1],
    ],
    markers: [{ record: 11, at: [-68, 150, -116], to: [-72, 0, -97] }],
  },
  {
    design: 'GEMSAM02.RMB#13', buildingType: 18,
    where: [
      ['beautiful-villages', 'GEMSAM02.RMB', 13], ['beautiful-villages', 'TVRNAM00.RMB', 13], ['beautiful-villages', 'WEAPAS00.RMB', 4],
      ['beautiful-cities', 'GEMSAL03.RMB', 2], ['beautiful-cities', 'TVRNAL04.RMB', 4], ['beautiful-cities', 'TVRNAL09.RMB', 10],
    ],
    markers: [{ record: 11, at: [-200, -138, 88], to: [-174, 0, 86] }],
  },
  {
    design: 'TVRNAS01.RMB#1', buildingType: 18,
    where: [
      ['beautiful-villages', 'TVRNAS01.RMB', 1], ['beautiful-cities', 'KOWLAL01.RMB', 5], ['beautiful-cities', 'MAGEAA00.RMB', 16],
      ['beautiful-cities', 'MAGEAA00.RMB', 17], ['beautiful-cities', 'MAGEAA12.RMB', 7],
    ],
    markers: [{ record: 11, at: [76, 127, 270], to: [-44, -2, 170] }],
  },
  {
    design: 'RESIAS09.RMB#5', buildingType: 18,
    where: [
      ['beautiful-villages', 'RESIAS09.RMB', 5], ['beautiful-villages', 'TEMPASH0.RMB', 4], ['beautiful-cities', 'FIGHAA01.RMB', 9],
      ['beautiful-cities', 'TEMPAAB0.RMB', 1],
    ],
    markers: [{ record: 11, at: [22, 129, 10], to: [206, 0, -126] }],
  },
  {
    design: 'ARMRAM01.RMB#7', buildingType: 18,
    where: [
      ['beautiful-villages', 'ARMRAM01.RMB', 7], ['beautiful-villages', 'TVRNAM00.RMB', 9], ['beautiful-cities', 'BANKAL00.RMB', 3],
    ],
    markers: [{ record: 11, at: [-334, 128, -316], to: [-254, 0, -22] }],
  },
  {
    design: 'DALIBRBL01.RMB#14', buildingType: 10,
    where: [
      ['beautiful-cities', 'DALIBRBL01.RMB', 14],
    ],
    markers: [{ record: 11, at: [540, 0, -100], to: [364, 0, -100] }, { record: 11, at: [335, 0, -200], to: [364, 0, -130] }],
  },
  {
    design: 'DALIBRBL03.RMB#3', buildingType: 10,
    where: [
      ['beautiful-cities', 'DALIBRBL03.RMB', 3],
    ],
    markers: [{ record: 11, at: [540, 0, -100], to: [364, 0, -100] }, { record: 11, at: [335, 0, -200], to: [364, 0, -130] }],
  },
]);

const UNIT = 0.025;   // MeshReader.GlobalScale
const BY_BUILDING = new Map();   // `${block}#${record}` -> [{ vendor, markers }]
for (const d of CURATED_QUEST_MARKERS) {
  Object.freeze(d);
  for (const [vendor, block, record] of d.where) {
    const k = `${block}#${record}`;
    (BY_BUILDING.get(k) ?? BY_BUILDING.set(k, []).get(k)).push({ vendor, markers: d.markers });
  }
}
const same = (a, x, y, z) => a[0] === x && a[1] === y && a[2] === z;

/** Where a building's quest marker stands - its floor spot [xPos, yPos, zPos] where the curation moves it, else null.
 *  Only a block a town pack serves (the door's `fromWorldData`) under a name the listed pack carries, and a marker of
 *  that record at that very position: Daggerfall's own blocks, and any other interior, are as they were. */
export function curatedMarkerSpot(dfBlock, recordIndex, textureRecord, xPos, yPos, zPos) {
  if (!dfBlock?.fromWorldData || !dfBlock.name) return null;
  for (const { vendor, markers } of BY_BUILDING.get(`${dfBlock.name}#${recordIndex}`) ?? []) {
    if (!worldDataVendorCarries(vendor, blockReplacementFilename(dfBlock.name))) continue;
    const m = markers.find((k) => k.record === textureRecord && same(k.at, xPos, yPos, zPos));
    if (m) return [...m.to];
  }
  return null;
}

/** A building site enumerated before the curation keeps the markers it was given: every one standing where the
 *  curation moves it (the spawn list, the item list, the selected marker) is moved, what it holds with it. Answers how
 *  many moved. */
export function curateSiteMarkers(siteDetails, dfBlock, recordIndex) {
  let moved = 0;
  const mend = (m, record) => {
    const p = m?.flatPosition;
    if (!p) return;
    const spot = curatedMarkerSpot(dfBlock, recordIndex, record, Math.round(p.x / UNIT), Math.round(-p.y / UNIT) || 0, Math.round(p.z / UNIT));
    if (!spot) return;
    m.flatPosition = { x: spot[0] * UNIT, y: -spot[1] * UNIT, z: spot[2] * UNIT };
    moved++;
  };
  for (const m of siteDetails?.questSpawnMarkers ?? []) mend(m, 11);
  for (const m of siteDetails?.questItemMarkers ?? []) mend(m, 18);
  mend(siteDetails?.selectedMarker, siteDetails?.selectedMarker?.markerType);
  return moved;
}
