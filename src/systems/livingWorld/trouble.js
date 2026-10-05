// @ts-check
// LW4 (2026-10-04, bible/06-Systems/Living-World.md): TROUBLE ON THE ROAD - what a party meets between two towns, and
// what comes of it. Mac: NPCs "can encounter enemies in the overworld". Pure, like the trips it falls on (LW0 decision
// 2): a trip's trouble is a function of the trip, its party and the world's own data - every reader sees the same
// caravan beset at the same bend of the same road, by the same foes, with the same end.
//
// AT MOST ONE ENCOUNTER A TRIP. Its chance is the walk's: RISK_PER_DAY a day of walking, out and home, weighed by the
// ground the way crosses (`GROUND_RISK` - a road the safest, open country the worst), to RISK_MAX. A party carrying a
// FATED DEATH (lives.js - a member whose place the road empties this cycle) always meets it. It falls on the way out or
// the way home, at a seeded stretch of the walk - or, a leg that spans a night, now and then at the camp (CAMP_SHARE).
//
// THE FOES are the land's own: the climate's encounter table at the place it falls, day or night, the campers' themed
// group (campEncounters.js rollGroupComposition - the host's `foesOf`), at the party's level, sized to the party.
//
// THE END. A fated encounter ends as the lives say: the fated fall, and the party - the leader among the fallen - FELL
// (the rest turn home), or else WON at that cost. Any other is the party's strength against the foes' (`strengthOf`,
// `foeStrength`): DRIVEN off with ease, WON hard, or the party FLED - turned home before it got there. Each holds the
// party where it fell for its HALT_MIN (the fight its FIGHT_MIN of it, then the wounds bound and the dead seen to); a
// party that won walks on and makes up the halt by its arrival (`partyAt`'s catch-up); one turned home walks back from
// where it stood, and never comes to the town it set out for.
import { lwRng, textSeed } from './seed.js';
import { DAY_MIN } from './dayPlan.js';
import { WALK_TO_H, whenWalked, wayAt, NATIVE_PIXEL } from './trips.js';

/** A day's walking's chance of trouble, on middling ground. */
export const RISK_PER_DAY = 0.09;
/** The ground a way crosses, weighing its risk (a step's kind, travelRoute.js planRoute's `kinds`). */
export const GROUND_RISK = Object.freeze({ road: 0.6, track: 0.9, open: 1.4 });
/** A trip's chance of trouble is never more than this. */
export const RISK_MAX = 0.55;
/** Of the encounters on a leg that spans a night, the share that fall on the camp. */
export const CAMP_SHARE = 0.3;
/** The party held where it fell, minutes of the clock, by the end - and of it, the fight's own minutes. */
export const HALT_MIN = Object.freeze({ driven: 25, won: 60, fled: 15, fell: 45 });
export const FIGHT_MIN = Object.freeze({ driven: 10, won: 25, fled: 8, fell: 20 });
/** The most foes an encounter is. */
export const FOES_MAX = 6;
const TROU = 0x54524f55;   // 'TROU'

/** A member's weight in a fight: the armed by their level; the rest a stick and a will (a merchant a little more - a
 *  cart to stand behind). @param {any} res */
export const strengthOf = (res) => (res?.cls != null ? 4 + 1.5 * (res.level ?? 1) : res?.job === 'merchant' ? 1.5 : 1);
/** A foe's weight: by its level (a class foe at the party's). @param {number} level */
export const foeStrength = (level) => 1 + 0.6 * Math.max(1, level);

/**
 * @typedef {{ climateAt: (px: number, py: number) => number,
 *   foesOf: (q: { climateIndex: number, dungeonType?: number, minute: number, level: number, size: number, rolls: () => number }) => (number[] | null),
 *   foeLevel?: (type: number, level: number) => number, dies?: (res: any, trip: any) => boolean, diced?: (res: any, trip: any) => boolean,
 *   turnOf?: (encId: string) => ('won'|'lost'|null) }} TroubleWorld - `turnOf` the character's own turn of an encounter
 *   (relations.js turns: a fight the player won for the party, or lost with it)
 */

/**
 * THE TROUBLE a trip meets - null for none. `world`: `climateAt(px, py)` the climate index of a map pixel; `foesOf(q)`
 * the land's group there (`{ climateIndex, minute, level, size, rolls }` -> mobile types, or null); `foeLevel(type,
 * level)` a foe's level; `dies(res, trip)` whether the lives take this member on this trip.
 * @param {import('./trips.js').Trip} trip
 * @param {TroubleWorld} world
 */
export function troubleOf(trip, world) {
  if (trip.sea) return seaTrouble(trip, world);   // LW5b: a crossing meets none of the land's foes
  const walk = Math.max(0, trip.way.len - trip.trim0 - trip.trim1);
  if (!(walk > 0) || !(trip.pace > 0)) return null;
  const walkMin = walk / trip.pace;
  const days = Math.max(1, Math.ceil(walkMin / 720));
  // AUDIT-B1: THE TROUBLE'S SHAPE IS THE DICE'S, ITS END THE CHARACTER'S. Whether it comes, where, when, how many and how
  // it goes are the lives' own dice (`diced`: the character's turns of the cycle aside); who falls reads the turns
  // (`dies`: one the player spared lives). Shaped by the turns, a party the player had just saved re-rolled its whole
  // trouble - its fight gone from under it, its halt moved, met again elsewhere
  const fated = trip.party.filter((m) => (world.diced ?? world.dies)?.(m, trip)).map((m) => m.id);
  const dead = trip.party.filter((m) => world.dies?.(m, trip)).map((m) => m.id);
  if (trip.dive && (fated.length || dead.length)) return diveTrouble(trip, dead, world, fated);   // LW6: a dive's fated meet their end inside
  const rng = lwRng(textSeed(trip.id), TROU);
  const kinds = trip.way.kinds ?? [];
  const ground = kinds.length ? kinds.reduce((a, k) => a + (GROUND_RISK[/** @type {keyof typeof GROUND_RISK} */ (k)] ?? 1), 0) / kinds.length : 1;
  const risk = Math.min(RISK_MAX, RISK_PER_DAY * 2 * days * ground);
  const u = rng();
  if (!fated.length && !dead.length && u >= risk) return null;
  const leg = rng() < (fated.length ? 0.7 : 0.5) ? 'out' : 'back';
  const legStart = leg === 'out' ? trip.outT0 : trip.backT0;
  // where: a seeded stretch of the walk, or the camp of a leg's first night
  let wm = (0.15 + 0.7 * rng()) * walkMin;
  let t0 = whenWalked(legStart, wm), camp = false;
  // a leg its first day's light does not finish camps that night: now and then the trouble finds the camp, at eleven
  const firstLight = whenWalked(legStart, 0);
  const dayEnd = Math.floor(firstLight / DAY_MIN) * DAY_MIN + WALK_TO_H * 60;
  const firstDay = Math.max(0, dayEnd - firstLight);
  if (rng() < CAMP_SHARE && firstDay > 0 && firstDay < walkMin) { wm = firstDay; t0 = dayEnd + 4 * 60; camp = true; }
  const s = leg === 'out' ? trip.trim0 + trip.pace * wm : trip.way.len - trip.trim1 - trip.pace * wm;
  const p = wayAt(trip.way, s);
  const px = Math.floor(p.x / NATIVE_PIXEL), py = 499 - Math.floor(p.z / NATIVE_PIXEL);
  const armed = trip.party.filter((m) => m.cls != null);
  const level = Math.max(1, ...armed.map((m) => m.level ?? 1), 2);
  const size = fated.length ? Math.min(FOES_MAX, trip.party.length + 2) : Math.min(FOES_MAX, 1 + Math.floor(rng() * (trip.party.length + 1)));
  const foes = world.foesOf({ climateIndex: world.climateAt(px, py), minute: t0, level, size, rolls: rng }) ?? [];
  if (!foes.length && !fated.length && !dead.length) return null;   // the sea, a climate with no table: nothing out there
  /** @type {'driven'|'won'|'fled'|'fell'} the dice's - the halt and the fight's length */
  let shape;
  if (fated.length) shape = fated.includes(trip.leader.id) ? 'fell' : 'won';
  else {
    const sP = trip.party.reduce((a, m) => a + strengthOf(m), 0);
    const sF = foes.reduce((a, f) => a + foeStrength(world.foeLevel?.(f, level) ?? level), 0);
    const pWin = sP / (sP + sF);
    const r = rng();
    shape = r < 0.55 * pWin ? 'driven' : r < pWin ? 'won' : 'fled';
  }
  // how it went: the leader dead (a turn) the party fell, the fated leader spared it stood; and the character's own turn -
  // a fight they won for the party is won (its leader standing), one they lost with it, fled
  /** @type {'driven'|'won'|'fled'|'fell'} */
  let kind = dead.includes(trip.leader.id) ? 'fell' : shape === 'fell' ? 'won' : shape;
  const turn = world.turnOf?.(`${trip.id}:e`) ?? null;
  if (turn === 'won' && kind !== 'fell') kind = 'won';
  else if (turn === 'lost' && (kind === 'driven' || kind === 'won')) kind = 'fled';
  return { id: `${trip.id}:e`, leg, camp, t0, t1: t0 + HALT_MIN[shape], fightEnd: t0 + FIGHT_MIN[shape], s, x: p.x, z: p.z, px, py,
    foes, level, kind, shape, dead };
}

/**
 * LW6: THE DEEP'S TROUBLE - a dive carrying a fated death meets it INSIDE, at a seeded hour of its time there, among the
 * dungeon's own (its type's table - the host's `foesOf` with `dungeonType`): the leader among the fated, the party FELL
 * (the rest come out at once and walk home); else it WON at that cost. No halt on the road: it is under the ground.
 * AUDIT-B1/C2: its shape the dice's (`fated`: the leader among them, the company comes out at the fight's end - a spared
 * leader with it, never diving on to be met again); `dead` the end.
 * @param {import('./trips.js').Trip} trip @param {string[]} dead @param {TroubleWorld} world @param {string[]} [fated]
 */
export function diveTrouble(trip, dead, world, fated = dead) {
  const dive = /** @type {{ t0: number, t1: number }} */ (trip.dive);
  const rng = lwRng(textSeed(trip.id), TROU, 0x64656570);   // 'deep'
  const t0 = dive.t0 + (dive.t1 - dive.t0) * (0.2 + 0.6 * rng());
  const s = trip.way.len - trip.trim1;
  const p = wayAt(trip.way, s);
  const armed = trip.party.filter((m) => m.cls != null);
  const level = Math.max(1, ...armed.map((m) => m.level ?? 1), 2);
  const foes = world.foesOf({ climateIndex: -1, dungeonType: /** @type {any} */ (trip.to).dungeonType ?? 0, minute: t0, level, size: Math.min(FOES_MAX, trip.party.length + 2), rolls: rng }) ?? [];
  /** @type {'won'|'fell'} */
  const shape = fated.includes(trip.leader.id) ? 'fell' : 'won';
  /** @type {'won'|'fell'} */
  const kind = dead.includes(trip.leader.id) ? 'fell' : 'won';   // the character's turns are read in the lives (a member spared is no death)
  return { id: `${trip.id}:e`, leg: 'dive', camp: false, t0, t1: t0 + HALT_MIN[shape], fightEnd: t0 + FIGHT_MIN[shape], s, x: p.x, z: p.z,
    px: Math.floor(p.x / NATIVE_PIXEL), py: 499 - Math.floor(p.z / NATIVE_PIXEL), foes, level, kind, shape, dead, inside: true };
}

/**
 * LW5b: A CROSSING'S TROUBLE - none of the land's. A passenger the lives take this cycle is LOST AT SEA, at a seeded hour
 * of a crossing (the way out the likelier); the ship sails on with the rest. None fated, none.
 * @param {import('./trips.js').Trip} trip @param {TroubleWorld} world
 */
export function seaTrouble(trip, world) {
  const dead = trip.party.filter((m) => world.dies?.(m, trip)).map((m) => m.id);
  if (!dead.length) return null;
  const rng = lwRng(textSeed(trip.id), TROU, 0x736561);   // 'sea'
  const out = rng() < 0.6;
  const [a, b] = out ? [trip.outT0, trip.outT1] : [trip.backT0, trip.backT1];
  const t0 = a + (b - a) * (0.2 + 0.6 * rng());
  return { id: `${trip.id}:e`, leg: 'sea', camp: false, t0, t1: t0, fightEnd: t0, s: 0, x: 0, z: 0, px: -1, py: -1,
    foes: /** @type {number[]} */ ([]), level: 1, kind: /** @type {'fell'} */ ('fell'), dead, atSea: true };
}

/**
 * THE TRIP AS THE TROUBLE LEFT IT: its encounter (`enc`), the HALT where it fell, the FALLEN (out of the party from the
 * fight's middle), and - a party that fled or fell on the way out - TURNED: home from where it stood once the halt is
 * done, never at the town it set out for. A trip with no trouble is itself.
 * @param {import('./trips.js').Trip} trip @param {ReturnType<typeof troubleOf>} enc
 */
export function troubledTrip(trip, enc) {
  if (!enc) return trip;
  const byId = new Map(trip.party.map((m) => [m.id, m]));
  if (enc.leg === 'sea') {
    // LW5b: lost at sea - gone from the party at the hour, nowhere to lie; the ship sails on with the rest
    return { ...trip, enc, fallen: enc.dead.map((id) => ({ res: byId.get(id), t: enc.t0, s: 0, atSea: true })).filter((f) => f.res), turned: false };
  }
  const shape = enc.shape ?? enc.kind;   // AUDIT-B1: the fight's length and a dive's end are the dice's
  const fallAt = enc.t0 + FIGHT_MIN[shape] * 0.6;
  if (enc.leg === 'dive') {
    // LW6: under the ground - the fallen lie there; a party whose leader fell comes out at once and walks home (AUDIT-C2:
    // the dice's fall - a leader the player spared comes out with them, never diving on to be met a second time)
    const fallen = enc.dead.map((id) => ({ res: byId.get(id), t: fallAt, s: enc.s, inside: true })).filter((f) => f.res);
    if (shape !== 'fell') return { ...trip, enc, fallen, turned: false };
    const walk = Math.max(0, trip.way.len - trip.trim0 - trip.trim1) / trip.pace;
    const backT0 = Math.min(trip.backT0, enc.t1);
    return { ...trip, enc, fallen, turned: false, backT0, backT1: whenWalked(backT0, walk), dive: { t0: /** @type {any} */ (trip.dive).t0, t1: backT0 } };
  }
  const fallen = enc.dead.map((id) => ({ res: byId.get(id), t: fallAt, s: enc.s })).filter((f) => f.res);
  const halt = { t0: enc.t0, t1: enc.t1, fightEnd: enc.fightEnd, s: enc.s, leg: enc.leg };
  const turned = enc.leg === 'out' && (enc.kind === 'fled' || enc.kind === 'fell');
  // AUDIT-B7: a halt that runs past its leg's planned end holds the arrival (never halted on the road and lodged in town
  // at once; a way home's halt never cut by the party's being home)
  if (!turned && enc.leg === 'out' && enc.t1 > trip.outT1) return { ...trip, enc, halt, fallen, turned: false, outT1: Math.min(enc.t1, trip.backT0) };
  if (!turned && enc.leg === 'back' && enc.t1 > trip.backT1) return { ...trip, enc, halt, fallen, turned: false, backT1: enc.t1 };
  if (!turned) return { ...trip, enc, halt, fallen, turned: false };
  const home = Math.max(0, enc.s - trip.trim0) / trip.pace;
  const backT1 = whenWalked(enc.t1, home);
  return { ...trip, enc, halt, fallen, turned: true, outT1: enc.t0, backT0: enc.t1, backT1 };
}
