// @ts-check
// WG2 (bible/03-World/World-2-Canon.md, "The seam"): THE PUBLISHED REGIONS' BAKES for the streamed world - the
// manifest's published list (world/gen2/worldManifest.json), and with `?wg2=<id>` a prototype region a developer walks
// (world/gen2/testRegions.js). Fetched once and opened (each is gzipped); the host hands them to terrainGen.setTamriel,
// which installs them on every thread. A bake that fails to load is told once and left out: the world's own ground
// stands there.
import { worldManifest } from '../world/gen2/manifest.js';
import { testRegion } from '../world/gen2/testRegions.js';
import { APP_ROOT } from '../systems/appRoot.js';
import { pageParam } from '../systems/pageQuery.js';   // PERF-URL: the one parse of the page's query

/** A bake's address under the app's root (systems/appRoot.js): the page is /play/, the bakes are served from the root.
 *  @param {string} file */
export const bakeUrl = (file) => new URL(`worldgen2/${file}.gz`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** @type {Promise<Uint8Array[]>|null} */
let _bakes = null;

/** The bakes this world stands: the published ones and any `?wg2=` names. @param {string} [search] the page's query */
export function gen2Bakes(search = globalThis.location?.search ?? '') {
  return (_bakes ??= loadAll(search));
}

/** The files to load: the manifest's published bakes and the asked test regions'. @param {string} search */
export function gen2Files(search) {
  const files = worldManifest().published.map((r) => r.bake);
  for (const id of (pageParam('wg2', search) ?? '').split(',').filter(Boolean)) if (testRegion(id)) files.push(`${id}.wg2`);
  return [...new Set(files)];
}

async function loadAll(search) {
  const out = [];
  for (const file of gen2Files(search)) {
    try {
      const res = await fetch(bakeUrl(file)), type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html')) throw new Error(`HTTP ${res.status} ${type}`);   // an SPA fallback's page is no bake
      out.push(await gunzipped(new Uint8Array(await res.arrayBuffer())));
    } catch (e) { console.warn(`[wg2] ${file} did not load; the world's own ground stands there:`, /** @type {Error} */ (e)?.message ?? e); }
  }
  return out;
}

/** A bake's bytes opened if they are still gzipped (a server may have opened them already on the way).
 *  @param {Uint8Array} bytes */
export async function gunzipped(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (bytes))]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
