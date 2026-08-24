// A2: THE NAMEPLATE COLLISION SOLVER - ExteriorAutomap.cs's
// ComputeNameplateOffsets (:1147-1377) with its helpers, ported over
// the ACTIVE code paths (MIT, Daggerfall Workshop; original author
// Nystul). DFU's right-aligned arms are dead there too -
// allowRightAlignedNameplates is hard false (:114) - so plates only
// ever displace VERTICALLY, and the port's keyed window never
// rotates the map, so DFU's rotated corner vectors stay axis-aligned
// and the intersect predicate reduces to its plain form (recorded
// simplification - the law is identical at rotation 0).
//
// A plate is { x, y, w, h }: x = the LEFT edge (plates are
// left-aligned at their anchor, ResetRotationBuildingNameplates
// :388-401), y = the vertical CENTER, w/h post-scale. The answer is
// a parallel array of { offY, replaced } - replaced plates render as
// "*" (:1365-1376), DFU's own surrender for a spot it cannot clear.

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
      if (!q) continue;
      const dy = Math.abs((p.y + p.offY) - (q.y + q.offY));
      const ySize = p.h / 2 + q.h / 2;
      const [dp, dq] = dirsOf(p, q);
      if (q.count === 1) {
        // the pair fix (:1192-1252): half-shift both, else 2x one alone
        const bias = (ySize - dy) * 0.5;
        if (clearOfPlaced(p, dp * bias, plates, q) && clearOfPlaced(q, dq * bias, plates, p)) {
          p.offY += dp * bias; q.offY += dq * bias;
          p.placed = q.placed = true;
        } else if (clearOfPlaced(p, dp * bias * 2, plates, q) && clearOfPlaced(q, 0, plates, p)) {
          p.offY += dp * bias * 2;
          p.placed = q.placed = true;
        } else if (clearOfPlaced(q, dq * bias * 2, plates, p) && clearOfPlaced(p, 0, plates, q)) {
          q.offY += dq * bias * 2;
          p.placed = q.placed = true;
        }
      } else {
        // the collider is entangled elsewhere: shift THIS plate a
        // full ySize, trying away-from then toward (:1277-1308)
        if (clearOfPlaced(p, dp * ySize, plates, q)) {
          p.offY += dp * ySize; p.placed = true; q.count--;
        } else if (clearOfPlaced(p, -dp * ySize, plates, q)) {
          p.offY += -dp * ySize; p.placed = true; q.count--;
        }
      }
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
