// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STANDING-WORDS and SEAT-WORDS (2026-10-16, bible/01-Overview/bugs/Field-Bugs-2026-10-15g.md; Mac, asked what the guild
// system still left unsaid: "Seat-locked services", "Standing changes shown", "Tutorial + guide words") - WHAT THE
// ROLL'S TRACKER SAYS, as the streaming host wires it (scenes/world.js; the shape is fishHost.js's: the host hands its
// doors in and spreads what comes back into createRollTracker).
//
//   THE HOLD. The book held at 7 was one chat line once a hold, and an Archmage who missed it found a Wizard (Discord:
//   "why did my rank on mages guild fall if i got max reputation"). The line stands, and the Chapters tutorial page
//   pops with it - a box, read once on this device and always again from the menu.
//   THE FIRST WORD. A member of any of the twenty-two coming online is shown the same page the first time.
//   THE STANDING. Nothing said a guild's standing moved: a quest's +5, a crime's loss through the faction tree, a hall
//   writ's +2, the owed paid on a later day. Every adoption now says what the Roll's word moved since its last, one line
//   - "Standing: Mages Guild +25 (now 40, 10 more to come)" - its names the port's own, in the player's language (AUDIT
//   GUILD-WORDS II B-7), its list the language's own (B-6), its numbers the Roll's own, what was paid the service's word
//   (B-4). THE PACE. A gain the day's room cut is owed - said with what is owed; one the most a standing holds turned
//   away is said lost (B-3, C-4).
//
// THE FOUR HOSTS: the Roll's tracker is world.js's alone (built only online, for a realm character) - WIRED here;
// worldModes.js and dungeonContext.js are entered from it and read the same tracker through the host's doors;
// exterior.js, the offline fixed city, keeps no Roll (offline the standing is DFU's, unsaid as DFU's - nothing to wire).
// ═══════════════════════════════════════════════════════════════════
import { bookCappedLine, ROLL_FACTIONS, rollFactionOfGuild } from '../net/npcChapterLaw.js';
import { t, intlLocale } from '../systems/textManager.js';
import { noteFirstUse } from '../systems/tutorials.js';
import { activeMemberships } from '../systems/guild/guilds.js';
import { GUILD_FACTION_IDS as G, DIVINES as D, ORDERS as O, MAX_REPUTATION } from '../systems/guild/guildFactions.js';
import { standingOwedOf } from '../systems/standingOwed.js';

/** AUDIT GUILD-WORDS II B-7: THE TWENTY-TWO BY THE PORT'S OWN NAMES (npcChapterLaw.js hallPosterName's - a temple its
 *  divine's whole name, never FACTION.TXT's "Zen"; no locale ships FACTION.TXT's names), in the player's language. */
const ROLL_NAMES = Object.freeze({
  [G.FightersGuild]: () => t('chapters.guild.fighters', 'Fighters Guild'),
  [G.MagesGuild]: () => t('chapters.guild.mages', 'Mages Guild'),
  [G.ThievesGuild]: () => t('chapters.guild.thieves', 'Thieves Guild'),
  [G.DarkBrotherhood]: () => t('chapters.guild.brotherhood', 'Dark Brotherhood'),
  [D.Akatosh]: () => t('chapters.guild.akatosh', 'Temple of Akatosh'),
  [D.Arkay]: () => t('chapters.guild.arkay', 'Temple of Arkay'),
  [D.Dibella]: () => t('chapters.guild.dibella', 'Temple of Dibella'),
  [D.Julianos]: () => t('chapters.guild.julianos', 'Temple of Julianos'),
  [D.Kynareth]: () => t('chapters.guild.kynareth', 'Temple of Kynareth'),
  [D.Mara]: () => t('chapters.guild.mara', 'Temple of Mara'),
  [D.Stendarr]: () => t('chapters.guild.stendarr', 'Temple of Stendarr'),
  [D.Zenithar]: () => t('chapters.guild.zenithar', 'Temple of Zenithar'),
  [O.Horn]: () => t('chapters.guild.horn', 'Host of the Horn'),
  [O.Dragon]: () => t('chapters.guild.dragon', 'Knights of the Dragon'),
  [O.Flame]: () => t('chapters.guild.flame', 'Knights of the Flame'),
  [O.Hawk]: () => t('chapters.guild.hawk', 'Knights of the Hawk'),
  [O.Owl]: () => t('chapters.guild.owl', 'Knights of the Owl'),
  [O.Rose]: () => t('chapters.guild.rose', 'Knights of the Rose'),
  [O.Wheel]: () => t('chapters.guild.wheel', 'Knights of the Wheel'),
  [O.Candle]: () => t('chapters.guild.candle', 'Order of the Candle'),
  [O.Raven]: () => t('chapters.guild.raven', 'Order of the Raven'),
  [O.Scarab]: () => t('chapters.guild.scarab', 'Order of the Scarab'),
});

/** A guild faction's name as the player reads it: the port's own, in the player's language (ROLL_NAMES) - the Roll
 *  moves only the twenty-two, so any other faction is its number. */
export function standingName(/** @type {number} */ f) {
  const own = /** @type {Record<number, () => string>} */ (ROLL_NAMES)[f];
  return own ? own() : String(f);
}

/** AUDIT GUILD-WORDS II B-6: a list the player's language's way (Intl.ListFormat's conjunction - ui/credits.js's way). */
const listOf = (/** @type {string[]} */ items) => {
  try { return new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(items); } catch { return items.join(', '); }
};

/** The twenty-two the character belongs to, by the active book (DFU's - a vampire's mortal guilds lie dormant). */
export const rollMembershipsOf = (/** @type {any} */ entity) => new Set(Object.values(activeMemberships(entity) ?? {})
  .map((m) => rollFactionOfGuild(m?.guild)).filter((f) => /** @type {readonly unknown[]} */ (ROLL_FACTIONS).includes(f)));

/** Whether the character belongs to any of the twenty-two the Roll keeps. */
export const holdsRollMembership = (/** @type {any} */ entity) => rollMembershipsOf(entity).size > 0;

/** One move, said (npcChapterLaw.js rollMovesOf's `{ f, delta?, paid?, now, owed }` - both where both moved, II B-4). */
function standingItem(/** @type {any} */ entity, /** @type {{ f: number, delta?: number, paid?: number, now: number, owed: number }} */ c) {
  const args = { name: standingName(c.f), now: c.now, owed: c.owed, paid: c.paid ?? 0,
    delta: Number(c.delta) > 0 ? `+${c.delta}` : String(c.delta ?? 0) };
  if (c.delta && c.paid) {
    return c.owed > 0 ? t('chapters.standing.bothOwed', '{name} {delta}, and {paid} of what was owed arrived (now {now}, {owed} more to come)', args)
      : t('chapters.standing.both', '{name} {delta}, and {paid} of what was owed arrived (now {now})', args);
  }
  if (c.delta) {
    return c.owed > 0 ? t('chapters.standing.itemOwed', '{name} {delta} (now {now}, {owed} more to come)', args)
      : t('chapters.standing.item', '{name} {delta} (now {now})', args);
  }
  return c.owed > 0 ? t('chapters.standing.paidOwed', '{name}: {paid} of what was owed arrived (now {now}, {owed} more to come)', args)
    : t('chapters.standing.paid', '{name}: {paid} of what was owed arrived (now {now})', args);
}

/** THE STANDING'S LINE: one line for an adoption's moves - or null when nothing moved. The guilds the character belongs
 *  to are named; the rest are counted (AUDIT GUILD-WORDS L2-3: DFU's drift and REP4's recovery move every standing a
 *  point, and a line of twenty-two names said nothing). */
export function standingLine(/** @type {any} */ entity, /** @type {{ f: number, delta?: number, paid?: number, now: number, owed: number }[]} */ changes) {
  const moved = (changes ?? []).filter((c) => (Number.isSafeInteger(c?.delta) && c.delta !== 0) || (Number.isSafeInteger(c?.paid) && c.paid !== 0));
  if (!moved.length) return null;
  const mine = rollMembershipsOf(entity);
  const named = moved.filter((c) => mine.has(c.f)).map((c) => standingItem(entity, c));
  const others = moved.length - named.length;
  if (!named.length) return t('chapters.standing.othersOnly', 'Standing moved with {n, plural, one {# guild} other {# guilds}} you do not belong to.', { n: others });
  const list = others ? [...named, t('chapters.standing.others', '{n, plural, one {# other guild} other {# other guilds}}', { n: others })] : named;
  return t('chapters.standing.line', 'Standing: {list}', { list: listOf(list) });
}

/**
 * The tracker's doors the host spreads in: `entityOf()` the playing character, `say(text)` the host's chat notice (a
 * lazy door - world.js declares its chat below the tracker).
 * @param {{ entityOf: () => any, say: (text: string) => void }} o
 */
export function rollNoticeDoors({ entityOf, say }) {
  return {
    // CHAP4b: the book held at 7, said once a hold - and SEAT-WORDS: the Chapters page with it
    onCapped: (/** @type {number[]} */ factions) => {
      const line = bookCappedLine(factions);
      if (line) say(line);
      noteFirstUse('chapters');
    },
    onStanding: (/** @type {{ f: number, delta?: number, paid?: number, now: number, owed: number }[]} */ changes, /** @type {boolean} */ first) => {
      if (first && holdsRollMembership(entityOf())) noteFirstUse('chapters');
      const line = standingLine(entityOf(), changes);
      if (line) say(line);
    },
    // AUDIT CHAP D2's pace, said with what is owed - AUDIT GUILD-WORDS II B-3, C-4: only where the owed grew by the cut;
    // and a gain the most a standing holds turned away, said lost (the tracker's onFull). The name leads, as a label - the
    // port's names carry no article to bend in a sentence
    onCeiling: (/** @type {number[]} */ factions) => {
      for (const f of factions) {
        say(t('chapters.standing.ceiling', '{name}: quests cannot raise your standing any further today. {owed} more is owed and arrives over the coming days.',
          { name: standingName(f), owed: standingOwedOf(f) }));
      }
    },
    onFull: (/** @type {number[]} */ factions) => {
      for (const f of factions) {
        say(t('chapters.standing.full', '{name}: your standing and what is owed already reach {max}, so the rest of that reward is lost.',
          { name: standingName(f), max: MAX_REPUTATION }));
      }
    },
  };
}
