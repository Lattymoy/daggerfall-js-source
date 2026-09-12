// CHAT1 (2026-09-12, Mac: "I want to add a new UI element. The live chat
// in enhanced format. Players will be able to type and chat live with
// other players. Currently I just want one world tab with the ability
// to add more tabs at a later time"): THE LOG - pure, DOM-free.
//
// THE SHAPE. A tab is a channel: a label, the relay room it rides
// (net/wire.js CHAT ROOMS - the World tab is chat:world), the lines it
// has heard and how many arrived while nobody was looking. The panel
// (ui/chatPanel.js) shows the ACTIVE tab; the host (scenes/world.js)
// opens one net/online.js session per tab and feeds every line it
// hears into push(). A later tab is a later row in CHAT_TABS - nothing
// else changes shape: the sessions, the tab bar and the unread badges
// are all iterations over this list.
//
// THE CLOCK. Every stamp here is the handed-in clock's (Date.now()
// unless told otherwise - AUDIT ONLINE B1: one clock a log, never the
// rAF's mixed in); the relay's own `at` rides each line for display.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { CHAT_WORLD_ROOM } from './wire.js';

/** The tabs, in bar order: the World tab alone today. A tab is {id, label, room}. */
export const CHAT_TABS = Object.freeze([Object.freeze({ id: 'world', label: 'World', room: CHAT_WORLD_ROOM })]);
/** The most lines a tab keeps; the oldest go first. */
export const CHAT_KEEP = 200;
/** How long a line stays over the world once the panel is closed, ms; the last quarter fades. */
export const CHAT_FADE_MS = 20000;
/** The most lines shown over the world while the panel is closed. */
export const CHAT_PEEK = 5;
/** How long a channel's session waits after a terminal close before it tries the room again (AUDIT CHAT A6/B6). */
export const CHAT_REJOIN_MS = 30000;

/** A short tag from a peer's id - four base-36 characters of an FNV-1a hash - shown beside the name
 *  (AUDIT CHAT A5: the relay guards the id, not the name, and two 'Mac's must read as two people). */
export function tagOf(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id ?? '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % (36 ** 4)).toString(36).padStart(4, '0');
}

export class ChatLog {
  constructor({ tabs = CHAT_TABS, keep = CHAT_KEEP, now = () => Date.now() } = {}) {
    this.tabs = tabs.map((t) => ({ id: t.id, label: t.label, room: t.room, messages: [], unread: 0 }));
    this.active = this.tabs[0]?.id ?? null;
    this.open = false;        // the panel's state, as the log counts unread by it
    this.version = 0;         // bumps on every change the panel would show; the panel repaints on a new number, never per frame
    this._keep = Math.max(1, keep | 0);
    this._now = now;
    this._seq = 0;
  }

  tab(id) { return this.tabs.find((t) => t.id === id) ?? null; }

  /** A line in: kept on its tab, the oldest dropped past the cap, unread unless the tab is open and active. */
  push(tabId, { id = '', name = '', text = '', at = null, mine = false } = {}) {
    const tab = this.tab(tabId);
    if (!tab || typeof text !== 'string' || !text) return null;
    const now = this._now();
    const line = { seq: ++this._seq, id: String(id), name: String(name), text, at: Number.isFinite(at) ? at : now, t: now, mine: !!mine };
    tab.messages.push(line);
    if (tab.messages.length > this._keep) tab.messages.splice(0, tab.messages.length - this._keep);
    if (!(this.open && tab.id === this.active)) tab.unread++;
    this.version++;
    return line;
  }

  /** A tab to the front. */
  select(id) {
    if (!this.tab(id) || id === this.active) return false;
    this.active = id;
    if (this.open) this.markRead(id);
    this.version++;
    return true;
  }

  /** The panel opened or closed: an open, active tab is read as it arrives. */
  setOpen(open) {
    open = !!open;
    if (open === this.open) return;
    this.open = open;
    if (open) this.markRead(this.active);
    this.version++;
  }

  markRead(id) {
    const tab = this.tab(id);
    if (tab && tab.unread) { tab.unread = 0; this.version++; }
  }

  unreadTotal() { return this.tabs.reduce((n, t) => n + t.unread, 0); }

  /** The active tab's last `count` lines, newest last. */
  recent(count = this._keep) {
    const tab = this.tab(this.active);
    return tab ? tab.messages.slice(-count) : [];
  }

  /** What shows over the world while the panel is closed: the active
   *  tab's last CHAT_PEEK lines younger than CHAT_FADE_MS, each with
   *  its alpha - 1 through three quarters of the window, then down to
   *  0 - so a line arrives, stands, and goes. */
  peek({ count = CHAT_PEEK, fade = CHAT_FADE_MS } = {}) {
    const now = this._now();
    const out = [];
    for (const line of this.recent(count)) {
      const age = now - line.t;
      if (age >= fade) continue;
      const hold = fade * 0.75;
      const alpha = age < hold ? 1 : Math.max(0, 1 - (age - hold) / (fade - hold));
      out.push({ line, alpha });
    }
    return out;
  }
}
