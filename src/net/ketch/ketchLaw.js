// @ts-check
// KETCH (2026-10-24, the owner: "A new quest line and world event that takes you to the skies with proper lore. A proper
// dwarven airship flies in once a week over the skies of daggerfall, and you, along with other players venture into it
// in a raid like format", then "Make the dwarven event 8 player"; bible/11-Multiplayer/Sky-Ketch.md): THE SKY-KETCH'S
// LAW - when the Rourken sky-ketch Mzunthar keeps station over Daggerfall, whose ship a crew boards, and what each part
// of the voyage is called. Pure, and every end's: the page (its sight, its anchor-lift, its link), the relay (the Worker's
// door and the room's admission) and the account service (a receipt's voyage).
//
// THE VOYAGE, ON THE REAL CLOCK. The Ketch comes every ten real hours (KETCH-EVERY, the owner, 2026-10-24: "Can we make
// this happen every 10 hours. First one to spawn after this goes live" - it was a week, the real Saturday): voyage n
// arrives at KT_EPOCH_MS + n rounds of KT_EVERY_MS - never by the online calendar, which runs twelve game days a real day,
// so no line names a day of Tamriel's week (AUDIT KETCH L5-3: "every Loredas" was false on the game's own calendar). It is SIGHTED KT_SIGHT_MS
// before (a speck in the east, then a shape), keeps station KT_STATION_MS over the fields outside Daggerfall's walls (the
// anchor-lift lowered: boarding), then weighs anchor - no crew boards, the crews aboard have KT_LAST_MS to finish - and
// turns west. One rule for every screen and the relay, so no hub keeps a record: the clock is the record.
//
// A CREW IS A PARTY, ITS SHIP ITS OWN. Every crew sails its own Ketch: a room of its own, `kt:<voyage>.<owner>` - the
// voyage in eight hex, the captain's account digest in sixteen (net/instanceRoom.js instanceOwnerOf, INSTANCES' own),
// the captain the party's leader or a lone player. The relay admits the captain, staff, and a member of the captain's
// party (the hub's word - INSTANCES' partyHoldsOwner); at most KT_CREW_MAX accounts in one ship's crew, and an account
// once of a crew is of it for the voyage (a reload, a death and the anchor-lift again) - until a full ship frees the
// place of one gone from the captain's party, unseen a while, with no part in the fight (ketchBrain.js idlePlaces).
//
// Not a DFU member: Daggerfall has no other players and no airship. Ledger A (KETCH).
import { INSTANCE_OWNER_HEX } from '../instanceRoom.js';

/** KETCH-EVERY: her round - a voyage every ten hours, ms. */
export const KT_EVERY_MS = 10 * 3600 * 1000;
/** Voyage 0's arrival: 2026-10-25, 00:00 UTC - the first after she goes live (KETCH-EVERY). Every voyage after is a round on. */
export const KT_EPOCH_MS = Date.UTC(2026, 9, 25);
/** Sighted this long before it arrives; keeps station this long; the crews aboard have this long after it weighs anchor. */
export const KT_SIGHT_MS = 1 * 3600 * 1000;   // KETCH-EVERY: an hour sighted, seven at station, forty-five minutes more - away an hour and a quarter of every ten
export const KT_STATION_MS = 7 * 3600 * 1000;
export const KT_LAST_MS = 45 * 60 * 1000;   // AUDIT KETCH II L5-1: twenty before - KETCH-LONGER made a voyage some twenty to twenty-five minutes, and a crew boarding at her last minute was shut out with the Warden standing and no receipt
/** The most accounts one ship's crew holds - the party's own bound (net/social PARTY_MAX, pinned equal). */
export const KT_CREW_MAX = 8;
/** The Boarding Watch's waves (KETCH-LONGER, 2026-10-25: three before) - the brain's and the HUD's one number. */
export const KT_WATCH_WAVES = 5;
/** The voyage's hex in a room key, the captain's. */
export const KT_VOYAGE_HEX = 8;
export const KT_OWNER_HEX = INSTANCE_OWNER_HEX;

/** The voyage's phases, in order. 'away' - between voyages. */
export const KT_PHASES = Object.freeze(['away', 'sighted', 'docked', 'departing']);

/**
 * Voyage `n`'s times (relay ms): `sightAt` (first seen), `at` (arrives - boarding opens), `departAt` (weighs anchor -
 * boarding closes), `endAt` (gone: every ship's room shut).
 * @param {number} n
 */
export function ketchVoyageOf(n) {
  const k = Math.max(0, Math.floor(Number(n) || 0)), at = KT_EPOCH_MS + k * KT_EVERY_MS;
  return { n: k, sightAt: at - KT_SIGHT_MS, at, departAt: at + KT_STATION_MS, endAt: at + KT_STATION_MS + KT_LAST_MS };
}

/**
 * THE VOYAGE AT `now`: the one in hand - its number, times and phase - or, between voyages ('away'), the next one's.
 * Pure.
 * @param {number} now relay ms
 * @returns {{ n: number, sightAt: number, at: number, departAt: number, endAt: number, phase: 'away'|'sighted'|'docked'|'departing' }}
 */
export function ketchVoyageAt(now) {
  const t = Number(now);
  if (!Number.isFinite(t)) return { ...ketchVoyageOf(0), phase: 'away' };
  const n = Math.floor((t - (KT_EPOCH_MS - KT_SIGHT_MS)) / KT_EVERY_MS);
  if (n < 0) return { ...ketchVoyageOf(0), phase: 'away' };
  const v = ketchVoyageOf(n);
  if (t >= v.endAt) return { ...ketchVoyageOf(n + 1), phase: 'away' };
  const phase = t < v.at ? 'sighted' : t < v.departAt ? 'docked' : 'departing';
  return { ...v, phase };
}
/** May a crew board voyage `n` at `now` - its anchor-lift lowered? */
export const ketchBoards = (n, now) => { const v = ketchVoyageOf(n); return now >= v.at && now < v.departAt; };
/** Does voyage `n`'s ship still hold its crews at `now` - arrived, and not yet gone? */
export const ketchHolds = (n, now) => { const v = ketchVoyageOf(n); return now >= v.at && now < v.endAt; };

const ROOM_RE = new RegExp(`^kt:([0-9a-f]{${KT_VOYAGE_HEX}})\\.([0-9a-f]{${KT_OWNER_HEX}})$`);
const OWNER_RE = new RegExp(`^[0-9a-f]{${KT_OWNER_HEX}}$`);
/** A crew's ship's room: `kt:<voyage, 8 hex>.<owner digest, 16 hex>` - or null for a voyage or owner that cannot be keyed. */
export function ketchRoomKey(n, owner) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff || typeof owner !== 'string' || !OWNER_RE.test(owner)) return null;
  return `kt:${n.toString(16).padStart(KT_VOYAGE_HEX, '0')}.${owner}`;
}
/** A ship's room's parts - `{ n, owner }` - or null for any other key. */
export function ketchRoomOf(key) {
  const m = typeof key === 'string' ? ROOM_RE.exec(key) : null;
  return m ? { n: parseInt(m[1], 16), owner: m[2] } : null;
}
/** Is this key a ship's room? */
export const isKetchRoom = (key) => ketchRoomOf(key) != null;
/** May the Worker mint `key`'s object at `now` - a ship's room whose voyage holds its crews? */
export const ketchRoomHolds = (key, now) => { const r = ketchRoomOf(key); return !!r && ketchHolds(r.n, now); };

/**
 * THE ROOM'S DOOR - may account `sub` come aboard ship `key` at `now`, as `right` ('owner', 'party', 'staff' - the
 * instance door's answer, net/instanceRoom.js instanceAdmission) with the crew `crew` (the accounts the room has taken)?
 * Null for yes, else the refusal's word: a crew member already taken comes back while the voyage holds; a newcomer only
 * while the anchor-lift is lowered, never as the ninth (staff neither: a hidden spectator watches, taking no place),
 * never without a right.
 * @param {string} key @param {string} sub @param {string|null} right @param {ReadonlyArray<string>} crew @param {number} now
 * @returns {null | 'closed' | 'gone' | 'crew' | 'full'}
 */
export function ketchAdmits(key, sub, right, crew, now) {
  const r = ketchRoomOf(key);
  if (!r || typeof sub !== 'string' || !sub) return 'crew';
  if (!ketchHolds(r.n, now)) return 'gone';
  if (crew.includes(sub)) return null;
  if (!right) return 'crew';
  if (!ketchBoards(r.n, now)) return 'closed';
  if (crew.length >= KT_CREW_MAX) return 'full';   // staff too (AUDIT KETCH L1-4: a ninth broke every page's `st`) - a full ship is watched hidden (STAFF-PANEL5-HIDDEN, _ktHello)
  return null;
}

/** THE STAGES, in the order a crew takes them (bible/11-Multiplayer/Sky-Ketch.md section 4). */
export const KT_STAGES = Object.freeze(['watch', 'gallery', 'engine', 'sailwalk', 'bridge', 'vault']);
export const KT_STAGE = Object.freeze({ watch: 0, gallery: 1, engine: 2, sailwalk: 3, bridge: 4, vault: 5 });
/** THE RELAY'S WORDS - the door's refusals (ketchAdmits' answers), the only Ketch lines the relay says itself. The relay
 *  sets no locale: the page says them in the player's language (systems/ketch/ketchWords.js KT_REFUSE_WORDS, ketchRefusal,
 *  key for key), as it says every other line of the voyage (KT_WORDS). The herald's Discord English is its own
 *  (net/ketch/ketchHerald.js). */
export const KT_TEXT = Object.freeze({
  refuse: Object.freeze({
    closed: 'The anchor-lift is drawn up. The Ketch takes no crew while she weighs anchor.',
    gone: 'The Ketch is gone.',
    crew: 'The anchor-lift answers only to its captain\'s crew.',
    full: 'The anchor-lift will not rise for nine.',
  }),
});
