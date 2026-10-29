// @ts-check
// DRAGON-RIDE (2026-10-28, systems/staffDragon.js; Staff-Events.md section 12) - THE PAGE'S HALF OF THE DRAGON'S RIDE,
// out of bootWorld (HOST-SPLIT): /dragon's word, the flight's pace on the motor, and the saddle drawn over my view - its
// firing picture for a moment after each volley. The cannons themselves fire in the cast engine (scenes/hostMagic.js).
import { mayRideDragon, ridingDragon, mountDragon, landDragon, dragonFlyMult, dragonFiring } from '../systems/staffDragon.js';
import { setStaffPowers, staffPowers } from '../characters/playerEntity.js';
import { registerFlySpeedMod } from '../player/motor.js';
import { loadLogo } from '../ui/titleScreen.js';
import { createDragonSaddle } from '../player/dragonSaddle.js';   // DRAGON5: the saddle's one home, a tamed dragon's too

/** `glyphs()` my own; `paused()` the game's; `now()` ms; `load(url)` a picture's pixels (tests hand their own).
 *  @param {{ renderer: any, canvas: any, glyphs: () => unknown, paused?: () => boolean, now?: () => number, load?: (url: string) => Promise<any> }} deps */
export function createStaffDragonHost({ renderer, canvas, glyphs, paused = () => false, now = () => performance.now(), load = loadLogo }) {
  registerFlySpeedMod('dragon', dragonFlyMult);
  const saddle = createDragonSaddle({ renderer, load });
  return {
    /** /dragon [on|off] (systems/staffDragon.js parseDragonCommand): `on` undefined turns the ride over. @param {{ on?: boolean }} c @param {(line: string) => void} say */
    command(c, say) {
      if (!mayRideDragon(glyphs())) { say('Only an Admin may ride the Dwarven Dragon.'); return; }
      const on = c.on ?? !ridingDragon();
      if (on === ridingDragon()) { say(on ? 'You are already riding the Dwarven Dragon.' : 'You are not riding the Dwarven Dragon.'); return; }
      if (on) {
        mountDragon(staffPowers().fly);
        setStaffPowers({ fly: true });
        saddle.loadArt();
        say('You mount the Dwarven Dragon. Click to fire its cannons; /dragon to land.');
      } else {
        setStaffPowers({ fly: !!landDragon() });
        say('You land the Dwarven Dragon.');
      }
    },
    /** Each frame, where the mount is drawn: the saddle along the bottom of my view, as wide as the screen. */
    frame() {
      if (!ridingDragon() || !saddle.loaded() || paused()) return;
      saddle.draw(canvas, dragonFiring(now()));
    },
  };
}
