// MAC-K3 - THE MOUNT, ONE HOME.
//
// Mac, 2026-09-15: "T to mount not working outside interiors."
//
// It was not a missing key. `KeyT` resolves to `Transport`
// (systems/inputActions.js) and `ui/input.js` routes that to
// `ctx.openTransport`, which THREE hosts answered: `world.js` with the
// real picker, and `worldModes.js` and `dungeonContext.js` with the
// indoor refusal line. `scenes/exterior.js` - the FIXED-CITY host, the
// one a player walking round a town is in - answered nothing, so the
// key did nothing at all. THE FOUR HOSTS, three wired and one not, for
// the second time in two days.
//
// And it was not a one-liner either: that host had no transport
// surface whatever. It READ `player.transportMode` (the ray distance
// at :749, the mounted water gate at :3831) and had no way to set it,
// no animator, no art and no sprite - so even had the key been routed
// there was nothing behind it.
//
// SO THE SURFACE MOVED HERE, rather than being copied into a second
// host: HARD2a did this for the activation race and HARD2c for the
// weapon pose, and the reason is the same one exterior.js's own quest
// walk carried until MAC-K2 - "two copies is two laws the day one of
// them moves".
//
// WHAT STAYS WITH THE HOST. The SHIP is not a mode you travel in
// (DFU's own comment on the enum) - it is a teleport - and the one
// that exists is `world.js`'s, wired into its streaming world. A host
// with no world to teleport across hands `onShip: null` and the
// picker's Ship row is dark, which is the truth rather than a button
// that does nothing.

import { TRANSPORT_MODES, isRiding, hasHorse, hasCart } from '../systems/transport.js';
import { RidingAnimator, loadRidingArt, ridingRect, RIDING_VOLUME_SCALE } from '../systems/riding.js';
import { TransportWindow, transportArtLoaded } from '../ui/transportWindow.js';
import { ownsShip } from '../systems/banking.js';
import { horseOffsetHeight, dockedLargeHudHeight } from '../ui/hudLarge.js';   // ROAD-D D10: LargeHUDOffsetHorse; AUDIT-RR F25: EnhancedRiding's own arm asks LargeHUDDocked (EnhancedRiding.cs:256-257)
import { mwViewHides } from './mwView.js';   // AUDIT-EOTB2: the sprite body on screen hides the FPV horse (Eye Of The Beholder's ToggleBillboard)
import { SOUND } from '../systems/soundClips.js';
import { isShipAvailable } from '../systems/ship.js';   // RR1: TransportManager.ShipAvailiable, the delegate
import { NATIVE_SCREEN_HEIGHT } from '../systems/riding.js';   // RR2: the 200-line native screen the sprite scales by
import { RR_RIDING, rrTerrainAngle, rrTerrainFollow, rrRidingYAdj, rrRidingNeckBand } from '../systems/rrRealism.js';   // RR2: EnhancedRiding's draw laws
import { setPitchFloorProvider } from './lookFilter.js';   // RR2: PitchMaxLimit while riding

/**
 * @param deps {
 *   renderer, canvas (element or () => element), fetchBytes, palette, audio,
 *   player           - the motor (setTransportMode, transportMode, grounded, ...)
 *   playerEntity     - for the picker's three availability questions
 *   showOverlay(win) - the host's own window slot
 *   onShip           - the ship teleport, or null where there is none
 *   paused()         - GameManager.IsGamePaused
 * }
 */
export function createMountRig({
  renderer, canvas, fetchBytes, palette, audio,
  player, playerEntity, showOverlay, onShip = null, paused = () => false,
  shipLocation = null,   // RR1: () => ({ loaded, portTown, onShip }) - what TransportManager.ShipAvailiable's replacement reads (RoleplayRealism.cs:610-631); null when the host cannot say
  // RR2 (EnhancedRiding.cs): the host's reads the component makes - the
  // look's pitch (radians, up-positive) and yaw, the ground's height at a
  // world x/z, and whether the module is on with its two settings
  lookPitch = null, lookYaw = null, groundHeightAt = null, enhancedRiding = null,
  // AUDIT-TO1 J1: TransportManager.RidingVolumeScale, which Travel
  // Options zeroes for an accelerated journey (TravelOptionsMod.cs:1227
  // -1229) and restores at its end (:1264). A host that hands none
  // rides at DFU's own 1.
  ridingVolumeScale = () => 1,
  horseCart = null,   // HCC: () => the Horse Cart and Cargo runtime, or null - TrailingWagonTransportWindow's gate and route
}) {
  const animator = new RidingAnimator();   // TR2: the mount's frames, loop and neigh
  // RR2: the terrain ring (EnhancedRiding.cs:26-31) and the pitch floor the
  // component sets (`PitchMaxLimit = terrainAngle + 18`, :288) - registered
  // for as long as this rig stands; off the mount, the owner's floor
  const _terrainAngles = new Array(RR_RIDING.samples).fill(0);
  let _sampleIdx = 0;
  let _terrainAngle = 0;
  /** RR2: EnhancedRiding.OnGUI (:265-322) - TransportManager.DrawHorse is
   *  off and the component draws the mount itself: `yAdj = (Pitch -
   *  terrainAngle - 10) * 2.6` (DFU's Pitch down-positive) lifts the
   *  sprite's bottom edge off the screen's, over the averaged terrain
   *  ring. Rewrites `rect.y`; answers { yAdj, scaleY, c }. */
  function liftForLook(rect, art, enhanced) {
    const c = canvasOf();
    _terrainAngle = rrTerrainFollow(_terrainAngles, enhanced.softenFollow ?? 0, enhanced.terrainFollowing !== false);
    const pitchDeg = -((lookPitch?.() ?? 0) * 180) / Math.PI;
    const yAdj = rrRidingYAdj(pitchDeg, _terrainAngle);
    const scaleY = c.height / NATIVE_SCREEN_HEIGHT;
    // AUDIT-RR F25: `LargeHUD && LargeHUDDocked` (EnhancedRiding.cs:256-257), not TransportManager's OffsetHorse arm - the
    // component draws the mount itself and asks its own question; ridingRect above took the classic arm's offset, so
    // it is taken back out here and the docked height put in
    const offset = Math.trunc(dockedLargeHudHeight());   // AUDIT-RR2 G4: `(int)LargeHUD.ScreenHeight` (EnhancedRiding.cs:257)
    rect.y = c.height - ((art.height + yAdj) * scaleY) - offset;
    return { yAdj, scaleY, c, offset };
  }
  /** OnGUI's neck band (:303-320): when the lifted sprite leaves a gap
   *  under it, a strip of the same riding texture fills it (no neck CFA
   *  here - see rrRealism), `width - 14` wide, from 0.2 of the texture
   *  down by `yAdj / 100`. */
  function drawNeckBand({ yAdj, scaleY, c, offset }, rect, art, r) {
    const drawBottom = rect.y + rect.h - scaleY;
    if (drawBottom >= c.height) return;
    const band = rrRidingNeckBand(yAdj);
    const scaleX = rect.w / art.width;
    renderer.drawScreenQuad(art.frames[r.frame], { x: rect.x, y: drawBottom, w: (art.width - band.widthTrim) * scaleX, h: c.height - drawBottom + scaleY - offset }, { u0: band.u0, v0: band.v0, u1: band.u1, v1: band.v1 });
  }
  setPitchFloorProvider(() => (enhancedRiding?.() && isRiding(player.transportMode) && !paused() ? _terrainAngle + RR_RIDING.pitchMaxOffset : null));   // AUDIT-RR2 G26: the else arm (`IsGamePaused || !IsRiding`, :122-131) resets PitchMaxLimit every frame
  let art = null;                          // TR2: the four CFA frames of the mount under you
  const canvasOf = () => (typeof canvas === 'function' ? canvas() : canvas);

  /**
   * THE ONE PLACE THE MODE CHANGES (U53), and HC1's lesson with it
   * (2026-09-14, Mac: "audit the horse and cart ... the sprites
   * actually show"): the mount's art loads HERE, not on the T-key pick
   * alone. Three other paths set the mode and used to leave the art
   * null for good - a loaded save on horseback, the Test Room's ride
   * out, and the ship's landing - and a rider from any of them had the
   * speed, the bob and the hoof loop with no horse under them.
   */
  function setMode(mode) {
    player.setTransportMode(mode);   // F-E3: the height action rides with the mode
    animator.mount(mode);
    art = null;
    if (isRiding(mode)) {
      loadRidingArt(fetchBytes, palette, renderer, mode)
        .then((a) => { if (player.transportMode === mode) art = a; })   // still that mount: a dismount mid-load keeps null
        .catch((e) => console.warn('[transport] mount art unavailable:', e?.message ?? e));
    }
  }

  return {
    setMode,
    /** For a host that needs to know whether the sprite is up. */
    loaded: () => !!art,
    /** Tests only: the art without ARENA2 (RR2's lift and band are drawn off it). */
    _setArt: (a) => { art = a; },

    /**
     * TR3: dfuiOpenTransportWindow (DaggerfallUI.cs:690-700) - indoors
     * refuses with a HUD line (the interior hosts' own arms, not this
     * one), and AIRBORNE is silently ignored (`if (isGrounded)` with no
     * else). Outdoors and grounded, the picker opens.
     */
    open() {
      if (!player.grounded || !transportArtLoaded()) return;
      // HCC: TrailingWagonTransportWindow.Setup [IL_b008] - with the mod on, the horse and cart rows are live only
      // when the runtime's CanMountHorseFromTransportWindow / CanUseCartFromTransportWindow say so (a horse waiting
      // across the map cannot be mounted from here), and a click goes through TryUseTransport rather than the
      // direct set - the runtime walks the player to the team, or says why not.
      const rt = horseCart?.() ?? null;
      showOverlay(new TransportWindow({
        hasHorse: rt ? !!rt.canMountHorseFromTransportWindow() : hasHorse(playerEntity.items ?? []),
        hasCart: rt ? !!rt.canUseCartFromTransportWindow() : hasCart(playerEntity.items ?? []),
        // TR4: the row is live when a ship is owned - AND when this
        // host can actually sail it. A fixed city has nowhere to sail
        // to, so the row goes dark rather than opening onto nothing.
        shipAvailable: isShipAvailable({ canSail: !!onShip, ownsShip: ownsShip(playerEntity), ...(shipLocation?.() ?? {}) }),   // RR1: through the delegate (DFU's own answer is HasShip)
        onMode: (mode) => {
          if (mode === TRANSPORT_MODES.Ship) { onShip?.(); return; }
          if (rt && (mode === TRANSPORT_MODES.Horse || mode === TRANSPORT_MODES.Cart)) { rt.tryUseTransport(mode); return; }   // HCC: HandleHorseTransportButton / HandleCartTransportButton [IL_b170, IL_b1ac]
          setMode(mode);   // HC1: the art loads with the mode, in the one place
        },
      }));
    },

    /**
     * The frame's half: the animator, the audio and the sprite.
     * Called from the host's draw ladder where the classic HUD art is
     * up - OnGUI draws at depth 2, UNDER the HUD's own elements, so it
     * goes in before drawHud.
     */
    frame(dt) {
      const ridePaused = paused();
      const r = animator.update(dt, {
        mode: player.transportMode,
        standingStill: player.standing,
        grounded: player.grounded,
        paused: ridePaused,
        movingLessThanHalfSpeed: player.movingLessThanHalfSpeed,
        running: player.isRunning,
        soundVolume: ridingVolumeScale(),   // AUDIT-TO1 J1: 0 for the length of an accelerated journey
      });
      if (r.neigh) audio.playOneShot(SOUND.AnimalHorse, RIDING_VOLUME_SCALE);
      audio.setLoop('riding', r.playing ? SOUND[r.clip] : null, { volume: r.volume, pitch: r.pitch });
      // TR-AUDIT F-E1: OnGUI (:293) refuses to draw AT ALL while the
      // game is paused - `!GameManager.IsGamePaused` sits in the same
      // condition as the Repaint test. Under an open window DFU shows
      // no mount; the first cut froze the frame and kept drawing it.
      // AUDIT-EOTB2 [SETTINGS]: and not while the Eye Of The Beholder body
      // is the one on screen - the horse archives draw the rider WITH the
      // horse, so the FPV horse hides (Compatibility.Don'tHideHorse keeps it)
      // RR2: EnhancedRiding.Update's terrain sample (:139-146) - the ground
      // under the rider against one unit ahead, into a ring of sixteen,
      // while riding and not paused
      const enhanced = enhancedRiding?.() ?? null;
      if (enhanced && isRiding(player.transportMode) && !ridePaused && groundHeightAt && player.pos) {
        const yaw = lookYaw?.() ?? 0;
        const here = groundHeightAt(player.pos[0], player.pos[2]);
        const ahead = groundHeightAt(player.pos[0] + Math.sin(yaw), player.pos[2] + Math.cos(yaw));
        if (Number.isFinite(here) && Number.isFinite(ahead)) { _terrainAngles[_sampleIdx++] = rrTerrainAngle(here, ahead); if (_sampleIdx >= RR_RIDING.samples) _sampleIdx = 0; }
      }
      if (art && isRiding(player.transportMode) && !ridePaused && !mwViewHides().horse) {
        // ROAD-D D10: horseOffsetHeight (TransportManager.cs :304-309)
        // - the bar the LAST drawHud drew, lifted out from under the
        // mount. Docking is not asked here; DFU's horse arm never asks.
        const rect = ridingRect(canvasOf(), art, horseOffsetHeight());
        const lift = enhanced ? liftForLook(rect, art, enhanced) : null;   // RR2: EnhancedRiding.OnGUI - the sprite rides the look
        renderer.drawScreenQuad(art.frames[r.frame], rect);
        if (lift) drawNeckBand(lift, rect, art, r);   // RR2: and the gap under it is filled
      }
      return r;
    },
    /** RR2: OnGUI's averaged terrain angle, for the look's floor. */
    terrainAngle: () => _terrainAngle,
  };
}
