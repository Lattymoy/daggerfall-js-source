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
// LW14 (2026-10-09, bible/06-Systems/Living-World-II.md "LW14"): THE DEEP'S OWN. Where the dungeon's stops are known
// (`route` - systems/livingWorld/deepRoute.js: the company's way through its rooms), a company is MET WHERE ITS ROUTE
// HAS IT, not behind the player: stood about its stop (or the floor between two) once the player is within DEEP_NEAR_M
// of it, or within DEEP_SEE_M with a clear line - and HOLDING there, fighting what it fights (a classic motor walks no
// straight line through a wall). Not met yet, a company fighting within DEEP_HEAR_M rings steel ("You hear fighting
// ahead." once). Its leader OFFERS (the talk's door, `offers`): JOIN US (they follow the player, along the player's own
// TRAIL round the corners), LEAD ON (they walk on to their next stop, the player along), PART WAYS (they keep to their
// own). HURT: a member under RETREAT_HP falls back; the company under half its strength makes for the way out. A RIVAL
// (not joined, its head no friend) minds its finds: the player taking from the treasure at the stop it makes for costs
// each of it `poached`, with a word. A company left past DEEP_KEEP_M is let go, to be met again further on its way.
//
// EVERY ALLOCATION HAS AN OWNER: each body stood is this layer's until its company leaves (a foe cut down the pool's
// own); `clear()` (the dungeon left, a sweep) forgets every one - the dungeon's pool goes with its context.
// ═══════════════════════════════════════════════════════════════════
import { membersAt } from '../systems/livingWorld/trips.js';
import { firstNameOf } from '../systems/livingWorld/lines.js';
import { pointAt, stopAt } from '../systems/livingWorld/deepRoute.js';   // LW14: where their route has them
import { headOf } from '../systems/livingWorld/companies.js';   // LW14: the company's word, its head's

/** How far behind the player a company is stood when met (m), and how near each keeps (m, the first; each after a pace
 *  further). */
export const DIVER_STAND_M = 5;
export const DIVER_HEEL_M = 3;
export const DIVER_HEEL_STEP_M = 1.2;
/** LW14: a company is met within DEEP_NEAR_M of its place (m), or within DEEP_SEE_M with a clear line; heard fighting
 *  within DEEP_HEAR_M; let go past DEEP_KEEP_M. */
export const DEEP_NEAR_M = 15;
export const DEEP_SEE_M = 35;
export const DEEP_HEAR_M = 60;
export const DEEP_KEEP_M = 70;
/** LW14: steel rings this often (real seconds) from a fight heard. */
export const DEEP_RING_S = 2.5;
/** LW14: a member under this share of their health falls back (m further behind). */
export const RETREAT_HP = 0.3;
export const RETREAT_BACK_M = 4;
/** LW14: the player's trail (crewAshore.js's own: a crumb each TRAIL_STEP_M, TRAIL_MAX kept, a jump past TRAIL_JUMP_M
 *  begins it again). */
export const DIVER_TRAIL_STEP_M = 0.75;
export const DIVER_TRAIL_MAX = 64;
export const DIVER_TRAIL_JUMP_M = 8;
/** LW14: a rival's word, a find taken before them. @param {string} name */
export const POACHED_LINE = (name) => `${name}: "That was ours to find."`;

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
 *   route?: (trip: any) => any,
 *   floor?: (x: number, y: number, z: number) => number[],
 *   clearLine?: (a: number[], b: number[]) => boolean,
 *   ring?: (feet: number[]) => void,
 *   choose?: (lines: string[], options: { code: string, label: string, action: () => void }[]) => void,
 *   stopPile?: (key: string) => any,
 *   realNow?: () => number,
 * }} deps - `spot(from, dx, dz)` a place walked out from the player's feet (never inside a wall); `owner()` whether
 *   this player stands the divers here (the election); `day()` the living day (the regards' clock); LW7b `spawnFoe` the
 *   dungeon's loose stand for one who draws on the player, `slay(res, t, seen)` the host's hand turn; LW14 `route(trip)`
 *   the dive's route over this dungeon's stops (none: met behind the player, as before), `floor` a point's floor,
 *   `clearLine` whether nothing stands between two feet, `ring(feet)` steel at a place, `choose` the talk's choice
 *   window, `stopPile(key)` a stop's treasure pile, `realNow()` real seconds
 */
export function createDungeonDivers(deps) {
  /** @type {Map<string, any>} */
  const companies = new Map();
  /** AUDIT-C2: the companies that made for the surface this visit - never met again in it. */
  const ended = new Set();
  /** LW14: the companies heard (said once) and the next ring of each fight heard. */
  const heard = new Set();
  const rings = new Map();
  /** LW14: the player's trail (crewAshore.js's law): where they walked in this dungeon, oldest first. @type {number[][]} */
  const trail = [];
  let leaderWas = /** @type {number[] | null} */ (null);
  const realNow = () => deps.realNow?.() ?? Date.now() / 1000;
  let lastT = 0;   // LW14: the frame's minute (the door's choices read it)

  const takeOut = (rec) => { try { if (deps.inPool(rec)) deps.remove(rec); } catch (e) { console.warn('[divers] a body would not leave', /** @type {any} */ (e)?.message ?? e); } };
  function letGo(id) {
    const c = companies.get(id);
    if (!c) return;
    for (const rec of c.allies.values()) if (!rec.dead) takeOut(rec);   // AUDIT-C4: one cut down is the pool's own (their body, to be found)
    for (const rec of c.foes.values()) if (!rec.dead) takeOut(rec);   // LW7b: one cut down is the pool's own
    companies.delete(id);
  }
  const turn = (kind, key) => deps.relations?.()?.turn(kind, key);

  /** LW14: a crumb of the player's trail. @param {number[]} feet */
  function drop(feet) {
    if (leaderWas && Math.hypot(feet[0] - leaderWas[0], feet[1] - leaderWas[1], feet[2] - leaderWas[2]) > DIVER_TRAIL_JUMP_M) trail.length = 0;
    leaderWas = [feet[0], feet[1], feet[2]];
    const last = trail[trail.length - 1];
    if (last && Math.hypot(feet[0] - last[0], feet[2] - last[2]) < DIVER_TRAIL_STEP_M) return;
    trail.push([feet[0], feet[1], feet[2]]);
    if (trail.length > DIVER_TRAIL_MAX) trail.shift();
  }
  /** The player's heel for the `i`th of a company, along the trail round the corners. @param {number} i */
  const heelOf = (i) => ({ feet: () => deps.leader()?.feet ?? null, stop: DIVER_HEEL_M + i * DIVER_HEEL_STEP_M, trail: () => trail });

  /** Meet a company: its members behind the player, keeping with them - LW7b: or its hostile drawing on them. LW14: or,
   *  `at` its place on its route, stood about it and holding there. */
  function meet(trip, members, at = null) {
    const L0 = deps.leader();
    if (!L0) return;
    const L = at ? { feet: at, yaw: Math.atan2(L0.feet[0] - at[0], L0.feet[2] - at[2]) } : L0;
    const c = { trip, allies: new Map(), foes: new Map(), fell: new Set(), met: true, mode: at ? 'hold' : 'join', at, size: members.filter((m) => m.cls != null).length, going: null, pile: null, parted: false };
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
      const back = at ? 1.5 + Math.floor(i / 3) : DIVER_STAND_M + Math.floor(i / 3);   // LW14: met at their place, about it
      const dx = -Math.sin(L.yaw) * back + Math.cos(L.yaw) * side, dz = -Math.cos(L.yaw) * back - Math.sin(L.yaw) * side;
      const feet = deps.spot(L.feet, dx, dz);
      Promise.resolve(deps.spawn(m.cls, feet, { yaw: L.yaw, level: m.level ?? 1, gender: m.sex ?? 'male' })).then((rec) => {
        if (!rec) return;
        if (companies.get(trip.id) !== c) { takeOut(rec); return; }
        rec.shipmate = true;
        rec.living = { id: m.id, res: m, town: deps.door ?? null };
        if (rec.entity) { rec.entity.name = m.name; rec.entity.team = 'PlayerAlly'; rec.entity.mobileTeam = 'PlayerAlly'; }
        rec.heel = i;
        if (rec.ai && !at) rec.ai.follow = heelOf(i);   // LW14: along the trail; met at their place, they hold it
        c.allies.set(m.id, rec);
      }).catch(() => {});
    });
    const name = trip.company?.name ?? `${trip.leader.name}'s company`;
    deps.say?.(at ? `You come upon ${name}, at work in ${trip.to?.name ?? 'the deep'}.` : `You meet ${name}, come down into ${trip.to?.name ?? 'the deep'}.`);
  }

  /** LW7b: a company's foe cut down - slain by the player's hand before their company, its living turned against them. */
  function slain(c, mid, rec, t) {
    c.fell.add(mid);
    deps.slay?.(rec.living.res, t, true);
    const rel = deps.relations?.();
    for (const m of membersAt(c.trip, t)) if (m.id !== mid) rel?.note(m.id, 'slain', deps.day());
  }

  /** The survivors make for the surface - their regard, the fated among them spared - and the company is let go. */
  function makeOut(id, c, line) {
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
    if (left) deps.say?.(line);
    letGo(id);
    ended.add(id);
  }

  /** LW14: the stop a company makes for from minute `t` (its next, or the one LEAD ON walks to), or null. */
  function nextStop(c, t) {
    if (c.going) return c.going.stop;
    const route = deps.route?.(c.trip);
    if (!route) return null;
    const s = stopAt(route, t);
    const now = s?.at ?? (s?.between ? s.between[1] : null);
    const i = now ? route.legs.findIndex((l) => l.stop === now) : -1;
    return route.legs[s?.at ? i + 1 : Math.max(0, i)]?.stop ?? null;
  }
  /** LW14: lead on - each member walks to the next stop's floor (the motor's own walk), the player along. */
  function leadOn(c, t) {
    const route = deps.route?.(c.trip);
    const from = c.going ? route?.legs.findIndex((l) => l.stop === c.going.stop) ?? -1 : -1;
    const s = from >= 0 ? route?.legs[from + 1]?.stop ?? null : nextStop(c, t);
    if (!s) return false;
    const feet = deps.floor ? deps.floor(s.x, s.y, s.z) : [s.x, s.y, s.z];
    for (const rec of c.allies.values()) if (rec.ai && !rec.dead) rec.ai.follow = { feet: () => feet, stop: 1.5 + (rec.heel ?? 0) * 0.8 };
    c.going = { stop: s, feet };
    c.mode = 'lead';
    return true;
  }
  /** LW14: join us - they follow the player along the trail. */
  function join(c) {
    for (const rec of c.allies.values()) if (rec.ai && !rec.dead) rec.ai.follow = heelOf(rec.heel ?? 0);
    c.mode = 'join'; c.going = null;
  }

  return {
    /**
     * One frame in the dungeon: each company diving here met (this player standing it), each read - the fallen, the
     * hours done - and each the dive lists no longer let go. `divers` trips.js diversAt's, at the clock's minute `t`.
     * LW14: a company with a route met where it has it, heard fighting, led on, hurt, a rival to the player's finds.
     * @param {{ trip: any, members: any[] }[]} divers @param {number} t
     */
    frame(divers, t) {
      lastT = t;
      const L = deps.leader();
      if (L) drop(L.feet);
      const listed = new Set();
      for (const { trip, members } of divers) {
        listed.add(trip.id);
        if (companies.has(trip.id) || ended.has(trip.id) || !deps.owner() || !members.some((m) => m.cls != null)) continue;
        const route = deps.route?.(trip) ?? null;
        if (!route || !route.legs?.length) { meet(trip, members); continue; }
        // LW14: where its route has it - met near, or seen; else heard at its fight
        const p = pointAt(route, t);
        if (!p || !L) continue;
        const at = deps.floor ? deps.floor(p.x, p.y ?? L.feet[1], p.z) : [p.x, p.y ?? L.feet[1], p.z];
        const d = Math.hypot(at[0] - L.feet[0], at[2] - L.feet[2]);
        if (d <= DEEP_NEAR_M || (d <= DEEP_SEE_M && (deps.clearLine?.(L.feet, at) ?? false))) { meet(trip, members, at); continue; }
        const s = stopAt(route, t);
        if (s?.fighting && d <= DEEP_HEAR_M) {
          const now = realNow();
          if (!heard.has(trip.id)) { heard.add(trip.id); deps.say?.('You hear fighting ahead.'); }
          if (now >= (rings.get(trip.id) ?? 0)) { rings.set(trip.id, now + DEEP_RING_S); deps.ring?.(at); }
        }
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
        const name = c.trip.company?.name ?? `${c.trip.leader.name}'s company`;
        if (t >= c.trip.backT0 || !listed.has(id)) { makeOut(id, c, `${name} make for the surface.`); continue; }   // their hours done
        // LW14: HURT - one under RETREAT_HP falls back; under half its strength the company makes for the way out
        const standing = [...c.allies.values()].filter((rec) => !rec.dead);
        if (c.allies.size && c.size > 1 && standing.length * 2 < c.size) { makeOut(id, c, `${name} have had enough - they make for the way out.`); continue; }
        for (const rec of standing) {
          const e = rec.entity;
          if (!e || !rec.ai?.follow || rec.fellBack || !(e.maxHealth > 0) || e.health / e.maxHealth >= RETREAT_HP) continue;
          rec.fellBack = true;
          const f = rec.ai.follow;
          rec.ai.follow = { ...f, stop: (f.stop ?? DIVER_HEEL_M) + RETREAT_BACK_M };
        }
        // LW14: LEAD ON - at the stop, on to the next (the player along); none left, they hold
        if (c.mode === 'lead' && c.going && standing.every((rec) => !rec.ai?.feet || Math.hypot(rec.ai.feet[0] - c.going.feet[0], rec.ai.feet[2] - c.going.feet[2]) < 3)) {
          if (!leadOn(c, t)) c.mode = 'hold';
        }
        // LW14: A RIVAL minds its finds - the treasure at the stop it makes for, taken by the player before them
        if (c.mode !== 'join' && deps.stopPile && L) {
          const s = nextStop(c, t);
          const pile = s?.kind === 'treasure' ? deps.stopPile(s.key) : null;
          if (pile !== c.pile?.pile) c.pile = pile ? { pile, n: pile.items?.length ?? 0, at: s } : null;
          const head = headOf(standing.map((rec) => rec.living?.res).filter(Boolean));
          const rel = deps.relations?.();
          if (c.pile && head && rel?.standing(head.id, deps.day()) !== 'friend') {
            const n = c.pile.pile.items?.length ?? 0;
            const near = Math.hypot(c.pile.at.x - L.feet[0], c.pile.at.z - L.feet[2]) < 4;
            if (n < c.pile.n && near) {
              for (const rec of standing) rel?.note(rec.living.res.id, 'poached', deps.day());
              deps.say?.(POACHED_LINE(firstNameOf(head.name)));
            }
            c.pile.n = n;
          }
        }
        // LW14: left behind - let go, to be met again further on its way
        if (c.at && L && c.mode !== 'join') {
          const ref = c.going?.feet ?? c.at;
          if (Math.hypot(ref[0] - L.feet[0], ref[2] - L.feet[2]) > DEEP_KEEP_M) letGo(id);
        }
      }
    },
    /**
     * LW14: THE DOOR - a company's head (or any of a held one) asks what the player would: JOIN US, LEAD ON, PART WAYS,
     * talk. Answers whether a choice was opened (the talk behind it). @param {any} person @param {() => void} talk
     */
    offers(person, talk) {
      const id = person?.living?.id;
      if (!id || !deps.choose) return false;
      for (const c of companies.values()) {
        if (!c.allies.has(id) || c.parted || c.mode === 'join') continue;
        const name = firstNameOf(person.living.res?.name ?? '');
        deps.choose([`${name}: "Well met, down here. What'll it be?"`], [
          { code: 'KeyJ', label: 'J - join us', action: () => join(c) },
          { code: 'KeyL', label: 'L - lead on', action: () => { if (!leadOn(c, lastT)) deps.say?.(`${name}: "We're done here - nowhere left to lead."`); } },
          { code: 'KeyP', label: 'P - part ways', action: () => { c.parted = true; c.mode = 'hold'; } },
          { code: 'KeyA', label: 'A - talk', action: () => talk() },
          { code: 'Escape', label: 'Esc - goodbye', action: () => {} },
        ]);
        return true;
      }
      return false;
    },
    /** The companies met here (the probes; the pins). */
    companies: () => [...companies.values()],
    /** LW6b: whether one of a company was stood here this time - their end is what happens here, not the deep's word
     *  (the host lays no remains of them). @param {string} tripId @param {string} resId */
    stood: (tripId, resId) => { const c = companies.get(tripId); return !!c && (c.allies.has(resId) || c.foes.has(resId)); },
    /** LW14: the player's trail (the pins). */
    trail: () => trail,
    /** Every company forgotten (the dungeon left; a sweep) - its pool goes with it. */
    clear() { for (const id of [...companies.keys()]) letGo(id); ended.clear(); heard.clear(); rings.clear(); trail.length = 0; leaderWas = null; },
    get size() { return companies.size; },
  };
}
