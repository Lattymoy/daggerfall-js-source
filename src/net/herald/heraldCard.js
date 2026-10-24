// @ts-check
// HERALD-CARDS (2026-10-22, the owner: "I want to overhaul our discord world event notification system to be more
// organized"): THE HERALDS' ONE CARD. Four heralds post to the world events' Discord channel - the gate's
// (net/gate/gateHerald.js: the omen, the kill, the broken rite), the serpent's (net/serpent/serpentHerald.js), the Abyss
// Dungeon's (net/superDungeon/sdHerald.js) and the Spire's (net/eliteGates/egHerald.js) - and each wrote its own post: one
// paragraph of plain text, the headline in bold, the times and the place and the names inside the sentence. Fourteen
// kinds of post in one channel, every one a wall of words a reader had to read to the end to find when, where and who.
//
// So every post is now ONE CARD, built here and nowhere else - a Discord embed of the same shape for every moment:
//   - AUTHOR: the event's family ("Dagon's Breach", "The Sea Serpent", "The Abyss Dungeon", "The Battlespire"), and the
//     card's edge in the family's colour - the colour its ring has on the map (HERALD_FAMILIES) - so the channel reads
//     by event at a glance;
//   - TITLE: the moment, in a line ("The sky burns near Copperham", "Valkynaz Ruhn has fallen");
//   - TEXT: what a reader should know beyond the facts (the rite, the marks, the way in), where there is any;
//   - FIELDS: the facts a reader scans for, side by side - when (in each reader's own clock, and how soon), where, who;
//   - FOOTER: the moment's kind ("Omen", "Slain", "Found"), the same word on every card of that kind.
// A post that pings says so in its CONTENT, the one place Discord notifies from: the role and the headline. A quiet post
// has no content at all - the card is the post.
//
// THE DOOR, shared: the channel's webhook (GATE_DISCORD_WEBHOOK, a Worker SECRET) and, new, a THREAD for each family
// (HERALD_FAMILIES `thread` - a relay setting over its var, net/relayCfg.js): set, a family's cards go to its own thread
// of the channel (a forum's post, a text channel's thread - Discord's `thread_id`); unset, to the gate's thread; none
// set, to the channel itself, as before. One webhook, one channel, each event in its own place when the operator wants it.
// A thread Discord refuses sends the card to the channel itself (server/src/index.js `_heraldSend`, AUDIT HERALD-CARDS H1).
//
// SAFE TO POST, as before: `allowed_mentions` is the one role a post names or nothing, so no text can ping anyone else; a
// name a player can reach is held to letters, digits, spaces and a little punctuation (heraldName) wherever it is drawn.
//
// PURE, and the relay's (server/src/index.js bundles it through the heralds): it imports wire.js alone. Nothing here
// fetches; the hub hands Discord what these build.
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (HERALD-CARDS).
import { NAME_MAX } from '../wire.js';

/**
 * THE FAMILIES: each event's card. `name` its author line, `colour` its edge - the family's marker in the pause menu's
 * Timers (the gate's red is this table's, read by ui/enhanced/enhancedStyle.js through heraldCss; the others are their
 * rings on the map - ui/serpentMapMark.js SERPENT_RING_MAP_CSS, ui/superDungeon/sdMapMark.js SD_RING_MAP_CSS,
 * ui/eliteGates/egArchMapMark.js EG_ARCH_RING_CSS - held equal by test/net/herald/heraldcards.test.js), `thread` the relay
 * setting naming its thread (net/relayCfg.js).
 */
export const HERALD_FAMILIES = Object.freeze({
  gate: Object.freeze({ name: 'Dagon\'s Breach', colour: 0xe2554c, thread: 'gateThread' }),
  serpent: Object.freeze({ name: 'The Sea Serpent', colour: 0x3fd6c6, thread: 'serpentThread' }),
  abyss: Object.freeze({ name: 'The Abyss Dungeon', colour: 0xe8b24a, thread: 'sdThread' }),
  spire: Object.freeze({ name: 'The Battlespire', colour: 0xffd56a, thread: 'egThread' }),
});
/** @typedef {keyof typeof HERALD_FAMILIES} HeraldFamily */
/** A family's colour as a stylesheet writes it ('#e2554c'). */
export const heraldCss = (family) => `#${(HERALD_FAMILIES[family]?.colour ?? 0).toString(16).padStart(6, '0')}`;

/** Discord's bounds on a message and its embed (a body past one is refused whole - for good, a 400). */
export const HERALD_CONTENT_MAX = 2000;
export const HERALD_TITLE_MAX = 256;
export const HERALD_TEXT_MAX = 4096;
export const HERALD_FIELDS_MAX = 25;
export const HERALD_FIELD_NAME_MAX = 256;
export const HERALD_FIELD_VALUE_MAX = 1024;
export const HERALD_FOOTER_MAX = 2048;
/** The whole embed's bound: its title, text, every field's name and value, its footer and its author together. */
export const HERALD_EMBED_MAX = 6000;

const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d{1,2})?\/webhooks\/\d{1,20}\/[A-Za-z0-9_-]{1,128}$/;
const SNOWFLAKE_RE = /^\d{15,21}$/;

/** The channel's webhook, or null - anything that is not a Discord webhook's URL is none (a secret put wrong posts
 *  nowhere else). */
export const heraldWebhook = (raw) => { const s = String(raw ?? '').trim(); return WEBHOOK_RE.test(s) ? s : null; };
/** The role a post pings (a Discord id), or null - none pinged. */
export const heraldRole = (raw) => { const s = String(raw ?? '').trim(); return SNOWFLAKE_RE.test(s) ? s : null; };
/** HERALD-CARDS: a family's thread (a Discord id - the thread's, or a forum post's), or null - the channel itself. */
export const heraldThread = (raw) => { const s = String(raw ?? '').trim(); return SNOWFLAKE_RE.test(s) ? s : null; };
/** HERALD-CARDS: where a card is posted - the webhook, into a thread when one is named. */
export const heraldPostUrl = (hook, thread = null) => (thread ? `${hook}?thread_id=${thread}` : hook);

/** A name as a post says it: letters, digits, spaces, apostrophes and hyphens (a name is sanitizeName's already - this
 *  keeps Discord's markdown, links and mentions out of it), or '' for none. AUDIT HERALD-CARDS L2: never a hyphen first -
 *  a card's field begins with a name, and Discord draws "- Ann" there as a list. */
export const heraldName = (n) => String(n ?? '').replace(/[^A-Za-z0-9 '-]/g, '').replace(/\s+/g, ' ').trim().replace(/^[-\s]+/, '').slice(0, NAME_MAX).trim();
/** A relay-clock instant as Discord draws it in each reader's own time: `R` "in 15 minutes", `t` "14:32". */
export const heraldStamp = (ms, style) => `<t:${Math.floor(ms / 1000)}:${style}>`;
/** HERALD-CARDS: a moment as a card's field says it - the reader's own clock, then how soon ("14:32 (in 15 minutes)"). */
export const heraldWhen = (ms) => `${heraldStamp(ms, 't')} (${heraldStamp(ms, 'R')})`;
/** "Ann", "Ann and Bran", "Ann, Bran and Cid". */
export const heraldList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');
/** HERALD-CARDS: who did it - the names a post may say (each through heraldName, empties dropped) and how many more of
 *  the `n` who fought ("Ann, Bran and 12 others"), or '' for no name at all. */
export function heraldWho(names, n = 0) {
  const shown = (Array.isArray(names) ? names : []).map(heraldName).filter(Boolean);
  if (!shown.length) return '';
  const others = Number.isSafeInteger(n) ? Math.max(0, n - shown.length) : 0;
  return heraldList([...shown, ...(others ? [`${others} other${others === 1 ? '' : 's'}`] : [])]);
}

/** A string held to `max` characters - cut with an ellipsis, never refused. */
const clip = (s, max) => { const v = String(s ?? ''); return v.length > max ? `${v.slice(0, max - 1)}\u2026` : v; };

/**
 * THE CARD: a Discord webhook body - one embed in the family's colour, and content only when it pings.
 * @param {{ family: HeraldFamily, moment: string, title: string, text?: string,
 *           fields?: ReadonlyArray<readonly [string, string|null|undefined|false] | readonly [string, string|null|undefined|false, boolean]>,
 *           role?: string|null, ping?: string }} o
 *   `fields` as `[name, value, inline?]` - a field with no value is left out, and each stands inline unless it says not;
 *   `role` the role it pings (heraldRole's), and `ping` the line beside it (the title when none).
 */
export function heraldCard({ family, moment, title, text = '', fields = [], role = null, ping = '' }) {
  const fam = HERALD_FAMILIES[family] ?? HERALD_FAMILIES.gate;
  const r = heraldRole(role);
  /** @type {Array<{ name: string, value: string, inline: boolean }>} */
  const shown = [];
  // AUDIT HERALD-CARDS L1: a field Discord needs both halves of - a blank name or value is no field
  for (const [name, value, inline = true] of fields) if (String(value ?? '').trim() && String(name ?? '').trim()) shown.push({ name: clip(name, HERALD_FIELD_NAME_MAX), value: clip(value, HERALD_FIELD_VALUE_MAX), inline });
  /** @type {any} */
  const embed = { author: { name: fam.name }, title: clip(title, HERALD_TITLE_MAX), color: fam.colour };
  if (text) embed.description = clip(text, HERALD_TEXT_MAX);
  if (shown.length) embed.fields = shown.slice(0, HERALD_FIELDS_MAX);
  embed.footer = { text: clip(moment, HERALD_FOOTER_MAX) };
  // AUDIT HERALD-CARDS L1: and the whole within Discord's 6000 (a body past it is refused whole, and let go) - the text
  // cut first, since the facts are the card's; then the last fields let go
  const over = heraldEmbedSize({ embeds: [embed] }) - HERALD_EMBED_MAX;
  if (over > 0 && embed.description) embed.description = clip(embed.description, Math.max(1, embed.description.length - over));
  while (heraldEmbedSize({ embeds: [embed] }) > HERALD_EMBED_MAX && embed.fields?.length) { embed.fields.pop(); if (!embed.fields.length) delete embed.fields; }
  /** @type {any} */
  const body = { embeds: [embed], allowed_mentions: r ? { roles: [r] } : { parse: [] } };
  if (r) body.content = clip(`<@&${r}> ${ping || embed.title}`, HERALD_CONTENT_MAX);
  return body;
}

/** The characters a card's embed counts against HERALD_EMBED_MAX (Discord's own sum). */
export function heraldEmbedSize(body) {
  const e = body?.embeds?.[0] ?? {};
  const fields = Array.isArray(e.fields) ? e.fields : [];
  return [e.title, e.description, e.footer?.text, e.author?.name, ...fields.flatMap((f) => [f.name, f.value])].reduce((n, s) => n + String(s ?? '').length, 0);
}
