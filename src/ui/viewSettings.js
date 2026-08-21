// SETT/MENU: the VIEW settings, in ONE place because FIVE hosts draw a
// projection (world, exterior, dungeon, interior, worldModes) and each
// carried its own `Math.PI / 3`. That is the same latent duplication
// AUDIT 24 found in the mouse-look constants a few hours earlier, so
// this module exists before the fifth copy does.
//
// DFU's Video/FieldOfView is a real law: SettingsManager.cs:418 reads
// it as GetInt(sectionVideo, "FieldOfView", 60, 120) - clamped 60..120
// - and defaults.ini ships 65. The port's five hosts were all at
// Math.PI/3, which is exactly 60: DFU's MINIMUM, not its default. So
// wiring the setting also corrects the shipped view, which had been
// five degrees narrower than Daggerfall Unity's own.
import { getInt } from '../systems/settings.js';

/** DFU's clamp, verbatim (SettingsManager.cs:418). */
export const FOV_MIN = 60;
export const FOV_MAX = 120;

/** The vertical field of view in RADIANS, ready for perspective().
 *  Read at the point of use - every frame - so a change in the
 *  settings screen lands on the next frame rather than the next
 *  reload, the same law the look settings follow. */
export const fieldOfView = () => (getInt('Video', 'FieldOfView', FOV_MIN, FOV_MAX) * Math.PI) / 180;
