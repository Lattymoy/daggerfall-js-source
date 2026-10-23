// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-EVENTS (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SEA-EVENTS) - THE TREASURE FLEET AT SEA: the sailing's ships (systems/sea/seaEvents.js fleetOf - where
// the shared clock puts each, the world host's feed) stood in the naval host's sea, steered along their route, let go out
// of reach, and the flagship's spoils paid. HOST-SPLIT: the naval host constructs it once and asks it (raiders()' and
// liners()' shape, out of createNavalHost).
//
// THE SHIPS: within FLEET_STAND_M of the captain her ships are stood - on water deep enough for each hull, never one
// already in the sea (mine, or a peer's copy: known by her seed), never one spent (sunk, struck or taken this sailing),
// and only by the captain the sea's traffic is stood by (navalHost.js launchesTraffic - two captains near each other see
// one fleet). Each steers her station on the route (`ahead`) while she cruises; one fighting fights. Past FLEET_DROP_M
// she sails on and fades (SHIP-FADE) unless she fights. A sailing whose flagship is down (`sunk` - mine, or the hub's
// word) stands no ship.
//
// THE SPOILS (`ended`, the naval host's chargeEther): the flagship sunk or taken by my hand - her purse and the hub's word
// the world's (`fleetEnded` - AUDIT SEA VENTURES D2: once a sailing, the captain's ledger's), and with her purse alone a piece
// of the Eltheric Tidemail (systems/aetheric.js ELTHERIC_CHANCE.fleet: every time) on the SAILING's band (AUDIT SEA VENTURES
// D9: a copy of her stood in shallower waters rolled their share), into the boat I sail.
//
// deps = {
//   sea: Map               the naval host's ships (navalHost.js `sea`)
//   launch(spec) -> entry  stand a ship (navalHost.js launch)
//   retire(entry)          let one go (SHIP-FADE)
//   busy(entry) -> bool    she fights, flees, boards or goes down (navalHost.js raiderBusy)
//   feet() -> [x, y, z]    the captain's feet in the scene
//   isWater(x, z, hull)    water deep enough for a hull here (AUDIT SEA VENTURES D10: each ship's own)
//   seaY() -> number       the sea's plane
//   launches() -> bool     I stand the sea's traffic about me (navalHost.js launchesTraffic)
//   give(items)            items into the boat I sail, never let go for a full pack
//   say(text, s)           a line on the screen
//   fleetEnded(n, act)     the world's: her purse paid once a sailing, the hub told - answers the purse (scenes/seaVenturesHost.js fleetEnded)
// }
// ═══════════════════════════════════════════════════════════════════
import { SHIP_STATES } from '../../systems/naval/navalDamage.js';
import { classById } from '../../systems/naval/navalShips.js';
import { fleetOf } from '../../systems/sea/seaEvents.js';
import { rollElthericPiece, elthericChance, TIDEMAIL_SALT } from '../../systems/aetheric.js';
import { setById } from '../../systems/sigil/sigilSets.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { t } from '../../systems/textManager.js';

/** A fleet's ship within this of the captain is stood (m - the lanes' packets'). */
export const FLEET_STAND_M = 1200;
/** Past this she is let go (m). */
export const FLEET_DROP_M = 1700;

const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** @param {any} deps */
export function createTreasureFleet(deps) {
  /** The seeds of this sailing's ships spent - sunk, struck or taken - never stood again; cleared with a new sailing. */
  const spent = new Set();
  let sailing = null;
  /** Her tag: the sailing, her seed and whether she is its flagship. */
  const tagOf = (list, seed) => { const s = list?.ships.find((x) => x.seed === (seed >>> 0)); return s ? { n: list.n, seed: s.seed, flag: s.flag } : null; };
  /**
   * THE FLEET'S STEP: `list` the sailing under way about the captain - `{ n, band, ships: [{ seed, classId, flag, pos, yaw,
   * ahead }] }` in the scene - or null in port; `sunk` its flagship is down.
   */
  function step(list, { sunk = false } = {}) {
    if (list?.n !== sailing) { sailing = list?.n ?? null; spent.clear(); }
    const me = deps.feet();
    for (const e of deps.sea.values()) {
      e.fleet ??= tagOf(list, e.ship.seed);   // a peer's copy too: she is the sailing's by her seed
      if (e.fleet && e.ship.damage.state !== SHIP_STATES.afloat) spent.add(e.fleet.seed);
    }
    // mine let go past FLEET_DROP_M - she sails on and fades - unless she fights
    for (const e of deps.sea.values()) {
      if (e.owner || !e.fleet) continue;
      if (dist2d(e.ship.pos, me) <= FLEET_DROP_M) { e.retiring = false; continue; }
      if (!deps.busy(e) && !e.retiring) deps.retire(e);
    }
    if (list && !sunk && deps.launches()) {
      for (const s of list.ships) {
        if (spent.has(s.seed) || dist2d(s.pos, me) > FLEET_STAND_M) continue;
        if ([...deps.sea.values()].some((x) => x.ship.seed === s.seed && x.ship.damage.state !== SHIP_STATES.sunk)) continue;
        if (!deps.isWater(s.pos[0], s.pos[2], classById(s.classId)?.hull ?? 0)) continue;   // AUDIT SEA VENTURES D10: deep enough for her own hull
        const e = deps.launch({ seed: s.seed, classId: s.classId, pos: [s.pos[0], deps.seaY(), s.pos[2]], yaw: s.yaw, ether: list.band });
        if (e) e.fleet = { n: list.n, seed: s.seed, flag: s.flag };
      }
    }
    // each of mine steers her station on the route while she cruises (a ship fighting reads none)
    for (const e of deps.sea.values()) {
      if (e.owner || !e.fleet) continue;
      const s = list?.ships.find((x) => x.seed === e.fleet.seed);
      e.ship.course = s ? [s.ahead[0], s.ahead[2]] : null;
    }
  }
  /** THE FLAGSHIP'S SPOILS: sunk or taken by my hand (the naval host's chargeEther, once) - her purse and the hub's word
   *  the world's (once a sailing), and with her purse a piece of the Tidemail on the sailing's band's share off her seed's
   *  own stream, said. Answers the piece, or null. */
  function ended(entry, act) {
    if (!entry?.fleet?.flag || (act !== 'sink' && act !== 'board')) return null;
    spent.add(entry.fleet.seed);
    if (!(Number(deps.fleetEnded(entry.fleet.n, act)) > 0)) return null;   // AUDIT SEA VENTURES D2: no purse, no piece
    const band = fleetOf(entry.fleet.n)?.band ?? entry.ether ?? 'deep';   // D9: the sailing's own band
    const piece = rollElthericPiece(mulberry32(((entry.fleet.seed >>> 0) ^ TIDEMAIL_SALT) >>> 0), elthericChance('fleet', band));
    if (piece) {
      deps.give([piece]);
      deps.say(t('sea.tidemail.fleet', 'From the treasure fleet\'s flagship {ship}: {piece}, a piece of {set}!', { ship: entry.ship.names?.name ?? '', piece: piece.name, set: setById('eltheric')?.name ?? '' }), 6);
    }
    return piece;
  }
  return { step, ended, spent: () => new Set(spent) };
}
