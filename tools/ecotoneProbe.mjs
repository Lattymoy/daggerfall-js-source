// ECOTONE1 (2026-10-07): A CLIMATE BORDER, PHOTOGRAPHED ON A REAL GPU.
//
//     node tools/ecotoneProbe.mjs            shots in tools/shots/ecotone-*.png
//
// This container has no ARENA2, so the streaming world cannot boot here. What ECOTONE1 changes on the GPU is the terrain
// programs' sample (render/ecotoneGlsl.js) and the draw's `eco` (renderer.drawTerrain), and those can be driven over a
// SYNTHETIC 3x3 of map pixels: three flat-coloured tile sets (sixty-four records each, every one a base colour with a
// texel mottle - green woods, sand, a grey-green upland), the west column one climate, the east another, the south-east
// pixel a third, each pixel's tilemap marched from the game's own tile classifier (generateTileData, world tiles - the
// pattern runs on across the edges as it does in the world), and each pixel's `eco` made as the world host makes it.
// Shots from above (the whole 3x3, the corner) and from a walker's eye, with the blend and without - and a measurement:
// across the woods-desert seam, how much of the ground at each distance from the map pixel's edge is the desert's set
// (world points projected through the shot's own camera, the ground read back as one set or the other by its
// brightness), so the border's width and its shape are numbers. SwiftShader's milliseconds are not a player's and are
// never reported.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const W = 960, H = 540;
const server = await createServer({ server: { port: 5302, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400)); });
  await page.goto('http://localhost:5302/play/');
  const out = await page.evaluate(async ({ W, H }) => {
    const { Renderer } = await import('/src/render/renderer.js');
    const { EL_LANE } = await import('/src/render/enhancedLighting.js');
    const { buildTerrainGrid, buildTerrainIndices, convertTilemap, TERRAIN_TILE_DIM } = await import('/src/world/terrainSurface.js');
    const { generateTileData, assignTiles } = await import('/src/world/terrainTiles.js');
    const { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } = await import('/src/world/terrainSampler.js');
    const { perspective, lookAt, identity, mirrorProjectionX } = await import('/src/world/mat4.js');
    const { ecoOrigin } = await import('/src/world/ecotone.js');
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    document.body.append(canvas);
    canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    const renderer = new Renderer(canvas);
    const gl = renderer.gl;

    // three tile sets: water, dirt, grass, stone and every transition a mix of the two it joins, mottled per texel
    const SETS = {
      302: [[38, 82, 128], [122, 96, 62], [74, 116, 48], [112, 112, 104]],     // the woods: green
      2: [[38, 92, 128], [178, 142, 96], [206, 182, 128], [164, 148, 120]],    // the desert: sand
      102: [[38, 82, 120], [110, 100, 82], [104, 112, 86], [140, 140, 136]],   // the upland: grey-green
    };
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    for (const [archive, base] of Object.entries(SETS)) {
      const layers = [];
      for (let r = 0; r < 64; r++) {
        let c = base[r] ?? base[2];
        if (r >= 5 && r <= 7) c = mix(base[0], base[1], 0.5);
        if (r >= 10 && r <= 12) c = mix(base[1], base[2], 0.5);
        if (r >= 15 && r <= 17) c = mix(base[2], base[3], 0.5);
        if (r === 51) c = mix(base[1], base[2], 0.5);
        if (r === 53) c = mix(base[2], base[3], 0.5);
        const colors = new Uint8Array(64 * 64 * 4);
        for (let i = 0; i < 64 * 64; i++) {
          const x = i & 63, y = i >> 6;
          const n = (((x * 7 + y * 13) ^ (x * y)) % 9) - 4;   // a texel mottle, so a set reads as ground
          colors[i * 4] = c[0] + n * 2; colors[i * 4 + 1] = c[1] + n * 2; colors[i * 4 + 2] = c[2] + n * 2; colors[i * 4 + 3] = 255;
        }
        layers.push({ width: 64, height: 64, colors });
      }
      renderer.uploadTileArray(Number(archive), layers);
    }

    // the 3x3: map pixels (px0-1..px0+1, py0-1..py0+1); west column the woods, east the desert, south-east the upland
    const px0 = 240, py0 = 180;
    const groundOf = (px, py) => (px > px0 ? (px === px0 + 1 && py === py0 + 1 ? 102 : 2) : 302);
    const hDim = HEIGHTMAP_DIMENSION;
    const heights = new Float32Array(hDim * hDim).fill(0.3);   // flat land, well above the sea
    const grid = buildTerrainGrid(heights, 1);
    const surface = renderer.createTerrainSurface(grid.positions, grid.normals, buildTerrainIndices(1));
    const groundY = grid.positions[1];
    const pixels = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = px0 + dx, py = py0 - dz;
        const tileData = generateTileData(heights, px, py);
        const tilemap = new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM);
        assignTiles(tileData, tilemap, true);
        const tilemapTex = renderer.uploadTilemapTexture(convertTilemap(tilemap), TERRAIN_TILE_DIM);
        const m = identity(); m[12] = dx * TERRAIN_SIZE; m[14] = dz * TERRAIN_SIZE;
        // the world host's eco (scenes/world.js): the 3x3's ground archives, the distinct others a slot each
        const own = groundOf(px, py), near = [];
        for (let ez = -1; ez <= 1; ez++) for (let ex = -1; ex <= 1; ex++) near.push(groundOf(px + ex, py - ez));
        let eco = null;
        if (near.some((a) => a !== own)) {
          const archives = [...new Set(near.filter((a) => a !== own))];
          const slot = (k) => (near[k] === own ? 0 : archives.indexOf(near[k]) + 1);
          const [ox, oz] = ecoOrigin(px, py);
          eco = {
            archives, tex: [0, 1, 2].map((k) => (archives[k] != null ? renderer.tileArrays.get(archives[k]) : null)),
            side: Int32Array.of(slot(3), slot(5), slot(1), slot(7)), corner: Int32Array.of(slot(0), slot(2), slot(6), slot(8)),
            origin: Int32Array.of(ox, oz, 1),
          };
        }
        pixels.push({ px, py, m, own, tilemapTex, eco });
      }
    }

    const shots = [];
    let lastVP = null;
    const draw = (name, eye, target, up, { blend = true, lane = false, fov = 60 } = {}) => {
      renderer.setLightingLane(lane ? EL_LANE : null);
      const proj = mirrorProjectionX(perspective(fov * Math.PI / 180, W / H, 0.5, 9000));
      const view = lookAt(eye, target, up);
      lastVP = { proj, view };
      const lightDir = new Float32Array([0.3, 0.85, 0.42]);
      renderer.setLighting(new Float32Array([0.45, 0.45, 0.47]), 0.75, new Float32Array([1, 0.97, 0.9]));
      renderer.setLightDir(lightDir);
      renderer.setFog('exp2', 0.00001, 0, 0, [0.6, 0.7, 0.8]);
      renderer.setClearColor([0.6, 0.7, 0.8, 1]);
      renderer.beginFrame(proj, view, lightDir);
      for (const p of pixels) renderer.drawTerrain(surface, p.m, renderer.tileArrays.get(p.own), p.tilemapTex, 6.4, false, blend ? p.eco : null);
      renderer.endFrame?.();
      const err = gl.getError();
      const px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      shots.push({ name, png: canvas.toDataURL('image/png'), err });
      return px;
    };
    const c = TERRAIN_SIZE / 2;   // the centre pixel's middle
    // above the whole 3x3, north up the picture, with the blend and without
    const topH = 2300;
    const top = draw('top', [c, groundY + topH, c], [c, groundY, c], [0, 0, 1]);
    const topOff = draw('top-off', [c, groundY + topH, c], [c, groundY, c], [0, 0, 1], { blend: false });
    // the corner of the woods, the desert and the upland, from 520 m up
    draw('corner', [TERRAIN_SIZE, groundY + 520, 0], [TERRAIN_SIZE, groundY, 0], [0, 0, 1]);
    draw('corner-off', [TERRAIN_SIZE, groundY + 520, 0], [TERRAIN_SIZE, groundY, 0], [0, 0, 1], { blend: false });
    // from a rise on the woods' side, 30 m up: across the seam into the desert, along it to the north, and the lane's own
    // decode of the first
    const across = [[TERRAIN_SIZE - 260, groundY + 30, c + 40], [TERRAIN_SIZE + 160, groundY, c + 40]];
    draw('rise-across', ...across, [0, 1, 0]);
    draw('rise-across-off', ...across, [0, 1, 0], { blend: false });
    draw('rise-across-lane', ...across, [0, 1, 0], { lane: true });
    draw('rise-along', [TERRAIN_SIZE - 60, groundY + 30, c - 220], [TERRAIN_SIZE + 10, groundY, c + 160], [0, 1, 0]);

    // THE SEAM, MEASURED on the shots from above: at each distance from the map pixel's edge between the woods and the
    // desert (x = TERRAIN_SIZE in the centre pixel's frame, east positive), the share of the ground along that line - the
    // centre and east pixels' middle 600 m, clear of the upland - that reads as the desert's set (its tiles are all
    // brighter than the woods': grass 206/182/128 against 74/116/48)
    const project = ({ proj, view }, x, y, z) => {
      const v = [x, y, z, 1];
      const mul = (m, a) => [0, 1, 2, 3].map((r) => m[r] * a[0] + m[4 + r] * a[1] + m[8 + r] * a[2] + m[12 + r] * a[3]);
      const c4 = mul(proj, mul(view, v));
      return [Math.round((c4[0] / c4[3] * 0.5 + 0.5) * W), Math.round((c4[1] / c4[3] * 0.5 + 0.5) * H)];
    };
    const desertAt = (buf, sx, sy) => { const i = (sy * W + sx) * 4; return 0.3 * buf[i] + 0.59 * buf[i + 1] + 0.11 * buf[i + 2] > 135 ? 1 : 0; };
    const profile = (buf, vp) => {
      const out = [];
      for (let off = -200; off <= 200; off += 10) {
        let n = 0, sand = 0;
        for (let z = c - 300; z <= c + 300; z += 5) {
          const [sx, sy] = project(vp, TERRAIN_SIZE + off, groundY, z);
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
          n++; sand += desertAt(buf, sx, sy);
        }
        out.push([off, n ? +(sand / n).toFixed(2) : null]);
      }
      return out;
    };
    const topVP = (() => { draw('top', [c, groundY + topH, c], [c, groundY, c], [0, 0, 1]); return lastVP; })();
    const rows = { blend: profile(top, topVP), off: profile(topOff, topVP) };
    return { shots: shots.map(({ name, png, err }) => ({ name, png, err })).filter((s, i, a) => a.findIndex((t) => t.name === s.name) === i), rows };
  }, { W, H });
  mkdirSync('tools/shots', { recursive: true });
  for (const s of out.shots) {
    writeFileSync(`tools/shots/ecotone-${s.name}.png`, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`tools/shots/ecotone-${s.name}.png${s.err ? `  GL error ${s.err}` : ''}`);
  }
  const { blend, off } = out.rows;
  console.log('the woods-desert seam from above: the desert set\'s share of the ground at each distance (m) from the pixel edge');
  console.log(`  metres:  ${blend.map(([o]) => String(o).padStart(5)).join('')}`);
  console.log(`  blend:   ${blend.map(([, f]) => String(f).padStart(5)).join('')}`);
  console.log(`  off:     ${off.map(([, f]) => String(f).padStart(5)).join('')}`);
  if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); process.exitCode = 1; }
} finally {
  await browser.close();
  await server.close();
}
