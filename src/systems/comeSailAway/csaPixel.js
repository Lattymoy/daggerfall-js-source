// @ts-check
// NO-PIXEL (FIELD BUGS 2026-10-29d, a departure, Port-Ledger A): a boat with no map pixel. The C# throws reading one
// (GetMapPixelFromTerrain's null, or a record saved so), and in a door's OnTransition that left the indoors' none on the
// sea. She takes the pixel she stands on, off the player's terrain. AUDIT FB1029d A1: indoors or with no terrain the
// player's pixel answers that read alone and is never kept, so an inn's load cannot pin her to the inn for good.

/** The map pixel under scene point `p`, off terrain `t0`'s own (`edge` its side, the mod's terrainEdge): map x grows with
 *  the scene's x, map y against its z.
 *  @param {{ mapPixelX: number, mapPixelY: number, position: ArrayLike<number> }} t0 @param {ArrayLike<number>} p @param {number} edge */
export const pixelUnderOn = (t0, p, edge) => ({
  X: t0.mapPixelX + Math.floor((p[0] - t0.position[0]) / edge),
  Y: t0.mapPixelY - Math.floor((p[2] - t0.position[2]) / edge),
});

/**
 * A boat's map pixel: her own, else the one under her off the player's terrain (kept on her), else - indoors, a dungeon's
 * boat, no terrain built - the player's, for this read alone.
 * @param {any} boat
 * @param {{ isPlayerInside: () => boolean, playerTerrain?: () => any, currentMapPixel: () => { X: number, Y: number } }} deps
 * @param {number} edge - the terrain's side (the mod's terrainEdge)
 */
export function boatPixel(boat, deps, edge) {
  if (boat.MapPixel != null) return boat.MapPixel;
  const t0 = boat.inside || deps.isPlayerInside() ? null : deps.playerTerrain?.();
  if (t0 == null) return deps.currentMapPixel();
  return (boat.MapPixel = pixelUnderOn(t0, boat.GameObject.position, edge));
}
