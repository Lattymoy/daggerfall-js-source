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
import { circleLine, lineMinutes, ROUND_S } from '../systems/livingWorld/meetups.js';
import { ROAD_GREETINGS, ROAD_PASS_SCRIPTS, ROAD_PASS_WARNINGS, BAND_WARNINGS, COMPANY_GREETINGS, fillLine, firstNameOf } from '../systems/livingWorld/lines.js';
import { byRole, headOf } from '../systems/livingWorld/companies.js';   // LW13: a company in file by role, its head's word
import { FIRE_FLAT } from '../systems/survival/camp.js';
import { teamOf, trainOf, campTeam } from '../systems/livingWorld/wagons.js';   // LW10: the wagon trains
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
/** LW9: two camps of a night this near (native - 60 m) are one camp, round one fire (the earlier party's). */
export const CAMP_SHARE_N = 2400;
/** LW9: two parties this near on the road (native - 25 m) pass with a word. */
export const PASS_N = 1000;
/** LW9: a shared camp's ring grows by this for each of its people past four (native). */
export const CAMP_RING_STEP_N = 14;
/** LW10: a wagon's tilt is read off the ground this far before its axle (native - 1.5 m). */
export const WAGON_FRONT_N = 60;

/** A party's mark's label, by what it is (the leader's job) and where it is bound - LW4: or, beset, by what besets it.
 *  @param {any} trip @param {string} [home] @param {string} [beset] */
export function partyLabel(trip, home = '', beset = '') {
  const to = trip.to?.name ?? '';
  const n = trip.party?.length ?? 1;
  const bound = ROAD_LABELS[trip.kind]?.(n) ?? (trip.kind === 'merchant' ? 'Caravan' : trip.kind === 'pilgrim' ? (n > 1 ? 'Pilgrims' : 'Pilgrim')
    : trip.kind === 'courier' ? 'Courier' : trip.kind === 'adventurer' ? (n > 1 ? 'Adventurers' : 'Adventurer') : (n > 1 ? 'Travellers' : 'Pedlar'));
  if (trip.company) return beset ? `${trip.company.name} beset by ${beset}` : to ? `${trip.company.name}, to ${to}` : trip.company.name;   // LW13: a company by its name
  if (beset) return `${bound} beset by ${beset}`;
  if (trip.robbed) return to ? `${bound} to ${to} (robbed)` : `${bound} (robbed)`;   // LW11: the character's own robbery
  if (trip.wild) return `${bound} in the wild`;   // LW9: no town
  if (trip.market && to) return `${bound} to ${to}'s market`;
  return to ? `${bound} to ${to}` : (home ? `${bound} of ${home}` : bound);
}
/** LW9: the road's new traffic's words for a mark. @type {Record<string, (n: number) => string>} */
const ROAD_LABELS = Object.freeze({
  carter: () => 'Farmer', hunter: () => 'Hunter', patrol: () => 'Patrol', noble: () => 'Procession', minstrel: () => 'Minstrel',
});

/**
 * LW9: THE CAMPS SHARED - the night's camps (the parties camped, none at an inn) within CAMP_SHARE_N of one another, one
 * camp: the earliest party's (by trip id) its place, every one of them a place in its ring in order. A drawing's law:
 * no party's timeline moves.
 * @param {{ trip: any, at: any, members?: any[] }[]} camped @returns {Map<string, { x: number, z: number, i0: number, n: number, first: boolean }>}
 */
export function campGroups(camped) {
  const list = [...camped].sort((a, b) => (a.trip.id < b.trip.id ? -1 : a.trip.id > b.trip.id ? 1 : 0));
  /** @type {Map<string, { x: number, z: number, i0: number, n: number, first: boolean }>} */
  const out = new Map();
  const done = new Set();
  for (const p of list) {
    if (done.has(p.trip.id)) continue;
    const group = [p];
    done.add(p.trip.id);
    for (let i = 0; i < group.length; i++) {
      for (const q of list) {
        if (done.has(q.trip.id)) continue;
        if (Math.hypot(q.at.x - group[i].at.x, q.at.z - group[i].at.z) <= CAMP_SHARE_N) { group.push(q); done.add(q.trip.id); }
      }
    }
    const n = group.reduce((a, g) => a + (g.members?.length ?? g.trip.party.length), 0);
    let i0 = 0;
    group.forEach((g, gi) => {
      out.set(g.trip.id, { x: p.at.x, z: p.at.z, i0, n, first: gi === 0 });
      i0 += g.members?.length ?? g.trip.party.length;
    });
  }
  return out;
}

/**
 * LW9: THE PARTIES PASSING - each pair of parties walking (out or home, no halt, no camp) within PASS_N of each other
 * this minute, the lower trip id first, and its words: the road's, or a warning where either has met trouble behind it.
 * @param {{ trip: any, at: any }[]} walking @param {number} t
 * @returns {{ a: any, b: any, script: readonly string[], warned: any }[]}
 */
export function passingPairs(walking, t) {
  const out = [];
  const list = [...walking].sort((a, b) => (a.trip.id < b.trip.id ? -1 : a.trip.id > b.trip.id ? 1 : 0));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (Math.hypot(a.at.x - b.at.x, a.at.z - b.at.z) > PASS_N) continue;
      const seed = lwSeed(textSeed(a.trip.id), textSeed(b.trip.id), 0x70617373);   // 'pass'
      const warned = [a, b].find((p) => p.trip.enc && p.trip.enc.t1 <= t && p.trip.enc.foes?.length);
      const pool = warned ? ROAD_PASS_WARNINGS : ROAD_PASS_SCRIPTS;
      out.push({ a, b, script: pool[seed % pool.length], warned: warned ?? null });
    }
  }
  return out;
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
export function partyPlaces(trip, at, ring = null) {
  const out = [];
  const n = trip.party.length;
  // LW9: a camp shared with another party - its people a stretch of the one ring about the first's fire
  if (ring && at.camp && !at.halt) {
    const r = CAMP_RING_N + Math.max(0, ring.n - 4) * CAMP_RING_STEP_N;
    for (let i = 0; i < n; i++) {
      const a = ((ring.i0 + i) / ring.n) * Math.PI * 2;
      const x = ring.x + Math.sin(a) * r, z = ring.z + Math.cos(a) * r;
      out.push({ res: trip.party[i], x, z, yaw: Math.atan2(ring.x - x, ring.z - z), moving: false });
    }
    return out;
  }
  // AUDIT LW-DRY: a halted party, its fight done, stands in its ring too - before, in file along the way with the
  // walk's stride, walking on the spot for the rest of the halt (its file's tail past the dry ground the stop stood on)
  if (at.camp || at.halt) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (lwSeed(textSeed(trip.id), 0x63616d70) % 628) / 100;   // 'camp': the ring turned its own way
      const x = /** @type {number} */ (at.x) + Math.sin(a) * CAMP_RING_N, z = /** @type {number} */ (at.z) + Math.cos(a) * CAMP_RING_N;
      out.push({ res: trip.party[i], x, z, yaw: Math.atan2(/** @type {number} */ (at.x) - x, /** @type {number} */ (at.z) - z), moving: false });
    }
    return out;
  }
  const back = at.phase === 'back';
  const file = trip.company ? byRole(trip.party) : trip.party;   // LW13: a company in file by role - warriors before, thieves between, mages behind
  for (let i = 0; i < n; i++) {
    const s = /** @type {number} */ (at.s) + (back ? 1 : -1) * i * FILE_GAP_N;   // behind the leader, the way they walk
    const p = wayAt(trip.way, s);
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * FILE_SIDE_N;
    const yaw = back ? p.yaw + Math.PI : p.yaw;
    out.push({ res: file[i], x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw, moving: true });
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
 *   teams?: ReturnType<typeof import('../world/roadTeams.js').createRoadTeams> | null,
 *   robbed?: (tripId: string) => (number | null), unheard?: (t: number) => any, heard?: (band: any) => any,
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
    const reach = overworld ? TRAVELLER_FAR_M + 60 : ROADS_PLAY_M;
    // AUDIT LW-II E3: EACH PARTY NEAR LAID OUT ONCE, AS IT IS DRAWN - its people where the bodies stand (a shared camp's ring,
    // a train's file), its team, its fire - and the armed handed to the stands from there. Before, the stands' places
    // were the party's plain file and its own camp: an armed member drawn at another party's fire, or in its train's
    // van, was stood up to 59 m from their body
    /** @type {{ p: any, at: any, fight: boolean, live: boolean, allies: any, peerLive: boolean, places: { res: any, x: number, z: number, yaw: number, moving: boolean }[], fire: { x: number, z: number } | null }[]} */
    const drawn = [];
    /** LW10: the teams this frame - each horse and wagon where its train has it (scene feet) */
    const horses = [], wagons = [];
    if (here) {
      // LW9: the night's camps near one another one camp, round one fire
      const camped = [];
      for (const p of parties) {
        const at = partyAt(p.trip, t);
        if ((at.phase === 'out' || at.phase === 'back') && at.camp && !at.halt && !at.inn) camped.push({ trip: p.trip, at, members: membersAt(p.trip, t) });
      }
      const groups = campGroups(camped);
      const rate = deps.baseRate?.() ?? 0;
      for (const p of parties) {
        const at = partyAt(p.trip, t);
        if (at.phase !== 'out' && at.phase !== 'back') continue;
        if (at.inn) continue;   // LW9: lodged at the inn on the road - indoors, the inn's own guests
        if (Math.hypot(/** @type {number} */ (at.x) - here.x, /** @type {number} */ (at.z) - here.z) / NATIVE_PER_M > reach + 40) continue;
        const members = membersAt(p.trip, t);
        const fight = !!at.fight;
        const live = !!fights?.stood(p.trip.id);   // LW4b: its foes and its armed the pool's bodies now
        const allies = live ? fights?.alliesOf(p.trip.id) : null;
        // AUDIT-B6: a peer stands it - its armed are the peer's allies, come through the stream (drawn here too, doubled)
        const peerLive = fight && !live && !!fights && !overworld && fights.peerStands({ x: /** @type {number} */ (at.x), z: /** @type {number} */ (at.z) }, here);
        const ring = fight ? null : groups.get(p.trip.id) ?? null;
        // LW10: A TEAM'S TRAIN - its people in the train's places on the march (and at a halt, standing), its horses and its
        // wagons where the train has them; at camp the ring as any party's, its wagons parked beyond it
        const team = teamOf(p.trip);
        const trip = deps.robbed?.(p.trip.id) != null ? { ...p.trip, robbed: { t: /** @type {number} */ (deps.robbed(p.trip.id)) } } : p.trip;
        const hasTeam = team.wagons + team.packs > 0;
        const speed = (p.trip.pace / NATIVE_PER_M) * rate;   // a horse's pace (m a real second)
        let places;
        if (hasTeam && !at.camp) {
          const train = trainOf(trip, at, members, t, deps.teams?.hitchN?.());   // WAGONS1: the drawn wagon's own hitch
          places = fight ? fightPlaces(p.trip, at, members) : train.people;
          for (const h of train.horses) horses.push({ ...h, moving: h.moving && !fight, speed });
          for (const w of train.wagons) wagons.push({ ...w, moving: w.moving && !fight });
        } else {
          places = fight ? fightPlaces(p.trip, at, members) : partyPlaces(members === p.trip.party ? p.trip : { ...p.trip, party: members }, at, ring);
          if (hasTeam && at.camp && !fight) {
            const cx = ring ? ring.x : /** @type {number} */ (at.x), cz = ring ? ring.z : /** @type {number} */ (at.z);
            const r = ring ? CAMP_RING_N + Math.max(0, ring.n - 4) * CAMP_RING_STEP_N : CAMP_RING_N;
            const parked = campTeam(trip, cx, cz, r, t);
            for (const h of parked.horses) horses.push({ ...h, speed: 0 });
            wagons.push(...parked.wagons);
          }
        }
        // LW9: A FIRE AT EVERY CAMP - the camps' own flame (survival/camp.js FIRE_FLAT), one to a shared camp
        let fire = null;
        if (at.camp && !at.halt && !fight && (!ring || ring.first)) {
          fire = { x: ring ? ring.x : /** @type {number} */ (at.x), z: ring ? ring.z : /** @type {number} */ (at.z) };
        }
        drawn.push({ p, at, fight, live, allies, peerLive, places, fire });
      }
    }
    if (deps.stands) {
      // LW7b: THE ARMED BEYOND THE WALLS - each armed member of a party on the road (not at its fight: that is the fights')
      // where they walk, for their regard to stand them: a hostile drawing, a friend at the player's side
      const cands = [];
      if (here && !overworld) {
        for (const d of drawn) {
          if (d.fight) continue;   // LW4b: at its fight - the fights' (LW9: one lodged at an inn is indoors, never laid out)
          for (const m of d.places) if (m.res.cls != null) cands.push({ res: m.res, trip: d.p.trip, x: m.x, z: m.z, yaw: m.yaw });
        }
      }
      deps.stands.frame(cands, here, t, { dt, ground: !overworld });
    }
    if (here) {
      for (const { p, at, fight, live, allies, peerLive, places, fire } of drawn) {
        if (fire) {
          const distM = Math.hypot(fire.x - here.x, fire.z - here.z) / NATIVE_PER_M;
          if (distM <= reach) list.push({ key: `fire:${p.trip.id}`, res: { id: `fire:${p.trip.id}`, name: '' }, feet: deps.sceneOf(fire.x, fire.z), yaw: 0, moving: false, distM, talk: false, flat: FIRE_FLAT });
        }
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
      // LW10: the teams handed to their drawing - the scene's feet, a wagon's tilt off the ground before it
      if (deps.teams) {
        const near = (/** @type {{ x: number, z: number }} */ q) => Math.hypot(q.x - here.x, q.z - here.z) / NATIVE_PER_M;
        deps.teams.sync(
          horses.filter((h) => near(h) <= reach).map((h) => ({ key: h.key, feet: deps.sceneOf(h.x, h.z), yaw: h.yaw, moving: h.moving, speed: h.speed, distM: near(h) })),
          wagons.filter((w) => near(w) <= reach).map((w) => ({ key: w.key, feet: deps.sceneOf(w.x, w.z), front: deps.sceneOf(w.x + Math.sin(w.yaw) * WAGON_FRONT_N, w.z + Math.cos(w.yaw) * WAGON_FRONT_N), yaw: w.yaw, moving: w.moving, tier: w.tier, s: w.s, hitched: w.hitched, distM: near(w) })),
          { dt, eye, grow: overworld?.grow ?? 1, ground: !overworld });
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

  /** LW13: the company a traveller walks with at `t` - its name and its head (the highest level walking) - or null. @param {string} id @param {number} t */
  function companyAt(id, t) {
    const p = parties.find((q) => q.trip.company && q.trip.party.some((x) => x.id === id));
    return p ? { name: p.trip.company.name, head: headOf(membersAt(p.trip, t)) } : null;
  }

  /** A word to the player passing close - by regard, once in ROAD_GREET_REST_MIN of the clock. */
  function greet(t) {
    for (const m of list) {
      if (m.distM > ROAD_GREET_M || m.talk === false || busy.has(m.res.id)) continue;   // LW4: no word from a fighter, a foe or the fallen
      const last = greeted.get(m.res.id);
      if (last != null && t >= last && t - last < ROAD_GREET_REST_MIN) continue;   // AUDIT-E6: a clock gone back (a load) forgets the rest
      greeted.set(m.res.id, t);
      const rel = deps.relations?.() ?? null;
      // LW13: a company's word to the player is its head's, and its greeting names it
      const company = companyAt(m.res.id, t);
      const word = company?.head?.id ?? m.res.id;
      const standing = rel ? rel.standing(word, dayOf(t)) : 'neutral';
      const known = !!rel?.known(word);
      const pools = company && standing !== 'enemy' && standing !== 'hostile' ? COMPANY_GREETINGS : ROAD_GREETINGS;
      const pool = standing === 'friend' ? pools.friend : standing === 'enemy' || standing === 'hostile' ? ROAD_GREETINGS.enemy
        : known ? pools.known : pools.stranger;
      let text = fillLine(pool[lwSeed(textSeed(m.res.id), Math.floor(t / 7)) % pool.length], { player: deps.playerName?.() ?? '', company: company?.name ?? '' });
      // LW12: and a warning of a band whose hideout lies near, the first time (never from one who will not speak to them)
      const band = standing === 'enemy' || standing === 'hostile' ? null : deps.unheard?.(t) ?? null;
      if (band) { text = `${text} ${fillLine(BAND_WARNINGS[lwSeed(textSeed(m.res.id), 0x7761726e) % BAND_WARNINGS.length], { band: band.name })}`; deps.heard?.(band); }   // 'warn'
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
    // LW9: PARTIES PASSING - a word from each, the first's then the second's, a line a beat
    const walking = [];
    for (const p of parties) {
      const at = partyAt(p.trip, t);
      if ((at.phase === 'out' || at.phase === 'back') && !at.halt && !at.camp && !at.inn) walking.push({ trip: p.trip, at });
    }
    for (const pair of passingPairs(walking, t)) {
      const k = Math.floor(t / lineMin) % pair.script.length;
      const who = membersAt((k % 2 ? pair.b : pair.a).trip, t)[0];
      const b = who ? deps.sprites.bodyOf(who.id) : null;
      const foe = pair.warned ? (pair.warned.trip.enc.bandName ?? deps.foeName?.(pair.warned.trip.enc.foes[0], 2) ?? 'foes') : '';   // LW12: a band by its name
      if (b && near(b.person) && !greetings.some((g) => g.id === who.id)) out.push({ person: b.person, text: fillLine(pair.script[k], { foe }), kind: /** @type {'talk'} */ ('talk') });
    }
    for (const p of parties) {
      if (p.trip.party.length < 2) continue;
      const at = partyAt(p.trip, t);
      if ((at.phase !== 'out' && at.phase !== 'back') || at.halt) continue;   // LW4: a party beset has other things to do
      const round = Math.floor(t / roundMin);
      const seed = lwSeed(textSeed(p.trip.id), round);
      const members = membersAt(p.trip, t);
      if (members.length < 2) continue;
      const circle = { members, seed, start: round * roundMin, end: (round + 1) * roundMin, index: 0 };   // LW-TALK: its exchanges from the round's start (a party walks together: nobody gathers)
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
      if (at.inn) continue;   // LW9: indoors at the inn
      const members = membersAt(p.trip, t);
      if (!members.length) continue;   // LW7: nobody left of it on the road
      const foes = at.fight ? p.trip.enc?.foes ?? [] : [];
      const beset = foes.length ? (p.trip.enc?.bandName ?? deps.foeName?.(foes[0], foes.length) ?? 'foes') : '';   // LW12: a band by its name   // LW4: what besets it, while it does
      out.push({ key: `party:${p.trip.id}`, at: deps.sceneOf(/** @type {number} */ (at.x), /** @type {number} */ (at.z)), label: partyLabel({ ...p.trip, party: members, robbed: deps.robbed?.(p.trip.id) != null }, '', beset),
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
    /** This frame's drawn bodies (the exterior's billboard pass) - LW10: and the teams' horses. */
    batches: () => (deps.teams ? [...deps.sprites.batches(), ...deps.teams.batches()] : deps.sprites.batches()),
    /** LW10: the teams' wagons, in the host's world mesh pass. @param {any} r */
    drawTeams: (r) => deps.teams?.draw(r) ?? 0,
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
      const s = rel.standing(companyAt(id, deps.clock())?.head?.id ?? id, dayOf(deps.clock()));   // LW13: a company's word is its head's
      return s === 'enemy' || s === 'hostile' ? fillLine(LIVING_REFUSAL, { a: firstNameOf(person.nameNPC) }) : null;
    },
    /** Every body freed and the parties forgotten (the host's teardown). */
    clear() { deps.sprites.clear(); deps.teams?.clear(); deps.fights?.clear(); deps.stands?.clear(); parties = []; remains = []; list.length = 0; greetings = []; timer = Infinity; sweep = null; readAt = null; strikes.clear(); busy.clear(); },   // LW-PERF: the next read whole (the way back in)
  };
}
