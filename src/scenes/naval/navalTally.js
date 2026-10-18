// @ts-check
// AUDIT NAV1 (the guns) G17 - MY VOLLEY'S TALLY, a module the naval host wires (scenes/naval/navalHost.js; HOST-SPLIT,
// bible/01-Overview/Host-Split.md - AUDIT 2026-10-17 moved it out of createNavalHost, where COMBAT-FEEL's CARD-CREW had
// grown it): each volley of mine counted as its balls come down - how many struck her, how many below her waterline, how
// many through her rigging, and (CARD-CREW) how many of her men went down - and the last one down kept for the readout
// (navalHost.js hudModel shows it TALLY_S). The port's own: Daggerfall has no sea.
import { segmentOfTarget } from '../serpentHost.js';   // SERPENT1: a sea serpent's segment among the shots' targets

/**
 * @param {{ clock: () => number, onSea: (target: any) => boolean }} deps - `onSea(target)` whether a target is a ship of
 *   the sea (a boat of mine or a strange target is none)
 */
export function createVolleyTally(deps) {
  /** volley id -> { balls, ended, hits, holed, rig, men } while its balls fly */
  const open = new Map();
  /** the last one down - `{ balls, hits, holed, rig, men, at, volley }` */
  let last = null;
  return {
    /** A volley of mine fired, `balls` of it to come down. */
    fired(id, balls) { open.set(String(id), { balls, ended: 0, hits: 0, holed: 0, rig: 0, men: 0 }); },
    /** One of the shot field's events (systems/naval/navalShots.js) - a ball of an open volley struck, or came down. */
    count(e) {
      const t = e.volley != null ? open.get(String(e.volley)) : null;
      if (!t) return;
      if (e.type === 'hit') {
        if (segmentOfTarget(e.target) != null) { t.hits++; t.ended++; }   // AUDIT SERPENT L2: a ball in the sea serpent's hide is a hit, never a miss
        else if (!deps.onSea(e.target)) { if (e.zone !== 'rig') t.ended++; }
        else if (e.zone === 'rig') t.rig++;
        else { t.hits++; if (e.zone === 'holed') t.holed++; t.ended++; }
      } else if (e.type === 'splash' || e.type === 'land' || e.type === 'gone') t.ended++;
      else return;
      if (t.ended >= t.balls) { last = { balls: t.balls, hits: t.hits, holed: t.holed, rig: t.rig, men: t.men, at: deps.clock(), volley: String(e.volley) }; open.delete(String(e.volley)); }
    },
    /** CARD-CREW (COMBAT-FEEL): `n` of her men down to a ball of a volley of mine - its count's, or the count it just
     *  closed (the last ball is counted before it lands). */
    men(e, n) {
      if (!(n > 0) || e.volley == null) return;
      const t = open.get(String(e.volley)) ?? (last?.volley === String(e.volley) ? last : null);
      if (t) t.men += n;   // AUDIT 2: summed whole, rounded once as it is shown - a ball's share of a man is no man
    },
    /** The last volley down while it is shown - `span` s after it came down at `now` - for the readout, or null. */
    shown(now, span) { return last && now - last.at <= span ? { balls: last.balls, hits: last.hits, holed: last.holed, rig: last.rig, men: Math.round(last.men) } : null; },
  };
}
