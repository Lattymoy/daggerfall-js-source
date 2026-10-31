// WG2 PHASE 0 (bible/01-Overview/audits/Audit-World-2-Phase-0.md): THE BASELINES World 2.0 is held against - what a
// bake costs offline, what a published region costs the ground's hot reads on the client (tamrielHeightByte uncached,
// the shaper's gen2Units, the sampler's heightAt), with none installed and with one. `node tools/wg2Measure.mjs`.
// A measurement, not a pin: the numbers move with the machine.
import { isMain } from './lib/isMain.mjs';
import { readBake, BAKE_DIR } from './wg2Bake.mjs';
import { decodeBake } from '../src/world/gen2/bakeCodec.js';
import { regionSampler } from '../src/world/gen2/regionSampler.js';
import { gen2Install, gen2Units } from '../src/world/gen2/gen2Ground.js';
import { worldManifest } from '../src/world/gen2/manifest.js';
import { tamrielHeightByte, dropGroundCache } from '../src/world/tamriel/tamrielGround.js';
import { setTamrielFit } from '../src/world/tamriel/tamrielFrame.js';

/** Nanoseconds a call of `f` over `n` points of a rectangle. */
function perCall(f, r, n = 200000) {
  const t0 = process.hrtime.bigint();
  let s = 0;
  for (let i = 0; i < n; i++) s += f(r.x + ((i * 7919) % (r.w * 64)) / 64, r.y + ((i * 104729) % (r.h * 64)) / 64) || 0;
  return { ns: Number(process.hrtime.bigint() - t0) / n, s };
}

export function measure() {
  const fit = worldManifest().fit, out = [];
  setTamrielFit(fit);
  for (const id of ['hammerfell-test', 'blackmarsh-test']) {
    const raw = readBake(`${BAKE_DIR}/${id}.wg2.gz`), t0 = Date.now(), d = decodeBake(raw), decodeMs = Date.now() - t0, S = regionSampler(d), R = d.header.rect;
    const byte = (x, y) => { dropGroundCache(); return tamrielHeightByte(Math.floor(x), Math.floor(y)); };
    gen2Install([], fit);
    const none = perCall(byte, R, 20000).ns, unitsNone = perCall((x, y) => gen2Units(x, y, 0) ?? 0, R).ns;
    gen2Install([raw], fit);
    const withRegion = perCall(byte, R, 20000).ns, units = perCall((x, y) => gen2Units(x, y, 0), R).ns, height = perCall(S.heightAt, R).ns;
    gen2Install([], fit);
    out.push({ id, cells: d.fields.elev.data.length, bytes: raw.length, decodeMs, byteNone: Math.round(none), byteWith: Math.round(withRegion), unitsNone: Math.round(unitsNone), units: Math.round(units), heightAt: Math.round(height) });
  }
  return out;
}

if (isMain(import.meta.url)) console.table(measure());
