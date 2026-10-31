// IIL1 - IMPROVED INTERIOR LIGHTING (ShortBeard, 1.0.5), PORTED FROM ITS OWN SCRIPTS.
//
// The mod is seven C# files and a settings file - no picture at all - so attaching its `.dfmod` gave the port
// nothing to draw. Its law lives here, script by script, and the hosts ask it while they compose the frame's lights:
//
//   ImproveInteriorLighting.cs  every light in a building but the player's torch: InteriorLightsColor x
//                               InteriorLightsIntensity, range 10, and a LightFlicker on it;
//   ImproveDungeonLighting.cs   the dungeon's own lights (DungeonLightHandler - the port's RDB light resources) are
//                               destroyed and a point light is hung on every archive-210 billboard instead:
//                               DungeonLightsColor x DungeonLightsIntensity, range 10, flickering;
//   ImproveFireplaces.cs        a light on each fireplace model (41116, 41117): colour x FireplaceIntensity, range
//                               15, its own faster flicker;
//   ImprovePlayerTorch.cs       the torch takes PlayerTorchColor;
//   LightFlicker.cs             every DoFlicker step: intensity = Lerp(intensity, Random(base - MaxReduction,
//                               base + MaxIncrease), Strength * deltaTime), then wait RateDamping seconds.
//
// WHEN IT RUNS (the player's rule): only with the mod ATTACHED, and only with Enhanced Lighting OFF - it takes the
// classic lane's place, and the Enhanced Lighting lane, when on, is left exactly as it was. What the classic lane
// cannot draw is not drawn: it has no shadow maps, so the mod's soft shadows and its NPC/enemy billboard shadows
// (BillboardShadows.cs) have nothing to switch; it has point lights only, so a fireplace's 140-degree spot is a point
// light at the hearth; and it lights the nearest sixteen, as it always has.
//
// Settings are the mod's own shipped defaults (modsettings.json), verbatim.

import { attachedDfmods, dfmodGeneration } from './dfmodTextures.js';
import { getPref } from './uiPrefs.js';
import { syncClassicShadowLane } from '../render/classicShadowLane.js'; // IIL2: the mod's shadows, in Daggerfall's look   // IIL1-T: the Features rows
import { pageParam } from './pageQuery.js'; // PERF-URL: the page's query, parsed once a search

export const IIL_MOD = Object.freeze({
  guid: '55d7c31a-c571-45ea-bb72-fb5aa359e106',
  title: 'Improved Interior Lighting',
  version: '1.0.5',
  author: 'ShortBeard',
});

const WARM = Object.freeze([255, 147, 41]);
export const IIL_SETTINGS = Object.freeze({
  Interiors: Object.freeze({
    Enabled: true,
    NpcShadows: true,
    InteriorLightsColor: WARM,
    InteriorLightsIntensity: 0.5,
    InteriorFlickeringLights: true,
    LightFlickerStrength: 0.5,
  }),
  Dungeons: Object.freeze({
    Enabled: true,
    EnemyShadows: true,
    EnemyShadowsNoShadowEnemies: false,
    DungeonLightsColor: WARM,
    DungeonLightsIntensity: 0.5,
    FlickeringLights: true,
    LightFlickerStrength: 1.5,
  }),
  FirePlaces: Object.freeze({
    EnabledInInteriors: true,
    FireplaceLightsColor: WARM,
    FireplaceIntensity: 1.0,
    FireplaceFlickeringLights: true,
    FireplaceFlickerStrength: 1.0,
  }),
  Torch: Object.freeze({ PlayerTorchChanged: true, PlayerTorchColor: WARM }),
});

/** The two fireplace models ImproveFireplaces.cs looks for by mesh id. */
export const IIL_FIREPLACE_MODELS = Object.freeze(new Set([41116, 41117]));
/** ImproveDungeonLighting.LIGHT_OBJECT_ARCHIVE. */
export const IIL_LIGHT_ARCHIVE = 210;
const LIGHT_RANGE = 10; // both scripts: range = 10
const FIREPLACE_RANGE = 15; // ImproveFireplaces: range = 15
// AddLightFlicker's arguments at each call site: [MaxReduction, MaxIncrease, RateDamping]
const FLICKER_ROOM = Object.freeze([1.5, 2.5, 0]);
const FLICKER_FIRE = Object.freeze([3, 4.5, 0.02]);

const rgb = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];

// ---- is it on --------------------------------------------------------------------------------------------------------

/** Does an attached-mod entry name this mod - by GUID, or by title for a rebuilt one. */
export const isIilMod = (m) =>
  !!m && (m.guid === IIL_MOD.guid || /^improved interior lighting$/i.test(String(m.title ?? '').trim()));
// The player attaches the `.dfmod` like any other (Settings > Mods > Add texture mods); the attached list answers,
// re-read only when that list changes (dfmodGeneration)
let _seenGen = -1,
  _seen = false;
const fromAttached = () => {
  const g = dfmodGeneration();
  if (g !== _seenGen) {
    _seenGen = g;
    _seen = attachedDfmods().some(isIilMod);
  }
  return _seen;
};
let _attached = fromAttached;
/** Test seam: who answers "is the mod attached". */
export function setIilAttachedSource(fn) {
  _attached = typeof fn === 'function' ? fn : fromAttached;
}
/**
 * IIL1-T - THE TEST DOOR FOR WHAT THE CLASSIC LANE CANNOT CARRY. `?iil=shadows` runs the mod's lights ON the
 * Enhanced Lighting lane: its shadow maps then give the lights the mod's soft shadows, and billboards - NPCs and
 * enemies - cast them (BillboardShadows.cs), which the classic lane has no way to draw. Enhanced Lighting has to be
 * on for it (the lane is what draws the shadows); off, the mod runs on the classic lane as ever. A test switch, by
 * address only, so nobody meets it by accident.
 */
export const iilOnLane = (search = globalThis.location?.search ?? '') => pageParam('iil', search) === 'shadows'; // PERF-URL
// IIL1-T: the Features row - Off / On / With shadows (`moddedLighting`, default On; an older boolean reads as On/Off).
// With shadows runs the mod's lights on the Enhanced Lighting lane; `?iil=shadows` is the same by address.
let _pref = (key) => getPref(key);
/** Test seam: who answers a pref. */
export function setIilPrefSource(fn) {
  _pref = typeof fn === 'function' ? fn : (key) => getPref(key);
}
/** The row's tier: 'off' | 'on' | 'shadows'. */
export const iilTier = () => {
  const v = _pref('moddedLighting');
  if (v === false || v === 'off') return 'off';
  return v === 'shadows' ? 'shadows' : 'on';
};
/** The mod's law applies: attached and not switched off, where Enhanced Lighting is not drawing (its lane is its
 *  own; `?iil=shadows` is the old test door onto it). The mod's OWN shadows (IIL2) do not need that lane - they are
 *  the classic-look lane below, which the renderer hides from the hosts, so `lightingLane` is null under it. */
export const iilActive = (lightingLane, search) => {
  if (iilTier() === 'off' || !_attached()) return false;
  return !lightingLane || iilOnLane(search);
};

/**
 * IIL2 - THE MOD'S SHADOWS. With the row at "With shadows" and the mod attached, a building's or a dungeon's frame is
 * drawn on the classic-look shadow lane (render/classicShadowLane.js): Daggerfall's own look, and every light's
 * shadow map under it, billboards casting - what `light.shadows = Soft` asked of Unity. Outdoors (`inside` false) or
 * with the row elsewhere, the lane comes off. Enhanced Lighting's lane, when it is on, is never touched.
 * Hosts call it every frame before they compose their lights.
 */
export function iilSyncLane(renderer, inside) {
  const want = !!inside && iilTier() === 'shadows' && !!_attached();
  return syncClassicShadowLane(renderer, want);
}

// ---- LightFlicker ----------------------------------------------------------------------------------------------------

/**
 * One light's flicker, as LightFlicker.DoFlicker runs it: every RateDamping seconds (every frame at 0), the intensity
 * moves toward a random target in [base - MaxReduction, base + MaxIncrease] by Strength * deltaTime (Mathf.Lerp clamps
 * its t to [0, 1]). A Unity Light's intensity cannot go below zero.
 */
export function stepFlicker(st, base, [maxReduction, maxIncrease, rate], strength, dt, random = Math.random) {
  st.wait -= dt;
  if (st.wait > 0) return st.intensity;
  st.wait = rate;
  const target = base - maxReduction + random() * (maxReduction + maxIncrease);
  const t = Math.min(1, Math.max(0, strength * dt));
  st.intensity = Math.max(0, st.intensity + (target - st.intensity) * t);
  return st.intensity;
}

// Per scene: the light list the hosts hand in is built once per visit, so its identity keys the flicker state.
const _states = new WeakMap(); // light list -> { at, lights, ranges, level: Float32Array, st: [] }
const now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;

/**
 * Build (once per list) and advance (once per frame) a set of mod lights: `positions` [{x,y,z}], each `kind` 'room'
 * or 'fire'. Answers what nearestLights reads - the lights, their ranges and a colorOf for the paired colour channel.
 */
function advance(key, build, section) {
  let s = _states.get(key);
  if (!s) {
    const lights = build();
    s = {
      at: now(),
      lights,
      ranges: lights.map((l) => l.range),
      st: lights.map((l) => ({ intensity: l.base, wait: 0 })),
      index: new Map(lights.map((l, i) => [l, i])),
    };
    _states.set(key, s);
  }
  const t = now();
  const dt = Math.min(0.25, Math.max(0, t - s.at)); // a paused tab does not arrive with seconds of lerp
  s.at = t;
  for (let i = 0; i < s.lights.length; i++) {
    const l = s.lights[i];
    if (l.flicker) stepFlicker(s.st[i], l.base, l.flicker, l.strength, dt);
    else s.st[i].intensity = l.base;
  }
  const colorOf = (l) => {
    const i = s.index.get(l);
    const k = i == null ? 0 : s.st[i].intensity;
    return [l.rgb[0] * k, l.rgb[1] * k, l.rgb[2] * k];
  };
  return { lights: s.lights, ranges: s.ranges, colorOf, section };
}

/**
 * ImproveInteriorLighting + ImproveFireplaces: a building's lights. `roomLights` the interior's own ([{x,y,z}]),
 * `fireplaces` its fireplace models' positions ([{x,y,z}]). Null when the Interiors section is off.
 */
export function iilInteriorLights(roomLights, fireplaces = [], settings = IIL_SETTINGS) {
  const S = settings.Interiors,
    F = settings.FirePlaces;
  if (!S.Enabled) return null;
  return advance(
    roomLights,
    () => [
      ...roomLights.map((l) => ({
        x: l.x,
        y: l.y,
        z: l.z,
        range: LIGHT_RANGE,
        rgb: rgb(S.InteriorLightsColor),
        base: S.InteriorLightsIntensity,
        flicker: S.InteriorFlickeringLights ? FLICKER_ROOM : null,
        strength: S.LightFlickerStrength,
      })),
      ...(F.EnabledInInteriors ? fireplaces : []).map((f) => ({
        x: f.x,
        y: f.y,
        z: f.z,
        range: FIREPLACE_RANGE,
        rgb: rgb(F.FireplaceLightsColor),
        base: F.FireplaceIntensity,
        flicker: F.FireplaceFlickeringLights ? FLICKER_FIRE : null,
        strength: F.FireplaceFlickerStrength,
      })),
    ],
    'Interiors',
  );
}

/**
 * ImproveDungeonLighting: the dungeon's lights - one on every archive-210 billboard (`lightFlats` [{x,y,z}], the
 * billboard's centre, where the script parents its new light), the RDB lights gone. Null when the section is off.
 */
export function iilDungeonLights(lightFlats, settings = IIL_SETTINGS) {
  const S = settings.Dungeons;
  if (!S.Enabled) return null;
  return advance(
    lightFlats,
    () =>
      lightFlats.map((f) => ({
        x: f.x,
        y: f.y,
        z: f.z,
        range: LIGHT_RANGE,
        rgb: rgb(S.DungeonLightsColor),
        base: S.DungeonLightsIntensity,
        flicker: S.FlickeringLights ? FLICKER_ROOM : null,
        strength: S.LightFlickerStrength,
      })),
    'Dungeons',
  );
}

/** ImprovePlayerTorch: the torch in PlayerTorchColor (its range and place unchanged). A null torch stays null. */
export function iilTorch(light, settings = IIL_SETTINGS) {
  if (!light || !settings.Torch.PlayerTorchChanged) return light;
  return { ...light, color: rgb(settings.Torch.PlayerTorchColor) };
}

/** Test seam. */
export function _resetIilForTests() {
  _attached = fromAttached;
  _seenGen = -1;
  _pref = (key) => getPref(key);
}
