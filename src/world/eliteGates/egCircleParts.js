// @ts-check
// EG-H3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7 and 31, EG10):
// THE SWAP'S BUILD - everything a circle's made level is that costs time to make, made apart from the screen: its halls'
// mesh (world/eliteGates/egHall.js buildEgCircleModel - a whole circle runs 30-70 ms in one task, and its hall law's solver as long
// again), its floors and walls for the collider, its lamps and its Ramparts' portcullises. The breach's client asks for
// the next circle's while the Court rests (scenes/eliteGates/egClient.js), the build runs on a worker (world/eliteGates/egCircleWorker.js) so
// it never lands in a frame, and the step into the new circle only uploads it (scenes/worldModes.js egSwapCircle).
//
// Pure modules only (no ui/, scenes/, render/): a worker has no DOM. The same builders the mode machine's own stand uses,
// so a level built here is the level built there, byte for byte (test/world/eliteGates/egswap_client.test.js). Not a DFU member. Ledger A
// (ELITE-GATES).
import { buildEgCircleModel, egCircleColliderTris, egCircleLights, egGateParts } from './egHall.js';
import { egCircleSpecs, egSpecGive } from '../../net/eliteGates/egLaw.js';
import { egBandArt } from './egBandArt.js';
import { buildEgRuinParts } from './egRuin.js';   // EG-LOOK (Elite-Gates-Look.md section 3): THE RUIN, a mesh a hall
import { buildEgVista } from './egVista.js';   // EG-LOOK (section 4): THE WRECK, a band's

/** The circle a build is for: its breach's seed, its number and its ground (the span decrees' `geo`) - the mode
 *  machine's own key for the level it stands (scenes/worldModes.js standEgHall). */
export const egCircleKey = (seed, c, geo = 0) => `${seed >>> 0}:${c}:${geo || 0}`;
/** A circle's Ramparts' portcullises: `[{ h, model, tris }]`, one a hall that has one (world/eliteGates/egHall.js egGateParts). */
export function egCircleGates(seed, c, geo = 0) {
  const out = [];
  for (const spec of egCircleSpecs(seed, c, geo)) { const p = egGateParts(spec); if (p) out.push({ h: spec.h, model: p.model, tris: p.tris }); }
  return out;
}
/**
 * A CIRCLE'S MADE LEVEL, BUILT: `{ key, model, tris, lamps, gates }` - the halls' one mesh (renderer.createMesh's model),
 * the collider's triangles (the dungeon's frame), the lamps (the light list's shape) and the portcullises.
 * @param {number} seed @param {number} c @param {number} [geo]
 */
export function egCircleParts(seed, c, geo = 0) {
  return { key: egCircleKey(seed, c, geo), model: buildEgCircleModel(seed, c, geo), tris: egCircleColliderTris(seed, c, geo), lamps: egCircleLights(seed, c, geo), gates: egCircleGates(seed, c, geo) };
}
/**
 * AUDIT EG V (L6-8, L6-9; Elite-Gates.md section 7): WHAT THE SWAP'S WORKER BUILDS for a `{ seed, c, geo, band }` ask - the
 * circle's made level (egCircleParts), its five halls' specs as the hall law laid them (`specs` - the page takes them as
 * given, net/eliteGates/egLaw.js egSpecGive, and lays none again under the veil), and, when the page asks (`band` 0-3), that band's
 * dress painted (`art` - world/eliteGates/egBandArt.js egBandArt's `[record, { albedo, emission }]`, put up a record a frame of the
 * Court's rest - scenes/worldModes.js egPrebuild). AUDIT EG V (E NEW-2; section 22, THE LAW PIN): `given` - a breach of
 * another law's halls as its room gave them - taken as given first (net/eliteGates/egLaw.js egSpecGive), so the worker builds that
 * breach's own circle: its module holds no hall the page was given. Pure but for the halls given. EG-LOOK (Elite-Gates-
 * Look.md sections 3 and 4): and THE RUIN (`ruins` - world/eliteGates/egRuin.js, a mesh a hall) and, with the band's dress, THE WRECK
 * (`vista` - world/eliteGates/egVista.js), at the phones' tier when `lite`.
 * @param {{ seed: number, c: number, geo?: number, band?: number, given?: any[] | null, lite?: boolean }} m
 */
export function egCircleBuild(m) {
  for (const s of Array.isArray(m.given) ? m.given : []) egSpecGive(s);
  const geo = m.geo ?? 0, band = Number.isInteger(m.band) && m.band >= 0 && m.band <= 3 ? m.band : -1;
  const lite = !!m.lite;
  return { ...egCircleParts(m.seed, m.c, geo), specs: egCircleSpecs(m.seed, m.c, geo), art: band >= 0 ? egBandArt(band) : null, ruins: buildEgRuinParts(m.seed, m.c, geo, { lite }), vista: band >= 0 ? buildEgVista(band, { lite }) : null };
}
/** Every buffer a built circle carries - what its worker hands over rather than copies (AUDIT EG V L6-9: its band's
 *  dress's pixels too). */
export function egCirclePartsTransfers(parts) {
  const out = new Set();
  const take = (a) => { if (ArrayBuffer.isView(a) && a.buffer instanceof ArrayBuffer) out.add(a.buffer); };
  const model = (m) => { for (const v of Object.values(m ?? {})) take(v); };
  model(parts?.model); take(parts?.tris);
  for (const g of parts?.gates ?? []) { model(g.model); take(g.tris); }
  for (const [, art] of parts?.art ?? []) { take(art?.albedo?.colors); take(art?.emission?.colors); }
  for (const r of parts?.ruins ?? []) model(r.model);   // EG-LOOK: the ruin's meshes and the wreck's
  for (const w of parts?.vista?.wings ?? []) model(w.model);
  model(parts?.vista?.under?.model);
  return [...out];
}
