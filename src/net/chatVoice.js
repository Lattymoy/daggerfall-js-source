// @ts-check
// STAFF-CHAT-RED (2026-10-23, mob, a game admin: "give me a option next to chat to chat as /red or myself at all times")
// - THE VOICE AN ADMIN'S CHAT SPEAKS IN. A switch beside the chat's field, Me or Red (ui/chatPanel.js draws it), kept
// across reloads (uiPrefs `chatAs`), so every line goes out that way without typing /red:
//
//   RED sends each typed line exactly as typing "/red <line>" would - the line handed to the host's own onSend with the
//   command in front, so RED1's one path (scenes/world.js: /red parsed, never guarded here, the relay asks the token's
//   dev glyph) is the only one. A typed command (a line starting with "/") goes as typed in either voice.
//   ONLY AN ADMIN'S: the switch stands for my own glyphs as the service last issued them (world.js `_staffGlyphs`) when
//   they hold the dev glyph - the relay's own test for /red (server/src/index.js, the `say` arm) - and only on the tabs
//   every player reads (net/safety/chatStamp.js PUBLIC_TABS): a red line reaches everyone, so a Party, Guild, Local or
//   Staff line never becomes one by a switch left on. There, and for anyone else, a line goes as typed.
//   HIDDEN (the Staff Panel's Hide me - the relay drops everything a hidden socket says but its allow list, and the
//   mint says so, accountClient.js mintFresh `hidden`): Me would show the member to players, so pressing Me while hidden
//   ASKS first, in the chat, and a second press inside VOICE_ASK_MS says yes (ui/socialPanel.js Remove's law: one click
//   arms, the second sends - no window.confirm); yes asks the Staff Panel to turn Hide off (net/staffHook.js
//   staffShowMe), and a panel that does not answer is said in words. A line typed in Me while hidden is not sent, and
//   says so, staying in the field - the relay would drop it without a word.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { getPref, setPref } from '../systems/uiPrefs.js';
import { PUBLIC_TABS } from './safety/chatStamp.js';
import { staffShowMe } from './staffHook.js';
import { t } from '../systems/textManager.js';

/** The uiPrefs key the voice is kept under. */
export const VOICE_PREF = 'chatAs';
/** How long Me's press while hidden waits for its second, ms (ui/socialPanel.js SOCIAL_CONFIRM_MS, Remove's). */
export const VOICE_ASK_MS = 4000;
/** Whether a typed line is a command - sent as typed in either voice. @param {string} text */
export const isCommandLine = (text) => String(text ?? '').trimStart().startsWith('/');

export const voiceMeText = () => t('net.chat.voiceMe', 'Me');
export const voiceRedText = () => t('net.chat.voiceRed', 'Red');
export const voiceAskText = () => t('net.chat.voiceAsk', 'This shows you to players. Turn Hide off? Press Me again to say yes.');
export const voiceShownText = () => t('net.chat.voiceShown', 'Hide is off. Players see you once your game reconnects.');
export const voiceOpenPanelText = () => t('net.chat.voiceOpenPanel', 'Open the Staff Panel to show yourself.');
export const voiceHiddenText = () => t('net.chat.voiceHidden', 'Not sent: you are hidden, so players would not see it. Pick Red, or press Me to show yourself.');

/**
 * The voice, made once by the chat safety host (scenes/chatSafetyHost.js `voice`). `glyphs()` my glyphs as issued;
 * `say(tabId, text)` a system line in the chat; `showMe()` the Staff Panel's Show myself on the window `win`, resolving
 * whether it went.
 * @param {{ glyphs?: () => unknown, say?: (tabId: string, text: string) => void, win?: any, showMe?: () => Promise<boolean>, now?: () => number }} [deps]
 */
export function createChatVoice({ glyphs = () => [], say = () => {}, win = globalThis.window, showMe = () => staffShowMe(win), now = () => Date.now() } = {}) {
  let hidden = false, askedAt = -Infinity;
  const admin = () => { const g = glyphs(); return Array.isArray(g) && g.includes('dev'); };
  const red = () => getPref(VOICE_PREF) === 'red';
  const voice = {
    /** Whether the switch stands beside the field on `tabId`, and so whether a line typed there is the voice's. @param {string} tabId */
    shown: (tabId) => admin() && PUBLIC_TABS.includes(tabId),
    /** The voice as kept: 'me' or 'red'. */
    mode: () => (red() ? 'red' : 'me'),
    /** Whether Me's press while hidden is waiting for its second. */
    asking: () => now() - askedAt <= VOICE_ASK_MS,
    hidden: () => hidden,
    /** The mint's word, at each issue: whether my game's token is a hidden staff member's. @param {any} issued */
    adopt(issued) { hidden = issued?.hidden === true; },
    /** A press on one side of the switch, on `tabId` (where the ask and its answer are said). @param {'me'|'red'} want @param {string} tabId */
    pick(want, tabId) {
      if (want === 'red' || !hidden) { askedAt = -Infinity; setPref(VOICE_PREF, want === 'red' ? 'red' : 'me'); return; }
      if (!voice.asking()) { askedAt = now(); say(tabId, voiceAskText()); return; }
      askedAt = -Infinity;
      setPref(VOICE_PREF, 'me');
      void showMe().catch(() => false).then((ok) => say(tabId, ok ? voiceShownText() : voiceOpenPanelText()));
    },
    /** A typed line out, answered as the panel's onSend answers: Red's with /red in front, a command or another tab's as
     *  typed, Me's while hidden held (false: it stays in the field).
     *  @param {string} tabId @param {string} text @param {((tabId: string, text: string) => any) | null} [onSend] */
    send(tabId, text, onSend) {
      if (!voice.shown(tabId) || isCommandLine(text)) return onSend?.(tabId, text);
      if (red()) return onSend?.(tabId, `/red ${text.trim()}`);
      if (hidden) { say(tabId, voiceHiddenText()); return false; }
      return onSend?.(tabId, text);
    },
  };
  return voice;
}
