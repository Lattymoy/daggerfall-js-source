// T1 towns: the wandering townsperson (DFU MobilePersonMotor +
// MobilePersonBillboard, MIT Daggerfall Workshop). The motor walks
// tile to tile on the CityNavigation grid - SeekingTile evaluates the
// four neighbor weights (a 2.5% random shuffle, a forced change on
// weight-0/blocked targets, an 80% chance to leave a downgrade for
// the best neighbor - "mobiles generally follow roads"), MovingForward
// pushes at 1.3 u/s to the cell center, and the person idles ONLY
// while the POLITENESS GATE holds - `personWantsToStop` below, which
// is MobilePersonMotor.cs:216-230 whole. AUDIT 18 flagged that gate
// as four terms with the AreEnemiesNearby() clause dropped, so a
// townsperson idled beside a hostile city guard where DFU keeps it
// walking; the clause is carried now, and both exterior hosts pass
// their own live foe pool through it.
// The billboard: MoveAnims records 0-4 over the same mirrored
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
/** ROAD-D D10 - SetPerson's face tables (MobilePersonNPC.cs:30-39),
 *  digit for digit and in the SAME outfit-variant order as
 *  PERSON_TEXTURES above (DFU's own comments pair them off texture by
 *  texture: maleRedguard 336/312/336/312 match 381-384, and so on).
 *  A walker's talk portrait is `recordIndices[personOutfitVariant] +
 *  Random.Range(0, 24)` (:219-221) into TFAC00I0.RCI. The GUARD arm
 *  is outfit variant 0 and male (:145-150), so it reads the male
 *  table's first entry for its race like anyone else. */
export const NUM_PERSON_FACE_VARIANTS = 24;
export const PERSON_FACE_RECORDS = Object.freeze({
  Redguard: { male: [336, 312, 336, 312], female: [144, 144, 120, 96] },
  Nord: { male: [240, 264, 168, 192], female: [72, 0, 48, 0] },
  Breton: { male: [192, 216, 288, 240], female: [72, 72, 24, 72] },
});

// ---- MobilePersonMotor.Update's POLITENESS GATE (:216-230) ----------

/**
 * `wantsToStop`, whole and in DFU's order (:218-224):
 *
 *   playerStandingStill && withinIdleDistance && sheathed
 *     && !invisible && !inBeastForm
 *
 * and then the term AUDIT 18 found missing (:226-230), which DFU
 * writes as an if/else rather than a fifth `&&` and explains in its
 * own comment - "greatly reduce # of calls to AreEnemiesNearby() by
 * short-circuit evaluation". JS `&&` short-circuits identically, so
 * the thunk is called on exactly the frames DFU calls it: only once
 * the five terms above already hold.
 *
 * THE FOUR HOSTS RULE is why this is a law and not a host
 * expression. Both exterior hosts evaluate it once per live person
 * per frame and neither can be tested; they differ only in the pool
 * they hand `enemiesNearby` - the city watch alone in the
 * single-location page, the watch plus the encounter foes in the
 * streaming world.
 *
 * `enemiesNearby` is systems/encounters.js' areEnemiesNearby, the ONE
 * home for GameManager.AreEnemiesNearby (GameManager.cs:684-732), and
 * the STRICT variant of it: MobilePersonMotor passes no arguments, so
 * `resting` takes its false default (GameManager.cs:684) and an
 * unaware foe inside the classic spawn band counts. (PlayerGPS's
 * nearby-objects scan is a different DFU member and is NOT a second
 * home for this one.)
 *
 * @param distanceToPlayer PlayerMotor.DistanceToPlayer (:217, and
 *        PlayerMotor.cs:452-455) - the host measures it.
 * @param inBeastForm carried because it is a term of the law; the
 *        hosts leave it at the default, since lycanthropy is a routed
 *        Ledger C item and nothing above ground can raise it yet.
 */
export function personWantsToStop({
  playerStandingStill = false,
  distanceToPlayer = Infinity,
  sheathed = false,
  invisible = false,
  inBeastForm = false,
  enemiesNearby = () => false,
} = {}) {
  const withinIdleDistance = distanceToPlayer < PERSON_IDLE_DISTANCE;
  const wantsToStop = !!playerStandingStill && withinIdleDistance
    && !!sheathed && !invisible && !inBeastForm;
  return wantsToStop && !enemiesNearby();
}

// MobileDirection order (N, S, E, W) with our world axes (+z north).
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const DIR_YAW = [0, Math.PI, Math.PI / 2, -Math.PI / 2];

// The MoveAnims wheel (records 0-4 mirrored - the monster layout).
const MOVE_RECORDS = [0, 1, 2, 3, 4, 3, 2, 1];
const MOVE_FLIPS = [false, false, false, false, false, true, true, true];

export class MobilePerson {
  /**
   * @param nav CityNavigation
   * @param opts { archive, guard, frameCount(record, archive), collider, groundY(x,z), rand }
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
    // InitMotor parity (audit 2026-08-17): targetScenePosition =
    // transform.position - a resume-from-idle BEFORE the first seek
    // marches to SELF (instant arrival -> seek), never to a stale
    // origin target.
    this.target = [...this.pos];
    this.tx = -1; this.ty = -1;
    // NT2 (F022): NO occupancy flag at spawn - DFU's spawn path sets
    // none (SpawnAvailableMobile only positions the transform,
    // PopulationManager.cs:150-166; GetRandomSpawnPosition only tests
    // weight, CityNavigation.cs:512-535). Occupied is written solely in
    // SetTargetPosition (:438-439), so other walkers may enter this
    // tile until the first target claims one - exactly as DFU's do.
    this.state = 'seek';
    this.seekCount = 0;
    this.moveCount = 0;
  }

  /** RandomiseNPC identity re-roll (the pool re-rolls EVERY spawn -
   *  recycled walkers come back as someone else). */
  setIdentity(archive, guard) { this.archive = archive; this.guard = guard; }

  /** SetPerson's tail (:218-224): the TFAC00I0.RCI record the talk
   *  window portraits this walker from. Set by RandomiseNPC. */
  personFaceRecordId = 0;

  /** The person's facing as a world yaw (G1: guard spawns inherit it). */
  get facingYaw() { return DIR_YAW[this.dir] ?? 0; }

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
    // InitNavPosition: get back on the grid when unset (-1 sentinel -
    // e.g. after an arrival at the self-target place() sets).
    if (this.gx === -1 || this.gy === -1) {
      [this.gx, this.gy] = this.nav.worldToNav(this.pos[0], this.pos[2]);
    }
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
    // 80% chance to leave a downgrade for the best neighbor.
    // VERBATIM QUIRK (audit 2026-08-17): DFU scans Enumerable.
    // Range(0, 3) = North/South/East ONLY - West (3) is never
    // evaluated as a "best" direction; a westward road is only ever
    // entered via the random-direction branch or by already heading
    // west. Preserved 1:1.
    if (targetWeight < currentWeight && this.rand() > TILE_DOWNGRADE_CHANCE) {
      let bestWeight = targetWeight, bestDir = this.dir;
      const order = [0, 1, 2].sort(() => this.rand() - 0.5);
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
   * @param wantsToStop the politeness gate - `personWantsToStop`
   *        below, which the host evaluates per person per frame
   *        (MobilePersonMotor.cs:224-230)
   * @returns {record, frame, flip} for the billboard
   */
  update(dt, cameraPos, wantsToStop = false) {
    // AUDIT 26 F021: SetIdle resets `currentFrame = 0` and
    // `animTimer = 1` on EVERY idle/move transition
    // (MobilePersonBillboard.cs:292-313), so each state starts at its
    // first frame. The port carried one monotonic frame/timer across
    // states and took `frame % n` - a walker stopping to face the
    // player entered the idle cycle at an arbitrary phase.
    if (!wantsToStop && this.state === 'idle') { this.state = 'move'; this.frame = 0; this._timer = 0; }
    else if (wantsToStop && this.state !== 'idle') { this.state = 'idle'; this.frame = 0; this._timer = 0; }

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
      const n = Math.max(1, this.frameCount(rec, this.archive));
      return { record: rec, frame: this.frame % n, flip: false };
    }
    const o = mobileOrientation(DIR_YAW[this.dir], this.pos, cameraPos);
    const rec = MOVE_RECORDS[o];
    const n = Math.max(1, this.frameCount(rec, this.archive));
    return { record: rec, frame: this.frame % n, flip: MOVE_FLIPS[o] };
  }
}
