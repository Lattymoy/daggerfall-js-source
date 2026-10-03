// @ts-check
// ARENA2 (2026-10-02, Mac: "Players can choose to watch AI fights ... and climb esclating tiers of opponents"; "I want
// this to be extremely detailed and authentic"): THE BOUT LAW - every bout on the arena's sand runs this one law, an
// exhibition between two AI fighters on the city floor, a ladder bout in the floor's instance, and (ARENA4) a bout the
// relay referees. Design: bible/11-Multiplayer/Arena.md "2. The fights".
//
// PURE. No clock, no dice, no game: `now` is handed to every call and the dice (`rng`) to the one that rolls (an AI's
// temper at the yield line), so the relay can run the same law on its own clock, a test can drive a whole bout in a
// loop, and two screens fed the same words reach the same verdict. The game's side - the bodies, their blows, the
// floor - reports to it (`boutHit`, `boutMiss`, `boutFell`, `boutPos`, `boutYield`, `boutAtMarks`) and reads back its
// phase and the EVENTS it raises (`takeBoutEvents`), which the crowd, the Herald and the HUD hear.
//
// THE PHASES: the Herald's CALL (each fighter cried by name) - the WALK to the marks - the COUNT, "3 - 2 - 1 - Fight!"
// (the duel's three seconds) - the FIGHT - its END - the Herald's VERDICT - the HEAL (the duel's hold, then full) -
// DONE (the purse is the caller's, by `boutPurse`).
//
// HOW A BOUT ENDS (a side is out when every fighter on it is out; the bout ends when one side stands - or none):
// - YIELD: at YIELD_SHARE of their health or under, a fighter may yield - the player by choice (sheathing the blade,
//   the host's door), an AI by its TEMPER (`aiYields`, one roll a second). Above the line a yield is refused.
// - FALL: the 1 HP floor - nobody dies on the arena's sand (playerEntity.hurtPlayer's `spare`, the foe yield floor in
//   the pools' damage doors); the host reports the floor reached (`boutFell`).
// - RING-OUT: a fighter past the ring's radius plus its slack (the duel's DUEL_OUT_SLACK_M) for DUEL_OUT_MS.
// - TIME: BOUT_LIMIT_MS of fighting, then THE JUDGES - damage dealt, then hits landed, then fewer misses; level on all
//   three is a draw.
//
// THE EVENTS (each `{ k, at, ... }`): `call` (once, then `crier` a fighter), `walk`, `count` (n 3, 2, 1), `fight`,
// `hit` (a, b, dmg), `crit`, `miss` (a), `knockdown` (a blow of KNOCKDOWN_SHARE of the struck's health, or one that
// takes them under the line), `comeback` (a fighter once down to COMEBACK_LOW drawing level), `stall` (no blow landed
// for STALL_MS), `flee` (a fighter outside the ring's line, inside its slack, for FLEE_MS), `yield`, `fall`,
// `ringout`, `timeout`, `end` (the result), `verdict`, `heal`, `done`. The crowd's mood and the Herald's words are
// built from them (systems/arenaCrowd.js) - the law says what happened, never how it sounds.
//
// Not a DFU member (Daggerfall has no arena). Ledger A (ARENA).

import { DUEL_OUT_SLACK_M, DUEL_OUT_MS, DUEL_HEAL_HOLD_MS, DUEL_COUNTDOWN_MS } from '../net/duelSession.js';

/** The phases, in order. */
export const BOUT_PHASES = Object.freeze(['call', 'walk', 'count', 'fight', 'end', 'verdict', 'heal', 'done']);
/** How long the Herald cries the bout before the fighters walk (a beat a fighter, and the bout's own line). */
export const CALL_BEAT_MS = 1600;
/** The longest the walk to the marks may take - a fighter who has not reached their mark by then starts where they
 *  stand. */
export const WALK_MAX_MS = 9000;
/** "3 - 2 - 1" (the duel's countdown), then the word "Fight!" with the first blow allowed. */
export const COUNT_MS = DUEL_COUNTDOWN_MS;
/** The fight's limit, then the judges. */
export const BOUT_LIMIT_MS = 3 * 60_000;
/** A fight's end held this long before the Herald's verdict (the fallen hit the sand, the crowd sees it). */
export const END_HOLD_MS = 1500;
/** The verdict and the purse said, this long before the healers. */
export const VERDICT_MS = 4500;
/** The healers' hold (the duel's): the loser stands at 1 this long, then everyone is whole. */
export const HEAL_HOLD_MS = DUEL_HEAL_HOLD_MS;
/** A fighter may yield at this share of their health or under. */
export const YIELD_SHARE = 0.15;
/** No blow landed for this long is a stall. */
export const STALL_MS = 8000;
/** The ring's slack past its line (the duel's) and how long past it is out (the duel's). */
export const RING_SLACK_M = DUEL_OUT_SLACK_M;
export const RING_OUT_MS = DUEL_OUT_MS;
/** Outside the ring's line (inside its slack) this long is fleeing. */
export const FLEE_MS = 1500;
/** A blow of this share of the struck's whole health knocks them down (the crowd's "Get up!"). */
export const KNOCKDOWN_SHARE = 0.25;
/** A fighter once this low who draws level with (or past) the one beating them is a comeback. */
export const COMEBACK_LOW = 0.35;
/** How often an AI at the yield line asks its temper, ms. */
export const TEMPER_EVERY_MS = 1000;
/** The temper's whole chance a roll at the yield line (temper 1 = this, temper 0 = never). */
export const TEMPER_ROLL = 0.45;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const share = (f) => (f.maxHealth > 0 ? clamp01(f.health / f.maxHealth) : 0);

/**
 * @typedef {{ id: string, name: string, side: number, maxHealth: number, health: number, temper: number, ai: boolean,
 *   home?: string, epithet?: string, out: null|'yield'|'fall'|'ringout', outAt: number, dealt: number, hits: number,
 *   misses: number, crits: number, low: boolean, comeback: boolean, outsideAt: number, fleeing: boolean, atMark: boolean,
 *   temperAt: number, pos: number[]|null }} BoutFighter
 * @typedef {{ k: string, at: number, a?: string, b?: string, dmg?: number, n?: number, side?: number|null, how?: string }} BoutEvent
 */

/**
 * A NEW BOUT, in its call. `fighters` each `{ id, name, side, maxHealth, health?, temper?, ai?, home?, epithet? }` - two
 * sides or more (a Grand Melee is every fighter a side of its own); `ring` `{ centre: [x, z], radius }` on the ground;
 * `kind` the bout's ('exhibition', 'ladder', 'champion', 'grand', 'melee'); `limitMs` the fight's limit.
 * @param {{ id: string, kind?: string, fighters: any[], ring: { centre: number[], radius: number }, now: number, limitMs?: number, tier?: number, label?: string }} o
 */
export function newBout({ id, kind = 'exhibition', fighters, ring, now, limitMs = BOUT_LIMIT_MS, tier = 0, label = '' }) {
  if (!Array.isArray(fighters) || fighters.length < 2) throw new Error('arenaBout: a bout needs two fighters');
  const sides = new Set(fighters.map((f) => f.side));
  if (sides.size < 2) throw new Error('arenaBout: a bout needs two sides');
  const b = {
    id: String(id), kind, tier, label, limitMs, phase: 'call', phaseAt: now, startAt: now, fightAt: NaN, endAt: NaN,
    ring: { centre: [ring.centre[0], ring.centre[1]], radius: ring.radius },
    /** @type {BoutFighter[]} */
    fighters: fighters.map((f) => ({
      id: String(f.id), name: String(f.name ?? f.id), side: f.side | 0, maxHealth: Math.max(1, f.maxHealth | 0),
      health: Math.max(1, (f.health ?? f.maxHealth) | 0), temper: clamp01(f.temper ?? 0.5), ai: f.ai !== false,
      home: f.home ?? '', epithet: f.epithet ?? '', out: null, outAt: NaN, dealt: 0, hits: 0, misses: 0, crits: 0,
      low: false, comeback: false, outsideAt: NaN, fleeing: false, atMark: false, temperAt: now, pos: null,
    })),
    lastBlowAt: NaN, stallSaid: false, criers: 0, countN: 3,
    /** @type {null | { side: number|null, how: string, winners: string[], losers: string[], judges: any }} */
    result: null,
    /** @type {BoutEvent[]} */
    events: [],
  };
  emit(b, { k: 'call', at: now });
  return b;
}

/** @param {any} b @param {BoutEvent} e */
function emit(b, e) { b.events.push(e); }
/** The events raised since the last take, in order - the caller's to hear once. */
export function takeBoutEvents(b) { const e = b.events; b.events = []; return e; }

const fighterOf = (b, id) => b.fighters.find((f) => f.id === String(id)) ?? null;
/** A fighter of the bout by id, or null. */
export const boutFighter = fighterOf;
/** The sides still standing (a fighter on it not out). */
export const standingSides = (b) => [...new Set(b.fighters.filter((f) => !f.out).map((f) => f.side))];
/** Is a blow or a yield the fight's to take now? */
export const boutLive = (b) => b?.phase === 'fight';
/** Is the bout before its fight (the call, the walk, the count) - the fighters stand and do not strike. */
export const boutBefore = (b) => b?.phase === 'call' || b?.phase === 'walk' || b?.phase === 'count';
/** Is the bout over (its verdict said or later)? */
export const boutOver = (b) => !!b && (b.phase === 'end' || b.phase === 'verdict' || b.phase === 'heal' || b.phase === 'done');
/** The fight's time left, ms (the whole limit before it starts, 0 after). */
export function boutTimeLeft(b, now) {
  if (!b) return 0;
  if (b.phase === 'fight') return Math.max(0, b.fightAt + b.limitMs - now);
  if (boutBefore(b)) return b.limitMs;
  // after the fight the clock stands where the fight ended - a fall at 2:18 reads 2:18 through the verdict, not 0:00
  return Number.isFinite(b.fightAt) && Number.isFinite(b.endAt) ? Math.max(0, b.fightAt + b.limitMs - b.endAt) : 0;
}
/** How long the call lasts for this bout: a beat for its line and one for each fighter. */
export const callMs = (b) => CALL_BEAT_MS * (1 + b.fighters.length);

/** Move to `phase` at `now`, said. */
function enter(b, phase, now, extra = {}) {
  b.phase = phase; b.phaseAt = now;
  emit(b, { k: phase, at: now, ...extra });
}

/** The fighter's mark is reached (the host's walk). The count starts when every fighter stands on theirs. */
export function boutAtMarks(b, id, now) {
  const f = fighterOf(b, id);
  if (!f || b.phase !== 'walk') return false;
  f.atMark = true;
  if (b.fighters.every((x) => x.atMark)) { b.countN = 3; enter(b, 'count', now, { n: 3 }); }
  return true;
}

/**
 * THE CLOCK'S WORK: the call's criers, the walk's limit, the count's numbers, the fight's stall, flee, ring-out, the AI
 * tempers at the yield line and the time limit, and the end's hold, the verdict's and the healers'. `rng` the dice for
 * the tempers (Math.random's shape).
 */
export function boutTick(b, now, rng = Math.random) {
  if (!b) return b;
  const t = now - b.phaseAt;
  switch (b.phase) {
    case 'call': {
      // the Herald cries each fighter a beat apart, after the bout's own line
      const due = Math.min(b.fighters.length, Math.floor(t / CALL_BEAT_MS));
      while (b.criers < due) { const f = b.fighters[b.criers++]; emit(b, { k: 'crier', at: now, a: f.id }); }
      if (t >= callMs(b)) enter(b, 'walk', now);
      break;
    }
    case 'walk':
      if (t >= WALK_MAX_MS) { b.countN = 3; enter(b, 'count', now, { n: 3 }); }
      break;
    case 'count': {
      const n = 3 - Math.floor(t / (COUNT_MS / 3));
      if (n >= 1 && n < (b.countN ?? 3)) { b.countN = n; emit(b, { k: 'count', at: now, n }); }
      if (t >= COUNT_MS) { b.fightAt = now; b.lastBlowAt = now; for (const f of b.fighters) { f.temperAt = now; f.outsideAt = NaN; } enter(b, 'fight', now); }
      break;
    }
    case 'fight': fightTick(b, now, rng); break;
    case 'end': if (t >= END_HOLD_MS) enter(b, 'verdict', now, { side: b.result?.side ?? null, how: b.result?.how ?? '' }); break;
    case 'verdict': if (t >= VERDICT_MS) enter(b, 'heal', now); break;
    case 'heal': if (t >= HEAL_HOLD_MS) enter(b, 'done', now); break;
    default: break;
  }
  return b;
}

function fightTick(b, now, rng) {
  // THE STALL: no blow landed for STALL_MS - said once a stall, the clock reset by the next blow
  if (!b.stallSaid && now - b.lastBlowAt >= STALL_MS) { b.stallSaid = true; emit(b, { k: 'stall', at: now }); }
  for (const f of b.fighters) {
    if (f.out) continue;
    // FLEE and RING-OUT, from the last place the host gave
    if (f.pos) {
      const d = Math.hypot(f.pos[0] - b.ring.centre[0], f.pos[1] - b.ring.centre[1]);
      if (d > b.ring.radius + RING_SLACK_M) {
        if (!Number.isFinite(f.outsideAt)) f.outsideAt = now;
        if (now - f.outsideAt >= RING_OUT_MS) { out(b, f, 'ringout', now); continue; }
      } else if (d > b.ring.radius) {
        if (!Number.isFinite(f.outsideAt)) f.outsideAt = now;
        if (!f.fleeing && now - f.outsideAt >= FLEE_MS) { f.fleeing = true; emit(b, { k: 'flee', at: now, a: f.id }); }
      } else { f.outsideAt = NaN; f.fleeing = false; }
    }
    // THE TEMPER: an AI at the yield line asks it once a second
    if (f.ai && share(f) <= YIELD_SHARE && now - f.temperAt >= TEMPER_EVERY_MS) {
      f.temperAt = now;
      if (aiYields(f.temper, share(f), rng)) out(b, f, 'yield', now);
    }
  }
  if (b.phase === 'fight' && now - b.fightAt >= b.limitMs) timeUp(b, now);
}

/** An AI's temper at the yield line: never above it, never with no temper (a beast's), otherwise a roll - a quick
 *  temper yields soon, a stubborn one fights on to the floor. Pure. */
export function aiYields(temper, healthShare, rng = Math.random) {
  if (!(healthShare <= YIELD_SHARE) || !(temper > 0)) return false;
  return rng() < clamp01(temper) * TEMPER_ROLL;
}

/** A fighter out of the bout by `how`, said; the bout ends when one side (or none) stands. */
function out(b, f, how, now) {
  if (f.out) return;
  f.out = how; f.outAt = now;
  emit(b, { k: how, at: now, a: f.id });
  const left = standingSides(b);
  if (left.length <= 1) finish(b, left.length ? left[0] : null, how, now);
}

/** The fight ended - the result kept, the end said. */
function finish(b, side, how, now, judges = null) {
  if (b.result) return;
  const winners = side === null ? [] : b.fighters.filter((f) => f.side === side).map((f) => f.id);
  const losers = b.fighters.filter((f) => f.side !== side).map((f) => f.id);
  b.result = { side, how, winners, losers, judges };
  b.endAt = now;
  enter(b, 'end', now, { side, how });
}

/** THE JUDGES: each standing side's damage dealt, then its hits, then the fewest misses - the best side wins; level on
 *  all three is a draw (null). `sides` [{ side, dealt, hits, misses }]. Pure. */
export function judgeBout(sides) {
  const ranked = [...sides].sort((x, y) => (y.dealt - x.dealt) || (y.hits - x.hits) || (x.misses - y.misses));
  if (!ranked.length) return null;
  const [a, c] = ranked;
  if (c && a.dealt === c.dealt && a.hits === c.hits && a.misses === c.misses) return null;
  return a.side;
}
/** The sides' tallies for the judges - the standing sides alone (a fighter out is out of the reckoning too, but their
 *  side's blows count while any of it stands). */
export function boutTallies(b) {
  const by = new Map();
  for (const f of b.fighters) {
    const t = by.get(f.side) ?? { side: f.side, dealt: 0, hits: 0, misses: 0, standing: false };
    t.dealt += f.dealt; t.hits += f.hits; t.misses += f.misses; t.standing ||= !f.out;
    by.set(f.side, t);
  }
  return [...by.values()];
}
function timeUp(b, now) {
  emit(b, { k: 'timeout', at: now });
  const tallies = boutTallies(b).filter((t) => t.standing);
  finish(b, judgeBout(tallies), 'judges', now, tallies);
}

/**
 * A BLOW LANDED: `from` struck `to` for `dmg` (the game's damage, already applied), leaving them at `health`; `crit` a
 * critical (DFU's crit strike). Raises hit, crit, knockdown and comeback. A blow outside the fight counts nothing.
 * @param {any} b
 * @param {{ from: string, to: string, dmg: number, health?: number, crit?: boolean, now: number }} blow
 */
export function boutHit(b, blow) {
  const { from, to, dmg, health, crit = false, now } = blow;
  if (!boutLive(b)) return false;
  const a = fighterOf(b, from), t = fighterOf(b, to);
  if (!a || !t || a === t || a.out || t.out || a.side === t.side) return false;
  const d = Math.max(0, Math.round(Number(dmg) || 0));
  if (!(d > 0)) return false;
  const was = share(t);
  t.health = Number.isFinite(health) ? Math.max(0, Math.min(t.maxHealth, Math.round(/** @type {number} */ (health)))) : Math.max(0, t.health - d);
  a.dealt += d; a.hits++;
  b.lastBlowAt = now; b.stallSaid = false;
  emit(b, { k: 'hit', at: now, a: a.id, b: t.id, dmg: d });
  if (crit) { a.crits++; emit(b, { k: 'crit', at: now, a: a.id, b: t.id, dmg: d }); }
  const now2 = share(t);
  if (d >= t.maxHealth * KNOCKDOWN_SHARE || (was > YIELD_SHARE && now2 <= YIELD_SHARE)) emit(b, { k: 'knockdown', at: now, a: a.id, b: t.id });
  if (now2 <= COMEBACK_LOW) t.low = true;
  // THE COMEBACK: a fighter once down at COMEBACK_LOW who has now drawn level with the one they struck - said once
  if (a.low && !a.comeback && share(a) >= now2) { a.comeback = true; emit(b, { k: 'comeback', at: now, a: a.id }); }
  return true;
}

/** A blow that missed (the swing that connected nothing, the shaft that flew wide) - the judges' third count. */
export function boutMiss(b, { from, now }) {
  if (!boutLive(b)) return false;
  const a = fighterOf(b, from);
  if (!a || a.out) return false;
  a.misses++;
  emit(b, { k: 'miss', at: now, a: a.id });
  return true;
}

/** THE FLOOR: the fighter's health reached the 1 HP floor (the host's spare / the foe yield floor) - they are down. */
export function boutFell(b, id, now) {
  if (!boutLive(b)) return false;
  const f = fighterOf(b, id);
  if (!f || f.out) return false;
  f.health = Math.min(f.health, 1);
  out(b, f, 'fall', now);
  return true;
}

/**
 * A YIELD BY CHOICE (the player sheathing the blade): taken at YIELD_SHARE or under, refused above ('early'); a fighter
 * not in a live fight refused ('not-live'). Answers null when taken, else the refusal's word.
 */
export function boutYield(b, id, now) {
  const f = fighterOf(b, id);
  if (!boutLive(b) || !f || f.out) return 'not-live';
  if (share(f) > YIELD_SHARE) return 'early';
  out(b, f, 'yield', now);
  return null;
}

/** Where a fighter stands now, on the ground ([x, z] - the ring's frame). */
export function boutPos(b, id, xz) {
  const f = fighterOf(b, id);
  if (!f || !xz || !Number.isFinite(xz[0]) || !Number.isFinite(xz[1])) return false;
  f.pos = [xz[0], xz[1]];
  return true;
}

/** A fighter's health set from the game (a heal, a regeneration) - the law's copy follows the body. */
export function boutHealth(b, id, health) {
  const f = fighterOf(b, id);
  if (!f) return false;
  f.health = Math.max(0, Math.min(f.maxHealth, Math.round(Number(health) || 0)));
  return true;
}

/** A fighter's share of health (0..1). */
export const fighterShare = share;

/** THE PURSE: the base purse raised or cut by the crowd's favour (-1..1) - a darling's up to half again, a villain's cut
 *  to three quarters - in whole gold. Pure. */
export const PURSE_FAVOUR_MAX = 0.5;
export const PURSE_FAVOUR_MIN = -0.25;
export function boutPurse(base, favour = 0) {
  const f = Math.max(-1, Math.min(1, Number(favour) || 0));
  const k = 1 + (f >= 0 ? f * PURSE_FAVOUR_MAX : -f * PURSE_FAVOUR_MIN);
  return Math.max(0, Math.round((Number(base) || 0) * k));
}

/** The names of a side's fighters, joined ("Aldo and Bran"). */
export function sideNames(b, side) {
  const names = b.fighters.filter((f) => f.side === side).map((f) => f.name);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
/** The names of every fighter not on `side`, joined. */
export function otherNames(b, side) {
  const names = b.fighters.filter((f) => f.side !== side).map((f) => f.name);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
