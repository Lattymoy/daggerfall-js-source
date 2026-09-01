// A2: THE NAMEPLATE COLLISION SOLVER - ExteriorAutomap.cs's
// ComputeNameplateOffsets (:1147-1377) with its helpers, ported over
// the ACTIVE code paths (MIT, Daggerfall Workshop; original author
// Nystul). DFU's right-aligned arms are dead there too -
// allowRightAlignedNameplates is hard false (:114) - so plates only
// ever displace VERTICALLY.
//
// THE CORNERS ARE AXIS-ALIGNED, AND THAT IS DFU'S BEHAVIOUR, NOT A
// SIMPLIFICATION. c2/S10 made the map really rotate, so the old note
// ("the port's keyed window never rotates the map") no longer applies -
// and the answer got BETTER, not worse. RotateBuildingNameplates
// (ExteriorAutomap.cs:370-386) does rotate the four stored corners by
// Quaternion.AngleAxis(-angle, Vector3.forward), but every rotate
// action calls UpdateAutomapView, which recomputes ALL FOUR corners
// axis-aligned from textLabel.Position (window :892-896) BEFORE
// ComputeNameplateOffsets ever reads them, and the drawn label is a
// screen-space TextLabel that never rotates either. The rotated
// corners are DEAD CODE in DFU: feeding them to this solver would be a
// DEPARTURE, so they are deliberately not ported.
//
// A plate is { x, y, w, h }: x = the LEFT edge (plates are
// left-aligned at their anchor, ResetRotationBuildingNameplates
// :388-401), y = the vertical CENTER, w/h post-scale. The answer is
// a parallel array of { offY, replaced } - replaced plates render as
// "*" (:1365-1376), DFU's own surrender for a spot it cannot clear.

import { RMB_DIMENSION } from '../formats/blocksFile.js';   // BlocksFile.RMBDimension - one home

/**
 * ROAD-C c2/S10 HALF B - THE ANCHOR, and it is the last real 1:1 gap
 * on this surface. DFU walks EVERY building of EVERY block and anchors
 * each plate on the building subrecord's OWN position
 * (ExteriorAutomap.cs:664-665):
 *
 *   xPosBuilding = layout.rect.xpos + (int)(Position.x / (RMBDimension * GlobalScale) * blockSizeWidth)
 *   yPosBuilding = layout.rect.ypos + (int)(Position.z / (RMBDimension * GlobalScale) * blockSizeHeight)
 *
 * layout.rect.xpos/ypos are the block's grid cell x64 (:1441-1451), and
 * BuildingSummary.Position is `(XPos, 0, RMBDimension - ZPos) *
 * GlobalScale` (RMBLayout.cs:570), so the divisor cancels the scale
 * back out and the fraction is the subrecord's place inside its own
 * block. The cast is C#'s `(int)` - TRUNCATION toward zero, not a
 * floor - and it is reproduced.
 *
 * The port used to anchor on the discovered exterior DOOR, because
 * nothing enumerated buildings without one. It does now
 * (world/buildingSummaries.js), so the substitution retires: this move
 * shifts EVERY plate in EVERY town, and the layout pins were
 * re-baselined with it.
 *
 * The answer is in DFU's layout-pixel space: x east, y NORTH (the
 * texture's own bottom-up rows), origin at the layout's south-west
 * corner. The window subtracts half the layout to reach world.
 */
export const NAMEPLATE_BLOCK_PX = 64;            // blockSizeWidth/Height
export function nameplateAnchor(blockX, blockY, position, globalScale = 0.025) {
  const div = RMB_DIMENSION * globalScale;
  return [
    blockX * NAMEPLATE_BLOCK_PX + Math.trunc((position[0] / div) * NAMEPLATE_BLOCK_PX),
    blockY * NAMEPLATE_BLOCK_PX + Math.trunc((position[2] / div) * NAMEPLATE_BLOCK_PX),
  ];
}

/** The intersect predicate (CheckIntersectionOfNameplates,
 *  :993-1010): vertical overlap within the summed half-heights AND
 *  horizontal distance inside the LEFTMOST plate's width. */
export function nameplatesIntersect(a, b) {
  const dy = Math.abs((a.y + a.offY) - (b.y + b.offY));
  const ySize = a.h / 2 + b.h / 2;
  const xSize = (a.x <= b.x ? a : b).w;   // width of whichever is leftmost (:998-1003)
  return dy < ySize && Math.abs(a.x - b.x) < xSize;
}

/** Displacement directions: away from the pair's vertical midpoint,
 *  defaulting to up/down when coincident (:1012-1022). "Up" is
 *  whatever +1 means in the caller's y - the law only needs the two
 *  to part. */
const dirsOf = (a, b) => {
  const ya = a.y + a.offY, yb = b.y + b.offY;
  if (ya === yb) return [1, -1];
  const s = Math.sign(ya - yb);
  return [s, -s];
};

const countAll = (plates) => {
  for (const p of plates) p.count = 0;
  for (let i = 0; i < plates.length; i++) {
    for (let j = i + 1; j < plates.length; j++) {
      if (nameplatesIntersect(plates[i], plates[j])) { plates[i].count++; plates[j].count++; }
    }
  }
};

/** A candidate offset is legal when it clears every already-PLACED
 *  plate, the partner excepted - DFU checks exactly that set in the
 *  pair arms (:1201-1305). */
const clearOfPlaced = (p, tryOff, plates, skip) => {
  const probe = { x: p.x, y: p.y, w: p.w, h: p.h, offY: p.offY + tryOff };
  return plates.every((q) => q === p || q === skip || !q.placed || !nameplatesIntersect(probe, q));
};

/**
 * The solver: 3 outer iterations (:1149); each places the
 * zero-collision plates, untangles 1-vs-1 pairs (both half-shifted
 * by (ySize - |dy|)/2, or one alone by the full bias), shoves a
 * plate off a multiply-entangled collider by a full ySize, and
 * last-resorts a whole-height hop. Anything still standing after
 * the final pass is placed as a "*" (:1362-1376).
 */
export function resolveNameplates(input) {
  const plates = input.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, offY: 0, placed: false, count: 0, replaced: false }));
  for (let iter = 0; iter < 3; iter++) {
    if (iter === 0) countAll(plates);   // recompute on the FIRST iteration only (:1105-1121)
    for (const p of plates) if (!p.placed && p.count === 0) p.placed = true;
    for (const p of plates) {
      if (p.placed || p.count !== 1) continue;
      const q = plates.find((o) => o !== p && !o.placed && nameplatesIntersect(p, o));
      // AUDIT 39 F134: the search MISS is a placement, not a skip
      // (:1179-1184) - `if (j >= buildingNameplates.Length) { first.
      // numCollisionsDetected = 0; first.placed = true; continue; }`.
      // The state is reachable: countAll counts every plate while this
      // search takes only UNPLACED ones, so a count-1 plate whose sole
      // collider was placed mid-pass lands here. Skipped, it fell to
      // the ±h hop and then to the "*" surrender F139 already caught
      // on the neighbouring arm.
      if (!q) { p.count = 0; p.placed = true; continue; }
      const dy = Math.abs((p.y + p.offY) - (q.y + q.offY));
      const ySize = p.h / 2 + q.h / 2;
      const [dp, dq] = dirsOf(p, q);
      if (q.count === 1) {
        // the pair fix (:1190-1275). Arm 1 (:1201) half-shifts BOTH,
        // its two checks genuinely run together - C# mutates nothing
        // between them.
        const bias = (ySize - dy) * 0.5;
        if (clearOfPlaced(p, dp * bias, plates, q) && clearOfPlaced(q, dq * bias, plates, p)) {
          p.offY += dp * bias; q.offY += dq * bias;
          p.placed = q.placed = true;
        } else if (clearOfPlaced(p, dp * bias * 2, plates, q)) {
          // AUDIT 26 F139: the 2x fallback places p on ITS OWN check
          // ALONE (:1230-1234, committed before second is even
          // probed); q's placement is a separate question, asked at
          // zero offset against p's NEW spot with no skip (:1236-1239).
          // The old cut conjoined the two and placed both-or-neither,
          // then fell through to the mirrored arm C# never reaches.
          p.offY += dp * bias * 2;
          p.placed = true;
          if (clearOfPlaced(q, 0, plates, null)) q.placed = true;
        } else if (clearOfPlaced(q, dq * bias * 2, plates, p)) {
          // the symmetric fallback (:1242-1252)
          q.offY += dq * bias * 2;
          q.placed = true;
          if (clearOfPlaced(p, 0, plates, null)) p.placed = true;
        }
        // :1274-1275 - ONE decrement after the whole chain, keyed only
        // on p, always aimed at q, EVEN when q itself stayed unplaced.
        // That can leave q at count 0 with placed false, and the
        // no-recompute re-place pass below then fixes q at its
        // untouched original spot with no fresh check - DFU's own
        // accepted quirk, reproduced rather than tidied.
        if (p.placed) q.count--;
      } else if (q.count > 1) {
        // the collider is entangled elsewhere: shift THIS plate a
        // full ySize, trying away-from then toward (:1277-1308)
        if (clearOfPlaced(p, dp * ySize, plates, q)) {
          p.offY += dp * ySize; p.placed = true; q.count--;
        } else if (clearOfPlaced(p, -dp * ySize, plates, q)) {
          p.offY += -dp * ySize; p.placed = true; q.count--;
        }
      }
      // q.count === 0: NEITHER arm - C#'s `else if (> 1)` leaves a
      // partner whose count was already talked down alone this pass.
    }
    for (const p of plates) if (!p.placed && p.count === 0) p.placed = true;   // re-place, no recompute (:1317-1318)
    for (const p of plates) {
      // the last-resort whole-height hop, up then down (:1320-1359)
      if (p.placed) continue;
      if (clearOfPlaced(p, p.h, plates, null)) { p.offY += p.h; p.placed = true; }
      else if (clearOfPlaced(p, -p.h, plates, null)) { p.offY += -p.h; p.placed = true; }
    }
  }
  for (const p of plates) if (!p.placed && p.count === 0) p.placed = true;   // final zero pass (:1362-1363)
  for (const p of plates) if (!p.placed) { p.placed = true; p.replaced = true; }   // the "*" surrender (:1365-1376)
  return plates.map((p) => ({ offY: p.offY, replaced: p.replaced }));
}
