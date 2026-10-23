// @ts-check
// STAFF-PANEL5-MESSAGE (2026-10-22, mob, 04:14Z: a message in the middle of one player's screen; design doc "DFO Staff
// Panel: design", Message on screen): THE GAME'S HALF - the hub's nudge in, the words read, the box shown, the OK said.
//
// The hub's `{t:'smsg', mi}` (net/online.js `onStaffMessage`) says only that a message waits; it is made from the account
// service's signed order alone, and the game marks it from the frame type. The WORDS come off the account service with
// this player's own session (/v1/safety/staff-messages), never off the relay, so a relay that lies can only make the game
// ask again - and asks are paced (STAFF_ASK_GAP_MS), one at a time. Each message is shown once, one box at a time, oldest
// first (ui/staffMessageBox.js), until the player presses OK; the OK goes back to the service
// (/v1/safety/staff-message-ok) - their game's word, which staff read as "they pressed OK", never as proof.
//
// A COPY GOES IN THE STAFF CHAT TAB so the player can read it again (design doc): `log.push(STAFF_TAB, line)`, the one
// call into the host's chat log (net/chat.js ChatLog - the Staff tab, id `staff`, is the freeze slice's; a log without
// it keeps nothing and says so by answering null). This module keeps its own list besides (`list`), so a build whose log
// has no Staff tab yet still holds them.
//
// STAFF-PANEL5-MESSAGE-FIX: the Staff tab is off the bar unless staff froze the player or opened a talk (net/staffChat.js),
// so a copy landing puts it on the bar and keeps it there (staffCopyShown) - else the copy could never be read again. And
// an answer is at most the service's five oldest: when it said `more`, the game asks again once the player has pressed OK
// on the boxes it holds - a nudge for a sixth answered the five still up, and nothing asked for it after.
import { call, storedSession, serviceBase } from './accountClient.js';
import { staffCopyShown } from './staffChat.js';
import { appStorage } from '../systems/appStorage.js';
import { showStaffMessageBox } from '../ui/staffMessageBox.js';
import { t } from '../systems/textManager.js';
import { STAFF_TAB } from './staffChat.js';

/** The chat tab a message's copy lands on: the freeze slice's Staff tab, declared in its one home (net/staffChat.js - AUDIT 24's one export a name, test/systems/talk/audit24_onehome.test.js). */
export { STAFF_TAB };
/** One ask of the service at most this often, ms - the nudge is the relay's, and the relay is the player's own choice. */
export const STAFF_ASK_GAP_MS = 5000;
/** Messages this module keeps in its own list (the Staff tab's copy is the log's). */
export const STAFF_MESSAGES_KEPT = 20;

/** The Staff tab's line for a message. @param {{ from: string, text: string }} m */
export const staffMessageLine = (m) => t('net.staffMsg.chat', 'Message from staff ({name}): {text}', { name: m.from, text: m.text });

/**
 * @param {{ push: (tabId: string, fields: any) => unknown, setShown: (tabId: string, shown: boolean) => unknown }|null} log the host's chat log (net/chat.js ChatLog), or null
 * @param {{ fetch?: (u: string, i: any) => Promise<any>, storage?: any, show?: typeof showStaffMessageBox, now?: () => number,
 *   wait?: (fn: () => void, ms: number) => unknown }} [io]
 */
export function createStaffMessages(log, { fetch = (u, i) => globalThis.fetch(u, i), storage = appStorage(), show = showStaffMessageBox, now = () => Date.now(), wait = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const session = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Array<{ id: string, from: string, text: string, at: number }>} */
  const kept = [];
  /** @type {typeof kept} */
  const queue = [];
  let up = false, asking = false, again = false, timer = false, more = false, askedAt = -Infinity;

  const next = () => {
    if (up || !queue.length) return;
    const m = /** @type {typeof kept[number]} */ (queue.shift());
    up = true;
    show({ from: m.from, text: m.text, onOk: () => {
      up = false;
      const io = session();
      const said = io ? call(io, '/v1/safety/staff-message-ok', { id: m.id }) : null;   // never throws (accountClient's law)
      next();
      void Promise.resolve(said).then(() => { if (!up && more) void ask(); });   // the last box OK'd and its OK in: the ones past the answer's bound
    } });
  };

  async function ask() {
    if (asking) { again = true; return; }   // a nudge while the service is asked: asked once more after it
    const gap = askedAt + STAFF_ASK_GAP_MS - now();
    if (gap > 0) { if (!timer) { timer = true; wait(() => { timer = false; void ask(); }, gap); } return; }
    const io = session();
    if (!io) return;
    asking = true; askedAt = now();
    try {
      const r = await call(io, '/v1/safety/staff-messages', {});
      more = r.ok && r.data?.more === true;
      for (const m of r.ok && Array.isArray(r.data?.messages) ? r.data.messages : []) {   // `call` answers { ok, data } and never throws
        if (typeof m?.id !== 'string' || seen.has(m.id) || typeof m.text !== 'string' || !m.text) continue;
        seen.add(m.id);
        const one = { id: m.id, from: typeof m.from === 'string' ? m.from : '', text: m.text, at: Number.isSafeInteger(m.at) ? m.at * 1000 : now() };
        kept.push(one);
        if (kept.length > STAFF_MESSAGES_KEPT) kept.shift();
        if (log?.push(STAFF_TAB, { text: staffMessageLine(one), at: one.at, system: true })) staffCopyShown(log);   // on the bar, to be read again
        queue.push(one);
      }
    } finally { asking = false; }
    next();
    if (again) { again = false; void ask(); }
  }

  return {
    /** The hub's nudge: a message waits (its id - the words are the service's). */
    heard: (/** @type {string} */ mi) => { if (typeof mi === 'string' && !seen.has(mi)) void ask(); },
    /** The messages this game has shown, oldest first. */
    list: () => kept.map((m) => ({ ...m })),
  };
}
