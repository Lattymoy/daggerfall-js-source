// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SIGIL1 (2026-09-25) — SOME WEAPONS WON ONLINE CARRY A SIGIL, AND IT GROWS.
//
// Mac: "weapons obtained through online play recieve a sort of sigil
// power that is only effective online, which also scales with your
// renown. Sigil power does not work offline. I want this system to
// really enhance the fantasy but not be insanely overpowered. This
// links up with both elements we have so far with scaling and renown".
// Asked, Mac answered: "Bonus damage"; "Magic and up, found online";
// "Bigger fights, stronger sigils"; "Five named stages". Then, of a
// sigil fixed at the drop ("Makes sigil a static element"): "What if
// the sigil is[n']t gaurenteed in of itself" - and chose "Chance at the
// drop, then grows".
//
// ═══ WHAT A SIGIL IS ═══════════════════════════════════════════════
//
// A record on the weapon, `item.sigil = { power, party, xp }`:
//   power - the per cent of damage it adds against a foe at its full
//           rank, rolled when the weapon is won;
//   party - the size of the fight that won it (1..8), for the tooltip;
//   xp    - what it has drunk: every point of Renown XP its wielder
//           earns with it in hand (a kill, a quest), so a bigger fight
//           (renownPartyXp's bonus) feeds it faster.
// Its RANK comes from its xp (Faint, Kindled, Bright, Radiant,
// Ascendant); what it gives is its power times the share of the LOWER
// of its rank and the stage its wielder's Renown has opened. A sigil
// keeps its xp when it changes hands; a new hand's Renown caps it.
//
// WHO GETS ONE - NOT EVERY WEAPON: a Magic, Rare or Legendary weapon
// (never ammunition, armour, jewellery or an artifact) won ONLINE - off
// a corpse when its foe dies, or out of a treasure pile when it is
// minted - carries one about one time in five, more in a bigger fight
// (lootRarity.js stampWonWeapons). Common weapons, shop stock, quest
// rewards and anything won offline never do; a weapon never gains a
// sigil after it is won, and never loses one.
//
// ═══ HOW STRONG ════════════════════════════════════════════════════
//
// THE BAND, per tier, per cent at full rank: Magic 2-5, Rare 4-8,
// Legendary 7-12 - under half of the tier's own damage affix (5-12,
// 10-25, 20-40), so a sigil flavours a weapon and never outclasses it.
//
// BIGGER FIGHTS, STRONGER SIGILS - the fight's weight is its foe's
// FIGHTERS (PSCALE1, systems/partyScale.js): the chance is
// SIGIL_CHANCE_BASE per mille alone and SIGIL_CHANCE_PER more a fighter
// past the first; the power's FLOOR rises a seventh of the band a
// fighter past the first, so a fight of eight always wins the top.
//
// THE STAGES, each a share of the power: Faint 20%, Kindled 40%, Bright
// 60%, Radiant 80%, Ascendant 100%. The sigil's own rank opens at
// 0 / 5,000 / 12,500 / 22,500 / 37,500 xp; the wielder's Renown opens
// the same five at 1 / 10 / 20 / 30 / 40.
//
// THE BLOW: the whole weapon blow (FormulaHelper's, after the strength
// and the material, before DFU's mod hook) times the per cent, its fraction carried
// per weapon so a Faint 2.4% still lands its share - on blows of ten, a
// point about every fourth blow. ONLINE ONLY: offline, and online before
// the page knows its Renown, every sigil is Dormant and adds nothing,
// and drinks nothing. FOES ONLY: never in a duel, never a blow at a
// player, never a peer's blow resolved here.
// ═══════════════════════════════════════════════════════════════════

import { PARTY_MAX } from '../net/wire.js';
import { registerWeaponBlowMod } from './entityMods.js';

/** The power band per tier, per cent at full rank: [min, max] inclusive. */
export const SIGIL_BANDS = Object.freeze({
  magic: Object.freeze([2, 5]),
  rare: Object.freeze([4, 8]),
  legendary: Object.freeze([7, 12]),
});
export const SIGIL_POWER_MAX = SIGIL_BANDS.legendary[1];

/** The chance a won weapon carries a sigil, per mille: alone, and more a fighter past the first. */
export const SIGIL_CHANCE_BASE = 200;
export const SIGIL_CHANCE_PER = 40;

/** The five stages: the xp the sigil's own rank opens each at, the Renown that opens it for the wielder, its name,
 *  the share of the power it wakes (per cent). */
export const SIGIL_STAGES = Object.freeze([
  Object.freeze({ xp: 0, renown: 1, name: 'Faint', share: 20 }),
  Object.freeze({ xp: 5000, renown: 10, name: 'Kindled', share: 40 }),
  Object.freeze({ xp: 12500, renown: 20, name: 'Bright', share: 60 }),
  Object.freeze({ xp: 22500, renown: 30, name: 'Radiant', share: 80 }),
  Object.freeze({ xp: 37500, renown: 40, name: 'Ascendant', share: 100 }),
]);
/** A sigil drinks no more than its last stage asks. */
export const SIGIL_XP_MAX = SIGIL_STAGES[SIGIL_STAGES.length - 1].xp;

const partyOf = (n) => (Number.isFinite(n) ? Math.max(1, Math.min(PARTY_MAX, Math.floor(n))) : 1);

/** A valid sigil record: a whole power inside the widest band, a whole party 1..PARTY_MAX, a whole xp 0..its cap. */
export function validSigil(s) {
  return !!s && typeof s === 'object' && !Array.isArray(s)
    && Number.isInteger(s.power) && s.power >= 1 && s.power <= SIGIL_POWER_MAX
    && Number.isInteger(s.party) && s.party >= 1 && s.party <= PARTY_MAX
    && Number.isInteger(s.xp) && s.xp >= 0 && s.xp <= SIGIL_XP_MAX;
}

/** The sigil's own rank (0..4) by its xp; 0 for a malformed record. */
export function sigilRank(sigil) {
  if (!validSigil(sigil)) return 0;
  let r = 0;
  for (let i = 0; i < SIGIL_STAGES.length; i++) if (sigil.xp >= SIGIL_STAGES[i].xp) r = i;
  return r;
}

/** The stage (0..4) a Renown opens, or -1 for no Renown (offline, or not yet known): Dormant. */
export function renownSigilStage(renown) {
  if (!Number.isSafeInteger(renown) || renown < 1) return -1;
  let r = 0;
  for (let i = 0; i < SIGIL_STAGES.length; i++) if (renown >= SIGIL_STAGES[i].renown) r = i;
  return r;
}

/** The stage a sigil stands at in a hand of this Renown: the lower of its rank and the Renown's, -1 dormant. */
export function sigilStageIn(sigil, renown) {
  if (!validSigil(sigil)) return -1;
  const cap = renownSigilStage(renown);
  return cap < 0 ? -1 : Math.min(sigilRank(sigil), cap);
}

/** The per cent a sigil adds in a hand of this Renown: its power times its stage's share, 0 dormant or malformed. */
export function sigilPercent(sigil, renown) {
  const st = sigilStageIn(sigil, renown);
  return st < 0 ? 0 : (sigil.power * SIGIL_STAGES[st].share) / 100;
}

/** The chance (per mille) a weapon won in a fight of `party` fighters carries a sigil. */
export const sigilChance = (party) => SIGIL_CHANCE_BASE + SIGIL_CHANCE_PER * (partyOf(party) - 1);

/** The floor of a tier's band for a fight of `party`: a seventh of the band a fighter past the first, rounded. */
export function sigilFloor(tier, party) {
  const band = SIGIL_BANDS[tier];
  if (!band) return 0;
  return Math.min(band[1], band[0] + Math.round(((band[1] - band[0]) * (partyOf(party) - 1)) / (PARTY_MAX - 1)));
}

/** Roll a won weapon's sigil for a tier and a fight: null most times; else a fresh record at Faint. */
export function rollSigil(tier, party, rolls = Math.random) {
  const band = SIGIL_BANDS[tier];
  if (!band) return null;
  if (rolls() * 1000 >= sigilChance(party)) return null;
  const lo = sigilFloor(tier, party), hi = band[1];
  return { power: lo + Math.floor(rolls() * (hi + 1 - lo)), party: partyOf(party), xp: 0 };
}

// ── the session: online, and the wielder's Renown ──────────────────
// Set by the world host (scenes/world.js): `online` for a session that plays online (a weapon won then is won
// online), the Renown the page knows (renownAdopt - the token's word and the service's since). Never saved.
let _online = false;
let _renown = null;
/** The host's word: this session plays online (stamps are minted) or not. */
export function setSigilOnline(on) { _online = !!on; if (!_online) _renown = null; }
/** The host's word: the Renown the wielder has, null while unknown. Offline it is always null. */
export function setSigilRenown(level) { _renown = _online && Number.isSafeInteger(level) && level >= 1 ? level : null; }
export const sigilOnline = () => _online;
export const sigilRenown = () => _renown;

/**
 * THE DRINK: the weapon in my hand drinks `xp`, the Renown XP I just earned with it (a kill, a quest) - online, my
 * Renown known, never past SIGIL_XP_MAX. A NEW record in place of the old, never the old one written: a save's or a
 * stream's copy of the item shares its fields (`{ ...it }`), and a copy taken before the drink keeps what it took.
 * Answers the rank the sigil rose to, else null.
 */
export function drinkSigil(item, xp) {
  if (_renown == null || !item || !validSigil(item.sigil) || !(xp > 0)) return null;
  const was = sigilRank(item.sigil);
  item.sigil = { ...item.sigil, xp: Math.min(SIGIL_XP_MAX, item.sigil.xp + Math.floor(xp)) };
  const now = sigilRank(item.sigil);
  return now > was ? now : null;
}

/** What the page says when a sigil in my hand rises to `rank`: its stage, and what my Renown holds it at when that is
 *  lower. `name` is the weapon's, as its tooltip reads it. */
export function sigilRiseLine(name, rank) {
  const stage = SIGIL_STAGES[rank];
  if (!stage) return null;
  const line = `The sigil on your ${name} brightens: ${stage.name}.`;
  const cap = renownSigilStage(_renown);
  if (cap < 0 || cap >= rank) return line;
  return `${line} Your Renown holds it at ${SIGIL_STAGES[cap].name} until Renown ${SIGIL_STAGES[cap + 1].renown}.`;
}

// ── the blow ───────────────────────────────────────────────────────
/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();
/**
 * THE BLOW (entityMods registerWeaponBlowMod, read at the tail of FormulaHelper's weapon damage): my weapon's sigil on
 * my blow at a foe, online - its per cent of the whole blow, the fraction carried on the weapon. Nothing for a duel (a
 * player on either end), a peer's blow resolved here, a hand without a sigil, or a session with no Renown.
 */
export function sigilBlow(weapon, damage, attacker, target) {
  if (!(damage > 0) || !weapon || !attacker?.isPlayer || attacker.peer || !target || target.isPlayer) return damage;
  const pct = sigilPercent(weapon.sigil, _renown);
  if (!(pct > 0)) return damage;
  const exact = (damage * pct) / 100 + (_carry.get(weapon) ?? 0);
  const more = Math.floor(exact + 1e-9);
  _carry.set(weapon, Math.max(0, exact - more));
  return damage + more;
}
registerWeaponBlowMod('sigil', sigilBlow);

// ── the words ──────────────────────────────────────────────────────
const pctText = (p) => (Number.isInteger(p) ? `${p}` : p.toFixed(1));
/**
 * The lines a tooltip or a card shows for a weapon's sigil, under its tier and affixes: what it gives in MY hand now
 * (online), or that it sleeps (offline); then how far it has grown, and what holds it. Empty for a weapon without one.
 */
export function sigilLines(item) {
  const s = item?.sigil;
  if (!validSigil(s)) return [];
  const rank = sigilRank(s);
  const full = `+${s.power}% at Ascendant`;
  if (_renown == null) return [`Sigil (Dormant - wakes online, with your Renown): ${full}`];
  const st = sigilStageIn(s, _renown);
  const out = [`Sigil (${SIGIL_STAGES[st].name}): +${pctText(sigilPercent(s, _renown))}% damage, ${full}`];
  const next = SIGIL_STAGES[rank + 1];
  if (rank > st) out.push(`Held at ${SIGIL_STAGES[st].name} by your Renown (${SIGIL_STAGES[st + 1].name} at Renown ${SIGIL_STAGES[st + 1].renown})`);
  else if (next) out.push(`${SIGIL_STAGES[rank].name}: ${s.xp.toLocaleString('en-US')} / ${next.xp.toLocaleString('en-US')} to ${next.name}`);
  if (s.party > 1) out.push(`Won in a fight of ${s.party}`);
  return out;
}

/**
 * SIGIL-UI (2026-09-26, Mac: "sigil weapons need a visible indicator within the info section, something that makes it
 * stand out, along with progress as you use it"): the same facts sigilLines says, as a MODEL a card draws - the
 * stage it stands at in my hand, the five stages with the ones it has grown into, and how far it has drunk toward
 * its next. `rank` is the sigil's own growth (its xp's stage); `stage` is what my Renown lets it wake to (-1 while
 * Dormant); `held` says the Renown is the lower. `frac` is the share of the way from its rank's xp to the next one's
 * (1 at Ascendant). Null for a weapon without a sigil.
 * @returns {null | { rank: number, stage: number, dormant: boolean, held: boolean, name: string, pct: number,
 *   full: number, xp: number, from: number, to: number|null, next: string|null, frac: number, party: number,
 *   unlock: number|null, stages: Array<{ name: string, grown: boolean, awake: boolean }> }}
 */
export function sigilView(item) {
  const s = item?.sigil;
  if (!validSigil(s)) return null;
  const rank = sigilRank(s);
  const stage = sigilStageIn(s, _renown);
  const dormant = stage < 0;
  const next = SIGIL_STAGES[rank + 1] ?? null;
  const from = SIGIL_STAGES[rank].xp;
  const held = !dormant && rank > stage;
  return {
    rank, stage, dormant, held,
    name: dormant ? 'Dormant' : SIGIL_STAGES[stage].name,
    pct: sigilPercent(s, _renown), full: s.power,
    xp: s.xp, from, to: next ? next.xp : null, next: next ? next.name : null,
    frac: next ? Math.max(0, Math.min(1, (s.xp - from) / (next.xp - from))) : 1,
    party: s.party,
    unlock: held ? SIGIL_STAGES[stage + 1].renown : null,   // the Renown that opens its next stage in my hand
    stages: SIGIL_STAGES.map((st, i) => ({ name: st.name, grown: i <= rank, awake: !dormant && i <= stage })),
  };
}
/** The progress line a card writes under its bar: "7,420 / 12,500 to Bright", or that it is fully grown. */
export function sigilProgressText(v) {
  if (!v) return '';
  if (v.to == null) return 'Fully grown';
  return `${v.xp.toLocaleString('en-US')} / ${v.to.toLocaleString('en-US')} to ${v.next}`;
}

/** Tests only: forget the session and every weapon's carried fraction. */
export function _resetSigilForTests() { _online = false; _renown = null; _carry = new WeakMap(); }
