// THE CLASSIC SPELLCASTING HANDS, 1:1.
//
// Source, verbatim: FPSSpellCasting.cs (Assets/Scripts/Game, 324
// lines) - PlayOneShot, SetCurrentAnims, UpdateSpellCast,
// AlignLeftHand/AlignRightHand, the AnimateSpellCast coroutine and
// OnGUI's two DrawTextureWithTexCoords calls - plus
// WeaponBasics.GetMagicAnimFilename (:187-204), which is the whole
// per-element archive table.
//
// It is a SEPARATE module from fpsWeapon.js for the reason DFU's own
// header gives: "Spellcasting animations have different texture and
// layout requirements to weapons and are never mixed with weapons
// directly on screen at same time. Opted to create a new class to
// play these animations and separate from FPSWeapon." Everything
// differs - a 300-wide design surface rather than 320, one frame per
// record rather than a frame list, TWO hands drawn per frame with the
// right one mirrored, and a frame-index list that starts and ends on
// the same small frame.
//
// THE ART comes from the player's own ARENA2 at runtime through the
// SAME path the weapon sprite rides: CifRciFile over fetched bytes,
// ART_PAL.COL, fpsWeapon's frameToColor32 bake (index 0 transparent),
// renderer.uploadTexture. There is no dye - a spell has no material -
// so the bake is called with a null dye, which is the branch
// FPSWeapon.GetWeaponTexture2D takes for steel.
//
// THE ANIMATION IS A SINGLETON, exactly as DFU's is: FPSSpellCasting
// is ONE component on the player (GameManager.PlayerSpellCasting,
// GameManager.cs:322), and this port has four hosts each holding
// their own weapon rig. A per-rig animation would have played in the
// rig that took the cast and drawn in whichever rig owns the frame -
// which for a spell cast from inside a building is not the same rig
// (worldModes' interior rig shares its parent host's cast engine).
// One player, one pair of hands.

import { CifRciFile } from '../formats/cifRciFile.js';
import { frameToColor32 } from './fpsWeapon.js';   // the ONE indexed-bitmap bake
import { weaponOffsetHeight } from '../ui/hudLarge.js';

/** nativeScreenWidth / nativeScreenHeight (:44-45). NOT 320x200: the
 *  hands are laid out against a 300-wide surface, which is why they
 *  sit further in from the edges than a weapon sprite does. The
 *  comment at :218 - "Source casting animations are designed to fit
 *  inside a fixed 320x200 display" - is about the ART, not the scale. */
export const NATIVE_SPELL_W = 300;
export const NATIVE_SPELL_H = 200;

/** releaseFrame (:46) - the step the spell leaves the hands on. */
export const RELEASE_FRAME = 5;

/** smallFrameAdjust (:47): frames 0 and 5 (and fire's frame 4) are
 *  narrower drawings, and are pushed in by this fraction of the
 *  screen so the hands stay where the wide frames put them. */
export const SMALL_FRAME_ADJUST = 0.134;

/** animSpeed (:48) - "Set slower than classic for now", DFU's own
 *  note. Seven steps at 0.04s is a 0.28s cast. */
export const ANIM_SPEED = 0.04;

/** frameIndices (:50) - "Animation starts and ends with frame 0". */
export const FRAME_INDICES = Object.freeze([0, 1, 2, 3, 4, 5, 0]);

/**
 * The classic element index a spell record carries - the SAME
 * numbering systems/spellcast.js ELEMENTS uses and missileArchive
 * indexes (375..379 = fire/cold/poison/shock/magic, DaggerfallMissile
 * .cs:55-59). DFU's ElementTypes enum is a bit field (None 0, Fire 1,
 * Cold 2, Poison 4, Shock 8, Magic 16) that this port never adopted;
 * the table below is GetMagicAnimFilename's switch re-indexed onto the
 * port's spelling, arm for arm.
 */
export const ELEMENT_TYPES = Object.freeze({ Fire: 0, Cold: 1, Poison: 2, Shock: 3, Magic: 4 });

/** WeaponBasics.GetMagicAnimFilename (:187-204), verbatim. */
export const MAGIC_ANIM_FILE = Object.freeze([
  'FIRE00C6.CIF',   // Fire
  'FRST00C6.CIF',   // Cold
  'POIS00C6.CIF',   // Poison
  'SHOK00C6.CIF',   // Shock
  'MJIC00C6.CIF',   // Magic
]);

/** GetMagicAnimFilename's default arm throws "Unsupported element
 *  type." - and it is reachable, because ElementTypes.None is a value
 *  a spell settings record can carry. A throw here would take the
 *  frame down instead of the cast, so the refusal answers null and the
 *  caller plays no animation; every other clause is verbatim. */
export function magicAnimFilename(element) {
  return MAGIC_ANIM_FILE[element] ?? null;
}

/**
 * SetCurrentAnims' loader (:150-199), minus the two arms DFU never
 * reaches: `border`/`dilate` are 0/false at the only call site
 * (:139), so the DilateColors branch is dead in the reference too.
 *
 * "Load textures - spells have a single frame per record unlike
 * weapons" (:174) - hence GetColor32(record, 0, ...) and one texture
 * per record, where the weapon loader walks a frame list.
 *
 * FLAGGED: TextureReplacement.TryImportCifRci (:179) - the loose-file
 * CIF override a texture mod supplies - is not consulted, exactly as
 * combat/fpsWeapon.js does not consult it for WEAPON*.CIF. The port's
 * replacement registry (systems/textureReplacement.js) covers archive
 * textures only, so there is no CIF door to knock on yet.
 *
 * @returns {Promise<{element:number, records:{width:number,height:number,tex:*}[]}>}
 */
export async function loadSpellCastArt(getBytes, palette, renderer, element) {
  const fileName = magicAnimFilename(element);
  if (!fileName) return null;
  const cif = new CifRciFile();
  // "Could not load spell anims file {0}" (:169) - DFU throws; the
  // caller here catches and the hands simply do not draw.
  if (!cif.load(await getBytes(fileName), fileName, palette)) {
    throw new Error(`Could not load spell anims file ${fileName}`);
  }
  const records = [];
  for (let r = 0; r < cif.recordCount; r++) {
    const size = cif.getSize(r);
    // No dye: a spell has no material. This is GetWeaponTexture2D's
    // steel arm, which is the branch that skips ChangeDye entirely.
    const c32 = frameToColor32(cif.getDFBitmap(r, 0), palette, null);
    records.push({
      width: size.width,
      height: size.height,
      tex: renderer.uploadTexture('img', `fpsc:${fileName}:${r}`, c32),
    });
  }
  return { element, records };
}

/**
 * FPSSpellCasting's own state: currentAnimType, currentFrame and the
 * AnimateSpellCast coroutine (:265-286), as one object.
 *
 * The coroutine is `while (true) { ...; yield return
 * WaitForSeconds(animSpeed); }` - a fixed-period stepper that runs
 * whether or not anything is playing, so a cast started mid-period
 * shows its first frame for less than a full period. The accumulator
 * below is that same fixed period; it is reset at PlayOneShot rather
 * than carried, which is the one place this cannot be verbatim (a
 * free-running coroutine has no start).
 */
export class SpellCastAnim {
  constructor() {
    this.element = null;    // currentAnimType
    this.currentFrame = -1;
    this._acc = 0;
  }

  /** IsPlayingAnim (:71-74). */
  get isPlayingAnim() { return this.currentFrame >= 0; }

  /** frameIndices[currentFrame] - the RECORD to draw, or -1. */
  get frameIndex() { return this.currentFrame < 0 ? -1 : FRAME_INDICES[this.currentFrame]; }

  /**
   * PlayOneShot (:126-136), verbatim: "Do nothing if already playing
   * anim", then SetCurrentAnims + currentFrame = 0. The element gate
   * is magicAnimFilename's refusal (see there).
   * @returns true when a cast actually started.
   */
  playOneShot(element) {
    if (this.isPlayingAnim) return false;
    if (!magicAnimFilename(element)) return false;
    this.element = element;
    this.currentFrame = 0;
    this._acc = 0;
    return true;
  }

  /**
   * AnimateSpellCast's body (:267-283). Steps at ANIM_SPEED, raises
   * the release on the step that reaches releaseFrame, and ends the
   * animation past the last index.
   *
   * FLAGGED: the release is not the spell. DFU raises OnReleaseFrame
   * HERE and EntityEffectManager.PlayerSpellCasting_OnReleaseFrame
   * (:2098-2143) is what actually spends, tallies, assigns the bundle
   * or launches the missile - so in the reference the hands are five
   * frames (0.2s) into their motion before the spell leaves them. This
   * port already runs those semantics, but SYNCHRONOUSLY: hostMagic's
   * castInput resolves the whole cast and then raises
   * onCastReadySpell, which is the ported OnReleaseFrame moment (see
   * scenes/hostMagic.js:308, :329, :342, :352). The hands are started
   * from that same moment, so the animation's own release frame lands
   * 0.2s AFTER the spell rather than on it, and this method's return
   * value is deliberately not wired to anything - a second release
   * would fire the cast twice.
   *
   * @returns true on the step that crossed the release frame.
   */
  tick(dt) {
    if (!this.isPlayingAnim) { this._acc = 0; return false; }
    this._acc += dt;
    let released = false;
    while (this._acc >= ANIM_SPEED && this.currentFrame >= 0) {
      this._acc -= ANIM_SPEED;
      this.currentFrame++;
      if (this.currentFrame === RELEASE_FRAME) released = true;
      if (this.currentFrame >= FRAME_INDICES.length) this.currentFrame = -1;
    }
    return released;
  }
}

/** THE ONE PAIR OF HANDS (see the header): DFU's single
 *  GameManager.PlayerSpellCasting component. */
export const fpsSpellCasting = new SpellCastAnim();

/**
 * UpdateSpellCast (:201-231) + AlignLeftHand (:233-241) and
 * AlignRightHand (:243-251), verbatim.
 *
 * screenRect.x/y are 0 here: DaggerfallUI.CustomScreenRect is the
 * retro-rendering rect, and this port composites its overlays onto
 * the canvas itself.
 *
 * The non-point filter adjust (:212-217) - "Adjust scale to be
 * slightly larger when not using point filtering... reduces the
 * effect of filter shrink at edge of display", handScaleX/Y *= 1.01 -
 * is CORRECTLY ABSENT, the same answer the 2026-08-17 classic-weapon
 * parity audit reached for FPSWeapon's identical fudge (Combat.md,
 * "NEAREST filtering (DFU's 1.01 non-point fudge correctly absent)").
 * renderer.uploadTexture binds NEAREST for every image texture
 * (render/renderer.js textureParams), so there is no filter shrink to
 * compensate for; applying it off the Video/MainFilterMode setting
 * alone would scale the hands up by 1% for nothing.
 */
export function spellHandRects(canvas, rec, { frameIndex, element, offsetHeight = 0 }) {
  const handScaleX = canvas.width / NATIVE_SPELL_W;
  const handScaleY = canvas.height / NATIVE_SPELL_H;
  // "Frames 0 and 5 are always small frames"; "Fire frame 4 is also a
  // small frame" (:220-225).
  const offsetWidth = (frameIndex === 0 || frameIndex === 5
    || (element === ELEMENT_TYPES.Fire && frameIndex === 4)) ? SMALL_FRAME_ADJUST : 0;
  const w = rec.width * handScaleX;
  const h = rec.height * handScaleY;
  const y = canvas.height - h - offsetHeight;
  return {
    left: { x: canvas.width * offsetWidth, y, w, h },
    right: { x: canvas.width * (1 - offsetWidth) - w, y, w, h },
  };
}

/** rightHandAnimRect = new Rect(1, 0, -1, 1) (:210) - the right hand
 *  is the SAME drawing, mirrored. leftHandAnimRect is the identity. */
export const RIGHT_HAND_UV = Object.freeze({ u0: 1, v0: 0, u1: 0, v1: 1 });

/**
 * OnGUI's repaint (:110-118): the frame's record drawn twice, left
 * hand upright and right hand mirrored, "behind other HUD elements".
 *
 * offsetHeight defaults to the large HUD's weapon offset - :86-95 is
 * FPSWeapon's rule word for word ("Same logic as in FPSWeapon"), so
 * it reads the one home rather than restating the gate.
 */
export function drawSpellCastHands(renderer, canvas, art, frameIndex, {
  offsetHeight = weaponOffsetHeight(),
} = {}) {
  if (!art || frameIndex < 0) return false;
  const rec = art.records[frameIndex];
  if (!rec || !rec.width || !rec.height) return false;
  const { left, right } = spellHandRects(canvas, rec, { frameIndex, element: art.element, offsetHeight });
  renderer.drawScreenQuad(rec.tex, left);
  renderer.drawScreenQuad(rec.tex, right, RIGHT_HAND_UV);
  return true;
}
