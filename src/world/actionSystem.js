// Dungeon action runtime: action doors and linked action-record objects.
// 1:1 with Daggerfall Unity's DaggerfallAction / DaggerfallActionDoor
// (MIT, Daggerfall Workshop):
//   - Move actions tween LINEARLY over Duration = record.duration / 20
//     seconds: RotateBy ActionRotation degrees in Space.Self plus MoveTo
//     StartingPosition + ActionTranslation (world); reaching End flips
//     the next activation into the reverse tween back to Start.
//   - Play() cascades to the linked object FIRST (ActivateNext ->
//     Receive), then runs its own tween; Receive is gated on
//     IsPlaying(), which is true if this object OR anything down its
//     chain is mid-tween. ONE verbatim exception: ShowTextWithInput
//     does NOT cascade at Play - its chain fires only through a
//     matching answer (UserInputHandler).
//   - Action doors swing (0, OpenAngle -90, 0) degrees in Space.Self
//     over OpenDuration 1.5 s, linear; the door collider turns TRIGGER
//     (passable) the moment opening starts and turns solid again only
//     when closing COMPLETES (MakeTrigger call sites). ToggleDoor is a
//     no-op while moving; a LOCKED closed door refuses the player with
//     the LookAtInteriorLock text (P10).
//   - A door that ALSO carries an action record carries TWO independent
//     states, exactly as DFU does with two components on one GameObject:
//     DaggerfallActionDoor.currentState is the SWING (state/t here) and
//     DaggerfallAction.currentState is the record's own Move state
//     (moveState/moveT here). Only Move writes the latter, so IsPlaying -
//     and therefore Receive's gate - reads the MOVE state and is blind to
//     the swing. Play() dispatches actionFunctions[ActionFlag] on whatever
//     object carries the component (RDBLayout AddActionModelHelper puts one
//     on the action-door GameObject), so a Move-flagged door tweens by
//     ActionRotation/ActionTranslation while it swings.
//   - The PLAYER's click runs BOTH of PlayerActivate's checks, in order and
//     with no else between them: ActivateActionDoor -> ToggleDoor(true)
//     (which fires the door's own record through the Door trigger type) and
//     THEN ActionCheck -> Receive(Direct). The Direct half is the only way
//     a Direct/MultiTrigger-flagged door record ever fires - without it
//     Mynisera's door in Castle Daggerfall can never be opened.
// The matrix composition mirrors the tweens exactly: world translation
// pre-multiplies the placement, self rotation post-multiplies it.
// Collision (ours): doors own a collider bucket that exists only while
// fully closed; moving action objects rebuild their bucket each frame
// (DFU parents the player to platforms instead - riding is a later
// milestone, standing collision is correct at every instant).
// KEYS (P10): object positions are BLOCK-LOCAL byte offsets and
// 3108/4232 dungeons repeat at least one RDB, so every chain key is
// namespaced by the block INSTANCE (ns): `act:{ns}:{position}`.
// Un-namespaced keys made repeated blocks' objects overwrite each
// other - the earlier copy stopped ticking and its collider bucket
// collided.

import { trs, multiply } from './mat4.js';
import { ACTION_FLAGS, TRIGGER_FLAGS, MOVE_ACTION_FLAGS } from './rdbLayout.js';
import { CASTSPELL_COOLDOWN_TICK } from '../systems/spellcast.js';   // single source (DaggerfallAction 45.454546)
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage
import { triggerOpen, triggerLock } from '../systems/mysticism.js';   // X1: the Open/Lock door laws live there, not here
import { dice100 } from '../combat/formulas.js';   // PT1: Dice100 has ONE home, and it is not this file

// The RDB effect-action family (DaggerfallAction delegates that hurt
// rather than move). Combat-arc row from Port-Ledger C:
//   Hurt21 (0x15): fires every 20th activation, damage =
//     Range(max(1, Magnitude), max(1, Index)) * max(level, 1) - the
//     Unity int Range EXCLUSIVE upper is preserved; DFU increments
//     activationCount BEFORE the delegate, so the first fire is at
//     the 20th activation.
//   Hurt22-25 (0x16-0x19): every activation, damage =
//     (IsFlat ? Magnitude : ActionAxisRawValue) * max(level, 1).
//   Poison (0x1a): a VERBATIM NO-OP - DFU's own delegate body is
//     empty (a Debug.Log stub); preserved as-is.
//   DrainMagicka (0x1c): verbatim max(1, IsFlat ? Magnitude :
//     AxisRaw) off current magicka.
export const EFFECT_ACTION_FLAGS = new Set([
  ACTION_FLAGS.Hurt21, ACTION_FLAGS.Hurt22, ACTION_FLAGS.Hurt23,
  ACTION_FLAGS.Hurt24, ACTION_FLAGS.Hurt25, ACTION_FLAGS.Poison,
  ACTION_FLAGS.DrainMagicka, ACTION_FLAGS.CastSpell,
]);

// The door-verb family (DaggerfallAction delegates that act on the
// door the action record is ATTACHED to - thisAction.gameObject):
//   LockDoor (0x10): CurrentLockValue = 16 if not already locked.
//   UnlockDoor (0x11): CurrentLockValue = 0.
//   OpenDoor (0x12): unlock + open if closed.
//   CloseDoor (0x14): close if open, then re-lock to StartingLockValue.
export const DOOR_VERB_FLAGS = new Set([
  ACTION_FLAGS.LockDoor, ACTION_FLAGS.UnlockDoor,
  ACTION_FLAGS.OpenDoor, ACTION_FLAGS.CloseDoor,
]);

// Delegated relays (P10/U6): Teleport, the text actions and
// SetGlobalVar run through scene seams inside _runRelay. Activate
// (0x1e) is a VERBATIM no-op - DFU's delegate body is `return;` - and
// so are Dialogue and the Unknowns, which have no delegate at all;
// for those the cascade IS the behavior. SetGlobalVar (0x1f) is NOT
// one of them (DaggerfallAction.cs:822-827): it sets quest global
// #ActionAxisRawValue to TRUE - the record's raw axis byte is the
// global's index, not a vector - and the port runs it through the
// setGlobalVar seam onto the machine's 64-global store
// (systems/quest/machine.js globalVars, the same store a
// GlobalVarLink task reads). Its cascade runs either way.

/** Verbatim RDBLayout AddActionModelHelper classification for a placed
 *  model with an action record. C# precedence kept exactly:
 *  `OpenDoor || (CloseDoor && !IsActionDoor)` - OpenDoor makes a
 *  special door out of anything; CloseDoor only out of non-doors. */
export function classifyPlacementAction(actionFlag, isActionDoor = false) {
  if (MOVE_ACTION_FLAGS.has(actionFlag)) return 'move';
  if (EFFECT_ACTION_FLAGS.has(actionFlag)) return 'effect';
  if (actionFlag === ACTION_FLAGS.OpenDoor
    || (actionFlag === ACTION_FLAGS.CloseDoor && !isActionDoor)) return 'specialDoor';
  return 'relay';
}

// DaggerfallAction.Receive's verbatim trigger gate: which trigger
// TYPES each RDB TriggerFlag accepts. ActionObject (chain cascade)
// is ALWAYS valid; undefined flags never fire (the source's default).
export const TRIGGER_GATE = Object.freeze({
  [TRIGGER_FLAGS.None]: [],                                    // ActionObject only
  [TRIGGER_FLAGS.Collision01]: ['WalkOn'],
  [TRIGGER_FLAGS.Direct]: ['Direct'],
  [TRIGGER_FLAGS.Collision03]: ['WalkInto'],
  [TRIGGER_FLAGS.Attack]: ['Attack'],
  [TRIGGER_FLAGS.Direct6]: ['Direct'],
  [TRIGGER_FLAGS.MultiTrigger]: ['Direct', 'Attack', 'WalkInto'],
  [TRIGGER_FLAGS.Collision09]: ['Direct', 'WalkInto'],
  [TRIGGER_FLAGS.Door]: ['Door'],
});
export const COLLISION_TIMEOUT_S = 0.12;   // DaggerfallActionCollision.Timeout

export const DOOR_OPEN_ANGLE = -90;
export const DOOR_OPEN_DURATION = 1.5;

// DaggerfallActionDoor lock model, verbatim: CurrentLockValue > 0 =
// locked; >= 20 = magically held (never picked or bashed). LockDoor's
// action value:
export const ACTION_LOCK_VALUE = 16;
export const MAGIC_LOCK_THRESHOLD = 20;

// PlayerActivate.LookAtInteriorLock, verbatim: the chance-tiered
// message a player sees activating a locked door. chance =
// CalculateInteriorLockpickingChance = clamp(5*(level - lockValue) +
// lockpickSkill, 5, 95).
const LOCKPICK_CHANCE_TEXT = [
  'You doubt your ability to open this lock...',
  'This lock looks difficult...',
  'You would be challenged by this lock...',
  'This lock would prove a good challenge...',
  'You think you should be able to pick this lock...',
  'This lock seems relatively easy...',
  'You are amused by this lock...',
  'You laugh at the amateur quality of this lock...',
  'You see a pathetic excuse for a lock...',
  'This lock is an insult to your abilities...',
];
export function interiorLockpickingChance(level, lockValue, lockpickSkill) {
  const chance = 5 * (level - lockValue) + lockpickSkill;
  return Math.max(5, Math.min(95, chance));
}

/** CalculateExteriorLockpickingChance (FormulaHelper.cs:243-251):
 *  the building-door formula has NO level term - skill against five
 *  points per lock value, same 5..95 clamp. Classic's oversight rides
 *  with it: the LOOK-AT difficulty text always uses the INTERIOR
 *  formula, even on exterior doors (PlayerActivate.cs:987-991's own
 *  comment), so lookAtLockText above serves both kinds. */
export function exteriorLockpickingChance(lockValue, lockpickSkill) {
  const chance = lockpickSkill - 5 * lockValue;
  return Math.max(5, Math.min(95, chance));
}

/** The attempt lines (TextManager keys lockpickingSuccess /
 *  lockpickingFailure - the localisation tables are not in the source
 *  snapshot, so the prose is ours with the keys cited). */
export const LOCKPICKING_SUCCESS_TEXT = 'You successfully pick the lock.';
export const LOCKPICKING_FAILURE_TEXT = 'You fail to pick the lock.';
export function lookAtLockText(lockValue, level, lockpickSkill) {
  if (lockValue >= MAGIC_LOCK_THRESHOLD) return 'This is a magically held lock...';
  const chance = interiorLockpickingChance(level, lockValue, lockpickSkill);
  if (chance < 30) return 'This lock has nothing to fear from you...';
  if (chance < 35) return "It'd be a miracle if you picked this lock...";
  if (chance >= 95) return LOCKPICK_CHANCE_TEXT[9];
  if (chance >= 45) return LOCKPICK_CHANCE_TEXT[Math.trunc((chance - 45) / 5)];
  return 'This lock looks to be beyond your skills...';
}

// ---- U6: the text actions, verbatim constants ----
export const TYPE_11_TEXT_INDEX = 8600;   // ShowText: TEXT.RSC record = Index + 8600
export const TYPE_12_TEXT_INDEX = 5400;   // ShowTextWithInput: Index + 5400
export const TYPE_99_TEXT_INDEX = 7700;   // DoorText: Index + 7700

/** DaggerfallAction.actionTypeTwelveLookup, verbatim - the classic
 *  riddle answers per text id (case-insensitive match). */
export const TYPE_12_ANSWERS = Object.freeze({
  5404: ['bow', 'bow arrow', 'crossbow', 'bows', 'crossbows'],           // sheogorath
  5406: ['one', '1'],                                                    // blind god
  5423: ['benefactor', 'the benefactor'],                                // benefactor
  5424: ['shut up', 'shutup', 'shaddup'],                                // shaddup!
  5464: ['yes', 'oK', 'i agree', 'y', 'agreed', 'done', 'fine', 'okay', 'sure', 'yep'],   // daggerfall guard
});

/** The DoorText id patch table, verbatim (comments preserved in the
 *  source): 0 -> enabled/skip; 7701..7704 -> 7705 ("allowed" vs
 *  "allow"); the known-missing ids -> enabled/skip. */
const DOOR_TEXT_REMAP = Object.freeze({ 7701: 7705, 7702: 7705, 7703: 7705, 7704: 7705 });
const DOOR_TEXT_SKIP = new Set([7700, 7706, 7711, 7712, 7715, 7717, 7719]);

// ---- ROAD-B B4: CastleDaggerfallMagicDoorsSpecialOpenHack ----
// DaggerfallAction.cs:256-273, verbatim. The two magically-held foyer
// doors of Castle Daggerfall are named by LoadID ("based on unique
// position in gamedata and always the same"), and DFU's own comment
// says why the check sits inside Receive: "there's no really satisfying
// way to intercept and change action behaviour directly on these doors".
// The purpose is narrow - a player TELEPORTED into the dungeon (the
// recall/anchor arm, not the front door) can land behind the held doors
// and be shut in; classic leaves you talking to the guard through the
// crack. So: still show the "magically held" line, but open anyway.
export const CASTLE_DAGGERFALL_MAP_ID = 1291010263;              // PlayerGPS.CurrentLocation.MapTableData.MapId
export const CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS = Object.freeze([29331574, 29331622]);

export class ActionSystem {
constructor(collider, { damagePlayer = null, drainMagicka = null, castSpell = null, setGlobalVar = null, playerLevel = () => 1, lockpickSkill = () => 0, rolls = Math.random, insideDungeonCastle = () => false, magicDoorsContext = null } = {}) {
    this.collider = collider;
    this.objects = new Map(); // key -> runtime object
    this._links = new Map();  // `${ns}:${position}` -> object (the chain graph)
    this._doorCount = 0;
    this._damagePlayer = damagePlayer;
    this._drainMagicka = drainMagicka;
    this._castSpell = castSpell;
    // SetGlobalVar (0x1f): DFU reaches the 64 classic globals through
    // the ambient GameManager.Instance.PlayerEntity.GlobalVars; the
    // port hands the store in, exactly as it does the damage/magicka
    // sinks. Absent (an interior host, a bare pin) the action is inert
    // beyond its cascade, which is the pre-wiring shape.
    this._setGlobalVar = setGlobalVar;
    this._playerLevel = playerLevel;
    this._lockpickSkill = lockpickSkill;   // R1: GetLiveSkillValue(Lockpicking), the scene's live read
    this._rolls = rolls;
// ROAD-B (b2): PlayerEnterExit.IsPlayerInsideDungeonCastle, read by
    // AttemptBash's tail (DaggerfallActionDoor.cs:220-221) and by
    // nothing else in this file. Absent (an interior host, a bare pin)
    // it answers false, which is what a building interior IS.
    this._insideDungeonCastle = insideDungeonCastle;
    // ROAD-B B4: the three ambient reads
    // CastleDaggerfallMagicDoorsSpecialOpenHack makes off the singletons
    // (DaggerfallAction.cs:261-263): PlayerEnterExit
    // .PlayerTeleportedIntoDungeon, PlayerEnterExit.IsPlayerInsideDungeon
    // and PlayerGPS.CurrentLocation.MapTableData.MapId. Handed in as one
    // thunk -> { playerTeleportedIntoDungeon, isPlayerInsideDungeon,
    // currentMapId }, the damage/magicka-sink shape. Unset (an interior
    // host, a bare pin) the hack cannot fire - which is correct on both:
    // an interior is not a dungeon, so DFU's second term is false there.
    this._magicDoorsContext = magicDoorsContext;
    // Scene seams (P10/U6/A2):
    //   resolvePosition(ns, positionKey) -> { pos: [x,y,z], yawDeg }
    //     (teleport destinations - actionless objects live only in
    //     the layout's position index, not this graph)
    //   onTeleport({ pos, yawDeg })  - warp the player
    //   onTeleportPortal(from, to)   - ROAD-C c2/S8:
    //     DaggerfallAction.OnTeleportAction (:897-903), the static event
    //     whose ONE listener in DFU is Automap.OnTeleportAction. Both
    //     endpoints are `{ pos, yawDeg }` rows off the layout index and
    //     it fires BEFORE the warp, exactly as :596 does.
    //   onLockedDoor(door)           - the classic look-at-lock text
    //   onActionSound(o)             - Play's soundIndex (Index > 0)
    //   onShowText(textId) / onShowTextInput(textId, submit)
    //   onDoorText(textId) / onTrespass()
    //   setGlobalVar(index, value) rides the constructor options
    //     beside damagePlayer (it is a sink, not a scene event)
    //   onDoorState(o, opening) / onDoorBash(o) - the A1 audio seams
    this.resolvePosition = null;
    this.onTeleport = null;
    this.onTeleportPortal = null;
    this.onLockedDoor = null;
    this.onActionSound = null;
    this.onShowText = null;
    this.onShowTextInput = null;
    this.onDoorText = null;
    this.onTrespass = null;
    this.onDoorState = null;
    this.onDoorBash = null;
    // ROAD-B: onMakeEnemiesHostile() - GameManager.MakeEnemiesHostile,
    // fired by AttemptBash's tail inside a dungeon CASTLE and by the
    // DoorText trespass check (onTrespass, above, is the same law at a
    // different site and keeps its own name because DFU's call sites
    // are two different files).
    this.onMakeEnemiesHostile = null;
    // R1: onLockpickTally() - TallySkill(Lockpicking, 1) per attempt;
    // onLockpickResult(o, success) - the attempt line + the
    // ActivateLockUnlock sound on success
    this.onLockpickTally = null;
    this.onLockpickResult = null;
    // WAVE D: onFlatMoved(o) - a MOVE-flag FLAT reached a new pose.
    // The host owns the billboard, so it owns the draw; this system
    // owns the tween. Fires on every advance and on a restore settle,
    // the same shape onDoorState has for the audio seam.
    this.onFlatMoved = null;
  }

  _register(ns, positionKey, o) {
    this.objects.set(o.key, o);
    if (positionKey != null && positionKey >= 0) this._links.set(`${ns}:${positionKey}`, o);
  }

  _next(o) {
    if (o.nextKey == null || o.nextKey < 0) return null;
    return this._links.get(`${o.ns}:${o.nextKey}`) ?? null;
  }

  /** Register an effect action (Hurt/Poison/DrainMagicka/CastSpell):
   *  chain participant, no tween - the model stays in the static draw
   *  and the shared collider (the caller keeps those). */
  addEffect(ns, positionKey, action, origin = null) {
    const key = `act:${ns}:${positionKey}`;
    const o = {
      origin,
      key,
      ns,
      kind: 'effect',
      actionFlag: action.actionFlag,
      magnitude: action.magnitude,
      index: action.index,
      axisRaw: action.axisRaw,
      isFlat: action.isFlat,
      activationCount: 0,
      nextKey: action.nextObject,
      triggerFlag: action.triggerFlag ?? TRIGGER_FLAGS.None,
      state: 'start',
    };
    this._register(ns, positionKey, o);
    return o;
  }

  _runEffect(o) {
    // activationCount is incremented by Receive, BEFORE Play dispatches
    // the delegate - Hurt21 reads the already-incremented value.
    const lvl = Math.max(1, this._playerLevel());
    const F = ACTION_FLAGS;
    if (o.actionFlag === F.Hurt21) {
      if (o.activationCount % 20 !== 0) return;
      const a = Math.max(1, o.magnitude), b = Math.max(1, o.index);
      const span = Math.max(0, b - a);                      // int Range: exclusive upper; max<=min -> min
      const dmg = (a + Math.floor(this._rolls() * span)) * lvl;
      // AUDIT 24 (wave 39): DaggerfallAction.cs:739 sends RemoveHealth,
      // so a damage trap flashes the screen (ShowPlayerDamage).
      if (this._damagePlayer) { this._damagePlayer(dmg); flashPlayerDamage(); }
    } else if (o.actionFlag >= F.Hurt22 && o.actionFlag <= F.Hurt25) {
      const dmg = (o.isFlat ? o.magnitude : o.axisRaw) * lvl;
      if (this._damagePlayer) { this._damagePlayer(dmg); flashPlayerDamage(); }   // :768, the same message
    }
    else if (o.actionFlag === F.CastSpell) {
      // S4b verbatim: cooldown -= 45.454546 per Play; at <= 0 the
      // spell (record by Index) fires AT the player from the object,
      // then the cooldown RESETS to 1000 (parity fix, audit
      // 2026-08-16: the reset was missing, so after the first fire
      // every activation fired - DFU fires every 22nd).
      o.cooldown = (o.cooldown ?? 0) - CASTSPELL_COOLDOWN_TICK;
      if (o.cooldown <= 0) {
        if (this._castSpell) this._castSpell(o.index, o.origin);
        o.cooldown = 1000;
      }
    }
    else if (o.actionFlag === F.DrainMagicka) {
      // S4a: REAL now that chargen rolls magicka - verbatim
      // DaggerfallAction.DrainMagicka: max(1, IsFlat ? Magnitude :
      // AxisRaw) off current magicka, floored at 0.
      const drain = Math.max(1, o.isFlat ? o.magnitude : o.axisRaw);
      if (this._drainMagicka) this._drainMagicka(drain);
    }
    // Poison: verbatim DFU no-op stub (preserved).
  }

  /** The delegated-relay delegates (P10/U6): Teleport, the text
   *  actions and SetGlobalVar, routed through the scene seams. Every
   *  OTHER relay flag is a verbatim no-op whose cascade is the
   *  behavior. */
  _runRelay(o) {
    const F = ACTION_FLAGS;
    if (o.actionFlag === F.Teleport) {
      // DaggerfallAction.Teleport: player transform = NextObject's;
      // null next logs and returns, verbatim.
      const dest = this.resolvePosition?.(o.ns, o.nextKey) ?? null;
      if (!dest) { console.warn('[action] Teleport next object null - can\'t teleport'); return; }
      // ROAD-C c2/S8: RaiseOnTeleportActionEvent(thisAction.gameObject,
      // thisAction.NextObject) fires HERE (:596), one line BEFORE the
      // player transform is assigned - the automap's OnTeleportAction is
      // its only listener and it records the pair as a discovered portal.
      // The two endpoints are the same static layout rows the warp
      // itself resolves through, which is what keeps the automap's
      // string key byte-stable across saves.
      const from = this.resolvePosition?.(o.ns, o.positionKey) ?? (o.origin ? { pos: o.origin, yawDeg: 0 } : null);
      if (from) this.onTeleportPortal?.(from, dest);
      this.onTeleport?.(dest);
      return;
    }
    if (o.actionFlag === F.ShowText) {
      // Pop-up text: TEXT.RSC record Index + 8600, click anywhere to
      // close (the scene owns the box).
      this.onShowText?.(TYPE_11_TEXT_INDEX + o.index);
      return;
    }
    if (o.actionFlag === F.ShowTextWithInput) {
      // Pop-up with input: record Index + 5400; a case-insensitive
      // answer match fires ActivateNext (UserInputHandler) - the
      // ONLY path to this action's chain (Play skips the up-front
      // cascade for this flag).
      const textId = TYPE_12_TEXT_INDEX + o.index;
      const answers = TYPE_12_ANSWERS[textId];
      if (!answers) console.error(`[action] invalid key ${textId} for action type 12, couldn't get answer(s)`);
      this.onShowTextInput?.(textId, (userInput) => {
        if (!answers) return;
        const given = String(userInput ?? '').toLowerCase();
        if (answers.some((a) => a.toLowerCase() === given)) {
          const next = this._next(o);
          if (next) this.receive(next);
        }
      });
      return;
    }
    if (o.actionFlag === F.SetGlobalVar) {
      // DaggerfallAction.SetGlobalVar (:822-827), verbatim: "Global
      // variable index stored in action axis value" -
      // GlobalVars.SetGlobalVar(ActionAxisRawValue, true). The store
      // is PersistentGlobalVars.cs:53-59 (key -> bool), which the port
      // homes on the quest machine. DFU's trailing Debug.LogFormat is
      // the delegate's only other statement.
      this._setGlobalVar?.(o.axisRaw, true);
      return;
    }
    if (o.actionFlag === F.DoorText) this._runDoorText(o);
  }

  /** DoorText (0x63), verbatim: first activation shows record
   *  Index + 7700 as HUD text (2.0s); later activations run the
   *  classic trespass check (axisRaw > 5 -> MakeEnemiesHostile). The
   *  patch table rides actionEnabled, which the door's toggle gate
   *  also reads. */
  _runDoorText(o) {
    // activationCount was already incremented by Receive.
    let textId = TYPE_99_TEXT_INDEX + o.index;
    if (DOOR_TEXT_REMAP[textId]) textId = DOOR_TEXT_REMAP[textId];
    if (DOOR_TEXT_SKIP.has(TYPE_99_TEXT_INDEX + o.index)) o.actionEnabled = true;
    if (o.activationCount === 1 && textId !== TYPE_99_TEXT_INDEX && !o.actionEnabled) {
      this.onDoorText?.(textId);
    } else if (o.axisRaw > 5) {
      this.onTrespass?.();   // "classic seems to only check whether this value is greater than 5"
    }
  }

  /** Register a chain RELAY: an acting object whose delegate is
   *  routed through a scene seam (Teleport, the text actions,
   *  SetGlobalVar) or is a verbatim no-op (Activate, the Unknowns...).
   *  DFU's Play() cascades ActivateNext for (almost) EVERY flag
   *  before the delegate runs, so these must live in the chain or
   *  every link through them dies (audit 2026-08-16). aabb (when
   *  given) makes it a Direct/Attack/collision target like DFU's
   *  collider-carrying models. */
  addRelay(ns, positionKey, action, aabb = null, origin = null) {
    const key = `act:${ns}:${positionKey}`;
    const o = {
      key,
      ns,
      // ROAD-C c2/S8: the object's OWN block-local position byte. The
      // key already carries it, but a consumer should not have to parse
      // a key apart to ask the layout index where this object stands -
      // which is what the Teleport relay's automap report needs.
      positionKey,
      kind: 'relay',
      actionFlag: action.actionFlag ?? ACTION_FLAGS.None,
      index: action.index,
      axisRaw: action.axisRaw,
      activationCount: 0,
      state: 'start',
      nextKey: action.nextObject,
      triggerFlag: action.triggerFlag ?? TRIGGER_FLAGS.None,
      aabb,
      origin,
    };
    this._register(ns, positionKey, o);
    return o;
  }

  /** Register an action door (own bucket, closed-solid lifecycle).
   *  opts: ns + positionKey key the door into the chain graph
   *  (`act:{ns}:{pos}`) so LinkActionNodes-resolved nextObject
   *  reaches it; action is the door's OWN record (fires on player
   *  toggle through the Door trigger gate, verbatim
   *  ExecuteActionOnToggle); startingLockValue seeds
   *  currentLockValue (P10); loadID is the serialized identity
   *  (ROAD-B B4, RDBLayout.cs:242). */
  addDoor(cpu, baseMatrix, opts = {}) {
    const ns = opts.ns ?? 0;
    const key = opts.positionKey != null ? `act:${ns}:${opts.positionKey}` : `door:${this._doorCount++}`;
    const a = opts.action ?? null;
    const o = {
      key,
      ns,
      kind: 'door',
      cpu,
      base: baseMatrix,
      duration: DOOR_OPEN_DURATION,
      rotation: { x: 0, y: DOOR_OPEN_ANGLE, z: 0 },
      translation: { x: 0, y: 0, z: 0 },
      state: 'start', // start | forward | end | reverse - the SWING (DaggerfallActionDoor.currentState)
      t: 0,
      // The record's OWN Move state (DaggerfallAction.currentState),
      // independent of the swing: a Move-flagged door tweens by
      // ActionRotation/ActionTranslation over ActionDuration/20 while
      // the hinge does its own -90/1.5 s. Zeroed when the door has no
      // record (interiorContext builds doors with no action at all).
      moveState: 'start',
      moveT: 0,
      moveDuration: a ? (a.duration ?? 0) / 20 : 0,
      moveRotation: a?.rotation ?? { x: 0, y: 0, z: 0 },
      moveTranslation: a?.translation ?? { x: 0, y: 0, z: 0 },
      actionFlag: a ? (a.actionFlag ?? ACTION_FLAGS.None) : ACTION_FLAGS.None,
      index: a ? a.index : 0,
      magnitude: a ? a.magnitude : 0,
      axisRaw: a ? a.axisRaw : 0,
      isFlat: false,
      activationCount: 0,
      nextKey: a ? a.nextObject : -1,
      triggerFlag: a ? (a.triggerFlag ?? TRIGGER_FLAGS.None) : TRIGGER_FLAGS.None,
      startingLockValue: opts.startingLockValue ?? 0,
      currentLockValue: opts.startingLockValue ?? 0,
      // ROAD-B B4: DaggerfallActionDoor.LoadID / DaggerfallAction.LoadID -
      // blockData.Position + obj.Position, minted by rdbLayout. Both DFU
      // components carry the SAME value (RDBLayout.cs:1179 and :967 off
      // the one `loadID` local), so one field answers for both here. 0 is
      // DFU's own not-serialized default (interior doors, bare pins).
      loadID: opts.loadID ?? 0,
      // R1: AttemptLockpicking's retry gate (DaggerfallActionDoor.cs:36
      // FailedSkillLevel) - the skill the player FAILED at; a retry
      // waits for the live skill to differ. DFU's own field comment
      // there marks it "TODO: persist across save and load", but that
      // TODO is stale: SerializableActionDoor DOES round-trip it
      // (:78 save, :101 restore). AUDIT 26 F187 carried it into the
      // S12 snapshot to match - collectSaveData writes it beside the
      // lock and restoreSaveData reads it back (both below), so a
      // failed pick no longer forgets itself across a save.
      failedSkillLevel: 0,
      matrix: baseMatrix,
    };
    this.objects.set(key, o);
    if (opts.positionKey != null) this._links.set(`${ns}:${opts.positionKey}`, o);
    this.collider.addMesh(key, cpu.positions, cpu.indices, baseMatrix);
    return o;
  }

  /** Register a SPECIAL door (verbatim DaggerfallActionDoorSpecial):
   *  a plain placed model whose action flag is OpenDoor (or CloseDoor
   *  on a non-door) swings like a hinged door - same -90/1.5s and the
   *  same collider lifecycle - and its own record chains/fires like
   *  any action. No lock (the special door has none in DFU). */
  addSpecialDoor(ns, positionKey, cpu, baseMatrix, action) {
    const o = this.addDoor(cpu, baseMatrix, { ns, positionKey, action });
    o.special = true;
    return o;
  }

  /**
   * Register an action-record model (positionKey from the RDB link map;
   * chains resolve through action.nextObject).
   */
  addAction(ns, positionKey, cpu, baseMatrix, action) {
    const key = `act:${ns}:${positionKey}`;
    const o = {
      key,
      ns,
      kind: 'action',
      cpu,
      base: baseMatrix,
      index: action.index,   // A2: the RDB soundIndex plays on every Play
      duration: action.duration / 20,
      rotation: action.rotation,
      translation: action.translation,
      state: 'start',
      t: 0,
      nextKey: action.nextObject,
      triggerFlag: action.triggerFlag ?? TRIGGER_FLAGS.None,
      matrix: baseMatrix,
    };
    this._register(ns, positionKey, o);
    this.collider.addMesh(key, cpu.positions, cpu.indices, baseMatrix);
    return o;
  }

  /** A MOVE-flag acting FLAT (wave D). DFU gives a flat the SAME
   *  DaggerfallAction a model gets - AddActionFlatHelper
   *  (RDBLayout.cs:904-944) calls AddAction, whose Translation /
   *  Rotation / PositiveX..NegativeZ cases (RDBLayout.cs:998-1055)
   *  build ActionTranslation and ActionRotation for description "FLT"
   *  exactly as they do for a model - and a flat IS a transform, so
   *  iTween.MoveTo carries it. The port sent every move-flag flat to
   *  addRelay: the CHAIN lived and the MOTION did not.
   *
   *  Two things separate this from addAction, and both are DFU's own:
   *
   *  - NO MESH, so no collider bucket. AddAction's flat arm attaches a
   *    BoxCollider with `isTrigger = true` (RDBLayout.cs:977-987) -
   *    for raycasting, expressly not for standing on - so the object
   *    carries an `aabb` that TRAVELS with it and never a solid.
   *    `frameDelta` stays null for the same reason: a trigger is not a
   *    moving platform.
   *
   *  - THE ROTATION IS INVISIBLE AND THAT IS VERBATIM. DFU rotates the
   *    flat's transform, and DaggerfallBillboard re-faces the camera
   *    every frame regardless, so a rotating flat looks identical to a
   *    still one there too. The port holds the rotation in the state
   *    machine (it is what `t` advances) and shows the translation,
   *    which is exactly what the engine shows.
   *
   *  `origin` is the flat's placed world position - iTween's
   *  StartingPosition, the point `position: StartingPosition +
   *  ActionTranslation` is measured from (DaggerfallAction.cs:372). */
  addMoveFlat(ns, positionKey, action, origin, aabb = null) {
    const key = `act:${ns}:${positionKey}`;
    const o = {
      key,
      ns,
      positionKey,
      kind: 'moveFlat',
      isFlat: true,
      actionFlag: action.actionFlag,
      index: action.index,        // the RDB soundIndex plays on every Play
      magnitude: action.magnitude,
      axisRaw: action.axisRaw,
      // AddActionFlatHelper passes duration 0 (RDBLayout.cs:915), so a
      // flat Translation/Rotation tween is INSTANT and only the six
      // PositiveX..NegativeZ flags (which set ActionDuration = 50
      // themselves) take 2.5s. That quirk is the data's, kept.
      duration: action.duration / 20,
      rotation: action.rotation,
      translation: action.translation,
      origin: [origin[0], origin[1], origin[2]],
      offset: [0, 0, 0],
      pos: [origin[0], origin[1], origin[2]],
      aabb,
      baseAabb: aabb ? { min: [...aabb.min], max: [...aabb.max] } : null,
      activationCount: 0,
      state: 'start',
      t: 0,
      nextKey: action.nextObject,
      triggerFlag: action.triggerFlag ?? TRIGGER_FLAGS.None,
    };
    this._register(ns, positionKey, o);
    return o;
  }

  /** The moveFlat half of _applyMatrix: the live translation off the
   *  placed origin, and the trigger box that travels with it. Written
   *  IN PLACE - the host holds these arrays (the billboard batch reads
   *  `offset`, the activation scan reads `aabb`) and a fresh object
   *  every frame would strand both. */
  _applyFlat(o) {
    const p = o.t;
    o.offset[0] = o.translation.x * p;
    o.offset[1] = o.translation.y * p;
    o.offset[2] = o.translation.z * p;
    for (let i = 0; i < 3; i++) {
      o.pos[i] = o.origin[i] + o.offset[i];
      if (o.aabb && o.baseAabb) {
        o.aabb.min[i] = o.baseAabb.min[i] + o.offset[i];
        o.aabb.max[i] = o.baseAabb.max[i] + o.offset[i];
      }
    }
    this.onFlatMoved?.(o);
  }

  /** DaggerfallAction.IsPlaying: this ACTION's own state, or anything
   *  down the chain. On a door that is `currentState` of the
   *  DaggerfallAction component - the record's Move state, NOT the
   *  hinge swing (they are separate components with separate fields),
   *  so a swinging door does not gate its own record. */
  _isPlaying(o, depth = 0) {
    const s = o.kind === 'door' ? o.moveState : o.state;
    if (s === 'forward' || s === 'reverse') return true;
    if (depth > 32) return false;
    const next = this._next(o);
    return next ? this._isPlaying(next, depth + 1) : false;
  }

  /** DaggerfallAction.Receive: the verbatim trigger gate, then Play.
   *  ActionObject (the chain cascade) is always valid; every other
   *  trigger type must be accepted by the object's TriggerFlag. */
  receive(o, triggerType = 'ActionObject') {
    if (this._isPlaying(o)) return;
    // ROAD-B B4: DaggerfallAction.cs:183 - the hack runs AFTER the
    // IsPlaying gate and BEFORE the trigger-flag switch, so it fires
    // even for a trigger type this object's TriggerFlag would refuse.
    this._castleDaggerfallMagicDoorsSpecialOpenHack(o);
    if (triggerType !== 'ActionObject') {
      const allowed = TRIGGER_GATE[o.triggerFlag ?? TRIGGER_FLAGS.None];
      if (!allowed || !allowed.includes(triggerType)) return;
    }
    o.activationCount = (o.activationCount ?? 0) + 1;   // verbatim: Receive increments, then Plays
    this._play(o);
  }

  /** ROAD-B B4: DaggerfallAction.CastleDaggerfallMagicDoorsSpecialOpenHack
   *  (DaggerfallAction.cs:256-273), verbatim and in DFU's own order:
   *
   *    if (PlayerEnterExit.PlayerTeleportedIntoDungeon &&
   *        PlayerEnterExit.IsPlayerInsideDungeon &&
   *        PlayerGPS.CurrentLocation.MapTableData.MapId == 1291010263 &&
   *        (loadID == 29331574 || loadID == 29331622))
   *    {
   *        DaggerfallActionDoor door = GetComponent<DaggerfallActionDoor>();
   *        if (door && door.IsLocked && door.IsClosed)
   *        { door.CurrentLockValue = 0; door.ToggleDoor(); }
   *    }
   *
   *  The numeric tests come first and the component lookup last, which
   *  is DFU's stated reason for putting the check on this path at all
   *  ("very fast and doesn't require any scene searches"). `o.kind ===
   *  'door'` IS the GetComponent - only addDoor mints a hinge-swinging
   *  object with currentLockValue/state. IsLocked is currentLockValue >
   *  0 and IsClosed is the SWING state 'start' (DaggerfallActionDoor.cs
   *  :71-84), not the record's Move state. ToggleDoor() is called with
   *  its default activatedByPlayer = false, so the unlocked door opens
   *  without re-running the DoorText hold or the locked-door refusal. */
  _castleDaggerfallMagicDoorsSpecialOpenHack(o) {
    const ctx = this._magicDoorsContext?.();
    if (!ctx) return;
    if (!ctx.playerTeleportedIntoDungeon) return;
    if (!ctx.isPlayerInsideDungeon) return;
    if (ctx.currentMapId !== CASTLE_DAGGERFALL_MAP_ID) return;
    if (!CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS.includes(o.loadID)) return;
    if (o.kind !== 'door') return;                        // GetComponent<DaggerfallActionDoor>()
    if (!(o.currentLockValue > 0 && o.state === 'start')) return;   // IsLocked && IsClosed
    o.currentLockValue = 0;
    this.toggleDoor(o);
  }

  /** @param selfToggle - true only on the ExecuteActionOnToggle path
   *  (see _execOwnAction). */
  _play(o, selfToggle = false) {
    // ActivateNext cascades BEFORE this object's own delegate, for
    // every flag EXCEPT ShowTextWithInput (verbatim Play; relays
    // exist for exactly this, and the input box's chain fires only
    // through a matching answer).
    if (o.actionFlag !== ACTION_FLAGS.ShowTextWithInput) {
      const next = this._next(o);
      if (next) this.receive(next);
    }
    // A2: DaggerfallAction.Play - "if (PlaySound && Index > 0)
    // audioSource.Play()": the RDB soundIndex fires on every Play,
    // movers and effect actions alike (the scene owns the engine).
    if (o.index > 0) this.onActionSound?.(o);
    if (o.kind === 'effect') { this._runEffect(o); return; }
    if (o.kind === 'relay') { this._runRelay(o); return; }
    if (o.kind === 'door') { this._dispatchDoor(o, selfToggle); return; }
    if (o.duration <= 0) {
      // Instant flip, still honoring the state cycle. (iTween with
      // time 0 fires its oncomplete SetState on the spot; a FLAT gets
      // here on every Translation/Rotation, since AddActionFlatHelper
      // hands AddAction a duration of 0.)
      o.state = o.state === 'start' || o.state === 'reverse' ? 'end' : 'start';
      o.t = o.state === 'end' ? 1 : 0;
      if (o.kind === 'moveFlat') { this._applyFlat(o); return; }
      this._applyMatrix(o);
      if (o.kind === 'action') {
        this.collider.removeBucket(o.key);
        this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.matrix);
      }
      return;
    }
    if (o.state === 'start') o.state = 'forward';
    else if (o.state === 'end') o.state = 'reverse';
  }

  /** Play's delegate table for a door: DFU dispatches
   *  actionFunctions[ActionFlag] on whatever GameObject carries the
   *  DaggerfallAction, and RDBLayout attaches one to the action-door
   *  GameObject itself (AddActionDoor -> HasAction -> AddActionModelHelper),
   *  so a door gets the SAME table as any other action object. Move
   *  tweens the door; the door verbs act on it; effects hurt; every
   *  remaining flag is a routed relay or a verbatim no-op (a chained
   *  None-flag door does NOT open - there is no delegate). */
  _dispatchDoor(o, selfToggle = false) {
    if (MOVE_ACTION_FLAGS.has(o.actionFlag)) { this._doorMove(o); return; }
    if (DOOR_VERB_FLAGS.has(o.actionFlag)) {
      // The one carve-out: on the ExecuteActionOnToggle path the
      // player's toggle IS the verb. DFU re-enters ToggleDoor here and
      // its guards collapse the second toggle into the first (the open
      // sound is suppressed by "currentState != PlayingForward"); the
      // settled state is the same, so we skip instead of re-entering.
      if (!selfToggle) this._doorVerb(o);
      return;
    }
    if (EFFECT_ACTION_FLAGS.has(o.actionFlag)) { this._runEffect(o); return; }
    this._runRelay(o);
  }

  /** DaggerfallAction.Move on a door: the record's own tween, wholly
   *  separate from the hinge swing (two iTweens, one transform). */
  _doorMove(o) {
    if (o.moveDuration <= 0) {
      // A zero-duration tween completes on the spot (iTween fires its
      // oncomplete SetState immediately), still honoring the cycle.
      if (o.moveState === 'start') { o.moveState = 'end'; o.moveT = 1; }
      else if (o.moveState === 'end') { o.moveState = 'start'; o.moveT = 0; }
      else return;
      this._applyMatrix(o);
      this._settleDoorBucket(o);
      return;
    }
    if (o.moveState === 'start') o.moveState = 'forward';
    else if (o.moveState === 'end') o.moveState = 'reverse';
  }

  /** ToggleDoor: no-op while moving; otherwise Open or Close. */
  toggleDoor(o, byPlayer = false) {
    if (o.state === 'forward' || o.state === 'reverse') return false;   // IsMoving
    if (o.state === 'end') return this._closeDoor(o, byPlayer);
    return this._openDoor(o, false, byPlayer);
  }

  /** Verbatim DaggerfallActionDoor.Open, in DFU's order:
   *   1. the DoorText first-activation hold (player only) - show the
   *      text and do NOT open;
   *   2. refuse a locked door with the LookAtInteriorLock text (P10);
   *   3. fire the door's own record (ExecuteActionOnToggle) BEFORE the
   *      tween starts, so the record sees the door still closed;
   *   4. tween, make the collider a trigger (bucket gone), sound,
   *      PlayingForward, CurrentLockValue = 0.
   *  Returns true when the swing started. */
  _openDoor(o, ignoreLocks = false, byPlayer = false) {
    if (o.actionFlag === ACTION_FLAGS.DoorText && o.index > 0
        && (o.triggerFlag === TRIGGER_FLAGS.Door || o.triggerFlag === TRIGGER_FLAGS.Direct
          || o.triggerFlag === TRIGGER_FLAGS.MultiTrigger)
        && o.activationCount === 0 && byPlayer) {
      this._execOwnAction(o);
      // ActionEnabled is still false if there was text to display: hold
      // the door shut for this first activation.
      if (!o.actionEnabled) return false;
    }
    if (o.currentLockValue > 0 && !ignoreLocks) {
      if (byPlayer) this.onLockedDoor?.(o);
      return false;
    }
    if (byPlayer) this._execOwnAction(o);
    this.collider.removeBucket(o.key);   // MakeTrigger(true)
    this.onDoorState?.(o, true);         // A1: the audio seam (open)
    o.state = 'forward';
    o.currentLockValue = 0;
    return true;
  }

  /** Verbatim DaggerfallActionDoor.Close: PlayingReverse, then the
   *  door's own record. The collider stays a trigger until the close
   *  COMPLETES (OnCompleteClose's MakeTrigger(false)). */
  _closeDoor(o, byPlayer = false) {
    if (o.state === 'start') return false;   // IsClosed
    o.state = 'reverse';
    // AUDIT 26 F184: Close() plays NOTHING (:311-332) - the CloseSound
    // is OnCompleteClose's (:339-346), after the 1.5s swing and just
    // before the collider solidifies. The emit moved to the swing's
    // completion below; every door used to shut audibly a second and
    // a half before it shut. (The OPEN side already matched DFU:
    // sound at the START, :296-302.)
    if (byPlayer) this._execOwnAction(o);
    return true;
  }

  // The door-verb delegates, verbatim DaggerfallAction (each acts on
  // the door the record is attached to). ToggleDoor's moving guard
  // stands in for DFU's mid-tween iTween re-fire (a re-fire while
  // moving re-tweens in DFU; here it waits - the settled states match).
  _doorVerb(o) {
    const F = ACTION_FLAGS;
    if (o.actionFlag === F.OpenDoor) {
      if (o.state === 'end') return;            // already open
      o.currentLockValue = 0;                   // unlock + open
      this.toggleDoor(o);
    } else if (o.actionFlag === F.CloseDoor) {
      if (o.state !== 'end') return;            // only closes an OPEN door
      this.toggleDoor(o);
      o.currentLockValue = o.startingLockValue; // re-lock to the starting value
    } else if (o.actionFlag === F.LockDoor) {
      if (o.currentLockValue <= 0) o.currentLockValue = ACTION_LOCK_VALUE; // "don't know what setting Daggerfall uses here"
    } else if (o.actionFlag === F.UnlockDoor) {
      o.currentLockValue = 0;
    }
  }

  /** Verbatim ExecuteActionOnToggle: a door that is ALSO an action
   *  object fires its record on the toggle as
   *  `action.Receive(gameObject, TriggerTypes.Door)` - the FULL Receive,
   *  i.e. the IsPlaying gate and the activation counter as well as the
   *  Door trigger gate, then Play's whole delegate table (audit 18: the
   *  hand-rolled tail here ran only effects and DoorText, so a door's
   *  ShowText/Teleport/SetGlobalVar record was dropped, and it skipped
   *  IsPlaying so the record re-fired while its chain was mid-tween).
   *  A door with no action record has no component to Receive on. */
  _execOwnAction(o) {
    if (o.actionFlag === ACTION_FLAGS.None && o.nextKey === -1) return;
    if (this._isPlaying(o)) return;
    const allowed = TRIGGER_GATE[o.triggerFlag ?? TRIGGER_FLAGS.None];
    if (!allowed || !allowed.includes('Door')) return;
    o.activationCount = (o.activationCount ?? 0) + 1;
    this._play(o, true);
  }

  /** Verbatim DaggerfallActionDoor.AttemptBash: an OPEN door bash-
   *  closes; a closed door that is not magically held (lock < 20)
   *  rolls d100 under (20 - CurrentLockValue) to burst open, clearing
   *  the lock. Player bashes fire the door's own record exactly like
   *  ToggleDoor(true) does (AttemptBash calls it). The bash sound
   *  rides the onDoorBash seam (wired in the 2026-08-16c audit); the
   *  castle MakeEnemiesHostile bit rides onMakeEnemiesHostile (below).
   *  rollProvider defaults to the system's rolls stream.
   *  A SPECIAL door is not bashable at all: DaggerfallActionDoorSpecial
   *  is a separate component and WeaponManager.WeaponEnvDamage only
   *  reaches AttemptBash through GetComponent<DaggerfallActionDoor>,
   *  which a special door does not have ("player cannot open, bash,
   *  pick, or cast their way through this type of door"). The refusal
   *  is BEFORE the bash sound - there is no door to hear.
   *
   *  ROAD-B: ...and the TAIL is no longer "routed". :220-221
   *
   *      if (byPlayer && PlayerEnterExit.IsPlayerInsideDungeonCastle)
   *          GameManager.Instance.MakeEnemiesHostile();
   *
   *  sits AFTER all three arms and outside every one of their returns,
   *  so it runs on a bash-close, on a burst lock, AND on a failed roll
   *  - taking a swing at a castle's door is what turns the castle on
   *  you, not succeeding at it. The two early `return false`s above it
   *  are the port's own compression of arms DFU expresses as
   *  if/else-if, so the tail has to be lifted above them to keep
   *  running on every path C# reaches it on; the magically-held door
   *  is the one that made that visible (DFU falls out of the else-if
   *  and still calls it).
   *
   *  `byPlayer` is DFU's own parameter (:193). Its false caller is
   *  EnemyAttack.cs:210 - a FOE bashing the door it lost the player
   *  behind - which this port has no arm for yet; the default is
   *  therefore true (the player swing, `envAttack`) and the parameter
   *  exists so the foe arm cannot land without answering it. */
  attemptBash(o, roll01 = this._rolls(), { byPlayer = true } = {}) {
    if (o.kind !== 'door' || o.special) return false;
    this.onDoorBash?.(o);   // A1 seam (PlayerDoorBash)
    // :220-221, hoisted above the returns below - see the note.
    if (byPlayer && this._insideDungeonCastle()) this.onMakeEnemiesHostile?.();
    if (o.state === 'end') {
      this.toggleDoor(o, true);   // bash-close; ToggleDoor(true) fires the record
      return true;
    }
    if (o.currentLockValue >= MAGIC_LOCK_THRESHOLD) return false;   // magically held: cannot bash
    const chance = 20 - o.currentLockValue;
    if (Math.floor(roll01 * 100) < chance) {      // Dice100.SuccessRoll
      o.currentLockValue = 0;
      this.toggleDoor(o, true);
      return true;
    }
    return false;
  }

  /** Player activation entry, verbatim PlayerActivate's ray tail: the
   *  action-door check and the action-record check are two SEPARATE ifs
   *  with no else between them, so a click on an acting door runs
   *  ActivateActionDoor -> ToggleDoor(true) AND THEN
   *  ActionCheck -> Receive(Direct). A SPECIAL door has no
   *  DaggerfallActionDoor component, so ActionDoorCheck misses it and
   *  only the Direct Receive lands - which its None/Collision01 trigger
   *  flag then rejects. That is why a secret door is lever-only. */
  activate(key, { steal = false, doorSpell = null } = {}) {
    const o = this.objects.get(key);
    if (!o) return false;
    // X1: an ARMED Open/Lock spell fires on the next door activated
    // and consumes itself, whatever the interaction mode - DFU's Open
    // and Lock wait in forcedRoundsRemaining for exactly this and
    // CancelEffect on the trigger (Open.cs:118-121, Lock.cs:116). The
    // caller supplies the armed state and hears the outcome through
    // onDoorSpell, then drops the effect; the LAWS live in
    // systems/mysticism.js, which this file calls rather than copies.
    if (doorSpell && o.kind === 'door' && !o.special) {
      const result = doorSpell.kind === 'open'
        ? triggerOpen(o, doorSpell.holderLevel, { castBySkeletonKey: doorSpell.skeletonKey === true })
        : triggerLock(o, doorSpell.holderLevel);
      // X3: BOTH swings are ToggleDoor(activatedByPlayer), and this
      // path IS the player activating (Open.cs:131, Lock.cs:122-126).
      // Lock's auto-close passed false, which suppresses the door's
      // own action record - a door wired to fire a trap or a linked
      // mover on close stayed silent when a Lock spell shut it.
      if (result.opened) this.toggleDoor(o, true);
      if (result.closed) this.toggleDoor(o, true);
      this.onDoorSpell?.(o, doorSpell.kind, result);
      this.receive(o, 'Direct');
      return true;
    }
    // R1: ActivateActionDoor's mode routing (PlayerActivate.cs:698-703):
    // Steal mode on a LOCKED, not-open door attempts the pick; every
    // other combination toggles (whose lock gate speaks the look-at
    // text). The Direct Receive still follows either arm - the two
    // separate ifs of the ray tail.
    if (o.kind === 'door' && !o.special) {
      if (steal && o.currentLockValue > 0 && o.state !== 'end') this.attemptLockpicking(o);
      else this.toggleDoor(o, true);
    }
    this.receive(o, 'Direct');   // player activation = the Direct trigger type (the gate table applies)
    return true;
  }

  /** DaggerfallActionDoor.AttemptLockpicking (:147-191), verbatim:
   *  no-op while the door swings; a SILENT return while the live
   *  Lockpicking skill still equals the recorded failure (the
   *  C# == test, so a skill that moved EITHER way re-opens the
   *  attempt); a magically held lock (>= 20) speaks the failure line
   *  with NO tally, NO roll and NO record; otherwise the attempt
   *  tallies Lockpicking BEFORE the roll, rolls d100 under
   *  CalculateInteriorLockpickingChance, and on success zeroes the
   *  lock and opens the door (ToggleDoor(true)), on failure records
   *  the skill level. No lockpick ITEM is required - DFU checks no
   *  inventory. */
  attemptLockpicking(o) {
    if (o.state === 'forward' || o.state === 'reverse') return false;   // IsMoving
    const skill = this._lockpickSkill();
    if (o.failedSkillLevel === skill) return false;   // the retry gate (:157) - == exactly, so a skill moved EITHER way re-opens it
    if (o.currentLockValue >= MAGIC_LOCK_THRESHOLD) {
      this.onLockpickResult?.(o, false);   // :187-190 - the magic arm is failure-with-no-roll
      return false;
    }
    this.onLockpickTally?.();   // TallySkill(Lockpicking, 1) (:165)
    const chance = interiorLockpickingChance(this._playerLevel(), o.currentLockValue, skill);
    if (!dice100(chance, this._rolls())) {   // Dice100.FailedRoll(chance) - Range(0,100) >= chance, the attemptBash convention
      this.onLockpickResult?.(o, false);
      o.failedSkillLevel = skill;   // :171
      return false;
    }
    this.onLockpickResult?.(o, true);
    o.currentLockValue = 0;   // :176
    this.toggleDoor(o, true);   // :184 - a successful pick opens the door
    return true;
  }

  /** GetSaveData for the whole action graph (S12): one record per
   *  object, keyed by the chain key.
   *
   *  A door that also carries a record is ONE GameObject with TWO
   *  serializable components in DFU, and therefore TWO save records:
   *  the door prefab's SerializableActionDoor persists the SWING
   *  (currentState + the live tween's Percentage + currentLockValue,
   *  SerializableActionDoor.cs:73-89) and RDBLayout attaches a
   *  SerializableActionObject to that same GameObject through
   *  AddActionModelHelper -> AddAction (RDBLayout.cs:258, :970-973),
   *  which persists the record's own MOVE (currentState + its tween's
   *  Percentage, SerializableActionObject.cs:61-76). One port object,
   *  so one record with both halves: {state, t} is the swing,
   *  {moveState, moveT} the record's Move. Without the second pair a
   *  Move-flagged door saved mid-rise snapped back to its base pose on
   *  load (AUDIT 18 / AUDIT 23 save-load-11).
   *
   *  failedSkillLevel rides the door record since AUDIT 26 F187. */
  collectSaveData() {
    // AUDIT 26 F185: activationCount is NOT in the record.
    // SerializableActionObject persists position/rotation/state/tween
    // only (:55-88) and the scene rebuilds on load, so every counter
    // restarts at 0 in DFU - a DoorText door re-shows its text and
    // holds shut on the first click after a load, and Hurt21's
    // every-twentieth-hit phase restarts. The port carried it and
    // diverged after every save.
    // AUDIT 26 F187: failedSkillLevel IS in the door record
    // (SerializableActionDoor :77, :99-101) - without it a failed
    // pick could be retried across a save/load.
    return [...this.objects.values()].map((o) => ({
      key: o.key, state: o.state, t: o.t ?? 0,
      ...(o.kind === 'door'
        ? { lock: o.currentLockValue, failedSkillLevel: o.failedSkillLevel ?? 0, moveState: o.moveState, moveT: o.moveT ?? 0 }   // P10 lock; the Move pair
        : {}),
    }));
  }

  /** RestoreSaveData for the whole action graph: set the saved state,
   *  then settle. Both DFU halves restore the state and then restart
   *  the tween over what is LEFT of it - RestartTween(1 - percentage)
   *  scales Duration by the unplayed remainder
   *  (SerializableActionDoor.cs:99-100, SerializableActionObject.cs
   *  :86-87, resolving to DaggerfallAction.cs:353-359 and
   *  DaggerfallActionDoor.cs:243-251). The port's t/moveT are that same
   *  progress read the other way round, and update() advances them by
   *  dt/duration, so restoring the pair IS the restarted tween - the
   *  remaining (1 - t) * duration plays out and no more.
   *
   *  Every field past {state, t, activationCount} is presence-gated:
   *  snapshots written before a field existed leave the live value, the
   *  additive shape this save layer uses everywhere. */
  restoreSaveData(list) {
    list?.forEach((sa) => {
      const o = this.objects.get(sa.key);
      if (!o) return;
      o.state = sa.state;
      o.t = sa.t;
      // F185: activationCount deliberately NOT restored - an old
      // envelope still carrying the field is ignored, so every
      // counter starts the rebuilt scene at 0, as DFU's does.
      if (o.kind === 'door') {
        if (sa.lock != null) o.currentLockValue = sa.lock;   // P10: door locks persist
        if (sa.failedSkillLevel != null) o.failedSkillLevel = sa.failedSkillLevel;   // F187: the pick latch survives
        if (sa.moveState != null) { o.moveState = sa.moveState; o.moveT = sa.moveT ?? 0; }
      }
      this.syncRestored(o);
    });
  }

  /** S12 restore reconciliation (P10): recompute a restored object's
   *  matrix and settle its collider bucket - a door restored OPEN
   *  must not stay solid (and was, latently, before P10); movers
   *  rebuild at the restored pose. */
  syncRestored(o) {
    // A flat carries a SerializableActionObject in DFU exactly as a
    // model does (RDBLayout.cs:970-973 runs for both), so its record
    // restores and settles here too - there is just no bucket to
    // reconcile, only the offset and the trigger box.
    if (o.kind === 'moveFlat') {
      if (o.state === 'start') o.t = 0;
      else if (o.state === 'end') o.t = 1;
      this._applyFlat(o);
      return;
    }
    if (o.kind !== 'door' && o.kind !== 'action') return;
    if (o.kind === 'door' && o.state === 'start') { o.t = 0; }
    if (o.kind === 'door') {
      if (o.moveState === 'start') o.moveT = 0;
      else if (o.moveState === 'end') o.moveT = 1;
    }
    this._applyMatrix(o);
    this.collider.removeBucket(o.key);
    if (o.kind === 'door') {
      // A door is solid only while its swing is fully closed - at its
      // LIVE pose, which a Move record may have carried off the base.
      if (o.state === 'start') this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.matrix);
    } else {
      this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.matrix);
    }
  }

  /** A door is a solid obstacle only while the hinge is fully closed
   *  (MakeTrigger); its bucket must sit at the LIVE matrix, since a
   *  Move record can carry the closed door away from its base. */
  _settleDoorBucket(o) {
    this.collider.removeBucket(o.key);
    if (o.state === 'start') this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.matrix);
  }

  _applyMatrix(o) {
    const p = o.t;
    const translate = trs(
      o.translation.x * p, o.translation.y * p, o.translation.z * p, 0, 0, 0);
    // trs takes DEGREES (Ry * Rx * Rz, the layout convention).
    const rotate = trs(
      0, 0, 0,
      o.rotation.x * p,
      o.rotation.y * p,
      o.rotation.z * p);
    let m = multiply(translate, multiply(o.base, rotate));
    if (o.kind === 'door' && o.moveT) {
      // The record's Move rides the SAME transform as the hinge (two
      // iTweens, one GameObject): MoveTo is world, so it pre-multiplies
      // like the mover translation above, and RotateBy is Space.Self,
      // so it post-multiplies like the hinge.
      const q = o.moveT;
      const mt = trs(
        o.moveTranslation.x * q, o.moveTranslation.y * q, o.moveTranslation.z * q, 0, 0, 0);
      const mr = trs(
        0, 0, 0,
        o.moveRotation.x * q, o.moveRotation.y * q, o.moveRotation.z * q);
      m = multiply(mt, multiply(m, mr));
    }
    o.matrix = m;
  }

  update(dt) {
    for (const o of this.objects.values()) {
      if (o.kind === 'door') { this._tickDoor(o, dt); continue; }
      if (o.state !== 'forward' && o.state !== 'reverse') { o.frameDelta = null; continue; }
      const dir = o.state === 'forward' ? 1 : -1;
      // A zero-duration tween is instant (and _play never leaves one
      // in a playing state), so the guard is for the restored-state
      // path and for a dt of exactly 0, which would otherwise make t
      // NaN rather than snapping it.
      o.t = Math.max(0, Math.min(1, o.t + (o.duration > 0 ? (dir * dt) / o.duration : dir)));
      if (o.kind === 'moveFlat') {
        this._applyFlat(o);
        // A trigger box is not a moving platform - DFU's flat collider
        // is `isTrigger = true` and nothing rides it.
        o.frameDelta = null;
        if (o.state === 'forward' ? o.t >= 1 : o.t <= 0) o.state = o.state === 'forward' ? 'end' : 'start';
        continue;
      }
      const px = o.matrix[12], py = o.matrix[13], pz = o.matrix[14];
      this._applyMatrix(o);
      // Platform riding (2026-08-14): the frame's translation delta -
      // the scene moves a standing player by exactly this (DFU
      // MoveWithMovingPlatform's global-point delta, translation-only
      // movers; doors rotate and never ride).
      o.frameDelta = o.kind === 'action' ? [o.matrix[12] - px, o.matrix[13] - py, o.matrix[14] - pz] : null;
      const done = o.state === 'forward' ? o.t >= 1 : o.t <= 0;
      if (o.kind === 'action') {
        // Standing collision follows the mover every frame.
        this.collider.removeBucket(o.key);
        this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.matrix);
      }
      if (done) o.state = o.state === 'forward' ? 'end' : 'start';
    }
  }

  /** A door advances TWO tweens: the hinge swing and, when its record
   *  is a Move, the record's own translation/rotation. Either can be
   *  live without the other. */
  _tickDoor(o, dt) {
    const swinging = o.state === 'forward' || o.state === 'reverse';
    const moving = o.moveState === 'forward' || o.moveState === 'reverse';
    o.frameDelta = null;   // doors rotate and never ride
    if (!swinging && !moving) return;
    if (swinging) {
      const dir = o.state === 'forward' ? 1 : -1;
      o.t = Math.max(0, Math.min(1, o.t + (dir * dt) / o.duration));
    }
    if (moving) {
      const dir = o.moveState === 'forward' ? 1 : -1;
      o.moveT = Math.max(0, Math.min(1, o.moveT + (dir * dt) / o.moveDuration));
    }
    this._applyMatrix(o);
    if (swinging && (o.state === 'forward' ? o.t >= 1 : o.t <= 0)) {
      const closing = o.state === 'reverse';
      o.state = o.state === 'forward' ? 'end' : 'start';
      // F184: THIS is OnCompleteClose - the sound, then MakeTrigger(false)
      // below, in DFU's own order.
      if (closing) this.onDoorState?.(o, false);
    }
    if (moving && (o.moveState === 'forward' ? o.moveT >= 1 : o.moveT <= 0)) {
      o.moveState = o.moveState === 'forward' ? 'end' : 'start';
    }
    // Close-complete makes the door solid again (OnCompleteClose's
    // MakeTrigger(false)); a moving closed door drags its bucket along.
    if (o.state === 'start') this._settleDoorBucket(o);
  }
}
