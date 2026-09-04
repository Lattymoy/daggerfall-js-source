// ROADS 14: THE ANSWER KEY, MEASURED. Basic Roads' hand-drawn network
// is what "as close as we can" means, and its data cannot ship with the
// port (bible/03-World/Roads.md, "The line"). What CAN be taken from it
// is its judgement, expressed as numbers the generator's dials control:
// how often a road bends, by how much, how many steps are diagonal, how
// many ends dead, how many junctions. This tool prints those numbers
// for the mod's arrays and, when ARENA2 is present, for OUR network on
// the same map, side by side - so a dial is turned toward a measurement
// rather than a feeling.
//
//   node tools/roadsCalibrate.mjs --bytes <dir with roadData.bytes trackData.bytes>
//   ARENA2_PATH=/path/to/ARENA2 node tools/roadsCalibrate.mjs --bytes <dir> [--turnCost 0.7 --climbCost 40 ...]
//
// The .bytes come from the author's public repo (ajrb/dfunity-mods,
// BasicRoads/). Reading them here is reading, not shipping; nothing is
// written anywhere but the console.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MAP_WIDTH, MAP_HEIGHT, WoodsFile } from '../src/formats/woodsFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { buildRoadNetwork, ROAD_DIALS, DIR } from '../src/world/roadNetwork.js';
import { settlementsOf, WATER_BYTE } from '../src/world/roadsProducer.js';

const args = process.argv.slice(2);
const opt = (k, dflt = null) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : dflt; };
const bytesDir = opt('bytes');
const ORDER = [DIR.N, DIR.NE, DIR.E, DIR.SE, DIR.S, DIR.SW, DIR.W, DIR.NW];
const OPP = (b) => ORDER[(ORDER.indexOf(b) + 4) % 8];

export function measure(mask) {
  const st = { px: 0, deg: {}, straight: 0, two: 0, bend45: 0, bend90: 0, bend135: 0, diag: 0, card: 0, ends: 0, junctions: 0 };
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]; if (!v) continue;
    st.px++;
    const bits = ORDER.filter((b) => v & b);
    st.deg[bits.length] = (st.deg[bits.length] ?? 0) + 1;
    if (bits.length === 1) st.ends++;
    if (bits.length >= 3) st.junctions++;
    for (const b of bits) { if (b === DIR.N || b === DIR.E || b === DIR.S || b === DIR.W) st.card++; else st.diag++; }
    if (bits.length === 2) {
      st.two++;
      if (OPP(bits[0]) === bits[1]) { st.straight++; continue; }
      let d = Math.abs(ORDER.indexOf(bits[0]) - ORDER.indexOf(bits[1])); d = Math.min(d, 8 - d);
      if (d === 3) st.bend45++; else if (d === 2) st.bend90++; else st.bend135++;   // d=3 -> a 45-degree heading change
    }
  }
  const bends = st.two - st.straight;
  return {
    pixels: st.px,
    bendRate: st.two ? bends / st.two : 0,            // share of through-pixels that bend
    rightAngleShare: bends ? st.bend90 / bends : 0,   // of the bends, how many are 90 degrees
    hairpinShare: bends ? st.bend135 / bends : 0,
    diagonalShare: (st.diag + st.card) ? st.diag / (st.diag + st.card) : 0,
    deadEndRate: st.px ? st.ends / st.px : 0,
    junctionRate: st.px ? st.junctions / st.px : 0,
  };
}

const fmt = (m) => `${String(m.pixels).padStart(6)} px | bend ${(m.bendRate * 100).toFixed(0).padStart(3)}% | right-angle ${(m.rightAngleShare * 100).toFixed(1).padStart(4)}% | hairpin ${(m.hairpinShare * 100).toFixed(1)}% | diagonal ${(m.diagonalShare * 100).toFixed(0)}% | dead-end ${(m.deadEndRate * 100).toFixed(1)}% | junction ${(m.junctionRate * 100).toFixed(1)}%`;

if (import.meta.url === `file://${process.argv[1]}`) {
  if (bytesDir) {
    for (const [name, file] of [['his roads ', 'roadData.bytes'], ['his tracks', 'trackData.bytes']]) {
      const p = join(bytesDir, file);
      if (!existsSync(p)) { console.log(`${name}: ${file} not found in ${bytesDir}`); continue; }
      const b = new Uint8Array(readFileSync(p));
      if (b.length !== MAP_WIDTH * MAP_HEIGHT) { console.log(`${name}: ${b.length} bytes, expected ${MAP_WIDTH * MAP_HEIGHT}`); continue; }
      console.log(`${name}: ${fmt(measure(b))}`);
    }
  }
  const ARENA2 = process.env.ARENA2_PATH;
  if (ARENA2) {
    const maps = new MapsFile();
    maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
    const woods = new WoodsFile(); woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
    const dials = {};
    for (const k of Object.keys(ROAD_DIALS)) { const v = opt(k); if (v != null) dials[k] = Number(v); }
    const t0 = Date.now();
    const net = buildRoadNetwork({ locations: settlementsOf(maps), heightAt: (x, y) => woods.getHeightMapValue(x, y), isWater: (x, y) => woods.getHeightMapValue(x, y) <= WATER_BYTE, dials });
    console.log(`our roads : ${fmt(measure(net.roads))}   (${Date.now() - t0}ms, dials ${JSON.stringify({ ...ROAD_DIALS, ...dials })})`);
    console.log(`our tracks: ${fmt(measure(net.tracks))}`);
    console.log(`stats: ${JSON.stringify({ ...net.stats, unroutedPairs: net.stats.unroutedPairs.length })}`);
  } else {
    console.log('(set ARENA2_PATH to measure OUR network on the real map beside his)');
  }
}
