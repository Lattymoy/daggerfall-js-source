// @ts-check
// CHAT-CHAN (2026-09-23, the community arc): THE CHAT'S SLASH COMMANDS - one grammar, pure, DOM-free.
//
// Before this slice the host's onSend (scenes/world.js) tested a handful of commands by regex and sent EVERYTHING else
// to the room, so a mistyped `/pary hi` was said to everyone online, literally. Now a line that starts with `/` is a
// command or it is refused in words: `parseChatLine` answers what a typed line IS, and the host does it.
//
//   /world /g <text>        the World channel          /region /r <text>     the region you stand in
//   /party /p <text>        your party                 /local /l /say /s     those near enough to hear you
//   /ooc <text>             a Local aside out of character - the line wrapped in (( ))
//   /roll /dice [NdM+K]     dice the RELAY rolls, on the active tab (DICE1, net/dice.js) - a d20 when nothing is said
//   /me <action>            an ACTION on the active tab - "Bran looks around" (EMOTE1)
//   /wave /bow ... [name]   a GESTURE, to those near you (Local) - "Bran waves at Ann." (EMOTE1, EMOTES; /emotes lists them)
//   :smile: :sword: ...     a shortcode is its emoji in anything said (EMOTE1, SHORTCODES)
//   /help /?                the list, as lines only you see
//   //text                  a line that starts with a slash, said as it stands on the active tab
//
// The commands the host has always handled itself - `/unstuck` (UNSTUCK1), `/red` (RED1), `/mute` and `/unmute`
// (MOD1), `/ready` (PARTY-REST2) - are KNOWN here and answered `host`: the host tests them first, by the regexes their
// own slices pin, so a known one never reaches this parser's `unknown` and the parser never needs their grammar.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).

import { parseRollSpec, ROLL_DICE_MAX, ROLL_SIDES_MAX } from './dice.js';   // DICE1: the dice's grammar

/** The channel commands: each names the tab its text is said on. `wrap` is what the text becomes first. */
export const CHANNEL_COMMANDS = Object.freeze([
  Object.freeze({ names: Object.freeze(['world', 'g']), tab: 'world', wrap: null, help: '/world or /g <text> - to everyone online' }),
  Object.freeze({ names: Object.freeze(['region', 'r']), tab: 'region', wrap: null, help: '/region or /r <text> - to everyone in the region you stand in' }),
  Object.freeze({ names: Object.freeze(['party', 'p']), tab: 'party', wrap: null, help: '/party or /p <text> - to your party' }),
  Object.freeze({ names: Object.freeze(['local', 'l', 'say', 's']), tab: 'local', wrap: null, help: '/local, /l, /say or /s <text> - to those near enough to hear you, in character' }),
  Object.freeze({ names: Object.freeze(['ooc']), tab: 'local', wrap: 'ooc', help: '/ooc <text> - to those near you, out of character - (( ))' }),
]);
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
  return t ? e[1].replace('{t}', t) : e[0];
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
export const HOST_COMMANDS = Object.freeze(['unstuck', 'red', 'mute', 'unmute', 'ready']);
/** CHAT-HELP (2026-09-23, Mac: "a non-intrusive greeting message that says something along the lines of (use /help
 *  for commands)"): the line the chat greets the player with each time they go online - theirs alone, never counted
 *  unread (net/chat.js push's `quiet`), so /help is found without being announced. */
export const CHAT_GREETING_TEXT = 'Welcome! Type /help for chat commands.';
/** The lines `/help` shows - the channels, then the host's own. */
export const HELP_LINES = Object.freeze([
  'Chat commands:',
  ...CHANNEL_COMMANDS.map((c) => c.help),
  '/roll or /dice [NdM+K] - dice the server rolls, on this tab: /roll 2d6+3, /roll d20, /roll 100',
  '/me <action> - an action on this tab: /me looks around',
  '/wave, /bow, /nod ... [name] - a gesture to those near you - /emotes lists them all',
  ':smile: :sword: :heart: ... - a shortcode is its emoji',
  '/ready - your vote on a party rest',
  '/unstuck - out through the door you came in by',
  '//text - a line that starts with a slash',
]);

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
 *   { kind: 'emotes' }                      - EMOTE1: the gestures' list
 *   { kind: 'badroll', name }               - a roll the dice's grammar or bounds refuse
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
  if (name === 'roll' || name === 'dice') { const spec = parseRollSpec(rest); return spec ? { kind: 'roll', spec } : { kind: 'badroll', name }; }
  if (name === 'me') return rest ? { kind: 'me', text: rest } : { kind: 'empty', name };
  if (name === 'emotes') return { kind: 'emotes' };
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

/** The line a refused command leaves in the log - said to the one who typed it, and nobody else. */
export const unknownCommandText = (name) => `There is no /${name} command. /help lists them.`;
export const emptyCommandText = (name) => `/${name} needs something to say.`;
/** DICE1: a roll the grammar or the bounds refuse - the forms, and the bounds, in the player's words. */
export const badRollText = (name) => `/${name} takes dice like 2d6+3, d20 or 100 - at most ${ROLL_DICE_MAX} dice of up to ${ROLL_SIDES_MAX} sides.`;
/** A host command in a shape its own test refused (`/red` with nothing to say, `/unstuck now`) - refused in words
 *  too: before this slice such a line fell through to the room and was said there, slash and all. */
export const hostMisuseText = (name) => (name === 'red' ? emptyCommandText(name) : `/${name} takes nothing after it.`);

/** EMOTE1: the gestures, as the lines `/emotes` shows. */
export const EMOTE_LINES = Object.freeze(['Gestures, to those near you - add a name to make one AT someone:', Object.keys(EMOTES).map((n) => `/${n}`).join(' ')]);
