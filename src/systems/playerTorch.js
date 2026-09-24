// T1: THE PLAYER'S TORCH - EnablePlayerTorch.Update (MIT, Daggerfall
// Workshop), verbatim. U25 shipped the LightSource slot, its
// light/douse/refuel/empty messages and its save field; this is the
// component that made any of it visible, and it had no port at all.
// Until now a lit torch was a HUD line and a saved index: it burned no
// fuel, it never died, and it lit nothing.
//
// THE LAW, line by line (:57-108):
//   - the whole body is gated on PlayerTorchFromItems. With it OFF DFU
//     takes an ELSE arm instead: an ambient player light on outdoors
//     when the city lights are on, or anywhere inside a dungeon. That
//     arm is FLAGGED here rather than guessed - see the note below.
//   - the light's RANGE is `lightSource.ItemTemplate.capacityOrTarget`,
//     re-read every frame. That is real shipping data: Torch 14,
//     Lantern 16, Holy Candle 10, Candle 8.
//   - a 20-REAL-SECOND timer (`tickTimeInterval = 20f`, accumulating
//     Time.deltaTime) decrements `currentCondition` by ONE. Not a game
//     minute - a torch burns on wall-clock time, so a paused game
//     burns nothing and a fast time scale does not eat it faster.
//   - at condition ZERO: "Your %it flickers and dies.", the source
//     clears, and the item is REMOVED from the pack - unless it is a
//     LANTERN, which stays so it can be refuelled with oil.
//   - under condition 3 the light GUTTERS: intensityMod cycles
//     0.85 + cos(guttering) * 0.2 while guttering walks by
//     Random.Range(-0.02, 0.06) - a slow, uneven pulse that is the
//     player's warning. At or above 3 it is a steady 1.25.
//
// TWO RECORDED DEPARTURES, both in Ledger A, both forced by what this
// port's renderer can express:
//
//  1. THE GUTTERING RIDES RANGE, NOT INTENSITY. The port's point-light
//     channel is a vec4 [x, y, z, range] with ONE colour per scene -
//     there is no per-light intensity. DFU itself animates RANGE for
//     every scene light (DaggerfallLight.AnimateLight, ported verbatim
//     in world/worldClock.js), so range is the port's light-animation
//     channel; the guttering is expressed in it, normalised so a
//     healthy torch is exactly its template range.
//
//  2. THE OFFSET IS TREATED AS LOCAL. DFU sets
//     `torchLight.transform.position = new Vector3(-0.3f, 1.2f, 0.2f)`
//     ONCE in Start (:52). PlayerTorch is a CHILD of the player, and
//     `transform.position` is a WORLD write - so what that line
//     actually fixes is a local offset of `(-0.3, 1.2, 0.2) minus
//     wherever the player happened to be standing when Start ran. The
//     torch then rides that arbitrary offset for the whole session,
//     and with the setting OFF the line never runs at all. It is not
//     reproducible and it is plainly not what the numbers mean, so the
//     port reads them as the local offset they describe: a light at
//     the player's left hand, 1.2 up, 0.2 forward.
//
// FLAGGED (blocked on data this reference tree does not carry): the
// PlayerTorch prefab, and with it the else-arm's range and the base
// `torchIntensity` the whole intensity chain multiplies. When
// PlayerTorchFromItems is ON the range is overwritten from the item
// template every frame, so that arm needs none of it - which is why
// this lane ships that arm whole and stops there. `PlayerTorchLightScale`
// stays inert for the same reason the guttering moved: it is a 0..1
// BRIGHTNESS, its default of 1.0 is a no-op, and mapping a brightness
// slider onto a radius would be a worse lie than leaving it alone.

import { templateByIndex } from './itemTemplates.js';
import { isLightSource, expandItemMacro } from './useItem.js';
import { getBool } from './settings.js';   // T1: EnablePlayerTorch reads its own setting, inside Update
import { setLightSource } from './lightSource.js';   // DISC7: the light in hand's one door
import { modSetting } from './modSettings.js';   // HT-WAIST: the lantern-at-the-waist switch, on Handheld Torches' pane

/** tickTimeInterval (:26) - REAL seconds, not game minutes. */
export const TORCH_TICK_SECONDS = 20;
/** The condition below which the light gutters (:88). */
export const GUTTERING_CONDITION = 3;
/** itemBasedTorchIntensity (:25) - the steady value the guttering band
 *  is normalised against. */
export const ITEM_BASED_TORCH_INTENSITY = 1.25;
/** The guttering band: 0.85 + cos(g) * 0.2, so 0.65 .. 1.05 (:90). */
export const GUTTER_BASE = 0.85;
export const GUTTER_SWING = 0.2;
/** Random.Range(-0.02f, 0.06f) (:91). */
export const GUTTER_STEP_LOW = -0.02;
export const GUTTER_STEP_HIGH = 0.06;
/** The offset in PLAYER space - left 0.3, up 1.2, forward 0.2 (:52). */
export const TORCH_OFFSET = Object.freeze({ left: 0.3, up: 1.2, forward: 0.2 });
/** Internal_Strings "lightDies". */
export const LIGHT_DIES_TEXT = 'Your %it flickers and dies.';
/** UselessItems2.Lantern - the ONE light source a dead flame does not
 *  consume, because oil can refill it (:79-80). */
export const LANTERN_TEMPLATE = 248;

/** `lightSource.ItemTemplate.capacityOrTarget` (:64) - the light's
 *  radius, straight off the shipping template. */
export const torchRange = (item) =>
  (item ? templateByIndex(item.templateIndex)?.capacityOrTarget ?? 0 : 0);

/** The per-entity torch state, created on demand. `guttering` is DFU's
 *  own field and survives between frames; `tickTimeBuffer` is its
 *  20-second accumulator. */
const torchStateOf = (entity) => (entity._torch ??= { tickTimeBuffer: 0, guttering: 0 });

/**
 * EnablePlayerTorch.Update's items arm (:60-95).
 *
 * @param entity        the player
 * @param dtSeconds     REAL seconds since the last frame
 * @param fromItems     an override for the setting; by default this
 *                      READS DaggerfallUnity.Settings.PlayerTorchFromItems,
 *                      which is where DFU reads it - inside Update
 *                      (:59). A parameter with a `false` default would
 *                      have been a switch every caller could forget.
 * @param say           the HUD channel for "flickers and dies"
 * @param rolls         the Random.Range slot for the guttering walk
 * @returns {{ lit: boolean, range: number, died: (object|null) }}
 */
export function tickPlayerTorch(entity, dtSeconds, { fromItems = null, say = null, rolls = Math.random } = {}) {
  const enabled = fromItems ?? getBool('Enhancements', 'PlayerTorchFromItems');
  const st = torchStateOf(entity);
  const source = entity?.lightSource ?? null;
  // The whole arm is behind the setting, and a source that is not a
  // light source is not one (a save could carry anything).
  if (!enabled || !source || !isLightSource(source)) {
    st.tickTimeBuffer = 0;
    st.guttering = 0;
    st.range = 0;
    return { lit: false, range: 0, died: null };
  }
  let lit = true;
  let died = null;
  st.tickTimeBuffer += dtSeconds;
  if (st.tickTimeBuffer > TORCH_TICK_SECONDS) {
    st.tickTimeBuffer = 0;
    if ((source.currentCondition ?? 0) > 0) source.currentCondition--;
    // DFU re-tests `CompareItems(playerEntity.LightSource, lightSource)`
    // before killing it - the source could have been swapped mid-tick.
    // Here the reference IS the identity, so `entity.lightSource ===
    // source` is that same test.
    if (source.currentCondition === 0 && entity.lightSource === source) {
      say?.(expandItemMacro(LIGHT_DIES_TEXT, source));
      lit = false;
      setLightSource(entity, null);   // DISC7: the one door
      // A LANTERN survives its own death - it is the one that refuels.
      if (!(source.group === 'UselessItems2' && source.templateIndex === LANTERN_TEMPLATE)) {
        const items = entity.items ?? [];
        const i = items.indexOf(source);
        if (i >= 0) items.splice(i, 1);
      }
      died = source;
    }
  }
  if (!lit) { st.guttering = 0; st.range = 0; return { lit: false, range: 0, died }; }
  // The guttering band, and the steady value above it.
  let mod = ITEM_BASED_TORCH_INTENSITY;
  if ((source.currentCondition ?? 0) < GUTTERING_CONDITION) {
    mod = GUTTER_BASE + Math.cos(st.guttering) * GUTTER_SWING;
    st.guttering += GUTTER_STEP_LOW + rolls() * (GUTTER_STEP_HIGH - GUTTER_STEP_LOW);
  } else {
    st.guttering = 0;
  }
  // Departure 1: the band rides RANGE, normalised so a healthy torch
  // is exactly its template radius. The tick PARKS it on the state, so
  // every host reads the same frame's torch without re-running the law
  // (and cannot forget to store it).
  st.range = torchRange(source) * (mod / ITEM_BASED_TORCH_INTENSITY);
  return { lit: true, range: st.range, died };
}

/**
 * The light the hosts draw, or null. Read AFTER the tick, from the
 * state it left - so every host answers the same frame's torch.
 *
 * The basis is YAW ONLY, and deliberately: DFU's offset is in the
 * PLAYER object's space, and the player body turns in yaw while the
 * PITCH belongs to the camera. A torch in your hand does not swing up
 * when you look at the ceiling. The two vectors are the port's own
 * camera basis with the pitch term dropped (`camRight` is
 * `[cos y, 0, -sin y]` in every host).
 */
export function playerTorchLight(entity, feet, yaw = 0) {
  const st = entity?._torch;
  if (!st || !(st.range > 0) || !feet) return null;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const f = [sy, 0, cy];              // forward
  const r = [cy, 0, -sy];             // right; DFU's -0.3 x is the player's LEFT
  // HT-WAIST: a lantern hung at the waist lights you from the HIP, and that beats both writers of the override
  // below (Handheld Torches' flip, which puts a HELD lantern low in the hand, and Eye Of The Beholder's
  // TorchOffset) - decided per frame from the item, so a torch lit a moment later never inherits the hip.
  const o = lanternAtWaist(entity?.lightSource) ? (_waistOverride ?? LANTERN_HIP) : (_offsetOverride ?? TORCH_OFFSET);
  return {
    x: feet[0] - r[0] * o.left + f[0] * o.forward,
    y: feet[1] + o.up,
    z: feet[2] - r[2] * o.left + f[2] * o.forward,
    range: st.range,
    // MAC-T1 (Mac, 2026-09-18: "a ball of light that hovers over the third person character when having a torch
    // equipped"): THE LIGHT IN THE HAND SAYS SO. EL7's "no glare for the torch in the hand" was written as "within
    // 1.5 of the CAMERA" (airPass.js, shadowPass.js's caster pick, enhancedLighting's contact march - one number,
    // three laws), and the third-person camera stands 2.7 behind the hand, so the exemption lapsed and the bloom's
    // glare sprite - a torso-sized additive ball - was painted over the body billboard, which the presence test took
    // for a flame flat. DFU's PlayerTorch is a bare point light with no flare in any camera; the record carries the
    // fact and the three laws read it. The composer (magicCandle.withPlayerLights) turns it into a per-light mask.
    carried: true,
  };
}

/** HT1: Handheld Torches writes PlayerTorch's localPosition itself
 *  (HandheldTorches.UpdateFreeHand, IL 0x2f1c / 0x2f50) - the light
 *  to the hand the sprite is in, a lantern lower. The transform keeps
 *  what was last written, so the override stands until cleared;
 *  `null` is DFU's own offset above. */
let _offsetOverride = null;
export function setPlayerTorchOffsetOverride(o) { _offsetOverride = o ? { left: +o.left || 0, up: +o.up || 0, forward: +o.forward || 0 } : null; }
export const playerTorchOffsetOverride = () => _offsetOverride;

// HT-WAIST (2026-09-24, Mac: "Let the lantern item be able to be hung at the waist instead of having to be held"):
// THE LANTERN AT THE WAIST - the port's own switch on Handheld Torches' pane (`Handling.LanternsAtWaist`, off by
// default; Ledger A). No new state: the lit lantern is still PlayerEntity.LightSource, burning through the tick
// above and saved as it always was. "At the waist" is DERIVED - the light in hand is a lantern, the mod is on and
// the switch is on - so the hand law, the first-person hand, the Morrowind body, the Eye Of The Beholder sprite
// and the light below all ask ONE question and cannot disagree about it. The component reads the same switch off
// its own settings frame (`readTorchSettings().lanternsAtWaist`), so its pins can drive it through a store.

/** The light at the hip, in the offset words above (left, up, forward off the feet, yaw frame): the RIGHT hip -
 *  clear of the one-handed scabbard Weapon Sheathing hangs on the left - at the height the Morrowind body's hook
 *  hangs the lantern (fpArm.js HIP_LANTERN_HOOK: a hand's breadth above the pelvis, less the lantern's own drop),
 *  a little forward. Port-own numbers: DFU has no lantern at the waist to take them from. */
export const LANTERN_HIP = Object.freeze({ left: -0.2, up: 1.0, forward: 0.1 });

/** Is this light a lantern hung at the waist - the lantern template, with Handheld Torches on and its waist
 *  switch on. Torches and candles are always held. */
export function lanternAtWaist(item) {
  if (!item || item.templateIndex !== LANTERN_TEMPLATE) return false;
  return modSetting('handheld-torches', 'Enabled') === true && modSetting('handheld-torches', 'Handling.LanternsAtWaist') === true;
}

/** Where a body that DRAWS the hanging lantern puts it, when that is not the yaw-frame hip above: Eye Of The
 *  Beholder's sprite faces the way it walks, not the camera's yaw, so it hands the drawn lantern's point in
 *  here (player/eotbBody.js) and clears it when it stops drawing. `null`: LANTERN_HIP. */
let _waistOverride = null;
const _waistPoint = { left: 0, up: 0, forward: 0 };   // written in place: its writer runs every frame the lantern is drawn
export function setPlayerWaistLightOverride(o) {
  if (!o) { _waistOverride = null; return; }
  _waistPoint.left = +o.left || 0; _waistPoint.up = +o.up || 0; _waistPoint.forward = +o.forward || 0;
  _waistOverride = _waistPoint;
}
export const playerWaistLightOverride = () => _waistOverride;
