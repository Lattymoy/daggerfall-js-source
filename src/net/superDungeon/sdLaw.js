// @ts-check
// SD1 (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most.
// Only one can be active at a time." ... "The Super dungeon collapses when the feat is done."): THE SUPER DUNGEON'S
// LAW - its slot, its record's life, where it rises, its name, its room. Design: bible/11-Multiplayer/Super-Dungeons.md
// sections 2-4.
//
// THE RECORD IS THE HUB'S. One Super dungeon stands at a time, so the world channel (`chat:world`, the room every
// online tab holds) keeps ONE record of it - `sdev` - and its director (server/src/index.js) moves it on: it RISES
// where the census finds the most players (pickSdRegion), is FOUND by the first player at its door, FALLS when its
// boss does, and is GONE three minutes later - or fades unbeaten when its time runs out - and the next rises after a
// rest (SD-THROUGH: between the find and the fall it is ENTERED, once, when its first soul steps through the Rift -
// sdEnter). Every change is fanned to every tab, which places the Hollow from its own map files (systems/superDungeon/sdSite.js): the
// relay never knows the pixel, and needs not.
//
// PURE, and the relay's too: it imports wire.js and gateLaw.js (the port's one mix, gateHash, and a pixel's side), both
// already the relay's. The record's law is one function per move, so the hub and every client agree on what each
// phase means without either trusting the other's clock: phases are derived from the record's own instants. The
// record's projection (validSdRecord) is the wire's, beside the frame that carries it (SD3) - re-exported here.
//
// Not a DFU member: Daggerfall has no other players and no world events. Ledger A (SUPER-DUNGEONS).
import { sanitizeName, PIXEL_UNITS, SD_REGION_COUNT, SD_SLOT_MAX, SD_FIGHTERS_MAX, SD_LANE_SPAN, sdLaneWire, sdLaneOpen, sdLaneRegionOk, SITE_EVENT_LANES, CHAT_BAY_REGIONS, sharedClassicMinutes, wallMsForClassicMinutes } from '../wire.js';
import { gateHash, PIXEL_M } from '../gate/gateLaw.js';
import { frontDayOfMinute, frontNextDay, FRONT_DAY_MINUTES, FRONT_PER_DAY } from '../frontLaw.js';   // FRONTS: a province's Hollow rises on its turn alone

export { SD_PHASES, SD_REGION_COUNT, SD_SLOT_MAX, SD_FIGHTERS_MAX, validSdRecord, SD_LANE_SPAN, sdLaneOpen, sdLaneRegionOk } from '../wire.js';

// ═══ WW5: A HOLLOW IN EVERY THEATRE ═══════════════════════════════════
//
// (bible/03-World/World-Wide.md WW5, the owner's call taken: "Every single thing here needs to be addressed. No
// exceptions.") One Hollow stands at a time IN EACH THEATRE that keeps one (net/wire.js SITE_EVENT_LANES - the Bay's, the
// eight provinces'; Cyrodiil's open zone none): a LANE a theatre, each its own director's record, its own census, its own
// rest. A slot names its lane (lane `t`'s are t * SD_LANE_SPAN + 1, + 2 ...: the Bay's the 1, 2, 3 they always were), so
// a slot is still one Hollow's whole identity everywhere it is read.
/** The lane slot `s` is on (net/wire.js sdLaneWire). */
export const sdLaneOf = (s) => sdLaneWire(s);
/** The lanes the hub keeps a Hollow on. */
export const SD_LANES = SITE_EVENT_LANES;
/** The census's regions a lane's Hollow may rise in: the Bay's 62 (all but SD_TOWNLESS_REGIONS), a province's one. */
export const sdLaneRegions = (lane) => (lane === 0 ? Array.from({ length: CHAT_BAY_REGIONS }, (_, r) => r) : sdLaneOpen(lane) ? [CHAT_BAY_REGIONS - 1 + lane] : []);

/** How long a Hollow stands unbeaten before it fades, real ms (two days). */
export const SD_LIFETIME_MS = 48 * 3600 * 1000;
/** How long the realm and the Hollow stand after the kill - the spoils taken, the way home walked - real ms. */
export const SD_COLLAPSE_MS = 3 * 60 * 1000;
/** The rest between one Hollow's end and the next one's rise, real ms. */
export const SD_COOLDOWN_MS = 2 * 3600 * 1000;
/** A hub with no record waits this long before the first rise - a fresh deploy does not raise one the instant it wakes. */
export const SD_FIRST_RISE_MS = 10 * 60 * 1000;
/** AUDIT SD II (L3 F4): how long past a found, unbeaten Hollow's `until` the hub waits before it says the fade - three of a
 *  realm's tells of a fall (wire.js SD_TELL_RETRY_MS), so a kill landed in the Hour's last seconds, still being told, is
 *  heard as the kill it was and not overtaken by "unbroken". Every client reads the fade from `until` itself; this is
 *  the hub's word alone. */
export const SD_FADE_GRACE_MS = 15_000;
/** A region needs this many distinct verified accounts in it for the census to choose it. */
export const SD_CENSUS_MIN = 2;
/** SD-SEA (FIELD BUGS 2026-10-20b, bible/01-Overview/bugs/Field-Bugs-2026-10-20b.md): THE REGIONS NO HOLLOW CAN RISE IN -
 *  those MAPS.BSA gives no city, town or village to rise by (systems/superDungeon/sdSite.js sdCities finds none), by index,
 *  which the census never chooses. 31 is the sea's: formats/mapsFile.js getRegionIndexAt reads politic 64 - every water
 *  pixel of the Bay and the ocean, PlayerGPS.cs's own law - as High Rock sea coast, so every player aboard a ship stands
 *  in its channel, and a crowd at sea raised a Hollow that stood by no city on any client. Cybiades (61) has one place
 *  and no town; the rest have no place at all. The relay holds no map files, so the list is written here and pinned
 *  against them (test/net/superDungeon/fb1020b_sdsea.test.js). */
export const SD_TOWNLESS_REGIONS = Object.freeze([2, 3, 4, 6, 7, 8, 10, 12, 13, 14, 15, 24, 25, 27, 28, 29, 30, 31, 61]);
const TOWNLESS = new Set(SD_TOWNLESS_REGIONS);
/** The one salt every client and the relay roll a Hollow's choices with. */
export const SD_SALT = 0x5d01;
/** How near its pixel's centre a finder must stand for the relay to believe the find, metres (a spawned dungeon stands
 *  centred in its pixel - world/spawnedDungeons.js spawnedLocationCentreLocal - and its mouth within a block of it). */
export const SD_FOUND_RADIUS_M = 160;
/** How near the Hollow's door a player stands to FIND it, metres (the client's own test - section 4), and how often a
 *  finder says it again while the record still says `risen` (a word the relay or the hub did not take). */
export const SD_FOUND_NEAR_M = 25;
export const SD_FOUND_RESEND_MS = 15_000;

/** @typedef {import('../wire.js').SdRecord} SdRecord */

/**
 * Where a record's Hollow stands in its life at `now` - its own word, until its time runs out: 'gone' once it faded
 * unbeaten (`until`) or collapsed after the kill (`fellAt` + SD_COLLAPSE_MS). Slot 0, or no record: 'gone'.
 * @param {SdRecord|null|undefined} rec
 * @param {number} now relay clock
 */
export function sdPhase(rec, now) {
  if (!rec || !rec.s || rec.ph === 'gone') return 'gone';
  if (rec.fellAt != null) return now < rec.fellAt + SD_COLLAPSE_MS ? 'fell' : 'gone';
  return now < rec.until ? rec.ph : 'gone';
}
/** Does the Hollow stand in the world in this phase (drawn, entered, looked at)? */
export const sdStands = (phase) => phase === 'risen' || phase === 'found' || phase === 'fell';
/** Is it on the map for everyone (found, and not yet gone)? Before it is found it is a find; after, it is news. */
export const sdMarked = (phase) => phase === 'found' || phase === 'fell';
/** May a fighter enter the Shattered Hour now - found, its boss standing? */
export const sdAdmits = (rec, now) => sdPhase(rec, now) === 'found';
/** May a fighter already in the Hour stay (a reconnect after a blip, the spoils after the kill)? Until it is gone. */
export const sdHolds = (rec, now) => { const p = sdPhase(rec, now); return p === 'found' || p === 'fell'; };

// ═══ THE DIRECTOR'S MOVES ═════════════════════════════════════════════
//
// One function per move, each refusing a move its phase does not allow - the hub calls them and stores what comes
// back; a null is "not now", never an error.

// FRONTS (bible/03-World/World-Wide.md FRONTS): a province's Hollow rises only on its province's turn (net/frontLaw.js),
// and no more than SD_FRONT_HOLLOWS stand past the Bay at once - a Hollow stands two real days, so a turn alone would still
// keep one in every province. The Bay's rises as before. The hub hands the count (`held`) off its lanes' records.
/** FRONTS: the Hollows that stand past the Bay at once, at most - a day's fronts' worth. */
export const SD_FRONT_HOLLOWS = FRONT_PER_DAY;
/** FRONTS: the first instant from `now` on at which lane `lane` may raise a Hollow - `now` itself on its turn, and always
 *  on the Bay's lane. @param {number} now @param {number} lane */
export function sdFrontFrom(now, lane) {
  const day = frontDayOfMinute(sharedClassicMinutes(now)), next = frontNextDay(day, lane);
  return next === day ? now : Math.ceil(wallMsForClassicMinutes(next * FRONT_DAY_MINUTES)) + 1;
}
/** FRONTS: the Hollows standing past the Bay at `now` on a lane other than `lane` (`recs`, every lane's record).
 *  @param {ReadonlyArray<SdRecord|null|undefined>} recs @param {number} now @param {number} lane */
export const sdHeldPast = (recs, now, lane) => sdStandingPast(recs, now, lane).length;
const sdStandingPast = (recs, now, lane) => (recs ?? []).filter((r) => r && sdLaneOf(r.s) > 0 && sdLaneOf(r.s) !== lane && sdStands(sdPhase(r, now)));
/** FRONTS: may lane `lane` raise a Hollow at `now`, with `held` standing past the Bay elsewhere? */
const sdFrontMay = (now, lane, held) => sdFrontFrom(now, lane) <= now && (lane === 0 || held < SD_FRONT_HOLLOWS);
/** AUDIT FRONTS A1, B1: the earliest a record's lane may raise its next Hollow, from `now` on - its rest, its turn and a
 *  free place past the Bay among `recs` (every lane's record). A bound, never a promise: a turn can pass with nothing risen.
 *  @param {SdRecord} rec @param {number} now @param {ReadonlyArray<SdRecord|null|undefined>} recs */
export function sdRiseNotBefore(rec, now, recs) {
  const lane = sdLaneOf(rec.s);
  let t = Math.max(rec.next, now);
  for (let step = 0; lane > 0 && step < 16; step++) {
    t = sdFrontFrom(t, lane);
    const standing = sdStandingPast(recs, t, lane);
    if (standing.length < SD_FRONT_HOLLOWS) return t;
    t = Math.min(...standing.map((r) => (r.fellAt != null ? r.fellAt + SD_COLLAPSE_MS : r.until)));
  }
  return t;
}
/** AUDIT FRONTS A2: the order the director beats its lanes in - the Bay's, then the provinces whose last Hollow rose
 *  longest ago (none yet first), so a place freed past the Bay goes to the province that waited, not the lowest lane. */
export const sdBeatOrder = (recs) => [0, ...SD_LANES.filter((l) => l > 0).sort((a, b) => sdLastRise(recs, a) - sdLastRise(recs, b) || a - b)];
const sdLastRise = (recs, lane) => { const r = (recs ?? []).find((x) => x && sdLaneOf(x.s) === lane); return r && r.s % SD_LANE_SPAN ? r.at : -Infinity; };

/** The hub's first beat: nothing has risen, the first rise SD_FIRST_RISE_MS on. WW5: a lane's own - its zero slot. */
export const sdFirst = (now, lane = 0) => /** @type {SdRecord} */ ({ s: lane * SD_LANE_SPAN, ph: 'gone', r: -1, at: now, until: now, next: now + SD_FIRST_RISE_MS });

/** A new Hollow rises - the next slot, in the census's region (-1: the Bay's great cities). Null while the last stands
 *  or rests. WW5: on the lane `prev` is (`lane` for a lane with no record yet) - its next slot in its own span, a region
 *  its own (net/wire.js sdLaneRegionOk: a province's Hollow rises in its province, or by its great cities). */
export function sdRise(prev, now, region, lane = prev ? sdLaneOf(prev.s) : 0, held = 0) {
  if (prev && (sdPhase(prev, now) !== 'gone' || now < prev.next)) return null;
  if (!sdLaneOpen(lane) || (prev && sdLaneOf(prev.s) !== lane)) return null;
  if (!sdFrontMay(now, lane, held)) return null;   // FRONTS: off its province's turn, or the provinces' Hollows all stand
  if (!Number.isSafeInteger(region) || region < -1 || region >= SD_REGION_COUNT || !sdLaneRegionOk(lane, region)) return null;
  const s = (prev?.s ?? lane * SD_LANE_SPAN) + 1;
  if (s > SD_SLOT_MAX || sdLaneOf(s) !== lane) return null;
  return /** @type {SdRecord} */ ({ s, ph: 'risen', r: region, at: now, until: now + SD_LIFETIME_MS, next: now + SD_LIFETIME_MS + SD_COOLDOWN_MS });
}

/** Found - by `name`, at `now` - while it has risen and no one has found it. */
export function sdFind(rec, now, name) {
  if (!rec || sdPhase(rec, now) !== 'risen') return null;
  return /** @type {SdRecord} */ ({ ...rec, ph: 'found', foundAt: now, fb: sanitizeName(name) });
}

/** SD-THROUGH (2026-10-21, the owner: "When someone finds and enters the portal. I want a portal to show up for anyone in
 *  the dungeon and anyone entering that automatically leads them there."): the first soul through its Rift - stamped
 *  once, at `now`, while it is found and its boss stands (its realm's first admission, told to the hub). From then on
 *  every client in its Hollow, and every one entering it, stands the Way Through beside them
 *  (world/superDungeon/sdDungeon.js sdThroughStands). */
export function sdEnter(rec, now) {
  if (!rec || sdPhase(rec, now) !== 'found' || rec.inAt != null) return null;
  return /** @type {SdRecord} */ ({ ...rec, inAt: now });
}

/** The boss fell: kept with the top fighter's name and how many fought it (`n` - every seat its fight took, the realm's
 *  `fell.n`: the gone and the cast-out with the rest); the collapse, then the rest, from now. */
export function sdFell(rec, now, { top = '', n = 0 } = {}) {
  if (!rec || sdPhase(rec, now) !== 'found') return null;
  const count = Number.isSafeInteger(n) ? Math.max(0, Math.min(SD_FIGHTERS_MAX, n)) : 0;
  return /** @type {SdRecord} */ ({ ...rec, ph: 'fell', fellAt: now, top: sanitizeName(top), n: count, next: now + SD_COLLAPSE_MS + SD_COOLDOWN_MS });
}

/** Its time has run: the record says gone (it already IS gone by sdPhase; this is the word the hub fans). */
export function sdGone(rec, now) {
  if (!rec || !rec.s || rec.ph === 'gone' || sdPhase(rec, now) !== 'gone') return null;
  return /** @type {SdRecord} */ ({ ...rec, ph: 'gone' });
}

/**
 * What the director does at `now`: `first` (no record), `gone` (its time ran - fan it), `rise` (the rest is over - take
 * the census), or nothing until `at`.
 * @param {SdRecord|null|undefined} rec
 * @param {number} now
 * @param {number} [held] FRONTS: the Hollows standing past the Bay on the other lanes (sdHeldPast)
 * @returns {{ act: 'first'|'gone'|'rise'|null, at?: number }}
 */
export function sdDue(rec, now, held = 0) {
  if (!rec) return { act: 'first' };
  const p = sdPhase(rec, now);
  // AUDIT SD II (L3 F4): a FOUND Hollow's fade waits SD_FADE_GRACE_MS past its `until` - a fall told meanwhile wins (one
  // never found has no realm, and no fight to fall)
  if (p === 'gone' && rec.ph === 'found' && now < rec.until + SD_FADE_GRACE_MS) return { act: null, at: rec.until + SD_FADE_GRACE_MS };
  if (p === 'gone' && rec.ph !== 'gone' && rec.s) return { act: 'gone' };
  if (p === 'gone' && now < rec.next) return { act: null, at: rec.next };
  if (p === 'gone') {
    // FRONTS: a province's rise waits for its turn - and, all the provinces' Hollows standing, for one of them to end
    // (their own moves wake the hub then)
    const lane = sdLaneOf(rec.s), from = sdFrontFrom(now, lane);
    if (from > now) return { act: null, at: from };
    return sdFrontMay(now, lane, held) ? { act: 'rise' } : { act: null };
  }
  return { act: null, at: rec.fellAt != null ? rec.fellAt + SD_COLLAPSE_MS : rec.until };
}

// ═══ THE ROLLS ════════════════════════════════════════════════════════

/** Roll `k` of slot `s`, a whole number in [0, 2^32) - the gate's own mix, its own salt. */
export const sdRoll = (s, k) => gateHash(SD_SALT, s, k);

/**
 * THE CENSUS'S REGION: of the regions holding at least SD_CENSUS_MIN distinct verified accounts (`counts[r]`), the
 * fullest - ties broken by the slot's roll, and the last Hollow's region (`last`) resting while another qualifies, so
 * one crowd does not keep every Hollow. SD-SEA: never a region with no town to rise by (SD_TOWNLESS_REGIONS - the
 * sea's most of all). -1 when none qualifies: the Bay's great cities. WW5: the slot's LANE's regions alone (sdLaneRegions
 * - a crowd in Skyrim draws Skyrim's Hollow, never the Bay's), -1 its own great cities.
 * @param {number} s the slot about to rise
 * @param {ArrayLike<number>} counts by region index (every region of the world's, SD_REGION_COUNT)
 * @param {number} [last]
 */
export function pickSdRegion(s, counts, last = -1) {
  const qual = [];
  for (const r of sdLaneRegions(sdLaneOf(s))) if (Number(counts?.[r] ?? 0) >= SD_CENSUS_MIN && !TOWNLESS.has(r)) qual.push(r);
  const pool = qual.length > 1 ? qual.filter((r) => r !== last) : qual;
  if (!pool.length) return -1;
  const top = Math.max(...pool.map((r) => Number(counts[r])));
  const best = pool.filter((r) => Number(counts[r]) === top);
  return best[sdRoll(s, 1) % best.length];
}

/** A pixel's side in world units, and the find's radius in them (40 world units to the metre). */
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
/**
 * Does a pose (MapsFile's world frame, the cell's) stand within SD_FOUND_RADIUS_M of the claimed pixel's centre - where a
 * spawned dungeon stands? The cell asks it of its socket's own pose before it troubles the hub (SD3); the hub asks it
 * again with its record (sdFindBelieved).
 * @param {{ px:number, py:number }} claim
 * @param {{ x:number, z:number }} pose
 */
export function sdNearSite(claim, pose) {
  if (!Number.isSafeInteger(claim?.px) || !Number.isSafeInteger(claim?.py) || !Number.isFinite(pose?.x) || !Number.isFinite(pose?.z)) return false;
  // MapsFile's frame: x east from the map's west edge, z north from its SOUTH edge (pixel row py spans the z band
  // whose top is (500 - py) pixels up) - the pose's own law, wire.js pixelOf
  const cx = (claim.px + 0.5) * PIXEL_UNITS, cz = (500 - claim.py - 0.5) * PIXEL_UNITS;
  return Math.hypot(pose.x - cx, pose.z - cz) <= SD_FOUND_RADIUS_M * UNITS_PER_M;
}
/**
 * May the relay believe a find - a pose near the claimed pixel's centre (sdNearSite), for the record's slot while it has
 * risen. It cannot tell a true site from a false one (it has no map data), and could not stop a forger if it could: every
 * client places the Hollow itself, so a script stands its pose at the true door as easily as at a false one. A forged
 * find never places the Hollow anywhere, but it says "found" - and opens the realm - as early as the rise itself (AUDIT
 * SD II, L7 H1: this said "a little early"). What bounds a forger past it is the fight's numbers, as at the gate
 * (Super-Dungeons.md section 4).
 * @param {SdRecord|null|undefined} rec
 * @param {number} now
 * @param {{ s:number, px:number, py:number }} claim
 * @param {{ x:number, z:number }} pose
 */
export function sdFindBelieved(rec, now, claim, pose) {
  if (!rec || sdPhase(rec, now) !== 'risen' || claim?.s !== rec.s) return false;
  return sdNearSite(claim, pose);
}

// ═══ THE NAME ═════════════════════════════════════════════════════════

/** What a Hollow is called - by its slot's roll; `{city}` is the city it stands by (Super-Dungeons.md section 5). */
export const SD_NAMES = Object.freeze([
  'The Brass Hollow', 'The Stopped Bell', 'The Unwound Halls', 'The Clockless Deep', 'The Hour\'s Wound',
  'The Splintered Keep', 'The Last Bell of {city}', 'The Hollow Under {city}',
]);
/** A slot's name, with its city (or none - then the name that needs a city falls back to the first of the bare ones). */
export function sdNameOf(s, city = '') {
  const name = SD_NAMES[sdRoll(s, 2) % SD_NAMES.length];
  if (!name.includes('{city}')) return name;
  return city ? name.replace('{city}', () => city) : SD_NAMES[0];   // AUDIT SD II (L4 C6): a replacer - a name's `$&` is a name
}

// ═══ THE ROOM ═════════════════════════════════════════════════════════
//
// SD-PARTY (2026-10-28, the owner: "we need to make this a party instance"): ONE room per slot AND party, `sd:<s>.<owner>`,
// the owner the party's account digest (net/instanceRoom.js instanceOwnerOf - the Ketch's crew law); its door the owner,
// staff and the owner's party (server/src/sdCopy.js). SD-SOLO ("if no one is in a party allow them to be put into a 8
// player instance"): owner `p<n>`, a shared Hour of SD_PUB_SEATS, the next opened when it is full or won.
const SD_ROOM = /^sd:([1-9]\d{0,8})\.([0-9a-f]{16}|p(?:0|[1-9]\d?))$/;
const SD_OWNER = /^(?:[0-9a-f]{16}|p(?:0|[1-9]\d?))$/;
export const SD_PUB_SEATS = 40;   // SD-SOLO-40 (2026-10-28, the owner: "lets up the amount in a non party to 40")
export const SD_PUB_MAX = 64;
/** SD-SOLO: the shared Hour `n`'s owner, or null. @param {number} n */
export const sdPubOwner = (n) => (Number.isSafeInteger(n) && n >= 0 && n < SD_PUB_MAX ? `p${n}` : null);
export const isSdPubOwner = (o) => typeof o === 'string' && /^p(?:0|[1-9]\d?)$/.test(o) && Number(o.slice(1)) < SD_PUB_MAX;
/** @param {number} s @param {string} owner */
export const sdRoomKey = (s, owner) => (Number.isSafeInteger(s) && s > 0 && typeof owner === 'string' && SD_OWNER.test(owner) && (owner[0] !== 'p' || isSdPubOwner(owner)) ? `sd:${s}.${owner}` : null);
export const isSdRoom = (key) => { const m = SD_ROOM.exec(String(key ?? '')); return !!m && (m[2][0] !== 'p' || isSdPubOwner(m[2])); };
/** The slot a realm room is for, or null. */
export const sdSlotOfRoom = (key) => { const m = SD_ROOM.exec(String(key ?? '')); return m ? Number(m[1]) : null; };
/** SD-PARTY: the owner's digest a realm room is for, or null. */
export const sdOwnerOfRoom = (key) => SD_ROOM.exec(String(key ?? ''))?.[2] ?? null;

// ═══ THE WORDS ════════════════════════════════════════════════════════
//
// What the chat says at a Hollow's moments - each client says its own off the fanned record. A Hollow's rise is said
// to nobody: it is a find.
/** AUDIT SD III (T19): WHERE AN ABYSS DUNGEON STANDS, in a line: near its city, else in its region (*in the Alik'r
 *  Desert region* - it read *near Alik'r Desert*), else near the Bay. Pure. */
/** The Bay's own name in a line, its one home (sdWhere's, and the herald's rise - net/superDungeon/sdHerald.js). */
export const SD_BAY_NAME = 'the Iliac Bay';
export const sdWhere = (near, region = '', province = '') => (near ? `near ${near}` : region ? `in the ${region} region` : province ? 'in ' + province : 'near ' + SD_BAY_NAME);   // WW5: a province's Hollow is in its province (`province` - its name)
export const sdFoundLine = ({ who, near, region, province = '' }) => `${who} has found an Abyss Dungeon ${sdWhere(near, region, province)}!`;   // ABYSS-NAME (Mac: "lets rename Super Dungeons to Abyss Dungeons"): the player's word; the code's stays `super`
/** AUDIT SD II (L6 F20): a Hollow's name inside a sentence - its article small ("in the Brass Hollow"), as the Orrery's
 *  stones store theirs (net/superDungeon/sdBrain.js). */
export const sdNameIn = (name) => String(name ?? '').replace(/^The /, 'the ');
export const sdFellLine = ({ top, n, name }) => (n > 1 ? `${top} and ${n - 1} ${n === 2 ? 'other' : 'others'} broke the Hour in ${sdNameIn(name)}. It collapses.` : `${top} broke the Hour in ${sdNameIn(name)}. It collapses.`);
export const sdFadeLine = ({ name }) => `The Hour closes over ${sdNameIn(name)}, unbroken.`;
export const SD_CAST_OUT_LINE = 'The Hour closes, and the Abyss Dungeon folds in on itself behind you.';   // AUDIT SD III (T15): the player's word for it (ABYSS-NAME) - it said "the Hollow"
/** The Rift's refusals (section 6) - said by the realm's room at a hello it will not admit, and by the client's own Rift
 *  before it asks: not yet found, and the Hour closed (or closing - its boss fallen, a newcomer is not let in). */
export const SD_NO_RIFT = 'The Rift will not take you yet.';
export const SD_NO_CLOSED = 'The Hour has closed.';
/** And the realm's seats every one taken (SD_FIGHTERS_MAX accounts have entered it). */
export const SD_NO_FULL = 'The Hour is full.';
/** SD-ONELIFE (2026-10-07, Mac: "A death within the rift casts you out and youre unable to re enter. You get one life to
 *  prove your worth"): the Hour refuses an account that died in it - one life a Hollow. */
export const SD_NO_FALLEN = 'The Hour will not take you back.';
/**
 * SD-REZ (EVENT-RULES, 2026-10-25, the owner: "Resurrect allowed" in the Hour, the Spire and the Ketch): ONE LIFE, UNLESS A
 * FRIEND CALLS IT BACK. A death in the Hour no longer marks its account dead at once: the realm keeps it DOWN (`down`,
 * `[sub, at, x?, z?]` - where it fell, the realm's metres, when its dying pose said) for SD_REZ_MS. AUDIT WORLD-EVENTS L1-1:
 * THE RAISE IS THE REALM'S TO RECORD - a living fighter of the realm casting Resurrect at the body says so to the realm
 * (`rz`, sdMayRaise: within SD_REZ_REACH_M of where it fell), kept in `raised` (`[sub, at]`), and only a down account the
 * realm recorded raised rises at its hello; one it did not is not let in yet (its page asks again) - any hello inside the
 * window was a rise, so a second device or a cleared store walked back into the Hour with nobody's Resurrect. Past the
 * window, or once the fallen gives the death up (the death screen's way out casts them out of the Hour, and the page never
 * asks again), the death is the Hollow's for good: SD_NO_FALLEN as before.
 * AUDIT WORLD-EVENTS L1-5: the window is the body's own minute - the page's (a friend's screen keeps a body CORPSE_MS, net/
 * remotePlayers.js; the death screen stands ONLINE_RESPAWN_SECONDS, ui/deathScreen.js: both 60 s) and the page's slack for
 * its hello after it (systems/superDungeon/sdSlots.js SD_REZ_PAGE_SLACK_MS) - where it said two minutes the body was gone
 * at one, and the relay's second minute served only the walk-back above. Pinned equal in test/net/superDungeon.
 */
export const SD_REZ_MS = 70_000;
/** AUDIT WORLD-EVENTS L1-1: how near where a body fell its raiser stands when the realm records the raise (m) - RESURRECT's
 *  touch (systems/resurrect.js RESURRECT_REACH, 6 m), with a pose's lag. */
export const SD_REZ_REACH_M = 10;
/**
 * A realm's word on an account (the realm's record `{ dead, down, raised }`): 'fallen' (dead for good, or down past the
 * window), 'rise' (down inside it, and raised since it fell), 'down' (down inside it, raised by nobody yet - AUDIT
 * WORLD-EVENTS L1-1), or null (neither). Pure.
 * @param {{ dead: string[], down?: Array<[string, number, number?, number?]>, raised?: [string, number][] }} realm @param {string} sub @param {number} now
 * @returns {'fallen'|'rise'|'down'|null}
 */
export function sdDownWord(realm, sub, now) {
  if (realm.dead.includes(sub)) return 'fallen';
  const d = (realm.down ?? []).find(([x]) => x === sub);
  if (!d) return null;
  if (now - d[1] > SD_REZ_MS) return 'fallen';
  return (realm.raised ?? []).some(([x, at]) => x === sub && at >= d[1]) ? 'rise' : 'down';
}
/**
 * AUDIT WORLD-EVENTS L1-1: MAY `caster` RAISE `to` in this realm now - the caster a fighter of it (admitted, neither down nor
 * dead), the body down inside its window, and (where its fall said where) the caster within SD_REZ_REACH_M of it (`at`,
 * the caster's own pose in the realm's metres - [x, y, z]). Pure.
 * @param {{ in: string[], dead: string[], down?: Array<[string, number, number?, number?]> }} realm
 * @param {string} caster @param {string} to @param {number} now @param {number[]|null} [at]
 */
export function sdMayRaise(realm, caster, to, now, at = null) {
  if (!caster || !to || caster === to || !realm.in.includes(caster) || realm.dead.includes(caster) || (realm.down ?? []).some(([x]) => x === caster)) return false;
  const d = (realm.down ?? []).find(([x]) => x === to);
  if (!d || now - d[1] > SD_REZ_MS) return false;
  return !(Array.isArray(at) && Number.isFinite(d[2]) && Number.isFinite(d[3]) && Math.hypot(at[0] - d[2], at[2] - d[3]) > SD_REZ_REACH_M);
}
