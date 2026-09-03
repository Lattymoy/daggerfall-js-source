// U45 - HUDLARGE: the classic bottom status bar (HUDLarge.cs, MIT,
// Daggerfall Workshop). The single most recognisable piece of
// Daggerfall's screen, and this port drew none of it: `GUI/LargeHUD`
// has been in the settings store since the MENU slice, the pause
// window's FULL SCREEN button has been WRITING it since I3, and
// nothing has ever read it. Its own comment said so - "No large HUD
// exists in the port yet".
//
// IT IS AN ALTERNATIVE HUD, not an addition. DaggerfallHUD.cs:214-220
// turns off the vitals, the compass and the interaction-mode icon
// whenever it is on, "as they conflict in space or utility" - the
// crosshair and the breath bar stay. The arrow counter goes too, on
// DFU's own unresolved TODO ("Find a spot for arrow counter when
// large HUD enabled").
//
// ELEVEN CLICKABLE PANELS, and eight of them draw NOTHING: the bar
// art already has the buttons painted on it, so options, spellbook,
// inventory, sheath, use-magic-item, transport, map and rest are pure
// hit rectangles over MAIN00I0. Only four things are drawn over the
// bar - the colour background, the compass needle, the head, and the
// interaction-mode icon - plus the three vitals bars in their own
// rects inside it.
//
// THE TWO MODE CYCLES DISAGREE, and that is a real DFU quirk rather
// than a transcription slip. PlayerActivate.NextInteractionMode
// (:1431-1453) walks the ENUM order - Steal, Grab, Info, Talk - and
// that is what the port's keyboard cycle does. This panel's LEFT
// click walks Steal, TALK, GRAB, Info (:398-414) and its right click
// is the exact inverse of that (:417-438). So clicking the bar's mode
// button and pressing the mode key move through the same four modes
// in DIFFERENT orders, and a player who does both gets a sequence
// neither would produce alone. Ported as two separate walks, because
// they are two.
//
// THE ART IS ALL CLASSIC - no Ledger-A departure here, unlike U38's
// crosshair and mode icons, which DFU authors as its own PNGs.
// MAIN00I0.IMG is the 320x46 bar, MAIN01I0.IMG the four 47x23 mode
// icons stacked into one 47x92 sheet, MCOL00I0.CIF record 0 the 66x36
// colour field behind the portrait and vitals, and CMPA00I0.BSS the
// 32-frame compass needle (formats/bssFile.js, written for this).
//
// THE HEAD IS THE RACE'S - or the CURSE'S (V5): the racial-override
// hook DFU names ("lycanthrope shapechange, vampire infection") is
// live through racialOverrideHeadArt, and the identity KEY carries
// the override so the morph swaps the face the same frame.
//
// HUDActiveSpells (ui/hudActiveSpells.js, U46) and
// HUDEscortingNPCFaces (ui/hudEscortFaces.js, FE1) are the other two
// components of this row, each in its own home.
// ROAD-D D10 shipped the TWO OFFSETS this header used to flag, and
// the reason it gave for flagging them was already stale: the port
// draws the horse (systems/riding.js, scenes/world.js) and its
// viewmodel is combat/fpsWeapon.js's one bottom-anchored quad.
//
//   LargeHUDOffsetHorse (TransportManager.cs:304-309) lifts the horse
//   sprite by the bar's ScreenHeight whenever the bar is up and the
//   setting is on - DOCKED OR NOT, which is DFU's own asymmetry: the
//   horse arm never asks about docking. It defaults True, "to match
//   classic".
//
//   LargeHUDUndockedOffsetWeapon (FPSWeapon.cs:146-155) lifts the
//   weapon by the same height - and DFU FORCES that offset whenever
//   the bar is DOCKED, whatever the setting says, with its own
//   comment for why: "Weapon is forced to offset when using docked
//   HUD else it would appear underneath HUD... This helps user avoid
//   such misconfiguration or it might be interpreted as a bug." So
//   the setting only ever decides the UNDOCKED case, which is what
//   its name says and what the port's default False leaves off.
//
// Both read LargeHUD.ScreenHeight, which is the drawn bar's height -
// `largeHudBar().h` here - and both are gated on the HUD existing at
// all (`DaggerfallUI.Instance.DaggerfallHUD != null`), which is what
// a null bar means in this port.
//
// THE DOCKED BAR SHRINKS THE WORLD PASS, it does not cover it -
// SHIPPED (ROAD-E E5, 2026-09-02), and it was flagged here as AUDIT
// 39 F135 for two waves before it was. DFU pairs the docked bar with
// Utility/ViewportChanger.cs:52-67, which every frame sets the game
// camera's rect to `new Rect(0, hudHeight, 1, 1 - hudHeight)` where
// `hudHeight = largeHUD.ScreenHeight / Screen.height`, and with
// HUDCrosshair.cs:43-52, which answers by re-centring the crosshair
// into the reduced view. Both are here now:
//   - largeHudViewportRect is that Rect, digit for digit. Unity's
//     camera rect is normalized with a BOTTOM-LEFT origin, which is
//     gl.viewport's own space, so it crosses over without a flip.
//     The rect is renderer-owned FRAME state (Renderer
//     .setWorldViewport, consumed by the next beginFrame exactly as
//     ViewportChanger recomputes it every frame) and the 2D passes
//     take the canvas back at the first drawScreenQuad - the port's
//     one screen-space primitive - so no host has to remember it and
//     no menu, video or map scene can inherit a world frame's strip.
//   - largeHudWorldAspect is the other half, and it is NOT the
//     renderer's: each host builds its own perspective(), and Unity
//     derives a camera's aspect from its viewport, so a rect shrunk
//     without its denominator would STRETCH the world into the strip
//     instead of cropping the lens. The four hosts that draw the bar
//     take it - scenes/world.js, scenes/exterior.js,
//     scenes/worldModes.js (both modal arms) and scenes/dungeon.js -
//     and the sky, which draws into the same rect, takes the same
//     number. scenes/interior.js draws no HUD at all, so there is no
//     surface there to carry.
//   - the crosshair re-centre rides ui/hudCrosshair.js's
//     crosshairCentreY: DFU's `(Screen.height - ScreenHeight -
//     crosshairSize.y) / 2` is the reticle's TOP, so its CENTRE is
//     `(Screen.height - ScreenHeight) / 2` with the component's size
//     cancelled out - and this port draws its cross about a centre.
//     It could not ship before the viewport did: on its own it would
//     put the reticle somewhere the camera is not pointing, and a
//     lying reticle is worse than a covered strip.
//
// ROAD-D D10 re-examined this and NARROWED it. One clause of the
// original note is STALE and is withdrawn: there are no screen-to-ray
// conversions to fix. The port's activation ray is the CAMERA's own
// forward vector (`townTalk.tryActivate(cam.pos, useFwd, ...)` -
// scenes/world.js:6143 and scenes/exterior.js:2090, the only two
// hosts that carry the call, each over a useFwd built from cam.yaw
// and cam.pitch one line above it), not a pixel unprojected through
// the projection matrix, so a reduced viewport would not move a
// single pick. (That cite pointed sixty-odd lines past the call, into
// the AUDIT 18 arrow-streaming block, for a whole wave - a withdrawal
// is only as good as its evidence, so test/hudlarge.test.js RESOLVES
// the line numbers here rather than trusting them.) E5 shipped the
// viewport it withdrew that clause about, and the withdrawal held:
// not one activation site changed.
//
// WHAT E5 DID NOT TAKE, because DFU's own arm for it does not apply:
// SetRetroAspectViewport (:98-146), the pillarboxed 4:3 / 16:10 rect
// that reads the SAME hudHeight term. It is RetroModeAspectCorrection
// - a render-to-texture presenter with a clearer camera behind it -
// and this port has no retro rendering mode at all, so the branch has
// nothing to be attached to. The docked-bar term inside it is the one
// this file now carries; if a retro mode is ever built, it reads
// dockedLargeHudHeight and there is no second copy to find.

import { ImgFile } from '../formats/imgFile.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { BssFile } from '../formats/bssFile.js';
// ui/hud.js is bitmapToColor32's home and it calls drawHudLarge below,
// so these two modules import each other. Both directions are
// FUNCTIONS used at call time and neither reads the other at module
// init, which is what makes the cycle safe - the same shape
// systems/diseases.js and systems/infection.js already carry. The
// hudCrosshair rule ("must not import back into it") is about that
// module's two GEOMETRY CONSTANTS, which travel as arguments here too:
// see drawHudLarge's barFill.
import { bitmapToColor32, largeHudBar } from './hud.js';
import { drawVitalsBars } from './hudVitals.js';   // VB1: the nine-bar law - no cycle, hudVitals reads only the settings store
import { raceArt } from '../systems/races.js';
import { racialOverrideHeadArt } from '../systems/vampirism.js';   // V5: the curse heads, DFU's override-first order
import { getBool, getFloat, getInt } from '../systems/settings.js';
import { getInteractionMode } from '../player/interactionMode.js';
import { cursorActive } from '../player/pointerLock.js';
import { routeAction } from './input.js';

/** mainPanelRect (:34) - the bar's own native size. */
export const LARGE_HUD_W = 320;
export const LARGE_HUD_H = 46;

/** compassFrameCount (:32). All three CMPA files carry 32 frames, so
 *  DFU's hardcoded constant happens to be right for every one of
 *  them - see formats/bssFile.js. */
export const COMPASS_FRAME_COUNT = 32;

/** Every rect in HUDLarge.cs:34-54, verbatim, as [x, y, w, h]. */
export const LARGE_HUD_RECTS = Object.freeze({
  mainColorBackground: [5, 5, 66, 36],
  head: [7, 8, 33, 30],
  compass: [275, 2, 43, 42],
  health: [49, 7, 4, 32],
  fatigue: [57, 7, 4, 32],
  magicka: [65, 7, 4, 32],
  interactionMode: [131, 0, 47, 23],
  options: [71, 0, 12, 46],
  spellbook: [84, 0, 47, 23],
  inventory: [178, 0, 47, 23],
  sheath: [225, 0, 47, 23],
  useMagicItem: [84, 23, 47, 23],
  transportMode: [131, 23, 47, 23],
  map: [178, 23, 47, 23],
  rest: [225, 23, 47, 23],
});

/** The four 47x23 slices of MAIN01I0.IMG (:37-40), in the enum's
 *  order. nativeInteractionModesTextureSize is 47x92 (:56) and the
 *  file really is that size. */
export const MODE_SUBRECT = Object.freeze({
  steal: [0, 0, 47, 23],
  dialogue: [0, 23, 47, 23],
  grab: [0, 46, 47, 23],
  info: [0, 69, 47, 23],
});

/**
 * The PANEL's own cycle (:398-414), which is NOT the keyboard's - see
 * the header. Steal > Talk > Grab > Info > wrap.
 */
export const HUD_MODE_CYCLE = Object.freeze(['steal', 'dialogue', 'grab', 'info']);
export const hudLargeNextMode = (mode) =>
  HUD_MODE_CYCLE[(HUD_MODE_CYCLE.indexOf(mode) + 1) % HUD_MODE_CYCLE.length];
/** The RIGHT click (:417-438), the exact inverse of the left. */
export const hudLargePrevMode = (mode) => {
  const i = HUD_MODE_CYCLE.indexOf(mode);
  return HUD_MODE_CYCLE[(i - 1 + HUD_MODE_CYCLE.length) % HUD_MODE_CYCLE.length];
};

/**
 * The eleven clickable panels and what each POSTS. DFU's handlers
 * post UI messages; the port's equivalent vocabulary is the input
 * registry's action names, so a click and a keypress reach the same
 * door rather than two.
 *
 * `right` is only set where DFU's OnRightMouseClick differs from its
 * OnMouseClick - the MAP panel alone, which opens the AUTOMAP on the
 * left and the TRAVEL MAP on the right (:504-520). Every other panel
 * binds the same handler to both buttons, deliberately.
 *
 * The spellbook posts dfuiOpenSpellBookWindow, which has no
 * InputManager action in DFU at all; the port's door for that window
 * is the CastSpell action (GameManager.cs:550-553), which is what
 * ui/input.js already routes there.
 */
export const LARGE_HUD_PANELS = Object.freeze([
  { key: 'head', rect: LARGE_HUD_RECTS.head, action: 'CharacterSheet' },
  { key: 'compass', rect: LARGE_HUD_RECTS.compass, action: 'Status' },
  { key: 'interactionMode', rect: LARGE_HUD_RECTS.interactionMode, action: 'CycleModeForward', right: 'CycleModeBackward' },
  { key: 'options', rect: LARGE_HUD_RECTS.options, action: 'Escape' },
  { key: 'spellbook', rect: LARGE_HUD_RECTS.spellbook, action: 'CastSpell' },
  { key: 'inventory', rect: LARGE_HUD_RECTS.inventory, action: 'Inventory' },
  { key: 'sheath', rect: LARGE_HUD_RECTS.sheath, action: 'ReadyWeapon' },
  { key: 'useMagicItem', rect: LARGE_HUD_RECTS.useMagicItem, action: 'UseMagicItem' },
  { key: 'transportMode', rect: LARGE_HUD_RECTS.transportMode, action: 'Transport' },
  { key: 'map', rect: LARGE_HUD_RECTS.map, action: 'AutoMap', right: 'TravelMap' },
  { key: 'rest', rect: LARGE_HUD_RECTS.rest, action: 'Rest' },
]);

/**
 * Where the bar lands on the real canvas.
 *
 * DOCKED is AutoSizeModes.ScaleToFit (DaggerfallHUD.cs:222) and its
 * arithmetic collapses: on any landscape screen the first branch
 * scales by height, that overflows the width test immediately (a
 * 320x46 bar scaled to fill 200 units of height is seven screens
 * wide), and the fallback `parentWidth / size.x` wins - so the bar is
 * exactly the screen's width, its height in proportion, flush to the
 * bottom. The CustomScale term cancels out of both, which is why it
 * does not appear here.
 *
 * UNDOCKED is AutoSizeModes.Scale at the native scale times
 * LargeHUDUndockedScale (default 0.75), aligned by
 * LargeHUDUndockedAlignment - and alignment None is forced to Centre
 * (:227-229), so 0 and 2 mean the same thing.
 */
export function largeHudRect(canvas, { docked = true, undockedScale = 0.75, alignment = 0 } = {}) {
  if (docked) {
    const s = canvas.width / LARGE_HUD_W;
    const h = LARGE_HUD_H * s;
    return { x: 0, y: canvas.height - h, w: canvas.width, h, s };
  }
  const s = Math.max(1, Math.floor(Math.min(canvas.width / 320, canvas.height / 200))) * undockedScale;
  const w = LARGE_HUD_W * s, h = LARGE_HUD_H * s;
  const x = alignment === 1 ? 0 : alignment === 3 ? canvas.width - w : (canvas.width - w) / 2;
  return { x, y: canvas.height - h, w, h, s };
}

/**
 * Update's compass read (:302-309). The camera branch divides by 360
 * and the port's heading01 already is that quotient.
 *
 * DFU'S OTHER BRANCH IS BROKEN and is not ported: with no camera it
 * uses `percent = eulerAngle` WITHOUT the /360, against an EulerAngle
 * property clamped to 0..360 - so any heading past 1 degree indexes a
 * 32-entry array out of range. It cannot fire in DFU (CompassCamera
 * defaults to Camera.main) which is presumably why it survives.
 *
 * The truncation is C#'s `(int)` cast, and a heading of exactly 1.0
 * would index 32; the port wraps first, which is what the small HUD's
 * own compassScroll does with the same input.
 */
export const compassFrameIndex = (heading01) =>
  Math.trunc(COMPASS_FRAME_COUNT * (((heading01 % 1) + 1) % 1));

/** Native bar coordinates for a canvas point, or null when the point
 *  is not over the bar at all. */
export function largeHudPoint(bar, px, py) {
  if (!bar || bar.s <= 0) return null;
  const vx = (px - bar.x) / bar.s, vy = (py - bar.y) / bar.s;
  if (vx < 0 || vy < 0 || vx >= LARGE_HUD_W || vy >= LARGE_HUD_H) return null;
  return { vx, vy };
}

const inRect = ([rx, ry, rw, rh], vx, vy) => vx >= rx && vy >= ry && vx < rx + rw && vy < ry + rh;

/** The panel under a native bar point, or null. The eleven rects are
 *  DISJOINT, so DFU's component order cannot matter and neither can
 *  this loop's. */
export const largeHudPanelAt = (vx, vy) =>
  LARGE_HUD_PANELS.find((p) => inRect(p.rect, vx, vy)) ?? null;

/**
 * One click on the bar. `button` is 0 for left and 2 for right, the
 * DOM's numbering; anything else takes the left handler, because DFU
 * binds only those two and a middle click reaches no panel at all.
 *
 * IsLargeHUDInteractable (:392-395) is `cursorActive && !paused`, and
 * the caller owns both - a click that arrives while the cursor is
 * captured is a swing, not a button press.
 *
 * Answers { key, action } or null.
 */
export function largeHudClick(bar, px, py, button = 0) {
  const pt = largeHudPoint(bar, px, py);
  if (!pt) return null;
  const panel = largeHudPanelAt(pt.vx, pt.vy);
  if (!panel) return null;
  const action = (button === 2 && panel.right) ? panel.right : panel.action;
  return { key: panel.key, action };
}

/** The FACE archive record this entity's head comes from. DFU reads
 *  RaceTemplate.PaperDollHeads{Male,Female} at FaceIndex (:322-334);
 *  raceArt is where the port keeps that pair.
 *  V5: RacialOverrideEffect.GetCustomHeadImageData (:314-320) runs
 *  FIRST, exactly as DFU orders it - the werewolf, wereboar and
 *  vampire heads through vampirism.js's one switch. */
export const headArchiveFor = (entity) =>
  raceArt(entity?.race ?? 'Breton', entity?.gender ?? 'male').heads;

/**
 * LoadAssets (:135-153) plus the head. Returns null (loudly, once)
 * when the art is absent, which is the loadHud posture: the bar is
 * data-gated like everything else and a missing file costs the bar,
 * never the frame.
 */
export async function loadHudLarge({ fetchBytes, palette, renderer }, entity = null) {
  const upload = (name, bmp) =>
    ({ tex: renderer.uploadTexture('img', name, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height });
  try {
    const img = async (name) => {
      const f = new ImgFile();
      f.load(await fetchBytes(name), name, palette);
      return f.getDFBitmap();
    };
    const mainBmp = await img('MAIN00I0.IMG');
    const modesBmp = await img('MAIN01I0.IMG');

    const mcol = new CifRciFile();
    mcol.load(await fetchBytes('MCOL00I0.CIF'), 'MCOL00I0.CIF', palette);

    const bss = new BssFile();
    bss.load(await fetchBytes('CMPA00I0.BSS'), 'CMPA00I0.BSS', palette);
    const frames = [];
    for (let i = 0; i < bss.getFrameCount(0); i++) {
      frames.push(upload(`CMPA00I0.BSS#${i}`, bss.getDFBitmap(0, i)));
    }

    return {
      main: upload('MAIN00I0.IMG', mainBmp),
      // The four icons ride ONE texture and are cut by UV, which is
      // ImageReader.GetSubTexture's job in DFU - the subrects are in
      // MODE_SUBRECT and the sheet is 47x92.
      modes: upload('MAIN01I0.IMG', modesBmp),
      modesSize: { w: modesBmp.width, h: modesBmp.height },
      // "Classic uses blue by default - when are other colors used?"
      // is DFU's own comment beside record 0, frame 0 (:139).
      colorBackground: upload('MCOL00I0.CIF#0', mcol.getDFBitmap(0, 0)),
      compass: frames,
      head: await loadHudLargeHead({ fetchBytes, palette, renderer }, entity),
    };
  } catch {
    console.warn('[hud] large HUD art unavailable; the bar stays off');
    return null;
  }
}

/** The head alone, so a host can refresh it when the entity's
 *  identity changes - DFU's Refresh() nulls HeadTexture on load and
 *  on new game and Update re-reads it. */
export async function loadHudLargeHead({ fetchBytes, palette, renderer }, entity) {
  try {
    // V5: the override head first (GetCustomHeadImageData's slot).
    // WERE0*I0 are IMGs (one bitmap); VAMP00I0 is a CIF indexed by
    // gender + birth race. A load failure falls to the racial head -
    // the never-traps rule.
    const ov = racialOverrideHeadArt(entity);
    if (ov) {
      try {
        let bmp;
        if (ov.file.endsWith('.IMG')) {
          const img = new ImgFile();
          img.load(await fetchBytes(ov.file), ov.file, palette);
          bmp = img.getDFBitmap();
        } else {
          const cif = new CifRciFile();
          cif.load(await fetchBytes(ov.file), ov.file, palette);
          bmp = cif.getDFBitmap(ov.record, 0);
        }
        if (bmp?.width) {
          return { tex: renderer.uploadTexture('img', `${ov.file}#${ov.record}`, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height };
        }
      } catch { console.warn('[hudLarge] override head art unavailable - the racial head stands in'); }
    }
    const name = headArchiveFor(entity);
    const cif = new CifRciFile();
    cif.load(await fetchBytes(name), name, palette);
    const fi = Math.max(0, entity?.faceIndex ?? 0);
    const bmp = cif.getDFBitmap(fi, 0);
    if (!bmp?.width) return null;
    return { tex: renderer.uploadTexture('img', `${name}#${fi}`, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height };
  } catch {
    return null;
  }
}

/**
 * Draw the bar. Order is DFU's: the panel's own BackgroundTexture
 * first, then Components in the order Setup() adds them - colour
 * background, compass, head, vitals, mode icon - and the eight
 * unpainted hit rectangles draw nothing at all.
 *
 * `vitalsBars` arrives as data rather than an import for the same
 * reason ui/hudCrosshair.js takes its two constants that way: ui/hud.js
 * owns the rig update (it computes the one vitals snapshot), it calls
 * this, and this must not import back into it. VB1: the rig is this
 * bar's OWN HUDVitals instance (HUDLarge.cs:66) - loss trails, gain
 * bars and the F149 swap ride the large HUD exactly as the small one.
 */
export function drawHudLarge(renderer, canvas, art, entity, heading01, {
  docked = true, undockedScale = 0.75, alignment = 0,
  mode = 'grab', vitalsBars = null,
} = {}) {
  if (!art) return null;
  const bar = largeHudRect(canvas, { docked, undockedScale, alignment });
  const at = ([rx, ry, rw, rh]) =>
    ({ x: bar.x + rx * bar.s, y: bar.y + ry * bar.s, w: rw * bar.s, h: rh * bar.s });

  renderer.drawScreenQuad(art.main.tex, { x: bar.x, y: bar.y, w: bar.w, h: bar.h });
  if (art.colorBackground) renderer.drawScreenQuad(art.colorBackground.tex, at(LARGE_HUD_RECTS.mainColorBackground));

  const frame = art.compass?.[compassFrameIndex(heading01)];
  if (frame) renderer.drawScreenQuad(frame.tex, at(LARGE_HUD_RECTS.compass));

  // BackgroundTextureLayout is StretchToFill for every panel here -
  // that is BaseScreenComponent's default (:77), and the head's
  // explicit set (:169) is redundant. The 48x40 compass frame and the
  // race's own head bitmap both stretch into rects that match neither.
  if (art.head) renderer.drawScreenQuad(art.head.tex, at(LARGE_HUD_RECTS.head));

  if (vitalsBars?.rig && vitalsBars.skin) {
    // The bar ART is the small HUD's own MAIN03/04/05 - the same three
    // files, at different rects - so the skin arrives from ui/hud.js
    // rather than being loaded a second time, swap already applied.
    drawVitalsBars(renderer, vitalsBars.rig, vitalsBars.skin, {
      health: at(LARGE_HUD_RECTS.health),
      fatigue: at(LARGE_HUD_RECTS.fatigue),
      magicka: at(LARGE_HUD_RECTS.magicka),
    }, vitalsBars.indicators);
  }

  const sub = MODE_SUBRECT[mode] ?? MODE_SUBRECT.grab;
  if (art.modes && art.modesSize) {
    const [sx, sy, sw, sh] = sub;
    const { w: tw, h: th } = art.modesSize;
    renderer.drawScreenQuad(art.modes.tex, at(LARGE_HUD_RECTS.interactionMode),
      { u0: sx / tw, v0: sy / th, u1: (sx + sw) / tw, v1: (sy + sh) / th });
  }
  return bar;
}


// ── THE HOST SEAM ───────────────────────────────────────────────────
// One lazy singleton rather than four host-side loaders, for the same
// reason the infection's video host is one: the four hosts already
// call drawHud, and a law wired into three of them is the failure
// this project keeps finding. The art loads on the FIRST FRAME the
// setting is on and never again - a player who leaves the bar off
// never pays for four files they cannot see, which is why this is not
// simply loaded at boot the way DFU's constructor does it.

export const largeHudEnabled = () => getBool('GUI', 'LargeHUD');
export const largeHudDocked = () => getBool('GUI', 'LargeHUDDocked');
export const largeHudUndockedScale = () => getFloat('GUI', 'LargeHUDUndockedScale');
export const largeHudAlignment = () => getInt('GUI', 'LargeHUDUndockedAlignment');
export const largeHudOffsetHorse = () => getBool('GUI', 'LargeHUDOffsetHorse');
export const largeHudUndockedOffsetWeapon = () => getBool('GUI', 'LargeHUDUndockedOffsetWeapon');

/** ROAD-D D10 - horseOffsetHeight (TransportManager.cs:304-309).
 *  `(int)LargeHUD.ScreenHeight` when the HUD exists, LargeHUD is on
 *  and LargeHUDOffsetHorse is on; 0 otherwise. Docking is NOT asked.
 *  The bar is the last DRAWN one, so a null bar is DFU's null HUD. */
export function horseOffsetHeight(bar = largeHudBar()) {
  if (!bar || !largeHudEnabled() || !largeHudOffsetHorse()) return 0;
  return Math.trunc(bar.h);
}

/**
 * ROAD-E E5 - THE DOCKED BAR'S OWN HEIGHT, the one term
 * ViewportChanger, the camera's aspect and HUDCrosshair all read.
 *
 * `LargeHUD.ScreenHeight` when `Settings.LargeHUD &&
 * Settings.LargeHUDDocked` (ViewportChanger.cs:56-62), 0 otherwise -
 * an UNDOCKED bar "is just an overlay of variable size and main
 * viewport does not change", DFU's own words at :57.
 *
 * The bar is the LAST DRAWN one, the same reading horseOffsetHeight
 * takes: a null bar is DFU's `DaggerfallHUD == null` early return
 * (:44-45), which is also this port's art-still-loading and
 * art-failed-to-load frames.
 */
export function dockedLargeHudHeight(bar = largeHudBar()) {
  if (!bar || !largeHudEnabled() || !largeHudDocked()) return 0;
  return bar.h;
}

/** ViewportChanger's `standardViewportRect` (:26), verbatim. */
export const STANDARD_VIEWPORT_RECT = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

/**
 * ROAD-E E5 - the world camera's rect (ViewportChanger.cs:56-67):
 *
 *   float hudHeight = largeHUD.ScreenHeight / Screen.height;
 *   Rect rect = new Rect(0, hudHeight, 1, 1 - hudHeight);
 *
 * digit for digit. Unity's camera rect is normalized with its origin
 * at the BOTTOM-LEFT, which is `gl.viewport`'s own space, so the rect
 * crosses into this port without a flip - the world is rendered into
 * what the bar leaves and nothing is hidden behind it.
 *
 * Anything but a docked bar answers the standard rect, which is the
 * `else` arm at :64-66.
 *
 * NOT CLAMPED, because DFU does not clamp: on a screen so wide that
 * the bar is taller than it (about 7:1, since the docked bar is
 * width * 46/320), `1 - hudHeight` goes negative there as it does
 * here. The renderer floors the pixel height at 0 for GL's sake - a
 * viewport of no height draws nothing, which is what a bar taller
 * than the screen means.
 */
export function largeHudViewportRect(canvasHeight, bar = largeHudBar()) {
  const hud = dockedLargeHudHeight(bar);
  if (!hud || !(canvasHeight > 0)) return STANDARD_VIEWPORT_RECT;
  const hudHeight = hud / canvasHeight;
  return { x: 0, y: hudHeight, w: 1, h: 1 - hudHeight };
}

/**
 * ROAD-E E5 - and the PROJECTION follows the rect. Unity derives a
 * camera's aspect from its viewport (Camera.aspect is
 * pixelWidth/pixelHeight, and camera.rect sets both), so shrinking
 * the rect without shrinking the denominator would STRETCH the world
 * into the smaller strip instead of cropping the lens the way DFU
 * does. Every host builds its own perspective(); this is the one
 * denominator they share.
 */
export function largeHudWorldAspect(width, height, bar = largeHudBar()) {
  return width / Math.max(1, height - dockedLargeHudHeight(bar));
}

/** ROAD-D D10 - weaponOffsetHeight (FPSWeapon.cs:146-155). Same
 *  height, but the gate is `LargeHUDUndockedOffsetWeapon ||
 *  LargeHUDDocked` - a docked bar FORCES the offset, so the viewmodel
 *  is never drawn underneath it. */
export function weaponOffsetHeight(bar = largeHudBar()) {
  if (!bar || !largeHudEnabled()) return 0;
  if (!largeHudUndockedOffsetWeapon() && !largeHudDocked()) return 0;
  return Math.trunc(bar.h);
}

let _art = null;
let _loading = null;
let _headKey = null;

/** Drop the cached art - the tests' door, and the shape DFU's
 *  Refresh() has for the head on load and on new game. */
export function _resetLargeHud() { _art = null; _loading = null; _headKey = null; _overBar = false; }

// ROAD-Ar - ActiveMouseOverLargeHUD. PlayerActivate.cs:230-236 and
// WeaponManager.cs:293-295 both refuse the scene entirely while
// `PlayerMouseLook.cursorActive && LargeHUD.ActiveMouseOverLargeHUD`,
// so the bar's eleven panels are not ALSO a click on the world behind
// them. HUDLarge keeps the flag off its panel's hover events -
// MouseEnter sets `cursorActive && LargeHUD` (:361-365), MouseLeave
// clears it (:368-372). The port has no screen-component hover
// system, so the hosts' existing mousemove feeds the same question,
// and cursorActive/largeHudEnabled are re-read at the ASK so a
// pointer re-lock cannot leave a stale true behind (DFU's MouseLeave
// fires on the same transition; this is the durable half of it).
let _overBar = false;

/** Host mousemove hook - the canvas-pixel twin of trackHudPointer.
 *  `bar` is the last drawn bar, exactly as routeLargeHudClick reads
 *  it; it is a parameter only so the pins can hand one over without
 *  standing up a renderer. */
export function trackLargeHudPointer(canvas, e, bar = largeHudBar()) {
  if (!canvas?.getBoundingClientRect) { _overBar = false; return; }
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) { _overBar = false; return; }
  _overBar = !!largeHudPoint(bar,
    (e.clientX - r.left) * (canvas.width / r.width),
    (e.clientY - r.top) * (canvas.height / r.height));
}

/** LargeHUD.ActiveMouseOverLargeHUD, for the activate gate's guard. */
export const activeMouseOverLargeHUD = () =>
  _overBar && largeHudEnabled() && cursorActive();

/**
 * What a host passes to drawHud as `largeHud`. Null while the setting
 * is off OR while the art is still in flight, and null is exactly
 * what makes drawHud fall back to the small HUD - so a slow first
 * frame shows the vitals rather than nothing.
 *
 * THE HEAD FOLLOWS THE ENTITY. DFU nulls HeadTexture on load and on
 * new game and re-reads it in Update; here the identity is the key,
 * so a character created after boot (chargen writes race, gender and
 * faceIndex onto the entity) gets their own face without a reload.
 */
/** The head's identity key. V5: the override art rides in it, so a
 *  morph (or a cure) swaps the face on the next frame - DFU's
 *  null-and-re-read, as a key change. */
const headKeyFor = (entity) => {
  const ov = racialOverrideHeadArt(entity);
  return `${entity?.race ?? 'Breton'}|${entity?.gender ?? 'male'}|${entity?.faceIndex ?? 0}|${ov ? `${ov.file}#${ov.record}` : ''}`;
};

export function largeHudOptions(deps, entity) {
  if (!largeHudEnabled()) return null;
  if (!_art) {
    if (!_loading && deps?.renderer && deps?.fetchBytes) {
      _loading = loadHudLarge(deps, entity).then((a) => {
        _art = a;
        _headKey = a ? headKeyFor(entity) : null;
        _loading = null;
      });
    }
    return null;
  }
  const key = headKeyFor(entity);
  if (key !== _headKey) {
    _headKey = key;
    loadHudLargeHead(deps, entity).then((h) => { if (h) _art.head = h; });
  }
  return {
    art: _art,
    docked: largeHudDocked(),
    undockedScale: largeHudUndockedScale(),
    alignment: largeHudAlignment(),
    mode: getInteractionMode(),
  };
}

/**
 * ONE DOOR for a click on the bar, called from every host's pointer
 * path. Returns true when the bar took the click.
 *
 * IsLargeHUDInteractable (:392-395) is `cursorActive && !paused`, and
 * both halves matter here. The cursor half is what U45 had to build -
 * see player/pointerLock.js - because with the pointer locked there
 * is no cursor to click a panel with. The paused half is the caller's
 * `windowUp`: a window over the bar owns the click.
 *
 * A HIT IS CONSUMED WHETHER OR NOT ANYTHING ANSWERS IT. An action no
 * host has wired yet must still swallow the click, or pressing REST
 * in a host with no rest door would fall through to the world and
 * swing the player's sword at the floor. `routeAction` reports
 * whether a door answered; this reports whether the BAR did, and they
 * are different questions.
 */
export function routeLargeHudClick(px, py, button, ctx, { windowUp = false } = {}) {
  if (!largeHudEnabled() || windowUp || !cursorActive()) return false;
  const hit = largeHudClick(largeHudBar(), px, py, button);
  if (!hit) return false;
  routeAction(hit.action, ctx);
  return true;
}
