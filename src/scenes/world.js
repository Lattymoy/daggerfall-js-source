// Milestone 7: ?world (&region=&loc=) renders a location ON its terrain -
// the location pixel flattened to average height, city tiles stamped into
// the terrain tilemap, marching-squares transitions elsewhere.
// Milestone 9: ?world is a floating-origin STREAMING world - terrain
// pixels build nearest-first around the camera within TerrainDistance 3,
// locations appear on their pixels, and crossing a pixel boundary
// recenters the world (streamingWorld.js).

import { Arch3dFile } from '../formats/arch3dFile.js';
import { requestLook } from '../player/pointerLock.js';
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile, getWorldClimateSettings, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { WoodsFile } from '../formats/woodsFile.js';
import { buildTerrainGrid, buildTerrainIndices, convertTilemap, TERRAIN_TILE_DIM } from '../world/terrainSurface.js';
import { windowEmissionRGB } from '../render/windowEmission.js';
import { CITY_LIGHT_COLOR, CITY_LIGHT_RANGE, LIGHTS_ARCHIVE, collectCityLights, nearestLights } from '../world/cityLights.js';
import { applyClimate, getGroundArchive, getNatureArchive, SEASON } from '../world/climateSwaps.js';
import { RMB_SIDE, layoutLocation } from '../world/locationLayout.js';
import { lookAt, multiply, perspective, trs } from '../world/mat4.js';
import { collectBlockFlats, scaledBillboardSize } from '../world/rmbFlats.js';
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4
import { CityNavigation } from '../world/cityNavigation.js';   // T2 towns
import { TownPopulation } from '../systems/townPopulation.js';
import { GUARD_TEXTURE, MobilePerson, PERSON_TEXTURES } from '../characters/mobilePerson.js';
import { createTownTalk } from './townTalk.js';   // T3b
import { createCityGuards } from './cityGuards.js';   // G1
import { createArrestFlow } from './arrestFlow.js';   // G2
import { pickActivatable } from '../player/activate.js';   // G3: corpse loot
import { CharSheet, preloadCharSheetArt, charSheetArtLoaded } from '../ui/charsheet.js';   // U8a: the native char sheet
import { NativeInventoryWindow, preloadInventoryArt, inventoryArtLoaded } from '../ui/nativeInventory.js';   // U8d: the native inventory
import { createDroppedLoot } from './droppedLoot.js';   // U8e: the ground piles
import { preloadPaperDollArt } from '../ui/paperDoll.js';   // U8f: the avatar base
import { buildingDataForDoor } from '../systems/talkTopics.js';   // E2: the shop identity
import { hitSoundFor } from '../systems/soundClips.js';
import { isInvisible } from '../systems/effects.js';
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD } from '../systems/soundClips.js';
import { StreamingWorldState } from '../world/streamingWorld.js';
import { layoutNature } from '../world/terrainNature.js';
import { DEFAULT_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, TERRAIN_SIZE, generateSamples } from '../world/terrainSampler.js';
import { assignTiles, blendLocationTerrain, calcAvgMaxHeight, generateTileData, getLocationTerrainTileOrigin, setLocationTiles } from '../world/terrainTiles.js';
import { CityLightAnimator, SUN_RIG_COLOR, INDIRECT_LIGHT_COLOR, INDIRECT_LIGHT_RANGE, exteriorAmbient, indirectLightScale, isCityLightsOn, isNight, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { audio } from '../systems/audio.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../systems/ambientEffects.js';
import { fetchBytes, parseSeason, createSkyController } from './shared.js';
import { PlayerMotor, FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../player/motor.js';
import { jumpSpeedMultiplier, tallySkill, SKILLS, WEAPON_SKILL } from '../systems/skills.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { SOUND } from '../systems/soundClips.js';
import { createWeaponRig } from '../combat/weaponRig.js';
import { ArrowFlight } from '../combat/arrowFlight.js';   // C13: visible exterior arrows
import { removeOne } from '../systems/inventory.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { getStaticDoors } from '../world/staticDoors.js';
import { Collider } from '../player/collider.js';
import { createDataPipeline } from './dataPipeline.js';
import { createWorldModes } from './worldModes.js';
import {
  WEATHER_TYPES, fogForWeather, skyOffsetForWeather, weatherSunlightScale,
  windowStyleForWeather, weatherRng, fogFactor, precipitationForWeather,
  LightningPlayer,
} from '../world/weather.js';
import { PrecipitationRenderer } from '../render/precipitation.js';

// Milestone 9 scene: floating-origin streaming world. Terrain pixels
// stream in nearest-first around the camera within TERRAIN_DISTANCE,
// locations appear on their pixels, and crossing a pixel boundary
// recenters the world (StreamingWorld + FloatingOrigin semantics in
// streamingWorld.js). Everything is stored pixel-local; per-frame
// placement is pixelTranslation(px, py) under the current compensation.
export async function bootWorld(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';
  const season = parseSeason(params);

  status('loading data');
  const [palBytes, blocksBytes, archBytes, mapsBytes, climateBytes, politicBytes, woodsBytes] =
    await Promise.all([
      fetchBytes('ART_PAL.COL'),
      fetchBytes('BLOCKS.BSA'),
      fetchBytes('ARCH3D.BSA'),
      fetchBytes('MAPS.BSA'),
      fetchBytes('CLIMATE.PAK'),
      fetchBytes('POLITIC.PAK'),
      fetchBytes('WOODS.WLD'),
    ]);
  const palette = new DFPalette();
  palette.load(palBytes, 'ART_PAL.COL');
  const blocks = new BlocksFile();
  blocks.load(blocksBytes);
  const arch = new Arch3dFile();
  arch.load(archBytes);
  const maps = new MapsFile();
  maps.load(mapsBytes, climateBytes, politicBytes);
  const woods = new WoodsFile();
  if (!woods.load(woodsBytes)) throw new Error('WOODS.WLD failed to load');

  // One location per map pixel game-wide (pinned corpus invariant).
  status('indexing locations');
  const locationIndex = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < region.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc || !loc.exterior || !loc.exterior.exteriorData) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      locationIndex.set(`${p.x},${p.y}`, loc);
    }
  }

  const startLoc = maps.getLocationByName(regionName, locationName);
  if (!startLoc) throw new Error(`location not found: ${regionName}/${locationName}`);
  const startPixel = longitudeLatitudeToMapPixel(
    startLoc.mapTableData.longitude, startLoc.mapTableData.latitude);

  const CITY_LIGHT_COLOR_F32 = new Float32Array(CITY_LIGHT_COLOR);
  // World clock (R5) + sky controller: panorama follows the current pixel's
  // climate AND the time of day (async, frame-late at boundaries).
  const sky = createSkyController(renderer.gl, params);
  // Weather (R12), same contract as the exterior scene.
  const weather = WEATHER_TYPES.includes(params.get('weather'))
    ? params.get('weather') : 'sunny';
  const weatherFog = fogForWeather(weather);
  const weatherSkyOffset = skyOffsetForWeather(
    weather, weatherRng(Number(params.get('wseed')) || 1));
  const weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);
  const precipMode = precipitationForWeather(weather);
  const precip = precipMode ? new PrecipitationRenderer(renderer.gl) : null;
  const lightning = weather === 'thunder'
    ? new LightningPlayer(Number(params.get('wseed')) || 1) : null;
  const baseTod = parseTimeOfDay(params.get('tod')) ?? 12 * 60;
  const timeScale = Number(params.get('timescale') || 0);
  const bootedAt = performance.now();
  const minuteNow = () =>
    (baseTod + ((performance.now() - bootedAt) / 1000) * timeScale) % 1440;
  const lightsOnAt = (minute) =>
    params.has('window') ? params.get('window') === 'night' : isCityLightsOn(minute);
  const worldLightAnimator = new CityLightAnimator(4096, CITY_LIGHT_RANGE);

  // --- Shared caches (dataPipeline.js, extracted at P7) -----------------
  const pipeline = createDataPipeline({ renderer, arch, palette });
  const { getTexture, uploadRecord, uploadRecordFrame, getGpuMesh, cpuModels } = pipeline;

  // T2 towns: the person textures (climate People table pends - Breton
  // + guard, the T1 flag), loaded once on the first populated pixel.
  // StreamingWorld adds PopulationManager only to these location types
  // (verbatim): TownCity 0, TownHamlet 1, TownVillage 2, HomeFarms 3,
  // ReligionTemple 5, Tavern 6, HomeWealthy 8.
  const POPULATED_LOCATION_TYPES = new Set([0, 1, 2, 3, 5, 6, 8]);
  const personArchives = [...PERSON_TEXTURES.Breton.male, ...PERSON_TEXTURES.Breton.female, GUARD_TEXTURE];
  const personTex = new Map();
  let _personTexLoad = null;
  const ensurePersonTex = () =>
    (_personTexLoad ??= Promise.all(personArchives.map(async (a) => personTex.set(a, await getTexture(a)))));

  // --- Per-pixel build --------------------------------------------------
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const tileSide = TERRAIN_SIZE / 128;
  const built = new Map(); // key -> pixel entry
  // Player collision (P1): per-pixel triangle buckets in PIXEL-LOCAL
  // space, resolved through the live floating-origin translation; the
  // floor is the terrain heightmap, bilinear over the stored samples.
  const heightCell = TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1);
  const heightAt = (x, z) => {
    for (const p of built.values()) {
      const t = state.pixelTranslation(p.px, p.py);
      const lx = x - t[0];
      const lz = z - t[2];
      if (lx < 0 || lz < 0 || lx >= TERRAIN_SIZE || lz >= TERRAIN_SIZE) continue;
      const fx = lx / heightCell;
      const fz = lz / heightCell;
      const ix = Math.min(HEIGHTMAP_DIMENSION - 2, Math.floor(fx));
      const iz = Math.min(HEIGHTMAP_DIMENSION - 2, Math.floor(fz));
      const sx = fx - ix;
      const sz = fz - iz;
      const at = (a, b) => p.samples[a * HEIGHTMAP_DIMENSION + b] * worldHeight;
      const h =
        at(ix, iz) * (1 - sx) * (1 - sz) + at(ix + 1, iz) * sx * (1 - sz) +
        at(ix, iz + 1) * (1 - sx) * sz + at(ix + 1, iz + 1) * sx * sz;
      return h + t[1];
    }
    return -Infinity;
  };
  const collider = new Collider(heightAt);
  // Building doors (P3): registered pixel-local at build, activated
  // against the live translation; each carries what the transition
  // needs (its block + building record + sibling exterior doors).
  const buildingDoors = []; // {door, pixelKey, dfBlock, recordIndex, climateBase, season}
  const TERRAIN_INDICES = buildTerrainIndices();

  async function buildPixel(px, py) {
    const key = `${px},${py}`;
    const samples = generateSamples(woods, px, py);
    const tilemap = new Uint8Array(128 * 128);
    const dfLocation = locationIndex.get(key) || null;
    let locationRect = null;
    let avg = 0;
    if (dfLocation) {
      [avg] = calcAvgMaxHeight(samples);
      locationRect = setLocationTiles(dfLocation, maps, blocks, tilemap);
      blendLocationTerrain(samples, avg, locationRect);
    }
    assignTiles(generateTileData(samples, px, py), tilemap, true);
    const climate = getWorldClimateSettings(maps.getClimateIndex(px, py));
    const climateBase = climate.climateType;
    const groundArchive = getGroundArchive(climateBase, season);
    const natureArchive = getNatureArchive(climate.natureArchive, season);

    // R9 tilemap pass: shared-index height grid + per-pixel tilemap
    // texture + one cached texture array per ground archive.
    const groundTex = await getTexture(groundArchive);
    if (!renderer.tileArrays.has(groundArchive)) {
      const layers = [];
      for (let r = 0; r < groundTex.recordCount; r++) {
        layers.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
      }
      renderer.uploadTileArray(groundArchive, layers);
    }
    const grid = buildTerrainGrid(samples);
    const terrain = renderer.createTerrainSurface(grid.positions, grid.normals, TERRAIN_INDICES);
    const tilemapTex = renderer.uploadTilemapTexture(convertTilemap(tilemap), TERRAIN_TILE_DIM);

    // Flat groups: pixel-local base positions.
    const groups = new Map();
    const pixelLights = []; // archive-210 lanterns, pixel-local (R3)
    const pixelAnimals = []; // A4: archive-201 town animals, pixel-local {pos, sound}
    const light210 = await getTexture(LIGHTS_ARCHIVE);
    const lightSize = (record) =>
      scaledBillboardSize(light210.getSize(record), light210.getScale(record));
    const addFlat = (archive, record, x, y, z) => {
      const k = `${archive}_${record}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push([x, y, z]);
    };

    // Per-pixel climate swap table: pixels from the swapped archive, UVs
    // from the original (the SetDungeonTextures pattern; verbatim
    // MaterialReader.ChangeClimate semantics).
    const texRemap = new Map();
    const models = []; // { gpu, local } - local precomposed pixel-local matrix
    let population = null;   // T2 towns: this pixel's wandering pool
    let locOrigin = null;    // the location origin, pixel-local
    let personBatches = null;
    let locBlocks = null;    // T3d: the layout blocks for the Where-is directory
    if (dfLocation) {
      const loc = layoutLocation(dfLocation, maps, blocks);
      locBlocks = loc.blocks;
      const tilePos = getLocationTerrainTileOrigin(dfLocation);
      const locLocal = [tilePos.x * tileSide, avg * worldHeight + 2.0 * 0.025, tilePos.y * tileSide];
      // T3d: EVERY location pixel keeps its origin (the population
      // gate below no longer owns it) - the Where-is directory
      // resolves doors and the player in the LOCATION frame.
      locOrigin = [locLocal[0], locLocal[1], locLocal[2]];
      for (const b of loc.blocks) {
        const originMatrix = trs(
          locLocal[0] + b.originX, locLocal[1], locLocal[2] + b.originZ, 0, 0, 0);
        for (const placed of b.layout.models) {
          const gpu = await getGpuMesh(placed.modelIdNum);
          if (!gpu) continue;
          for (const sm of gpu.subMeshes) {
            const swapped = applyClimate(sm.textureArchive, sm.textureRecord, climateBase, season);
            if (swapped === sm.textureArchive) continue;
            const key = `${sm.textureArchive}_${sm.textureRecord}`;
            if (texRemap.has(key)) continue;
            const t = await getTexture(swapped);
            if (sm.textureRecord >= t.recordCount) continue;
            uploadRecord(swapped, sm.textureRecord);
            texRemap.set(key, `${swapped}_${sm.textureRecord}`);
          }
          const local = multiply(originMatrix, placed.matrix);
          models.push({ gpu, local });
          const cpu = cpuModels.get(placed.modelIdNum);
          collider.addMesh(key, cpu.positions, cpu.indices, local,
            () => state.pixelTranslation(px, py));
          // Building models expose their static doors for E-transitions.
          if (cpu.doors && cpu.doors.length) {
            const staticDoors = getStaticDoors(cpu, 0, placed.recordIndex, local);
            for (const door of staticDoors) {
              buildingDoors.push({
                door, pixelKey: key, dfBlock: b.dfBlock,
                recordIndex: placed.recordIndex, climateBase, season,
              });
            }
          }
        }
        // No RMB ground plane on terrain (addGroundPlane = false).
        for (const flat of collectBlockFlats(b.dfBlock, natureArchive)) {
          addFlat(flat.archive, flat.record,
            locLocal[0] + b.originX + flat.x, locLocal[1] + flat.y, locLocal[2] + b.originZ + flat.z);
          // A4: every archive-201 town animal is an audio source
          // (AddAnimalAudioSource on RMB flats, verbatim).
          if (flat.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[flat.record] != null) {
            pixelAnimals.push({
              pos: [locLocal[0] + b.originX + flat.x, locLocal[1] + flat.y, locLocal[2] + b.originZ + flat.z],
              sound: ANIMAL_SOUND_BY_RECORD[flat.record],
            });
          }
        }
        for (const light of collectCityLights(b.dfBlock, lightSize)) {
          pixelLights.push([
            locLocal[0] + b.originX + light.x,
            locLocal[1] + light.y,
            locLocal[2] + b.originZ + light.z,
          ]);
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
      if (POPULATED_LOCATION_TYPES.has(dfLocation.mapTableData.locationType)) {
        await ensurePersonTex();
        const nav = new CityNavigation(loc.width, loc.height);
        for (const b of loc.blocks) {
          const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
          nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData,
            (tx, ty) => srcTiles[tx][ty].textureRecord);
        }
        personBatches = new Map();   // person -> batch (destroyed with the pixel)
        const personCollider = {
          // location-frame raycast through the live world collider
          raycast: (from, dir, l) => {
            const t = state.pixelTranslation(px, py);
            return collider.raycast(
              [from[0] + locOrigin[0] + t[0], from[1] + t[1], from[2] + locOrigin[2] + t[2]], dir, l);
          },
        };
        population = new TownPopulation(nav, {
          totalBlocks: loc.width * loc.height,
          race: 'Breton',
          makePerson: (archive, guard) => {
            const person = new MobilePerson(nav, {
              archive, guard,
              // audit 2026-08-17: identity re-rolls per spawn - resolve
              // by the person's LIVE archive, never the creation one
              frameCount: (rec, a) => personTex.get(a).getFrameCount(rec),
              collider: personCollider,
              groundY: () => locOrigin[1],
            });
            personBatches.set(person, renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]));
            return person;
          },
        });
      }
    }

    const nature = layoutNature(samples, tilemap, {
      mapPixelX: px,
      mapPixelY: py,
      rawWorldHeight: woods.getHeightMapValue(px, py),
      climateType: climate.climateType,
      locationRect,
    });
    for (const f of nature) addFlat(natureArchive, f.record, f.x, f.y, f.z);

    const batches = [];
    for (const [k, centers] of groups) {
      const [archive, record] = k.split('_').map(Number);
      const t = await getTexture(archive);
      if (record >= t.recordCount) continue;
      uploadRecord(archive, record);
      const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      batches.push(renderer.createBillboardBatch(archive, record, size, centers));
    }

    built.set(key, {
      px, py, terrain, tilemapTex, groundArchive, models, batches, texRemap, lights: pixelLights, animals: pixelAnimals, skyBase: climate.skyBase, samples, natureCount: nature.length,
      population, locOrigin, personBatches,   // T2 towns
      locBlocks,   // T3d: the Where-is directory's block scan

      location: dfLocation ? dfLocation.name : null,
      centerHeight: samples[64 * HEIGHTMAP_DIMENSION + 64] * worldHeight,
      avgY: dfLocation ? avg * worldHeight : 0,
    });
    return built.get(key);
  }

  function destroyPixel(px, py) {
    const key = `${px},${py}`;
    const p = built.get(key);
    if (!p) return;
    renderer.destroyMesh(p.terrain);
    renderer.gl.deleteTexture(p.tilemapTex);
    for (const b of p.batches) renderer.destroyBatch(b);
    if (p.personBatches) for (const b of p.personBatches.values()) renderer.destroyBatch(b);   // T2
    collider.removeBucket(key);
    // T3d fix: the pixel's doors leave with it - they accumulated
    // across every rebuild (duplicate E-targets + unbounded growth
    // on long streams; the directory's dedup had been masking it).
    for (let i = buildingDoors.length - 1; i >= 0; i--) {
      if (buildingDoors[i].pixelKey === key) buildingDoors.splice(i, 1);
    }
    built.delete(key);
  }

  // --- Streaming state + player ------------------------------------------
  const state = new StreamingWorldState();
  const queue = state.init(startPixel.x, startPixel.y);
  let building = false;

  status(`building player pixel ${startPixel.x},${startPixel.y}`);
  const first = queue.shift();
  const playerPixel = await buildPixel(first.px, first.py);

  // Camera: at the start location's origin, or the pixel centre.
  const cam = { pos: [TERRAIN_SIZE / 2, playerPixel.centerHeight + 40, TERRAIN_SIZE / 2], yaw: Math.PI, pitch: -0.1 };
  // P1: grounded first-person is the default; ?fly restores the fly cam.
  // The motor freezes until the start pixel's collider exists.
  // C9 fix: shotMode must be declared BEFORE walkMode reads it - the
  // old order (U2b) put it 70 lines down and every bare ?world boot
  // died in the TDZ (?play and ?fly short-circuited past the read, so
  // the played paths never saw it; the &shot&world probe caught it).
  const shotMode = params.has('shot');
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const startKey = `${startPixel.x},${startPixel.y}`;
  const player = new PlayerMotor(collider, undefined, { jumpBoost: () => jumpSpeedMultiplier(playerEntity) });   // AcrobatMotor skill jump (P14)
  // C9: the exterior FP weapon (host rule - every motor host carries
  // it). say -> console FLAGGED: this host has no HUD-text layer yet.
  // T3b: the town interaction seam (modes/talk/pickpocket) - the same
  // module the exterior host mounts (the standing host rule). It is
  // also this host's first HUD-text layer; the rig's say routes there.
  // FLAGGED loud: the People faction rides the START location's
  // region - cross-region streaming keeps the boot region's people
  // until the current-pixel region wiring lands with travel.
  const townTalk = createTownTalk({
    renderer, canvas, fetchBytes, playerEntity, palette,
    regionIndex: startLoc.regionIndex,
    onCrime: () => _crimeResponse(),   // G1: late-bound - the guards mount below
  });
  townTalk.ensureLoaded();
  preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: INFO00I0 warms at boot
  preloadInventoryArt({ renderer, fetchBytes, palette });   // U8d: INVE00I0/01I0 warm at boot
  preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture });   // U8f/U8g: SCBG/BODY/FACE + the item-record pipeline (town context; Breton male 0 INTERIM until chargen)
  const droppedLoot = createDroppedLoot({ renderer, getTexture, uploadRecordFrame });   // U8e
  // FindGroundPosition (CreateDroppedLootContainer): the pile lands
  // on the ground BELOW the player, not at the motor's height
  const dropFeet = () => {
    const p0 = walkMode ? [...player.pos] : [...cam.pos];
    const d = collider.raycast(p0, [0, -1, 0], 10);
    if (Number.isFinite(d)) p0[1] -= d;
    return p0;
  };
  // T3d: the Where-is directory follows the player's LOCATION PIXEL
  // (DFU's TalkManager builds its list for PlayerGPS.CurrentLocation).
  // On pixel crossing, townTalk's topics swap to the new pixel's
  // named-building data; doors and the player resolve in the pixel's
  // LOCATION frame (the floating origin is a pure translation, so the
  // compass answers survive - the invariance is pinned). Names ride
  // the pixel's OWN region; the People faction stays on the boot
  // region (the recorded cross-region flag).
  let _topicsKey = false;   // false = never synced (null topics is a real state)
  function syncTopics() {
    let cur = null;
    for (const p of built.values()) {
      const t = state.pixelTranslation(p.px, p.py);
      const lx = cam.pos[0] - t[0], lz = cam.pos[2] - t[2];
      if (lx >= 0 && lz >= 0 && lx < TERRAIN_SIZE && lz < TERRAIN_SIZE) { cur = p; break; }
    }
    const key = cur ? `${cur.px},${cur.py}` : null;
    if (key === _topicsKey) return;
    _topicsKey = key;
    const dfLocation = key ? locationIndex.get(key) : null;
    if (!cur || !dfLocation || !cur.locBlocks) { townTalk.setTopics(null); return; }
    const { px, py } = cur;
    const lo = cur.locOrigin;
    townTalk.setTopics({
      exteriorBuildings: dfLocation.exterior.buildings,
      blocks: cur.locBlocks,
      doors: buildingDoors.filter((e) => e.pixelKey === key).map((e) => ({
        dfBlock: e.dfBlock, recordIndex: e.recordIndex,
        position: [e.door.matrix[12] - lo[0], e.door.matrix[13] - lo[1], e.door.matrix[14] - lo[2]],
      })),
      locationName: dfLocation.name,
      regionName: maps.getRegionName(dfLocation.regionIndex),
      regionIndex: dfLocation.regionIndex,
      playerPos: () => {
        const t = state.pixelTranslation(px, py);
        const pos = walkMode && playerSpawned ? player.pos : cam.pos;
        return [pos[0] - t[0] - lo[0], pos[1] - t[1] - lo[1], pos[2] - t[2] - lo[2]];
      },
    });
  }
  surfacePlayer();   // the probe surface exists from boot (T3b: pickpocket gold reads)
  let _livePersons = [];
  // G1: the city watch (SpawnCityGuards verbatim) - the streaming
  // host's guards ride the world collider (terrain heightAt included).
  const cityGuards = createCityGuards({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio,
    onPlayerHurt: (dmg, wpn) => {
      if (dmg <= 0) return;
      const apply = () => {
        playerEntity.health = Math.max(0, playerEntity.health - dmg);
        audio.playOneShot(hitSoundFor(wpn), 1.1);
        surfacePlayer();
      };
      // G2: the verbatim arrest interception - a guard hit on an
      // active crime opens the surrender box instead of the damage
      if (!arrestFlow.onGuardHit(dmg, apply)) apply();
    },
  });
  const _guardPool = () => _livePersons.map(({ person, pos }) => ({
    pos, fwdYaw: person.facingYaw, guard: person.guard,
    disable: () => {
      for (const p of built.values()) {
        const it = p.population?.pool.find((i) => i.person === person);
        if (it) { it.person.release(); it.active = false; it.scheduleEnable = false; it.scheduleRecycle = false; it.visible = false; return; }
      }
    },
  }));
  function _crimeResponse() {
    const feet = walkMode && playerSpawned ? player.pos : cam.pos;
    const fwd = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)];
    cityGuards.spawnCityGuards(true, { playerFeet: [...feet], playerFwd: fwd, pool: _guardPool() }).catch((e) => console.error('[guards]', e));
  }
  // G2: arrest + court through the townTalk overlay seam (the prison
  // day-skip is a no-op FLAGGED until the shared calendar lands).
  const arrestFlow = createArrestFlow({ townTalk, playerEntity, regionIndex: startLoc.regionIndex });
  const weaponRig = createWeaponRig({
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    say: (l) => townTalk.say(l),
  });
  const arrows = new ArrowFlight({ getGpuMesh, collider: () => collider });   // C13
  let playerSpawned = false;
  // Edge-detect latch shared with the mode machine: a held key must not
  // re-trigger across a mode switch.
  const latch = { use: false, crouch: false };   // audit 16f: jump is HELD since P14 - the latch slot was dead
  let zPrevW = false;   // C9: the exterior ReadyWeapon (Z) edge
  if (playerPixel.location) {
    const tilePos = getLocationTerrainTileOrigin(startLoc);
    const extentZ = startLoc.exterior.exteriorData.height * RMB_SIDE;
    // Clamp inside the start pixel - the streaming state derives the
    // current pixel from the camera, so spawning past the edge would
    // recentre on frame one.
    cam.pos = [
      tilePos.x * tileSide + startLoc.exterior.exteriorData.width * RMB_SIDE / 2,
      playerPixel.avgY + 30,
      Math.min(tilePos.y * tileSide + extentZ + 120, TERRAIN_SIZE - 1),
    ];
  }

  async function pump() {
    if (building || queue.length === 0) return;
    building = true;
    const next = queue.shift();
    try {
      await buildPixel(next.px, next.py);
    } catch (e) {
      console.error(`pixel ${next.px},${next.py} failed:`, e);
      state.release(next.px, next.py);
    }
    building = false;
  }

  const keys = new Set();
  // C9: the modal machine binds below AFTER these listeners exist -
  // the lazy read avoids the boot-time TDZ (mouse events fire during
  // loading) and defaults to the exterior mode.
  const modeNow = () => modes?.mode ?? 'exterior';
  // P15: AltLeft is Sneak (DFU default) - preventDefault on BOTH edges
  // or the browser menu steals focus (Firefox activates it on keyUP).
  // T3b: the town seam eats its keys FIRST (F1-F4 modes; overlay
  // Esc/Enter) so a held overlay never leaks into the movement set.
  addEventListener('keydown', (e) => {
    if (townTalk.keydown(e)) return;
    // U8a: F5 opens the classic character sheet (the dungeon's key,
    // host rule); preventDefault stops the browser reload.
    if (e.code === 'F5' && !townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {
      e.preventDefault();
      townTalk.showOverlay(new CharSheet(playerEntity));
      return;
    }
    // U8d: F6 opens the classic inventory (DFU's default Inventory
    // binding; same host rule as F5).
    if (e.code === 'F6' && !townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior' && inventoryArtLoaded()) {
      e.preventDefault();
      townTalk.showOverlay(new NativeInventoryWindow({
        items: () => (playerEntity.items ??= []),
        entity: playerEntity,
        icons: { getTexture, uploadRecord, textures: renderer.textures },
        onDrop: (items) => droppedLoot.dropPile(items, dropFeet()),   // U8e: OnPop mints the world pile
      }));
      return;
    }
    keys.add(e.code);
    if (e.code === 'AltLeft') e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'AltLeft') e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => { if (townTalk.pointerdown(e)) return; if (modes.pointerdown?.(e)) return; requestLook(canvas); });   // U8b/U8c: native windows own the pointer
  // C9: RMB is a weapon control (drag-to-swing) exactly as the
  // dungeon host - the drag feeds the rig INSTEAD of the look.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    if (walkMode && (e.buttons & 2) && modeNow() === 'exterior') { weaponRig.attackInput(e.movementX, e.movementY, true); return; }
    cam.yaw -= e.movementX * 0.0025;
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0025));
  });
  addEventListener('mousedown', (e) => { if (e.button === 2 && walkMode && modeNow() === 'exterior') weaponRig.attackInput(0, 0, true); });
  addEventListener('mouseup', (e) => { if (e.button === 2 && walkMode && modeNow() === 'exterior') weaponRig.attackInput(0, 0, false); });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      cam.yaw -= dx * 0.0025;
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - dy * 0.0025));
    },
    attack: (dx, dy, held) => { if (walkMode && modeNow() === 'exterior') weaponRig.attackInput(dx, dy, held); },
    attackTap: () => { if (walkMode && modeNow() === 'exterior') weaponRig.clickAttack(); },
    cycleMode: () => townTalk.nextMode(),   // T3-touch: the phone's F1-F4
  });

  const initialCount = queue.length + 1;
  console.log(`world: streaming from ${startPixel.x},${startPixel.y}, ${initialCount} initial pixels, ` +
    `player pixel ${playerPixel.location || 'wilderness'}, ${playerPixel.natureCount} nature flats`);
  status(`streaming world - ${locationName}`);

  // Shot-mode hooks: __move displaces the camera; __streamIdle reports
  // whether the build queue has drained.
  if (shotMode) {
    window.__move = (dx, dy, dz) => {
      cam.pos[0] += dx; cam.pos[1] += dy; cam.pos[2] += dz;
    };
    window.__pose = (x, y, z, yaw, pitch) => {
      // walk mode: the camera FOLLOWS the motor - move the player
      // (a bare cam.pos write is overwritten next frame; T1 probe fix)
      if (walkMode) { player.spawn(x, y, z); playerSpawned = true; } else cam.pos = [x, y, z];
      cam.yaw = yaw; cam.pitch = pitch;
    };
    window.__streamIdle = () => queue.length === 0 && !building;
    window.__builtCount = () => built.size;
    window.__currentPixel = () => `${state.current.x},${state.current.y}`;
    window.__cam = () => cam.pos.slice();
    window.__player = {
      get pos() { return [...player.pos]; },
      warp: (x, y, z) => { player.spawn(x, y, z); playerSpawned = true; },
    };
    window.__frame = 0;
  }

  // T2: the townsfolk probe surface - aggregated over built pixels,
  // positions reported in WORLD space (through the live translation).
  // Installed AFTER the mode machine exists: modes.installShotProbes()
  // defines an interior __people hook, and the town surface must win
  // in this host exactly as it does in the exterior host (the probe
  // read a null __people for 300s before this ordering was learned).
  function installTownProbes() {
    window.__people = () => {
      const out = [];
      for (const p of built.values()) {
        if (!p.population) continue;
        const t = state.pixelTranslation(p.px, p.py);
        p.population.pool.forEach((it, i) => {
          if (!it.active) return;
          out.push({
            pixel: `${p.px},${p.py}`, i, visible: it.visible, pend: it.scheduleEnable, recyc: it.scheduleRecycle,
            archive: it.person.archive, state: it.person.state, moves: it.person.moveCount, seeks: it.person.seekCount,
            pos: [
              it.person.pos[0] + p.locOrigin[0] + t[0],
              it.person.pos[1] + t[1],
              it.person.pos[2] + p.locOrigin[2] + t[2],
            ].map((v) => Number(v.toFixed(2))),
          });
        });
      }
      return JSON.stringify(out);
    };
    window.__talk = () => JSON.stringify(townTalk._debug());   // T3b probe surface
    window.__guards = () => JSON.stringify(cityGuards._debug());   // G1 probe surface
    window.__droppedLoot = () => JSON.stringify(droppedLoot._piles.map((pl) => ({ n: pl.items.length, pos: pl.pos.map((v) => +v.toFixed(1)), record: pl.record, flat: !!pl.batch })));   // U8e probe surface
    window.__crime = () => _crimeResponse();   // G1: force the response without pickpocket RNG
    window.__guardDamage = (i, dmg) => cityGuards._damage(i, dmg);   // G3: the real death path for loot probes
    window.__uiArt = () => JSON.stringify({ charsheet: charSheetArtLoaded() });   // U8a probe surface
    window.__attack = () => weaponRig.clickAttack();   // G4: ClickToAttack for swing probes
    window.__townDebug = () => {
      const pixels = [];
      for (const p of built.values()) {
        if (!p.population) continue;
        const t = state.pixelTranslation(p.px, p.py);
        const local = [cam.pos[0] - t[0] - p.locOrigin[0], cam.pos[1] - t[1], cam.pos[2] - t[2] - p.locOrigin[2]];
        const [pgx, pgy] = p.population.nav.worldToNav(local[0], local[2]);
        pixels.push({
          pixel: `${p.px},${p.py}`, loc: p.location, pool: p.population.pool.length,
          max: p.population.maxPopulation,
          act: p.population.pool.filter((it) => it.active).length,
          vis: p.population.pool.filter((it) => it.visible).length,
          pgx, pgy, w: p.population.nav.weightAt(pgx, pgy),
          spawnTest: p.population.nav.getRandomSpawnPosition(pgx, pgy, 96, 10),
          origin: [p.locOrigin[0] + t[0], p.locOrigin[1] + t[1], p.locOrigin[2] + t[2]],
          navW: p.population.nav.width, navH: p.population.nav.height,
        });
      }
      return JSON.stringify({ night: isNight(minuteNow()), pixels });
    };
  }

  // P3-P6 mode machine (worldModes.js, extracted at P7): the frame
  // pipeline swaps to a built interior/dungeon context and back.
  // Doors are stored pixel-local and shifted through the LIVE
  // floating-origin translation for the machine's world-space math
  // (translations freeze while a mode is active - the modal frame
  // returns before the streaming step).
  const shiftedDoor = (entry) => {
    const [px, py] = entry.pixelKey.split(',').map(Number);
    const t = state.pixelTranslation(px, py);
    const m = entry.door.matrix;
    const matrix = m.slice();
    matrix[12] = m[12] + t[0];
    matrix[13] = m[13] + t[1];
    matrix[14] = m[14] + t[2];
    return { ...entry.door, matrix };
  };
  var modes = createWorldModes({
    canvas, renderer, player, cam, keys, latch, blocks,
    voxelfolk: params.has('voxelfolk'),
    foes: !params.has('nofoes'),   // C11: foes are the DEFAULT now (monsters live; ?nofoes for the empty-dungeon dev view)
    playerClass: params.has('class') ? Number(params.get('class')) : undefined,
    playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined,
    playerWeapon: params.get('weapon') ?? undefined,
    paint: params.has('paint'),
    piece: params.has('piece') ? Number(params.get('piece') || 102) || 102 : 0,
    pipeline: { getGpuMesh, cpuModels, getTexture, uploadRecord, arch, palette },
    doorTargets: () => buildingDoors.map((e) => ({
      ...e, door: shiftedDoor(e),
      dfLocation: locationIndex.get(e.pixelKey), group: e.pixelKey,
    })),
    baseCollider: () => collider,
    // E2: one entered door -> its merged building identity. Door
    // positions resolve in the pixel's LOCATION frame (the raw
    // buildingDoors matrix is pixel-local; strip the location
    // origin); the name matches the directory only while the topics
    // pixel is the door's pixel (else '' - the window shows Shelves).
    buildingDataForDoor: (hit) => {
      if (!hit?.pixelKey) return null;
      const dfLoc = locationIndex.get(hit.pixelKey);
      const p = built.get(hit.pixelKey);
      if (!dfLoc || !p?.locBlocks || !p.locOrigin) return null;
      const raw = buildingDoors.find((e) => e.pixelKey === hit.pixelKey && e.dfBlock === hit.dfBlock && e.recordIndex === hit.recordIndex);
      const m = (raw ?? hit).door.matrix;
      const d = buildingDataForDoor(dfLoc.exterior.buildings, p.locBlocks, {
        dfBlock: hit.dfBlock, recordIndex: hit.recordIndex,
        position: [m[12] - p.locOrigin[0], m[13] - p.locOrigin[1], m[14] - p.locOrigin[2]],
      });
      if (!d) return null;
      return { ...d, regionIndex: dfLoc.regionIndex, name: townTalk.directory.find((e) => e.buildingKey === d.buildingKey)?.name ?? '' };
    },
  });
  if (shotMode) { modes.installShotProbes(); installTownProbes(); }

  const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS);   // A3
  let _lastPlayerPos = null, _playerStill = false;   // T2: the politeness still-tracker
  // A4: the streaming world's animal sources - pixel-local positions
  // translated through the floating origin at roll time (16 Hz over
  // a handful of animals; recenters are free).
  const animalAmbience = createAnimalAmbience(audio, () => {
    const out = [];
    for (const p of built.values()) {
      if (!p.animals || !p.animals.length) continue;
      const t = state.pixelTranslation(p.px, p.py);
      for (const a of p.animals) out.push({ pos: [a.pos[0] + t[0], a.pos[1] + t[1], a.pos[2] + t[2]], sound: a.sound });
    }
    return out;
  });
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [-Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];   // camera-right = up x back (lookAt handedness): D must move SCREEN-right - the +cos/-sin vector was screen-LEFT (A/D felt swapped)

    // Modal frame (worldModes.js): interior/dungeon consume the frame
    // entirely - the early return also freezes streaming (the
    // context-local player position must never feed the recenter logic).
    if (modes.frame(dt, now)) {
      requestAnimationFrame(frame);
      return;
    }

    if (walkMode) {
      if (!playerSpawned && built.has(startKey)) {
        // Drop in above the terrain once the start pixel's collider is up.
        player.spawn(cam.pos[0], heightAt(cam.pos[0], cam.pos[2]) + 2, cam.pos[2]);
        playerSpawned = true;
      }
      if (playerSpawned) {
        const jumpHeld = keys.has('Space');
        const crouchHeld = keys.has('KeyX');   // P12 host parity (audit F4)
        const _overlayHeld = (modes?.dungeonCtx?.uiOverlayActive ?? false) || townTalk.overlayActive;   // chargen/windows/talk hold the motor - typing must not walk the player
        if (!_overlayHeld) player.update(dt, {
          forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
          strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
          run: keys.has('ShiftLeft'),
          sneak: keys.has('AltLeft'),   // P15: DFU's default Sneak binding (LeftAlt), held
          jump: jumpHeld,   // P14: HELD, verbatim (the 0.1 s grounded gate owns re-fire)
          crouch: crouchHeld && !latch.crouch,
        }, cam.yaw);
        latch.crouch = crouchHeld;
        // C9: ReadyWeapon (Z) - the sheathe toggle, host parity.
        const zNowW = keys.has('KeyZ');
        if (zNowW && !zPrevW) weaponRig.toggleSheath();
        zPrevW = zNowW;
        // P14 fall damage (host parity - CheckFallingDamage +
        // PlayerHealth verbatim; sounds 91/92). The outdoor-water
        // exemption (PlayerTileMapIndex == 0) is FLAGGED: this host
        // has no tile-under-player lookup yet, so a water landing
        // bills like ground until the tile probe ships. Death at 0
        // rides the shared entity; the exterior death screen pends
        // with the world-mode UI arc.
        if (player.landedFallDistance > FALL_DAMAGE_THRESHOLD) {
          playerEntity.health = Math.max(0, playerEntity.health - Math.trunc(FALL_HP_PER_METRE * (player.landedFallDistance - FALL_DAMAGE_THRESHOLD)));
          surfacePlayer();
          audio.playOneShot(SOUND.FallDamage);
        } else if (player.landedFallDistance > FALL_DAMAGE_THRESHOLD / 2) {
          audio.playOneShot(SOUND.FallHard);   // BadFallDetected
        }
        cam.pos = player.eye;
        const useHeld = keys.has('KeyE');
        if (useHeld && !latch.use && !modes.transitioning) {
          // T3b: a townsperson under the ray wins the activation (the
          // PlayerActivate nearest-hit order); G3: a guard corpse next
          // (loot pickup on the dungeon's S2 shape); doors otherwise.
          const useFwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
          if (!townTalk.tryActivate(cam.pos, useFwd, _livePersons)) {
            const lootKey = pickActivatable(cam.pos, useFwd, cityGuards.lootTargets(), collider);
            const dropKey = lootKey ? null : pickActivatable(cam.pos, useFwd, droppedLoot.lootTargets(), collider);
            if (lootKey) { cityGuards.takeLoot(lootKey, (l) => townTalk.say(l)); surfacePlayer(); }
            else if (dropKey && inventoryArtLoaded()) {
              // U8e: a pile under the ray opens the inventory WITH the
              // pile as the remote target (Remove defaults - the OnPush law)
              const pile = droppedLoot.pileFor(dropKey);
              townTalk.showOverlay(new NativeInventoryWindow({
                items: () => (playerEntity.items ??= []),
        entity: playerEntity,
                loot: { items: () => pile.items },
                icons: { getTexture, uploadRecord, textures: renderer.textures },
                onDrop: (items) => droppedLoot.dropPile(items, dropFeet()),
              }));
            }
            else modes.tryEnter().catch((e) => console.error(e));
          }
        }
        latch.use = useHeld;
      }
    } else {
      const speed = (keys.has('ShiftLeft') ? 400 : 40) * dt;
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;
    }

    // Streaming step: recentre, enqueue new pixels, drop far ones.
    const r = state.update(cam.pos);
    if (r.offset) {
      cam.pos[0] += r.offset[0]; cam.pos[1] += r.offset[1]; cam.pos[2] += r.offset[2];
      player.pos[0] += r.offset[0]; player.pos[1] += r.offset[1]; player.pos[2] += r.offset[2];
    }
    if (r.pixelChanged) {
      queue.push(...r.load);
      for (const u of r.unload) {
        destroyPixel(u.px, u.py);
        state.release(u.px, u.py);
      }
      console.log(`stream: entered ${r.current.x},${r.current.y} (load ${r.load.length}, unload ${r.unload.length})`);
    }
    pump();

    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.2, 6000);
    const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
    // World clock (R5): sun, ambient, window style, sky frame by time.
    const minute = minuteNow();
    // A3: the exterior ambience (WeatherAmbientEffects 5/25) - the
    // weather/time preset per WeatherManager.SetAmbientEffects.
    audio.setListener(cam.pos, fwd);
    ambience.setPreset(presetForExterior(weather, isNight(minute)));
    ambience.update(dt, { playerPos: cam.pos });
    animalAmbience.update(dt, cam.pos);   // A4: town animal barks (PlayRandomlyIfPlayerNear)
    const flash = params.has('flashtest') ? 2 : (lightning ? lightning.tick(dt) : 1);
    renderer.setLighting(
      exteriorAmbient(minute), sunScale(minute) * weatherSun * flash,
      new Float32Array(SUN_RIG_COLOR));
    // R12: the player-following indirect light rides the camera in
    // the streaming world (walk mode keeps cam at the player's eye).
    {
      const iScale = indirectLightScale(minute) * weatherSun;
      renderer.setIndirectLight(cam.pos, INDIRECT_LIGHT_RANGE, new Float32Array([
        INDIRECT_LIGHT_COLOR[0] * iScale, INDIRECT_LIGHT_COLOR[1] * iScale, INDIRECT_LIGHT_COLOR[2] * iScale,
      ]));
    }
    renderer.setWindowEmission(windowEmissionRGB(
      params.has('window') ? params.get('window')
        : (windowStyleForWeather(weather) ?? windowStyleForTime(minute))));
    const currentEntry = built.get(`${state.current.x},${state.current.y}`);
    sky.use((currentEntry ? currentEntry.skyBase : 16) + weatherSkyOffset, minute);
    // Verbatim: fog is never disabled (SetFog keeps RenderSettings.fog on);
    // Sunny/Overcast ARE linear fog to 2400 - the classic distance haze.
    renderer.setFog(weatherFog.mode,
      weatherFog.density, weatherFog.start, weatherFog.end, sky.renderer.clearColor);
    sky.renderer.fogColor = sky.renderer.clearColor;
    sky.renderer.fogMix = weatherFog.excludeSky ? 0 : 1 - fogFactor(weatherFog, 800);

    // Lanterns on 17:00-08:00, flickering verbatim; pixel-local lights
    // placed under the current compensation, nearest 16 to the camera.
    if (lightsOnAt(minute)) {
      worldLightAnimator.tick(dt);
      const sceneLights = [];
      for (const p of built.values()) {
        if (!p.lights.length) continue;
        const t = state.pixelTranslation(p.px, p.py);
        for (const l of p.lights) {
          sceneLights.push({ x: l[0] + t[0], y: l[1] + t[1], z: l[2] + t[2] });
        }
      }
      renderer.setPointLights(
        nearestLights(sceneLights, cam.pos, 16, worldLightAnimator.ranges),
        CITY_LIGHT_COLOR_F32
      );
    } else {
      renderer.setPointLights(new Float32Array(0));
    }
    renderer.beginFrame(proj, view, sunDirection(minute));
    sky.draw(cam.yaw, cam.pitch, Math.PI / 3, canvas.clientWidth / canvas.clientHeight);

    const allBatches = [];
    for (const p of built.values()) {
      const t = state.pixelTranslation(p.px, p.py);
      const pixelMatrix = trs(t[0], t[1], t[2], 0, 0, 0);
      renderer.drawTerrain(p.terrain, pixelMatrix,
        renderer.tileArrays.get(p.groundArchive), p.tilemapTex, 6.4);
      for (const m of p.models) renderer.drawMesh(m.gpu, multiply(pixelMatrix, m.local), p.texRemap);
      for (const b of p.batches) {
        b.origin = t;
        allBatches.push(b);
      }
    }
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    renderer.drawBillboards(allBatches, camRight, new Float32Array([0, 1, 0]));
    // T2 towns: every built populated pixel runs its own pool
    // (PopulationManager is per-location); the pool sees the player in
    // the pixel's LOCATION frame, and live persons draw through the
    // current translation on the flats' axis (the billboard-axis
    // doctrine). The politeness gate is the exterior host's verbatim:
    // player still + within 2.5 + weapon SHEATHED + visible + no
    // enemies (this host's exterior has none).
    syncTopics();   // T3d: the Where-is directory follows the location pixel
    _playerStill = _lastPlayerPos &&
      Math.hypot(cam.pos[0] - _lastPlayerPos[0], cam.pos[2] - _lastPlayerPos[2]) < 0.001;
    _lastPlayerPos = [cam.pos[0], cam.pos[1], cam.pos[2]];
    const isDay = !isNight(minute);
    const livePersonBatches = [];
    _livePersons = [];   // T3b: rebuilt each frame in WORLD space
    for (const p of built.values()) {
      if (!p.population) continue;
      const t = state.pixelTranslation(p.px, p.py);
      const local = [cam.pos[0] - t[0] - p.locOrigin[0], cam.pos[1] - t[1], cam.pos[2] - t[2] - p.locOrigin[2]];
      // audit 2026-08-17: the population freezes under the talk
      // overlay (DFU pauses the sim under UI windows)
      const live = p.population.update(townTalk.overlayActive ? 0 : dt, local, cam.yaw, local, isDay, (person) => {
        const pd = Math.hypot(person.pos[0] - local[0], person.pos[2] - local[2]);
        return _playerStill && pd < 2.5 && !!weaponRig.playerWeapon.sheathed && !isInvisible(playerEntity);
      });
      for (const { person, out } of live) {
        const batch = p.personBatches.get(person);
        batch.archive = person.archive;   // audit 2026-08-17: identity re-rolls per spawn - re-point the batch
        const pt = personTex.get(person.archive);
        const rkey = `${out.record}#${out.frame}`;
        if (!renderer.textures.has(`${person.archive}_${rkey}`)) uploadRecordFrame(person.archive, out.record, out.frame);
        const sz = scaledBillboardSize(pt.getSize(out.record), pt.getScale(out.record));
        batch.record = rkey;
        batch.size = { w: out.flip ? -sz.w : sz.w, h: sz.h };
        batch.origin = [
          person.pos[0] + p.locOrigin[0] + t[0],
          person.pos[1] + t[1],
          person.pos[2] + p.locOrigin[2] + t[2],
        ];
        _livePersons.push({ person, pos: batch.origin });   // T3b: world-space activation target
        livePersonBatches.push(batch);
      }
    }
    // G1: the guards drive + draw on the same flats' axis; the sim
    // freezes with the population under the talk overlay.
    livePersonBatches.push(...cityGuards.update(townTalk.overlayActive ? 0 : dt,
      walkMode && playerSpawned ? player.pos : cam.pos, cam.pos, { playerInvisible: isInvisible(playerEntity) }));
    livePersonBatches.push(...droppedLoot.batches());   // U8e: the ground piles
    if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, new Float32Array([0, 1, 0]));
    if (precip) {
      precip.draw(precipMode, proj, view, new Float32Array(cam.pos), camRight, now / 1000);
    }
    // C13: streaming-world arrows fly against the live pixel
    // collider (lost on geometry/terrain, as DFU misses are). Drawn
    // without a remap - the streaming pixels each carry their own,
    // and 99800's weapon archive needs none.
    arrows.update(dt);
    arrows.draw(renderer);
    // C9: the exterior FP weapon - swings/sounds through the rig; the
    // open world has no action objects in melee reach (static building
    // doors are the E-enter seam, not bashables - FLAGGED with the
    // towns arc), so melee strike frames resolve to nothing; bows
    // consume an Arrow + tally and the loose is VISIBLE now (C13 -
    // targets pend the RMB animal/exterior-foe arc).
    if (walkMode && playerSpawned) {
      for (const ev of weaponRig.frame(dt)) {
        if (ev !== 'hit') continue;
        if (weaponTypeForItem(weaponRig.playerWeapon.weapon) === WEAPON_TYPES.Bow) {
          if (removeOne(playerEntity.items, 131)) {
            tallySkill(playerEntity, SKILLS.Archery);
            const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
            arrows.fire(cam.pos, fwd);
          }
          continue;
        }
        // G1: melee swings resolve against live guards. G4: no guard
        // hit -> WANDERING townsfolk (civilian one-hit Murder +
        // response; wandering guard NPC -> Assault + conversion with
        // the swing carried onto the fresh foe).
        const lookFwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
        const guardHitSound = (g) => audio.play3d(hitSoundFor(weaponRig.playerWeapon.weapon), g.ai.feet, 1.1, { maxDistance: 16 });
        if (cityGuards.resolvePlayerHit(weaponRig.playerWeapon, cam.pos, lookFwd, player.pos, null, guardHitSound)) {
          tallySkill(playerEntity, WEAPON_SKILL[weaponRig.playerWeapon.weapon?.name] ?? SKILLS.HandToHand);
        } else {
          cityGuards.resolveCivilianHit(weaponRig.playerWeapon, cam.pos, lookFwd, player.pos, _guardPool(),
            { onMurder: () => _crimeResponse(), onHitSound: guardHitSound }).then((r) => {
            if (r?.carriedHit) tallySkill(playerEntity, WEAPON_SKILL[weaponRig.playerWeapon.weapon?.name] ?? SKILLS.HandToHand);
            if (r) surfacePlayer();
          }).catch((e) => console.error('[civil]', e));
        }
      }
      weaponRig.draw();
    }
    townTalk.frame(dt);   // T3b: HUD lines + the talk overlay, above everything

    if (shotMode) {
      window.__frame++;
      if (queue.length === 0 && !building && !window.__shotReady) {
        window.__shotReady = true;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
