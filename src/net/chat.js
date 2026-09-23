// @ts-check
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
// CHAT-CHAN (2026-09-23): a tab is a CHANNEL, not a session - the World
// and the Region tabs ride rooms of their own (one session each), the
// Party tab rides the World tab's hub session and the Local tab the
// presence session's room (see CHAT_TABS). A line the GAME says to the
// player (a notice, the server's red line) is one line on every tab
// (pushAll), counted and peeked once.
//
// THE CLOCK. Every stamp here is the handed-in clock's (Date.now()
// unless told otherwise - AUDIT ONLINE B1: one clock a log, never the
// rAF's mixed in); the relay's own `at` rides each line for display.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { CHAT_WORLD_ROOM } from './wire.js';
import { validRoll, rollText } from './dice.js';   // DICE1: a roll's line is the dice's own words

/** The tabs, in bar order. A tab is {id, label, room, link, hint}.
 *
 *  CHAT-CHAN (2026-09-23, kurkku: "Global chat that everyone everywhere sees / regional chat that everyone in the
 *  region can see / party chat"; Addison Knox: "Roleplay chat channels (IC/OOC) keeps immersion intact by separating
 *  in-character dialogue from coordination chatter"): FOUR. `room` is the channel a tab rides: the World tab the world
 *  channel; the Region tab the channel of the region the player stands in - the host sets it as they move (setRoom),
 *  and it is null until the host knows the region and the relay opens region channels; the Party and Local tabs none of
 *  their own - a party's line rides the hub's link with `ch: 'party'`, and a local line the presence session's room,
 *  where the relay already fans a line to the peers in range and each hearer keeps it only within earshot
 *  (CHAT_SAY_RANGE, localLineHeard). The Local tab is the one a character SPEAKS on - heard by the bodies near enough to
 *  hear it - so it is where dialogue in character is said; the other three reach people wherever they stand, which is
 *  coordination. On any tab a line in double parentheses is an aside OUT of character (isOocText), the tabletop's own
 *  mark: drawn as one, and never stood over a head (ui/nameLayer.js bubbleLineOk).
 *
 *  `link`: the tab rides a room of its OWN, so the host opens one channel session for it (CHAT1's one session per
 *  tab, now per tab that has a room) - the World tab and the Region tab; the Party and Local tabs ride others'. */
export const CHAT_TABS = Object.freeze([
  Object.freeze({ id: 'world', label: 'World', room: CHAT_WORLD_ROOM, link: true, hint: 'Everyone online' }),
  Object.freeze({ id: 'region', label: 'Region', room: null, link: true, hint: 'Everyone in the region you stand in' }),
  Object.freeze({ id: 'party', label: 'Party', room: null, link: false, hint: 'Your party alone' }),
  Object.freeze({ id: 'local', label: 'Local', room: null, link: false, hint: 'Those near enough to hear you - speak in character here, and put an aside out of character in (( ))' }),
]);
/** CHAT-CHAN: how long the player must stand in another region before the Region tab moves to its channel, ms - a
 *  walk along a border is not a churn of sockets. The first region is joined at once. */
export const CHAT_REGION_HOLD_MS = 5000;
/** CHAT-CHAN: the Region tab's next room, or null to stay where it is. `want` is the room of the region the player
 *  stands in now (null for none), `current` the tab's room; `hold` is the caller's own record of a change waiting
 *  out its hold ({room, since}) - kept by the caller, so this stays a pure step a test can drive. */
export function nextRegionRoom(hold, want, current, now, holdMs = CHAT_REGION_HOLD_MS) {
  if (!want || want === current) { hold.room = null; return null; }
  if (hold.room !== want) { hold.room = want; hold.since = now; }
  if (current && now - hold.since < holdMs) return null;
  hold.room = null;
  return want;
}
/** CHAT-CHAN: the Region tab's line when it moves - where its channel is now. */
export const regionJoinedText = (place) => `Region channel: ${place}.`;
/** CHAT-CHAN: the Party and Region tabs on a relay from before the channels (CHAN_RELAY_MIN) - neither can be said. */
export const CHAN_OLD_RELAY_TEXT = 'This channel needs the server\'s next update.';
/** DICE1: a roll asked of a relay from before the dice (ROLL_RELAY_MIN) - it would close the socket on the frame. */
export const ROLL_OLD_RELAY_TEXT = 'Dice need the server\'s next update.';
/** EMOTE1: an action said to a relay from before them (EMOTE_RELAY_MIN) - it would say the words bare. */
export const EMOTE_OLD_RELAY_TEXT = 'Actions need the server\'s next update.';
/** CHAT-CHAN: how far a Local line carries, scene units - the distance a peer's NAME is drawn at (net/remotePlayers.js
 *  NAME_RANGE; a pin holds them equal): whoever you can read over a head can hear you, and nobody further. */
export const CHAT_SAY_RANGE = 60;
/** CHAT-CHAN: a line wrapped in double parentheses is out of character - the tabletop's own mark. */
export const isOocText = (text) => /^\(\(/.test(String(text ?? '').trim());
/** CHAT-CHAN: `/ooc text`'s line - the text in the mark. */
export const oocText = (text) => `((${String(text ?? '').trim()}))`;
/** CHAT-CHAN: is `speaker` within earshot of `listener` - two feet in the scene's frame, measured in the ground's
 *  plane as the name's range is (net/remotePlayers.js namePoints), between the two BODIES: the listener's is the
 *  port's one "where am I" (player.feetAt()), never the camera, which a third-person view stands behind the body. */
export function inEarshot(listener, speaker, range = CHAT_SAY_RANGE) {
  if (!listener || !speaker) return false;
  const dx = speaker[0] - listener[0], dz = speaker[2] - listener[2];
  return Number.isFinite(dx) && Number.isFinite(dz) && dx * dx + dz * dz <= range * range;
}
/** CHAT-CHAN: is a line heard on the presence session's room one the player HEARS - their own always (the receipt),
 *  anyone else's only from a body this host can place (`near`, the host's peersNear: [{id, feet}]) within earshot of
 *  `here`. A speaker this host cannot place is not near: the measure fails closed, as the trade's range does. */
export function localLineHeard(line, near, here, range = CHAT_SAY_RANGE) {
  if (line?.mine) return true;
  const who = Array.isArray(near) ? near.find((p) => p?.id === line?.id) : null;
  return !!who && inEarshot(here, who.feet, range);
}
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
    this.tabs = tabs.map((t) => ({ id: t.id, label: t.label, room: t.room, link: t.link !== false, hint: t.hint ?? '', place: null, messages: [], unread: 0 }));
    this.active = this.tabs[0]?.id ?? null;
    this.open = false;        // the panel's state, as the log counts unread by it
    this.version = 0;         // bumps on every change the panel would show; the panel repaints on a new number, never per frame
    this._keep = Math.max(1, keep | 0);
    this._now = now;
    this._seq = 0;
  }

  tab(id) { return this.tabs.find((t) => t.id === id) ?? null; }

  /** CHAT-CHAN: a tab's channel moved (the Region tab, as the player crosses into another region) - its room, and the
   *  PLACE the channel is (the region's name, which the bar's hover, the roster's head and the host's line say; the
   *  tab keeps its own short label, because a region's name is as long as "Wrothgarian Mountains" and the bar is four
   *  tabs in a box that can be 352px wide). The lines already heard stay: they are the tab's history. */
  setRoom(id, room, place = null) {
    const tab = this.tab(id);
    if (!tab) return false;
    if (tab.room === room && tab.place === place) return false;
    tab.room = room; tab.place = place;
    this.version++;
    return true;
  }

  /** A line in: kept on its tab, the oldest dropped past the cap, unread unless the tab is open and active.
   *
   *  SRV-N: `system` marks a line the GAME wrote rather than a player -
   *  the server-restart and new-build notices. It is a flag and not a
   *  reserved name because a name is forgeable: the relay lets a player
   *  call themselves anything the filter allows (net/nameFilter.js
   *  guards the words, not the impersonation), so a notice recognised by
   *  the string 'Server' would be one `/name Server` away from a player
   *  announcing a fake restart. A flag never travels on the wire - it is
   *  set here, by us, on a line nobody sent.
   *
   *  `quiet`: kept like any line but never counted unread - the join's greeting (CHAT-HELP) is there to be read when
   *  the player opens the chat, not a badge asking them to. */
  push(tabId, fields = {}, { quiet = false } = {}) {
    const tab = this.tab(tabId);
    const line = tab ? this._line(fields, tab.id) : null;
    if (!line) return null;
    this._keepOn(tab, line);
    if (!quiet && !(this.open && tab.id === this.active)) tab.unread++;
    this.version++;
    return line;
  }

  /** CHAT-CHAN: A LINE THE GAME SAYS TO THE PLAYER - a notice (SRV-N), the server's own red line (RED1) - is ONE line
   *  kept on EVERY tab, so a player reading any tab reads it where they are (SRV-N's law: a notice is not a room's
   *  event), and it is one line in every count: the same object on each tab, so the peek draws it once, and unread on
   *  the ACTIVE tab alone, so the Chat button's number is the lines that arrived, not the lines times the tabs. */
  pushAll(fields = {}) {
    const line = this._line({ ...fields, system: true }, null);
    if (!line) return null;
    for (const tab of this.tabs) this._keepOn(tab, line);
    const active = this.tab(this.active);
    if (active && !this.open) active.unread++;
    this.version++;
    return line;
  }

  /** The line's record, or null for nothing to say. DICE1: `roll` is a roll the RELAY made (the host hands it from the
   *  frame type, `onRoll`, never from a chat line) - kept only when the dice's law holds, and then the line's words are
   *  the dice's (rollText), its kind 'roll'. */
  _line({ id = '', name = '', text = '', at = null, mine = false, system = false, red = false, roll = null, me = false } = {}, tabId) {
    const rolled = roll && validRoll(roll) ? { n: roll.n, m: roll.m, k: roll.k, dice: [...roll.dice], total: roll.total } : null;
    if (roll && !rolled) return null;
    if (rolled) text = rollText(rolled);
    if (typeof text !== 'string' || !text) return null;
    const now = this._now();
    // ACC1g: a line carried the relay's verdict on the name beside it
    // (`v`) while a token was optional. The relay refuses a hello it
    // cannot verify now, so every name that can appear on a line was
    // verified to be in the room at all and the flag said the same
    // thing about every one of them.
    // RED1: `red` is the SERVER speaking, and it is the same kind of
    // flag as `system` for the same reason - set HERE, by us, on a line
    // nobody sent. What makes it safe is one step stronger: it is set
    // from the relay's own FRAME TYPE (`t:'red'`), which a player
    // cannot send at all, rather than from any field on a chat line.
    // Every red line is a system line too: nobody is speaking it.
    // CHAT-CHAN: `kind` is how the line is DRAWN - '' a line said, 'ooc' an aside out of character, read off the
    // SPEAKER's own text (the (( )) mark is theirs to make) and never off a field, and never on a line nobody spoke;
    // DICE1: 'roll', a roll the relay made (`roll` above), which no text can be; EMOTE1: 'me', an action - what the
    // speaker DOES, said with `me: true` on the wire (the relay's word) and drawn "Bran waves", never a system line.
    // `tab` is the tab the line was said on, or null for a line the game said on every tab.
    const sys = !!system || !!red;
    const kind = rolled ? 'roll' : sys ? '' : me === true ? 'me' : isOocText(text) ? 'ooc' : '';
    return { seq: ++this._seq, id: String(id), name: String(name), text, at: Number.isFinite(at) ? at : now, t: now, mine: !!mine, system: sys, red: !!red, kind, tab: tabId, ...(rolled ? { roll: rolled } : {}) };
  }

  /** A line onto a tab, the oldest dropped past the cap. */
  _keepOn(tab, line) {
    tab.messages.push(line);
    if (tab.messages.length > this._keep) tab.messages.splice(0, tab.messages.length - this._keep);
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

  /** What shows over the world while the panel is closed: the last
   *  CHAT_PEEK lines younger than CHAT_FADE_MS, each with its alpha -
   *  1 through three quarters of the window, then down to 0 - so a line
   *  arrives, stands, and goes.
   *
   *  CHAT-CHAN: from EVERY tab, in the order they were heard. With one
   *  tab the peek was that tab; with four, a line on a tab the player is
   *  not reading would stand nowhere over the world and wait on a badge
   *  - a party member's "help" is exactly the line that cannot wait. The
   *  open panel keeps its tabs apart (the IC/OOC separation is the
   *  reading, not the glance); the panel marks a peek line from another
   *  tab with that tab's name (`line.tab`). A line kept on every tab
   *  (pushAll) is one line here. */
  peek({ count = CHAT_PEEK, fade = CHAT_FADE_MS } = {}) {
    const now = this._now();
    const out = [];
    const heard = new Set();
    for (const tab of this.tabs) for (let i = Math.max(0, tab.messages.length - count); i < tab.messages.length; i++) heard.add(tab.messages[i]);
    const lines = [...heard].sort((a, b) => a.seq - b.seq);
    for (const line of lines.slice(-count)) {
      const age = now - line.t;
      if (age >= fade) continue;
      const hold = fade * 0.75;
      const alpha = age < hold ? 1 : Math.max(0, 1 - (age - hold) / (fade - hold));
      out.push({ line, alpha });
    }
    return out;
  }
}
