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
import { StreamingWorldState } from '../world/streamingWorld.js';
import { layoutNature } from '../world/terrainNature.js';
import { DEFAULT_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, TERRAIN_SIZE, generateSamples } from '../world/terrainSampler.js';
import { assignTiles, blendLocationTerrain, calcAvgMaxHeight, generateTileData, getLocationTerrainTileOrigin, setLocationTiles } from '../world/terrainTiles.js';
import { CityLightAnimator, SUN_RIG_COLOR, INDIRECT_LIGHT_COLOR, INDIRECT_LIGHT_RANGE, exteriorAmbient, indirectLightScale, isCityLightsOn, isNight, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { audio } from '../systems/audio.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../systems/ambientEffects.js';
import { fetchBytes, parseSeason, createSkyController } from './shared.js';
import { PlayerMotor } from '../player/motor.js';
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
  const { getTexture, uploadRecord, getGpuMesh, cpuModels } = pipeline;

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
    if (dfLocation) {
      const loc = layoutLocation(dfLocation, maps, blocks);
      const tilePos = getLocationTerrainTileOrigin(dfLocation);
      const locLocal = [tilePos.x * tileSide, avg * worldHeight + 2.0 * 0.025, tilePos.y * tileSide];
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
        }
        for (const light of collectCityLights(b.dfBlock, lightSize)) {
          pixelLights.push([
            locLocal[0] + b.originX + light.x,
            locLocal[1] + light.y,
            locLocal[2] + b.originZ + light.z,
          ]);
        }
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
      px, py, terrain, tilemapTex, groundArchive, models, batches, texRemap, lights: pixelLights, skyBase: climate.skyBase, samples, natureCount: nature.length,

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
    collider.removeBucket(key);
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
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const startKey = `${startPixel.x},${startPixel.y}`;
  const player = new PlayerMotor(collider);
  let playerSpawned = false;
  // Edge-detect latch shared with the mode machine: a held key must not
  // re-trigger across a mode switch.
  const latch = { jump: false, use: false };
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
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => requestLook(canvas));
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    cam.yaw -= e.movementX * 0.0025;
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0025));
  });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      cam.yaw -= dx * 0.0025;
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - dy * 0.0025));
    },
  });

  const shotMode = params.has('shot');
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
    window.__pose = (x, y, z, yaw, pitch) => { cam.pos = [x, y, z]; cam.yaw = yaw; cam.pitch = pitch; };
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
  const modes = createWorldModes({
    canvas, renderer, player, cam, keys, latch, blocks,
    voxelfolk: params.has('voxelfolk'),
    foes: params.has('foes'),
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
  });
  if (shotMode) modes.installShotProbes();

  const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS);   // A3
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
        const _overlayHeld = modes?.dungeonCtx?.uiOverlayActive ?? false;   // chargen/windows hold the motor - typing must not walk the player
        if (!_overlayHeld) player.update(dt, {
          forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
          strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
          run: keys.has('ShiftLeft'),
          jump: jumpHeld && !latch.jump,
          crouch: crouchHeld && !latch.crouch,
        }, cam.yaw);
        latch.jump = jumpHeld;
        latch.crouch = crouchHeld;
        cam.pos = player.eye;
        const useHeld = keys.has('KeyE');
        if (useHeld && !latch.use && !modes.transitioning) {
          modes.tryEnter().catch((e) => console.error(e));
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
    if (precip) {
      precip.draw(precipMode, proj, view, new Float32Array(cam.pos), camRight, now / 1000);
    }

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
