// CHAT-COLOURS + PING1 + NAME-INK (2026-10-11). The players: "Chat color-coding per channel (i.e. White for Global,
// Green for Regional, Purple for Guild, Grey for Local)" and "A unique color or alert for @name pings"; Mac: "the color
// was the problem not the font" (a player's name drawn in the same ink as their words), "make sure the colors are all
// good readable".
//
// ONE TABLE, TWO GROUNDS. Every colour comes twice: `light` for the dark grounds - Enhanced Plus's chat box, and the
// lines that stand over the world while the chat is shut (each under the HUD's hard outline) - and `dark` for DFO
// Grimoire's page, where the chat is written in ink. Each pair is tuned to read at 4.5:1 or better on its own ground
// (test/ui/chatcolours1.test.js measures every one against the grounds below), and the hues stay apart: a line's channel
// is its words' colour, a speaker is their name's, and a line that names me wears the mention's gold.
//
// The channels the request named keep the colours it named; the three it did not (Language, Party) take hues none of
// the others or the names use.

/** The grounds the colours are read on - the darkest each can be (test/ui/chatcolours1.test.js). Plus: the box's own
 *  rgba(14,16,19,.84) over a white sky, its lightest; Grimoire: the cream page's darkest tenth, as measured off the
 *  rendered chat (the darkest twentieth of the cream page behind its lines). */
export const CHAT_GROUNDS = Object.freeze({ light: '#343638', dark: '#c9a864' });

/** A channel's words: the tab a line was said on (net/chat.js CHAT_TABS ids). */
export const CHANNEL_COLOURS = Object.freeze({
  world: Object.freeze({ light: '#f6f2ea', dark: '#24160a' }),    // white - and on the page, the ink itself
  region: Object.freeze({ light: '#8fe28f', dark: '#194815' }),   // green
  lang: Object.freeze({ light: '#ffaad4', dark: '#76134e' }),     // rose
  party: Object.freeze({ light: '#6fe6d4', dark: '#0a4641' }),    // teal
  guild: Object.freeze({ light: '#d2b6ff', dark: '#4e1f8f' }),    // purple
  local: Object.freeze({ light: '#c4beb2', dark: '#443e39' }),    // grey
  trade: Object.freeze({ light: '#f0dc5a', dark: '#3f3300' }),    // CHAT-TRADE: gold - the coin's
  lfg: Object.freeze({ light: '#98c4ff', dark: '#173478' }),      // CHAT-TRADE: blue
});

/** CHAT-RP (2026-10-14, Mac: "/rp Italicizes and makes text color green. For roleplay purposes"): a line of roleplay's
 *  words - green and leaning on every tab, whatever the channel's colour (its kind keeps its own, as an action's does);
 *  a yellower green than the Region's, so the lean is not the only thing that tells them apart. */
export const RP_COLOURS = Object.freeze({ light: '#a8e66e', dark: '#1d420a' });

/** A speaker's name - never the words' colour (NAME-INK). A stranger's in brass (the page's red on Grimoire), my own a
 *  paler gold (a brown gold), a party member's green and a friend's blue (net/social.js cssColorOf - the light pair is
 *  social's own; the dark pair is each deepened to read on the page). */
export const NAME_COLOURS = Object.freeze({
  other: Object.freeze({ light: '#f4b86c', dark: '#7a170c' }),
  mine: Object.freeze({ light: '#e8cf86', dark: '#563500' }),
  party: Object.freeze({ light: '#73ff73', dark: '#0c491d' }),
  friend: Object.freeze({ light: '#8fd0ff', dark: '#153d7c' }),
});

/** PING1: a line that names me - the mention's own gold in the words, the line laid on a wash of it with a bar at its
 *  edge. On the page the mention is the deep brown-gold over a gold wash. */
export const PING_COLOURS = Object.freeze({
  mention: Object.freeze({ light: '#ffd35a', dark: '#4a2600' }),
  wash: Object.freeze({ light: 'rgba(255, 200, 70, 0.16)', dark: 'rgba(214, 150, 20, 0.22)' }),
  bar: Object.freeze({ light: '#ffc845', dark: '#a8620a' }),
});

/** The plain kinds a channel colours - a system line, a server's, the DM's, an aside, an action, a roll and (CHAT-RP) a
 *  line of roleplay keep their own. */
export const COLOURED_LINE = ':not(.system):not(.red):not(.dm):not(.ooc):not(.me):not(.roll):not(.rp)';

/** The sheet's rules for one ground: `scope` the selector a rule's line sits under (with the switch on), `tone` 'light' or
 *  'dark', `imp` whether the rules must say !important (Grimoire's ink pass re-says the chat's own colours). */
export function channelRules(scope, tone, imp = false) {
  const bang = imp ? ' !important' : '';
  return Object.entries(CHANNEL_COLOURS).map(([ch, c]) =>
    `${scope} .dfchat-line[data-ch="${ch}"]${COLOURED_LINE} .dfchat-text { color: ${c[tone]}${bang}; }`).join('\n');
}
/** The tabs' and the channel marks' pip: a square of the channel's colour before each label. */
export function pipRules(scope, tone, imp = false) {
  const bang = imp ? ' !important' : '';
  return Object.entries(CHANNEL_COLOURS).map(([ch, c]) =>
    `${scope} :is(.dfchat-tab, .dfchat-chan)[data-tab="${ch}"]::before { background: ${c[tone]}${bang}; }`).join('\n');
}

/** PING1: the grounds under the mention's wash - CHAT_GROUNDS with PING_COLOURS.wash laid on each: a pinging line's
 *  words and names must read there too. */
export const PING_GROUNDS = Object.freeze({ light: '#544d3a', dark: '#cca452' });
/** WCAG's relative luminance of a #rrggbb colour, and the contrast of two - what the test measures with. */
export function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
