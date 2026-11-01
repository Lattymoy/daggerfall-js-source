// THE GENERATOR SEEN FROM ABOVE. Lays out every archetype and writes
// one SVG each: the ground under it, its pads by height, its links by kind, its streets, plots, buildings, doors, gates and
// features. With ARENA2 (`ARENA2_PATH`) the ground is the Bay's own (WOODS.WLD through the terrain kernel), each archetype on
// a pixel whose ground suits it; without, a synthetic hill, slope, shore and marsh. The pictures are of our own layout over a
// height field, never of the game's art.
//  node tools/settlementProbe.mjs [--out scratch/settlements] [--seed 7] [--synthetic]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { generateSettlement } from '../src/world/settlement/settlementGen.js';
import { BUILDING_TYPES as T, isResidence } from '../src/world/buildingNames.js';

const SEA_M = 34;   // terrainSampler.js: the ocean's 27.2 at the streaming scale
const M_PER_SAMPLE = 6.4;

/** The synthetic grounds, one an archetype. */
export const SYNTHETIC = Object.freeze({
  oasis: { heightAt: (e, n) => 80 + 0.002 * ((e - 400) ** 2 + (n - 400) ** 2) ** 0.75, waterAt: (e, n) => Math.hypot(e - 400, n - 400) < 10 },
  mining: { heightAt: (e, n) => 100 + 0.22 * n + 2 * Math.sin(e / 40) },
  fort: { heightAt: (e, n) => 100 + 30 * Math.exp(-((e - 400) ** 2 + (n - 400) ** 2) / (2 * 70 ** 2)) },
  river: { heightAt: (e, n) => 40 + Math.max(0, (n - 360) * 0.06), waterAt: (e, n) => n < 360 },
  wetland: { heightAt: (e, n) => 30 + 0.3 * Math.sin(e / 9) * Math.cos(n / 11), waterAt: (e, n) => Math.sin(e / 9) * Math.cos(n / 11) < -0.2 },
  village: { heightAt: (e, n) => 60 + Math.sin(e / 50) + Math.cos(n / 60) },
  lanes: { heightAt: (e, n) => 70 + 0.06 * (e - 400) + 2 * Math.sin(n / 45) },
});
const STYLE_OF = { oasis: 'Hammerfell', mining: 'Skyrim', fort: 'HighRock', river: 'Imperial', wetland: 'BlackMarsh', village: 'Morrowind', lanes: 'Skyrim' };

/** A pixel's ground as the kernel makes it: heights in metres, bilinear between its 129 x 129 samples. */
async function bayGround(arena2) {
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { generatePixelTerrain } = await import('../src/world/terrain/terrainGen.js');
  const { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION: D } = await import('../src/world/terrain/terrainSampler.js');
  const { CLIMATES } = await import('../src/formats/mapsTables.js');
  const woods = new WoodsFile();
  woods.load(new Uint8Array(readFileSync(join(arena2, 'WOODS.WLD'))));
  const kept = new Map();
  const ground = (px, py) => {
    const key = `${px},${py}`;
    if (!kept.has(key)) kept.set(key, make(px, py));
    return kept.get(key);
  };
  ground.byte = (px, py) => woods.getHeightMapValue(px, py);
  return ground;
  function make(px, py) {
    const s = generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Woodlands, landform: true }).samples;
    const at = (x, y) => s[Math.max(0, Math.min(D - 1, y)) * D + Math.max(0, Math.min(D - 1, x))] * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
    const heightAt = (e, n) => {
      const x = e / M_PER_SAMPLE, y = n / M_PER_SAMPLE, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
    };
    return { heightAt, waterAt: (e, n) => heightAt(e, n) < SEA_M + 0.5 };
  }
}

/** The sites that suit the archetype, best first: relief for the fort, a slope for the mine; the river's a coast's pixels
 *  (land beside the sea's bytes in WOODS.WLD, 0 to 2), its site on the side whose ground meets the water. */
function rankPixels(ground, archetype) {
  const out = [];
  if (archetype === 'river') {
    for (let py = 40; py < 480 && out.length < 12; py += 3) for (let px = 40; px < 960 && out.length < 12; px += 5) {
      if (ground.byte(px, py) < 8 || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ground.byte(px + dx, py + dy) <= 2)) continue;
      const g = ground(px, py);
      for (const [e, n] of [[170, 410], [650, 410], [410, 170], [410, 650]]) {
        const near = [[-150, 0], [150, 0], [0, -150], [0, 150]].filter(([de, dn]) => g.waterAt(e + de, n + dn)).length;
        if (!g.waterAt(e, n) && near === 1) { out.push({ px, py, score: 1, g, site: { east: e, north: n, radius: 90 } }); break; }
      }
    }
    return out;
  }
  for (let py = 60; py < 470; py += 23) for (let px = 60; px < 960; px += 37) {
    const g = ground(px, py), c = 410, h = (de, dn) => g.heightAt(c + de, c + dn);
    const ring = [h(80, 0), h(-80, 0), h(0, 80), h(0, -80)], mid = h(0, 0);
    if (mid < SEA_M + 3 && archetype !== 'river') continue;
    const wet = [[-160, 0], [160, 0], [0, -160], [0, 160]].filter(([e, n]) => g.waterAt(c + e, c + n)).length;
    const fall = Math.hypot(ring[0] - ring[1], ring[2] - ring[3]) / 160;
    const hill = mid - ring.reduce((a, b) => a + b, 0) / 4;
    const score = archetype === 'fort' ? hill : archetype === 'mining' ? -Math.abs(fall - 0.15) - Math.abs(hill) / 20 : archetype === 'river' ? (wet === 1 && mid > SEA_M + 1 ? 10 - fall : -1) : -fall;
    out.push({ px, py, score, g });
  }
  return out.sort((a, b) => b.score - a.score);
}

const ramp = (t) => { const c = [[38, 70, 40], [88, 120, 60], [170, 160, 100], [220, 205, 170]]; const x = Math.max(0, Math.min(0.999, t)) * 3, i = Math.floor(x), f = x - i; return `rgb(${c[i].map((v, k) => Math.round(v + (c[i + 1][k] - v) * f)).join(',')})`; };
const SERVICE_COLOUR = { [T.Temple]: '#e6b422', [T.Tavern]: '#c0392b', [T.Palace]: '#7b1e1e', [T.GuildHall]: '#8e44ad', [T.Bank]: '#16a085' };
const LINK_COLOUR = { grade: '#2ecc71', stairs: '#e67e22', ramp: '#f1c40f', bridge: '#8d6e63' };

/** One plan as SVG, north up. */
export function planSvg(plan, env, title) {
  const pts = plan.footprint, xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const pad = 20, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad, k = 3;
  const X = (e) => ((e - x0) * k).toFixed(1), Y = (n) => ((z1 - n) * k).toFixed(1);
  const path = (ring, close = true) => ring.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`).join('') + (close ? 'Z' : '');
  const out = [];
  const ys = plan.pads.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys, lo + 1);
  for (let e = x0; e < x1; e += 6) for (let n = z0; n < z1; n += 6) {
    const wet = env.waterAt?.(e + 3, n + 3);
    out.push(`<rect x="${X(e)}" y="${Y(n + 6)}" width="${6 * k}" height="${6 * k}" fill="${wet ? '#3b6ea5' : '#cfc8b4'}" opacity="${wet ? 0.9 : 0.35}"/>`);
  }
  for (const p of plan.pads) out.push(`<path d="${path(p.poly)}" fill="${ramp((p.y - lo) / (hi - lo))}" stroke="${p.rim === 'wall' ? '#222' : '#555'}" stroke-width="${p.rim === 'wall' ? 2 : 0.6}"${p.base === 'raised' ? ' stroke-dasharray="4 3"' : ''}/>`);
  for (const s of plan.streets) out.push(`<path d="${path(s.path, false)}" fill="none" stroke="#efe6d2" stroke-width="${(s.width * k * 0.8).toFixed(1)}" stroke-linecap="round" opacity="0.8"/>`);
  for (const p of plan.plots ?? []) out.push(`<path d="${path(p.poly)}" fill="none" stroke="#8a7f62" stroke-width="0.5" stroke-dasharray="2 2"/>`);
  for (const b of plan.buildings) {
    const colour = SERVICE_COLOUR[b.type] ?? (isResidence(b.type) ? '#ece9e2' : '#3d7ab8');
    out.push(`<path d="${path(b.footprint)}" fill="${colour}" stroke="#333" stroke-width="0.8"/>`);
    for (const e of b.entrances) {
      const r = (e.facing * Math.PI) / 180;
      out.push(`<line x1="${X(e.at[0])}" y1="${Y(e.at[1])}" x2="${X(e.at[0] + Math.sin(r) * 2)}" y2="${Y(e.at[1] + Math.cos(r) * 2)}" stroke="#000" stroke-width="1.5"/>`);
    }
  }
  for (const l of plan.links) out.push(`<line x1="${X(l.a[0])}" y1="${Y(l.a[1])}" x2="${X(l.b[0])}" y2="${Y(l.b[1])}" stroke="${LINK_COLOUR[l.kind]}" stroke-width="3"/>`);
  for (const f of plan.features ?? []) {
    if (f.path) out.push(`<path d="${path(f.path, false)}" fill="none" stroke="${f.kind === 'dock' ? '#6d4c41' : '#3a3a3a'}" stroke-width="${f.kind === 'wall' ? 5 : 3}"/>`);
    else if (f.at) out.push(`<circle cx="${X(f.at[0])}" cy="${Y(f.at[1])}" r="${f.kind === 'tree' ? 4 : f.kind === 'tower' ? 6 : 5}" fill="${{ tree: '#2e7d32', garden: '#9ccc65', tower: '#3a3a3a', well: '#1e88e5', fountain: '#1e88e5', market: '#ff7043', statue: '#9e9e9e' }[f.kind] ?? '#000'}"/>`);
  }
  for (const g of plan.gates) out.push(`<circle cx="${X(g.at[0])}" cy="${Y(g.at[1])}" r="7" fill="none" stroke="#d00" stroke-width="3"/>`);
  out.push(`<path d="${path(plan.footprint)}" fill="none" stroke="#000" stroke-width="1"/>`);
  const w = (x1 - x0) * k, h = (z1 - z0) * k;
  out.push(`<text x="8" y="20" font-family="sans-serif" font-size="16" fill="#111">${title}</text>`);
  out.push(`<text x="8" y="${h - 10}" font-family="sans-serif" font-size="12" fill="#111">pads light = higher (${lo.toFixed(1)}..${hi.toFixed(1)} m); links: green grade, orange stairs, yellow ramp, brown bridge; red ring a gate; gold temple, red tavern, blue shop, purple guild</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}"><rect width="100%" height="100%" fill="#f4f1ea"/>${out.join('')}</svg>`;
}

async function main() {
  const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : d; };
  const outDir = arg('--out', 'scratch/settlements'), seed = Number(arg('--seed', 7));
  const arena2 = process.env.ARENA2_PATH;
  const real = !process.argv.includes('--synthetic') && arena2 && existsSync(join(arena2, 'WOODS.WLD')) ? await bayGround(arena2) : null;
  mkdirSync(outDir, { recursive: true });
  for (const archetype of Object.keys(SYNTHETIC)) {
    // the best-ranked pixel the archetype stands on (its fit), of the first twelve; the synthetic ground without ARENA2
    let picked = null, made = null;
    for (const cand of real ? rankPixels(real, archetype).slice(0, 12) : [null]) {
      const env = cand ? cand.g : SYNTHETIC[archetype];
      const site = cand ? cand.site ?? { east: 410, north: 410, radius: 90 } : { east: 400, north: 400, radius: 90 };
      made = { env, ...generateSettlement({ place: 0xa7_80001, origin: { px: cand?.px ?? 1000, py: cand?.py ?? 200, east: 0, north: 0 }, seed, archetype, style: STYLE_OF[archetype], site, env }) };
      picked = cand;
      if (made.report.ok) break;
    }
    const { plan, report, env } = made;
    const where = picked ? `the Bay's pixel ${picked.px},${picked.py}` : 'synthetic ground';
    const file = join(outDir, `${archetype}.svg`);
    writeFileSync(file, planSvg(plan, env, `${archetype} (${STYLE_OF[archetype]}) on ${where} - ${report.counts.buildings} buildings, relief ${report.relief} m, ${report.ok ? 'keeps the contract' : 'NOT OK'}`));
    console.log(`${file}: ${report.layout}, ${JSON.stringify(report.counts)}, relief ${report.relief} m, cut ${report.fit.cutMax} m, ok ${report.ok}${report.problems.length ? ` ${report.problems[0].code} ${report.problems[0].at}` : ''}`);
  }
}

if (isMain(import.meta.url)) await main();
