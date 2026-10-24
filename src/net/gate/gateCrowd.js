// @ts-check
// GATE-CROWD (2026-10-07, Mac: "We need to not allow followers inside the oblivion gates, plus need some type of filter
// when there are too many people"): THE CROWD, FILTERED ON THIS SCREEN. A court holds as many challengers as come
// (net/gate/gateBrain.js GATE_FIGHTERS_MAX), and forty round one boss are forty bodies, names, lights, spells and
// footsteps over his telegraphs. Past the count the player chose on the Other players card - twelve or twenty-four;
// everyone, the default, cuts nobody - only that many other players are drawn: those never cut (`crowdKept`: my party,
// my duel's opponent, my trade's partner, those I ride or sail with, a duel's two fighters), then the nearest to me. The
// rest stand nowhere on this screen - no body, no sprite, no name, no light, no spell's flight, no step heard - until
// they are among the nearest again. Nothing of a fight or a room is filtered: the relay judges every
// blow, and the boss, his host, the bar's count of challengers, the damage chart, the spoils, the map's marks and the chat
// are the room's, never this screen's.
//
// HELD PLACES. The drawn set is chosen again every frame, and a crowd milling at the edge of the count swapped players
// in and out - each one a sprite built and a Morrowind body handed over (net/peer/peerBodies.js, WB9h's churn). A player
// drawn last frame keeps their place against one who is not until that one stands GATE_CROWD_HOLD_M nearer.
//
// EVERYWHERE A STRANGER CANNOT FIGHT ME (CROWD-WIDE, 2026-10-23, the owner: "Can we implement the player toggle we have
// for the oblivion gate into the entire game? Like being able to see how many players you want to see at one time"). The
// count cut a gate's court alone until then: the street, a building and a dungeon hold duels, arena bouts and battles,
// where a player cut from the screen could be the one fighting me. Now it cuts everywhere but where that can be so - the
// open zone (WILD1's fair ground, its sea and its dungeons among it), while I am entered in a siege or a Royal Tourney,
// an arena's room - and under the travel view, where nothing is cut (OW-PEERS, as PEER-RANGE). A gate's court is cut
// whatever I am entered in: nobody fights anybody there but him. A player past the Other players card's draw distance is
// cut first (PEER-RANGE, net/peer/peerRange.js), and this count is taken from the players within it. AUDIT CROWD-WIDE
// (bible/01-Overview/audits/Audit-Crowd-Wide.md) added who is never cut and what goes with a cut player.
//
// The law is pure (`crowdDrawn`); `createGateCrowd` keeps the held places between frames for the host (scenes/world.js,
// the online frame's drawn peers, which asks where the count cuts). Not a DFU member: Daggerfall has no other players.
// Ledger A (GATE-CROWD, CROWD-WIDE).

/** The Other players card's choices: how many other players are drawn at once (0: everyone), the default first - the
 *  card's row shows the first for a stored value that is none of them, as gateCrowdMax reads it. */
export const GATE_CROWD_TIERS = Object.freeze([0, 12, 24]);
/** Everyone, unless the player chose otherwise (Mac, 2026-10-07: "The default other setting should be everyone"). */
export const GATE_CROWD_DEFAULT = 0;
/** A player drawn keeps their place against one who is not until that one stands this much nearer (m). */
export const GATE_CROWD_HOLD_M = 4;

/** The count a stored choice stands for - one of the tiers, else the default (an older or hand-edited shelf). */
export const gateCrowdMax = (v) => (GATE_CROWD_TIERS.includes(v) ? v : GATE_CROWD_DEFAULT);

/**
 * WHO IS DRAWN: of `peers` (each `{ id }`, standing at `at(peer)` - [x, y, z]), the ids drawn as `me` stands - every one
 * while there are no more than `max` (0: no count); past it, every one `mate(id)` answers for (the host's: my party and my
 * duel's opponent), then the others nearest on the ground - one drawn last frame (`was`) reckoned `hold` nearer than they
 * stand - until `max` are drawn. Ties go by id, so a crowd is ordered alike every frame. `out` is refilled. Pure.
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
 * THE KEPT (AUDIT CROWD-WIDE A2): the players the count never cuts, gathered once a frame as the host's `mate` - my
 * party (`party`, a Set, or null), the ones named (`ones`: my duel's opponent, my trade's partner - null where there is
 * none) and every id of `lists` (those I ride or sail with). A player I fight, trade with, sit beside in a wagon or stand
 * beside aboard a boat does not vanish at arm's length because a crowd came nearer. Pure.
 * @param {Iterable<any>|null|undefined} party
 * @param {ReadonlyArray<any>} ones
 * @param {...(Iterable<any>|null|undefined)} lists
 * @returns {(id: any) => boolean}
 */
export function crowdKept(party, ones, ...lists) {
  const kept = new Set(party ?? []);
  for (const id of ones) if (id != null) kept.add(id);
  for (const list of lists) if (list) for (const id of list) kept.add(id);
  return (id) => kept.has(id);
}

/**
 * THE HOST'S CROWD - `cut(peers, o)`: the peers drawn this frame, the places held from the frame before. `peers` itself
 * when every one is drawn, else a list refilled each frame; where the count does not cut (`o.on` false - the open zone,
 * a battle, an arena, the travel view) every peer, and the held places forgotten - the next place it cuts chooses
 * afresh. `shows(id)`: false only for a player the last cut left out by the count - one it never saw (filtered before
 * it, as a player below deck is, or not yet in the room) is not its to answer for, PEER-RANGE's law (AUDIT CROWD-WIDE
 * B4). The doors that answer a player on this screen ask it (the crosshair's pick and the plaque, a gift's aim, a page
 * handed, a blow's spark and a cry), and the things a player brings with them ask it (their team and wagon, their boat,
 * their torch): one the crowd leaves undrawn is not there to press, aim at or hear, and nothing of theirs stands without
 * them - INVIS-NET's law for the concealed.
 */
export function createGateCrowd() {
  let held = new Set(), spare = new Set();
  const gone = new Set();
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
      gone.clear();
      if (!on) { held.clear(); return peers; }
      const now = crowdDrawn(peers, me, { at, max, mate, was: held }, spare);
      spare = held; held = now;
      if (held.size === peers.length) return peers;
      drawn.length = 0;
      for (const p of peers) { if (held.has(p.id)) drawn.push(p); else gone.add(p.id); }
      return drawn;
    },
    /** Whether the last cut left `id` drawn - true for every player it did not cut by the count. */
    shows: (id) => !gone.has(id),
    /** The ids drawn by the last cut (the tests' window on the held places). */
    held: () => held,
  };
}
