// T1 towns: the wandering townsperson (DFU MobilePersonMotor +
// MobilePersonBillboard, MIT Daggerfall Workshop). The motor walks
// tile to tile on the CityNavigation grid - SeekingTile evaluates the
// four neighbor weights (a 2.5% random shuffle, a forced change on
// weight-0/blocked targets, an 80% chance to leave a downgrade for
// the best neighbor - "mobiles generally follow roads"), MovingForward
// pushes at 1.3 u/s to the cell center, and the person idles ONLY
// when the player stands still within 2.5 with the weapon SHEATHED,
// not invisible, and no enemies nearby (the verbatim politeness
// gate). The billboard: MoveAnims records 0-4 over the same mirrored
// 8-orientation wheel as the monsters (4 fps), idle record 5 (guards
// 15, 1 fps). Race/gender texture tables verbatim; guards ride 399.
//
// Departures (documented): IsDirectionClear raycasts our collider
// (DFU raycasts everything but the mobile's own layer); the terrain
// height comes from the scene's ground function (flat exterior
// locations - DFU samples the terrain collider).

import { NAV_CELL } from '../world/cityNavigation.js';
import { mobileOrientation } from './mobileUnit.js';

export const PERSON_MOVE_SPEED = 1.3;          // movementSpeed
export const PERSON_IDLE_DISTANCE = 2.5;       // idleDistance
export const TILE_DOWNGRADE_CHANCE = 0.20;     // tileDowngradeChance
export const RANDOM_CHANGE_CHANCE = 0.025;     // randomChangeChance
export const PERSON_MOVE_FPS = 4;              // MoveAnimSpeed
export const PERSON_IDLE_FPS = 1;              // IdleAnimSpeed
export const PERSON_IDLE_RECORD = 5;
export const PERSON_GUARD_IDLE_RECORD = 15;

// SetPerson's race/gender texture ranges, verbatim.
export const PERSON_TEXTURES = Object.freeze({
  Redguard: { male: [381, 382, 383, 384], female: [395, 396, 397, 398] },
  Nord: { male: [387, 388, 389, 390], female: [392, 393, 451, 452] },
  Breton: { male: [385, 386, 391, 394], female: [453, 454, 455, 456] },
});
export const GUARD_TEXTURE = 399;

// MobileDirection order (N, S, E, W) with our world axes (+z north).
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const DIR_YAW = [0, Math.PI, Math.PI / 2, -Math.PI / 2];

// The MoveAnims wheel (records 0-4 mirrored - the monster layout).
const MOVE_RECORDS = [0, 1, 2, 3, 4, 3, 2, 1];
const MOVE_FLIPS = [false, false, false, false, false, true, true, true];

export class MobilePerson {
  /**
   * @param nav CityNavigation
   * @param opts { archive, guard, frameCount(record), collider, groundY(x,z), rand }
   */
  constructor(nav, { archive, guard = false, frameCount, collider = null, groundY = () => 0, rand = Math.random } = {}) {
    this.nav = nav;
    this.archive = archive;
    this.guard = guard;
    this.frameCount = frameCount;
    this.collider = collider;
    this.groundY = groundY;
    this.rand = rand;
    this.state = 'seek';         // seek | move | idle
    this.dir = Math.floor(rand() * 4);
    this.gx = -1; this.gy = -1;  // current nav cell
    this.tx = -1; this.ty = -1;  // target nav cell
    this.pos = [0, 0, 0];        // world (feet)
    this.target = [0, 0, 0];
    this.seekCount = 0;
    this.moveCount = 0;
    this.frame = 0;
    this._timer = 0;
  }

  /** Place on the grid at a nav cell (InitMotor/InitNavPosition). */
  place(gx, gy) {
    this.gx = gx; this.gy = gy;
    const [x, z] = this.nav.navToWorld(gx, gy);
    this.pos = [x, this.groundY(x, z), z];
    this.nav.setOccupied(gx, gy);
    this.state = 'seek';
    this.seekCount = 0;
    this.moveCount = 0;
  }

  release() { this.nav.clearOccupied(this.gx, this.gy); this.nav.clearOccupied(this.tx, this.ty); }

  _weight(d) {
    const gx = this.gx + DIRS[d][0], gy = this.gy + DIRS[d][1];
    return this.nav.occupied(gx, gy) ? 0 : this.nav.weightAt(gx, gy);
  }

  _clear(d) {
    if (!this.collider) return true;
    const gx = this.gx + DIRS[d][0], gy = this.gy + DIRS[d][1];
    const [x, z] = this.nav.navToWorld(gx, gy);
    const ty = this.groundY(x, z) + 0.1;   // "aim low to better detect stairs"
    const from = [this.pos[0], this.pos[1] + 0.1, this.pos[2]];
    const dx = x - from[0], dy = ty - from[1], dz = z - from[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    const hit = this.collider.raycast(from, [dx / l, dy / l, dz / l], l);
    return !Number.isFinite(hit) || hit >= l - 1e-3;
  }

  _seek() {
    this.seekCount++;
    const weights = [this._weight(0), this._weight(1), this._weight(2), this._weight(3)];
    const currentWeight = this.nav.weightAt(this.gx, this.gy);
    let targetWeight = this._clear(this.dir) ? weights[this.dir] : 0;
    if (this.rand() < RANDOM_CHANGE_CHANCE) targetWeight = 0;   // the shuffle
    if (targetWeight === 0) {
      // any valid random direction, or stay seeking (the pool
      // recycles at seekCount > 4)
      const d = Math.floor(this.rand() * 4);
      if (weights[d] === 0 || !this._clear(d)) return;
      this.dir = d;
      this._setTarget();
      return;
    }
    // 80% chance to leave a downgrade for the best neighbor
    if (targetWeight < currentWeight && this.rand() > TILE_DOWNGRADE_CHANCE) {
      let bestWeight = targetWeight, bestDir = this.dir;
      const order = [0, 1, 2, 3].sort(() => this.rand() - 0.5);
      for (const d of order) {
        if (weights[d] > bestWeight && this._clear(d)) { bestWeight = weights[d]; bestDir = d; }
      }
      this.dir = bestDir;
      this._setTarget();
      return;
    }
    this._setTarget();   // keep marching
  }

  _setTarget() {
    this.tx = this.gx + DIRS[this.dir][0];
    this.ty = this.gy + DIRS[this.dir][1];
    const [x, z] = this.nav.navToWorld(this.tx, this.ty);
    this.target = [x, this.groundY(x, z), z];
    this.nav.clearOccupied(this.gx, this.gy);
    this.nav.setOccupied(this.tx, this.ty);
    this.state = 'move';
    this.seekCount = 0;
  }

  /**
   * @param wantsToStop the scene's verbatim politeness gate (player
   *        still + near + sheathed + visible + no enemies nearby)
   * @returns {record, frame, flip} for the billboard
   */
  update(dt, cameraPos, wantsToStop = false) {
    if (!wantsToStop && this.state === 'idle') this.state = 'move';
    else if (wantsToStop && this.state !== 'idle') this.state = 'idle';

    if (this.state === 'seek') this._seek();
    else if (this.state === 'move') {
      const dx = this.target[0] - this.pos[0], dy = this.target[1] - this.pos[1], dz = this.target[2] - this.pos[2];
      const l = Math.hypot(dx, dy, dz);
      if (l < 0.1) {
        this.gx = this.tx; this.gy = this.ty;
        this.state = 'seek';
        this.moveCount++;
      } else {
        const step = Math.min(PERSON_MOVE_SPEED * dt, l);
        this.pos[0] += (dx / l) * step; this.pos[1] += (dy / l) * step; this.pos[2] += (dz / l) * step;
      }
    }

    // The billboard: idle = the single idle record facing any way;
    // moving = the 8-orientation wheel against the facing yaw.
    const fps = this.state === 'idle' ? PERSON_IDLE_FPS : PERSON_MOVE_FPS;
    this._timer += dt;
    while (this._timer >= 1 / fps) { this._timer -= 1 / fps; this.frame++; }
    if (this.state === 'idle') {
      const rec = this.guard ? PERSON_GUARD_IDLE_RECORD : PERSON_IDLE_RECORD;
      const n = Math.max(1, this.frameCount(rec));
      return { record: rec, frame: this.frame % n, flip: false };
    }
    const o = mobileOrientation(DIR_YAW[this.dir], this.pos, cameraPos);
    const rec = MOVE_RECORDS[o];
    const n = Math.max(1, this.frameCount(rec));
    return { record: rec, frame: this.frame % n, flip: MOVE_FLIPS[o] };
  }
}
