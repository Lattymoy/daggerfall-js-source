// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW7b (2026-10-05, bible/06-Systems/Living-World.md "LW7b"): THE ARMED BEYOND THE WALLS - what a traveller's regard of
// the character comes to when the player meets them on the road. Mac: "make friends or enemies"; LW0: "a friend greets
// you by name, an enemy will not talk, and an armed one draws on you beyond the walls".
//
// The parties are pure (systems/livingWorld/trips.js); how each member regards the character is the character's own
// (relations.js). On the ground in the open world (`ready`), with the player near:
//  - AN ARMED ENEMY WHO COUNTS THE PLAYER HOSTILE (regard at HOSTILE_AT or below) DRAWS ON THEM within DRAW_M: stood
//    live as a foe of the encounter pool's own (loose, transient: never a save's), in their class, at their level, by
//    their name, where they walked - their party walks on without them, and the pool's own law (its senses, the
//    wilderness's notice) has them come;
//  - AN ARMED FRIEND (FRIEND_AT and above) COMES TO THE PLAYER'S SIDE within HELP_M while the player is fighting
//    (`fighting` - a foe on the player near): stood live as the player's ally (team PlayerAlly, a `shipmate` no blow of
//    the player's reaches), until the fight has been done CALM_S, and they go back to their party.
// THE END IS WHAT HAPPENS. A foe cut down is SLAIN - the character's hand (`slay`, seen: their party stood by), and their
// party's living turned against the player (`slain` - its other armed now hostile, if they were not). A friend cut down
// DIED at the player's side (`died` - their place empty for it; their town talks of it). The dead are the pool's own (a
// corpse to search). A stand left - the player past KEEP_M from where it was stood, nothing able to stand (indoors, the
// Overworld up, a sweep), a friend's fight done - is let go: the body taken out, the member back with their party.
//
// EVERY ALLOCATION HAS AN OWNER: each body stood is this layer's until it falls (then the pool's) or is let go;
// `clear()` takes out every one still standing (the roads' own clear: indoors, a mode's change, the teardown).
// ═══════════════════════════════════════════════════════════════════
import { membersAt, NATIVE_PER_M } from '../systems/livingWorld/trips.js';
import { firstNameOf } from '../systems/livingWorld/lines.js';

/** A hostile draws on the player this near (m) - a face known across a field. */
export const DRAW_M = 45;
/** A friend comes to the player's fight from this near (m). */
export const HELP_M = 70;
/** A stand is let go once the player is this far from where it was stood (m). */
export const KEEP_M = 200;
/** A friend goes back to their party once the player has been out of a fight this long (real seconds). */
export const CALM_S = 8;
/** A foe on the player this near (m) is a fight a friend comes to (the host's `fighting`). */
export const FIGHT_NEAR_M = 30;

/**
 * @param {{
 *   spawn: (mobileType: number, feet: number[], o: { yaw: number, level: number, allied: boolean, gender: string }) => Promise<any>,
 *   remove: (rec: any) => void,
 *   inPool: (rec: any) => boolean,
 *   ready: () => boolean,
 *   sceneOf: (nx: number, nz: number) => number[],
 *   relations: () => any,
 *   slay: (res: any, t: number, seen: boolean) => void,
 *   died: (res: any, t: number) => void,
 *   deadAt?: (res: any, t: number) => boolean,
 *   fighting: () => boolean,
 *   say?: (text: string) => void,
 *   door?: any,
 * }} deps - `ready()` whether a body can be stood now (on foot in the open world, nothing loading); `slay`/`died` the
 *   host's hand turns; `fighting()` whether a foe is on the player near; `door` the roads' handle each body carries
 */
export function createRoadStands(deps) {
  /** @type {Map<string, { res: any, trip: any, kind: 'foe'|'friend', at: { x: number, z: number }, rec: any, calm: number, failed: boolean }>} */
  const stands = new Map();
  const dayOf = (t) => Math.floor((t - 240) / 1440);

  const takeOut = (rec) => { try { if (rec && deps.inPool(rec)) deps.remove(rec); } catch (e) { console.warn('[road stands] a body would not leave', e?.message ?? e); } };
  function letGo(id) {
    const s = stands.get(id);
    if (!s) return;
    if (!s.rec?.dead) takeOut(s.rec);   // the dead are the pool's own
    stands.delete(id);
  }

  /** Stand a member: a foe (they draw on the player) or a friend (at the player's side), where they walked. */
  function stand(c, kind) {
    /** @type {{ res: any, trip: any, kind: 'foe'|'friend', at: { x: number, z: number }, rec: any, calm: number, failed: boolean }} */
    const s = { res: c.res, trip: c.trip, kind, at: { x: c.x, z: c.z }, rec: null, calm: 0, failed: false };
    stands.set(c.res.id, s);
    // a body the pool would not stand is FAILED: kept (no second try while it stands) and drawn by the roads again
    const fail = () => { s.failed = true; };
    Promise.resolve(deps.spawn(c.res.cls, deps.sceneOf(c.x, c.z), { yaw: c.yaw ?? 0, level: c.res.level ?? 1, allied: kind === 'friend', gender: c.res.sex ?? 'male' }))
      .then((rec) => {
        if (!rec) { fail(); return; }
        if (stands.get(c.res.id) !== s) { takeOut(rec); return; }
        rec.living = { id: c.res.id, res: c.res, town: deps.door ?? null };
        if (rec.entity) rec.entity.name = c.res.name;
        if (kind === 'friend') {
          rec.shipmate = true;
          if (rec.entity) { rec.entity.team = 'PlayerAlly'; rec.entity.mobileTeam = 'PlayerAlly'; }
        }
        s.rec = rec;
      })
      .catch(fail);
    const first = firstNameOf(c.res.name);
    deps.say?.(kind === 'foe' ? `${first} draws on you!` : `${first} comes to your side.`);
  }

  return {
    /**
     * One frame: each armed member on the road near the player stood where their regard has them stand, each stand read
     * - the fallen, the let go. `cands` the roads' own armed members on the road this minute ({ res, trip, x, z, yaw },
     * native), `here` the player's native place, `t` the clock's minute, `dt` the frame (real seconds), `ground`
     * whether the player is on the ground (the Overworld down).
     * @param {{ res: any, trip: any, x: number, z: number, yaw?: number }[]} cands @param {{ x: number, z: number } | null} here
     * @param {number} t @param {{ dt?: number, ground?: boolean }} [o]
     */
    frame(cands, here, t, { dt = 0, ground = true } = {}) {
      const can = !!here && ground && deps.ready();
      const rel = deps.relations?.();
      const day = dayOf(t);
      if (can && rel) {
        const fight = deps.fighting();
        for (const c of cands) {
          if (c.res?.cls == null || stands.has(c.res.id)) continue;
          if (deps.deadAt?.(c.res, t)) continue;   // AUDIT-B4: one a hand took - the roads' parties, read once a second, still walked them
          const distM = Math.hypot(c.x - here.x, c.z - here.z) / NATIVE_PER_M;
          const standing = rel.standing(c.res.id, day);
          if (standing === 'hostile' && distM <= DRAW_M) stand(c, 'foe');
          else if (standing === 'friend' && fight && distM <= HELP_M) stand(c, 'friend');
        }
      }
      for (const [id, s] of [...stands]) {
        if (s.rec?.dead) {
          if (s.kind === 'foe') {
            deps.slay(s.res, t, true);   // struck down before their party
            for (const m of membersAt(s.trip, t)) if (m.id !== s.res.id) rel?.note(m.id, 'slain', day);
          } else deps.died(s.res, t);   // fallen at the player's side
          stands.delete(id);
          continue;
        }
        const far = !here || Math.hypot(s.at.x - here.x, s.at.z - here.z) / NATIVE_PER_M > KEEP_M;
        if (s.kind === 'friend') s.calm = deps.fighting() ? 0 : s.calm + dt;
        if (far || !can || (s.kind === 'friend' && s.calm >= CALM_S)) letGo(id);
      }
    },
    /** Whether a member is stood here - a body of the pool now (or on its way), not the roads' to draw. @param {string} id */
    stood: (id) => { const s = stands.get(id); return !!s && !s.failed; },
    /** The stands (the probes; the pins). */
    stands: () => [...stands.values()],
    /** Every standing body taken out and every stand forgotten (the roads' own clear). */
    clear() { for (const id of [...stands.keys()]) letGo(id); },
    get size() { return stands.size; },
  };
}
