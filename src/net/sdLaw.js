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
// rest. Every change is fanned to every tab, which places the Hollow from its own map files (systems/sdSite.js): the
// relay never knows the pixel, and needs not.
//
// PURE, and the relay's too: it imports wire.js and gateLaw.js (the port's one mix, gateHash, and a pixel's side), both
// already the relay's. The record's law is one function per move, so the hub and every client agree on what each
// phase means without either trusting the other's clock: phases are derived from the record's own instants. The
// record's projection (validSdRecord) is the wire's, beside the frame that carries it (SD3) - re-exported here.
//
// Not a DFU member: Daggerfall has no other players and no world events. Ledger A (SUPER-DUNGEONS).
import { sanitizeName, PIXEL_UNITS, SD_REGION_COUNT, SD_SLOT_MAX, SD_FIGHTERS_MAX } from './wire.js';
import { gateHash, PIXEL_M } from './gateLaw.js';

export { SD_PHASES, SD_REGION_COUNT, SD_SLOT_MAX, SD_FIGHTERS_MAX, validSdRecord } from './wire.js';

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
/** The one salt every client and the relay roll a Hollow's choices with. */
export const SD_SALT = 0x5d01;
/** How near its pixel's centre a finder must stand for the relay to believe the find, metres (a spawned dungeon stands
 *  centred in its pixel - world/spawnedDungeons.js spawnedLocationCentreLocal - and its mouth within a block of it). */
export const SD_FOUND_RADIUS_M = 160;
/** How near the Hollow's door a player stands to FIND it, metres (the client's own test - section 4), and how often a
 *  finder says it again while the record still says `risen` (a word the relay or the hub did not take). */
export const SD_FOUND_NEAR_M = 25;
export const SD_FOUND_RESEND_MS = 15_000;

/** @typedef {import('./wire.js').SdRecord} SdRecord */

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

/** The hub's first beat: nothing has risen, the first rise SD_FIRST_RISE_MS on. */
export const sdFirst = (now) => /** @type {SdRecord} */ ({ s: 0, ph: 'gone', r: -1, at: now, until: now, next: now + SD_FIRST_RISE_MS });

/** A new Hollow rises - the next slot, in the census's region (-1: the Bay's great cities). Null while the last stands
 *  or rests. */
export function sdRise(prev, now, region) {
  if (prev && (sdPhase(prev, now) !== 'gone' || now < prev.next)) return null;
  if (!Number.isSafeInteger(region) || region < -1 || region >= SD_REGION_COUNT) return null;
  const s = (prev?.s ?? 0) + 1;
  if (s > SD_SLOT_MAX) return null;
  return /** @type {SdRecord} */ ({ s, ph: 'risen', r: region, at: now, until: now + SD_LIFETIME_MS, next: now + SD_LIFETIME_MS + SD_COOLDOWN_MS });
}

/** Found - by `name`, at `now` - while it has risen and no one has found it. */
export function sdFind(rec, now, name) {
  if (!rec || sdPhase(rec, now) !== 'risen') return null;
  return /** @type {SdRecord} */ ({ ...rec, ph: 'found', foundAt: now, fb: sanitizeName(name) });
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
 * @returns {{ act: 'first'|'gone'|'rise'|null, at?: number }}
 */
export function sdDue(rec, now) {
  if (!rec) return { act: 'first' };
  const p = sdPhase(rec, now);
  // AUDIT SD II (L3 F4): a FOUND Hollow's fade waits SD_FADE_GRACE_MS past its `until` - a fall told meanwhile wins (one
  // never found has no realm, and no fight to fall)
  if (p === 'gone' && rec.ph === 'found' && now < rec.until + SD_FADE_GRACE_MS) return { act: null, at: rec.until + SD_FADE_GRACE_MS };
  if (p === 'gone' && rec.ph !== 'gone' && rec.s) return { act: 'gone' };
  if (p === 'gone') return now >= rec.next ? { act: 'rise' } : { act: null, at: rec.next };
  return { act: null, at: rec.fellAt != null ? rec.fellAt + SD_COLLAPSE_MS : rec.until };
}

// ═══ THE ROLLS ════════════════════════════════════════════════════════

/** Roll `k` of slot `s`, a whole number in [0, 2^32) - the gate's own mix, its own salt. */
export const sdRoll = (s, k) => gateHash(SD_SALT, s, k);

/**
 * THE CENSUS'S REGION: of the regions holding at least SD_CENSUS_MIN distinct verified accounts (`counts[r]`), the
 * fullest - ties broken by the slot's roll, and the last Hollow's region (`last`) resting while another qualifies, so
 * one crowd does not keep every Hollow. -1 when none qualifies: the Bay's great cities.
 * @param {number} s the slot about to rise
 * @param {ArrayLike<number>} counts by region index
 * @param {number} [last]
 */
export function pickSdRegion(s, counts, last = -1) {
  const qual = [];
  for (let r = 0; r < SD_REGION_COUNT; r++) if (Number(counts?.[r] ?? 0) >= SD_CENSUS_MIN) qual.push(r);
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
// The Shattered Hour is ONE room per slot: `sd:<s>`. No zero, no padding - the wire admits exactly the keys the hub
// mints (AUDIT WORLD6a B4's law), and each Hollow's realm is a fresh object.
const SD_ROOM = /^sd:[1-9]\d{0,8}$/;
/** @param {number} s */
export const sdRoomKey = (s) => `sd:${s}`;
export const isSdRoom = (key) => SD_ROOM.test(String(key ?? ''));
/** The slot a realm room is for, or null. */
export const sdSlotOfRoom = (key) => (isSdRoom(key) ? Number(String(key).slice(3)) : null);

// ═══ THE WORDS ════════════════════════════════════════════════════════
//
// What the chat says at a Hollow's moments - each client says its own off the fanned record. A Hollow's rise is said
// to nobody: it is a find.
/** AUDIT SD III (T19): WHERE AN ABYSS DUNGEON STANDS, in a line: near its city, else in its region (*in the Alik'r
 *  Desert region* - it read *near Alik'r Desert*), else near the Bay. Pure. */
export const sdWhere = (near, region = '') => (near ? `near ${near}` : region ? `in the ${region} region` : 'near the Iliac Bay');
export const sdFoundLine = ({ who, near, region }) => `${who} has found an Abyss Dungeon ${sdWhere(near, region)}!`;   // ABYSS-NAME (Mac: "lets rename Super Dungeons to Abyss Dungeons"): the player's word; the code's stays `super`
/** AUDIT SD II (L6 F20): a Hollow's name inside a sentence - its article small ("in the Brass Hollow"), as the Orrery's
 *  stones store theirs (net/sdBrain.js). */
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
