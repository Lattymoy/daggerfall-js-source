// D2 probe: the real SnowfallRuntime over a world adapter whose pixelOn carries world.js's own bound
// (snowGround.pixelOn: `if (px < 0 || px >= 1000 || py < 0 || py >= 500) return null;`), at a Bay pixel and at Whiterun.
import { readFileSync } from 'node:fs';
const R = '/home/user/daggerfall-js-source/';
const { SnowCoverage } = await import(R + 'src/systems/snowfall.js');
const { SnowfallRuntime } = await import(R + 'src/systems/snowfallRuntime.js');
const { snowPixelBox } = await import(R + 'src/scenes/snowfallHost.js');
const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(R + `public/art/snowfall/snow_surface_masks_${a}.bytes`)));
const SIZE = 819.2, RING = 3;
const bayBound = (px, py) => px < 0 || px >= 1000 || py < 0 || py >= 500;   // world.js snowGround.pixelOn's first line
function run(X0, Y0) {
  const live = new Map();
  const make = (mx, my) => ({ mapX: mx, mapY: my, size: SIZE, tileMap: new Uint8Array(16384).fill(1 << 2), winterArchive: 303, stamp: 1, roads: null,
    origin: (out) => { out[0] = (mx - X0) * SIZE; out[1] = 0; out[2] = -(my - Y0) * SIZE; return out; }, height: () => 0, normal: (lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; } });
  for (let j = -RING; j <= RING; j++) for (let i = -RING; i <= RING; i++) live.set(`${X0 + i},${Y0 + j}`, make(X0 + i, Y0 + j));
  const pixelOn = (x, y) => (bayBound(x, y) ? null : live.get(`${x},${y}`) ?? null);
  const world = {
    terrainAt: (x, z) => pixelOn(X0 + Math.floor(x / SIZE), Y0 - Math.floor(z / SIZE)),
    terrainsNear: (r) => [...live.values()].filter((t) => Math.max(Math.abs(t.mapX - X0), Math.abs(t.mapY - Y0)) <= r),   // world.js pixelsNear: no bound
    terrainsIn: (a, b, c, d) => { const bx = snowPixelBox(a, b, c, d), out = []; for (let y = bx.y0; y <= bx.y1; y++) for (let x = bx.x0; x <= bx.x1; x++) { const t = pixelOn(x, y); if (t) out.push(t); } return out; },
    toGlobal: (x, z) => [X0 * SIZE + x, (499 - Y0) * SIZE + z], settlements: () => [], terrainDistance: 3,
  };
  const rt = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), frameBudgetMs: Infinity });
  for (const t of live.values()) rt.terrainPromoted(t, 0, null);
  let now = 0, sec = 1_000_000;
  const w = console.warn; console.warn = () => {};
  for (let i = 0; i < 1200; i++) { now += 1 / 30; sec += 2; rt.frame({ now, inside: false, enabled: true, player: { x: 10, y: 0, z: 10, grounded: true, swimming: false, levitating: false }, winter: true, desert: false, snowing: true, gameSeconds: sec, npcs: [], corpses: [] }); }
  console.warn = w;
  const L = rt.local, tiers = rt.visibleTiers();
  return { meshReady: L.meshReady, staticReady: L.staticReady, heightRebuild: L.heightRebuild, midReady: !!rt.mid.ready, blanketOverlays: [...rt.blanket.overlays.values()].filter((o) => o.ready).length, tiers: Object.keys(tiers ?? {}).filter((k) => tiers[k] && (tiers[k].visible ?? tiers[k] === true)) };
}
console.log('Bay (500, 250)        :', JSON.stringify(run(500, 250)));
console.log('Whiterun (1891, -202) :', JSON.stringify(run(1891, -202)));
