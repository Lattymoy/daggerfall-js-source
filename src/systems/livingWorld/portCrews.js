// @ts-check
// LW5 (2026-10-05, bible/06-Systems/Living-World.md): THE BAY'S SAILORS - a port town's sailors (census.js: a port's
// own, two to six) are the crews of the Bay's packets that call there (naval/seaLanes.js: every lane between the map's
// ports runs its packets out and back on the shared clock). Mac: NPCs "link with the ship AI at ports".
//
// A PORT'S PACKETS are every packet of every lane with the port at either end, lane by lane (their keys in order),
// packet by packet - and its sailors, in slot order, are dealt over them, round again (`berthOf`). So a packet's crew
// is the hands of both its ports dealt to her, and a port's sailors are scattered over every lane it keeps.
//
// WHERE A SAILOR IS is where their packet is, on HER clock - the shared one the naval host stands and steers her by
// (seaLanes.js packetAt): under way, AT SEA (aboard, in no town); lying at their own port, at HOME (ashore, their own
// day); lying at the far port, ABROAD - ashore there until her dwell is done (`until`, the shared second), a visitor in
// that town (`crewsAshore`). So the hands seen on a port's quay are the crews of the ships lying at it, and a ship seen
// leaving takes her hands with her. Pure: the packets' own function and the census in; where each is out.

/**
 * @typedef {{ key: string, a: { id: number }, b: { id: number } }} Lane - seaLanes.js laneNetwork's
 * @typedef {{ lane: Lane, k: number, count: number }} Berth - a packet: her lane, her place in it, the lane's count
 */

/**
 * The packets that call at a port: every packet of every lane with the port at either end, lane by lane, packet by
 * packet. `countOf(lane)` the lane's packets (0: a lane with no way on the water).
 * @param {readonly Lane[]} lanes @param {number} portId @param {(lane: Lane) => number} countOf @returns {Berth[]}
 */
export function portPackets(lanes, portId, countOf) {
  const out = [];
  for (const lane of [...lanes].sort((p, q) => (p.key < q.key ? -1 : p.key > q.key ? 1 : 0))) {
    if (lane.a.id !== portId && lane.b.id !== portId) continue;
    const n = countOf(lane) | 0;
    for (let k = 0; k < n; k++) out.push({ lane, k, count: n });
  }
  return out;
}

/** A sailor's packet: the port's sailors in slot order dealt over its packets, round again - or null (no packet calls).
 *  @param {{ slot: number }} res @param {readonly { slot: number }[]} sailors @param {readonly Berth[]} packets */
export function berthOf(res, sailors, packets) {
  const order = [...sailors].sort((p, q) => p.slot - q.slot);
  const i = order.findIndex((s) => s.slot === res.slot);
  return packets.length && i >= 0 ? packets[i % packets.length] : null;
}

/**
 * Where a sailor of `portId` is now: 'home' (ashore at their own port), 'sea' (aboard, under way) or 'abroad' (ashore
 * at the far port while their ship lies there: `port` its id, `until` her dwell's end, shared seconds). `packetAt(berth)`
 * the packet as the shared clock has her now (seaLanes.js packetAt's: `phase`, `port`, `until`). A sailor with no
 * packet is at home.
 * @param {Berth|null} berth @param {number} portId @param {(berth: Berth) => ({ phase: string, port?: { id: number } | null, until?: number | null } | null)} packetAt
 * @returns {{ at: 'home'|'sea'|'abroad', port?: number, until?: number }}
 */
export function sailorAt(berth, portId, packetAt) {
  if (!berth) return { at: 'home' };
  const p = packetAt(berth);
  if (!p) return { at: 'home' };
  if (p.phase !== 'dwell') return { at: 'sea' };
  if (p.port?.id === portId) return { at: 'home' };
  return { at: 'abroad', port: p.port?.id, until: p.until ?? undefined };
}

/**
 * THE CREWS ASHORE at a port from elsewhere: every packet calling here that lies here now, and of her crew the far
 * port's hands - each with her dwell's end (`until`, shared seconds). `sailorsOf(portId)` a port's sailors (census.js
 * travellerRoster's, none for a town the host does not know).
 * @param {number} portId @param {readonly Lane[]} lanes @param {(lane: Lane) => number} countOf
 * @param {(berth: Berth) => ({ phase: string, port?: { id: number } | null, until?: number | null } | null)} packetAt
 * @param {(portId: number) => readonly { slot: number }[]} sailorsOf
 * @returns {{ res: any, until: number, berth: Berth }[]}
 */
export function crewsAshore(portId, lanes, countOf, packetAt, sailorsOf) {
  const out = [];
  for (const berth of portPackets(lanes, portId, countOf)) {
    const p = packetAt(berth);
    if (!p || p.phase !== 'dwell' || p.port?.id !== portId) continue;
    const far = berth.lane.a.id === portId ? berth.lane.b.id : berth.lane.a.id;
    const theirs = portPackets(lanes, far, countOf);
    const sailors = sailorsOf(far) ?? [];
    for (const s of sailors) {
      const b = berthOf(s, sailors, theirs);
      if (b && b.lane.key === berth.lane.key && b.k === berth.k) out.push({ res: s, until: p.until ?? 0, berth });
    }
  }
  return out;
}
