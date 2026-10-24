// SOC3 (2026-09-16, Mac: "A social button next to the chat UI, that when tapped opens the new friends list + party
// interface. Players should now be able to friend other users, see if they are online/last online + be able to
// invite friends or other individuals to the new 4 person party system. Party system: Upon joining a party, the
// players name who are in a party together should turn green"): THE PANEL ITSELF.
//
// WHAT IT IS. A DOM panel beside the chat - the enhanced skin's, like ui/chatPanel.js - with two tabs and nothing
// else: FRIENDS (the requests waiting on me, then everyone I have, online first, each saying when they were last
// seen) and PARTY (the seats (PARTY_MAX), who leads, where each member stands and how they fare, and the invitations
// standing). Plus one TOAST, which is the only part that draws while the panel is CLOSED: an invitation is good for
// INVITE_TTL_MS and a player who never opened the panel would otherwise watch it lapse without ever being asked.
// The toast has its OWN strip, centred at the top of the screen, and it takes no pointer but its two buttons
// (AUDIT SOC C3: it used to sit on the chat's corner at z 7 and swallow the open chat's tab bar).
//
// IT KNOWS NOTHING AND DECIDES NOTHING. Every question it asks is net/social.js's - `actionsFor` for what may be
// done with a peer and why not, `seatsFree`/`inMyParty`/`leads` for the party's own rules, `lastOnlineText` for the
// words on a row - and every answer it sends goes out through ONE arrow, `send(act)`, which the host points at the
// hub's link (net/online.js sendSocial). So the whole surface drives headless over a fake document with plain
// objects for the picture, which is what lets the awkward cases be written down: a party seat that lapsed while the
// panel was open, an invite that expired mid-countdown, a friend with no tab in the world, an act the rate gate
// refused.
//
// A REFUSAL IS A SENTENCE, NOT A MISSING BUTTON. A button that cannot go is DISABLED and carries the reason BESIDE
// ITS LABEL and on its `title` ("already friends", "the party is full", "offline") - AUDIT SOC C11: the title alone
// is a mouse hover, and half the machines this runs on have no mouse - because a control that quietly vanishes
// teaches a player nothing about the rule they just met. And the one refusal that is not about the player - the rate gate,
// where `send` answers false - leaves the button ENABLED and says "try again", since the act was right and only the
// moment was wrong.
//
// TEXT, NEVER MARKUP. Every word on this panel arrives from the relay by way of another player's keyboard; it is
// written with `textContent` and nothing else, which is the chat's own rule (AUDIT CHAT) and the reason a name is
// not an injection.
//
// REPAINTED ON A CHANGE, NOT A FRAME. `render` runs once a frame from the host's chat frame, and the body is
// rebuilt only when `social.version` moved or the panel's own state did (a tab, a confirm, an act just sent). What
// IS redrawn every frame is the handful of things that move on their own: the invite countdowns, the hub's last
// refusal, the toast, the tab badges (AUDIT SOC C5: an invitation lapses on the CLOCK, and `liveInvites` sheds it
// as it is read without moving the version) and the friend rows' "last online" (AUDIT SOC B8, the same reason).
// Every one of those is WRITTEN only where the words actually changed, so a quiet frame still costs nothing. That
// is ChatLog's law (ui/chatPanel.js paintWho) applied before it can be missed.
//
// Not a DFU member: Daggerfall Unity has no friends and no parties. Ledger A row (ONLINE).
import { overlayOpen } from './enhanced/enhancedOverlays.js';
import { isTextEntryTarget, swallowBrowserKey } from './input.js';   // DISC25-E: a letter's keys are the letter's
import { isTouchDevice } from './touch/touch.js';
import { PARTY_MAX } from '../net/wire.js';
import { lastOnlineText, PARTY_GREEN_CSS, FRIEND_CSS } from '../net/social.js';
import { NAME_ORDER } from '../net/roster.js';   // AUDIT 637 A11: the roster's name order, one collator
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';   // FONT1: the enhanced skin's own face, unsmoothed, with Silkscreen's five
import { accountRefusalText, handleShapeOk, HANDLE_MAX_LEN } from '../net/accountClient.js';   // MAIL1: the service's sentences, and a handle's shape
import { letterAgeText, replySubject } from '../net/mail.js';   // MAIL1: the box the Letters tab draws
import { LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, cleanBody } from '../net/letterLaw.js';
import {
  GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_NAME_MAX, GUILD_RANK_NAME_MAX, GUILD_RANK_NAMES,
  guildMay, guildMayMove, guildOutranks, guildNameOf, guildTagOf, guildRankNamesOf, GUILD_MOVE_MAX,
  GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_RECRUIT, GUILD_RENAME_GOLD,   // GUILD2a: a new name, for a price
} from '../net/guild/guildLaw.js';   // GUILD1b: the Guild tab's rules are the service's
import { VAULT_RANK_DEFAULTS, VAULT_LIMIT_CHOICES, GUILD_VAULT_SLOTS, vaultStandingText, vaultMayTake, vaultMayPut } from '../net/guild/guildVaultLaw.js';   // GUILD2b: the vault
import { tradeRefusal } from '../systems/tradePack.js';   // GUILD2b: what may leave a pack, for the vault as for a trade
import { isLocked } from '../systems/item/itemLock.js';   // AUDIT2 GUILD2 U4: a locked piece stays in the pack
import { GUILD_DEPOSIT_UNSURE, guildMemberOnline, guildSeenText } from '../net/guild/guildBook.js';   // GUILD-SEEN: a member's "last online"
import { LETTER_OF_CREDIT_TEXT } from '../systems/tradeModes.js';   // GUILD-LETTER: the trade window's own line for a letter of credit
import { writMay, guildMoveOk, writBudgetOk, GUILD_STORES_MAX, WRIT_BUDGET_MAX } from '../net/writLaw.js';   // PROF6: the guild Stores' and the writ budget's ranks and bounds
import { guildRankLines, GUILD_RANK_ACTS_NOTE } from '../net/guild/guildPowers.js';   // GUILD3c: what each rank may do, in words
import { STORES_MAX } from '../net/professionLaw.js';   // AUDIT 31 U8: a character's Stores' most of a material
import { marksText, MARKS_FAUCETS, MARKS_MAX } from '../net/marksLaw.js';   // MARKS1: the Marks treasury's words   // MAIL1: the form's caps are the service's
import { glyphBadges, glyphSvgNode, titleBadge } from './playerBadge.js';   // MAIL1: a sender's glyphs, in the one drawing every DOM face uses
import { HERALDRY_COLOURS, HERALDRY_DEVICES, HERALDRY_UNHELD, HERALDRY_CHANGE_DRAKES, heraldryOf, heraldrySame, heraldryText, heraldryDeviceName,
  HERALDRY_DIVISIONS, HERALDRY_DIVISION_NAMES, heraldryColourOf, heraldryInk } from '../net/heraldryLaw.js';   // GUILD1d; GUILD2c: the divisions, the device's colour
import { bannerSvg, shieldSvg } from './heraldryArt.js';   // GUILD1d: the guild's banner, drawn; GUILD2c: and its shield
import { GUILD_HALL_PRICE_MULT, GUILD_HALL_ENTRIES, GUILD_HALL_ENTRY_WORDS, hallMay } from '../net/hallLaw.js';   // GUILD1d: the hall
import { homeSaleRefund } from '../net/homeLaw.js';   // GUILD1d: what the hall sells back for
import { REGION_NAMES } from '../formats/mapsTables.js';   // GUILD1d: where the hall stands
import { wagonItemName } from '../systems/wagon/wagonKinds.js';   // WAGONS2 (FINAL AUDIT): a marked wagon by its kind's name
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page
import { t } from '../systems/textManager.js';   // GUILD-UX: the storage pages' new words in the player's language
import { storeFilterAccepts, storeRarityAccepts, storeQuery, storeFilterOptions, storeRarityOptions } from './storeFilter.js';   // GUILD-UX: the stores' one filter
import { showItemHover, hideItemHover } from './enhanced/enhancedInventory.js';   // GUILD-UX: the pack's one item card
import { playerEntity } from '../characters/playerEntity.js';   // GUILD-UX: the card's comparison is against what I wear
import { isEnhanced } from '../systems/uiSkin.js';   // AUDIT SUGGESTIONS-1019 L4-4: the card is the enhanced skin's
import { itemLongName } from '../systems/item/itemInfo.js';   // AUDIT SUGGESTIONS-1019 L4-6: a row named as the pack names the piece
import { LOOSE_ORIGIN } from '../net/bagLaw.js';   // AUDIT SUGGESTIONS-1019 L4-1: the loose units the service's room counts
/** GUILD-UX: the vault row's card - the pack's own (enhancedInventory.js showItemHover), compared against what I wear. */
// AUDIT SUGGESTIONS-1019 L4-4: on the enhanced skin alone - the card's sheet is the enhanced dress's (enhancedPlusStyle.js),
// and on the classic skin it fell, unstyled, below the screen
export const ITEM_CARD = Object.freeze({
  show: (rec, row, { asked = false } = {}) => { if (isEnhanced()) showItemHover(rec, { entity: playerEntity }, row, 'shop', { asked }); },
  hide: () => hideItemHover(),
});
/** AUDIT SUGGESTIONS-1019 L4-6: a vault row's name as the pack would say it (itemInfo.js itemLongName - an unidentified
 *  piece unnamed), never the service's record name, which is the piece's true one; a wagon by its kind; an old row with
 *  no record by the service's line. */
export const vaultRowName = (row) => String(wagonItemName(row?.rec) ?? (row?.rec?.group ? itemLongName(row.rec) : row?.name) ?? t('social.vault.anItem', 'an item'));
/** The first node under `n` (itself included) wearing class `cls` - a walk of `children`, so it reads any DOM. */
const childOfClass = (n, cls) => {
  if (String(n?.className ?? '').split(/\s+/).includes(cls)) return n;
  for (const c of n?.children ?? []) { const f = childOfClass(c, cls); if (f) return f; }
  return null;
};
/** GUILD-WINDOW: whether `n` is `anc` or stands under it - parent by parent, so it reads any DOM. */
const within = (n, anc) => { for (let x = n; x; x = x.parentNode ?? x.parent) if (x === anc) return true; return false; };
/** GUILD-UX: whether a vault row answers the filter `f` - its record's page and rarity (storeFilter.js, the stores' own
 *  tests) and the search over the name the row shows. */
export function vaultRowAccepts(row, f) {
  const rec = row?.rec ?? {};
  const q = storeQuery(f?.query);
  const name = vaultRowName(row).toLowerCase();
  return storeFilterAccepts(rec, f?.cat ?? 'all') && storeRarityAccepts(rec, f?.rarity ?? 'all') && (!q || name.includes(q));
}
/** A piece of the pack as the vault's Put in names it - the Open Wagon and the Caravan by their own names (their record's
 *  is the Small Cart's), anything else by its record's (the account service names the vault's row so - guildVault.js). */
const vaultPieceName = (it) => String(wagonItemName(it) ?? it?.name ?? 'an item');

export const SOCIAL_STYLE_ID = 'dagger-social-style';

/** How long a "try again" note stands after a refused act, ms - long enough to read, short enough not to lie. */
export const SOCIAL_NOTE_MS = 2500;
/** How long Remove stays armed before it disarms itself, ms. A confirm that waits forever is a confirm a player
 *  walks into by accident on their next visit to the row. */
export const SOCIAL_CONFIRM_MS = 4000;
/** The words a friends list with nobody in it says - and where to go to change that.
 *
 *  AUDIT SOC D10/C19: THE ROSTER LEADS, AND THE KEY IS NOT SPELLED. It used to open with "press F", which is a lie
 *  on two machines out of three: F is a rebindable action (systems/inputActions.js SocialInteract, and a player who
 *  had already spent F keeps it and gets the action UNBOUND), and a phone has no F at all. The roster row is the one
 *  door that is always there, so it is named first and the key is named by what it does. */
export const NO_FRIENDS_TEXT = 'No friends yet. Click a name in the chat roster, or press the interact key on a player.';
/** The words for no party. */
export const NO_PARTY_TEXT = 'You are not in a party.';
/** The note a rate-gated act leaves (net/online.js sendSocial answered false: the act never left this machine).
 *
 *  AUDIT SOC C19: ONE SENTENCE FOR ONE REFUSAL. This panel said "Too quick - try again" and scenes/world.js said
 *  "Try again in a moment" on the world tab for the very same gate, so a player who pressed a button and read both
 *  had two different answers for one event. The world tab's wording wins (it is the one a player reads without
 *  opening anything) and the host imports THIS constant rather than keeping a second copy of the words. */
export const TRY_AGAIN_TEXT = 'Try again in a moment';
/** JOURNAL1: a letter kept in the journal, and a keep the journal could not take. */
export const LETTER_KEPT_NOTE = 'A copy is in your journal, under Notes.';
export const LETTER_KEEP_FAILED_TEXT = 'Your journal cannot save it right now.';
/** MAIL1: the Letters tab's own sentences - the states the box can be in before there is anything to list. */
export const NO_LETTERS_TEXT = 'No letters yet. Letters sent while you are away wait here.';
export const LETTERS_SIGNED_OUT_TEXT = 'Sign in to an account to send and read letters.';
export const LETTERS_LOOKING_TEXT = 'Looking for letters...';
/** How recent a look the Letters tab trusts when it opens; older, and opening it looks again. */
export const LETTERS_FRESH_MS = 30_000;
/** GUILD1b: the Guild tab's own sentences. */
export const GUILD_SIGNED_OUT_TEXT = 'Sign in to an account to found or join a guild.';
export const GUILD_LOOKING_TEXT = 'Looking for your guild...';
export const GUILD_NONE_TEXT = 'This character belongs to no guild. Accept an invitation, or found one.';
export const GUILD_FOUND_COST_TEXT = `Founding a guild costs ${GUILD_FOUND_GOLD.toLocaleString('en-US')} gold (from your purse, then this region's bank account) and Renown ${GUILD_FOUND_RENOWN}.`;
export const GUILD_GOLD_SHORT_TEXT = 'You do not have that much gold, even with this region\'s bank account.';
/** GUILD1d (Seats-Arc 8): the Hall and Heraldry sections' words. */
export const GUILD_HALL_NONE_TEXT = `Your guild has no hall. The guildmaster can buy one at any house's door with treasury gold, for its price plus ${Math.round((GUILD_HALL_PRICE_MULT - 1) * 100)}%.`;
/** HALL-GOLD (FIELD BUGS 2026-10-03): what of the treasury buys a hall, said where a hall is bought - only the gold realm
 *  characters put in counts (halls.js buyHall), and a guild whose gold came in before the realm could not see why it was
 *  refused. Absent from an older service's answer: nothing said. */
export const guildHallGoldText = (hallGold, treasury) => guildRealmGoldText(hallGold, treasury, false);   // AUDIT GUILD3 W15: one rule, one sentence (GUILD3c's)
/** GUILD3c (bible/11-Multiplayer/Guilds-Made-Plain.md, EVERY RULE BEFORE THE PRESS): THE TREASURY'S TWO GOLDS, said
 *  where the gold is - the Treasury page's top - and not only where a hall is bought: only the gold realm characters put
 *  in buys a hall or a new name or tag (halls.js buyHall, guilds.js renameGuild - AUDIT GUILD3 W15: the rename's own words);
 *  a guild with its hall already, the name alone (C10). Absent from an older service's answer: null. */
export const guildRealmGoldText = (hallGold, treasury, hall = false) => (Number.isFinite(hallGold)
  ? `${hallGold.toLocaleString('en-US')} of the treasury's ${Number(treasury ?? 0).toLocaleString('en-US')} gold was put in by realm characters and can ${hall ? 'pay for a new name or tag' : 'buy a hall, or a new name or tag'}. Gold in a bank account cannot.`
  : null);
/** GUILD3c: A GUILD IN ONE LOOK, for a character in none - what one is for, before the invitations and the founding. */
export const GUILD_PRIMER_LINES = Object.freeze([   // AUDIT GUILD3 W10: one reading each, and no town promised that is no seat
  'Guild members share a gold treasury, a silver treasury and a vault for items. A guild can also buy a hall under its own arms.',
  'Together they can hold seats of the Iliac Bay: a palace\'s or a crown\'s Charter, contested from that town\'s Notice Board.',
]);
/** GUILD3c: where the rest of a guild is run - said on the Overview, so a member is never left to find the boards. */
export const GUILD_ELSEWHERE_TEXT = 'Seats and sieges are run from the Seat tab of a seat town\'s Notice Board, where you can also read its Chronicle. Guild writs and contracts are posted from the Work tab of any Notice Board.';   // AUDIT GUILD3 W9: a Chronicle is read, never run
/** GUILD-WINDOW (Guild-Overhaul.md GUILD-WINDOW): what each page holds, said under its name in the window's column of
 *  pages - one line each, the page's sections in the order it shows them; read at each call, in the player's language. */
export const guildPageWords = () => ({
  overview: t('social.guild.page.overview', 'The arms, the hall, and where the rest is run'),
  members: t('social.guild.page.members', 'The roster, its ranks, and invitations'),
  treasury: t('social.guild.page.treasury', 'Gold and silver, and their ledgers'),
  vault: t('social.guild.page.vault', 'The pieces the guild keeps'),
  stores: t('social.guild.page.stores', 'Materials, and the writ budget'),
  arms: t('social.guild.page.arms', 'The banner, the shield and the tag'),
  settings: t('social.guild.page.settings', 'A new name, the rank names, and leaving'),
});
/** GUILD-WINDOW: how many of a guild's members are online now, as the header's Members tile says it beneath its count -
 *  each member by guildBook.js's own reading (`guildMemberOnline`, the roster rows' dot), so the two never disagree. */
export const guildOnlineText = (members, now) => t('social.guild.online', '{n, number} online', { n: (members ?? []).filter((m) => guildMemberOnline(m, now) === true).length });
/** The panel's name in its social mode - and again when the Guild window gives it back (GUILD-WINDOW). */
const SOCIAL_LABEL = 'Friends and party';
/** The Close button's name in the social mode - and again when the Guild window gives it back (AUDIT GUILD-WINDOW W11). */
const CLOSE_SOCIAL_LABEL = 'Close social';
/** GUILD-WINDOW: the screens the window takes whole, its pages a row across - the sheet's query and the column's
 *  orientation read the one string (AUDIT GUILD-WINDOW W11). */
export const GUILD_SMALL_QUERY = '(max-width: 760px), (max-height: 520px)';
/** AUDIT GUILD-WINDOW W9: the pages' own names in the player's language, as the words under them are - read at each
 *  call. (`guildPagesOf` keeps GUILD2's English ones, which the page ids stand beside.) */
export const guildPageNames = () => ({
  overview: t('social.guild.name.overview', 'Overview'), members: t('social.guild.name.members', 'Members'),
  treasury: t('social.guild.name.treasury', 'Treasury'), vault: t('social.guild.name.vault', 'Vault'),
  stores: t('social.guild.name.stores', 'Stores'), arms: t('social.guild.name.arms', 'Arms'),
  settings: t('social.guild.name.settings', 'Settings'),
});
/** GUILD3c: the Settings page's list of what still holds a guild that would go - its heading. */
export const GUILD_KEEPS_HEAD = 'Before the guild can be disbanded';   // AUDIT GUILD3 W13: the act the page names
/** GUILD3c: the codes the service's view reads of what holds a guild (server-account/src/guilds.js guildHolds) - where
 *  the view carries its list, its word stands for these; a refusal's older word for one of them is not repeated. */
export const GUILD_HOLD_CODES = Object.freeze(['guild-treasury', 'guild-stores', 'guild-writs', 'guild-writ-escrow', 'guild-contracts', 'guild-hall',
  'guild-vault', 'guild-seat', 'guild-battle', 'guild-patron', 'marks-full']);   // AUDIT GUILD3 S3: the silver's room, the view's too
/** AUDIT GUILD3 S3: a hold the Settings list says in the going's own terms where the service's sentence is a general one
 *  (an account's cap, said of any silver it is paid). */
export const GUILD_KEEPS_WORDS = Object.freeze({
  'marks-full': `The guild's silver goes to you when it is disbanded, but your account cannot hold it (the most is ${MARKS_MAX.toLocaleString('en-US')} silver). Spend some of yours first.`,
});
/**
 * GUILD3c: EVERYTHING THAT STILL HOLDS A GUILD THAT WOULD GO, as refusal codes in the service's order: the guildmaster's
 * view's own list (`v.keeps`, the service's guildHolds - read fresh after every act), what the service's last refusal
 * said beside it (`said`, its `keeps` - a code the view does not read, or every code from an older service whose view
 * carries none), and what the page knows itself (`v` - its gold, its hall, its vault's pieces), less what the page can see
 * is cleared since. Before GUILD3c the service said the FIRST thing alone, and the page three: a guildmaster cleared one,
 * pressed again, and was told the next. With `said` null, what the page can SEE again - the view's and its own - which
 * alone holds its buttons (AUDIT GUILD3 C1/T2: a refusal's word nothing re-reads is listed, never a lock). AUDIT GUILD3
 * C10/T15: the leave's hand-over, which the page never asked here, is gone from it.
 * @param {any} v @param {readonly string[] | null} said
 */
export function guildKeepsOf(v, said) {
  const known = new Map([
    ['guild-master-leaves', false],   // a leave's hand-over: the Leave button says it ("hand the guild on first") - never a disbanding's
    ['guild-treasury', Number(v?.treasury ?? 0) > 0],
    ['guild-hall', !!v?.hall],
    ['guild-vault', (v?.vault?.used ?? 0) > 0],
  ]);
  const viewed = Array.isArray(v?.keeps) ? v.keeps : null;
  const told = (Array.isArray(said) ? said : []).filter((k) => !viewed || !GUILD_HOLD_CODES.includes(k));
  const out = [];
  for (const k of [...(viewed ?? []), ...told]) if (typeof k === 'string' && (known.has(k) ? known.get(k) : true) && !out.includes(k)) out.push(k);
  for (const [k, holds] of known) if (holds && !out.includes(k)) out.push(k);
  return out;
}
export const GUILD_HERALDRY_NONE_TEXT = 'Your guild has no arms yet.';   // AUDIT GUILD3 W6: one word - the page is "Arms"
/** GUILD2 (bible/11-Multiplayer/Guild-Overhaul.md): the pages' own sentences. */
export const GUILD_RENAME_COST_TEXT = `A new name or tag costs ${GUILD_RENAME_GOLD.toLocaleString('en-US')} gold from the treasury (gold put in by realm characters). You can rename again after two weeks. The old name is free for anyone at once.`;
/** GUILD2a: when the next new name may come, from `at` (epoch seconds). */
export const guildRenameSoonText = (at, nowS) => {
  const days = Math.max(1, Math.ceil((at - nowS) / 86_400));
  return `The guild was renamed recently. It can be renamed again in ${days} ${days === 1 ? 'day' : 'days'}.`;
};
export const GUILD_VAULT_REACH_TEXT = 'You can use the vault in any town. View it here; put items in and take them out in town.';
export const GUILD_VAULT_EMPTY_TEXT = 'The vault is empty. Put an item in from your pack below.';
/** GUILD2c: why a draft of arms will not stand, in the law's own terms (heraldryLaw.js heraldryOf). */
export function armsWhy(h) {
  if (!h) return 'arms to raise';
  if (h.field === HERALDRY_UNHELD) return 'Ash only as the border';
  if (h.field === h.border) return 'a border unlike the field';
  const ink = h.charge ?? h.border;
  if (ink === h.field || (h.division && h.division !== 'plain' && ink === h.field2)) return 'a device that stands out from the field';
  if (h.division && h.division !== 'plain' && (h.field2 === h.field || h.field2 === HERALDRY_UNHELD)) return 'two different field colors, never Ash';
  if (h.division && h.division !== 'plain' && h.field2 === h.border) return 'a border unlike either field color';   // AUDIT GUILD2 G13
  return 'arms the rules allow';
}
/** AUDIT SILVER-WAYS A3: the day's guild deeds, as the Guild tab says them (marksLaw.js MARKS_FAUCETS.deed). */
export const guildDeedsText = (n, max) => `Guild deeds today: ${Math.max(0, Number(n) || 0)} of ${max}. When ${MARKS_FAUCETS.deed.members} members who joined at least ${Math.round(MARKS_FAUCETS.deed.tenureS / 86_400)} days ago defend the same town or close the same gate, the treasury earns ${marksText(MARKS_FAUCETS.deed.amount)}.`;
/** GUILD1d: a treasury ledger line's verb - a deposit and a withdrawal, and the hall's own moves (0043's `moved_kind`). */
export const GUILD_LEDGER_WORDS = Object.freeze({ deposit: 'put in', withdraw: 'took out', hall: 'bought the hall for', 'hall-sale': 'sold the hall for', 'hall-piece': 'took down a hall piece, returned to the treasury:', rename: 'renamed the guild for', grant: 'awarded the guild' });   // AUDIT2 GUILD2: a rename's line read "put in" - a payment out said as one in; GUILD-GRANT: the operator's award (tools/grantGuildGold.mjs)
/** AUDIT GUILD1d R5: a Drakes ledger line's verb - a heraldry changed is the treasury paying, never a deposit. */
export const GUILD_MARKS_LEDGER_WORDS = Object.freeze({
  deposit: 'put in', withdraw: 'took out', heraldry: 'changed the guild\'s arms for',   // AUDIT GUILD3 W6: the page is "Arms"
  // SILVER-WAYS: a guild deed (its third member names it), a contract's pay put up, and what came home of it
  deed: 'completed a guild deed:', contract: 'put up a contract of', 'contract-return': 'came home with',
});
/** GUILD3b (bible/11-Multiplayer/Guilds-Made-Plain.md, EVERY RULE BEFORE THE PRESS): A SILVER LINE BY ITS OWN KIND - the
 *  ledger's (`raw`, marksLaw.js MARKS_KINDS) where the service sends it, each kind a guild's treasury is an end of, worded
 *  as `<who> <words> <amount>`; a kind that runs either way (a Conscription, a vassal's fealty share) worded by its
 *  direction. Before it, every line the service had no word for said "put in" - a Tribute, an upkeep, a claim fee, a writ's
 *  escrow, a patron's bid: silver LEAVING the treasury read as silver coming into it. */
export const GUILD_SILVER_LINE_WORDS = Object.freeze({
  'guild-deposit': 'put in', 'guild-withdraw': 'took out',
  heraldry: 'changed the guild\'s arms for', 'guild-deed': 'completed a guild deed:',   // AUDIT GUILD3 W6: the page is "Arms"
  'contract-escrow': 'put up a contract of', 'contract-return': 'had a contract\'s unpaid pay come home:',
  'writ-escrow': 'set aside a guild writ\'s pay of', 'writ-return': 'had a guild writ\'s unpaid pay come home:',
  tribute: 'paid Tribute of', 'seat-claim': 'paid a Charter\'s claim fee of', 'seat-upkeep': 'paid a Charter\'s upkeep of',
  'seat-edict': 'paid for an Edict:', fort: 'paid for the Works:', 'seat-strike-refund': 'had a struck Charter\'s fee refunded:',
  tithe: 'collected a Tithe of', 'bounty-escrow': 'set a Bounty aside:', 'bounty-return': 'had a Bounty\'s unpaid silver come home:',
  'sellsword-escrow': 'hired a Sellsword for', 'sellsword-return': 'had a Sellsword\'s unpaid fee come home:',
  'royal-escrow': 'put up a Royal Tourney prize of', 'royal-return': 'had a Royal Tourney prize come home:',
  'patron-escrow': 'bid for a chapter\'s patronage:', 'patron-return': 'had a patronage bid come home:',
  conscription: Object.freeze({ in: 'received Conscription of', out: 'paid Conscription of' }),
  // AUDIT GUILD3 W5: a vassal's 5% is its FEALTY share - "Tribute" is the seat's, paid where the guild pledged
  'fealty-tribute': Object.freeze({ in: 'received a vassal\'s fealty share of', out: 'paid its liege a fealty share of' }),
});
/** AUDIT GUILD3 W2: THE KINDS WHOSE `who` IS THE MEMBER WHO ACTED - the service writes their display name (marks.js
 *  deposits, withdrawals and deeds; halls.js the arms; contracts.js a contract put up; seatInfluence.js a Tribute;
 *  npcChapters.js a patron's bid). Every other kind's `who` is the service's own label - 'A Sellsword', 'The Turning', 'The
 *  registry', a writ's material, an auction's id, a work's name - and GUILD3b made it the sentence's subject ("A Sellsword
 *  hired a Sellsword for 1,500 silver"): those lines are the guild's own. */
export const GUILD_SILVER_MEMBER_KINDS = Object.freeze(['guild-deposit', 'guild-withdraw', 'heraldry', 'guild-deed', 'contract-escrow', 'tribute', 'patron-escrow']);
/** GUILD3b: a silver line in words - by its own kind and direction where the service sent them (`raw`, `out`); a kind with
 *  no words here said by its direction alone ("paid", "received"), never "put in" for silver that left; the member its
 *  subject where a member acted, the guild where the service did (AUDIT GUILD3 W2); an older service's line (no `raw`) by
 *  its `kind`, as before. */
export function guildSilverLineText(l) {
  const amount = marksText(Number(l?.amount ?? 0));
  if (typeof l?.raw !== 'string') return `${l?.who} ${GUILD_MARKS_LEDGER_WORDS[l?.kind] ?? GUILD_MARKS_LEDGER_WORDS.deposit} ${amount}`;
  const w = Object.hasOwn(GUILD_SILVER_LINE_WORDS, l.raw) ? GUILD_SILVER_LINE_WORDS[l.raw] : null;
  const words = typeof w === 'string' ? w : w ? w[l.out === true ? 'out' : 'in'] : l.out === true ? 'paid' : 'received';
  return `${GUILD_SILVER_MEMBER_KINDS.includes(l.raw) ? l.who : 'The guild'} ${words} ${amount}`;
}
/** AUDIT GUILD1d R13: the hall's sale in words - the service's own sum (the deed share and its pieces' half). */
export const guildHallSoldText = (r) => `The hall is sold. ${Number(r?.data?.back ?? 0).toLocaleString('en-US')} gold went back into the treasury.`;
/** GUILD1d: where a hall stands, in words. */
export const guildHallWhereText = (hall) => `Your hall stands in ${REGION_NAMES[hall?.region] ?? 'the Iliac Bay'}.`;
/** GUILD1b: a guild act's answer in words - the service's sentence (REFUSALS), or the tab's own for the purse. AUDIT2
 *  GUILD2 S2/S7: `r` the answer, its reason said where it names one - the word the name filter caught (net/nameFilter.js's
 *  own law: a player with a real name knows the filter is wrong rather than guessing), and when the next new name may
 *  come (`nowS` the clock it is counted from). */
export function guildWordText(error, r = null, nowS = Math.floor(Date.now() / 1000)) {
  if (error === 'gold') return GUILD_GOLD_SHORT_TEXT;
  if (error === 'guild-unsure') return GUILD_DEPOSIT_UNSURE;
  if (error === 'guild-name-word' && typeof r?.why === 'string' && r.why) return `A guild's name and tag may not contain "${r.why}". That word is not allowed in names.`;
  if (error === 'guild-rank-word' && typeof r?.why === 'string' && r.why) return `A rank's name may not contain "${r.why}". That word is not allowed in names.`;   // TEXT-F1
  if (error === 'guild-rename-soon' && Number.isSafeInteger(r?.at) && r.at > nowS) return guildRenameSoonText(r.at, nowS);
  return accountRefusalText(error);
}
/** GUILD-LETTER (FIELD BUGS 2026-09-30): a guild act's word once done - and a withdrawal paid as a letter of credit (the
 *  book's `letter`: the pack could not carry the coin) says so in the trade window's own line, or the gold reads as
 *  never paid. */
export const guildDoneText = (okWord, r) => (r?.letter === true ? `${okWord} ${LETTER_OF_CREDIT_TEXT}` : okWord);

/** GUILD-UX (2026-10-19, Discord #suggestions "Guild Hall Storage Improvements"): the guild Stores' Put in all - each
 *  `[material, units]` of `moves` deposited through the writs book's own door (`W.deposit`), one after another. Answers
 *  `{ ok: true, moved }`, or the first refusal with how many materials went in before it (`moved`). */
export async function guildPutAll(W, moves) {
  let moved = 0;
  for (const [material, units] of moves) {
    const r = await W.deposit(material, units);
    if (!r?.ok) return { ...(r ?? { ok: false, error: 'server' }), moved };
    moved++;
  }
  return { ok: true, moved };
}

/** The panel's sheet: the enhanced tokens (enhancedStyle.js) where they exist, a fallback where the skin's sheet is
 *  not loaded - the same bargain ui/chatPanel.js strikes.
 *
 *  FONT1 (2026-09-16, Mac: "Especially the new online interfaces font use our enhanced font"): the face is the
 *  skin's pixel stack, not `--data` - see ui/chatPanel.js's CHAT_CSS header for the whole reading. The five's
 *  @font-face rides this sheet for the same reason it rides that one: each is injected on its own.
 *
 *  THE BODY IS A FIXED-HEIGHT FLEX-COLUMN SCROLLER, which is the shape CHAT2 was a bug in: a flex item that hides
 *  its own overflow resolves `min-height: auto` to zero and is squeezed to nothing by the default `flex-shrink: 1`
 *  rather than overflowing into the scroll. So every row, section and empty line in here states `flex: none` from
 *  the first commit. */
export const SOCIAL_CSS = `
${PIXELIFY_FIVE_FACE}
.dfsocial { position: fixed; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(44px + env(safe-area-inset-top, 0px));
  width: min(360px, calc(100vw - 28px)); max-height: min(460px, 70vh); z-index: 6; display: none; flex-direction: column;
  background: rgba(14, 16, 19, .92); border: 1px solid var(--iron, #2b323b); border-radius: 6px; backdrop-filter: blur(4px);
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfsocial[data-open="1"] { display: flex; }
.dfsocial.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
/* beside the chat where there is room for both (14 + 440 + 12) */
@media (min-width: 840px) { .dfsocial { left: calc(466px + env(safe-area-inset-left, 0px)); } }
/* AUDIT SOC C13: ...and BELOW it where there is not. Under 840px the panel and the open chat box shared the same
   corner to the pixel (both left 14, top 44), and the panel - z 6 over the chat's 5 - took the whole box: the lines,
   the field, the tab bar. Measured at 800x900 with both open, elementFromPoint at the box's centre answered
   the panel's own section heading. 390 clears the box's own ceiling (top 44 + tabs 34 + list min(220px, 34vh) + form ~45 = 343) on a
   desktop and the touch skin's 72 + 299 = 371, with room to spare; the max-height follows so the panel still ends
   on the screen it started on. */
@media (max-width: 839px) {
  .dfsocial, .dfsocial.touch { top: calc(390px + env(safe-area-inset-top, 0px)); max-height: min(460px, calc(100vh - 398px)); }
}
/* CHAT-SIZE (2026-09-23, Mac: "click and drag the chat to resize"): the chat is dragged to size now, so the two rules
   above are only a page's with no chat panel. The chat says which side of it this panel fits on (data-dfchat-fit on
   the document: beside when 14 + its box + 12 + this panel's 360 + 14 fits the screen, which at the chat's own size
   is exactly the 840px above) and publishes the width and the list height its own rules read. BESIDE: past the box's
   right edge, at the box's own top. BELOW: past the open box's floor - the list's height plus the box's fixed parts
   (top 44, tabs 34, the form, the jump bar), with the old 390's room to spare: min(220px, 34vh) + 170 IS 390 at the
   chat's own size - and a scaled field's growth on top. */
:root[data-dfchat-fit="beside"] .dfsocial { left: calc(26px + min(var(--dfchat-w, 440px), 100vw - 28px) + env(safe-area-inset-left, 0px));
  top: calc(44px + env(safe-area-inset-top, 0px)); max-height: min(460px, 70vh); }
:root[data-dfchat-fit="beside"] .dfsocial.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
:root[data-dfchat-fit="below"] .dfsocial, :root[data-dfchat-fit="below"] .dfsocial.touch { left: calc(14px + env(safe-area-inset-left, 0px));
  top: calc(var(--dfchat-list-h, min(220px, 34vh)) + 170px + 20px * (var(--dfchat-scale, 1) - 1) + env(safe-area-inset-top, 0px));
  max-height: min(460px, calc(100vh - var(--dfchat-list-h, min(220px, 34vh)) - 178px - 20px * (var(--dfchat-scale, 1) - 1))); }
.dfsocial-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-title { flex: 1; min-width: 0; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
.dfsocial-close { flex: none; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit; font-size: 13px; padding: 2px 8px; cursor: pointer; }
.dfsocial-err { flex: none; padding: 4px 8px; font-size: 12px; color: #e0704a; overflow-wrap: anywhere; }
.dfsocial-err:empty { display: none; }
.dfsocial-note { flex: none; padding: 4px 8px; font-size: 12px; color: #e0b070; }
.dfsocial-note:empty { display: none; }
/* GUILD3c: what each rank may do, folded under its line; what still holds a guild that would go, one line a thing */
.dfsocial-ranks { flex: none; padding: 4px 0; font-size: 12px; color: var(--bone, #e9e4d9); }
.dfsocial-ranks > summary { cursor: pointer; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #9a9486); }
.dfsocial-ranks p { margin: 4px 0; overflow-wrap: anywhere; }
.dfsocial-keeps { flex: none; margin: 2px 0 4px; padding-left: 18px; font-size: 12px; color: #e0b070; }
.dfsocial-banner { flex: none; display: flex; gap: 10px; align-items: flex-start; padding: 4px 0; }
.dfsocial-banner img { flex: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
.dfsocial-tabs { flex: none; display: flex; gap: 2px; padding: 4px 4px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-tab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--dim, #9a9486); font: inherit; font-size: 13px;
  letter-spacing: .05em; text-transform: uppercase; padding: 6px 10px; cursor: pointer; }
.dfsocial-tab.active { color: var(--bone, #e9e4d9); border-bottom-color: var(--brass, #c08a3e); }
.dfsocial-badge { margin-left: 6px; background: #c8503c; color: #f6efe2; border-radius: 8px; padding: 0 6px; font-size: 11px; }
.dfsocial-badge:empty { display: none; }
.dfsocial-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 8px; display: flex; flex-direction: column; }
.dfsocial-sec { flex: none; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #9a9486); padding: 8px 0 2px; }
.dfsocial-row { flex: none; display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.dfsocial-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #5a6068; }
.dfsocial-dot.on { background: ${PARTY_GREEN_CSS}; }
.dfsocial-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dfsocial-name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.dfsocial-sub { font-size: 11px; color: var(--dim, #9a9486); overflow-wrap: anywhere; }
.dfsocial-lead { flex: none; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--brass, #c08a3e); }
.dfsocial-left { flex: none; font-size: 11px; color: var(--dim, #9a9486); }
.dfsocial-btn { flex: none; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit; font-size: 12px; padding: 4px 8px; cursor: pointer; }
.dfsocial-btn[disabled] { opacity: .45; cursor: default; }
.dfsocial-btn.warn { background: #6b2f28; }
/* AUDIT SOC C11: the reason a button is dead, BESIDE the label and not only on its title - a title needs a mouse to
   hover, and half the machines this panel runs on have none. The F-menu's own shape (ui/socialMenu.js .dfpeer-why). */
.dfsocial-why { flex: none; font-size: 11px; font-style: italic; color: var(--dim, #9a9486); margin-left: 4px; }
.dfsocial-why:empty { display: none; }   /* GUILD-LIVE: a live button come alive keeps its span, empty */
.dfsocial-empty { flex: none; font-size: 13px; color: var(--dim, #9a9486); padding: 6px 0; overflow-wrap: anywhere; }
/* MAIL1 (tools/mailProbe.mjs photographed it): A FRIEND'S ACTS ARE ONE GROUP THAT WRAPS. Letter made them three - Invite,
   Letter, Remove - and at the touch skin's 44px buttons, each with its reason beside its label, three are wider than a
   phone's panel: the name beside them was squeezed to one letter a line. The row wraps its acts BELOW the name when it
   cannot hold both at a readable width, and the group wraps within itself when even it is wider than the panel; on a
   desktop the three still stand beside the name. */
.dfsocial-row.wrap { flex-wrap: wrap; }
.dfsocial-row.wrap .dfsocial-who { flex: 1 1 140px; }
.dfsocial-rowacts { flex: none; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-left: auto; max-width: 100%; }
/* MAIL1: THE LETTERS TAB. A letter's row is a BUTTON (the keyboard reaches it, Enter opens it), drawn as a row: the
   brass dot for one not yet opened, who and what about, how long ago. The letter itself keeps its lines (pre-wrap)
   and breaks a word too long for the panel rather than widening it. The form's fields are the panel's own dress. */
.dfsocial-letter { flex: none; display: flex; align-items: flex-start; gap: 6px; padding: 4px 2px; width: 100%; box-sizing: border-box;
  background: none; border: 0; border-radius: 3px; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dfsocial-letter:hover, .dfsocial-letter:focus-visible { background: rgba(125, 116, 96, .18); outline: none; }
.dfsocial-letter .dfsocial-dot { margin-top: 5px; background: transparent; }
.dfsocial-letter .dfsocial-dot.unread { background: var(--brass, #c08a3e); }
.dfsocial-letter.read .dfsocial-name { font-weight: 400; color: var(--dim, #9a9486); }
.dfsocial-glyph { width: 12px; height: 12px; margin-left: 4px; vertical-align: -1px; }
.dfsocial-age { flex: none; font-size: 11px; color: var(--dim, #9a9486); padding-top: 2px; }
.dfsocial-letterhead { flex: none; display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-subject { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.dfsocial-lettertext { flex: none; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.45; padding: 8px 0; }
.dfsocial-acts { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
.dfsocial-form { flex: none; display: flex; flex-direction: column; gap: 4px; padding: 6px 0; }
.dfsocial-label { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #9a9486); margin-top: 4px; }
.dfsocial-field { box-sizing: border-box; width: 100%; background: rgba(0, 0, 0, .35); color: var(--bone, #e9e4d9); border: 1px solid var(--iron, #2b323b);
  border-radius: 3px; font: inherit; font-size: 13px; padding: 5px 6px; }
.dfsocial-field:focus { outline: none; border-color: var(--brass, #c08a3e); }
textarea.dfsocial-field { resize: vertical; min-height: 120px; line-height: 1.4; }
.dfsocial-count { font-size: 11px; color: var(--dim, #9a9486); text-align: right; }
.dfsocial-count.over { color: #e0704a; }

/* GUILD2 (bible/11-Multiplayer/Guild-Overhaul.md): THE GUILD PAGE - its header (the banner beside the name), its page
   strip (wrapping: seven pages are wider than the panel at a phone's width), a member's vault grant beneath its row, and
   the arms' choices drawn - colour swatches and shield tiles, the one picked ringed in brass. */
.dfsocial-guildhead { flex-direction: row; align-items: center; gap: 10px; }
.dfsocial-guildhead img { flex: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
.dfsocial-subtabs { flex: none; display: flex; flex-wrap: wrap; gap: 2px; padding: 4px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-subtab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--dim, #9a9486); font: inherit; font-size: 11px;
  letter-spacing: .05em; text-transform: uppercase; padding: 4px 6px; cursor: pointer; }
.dfsocial-subtab.active { color: var(--bone, #e9e4d9); border-bottom-color: var(--brass, #c08a3e); }
.dfsocial-grant { flex: none; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 0 0 6px 14px; }
.dfsocial-grant .dfsocial-field { width: auto; flex: 1 1 120px; }
.dfsocial-arms { flex: none; display: flex; flex-direction: column; gap: 2px; }
.dfsocial-armspics { flex: none; display: flex; gap: 12px; align-items: flex-end; padding: 4px 0; }
.dfsocial-armspics img { filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
.dfsocial-tagchip { font-size: 12px; font-weight: 600; padding: 1px 6px; border: 2px solid; border-radius: 3px; }
.dfsocial-swatches, .dfsocial-tiles { flex: none; display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 0 4px; }
.dfsocial-swatch { width: 20px; height: 20px; border: 1px solid rgba(0,0,0,.6); border-radius: 3px; padding: 0; cursor: pointer; }
.dfsocial-swatch.on, .dfsocial-tile.on { outline: 2px solid var(--brass, #c08a3e); outline-offset: 1px; }
.dfsocial-swatch[disabled] { opacity: .25; cursor: default; }
.dfsocial-tile { background: rgba(0,0,0,.25); border: 1px solid var(--iron, #2b323b); border-radius: 3px; padding: 2px; cursor: pointer; line-height: 0; }
.dfsocial.touch .dfsocial-subtab { min-height: 44px; padding: 8px 10px; }
.dfsocial.touch .dfsocial-swatch { width: 44px; height: 44px; }
.dfsocial.touch .dfsocial-tile { padding: 8px; }

/* GUILD-WINDOW (2026-10-23, the owner: "overhaul the guild tab to be more of a full fledged detailed window with easy
   navigation and readabity instead of being stuffed as a small window in the social tab" - Guild-Overhaul.md
   GUILD-WINDOW): THE GUILD TAB IS A WINDOW OF ITS OWN. While it is up the panel is the Guild window (data-mode
   "guild"): large, the social tabs put away behind its Social button, the guild's header and tiles over a column of
   its pages, the page up in cards in a column of its own that scrolls under them, at a reading size, and a foot
   where the last act's words stand. The panel's places beside and below the chat are its social mode's alone - the
   open mark and :root put these rules past every one of them (the chat's fit included, whatever size it is dragged
   to) - and nothing of the social mode's moves. Centred, or (AUDIT GUILD-WINDOW W7) beside the chat where the screen
   holds both. Its heights read 100dvh where the browser has it (W6: a phone's toolbar stood over its foot). */
:root .dfsocial[data-mode="guild"][data-open], :root .dfsocial.touch[data-mode="guild"][data-open] {
  --dfguild-w: min(1060px, calc(100vw - 28px));
  left: calc((100vw - var(--dfguild-w)) / 2); width: var(--dfguild-w);
  top: calc((100vh - min(740px, calc(100vh - 56px))) / 2); top: calc((100dvh - min(740px, calc(100dvh - 56px))) / 2);
  height: min(740px, calc(100vh - 56px)); height: min(740px, calc(100dvh - 56px)); max-height: none;
  background: rgba(14, 16, 19, .97); border-color: #4a3b26; box-shadow: 0 12px 48px rgba(0, 0, 0, .6); }
/* AUDIT GUILD-WINDOW W7: BESIDE THE CHAT where the screen holds the chat and a window 760 wide - the chat stays read and
   typed into while the guild is run (AUDIT SOC C13's law, the panel's own); a chat dragged too wide for both leaves the
   window 760 wide over its edge. */
@media (min-width: 1240px) and (min-height: 521px) {
  :root[data-dfchat-fit] .dfsocial[data-mode="guild"][data-open], :root[data-dfchat-fit] .dfsocial.touch[data-mode="guild"][data-open] {
    --dfguild-l: max(calc((100vw - var(--dfguild-w)) / 2), min(calc(26px + min(var(--dfchat-w, 440px), calc(100vw - 28px)) + env(safe-area-inset-left, 0px)), calc(100vw - 774px)));
    left: var(--dfguild-l); width: min(var(--dfguild-w), calc(100vw - 14px - var(--dfguild-l))); }
}
.dfsocial[data-mode="guild"] .dfsocial-tabs { display: none; }
.dfsocial-back { display: none; flex: none; background: none; color: var(--dim, #9a9486); border: 1px solid var(--iron, #2b323b); border-radius: 3px;
  font: inherit; font-size: 12px; padding: 3px 10px; cursor: pointer; }
.dfsocial-back:hover, .dfsocial-back:focus-visible { color: var(--bone, #e9e4d9); border-color: var(--brass, #c08a3e); outline: none; }
.dfsocial[data-mode="guild"] .dfsocial-back { display: block; }
.dfsocial.touch .dfsocial-back { min-height: 44px; padding: 4px 12px; }   /* AUDIT SOC C8's finger, as Close has it */
.dfguild-backbadge { margin-left: 6px; background: #c8503c; color: #f6efe2; border-radius: 8px; padding: 0 6px; font-size: 11px; }
.dfguild-backbadge:empty { display: none; }
.dfsocial[data-mode="guild"] .dfsocial-head { padding: 8px 12px; }
.dfsocial[data-mode="guild"] .dfsocial-title { font-size: 15px; color: var(--brass, #c08a3e); }
.dfsocial[data-mode="guild"] .dfsocial-body { overflow: hidden; padding: 0; }
/* the header: the banner beside the name, and the tiles */
.dfsocial[data-mode="guild"] .dfsocial-guildhead { gap: 16px; padding: 12px 18px; background: linear-gradient(rgba(192, 138, 62, .08), rgba(192, 138, 62, 0)); }
.dfsocial[data-mode="guild"] .dfsocial-guildhead .dfsocial-subject { font-size: 22px; letter-spacing: .03em; }
.dfguild-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.dfguild-stat { flex: none; min-width: 84px; padding: 5px 10px; background: rgba(0, 0, 0, .3); border: 1px solid var(--iron, #2b323b); border-radius: 4px; }
.dfguild-statlabel { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--dim, #9a9486); }
.dfguild-statvalue { font-size: 15px; color: var(--bone, #e9e4d9); overflow-wrap: anywhere; }
.dfguild-statsub { font-size: 11px; color: ${PARTY_GREEN_CSS}; }
/* the pages beside the page */
.dfguild-layout { flex: 1; min-height: 0; display: flex; }
.dfsocial[data-mode="guild"] .dfguild-nav { width: 232px; flex-direction: column; flex-wrap: nowrap; gap: 2px; padding: 10px 8px; overflow-y: auto;
  border-bottom: 0; border-right: 1px solid var(--iron, #2b323b); }
.dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab { display: flex; flex-direction: column; align-items: stretch; gap: 2px; text-align: left;
  border: 0; border-left: 3px solid transparent; border-radius: 0 4px 4px 0; padding: 8px 10px; color: var(--bone, #e9e4d9); text-transform: none; letter-spacing: 0; }
.dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab:hover, .dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab:focus-visible { background: rgba(125, 116, 96, .16); outline: none; }
.dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab.active { background: rgba(192, 138, 62, .16); border-left-color: var(--brass, #c08a3e); }
.dfguild-navtop { display: flex; align-items: baseline; gap: 8px; }
.dfguild-navlabel { flex: 1; font-size: 14px; letter-spacing: .05em; text-transform: uppercase; }
.dfguild-navcount { flex: none; font-size: 12px; color: var(--dim, #9a9486); }
.dfguild-navsub { font-size: 11px; line-height: 1.35; color: var(--dim, #9a9486); }
/* the page: its column, its cards, and a reading size for everything in them */
.dfguild-main { flex: 1; min-width: 0; overflow-y: auto; padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 12px; }
.dfguild-card { flex: none; display: flex; flex-direction: column; padding: 6px 14px 12px; background: rgba(255, 255, 255, .025);
  border: 1px solid var(--iron, #2b323b); border-radius: 6px; }
.dfguild-alone { align-items: center; }
.dfguild-alone > * { box-sizing: border-box; width: 100%; max-width: 640px; }
/* AUDIT GUILD-WINDOW W13: the foot - always drawn, the last act's words in it */
.dfguild-foot { flex: none; box-sizing: border-box; min-height: 34px; display: flex; align-items: center; padding: 6px 18px;
  border-top: 1px solid var(--iron, #2b323b); background: rgba(0, 0, 0, .3); }
.dfsocial[data-mode="guild"] .dfguild-foot .dfguild-said { padding: 0; font-size: 13px; line-height: 1.4; color: var(--bone, #e9e4d9); overflow-wrap: anywhere; }
.dfsocial[data-mode="guild"] .dfguild-foot .dfguild-said.dfsocial-err { color: #e0704a; }
.dfsocial[data-mode="guild"] .dfguild-card > .dfsocial-sec { font-size: 12px; color: var(--brass, #c08a3e); padding: 6px 0; margin-bottom: 4px; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-note { font-size: 13px; line-height: 1.5; color: #e6d3ad; padding: 3px 0; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-empty { font-size: 13px; line-height: 1.5; padding: 4px 0; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-err { font-size: 13px; padding: 4px 0; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-row { padding: 6px 2px; border-bottom: 1px solid rgba(255, 255, 255, .05); }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-row:last-child { border-bottom: 0; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-name { font-size: 15px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-sub { font-size: 12px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-btn { font-size: 13px; padding: 5px 12px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-why { font-size: 12px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-form { max-width: 460px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-label { font-size: 11px; margin-top: 6px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-field { font-size: 14px; padding: 6px 8px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-ranks { font-size: 13px; line-height: 1.5; padding: 6px 0; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-ranks > summary { font-size: 12px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-keeps { font-size: 13px; line-height: 1.5; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-grant { padding: 0 0 8px 18px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-grant .dfsocial-field { flex: 0 1 300px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-filter { max-width: none; flex-direction: row; flex-wrap: wrap; gap: 6px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-filter .dfsocial-field { width: auto; flex: 0 1 200px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-filter .dfsocial-field[type="search"] { flex: 1 1 240px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-swatch { width: 24px; height: 24px; }
.dfsocial[data-mode="guild"] .dfguild-main .dfsocial-armspics { gap: 18px; padding: 8px 0; }
/* AUDIT GUILD-WINDOW W2: THE FINGER'S SIZES OUTRANK THE WINDOW'S - the reading sizes above outweighed AUDIT SOC C8's touch
   rules: every swatch of the Arms 24px under a finger, and a field's 14px made a phone zoom the page into it */
.dfsocial.touch[data-mode="guild"] .dfguild-main .dfsocial-swatch { width: 44px; height: 44px; }
.dfsocial.touch[data-mode="guild"] .dfguild-main .dfsocial-field { font-size: 16px; min-height: 44px; }
@media ${GUILD_SMALL_QUERY} {
  :root .dfsocial[data-mode="guild"][data-open], :root .dfsocial.touch[data-mode="guild"][data-open] {
    left: calc(6px + env(safe-area-inset-left, 0px)); top: calc(6px + env(safe-area-inset-top, 0px));
    width: calc(100vw - 12px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
    height: calc(100vh - 12px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
    height: calc(100dvh - 12px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); }
  .dfsocial[data-mode="guild"] .dfsocial-guildhead { padding: 8px 12px; gap: 10px; }
  .dfsocial[data-mode="guild"] .dfsocial-guildhead img { width: 20px; height: 60px; }
  .dfsocial[data-mode="guild"] .dfsocial-guildhead .dfsocial-subject { font-size: 17px; }
  .dfguild-stat { min-width: 0; padding: 3px 8px; }
  .dfguild-statvalue { font-size: 13px; }
  .dfguild-layout { flex-direction: column; }
  .dfsocial[data-mode="guild"] .dfguild-nav { width: auto; flex: none; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 4px 6px;
    border-right: 0; border-bottom: 1px solid var(--iron, #2b323b); background: rgba(14, 16, 19, .97); }
  .dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab { flex: none; border-left: 0; border-bottom: 2px solid transparent; border-radius: 0; padding: 6px 10px; }
  .dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab.active { border-bottom-color: var(--brass, #c08a3e); }
  .dfguild-navsub { display: none; }
  .dfguild-main { padding: 10px 10px 14px; }
  .dfguild-foot { padding: 6px 12px; }
}
/* AUDIT GUILD-WINDOW W6: A SHORT SCREEN SCROLLS THE WINDOW AS ONE - a phone on its side kept the head, the tiles and the
   row of pages standing and left the page 99 to 169px of it; the row of pages and the foot stay in sight as it goes */
@media (max-height: 520px) {
  .dfsocial[data-mode="guild"] .dfsocial-body { overflow-y: auto; }
  .dfsocial[data-mode="guild"] .dfguild-layout { flex: none; }
  .dfsocial[data-mode="guild"] .dfguild-main { flex: none; overflow: visible; }
  .dfsocial[data-mode="guild"] .dfguild-nav { position: sticky; top: 0; z-index: 1; }
  .dfsocial[data-mode="guild"] .dfguild-foot { position: sticky; bottom: 0; background: rgba(14, 16, 19, .97); }
}
/* AUDIT GUILD-WINDOW W1: THE TOASTS' STRIP IS THEIRS. Where the window takes a narrow screen, an invitation's toast (z 7,
   this panel's) or a duel's (z 8, ui/duelPrompt.js) at the top centre stood over its head - a press on Close landed on
   Decline (AUDIT SOC C3's fault again). While one stands, the window starts below the strip: 76px, where
   duelPrompt.js already stacks a second toast, or below where this panel's toast was measured to end when a long name
   wraps it lower (--dfsocial-toast-b, paintToast); and below a second toast when it stands too. */
@media (max-width: 600px) {
  :root:has(.dfsocial-toast[data-up="1"]) .dfsocial[data-mode="guild"][data-open], :root:has(.dfduel-toast[data-up="1"]) .dfsocial[data-mode="guild"][data-open] {
    --dfguild-t: max(calc(76px + env(safe-area-inset-top, 0px)), calc(var(--dfsocial-toast-b, 0px) + 6px));
    top: var(--dfguild-t);
    height: calc(100vh - var(--dfguild-t) - 6px - env(safe-area-inset-bottom, 0px));
    height: calc(100dvh - var(--dfguild-t) - 6px - env(safe-area-inset-bottom, 0px)); }
  :root:has(.dfduel-toast.second[data-up="1"]) .dfsocial[data-mode="guild"][data-open] {
    top: calc(144px + env(safe-area-inset-top, 0px));
    height: calc(100vh - 150px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
    height: calc(100dvh - 150px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); }
}

/* AUDIT SOC C8: THE FINGER'S OWN SIZES. Every control this panel draws was built at the mouse's scale - the tabs 29
   tall, Close 27x19, Invite and Remove 22 - and online forces the enhanced lane on a phone as readily as on a
   desktop. Under the touch skin each one is at least the 44px the platforms ask for (ui/touch/touch.js draws its own
   buttons at 48), and nothing moves on a desktop. */
.dfsocial.touch .dfsocial-tab { min-height: 44px; padding: 10px 12px; }
.dfsocial.touch .dfsocial-close { min-height: 44px; min-width: 44px; padding: 4px 12px; }
.dfsocial.touch .dfsocial-btn, .dfsocial-toast.touch .dfsocial-btn { min-height: 44px; padding: 8px 12px; font-size: 13px; }
/* MAIL1: a letter's row is a finger's target too, and a field under 16px makes a phone zoom the page into it */
.dfsocial.touch .dfsocial-letter { min-height: 44px; }
.dfsocial.touch .dfsocial-field { min-height: 44px; font-size: 16px; }

/* THE TOAST stands in ITS OWN STRIP, centred at the top of the screen, because an invitation that lapses in two
   minutes is worth reading first - and because it must work with the panel closed, which is where a player who has
   not found the button yet will be.
   AUDIT SOC C3: it used to take the chat's own corner (left 14, top 44) at z 7, which is the chat's open TAB BAR to
   the pixel and, under 840px, the panel's own header: elementFromPoint over the World tab and over the panel's
   Close both answered the toast. Two things changed. It has its own strip now, and the STRIP TAKES NO POINTER at
   all - only its two buttons do, which is ui/chatPanel.js's own split (.dfchat none, .dfchat-box auto) and is what
   keeps a phone's top-left touch buttons pressable underneath a toast that is merely being read. */
.dfsocial-toast { position: fixed; left: 50%; transform: translateX(-50%); top: calc(8px + env(safe-area-inset-top, 0px));
  width: min(440px, calc(100vw - 28px)); z-index: 7; display: none; align-items: center; gap: 8px; box-sizing: border-box;
  pointer-events: none;
  background: rgba(14, 16, 19, .92); border: 1px solid var(--brass, #c08a3e); border-radius: 6px; padding: 6px 8px;
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfsocial-toast[data-up="1"] { display: flex; }
.dfsocial-toast .dfsocial-btn { pointer-events: auto; }
`;

/** The sheet, once. */
export function injectSocialStyle(doc = document) {
  if (doc.getElementById?.(SOCIAL_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = SOCIAL_STYLE_ID;
  el.textContent = SOCIAL_CSS;
  (doc.head ?? doc.body).append(el);
}

/** PARTY-LEAD: the party row's button that hands the lead on. */
export const MAKE_LEADER_TEXT = 'Make leader';

/** What is left of an invitation, in a row's words: "1:58 left", "12s left", "expired" at the end. `ms` is what
 *  remains of it, on the relay's clock (net/social.js now()). */
export function inviteLeftText(ms) {
  const s = Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000);
  if (s <= 0) return 'expired';
  if (s < 60) return `${s}s left`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
}

/** A party member's LAST POSE in a row's words - "Daggerfall - 50/60 HP". The place is the pose's own label (the
 *  relay bounded and filtered it, net/wire.js PARTY_LOC_MAX) and the vitals are health, because health is the one a
 *  party reads at a glance. A member who has sent no pose yet says nothing rather than "0/0". */
export function partyPoseText(p) {
  if (!p) return '';
  const hp = `${Math.round(p.h ?? 0)}/${Math.round(p.hm ?? 0)} HP`;
  const loc = typeof p.loc === 'string' ? p.loc.trim() : '';
  return loc ? `${loc} - ${hp}` : hp;
}

/**
 * The friends list's order: ONLINE FIRST, then by name.
 *
 * "see if they are online/last online" is the question this list exists to answer, and the friend a player is
 * looking for is almost always one they could talk to right now - so presence is the first clause and the rest of
 * the list is a directory under it. The name clause is net/roster.js's exactly - its NAME_ORDER (case-insensitive and numeric, so
 * `bob` sits with `Bob` and `Player10` after `Player9`), and the account id is the last tie-break, because two
 * friends may share a name and a list that reshuffles when a presence frame lands is the defect that clause
 * prevents.
 *
 * Pure, and takes the Map or anything iterable of rows.
 */
export function friendOrder(friends) {
  const rows = friends?.values ? [...friends.values()] : [...(friends ?? [])];
  return rows.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)
    || NAME_ORDER.compare(String(a.name), String(b.name))   // AUDIT 637 A11: localeCompare with options built a collator a comparison
    || (a.acct < b.acct ? -1 : a.acct > b.acct ? 1 : 0));
}

/**
 * The panel over a SocialState (net/social.js).
 *
 * `send(act)` takes one social act (`{k, acct?|peer?|party?}`) and answers false when it did not leave this machine
 * - the host points it at the hub link's `sendSocial`. `canOpen()` is the host's word on whether the game can take
 * a pointer surface right now; `onOpen`/`onClose` are its pointer-lock door (free the cursor on open, take it back
 * on close, inside the gesture) - the same three ui/chatPanel.js is handed, because this panel is the same kind of
 * thing. Handed the document and the window so the tests drive it headless.
 *
 * AUDIT SOC C2/C14: `above()` is the host's word on whether a surface stands OVER this one (the F-menu). All three
 * social surfaces listen for Escape on the window in capture, so one press closed two of them. The topmost answers:
 * a panel with something above it IGNORES the key (does not close, does not stop it), and the one that handles it
 * calls `stopImmediatePropagation` so no other window listener - the host's pause door included - sees that press.
 */
export function createSocialPanel({ social, send = null, mail = null, guild = null, keepLetter = null, journey = () => null, canLead = () => false, canOpen = () => true, onOpen = null, onClose = null, above = () => false, overlay = overlayOpen, doc = document, win = globalThis, touch = isTouchDevice(), itemCard = ITEM_CARD } = {}) {
  injectSocialStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };

  const root = el('div', `dfsocial${touch ? ' touch' : ''}`);
  root.dataset.open = '0';
  // AUDIT SOC C21: a labelled DIALOG, not an unnamed div with a stray aria-label - this panel takes the pointer and
  // the keyboard off the world while it stands, which is the one thing `role="dialog"` says.
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', SOCIAL_LABEL);
  root.dataset.mode = 'social';   // GUILD-WINDOW: 'guild' while the Guild tab is up - the panel is the Guild window then
  const head = el('div', 'dfsocial-head');
  const closeBtn = el('button', 'dfsocial-close', '✕');
  closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', CLOSE_SOCIAL_LABEL);
  const titleEl = el('div', 'dfsocial-title', 'Social');
  // GUILD-WINDOW: the Guild window's way back to the social tabs it put away - drawn in the window alone (its sheet)
  const backBtn = guild ? el('button', 'dfsocial-back', t('social.guild.back', '← Social')) : null;
  // AUDIT GUILD-WINDOW W11: its name holds the word it shows (and no Letters where there is no letterbox); W16: and the
  // social tabs' badges summed beside it - a friend's request, an invitation, a letter are not hidden with their tabs
  const backBadge = backBtn ? el('span', 'dfguild-backbadge') : null;
  if (backBtn) { backBtn.type = 'button'; backBtn.setAttribute('aria-label', t('social.guild.backLabel', 'Back to Social')); backBtn.append(backBadge); }
  head.append(...(backBtn ? [backBtn] : []), titleEl, closeBtn);
  // the hub's last refusal, in the hub's own words - the world tab gets it as a system line too (world.js
  // socialStart), and a player reading the panel should not have to look away from it to find out why nothing moved
  const err = el('div', 'dfsocial-err');
  const note = el('div', 'dfsocial-note');
  const tabs = el('div', 'dfsocial-tabs');
  const body = el('div', 'dfsocial-body');
  const tabBtns = new Map();
  tabs.setAttribute('role', 'tablist');
  // MAIL1: the third tab, where the host has a letterbox to hand (net/mail.js) - a panel without one is the two it was
  // GUILD1b: and the fourth, where the host has a guild book (net/guild/guildBook.js)
  for (const [id, label] of [['friends', 'Friends'], ['party', 'Party'], ...(mail ? [['letters', 'Letters']] : []), ...(guild ? [['guild', 'Guild']] : [])]) {
    const b = el('button', 'dfsocial-tab', label);
    b.type = 'button'; b.dataset.tab = id;
    b.setAttribute('role', 'tab');                    // AUDIT SOC C21: a tab that says it is one...
    b.setAttribute('aria-selected', id === 'friends' ? 'true' : 'false');   // ...and which one is up (Friends opens)
    const badge = el('span', 'dfsocial-badge');
    b.append(badge);
    b.addEventListener('click', () => { if (tab === id) return; tab = id; confirm = null; ui++; if (id === 'letters') lookAtLetters(); if (id === 'guild') lookAtGuild(); if (open) repaint(); });
    tabs.append(b);
    tabBtns.set(id, { b, badge });
  }
  root.append(head, err, note, tabs, body);
  doc.body.append(root);

  const toast = el('div', `dfsocial-toast${touch ? ' touch' : ''}`);
  toast.dataset.up = '0';
  const toastWho = el('div', 'dfsocial-who');
  const toastName = el('div', 'dfsocial-name');
  const toastSub = el('div', 'dfsocial-sub');
  toastWho.append(toastName, toastSub);
  const toastYes = el('button', 'dfsocial-btn', 'Accept'); toastYes.type = 'button';
  const toastNo = el('button', 'dfsocial-btn', 'Decline'); toastNo.type = 'button';
  toast.append(toastWho, toastYes, toastNo);
  doc.body.append(toast);

  let alive = true;
  let open = false;
  let tab = 'friends';
  let socialTab = 'friends';   // GUILD-WINDOW: the social tab last up, where the window's Social button goes back to
  let focusOwed = false;   // AUDIT GUILD-WINDOW W10: the window entered, its page's tab owed the focus until it is drawn
  /** PARTY-READY (2026-10-01, Mac: "when party readying up, the ui element is hidden"): the Party tab a covering window
   *  took down mid-journey - the travel map its own Travel map opened, or any window over an open round - put back when
   *  the cover lifts. A cover still closes the panel (SOC3); the journey's controls no longer stay gone with it. */
  let resumeParty = false;
  let confirm = null, confirmAt = -Infinity;   // the account whose Remove is armed, and when it was armed
  let noteMsg = '', noteAt = -Infinity;
  let ui = 0;                                  // the panel's OWN version - a tab, a confirm, an act just sent
  let painted = -1, paintedUi = -1, paintedMail = -1, paintedGuild = -1;
  /** AUDIT 31 H2: the character the Guild tab was painted for - its guild Stores are that character's own (its deposit,
   *  its Stores), so another character is a repaint whether or not the guild's view moved. */
  let paintedWho = '';
  const guildWho = () => { try { return String(guild?.profStores?.character?.() ?? ''); } catch { return ''; } };
  let paintedJourney = '';   // PARTY-UI: the journey the body was painted with (journeyKey)
  let paintedLead = false;   // PARTY-LEAD: whether the hub knew party.lead when the body was painted
  let ticking = [];                            // [{ el, expires }] - the countdowns drawn right now
  let liveSubs = [];                           // [{ el, of() }] - the sub-texts that go stale on the CLOCK alone (B8)
  let liveBtns = [];                           // [{ b, of() }] - GUILD-LIVE: the buttons whose state is read off a draft
  let liveDots = [];                           // [{ el, of() }] - GUILD-SEEN: the presence dots that go out on the CLOCK alone
  const dotClass = (online) => `dfsocial-dot${online ? ' on' : ''}`;
  let toasted = null;                          // the invitation the toast is showing, or null
  let toastFoot = -1, toastSaid = ['', ''];    // AUDIT GUILD-WINDOW W1: where the toast ends, and the words it was measured with
  // MAIL1: the Letters tab's own state. `mode` is the view (the box, one letter, the form); `draft` is the form's words,
  // kept HERE and written on every keystroke, so a repaint - or a close and a reopen - never loses a letter half
  // written; `sending` holds the Send button down while one is out; `del` is the letter whose Delete is armed.
  // JOURNAL1: `kept` - the letters this sitting has copied into the journal, so Keep says it has and is not pressed twice
  const letters = { mode: 'list', id: null, draft: { to: '', subject: '', body: '' }, sending: false, del: null, delAt: -Infinity, word: '', kept: new Set() };
  /** A look at the box when the tab opens - unless one landed a moment ago (the host's poll, or the last opening). The
   *  box's own clock, not the relay's (`social.now()`): `at` is stamped by it. What the look finds repaints on the
   *  next frame, off `mail.version`, like everything else here. */
  const lookAtLetters = () => { if (mail && (!mail.at || mail.now() - mail.at > LETTERS_FRESH_MS)) mail.refresh(); };
  // GUILD1b: the Guild tab's own state - the words of the last act (`word`, `bad` when it was a refusal), the forms'
  // drafts kept on every keystroke as the letter's are, and the one dangerous act armed (`arm`: 'leave', 'disband',
  // 'remove:<member>', 'hand:<member>') - the first press arms it, the second does it, SOCIAL_CONFIRM_MS disarms it
  const guildUi = { word: '', bad: false, draft: { name: '', tag: '', handle: '', gold: '', ranks: null }, arm: null, armAt: -Infinity };
  // AUDIT 31 H2: and the guild Stores read again at each look - they move while the tab is shut
  // AUDIT GUILD2 M2: and the vault read again at each look - read once a session, a piece another member took stood with
  // its Take until the panel was reloaded
  const lookAtGuild = () => { guildUi.storesAsked = false; guildUi.vaultAsked = false; if (guild?.stale?.()) guild.refresh(); };

  /** One act out. A refusal that is the RATE GATE's (`send` answered false) is not the player's fault and not the
   *  row's: the button stays as it was and the note says so, because the act was right and the moment was not. */
  const act = (a) => {
    const ok = send?.(a) === true;
    noteMsg = ok ? '' : TRY_AGAIN_TEXT;
    noteAt = social.now();
    ui++;
    if (open) repaint();
    return ok;
  };

  const btn = (label, { enabled = true, why = null, warn = false, run = null } = {}) => {
    const b = el('button', `dfsocial-btn${warn ? ' warn' : ''}`, label);
    b.type = 'button';
    if (!enabled) {
      b.disabled = true;
      // AUDIT SOC C11: the reason is DRAWN as well as titled. A `title` is a desktop hover and nothing at all on a
      // phone, so "offline" and "the party is full" were invisible on exactly the machines where a player cannot
      // hover to find out. The title stays for the mouse; the span is for everyone else (the F-menu's own shape).
      if (why) { b.setAttribute('title', String(why)); b.append(b.whyEl = el('span', 'dfsocial-why', String(why))); }
    }
    // GUILD-LIVE: the press asks the button as it stands at the press - a live one (liveBtn) comes alive under a caret,
    // never rebuilt, so its listener is there from the build and a dead one does nothing
    b.addEventListener('click', () => { if (!b.disabled) run?.(); });
    return b;
  };

  /** GUILD-LIVE (2026-09-27, Discord: the guild's "Buttons not selectable until closed and reopened"): A BUTTON THAT
   *  READS A DRAFT. Found, Invite, Deposit, Withdraw and Rename ranks are enabled by what is typed - and a keystroke
   *  rebuilds nothing under the caret (the drafts' own law), so a state read once at the build stood until the tab was
   *  painted again for some other reason: an amount typed and Deposit still dead until the panel was shut and opened.
   *  `of()` answers `{ enabled, why }`, read at the build, on every keystroke of the tab's fields and on the live pass;
   *  what the press does is read off the draft at the press, never captured at the build. */
  const liveBtn = (label, of, opts = {}) => {
    const b = btn(label, { ...opts, ...of() });
    liveBtns.push({ b, of });
    return b;
  };
  const paintLiveBtns = () => {
    for (const { b, of } of liveBtns) {
      const { enabled = true, why = null } = of();
      const w = !enabled && why ? String(why) : '';
      if (b.disabled !== !enabled) b.disabled = !enabled;
      if ((b.attrs?.title ?? b.getAttribute?.('title') ?? '') !== w) b.setAttribute('title', w);
      if (w && !b.whyEl) b.append(b.whyEl = el('span', 'dfsocial-why', w));
      else if (b.whyEl && b.whyEl.textContent !== w) b.whyEl.textContent = w;   // an empty reason hides (.dfsocial-why:empty)
    }
  };

  /** A person's row: the presence dot, the name (in the colour their standing earns), what they are doing under it.
   *  The sub-text node is left ON the row (`subNode`) because some of those sentences go stale where nothing in the
   *  picture changed - see `liveSubs` and AUDIT SOC B8. */
  const personRow = ({ name, sub = '', online = null, colour = null, lead = false, seen = '' }) => {
    const r = el('div', 'dfsocial-row');
    if (online !== null) { r.dotNode = el('div', dotClass(online)); r.append(r.dotNode); }
    const who = el('div', 'dfsocial-who');
    const nameEl = el('div', 'dfsocial-name', String(name ?? ''));
    if (colour) nameEl.style.color = colour;
    who.append(nameEl);
    if (sub) { const s = el('div', 'dfsocial-sub', String(sub)); who.append(s); r.subNode = s; }
    // GUILD-SEEN: a line of its own under the first - a guild member's "last online" beneath their rank
    if (seen) { const s = el('div', 'dfsocial-sub', String(seen)); who.append(s); r.seenNode = s; }
    r.append(who);
    if (lead) r.append(el('span', 'dfsocial-lead', 'Leader'));
    return r;
  };

  /** Can this friend be invited, and if not, why not. The reasons are net/social.js's own (actionsFor over one of
   *  their tabs - it is the one that knows the party's seats), with OFFLINE ahead of them: a friend with no tab in
   *  the world has no socket for the hub to reach, and "offline" is a truer sentence than "the party is full". */
  const inviteState = (r) => {
    const peer = r.peers?.[0] ?? null;
    if (!r.online || !peer) return { can: false, why: 'offline' };
    const a = social.actionsFor(peer);
    return { can: a.canInvite, why: a.whyNotInvite };
  };

  /** THE FRIENDS TAB: what is waiting on me first, then everyone I have. */
  const friendsBody = () => {
    const out = [];
    const ins = social.in ?? [], outs = social.out ?? [];
    if (ins.length || outs.length) {
      out.push(el('div', 'dfsocial-sec', 'Requests'));
      // AUDIT ONLINE A6: A PENDING REQUEST CARRIES NO PRESENCE. The hub sends `online: false`, `seen: null` and no
      // peers on an `in`/`out` row either way - a stranger who asked to be your friend must not learn when you are
      // at your desk from the asking. So the row draws NO DOT (`online: null`) and this panel reads neither `seen`
      // nor `peers` off one: the only presence it draws is a friend's, which is a friendship both sides agreed to.
      for (const r of ins) {
        const n = personRow({ name: r.name, sub: 'wants to be your friend', online: null });
        n.append(btn('Accept', { run: () => act({ k: 'friend.accept', acct: r.acct }) }),
          btn('Decline', { run: () => act({ k: 'friend.decline', acct: r.acct }) }));
        out.push(n);
      }
      for (const r of outs) {
        const n = personRow({ name: r.name, sub: 'request sent', online: null });
        n.append(btn('Cancel', { run: () => act({ k: 'friend.cancel', acct: r.acct }) }));
        out.push(n);
      }
    }
    const rows = friendOrder(social.friends);
    out.push(el('div', 'dfsocial-sec', `Friends (${rows.length})`));
    if (!rows.length) out.push(el('div', 'dfsocial-empty', NO_FRIENDS_TEXT));
    for (const r of rows) {
      const seated = social.inMyParty(r.acct);
      const n = personRow({
        name: r.name,
        sub: lastOnlineText(r.online, r.seen, social.now()),
        online: r.online,
        colour: seated ? PARTY_GREEN_CSS : FRIEND_CSS,
      });
      // AUDIT SOC B8: "Last online 5 min ago" is a sentence about the CLOCK, and the clock moves with nothing in the
      // picture changing - so it is re-read on the live pass, written only where the words actually differ.
      if (n.subNode) liveSubs.push({ el: n.subNode, of: () => lastOnlineText(r.online, r.seen, social.now()) });
      const inv = inviteState(r);
      // MAIL1: the row's acts are one group (.dfsocial-rowacts), which wraps below the name where the row cannot hold both
      n.className += ' wrap';
      const acts = el('div', 'dfsocial-rowacts');
      n.append(acts);
      // a friend is invited by ACCOUNT - the person, not whichever tab they happen to have open (net/wire.js
      // SOCIAL_ACTS: party.invite takes either, and the hub resolves a peer to the account behind it anyway)
      acts.append(btn('Invite', { enabled: inv.can, why: inv.why, run: () => act({ k: 'party.invite', acct: r.acct }) }));
      // MAIL1: a letter, online or not - which is the point of one. NAME-AS (2026-10-12): ADDRESSED TO THE ACCOUNT, never
      // to the name on the row - that is the name the room reads, which may be their character's (no username at all, or
      // somebody else's), so the shape of it says nothing about a username any more. A friend who is still a guest has
      // no letterbox, and the service says so in its own words (`reader-guest`).
      if (mail) acts.append(btn('Letter', { run: () => { tab = 'letters'; writeTo(r.name, '', r.acct); } }));
      // ONE CLICK ARMS, THE SECOND SENDS. No `window.confirm`: it is a modal the game cannot dismiss, it steals the
      // pointer this panel just freed, and on a touch device it is a different surface entirely.
      acts.append(confirm === r.acct
        ? btn('Sure?', { warn: true, run: () => { confirm = null; act({ k: 'friend.remove', acct: r.acct }); } })
        : btn('Remove', { run: () => { confirm = r.acct; confirmAt = social.now(); ui++; if (open) repaint(); } }));
      out.push(n);
    }
    return out;
  };

  /** THE INVITATIONS, on the Party tab - where a player who accepts one is about to be looking anyway. The toast
   *  carries the same two buttons for a player who never opened the panel. */
  const invitesBody = () => {
    const out = [];
    const invites = social.liveInvites();
    if (!invites.length) return out;
    out.push(el('div', 'dfsocial-sec', 'Party invitations'));
    for (const inv of invites) {
      const n = personRow({ name: `${inv.from.name} invites you`, sub: inv.members.map((m) => m.name).join(', ') });
      const left = el('span', 'dfsocial-left', inviteLeftText(inv.expires - social.now()));
      ticking.push({ el: left, expires: inv.expires });
      n.append(left,
        btn('Accept', { run: () => act({ k: 'party.accept', party: inv.party }) }),
        btn('Decline', { run: () => act({ k: 'party.decline', party: inv.party }) }));
      out.push(n);
    }
    return out;
  };

  /** PARTY-UI (2026-09-26, Mac: "Instead of party chat commands, we need to add the party travel commands to the UI"):
   *  THE JOURNEY, on the Party tab - the chat's /leader and /travel as buttons over the one door (`journey()`, the
   *  host's systems/party/partyTravel.js session: its `command` and `respond`), what they answer written as the panel's
   *  note. The leader: the round and its call-off, or the travel map where one is chosen. A member: the leader's round
   *  with Ready and Stay behind (gathered - else why not), a journey under way, and the journey to a leader who stands
   *  in another place. Nothing at all where there is nothing to do. */
  const journeyBody = () => {
    const j = journey?.();
    const st = j?.status?.();
    if (!st) return [];
    const said = (line) => { noteMsg = line ? String(line) : ''; noteAt = social.now(); ui++; if (open) repaint(); };
    let r = null;
    if (st.role === 'leader') {
      if (st.round?.set) r = personRow({ name: `Setting out for ${st.round.dest}` });
      else if (st.round) {
        r = personRow({ name: `To ${st.round.dest}`, sub: st.round.count });
        // AUDIT PARTY-UI 6: the count moves as members cross the gather radius - written in place, never a rebuild
        if (r.subNode) liveSubs.push({ el: r.subNode, of: () => j.status?.()?.round?.count ?? '' });
        r.append(btn('Call off', { warn: true, run: () => said(j.command('travel')) }));
      } else {
        // AUDIT PARTY-UI 1/2: a destination chosen on the map is the round only outdoors (the map opens nowhere else),
        // through a hub that carries it, with somebody gathered - else it is a journey alone, so the button says why.
        // AUDIT PARTY-UI2 3/4: and with no round of mine still held for its followers. Where two are missing, the one
        // gathering cannot mend is said first - an old hub, a held round - before "Gather the party first".
        const why = !st.outdoors ? 'Step outside' : !st.hub ? 'Needs the server\'s next update'
          : st.held ? 'The party is still on its way' : !st.gathered ? 'Gather the party first' : null;
        r = personRow({ name: 'Travel together', sub: 'Choose a destination on the travel map. The party gathered with you is asked to come along.' });
        r.append(btn('Travel map', { enabled: !why, why, run: () => { resumeParty = true; j.openMap?.(); } }));   // PARTY-READY: back to the round once the map closes
      }
    } else if (st.round) {
      const sub = st.round.ready ? 'You are ready.' : st.round.staying ? 'You stay behind.' : `${st.leader} asks the party to come along.`;
      r = personRow({ name: `To ${st.round.dest}`, sub });
      const why = st.round.gathered ? null : `Gather with ${st.leader} to answer`;
      if (!st.round.ready) r.append(btn('Ready', { enabled: !why, why, run: () => said(j.respond(true)) }));
      if (!st.round.staying) r.append(btn('Stay behind', { enabled: !why, why, run: () => said(j.respond(false)) }));
    } else if (st.following) r = personRow({ name: `Following ${st.leader}`, sub: 'You travel once they arrive.' });
    else if (st.away) {
      r = personRow({ name: `${st.leader} is elsewhere` });
      // AUDIT PARTY-UI 5: indoors the journey only answers "Step outside..." - so the button says it instead
      r.append(btn(`Travel to ${st.leader}`, { enabled: !!st.outdoors, why: 'Step outside', run: () => said(j.command('leader')) }));
    }
    return r ? [el('div', 'dfsocial-sec', 'Journey'), r] : [];
  };
  /** PARTY-UI: the journey as the live pass compares it - it moves on poses, which move no version. AUDIT PARTY-UI 6:
   *  keyed on what draws the block's rows and buttons alone - a rebuild replaces every button on the tab (Kick, Leave,
   *  Call off), and a click that straddles one is lost (AUDIT PARTY8), so the round's count, which moves as members
   *  cross the gather radius, is left out and written in place. */
  const journeyKey = () => {
    if (tab !== 'party') return '';
    const st = journey?.()?.status?.();
    return st ? JSON.stringify(st, (k, v) => (k === 'count' ? undefined : v)) : '';
  };

  /** THE PARTY TAB: the seats, or the sentence that says there are none. */
  const partyBody = () => {
    const out = [];
    const p = social.party;
    if (!p) out.push(el('div', 'dfsocial-empty', NO_PARTY_TEXT));
    else {
      out.push(el('div', 'dfsocial-sec', `Your party (${p.members.length}/${PARTY_MAX})`));
      const leads = social.leads();
      for (const m of p.members) {
        const me = m.acct === social.acct;
        const n = personRow({
          name: m.name,
          sub: partyPoseText(m.p),
          online: m.online,
          colour: me ? null : PARTY_GREEN_CSS,   // "the players name who are in a party together should turn green"
          lead: m.acct === p.leader,
        });
        // AUDIT PARTY8 (2026-09-23): a member's POSE writes this one line in place on the live pass - it used to raise
        // the picture's version, and a repaint rebuilds every button, so with the panel open a click that straddled a
        // companion's pose (up to seven a second at eight seats) landed on a node that was no longer there: Kick,
        // Leave and Accept silently did nothing. The row object `m` is the picture's own and applyParty writes its `p`.
        if (n.subNode) liveSubs.push({ el: n.subNode, of: () => partyPoseText(m.p) });
        // KICK IS THE LEADER'S (SOC1's law, and the hub refuses anyone else) - so it is drawn for nobody else
        // PARTY-LEAD: the lead handed on - the leader's alone too, through a hub that knows the act (canLead), to a seat
        // that is online (the hub refuses an away seat: AUDIT PARTY8's lead nobody could use)
        if (!me && leads && canLead()) n.append(btn(MAKE_LEADER_TEXT, { enabled: m.online !== false, why: 'offline', run: () => act({ k: 'party.lead', acct: m.acct }) }));
        if (!me && leads) n.append(btn('Kick', { warn: true, run: () => act({ k: 'party.kick', acct: m.acct }) }));
        out.push(n);
      }
      out.push(...journeyBody());   // PARTY-UI
      const leave = el('div', 'dfsocial-row');
      leave.append(btn('Leave party', { warn: true, run: () => act({ k: 'party.leave' }) }));
      out.push(leave);
    }
    out.push(...invitesBody());
    return out;
  };

  // ── MAIL1: THE LETTERS TAB ────────────────────────────────────────────────────────────────────────────────────
  // The box (net/mail.js MailBox) decides everything about the letters; this draws it. Three views: the LIST (the
  // box, newest first), ONE LETTER, and the FORM. Every word on them came from another player's keyboard and is
  // written with textContent, like everything else on this panel.

  /** The sentence for a letter's refusal: the service's own table, and the one state the box names itself. */
  const letterWordText = (error) => (error === 'signed-out' ? LETTERS_SIGNED_OUT_TEXT : accountRefusalText(error));
  /** A sender's name with their glyphs after it, in the one drawing (ui/playerBadge.js glyphSvgNode). */
  const senderNode = (cls, text, l) => {
    const n = el('div', cls, text);
    for (const g of glyphBadges(l)) { const svg = glyphSvgNode(doc, g, 'dfsocial-glyph', 1.6); if (svg) n.append(svg); }
    return n;
  };
  /** Into one of the tab's views. */
  const lettersTo = (mode, id = null) => { letters.mode = mode; letters.id = id; letters.del = null; ui++; if (open) repaint(); };
  /** THE FORM, on a draft: a fresh one to `to` (a friend's row, a reply), or - named nothing - the words already there.
   *  NAME-AS: `account`, a friend's account id - the letter goes to the account, `to` only the name it is shown by. */
  const writeTo = (to = null, subject = '', account = null) => {
    if (to != null) letters.draft = { to: String(to), account: typeof account === 'string' && account ? account : null, subject: String(subject ?? ''), body: '' };
    letters.word = '';
    lettersTo('write');
  };
  /** OPEN ONE: the view first, the letter when it comes (from this sitting's copy, or the service, which marks it read). */
  const openLetter = (id) => {
    letters.word = '';
    lettersTo('read', id);
    mail.open(id).then((r) => {
      if (r.ok) return;
      letters.word = letterWordText(r.error);
      if (r.error === 'no-letter') letters.mode = 'list';
      ui++;
    });
  };

  const listBody = () => {
    if (mail.state === 'signed-out') return [el('div', 'dfsocial-empty', LETTERS_SIGNED_OUT_TEXT)];
    if (mail.state === 'guest') return [el('div', 'dfsocial-empty', accountRefusalText('mail-needs-account'))];
    const out = [];
    const acts = el('div', 'dfsocial-acts');
    acts.append(btn('Write a letter', { run: () => writeTo('') }));
    out.push(acts);
    if (letters.word) out.push(el('div', 'dfsocial-empty', letters.word));
    if (mail.state === 'error') out.push(el('div', 'dfsocial-err', letterWordText(mail.error)));
    if (mail.state === 'unknown') { out.push(el('div', 'dfsocial-empty', LETTERS_LOOKING_TEXT)); return out; }
    // the box's fill beside its name: a reader should see a full box coming, because at the bound a sender is refused
    out.push(el('div', 'dfsocial-sec', `Letters (${mail.letters.length}/${mail.max})`));
    if (!mail.letters.length) out.push(el('div', 'dfsocial-empty', NO_LETTERS_TEXT));
    for (const l of mail.letters) {
      const row = el('button', `dfsocial-letter${l.read ? ' read' : ''}`);
      row.type = 'button';
      row.setAttribute('aria-label', `${l.read ? '' : 'Unread. '}From ${l.from}: ${l.subject}`);
      row.append(el('div', `dfsocial-dot${l.read ? '' : ' unread'}`));
      const who = el('div', 'dfsocial-who');
      who.append(senderNode('dfsocial-name', l.from, l), el('div', 'dfsocial-sub', l.subject));
      const age = el('span', 'dfsocial-age', letterAgeText(l.sentAt, mail.now()));
      liveSubs.push({ el: age, of: () => letterAgeText(l.sentAt, mail.now()) });   // "5 min ago" moves on the clock alone
      row.append(who, age);
      row.addEventListener('click', () => openLetter(l.id));
      out.push(row);
    }
    return out;
  };

  const readBody = () => {
    const out = [];
    const top = el('div', 'dfsocial-acts');
    top.append(btn('Back', { run: () => { letters.word = ''; lettersTo('list'); } }));
    out.push(top);
    const l = mail.opened.get(letters.id);
    if (!l) { out.push(el('div', letters.word ? 'dfsocial-err' : 'dfsocial-empty', letters.word || LETTERS_LOOKING_TEXT)); return out; }
    const head = el('div', 'dfsocial-letterhead');
    const age = el('div', 'dfsocial-sub', `Sent ${letterAgeText(l.sentAt, mail.now())}`);
    liveSubs.push({ el: age, of: () => `Sent ${letterAgeText(l.sentAt, mail.now())}` });
    const titled = titleBadge(l)?.text ?? null;   // AUDIT B7 (SHADOW-FANG): the title's words, never its key ("shadowfang")
    head.append(el('div', 'dfsocial-subject', l.subject), senderNode('dfsocial-sub', `From ${l.from}${titled ? ` - ${titled}` : ''}`, l), age);
    out.push(head, el('div', 'dfsocial-lettertext', l.body));
    if (letters.word) out.push(el('div', 'dfsocial-err', letters.word));
    if (keepLetter && letters.kept.has(l.id)) out.push(el('div', 'dfsocial-empty', LETTER_KEPT_NOTE));
    const acts = el('div', 'dfsocial-acts');
    // a reply goes to whoever wrote - their name as the letter carries it is the handle it came from
    acts.append(btn('Reply', { enabled: handleShapeOk(l.from), why: 'no username', run: () => writeTo(l.from, replySubject(l.subject)) }));
    // JOURNAL1 (Addison Knox: "Player journals ... shared"): a letter KEPT in my journal - a note, dated when I kept it,
    // that says who wrote it and what about (net/journalPage.js keptLetterTokens); once, where the host has a journal
    if (keepLetter) {
      const kept = letters.kept.has(l.id);
      acts.append(btn(kept ? 'Kept in your journal' : 'Keep in my journal', { enabled: !kept, run: () => {
        if (keepLetter(l) === true) { letters.kept.add(l.id); letters.word = ''; } else letters.word = LETTER_KEEP_FAILED_TEXT;
        ui++; if (open) repaint();
      } }));
    }
    // ONE CLICK ARMS, THE SECOND THROWS IT AWAY - the friends list's Remove, for the same reasons
    acts.append(letters.del === l.id
      ? btn('Sure?', { warn: true, run: () => {
        letters.del = null;
        mail.remove(l.id).then((r) => { letters.word = r.ok ? 'Letter thrown away.' : letterWordText(r.error); if (r.ok) letters.mode = 'list'; ui++; });
      } })
      : btn('Delete', { run: () => { letters.del = l.id; letters.delAt = social.now(); ui++; if (open) repaint(); } }));
    out.push(acts);
    return out;
  };

  const writeBody = () => {
    const d = letters.draft;
    const form = el('div', 'dfsocial-form');
    const field = (tag, label, value, max) => {
      const f = doc.createElement(tag);
      f.className = 'dfsocial-field';
      if (tag === 'input') f.type = 'text';
      f.maxLength = max;
      f.value = value;
      f.setAttribute('aria-label', label);
      f.setAttribute('autocomplete', 'off');
      form.append(el('div', 'dfsocial-label', label), f);
      return f;
    };
    const to = field('input', 'To', d.to, HANDLE_MAX_LEN);
    to.setAttribute('spellcheck', 'false');
    const subject = field('input', 'Subject', d.subject, LETTER_SUBJECT_MAX);
    const body = field('textarea', 'Letter', d.body, LETTER_BODY_MAX);
    body.rows = 8;
    const count = el('div', 'dfsocial-count', '');
    form.append(count);
    // THE COUNT IS WHAT THE SERVICE WILL COUNT: the characters as typed (the field's own cap is the bound) and, past
    // LETTER_LINES_MAX, the lines as they will be kept - cleanBody's, blank runs folded - so the number that turns red
    // is the number the refusal would name.
    const paintCount = () => {
      const lines = cleanBody(body.value).split('\n').length;
      const over = lines > LETTER_LINES_MAX;
      const t = `${body.value.length}/${LETTER_BODY_MAX}${over ? ` - ${lines}/${LETTER_LINES_MAX} lines` : ''}`;
      if (count.textContent !== t) count.textContent = t;
      count.className = `dfsocial-count${over ? ' over' : ''}`;
    };
    paintCount();
    // THE DRAFT IS WRITTEN ON EVERY KEYSTROKE and the form is NOT rebuilt by one - only a view change or a send
    // rebuilds it - so the caret stays where the player put it and nothing typed is ever lost to a repaint.
    to.addEventListener('input', () => { d.to = to.value; d.account = null; });   // NAME-AS: a name typed is a username - the friend's account no longer addresses it
    subject.addEventListener('input', () => { d.subject = subject.value; });
    body.addEventListener('input', () => { d.body = body.value; paintCount(); });
    const out = [form];
    if (letters.word) out.push(el('div', 'dfsocial-err', letters.word));
    const send = () => {
      if (letters.sending) return;
      letters.sending = true; letters.word = ''; ui++; if (open) repaint();
      mail.send({ to: d.to, account: d.account, subject: d.subject, body: d.body }).then((r) => {   // NAME-AS: a friend's, by account
        letters.sending = false;
        if (r.ok) {
          letters.draft = { to: '', subject: '', body: '' };
          letters.word = `Your letter to ${r.to} is on its way.`;
          letters.mode = 'list';
        } else letters.word = letterWordText(r.error);
        ui++;
      });
    };
    // Ctrl or Cmd with Enter sends from the letter itself - the one field where a plain Enter is a new line
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    const acts = el('div', 'dfsocial-acts');
    acts.append(
      btn(letters.sending ? 'Sending...' : 'Send', { enabled: !letters.sending, run: send }),
      btn('Cancel', { enabled: !letters.sending, run: () => { letters.draft = { to: '', subject: '', body: '' }; letters.word = ''; lettersTo('list'); } }));
    out.push(acts);
    // the first empty field takes the keyboard: the name on a fresh letter, the words on a reply
    Promise.resolve().then(() => { if (letters.mode === 'write' && open) (d.to ? (d.subject ? body : subject) : to).focus?.(); });
    return out;
  };

  const lettersBody = () => (letters.mode === 'write' ? writeBody() : letters.mode === 'read' ? readBody() : listBody());

  // ═══ GUILD1b: THE GUILD TAB ═══════════════════════════════════════
  // Every rule it shows is net/guild/guildLaw.js's and every answer the service's (net/guild/guildBook.js): a button the character's
  // rank cannot press is DISABLED AND SAYS WHY, as every button here does; one it may press goes to the book, and what
  // comes back is written under the header in the service's own sentence.
  const guildField = (form, label, value, max, onInput) => {
    const f = doc.createElement('input');
    f.className = 'dfsocial-field';
    f.type = 'text';
    f.maxLength = max;
    f.value = value;
    f.setAttribute('aria-label', label);
    f.setAttribute('autocomplete', 'off');
    f.setAttribute('spellcheck', 'false');
    f.addEventListener('input', () => { onInput(f.value); paintLiveBtns(); });   // GUILD-LIVE: the buttons the draft enables, now
    form.append(el('div', 'dfsocial-label', label), f);
    return f;
  };
  /** An act through the book: its words land under the header, and the tab repaints off the book's version. */
  const guildDo = (promise, okWord = '', after = null) => {
    guildUi.word = ''; guildUi.arm = null; ui++;
    Promise.resolve(promise).then((r) => {
      guildUi.bad = !r?.ok;
      guildUi.word = r?.ok ? guildDoneText(typeof okWord === 'function' ? okWord(r) : okWord, r) : guildWordText(r?.error, r, Math.floor(social.now() / 1000));   // AUDIT GUILD1d R13: or the answer's own words; AUDIT2 GUILD2 S2/S7: and its reason
      if (r?.ok) after?.(r);
      ui++;
    });
  };
  /** GUILD-WRAP (2026-09-27, Discord: "Depositing stretches names a lot with a syllable on each line"): A ROSTER ROW'S
   *  ACTS ARE ONE GROUP THAT WRAPS - MAIL1's friends-row law (.dfsocial-row.wrap). A guildmaster's row carries up to
   *  four buttons, and while an act is out (a deposit) every one of them says "a moment" beside its label: wider than
   *  the panel, and the name beside them was squeezed to a syllable a line. The group goes below the name when the row
   *  cannot hold both at a readable width. Answers the group, on the row. */
  const rowActs = (r) => {
    r.className += ' wrap';
    const acts = el('div', 'dfsocial-rowacts');
    r.append(acts);
    return acts;
  };
  /** The two-press acts: the first press arms, the second does it. */
  const armed = (key) => guildUi.arm === key;
  const arm = (key) => { guildUi.arm = key; guildUi.armAt = social.now(); ui++; if (open) repaint(); };
  const rankName = (g, r) => (Array.isArray(g.ranks) ? g.ranks[r] : null) ?? GUILD_RANK_NAMES[r] ?? String(r);

  /** No guild: the invitations standing for this account, and the founding form. */
  const guildJoinBody = (g) => {
    const out = [el('div', 'dfsocial-empty', GUILD_NONE_TEXT)];
    for (const line of GUILD_PRIMER_LINES) out.push(el('div', 'dfsocial-note', line));   // GUILD3c: what a guild is for
    const busy = g.busy;
    if (g.invites.length) {
      out.push(el('div', 'dfsocial-sec', 'Invitations'));
      for (const inv of g.invites) {
        const r = personRow({ name: `${inv.name} [${inv.tag}]`, sub: `invited by ${inv.by}` });
        rowActs(r).append(btn('Join', { enabled: !busy, why: 'a moment', run: () => guildDo(g.answer(inv.guild, true), `You joined ${inv.name}.`) }),
          btn('Decline', { enabled: !busy, why: 'a moment', run: () => guildDo(g.answer(inv.guild, false), 'Invitation declined.') }));
        out.push(r);
      }
    }
    out.push(el('div', 'dfsocial-sec', 'Found a guild'));
    const d = guildUi.draft;
    const form = el('div', 'dfsocial-form');
    guildField(form, 'Guild name', d.name, GUILD_NAME_MAX, (v) => { d.name = v; });
    guildField(form, 'Tag', d.tag, 4, (v) => { d.tag = v; });
    form.append(el('div', 'dfsocial-empty', GUILD_FOUND_COST_TEXT));
    out.push(form);
    const acts = el('div', 'dfsocial-acts');
    acts.append(liveBtn('Found', () => ({ enabled: !g.busy && !!guildNameOf(d.name) && !!guildTagOf(d.tag), why: g.busy ? 'a moment' : 'a name of 3 to 32 characters and a tag of 2 to 4 letters or digits' }),
      { run: () => guildDo(g.found(d.name, d.tag), 'Your guild is founded.', () => { d.name = ''; d.tag = ''; }) }));
    out.push(acts);
    return out;
  };

  /** PROF6: the guild Stores' section and the Officers' writ budget (the Guild tab's). AUDIT 31 H2: read again at each
   *  look at the Guild tab (a writ delivered, another member's move, the week's budget spent) and kept per guild AND
   *  character; a read refused says so, with Try again - it once said "Reading the guild Stores..." for the session's
   *  life. R1: any member takes back their own deposit; U8: every number the service bounds, bounded here first. */
  const guildStoresNodes = (g, ps, me) => {
    const out = [];
    const W = ps.writs;
    const whose = `${g.guild?.id ?? ''}|${ps.character?.() ?? ''}`;
    if (guildUi.storesFor !== whose) {
      guildUi.storesFor = whose; guildUi.storesAsked = false; guildUi.storesError = null; W.state.guildStores = null; W.state.writBudget = null;
    }
    if (!guildUi.storesAsked) {
      guildUi.storesAsked = true; guildUi.storesError = null;
      Promise.resolve(W.guildStores()).then((r) => { guildUi.storesError = r?.ok ? null : (r?.error ?? 'server'); ui++; }, () => { guildUi.storesError = 'offline'; ui++; });
    }
    const gs = W.state.guildStores;
    const d = guildUi.draft;
    out.push(el('div', 'dfsocial-sec', 'Guild Stores'));
    if (!gs) {
      if (!guildUi.storesError) { out.push(el('div', 'dfsocial-note', 'Reading the guild Stores...')); return out; }
      out.push(el('div', 'dfsocial-note', `The guild Stores cannot be read now: ${guildWordText(guildUi.storesError)}`));
      const again = el('div', 'dfsocial-acts');
      again.append(btn('Try again', { enabled: !W.busy, why: 'a moment', run: () => { guildUi.storesAsked = false; ui++; if (open) repaint(); } }));
      out.push(again);
      return out;
    }
    if (!gs.rows.length) out.push(el('div', 'dfsocial-note', 'The guild Stores hold nothing yet. Any member may put in from their own Stores.'));
    // GUILD-UX (2026-10-19, Discord #suggestions "Guild Hall Storage Improvements", Alkfay: "you have to scroll past all of
    // the stored materials to get to the input section, and then you have to manually enter the amount to store"): the
    // form and its acts come FIRST, the stored rows after them; Units left empty is all of it, as the vault's How many is
    const unitsTyped = () => { const t = String(d.storeUnits ?? '').trim(); const n = /^\d+$/.test(t) ? Number(t) : 0; return guildMoveOk(n) ? n : 0; };
    const unitsEmpty = () => String(d.storeUnits ?? '').trim() === '';
    const pick = (label, options, value, onPick) => {
      const s = doc.createElement('select');
      s.className = 'dfsocial-field';
      s.setAttribute('aria-label', label);
      for (const [k, text] of options) { const o = doc.createElement('option'); o.value = k; o.textContent = text; if (k === value) o.selected = true; s.append(o); }
      s.addEventListener('change', () => { onPick(s.value); paintLiveBtns(); });
      return s;
    };
    const stores = ps.mine?.() ?? new Map();
    const heldOf = (k) => { const v = [...stores.values()].find((x) => x.material === k); return v ? v.own + v.bought : 0; };
    // AUDIT SUGGESTIONS-1019 L4-1: the room the service counts - every origin of it, gold-bought and loose units too (writs.js moveGuildStores)
    const roomHeld = (k) => { const v = [...stores.values()].find((x) => x.material === k); return v ? v.own + v.bought + (v.gold | 0) + (v[LOOSE_ORIGIN] | 0) : 0; };
    const guildOf = (k) => gs.rows.find((r) => r.material === k)?.qty ?? 0;
    const mine = [...stores.values()].filter((v) => v.own + v.bought > 0);
    // R1: what this character may take out - an Officer or the Guildmaster any of it, a member their own deposit
    const takeable = gs.rows.filter((r) => gs.mayWithdraw || r.mine > 0);
    const outMost = (k) => { const r = gs.rows.find((x) => x.material === k); return r ? (gs.mayWithdraw ? r.qty : r.mine) : 0; };
    // GUILD-UX: empty is all of it - all you hold that the guild has room for in, all you may take that your Stores have room for out
    const putUnits = (k) => (unitsEmpty() ? Math.min(heldOf(k), Math.max(0, GUILD_STORES_MAX - guildOf(k))) : unitsTyped());
    const takeUnits = (k) => (unitsEmpty() ? Math.min(outMost(k), Math.max(0, STORES_MAX - roomHeld(k))) : unitsTyped());
    const form = el('div', 'dfsocial-form');
    if (mine.length) {
      if (!mine.some((v) => v.material === d.storeIn)) d.storeIn = mine[0].material;
      form.append(el('div', 'dfsocial-label', 'Put in'), pick('A material of your Stores', mine.map((v) => [v.material, `${ps.name(v.material, 2)} (${(v.own + v.bought).toLocaleString('en-US')})`]), d.storeIn, (k) => { d.storeIn = k; }));
    }
    if (takeable.length) {
      if (!takeable.some((r) => r.material === d.storeOut)) d.storeOut = takeable[0].material;
      form.append(el('div', 'dfsocial-label', 'Take out'), pick('A material of the guild Stores', takeable.map((r) => [r.material, `${ps.name(r.material, 2)} (${outMost(r.material).toLocaleString('en-US')})`]), d.storeOut, (k) => { d.storeOut = k; }));
    }
    guildField(form, t('social.stores.units', 'Units (leave empty for all)'), d.storeUnits ?? '', String(STORES_MAX).length, (x) => { d.storeUnits = x; });
    out.push(form);
    const acts = el('div', 'dfsocial-acts');
    if (mine.length) {
      acts.append(liveBtn('Put in', () => {
        const n = putUnits(d.storeIn), k = d.storeIn;
        const why = W.busy ? 'a moment' : !n ? (unitsEmpty() ? t('social.stores.noRoom', 'the guild Stores have no room for more of it') : `a number from 1 to ${STORES_MAX.toLocaleString('en-US')}`)
          : n > heldOf(k) ? `your Stores hold ${heldOf(k).toLocaleString('en-US')}`
            : guildOf(k) + n > GUILD_STORES_MAX ? `the guild Stores hold at most ${GUILD_STORES_MAX.toLocaleString('en-US')} of a material` : '';
        return { enabled: !why, why };
      }, {
        run: () => { const k = d.storeIn, n = putUnits(k); if (n > 0 && k) guildDo(W.deposit(k, n), `${n.toLocaleString('en-US')} ${ps.name(k, n)} put in the guild Stores.`, () => { d.storeUnits = ''; }); },
      }));
      // GUILD-UX (the thread: "having an 'transfer all' button that empties your personal store into the guild's store
      // would be wonderful"): every material of your Stores put in, each up to the guild's room for it, one deposit a
      // material in turn (the service's own door, so its every check and the writs' hour budget stand); a refusal stops
      // the run and says why, what went in staying in
      const allMoves = () => mine.map((v) => [v.material, Math.min(v.own + v.bought, Math.max(0, GUILD_STORES_MAX - guildOf(v.material)))]).filter(([, n]) => n > 0);
      acts.append(liveBtn(t('social.stores.putAll', 'Put in all'), () => {
        const why = W.busy ? 'a moment' : !allMoves().length ? t('social.stores.noRoomAll', 'the guild Stores have no room for any of it') : '';
        return { enabled: !why, why };
      }, {
        // AUDIT SUGGESTIONS-1019 L4-5: a run the service stopped part way says what went in before it, and why it stopped
        run: () => guildDo(guildPutAll(W, allMoves()).then((r) => (!r.ok && r.moved > 0 ? { ok: true, moved: r.moved, stopped: r } : r)),
          (r) => (r.stopped
            ? t('social.stores.putAllStopped', '{n, plural, one {# material} other {# materials}} went in, then the guild Stores refused: {why}', { n: r.moved, why: guildWordText(r.stopped.error, r.stopped, Math.floor(social.now() / 1000)) })
            : t('social.stores.putAllDone', '{n, plural, one {# material} other {# materials}} put in the guild Stores.', { n: r.moved }))),
      }));
    }
    if (gs.rows.length) {
      acts.append(liveBtn('Take out', () => {
        const n = takeUnits(d.storeOut), k = d.storeOut;
        const why = !takeable.length ? 'Officers and the guildmaster only, or your own deposits'
          : W.busy ? 'a moment' : !n ? (unitsEmpty() ? t('social.stores.noRoomMine', 'your Stores have no room for more of it') : `a number from 1 to ${STORES_MAX.toLocaleString('en-US')}`)
            : n > outMost(k) ? (gs.mayWithdraw ? `the guild Stores hold ${outMost(k).toLocaleString('en-US')}` : `you put in ${outMost(k).toLocaleString('en-US')} of your own`)
              : roomHeld(k) + n > STORES_MAX ? `your Stores hold at most ${STORES_MAX.toLocaleString('en-US')} of a material` : '';
        return { enabled: !why, why };
      }, {
        run: () => { const k = d.storeOut, n = takeUnits(k); if (n > 0 && k) guildDo(W.withdrawStores(k, n), `${n.toLocaleString('en-US')} ${ps.name(k, n)} taken into your Stores.`, () => { d.storeUnits = ''; }); },
      }));
    }
    out.push(acts);
    for (const r of gs.rows) out.push(personRow({ name: `${Number(r.qty).toLocaleString('en-US')} ${ps.name(r.material, r.qty)}`, sub: r.mine ? `${Number(r.mine).toLocaleString('en-US')} of them yours` : '' }));   // GUILD-UX: after the form
    if (gs.moves?.length) out.push(el('div', 'dfsocial-label', `The last ${gs.moves.length === 1 ? 'move' : `${gs.moves.length} moves`}`));
    for (const m of gs.moves ?? []) out.push(personRow({ name: `${m.who} ${m.delta > 0 ? 'put in' : 'took out'} ${Math.abs(m.delta).toLocaleString('en-US')} ${ps.name(m.material, Math.abs(m.delta))}` }));
    // THE OFFICERS' WRIT BUDGET (11): the Guildmaster sets it; an Officer reads what is left this week
    const b = W.state.writBudget;
    if (writMay(me, 'writBudget')) {
      out.push(el('div', 'dfsocial-sec', 'Writ budget'));
      out.push(el('div', 'dfsocial-note', `The silver your Officers may spend on guild writs each week, from the silver treasury${b ? ` (${marksText(b.budget)}, ${marksText(b.spent)} posted this week)` : ''}. Your own writs do not count.`));
      const bform = el('div', 'dfsocial-form');
      guildField(bform, 'Silver a week', d.budget ?? '', String(WRIT_BUDGET_MAX).length, (x) => { d.budget = x; });
      out.push(bform);
      const typed = () => { const t = String(d.budget ?? '').trim(); const n = /^\d+$/.test(t) ? Number(t) : null; return n != null && writBudgetOk(n) ? n : null; };
      const bacts = el('div', 'dfsocial-acts');
      bacts.append(liveBtn('Set', () => ({ enabled: !W.busy && typed() != null, why: W.busy ? 'a moment' : `an amount from 0 to ${marksText(WRIT_BUDGET_MAX)}` }), {
        run: () => { const n = typed(); if (n != null) guildDo(W.budget(n), `The Officers' writ budget is ${marksText(n)} a week.`, () => { d.budget = ''; }); },
      }));
      out.push(bacts);
    } else if (writMay(me, 'postWrit') && b) {
      out.push(el('div', 'dfsocial-note', `Your writ budget this week: ${marksText(b.left)} of ${marksText(b.budget)} left.`));
    }
    return out;
  };

  /** GUILD1d (Seats-Arc 8.2): THE HALL - where it stands and who may walk in, an Officer's to change; its sale the
   *  guildmaster's, pressed twice, the deed share and its pieces' half into the treasury. With none, how one is bought. */
  const guildHallNodes = (g, v, me) => {
    const out = [el('div', 'dfsocial-sec', 'Hall')];
    const hall = v.hall;
    if (!hall) {
      out.push(el('div', 'dfsocial-note', GUILD_HALL_NONE_TEXT));
      const counted = guildHallGoldText(v.hallGold, v.treasury);   // HALL-GOLD
      if (counted) out.push(el('div', 'dfsocial-note', counted));
      return out;
    }
    out.push(personRow({ name: guildHallWhereText(hall), sub: `Who may enter: ${GUILD_HALL_ENTRY_WORDS[hall.entry] ?? GUILD_HALL_ENTRY_WORDS.guild} - bought for ${Number(hall.paid).toLocaleString('en-US')} gold` }));
    const acts = el('div', 'dfsocial-acts');
    if (hallMay(me, 'hallEntry')) {
      const next = GUILD_HALL_ENTRIES[(Math.max(0, GUILD_HALL_ENTRIES.indexOf(hall.entry)) + 1) % GUILD_HALL_ENTRIES.length];
      acts.append(btn(next === 'public' ? 'Open it to anyone' : 'Members only', { enabled: !g.busy, why: 'a moment', run: () => guildDo(g.setHallEntry(next), `Who may enter the hall: ${GUILD_HALL_ENTRY_WORDS[next]}.`) }));
    }
    if (hallMay(me, 'hall')) {
      const back = homeSaleRefund(Number(hall.paid) || 0);
      acts.append(armed('hall-sell') ? btn(`Sure? ${back.toLocaleString('en-US')} gold back, plus half its pieces' cost`, { warn: true, enabled: !g.busy, why: 'a moment', run: () => guildDo(g.sellHall(), guildHallSoldText) })
        : btn('Sell the hall', { enabled: !g.busy, why: 'a moment', run: () => arm('hall-sell') }));
    }
    if (acts.children.length) out.push(acts);
    return out;
  };
  // ═══ GUILD2 (bible/11-Multiplayer/Guild-Overhaul.md): THE GUILD PAGE, IN PAGES ══════════════════════════════════════
  // Asked: "the guild page needs an overhaul". GUILD1b's tab was one scroll - roster, invites, two treasuries and their
  // ledgers, the hall, the heraldry, the guild Stores, the rank names and leaving, every section under the one before. It
  // is pages now, under the guild's own header (its banner, its name and tag, the reader's rank): Overview, Members,
  // Treasury, Vault, (the guild) Stores where the professions are this account's, Arms, Settings. Each page keeps every
  // control and sentence the section it took over had, so a refusal still says its reason beside its button.

  /** The pages the tab shows, in order - the guild Stores only where the professions are this account's. */
  const guildPagesOf = (g) => [
    ['overview', 'Overview'], ['members', 'Members'], ['treasury', 'Treasury'], ['vault', 'Vault'],
    ...(g.profStores?.writs && g.profStores.open?.() === true ? [['stores', 'Stores']] : []),
    ['arms', 'Arms'], ['settings', 'Settings'],
  ];
  /** Our own drawing as a picture - never markup (SOC3). */
  const svgPicture = (svg, w, h, alt) => {
    const img = doc.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.setAttribute('width', String(w)); img.setAttribute('height', String(h)); img.setAttribute('alt', alt);
    return img;
  };
  const selectOf = (label, options, value, onPick) => {
    const s = doc.createElement('select');
    s.className = 'dfsocial-field';
    s.setAttribute('aria-label', label);
    for (const [k, text] of options) { const o = doc.createElement('option'); o.value = k; o.textContent = text; if (k === value) o.selected = true; s.append(o); }
    s.addEventListener('change', () => { onPick(s.value); paintLiveBtns(); });
    return s;
  };

  /** THE HEADER over every page: the banner, the name and tag, the reader's rank and the treasury (GUILD1b's line).
   *  GUILD-WINDOW: its numbers as the window's tiles, each under its own name - the reader's rank, the gold, the silver
   *  where it is this account's (the Treasury page's own switch), the members and how many of them are online (read
   *  again on the live pass, as each row's dot is), the vault, and the hall. */
  const guildHead = (g, v, me) => {
    const head = el('div', 'dfsocial-letterhead dfsocial-guildhead');
    head.append(svgPicture(bannerSvg(v.heraldry, { width: 32 }), 32, 96, v.heraldry ? heraldryText(v.heraldry) : 'An undrawn banner'));
    const who = el('div', 'dfsocial-who');
    const stats = el('div', 'dfguild-stats');
    const stat = (label, value, sub = null) => {
      const s = el('div', 'dfguild-stat');
      s.append(el('div', 'dfguild-statlabel', label), el('div', 'dfguild-statvalue', value));
      if (sub) { const n = el('div', 'dfguild-statsub', sub()); s.append(n); liveSubs.push({ el: n, of: sub }); }
      stats.append(s);
    };
    stat(t('social.guild.stat.rank', 'Rank'), rankName(v, me));
    stat(t('social.guild.stat.gold', 'Gold'), Number(v.treasury).toLocaleString('en-US'));
    if (g.marks?.state?.open === true) stat(t('social.guild.stat.silver', 'Silver'), Number(v.marks ?? 0).toLocaleString('en-US'));
    stat(t('social.guild.stat.members', 'Members'), `${v.members.length}/${GUILD_MEMBERS_MAX}`, () => guildOnlineText(g.guild?.members ?? v.members, g.now()));
    stat(t('social.guild.stat.vault', 'Vault'), `${v.vault?.used ?? 0}/${v.vault?.max ?? GUILD_VAULT_SLOTS}`);
    stat(t('social.guild.stat.hall', 'Hall'), v.hall ? REGION_NAMES[v.hall.region] ?? t('social.guild.stat.bay', 'Iliac Bay') : t('social.guild.stat.noHall', 'None'));
    who.append(el('div', 'dfsocial-subject', `${v.name} [${v.tag}]`), stats);
    head.append(who);
    return head;
  };
  /** AUDIT2 GUILD2 U9: the strip's buttons as last drawn, by page - the focus put back on the page turned to. */
  let stripBtns = new Map();
  /** GUILD-WINDOW: the column of pages as last drawn - the arrow keys' (guildArrow) - and the page it marks up. */
  let stripEl = null, stripPage = null;
  /** THE PAGE STRIP: a tab for each page, the one up marked. GUILD-WINDOW: the window's column of pages - each its
   *  name, its count where it has one (the members, the vault) and what it holds; the arrow keys walk it (guildArrow).
   *  AUDIT GUILD-WINDOW W9: each name in the player's language, as the words under it are; W11: one tab in the Tab
   *  order (the one up - the arrows reach the rest, the tabs pattern), and the column's orientation as it is drawn
   *  (a row across under the small screen's query). */
  const guildStrip = (g, page, v) => {
    const strip = el('div', 'dfsocial-subtabs dfguild-nav');
    strip.setAttribute('role', 'tablist');
    let row = false;
    try { row = win.matchMedia?.(GUILD_SMALL_QUERY)?.matches === true; } catch { row = false; }
    strip.setAttribute('aria-orientation', row ? 'horizontal' : 'vertical');
    stripBtns = new Map();
    stripEl = strip; stripPage = page;
    const counts = { members: `${v.members.length}/${GUILD_MEMBERS_MAX}`, vault: `${v.vault?.used ?? 0}/${v.vault?.max ?? GUILD_VAULT_SLOTS}` };
    const words = guildPageWords();
    const names = guildPageNames();
    for (const [id, label] of guildPagesOf(g)) {
      const b = el('button', `dfsocial-subtab${id === page ? ' active' : ''}`);
      const top = el('span', 'dfguild-navtop');
      top.append(el('span', 'dfguild-navlabel', names[id] ?? label), ...(counts[id] ? [el('span', 'dfguild-navcount', counts[id])] : []));
      b.append(top, el('span', 'dfguild-navsub', words[id] ?? ''));
      stripBtns.set(id, b);
      b.type = 'button'; b.dataset.page = id;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', id === page ? 'true' : 'false');
      b.setAttribute('tabindex', id === page ? '0' : '-1');
      b.addEventListener('click', b.turn = () => {
        if (guildUi.page === id) return;
        guildUi.page = id; guildUi.arm = null;
        if (id === 'vault') guildUi.vaultAsked = false;   // AUDIT GUILD2 M2: the vault read again at each turn to its page
        if (id === 'settings') guild?.refresh?.();   // AUDIT GUILD3 C8: what holds the guild read again at each turn to its page - a hold cleared elsewhere (a battle fought, a writ withdrawn by an Officer) no longer waits on the tab
        ui++; if (open) repaint();
        // AUDIT2 GUILD2 U9: the keyboard's focus on the page turned to - the strip is drawn again, and the focus fell to
        // the body with the old button
        if (open) stripBtns.get(id)?.focus?.();
      });
      strip.append(b);
    }
    return strip;
  };

  /** OVERVIEW: the arms in words, the hall, and where the reader stands at the vault. */
  const guildOverviewNodes = (g, v, me) => {
    const out = [el('div', 'dfsocial-sec', 'The guild')];
    out.push(el('div', 'dfsocial-note', v.heraldry ? heraldryText(v.heraldry) : GUILD_HERALDRY_NONE_TEXT));
    if (v.vault?.me) out.push(el('div', 'dfsocial-note', `At the vault: ${vaultStandingText(v.vault.me)}.`));
    out.push(...guildHallNodes(g, v, me));
    out.push(el('div', 'dfsocial-sec', 'Elsewhere'), el('div', 'dfsocial-empty', GUILD_ELSEWHERE_TEXT));   // GUILD3c: where the rest is run
    return out;
  };

  /** MEMBERS: the roster with what my rank may do to each - and, the guildmaster's, each member's standing at the vault -
   *  then the invitations out. */
  const guildMembersNodes = (g, v, me) => {
    const out = [];
    const wait = { enabled: !g.busy, why: 'a moment' };
    const d = guildUi.draft;
    d.grants ??= {};
    out.push(el('div', 'dfsocial-sec', `Members (${v.members.length}/${GUILD_MEMBERS_MAX})`));
    const mayGrant = guildMay(me, 'vaultGrant');
    for (const m of v.members) {
      const standing = m.vault ? ` - ${vaultStandingText(m.vault)}${m.vault.granted ? ' (granted)' : ''}` : '';
      // GUILD-SEEN: when they were last online, as a friend's row says it - the dot and the line read again on the live
      // pass, off the book's freshest roster (a look that moved a stamp alone repaints nothing): "Last online 5 min ago"
      // moves on the clock alone, and a sitting that lapses puts the dot out without a look
      const fresh = () => g.guild?.members?.find((x) => x?.member === m.member) ?? m;
      const online = guildMemberOnline(m, g.now());
      const r = personRow({ name: m.you ? `${m.name} (you)` : m.name, sub: `${rankName(v, m.rank)}${standing}`, online, seen: guildSeenText(m, g.now()) });
      if (r.seenNode) liveSubs.push({ el: r.seenNode, of: () => guildSeenText(fresh(), g.now()) });
      if (r.dotNode) liveDots.push({ el: r.dotNode, of: () => guildMemberOnline(fresh(), g.now()) === true });
      const mayMove = [guildMayMove(me, m.rank, m.rank - 1), guildMayMove(me, m.rank, m.rank + 1)];
      const mayRemove = guildMay(me, 'remove') && guildOutranks(me, m.rank);
      const mayHand = guildMay(me, 'handOver');
      if (!m.you && (mayMove[0] || mayMove[1] || mayRemove || mayHand)) {
        const racts = rowActs(r);   // GUILD-WRAP
        if (mayMove[0]) racts.append(btn('Promote', { ...wait, run: () => guildDo(g.rank(m.member, m.rank - 1), `${m.name} is ${rankName(v, m.rank - 1)} now.`) }));
        if (mayMove[1]) racts.append(btn('Demote', { ...wait, run: () => guildDo(g.rank(m.member, m.rank + 1), `${m.name} is ${rankName(v, m.rank + 1)} now.`) }));
        if (mayRemove) {
          const k = `remove:${m.member}`;
          racts.append(armed(k) ? btn('Sure?', { warn: true, ...wait, run: () => guildDo(g.remove(m.member), `${m.name} is no longer in the guild.`) })
            : btn('Remove', { ...wait, run: () => arm(k) }));
        }
        if (mayHand) {
          const k = `hand:${m.member}`;
          racts.append(armed(k) ? btn('Sure?', { warn: true, ...wait, run: () => guildDo(g.handOver(m.member), `${m.name} leads the guild now.`) })
            : btn('Make guildmaster', { ...wait, run: () => arm(k) }));
        }
      }
      out.push(r);
      // GUILD2b: THE LEADER'S GRANT - a member's standing at the vault set, or revoked back to its rank's
      if (mayGrant && m.rank !== GUILD_RANK_MASTER) {
        const was = m.vault?.granted ? m.vault.level : '';
        // AUDIT2 GUILD2 U7: a draft is of the standing it was made from - a grant, a rank moved, or another officer's Set
        // since starts it again from what stands (a draft kept over it read as "unchanged" against the new, or set the old)
        const from = `${m.rank}|${was}|${m.vault?.limit ?? 0}`;
        if (d.grants[m.member]?.from !== from) d.grants[m.member] = { level: was, limit: m.vault?.limit ?? 0, from };
        const draft = d.grants[m.member];
        const form = el('div', 'dfsocial-grant');
        const def = VAULT_RANK_DEFAULTS[m.rank] ?? VAULT_RANK_DEFAULTS[GUILD_RANK_RECRUIT];
        const same = () => (draft.level || '') === (was || '') && (draft.level !== 'withdraw' || (draft.limit ?? 0) === (m.vault?.limit ?? 0));
        // AUDIT GUILD2: DRAWN AGAIN IN PLACE at a pick of the level (the limit's select comes and goes with "Takes out"),
        // the keyboard's focus kept on the level - the whole panel was painted again and the focus lost with it
        const drawGrant = (focusLevel = false) => {
          liveBtns = liveBtns.filter((x) => x.grant !== m.member);
          const level = selectOf(`${m.name}'s vault access`, [['', `As ${rankName(v, m.rank)} (${vaultStandingText(def)})`], ['none', 'No access'], ['deposit', 'Puts in'], ['withdraw', 'Takes out']],
            draft.level, (x) => {
              // AUDIT GUILD2: a member made a withdrawer starts at an Officer's ten a day - the limit's select read 0, "Any
              // number", and a Set unread made the vault anyone's to empty
              if (x === 'withdraw' && draft.level !== 'withdraw' && m.vault?.level !== 'withdraw') draft.limit = VAULT_RANK_DEFAULTS[GUILD_RANK_OFFICER].limit;
              draft.level = x;
              drawGrant(true);
            });
          const kids = [level];
          if (draft.level === 'withdraw') {
            kids.push(selectOf(`${m.name}'s takes a day`, VAULT_LIMIT_CHOICES.map((n) => [String(n), n ? `${n} a day` : 'Any number']), String(draft.limit ?? 0),
              (x) => { draft.limit = Number(x) || 0; }));
          }
          kids.push(liveBtn('Set', () => ({ enabled: !g.busy && !same(), why: g.busy ? 'a moment' : 'unchanged' }), {
            run: () => guildDo(g.vaultGrant(m.member, draft.level || null, draft.level === 'withdraw' ? draft.limit ?? 0 : 0),
              `${m.name}: ${draft.level ? vaultStandingText({ level: draft.level, limit: draft.limit ?? 0 }) : `as their rank (${vaultStandingText(def)})`}.`,
              () => { delete d.grants[m.member]; }),
          }));
          liveBtns[liveBtns.length - 1].grant = m.member;
          form.replaceChildren(...kids);
          if (focusLevel) level.focus?.();
        };
        drawGrant();
        out.push(form);
      }
    }
    // GUILD3c (Guilds-Made-Plain.md): WHAT EACH RANK MAY DO - the four power tables in words (net/guild/guildPowers.js), each
    // rank by the guild's own name for it, folded under its line
    const ranks = /** @type {any} */ (el('details', 'dfsocial-ranks'));
    ranks.open = guildUi.ranksOpen === true;
    ranks.addEventListener?.('toggle', () => { guildUi.ranksOpen = !!ranks.open; });
    ranks.append(el('summary', null, 'What each rank may do'));
    for (const line of guildRankLines(Array.isArray(v.ranks) ? v.ranks : GUILD_RANK_NAMES)) {
      const p = el('p', null);
      p.append(el('b', null, `${line.name}: `), el('span', null, line.text));
      ranks.append(p);
    }
    ranks.append(el('p', null, GUILD_RANK_ACTS_NOTE));
    out.push(ranks);
    // INVITE
    if (guildMay(me, 'invite')) {
      out.push(el('div', 'dfsocial-sec', 'Invite'));
      const form = el('div', 'dfsocial-form');
      guildField(form, 'Username', d.handle, HANDLE_MAX_LEN, (x) => { d.handle = x; });
      out.push(form);
      const acts = el('div', 'dfsocial-acts');
      acts.append(liveBtn('Invite', () => ({ enabled: !g.busy && handleShapeOk(d.handle.trim()), why: g.busy ? 'a moment' : 'a username' }),
        { run: () => { const h = d.handle.trim(); guildDo(g.invite(h), `${h} is invited.`, () => { d.handle = ''; }); } }));
      out.push(acts);
      for (const inv of v.invites ?? []) out.push(personRow({ name: inv.name, sub: `invited by ${inv.by}` }));
    }
    return out;
  };

  /** TREASURY: the gold and its ledger, the silver and its lines (GUILD1b and MARKS1's sections, whole). */
  const guildTreasuryNodes = (g, v, me) => {
    const out = [];
    const d = guildUi.draft;
    out.push(el('div', 'dfsocial-sec', 'Treasury'));
    const realm = guildRealmGoldText(v.hallGold, v.treasury, !!v.hall);   // GUILD3c: which of the gold buys a hall or a new name; C10: the name alone once it holds one
    if (realm) out.push(el('div', 'dfsocial-note', realm));
    const tform = el('div', 'dfsocial-form');
    guildField(tform, 'Gold', d.gold, 7, (x) => { d.gold = x; });
    out.push(tform);
    // GUILD-LIVE: the amount is the draft's at the press - read at the build, a live Deposit put in what was typed
    // before the build (nothing)
    const goldTyped = () => (/^\d{1,7}$/.test(d.gold.trim()) ? Number(d.gold.trim()) : 0);
    const tacts = el('div', 'dfsocial-acts');
    // HALL-GOLD: one move is at most GUILD_MOVE_MAX - said on the button, not refused by the service after the press
    const overCap = () => goldTyped() > GUILD_MOVE_MAX;
    const capWhy = `at most ${GUILD_MOVE_MAX.toLocaleString('en-US')} at a time`;
    tacts.append(liveBtn('Deposit', () => ({ enabled: !g.busy && goldTyped() > 0 && !overCap(), why: g.busy ? 'a moment' : overCap() ? capWhy : 'an amount' }),
      { run: () => { const n = goldTyped(); if (n > 0) guildDo(g.deposit(n), `${n.toLocaleString('en-US')} gold put in.`, () => { d.gold = ''; }); } }));
    tacts.append(liveBtn('Withdraw', () => ({ enabled: !g.busy && goldTyped() > 0 && !overCap() && guildMay(me, 'withdraw'), why: guildMay(me, 'withdraw') ? (g.busy ? 'a moment' : overCap() ? capWhy : 'an amount') : 'the guildmaster\'s alone' }),
      { run: () => { const n = goldTyped(); if (n > 0) guildDo(g.withdraw(n), `${n.toLocaleString('en-US')} gold taken out.`, () => { d.gold = ''; }); } }));
    out.push(tacts);
    for (const l of v.ledger ?? []) {
      out.push(personRow({ name: `${l.who} ${GUILD_LEDGER_WORDS[l.kind] ?? GUILD_LEDGER_WORDS.deposit} ${Number(l.amount).toLocaleString('en-US')}`, sub: `balance ${Number(l.balance).toLocaleString('en-US')}` }));   // GUILD1d: the hall's lines say so
    }
    // MARKS1 (PROF0 10.5): THE MARKS TREASURY beside the gold one - any member puts Marks in from the account's balance,
    // the guildmaster alone takes them out; shown where Marks are this account's (the service's switch)
    if (g.marks?.state?.open === true) {
      out.push(el('div', 'dfsocial-sec', 'Silver treasury'));
      out.push(el('div', 'dfsocial-note', `The treasury holds ${marksText(Number(v.marks ?? 0))}. You hold ${marksText(Number(g.marks.state.balance ?? 0))}.`));
      if (Number.isSafeInteger(v.deedsMax)) out.push(el('div', 'dfsocial-note', guildDeedsText(v.deeds, v.deedsMax)));   // AUDIT SILVER-WAYS A3
      const mform = el('div', 'dfsocial-form');
      guildField(mform, 'Silver', d.marks ?? '', 7, (x) => { d.marks = x; });
      out.push(mform);
      const marksTyped = () => (/^\d{1,7}$/.test(String(d.marks ?? '').trim()) ? Number(String(d.marks).trim()) : 0);
      const macts = el('div', 'dfsocial-acts');
      macts.append(liveBtn('Put in', () => ({ enabled: !g.busy && marksTyped() > 0, why: g.busy ? 'a moment' : 'an amount' }),
        { run: () => { const n = marksTyped(); if (n > 0) guildDo(g.moveMarks(n, false), `${marksText(n)} put in.`, () => { d.marks = ''; }); } }));
      macts.append(liveBtn('Take out', () => ({ enabled: !g.busy && marksTyped() > 0 && guildMay(me, 'withdraw'), why: guildMay(me, 'withdraw') ? (g.busy ? 'a moment' : 'an amount') : 'the guildmaster\'s alone' }),
        { run: () => { const n = marksTyped(); if (n > 0) guildDo(g.moveMarks(n, true), `${marksText(n)} taken out.`, () => { d.marks = ''; }); } }));
      out.push(macts);
      for (const l of v.marksLedger ?? []) out.push(personRow({ name: guildSilverLineText(l) }));   // GUILD3b: each line its own kind and way; AUDIT GUILD1d R5
    }
    return out;
  };

  /** GUILD-UX: the vault's filter, kept across repaints (a read, a take) and let go with the guild's page. */
  const vaultFilter = () => (guildUi.vaultFilter ??= { cat: 'all', rarity: 'all', query: '' });
  /** GUILD-UX: each vault row shown or hidden by the filter as it stands - `shown` its `[row element, vault row]` pairs. */
  const applyVaultFilter = (shown, none = null) => {
    const f = vaultFilter();
    let seen = 0;
    for (const [r, row] of shown) { const ok = vaultRowAccepts(row, f); r.style.display = ok ? '' : 'none'; if (ok) seen++; }   // a style, not `hidden`: the row's own display rule outranks the attribute
    if (none) none.style.display = shown.length && !seen ? '' : 'none';   // AUDIT SUGGESTIONS-1019 L4-7: a filter that hides every row says so
  };
  /** GUILD-UX: the bar - a search, the pack's pages and the rarities, each holding what this vault holds, with counts. */
  const vaultFilterBar = (items, shown, none) => {
    const f = vaultFilter();
    const recs = items.map((r) => r.rec ?? {});
    const bar = el('div', 'dfsocial-form dfsocial-filter');   // GUILD-WINDOW: one row in the window (its sheet)
    const q = doc.createElement('input');
    q.className = 'dfsocial-field'; q.type = 'search'; q.maxLength = 40; q.value = f.query;
    q.placeholder = t('social.vault.find', 'Find a piece'); q.setAttribute('aria-label', q.placeholder);
    q.setAttribute('autocomplete', 'off'); q.setAttribute('spellcheck', 'false');
    q.addEventListener('input', () => { f.query = q.value; applyVaultFilter(shown, none); });
    const menu = (label, options, key) => selectOf(label, options.map((o) => [o.id, `${o.label} (${o.count})`]), f[key], (v) => { f[key] = v; applyVaultFilter(shown, none); });
    bar.append(q, menu(t('social.vault.page', 'A page of the pack'), storeFilterOptions(recs, f.cat), 'cat'), menu(t('social.vault.rarity', 'A rarity'), storeRarityOptions(recs, f.rarity), 'rarity'));
    return bar;
  };
  /** GUILD-UX: a vault row's card - the pack's own, beside the row on a hover, and on a press of the row for a finger;
   *  gone when the pointer leaves and at every repaint, so it never outlives the row it was for. */
  // AUDIT SUGGESTIONS-1019 L4-3: a MOUSE's pointer brings the card and takes it; a press of the name toggles it - on a
  // phone a tap fired enter, click and leave in one, and the card came and went at once
  let cardRow = null;
  const hideCard = () => { cardRow = null; itemCard.hide(); };
  const vaultCardOn = (r, rec) => {
    const mouse = (e) => (e?.pointerType ?? 'mouse') === 'mouse';
    r.addEventListener('pointerenter', (e) => { if (mouse(e)) { cardRow = r; itemCard.show(rec, r); } });
    r.addEventListener('pointerleave', (e) => { if (mouse(e)) hideCard(); });
    childOfClass(r, 'dfsocial-name')?.addEventListener('click', () => {
      if (cardRow === r) { hideCard(); return; }
      cardRow = r; itemCard.show(rec, r, { asked: true });
    });
  };

  /** GUILD2b: THE VAULT - the guild's pieces, each with its depositor; Take for a member who may, Put in from the pack for
   *  one who may; reached in a town (the host's word), read again at each look at the page. */
  const guildVaultNodes = (g, v) => {
    const out = [];
    const d = guildUi.draft;
    const whose = `${v.id}|${guildWho()}`;
    if (guildUi.vaultFor !== whose) { guildUi.vaultFor = whose; guildUi.vaultAsked = false; guildUi.vaultFilter = null; }   // GUILD-UX: another vault starts unfiltered
    if (!guildUi.vaultAsked && g.readVault) {
      guildUi.vaultAsked = true;
      Promise.resolve(g.readVault()).then(() => { ui++; }, () => { ui++; });
    }
    const vv = g.vaultNow ? g.vaultNow() : g.vaultView;   // AUDIT GUILD2 M3: this character's and guild's alone
    const st = vv?.me ?? v.vault?.me ?? null;
    out.push(el('div', 'dfsocial-sec', `Vault (${vv?.items?.length ?? v.vault?.used ?? 0}/${vv?.max ?? v.vault?.max ?? GUILD_VAULT_SLOTS})`));
    out.push(el('div', 'dfsocial-note', `Your standing: ${vaultStandingText(st)}${st?.level === 'withdraw' && st.limit ? ` - ${Number(st.taken ?? 0)} of ${st.limit} taken today` : ''}.`));
    // AUDIT GUILD2 M1: the town is read at the press and on the live pass, never once at the build - a page left open
    // on the road kept Take alive and sent takes out of town
    const reachNow = () => g.pack?.reach?.() !== false;
    const reach = reachNow();
    if (!reach) out.push(el('div', 'dfsocial-empty', GUILD_VAULT_REACH_TEXT));
    if (!vv) {
      out.push(el('div', 'dfsocial-note', g.vaultError ? `The vault cannot be read now: ${guildWordText(g.vaultError)}` : 'Reading the vault...'));
      if (g.vaultError) {
        const again = el('div', 'dfsocial-acts');
        again.append(btn('Try again', { enabled: !g.busy, why: 'a moment', run: () => { guildUi.vaultAsked = false; ui++; if (open) repaint(); } }));
        out.push(again);
      }
      return out;
    }
    const mayTake = vaultMayTake(st, st?.taken ?? 0);
    const takeOf = () => { const why = !reachNow() ? 'in a town' : g.busy ? 'a moment' : ''; return { enabled: !why, why }; };
    const takeRun = (run) => () => { if (reachNow()) run(); };
    if (!vv.items.length) out.push(el('div', 'dfsocial-empty', GUILD_VAULT_EMPTY_TEXT));
    // GUILD-UX (2026-10-19, Discord #suggestions "Guild Hall Storage Improvements", Alkfay: "the inability to preview items
    // (e.g. for legendary items that can have different bases you can't tell what base it is, and for rare items you
    // can't see what their mods are... nor is there any way to filter items)"): the FILTER - the stores' own (storeFilter.js:
    // the search, the pack's pages, the rarities this vault holds) over the pieces' records, hiding rows in place so the
    // search keeps its focus as it is typed - and each row's CARD, the pack's own (enhancedInventory.js showItemHover), on
    // a hover or a press of its name
    const shown = [];
    const none = el('div', 'dfsocial-empty', t('social.vault.noMatch', 'No piece in the vault matches.'));
    if (vv.items.length) out.push(vaultFilterBar(vv.items, shown, none));
    for (const row of vv.items) {
      const it = { ...row, name: vaultRowName(row) };   // WAGONS2 (FINAL AUDIT): a marked wagon put in before its row was named by its kind; AUDIT SUGGESTIONS-1019 L4-6: and an unidentified piece unnamed
      const r = personRow({ name: it.count > 1 ? `${it.name} x${it.count}` : it.name, sub: `put in by ${it.by}` });
      if (row.rec) vaultCardOn(r, row.rec);
      shown.push([r, row]);
      if (mayTake) {
        const acts = rowActs(r);
        acts.append(liveBtn('Take', takeOf, { run: takeRun(() => guildDo(g.vaultTake(it.slot), `${it.name} taken into your pack.`)) }));
        if (it.count > 1) acts.append(liveBtn('Take one', takeOf, { run: takeRun(() => guildDo(g.vaultTake(it.slot, 1), `One ${it.name} taken into your pack.`)) }));
      }
      out.push(r);
    }
    out.push(none);
    applyVaultFilter(shown, none);
    // PUT IN, from the pack - what may leave it (systems/tradePack.js tradeRefusal: never a worn, a quest's, a summoned,
    // a bound piece, gold, a boat's or the Materials Bag)
    if (vaultMayPut(st) && g.pack) {
      // AUDIT2 GUILD2 U4: and never a locked piece - a lock closes every way out of the pack a trade is (itemLock.js)
      const offers = (g.pack.items?.() ?? []).filter((it) => it && tradeRefusal(it) == null && !g.pack.refuses?.(it) && !isLocked(it));   // WAGONS2 (AUDIT): nor the loaded wagon (the pack's own refusal)
      out.push(el('div', 'dfsocial-sec', 'Put in'));
      // AUDIT2 GUILD2 U10: the pick is a piece, not a place in the list - a put-in shifted the list under an index, and
      // the next Put in offered the piece after it; and it is this guild's (another guild's tab starts again)
      if (d.vaultFor !== v.id) { d.vaultFor = v.id; d.vaultPick = null; d.vaultCount = ''; }
      if (!offers.length) out.push(el('div', 'dfsocial-empty', 'Nothing in your pack can go in the vault.'));
      else {
        if (!offers.includes(d.vaultPick)) d.vaultPick = offers[0];
        const byKey = new Map(offers.map((it, i) => [String(i), it]));
        const form = el('div', 'dfsocial-form');
        form.append(selectOf('A piece of your pack', offers.map((it, i) => [String(i), (it.stackCount ?? 1) > 1 ? `${vaultPieceName(it)} x${it.stackCount}` : vaultPieceName(it)]), String(offers.indexOf(d.vaultPick)), (k) => { d.vaultPick = byKey.get(k) ?? null; }));
        guildField(form, 'How many (leave empty for all)', d.vaultCount ?? '', 4, (x) => { d.vaultCount = x; });
        out.push(form);
        const countOf = (it) => { const t = String(d.vaultCount ?? '').trim(); if (!t) return it.stackCount ?? 1; return /^\d+$/.test(t) ? Number(t) : 0; };
        const acts = el('div', 'dfsocial-acts');
        acts.append(liveBtn('Put in', () => {
          const it = offers.includes(d.vaultPick) ? d.vaultPick : null;
          const n = it ? countOf(it) : 0;
          const why = !reachNow() ? 'in a town' : g.busy ? 'a moment' : !it ? 'a piece' : !(n >= 1 && n <= (it.stackCount ?? 1)) ? `1 to ${it.stackCount ?? 1}` : (vv.items.length >= vv.max ? 'the vault is full' : '');
          return { enabled: !why, why };
        }, { run: () => { const it = offers.includes(d.vaultPick) ? d.vaultPick : null; if (it && reachNow()) guildDo(g.vaultPut(it, countOf(it)), `${it.name == null ? 'The piece' : vaultPieceName(it)} put in the vault.`, () => { d.vaultCount = ''; }); } }));
        out.push(acts);
      }
    }
    if (vv.log?.length) out.push(el('div', 'dfsocial-label', 'The latest'));
    for (const l of vv.log ?? []) out.push(personRow({ name: `${l.who} ${l.kind === 'take' ? 'took out' : 'put in'} ${l.count > 1 ? `${l.count} ` : ''}${l.name}` }));
    return out;
  };

  /**
   * GUILD2c: THE ARMS - the banner, the shield and the tag as they will stand, every member's to see; the guildmaster's
   * to choose: a field (plain or divided, its second colour), a border, a device of forty, the device's own colour - each
   * a row of the choices themselves drawn, never a list of words. The first raising is free; each change after it is
   * paid from the Drake treasury (GUILD1d's law). Drawn again in place at each pick, the focus kept on the pick.
   */
  const guildArmsNodes = (g, v, me) => {
    const out = [el('div', 'dfsocial-sec', 'Arms')];
    const d = guildUi.draft;
    const may = hallMay(me, 'heraldry');
    // AUDIT GUILD1d R10: a draft is one guild's, from one heraldry - another guild's tab, or a heraldry changed under it,
    // starts it again from what stands
    const from = `${v.id}|${JSON.stringify(v.heraldry ?? null)}`;
    if (d.heraldryFrom !== from) { d.heraldry = null; d.heraldryFrom = from; }
    if (may && !d.heraldry) d.heraldry = { division: 'plain', field2: null, charge: null, ...(v.heraldry ?? { field: 'azure', border: 'gold', device: 'wolf' }) };
    const box = el('div', 'dfsocial-arms');
    /** @type {Map<string, any>} */
    const focus = new Map();
    const draw = (keep = null) => {
      focus.clear();
      liveBtns = liveBtns.filter((x) => !x.arms);
      box.replaceChildren(...armsInner(g, v, may, focus, draw));
      if (keep) focus.get(keep)?.focus?.();
    };
    draw();
    out.push(box);
    return out;
  };
  /** The arms page's inside - the pictures, then (the guildmaster's) the choices and the raising. */
  const armsInner = (g, v, may, focus, draw) => {
    const d = guildUi.draft;
    const h = may ? d.heraldry : null;
    const shown = (may ? heraldryOf(h) : null) ?? v.heraldry;
    const out = [];
    const pics = el('div', 'dfsocial-armspics');
    pics.append(svgPicture(bannerSvg(shown, { width: 44 }), 44, 132, shown ? heraldryText(shown) : 'An undrawn banner'));
    if (shown) pics.append(svgPicture(shieldSvg(shown, { size: 44 }), 44, 46, heraldryText(shown)));
    const tagChip = el('span', 'dfsocial-tagchip', `<${v.tag}>`);
    const fc = heraldryColourOf(shown?.field ?? 'argent'), bc = heraldryColourOf(shown?.border ?? 'ash');
    tagChip.style.background = fc?.hex ?? '#e6e6e6';
    tagChip.style.borderColor = bc?.hex ?? '#8a8a8a';
    tagChip.style.color = heraldryColourOf(heraldryInk(shown) ?? 'sable')?.hex ?? '#1d1d1d';
    pics.append(tagChip);
    out.push(pics, el('div', 'dfsocial-note', shown ? heraldryText(shown) : GUILD_HERALDRY_NONE_TEXT));
    if (!may || !h) return out;
    const pick = (key, apply) => () => { apply(); draw(key); paintLiveBtns(); };
    // AUDIT GUILD2: A SWATCH IS OPEN ONLY WHERE THE LAW TAKES THE ARMS IT MAKES - the pick tried on a copy and read by
    // heraldryOf, the one judge. Each row asked a rule of its own, which missed the device against the second colour: the
    // swatch stood open, the pick made arms the law refused, and Raise went dead with nothing drawn of the draft
    const swatches = (label, key, value, set) => {
      out.push(el('div', 'dfsocial-label', label));
      const row = el('div', 'dfsocial-swatches');
      // AUDIT2 GUILD2 U14: a swatch shut says why - the law's own words (armsWhy) on its title and its label; a shut
      // swatch said only its colour's name, and a player read it as broken
      const refusal = (k) => { if (k === value) return ''; const t = { ...h }; set(k, t); return heraldryOf(t) ? '' : armsWhy(t); };
      /** @type {Map<string, number>} */
      const shut = new Map();
      for (const c of HERALDRY_COLOURS) {
        const b = el('button', `dfsocial-swatch${c.key === value ? ' on' : ''}`);
        b.type = 'button';
        b.style.background = c.hex;
        const why = refusal(c.key);
        if (why) shut.set(why, (shut.get(why) ?? 0) + 1);
        const said = why ? `${c.name} (unavailable: the arms need ${why})` : c.name;
        b.setAttribute('title', said); b.setAttribute('aria-label', `${label}: ${said}`); b.setAttribute('aria-pressed', c.key === value ? 'true' : 'false');
        if (why) b.disabled = true;
        b.addEventListener('click', () => { if (!b.disabled) pick(`${key}:${c.key}`, () => set(c.key, h))(); });
        focus.set(`${key}:${c.key}`, b);
        row.append(b);
      }
      out.push(row);
      // drawn as well as titled (AUDIT SOC C11's law: a title is nothing on a phone)
      if (shut.size) out.push(el('div', 'dfsocial-why', `Unavailable: the arms need ${[...shut.keys()].join(', and ')}.`));
    };
    const tiles = (label, key, values, value, svgOf, nameOf, set) => {
      out.push(el('div', 'dfsocial-label', label));
      const row = el('div', 'dfsocial-tiles');
      for (const x of values) {
        const b = el('button', `dfsocial-tile${x === value ? ' on' : ''}`);
        b.type = 'button';
        b.setAttribute('title', nameOf(x)); b.setAttribute('aria-label', `${label}: ${nameOf(x)}`); b.setAttribute('aria-pressed', x === value ? 'true' : 'false');
        const svg = svgOf(x);
        if (svg) b.append(svgPicture(svg, 28, 29, nameOf(x)));
        b.addEventListener('click', () => pick(`${key}:${x}`, () => set(x))());
        focus.set(`${key}:${x}`, b);
        row.append(b);
      }
      out.push(row);
    };
    const ink = (t = h) => t.charge ?? t.border;
    /** A colour no one of the arms' others is - for a second field colour newly asked. */
    const freeColour = (not) => HERALDRY_COLOURS.find((c) => c.key !== HERALDRY_UNHELD && !not.includes(c.key))?.key ?? 'argent';
    // THE FIELD'S DIVISION, each drawn on the draft's own colours
    const asDrawn = (over) => heraldryOf({ ...h, ...over }) ?? heraldryOf({ field: h.field, border: h.border, device: h.device });
    tiles('Field', 'division', HERALDRY_DIVISIONS, h.division ?? 'plain',
      (x) => shieldSvg(asDrawn(x === 'plain' ? { division: 'plain', field2: null } : { division: x, field2: h.field2 ?? freeColour([h.field, ink(), h.border]) }), { size: 28 }),
      (x) => HERALDRY_DIVISION_NAMES[x], (x) => { h.division = x; h.field2 = x === 'plain' ? null : h.field2 ?? freeColour([h.field, ink(), h.border]); });
    swatches('Field color', 'field', h.field, (k, t) => { t.field = k; if (t.field2 === k) t.field2 = freeColour([k, ink(t), t.border]); });
    if ((h.division ?? 'plain') !== 'plain') swatches('Second color', 'field2', h.field2, (k, t) => { t.field2 = k; });
    swatches('Border', 'border', h.border, (k, t) => { t.border = k; });
    tiles('Device', 'device', HERALDRY_DEVICES, h.device, (x) => shieldSvg(asDrawn({ device: x }), { size: 28 }), heraldryDeviceName, (x) => { h.device = x; });
    swatches('Device color (matches the border unless chosen)', 'charge', ink(), (k, t) => { t.charge = k === t.border ? null : k; });
    out.push(el('div', 'dfsocial-empty', v.heraldry ? `A change costs ${marksText(HERALDRY_CHANGE_DRAKES)} from the silver treasury.` : 'The first choice is free.'));
    const acts = el('div', 'dfsocial-acts');
    const raise = liveBtn(v.heraldry ? 'Change it' : 'Raise it', () => {
      const nh = heraldryOf(d.heraldry);
      const why = g.busy ? 'a moment' : !nh ? armsWhy(d.heraldry)
        : heraldrySame(nh, v.heraldry) ? 'already your heraldry'
          : v.heraldry && !('marks' in v) ? accountRefusalText('marks-closed')   // AUDIT GUILD1d R12: Drakes not this account's
            : v.heraldry && Number(v.marks ?? 0) < HERALDRY_CHANGE_DRAKES ? `${marksText(HERALDRY_CHANGE_DRAKES)} in the silver treasury` : '';
      return { enabled: !why, why };
    }, { run: () => guildDo(g.setHeraldry(d.heraldry), 'The guild\'s banner is raised.', () => { d.heraldry = null; }) });
    liveBtns[liveBtns.length - 1].arms = true;
    acts.append(raise);
    out.push(acts);
    return out;
  };

  /** SETTINGS: a new name (the guildmaster's, for a price), the rank names, and leaving or disbanding. */
  const guildSettingsNodes = (g, v, me) => {
    const out = [];
    const d = guildUi.draft;
    const busy = g.busy;
    // GUILD2a: A NEW NAME
    if (guildMay(me, 'rename')) {
      out.push(el('div', 'dfsocial-sec', 'A new name'));
      if (d.renameFrom !== `${v.id}|${v.name}|${v.tag}`) { d.renameFrom = `${v.id}|${v.name}|${v.tag}`; d.newName = v.name; d.newTag = v.tag; }
      const form = el('div', 'dfsocial-form');
      guildField(form, 'Guild name', d.newName ?? '', GUILD_NAME_MAX, (x) => { d.newName = x; });
      guildField(form, 'Tag', d.newTag ?? '', 4, (x) => { d.newTag = x; });
      form.append(el('div', 'dfsocial-empty', GUILD_RENAME_COST_TEXT));
      const nowS = Math.floor(social.now() / 1000);
      if (Number.isSafeInteger(v.renameAt) && v.renameAt > nowS) form.append(el('div', 'dfsocial-note', guildRenameSoonText(v.renameAt, nowS)));
      out.push(form);
      const typed = () => ({ name: guildNameOf(d.newName ?? ''), tag: guildTagOf(d.newTag ?? '') });
      const of = () => {
        const t = typed();
        const why = busy ? 'a moment' : !t.name || !t.tag ? 'a name of 3 to 32 characters and a tag of 2 to 4 letters or digits'
          : t.name === v.name && t.tag === v.tag ? 'already the guild\'s'
            : Number.isSafeInteger(v.renameAt) && v.renameAt > Math.floor(social.now() / 1000) ? 'not yet'
              : Number(v.hallGold ?? 0) < GUILD_RENAME_GOLD ? `${GUILD_RENAME_GOLD.toLocaleString('en-US')} of the realm's gold in the treasury` : '';
        return { enabled: !why, why };
      };
      const acts = el('div', 'dfsocial-acts');
      acts.append(armed('rename')
        ? liveBtn(`Sure? ${GUILD_RENAME_GOLD.toLocaleString('en-US')} gold`, of, { warn: true, run: () => { const t = typed(); guildDo(g.rename(t.name, t.tag), `The guild is ${t.name} [${t.tag}] now.`); } })
        : liveBtn('Rename', of, { run: () => arm('rename') }));
      out.push(acts);
    }
    // THE RANK NAMES
    if (guildMay(me, 'renameRanks')) {
      out.push(el('div', 'dfsocial-sec', 'Rank names'));
      if (!Array.isArray(d.ranks)) d.ranks = [...(v.ranks ?? GUILD_RANK_NAMES)];
      const rform = el('div', 'dfsocial-form');
      d.ranks.forEach((name, i) => guildField(rform, `Rank ${i + 1}`, name, GUILD_RANK_NAME_MAX, (x) => { d.ranks[i] = x; }));
      out.push(rform);
      const racts = el('div', 'dfsocial-acts');
      racts.append(liveBtn('Rename ranks', () => ({ enabled: !g.busy && !!guildRankNamesOf(d.ranks), why: g.busy ? 'a moment' : 'four different names' }),
        { run: () => guildDo(g.renameRanks(d.ranks), 'The ranks are renamed.', () => { d.ranks = null; }) }));
      out.push(racts);
    }
    // LEAVING
    out.push(el('div', 'dfsocial-sec', 'Leaving'));
    // GUILD3c: EVERYTHING that still holds the guild, before the press - the view's list (the service's guildHolds), the
    // service's last refusal's, and the page's own
    if (guildUi.keepsFor !== v.id) { guildUi.keepsFor = v.id; guildUi.keeps = null; }
    // (a guildmaster with members is asked no hand-over here: a disbanding takes them with it - the Leave button says its own)
    const holding = guildMay(me, 'disband') ? guildKeepsOf(v, guildUi.keeps) : [];
    // AUDIT GUILD3 C1/T2: only what the page can see again holds its buttons - the view's list and its own gold, hall and
    // vault; a code a past refusal said that nothing re-reads is listed above, never a lock (one 'marks-full' held both
    // buttons for the session: the press that would have asked again was the one it disabled)
    const seen = guildMay(me, 'disband') ? guildKeepsOf(v, null) : [];
    if (holding.length) {
      out.push(el('div', 'dfsocial-empty', `${GUILD_KEEPS_HEAD}:`));
      const list = el('ul', 'dfsocial-keeps');
      for (const k of holding) list.append(el('li', null, GUILD_KEEPS_WORDS[k] ?? accountRefusalText(k)));
      out.push(list);
    }
    const keptBy = (promise) => Promise.resolve(promise).then((r) => { guildUi.keeps = r?.ok ? null : (Array.isArray(r?.keeps) ? r.keeps : null); return r; });
    const acts = el('div', 'dfsocial-acts');
    const alone = v.members.length === 1;
    const master = guildMay(me, 'disband');
    const keeps = (v.vault?.used ?? 0) > 0;   // GUILD2b: a vault holding pieces holds the guild too
    const listed = seen.length > 0;   // GUILD3c: the rest of what holds it, listed above - what the page sees of it (C1)
    const leaveWhy = master && !alone ? 'hand the guild on first' : master && v.treasury > 0 ? 'take the gold out first' : master && v.hall ? 'sell the hall first' : master && keeps ? 'empty the vault first' : master && listed ? 'clear the list above first' : 'a moment';
    // GUILD1d: a guild holding a hall never goes; GUILD3c: the list holds the page's own (gold, hall, vault) and the service's
    const canLeave = !busy && (!master || (alone && !listed));
    // AUDIT 28 M3: the Marks treasury never holds a guild back - a guild that goes gives what it holds to its guildmaster
    if (master && (v.marks ?? 0) > 0) out.push(el('div', 'dfsocial-note', `If the guild is disbanded, its ${marksText(Number(v.marks))} goes to you.`));
    acts.append(armed('leave') ? btn('Sure?', { warn: true, enabled: canLeave, why: leaveWhy, run: () => guildDo(keptBy(g.leave()), 'You left the guild.') })
      : btn('Leave', { enabled: canLeave, why: leaveWhy, run: () => arm('leave') }));
    if (master) {
      const why = v.treasury > 0 ? 'take the gold out first' : v.hall ? 'sell the hall first' : keeps ? 'empty the vault first' : listed ? 'clear the list above first' : 'a moment';
      const can = !busy && !listed;   // GUILD3c: nothing on the list - the page's own gold, hall and vault, and the service's
      acts.append(armed('disband') ? btn('Sure?', { warn: true, enabled: can, why, run: () => guildDo(keptBy(g.disband()), 'The guild is disbanded.') })
        : btn('Disband', { warn: true, enabled: can, why, run: () => arm('disband') }));
    }
    out.push(acts);
    return out;
  };

  /** GUILD-WINDOW: a page's sections as cards - each heading (`.dfsocial-sec`) opens one, and what stands before the first
   *  heading is a card of its own. The nodes are MOVED, never rebuilt, so every hold a page kept on its own nodes (the
   *  vault's filter over its rows, a grant drawn again in place, the arms' box) still holds. */
  const guildCards = (nodes) => {
    const out = [];
    let card = null;
    for (const n of nodes) {
      if (!card || String(n?.className ?? '').split(/\s+/).includes('dfsocial-sec')) { card = el('div', 'dfguild-card'); out.push(card); }
      card.append(n);
    }
    return out;
  };

  /** In a guild: its header, its page strip, and the page up. GUILD-WINDOW: the strip a column beside the page, and the
   *  page in cards in a column of its own that scrolls under the header. */
  const guildMemberBody = (g, v) => {
    const me = v.rank;
    const pages = guildPagesOf(g).map(([id]) => id);
    const page = pages.includes(guildUi.page) ? guildUi.page : 'overview';
    const out = [];
    if (page === 'members') out.push(...guildMembersNodes(g, v, me));
    else if (page === 'treasury') out.push(...guildTreasuryNodes(g, v, me));
    else if (page === 'vault') out.push(...guildVaultNodes(g, v, me));
    else if (page === 'stores') out.push(...guildStoresNodes(g, g.profStores, me));   // PROF6 (Professions-Arc 7, 28)
    else if (page === 'arms') out.push(...guildArmsNodes(g, v, me));
    else if (page === 'settings') out.push(...guildSettingsNodes(g, v, me));
    else out.push(...guildOverviewNodes(g, v, me));
    const main = el('div', 'dfguild-main');
    main.dataset.page = page;
    main.setAttribute('role', 'tabpanel');   // AUDIT GUILD-WINDOW W11: the panel the column's tabs show
    main.setAttribute('aria-label', guildPageNames()[page] ?? page);
    main.append(...guildCards(out));
    const layout = el('div', 'dfguild-layout');
    layout.append(guildStrip(g, page, v), main);
    return [guildHead(g, v, me), layout];
  };
  /** GUILD-WINDOW: the window's body - a guild's header and pages as they are; anything else (no guild yet, signed out,
   *  a read refused) in the one column, in cards. AUDIT GUILD-WINDOW W13: and THE FOOT, a line the window always has,
   *  where the last act's words (`.dfguild-said`) stand - seen however far the page is scrolled (they stood at the top
   *  of the column, out of sight under a press on the fortieth row), and moving nothing under the pointer as they come
   *  and go (they pushed every row down by their height). */
  const guildWindowBody = (nodes) => {
    const isSaid = (n) => String(n?.className ?? '').split(/\s+/).includes('dfguild-said');
    const rest = nodes.filter((n) => !isSaid(n));
    const foot = el('div', 'dfguild-foot');
    foot.setAttribute('role', 'status');
    foot.append(...nodes.filter(isSaid));
    if (rest.some((n) => String(n?.className ?? '').split(/\s+/).includes('dfguild-layout'))) return [...rest, foot];
    const main = el('div', 'dfguild-main dfguild-alone');
    main.dataset.page = '';
    main.append(...guildCards(rest));
    return [main, foot];
  };

  const guildBody = () => {
    const g = guild;
    if (g.state === 'signed-out') return [el('div', 'dfsocial-empty', GUILD_SIGNED_OUT_TEXT)];
    if (g.state === 'guest') return [el('div', 'dfsocial-empty', accountRefusalText('guilds-need-account'))];
    if (g.state === 'unknown') return [el('div', 'dfsocial-empty', GUILD_LOOKING_TEXT)];
    const out = [];
    if (guildUi.word) out.push(el('div', `${guildUi.bad ? 'dfsocial-err' : 'dfsocial-empty'} dfguild-said`, guildUi.word));
    if (g.state === 'error') {
      out.push(el('div', 'dfsocial-err', guildWordText(g.error)));
      const acts = el('div', 'dfsocial-acts');
      acts.append(btn('Try again', { run: () => { g.refresh(); } }));
      out.push(acts);
      return out;
    }
    return [...out, ...(g.guild ? guildMemberBody(g, g.guild) : guildJoinBody(g))];
  };

  /** What a tab's badge should say right now: requests waiting on Friends, invitations standing on Party, letters
   *  unopened on Letters (MAIL1). ONE reading, because the live pass and the repaint must never disagree about the
   *  number (AUDIT SOC C5). */
  const badgeText = (id) => {
    // GUILD1b: the Guild tab's badge is the invitations waiting on a character in none
    const n = id === 'friends' ? (social.in?.length ?? 0) : id === 'letters' ? (mail?.unread ?? 0)
      : id === 'guild' ? (guild && !guild.guild ? (guild.invites?.length ?? 0) : 0) : social.liveInvites().length;
    return n > 0 ? String(n) : '';
  };

  /** AUDIT GUILD-WINDOW W16: the Social button's badge in the Guild window - every social tab's badge summed, read as
   *  each tab's is (`badgeText`), so the two never disagree. */
  const backBadgeText = () => {
    let n = 0;
    for (const id of tabBtns.keys()) if (id !== 'guild') n += Number(badgeText(id)) || 0;
    return n > 0 ? String(n) : '';
  };

  /** The whole body, and the tab badges over it. */
  const repaint = () => {
    hideCard();   // GUILD-UX: a vault row's card never outlives the row it was for
    painted = social.version; paintedUi = ui; paintedMail = mail?.version ?? 0; paintedGuild = guild?.version ?? 0; paintedWho = guildWho();
    paintedJourney = journeyKey();   // PARTY-UI
    paintedLead = !!canLead();   // PARTY-LEAD
    ticking = []; liveSubs = []; liveBtns = []; liveDots = [];
    for (const [id, t] of tabBtns) {
      t.b.className = `dfsocial-tab${id === tab ? ' active' : ''}`;
      t.b.setAttribute('aria-selected', id === tab ? 'true' : 'false');   // C21
      t.badge.textContent = badgeText(id);
    }
    // GUILD-WINDOW: the Guild tab up is the Guild window - its own name, the social tabs put away (the sheet)
    const mode = tab === 'guild' ? 'guild' : 'social';
    if (mode === 'social') socialTab = tab;
    if (root.dataset.mode !== mode) focusOwed = mode === 'guild';   // a guild still being read draws no tab: owed until one is
    if (root.dataset.mode !== mode) {
      root.dataset.mode = mode;
      titleEl.textContent = mode === 'guild' ? t('social.guild.title', 'Guild') : 'Social';
      root.setAttribute('aria-label', mode === 'guild' ? t('social.guild.title', 'Guild') : SOCIAL_LABEL);
      closeBtn.setAttribute('aria-label', mode === 'guild' ? t('social.guild.close', 'Close guild') : CLOSE_SOCIAL_LABEL);   // AUDIT GUILD-WINDOW W11
    }
    // GUILD-WINDOW: the page's column is drawn again at every act and every look, so where it was scrolled to is put
    // back on the same page - a guildmaster promoting the fortieth member is not thrown back to the first. AUDIT
    // GUILD-WINDOW W6: and the body's own scroll, which is the window's on a short screen; W12: and the row of pages
    // across a phone, wherever the page is (a press on Settings, the row's last, no longer put it out of sight)
    const was = childOfClass(body, 'dfguild-main');
    const kept = was ? { page: was.dataset?.page, top: Number(was.scrollTop) || 0, body: Number(body.scrollTop) || 0, nav: Number(childOfClass(body, 'dfguild-nav')?.scrollLeft) || 0 } : null;
    // AUDIT GUILD-WINDOW W3/W10: the keyboard's focus in the body is lost with the body drawn again - put back on the
    // page's own tab, so the window's keys stay the window's (on the document's body they were the world's: ArrowDown
    // its Professions door, which covered the HUD and shut the window)
    const focusIn = mode === 'guild' && within(doc.activeElement, body);
    stripBtns = new Map(); stripEl = null; stripPage = null;   // a body with no column of pages (no guild yet) keys none
    body.replaceChildren(...(tab === 'party' ? partyBody() : tab === 'letters' ? lettersBody() : tab === 'guild' ? guildWindowBody(guildBody()) : friendsBody()));
    const now = childOfClass(body, 'dfguild-main');
    if (now && kept) {
      const nav = childOfClass(body, 'dfguild-nav');
      if (nav && kept.nav) nav.scrollLeft = kept.nav;
      if (now.dataset?.page === kept.page) { if (kept.top) now.scrollTop = kept.top; if (kept.body) body.scrollTop = kept.body; } else body.scrollTop = 0;
    } else if (now) body.scrollTop = 0;
    if (open && (focusOwed || focusIn) && stripBtns.get(stripPage)) { stripBtns.get(stripPage).focus?.(); focusOwed = false; }   // W10: into the window, the focus with it
    paintLive();
  };
  backBtn?.addEventListener('click', () => {
    if (tab !== 'guild') return;
    tab = socialTab; confirm = null; ui++;
    if (tab === 'letters') lookAtLetters();
    if (open) { repaint(); tabBtns.get(tab)?.b?.focus?.(); }   // AUDIT GUILD-WINDOW W10: the Social button goes with its window
  });

  /**
   * The handful of things that move without the picture changing: the countdowns, the hub's last refusal, the note,
   * and the two self-disarming timers. Cheap enough for every frame; nothing here touches a row.
   *
   * AND A LAPSED INVITATION ASKS FOR A REBUILD. `liveInvites` sheds an expired one as it is READ and does not move
   * the version (net/social.js: nothing happened, time merely passed), so a body painted on the version alone would
   * keep drawing a row for an invitation that is already nothing. The countdown reaching zero is the one event that
   * has no frame behind it, so it raises the panel's own version and `render` rebuilds on the same pass.
   */
  const paintLive = () => {
    const now = social.now();
    if (confirm && now - confirmAt > SOCIAL_CONFIRM_MS) { confirm = null; ui++; }
    if (letters.del && now - letters.delAt > SOCIAL_CONFIRM_MS) { letters.del = null; ui++; }   // MAIL1: Delete disarms as Remove does
    if (guildUi.arm && now - guildUi.armAt > SOCIAL_CONFIRM_MS) { guildUi.arm = null; ui++; }   // GUILD1b: and the guild's two-press acts
    if (noteMsg && now - noteAt > SOCIAL_NOTE_MS) noteMsg = '';
    const e = social.lastError ? String(social.lastError) : '';
    if (err.textContent !== e) err.textContent = e;
    if (note.textContent !== noteMsg) note.textContent = noteMsg;
    // AUDIT SOC C5: THE BADGES ARE READ BACK, NOT REMEMBERED. `liveInvites()` sheds a lapsed invitation as it is
    // READ and moves no version (time merely passed), so an invitation that expired while the FRIENDS tab was up
    // left the Party badge standing at a number that was no longer true - the body it belonged to was not even
    // drawn. Comparing the live count against what is on the badge costs two integers a frame and cannot go stale.
    for (const [id, t] of tabBtns) { const want = badgeText(id); if (t.badge.textContent !== want) t.badge.textContent = want; }
    if (backBadge) { const want = backBadgeText(); if (backBadge.textContent !== want) backBadge.textContent = want; }   // AUDIT GUILD-WINDOW W16
    // AUDIT SOC B8: the sentences that go stale on the clock alone ("Last online 5 min ago"), written only when the
    // words changed - so the pins that count writes still hold and a quiet minute costs a string compare a row.
    for (const s of liveSubs) { const t = s.of(); if (s.el.textContent !== t) s.el.textContent = t; }
    for (const d of liveDots) { const c = dotClass(d.of()); if (d.el.className !== c) d.el.className = c; }   // GUILD-SEEN
    paintLiveBtns();   // GUILD-LIVE
    let lapsed = false;
    for (const c of ticking) {
      const t = inviteLeftText(c.expires - now);
      if (c.el.textContent !== t) c.el.textContent = t;
      if (now >= c.expires) lapsed = true;
    }
    if (lapsed) ui++;
    if (journeyKey() !== paintedJourney) ui++;   // PARTY-UI: a round opened, an answer landed, a journey began - the block again
    if (!!canLead() !== paintedLead) ui++;   // PARTY-LEAD: the hub's word came (or a reconnect lost it) - Make leader drawn or taken away
  };

  /** THE TOAST, which is the panel's one part that draws while the panel is shut. It goes away on either button, at
   *  expiry, and the moment the picture stops holding that invitation at all (the seat was taken, the party filled,
   *  the asker left) - so it can never stand for something that is no longer true. */
  const paintToast = () => {
    const now = social.now();
    // AUDIT SOC C4: the note expires HERE too. `paintLive` clears it, and `paintLive` runs only while the panel is
    // open - so a "try again" raised by a toast button with the panel shut stood under the invitation until the
    // invitation itself lapsed, long past the two and a half seconds it is meant to live.
    if (noteMsg && now - noteAt > SOCIAL_NOTE_MS) noteMsg = '';
    if (toasted && (now >= toasted.expires || !social.invites.has(toasted.party))) toasted = null;
    const up = !!toasted;
    const wasUp = toast.dataset.up === '1';
    if (toast.dataset.up !== (up ? '1' : '0')) toast.dataset.up = up ? '1' : '0';
    if (!up) return;
    const name = `${toasted.from.name} invites you to a party`;
    if (toastName.textContent !== name) toastName.textContent = name;
    const sub = noteMsg || `${toasted.members.map((m) => m.name).join(', ')} - ${inviteLeftText(toasted.expires - now)}`;
    if (toastSub.textContent !== sub) toastSub.textContent = sub;
    // AUDIT GUILD-WINDOW W1: where the toast ends, published for the Guild window that starts below it on a narrow screen
    // (its sheet) - measured as it is drawn, since a long name wraps it past the strip's 76px. Read only when a frame
    // could have moved it: up, or its words written
    if (!wasUp || name !== toastSaid[0] || sub !== toastSaid[1]) {
      toastSaid = [name, sub];
      const b = toast.getBoundingClientRect?.();
      const y = b && b.height > 0 ? Math.ceil(b.bottom) : 0;
      if (y !== toastFoot) { toastFoot = y; doc.documentElement?.style?.setProperty?.('--dfsocial-toast-b', `${y}px`); }
    }
  };
  // a toast the rate gate refused STAYS UP with its note - the invitation is still standing and the player still
  // means to answer it, so the one thing that must not happen is the buttons going away
  const toastAct = (k) => { const inv = toasted; if (!inv) return; if (act({ k, party: inv.party })) toasted = null; paintToast(); };

  toastYes.addEventListener('click', () => toastAct('party.accept'));
  toastNo.addEventListener('click', () => toastAct('party.decline'));

  // SOC3: the invitation in. `onInvite` may already belong to someone (a later slice's HUD), so it is CHAINED
  // rather than taken - this panel adds a toast to whatever else the host does with one.
  const priorInvite = social.onInvite;
  const mineInvite = (inv) => { toasted = inv; ui++; if (open) repaint(); paintToast(); priorInvite?.(inv); };
  social.onInvite = mineInvite;

  const openPanel = () => {
    if (!alive || open || !canOpen() || overlay()) return false;
    noteFirstUse('party');   // TUT1: the friends and party panel
    open = true; ui++;
    root.dataset.open = '1';
    repaint();
    onOpen?.();   // the host frees the pointer - inside the gesture that opened (AUDIT CHAT C2's law, again)
    return true;
  };
  const closePanel = () => {
    if (!alive || !open) return false;
    open = false; confirm = null; ui++;
    root.dataset.open = '0';
    hideCard();   // AUDIT SUGGESTIONS-1019 L4-2: nor the panel - closed, the pointer locked, no leave ever came
    onClose?.();   // and takes it back inside the closing gesture, the only place a lock request is honoured
    return true;
  };
  closeBtn.addEventListener('click', () => closePanel());

  // Escape closes, and closes NOTHING ELSE: the key is stopped here, so it never reaches the host's pause door
  // behind an open panel (the chat's own Escape rule, ui/chatPanel.js onKey) - nor any SIBLING surface's listener,
  // which is what `stopImmediatePropagation` adds over `stopPropagation` and what AUDIT SOC C14 was.
  const onKey = (e) => {
    if (!open || e.code !== 'Escape') return;
    if (above()) return;   // the F-menu is over this panel: its Escape, untouched and unstopped
    e.preventDefault();
    e.stopImmediatePropagation();
    closePanel();
  };
  win.addEventListener('keydown', onKey, true);

  // a PRESS inside the panel or the toast is theirs; a RELEASE is never stopped (AUDIT CHAT C5: the host's mouseup
  // clears its ring, and a press begun on the canvas must still let go)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) { root.addEventListener(t, swallow); toast.addEventListener(t, swallow); }
  // DISC25-E (Sir McMobdon on Discord, "Cant send letters": "Game still takes input making u jump and move and close
  // the letter if u hit f"): A KEY TYPED INTO THIS PANEL'S FIELDS IS THE FIELD'S. The panel is not a window in any
  // host's slot - it stands open while the player walks - so no overlay gate stood between a letter and the world's
  // key ladder: every W walked, every space jumped, and F (SocialInteract) toggled the panel shut mid-word. Stopped
  // on the panel's own root, in the bubble phase, the chat's rule (ui/chatPanel.js onKey): the field's own listeners
  // (Ctrl/Cmd+Enter sends) have already run, and the browser's own keys (F5, F11) are swallowed first, since the host
  // that swallows them will not see this one.
  root.addEventListener('keydown', (e) => {
    if (!isTextEntryTarget(e.target)) return;
    swallowBrowserKey(e);
    e.stopPropagation();
  });
  /** GUILD-WINDOW: THE WINDOW'S ARROW KEYS. AUDIT GUILD-WINDOW W3: an arrow pressed anywhere in the window is the window's,
   *  never the world's - ArrowLeft and ArrowRight turned the character, ArrowUp chose an act and ArrowDown opened the
   *  Professions door, which covered the HUD and so shut the window (inputActions.js DEFAULT_BINDINGS; the hosts hear
   *  keys in the bubble phase). On the column of pages it turns the page, both ways round; elsewhere it is the
   *  browser's (a scroll of the page's column, a choice of a list), a caret in a field untouched. W4: a key HELD turns
   *  one page - every turn to the Vault reads it and to Settings reads the guild again, and a held key's repeats spent
   *  the account's whole minute of asks in seconds. */
  const guildArrow = (e) => {
    if (root.dataset.mode !== 'guild' || isTextEntryTarget(e.target)) return;   // a field's keys are its own (DISC25-E stops them)
    const step = e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.stopPropagation?.();
    if (!stripEl || !within(e.target, stripEl)) return;   // a list's choice, the page's scroll: the browser's
    e.preventDefault?.();
    if (e.repeat) return;
    const ids = [...stripBtns.keys()];
    stripBtns.get(ids[(ids.indexOf(stripPage) + step + ids.length) % ids.length])?.turn?.();
  };
  root.addEventListener('keydown', guildArrow);
  /** AUDIT GUILD-WINDOW W5: THE SOCIAL DOOR OPENS THE SOCIAL PANEL. The chat's Social button and the interact key with no
   *  one in front open the panel as it was last left - and a panel last left on its Guild tab is the Guild window now,
   *  the screen's middle for a press that asked for friends. The Guild window is the Guild tab's, `openGuild`'s and the
   *  hall chest's; this door gives the social tab last up. */
  const openSocial = () => {
    if (tab === 'guild') { tab = socialTab; confirm = null; ui++; }
    return openPanel();
  };

  return {
    root, toast,
    open: openSocial, close: closePanel,
    toggle: () => (open ? closePanel() : openSocial()),
    isOpen: () => open,
    /** Which tab is up - for the host and for the pins. */
    tab: () => tab,
    /** MAIL1: open on the Letters tab - on the form to `to` when a name is given, on the box otherwise; JOURNAL1: on the
     *  form with a whole `draft` ({to, subject, body}) when one is given. False where the host handed no letterbox, or
     *  the panel cannot open now. */
    openLetters({ to = null, draft = null } = {}) {
      if (!mail) return false;
      tab = 'letters'; confirm = null;
      // JOURNAL1: a whole draft - a page of the journal sent as a letter (net/journalPage.js letterOfPage), to anyone
      if (draft) { letters.draft = { to: String(draft.to ?? ''), subject: String(draft.subject ?? ''), body: String(draft.body ?? '') }; letters.word = ''; lettersTo('write'); }
      else if (to != null) writeTo(to); else { letters.mode = 'list'; letters.id = null; ui++; }
      lookAtLetters();
      if (open) { repaint(); return true; }
      return openPanel();
    },
    /** MAIL1: which view the Letters tab is on - for the pins. */
    lettersView: () => letters.mode,
    /** GUILD1b: the panel open on the Guild tab, a fresh look taken if the last one is old. False without a guild book.
     *  GUILD2: at one of its pages when named ('members', 'vault', 'stores'...) - a page the guild does not show (the guild
     *  Stores offline) opens the Overview; unnamed, the page last up. */
    openGuild(page = null) {
      if (!guild) return false;
      tab = 'guild'; confirm = null; ui++;
      if (typeof page === 'string') { guildUi.page = page; guildUi.arm = null; }
      lookAtGuild();
      if (open) { repaint(); return true; }
      return openPanel();
    },
    /**
     * Once a frame, from the host's chat frame.
     *
     * `covered` is the HOST's word - a window over the HUD, the pause door - and it takes the panel AND the toast
     * out of the page while it holds, exactly as it does the chat (ui/chatPanel.js render, AUDIT-CHATR F1: it is
     * never the player's own state and must not share a name with it).
     */
    render({ covered = false } = {}) {
      if (!alive) return;
      if (covered || overlay()) {
        if (open) {
          const round = tab === 'party' ? journey?.()?.status?.()?.round : null;
          if (round && !round.set) resumeParty = true;   // PARTY-READY: an open round's controls come back with the panel
          closePanel();
        }
        if (root.style.display !== 'none') root.style.display = 'none';
        if (toast.style.display !== 'none') toast.style.display = 'none';
        return;
      }
      if (root.style.display !== '') root.style.display = '';
      if (toast.style.display !== '') toast.style.display = '';
      if (resumeParty) { resumeParty = false; if (!open && social.party) { tab = 'party'; openPanel(); } }   // PARTY-READY
      if (open) {
        // MAIL1: the Letters tab is drawn from the BOX, not the social picture - and the form from neither, so a presence
        // frame or a poll landing while a player types rebuilds nothing under their caret
        // GUILD1b: the Guild tab from the BOOK, as Letters is from the box
        const moved = tab === 'guild' ? (guild?.version ?? 0) !== paintedGuild || guildWho() !== paintedWho
          : tab !== 'letters' ? social.version !== painted : letters.mode !== 'write' && (mail?.version ?? 0) !== paintedMail;
        if (moved || ui !== paintedUi) repaint();
        // a countdown that just hit zero raises the panel's version from inside `paintLive`, and the row it belongs
        // to has to go on THIS pass rather than the next one - `liveInvites` has already shed it by now
        else { paintLive(); if (ui !== paintedUi) repaint(); }
      }
      paintToast();
    },
    destroy() {
      if (!alive) return;
      alive = false;
      hideCard();   // AUDIT SUGGESTIONS-1019 L4-2
      win.removeEventListener('keydown', onKey, true);
      if (social.onInvite === mineInvite) social.onInvite = priorInvite;
      root.remove?.();
      toast.remove?.();
    },
  };
}
