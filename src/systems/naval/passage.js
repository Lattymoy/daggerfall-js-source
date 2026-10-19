// @ts-check
// PASSAGE (2026-10-19, the owner: "Add the ability to buy and ride a friendly boat (if one is docked) at any port. You
// can have the ability to choose where you want to sail. A new form of immersive travel") - PASSAGE UNDER SAIL, its
// law. Design: bible/03-World/Passage.md.
//
// A port's own friendly ships lie at its quays (scenes/naval/navalHost.js harbourFrame: a harbour's merchantmen and its
// crown's ships, moored at their berths). Walk up to one and Activate: her master names the ports he will sail for -
// every port the player knows, nearest first, each with its fare - and a port chosen and paid for, the voyage is SAILED,
// never jumped: the ship booked becomes the boat the player rides (navalHost.js charter - Come Sail Away's boat of her
// own hull at her own berth, her hands aboard), and the Overworld's crossing sails her there (OWS2, world.js
// travelViewRouteTo: the journey's hand on her helm, the land legs walked on from the landfall). Step off her - ashore at
// the far port, over the side, a door, a jump - and the passage is over: she stands out to sea, and what was put in her
// hold comes ashore (scenes/naval/passageHost.js).
//
// PURE: the ports, the pixels and the purse in; the voyages, the fares and the words out.
//
// Not a DFU member: Daggerfall's ship passage is a fast travel (DaggerfallTravelPopUp's "By ship"), priced by
// TravelTimeCalculator.CalculateTripCost - and this passage is priced by it too (passageFare). Ledger A (PASSAGE).
import { HULL } from './navalShips.js';
import { calculateTripCost } from '../travel/travel.js';
import { sceneCompassWord } from '../compassWords.js';
import { VOYAGE_LANDFALL_PX } from '../travel/travelRoute.js';   // AUDIT PASSAGE A1: a port within its landfall's reach is no voyage
import { t } from '../textManager.js';   // L10N4: every word of the passage in the player's language

/** The hulls a passenger is carried in: a sail to cross a sea (OWS2's law, world.js tvSeaCrosses) - never the Rowboat,
 *  whose lone rower tires a kilometre out; never the Large Galley, which never moors (shipLife.js BERTH_HULLS). */
export const PASSAGE_HULLS = Object.freeze([HULL.LargeBoat, HULL.SmallShip, HULL.Carrack]);
/** Off her this far (m), and not aboard: the passage is over. Past a gangway's reach - a step onto the quay to look
 *  back at her is not leaving her. */
export const PASSAGE_LEAVE_M = 20;
/** AUDIT PASSAGE B6: the look's ray books her only where it strikes her hull this near the eye (m) - she lies alongside
 *  the quay, a gangway's gap off its face; a wider reach took the press meant for the quay's people, nodes and wagons. */
export const PASSAGE_RAY_M = 8;
/** AUDIT PASSAGE A2: off her that far past her hull's own reach (passageHost.js hullReach), for this long (s) together. */
export const PASSAGE_OFF_S = 1.5;
/** Aboard her with no voyage under way (a fight stopped it, a load put me back at her helm): her master sails on after
 *  this long (s) - after PASSAGE_FIRST_S the first time a host meets her boat (a load, a boot), PASSAGE_RESUME_S after
 *  that. A try is spent only when the voyage is asked (a foe near spends none); PASSAGE_RESUMES that find no way in a
 *  row and he says so, and tries on every PASSAGE_SLOW times as long - AUDIT PASSAGE B3: he never gives her up while a
 *  passenger stands aboard, or a fare of 25 gold kept a crewed ship with her guns for good. */
export const PASSAGE_RESUME_S = 20;
export const PASSAGE_FIRST_S = 2;
export const PASSAGE_RESUMES = 3;
export const PASSAGE_SLOW = 3;

/** A voyage's length in map pixels: the longest axis, as Daggerfall's own travel walk counts its steps
 *  (travel.js calculateTravelTime's walkTravelPath). */
export const passagePixels = (from, to) => Math.max(Math.abs((to.x | 0) - (from.x | 0)), Math.abs((to.y | 0) - (from.y | 0)));

/** THE FARE: Daggerfall's ship (CalculateTripCost's travelShip arm, travel.js calculateTripCost: 25 gold for every 24
 *  ocean pixels and 25 more), with every pixel of the voyage counted as sea - she sails the whole way, where the map's
 *  passage pays for the ocean its straight line crosses. No inn is paid: a passenger sleeps aboard. */
export const passageFare = (from, to) => calculateTripCost(0, Math.max(1, passagePixels(from, to)), { travelShip: true }).totalCost;

/** Which way a port lies, in the eight winds (systems/compassWords.js, the one home of the eight ways): map pixels, y
 *  running south - turned into the scene's frame (+z north). '' for the same pixel. */
export function passageWind(from, to) {
  const dx = (to.x | 0) - (from.x | 0), dn = (from.y | 0) - (to.y | 0);
  return dx || dn ? sceneCompassWord(dx, dn) : '';
}

/**
 * THE PORTS HER MASTER SAILS FOR, from `here` (the player's map pixel): every port of `ports` ({ key, name, px, py }) the
 * player knows (`known(port)` - the travel map's own law: a place never discovered has no name to sail for), never the
 * port I stand at (`hereKey`) nor one within VOYAGE_LANDFALL_PX of me (she would set me ashore there at once), nearest
 * first and then by name - each `{ port, fare, bearing, pixels }`.
 * @param {readonly any[]} ports
 * @param {{ x: number, y: number }} here
 * @param {{ hereKey?: string | null, known?: (port: any) => boolean }} [opts]
 */
export function passageDestinations(ports, here, { hereKey = null, known = () => true } = {}) {
  const out = [];
  for (const port of ports ?? []) {
    if (!port?.name || port.key === hereKey || !known(port)) continue;
    const to = { x: port.px, y: port.py };
    if (passagePixels(here, to) <= VOYAGE_LANDFALL_PX) continue;   // a port she would put me ashore at from here is walked to
    out.push({ port, fare: passageFare(here, to), bearing: passageWind(here, to), pixels: passagePixels(here, to) });
  }
  return out.sort((a, b) => a.pixels - b.pixels || a.port.name.localeCompare(b.port.name));
}

/** The voyage's record, written on the boat she becomes (and saved with her - comeSailAway.js getSaveData's
 *  `Charter`): where she sails (`to`, a port's name and pixel), her name, her master, the fare paid. Null for anything
 *  else - a record a save hands back is read through this. */
export function charterRecord(x) {
  const to = x?.to;
  if (!to || typeof to.name !== 'string' || !to.name || !Number.isFinite(to.px) || !Number.isFinite(to.py)) return null;
  return {
    to: { name: to.name, px: to.px | 0, py: to.py | 0 },
    ship: typeof x.ship === 'string' ? x.ship : null,
    captain: typeof x.captain === 'string' ? x.captain : null,
    fare: Math.max(0, Math.floor(Number(x.fare) || 0)),
  };
}

const ship = (name) => name ?? t('passage.theShip', 'The ship');
/** The eight winds in the player's language (systems/compassWords.js's English words are the keys' own). */
const WIND_TEXT = Object.freeze({
  north: () => t('passage.wind.north', 'north'), 'north-east': () => t('passage.wind.northEast', 'north-east'),
  east: () => t('passage.wind.east', 'east'), 'south-east': () => t('passage.wind.southEast', 'south-east'),
  south: () => t('passage.wind.south', 'south'), 'south-west': () => t('passage.wind.southWest', 'south-west'),
  west: () => t('passage.wind.west', 'west'), 'north-west': () => t('passage.wind.northWest', 'north-west'),
});
const windText = (w) => WIND_TEXT[w]?.() ?? w;
/** The words - every one through the text core (L10N4). */
export const PASSAGE_TEXT = Object.freeze({
  /** The look comes onto her at her berth. */
  hint: (name) => t('passage.hint', '{ship} lies at her berth - Activate to book passage.', { ship: ship(name) }),
  /** A row of her master's list. */
  row: (d) => (d.bearing
    ? t('passage.row', '{port} - {wind}, {fare} gold', { port: d.port.name, wind: windText(d.bearing), fare: d.fare })
    : t('passage.rowHere', '{port} - {fare} gold', { port: d.port.name, fare: d.fare })),
  /** The question, before a coin is paid. */
  ask: (name, dest, fare, gold) => [
    t('passage.ask', 'Book passage on {ship} to {port}?', { ship: ship(name), port: dest }),
    t('passage.askFare', 'The fare is {fare} gold. You have {gold}.', { fare, gold }),
    t('passage.askRule', 'Her master sails you there. Step off her and the passage ends.'),
  ],
  booked: (name, captain, fare, dest) => (captain
    ? t('passage.bookedCaptain', 'Captain {captain} takes your {fare} gold. {ship} sails for {port}.', { captain, fare, ship: ship(name), port: dest })
    : t('passage.booked', 'Her master takes your {fare} gold. {ship} sails for {port}.', { fare, ship: ship(name), port: dest })),
  poor: (fare) => t('passage.poor', 'You cannot afford the fare of {fare} gold.', { fare }),
  get none() { return t('passage.none', 'Her master knows of no port you have heard of to sail for.'); },
  get noSail() { return t('passage.noSail', 'No ship can carry you while Come Sail Away is off.'); },
  get booking() { return t('passage.booking', 'You have a passage booked already.'); },
  get ether() { return t('passage.ether', 'Her master sails these isles alone - the Bay\'s ports are beyond the Veil.'); },
  get gone() { return t('passage.gone', 'She has cast off.'); },
  get failed() { return t('passage.failed', 'Her master cannot make ready to sail.'); },
  get noWay() { return t('passage.noWay', 'Her master knows no way there by sea from here.'); },
  helm: (dest) => t('passage.helm', 'Go to her helm to sail on for {port} - her master steers from there.', { port: dest }),
  stuck: (dest) => t('passage.stuck', 'Her master can find no way on toward {port} from here - he will try again. Step ashore to end the passage.', { port: dest }),
  holds: (dest) => t('passage.holds', 'Her master holds his course for {port}.', { port: dest }),
  get goods() { return t('passage.goods', 'What you put in her hold is carried off her.'); },
  ended: (name) => t('passage.ended', '{ship} stands out to sea.', { ship: ship(name) }),
});
/** The look's word on her (navalHost.js passageHint). */
export const passageHintText = (name) => PASSAGE_TEXT.hint(name);
