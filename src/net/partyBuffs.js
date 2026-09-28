// @ts-check
// PARTY-BUFFS (2026-09-27, Discord - Tabitha, playing paladins, clerics and mages: "Allow us to see buff timers or SOME
// sort of indicator that we have placed a buff on a party teammate [preferably on their party portrait, maybe?] ...
// the feedback for buffing other players is non-existent ... I'd also like floating Heal numbers").
//
// A PARTY MATE'S EFFECTS ARE THEIRS TO SAY. Nothing on my side knows what a gift did once it left (the receiver's
// client applies it - ALLY-CAST), so each member's party pose carries its OWN live spell effects the way its own HUD
// rows them - the spell's icon, the rounds left, the name, and whether it sits in the debuff row - and every other
// member's card draws them under the bars (ui/partyPanel.js). A buff I placed shows on the friend's portrait the
// moment their next pose lands, counts down with their own clock, and goes when it ends there - whoever cast it, and
// whatever the spell (area and touch alike). A curse or a disease shows too, outlined, which is what a healer in the
// party wants to see before they cure it. A held magic item's constant effects are the item's, not a cast, and stay
// off the card.
//
// The pose's bounds are net/wire.js validPartyPose's (PARTY_FX_MAX entries, a name of PARTY_FX_NAME_MAX, rounds to
// PARTY_FX_ROUNDS_MAX); this module composes within them so an honest pose is never trimmed by the wire.
import { liveBundles } from '../systems/mysticism.js';
import { PARTY_FX_MAX, PARTY_FX_NAME_MAX, PARTY_FX_ROUNDS_MAX, CAST_ICON_MAX } from './wire.js';

/** My live spell effects for the party pose: the buffs first (my own casts and other players' gifts - the HUD's buff
 *  row), then the debuffs (`d: 1`), each {i, r, n}; a held item's bundle is skipped, and the whole capped at
 *  PARTY_FX_MAX. Rounds are the bundle's MOST (a spell's icon belongs to the whole cast - GetMaxRoundsRemaining). */
export function composePartyFx(entity) {
  const buffs = [], debuffs = [];
  for (const b of liveBundles(entity)) {
    if (!b.showIcon || b.bundleType === 'HeldMagicItem') continue;
    const most = (b.entries ?? []).reduce((m, e) => Math.max(m, Number(e.roundsRemaining) || 0), 0);
    const r = Math.max(0, Math.min(PARTY_FX_ROUNDS_MAX, Math.round(most)));
    const i = Number.isInteger(b.icon) && b.icon >= 0 && b.icon <= CAST_ICON_MAX ? b.icon : 0;
    const n = String(b.name ?? '').replace(/^!+/, '').slice(0, PARTY_FX_NAME_MAX);
    if (b.selfCast || b.ally) buffs.push({ i, r, n });
    else debuffs.push({ i, r, n, d: 1 });
  }
  return [...buffs, ...debuffs].slice(0, PARTY_FX_MAX);
}

/** The one string a card compares to know whether its effects row must be rewritten. */
export const partyFxKey = (fx) => (Array.isArray(fx) ? fx.map((e) => `${e.i}:${e.r}:${e.d ? 1 : 0}:${e.n}`).join('|') : '');

/** An effect's words on the card when its icon art is not in hand: the first letters of its name's words, at most
 *  three ("Regenerate" -> "Reg", "Fortify Strength" -> "FS"). */
export function partyFxAbbrev(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 3);
  return words.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
}

/** The heal a card floats: the health a member GAINED between two of their poses - not while they rest (a night's
 *  hourly climb is no heal anyone cast: `rs`, their own rest or one they follow, and `rest`, a leader's session), not
 *  on a first pose, not a rise from death (the rise says itself), never a loss. */
export function partyHealOf(prevH, pose) {
  const h = Number(pose?.h);
  if (!Number.isFinite(h) || prevH == null || !Number.isFinite(prevH) || prevH <= 0 || pose?.rest || pose?.rs) return 0;
  return h > prevH ? Math.round(h - prevH) : 0;
}
