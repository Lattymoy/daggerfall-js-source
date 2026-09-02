// MYSTICISM - the effect library's one entirely empty school, all ten
// effects. 1:1 from Daggerfall Unity's Effects/Mysticism/*.cs (MIT,
// Daggerfall Workshop). Unity plumbing dropped; the laws kept.
//
// The other five schools were 96%, 80%, 75%, 50% and 22% ported when
// this landed; Mysticism was 0/10, because its effects do not fit the
// "roll a magnitude and apply it" shape the library grew around. Not
// one of the ten supports MAGNITUDE. They open doors, destroy nearby
// enemies, gag a caster, fill a soul gem - each is its own payload.
//
// ── the school is CHANCE and DURATION, never magnitude ────────────
// Pinned, because it is the reason this school needed its own module
// rather than another branch in applySpell's magnitude ladder.
//
// ── what is here and what is not ──────────────────────────────────
// The LAW is here. Three effects also own a WINDOW in DFU - Dispel
// Magic picks a bundle from a list, Create Item picks an item, Teleport
// picks and recalls an anchor - and those windows are the UI arc's.
// Where a law can be stated without its window it is stated: Dispel
// Magic's validity rule, for instance, is a pure predicate over the
// caster's live bundles.
//
// ── THE FOUR HOSTS, named (S27) ───────────────────────────────────
// SILENCE IS WIRED - and AUDIT 21 F5 found that sentence half true. Both of
// DFU's GATES were ported and its PRODUCER was not: `entity.isSilenced` had
// no writer anywhere in src/ (the only two were test fixtures), so
// silenceBlocksCast answered false for every entity in the game and the
// paragraph below described a mechanism that could not fire. Silence's
// classic key (19,255) is now a BUFF_KIND and isSilenced folds over the
// active effects, so the gates below have something to gate on.
//
// The pin that let this through is worth naming: test/mysticism.test.js read
// dungeonContext.js with readFileSync and matched /silenceBlocksCast\(...\)/.
// A source regex cannot see that the value the gate reads is never produced.
//
// The gates, in the one host that can cast:
//   - scenes/dungeonContext.js  WIRED. It owns readiedSpell and
//     playerCastInput, and now refuses at READY and at CAST, clearing
//     the readied spell each time.
//   - scenes/exterior.js        no cast path at all.
//   - scenes/world.js           no cast path at all.
//   - scenes/worldModes.js      no cast path of its own; it MOUNTS
//     interiorContext and dungeonContext, so a dungeon cast reaches
//     the wired gate through it.
//
// That is not three hosts forgetting to wire something. SPELLCASTING
// IN THIS PORT IS DUNGEON-ONLY: readiedSpell, applySpell and the
// spellbook all live in dungeonContext and nowhere else, so there is
// no exterior or interior cast for a silence to block. Wiring the
// other three is the casting arc's job, not this slice's, and the
// gate is ready for them.
//
// OPEN AND LOCK ARE NOT WIRED, and the reason is specific rather than
// an oversight. Their payload is an ARMED effect that has to survive
// between the cast and the next door the player touches, which needs a
// slot on the entity's active effects; the door end then hangs off
// world/actionSystem.js's `activate(key)` - the single activation
// point, where `toggleDoor(o, true)` already runs - in the two
// contexts that own an ActionSystem, dungeonContext.js and
// interiorContext.js. Neither exterior host owns doors. That is the
// next slice, and those are its seams.
import { EFFECT_FLAGS } from './spellcast.js';
import { isSilencedEffect } from './effects.js';
import { hasArtifactSubtype, ARTIFACTS } from './artifactEffects.js';   // ROAD-U: ContainsEnchantment, the way SoulTrap.cs asks

/** The ten, with the classic key DFU registers and which of the three
 *  cost axes each supports. `chance` and `duration` cost pairs are
 *  MakeEffectCosts(a, b) verbatim. */
export const MYSTICISM_EFFECTS = Object.freeze({
  DispelMagic: { type: 6, subType: 0, chance: [120, 180], duration: null },
  DispelUndead: { type: 6, subType: 1, chance: [80, 140], duration: null },
  DispelDaedra: { type: 6, subType: 2, chance: [120, 180], duration: null },
  CreateItem: { type: 2, subType: 255, chance: null, duration: [60, 120] },
  SoulTrap: { type: 12, subType: 255, chance: [40, 68], duration: [60, 68] },
  Lock: { type: 16, subType: 255, chance: [28, 120, 120], duration: null },
  Open: { type: 17, subType: 255, chance: [20, 100], duration: null },
  Silence: { type: 19, subType: 255, chance: [20, 100], duration: [20, 100] },
  Teleport: { type: 43, subType: 255, chance: null, duration: null },
  ComprehendLanguages: { type: 44, subType: 255, chance: [40, 68], duration: [60, 68] },
});

/** NOT ONE of the ten supports magnitude. */
export const SUPPORTS_MAGNITUDE = false;

/** Eight Mysticism effects are Magic-element only (ElementFlags_
 *  MagicOnly); Silence and SoulTrap are ElementFlags_All in DFU
 *  (AUDIT 23 corrected the 'every effect' claim). All cast from the
 *  Spell Maker. */
export const MYSTICISM_ELEMENT_FLAG = EFFECT_FLAGS.Magic;

export const isMysticism = (e) => Object.values(MYSTICISM_EFFECTS)
  .some((m) => m.type === e?.type && m.subType === (e?.subType & 0xff));

// ── Open (Open.cs :90-140) ────────────────────────────────────────
// Open is an ARMED effect, not an instant one: the chance is rolled at
// CAST, the caster is told "Ready to open.", and the payload waits for
// them to activate a door. A failed roll cancels before anything is
// armed.

/* StartWaitingForDoor (:81-98) does NOT live here. X1 wrote it twice -
 * once as an armOpen() helper nobody called, once inline in the effect
 * library's Open/Lock arm - and X3 deleted the copy. The arming is a
 * cast-time effect landing, so it belongs in systems/effects.js with
 * every other landing, and its item arm is the shared
 * AssignBundleFlags.BypassChance path (ctx.bypassChance) rather than a
 * flag of its own. This module keeps only what the DOOR needs: the two
 * triggers below and the alert table at the foot of the file. */

/** Open.CheckCastByItem (Open.cs:172-181), verbatim - THE SKELETON'S
 *  KEY TEST. DFU writes the two texture numbers as literals in this
 *  method, so the port does too:
 *
 *      castBySkeletonKey =
 *          ParentBundle.castByItem != null &&
 *          ParentBundle.castByItem.IsArtifact &&
 *          ParentBundle.castByItem.WorldTextureArchive == 432 &&
 *          ParentBundle.castByItem.WorldTextureRecord == 20;
 *
 *  Archive 432 is the MALE artifact archive (ItemHelper.cs:50) and
 *  record 20 the mapping row for Skeletons_Key (ArtifactsSubTypes 21,
 *  ItemHelper.cs:43). A FEMALE character's artifacts are minted at
 *  archive 433, so her Skeleton's Key fails this test and unlocks only
 *  to her level - DFU's own quirk, kept.
 *
 *  The item reaches here through the bundle: only CastWhenUsed sets
 *  CastByItem (CastWhenUsed.cs:136), so only a USED item can ever
 *  arm a key-cast Open. */
export function castBySkeletonKey(item) {
  return !!item && item.artifact === true
    && item.worldTextureArchive === 432 && item.worldTextureRecord === 20;
}

/** TriggerOpenEffect (:97-131), against the port's ActionSystem door
 *  record ({currentLockValue, state}).
 *
 *  The lock only yields to a HOLDER whose LEVEL reaches its value -
 *  the description says "unlocks chest or door to lock-level of
 *  caster", but the code reads manager.EntityBehaviour.Entity.Level
 *  (Open.cs:118): the level of whoever is HOLDING the armed effect,
 *  read AT THE TRIGGER, not the level frozen at cast. X3 corrected
 *  the port, which had latched the cast-time level into the armed
 *  entry - a level gained between casting and touching the door now
 *  counts, exactly as it does in DFU. The Skeleton's Key ignores the
 *  test entirely (interior doors only - see triggerExteriorOpen). A
 *  door that is left locked is NOT opened; an unlocked, CLOSED door
 *  is. The effect cancels either way, so a wasted cast is spent. */
export function triggerOpen(door, holderLevel, { castBySkeletonKey = false } = {}) {
  const out = { unlocked: false, opened: false, alert: null };
  if (door.currentLockValue > 0) {
    if (castBySkeletonKey || door.currentLockValue <= holderLevel) {
      door.currentLockValue = 0;
      out.unlocked = true;
    } else {
      out.alert = 'openFailed';
    }
  }
  // IsClosed is DFU's "not yet moving and not open"; the port's door
  // sits at 'start' when shut.
  if (door.currentLockValue === 0 && door.state === 'start') {
    out.opened = true;
  }
  return out;
}

// ── Lock (Lock.cs :95-135) ────────────────────────────────────────

/** TriggerLockEffect. Note the asymmetry with Open: Lock has NO level
 *  test - it locks to the HOLDER'S OWN LEVEL whatever the door was,
 *  read at the trigger (Lock.cs:116, the same live read as Open) -
 *  and an already-locked door is simply refused rather than
 *  re-locked harder. An OPEN door is swung shut. */
export function triggerLock(door, holderLevel) {
  if (door.currentLockValue > 0) {
    return { locked: false, closed: false, alert: 'doorAlreadyLocked' };
  }
  door.currentLockValue = holderLevel;
  const closed = door.state === 'end';
  return { locked: true, closed, alert: 'doorLocked' };
}

// ── Open on an EXTERIOR building door (Open.cs :138-161) ──────────

/** TriggerExteriorOpenEffect. The building half of Open, and it is a
 *  DIFFERENT rule from the interior one: there is no door record to
 *  unlock, only a building lock VALUE, the test is the reverse
 *  inequality written out longhand (`Level < buildingLockValue` is
 *  the FAILURE), and DFU's own comment is explicit that the Skeleton's
 *  Key gets no exemption here - "for the classic effect, the player's
 *  level is always checked, even for the Skeleton Key". The effect
 *  CANCELS on both outcomes (:158), so a failed exterior trigger
 *  spends the cast exactly like a failed interior one.
 *
 *  DFU also carries a standing NOTE above HandleOpenEffectOnExteriorDoor
 *  (PlayerActivate.cs:1033-1034) that the effect "currently ALWAYS
 *  works on exterior doors, should operate on lock level" - stale:
 *  the level test below is what the code does today, and it is what
 *  the port does. */
export function triggerExteriorOpen(buildingLockValue, holderLevel) {
  if (holderLevel < buildingLockValue) return { opened: false, alert: 'openFailed' };
  return { opened: true, alert: null };
}

// ── Dispel Undead / Daedra (DispelUndead.cs :44-58) ───────────────

/** The chance is rolled PER TARGET, and a dispelled enemy is DESTROYED
 *  outright - DFU's own comment: "just like classic, dispel simply
 *  destroys serializable enemy object in scene - target is not killed
 *  and will drop no loot. This can break quests if used carelessly."
 *  So this is not a kill: no death, no loot, no quest credit. Verbatim.
 *
 *  Returns the objects that were dispelled; the caller removes them. */
export function dispelNearby(nearby, rollChance) {
  const gone = [];
  for (const obj of nearby ?? []) {
    if (obj && rollChance()) gone.push(obj);
  }
  return gone;
}

// ── Dispel Magic (DispelMagic.cs :72-90) ──────────────────────────

/** Which of the caster's live bundles the picker offers: a SPELL or a
 *  HELD MAGIC ITEM, and only one that shows an icon. DFU notes the
 *  spell point cost is charged even if the player cancels the popup -
 *  "confirmed in classic" - so the cost is not this predicate's
 *  business and is deliberately not refunded.
 *
 *  The picker WINDOW is the UI arc's; this is the rule it fills from. */
export const DISPELLABLE_BUNDLE_TYPES = Object.freeze(['Spell', 'HeldMagicItem']);
export function dispellableBundles(bundles) {
  return (bundles ?? []).filter((b) =>
    DISPELLABLE_BUNDLE_TYPES.includes(b?.bundleType) && b?.showIcon !== false);
}

/** X10: the entity's live entries GROUPED into bundles, which is the
 *  shape DispelMagic's picker actually wants. effects.js stamps every
 *  entry one cast pushed with a shared bundleId/Name/Type; this reads
 *  that back.
 *
 *  ShowIcon (DispelMagic.cs:100-112) is per-BUNDLE, not per-effect:
 *  "at least one effect with remaining rounds must want to show an
 *  icon, or be from an equipped item". So one icon-showing member
 *  carries the whole bundle onto the list. The port's entries do not
 *  each carry a ShowSpellIcon flag - the classes that set it false are
 *  Open, Lock, Soul Trap, Dispel Magic and Identify, none of which
 *  leave a lasting entry a picker could list except the ARMED
 *  Open/Lock markers - so those two kinds are the port's showIcon
 *  false set, named rather than inferred.
 *
 *  Entries with no bundleId at all (anything pushed before X10, or by
 *  a path that does not go through applySpell) are skipped rather than
 *  lumped together: an untagged entry belongs to no cast, and
 *  inventing a bundle for it would let the picker offer something it
 *  cannot coherently remove. */
const NO_ICON_KINDS = new Set(['openArmed', 'lockArmed']);
export function liveBundles(entity) {
  const byId = new Map();
  for (const a of entity?.activeEffects ?? []) {
    if (a.ended || a.bundleId == null) continue;
    let b = byId.get(a.bundleId);
    if (!b) {
      b = { bundleId: a.bundleId, name: a.bundleName ?? '', bundleType: a.bundleType ?? 'Spell',
        icon: a.bundleIcon ?? 0, selfCast: !!a.bundleSelfCast,   // U46: the HUD's icon and its buff/debuff row
        entries: [], showIcon: false };
      byId.set(a.bundleId, b);
    }
    b.entries.push(a);
    // one icon-showing member is enough, and a held-item bundle always
    // qualifies (the `|| fromEquippedItem != null` half)
    if (!NO_ICON_KINDS.has(a.kind) || b.bundleType === 'HeldMagicItem') b.showIcon = true;
  }
  return [...byId.values()];
}

/** DispelMagic's SpellPicker_OnItemPicked (:114-137).
 *
 *  THE ONE ASYMMETRY: a bundle whose caster is the PLAYER is dispelled
 *  UNCONDITIONALLY - "player self-cast spells are always dispelled,
 *  otherwise use Chance roll". So your own buffs always come off, and
 *  only something cast AT you gets to resist. `selfCast` is the port's
 *  read of `bundle.caster.EntityType == EntityTypes.Player`.
 *
 *  Removing a bundle takes every entry that shares its id. Item
 *  bundles come back on the next recast or re-equip, which DFU notes
 *  explicitly, so this is not a permanent strip. */
export function dispelBundle(entity, bundleId, { selfCast = false, roll01 = 0, chance = 0 } = {}) {
  const list = entity?.activeEffects ?? [];
  const doomed = list.filter((a) => a.bundleId === bundleId);
  if (!doomed.length) return { removed: 0, alert: null };
  if (!selfCast && Math.floor(roll01 * 100) >= chance) {
    return { removed: 0, alert: 'dispelMagicFailed' };
  }
  entity.activeEffects = list.filter((a) => a.bundleId !== bundleId);
  return { removed: doomed.length, alert: 'dispelMagicSuccess' };
}

/** Internal_Strings.csv - the two outcome lines. */
export const DISPEL_MAGIC_TEXT = Object.freeze({
  dispelMagicSuccess: 'Dispel magic was a success...',   // :1054
  dispelMagicFailed: 'Dispel magic failed...',           // :1055
});

// ── Soul Trap (SoulTrap.cs :117-163, EnemyEntity.cs :157-238) ─────

/** MiscItems.Soul_trap, the template DFU searches for by GROUP and
 *  INDEX (SoulTrap.cs:144). The port's own useItem.js carries the
 *  same 274. */
export const SOUL_TRAP_TEMPLATE = 274;

/** FillEmptyTrapItem. AZURA'S STAR FIRST, always: the reusable artifact
 *  amulet takes the soul before any ordinary gem, and `azurasStarOnly`
 *  makes it the only candidate. Otherwise the first EMPTY soul trap in
 *  the pack takes it. A pack with no empty trap fills nothing.
 *
 *  DFU's own comment on the ordering is worth keeping: in CLASSIC the
 *  pack is walked once and the first empty trap OR star wins, so which
 *  one fills "would probably depend on the order in which the items
 *  were added to the inventory"; DFU picks the Star deliberately as
 *  "the behavior players would expect". That is a chosen departure
 *  from classic, and the port inherits DFU's choice.
 *
 *  X5 FIX. The default `isSoulTrap` was `it.name === 'Soul trap'` and
 *  could not match anything: the port's items are {group,
 *  templateIndex} records that carry no `name` at all, and the
 *  template's own name is "Soul Trap" with a capital T. The predicate
 *  was never caught because this function had no production caller -
 *  its test supplied a fixture built to match the broken default. DFU
 *  searches by GROUP AND TEMPLATE (SearchItems(ItemGroups.MiscItems,
 *  (int)MiscItems.Soul_trap)), which is what the port does now and
 *  what every other item predicate here already did (useItem.js's
 *  isPotionRecipe/isMap). */
export function fillEmptyTrap(items, soulType, {
  azurasStarOnly = false,
  // ROAD-U, the X5 fix one item further on: this default was
  // `it?.azurasStar === true`, a boolean only createArtifact minted -
  // so a Star imported from a classic save captured nothing at either
  // death site while isAzurasStarEquipped, read on the very same line
  // there, said it was worn. SoulTrap.cs:129 asks the ITEM:
  // ContainsEnchantment(SpecialArtifactEffect, Azuras_Star).
  isAzurasStar = (it) => hasArtifactSubtype(it, ARTIFACTS.AzurasStar),
  isSoulTrap = (it) => it?.group === 'MiscItems' && it?.templateIndex === SOUL_TRAP_TEMPLATE,
} = {}) {
  const empty = (it) => (it?.trappedSoulType ?? null) === null;
  let trap = (items ?? []).find((it) => isAzurasStar(it) && empty(it)) ?? null;
  if (!trap && azurasStarOnly) return null;
  if (!trap) trap = (items ?? []).find((it) => isSoulTrap(it) && empty(it)) ?? null;
  if (!trap) return null;
  trap.trappedSoulType = soulType;
  return trap;
}

/** The five Soul Trap HUD lines (Internal_Strings.csv :658-662). */
export const SOUL_TRAP_TEXT = Object.freeze({
  trapActive: 'Trap active.',                        // :658
  trapHumanoid: 'Trap will not work on humanoids.',  // :659
  trapSuccess: 'Trapped soul.',                      // :660
  trapFail: 'Trap failed.',                          // :661
  trapNoneEmpty: 'You have no empty soul traps!',    // :662
});

/** EnemyEntity.AttemptSoulTrap (:194-238) + the SetHealth override
 *  (:157-177) that calls it, as one pure law over the port's shapes.
 *
 *  This is the most interesting arm in the school, because ONE of its
 *  outcomes refuses the death:
 *
 *    - no live trap on the target        -> dies normally, silent
 *    - the death-time roll FAILS         -> dies normally, "Trap failed."
 *    - roll succeeds, a gem takes it     -> dies normally, "Trapped soul."
 *    - roll succeeds, NO empty gem       -> the entity is TETHERED at
 *      1 health and does NOT die, with "You have no empty soul traps!"
 *
 *  DFU's own comment on that last arm: "keep entity tethered to life -
 *  player is alerted so they know what's happening". The tether is not
 *  a one-off: the effect stays, so the NEXT killing blow re-enters
 *  here and rolls again, and the entity only dies once a roll fails,
 *  the effect expires, or a gem frees up. An unfillable trap makes the
 *  target unkillable for the spell's duration.
 *
 *  THE ROLL IS A RE-ROLL. SoulTrap.ChanceSuccess is hardcoded TRUE
 *  (SoulTrap.cs:47-52) purely so the effect always attaches - "Chance
 *  will be re-rolled using RollTrapChance() when entity is slain".
 *  So the cast never fails; the chance is spent here, at the kill,
 *  against the chance frozen at cast (RollChance -> ChanceValue ->
 *  the CASTER's level, the X2 asymmetry).
 *
 *  `soulType` is passed EXPLICITLY, as DFU passes mobileEnemy.ID
 *  (:217) - the port keeps the mobile id on the FOE record rather
 *  than the entity, so the door that knows the foe supplies it.
 *  `roll01` is the engine PRNG slot; `items` is the PLAYER's pack -
 *  the soul goes to the player who cast it, never to the corpse. */
export function attemptSoulTrap(target, soulType, items, roll01, { azurasStarOnly = false } = {}) {
  const trap = (target?.activeEffects ?? []).find((a) => a.kind === 'soulTrap' && !a.ended);
  if (!trap) return { allowDeath: true, alert: null, filled: null };
  // Dice100.SuccessRoll, the port's convention throughout.
  if (Math.floor(roll01 * 100) >= (trap.chance ?? 0)) {
    return { allowDeath: true, alert: 'trapFail', filled: null };
  }
  const filled = fillEmptyTrap(items, soulType, { azurasStarOnly });
  if (filled) return { allowDeath: true, alert: 'trapSuccess', filled };
  return { allowDeath: false, alert: 'trapNoneEmpty', filled: null };
}

/** ItemHelper.ResolveItemLongName's soul-trap tail (:352-368): a
 *  FILLED trap shows its soul in brackets, an empty one shows nothing.
 *  DFU left the "(empty)" alternative commented out at :365-368, so
 *  the blank is deliberate rather than missing.
 *
 *  `enemyName` is injected - this module must not import the bestiary. */
export function soulTrapNameSuffix(item, enemyName) {
  if (item?.group !== 'MiscItems' || item?.templateIndex !== SOUL_TRAP_TEMPLATE) return '';
  const soul = item?.trappedSoulType;
  if (soul === null || soul === undefined) return '';
  const name = enemyName?.(soul);
  return name ? ` (${name})` : '';
}

// ── Silence (Silence.cs + EntityEffectManager.SilenceCheck :1932) ──

/** A silenced entity cannot cast. DFU checks this in TWO places - when
 *  a spell is READIED and again when it is CAST - and both clear the
 *  readied spell, so a silence landing mid-aim disarms you.
 *
 *  The NO-SPELL-POINT-COST arms are exempt in DFU (`!noSpellPointCost
 *  && SilenceCheck()`), so an item-cast or a free effect still fires
 *  through a silence. */
/** DaggerfallEntity.IsSilenced.
 *
 *  AUDIT 21 F5: this read a raw `entity.isSilenced` flag that NOTHING in src/
 *  ever wrote - the only writers were two test fixtures - so the gate below
 *  was a constant false for every entity in the game. The producer now exists:
 *  Silence's classic key (19,255) is a BUFF_KIND, and this folds over the
 *  active effects the way isImmuneToParalysis and the concealment predicates
 *  already do. The raw flag is still honoured so a host or a save can force
 *  it, but it is no longer the only path in. */
export const isSilenced = (entity) => !!entity?.isSilenced || isSilencedEffect(entity);

/** The gate itself: true means the cast is REFUSED. Clearing the
 *  readied spell is the caller's, since the readied slot lives on the
 *  host. */
export function silenceBlocksCast(entity, { costsSpellPoints = true } = {}) {
  return costsSpellPoints && isSilenced(entity);
}
/** X1: the door-spell alert lines. The trigger laws answer localisation
 *  KEYS (Internal_Strings.csv); these are their English, which is what
 *  the port's HUD speaks. Who speaks each (X3 wired the arming pair -
 *  before it, half this table was unreachable):
 *    readyToOpen / readyToLock   scenes/hostMagic.js, off out.armed
 *    openFailed                  the interior trigger, through
 *                                wireDoorSpells; and the exterior one,
 *                                through worldModes' static-door arm
 *    doorLocked / doorAlreadyLocked   the interior Lock trigger
 *    spellEffectFailed           NOT spoken from here - Open and Lock
 *                                are both CasterOnly, so a failed
 *                                chance takes AssignBundle's generic
 *                                caster-only arm in hostMagic, which
 *                                says this same string. The row stays
 *                                as the record of DFU's own
 *                                Open.cs:87 AddHUDText call. */
export const DOOR_SPELL_TEXT = Object.freeze({
  readyToOpen: 'Ready to open.',            // :652
  openFailed: 'Lock is too powerful.',      // :655
  readyToLock: 'Ready to lock.',            // :651
  doorLocked: 'Door is now locked.',        // :653
  doorAlreadyLocked: 'Door already locked.',// :654
  spellEffectFailed: 'Spell effect failed.',// :647
});

export const SILENCED_TEXT = 'You are silenced.';
// SetReadySpell's HUD line (EntityEffectManager.cs:355) -
// GetLocalizedText('pressButtonToFireSpell'), Internal_Strings_en
// m_Id 211. AUDIT 24: the port had invented "<spell> readied."
export const PRESS_BUTTON_TO_FIRE_SPELL = 'Press button to fire spell.';
