// ROAD-LOOK (2026-10-27, bible/03-World/Roads.md ROAD-LOOK): A ROAD'S EDGE AND A BRIDGE, PHOTOGRAPHED ON A REAL GPU.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/roadLookProbe.mjs --out DIR
//
// The streaming world past the Bay does not boot headless (#1184's J6), so this drives what ROAD-LOOK changes over
// pixels built here by the game's own code: the ground's tile set off the player's TEXTURE.302 (the temperate summer's)
// in ART_PAL.COL's colours, a pixel's tiles classified by the game's own law (generateTileData) and painted by its
// painters - Basic Roads' (a road north to south with an arm east, and a diagonal) and the curves past the Bay (a bend) -
// marched (assignTiles), and drawn by both terrain programs (renderer.js TERRAIN_FS, the lane's EL_TERRAIN_FS) with the
// blend on and off. And a river 70 m wide down a valley with a road across it: its tiles laid back under the bridge
// (roadBridges.js unpaveBridges), the bridge's mesh (bridgeModels.js) in the capitals' pictures, drawn with the ground.
// Writes PNGs to --out (never the repository: a render of the player's data is the player's data - Port-Doctrine).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const outDir = arg('--out');
if (!outDir) {
  console.error('usage: ARENA2_PATH=... node tools/roadLookProbe.mjs --out DIR');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const W = 960,
  H = 540,
  PORT = Number(arg('--port') ?? 5317);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const launch = {
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};
if (process.env.ROAD_LOOK_CHROME) launch.executablePath = process.env.ROAD_LOOK_CHROME;
const browser = await chromium.launch(launch);
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 400));
  });
  await page.goto(`http://localhost:${PORT}/privacy/`, { waitUntil: 'domcontentloaded', timeout: 240000 }); // a page with no game on it: the probe's own imports are all it runs
  const out = await page.evaluate(
    async ({ W, H }) => {
      const { Renderer } = await import('/src/render/renderer.js');
      const { EL_LANE } = await import('/src/render/enhancedLighting.js');
      const { TextureFile } = await import('/src/formats/textureFile.js');
      const { DFPalette } = await import('/src/formats/dfPalette.js');
      const { buildTerrainGrid, buildTerrainIndices, convertTilemap, TERRAIN_TILE_DIM } =
        await import('/src/world/terrain/terrainSurface.js');
      const { generateTileData, assignTiles } = await import('/src/world/terrain/terrainTiles.js');
      const { HEIGHTMAP_DIMENSION, TERRAIN_SIZE, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } =
        await import('/src/world/terrain/terrainSampler.js');
      const { perspective, lookAt, identity, mirrorProjectionX } = await import('/src/world/mat4.js');
      const { paintRoads } = await import('/src/world/road/roadPainter.js');
      const { DIR } = await import('/src/world/road/roadNetwork.js');
      const { crossingsOf, bridgeShape, unpaveBridges } = await import('/src/world/road/roadBridges.js');
      const { buildBridgeMesh, deckTop } = await import('/src/world/road/bridgeModels.js');
      const { capitalArt } = await import('/src/world/capitalModels.js');
      const { CAPITAL_ARCHIVE, CAPITAL_ART } = await import('/src/world/capitalShapes.js');
      const { toColor32 } = await import('/src/formats/color32Order.js');
      const bytes = async (n) => new Uint8Array(await (await fetch(`/arena2/${n}`)).arrayBuffer());
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      document.body.append(canvas);
      canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
      const renderer = new Renderer(canvas);
      const gl = renderer.gl;
      const pal = new DFPalette();
      pal.load(await bytes('ART_PAL.COL'), 'ART_PAL.COL');
      const tex = new TextureFile();
      tex.load(await bytes('TEXTURE.302'), 'TEXTURE.302', pal);
      const layers = [];
      for (let r = 0; r < tex.recordCount; r++) layers.push(tex.getColor32(tex.getDFBitmap(r, 0), 0));
      const tiles = renderer.uploadTileArray(302, layers);
      const art = capitalArt();
      for (const rec of [CAPITAL_ART.bridgeStone, CAPITAL_ART.timber])
        renderer.uploadTexture(CAPITAL_ARCHIVE, rec, toColor32(art.get(rec)));
      const hDim = HEIGHTMAP_DIMENSION,
        worldH = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE,
        TD = TERRAIN_TILE_DIM + 1;

      /** A pixel: its heights (`h(x, z)` metres, x east and z north over 0..819.2), its tiles off the game's law at map
       *  pixel (px, py), painted by `paint(tileData, tilemap)`. */
      const pixel = ({ px, py, h, paint }) => {
        const heights = new Float32Array(hDim * hDim);
        for (let x = 0; x < hDim; x++)
          for (let z = 0; z < hDim; z++)
            heights[x * hDim + z] = h((x / (hDim - 1)) * TERRAIN_SIZE, (z / (hDim - 1)) * TERRAIN_SIZE) / worldH;
        const tileData = generateTileData(heights, px, py);
        const tilemap = new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM);
        paint(tileData, tilemap);
        assignTiles(tileData, tilemap, true);
        const grid = buildTerrainGrid(heights, 1);
        return {
          surface: renderer.createTerrainSurface(grid.positions, grid.normals, buildTerrainIndices(1)),
          tilemapTex: renderer.uploadTilemapTexture(convertTilemap(tilemap), TERRAIN_TILE_DIM),
        };
      };
      const shots = [];
      const draw = (name, eye, target, things, { edges = true, lane = false, fov = 55 } = {}) => {
        renderer.setLightingLane(lane ? EL_LANE : null);
        renderer.roadEdges = edges;
        const proj = mirrorProjectionX(perspective((fov * Math.PI) / 180, W / H, 0.3, 6000));
        const view = lookAt(eye, target, [0, 1, 0]);
        const lightDir = new Float32Array([0.35, 0.8, 0.45]);
        renderer.setLighting(new Float32Array([0.5, 0.5, 0.52]), 0.7, new Float32Array([1, 0.97, 0.9]));
        renderer.setLightDir(lightDir);
        renderer.setFog('exp2', 0.00001, 0, 0, [0.6, 0.7, 0.8]);
        renderer.setClearColor([0.6, 0.7, 0.8, 1]);
        renderer.beginFrame(proj, view, lightDir);
        for (const t of things) {
          if (t.surface) renderer.drawTerrain(t.surface, t.m, tiles, t.tilemapTex, 6.4, false, null);
          else renderer.drawMesh(t.mesh, t.m, null);
        }
        renderer.endFrame?.();
        shots.push({ name, png: canvas.toDataURL('image/png'), err: gl.getError() });
      };

      // ── THE EDGES: Basic Roads' painter (a road north to south, an arm east, and a diagonal), and a curve past the Bay ──
      const flat = () => 120;
      const bay = pixel({
        px: 300,
        py: 200,
        h: flat,
        paint: (td, tm) =>
          paintRoads(td, tm, DIR.N | DIR.S | DIR.E | DIR.SW, 0, null, TD, { paths: new Uint8Array(tm.length) }),
      });
      const curve = { '0,0': DIR.N | DIR.SE, '0,-1': DIR.S, '1,1': DIR.NW };
      const past = pixel({
        px: 0,
        py: 0,
        h: flat,
        paint: (td, tm) =>
          paintRoads(td, tm, curve['0,0'], 0, null, TD, {
            paths: new Uint8Array(tm.length),
            curve: { px: 0, py: 0, byteAt: (k, x, y) => (k === 'roads' ? (curve[`${x},${y}`] ?? 0) : 0) },
          }),
      });
      const at = (dx) => {
        const m = identity();
        m[12] = dx;
        return m;
      };
      const c = TERRAIN_SIZE / 2;
      for (const lane of [false, true]) {
        const L = lane ? '-lane' : '';
        for (const edges of [true, false]) {
          const E = edges ? '' : '-off';
          draw(`bay-top${L}${E}`, [c + 2, 120 + 34, c - 6], [c + 2, 120, c - 5.9], [{ ...bay, m: at(0) }], {
            edges,
            lane,
          });
          draw(`bay-eye${L}${E}`, [c - 22, 121.8, c - 40], [c + 6, 120, c + 30], [{ ...bay, m: at(0) }], {
            edges,
            lane,
          });
          draw(`curve-top${L}${E}`, [c + 60, 120 + 90, c - 60], [c + 60, 120, c - 59.9], [{ ...past, m: at(0) }], {
            edges,
            lane,
          });
        }
      }

      // ── THE BRIDGE: a river 70 m wide down a valley, a road across it on the curves' painter ──
      const law = (() => {
        const n = 201,
          pts = new Float64Array(2 * n),
          width = new Float32Array(n),
          level = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          pts[2 * i] = 10.5 + 0.05 * Math.sin(i / 20);
          pts[2 * i + 1] = i / 10;
          width[i] = 70;
          level[i] = 80;
        }
        const index = new Map();
        for (let i0 = 0; i0 < n - 1; i0 += 8)
          for (let dx = -1; dx <= 1; dx++)
            for (let y = Math.floor(i0 / 10) - 1; y <= Math.floor((i0 + 8) / 10) + 1; y++) {
              const k = (10 + dx) * 65536 + y,
                a = index.get(k) ?? [];
              if (!a.includes(i0)) a.push(i0);
              index.set(k, a);
            }
        return {
          version: 1,
          rivers: [{ key: 'probe', name: 'probe', pts, width, level, n }],
          lakes: [],
          index,
          pixels: new Map(),
        };
      })();
      const river = (x) => (x - 10) * TERRAIN_SIZE; // the river's middle in the pixel's metres (x east), Bay x
      const lvl = 80 * 1.25;
      const valley = (x, z) => {
        const bx = 10 + x / TERRAIN_SIZE,
          by = 11 - z / TERRAIN_SIZE,
          mid = river(10.5 + 0.05 * Math.sin((by * 10) / 20)),
          e = Math.abs(x - mid) - 35;
        return e < 0 ? lvl - 1.5 : lvl + Math.min(40, (e / 300) ** 2 * 40);
      };
      const ew = { '10,10': DIR.E | DIR.W, '9,10': DIR.E | DIR.W, '11,10': DIR.E | DIR.W };
      const byteAt = (k, x, y) => (k === 'roads' ? (ew[`${x},${y}`] ?? 0) : 0);
      const inChannel = (bx, by) => Math.abs(bx - (10.5 + 0.05 * Math.sin((by * 10) / 20))) * TERRAIN_SIZE < 35;
      const bridged = pixel({
        px: 10,
        py: 10,
        h: valley,
        paint: (td, tm) => {
          const paths = new Uint8Array(tm.length);
          paintRoads(td, tm, ew['10,10'], 0, null, TD, { paths, curve: { px: 10, py: 10, byteAt } });
          unpaveBridges(tm, paths, 10, 10, byteAt, law, inChannel);
          for (let y = 0; y < TD; y++)
            for (let x = 0; x < TD; x++)
              if (!paths[Math.min(127, y) * 128 + Math.min(127, x)] && inChannel(10 + x / 128, 11 - y / 128))
                td[x + y * TD] = 0;
        },
      });
      const crossing = crossingsOf(10, 10, byteAt, law)[0];
      const b = bridgeShape(crossing);
      const { mesh } = buildBridgeMesh(b, 10, 10);
      const model = renderer.createMesh(mesh);
      const mid = river(10.5);
      const scene = [
        { ...bridged, m: identity() },
        { mesh: model, m: identity() },
      ];
      for (const lane of [false, true]) {
        const L = lane ? '-lane' : '';
        draw(`bridge-bank${L}`, [mid - 140, lvl + 22, c - 120], [mid, lvl + 3, c], scene, { lane });
        draw(`bridge-deck${L}`, [mid - 95, deckTop(b, 95) + 1.7, c + 0.5], [mid + 60, b.deck, c], scene, { lane });
        draw(`bridge-under${L}`, [mid + 10, lvl + 1.2, c - 60], [mid - 5, lvl + 3, c], scene, { lane });
      }
      // the timber bridge of a track over the same water
      const tb = bridgeShape({ ...crossing, kind: 'track' });
      const timber = renderer.createMesh(buildBridgeMesh(tb, 10, 10).mesh);
      draw(
        'bridge-track',
        [mid - 110, lvl + 18, c - 90],
        [mid, lvl + 2, c],
        [
          { ...bridged, m: identity() },
          { mesh: timber, m: identity() },
        ],
        { lane: true },
      );
      return {
        shots: shots.map(({ name, png, err }) => ({ name, png, err })),
        bridge: { deck: b.deck, reach: b.reach, half: b.half, level: b.level },
      };
    },
    { W, H },
  );
  for (const s of out.shots) {
    const p = join(outDir, `roadlook-${s.name}.png`);
    writeFileSync(p, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`${p}${s.err ? `  GL error ${s.err}` : ''}`);
  }
  console.log('bridge', JSON.stringify(out.bridge));
  if (errors.length) {
    console.log('page errors:');
    for (const e of errors) console.log('  ' + e);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}
