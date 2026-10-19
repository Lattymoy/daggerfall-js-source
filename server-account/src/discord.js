// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SAFE8 (2026-10-17, Mac: "We need to find ways to combat this without the need of ingame moderation"; the chat safety
// plan, bible/11-Multiplayer/Chat-Safety-Arc.md section 9): THE MODERATORS' QUEUE IN DISCORD. A moderator need not be in
// the game to see what was reported, nor to act on it: every case (safety.js) is a card in a private channel - the
// lines, the reports, the reviewer's verdict, the account's strikes - with buttons that mute, ban or dismiss it, and a
// /mod command that looks an account up and mutes, unmutes, bans or unbans it by name.
//
// TWO HALVES, as Discord has them:
//   - OUT: the bot posts a case's card to DISCORD_MOD_CHANNEL with DISCORD_BOT_TOKEN (a secret the deploy puts, never
//     in wrangler.toml) - by the service's minute clock (safetyClock.js), and edits it when a moderator acts. Pings
//     nobody (`allowed_mentions` empty); a player's words are drawn in a code block, and every name and reason outside
//     it has its markdown escaped (AUDIT SAFE DISCORD-9: a handle `A[Appeal](https://...)` drew a link). A post carries
//     the case's id as its nonce, enforced, so a post whose answer was lost is never posted twice (DISCORD-7).
//   - IN: Discord posts each press and each /mod to the service's DISCORD_INTERACTIONS_PATH, signed with the
//     application's Ed25519 key; the signature (DISCORD_PUBLIC_KEY, the application's public key - not a secret) is
//     checked over the exact bytes before anything is read, as the Patreon webhook's is.
//
// WHO MAY ACT IS THE GAME'S QUESTION, NOT DISCORD'S. DISCORD_MODERATORS pairs a Discord user's id with a game handle
// ("<discord id>:<handle>,..."), and an act is that account's act: it must hold MODERATOR_HANDLES or DEVELOPER_HANDLES
// now (titles.js canModerate) - so taking a handle off the list takes the buttons with it, a Discord role never grants
// anything, and the record names the moderator's own account (sanctions.js). MOD1's law, through another door.
//
// A PRESS ACTS ONCE (AUDIT SAFE DISCORD-3): the case is claimed in the statement that marks it (`claimed_at`), so a
// double click or two moderators at once act once, and the other is shown the card as it now stands. A button never
// shortens what stands (DISCORD-5: "Ban 30 days" cut a ban for good to a month, "Mute 30 min" a week's mute) - the act
// is recorded and the longer kept - and the card says what stands now. A press answers Discord within its three seconds:
// the order to the relay's door is pushed after the answer (`later`, the Worker's waitUntil - DISCORD-4), and the card
// is redrawn by the clock besides, so an answer Discord gave up on still ends in the true card. DISMISS voids the
// case's automatic mutes and lifts one still running (sanctions.js voidAutoMutes). /mod names an account by its id
// FIRST (DISCORD-1: an account id is a valid handle, so a decoy named after the reported player's id took the ban).
// ═══════════════════════════════════════════════════════════════════

import { muteAccount, displayName, isMuted } from './accounts.js';
import { canModerate } from './titles.js';
import { importPublicKey, ID_RE } from '../../src/net/identityToken.js';
import { actionStatement, banAccount, unbanAccount, findAccount, strikesLook, lawOrder, pushLaw, reasonOf, muteMinutesOk, strikesOf, isBanned, bannedUntil, voidAutoMutes } from './sanctions.js';
import { resolveCase, CASE_CLAIM_S } from './safety.js';
import { usageOf } from './discordCommands.js';
import { GRANT_CASE_TAB } from './grants.js';   // FOE-BOUNDS: a spawn grants' case is its count's, not the chat reviewer's (read at a card's call, never at load)
import { LADDER_BAN_AT, ladderMinutes, BAN_FOREVER, banUntil, reportReasonLabel } from '../../src/net/safety/safetyLaw.js';

/** The door Discord posts its interactions to (the application's Interactions Endpoint URL). */
export const DISCORD_INTERACTIONS_PATH = '/v1/discord/interactions';
/** Discord's API. */
export const DISCORD_API = 'https://discord.com/api/v10';
/** The most bytes an interaction's body may be. */
export const DISCORD_BODY_MAX = 32 * 1024;
/** How old an interaction's timestamp may be, seconds - an old one replayed is refused. */
export const DISCORD_SKEW_S = 300;
/** How long the service waits on Discord's API, ms. */
export const DISCORD_POST_MS = 8000;
/** The User-Agent Discord's API asks of every bot (AUDIT SAFE DISCORD-10: "requests that do not have a valid User
 *  Agent specified may be blocked"). */
export const DISCORD_USER_AGENT = 'DiscordBot (https://github.com/Lattymoy/daggerfall-js-source, 1)';
/** An answer to a moderator, at most this long (Discord's 2,000, with room). */
export const SAY_MAX = 1900;
/** The most of a case's lines a card draws - the newest. */
export const CARD_LINES_MAX = 24;
/** The most characters a card's lines may fill (an embed's description holds 4,096). */
export const CARD_TEXT_MAX = 3400;
/** A card's buttons: what each does, by its custom id's middle word. */
export const CARD_ACTS = Object.freeze({
  m30: Object.freeze({ label: 'Mute 30 min', minutes: 30 }),
  m1d: Object.freeze({ label: 'Mute 1 day', minutes: 24 * 60 }),
  m7d: Object.freeze({ label: 'Mute 7 days', minutes: 7 * 24 * 60 }),
  b30: Object.freeze({ label: 'Ban 30 days', days: 30 }),
  dis: Object.freeze({ label: 'Dismiss' }),
});
const SNOWFLAKE_RE = /^\d{5,25}$/;
const HEX_KEY_RE = /^[0-9a-f]{64}$/i;

/** Whether the bot may post cards: a channel and its token. @param {any} env */
export const discordOn = (env) => SNOWFLAKE_RE.test(String(env?.DISCORD_MOD_CHANNEL ?? '')) && typeof env?.DISCORD_BOT_TOKEN === 'string' && env.DISCORD_BOT_TOKEN.length > 0;
/** Whether Discord's presses and commands are taken: the application's public key. @param {any} env */
export const interactionsOn = (env) => HEX_KEY_RE.test(String(env?.DISCORD_PUBLIC_KEY ?? ''));

/** DISCORD_MODERATORS read: each Discord id's game handle, lowercased. @param {any} env @returns {Map<string, string>} */
export function discordModerators(env) {
  const out = new Map();
  for (const pair of String(env?.DISCORD_MODERATORS ?? '').split(',')) {
    const [id, handle] = pair.split(':').map((s) => s?.trim() ?? '');
    if (SNOWFLAKE_RE.test(id) && handle) out.set(id, handle.toLowerCase());
  }
  return out;
}

const hexBytes = (h) => new Uint8Array(String(h).match(/../g)?.map((b) => parseInt(b, 16)) ?? []);
/** @type {{ raw: string, key: CryptoKey|null }} */
let heldKey = { raw: '', key: null };

/**
 * THE SIGNATURE, over the exact bytes Discord sent: Ed25519 over the timestamp and the body, with the application's
 * public key, the timestamp no older than DISCORD_SKEW_S. Never throws.
 * @param {any} env @param {Uint8Array} bytes @param {unknown} sigHex @param {unknown} stamp @param {{ subtle: SubtleCrypto, nowS: number }} io
 */
export async function discordSigned(env, bytes, sigHex, stamp, { subtle, nowS }) {
  if (!interactionsOn(env) || typeof sigHex !== 'string' || !/^[0-9a-f]{128}$/i.test(sigHex) || typeof stamp !== 'string' || !/^\d{1,12}$/.test(stamp)) return false;
  if (Math.abs(nowS - Number(stamp)) > DISCORD_SKEW_S) return false;
  if (heldKey.raw !== env.DISCORD_PUBLIC_KEY) heldKey = { raw: env.DISCORD_PUBLIC_KEY, key: await importPublicKey(hexBytes(env.DISCORD_PUBLIC_KEY), { subtle }) };
  if (!heldKey.key) return false;
  const head = new TextEncoder().encode(stamp);
  const signed = new Uint8Array(head.length + bytes.length);
  signed.set(head, 0);
  signed.set(bytes, head.length);
  try { return await subtle.verify({ name: 'Ed25519' }, heldKey.key, hexBytes(sigHex), signed); } catch { return false; }
}

/** A player's words as a card draws them: one line, no code fence to break out of. @param {unknown} s */
const plain = (s) => String(s ?? '').replace(/```/g, "'''").replace(/\s+/g, ' ').trim();
/** Words outside a code block: one line, every markdown mark escaped (DISCORD-9). @param {unknown} s */
export const md = (s) => plain(s).replace(/([\\`*_~|>#\[\]()<@:-])/g, '\\$1');
/** A time on the card: Discord's own, in each reader's zone. @param {number} s */
const when = (s) => `<t:${Math.floor(s)}:f>`;
/** A length of mute in words. @param {number} m */
export const minutesWord = (m) => (m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? '' : 's'}` : m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : `${m} min`);
/** A ban's end in words. @param {number} until */
const banWord = (until) => (until >= BAN_FOREVER ? 'for good' : `until ${when(until)}`);

/** What stands against an account now, in words - or null. @param {any} t the target's row @param {number} nowS */
const standingOf = (t, nowS) => [isBanned(t, nowS) ? `Banned ${banWord(bannedUntil(t))}${t?.ban_reason ? ` (${md(t.ban_reason)})` : ''}` : '',
  isMuted(t, nowS) ? `Muted until ${when(Number(t.muted_until))}` : ''].filter(Boolean).join('; ') || null;

/**
 * A CASE'S CARD - pure, from what the clock read: the case's row, its target's name and row (what stands now), its
 * lines (oldest first), its reports' reasons and notes, and the target's strikes. Its lines mark the account's own `>`
 * and the line the reviewer flagged `!` (AUDIT SAFE AI-10: a framed line was not told from a flagged one). Buttons while
 * it is open; the resolution once not. A case whose lines were swept says so (DOC-1).
 * @param {{ c: any, name: string, target?: any, lines: any[], reasons: string[], notes?: string[], strikes: number, nowS?: number }} o
 */
export function caseCard({ c, name, target = null, lines, reasons, notes = [], strikes, nowS = 0 }) {
  // FOE-BOUNDS (bible/11-Multiplayer/Spawn-Grants.md section 21): a case the spawn grants' count opened (its lines under
  // GRANT_CASE_TAB, no report, no chat verdict) says so - the chat reviewer never read it, so "found nothing against the
  // code" read as a verdict it never gave
  const spawn = c.source === 'review' && !c.ai_category && lines.some((l) => l.tab === GRANT_CASE_TAB);
  const shown = [];
  let size = 0;
  for (const l of [...lines].reverse().slice(0, CARD_LINES_MAX)) {
    const flagged = c.ai_line_at != null && l.at === c.ai_line_at && l.sub === c.ai_line_sub;
    const row = `${flagged ? '!' : l.sub === c.target ? '>' : ' '} [${l.tab}] ${plain(l.name)}: ${plain(l.text)}`;
    if (size + row.length + 1 > CARD_TEXT_MAX) break;
    shown.unshift(row);
    size += row.length + 1;
  }
  const fields = [
    { name: 'Player', value: `${md(name) || '?'} (\`${c.target}\`)`, inline: true },
    { name: 'Reports', value: c.reports ? `${c.reports} (${c.credible} counted)` : spawn ? 'none - the spawn grants\' count opened it' : 'none - the reviewer opened it', inline: true },
    { name: 'Strikes (90 days)', value: `${strikes} - next: ${strikes >= LADDER_BAN_AT ? 'a ban' : minutesWord(ladderMinutes(strikes))}`, inline: true },
  ];
  const standing = target ? standingOf(target, nowS) : null;
  if (standing) fields.push({ name: 'Now', value: standing.slice(0, 1024), inline: false });
  if (reasons.length) fields.push({ name: 'Reported for', value: [...new Set(reasons)].map(reportReasonLabel).join(', '), inline: false });
  const said = notes.map(plain).filter(Boolean);
  if (said.length) fields.push({ name: 'Reporters\' notes', value: `\`\`\`\n${said.join('\n').slice(0, 1000)}\n\`\`\``, inline: false });
  if (c.ai_state === 'done' && c.ai_category) {
    const shadow = c.ai_mode === 'shadow' ? 'SHADOW - nothing was done on it. ' : '';
    fields.push({ name: 'Reviewer', value: `${shadow}${c.ai_category}, severity ${c.ai_severity}, ${Math.round(Number(c.ai_confidence) * 100)}% sure${c.ai_line_at != null ? ' (the line marked !)' : ''}: ${md(c.ai_reason)}`.slice(0, 1024), inline: false });
  } else if (spawn) fields.push({ name: 'Spawn grants', value: 'what the relay or players\' games counted against this account\'s foes (the lines above) - the chat reviewer did not read it. A moderator decides.', inline: false });
  else if (c.ai_state === 'done') fields.push({ name: 'Reviewer', value: `${c.ai_mode === 'shadow' ? 'SHADOW - ' : ''}found nothing against the code.`, inline: false });
  else if (c.ai_state === 'failed') fields.push({ name: 'Reviewer', value: 'could not read this case - read it yourself.', inline: false });
  if (c.auto) fields.push({ name: 'Done automatically', value: c.auto === 'reports' ? 'Muted 30 min - three reports that count.' : 'Muted 30 min - the reviewer\'s verdict, read twice.', inline: false });
  const color = c.status !== 'open' ? 0x808080 : (c.ai_severity ?? 0) >= 3 ? 0xd03030 : (c.ai_severity ?? 0) === 2 ? 0xe08020 : 0x3070d0;
  const embed = {
    title: `Case ${c.id}${spawn ? ' (opened by the spawn grants)' : c.source === 'review' ? ' (opened by the reviewer)' : ''}`,
    description: c.lines_kept === 0 ? 'Its lines were deleted ninety days after it closed.' : shown.length ? `\`\`\`\n${shown.join('\n')}\n\`\`\`` : 'No lines kept.',
    color,
    fields,
    ...(c.status !== 'open' ? { footer: { text: `${c.status === 'dismissed' ? 'Dismissed' : 'Actioned'} by ${plain(c.resolved_by) || '?'}: ${plain(c.resolution)}` } } : {}),
  };
  const components = c.status === 'open'
    ? [{ type: 1, components: Object.entries(CARD_ACTS).map(([k, a]) => ({ type: 2, style: k === 'dis' ? 2 : k === 'b30' ? 4 : 1, label: a.label, custom_id: `safe:${k}:${c.id}` })) }]
    : [];
  return { embeds: [embed], components, allowed_mentions: { parse: [] } };
}

/** DISCORD-CODE: what sendCard needs in the moderators' channel, as Discord's permission bits - to see it, post in it, and
 *  draw a card's embed (editing its own message needs nothing more). The deploy computes the bot's permissions there
 *  and turns red on any missing (tools/discordModCommands.mjs --setup). */
export const MOD_CHANNEL_NEEDS = Object.freeze([['View Channel', 1n << 10n], ['Send Messages', 1n << 11n], ['Embed Links', 1n << 14n]]);

/**
 * POST OR EDIT a card in the moderators' channel. Answers `{ id }` (the message's), or what kept it (DISCORD-2):
 * `{ gone }` the message to edit is no more (a moderator deleted it, the channel changed) - post it anew; `{ refused }`
 * Discord will not take this card (any other 4xx) - pass it over; `{ down }` Discord unreachable, rate-limited or
 * erring - the rest wait the minute out. A post carries `nonce` (the case's id), enforced (DISCORD-7). Never throws.
 * @param {any} env @param {(url: string, init: any) => Promise<Response>} fetchFn @param {any} card @param {string|null} [messageId]
 * @param {{ nonce?: string }} [opt]
 * @returns {Promise<{ id: string } | { gone: true } | { refused: number } | { down: true }>}
 */
export async function sendCard(env, fetchFn, card, messageId = null, { nonce } = {}) {
  if (!discordOn(env)) return { down: true };
  const base = `${DISCORD_API}/channels/${env.DISCORD_MOD_CHANNEL}/messages`;
  try {
    const res = await fetchFn(messageId ? `${base}/${messageId}` : base, {
      method: messageId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'user-agent': DISCORD_USER_AGENT },
      body: JSON.stringify(!messageId && nonce ? { ...card, nonce, enforce_nonce: true } : card),
      signal: AbortSignal.timeout(DISCORD_POST_MS),
    });
    if (res.status === 404 && messageId) return { gone: true };
    if (res.status === 429 || res.status >= 500) { console.warn('[discord] the API said', res.status); return { down: true }; }
    if (!res.ok) { console.warn('[discord] the API refused a card:', res.status); return { refused: res.status }; }
    const msg = await res.json().catch(() => null);
    const id = typeof msg?.id === 'string' ? msg.id : messageId;
    return id ? { id } : { down: true };
  } catch (e) { console.warn('[discord] the API', /** @type {any} */ (e)?.message ?? e); return { down: true }; }
}

/** Everything a card is drawn from, read for case `id`. @param {any} db @param {string} id @param {number} nowS */
export async function cardOf(db, id, nowS) {
  const c = await db.prepare('SELECT * FROM mod_cases WHERE id = ?1').bind(id).first();
  if (!c) return null;
  const target = await db.prepare('SELECT handle, guest_name, muted_until, banned_until, ban_reason FROM players WHERE id = ?1').bind(c.target).first();
  const lines = (await db.prepare('SELECT at, sub, name, tab, text FROM mod_case_lines WHERE case_id = ?1 ORDER BY at, sub').bind(id).all())?.results ?? [];
  const reports = (await db.prepare('SELECT reason, note FROM mod_reports WHERE case_id = ?1 ORDER BY at').bind(id).all())?.results ?? [];
  return caseCard({ c, name: target ? displayName(target) : '?', target, lines, reasons: reports.map((r) => String(r.reason)), notes: reports.map((r) => r.note).filter(Boolean), strikes: await strikesOf(db, c.target, nowS), nowS });
}

/** An ephemeral answer - the moderator who asked reads it, nobody else; cut at a whole line (DISCORD-13: a cut split a
 *  `<t:...:f>` tag). @param {string} text */
const say = (text) => {
  let out = '';
  for (const line of text.split('\n')) { if ((out ? out.length + 1 : 0) + line.length > SAY_MAX) break; out = out ? `${out}\n${line}` : line; }
  return { type: 4, data: { content: out || text.slice(0, SAY_MAX), flags: 64, allowed_mentions: { parse: [] } } };
};

/** The moderator's account for a Discord user, or null - a moderator in the game now, and not banned. */
async function actorOf(db, env, discordId, nowS) {
  const handle = discordModerators(env).get(String(discordId ?? ''));
  if (!handle) return null;
  const row = await db.prepare('SELECT * FROM players WHERE handle_lc = ?1').bind(handle).first();
  return row && canModerate(row, env) && !isBanned(row, nowS) ? row : null;
}

/** The order to the relay's door, pushed after Discord is answered where the Worker allows (DISCORD-4). */
const pushAfter = (io, env, order) => { const p = pushLaw(env, io.fetchFn, order); if (io.later) io.later(p); return p; };

/**
 * A MUTE, a moderator's from Discord: MOD1's muteAccount (the authority and the bounds), its act in the record, and the
 * order pushed to the relay's door. A case's button (`keepLonger`) never shortens a mute that stands longer (DISCORD-5):
 * its act is recorded at the longer end and the mute stands. Answers the mute's end or `{ error }`.
 */
async function muteFrom(ctx, env, io, actor, row, minutes, reason, caseId, keepLonger = false) {
  if (!muteMinutesOk(minutes)) return { error: 'bad-minutes' };
  const actorName = `${displayName(actor)} (Discord)`;
  if (keepLonger && minutes && isMuted(row, ctx.nowS) && Number(row.muted_until) >= ctx.nowS + minutes * 60) {
    if (canModerate(row, env)) return { error: 'protected' };
    await actionStatement(ctx.db, { target: row.id, kind: 'mute', until: Number(row.muted_until), reason: reasonOf(reason), actor: actor.id, actorName, caseId, at: ctx.nowS }).run();
    return { ok: true, until: Number(row.muted_until), kept: true };
  }
  const r = await muteAccount(ctx, actor, env, { target: row.id, minutes });
  if (r.error) return r;
  await actionStatement(ctx.db, { target: row.id, kind: minutes ? 'mute' : 'unmute', until: r.until || null, reason: reasonOf(reason), actor: actor.id, actorName, caseId, at: ctx.nowS }).run();
  pushAfter(io, env, await lawOrder(env, ctx.subtle, ctx.nowS, { s: row.id, mu: r.until }));
  return r;
}

/** A BAN (or an unban), a moderator's from Discord - sanctions.js, then the order pushed. */
async function banFrom(ctx, env, io, actor, row, days, reason, caseId, keepLonger = false) {
  const r = days === null
    ? await unbanAccount(ctx, actor, env, { target: row.id, actorName: `${displayName(actor)} (Discord)` })
    : await banAccount(ctx, actor, env, { target: row.id, days, reason, caseId, actorName: `${displayName(actor)} (Discord)`, keepLonger });
  if (r.error) return r;
  pushAfter(io, env, await lawOrder(env, ctx.subtle, ctx.nowS, { s: row.id, bn: r.until }));
  return r;
}

/** The words a refusal says to a moderator in Discord. */
const REFUSED = Object.freeze({
  'not-moderator': 'You are not a moderator in the game.', protected: 'Moderators cannot be muted or banned.', 'no-player': 'Nobody has that name.',
  ambiguous: 'More than one guest has that name - use the account id.', 'bad-minutes': 'A mute is 1 to 10080 minutes.', 'bad-days': 'A ban is 0 (for good) to 365 days.',
  'not-banned': 'That account is not banned.',
});
const refusedText = (e) => REFUSED[/** @type {keyof typeof REFUSED} */ (e)] ?? `Refused: ${e}.`;
/** A case's card as it stands, drawn in place of the pressed one. */
const redraw = async (ctx, caseId) => ({ type: 7, data: await cardOf(ctx.db, caseId, ctx.nowS) });

/** A press of a card's button: the case claimed, the act, the case resolved, the card redrawn in place. */
async function onPress(ctx, env, body, actor, io) {
  const m = /^safe:(m30|m1d|m7d|b30|dis):([0-9a-f]{16})$/.exec(String(body?.data?.custom_id ?? ''));
  if (!m) return say('That button is not one of the safety cards\'.');
  const [, act, caseId] = m;
  const c = await ctx.db.prepare('SELECT * FROM mod_cases WHERE id = ?1').bind(caseId).first();
  if (!c) return say('That case is gone.');
  if (c.status !== 'open') return redraw(ctx, caseId);
  // THE CLAIM: one press acts; another inside CASE_CLAIM_S is shown the card as it stands
  const claimed = await ctx.db.prepare("UPDATE mod_cases SET claimed_at = ?2 WHERE id = ?1 AND status = 'open' AND (claimed_at IS NULL OR claimed_at < ?3)")
    .bind(caseId, ctx.nowS, ctx.nowS - CASE_CLAIM_S).run();
  if (!claimed?.meta?.changes) return redraw(ctx, caseId);
  const release = () => ctx.db.prepare('UPDATE mod_cases SET claimed_at = NULL WHERE id = ?1').bind(caseId).run();
  const row = await ctx.db.prepare('SELECT * FROM players WHERE id = ?1').bind(c.target).first();
  if (!row) { await release(); return say('That account is gone.'); }
  const a = CARD_ACTS[/** @type {keyof typeof CARD_ACTS} */ (act)];
  const by = `${displayName(actor)} (Discord)`;
  let resolution, status = 'actioned';
  if ('minutes' in a) {
    const r = await muteFrom(ctx, env, io, actor, row, a.minutes, `case ${caseId}`, caseId, true);
    if ('error' in r) { await release(); return say(refusedText(r.error)); }
    resolution = r.kept ? `muted (a longer mute stands, until ${when(r.until)})` : `muted ${minutesWord(a.minutes)}`;
  } else if ('days' in a) {
    const r = await banFrom(ctx, env, io, actor, row, a.days, `case ${caseId}`, caseId, true);
    if ('error' in r) { await release(); return say(refusedText(r.error)); }
    resolution = r.until > banUntil(a.days, ctx.nowS) ? `banned (a longer ban stands, ${banWord(r.until)})` : `banned ${a.days} days`;
  } else {
    await actionStatement(ctx.db, { target: row.id, kind: 'dismiss', actor: actor.id, actorName: by, caseId, at: ctx.nowS }).run();
    const order = await voidAutoMutes(ctx, env, { caseId, row, actor, actorName: by });
    if (order) pushAfter(io, env, order);
    resolution = 'no action';
    status = 'dismissed';
  }
  await resolveCase(ctx.db, { caseId, status, by: displayName(actor), resolution, nowS: ctx.nowS }).run();
  return redraw(ctx, caseId);
}


/** An option of a /mod subcommand, by name. */
const optionOf = (sub, name) => (Array.isArray(sub?.options) ? sub.options.find((o) => o?.name === name)?.value : undefined);

/** A /mod command: lookup, mute, unmute, ban, unban - by an account id, else a player's name (DISCORD-1). A mute or a
 *  ban closes the account's open case as the moderator's act, its card redrawn (DISCORD-11). */
async function onCommand(ctx, env, body, actor, io) {
  const sub = Array.isArray(body?.data?.options) ? body.data.options[0] : null;
  const who = String(optionOf(sub, 'player') ?? '').trim();
  // AN ID FIRST: an account id is a valid handle, so a name first let a decoy named after an id take the act
  let row = ID_RE.test(who) ? await findAccount(ctx.db, { target: who }) : { error: 'no-player' };
  if ('error' in row && row.error === 'no-player') row = await findAccount(ctx.db, { name: who });
  if ('error' in row) return say(refusedText(row.error));
  const name = displayName(row);
  const reason = optionOf(sub, 'reason');
  const closed = (resolution) => resolveCase(ctx.db, { target: row.id, status: 'actioned', by: displayName(actor), resolution, nowS: ctx.nowS }).run();
  switch (sub?.name) {
    case 'lookup': {
      const r = await strikesLook(ctx, actor, env, { target: row.id });
      if ('error' in r) return say(refusedText(r.error));
      const now = [r.bannedUntil ? `banned ${banWord(r.bannedUntil)}${r.banReason ? ` (${md(r.banReason)})` : ''}` : '', r.mutedUntil ? `muted until ${when(r.mutedUntil)}` : ''].filter(Boolean).join('; ') || 'in good standing';
      const acts = r.history.slice(0, 10).map((h) => `${when(h.at)} ${h.kind}${h.voided ? ' (voided - its case dismissed)' : ''}${h.until ? ` until ${h.until >= BAN_FOREVER ? 'forever' : when(h.until)}` : ''} by ${md(h.by) || '?'}${h.reason ? ` - ${md(h.reason)}` : ''}`);
      return say([`**${md(name)}** (\`${row.id}\`): ${now}. ${r.strikes} strike${r.strikes === 1 ? '' : 's'} in 90 days; next: ${r.next === 'ban' ? 'a ban' : minutesWord(Number(r.next))}.`, ...acts].join('\n'));
    }
    case 'mute': case 'unmute': {
      const minutes = sub.name === 'unmute' ? 0 : Number(optionOf(sub, 'minutes') ?? ladderMinutes(await strikesOf(ctx.db, row.id, ctx.nowS)));
      const r = await muteFrom(ctx, env, io, actor, row, minutes, reason, null);
      if ('error' in r) return say(refusedText(r.error));
      if (minutes) await closed(`muted ${minutesWord(minutes)} (/mod)`);
      return say(minutes ? `${md(name)} is muted for ${minutesWord(minutes)}.` : `${md(name)} can chat again.`);
    }
    case 'ban': case 'unban': {
      const days = sub.name === 'unban' ? null : Number(optionOf(sub, 'days') ?? 30);
      const r = await banFrom(ctx, env, io, actor, row, days, reason, null);
      if ('error' in r) return say(refusedText(r.error));
      if (days !== null) await closed(`banned ${banWord(r.until)} (/mod)`);
      return say(days === null ? `${md(name)} is unbanned.` : `${md(name)} is banned ${banWord(r.until)}.`);
    }
    default: return say(usageOf('mod'));   // DISCORD-CODE: the declared subcommands, named (discordCommands.js)
  }
}

/**
 * AN INTERACTION, signature already checked: a ping answered, a press or a command done by the moderator Discord says
 * pressed it - who must be a moderator in the game. `later` (the Worker's waitUntil) takes the relay push past the
 * answer (DISCORD-4); without it the push is still made, unawaited.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => void }} ctx @param {any} env @param {any} body
 * @param {{ fetchFn?: (url: string, init: any) => Promise<Response>, later?: (p: Promise<unknown>) => void }} [io]
 */
export async function discordInteraction(ctx, env, body, { fetchFn = (u, i) => globalThis.fetch(u, i), later } = {}) {
  if (body?.type === 1) return { type: 1 };
  const io = { fetchFn, later: later ?? ((p) => { p.catch(() => {}); }) };
  const actor = await actorOf(ctx.db, env, body?.member?.user?.id ?? body?.user?.id, ctx.nowS);
  if (!actor) return say('Only the game\'s moderators can do that - ask a developer to add your Discord id to DISCORD_MODERATORS.');
  if (body?.type === 3) return onPress(ctx, env, body, actor, io);
  if (body?.type === 2 && body?.data?.name === 'mod') return onCommand(ctx, env, body, actor, io);
  return say('Nothing to do.');
}
