// @ts-check
// WAGONS2-VISIT (2026-10-09, Mac: "People should be able to use the interior just like houses, like crafting and such";
// asked who may come into a player's caravan online, "Like an online home" - its owner sets private, party, guild or
// public, the rules an online home's door keeps, and visitors cannot take from its storage; they come in "to craft,
// rest, look around"): A VISIT TO ANOTHER PLAYER'S CARAVAN - THE LAW.
//
// WHO MAY ENTER is the caravan's own, so it rides the caravan item beside its paint (systems/wagonKinds.js's item,
// systems/wagonLooks.js's `wagonLook`): `wagonEntry`, one of an online home's entries (net/homeLaw.js HOME_ENTRIES -
// 'private', absent, its default). Its owner moves it on from the caravan's plaque ("Who may enter: ..."), round as a
// home's door does (systems/onlineHomes.js homeNextEntry). On the wire it is `we`, its place in HOME_ENTRIES (absent
// for 'private' - systems/horseCartWire.js, and the cell's record of the parked caravan, net/wire.js validParkData),
// and with the guild's entry `wg`, the owner's guild tag: the owner's own word about its own door, which only lets in
// whoever wears that tag. A visitor's client reads it as a home's door is read (homeMayEnter): the owner by the name the
// relay stamped, a party member by the handles the relay signed over the party, a guildmate by the tag.
//
// THE ROOM is the caravan's own on the relay (net/privateInterior.js caravanRoomOf), named by its owner's park key - which
// the cell's record names, so a visitor reads it there and the owner works it out (net/wire.js parkKeyOf).
//
// WHAT THE OWNER PLACED is said to that room (the relay's `caravan` frame, net/wire.js validCaravanData): a document of
// the room's pieces, `{ v, p }`, each through the decor law (net/decorLaw.js decorPieceOf) and kept as the save keeps
// them - unturned (systems/caravanRoom.js turnCaravanScene) - and only as many as fit the small frame
// (CARAVAN_DECOR_BYTES). Nothing a piece holds rides it: a visitor sees the pieces, never what the storage keeps.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS2).
import { HOME_ENTRIES, HOME_ENTRY_DEFAULT, homeEntryOk, homeMayEnter } from '../net/homeLaw.js';
import { GUILD_TAG_RE } from '../net/guildLaw.js';
import { decorPieceOf, DECOR_CAP } from '../net/decorLaw.js';
import { MAX_FRAME_BYTES } from '../net/wire.js';
import { activeWagonItem, wagonKindOf, isWagonItem } from './wagonKinds.js';

/** The wire's code for an entry (`we`): its place in HOME_ENTRIES - 0 (said by no field) for the owner alone. */
export const caravanEntryCode = (entry) => Math.max(0, HOME_ENTRIES.indexOf(homeEntryOk(entry) ? entry : HOME_ENTRY_DEFAULT));
/** The entry a wire code names - the owner alone for anything the law does not know. */
export const caravanEntryOfCode = (code) => (Number.isInteger(code) && code > 0 && code < HOME_ENTRIES.length ? HOME_ENTRIES[code] : HOME_ENTRY_DEFAULT);
/** The guild's code - the one that carries the owner's guild tag (`wg`). */
export const CARAVAN_GUILD_CODE = HOME_ENTRIES.indexOf('guild');
/** A guild tag as the word may carry it, or null. */
export const caravanGuildTag = (tag) => (typeof tag === 'string' && GUILD_TAG_RE.test(tag) ? tag : null);

/** Who may enter a caravan item: its `wagonEntry`, the owner alone for anything else (and for every wagon not a caravan). */
export const caravanEntryOf = (item) => (isWagonItem(item) && wagonKindOf(item) === 'caravan' && homeEntryOk(item.wagonEntry) ? item.wagonEntry : HOME_ENTRY_DEFAULT);

/**
 * THE DRIVEN CARAVAN'S DOOR SET: in the pack `items` (the host's own list - the caravan's place in it taken by its new
 * self, as a paint is, systems/wagonLooks.js paintDrivenWagon), the caravan a player drives given `entry`; the field
 * dropped for the owner alone. Answers the entry set, or null - no caravan driven, or an entry the law does not know.
 */
export function setDrivenCaravanEntry(items, entry) {
  const item = activeWagonItem(items);
  if (!item || !Array.isArray(items) || wagonKindOf(item) !== 'caravan' || !homeEntryOk(entry)) return null;
  const { wagonEntry: _drop, ...rest } = item;
  items[items.indexOf(item)] = entry === HOME_ENTRY_DEFAULT ? rest : { ...rest, wagonEntry: entry };
  return entry;
}

/**
 * WHETHER I MAY STEP INTO ANOTHER'S CARAVAN - `t` its word as a visit reads it ({ owner, entry, guild }: the owner's name
 * the relay stamped, who may enter, the guild's tag), read as an online home's door is (net/homeLaw.js homeMayEnter):
 * anyone when public, a player whose party holds the owner (`partyNames`, the handles the relay signed) when party, a
 * player wearing the owner's guild tag (`guild`, mine) when guild; never when it is the owner's alone. A caravan with
 * no owner's name opens to nobody.
 */
export function caravanMayEnter(t, { partyNames = [], guild = null } = {}) {
  if (!t || typeof t.owner !== 'string' || !t.owner) return false;
  const tag = caravanGuildTag(guild);
  return homeMayEnter({ owner: t.owner, entry: t.entry, guildmate: !!tag && caravanGuildTag(t.guild) === tag }, { partyNames });
}

/** The words: the owner's row and its line (the entry's own words are a home's - systems/onlineHomes.js
 *  HOME_ENTRY_WORDS, the host's to hand in), and what a visitor is told when the caravan has gone from under them. */
export const CARAVAN_VISIT_TEXT = Object.freeze({
  entryRow: (words) => `Who may enter: ${words}`,
  entryLine: (words) => `Who may enter your caravan: ${words}.`,
  shut: (owner) => `This is ${owner}'s caravan. Its door is shut.`,
  gone: 'The caravan has moved on. You step outside.',
  closed: (owner) => `${owner} has shut the caravan's door. You step outside.`,   // WAGONS2-VISIT (AUDIT): the door set against me while I stood in it
});

/** The document's shape version, and its byte bound - the small frame's cap less room for the frame around it. */
export const CARAVAN_DECOR_V = 1;
export const CARAVAN_DECOR_BYTES = MAX_FRAME_BYTES - 512;

/** THE ROOM'S DOCUMENT: `pieces` (as the save keeps them - unturned) through the decor law, in their order, as many as
 *  fit CARAVAN_DECOR_BYTES (and DECOR_CAP); a piece the law refuses is left out. */
export function caravanDecorDoc(pieces) {
  const p = [];
  let bytes = 32;
  for (const raw of Array.isArray(pieces) ? pieces : []) {
    if (p.length >= DECOR_CAP) break;
    const piece = decorPieceOf(raw);
    if (!piece) continue;
    const n = JSON.stringify(piece).length + 1;
    if (bytes + n > CARAVAN_DECOR_BYTES) break;
    bytes += n;
    p.push(piece);
  }
  return { v: CARAVAN_DECOR_V, p };
}
/** A document as a visitor reads it: its pieces through the decor law (unturned), or null - no document. */
export function readCaravanDecor(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.v !== CARAVAN_DECOR_V || !Array.isArray(doc.p)) return null;
  return doc.p.slice(0, DECOR_CAP).map(decorPieceOf).filter(Boolean);
}
