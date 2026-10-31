// @ts-check
// WG2 THE SAMPLER (bible/03-World/World-2-Canon.md, "Reading a bake"): what a client reads of a decoded bake - the
// ground's height anywhere in it, its water, its byte and climate a pixel, and the environment a plant or a town asks
// for. Runtime and worker-safe: exact arithmetic over the bake's planes (WG-2), nothing worked out that the bake did
// not already hold except the surface's grain and the rivers' channels, both pure in the point.
import { fbm, ridged, seedOf, smoothstep } from './exact.js';
import { Field } from './field.js';
import { worldPixelKey } from '../worldWide/worldGrid.js';
import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../terrain/terrainSampler.js';

/** Metres a world pixel. */
export const PIXEL_M = 819.2;
/** The band inside a region's edge over which its ground eases in from the world's, world pixels. */
export const BLEND_PX = 8;
/** The grain each biome's surface carries, metres (data/biomes.json's order), and the steep ground's extra a unit of slope. */
const GRAIN_M = [0, 1.5, 4, 2.5, 2, 3, 4, 3, 3, 0.5, 0.6, 9, 6, 5, 1.5, 1, 1.2, 0.2, 3];
const GRAIN_SLOPE_M = 14;
const DUNES = 1;
/** A spring's pool's radius, world pixels (some 150 m). */
export const POOL_PX = 0.18;
/** How far a plant or a town may ask after water, metres (the rivers are filed this far out). */
export const WATER_REACH_M = 160;

/** A metre height over the sea in the kernel's units (the sea at SCALED_OCEAN_ELEVATION, 1.25 m a unit). @param {number} m */
export const kernelUnits = (m) => SCALED_OCEAN_ELEVATION + m / STREAMING_TERRAIN_SCALE;

/**
 * A sampler over a decoded bake (bakeCodec.js decodeBake).
 * @param {import('./bakeCodec.js').DecodedBake} bake
 */
export function regionSampler(bake) {
  const { header, fields } = bake, rect = header.rect, seed = seedOf(header.seed, 'grain');
  const elev = fields.elev, biome = fields.biome, lake = fields.lake;
  // the grain's height a cell, from its biome and its slope
  const grain = new Field(elev.w, elev.h, elev.frame, Float32Array), cellM = PIXEL_M / header.res;
  for (let j = 0; j < elev.h; j++) for (let i = 0; i < elev.w; i++) {
    const gx = (elev.get(i + 1, j) - elev.get(i - 1, j)) / (2 * cellM), gy = (elev.get(i, j + 1) - elev.get(i, j - 1)) / (2 * cellM);
    grain.data[j * elev.w + i] = (GRAIN_M[biome.data[j * elev.w + i]] ?? 2) + GRAIN_SLOPE_M * Math.min(1, Math.sqrt(gx * gx + gy * gy));
  }
  // the rivers' segments, filed by every world pixel their channel and banks reach
  const segs = [];
  /** @type {Map<number, number[]>} */
  const index = new Map();
  for (const rv of header.rivers) {
    for (let p = 0; p + 1 < rv.pts.length; p++) {
      const [ax, ay, aq, as, aw, ad] = rv.pts[p], [bx, by, , bs, bw, bd] = rv.pts[p + 1];
      const reach = Math.max(Math.max(aw, bw) / 2 + bankOf(Math.max(aw, bw)), WATER_REACH_M) / PIXEL_M;
      const s = segs.length;
      segs.push({ ax, ay, bx, by, as, bs, aw, bw, ad, bd, q: aq, river: rv.id });
      for (let y = Math.floor(Math.min(ay, by) - reach); y <= Math.floor(Math.max(ay, by) + reach); y++) {
        for (let x = Math.floor(Math.min(ax, bx) - reach); x <= Math.floor(Math.max(ax, bx) + reach); x++) {
          const k = worldPixelKey(x, y), list = index.get(k);
          if (list) { if (list[list.length - 1] !== s) list.push(s); } else index.set(k, [s]);
        }
      }
    }
  }
  /** The nearest channel to a point within its banks: its distance (m), surface, half width, depth and bank. */
  const channel = (x, y) => {
    const list = index.get(worldPixelKey(Math.floor(x), Math.floor(y)));
    if (!list) return null;
    let best = null, bd2 = Infinity;
    for (const s of list) {
      const sg = segs[s], vx = sg.bx - sg.ax, vy = sg.by - sg.ay, l2 = vx * vx + vy * vy;
      let t = l2 > 0 ? ((x - sg.ax) * vx + (y - sg.ay) * vy) / l2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const dx = x - (sg.ax + vx * t), dy = y - (sg.ay + vy * t), d2 = dx * dx + dy * dy;
      if (d2 < bd2) { bd2 = d2; best = { sg, t }; }
    }
    if (!best) return null;
    const { sg, t } = best, w = sg.aw + (sg.bw - sg.aw) * t, half = w / 2, bank = bankOf(w), d = Math.sqrt(bd2) * PIXEL_M;
    if (d >= half + bank) return null;
    return { d, half, bank, surface: sg.as + (sg.bs - sg.as) * t, depth: sg.ad + (sg.bd - sg.ad) * t, river: sg.river, q: sg.q };
  };
  const inside = (x, y) => x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
  // a spring's pool: a bowl POOL_PX across, its water a little over the ground the bake stood at the spring
  const pools = (header.springs ?? []).map((sp) => ({ x: sp.x, y: sp.y, level: elev.cubicAt(sp.x, sp.y) + 0.3, name: sp.name }));
  const poolAt = (x, y) => {
    for (const p of pools) { const d2 = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y); if (d2 < POOL_PX * POOL_PX) return { p, u: Math.sqrt(d2) / POOL_PX }; }
    return null;
  };
  /** The ground with its grain, before the channels: the bake's land (Catmull-Rom) and the surface's own roughness. */
  const land = (x, y) => {
    let h = elev.cubicAt(x, y);
    const g = grain.at(x, y);
    if (g > 0.05) h += g * fbm(seed, x * 24, y * 24, 3);
    if (biome.get(...elev.cellOf(x, y)) === DUNES) h += 5 * ridged(seed + 1, x * 6, y * 1.5, 2);
    return h;
  };
  const api = {
    id: header.id, rect, print: bake.print, header, fields,
    /** Is a world point in the region? */
    owns: inside,
    /** The share of the region's ground at a point: 0 at its edge and outside, 1 past BLEND_PX inside. */
    weight(x, y) {
      if (!inside(x, y)) return 0;
      const e = Math.min(x - rect.x, y - rect.y, rect.x + rect.w - x, rect.y + rect.h - y);
      return smoothstep(0, BLEND_PX, e);
    },
    /** The ground's height at a world point, metres over the sea: the land, carved by any channel it lies in. */
    heightAt(x, y) {
      const pool = poolAt(x, y);
      if (pool) return Math.min(land(x, y), pool.p.level - 1.8 * (1 - pool.u * pool.u) + 0.5 * pool.u * pool.u);
      const h = land(x, y), c = channel(x, y);
      if (!c) return h;
      if (c.d < c.half) { const u = c.d / c.half; return Math.min(h, c.surface - c.depth * (1 - u * u)); }
      const bankTop = Math.max(h, c.surface + 0.4);
      return c.surface + 0.4 + (bankTop - c.surface - 0.4) * smoothstep(c.half, c.half + c.bank, c.d);
    },
    /** The water at a world point: a river's channel or a lake, with its surface (metres), or null. */
    waterAt(x, y) {
      const pool = poolAt(x, y);
      if (pool && api.heightAt(x, y) < pool.p.level) return { kind: 'spring', surface: pool.p.level, name: pool.p.name };
      const c = channel(x, y);
      if (c && c.d < c.half) return { kind: 'river', surface: c.surface, river: c.river, q: c.q };
      const id = lake.get(...lake.cellOf(x, y));
      if (id) {
        const lk = header.lakes[id - 1];
        if (lk.kind !== 'playa' && api.heightAt(x, y) < lk.level) return { kind: 'lake', surface: lk.level, lake: id };
      }
      return null;
    },
    /** A world pixel's WOODS byte (the kernel's and the far rings' read), or undefined off the region. */
    byteAt(px, py) { return inside(px, py) ? bake.bytes[(py - rect.y) * rect.w + px - rect.x] : undefined; },
    /** A world pixel's Daggerfall climate byte, or undefined off the region. */
    climateAt(px, py) { return inside(px, py) ? bake.climates[(py - rect.y) * rect.w + px - rect.x] : undefined; },
    /** Every plane's value at a world point (the nearest cell's), for the plants, the towns and the editor. */
    env(x, y) {
      const [i, j] = elev.cellOf(x, y), out = {};
      for (const k of Object.keys(fields)) out[k] = fields[k].get(i, j);
      return out;
    },
    channel,
    /** Metres from a world point to the nearest open water within `reach` (a channel's edge, a pool, a lake's cell), or
     *  Infinity. @param {number} x @param {number} y @param {number} reach */
    waterNear(x, y, reach) {
      if (poolAt(x, y) || lake.get(...lake.cellOf(x, y))) return 0;
      for (const p of pools) { const d = Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y)) * PIXEL_M - POOL_PX * PIXEL_M; if (d < reach) return Math.max(0, d); }
      const list = index.get(worldPixelKey(Math.floor(x), Math.floor(y)));
      let best = Infinity;
      for (const s of list ?? []) {
        const sg = segs[s], vx = sg.bx - sg.ax, vy = sg.by - sg.ay, l2 = vx * vx + vy * vy;
        let t = l2 > 0 ? ((x - sg.ax) * vx + (y - sg.ay) * vy) / l2 : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const dx = x - (sg.ax + vx * t), dy = y - (sg.ay + vy * t), d = Math.sqrt(dx * dx + dy * dy) * PIXEL_M - (sg.aw + (sg.bw - sg.aw) * t) / 2;
        if (d < best) best = Math.max(0, d);
      }
      return best < reach ? best : Infinity;
    },
    /** The slope (rise over run) at a world point, from the bake's land. @param {number} x @param {number} y */
    slopeAt(x, y) {
      const e = 0.5 / header.res, gx = (elev.cubicAt(x + e, y) - elev.cubicAt(x - e, y)) / (2 * e * PIXEL_M), gy = (elev.cubicAt(x, y + e) - elev.cubicAt(x, y - e)) / (2 * e * PIXEL_M);
      return Math.sqrt(gx * gx + gy * gy);
    },
  };
  return api;
}
/** A river's banks past its channel, metres. @param {number} w */
const bankOf = (w) => Math.max(8, 1.5 * w);
/** @typedef {ReturnType<typeof regionSampler>} RegionSampler */
