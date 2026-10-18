// @ts-check
// EG-H1 (EG8d, 2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 13.2, 11.7 and
// 21): THE UNION FLOOR, IN TIME - where the page says it lives. EG-FULL layer one built the search in net/eliteGates/egShape.js
// (`egUnionHolds`, its cells and its ticks); EG-H1 MOVED it here whole, under the page's own name, and widened it by the
// place: section 13.2's "Pendulums, vents and the place's hazards are tested in the same set" - a Rampart's vents and a
// fragment's own hazards (net/eliteGates/egFragLaw.js) land in the set beside the lords' and the legion's blows, so a lord never
// throws the lane that, with the vent erupting beside it, leaves a member nowhere to stand.
//
//   THE UNION FLOOR (section 13.2): every tick the relay sorts the shapes pending on each member by when they land. A
//     set of 1 m cells over the member's fight floor starts at the cells they can reach before the first landing; between
//     landings it dilates by THE ESCAPE BUILD's speed times the gap less EG_REACT_S, and at each landing it loses that
//     shape's cells. Walls and open edges bound it (`onFloor`). A new blow is held only if it would empty the set
//     (egUnionHolds); a held blow waits a tick, at most EG_UNION_HOLD_TICKS, then is dropped (net/eliteGates/egBodies.js).
//   THE PLACE'S LANDINGS (egPlaceLandings): each vent's eruption and each fragment hazard's live part that lands on a
//     fight floor before the new blow does, as a pending landing of the set. A CHECK (the Eclipse) has no edge to run to
//     and is never in the set (the union floor's own law); a wisp's drain and the mist land nothing; the span's own
//     Pendulums and Vents stand on traversal ground, where no lord or add aims a blow (section 11.7), so no aimed blow
//     ever shares their set - said, not tested.
//   HOW NEAR A BLOW (egBlowNear): the least distance from a point to a blow's stamps (0 inside) - Watchfire's 12 m
//     (section 15, net/eliteGates/egBodies.js egTellTo).
//   AUDIT EG V (lane1 #10) - THE LORDS' PLACE IN THE SET: the fight's own zones (net/eliteGates/egLords.js zoneOut) join it - a burning or
//     fallen ground told and not yet down (the Conquest's thirds, Both Courts Burn, the Last Charge's third, a Last Lesson's
//     ring) lands in the set at its onset (egZoneLandings), and the floor gone (a void: a fallen island, a fallen third, the
//     Molten Rim) is no ground to flee to while it stands (egFloorLess); the lords' place blows (a Burning Bridge, the Floor
//     Falls) are pending landings like any blow. A new blow is held only if IT empties the set: a set the landings already
//     empty without it (a court burning whole) holds nothing more.
//   AUDIT EG V (h; fix group B's limit on lane1 #10) - THE GROUND BURNING: a burn that stands as a landing comes (a pool
//     burning already, a claimed third, Both Courts Burn, a Last Lesson's last ring) is no ground to flee to then - the set
//     loses its cells at every landing it stands through (egBurnsIn, egUnionHolds' `burns`), as a told burn's at its onset.
//     It is crossed between landings (a member in a pool runs out of it), never stood in as one lands; a void is no ground
//     at all. Before, a burning court counted as ground, so a lord's blow could leave a member only the fire to stand in.
//   EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks ... is absolutely perfect"; section 13.2) - THE HAVENS IN
//     THE SET: a haven CHECK pending (the Haven Nova, the Eclipse - its every stamp 'h', naming no member) is a landing of the
//     set too: at it every cell outside its havens is lost (egHavenCheck). A CHECK is never itself held - it has no edge to run
//     to - but an aimed blow that would take the only haven a member can reach before it lands is: before, the set never saw a
//     CHECK, and Moonshatter landed on the moon-shaft a member stood in 1.1 s before the Eclipse (the audit's Seyth, 165 blows
//     in 36 Eclipses). A blow still live past its landing (`sp` - a Burning Bridge's 12 s, a Charge's run) burns its cells at
//     every landing it stands through, as a pool does (egUnionHeld, net/eliteGates/egBodies.js).
//
// Pure. In the relay bundle (net/eliteGates/egBodies.js imports it). Not a DFU member. Ledger A (ELITE-GATES).
import { egInBlow, egInShape, segDist, EG_ESCAPE_MPS, EG_REACT_S } from './egShape.js';
import { egVentAt, EG_VENT_FIRE_MS } from './egLaw.js';
import { egHazardParts, EG_HAZARDS } from './egFragLaw.js';
import { egByHeight, egBears } from './egWalkGraph.js';   // THE ASCENT - HEIGHT: a zone lies on its own floor

/** A held blow waits a tick and is dropped after this many (section 13.2). */
export const EG_UNION_HOLD_TICKS = 4;
/** The union floor's cells (m) and how far about the member it looks. */
export const EG_UNION_CELL = 1;
export const EG_UNION_R = 30;
/** How finely a fragment's hazards are walked for their landings (ms - a live part is at least 300 ms long). */
export const EG_PLACE_STEP_MS = 100;

// ── THE UNION FLOOR, in time (moved from net/eliteGates/egShape.js, its law unchanged) ─────────────────────────────────
/**
 * Would blow `next` - with the landings already pending on a member standing at (px, pz) at `now` - leave them no
 * floor? `onFloor(x, z)` the member's fight floor (its walls and open edges bound it). The set starts as the cells
 * reachable before the first landing, dilates by the escape build's reach less EG_REACT_S between landings, and loses
 * each landing's cells - AUDIT EG V (h): and the cells of every burn of `burns` (egBurnsIn) standing as it lands. True when it
 * empties - hold the blow.
 * @param {any[]} pending @param {any} next @param {number} px @param {number} pz @param {number} now @param {(x: number, z: number) => boolean} onFloor
 * @param {any[]} [burns]
 */
export function egUnionHolds(pending, next, px, pz, now, onFloor, burns = [], nextBurns = []) {
  if (!next || next.ch || !emptied([...pending, next], px, pz, now, onFloor, nextBurns.length ? [...burns, ...nextBurns] : burns)) return false;
  // AUDIT EG V (lane1 #10): held only if the new blow is what empties it - (h) its landing judged without it too, where the
  // ground burning may empty the set alone (a court burning whole holds nothing more). EG-PERFECT: the ground the new blow
  // leaves burning (`nextBurns` - its pool) is its own, so it is judged with it alone
  return !emptied(burns.length ? [...pending, { s: [], at: next.at }] : pending, px, pz, now, onFloor, burns);
}
/** EG-PERFECT (section 13.2): is `b` a HAVEN CHECK - a CHECK every stamp of which is 'h' (everywhere outside its havens), naming
 *  no member (an errand's failure blow lands on the members it names wherever they stand, and is no landing of the set)? Such a
 *  landing takes every cell outside its havens. Pure. */
export const egHavenCheck = (b) => !!b?.ch && !b.on && Array.isArray(b.s) && b.s.length > 0 && b.s.every((s) => s?.[0] === 'h');
/** Does the set over landings `list` empty (egUnionHolds's search)? AUDIT EG V (h): at each landing it loses the cells of every
 *  burn (`burns`) standing then too. EG-PERFECT: a haven CHECK is a landing (egHavenCheck). */
function emptied(list, px, pz, now, onFloor, burns = []) {
  const blows = list.filter((b) => b && (!b.ch || egHavenCheck(b)) && b.at > now).sort((a, b) => a.at - b.at);
  if (!blows.length) return false;
  const C = EG_UNION_CELL, R = Math.ceil(EG_UNION_R / C), side = 2 * R + 1;
  const ix = (i, j) => (i + R) * side + (j + R);
  const floor = new Uint8Array(side * side);
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) if (i * i + j * j <= R * R && onFloor(px + i * C, pz + j * C)) floor[ix(i, j)] = 1;
  let set = new Uint8Array(side * side);
  set[ix(0, 0)] = 1;
  let t = now;
  const grow = (m) => {
    const steps = Math.max(0, Math.floor(m / C));
    for (let k = 0; k < steps; k++) {
      const nx = set.slice();
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
        if (!set[ix(i, j)]) continue;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const a = i + di, b = j + dj;
          if (a < -R || a > R || b < -R || b > R) continue;
          const q = ix(a, b);
          if (floor[q] && (di === 0 || dj === 0 || k % 3 !== 2)) nx[q] = 1;   // diagonals two steps in three: a disc, not a square
        }
      }
      set = nx;
    }
  };
  for (const b of blows) {
    grow(EG_ESCAPE_MPS * Math.max(0, (b.at - t) / 1000 - EG_REACT_S));
    t = b.at;
    let any = false;
    const lit = burns.filter((z) => z.from <= b.at && z.until > b.at);   // AUDIT EG V (h): the ground burning as it lands
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
      const q = ix(i, j);
      if (!set[q]) continue;
      if (egInBlow(b, px + i * C, pz + j * C) || lit.some((z) => egInShape(z.s, px + i * C, pz + j * C))) set[q] = 0; else any = true;
    }
    if (!any) return true;
  }
  return false;
}

// ── AUDIT EG V (lane1 #10): THE FIGHT'S ZONES IN THE SET ───────────────────────────────────────────────────────
/** THE ASCENT (Elite-Gates-Ascent.md section 2): does zone `z` lie on the floor of feet at `y` - a zone that says its floor's
 *  height (`y`, a hall that judges by height) only where that floor bears them (net/eliteGates/egWalkGraph.js egBears); any, else. */
const onZoneFloor = (z, y) => !Number.isFinite(z.y) || egBears(z.y, y);
/**
 * The fight's zones (`F.zones` - net/eliteGates/egLords.js zoneOut's `{ kind, s, from, until }`) that come down in (`now`, `until`]: each
 * burning or fallen ground told and not yet down, a pending landing at its onset (`{ s, at, sp, ch: 0, o: 0, i: 0 }`). Pure.
 * THE ASCENT (section 2): a zone that says its floor's height lands at it (`y`).
 * @param {any[]|undefined} zones @param {number} now @param {number} until
 */
export const egZoneLandings = (zones, now, until) => (zones ?? []).filter((z) => (z.kind === 'burn' || z.kind === 'void') && z.from > now && z.from <= until && z.until > z.from)
  .map((z) => ({ s: [z.s], at: z.from, sp: z.until - z.from, ch: 0, o: 0, i: 0, ...(Number.isFinite(z.y) ? { y: z.y } : {}) }));
/**
 * The member's fight floor `onFloor` less the floor gone over (`now`, `until`]: every void zone standing in it (a fallen
 * island, a fallen third, the Molten Rim) is no ground to flee to. Pure; answers `onFloor` itself when none stands. THE ASCENT
 * (section 2): `y` the member's feet - only the voids of its own floor (onZoneFloor).
 * @param {(x: number, z: number) => boolean} onFloor @param {any[]|undefined} zones @param {number} now @param {number} until @param {number} [y]
 */
export function egFloorLess(onFloor, zones, now, until, y = NaN) {
  const gone = (zones ?? []).filter((z) => z.kind === 'void' && z.from <= until && z.until > now && onZoneFloor(z, y));
  return gone.length ? (x, z) => onFloor(x, z) && !gone.some((q) => egInShape(q.s, x, z)) : onFloor;
}

/**
 * AUDIT EG V (h; section 13.2) - THE GROUND BURNING: the fight's burning zones (`F.zones` - net/eliteGates/egLords.js zoneOut's `{ kind,
 * s, from, until }`) that stand at some instant of (`now`, `until`] - a pool burning already, a claimed third, Both Courts Burn,
 * a Last Lesson's ring, a flooded channel - each no ground to flee to while it burns: the union floor's set crosses one between
 * landings and never stands in one as a landing comes (egUnionHolds' `burns`). Pure.
 * THE ASCENT (section 2): `y` the member's feet - the burns of its own floor alone (onZoneFloor).
 * @param {any[]|undefined} zones @param {number} now @param {number} until @param {number} [y]
 */
export const egBurnsIn = (zones, now, until, y = NaN) => (zones ?? []).filter((z) => z.kind === 'burn' && z.from <= until && z.until > now && onZoneFloor(z, y));

// ── THE PLACE'S LANDINGS (section 13.2: "Pendulums, vents and the place's hazards are tested in the same set") ──
/** A Rampart vent's lane as a stamp (its rectangle's capsule - a little wider at its ends: the set's favour). */
const ventStamp = (v) => ['l', v.x - v.halfW, v.z, v.x + v.halfW, v.z, v.d];
/**
 * The place's own landings on hall `spec`'s fight floors in (`now`, `until`] (relay ms; the hall woken at `wokeAt`): a
 * Rampart vent's every eruption, and each fragment hazard's live parts aimed at a fight floor (net/eliteGates/egFragLaw.js
 * EG_HAZARDS `aim: 'fight'`), each `{ s, at, sp, ch: 0, o: 0, i: 0 }` - a pending landing the union floor reads as a blow.
 * Pure.
 * @param {any} spec @param {number} wokeAt @param {number} now @param {number} until
 */
export function egPlaceLandings(spec, wokeAt, now, until) {
  const out = [];
  if (!spec || !(until > now)) return out;
  if (wokeAt > 0) {
    for (const v of spec.vents ?? []) {
      if (!(v.cycle > 0)) continue;
      // cycle n erupts at wokeAt - phase + n x cycle + (cycle - EG_VENT_FIRE_MS) (net/eliteGates/egLaw.js egVentAt's law)
      const first = wokeAt - v.phase + v.cycle - EG_VENT_FIRE_MS;
      for (let n = Math.max(0, Math.ceil((now - first) / v.cycle)); ; n++) {
        const at = first + n * v.cycle;
        if (at > until) break;
        if (at > now && at >= wokeAt && egVentAt(v, wokeAt, at).st === 'fire') out.push({ s: [ventStamp(v)], at, sp: EG_VENT_FIRE_MS, ch: 0, o: 0, i: 0 });
      }
    }
  }
  for (const hz of spec.hazards ?? []) {
    const L = EG_HAZARDS[hz.kind];
    if (!L || L.aim !== 'fight' || hz.kind === 'wisp') continue;
    const seen = new Set();
    for (let t = now + EG_PLACE_STEP_MS; t <= until; t += EG_PLACE_STEP_MS) {
      for (const p of egHazardParts(hz, t / 1000)) {
        if (p.st !== 'live' || seen.has(p.key) || p.sh[0] === 'a') continue;
        seen.add(p.key);
        // EG-PERFECT: the place's haven CHECK (the Eclipse Vault's) a landing of the set too, as a lord's is (egHavenCheck)
        out.push({ s: [p.sh], at: t, sp: L.live, ch: p.sh[0] === 'h' ? 1 : 0, o: 0, i: 0, ...(egByHeight(spec) ? { y: hz.y ?? 0 } : {}) });   // THE ASCENT: at its own height
      }
    }
  }
  return out;
}

// ── HOW NEAR A BLOW (Watchfire's 12 m - section 15) ─────────────────────────────────────────────────────
/** The least distance from (x, z) to a stamp's ground (0 inside it). A CHECK's (the whole floor, outside the havens) is
 *  0 everywhere. */
export function egStampDist(s, x, z) {
  switch (s?.[0]) {
    case 'd': return Math.max(0, Math.hypot(x - s[1], z - s[2]) - s[3]);
    case 'l': return Math.max(0, segDist(x, z, s[1], s[2], s[3], s[4]) - s[5] / 2);
    case 'c': return Math.max(0, Math.hypot(x - s[1], z - s[2]) - s[4]);   // its reach from its apex, every bearing (the near side's favour)
    case 'r': { const d = Math.hypot(x - s[1], z - s[2]); return d < s[3] ? s[3] - d : Math.max(0, d - s[4]); }
    case 'a': case 'h': return 0;
    default: return Infinity;
  }
}
/** The least distance from (x, z) to any of a blow's stamps. */
export const egBlowNear = (blow, x, z) => Math.min(Infinity, ...(blow?.s ?? []).map((s) => egStampDist(s, x, z)));
