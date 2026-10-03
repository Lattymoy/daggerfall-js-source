// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME1 (2026-09-25) — AN ONLINE HOME: ONE OWNER A BUILDING, SERVER-WIDE.
//
// Mac: "allowing online players to purchase housing in any location";
// asked: "Housing is exclusive. World is super large. Can revisit later
// if needed"; a home is bought "At its front door"; a house bought
// offline "Stay[s] offline only"; who walks in, "Owner chooses".
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/homes.js), which keeps the one registry, and the
// client (net/accountClient.js and the door) - so they cannot come to
// disagree. Pure: no clock, no DOM, no network.
//
// A HOME is a building in a town, named by the town's unsigned map id
// and the building's key there (talkTopics.js makeBuildingKey - every
// client builds the same key for the same town, and a key alone is
// unique only inside its town). It belongs to one CHARACTER of one
// registered account; its door names the account's handle, the name
// the relay signs over a head, never the character's.
// ═══════════════════════════════════════════════════════════════════

/** How many town homes one character may hold (PLOT1's homesteads will count apart). */
export const HOME_CAP = 3;
/** Who may walk in, as the owner sets it: the owner alone, the owner's party, anyone - and (GUILD1d, Seats-Arc 8.2) the
 *  owner's character's guild. */
export const HOME_ENTRIES = Object.freeze(['private', 'party', 'public', 'guild']);
/** A home bought is its owner's alone until they say otherwise. */
export const HOME_ENTRY_DEFAULT = 'private';
/** The dearest price a claim may name (a Daggerfall house's is its model's radius x 1280 - tens of thousands). */
export const HOME_PRICE_MAX = 10_000_000;
/** Claims an account may make an hour - a cap stops a hoard, this stops a claim-and-release churn. */
export const HOME_CLAIMS_MAX = 20;
export const HOME_CLAIMS_WINDOW_S = 3600;
/** The most homes one town's answer lists (a town has a few hundred buildings; the widest, Daggerfall's, 316). */
export const HOME_TOWN_MAX = 512;
/** The politic regions, 0..61. */
export const HOME_REGION_MAX = 61;
/** A building key's widest value: (blockX<<16)+(blockY<<8)+record inside an 8x8 town, and 0 spelt 1<<24. */
export const HOME_KEY_MAX = 1 << 24;

/** A town's map id, unsigned (the room keys' spelling: MAPS.BSA reads it signed). */
export const homeMapIdOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= 0xffffffff;
export const homeBuildingKeyOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= HOME_KEY_MAX;
export const homeRegionOk = (v) => Number.isSafeInteger(v) && v >= 0 && v <= HOME_REGION_MAX;
export const homePriceOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= HOME_PRICE_MAX;
export const homeEntryOk = (v) => typeof v === 'string' && HOME_ENTRIES.includes(v);
/** REALM P2.2b: the share of what a home cost that selling it pays back - Daggerfall's deed share (systems/banking.js
 *  DEED_SELL_MULT, pinned equal) - so the service credits a realm character's record the sum its client credits. */
export const HOME_SALE_SHARE = 0.85;
/** What selling a home bought for `price` pays back (systems/onlineHomes.js homeRefund, pinned equal). */
export const homeSaleRefund = (price) => Math.trunc((Number.isSafeInteger(price) && price > 0 ? price : 0) * HOME_SALE_SHARE);

const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && a.toLowerCase() === b.toLowerCase();

/**
 * WHETHER A PLAYER MAY WALK IN. `home` is a town answer's row ({owner, entry, mine}) or null for a building no player
 * owns (its own law stands - DFU's locks). The owner always; anyone when public; when party, a player whose party
 * holds the owner - `partyNames` are the handles the relay signed over the party's heads. HOME-RENT: and a tenant
 * (`tenant`, when the playing character's tenancy there still runs), whoever else may. GUILD1d: when guild, a player
 * whose character is in the owner's character's guild (`guildmate`); a hall (`hall`), its members and, when public,
 * anyone.
 */
export function homeMayEnter(home, { partyNames = [], nowS = Math.floor(Date.now() / 1000) } = {}) {
  if (!home) return true;
  // GUILD1d: A GUILD'S HALL is no one's home - its members walk in (the service says whether the playing character is
  // one, `member`), and anyone when its guild opened it; never by an account's other character, nor a party
  if (home.hall) return home.member === true || home.entry === 'public';
  if (home.mine) return true;
  if (rentDaysLeft(home.tenant, nowS) > 0) return true;   // HOME-RENT: a room rented in it, still running - the tenant walks in whoever else may (AUDIT: until its end, not until the town is read again)
  if (home.entry === 'public') return true;
  if (home.entry === 'party') return (partyNames ?? []).some((n) => sameName(n, home.owner));
  if (home.entry === 'guild') return home.guildmate === true;   // GUILD1d: the playing character shares the owner's character's guild (the service's word)
  return false;
}

// ═══ WD3 (2026-10-01) — THE LAYOUT A HOME'S TOWN WAS BOUGHT IN ═══════════
//
// Mac: "ensure this doesn't conflict or regress anything (For example
// housing customization)". Beautiful Villages and Beautiful Cities lay
// Daggerfall's towns out again, and a home is a building KEY - which names
// a building only in one layout of its town. Online the two mods are the
// room's (systems/onlineLane.js ONLINE_ROOM_MOD_KEYS), and every home
// bought before them was bought in Daggerfall's own towns. So a home keeps
// the layout its town was bought in, server-wide: NULL - Daggerfall's,
// every home from before WD3 - or the stamp its first buyer's client sent
// (systems/layoutPins.js layoutStampOf: `vendor@version`, joined by '+'). A
// town's later homes take its first home's, whatever a client sends. Every
// client reads the towns that hold homes, and their layouts, at its online
// boot, and keeps each town in its layout - one town for the whole room.

/** The layout mods a stamp may name (systems/layoutPins.js LAYOUT_MODS, pinned equal). */
export const HOME_LAYOUT_MODS = Object.freeze(['beautiful-villages', 'beautiful-cities']);
/** A stamp's longest spelling. */
export const HOME_LAYOUT_MAX = 96;
/** The most towns the layouts read answers (a town per home at the very most). */
export const HOME_LAYOUTS_MAX = 20000;
/** A home's layout stamp: null (Daggerfall's own town) or `vendor@version` of the layout mods, joined by '+', each
 *  named once. */
export function homeLayoutOk(v) {
  if (v === null || v === undefined) return true;
  if (typeof v !== 'string' || !v || v.length > HOME_LAYOUT_MAX) return false;
  const seen = new Set();
  for (const part of v.split('+')) {
    const m = /^([a-z-]+)@([0-9A-Za-z.?-]{1,16})$/.exec(part);
    if (!m || !HOME_LAYOUT_MODS.includes(m[1]) || seen.has(m[1])) return false;
    seen.add(m[1]);
  }
  return true;
}

/** Whether two stamps are one layout - the same layout mods, whatever versions they name; null (or absent) is
 *  Daggerfall's own (systems/layoutPins.js layoutsMatch, the same law where the service can read it). */
export function homeLayoutsMatch(a, b) {
  const mods = (v) => new Set(typeof v === 'string' && v ? v.split('+').map((p) => p.split('@')[0]).filter((m) => HOME_LAYOUT_MODS.includes(m)) : []);
  const x = mods(a), y = mods(b);
  return x.size === y.size && [...x].every((m) => y.has(m));
}

// ═══ ARENA4b (2026-10-03) — THE HOMES THE ARENA DISPLACED, MOVED ONLINE ══
//
// Mac (ARENA1): "Move them to a new house". The Arena of Daggerfall
// stands in Daggerfall's cell (4,3) in every layout of the city
// (world/arenaCity.js), so no building has a key there: an online home
// keyed there names nothing. The OWNER'S CLIENT picks its new house by
// the offline move's own rule (systems/arenaMove.js arenaHomeFor - the
// service holds no town's records) and posts it; the service checks the
// keys by the law below and carries the home's row whole to the new key
// (server-account/src/homes.js arenaMoveHome). And no build may buy a
// house there any more - a build from before the arena still stands
// GEMSAL03 and would (`home-arena`: homes.js claimHome, halls.js buyHall).

/** Daggerfall's map id, unsigned (world/actionSystem.js CASTLE_DAGGERFALL_MAP_ID - the city's, pinned equal). */
export const HOME_ARENA_MAP_ID = 1291010263;
/** The arena's cell of Daggerfall's grid (world/arenaCity.js ARENA_CELL, pinned equal): `[blockX, blockY]`. */
export const HOME_ARENA_CELL = Object.freeze([4, 3]);
/** Whether a building key of a town names a building of the arena's cell - read off the RAW key, as the tables keep it
 *  and as world/arenaCity.js inArenaCell reads it (`key >> 16` the block's x, `(key >> 8) & 255` its y). */
export const homeInArenaCell = (mapId, key) => mapId === HOME_ARENA_MAP_ID && homeBuildingKeyOk(key)
  && (key >> 16) === HOME_ARENA_CELL[0] && ((key >> 8) & 0xff) === HOME_ARENA_CELL[1];
/** A ROOM'S POINT CARRIED BY THE MOVE: the anchor column's text for a running tenancy the move carried to the new house
 *  (JSON null - the column is NOT NULL). The old house's point names no room of the new one's walls, so the tenancy
 *  runs on unlisted and anchorless: its tenant still walks in and rests (the door and the bed read the tenancy -
 *  homesInTown's `tenant`, homeMayEnter, systems/homeRent.js homeBedIsMine - never the point), the door offers it to
 *  nobody once its days run out (an offer of the same number writes a point again - rent.js offerRoom). */
export const RENT_ANCHOR_MOVED = 'null';

// ═══ HOME-RENT (2026-09-30) — A ROOM OF A HOME, RENTED TO ANOTHER PLAYER ══
//
// Asked: "For houses with multiple rooms, the owner can choose to rent out
// to other players and adjust the price as needed". An owner OFFERS a room
// of their online home - one of the rooms its own walls part it into
// (systems/decorRooms.js), named by its number and a point in it (`anchor`,
// the building frame's, as a piece of decor stands - net/decorLaw.js), and
// priced in gold a day, changed whenever the owner likes (a tenancy already
// paid keeps what it paid). Another player RENTS it at the door, for a few
// days: the tenant may walk in whoever else may (homeMayEnter) and rest
// there, as a tavern's room lets its guest rest (systems/tavern.js), until
// the days run out. The rent is the tenant's record's, paid in the rent's
// own write (server-account/src/rent.js); it is held on the home, never paid
// into an owner's record nobody is playing, and the owner COLLECTS it at
// their own door or in the decorator. A day is a real day - the service's
// clock, the same for every player - since no two players' game clocks
// agree. Online alone, realm characters on both sides (a house is a realm
// character's, AUDIT REALM2 S2), never a character's own account renting
// from itself.

/** How many rooms of one home may be offered to rent - a house's rooms, and more than any house has. */
export const RENT_ROOMS_MAX = 8;
/** A room's price, gold a day - the owner's to change. */
export const RENT_PRICE_MIN = 1;
export const RENT_PRICE_MAX = 10_000;
/** A day, in the service's seconds - a real day. */
export const RENT_DAY_S = 86_400;
/** The days a tenant may rent at once, as the door offers them, and the furthest ahead a tenancy may run. */
export const RENT_DAYS = Object.freeze([1, 3, 7, 14, 30]);
export const RENT_DAYS_MAX = 30;
/** How many rooms one character may hold at once, across every home. */
export const RENT_HELD_MAX = 3;
/** Rent writes an account may make an hour (an offer, a price, a rent, a collection each count). */
export const RENT_WRITES_MAX = 120;
export const RENT_WRITES_WINDOW_S = 3600;
/** The furthest from the building's origin a room's point may stand - the decor law's own bound. */
export const RENT_ANCHOR_MAX = 256;

export const rentRoomOk = (v) => Number.isSafeInteger(v) && v >= 1 && v <= RENT_ROOMS_MAX;
export const rentPriceOk = (v) => Number.isSafeInteger(v) && v >= RENT_PRICE_MIN && v <= RENT_PRICE_MAX;
export const rentDaysOk = (v) => Number.isSafeInteger(v) && v >= 1 && v <= RENT_DAYS_MAX;
/** A room's point, projected (a centimetre) - `[x, y, z]` from the building's origin - or null. */
export function rentAnchorOf(raw) {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  if (!raw.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= RENT_ANCHOR_MAX)) return null;
  return raw.map((v) => Math.round(v * 100) / 100);
}
/** What `days` of a room at `price` a day cost - or 0 for a price or days the law refuses. */
export const rentCost = (price, days) => (rentPriceOk(price) && rentDaysOk(days) ? price * days : 0);
/**
 * WHEN A TENANCY ENDS, `days` more at `nowS`: from its current end while it still runs (days added to days), else from
 * now - or null past the furthest a tenancy may run ahead (RENT_DAYS_MAX days from now).
 */
export function rentUntil(nowS, until, days) {
  if (!rentDaysOk(days) || !Number.isSafeInteger(nowS)) return null;
  const from = Number.isSafeInteger(until) && until > nowS ? until : nowS;
  const end = from + days * RENT_DAY_S;
  return end - nowS <= RENT_DAYS_MAX * RENT_DAY_S ? end : null;
}
/** Whole days (rounded up) a tenancy ending `until` has left at `nowS` - 0 once it ran out. */
export const rentDaysLeft = (until, nowS) => (Number.isSafeInteger(until) && until > nowS ? Math.ceil((until - nowS) / RENT_DAY_S) : 0);

// ═══ HOME-LOOK (2026-09-30) — AN ONLINE HOME'S OUTSIDE, AS ITS OWNER PAINTS IT ══
//
// Asked: "The introduction of exterior customization. The ability to choose
// the texture for the roof, walls, door, windows, etc". A house's outside
// is Daggerfall's own ARCH3D faces, each wearing a record of a texture
// family (world/climateSwaps.js - the families Daggerfall files its
// exteriors under: the building sets, the roofs (69), the doors (74), and
// the windows among the building sets' records). The owner chooses, part
// by part, which of Daggerfall's own families and climates it wears:
//  - WALLS: a building set (a manor's, a tavern's, a village house's...)
//    and a climate - every wall face takes the same record of that set, as
//    Daggerfall's own climate swap takes the same record of another
//    climate's set (ClimateSwaps.ApplyClimate), so a wall stays a wall;
//  - WINDOWS: a building set's window (its record 3, every set's) and a
//    climate;
//  - ROOF and DOOR: a climate, and which of its roofs or doors (a record) -
//    every roof face, or every door face, wears that one.
// Winter still snows on it where Daggerfall's own snows (the season swap
// runs after the choice). A part the owner never changed wears the town's
// own. The look is the service's (homes.look), read with the town's homes,
// so every client paints the same house; free to change. Online alone.

/** The parts of a house's outside an owner paints. */
export const HOME_LOOK_PARTS = Object.freeze(['walls', 'windows', 'roof', 'door']);
/** The climates a part may wear - Daggerfall's climate bases (world/climateSwaps.js BASE). */
export const HOME_LOOK_CLIMATES = Object.freeze({ desert: 0, mountain: 100, temperate: 300, swamp: 400 });
/** The building sets walls and windows may wear - Daggerfall's exterior building families, whose records share one
 *  order (record 3 is each one's window: ClimateSwaps.IsExteriorWindow). */
export const HOME_LOOK_SETS = Object.freeze({ castle: 9, cityA: 12, cityB: 14, farm: 26, magesGuild: 35, manor: 38, merchant: 42, tavern: 58, temple: 61, village: 64 });
/** What each is called in the painter. */
export const HOME_LOOK_SET_NAMES = Object.freeze({ castle: 'Castle', cityA: 'City stone', cityB: 'City plaster', farm: 'Farmhouse', magesGuild: 'Mages Guild', manor: 'Manor', merchant: 'Merchant', tavern: 'Tavern', temple: 'Temple', village: 'Village' });
export const HOME_LOOK_CLIMATE_NAMES = Object.freeze({ desert: 'Desert', mountain: 'Mountain', temperate: 'Temperate', swamp: 'Swamp' });
export const HOME_LOOK_PART_NAMES = Object.freeze({ walls: 'Walls', windows: 'Windows', roof: 'Roof', door: 'Door' });
/** The most records a roof's or a door's family is chosen among (the archives hold fewer; the client prunes a record
 *  its archive lacks, and that part wears the town's own). */
export const HOME_LOOK_RECORD_MAX = 15;
/** The door family's record Daggerfall never swaps (the frame's tapestry - ClimateSwaps.ApplyClimate), never chosen. */
export const HOME_LOOK_DOOR_KEPT = 3;

const lookClimateOk = (v) => typeof v === 'string' && Object.hasOwn(HOME_LOOK_CLIMATES, v);
const lookSetOk = (v) => typeof v === 'string' && Object.hasOwn(HOME_LOOK_SETS, v);
const lookRecordOk = (v, part) => Number.isSafeInteger(v) && v >= 0 && v <= HOME_LOOK_RECORD_MAX && !(part === 'door' && v === HOME_LOOK_DOOR_KEPT);

/**
 * A LOOK, projected - `{ walls?: { set, climate }, windows?: { set, climate }, roof?: { climate, record },
 * door?: { climate, record } }`, the parts changed alone, in the parts' order - or null: no part changed (the town's
 * own), or a part the law refuses (a look is refused whole, never half kept). Text is parsed.
 */
export function homeLookOf(raw) {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const [k, c] of Object.entries(v)) {
    if (!HOME_LOOK_PARTS.includes(k)) return null;
    if (c == null) continue;
    if (typeof c !== 'object') return null;
    if (k === 'walls' || k === 'windows') {
      if (!lookSetOk(c.set) || !lookClimateOk(c.climate)) return null;
      out[k] = { set: c.set, climate: c.climate };
    } else {
      if (!lookClimateOk(c.climate) || !lookRecordOk(c.record, k)) return null;
      out[k] = { climate: c.climate, record: c.record };
    }
  }
  const ordered = {};
  for (const k of HOME_LOOK_PARTS) if (out[k]) ordered[k] = out[k];
  return Object.keys(ordered).length ? ordered : null;
}
/** A look as one string - what a drawn house was painted with, compared to what it should be. */
export const homeLookSig = (look) => (look ? JSON.stringify(homeLookOf(look)) : '');
