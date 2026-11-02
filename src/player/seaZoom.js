// @ts-check
// FIELD BUGS 2026-09-29 (the sea) #3 (the Discord, through Mac: "You should be able to scroll and zoom out farther"):
// THE ZOOM AT A HELM. Both third-person cameras stop where their references stop them on foot - the Morrowind
// camera's maxDistance, 800 units (11.4 m, settings.lua:43), and Eye of the Beholder's -10 (IL_12f0) - and a ship is
// 44 to 93 m long: from her wheel the wheel could not frame her. At a helm the zoom reaches out to frame the hull
// sailed - SEA_ZOOM_REACH of her largest half-extent, her mesh's own bounds (a Small Ship 66 m, the galley 140 m) - and
// past the foot's own far end each notch is a ratio (SEA_ZOOM_RATIO), so that reach is a dozen notches, never the
// hundreds the foot's own step would take. On foot, and in a boat no bigger than the foot's reach, nothing changes.
// A departure from both references, recorded in the Port-Ledger. The one home both cameras read.

/** How far a helm's zoom reaches, in the sailed hull's largest half-extents - one and a half of her lengths. */
export const SEA_ZOOM_REACH = 3;
/** At a helm one notch out multiplies the distance by this (in: divides). HELM-ZOOM (2026-09-30, Mac: "increase the
 *  sensitivity of the scrolling for zooming out and in when on the wheel"): 1.5, and the Morrowind camera's whole range
 *  at a helm by it (mwCamera.js) - 1.2 past the foot's far end alone left sixty ten-unit notches from its base to it. */
export const SEA_ZOOM_RATIO = 1.5;

/** The zoom's reach at a helm (m) for a hull of that largest half-extent (m); 0 for none. */
export function seaZoomReach(halfExtent) {
  return Number.isFinite(halfExtent) && halfExtent > 0 ? halfExtent * SEA_ZOOM_REACH : 0;
}

/**
 * One notch past the foot's far end: the distance out (`clicks` < 0) or in (> 0) by the ratio, within [footFar, far].
 * Signs as both cameras read a click: positive toward the body.
 */
export function seaZoomStep(distance, clicks, footFar, far) {
  const d = distance * SEA_ZOOM_RATIO ** -clicks;
  return Math.min(far, Math.max(footFar, d));
}
