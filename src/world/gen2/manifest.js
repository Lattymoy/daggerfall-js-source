// @ts-check
// WG2 THE WORLD MANIFEST (bible/03-World/World-2-Canon.md, "The manifest"; WG-5): which world this is - its seed,
// the versions of the geography, the generator, the environment's tables, the authored edits and the settlements, the
// fit the bakes were made on - and which regions are published. Every gameplay ground a published region changes is
// bound to the online ground law: `groundPrints` holds the published set's print under each GROUND_LAW, and a pin
// fails a set that moved without the law (so an older build is turned away by the relay's ground gate, not let in).
import MANIFEST from './worldManifest.json' with { type: 'json' };
import { fnv1a } from '../../formats/fnv1a.js';

/** The generators whose bakes this build can read (the newest last). A published region names one. */
export const GENERATORS = Object.freeze(['wg2-1']);
/** The band past the Bay's edge whose ground is the Bay's (tamrielGround.js SEAM_PX + BLEND_PX), world pixels. */
export const BAY_REACH = 14;
const VERSION = /^[a-z]+\d*-\d+$/;

/** @typedef {{ id: string, rect: { x: number, y: number, w: number, h: number }, bake: string, print: string, generator: string,
 *   revision: number, migration?: { by: string, quote: string, date: string } }} PublishedRegion */
/** @typedef {typeof MANIFEST & { published: PublishedRegion[] }} Manifest */

/** The game's manifest. @returns {Manifest} */
export const worldManifest = () => /** @type {Manifest} */ (MANIFEST);

/** A manifest's problems, as words; none for a good one. @param {any} m */
export function manifestProblems(m) {
  const out = [];
  if (!m || typeof m !== 'object') return ['not a manifest'];
  if (typeof m.worldId !== 'string' || !m.worldId) out.push('worldId');
  if (m.schemaVersion !== 2) out.push('schemaVersion');
  for (const k of ['geographyVersion', 'generatorVersion', 'environmentVersion', 'authoredRevision', 'settlementRevision']) if (!VERSION.test(m[k] ?? '')) out.push(k);
  if (!GENERATORS.includes(m.generatorVersion)) out.push('generatorVersion unknown');
  if (!(Number.isSafeInteger(m.worldSeed) && m.worldSeed >= 0 && m.worldSeed < 4294967296)) out.push('worldSeed');
  if (!(m.fit && Number.isFinite(m.fit.ox) && Number.isFinite(m.fit.oy) && m.fit.ppu > 0)) out.push('fit');
  if (!Number.isSafeInteger(m.groundLaw)) out.push('groundLaw');
  const pub = Array.isArray(m.published) ? m.published : (out.push('published'), []);
  pub.forEach((r, i) => {
    const at = `published ${r?.id ?? i}`, R = r?.rect;
    if (!/^[a-z0-9-]+$/.test(r?.id ?? '')) out.push(`${at}: id`);
    if (!(R && [R.x, R.y, R.w, R.h].every(Number.isSafeInteger) && R.w > 0 && R.h > 0 && Math.abs(R.x) < 8192 && Math.abs(R.y) < 8192 && Math.abs(R.x + R.w) < 8192 && Math.abs(R.y + R.h) < 8192)) out.push(`${at}: rect`);
    else if (touchesBay(R) && !migrationOk(r.migration)) out.push(`${at}: bay`);
    if (!/^[0-9a-f]{8}$/.test(r?.print ?? '')) out.push(`${at}: print`);
    if (!GENERATORS.includes(r?.generator)) out.push(`${at}: generator`);
    if (!(Number.isSafeInteger(r?.revision) && r.revision >= 1)) out.push(`${at}: revision`);
    if (typeof r?.bake !== 'string' || !/^[a-z0-9-]+\.wg2$/.test(r.bake)) out.push(`${at}: bake`);
    pub.slice(0, i).forEach((o) => { if (o?.rect && R && overlap(o.rect, R)) out.push(`${at}: overlaps ${o.id}`); });
  });
  return out;
}
/** Does a rectangle reach the Bay or the band past its edge where the ground is the Bay's? */
export function touchesBay(R) {
  // BAY-OWN: the Bay's own 1000 x 500 and its seam band - the one ground World 2.0 does not replace without a migration
  return R.x < 1000 + BAY_REACH && R.y < 500 + BAY_REACH && R.x + R.w > -BAY_REACH && R.y + R.h > -BAY_REACH;
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** A migration over the Bay's ground is the owner's word, quoted and dated (Phase 6: never the default). */
const migrationOk = (g) => !!g && typeof g.by === 'string' && g.by.length > 0 && typeof g.quote === 'string' && g.quote.length > 8 && /^\d{4}-\d{2}-\d{2}$/.test(g.date ?? '');

/** A JSON text with every object's keys sorted, so equal data prints alike. @param {any} v */
export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const print = (s) => fnv1a(new TextEncoder().encode(s)).toString(16).padStart(8, '0');
/** The manifest's whole print. @param {Manifest} m */
export const manifestPrint = (m) => print(canonicalJson(m));
/** The print of what a manifest makes of the gameplay ground: '' with nothing published. @param {Manifest} m */
export function groundPrint(m) {
  if (!m.published.length) return '';
  const set = m.published.map((r) => ({ id: r.id, rect: r.rect, print: r.print, generator: r.generator })).sort((a, b) => (a.id < b.id ? -1 : 1));
  return print(canonicalJson({ seed: m.worldSeed, fit: m.fit, set }));
}

/**
 * May a client on `local` share a world with `remote`? Same world, same schema, and the same published ground; a
 * generator the client cannot read is refused. Answers the reasons it may not (none: it may).
 * @param {Manifest} local @param {Manifest} remote
 */
export function manifestRefuses(local, remote) {
  const out = [];
  if (local.worldId !== remote.worldId) out.push('world');
  if (local.schemaVersion !== remote.schemaVersion) out.push('schema');
  if (groundPrint(local) !== groundPrint(remote)) out.push('ground');
  for (const r of remote.published) if (!GENERATORS.includes(r.generator)) out.push(`generator ${r.generator}`);
  return out;
}
