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
//   /help /?                the list, as lines only you see
//   //text                  a line that starts with a slash, said as it stands on the active tab
//
// The commands the host has always handled itself - `/unstuck` (UNSTUCK1), `/red` (RED1), `/mute` and `/unmute`
// (MOD1), `/ready` (PARTY-REST2) - are KNOWN here and answered `host`: the host tests them first, by the regexes their
// own slices pin, so a known one never reaches this parser's `unknown` and the parser never needs their grammar.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).

/** The channel commands: each names the tab its text is said on. `wrap` is what the text becomes first. */
export const CHANNEL_COMMANDS = Object.freeze([
  Object.freeze({ names: Object.freeze(['world', 'g']), tab: 'world', wrap: null, help: '/world or /g <text> - to everyone online' }),
  Object.freeze({ names: Object.freeze(['region', 'r']), tab: 'region', wrap: null, help: '/region or /r <text> - to everyone in the region you stand in' }),
  Object.freeze({ names: Object.freeze(['party', 'p']), tab: 'party', wrap: null, help: '/party or /p <text> - to your party' }),
  Object.freeze({ names: Object.freeze(['local', 'l', 'say', 's']), tab: 'local', wrap: null, help: '/local, /l, /say or /s <text> - to those near enough to hear you, in character' }),
  Object.freeze({ names: Object.freeze(['ooc']), tab: 'local', wrap: 'ooc', help: '/ooc <text> - to those near you, out of character - (( ))' }),
]);
/** The commands the host handles itself, before this parser is asked (their own slices pin their grammar). */
export const HOST_COMMANDS = Object.freeze(['unstuck', 'red', 'mute', 'unmute', 'ready']);
/** The lines `/help` shows - the channels, then the host's own. */
export const HELP_LINES = Object.freeze([
  'Chat commands:',
  ...CHANNEL_COMMANDS.map((c) => c.help),
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
/** A host command in a shape its own test refused (`/red` with nothing to say, `/unstuck now`) - refused in words
 *  too: before this slice such a line fell through to the room and was said there, slash and all. */
export const hostMisuseText = (name) => (name === 'red' ? emptyCommandText(name) : `/${name} takes nothing after it.`);
