// @ts-check
// DRAGON-RIDE (2026-10-28, systems/staffDragon.js; Staff-Events.md section 12) - THE PAGE'S HALF OF THE DRAGON'S RIDE,
// out of bootWorld (HOST-SPLIT): /dragon's word, the flight's pace on the motor, and the saddle drawn over my view - its
// firing picture for a moment after each volley. The cannons themselves fire in the cast engine (scenes/hostMagic.js).
import { mayRideDragon, ridingDragon, mountDragon, landDragon, dragonFlyMult, dragonFiring, SADDLE_PICTURES } from '../systems/staffDragon.js';
import { setStaffPowers, staffPowers } from '../characters/playerEntity.js';
import { registerFlySpeedMod } from '../player/motor.js';
import { dwarvenDragonArtUrl } from '../characters/dwarvenDragon.js';
import { loadLogo } from '../ui/titleScreen.js';
import { uiCanvas, onUiScreen } from '../ui/uiScreen.js';
import { horseOffsetHeight } from '../ui/hud/hudLarge.js';

/** `glyphs()` my own; `paused()` the game's; `now()` ms; `load(url)` a picture's pixels (tests hand their own).
 *  @param {{ renderer: any, canvas: any, glyphs: () => unknown, paused?: () => boolean, now?: () => number, load?: (url: string) => Promise<any> }} deps */
export function createStaffDragonHost({ renderer, canvas, glyphs, paused = () => false, now = () => performance.now(), load = loadLogo }) {
  registerFlySpeedMod('dragon', dragonFlyMult);
  /** @type {any[] | null} */
  let art = null;
  let asked = false;
  function loadArt() {
    if (asked) return;
    asked = true;
    Promise.all(SADDLE_PICTURES.map((n) => load(dwarvenDragonArtUrl(n)))).then((px) => {
      if (px.every(Boolean)) art = px.map((p, i) => ({ tex: renderer.uploadTexture('ui', `dragon:${SADDLE_PICTURES[i]}`, p), width: p.width, height: p.height }));
    }).catch(() => { asked = false; });
  }
  return {
    /** /dragon [on|off] (systems/staffDragon.js parseDragonCommand): `on` undefined turns the ride over. @param {{ on?: boolean }} c @param {(line: string) => void} say */
    command(c, say) {
      if (!mayRideDragon(glyphs())) { say('Only an Admin may ride the Dwarven Dragon.'); return; }
      const on = c.on ?? !ridingDragon();
      if (on === ridingDragon()) { say(on ? 'You are already riding the Dwarven Dragon.' : 'You are not riding the Dwarven Dragon.'); return; }
      if (on) {
        mountDragon(staffPowers().fly);
        setStaffPowers({ fly: true });
        loadArt();
        say('You mount the Dwarven Dragon. Click to fire its cannons; /dragon to land.');
      } else {
        setStaffPowers({ fly: !!landDragon() });
        say('You land the Dwarven Dragon.');
      }
    },
    /** Each frame, where the mount is drawn: the saddle along the bottom of my view, as wide as the screen. */
    frame() {
      if (!ridingDragon() || !art || paused()) return;
      const ui = uiCanvas(typeof canvas === 'function' ? canvas() : canvas);
      const a = art[dragonFiring(now()) ? 1 : 0];
      const w = ui.width, h = (a.height * w) / a.width;
      onUiScreen(renderer, ui, () => renderer.drawScreenQuad(a.tex, { x: 0, y: ui.height - h - horseOffsetHeight(), w, h }, undefined, undefined, { blend: true }));
    },
  };
}
