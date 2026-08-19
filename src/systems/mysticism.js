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
// FLAGGED, by name, per THE FOUR HOSTS RULE: nothing here is wired
// into a host yet. Silence needs the readied-spell gate, and Open and
// Lock need the door-activation path, in ALL FOUR of scenes/exterior.js,
// scenes/world.js, scenes/worldModes.js and scenes/dungeonContext.js.
// The predicates below are the shape those hosts will call; none of
// them is called today.
import { EFFECT_FLAGS } from './spellcast.js';

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

/** Every Mysticism effect is Magic-element only (ElementFlags_MagicOnly)
 *  and casts from the Spell Maker. */
export const MYSTICISM_ELEMENT_FLAG = EFFECT_FLAGS.Magic;

export const isMysticism = (e) => Object.values(MYSTICISM_EFFECTS)
  .some((m) => m.type === e?.type && m.subType === (e?.subType & 0xff));

// ── Open (Open.cs :90-140) ────────────────────────────────────────
// Open is an ARMED effect, not an instant one: the chance is rolled at
// CAST, the caster is told "Ready to open.", and the payload waits for
// them to activate a door. A failed roll cancels before anything is
// armed.

/** StartWaitingForDoor (:73-95). An item cast - and the Skeleton's Key -
 *  skips the roll entirely but is STILL subject to the level rule below. */
export function armOpen({ castByItem = false, castBySkeletonKey = false, rollChance = () => true } = {}) {
  if (castByItem || castBySkeletonKey) return { armed: true, alert: 'readyToOpen' };
  if (!rollChance()) return { armed: false, alert: 'spellEffectFailed' };
  return { armed: true, alert: 'readyToOpen' };
}

/** TriggerOpenEffect (:97-131), against the port's ActionSystem door
 *  record ({currentLockValue, state}).
 *
 *  The lock only yields to a caster whose LEVEL reaches its value -
 *  "unlocks chest or door to lock-level of caster" - and the
 *  Skeleton's Key ignores even that. A door that is left locked is NOT
 *  opened; an unlocked, CLOSED door is. The effect cancels either way,
 *  so a wasted cast is spent. */
export function triggerOpen(door, casterLevel, { castBySkeletonKey = false } = {}) {
  const out = { unlocked: false, opened: false, alert: null };
  if (door.currentLockValue > 0) {
    if (castBySkeletonKey || door.currentLockValue <= casterLevel) {
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
 *  test - it locks to the CASTER'S OWN LEVEL whatever the door was -
 *  and an already-locked door is simply refused rather than
 *  re-locked harder. An OPEN door is swung shut. */
export function triggerLock(door, casterLevel) {
  if (door.currentLockValue > 0) {
    return { locked: false, closed: false, alert: 'doorAlreadyLocked' };
  }
  door.currentLockValue = casterLevel;
  const closed = door.state === 'end';
  return { locked: true, closed, alert: 'doorLocked' };
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

// ── Soul Trap (SoulTrap.cs :111-165) ──────────────────────────────

/** FillEmptyTrapItem. AZURA'S STAR FIRST, always: the reusable artifact
 *  amulet takes the soul before any ordinary gem, and `azurasStarOnly`
 *  makes it the only candidate. Otherwise the first EMPTY soul trap in
 *  the pack takes it. A pack with no empty trap fills nothing.
 *
 *  `isAzurasStar` and `isSoulTrap` are passed in so this stays a pure
 *  rule over the port's own item shape. */
export function fillEmptyTrap(items, soulType, {
  azurasStarOnly = false,
  isAzurasStar = (it) => it?.azurasStar === true,
  isSoulTrap = (it) => it?.name === 'Soul trap',
} = {}) {
  const empty = (it) => (it?.trappedSoulType ?? null) === null;
  let trap = (items ?? []).find((it) => isAzurasStar(it) && empty(it)) ?? null;
  if (!trap && azurasStarOnly) return null;
  if (!trap) trap = (items ?? []).find((it) => isSoulTrap(it) && empty(it)) ?? null;
  if (!trap) return null;
  trap.trappedSoulType = soulType;
  return trap;
}

// ── Silence (Silence.cs + EntityEffectManager.SilenceCheck :1932) ──

/** A silenced entity cannot cast. DFU checks this in TWO places - when
 *  a spell is READIED and again when it is CAST - and both clear the
 *  readied spell, so a silence landing mid-aim disarms you.
 *
 *  The NO-SPELL-POINT-COST arms are exempt in DFU (`!noSpellPointCost
 *  && SilenceCheck()`), so an item-cast or a free effect still fires
 *  through a silence. */
export const isSilenced = (entity) => !!entity?.isSilenced;

/** The gate itself: true means the cast is REFUSED. Clearing the
 *  readied spell is the caller's, since the readied slot lives on the
 *  host. */
export function silenceBlocksCast(entity, { costsSpellPoints = true } = {}) {
  return costsSpellPoints && isSilenced(entity);
}
export const SILENCED_TEXT = 'You are silenced.';
