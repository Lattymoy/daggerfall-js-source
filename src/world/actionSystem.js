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
import { ACTION_FLAGS, TRIGGER_FLAGS } from './rdbLayout.js';

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
// P10 grows the family with the door/teleport delegates:
//   Teleport (0x0e): player position/rotation = the NEXT object's
//     (destinations are actionless editor flats in the corpus, so
//     the chain cascade no-ops into them and the position resolver
//     supplies the transform).
//   LockDoor (0x10): if the door is unlocked, CurrentLockValue = 16
//     (DFU: "don't know what setting Daggerfall uses here").
//   UnlockDoor (0x11): CurrentLockValue = 0.
//   OpenDoor (0x12): unlock + open (no-op when already open).
//   CloseDoor (0x14): close + lock RESTORES StartingLockValue.
//   Activate (0x1e): a VERBATIM NO-OP (DFU's delegate body is
//     `return;`).
export const EFFECT_ACTION_FLAGS = new Set([
  ACTION_FLAGS.Hurt21, ACTION_FLAGS.Hurt22, ACTION_FLAGS.Hurt23,
  ACTION_FLAGS.Hurt24, ACTION_FLAGS.Hurt25, ACTION_FLAGS.Poison,
  ACTION_FLAGS.DrainMagicka, ACTION_FLAGS.CastSpell,
  ACTION_FLAGS.Teleport, ACTION_FLAGS.LockDoor, ACTION_FLAGS.UnlockDoor,
  ACTION_FLAGS.OpenDoor, ACTION_FLAGS.CloseDoor, ACTION_FLAGS.Activate,
  ACTION_FLAGS.ShowText, ACTION_FLAGS.ShowTextWithInput, ACTION_FLAGS.DoorText,
]);

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
    this._links = new Map();  // `${ns}:${position}` -> object (the chain graph)
    this._doorCount = 0;
    this._damagePlayer = damagePlayer;
    this._drainMagicka = drainMagicka;
    this._castSpell = castSpell;
    this._playerLevel = playerLevel;
    this._rolls = rolls;
    // P10 seams the scene installs:
    //   resolvePosition(ns, positionKey) -> { pos: [x,y,z], yawDeg }
    //     (teleport destinations - actionless objects live only in
    //     the layout's position index, not this graph)
    //   onTeleport({ pos, yawDeg })  - warp the player
    //   onLockedDoor(door)           - the classic look-at-lock text
    this.resolvePosition = null;
    this.onTeleport = null;
    this.onLockedDoor = null;
  }

  /** Object positions are BLOCK-LOCAL byte offsets, so every key is
   *  namespaced by its block instance (ns): 3108 of 4232 dungeons
   *  repeat at least one RDB, and un-namespaced keys made repeated
   *  blocks' objects overwrite each other in this map (the earlier
   *  copy stopped ticking and its collider bucket collided) - found
   *  building P10, fixed here. */
  _register(ns, positionKey, o) {
    this.objects.set(o.key, o);
    if (positionKey != null && positionKey >= 0) this._links.set(`${ns}:${positionKey}`, o);
  }

  _next(o) {
    if (o.nextKey == null || o.nextKey < 0) return null;
    return this._links.get(`${o.ns}:${o.nextKey}`) ?? null;
  }

  /** Register an effect action (Hurt/Poison/DrainMagicka/Teleport):
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
    o.activationCount++;   // DFU increments BEFORE the delegate
    const lvl = Math.max(1, this._playerLevel());
    const F = ACTION_FLAGS;
    if (o.actionFlag === F.Teleport) {
      // DaggerfallAction.Teleport: player transform = NextObject's;
      // null next logs and returns, verbatim.
      const dest = this.resolvePosition?.(o.ns, o.nextKey) ?? null;
      if (!dest) { console.warn('[action] Teleport next object null - can\'t teleport'); return; }
      this.onTeleport?.(dest);
      return;
    }
    if (o.actionFlag === F.LockDoor) {
      // "Locks door when activated. Lock value used is unknown" - 16
      // when not already locked.
      if (o.doorRef && !(o.doorRef.lock > 0)) o.doorRef.lock = ACTION_LOCK_VALUE;
      return;
    }
    if (o.actionFlag === F.UnlockDoor) {
      if (o.doorRef) o.doorRef.lock = 0;
      return;
    }
    if (o.actionFlag === F.OpenDoor) {
      // Opens (and unlocks if locked); no-op when already open.
      const d = o.doorRef;
      if (d && d.state === 'start') { d.lock = 0; this._openDoor(d); }
      return;
    }
    if (o.actionFlag === F.CloseDoor) {
      // Closes and RESTORES the starting lock value.
      const d = o.doorRef;
      if (d && d.state === 'end') { this._closeDoor(d); d.lock = d.startingLock ?? 0; }
      return;
    }
    if (o.actionFlag === F.Activate) return;   // verbatim DFU no-op
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
    if (o.actionFlag === F.DoorText) {
      // DoorText: first activation shows record Index + 7700 as HUD
      // text (2.0s); later activations run the classic trespass
      // check (axis raw > 5 -> MakeEnemiesHostile). The patch table
      // (0/known-missing ids -> skip; 7701..7704 -> 7705) rides
      // actionEnabled, which the door's Open gate also reads.
      let textId = TYPE_99_TEXT_INDEX + o.index;
      if (DOOR_TEXT_REMAP[textId]) textId = DOOR_TEXT_REMAP[textId];
      if (DOOR_TEXT_SKIP.has(TYPE_99_TEXT_INDEX + o.index)) o.actionEnabled = true;
      if (o.activationCount === 1 && textId !== TYPE_99_TEXT_INDEX && !o.actionEnabled) {
        this.onDoorText?.(textId);
      } else if (o.axisRaw > 5) {
        this.onTrespass?.();   // "classic seems to only check whether this value is greater than 5"
      }
      return;
    }
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
      // spell (record by Index) fires AT the player from the object.
      o.cooldown = (o.cooldown ?? 0) - 45.454546;
      if (o.cooldown <= 0 && this._castSpell) {
        this._castSpell(o.index, o.origin);
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

  /** Register an action door (own bucket, closed-solid lifecycle).
   *  P10: doors carry their RDB starting lock (LOCK_VALUES table) and
   *  can themselves be chain targets carrying a Lock/Unlock/Open/
   *  Close/Text action record (DFU's GetDoor(thisAction.gameObject) -
   *  the delegate acts on the door it rides). */
  addDoor(cpu, baseMatrix, { ns = 0, position = null, action = null, lock = 0 } = {}) {
    const key = `door:${this._doorCount++}`;
    const o = {
      key,
      ns,
      kind: 'door',
      cpu,
      base: baseMatrix,
      duration: DOOR_OPEN_DURATION,
      rotation: { x: 0, y: DOOR_OPEN_ANGLE, z: 0 },
      translation: { x: 0, y: 0, z: 0 },
      state: 'start', // start | forward | end | reverse
      t: 0,
      nextKey: -1,
      lock,                    // CurrentLockValue (> 0 locked, >= 20 magic)
      startingLock: lock,      // StartingLockValue (CloseDoor restores it)
      matrix: baseMatrix,
    };
    this.objects.set(key, o);
    o.doorPosition = position;
    if (action && action.actionFlag !== ACTION_FLAGS.None) {
      // The door's OWN action node joins the chain graph at the
      // door's RDB position; its delegate acts on doorRef. A door
      // WITHOUT an action record is unreachable by chains, verbatim
      // (DFU's ActivateNext finds no DaggerfallAction on it).
      const eo = this.addEffect(ns, position, action);
      eo.doorRef = o;
    }
    this.collider.addMesh(key, cpu.positions, cpu.indices, baseMatrix);
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

  _isPlaying(o, depth = 0) {
    if (o.state === 'forward' || o.state === 'reverse') return true;
    if (depth > 32) return false;
    const next = this._next(o);
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
    // ActivateNext cascades BEFORE this object's own tween - EXCEPT
    // ShowTextWithInput, whose chain fires only on a correct answer
    // (Play's verbatim exception).
    if (o.actionFlag !== ACTION_FLAGS.ShowTextWithInput) {
      const next = this._next(o);
      if (next) this.receive(next);
    }
    // A2: DaggerfallAction.Play - "if (PlaySound && Index > 0)
    // audioSource.Play()": the RDB soundIndex fires on every Play,
    // movers and effect actions alike (the scene owns the engine).
    if (o.index > 0) this.onActionSound?.(o);
    if (o.kind === 'effect') { this._runEffect(o); return; }
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

  _openDoor(o) {
    if (o.state !== 'start') return;
    o.state = 'forward';
    o.lock = 0;                        // Open() tail: CurrentLockValue = 0
    this.collider.removeBucket(o.key);
    this.onDoorState?.(o, true);       // A1: the audio seam (open)
  }

  _closeDoor(o) {
    if (o.state !== 'end') return;
    o.state = 'reverse';
    this.onDoorState?.(o, false);      // A1: the audio seam (close)
  }

  /** ToggleDoor: no-op while moving; a LOCKED closed door refuses
   *  (Open(): "if (IsLocked && !ignoreLocks) { LookAtInteriorLock;
   *  return; }" - the look-at-lock text fires only for the player);
   *  trigger (bucket gone) at open-start, solid again only at
   *  close-complete. */
  _toggleDoor(o, byPlayer) {
    if (o.state === 'forward' || o.state === 'reverse') return;
    if (o.state === 'start') {
      if (o.lock > 0) {
        if (byPlayer) this.onLockedDoor?.(o);
        return;
      }
      this._openDoor(o);
    } else {
      this._closeDoor(o);
    }
  }

  /** Player activation entry: doors toggle, actions receive. */
  activate(key) {
    const o = this.objects.get(key);
    if (!o) return false;
    if (o.kind === 'door') {
      const node = this._links.get(`${o.ns}:${o.doorPosition}`);
      const doorNode = node && node !== o && node.doorRef === o ? node : null;
      // Open()'s DoorText special case, verbatim: the FIRST player
      // activation runs the action (shows the text) and does NOT
      // open unless the patch table pre-enabled it. (The Receive
      // trigger gate applies inside - Direct/MultiTrigger-flagged
      // DoorText doors block there exactly as DFU's do.)
      if (o.state === 'start' && doorNode
          && doorNode.actionFlag === ACTION_FLAGS.DoorText && doorNode.index > 0
          && (doorNode.triggerFlag === TRIGGER_FLAGS.Door || doorNode.triggerFlag === TRIGGER_FLAGS.Direct || doorNode.triggerFlag === TRIGGER_FLAGS.MultiTrigger)
          && doorNode.activationCount === 0) {
        this.receive(doorNode, 'Door');
        if (!doorNode.actionEnabled) return true;
      }
      // The lock gate + toggle; when a toggle actually starts, the
      // door's own action fires (ExecuteActionOnToggle on open AND
      // close, Door-trigger gated).
      const wasState = o.state;
      this._toggleDoor(o, true);
      if (doorNode && o.state !== wasState) this.receive(doorNode, 'Door');
      return true;
    }
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
    this._applyMatrix(o);
    this.collider.removeBucket(o.key);
    if (o.kind === 'door') {
      if (o.state === 'start') this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.base);
    } else {
      this.collider.addMesh(o.key, o.cpu.positions, o.cpu.indices, o.matrix);
    }
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
