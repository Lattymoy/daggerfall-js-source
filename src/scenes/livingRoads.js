// @ts-check
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE ROADS' LAYER - the parties of the living world on the road
// near the player, stood in the open world and marked under the Overworld. The trips are pure (systems/livingWorld/
// trips.js: where every party is at the sky's minute, the same for every reader); this layer reads them about the
// player's pixel each ROADS_TICK_S, places each member, and hands the bodies to the sprites (world/travellerSprites.js).
//
//  - BY DAY a party walks IN FILE on its way: the leader where the trip has it, each after FILE_GAP_N behind along the
//    way, a little to either side (FILE_SIDE_N), all facing the way they go.
//  - BY NIGHT it is CAMPED where night found it: its people in a ring CAMP_RING_N about the camp, facing in.
//  - IN PLAY, members within ROADS_PLAY_M of the player stand, whole; UNDER THE OVERWORLD, members within the sprites'
//    far edge stand faded and grown, and every party within ROADS_VIEW_PX map pixels wears a mark (its kind and where it
//    is bound).
//  - WHAT THEY SAY: a party talks among itself in rounds (the meetings' own beat, meetups.js circleLine on the road's
//    and the camp's words, lines.js ROAD_TALKS / CAMP_TALKS) and a word to the player passing close, by regard.
//  - A TALK on the road is the street's (townTalk's talk ray takes `talkSeats()`); the person's `living.town` is this
//    layer, which notes the word in the resident's regard and refuses the talk of an enemy.
//  - LW4: TROUBLE (trouble.js). A party beset FIGHTS where it stands: its people in a ring FIGHT_RING_N about their
//    place, facing out, the armed striking; the foes about them at FOE_RING_N, facing in, striking - for the fight's
//    own minutes; then the party holds there, binding its wounds, until its halt is done. The FALLEN lie where they fell
//    a day (trips.js remainsNear), on the class corpse's own picture. Under the Overworld a beset party's mark says so
//    (`wayfarer fight`, "Caravan beset by Orcs").
//  - LW4b: THE FIGHT STOOD (scenes/roadFights.js `fights`): a beset party near the player on the ground is fought for
//    real - its foes and its armed the encounter pool's bodies, which the roads then draw not; a fight a peer stands
//    (online) shows no foes of the roads' own - the peer's come through the stream.
import { partiesOfTown, partyAt, wayAt, membersAt, remainsOfTown, NATIVE_PER_M, NATIVE_PIXEL, TRIP_REACH_PX } from '../systems/livingWorld/trips.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { circleLine, lineMinutes, ROUND_S, TALK_SHARE } from '../systems/livingWorld/meetups.js';
import { ROAD_GREETINGS, fillLine, firstNameOf } from '../systems/livingWorld/lines.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';
import { DAY_MIN, DAY_START_MIN } from '../systems/livingWorld/dayPlan.js';
import { LIVING_REFUSAL } from '../systems/livingWorld/livingTown.js';
import { TRAVELLER_FAR_M } from '../world/travellerSprites.js';

/** The parties near are read again this often (real seconds). */
export const ROADS_TICK_S = 1;
/** In play, a member further than this from the player (m) is not stood. */
export const ROADS_PLAY_M = 360;
/** Under the Overworld, parties within this many map pixels wear a mark. */
export const ROADS_VIEW_PX = 6;
/** LW-PERF: the towns a frame reads of the roads' read under way (the parties and the fallen near, town by town). */
export const ROADS_TOWNS_PER_FRAME = 12;
/** LW-PERF: a player this far (map pixels) from the last read's pixel has jumped there (a fast travel, a teleport): the
 *  read is whole at once - a journey at x100 takes seconds over one pixel. */
export const ROADS_JUMP_PX = 2;
/** A party in file: each this far behind the one before (native - 1.8 m) and this far to a side (native - 0.55 m). */
export const FILE_GAP_N = 72;
export const FILE_SIDE_N = 22;
/** A camped party's ring about its fire (native - 2.25 m). */
export const CAMP_RING_N = 90;
/** How near the player passes a traveller for a word (m), and a traveller's word's rest (minutes of the clock). */
export const ROAD_GREET_M = 4;
export const ROAD_GREET_REST_MIN = 120;
/** How long a word to the player stands (real seconds). */
export const ROAD_GREET_S = 3.4;
/** LW4: a beset party's ring (native - 1.6 m), facing out; its foes' about it (native - 4.75 m), facing in. */
export const FIGHT_RING_N = 64;
export const FOE_RING_N = 190;
/** LW4: a fighter strikes about this often (real seconds), each on its own beat. */
export const STRIKE_S = 1.3;
/** LW4: the picture the fallen lie as - the human corpse (enemyBasics.js: the eighteen classes' one, TEXTURE.380's
 *  first record), whatever their trade. */
export const corpseLook = () => ENEMY_BASICS[128].corpseTexture;

/** A party's mark's label, by what it is (the leader's job) and where it is bound - LW4: or, beset, by what besets it.
 *  @param {any} trip @param {string} [home] @param {string} [beset] */
export function partyLabel(trip, home = '', beset = '') {
  const to = trip.to?.name ?? '';
  const n = trip.party?.length ?? 1;
  const bound = trip.kind === 'merchant' ? 'Caravan' : trip.kind === 'pilgrim' ? (n > 1 ? 'Pilgrims' : 'Pilgrim')
    : trip.kind === 'courier' ? 'Courier' : trip.kind === 'adventurer' ? (n > 1 ? 'Adventurers' : 'Adventurer') : (n > 1 ? 'Travellers' : 'Pedlar');
  if (beset) return `${bound} beset by ${beset}`;
  return to ? `${bound} to ${to}` : (home ? `${bound} of ${home}` : bound);
}

/**
 * LW4: a beset party in its ring, facing out at what besets it - the armed to strike, the rest within.
 * @param {any} trip @param {ReturnType<typeof partyAt>} at @param {any[]} members
 * @returns {{ res: any, x: number, z: number, yaw: number, moving: boolean }[]}
 */
export function fightPlaces(trip, at, members) {
  const out = [];
  const n = members.length;
  const turn = (lwSeed(textSeed(trip.id), 0x66696768) % 628) / 100;   // 'figh'
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + turn;
    const r = members[i].cls != null ? FIGHT_RING_N : FIGHT_RING_N * 0.4;   // the unarmed in the middle
    const x = /** @type {number} */ (at.x) + Math.sin(a) * r, z = /** @type {number} */ (at.z) + Math.cos(a) * r;
    out.push({ res: members[i], x, z, yaw: Math.atan2(x - /** @type {number} */ (at.x), z - /** @type {number} */ (at.z)), moving: false });
  }
  return out;
}

/**
 * LW4: what besets a party, about it and facing in - each foe a body of its own kind (`res.cls` its mobile type, the
 * sprites' class look), no talk target.
 * @param {any} trip @param {ReturnType<typeof partyAt>} at
 * @returns {{ key: string, res: any, x: number, z: number, yaw: number }[]}
 */
export function foePlaces(trip, at) {
  const foes = trip.enc?.foes ?? [];
  const turn = (lwSeed(textSeed(trip.id), 0x666f6573) % 628) / 100;   // 'foes'
  return foes.map((type, i) => {
    const a = ((i + 0.5) / foes.length) * Math.PI * 2 + turn;
    const x = /** @type {number} */ (at.x) + Math.sin(a) * FOE_RING_N, z = /** @type {number} */ (at.z) + Math.cos(a) * FOE_RING_N;
    return { key: `${trip.enc.id}:${i}`, res: { id: `${trip.enc.id}:${i}`, cls: type, sex: 'male', name: '' }, x, z, yaw: Math.atan2(/** @type {number} */ (at.x) - x, /** @type {number} */ (at.z) - z) };
  });
}

/**
 * Where each member of a party stands at a moment of its trip (native x, z), the way each faces and whether it walks.
 * @param {any} trip @param {ReturnType<typeof partyAt>} at
 * @returns {{ res: any, x: number, z: number, yaw: number, moving: boolean }[]}
 */
export function partyPlaces(trip, at) {
  const out = [];
  const n = trip.party.length;
  if (at.camp) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (lwSeed(textSeed(trip.id), 0x63616d70) % 628) / 100;   // 'camp': the ring turned its own way
      const x = /** @type {number} */ (at.x) + Math.sin(a) * CAMP_RING_N, z = /** @type {number} */ (at.z) + Math.cos(a) * CAMP_RING_N;
      out.push({ res: trip.party[i], x, z, yaw: Math.atan2(/** @type {number} */ (at.x) - x, /** @type {number} */ (at.z) - z), moving: false });
    }
    return out;
  }
  const back = at.phase === 'back';
  for (let i = 0; i < n; i++) {
    const s = /** @type {number} */ (at.s) + (back ? 1 : -1) * i * FILE_GAP_N;   // behind the leader, the way they walk
    const p = wayAt(trip.way, s);
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * FILE_SIDE_N;
    const yaw = back ? p.yaw + Math.PI : p.yaw;
    out.push({ res: trip.party[i], x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw, moving: true });
  }
  return out;
}

/**
 * @param {{
 *   world: import('../systems/livingWorld/trips.js').TripWorld,
 *   mpm: number, clock: () => number, baseRate: () => number,
 *   sceneOf: (nx: number, nz: number) => number[],
 *   here: () => ({ x: number, z: number } | null),
 *   sprites: ReturnType<typeof import('../world/travellerSprites.js').createTravellerSprites>,
 *   memo?: Map<string, any>,
 *   relations?: () => any, playerName?: () => string, weather?: () => (string|null), foeName?: (type: number, n: number) => string,
 *   fights?: ReturnType<typeof import('./roadFights.js').createRoadFights> | null,
 *   slay?: (res: any, t: number, seen: boolean) => void,
 *   stands?: ReturnType<typeof import('./roadStands.js').createRoadStands> | null,
 * }} deps - `here` the player's native place (null: nowhere on the map - indoors, underground); `baseRate` the clock's
 *   minutes a real second at the walking pace's own rate (the rounds' and the lines' beat on the clock); `foeName` a
 *   foe's word for a mark ("Orcs"); LW7 `slay(res, t, seen)` the player struck a traveller down (the host's turn); LW7b
 *   `stands` the armed beyond the walls (roadStands.js)
 */
export function createLivingRoads(deps) {
  /** @type {{ trip: any, at: any }[]} */
  let parties = [];
  /** LW4: the fallen lying near. @type {{ key: string, res: any, x: number, z: number, yaw: number, trip: any }[]} */
  let remains = [];
  /** LW4: each fighter's next strike (real seconds). @type {Map<string, number>} */
  const strikes = new Map();
  /** LW4: the bodies busy in a fight this frame (no word to the player from them). @type {Set<string>} */
  const busy = new Set();
  let timer = Infinity;
  /** @type {{ key: string, res: any, feet: number[], yaw: number, moving: boolean, distM: number, striking?: boolean, talk?: boolean, flat?: { archive: number, record: number } | null }[]} */
  const list = [];
  /** @type {Map<string, number>} */
  const greeted = new Map();
  /** @type {{ id: string, text: string, until: number }[]} */
  let greetings = [];
  let realNow = 0;
  const memo = deps.memo ?? new Map();
  const dayOf = (t) => Math.floor((t - DAY_START_MIN) / DAY_MIN);
  /** LW-PERF: the read under way - the towns near, read ROADS_TOWNS_PER_FRAME a frame - and the pixel of the last read
   *  done. @type {{ towns: any[], i: number, px: number, py: number, parties: any[], remains: any[] } | null} */
  let sweep = null;
  /** @type {number[]|null} */
  let readAt = null;

  /** LW-PERF: `n` more towns of the read under way; done, the parties and the fallen near are its. @param {number} t @param {number} n */
  function sweepOn(t, n) {
    const s = /** @type {NonNullable<typeof sweep>} */ (sweep);
    const o = { mpm: deps.mpm, memo };
    for (let k = 0; k < n && s.i < s.towns.length; k++, s.i++) {
      const town = s.towns[s.i];
      const ps = partiesOfTown(town, s.px, s.py, t, deps.world, o, ROADS_VIEW_PX);
      if (ps) for (const p of ps) s.parties.push(p);
      const rs = remainsOfTown(town, s.px, s.py, t, deps.world, o, ROADS_VIEW_PX);
      if (rs) for (const r of rs) s.remains.push(r);
    }
    if (s.i >= s.towns.length) { parties = s.parties; remains = s.remains; readAt = [s.px, s.py]; sweep = null; }
  }

  /** The parties and the fallen near, read again (partiesNear and remainsNear's, town by town). LW-PERF: over a few
   *  frames - the read whole was a frame of 5-10 ms once a second; read whole only on the way in and after a jump (a
   *  fast travel, a teleport), where a road met empty for a few frames would fill under the player's eyes. */
  function refresh(t) {
    const here = deps.here();
    if (!here) { parties = []; remains = []; sweep = null; readAt = null; return; }
    const px = Math.floor(here.x / NATIVE_PIXEL), py = 499 - Math.floor(here.z / NATIVE_PIXEL);
    sweep = { towns: deps.world.townsNear(px, py, ROADS_VIEW_PX + TRIP_REACH_PX), i: 0, px, py, parties: [], remains: [] };
    const jumped = !readAt || Math.max(Math.abs(px - readAt[0]), Math.abs(py - readAt[1])) > ROADS_JUMP_PX;
    sweepOn(t, jumped ? Infinity : ROADS_TOWNS_PER_FRAME);
  }

  /** LW4: whether a fighter strikes this frame - its own beat, begun at a seeded part of it. @param {string} key */
  function strikesNow(key) {
    let next = strikes.get(key);
    if (next == null) { next = realNow + ((lwSeed(textSeed(key), 0x7374) % 1000) / 1000) * STRIKE_S; strikes.set(key, next); }   // 'st'
    if (realNow < next) return false;
    strikes.set(key, next + STRIKE_S * (realNow - next > STRIKE_S ? Math.ceil((realNow - next) / STRIKE_S) : 1));
    return true;
  }

  /**
   * One frame. `eye` the frame's eye (scene); `overworld` the Overworld's frame while it is up ({ grow, blend }), else
   * null; `ground` false while the world is not the open world's (indoors: nothing stands).
   * @param {number} dt @param {number[]} eye @param {{ overworld?: { grow?: number, blend?: number } | null, ground?: boolean }} [o]
   */
  function frame(dt, eye, { overworld = null, ground = true } = {}) {
    realNow += dt;
    if (!ground) { list.length = 0; deps.sprites.sync(list); return; }
    const t = deps.clock();
    timer += dt;
    if (sweep) sweepOn(t, ROADS_TOWNS_PER_FRAME);   // LW-PERF: the read under way, a few towns a frame
    else if (timer >= ROADS_TICK_S) { timer = 0; refresh(t); }
    const here = deps.here();
    list.length = 0;
    busy.clear();
    const fights = deps.fights ?? null;
    if (fights) fights.frame(parties.map((p) => ({ trip: p.trip, at: partyAt(p.trip, t) })), here, t, { ground: !overworld });   // LW4b: the fights stood live
    if (deps.stands) {
      // LW7b: THE ARMED BEYOND THE WALLS - each armed member of a party on the road (not at its fight: that is the fights')
      // where they walk, for their regard to stand them: a hostile drawing, a friend at the player's side
      const cands = [];
      if (here && !overworld) {
        for (const p of parties) {
          const at = partyAt(p.trip, t);
          if ((at.phase !== 'out' && at.phase !== 'back') || at.fight) continue;
          const members = membersAt(p.trip, t);
          for (const m of partyPlaces(members === p.trip.party ? p.trip : { ...p.trip, party: members }, at)) if (m.res.cls != null) cands.push({ res: m.res, trip: p.trip, x: m.x, z: m.z, yaw: m.yaw });
        }
      }
      deps.stands.frame(cands, here, t, { dt, ground: !overworld });
    }
    if (here) {
      const reach = overworld ? TRAVELLER_FAR_M + 60 : ROADS_PLAY_M;
      for (const p of parties) {
        const at = partyAt(p.trip, t);
        if (at.phase !== 'out' && at.phase !== 'back') continue;
        if (Math.hypot(/** @type {number} */ (at.x) - here.x, /** @type {number} */ (at.z) - here.z) / NATIVE_PER_M > reach + 40) continue;
        const members = membersAt(p.trip, t);
        const fight = !!at.fight;
        const live = !!fights?.stood(p.trip.id);   // LW4b: its foes and its armed the pool's bodies now
        const allies = live ? fights?.alliesOf(p.trip.id) : null;
        // AUDIT-B6: a peer stands it - its armed are the peer's allies, come through the stream (drawn here too, doubled)
        const peerLive = fight && !live && !!fights && !overworld && fights.peerStands({ x: /** @type {number} */ (at.x), z: /** @type {number} */ (at.z) }, here);
        const places = fight ? fightPlaces(p.trip, at, members) : partyPlaces(members === p.trip.party ? p.trip : { ...p.trip, party: members }, at);
        for (const m of places) {
          if (allies?.has(m.res.id)) continue;
          if (peerLive && m.res.cls != null) continue;
          if (deps.stands?.stood(m.res.id)) continue;   // LW7b: a body of the pool's now
          const distM = Math.hypot(m.x - here.x, m.z - here.z) / NATIVE_PER_M;
          if (distM > reach) continue;
          if (fight) busy.add(m.res.id);
          list.push({ key: m.res.id, res: m.res, feet: deps.sceneOf(m.x, m.z), yaw: m.yaw, moving: m.moving, distM, striking: fight && m.res.cls != null && strikesNow(m.res.id) });
        }
        if (fight && !live && !peerLive) {
          for (const f of foePlaces(p.trip, at)) {
            const distM = Math.hypot(f.x - here.x, f.z - here.z) / NATIVE_PER_M;
            if (distM > reach) continue;
            list.push({ key: f.key, res: f.res, feet: deps.sceneOf(f.x, f.z), yaw: f.yaw, moving: false, distM, striking: strikesNow(f.key), talk: false });
          }
        }
      }
      for (const r of remains) {
        if (fights?.alliesOf(r.trip.id).has(r.res.id)) continue;   // AUDIT-B3: stood alive in a fight here - no body of theirs drawn beside them
        const distM = Math.hypot(r.x - here.x, r.z - here.z) / NATIVE_PER_M;
        if (distM > reach) continue;
        list.push({ key: r.key, res: r.res, feet: deps.sceneOf(r.x, r.z), yaw: r.yaw, moving: false, distM, talk: false, flat: corpseLook() });
      }
    }
    for (const key of [...strikes.keys()]) if (!list.some((m) => m.key === key)) strikes.delete(key);
    deps.sprites.sync(list, { dt, eye, grow: overworld?.grow ?? 1, fade: overworld?.blend ?? 1, ground: !overworld });
    if (!overworld && dt > 0) greet(t);
  }

  /** A word to the player passing close - by regard, once in ROAD_GREET_REST_MIN of the clock. */
  function greet(t) {
    for (const m of list) {
      if (m.distM > ROAD_GREET_M || m.talk === false || busy.has(m.res.id)) continue;   // LW4: no word from a fighter, a foe or the fallen
      const last = greeted.get(m.res.id);
      if (last != null && t >= last && t - last < ROAD_GREET_REST_MIN) continue;   // AUDIT-E6: a clock gone back (a load) forgets the rest
      greeted.set(m.res.id, t);
      const rel = deps.relations?.() ?? null;
      const standing = rel ? rel.standing(m.res.id, dayOf(t)) : 'neutral';
      const pool = standing === 'friend' ? ROAD_GREETINGS.friend : standing === 'enemy' || standing === 'hostile' ? ROAD_GREETINGS.enemy
        : rel?.known(m.res.id) ? ROAD_GREETINGS.known : ROAD_GREETINGS.stranger;
      const text = fillLine(pool[lwSeed(textSeed(m.res.id), Math.floor(t / 7)) % pool.length], { player: deps.playerName?.() ?? '' });
      greetings = greetings.filter((g) => g.id !== m.res.id && g.until > realNow);
      greetings.push({ id: m.res.id, text, until: realNow + ROAD_GREET_S });
      rel?.seen(m.res.id, dayOf(t));
    }
  }

  /**
   * What the road says this moment: each party's own talk in rounds (walking, or about the fire), and the words to the
   * player - over the speakers standing within `range` of `eye`.
   * @param {number[]} eye @param {number} [range]
   * @returns {{ person: any, text: string, kind: 'talk' }[]}
   */
  function speech(eye, range = 30) {
    const t = deps.clock();
    const rate = deps.baseRate();
    const roundMin = ROUND_S * rate * 1.25, lineMin = lineMinutes(rate);
    greetings = greetings.filter((g) => g.until > realNow);
    const out = [];
    const near = (person) => person?.pos && Math.hypot(person.pos[0] - eye[0], person.pos[2] - eye[2]) <= range;
    for (const g of greetings) {
      const b = deps.sprites.bodyOf(g.id);
      if (b && near(b.person)) out.push({ person: b.person, text: g.text, kind: /** @type {'talk'} */ ('talk') });
    }
    for (const p of parties) {
      if (p.trip.party.length < 2) continue;
      const at = partyAt(p.trip, t);
      if ((at.phase !== 'out' && at.phase !== 'back') || at.halt) continue;   // LW4: a party beset has other things to do
      const round = Math.floor(t / roundMin);
      const seed = lwSeed(textSeed(p.trip.id), round);
      const members = membersAt(p.trip, t);
      if (members.length < 2) continue;
      const circle = { members, seed, start: round * roundMin, end: (round + 1) * roundMin, talks: (seed % 1000) / 1000 < TALK_SHARE, index: 0 };
      const line = circleLine(circle, t, lineMin, { place: p.trip.to?.name, weather: deps.weather?.() ?? null, hour: Math.floor((((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60), road: at.camp ? 'camp' : 'walk' });
      if (!line) continue;
      const b = deps.sprites.bodyOf(line.who.id);
      if (b && near(b.person) && !greetings.some((g) => g.id === line.who.id)) out.push({ person: b.person, text: line.text, kind: /** @type {'talk'} */ ('talk') });
    }
    return out;
  }

  /**
   * The Overworld's marks: a party within ROADS_VIEW_PX - where its leader is, its kind and where it is bound.
   * @returns {{ key: string, at: number[], label: string, kind: string, trip: any }[]}
   */
  function marks() {
    const t = deps.clock();
    const out = [];
    for (const p of parties) {
      const at = partyAt(p.trip, t);
      if (at.phase !== 'out' && at.phase !== 'back') continue;
      const members = membersAt(p.trip, t);
      if (!members.length) continue;   // LW7: nobody left of it on the road
      const foes = at.fight ? p.trip.enc?.foes ?? [] : [];
      const beset = foes.length ? (deps.foeName?.(foes[0], foes.length) ?? 'foes') : '';   // LW4: what besets it, while it does
      out.push({ key: `party:${p.trip.id}`, at: deps.sceneOf(/** @type {number} */ (at.x), /** @type {number} */ (at.z)), label: partyLabel(members === p.trip.party ? p.trip : { ...p.trip, party: members }, '', beset),
        kind: `${p.trip.kind === 'merchant' ? 'wayfarer caravan' : 'wayfarer'}${beset ? ' fight' : ''}`, trip: p.trip });
    }
    return out;
  }

  return {
    frame,
    speech,
    marks,
    /** The bodies on the ground as talk targets (the street's own shape). */
    talkSeats: () => deps.sprites.persons(),
    /** This frame's drawn bodies (the exterior's billboard pass). */
    batches: () => deps.sprites.batches(),
    /** The parties read about the player (the probes; the pins). */
    parties: () => parties,
    /** The person's town: the roads note a word in the resident's regard ... */
    talked(person) {
      const id = person?.living?.id;
      if (!id) return null;
      deps.relations?.()?.note(id, 'talk', dayOf(deps.clock()));
      return id;
    },
    /** ... remembers a hand caught in a purse (no watch on the road: the regard is all that comes of it) ... */
    caught(person) {
      const id = person?.living?.id;
      if (!id) return null;
      deps.relations?.()?.note(id, 'crime', dayOf(deps.clock()));
      return id;
    },
    /**
     * LW7: a traveller STRUCK DOWN by the player (the host's swing - DFU's one-hit civilian): dead for good from this
     * minute (`deps.slay`; seen - their party stood by), and their party's own turned against the player (`slain` - its
     * armed now count the player hostile). No watch on the road: that is all that comes of it. The parties are read
     * again at once (the party walks on without them). Answers the resident's id, or null.
     */
    slain(person) {
      const res = person?.living?.res;
      if (!res) return null;
      const t = deps.clock();
      deps.slay?.(res, t, true);
      const p = parties.find((q) => q.trip.party.some((m) => m.id === res.id));
      const rel = deps.relations?.();
      for (const m of p ? membersAt(p.trip, t) : []) if (m.id !== res.id) rel?.note(m.id, 'slain', dayOf(t));
      timer = ROADS_TICK_S; sweep = null; readAt = null;   // LW-PERF: read again whole, at once - a read under way began before the deed
      return res.id;
    },
    /** LW7: a word's tone - a courteous one (tone 0) or a blunt one (tone 2), each once a day. */
    toned(person, tone) {
      const id = person?.living?.id;
      const kind = tone === 0 ? 'polite' : tone === 2 ? 'insulted' : null;
      if (!id || !kind) return null;
      deps.relations?.()?.note(id, kind, dayOf(deps.clock()));
      return id;
    },
    /** ... and an enemy will not talk. */
    refuses(person) {
      const id = person?.living?.id;
      const rel = deps.relations?.();
      if (!id || !rel) return null;
      const s = rel.standing(id, dayOf(deps.clock()));
      return s === 'enemy' || s === 'hostile' ? fillLine(LIVING_REFUSAL, { a: firstNameOf(person.nameNPC) }) : null;
    },
    /** Every body freed and the parties forgotten (the host's teardown). */
    clear() { deps.sprites.clear(); deps.fights?.clear(); deps.stands?.clear(); parties = []; remains = []; list.length = 0; greetings = []; timer = Infinity; sweep = null; readAt = null; strikes.clear(); busy.clear(); },   // LW-PERF: the next read whole (the way back in)
  };
}
