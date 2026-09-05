// TI1 - THE RIGHT-HALF GESTURE, classified before it is routed. The
// phone's right half carries THREE things the mouse carries on three
// devices: the look (mouse motion), the swipe attack (the RMB drag -
// WeaponManager.TrackMouseAttack, playerWeapon.gesture) and the
// activation (the free-cursor click, PlayerActivate.cs:303). One
// finger must say which - and it must say it BEFORE a pixel reaches
// the attack seam, because the shipped WeaponAttackThreshold is 0.005
// of the screen's longest side: five pixels on a phone, so a look-drag
// fed to the seam swings on its first frame.
//
// TI1b (2026-09-05, Mac on a phone: "the righthand side of the screen
// needs to work for touch to look around. currently its bugged"). The
// first cut told a swipe from a look BY SPEED - 48 px inside 180 ms -
// and a look-pan clears that in the first thirty. Nearly every look
// became a swipe, and with the weapon sheathed a swipe is nothing.
// Speed cannot separate the two gestures; a HOLD can. The rules now:
//   - travel under TAP_PX and the finger up inside TAP_MS: a TAP,
//     answered on release with the point it landed on;
//   - LOCKED ON (the host's predicate): any drag past TAP_PX is the
//     SWIPE - the camera is facing the foe on its own, the drag has
//     nothing else to mean;
//   - a finger held STILL for HOLD_MS and then dragged is the SWIPE:
//     the press-and-stroke DFU's own swing mode 0 asks of the mouse;
//   - any other drag is the LOOK, live from its first move past
//     TAP_PX - the sub-tap-radius motion before it is paid in one lump,
//     so nothing is dropped and the camera starts at once.
// Pure: no DOM, no clock of its own. Times are the caller's ms.
// Pinned by test/touchinput.test.js, each rule with its mutant.

export const TAP_PX = 16;    // TI1d: DISPLACEMENT from the touch origin, a thumb's roll on a phone
export const HOLD_MS = 160;  // a finger still this long, then moved, is the swipe

// TI1d (review, Mac: "touch to lock on still doesn't work"): the tap
// was judged on the PATH'S LENGTH against 12 px, and a thumb resting
// on a phone jitters 2-6 px per touchmove - ten or twenty of them in a
// 200 ms press - so the budget was spent before the finger lifted and
// the press became a look; and a still press longer than 300 ms was
// nothing at all. A tap is now a finger that never left TAP_PX of
// where it landed, however long it rested: the hold-then-drag rule
// below tells a held swipe apart by MOVEMENT, so a still long press is
// unambiguous and costs the swipe nothing.

/**
 * @param {object} [opts]
 * @param {() => boolean} [opts.locked] - the host's predicate: a drag
 *   is the swipe at once (a lock held AND a weapon in hand)
 * @returns a recogniser: begin/move/end/cancel each answer an ARRAY of
 *   events {type:'tap',x,y} | {type:'look',dx,dy} | {type:'swipe',dx,dy,held}
 */
export function createGestureRecognizer({
  tapPx = TAP_PX, holdMs = HOLD_MS,
  locked = () => false,
} = {}) {
  let state = 'idle';
  let ox = 0, oy = 0, ot = 0, lx = 0, ly = 0;
  let bufDx = 0, bufDy = 0;
  return {
    get state() { return state; },
    begin(x, y, t) {
      state = 'pending';
      ox = lx = x; oy = ly = y; ot = t;
      bufDx = 0; bufDy = 0;
      return [];
    },
    move(x, y, t) {
      if (state === 'idle') return [];
      const dx = x - lx, dy = y - ly;
      lx = x; ly = y;
      if (state === 'look') return [{ type: 'look', dx, dy }];
      if (state === 'swipe') return [{ type: 'swipe', dx, dy, held: true }];
      bufDx += dx; bufDy += dy;
      if (Math.hypot(x - ox, y - oy) < tapPx) return [];   // still inside the tap radius, whatever the path was
      if (locked() || (t - ot) >= holdMs) {
        state = 'swipe';
        return [{ type: 'swipe', dx: bufDx, dy: bufDy, held: true }];
      }
      state = 'look';
      return [{ type: 'look', dx: bufDx, dy: bufDy }];
    },
    end() {
      const s = state;
      state = 'idle';
      if (s === 'pending') return [{ type: 'tap', x: ox, y: oy }];   // never left the radius: a tap, however long it rested
      if (s === 'swipe') return [{ type: 'swipe', dx: 0, dy: 0, held: false }];
      return [];
    },
    cancel() {
      const s = state;
      state = 'idle';
      return s === 'swipe' ? [{ type: 'swipe', dx: 0, dy: 0, held: false }] : [];
    },
  };
}
