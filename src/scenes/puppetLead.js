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
//
// OWNER-CLOCK (2026-10-21, the field's enemy desync): THE OWNER'S CLOCK, NOT MINE. The velocity above was measured on the
// READER's arrival clock and the lead stopped at LEAD_MAX_S - so a slow owner's foes (a frame of 333 ms at 3 fps, a
// hitch of a second) stood still past the cap and jumped on the next word, and their speed read whatever the road
// between did to two frames. A frame now says when its foes were stepped (`tm`, net/ownerClock.js), and the record's door
// copies it beside the feet (`p.tm`). Between two records that both carry it the velocity is the owner's distance over
// the OWNER's time, and the lead is carried for the interval the owner is seen to keep between its words (a long gap
// taken at once, forgotten slowly, LEAD_GAP_EASE) and a frame's slack past it - never under LEAD_MAX_S, never past
// LEAD_SLOW_MAX_S - and as far in the same proportion of LEAD_DIST_MAX (LEAD_DIST_SLOW_MAX at most). A word with a new
// `tm` is a new word even where its foe has not moved: it stands, and nothing leads it. Where either record carries no
// `tm` (an owner before this) every number is DESYNC-ZERO's, on the arrival clock - and so where both carry the SAME
// `tm` at other feet: the owner's clock did not move while its foe did (a mark that never came), so it says nothing of
// the time between them, and the arrival clock does, rather than a velocity of nothing for as long as the clock stands.
import { ownerTmDiffS } from '../net/ownerClock.js';   // OWNER-CLOCK: the owner's time between two of its words, across the wrap

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
/** OWNER-CLOCK: the longest a record is carried for an owner whose own clock says its words come further apart (s). */
export const LEAD_SLOW_MAX_S = 0.75;
/** OWNER-CLOCK: the furthest such a record is led (scene units) - LEAD_DIST_MAX in the proportion LEAD_SLOW_MAX_S bears to
 *  LEAD_MAX_S; below both pools' PUPPET_SNAP (3), so the lead alone never carries a target far enough to snap. */
export const LEAD_DIST_SLOW_MAX = LEAD_DIST_MAX * LEAD_SLOW_MAX_S / LEAD_MAX_S;
/** OWNER-CLOCK: past the owner's observed interval, a frame of the road's jitter (s). */
export const LEAD_SLACK_S = 0.1;
/** OWNER-CLOCK: how much of a shorter interval the observed one takes each word (a longer one is taken whole). */
export const LEAD_GAP_EASE = 0.25;

/**
 * Where the puppet's ease should walk this frame: its record `t` (scene feet), carried forward along the velocity its
 * last two records showed. `p` is the puppet's streamed state (f._pup, persistent while its owner streams it); the
 * lead's memory rides on it (`p._lead`), and OWNER-CLOCK's `p.tm` is the owner's clock for the record `t` is.
 * Returns `t` itself when there is nothing to lead.
 * @param {{ moving?: boolean, tm?: number | null, _lead?: any } | null} p
 * @param {ArrayLike<number> | null} t
 * @param {number} nowS
 */
export function puppetLead(p, t, nowS) {
  if (!p || !t || !Number.isFinite(nowS)) return t;
  const tm = Number.isInteger(p.tm) ? p.tm : null;   // OWNER-CLOCK: the record's own moment, its owner's clock
  let L = p._lead;
  if (!L) { L = p._lead = { x: t[0], y: t[1], z: t[2], at: nowS, tm, gap: 0, cap: LEAD_MAX_S, vx: 0, vz: 0, out: [0, 0, 0] }; return t; }
  if (t[0] !== L.x || t[1] !== L.y || t[2] !== L.z || (tm != null && tm !== L.tm)) {   // a new word - OWNER-CLOCK: or a new moment of its owner's
    const owned = tm != null && L.tm != null && tm !== L.tm;   // OWNER-CLOCK: both words say when - the owner's time between them; one moment twice (a clock that stopped) says nothing of it
    const dt = owned ? ownerTmDiffS(tm, L.tm) : nowS - L.at, dx = t[0] - L.x, dz = t[2] - L.z;
    L.vx = 0; L.vz = 0;
    if (dt >= LEAD_DT_MIN && dt <= LEAD_DT_MAX) {
      const vx = dx / dt, vz = dz / dt, s2 = vx * vx + vz * vz;
      if (s2 <= LEAD_SPEED_MAX * LEAD_SPEED_MAX) { L.vx = vx; L.vz = vz; }
      if (owned) L.gap = dt >= L.gap ? dt : L.gap + (dt - L.gap) * LEAD_GAP_EASE;   // OWNER-CLOCK: the interval it keeps
    }
    L.cap = owned ? Math.min(LEAD_SLOW_MAX_S, Math.max(LEAD_MAX_S, L.gap + LEAD_SLACK_S)) : LEAD_MAX_S;
    L.x = t[0]; L.y = t[1]; L.z = t[2]; L.at = nowS; L.tm = tm;
  }
  if (!p.moving || (L.vx === 0 && L.vz === 0)) return t;
  const age = Math.min(Math.max(0, nowS - L.at), L.cap);
  let ox = L.vx * age, oz = L.vz * age;
  const d = Math.hypot(ox, oz), far = LEAD_DIST_MAX * (L.cap / LEAD_MAX_S);   // OWNER-CLOCK: as far as the cap is long
  if (d > far) { ox *= far / d; oz *= far / d; }
  L.out[0] = t[0] + ox; L.out[1] = t[1]; L.out[2] = t[2] + oz;
  return L.out;
}
