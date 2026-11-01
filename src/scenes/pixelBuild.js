// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { ANIMAL_SOUND_BY_RECORD, ANIMALS_ARCHIVE } from '../systems/soundClips.js';
import { applyClimate, getNatureArchive, getTerrainGroundArchive, INTERIOR_SEASON, SEASON, winterSetSnowless } from '../world/climateSwaps.js';
import { SEA_LEVEL_M } from '../systems/weather/airTemperature.js';   // PRECIP4: heights above the sea, the snow's
import { ARENA_BLOCK } from '../world/arena/arenaCity.js';
import { armFlatAnim, FlatAnimator } from '../render/flatAnimation.js';
import { billboardSize, BLOCK_FLATS_OFFSET_Y, centredBase, collectBlockFlats, isNatureArchive, NATURE_FLATS_Y } from '../world/rmbFlats.js';
import { blockHillPatch, blockHillSeat, seatNatureFlat } from '../world/townStandIns.js';
import { blockSolids } from '../world/flatFields.js';
import { BODY } from '../world/windmillMesh.js';
import { boxNearGate, gateSiteTest, pointNearGate, WOD_FLAT_GATE_CLEAR_M } from '../world/gate/gateClearance.js';
import { boxNearPath, pointNearPath, UNITS_PER_METRE, WOD_PIECE_ROAD_CLEAR, wodPiecewise, wodSiteClear, wodSiteFootprint } from '../world/road/roadClearance.js';
import { buildingKeysOfType, castleEntranceOf, siegeFieldOf } from '../systems/siegeField.js';
import { buildingSummaries } from '../world/buildingSummaries.js';
import { waterSwitchOn } from '../render/waterSurface.js';
import { CITY_GATE_CLOSED_MODEL_ID, CITY_GATE_OPEN_MODEL_ID, isBulletinBoard, isCityGate } from '../world/rmbLayout.js';
import { carveLefay, isLefayTown, monumentSpotOf } from '../world/lefayMonument.js';
import { carveYards } from '../world/merchantYards/merchantYardSites.js';
import { carveCapitalWalks } from '../world/capitalWalks.js';   // FB1029 BRIDGE-ENDS
import { CityNavigation } from '../world/city/cityNavigation.js';
import { collectCityLights, LIGHTS_ARCHIVE } from '../world/city/cityLights.js';
import { collectExteriorNpcs, exteriorNpcRecord } from '../characters/exteriorNpcs.js';
import { coverProxies, coverProxy, FELLED, isCoverFlat } from '../ai/cover.js';
import { flatBodies, jungleBody } from '../world/propBodies.js';   // PROP-BODIES: the solid flats' bodies, beside their cover
import { DOOR_TYPE, GLOBAL_SCALE } from '../world/meshReader.js';
import { isHouseSign } from '../world/houseSigns.js';   // HOUSE-SIGN: a shop's sign at a house's door does not stand
import { doorCornersOf, doorNormalOf } from './hallBanners.js';
import { drawnFlat } from '../characters/nudeFlats.js';
import { ecoOrigin } from '../world/ecotone.js';
import { festivalBannerAnchors, festivalLanternsOf } from './seatFestival.js';
import { flatBatchAabb, localAabb, transformedAabb } from '../render/frustum.js';
import { floraSwayOf } from '../systems/wind/windDrive.js';
import { footGroundAt, footRectsAt, modelFootParts } from './homeYards.js';
import { FOREST_HIDDEN_LOCATION_TYPES, populatesWanderingNpcs, tamrielLandsOn } from './shared.js';
import { landGroundSet } from '../world/tamriel/tamrielLands.js';   // TESA-LANDS: a zone's dress of its ground
import { standLandProps, landFeetOff } from '../world/lands/landProps.js';   // TESA-LANDS: and its landmarks stood, its flats off their feet
import { climateNeighbourIn } from '../world/tamriel/tamrielGround.js';
import { getLocationTerrainTileOrigin, setLocationTiles, WORLD_MAP_TILE_DIM } from '../world/terrain/terrainTiles.js';
import { shapeBefore } from '../world/terrain/townBlendBefore.js';   // FB1028 YARDS Y2: the yards' outline as #1184 drew it
import { townWalkShut, yardWalkShut } from '../world/townWalls.js';   // TS6: a town's walkers on its own ground, never through its wall; TS7: and its yards
import { townGateRoads } from '../world/townGates.js';   // GATE-ROADS: a walled town's gates for their roads
import { townFabricFor, fabricWalkShut, fabricLift } from '../world/urban/townFabricStand.js';   // URBANIZER U3: a town past the Bay's streets, yards and dead ends
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { getStaticDoors } from '../world/staticDoors.js';
import { getWorldClimateSettings, LOCATION_TYPES } from '../formats/mapsFile.js';
import { questBoardIndices } from '../systems/bounty/bountyBoard.js';   // BOUNTY1: which boards' places are the bounty half - the siege field's Market is a rumour board's
import { groundOffPlane, lowestGroundUnder, surfaceHeightAt, walkGroundAt, TERRAIN_SKIRT_DEPTH, TERRAIN_TILE_DIM } from '../world/terrain/terrainSurface.js';   // FLORA-GROUND: walkGroundAt, the ground's one law
import { hasPort } from '../systems/travel/travelPorts.js';
import { portIdOf } from '../world/worldWide/worldPorts.js';   // WW3: a port's one number
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { HOLD_FLATS, HOLD_MODELS, holdFireLights, holdModelMatrix, PRIVATEERS_HOLD_BLOCK } from '../world/worldOfDaggerfall/wodPrivateersHold.js';
import { HOME_LOOK_BUILD_WAIT_MS, homeLookRemap } from '../world/homeLook.js';
import { homeLookSig } from '../net/homeLaw.js';
import { insideRocks, rockFootprint } from '../world/terrain/terrainNature.js';
import { isClimateFreeModel, NO_CLIMATE_REMAP, isSolidModel } from '../world/customModels.js';   // IC-GRAND: a far skyline is drawn, never solid
import { capitalBuildView, capitalViewOf, capitalBlockLift } from '../world/tamrielCapitals.js';   // IC-GRAND: the Imperial City's slices near and far; SOLITUDE-RELIEF: a block's tier
import { cityHomesOf } from '../world/imperialHomes.js';   // IC-GRAND x THE LIVING WORLD: the fabric's homes in its living town
import { isFabricDoorId } from '../world/imperialFabricBuildings.js';   // AUDIT TAMRIEL-WIDE A1: a terraced house has no yard
import { isDrySourceFlat, isWaterSourceFlat, WATER_SOURCE_MODELS } from '../systems/survival/items.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { stampPixelFade } from '../render/pixelFade.js';   // MID-RING: a pixel built past the near rings eases out of the middle ring's tint
import { midRingDisabled } from '../render/midRing.js';
import { overworldTint } from '../ui/overworldModel.js';
import { isHearthFlat } from '../systems/survival/hearth.js';
import { isPortTown } from '../systems/portPlaces.js';
import { isStandFlat, standFlatId, standFlatRecord } from '../world/standFlats.js';
import { isStandingHorseFlat } from '../world/standingHorses.js';
import { isTombstoneModel } from '../systems/searchables.js';
import { FOREST_STAMP, isTreeRecord, sinkFelled } from './treeHost.js';   // AUDIT PRECIP HOST-7: a re-skin's felled trees lie as they lay
import { seatFlora, standsOnGround, warmFlora } from './floraSeat.js';   // FLORA-GROUND, THE RINGS: every plant drawn on the ground its pixel draws
import { isWardenTown } from '../systems/wagon/wagonWarden.js';
import { isWodShrub, rockSeatDrop, WOD_ROCK_SITES, wodLightPosition, wodLightProperties } from '../world/worldOfDaggerfall/wodLocationObjects.js';
import { isYardTown } from '../systems/merchantYards.js';
import { keyResolver, StaticBatchBuilder } from '../render/staticBatch.js';
import { knownCriminal } from '../systems/standing.js';
import { layoutLocationSteps, RMB_SIDE } from '../world/locationLayout.js';   // IC-STUTTER: a town laid out a block a step; SOLITUDE-RELIEF: a block's side
import { legalRepOf } from '../systems/court.js';
import { LivingTown, livingTownPlaces } from '../systems/livingWorld/livingTown.js';   // IC-STUTTER: its places a step at a time
import { componentsSteps } from '../systems/travel/townWalk.js';   // IC-STUTTER: the town walk's pieces, flooded a step at a time
import { stepsBreathing } from '../world/puddleMask.js';   // IC-STUTTER: OW-HITCH's runner
import { livingWorldOn } from '../systems/livingWorld/livingSwitch.js';
import { LPT_CROWNS, LPT_TRUNKS } from '../world/lptCrowns.js';   // FB1020c TRUNK-FIT: and each prototype's trunk at the ground
import { LPT_SCALE_MAX, lptVariety } from '../world/lowPolyTrees.js';
import { JUNGLE_ARCHIVE, JUNGLE_MEASURES, JUNGLE_SPECIES, jungleCover } from '../world/jungle/jungleModels.js';
import { JUNGLE } from '../world/terrain/jungleNature.js';   // AUDIT BANTHA1 PERF-5: the storeys' scales   // BANTHA1: the jungle's trees, their measures and their cover
import { JUNGLE_SCALE_MAX, JUNGLE_SUN_LIFT } from '../systems/jungleTreesAssets.js';
import { keptPairs, standRoadside } from './roadsidePairs.js';   // JUNGLE-ROADSIDE: the owner's pairs astride the jungle's roads
/** AUDIT BANTHA1 TREE-1: a pixel's cover stood this many proxies at a time, the stream breathing between. */
const COVER_SLICE = 2048;
import { lptFitCap, lptTrunkCap, natureReach, pathTileMask, vergeClear } from '../world/road/roadVerge.js';   // FB1020c TRUNK-FIT: lptTrunkCap
import { makeBuildingKey } from '../systems/talk/talkTopics.js';
import { makeCityGate } from '../world/city/cityGate.js';
import { markRemapLaw, remapAsked, remapLawOf, remapSubMeshes, reskinRemap } from '../world/texRemap.js';
import { MobilePerson, PERSON_MOVE_SPEED, walkerRace } from '../characters/mobile/mobilePerson.js';
import { folkOfLocation, folkKeyOf } from '../characters/provinceFolk.js';   // PROVINCE-FOLK; REGION-NAMES: whose people
import { multiply, trs } from '../world/mat4.js';
import { naturePicture, junglePicture } from '../world/naturePicture.js';
import { onFloatingFrame } from '../player/collider.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';
import { standGhostfence, fireClearing, clearedLandProps } from './ghostfenceBuild.js';   // GHOSTFENCE: the Tribunal's fence round Red Mountain; LAVA-CLEAR, FENCE-CLEAR: nothing stood in its lava or its line
import { arenaRoadsLayer } from '../world/arenaRoads.js';   // TESA4: the roads past the Bay's layer
import { provinceNameBank } from '../world/tamrielPeople.js';   // TESA3: a province's people's names
import { ownMinutes, skyMinutes, trustedWorldMinutes } from '../systems/worldTick.js';
import { palaceKeysOf, seatBannerAnchors, townCentreOf } from './seatBanners.js';
import { playerEntity } from '../characters/playerEntity.js';
import { racialSuppressPopulationSpawns } from '../systems/lycanthropy.js';
import { ResidentWalker } from '../characters/residentWalker.js';
import { rotorPhase, windmillsOn } from '../world/windmills.js';
import { archivePrefix as seasonPrefixOf } from '../systems/seasonsIliacBay.js';
import { seatAtMapId } from '../systems/town/townSeats.js';
import { setLastLocationKeyTo } from '../systems/worldDataVariants.js';
import { staticBuildingBox, staticBuildingWorldAabb } from '../world/staticBuildings.js';
import { BUILDING_TYPES as TALK_BUILDING_TYPES } from '../world/buildingNames.js';
import { TownPopulation } from '../systems/town/townPopulation.js';
import { windfallResponse } from '../systems/windfall.js';
import { colliderBlocked, dryGround, witchesDressingBreathing } from '../world/witchesDecor.js';   // WITCH1: the Witches' Festival's dressing and its Wyrd Sisters
import { wodRockUvs } from '../world/worldOfDaggerfall/wodRockUv.js';
import { WodSpawner } from '../world/worldOfDaggerfall/wodSpawner.js';
import { lateSolidsOf } from '../player/lateSolid.js';   // ROCK-CLEAR: a pixel's statics built round a body already standing are withheld until it is clear
import { standBridges } from '../world/road/bridgeModels.js';   // ROAD-LOOK: a road over a river wider than a ford crosses on a bridge
import { meetsTown } from './townMeetsHost.js';   // ACROSS-EDGE: the towns a pixel's ground meets
import { sightMarksOf } from '../world/signSolid.js';   // FIELD BUGS 2026-10-25i SIGN-PASS: a shop's sign stops a body where it stands, never where it hangs

/** WL1: the renderer's word on which pictures may hold glass, for a static batch's merge to measure their windows. */
const windowKeys = (r) => (r?.wlGlassKey ? (a, rec) => r.wlGlassKey(a, rec) : null);

/** @param {any} host */
export function createPixelBuild(host) {
  const {
    MILL_SAIL_PAD, TERRAIN_INDICES, TERRAIN_INDICES_LOD, _building, _dwRubble, _dwRubbleCarry, _groundBefore,
    _livingPatrons, _locationToBuild, spawnGroundPlace, _lptSway, _lptWindfall, _reskin, adoptWodCarry, archAabb, blocks,
    breather, buildingDoors, built, chapterSheet, climates3x3, collider, cpuModels, deepWaters, destroyPixel,
    dfMeshSize, dwDecor, ecotones, ensurePersonTex, forests, gateClearSweep, getTexture, getWindmillMeshes,
    halfWidthsOf, heightAt, heightCell, holdPixel, hostBed, jungle, labGrass, landform, livingArmOf, livingAshore,
    livingBaseRate, livingCarriedOf, livingChapterOf, livingCrews, livingCycleOf, livingDeadAt, livingFlatOf,
    livingKilled, livingPlaceOf, livingRate, livingSlay, livingTownAt, livingTripsOf, loadGroundSet, lookOfHome,
    lowPolyTrees, maps, modelFeetOf, onlineHomes, personTex, playerTravelPixel, portOnSea, renderer, restrideTerrain,
    seasons, siegeFieldsByTown, snowCover, snowfall, standPixelNpcs, standWodPile, strideFor, terrainGen, tileSide,
    townEcon, townPlacesFor, townSeats, verges, waterOn, wod, wodForgetPeerSites, wodOpened, wodPathsPoint,
    worldHeight, lodStride,   // FLORA-GROUND, THE RINGS: the far ring's class (scenes/floraSeat.js warmFlora)
    provinceAt, arenaRoadsStale, _arenaRoadsStale, swap,   // IC-SWAP-BEHIND: a rebuild built behind its view (scenes/swapBehind.js); TESA: the province past the Bay, the Arena roads' stale law and its set
    townMeets   // ACROSS-EDGE: the towns its ground meets (scenes/townMeetsHost.js)
  } = host;
  // ROCK-CLEAR (FIELD BUGS 2026-10-19f): the world collider's one gate - every solid the build files below goes through
  // it, so a part standing round the body (a neighbour's mountain reaching into the body's pixel, a pixel built round a
  // body that outran the stream) is drawn and solid only once the body is clear of it (player/lateSolid.js); the body
  // is the world's, the one its frame settles the gate with (none while a jump's landing builds - its law reads it whole)
  const late = lateSolidsOf(collider);
  // TESA-LANDS (bible/03-World/Tamriel-Lands.md): the lands past the Bay - read once, as the world mounts (its row's
  // law: a flip reaches the next world); a pixel's ground set its zone's dress where the lands stand
  const lands = tamrielLandsOn();
  const landSetOf = (x, y, archive) => (lands ? landGroundSet(x, y, archive, winterSetSnowless) : archive);   // the second audit: a snowless winter its summer's dress
  /** a 3x3 neighbour's set (k: (dz + 1) * 3 + (dx + 1), dx east, dz north - the map row py - dz): its own zone's dress
   *  where the 3x3 reads it (climateNeighbourIn - a Bay pixel's neighbour off the Bay wears the pixel's own, undressed) */
  const neighbourSet = (px, py, k, archive) => {
    const x = px + (k % 3) - 1, y = py - (Math.floor(k / 3) - 1);
    return climateNeighbourIn(px, py, x, y) ? landSetOf(x, y, archive) : landSetOf(px, py, archive);
  };
  /**
   * THE FLATS' GROUPS STOOD (AUDIT PRECIP HOST-7: the build's and a re-skin's one law) - a batch a drawn picture, each
   * flat's group (`g.groups`, its centres) stood as Low Poly Trees' far picture, the Seasons mod's record or the plain
   * record (world/naturePicture.js), with its sway, its windfall, its forest, its cover and its far pictures' handles
   * written into `out` as each is made (BUILD-FAIL1's ledger holds the build's).
   * @param {{ px: number, py: number, groups: Map<string, number[][]>, wild: Set<string>, natureSet: Set<number>,
   *   natureBase: (a: number) => number|undefined, tilemap: any, paths: any, vergeNet: any, uploadRecord: Function,
   *   uploadRecordFrame: Function, flatAnims: any, unionBox: (b: number[]) => void }} g
   * @param {{ batches: any[], forestGroups: Map<string, any>, coverItems: any[], lptHandles: any[], lptGroups: any[] }} out
   */
  async function standFlatGroups(g, { batches, forestGroups, coverItems, lptHandles, lptGroups }) {
    let lptPathMask = null;   // LPT-FIT: the pixel's path tiles, made at its first fitted tree
    // FB1020c TRUNK-FIT: THE PIXEL'S SOLID THINGS, measured before any tree is stood - a fountain, a well, a crate, a statue:
    // PROP-BODIES' own bodies (world/propBodies.js flatBody, each foot off its own picture) of every flat of no nature
    // archive (rmbFlats.js isNatureArchive - a block's own tree is no solid thing, nor a rock of its scenery). Asked first
    // because the groups meet in the order the pixel's flats were stood, a town's fountain after a tree it stands by; each
    // at naturePicture's `plain` (the record's own: Seasons of the Iliac Bay re-skins the nature archives alone).
    const solids = [];
    for (const [k, centers] of g.groups) {
      const [archive, record] = k.split('_').map(Number);
      if (isNatureArchive(archive)) continue;
      const t = await getTexture(archive);
      if (record < t.recordCount) solids.push(...flatBodies(t, archive, record, billboardSize(t, record), centers));
    }
    for (const [k, centers] of g.groups) {
      await breather.breathe();   // PERF-EXT23: a flat group a breath - its texture is a cached promise, a microtask, and gave no frame back
      const [archive, record] = k.split('_').map(Number);
      const t = await getTexture(archive);
      if (record >= t.recordCount) continue;
      // SIB1: what MaterialReader's cache holds for this archive NOW -
      // the mod's seasonal record (its texture at the mod's size, one
      // frame) while a season is installed over it, the classic record
      // otherwise. The seasonal texture keys on the install so a later
      // season never reads an earlier one's upload.
      // LPT1: A FLAT LOW POLY TREES HAS A TREE FOR stands as that tree's far picture - the batch sized for the tallest
      // tree it stands, each flat's own scale on its corner - and as the tree itself near the eye (the pixel's
      // `lowPolyTrees` set). Its cover, its sway, its forest and the far rings' rule are the flat's own (the season's,
      // while one stands). AUDIT 05b A12: the choice is every host's one (world/naturePicture.js - a location's, a yard's)
      const { sib, proto: lpt, far, plain, key: rkey } = await naturePicture({ door: lowPolyTrees, seasons: host.seasonsActive ? seasons : null, renderer, uploadRecord: g.uploadRecord }, t, archive, record);
      coverItems.push(...flatBodies(t, archive, record, plain, centers, { tree: g.natureSet.has(archive) && isTreeRecord(g.natureBase(archive), record) }));   // PROP-BODIES: the record's own, whichever picture stands
      if (far) {
        lowPolyTrees.acquire(far); lptHandles.push(far);   // AUDIT LPT B5: held until the pixel goes
        const scales = new Float32Array(centers.length), wild = new Uint8Array(centers.length);
        // LPT-FIT (Mac: "roads still show on roads and pathways. You're not taking the entire model into account"):
        // under clear roadsides every tree here - a location's as well as the wild's - is drawn no wider than the room
        // its root has from the pixel's roads, tracks and streets (world/road/roadVerge.js lptFitCap): its crown, turned
        const crown = verges ? (LPT_CROWNS[lpt.key] ?? 0) : 0;
        if (crown > 0 && !lptPathMask) lptPathMask = pathTileMask(g.tilemap, g.paths);
        const trunk = LPT_TRUNKS[lpt.key] ?? 0;   // FB1020c TRUNK-FIT: its trunk where it meets the ground (world/lptCrowns.js)
        const fit = crown > 0 || (trunk > 0 && solids.length) ? new Float32Array(centers.length) : null;
        centers.forEach((c, i) => {
          wild[i] = g.wild.has(`${k}#${i}`) ? 1 : 0;
          const v = lptVariety(g.px, g.py, c[0], c[2], !wild[i]).scale;
          if (fit) fit[i] = lptFitCap(lptPathMask, g.vergeNet, g.px, g.py, c[0], c[2], crown, v);
          // FB1020c TRUNK-FIT (world/road/roadVerge.js lptTrunkCap): a location's tree no wider than its trunk's room to the
          // pixel's solid things - the wild's stand clear of the sites' by their own placing (FOREST1's clearings, VERGE1)
          if (fit && !wild[i]) fit[i] = Math.min(fit[i], lptTrunkCap(solids, c[0], c[2], trunk, v));
          scales[i] = (fit ? Math.min(v, fit[i]) : v) / LPT_SCALE_MAX;
        });
        lptGroups.push({ h: lptHandles.length - 1, centers, wild, fit });
        const batch = renderer.createBillboardBatch(archive, far.record, far.size, centers, { scales });
        batch.lptProto = far;
        batch.farH = plain.h;   // AUDIT LPT A8/B1: MAC1's far rings stand the trees they stood - the flat's height, not the picture's
        batch._box = flatBatchAabb(centers, far.size);
        batch.sway = floraSwayOf(archive, g.natureSet, plain.h);
        _lptSway.set(lpt, Math.max(_lptSway.get(lpt) ?? 0, batch.sway));
        batch.windfall = windfallResponse(archive, record);   // WINDFALL1: its record's wind mask - the stock record's (Low Poly Trees' tree stands for it, not the season's picture)
        _lptWindfall.set(lpt, Math.max(_lptWindfall.get(lpt) ?? 0, batch.windfall));
        g.unionBox(batch._box);
        batches.push(batch);
        if (g.natureSet.has(archive)) forestGroups.set(k, { batch, centers, size: far.size, scales });   // PROF4: a felled tree's batch - it falls as its far picture
        if (isCoverFlat(archive, record, plain)) for (const c of centers) coverItems.push(...coverProxies(c, plain, { tree: g.natureSet.has(archive) && isTreeRecord(g.natureBase(archive), record) }));
        continue;
      }
      if (sib) {   // uploaded under the install's key, with no mip chain (AUDIT 61) - world/naturePicture.js
        const batch = renderer.createBillboardBatch(archive, rkey, sib.size, centers);
        batch._box = flatBatchAabb(centers, sib.size);   // EV3
        batch.sway = floraSwayOf(archive, g.natureSet, sib.size.h);   // WIND3: the season's trees lean too
        batch.windfall = windfallResponse(archive, record, seasonPrefixOf(seasons.installedSeason, archive));   // WINDFALL1: the mod's table for the season's atlas
        g.unionBox(batch._box);
        batches.push(batch);
        if (g.natureSet.has(archive)) forestGroups.set(k, { batch, centers, size: sib.size });   // PROF4: a felled tree's batch
        if (isCoverFlat(archive, record, sib.size)) for (const c of centers) coverItems.push(...coverProxies(c, sib.size, { tree: g.natureSet.has(archive) && isTreeRecord(g.natureBase(archive), record) }));   // AUDIT TACT B2: a tree's trunk and crown
        continue;
      }
      const size = plain;   // the record, uploaded (world/naturePicture.js)
      const batch = renderer.createBillboardBatch(archive, record, size, centers);
      batch._box = flatBatchAabb(centers, size);   // EV3
      batch.sway = floraSwayOf(archive, g.natureSet, size.h);   // WIND3: the flora lean with the wind, nothing else does
      batch.windfall = windfallResponse(archive, record);   // WINDFALL1: its record's wind mask - every nature batch, as the mod patches them (TryPatchBatch: 500..511)
      g.unionBox(batch._box);
      armFlatAnim(batch, t, archive, record, g.flatAnims, g.uploadRecordFrame);
      batches.push(batch);
      if (g.natureSet.has(archive)) forestGroups.set(k, { batch, centers, size });   // PROF4: a felled tree's batch
      if (isCoverFlat(archive, record, size)) for (const c of centers) coverItems.push(...coverProxies(c, size, { tree: g.natureSet.has(archive) && isTreeRecord(g.natureBase(archive), record) }));   // AUDIT TACT B2: a tree's trunk and crown
    }
  }
  async function buildPixelNow(px, py, { roadsRetry = false } = {}) {
    breather.reset();   // PERF7
    // IC-SWAP-BEHIND (scenes/swapBehind.js): `key` the build's own (its buckets, cover, gates, hold and ledger - the behind
    // key while its pixel's view stands), `pkey` the pixel's (what stands in `built`, its carries, its stale sets)
    const pkey = `${px},${py}`, key = swap.keyFor(px, py), pipeline = holdPixel(key), { getGpuMesh, uploadRecord, uploadRecordFrame } = pipeline;   // FIELD BUGS 2026-10-04d PLACE-LRU: THE PIXEL'S HOLD, the host's three doors and `pipeline` itself shadowed for the whole build - its models, its flats and their frames, its climate's and its homes' swaps (remapSubMeshes / homeLookRemap take this `pipeline`) are held for THIS pixel, released by destroyPixel (or BUILD-FAIL1's ledger), and freed once no standing or kept place holds them. The mills' parts stay the host's (getWindmillMeshes, pinned): millParts outlives every pixel
    const made = {};   // BUILD-FAIL1: this build's ledger, until publish hands it to the entry
    _building.set(key, made);
    const dfLocation = capitalBuildView(_locationToBuild(px, py), px, py, host.state.current) || null;   // SPAWNED-DUNGEONS1: an empty pixel may stand one (AUDIT OW5b D2: a spawn the index holds asked its clocks); IC-GRAND: a slice of the Imperial City far from the player its far view (world/tamrielCapitals.js capitalBuildView)
    const farView = capitalViewOf(dfLocation) === 'far';   // IC-GRAND: no walker, yard nor port stands a far slice - its blocks close no ground
    // GROUND-AGREE (bible/01-Overview/bugs/Field-Bugs-2026-10-24b.md): the terrain is shaped for the place the roll stands
    // here, alive or dead (world/spawnGroundPlace.js) - every client's the same - and what STANDS is dfLocation's alone
    const groundLocation = spawnGroundPlace.groundLocationAt(px, py, dfLocation);
    // EV7: the LOCATION half stays here - setLocationTiles reads
    // BlocksFile + MapsFile, file objects that do not cross a
    // postMessage boundary - and its tilemap + rect ride into the job
    // as plain data. The ~84k-perlin kernel itself (samples, blend,
    // tiles, grid, nature - terrainGen.js, buildPixel's old prologue
    // verbatim) runs on the terrain worker when one is up and on this
    // thread when one is not; either way the reply is the same shape
    // and everything below it - GL uploads, the location layout, the
    // collider, the single atomic built.set - stays on this thread.
    const seedTilemap = new Uint8Array(128 * 128); made.placeHold = pipeline;   // FIELD BUGS 2026-10-04d PLACE-LRU: BUILD-FAIL1's ledger carries the hold, so a build that throws lets it go (releaseFailedBuild)
    let locationRect = null;
    // IC-GRAND's perf pass (bible/03-World/Arena-Provinces.md IC-GRAND): a family capital's slice's blocks read a breath
    // at a time - each taken from the city's worker or made, on the world-data door (world/capitalModels.js) - before
    // setLocationTiles reads its sixty-four in one task (1.1-1.8 s of one frame in the game, measured)
    if (capitalViewOf(dfLocation) || dfLocation?.settle2) for (const name of dfLocation.exterior.exteriorData.blockNames) { blocks.getBlockByName(name); await breather.breathe(); }   // WG2-TOWNS: a World 2.0 town's made a breath at a time too
    if (groundLocation) locationRect = setLocationTiles(groundLocation, maps, blocks, seedTilemap);
    if (locationRect) locationRect.gateRoads = townGateRoads(groundLocation, maps, blocks);   // GATE-ROADS: its gates for the kernel to lay their roads (world/townGates.js)
    if (locationRect?.shape) locationRect.shapeWas = shapeBefore(locationRect.shape, (groundLocation.mapTableData?.mapId ?? 0) >>> 0);   // FB1028 YARDS Y2: the outline #1184 drew, its crops none (posted: its basis is not)
    // WOD2: LocationLoader.AddLocation's DECISION (LocationLoader.cs:101-172),
    // taken here because it reads only the map data and the kernel needs
    // its rects. The region under the player is announced first
    // (PlayerGPS.OnRegionIndexChanged - polled on every crossing, WOD5,
    // and again here, where the list is read), every announced folder
    // lands, and the first valid instance naming this pixel takes it.
    let wodPicks = null;
    // GATE-AGREE (bible/01-Overview/bugs/Field-Bugs-2026-10-24b.md): per pick, whether a clearing withholds its objects. The
    // clearings - the gate's, every arch this client believes and every fallen star's - are each client's own word, so
    // they never decide a pick: a pick levels the ground. A whole site reaching one keeps its pick and its level ground,
    // and none of its objects stand (GATE-CLEAR: a camp never half stood); the ledger says what it cost
    let wodHeld = null;
    // GATE-CLEAR: the gate's clearing this build keeps its rock off - read ONCE, here, and held to by its placements
    // below (the gate's day can turn while it builds; the sweep asks a pixel that published on a stale one again)
    const gateClear = host._gateClearNow();
    const gateLedger = { refused: false, reach: [] };   // what the clearing cost this pixel, and what it stood (world/gate/gateClearance.js)
    const gateSite = gateSiteTest(gateClear, px, py, gateLedger);
    if (wod && onTheBay(px, py) && await wodOpened) {   // AUDIT CAPTAIN'S SEA G8: the mod's sites are the Bay's - its pick never run off it (off the map its pixel walk is a whole-list scan, 1.3 ms a pixel, thrown away)
      // AUDIT BRANCH (WoD) M2: the mod's decision can cost this pixel its site, never the pixel - a throw out of the
      // loader failed the whole build, terrain and all, on every pixel after it
      try {
        const here = host.state.current ?? { x: px, y: py };
        wod.noteRegion(maps.getRegionIndexAt(here.x, here.y));
        await wod.settle();
        const picks = wod.picksFor({
          mapPixelX: px, mapPixelY: py, hasLocation: !!groundLocation,   // GROUND-AGREE
          worldHeight: host.woods.getHeightMapValue(px, py),
          regionIndex: maps.getRegionIndexAt(px, py),   // WOD-SEA-TEST: the PIXEL's region (the sea's 31), never the location's
        }, wodPathsPoint, (name, prefab, rect) => wodSiteClear(terrainGen.roads(), px, py, name, prefab, rect));   // ROADS-CLEAR: a camp, fort, shrine or ruin whose pieces reach a road is not stood (world/road/roadClearance.js)
        if (picks.length && onTheBay(px, py)) { wodPicks = picks; wodHeld = picks.map((p) => !gateSite(p.prefabName, p.prefab, p.rect)); }   // TAMRIEL2: the mod's sites are the Bay's
      } catch (e) {
        console.warn(`[wod] pixel ${key}: the loader failed here, and the pixel stands without its site: ${e?.message ?? e}`);
        wodPicks = null;
      }
    }
    const climate = getWorldClimateSettings(maps.getClimateIndex(px, py));
    const climateBase = climate.climateType;
    // ECOTONE1: the pixel's neighbours' climates, when the blend is on - the kernel lays a border's tiles by the climate
    // that owns them, and the ground below draws the same border
    const near = ecotones ? climates3x3(px, py, climate) : null;
    const natureBorder = near && near.some((c) => c.natureArchive !== climate.natureArchive || c.climateType !== climateBase)
      ? { nature: near.map((c) => c.natureArchive), type: near.map((c) => c.climateType) } : null;
    // EV4: the far ring builds strided with its skirt; the kernel's
    // ghost rows keep edge normals central differences either way.
    const stride = strideFor(px, py);
    const arenaRoadsAt = terrainGen.arenaRoadsEpoch;   // TESA4: the Arena roads' layer this job is built with
    const { yardPaths, yardGround, samples, tilemap, positions, normals, bed: carved, tilemapBytes, avg, nature, withRoads, paths, landProps, wodAverages, graht, beach, roadside, townGround, arenaRoads, bridges, meets } = await terrainGen.generate({
      px, py, stride, tilemap: seedTilemap, locationRect, hasLocation: !!groundLocation, climateType: climateBase,
      flattenAt: dfLocation?.capital?.flattenAt ?? dfLocation?.settle2?.ground ?? null,   // TESA11: a capital over several pixels flattened to its centre's ground; WG2-TOWNS: a World 2.0 town on its own
      bed: waterOn,   // AUDIT WATER-NEXT P1: the bed under the water, carved on the worker with the grid
      // WOD2: the smoothing arms run in the kernel; FOREST1: and whether each pick is a SITE the woods close round (a camp, a
      // fort, a ruin - not a rock field or a mountain, AUDIT FOREST1 F1) and its whole footprint (its objects, F7)
      wod: wodPicks ? { picks: wodPicks.map((p) => ({ flatten: p.flatten, rect: p.rect, hide: !wodPiecewise(p.prefabName), bounds: forests || jungle ? wodSiteFootprint(p.prefab, p.rect) : null })) } : null,   // AUDIT BANTHA1 LAY-4: the jungle keeps a site's own pieces' ground as the woods do
      // FOREST1: the woods' archive (the climate's summer one, which names its Trees) and whether this pixel's place is one they hide
      forests: forests ? { archive: climate.natureArchive, hidden: FOREST_HIDDEN_LOCATION_TYPES.has(groundLocation?.mapTableData?.locationType) } : null,
      ecotone: natureBorder,   // ECOTONE1: null unless a neighbour's nature differs
      // TESA-LANDS: past the Bay a zone's own flats (world/tamriel/tamrielLands.js), their border with the Blended climates row
      lands: lands ? { blend: !!ecotones, archive: climate.natureArchive, hidden: FOREST_HIDDEN_LOCATION_TYPES.has(groundLocation?.mapTableData?.locationType) } : null,
      // BANTHA1: the jungle's field about this pixel (scenes/jungleHost.js job - null where it cannot reach), and whether
      // its location is a place the woods close round; GRAHT1: and the canopy's field, where its graht-oaks stand
      jungle: jungle ? jungle.job(px, py, FOREST_HIDDEN_LOCATION_TYPES.has(groundLocation?.mapTableData?.locationType)) : null,
      landform,   // LANDFORM1-3: the shaped ground, cut along the kernel's own network
      about: townMeets?.about(px, py, meetsTown(groundLocation) ? locationRect?.shape : null) ?? null,   // ACROSS-EDGE: the towns of its 3 x 3 its ground meets
    });
    const walkShut = dfLocation ? fabricWalkShut(townWalkShut(dfLocation, townGround, paths), dfLocation) : null;
    const yardShut = dfLocation ? yardWalkShut(fabricWalkShut(townWalkShut(dfLocation, yardGround ?? townGround, yardPaths ?? paths, true), dfLocation), walkShut, dfLocation) : null;   // FB1028 YARDS: the yards' ground as #1184 stood it   // TS6-TS7: its walkers' and its yards' ground the town's own, off its wall; TS10: the paths painted on it its roads; URBANIZER U3: and off its fences and dead ends' walls
    // DW-B: HandlePromote's synchronous arm - a pixel beside the player's is
    // promoted now, on the Deep Waters worker while this build lays out, and
    // published with its seafloor (awaited below); every other one is
    // deferred to the pump, nearest first - and built there, the port's own
    // whole-stream carve (Port-Ledger (9): the mod's pump builds only a near
    // pixel, and a far one's surface).
    const dwNear = deepWaters ? deepWaters.promoteNear({ px, py, samples, tilemap, tilemapBytes }) : null;   // TAMRIEL2: the mod's bathymetry is the Bay's - ETHER-DEEP: and the Eltheric's own; the host's promote is the one gate, for every arm (scenes/deepWater/deepWatersHost.js), and answers nothing past the map
    // WM3: this pixel's climate law, bound once - the one argument the
    // shared remap seam takes that differs between the climate hosts
    // and the dungeon.
    // PRECIP4 (scenes/snowCoverHost.js): THE PIXEL'S SEASON - DFU's calendar season, or on the snow lane the snow at its
    // middle's ground (a town's planed height, else its ground's middle), which its buildings, its town's climate swaps and
    // its windmills wear; its trees and plants wear the snow at their own feet (flatSeason, below), its ground the snow at
    // every fragment (render/snowCoverGlsl.js - the set's summer records and their winter twins)
    let groundLo = Infinity, groundHi = -Infinity;
    for (let i = 1; i < positions.length; i += 3) { if (positions[i] < groundLo) groundLo = positions[i]; if (positions[i] > groundHi) groundHi = positions[i]; }
    const groundMid = dfLocation ? avg * worldHeight : (groundLo + groundHi) / 2;
    if (snowCover?.on) await snowCover.settle(breather);   // the snow about the player integrated to the clock's minute before a season is read
    const snowRec = snowCover?.recorder(px, py) ?? null;   // AUDIT PRECIP HOST-6: every season this build takes, kept as it takes it
    const pixelSeason = snowRec ? snowRec.pixel(groundMid - SEA_LEVEL_M, host.season) : host.season;
    const climateArchive = (archive, record) => applyClimate(archive, record, climateBase, pixelSeason);
    // WD3 (AUDIT WD3 G5): A TOWN'S BUILDINGS WEAR ITS LOCATION'S CLIMATE - DaggerfallLocation's ClimateUse.UseLocation
    // (ApplyClimateSettings: Summary.Climate, from DFLocation.Climate), the terrain the pixel's. One and the same for
    // every classic town (MAPS.BSA reads the location's climate off the pixel); a world-data file says its own (81 of
    // Beautiful Villages' towns name a climate other than their pixel's), as DFU stands them.
    const townClimateBase = dfLocation?.climate?.climateType ?? climateBase;
    const townClimateArchive = townClimateBase === climateBase ? climateArchive : (archive, record) => applyClimate(archive, record, townClimateBase, pixelSeason);
    const groundArchive = landSetOf(px, py, snowCover ? snowCover.groundArchive(climate, pixelSeason) : getTerrainGroundArchive(climate, pixelSeason));   // the TERRAIN member, Desert winter-guarded (TerrainMaterialProvider.cs:126-133); PRECIP4: the summer set on the snow lane; TESA-LANDS: its zone's dress of it (a set's key)
    const natureArchive = getNatureArchive(climate.natureArchive, pixelSeason);
    // VERGE1 (Mac: "Making sure objects, like trees, avoid pathways and roads. Currently they slightly overlap"): THE
    // ROADS THIS PIXEL WAS PAINTED WITH - none when the kernel painted none (the roads sweep builds it again when the
    // network lands) - and the half widths of the climate's own pictures, its summer set's (a season moves no flat)
    const vergeNet = verges && withRoads ? terrainGen.roads() : null;
    const vergeHalf = new Map();   // ECOTONE1: by summer archive - a border's flats are a neighbour climate's
    if (vergeNet) for (const a of new Set([climate.natureArchive, ...nature.map((f) => f.archive).filter((a) => a != null)])) vergeHalf.set(a, await halfWidthsOf(a));
    let vergeOff = 0;

    // R9 tilemap pass: shared-index height grid + per-pixel tilemap
    // texture + one cached texture array per ground archive (loadGroundSet).
    const ownSet = loadGroundSet(groundArchive, pipeline, snowCover?.winterOf(climate) ?? null);   // PRECIP4: on the snow lane its twin, its winter in it
    // ECOTONE1: and at a climate border the neighbours' sets, held by this pixel as its own is - which set each of
    // its eight neighbours wears (0 its own, 1-3 the sets on the terrain program's units 3-5), and its lattice origin
    const groundNear = near ? near.map((c, k) => neighbourSet(px, py, k, snowCover ? snowCover.groundArchive(c, pixelSeason) : getTerrainGroundArchive(c, pixelSeason))) : null;   // TESA-LANDS: each its own zone's dress
    let eco = null;
    if (groundNear?.some((a) => a !== groundArchive)) {
      const archives = [...new Set(groundNear.filter((a) => a !== groundArchive))];
      // TESA-LANDS (AUDIT): loaded together - a junction of zones met first has each set's dress on its worker while the
      // page reads and uploads the next, never one set's whole making after another's
      await Promise.all([ownSet, ...archives.map((a) => loadGroundSet(a, pipeline, snowCover?.winterOf(near[groundNear.indexOf(a)]) ?? null))]);   // PRECIP4: the neighbours' twins
      const slot = (k) => (groundNear[k] === groundArchive ? 0 : archives.indexOf(groundNear[k]) + 1);
      const [ox, oz] = ecoOrigin(px, py);
      eco = {
        archives: [archives[0] ?? null, archives[1] ?? null, archives[2] ?? null], tex: [null, null, null],
        side: Int32Array.of(slot(3), slot(5), slot(1), slot(7)),   // W, E, S, N - the 3x3's (dz + 1) * 3 + (dx + 1)
        corner: Int32Array.of(slot(0), slot(2), slot(6), slot(8)),   // SW, SE, NW, NE
        origin: Int32Array.of(ox, oz, 1),
      };
    } else await ownSet;
    // WATER-NEXT 2 (world/water/waterBed.js): the ground the eye sees carved into a bed under the water - the game's ground
    // (heightAt, the samples) never moves - and the water's own sheet, the grid as it stood with the bed's depth.
    // AUDIT WATER-NEXT P1: carved by the kernel on the worker (terrainGen.js restrideGrid), not on this thread
    const bed = hostBed({ positions, normals }, carved);
    const terrain = renderer.createTerrainSurface(carved?.positions ?? positions, carved?.normals ?? normals,
      stride === 1 ? TERRAIN_INDICES : TERRAIN_INDICES_LOD);
    // WATER-LEVEL: the water's sheet at its level, carved with the bed - null for a pixel without water, which never enters the pass
    const water = bed?.sheet ? renderer.createWaterSheet(bed.sheet) : null;
    made.terrain = terrain; made.water = water;   // BUILD-FAIL1
    // EV3: the pixel's presentation bounds, pixel-local - seeded by the
    // terrain's own vertices, grown by every model and flat batch below.
    // EV4: dropped by the skirt depth so a future restride to the far
    // ring never hangs geometry below the culling box.
    const bounds = localAabb(carved?.positions ?? positions);   // WATER-NEXT 2: the bed inside the box
    bounds[1] -= TERRAIN_SKIRT_DEPTH;
    const unionBox = (b) => {
      for (let i = 0; i < 3; i++) {
        if (b[i] < bounds[i]) bounds[i] = b[i];
        if (b[3 + i] > bounds[3 + i]) bounds[3 + i] = b[3 + i];
      }
    };
    const tilemapTex = renderer.uploadTilemapTexture(tilemapBytes, TERRAIN_TILE_DIM);
    made.tilemapTex = tilemapTex;   // BUILD-FAIL1

    // Flat groups: pixel-local base positions. AUDIT PRECIP HOST-7: THE PIXEL'S FLATS, logged in the order they stand
    // (groupFlats groups them) - each with its own centre, the flat's identity (a felled tree is known by it), and how it
    // takes the season: `block` its block's flat list (`skinBlocks`, read again in a season), `wild` the summer archive the
    // snow at its own foot dresses, neither a flat whose picture no season turns
    const flatLog = [], skinBlocks = [];
    const pixelLights = []; // archive-210 lanterns, pixel-local (R3)
    const pixelHearths = []; // HEARTH1: the braziers and fire bowls among them, pixel-local
    const pixelAnimals = []; // A4: archive-201 town animals, pixel-local {pos, sound}
    const pixelSprings = []; // SURV3: the mod's water sources - fountains and wells (212: 0, 2, 8, 9; 85: 0), the dry fountain (212: 3), the troughs (41220-41222) - pixel-local {pos, dry}
    const pixelNpcFlats = []; // AUDIT 26 (F019): the flats RMBLayout stands as StaticNPCs, pixel-local
    const pixelStandFlats = [];   // STAND-FLAT / STAND-HORSE: the town horses and the people no StaticNPC holds, pixel-local - a batch each
    const pixelBoards = [];   // where the blocks' BULLETIN BOARDS (model 41739) would stand, pixel-local boxes - NOTICE-PANEL: none stands
    const pixelGraves = [];   // SEARCH1: a Graveyard location's headstones (systems/searchables.js isTombstoneModel), pixel-local boxes
    const light210 = await getTexture(LIGHTS_ARCHIVE);
    const lightSize = (record) =>
      billboardSize(light210, record);
    const addFlat = (archive, record, x, y, z, skin = null) => {
      const c = [x, y, z];
      flatLog.push({ archive, record, c, ...skin });
      if (skin?.wild != null) standsOnGround(c);   // FLORA-GROUND, THE RINGS: the wild's flats stand on the ground by its law - the kernel's woods and scatter, the roadside pairs' fallback
    };
    // WOD2: a flat the mod SCALES (LoadObject's `localScale *= scale`,
    // LocationHelper.cs:1243) is a batch of its own at its own size; the
    // shipped layouts scale four records, always uniformly.
    const scaledGroups = new Map();
    const addScaledFlat = (archive, record, scale, x, y, z) => {
      const k = `${archive}_${record}_${scale.x}_${scale.y}`;
      if (!scaledGroups.has(k)) scaledGroups.set(k, { archive, record, scale, centers: [] });
      scaledGroups.get(k).centers.push([x, y, z]);
    };

    // Per-pixel climate swap table: pixels from the swapped archive, UVs
    // from the original (the SetDungeonTextures pattern; verbatim
    // MaterialReader.ChangeClimate semantics).
    const texRemap = markRemapLaw(new Map(), `climate:${townClimateBase}.${pixelSeason}`);   // AUDIT MENU-ORDER C3: named by the law it is built in (townClimateArchive's)
    const models = []; // { gpu, local } - local precomposed pixel-local matrix
    // PERF4: the pixel's static models, merged as they arrive (the
    // transform rides the build's own awaits) into one mesh per pixel,
    // one draw call per texture. The gates (whose mesh swaps) and the
    // mills (whose rotor turns) stay individual draws.
    const staticBuilder = new StaticBatchBuilder({ windows: windowKeys(renderer) });   // WL1: its windows' glass measured in the merge's own slices
    const resolveTexKey = keyResolver(texRemap);
    const ownTexKey = keyResolver(NO_CLIMATE_REMAP);   // ARENA1: a climate-free model (RuntimeMaterials, ApplyClimate 0) wears its own pictures in the merge
    const statics = [];   // AUDIT PRECIP HOST-7: the merge's models in its order - a re-skin merges them again through its table
    const addStatic = (cpu, local, own, nm = null) => { statics.push([cpu, local, own, nm]); staticBuilder.add(cpu, local, own ? ownTexKey : resolveTexKey, nm); };
    const pixelGates = [];   // AUDIT 64 F14: {gate, entry, local, bucketKey} - this pixel's DaggerfallCityGates
    made.cityGates = pixelGates;   // BUILD-FAIL1
    // AUDIT 64 F11: this pixel's StaticBuildings (RMBLayout.cs:864-882),
    // pixel-local like its doors, boards and street NPCs.
    const pixelBuildings = [];
    const windmills = []; // WM2b: { local, state } - mills whose rotor turns each frame
    made.windmills = windmills;   // BUILD-FAIL1
    const holdBlocks = [];   // WOD4: the origin matrix of each block DungeonExterior would find by name
    let arenaOrigin = null;   // ARENA2: the colosseum's block's origin (pixel-local) - the city floor's frame
    let population = null;   // T2 towns: this pixel's wandering pool
    let locOrigin = null;    // the location origin, pixel-local
    let lefaySpot = null;    // LEFAY1: a monument - its id and spot in the location frame (world/lefayMonument.js monumentSpotOf), null anywhere but Gothway Garden and the Imperial City's centre
    let yardSites = null;    // MERCHANT-YARDS: a city's or a town's Stable and Wagon Yard - their sites in the location frame, null in any other place
    let portSites = null;    // SHIPYARDS: a port town's shipyard and lighthouse - their sites in the location frame, null in any other place
    let personBatches = null;
    let locBlocks = null;    // T3d: the layout blocks for the Where-is directory
    let witchFloor = null;   // WITCH1: the town's street, where the Witches' Festival's dressing stands (below)
    let homeTown = 0;        // HOME-LOOK: the town's map id, and its homes as heard at the build
    let homeLookRead = -1;   // HOME-LOOK (AUDIT): the registry's version as this build read it - refreshHomeLooks starts from it
    /** @type {Map<number, any>|null} */
    let townHomes = null;
    const pixelHomeKeys = new Set();   // HOME-LOOK: the homes drawn out of the merge
    const pixelBuildingKeys = new Set();   // HOME-LOOK: every building of the pixel, by its key
    /** @type {Map<number, {at: number[], box: number[], rects: number[][]}>} HOME-YARD: each building's own place and the box round its models, pixel-local; FB1009 HOME-FOOT: and the ground its models' faces cover */
    const pixelHomeFrames = new Map();
    const pixelDungeonDoors = [];   // CASTLE-GATE: the dungeon-entrance doors the town's blocks stand, each with its model's box and its outward normal
    if (dfLocation) {
      // AUDIT 39 (#18): the skin reaches the layout, because the mill's
      // subrecord widens the block's building count and must not exist
      // on the classic one.
      setLastLocationKeyTo(dfLocation.regionIndex, dfLocation.locationIndex ?? 0);   // AUDIT-RR F32: WorldDataVariants' last key is THIS location's before its blocks are read - DFU reads the DFLocation right before RMBLayout (MapsFile.cs:999 sets it); the boot index here read every location and left the key on the last
      const loc = await stepsBreathing(layoutLocationSteps(dfLocation, maps, blocks, { enhanced: isEnhanced(), windmills: windmillsOn() }), () => breather.breathe());   // WM3: the pack's own switch; IC-STUTTER: a block a step
      locBlocks = loc.blocks;
      const fabric = await townFabricFor(dfLocation, loc.blocks, { px, py, breathe: () => breather.breathe(), ground: townGround, paths });   // URBANIZER U3 (world/urban/townFabricStand.js): planned before its yards and its walkers are placed - TOWN-BOARDS: on the town's ground, the outline TS2 flattens, its painted roads its roads (TS10)
      // GOTHWAY-MONUMENT, STEWART-MONUMENT: a monument's spot, a function of the layout alone - found before the yards, which keep off it
      lefaySpot = farView ? null : monumentSpotOf(dfLocation, loc);
      if (isLefayTown(dfLocation) && !lefaySpot) console.warn('[lefay] no open ground for the monument in Gothway Garden');   // AUDIT FIVE-ASKS B8: never silent
      // MERCHANT-YARDS: the town's open ground, clear of its buildings, roads and lots; SHIPYARDS: and a port town's seaward
      // ground, on what the yards left - one pass (AUDIT SHIPYARDS L3-3: the yards' and the port's each asked it whole)
      const yardTown = !farView && isYardTown(dfLocation), portTown = !farView && isPortTown(dfLocation, portOnSea(dfLocation));
      const places = yardTown || portTown ? await townPlacesFor(dfLocation, lefaySpot, climate?.people, loc, yardShut, () => breather.breathe()) : null;   // TS7: on the town's own ground; IC-STUTTER: a step at a time through the build's breather
      if (yardTown) yardSites = places.yards;
      if (portTown) portSites = places.ports;
      const tilePos = getLocationTerrainTileOrigin(dfLocation);
      const locLocal = [tilePos.x * tileSide, avg * worldHeight + 2.0 * 0.025, tilePos.y * tileSide];
      witchFloor = locLocal[1] + BLOCK_FLATS_OFFSET_Y * GLOBAL_SCALE;   // WITCH1: as the block's own flats stand
      // T3d: EVERY location pixel keeps its origin (the population
      // gate below no longer owns it) - the Where-is directory
      // resolves doors and the player in the LOCATION frame.
      locOrigin = [locLocal[0], locLocal[1], locLocal[2]];
      // HOME-LOOK: the town's homes, asked before its buildings are merged (a moment, never long - a town unheard by
      // then is painted when it is heard of)
      homeTown = (dfLocation.mapTableData?.mapId ?? 0) >>> 0;
      // OVERLOAD-EASE (2026-10-29): a far Imperial City slice stands no buildings, and a place the boot's read says holds
      // no home has none to paint - neither asks the service (they were most of /v1/homes/town's asks)
      if (onlineHomes && homeTown && !farView && !onlineHomes.heardHomeless?.(homeTown)) {
        // AUDIT: a town heard before is read as it was heard (asked again behind the build; an answer that moves is
        // painted by refreshHomeLooks) - only a town never heard is waited for, a moment, never at every rebuild
        if (onlineHomes.known(homeTown)) onlineHomes.ensure(homeTown).catch(() => {});
        else { try { await onlineHomes.waitFor(homeTown, HOME_LOOK_BUILD_WAIT_MS); } catch { /* painted once heard */ } }
        townHomes = onlineHomes.homesIn(homeTown);
        homeLookRead = onlineHomes.version() * 1024 + host._lookPreviewGen;
      }
      for (const b of loc.blocks) {
        // SOLITUDE-RELIEF (world/tamrielCapitals.js capitalBlockLift): a block on a capital's upper tier stands its tier's
        // height over the location's flatten - its models, doors, flats, people and lights with it (0 everywhere else)
        const blockY = locLocal[1] + capitalBlockLift(dfLocation, b.x, b.y);
        const originMatrix = trs(
          locLocal[0] + b.originX, blockY, locLocal[2] + b.originZ, 0, 0, 0);
        if (wod && b.blockName === PRIVATEERS_HOLD_BLOCK) holdBlocks.push(originMatrix);   // WOD4
        if (b.blockName === ARENA_BLOCK) arenaOrigin = [originMatrix[12], originMatrix[13], originMatrix[14]];   // ARENA2
        // AUDIT 64 F11: DFU's `firstModel` is a LOCAL, reset once per
        // subrecord inside AddModels (RMBLayout.cs:824-832), and
        // AddModels runs once per PLACED block with a fresh
        // `buildingsOut` (:819-820) - so every grid cell gets its own
        // full StaticBuilding array. A pixel-wide latch keyed on the
        // BLOCKS.BSA record index would collide across the many cells
        // that hold the same block name and leave every repeat with no
        // buildings at all.
        const pixelFirstModel = new Set();   // recordIndex - this BLOCK INSTANCE's latch
        // WM2d: THE MILLS THIS BLOCK STANDS. Classic Daggerfall places
        // none, so rmbLayout adds them; the tower joins the static model
        // list and only the SAIL needs a matrix per frame. Enhanced skin
        // only, the same door the enhanced skin owns. The phase is keyed on the
        // MAP PIXEL plus the mill's local position, never its world
        // position - the floating origin shifts the world under the
        // player and a world-keyed phase would re-seed every mill in
        // sight on every shift.
        if (b.layout.windmills.length && isEnhanced()) {
          const parts = await getWindmillMeshes(townClimateBase, pixelSeason === SEASON.Winter);
          if (!host.millParts) {
            host.millParts = parts;
            console.log(`[windmills] first mill streamed in (${b.blockName})`);
          }
          for (const w of b.layout.windmills) {
            const local = multiply(originMatrix, w.matrix);
            const box = transformedAabb(archAabb('millBody', BODY.positions), local);
            for (let i = 0; i < 3; i++) { box[i] -= MILL_SAIL_PAD; box[3 + i] += MILL_SAIL_PAD; }
            unionBox(box);
            models.push({ gpu: parts.body, local, _box: box, _order: -1, _mill: true });   // EV6: the mills group together; AUDIT PRECIP HOST-7: a body a re-skin dresses
            late.add(key, BODY.positions, BODY.indices, local,
              { translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])) });   // BLOOD1 AUDIT 3: one array a bucket, not one a call - every ray asks every bucket; PERF-COL2: riding the floating origin, filed by place
            windmills.push({ local, state: { angle: rotorPhase(px + local[12], py + local[14]) } });
          }
        }
        for (const placed of b.layout.models) {
          // WM2f: the mill's companion building is part of an enhanced-skin
          // departure; the 1:1 lane must not see it.
          if (placed.enhancedOnly && !isEnhanced()) continue;
          if (isHouseSign(placed, b, (id) => cpuModels.get(id)?.doors)) continue;   // HOUSE-SIGN: a shop's sign at a house's door does not stand
          const gpu = await getGpuMesh(placed.modelIdNum, () => breather.breathe());   // AUDIT PRE-MERGE 1003 W6: a model built here breathes with the pixel (the colosseum's seal)
          if (!gpu) continue;
          const local = multiply(originMatrix, placed.matrix);
          const cpu = cpuModels.get(placed.modelIdNum);
          const box = transformedAabb(archAabb(placed.modelIdNum, cpu.positions), local);
          // NOTICE-PANEL (scenes/townPanelHost.js): a town's board (RMBLayout's standalone 41739) does not stand - the town
          // panel under the compass is its press. Its place is kept, the very box a drawn model's is (AUDIT FB1029g R1: one
          // reckoning, so the siege field's Market every machine lays never drifts from where a board stood)
          if (isBulletinBoard(placed.modelIdNum)) { pixelBoards.push({ box, local }); continue; }
          const climateFree = isClimateFreeModel(placed.modelIdNum);   // ARENA1: the colosseum - never swapped, nor a key of the pixel's table
          if (!climateFree) await remapSubMeshes(gpu.subMeshes, texRemap, townClimateArchive, pipeline, townClimateBase);   // AUDIT PRECIP HOST-7: kept in the table's recipe under its climate
          if (WATER_SOURCE_MODELS.includes(placed.modelIdNum)) pixelSprings.push({ pos: [local[12], local[13], local[14]], dry: false });   // SURV3: a trough is a water source
          unionBox(box);
          const entry = { gpu, local, _box: box, _order: placed.modelIdNum };   // EV6: sort key
          if (climateFree) entry.texRemap = NO_CLIMATE_REMAP;   // ARENA1: drawn by its own table (an empty one - never the pixel's)
          // HOME-LOOK / HOME-YARD
          const homeKey = Number.isSafeInteger(placed.recordIndex) ? makeBuildingKey(b.x, b.y, placed.recordIndex) : null;
          if (homeKey != null) {
            pixelBuildingKeys.add(homeKey);
            // its own place (rmbLayout.js recordAt) and the box round its models: its yard's frame and footprint
            const at = Array.isArray(placed.recordAt) ? [locLocal[0] + b.originX + placed.recordAt[0], blockY + placed.recordAt[1], locLocal[2] + b.originZ + placed.recordAt[2]] : null;
            const bd = b.dfBlock?.rmbBlock?.fldHeader?.buildingDataList?.[placed.recordIndex] ?? null;   // YARD-LINE: whether it could hold a lot of its own
            const rects = footRectsAt(modelFeetOf(placed.modelIdNum, cpu), local);   // FB1009 HOME-FOOT: the ground its faces cover, never its box
            const ground = footGroundAt(modelFootParts(cpu.positions, cpu.indices), local);   // WALL-TOUCH, YARD-DECK: its walls' lines and flat roofs
            const f = pixelHomeFrames.get(homeKey);
            if (!f && at) pixelHomeFrames.set(homeKey, { at, box: [...box], rects, grounds: [ground], type: bd?.buildingType ?? null, faction: bd?.factionId ?? 0, parts: [[cpu, local]], terraced: isFabricDoorId(placed.modelIdNum), block: b.blockName, record: placed.recordIndex });   // AUDIT RPT1026 J2: its models (hallBanners.js wallBehind); IC-BACKYARD: its block and record, its yard's
            else if (f) { for (let i = 0; i < 3; i++) { f.box[i] = Math.min(f.box[i], box[i]); f.box[i + 3] = Math.max(f.box[i + 3], box[i + 3]); } f.rects.push(...rects); f.grounds?.push(ground); f.parts?.push([cpu, local]); }
          }
          const homeRow = homeKey != null ? townHomes?.get(homeKey) ?? null : null;
          const homeLook = homeRow ? lookOfHome(homeTown, homeKey, homeRow) : null;
          // AUDIT: a painted home, or this account's, leaves the merge (PERF4 for every other); unpainted, the pixel's table
          // GUILD-YARD: and a guild's hall this character keeps - its painter tries a look on it as an owner's does
          if (homeRow && (homeLook || homeRow.mine || homeRow.keeper)) {
            entry._home = { bk: homeKey, sig: homeLookSig(homeLook), seq: 0 };
            entry.texRemap = homeLook ? await homeLookRemap(gpu.subMeshes, texRemap, homeLook, pixelSeason, pipeline) : null;
            pixelHomeKeys.add(homeKey);
          }
          models.push(entry);
          if (!entry._home && !isCityGate(placed.modelIdNum) && cpu.normals && cpu.uvs) { addStatic(cpu, local, climateFree); entry._batched = true; }   // PERF4: the remap for this model's textures is in the map by now (awaited above); HOME-LOOK: a home stays out
          await breather.breathe();   // PERF7: a warm build gives the frame back every few milliseconds
          // AUDIT 64 F14: a city gate takes a collider bucket of its own
          // (the pixel's shared bucket has no per-mesh removal), keyed
          // off the pixel key so destroyPixel drops it with the pixel.
          // AUDIT 64 F11: the StaticBuilding for this subrecord, if this
          // is its first LOADED model (the `continue` at RMBLayout.cs:854
          // skips a missing model before the firstModel block, which is
          // why the latch sits after this host's own `if (!gpu) continue`).
          if (placed.recordIndex != null) {
            const rk = placed.recordIndex;
            if (!pixelFirstModel.has(rk)) {
              pixelFirstModel.add(rk);
              const sbox = staticBuildingBox(dfMeshSize(placed.modelIdNum));
              pixelBuildings.push({
                recordIndex: placed.recordIndex, dfBlock: b.dfBlock, matrix: local,
                aabb: staticBuildingWorldAabb(sbox, local),
              });
            }
          }
          const gateKey = isCityGate(placed.modelIdNum) ? `${key}:gate:${pixelGates.length}` : key;
          if (isSolidModel(placed.modelIdNum)) late.add(gateKey, cpu.positions, cpu.indices, local,
            { translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])), sight: sightMarksOf(placed.modelIdNum, cpu) });   // BLOOD1 AUDIT 3: the same; PERF-COL2: riding the floating origin; SIGN-PASS: a sign's board met by every ray, by no body
          if (dfLocation?.mapTableData?.locationType === LOCATION_TYPES.Graveyard && isTombstoneModel(placed.modelIdNum)) pixelGraves.push({ box, n: pixelGraves.length });   // SEARCH1: numbered in the build's own order - the same stone, the same key, every visit
          // AUDIT 64 F14: ...and the CITY GATES, stood standalone for
          // exactly the same reason (RMBLayout.cs:857) so
          // DaggerfallCityGate can ride them (:959-963) and swap the
          // model - draw AND MeshCollider (GameObjectHelper.cs:236-250)
          // - at dusk and dawn. Both variants must be resident and
          // climate-remapped BEFORE the first swap (the per-pixel
          // loader is async; a mid-frame fetch cannot swap in place),
          // and the gate needs a collider bucket of its own because the
          // pixel's shared one has no per-mesh removal. Its box joins
          // the pixel union for BOTH variants so culling stays truthful
          // whichever is drawn.
          if (isCityGate(placed.modelIdNum)) {
            const otherId = placed.modelIdNum === CITY_GATE_OPEN_MODEL_ID
              ? CITY_GATE_CLOSED_MODEL_ID : CITY_GATE_OPEN_MODEL_ID;
            const otherGpu = await getGpuMesh(otherId);
            const otherCpu = cpuModels.get(otherId);
            if (otherGpu && otherCpu) {
              await remapSubMeshes(otherGpu.subMeshes, texRemap, townClimateArchive, pipeline, townClimateBase);
              unionBox(transformedAabb(archAabb(otherId, otherCpu.positions), local));
            }
            pixelGates.push({
              gate: makeCityGate(placed.modelIdNum), entry, local, bucketKey: gateKey,
              // Both variants held here, so the frame tick is synchronous
              // - the streaming loader is not, and a mid-frame fetch
              // cannot swap in place.
              meshes: new Map([
                [placed.modelIdNum, { gpu, cpu }],
                [otherId, otherGpu && otherCpu ? { gpu: otherGpu, cpu: otherCpu } : null],
              ]),
              translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])),   // BLOOD1 AUDIT 3: the same; PERF-COL2: riding the floating origin
            });
          }
          // Building models expose their static doors for E-transitions.
          if (cpu.doors && cpu.doors.length) {
            // StaticDoor.blockIndex must be TRUTHFUL (RMBLayout.cs:848
            // passes blockData.Index): DaggerfallInterior.IsBadInteriorModel
            // keys the 31000-overlap repair on EntryDoor.blockIndex, and a
            // hardcoded 0 made it unreachable from this host.
            const staticDoors = getStaticDoors(cpu, b.dfBlock.index, placed.recordIndex, local);
            // GUILD1d: the building's first door, measured where it stands - its hall's banners hang beside it
            const hf = homeKey != null ? pixelHomeFrames.get(homeKey) : null;
            if (hf && !hf.door) { hf.door = doorCornersOf(cpu.doors[0], local); hf.normal = doorNormalOf(cpu.doors[0], local); }   // AUDIT WITCH1 D1: and its own outward normal - a door on its box's middle line takes its face from it, never the vertices' order (systems/siegeField.js doorFaceSign)
            if (dfLocation.hasDungeon) for (const d of cpu.doors) if (d.type === DOOR_TYPE.DUNGEON_ENTRANCE) pixelDungeonDoors.push({ door: doorCornersOf(d, local), box, normal: doorNormalOf(d, local), arena: b.blockName === ARENA_BLOCK });   // CASTLE-GATE (AUDIT G1: its outward normal; AUDIT PRE-MERGE 1003 W7: the undercroft's stair, no castle's - castleEntranceOf passes it over)
            for (const door of staticDoors) {
              host.doorGeneration += 1;   // WORLD-HOVER: a pixel's doors arriving
              (key === pkey ? buildingDoors : (made.doors ??= [])).push({   // IC-SWAP-BEHIND: staged on its ledger while it builds behind
                door, pixelKey: key, dfBlock: b.dfBlock, blockX: b.x, blockY: b.y,   // LW2: the block's grid cell, so a door names its building (makeBuildingKey)
                // A1: the season a door carries INSIDE is the
                // interior's own constant, never the world's.
                // DaggerfallInterior.cs:51 declares climateSeason =
                // ClimateSeason.Summer and never assigns it, so a
                // reference interior is summer-skinned in the depths
                // of Evening Star; the exterior season stopping at the
                // threshold is the whole of that law.
                recordIndex: placed.recordIndex, climateBase: townClimateBase, season: INTERIOR_SEASON,
              });
            }
          }
        }
        const hillSeat = blockHillSeat(b.layout.models);   // TREES-SEATED: the block's hills as the port draws them, null for none of ours. No RMB ground plane on terrain (addGroundPlane = false).
        // FIELD BUGS 2026-10-13e HILL-SEAT: the pads under what the author stood on those hills (laid into the seat, so the trees below stand on them too) - merged with the pixel's statics and solid in its bucket, both freed with the pixel (destroyPixel)
        const hillPatch = blockHillPatch(hillSeat, b.layout.models, (m) => (m.enhancedOnly && !isEnhanced() ? null : cpuModels.get(m.modelIdNum)));
        if (hillPatch) { addStatic(hillPatch, originMatrix, false); collider.addMesh(key, hillPatch.positions, hillPatch.indices, originMatrix, onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]))); unionBox(transformedAabb(localAabb(hillPatch.positions), originMatrix)); }
        // FIELD BUGS 2026-10-04d CROPS: a crop field's batch reads the climate (the second desert's plant is its own) and
        // keeps a metre off the block's solids - the models this build drew and collided just above (IsOverlapping)
        const flatOpts = { climateIndex: maps.getClimateIndex(px, py), solid: blockSolids(b.layout.models, (m) => (m.enhancedOnly && !isEnhanced() ? null : cpuModels.get(m.modelIdNum))) };
        const blockFlats = collectBlockFlats(b.dfBlock, natureArchive, flatOpts);
        const block = skinBlocks.push({ dfBlock: b.dfBlock, opts: flatOpts }) - 1;   // AUDIT PRECIP HOST-7: read again in a season (the same flats, in the same order)
        // AUDIT 26 (F019): ...and the same flats' STATIC NPCs
        // (RMBLayout.cs:366-378 / :442-454 - the non-zero FactionID
        // rule), pixel-local like everything else this host builds.
        const npcFlats = collectExteriorNpcs(blockFlats);
        const npcFlatSet = new Set(npcFlats);   // E3: identity, not coordinates - collectExteriorNpcs FILTERS the same objects
        for (const npc of npcFlats) {
          pixelNpcFlats.push({
            ...npc,
            x: locLocal[0] + b.originX + npc.x,
            y: blockY + npc.y + fabricLift(fabric, b.originX + npc.x, b.originZ + npc.z),   // AUDIT PROP-GROUND: on the street its fabric lays
            z: locLocal[2] + b.originZ + npc.z,
          });
        }
        for (const [n, flat] of blockFlats.entries()) {
          const lift = fabricLift(fabric, b.originX + flat.x, b.originZ + flat.z);   // AUDIT PROP-GROUND: a flat on the street its fabric lays stands on it
          // A4: every archive-201 town animal is an audio source
          // (AddAnimalAudioSource on RMB flats, verbatim). It runs
          // BEFORE DFU's faction test (:363-377), so it is not part of
          // what the NPC pass takes over below.
          if (flat.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[flat.record] != null) {
            pixelAnimals.push({
              pos: [locLocal[0] + b.originX + flat.x, blockY + flat.y + lift, locLocal[2] + b.originZ + flat.z],
              sound: ANIMAL_SOUND_BY_RECORD[flat.record],
            });
          }
          // SURV3: a fountain or a well is a water source (the mod's RegisterCustomActivation list); the dry one only says so
          if (isWaterSourceFlat(flat.archive, flat.record) || isDrySourceFlat(flat.archive, flat.record)) {
            pixelSprings.push({ pos: [locLocal[0] + b.originX + flat.x, blockY + flat.y + lift, locLocal[2] + b.originZ + flat.z], dry: isDrySourceFlat(flat.archive, flat.record) });
          }
          // E3: an exterior StaticNPC's BILLBOARD is stood by
          // standPixelNpcs, not batched here - RMBLayout hands the same
          // GameObject to SetupIndividualStaticNPC (:377) and the away
          // arm's SetActive(false) has to take it out of the draw AT
          // LAYOUT, which a center already inside a built batch cannot
          // leave. Their batches are appended to this pixel's list the
          // moment the pass has answered for them.
          if (npcFlatSet.has(flat)) continue;
          // AUDIT 64 F12: ...and an EDITOR flat (archive 199) is never
          // DRAWN at all. AddMiscBlockFlats has no 199 branch
          // (RMBLayout.cs:340-379) because the hide is the billboard
          // component's: DaggerfallBillboard.Start disables the mesh
          // renderer of a FlatTypes.Editor flat (:77-84,
          // MaterialReader.cs:980-981, StartGameBehaviour.cs:45). It
          // stays in `blockFlats` - the start markers
          // (locationStartMarkers), quest markers and action chains all
          // read it - it simply never reaches a batch.
          if (flat.editor) continue;
          const fx = locLocal[0] + b.originX + flat.x, fz = locLocal[2] + b.originZ + flat.z;
          // STAND-FLAT / STAND-HORSE (bible/04-Characters/Morrowind-NPCs.md section 28): a town horse and a person no
          // StaticNPC holds (a flat of a person's archive with no faction) stand in batches of their own
          // (standPixelFlats, below), so a 3D horse or a Morrowind body can take one's place. Neither was ever cover
          // (201 is NOT_COVER's; a person never is - AUDIT TACT B3).
          if (isStandFlat(flat.archive, flat.record)) { pixelStandFlats.push({ archive: flat.archive, record: flat.record, x: fx, y: blockY + flat.y + lift, z: fz }); continue; }
          // NATURE-GROUND (2026-09-26, Ilvi: "a lot of floating sprites across Illiac Bay"): the block's ground scenery and nature
          // flats stand on the DRAWN ground - the plane holds only inside the flattened rect, the band past it is only eased toward
          // it (DFU's too: AddNatureFlats reads no terrain); inside the rect the lift is exactly 0. A lamp, a sign, an animal keep the
          // plane. TREES-SEATED (Rissa: "Floating trees in Tamhope"): in a block whose hills the port draws as its stand-ins, a flat
          // of the nature range (the 504 trees stood on the pack's bigger hills) stands on the higher of the ground and the mounds.
          // SOLITUDE-RELIEF: a nature flat stands on the drawn ground (its offset off the plane holds the block's tier), a seated
          // one on its block's own hills (FLORA-GROUND's hill ground read off its block's tier), every other flat on its block -
          // all one law where the block stands on the plane
          const off = flat.archive === natureArchive || (hillSeat && isNatureArchive(flat.archive)) ? groundOffPlane(samples, avg, fx, fz) : 0;
          const hillY = hillSeat && isNatureArchive(flat.archive) ? NATURE_FLATS_Y + off - (blockY - locLocal[1]) : null;
          const fy = hillY !== null ? blockY + seatNatureFlat(hillSeat, flat.x, flat.z, hillY) : flat.archive === natureArchive ? locLocal[1] + flat.y + off : blockY + flat.y + lift;
          addFlat(flat.archive, flat.record, fx, fy, fz, { block, n });
          // FLORA-GROUND, THE RINGS (scenes/floraSeat.js): a nature flat stood on the ground - the climate's, the plane's
          // band under it; a hill block's where no mound raised it - is drawn on the ground its pixel draws at every ring
          if (hillY !== null ? seatNatureFlat(hillSeat, flat.x, flat.z, hillY) === hillY : flat.archive === natureArchive) standsOnGround(flatLog[flatLog.length - 1].c);
        }
        for (const light of collectCityLights(b.dfBlock, lightSize)) {
          const lp = [
            locLocal[0] + b.originX + light.x,
            blockY + light.y,
            locLocal[2] + b.originZ + light.z,
          ];
          pixelLights.push(lp);
          // HEARTH1: a town brazier is a fire, so the survival law wants
          // it. Split off the SAME walk that builds the lanterns - the
          // record is the only thing that tells the two apart and this
          // is the one place that has it.
          // FIX-D: and the sprite under the flame - base y, width,
          // height - pixel-local like the rest, for the eye's box.
          if (isHearthFlat(LIGHTS_ARCHIVE, light.record)) pixelHearths.push([lp[0], lp[1], lp[2], blockY + light.foot, light.w, light.h]);
        }
      }

      // URBANIZER U3 (world/urban/townFabricModel.js): the town's own fabric - its main streets' setts and pavements, its side
      // streets' cobbles, its yards' fences and walls, its dead ends' walls, its woodpiles - one model at its origin, merged
      // and solid as its blocks' are, its Daggerfall pieces in the town's climate
      if (fabric) {
        const gpuF = await getGpuMesh(fabric.modelId, () => breather.breathe()), cpuF = cpuModels.get(fabric.modelId);
        if (gpuF && cpuF) {
          await remapSubMeshes(gpuF.subMeshes, texRemap, townClimateArchive, pipeline, townClimateBase);
          const local = trs(locLocal[0], locLocal[1], locLocal[2], 0, 0, 0), box = transformedAabb(archAabb(fabric.modelId, cpuF.positions), local);
          unionBox(box);
          const entry = { gpu: gpuF, local, _box: box, _order: fabric.modelId };
          models.push(entry);
          if (cpuF.normals && cpuF.uvs) { addStatic(cpuF, local, false); entry._batched = true; }
          late.add(key, cpuF.positions, cpuF.indices, local, { translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])) });
        }
      }

      // T2 towns: the streaming host's wandering population (the
      // standing host rule - every scene-side seam ships in every
      // motor host). The navgrid + persons live in the LOCATION frame
      // (horizontal from the location origin, vertical pixel-local);
      // the frame loop converts through the live floating-origin
      // translation. Persons ground on the flattened location terrain
      // (blendLocationTerrain planes the rect to avg - the same base
      // the RMB flats sit on). Location-type gate verbatim.
      if (!farView && populatesWanderingNpcs(dfLocation.mapTableData.locationType)) {
        await ensurePersonTex();
        const nav = new CityNavigation(loc.width, loc.height);
        for (const b of loc.blocks) {
          const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
          // WATER-NPC: the enhanced lane's wider water family, off the
          // ONE switch the water surface reads - so wherever the pass
          // draws water, a wandering NPC will not walk into it.
          nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData,
            (tx, ty) => srcTiles[tx][ty].textureRecord, { enhancedWater: waterSwitchOn() });
          await breather.breathe();   // IC-STUTTER: a block of the walkers' grid a breath (a city's sixty-four were one task)
        }
        walkShut?.(nav);   // TS6: and only on the town's own ground, never through its wall (world/townWalls.js townWalkShut)
        if (lefaySpot) carveLefay(nav, lefaySpot);   // LEFAY1: the people walk round the monument, never through it
        if (yardSites?.length) carveYards(nav, yardSites);   // MERCHANT-YARDS: and round the yards
        if (portSites?.length) carveYards(nav, portSites);   // SHIPYARDS: and round the shipyard and the lighthouse
        carveCapitalWalks(nav, dfLocation);   // FB1029 BRIDGE-ENDS: and off a capital's works over Daggerfall's blocks
        personBatches = new Map();   // person -> batch (destroyed with the pixel)
        made.personBatches = personBatches;   // BUILD-FAIL1
        const personCollider = {
          // location-frame raycast through the live world collider
          raycast: (from, dir, l) => {
            const t = host.state.pixelTranslation(px, py);
            return collider.raycast(
              [from[0] + locOrigin[0] + t[0], from[1] + t[1], from[2] + locOrigin[2] + t[2]], dir, l);
          },
        };
        // LW2 (2026-10-04, Mac: "NPCs are no longer just random walking entities"): THE LIVING WORLD'S STREETS where
        // the Features row says (systems/livingWorld/livingSwitch.js) - the town's residents on their days
        // (systems/livingWorld/livingTown.js), in the pool's own shape and on the same navgrid, bodies and batches; the
        // town's doors named by their buildings (the block cell each door now carries), its buildings by their summaries.
        // JAN1 (2026-09-18, Janome: "people walking in the sky lol, just outside the city"): THE TERRAIN'S
        // FLOOR, not the location's average. The navgrid is the BLOCK rect; the flattened rect is the stamped
        // tiles plus a clearance (terrainTiles.js setLocationTiles) and is smaller by a band of ~70 units on
        // every side, and blendLocationTerrain only EASES that band toward the average - so a walker there stood
        // at the average while the real ground fell away under it, ten metres in the air on the flattest city
        // pixel. Inside the rect heightAt IS the average, so nothing there moves; the fixed city's host
        // (exterior.js) already asks its collider. Persons are pixel-local vertically: the pixel's translation
        // comes off the world height. A pixel not built yet answers the old constant.
        const personGroundY = (x, z) => {
          const t = host.state.pixelTranslation(px, py);
          const h = heightAt(x + locOrigin[0] + t[0], z + locOrigin[2] + t[2]);
          return Number.isFinite(h) ? h - t[1] + 2.0 * 0.025 : locOrigin[1];
        };
        const livingTown = livingTownAt(px, py) ?? {
          mapId: (dfLocation.mapTableData?.mapId ?? 0) >>> 0, name: dfLocation.name, px, py,
          type: dfLocation.mapTableData?.locationType, region: dfLocation.regionIndex, people: climate?.people,
          blocks: loc.width * loc.height, port: hasPort(dfLocation.mapTableData?.mapId),
        };   // LW3: the roads' own record of the town (the same row the trips read - WW1: the world's registry's, wherever it stands), a mod's town its own
        // IC-STUTTER (bible/03-World/Arena-Provinces.md IC-STUTTER): the town's buildings and doors first, and its places
        // made of them a step at a time through the build's breather (livingTown.js livingTownPlaces) - one task of
        // 0.1-0.4 s on a near slice of the Imperial City where the town made them itself
        /** @type {any} */
        const livingOf = {
          town: livingTown,
          buildings: buildingSummaries(dfLocation.exterior?.buildings ?? [], loc.blocks, { locationIndex: dfLocation.locationIndex ?? 0, locationName: dfLocation.name })
            .map((b) => ({ key: b.buildingKey, type: b.buildingType, quality: b.quality, factionId: b.factionId })).concat(cityHomesOf(dfLocation).buildings),   // IC-GRAND: the fabric's homes (world/imperialHomes.js)
          doors: (made.doors ?? buildingDoors).filter((d) => d.pixelKey === key && d.blockX != null).map((d) => {
            const m = d.door.matrix, c = d.door.centre, n = d.door.normal;
            return {
              key: makeBuildingKey(d.blockX, d.blockY, d.recordIndex),
              x: m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12] - locOrigin[0], z: m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14] - locOrigin[2],
              nx: m[0] * n.x + m[4] * n.y + m[8] * n.z, nz: m[2] * n.x + m[6] * n.y + m[10] * n.z,
            };
          }).concat(cityHomesOf(dfLocation).doors),
        };
        if (livingWorldOn()) livingOf.places = await livingTownPlaces(nav, livingOf, () => breather.breathe());
        // IC-STUTTER: and its streets' pieces flooded a step at a time before it stands - the town walk's (systems/travel/
        // townWalk.js componentsOf: the traveller's pace and way ask them), kept on the grid; asked whole by the first
        // frame of a traveller in it, a slice of the Imperial City's 512 by 512 cells was a task of its own
        await stepsBreathing(componentsSteps(nav), () => breather.breathe());
        population = livingWorldOn() ? new LivingTown(nav, {
          ...livingOf,
          makePerson: (archive, guard) => {
            const person = new ResidentWalker(nav, { archive, guard, frameCount: (rec, a) => personTex.get(a).getFrameCount(rec), collider: personCollider, groundY: personGroundY });
            personBatches.set(person, renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]));
            return person;
          },
          clock: skyMinutes, rate: livingRate, mpm: PERSON_MOVE_SPEED / livingBaseRate(),
          suppressSpawns: () => racialSuppressPopulationSpawns(playerEntity),   // V4: the transformed lycanthrope empties the streets - here they stay in
          relations: () => host.livingRelations, playerName: () => playerEntity.name ?? '', weather: () => host.weather,
          townName: dfLocation.name, regionName: dfLocation.regionName ?? '',
          patronsOf: () => _livingPatrons.get(livingTown.mapId >>> 0) ?? null,   // LW15: its patrons' errands, its traders' doors
          carriedOf: (day) => livingCarriedOf(livingTown, day),   // LW16: the word carried in from the towns about
          tripsOf: (day) => livingTripsOf(livingTown, day), armOf: livingArmOf, flatOf: livingFlatOf,   // LW3: its travellers away and armed, its visitors - LW-LOOKS: its still pictures
          familyNews: (t) => host.legacyHost?.newsFor(livingTown.mapId, t) ?? null,   // LEGACY6: what the town says of the line
          // CHAP5b (Chapters-Arc 9): a guild's chapter here off the sheet the tab holds - its band, its guild named - for
          // its hall's evenings and the town's talk of it; none offline (no sheet: the living world is today's)
          chapterOf: chapterSheet ? (faction) => livingChapterOf(faction, px, py) : undefined,   // AUDIT CHAP4 C2: this town's own pixel
          econBandOf: () => townEcon.bandOf(livingTown.mapId),   // TOWN-ECON TE3: the town's economy, as its talk tells it (none offline)
          extraPeople: (day, town) => host.legacyHost?.residentsOf(livingTown.mapId, (seed) => town.homeFor(seed), (id) => town.residents.find((r) => r.id === id) ?? null) ?? null,   // LEGACY-HOME: Project Legacy's line, at home here (LEGACY5: a spouse, the census's own)
          ashore: (res) => livingAshore(livingTown, res), crews: () => livingCrews(livingTown),   // LW5: its sailors by their ships' clock; the crews lying here
          // LW7: a townsperson's place by the lives, a hand's death, the player's, and the town's own lines of sight
          // LEGACY5: a townsperson wed into Project Legacy's line is the line's resident now (extraPeople) - the census's place
          // stands empty of them, living or dead
          holderOf: (res, day) => (host.legacyHost?.holdsResident(res.id) ? null : livingPlaceOf(res, livingCycleOf(res, day)).holder), deadAt: livingDeadAt, slay: livingSlay, killed: livingKilled,   // WATCH-FIX: one of the watch another hand cut down
          legalStanding: (region) => ({ rep: legalRepOf(playerEntity, region), known: knownCriminal(playerEntity, region, { ownNow: ownMinutes(), worldNow: trustedWorldMinutes() }) }),   // WATCH-KNOWS: the watch's word by the law
          dangers: () => host.livingDangers(px, py, locOrigin),   // WATCH-PROTECTS: the monsters its people run from
          sees: (a, b) => {
            const tr = host.state.pixelTranslation(px, py);
            const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(d[0], d[1], d[2]);
            if (len < 1e-3) return true;
            const hit = collider.raycast([a[0] + locOrigin[0] + tr[0], a[1] + tr[1], a[2] + locOrigin[2] + tr[2]], [d[0] / len, d[1] / len, d[2] / len], len);
            return !(Number.isFinite(hit) && hit < len - 0.25);
          },
          harbour: () => {   // LW5: its harbour's berth in the location's frame (the dock of a port with no Ship building)
            const b = host.harbourBook.get(`port:${portIdOf(livingTown)}`)?.harbour?.berths?.[0];   // WW3: its port id, the world's key past the Bay
            if (!b) return null;
            const tr = host.state.pixelTranslation(px, py);
            return { x: b.pos[0] - locOrigin[0] - tr[0], z: b.pos[1] - locOrigin[2] - tr[2] };
          },
          // LW6c: what the player carries, for a keepsake carried home - and the keepsake handed over
          keepsakes: () => playerEntity.items ?? [],
          takeKeepsake: (item) => { const i = playerEntity.items?.indexOf(item) ?? -1; if (i >= 0) playerEntity.items.splice(i, 1); },
        }) : new TownPopulation(nav, {
          suppressSpawns: () => racialSuppressPopulationSpawns(playerEntity),   // V4: the transformed lycanthrope empties the streets
          totalBlocks: loc.width * loc.height,
          // AUDIT 23 (characters-4/5): billboard race = the climate's
          // People; the NAME bank = the REGION's (MobilePersonNPC.cs:214).
          // REGIONAL-FOLK: and a Redguard region's walkers are Redguards.
          race: walkerRace(climate?.people, dfLocation.regionIndex),
          nameBank: provinceNameBank(provinceAt(px, py)?.key) ?? getNameBankOfRegion(dfLocation.regionIndex),   // AUDIT-TESA A2-5: past the Bay the province's people, never the Bay region's
          folk: folkOfLocation(dfLocation),   // PROVINCE-FOLK: past the Bay each walker one of the place's people (its zone's - AUDIT PROVINCE-FOLK B6), named from their own bank
          region: dfLocation.regionIndex ?? -1, home: folkKeyOf(folkOfLocation(dfLocation)),   // REGION-NAMES: its walkers named by its region's customs
          makePerson: (archive, guard) => {
            const person = new MobilePerson(nav, {
              archive, guard,
              // audit 2026-08-17: identity re-rolls per spawn - resolve
              // by the person's LIVE archive, never the creation one
              frameCount: (rec, a) => personTex.get(a).getFrameCount(rec),
              collider: personCollider,
              groundY: personGroundY,   // JAN1: the terrain's floor (above, one closure for both pools)
            });
            personBatches.set(person, renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]));
            return person;
          },
        });
      }
    }

    // WOD2: AddLocation's OBJECT loop (LocationLoader.cs:232-252) through
    // LoadObject (world/worldOfDaggerfall/wodLocationObjects.js): the models with their
    // colliders, the visible flats base-anchored where AlignToBase leaves
    // them, the mod's own lights, the animals' calls - pixel-local like
    // everything here, so destroyPixel takes them with the pixel (the C#
    // destroys the terrain's children at every promote, :93-99). No
    // climate swap and no doors: these hang off the terrain, not a
    // DaggerfallLocation, and a static door is RMBLayout's alone.
    const pixelWodLights = [];
    let wodSite = null;
    let wodSpawners = null;
    const pixelRocks = [];   // PROF2: the Rocks and Mountains layouts' standing pieces, pixel-local boxes - Mining's anchors
    if (wodPicks && wodAverages) {
      // GATE-AGREE: the picks whose objects stand - a pick a clearing withholds levelled the ground above and stands nothing
      const stood = wodPicks.filter((_, i) => !wodHeld[i]);
      const place = wod.placements(stood, wodAverages.filter((_, i) => !wodHeld[i]));
      const rockPick = (i) => WOD_ROCK_SITES.includes(stood[i]?.name);   // PROF2's rock sites; ROCK-SUNK: and the sites whose 60610 is a boulder
      const _roadsNow = terrainGen.roads();   // ROADS-CLEAR: null until the network lands - the roads sweep rebuilds this pixel then
      let _wodOffRoad = 0, _wodOffGate = wodPicks.length - stood.length;
      if (place.stopped) console.warn(`[wod] pixel ${key}: a negative model name stopped the loader here, as uint.Parse throws in the C#`);
      const wodBucket = onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]));   // BLOOD1 AUDIT 3: one array a bucket; PERF-COL2: riding the floating origin
      for (const m of place.models) {
        const gpu = await getGpuMesh(m.modelId);
        if (!gpu) continue;   // a model ARCH3D does not carry stands empty in DFU (no mesh, no collider)
        const cpu = wodRockUvs(cpuModels.get(m.modelId), m.matrix, m.modelId);   // FB1001-WODROCK (Mac: "Retexture them to be as detailed as possible"): a piece stretched 4x or more draws its planes unfolded at its pebble's own texel density (world/worldOfDaggerfall/wodRockUv.js) - new UVs only, its positions and indices the model's own arrays; a camp or a house is the same object
        const box = transformedAabb(archAabb(m.modelId, cpu.positions), m.matrix);
        // WOD-BUSH (2026-10-01, Mac: "World of daggerfall bush props float above the ground in bandit camps"): the
        // layouts' shrub stands on the DRAWN ground. The mod stands every object on the site's average plus the
        // author's own height, and the ground is levelled to that average only inside the site's rect - the band past
        // it is eased toward it (flattenForLocation), and the shrubs ring the site in that band, at heights the
        // author read off the ground of the one place they were laid out. They hung over ground falling away (DFU's
        // too). Its mesh's foot goes to the lowest ground under the middle of its footprint, collider and all.
        if (isWodShrub(m.modelId, stood[m.pick]?.name)) {   // ROCK-SUNK (2026-10-02, the field: "Insane glitched geometry over at Hadus"): the rock fields build their outcrops of the same model - boulders scaled 5.6 to 95, set into the piles on purpose - and standing those on their lowest corner raised shards hundreds of metres into the sky round Hadus; a Rocks or Mountains site keeps the mod's height (world/worldOfDaggerfall/wodLocationObjects.js isWodShrub)
          const dy = lowestGroundUnder(samples, box) - box[1];
          m.matrix[13] += dy; box[1] += dy; box[4] += dy;
        }
        // ROCK-SEAT (world/worldOfDaggerfall/wodLocationObjects.js rockSeatDrop): a rock field's piece hanging over ground that falls away
        // under it is lowered into the ground - its open underside never stands in the air; one in the ground stays put
        // - and only a piece SET into it (its foot under the ground at its middle): one the mod rests on another's crown keeps its height
        if (rockPick(m.pick) && box[1] < surfaceHeightAt(samples, Math.max(0, Math.min(TERRAIN_SIZE, (box[0] + box[3]) / 2)), Math.max(0, Math.min(TERRAIN_SIZE, (box[2] + box[5]) / 2)))) { const dy = rockSeatDrop(lowestGroundUnder(samples, box), box[1]); if (dy < 0) { m.matrix[13] += dy; box[1] += dy; box[4] += dy; } }
        // ROADS-CLEAR (2026-09-25, Mac: "Camps, mountains from WOD, shouldnt be placed on roads"): a piece whose own
        // mesh box reaches a road - here or in the pixel it spills into - is not stood: no mesh, no collider. The rock
        // fields and mountains lose the pieces over the road and keep the rest; a whole site was asked at its pick.
        if (boxNearPath(_roadsNow, px, py, box[0] * UNITS_PER_METRE, box[2] * UNITS_PER_METRE, box[3] * UNITS_PER_METRE, box[5] * UNITS_PER_METRE, WOD_PIECE_ROAD_CLEAR)) { _wodOffRoad++; continue; }
        // GATE-CLEAR (2026-09-28, Mac: "the gate can spawn inside the rock geometry from world of daggerfall"): nor one
        // whose box reaches the Oblivion Gate's clearing (world/gate/gateClearance.js) - a gate risen inside a boulder is out
        // of reach of the press and the step. What stands goes in the reach, for the next gate's sweep to ask.
        if (boxNearGate(gateClear, px, py, box[0], box[2], box[3], box[5])) { gateLedger.refused = true; _wodOffGate++; continue; }
        gateLedger.reach.push(box[0], box[2], box[3], box[5], 0);
        unionBox(box);
        if (rockPick(m.pick)) { const foot = rockFootprint(cpu.positions, cpu.indices, m.matrix, samples); if (foot) pixelRocks.push(foot); }   // PROF2: a rock piece that stood - a vein's foot or a boulder; ROCK-FOOT: as it stands out of the ground, never its whole mesh's box (none if wholly under it)
        const entry = { gpu, local: m.matrix, _box: box, _order: m.modelId };
        models.push(entry);
        if (cpu.normals && cpu.uvs) { addStatic(cpu, m.matrix, false, m.normalMatrix); entry._batched = true; }
        late.add(key, cpu.positions, cpu.indices, m.matrix, { translation: wodBucket });   // CreateDaggerfallMeshGameObject's MeshCollider - ROCK-CLEAR: through the gate
        await breather.breathe();
      }
      for (const f of place.flats) {
        if (pointNearPath(_roadsNow, px, py, f.base[0] * UNITS_PER_METRE, f.base[2] * UNITS_PER_METRE, WOD_PIECE_ROAD_CLEAR)) { _wodOffRoad++; continue; }   // ROADS-CLEAR: and a flat on one
        // VERGE1: and under clear roadsides, nor one whose picture reaches the road - its half width (its own scale on
        // DFU's record size) past the pieces' margin, the wild's flats' disc
        if (vergeNet && !vergeClear(vergeNet, px, py, f.base[0], f.base[2], WOD_PIECE_ROAD_CLEAR / UNITS_PER_METRE + ((await halfWidthsOf(f.archive))[f.record] ?? 0) * f.scale.x)) { _wodOffRoad++; continue; }
        if (pointNearGate(gateClear, px, py, f.base[0], f.base[2], WOD_FLAT_GATE_CLEAR_M)) { gateLedger.refused = true; _wodOffGate++; continue; }   // GATE-CLEAR: and one in the gate's clearing
        gateLedger.reach.push(f.base[0], f.base[2], f.base[0], f.base[2], WOD_FLAT_GATE_CLEAR_M);
        if (f.scale.x === 1 && f.scale.y === 1 && isStandFlat(f.archive, f.record)) pixelStandFlats.push({ archive: f.archive, record: f.record, x: f.base[0], y: f.base[1], z: f.base[2] });   // STAND-FLAT / STAND-HORSE: a site's horse or person, a batch of its own
        else if (f.scale.x === 1 && f.scale.y === 1) addFlat(f.archive, f.record, f.base[0], f.base[1], f.base[2]);
        else addScaledFlat(f.archive, f.record, f.scale, f.base[0], f.base[1], f.base[2]);
      }
      // AddLight: DaggerfallUnity's interior light prefab under the flat,
      // lifted and coloured by the mod's own two switches. A Unity Light
      // burns at every hour, so these are not the lanterns' night list.
      for (const f of place.lights) {
        const pos = wodLightPosition(f.base, f.record, lightSize(f.record), f.scale.y);
        const light = wodLightProperties(f.record);
        pixelWodLights.push({
          x: pos[0], y: pos[1], z: pos[2], range: light.range,
          color: [light.color[0] * light.intensity, light.color[1] * light.intensity, light.color[2] * light.intensity],
        });
      }
      // AddAnimalAudioSource: RMBLayout's table (LocationHelper.cs:1481-1515),
      // so the town animals' own list carries them.
      for (const f of place.animals) {
        const sound = ANIMAL_SOUND_BY_RECORD[f.record];
        if (sound != null) pixelAnimals.push({ pos: [f.base[0], f.base[1], f.base[2]], sound });
      }
      // WOD3: every marker's LocationEnemySpawner, at the marker's CENTRE -
      // the flat was AlignToBase'd, so its transform sits half a scaled
      // height over its base - which is what Vector3.Distance measures.
      if (place.spawners.length) {
        wodSpawners = [];
        const oidSeen = new Map();   // AUDIT WOD7: a layout may number two markers alike (WOD_Nature_01's two bears, WOD_Ruins_04's three warriors, all 0)
        for (const s of place.spawners) {
          const t = await getTexture(s.archive);
          const h = s.record < t.recordCount ? billboardSize(t, s.record).h : 0;
          const centre = [s.base[0], s.base[1] + (h * s.scaleY) / 2, s.base[2]];
          const n = oidSeen.get(s.objectID) ?? 0; oidSeen.set(s.objectID, n + 1);
          wodSpawners.push({ spawner: new WodSpawner(s), centre, flat: null, restand: false, oid: s.objectID, oidN: n });   // WOD7: oid (and its index among the pixel's alike) - the marker's site with the pixel   // a carried one replaces it at publish (m4)
        }
      }
      if (_wodOffRoad) console.log(`[wod] pixel ${key}: ${_wodOffRoad} piece(s) kept off the road`);   // ROADS-CLEAR
      if (_wodOffGate) console.log(`[wod] pixel ${key}: ${_wodOffGate} piece(s) or site(s) kept off a breach's clearing`);   // GATE-CLEAR; GATE-AGREE: a held site counts
      const site = [...wodPicks].reverse().find((p) => p.flatten);
      if (site) wodSite = { xMin: site.rect.x, xMax: site.rect.x + site.rect.width, yMin: site.rect.y, yMax: site.rect.y + site.rect.height };
    }
    // ROAD-LOOK (world/road/bridgeModels.js): the bridges this pixel owns, the kernel's - a road or a track over a river wider
    // than a ford - merged with its statics and solid in its bucket through the gate, both freed with the pixel
    const bridgeBucket = onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]));
    standBridges(bridges, px, py, { addStatic: (m, at) => addStatic(m, at, true), solid: (m, at) => late.add(key, m.positions, m.indices, at, { translation: bridgeBucket }), grow: unionBox });

    // EV7: the nature layout arrived with the kernel's reply - laid
    // out over the same blended samples and finished tilemap, consumed
    // at the same point in the sequence it was always computed at.
    // PROF4 (bible/06-Systems/Professions-Arc.md 25): THE FOREST'S TREES KEPT - the flats World of Daggerfall's table names
    // a Tree by the climate's summer archive, each its group and its place in it: Logging's trees stand at them
    const pixelTrees = [];
    // BANTHA1: THE JUNGLE'S TREES - the flats its layout stood as the owner's trees (world/terrain/jungleNature.js: a
    // species and a scale each), by species: the owner's tree where its door has loaded, else the Tree record it carries
    const jungleGroups = new Map();
    const jungleOk = !!jungle && nature.some((f) => f.jungle != null) && !!(await jungle.door.load());
    const borderNature = new Map();   // ECOTONE1: a neighbour climate's nature archive the border stood here -> its summer archive
    // TESA-LANDS: THE LANDS' LANDMARKS past the Bay (world/lands/landProps.js) - the worker's, each kept whole or not at all
    // off the gate's clearing and the rocks as the graht-oaks are (below), and the flats kept off the feet of those kept
    // (AUDIT: the worker cleared them under every landmark, and one the gate or a rock dropped left a bare ring)
    const fire = onTheBay(px, py) ? null : fireClearing(px, py);   // LAVA-CLEAR, FENCE-CLEAR: the lava's beds and the fence's line
    const landStood = lands ? standLandProps(px, py, fire ? clearedLandProps(fire, landProps) : landProps, (x, z) => !pointNearGate(gateClear, px, py, x, z, WOD_FLAT_GATE_CLEAR_M) && !insideRocks(pixelRocks, x, z)) : null;
    const offLand = landFeetOff(landStood?.set.props, TERRAIN_SIZE / WORLD_MAP_TILE_DIM);
    for (const f of nature) {
      if (offLand?.(f.x, f.z)) continue;   // TESA-LANDS: a stalk's, a column's, a trunk's foot and a vineyard's rows clear
      if (fire?.(f.x, f.z)) continue;   // LAVA-CLEAR, FENCE-CLEAR: no flat in the lava or the fence
      // GATE-CLEAR (AUDIT FOREST1 F5): the day's Oblivion Gate keeps its clearing of nature as it keeps it of World of
      // Daggerfall's flats - a tree no longer stands through the gate's stone or the Sigil Broker (the sweep builds the
      // pixel again when the gate's day turns). FOREST1 (F1): and a wood's flats keep out of the rock pieces it grows
      // round - DFU's own scatter, with the switch off, is left as DFU lays it
      if (pointNearGate(gateClear, px, py, f.x, f.z, WOD_FLAT_GATE_CLEAR_M)) continue;
      if ((forests || (jungle && f.archive === JUNGLE_ARCHIVE)) && insideRocks(pixelRocks, f.x, f.z)) continue;   // AUDIT BANTHA1 LAY-4: and the jungle's, whatever the woods' switch
      const base = f.archive ?? climate.natureArchive;   // ECOTONE1: a border's flat is its own climate's - the summer archive the kernel names
      // VERGE1: and none reaches over a road or a track - the disc of its widest picture (world/road/roadVerge.js);
      // BANTHA1: a jungle tree's its FOOT - its roots, buttresses and the curtains it hangs to the ground - at its own
      // scale, never its crown: a road is cut through the jungle, and the canopy may close over it
      // AUDIT BANTHA1 LAY-5/HOST-6: the foot whether or not the owner's files loaded (the measures are a table), so the
      // trees a road keeps are the layout's alone - every peer's the same
      const jungleTree = jungleOk && f.jungle != null;
      if (vergeNet && !vergeClear(vergeNet, px, py, f.x, f.z, f.jungle != null ? JUNGLE_MEASURES[f.jungle].foot * f.js : natureReach(vergeHalf.get(base)[f.record] ?? 0, base, f.record, px, py, f.x, f.z))) { vergeOff++; continue; }
      if (jungleTree) {
        // AUDIT BANTHA1 PERF-5: a species' young trees a group of their own (`J<species>y`) - the understorey, which the far
        // rings stand as they stand the floor (below)
        const young = f.js <= JUNGLE.underScale[1], gk = young ? `J${f.jungle}y` : `J${f.jungle}`;
        let g = jungleGroups.get(gk);
        if (!g) jungleGroups.set(gk, (g = { species: f.jungle, young, centers: [], own: [] }));
        g.centers.push([f.x, f.y, f.z]); g.own.push(f.js);
        pixelTrees.push({ id: pixelTrees.length, group: gk, i: g.centers.length - 1, x: f.x, y: f.y, z: f.z, wood: f.wood ?? 1, base, archive: getNatureArchive(base, pixelSeason), jungle: f.jungle, js: f.js });   // a tree of the woods - Logging fells it; AUDIT BANTHA1 TREE-3: its species and scale its mark's; AUDIT PRECIP HOST-7: the rainforest's set wears no winter (climateSwaps.js NATURE_WINTER_SETS), so its foot's snow is never asked
        continue;
      }
      // PRECIP4: on the snow lane each wears the snow at its own foot against its own draw (scenes/snowCoverHost.js flatSeason)
      // - AUDIT PRECIP HOST-6: and kept; HOST-7: once it is known to stand (a flat the verge refused turned no pixel)
      const fSeason = snowRec ? snowRec.flat(f.x, f.z, f.y - SEA_LEVEL_M, pixelSeason) : pixelSeason;
      const archive = getNatureArchive(base, fSeason);   // worn in its season's set
      if (archive !== natureArchive) borderNature.set(archive, base);
      // FOREST1: how wooded its tile is - Logging's trees stand in the woods; ECOTONE1: and whose climate it is (its stump);
      // its group and place in it groupFlats' (placeTrees)
      const tree = isTreeRecord(base, f.record) ? { id: pixelTrees.length, group: '', i: 0, x: f.x, y: f.y, z: f.z, wood: f.wood ?? 0, base, archive } : null;
      if (tree) pixelTrees.push(tree);
      addFlat(archive, f.record, f.x, f.y, f.z, { wild: base, tree });   // LPT1: a wild flat - DFU's terrain variety is its, a location's flat takes none
    }
    // JUNGLE-ROADSIDE: THE ROADSIDE PAIRS (scenes/roadsidePairs.js) - whole, clear of the gate's clearing and the rocks
    // as every flat above, or not at all (their feet are off the roads by their law: no verge asks them); never in
    // pixelTrees, whatever the jungle's door did (AUDIT JUNGLE-ROADSIDE GAME-2). The door not loaded, each tree stands
    // as the Tree record it carries, at its own ground, as the jungle's trees stand then
    const pairs = keptPairs(roadside, (x, z) => !pointNearGate(gateClear, px, py, x, z, WOD_FLAT_GATE_CLEAR_M) && !insideRocks(pixelRocks, x, z));
    if (!jungleOk) {
      for (const t of pairs.flatMap((p) => p.trees)) {
        const archive = getNatureArchive(JUNGLE_ARCHIVE, pixelSeason);
        if (archive !== natureArchive) borderNature.set(archive, JUNGLE_ARCHIVE);
        addFlat(archive, t.record, t.x, walkGroundAt(samples, t.x, t.z), t.z, { wild: JUNGLE_ARCHIVE });
      }
    }
    // WOD4: THE CAMP AT PRIVATEER'S HOLD (world/worldOfDaggerfall/wodPrivateersHold.js).
    // DungeonExterior finds the block by name and PrivateersHold.Start
    // builds the camp in the block's frame: the models with their
    // colliders, the flats CENTRED where Start sets them, a FireLight over
    // each fire on the per-light channel with the mod's other lights. The
    // meshes take the location's climate: they hang off the block, and
    // DaggerfallLocation.ApplyClimateSettings re-skins every mesh under
    // it (at its next season or city-lights change; the port stands them
    // re-skinned). The foes roll on the first exterior frame the block
    // stands in, as Start runs (standHold).
    let privateersHold = null;
    if (holdBlocks.length) {
      const holdBucket = onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]));   // BLOOD1 AUDIT 3: one array a bucket; PERF-COL2: riding the floating origin
      for (const origin of holdBlocks) {
        for (const hm of HOLD_MODELS) {
          const gpu = await getGpuMesh(hm.modelId);
          if (!gpu) continue;
          await remapSubMeshes(gpu.subMeshes, texRemap, townClimateArchive, pipeline, townClimateBase);
          const local = multiply(origin, holdModelMatrix(hm));
          const cpu = cpuModels.get(hm.modelId);
          const box = transformedAabb(archAabb(hm.modelId, cpu.positions), local);
          unionBox(box);
          const entry = { gpu, local, _box: box, _order: hm.modelId };
          models.push(entry);
          if (cpu.normals && cpu.uvs) { addStatic(cpu, local, false); entry._batched = true; }
          late.add(key, cpu.positions, cpu.indices, local, { translation: holdBucket });   // CreateDaggerfallMeshGameObject's MeshCollider - ROCK-CLEAR: through the gate
          await breather.breathe();
        }
        for (const hf of HOLD_FLATS) {
          const t = await getTexture(hf.archive);
          if (hf.record >= t.recordCount) continue;
          addFlat(hf.archive, hf.record, ...centredBase([origin[12] + hf.pos[0], origin[13] + hf.pos[1], origin[14] + hf.pos[2]], billboardSize(t, hf.record)));   // FIELD-GUN20's conversion: the batch is base-anchored
        }
        for (const l of holdFireLights()) pixelWodLights.push({ x: origin[12] + l.pos[0], y: origin[13] + l.pos[1], z: origin[14] + l.pos[2], range: l.range, color: l.color });
      }
      privateersHold = { origins: holdBlocks.map((o) => [o[12], o[13], o[14]]), state: { rolled: false, foes: [], gone: false } };   // a carried roll replaces it at publish (m4)
    }

    // GHOSTFENCE (scenes/ghostfenceBuild.js): the Ghostfence's pylons, its curtain's solid and Ghostgate where it crosses
    // this pixel past the Bay, on its own ground
    if (!onTheBay(px, py)) standGhostfence({ px, py, pkey, key, samples, renderer, addStatic, unionBox, late, translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])) });
    // OW-WOD-LAG: the pixel's wide faces (a World of Daggerfall massif's rocks) in their tree now, once every mesh of the
    // pixel's bucket is in - inside the build, never raised by the first query of a frame in play
    collider.settle(key);
    await breather.breathe();

    // SIB1: DaggerfallTerrain.OnInstantiateTerrain - ApplyCurrentSeason
    // (false) before this terrain's batches take their material, so the
    // cache they read holds the season the clock says.
    if (await host.seasonsReady) await seasons.onTerrainInstantiated();
    const seasonsGen = seasons?.generation ?? 0;   // AUDIT 61: the install the lookups below read - not the one standing at publish
    const flatAnims = new FlatAnimator();   // FA1
    const batches = [];
    made.batches = batches;   // BUILD-FAIL1
    const forestGroups = new Map();   // PROF4: the nature groups' batches, by group - where a felled tree is sunk
    const coverItems = [];   // TACT1: the pixel's solid flats, pixel-local, the centres by reference (a felled tree sinks its own)
    // LPT1: the pixel's low-poly trees - the handles its far pictures stand on (held until the pixel goes), and a group a
    // batch: its handle, its centres, which of them are the terrain's own. The set is made when the pixel comes near
    // (lowPolyTreesFrame - AUDIT LPT B10)
    const lptHandles = [], lptGroups = [];
    made.lptHandles = lptHandles;   // BUILD-FAIL1
    // ECOTONE1: the pixel's nature archives - its own and any a border stood - each the flora (it sways, it is the forest
    // a tree is felled in, its Trees are cover's trunks) and each named by its summer archive (the Tree table's key; the
    // season's own number named none in winter, so a winter wood's trees were cover as flats - mended with it)
    const natureSet = new Set([natureArchive, ...borderNature.keys()]);
    const natureBase = (a) => (a === natureArchive ? climate.natureArchive : borderNature.get(a));
    // WITCH1 (bible/06-Systems/Witches-Festival.md): WHILE THE WITCHES' FESTIVAL RUNS, the town dressed in its people's
    // way and a Wyrd Sister at each tavern's door (world/witchesDecor.js) - its flats logged with the block's (they batch,
    // light, stand solid and keep through a re-skin as those do), a fire among them a hearth, the Sisters stood with the
    // street's people below; each spot clear of the walls the pixel's bucket now holds and of what the town stands
    const witchDress = witchFloor != null && locBlocks ? await witchesDressingBreathing({
      frames: pixelHomeFrames, taverns: buildingKeysOfType(locBlocks, makeBuildingKey, TALK_BUILDING_TYPES.Tavern), temples: buildingKeysOfType(locBlocks, makeBuildingKey, TALK_BUILDING_TYPES.Temple),
      mapId: dfLocation?.mapTableData?.mapId ?? 0, climateIndex: maps.getClimateIndex(px, py), region: dfLocation?.regionIndex ?? null, floorY: witchFloor,
      floorAt: dfLocation?.capital && locOrigin ? (x, z) => witchFloor + capitalBlockLift(dfLocation, Math.floor((x - locOrigin[0]) / RMB_SIDE), Math.floor((z - locOrigin[2]) / RMB_SIDE)) : null,   // SOLITUDE-RELIEF: a block's tier
      blocked: colliderBlocked(collider, host.state, px, py), ground: dryGround(locBlocks, locOrigin), taken: [...flatLog.map((f) => f.c), ...[...pixelNpcFlats, ...pixelStandFlats].map((n) => [n.x, n.y, n.z])],
    }, () => breather.breathe()) : null;   // PERF7: a city's rays breathe
    for (const f of witchDress?.flats ?? []) {
      addFlat(f.archive, f.record, ...f.c);
      if (f.archive !== LIGHTS_ARCHIVE) continue;
      const s = lightSize(f.record);
      pixelLights.push([f.c[0], f.c[1] + s.h, f.c[2]]);
      if (isHearthFlat(LIGHTS_ARCHIVE, f.record)) pixelHearths.push([f.c[0], f.c[1] + s.h, f.c[2], f.c[1], s.w, s.h]);
    }
    pixelNpcFlats.push(...(witchDress?.sisters ?? []));
    // AUDIT PRECIP HOST-7: the groups stood by the one function a re-skin stands them by (standFlatGroups, above)
    const { groups, wild: wildFlats, places } = groupFlats(flatLog, flatLog.map((f) => [f.archive, f.record]));
    placeTrees(flatLog, flatLog.map((f) => f.archive), places);
    await standFlatGroups({ px, py, groups, wild: wildFlats, natureSet, natureBase, tilemap, paths, vergeNet, uploadRecord, uploadRecordFrame, flatAnims, unionBox },
      { batches, forestGroups, coverItems, lptHandles, lptGroups });
    const groupBatches = batches.slice(), groupForest = new Set(forestGroups.keys()), groupCover = coverItems.length;
    // BANTHA1: THE JUNGLE'S TREES STAND - a species a batch of its far picture (the owner's tree drawn once from the
    // side, systems/jungleTreesAssets.js), each tree's own scale on its corner, and its 3D tree near the eye (the pixel's
    // `jungleTrees` set, the jungle door's) - Low Poly Trees' own handover. Each is a Tree of the rainforest: it sways as
    // the flora do, it is the forest Logging fells in (its group `J<species>`), its cover is its own trunk and crown
    // (JUNGLE_MEASURES), and the far rings stand it by its own height
    const jungleHandles = [], jungleSet = [];
    made.jungleHandles = jungleHandles;   // BUILD-FAIL1
    const junglePics = new Map();   // a species' picture and its handle's index, asked and held once for its storeys
    const speciesPic = async (species) => {
      if (!junglePics.has(species)) junglePics.set(species, await junglePicture(jungle.door, species));   // THE ONE CONSTRUCTION SEAM (world/naturePicture.js)
      return junglePics.get(species);
    };
    // JUNGLE-ROADSIDE: the pairs - each tree its half near the eye, joining its species' group below (`spanned`, `spans`)
    if (jungleOk && pairs.length) {
      await standRoadside({
        door: jungle.door, pairs, speciesPic, groups: jungleGroups, handles: jungleHandles, set: jungleSet,
        sway: (proto, record) => {
          _lptSway.set(proto, Math.max(_lptSway.get(proto) ?? 0, floraSwayOf(JUNGLE_ARCHIVE, natureSet, proto.size.h)));
          _lptWindfall.set(proto, Math.max(_lptWindfall.get(proto) ?? 0, windfallResponse(JUNGLE_ARCHIVE, record)));
        },
      });
    }
    for (const [gk, g] of jungleGroups) {
      await breather.breathe();
      g.centers.forEach(standsOnGround);   // FLORA-GROUND, THE RINGS: the jungle's trees and its roadside pairs stand on the ground by its law
      const species = g.species, record = JUNGLE_SPECIES[species].record;
      g.centers.forEach((c, i) => coverItems.push(jungleBody(c, species, g.own[i])));   // PROP-BODIES: its trunk, whichever picture stands
      const pic = await speciesPic(species);
      if (!pic) {   // its picture would not stand (a decode refused): the species stands as the Tree record it carries
        const t = await getTexture(JUNGLE_ARCHIVE);
        if (record >= t.recordCount) continue;
        uploadRecord(JUNGLE_ARCHIVE, record);
        const size = billboardSize(t, record);
        const batch = renderer.createBillboardBatch(JUNGLE_ARCHIVE, record, size, g.centers);
        batch._box = flatBatchAabb(g.centers, size);
        batch.sway = floraSwayOf(JUNGLE_ARCHIVE, natureSet, size.h);
        batch.windfall = windfallResponse(JUNGLE_ARCHIVE, record);
        if (g.young) batch.farH = 0;   // PERF-5: the understorey as the floor, past ring 1
        unionBox(batch._box);
        batches.push(batch);
        forestGroups.set(gk, { batch, centers: g.centers, size });
        if (isCoverFlat(JUNGLE_ARCHIVE, record, size)) for (const c of g.centers) coverItems.push(...coverProxies(c, size, { tree: true }));
        continue;
      }
      const { proto, far } = pic;
      if (pic.h == null) { jungle.door.acquire(far); jungleHandles.push(far); pic.h = jungleHandles.length - 1; }   // AUDIT LPT B5: held until the pixel goes - once a species
      const own = Float32Array.from(g.own), scales = Float32Array.from(g.own, (v) => v / JUNGLE_SCALE_MAX);
      // JUNGLE-ROADSIDE: a pair's tree its half draws near (scenes/roadsidePairs.js)
      const near = g.spanned ? g.centers.map((c) => !g.spanned.has(c)) : null;
      jungleSet.push({ h: pic.h, centers: near ? g.centers.filter((_, i) => near[i]) : g.centers, wild: null, own: near ? own.filter((_, i) => near[i]) : own, fit: null });
      const batch = renderer.createBillboardBatch(JUNGLE_ARCHIVE, far.record, far.size, g.centers, { scales });
      batch.lptProto = g.spans ? [far, ...g.spans] : far;   // JUNGLE-ROADSIDE: and to its pair trees' halves
      batch.sunLift = JUNGLE_SUN_LIFT;   // AUDIT BANTHA1 TREE-2: its sun read at its crown, as its 3D tree's
      // MAC1's far rings: the tree's own height - it has no classic flat to stand for; AUDIT BANTHA1 PERF-5: the young
      // trees under the canopy none (the floor's): past ring 1 every eye meets the crowns about them first - from outside
      // the jungle looking in they were 41% of its trees drawn, 170,000 quads against the rainforest's 103,000
      batch.farH = g.young ? 0 : proto.size.h;
      batch._box = flatBatchAabb(g.centers, far.size);
      batch.sway = floraSwayOf(JUNGLE_ARCHIVE, natureSet, proto.size.h);
      _lptSway.set(proto, Math.max(_lptSway.get(proto) ?? 0, batch.sway));
      batch.windfall = windfallResponse(JUNGLE_ARCHIVE, record);   // WINDFALL1: its Tree record's mask
      _lptWindfall.set(proto, Math.max(_lptWindfall.get(proto) ?? 0, batch.windfall));
      unionBox(batch._box);
      batches.push(batch);
      forestGroups.set(gk, { batch, centers: g.centers, size: far.size, scales });   // PROF4: a felled tree's batch - it falls as its far picture
      g.centers.forEach((c, i) => coverItems.push(...jungleCover(c, species, own[i])));   // TACT1: its own trunk and crown
    }
    // GRAHT1: VALENWOOD'S GRAHT-OAKS (scenes/grahtHost.js) - the worker's, each kept whole or not at all off the gate's
    // clearing and the rocks as every flat; the set rides the pixel (its host frames every built pixel's), its trunks' and
    // buttresses' bodies its cover, with the jungle's (kept through a re-skin as theirs are)
    const grahtStood = jungle?.graht?.stand(px, py, graht, (x, z) => !pointNearGate(gateClear, px, py, x, z, WOD_FLAT_GATE_CLEAR_M) && !insideRocks(pixelRocks, x, z)) ?? null;
    if (grahtStood) coverItems.push(...grahtStood.bodies);
    // TESA-LANDS: the landmarks stood above - the set rides the pixel (the trees' host frames every built pixel's -
    // scenes/landPropsHost.js), the bodies of its stalks, columns and trunks its cover
    if (landStood) coverItems.push(...landStood.bodies);
    // FLORA-GROUND, THE RINGS (scenes/floraSeat.js): ITS PLANTS DRAWN ON THE GROUND IT IS BUILT AT - every forest group's
    // batch and its graht-oaks, on its ring's ground, its box grown to hold them - a breath of its own (the far ring's
    // first read of its ground), before it publishes and its felled trees are sunk; the world host seats them again
    // wherever that ground changes (world.js restrideTerrain, dwRecarve)
    await breather.breathe();
    seatFlora({ samples, _stride: stride, _bed: bed, _box: bounds, forest: { groups: forestGroups }, grahtOaks: grahtStood?.set ?? null, landProps: landStood?.set ?? null }, renderer);   // TESA-LANDS: and the landmarks
    // and built near, the far ring's lifts made ahead in a breath of their own - the walk away from a pixel built about the
    // player (a load, a landing) demotes five at a crossing, each then reading its ground in the crossing's frame
    if (stride === 1 && lodStride > 1) { await breather.breathe(); warmFlora({ samples, forest: { groups: forestGroups }, grahtOaks: grahtStood?.set ?? null, landProps: landStood?.set ?? null }, lodStride); }
    // WOD2: the scaled flats - billboardSize times the object's own scale.
    for (const { archive, record, scale, centers } of scaledGroups.values()) {
      const t = await getTexture(archive);
      if (record >= t.recordCount) continue;
      uploadRecord(archive, record);
      const base = billboardSize(t, record);
      const size = { w: base.w * scale.x, h: base.h * scale.y };
      const batch = renderer.createBillboardBatch(archive, record, size, centers);
      batch._box = flatBatchAabb(centers, size);
      unionBox(batch._box);
      armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
      batches.push(batch);
      if (isCoverFlat(archive, record, size)) for (const c of centers) coverItems.push(coverProxy(c, size));
      coverItems.push(...flatBodies(t, archive, record, size, centers, { tree: natureSet.has(archive) && isTreeRecord(natureBase(archive), record) }));   // PROP-BODIES
    }
    // STAND-FLAT / STAND-HORSE (bible/04-Characters/Morrowind-NPCs.md section 28): each town horse and each person no
    // StaticNPC holds a batch of its own in the pixel's list (its cull, its far-ring rule, its animation and its teardown
    // the groups'), minted as a group's plain picture is - a person's picture the clothed stand-in's under NUDE-FLATS, the
    // born flat their identity. The record is world/standFlats.js's (a horse's heading and look, a person's piece for
    // figureLook - MWNPC18's reading: FLATS.CFG's sex and caption, the region's race).
    const standFlats = [];
    for (const sf of pixelStandFlats) {
      const horse = isStandingHorseFlat(sf.archive, sf.record);
      const [archive, record] = horse ? [sf.archive, sf.record] : drawnFlat(sf.archive, sf.record);
      const t = await getTexture(archive);
      if (!t || record >= t.recordCount) continue;
      uploadRecord(archive, record);
      const size = billboardSize(t, record);
      const centers = [[sf.x, sf.y, sf.z]];
      const batch = renderer.createBillboardBatch(archive, record, size, centers);
      batch._box = flatBatchAabb(centers, size);
      unionBox(batch._box);
      armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
      batches.push(batch);
      standFlats.push(standFlatRecord(sf, batch, standFlatId(`${px},${py}`, sf.x, sf.z)));
    }
    // TACT1: under the pixel's own bucket key - it leaves with the pixel (Collider.removeBucket) - and a rebuild stands it anew
    collider.cover.remove(key);
    // AUDIT BANTHA1 TREE-1: in slices on the stream's own clock - a jungle pixel stands 10,000 proxies
    const coverT = ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]);
    for (let i = 0; i < coverItems.length; i += COVER_SLICE) {
      if (i) await breather.breathe();
      collider.cover.add(key, coverItems.slice(i, i + COVER_SLICE), coverT);
    }

    // AUDIT 26 (F019): the pixel's street StaticNPCs - identity inputs
    // + the billboard extent the activation ray needs, resolved the
    // way the interior host resolves its people's
    // (interiorContext.js:"const standPerson"). FLATS.CFG is awaited because
    // SetLayoutData's exterior overload reads it for the gender
    // (StaticNPC.cs:185-194); loadFlats never throws and is warmed with
    // the scene, so this is a coalesced wait. The list rides the pixel,
    // so destroyPixel takes it away with everything else.
    await pipeline.loadFlats();
    const pixelNpcs = [];
    for (const flat of pixelNpcFlats) {
      // NUDE-FLATS: the picture (and so the box) is the clothed stand-in's
      // while Show Nudity is off - a coven's witches; the identity stays born.
      const [drawArchive, drawRecord] = drawnFlat(flat.archive, flat.record);
      const t = await getTexture(drawArchive);
      if (!t || drawRecord >= t.recordCount) continue;
      const size = billboardSize(t, drawRecord);
      const pn = exteriorNpcRecord(flat, pipeline.flatsFile()?.getFlatData(flat.archive, flat.record) ?? null);
      // E3: `active` is the GameObject's own state (the away arm's
      // SetActive(false)) and `questBehaviour` the component
      // SetupIndividualStaticNPC attaches; both are what the interior
      // host's people carry, so the click seam reads one shape.
      pixelNpcs.push({ ...pn, drawArchive, drawRecord, width: size.w, height: size.h, active: true, questBehaviour: null, host: null, witch: flat.witch ?? null, ...(flat.witch ? { _mwLook: null } : {}) });   // WITCH1: a Wyrd Sister marked - and her own picture, never a Morrowind commoner's look (scenes/world.js streetLook)
      // The extent still belongs to the pixel's culling box even though
      // the billboard is batched later (a pixel whose only content near
      // an edge is a street NPC must not cull itself away).
      unionBox(flatBatchAabb([[flat.x, flat.y, flat.z]], size));
    }

    // EV6: the pixel's models sort by MESH at build - one archetype's
    // placements draw back to back and the VAO shadow skips the rebind.
    models.sort((a, b) => a._order - b._order);
    // PERF-EXT23 (2026-09-25, the players: "fps issues in the exterior but
    // fine in the interior", "me too my friend.. don't know why. I got a
    // RX6600"): THE TAIL BREATHES TOO. The merge and createMesh's spheres ran
    // after the last breath above in one piece - on a synthetic city pixel
    // 45-60 ms of ONE frame, on a town 6-26 ms, for every town, city and WoD
    // pixel streamed in. The merge now yields a model's copy, a range of the
    // sphere's passes and a texture group at a time, and hands createMesh the
    // spheres it measured, so createMesh walks nothing again. Same arrays,
    // same spheres, byte for byte; the pixel publishes a few frames later.
    const staticMerged = await staticBuilder.finishSliced(() => breather.breathe());   // PERF4
    const staticBatch = staticMerged ? renderer.createMesh(staticMerged, { bounds: staticMerged.bounds }) : null;
    made.staticBatch = staticBatch;   // BUILD-FAIL1

    // AUDIT-TO1 B3: StreamingWorld.OnUpdateLocationGameObject
    // (TravelOptionsMod.cs:384, handler :438-445) - the mod re-reads the
    // location rects when the terrain under the player LANDS, because
    // OnMapPixelChanged may have fired before it was built. The record
    // below is what locationTileRect reads, so this runs after it lands.
    // AUDIT BRANCH (WoD) m4: the carry is adopted HERE, with nothing
    // awaited between it and built.set - a sweep during the build has
    // cleared it, so a stale roll never stands in the new world.
    const dwResult = dwNear ? await dwNear.catch(() => null) : undefined;   // DW-B: before the carry, which nothing may await past (AUDIT BRANCH (WoD) m4)
    // SEAT1a (Seats-Arc 3.4): a seat town's banner anchors - its palace's door, its gates - measured where it is built
    // (scenes/seatBanners.js); hung while the seats are open to this account. BOUNTY1's split of the boards' places: the
    // siege field's Market, and null off a seat - the palace keys, the banners and the Festival read it as the seat's word
    const pixelBoardSplit = dfLocation && locBlocks && seatAtMapId(townSeats, dfLocation.mapTableData?.mapId) ? questBoardIndices(pixelBoards) : null;
    const seatPalaceKeys = pixelBoardSplit ? palaceKeysOf(locBlocks, makeBuildingKey) : [];
    const seatTier = dfLocation ? seatAtMapId(townSeats, dfLocation.mapTableData?.mapId)?.tier ?? 'palace' : 'palace';
    const castleGate = seatTier === 'crown' ? castleEntranceOf(pixelDungeonDoors) : null;   // CASTLE-GATE: a crown city's castle entrance
    const seatAnchors = pixelBoardSplit ? seatBannerAnchors({
      frames: pixelHomeFrames, palaceKeys: seatPalaceKeys, castle: castleGate,
      gates: pixelGates.map((g) => ({ local: g.local, box: g.entry?._box })), centre: townCentreOf(pixelHomeFrames),
    }) : null;
    // FESTIVAL-STAGE (Seats-Arc 7.6): a Festival's more banners - its taverns' doors - and a lantern
    // before every banner the town flies, measured here; hung and lit while a Festival rules (scenes/seatFestival.js)
    const festivalAnchors = pixelBoardSplit ? festivalBannerAnchors({ frames: pixelHomeFrames, tavernKeys: buildingKeysOfType(locBlocks, makeBuildingKey, TALK_BUILDING_TYPES.Tavern) }) : null;
    const festivalLanterns = festivalAnchors ? festivalLanternsOf([...(seatAnchors ?? []), ...festivalAnchors]) : null;
    // CHAP7b (Chapters-Arc 8): the town's guild halls and temples, by their guild - a chapter's patron's banners hang at them.
    // AUDIT CHAP5 C5: online alone (the sheet's) - offline no banner hangs, and the buildings' names are drawn for nothing
    const pixelChapterHalls = new Map(chapterSheet && dfLocation && locBlocks ? buildingSummaries(dfLocation.exterior?.buildings ?? [], locBlocks, { locationIndex: dfLocation.locationIndex ?? 0, locationName: dfLocation.name })
      .filter((b) => (b.buildingType === TALK_BUILDING_TYPES.GuildHall || b.buildingType === TALK_BUILDING_TYPES.Temple) && b.factionId > 0)
      .map((b) => [b.buildingKey, b.factionId]) : []);
    // SEAT2a part four (Seats-Arc 6.2): the battlefield the town's own records give - the banners, the Throne, the camps
    // (systems/siegeField.js), the same on every machine; sent for a battle's pass from the Seat tab
    const siegeField = pixelBoardSplit ? siegeFieldOf({
      frames: pixelHomeFrames, palaceKeys: seatPalaceKeys,
      templeKeys: buildingKeysOfType(locBlocks, makeBuildingKey, TALK_BUILDING_TYPES.Temple), hallKeys: buildingKeysOfType(locBlocks, makeBuildingKey, TALK_BUILDING_TYPES.GuildHall),
      gates: pixelGates.map((g) => ({ box: g.entry?._box })), boards: pixelBoards, bounty: pixelBoardSplit, centre: townCentreOf(pixelHomeFrames),
      tier: seatTier, castle: castleGate,
    }) : null;
    if (siegeField) siegeFieldsByTown.set(dfLocation.mapTableData?.mapId, { key: pkey, px, py, field: siegeField });
    const snowSeen = snowRec?.done(models.length > 0 || dfLocation != null) ?? null;
    const wodKept = adoptWodCarry(pkey, wodSpawners, privateersHold);
    const wodLife = wodKept.life ?? {};   // L1-3: this terrain's identity - kept across a rebuild or a pool, new on a promote
    if (!wodKept.life) wodForgetPeerSites(pkey);   // AUDIT WOD7: a fresh promote's markers are its own again
    if (key === pkey && isEnhanced() && !midRingDisabled()) stampPixelFade(terrain, px, py, host.state.current, overworldTint(maps.getClimateIndex(px, py), host.woods.getHeightMapValue(px, py)), performance.now());   // MID-RING: the stream's new pixel eases out of the middle ring's tint
    if (_building.get(key) === made) _building.delete(key);   // BUILD-FAIL1: the entry owns them from here
    swap.publish(px, py, key, made, {   // IC-SWAP-BEHIND: published - behind, the old view down and this one's woken in the same step
      staticBatch,   // PERF4: the merged static models, drawn with the pixel matrix; null when the pixel has none
      // AUDIT-TO1 B2: DaggerfallTerrain.MapData.locationRect - the tile
      // rect setLocationTiles answered, with its extraClearance, which is
      // what Travel Options' SetLocationRects reads off the BUILT terrain
      // (TravelOptionsMod.cs:541-551). Null for a pixel with no location.
      locationRect,
      _seasonsGen: seasonsGen,   // SIB1: the install this pixel's flats were built under (AUDIT 61: captured at the lookups)
      homeTown, homeKeys: pixelHomeKeys, buildingKeys: pixelBuildingKeys,   // HOME-LOOK: the homes drawn on their own, and every building's key
      _lookV: homeLookRead,   // HOME-LOOK (AUDIT)
      homeFrames: pixelHomeFrames, homeRegion: dfLocation?.regionIndex ?? 0,   // HOME-YARD: each building's frame, and the town's region (a yard's pieces are paid there)
      seatAnchors, festivalAnchors, festivalLanterns,   // SEAT1a (above); FESTIVAL-STAGE (above)
      witchHomes: witchDress?.homes ?? null, witchFloor,   // WITCH1: each home's Hearth Offering spot, and the street they stand on (scenes/witchesHost.js)
      chapterHalls: pixelChapterHalls,   // CHAP7b (above)
      beach: beach ?? null,   // AUDIT LANDFORMS II H2: DFU's own blend in a location's pixel with the row on - where a gathering node asks the beach line
      meets: meets ?? null,   // ACROSS-EDGE: the meets its ground took - its ghost rows' at a restride
      px, py, terrain, water, tilemapTex, tilemap, groundArchive, models, windmills, batches, flatAnims, texRemap, lights: pixelLights, hearths: pixelHearths, animals: pixelAnimals, springs: pixelSprings, skyBase: climate.skyBase, samples, natureCount: nature.length,
      tilemapBytes, season: pixelSeason,   // GR1: the placer reads the tiles and the season (PRECIP4: the pixel's)
      _snow: snowSeen,   // PRECIP4: the snow it was built under, every season it took (the sweep's - AUDIT PRECIP HOST-6)
      // AUDIT PRECIP HOST-7: what a re-skin reads (reskinPixelNow), on the snow lane alone - its flats as logged, its blocks'
      // lists, the merge's models (none where its table asked nothing a season turns), the batches, forest groups and cover
      // its groups stood and the cover it keeps (the jungle's, the scaled flats'), its trees, its roads and its middle's
      // ground; `_skinGen` counts its re-skins (a yard stands its pieces again in the new season - scenes/homeYards.js)
      _skin: snowSeen ? { log: flatLog, blocks: skinBlocks, statics: remapAsked(texRemap) ? statics : null, batches: groupBatches, forest: groupForest, cover: coverItems.slice(groupCover), trees: pixelTrees, vergeNet, groundMid, usesSeason: models.length > 0 || dfLocation != null, climate, coverT } : null,
      _skinGen: 0,
      townClimate: townClimateBase,   // DECOR-OUTDOOR: the climate its town's buildings wear - a yard's pieces wear it too (scenes/homeYards.js)
      paths,   // GRASS-PATH1: which tiles the road painter wrote; null on a pixel built before the network arrived
      withRoads,   // ROADS 25: painted with the network present, or before it arrived (see below)
      _box: bounds,   // EV3: pixel-local presentation bounds (terrain + models + flats)
      _stride: stride,   // EV4: the terrain surface's current ring class
      _bed: bed,   // WATER-NEXT 2: the bed, for the cap's re-index (dwWaterSurface) and its re-carve (dwRecarve)
      groundNormals: labGrass && stride === 1 ? normals : null,   // GRASS-LIT2: the near grid's vertex normals - the grass reads its slope off them; AUDIT B1: only where there is grass (200 KB a pixel)
      population, locOrigin, personBatches,   // T2 towns
      monument: lefaySpot,   // LEFAY1: a monument's id and spot, location frame (locOrigin + its x, z) - null where none stands
      merchantYards: yardSites,   // MERCHANT-YARDS: the Stable's and the Wagon Yard's sites, location frame - null off a city or a town
      portSites,   // SHIPYARDS: the shipyard's and the lighthouse's sites, location frame - null off a port town
      wardenTown: dfLocation && isWardenTown(dfLocation.mapTableData?.locationType) ? (dfLocation.mapTableData?.mapId ?? 0) >>> 0 : null,   // WARDEN1: a city's, a hamlet's or a village's map id - its watch throws a wagon parked too long on its road, or past its fourth
      npcs: pixelNpcs,   // AUDIT 26 (F019): RMBLayout's street StaticNPCs, pixel-local
      standFlats,   // STAND-FLAT / STAND-HORSE: the town horses and the people no StaticNPC holds, a batch each (in `batches`), pixel-local
      npcBatches: [], npcQuestPass: false,   // E3: their billboards (a subset of `batches`) and the one-shot SetupIndividualStaticNPC latch
      graves: pixelGraves,   // SEARCH1: a graveyard's headstones, pixel-local boxes
      cityGates: pixelGates,   // AUDIT 64 F14: DaggerfallCityGate's placements (446/447), ticked each frame
      buildings: pixelBuildings,   // AUDIT 64 F11: RMBLayout's StaticBuildings, pixel-local boxes
      locBlocks,   // T3d: the Where-is directory's block scan
      wodLights: pixelWodLights,   // WOD2: the mod's AddLight lights, pixel-local, lit at every hour
      wodSite,     // WOD2: the levelled rect in tile space (grass keeps off it), null on a pixel with no site
      rocks: pixelRocks,   // PROF2: its rock fields' standing pieces (pixel-local boxes) - Mining's veins and boulders stand at them
      // VERGE1: the road's question for a gathering node (a herb patch, a vein on the stone, a Motherlode) - its reach,
      // pixel-local - and how many of the wild's flats the verge refused (a probe's count); null without clear roadsides
      verge: vergeNet ? (x, z, reach) => vergeClear(vergeNet, px, py, x, z, reach) : null,
      vergeOff,
      // ECOTONE1: a border pixel's neighbours for its ground's draw (drawTerrain's `eco`), and its 3x3's ground archives
      // for the grass's border; null for a pixel whose neighbours all wear its own set
      eco, ecoGround: eco ? groundNear : null,
      // PROF4: its forest - the tree flats (a batch drawn for each) Logging's trees stand at, the summer archive that names
      // them and the archive they are drawn from, and their groups' batches where a felled tree is sunk
      forest: { base: climate.natureArchive, archive: natureArchive, trees: pixelTrees.filter((t) => forestGroups.has(t.group)), groups: forestGroups },
      lowPolyTrees: lptGroups.length ? { px, py, ox: 0, oy: 0, oz: 0, handles: lptHandles, groups: lptGroups, trees: null, centers: null } : null,   // LPT1: its 3D trees (gatherNear's set, made near the eye; the frame writes its translation)
      jungleTrees: jungleSet.length ? { px, py, ox: 0, oy: 0, oz: 0, handles: jungleHandles, groups: jungleSet, trees: null, centers: null } : null,   // BANTHA1: the jungle's 3D trees, the jungle door's set (scenes/treesHost.js)
      grahtOaks: grahtStood?.set ?? null,   // GRAHT1: its graht-oaks (scenes/grahtHost.js - framed at its translation, near and far)
      landProps: landStood?.set ?? null,   // TESA-LANDS: its landmarks (scenes/landPropsHost.js - framed at its translation, near and far)
      wodSpawners, // WOD2: LoadObject's spawn markers, for WOD3
      privateersHold,   // WOD4: the camp's block origins and its Start's state, null off the Hold
      arena: arenaOrigin,   // ARENA2: the colosseum's block origin, pixel-local - null off Daggerfall's cell (4,3)
      wodLife,     // AUDIT BRANCH (WoD) L1-3/m1: the terrain's identity, which a late pile and the carry name
      gateClearKey: gateClear?.key ?? null,   // GATE-CLEAR: the gate's clearing this pixel was built against (null: none)
      gateRefused: gateLedger.refused,   // GATE-CLEAR: whether that clearing cost it a site or a piece
      wodReach: gateLedger.reach.length ? Float32Array.from(gateLedger.reach) : null,   // GATE-CLEAR: what it stood, for the next gate's sweep
      placeHold: pipeline,
      location: dfLocation ? dfLocation.name : null,
      arenaSlot: dfLocation?.arena ?? null,
      arenaRoadsEpoch: arenaRoadsAt, arenaRoadsPainted: !!arenaRoads,   // TESA4: the layer it was painted with, and whether its roads reached it
      centerHeight: samples[64 * HEIGHTMAP_DIMENSION + 64] * worldHeight,
      avgY: dfLocation ? avg * worldHeight : 0,
      capitalLod: capitalViewOf(dfLocation),   // IC-GRAND: the view a slice of the Imperial City was built in (scenes/tamrielSweepsHost.js sweepCapitalLod)
    });
    if (deepWaters) deepWaters.published(built.get(pkey), dwResult);   // DW-B: the near promote stands with the pixel, or the pixel waits its turn
    if (dwDecor) dwDecor.onPromote(built.get(pkey));   // DW-E2: UnderwaterDecorations.HandlePromote, after the floor builder's (the subscription order)
    if (host.oceanHoles) host.oceanHoles.promoted(built.get(pkey));   // OH-B: DaggerfallTerrain.OnPromoteTerrainData -> OceanHoles.OnTerrainPromoted (its dependant, subscribed after both of the sea's)
    snowfall.promoted(built.get(pkey));   // SNOWFALL1: OnPromoteTerrainData -> DynamicSnowController.HandleTerrainPromoted - its blanket to make, the nearer tiers over it again
    const dwRubbleKept = _dwRubbleCarry.get(pkey);   // AUDIT DW-F: a rebuilt pixel's rubble, on the entry that stands now
    if (dwRubbleKept) { _dwRubbleCarry.delete(pkey); const e = built.get(pkey); for (const r of dwRubbleKept) r.entry = e; _dwRubble.set(e, dwRubbleKept); }
    host.gatherHost?.onBuilt(built.get(pkey));   // PROF1/PROF2: the day's patches, veins and boulders, stood in the pixel's own list
    for (const pile of wodKept.piles ?? []) standWodPile(pkey, wodLife, pile);   // AUDIT BRANCH (WoD) L1-3: the pooled terrain's piles, where they lay
    gateClearSweep.published(pkey, gateClear?.key);   // GATE-CLEAR: built against a clearing the sweep has moved on from - asked again
    // GRASS-STALE1 (2026-09-19, Discord: "grass is flying and not on the
    // ground" around graveyards and other POIs): this pixel's own
    // samples may have just been flattened toward its location's avgY
    // (blendLocationTerrain, terrainGen.js) - a grass cell placed nearby
    // BEFORE this pixel finished (the world streams nearest-first) read
    // the terrain as it stood then, and nothing else would ever tell it
    // the ground under it moved. Invalidated over this pixel's own world
    // bounds, which is also blendLocationTerrain's own falloff extent -
    // the blend never reaches past the pixel that carries the location -
    // so the next grass update() re-reads `keep`/`ground` fresh here and
    // only here.
    //
    // PERF-EXT21: AND FOR EVERY PIXEL NOW, not only a location's or a
    // site's. A pixel crossing used to throw the whole field away, and
    // that was quietly the heal for every other way a cell goes stale: a
    // cell placed at the boot or after a teleport while its neighbour
    // pixel was not built yet (its blades over the gap refused), a
    // pixel rebuilt under it - the road network arriving, a season's
    // re-skin, a late World of Daggerfall pack, a site a rebuild lost.
    // The crossing keeps the field now, so each of those says so itself,
    // at the one moment they all share: the pixel being published. A
    // far pixel's rect holds no live cell and costs a few hundred Map
    // reads; a near one re-reads exactly the cells that read it wrong.
    if (host.labGrassField) {   // WOD2: a levelled camp moved the ground the same way; AUDIT BRANCH (WoD) m2: a rebuild that lost its site moved it back; PERF-EXT21: every publish re-reads it
      const t = host.state.pixelTranslation(px, py);
      host.labGrassField.invalidate(t[0], t[2], t[0] + TERRAIN_SIZE, t[2] + TERRAIN_SIZE);
    }
    // DISC20-C (Mac: "Horse and carts can be seen parked in the sky"): and a parked wagon or a waiting horse on this
    // pixel - mine or a peer's - stands again on the ground as it now is (horseCartPool.js groundMoved). The mod
    // grounds its standing team once; a rebuild under it (the road network, a late World of Daggerfall pack) left it
    // on the old ground until its owner walked out of the pixel and back.
    if (host.hccGroundMoved) {
      const t = host.state.pixelTranslation(px, py);
      host.hccGroundMoved(t[0], t[2], t[0] + TERRAIN_SIZE, t[2] + TERRAIN_SIZE);
    }
    if (built.has(pkey) && arenaRoadsStale(built.get(pkey), terrainGen.arenaRoadsLanded, arenaRoadsLayer())) _arenaRoadsStale.add(pkey);   // TESA4: posted before a layer that landed while it built
    // AUDIT LANDFORMS II G1/G2: A REBUILD CARRIES WHAT LIES ON ITS GROUND. The road network's landing (ROADS 25) cuts the
    // landforms' roads and channels metres into a pixel built before it - 14% of the network's samples move, up to 30 m
    // on the Menevia escarpment - and a late World of Daggerfall pack or the gate's clearing flattens one. The pools'
    // piles, dropped lights, camps and bodies stayed on the ground as it was, hung over a cut or buried in a fill, and
    // the next save kept them so (written and read through the landed field). Each rides the ground's own move under it,
    // the new samples less the old (TERRAIN-SCALE1's law); and the player the hold held over this pixel, on their feet,
    // rides it too - put back where they stood, they fell the cut (28.7 m, 118 HP, at the worst); a fall under way is
    // their own (FALL-KEPT).
    const groundWas = _groundBefore.get(pkey);
    if (groundWas) {
      _groundBefore.delete(pkey);
      const now = built.get(pkey).samples, t = host.state.pixelTranslation(px, py);
      // heightAt's own read over the pixel's samples, pixel-local - FLORA-GROUND: the ground's one law (walkGroundAt)
      const groundIn = (smp, x, z) => walkGroundAt(smp, Math.max(0, Math.min(TERRAIN_SIZE, x - t[0])), Math.max(0, Math.min(TERRAIN_SIZE, z - t[2])));
      const moved = (x, z) => groundIn(now, x, z) - groundIn(groundWas, x, z);
      host.rideGround?.(t, pkey, moved, key !== pkey);   // IC-SWAP-BEHIND: the pixel's own key; behind, the player on the view swapped out rides it unheld
    }
    if (homeTown) host._homeLookV = -1;   // HOME-LOOK (AUDIT): a town's pixel stood after the registry moved is painted by the next refresh
    // AUDIT-TO1 B3: the second hook. BOOT-TDZ2: THE MOD IS ASKED FIRST,
    // because this builder runs inside the boot's OWN first build and
    // `playerTravelPixel()` reads `walkMode`, `player` and `cam` - three
    // bindings the boot walk declares below that build. With no mod there
    // is nothing to initialise anyway, so asking it first is both the
    // cheaper test and the only one that is safe this early.
    if (host.travelOptions && dfLocation) {
      const here = playerTravelPixel();
      if (px === here.x && py === here.y) host.travelOptions.initLocationRects(here);
    }
    // AUDIT 61 (SIB1): an install landed while this pixel's textures were
    // in flight (a forced apply on a quickload or a teleport whose
    // destination ring keeps this pixel), so its flats were read from an
    // OLDER cache than the one that now stands. The mod's
    // RefreshLoadedNatureBatches re-applies EVERY batch after every
    // apply, the just-built ones included; the stamp scan in `refresh`
    // cannot see a pixel that was not published yet, so this build asks
    // for the re-skin itself - the same publish-time re-check the
    // terrain ring class runs below.
    if (seasons && seasonsGen !== seasons.generation) _reskin.mark(pkey);   // ROAD-H H3: ITS key, not the grid (IC-SWAP-BEHIND: the pixel's, never the build's behind it)
    // ROADS 25: a pixel that was already in flight when the network landed
    // was painted without it and arrives AFTER the sweep. It goes straight
    // back for a rebuild - the worker has the network by now, since the
    // message order is kept.
    // ROADS 25a (Mac: "boot failed: can't access property centerHeight"):
    // the rebuild is THIS call's to make, not a caller's to notice. The
    // first cut tore the pixel down and returned nothing, and the boot
    // path - which awaits the PLAYER's pixel and stands the camera on its
    // centreHeight - read a property off undefined whenever the network
    // landed during that first build, which on a fast connection is
    // every boot. The teleport landing awaited the same nothing. So the
    // roadless pixel is rebuilt here and the rebuilt entry returned;
    // once, because the worker's message order guarantees the second
    // paint has the network, and a network that vanished again is not a
    // reason to loop.
    // AUDIT 68 S22: "kept as painted" keeps it - the retry tore the pixel
    // down too and then read its entry, throwing out of every build.
    if (!withRoads && terrainGen.hasRoads) {
      if (!roadsRetry) {
        swap.mark(px, py);   // IC-SWAP-BEHIND: built again behind the roadless view
        return buildPixelNow(px, py, { roadsRetry: true });
      }
      console.warn(`[roads] pixel ${key} painted without the network twice - kept as painted`);
    }
    const entry = built.get(pkey); pipeline.settle();   // FIELD BUGS 2026-10-04d PLACE-LRU: the pixel stands (published above with its hold, `placeHold`, which destroyPixel releases) - the keep of its last visit goes, with what only that visit held (a re-skin's old season, a rebuild's old layout)
    // AUDIT EV F-SIM2: the ring class was chosen at job-send time and
    // the player may have crossed during the worker round trip - and
    // the pixelChanged restride sweep cannot see an unpublished pixel.
    // Re-check at publish, or a wrong-class chunk stands until the
    // NEXT crossing (which a player who stops walking never makes).
    const wantStride = strideFor(px, py);
    // STREAM1: a promotion here is the same 3.12 ms as one in the
    // crossing sweep, and this runs inside a publish that is already
    // doing GPU uploads - so it goes on the same queue. A DEMOTION is
    // 0.11 ms and settles now, because a pixel left at stride 1 in the
    // far ring costs every frame until it is spent.
    if (wantStride !== entry._stride) {
      if (wantStride === 1) host.restridePending.set(pkey, entry);   // IC-SWAP-BEHIND: the pixel's key
      else restrideTerrain(entry, wantStride);
    }
    // E3: RMBLayout's THIRD act on an exterior StaticNPC, and the stand
    // of its billboard, in that order (:372-377).
    await standPixelNpcs(entry);
    return entry;
  }
  /**
   * AUDIT PRECIP HOST-7: A STANDING PIXEL RE-SKINNED IN PLACE - DaggerfallLocation.ApplyClimateSettings (:133-148), what
   * stands re-read for its season, where the snow's turn tore the whole pixel down and built it again: its terrain, its
   * collider, its doors, its people and its grass, and the motor held on the player's own pixel through the build. The
   * snow's seasons are taken again as the build takes them (scenes/snowCoverHost.js recorder) - its buildings' at its
   * middle, each standing flat's at its foot - and only what wears them is made again: its climate table
   * (world/texRemap.js reskinRemap) and the merge drawn through it, its homes' looks, its mills' bodies, and its flats'
   * groups with their forest, cover, far pictures and animation, each flat in its own place (its centre, by which a
   * felled tree is known and lies felled). All of it made aside and traded in one step; a pixel gone meanwhile lets it
   * all go. The snow lane's alone (`_skin`); answers whether it re-skinned.
   * @param {string} key
   */
  async function reskinPixelNow(key) {
    breather.reset();   // PERF7: a pump's turn
    const p = built.get(key), sk = p?._skin;
    if (!sk || !snowCover?.on) return false;
    await snowCover.settle(breather);   // the snow about the player integrated to the clock's minute before a season is read
    if (built.get(key) !== p) return false;
    const { px, py } = p, pipeline = p.placeHold;
    const rec = snowCover.recorder(px, py);
    const pixelSeason = rec.pixel(sk.groundMid - SEA_LEVEL_M, host.season);
    const natureArchive = getNatureArchive(sk.climate.natureArchive, pixelSeason);
    // each flat's picture in its season: a block's read again from its list (the same flats, in the same order), a wild
    // one's by the snow at its own foot
    const lists = new Map();
    const pics = sk.log.map((f) => {
      if (f.block != null) {
        let list = lists.get(f.block);
        if (!list) lists.set(f.block, (list = collectBlockFlats(sk.blocks[f.block].dfBlock, natureArchive, sk.blocks[f.block].opts)));
        return [list[f.n].archive, list[f.n].record];
      }
      if (f.wild != null) return [getNatureArchive(f.wild, rec.flat(f.c[0], f.c[2], f.c[1] - SEA_LEVEL_M, pixelSeason)), f.record];
      return [f.archive, f.record];
    });
    const flatsTurn = pics.some((pic, j) => pic[0] !== sk.log[j].archive || pic[1] !== sk.log[j].record);
    const law = `climate:${p.townClimate}.${pixelSeason}`, turns = remapLawOf(p.texRemap) !== law;
    const lawOf = (c) => (a, r) => applyClimate(a, r, c, pixelSeason);
    const made = { mesh: undefined, batches: [], forestGroups: new Map(), coverItems: [], lptHandles: [], lptGroups: [] };
    let traded = false;
    try {
      // THE BUILDINGS' SEASON: the table, the merge drawn through it, the homes' looks, the mills' bodies
      let table = turns ? await reskinRemap(p.texRemap, law, lawOf, pipeline) : p.texRemap;
      if (table !== p.texRemap && sameTable(table, p.texRemap)) table = p.texRemap;   // a season that swaps nothing here: the table, the merge and every draw's cache stand
      if (table !== p.texRemap && sk.statics) {
        const merge = new StaticBatchBuilder({ windows: windowKeys(renderer) }), resolve = keyResolver(table), own = keyResolver(NO_CLIMATE_REMAP);
        for (const [cpu, local, isOwn, nm] of sk.statics) { merge.add(cpu, local, isOwn ? own : resolve, nm); await breather.breathe(); }
        const merged = await merge.finishSliced(() => breather.breathe());   // PERF-EXT23: a unit a breath, as the build's
        made.mesh = merged ? renderer.createMesh(merged, { bounds: merged.bounds }) : null;
      }
      const homes = [];   // HOME-LOOK: [a home drawn on its own, its look's table in the season - null: the pixel's]
      if (turns) {
        for (const m of p.models) {
          if (!m._home) continue;
          const look = onlineHomes && p.homeTown ? lookOfHome(p.homeTown, m._home.bk, onlineHomes.homesIn(p.homeTown)?.get(m._home.bk) ?? null) : null;
          homes.push([m, look ? await homeLookRemap(m.gpu.subMeshes, table, look, pixelSeason, pipeline) : null]);
        }
      }
      const mill = turns && p.models.some((m) => m._mill) ? (await getWindmillMeshes(p.townClimate, pixelSeason === SEASON.Winter)).body : null;
      // THE FLATS' SEASONS: their groups stood again by the build's own law, aside
      let flats = null;
      if (flatsTurn) {
        const { groups, wild, places } = groupFlats(sk.log, pics);
        const borderNature = new Map();
        sk.log.forEach((f, j) => { if (f.wild != null && pics[j][0] !== natureArchive) borderNature.set(pics[j][0], f.wild); });
        const natureSet = new Set([natureArchive, ...borderNature.keys()]);
        const natureBase = (a) => (a === natureArchive ? sk.climate.natureArchive : borderNature.get(a));
        if (await host.seasonsReady) await seasons.onTerrainInstantiated();   // SIB1: as the build asks it, before its batches take their material
        const seasonsGen = seasons?.generation ?? 0;
        const box = [...p._box];
        const unionBox = (b) => { for (let i = 0; i < 3; i++) { if (b[i] < box[i]) box[i] = b[i]; if (b[3 + i] > box[3 + i]) box[3 + i] = b[3 + i]; } };
        await standFlatGroups({ px, py, groups, wild, natureSet, natureBase, tilemap: p.tilemap, paths: p.paths, vergeNet: sk.vergeNet, uploadRecord: pipeline.uploadRecord, uploadRecordFrame: pipeline.uploadRecordFrame, flatAnims: p.flatAnims, unionBox }, made);
        // TACT1: its cover set aside, in slices on the stream's clock (AUDIT BANTHA1 TREE-1), traded with its flats
        const cover = collider.cover.staged(sk.coverT);
        const items = [...made.coverItems, ...sk.cover];
        for (let i = 0; i < items.length; i += COVER_SLICE) {
          if (i) await breather.breathe();
          collider.cover.fill(cover, items.slice(i, i + COVER_SLICE));
        }
        flats = { places, seasonsGen, box, cover };
      }
      if (table !== p.texRemap) table = await reskinRemap(p.texRemap, law, lawOf, pipeline, table);   // what the standing table was asked meanwhile (a yard's, a farm's) - nothing is awaited past it
      if (built.get(key) !== p) return false;
      // THE TRADE, in one step
      traded = true;
      if (p.season !== pixelSeason) p._skinGen++;   // its buildings' season turned: a yard stands its pieces again in it (scenes/homeYards.js)
      p.season = pixelSeason;
      p._snow = rec.done(sk.usesSeason);
      p.texRemap = table;
      if (made.mesh !== undefined) { if (p.staticBatch) renderer.destroyMesh(p.staticBatch); p.staticBatch = made.mesh; }
      for (const [m, map] of homes) { m._home.seq++; m.texRemap = map; }   // an ask of refreshHomeLooks under way is the old season's: spent
      if (mill) for (const m of p.models) if (m._mill) m.gpu = mill;
      if (flats) {
        for (const b of sk.batches) {
          p.flatAnims.remove(b);
          renderer.destroyBatch(b);
          const i = p.batches.indexOf(b);
          if (i >= 0) p.batches.splice(i, 1);
        }
        p.batches.unshift(...made.batches);
        const forestGroups = new Map();
        for (const [k, g] of p.forest.groups) if (!sk.forest.has(k)) forestGroups.set(k, g);   // the jungle's stand as they stood
        for (const [k, g] of made.forestGroups) forestGroups.set(k, g);
        placeTrees(sk.log, pics.map((pic) => pic[0]), flats.places);
        p.forest = { base: sk.climate.natureArchive, archive: natureArchive, trees: sk.trees.filter((t) => forestGroups.has(t.group)), groups: forestGroups };
        const sunk = new Set();
        for (const [k, g] of made.forestGroups) g.centers.forEach((c, i) => { if (FELLED.has(c)) sunk.add(`${k}#${i}`); });
        sinkFelled({ groups: made.forestGroups }, sunk, renderer);   // PROF4: a felled tree lies felled in its new picture
        const was = p.lowPolyTrees?.handles ?? [];
        p.lowPolyTrees = made.lptGroups.length ? { px, py, ox: 0, oy: 0, oz: 0, handles: made.lptHandles, groups: made.lptGroups, trees: null, centers: null } : null;
        for (const h of was) lowPolyTrees?.release(h);   // AUDIT LPT B5: the new ones held first
        FOREST_STAMP.n++;   // LPT1: the near 3D trees gathered anew
        collider.cover.place(key, flats.cover);
        for (let i = 0; i < 6; i++) p._box[i] = flats.box[i];
        p._seasonsGen = flats.seasonsGen;
        sk.batches = made.batches;
        sk.forest = new Set(made.forestGroups.keys());
        seatFlora(p, renderer);   // FLORA-GROUND, THE RINGS: the new pictures drawn on the ground the pixel draws (scenes/floraSeat.js)
      }
      sk.log.forEach((f, j) => { f.archive = pics[j][0]; f.record = pics[j][1]; });
      host.gatherHost?.restandAt(px, py);   // PROF4: a felled tree's stump in its season
      return true;
    } finally {
      if (!traded) {
        for (const b of made.batches) { p.flatAnims?.remove(b); renderer.destroyBatch(b); }
        for (const h of made.lptHandles) lowPolyTrees?.release(h);
        if (made.mesh) renderer.destroyMesh(made.mesh);
      }
    }
  }
  _reskin.skinWith(reskinPixelNow);   // AUDIT PRECIP HOST-7: the snow's turn, re-skinned in place (world/seasonReskin.js runSkin)
  return { buildPixelNow };
}

// The build's helpers stand after its constructor: a moved module's constructor is its first exported function
// (test/scenes/bootorder.test.js BOOT-TDZ2 walks it as the host's).
/**
 * AUDIT PRECIP HOST-7: THE FLAT LOG GROUPED - a group a drawn picture (NUDE-FLATS' stand-in's: base-anchored, so it stands
 * where the figure did), its centres the flats' own in the log's order; `pics[j]` flat j's picture now. Answers the groups,
 * the wild flats' marks (`${group}#${i}`, LPT1 - DFU's terrain variety is theirs, a location's flat takes none) and each
 * flat's place, [group, index].
 * @param {Array<{ c: number[], wild?: number }>} log @param {Array<number[]>} pics
 */
export function groupFlats(log, pics) {
  const groups = new Map(), wild = new Set(), places = new Array(log.length);
  for (let j = 0; j < log.length; j++) {
    const [archive, record] = drawnFlat(pics[j][0], pics[j][1]);
    const k = `${archive}_${record}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    places[j] = [k, g.length];
    if (log[j].wild != null) wild.add(`${k}#${g.length}`);
    g.push(log[j].c);
  }
  return { groups, wild, places };
}
/** AUDIT PRECIP HOST-7: each logged tree's group, place and archive (`archives[j]`, flat j's) as it stands - PROF4's
 *  `${group}#${i}`, where a felled tree is sunk.
 *  @param {Array<{ tree?: any }>} log @param {number[]} archives @param {Array<[string, number]>} places */
export function placeTrees(log, archives, places) {
  for (let j = 0; j < log.length; j++) {
    const t = log[j].tree;
    if (t) { t.group = places[j][0]; t.i = places[j][1]; t.archive = archives[j]; }
  }
}
/** AUDIT PRECIP HOST-7: two climate tables that swap every picture alike. */
const sameTable = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
