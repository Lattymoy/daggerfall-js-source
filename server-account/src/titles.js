// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC3 — WHAT A PLAYER HOLDS, AND WHAT A PLAYER WEARS.
//
// Mac (2026-09-22): "Player titles appear above a player name. We will
// develop 2 titles to start out. 1st title is Founder with a gold
// color, 2nd title is Developer with a red color. All current players
// should be granted the founder title." And beside them, glyphs: "a
// sprouting green plant, attached to new accounts for 2 weeks" and "a
// developer glyph specifically for developers".
//
// ═══ EVERY GRANT IS DERIVED, AND NOT ONE OF THEM IS A COLUMN ═══════
//
// This is the whole design and it is the repo's own law (DERIVED OVER
// ENUMERATED) applied to the one place a grant is usually a row:
//
//   FOUNDER   your registered account first played by FOUNDER_UNTIL.
//   DEVELOPER your handle is in the service's DEVELOPER_HANDLES.
//   SPROUT    your account is younger than SPROUT_S.
//   DEV       the same list as the Developer title.
//   DUNGEON MASTER, DISCIPLE, APOSTLE, HIEROPHANT (TITLE-N, 2026-09-24)
//             your handle is in that title's own list in the config;
//             each list grants the title AND its glyph. PATREON-LINK
//             (2026-10-01): or, for the three Patreon tiers, the Patreon
//             account you linked is an active patron entitled to that
//             tier now (patreon.js) - Patreon's word, stored as WB9g's
//             sale is, and read against the config at every ask.
//   SHADOW FANG (SHADOW-FANG, 2026-09-26) the same, one player's own.
//   PENITENT (PENITENT, 2026-09-29) the same, Diggleborf's own.
//   HERALD (HERALD, 2026-10-01) the same, and the Patreon tier's.
//   GRAND CHAMPION, ARENA CHAMPION and THE LAUREL (ARENA4, 2026-10-02)
//             the arena's rows (server-account/src/arena.js): a Grand
//             Champion row the relay signed; the season's #1 of the
//             refereed board, and its laurel, while they hold the top.
//   GATEBREAKER (WB9g, 2026-09-30) - the ONE grant that is not derived
//             but recorded: the title the Sigil Broker sells, held because
//             the account bought it (the row's `insignia`, 0036). A sale is
//             a fact that happened, not a rule a row satisfies - and what
//             is HELD is still read off the row at every ask, as the rest.
//
// WHY THAT AND NOT A `grants` TABLE. Mac asked that "all current
// players should be granted the founder title", and the obvious
// reading is a migration that walks every row and writes one. A walk
// like that is a fact recorded ONCE, at a moment nobody can re-derive:
// a row added by hand afterwards has no founder flag and nothing says
// why, a row restored from a backup has whatever the backup had, and
// the question "who is a founder?" can only be answered by reading
// 300,000 rows. A CUTOFF answers it in one line, gives the same set
// today, and keeps giving the right answer tomorrow.
//
// AND THE SPROUT IS THE SAME ARGUMENT WITH TEETH: a glyph that expires
// after two weeks, stored, needs something to come along and remove it.
// That is a cron, and a cron is a thing that can stop running while
// everything looks fine (AUDIT-ACC F9 settled exactly this for idle
// sessions, one system over). Derived from `created_at`, it expires
// because time passed, which is not a job anybody can forget to run.
//
// ═══ HOLDING IS NOT WEARING ════════════════════════════════════════
//
// A player may hold two titles and wears at most one - Mac: "equip 1
// feature". The WORN one is the only thing stored (`players.title`),
// because it is the only thing that is a choice. Equipping validates
// against the derived set, so a title that lapses cannot go on being
// worn by a row nobody has looked at since.
// ═══════════════════════════════════════════════════════════════════

import { TITLES, GLYPHS, AURAS, SEAT_TITLES } from '../../src/net/identityToken.js';
import { insigniaHeld, insigniaKeys } from '../../src/net/insignia.js';   // WB9g: the Broker's insignia - a title and an aura bought
import { patreonTitlesOf } from './patreon.js';   // PATREON-LINK: a Patreon tier's title, held by the pledge

/** THE FOUNDER CUTOFF, and it is a date rather than a count because
 *  "all current players" is a statement about a MOMENT. Everyone who
 *  had registered when Mac asked for this holds it; nobody who
 *  registers after does, and no migration had to walk a table to say
 *  so. 2026-09-23T00:00:00Z - the end of the day he asked.
 *
 *  FOUNDER2 (2026-09-24, Mac: "I want to grant all current accounts the
 *  founder title if they dont have it already"): the SAME statement made
 *  again at a later moment, so the cutoff moves to the end of THIS day -
 *  2026-09-25T00:00:00Z - and every account registered since TITLE-R
 *  closed it is a founder too, with no row written. After it the title is
 *  closed again (TITLE-R's law). A guest still holds none: nothing to
 *  compare, and a founding title on a row one storage clear from gone was
 *  never anybody's.
 *
 *  FOUNDER3 (2026-09-27, Mac: "we still need to grant everyone the founder
 *  title befire the original cut off date. A lot of people are missing
 *  it"): the SAME instant, read off when the account FIRST PLAYED rather
 *  than when it registered (`firstPlayed`, below). The instant does not
 *  move, in either direction: nobody who holds it loses it. */
export const FOUNDER_UNTIL = 1_790_294_400;

/** How long the sprout stays on a new account: two weeks, in seconds,
 *  spelled as the arithmetic rather than as 1209600 so a reader can
 *  check it against the sentence Mac wrote. */
export const SPROUT_S = 14 * 24 * 60 * 60;

/** The developers, off the service's own config. A LIST IN CONFIG and
 *  not a column, because granting one is a thing a person does by
 *  editing a file that is reviewed and deployed - not by reaching into
 *  a live database at three in the morning. Case-folded on the way in,
 *  because `handle_lc` is what uniqueness is really on. */
export function developerHandles(env) {
  return handleList(env?.DEVELOPER_HANDLES);
}

/** MOD1: the moderators, the same way and for the same reason. Mac
 *  names them; a deploy grants them; taking a handle off revokes the
 *  glyph and the commands on that player's next token and next call. */
export function moderatorHandles(env) {
  return handleList(env?.MODERATOR_HANDLES);
}

/** One reading of a comma list of handles, so the two lists cannot
 *  come to disagree about case or spaces. */
function handleList(raw) {
  if (typeof raw !== 'string' || !raw) return new Set();
  return new Set(raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
}

/** ═══ TITLE-N (2026-09-24, Mac) ═══════════════════════════════════
 *
 * "Dungeon Master is an orange title with its own glyph. This title
 * allows the user to use the /dm to message chat with orange text
 * (similar to /red). This goes strictly to the account SquidKamer" -
 * and "Disciple, Apostle, Hierophant are new patreon titles. These also
 * recieve their own unique glyphs. The account Dutchess will recieve
 * the Disciple title/glyph".
 *
 * Each is a HANDLE LIST IN CONFIG, the developers' own law and for the
 * developers' reason: granting one is a reviewed, deployed edit, never
 * a reach into the live database - and a Patreon tier that lapses is a
 * handle taken off a list, gone from that player's next token. The
 * title is HELD and may be worn; the glyph beside it is TRUE, and so
 * is the Dungeon Master's /dm: the relay reads that right off the `dm`
 * glyph in the signed token, as /red reads `dev`.
 */
export const TIER_LISTS = Object.freeze({
  dungeonmaster: 'DUNGEON_MASTER_HANDLES',
  disciple: 'DISCIPLE_HANDLES',
  apostle: 'APOSTLE_HANDLES',
  hierophant: 'HIEROPHANT_HANDLES',
  // SHADOW-FANG (2026-09-26, Mac): "SirMcMobdon gets a brand new title/glyph. Remove them from Apostle" - a title
  // made for one player, granted the tiers' way: a list in the config, the title and its glyph together.
  shadowfang: 'SHADOW_FANG_HANDLES',
  // PENITENT (2026-09-29, Mac): "This new custom title/glyph is for the user Diggleborf" - a second title made for one
  // player, granted the same way.
  penitent: 'PENITENT_HANDLES',
  // HERALD (2026-10-01, Mac: "Herald doesnt exist ingame yet" - "you'll need to develop the herald title/glyph"): the
  // Patreon tier between Disciple and Hierophant. Held by its pledge (PATREON_TIERS) like the tiers before it, and by
  // this list for a Herald Mac names.
  herald: 'HERALD_HANDLES',
});
/** The glyph each of those titles carries, in the vocabulary's words. */
export const TIER_GLYPH = Object.freeze({ dungeonmaster: 'dm', disciple: 'disciple', apostle: 'apostle', hierophant: 'hierophant', shadowfang: 'shadowfang', penitent: 'penitent', herald: 'herald' });

/** Does this player hold that list's title? A guest holds none, for the developer's reason. PATREON-LINK (2026-10-01,
 *  Mac: "having to manually hand out titles ... its really hard to keep up with it"): AND a Patreon tier's title is held
 *  by the pledge too - the account's linked Patreon membership, read against PATREON_TIERS (patreon.js) - so a patron
 *  needs no line here, and the lists stay for the titles Mac grants by name. */
export const holdsTier = (title, player, env) =>
  typeof player?.handle === 'string' && !!player.handle && Object.hasOwn(TIER_LISTS, title)
  && (handleList(env?.[TIER_LISTS[title]]).has(player.handle.toLowerCase()) || patreonTitlesOf(player, env).includes(title));

/** Is this player one of them? A handle a guest does not have cannot
 *  be in any list, so a guest is never a developer - which is right:
 *  the list names people, and a guest row is a device. */
export const isDeveloper = (player, env) =>
  typeof player?.handle === 'string' && !!player.handle
  && developerHandles(env).has(player.handle.toLowerCase());

/** MOD1: is this player a moderator? A guest cannot be, for the same
 *  reason a guest cannot be a developer. */
export const isModerator = (player, env) =>
  typeof player?.handle === 'string' && !!player.handle
  && moderatorHandles(env).has(player.handle.toLowerCase());

/** MOD1: MAY THIS PLAYER MODERATE? A moderator may, and so may a
 *  developer - the people who can already speak as the server are not
 *  made to add themselves to a second list to mute somebody. The GLYPH
 *  stays the moderator list's alone: the dev mark already says more. */
export const canModerate = (player, env) => isModerator(player, env) || isDeveloper(player, env);

/** FOUNDER3: WHEN THIS ACCOUNT FIRST PLAYED. Founder was read off
 *  `registered_at`, and registering is only the moment a player chose a
 *  name: a player here as a guest since before the cutoff who registered
 *  after it held nothing (Field-Bugs 2026-09-26b, report 3). `created_at`
 *  is stamped at a row's first contact, guest or not, and registering is
 *  an upgrade IN PLACE of that same row (0002), so it is still there. A
 *  row without one is judged by its registration, as before. */
const firstPlayed = (player) =>
  Math.min(player.registered_at, Number.isFinite(player.created_at) ? player.created_at : Infinity);

/**
 * THE TITLES THIS PLAYER HOLDS, in the order they are offered.
 * @param {any} player the row
 * @param {any} env    the Worker's config
 */
export function titlesHeld(player, env) {
  const held = [];
  // FOUNDER IS FOR REGISTERED ACCOUNTS (Mac's own call when asked
  // whether guests count): a guest row is device-bound and one storage
  // clear from gone, so a founding title on one is a title that
  // vanishes with a cleared browser and was never anybody's. FOUNDER3:
  // judged by when the account first played, so that guest holds it the
  // moment it registers. The guard stays first: D1 gives a guest a NULL
  // `registered_at`, and Math.min reads null as 0.
  if (Number.isFinite(player?.registered_at) && firstPlayed(player) <= FOUNDER_UNTIL) held.push('founder');
  if (isDeveloper(player, env)) held.push('developer');
  for (const t of Object.keys(TIER_LISTS)) if (holdsTier(t, player, env)) held.push(t);   // TITLE-N
  // WB9g: AND THE BROKER'S - a title bought with Sigil Stones, held because the sale is recorded on the row (0037). A
  // guest row cannot buy one (accounts.js buyInsignia refuses it), so none is ever read off one.
  for (const t of insigniaKeys(player?.insignia, 'title')) if (!held.includes(t)) held.push(t);
  // SEAT1c (Seats-Arc 7.4): AND A CHARTER'S - "Warden of <Town>", "Protector of <Kingdom>" - derived from the seats the
  // account's guildmaster characters' guilds hold (seatTurning.js seatTitlesOf), read by the caller and laid on the row
  // as `seatTitles` for this request alone
  if (Array.isArray(player?.seatTitles)) for (const t of player.seatTitles) if (SEAT_TITLES.includes(t) && !held.includes(t)) held.push(t);
  // ARENA4 (2026-10-02, Mac: "Being a top rank PvE fighter comes with it's own title. Being the #1 pvp arena player comes
  // with it's own temporary title/glyph"): THE ARENA'S TWO, derived from the arena's rows as the founder is from a date -
  // read onto the row (`arena`, server-account/src/arena.js arenaHonoursOf) where a token is minted or a wardrobe shown.
  // The Grand Champion holds for good (a row only a relay-signed climb writes); the Arena Champion while the account is
  // the season's #1, so it passes to whoever takes the top and lapses by itself. A row read without them holds neither.
  if (player?.arena?.grand === true) held.push('grandchampion');
  if (player?.arena?.champion === true) held.push('arenachampion');
  return held;
}

/** WB9g: THE AURAS THIS PLAYER HOLDS - the Broker's, bought (the row's `insignia`), in the offers' order. */
export const aurasHeld = (player) => insigniaKeys(player?.insignia, 'aura');
/** WB9g: the aura this player WEARS - the stored one, while they hold it (titleWorn's law). */
export function auraWorn(player) {
  const a = player?.aura;
  if (typeof a !== 'string' || !a) return undefined;
  return aurasHeld(player).includes(a) ? a : undefined;
}
/** WB9g: what a player may wear at their feet - the refusal word, or null; `null` (none) is always allowed. */
export function auraRefusal(aura, player) {
  if (aura === null) return null;
  if (typeof aura !== 'string' || !AURAS.includes(aura)) return 'no-aura';
  return aurasHeld(player).includes(aura) ? null : 'not-held';
}

/** THE GLYPHS THAT ARE TRUE OF THIS PLAYER, in a fixed order. GLYPH-WEAR: a player may take one off (glyphsHidden),
 *  which hides it and nothing more - this list is still what is true, and what the rights read. */
export function glyphsOf(player, env, nowS) {
  const on = [];
  if (Number.isFinite(player?.created_at) && nowS - player.created_at < SPROUT_S) on.push('sprout');
  if (isDeveloper(player, env)) on.push('dev');
  if (isModerator(player, env)) on.push('mod');   // MOD1: the blue shield
  for (const t of Object.keys(TIER_LISTS)) if (holdsTier(t, player, env)) on.push(TIER_GLYPH[t]);   // TITLE-N: each title's own glyph
  if (player?.arena?.champion === true) on.push('laurel');   // ARENA4: the laurel, true of the season's #1 while they hold it
  return on;
}

/** GLYPH-WEAR (2026-10-02, Mac: "can we make it where players can also equip/unequip their glyphs"): THE GLYPHS THIS
 *  PLAYER HAS TAKEN OFF - the stored choice (`glyphs_off`, 0068), read against what is true now, so a glyph that has
 *  lapsed is not "hidden" and one granted later shows until it is taken off. In glyphsOf's order. */
export function glyphsHidden(player, env, nowS) {
  const off = typeof player?.glyphs_off === 'string' ? player.glyphs_off.split(' ') : [];
  return glyphsOf(player, env, nowS).filter((g) => off.includes(g));
}

/** GLYPH-WEAR: THE GLYPHS THIS PLAYER SHOWS - what is true of them, less what they took off. Paint alone: a right that
 *  rides a glyph (the relay's /red and /dm, canModerate, the staff commands) reads glyphsOf, never this. */
export function glyphsShown(player, env, nowS) {
  const off = glyphsHidden(player, env, nowS);
  return glyphsOf(player, env, nowS).filter((g) => !off.includes(g));
}

/** GLYPH-WEAR: may this player show or hide this glyph - the refusal word, or null. Only a glyph true of them now. */
export function glyphRefusal(glyph, player, env, nowS) {
  if (typeof glyph !== 'string' || !GLYPHS.includes(glyph)) return 'no-glyph';
  return glyphsOf(player, env, nowS).includes(glyph) ? null : 'not-held';
}

/** The title this player WEARS: the stored one, but only while they
 *  still hold it. A stored title is a choice made once and a grant is
 *  a fact checked now, so the check is here rather than at the write -
 *  a developer removed from the list stops wearing the badge on their
 *  next token, without anybody having to remember to clear a column. */
export function titleWorn(player, env) {
  const t = player?.title;
  if (typeof t !== 'string' || !t) return undefined;
  return titlesHeld(player, env).includes(t) ? t : undefined;
}

/** What a player may equip, answered as the service answers it: the
 *  refusal word, or null. `null` (take it off) is always allowed - a
 *  player may always wear nothing. */
export function equipRefusal(title, player, env) {
  if (title === null) return null;
  if (typeof title !== 'string' || !TITLES.includes(title)) return 'no-title';
  return titlesHeld(player, env).includes(title) ? null : 'not-held';
}

/** GLYPH-WEAR: `{ glyphsOff }` while a glyph is taken off, else nothing - a player hiding none reads the answer they always did. */
const glyphsOffOf = (player, env, nowS) => { const off = glyphsHidden(player, env, nowS); return off.length ? { glyphsOff: off } : {}; };

/** The account view's own half: what to show in the window. WB9g: and the auras held and the one worn, and the
 *  Broker's insignia the account bought (its ids). */
export const wardrobeOf = (player, env, nowS) => ({
  titles: titlesHeld(player, env),
  title: titleWorn(player, env) ?? null,
  glyphs: glyphsOf(player, env, nowS),
  ...glyphsOffOf(player, env, nowS),   // GLYPH-WEAR: the ones taken off, absent for none - `glyphs` stays all that is true
  auras: aurasHeld(player),
  aura: auraWorn(player) ?? null,
  insignia: insigniaHeld(player?.insignia),
});

export { TITLES, GLYPHS };
