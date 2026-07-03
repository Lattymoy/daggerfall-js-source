// Exterior NPCs (Characters C2).
// Verbatim RMBLayout rule (both flat sites): a flat record with a
// NON-ZERO FactionID is an exterior NPC - it gets StaticNPC layout
// data on top of its billboard. Editor flats are skipped BEFORE the
// faction check (DFU order); scenery never carries a faction. The
// billboards themselves already render through collectBlockFlats -
// this module filters that same list into the NPC registry (position,
// archive/record, factionID, flags, and the raw record position that
// feeds DFU's NPC hash).

/** @param flats - output of collectBlockFlats (C2 passthrough fields) */
export function collectExteriorNpcs(flats) {
  return flats.filter((f) => f.factionID !== 0 && f.factionID !== undefined);
}
