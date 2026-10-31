// FNV-1a 32 - a kept answer's fingerprint over the bytes it was worked out from (DW-A's coastline bake,
// world/deepWater/deepWatersBakeCache.js; FIRST-VISIT's kept answers, systems/firstVisit/firstVisitStore.js). A leaf of
// no imports, so a worker's graph and the boot's reach it for nothing.

/** FNV-1a 32 over bytes - the key's fingerprint, not a checksum anything trusts beyond "same archive". */
export function fnv1a(bytes, h = 0x811c9dc5) {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
