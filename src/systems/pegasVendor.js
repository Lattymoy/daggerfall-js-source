// ═══════════════════════════════════════════════════════════════════
// MW-D50 — THE VENDORED HORSE. Pegas Horse Ranch (MADMAX and Team,
// 2004; horse model by Cait) is carried VERBATIM under
// vendor/pegas-horse/ with the author's written consent (Mac,
// 2026-09-03; the vendor README records it), so the enhanced ride has
// its horse out of the box the way the roads have Hazelnut's network
// and the mills have Kamer's sails.
//
// WHY A LOADER AND NOT A BAKE: the mills bake because a COLLADA parser
// at runtime would be a second mesh path. The horse is the opposite
// case - the port ALREADY parses .nif/.kf/.dds at runtime for every
// Morrowind feature, and pegasHorse.js resolves everything through
// the one {has, get} archives seam. So the vendored tree is served as
// what it is, the mod's own files, and arrives as one loose archive
// that the assembly cannot tell from the player's own attach. Nothing
// is transformed, which is also what the readme's "kept original and
// intact" asks.
//
// THIS MODULE IS THE ONLY PLACE THAT KNOWS THE FILES ARE VENDORED.
// The glob below is Vite's, resolved at build time into per-file URL
// importers (the roads take the same road with `new URL(...)` for
// their four fixed names; the horse's set is a tree, hence the glob).
// The pure half - which paths one variant needs, the coat read out of
// the mesh, the archive - lives in pegasHorse.js and is node-tested;
// this file is host-only, and mwd50_vendoredhorse.test.js pins its
// text rather than importing it.
//
// LAZY, ONCE, NEVER THROWS. Nothing is fetched until the first horse
// is mounted in the enhanced skin (world.js's one transport door), one
// variant's files only (about 2 MB for the mesh, the clips, the coat
// and the four sounds - never the tree), cached for the session, and
// a failure answers null so the classic sprite rides.
// ═══════════════════════════════════════════════════════════════════

import { assembleVendoredArchive } from './pegasHorse.js';

const PREFIX = '../../vendor/pegas-horse/';
const assets = import.meta.glob('../../vendor/pegas-horse/**/*.{nif,kf,dds,tga,wav}', { query: '?url', import: 'default' });
const manifest = Object.keys(assets).map((k) => k.slice(PREFIX.length));

/** The canonical loose paths the vendor tree carries (the vendoring
 *  script writes them lowercased in the data-files frame, so they are
 *  already the keys the MW stack asks by). Empty = no horse vendored. */
export const vendoredPegasPaths = () => manifest.slice();

async function fetchBytes(path) {
  const load = assets[PREFIX + path];
  if (!load) return null;
  const res = await fetch(await load());
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const cache = new Map();   // variant -> Promise<archive|null>

/** The vendored set for one coat variant as a loose archive, or null
 *  when the tree carries no horse (or the fetch failed). Once per
 *  variant per session. */
export function loadVendoredPegas({ variant = 1 } = {}) {
  if (!cache.has(variant)) {
    cache.set(variant, assembleVendoredArchive({ manifest, fetchBytes, variant })
      .catch((err) => { console.warn('[pegas] vendored set unavailable; the sprite rides:', err?.message); return null; }));
  }
  return cache.get(variant);
}
