// SHOW PLAYER DAMAGE (AUDIT 24, wave 39) - ShowPlayerDamage.cs, whole.
// Thirty-seven lines in DFU and none of them in the port: the player
// took every hit in the game with no screen feedback at all.
//
//     float fadeSpeed = 0.7f;
//     public void Flash() { alphaFadeValue = 0.4f; fadingOut = true; }
//     void OnGUI() {
//         if (fadingOut) {
//             alphaFadeValue -= fadeSpeed * Time.deltaTime;
//             if (alphaFadeValue > 0) { ...draw red at alphaFadeValue... }
//             else { alphaFadeValue = 0; fadingOut = false; }
//         }
//     }
//
// So: 0.4 alpha, falling at 0.7 per REAL second - a touch under six
// tenths of a second - over the whole screen in flat red.
//
// WHICH HITS FLASH is a law, not an omission, and it is narrower than
// "the player was damaged". The flash rides `PlayerHealth.RemoveHealth`
// (PlayerHealth.cs:36-45), and the whole DFU tree sends that message
// from exactly three places:
//   - EnemyAttack.cs:406, an enemy's blow landing on the player;
//   - DaggerfallAction.cs:739 and :768, the dungeon damage traps;
//   - PlayerHealth.cs:57, its own fall-damage arm.
// Spell damage does NOT flash: DamageHealth, ContinuousDamageHealth
// and TransferHealth all go through `DamageHealthFromSource` ->
// `Entity.DecreaseHealth`, which never touches PlayerHealth. Neither
// do poison, disease or starvation. Being set on fire by a Fire Daedra
// flashes the screen because the CLAW lands, not because the damage
// does.

/** ShowPlayerDamage.cs:35 - the alpha a flash starts at. */
export const FLASH_ALPHA = 0.4;
/** :25 - alpha lost per real second. */
export const FLASH_FADE_SPEED = 0.7;
/** :46 - `new Color(1, 0, 0, alphaFadeValue)`. */
export const FLASH_RGB = [1, 0, 0];

export function createDamageFlash() {
  let alpha = 0;
  let fadingOut = false;
  return {
    /** Flash(). Re-flashing RESTARTS at 0.4 - two blows in one second
     *  do not stack into something darker, they refill the same fade. */
    flash() { alpha = FLASH_ALPHA; fadingOut = true; },
    /** OnGUI's fade step, on the host's REAL dt (Time.deltaTime is not
     *  scaled by the classic clock, and a flash does not slow down
     *  because the game does). */
    tick(dt) {
      if (!fadingOut) return 0;
      alpha -= FLASH_FADE_SPEED * (dt > 0 ? dt : 0);
      // DFU tests `> 0` and draws NOTHING on the step that reaches
      // zero, rather than drawing a zero-alpha quad and stopping next
      // frame. One frame of difference, kept.
      if (alpha > 0) return alpha;
      alpha = 0; fadingOut = false;
      return 0;
    },
    /** The full-screen quad. `drawScreenQuad` with a null texture and
     *  an alpha under one is the renderer's blended solid. */
    draw(renderer, canvas) {
      if (!fadingOut || !(alpha > 0)) return false;
      renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height },
        undefined, [FLASH_RGB[0], FLASH_RGB[1], FLASH_RGB[2], alpha]);
      return true;
    },
    get alpha() { return alpha; },
    get fading() { return fadingOut; },
  };
}

// THE PLAYER'S ONE FLASH. In DFU this is a single component on the
// player GameObject, reached from anywhere by
// `PlayerObject.SendMessage("RemoveHealth", ...)`. The port's nearest
// existing shape is `characters/playerEntity.js`'s module-level
// `hurtPlayer` / `_deathPresenter` - one player, one presenter, no
// host threading a callback through six layers to reach it. Same
// here: the damage sites call `flashPlayerDamage()`, and whichever
// host is drawing ticks and draws `playerDamageFlash`.
export const playerDamageFlash = createDamageFlash();

/** The `SendMessage("RemoveHealth")` edge - call it where DFU sends
 *  that message, and nowhere else. */
export function flashPlayerDamage() { playerDamageFlash.flash(); }
