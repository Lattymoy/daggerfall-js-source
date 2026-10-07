// @ts-check
// GATE-CROWD (2026-10-07, Mac: "We need to not allow followers inside the oblivion gates, plus need some type of filter
// when there are too many people"): THE COURT'S CROWD, FILTERED ON THIS SCREEN. A court holds as many challengers as
// come (net/gateBrain.js GATE_FIGHTERS_MAX), and forty round one boss are forty bodies, names, lights, spells and
// footsteps over his telegraphs. In a gate's court, past the count the player chose (the Other players card - twelve,
// twenty-four or everyone) only that many other players are drawn: every party mate, then the nearest. The rest stand
// nowhere on this screen - no body, no sprite, no name, no light, no spell's flight, no step heard - until they are
// among the nearest again. Nothing of the fight is filtered: the relay judges every blow, and the boss, his host, the
// bar's count of challengers, the damage chart and the spoils are the fight's, never this screen's drawing.
//
// HELD PLACES. The drawn set is chosen again every frame, and a crowd milling at the edge of the count swapped players
// in and out - each one a sprite built and a Morrowind body handed over (net/peerBodies.js, WB9h's churn). A player
// drawn last frame keeps their place against one who is not until that one stands GATE_CROWD_HOLD_M nearer.
//
// THE COURT ALONE. Outside it the crowd is never cut: the street, a building and a dungeon hold duels, arena bouts and
// battles, where a player cut from the screen could be the one fighting me. In a court nobody fights anybody but him.
//
// The law is pure (`crowdDrawn`); `createGateCrowd` keeps the held places between frames for the host (scenes/world.js,
// the online frame's drawn peers). Not a DFU member: Daggerfall has no other players. Ledger A (GATE-CROWD).

/** The Other players card's choices: how many other players a gate's court draws at once (0: everyone). */
export const GATE_CROWD_TIERS = Object.freeze([12, 24, 0]);
/** Twelve, unless the player chose otherwise. */
export const GATE_CROWD_DEFAULT = 12;
/** A player drawn keeps their place against one who is not until that one stands this much nearer (m). */
export const GATE_CROWD_HOLD_M = 4;

/** The count a stored choice stands for - one of the tiers, else the default (an older or hand-edited shelf). */
export const gateCrowdMax = (v) => (GATE_CROWD_TIERS.includes(v) ? v : GATE_CROWD_DEFAULT);

/**
 * WHO IS DRAWN: of `peers` (each `{ id }`, standing at `at(peer)` - [x, y, z]), the ids drawn as `me` stands - every one
 * while there are no more than `max` (0: no count); past it, every party mate (`mate(id)`), then the others nearest on
 * the ground - one drawn last frame (`was`) reckoned `hold` nearer than they stand - until `max` are drawn. Ties go by
 * id, so a crowd is ordered alike every frame. `out` is refilled. Pure.
 * @param {ReadonlyArray<{ id: any }>} peers
 * @param {ArrayLike<number>} me
 * @param {{ at: (p: any) => ArrayLike<number>, max?: number, mate?: (id: any) => boolean, was?: Set<any>|null, hold?: number }} o
 * @param {Set<any>} [out]
 * @returns {Set<any>}
 */
export function crowdDrawn(peers, me, { at, max = GATE_CROWD_DEFAULT, mate = () => false, was = null, hold = GATE_CROWD_HOLD_M }, out = new Set()) {
  out.clear();
  if (!(max > 0) || peers.length <= max) {
    for (const p of peers) out.add(p.id);
    return out;
  }
  /** @type {{ id: any, d: number }[]} */
  const rest = [];
  for (const p of peers) {
    if (mate(p.id)) { out.add(p.id); continue; }
    const f = at(p);
    rest.push({ id: p.id, d: Math.hypot(f[0] - me[0], f[2] - me[2]) - (was?.has(p.id) ? hold : 0) });
  }
  rest.sort((a, b) => a.d - b.d || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
  for (let i = 0; i < rest.length && out.size < max; i++) out.add(rest[i].id);
  return out;
}

/**
 * THE HOST'S CROWD - `cut(peers, o)`: the peers drawn this frame, the places held from the frame before. `peers` itself
 * when every one is drawn, else a list refilled each frame; out of a court (`o.on` false) every peer, and the held
 * places forgotten - a court stepped into again chooses afresh. `shows(id)`: whether the last cut drew that player -
 * every player out of a court. The doors that answer a player on this screen ask it (the crosshair's pick and the
 * plaque, a gift's aim, a blow's spark and a cry): one the crowd leaves undrawn is not there to press, aim at or hear,
 * INVIS-NET's law for the concealed.
 */
export function createGateCrowd() {
  let held = new Set(), spare = new Set(), live = false;
  /** @type {any[]} */
  const drawn = [];
  return {
    /**
     * @template {{ id: any }} P
     * @param {P[]} peers
     * @param {{ on: boolean, me: ArrayLike<number>, at: (p: P) => ArrayLike<number>, max?: number, mate?: (id: any) => boolean }} o
     * @returns {P[]}
     */
    cut(peers, { on, me, at, max = GATE_CROWD_DEFAULT, mate = () => false }) {
      live = !!on;
      if (!on) { held.clear(); return peers; }
      const now = crowdDrawn(peers, me, { at, max, mate, was: held }, spare);
      spare = held; held = now;
      if (held.size === peers.length) return peers;
      drawn.length = 0;
      for (const p of peers) if (held.has(p.id)) drawn.push(p);
      return drawn;
    },
    /** Whether the last cut drew `id` - every player out of a court. */
    shows: (id) => !live || held.has(id),
    /** The ids drawn by the last cut (the tests' window on the held places). */
    held: () => held,
  };
}
