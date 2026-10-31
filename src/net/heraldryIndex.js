// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HERALDRY-SHOWN (2026-10-02, Mac: "lets finish the build work") —
// EVERY GUILD'S HERALDRY THE CLIENT HAS BEEN TOLD, BY ITS TAG.
//
// Seats-Arc 8.1: the heraldry is drawn on the guild tag's frame, the
// siege HUD and the Chronicle. None of those carries it on its own wire
// (a peer's token names its tag alone, the fight's answer its guilds'
// names and tags, a Chronicle row the names and tags as they were that
// day), so each face reads it, by the guild's TAG (one guild a tag - the
// guilds table's unique; a Chronicle row's by its name too, AUDIT
// HERALDRY H3: a disbanded guild's tag may be reused), off what the
// client already holds: the seats' list (each holder's guild and its
// battle's two), a dressed seat, a
// seat's standings, and the reader's own guild.
//
// The client's alone, beside net/heraldryLaw.js rather than in it: that
// law is bundled by the relay and the account service, and an index
// neither of them reads is no change to what they run. Pure: no clock,
// no DOM, no network.
// ═══════════════════════════════════════════════════════════════════
import { heraldryOf } from './heraldryLaw.js';

/**
 * EACH GUILD THE CLIENT HAS BEEN TOLD OF, BY ITS TAG - `{ name, heraldry }`, the guild's name as the source said it beside
 * its heraldry (AUDIT HERALDRY H3: so a Chronicle row's guild, named as it was that day, is matched by its name too) -
 * `sources` read in order and the first word on a tag kept: a guild `{ tag, heraldry }`, the seats' list (`{ seats }`), a
 * seat (its `holder.guild` and its battle's `guild` and `against`), a seat's standings (`{ holder, battle, standings }`).
 * A guild with none, or a heraldry the law refuses, adds nothing.
 * @param {...any} sources
 * @returns {Map<string, {name: string|null, heraldry: {field: string, border: string, device: string}}>}
 */
export function heraldryIndex(...sources) {
  const out = new Map();
  const put = (g) => {
    const h = heraldryOf(g?.heraldry);
    if (h && typeof g.tag === 'string' && g.tag && !out.has(g.tag))
      out.set(g.tag, { name: typeof g.name === 'string' ? g.name : null, heraldry: h });
  };
  const seat = (s) => {
    put(s?.holder?.guild);
    put(s?.battle?.guild);
    put(s?.battle?.against);
  };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    put(src);
    seat(src);
    for (const s of Array.isArray(src.seats) ? src.seats : []) seat(s);
    for (const r of Array.isArray(src.standings) ? src.standings : []) put(r?.guild);
  }
  return out;
}

/**
 * A guild's heraldry by its tag alone (heraldryIndex's, without the names) - for a face that names a guild as it is now
 * (a seat's battle, the siege HUD).
 * @param {...any} sources
 * @returns {Map<string, {field: string, border: string, device: string}>}
 */
export function heraldryByTag(...sources) {
  return new Map([...heraldryIndex(...sources)].map(([tag, e]) => [tag, e.heraldry]));
}

/**
 * The heraldry `index` (heraldryIndex's) holds for `tag` - with `name` given (a Chronicle row's guild, as it was that
 * day), only where the guild holding the tag bears that name too: a disbanded guild's tag a new guild took shows none of
 * the new arms on the old guild's lines. Null for none.
 * @param {Map<string, {name: string|null, heraldry: any}>} index
 * @param {string} tag
 * @param {string} [name]
 */
export function armsNamed(index, tag, name = undefined) {
  const e = index.get(tag);
  return e && (name === undefined || e.name === name) ? e.heraldry : null;
}
