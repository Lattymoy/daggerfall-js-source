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
import { CHAT_WORLD_ROOM, CHAT_TRADE_ROOM, CHAT_LFG_ROOM } from './wire.js';
import { validRoll, rollText } from './dice.js';   // DICE1: a roll's line is the dice's own words
import { t } from '../systems/textManager.js';   // CHAT-TRADE: the new tabs' and notices' words in the player's language, each read when it is shown
import { REPORT_PICK_AGE_MS, REPORT_LINES_MAX } from './safety/safetyLaw.js';   // AUDIT SAFE CLIENT-5: what a report may carry, from the law's home

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
 *  tab, now per tab that has a room) - the World tab and the Region tab; the Party and Local tabs ride others'.
 *
 *  CHAT-P (2026-09-24, Mac: "Party chat should only show if in a party"): `hidden` is a tab that starts OFF the bar
 *  and is put on it by the host while it has something to say - the Party tab while the player sits in a party
 *  (ChatLog.setShown). `peekAll` (CHAT-W): a line on this tab stands over the world whatever tab the chat opens on -
 *  a party's line is said to the player, where every other tab's is said to a room they happen to be in. */
/** @typedef {{ id: string, label: string, room: string|null, link: boolean, hint: string, hidden?: boolean, peekAll?: boolean }} ChatTabRow */
/** @type {ReadonlyArray<ChatTabRow>} */
export const CHAT_TABS = Object.freeze([
  Object.freeze({ id: 'world', label: 'World', room: CHAT_WORLD_ROOM, link: true, hint: 'Everyone online' }),
  Object.freeze({ id: 'region', label: 'Region', room: null, link: true, hint: 'Everyone in your region' }),
  // CHAT-LANG (2026-10-11, the players: "More chat channels per-language"): the Region tab's shape - a room of its own
  // (net/wire.js chatLangRoom), its channel the language the player CHOSE (`chatLang`; /lang), and on the bar only while
  // one is chosen
  Object.freeze({ id: 'lang', label: 'Lang', room: null, link: true, hint: 'Everyone in your language channel. /lang picks one.', hidden: true }),
  // CHAT-TRADE (2026-10-14, Mac: "New channels: Trading, LFG" - "without introducing clutter"): the Language tab's shape
  // twice - a room of its own each (net/wire.js CHAT_TRADE_ROOM, CHAT_LFG_ROOM), on the bar only while the player has
  // JOINED it (`chatTrade`, `chatLfg`; /join, /leave), so a player who never joins sees no new tab and holds no new socket
  // (each hint a getter, read when the log is made - after the player chose a language - never at the boot's import)
  Object.freeze({ id: 'trade', label: 'Trade', room: null, link: true, get hint() { return t('net.chat.tradeHint', 'Everyone in the Trade channel: buying, selling and swapping'); }, hidden: true }),
  Object.freeze({ id: 'lfg', label: 'LFG', room: null, link: true, get hint() { return t('net.chat.lfgHint', 'Everyone in the LFG channel: looking for a group or more players'); }, hidden: true }),
  Object.freeze({ id: 'party', label: 'Party', room: null, link: false, hint: 'Only your party', hidden: true, peekAll: true }),
  // GUILD1c (Mac: "Do guild1c" - the guild's chat): the Party tab's shape - its lines ride the hub's link with
  // `ch: 'guild'` and reach the guild's members online alone, and the tab is on the bar while the character is in one
  Object.freeze({ id: 'guild', label: 'Guild', room: null, link: false, hint: 'Only your guild', hidden: true, peekAll: true }),
  Object.freeze({ id: 'local', label: 'Local', room: null, link: false, hint: 'Players near enough to hear you. Speak in character here, and put out-of-character remarks in (( )).' }),
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
/** CHAT-LANG: the Language tab on a relay from before the language channels (LANG_RELAY_MIN). */
export const LANG_OLD_RELAY_TEXT = 'Language channels need the server\'s next update.';
/** CHAT-LANG: the Language tab's word while no language is chosen. */
export const NO_LANG_TEXT = 'Choose a language channel: /lang de, /lang en ... (/lang lists them).';
/** CHAT-LANG: the Language tab's line when it moves - which channel it is now. */
export const langJoinedText = (name) => `Language channel: ${name}.`;
/** CHAT-TRADE: the channels a player joins and leaves by choice - each its tab id, its name, the pref that keeps the
 *  choice and its room. */
export const OPT_CHANNELS = Object.freeze({
  trade: Object.freeze({ name: 'Trade', pref: 'chatTrade', room: CHAT_TRADE_ROOM }),
  lfg: Object.freeze({ name: 'LFG', pref: 'chatLfg', room: CHAT_LFG_ROOM }),
});
/** CHAT-TRADE: the words below, each through the text core when it is said (L10N4) - `name` the channel's, `id` its tab's. */
const optArgs = (id) => ({ name: OPT_CHANNELS[id]?.name ?? id, id });
/** CHAT-TRADE: the Trade and LFG tabs on a relay from before them (TRADE_CHAN_RELAY_MIN). */
export const tradeChanOldText = () => t('net.chat.tradeOld', 'The Trade and LFG channels need the server\'s next update.');
/** CHAT-TRADE: a tab's word while its channel is not joined - and how to join it. */
export const notJoinedText = (id) => t('net.chat.notJoined', 'You are not in the {name} channel. /join {id} joins it.', optArgs(id));
/** CHAT-TRADE: the lines a join and a leave leave on the log - and a join a line said to the channel made, whose line
 *  waits in the field. */
export const optJoinedText = (id) => t('net.chat.joined', '{name} channel joined. /leave {id} leaves it.', optArgs(id));
export const optJoinedSayText = (id) => t('net.chat.joinedSay', '{name} channel joined. Press Enter to speak. /leave {id} leaves it.', optArgs(id));
export const optLeftText = (id) => t('net.chat.left', '{name} channel left.', optArgs(id));
/** CHAT-TRADE: `/join` of a channel already joined (AUDIT CHAT-TRADE A5: the join's own line read as a join just made). */
export const alreadyJoinedText = (id) => t('net.chat.already', 'You are already in the {name} channel. /leave {id} leaves it.', optArgs(id));
/** CHAT-TRADE: a line said to a channel joined but not open yet (the World link's welcome not heard, the socket opening). */
export const optWaitText = (id) => t('net.chat.wait', 'The {name} channel is still opening. Try again in a moment.', optArgs(id));
/** PING1 (2026-10-11, the players: "A unique color or alert for @name pings"): does `text` name `name` with an @ - the
 *  whole name, any case, not run on into more of a word ("@Bran" pings Bran, "@Brandon" does not). A name of one letter
 *  or none pings nobody. */
export function mentions(text, name) {
  const n = String(name ?? '').trim();
  if (n.length < 2) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@${esc}(?![\\p{L}\\p{N}_])`, 'iu').test(String(text ?? ''));
}
/** GUILD1c: the Guild tab on a relay from before the guild's channel - the World link's welcome said so. */
export const GUILD_OLD_RELAY_TEXT = 'The guild channel needs the server\'s next update.';
/** GUILD1c: the Guild tab's word while the character is in no guild. */
export const NO_GUILD_TEXT = 'You are not in a guild.';
/** CHAT-CHAN: how far a Local line carries, scene units - the distance a peer's NAME is drawn at (net/remotePlayers.js
 *  NAME_RANGE; a pin holds them equal): whoever you can read over a head can hear you, and nobody further. */
export const CHAT_SAY_RANGE = 60;
/** CHAT-CHAN: a line wrapped in double parentheses is out of character - the tabletop's own mark. */
export const isOocText = (text) => /^\(\(/.test(String(text ?? '').trim());
/** CHAT-CHAN: `/ooc text`'s line - the text in the mark. */
export const oocText = (text) => `((${String(text ?? '').trim()}))`;
/** CHAT-RP (2026-10-14, Mac: "/rp Italicizes and makes text color green. For roleplay purposes"): a line wrapped in
 *  single asterisks is ROLEPLAY - OOC's kind of mark, the speaker's own, read off their text and never off a field, so
 *  no relay has to carry it and an older client still reads the line as the tabletop writes it: `*draws her blade*`.
 *  The whole line: an asterisk at each end, and just inside the last something that is neither one nor a space
 *  (`**bold**` and `* *` are not roleplay). */
export const isRpText = (text) => /^\*[\s\S]*[^*\s]\*$/.test(String(text ?? '').trim());
/** CHAT-RP: `/rp text`'s line - the text in the mark. The whole line is the roleplay, so a mark typed inside it is
 *  taken out first (AUDIT CHAT-TRADE A3: stripping the ends alone made `/rp *bows* deeply` read `*bows* deeply*`). */
export const rpText = (text) => `*${String(text ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()}*`;
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
/** CHAT-P: the tab a social note lands on. A party's news goes to the Party tab beside its conversation (CHAT-CHAN) -
 *  but only while that tab is on the bar, which is while the player sits in a party: a note about a party they are not
 *  in (an invite answered, the one they just left) would land on a tab nobody can open. And the note that ENDS their
 *  seat ("You were removed from the party") goes to the tab they are reading whatever order it and the party frame
 *  arrive in - the Party tab is about to leave the bar with it on. */
export function partyNoteTab(note, social, fallback) {
  const code = String(note?.code ?? '');
  if (!code.startsWith('party.') || !social?.party) return fallback;
  if (code === 'party.kicked' && note?.acct != null && note.acct === social.acct) return fallback;
  return 'party';
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

/** CHAT-FIND (2026-10-11, the owner: "search for a player's name in the chat in every ui"): THE SEARCH, pure. A query
 *  is a piece of a name, case and the spaces round it ignored, at most CHAT_FIND_MAX characters; '' is no search. A
 *  query that starts with '#' is a TAG - the four characters drawn beside a name (tagOf), the one way to tell two
 *  players of one name apart. The panel (ui/chatPanel.js) is the one surface that draws it, and it is the same panel
 *  on the classic skin, the enhanced skin and the touch layer - so this is every UI's search. */
export const CHAT_FIND_MAX = 32;
/** CHAT-FIND: the query as the search reads it. */
export const findQuery = (q) => String(q ?? '').trim().toLowerCase().slice(0, CHAT_FIND_MAX);
/** CHAT-FIND: does `query` find the player with this name and id - a piece of the name, or ('#') the start of their
 *  tag. Pure. */
export function playerFound(name, id, query) {
  const q = findQuery(query);
  if (!q) return false;
  if (q.startsWith('#')) { const t = q.slice(1); return !!t && tagOf(id).startsWith(t); }
  return String(name ?? '').toLowerCase().includes(q);
}
/** CHAT-FIND: is a line one the search for `query` shows - said BY a player it finds, or (a plain query) a line whose
 *  words name them. A line the game said (a notice, the server's red line, the Dungeon Master's) is nobody's. Pure. */
export function lineFound(line, query) {
  const q = findQuery(query);
  if (!q || !line || line.system) return false;
  if (playerFound(line.name, line.id, q)) return true;
  return !q.startsWith('#') && String(line.text ?? '').toLowerCase().includes(q);
}
/** CHAT-FIND: every tab's lines the search shows, oldest first - EVERY tab's, the hidden ones' too (a party left keeps
 *  its history), and a line kept on more than one tab once. Pure. */
export function findLines(tabs, query) {
  const q = findQuery(query);
  if (!q) return [];
  const out = new Map();
  for (const tab of tabs ?? []) for (const line of tab?.messages ?? []) if (!out.has(line.seq) && lineFound(line, q)) out.set(line.seq, line);
  return [...out.values()].sort((a, b) => a.seq - b.seq);
}

export class ChatLog {
  constructor({ tabs = CHAT_TABS, keep = CHAT_KEEP, now = () => Date.now() } = {}) {
    this.tabs = tabs.map((t) => ({ id: t.id, label: t.label, room: t.room, link: t.link !== false, hint: t.hint ?? '', place: null, messages: [], unread: 0, pings: 0, shown: t.hidden !== true, peekAll: t.peekAll === true }));
    /** PING1: the player's own name, set by the host (a line naming it with an @ is a ping); '' pings nobody. */
    this.self = '';
    /** PING1: the newest pinging line's seq - the host's alert sounds when it moves (0: none yet). */
    this.pingSeq = 0;
    /** SAFE1: whether the player hears an account - (sub) => boolean, set by the host from the block list; null hears
     *  everyone. A line from an account it does not hear is never kept, so no tab, peek, bubble or search shows it. */
    this.hears = null;
    this.active = this.tabs.find((t) => t.shown)?.id ?? null;
    this.open = false;        // the panel's state, as the log counts unread by it
    this.version = 0;         // bumps on every change the panel would show; the panel repaints on a new number, never per frame
    /** AUDIT SAFE CLIENT-4 (2026-10-17): bumps when lines are taken out of a tab's MIDDLE (forgetSpeaker) - the open panel's
     *  repaint drops rows off the front and adds them at the back, and a block from the open panel left the blocked
     *  account's rows drawn between the others'. A new number here is a list rebuilt (ui/chatPanel.js paintList). */
    this.removed = 0;
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
    if (!fields.mine && typeof fields.sub === 'string' && fields.sub && this.hears && !this.hears(fields.sub)) return null;   // SAFE1: a blocked speaker
    const line = tab ? this._line(fields, tab.id) : null;
    if (!line) return null;
    this._keepOn(tab, line);
    if (!quiet && !(this.open && tab.id === this.active)) tab.unread++;
    // PING1: a line someone else said naming me with an @ - marked on the line, counted on its tab until it is read
    if (!line.mine && !line.system && mentions(line.text, this.self)) {
      Object.assign(line, { ping: true });   // a field only a ping carries - every other line's shape stands as it was
      this.pingSeq = line.seq;
      if (!(this.open && tab.id === this.active)) tab.pings++;
    }
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
  _line({ id = '', name = '', text = '', at = null, mine = false, system = false, red = false, dm = false, roll = null, me = false, sub = null, sg = null, raw = null } = {}, tabId) {
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
    // TITLE-N: `dm` is the DUNGEON MASTER speaking - RED1's kind of flag for RED1's reason, set here from the relay's
    // own frame type (`t:'dm'`), which a player cannot send; a voice over the game, so a system line too.
    const sys = !!system || !!red || !!dm;
    // CHAT-RP: 'rp', a line of roleplay - the speaker's own *mark*, as OOC's is theirs
    const kind = rolled ? 'roll' : sys ? '' : me === true ? 'me' : isOocText(text) ? 'ooc' : isRpText(text) ? 'rp' : '';
    // SAFE1 + SAFE2: `sub` the speaker's verified account and `sg` the relay's stamp, where the relay said them - what a
    // block names and what a report carries; absent from a line the game said, and from one nobody stamped
    // AUDIT SAFE CLIENT-6: and `raw`, the words exactly as the relay stamped them, kept beside the drawn ones only where the
    // two differ (net/online.js: the client's own pass of the mask is not the relay's) - what a report carries
    const stamp = typeof sg === 'string' && sg ? { sg, ...(typeof raw === 'string' && raw && raw !== text ? { raw } : {}) } : {};
    const said = !sys && typeof sub === 'string' && sub ? { sub, ...stamp } : {};
    return { seq: ++this._seq, id: String(id), name: String(name), text, at: Number.isFinite(at) ? at : now, t: now, mine: !!mine, system: sys, red: !!red, ...(dm ? { dm: true } : {}), kind, tab: tabId, ...(rolled ? { roll: rolled } : {}), ...said };
  }

  /** SAFE1: AN ACCOUNT'S LINES TAKEN BACK - every line `sub` said, off every tab, the moment it is blocked: a block hides
   *  what was said as well as what will be. Answers how many went. */
  forgetSpeaker(sub) {
    if (typeof sub !== 'string' || !sub) return 0;
    let gone = 0;
    for (const tab of this.tabs) {
      const kept = tab.messages.filter((l) => l.sub !== sub || l.mine);
      gone += tab.messages.length - kept.length;
      tab.messages = kept;
    }
    if (gone) { this.version++; this.removed++; }   // AUDIT SAFE CLIENT-4: rows out of the middle - the open list is rebuilt
    return gone;
  }

  /** SAFE3: WHAT A REPORT OF `sub` CARRIES - their stamped lines heard on any tab, newest last, and the stamped lines just
   *  before each on its tab for context, up to `max` in all (net/safety/safetyLaw.js REPORT_LINES_MAX). `seq` narrows it
   *  to one line and the lines before it (a line's own Report). Lines the relay did not stamp cannot be carried.
   *
   *  AUDIT SAFE CLIENT-5 (2026-10-17): AND NOTHING OUT OF ITS DAY. The service takes lines no older than
   *  REPORT_LINE_AGE_MS, and a quiet tab or a page left open overnight keeps yesterday's: a line heard more than
   *  REPORT_PICK_AGE_MS ago by this page's own clock (`t`, when it was kept - the relay's `at` is another machine's) is
   *  not picked, as context or as theirs. AUDIT SAFE CLIENT-6: a line's words go as the relay stamped them (`raw`). */
  reportLines(sub, { seq = null, max = REPORT_LINES_MAX, before = 3 } = {}) {
    const picked = new Map();
    const now = this._now();
    const fresh = (/** @type {any} */ l) => !(now - l.t > REPORT_PICK_AGE_MS);   // AUDIT SAFE CLIENT-5
    for (const tab of this.tabs) {
      const lines = tab.messages;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.sub !== sub || !l.sg || (seq !== null && l.seq !== seq) || !fresh(l)) continue;
        for (let j = Math.max(0, i - before); j <= i; j++) if (lines[j].sg && lines[j].sub && fresh(lines[j])) picked.set(lines[j].seq, lines[j]);
      }
    }
    const out = [...picked.values()].sort((a, b) => a.seq - b.seq);
    const own = out.filter((l) => l.sub === sub);
    // past the bound, the reported account's own lines are kept first (the newest of them), the context after
    const keep = new Set(own.slice(-max).map((l) => l.seq));
    for (const l of out.slice().reverse()) { if (keep.size >= max) break; keep.add(l.seq); }
    return out.filter((l) => keep.has(l.seq)).map((l) => ({ tab: l.tab, sub: l.sub, name: l.name, at: l.at, text: l.raw ?? l.text, sg: l.sg }));   // AUDIT SAFE CLIENT-6: the relay's own words
  }

  /** A line onto a tab, the oldest dropped past the cap. */
  _keepOn(tab, line) {
    tab.messages.push(line);
    if (tab.messages.length > this._keep) tab.messages.splice(0, tab.messages.length - this._keep);
  }

  /** CHAT-P: a tab on the bar or off it (the Party tab, while the player sits in a party). A tab taken off stops
   *  counting unread - a number on a button nobody can see is a badge on the Chat button that no tab explains - and
   *  when it was the front tab the first tab still on the bar takes its place. Its lines stay: the history of a
   *  channel is not lost because the bar stopped showing it. */
  setShown(id, shown) {
    const tab = this.tab(id);
    shown = !!shown;
    if (!tab || tab.shown === shown) return false;
    tab.shown = shown;
    if (!shown) {
      tab.unread = 0; tab.pings = 0;
      if (this.active === id) {
        this.active = this.tabs.find((t) => t.shown)?.id ?? null;
        if (this.open && this.active) this.markRead(this.active);
      }
    }
    this.version++;
    return true;
  }

  /** A tab to the front - one on the bar (CHAT-P: a hidden tab cannot be selected into view). */
  select(id) {
    if (!this.tab(id)?.shown || id === this.active) return false;
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
    if (tab && (tab.unread || tab.pings)) { tab.unread = 0; tab.pings = 0; this.version++; }
  }

  unreadTotal() { return this.tabs.reduce((n, t) => n + (t.shown ? t.unread : 0), 0); }
  /** PING1: the pings waiting on the tabs on the bar. */
  pingTotal() { return this.tabs.reduce((n, t) => n + (t.shown ? t.pings : 0), 0); }

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
   *  CHAT-W (2026-09-24, Mac: "Messages sent in world chat shouldnt carry
   *  over to region chat"): from THE TAB THE CHAT OPENS ON, and from a
   *  tab whose lines are said to the player (`peekAll`, the Party tab
   *  while it is on the bar). CHAT-CHAN drew every tab's here, so a World
   *  line stood over the screen of a player reading Region - the open
   *  panel kept the channels apart and the glance put them back
   *  together. A room's line is that room's: the others say they have
   *  news with their badge. A party member's "help" still cannot wait on
   *  one - it is said to this player, not to a room they are in - and
   *  the panel marks it with its tab's name (`line.tab`). A line kept on
   *  every tab (pushAll) is one line here. */
  peek({ count = CHAT_PEEK, fade = CHAT_FADE_MS } = {}) {
    const now = this._now();
    const out = [];
    const heard = new Set();
    for (const tab of this.tabs) {
      if (!tab.shown) continue;
      // PING1: a line that names me stands over the world from any tab - it is said TO me, as a party's line is
      if (tab.id !== this.active && !tab.peekAll) { for (let i = Math.max(0, tab.messages.length - count); i < tab.messages.length; i++) if (tab.messages[i].ping) heard.add(tab.messages[i]); continue; }
      for (let i = Math.max(0, tab.messages.length - count); i < tab.messages.length; i++) heard.add(tab.messages[i]);
    }
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
