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
//   FOUNDER   you registered before FOUNDER_UNTIL.
//   DEVELOPER your handle is in the service's DEVELOPER_HANDLES.
//   SPROUT    your account is younger than SPROUT_S.
//   DEV       the same list as the Developer title.
//   DUNGEON MASTER, DISCIPLE, APOSTLE, HIEROPHANT (TITLE-N, 2026-09-24)
//             your handle is in that title's own list in the config;
//             each list grants the title AND its glyph.
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

import { TITLES, GLYPHS } from '../../src/net/identityToken.js';

/** THE FOUNDER CUTOFF, and it is a date rather than a count because
 *  "all current players" is a statement about a MOMENT. Everyone who
 *  had registered when Mac asked for this holds it; nobody who
 *  registers after does, and no migration had to walk a table to say
 *  so. 2026-09-23T00:00:00Z - the end of the day he asked. */
export const FOUNDER_UNTIL = 1_790_121_600;

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
});
/** The glyph each of those titles carries, in the vocabulary's words. */
export const TIER_GLYPH = Object.freeze({ dungeonmaster: 'dm', disciple: 'disciple', apostle: 'apostle', hierophant: 'hierophant' });

/** Does this player hold that list's title? A guest holds none, for the developer's reason. */
export const holdsTier = (title, player, env) =>
  typeof player?.handle === 'string' && !!player.handle && Object.hasOwn(TIER_LISTS, title)
  && handleList(env?.[TIER_LISTS[title]]).has(player.handle.toLowerCase());

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
  // vanishes with a cleared browser and was never anybody's.
  if (Number.isFinite(player?.registered_at) && player.registered_at <= FOUNDER_UNTIL) held.push('founder');
  if (isDeveloper(player, env)) held.push('developer');
  for (const t of Object.keys(TIER_LISTS)) if (holdsTier(t, player, env)) held.push(t);   // TITLE-N
  return held;
}

/** THE GLYPHS THAT ARE TRUE OF THIS PLAYER. Not held and not worn -
 *  true, which is why nothing equips one and why the order is fixed
 *  rather than a preference. */
export function glyphsOf(player, env, nowS) {
  const on = [];
  if (Number.isFinite(player?.created_at) && nowS - player.created_at < SPROUT_S) on.push('sprout');
  if (isDeveloper(player, env)) on.push('dev');
  if (isModerator(player, env)) on.push('mod');   // MOD1: the blue shield
  for (const t of Object.keys(TIER_LISTS)) if (holdsTier(t, player, env)) on.push(TIER_GLYPH[t]);   // TITLE-N: each title's own glyph
  return on;
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

/** The account view's own half: what to show in the window. */
export const wardrobeOf = (player, env, nowS) => ({
  titles: titlesHeld(player, env),
  title: titleWorn(player, env) ?? null,
  glyphs: glyphsOf(player, env, nowS),
});

export { TITLES, GLYPHS };
