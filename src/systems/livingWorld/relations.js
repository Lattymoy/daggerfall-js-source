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
// struck down (`slain`, and whether it was seen) and one who died fighting at the player's side (`died`) - deaths the
// road's dice never held, so the lives take the place from that minute (lives.js handDeath) and the road keeps the rest
// of the day as it was; the town talks of them by name (livingTown.js deedNews).

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
export const HAND_KINDS = Object.freeze(['slain', 'died']);
/** LW7: the longest name a hand death keeps. */
export const HAND_NAME_MAX = 60;
/** LW6b: the marks of what the living world has laid in this character's world - `laid`, the fallen of a dive left in
 *  its dungeon (`deep:<id>:<trip>`) - kept as the turns are, written only once there is one. */
export const MARK_KINDS = Object.freeze(['laid']);
/** LW6d: the tales its towns tell of the character - `home`, a keepsake carried home to a household (`<the one it was>@home`)
 *  - each with its minute and the name it tells of, kept as the hand deaths are (never one of them), written only once
 *  there is one, as [key, t, who]. */
export const TALE_KINDS = Object.freeze(['home']);

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
});

/** @typedef {{ r: number, met: number, seen: number, talked: number, polite?: number, blunt?: number }} Regard - `met`,
 *  `seen`, `talked` days (the clock's day numbers); LW7 `polite`, `blunt` the days a tone of word last counted */

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
  const allTurns = /** @type {{ spared: Set<string>, fallen: Set<string>, won: Set<string>, lost: Set<string>, slain: Map<string, Hand>, died: Map<string, Hand>, laid: Set<string>, home: Map<string, Hand> }} */ (/** @type {any} */ ({ ...turns, ...hands, ...marks, ...tales }));
  let turnsVersion = 0;
  const turnOk = (key) => typeof key === 'string' && key.length > 0 && key.length <= 80;
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
      for (const tone of /** @type {const} */ (['polite', 'blunt'])) { const d = Number(/** @type {any} */ (e)[tone]); if (Number.isFinite(d)) got[tone] = d; }   // LW7
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
     * once a day, and (LW7) each tone of word - `polite`, `insulted` - once a day. Answers the new regard.
     * @param {string} id @param {keyof typeof EVENTS} kind @param {number} day @param {number} [amount]
     */
    note(id, kind, day, amount) {
      if (!ok(id)) return 0;
      /** @type {Regard} */
      const e = map.get(id) ?? { r: 0, met: day, seen: day, talked: -1 };
      const now = eased(e, day);
      let delta = Number.isFinite(amount) ? Number(amount) : (EVENTS[kind] ?? 0);
      if (kind === 'talk') { if (e.talked === day) delta = 0; else e.talked = day; }
      const tone = kind === 'polite' ? 'polite' : kind === 'insulted' ? 'blunt' : null;
      if (tone) { if (e[tone] === day) delta = 0; else e[tone] = day; }
      e.r = clamp(now + delta);
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
     * @param {'spared'|'fallen'|'won'|'lost'|'slain'|'died'|'laid'|'home'} kind @param {string} key @param {{ t: number, seen?: boolean, who?: string }} [at]
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
      }
      // LW4: only once there is one; LW7 each hand death's kind only once there is one of it - [key, t, seen, who]
      const handsOut = Object.fromEntries(HAND_KINDS.filter((k) => hands[k].size).map((k) => [k, [...hands[k]].map(([key, h]) => [key, h.t, h.seen ? 1 : 0, h.who])]));
      const marksOut = Object.fromEntries(MARK_KINDS.filter((k) => marks[k].size).map((k) => [k, [...marks[k]]]));   // LW6b: only once there is one
      const talesOut = Object.fromEntries(TALE_KINDS.filter((k) => tales[k].size).map((k) => [k, [...tales[k]].map(([key, h]) => [key, h.t, h.who])]));   // LW6d: likewise
      const any = TURN_KINDS.some((k) => turns[k].size) || Object.keys(handsOut).length > 0 || Object.keys(marksOut).length > 0 || Object.keys(talesOut).length > 0;
      const t = any ? { turns: { ...Object.fromEntries(TURN_KINDS.map((k) => [k, [...turns[k]]])), ...handsOut, ...marksOut, ...talesOut } } : {};
      return { v: 1, people, ...t };
    },
  };
}
