// @ts-check
// SD-THROUGH (2026-10-21, the owner: "So the abyss dungeon. When someone finds and enters the portal. I want a portal to
// show up for anyone in the dungeon and anyone entering that automatically leads them there."; bible/11-Multiplayer/
// Super-Dungeons.md section 6 and SD-THROUGH): THE WAY THROUGH, stood by the dungeon host (scenes/dungeonContext.js) in a
// Hollow once its Rift has been stepped through.
//
//  - THE WORD: the hub's record says when the first soul went through (`inAt` - its realm's first admission, told to the
//    hub, net/superDungeon/sdLaw.js sdEnter); the world host's word on the Hollow's end carries it (`through` - world/
//    superDungeon/sdDungeon.js sdThroughStands) beside the Rift's own (`word`, `returns`, `count`, `enter`).
//  - THE MOMENT: asked once a second. The first ask that finds it through - and the Rift admitting me (a fighter the Hour
//    refused for good gets none) - stands it beside me where it stands whole (sdThroughPlace: beside the way I look, its
//    ring clear of every wall and the ceiling, a way past it, dry), with its line said. That is the moment someone first
//    goes through for everyone already inside, and the first second of the visit for everyone who comes in after - or,
//    AUDIT SD-THROUGH (B2, B5, B6), the first ask after it that finds me on my floor in a place it stands whole, and out of
//    SD_THROUGH_NEAR_RIFT_M of the Hollow's Rift (the Rift is right there: one back from the Hour lands beside it). Once a
//    visit, never moved.
//  - THE LOOK: a second Rift (scenes/superDungeon/sdEnd.js), at the Rift's least size, in the Rift's own state - the
//    brass astrolabe whose open iris shows the Hour, GOLD, the machine live (Super-Dungeons-Look.md's five lights: it is
//    the way in, never the MOON of a way out). Its bell, its reveal's toll, its floor light and its window the Rift's.
//  - THE STEP: PRESSED, NEVER WALKED INTO (AUDIT SD-THROUGH B1 - the way home's law, AUDIT SD II L6 F9: it stands where
//    players walk, and a walk into it took one into the Hour in half a second, one life a Hollow), its press `sdrift:1`
//    (the press ladder's `sdrift:` arm) YIELDING to anything firm behind it (B3: the Hollow's way out stood behind it at
//    an entry, and a press at the door took the Hour). It is the Rift's own step (`onStep`, the host's sdRiftStep): its
//    word asked again, the veil, out of the Hollow and into the realm, whose hello asks the Rift's law once more (the
//    relay's _sdAdmit).
//  - ITS END: it goes out with the Return - when the boss falls (`returns` false), for good this visit; a collapse's
//    fighters go back by the Rift itself.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { createSdEnd } from './sdEnd.js';
import { sdThroughPlace, SD_THROUGH_TEXT, SD_THROUGH_NEAR_RIFT_M } from '../../world/superDungeon/sdDungeon.js';

/** Its key in the activation ray - the press ladder routes every `sdrift:` to the host's sdPress. */
export const SD_THROUGH_KEY = 'sdrift:1';
/** How often the world host's word is asked (ms) - the Return's own beat. */
export const SD_THROUGH_ASK_MS = 1000;
/** AUDIT SD-THROUGH (B9): how far from it I stand for its light to be let go (m) - the Rift's reveal's reach; past it the
 *  ring lights nothing I see, and a held slot pushed a torch beside me out of the dungeon's light list. */
export const SD_THROUGH_LIGHT_M = 30;
const NONE = Object.freeze([]);

/**
 * THE VEIL'S PIVOT of the two rings a Hollow may stand: the nearer to `eye` of the Way Through's window (`through`'s
 * look) and the Rift's (`end`'s look: its window, else its Return's window home), so the blades close on the ring I
 * step into. Pure, and asked every frame the rings are drawn, so nothing is made (AUDIT SD V P1's law): models are
 * column-major, their place at 12-14.
 */
export function sdVeilModelOf(eye, through, end) {
  const b = end?.window?.model ?? end?.bay?.model ?? null, a = through?.window?.model ?? null;
  if (!a || !b || !eye) return a ?? b;
  return far2(a, eye) <= far2(b, eye) ? a : b;
}
/** How far a model's place stands from `eye`, squared. */
function far2(m, eye) { return (m[12] - eye[0]) ** 2 + (m[13] - eye[1]) ** 2 + (m[14] - eye[2]) ** 2; }
/** AUDIT SD-THROUGH (B8): THE TWO LOOKS FARTHER FIRST, for a pass that writes no depth - the nearer window drawn last,
 *  over the farther where they meet on the screen; one kept pair, filled (nothing made a frame). */
export function sdRingsFarFirst(eye, through, end) {
  const nearIsThrough = !!through?.window?.model && sdVeilModelOf(eye, through, end) === through.window.model;
  _pair[0] = nearIsThrough ? end : through; _pair[1] = nearIsThrough ? through : end;
  return _pair;
}
const _pair = [null, null];

/**
 * A Hollow's Way Through. `word()` the world host's word on the Hollow's end (world.js sdRiftOf, through the mode
 * machine: { word, returns, through, count, enter }); `look()` the Rift's state (its iris, its tone); `onStep()` the
 * Rift's step (the host's - true taken, false refused, null a step under way); `say(text)` the line as it opens;
 * `probe` the level's collider's (scenes/superDungeon/sdEnd.js sdProbeOf), `riftOf()` the Hollow's Rift as it stands ({ at }
 * or null), `dynamicDraws` the level's.
 * @param {{ renderer?: any, audio?: any, now?: () => number, word?: () => any, look?: () => any, clock?: (() => number) | null, onStep?: () => (boolean|null|void), say?: (text: string) => void, probe?: any, riftOf?: () => any, dynamicDraws?: any[] | null }} [deps]
 */
export function createSdThrough({ renderer = null, audio = null, now = () => performance.now(), word = () => null, look = () => null, clock = null, onStep = () => {}, say = () => {}, probe = null, riftOf = () => null, dynamicDraws = null } = {}) {
  // AUDIT SD-THROUGH: pressed alone (B1), its press yielding (B3), its plaque read as it is read (B10)
  const end = createSdEnd({ renderer, audio, now, onRift: onStep, riftKey: SD_THROUGH_KEY, riftTitle: () => SD_THROUGH_TEXT.title, riftTo: () => SD_THROUGH_TEXT.to, riftCount: () => word()?.count ?? null, look, clock, walkIn: false, riftYields: true });
  /** whether it stood this visit, whether it is decided out for it, when the word is next asked, and where I stood last
   *  (B9: its light let go far off) */
  let stood = false, out = false, askAt = -Infinity;
  const me = [0, 0, 0];
  let hasMe = false, ringAt = null;
  return {
    /** One frame: the word asked (once a second) - stood beside me, or taken out; then the ring's own frame (its press
     *  handed to `onStep`). `feet` mine (null: none this frame), `yaw` my heading, `eye` the reveal's. */
    frame(feet, yaw = 0, eye = null) {
      const t = now();
      if (feet) { me[0] = feet[0]; me[1] = feet[1]; me[2] = feet[2]; hasMe = true; }
      if (!out && feet && t >= askAt) {
        askAt = t + SD_THROUGH_ASK_MS;
        const w = word();
        if (stood) { if (w && !w.returns) { end.clear(); out = true; ringAt = null; } }   // the boss fell: out with the Return, for good
        else if (w?.through && w.word == null && probe) {
          const at = riftOf()?.at;
          // AUDIT SD-THROUGH (B6): the Rift right there is not yet, never "none this visit" - a floor above it, or a walk
          // away from it, asks again; (B2, B5): nowhere it stands whole, or my feet off their floor, is not yet too
          const near = !!at && Math.hypot(feet[0] - at[0], feet[2] - at[2]) < SD_THROUGH_NEAR_RIFT_M && Math.abs(feet[1] - at[1]) < SD_THROUGH_NEAR_RIFT_M;
          const place = near ? null : sdThroughPlace(feet, yaw, probe);
          if (place && end.stand({ rift: place, retAt: null, dynamicDraws, probe })) { stood = true; ringAt = place.at; say(SD_THROUGH_TEXT.opens); }
        }
      }
      return end.frame(feet, eye);
    },
    /** Whether it stands now. */
    get stands() { return !!end.rift; },
    /** Where it stands ({ at, size, face } or null - tests, the host's own questions). */
    get rift() { return end.rift; },
    targets: () => end.targets(),
    hoverName: (key) => end.hoverName(key),
    press: (key) => end.press(key),
    look: (eye, sky, hour) => end.look(eye, sky, hour),
    halos: () => end.halos(),
    lights() {
      const r = ringAt;
      if (r && hasMe && (r[0] - me[0]) ** 2 + (r[1] - me[1]) ** 2 + (r[2] - me[2]) ** 2 > SD_THROUGH_LIGHT_M * SD_THROUGH_LIGHT_M) return NONE;   // B9: its foot, kept - nothing made a frame
      return end.lights();
    },
    /** Gone with the dungeon: its meshes and its bell. */
    clear() { end.clear(); out = true; ringAt = null; },
  };
}
