// @ts-check
// STAFF-PANEL5-FREEZE (2026-10-22; design doc "DFO Staff Panel: design", Freeze player and Freeze chat): THE HOST'S WIRING
// of a staff freeze and the staff chat (net/staffChat.js, ui/freezeScreen.js), one a chat log - a module the host wires
// (HOST-SPLIT: THE HOSTS DO NOT GROW), so scenes/world.js holds its calls alone. The relay's `frozen` comes in on every
// session (`wire`), the staff nudge on the hub's link; a line typed on the Staff tab goes to the account service and its
// id down the hub's link; while a freeze stands every other tab is shut, its commands too (`claims`, `send`); and the
// thread's slow read runs on a clock of the module's own.
import { createStaffChat, frozenChatText, STAFF_TAB, STAFF_POLL_MS } from '../net/staffChat.js';
import { accountStaffChat } from '../net/accountClient.js';
import { createFreezeScreen } from '../ui/freezeScreen.js';
import { setStaffFrozen } from '../characters/playerEntity.js';
import { appStorage } from '../systems/appStorage.js';

/**
 * The host, made at each chat start - the one before it (`prev`) let go. `hub()` the hub's link (its `sendChat`),
 * `online` the presence session (its `name`, and its `frozen` at a room's hello).
 * @param {any} log the ChatLog @param {() => any} hub @param {any} online @param {any} [prev]
 * @param {{ fetch?: (u: any, i: any) => Promise<any>, storage?: any, doc?: Document }} [io]
 */
export function createStaffFreezeHost(log, hub, online, prev = null, { fetch = (u, i) => globalThis.fetch(u, i), storage = appStorage(), doc = document } = {}) {
  prev?.destroy();
  const api = accountStaffChat({ fetch, storage });
  const screen = createFreezeScreen({ doc });
  const chat = createStaffChat({
    log, me: () => String(online?.name ?? ''), read: api.read, send: api.send,
    nudge: (sl) => hub()?.sendChat(String(sl), { ch: STAFF_TAB }) ?? false,
    onFrozen: (s) => { setStaffFrozen(s.until); screen.paint(s); },
  });
  const poll = setInterval(() => chat.tick(), STAFF_POLL_MS / 3);   // the slow read's clock, the host's own (no frame of the host's grows)
  const host = {
    ...chat,
    /** A session's relay words, wired: its `frozen`, and (the hub's alone) its nudge. @param {any} s */
    wire(s) {
      if (!s) return;
      s.onFrozen = (/** @type {{ until: number }} */ f) => chat.heardFrozen(f.until);
      s.onStaffNudge = () => chat.heardNudge();
    },
    /** Whether a line typed on `tabId` is this host's: the Staff tab's always, every other tab's while a freeze stands. @param {string} tabId */
    claims: (tabId) => tabId === STAFF_TAB || chat.frozen(),
    /** A line `claims` took: the Staff tab's to the service, any other tab's refused in words. @param {string} tabId @param {string} text */
    send(tabId, text) {
      if (tabId === STAFF_TAB) return chat.say(text);
      log.push(tabId, { text: frozenChatText(), system: true });
      return true;
    },
    destroy() { clearInterval(poll); setStaffFrozen(0); screen.destroy(); },
  };
  host.wire(online);
  return host;
}
