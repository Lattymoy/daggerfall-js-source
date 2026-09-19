// @ts-check
// HEARTH1 (2026-09-19, Mac: "Does this version of C&C not let you use
// braziers as extra campfires to cook from?") - THE WORLD'S OWN FIRES
// ARE FIRES.
//
// SURV3 gave the survival law exactly one fire: a camp the player or a
// peer PLACED (scenes/camps.js, survival/camp.js). Everything else that
// burns in Daggerfall - the town braziers, the bowls of fire down a
// dungeon corridor, the fire in a tavern's common room - was a sprite
// and a point light and nothing more, so a player standing over a
// roaring brazier was as cold, as wet and as roughly rested as one
// standing in a field, and had to burn a Campfire Kit two feet from it
// to cook a fish.
//
// This is a leaf and a pure one: the archive and the records, the test,
// the collection and the nearest-within-reach. Nothing here knows about
// a host, a renderer or a pool.
//
// WHICH RECORDS. The lights archive is 210 and its records are named in
// world/interiorLights.js's per-record table (DFU's AddLight switch).
// Three of them are an OPEN FLAME AT A HEIGHT YOU COULD COOK OVER, and
// they are the whole list:
//
//   0   Bowl with fire   - the standing fire bowl
//   1   the flame itself - what a camp's own fire is (camp.js FIRE_FLAT),
//                          so a block that stands one is standing a campfire
//   20  Brazier torch    - the brazier, which is the report's subject
//
// AND WHY THE REST ARE OUT, which is the part worth writing down. The
// archive is mostly CANDLES, LANTERNS AND CHANDELIERS (records 2-5, 8,
// 9, 11, 13, 21, 22, 24-27): a candle is not a cooking fire and never
// was. The two WALL TORCHES (6 skull torch, 17 mounted torch 1) are the
// interesting exclusion - they are a real flame, but they are bracketed
// on a wall at head height, and counting them would make every lit
// corridor in every dungeon a kitchen and every torchlit street a
// campsite. A fire you cook on is one you can stand over. The twelve
// records DFU's switch leaves as "todo" arms are unnamed and stay out
// with them; a record nobody has identified is not evidence of a fire.
//
// The archive-87 fireplace (the emissive table's record 0) is a
// TEXTURE on a model rather than a flat, so no flat list can carry it
// and it is not in this law. If a hearth mesh is ever wanted as a
// cooking fire it is a different lookup - by model id, at the sites
// that place models - and it belongs in its own slice.

/** The lights archive - the same one camp.js's FIRE_FLAT comes from. */
export const HEARTH_ARCHIVE = 210;

/**
 * How far from the player a world fire can matter, per horizontal axis.
 *
 * The streaming host carries every brazier of every loaded pixel and a
 * brazier two kilometres off is not one you are standing at, so the
 * walk is cut here. It has to clear BOTH questions this pool answers -
 * `BY_FIRE_REACH` (4) for the warmth and the activation ray's own reach
 * - with room to spare, and it is a box test on two axes because that
 * is two comparisons and the exact distance is taken afterwards by
 * whoever asked.
 */
export const HEARTH_NEAR = 16;

/** The archive-210 records that are a fire you can cook over. */
export const HEARTH_RECORDS = Object.freeze([0, 1, 20]);

const HEARTH_SET = new Set(HEARTH_RECORDS);

/** Is this (archive, record) one of the world's own cooking fires? */
export function isHearthFlat(archive, record) {
  return archive === HEARTH_ARCHIVE && HEARTH_SET.has(record);
}

/**
 * The hearths among a host's flats or lantern list, as bare positions.
 *
 * Takes anything carrying `record` and an x/y/z - the two exterior
 * hosts' `cityLights`, the interior's light list and the dungeon's own
 * flat walk all answer that shape, because collecting a second time
 * would be a second walk of the same block for the same answer.
 * Entries without a `record` (a dungeon RDB Light resource, which has
 * no texture at all) are skipped rather than guessed at.
 *
 * @param {Array<{record?: number, archive?: number, x: number, y: number, z: number}>} flats
 * @returns {Array<{x: number, y: number, z: number}>}
 */
export function collectHearths(flats) {
  const out = [];
  for (const f of flats ?? []) {
    // A hole in the list is skipped; a light with NO record at all (a
    // dungeon RDB Light resource has no texture) falls out of the test
    // below on its own - `HEARTH_RECORDS` cannot contain `undefined`,
    // so a second guard here would be a line that reads like a decision
    // and never makes one.
    if (!f) continue;
    if (!isHearthFlat(f.archive ?? HEARTH_ARCHIVE, f.record)) continue;
    out.push({ x: f.x, y: f.y, z: f.z });
  }
  return out;
}

/**
 * The nearest hearth within `reach` of `pos`, or null.
 *
 * The same shape as camp.js's `nearestFire` and deliberately so - the
 * host asks one question ("am I at a fire") of two pools and takes
 * whichever answers first.
 */
export function nearestHearth(hearths, pos, reach) {
  let best = null, bestD = reach;
  for (const h of hearths ?? []) {
    const d = Math.hypot(h.x - pos[0], h.y - pos[1], h.z - pos[2]);
    if (d <= bestD) { best = h; bestD = d; }
  }
  return best;
}
