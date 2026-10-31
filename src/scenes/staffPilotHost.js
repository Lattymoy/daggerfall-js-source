// @ts-check
// STAFF-PILOT (2026-10-26, mob: "like play as a boss as attack players"; systems/staffBossPilot.js) - THE PAGE'S HALF OF
// PLAY AS BOSS, out of bootWorld (HOST-SPLIT): the panel's `pilot` word (net/staffHook.js), the mouse while I steer, my
// camera's facing each frame, my body no one's, and the steering's end said back to the panel. The page's follow
// (scenes/staffFollowHost.js staffFollowOnPage) wires it; the boss itself is steered in the foes pool (scenes/exteriorFoes.js).
import {
  pilotStart,
  pilotStop,
  pilotKey,
  piloting,
  pilotYaw,
  pilotPress,
  pilotLost,
} from '../systems/staffBossPilot.js';
import { staffPilotBoss } from '../systems/raidingParties.js';
import { drawGateBossBar } from '../ui/gate/gateBossBar.js';
import { pilotBarModel } from '../ui/staffPilotBar.js';

/** `post` the door's answer to the panel; `hidden()` whether Hide me is on and `showMe()` turns it off - a hidden game's
 *  frames reach no one, so the boss would stand for me alone; `entity` the player; `drawBar` the boss bar (PILOT-BAR).
 *  @param {{ post: (m: object) => void, win?: any, entity?: any, hidden?: () => boolean, showMe?: () => void, bossOf?: () => any, now?: () => number, drawBar?: (m: any) => void }} deps */
export function createStaffPilotHost({
  post,
  win = globalThis.window,
  entity = null,
  hidden = () => false,
  showMe = () => {},
  bossOf = staffPilotBoss,
  now = () => performance.now(),
  drawBar = drawGateBossBar,
}) {
  let barUp = false; // PILOT-BAR: the boss bar is mine to put away
  const bar = (/** @type {any} */ f) => {
    if (f || barUp) {
      drawBar(f ? pilotBarModel(f, now()) : null);
      barUp = !!f;
    }
  };
  const evOf = () => (pilotKey() ?? '').slice(2);
  const end = (/** @type {string} */ why) => {
    const ev = evOf();
    pilotStop();
    if (entity) entity.staffPilot = false;
    post({ dfoStaff: 'pilot', on: false, ev, why });
  };
  // a press while the game holds the pointer (never a click on the panel's own overlay)
  win?.addEventListener?.('mousedown', (/** @type {any} */ e) => {
    if (piloting() && win.document?.pointerLockElement) pilotPress(e.button, now());
  });
  return {
    /** The panel's word. @param {any} m */
    word(m) {
      if (m.on !== true) {
        if (piloting()) end('left');
        return;
      }
      if (!pilotStart(m.ev, now())) {
        post({ dfoStaff: 'pilot', on: false, ev: m.ev, why: 'bad' });
        return;
      }
      if (hidden()) showMe();
      post({ dfoStaff: 'pilot', on: true, ev: evOf(), boss: !!bossOf() });
    },
    /** Each frame: my body no one's while I steer; the steering ends when its boss fell (PILOT-ARM: armed until one stands). */
    frame() {
      if (entity) entity.staffPilot = piloting();
      if (!piloting()) {
        bar(null);
        return;
      }
      const boss = bossOf();
      const why = pilotLost(boss, now());
      if (why) end(why);
      bar(piloting() ? boss : null); // PILOT-BAR: its health on my screen while I steer it
    },
    /** After the camera took its frame: the boss faces where I look. @param {{ yaw: number }} cam */
    eye(cam) {
      pilotYaw(cam.yaw);
    },
    piloting,
  };
}
