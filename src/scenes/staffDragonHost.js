// @ts-check
// DRAGON-RIDE (2026-10-28, systems/staffDragon.js; Staff-Events.md section 12) - THE PAGE'S HALF OF THE DRAGON'S RIDE,
// out of bootWorld (HOST-SPLIT): /dragon's word, the flight's pace on the motor, and the saddle drawn over my view - its
// firing picture for a moment after each volley. The cannons themselves fire in the cast engine (scenes/hostMagic.js).
import { mayRideDragon, ridingDragon, mountDragon, landDragon, dragonFlyMult, dragonFiring, dragonRideLook, setDragonRideLook } from '../systems/staffDragon.js';
import { setStaffPowers, staffPowers } from '../characters/playerEntity.js';
import { registerFlySpeedMod } from '../player/motor.js';
import { loadLogo } from '../ui/titleScreen.js';
import { createDragonSaddle } from '../player/dragonSaddle.js';   // DRAGON5: the saddle's one home, a tamed dragon's too

/** `glyphs()` my own; `paused()` the game's; `now()` ms; `load(url)` a picture's pixels (tests hand their own).
 *  @param {{ renderer: any, canvas: any, glyphs: () => unknown, paused?: () => boolean, now?: () => number, load?: (url: string) => Promise<any> }} deps */
export function createStaffDragonHost({ renderer, canvas, glyphs, paused = () => false, now = () => performance.now(), load = loadLogo }) {
  registerFlySpeedMod('dragon', dragonFlyMult);
  const saddle = createDragonSaddle({ renderer, load, look: dragonRideLook });   // DRAGON-BLUE: the Aetherbright's saddle in its colours
  return {
    /** /dragon [on|off|blue|brass] (systems/staffDragon.js parseDragonCommand): `on` undefined turns the ride over; `look`
     *  the dragon's (DRAGON-BLUE), mounted with it or changed in the saddle. @param {{ on?: boolean, look?: number }} c @param {(line: string) => void} say */
    command(c, say) {
      if (!mayRideDragon(glyphs())) { say('Only an Admin may ride the Dwarven Dragon.'); return; }
      const on = c.on ?? !ridingDragon();
      if (on && ridingDragon() && c.look !== undefined) {
        setDragonRideLook(c.look);
        saddle.loadArt();
        say(`You ride the ${c.look ? 'Aetherbright' : 'Dwarven'} Dragon.`);
        return;
      }
      if (on === ridingDragon()) { say(on ? 'You are already riding the Dwarven Dragon.' : 'You are not riding the Dwarven Dragon.'); return; }
      if (on) {
        mountDragon(staffPowers().fly, c.look ?? 0);
        setStaffPowers({ fly: true });
        saddle.loadArt();
        say(`You mount the ${c.look ? 'Aetherbright' : 'Dwarven'} Dragon. Click to fire its cannons; /dragon to land.`);
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
