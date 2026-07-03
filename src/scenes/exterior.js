// Exterior location scene: a full location assembled on the block grid.
// World-Arc milestone 2: assemble and render a full exterior location from
// original data. Default scene is Daggerfall city (8x8 blocks, 316 buildings),
// selectable with ?region=<name>&loc=<name>. Ground archive comes from the
// location's climate (CLIMATE.PAK -> GetWorldClimateSettings).

import { Arch3dFile } from '../formats/arch3dFile.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile } from '../formats/mapsFile.js';
import { convertTilemap } from '../world/terrainSurface.js';
import { GROUND_OFFSET, GROUND_TILE_DIM } from '../world/rmbLayout.js';
import { PlayerMotor } from '../player/motor.js';
import { Collider } from '../player/collider.js';
import { getStaticDoors } from '../world/staticDoors.js';
import { createDataPipeline } from './dataPipeline.js';
import { createWorldModes } from './worldModes.js';
import { windowEmissionRGB } from '../render/windowEmission.js';
import { CITY_LIGHT_COLOR, CITY_LIGHT_RANGE, LIGHTS_ARCHIVE, collectCityLights, nearestLights } from '../world/cityLights.js';
import { applyClimate, getGroundArchive, getNatureArchive } from '../world/climateSwaps.js';
import { RMB_SIDE, layoutLocation } from '../world/locationLayout.js';
import { lookAt, multiply, perspective, trs } from '../world/mat4.js';
import { collectBlockFlats, scaledBillboardSize } from '../world/rmbFlats.js';
import { CityLightAnimator, SUN_RIG_COLOR, exteriorAmbient, isCityLightsOn, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { fetchBytes, parseSeason, createSkyController } from './shared.js';
import {
  WEATHER_TYPES, fogForWeather, skyOffsetForWeather, weatherSunlightScale,
  windowStyleForWeather, weatherRng, fogFactor, precipitationForWeather,
  LightningPlayer,
} from '../world/weather.js';
import { PrecipitationRenderer } from '../render/precipitation.js';
import { SEASON } from '../world/climateSwaps.js';

export async function bootExterior(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';

  status('loading data');
  const [palBytes, blocksBytes, archBytes, mapsBytes, climateBytes, politicBytes] =
    await Promise.all([
      fetchBytes('ART_PAL.COL'),
      fetchBytes('BLOCKS.BSA'),
      fetchBytes('ARCH3D.BSA'),
      fetchBytes('MAPS.BSA'),
      fetchBytes('CLIMATE.PAK'),
      fetchBytes('POLITIC.PAK'),
    ]);

  const palette = new DFPalette();
  palette.load(palBytes, 'ART_PAL.COL');
  const blocks = new BlocksFile();
  blocks.load(blocksBytes);
  const arch = new Arch3dFile();
  arch.load(archBytes);
  const maps = new MapsFile();
  maps.load(mapsBytes, climateBytes, politicBytes);

  // Assemble the location.
  const dfLocation = maps.getLocationByName(regionName, locationName);
  if (!dfLocation) throw new Error(`location not found: ${regionName}/${locationName}`);
  status(`laying out ${locationName}`);
  const loc = layoutLocation(dfLocation, maps, blocks);

  // Climate + season: swap every submesh archive exactly as DFU's
  // MaterialReader.ChangeClimate does - pixels from the swapped archive,
  // UVs from the original (the SetDungeonTextures pattern).
  const season = parseSeason(params);
  const climateBase = dfLocation.climate.climateType;
  const groundArchive = getGroundArchive(climateBase, season);
  const natureArchive = getNatureArchive(dfLocation.climate.natureArchive, season);
  const texRemap = new Map();

  // Shared lazy pipeline (P7): the same caches the world scene uses,
  // PREWARMED for the location below so boot behavior is unchanged -
  // and able to lazy-load the models/archives interiors and dungeons
  // reference beyond the location's own set.
  const pipeline = createDataPipeline({ renderer, arch, palette });
  const { textureFiles, getTexture, uploadRecord, getGpuMesh, gpuMeshes, cpuModels } = pipeline;

  // Collect the location's model ids + referenced texture archives.
  const modelIds = new Set();
  const archives = new Set([groundArchive, LIGHTS_ARCHIVE]);
  for (const b of loc.blocks) {
    for (const placed of b.layout.models) modelIds.add(placed.modelIdNum);
  }
  status(`loading ${modelIds.size} models`);
  await Promise.all([...modelIds].map((id) => getGpuMesh(id)));
  // Climate swap table over every submesh, exactly as the world's
  // per-pixel pass: pixels from the swapped archive, UVs from the
  // original (verbatim MaterialReader.ChangeClimate; missing-record
  // remaps pruned - 27 corpus pairs, R1 audit).
  for (const id of modelIds) {
    const gpu = gpuMeshes.get(id);
    if (!gpu) continue;
    for (const sm of gpu.subMeshes) {
      archives.add(sm.textureArchive);
      const swapped = applyClimate(sm.textureArchive, sm.textureRecord, climateBase, season);
      if (swapped === sm.textureArchive) continue;
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      if (texRemap.has(key)) continue;
      const t = await getTexture(swapped);
      if (sm.textureRecord >= t.recordCount) continue;
      uploadRecord(swapped, sm.textureRecord);
      texRemap.set(key, `${swapped}_${sm.textureRecord}`);
    }
  }
  status(`loading ${archives.size} texture archives`);
  await Promise.all([...archives].map((a) => getTexture(a)));

  // Per-block scene list: world matrices with the block origin folded in,
  // plus one ground mesh per block, plus flats grouped into billboard batches.
  const sky = createSkyController(renderer.gl, params);
  // R9 ground: one tilemap for the whole location grid (16 tiles per
  // block side, square texture over max(w, h) blocks; the flat surface
  // only spans the real extent so padding is never sampled).
  const tilemapDim = GROUND_TILE_DIM * Math.max(loc.width, loc.height);
  const locationTilemap = new Uint8Array(tilemapDim * tilemapDim);
  const cityLights = []; // archive-210 lantern point lights (R3)
  const CITY_LIGHT_COLOR_F32 = new Float32Array(CITY_LIGHT_COLOR);
  // World clock (R5): ?tod=HH:MM (default noon), ?timescale=game-min/sec.
  // Weather (R12): ?weather=sunny|cloudy|overcast|fog|rain|thunder|snow,
  // ?wseed for the deterministic Rain1/Rain2 (Snow1/Snow2) sky pick.
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
  const lightSize = (record) => {
    const t = textureFiles.get(LIGHTS_ARCHIVE);
    return scaledBillboardSize(t.getSize(record), t.getScale(record));
  };
  const drawList = [];
  // Player collision (P1): every placed model's triangles, world-space,
  // over the flat ground floor.
  const collider = new Collider(() => GROUND_OFFSET * 0.025);
  let colliderTris = 0;
  const buildingDoors = []; // {door, dfBlock, recordIndex, climateBase, season, dfLocation, group}
  const flatGroups = new Map(); // "archive_record" -> [centers]
  for (const b of loc.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const mesh = gpuMeshes.get(placed.modelIdNum);
      if (!mesh) continue;
      const matrix = multiply(originMatrix, placed.matrix);
      drawList.push({ mesh, matrix });
      const cpu = cpuModels.get(placed.modelIdNum);
      collider.addMesh('world', cpu.positions, cpu.indices, matrix);
      colliderTris += cpu.indices.length / 3;
      // Building models expose their static doors for E-transitions
      // (P7: the world's registry shape; matrices are already
      // world-space, so entries feed the machine unshifted).
      if (cpu.doors && cpu.doors.length) {
        for (const door of getStaticDoors(cpu, 0, placed.recordIndex, matrix)) {
          buildingDoors.push({
            door, dfBlock: b.dfBlock, recordIndex: placed.recordIndex,
            climateBase, season, dfLocation, group: 'loc',
          });
        }
      }
    }
    // Ground tiles gather into one location-wide tilemap for the R9
    // tilemap-shader pass (raw RMB bytes; random markers >= 56 reset to
    // grass 8 exactly as buildGroundTilemap, zeros as the 0xFF sentinel).
    const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
    for (let ty = 0; ty < GROUND_TILE_DIM; ty++) {
      for (let tx = 0; tx < GROUND_TILE_DIM; tx++) {
        const tile = srcTiles[tx][GROUND_TILE_DIM - 1 - ty];
        const raw = tile.textureRecord >= 56
          ? 8
          : (tile.tileBitfield === 0 ? 0xff : tile.tileBitfield);
        locationTilemap[(b.x * GROUND_TILE_DIM + tx) +
          (b.y * GROUND_TILE_DIM + ty) * tilemapDim] = raw;
      }
    }

    for (const flat of collectBlockFlats(b.dfBlock, natureArchive)) {
      const key = `${flat.archive}_${flat.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([flat.x + b.originX, flat.y, flat.z + b.originZ]);
    }
    for (const light of collectCityLights(b.dfBlock, lightSize)) {
      cityLights.push({ x: light.x + b.originX, y: light.y, z: light.z + b.originZ });
    }
  }

  // R9 ground GL: cached tile array per archive, the location tilemap,
  // and a flat 2x2 surface at GroundOffset spanning the exact extent
  // (winding matches buildTerrainIndices' quad diagonal).
  if (!renderer.tileArrays.has(groundArchive)) {
    const groundTex = textureFiles.get(groundArchive);
    const layers = [];
    for (let r = 0; r < groundTex.recordCount; r++) {
      layers.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
    }
    renderer.uploadTileArray(groundArchive, layers);
  }
  const tilemapTex = renderer.uploadTilemapTexture(convertTilemap(locationTilemap), tilemapDim);
  const groundSurface = (() => {
    const gy = GROUND_OFFSET * 0.025;
    const gw = loc.width * RMB_SIDE;
    const gh = loc.height * RMB_SIDE;
    const positions = new Float32Array([0, gy, 0, gw, gy, 0, 0, gy, gh, gw, gy, gh]);
    const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 2, 3, 0, 3, 1]);
    return renderer.createTerrainSurface(positions, normals, indices);
  })();
  const identityMatrix = trs(0, 0, 0, 0, 0, 0);

  // Load any flat archives not already fetched, then build one batch per
  // (archive, record) with its scaled billboard size.
  status('loading flat archives');
  const flatArchives = new Set(
    [...flatGroups.keys()].map((k) => Number(k.split('_')[0]))
  );
  await Promise.all([...flatArchives].map((a) => getTexture(a)));
  const billboardBatches = [];
  let flatCount = 0;
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, centers));
    flatCount += centers.length;
  }

  // Camera.
  const shotMode = params.has('shot');
  // P1: grounded first-person is the default; ?fly restores the fly cam.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(collider);
  player.spawn(loc.width * RMB_SIDE * 0.46, GROUND_OFFSET * 0.025 + 2, loc.height * RMB_SIDE * 0.5);
  // Edge-detect latch shared with the mode machine: a held key must not
  // re-trigger across a mode switch.
  const latch = { jump: false, use: false };
  console.log(`player: collider ${colliderTris} tris, walk=${walkMode}`);
  if (shotMode) {
    window.__player = {
      get pos() { return [...player.pos]; },
      warp: (x, y, z) => player.spawn(x, y, z),
    };
  }
  const extentX = loc.width * RMB_SIDE;
  const extentZ = loc.height * RMB_SIDE;
  const center = [extentX / 2, 4, extentZ / 2];
  const cam = {
    pos: [center[0], 14, extentZ + 40],
    yaw: Math.PI,
    pitch: -0.08,
  };
  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => canvas.requestPointerLock());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    cam.yaw -= e.movementX * 0.0025;
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0025));
  });

  // P7: the exterior scene hosts the same mode machine as ?world -
  // E on a building door enters its interior, E on a DUNGEON_ENTRANCE
  // door drops into the location's crawl, exits land verbatim.
  const modes = createWorldModes({
    canvas, renderer, player, cam, keys, latch, blocks,
    pipeline: { getGpuMesh, cpuModels, getTexture, uploadRecord, arch },
    doorTargets: () => buildingDoors,
    baseCollider: () => collider,
  });
  if (shotMode) {
    window.__pose = (x, y, z, yaw, pitch) => { cam.pos = [x, y, z]; cam.yaw = yaw; cam.pitch = pitch; };
    modes.installShotProbes();
  }

  const lightAnimator = new CityLightAnimator(cityLights.length, CITY_LIGHT_RANGE);
  const nightAmbientFloor = new Float32Array([0.25, 0.25, 0.25]);

  status(`${locationName} - ${loc.blocks.length} blocks, ${drawList.length} draws`);
  console.log(
    `scene: ${loc.blocks.length} blocks, ${drawList.length} placements, ` +
    `${gpuMeshes.size} meshes, ${renderer.textures.size} textures, ${flatCount} flats in ${billboardBatches.length} batches, ${cityLights.length} lights, ` +
    `ground ${groundArchive}, climate ${climateBase}, season ${season}, ${texRemap.size} swaps, ${renderer.emissionTextures.size} window masks`
  );

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // Modal frame (worldModes.js): interior/dungeon consume the frame
    // entirely - none of the exterior sky/weather/light path runs.
    if (modes.frame(dt, now)) {
      requestAnimationFrame(frame);
      return;
    }
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    if (walkMode) {
      // Grounded movement: verbatim speeds in the motor, Space edge-jumps.
      const jumpHeld = keys.has('Space');
      player.update(dt, {
        forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
        strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        run: keys.has('ShiftLeft'),
        jump: jumpHeld && !latch.jump,
      }, cam.yaw);
      latch.jump = jumpHeld;
      cam.pos = player.eye;
      const useHeld = keys.has('KeyE');
      if (useHeld && !latch.use && !modes.transitioning) {
        modes.tryEnter().catch((e) => console.error(e));
      }
      latch.use = useHeld;
    } else {
      const speed = (keys.has('ShiftLeft') ? 120 : 30) * dt;
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;
    }

    // Shot vantage scales with the location extent.
    const target = shotMode && !walkMode
      ? [extentX * 0.46, 6, extentZ * 0.5]
      : [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const eye = shotMode && !walkMode
      ? [extentX * 0.565, 11, extentZ * 0.72]
      : cam.pos;
    const proj = perspective(
      Math.PI / 3,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      Math.max(2000, extentX * 4)
    );
    const view = lookAt(eye, target, [0, 1, 0]);

    // World clock (R5): sun direction/intensity and ambient follow the time
    // of day; the sun is off at night leaving the 0.25 ambient floor.
    const minute = minuteNow();
    // Storm lightning: verbatim frame-strobe multiplier on the sun (2x
    // during a flash frame); ?flashtest pins it on for shots.
    const flash = params.has('flashtest') ? 2 : (lightning ? lightning.tick(dt) : 1);
    renderer.setLighting(
      exteriorAmbient(minute), sunScale(minute) * weatherSun * flash,
      new Float32Array(SUN_RIG_COLOR));
    renderer.setWindowEmission(windowEmissionRGB(
      params.has('window') ? params.get('window')
        : (windowStyleForWeather(weather) ?? windowStyleForTime(minute))));
    sky.use(dfLocation.climate.skyBase + weatherSkyOffset, minute);
    // Weather fog, colored by the live sky horizon fill (fills DFU's
    // fogColor TODO); heavy fog also swallows the sky.
    // Verbatim: fog is never disabled (SetFog keeps RenderSettings.fog on);
    // Sunny/Overcast ARE linear fog to 2400 - the classic distance haze.
    renderer.setFog(weatherFog.mode,
      weatherFog.density, weatherFog.start, weatherFog.end, sky.renderer.clearColor);
    sky.renderer.fogColor = sky.renderer.clearColor;
    sky.renderer.fogMix = weatherFog.excludeSky ? 0 : 1 - fogFactor(weatherFog, 800);

    // City lanterns: on 17:00-08:00 (IsCityLightsOn), each flickering
    // verbatim DaggerfallLight (14 ticks/s toward random range targets).
    const lightsOn = lightsOnAt(minute);
    if (lightsOn) lightAnimator.tick(dt);
    renderer.setPointLights(
      lightsOn
        ? nearestLights(cityLights, eye, 16, lightAnimator.ranges)
        : new Float32Array(0),
      CITY_LIGHT_COLOR_F32
    );
    renderer.beginFrame(proj, view, sunDirection(minute));
    {
      const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
      const horiz = Math.hypot(dx, dz) || 1e-6;
      sky.draw(Math.atan2(dx, dz), Math.atan2(dy, horiz), Math.PI / 3,
        canvas.clientWidth / canvas.clientHeight);
    }
    renderer.drawTerrain(groundSurface, identityMatrix,
      renderer.tileArrays.get(groundArchive), tilemapTex, 6.4);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix, texRemap);
    // Classic Daggerfall billboards rotate about Y only: right from the view,
    // up stays world-Y.
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    if (shotMode) {
      const dx = target[0] - eye[0];
      const dz = target[2] - eye[2];
      const l = Math.hypot(dx, dz) || 1;
      camRight[0] = -dz / l;
      camRight[2] = dx / l;
    }
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));
    if (precip) {
      precip.draw(precipMode, proj, view, new Float32Array(eye), camRight, now / 1000);
    }

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
