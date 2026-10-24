// @ts-check
// PASSAGE (2026-10-19, the owner: "buy and ride a friendly boat (if one is docked) at any port"; bible/03-World/Passage.md)
// - A BERTH'S SHIP, BOOKED: the sea's half of the passage. AUDIT PASSAGE D-M1 (HOST-SPLIT, THE HOSTS DO NOT GROW): it was
// four functions in createNavalHost's own scope; it is a module the naval host builds once over its state (by getters,
// fishHost.js's shape) and wires into Activate, takesActivate, its frame's hint and its face. The voyage itself is
// scenes/naval/passageHost.js's; the law systems/naval/passage.js.
//
//   host = { sea, harbours, enabled(), boarding(), myBoat(), csa(), stanceOf(ship), drop(entry), adopt(entry),
//            retire(entry), departedOf(key, day), day(), hullBox(boat) }   - the naval host's own state and doors
//   deps = the naval host's deps (`passage`, `passageCrosses(hull)`, `look`, `say`, `seaY`, `board.mintUid`,
//          `board.terrainAt`)
//
// Not a DFU member. Ledger A (PASSAGE).
import { PASSAGE_HULLS, PASSAGE_RAY_M, passageHintText } from '../../systems/naval/passage.js';
import { alongside, BERTH_SNAP_M, BERTH_WAY } from '../../systems/naval/shipLife.js';
import { forwardOfYaw } from '../../systems/naval/navalAI.js';
import { segmentBoxEntry } from '../../systems/naval/navalBallistics.js';
import { prizeDeedValue } from '../../systems/naval/navalPlunder.js';
import { mintDeed } from '../../systems/comeSailAway/comeSailAwayItems.js';
import { NAVAL_WIRE_GONE } from '../../systems/naval/navalWire.js';

/** @param {any} host @param {any} deps */
export function createPassageBerths(host, deps) {
  /** Where a ship lies moored: her own errand's berth (a harbour's own, of my roll), else - AUDIT PASSAGE B5: another
   *  player's copy carries no errand on the wire - the berth of a harbour I know she lies still at (the naval host's
   *  berthOf law: within BERTH_SNAP_M, under BERTH_WAY). `{ key, i }` or null. */
  function mooredAt(e) {
    const r = e.ship.errand;
    if (r?.kind === 'moored') return e.fromHarbour ? { key: r.harbour, i: r.berth } : null;
    if (!e.owner || r || (e.ship.speed ?? 0) >= BERTH_WAY) return null;
    for (const h of host.harbours.values()) {
      const berths = h?.harbour?.berths ?? [];
      for (let i = 0; i < berths.length; i++) if (Math.hypot(berths[i].pos[0] - e.ship.pos[0], berths[i].pos[1] - e.ship.pos[2]) <= BERTH_SNAP_M) return { key: h.key, i };
    }
    return null;
  }
  /** The ship a player on foot could book passage on: a harbour's own (never a packet, a prize or a ship fading) lying
   *  moored at her berth (mooredAt), afloat and friendly (stanceOf: lawful, and no crown's hunt on me), of a hull that
   *  carries a passenger (passage.js PASSAGE_HULLS) and crosses a sea under this helm (`passageCrosses` - AUDIT PASSAGE B7:
   *  a Carrack under the Classic handling never sails, and every booking of her was undone) - and the look's ray on HER
   *  HULL within PASSAGE_RAY_M (AUDIT PASSAGE B6: a cone 60 degrees wide took the press meant for the quay's townsfolk,
   *  its nodes and its wagons from 18 m). Null at a helm, in a boarding, with the switch off or no passage door. */
  function passageShip() {
    if (!host.enabled() || host.boarding() || host.myBoat() || !deps.passage) return null;
    const look = deps.look?.();
    if (!look) return null;
    const a = look.origin, d = look.dir, b = [a[0] + d[0] * PASSAGE_RAY_M, a[1] + d[1] * PASSAGE_RAY_M, a[2] + d[2] * PASSAGE_RAY_M];
    let best = null, bestT = Infinity;
    for (const e of host.sea.values()) {
      const s = e.ship;
      if (e.liner || e.prize || e.retiring || !PASSAGE_HULLS.includes(s.hull) || !host.stanceOf(s).friendly || !mooredAt(e)) continue;
      if (deps.passageCrosses && !deps.passageCrosses(s.hull)) continue;
      const box = e.boat ? host.hullBox(e.boat) : null;
      const t = box ? segmentBoxEntry(a, b, box)?.t : null;   // the nearest hull the ray strikes
      if (t != null && t < bestT) { best = e; bestT = t; }
    }
    return best;
  }
  let passageSaid = null;
  /** The ship's word as the look comes onto her - once a ship, as the gangway's. */
  function passageHint() {
    const e = deps.passage ? passageShip() : null;
    if (e && e.id !== passageSaid) deps.say?.(passageHintText(e.ship.names?.name ?? null), 3);
    passageSaid = e?.id ?? null;
  }
  /**
   * PASSAGE BOOKED: the ship I booked made the boat I sail in - the naval host's claimPrize's first half on a sound ship.
   * Her deed minted at her worth (never into the pack or the Fleet's book: she is no ship of mine), her boat placed at her
   * berth as she lies (Come Sail Away's LaunchFromDeed), `charter` written on it (the voyage's record, saved with her),
   * and she never packs. Her hands are her boat's (a fresh state, every hand aboard). She still lies at her berth until
   * the voyage is under way (charterSailed) - a journey refused takes her boat back and leaves her as she was. Answers
   * the boat, or null (she is gone, or the placing failed - nothing changed).
   */
  function charter(id, record) {
    const e = host.sea.get(id), r = host.csa(), m = e ? mooredAt(e) : null;
    const h = m ? host.harbours.get(m.key)?.harbour : null, b = h?.berths?.[m.i];
    if (!e || !b || typeof r?.LaunchFromDeed !== 'function' || typeof deps.board?.mintUid !== 'function') return null;
    const s = e.ship, at = alongside(b, s.hull, h.hull), pos = [at[0], deps.seaY(), at[1]];
    const worth = prizeDeedValue(s.hull), deed = mintDeed(s.hull, s.variant ?? 0, deps.board.mintUid(), worth);
    let boat = null;
    try { boat = r.LaunchFromDeed(deed, [deed], pos, forwardOfYaw(b.yaw), deps.board.terrainAt?.(pos)); } catch (err) { console.warn('[naval] a booked ship would not be placed', err); }
    if (!boat) return null;
    boat.charter = record;
    boat.packable = false;   // never parts in my pack - so the crossing never plans a second launch of her (OWS2's `again`)
    return boat;
  }
  /** The voyage under way - she is let go from the sea without sinking (her boat stands in her place), and not stood at
   *  her berth again today. A ship another stands is mine to let go, as a boarding takes her over. */
  function charterSailed(id) {
    const e = host.sea.get(id), m = e ? mooredAt(e) : null;
    if (!e) return false;
    if (e.owner) host.adopt(e);
    host.departedOf(e.fromHarbour ?? m?.key, host.day()).add(e.ship.seed);
    host.drop(e);
    noteGone(e.ship.seed);   // AUDIT PASSAGE B5: and every player's - said in my word
    return true;
  }
  /** AUDIT PASSAGE B5: THE BOOKED SHIPS, EVERY PLAYER'S - each by her seed (harbourFrame's: her port's, the day's, her
   *  berth's), mine and every word's (the naval wire's `q`): no player stands her at her berth again that day, takes
   *  her over there or keeps a copy of her - one still lying there fades out - and each is said on in my word, the last
   *  NAVAL_WIRE_GONE (before, her letting go was mine alone: the next player to stand the port stood her again). */
  const gone = new Set();
  let said = [];
  function noteGone(seed) {
    if (!Number.isInteger(seed) || gone.has(seed)) return;
    gone.add(seed);
    said = [...said, seed].slice(-NAVAL_WIRE_GONE);
    for (const e of host.sea.values()) if (e.ship.seed === seed) host.retire(e);
  }
  const goneSeed = (seed) => gone.has(seed);
  const goneSaid = () => said;
  const hearGone = (seeds) => { for (const sd of seeds ?? []) noteGone(sd); };
  return { passageShip, passageHint, charter, charterSailed, goneSeed, goneSaid, hearGone };
}
