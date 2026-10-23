// @ts-check
// PWR5 (2026-10-23, bible/05-Combat/Power-Arc.md section 8; Mac, asked: "Weekly per boss" - "each boss rolls
// Legendary-and-up, set and Gilded pieces for an account once an arena week; repeat kills still pay gold, Marks and
// Embers (the Elite Gates' weekly law the template)"): THE WEEK'S FINEST, A BOSS'S LAW.
//
// The bosses whose kills the account service counts off a receipt the relay signed: the Burning Court's Warden
// (server-account/src/accounts.js claimGate), the Shattered Hour's Brass Remnant (sds.js claimSd) and the sea serpent
// (serpents.js claimSerpent). The Elite Breach's Redoubts kept this law first (egEconomy.js egRedoubtPay: once an account,
// a Redoubt and an arena week) and keep their own.
//
//   - THE FINEST: a piece of Legendary rank or over - a Legendary (an Exalted one among them), a set's piece (Aetheric),
//     an artifact, a Gilded (systems/loot/lootRarity.js RARITIES, rank 3 and over; pinned equal). Never by the glow a
//     spoils list dresses a piece in (an ember glows as an artifact, a card as a set's piece): by the item's own rarity.
//   - THE WEEK: the arena's (arenaLaw.js arenaWeekOf), of the kill - the receipt's issue time `i`, which the relay signed -
//     so a receipt held past Monday is still the week it was won in.
//   - ONE A WEEK: the first claim of a kill of that boss in its week takes the week for the account (the service's
//     boss_weeks row, migration 0165) for the device that claimed it (`cid`: the serpent's hoard key; the gate's and the
//     Hour's this device's week key, bossWeekDevice). Every claim of that kill from that device answers it `top`, a claim
//     asked again the same; any other kill of that boss that week, or that kill claimed from another device, not.
//   - THE FLOOR NEVER HOLDS ONE: every spoils list a receipt rolls drops its finest pieces (`weekBase`), so a floor's
//     throw and a pack's grant at the receipt are the same for every kill. The week's finest is a SECOND roll, on the
//     receipt's seed mixed with the service's own draw at the claim (`bossTopSeed`, the row's nonce - as the Elite
//     Breach's spoils roll, egPay.js egSpoilsSeed): its finest pieces alone (`weekTop`). A page can read a receipt's seed;
//     it cannot read a draw the service has not made, so no kill can be rolled in advance and claimed first because it
//     rolled well.
//   - A GUEST holds no week - there is no account to hold it - so its kills roll no finest piece, as a guest's Redoubt
//     pays its gold alone.
//
// Pure, but for bossWeekDevice (this device's key, kept in its storage). Not a DFU member (DFU has no account, no week,
// no receipt). Ledger A (PWR5).
import { arenaWeekOf } from './arena/arenaLaw.js';
import { egSpoilsSeed } from './eliteGates/egPay.js';

/** The rarities a boss gives an account once a week: Legendary's rank and over (lootRarity.js RARITIES, pinned equal). */
export const BOSS_TOP_RARITIES = Object.freeze(['legendary', 'aetheric', 'artifact', 'gilded']);
/** Whether `item` is one of the week's finest, by its own rarity. Pure. */
export const isTopPiece = (item) => !!item && typeof item === 'object' && BOSS_TOP_RARITIES.includes(item.rarity);
/** The kinds of boss the law holds, by the claim that counts their kill. */
export const BOSS_WEEK_KINDS = Object.freeze(['gate', 'sd', 'serpent']);
/** A boss's key on the service's row: its kind and the receipt's boss (`b`). Null for a kind the law does not hold. Pure. */
export const bossWeekKey = (kind, c) => (BOSS_WEEK_KINDS.includes(kind) && typeof c?.b === 'string' && c.b ? `${kind}:${c.b}` : null);
/** The arena week a receipt's kill fell in - its issue time's. Pure. */
export const bossWeekOf = (c) => arenaWeekOf(c?.i);
/** The kill a receipt names within its kind: the gate's day, the Hour's slot, the serpent's day (each kind's kill row is
 *  one a (that, account)). Pure. */
export const bossWeekRef = (c) => String(c?.d ?? '');
/** The device key a claim names its device by: sixteen hex digits (the serpent's SERPENT_CID_RE). */
export const BOSS_WEEK_CID_RE = /^[0-9a-f]{16}$/;
/** What the week's finest roll on: the receipt's seed mixed with the service's draw at the claim (the row's nonce),
 *  salted off the Elite Breach's own stream. Pure. */
const TOP_SALT = 0x70b5eed5;
export const bossTopSeed = (seed, nonce) => egSpoilsSeed(((Number(seed) >>> 0) ^ TOP_SALT) >>> 0, nonce);
/** A spoils list (its pieces `{ kind, item, ... }`) without its finest pieces: what a floor throws and a grant gives at
 *  the receipt. Pure. */
export const weekBase = (list) => (Array.isArray(list) ? list.filter((p) => !isTopPiece(p?.item)) : []);
/** A spoils list's finest pieces alone: what the week's roll gives. Pure. */
export const weekTop = (list) => (Array.isArray(list) ? list.filter((p) => isTopPiece(p?.item)) : []);
/** The spoils pools' key for a kill's week's finest, beside its own spoils' key (`day`): its own spent mark and crash
 *  record, never said to the hub (a receipt spent there is its own spoils'). Pure. */
export const bossTopDay = (day) => `top:${day}`;
/** Whether a spoils pool's key is a week's finest's (bossTopDay). Pure. */
export const isBossTopDay = (day) => typeof day === 'string' && day.startsWith('top:');

/** This device's week key - minted once and kept in `storage` (a Storage: getItem/setItem); one minted for the session
 *  where nothing can keep it. */
export const BOSS_WEEK_DEVICE_KEY = 'pwr5.bossWeekDevice';
let _sessionCid = null;
const mint = () => { const b = new Uint8Array(8); globalThis.crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
export function bossWeekDevice(storage) {
  try {
    const had = storage?.getItem?.(BOSS_WEEK_DEVICE_KEY);
    if (typeof had === 'string' && BOSS_WEEK_CID_RE.test(had)) return had;
    const made = mint();
    storage?.setItem?.(BOSS_WEEK_DEVICE_KEY, made);
    if (storage?.getItem?.(BOSS_WEEK_DEVICE_KEY) === made) return made;
  } catch { /* the session's own */ }
  return (_sessionCid ??= mint());
}
