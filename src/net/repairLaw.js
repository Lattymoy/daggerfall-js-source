// @ts-check
// SUMMON-REPAIR (FIELD BUGS 2026-10-14, bible/01-Overview/bugs/Field-Bugs-2026-10-14.md SUMMON-OFFER; Mac, asked how to mend
// the reporter's save: "Operator tool"): A STAFF REPAIR OF ONE REALM CHARACTER - ITS LAW, the one file the account
// service's review act (server-account/src/review.js `repair`) and the operator's tool (tools/realmReview.mjs) read.
//
// Before SUMMON-OFFER a Daedra summoning whose quest could not be made in the player's region took the gold and set the
// prince's Summoned flag (FactionFile.Flags) and offered nothing - and with the flag set he never offers his quest again.
// Nothing in a save tells that flag from one a refused offer set, so no load can mend it: staff mend the one character,
// by hand. A repair names a faction and one of FactionFile's flag bits to clear on it, the gold to give back, and the
// operator's ticket - its name for this one act, so the same repair asked twice mends once.
//
// THE GOLD COMES BACK AS THE GAME'S OWN LETTER OF CREDIT (net/realm/realmGoldLaw.js creditSave's `letter`, GUILD-LETTER's way):
// a summoning's price is paid as deductGold pays it - in letters when the coins do not cover it - and 100,000 gold in
// coin is 250 kg in the pack. A letter weighs nothing and spends as gold.

import { FACTION_FLAGS } from '../formats/factionFile.js';
import { POST_BATCH_RE } from './postLaw.js';
import { creditSave } from './realm/realmGoldLaw.js';

/** The bits a repair may clear: FactionFile.Flags, every one, and nothing else. @type {readonly number[]} */
export const REPAIR_FLAGS = Object.freeze(Object.values(FACTION_FLAGS));
/** The most gold one repair gives back. The dearest price this repair exists for is a summoning at the summoner's worst
 *  regard (daedraSummoning.js summoningCost(-100), 300,000); a refund past a million is no repair a ticket names. */
export const REPAIR_GOLD_MAX = 1_000_000;
/** A FACTION.TXT id's bound - the file's ids are small positive numbers; whether this one exists is the record's to say. */
export const REPAIR_FACTION_MAX = 0xffff;
/** An operator's ticket - the repair's name, once a character (lower-case words and hyphens, a post's send's shape:
 *  `fb1014-summon-offer`). */
export const REPAIR_TICKET_RE = POST_BATCH_RE;

/**
 * A REPAIR AS ASKED, checked - `{ ticket, faction, flag, gold }`, or null: a ticket of the shape, a faction id, one of
 * REPAIR_FLAGS, and 0 to REPAIR_GOLD_MAX gold (0: no gold back, the flag alone). Whether the faction is the record's and
 * carries the bit is the record's to say (applyRepair).
 * @param {any} v
 * @returns {{ ticket: string, faction: number, flag: number, gold: number } | null}
 */
export function repairOf(v) {
  if (!v || typeof v !== 'object') return null;
  const { ticket, faction, flag, gold } = v;
  if (typeof ticket !== 'string' || !REPAIR_TICKET_RE.test(ticket)) return null;
  if (!Number.isSafeInteger(faction) || faction < 1 || faction > REPAIR_FACTION_MAX) return null;
  if (!REPAIR_FLAGS.includes(flag)) return null;
  if (!Number.isSafeInteger(gold) || gold < 0 || gold > REPAIR_GOLD_MAX) return null;
  return { ticket, faction, flag, gold };
}

/**
 * THE REPAIR ON A SAVE, in place (a realm record, server-account/src/realm.js prepareRealmRecord's `change`): the flag
 * cleared on the faction's row of the save's faction store (save.js snapshotFactionRep: `ids`, `flags` beside them) and
 * the gold given back as a letter of credit at the front of the pack. Answers `{ was }` - the faction's flags before -
 * or the refusal's word, nothing changed: 'repair-no-faction', the save holds no such faction; 'repair-not-set', its
 * faction does not carry the bit - a repair undoes a flag that stands, so one aimed at the wrong character (an account
 * holds up to six) mends nothing and gives nothing.
 * @param {any} save @param {{ faction: number, flag: number, gold: number }} repair
 * @returns {{ was: number } | 'repair-no-faction' | 'repair-not-set'}
 */
export function applyRepair(save, { faction, flag, gold }) {
  const store = save?.factionRep;
  const at = Array.isArray(store?.ids) && Array.isArray(store?.flags) ? store.ids.indexOf(faction) : -1;
  if (at < 0 || !Number.isSafeInteger(store.flags[at])) return 'repair-no-faction';
  const was = store.flags[at];
  if ((was & flag) === 0) return 'repair-not-set';
  store.flags[at] = was & ~flag;
  if (gold > 0) creditSave(save, gold, { letter: true });
  return { was };
}

/**
 * A FLAG AS AN OPERATOR TYPES IT - `0x40`, `64` or its FactionFile name (`Summoned`) - as its number, or null.
 * @param {unknown} raw
 */
export function repairFlagOf(raw) {
  const s = String(raw ?? '').trim();
  if (Object.hasOwn(FACTION_FLAGS, s)) return FACTION_FLAGS[/** @type {keyof typeof FACTION_FLAGS} */ (s)];
  const n = /^0x[0-9a-f]+$/i.test(s) ? parseInt(s, 16) : /^[0-9]+$/.test(s) ? Number(s) : NaN;
  return REPAIR_FLAGS.includes(n) ? n : null;
}
