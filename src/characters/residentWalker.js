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
// class's sprite instead - the enemy's own eight-way MobileUnit (characters/mobile/mobileUnit.js, the band's and the crew's
// body) on its class archive - and their own outfit again when the walk is done.
//
// LW-LOOKS (2026-10-06, "Class looks + still flats"): IN TOWN TOO - one whose calling is a class's walks the town in its
// sprite (`arm` with their town class, systems/livingWorld/looks.js townClassOf; `cls` the one worn), and one keeping their
// place alone stands as Daggerfall's still picture of their kind (`still`: an NPC flat's record, its frames animated on
// the game's own billboard clock, render/flatAnimation.js FlatAnim) - themselves again when they go on.
//
// LW-TALK (2026-10-06, Mac: asked how two who talk should stand, "Turn them"): STANDING, A RESIDENT KEEPS THE WAY THEY
// FACE - the walk wheel's record for their yaw against the camera, held on its STAND_FRAME. DFU's idle record is one
// front view: every talker in a circle faced the camera, never the one they talked to (88,358 of 88,358 standing
// frames), and the watch's post the street, never the road. The idle record is the politeness gate's alone - DFU's own
// use of it: one who stops for the player turns to face them.
import {
  MobilePerson,
  MOVE_RECORDS,
  MOVE_FLIPS,
  PERSON_MOVE_FPS,
  PERSON_IDLE_FPS,
  PERSON_IDLE_RECORD,
  PERSON_GUARD_IDLE_RECORD,
} from './mobile/mobilePerson.js';
import { mobileOrientation, MobileUnit } from './mobile/mobileUnit.js';
import { FlatAnim } from '../render/flatAnimation.js';

/** LW-TALK: the walk record's frame a standing resident holds. */
export const STAND_FRAME = 0;
/** STAND-LIFE (the owner: "Living world NPCs should not turn into static sprites when stopping"): one standing stirs
 *  every few seconds, at their own rhythm (seconds between two stirs) - a glance aside (radians, for IDLE_GLANCE_S) or a
 *  shift of weight (the wheel's next two frames and back, at IDLE_SHIFT_FPS). */
export const IDLE_EVERY_S = Object.freeze([3, 7]);
export const IDLE_GLANCE_S = 1.6;
export const IDLE_GLANCE_YAW = 0.85; // AUDIT STAND-LIFE B5: past the wheel's 45-degree sector, so a glance always shows (0.7 drew nothing new one time in nine)
export const IDLE_SHIFT_FPS = 3;
/** The frames a shift of weight steps through, from STAND_FRAME and back to it. */
export const IDLE_SHIFT_FRAMES = Object.freeze([1, 2, 1]);
/** AUDIT STAND-LIFE B4: a side or three-quarter record's frame 0 is a full stride, and its frames 1-2 a stride walked on
 *  the spot - so one stands there on SIDE_STAND_FRAME (passing: the legs together) and shifts to the other passing frame
 *  and back (SIDE_SHIFT_FRAMES); the front and back records (SHIFT_RECORDS: the legs pass in depth) as before. The
 *  watch's axe is drawn on frames 0 and 2 alone (TEXTURE.399): it stands on 0, shifts to 2 front and back, and only
 *  glances side on. */
export const SIDE_STAND_FRAME = 1;
export const SIDE_SHIFT_FRAMES = Object.freeze([3, 3]);
export const GUARD_SHIFT_FRAMES = Object.freeze([2, 2]);
export const SHIFT_RECORDS = Object.freeze(new Set([0, 4]));
/** The frame a stand holds on walk record `rec`, and the frames its shift of weight steps through (null: it glances
 *  alone). @param {number} rec @param {boolean} [guard] */
export const standFrameOf = (rec, guard = false) => (SHIFT_RECORDS.has(rec) || guard ? STAND_FRAME : SIDE_STAND_FRAME);
/** @param {number} rec @param {boolean} [guard] @returns {readonly number[] | null} */
export const shiftFramesOf = (rec, guard = false) =>
  guard
    ? SHIFT_RECORDS.has(rec)
      ? GUARD_SHIFT_FRAMES
      : null
    : SHIFT_RECORDS.has(rec)
      ? IDLE_SHIFT_FRAMES
      : SIDE_SHIFT_FRAMES;

/** STAND-LIFE: bodies made, so each body's stream starts apart. */
let _bodies = 0;

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
    /** LW-LOOKS: the class worn (null: their outfit), its archive; the still picture stood as (null: none) and its clock. */
    /** @type {number|null} */
    this.cls = null;
    this.classArchive = opts.archive;
    /** @type {{ archive: number, record: number, frameCount: number } | null} */
    this.stillLook = null;
    /** AUDIT MW-NPC II K1: the still picture's kind (looks.js stillRoleOf - 'beggar', a stall's, 'priest'), null with none:
     *  what the Morrowind body reads (characters/rosterBodies.js residentWalkerActor). @type {string|null} */
    this.stillRole = null;
    /** @type {FlatAnim|null} */
    this._stillAnim = null;
    /** WATCH-PROTECTS: the walk wheel's cadence as a share of the walk's - the living town's run, twice (livingTown.js
     *  _run): at the walk's four frames a second a runner's legs skated a stride twice their own. */
    this.pace = 1;
    this.state = 'idle';
    this.moveCount = 1; // the anti-skate rule is the pool's: a resident is placed where it is, never mid-tile
    /** STAND-LIFE: the stir under way ('glance', 'shift' or null), its seconds, the seconds to the next and the stream
     *  that draws them (the body's own - a look, not the day's: nothing any other reader needs to agree on). */
    /** @type {'glance'|'shift'|null} */
    this.stir = null;
    this._stirT = 0;
    this._stirNext = 0;
    this._stirSide = 1;
    this._stirRng = (Math.imul(++_bodies, 0x9e3779b1) ^ (opts.archive | 0)) >>> 0;
    /** @type {number|undefined} the talk seed the stream was last seeded off */
    this._stirOf = undefined;
    /** AUDIT STAND-LIFE B5: one of a circle or an incident at their spot (livingTown.js sets it) - they never glance away */
    this.attending = false;
  }

  /** STAND-LIFE: the way the body is drawn facing - its yaw, turned by a glance while one is under way. */
  get shownYaw() {
    return this.stir === 'glance' && !this.attending ? this.yaw + this._stirSide * IDLE_GLANCE_YAW : this.yaw;
  }

  /** STAND-LIFE: the body's own next draw in [0, 1) - seeded off its talk seed once it is someone, so a resident keeps
   *  their own rhythm and two bodies made together never stir as one. */
  _stirDraw() {
    if (this._talkSeed !== undefined && this._talkSeed !== this._stirOf) {
      this._stirOf = this._talkSeed;
      this._stirRng = (this._talkSeed ^ 0x57a11d) >>> 0;
    }
    if (this._stirRng === 0) this._stirRng = 1;
    let x = this._stirRng;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this._stirRng = x;
    return x / 0x100000000;
  }

  /** STAND-LIFE: a stand's clock - the stir under way run out, and the next begun when its time comes.
   *  @param {number} dt */
  _standLife(dt) {
    if (this._stirNext <= 0) this._stirNext = IDLE_EVERY_S[0] + this._stirDraw() * (IDLE_EVERY_S[1] - IDLE_EVERY_S[0]);
    if (this.stir) {
      this._stirT += dt;
      const len = this.stir === 'glance' ? IDLE_GLANCE_S : IDLE_SHIFT_FRAMES.length / IDLE_SHIFT_FPS;
      if (this._stirT >= len) {
        this.stir = null;
        this._stirT = 0;
        this._stirNext = 0;
      }
      return;
    }
    this._stirNext -= dt;
    if (this._stirNext > 0) return;
    // AUDIT STAND-LIFE B5: one attending a talk shifts their weight, never glances away from it
    this.stir = this._stirDraw() < 0.5 && !this.attending ? 'glance' : 'shift';
    this._stirSide = this._stirDraw() < 0.5 ? -1 : 1;
    this._stirT = 0;
  }

  /** STAND-LIFE: the frame a stand shows - STAND_FRAME, or the shift's step under way; AUDIT STAND-LIFE B4: a side record
   *  SIDE_STAND_FRAME, still (the watch's STAND_FRAME). @param {number} n the record's frames @param {number} [rec] */
  _standFrame(n, rec = 0) {
    const stand = standFrameOf(rec, this.guard),
      frames = shiftFramesOf(rec, this.guard);
    if (this.stir !== 'shift' || !frames || n < 4) return Math.min(stand, n - 1);
    const i = Math.min(frames.length - 1, Math.floor(this._stirT * IDLE_SHIFT_FPS));
    return frames[i] % n;
  }

  /** The facing the watch's conversion and a guard's spawn read (G1). */
  get facingYaw() {
    return this.yaw;
  }

  /** Nothing on the grid to claim: a resident walks the path its day laid - LW-SPACE: and steps aside for the others
   *  (livingTown.js `_dodge`; DFU's walkers keep apart by the tiles they claim, `_setTarget`). */
  release() {}

  /** A resident's own outfit (the body is dressed as another resident - livingTown.js `_dress`). @param {number} archive @param {boolean} guard */
  setIdentity(archive, guard) {
    super.setIdentity(archive, guard);
    this.ownArchive = archive;
    this.classArchive = archive;
    this.unit = null;
    this.armed = false;
    this.cls = null;
    this.stillLook = null;
    this.stillRole = null;
    this._stillAnim = null;
  }

  /**
   * LW3: into their gear - `look` the class sprite ({ mobileType, basics, archive, frameCount, sex }) - or, null, out of
   * it into their own outfit.
   * @param {{ mobileType: number, basics: any, archive: number, frameCount: (record: number) => number, sex?: 'male'|'female' } | null} look
   */
  arm(look) {
    if (look) {
      this.unit = new MobileUnit(look.mobileType, look.basics, look.frameCount, Math.random, look.sex ?? 'male');
      this.classArchive = look.archive;
      this.cls = look.mobileType;
      this.armed = true;
    } else if (this.armed) {
      this.unit = null;
      this.classArchive = this.ownArchive;
      this.cls = null;
      this.armed = false;
    }
    if (!this.stillLook) this.archive = this.classArchive;
    this.frame = 0;
    this._timer = 0;
  }

  /**
   * LW-LOOKS: standing as a still picture - `look` an NPC flat ({ archive, record, frameCount }) - or, null, themselves
   * again (their class's sprite, or their outfit). AUDIT MW-NPC II K1: `role` the picture's kind.
   * @param {{ archive: number, record: number, frameCount: number } | null} look @param {string|null} [role]
   */
  still(look, role = null) {
    this.stillRole = look ? role : null;
    if (look) {
      this.stillLook = look;
      this._stillAnim = new FlatAnim(look.archive, look.frameCount);
      this.archive = look.archive;
    } else if (this.stillLook) {
      this.stillLook = null;
      this._stillAnim = null;
      this.archive = this.classArchive;
    }
    this.frame = 0;
    this._timer = 0;
  }

  /**
   * One frame of the billboard. The position is the living town's; `wantsToStop` the street's politeness gate (the
   * walker's own, mobilePerson.js personWantsToStop), which stands it to face the player - the town holds its clock
   * back while it does (livingTown.js). LW-TALK: standing otherwise (`stand`), the way it faces on the walk wheel.
   * @param {number} dt @param {number[]} cameraPos @param {boolean} [wantsToStop]
   * @returns {{ record: number, frame: number, flip: boolean }}
   */
  update(dt, cameraPos, wantsToStop = false) {
    if (this.stillLook && this._stillAnim)
      return this._frameOut(this.stillLook.record, this._stillAnim.tick(dt), false); // LW-LOOKS: a still picture
    if (this.armed && this.unit)
      return this.unit.update(dt, { moving: this.moving && !wantsToStop }, this.yaw, this.pos, cameraPos);
    const st = wantsToStop ? 'idle' : this.moving ? 'move' : 'stand';
    if (st !== this.state) {
      this.state = st;
      this.frame = 0;
      this._timer = 0;
      this.stir = null;
      this._stirT = 0;
      this._stirNext = 0;
    }
    if (st === 'stand') this._standLife(dt);
    const fps = st === 'idle' ? PERSON_IDLE_FPS : PERSON_MOVE_FPS * this.pace;
    this._timer += dt;
    while (this._timer >= 1 / fps) {
      this._timer -= 1 / fps;
      this.frame++;
    }
    if (st === 'idle') {
      const rec = this.guard ? PERSON_GUARD_IDLE_RECORD : PERSON_IDLE_RECORD;
      const n = Math.max(1, this.frameCount(rec, this.archive));
      return this._frameOut(rec, this.frame % n, false);
    }
    const o = mobileOrientation(st === 'stand' ? this.shownYaw : this.yaw, this.pos, cameraPos);
    const rec = MOVE_RECORDS[o];
    const n = Math.max(1, this.frameCount(rec, this.archive));
    return this._frameOut(rec, st === 'stand' ? this._standFrame(n, rec) : this.frame % n, MOVE_FLIPS[o]);
  }
}
