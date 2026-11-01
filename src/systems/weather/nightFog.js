// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NIGHT-FOG (2026-10-26; bible/07-Rendering/Weather-Arc.md NIGHT-FOG; the owner: "In foggy biomes, when its dark, you can
// barely see anything") - THE AIR IS LIT BY THE LIGHT THE LAND IS LIT BY. A leaf the sky's controller hands every frame's
// fog colour through (scenes/shared.js fogColorFor), so the land, the far ring, the water, the sky's haze and the jungle's
// haze (world/jungle/jungleHaze.js hazeColorOf takes its colour from this one, and the closed canopy dims it) close into
// one lit air.
//
// WHY. A fog's colour is the light its droplets send toward the eye: the light that reaches them, which is the light the
// land stands in. Under Dynamic Skies (DS1 - the enhanced lane's sky by default) the colour was the mod's own
// RenderSettings.fogColor: its preset's FogDayColor walked to black on the sun's height (its setFogColor, retired with
// it at OWN-WORK4 - wholly black from the sun on the horizon, a third of the day's colour an hour before), and
// under the port's own dome it is the sky's horizon (0.04 to 0.09 on a clear night). So from dusk to dawn every fog closed
// to black, or nearly, while the land about it was lit by the night's ambient and the moons: the mod's heavy fog (exp
// 0.005 at its default density) closed into black across the first few hundred metres, the jungle's haze (0.007 a metre
// at night) by 100 m - a fog no light reached, round land the moon lit.
//
// DFU, the reference: DaggerfallSky.SetSkyFogColor (DaggerfallSky.cs:310-330) - Color.gray for anything denser than the
// rain, at every hour (so DFU's heavy fog and snow glow a 50% grey at midnight), and the camera's clear colour, the sky's
// horizon - the night sky's at night - for the rest. DEPARTURE (Port-Ledger A, NIGHT-FOG): on the enhanced lane a fog is
// never darker than AIR - NIGHT_AIR.albedo of the open air's light (`airLight`: the exterior ambient, world/worldClock.js
// exteriorAmbient - PlayerAmbientLight's ExteriorNightAmbientLight 0.25 at night, times the player's Night Brightness, to
// its noon over the daylight curve and the weather's scale - and the moons, render/enhancedSky.js moonlightTerm: Secunda's
// lift and NIGHT_AIR.moon of Masser's key), leaned cool (NIGHT_AIR.tint). The rule is on LUMINANCE (`litFog`): what a fog
// lacks of the air's is made up in the air's own colour, so a fog's hue stays where it has one (the dome's night-blue
// horizon, a dusk's) and a black fog becomes the air. A fog already as bright as the air is untouched - every sky's
// from 10:00 to 14:00, in every weather (the mod's thunder at noon, 0.149 over air of 0.145, the nearest), DFU's grey at
// midnight - so what moves is the night, the dusk and dawn the mod darkened ahead of its own light, and a storm's
// shoulders (the mod's thunder walked darker on the sun's height before 10:00 and after 14:00). The classic panorama keeps SetSkyFogColor
// verbatim: the 1:1 lane keeps DFU's night, as it keeps its hard-off moonlight. `?nightfog=off` is the door back (nightFogOn).
// ═══════════════════════════════════════════════════════════════════
import { exteriorAmbient } from '../../world/worldClock.js';
import { pageParam } from '../pageQuery.js'; // PERF-URL: the door, read off the page's query once a search

/** `?nightfog=off` - the fog as its sky has it (DS1's black night, the dome's night sky, DFU's grey). Read at every ask, off
 *  the page's query once a search (systems/pageQuery.js - a replaceState is answered at once: a probe photographs one
 *  frame both ways). */
export function nightFogOn(search = globalThis.location?.search ?? '') {
  return pageParam('nightfog', search) !== 'off';
}

/** The air's numbers, in one place. */
export const NIGHT_AIR = Object.freeze({
  /** the share of the light reaching the fog that it sends to the eye, against a surface's (display): the mod's thunder
   *  fog at noon (0.149 under an ambient of 0.29) is air of 0.51, so 0.5 leaves every sky's day where it was */
  albedo: 0.5,
  /** the share of Masser's key the air takes - a droplet is lit from every side, a face from one (moonlightTerm's scale) */
  moon: 0.5,
  /** the air's own lean: cool, as moonlit air is (its luminance 1 - `airColor` normalises it) */
  tint: Object.freeze([0.86, 0.95, 1.14]),
});

/** Rec. 601 luminance - the weight the jungle's haze leans its grey by (world/jungle/jungleHaze.js hazeColorOf). */
const LUM = Object.freeze([0.299, 0.587, 0.114]);
const lum = (c) => LUM[0] * c[0] + LUM[1] * c[1] + LUM[2] * c[2];
const TINT_LUM = lum(NIGHT_AIR.tint);

/**
 * THE OPEN AIR'S LIGHT this frame, display [r, g, b]: the exterior ambient (exteriorAmbient - the hour, the player's Night
 * Brightness, the weather's sunlight scale) with the moons' (moonlightTerm's shape: `ambient` Secunda's lift, `scale` and
 * `color` Masser's key, of which the air takes NIGHT_AIR.moon) - or null for no moon.
 * @param {{ minute: number, nightScale?: number, sun?: number, moon?: { scale: number, color: ArrayLike<number>, ambient: ArrayLike<number> }|null }} at
 * @param {Float32Array} [out]
 */
export function airLight({ minute, nightScale = 1, sun = 1, moon = null }, out = new Float32Array(3)) {
  const a = exteriorAmbient(minute, nightScale, sun);
  for (let c = 0; c < 3; c++)
    out[c] = a[c] + (moon ? moon.ambient[c] + NIGHT_AIR.moon * moon.scale * moon.color[c] : 0);
  return out;
}

/** THE AIR'S COLOUR under a light (airLight's): NIGHT_AIR.albedo of it, leaned by the tint at its own luminance. */
export function airColor(light, out = new Float32Array(3)) {
  for (let c = 0; c < 3; c++) out[c] = Math.min(1, NIGHT_AIR.albedo * light[c] * (NIGHT_AIR.tint[c] / TINT_LUM));
  return out;
}

/**
 * THE FOG, LIT: `fog` with what its luminance lacks of the air's (`air`, airColor's) made up in the air's own colour,
 * written to `out` - or `fog` ITSELF, the same array, wherever it is already as bright (so a day's fog reaches the
 * renderer exactly as it did, down to its identity: scaleFogForDistance's rule). Display [r, g, b], [0, 1] out.
 * @param {ArrayLike<number>} fog @param {ArrayLike<number>} air @param {Float32Array} [out]
 */
export function litFog(fog, air, out = new Float32Array(3)) {
  const la = lum(air),
    lack = la - lum(fog);
  if (!(lack > 0)) return fog;
  const k = lack / la;
  for (let c = 0; c < 3; c++) out[c] = Math.min(1, Math.max(0, fog[c] + air[c] * k));
  return out;
}
