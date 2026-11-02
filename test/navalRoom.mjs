// AUDIT NAV1 (2026-09-29) - the online audit's ROOM: several players' naval hosts over Come Sail Away's real pool, one
// pool each (test/navalSea.mjs freshPool), and a stand-in relay between them - each player's word (`nv`) on their foes
// frame at the world's own cadence (scenes/world.js: every FOES_MS when it changed, every FOES_FULL_MS always) and
// their blows as directed hit frames, both a `latency` late. A player can leave the cell (`present`), fall quiet
// (`quiet`: in the room, sending nothing) or lose the socket (`offline`: no id).
import { sea, freshPool } from './navalSea.mjs';

/**
 * @param {{ id: string, [k: string]: any }[]} specs - each player's sea (navalSea.mjs `sea` options) and id
 * @returns {Promise<{ clients: Map<string, any>, get(id: string): any, run(seconds: number, dt?: number): void, tick(dt: number): void, readonly t: number }>}
 */
export async function room(specs, { latency = 0.08, foesMs = 200, fullMs = 2000 } = {}) {
  const clients = new Map();
  const queue = [];
  let t = 0;
  const later = (fn) => queue.push({ at: t + latency, fn });
  for (const [i, spec] of specs.entries()) {
    const c = { id: spec.id, present: true, quiet: false, offline: false, lastSent: -Infinity, lastFull: -Infinity, key: null, sent: 0 };
    const peers = () => (c.present ? [...clients.values()].filter((o) => o !== c && o.present).map((o) => ({ id: o.id, feet: o.s.view.feet })) : []);
    const online = {
      id: () => (c.offline ? null : c.id),
      peers,
      sendHit: (d) => {
        if (!c.present || c.offline) return false;
        const body = JSON.parse(JSON.stringify(d));
        later(() => { const to = clients.get(body.to); if (to?.present) to.s.host.applyPeerHit(c.id, body); });
        return true;
      },
    };
    // the others' boats at their helms, as Come Sail Away's peers hand them: where, her way, her hull and her heading
    const peerBoats = () => (c.present ? [...clients.values()].filter((o) => o !== c && o.present && o.s.boat && o.s.runtime?.sailing)
      .map((o) => ({ id: o.id, pos: [...o.s.boat.GameObject.position], vel: [0, 0, 0], speed: 0, hull: o.s.boat.hull, yaw: 0, boat: o.s.boat })) : []);
    c.s = await sea({ seed: 5 + i * 7919, peerBoats, ...spec, pool: await freshPool(), online });   // each client its own stream, as Math.random is
    clients.set(spec.id, c);
  }
  /** The world's pump: the word rides a frame when it changed, and every fullMs always. */
  const pump = (c) => {
    const now = t * 1000;
    if (!c.present || c.quiet || c.offline || now - c.lastSent < foesMs) return;
    c.lastSent = now;
    const full = now - c.lastFull >= fullMs;
    const rec = c.s.host.word((p) => p);
    const key = rec ? JSON.stringify(rec) : '';
    if (!full && key === c.key) return;
    c.key = key;
    if (full) c.lastFull = now;
    c.sent++;
    for (const o of clients.values()) if (o !== c && o.present) later(() => o.s.host.applyWord(c.id, rec == null ? null : JSON.parse(key), (p) => p));
  };
  const tick = (dt) => {
    t += dt;
    for (const c of clients.values()) if (c.present) c.s.host.frame(dt);
    for (const c of clients.values()) pump(c);
    const due = queue.filter((m) => m.at <= t + 1e-9);
    for (const m of due) queue.splice(queue.indexOf(m), 1);
    for (const m of due) m.fn();
  };
  const run = (seconds, dt = 1 / 30) => { for (let i = 0; i < Math.round(seconds / dt); i++) tick(dt); };
  return { clients, get: (id) => clients.get(id), run, tick, get t() { return t; } };
}
