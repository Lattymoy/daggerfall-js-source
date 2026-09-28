// @ts-check
// ALLY-CAST (2026-09-23, Mac: "Can we implement the use of spells on players? For example healing and other buffs?
// ... some sort of ally targeting system") - A SPELL CAST ON A PARTY MATE.
//
// DFU has no other players, so its five target types (spellcast.js TARGET_TYPES) only ever land on the caster, a
// foe or nothing. The port's law online is that a player's vitals and live effects are THEIR OWN client's: nothing
// on the caster's side writes another player's health. So a cast on an ally is a FRAME - `{t:'cast', data:{to,
// level, spell}}`, directed like a trade frame (net/wire.js validCastData, the relay's cast arm) - and the target's
// own client applies the spell record with its own applySpell, at the caster's level, exactly as it applies a foe's
// cast at it (scenes/hostMagic.js applySpellToPlayer).
//
// THE TARGETING (the port's own rule, a recorded departure): the player does not aim a slow missile at a moving
// friend. When the release frame finds a PARTY MATE under the crosshair - within touch reach for a CasterOnly or a
// ByTouch spell, within ALLY_RANGE_REACH for a SingleTargetAtRange one - and every effect the spell carries is one
// of the BENEFICIAL families below, the cast goes to them instead of to the caster, the foe or the missile. A
// CasterOnly Heal read off the crosshair becomes a touch on the ally: DFU's spellbook is almost all CasterOnly, and
// kept 1:1 healing a friend would mean buying a ByTouch copy first. Area spells are untouched.
//
// THE TRUST: the RECEIVER decides. It applies the beneficial subset of what arrived from a party member (a party is
// invite-only), and - SPELL-GIFT, 2026-09-27 - the stranger's list alone from anyone else, while the receiver's
// "Spells from strangers" switch is on (STRANGER_CAST_TYPES below). A crafted frame carrying Damage Health or Paralyze
// lands nothing from anyone. So friendly fire is off by construction, and the relay never has to judge a spell.
import { MAX_EFFECTS_PER_SPELL, SPELL_ICON_COUNT } from './spellMaker.js';
import { TOUCH_RANGE, TOUCH_SPHERE_CAST_RADIUS } from './spellcast.js';
import { CAST_LEVEL_MAX } from '../net/wire.js';   // PEER-CAST: the frame's level bound, clamped to at the sender

/** A person's controller radius (scenes/townTalk.js PERSON_HIT_RADIUS, MobilePersonNPC's) - the lateral band the
 *  ray must pass within to be "on" someone; written here so systems/ does not import a scene. */
export const PERSON_RADIUS = 0.45;
/** How near a party mate must stand for a CasterOnly or ByTouch cast to land on them: THE FOE'S OWN TOUCH REACH -
 *  DaggerfallMissile's 0.25 sphere pushed 3.0 along the aim (spellcast.js TOUCH_RANGE/TOUCH_SPHERE_CAST_RADIUS), plus
 *  the person's radius, since the ray distance is measured to their axis. AUDIT ALLY-CAST A4: the first cut used
 *  the F key's 6.4 m, more than double what a touch on a foe reaches, so a "touch" on a friend was a shout. */
export const ALLY_TOUCH_REACH = TOUCH_RANGE + TOUCH_SPHERE_CAST_RADIUS + PERSON_RADIUS;
/** ...and for a SingleTargetAtRange cast: the missile would have flown, so the reach is a missile's honest range at
 *  which a player can still tell who they are aiming at - 24 scene units (metres). */
export const ALLY_RANGE_REACH = 24;

/** The BENEFICIAL effect families, by DFU's classic `type,subType` key (spellEffects.js ROWS/FAMILIES): what a
 *  party mate may put on you. Cure (3), Elemental Resistance (8), Fortify Attribute (9), Heal (10, the eight stats
 *  and Health/Fatigue), Invisibility (13), Levitate (14), Light (15), Regenerate (18), Spell Absorption (20), Spell
 *  Reflection (21), Spell Resistance (22), Chameleon (23), Shadow (24), Slowfall (25), Free Action (26), Jumping
 *  (27), Climbing (28), Water Breathing (30), Water Walking (31), Shield (35), Detect (39), Comprehend Languages
 *  (44). NOT here, deliberately: Paralyze, Continuous Damage, Damage, Disintegrate, Drain, Transfer (it drains the
 *  target to heal the caster), Soul Trap, Silence, Lock/Open, Pacify/Charm, Dispel (a mate stripping your buffs),
 *  Create Item, Identify, Teleport, Morph Self. */
export const ALLY_CAST_TYPES = Object.freeze(new Set([3, 8, 9, 10, 13, 14, 15, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 35, 39, 44]));

/** An effect entry that is one of the beneficial families (an empty slot, type -1, is neither). */
export const allyEffect = (e) => !!e && Number.isInteger(e.type) && e.type >= 0 && ALLY_CAST_TYPES.has(e.type);

/** Whether a spell may be cast on an ally at all: it carries at least one real effect and EVERY real effect is
 *  beneficial - a Heal + Damage Health spell is not a gift, and goes the ordinary way. */
export function allyCastable(spell) {
  const fx = Array.isArray(spell?.effects) ? spell.effects.filter((e) => e && Number.isInteger(e.type) && e.type >= 0) : [];
  return fx.length > 0 && fx.every(allyEffect);
}

/** SPELL-GIFT (2026-09-27, Discord - Tabitha, a cleric: "a LARGE amount of buffs & spells just don't work when cast on
 *  another person, even with touch. Normal regen seems okay, but Regen + Anything, Fortify Attributes, etc."). A
 *  CASTERONLY GIFT ARMS WHILE A MATE STANDS NEAR. Most of the buffs a healer casts are CasterOnly - DFU's spellbook
 *  is, and the spell maker snaps a spell to CasterOnly the moment it holds one self-only effect (Light, Levitate,
 *  Slowfall, Detect: spellMaker.js enforceSelected), so "Regen + anything" usually is one. A1 armed such a spell for
 *  a mate only when the mate was ALREADY under the crosshair at the moment it was readied; readied first and aimed
 *  after - the way anyone casts - it had gone off on the caster before they turned round, and the click on the friend
 *  cast nothing. Now a mate within this radius of the caster at the ready arms it: the click goes to the mate under
 *  the crosshair, or - aimed anywhere else - to the caster, as CasterOnly always does. With nobody near it still
 *  fires on the spot, DFU's own instant cast. */
export const ALLY_ARM_RADIUS = 10;
/** ...and what the armed ready says under DFU's own "Press button to fire spell." - where the click will land. */
export const ALLY_ARMED_LINE = 'Aim at a party member to cast it on them, or anywhere else to cast it on yourself.';

/** SPELL-GIFT (Tabitha: "Allow casting of buffs on players outside party ... Many spells should be blacklisted [Spells
 *  that can be considered annoyances like levitate reducing movespeed, etc.]", with her INITIAL PLAYER2PLAYER SPELL
 *  WHITELIST/BLACKLIST). THE STRANGER'S LIST: what may be cast on a player OUTSIDE the party - her safe list, word for
 *  word: Heal (10), Regenerate (18), Spell Absorption (20), Cure Disease, Poison and Paralyzation (3), Fortify
 *  Attribute, all eight (9), Shield (35), Elemental Resistance (8 - her Fire, Frost, Shock and Poison, and Magicka
 *  with them: the family is one effect), Jumping (27), Water Breathing (30). Everything else a party mate may give
 *  stays a party's - her unsafe Slowfall (25), Levitate (14, her annoyance), and the concealments, lights and
 *  walking effects nobody asked a stranger for. Paralyze was never a gift at all. The receiver applies only these from
 *  a stranger, and only while their "Spells from strangers" switch is on (uiPrefs acceptStrangerSpells). */
export const STRANGER_CAST_TYPES = Object.freeze(new Set([3, 8, 9, 10, 18, 20, 27, 30, 35]));
export const strangerEffect = (e) => allyEffect(e) && STRANGER_CAST_TYPES.has(e.type);
/** Whether a spell may be cast on a stranger: EVERY real effect is on the stranger's list, as allyCastable asks of
 *  the party's. */
export function strangerCastable(spell) {
  const fx = Array.isArray(spell?.effects) ? spell.effects.filter((e) => e && Number.isInteger(e.type) && e.type >= 0) : [];
  return fx.length > 0 && fx.every(strangerEffect);
}

/** The record the RECEIVER applies: the wire's projection of what arrived (net/wire.js validCastData - shape and
 *  bounds), reduced to its beneficial effects. Null when nothing beneficial is left, so a crafted frame applies
 *  nothing.
 *
 *  AUDIT ALLY-CAST C1: THE GIFT LANDS AS A SELF-CAST (rangeType 0), whatever was sent. DFU save-scales every
 *  bundle that is not CasterOnly (EntityEffect.cs GetMagnitude) and drops a no-magnitude one on a full save,
 *  because in DFU only a foe ever receives an external bundle; carried as a touch, a friend's Heal landed ZERO on a
 *  third of casts (two thirds for a Breton, three quarters under Resist Magic), a Levitate was "Save versus spell
 *  made.", and the caster had paid. And the sender chose it: a crafted rangeType 0 skipped the save the honest
 *  frame took. Now the receiver decides that too. The icon rides so the HUD's row can show it. */
export function allyCastSpell(d, { stranger = false } = {}) {
  if (!d || !Array.isArray(d.effects)) return null;
  const effects = d.effects.filter(stranger ? strangerEffect : allyEffect).slice(0, MAX_EFFECTS_PER_SPELL);   // SPELL-GIFT: a stranger's cast keeps the stranger's list alone
  if (!effects.length) return null;
  const icon = Number.isInteger(d.icon) && d.icon >= 0 && d.icon < SPELL_ICON_COUNT ? d.icon : 0;
  return { name: typeof d.name === 'string' ? d.name : '', element: d.element ?? 4, rangeType: 0, effects, icon, index: -1, custom: true };
}

/** The reach a cast on an ally is looked for at, by the spell's range type - null for the two area types and any
 *  unknown one (they are never redirected). */
export function allyReachFor(rangeType) {
  if (rangeType === 0 || rangeType === 1) return ALLY_TOUCH_REACH;
  if (rangeType === 2) return ALLY_RANGE_REACH;
  return null;
}

/** The frame the caster sends: the spell's REAL effects, the caster's level, the target. A CasterOnly spell goes
 *  out as a touch (rangeType 1) - it is one, on the ally.
 *
 *  PEER-CAST (2026-09-27, Discord: "we both are high level (My character is at lvl 34) and that is when i notice can't
 *  cast beneficial spell on others"). The level is CLAMPED to the frame's bound (net/wire.js CAST_LEVEL_MAX) - the
 *  duel's law, "the sender clamps, so an honest frame is never refused". Unclamped, a caster past level 30 minted a
 *  frame every door refuses - the caster's own (online.js sendCast), the relay's (which closes the socket) and the
 *  target's - so their gift never left and a CasterOnly heal fell back onto the caster. The port caps no level
 *  (FormulaHelper.CalculateCasterLevel is `caster.Level`, EntityEffect.cs:742-929 scale by it), so a caster past 30
 *  casts on a mate AT 30 (06-Systems/Online-Arc.md PEER-CAST - DFU has no cast on another player to be 1:1 with). */
export function allyCastFrame(spell, level, to) {
  return {
    to,
    level: Math.min(CAST_LEVEL_MAX, Math.max(1, Math.trunc(Number(level) || 1))),
    spell: {
      name: String(spell?.name ?? ''),
      element: spell?.element ?? 4,
      rangeType: spell?.rangeType === 2 ? 2 : 1,
      icon: Number.isInteger(spell?.icon) && spell.icon >= 0 && spell.icon < SPELL_ICON_COUNT ? spell.icon : 0,
      effects: (Array.isArray(spell?.effects) ? spell.effects : []).filter((e) => e && Number.isInteger(e.type) && e.type >= 0).slice(0, MAX_EFFECTS_PER_SPELL),
    },
  };
}

/** The two lines the players read: the caster's, and the target's. */
export const allyCastCasterLine = (spellName, who) => `You cast ${spellName || 'a spell'} on ${who}.`;
/** SPELL-GIFT: one line for a gift that reached several - an area cast said a line per mate. */
export function allyCastCasterLineMany(spellName, names) {
  const list = [...new Set((names ?? []).filter(Boolean))];
  if (!list.length) return null;
  const who = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  return allyCastCasterLine(spellName, who);
}
export const allyCastTargetLine = (who, spellName) => `${who} casts ${spellName || 'a spell'} on you.`;
/** The plaque's line under a party mate while a castable spell is readied. */
export const allyCastPlaqueLine = (spellName, who) => `Cast ${spellName || 'the spell'} on ${who}`;
