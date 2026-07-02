// Milestone 6: ?terrain=<mapPixelX>,<mapPixelY> (default 207,213 -
// Daggerfall city environs) renders a 5x5 map-pixel heightfield
// neighborhood from WOODS.WLD through the DefaultTerrainSampler port,
// shaded by an elevation ramp (terrain texturing is the Rendering arc's).

import { WoodsFile } from '../formats/woodsFile.js';
import { lookAt, perspective, trs } from '../world/mat4.js';
import { DEFAULT_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, SCALED_OCEAN_ELEVATION, TERRAIN_SIZE, generateSamples } from '../world/terrainSampler.js';
import { fetchBytes } from './shared.js';

// Milestone 6 scene: a 5x5 map-pixel heightfield neighborhood.
export async function bootTerrain(canvas, renderer, params, status) {
  const spec = params.get('terrain');
  const [cx, cy] = spec && spec.includes(',')
    ? spec.split(',').map(Number)
    : [207, 213]; // Daggerfall city environs

  status('loading WOODS.WLD');
  const woods = new WoodsFile();
  if (!woods.load(await fetchBytes('WOODS.WLD'))) throw new Error('WOODS.WLD failed to load');

  // Elevation ramp texture: sea -> beach -> grass -> rock -> snow. Sampled
  // by height so relief reads without the Rendering arc's tilemap.
  const rampW = 256;
  const ramp = new Uint32Array(rampW);
  const ocean = SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT;
  const beach = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT;
  const abgr = (r, g, b) => (0xff << 24) | (b << 16) | (g << 8) | r;
  for (let i = 0; i < rampW; i++) {
    const h = i / (rampW - 1);
    if (h <= ocean + 1e-4) ramp[i] = abgr(38, 66, 129);
    else if (h < beach) ramp[i] = abgr(190, 170, 120);
    else if (h < 0.25) ramp[i] = abgr(72, 108, 52);
    else if (h < 0.5) ramp[i] = abgr(112, 104, 84);
    else ramp[i] = abgr(228, 228, 232);
  }
  renderer.uploadTexture('ramp', 0, { width: rampW, height: 1, colors: ramp });

  status(`sampling terrain around ${cx},${cy}`);
  const hDim = HEIGHTMAP_DIMENSION;
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const step = TERRAIN_SIZE / (hDim - 1);
  const drawList = [];
  const radius = 2; // 5x5 neighborhood
  for (let py = cy - radius; py <= cy + radius; py++) {
    for (let px = cx - radius; px <= cx + radius; px++) {
      const samples = generateSamples(woods, px, py);
      const at = (x, y) => samples[x * hDim + y] * worldHeight;

      const positions = new Float32Array(hDim * hDim * 3);
      const normals = new Float32Array(hDim * hDim * 3);
      const uvs = new Float32Array(hDim * hDim * 2);
      for (let y = 0; y < hDim; y++) {
        for (let x = 0; x < hDim; x++) {
          const vi = (y * hDim + x) * 3;
          positions[vi] = x * step;
          positions[vi + 1] = at(x, y);
          positions[vi + 2] = y * step;
          // Central-difference normal.
          const hl = at(Math.max(0, x - 1), y);
          const hr = at(Math.min(hDim - 1, x + 1), y);
          const hd = at(x, Math.max(0, y - 1));
          const hu = at(x, Math.min(hDim - 1, y + 1));
          const nx = hl - hr, ny = 2 * step, nz = hd - hu;
          const nl = Math.hypot(nx, ny, nz) || 1;
          normals[vi] = nx / nl; normals[vi + 1] = ny / nl; normals[vi + 2] = nz / nl;
          uvs[(y * hDim + x) * 2] = samples[x * hDim + y];
          uvs[(y * hDim + x) * 2 + 1] = 0.5;
        }
      }
      const quads = hDim - 1;
      const indices = new Uint32Array(quads * quads * 6);
      let ii = 0;
      for (let y = 0; y < quads; y++) {
        for (let x = 0; x < quads; x++) {
          const a = y * hDim + x;
          const b = a + 1;
          const c = a + hDim;
          const d = c + 1;
          indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
          indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
        }
      }
      const mesh = renderer.createMesh({
        positions, normals, uvs, indices,
        subMeshes: [{ textureArchive: 'ramp', textureRecord: 0, startIndex: 0, primitiveCount: quads * quads * 2 }],
      });
      // Pixel (X, Y) at (xdif * size, 0, -ydif * size): map Y runs south.
      drawList.push({
        mesh,
        matrix: trs((px - cx) * TERRAIN_SIZE, 0, -(py - cy) * TERRAIN_SIZE, 0, 0, 0),
      });
    }
  }

  // Camera hovering over the center pixel.
  const centerH = generateSamples(woods, cx, cy)[(hDim >> 1) * hDim + (hDim >> 1)] * worldHeight;
  const cam = {
    pos: [TERRAIN_SIZE / 2, centerH + 120, TERRAIN_SIZE / 2 + 300],
    yaw: Math.PI,
    pitch: -0.25,
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
  const lightDir = new Float32Array([0.45, 0.8, 0.35]);
  {
    const l = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
    lightDir[0] /= l; lightDir[1] /= l; lightDir[2] /= l;
  }

  const shotMode = params.has('shot');
  status(`terrain ${cx},${cy} - ${drawList.length} pixels`);
  console.log(`terrain: pixels ${drawList.length}, hDim ${hDim}, size ${TERRAIN_SIZE}, worldHeight ${worldHeight}`);

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const speed = (keys.has('ShiftLeft') ? 400 : 80) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    const target = shotMode
      ? [TERRAIN_SIZE / 2, centerH - 300, TERRAIN_SIZE / 2 - 1400]
      : [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const eye = shotMode ? [TERRAIN_SIZE / 2, centerH + 700, TERRAIN_SIZE / 2 + 1200] : cam.pos;
    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.5, 8000);
    const view = lookAt(eye, target, [0, 1, 0]);

    renderer.beginFrame(proj, view, lightDir);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix);

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
