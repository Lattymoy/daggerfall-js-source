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
import { getFloat, getBool } from '../systems/settings.js';

/** Radians per pixel at MouseLookSensitivity 1.0 - the port's own
 *  feel constant, unchanged from before the setting existed. */
export const LOOK_BASE = 0.0025;

/** The live scale. Read at the point of use (every pointer event), so
 *  a launcher change lands immediately rather than on reload.
 *
 *  ROAD-G G6 WIDENED THE CLAMP TO DFU'S OWN. It read 0.1..4.0 - the
 *  port's narrowing, which ui/settingsLaw.js then had to mirror under
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
