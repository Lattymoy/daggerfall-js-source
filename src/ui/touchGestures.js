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
// THE RULES, in the order they are tested:
//   - travel under TAP_PX and the finger up inside TAP_MS: a TAP,
//     answered on release with the point it landed on;
//   - LOCKED ON (the host's predicate): any drag past TAP_PX is the
//     SWIPE - the camera is facing the foe on its own, the drag has
//     nothing else to mean;
//   - fast - FLICK_PX of travel inside FLICK_MS - is the SWIPE;
//   - otherwise, once the flick window has passed or the drag has run
//     FLICK_PX slowly, it is the LOOK.
// While a drag is still PENDING its deltas are BUFFERED, not dropped:
// a drag that resolves to look pays the buffered motion in one lump
// (the camera starts at most FLICK_MS late), and a drag that resolves
// to a swipe hands the seam the whole trail so far (the gesture's
// travel is the trail's length - AUDIT 24's TravelDist law - so
// nothing of the flick is lost to the classification).
//
// Pure: no DOM, no clock of its own. Times are the caller's ms.
// Pinned by test/touchinput.test.js, each rule with its mutant.

export const TAP_PX = 12;
export const TAP_MS = 300;
export const FLICK_PX = 48;
export const FLICK_MS = 180;

/**
 * @param {object} [opts]
 * @param {() => boolean} [opts.locked] - the host's lock-on predicate
 * @returns a recogniser: begin/move/end/cancel each answer an ARRAY of
 *   events {type:'tap',x,y} | {type:'look',dx,dy} | {type:'swipe',dx,dy,held}
 */
export function createGestureRecognizer({
  tapPx = TAP_PX, tapMs = TAP_MS, flickPx = FLICK_PX, flickMs = FLICK_MS,
  locked = () => false,
} = {}) {
  let state = 'idle';
  let ox = 0, oy = 0, ot = 0, lx = 0, ly = 0;
  let travel = 0, bufDx = 0, bufDy = 0;
  return {
    get state() { return state; },
    begin(x, y, t) {
      state = 'pending';
      ox = lx = x; oy = ly = y; ot = t;
      travel = 0; bufDx = 0; bufDy = 0;
      return [];
    },
    move(x, y, t) {
      if (state === 'idle') return [];
      const dx = x - lx, dy = y - ly;
      lx = x; ly = y;
      travel += Math.hypot(dx, dy);
      if (state === 'look') return [{ type: 'look', dx, dy }];
      if (state === 'swipe') return [{ type: 'swipe', dx, dy, held: true }];
      bufDx += dx; bufDy += dy;
      if (travel < tapPx) return [];
      const elapsed = t - ot;
      if (locked() || (elapsed <= flickMs && travel >= flickPx)) {
        state = 'swipe';
        return [{ type: 'swipe', dx: bufDx, dy: bufDy, held: true }];
      }
      if (elapsed > flickMs || travel >= flickPx) {
        state = 'look';
        return [{ type: 'look', dx: bufDx, dy: bufDy }];
      }
      return [];
    },
    end(t) {
      const s = state;
      state = 'idle';
      if (s === 'pending') {
        if (travel < tapPx && (t - ot) <= tapMs) return [{ type: 'tap', x: ox, y: oy }];
        if (bufDx !== 0 || bufDy !== 0) return [{ type: 'look', dx: bufDx, dy: bufDy }];
        return [];
      }
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
