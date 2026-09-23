// @ts-check
// INSPECT1 (2026-09-23, the community arc - kurkku: "a profile page that you can bring up when you're near them"; Mac:
// "a new enhanced UI element for the player inspect interaction. Showing their glyph, name, title, stats and worn
// gear"): THE CARD A PLAYER HANDS OVER WHEN ASKED, and the law of when they hand it.
//
// WHAT IS ON IT is what their own character sheet shows, read by the producers that sheet reads
// (ui/enhancedCharSheet.js sheetModel): the level, the eight attributes by liveStat over STAT_KEYS_ORDER, and the three
// vitals' maxima - health, fatigue at the sheet's /64 display figure, magicka. And the look they wear NOW
// (net/remotePlayers.js composeLook): the room's copy rode their last hello, and a player who changed their armour in
// this room still wore the old one there. It leaves through the wire's own projection (validCard), so what is sent is
// exactly what the relay passes and the asker reads.
//
// WHAT IS NOT ON IT: the name, the title and the glyphs. Those are the relay's word, read off the signed identity token
// (net/wire.js badged) that the whole room already has - a card that carried them could claim a title nobody granted.
// Nothing on the card is vouched for: it is the answering player's own word about their own character, drawn as theirs.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { liveStat, maxFatigue, FATIGUE_MULTIPLIER } from '../systems/statMods.js';
import { composeLook } from './remotePlayers.js';
import { validCard, CARD_LEVEL_MAX, CARD_STAT_MAX, CARD_VITAL_MAX } from './wire.js';

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number.isFinite(v) ? v : lo)));

/** My card, from my entity - null only for an entity the wire could not carry. */
export function composeCard(entity) {
  const e = entity ?? {};
  return validCard({
    level: clampInt(e.level ?? 1, 1, CARD_LEVEL_MAX),
    attrs: STAT_KEYS_ORDER.map((k) => clampInt(liveStat(e, k), 0, CARD_STAT_MAX)),
    vitals: [
      clampInt(e.maxHealth ?? 0, 0, CARD_VITAL_MAX),
      clampInt(maxFatigue(e) / FATIGUE_MULTIPLIER, 0, CARD_VITAL_MAX),
      clampInt(e.maxMagicka ?? 0, 0, CARD_VITAL_MAX),
    ],
    look: composeLook(e),
  });
}

/** How long an asker waits before the profile says no answer came and draws what the room already knows. A card is one
 *  frame each way through one relay: a second is a slow one, and three is a player who is not answering. */
export const CARD_WAIT_MS = 3000;
/** How often one asker is answered. The relay's funnel and my own card gate bound the rate a socket can be asked at;
 *  this bounds what one asker can make me SEND - a stranger asking over and over is answered once in a while, and a
 *  friend who closes and opens my card inside it is told again soon enough. */
export const CARD_ANSWER_MS = 2000;
/** The askers remembered at once - the stalest forgotten first. */
export const CARD_ANSWER_ASKERS_MAX = 64;

/** The answering law: `pass(askerId, now)` - true when this asker may be answered now (and it counts as answered). */
export function createCardAnswerGate({ intervalMs = CARD_ANSWER_MS, max = CARD_ANSWER_ASKERS_MAX } = {}) {
  const last = new Map();   // asker -> when they were last answered; insertion order is age order
  return {
    pass(askerId, now) {
      if (typeof askerId !== 'string' || !askerId || !Number.isFinite(now)) return false;
      const at = last.get(askerId);
      if (at != null && now - at < intervalMs) return false;
      last.delete(askerId);
      if (last.size >= max) last.delete(last.keys().next().value);   // the stalest asker makes room
      last.set(askerId, now);
      return true;
    },
    /** For tests: how many askers are remembered. */
    size: () => last.size,
  };
}
