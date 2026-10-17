// @ts-check
// DRUNK4 (2026-10-17, asked for: "Perhaps seeing the tavern sign appear outside random buildings to give the impression
// your character can't discern reality anymore"). THE DRINK, MISTAKEN: while the player is VERY DRUNK a few of the
// town's other buildings LOOK like taverns - the door's plaque names a tavern, and (scenes/drunkSignsHost.js) a hanging
// tankard sign swings beside the door. Neither DFU nor Climates & Calories has any of it - the port's own, and only a
// picture: the building's real type, its door, what the click does, its directory entry, the map's discovery and the
// save are all untouched, and a sober eye sees the shop again the moment the counter drops under the line.
//
// THE LAW (this file; the host draws it):
//   - HOW MANY: the table's `count` - one at the Very drunk line, up to three at the endurance (PHANTOM.count over the
//     drunkFeel.js share), per town, and never fewer than were shown a moment ago in the same binge (the peak is held:
//     a swallow of water does not take a sign back).
//   - WHICH: any building with a door a player sees that is not already a tavern - a shop, a bank, a guild hall, a
//     temple, a library, a house (PHANTOM.types). A real tavern is never picked; neither is a palace, a city wall or a
//     ship. Picked from a seeded order of the town's candidates (town id, the binge's number, the building's key), so
//     it is the same pick on every frame and in every host, and a fresh one each binge.
//   - HOW LONG: a BINGE is a stretch of Very drunk - the number counts each crossing INTO the band, and everything
//     picked is let go the moment the player drops under it.
//   - WHAT IT IS CALLED: generateBuildingName's own tavern draw, seeded from the REAL building's name seed - so the same
//     building is always the same tavern, and the name reads as one of the town's (the Mole and Mug, the Gold Dragon).
//
// THE HOSTS (bible/Home.md, THE FOUR HOSTS RULE): the plaque is worldModes' one `exteriorHoverName`, which both outer
// hosts (world.js, exterior.js) call - written once there, WIRED for the streets and the bench; its interiors stand no
// street and dungeonContext.js stands none. The 3D sign is scenes/drunkSignsHost.js, wired in world.js alone: the bench
// (exterior.js) measures no door frames (it draws no online homes, hallBanners.js' note), so it gets the plaque only.
// Each host says which town the player is in and its buildings: `provide`.

import { drunkFeel, onDrunkBand } from './drunkFeel.js';
import { staticDoorName } from '../worldTooltips.js';   // the plaque a tavern's door has, for a door that had none
import { BUILDING_TYPES, generateBuildingName } from '../../world/buildingNames.js';

/** THE TABLE: `count` how many a town shows - `base` at the Very drunk line, `perShare` more over the share (0 at the
 *  line's foot, 1 at the endurance), rounded, never past `max`; `types` which buildings may be mistaken (no tavern, no
 *  palace, no wall, no ship, no special); `seedMask` the name seed's width when a host hands none. */
export const PHANTOM = Object.freeze({
  count: Object.freeze({ base: 1, perShare: 2, max: 3 }),
  types: Object.freeze([
    BUILDING_TYPES.Alchemist, BUILDING_TYPES.Armorer, BUILDING_TYPES.Bank, BUILDING_TYPES.Bookseller, BUILDING_TYPES.ClothingStore,
    BUILDING_TYPES.FurnitureStore, BUILDING_TYPES.GemStore, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Library, BUILDING_TYPES.GuildHall,
    BUILDING_TYPES.PawnShop, BUILDING_TYPES.WeaponSmith, BUILDING_TYPES.Temple,
    BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3, BUILDING_TYPES.House4, BUILDING_TYPES.House5, BUILDING_TYPES.House6,
  ]),
  seedMask: 0xffff,
});

const NONE = Object.freeze([]);
/** AUDIT DRUNK2: the one answer for "no sign" - frozen and shared, so a sober frame (and every cached one) allocates none. */
const NO_SIGNS = Object.freeze({ town: null, keys: NONE });

/** A 32-bit mix of integers, every bit of each one reaching every bit of the result (a murmur3 round a word): the key the
 *  seeded order sorts by, and the name seed of a host that hands none. */
export function mix(...ns) {
  let h = 0x9e3779b9;
  for (const n of ns) {
    h = Math.imul(h ^ (n >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
/** A town id as the hosts key it: unsigned, whatever sign a map id was read with. */
const townOf = (t) => (Number.isFinite(Number(t)) ? Number(t) >>> 0 : null);

/** How many buildings a town shows at `share` of the way from the Very drunk line's foot to the endurance. */
export function phantomCount(share) {
  const k = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0;
  return Math.min(PHANTOM.count.max, PHANTOM.count.base + Math.round(PHANTOM.count.perShare * k));
}

/** May this building be mistaken for a tavern: a type on the table (a real tavern is not on it), a key, and - when the
 *  host knows it has none - a door a player sees. */
export const phantomEligible = (b) => !!b && Number.isSafeInteger(b.buildingKey) && PHANTOM.types.includes(b.buildingType) && b.hasDoor !== false;

/**
 * The town's candidates in the order they are picked: the eligible ones (a real tavern never among them), each keyed by
 * a seeded mix of the town, the binge's number and the building's own key, the smallest first. Pure: the same
 * (town, binge, buildings) is the same order wherever it is asked, and the first `n` are the `n` shown.
 * @param {number} town the map id @param {number} binge the number of the crossing into Very drunk
 * @param {{buildingKey: number, buildingType: number, hasDoor?: boolean}[]} buildings
 * @returns {number[]} building keys
 */
export function phantomOrder(town, binge, buildings) {
  const seen = new Set();
  const keyed = [];
  for (const b of buildings ?? NONE) {
    if (!phantomEligible(b) || seen.has(b.buildingKey)) continue;
    seen.add(b.buildingKey);
    keyed.push([mix(town, binge, b.buildingKey), b.buildingKey]);
  }
  keyed.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return keyed.map((k) => k[1]);
}

/** The tavern a phantom is taken for: generateBuildingName's own tavern draw off the real building's name seed. */
export const phantomName = (nameSeed) => generateBuildingName(nameSeed, BUILDING_TYPES.Tavern);

/**
 * THE RUNTIME: one binge's picks. `state` is the drink as it stands now (drunkFeel.js `state()`: { band, share });
 * a host says where it is with `provide({ town, buildings })` - `town()` the map id of the town the player is in (or
 * null), `buildings()` its buildings `{ buildingKey, buildingType, hasDoor? }`, asked once a town a binge.
 */
export function createDrunkSigns({ state = () => drunkFeel.state() } = {}) {
  /** @type {{ town: () => (number|null), buildings: () => any[] }|null} */
  let provider = null;
  let binge = 0, was = false, peak = 0;
  /** @type {Map<number, number[]>} the town's candidates in picking order, made once a town a binge */
  const orders = new Map();
  /** @type {Map<string, string>} the tavern names shown, a (town, building) a name */
  const names = new Map();
  let shown = null;   // the last answer of `current`, kept while nothing it was made from moved
  const letGo = () => { orders.clear(); names.clear(); shown = null; peak = 0; };

  /** A crossing INTO Very drunk is a new binge; a drop out of it lets everything go. */
  const cross = (very) => {
    if (very && !was) { binge++; letGo(); }
    else if (!very && was) letGo();
    was = very;
  };

  /** Read the drink: the crossing, and the count the binge's peak holds. */
  function observe() {
    const s = state();
    const very = s?.band === 'veryDrunk';
    cross(very);
    if (very) peak = Math.max(peak, phantomCount(s.share));
    return very;
  }

  /** The town the player is in and the keys of its buildings mistaken for taverns now - `keys` empty when sober, at
   *  the Drunk line, with no host or with no town. */
  function current() {
    if (!observe() || !provider) return NO_SIGNS;
    const town = townOf(provider.town());
    if (town == null) return NO_SIGNS;
    let order = orders.get(town);
    if (!order) {
      const list = provider.buildings();
      if (!list?.length) return NO_SIGNS;   // not built yet: asked again
      order = phantomOrder(town, binge, list);
      orders.set(town, order);
    }
    const n = Math.min(peak, order.length);
    if (shown && shown.order === order && shown.n === n) return shown.answer;
    shown = { order, n, answer: { town, keys: Object.freeze(order.slice(0, n)) } };
    return shown.answer;
  }

  return {
    /** A host says which town the player is in and what stands there (the last host to say it is the one asked). */
    provide(p) { provider = p; },
    observe,
    /** AUDIT DRUNK2: the feel's band changed (drunkFeel.js onDrunkBand) - a binge begins and ends with it, whether or
     *  not any street is drawn (sobering up indoors and drinking again is a new binge, new picks). */
    note(band) { cross(band === 'veryDrunk'); },
    current,
    /** The tavern name to SHOW for a building of `town`, or null: a building of this binge's picks, of a type that may be
     *  mistaken (`type`, when the caller knows it), named off its real name seed. */
    nameFor(town, buildingKey, { type = undefined, seed = undefined } = {}) {
      const now = current();
      const t = townOf(town);
      if (t == null || now.town !== t || !now.keys.includes(buildingKey)) return null;
      if (type !== undefined && !PHANTOM.types.includes(type)) return null;   // a real tavern, or what may not be mistaken
      const id = `${t}:${buildingKey}`;
      let name = names.get(id);
      if (name === undefined) {
        name = phantomName(Number.isFinite(seed) ? /** @type {number} */ (seed) : mix(t, buildingKey) & PHANTOM.seedMask);
        names.set(id, name);
      }
      return name || null;
    },
    /** The number of this binge (0 before the first crossing). */
    get binge() { return binge; },
    /** How many picks and names are held (nothing once the player is under the band). */
    get held() { return orders.size + names.size; },
    /** Forget everything (a new game, a test). */
    reset() { letGo(); binge = 0; was = false; provider = null; },
  };
}

/** The game's one: the hosts `provide` it, the plaque and the sign host read it. */
export const drunkSigns = createDrunkSigns();
// AUDIT DRUNK2: a binge begins and ends with the band, drawn or not - the game's one feel says so each frame it changes
onDrunkBand((band) => drunkSigns.note(band));

/** The tavern name to SHOW over a building's door, or null: `phantomNameFor(townMapId, buildingKey, { type, seed })`. */
export const phantomNameFor = (town, buildingKey, opts) => drunkSigns.nameFor(town, buildingKey, opts);

let _memo = null;
/**
 * THE PLAQUE (worldModes' exteriorHoverName, the one both outer hosts call): `text` the door's plaque as the host
 * answers it (`{ title, subs, actions }`, or null - a house with no name and no verbs has none) and `bd` the building
 * record it names (buildingKey, buildingType, nameSeed - buildingDataForDoor's shape) in town `town`. A phantom's title
 * reads as the tavern - the title's own first line ("To") kept, the tavern's name in place of the real one - and everything
 * else (the lines under it, the verbs) is the door's own, as the click will find it; where the door has no plaque the
 * tavern's is the one staticDoorName makes for a tavern of that name (the eye sees a sign where there was none). Anything
 * else is returned as it came, the very object. Presentation only: it reads the host's cached answer and never writes it,
 * discovers nothing, and answers one object while the same plaque is read again.
 * @param {any} text @param {any} bd @param {number} town
 */
export function phantomDoorText(text, bd, town, signs = drunkSigns) {
  if (!bd || (text && typeof text.title !== 'string')) return text;
  const name = signs.nameFor(town, bd.buildingKey, { type: bd.buildingType, seed: bd.nameSeed });
  if (!name) return text;
  const id = `${townOf(town)}:${bd.buildingKey}`;
  if (_memo && _memo.text === text && _memo.id === id && _memo.name === name) return _memo.out;   // the same plaque again: the same object
  let out;
  if (text) {
    const head = text.title.indexOf('\n');
    out = { ...text, title: head >= 0 ? text.title.slice(0, head + 1) + name : name };
  } else {
    out = staticDoorName('building', { displayName: name, buildingType: /** @type {any} */ (BUILDING_TYPES.Tavern) });   // (staticDoorName's default types it as the literal -1)
  }
  _memo = { text, id, name, out };
  return out;
}
