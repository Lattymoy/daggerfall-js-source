// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW7 (2026-10-25, the owner: "We also need to fully integrate our living world into the entirety of tamriel";
// bible/03-World/World-Wide.md WW7) - THE TOWNS BY MAP ID: a trader's town, a resident's, a vendor's waypoint, the town
// economy's - named and found. The host's own table holds the Bay's (MAPS.BSA's rows, walked once at the boot:
// HOME-VENDOR, TOWN-ECON); a map id it does not hold is asked of the world's registry (world/worldWide/worldPlaces.js -
// TESA's places past the Bay, WW7), so a vendor of Solitude or a resident of an Arena town is named as a Bay one is.
// The registry's place answers in the table's own shape ({ name, px, py, region, type }; no MAPS `location` index).
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {{ name: string, px: number, py: number, region: number, type: number, location?: number }} TownRow
 * @param {() => ({ byMapId: (mapId: number) => any } | null | undefined)} places the registry, read at each ask (the host
 *   makes it after this table)
 */
export function createTownTable(places) {
  /** @type {Map<number, TownRow>} */
  const own = new Map();
  return {
    /** @param {number} mapId @param {TownRow} row */
    set(mapId, row) {
      own.set(mapId >>> 0, row);
      return this;
    },
    /** @param {number} mapId @returns {TownRow|undefined} */
    get(mapId) {
      const id = Number(mapId) >>> 0,
        row = own.get(id);
      if (row) return row;
      const p = places()?.byMapId(id);
      return p
        ? {
            name: p.name,
            px: p.px,
            py: p.py,
            region: p.region,
            type: p.type,
            ...(p.location != null ? { location: p.location } : {}),
          }
        : undefined; // WW7-5: its location's index, the town economy's report's
    },
    /** @param {number} mapId */
    has(mapId) {
      return this.get(mapId) !== undefined;
    },
    get size() {
      return own.size;
    },
  };
}
