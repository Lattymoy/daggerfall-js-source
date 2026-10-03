// @ts-check
// ARENA2 (2026-10-02, Mac: "During fights, the crowd is present and can cheer/boo you"): THE CROWD'S LAW - its mood,
// its favour, what it says, what it sounds and how it moves, from the bout's events (systems/arenaBout.js). Design:
// bible/11-Multiplayer/Arena.md "4. The crowd".
//
// MOOD is one number from -1 (booing) to 1 (roaring), pushed by what happens on the sand and settling back to its base
// over MOOD_SETTLE_S: a big hit, a crit, a comeback, a fall raise it; a stall (no blow for eight seconds), a fighter
// fleeing, a yield taken early, an unfair beast bout lower it. FAVOUR is the crowd's mind of each fighter, -1 (its
// villain) to 1 (its darling): a fighter who strikes well and comes back is loved, one who runs or yields early is
// hated - and a hated fighter is booed every time they land a blow. A fighter from Daggerfall is the home crowd's from
// the start. Favour moves the purse (systems/arenaBout.js boutPurse).
//
// WHAT IT SAYS: a bark from ARENA_TEXT for what just happened (never the same line twice running, one every
// BARK_GAP_MS at most) and a home town's chant at a roar. WHAT IT SOUNDS: a cue list per event - the synthesised cheer,
// boo, applause and roar (systems/arenaSound.js) and Daggerfall's own gasp, groan, drums, bell and fanfares - which
// the host plays. HOW IT MOVES: the gesturers' frame rate rises with the mood, the tiers hop at a crit or a fall, and
// flowers or refuse are thrown at the verdict by favour.
//
// Pure: the bout's events and the clock in, numbers and cue lists out. Not a DFU member. Ledger A (ARENA).

import { ARENA_TEXT } from './arenaText.js';

/** How long the mood takes to settle most of the way back to its base, seconds (a time constant). */
export const MOOD_SETTLE_S = 7;
/** What each event does to the mood. */
export const MOOD_PUSH = Object.freeze({
  call: 0.15, fight: 0.25, hit: 0.05, crit: 0.22, knockdown: 0.28, comeback: 0.4, fall: 0.35, ringout: 0.22,
  stall: -0.32, flee: -0.3, yieldEarly: -0.45, yield: -0.12, timeout: -0.25, miss: -0.01, hitHated: -0.08,
});
/** What each event does to a fighter's favour (`a` the event's fighter; `b` the struck). */
export const FAVOUR_PUSH = Object.freeze({
  hit: 0.02, crit: 0.08, knockdown: 0.06, comeback: 0.35, flee: -0.28, yieldEarly: -0.4, yield: -0.1, fall: 0.05,
  ringout: -0.15, stall: -0.06,
});
/** A yield is EARLY when the yielder still had this share of their health (the crowd paid to see blood). */
export const YIELD_EARLY_SHARE = 0.1;
/** The home crowd's start for a fighter from Daggerfall, and the beast tier's base (the crowd thinks it unfair). */
export const HOME_FAVOUR = 0.3;
export const BEAST_BASE = -0.15;
/** At most one bark this often, ms. */
export const BARK_GAP_MS = 2600;
/** A hated fighter: favour at or under this is booed at every blow. */
export const HATED_AT = -0.3;
/** The gesturers' frames a second at rest, and how much faster at a roar (render/flatAnimation.js's own 5 fps). */
export const FLIP_FPS = 5;
export const FLIP_ROAR_X = 2.4;
/** The tiers' hop: its height, metres, and how long it lasts. */
export const HOP_M = 0.22;
export const HOP_MS = 650;

const clamp = (x, lo = -1, hi = 1) => (x < lo ? lo : x > hi ? hi : x);

/**
 * A NEW CROWD for a bout: `fighters` `[{ id, home, ai }]` (the bout's own), `beasts` whether the bout is the beast
 * tier's, `base` the mood it settles to (ARENA3: a laurelled banner's crowd).
 */
export function newCrowd({ fighters = [], beasts = false, base = 0 } = {}) {
  /** @type {Record<string, number>} */
  const favour = {};
  for (const f of fighters) favour[f.id] = f.home === 'Daggerfall' ? HOME_FAVOUR : 0;
  if (beasts) for (const f of fighters) if (f.ai === false) favour[f.id] = (favour[f.id] ?? 0) + 0.2;   // the crowd's sympathy for a fighter thrown to the beasts
  const b0 = clamp(base + (beasts ? BEAST_BASE : 0));
  return { mood: b0, base: b0, favour, homes: Object.fromEntries(fighters.map((f) => [f.id, f.home ?? ''])), peak: b0, lastBarkAt: -Infinity, lastBark: '', hopAt: -Infinity, hopAmp: 0, beasts };
}

/** The mood's band, for the HUD and the sound bed: booing, jeering, murmuring, cheering, roaring. Pure. */
export function moodBand(mood) {
  if (mood <= -0.5) return 'boo';
  if (mood < -0.15) return 'jeer';
  if (mood <= 0.15) return 'murmur';
  if (mood < 0.6) return 'cheer';
  return 'roar';
}

/** ARENA4: THE STANDS SHOUT - a spectator's cheer (`c` 1) or boo (-1) on the relay, `n` of them together: the mood
 *  pushed (each a little, a crowd of them more, to a bound), the tiers hop at a roar, and the cue. Pure but for the crowd.
 *  Answers the cues (crowdHear's shape). */
export const SHOUT_PUSH = 0.05;
export const SHOUT_MAX = 0.3;
export function crowdShout(c, dir, n = 1, now = 0) {
  if (!c || (dir !== 1 && dir !== -1)) return [];
  const k = Math.min(SHOUT_MAX, SHOUT_PUSH * Math.max(1, n));
  push(c, dir * k);
  if (dir > 0 && n >= 5) { c.hopAt = now; c.hopAmp = HOP_M * 0.6; }
  return [{ s: dir > 0 ? 'cheer' : 'boo', v: Math.min(1, 0.35 + 0.08 * n) }];
}

/** The mood settles toward its base over `dt` seconds. */
export function crowdTick(c, dt) {
  if (!c || !(dt > 0)) return c;
  const k = 1 - Math.exp(-dt / MOOD_SETTLE_S);
  c.mood += (c.base - c.mood) * k;
  return c;
}

const push = (c, d) => { c.mood = clamp(c.mood + d); if (c.mood > c.peak) c.peak = c.mood; };
const fav = (c, id, d) => { if (id != null && id in c.favour) c.favour[id] = clamp(c.favour[id] + d); };

/**
 * THE CROWD HEARS AN EVENT (systems/arenaBout.js) - the mood and the favour moved, and what it sounds: `[{ s, v }]`,
 * each `s` a cue the host plays ('cheer', 'boo', 'applause', 'roar', 'gasp', 'groan', 'drums', 'drumsCall', 'bell',
 * 'fanfare', 'title'), `v` its volume 0..1. `share(id)` a fighter's health share (the bout's), for the early yield;
 * `title` the bout gave a title (its fanfare).
 * @param {any} c @param {{ k: string, a?: string, b?: string, dmg?: number }} e
 * @param {{ share?: (id: string) => number, title?: boolean, now?: number }} [o]
 */
export function crowdHear(c, e, { share = () => 1, title = false, now = 0 } = {}) {
  /** @type {{ s: string, v: number }[]} */
  const cues = [];
  if (!c || !e) return cues;
  switch (e.k) {
    case 'call': push(c, MOOD_PUSH.call); cues.push({ s: 'drumsCall', v: 0.9 }, { s: 'cheer', v: 0.5 }); break;
    case 'crier': cues.push({ s: 'cheer', v: 0.35 + 0.3 * Math.max(0, c.favour[e.a] ?? 0) }); break;
    case 'walk': cues.push({ s: 'drums', v: 0.8 }); break;
    case 'fight': push(c, MOOD_PUSH.fight); cues.push({ s: 'bell', v: 1 }, { s: 'roar', v: 0.7 }); break;
    case 'hit': {
      const hated = (c.favour[e.a] ?? 0) <= HATED_AT;
      if (hated) { push(c, MOOD_PUSH.hitHated); cues.push({ s: 'boo', v: 0.45 }); }
      else { push(c, MOOD_PUSH.hit); if (c.mood > 0.15) cues.push({ s: 'cheer', v: 0.25 + 0.3 * c.mood }); }
      fav(c, e.a, FAVOUR_PUSH.hit);
      break;
    }
    case 'crit': push(c, MOOD_PUSH.crit); fav(c, e.a, FAVOUR_PUSH.crit); c.hopAt = now; c.hopAmp = HOP_M; cues.push({ s: 'gasp', v: 0.9 }, { s: 'roar', v: 0.6 }); break;
    case 'knockdown': push(c, MOOD_PUSH.knockdown); fav(c, e.a, FAVOUR_PUSH.knockdown); cues.push({ s: 'groan', v: 0.9 }, { s: 'roar', v: 0.55 }); break;
    case 'comeback': push(c, MOOD_PUSH.comeback); fav(c, e.a, FAVOUR_PUSH.comeback); cues.push({ s: 'roar', v: 1 }); break;
    case 'stall': push(c, MOOD_PUSH.stall); for (const id of Object.keys(c.favour)) fav(c, id, FAVOUR_PUSH.stall); cues.push({ s: 'boo', v: 0.8 }); break;
    case 'flee': push(c, MOOD_PUSH.flee); fav(c, e.a, FAVOUR_PUSH.flee); cues.push({ s: 'boo', v: 0.85 }); break;
    case 'yield': {
      const early = share(e.a ?? '') > YIELD_EARLY_SHARE;
      push(c, early ? MOOD_PUSH.yieldEarly : MOOD_PUSH.yield); fav(c, e.a, early ? FAVOUR_PUSH.yieldEarly : FAVOUR_PUSH.yield);
      cues.push({ s: 'boo', v: early ? 1 : 0.6 });
      break;
    }
    case 'fall': push(c, MOOD_PUSH.fall); fav(c, e.a, FAVOUR_PUSH.fall); c.hopAt = now; c.hopAmp = HOP_M * 1.4; cues.push({ s: 'groan', v: 0.7 }, { s: 'roar', v: 1 }); break;
    case 'ringout': push(c, MOOD_PUSH.ringout); fav(c, e.a, FAVOUR_PUSH.ringout); cues.push({ s: 'roar', v: 0.8 }); break;
    case 'timeout': push(c, MOOD_PUSH.timeout); cues.push({ s: 'bell', v: 1 }, { s: 'boo', v: 0.5 }); break;
    case 'verdict': cues.push({ s: 'applause', v: 1 }, { s: title ? 'title' : 'fanfare', v: 1 }); break;
    case 'miss': push(c, MOOD_PUSH.miss); break;
    default: break;
  }
  return cues;
}

/** The crowd's darling (the most favoured fighter, 0.25 or better) and its villain (the least, -0.25 or worse), or null. */
export function darlingOf(c) {
  let best = null, v = 0.25;
  for (const [id, f] of Object.entries(c?.favour ?? {})) if (f >= v) { v = f; best = id; }
  return best;
}
export function villainOf(c) {
  let worst = null, v = -0.25;
  for (const [id, f] of Object.entries(c?.favour ?? {})) if (f <= v) { v = f; worst = id; }
  return worst;
}

/** The bark for an event, or null (none for it, or one too soon): never the line said last; a hated fighter's blow
 *  has the boos' own lines, a roar now and then a home town's chant. `rng` the dice. */
export function crowdBark(c, e, now, rng = Math.random) {
  if (!c || !e || now - c.lastBarkAt < BARK_GAP_MS) return null;
  /** @type {readonly string[] | null} */
  let lines = null;
  const B = ARENA_TEXT.barks;
  switch (e.k) {
    case 'hit': lines = (c.favour[e.a] ?? 0) <= HATED_AT ? B.hitHated : (rng() < 0.35 ? B.hit : null); break;
    case 'crit': lines = B.crit; break;
    case 'knockdown': lines = B.knockdown; break;
    case 'stall': lines = B.stall; break;
    case 'flee': lines = B.flee; break;
    case 'comeback': lines = B.comeback; break;
    case 'yield': lines = B.yield; break;
    case 'fall': lines = B.fall; break;
    case 'ringout': lines = B.ringout; break;
    case 'timeout': lines = B.timeout; break;
    case 'fight': lines = c.beasts ? B.beast : B.roar; break;
    default: lines = null;
  }
  if (!lines?.length) return null;
  let line;
  // a roar for a fighter with a home: now and then the chant of their town
  const darling = darlingOf(c);
  if ((e.k === 'crit' || e.k === 'comeback') && darling && c.homes[darling] && rng() < 0.4) line = ARENA_TEXT.chant(c.homes[darling]);
  else {
    const pool = lines.length > 1 ? lines.filter((l) => l !== c.lastBark) : lines;
    line = pool[Math.floor(rng() * pool.length) % pool.length];
  }
  c.lastBark = line; c.lastBarkAt = now;
  return line;
}

/** HOW MANY STAND IN THE TIERS for a bout: an exhibition's afternoon crowd, a ladder bout's by its tier, a champion's
 *  more, the Grand Champion's sold out. Pure. */
export const CROWD_MAX = 420;
export function crowdCount({ kind = 'exhibition', tier = 0, champion = false, grand = false } = {}) {
  if (grand) return CROWD_MAX;
  const base = kind === 'exhibition' ? 140 : 90 + Math.max(0, Math.min(9, tier | 0)) * 26;
  return Math.min(CROWD_MAX, base + (champion ? 90 : 0));
}

/** The gesturers' frames a second at a mood (the classic 5 at a murmur, faster as it roars). Pure. */
export const crowdFlipFps = (mood) => FLIP_FPS * (1 + Math.max(0, mood) * (FLIP_ROAR_X - 1));
/** The tiers' hop now, metres - a bump that falls away over HOP_MS. Pure. */
export function crowdHop(c, now) {
  const t = now - (c?.hopAt ?? -Infinity);
  if (!(t >= 0 && t < HOP_MS)) return 0;
  return c.hopAmp * Math.sin(Math.PI * (t / HOP_MS));
}
/** WHAT IS THROWN at the verdict: flowers for a winner the crowd likes, refuse for one it does not (and for the beaten
 *  villain); more the louder it is. `{ flowers, refuse }`, counts. Pure. */
export function verdictThrows(c, winnerIds = [], loserIds = []) {
  const loud = 0.5 + Math.max(0, c?.mood ?? 0);
  const fw = winnerIds.reduce((s, id) => s + (c?.favour?.[id] ?? 0), 0) / Math.max(1, winnerIds.length);
  const fl = loserIds.reduce((s, id) => s + (c?.favour?.[id] ?? 0), 0) / Math.max(1, loserIds.length);
  const flowers = winnerIds.length ? Math.round(Math.max(0, 0.4 + fw) * 10 * loud) : 0;
  const refuse = Math.round(Math.max(0, -fw) * 10 * loud + Math.max(0, -fl) * 6 * loud);
  return { flowers: Math.min(16, flowers), refuse: Math.min(16, refuse) };
}
/** The flats thrown: Daggerfall's own item pictures (TEXTURE.254 - the roses, the red and yellow flowers; the teeth
 *  and the bones a crowd keeps for a villain). */
export const THROWN_FLOWERS = Object.freeze([[254, 26], [254, 27], [254, 11], [254, 12], [254, 29]]);
export const THROWN_REFUSE = Object.freeze([[254, 57], [254, 58], [254, 59]]);

/** THE CROWD'S PEOPLE, by archive and record (Daggerfall's own): the animated gesturer, the entertainers, the
 *  courtiers, the nobles, and the region's commoners (the High Rock sets) - the gesturer the most of them. */
export const CROWD_PEOPLE = Object.freeze({
  gesturer: Object.freeze([[182, 0]]),
  entertainers: Object.freeze([[182, 47], [182, 48], [182, 49], [182, 50], [182, 51], [182, 52], [182, 53]]),
  courtiers: Object.freeze([[180, 1], [180, 2], [180, 3]]),
  // ARENA-FIX 13: TEXTURE.185's court - the lord, the lady, the robed councillor, the king, the eastern lord, the queen -
  // seated at TEXTURE.183's scale (scenes/arenaBouts.js CROWD_SCALE: drawn at its own +128 it stood 6 m tall); its
  // guards and its knight (185:2-4) stay at the Palace
  nobles: Object.freeze([[183, 0], [183, 1], [183, 4], [185, 0], [185, 1], [185, 5], [185, 6], [185, 7], [185, 8]]),
  commoners: Object.freeze([[182, 1], [182, 2], [182, 3], [182, 4], [182, 5], [182, 6], [182, 7], [182, 8], [182, 9], [182, 10], [182, 11], [182, 12], [182, 13], [182, 14], [182, 15], [182, 16], [182, 17], [182, 18], [182, 19], [182, 20], [184, 0], [184, 1], [184, 2], [184, 3], [184, 4], [184, 5], [184, 6], [184, 7]]),
});

// ── THE BANNERS' HALVES (ARENA5) ────────────────────────────────────────────────────────────────────────────
// Arena.md 3: a team gives "its colours on your ladder bouts (your banners on your side of the floor, the crowd's half in
// your colour)". The tiers part down the floor's short axis: the WEST half (x < 0 in the floor's frame) is side 0's - the
// side a ladder fighter's mark and gate are on (systems/arenaFighters.js boutMarks) - the EAST half side 1's. A half whose
// side fights under a banner wears a soft WASH of its colours: a multiplier the billboard pass takes after both maps are
// sampled (render/renderer.js BB_FS `uBatchTint`, render/enhancedLighting.js EL_BB_FS), the colour the banners' own lore
// names (ARENA_TEXT.teams.lore - the Red's crimson and gold, the Blue's azure and silver), held near white so a face still
// reads as a face and the torchlight still lights it.
/** The wash each banner gives its half of the tiers, [r, g, b] (display colour, multiplied in). */
export const CROWD_WASH = Object.freeze({ red: Object.freeze([1, 0.8, 0.74]), blue: Object.freeze([0.78, 0.86, 1]) });
/** Which half of the tiers a seat sits in: 0 the west (side 0's), 1 the east (side 1's). Pure. */
export const crowdHalfOf = (x) => (x < 0 ? 0 : 1);
/** The wash for a banner, or null (no banner, an unknown one: the flat as it is). Pure. */
export const crowdWash = (banner) => (banner === 'red' || banner === 'blue' ? CROWD_WASH[banner] : null);
/** EACH HALF'S BANNER from the bout's fighters (`[{ id, side }]`) and their banners (`teams` by fighter id - the driver's
 *  own `C.teams`, which its laurel and realm law fill): a half takes the banner of the first of its side's fighters to
 *  wear one; a side past the second (a Grand Melee's third and fourth) has no half. `[west, east]`. Pure. */
export function crowdHalves(fighters, teams) {
  const out = /** @type {[string|null, string|null]} */ ([null, null]);
  for (const f of fighters ?? []) {
    const b = teams?.[f.id];
    if ((f.side === 0 || f.side === 1) && out[f.side] == null && (b === 'red' || b === 'blue')) out[f.side] = b;
  }
  return out;
}

/** Who sits where: `n` seats' people, by the seed - a third gesturers (they cheer), a sprinkle of entertainers on the
 *  lower terrace, the nobles and courtiers at the best seats (nearest the sand's middle), the rest commoners. `seats`
 *  `[{ x, y, z, best }]`. Pure. */
export function seatPeople(seats, rng) {
  return seats.map((s) => {
    const r = rng();
    const list = s.best && r < 0.55 ? (r < 0.25 ? CROWD_PEOPLE.courtiers : CROWD_PEOPLE.nobles)
      : r < 0.34 ? CROWD_PEOPLE.gesturer : r < 0.42 ? CROWD_PEOPLE.entertainers : CROWD_PEOPLE.commoners;
    const [archive, record] = list[Math.floor(rng() * list.length) % list.length];
    return { ...s, archive, record, phase: rng() };
  });
}
