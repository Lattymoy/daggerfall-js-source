// @ts-check
// NAV-G (2026-09-28, Mac: "directly integrate into online mode") - THE WIRE: the sea's ships, their volleys and the
// blows on them, between the players in a cell. The port's own; pure.
//
// THE SEA IS THE ROOM'S, STOOD BY ONE. The open bay is cells (net/wire.js isCellRoom) - no host seat, no room memory -
// so the ships a group of players meets are stood the way Iliac Puddle No More's deep is (scenes/deepWatersHost.js
// standsTheDeep, DEEP-SHARE): by ONE of them, the lowest id among the players within NAVAL_SHARE_RADIUS of each
// other (systems/campEncounters.js amGroupRollOwner, with its hysteresis), who launches them, sails them and fights
// them, and says them in `nv` on their own foes frame - beside Come Sail Away's `sa`, which already tells the others
// where each player's own boat is. The relay reads nothing inside a foes frame, so this needs no relay change, and
// this module sits outside the relay's bundle (net/wire.js is inside it) for exactly that reason.
//
// THE WORD. `nv: { s, v, b }`:
//   s - the ships, each [n, cls, variant, x, y, z, yaw, speed, sails, hull%, sail%, crew%, state, heel, seed, fire,
//       runOut, gen, region] in the wire frame's natives (the owner's `toWire`, as every cell object's), at most
//       NAVAL_WIRE_SHIPS; `runOut` (AUDIT NAV1, the guns) the batteries she has run out, a bit a side in SIDE_CODES'
//       order - the tell every player sees and hears before her broadside - and a word without it (an older build's)
//       reads none. AUDIT NAV1 (online): `gen` her HANDOVER's count - her seed is who she is in every client's sea, and
//       of two players saying the same seed the greater `gen` holds her, on a tie the lower id (navalHost.js
//       `claimBeats`); a ship is taken over at one past it (her stander gone from the cell, her boarder grappled) -
//       and `region` the region her names were drawn in, so every player calls her and her captain the same (-1: the
//       reader's own, as an older build's word reads)
//   v - the volleys of the last NAVAL_VOLLEY_KEEP_MS, each [id, shooter, hull, side, x, y, z, yaw, vx, vz, elevation,
//       seed, skill, age]: the shooting ship's number (-1: the owner's own boat), its hull and root pose at the fire, the
//       lay and the volley's seed - every receiver flies the same balls from it (navalGunnery.js volleyLaunches) and
//       draws them, hitting nothing (`resolve: false`); at most NAVAL_WIRE_VOLLEYS. AUDIT NAV1 (online #15): `age` the
//       milliseconds since she fired when the word was said - the receiver flies her balls from that far along, in step
//       with her shooter's (they landed late by the word's cadence, or by a word and more when a later one first carried
//       them); an older build's thirteen fields read as none
//   b - the fire barrels dropped in the same window, each [id, x, y, z, shooter], at most NAVAL_WIRE_BARRELS - AUDIT
//       NAV1 (online #7): `shooter` the dropping ship's number as a volley's (-1: the owner's own boat; an older
//       build's four fields read so), so a pirate's barrel blows under any player's boat, not its stander's alone
//   p - AUDIT NAV1 (online): the owner's own boat at sea - [hull%, crippled, boarders]: her hull, whether she is a wreck,
//       and whether the player lets pirates board them (the Features row) - the captains another stands judge her by
//   n - AUDIT NAV1 (online #6): the owner's notoriety, each [crown, 0..NOTORIETY.max] by CROWNS' row, the crowns it is
//       owed in - another's navy hunts every player by their own, never by its stander's
//   t - AUDIT NAV1 (online #15): the owner's Ships at sea, by navalDirector.js DENSITY_KEYS' row - said only when it is
//       not TRAFFIC_DEFAULT, which a word without it (or no word at all) stands for; a shared sea is sailed at the lowest
//       of its players' (the stander's alone sailed everyone's)
//   f - AUDIT NAV1 (online #15): the casks of a sunk ship's cargo afloat in the owner's sea, each [id, x, y, z, cls, lot]
//       - the ship's class by its row and the lot's key by navalPlunder.js LOT_KEYS' row, the place to half a metre (a
//       cask drifts, and a word said again for every centimetre of it would be a frame every FOES_MS), at most
//       NAVAL_WIRE_CASKS: every player sees them and any player's boat hauls one in, claimed of their owner (below).
//       They were the stander's alone: a peer who sank her saw none
//   k - AUDIT NAV2 F1/F3/F5: the captains, each [n, temper, mode, struckTo] for a ship of `s` by her number: her
//       temper by TEMPER_CODES' row (a raider's and a hand-launched pirate's bold is her stander's, never her seed's, so
//       a peer read her wary off the seed and was never warned), her captain's mode by MODE_CODES' row (her guns out -
//       her crew at battle - on every screen; a peer's copy sailed in 'cruise' through every fight), and the number of
//       the ship of this word she struck to (-1: none, or a player) - her prize's victor, kept through a handover
//   m - AUDIT NAV2 F2/F3: the owner's own boat beside `p` - [crew, battle, hull]: her hands by count and her hull by
//       HULL_NAMES' row, so every client sizes her as her owner does, to the man (the stander sized a peer's boat at a
//       full crew, the peer herself single-handed), and whether she fights (her crew at battle on every screen)
//   l - AUDIT BAY A18: the lanes' packets the owner has seen spent (sunk, struck, boarded, taken) - each her
//       voyage's seed (systems/naval/seaLanes.js), the last NAVAL_WIRE_SPENT - so no player stands her again where she
//       went down (a player who never saw her go stood her afresh, to every player's sight)
//   w - SALVAGE (2026-10-03): the wreckage a sunk ship leaves afloat in the owner's sea, each [id, x, y, z, cls] as a
//       cask of `f` (its lot navalPlunder.js SALVAGE_LOT, never one of LOT_KEYS) - hauled in and claimed as a cask is;
//       at most NAVAL_WIRE_CASKS. A key of its own as `k`, `m` and `l` are: an older build reads none of it, where a lot
//       past its LOT_KEYS would fail its door and the whole word with it
//   `k`, `m` and `l` are keys of their own because an older build's door checks every field of `s` and `p` by count: it
//   passes a word with them whole and reads none of them, and a newer door reads an older build's word as saying none.
//   Nor are theirs counted: a newer build's longer entry reads as its first fields, never the whole word refused.
// A word passes the door whole or not at all (`validNavalRecord`): a known class and variant, bounded places, a state
// the ship can be in, shares in 0..100, a side, a finite lay.
//
// A BLOW ON A SHIP goes to whoever stands it: the directed `hit` frame (`{ to, nv: { n, h, s, c, f, z } }` - the
// ship's number, its hull, sail and crew damage, a fire, the zone) that the relay routes by `to` alone, landed by
// the stander, who says the ship's new state in its next word. `validNavalHit` is its door: bounded damage, no more
// than one broadside's worth in one frame (NAVAL_HIT_MAX); its fire `f` 1 a ball's, 2 a barrel's (AUDIT NAV1: a
// barrel's burns longer and hotter). AUDIT NAV1 (online): the same frame with `g` 1 and no hurt is a GRAPPLE - my ship
// `n` alongside you, her grapnels thrown: the victim takes her over and fights her boarders on his own deck, if he lets
// pirates board him; else his word says he does not and she sheers off. And a ship boarded is no claim to her stander - her
// boarder takes her over at the grapple (one past her handover count, in the word) and the haul, the fight, the prize
// and her fate are the boarder's world; the four board claims (boarding, taken, scuttled, adrift) marked her in the
// stander's world while all of it happened in another's. AUDIT NAV1 (online #15): the frame with `k` and no hurt is a
// CASK's - `k` a cask of your sea my boat sailed through, and with `a` 1 your ANSWER, that it is mine: its owner answers
// the first claim and lets the cask go, the claimer draws its lot only on the answer, so one cask is one haul whoever
// else reached it.

import { POSE_BOUND, POSE_Y_BOUND } from '../../net/wire.js';
import { SHIP_CLASSES, CROWNS } from './navalShips.js';
import { LOT_KEYS, SALVAGE_LOT, isSalvage } from './navalPlunder.js';
import { NOTORIETY } from './navalLaw.js';
import { DENSITY_KEYS } from './navalDirector.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { HULL_NAMES, HULL_VARIANT_COUNTS } from '../comeSailAwayBoat.js';
import { TEMPERS } from './navalAI.js';

/** The radius within which players stand one sea between them (m): a ship's fighting reach and then some. */
export const NAVAL_SHARE_RADIUS = 1200;
export const NAVAL_WIRE_SHIPS = 8;
export const NAVAL_WIRE_VOLLEYS = 12;
export const NAVAL_WIRE_BARRELS = 8;
/** AUDIT NAV1 (online #15): the most casks one word says. */
export const NAVAL_WIRE_CASKS = 12;
/** AUDIT BAY A18: the most spent packets one word says (`l`). */
export const NAVAL_WIRE_SPENT = 8;
/** How long a volley stays in the word, so every receiver's frame catches it (ms). */
export const NAVAL_VOLLEY_KEEP_MS = 1500;
/** AUDIT NAV1 (online #15): the Ships at sea a word says nothing of - the Features row's own default (systems/features.js). */
export const TRAFFIC_DEFAULT = 'some';
/** One blow frame's ceiling on each damage (a whole broadside of heavy guns, holed, and some). */
export const NAVAL_HIT_MAX = 400;
/** The states on the wire, by code. */
export const WIRE_STATES = Object.freeze(['afloat', 'struck', 'sinking', 'sunk', 'prize', 'boarded']);
export const SIDE_CODES = Object.freeze(['starboard', 'port', 'bow', 'stern']);
/** AUDIT NAV1 (online): a ship's handover count's ceiling - taken over past it she stays at it (a tie is the ids'). */
export const NAVAL_GEN_MAX = 255;
/** AUDIT NAV2 F1: the tempers on the wire, by code (the `k` key's). */
export const TEMPER_CODES = Object.freeze(Object.values(TEMPERS));
/** AUDIT NAV2 F3: a captain's modes on the wire, by code (navalAI.js stepCaptain's; one not listed is said as 'cruise'). */
export const MODE_CODES = Object.freeze(['cruise', 'engage', 'board', 'flee', 'answer', 'struck', 'prize', 'boarded']);

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const inBounds = (p) => Math.abs(p[0]) <= POSE_BOUND && Math.abs(p[2]) <= POSE_BOUND && Math.abs(p[1]) <= POSE_Y_BOUND;
const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));
const U32 = 0xffffffff;

/**
 * My word: the ships I stand, the volleys and barrels of the last moments - in scene units, `toWire` taking a scene
 * point to the wire frame - and (AUDIT NAV1, online) my own boat at sea and my notoriety by crown. Null when there is
 * nothing to say (the reader drops mine).
 * @param {{ ships?: any[], volleys?: any[], barrels?: any[], me?: { hull: number, crippled: boolean, boarders: boolean, crew?: number, battle?: boolean, boatHull?: number } | null,
 *   law?: Record<string, number>, traffic?: string, casks?: { id: number, pos: number[], from: string, lot: string }[], spent?: number[] }} view
 */
export function navalWireRecord(view, toWire = (p) => p) {
  const s = [], v = [], b = [], k = [];
  for (const sh of view?.ships ?? []) {
    if (s.length >= NAVAL_WIRE_SHIPS) break;
    const cls = SHIP_CLASSES.findIndex((c) => c.id === sh.classId);
    if (cls < 0 || !Array.isArray(sh.pos) || !sh.pos.every(Number.isFinite)) continue;
    const p = toWire(sh.pos);
    s.push([sh.n | 0, cls, sh.variant | 0, r2(p[0]), r2(p[1]), r2(p[2]), r4(sh.yaw), r2(sh.speed), r2(sh.sails), pct(sh.hull), pct(sh.sail), pct(sh.crew),
      Math.max(0, WIRE_STATES.indexOf(sh.state)), Math.round(sh.heel * 10) / 10, sh.seed >>> 0, sh.fire ? 1 : 0, (sh.runOut | 0) & 15,
      Math.max(0, Math.min(NAVAL_GEN_MAX, sh.gen | 0)), Number.isInteger(sh.region) && sh.region >= 0 && sh.region < REGION_NAMES.length ? sh.region : -1]);
    // AUDIT NAV2 F1/F3/F5: her captain - a ship said without a temper (a caller's older view) is said without one
    const temper = TEMPER_CODES.indexOf(sh.temper);
    if (temper >= 0) k.push([sh.n | 0, temper, Math.max(0, MODE_CODES.indexOf(sh.mode)), Number.isInteger(sh.struckTo) && sh.struckTo >= 0 && sh.struckTo <= 0xffff ? sh.struckTo : -1]);
  }
  for (const vo of view?.volleys ?? []) {
    if (v.length >= NAVAL_WIRE_VOLLEYS) break;
    const side = SIDE_CODES.indexOf(vo.side);
    if (side < 0 || !Array.isArray(vo.pos)) continue;
    const p = toWire(vo.pos);
    v.push([vo.id >>> 0, vo.shooter | 0, vo.hull | 0, side, r2(p[0]), r2(p[1]), r2(p[2]), r4(vo.yaw), r2(vo.vel?.[0] ?? 0), r2(vo.vel?.[2] ?? 0), r4(vo.elevation), vo.seed >>> 0, r2(vo.skill ?? 0.5),
      Math.max(0, Math.min(NAVAL_VOLLEY_KEEP_MS, Math.round(vo.age ?? 0)))]);
  }
  for (const ba of view?.barrels ?? []) {
    if (b.length >= NAVAL_WIRE_BARRELS) break;
    const p = toWire(ba.pos);
    b.push([ba.id >>> 0, r2(p[0]), r2(p[1]), r2(p[2]), Number.isInteger(ba.shooter) && ba.shooter >= 0 && ba.shooter <= 0xffff ? ba.shooter : -1]);
  }
  const out = { s, v, b };
  const f = [], w = [];
  for (const c of view?.casks ?? []) {
    const salvage = isSalvage(c.lot);   // SALVAGE: the wreckage on `w`
    if ((salvage ? w : f).length >= NAVAL_WIRE_CASKS) continue;
    const cls = SHIP_CLASSES.findIndex((k) => k.id === c.from), lot = LOT_KEYS.indexOf(c.lot);
    if (cls < 0 || (!salvage && lot < 0) || !Array.isArray(c.pos)) continue;
    const p = toWire(c.pos.map((x) => Math.round(x * 2) / 2));
    if (salvage) w.push([c.id >>> 0, r2(p[0]), r2(p[1]), r2(p[2]), cls]);
    else f.push([c.id >>> 0, r2(p[0]), r2(p[1]), r2(p[2]), cls, lot]);
  }
  if (f.length) out.f = f;
  if (w.length) out.w = w;
  const me = view?.me;
  if (me) out.p = [pct(me.hull), me.crippled ? 1 : 0, me.boarders === false ? 0 : 1];
  if (k.length) out.k = k;
  if (me && int(me.crew, 0, 0xffff) && int(me.boatHull, 0, HULL_NAMES.length - 1)) out.m = [me.crew, me.battle ? 1 : 0, me.boatHull];   // AUDIT NAV2 F2/F3
  const law = [];
  for (const [i, c] of CROWNS.entries()) { const n = Math.round(view?.law?.[c.name] ?? 0); if (n > 0) law.push([i, Math.min(NOTORIETY.max, n)]); }
  if (law.length) out.n = law;
  const t = DENSITY_KEYS.indexOf(view?.traffic);
  if (t >= 0 && view?.traffic !== TRAFFIC_DEFAULT) out.t = t;
  const l = (view?.spent ?? []).filter((x) => int(x, 0, U32)).slice(-NAVAL_WIRE_SPENT);   // AUDIT BAY A18
  if (l.length) out.l = l;
  return s.length || v.length || b.length || out.p || out.n || out.t !== undefined || out.f || out.w || out.l ? out : null;
}

/** AUDIT NAV2 F1/F3/F5: the captains' key through the door - a Map from a ship's number to her temper, her captain's
 *  mode and the number she struck to; null when malformed (the word fails whole). */
function validCaptains(raw) {
  const out = new Map();
  if (raw === undefined) return out;
  if (!Array.isArray(raw) || raw.length > NAVAL_WIRE_SHIPS) return null;
  for (const w of raw) {
    if (!Array.isArray(w) || !int(w[0], 0, 0xffff) || !int(w[1], 0, TEMPER_CODES.length - 1) || !int(w[2], 0, MODE_CODES.length - 1) || !int(w[3], -1, 0xffff)) return null;
    out.set(w[0], { temper: TEMPER_CODES[w[1]], mode: MODE_CODES[w[2]], struckTo: w[3] });
  }
  return out;
}

/**
 * A peer's word through the door - whole or not at all.
 * @returns {{ ships: any[], volleys: any[], barrels: any[], me: { hull: number, crippled: boolean, boarders: boolean } | null,
 *   law: Record<string, number>, traffic: string, casks: { id: number, pos: number[], from: string, lot: string }[],
 *   captains: Map<number, { temper: string, mode: string, struckTo: number }>, boat: { crew: number, battle: boolean, hull: number } | null, spent: number[] } | null}
 */
export function validNavalRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw.s ?? [], v = raw.v ?? [], b = raw.b ?? [];
  if (!Array.isArray(s) || !Array.isArray(v) || !Array.isArray(b)) return null;
  if (s.length > NAVAL_WIRE_SHIPS || v.length > NAVAL_WIRE_VOLLEYS || b.length > NAVAL_WIRE_BARRELS) return null;
  const ships = [];
  for (const w of s) {
    if (!Array.isArray(w) || (w.length !== 16 && w.length !== 17 && w.length !== 19) || !w.every(Number.isFinite)) return null;
    if (!int(w[0], 0, 0xffff) || !int(w[1], 0, SHIP_CLASSES.length - 1)) return null;
    const cls = SHIP_CLASSES[w[1]];
    const variants = HULL_VARIANT_COUNTS[cls.hull] ?? 0;
    if (!int(w[2], 0, Math.max(0, variants - 1))) return null;
    const pos = [w[3], w[4], w[5]];
    if (!inBounds(pos) || Math.abs(w[6]) > 7 || w[7] < 0 || w[7] > 40 || w[8] < 0 || w[8] > 1) return null;
    if (!int(w[9], 0, 100) || !int(w[10], 0, 100) || !int(w[11], 0, 100) || !int(w[12], 0, WIRE_STATES.length - 1)) return null;
    if (Math.abs(w[13]) > 90 || !int(w[14], 0, U32) || (w[15] !== 0 && w[15] !== 1) || (w.length >= 17 && !int(w[16], 0, 15))) return null;
    if (w.length === 19 && (!int(w[17], 0, NAVAL_GEN_MAX) || !int(w[18], -1, REGION_NAMES.length - 1))) return null;
    ships.push({ n: w[0], classId: cls.id, hull: cls.hull, variant: w[2], pos, yaw: w[6], speed: w[7], sails: w[8], hull100: w[9], sail100: w[10], crew100: w[11], state: WIRE_STATES[w[12]], heel: w[13], seed: w[14], fire: w[15] === 1, runOut: w[16] ?? 0,
      gen: w[17] ?? 0, region: w[18] ?? -1 });
  }
  const volleys = [];
  for (const w of v) {
    if (!Array.isArray(w) || (w.length !== 13 && w.length !== 14) || !w.every(Number.isFinite)) return null;
    if (!int(w[0], 0, U32) || !int(w[1], -1, 0xffff) || !int(w[2], 0, HULL_NAMES.length - 1) || !int(w[3], 0, SIDE_CODES.length - 1)) return null;
    const pos = [w[4], w[5], w[6]];
    if (!inBounds(pos) || Math.abs(w[7]) > 7 || Math.abs(w[8]) > 40 || Math.abs(w[9]) > 40 || Math.abs(w[10]) > 1.6 || !int(w[11], 0, U32) || w[12] < 0 || w[12] > 1) return null;
    if (w.length === 14 && !int(w[13], 0, NAVAL_VOLLEY_KEEP_MS)) return null;
    volleys.push({ id: w[0], shooter: w[1], hull: w[2], side: SIDE_CODES[w[3]], pos, yaw: w[7], vel: [w[8], 0, w[9]], elevation: w[10], seed: w[11], skill: w[12], age: w[13] ?? 0 });
  }
  const barrels = [];
  for (const w of b) {
    if (!Array.isArray(w) || (w.length !== 4 && w.length !== 5) || !w.every(Number.isFinite) || !int(w[0], 0, U32)) return null;
    const pos = [w[1], w[2], w[3]];
    if (!inBounds(pos) || (w.length === 5 && !int(w[4], -1, 0xffff))) return null;
    barrels.push({ id: w[0], pos, shooter: w[4] ?? -1 });
  }
  let me = null;
  if (raw.p !== undefined) {
    const p = raw.p;
    if (!Array.isArray(p) || p.length !== 3 || !int(p[0], 0, 100) || !int(p[1], 0, 1) || !int(p[2], 0, 1)) return null;
    me = { hull: p[0] / 100, crippled: p[1] === 1, boarders: p[2] === 1 };
  }
  const law = {};
  if (raw.n !== undefined) {
    if (!Array.isArray(raw.n) || raw.n.length > CROWNS.length) return null;
    for (const w of raw.n) {
      if (!Array.isArray(w) || w.length !== 2 || !int(w[0], 0, CROWNS.length - 1) || !int(w[1], 0, NOTORIETY.max)) return null;
      law[CROWNS[w[0]].name] = w[1];
    }
  }
  if (raw.t !== undefined && !int(raw.t, 0, DENSITY_KEYS.length - 1)) return null;
  const casks = [];
  if (raw.f !== undefined) {
    if (!Array.isArray(raw.f) || raw.f.length > NAVAL_WIRE_CASKS) return null;
    for (const w of raw.f) {
      if (!Array.isArray(w) || w.length !== 6 || !w.every(Number.isFinite) || !int(w[0], 0, U32)) return null;
      const pos = [w[1], w[2], w[3]];
      if (!inBounds(pos) || !int(w[4], 0, SHIP_CLASSES.length - 1) || !int(w[5], 0, LOT_KEYS.length - 1)) return null;
      casks.push({ id: w[0], pos, from: SHIP_CLASSES[w[4]].id, lot: LOT_KEYS[w[5]] });
    }
  }
  if (raw.w !== undefined) {   // SALVAGE: the wreckage - casks to the reader, its lot the salvage's
    if (!Array.isArray(raw.w) || raw.w.length > NAVAL_WIRE_CASKS) return null;
    for (const w of raw.w) {
      if (!Array.isArray(w) || w.length !== 5 || !w.every(Number.isFinite) || !int(w[0], 0, U32)) return null;
      const pos = [w[1], w[2], w[3]];
      if (!inBounds(pos) || !int(w[4], 0, SHIP_CLASSES.length - 1)) return null;
      casks.push({ id: w[0], pos, from: SHIP_CLASSES[w[4]].id, lot: SALVAGE_LOT });
    }
  }
  // AUDIT NAV2 F1-F3/F5: the captains and the owner's boat - an older build's word says neither
  const captains = validCaptains(raw.k);
  if (!captains) return null;
  let boat = null;
  if (raw.m !== undefined) {
    if (!Array.isArray(raw.m) || !int(raw.m[0], 0, 0xffff) || !int(raw.m[1], 0, 1) || !int(raw.m[2], 0, HULL_NAMES.length - 1)) return null;
    boat = { crew: raw.m[0], battle: raw.m[1] === 1, hull: raw.m[2] };
  }
  // AUDIT BAY A18: the spent packets - an older build's word says none
  const spent = raw.l ?? [];
  if (!Array.isArray(spent) || spent.length > NAVAL_WIRE_SPENT || !spent.every((x) => int(x, 0, U32))) return null;
  return { ships, volleys, barrels, me, law, traffic: raw.t === undefined ? TRAFFIC_DEFAULT : DENSITY_KEYS[raw.t], casks, captains, boat, spent: [...spent] };
}

/** A change key: the word rides a delta frame only when it moved (the full frame always carries it). */
export const navalRecordKey = (rec) => (rec ? JSON.stringify(rec) : '');

/**
 * The blow's `nv`, as its striker sends it - `fire` true (a ball's), 'barrel' or false; `grapple` (AUDIT NAV1, online)
 * a grapple of my ship `n` on the player it goes to, no hurt; `cask` (AUDIT NAV1, online #15) a cask of theirs my boat
 * sailed through, no hurt - and with `answer`, their word that it is mine.
 * @param {string} to
 * @param {{ n: number, hull?: number, sail?: number, crew?: number, fire?: boolean | 'barrel', zone?: string, grapple?: boolean,
 *   cask?: number | null, answer?: boolean }} blow
 */
export function navalHitData(to, { n, hull = 0, sail = 0, crew = 0, fire = false, zone = 'hull', grapple = false, cask = null, answer = false }) {
  const nv = { n: n | 0, h: Math.round(hull), s: Math.round(sail), c: crew | 0, f: fire === 'barrel' ? 2 : fire ? 1 : 0, z: zone === 'rig' ? 1 : zone === 'holed' ? 2 : 0 };
  if (grapple) nv.g = 1;
  if (cask != null) { nv.k = cask >>> 0; if (answer) nv.a = 1; }
  return { to, nv };
}

/**
 * A blow on a ship I stand, through the door: bounded numbers, a known zone - or a grapple (`g` 1, no hurt), or a cask's
 * claim (`k`, no hurt) or its answer (`k` with `a` 1). Null for anything else.
 * @returns {{ n: number, hull: number, sail: number, crew: number, fire: boolean | 'barrel', zone: string, grapple: boolean,
 *   cask: number | null, answer: boolean } | null}
 */
export function validNavalHit(data) {
  const nv = data?.nv;
  if (!nv || typeof nv !== 'object' || Array.isArray(nv)) return null;
  if (!int(nv.n, 0, 0xffff) || !int(nv.h, 0, NAVAL_HIT_MAX) || !int(nv.s, 0, NAVAL_HIT_MAX) || !int(nv.c, 0, 60)) return null;
  if (!int(nv.f, 0, 2) || !int(nv.z, 0, 2)) return null;
  if (nv.g !== undefined && (nv.g !== 1 || nv.h || nv.s || nv.c || nv.f)) return null;   // a grapple carries no hurt
  if (nv.k !== undefined && (!int(nv.k, 0, U32) || nv.g !== undefined || nv.h || nv.s || nv.c || nv.f)) return null;   // nor a cask's word
  if (nv.a !== undefined && (nv.a !== 1 || nv.k === undefined)) return null;   // an answer is a cask's
  return {
    n: nv.n, hull: nv.h, sail: nv.s, crew: nv.c, fire: nv.f === 2 ? 'barrel' : nv.f === 1, zone: ['hull', 'rig', 'holed'][nv.z], grapple: nv.g === 1,
    cask: nv.k ?? null, answer: nv.a === 1,
  };
}
