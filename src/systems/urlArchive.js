// URL-BACKED ARCHIVES: the {has, get, load, loaded} duck the Morrowind
// layer speaks, over files that ship WITH THE BUILD instead of coming
// out of a player's .bsa.
//
// FIELD-GUN-MW2 (2026-09-20): MOVED HERE FROM `weaponSheathing.js`,
// body unchanged, and re-exported from there so that not one caller
// had to move. It was written for WS1's seventy-one vendored scabbards
// and now also carries the port's OWN Morrowind assets
// (`systems/ownMwAssets.js`) - and the second caller is the whole
// reason: "twice is a law" is this project's own rule, and a generic
// archive living inside one vendored mod's module is a home that only
// looks like one until something else needs it.
//
// Pure: URLs in, bytes out through the `fetchBytes` it is handed, so
// node drives it with no network and no window.

/** A `{ has, get, load, loaded, names }` archive over a table of URLs:
 *  `urls` maps each canonical data-files path (`meshes/w/x_sh.nif`,
 *  `textures/thunderlock.dds`) to its URL, or to a function answering
 *  one; `fetchBytes(url)` brings the bytes. Pure and node-testable. */
export function makeVendoredArchive(urls, fetchBytes) {
  const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const table = new Map(Object.entries(urls).map(([k, v]) => [norm(k), v]));
  const bytes = new Map();
  const inflight = new Map();
  return {
    vendored: true,
    names: [...table.keys()],
    has: (p) => table.has(norm(p)),
    loaded: (p) => bytes.has(norm(p)),
    get: (p) => bytes.get(norm(p)) ?? null,
    load: async (p) => {
      const key = norm(p);
      if (bytes.has(key)) return bytes.get(key);
      if (!table.has(key)) return null;
      if (!inflight.has(key)) {
        // AUDIT 68 X7-urlarchive-poisoned-inflight: the slot empties on EITHER outcome - kept on a rejection, one
        // network blip answered every later load of that path with the same failure for the life of the page
        inflight.set(key, (async () => {
          const entry = table.get(key);
          const url = typeof entry === 'function' ? await entry() : entry;   // AUDIT-WS: the eager table hands URLs, a lazy one loaders
          const b = await fetchBytes(url);
          bytes.set(key, b);
          return b;
        })().finally(() => inflight.delete(key)));
      }
      return inflight.get(key);
    },
  };
}

/** The `fetchBytes` the shipped archives hand `makeVendoredArchive`: a
 *  URL's bytes, and a refusal for an HTTP error. AUDIT 68
 *  X7-urlarchive-poisoned-inflight: both archives kept a copy that read
 *  any body, so a 404 page was cached as the mesh. */
export async function fetchUrlBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
