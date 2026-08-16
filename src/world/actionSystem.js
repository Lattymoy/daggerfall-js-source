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
//     chain is mid-tween.
//   - Action doors swing (0, OpenAngle -90, 0) degrees in Space.Self
//     over OpenDuration 1.5 s, linear; the door collider turns TRIGGER
//     (passable) the moment opening starts and turns solid again only
//     when closing COMPLETES (MakeTrigger call sites). ToggleDoor is a
//     no-op while moving.
// The matrix composition mirrors the tweens exactly: world translation
// pre-multiplies the placement, self rotation post-multiplies it.
// Collision (ours): doors own a collider bucket that exists only while
// fully closed; moving action objects rebuild their bucket each frame
// (DFU parents the player to platforms instead - riding is a later
// milestone, standing collision is correct at every instant).

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
//   DrainMagicka (0x1c): INTERIM no-op - the magicka stat pends the
//     Systems arc (DFU drains player.CurrentMagicka).
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
// The IsLocked gate on the PLAYER toggle stays routed (Ledger: locks
// ship as one unit with bash + lockpicking); the lock VALUES are live
// here so the verbs are verbatim the day the gate lands.
export const DOOR_VERB_FLAGS = new Set([
  ACTION_FLAGS.LockDoor, ACTION_FLAGS.UnlockDoor,
  ACTION_FLAGS.OpenDoor, ACTION_FLAGS.CloseDoor,
]);

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

export class ActionSystem {
  constructor(collider, { damagePlayer = null, drainMagicka = null, castSpell = null, playerLevel = () => 1, rolls = Math.random } = {}) {
    this.collider = collider;
    this.objects = new Map(); // key -> runtime object
    this._doorCount = 0;
    this._damagePlayer = damagePlayer;
    this._drainMagicka = drainMagicka;
    this._castSpell = castSpell;
    this._playerLevel = playerLevel;
    this._rolls = rolls;
  }

  /** Register an effect action (Hurt/Poison/DrainMagicka): chain
   *  participant, no tween - the model stays in the static draw and
   *  the shared collider (the caller keeps those). */
  addEffect(positionKey, action, origin = null) {
    const key = `act:${positionKey}`;
    const o = {
      origin,
      key,
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
    this.objects.set(key, o);
    return o;
  }

  _runEffect(o) {
    o.activationCount++;   // DFU increments BEFORE the delegate
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

  /** Register a chain RELAY: an acting object whose delegate is routed
   *  elsewhere (Teleport, Activate, ShowText, SetGlobalVar, the
   *  Unknowns...) or is a verbatim no-op. DFU's Play() cascades
   *  ActivateNext for EVERY flag before the delegate runs, so these
   *  must live in the chain or every link through them dies (audit
   *  2026-08-16). aabb (when given) makes it a Direct/Attack/collision
   *  target like DFU's collider-carrying models. */
  addRelay(positionKey, action, aabb = null) {
    const key = `act:${positionKey}`;
    const o = {
      key,
      kind: 'relay',
      actionFlag: action.actionFlag ?? ACTION_FLAGS.None,
      index: action.index,
      state: 'start',
      nextKey: action.nextObject,
      triggerFlag: action.triggerFlag ?? TRIGGER_FLAGS.None,
      aabb,
    };
    this.objects.set(key, o);
    return o;
  }

  /** Register an action door (own bucket, closed-solid lifecycle).
   *  opts (audit 2026-08-16): positionKey keys the door into the chain
   *  (act:<pos>) so LinkActionNodes-resolved nextObject reaches it;
   *  action is the door's OWN record (fires on player toggle through
   *  the Door trigger gate, verbatim ExecuteActionOnToggle);
   *  startingLockValue seeds currentLockValue. */
  addDoor(cpu, baseMatrix, opts = {}) {
    const key = opts.positionKey != null ? `act:${opts.positionKey}` : `door:${this._doorCount++}`;
    const a = opts.action ?? null;
    const o = {
      key,
      kind: 'door',
      cpu,
      base: baseMatrix,
      duration: DOOR_OPEN_DURATION,
      rotation: { x: 0, y: DOOR_OPEN_ANGLE, z: 0 },
      translation: { x: 0, y: 0, z: 0 },
      state: 'start', // start | forward | end | reverse
      t: 0,
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
    this.collider.addMesh(key, cpu.positions, cpu.indices, baseMatrix);
    return o;
  }

  /** Register a SPECIAL door (verbatim DaggerfallActionDoorSpecial):
   *  a plain placed model whose action flag is OpenDoor (or CloseDoor
   *  on a non-door) swings like a hinged door - same -90/1.5s and the
   *  same collider lifecycle - and its own record chains/fires like
   *  any action. No lock (the special door has none in DFU). */
  addSpecialDoor(positionKey, cpu, baseMatrix, action) {
    const o = this.addDoor(cpu, baseMatrix, { positionKey, action });
    o.special = true;
    return o;
  }

  /**
   * Register an action-record model (positionKey from the RDB link map;
   * chains resolve through action.nextObject).
   */
  addAction(positionKey, cpu, baseMatrix, action) {
    const key = `act:${positionKey}`;
    const o = {
      key,
      kind: 'action',
      cpu,
      base: baseMatrix,
      duration: action.duration / 20,
      rotation: action.rotation,
      translation: action.translation,
      state: 'start',
      t: 0,
      nextKey: action.nextObject,
      triggerFlag: action.triggerFlag ?? TRIGGER_FLAGS.None,
      matrix: baseMatrix,
    };
    this.objects.set(key, o);
    this.collider.addMesh(key, cpu.positions, cpu.indices, baseMatrix);
    return o;
  }

  _isPlaying(o, depth = 0) {
    if (o.state === 'forward' || o.state === 'reverse') return true;
    if (depth > 32) return false;
    const next = this.objects.get(`act:${o.nextKey}`);
    return next ? this._isPlaying(next, depth + 1) : false;
  }

  /** DaggerfallAction.Receive: the verbatim trigger gate, then Play.
   *  ActionObject (the chain cascade) is always valid; every other
   *  trigger type must be accepted by the object's TriggerFlag. */
  receive(o, triggerType = 'ActionObject') {
    if (triggerType !== 'ActionObject') {
      const allowed = TRIGGER_GATE[o.triggerFlag ?? TRIGGER_FLAGS.None];
      if (!allowed || !allowed.includes(triggerType)) return;
    }
    if (this._isPlaying(o)) return;
    this._play(o);
  }

  _play(o) {
    // ActivateNext cascades BEFORE this object's own delegate, for
    // EVERY flag (verbatim Play; relays exist for exactly this).
    const next = this.objects.get(`act:${o.nextKey}`);
    if (next) this.receive(next);
    if (o.kind === 'effect') { this._runEffect(o); return; }
    if (o.kind === 'relay') return;   // delegate routed or a verbatim no-op; the cascade above IS the behavior
    if (o.kind === 'door') {
      // A door reached through the chain runs ITS OWN delegate on
      // itself (DFU: GetComponent on thisAction.gameObject). Door-verb
      // flags act; None cascades only (a chained None-flag door does
      // NOT open in DFU); effects run; anything else relays.
      if (DOOR_VERB_FLAGS.has(o.actionFlag)) { this._doorVerb(o); return; }
      if (EFFECT_ACTION_FLAGS.has(o.actionFlag)) { this._runEffect(o); return; }
      return;
    }
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

  /** ToggleDoor: no-op while moving; trigger (bucket gone) at
   *  open-start, solid again only at close-complete. Opening clears
   *  the lock (verbatim Open tail: CurrentLockValue = 0). Returns
   *  true when the toggle started. */
  toggleDoor(o) {
    if (o.state === 'forward' || o.state === 'reverse') return false;
    if (o.state === 'start') {
      o.state = 'forward';
      o.currentLockValue = 0;
      this.collider.removeBucket(o.key);
      this.onDoorState?.(o, true);    // A1: the audio seam (open)
    } else {
      o.state = 'reverse';
      this.onDoorState?.(o, false);   // A1: the audio seam (close)
    }
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
      if (o.currentLockValue <= 0) o.currentLockValue = 16; // "don't know what setting Daggerfall uses here"
    } else if (o.actionFlag === F.UnlockDoor) {
      o.currentLockValue = 0;
    }
  }

  /** Verbatim ExecuteActionOnToggle: a door that is ALSO an action
   *  object fires its record on the PLAYER toggle, through the Door
   *  trigger gate (gate first - it guards the cascade too). The
   *  door-verb-on-self is skipped: the player toggle IS the verb (DFU
   *  reaches the same settled state through a re-entrant ToggleDoor
   *  that its moving guard mostly no-ops; the observable outcomes -
   *  chain fired once, door toggled once - are identical). */
  _execOwnAction(o) {
    if (o.actionFlag === ACTION_FLAGS.None && o.nextKey === -1) return;
    const allowed = TRIGGER_GATE[o.triggerFlag ?? TRIGGER_FLAGS.None];
    if (!allowed || !allowed.includes('Door')) return;
    const next = this.objects.get(`act:${o.nextKey}`);
    if (next) this.receive(next);
    if (EFFECT_ACTION_FLAGS.has(o.actionFlag)) this._runEffect(o);
  }

  /** Verbatim DaggerfallActionDoor.AttemptBash: an OPEN door bash-
   *  closes; a closed door that is not magically held (lock < 20)
   *  rolls d100 under (20 - CurrentLockValue) to burst open, clearing
   *  the lock. Player bashes fire the door's own record exactly like
   *  ToggleDoor(true) does (AttemptBash calls it). The bash sound and
   *  the castle MakeEnemiesHostile bit are routed (Audio / crime).
   *  rollProvider defaults to the system's rolls stream. */
  attemptBash(o, roll01 = this._rolls()) {
    if (o.kind !== 'door') return false;
    this.onDoorBash?.(o);   // A1 seam (PlayerDoorBash)
    if (o.state === 'end') {
      if (this.toggleDoor(o)) this._execOwnAction(o);
      return true;
    }
    if (o.currentLockValue >= 20) return false;   // magically held: cannot bash
    const chance = 20 - o.currentLockValue;
    if (Math.floor(roll01 * 100) < chance) {      // Dice100.SuccessRoll
      o.currentLockValue = 0;
      if (this.toggleDoor(o)) this._execOwnAction(o);
      return true;
    }
    return false;
  }

  /** Player activation entry: doors toggle (+ fire their own record,
   *  Door-gated), actions receive. */
  activate(key) {
    const o = this.objects.get(key);
    if (!o) return false;
    if (o.kind === 'door') {
      if (this.toggleDoor(o)) this._execOwnAction(o);
      return true;
    }
    this.receive(o, 'Direct');   // player activation = the Direct trigger type (the gate table applies)
    return true;
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
    o.matrix = multiply(translate, multiply(o.base, rotate));
  }

  update(dt) {
    for (const o of this.objects.values()) {
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
      if (done) {
        o.state = o.state === 'forward' ? 'end' : 'start';
        if (o.kind === 'door' && o.state === 'start') {
          // Close complete: solid again at the closed matrix.
          this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.base);
        }
      }
    }
  }
}
