// @ts-check
// AUDIT FB1029f A1: A HOME'S ACCESS ROWS END WITH THE HOME. decor_access keys a row by its building and has no foreign
// key to homes, so a home deleted by a road that never cleared them (a character's delete, a deed given up) left them
// for whoever claimed the building next. A chest's or a station's row named a piece the next owner never had; the rest
// row (REST-GUEST, its id the home's) named the next owner's home. Every claim clears what no home holds first.

/** The building's access rows that no home row holds - in a claim's own batch, before the home's row is written. */
export const accessOrphansCleared = (
  /** @type {any} */ db,
  /** @type {number} */ mapId,
  /** @type {number} */ buildingKey,
) =>
  db
    .prepare(
      `DELETE FROM decor_access
    WHERE map_id = ?1 AND building_key = ?2 AND NOT EXISTS (SELECT 1 FROM homes WHERE map_id = ?1 AND building_key = ?2)`,
    )
    .bind(mapId, buildingKey);
