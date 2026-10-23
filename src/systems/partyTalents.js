// @ts-check
// DEEDS2 (2026-10-23, the owner: "Giving more online functionality to minor skills"; asked, the owner chose party
// utility; bible/06-Systems/Deeds-And-Talents.md section 5): MINOR SKILLS SERVE THE PARTY.
//
// A member's party pose carries its live talents (`tk`, net/wire.js validPartyPose): Medical, Stealth, Etiquette,
// Streetwise and the nine tongues, in TALENT_SKILLS' order. Each frame the host hands this module its party's members,
// where I stand (my pose's own place) and its distance law (scenes/world.js distanceToPartyAccount, a body this client
// draws), and the module keeps the talents of every member NEAR me - the same place, within TALENT_REACH metres. Every
// read below is the best of mine and theirs, with Deeds and Talents in force (talents.js); solo it is my own, so a
// player with no party still gets the care and the good word of their own skills.
//
// WHAT EACH ONE DOES:
//   Medical    - care: out of a fight, 1% of maximum health every CARE_PER_ROUNDS game minutes for every
//                CARE_PER_POINTS of the best Medical near; and revival (resurrect.js rezHealthPct).
//   Stealth    - cover: my foes' senses read the better of my Stealth and three quarters of the best near.
//   The tongues, Etiquette, Streetwise - the first-meeting calm roll takes the best near speaker's skill.
//   Etiquette, Streetwise - the good word: a tenth of the best near is added to Personality in every haggle (inside
//                the online haggle's own ceiling, shopStock.js ONLINE_HAGGLE_MAX) and as a percent to a quest's gold.
//
// Not a DFU member: Daggerfall Unity has no party. Port-Ledger A (DEEDS).
import { SKILLS, skillValue } from './skills.js';
import { liveStat } from './statMods.js';
import { talentsInForce } from './talents.js';
import { regenBarred } from './courtRules.js';   // WBX6: the Burning Court keeps no regeneration, and no care
import { PARTY_TALENT_MAX } from '../net/wire.js';
import { t } from './textManager.js';   // L10N4: the good word's line in the player's language   // the pose's own bound - one home, the wire's

/** The skills a party pose carries, in its order (the wire's `tk`). Medical stands first: resurrect.js reads it. */
export const TALENT_SKILLS = Object.freeze([
  SKILLS.Medical, SKILLS.Stealth, SKILLS.Etiquette, SKILLS.Streetwise,
  SKILLS.Orcish, SKILLS.Harpy, SKILLS.Giantish, SKILLS.Dragonish, SKILLS.Nymph,
  SKILLS.Daedric, SKILLS.Spriggan, SKILLS.Centaurian, SKILLS.Impish,
]);
export const TALENT_POSE_LEN = TALENT_SKILLS.length;
/** A talent's ceiling on the wire (net/wire.js PARTY_TALENT_MAX): a mastered skill's (skillSoftcap.js SKILL_HARD_CAP). */
export const TALENT_MAX = PARTY_TALENT_MAX;
/** How near a member stands to lend a talent, in metres - a room, a camp, a fight. */
export const TALENT_REACH = 40;
/** The share of the best near Stealth that covers me. */
export const STEALTH_COVER = 0.75;
/** Care: 1% of maximum health a pulse for every CARE_PER_POINTS of Medical, a pulse every CARE_PER_ROUNDS minutes
 *  (Regenerate's own cadence, passiveSpecials.js), never within CARE_CALM_MS of a hurt. */
export const CARE_PER_POINTS = 50;
export const CARE_PER_ROUNDS = 4;
export const CARE_CALM_MS = 15_000;
/** The good word: a tenth of the best Etiquette or Streetwise. */
export const WORD_DIVISOR = 10;

/** PARTY-REST1's law of the same place, the pose's own terms (moved here from scenes/world.js, its one home now): the
 *  same map pixel, the same kind of place, and inside, the same building. */
export const samePartyPlace = (a, b) => !!(a && b && a.px === b.px && a.py === b.py && a.in === b.in && (a.in !== 2 || a.bk === b.bk));

/** My talents for the party pose: thirteen whole numbers, 0 to TALENT_MAX. */
export function talentPose(entity) {
  return TALENT_SKILLS.map((id) => Math.min(TALENT_MAX, Math.max(0, Math.trunc(skillValue(entity, id) || 0))));
}

let _near = /** @type {number[][]} */ ([]);
/**
 * The host's frame: the talents of every member near me, kept until the next frame.
 * @param {any[]} members    the party's other members (social.others(): { acct, online, p })
 * @param {any} here         my place in the pose's terms (world.js myPartyLocation)
 * @param {(acct: any) => number} distance  metres to a member's body this client draws, Infinity for none
 */
export function partyTalentsFrame(members, here, distance) {
  const out = [];
  for (const m of members ?? []) {
    const tk = m?.p?.tk;
    if (m?.online === false || !Array.isArray(tk) || tk.length !== TALENT_POSE_LEN || !samePartyPlace(here, m.p)) continue;
    if (!(m.p.h > 0)) continue;   // AUDIT DEEDS C3: a fallen member's body is drawn, and lends nothing
    let d = Infinity;
    try { d = Number(distance?.(m.acct)); } catch { /* no body drawn: too far, not an error */ }
    if (d <= TALENT_REACH) out.push(tk);
  }
  _near = out;
}
/** The near members' talents (the test seam sets them; the host's frame is the one writer in play). */
export const nearTalents = () => _near;
export function _setNearTalents(list) { _near = Array.isArray(list) ? list : []; }

/** AUDIT DEEDS C2: my own skill as a talent - held to the pose's ceiling, as a member's lent one is, so worn Enhances
 *  Skill gear cannot lift the good word or the care past what the record promises (+20% at 200). */
const ownTalent = (entity, skillId) => Math.min(TALENT_MAX, Math.max(0, skillValue(entity, skillId) || 0));
const bestNear = (skillId) => {
  const i = TALENT_SKILLS.indexOf(skillId);
  let best = 0;
  if (i >= 0) for (const tk of _near) if (tk[i] > best) best = tk[i];
  return best;
};

/** A skill as the party lends it: my own, or the best near (three quarters of it for Stealth) when that is more. */
export function partySkill(entity, skillId) {
  const own = skillValue(entity, skillId);
  if (!entity?.isPlayer || !talentsInForce(entity)) return own;
  const best = bestNear(skillId);
  return Math.max(own, skillId === SKILLS.Stealth ? Math.trunc(best * STEALTH_COVER) : best);
}

// ── care ───────────────────────────────────────────────────────────

let _lastHurt = -Infinity;
/** A hurt came at me (characters/playerEntity.js's door-open word - told on every call, a duel's and a bout's spared
 *  blows too: AUDIT DEEDS C1): care waits CARE_CALM_MS. */
export function notePlayerHurt(now = Date.now()) { _lastHurt = now; }
let _fighting = () => false;
/** AUDIT DEEDS C1: the host's word that I am in a refereed fight (an arena bout, a duel) - no care there at all, as no
 *  potion is drunk on the sand. */
export function setCareBarred(fn) { _fighting = typeof fn === 'function' ? fn : () => false; }

/** The health a care pulse gives me now - 0 in a fight, at full health, dead, barred, or with no Medical near. */
export function careAmount(entity, now = Date.now()) {
  if (!entity?.isPlayer || !talentsInForce(entity) || now - _lastHurt < CARE_CALM_MS || regenBarred()) return 0;
  try { if (_fighting()) return 0; } catch { /* no host's word: no fight */ }
  const health = entity.health ?? 0, max = entity.maxHealth ?? 0;
  if (!(health > 0) || !(health < max)) return 0;
  const pct = Math.trunc(Math.max(ownTalent(entity, SKILLS.Medical), bestNear(SKILLS.Medical)) / CARE_PER_POINTS);
  return pct > 0 ? Math.max(1, Math.round((max * pct) / 100)) : 0;
}
/** The magic round's care (worldTick.js registerMagicRoundHook): a pulse every CARE_PER_ROUNDS rounds. */
export function careRound(entity, { nowMinutes = 0, sinks = null } = {}) {
  if (nowMinutes % CARE_PER_ROUNDS !== 0) return;
  const n = careAmount(entity);
  if (n > 0) sinks?.heal?.(n);
}

// ── the good word ──────────────────────────────────────────────────

/** A tenth of the best Etiquette or Streetwise, mine or a near member's - 0 out of force. */
export function partyWord(entity) {
  if (!talentsInForce(entity)) return 0;
  const best = Math.max(ownTalent(entity, SKILLS.Etiquette), ownTalent(entity, SKILLS.Streetwise),
    bestNear(SKILLS.Etiquette), bestNear(SKILLS.Streetwise));
  return Math.trunc(best / WORD_DIVISOR);
}

/** THE HAGGLE'S ONE DOOR: the skills every price is haggled with (shopStock.js calculateTradePrice) - live Mercantile,
 *  live Personality (50 before chargen) and the party's good word on it. */
export function haggleOf(entity) {
  return {
    mercantile: skillValue(entity, SKILLS.Mercantile),
    personality: (entity?.stats?.personality == null ? 50 : liveStat(entity, 'personality')) + partyWord(entity),
  };
}

/** A quest's gold raised by the good word, a percent a point (quest/actions.js GivePc, before the questline's scale and
 *  the party's split). `entity` is the quest machine's player (its hooks.playerEntity) - this module never reaches for
 *  the client's singleton, so the account Worker that bundles it carries none. Answers the gold added. */
export function rewardGold(quest, dfItem, entity = quest?.hooks?.playerEntity?.() ?? null) {
  const pct = partyWord(entity);
  const gold = dfItem?.stackCount ?? 0;
  const more = pct > 0 && gold > 0 ? Math.trunc((gold * pct) / 100) : 0;
  if (more <= 0) return 0;
  dfItem.stackCount = gold + more;
  quest?.hooks?.addHUDText?.(t('party.goodWord.gold', 'A good word for you adds {gold} gold to the reward.', { gold: more }));
  return more;
}
