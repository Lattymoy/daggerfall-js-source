// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW6 (2026-10-05, bible/06-Systems/Living-World.md): THE DIVERS MET - a party of the living world's adventurers inside
// the dungeon the player is in. Mac: "You can find them dungeon diving, make friends or enemies".
//
// A dive is pure (systems/livingWorld/trips.js diveTrip, diversAt): every reader's world holds the same company in the
// same dungeon for the same hours, and the deep's fated end (trouble.js diveTrouble). A player in that dungeon during
// its dive - the one to stand it (the camps' election online; offline always) - MEETS it: its members stood as the
// player's allies (the dungeon's own loose stand, allied: team PlayerAlly, a `shipmate`), behind the player, by name,
// class and level, and they keep with the player through the halls (the motor's own follow - characters/
// enemyMotor.js `follow`) until their hours are up.
// THE END IS WHAT HAPPENS. One cut down beside the player FELL (the character's turn: the place stands empty, a
// newcomer comes). Their hours done, the company makes for the surface: each the deep would have taken who still
// stands is SPARED, and every survivor's regard moved (`helped`; the spared `saved`). A party the dive no longer
// lists (its hours over, its leader fallen and its people out) is let go.
//
// LW7b: A COMPANY'S REGARD. One of its armed who counts the player HOSTILE draws on them: stood as a FOE (the dungeon's
// loose stand, not allied), by name, class and level - and the rest of the company keeps to its dive. Cut down, they are
// SLAIN (the character's hand, seen: their company stood by) and their company's living turned against the player. With
// none hostile, its ENEMIES keep away (no word for the player, no blade beside them) and the rest stand with the player;
// a company all enemies passes the player by.
//
// EVERY ALLOCATION HAS AN OWNER: each body stood is this layer's until its company leaves (a foe cut down the pool's
// own); `clear()` (the dungeon left, a sweep) forgets every one - the dungeon's pool goes with its context.
// ═══════════════════════════════════════════════════════════════════
import { membersAt } from '../systems/livingWorld/trips.js';
import { firstNameOf } from '../systems/livingWorld/lines.js';

/** How far behind the player a company is stood when met (m), and how near each keeps (m, the first; each after a pace
 *  further). */
export const DIVER_STAND_M = 5;
export const DIVER_HEEL_M = 3;
export const DIVER_HEEL_STEP_M = 1.2;

/**
 * @param {{
 *   spawn: (mobileType: number, feet: number[], o: { yaw: number, level: number, gender: string }) => Promise<any>,
 *   remove: (rec: any) => void,
 *   inPool: (rec: any) => boolean,
 *   leader: () => ({ feet: number[], yaw: number } | null),
 *   spot: (from: number[], dx: number, dz: number) => number[],
 *   owner: () => boolean,
 *   relations: () => any,
 *   turnKeyOf: (res: any, trip: any) => string,
 *   dies: (res: any, trip: any) => boolean,
 *   day: () => number,
 *   say?: (text: string) => void,
 *   door?: any,
 *   spawnFoe?: (mobileType: number, feet: number[], o: { yaw: number, level: number, gender: string }) => Promise<any>,
 *   slay?: (res: any, t: number, seen: boolean) => void,
 *   died?: (res: any, t: number) => void,
 * }} deps - `spot(from, dx, dz)` a place walked out from the player's feet (never inside a wall); `owner()` whether
 *   this player stands the divers here (the election); `day()` the living day (the regards' clock); LW7b `spawnFoe` the
 *   dungeon's loose stand for one who draws on the player, `slay(res, t, seen)` the host's hand turn
 */
export function createDungeonDivers(deps) {
  /** @type {Map<string, { trip: any, allies: Map<string, any>, foes: Map<string, any>, fell: Set<string>, met: boolean }>} */
  const companies = new Map();
  /** AUDIT-C2: the companies that made for the surface this visit - never met again in it. */
  const ended = new Set();

  const takeOut = (rec) => { try { if (deps.inPool(rec)) deps.remove(rec); } catch (e) { console.warn('[divers] a body would not leave', e?.message ?? e); } };
  function letGo(id) {
    const c = companies.get(id);
    if (!c) return;
    for (const rec of c.allies.values()) if (!rec.dead) takeOut(rec);   // AUDIT-C4: one cut down is the pool's own (their body, to be found)
    for (const rec of c.foes.values()) if (!rec.dead) takeOut(rec);   // LW7b: one cut down is the pool's own
    companies.delete(id);
  }
  const turn = (kind, key) => deps.relations?.()?.turn(kind, key);

  /** Meet a company: its members behind the player, keeping with them - LW7b: or its hostile drawing on them. */
  function meet(trip, members) {
    const L = deps.leader();
    if (!L) return;
    const c = { trip, allies: new Map(), foes: new Map(), fell: new Set(), met: true };
    companies.set(trip.id, c);
    const rel = deps.relations?.();
    const standing = (m) => rel?.standing(m.id, deps.day()) ?? 'neutral';
    const armed = members.filter((m) => m.cls != null);
    const hostile = deps.spawnFoe ? armed.filter((m) => standing(m) === 'hostile') : [];
    if (hostile.length) {
      // LW7b: one who counts the player HOSTILE draws on them - before the player, the rest of the company keeping to its dive
      hostile.forEach((m, i) => {
        const side = (i - (hostile.length - 1) / 2) * 1.4;
        const feet = deps.spot(L.feet, Math.sin(L.yaw) * DIVER_STAND_M + Math.cos(L.yaw) * side, Math.cos(L.yaw) * DIVER_STAND_M - Math.sin(L.yaw) * side);
        Promise.resolve(deps.spawnFoe?.(m.cls, feet, { yaw: L.yaw + Math.PI, level: m.level ?? 1, gender: m.sex ?? 'male' })).then((rec) => {
          if (!rec) return;
          if (companies.get(trip.id) !== c) { takeOut(rec); return; }
          rec.living = { id: m.id, res: m, town: deps.door ?? null };
          if (rec.entity) rec.entity.name = m.name;
          c.foes.set(m.id, rec);
        }).catch(() => {});
      });
      deps.say?.(`${trip.leader.name}'s company - and ${firstNameOf(hostile[0].name)} draws on you!`);
      return;
    }
    const stand = members.filter((m) => m.cls == null || (standing(m) !== 'enemy' && standing(m) !== 'hostile'));   // LW7b: an enemy keeps away
    if (!stand.some((m) => m.cls != null)) { deps.say?.(`${trip.leader.name}'s company passes you by.`); return; }
    stand.forEach((m, i) => {
      if (m.cls == null) return;
      const side = (i - (stand.length - 1) / 2) * 1.4;
      const back = DIVER_STAND_M + Math.floor(i / 3);
      const dx = -Math.sin(L.yaw) * back + Math.cos(L.yaw) * side, dz = -Math.cos(L.yaw) * back - Math.sin(L.yaw) * side;
      const feet = deps.spot(L.feet, dx, dz);
      Promise.resolve(deps.spawn(m.cls, feet, { yaw: L.yaw, level: m.level ?? 1, gender: m.sex ?? 'male' })).then((rec) => {
        if (!rec) return;
        if (companies.get(trip.id) !== c) { takeOut(rec); return; }
        rec.shipmate = true;
        rec.living = { id: m.id, res: m, town: deps.door ?? null };
        if (rec.entity) { rec.entity.name = m.name; rec.entity.team = 'PlayerAlly'; rec.entity.mobileTeam = 'PlayerAlly'; }
        if (rec.ai) rec.ai.follow = { feet: () => deps.leader()?.feet ?? null, stop: DIVER_HEEL_M + i * DIVER_HEEL_STEP_M };
        c.allies.set(m.id, rec);
      }).catch(() => {});
    });
    deps.say?.(`You meet ${trip.leader.name}'s company, come down into ${trip.to?.name ?? 'the deep'}.`);
  }

  /** LW7b: a company's foe cut down - slain by the player's hand before their company, its living turned against them. */
  function slain(c, mid, rec, t) {
    c.fell.add(mid);
    deps.slay?.(rec.living.res, t, true);
    const rel = deps.relations?.();
    for (const m of membersAt(c.trip, t)) if (m.id !== mid) rel?.note(m.id, 'slain', deps.day());
  }

  return {
    /**
     * One frame in the dungeon: each company diving here met (this player standing it), each read - the fallen, the
     * hours done - and each the dive lists no longer let go. `divers` trips.js diversAt's, at the clock's minute `t`.
     * @param {{ trip: any, members: any[] }[]} divers @param {number} t
     */
    frame(divers, t) {
      const listed = new Set();
      for (const { trip, members } of divers) {
        listed.add(trip.id);
        if (!companies.has(trip.id) && !ended.has(trip.id) && deps.owner() && members.some((m) => m.cls != null)) meet(trip, members);
      }
      for (const [id, c] of [...companies]) {
        for (const [mid, rec] of c.foes) if (rec.dead && !c.fell.has(mid)) slain(c, mid, rec, t);   // LW7b
        for (const [mid, rec] of c.allies) {
          if (!rec.dead || c.fell.has(mid)) continue;
          c.fell.add(mid);
          // cut down beside the player - AUDIT-C3: died at their side, at that minute (the old `fallen` waited for the deep's
          // own hour of the dive's trouble, and the company met again stood them up alive till then)
          if (deps.died) deps.died(rec.living.res, t); else turn('fallen', deps.turnKeyOf(rec.living.res, c.trip));
        }
        if (t >= c.trip.backT0 || !listed.has(id)) {
          // their hours done: the survivors make for the surface, the fated among them spared
          const rel = deps.relations?.();
          let left = 0;
          for (const [mid, rec] of c.allies) {
            if (c.fell.has(mid) || rec.dead) continue;
            const m = rec.living.res;
            const fated = deps.dies(m, c.trip);
            if (fated) turn('spared', deps.turnKeyOf(m, c.trip));
            rel?.note(m.id, fated ? 'saved' : 'helped', deps.day());
            left++;
          }
          if (left) deps.say?.(`${c.trip.leader.name}'s company make for the surface.`);
          letGo(id);
          ended.add(id);
        }
      }
    },
    /** The companies met here (the probes; the pins). */
    companies: () => [...companies.values()],
    /** LW6b: whether one of a company was stood here this time - their end is what happens here, not the deep's word
     *  (the host lays no remains of them). @param {string} tripId @param {string} resId */
    stood: (tripId, resId) => { const c = companies.get(tripId); return !!c && (c.allies.has(resId) || c.foes.has(resId)); },
    /** Every company forgotten (the dungeon left; a sweep) - its pool goes with it. */
    clear() { for (const id of [...companies.keys()]) letGo(id); ended.clear(); },
    get size() { return companies.size; },
  };
}
