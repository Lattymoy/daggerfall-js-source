// @ts-check
// DS2 (2026-09-08): THE BRIDGE FROM DYNAMIC SKIES' STATE TO THE PORT'S READERS - the world's moonlight (DS1) and the
// volumetric clouds (DS2) read the port's own state shapes off our sky's sun, moons and horizon (OWN-WORK4: the sky
// is ours now - systems/dynamicSkies/dynamicSkies.js). One home, importable by the sky lab without the whole scene
// controller behind it.
import { skyState, moonlightTerm, WEATHER_SKY } from './enhancedSky.js';   // DSH1: the row's greyness, for the colour the deck fades into
import { isNight, daylightScale } from '../world/worldClock.js';
import { MOON_LOOK, moonNightWeight, hexLinear, toSrgb3 } from '../systems/dynamicSkies/dynamicSkies.js';

/** DS2: THE CLOUDS' STATE UNDER DYNAMIC SKIES. VolumetricClouds reads six fields of the dome's state (cloudLight:
 *  sunDir, sun, masser, secunda; the march: cloudLit, cloudShade, horizon). The port's own skyState answers the
 *  colours - the eased row's lit and shade, the palette's sun at the hour - and our sky answers the geometry and the
 *  horizon: its sun direction (DFU's SunlightManager turn), its moons, and its fog colour as the horizon the clouds
 *  fade into. Pure; the lab calls it too. */
export function cloudsStateUnderMod(st, moons, { minuteOfDay, weather, classicMinutes = 0, skyMinutes = classicMinutes, seconds = 0, drift = null, row = null, skyRow = null }) {   // TIME1: the moons' date beside the clouds' clock
  const base = skyState({ minuteOfDay, weather, classicMinutes, skyMinutes, seconds, drift, row });
  return {
    ...base,
    sunDir: st.sunDir,
    masser: moons?.masser ?? base.masser,
    secunda: moons?.secunda ?? base.secunda,
    // SKY-HZN: greyed by the row the SKY wears (`skyRow`, the player's eased one) - on the map's lane `row` is the clear
    // air the clouds stand on, and the colour every far bank fades into is the air's the player sees, never the base's
    horizon: modHorizon(st.clearColor ?? base.horizon, base.cloudShade, skyRow ?? row ?? WEATHER_SKY[weather] ?? WEATHER_SKY.sunny),
  };
}

/** DSH1 (2026-09-20, Mac: "The far away horizon is still viewable even
 *  though it's cloudy"): THE COLOUR THE DECK FADES INTO IS THE WEATHER'S
 *  TOO.
 *
 *  The march's aerial perspective closes every far bank on this one
 *  colour, and handing it the mod's RenderSettings.fogColor unchanged
 *  made a full overcast lid end in a hard sunset line: the mod's fog
 *  colour at dusk is a saturated red, its own dome shows it only in the
 *  half-degree strip at the horizon, and the deck was painting it across
 *  the whole far ring. The port's own dome has never had this - its
 *  horizon is greyed by the weather's `grey` before anything reads it
 *  (enhancedSky.skyState) - so the mod's colour gets the same treatment
 *  here, toward the deck's OWN shade rather than a fixed grey, because
 *  the far end of an overcast lid is the near end of it seen through
 *  air. Sunny is grey 0 and comes through the mod's colour untouched. */
export function modHorizon(modColor, shade, w) {
  const g = Math.max(0, Math.min(1, w?.grey ?? 0));
  if (g === 0 || !shade) return modColor;
  return [
    modColor[0] + (shade[0] - modColor[0]) * g,
    modColor[1] + (shade[1] - modColor[1]) * g,
    modColor[2] + (shade[2] - modColor[2]) * g,
  ];
}

/** DS1: the moons as moonlightTerm reads them, from our sky's own state: each moon where the sky draws it, its phase
 *  the clock's fraction, its colour the sky's (MOON_LOOK), up and under a night (moonNightWeight on the sun's height)
 *  to be seen. Night is the port's law, as for the enhanced dome. */
export function dynamicMoonState(dyn, minuteOfDay, cover = 0) {
  const night = moonNightWeight(dyn._sunDir?.[1] ?? 0);
  // AUDIT 61: the dome dims its moonlight by the clouds (`1 - cover * 0.35`, enhancedSky.js); the port's eased cover
  // row - the same number the ground's readers take - stands in for the sky's own layers.
  const cloud = 1 - cover * 0.35;
  const moon = (which) => {
    const dir = dyn.moonDirection(which) ?? [0, -1, 0];
    return { dir, vis: dir[1] > 0 ? night * cloud : 0, phase: dyn.phases?.[which]?.phase ?? -1, color: toSrgb3(hexLinear(MOON_LOOK[which].color)) };
  };
  return {
    night: isNight(minuteOfDay),
    daylight: daylightScale(minuteOfDay),   // CLK3 review: the rig's curve (the sky's own while it is up), so the moonlight ramps here too
    masser: moon('masser'),
    secunda: moon('secunda'),
  };
}

/** The world's moon term off our sky's moons - DS1's moonlight(). */
export const dynamicMoonlight = (moons) => (moons ? moonlightTerm(moons) : null);
