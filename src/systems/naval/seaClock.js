// @ts-check
// TIME-DILATION (2026-10-17, the owner: "fix a pre existing issue where AI can actually use the overworld as time
// dilation"; bible/03-World/Naval-Refit.md TIME-DILATION) - THE SEA'S CLOCK. The sea fight is stepped on the world's
// clock (scenes/world.js navalFrame: `dt * worldTimeScale()`, AUDIT NAV1's "the sea keeps the world's time"), so a fast
// traveller's x5 to x100, or Come Sail Away's helm keys, ran every ship of the sea at that rate - her sailing, her
// reloads, her volleys. Alone, that is the world's own time and the traveller's to keep (the journey and the helm hold
// it at x1 inside a hostile ship's reach - systems/travel/travelThreat.js foeRate, comeSailAway.js's own reset). ONLINE
// the sea is SHARED: its stander (the lowest id afloat, navalHost.js launchesTraffic) sails every ship of it for every
// player within NAVAL_SHARE_RADIUS, and those ships take on a peer's boat as well as mine - so my clock ran the AI at x30
// against a player at x1, and nothing of mine asked about a ship hostile to them alone (measured: a navy cutter hunting
// the peer fired 46 broadsides in twenty real seconds at x30 against 1 at x1). A shared sea keeps REAL time.
// Pure: the peers and my feet in, the seconds out.

/** Whether the sea about `feet` is shared - a peer (`{ feet: [x, y, z] }`) within `radius` metres, on the water's
 *  plane. */
export function sharedSea(peers, feet, radius) {
  if (!Array.isArray(peers) || !Array.isArray(feet)) return false;
  for (const p of peers) if (Array.isArray(p?.feet) && Math.hypot(p.feet[0] - feet[0], p.feet[2] - feet[2]) <= radius) return true;
  return false;
}
/** The sea's seconds for a frame of `dt` world seconds at the world's time scale `scale`: the world's own alone, real
 *  time on a shared sea. Never negative. */
export const seaSeconds = (dt, scale, shared) => {
  const d = Math.max(0, Number(dt) || 0);
  return shared && scale > 1 ? d / scale : d;
};
