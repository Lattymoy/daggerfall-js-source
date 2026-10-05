// @ts-check
// CREW-COMPANIONS (2026-09-30, Mac: take the crew "along as companions in the world that travel with you and can fight
// by your side" - through every door: "maybe this is a time for a refactor?") - THE COMPANION LAYER. The party
// (systems/naval/crewCompanions.js) says who walks with the player; this stands them in whatever place the player is
// in, and answers every change back to it. The places keep their own foe pools - the street's and a building's
// (exteriorFoes.js, one factory), a dungeon's (dungeonContext.js) - and each hands this layer one small ADAPTER
// (`deps.place()`): its key, how to stand a body in it, how to take one out, and where a body may stand. The layer
// never asks which kind of place it is.
//
//  - ONE RECONCILE, NO DOOR HOOKS. Each frame the place's key is read: a new key (a door, a dungeon, a fast travel, a
//    load, a sweep) lifts every body out of the old place - its health already in the party - and stands the party
//    behind the player in the new one. A body a place swept itself (a fast travel's clear) stands again the same way.
//  - THE FOLLOW BRAIN is the motor's (enemyMotor.js `follow`, the navmesh's in enhancedMotor.js): no foe to fight,
//    each keeps to the leader - the first nearer, the second a pace further - and one left CATCH_UP_M behind (or a
//    floor away) is stood behind the player again. COMPANION-TRAIL (FIELD BUGS 2026-10-04b): the layer drops a crumb
//    every TRAIL_STEP_M the leader walks on a floor, the last TRAIL_MAX kept, and hands them to the motor
//    (`follow.trail`) - out of sight of the leader a companion walks where the player walked, round the corner and
//    through the doorway, never straight into the wall beside it. A new place, or a leader moved TRAIL_JUMP_M in one
//    frame (a teleport, the floating origin's recentre), begins the trail again.
//  - FIGHTING: each stands as the player's ally (allied: team PlayerAlly - enemyTargets.js getTargets), a `shipmate`
//    none of the player's blows can reach (combat/friendlyFire.js), and a `companion` every hostile may fight.
//  - KNOCKED OUT: the pools' death arms hold a companion at 1 and mark him (`_knockedOut`); here he is taken out and
//    the party carries him back aboard to rest (crewCompanions.js knock).
//  - COMPANION-PORTAL (2026-10-02, Mac: "Companions when playing catch up, spawning in, or spawning out should use a
//    unique portal animation instead of just popping in and out"): a place that can draw one hands its `fx` - a body
//    ARRIVES through a portal at its stand, LEAVES through one (sent back, knocked out: it is taken out of the place
//    only once the portal has closed on it) and JUMPS through a pair (a catch-up: one opens where it was, one where it
//    stands again). A change of place lifts the party at once - the place it leaves is going.
//  - REVENANT-COMPANION: the layer stands any party of the crew's shape - the sworn revenants' too
//    (systems/revenantCompanions.js) - a member's own `key` and `title` where it has them.
import { companionSlot } from '../systems/naval/crewCompanions.js';

/** A companion further than this from the player (m, on the ground's plane) is stood behind the player again. */
export const CATCH_UP_M = 40;
/** ...or this far above or below (m) - a floor away, a ledge dropped from. */
export const CATCH_UP_DY = 6;
/** How near each keeps to the leader (m): the first, then each after a pace further. */
export const HEEL_M = 2.5;
export const HEEL_STEP_M = 1.2;
/** COMPANION-TRAIL: a crumb each this far the leader walks (m), the newest this many kept (48 m - past CATCH_UP_M),
 *  and a leader moved this far in one frame (m) begins it again. */
export const TRAIL_STEP_M = 0.75;
export const TRAIL_MAX = 64;
export const TRAIL_JUMP_M = 8;

export const companionKeyOf = (c) => c.key ?? `${c.boat}:${c.name}`;

/**
 * @param {{
 *   party: () => (ReturnType<typeof import('../systems/naval/crewCompanions.js').createCompanions> | null),
 *   place: () => ({ key: any, spawn: (mobile: number, feet: number[], o: { yaw: number, gender: string }) => Promise<any>,
 *     remove: (rec: any) => void, has?: (rec: any) => boolean, spot?: (from: number[], dx: number, dz: number) => number[],
 *     fx?: { arrive?: (rec: any) => void, leave?: (rec: any, done: () => void) => void, jump?: (rec: any, from: number[]) => void } } | null),
 *   leader: () => ({ feet: number[], yaw: number, grounded?: boolean } | null),
 *   now: () => number,
 *   onKnocked?: (c: any, by: any) => void,
 *   onStood?: (c: any, rec: any) => void,
 * }} deps
 */
export function createCrewAshore(deps) {
  /** @type {Map<string, { c: any, rec: any, remove: (rec: any) => void, has: ((rec: any) => boolean) | null, fx: any }>} */
  const stood = new Map();
  const pending = new Set();
  let placeKey, epoch = 0;
  /** COMPANION-TRAIL: where the leader walked in this place, oldest first. @type {number[][]} */
  const trail = [];
  /** @type {number[]|null} the leader's feet the frame before */
  let leaderWas = null;
  /** COMPANION-TRAIL: the leader's feet this frame - moved TRAIL_JUMP_M since the last frame, the trail begins again;
   *  on a floor, a crumb past TRAIL_STEP_M from the last. */
  function drop(L) {
    const f = L.feet;
    if (leaderWas && Math.hypot(f[0] - leaderWas[0], f[1] - leaderWas[1], f[2] - leaderWas[2]) > TRAIL_JUMP_M) trail.length = 0;
    leaderWas = [f[0], f[1], f[2]];
    if (L.grounded === false) return;   // a jump's arc, a swim, a levitation leave no crumb in the air
    const last = trail[trail.length - 1];
    if (last && Math.hypot(f[0] - last[0], f[2] - last[2]) < TRAIL_STEP_M) return;
    trail.push([f[0], f[1], f[2]]);
    if (trail.length > TRAIL_MAX) trail.shift();
  }
  /** AUDIT WK-M3: HIS SPELLS RIDE WITH HIM, as his health does. Each place stands a fresh body, so every effect on him -
   *  a gift of mine (COMPANION-KIT), a foe's poison - was lost at every door, dungeon, helm and sweep (a fast travel, a
   *  Recall, a respawn). A body leaving its place (lifted at a change of place, or swept by the place itself) leaves its
   *  live entries here, keyed by the party member, and his next body stands with them (the same entries: the body they
   *  leave is out of its pool, and no round of a pool ticks it again - every leaving writes the list afresh, so a list
   *  once stood is never stood twice). Keyed by the member, so a hand sent back aboard or knocked out - dropped from the
   *  party - takes none to his next turn ashore. In memory alone: a save carries his health, not his spells, so a load
   *  (a quickload too - the party is the save's) stands him without them, as ever. */
  const carried = new WeakMap();
  const carry = (s) => { const fx = s.rec?.entity?.activeEffects; carried.set(s.c, Array.isArray(fx) ? fx.filter((a) => a && !a.ended) : []); };

  const lift = (s) => { try { s.remove(s.rec); } catch (e) { console.warn('[companions] a body would not lift', e?.message ?? e); } };
  /** COMPANION-PORTAL: out through a portal where the place draws one - the body taken out once it has closed. */
  const leave = (s) => {
    if (typeof s.fx?.leave !== 'function') { lift(s); return; }
    try { s.fx.leave(s.rec, () => lift(s)); } catch (e) { console.warn('[companions] a portal would not open', e?.message ?? e); lift(s); }
  };
  function liftAll() { for (const s of stood.values()) { carry(s); lift(s); } stood.clear(); }
  /** Where the `i`th of `n` stands behind the leader, walked out from the leader's feet (the place's `spot`: never in a wall). */
  function slotFeet(place, L, i, n) {
    const [dx, dz] = companionSlot(L.yaw, i, n);
    return place.spot ? place.spot(L.feet, dx, dz) : [L.feet[0] + dx, L.feet[1], L.feet[2] + dz];
  }
  /** The motor's follow handle: the leader's live feet, and how near this one keeps. */
  const followOf = (i) => ({ feet: () => deps.leader()?.feet ?? null, stop: HEEL_M + i * HEEL_STEP_M, trail: () => trail });   // COMPANION-TRAIL

  /** One frame: the place read, the bodies there kept to the party, the missing stood. */
  function frame() {
    const party = deps.party();
    const now = deps.now();
    party?.wake(now);
    const place = party && (party.party.length || stood.size) ? deps.place() : null;   // COMPANION-PORTAL: the last one sent away still leaves through its portal (no party: everyone out)
    const key = place ? place.key : undefined;
    if (key !== placeKey) { liftAll(); placeKey = key; epoch++; trail.length = 0; leaderWas = null; }   // COMPANION-TRAIL: a new place, a new trail
    if (!party) return;
    const L = deps.leader();
    if (place && L) drop(L);   // COMPANION-TRAIL
    const list = party.party;
    // the bodies standing: knocked, swept, sent back, left behind
    for (const [k, s] of [...stood]) {
      const { rec } = s;
      const i = list.indexOf(s.c);
      if (rec._knockedOut) {
        stood.delete(k); leave(s);   // COMPANION-PORTAL: carried off through a portal
        if (party.knock(s.c.boat, s.c.name, now)) deps.onKnocked?.(s.c, rec._knockedBy ?? null);   // RVN10 (Feud-Arc.md 21.1): and the foe whose blow it was
        continue;
      }
      // the place swept it - a cull, a remove, or (AUDIT CC-A1) a clear that empties the list and marks nobody (the
      // street's clearLive: a fast travel, a Recall, a passage, a respawn): it stands again below
      if (rec.dead || !rec.ai || (s.has && !s.has(rec))) { carry(s); stood.delete(k); continue; }   // AUDIT WK-M3: with his spells
      if (i < 0) { stood.delete(k); leave(s); continue; }   // sent back aboard - COMPANION-PORTAL: through a portal
      if (rec.entity) {
        party.hurt(s.c.boat, s.c.name, rec.entity.health, rec.entity.maxHealth);
        // AUDIT CC-A4: the player's, whatever turned him (a blow of mine that reached him, a reset of an ally's team)
        rec.entity.team = 'PlayerAlly'; rec.entity.mobileTeam = 'PlayerAlly';
      }
      rec.shipmate = true;
      rec.ai.follow = followOf(i);
      if (place && L) {
        const f = rec.ai.feet;
        // AUDIT CC-A3: a floor away counts only while the leader stands on one - levitating, swimming or in the air, the
        // body stood at his height would only fall and be stood up there again
        const away = Math.hypot(f[0] - L.feet[0], f[2] - L.feet[2]) > CATCH_UP_M || (L.grounded !== false && Math.abs(f[1] - L.feet[1]) > CATCH_UP_DY);
        if (away) {
          const at = slotFeet(place, L, i, list.length);
          const from = [f[0], f[1], f[2]];
          f[0] = at[0]; f[1] = at[1]; f[2] = at[2];
          try { s.fx?.jump?.(rec, from); } catch { /* COMPANION-PORTAL: no portal, the step all the same */ }
          // AUDIT CC-A3: stood afresh - the motor resumes as a puppet handed back does (enemyMotor.js resumeLive: its
          // grounding, so no fall is billed from the ledge he left; its target and senses; the route)
          if (typeof rec.ai.resumeLive === 'function') rec.ai.resumeLive();
          else { rec.ai.target = null; rec.ai.path = null; rec.ai.velY = 0; }
          rec.ai._restGrounded = false;
        }
      }
    }
    if (!place || !L) return;
    // the party not standing here: stood behind the leader
    list.forEach((c, i) => {
      const k = companionKeyOf(c);
      if (stood.has(k) || pending.has(k)) return;
      pending.add(k);
      const at = slotFeet(place, L, i, list.length), was = epoch;
      Promise.resolve(place.spawn(c.mobile, at, { yaw: L.yaw, gender: c.gender })).then((rec) => {
        pending.delete(k);
        if (!rec) return;
        if (was !== epoch || !party.isAshore(c.boat, c.name) || deps.party() !== party) { place.remove(rec); return; }   // the place changed under the stand, or he went back
        rec.companion = k;
        rec.shipmate = true;
        if (rec.entity) {
          rec.entity.name = /** @type {any} */ (c).title ?? c.name;   // REVENANT-COMPANION: a sworn one's own name
          // AUDIT CC-A2: a door neither heals nor hurts him - each place rolls his class's pool afresh.
          // AUDIT WK-U2: so his WHOLE rides with him too, not a share of the new roll: carried as a share, his maximum
          // changed at every door (94, 86, 76, 105...) and his card and bar read each re-roll as a blow or a heal
          if (c.maxHealth > 0) { rec.entity.maxHealth = c.maxHealth; rec.entity.health = Math.max(1, Math.min(c.maxHealth, c.health ?? c.maxHealth)); }
          // AUDIT WK-M3: and his spells, as he left the last place
          const fx = carried.get(c);
          if (fx?.length) rec.entity.activeEffects = [...(rec.entity.activeEffects ?? []), ...fx];
        }
        if (rec.ai) rec.ai.follow = followOf(Math.max(0, party.party.indexOf(c)));
        stood.set(k, { c, rec, remove: place.remove, has: place.has ?? null, fx: place.fx ?? null });
        try { place.fx?.arrive?.(rec); } catch { /* COMPANION-PORTAL: no portal, the stand all the same */ }
        deps.onStood?.(c, rec);
      }).catch((e) => { pending.delete(k); console.warn('[companions] a companion would not stand', e?.message ?? e); });
    });
  }

  return {
    frame,
    /** The companions standing here - their bodies (the bars' list). */
    bodies: () => [...stood.values()].map((s) => s.rec),
    /** Everyone out of the place (the naval arc switched off, a new game) - the party keeps them. */
    clear() { liftAll(); placeKey = undefined; epoch++; trail.length = 0; leaderWas = null; },
    /** COMPANION-TRAIL: the leader's crumbs in this place (tests). */
    trail: () => trail,
  };
}
