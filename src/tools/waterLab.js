// THE WATER LAB (WATER1). The enhanced water pass over a synthetic
// terrain pixel - an island in the sea, an inland lake below sea level,
// a river marched through the marching squares - drawn with the game's
// own terrain and water programs under the enhanced dome, with the hour,
// the weather, the wind, the rain and the view on sliders. No game data:
// the tile array is sixty-four flat colours. `?hour=&weather=&wind=&rain=
// &yaw=&pitch=&height=&still&t=&water=off&nopanel` pin any of it for the
// probe (tools/waterProbe.mjs).
import { Renderer } from '../render/renderer.js';
import { EnhancedSkyRenderer, skyState, sunSkyDirection } from '../render/enhancedSky.js';
import { waterUniforms, buildWaterIndices } from '../render/waterSurface.js';
import { WATER_MASK_TABLE } from '../world/waterCorners.js';
import { buildTerrainGrid, buildTerrainIndices, convertTilemap, TERRAIN_TILE_DIM } from '../world/terrainSurface.js';
import { generateTileData, assignTiles } from '../world/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, TERRAIN_SIZE } from '../world/terrainSampler.js';
import { WIND_ROW_CALM, WIND_ROW_SPAN } from '../systems/wind.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
for (const id of ['hour', 'weather', 'wind', 'rain', 'yaw', 'pitch', 'height']) if (params.has(id)) $(id).value = params.get(id);
if (params.get('water') === 'off') $('water').checked = false;
if (params.has('nopanel')) $('panel').style.display = 'none';
const still = params.has('still');
const pinnedT = params.has('t') ? Number(params.get('t')) : null;

canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });   // the probe reads pixels after the frame; the renderer's own getContext returns this one
const renderer = new Renderer(canvas);
const gl = renderer.gl;
const sky = new EnhancedSkyRenderer(gl);

// ---- the pixel: an island, a lake, a river ------------------------------
const hDim = HEIGHTMAP_DIMENSION;
const seaNorm = SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT;   // terrainSampler's clamp, normalised
const heightmap = new Float32Array(hDim * hDim);
for (let x = 0; x < hDim; x++) {
  for (let z = 0; z < hDim; z++) {
    const u = x / (hDim - 1) - 0.5, v = z / (hDim - 1) - 0.5;
    const r = Math.hypot(u, v * 1.3);
    const land = Math.max(0, 1 - r / 0.36) ** 1.4;                 // the island's dome, 0 at sea
    let h = seaNorm + land * (0.045 + 0.004 * Math.sin(x * 0.37) * Math.cos(z * 0.29));   // a little relief on the land only: the sea is EXACTLY sea level, as terrainSampler's clamp leaves it
    const lake = Math.hypot(u + 0.12, v - 0.08);
    if (lake < 0.07) h -= 0.05 * (1 - lake / 0.07);                 // the lake's basin, below sea level over most of it
    if (h < seaNorm) h = seaNorm;                                    // terrainSampler.js: the sea is flat
    heightmap[x * hDim + z] = h;
  }
}
const tileData = generateTileData(heightmap, 40, 40, hDim);
// the river: a corner-grid path from the lake to the east shore, two
// corners wide, so assignTiles marches real shore tiles along it
for (let x = 64; x < hDim; x++) {
  const zc = Math.round(64 + 10 * Math.sin((x - 64) * 0.11)) + Math.round((x - 64) * 0.15);
  for (let z = zc; z <= zc + 1; z++) if (z >= 0 && z < hDim) tileData[x + z * hDim] = 0;
}
const tilemap = new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM);
assignTiles(tileData, tilemap, true);
const tilemapBytes = convertTilemap(tilemap);
const tilemapTex = renderer.uploadTilemapTexture(tilemapBytes, TERRAIN_TILE_DIM);
const grid = buildTerrainGrid(heightmap, 1);
const terrain = renderer.createTerrainSurface(grid.positions, grid.normals, buildTerrainIndices(1));
// sixty-four flat tiles: water, dirt, grass, stone, and every shore
// record a mix of the two it joins, so a shape reads even without the art
const layers = [];
const base = [[38, 82, 128], [150, 122, 84], [78, 118, 52], [118, 118, 112]];
const mixOf = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
for (let r = 0; r < 64; r++) {
  let c = base[r] ?? [90, 90, 90];
  const mask = WATER_MASK_TABLE[r << 2];
  if (r >= 5 && r <= 7) c = mixOf(base[0], base[1], 0.5);
  if (r >= 20 && r <= 22) c = mixOf(base[0], base[2], 0.5);
  if (r >= 30 && r <= 32) c = mixOf(base[0], base[3], 0.5);
  if (r >= 10 && r <= 12) c = mixOf(base[1], base[2], 0.5);
  if (r >= 15 && r <= 17) c = mixOf(base[2], base[3], 0.5);
  if (r === 48) c = mixOf(base[0], base[1], 0.5);
  if (r === 51) c = mixOf(base[1], base[2], 0.5);
  if (r === 53) c = mixOf(base[2], base[3], 0.5);
  void mask;
  const colors = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    // a faint checker so the classic texel's scroll is visible on the water
    const n = ((i & 7) ^ ((i >> 6) & 7)) & 1 ? 6 : -6;
    colors[i * 4] = c[0] + n; colors[i * 4 + 1] = c[1] + n; colors[i * 4 + 2] = c[2] + n; colors[i * 4 + 3] = 255;
  }
  layers.push({ width: 64, height: 64, colors });
}
const ARCHIVE = 302;
renderer.uploadTileArray(ARCHIVE, layers);
// WATER-AUDIT: the water's own quads over the terrain's vertices, as the hosts draw it
const waterIndices = buildWaterIndices(tilemapBytes, 1);
const water = waterIndices ? renderer.createWaterSurface(terrain, waterIndices) : null;
const hasWater = !!water;

const t0 = performance.now();
const TILE_MATRICES = [];
for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const m = identity(); m[12] = dx * TERRAIN_SIZE; m[14] = dz * TERRAIN_SIZE; TILE_MATRICES.push(m); }
function frame() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const hour = Number($('hour').value);
  const minuteOfDay = Math.round((hour % 24) * 60);
  const seconds = pinnedT ?? (still ? 0 : (performance.now() - t0) / 1000);
  const weather = $('weather').value;
  const state = skyState({ minuteOfDay, weather, seconds, drift: [0, 0] });
  sky.setState(state);
  sky.fogMix = 0;
  sky.fogColor = sky.clearColor;

  // the camera: on the island's south shore, looking where the sliders say
  const yaw = Number($('yaw').value) * Math.PI / 180, pitch = Number($('pitch').value) * Math.PI / 180;
  const seaY = seaNorm * MAX_TERRAIN_HEIGHT * 1.5;
  const eye = [TERRAIN_SIZE * 0.5, seaY + Number($('height').value), TERRAIN_SIZE * 0.5 + Number(params.get('z') ?? -330)];   // off the south shore by default, the sea between here and the beach; ?z= moves the eye along the axis
  const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const view = lookAt(eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], [0, 1, 0]);
  const proj = mirrorProjectionX(perspective(65 * Math.PI / 180, w / h, 0.5, 4000));   // HANDEDNESS (mat4's law): the renderer's front face is CW under the mirrored projection every host draws with - unmirrored, every ground face is culled

  // the world's light off the dome's own sun, the way the hosts feed it
  const sunDir = sunSkyDirection(minuteOfDay);
  const day = Math.max(0, Math.min(1, (sunDir[1] + 0.05) / 0.35));
  const lightDir = new Float32Array([sunDir[0], Math.max(0.05, sunDir[1]), sunDir[2]]);
  renderer.setLighting(new Float32Array([0.28 + 0.22 * day, 0.28 + 0.22 * day, 0.30 + 0.24 * day]), 0.9 * day, new Float32Array(state.sun));
  renderer.setLightDir(lightDir);
  renderer.setFog('exp2', 0.0009, 0, 0, sky.clearColor);
  renderer.setClearColor([0, 0, 0, 1]);
  renderer.beginFrame(proj, view, lightDir);
  if (!params.has('nosky')) { sky.draw(yaw, pitch, 65 * Math.PI / 180, w / h); renderer.markForeignPass(); }   // ?nosky: the ground alone, for a diagnosis
  renderer.setCloudShadow(sky.cloudShadow ?? null);
  // the pixel and its eight neighbours (the same island, tiled), so the
  // sea reaches the horizon as it does in the streaming world
  for (const m of TILE_MATRICES) renderer.drawTerrain(terrain, m, renderer.tileArrays.get(ARCHIVE), tilemapTex, 6.4);
  if ($('water').checked && hasWater) {
    const s = WIND_ROW_CALM + Number($('wind').value) * WIND_ROW_SPAN;   // the row's own scale
    const wu = waterUniforms({
      seconds,
      wind: [s * 0.8, s * 0.6],
      rain: Number($('rain').value),
      sky: { zenith: state.zenith, horizon: state.horizon },
    });
    for (const m of TILE_MATRICES) renderer.drawWaterSurface(water, m, renderer.tileArrays.get(ARCHIVE), tilemapTex, 6.4, wu);
  }
  for (const id of ['hour', 'wind', 'rain', 'yaw', 'pitch', 'height']) $(id + 'V').textContent = $(id).value;
  window.__waterReady = true;
  window.__lab = { renderer, hasWater, draws: renderer.stats.draws, waterOn: $('water').checked && hasWater };   // the probe's window into the frame
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
