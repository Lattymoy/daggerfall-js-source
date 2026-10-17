// @ts-check
// CLIMB4 - THE FEEL: THE CLIMB'S SOUNDS (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I reallty
// want go to go all in with the detai. Liike proer feel to climbing").
//
// The camera's twin (player/climb/climbFeel.js): fed the same frame of the motor - its climb events (motor.js _pkEmit), the
// move in flight and its clock, the hold, the position and the grip - and answering with what the ear hears, played
// flat at the listener as the stride is (the climber's own body). DAGGER.SND has none of it, so the eleven clips are
// ours (tools/climbSfx.mjs -> public/sfx/climb-*.wav, provenance in public/sfx/SOURCES.md), registered on the bus
// under string keys the naval arc's way (systems/naval/navalSounds.js); the climber's effort is the player's own voice
// (scenes/hostCombat.js playerClimbStrain - DAGGER.SND's attack grunts, the same gates), and a foot set down on a top
// is the stride's (systems/footsteps.js: ground regained lands one step).
//
// What the ear hears (each number below is CLIMB_SOUND's):
//   - A CATCH: both hands slapping onto the lip, the body meeting the wall - louder the faster it came - the boots
//     scuffing for the face and grit pattering down; a hard one (a fall caught) wrings a grunt.
//   - THE FREE CLIMB: hand over hand - a hand placed at every reach the camera rolls with (FEEL.REACH), a boot finding
//     its hold half a reach after; THE SHIMMY: a hand re-taking the lip at every span along it (FEEL.SHIMMY_SPAN).
//   - A PULL-UP: the hands on the lip (unless they hold it already), the haul - the leathers, the body over the edge, a
//     knee set down - and the boots scraping over the sill; from a hang, often the effort's grunt. A step-up is a hand
//     and a scuff.
//   - THE VAULT: a hand slapped on the top and the body's rush over it. THE LOWER: the body sliding over the edge, the
//     hands taking its weight at the lip, the boots meeting the wall. A CORNER: two hands round it.
//   - LEAPS: the push, the rush through the air, the hands taking the hold at the far end; the eject's push and rush;
//     a wall run's boots up the wall. Often a grunt at the launch.
//   - THE GRIP FAILING: grit and pebbles coming away under the fingers, and again every few seconds while it holds;
//     the grip GONE: the boots scrabbling, the stone giving, a cry.
//   - LETTING GO: the hands leaving the stone.
// Every one is varied - a clip of several, never the one just heard, and its pitch moved a little - so a climb's rhythm
// never rings as one sample again and again. Off with the port's own sounds (systems/enhancedSounds.js - the enhanced
// skin's ES1 switch): the classic skin plays what DFU plays and nothing more.

import { APP_ROOT } from '../../systems/appRoot.js';
import { enhancedSoundsOn } from '../../systems/enhancedSounds.js';
import { PARKOUR_GRIP_LOW } from '../parkour.js';
import { FEEL } from './climbFeel.js';

/** The sounds, each its clips' keys (a clip of several is never the one just heard). */
export const CLIMB_SFX = Object.freeze({
  grab: Object.freeze(['climb:grab-1', 'climb:grab-2']),
  catch: Object.freeze(['climb:catch']),
  step: Object.freeze(['climb:step-1', 'climb:step-2', 'climb:step-3']),
  scrape: Object.freeze(['climb:scrape-1', 'climb:scrape-2']),
  pull: Object.freeze(['climb:pull']),
  whoosh: Object.freeze(['climb:whoosh']),
  crumble: Object.freeze(['climb:crumble']),
});
/** Each key's file under public/sfx (`climb:grab-1` -> climb-grab-1.wav). */
export const CLIMB_SFX_FILES = Object.freeze(Object.fromEntries(
  Object.values(CLIMB_SFX).flat().map((key) => [key, `${key.replace(':', '-')}.wav`]),
));

/** The constants of the climb's sounds: volumes (the bus's 0..1 - the stride plays at 0.7), pitches, times. */
export const CLIMB_SOUND = Object.freeze({
  GRAB: 0.6,               // a hand taking a lip
  CATCH_BASE: 0.5,         // both hands and the body, at a standstill...
  CATCH_PER_SPEED: 0.06,   // ...and per m/s it came to the lip at
  CATCH_MAX: 0.95,
  HARD_CATCH_SPEED: 5,     // m/s: a catch this fast is a fall caught - it wrings a grunt
  STEP: 0.34,              // a hand placed, hand over hand
  SHIMMY: 0.26,            // a hand re-taking the lip along it
  SHIMMY_PITCH: 1.08,      // ...fingers, a little higher
  FOOT: 0.22,              // a boot finding its hold
  FOOT_PITCH: 0.72,        // ...a boot, lower
  SCRAPE: 0.4,             // boots scrabbling
  PULL: 0.55,              // the haul over a lip
  STEP_UP_RISE: 0.7,       // m: a mantle lower than this is a step-up - a hand and a scuff, no haul
  HIGH_PULL_RISE: 1.2,     // m: a mantle this high is the whole haul
  WHOOSH: 0.42,            // a body through the air
  CRUMBLE: 0.5,            // the grip failing
  TRICKLE: 0.3,            // ...and the grit again while it holds
  TRICKLE_MIN_S: 1.6,
  TRICKLE_MAX_S: 3.4,
  LET_GO: 0.22,            // the hands leaving the stone
  SLIP: 0.55,              // the grip gone: the boots scrabbling
  PITCH_JITTER: 0.06,      // every clip's pitch moved by up to this, either way
  STRAIN: 0.6,             // the effort's grunt (the player's attack voice)...
  STRAIN_GAP_S: 3,         // ...never within this of the last
});

// ---- the clips' loading: once, the first frame the sounds are on ----------------------------------------------------

export const climbSfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _install = null;
/** Register the eleven clips, once. Answers how many took; a clip that will not load is silence, never a stopped climb. */
export function installClimbSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_install ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(climbSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(CLIMB_SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the climb goes on, silently */ }
    }
    return n;
  })());
}
/** Test seam. */
export function _resetClimbSounds() { _install = null; }

/** One of `sound`'s clips - never `prev` while it has another - and `pitch` moved by up to the jitter either way:
 *  { key, pitch }, or null for a sound with no clips. The local climb's and the peers' one choice (net/peer/peerClimb.js). */
export function climbClip(sound, prev, rand, pitch = 1) {
  const keys = CLIMB_SFX[/** @type {keyof typeof CLIMB_SFX} */ (sound)];
  if (!keys) return null;
  let key = keys[Math.floor(rand() * keys.length) % keys.length];
  if (keys.length > 1 && key === prev) key = keys[(keys.indexOf(key) + 1) % keys.length];
  return { key, pitch: pitch * (1 + CLIMB_SOUND.PITCH_JITTER * (2 * rand() - 1)) };
}

// ---- the moves' cues: what each move sounds, at which share of its time ---------------------------------------------

/**
 * A move's cues, `[t, sound, volume, pitch, strainChance]` sorted by t (0..1 of the move; 1 is its arrival). `e` is the
 * motor's move event; `from` the hold it came out of this frame ('hang' | 'climb' | null).
 * @param {any} e
 * @param {string|null} from
 */
export function moveCues(e, from) {
  const C = CLIMB_SOUND;
  const split = Number.isFinite(e.split) ? Math.min(1, Math.max(0, e.split)) : 0.5;
  const rise = e.rise ?? 0;
  /** @type {Array<[number, string|null, number, number, number]>} */
  const cues = [];
  switch (e.kind) {
    case 'catch':
    case 'reach': {   // AUDIT CLIMB-ARC nit: a reach round a cornice takes its lip as a catch does - and dips the eye as one, so it sounds as one
      const speed = e.speed ?? 0;
      cues.push([0, 'catch', Math.min(C.CATCH_MAX, C.CATCH_BASE + C.CATCH_PER_SPEED * speed), 1, speed > C.HARD_CATCH_SPEED ? 0.5 : 0]);
      break;
    }
    case 'mantle':
      if (rise < C.STEP_UP_RISE) {
        if (!from) cues.push([0, 'grab', C.GRAB * 0.7, 1, 0]);
        cues.push([split, 'scrape', C.SCRAPE * 0.6, 1, 0]);
      } else {
        if (!from) cues.push([0, 'grab', C.GRAB * 0.9, 1, 0]);
        cues.push([0.06, 'pull', C.PULL * (rise >= C.HIGH_PULL_RISE ? 1 : 0.7), 1, from === 'hang' ? 0.5 : rise >= 1.4 ? 0.35 : 0]);
        cues.push([split, 'scrape', C.SCRAPE * 0.75, 1, 0]);
      }
      break;
    case 'vault':
      cues.push([split * 0.6, 'grab', C.GRAB * 0.8, 1.08, 0]);
      cues.push([split, 'whoosh', C.WHOOSH * 0.6, 1.1, 0]);
      break;
    case 'lower':
      cues.push([0, 'scrape', C.SCRAPE, 0.92, 0]);
      cues.push([split, 'grab', C.GRAB, 1, 0]);
      cues.push([0.92, 'step', C.FOOT, C.FOOT_PITCH, 0]);
      break;
    case 'corner':
      cues.push([0.2, 'step', C.SHIMMY * 1.15, C.SHIMMY_PITCH, 0]);
      cues.push([0.7, 'step', C.SHIMMY * 1.15, C.SHIMMY_PITCH, 0]);
      break;
    case 'leap':
      cues.push([0, 'step', C.STEP, 0.75, rise > 0.3 ? 0.6 : 0.4]);   // the push off
      cues.push([0.02, 'whoosh', C.WHOOSH, 1, 0]);
      cues.push([1, 'grab', C.GRAB * 1.2, 1, 0]);                     // the hands taking the far hold
      break;
    case 'wallrun':
      cues.push([0, 'whoosh', C.WHOOSH * 0.5, 0.9, 0.35]);
      cues.push([0.1, 'step', C.FOOT * 2, C.FOOT_PITCH, 0]);
      cues.push([0.32, 'step', C.FOOT * 1.9, C.FOOT_PITCH * 0.95, 0]);
      cues.push([0.54, 'step', C.FOOT * 1.8, C.FOOT_PITCH * 1.03, 0]);
      cues.push([1, 'grab', C.GRAB * 1.1, 1, 0]);
      break;
    default: break;
  }
  return cues.sort((a, b) => a[0] - b[0]);
}

// ---- the law ---------------------------------------------------------------------------------------------------------

export class ClimbSounds {
  /**
   * @param {{ audio?: any, strain?: ((rolls: () => number) => ({ clip: number, pitchLift?: number } | null)) | null,
   *   rand?: () => number, on?: () => boolean, install?: boolean }} [opts]
   *   `audio` the bus (playOneShot); `strain(rolls)` the player's effort voice ({ clip, pitchLift } or null - the host's
   *   seam onto hostCombat.playerClimbStrain); `rand` the variety's dice (the pins' seam; Math.random bare - the port's own variety, no DFU draw);
   *   `on` the switch (the port's own sounds); `install` false keeps the clips unloaded (a pin's bus has none).
   */
  constructor({ audio = null, strain = null, rand = Math.random, on = enhancedSoundsOn, install = true } = {}) {
    this.audio = audio;
    this.strain = strain;
    this.rand = rand;
    this.on = on;
    this.install = install;
    this.last = new Map();   // sound -> the key last played (never twice running)
    this.reset();
  }

  /** Back to rest (a placement, a load). */
  reset() {
    this.t = 0;
    this.prev = null;
    this.cues = null;        // the move in flight's cues not yet played
    this.climbPhase = 0;     // reaches climbed (the camera's FEEL.REACH)
    this.shimmyPhase = 0;    // spans moved along the lip
    this.trickleAt = Infinity;
    this.lastStrain = -Infinity;
  }

  /** One render frame, after the motor moved. `m` the motor (climbFeel's reading of it). */
  update(dt, m) {
    this.t += Math.min(Math.max(dt, 0), 1 / 20);
    if (!m || !this.on()) { this.cues = null; this.prev = null; return; }
    if (this.install && this.audio) installClimbSounds(this.audio);
    const events = m.climbEvents ?? [];
    const live = m.climbMove;
    const moving = events.some((e) => e.type === 'move');
    let from = null;
    for (const e of events) {
      switch (e.type) {
        case 'release':
          from = e.mode ?? null;
          if (!moving) {
            if (!(m.grip > 0)) {
              // the grip GONE: the boots scrabbling, the stone giving under the fingers, a cry
              this._play('scrape', CLIMB_SOUND.SLIP);
              this._play('crumble', CLIMB_SOUND.CRUMBLE);
              this._strain(0.7, m);
            } else {
              this._play('step', CLIMB_SOUND.LET_GO, 1.15);   // the hands leaving the stone
            }
          }
          this.trickleAt = Infinity;
          break;
        case 'move':
          this._flush(1);   // a move chained on: the last one ended - what it still owed is due
          this.cues = moveCues(e, from);
          from = null;
          this._due(0, m);
          break;
        case 'hold':
          this.climbPhase = 0; this.shimmyPhase = 0;
          if (this.cues && !live) {
            this._flush(1, m);   // the move's arrival: its last cues are its own sound of the hold
          } else {
            this._play('grab', CLIMB_SOUND.GRAB * (e.mode === 'hang' ? 0.85 : 0.75));   // the hands onto the wall
          }
          break;
        case 'launch':
          this._play('step', CLIMB_SOUND.STEP, 0.75);   // the push off
          this._play('whoosh', CLIMB_SOUND.WHOOSH);
          this._strain(0.45, m);
          break;
        case 'gripLow':
          this._play('crumble', CLIMB_SOUND.CRUMBLE);
          this.trickleAt = this.t + this._between(CLIMB_SOUND.TRICKLE_MIN_S, CLIMB_SOUND.TRICKLE_MAX_S);
          break;
        default: break;
      }
    }
    // the move in flight: its cues as its clock reaches them; ended without a hold (onto a top, out of a vault), the rest
    if (this.cues) {
      if (live) this._due(live.t ?? 0, m);
      else this._flush(1, m);
    }
    // the hold's rhythm: hands and boots as the body moves on the wall
    const p = m.climbTrackPos?.() ?? m.pos;   // AUDIT CLIMB-ARC F3/F8: the frame's own way, never a carry's
    let dx = 0, dy = 0, dz = 0;
    if (this.prev && p && m.onWall && !live) { dx = p[0] - this.prev[0]; dy = p[1] - this.prev[1]; dz = p[2] - this.prev[2]; }
    this.prev = p && (m.onWall || live) ? [p[0], p[1], p[2]] : null;
    if (Math.hypot(dx, dy, dz) > 1) { dx = dy = dz = 0; }   // a teleport (a recentre, a placement) is no travel
    if (m.onWall && !live) {
      if (m.hanging) {
        const n = m.wallNormal;
        const along = n ? Math.abs(-n[2] * dx + n[0] * dz) : 0;
        if (along > 1e-5) {
          const was = this.shimmyPhase;
          this.shimmyPhase += along / FEEL.SHIMMY_SPAN;
          if (Math.floor(this.shimmyPhase) > Math.floor(was)) this._play('step', CLIMB_SOUND.SHIMMY, CLIMB_SOUND.SHIMMY_PITCH);
        }
      } else {
        const travel = Math.hypot(dx, dy, dz);
        if (travel > 1e-5) {
          const was = this.climbPhase;
          this.climbPhase += travel / FEEL.REACH;
          // a hand at every reach (the camera's roll crosses from one hand to the other there), a boot half a reach on
          if (Math.floor(this.climbPhase) > Math.floor(was)) this._play('step', CLIMB_SOUND.STEP);
          if (Math.floor(this.climbPhase - 0.5) > Math.floor(was - 0.5)) this._play('step', CLIMB_SOUND.FOOT, CLIMB_SOUND.FOOT_PITCH);
        }
      }
      // the grip failing: the grit again, every few seconds while it holds
      if (m.grip <= PARKOUR_GRIP_LOW && this.t >= this.trickleAt) {
        this._play('crumble', CLIMB_SOUND.TRICKLE);
        this.trickleAt = this.t + this._between(CLIMB_SOUND.TRICKLE_MIN_S, CLIMB_SOUND.TRICKLE_MAX_S);
      }
    } else if (!live) {
      this.trickleAt = Infinity;
    }
  }

  /** Play the cues due by `t`. */
  _due(t, m = null) {
    const c = this.cues;
    if (!c) return;
    while (c.length && c[0][0] <= t + 1e-9) {
      const [, sound, vol, pitch, strain] = /** @type {[number, string|null, number, number, number]} */ (c.shift());
      if (sound) this._play(sound, vol, pitch);
      if (strain > 0) this._strain(strain, m);
    }
  }

  /** The move is over: everything it still owed by `t`, then no cues. */
  _flush(t, m = null) {
    this._due(t, m);
    this.cues = null;
  }

  /** One of `sound`'s clips - never the one just heard - at `vol`, its pitch moved a little. */
  _play(sound, vol, pitch = 1) {
    if (!this.audio?.playOneShot) return;
    const c = climbClip(sound, this.last.get(sound), this.rand, pitch);
    if (!c) return;
    this.last.set(sound, c.key);
    this.audio.playOneShot(c.key, Math.min(1, vol), c.pitch);
  }

  /** The climber's effort: the player's own voice, at `chance` (more as the grip runs out), never within STRAIN_GAP_S. */
  _strain(chance, m) {
    if (!this.strain || this.t - this.lastStrain < CLIMB_SOUND.STRAIN_GAP_S) return;
    const grip = Number.isFinite(m?.grip) ? Math.min(1, Math.max(0, m.grip)) : 1;
    if (this.rand() >= Math.min(0.9, chance * (1 + (1 - grip)))) return;
    const voice = this.strain(this.rand);
    if (!voice || !(voice.clip >= 0)) return;
    this.lastStrain = this.t;
    this.audio?.playOneShot?.(voice.clip, CLIMB_SOUND.STRAIN, 1 + (voice.pitchLift ?? 0));   // AUDIT 58: the lift spent, as every voice site spends it
  }

  _between(a, b) { return a + (b - a) * this.rand(); }
}
