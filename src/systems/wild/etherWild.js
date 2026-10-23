// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ETHER-WILD (2026-10-21) - THE OPEN SEA: THE ELTHERIC OCEAN AN OPEN PVP ZONE (bible/03-World/Eltheric-Ocean.md ETHER-WILD;
// bible/11-Multiplayer/Wild-Zone.md section 24).
//
// The owner: "The etheric ocean is some amazing content we havent touched in awhile. I want there to be more of a reason
// to venture into this zone. ... id also like to implement open pvp for this zone specifficaly and implement some of the
// wrothgarian mountain open pvp aspects into the procedural Islands".
//
// WHAT THE ZONE IS: every pixel of the sea's box (world/ethericSea.js inEther) but VEILHAVEN'S PEACE - the Veil, the way
// home (`inVeil`), the water within ETHER_PEACE_PX of Veilhaven's own pixel, where the crossing makes its landfall, and
// the way between them (her rows, ETHER_PEACE_PX either side, east of her to the Veil - AUDIT SEA VENTURES C2).
// The rest of the sea, its isles, their towns and their ruins, is the Wrothgarian Mountains' law (systems/wild/wildZone.js
// - the live flag, the fights the relay referees, the death's drop and the remains, the strangers, the foes four times
// as strong and their loot by the ring), with the sea's DEPTH BANDS for the mountains' four rings: the Shallows the
// foothills' +25%, the Reaches +50%, the Deep Aether +75%, the Abyss the heart's twice. The deeper, the deadlier and the
// richer - the sea's own law already (its ships' levels, its holds' tiers), now its foes' and its players' too.
//
// ONLINE ALONE, as the mountains are: offline the sea is the captain's own. The world host asks it each frame, beside
// the mountains' (scenes/world.js wildFrame), and a dungeon of an isle at its build (scenes/dungeonContext.js
// wildRingAtPlace).
//
// THIS FILE IS A LEAF of the zone: the sea's law (pure, worker-safe - world/ethericSea.js imports formats/ alone) and the
// zone's words on this ground, registered with wildZone.js so the mountains' leaf imports nothing of the sea.
// ═══════════════════════════════════════════════════════════════════
import { BANDS, ETHER_WORD, inEther, inVeil, etherBandAt, veilhaven, islesNear } from '../../world/ethericSea.js';
import { WILD_RINGS, wildRingAt, wildRingLoot, registerZoneWords } from './wildZone.js';
import { t } from '../textManager.js';

/** The ground's kind on the live flag (wildZone.js setWildHere). */
export const ETHER_KIND = 'ether';
/** VEILHAVEN'S PEACE: no player fights within this many pixels of Veilhaven's own pixel (some 10 km - the landfall, LANDFALL_OFF_PX
 *  east of it, well inside), nor in the Veil itself. */
export const ETHER_PEACE_PX = 12;

/** AUDIT CAPTAIN'S SEA P4: where a death past the Veil rises - the nearest port isle's town: the Bay's temples are a
 *  crossing away. (HOST-SPLIT, SEA VENTURES: out of world.js bootWorld, with the open sea's rise site.) AUDIT SEA VENTURES
 *  C5/F2: sought from ETHER_RISE_PX out, the reach doubled until a port stands within it - Veilhaven is one, so it ends
 *  at her at the farthest: a death with no freeport within ETHER_RISE_PX rose at Veilhaven, a hundred leagues and more
 *  from one twelve leagues off. */
export const ETHER_RISE_PX = 60;
export function etherRisePort(x, y) {
  const h = veilhaven(), far = Math.hypot(h.px - x, h.py - y);
  if (!Number.isFinite(far)) return h;
  for (let r = ETHER_RISE_PX; ; r *= 2) {
    const port = islesNear(x, y, Math.min(r, far + 1)).find((i) => i.kind === 'port' && Math.hypot(i.px - x, i.py - y) <= r);
    if (port) return port;
    if (r > far) return h;
  }
}
/** ETHER-WILD: a death on the open sea - an isle's ruin's too - rises at the nearest freeport's town (etherRisePort): the
 *  site world.js wildRiseSite answers past the Veil (the sea has no other city to rise in). */
export function etherRiseSite(x, y) {
  const port = etherRisePort(x, y);
  return { mapPixel: { x: port.px, y: port.py }, kind: 'city' };
}

/** Is pixel (x, y) in Veilhaven's peace - the Veil, within ETHER_PEACE_PX of Veilhaven, or on the way between them? */
export function etherInPeace(x, y) {
  if (inVeil(x, y)) return true;
  const h = veilhaven();
  if (Math.hypot(x - h.px, y - h.py) <= ETHER_PEACE_PX) return true;
  // AUDIT SEA VENTURES C2: the way home - her own rows, east of her to the Veil: thirty-one pixels of open zone stood
  // between the peace and the crossing, every captain's one way home through them
  return inEther(x, y) && x >= h.px && Math.abs(y - h.py) <= ETHER_PEACE_PX;
}

/** The ring of the open sea at pixel (x, y): its depth band's place (1 the Shallows ... 4 the Abyss), or 0 - outside the
 *  sea's box, or in Veilhaven's peace. */
export function etherWildRingAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !inEther(x, y) || etherInPeace(x, y)) return 0;
  return Math.max(1, Math.min(WILD_RINGS, BANDS.indexOf(etherBandAt(x)) + 1));
}

/**
 * WILD2: A PLACE'S RING of the open zone, by its map pixel (mapTableData's longitude/latitude, MapsFile's own sum) - a
 * dungeon's build reads it once (scenes/dungeonContext.js, moved here from there so it is read the same way everywhere).
 * ETHER-WILD: an isle's place (world/etherPlaces.js synthesizeEtherLocation's `ether`) by the sea's band at its pixel;
 * any other by the mountains' registered mask (wildZone.js wildRingAt). 0 for a place that cannot say where it stands.
 */
export function wildRingAtPlace(loc) {
  const at = loc?.mapTableData;
  if (!Number.isFinite(at?.longitude) || !Number.isFinite(at?.latitude)) return 0;
  const px = Math.trunc(at.longitude / 128), py = 499 - Math.trunc(at.latitude / 128);   // formats/mapsFile.js longitudeLatitudeToMapPixel
  return loc?.ether ? etherWildRingAt(px, py) : wildRingAt(px, py);
}

/** A ring's name on the sea: its band's ("The Shallows" ... "The Abyss"). */
export const etherRingName = (ring) => BAND_NAMES[BANDS[Math.max(1, Math.min(WILD_RINGS, ring | 0 || WILD_RINGS)) - 1].id]();
/** The bands' names at the head of a line - each its own key (the extractor reads a key whole). */
const BAND_NAMES = Object.freeze({
  shallows: () => t('sea.wild.band.shallows', 'The Shallows'),
  reaches: () => t('sea.wild.band.reaches', 'The Reaches'),
  deep: () => t('sea.wild.band.deep', 'The Deep Aether'),
  abyss: () => t('sea.wild.band.abyss', 'The Abyss'),
});

/** AUDIT SEA VENTURES F4: a ring's loot in the sea's sentences ("+75% loot" - wildZone.js wildRingBonus's, said through the
 *  text core: the band was each language's and its loot English). */
export const etherRingBonus = (/** @type {number} */ ring) => t('sea.wild.bonus', '+{pct}% loot', { pct: Math.round((wildRingLoot(ring) - 1) * 100) });
/** AUDIT SEA VENTURES F4: THE COMPASS'S SIXTEEN POINTS through the text core (world/ethericSea.js compassPoint's words - the
 *  sea's rumours, its storm's and its fleet's lines, the chart's ways said a way in English in every language), each its
 *  own key whole for the extractor. */
const WAY_WORDS = Object.freeze({
  north: () => t('sea.way.n', 'north'), 'north-north-east': () => t('sea.way.nne', 'north-north-east'), 'north-east': () => t('sea.way.ne', 'north-east'), 'east-north-east': () => t('sea.way.ene', 'east-north-east'),
  east: () => t('sea.way.e', 'east'), 'east-south-east': () => t('sea.way.ese', 'east-south-east'), 'south-east': () => t('sea.way.se', 'south-east'), 'south-south-east': () => t('sea.way.sse', 'south-south-east'),
  south: () => t('sea.way.s', 'south'), 'south-south-west': () => t('sea.way.ssw', 'south-south-west'), 'south-west': () => t('sea.way.sw', 'south-west'), 'west-south-west': () => t('sea.way.wsw', 'west-south-west'),
  west: () => t('sea.way.w', 'west'), 'west-north-west': () => t('sea.way.wnw', 'west-north-west'), 'north-west': () => t('sea.way.nw', 'north-west'), 'north-north-west': () => t('sea.way.nnw', 'north-north-west'),
});
/** A compass point's word in the language of the moment (compassPoint's, or '' for none). */
export const etherWayWord = (/** @type {string | null | undefined} */ point) => (point ? WAY_WORDS[/** @type {keyof typeof WAY_WORDS} */ (point)]?.() ?? point : '');

/** The zone's words on the sea (WILD_TEXT's keys, said this ground's way) - through the text core (L10N4), read when said. */
export const ETHER_WILD_TEXT = Object.freeze({
  enter: () => t('sea.wild.enter', 'You sail out of Veilhaven\'s peace onto the open {word} Ocean, an open PvP zone. Foes here are four times as strong, and you can lose what you carry.', { word: ETHER_WORD }),
  leave: () => t('sea.wild.leave', 'You are in Veilhaven\'s peace. No player may attack you here.'),
  ring: (r) => t('sea.wild.ring', '{band}: {bonus}.', { band: etherRingName(r), bonus: etherRingBonus(r) }),
  ringCross: (r, deeper) => (deeper
    ? t('sea.wild.deeper', 'Deeper - {band}: {bonus}.', { band: etherRingName(r), bonus: etherRingBonus(r) })
    : t('sea.wild.shallower', 'Back toward the Veil - {band}: {bonus}.', { band: etherRingName(r), bonus: etherRingBonus(r) })),
  chipTip: () => t('sea.wild.chipTip', 'The {word} Ocean past Veilhaven\'s peace: other players may attack you. Foes are four times as strong and drop up to twice the loot (25% more in the Shallows, twice in the Abyss). If you die, you drop what you carry.', { word: ETHER_WORD }),
  deathHold: () => t('sea.wild.deathHold', 'Past the Veil the dead wait two minutes.'),
  teleport: () => t('sea.wild.teleport', 'You cannot teleport into, out of or about the open {word} Ocean. Sail.', { word: ETHER_WORD }),
  // AUDIT SEA VENTURES C3, C6, C7: the mountains' words the sea said - a party's walk onto it, the zone gone while still
  // past the peace (a relay lost, a save loaded in the Bay: "Veilhaven's peace" was said wherever the player stood), a
  // party left, a drop answered after the rise, /unstuck outdoors, a second revenant
  walkInto: () => t('sea.wild.walkInto', 'It leads onto the open {word} Ocean past Veilhaven\'s peace, an open PvP zone. Other players may kill you there and take what you carry.', { word: ETHER_WORD }),
  quiet: () => t('sea.wild.quiet', 'You are out of the open {word} Ocean\'s PvP zone. No player may attack you here.', { word: ETHER_WORD }),
  truce: () => t('sea.wild.truce', 'No longer in your party. On the open {word} Ocean you and they cannot fight for ten minutes. Then you are strangers.', { word: ETHER_WORD }),
  dropLate: () => t('sea.wild.dropLate', 'What you dropped when you died at sea has left your pack. It lies where you fell.'),
  burntLate: () => t('sea.wild.burntLate', 'What you dropped when you died at sea has left your pack. This character\'s trading is frozen, so it was lost.'),
  unstuckOut: () => t('sea.wild.unstuckOut', '/unstuck does not work outdoors on the open {word} Ocean.', { word: ETHER_WORD }),
  revenantOne: () => t('sea.wild.revenantOne', 'Only one revenant may walk at your side on the open {word} Ocean.', { word: ETHER_WORD }),
});

// The zone's words on this ground: wildZone.js zoneWord/zoneName/zoneRingName answer them while the player stands here.
// A word is a string where WILD_TEXT's is one (read here, at the first ask of each: a getter keeps the language's).
registerZoneWords(ETHER_KIND, {
  name: `${ETHER_WORD} Ocean`,   // as WILD_NAME is said: the sentence brings its own "the" ("until you leave the {zone}")
  ringName: etherRingName,
  get enter() { return ETHER_WILD_TEXT.enter(); },
  get leave() { return ETHER_WILD_TEXT.leave(); },
  ring: ETHER_WILD_TEXT.ring,
  ringCross: ETHER_WILD_TEXT.ringCross,
  get chipTip() { return ETHER_WILD_TEXT.chipTip(); },
  get deathHold() { return ETHER_WILD_TEXT.deathHold(); },
  get walkInto() { return ETHER_WILD_TEXT.walkInto(); },   // AUDIT SEA VENTURES C3, C6, C7
  get quiet() { return ETHER_WILD_TEXT.quiet(); },
  get truce() { return ETHER_WILD_TEXT.truce(); },
  get dropLate() { return ETHER_WILD_TEXT.dropLate(); },
  burntLate: ETHER_WILD_TEXT.burntLate,   // a function, as WILD_TEXT's is
  get unstuckOut() { return ETHER_WILD_TEXT.unstuckOut(); },
  get revenantOne() { return ETHER_WILD_TEXT.revenantOne(); },
});
