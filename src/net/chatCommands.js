// @ts-check
// CHAT-CHAN (2026-09-23, the community arc): THE CHAT'S SLASH COMMANDS - one grammar, pure, DOM-free.
//
// Before this slice the host's onSend (scenes/world.js) tested a handful of commands by regex and sent EVERYTHING else
// to the room, so a mistyped `/pary hi` was said to everyone online, literally. Now a line that starts with `/` is a
// command or it is refused in words: `parseChatLine` answers what a typed line IS, and the host does it.
//
//   /world /g <text>        the World channel          /region /r <text>     the region you stand in
//   /party /p <text>        your party                 /local /l /say /s     those near enough to hear you
//   /guild /gu <text>       your guild (GUILD1c)
//   /lc <text>              your language channel (CHAT-LANG)   /lang [code|off]  choose it; alone, the list
//   /ooc <text>             a Local aside out of character - the line wrapped in (( ))
//   /rp <text>              a line of roleplay on the active tab - wrapped in *asterisks*, drawn green and leaning (CHAT-RP)
//   /trade /tr <text>       the Trade channel      /lfg <text>  the LFG channel (CHAT-TRADE) - each joined by choice:
//   /join <trade|lfg>       on the bar and in the channel      /leave <trade|lfg>  off it (a bare /leave is a battle's)
//   /roll /dice [NdM+K]     dice the RELAY rolls, on the active tab (DICE1, net/dice.js) - a d20 when nothing is said
//   /me <action>            an ACTION on the active tab - "Bran looks around" (EMOTE1)
//   /wave /bow ... [name]   a GESTURE, to those near you (Local) - "Bran waves at Ann." (EMOTE1, EMOTES; /emotes lists them)
//   :smile: :sword: ...     a shortcode is its emoji in anything said (EMOTE1, SHORTCODES)
//   /find /who <name>       who is online by that name, anywhere in the world - the hub's answer (SCALE5c)
//   /search <name>          the panel's own search of every tab's lines and the roster - never sent (CHAT-FIND)
//   /help /?                the list, as lines only you see
//   //text                  a line that starts with a slash, said as it stands on the active tab
//
// The commands the host has always handled itself - `/unstuck` (UNSTUCK1), `/red` (RED1), `/mute` and `/unmute`
// (MOD1), `/ready` (PARTY-REST2), `/leader` and `/travel` (PARTY-TRAVEL) - are KNOWN here and answered `host`: the host tests them first, by the regexes their
// own slices pin, so a known one never reaches this parser's `unknown` and the parser never needs their grammar.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).

import { parseRollSpec, ROLL_DICE_MAX, ROLL_SIDES_MAX } from './dice.js';   // DICE1: the dice's grammar
import { LIVE_EVENTS, CHAT_LANGS } from './wire.js';   // EVENT1: the live events a dev may stage; CHAT-LANG: the language channels
import { HUB_FIND_MAX } from './hubShards.js';   // SCALE5c: a search's bound
import { rpText } from './chat.js';   // CHAT-RP: the roleplay mark
import { t } from '../systems/textManager.js';   // CHAT-TRADE: the new rows' words in the player's language, each read when /help is asked; AUDIT EG V (c, L7-21): and /help's line for /breach

/** The channel commands: each names the tab its text is said on. `wrap` is what the text becomes first. */
export const CHANNEL_COMMANDS = Object.freeze([
  Object.freeze({ names: Object.freeze(['world', 'g']), tab: 'world', wrap: null, help: '/world or /g <text> - to everyone online' }),
  Object.freeze({ names: Object.freeze(['region', 'r']), tab: 'region', wrap: null, help: '/region or /r <text> - to everyone in your region' }),
  Object.freeze({ names: Object.freeze(['lc']), tab: 'lang', wrap: null, help: '/lc <text> - to your language channel' }),   // CHAT-LANG: /l is Local's
  Object.freeze({ names: Object.freeze(['party', 'p']), tab: 'party', wrap: null, help: '/party or /p <text> - to your party' }),
  Object.freeze({ names: Object.freeze(['guild', 'gu']), tab: 'guild', wrap: null, help: '/guild or /gu <text> - to your guild' }),   // GUILD1c: /g is the World's
  Object.freeze({ names: Object.freeze(['local', 'l', 'say', 's']), tab: 'local', wrap: null, help: '/local, /l, /say or /s <text> - to players nearby, in character' }),
  Object.freeze({ names: Object.freeze(['ooc']), tab: 'local', wrap: 'ooc', help: '/ooc <text> - to players nearby, out of character (( ))' }),
  // CHAT-TRADE: the two channels a player joins by choice - said on a channel not joined joins it (scenes/world.js)
  Object.freeze({ names: Object.freeze(['trade', 'tr']), tab: 'trade', wrap: null, get help() { return t('net.chat.tradeHelp', '/trade or /tr <text> - to the Trade channel: buying, selling, swapping'); } }),
  Object.freeze({ names: Object.freeze(['lfg']), tab: 'lfg', wrap: null, get help() { return t('net.chat.lfgHelp', '/lfg <text> - to the LFG channel: looking for a group or more players'); } }),
]);
/** CHAT-TRADE: the channels `/join` and `/leave` name (net/chat.js OPT_CHANNELS' ids). */
export const JOIN_CHANNELS = Object.freeze(['trade', 'lfg']);
/** CHAT-TRADE: a /join or /leave that names none of them - through the text core (AUDIT CHAT-TRADE A4). */
export const badJoinText = (name) => t('net.chat.badJoin', '/{cmd} takes trade or lfg: /{cmd} trade.', { cmd: name });
/**
 * EMOTE1 (2026-09-23, Addison Knox: "Emotes, be it emojis or additional animations"): THE GESTURES. Each is an ACTION
 * line said on the Local tab - a gesture is the body's, and the bodies near enough to see it are the ones Local
 * reaches - in the third person the chat draws it in ("Bran waves."), with a name after the command making it a
 * gesture AT someone ("/wave Ann" - "Bran waves at Ann."). Words only: the port's bodies have no clip to play for a
 * wave or a bow (the Morrowind rig's base animations are the idles, the moves, the attacks, the casts, a knockdown and
 * the deaths - bible/06-Systems/Community-Arc.md EMOTE1), and a gesture drawn with the wrong one would be a lie.
 */
export const EMOTES = Object.freeze({
  wave: ['waves.', 'waves at {t}.'],
  bow: ['bows.', 'bows to {t}.'],
  nod: ['nods.', 'nods at {t}.'],
  shrug: ['shrugs.', 'shrugs at {t}.'],
  laugh: ['laughs.', 'laughs at {t}.'],
  cheer: ['cheers!', 'cheers for {t}!'],
  salute: ['salutes.', 'salutes {t}.'],
  smile: ['smiles.', 'smiles at {t}.'],
  sigh: ['sighs.', 'sighs at {t}.'],
  cry: ['weeps.', 'weeps on {t}\'s shoulder.'],
  dance: ['dances.', 'dances with {t}.'],
  clap: ['claps.', 'applauds {t}.'],
  point: ['points.', 'points at {t}.'],
  thank: ['gives thanks.', 'thanks {t}.'],
  greet: ['greets everyone.', 'greets {t} warmly.'],
  kneel: ['kneels.', 'kneels before {t}.'],
  sit: ['sits down.', 'sits down beside {t}.'],
  pray: ['prays.', 'prays for {t}.'],
  flex: ['flexes.', 'flexes at {t}.'],
  facepalm: ['facepalms.', 'facepalms at {t}.'],
});
/** EMOTE1: a gesture's line - the table's own words, a target's name bounded and stripped of what would make it more
 *  than a name (a gesture is a gesture: "/wave everyone and says ..." waves at a name, it does not say things). */
export function emoteText(name, target = '') {
  const e = EMOTES[name];
  if (!e) return null;
  const t = String(target ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return t ? e[1].replace('{t}', () => t) : e[0];   // AUDIT 68 S14-emote-target-replacement-pattern: a function, so a typed `$&`/`$'`/`$$` is a name, not a pattern
}
/** EMOTE1: THE SHORTCODES - `:smile:` is its emoji in anything said (the pixel face has none of these glyphs; the
 *  browser's own emoji face draws them). A code the table does not know stays as typed. */
/** ...the table in the order the picker offers it - a LIST, because an object orders an integer-like key (`100`) before
 *  every other and the picker would open on it. */
export const SHORTCODE_LIST = Object.freeze([
  ['smile', '\u{1F604}'],
  ['grin', '\u{1F601}'],
  ['joy', '\u{1F602}'],
  ['wink', '\u{1F609}'],
  ['blush', '\u{1F60A}'],
  ['heart_eyes', '\u{1F60D}'],
  ['sweat_smile', '\u{1F605}'],
  ['thinking', '\u{1F914}'],
  ['cry', '\u{1F622}'],
  ['sob', '\u{1F62D}'],
  ['angry', '\u{1F620}'],
  ['rage', '\u{1F621}'],
  ['sleep', '\u{1F634}'],
  ['scream', '\u{1F631}'],
  ['eyes', '\u{1F440}'],
  ['skull', '\u{1F480}'],
  ['ghost', '\u{1F47B}'],
  ['heart', '\u2764\uFE0F'],
  ['thumbsup', '\u{1F44D}'],
  ['+1', '\u{1F44D}'],
  ['thumbsdown', '\u{1F44E}'],
  ['-1', '\u{1F44E}'],
  ['clap', '\u{1F44F}'],
  ['wave', '\u{1F44B}'],
  ['pray', '\u{1F64F}'],
  ['muscle', '\u{1F4AA}'],
  ['ok', '\u{1F44C}'],
  ['shrug', '\u{1F937}'],
  ['fire', '\u{1F525}'],
  ['sparkles', '\u2728'],
  ['star', '\u2B50'],
  ['sun', '\u2600\uFE0F'],
  ['moon', '\u{1F319}'],
  ['tada', '\u{1F389}'],
  ['100', '\u{1F4AF}'],
  ['crown', '\u{1F451}'],
  ['sword', '\u{1F5E1}\uFE0F'],
  ['crossed_swords', '\u2694\uFE0F'],
  ['shield', '\u{1F6E1}\uFE0F'],
  ['bow_and_arrow', '\u{1F3F9}'],
  ['moneybag', '\u{1F4B0}'],
  ['coin', '\u{1FA99}'],
  ['gem', '\u{1F48E}'],
  ['scroll', '\u{1F4DC}'],
  ['potion', '\u{1F9EA}'],
  ['key', '\u{1F511}'],
  ['dragon', '\u{1F409}'],
  ['wolf', '\u{1F43A}'],
  ['horse', '\u{1F40E}'],
  ['spider', '\u{1F577}\uFE0F'],
  ['rat', '\u{1F400}'],
  ['zombie', '\u{1F9DF}'],
  ['vampire', '\u{1F9DB}'],
  ['mage', '\u{1F9D9}'],
  ['elf', '\u{1F9DD}'],
  ['beer', '\u{1F37A}'],
  ['wine', '\u{1F377}'],
  ['bread', '\u{1F35E}'],
  ['castle', '\u{1F3F0}'],
  ['boat', '\u26F5'],
  ['map', '\u{1F5FA}\uFE0F'],
  ['compass', '\u{1F9ED}'],
].map((p) => Object.freeze(p)));
/** EMOTE1: the lookup - a code to its emoji. */
export const SHORTCODES = Object.freeze(Object.fromEntries(SHORTCODE_LIST));
/** EMOTE1: every `:code:` the table knows, its emoji - the rest as typed. */
export const expandShortcodes = (text) => String(text ?? '').replace(/:([a-z0-9_+-]{1,20}):/gi, (all, code) => SHORTCODES[code.toLowerCase()] ?? all);
/** The commands the host handles itself, before this parser is asked (their own slices pin their grammar). */
export const HOST_COMMANDS = Object.freeze(['unstuck', 'red', 'dm', 'mute', 'unmute', 'ready', 'leader', 'travel', 'event', 'note', 'mentor', 'mail', 'mailbox', 'bug', 'breach', 'block', 'unblock', 'blocked', 'report', 'conduct', 'rules', 'ban', 'unban', 'strikes', 'cases', 'case', 'dismiss', 'modhelp']);   // SAFE1-SAFE7: the chat safety commands (net/safety/safetyLaw.js SAFETY_COMMANDS, which a pin holds to these) - AUDIT SAFE DOC-4: and the moderators' look at the reports   // AUDIT EG V (c, L7-1): /breach, the Elite Breach's (breachCommandOf)   // SERVER-POST: /mail (and /mailbox), the mailbox   // SOFTCAP1: /mentor   // TITLE-N: /dm, the Dungeon Master's line   // PARTY-TRAVEL: /leader and /travel   // EVENT1: /event, a dev's live event   // PRIVATE-REPORT: /bug, the mailbox's private report form (mailboxCommandOf) - /report is the chat safety's, a player to the moderators
/** SERVER-POST, PRIVATE-REPORT: the pause page a mailbox line opens - `/mail` and `/mailbox` the mailbox, `/bug` the
 *  mailbox's private report form (ui/enhanced/enhancedReport.js) - or null for any other line. Local, never sent. (`/report`
 *  is SAFE3's: a player's lines to the moderators, net/safety/safetyLaw.js.) */
export function mailboxCommandOf(text) {
  const m = /^\/(mail|mailbox|bug)$/i.exec(String(text ?? '').trim());
  return m ? (m[1].toLowerCase() === 'bug' ? 'report' : 'mailbox') : null;
}
/**
 * EVENT1: `/event <name> [on|off]` and `/event off` - a dev staging a live event for everyone online, or ending it.
 * `{kind}` (one of LIVE_EVENTS; '' ends the one staged), `{error}` in words for a line that names none, or null when
 * the line is not /event. NEVER GUARDED HERE (RED1's law): whether this player may is the relay's question, asked of
 * their signed token, and it ignores anyone else in silence.
 */
export function parseEventCommand(text) {
  const m = /^\/event(?:\s+(.*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const words = (m[1] ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0] === 'off') return { kind: '' };
  const [name, sw = 'on'] = words;
  if (words.length > 2 || !LIVE_EVENTS.includes(name) || (sw !== 'on' && sw !== 'off')) return { error: `Usage: /event <${LIVE_EVENTS.join('|')}> [on|off], or /event off.` };
  return { kind: sw === 'on' ? name : '' };
}
/** CHAT-HELP (2026-09-23, Mac: "a non-intrusive greeting message that says something along the lines of (use /help
 *  for commands)"): the line the chat greets the player with each time they go online - theirs alone, never counted
 *  unread (net/chat.js push's `quiet`), so /help is found without being announced. */
export const CHAT_GREETING_TEXT = 'Welcome! Type /help for chat commands.';
/** CHAT-TRADE: a list whose rows may be READ WHEN THEY ARE READ - a function row is a getter (the text core's
 *  localizedStrings law, systems/textManager.js): /help's newer rows are said in the language the player chose, never the
 *  one the boot's import found. A frozen array of strings to every reader. */
const lazyLines = (rows) => {
  const out = [];
  rows.forEach((r, i) => { if (typeof r === 'function') Object.defineProperty(out, i, { enumerable: true, get: r }); else out[i] = r; });
  return Object.freeze(out);
};
/** The lines `/help` shows - the channels, then the host's own. */
export const HELP_LINES = lazyLines([
  'Chat commands:',
  ...CHANNEL_COMMANDS.map((c) => () => c.help),
  '/lang de, /lang en ... - join a language channel (/lang off leaves it, /lang lists them)',
  '/roll or /dice [NdM+K] - roll dice on this tab: /roll 2d6+3, /roll d20, /roll 100',
  () => t('net.chat.joinHelp', '/join trade, /join lfg - add a channel tab (/leave trade, /leave lfg removes it)'),
  '/me <action> - an action on this tab: /me looks around',
  () => t('net.chat.rpHelp', '/rp <text> - a roleplay line on this tab, in green italics: /rp draws her blade'),
  '/wave, /bow, /nod ... [name] - a gesture to players nearby (/emotes lists them all)',
  ':smile: :sword: :heart: ... - shortcodes become emoji',
  '/ready - how party resting works online (resting at a fire rests the whole party)',
  '/leader - travel to your party leader',
  '/travel - get ready for the leader\'s journey (as leader, call it off)',
  '/unstuck - leave by the door you came in, or outdoors go to the nearest town (/unstuck cancel stops it)',   // PVPUNSTUCK
  '/mentor - shows whether you are mentoring your party (it turns on when they are well below your level)',
  '/mail - your mailbox: messages from the developers and items to claim',
  () => t('net.chat.bugHelp', '/bug - tell the developers privately about an exploit, a bug or a security hole'),   // PRIVATE-REPORT
  '/find or /who <name> - find who is online by that name',   // SCALE5c
  '/search <name> - show a player\'s lines on every tab and who is online by that name (/search on its own clears it)',   // CHAT-FIND
  () => t('net.chat.blockHelp', '/block <name>, /unblock <name>, /blocked - hide a player\'s lines, invites and requests, or show them again'),   // SAFE1
  () => t('net.chat.reportHelp', '/report <name> [harassment|hate|sexual|threat|spam][: note] - send their recent lines and your note to the moderators, or click a name in the chat'),   // SAFE3 - AUDIT SAFE DOC-13: and the reporter's note
  () => t('net.chat.rulesHelp', '/rules - the Code of Conduct every player agreed to'),   // SAFE7
  '//text - a line that starts with a slash',
]);

/** AUDIT EG V (c, L7-21): /help's own line for the Elite Breach's words (the host answers `/breach` before this parser is
 *  asked - breachCommandOf), in the player's language; and /help's lines whole. */
export const breachHelpLine = () => t('chat.help.breach', '/breach - the Elite Breach: answer your company\'s call or open the start window (/breach help lists its commands)');
export const helpLines = () => [...HELP_LINES.slice(0, -1), breachHelpLine(), HELP_LINES[HELP_LINES.length - 1]];
/**
 * AUDIT EG V (c, L7-1): THE ELITE BREACH'S DOOR IN THE CHAT - what `/breach` was given: its words after it, whole (`pick 2`,
 * `vote yes`, `buy tonic`, `ping danger`, `annals 3`, `surplus reroll`, `bequest 1`), '' for `/breach` alone, null for any
 * other line. The host (scenes/world.js onSend) hands them to the breach client (scenes/eliteGates/egClient.js command) and sends
 * nothing; a one-word door read every two-word command as no command at all. Pure.
 * @param {string} text
 */
export function breachCommandOf(text) {
  const m = /^\/breach(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  return m ? (m[1] ?? '').trim() : null;
}

/**
 * What a typed line IS:
 *   { kind: 'say', text }                   - no command: said on the active tab, as typed
 *   { kind: 'channel', tab, text, wrap }    - said on `tab` (wrap: 'ooc' puts it in (( )))
 *   { kind: 'help' }                        - the list
 *   { kind: 'host', name }                  - one of HOST_COMMANDS (the host tests these first)
 *   { kind: 'empty', name }                 - a channel command with nothing to say
 *   { kind: 'unknown', name }               - `/name` is no command: refused in words, never said
 *   { kind: 'roll', spec }                  - DICE1: dice the relay rolls, on the active tab
 *   { kind: 'me', text }                    - EMOTE1: an action, on the active tab
 *   { kind: 'emote', text }                 - EMOTE1: a gesture's line, said as an action on the Local tab
 *   { kind: 'lang', code }                  - CHAT-LANG: choose the language channel ('off' none, '' the list)
 *   { kind: 'emotes' }                      - EMOTE1: the gestures' list
 *   { kind: 'badroll', name }               - a roll the dice's grammar or bounds refuse
 *   { kind: 'find', q }                     - SCALE5c: a search of everyone online by name (the World tab's link asks)
 *   { kind: 'join', chan } / { kind: 'leave', chan } - CHAT-TRADE: a channel joined or left by choice (JOIN_CHANNELS;
 *                                             `chan` '' for one the line did not name - refused in words)
 *   { kind: 'rp', text }                    - CHAT-RP: a line of roleplay, on the active tab - the text in its *mark*
 * A line starting `//` is said with one slash off it. `extra` is a later slice's own table of commands, each
 * { names, parse(rest) } - parse answers a result of its own or null to decline.
 */
export function parseChatLine(text, extra = []) {
  const raw = String(text ?? '');
  const t = raw.trim();
  if (!t.startsWith('/')) return { kind: 'say', text: raw };
  if (t.startsWith('//')) return { kind: 'say', text: t.slice(1) };
  const m = /^\/([A-Za-z?][\w-]*)(?:\s+([\s\S]*))?$/.exec(t);
  if (!m) return { kind: 'unknown', name: t.split(/\s/)[0].slice(1) };
  const name = m[1].toLowerCase();
  const rest = (m[2] ?? '').trim();
  if (name === 'help' || name === '?') return { kind: 'help' };
  if (HOST_COMMANDS.includes(name)) return { kind: 'host', name };
  if (name === 'lang') return { kind: 'lang', code: rest.toLowerCase() };   // CHAT-LANG: '' the list, 'off' none, else a code
  if (name === 'roll' || name === 'dice') { const spec = parseRollSpec(rest); return spec ? { kind: 'roll', spec } : { kind: 'badroll', name }; }
  if (name === 'me') return rest ? { kind: 'me', text: rest } : { kind: 'empty', name };
  if (name === 'rp') return rest.replace(/\*/g, '').trim() ? { kind: 'rp', text: rpText(rest) } : { kind: 'empty', name };   // CHAT-RP
  if (name === 'join' || name === 'leave') { const chan = rest.toLowerCase().replace(/^#/, ''); return { kind: name, chan: JOIN_CHANNELS.includes(chan) ? chan : '' }; }   // CHAT-TRADE
  if (name === 'emotes') return { kind: 'emotes' };
  if (name === 'find' || name === 'who') return rest ? { kind: 'find', q: rest } : { kind: 'empty', name };   // SCALE5c (Mac's decision 2)
  if (Object.hasOwn(EMOTES, name)) return { kind: 'emote', text: emoteText(name, rest) };
  const chan = CHANNEL_COMMANDS.find((c) => c.names.includes(name));
  if (chan) return rest ? { kind: 'channel', tab: chan.tab, text: rest, wrap: chan.wrap } : { kind: 'empty', name };
  for (const e of extra) {
    if (!e?.names?.includes?.(name)) continue;
    const r = e.parse?.(rest, name);
    if (r) return r;
  }
  return { kind: 'unknown', name };
}

/** CHAT-FIND: `/search <name>` - the panel's own command, answered before the host is asked (it sends nothing and
 *  says nothing: it fills the panel's search). `{ query }` ('' to clear), or null for any other line. `/find` and `/who`
 *  stay the hub's search of everyone online (SCALE5c), so a line the panel takes is never one the host answers. Pure. */
export const FIND_COMMANDS = Object.freeze(['search']);
export function findCommandOf(text) {
  const m = /^\/([A-Za-z]+)(?:\s+([\s\S]*))?$/.exec(String(text ?? '').trim());
  if (!m || !FIND_COMMANDS.includes(m[1].toLowerCase())) return null;
  return { query: (m[2] ?? '').trim() };
}

/** The line a refused command leaves in the log - said to the one who typed it, and nobody else. */
export const unknownCommandText = (name) => `There is no /${name} command. /help lists them.`;
export const emptyCommandText = (name) => `/${name} needs something to say.`;
/** DICE1: a roll the grammar or the bounds refuse - the forms, and the bounds, in the player's words. */
export const badRollText = (name) => `/${name} takes dice like 2d6+3, d20 or 100, with at most ${ROLL_DICE_MAX} dice of up to ${ROLL_SIDES_MAX} sides.`;
/** A host command in a shape its own test refused (`/red` with nothing to say, `/unstuck now`) - refused in words
 *  too: before this slice such a line fell through to the room and was said there, slash and all. */
export const hostMisuseText = (name) => (name === 'red' ? emptyCommandText(name) : name === 'unstuck' ? '/unstuck takes only cancel after it.' : `/${name} takes nothing after it.`);   // PVPUNSTUCK: /unstuck cancel

/** SCALE5c: the hub's answer to `/find`, as the line the typer reads - the names (badges aside: a roster row wears
 *  them), a full answer said to be one, a busy hub said to be busy.
 * @param {{ q?: string, l?: { name?: string }[], busy?: boolean }} [f] */
export function foundText({ q, l, busy } = {}) {
  const names = (Array.isArray(l) ? l : []).map((p) => p?.name).filter((n) => typeof n === 'string' && n);
  if (busy) return 'Too many players are searching right now. Try again in a moment.';
  if (!names.length) return `No one online by "${q}".`;
  return `Online, by "${q}"${names.length >= HUB_FIND_MAX ? ` (the first ${HUB_FIND_MAX})` : ''}: ${names.join(', ')}.`;
}
/** SCALE5c: `/find` with no hub to ask. */
export const FIND_OFFLINE_TEXT = 'Search needs the World channel to be connected.';
/** AUDIT SCALE II C-1: `/find` on a hub whose relay answers no search (one before the shards, world192) - said here and
 *  never sent, since that relay closes the hub link on it. */
export const FIND_RELAY_TEXT = 'Search is not available on this server yet.';

/** CHAT-LANG: what `/lang` says - the channels, code and name, and how to choose one. */
export const LANG_LINES = Object.freeze(['Language channels (/lang <code> joins one, /lang off leaves it):',
  Object.entries(CHAT_LANGS).map(([code, name]) => `${code} ${name}`).join(' \u00b7 ')]);
/** CHAT-LANG: a code the table does not have. */
export const unknownLangText = (code) => `There is no "${String(code).slice(0, 12)}" language channel. /lang lists them.`;
/** EMOTE1: the gestures, as the lines `/emotes` shows. */
export const EMOTE_LINES = Object.freeze(['Gestures for players nearby. Add a name to aim one at someone:', Object.keys(EMOTES).map((n) => `/${n}`).join(' ')]);
