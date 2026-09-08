// DS2 (2026-09-08): THE BRIDGE FROM THE MOD'S STATE TO THE PORT'S
// READERS - the world's moonlight (DS1) and the volumetric clouds (DS2)
// both read the port's own state shapes off the mod's material, sun and
// orbits. One home, importable by the sky lab without dragging the
// whole scene controller in behind it.
import { skyState, moonlightTerm } from './enhancedSky.js';
import { isNight, daylightScale } from '../world/worldClock.js';

/** DS2: THE CLOUDS' STATE UNDER THE MOD. VolumetricClouds reads six
 *  fields of the dome's state (cloudLight: sunDir, sun, masser,
 *  secunda; the march: cloudLit, cloudShade, horizon). The port's own
 *  skyState answers the colours - the eased row's lit and shade, the
 *  palette's sun at the hour - and the mod answers the geometry and the
 *  horizon: ITS sun direction (SunlightManager's, [cos, sin, 0] on the
 *  dawn-to-dusk range), ITS moons where its orbits put them (the
 *  dynamicMoonState the world's moonlight already takes), and ITS fog
 *  colour as the horizon the clouds fade into (RenderSettings.fogColor,
 *  what the mod's own horizon blends to). Pure; the lab calls it too. */
export function cloudsStateUnderMod(st, moons, { minuteOfDay, weather, classicMinutes = 0, seconds = 0, drift = null, row = null }) {
  const base = skyState({ minuteOfDay, weather, classicMinutes, seconds, drift, row });
  return {
    ...base,
    sunDir: st.sunDir,
    masser: moons?.masser ?? base.masser,
    secunda: moons?.secunda ?? base.secunda,
    horizon: st.clearColor ?? base.horizon,
  };
}

/** DS1: the moons as moonlightTerm reads them, from the mod's own
 *  state: each moon's place is the shader's orbit (the CPU twin in
 *  systems/dynamicSkies.js), its phase is DFU's ladder, its visibility
 *  is "up, and not in daylight" on the shader's own `day` term
 *  (Remap(sunY, NightEnd..NightStart)), its colour the preset's. Night
 *  is the port's law, as for the enhanced dome. */
export function dynamicMoonState(dyn, minuteOfDay, cover = 0) {
  const mat = dyn.mat;
  const sunY = dyn._sunDir?.[1] ?? 0;
  const span = mat._NightStartHeight - mat._NightEndHeight;
  const day = span === 0 ? (sunY >= mat._NightStartHeight ? 1 : 0) : Math.max(0, Math.min(1, (sunY - mat._NightEndHeight) / span));
  // AUDIT 61: the dome dims its moonlight by the clouds (`1 - cover *
  // 0.35`, enhancedSky.js); the mod's clouds are textures the CPU
  // cannot sample, so the port's eased cover row - the same number the
  // ground's readers take - stands in for them.
  const cloud = 1 - cover * 0.35;
  const moon = (which, phase, color) => {
    const dir = dyn.moonDirection(which);
    return { dir, vis: dir[1] > 0 ? (1 - day) * cloud : 0, phase, color: [color[0], color[1], color[2]] };
  };
  return {
    night: isNight(minuteOfDay),
    daylight: daylightScale(minuteOfDay),   // CLK3 review: the rig's curve (the mod's own while it is the sky), so the moonlight ramps here too
    masser: moon('Moon', dyn.phases?.masser?.phase ?? -1, mat._MoonColor),
    secunda: moon('Secunda', dyn.phases?.secunda?.phase ?? -1, mat._SecundaColor),
  };
}


/** The world's moon term off the mod's moons - DS1's moonlight(). */
export const dynamicMoonlight = (moons) => (moons ? moonlightTerm(moons) : null);
