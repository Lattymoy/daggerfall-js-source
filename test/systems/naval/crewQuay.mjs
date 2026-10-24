// CREW-TRADE's quay (bible/03-World/Captains-Sea.md CREW-TRADE): ship 42 of the player's lying to a port's quay at her
// helm over the REAL sea fight (test/navalSea.mjs), the shipwright's window's model the host hands the world
// (navalHost.js openYard -> deps.openYard), the harbour office the world's - shared by crewtrade.test.js and
// auditcrewtrade.test.js (AUDIT CREW-TRADE).
import '../../modsOff.js';
import { sea } from '../../navalSea.mjs';
import { crewStandOf } from '../../../src/systems/naval/tradeGoods.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { firstBuildOf } from '../../../src/systems/naval/navalShips.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { _resetFleetForTests } from '../../../src/systems/fleet.js';

/** Bay ports on a grid of map pixels, keyed as the world host keys them (world.js navalPortList: `"px,py"`). */
export const BAY = Array.from({ length: 360 }, (_, i) => { const px = 40 + (i % 30) * 31, py = 30 + Math.floor(i / 30) * 23; return { key: `${px},${py}`, name: `Port ${i}`, px, py, region: 17, crown: ['Daggerfall', 'Wayrest', 'Sentinel'][i % 3] }; });
export const ISLE = Object.freeze({ key: '700,40', name: 'Veilhaven', px: 700, py: 40, region: 61, crown: null, ether: true });
/** The first of the Bay's ports that stands so to sailors. */
export const portStanding = (stand) => BAY.find((p) => crewStandOf(p) === stand);

/** A naval save of one boat of the player's (number 42) at `crew` - `state` and `fire` her own (a wreck, a fire burning). */
export const saveOf = (hull, crew, { state = SHIP_STATES.afloat, fire = 0 } = {}) => {
  const f = firstBuildOf(hull);
  return { v: 1, boats: { 42: { hull: f.hullHp, sail: f.sailHp, maxHull: f.hullHp, maxSail: f.sailHp, crew, fire, state, credit: 0, barrels: 0 } } };
};
/** The exchange over the real sea fight at `port` on `day`: `rank` the crown's highest regard, `edge` the captain's
 *  stars' trade (captainLedger.js stats), `town` the port town's economy (scenes/townEconHost.js's door - `exchangeAt`,
 *  `seaDeal` counted in `towned`). */
export async function quay(hull, crew, { port = portStanding('makes'), gold = 100000, day = 7, rank = 0, edge = null, town = null, state, fire } = {}) {
  _resetFleetForTests();
  const s = await sea({ hull, save: saveOf(hull, crew, { state, fire }) });
  const models = [];
  s.deps.openYard = (m) => { models.push(m); return true; };
  s.host.openYard(s.boat, { quay: true });
  const ledger = createCaptainLedger();
  if (rank) ledger.regard(port.crown, 10000);
  if (edge != null) { const stats = ledger.stats; ledger.stats = () => ({ ...stats(), trade: edge }); }
  const purse = { gold };
  const towned = { deals: 0 };
  const office = createHarbourOffice({
    ledger, now: () => 0, day: () => day, level: () => 10, gold: () => purse.gold, pay: (n) => { purse.gold -= n; }, credit: (n) => { purse.gold += n; },
    say: () => {}, mid: () => {}, notorietyOf: () => 0, port: () => port, ports: () => [port], seaAt: () => true, waters: () => port.crown, stow: (hold, item) => hold.push(item),
    ...(town ? { town: { exchangeAt: () => town, seaDeal: () => { towned.deals++; } } } : {}),
  });
  const st = s.host._myState(s.boat);
  return { s, model: models[0], office, purse, ledger, st, port, day, towned, x: () => office.exchange(models[0]) };
}
