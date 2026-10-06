// @ts-check
// LW2 (2026-10-04, bible/06-Systems/Living-World.md): THE RESIDENT'S BODY - a living-world townsperson on the street.
// DFU's walker (mobilePerson.js MobilePerson, verbatim) both chooses its steps and wears them; a resident's steps are
// its day's (systems/livingWorld/livingTown.js lays it where its day says it is, every frame), so this keeps the
// walker's BODY and nothing of its feet: the same billboard - MoveAnims records 0-4 on the mirrored 8-way wheel at 4
// fps, the idle record 5 (the watch's 15) at 1 fps, the frame and timer reset at each change of state (AUDIT 26
// F021's law) - worn on a yaw of its own instead of the grid's four, and the same talk fields the street's activation
// reads (`nameNPC`, `personFaceRecordId`, `guard`, `facingYaw`). It is a MobilePerson, so every seam that takes a
// walker - the talk ray, the pickpocket, the watch's conversion, the trample - takes it unchanged.
//
// LW3: ARMED (`arm`). A resident walking out to the road, or home from it, in their gear (LW0 decision 5) wears their
// class's sprite instead - the enemy's own eight-way MobileUnit (characters/mobileUnit.js, the band's and the crew's
// body) on its class archive - and their own outfit again when the walk is done.
//
// LW-TALK (2026-10-06, Mac: asked how two who talk should stand, "Turn them"): STANDING, A RESIDENT KEEPS THE WAY THEY
// FACE - the walk wheel's record for their yaw against the camera, held on its STAND_FRAME. DFU's idle record is one
// front view: every talker in a circle faced the camera, never the one they talked to (88,358 of 88,358 standing
// frames), and the watch's post the street, never the road. The idle record is the politeness gate's alone - DFU's own
// use of it: one who stops for the player turns to face them.
import { MobilePerson, MOVE_RECORDS, MOVE_FLIPS, PERSON_MOVE_FPS, PERSON_IDLE_FPS, PERSON_IDLE_RECORD, PERSON_GUARD_IDLE_RECORD } from './mobilePerson.js';
import { mobileOrientation, MobileUnit } from './mobileUnit.js';

/** LW-TALK: the walk record's frame a standing resident holds. */
export const STAND_FRAME = 0;

export class ResidentWalker extends MobilePerson {
  /**
   * @param {any} nav - the town's CityNavigation (the walker's own seams read it; the resident never seeks on it)
   * @param {{ archive: number, guard?: boolean, frameCount: (record: number, archive: number) => number, collider?: any, groundY?: (x: number, z: number) => number }} opts
   */
  constructor(nav, opts) {
    super(nav, opts);
    /** Whether the day has it walking this frame (livingTown.js sets it). */
    this.moving = false;
    /** The way it faces, a world yaw (0 is +z). */
    this.yaw = 0;
    /** The living world's resident this body is, or null while it stands in the pool (livingTown.js). @type {any} */
    this.living = null;
    /** The street's talk fields (TownPopulation writes them on DFU's walkers; livingTown.js on a resident's). */
    this.nameNPC = '';
    /** @type {number|undefined} */
    this._talkSeed = undefined;
    this.pickpocketAttempted = false;
    this.gender = 0;
    /** LW3: walking in their gear - the class sprite's unit, its archive, the outfit to go back to. @type {any} */
    this.unit = null;
    this.armed = false;
    this.ownArchive = opts.archive;
    /** WATCH-PROTECTS: the walk wheel's cadence as a share of the walk's - the living town's run, twice (livingTown.js
     *  _run): at the walk's four frames a second a runner's legs skated a stride twice their own. */
    this.pace = 1;
    this.state = 'idle';
    this.moveCount = 1;   // the anti-skate rule is the pool's: a resident is placed where it is, never mid-tile
  }

  /** The facing the watch's conversion and a guard's spawn read (G1). */
  get facingYaw() { return this.yaw; }

  /** Nothing on the grid to claim: a resident walks the path its day laid, through the others as DFU's walkers pass. */
  release() {}

  /** A resident's own outfit (the body is dressed as another resident - livingTown.js `_dress`). @param {number} archive @param {boolean} guard */
  setIdentity(archive, guard) { super.setIdentity(archive, guard); this.ownArchive = archive; this.unit = null; this.armed = false; }

  /**
   * LW3: into their gear - `look` the class sprite ({ mobileType, basics, archive, frameCount, sex }) - or, null, out of
   * it into their own outfit.
   * @param {{ mobileType: number, basics: any, archive: number, frameCount: (record: number) => number, sex?: 'male'|'female' } | null} look
   */
  arm(look) {
    if (look) {
      this.unit = new MobileUnit(look.mobileType, look.basics, look.frameCount, Math.random, look.sex ?? 'male');
      this.archive = look.archive;
      this.armed = true;
    } else if (this.armed) {
      this.unit = null;
      this.archive = this.ownArchive;
      this.armed = false;
    }
    this.frame = 0; this._timer = 0;
  }

  /**
   * One frame of the billboard. The position is the living town's; `wantsToStop` the street's politeness gate (the
   * walker's own, mobilePerson.js personWantsToStop), which stands it to face the player - the town holds its clock
   * back while it does (livingTown.js). LW-TALK: standing otherwise (`stand`), the way it faces on the walk wheel.
   * @param {number} dt @param {number[]} cameraPos @param {boolean} [wantsToStop]
   * @returns {{ record: number, frame: number, flip: boolean }}
   */
  update(dt, cameraPos, wantsToStop = false) {
    if (this.armed && this.unit) return this.unit.update(dt, { moving: this.moving && !wantsToStop }, this.yaw, this.pos, cameraPos);
    const st = wantsToStop ? 'idle' : this.moving ? 'move' : 'stand';
    if (st !== this.state) { this.state = st; this.frame = 0; this._timer = 0; }
    const fps = st === 'idle' ? PERSON_IDLE_FPS : PERSON_MOVE_FPS * this.pace;
    this._timer += dt;
    while (this._timer >= 1 / fps) { this._timer -= 1 / fps; this.frame++; }
    if (st === 'idle') {
      const rec = this.guard ? PERSON_GUARD_IDLE_RECORD : PERSON_IDLE_RECORD;
      const n = Math.max(1, this.frameCount(rec, this.archive));
      return this._frameOut(rec, this.frame % n, false);
    }
    const o = mobileOrientation(this.yaw, this.pos, cameraPos);
    const rec = MOVE_RECORDS[o];
    const n = Math.max(1, this.frameCount(rec, this.archive));
    return this._frameOut(rec, st === 'stand' ? Math.min(STAND_FRAME, n - 1) : this.frame % n, MOVE_FLIPS[o]);
  }
}
