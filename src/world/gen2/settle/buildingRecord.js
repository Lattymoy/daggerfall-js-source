// WG2 SETTLEMENT 2.0 (bible/03-World/World-2-Canon.md, "Buildings"): THE BUILDING, independent of any RMB block - an
// identity that outlives regeneration, a place in the world, a ground, doors, a role and the services the game reads
// from it (an inn, a shop, a temple...), who may enter, and an interior to reach. A legacy building is the same record
// with its old key kept beside its id (rmbAdapter.js): `rmb:<mapId>:<key>@<layout>` - the layout stamp, because a
// pack's layout gives a key to another building (systems/layoutPins.js). A new building's id is its settlement's and
// a sequence the settlement never reuses; its home key is its block slot's key under the settlement's own map id, so it
// can never be read as a building of Daggerfall's.
import { BUILDING_TYPES } from '../../buildingNames.js';
import { HOME_KEY_MAX } from '../../../net/homeLaw.js';
import { makeBuildingKey } from '../../../systems/talk/talkTopics.js';
import { BLOCK_M } from '../../blockHash.js';

/** The lane of World 2.0's settlements' map ids (world/capitalLane.js holds 0x341, the capitals'). */
export const WG2_SETTLEMENT_LANE = 0x342;
/** A settlement's map id from its ordinal: past every Bay pixel id (placeIds.js isMadePlaceId). @param {number} n */
export const settlementMapId = (n) => ((WG2_SETTLEMENT_LANE << 20) | 0x80000 | n) >>> 0;
/** The settlements a lane holds. */
export const SETTLEMENT_ORDINAL_MAX = 0x7ffff;

/** Roles and what Daggerfall's game reads them as (formats' building type), with their services. */
export const BUILDING_ROLES = Object.freeze({
  house: { type: BUILDING_TYPES.House2, services: [], access: 'private' },
  tavern: { type: BUILDING_TYPES.Tavern, services: ['rooms', 'drink', 'rumours'], access: 'public' },
  shop: { type: BUILDING_TYPES.GeneralStore, services: ['buy', 'sell'], access: 'public' },
  store: { type: BUILDING_TYPES.GeneralStore, services: ['buy', 'sell'], access: 'public' },
  temple: { type: BUILDING_TYPES.Temple, services: ['healing', 'blessing', 'cure'], access: 'public' },
  smith: { type: BUILDING_TYPES.WeaponSmith, services: ['buy', 'sell', 'repair'], access: 'public' },
  guild: { type: BUILDING_TYPES.GuildHall, services: ['guild'], access: 'guild' },
  bank: { type: BUILDING_TYPES.Bank, services: ['bank'], access: 'public' },
  barracks: { type: BUILDING_TYPES.Palace, services: ['law'], access: 'private' },
  warehouse: { type: BUILDING_TYPES.Town23, services: ['storage'], access: 'private' },
  mine: { type: BUILDING_TYPES.Town23, services: ['mine'], access: 'public' },
  barn: { type: BUILDING_TYPES.Town23, services: [], access: 'private' },
  harbour: { type: BUILDING_TYPES.Town23, services: ['passage'], access: 'public' },
  well: { type: BUILDING_TYPES.None, services: ['water'], access: 'public' },
});
export const ACCESS = Object.freeze(['public', 'private', 'owned', 'guild']);
const LEGACY_TYPES = new Set(Object.values(BUILDING_TYPES).filter((v) => v >= 0 && v < 0x100));

/** A Daggerfall building type's role (the legacy adapter's reading of a block's record). @param {number} type */
export function roleOfType(type) {
  const T = BUILDING_TYPES;
  if (type === T.Tavern) return 'tavern';
  if (type === T.Temple) return 'temple';
  if (type === T.GuildHall) return 'guild';
  if (type === T.Bank) return 'bank';
  if (type === T.WeaponSmith || type === T.Armorer) return 'smith';
  if (type === T.Palace) return 'barracks';
  if (type === T.Ship) return 'harbour';
  if (type >= T.House1 && type <= T.House6 || type === T.HouseForSale) return 'house';
  if ([T.Alchemist, T.Bookseller, T.ClothingStore, T.FurnitureStore, T.GemStore, T.GeneralStore, T.Library, T.PawnShop].includes(type)) return 'shop';
  return 'warehouse';
}

/** @typedef {{ x: number, y: number, z: number, dir: [number, number] }} Place world pixels x, y; metres z; dir the door's
 *  facing as a unit vector (never an angle: an angle's sine and cosine are each engine's own, WG-2) */
/** @typedef {{ id: string, settlement: string, role: string, type: number, prefab: string, at: Place, footprint: [number, number],
 *   storeys: number, doors: Place[], services: string[], access: string, interior: { kind: 'rmb'|'generated'|'none', ref?: any },
 *   home?: { mapId: number, key: number }, legacy?: { mapId: number, key: number, layout: string }, genKey?: string,
 *   ground?: { kind: string, level: number }, npcs?: string[], quests?: string[] }} Building */

/** A new building's id. @param {string} settlement @param {number} seq */
export const buildingId = (settlement, seq) => `${settlement}/b${seq}`;
/** A legacy building's id: its town, its key and the layout the key belongs to. @param {number} mapId @param {number} key @param {string} layout */
export const legacyBuildingId = (mapId, key, layout) => `rmb:${mapId >>> 0}:${key}@${layout || 'classic'}`;
/** What an id names: a legacy building's three numbers, or a new one's settlement and sequence; null for neither. @param {string} id */
export function parseBuildingId(id) {
  const leg = /^rmb:(\d+):(\d+)@([A-Za-z0-9@+._-]+)$/.exec(id);
  if (leg) return { legacy: true, mapId: Number(leg[1]), key: Number(leg[2]), layout: leg[3] };
  const own = /^(set-[a-z0-9-]+)\/b(\d+)$/.exec(id);
  return own ? { legacy: false, settlement: own[1], seq: Number(own[2]) } : null;
}

/** A building's problems, as words; none for a whole one. @param {any} b */
export function buildingProblems(b) {
  const out = [];
  const parsed = typeof b?.id === 'string' ? parseBuildingId(b.id) : null;
  if (!parsed) return ['id'];
  if (parsed.legacy) {
    if (!b.legacy || b.legacy.mapId !== parsed.mapId || b.legacy.key !== parsed.key || (b.legacy.layout || 'classic') !== parsed.layout) out.push('legacy');
  } else if (b.legacy) out.push('legacy on a new building');
  if (!BUILDING_ROLES[b.role]) out.push('role');
  else if (parsed.legacy ? !LEGACY_TYPES.has(b.type) : b.type !== BUILDING_ROLES[b.role].type) out.push('type');
  if (!ACCESS.includes(b.access)) out.push('access');
  // a legacy building stands where its block and record put it, its doors on its model (rmbAdapter.js `local`)
  if (parsed.legacy ? !(b.local && Number.isInteger(b.local.recordIndex)) : !placeOk(b.at)) out.push('at');
  if (!parsed.legacy && !(Array.isArray(b.footprint) && b.footprint.length === 2 && b.footprint.every((v) => v > 0 && v <= 80))) out.push('footprint');
  if (!Array.isArray(b.doors) || !b.doors.every(placeOk)) out.push('doors');
  else if (!parsed.legacy && b.role !== 'well' && !b.doors.length) out.push('no door');
  if (!Array.isArray(b.services)) out.push('services');
  if (b.home && !(b.home.key >= 1 && b.home.key <= HOME_KEY_MAX && b.home.mapId >>> 20 === WG2_SETTLEMENT_LANE)) out.push('home');
  return out;
}
function placeOk(p) {
  if (!p || ![p.x, p.y, p.z].every(Number.isFinite) || !Array.isArray(p.dir)) return false;
  const l2 = p.dir[0] * p.dir[0] + p.dir[1] * p.dir[1];
  return l2 > 0.999 && l2 < 1.001;
}

/** The block a building stands in within its pixel's location: x east, y counted from the south (the layout's rows).
 *  @param {{ x: number, y: number }} at */
export function blockOf(at) {
  const px = Math.floor(at.x), py = Math.floor(at.y), bx = Math.floor(((at.x - px) * 819.2) / BLOCK_M), by = Math.floor(((py + 1 - at.y) * 819.2) / BLOCK_M);
  return [bx < 0 ? 0 : bx > 7 ? 7 : bx, by < 0 ? 0 : by > 7 ? 7 : by];
}

/**
 * THE ID BOOK: ids and block slots kept across a regeneration - the same `genKey` on the same ground keeps both, every
 * other building takes the next sequence and its block's next record, and a retired one is never given again. A house's
 * home key is the game's building key for its slot (talkTopics.js makeBuildingKey), the key its door and deed read.
 * @param {string} settlement @param {number} mapId @param {Building[]} made
 * @param {{ next: number, byKey: Record<string, { id: string, x: number, y: number, slot: number[] }>, retired: string[], recs?: Record<string, number> }} [book]
 */
export function mintIds(settlement, mapId, made, book = { next: 1, byKey: {}, retired: [], recs: {} }) {
  const next = { next: book.next, byKey: {}, retired: [...book.retired], recs: { ...(book.recs ?? {}) } }, used = new Set();
  const out = made.map((b) => {
    const was = b.genKey ? book.byKey[b.genKey] : undefined;
    const same = was && !used.has(was.id) && Math.abs(was.x - b.at.x) * 819.2 < 2 && Math.abs(was.y - b.at.y) * 819.2 < 2;
    const id = same ? was.id : buildingId(settlement, next.next++);
    let slot = same ? was.slot : null;
    if (!slot) {
      const [bx, by] = blockOf(b.at), cell = `${bx},${by}`, rec = next.recs[cell] ?? 0;
      if (rec > 255) throw new Error(`${settlement}: block ${cell} holds more than 256 buildings`);
      next.recs[cell] = rec + 1;
      slot = [bx, by, rec];
    }
    used.add(id);
    if (b.genKey) next.byKey[b.genKey] = { id, x: b.at.x, y: b.at.y, slot };
    const homed = b.role === 'house' ? { home: { mapId, key: makeBuildingKey(slot[0], slot[1], slot[2]) } } : {};
    return { ...b, id, slot, ...homed };
  });
  for (const k of Object.keys(book.byKey)) if (!used.has(book.byKey[k].id) && !next.retired.includes(book.byKey[k].id)) next.retired.push(book.byKey[k].id);
  return { buildings: out, book: next };
}
