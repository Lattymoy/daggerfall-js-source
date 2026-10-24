// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MOD1 — THE MODERATOR'S CHAT COMMANDS, and the words around them.
//
// Mac: "a moderator glyph and moderator chat commands" - /mute and
// /unmute (his pick, of the four offered).
//
//   /mute <name> [minutes]    minutes defaults to MUTE_DEFAULT_MIN
//   /unmute <name>
//
// THIS SIDE DECIDES NOTHING ABOUT AUTHORITY. It parses, finds the
// account a name belongs to, and asks. The account service decides
// whether the asker may (MODERATOR_HANDLES / DEVELOPER_HANDLES) and
// signs an order; the relay checks that signature. A moderator's
// client that skipped every line here could do nothing a player's
// could not - which is the point of putting the authority where it is.
//
// A NAME IS NOT AN ACCOUNT. Two guests can share a generated name, so
// the name typed is resolved against the players the relay has named
// in this room, each of whom carries the VERIFIED account (`sub`) the
// relay read off their token. Two matches is a refusal, never a guess:
// muting the wrong person is worse than muting nobody.
//
// Pure, and every side effect is an argument, so node drives it.
// Imported by the account Worker for MUTE_MAX_MIN, so the service and
// the command agree on the bound in one place.
// ═══════════════════════════════════════════════════════════════════

import { sanitizeName } from './wire.js';
import { t } from '../systems/textManager.js';   // L10N4: the command's words in the moderator's language (the account Worker bundles the text core already)

/** The longest one mute may run, in minutes: a week. Longer is a ban,
 *  which is a different decision and not one Mac has asked for. The
 *  service refuses past it; the command refuses first. */
export const MUTE_MAX_MIN = 7 * 24 * 60;
/** A mute with no minutes given. Half an hour: long enough to end an
 *  argument, short enough that forgetting to lift it costs little. */
export const MUTE_DEFAULT_MIN = 30;
/** The command's refusal and the service's (net/accountClient.js REFUSALS 'bad-minutes') in one sentence, from the bound.
 *  L10N4: a reader now (it was MUTE_RANGE_TEXT, read at module load) - in the player's language, read when it is said. */
export const muteRangeText = () => t('net.mod.muteRange', 'A mute is 1 to {max} minutes (one week).', { max: MUTE_MAX_MIN });

export const MUTE_USAGE = 'Usage: /mute <name> [minutes], or /unmute <name>.';
/** L10N4: MUTE_USAGE as the player reads it. */
export const muteUsageText = () => t('net.mod.usage', MUTE_USAGE);

/**
 * Read a line as a moderation command, or null if it is not one.
 * `{ op: 'mute', name, minutes }`, `{ op: 'unmute', name }`, or
 * `{ error }` for a command typed wrong - said, not sent as chat.
 *
 * A NAME MAY HAVE A SPACE IN IT (a guest's generated name always does),
 * so the minutes are the LAST word, and only when that word is a
 * number; everything before it is the name.
 * @param {string} text
 */
export function parseModCommand(text) {
  const m = /^\/(mute|unmute)(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const op = m[1].toLowerCase();
  const rest = (m[2] ?? '').trim();
  if (op === 'unmute') return rest ? { op, name: rest } : { error: muteUsageText() };
  const tail = /^(.*\S)\s+(\d+)$/.exec(rest);
  const name = tail ? tail[1] : rest;
  if (!name) return { error: muteUsageText() };
  const minutes = tail ? Number(tail[2]) : MUTE_DEFAULT_MIN;
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MUTE_MAX_MIN) {
    return { error: muteRangeText() };
  }
  return { op, name, minutes };
}

/**
 * Find the ONE account a typed name belongs to, among the peers a
 * session holds (the chat channel's, which is every player online).
 * Case-insensitive, compared through the wire's own name law so a name
 * typed the way it is shown matches.
 * @param {{ peers?: Map<string, any> } | null | undefined} session
 * @param {string} name
 * @returns {{ sub: string, name: string } | { error: string }}
 */
export function resolveTarget(session, name) {
  const want = sanitizeName(name).toLowerCase();
  const found = new Map();   // sub -> shown name: one account on two tabs is still one player
  let unaccounted = false;
  for (const p of session?.peers?.values?.() ?? []) {
    if (sanitizeName(p?.name ?? '').toLowerCase() !== want) continue;
    if (typeof p.sub === 'string' && p.sub) found.set(p.sub, p.name);
    else unaccounted = true;
  }
  if (found.size === 1) { const [[sub, shown]] = [...found]; return { sub, name: shown }; }
  if (found.size > 1) return { error: t('net.mod.ambiguous', '{count} players are called {name}. Nobody was muted.', { count: found.size, name }) };
  if (unaccounted) return { error: t('net.mod.unaccounted', '{name} cannot be muted from here yet. Try again in a moment.', { name }) };
  return { error: t('net.mod.nobody', 'Nobody called {name} is online.', { name }) };
}

/**
 * RUN ONE COMMAND, end to end, and answer the line to show the
 * moderator. `mute` is accountClient's `muteAccount`, bound to this
 * device's session; `links` are every room this client holds, and the
 * signed order is carried into each so the mute lands NOW in all of
 * them rather than on the target's next reconnect.
 * @param {{ op: 'mute'|'unmute', name: string, minutes?: number }} cmd
 * @param {{ session: any, links: Iterable<any>, mute: (sub: string, minutes: number) => Promise<any>, refusal: (e: string) => string }} io
 */
export async function runModCommand(cmd, { session, links, mute, refusal }) {
  const who = resolveTarget(session, cmd.name);
  if ('error' in who) return who.error;
  return muteNamed(who, cmd.op === 'unmute' ? 0 : (cmd.minutes ?? MUTE_DEFAULT_MIN), { links, mute, refusal });
}

/**
 * THE MUTE ITSELF, for an account already named - the command's after it has found one, and STAFF-PANEL2-CHATMENU's
 * (scenes/chatSafetyHost.js): a chat line's menu names the speaker by the account the relay stamped on the line, so
 * there is no name to resolve. The same answer and the same refusal as /mute.
 * @param {{ sub: string, name: string }} who @param {number} minutes  0 lifts it
 * @param {{ links: Iterable<any>, mute: (sub: string, minutes: number) => Promise<any>, refusal: (e: string) => string }} io
 */
export async function muteNamed(who, minutes, { links, mute, refusal }) {
  const r = await mute(who.sub, minutes);
  if (!r?.ok) return refusal(r?.error ?? 'server');
  // THE ROW IS ALREADY WRITTEN, so a missing order (a service with no
  // signing key) is still a mute - it lands on the target's next
  // connection instead of now, and the line says so.
  const order = r.data?.order;
  let carried = 0;
  if (typeof order === 'string' && order) for (const link of links) if (link?.sendMuteOrder?.(order)) carried++;
  const shown = r.data?.name ?? who.name;
  if (!minutes) return t('net.mod.unmuted', '{name} can chat again.', { name: shown });
  return carried ? t('net.mod.muted', '{name} is muted for {minutes, plural, one {# minute} other {# minutes}}.', { name: shown, minutes })
    : t('net.mod.mutedLater', '{name} is muted for {minutes, plural, one {# minute} other {# minutes}}. It takes effect when they next connect.', { name: shown, minutes });
}

/**
 * The line a muted player reads. `until` is epoch seconds; 0 is
 * "lifted". Minutes are rounded UP, so the last minute reads "1 more
 * minute" rather than "0".
 * @param {number} until @param {number} nowS
 */
export function mutedText(until, nowS) {
  if (!until || until <= nowS) return t('net.mod.chatAgain', 'You can chat again.');
  const left = Math.ceil((until - nowS) / 60);
  return t('net.mod.mutedFor', 'You are muted for {left, plural, one {# more minute} other {# more minutes}}.', { left });
}

/**
 * ONE NOTICE PER EVENT. An order reaches the target on every room it
 * holds, so the same `until` can arrive two or three times within a
 * breath; this says it once. A LATER try to talk is a new event and is
 * said again - a muted player pressing Enter must be told why nothing
 * happened, every time.
 */
export function mutedNotices({ windowMs = 2000 } = {}) {
  let last = null;
  return (until, nowMs) => {
    if (last && last.until === until && nowMs - last.at < windowMs) return false;
    last = { until, at: nowMs };
    return true;
  };
}
