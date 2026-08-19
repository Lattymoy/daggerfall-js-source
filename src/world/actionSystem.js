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

// Delegated relays (P10/U6): Teleport and the text actions run
// through scene seams inside _runRelay. Activate (0x1e) is a VERBATIM
// no-op - DFU's delegate body is `return;` - and so are Dialogue and
// the Unknowns, which have no delegate at all; for those the cascade
// IS the behavior. SetGlobalVar (0x1f) is NOT one of them: DFU's
// delegate calls PlayerEntity.GlobalVars.SetGlobalVar(ActionAxisRawValue,
// true), and it is UNPORTED here pending a quest-system global-var
// store (Port-Ledger C). Its cascade still runs.

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

export class ActionSystem {
  constructor(collider, { damagePlayer = null, drainMagicka = null, castSpell = null, playerLevel = () => 1, rolls = Math.random } = {}) {
    this.collider = collider;
    this.objects = new Map(); // key -> runtime object
    this._links = new Map();  // `${ns}:${position}` -> object (the chain graph)
    this._doorCount = 0;
    this._damagePlayer = damagePlayer;
    this._drainMagicka = drainMagicka;
    this._castSpell = castSpell;
    this._playerLevel = playerLevel;
    this._rolls = rolls;
    // Scene seams (P10/U6/A2):
    //   resolvePosition(ns, positionKey) -> { pos: [x,y,z], yawDeg }
    //     (teleport destinations - actionless objects live only in
    //     the layout's position index, not this graph)
    //   onTeleport({ pos, yawDeg })  - warp the player
    //   onLockedDoor(door)           - the classic look-at-lock text
    //   onActionSound(o)             - Play's soundIndex (Index > 0)
    //   onShowText(textId) / onShowTextInput(textId, submit)
    //   onDoorText(textId) / onTrespass()
    //   onDoorState(o, opening) / onDoorBash(o) - the A1 audio seams
    this.resolvePosition = null;
    this.onTeleport = null;
    this.onLockedDoor = null;
    this.onActionSound = null;
    this.onShowText = null;
    this.onShowTextInput = null;
    this.onDoorText = null;
    this.onTrespass = null;
    this.onDoorState = null;
    this.onDoorBash = null;
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
      if (this._damagePlayer) this._damagePlayer(dmg);
    } else if (o.actionFlag >= F.Hurt22 && o.actionFlag <= F.Hurt25) {
      const dmg = (o.isFlat ? o.magnitude : o.axisRaw) * lvl;
      if (this._damagePlayer) this._damagePlayer(dmg);
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

  /** The delegated-relay delegates (P10/U6): Teleport + the text
   *  actions, routed through the scene seams. Every OTHER relay flag
   *  is a verbatim no-op whose cascade is the behavior. */
  _runRelay(o) {
    const F = ACTION_FLAGS;
    if (o.actionFlag === F.Teleport) {
      // DaggerfallAction.Teleport: player transform = NextObject's;
      // null next logs and returns, verbatim.
      const dest = this.resolvePosition?.(o.ns, o.nextKey) ?? null;
      if (!dest) { console.warn('[action] Teleport next object null - can\'t teleport'); return; }
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
   *  routed through a scene seam (Teleport, the text actions), is a
   *  verbatim no-op (Activate, the Unknowns...), or is UNPORTED
   *  (SetGlobalVar - see the flag note at the top of this file).
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
   *  currentLockValue (P10). */
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
    if (triggerType !== 'ActionObject') {
      const allowed = TRIGGER_GATE[o.triggerFlag ?? TRIGGER_FLAGS.None];
      if (!allowed || !allowed.includes(triggerType)) return;
    }
    o.activationCount = (o.activationCount ?? 0) + 1;   // verbatim: Receive increments, then Plays
    this._play(o);
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
      // Instant flip, still honoring the state cycle.
      o.state = o.state === 'start' || o.state === 'reverse' ? 'end' : 'start';
      o.t = o.state === 'end' ? 1 : 0;
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
    this.onDoorState?.(o, false);   // A1: the audio seam (close)
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
   *  castle MakeEnemiesHostile bit stays routed (crime).
   *  rollProvider defaults to the system's rolls stream.
   *  A SPECIAL door is not bashable at all: DaggerfallActionDoorSpecial
   *  is a separate component and WeaponManager.WeaponEnvDamage only
   *  reaches AttemptBash through GetComponent<DaggerfallActionDoor>,
   *  which a special door does not have ("player cannot open, bash,
   *  pick, or cast their way through this type of door"). The refusal
   *  is BEFORE the bash sound - there is no door to hear. */
  attemptBash(o, roll01 = this._rolls()) {
    if (o.kind !== 'door' || o.special) return false;
    this.onDoorBash?.(o);   // A1 seam (PlayerDoorBash)
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
  activate(key) {
    const o = this.objects.get(key);
    if (!o) return false;
    if (o.kind === 'door' && !o.special) this.toggleDoor(o, true);
    this.receive(o, 'Direct');   // player activation = the Direct trigger type (the gate table applies)
    return true;
  }

  /** S12 restore reconciliation (P10): recompute a restored object's
   *  matrix and settle its collider bucket - a door restored OPEN
   *  must not stay solid (and was, latently, before P10); movers
   *  rebuild at the restored pose. */
  syncRestored(o) {
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
      o.t = Math.max(0, Math.min(1, o.t + (dir * dt) / o.duration));
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
      o.state = o.state === 'forward' ? 'end' : 'start';
    }
    if (moving && (o.moveState === 'forward' ? o.moveT >= 1 : o.moveT <= 0)) {
      o.moveState = o.moveState === 'forward' ? 'end' : 'start';
    }
    // Close-complete makes the door solid again (OnCompleteClose's
    // MakeTrigger(false)); a moving closed door drags its bucket along.
    if (o.state === 'start') this._settleDoorBucket(o);
  }
}
