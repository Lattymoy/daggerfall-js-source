// SETT-slice: the mouse-look settings, in ONE place because three
// hosts read them (world, exterior, dungeon) and a per-host copy is
// exactly the duplication the audits keep finding.
//
// DFU's PlayerMouseLook multiplies the raw pointer delta by
// MouseLookSensitivity and flips the pitch term when
// InvertMouseVertical is set. The port's hosts carried a bare 0.0025
// radians-per-pixel constant instead; that constant is now the
// sensitivity BASE, so a setting of 1.0 reproduces it exactly and the
// shipped default of 2.0 is twice as fast - the same relationship
// DFU's own default has to its base.
import { getFloat, getBool } from '../systems/settings/settings.js';
import { LOOK_SENSITIVITY_FIELD } from '../systems/gamepad.js';   // WIDGET-LOOK: PlayerMouseLook's serialized 2, one export

/** Radians per pixel at MouseLookSensitivity 1.0 - the port's own
 *  feel constant, unchanged from before the setting existed. */
export const LOOK_BASE = 0.0025;

/** The live scale. Read at the point of use (every pointer event), so
 *  a launcher change lands immediately rather than on reload.
 *
 *  ROAD-G G6 WIDENED THE CLAMP TO DFU'S OWN. It read 0.1..4.0 - the
 *  port's narrowing, which ui/settings/settingsLaw.js then had to mirror under
 *  its range-equals-clamp law. DaggerfallUnityMouseControlsWindow.cs
 *  :124 builds the sensitivity slider over 0.1..16.0 and
 *  SettingsManager.cs:524 clamps the key at exactly that, so the
 *  narrowing was a departure with nothing holding it up; the slider is
 *  verbatim now and the two consumers agree with it. */
export const lookScale = () => LOOK_BASE * getFloat('Controls', 'MouseLookSensitivity', 0.1, 16.0);

/** InvertMouseVertical as a MULTIPLIER on the pitch term: -1 inverts,
 *  +1 does not. A multiplier rather than a branch keeps both call
 *  sites in every host a single expression. */
export const lookInvert = () => (getBool('Controls', 'InvertMouseVertical') ? -1 : 1);

/** FIX-F: THE KEYBOARD LOOK - TurnLeft/TurnRight and LookUp/LookDown.
 *  InputManager.FindKeyboardActions (:1854-1865) sets keyboardLookX/Y
 *  to +-1 and UpdateLook (:1510-1511) hands that to PlayerMouseLook in
 *  place of the mouse delta, where ApplyLook (:126-132) multiplies it
 *  by `sensitivity.x * sensitivityScale` - so a held turn key is ONE
 *  look unit a frame, a unit being a degree per sensitivity point:
 *  at DFU's default sensitivity 2 that is 2 degrees a frame, 120 a
 *  second at 60 fps. The port pays it per SECOND (a departure of
 *  kind, recorded: DFU's keyboard turn is frame-rate bound, its
 *  controller branch two lines above is not, and a port on a browser's
 *  uncapped rAF cannot be the first). Radians a second at the live
 *  sensitivity. */
export const KEYBOARD_LOOK_UNITS_PER_SECOND = 60;
export const keyboardLookRate = () => (Math.PI / 180) * KEYBOARD_LOOK_UNITS_PER_SECOND * getFloat('Controls', 'MouseLookSensitivity', 0.1, 16.0);

/** WIDGET-LOOK (FIELD BUGS 2026-10-03, SlipperyPeasant: "The inertia module for the weapon and shield widget mods dont
 *  work, the sprites dont sway back and forth when you look around"): THE FRAME'S LOOK IN DFU'S OWN AXES. Weapon
 *  Widget's, Shield Widget's and Handheld Torches' Inertia read InputManager.LookX/LookY straight - the axis
 *  PlayerMouseLook.ApplyLook (:126-132) turns into DEGREES at `sensitivity` (the serialized 2, LOOK_SENSITIVITY_FIELD)
 *  times `sensitivityScale` (MouseLookSensitivity, StartGameBehaviour.cs:217), InvertMouseVertical applied there, after
 *  the axis. The port's frame latch (player/lookFilter.js takeFrameLook) holds the camera's RADIANS, pitch already
 *  inverted - handed to the mods as it was, a turn swayed them a fourteenth of their own (at the default 2.0: 180/pi
 *  over 4). So: degrees, over the field times the setting, the invert undone. The Thunderlock's own feel keeps the
 *  radians its lab is tuned on (gun-proto.html feeds them; FIELD-GUN8's "1:1" is with the lab). */
export function dfuLookAxes(look) {
  const k = (180 / Math.PI) / (LOOK_SENSITIVITY_FIELD * getFloat('Controls', 'MouseLookSensitivity', 0.1, 16.0));
  return [(look?.[0] ?? 0) * k, (look?.[1] ?? 0) * k * lookInvert()];
}
