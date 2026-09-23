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
// THE TRUST: the RECEIVER decides. It applies a cast from a party member alone (a party is invite-only), and only
// the beneficial subset of what arrived - a crafted frame carrying Damage Health or Paralyze lands nothing. So
// friendly fire is off by construction, and the relay never has to judge a spell.
import { MAX_EFFECTS_PER_SPELL, SPELL_ICON_COUNT } from './spellMaker.js';
import { TOUCH_RANGE, TOUCH_SPHERE_CAST_RADIUS } from './spellcast.js';

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
export function allyCastSpell(d) {
  if (!d || !Array.isArray(d.effects)) return null;
  const effects = d.effects.filter(allyEffect).slice(0, MAX_EFFECTS_PER_SPELL);
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
 *  out as a touch (rangeType 1) - it is one, on the ally. */
export function allyCastFrame(spell, level, to) {
  return {
    to,
    level: Math.max(1, Math.trunc(Number(level) || 1)),
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
export const allyCastTargetLine = (who, spellName) => `${who} casts ${spellName || 'a spell'} on you.`;
/** The plaque's line under a party mate while a castable spell is readied. */
export const allyCastPlaqueLine = (spellName, who) => `Cast ${spellName || 'the spell'} on ${who}`;
