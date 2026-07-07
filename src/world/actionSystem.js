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
import { ACTION_FLAGS } from './rdbLayout.js';

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

  /** Register an action door (own bucket, closed-solid lifecycle). */
  addDoor(cpu, baseMatrix) {
    const key = `door:${this._doorCount++}`;
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
      nextKey: -1,
      matrix: baseMatrix,
    };
    this.objects.set(key, o);
    this.collider.addMesh(key, cpu.positions, cpu.indices, baseMatrix);
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

  /** DaggerfallAction.Receive: gate on the chain, then Play. */
  receive(o) {
    if (this._isPlaying(o)) return;
    this._play(o);
  }

  _play(o) {
    // ActivateNext cascades BEFORE this object's own tween.
    const next = this.objects.get(`act:${o.nextKey}`);
    if (next) this.receive(next);
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

  /** Player activation entry: doors toggle, actions receive. */
  activate(key) {
    const o = this.objects.get(key);
    if (!o) return false;
    if (o.kind === 'door') {
      // ToggleDoor: no-op while moving; trigger (bucket gone) at
      // open-start, solid again only at close-complete.
      if (o.state === 'forward' || o.state === 'reverse') return true;
      if (o.state === 'start') {
        o.state = 'forward';
        this.collider.removeBucket(o.key);
      } else {
        o.state = 'reverse';
      }
      return true;
    }
    this.receive(o);
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
      if (o.state !== 'forward' && o.state !== 'reverse') continue;
      const dir = o.state === 'forward' ? 1 : -1;
      o.t = Math.max(0, Math.min(1, o.t + (dir * dt) / o.duration));
      this._applyMatrix(o);
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
