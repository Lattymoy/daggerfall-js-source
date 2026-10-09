// DESYNC-ZERO (2026-10-09, the owner: "ive seen enemies desyncing for players in a party sometimes they only strike the
// air and on their ends are monsters"): A PUPPET LEADS ITS LAST WORD.
//
// A puppet stood where its owner's last record said - and that record was already a frame old when it left (FOES_MS,
// 200 ms between deltas), it crossed the relay, and the puppet then EASED toward it (PUPPET_EASE_S). So a running foe
// stood a few hundred milliseconds behind where its owner had it: the reader swung at a body its owner had already
// moved, and the owner's foe struck a reader who saw it a step short. The send rate is the relay's (FOES_HZ_MAX, shared
// with the own lane) and stays; the reader instead carries a moving puppet forward along the way it was going - the
// velocity its last two records show, for as long as that record is old, never further than LEAD_MAX_S of it or
// LEAD_DIST_MAX, flat on the ground (the height is the record's), and only while its owner says it moves. A puppet
// that stops, turns or is knocked back corrects on the next record exactly as before: the lead is a target the ease
// walks toward, never a place the feet are put.
//
// One door, both pools (scenes/exteriorFoes.js and scenes/dungeonContext.js puppetStep).

/** The longest a record is carried forward (s): past a missed frame it waits for the next word. */
export const LEAD_MAX_S = 0.3;
/** The fastest a puppet is believed to go (scene units, metres, a second): a faster pair of records is a jump, led not at all. */
export const LEAD_SPEED_MAX = 9;
/** The furthest ahead of its record a puppet is ever led (scene units). */
export const LEAD_DIST_MAX = 1;
/** Two records closer together than this (s) give no velocity - one frame's pair, or a burst. */
const LEAD_DT_MIN = 0.04;
/** Two records further apart than this (s) give none either - the foe stood between them for all I know. */
const LEAD_DT_MAX = 1.2;

/**
 * Where the puppet's ease should walk this frame: its record `t` (scene feet), carried forward along the velocity its
 * last two records showed. `p` is the puppet's streamed state (f._pup, persistent while its owner streams it); the
 * lead's memory rides on it (`p._lead`). Returns `t` itself when there is nothing to lead.
 * @param {{ moving?: boolean, _lead?: any } | null} p
 * @param {ArrayLike<number> | null} t
 * @param {number} nowS
 */
export function puppetLead(p, t, nowS) {
  if (!p || !t || !Number.isFinite(nowS)) return t;
  let L = p._lead;
  if (!L) { L = p._lead = { x: t[0], y: t[1], z: t[2], at: nowS, vx: 0, vz: 0, out: [0, 0, 0] }; return t; }
  if (t[0] !== L.x || t[1] !== L.y || t[2] !== L.z) {   // a new word
    const dt = nowS - L.at, dx = t[0] - L.x, dz = t[2] - L.z;
    L.vx = 0; L.vz = 0;
    if (dt >= LEAD_DT_MIN && dt <= LEAD_DT_MAX) {
      const vx = dx / dt, vz = dz / dt, s2 = vx * vx + vz * vz;
      if (s2 <= LEAD_SPEED_MAX * LEAD_SPEED_MAX) { L.vx = vx; L.vz = vz; }
    }
    L.x = t[0]; L.y = t[1]; L.z = t[2]; L.at = nowS;
  }
  if (!p.moving || (L.vx === 0 && L.vz === 0)) return t;
  const age = Math.min(Math.max(0, nowS - L.at), LEAD_MAX_S);
  let ox = L.vx * age, oz = L.vz * age;
  const d = Math.hypot(ox, oz);
  if (d > LEAD_DIST_MAX) { ox *= LEAD_DIST_MAX / d; oz *= LEAD_DIST_MAX / d; }
  L.out[0] = t[0] + ox; L.out[1] = t[1]; L.out[2] = t[2] + oz;
  return L.out;
}
