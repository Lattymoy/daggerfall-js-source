// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW4b (2026-10-05, bible/06-Systems/Living-World.md): THE FIGHT, STOOD - a beset party near the player, fought for
// real and the player's to turn. Mac: NPCs "can encounter enemies in the overworld ... make friends or enemies".
//
// The trouble is pure (systems/livingWorld/trouble.js): every reader's world holds the same caravan beset at the same
// bend by the same foes, with the same end, and the roads' layer shows it fought (scenes/livingRoads.js). A player ON
// THE GROUND within LIVE_M of a party at its fight, and the one standing it (the camps' own election online - the
// lowest id near it, campEncounters.js amGroupRollOwner; offline always), stands it LIVE:
//  - THE FOES as the encounter pool's own (exteriorFoes.js spawnFoe - loose, transient: never a save's), each its kind,
//    at the encounter's level, stood FOE_STAND_M about the party's place facing it - shared online as any encounter's;
//  - THE PARTY'S ARMED as the player's allies (allied: team PlayerAlly - enemyTargets.js getTargets fights them; a
//    `shipmate` no blow of the player's reaches, combat/friendlyFire.js), each in their class at their own level and
//    name, where they stood in the ring. The unarmed stay in the ring as the roads draw them (no foe hunts a walker).
// THE END IS WHAT HAPPENS. Every foe dead: the fight WON (the character's turn `won` - trouble.js reads it, and the
// party walks on), each member the road would have taken who still stands SPARED, and each survivor's regard moved -
// `saved` the spared, `helped` the rest. An ally cut down FELL (the turn `fallen` - the lives read it: the place stands
// empty, a newcomer comes). Every armed ally down with foes standing: the fight LOST (the turn `lost`: the party flees
// home), and the foes are the player's own trouble now - left to the pool's own law. A fight left unfinished - the
// player gone past LIVE_KEEP_M, or LIVE_GRACE_MIN past its halt - is let go: its bodies taken out, the pure end
// standing (a member cut down in it is fallen all the same).
//
// EVERY ALLOCATION HAS AN OWNER: each body stood is this layer's until the fight ends - taken out at its end (the
// allies when the party walks on, the foes of a fight let go) or handed to the pool's own life (the foes of a fight
// lost) - and `clear()` takes out every one (the host's teardown, a fast travel's sweep, the living world switched off).
// ═══════════════════════════════════════════════════════════════════
import { membersAt } from '../systems/livingWorld/trips.js';
import { NATIVE_PER_M } from '../systems/livingWorld/trips.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';

/** A fight this near the player (m, on the ground) is stood live. */
export const LIVE_M = 150;
/** A live fight is let go once the player is past this (m). */
export const LIVE_KEEP_M = 260;
/** Its foes stand this near the party's place (m, nearest and farthest). */
export const FOE_STAND_M = Object.freeze([7, 13]);
/** A live fight not ended this long past its halt (minutes of the clock) is let go. */
export const LIVE_GRACE_MIN = 90;
/** AUDIT-B2: the ended fights remembered (never stood twice). */
export const ENDED_MAX = 64;

/**
 * @param {{
 *   spawn: (mobileType: number, feet: number[], o: { yaw: number, level: number, allied: boolean, gender: string }) => Promise<any>,
 *   remove: (rec: any) => void,
 *   inPool: (rec: any) => boolean,
 *   owner: (feet: number[]) => boolean,
 *   ready: () => boolean,
 *   sceneOf: (nx: number, nz: number) => number[],
 *   clock: () => number,
 *   relations: () => any,
 *   turnKeyOf: (res: any, trip: any) => string,
 *   dies: (res: any, trip: any) => boolean,
 *   died?: (res: any, t: number) => void,
 *   door?: any,
 *   onTurn?: () => void,
 * }} deps - `owner(feet)` whether this player stands a fight at those feet (the election); `ready()` whether a fight can
 *   be stood now (on foot in the open world, nothing loading); `turnKeyOf` a member's place and cycle (lives.js turnKey
 *   at the member's own cycle); `dies` whether the lives take a member on the trip; `door` the roads' handle each ally
 *   carries (`living.town`)
 */
export function createRoadFights(deps) {
  /** @type {Map<string, { trip: any, enc: any, at: number[], foes: any[], allies: Map<string, any>, state: 'standing'|'live'|'won'|'lost', fell: Set<string> }>} */
  const fights = new Map();
  /** AUDIT-B2: the fights that ENDED here (won or lost) - never stood again for the rest of their window. Bounded. */
  const ended = new Set();
  const day = () => Math.floor((deps.clock() - 240) / 1440);

  const takeOut = (rec) => { try { if (deps.inPool(rec)) deps.remove(rec); } catch (e) { console.warn('[road fights] a body would not leave', e?.message ?? e); } };
  /** Let a fight go: its bodies out (a fight lost leaves its foes to the pool's own law). */
  function letGo(id) {
    const f = fights.get(id);
    if (!f) return;
    for (const rec of f.allies.values()) if (!rec.dead) takeOut(rec);   // AUDIT-C4: one cut down is the pool's own (a corpse to search, as a foe's)
    if (f.state !== 'lost') for (const rec of f.foes) takeOut(rec);
    if (f.state === 'won' || f.state === 'lost') { ended.add(id); if (ended.size > ENDED_MAX) ended.delete(ended.values().next().value); }
    fights.delete(id);
  }

  /** Stand a fight: its foes about the party's place, the party's armed where they stand. */
  function stand(trip, at, t) {
    const enc = trip.enc;
    /** @type {{ trip: any, enc: any, at: number[], foes: any[], allies: Map<string, any>, state: 'standing'|'live'|'won'|'lost', fell: Set<string> }} */
    const f = { trip, enc, at: deps.sceneOf(at.x, at.z), foes: [], allies: new Map(), state: 'standing', fell: new Set() };
    fights.set(enc.id, f);
    const [near, far] = FOE_STAND_M;
    const turn = (lwSeed(textSeed(enc.id), 0x6c697665) % 628) / 100;   // 'live'
    const stands = [];
    enc.foes.forEach((type, i) => {
      const a = ((i + 0.5) / enc.foes.length) * Math.PI * 2 + turn;
      const r = (near + ((lwSeed(textSeed(enc.id), i, 0x72) % 1000) / 1000) * (far - near)) * NATIVE_PER_M;
      const nx = at.x + Math.sin(a) * r, nz = at.z + Math.cos(a) * r;
      const feet = deps.sceneOf(nx, nz);
      stands.push(Promise.resolve(deps.spawn(type, feet, { yaw: Math.atan2(f.at[0] - feet[0], f.at[2] - feet[2]), level: enc.level, allied: false, gender: 'male' }))
        .then((rec) => { if (rec) { if (fights.get(enc.id) !== f) takeOut(rec); else { rec._lwFight = enc.id; f.foes.push(rec); } } }));
    });
    const members = membersAt(trip, t);
    const rel = deps.relations?.();
    members.forEach((m, i) => {
      if (m.cls == null) return;
      const standing = rel?.standing(m.id, day());
      if (standing === 'enemy' || standing === 'hostile') return;   // LW7b: no enemy of the player's fights beside them - they keep the ring
      const a = (i / Math.max(1, members.length)) * Math.PI * 2;
      const feet = deps.sceneOf(at.x + Math.sin(a) * 64, at.z + Math.cos(a) * 64);
      stands.push(Promise.resolve(deps.spawn(m.cls, feet, { yaw: a, level: m.level ?? 1, allied: true, gender: m.sex ?? 'male' }))
        .then((rec) => {
          if (!rec) return;
          if (fights.get(enc.id) !== f) { takeOut(rec); return; }
          rec._lwFight = enc.id;
          rec.shipmate = true;
          rec.living = { id: m.id, res: m, town: deps.door ?? null };
          if (rec.entity) { rec.entity.name = m.name; rec.entity.team = 'PlayerAlly'; rec.entity.mobileTeam = 'PlayerAlly'; }
          f.allies.set(m.id, rec);
        }));
    });
    Promise.all(stands).then(() => { if (fights.get(enc.id) === f && f.state === 'standing') f.state = 'live'; }).catch(() => letGo(enc.id));
  }

  /** A turn of the character's, and the host's books told. */
  function turn(kind, key) {
    const rel = deps.relations?.();
    if (rel?.turn(kind, key)) deps.onTurn?.();
  }
  /** AUDIT-C3: an ally cut down beside the player DIED at their side, at that minute (the host's hand turn - gone from the
   *  party from then, their body the pool's, their town's talk); a host without one keeps the old `fallen`. */
  function fell(res, trip, t) {
    if (deps.died) { deps.died(res, t); deps.onTurn?.(); } else turn('fallen', deps.turnKeyOf(res, trip));
  }

  /** Read a live fight: the fallen, the won, the lost. */
  function judge(f, t) {
    if (f.state !== 'live') return;
    for (const [id, rec] of f.allies) {
      if (!rec.dead || f.fell.has(id)) continue;
      f.fell.add(id);
      fell(rec.living.res, f.trip, t);   // cut down beside the player: the lives read it
    }
    const foesStanding = f.foes.filter((rec) => !rec.dead && deps.inPool(rec));
    const foesFell = f.foes.filter((rec) => rec.dead).length;
    if (!foesStanding.length && foesFell > 0) {
      f.state = 'won';
      turn('won', f.enc.id);
      const rel = deps.relations?.();
      // AUDIT-B3: standing at the win - the party's members at this minute AND every ally stood still on their feet: a
      // fated ally stood before the road's minute for their fall, alive at the win, is spared (read off the road alone
      // they were already its dead, never spared - and their body drawn beside them)
      const standing = new Map(membersAt(f.trip, t).map((m) => [m.id, m]));
      for (const [id, rec] of f.allies) if (!rec.dead && rec.living?.res) standing.set(id, rec.living.res);
      for (const m of standing.values()) {
        if (f.fell.has(m.id)) continue;
        const fated = deps.dies(m, f.trip);
        if (fated) turn('spared', deps.turnKeyOf(m, f.trip));
        rel?.note(m.id, fated ? 'saved' : 'helped', day());
      }
      return;
    }
    const armed = [...f.allies.values()];
    if (armed.length && armed.every((rec) => rec.dead) && foesStanding.length) {
      f.state = 'lost';
      turn('lost', f.enc.id);
    }
  }

  return {
    /**
     * One frame: each beset party near the player stood live where this player stands it, each live fight read, each
     * fight done or left let go. `parties` the roads' own ({ trip, at } at the clock's minute), `here` the player's
     * native place, `ground` whether the player is on the ground (the Overworld down).
     * @param {{ trip: any, at: any }[]} parties @param {{ x: number, z: number } | null} here @param {number} t @param {{ ground?: boolean }} [o]
     */
    frame(parties, here, t, { ground = true } = {}) {
      const can = !!here && deps.ready();
      if (can && ground) {
        for (const p of parties) {
          const { trip, at } = p;
          if (!at?.fight || !trip?.enc?.foes?.length || fights.has(trip.enc.id) || ended.has(trip.enc.id)) continue;
          if (Math.hypot(at.x - here.x, at.z - here.z) / NATIVE_PER_M > LIVE_M) continue;
          if (!deps.owner(deps.sceneOf(at.x, at.z))) continue;
          stand(trip, at, t);
        }
      }
      for (const [id, f] of [...fights]) {
        judge(f, t);
        const far = !here || Math.hypot(f.trip.enc.x - here.x, f.trip.enc.z - here.z) / NATIVE_PER_M > LIVE_KEEP_M;
        const late = t > f.enc.t1 + LIVE_GRACE_MIN;
        const walkedOn = f.state === 'won' && t >= f.enc.t1;   // the halt over: the party walks on, its own again
        if (far || late || walkedOn || !can) letGo(id);
      }
    },
    /** Whether a party's fight is stood here - its foes and its armed are bodies of the pool, not the roads'. @param {string} tripId */
    stood(tripId) { for (const f of fights.values()) if (f.trip.id === tripId) return true; return false; },
    /** The members of a party stood as allies here (the roads draw them not). @param {string} tripId */
    alliesOf(tripId) { for (const f of fights.values()) if (f.trip.id === tripId) return new Set(f.allies.keys()); return new Set(); },
    /**
     * Whether a beset party near the player is a PEER's to stand (online: another player elected for it) - the roads
     * show no foes of their own for it; the peer's come through the stream.
     * @param {{ x: number, z: number }} at @param {{ x: number, z: number } | null} here
     */
    peerStands(at, here) { return !!here && Math.hypot(at.x - here.x, at.z - here.z) / NATIVE_PER_M <= LIVE_M && !deps.owner(deps.sceneOf(at.x, at.z)); },
    /** The fights stood (the probes; the pins). */
    fights: () => [...fights.values()],
    /** Every body taken out and every fight forgotten (the host's teardown, a sweep, the switch off). */
    clear() { for (const id of [...fights.keys()]) letGo(id); },
    get size() { return fights.size; },
  };
}
