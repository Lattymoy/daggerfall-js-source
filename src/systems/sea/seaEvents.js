// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-EVENTS (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
// Ocean's events on the shared clock; bible/03-World/Eltheric-Ocean.md SEA-EVENTS) - THE SEA'S CLOCK OF EVENTS: where the
// Aether Storm blows and where the treasure fleet sails, at a moment of the relay's clock (online every client's alike;
// offline this machine's own).
//
// THE AETHER STORM: one each STORM_PERIOD_MS, blowing the first STORM_LIFE_MS of it - its eye born at a point its number's
// hash draws in the deep waters (the Deep Aether and the Abyss's first STORM_ABYSS_LEAGUES, HAUNT_SPREAD.deep rows either
// side of Veilhaven's - and far enough west that its drift and its reach stay out of the Reaches: AUDIT SEA VENTURES D11),
// drifting STORM_DRIFT_PX over its life on a heading of its own, STORM_R_PX about the eye. Inside it:
// a thunderstorm (the shown weather), lightning that finds a ship, and its WRACK - a cask alongside each STORM_WRACK_MS.
//
// THE TREASURE FLEET: one each SEA_FLEET_PERIOD_MS (net/wire.js - the hub keeps its flagship's sinking), under way
// FLEET_SAIL_MS from FLEET_OFFSET_MS into it: a merchant carrack and her corsair escorts (FLEET_ESCORTS), mustered at a
// point of the Deep Aether or the Abyss its number draws and bound east for the Veil at FLEET_MPS. Her name, her band,
// her ships' seeds and classes are the sailing's own.
//
// Pure: the clock in, the storm and the fleet out; no map files.
// ═══════════════════════════════════════════════════════════════════
import { BANDS, VEIL_X, LEAGUE_PX, LEAGUE_M, veilhaven, etherHash, etherRng, etherBandAt, ETHER_GOODS } from '../../world/ethericSea.js';
import { HAUNT_SPREAD, etherShipNames } from '../naval/etherShips.js';
import { classById } from '../naval/navalShips.js';
import { SEA_FLEET_PERIOD_MS, seaFleetSailing } from '../../net/wire.js';
import { SHIP_STATES } from '../naval/navalDamage.js';

/** The metres a pixel of the map spans (a league's metres over its pixels). */
export const PX_M = LEAGUE_M / LEAGUE_PX;
const band = (id) => BANDS.find((b) => b.id === id);
/** Deep waters' columns, `[x0, x1]` in pixels: `from` leagues past the Veil to `to`. */
const columns = (from, to) => [VEIL_X - to * LEAGUE_PX, VEIL_X - from * LEAGUE_PX];
const lerp = (a, b, k) => a + (b - a) * k;

// ── THE AETHER STORM ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A storm each two hours of the shared clock... */
export const STORM_PERIOD_MS = 2 * 3_600_000;
/** ...blowing the first fifty minutes of them. */
export const STORM_LIFE_MS = 50 * 60_000;
/** Its reach about its eye (pixels - some 33 km). */
export const STORM_R_PX = 40;
/** How far its eye drifts over its life (pixels). */
export const STORM_DRIFT_PX = 60;
/** Its eye is born in the Deep Aether or within this many leagues past the Abyss's edge. */
export const STORM_ABYSS_LEAGUES = 60;
/** The storms' hash's own salt. */
export const STORM_SALT = 0x570a;
/** A cask of wrack alongside each this long inside it (ms). */
export const STORM_WRACK_MS = 90_000;
/** The share of a lightning strike that finds the ship a captain sails inside it... */
export const STORM_STRIKE_CHANCE = 0.25;
/** ...and what it takes of her: her hull's share, her canvas's share, and the chance it sets her alight. */
export const STORM_STRIKE = Object.freeze({ hull: 0.04, sail: 0.08, fire: 0.2 });

/** @typedef {{ n: number, start: number, end: number, x0: number, y0: number, x1: number, y1: number, r: number }} SeaStorm */

/** Storm `n`: its life on the clock and its eye's drift, `{ n, start, end, x0, y0, x1, y1, r }` (pixels). */
export function stormOf(n) {
  const k = Math.trunc(Number(n)) || 0;
  const r = etherRng(etherHash(STORM_SALT, k));
  const [cx0, cx1] = columns(band('deep').from, band('abyss').from + STORM_ABYSS_LEAGUES);
  const row = veilhaven().py, spread = HAUNT_SPREAD.deep;
  // AUDIT SEA VENTURES D11: born far enough west that its drift and its reach never cross into the Reaches - one in fourteen
  // touched them, and its wrack there, the Reaches' share, never gave a piece of the Tidemail
  const x0 = lerp(cx0, cx1 - STORM_DRIFT_PX - STORM_R_PX, r()), y0 = lerp(row - spread, row + spread, r()), a = r() * Math.PI * 2;
  return { n: k, start: k * STORM_PERIOD_MS, end: k * STORM_PERIOD_MS + STORM_LIFE_MS, x0, y0, x1: x0 + Math.cos(a) * STORM_DRIFT_PX, y1: y0 + Math.sin(a) * STORM_DRIFT_PX, r: STORM_R_PX };
}
/** The storm blowing at `nowMs`, or null (between storms). */
export function stormAt(nowMs) {
  if (!Number.isFinite(nowMs)) return null;
  const s = stormOf(Math.floor(nowMs / STORM_PERIOD_MS));
  return nowMs >= s.start && nowMs < s.end ? s : null;
}
/** The next storm to blow after `nowMs` (the one blowing now's successor while one blows). */
export const nextStorm = (nowMs) => stormOf(Math.floor(nowMs / STORM_PERIOD_MS) + 1);
/** Storm `s`'s eye at `nowMs`, `{ x, y }` - where it was born before it blows, where it died after. */
export function stormEye(s, nowMs) {
  const k = Math.max(0, Math.min(1, (nowMs - s.start) / STORM_LIFE_MS));
  return { x: lerp(s.x0, s.x1, k), y: lerp(s.y0, s.y1, k) };
}
/** The storm blowing over pixel (x, y) at `nowMs` - within its reach of its eye (the deep waters', so the sea's always:
 *  its eye is born STORM_R_PX and more inside the sea's box) - or null. */
export function stormHere(x, y, nowMs) {
  const s = stormAt(nowMs);
  if (!s || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const e = stormEye(s, nowMs);
  return Math.hypot(x - e.x, y - e.y) <= s.r ? s : null;
}
/** The wrack's slot of storm `s` at `nowMs` - a new cask each STORM_WRACK_MS of its life. */
export const stormWrackSlot = (s, nowMs) => Math.max(0, Math.floor((nowMs - s.start) / STORM_WRACK_MS));
/** A cask of storm `n`'s wrack, slot `slot`, hauled where the band is `bandId`: one of the sea's goods its own hash
 *  draws, `n` of it by the band (`yields` - the strands' own, the Shallows' first), `{ good, n, rolls }` - `rolls` the
 *  cask's own stream for whatever more it holds. */
export function wrackOf(n, slot, bandId, yields) {
  const r = etherRng(etherHash(STORM_SALT, n, slot, 0x77));
  const good = ETHER_GOODS[Math.floor(r() * ETHER_GOODS.length) % ETHER_GOODS.length];
  const i = Math.max(0, BANDS.findIndex((b) => b.id === bandId));
  return { good, n: yields[i] ?? yields[0], rolls: r };
}
/** A lightning strike's lot on the ship: whether it finds her, and what it takes - `{ hull, sail, fire }` (shares of
 *  her own), or null. `r` a stream (Math.random). */
export function stormStrikeOf(r = Math.random) {
  if (!(r() < STORM_STRIKE_CHANCE)) return null;
  return { hull: STORM_STRIKE.hull, sail: STORM_STRIKE.sail, fire: r() < STORM_STRIKE.fire };
}
/** A strike's hurt on a ship's damage (systems/naval/navalDamage.js createShipDamage): its shares of her hull and canvas,
 *  whole points, at least one of each she has; a gun's fire where it set her alight. */
export const stormHurt = (damage, strike) => ({
  hull: Math.max(1, Math.round(damage.maxHull * strike.hull)), sail: damage.maxSail > 0 ? Math.max(1, Math.round(damage.maxSail * strike.sail)) : 0, crew: 0, fire: !!strike.fire,
});
/** A strike laid on a ship afloat (her damage, at `now` s): hurt by stormHurt, never under her last timber by it alone.
 *  Answers whether it struck her. */
export function strikeShip(damage, strike, now) {
  if (!damage || !strike || damage.state !== SHIP_STATES.afloat) return false;
  damage.apply(stormHurt(damage, strike), now, { floor: 1 });
  return true;
}

// ── THE TREASURE FLEET ───────────────────────────────────────────────────────────────────────────────────────────────
/** A sailing weighs anchor an hour into its three... */
export const FLEET_OFFSET_MS = 60 * 60_000;
/** ...and is under way ninety minutes. */
export const FLEET_SAIL_MS = 90 * 60_000;
/** Its way on the clock (metres a second - a laden convoy's). */
export const FLEET_MPS = 5;
/** It musters in the Abyss within this many leagues of its edge. */
export const FLEET_ABYSS_LEAGUES = 80;
/** The fleets' hash's own salt. */
export const FLEET_SALT = 0xf1ee;
/** Her flagship's class: a merchant carrack, laden. */
export const FLEET_FLAGSHIP = 'merchantCarrack';
/** Her escorts by her band: the corsairs she hired. */
export const FLEET_ESCORTS = Object.freeze({ deep: Object.freeze(['pirateBrig', 'pirateGalley']), abyss: Object.freeze(['pirateFlagship', 'pirateGalley', 'pirateBrig']) });
/** Her flagship's purse, by her band (gold). */
export const FLEET_PURSE = Object.freeze({ deep: 6000, abyss: 12000 });
/** Each ship's station from the flagship's place (metres: abeam, astern) - the flagship's own first. */
export const FLEET_STATIONS = Object.freeze([[0, 0], [-260, 180], [260, 180], [0, 420]]);

/** @typedef {{ seed: number, classId: string, flag: boolean, station: readonly number[] }} FleetShip */
/** @typedef {{ n: number, start: number, end: number, band: string, from: { x: number, y: number }, to: { x: number, y: number }, name: string, purse: number, ships: FleetShip[] }} SeaFleet */

/** Sailing `n`'s fleet: its time under way, its band, its route (`from` east to `to`, pixels), its flagship's name and
 *  purse, and its ships - the flagship first, each its seed, class and station. */
export function fleetOf(n) {
  const k = Math.trunc(Number(n)) || 0;
  const r = etherRng(etherHash(FLEET_SALT, k));
  const id = r() < 0.5 ? 'deep' : 'abyss';
  const [x0, x1] = id === 'deep' ? columns(band('deep').from, band('abyss').from) : columns(band('abyss').from, band('abyss').from + FLEET_ABYSS_LEAGUES);
  const row = veilhaven().py, spread = HAUNT_SPREAD.deep;
  const from = { x: lerp(x0, x1, r()), y: lerp(row - spread, row + spread, r()) };
  const a = (r() - 0.5) * 0.6, len = (FLEET_MPS * FLEET_SAIL_MS) / 1000 / PX_M;   // bound east, give or take
  const to = { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
  const seedOf = (i) => etherHash(FLEET_SALT, k, i, 0x5eed) >>> 0;
  const ships = [FLEET_FLAGSHIP, ...FLEET_ESCORTS[id]].map((classId, i) => ({ seed: seedOf(i), classId, flag: i === 0, station: FLEET_STATIONS[i] }));
  const start = k * SEA_FLEET_PERIOD_MS + FLEET_OFFSET_MS;
  return { n: k, start, end: start + FLEET_SAIL_MS, band: id, from, to, name: etherShipNames(classById(FLEET_FLAGSHIP), ships[0].seed).name, purse: FLEET_PURSE[id], ships };
}
/** The fleet under way at `nowMs`, or null (in port between sailings). */
export function fleetAt(nowMs) {
  if (!Number.isFinite(nowMs)) return null;
  const f = fleetOf(seaFleetSailing(nowMs));
  return nowMs >= f.start && nowMs < f.end ? f : null;
}
/** The next fleet to weigh anchor after `nowMs` (this sailing's while it still lies in port). */
export function nextFleet(nowMs) {
  const f = fleetOf(seaFleetSailing(nowMs));
  return nowMs < f.start ? f : fleetOf(f.n + 1);
}
/** Fleet `f`'s flagship's place at `nowMs`, `{ x, y, yaw }` (pixels; `yaw` her heading, the map's north 0, east pi/2). */
export function fleetPlace(f, nowMs) {
  const k = Math.max(0, Math.min(1, (nowMs - f.start) / FLEET_SAIL_MS));
  return { x: lerp(f.from.x, f.to.x, k), y: lerp(f.from.y, f.to.y, k), yaw: Math.atan2(f.to.x - f.from.x, -(f.to.y - f.from.y)) };
}
/** The band the fleet sails at its place (it may cross from the Abyss into the Deep Aether). */
export const fleetBandAt = (f, nowMs) => etherBandAt(fleetPlace(f, nowMs).x).id;
