// @ts-check
// Skyrim flora playground: one full Lands pixel (dressed ground + nature + landmarks) for artists.
// Not on the play path. ARENA2 required. HUD: biome, catalog sprite, PNG upload overlay.
import { ensureArena2, getBytes } from '../scenes/dataSource.js';
import { fetchBytes } from '../scenes/shared.js';
import { createDataPipeline } from '../scenes/dataPipeline.js';
import { createGroundSets } from '../scenes/groundSets.js';
import { createLandPropsHost, LAND_PROPS_SLOT } from '../scenes/landPropsHost.js';
import { Renderer } from '../render/renderer.js';
import { EnhancedSkyRenderer, skyState, sunSkyDirection } from '../render/enhancedSky.js';
import { DFPalette } from '../formats/dfPalette.js';
import { Arch3dFile } from '../formats/arch3dFile.js';
import { WoodsFile } from '../formats/woodsFile.js';
import { getWorldClimateSettings } from '../formats/mapsFile.js';
import { generatePixelTerrain } from '../world/terrain/terrainGen.js';
import { groundWoods } from '../world/tamriel/tamrielGround.js';
import { LANDS, landGroundSet, landKeyAt, landsNine } from '../world/tamriel/tamrielLands.js';
import { tamrielBiomeAt, BIOME_BY_KEY } from '../world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay, inBay } from '../world/tamriel/tamrielFrame.js';
import { getTerrainGroundArchive, SEASON, getNatureArchive } from '../world/climateSwaps.js';
import { buildTerrainIndices, convertTilemap } from '../world/terrain/terrainSurface.js';
import { TERRAIN_SIZE, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../world/terrain/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrain/terrainTiles.js';
import { billboardSize } from '../world/rmbFlats.js';
import { MeshBuilder } from '../world/detStandIns.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';
import {
  SKYRIM_FLORA, SKYRIM_FLORA_ARCHIVE, SKYRIM_FLORA_CARDS, SKYRIM_HANGING_RECORDS, isSkyrimHangingRecord,
} from '../world/tamriel/skyrimFlora.js';
import { crossedPlantAt, hangingMossAt, standSkyrimFlora, isSkyrimMossRock } from '../world/tamriel/skyrimFloraMesh.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { isTreeRecord } from '../world/terrain/terrainNature.js';
import { standLandProps, landFeetOff, LAND_PROP_FLOATS } from '../world/lands/landProps.js';
import { LabGrassRenderer, createGrassField, LAB_GRASS } from '../render/labGrass.js';
import '../world/tamriel/skyrimFloraArt.js'; // register stand-ins

const PREVIEW_ARCHIVE = 38399; // lab-only overlay (not game)
const TEX_PREVIEW = /** @type {const} */ ([PREVIEW_ARCHIVE, 0]);
const PIXEL_T = /** @type {[number, number, number]} */ ([0, 0, 0]);

export const BIOMES = Object.freeze(Object.keys(LANDS).filter((k) => /** @type {any} */ (LANDS)[k].ground));
export { SKYRIM_FLORA };

/** Mid grass colour of a Lands zone (hex ramp → rgb 0..1). */
export function biomeGroundRgb(key) {
  const g = /** @type {any} */ (LANDS)[key]?.ground?.grass ?? /** @type {any} */ (LANDS)[key]?.ground?.dirt;
  const hex = g?.ramp?.[2] ?? g?.ramp?.[1] ?? '#5a5a40';
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * First frame pixel whose 3×3 is zone `key` whole (tesalands_flora.test.js pixelOf).
 * @param {string} key
 * @returns {[number, number]|null}
 */
export function pixelOfBiome(key) {
  const f = tamrielFrameInBay();
  for (let y = Math.ceil(f.y0) + 2; y < f.y0 + f.h - 2; y += 3) {
    for (let x = Math.ceil(f.x0) + 2; x < f.x0 + f.w - 2; x += 3) {
      if (tamrielBiomeAt(x, y)?.key !== key) continue;
      let whole = true;
      for (let j = -1; j <= 1 && whole; j++)
        for (let i = -1; i <= 1; i++)
          if (tamrielBiomeAt(x + i, y + j)?.key !== key) { whole = false; break; }
      if (whole) return [x, y];
    }
  }
  if (BIOME_BY_KEY.get(key)?.seeds?.length) {
    for (let y = Math.ceil(f.y0) + 1; y < f.y0 + f.h - 1; y += 7) {
      for (let x = Math.ceil(f.x0) + 1; x < f.x0 + f.w - 1; x += 7) {
        if (landKeyAt(x, y) === key) return [x, y];
      }
    }
  }
  return null;
}

/**
 * @param {number} wPx @param {number} hPx
 * @param {boolean} hang
 * @param {number} [count=1]
 */
export function buildPreviewMesh(wPx, hPx, hang, count = 1) {
  const mb = new MeshBuilder();
  const w = Math.max(0.2, wPx * GLOBAL_SCALE), h = Math.max(0.3, hPx * GLOBAL_SCALE);
  if (hang) {
    hangingMossAt(mb, TEX_PREVIEW, 0, 1.5, 0, w, Math.min(h, 1.4), 0.4);
    return mb.build();
  }
  for (let i = 0; i < count; i++) {
    const ang = (i / Math.max(1, count)) * Math.PI * 2, r = i === 0 ? 0 : 1.1;
    crossedPlantAt(mb, TEX_PREVIEW, Math.cos(ang) * r, 0, Math.sin(ang) * r, w, h, ang * 0.37);
  }
  return mb.build();
}

function catalogUrl(entry) {
  return new URL(`../assets/skyrim/flora/${entry.zone}/${entry.file}`, import.meta.url).href;
}

async function loadImage(url) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

function cutoutCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] >= 128 ? 255 : 0;
  ctx.putImageData(id, 0, 0);
  return c;
}

function canvasToColor32(c) {
  const ctx = c.getContext('2d');
  const { width, height } = c;
  const top = ctx.getImageData(0, 0, width, height).data;
  const colors = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    colors.set(top.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  }
  return { width, height, colors };
}

async function boot() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
  const status = document.getElementById('status');
  const biomeEl = /** @type {HTMLSelectElement} */ (document.getElementById('biome'));
  const spriteEl = /** @type {HTMLSelectElement} */ (document.getElementById('sprite'));
  const fileEl = /** @type {HTMLInputElement} */ (document.getElementById('file'));
  const thumb = /** @type {HTMLImageElement} */ (document.getElementById('thumb'));
  status.textContent = 'Loading ARENA2…';
  await ensureArena2();

  canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  const renderer = new Renderer(canvas);
  const sky = new EnhancedSkyRenderer(renderer.gl);

  const palette = new DFPalette();
  palette.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const arch = new Arch3dFile();
  const pipeline = createDataPipeline({ renderer, arch, palette, fetch: fetchBytes });
  const { getTexture, uploadRecord } = pipeline;

  const wf = new WoodsFile();
  if (!wf.load(await getBytes('WOODS.WLD'))) throw new Error('WOODS.WLD failed');
  const woods = groundWoods(wf);

  const grassRecords = new Map(), floorRecords = new Map(), groundPuddles = new Map();
  const groundMeanColour = new Map(), groundDrawnMeans = new Map();
  const breathe = async () => {};
  const groundSets = createGroundSets({
    renderer, getTexture, labGrass: null, breathe,
    grassRecords, floorRecords, groundPuddles, groundMeanColour, groundDrawnMeans,
  });
  const hold = { tileArray() {}, release() {}, settle() {} };
  const landHost = createLandPropsHost({ renderer, breathe });
  const labGrass = new LabGrassRenderer(renderer.gl);

  for (const k of BIOMES) {
    const o = document.createElement('option');
    o.value = k; o.textContent = k;
    biomeEl.appendChild(o);
  }
  biomeEl.value = BIOMES.includes('skyrimPinewood') ? 'skyrimPinewood' : BIOMES[0];
  for (let i = 0; i < SKYRIM_FLORA.length; i++) {
    const e = SKYRIM_FLORA[i];
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${e.zone}/${e.name}${e.hang ? ' (hang)' : ''}`;
    spriteEl.appendChild(o);
  }

  /** @type {any} */
  let terrain = null, tilemapTex = null, groundKey = null, batches = [], skyrimMeshes = [], previewMesh = null, previewBatch = null;
  /** @type {{ landProps: any, _t: number[] }|null} */
  let landPixel = null;
  /** @type {ReturnType<typeof createGrassField>|null} */
  let grassField = null;
  /** @type {Uint8Array|null} */
  let tilemapBytes = null;
  /** @type {Float32Array|null} */
  let heightPos = null;
  let heightSide = 0;
  let px = 0, py = 0, midY = 20;
  let yaw = 0.9, pitch = 0.08, dist = 28, dragging = false, lx = 0, ly = 0;
  const model = identity();

  canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    // drag down → look more from above; drag up → tilt toward the ground (near-horizontal)
    yaw += (e.clientX - lx) * 0.008;
    pitch = Math.max(-0.12, Math.min(1.35, pitch + (e.clientY - ly) * 0.008));
    lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => { dist = Math.max(3, Math.min(280, dist + e.deltaY * 0.05)); e.preventDefault(); }, { passive: false });

  function heightAt(x, z) {
    if (!heightPos || heightSide < 2) return midY;
    const u = Math.max(0, Math.min(1, x / TERRAIN_SIZE));
    const v = Math.max(0, Math.min(1, z / TERRAIN_SIZE));
    const ix = Math.min(heightSide - 1, (u * (heightSide - 1) + 0.5) | 0);
    const iz = Math.min(heightSide - 1, (v * (heightSide - 1) + 0.5) | 0);
    return heightPos[(iz * heightSide + ix) * 3 + 1];
  }

  function clearPreview() {
    if (previewMesh) { renderer.destroyMesh?.(previewMesh); previewMesh = null; }
    if (previewBatch) { renderer.destroyBillboardBatch?.(previewBatch); previewBatch = null; }
  }

  function clearPixel() {
    for (const b of batches) renderer.destroyBillboardBatch?.(b);
    batches = [];
    for (const m of skyrimMeshes) renderer.destroyMesh?.(m);
    skyrimMeshes = [];
    clearPreview();
    if (terrain) { renderer.destroyMesh?.(terrain); terrain = null; }
    if (tilemapTex) { renderer.gl?.deleteTexture?.(tilemapTex); tilemapTex = null; }
    landPixel = null;
    grassField = null;
    tilemapBytes = null;
    heightPos = null;
    heightSide = 0;
    renderer.setLowPolyTrees?.(null, LAND_PROPS_SLOT);
  }

  async function loadPixel(key) {
    status.textContent = `Building ${key}…`;
    clearPixel();
    const at = pixelOfBiome(key);
    if (!at) { status.textContent = `No pixel for ${key}`; return; }
    [px, py] = at;
    const biome = tamrielBiomeAt(px, py);
    const climate = getWorldClimateSettings(biome.climate);
    const pastBay = !inBay(px, py);
    const out = generatePixelTerrain({
      woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: climate.climateType,
      forests: { archive: climate.natureArchive, hidden: false },
      lands: pastBay ? { blend: false, archive: climate.natureArchive, hidden: false } : null,
      landform: true,
    });
    // Lands past Bay often leave avg at 0; seat the eye on the mesh centre height
    heightPos = out.positions;
    heightSide = Math.round(Math.sqrt(out.positions.length / 3));
    midY = (out.avg > 0 ? out.avg : 0.15) * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
    if (heightSide * heightSide === out.positions.length / 3) {
      const c = (heightSide >> 1) * heightSide + (heightSide >> 1);
      midY = out.positions[c * 3 + 1];
    }
    const summer = getTerrainGroundArchive(climate, SEASON.Summer);
    groundKey = landGroundSet(px, py, summer);
    await groundSets.loadGroundSet(groundKey, hold, null);
    tilemapBytes = convertTilemap(out.tilemap);
    tilemapTex = renderer.uploadTilemapTexture(tilemapBytes, 128);
    terrain = renderer.createTerrainSurface(out.positions, out.normals, buildTerrainIndices(1));

    const landStood = pastBay ? standLandProps(px, py, out.landProps) : null;
    const offLand = landFeetOff(landStood?.set.props, TERRAIN_SIZE / WORLD_MAP_TILE_DIM);
    if (landStood) {
      landPixel = { landProps: landStood.set, _t: PIXEL_T };
      await landHost.prepare();
    }

    /** @type {Map<string, { archive: number, record: number, centers: number[][], base: number }>} */
    const groups = new Map();
    const hangHosts = [];
    // Clear a small disc at pixel centre so the catalog/upload overlay is not buried in trees
    const clearR = 5, clearR2 = clearR * clearR, mid = TERRAIN_SIZE * 0.5;
    for (const f of out.nature) {
      if (offLand?.(f.x, f.z)) continue;
      const dx = f.x - mid, dz = f.z - mid;
      if (dx * dx + dz * dz < clearR2) continue;
      const base = f.archive ?? climate.natureArchive;
      const archive = getNatureArchive(base, SEASON.Summer);
      const record = f.record;
      const k = `${archive}_${record}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { archive, record, centers: [], base }));
      g.centers.push([f.x, f.y, f.z]);
      if (isTreeRecord(base, record) || isSkyrimMossRock(base, record)) {
        hangHosts.push({ c: [f.x, f.y, f.z], h: 2.5, tree: isTreeRecord(base, record), base, record, archive });
      }
    }

    const skyrimPlants = [];
    for (const g of groups.values()) {
      if (g.archive === SKYRIM_FLORA_ARCHIVE) {
        const t = await getTexture(g.archive);
        if (g.record >= t.recordCount) continue;
        uploadRecord(g.archive, g.record);
        skyrimPlants.push({ record: g.record, centers: g.centers, size: billboardSize(t, g.record) });
        continue;
      }
      const t = await getTexture(g.archive);
      if (g.record >= t.recordCount) continue;
      uploadRecord(g.archive, g.record);
      const size = billboardSize(t, g.record);
      for (const h of hangHosts) {
        if (h.archive === g.archive && h.record === g.record) h.h = size.h;
      }
      batches.push(renderer.createBillboardBatch(g.archive, g.record, size, g.centers));
    }

    const skyrimReach = landsNine(px, py)[4]?.key === 'skyrimReach';
    if (skyrimPlants.length || (skyrimReach && (hangHosts.length || landStood?.set.props?.length))) {
      if (skyrimReach) {
        const t = await getTexture(SKYRIM_FLORA_ARCHIVE);
        for (const r of SKYRIM_HANGING_RECORDS) {
          if (r < t.recordCount) uploadRecord(SKYRIM_FLORA_ARCHIVE, r);
        }
      }
      const made = [];
      standSkyrimFlora(
        skyrimPlants,
        skyrimReach ? hangHosts.map((h) => ({ c: h.c, h: h.h, tree: h.tree })) : [],
        skyrimReach ? landStood?.set.props ?? null : null,
        px, py,
        {
          addStatic: (mesh) => { made.push(renderer.createMesh(mesh)); },
          unionBox: () => {},
        },
      );
      skyrimMeshes = made;
    }

    // Meadow blades on grass tiles when the zone grows them
    const land = /** @type {any} */ (LANDS)[key];
    const grassRecs = grassRecords.get(groundKey);
    if (land?.blades !== false && grassRecs?.size && tilemapBytes) {
      const map = tilemapBytes;
      const keep = (x, z) => {
        const tx = Math.floor(x / 6.4), tz = Math.floor(z / 6.4);
        if (tx < 0 || tz < 0 || tx >= 128 || tz >= 128) return null;
        const rec = map[tz * 128 + tx] >> 2;
        if (!grassRecs.has(rec)) return null;
        return heightAt(x, z);
      };
      const ground = (x, z) => {
        const tx = Math.floor(x / 6.4), tz = Math.floor(z / 6.4);
        if (tx < 0 || tz < 0 || tx >= 128 || tz >= 128) return null;
        return groundMeanColour.get(groundKey)?.[map[tz * 128 + tx] >> 2] ?? null;
      };
      grassField = createGrassField(labGrass, { keep, ground, density: LAB_GRASS.density * 0.7 });
    }

    const nNat = [...groups.values()].reduce((n, g) => n + g.centers.length, 0);
    const nProp = landStood ? (landStood.set.props.length / LAND_PROP_FLOATS) | 0 : 0;
    const bay = pastBay ? 'past Bay' : 'Bay';
    status.textContent = `${key} @ ${px},${py} (${bay}) · ${nNat} flats · ${nProp} landmarks · ground ${groundKey}${grassField ? ' · grass' : ''}`;
  }

  async function setPreviewFromImage(img, hang) {
    clearPreview();
    const cut = cutoutCanvas(img);
    const c32 = canvasToColor32(cut);
    // Must free the key first — uploadTexture caches and would keep the first PNG forever
    renderer.releaseTexture(PREVIEW_ARCHIVE, 0);
    // variant:'' → plain `archive_record` key (mips:false alone keys as #ui and drawMesh misses it)
    renderer.uploadTexture(PREVIEW_ARCHIVE, 0, c32, { mips: false, variant: '', cutout: true });
    const cx = TERRAIN_SIZE * 0.5, cz = TERRAIN_SIZE * 0.5;
    const foot = heightAt(cx, cz);
    // Artist overlay ≥ ~2.4 m so a small PNG reads at the look-at
    const natH = Math.max(0.3, cut.height * GLOBAL_SCALE);
    const boost = Math.max(1, 2.4 / natH);
    const h = natH * boost, w = Math.max(0.2, cut.width * GLOBAL_SCALE) * boost;
    if (hang) {
      const cpu = buildPreviewMesh(cut.width * boost, cut.height * boost, true, 1);
      for (let i = 0; i < cpu.positions.length; i += 3) {
        cpu.positions[i] += cx; cpu.positions[i + 1] += foot + 2.0; cpu.positions[i + 2] += cz;
      }
      previewMesh = renderer.createMesh(cpu);
    } else {
      // Crossed cards (game stance for Skyrim ground plants)
      const cpu = buildPreviewMesh(cut.width * boost, cut.height * boost, false, 1);
      for (let i = 0; i < cpu.positions.length; i += 3) {
        cpu.positions[i] += cx; cpu.positions[i + 1] += foot; cpu.positions[i + 2] += cz;
      }
      previewMesh = renderer.createMesh(cpu);
      previewBatch = renderer.createBillboardBatch(PREVIEW_ARCHIVE, 0, { w, h }, [[cx, foot, cz]]);
    }
    thumb.src = cut.toDataURL(); thumb.hidden = false;
    status.textContent = (status.textContent || '').replace(/ · preview .*$/, '') +
      ` · preview ${cut.width}×${cut.height} (${hang ? 'hang' : `${SKYRIM_FLORA_CARDS} cards`})`;
  }

  async function loadCatalogPreview() {
    const i = Number(spriteEl.value);
    const e = SKYRIM_FLORA[i];
    const img = await loadImage(catalogUrl(e));
    await setPreviewFromImage(img, isSkyrimHangingRecord(i) || !!e.hang);
  }

  biomeEl.addEventListener('change', () => {
    loadPixel(biomeEl.value)
      .then(() => loadCatalogPreview())
      .catch((e) => { status.textContent = String(e); });
  });
  spriteEl.addEventListener('change', () => { fileEl.value = ''; loadCatalogPreview().catch((e) => { status.textContent = String(e); }); });
  fileEl.addEventListener('change', () => {
    const f = fileEl.files?.[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    loadImage(url).then((img) => {
      URL.revokeObjectURL(url);
      return setPreviewFromImage(img, isSkyrimHangingRecord(Number(spriteEl.value)) || !!SKYRIM_FLORA[Number(spriteEl.value)]?.hang);
    }).catch((e) => { status.textContent = String(e); });
  });

  await loadPixel(biomeEl.value);
  await loadCatalogPreview().catch(() => {});

  const t0 = performance.now();
  function frame() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth | 0, h = canvas.clientHeight | 0;
    if (canvas.width !== (w * dpr | 0) || canvas.height !== (h * dpr | 0)) {
      canvas.width = w * dpr | 0; canvas.height = h * dpr | 0;
    }
    const cx = TERRAIN_SIZE * 0.5, cz = TERRAIN_SIZE * 0.5;
    // Pure orbit about the look-at (no +Y bias — that forced a top-down view when zoomed in)
    const targetY = midY + 0.6;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const eye = [
      cx + Math.cos(yaw) * cp * dist,
      targetY + sp * dist,
      cz + Math.sin(yaw) * cp * dist,
    ];
    const view = lookAt(eye, [cx, targetY, cz], [0, 1, 0]);
    const near = Math.max(0.15, dist * 0.02);
    const proj = mirrorProjectionX(perspective((60 * Math.PI) / 180, canvas.width / Math.max(1, canvas.height), near, 4000));
    const minuteOfDay = 10 * 60;
    const state = skyState({ minuteOfDay, weather: 'sunny', seconds: (performance.now() - t0) / 1000, drift: [0, 0] });
    sky.setState(state);
    const sunDir = sunSkyDirection(minuteOfDay);
    const day = Math.max(0, Math.min(1, (sunDir[1] + 0.05) / 0.35));
    const lightDir = new Float32Array([sunDir[0], Math.max(0.05, sunDir[1]), sunDir[2]]);
    renderer.setLighting(new Float32Array([0.28 + 0.22 * day, 0.28 + 0.22 * day, 0.3 + 0.24 * day]), 0.9 * day, new Float32Array(state.sun));
    renderer.setLightDir(lightDir);
    renderer.setFog('exp2', 0.0007, 0, 0, sky.clearColor);
    renderer.setClearColor([0, 0, 0, 1]);
    if (landPixel) landHost.frame([landPixel], eye, null);
    renderer.beginFrame(proj, view, lightDir);
    const aspect = canvas.width / Math.max(1, canvas.height);
    sky.draw(yaw, pitch, (60 * Math.PI) / 180, aspect);
    renderer.markForeignPass();
    renderer.setCloudShadow(sky.cloudShadow ?? null);
    model[12] = 0; model[13] = 0; model[14] = 0;
    if (terrain && groundKey != null && tilemapTex) {
      const tiles = renderer.tileArrays.get(groundKey);
      if (tiles) renderer.drawTerrain(terrain, model, tiles, tilemapTex, 6.4);
    }
    for (const m of skyrimMeshes) renderer.drawMesh(m, model);
    if (previewMesh) renderer.drawMesh(previewMesh, model);
    {
      const camRight = new Float32Array([Math.cos(yaw), 0, -Math.sin(yaw)]);
      const camUp = new Float32Array([0, 1, 0]);
      const bb = previewBatch ? batches.concat(previewBatch) : batches;
      if (bb.length) renderer.drawBillboards(bb, camRight, camUp);
    }
    if (grassField) {
      grassField.update(eye[0], eye[2], (x, z) => {
        const tx = Math.floor(x / 6.4), tz = Math.floor(z / 6.4);
        if (tx < 0 || tz < 0 || tx >= 128 || tz >= 128 || !tilemapBytes) return null;
        const rec = tilemapBytes[tz * 128 + tx] >> 2;
        if (!grassRecords.get(groundKey)?.has(rec)) return null;
        return heightAt(x, z);
      }, (x, z) => {
        const tx = Math.floor(x / 6.4), tz = Math.floor(z / 6.4);
        if (tx < 0 || tz < 0 || tx >= 128 || tz >= 128 || !tilemapBytes) return null;
        return groundMeanColour.get(groundKey)?.[tilemapBytes[tz * 128 + tx] >> 2] ?? null;
      }, null);
      const eye32 = new Float32Array(eye);
      // 'meadow' (not 'smooth'): owner's crossed grass cards; smooth never binds the meadow atlas
      labGrass.draw(proj, view, eye32, (performance.now() - t0) / 1000, {
        sunDir: lightDir, amb: renderer._ambient, sunCol: renderer._sunColor,
        sunScale: renderer._sunScale ?? 1, moonDir: renderer._moonDir, moonScale: renderer._moonScale ?? 0, moonCol: renderer._moonColor,
        dim: 1, fog: { mode: renderer._fogMode, density: renderer._fogDensity, range: renderer._fogRange, color: renderer._fogColor, camPos: renderer._camPos },
      }, { dir: [1, 0], speed: 8, windV: [0.35, 0.1], sway: true }, LAB_GRASS.range, 'meadow');
      renderer.markForeignPass();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined' && document.getElementById('c')) {
  boot().catch((e) => {
    const s = document.getElementById('status');
    if (s) s.textContent = String(e?.stack || e);
    console.error(e);
  });
}
