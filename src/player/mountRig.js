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
import { horseOffsetHeight } from '../ui/hudLarge.js';   // ROAD-D D10: LargeHUDOffsetHorse
import { SOUND } from '../systems/soundClips.js';

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
}) {
  const animator = new RidingAnimator();   // TR2: the mount's frames, loop and neigh
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

    /**
     * TR3: dfuiOpenTransportWindow (DaggerfallUI.cs:690-700) - indoors
     * refuses with a HUD line (the interior hosts' own arms, not this
     * one), and AIRBORNE is silently ignored (`if (isGrounded)` with no
     * else). Outdoors and grounded, the picker opens.
     */
    open() {
      if (!player.grounded || !transportArtLoaded()) return;
      showOverlay(new TransportWindow({
        hasHorse: hasHorse(playerEntity.items ?? []),
        hasCart: hasCart(playerEntity.items ?? []),
        // TR4: the row is live when a ship is owned - AND when this
        // host can actually sail it. A fixed city has nowhere to sail
        // to, so the row goes dark rather than opening onto nothing.
        shipAvailable: !!onShip && ownsShip(playerEntity),
        onMode: (mode) => {
          if (mode === TRANSPORT_MODES.Ship) { onShip?.(); return; }
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
        soundVolume: 1,
      });
      if (r.neigh) audio.playOneShot(SOUND.AnimalHorse, RIDING_VOLUME_SCALE);
      audio.setLoop('riding', r.playing ? SOUND[r.clip] : null, { volume: r.volume, pitch: r.pitch });
      // TR-AUDIT F-E1: OnGUI (:293) refuses to draw AT ALL while the
      // game is paused - `!GameManager.IsGamePaused` sits in the same
      // condition as the Repaint test. Under an open window DFU shows
      // no mount; the first cut froze the frame and kept drawing it.
      if (art && isRiding(player.transportMode) && !ridePaused) {
        // ROAD-D D10: horseOffsetHeight (TransportManager.cs :304-309)
        // - the bar the LAST drawHud drew, lifted out from under the
        // mount. Docking is not asked here; DFU's horse arm never asks.
        const rect = ridingRect(canvasOf(), art, horseOffsetHeight());
        renderer.drawScreenQuad(art.frames[r.frame], rect);
      }
      return r;
    },
  };
}
