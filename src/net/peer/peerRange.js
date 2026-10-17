// @ts-check
// PEER-RANGE (2026-10-10, the owner: "So for online performance, I believe the rendering of players far out is
// contributing to poor performance"): THE OTHERS, DRAWN AS FAR AS THEY CAN BE SEEN. A world cell hands the screen every
// player within the relay's range - RANGE_PIXELS, three map pixels either way (net/wire.js inRange): 2.5 km pixel to
// pixel, up to 3.3 km along an axis - and every one of them was drawn: the rider, the walker, the class sprite or the
// doll stepped and submitted, a lantern hung and swung, an aura's cape posed, a cast's missile flown, a blow's spark
// struck, every frame, for a figure a pixel or two tall at that distance. The renderer culls what is off the screen
// (PERF-CROWD2); nothing culled what is too far to see (PERF-PRIORITY's "what is left" item 5: "The sprite peers have
// no distance tier and no cap inside the relay's three map pixels").
//
// THE LAW: past the distance the player chose on the Other players card, a player stands nowhere on this screen -
// GATE-CROWD's cut (net/gate/gateCrowd.js), by distance in place of a count: no body, sprite, name, light, cast, spark or
// step, until they come back inside it. Their map marks stay (the host fills them from the room before this cut), and
// nothing of the room is filtered - the relay still hears and judges them; only this screen stops drawing them.
//
// THE DEFAULT IS PAST A SHOT'S REACH. Another player's arrow or spell flies MISSILE_SPEED for MISSILE_LIFESPAN_S
// (systems/spellcast.js): 25 x 8 = 200 m (x1.3 is a foe archer's aimed shot alone, BLOW.aimed.speed - 260 m, still
// short of it). At the default 300 m nobody who can reach me with a shot is cut - test/systems/peerrange.test.js holds the
// numbers together. The near tier (150 m) can; its row says so.
//
// ALWAYS DRAWN: a party mate (AUDIT PARTY8's "a party mate before a stranger"), and the player I duel, from its count
// on (duelMgr.opponent) - whatever the distance. The distance is asked first, the party only of a player past it. Under the travel view nothing is cut: OW-PEERS grows every player to be seen from up to 450 m overhead,
// across more ground than any tier.
//
// HELD AT THE EDGE. A player drawn last frame keeps being drawn until they stand PEER_RANGE_HOLD past the range, so one
// walking along the edge is not built and torn down at every step (a mobile sprite's bundle and a walker's figure go
// with the peer - net/remotePlayers.js, net/peer/peerRiders.js).
//
// The law is pure (`rangeDrawn`); `createPeerRange` keeps the held set between frames for the host (scenes/world.js,
// the online frame's drawn peers). Not a DFU member: Daggerfall has no other players. Ledger A (PEER-RANGE).

/** The Other players card's choices, metres on the ground from me (0: everyone the relay sends). Ascending, so the
 *  card's row steps outward; the default is the law's, not the first. */
export const PEER_RANGE_TIERS = Object.freeze([150, 300, 600, 0]);
/** Past a shot's reach (260 m, the header). */
export const PEER_RANGE_DEFAULT = 300;
/** A drawn player is kept until they stand this many times the range away. */
export const PEER_RANGE_HOLD = 1.1;

/** The range a stored choice stands for - one of the tiers, else the default (an older or hand-edited shelf). */
export const peerRangeOf = (v) => (PEER_RANGE_TIERS.includes(v) ? v : PEER_RANGE_DEFAULT);

/**
 * WHO IS DRAWN: of `peers` (each `{ id }`, standing at `at(peer)` - [x, y, z] in the scene, or null), the ids within
 * `range` of `me` on the ground - one drawn last frame (`was`) within `range * hold` - and every one `mate(id)` answers
 * for, wherever they stand. No range (0) or no `me` draws every one. A peer with no place is not drawn. `out` is
 * refilled. Pure.
 * @param {ReadonlyArray<{ id: any }>} peers
 * @param {ArrayLike<number>|null} me
 * @param {{ at: (p: any) => ArrayLike<number>|null, range?: number, mate?: (id: any) => boolean, was?: Set<any>|null, hold?: number }} o
 * @param {Set<any>} [out]
 * @returns {Set<any>}
 */
export function rangeDrawn(peers, me, { at, range = PEER_RANGE_DEFAULT, mate = () => false, was = null, hold = PEER_RANGE_HOLD }, out = new Set()) {
  out.clear();
  if (!(range > 0) || !me) {
    for (const p of peers) out.add(p.id);
    return out;
  }
  const near = range * range, kept = range * hold * range * hold;
  for (const p of peers) {
    const f = at(p);
    if (f) {
      const dx = f[0] - me[0], dz = f[2] - me[2];
      if (dx * dx + dz * dz <= (was?.has(p.id) ? kept : near)) { out.add(p.id); continue; }
    }
    if (mate(p.id)) out.add(p.id);   // AUDIT A L5: the party asked of a player past the range alone (social's answer allocates)
  }
  return out;
}

/**
 * THE HOST'S RANGE - `cut(peers, o)`: the peers drawn this frame. `peers` itself when every one is drawn, else a list
 * refilled each frame; off (`o.on` false - the travel view) or with no range, every peer, and the held set forgotten.
 * `shows(id)`: false only for a player the last cut left out for distance - one it never saw (filtered before it, or
 * not in the room) is not its to answer for. The doors that answer a player on this screen ask it, as they ask
 * GATE-CROWD's (the crosshair's pick and a gift's aim, a blow's spark and a cry).
 */
export function createPeerRange() {
  let held = new Set(), spare = new Set(), live = false;
  const gone = new Set();
  /** @type {any[]} */
  const drawn = [];
  return {
    /**
     * @template {{ id: any }} P
     * @param {P[]} peers
     * @param {{ on?: boolean, me: ArrayLike<number>|null, at: (p: P) => ArrayLike<number>|null, range?: number, mate?: (id: any) => boolean }} o
     * @returns {P[]}
     */
    cut(peers, { on = true, me, at, range = PEER_RANGE_DEFAULT, mate = () => false }) {
      gone.clear();
      live = !!on && range > 0 && !!me;
      if (!live) { held.clear(); return peers; }
      const now = rangeDrawn(peers, me, { at, range, mate, was: held }, spare);
      spare = held; held = now;
      if (held.size === peers.length) return peers;
      drawn.length = 0;
      for (const p of peers) { if (held.has(p.id)) drawn.push(p); else gone.add(p.id); }
      return drawn;
    },
    /** Whether the last cut left `id` drawn - true for every player it did not cut for distance. */
    shows: (id) => !gone.has(id),
    /** The ids drawn by the last cut while it was live (the tests' window on the held set). */
    held: () => held,
    /** Whether the last cut was live (a range, a place, not the travel view). */
    get live() { return live; },
  };
}
