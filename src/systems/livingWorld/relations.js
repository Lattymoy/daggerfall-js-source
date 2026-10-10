// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): FRIENDS AND ENEMIES - how each resident of the living world
// regards the player's character (LW0 decision 6: the world is shared; how it feels about you is yours).
//
// A REGARD per resident, from HOSTILE_AT and below to FRIEND_AT and above, kept by the resident's id (census.js:
// `L<mapId>.<slot>` - the same person wherever they walk). Nothing is kept for a resident the player has not met: a
// stranger reads 0. What moves it (`EVENTS`): a word exchanged (once a day counts), a gift, a hand in their fight, their
// life saved - and a blow, a crime seen, one of theirs struck down. Past FRIEND_AT they are a FRIEND (a greeting by name,
// a hand in yours), below ENEMY_AT an ENEMY (no words for you), below HOSTILE_AT HOSTILE (an armed one draws on you).
// Regard eases back toward nothing by EASE_PER_DAY a day the player does not see them - a quarrel, and a friendship,
// fades unkept - but never across zero.
//
// The record rides the character's save (`snapshot` / `createRelations(record)`; the host registers it with
// modSaveData as vendor `LivingWorld`) - online in the character's snapshot like every modData record.
//
// LW4: THE CHARACTER'S TURNS OF FATE ride it too (`turn`, `turns`): a member of a party the road would have taken who
// lived because the player fought beside them (`spared`, `<place>@<cycle>`), one cut down beside them (`fallen`), and a
// fight the player won or lost for a party (`won`, `lost`, the encounter's id). The world is shared; what one player
// changed in it is theirs (lives.js, trouble.js read them over the dice).
//
// LW7: THE HAND DEATHS (`HAND_KINDS`) ride it too, each with its minute and the name they bore: a resident the player
// struck down (`slain`, and whether it was seen), one who died fighting at the player's side (`died`) and - WATCH-FIX -
// one of the watch another hand cut down in the player's town (`killed`: a beast, a fall, another player) - deaths the
// road's dice never held, so the lives take the place from that minute (lives.js handDeath) and the road keeps the rest
// of the day as it was; the town talks of them by name (livingTown.js deedNews).

import { CRIMES } from '../crimes.js';
import { REGION_COUNT } from '../regionConditions.js';

/** The save's record's vendor (modSaveData): the character's regards ride their save under it. */
export const LIVING_WORLD_VENDOR = 'LivingWorld';

export const FRIEND_AT = 40;
export const ENEMY_AT = -40;
export const HOSTILE_AT = -70;
export const REGARD_MIN = -100;
export const REGARD_MAX = 100;
/** How much regard eases back toward zero for each day apart. */
export const EASE_PER_DAY = 0.5;
/** The most residents kept: the least-regarded-either-way and longest-unseen leave first. */
export const RELATIONS_MAX = 600;

/** LW4: the kinds of a character's turns of fate, and the most kept of each (the oldest leave first). */
export const TURN_KINDS = Object.freeze(['spared', 'fallen', 'won', 'lost']);
export const TURNS_MAX = 200;
/** LW7: the hand deaths - a turn with its minute, whether it was seen and the name (`{ t, seen, who }`), kept as the
 *  turns are. */
export const HAND_KINDS = Object.freeze(['slain', 'died', 'killed']);
/** LW7: the longest name a hand death keeps. */
export const HAND_NAME_MAX = 60;
/** LW6b: the marks of what the living world has laid in this character's world - `laid`, the fallen of a dive left in
 *  its dungeon (`deep:<id>:<trip>`) - kept as the turns are, written only once there is one. LW12: `heard`, a band the
 *  character has heard of (its key, `<hideout>~<gen>[h<heir>]`: its hideout marked, rumoured), and `looted`, a band's
 *  chest the character took from (its key: it stands empty for them). */
export const MARK_KINDS = Object.freeze(['laid', 'heard', 'looted']);
/** LW6d: the tales its towns tell of the character - `home`, a keepsake carried home to a household (`<the one it was>@home`)
 *  - each with its minute and the name it tells of, kept as the hand deaths are (never one of them), written only once
 *  there is one, as [key, t, who]. LW12: `routed`, a band the character routed (`<hideout>@<gen>.<heir>`, its name).
 *  LW16: `held`, a party the character robbed on the road, charged to its region once a witness carried it in
 *  (`R<region>.<minute>`, the name of the one robbed). */
export const TALE_KINDS = Object.freeze(['home', 'routed', 'held']);

/** LW11 (bible/06-Systems/Living-World-II.md): THE ROAD'S RECORDS - a caravan's counter as this character left it
 *  (`wares`: the goods gone from its shelf and the coin its purse paid out, by trip, the WARES_MAX newest kept), the
 *  crimes a witness is carrying to a town (`reports`, REPORTS_MAX), and the escort the character is hired on (`escort`,
 *  one at a time) - each written into the save only once there is one (`road`, beside `people` and `turns`: an add-only
 *  key, decision 10). */
export const WARES_MAX = 40;
export const REPORTS_MAX = 40;
/** AUDIT LW-II C10: a report's crime is one of the law's (crimes.js CRIMES, never None) and its region one of the map's
 *  (regionConditions.js REGION_COUNT) - a save's or a host's any integer charged legalRep[-7] = NaN. */
const CRIME_KINDS = new Set(Object.values(CRIMES).filter((c) => c !== CRIMES.None));
const reportOk = (crime, region) => CRIME_KINDS.has(crime) && Number.isSafeInteger(region) && region >= 0 && region < REGION_COUNT;

/** What moves a regard, and by how much. `talk` counts once a day per resident, and each tone of word (`polite`,
 *  `insulted`) once a day. LW7: one of their own slain turns them HOSTILE (an armed one draws on you beyond the walls). */
export const EVENTS = Object.freeze({
  talk: 3,        // a word exchanged (the talk window opened on them)
  polite: 1,      // a courteous word in the talk (the talk's own tone)
  gift: 8,        // a gift given
  helped: 20,     // a blow struck for them in their fight
  saved: 35,      // their fight won with them standing
  struck: -45,    // struck by the player
  crime: -15,     // a crime of the player's seen
  slain: -75,     // one of their own - their household, their party - struck down by the player
  insulted: -6,   // a blunt word in the talk
  poached: -4,    // LW14: a find of theirs taken before them in the deep (once a day, as a tone)
});

/** @typedef {{ r: number, met: number, seen: number, talked: number, polite?: number, blunt?: number, poach?: number }} Regard - `met`,
 *  `seen`, `talked` days (the clock's day numbers); LW7 `polite`, `blunt` the days a tone of word last counted; LW14
 *  `poach` the day a find of theirs last counted */

/** The standing a regard reads as. @param {number} r */
export const regardStanding = (r) => (r >= FRIEND_AT ? 'friend' : r <= HOSTILE_AT ? 'hostile' : r <= ENEMY_AT ? 'enemy' : 'neutral');

/**
 * One character's regards.
 * @param {any} [record] - a save's (`snapshot()`), or none: nobody known
 */
export function createRelations(record = null) {
  /** @type {Map<string, Regard>} */
  const map = new Map();
  const clamp = (v) => Math.max(REGARD_MIN, Math.min(REGARD_MAX, v));
  const ok = (id) => typeof id === 'string' && id.length > 0 && id.length <= 40;
  /** @type {Record<string, Set<string>>} */
  const turns = Object.fromEntries(TURN_KINDS.map((k) => [k, new Set()]));
  /** @typedef {{ t: number, seen: boolean, who: string }} Hand */
  /** @type {Record<string, Map<string, Hand>>} LW7: the hand deaths, each with its minute */
  const hands = Object.fromEntries(HAND_KINDS.map((k) => [k, new Map()]));
  /** @type {Record<string, Set<string>>} LW6b: the marks */
  const marks = Object.fromEntries(MARK_KINDS.map((k) => [k, new Set()]));
  /** @type {Record<string, Map<string, { t: number, seen: boolean, who: string }>>} LW6d: the tales */
  const tales = Object.fromEntries(TALE_KINDS.map((k) => [k, new Map()]));
  const nameOk = (who) => (typeof who === 'string' ? who.slice(0, HAND_NAME_MAX) : '');
  /** The turns as one read - the same sets and maps `turn` writes into. */
  const allTurns = /** @type {{ spared: Set<string>, fallen: Set<string>, won: Set<string>, lost: Set<string>, slain: Map<string, Hand>, died: Map<string, Hand>, killed: Map<string, Hand>, laid: Set<string>, heard: Set<string>, looted: Set<string>, home: Map<string, Hand>, routed: Map<string, Hand>, held: Map<string, Hand> }} */ (/** @type {any} */ ({ ...turns, ...hands, ...marks, ...tales }));
  let turnsVersion = 0;
  const turnOk = (key) => typeof key === 'string' && key.length > 0 && key.length <= 80;
  /** LW11: the road's records @type {Map<string, { gone: Set<number>, coin: number, robbed: number | null }>} */
  const wares = new Map();
  /** @type {{ crime: number, region: number, at: number, who: string, witnesses: string[], trip?: string }[]} AUDIT LW-II C10:
   *  `trip` the party's (its own fallen read at the town) */
  const reports = [];
  /** @type {{ trip: string, t: number, pay: number, fights: number, leader: string, to: number, near: number | null } | null}
   *  AUDIT LW-II C5b: `near` the last minute the escort was with the party */
  let escort = null;
  const road = record && typeof record === 'object' && record.v === 1 && record.road && typeof record.road === 'object' ? record.road : null;
  if (road) {
    if (Array.isArray(road.wares)) {
      for (const e of road.wares.slice(-WARES_MAX)) {
        const [id, gone, coin, robbed] = Array.isArray(e) ? e : [];
        if (turnOk(id) && Array.isArray(gone)) wares.set(id, { gone: new Set(gone.filter((i) => Number.isSafeInteger(i) && i >= 0 && i < 1000)), coin: Number.isFinite(Number(coin)) ? Math.max(0, Number(coin)) : 0, robbed: robbed != null && Number.isFinite(Number(robbed)) ? Number(robbed) : null });
      }
    }
    if (Array.isArray(road.reports)) {
      for (const e of road.reports.slice(-REPORTS_MAX)) {
        const [crime, region, at, who, witnesses, trip] = Array.isArray(e) ? e : [];
        if (reportOk(crime, region) && Number.isFinite(Number(at)) && typeof witnesses === 'string') {
          reports.push({ crime, region, at: Number(at), who: nameOk(who), witnesses: witnesses.split(',').filter(ok), ...(turnOk(trip) ? { trip } : {}) });
        }
      }
    }
    if (Array.isArray(road.escort)) {
      const [trip, t, pay, fights, leader, to, near] = road.escort;
      if (turnOk(trip) && Number.isFinite(Number(t)) && Number.isFinite(Number(pay)) && ok(leader)) escort = { trip, t: Number(t), pay: Math.max(0, Number(pay)), fights: Math.max(0, Number(fights) | 0), leader, to: Number(to) | 0, near: near != null && Number.isFinite(Number(near)) ? Number(near) : null };
    }
  }
  if (record && typeof record === 'object' && record.v === 1 && record.turns && typeof record.turns === 'object') {
    for (const k of TURN_KINDS) {
      const list = /** @type {any} */ (record.turns)[k];
      if (Array.isArray(list)) for (const key of list.slice(-TURNS_MAX)) if (turnOk(key)) turns[k].add(key);
    }
    for (const k of MARK_KINDS) {
      const list = /** @type {any} */ (record.turns)[k];
      if (Array.isArray(list)) for (const key of list.slice(-TURNS_MAX)) if (turnOk(key)) marks[k].add(key);
    }
    for (const k of TALE_KINDS) {
      const list = /** @type {any} */ (record.turns)[k];
      if (!Array.isArray(list)) continue;
      for (const e of list.slice(-TURNS_MAX)) {
        const [key, t, who] = Array.isArray(e) ? e : [];
        if (turnOk(key) && Number.isFinite(Number(t))) tales[k].set(key, { t: Number(t), seen: true, who: nameOk(who) });
      }
    }
    for (const k of HAND_KINDS) {
      const list = /** @type {any} */ (record.turns)[k];
      if (!Array.isArray(list)) continue;
      for (const e of list.slice(-TURNS_MAX)) {
        const [key, t, seen, who] = Array.isArray(e) ? e : [];
        if (turnOk(key) && Number.isFinite(Number(t))) hands[k].set(key, { t: Number(t), seen: !!seen, who: nameOk(who) });
      }
    }
  }
  if (record && typeof record === 'object' && record.v === 1 && record.people && typeof record.people === 'object') {
    for (const [id, e] of Object.entries(record.people)) {
      if (!ok(id) || !e || typeof e !== 'object') continue;
      const r = Number(/** @type {any} */ (e).r), met = Number(/** @type {any} */ (e).met), seen = Number(/** @type {any} */ (e).seen), talked = Number(/** @type {any} */ (e).talked);
      if (!Number.isFinite(r)) continue;
      /** @type {Regard} */
      const got = { r: clamp(r), met: Number.isFinite(met) ? met : 0, seen: Number.isFinite(seen) ? seen : 0, talked: Number.isFinite(talked) ? talked : -1 };
      for (const tone of /** @type {const} */ (['polite', 'blunt', 'poach'])) { const d = Number(/** @type {any} */ (e)[tone]); if (Number.isFinite(d)) got[tone] = d; }   // LW7
      map.set(id, got);
    }
  }
  /** The regard as it stands on `day` - eased for the days unseen. */
  const eased = (e, day) => {
    const apart = Math.max(0, day - e.seen);
    const ease = apart * EASE_PER_DAY;
    return e.r > 0 ? Math.max(0, e.r - ease) : Math.min(0, e.r + ease);
  };
  /** Past RELATIONS_MAX the faintest regard goes first (the longest unseen of equals) - AUDIT-G3: as it stands on `day`,
   *  never `keep` (the one just noted). It read the regard as last noted, so a crowd's old crime, long eased to nothing,
   *  outweighed every new acquaintance, and a word to a stranger was forgotten as it was said. */
  const trim = (day, keep) => {
    if (map.size <= RELATIONS_MAX) return;
    const order = [...map.entries()].filter(([id]) => id !== keep).sort((a, b) => (Math.abs(eased(a[1], day)) - Math.abs(eased(b[1], day))) || (a[1].seen - b[1].seen));
    for (let i = 0; map.size > RELATIONS_MAX && i < order.length; i++) map.delete(order[i][0]);
  };
  return {
    /** The regard of `id` on `day` (0 for a stranger). @param {string} id @param {number} day */
    regard: (id, day) => { const e = map.get(id); return e ? eased(e, day) : 0; },
    /** 'friend' | 'neutral' | 'enemy' | 'hostile'. @param {string} id @param {number} day */
    standing(id, day) { return regardStanding(this.regard(id, day)); },
    /** Whether the player has met `id`. @param {string} id */
    known: (id) => map.has(id),
    /**
     * Something happened between the player and `id` on `day`: `kind` an EVENTS key (or `amount` given). A `talk` counts
     * once a day, and (LW7) each tone of word - `polite`, `insulted` - once a day; LW14 a find `poached`, once a day. Answers the new regard.
     * @param {string} id @param {keyof typeof EVENTS} kind @param {number} day @param {number} [amount]
     */
    note(id, kind, day, amount) {
      if (!ok(id)) return 0;
      /** @type {Regard} */
      const e = map.get(id) ?? { r: 0, met: day, seen: day, talked: -1 };
      const now = eased(e, day);
      let delta = Number.isFinite(amount) ? Number(amount) : (EVENTS[kind] ?? 0);
      if (kind === 'talk') { if (e.talked === day) delta = 0; else e.talked = day; }
      const tone = kind === 'polite' ? 'polite' : kind === 'insulted' ? 'blunt' : kind === 'poached' ? 'poach' : null;   // LW14: a find taken, once a day
      if (tone) { if (e[tone] === day) delta = 0; else e[tone] = day; }
      e.r = clamp(now + delta);
      e.seen = day;
      map.set(id, e);
      trim(day, id);
      return e.r;
    },
    /**
     * LEGACY6: a regard HANDED DOWN - a share of a parent's (systems/legacy/influence.js inheritRegards), added to what
     * stands on `day`. No word is counted for it, and a stranger is met by it. Answers the new regard.
     * @param {string} id @param {number} amount @param {number} day
     */
    inherit(id, amount, day) {
      if (!ok(id) || !Number.isFinite(amount) || !amount) return 0;
      /** @type {Regard} */
      const e = map.get(id) ?? { r: 0, met: day, seen: day, talked: -1 };
      e.r = clamp(eased(e, day) + amount);
      e.seen = day;
      map.set(id, e);
      trim(day, id);
      return e.r;
    },
    /** The player saw `id` on `day` (the regard stops easing from today). @param {string} id @param {number} day */
    seen(id, day) { const e = map.get(id); if (e) { e.r = eased(e, day); e.seen = day; } },
    /**
     * LW4: a turn of fate this character made - `kind` one of TURN_KINDS, `key` a place's `<place>@<cycle>` or an
     * encounter's id; LW7 one of HAND_KINDS, a place's, with `at` its minute (`t`), the name they bore (`who`) and,
     * slain, whether it was `seen`. Answers whether it was new.
     * LW6b: or one of MARK_KINDS, a mark kept as a turn is.
     * LW6d: or one of TALE_KINDS, a tale with its minute and the name it tells of.
     * @param {'spared'|'fallen'|'won'|'lost'|'slain'|'died'|'killed'|'laid'|'heard'|'looted'|'home'|'routed'|'held'} kind @param {string} key @param {{ t: number, seen?: boolean, who?: string }} [at]
     */
    turn(kind, key, at) {
      const tale = tales[kind];   // LW6d: a tale is kept as a hand death is - its minute, the name it tells of
      if (tale) {
        if (!turnOk(key) || tale.has(key) || !Number.isFinite(at?.t)) return false;
        tale.set(key, { t: Number(at?.t), seen: true, who: nameOk(at?.who) });
        if (tale.size > TURNS_MAX) tale.delete(/** @type {string} */ (tale.keys().next().value));
        turnsVersion++;
        return true;
      }
      const hand = hands[kind];
      if (hand) {
        if (!turnOk(key) || hand.has(key) || !Number.isFinite(at?.t)) return false;
        hand.set(key, { t: Number(at?.t), seen: !!at?.seen, who: nameOk(at?.who) });
        if (hand.size > TURNS_MAX) hand.delete(/** @type {string} */ (hand.keys().next().value));
        turnsVersion++;
        return true;
      }
      const set = turns[kind] ?? marks[kind];   // LW6b: a mark is kept as a turn is
      if (!set || !turnOk(key) || set.has(key)) return false;
      set.add(key);
      if (set.size > TURNS_MAX) set.delete(/** @type {string} */ (set.values().next().value));
      turnsVersion++;
      return true;
    },
    /** LW4: the character's turns of fate, by kind (read them; `turn` writes) - LW7 the hand deaths' maps beside them. */
    turns: () => allTurns,
    /** LW4: bumped at each new turn (the host's books read through them are made again). */
    turnsVersion: () => turnsVersion,
    /** LW11: a caravan's counter as this character left it - the goods gone from its shelf (their places in it) and the
     *  coin its purse has paid out; none, null. @param {string} tripId */
    wares: (tripId) => wares.get(tripId) ?? null,
    /** LW11: the counter left so - kept WARES_MAX newest (the last written the newest); `robbed` the minute the
     *  character robbed it (null: never). @param {string} tripId @param {Iterable<number>} gone @param {number} coin @param {number|null} [robbed] */
    setWares(tripId, gone, coin, robbed = null) {
      if (!turnOk(tripId)) return;
      wares.delete(tripId);
      wares.set(tripId, { gone: new Set([...gone].filter((i) => Number.isSafeInteger(i) && i >= 0 && i < 1000)), coin: Math.max(0, Number(coin) || 0), robbed: robbed != null && Number.isFinite(robbed) ? robbed : null });
      // AUDIT LW-II C7: A ROBBERY IS THE LAST FORGOTTEN - the oldest counter not robbed leaves first, while the robbed are
      // half the book or fewer (the oldest of WARES_MAX / 2 robberies is long home): pushed out by forty trades, a robbed
      // caravan restocked its shelf and its purse and was robbed again
      while (wares.size > WARES_MAX) {
        const robbedIds = [...wares].filter(([, w]) => w.robbed != null).map(([id]) => id);
        const out = robbedIds.length > WARES_MAX / 2 ? robbedIds[0] : [...wares].find(([, w]) => w.robbed == null)?.[0];
        wares.delete(out ?? /** @type {string} */ (wares.keys().next().value));
      }
    },
    /** LW11: the crimes witnesses are carrying to a town (read them; `report` and `dropReport` write). */
    reports: () => reports,
    /** LW11: a crime a witness carries - charged at `at` (the host's), void if every witness is dead by then; AUDIT LW-II
     *  C10 the law's crime, the map's region, and the party's `trip`.
     *  @param {{ crime: number, region: number, at: number, who?: string, witnesses: string[], trip?: string }} r */
    report(r) {
      if (!reportOk(r?.crime, r?.region) || !Number.isFinite(r?.at) || !Array.isArray(r?.witnesses)) return false;
      reports.push({ crime: r.crime, region: r.region, at: r.at, who: nameOk(r.who), witnesses: r.witnesses.filter(ok), ...(turnOk(r.trip) ? { trip: /** @type {string} */ (r.trip) } : {}) });
      while (reports.length > REPORTS_MAX) reports.shift();
      return true;
    },
    /** LW11: a report charged or void. @param {any} r */
    dropReport(r) { const i = reports.indexOf(r); if (i >= 0) reports.splice(i, 1); },
    /** LW11: the escort the character is hired on, or null. */
    escort: () => escort,
    /** LW11: hired on, or done (null); AUDIT LW-II C5b `near` the last minute the escort was with the party.
     *  @param {{ trip: string, t: number, pay: number, fights: number, leader: string, to: number, near?: number | null } | null} c */
    setEscort(c) { escort = c && turnOk(c.trip) && ok(c.leader) ? { trip: c.trip, t: Number(c.t) || 0, pay: Math.max(0, Number(c.pay) || 0), fights: Math.max(0, c.fights | 0), leader: c.leader, to: c.to | 0, near: c.near != null && Number.isFinite(c.near) ? Number(c.near) : null } : null; },
    /** Everyone known, for a list (the player's own). */
    entries: () => [...map.entries()].map(([id, e]) => ({ id, ...e })),
    size: () => map.size,
    /** The save's record. */
    snapshot() {
      /** @type {Record<string, Regard>} */
      const people = {};
      for (const [id, e] of map) {
        people[id] = { r: Math.round(e.r * 10) / 10, met: e.met, seen: e.seen, talked: e.talked };
        if (e.polite != null) people[id].polite = e.polite;   // LW7: only once counted
        if (e.blunt != null) people[id].blunt = e.blunt;
        if (e.poach != null) people[id].poach = e.poach;   // LW14: only once counted
      }
      // LW4: only once there is one; LW7 each hand death's kind only once there is one of it - [key, t, seen, who]
      const handsOut = Object.fromEntries(HAND_KINDS.filter((k) => hands[k].size).map((k) => [k, [...hands[k]].map(([key, h]) => [key, h.t, h.seen ? 1 : 0, h.who])]));
      const marksOut = Object.fromEntries(MARK_KINDS.filter((k) => marks[k].size).map((k) => [k, [...marks[k]]]));   // LW6b: only once there is one
      const talesOut = Object.fromEntries(TALE_KINDS.filter((k) => tales[k].size).map((k) => [k, [...tales[k]].map(([key, h]) => [key, h.t, h.who])]));   // LW6d: likewise
      const any = TURN_KINDS.some((k) => turns[k].size) || Object.keys(handsOut).length > 0 || Object.keys(marksOut).length > 0 || Object.keys(talesOut).length > 0;
      const t = any ? { turns: { ...Object.fromEntries(TURN_KINDS.map((k) => [k, [...turns[k]]])), ...handsOut, ...marksOut, ...talesOut } } : {};
      // LW11: the road's records, each only once there is one
      const roadOut = {
        ...(wares.size ? { wares: [...wares].map(([id, w]) => (w.robbed != null ? [id, [...w.gone].sort((a, b) => a - b), w.coin, w.robbed] : [id, [...w.gone].sort((a, b) => a - b), w.coin])) } : {}),
        ...(reports.length ? { reports: reports.map((r) => (r.trip ? [r.crime, r.region, r.at, r.who, r.witnesses.join(','), r.trip] : [r.crime, r.region, r.at, r.who, r.witnesses.join(',')])) } : {}),
        ...(escort ? { escort: escort.near != null ? [escort.trip, escort.t, escort.pay, escort.fights, escort.leader, escort.to, escort.near] : [escort.trip, escort.t, escort.pay, escort.fights, escort.leader, escort.to] } : {}),
      };
      return { v: 1, people, ...t, ...(Object.keys(roadOut).length ? { road: roadOut } : {}) };
    },
  };
}
