// WG2 THE BAKE'S BYTES (bible/03-World/World-2-Canon.md, "The bake file"): `WG2B`, a little-endian header length,
// the header as JSON (the spec, the versions, the vector water and the sites) and the planes, each a typed array of
// the region's grid quantised to a fixed step. A runtime module: the terrain worker decodes it. The same bake encodes
// to the same bytes on every machine, and its print (FNV-1a of them) is what the manifest pins.
import { Field } from './field.js';
import { fnv1a } from '../../formats/fnv1a.js';
import { riverCourse } from './riverLaw.js';

export const BAKE_FORMAT = 1;
const MAGIC = 0x42324757;   // 'WG2B'

/** Each plane: its field, its store and the step a stored unit stands for (a value is round(v / step)); a `root` plane
 *  stores its square root, so a trickle and a great river both keep their digits. */
export const PLANES = Object.freeze([
  { name: 'elev', type: 'i16', step: 0.2 },
  { name: 'rock', type: 'u8', step: 1 },
  { name: 'soil', type: 'u8', step: 1 },
  { name: 'soilDepth', type: 'u8', step: 0.05 },
  { name: 'fertility', type: 'u8', step: 1 / 255 },
  { name: 'moisture', type: 'u8', step: 1 / 255 },
  { name: 'biome', type: 'u8', step: 1 },
  { name: 'water', type: 'u8', step: 1 },
  { name: 'lake', type: 'u16', step: 1 },
  { name: 'discharge', type: 'u16', step: 0.01, root: true },
  { name: 'table', type: 'u8', step: 0.5 },
  { name: 'temp', type: 'i16', step: 0.1 },
  { name: 'precip', type: 'u16', step: 1 },
  { name: 'humidity', type: 'u8', step: 1 / 255 },
  { name: 'exposure', type: 'u8', step: 1 / 255 },
  { name: 'solar', type: 'u8', step: 1 / 170 },
  { name: 'season', type: 'u8', step: 0.25 },
  { name: 'theatre', type: 'u8', step: 1 },
]);
const ARRAY = { i16: Int16Array, u8: Uint8Array, u16: Uint16Array };
const LIMIT = { i16: [-32768, 32767], u8: [0, 255], u16: [0, 65535] };
const q = (v, d) => Math.round(v * d) / d;

/** The bake as bytes. @param {ReturnType<import('./regionBake.js').bakeRegion>} bake @returns {Uint8Array} */
export function encodeBake(bake) {
  const { spec } = bake, w = spec.rect.w * spec.res, h = spec.rect.h * spec.res;
  const header = {
    format: BAKE_FORMAT, id: spec.id, rect: spec.rect, res: spec.res, seed: spec.seed, fit: spec.fit, generator: bake.generator, stages: bake.stages,
    ...(spec.tiling ? { tiling: spec.tiling, blend: spec.blend, core: spec.core } : {}),
    canon: bake.canon ?? null, planes: PLANES.map((p) => p.name),
    rivers: bake.rivers.map((r) => ({ id: r.id, order: r.order, into: r.into, raw: r.raw.map((p) => [q(p.x, 1024), q(p.y, 1024), q(p.q, 1000), q(p.s, 100)]) })),
    lakes: bake.lakes.map((l) => ({ id: l.id, kind: l.kind, level: q(l.level, 100), cells: l.cells, x: q(l.x, 64), y: q(l.y, 64), inflow: q(l.inflow, 1000) })),
    falls: bake.falls.map((f) => ({ x: q(f.x, 64), y: q(f.y, 64), drop: q(f.drop, 10), kind: f.kind })),
    springs: bake.springs, resources: bake.resources, edits: bake.edits ?? null, towns: bake.towns ?? [],
    roads: (bake.roads ?? []).map((r) => ({ width: r.width, pts: r.pts.map((p) => [q(p[0], 1024), q(p[1], 1024), q(p[2], 100)]) })),
  };
  const text = new TextEncoder().encode(JSON.stringify(header)), pad = (4 - ((8 + text.length) % 4)) % 4;
  const sizes = PLANES.map((p) => w * h * ARRAY[p.type].BYTES_PER_ELEMENT);
  const pixels = spec.rect.w * spec.rect.h;
  const total = 8 + text.length + pad + sizes.reduce((a, b) => a + b, 0) + 2 * pixels;
  const out = new Uint8Array(total), view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true); view.setUint32(4, text.length, true);
  out.set(text, 8);
  let at = 8 + text.length + pad;
  PLANES.forEach((p, i) => {
    const src = bake.fields[p.name].data, arr = new ARRAY[p.type](w * h);
    for (let k = 0; k < w * h; k++) {
      const v = Math.round((p.root ? Math.sqrt(Math.max(0, src[k])) : src[k]) / p.step), [lo, hi] = LIMIT[p.type];
      arr[k] = v < lo ? lo : v > hi ? hi : v;
    }
    out.set(new Uint8Array(arr.buffer), at);
    at += sizes[i];
  });
  out.set(bake.bytes, at); at += pixels;
  out.set(bake.climates, at);
  return out;
}

/** @typedef {{ header: any, fields: Record<string, Field>, bytes: Uint8Array, climates: Uint8Array, print: string }} DecodedBake */

/** A bake from its bytes: the header and every plane as a Field of real values (Float32 for the measures, the ids as
 *  stored). Throws on a file that is not a bake of this format. @param {Uint8Array} bytes @returns {DecodedBake} */
export function decodeBake(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('wg2: not a bake');
  const len = view.getUint32(4, true), header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + len)));
  if (header.format !== BAKE_FORMAT) throw new Error(`wg2: bake format ${header.format}`);
  const w = header.rect.w * header.res, h = header.rect.h * header.res, frame = { x0: header.rect.x, y0: header.rect.y, res: header.res };
  let at = 8 + len + ((4 - ((8 + len) % 4)) % 4);
  /** @type {Record<string, Field>} */
  const fields = {};
  for (const p of PLANES) {
    const Arr = ARRAY[p.type], n = w * h, raw = new Arr(bytes.buffer.slice(bytes.byteOffset + at, bytes.byteOffset + at + n * Arr.BYTES_PER_ELEMENT));
    at += n * Arr.BYTES_PER_ELEMENT;
    if (p.step === 1) { const f = new Field(w, h, frame, /** @type {any} */ (Arr)); f.data.set(/** @type {any} */ (raw)); fields[p.name] = f; continue; }
    const f = new Field(w, h, frame, Float32Array);
    for (let k = 0; k < n; k++) { const v = raw[k] * p.step; f.data[k] = p.root ? v * v : v; }
    fields[p.name] = f;
  }
  const pixels = header.rect.w * header.rect.h;
  // the rivers' courses made again from their cells (hydrology.js riverCourse): [x, y, q, s, w, d] a point
  for (const r of header.rivers) r.pts = riverCourse(r.raw.map(([x, y, qq, s]) => ({ x, y, q: qq, s }))).map((p) => [p.x, p.y, p.q, p.s, p.w, p.d]);
  const out = { header, fields, bytes: bytes.slice(at, at + pixels), climates: bytes.slice(at + pixels, at + 2 * pixels), print: bakePrint(bytes) };
  return out;
}

/** The bake's print: FNV-1a of its bytes, hex. @param {Uint8Array} bytes */
export const bakePrint = (bytes) => fnv1a(bytes).toString(16).padStart(8, '0');
