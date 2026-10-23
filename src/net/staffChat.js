// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-FREEZE (2026-10-22; design doc "DFO Staff Panel: design", Freeze player and Freeze chat) - THE GAME'S HALF
// of a staff freeze and of the staff chat. The relay's half is server/src/staffFreeze.js, the account service's
// server-account/src/staffFreeze.js.
//
// A FREEZE (the relay's `{t:'frozen', until}`, at every hello while it stands and when an order lands): the motor held as
// paralysis holds it and no blow delivered (characters/playerEntity.js setStaffFrozen), the "Frozen by staff" screen
// (ui/freezeScreen.js), and the Staff tab on the bar - the only chat this player can use while it stands (mob, 04:23Z).
// This screen is the player's alone: a game that ignores it is still held by the relay and the service.
//
// THE STAFF CHAT: every line lives in the account service (/v1/staff-chat/read and /send); the hub carries only a NUDGE
// naming a new line's id (`{t:'chat', ch:'staff', text: '<id>'}` out, `{..., sl}` in), and a nudge is a reason to read
// the thread again, never a line. A slow read (STAFF_POLL_MS) while the tab is on the bar covers a nudge lost on the way.
// The thread's first answer carries the server's Discord invite (DISCORD_INVITE_URL on the service), said on the tab
// as a line with a Copy button (ui/chatPanel.js `copy`).
//
// OFFLINE ONLY until mob tries it live.
// ═══════════════════════════════════════════════════════════════════

import { t } from '../systems/textManager.js';
import { untilText } from './safety/safetyLaw.js';
import { accountRefusalText } from './accountClient.js';

/** The chat tab's id (net/chat.js CHAT_TABS) - a shared contract with the other Staff Panel builders. */
export const STAFF_TAB = 'staff';
/** The tab's row (net/chat.js CHAT_TABS's shape), added to the log by the chat (ChatLog.addTab): a private thread with
 *  staff, off the bar until staff froze the player or opened a talk, and then the only tab a frozen player can use. */
export const STAFF_TAB_ROW = Object.freeze({ id: STAFF_TAB, label: 'Staff', room: null, link: false, get hint() { return t('net.chat.staffHint', 'Only you and the game staff'); }, hidden: true, peekAll: true });
/** The thread read again this often while the Staff tab is on the bar, ms - a nudge lost on the way is late, never lost. */
export const STAFF_POLL_MS = 30_000;

/** STAFF-PANEL5-MESSAGE-FIX: the logs whose Staff tab holds a staff message's copy (net/staffMessages.js) - the tab kept on
 *  the bar from then, frozen or not (design doc, Message on screen: "A copy goes in their Staff chat tab so they can read
 *  it again"). */
const copied = new WeakSet();
/** A staff message's copy landed on `log`'s Staff tab: the tab on the bar, and kept there. @param {Log} log */
export const staffCopyShown = (log) => { copied.add(log); log.setShown(STAFF_TAB, true); };

export const frozenTitleText = () => t('net.freeze.title', 'Frozen by staff');
export const frozenBodyText = () => t('net.freeze.body', 'You can only look around. Talk to staff in the Staff tab of the chat.');
/** @param {number} until epoch seconds */
export const frozenUntilText = (until) => t('net.freeze.until', 'Frozen {until}.', { until: untilText(until) });
/** @param {unknown} reason */
export const frozenReasonText = (reason) => t('net.freeze.reason', 'Reason: {reason}', { reason: String(reason ?? '') });
export const frozenLiftedText = () => t('net.freeze.lifted', 'Staff lifted your freeze. You can move again.');
export const frozenChatText = () => t('net.freeze.chatShut', 'While you are frozen you can only talk to staff, in the Staff tab.');
/** @param {string} url */
export const staffInviteText = (url) => t('net.freeze.invite', 'Our Discord: {url}', { url });
export const staffNameText = () => t('net.freeze.staff', 'Staff');

/** The service's invite, if it is one a player may be shown: an https link, one line. @param {unknown} v */
export const inviteOf = (v) => (typeof v === 'string' && v.length <= 200 && /^https:\/\/[^\s]+$/.test(v) ? v : null);

/**
 * @typedef {{ ok: boolean, data?: any, error?: string }} Answer
 * @typedef {{ push: (tab: string, line: object) => unknown, setShown: (tab: string, shown: boolean) => unknown, select?: (tab: string) => unknown, addTab?: (row: object) => unknown }} Log
 */

/**
 * The game's staff chat and freeze, one a page. `read(after)` and `send(text)` are the account service's two player
 * routes (accountClient.js accountStaffChat); `nudge(sl)` says a line's id on the hub link (false when it could not);
 * `onFrozen(state)` paints the screen and holds the motor (`{ until, reason, invite }`, until 0 when lifted).
 * @param {{ log: Log, read: (after: number) => Promise<Answer>, send: (text: string) => Promise<Answer>, nudge: (sl: number) => boolean, onFrozen: (s: { until: number, reason: string|null, invite: string|null }) => void, me?: () => string, now?: () => number }} io
 */
export function createStaffChat({ log, read, send, nudge, onFrozen, me = () => '', now = () => Date.now() }) {
  log.addTab?.(STAFF_TAB_ROW);
  let until = 0, reason = /** @type {string|null} */ (null), invite = /** @type {string|null} */ (null);
  let last = 0, open = false, readAt = -Infinity;
  /** @type {Promise<void>|null} */
  let reading = null, again = false;
  /** The relay's `frozen` words heard: a read begun before the latest is older than it (STAFF-PANEL5-FREEZE-FIX). */
  let heard = 0;
  const frozen = () => until > now() / 1000;
  const paint = () => onFrozen({ until: frozen() ? until : 0, reason, invite });
  const shown = () => log.setShown(STAFF_TAB, frozen() || open || copied.has(log));
  const system = (/** @type {string} */ text, extra = {}) => log.push(STAFF_TAB, { text, system: true, ...extra });
  /** One read at a time; one asked meanwhile runs after it (a nudge is a reason to read, never a line). */
  const refresh = () => {
    if (reading) { again = true; return reading; }
    readAt = now();
    const word = heard;
    reading = (async () => {
      try {
        const r = await read(last);
        if (!r?.ok || !r.data) return;
        const d = r.data;
        open = d.open === true;
        // THE SERVICE'S ANSWER BOTH WAYS (STAFF-PANEL5-FREEZE-FIX, a review: a lift the relay never said - its link down
        // then - held the motor until the old end), unless the relay spoke while it was read: its word is the newer
        if (word === heard) {
          const f = d.frozen && Number.isSafeInteger(d.frozen.until) ? d.frozen : null;
          reason = f && typeof f.reason === 'string' ? f.reason : null;
          until = f ? f.until : 0;
        }
        const url = inviteOf(d.invite);
        if (url && url !== invite) { invite = url; system(staffInviteText(url), { copy: url }); }
        for (const l of Array.isArray(d.lines) ? d.lines : []) {
          if (!Number.isSafeInteger(l?.id) || l.id <= last || typeof l.text !== 'string') continue;
          last = l.id;
          log.push(STAFF_TAB, l.staff ? { id: 'staff', name: staffNameText(), text: l.text, at: l.at * 1000 } : { id: 'me', name: me(), text: l.text, at: l.at * 1000, mine: true });
        }
        shown();
        paint();
      } finally {
        reading = null;
        if (again) { again = false; refresh(); }
      }
    })();
    return reading;
  };
  return {
    STAFF_TAB,
    /** Whether staff froze this player, now. */
    frozen,
    /** The relay's word: frozen until then (epoch seconds), or 0 lifted. @param {number} u */
    heardFrozen(u) {
      if (!Number.isSafeInteger(u) || u < 0) return;
      heard++;
      const was = frozen();
      until = u;
      if (!frozen()) reason = null;
      paint();
      shown();
      if (frozen() && !was) { log.select?.(STAFF_TAB); refresh(); }
      else if (!frozen() && was) system(frozenLiftedText());
    },
    /** A nudge: my thread has a line to read. */
    heardNudge() { refresh(); },
    /** A line typed on the Staff tab: the service stores it first, then the hub is nudged. Answers true - the line
     *  left the field; a refusal is said on the tab. @param {string} text */
    say(text) {
      (async () => {
        const r = await send(text);
        if (!r?.ok) { system(accountRefusalText(r?.error ?? 'server')); return; }
        if (Number.isSafeInteger(r.data?.line?.id)) nudge(r.data.line.id);
        await refresh();
      })();
      return true;
    },
    /** The host's frame: the slow read while the tab is on the bar. @param {number} [at] */
    tick(at = now()) { if ((frozen() || open) && at - readAt >= STAFF_POLL_MS) refresh(); },
    refresh,
  };
}
