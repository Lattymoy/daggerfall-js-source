// @ts-check
// IC-INTERIORS (2026-10-27, the owner's field report, item 5: "Interiors in the Imperial city need to match their exterior
// with varied layouts"; bible/03-World/Arena-Provinces.md IC-INTERIORS) - A MADE BUILDING'S QUEST MARKERS, WHERE ITS ROOMS
// STAND THEM.
//
// DFU's law: a building site holds its markers where its interior's record stands them (Place.EnumerateBuildingQuestMarkers
// - the flat records' own positions), and the mount stands a quest's things there (QuestMachine's AddQuestResourceObjects).
// An Imperial City building's interior is MADE (world/imperialFabricBuildings.js fabricBuildingInterior: laid from
// Daggerfall's kit to its footprint, its donor's cast stood again in its rooms), and made when it is first read: a quest's
// site search walks thousands of a slice's buildings and makes none, so it holds a made building's markers as its cast's
// record holds them (place.js _enumerateBuildingQuestMarkers - world/interior/interiorLayout.js interiorCast), as a save
// from before IC-INTERIORS holds them too (BLD stood the donor's interior whole).
// DEPARTURE (named; Port-Ledger section A, IC-INTERIORS): when such a building is entered, before its quest things stand
// (scenes/quest/questBridge.js mountScene), each of its sites' markers is laid on the made interior's own - the cast's n-th
// spawn marker on the room's n-th, its n-th item marker on the n-th (the made interior stands the cast's markers in the
// cast's order) - the marker's old spot kept (`curatedFrom`, as the town packs' curation keeps it: a quest foe a save
// stood there follows it - markerCuration.js mendedFoeSpot). A site whose markers stand there already is left as it is.

const UNIT = 0.025; // MeshReader.GlobalScale
const EDITOR_FLATS = 199,
  SPAWN = 11,
  ITEM = 18;
const BUILDING_SITE = 3; // place.js SITE_TYPES.Building

const at = (f) => ({ x: f.xPos * UNIT, y: -f.yPos * UNIT, z: f.zPos * UNIT });
const same = (a, b) =>
  !!a && !!b && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;

/**
 * A SITE'S MARKERS LAID ON ITS MADE INTERIOR (`interior` - its records, world/imperialFabricBuildings.js): each of the site's
 * spawn and item markers on the interior's own of its kind and number, its selected marker on the one it was a copy of.
 * A site whose lists are not the cast's (another count) is left alone. Answers how many moved.
 * @param {any} siteDetails @param {any} interior
 */
export function layCastMarkers(siteDetails, interior) {
  const own = { [SPAWN]: [], [ITEM]: [] };
  for (const f of interior?.blockFlatObjectRecords ?? [])
    if (f.textureArchive === EDITOR_FLATS && own[f.textureRecord]) own[f.textureRecord].push(at(f));
  const lists = [
    [siteDetails?.questSpawnMarkers ?? [], own[SPAWN]],
    [siteDetails?.questItemMarkers ?? [], own[ITEM]],
  ];
  if (lists.some(([held, laid]) => held.length !== laid.length)) return 0;
  let moved = 0;
  const move = (m, p) => {
    if (same(m.flatPosition, p)) return;
    m.curatedFrom ??= { ...m.flatPosition };
    m.flatPosition = { ...p };
    moved++;
  };
  // the selected marker by the marker it was copied from, found before any moves
  const sel = siteDetails?.selectedMarker;
  let selTo = null;
  if (sel?.flatPosition) {
    for (const [held, laid] of lists) {
      const n = held.findIndex((m) => same(m?.flatPosition, sel.flatPosition));
      if (n >= 0) {
        selTo = laid[n];
        break;
      }
    }
  }
  for (const [held, laid] of lists)
    held.forEach((m, n) => {
      if (m?.flatPosition) move(m, laid[n]);
    });
  if (selTo) move(sel, selTo);
  return moved;
}

/**
 * BEFORE A BUILDING'S MOUNT: every running quest's site in the building `buildingKey` of the map `mapId` whose interior is
 * made, its markers laid on that interior's (layCastMarkers) - the interior read as the site search reads its town
 * (place.js townBlockGrid: the world's `questBlock`, else its block). Answers how many markers moved.
 * @param {any} machine the quest machine (its site links and quests) @param {any} world the quest world @param {number} mapId
 * @param {number} buildingKey
 */
export function layMadeBuildingMarkers(machine, world, mapId, buildingKey) {
  if (!machine?.getSiteLinks || !world?.maps || !(buildingKey > 0)) return 0;
  let moved = 0;
  const seen = new Set();
  for (const link of machine.getSiteLinks(BUILDING_SITE, mapId, buildingKey) ?? []) {
    const place = machine.getQuest?.(link.questUID)?.getPlace?.(link.placeSymbol);
    const sd = place?.siteDetails;
    if (!sd || sd.siteType !== BUILDING_SITE || sd.buildingKey !== buildingKey || seen.has(sd)) continue;
    seen.add(sd);
    const location = place.siteTown?.(world);
    const name = location
      ? world.maps.getRmbBlockName?.(location, (buildingKey >> 16) & 0xff, (buildingKey >> 8) & 0xff)
      : null;
    const dfBlock = name ? (world.questBlock?.(name) ?? world.getBlock?.(name)) : null;
    const interior = dfBlock?.rmbBlock?.subRecords?.[buildingKey & 0xff]?.interior;
    if (interior?.made) moved += layCastMarkers(sd, interior);
  }
  return moved;
}
