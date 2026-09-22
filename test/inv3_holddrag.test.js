// INV3 - THE HOLD THAT SOMETIMES DID NOT TAKE (2026-09-17, Mac).
//
// "Hold to drag functionality in inventory sometimes doesnt work."
//
// SOMETIMES, and the sometimes was a measurement. AUDIT INV2 A1 wrote
// the right law - the pack pans by default, a flick scrolls and is
// never a drag, only a still finger picks anything up - and then asked
// the wrong question of the finger: `|dx| + |dy| > 8`, ONE Manhattan
// sum over BOTH axes, against half the room the browser itself allows.
//
// What a real Chromium does with the `touch-action: pan-y` tile that
// law is written for, measured by tools/invDragProbe.mjs on a 430x860
// phone at device pixel ratios 1, 2 and 3:
//
//   - it takes the gesture (`pointercancel`) at 16 CSS px of VERTICAL
//     travel, and keeps it at 15 - the same number at every pixel
//     ratio, so it is CSS px;
//   - it never takes it for HORIZONTAL travel, out to 160px, because a
//     pan-y surface has no sideways pan to hand over.
//
// So the old sum threw the hold away twice over: at 8px where the
// browser allows 16, and on an axis where the browser has nothing to
// take. A thumb drifting 5px across and 4px down - neither of which can
// scroll anything - lost the item it was reaching for. In the probe the
// hold survived 0 of 12 trials at a 6px drift before the fix and 12 of
// 12 after.
//
// The slop is per-axis now, and the axis that can pan is the only one
// judged tightly. These pin the law itself (the predicate is exported,
// so it is pinned as a LAW rather than as whatever one path happened to
// do) and then DRIVE it, for AUDIT INV2's reason: a pin over a
// declaration is not a pin over a feature.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { holdBroken, MOUSE_HOLD_MS, mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';
import { ITEM_TEMPLATES, getTemplate } from '../src/characters/paperdoll.js';
import { equipItem, isEquipped } from '../src/systems/equip.js';

const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name) ?? getTemplate?.(name) ?? null;
const mk = (name, group = 'Weapons') => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  return {
    name: t.name, templateIndex: t.index, group, stackCount: 1,
    currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50,
  };
};
const hero = () => {
  const e = {
    name: 'Aelwyn', career: { name: 'Spellsword' },
    stats: { strength: 50, endurance: 48 }, items: [],
  };
  e.items = [mk('Longsword'), mk('Dagger'), mk('Cuirass', 'Armor')];
  e.goldPieces = 1287;
  return e;
};

/** The pane, mounted, with the levers a TOUCH gesture needs. The hold
 *  is a timer, so the clock is the test's - a 320ms sleep per assertion
 *  would be a suite that takes a minute to say nothing. */
function withPack(fn, { wear = null } = {}) {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    return withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const e = hero();
      const dropped = [];
      const view = mountEnhancedInventory(host, {
        entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => dropped.push(it),
      });
      if (wear) { assert.ok(equipItem(e, e.items.find((it) => it.name === wear))); view.repaint(); }
      const rows = () => dom.doc.querySelectorAll('.itemrow');
      const panels = () => dom.doc.querySelectorAll('.wornrow').filter((n) => !n.classList.contains('wornempty'));
      const ghost = () => dom.doc.querySelectorAll('.dragghost')[0] ?? null;
      const at = (node) => { dom.doc.elementFromPoint = () => node; };
      /** A FINGER, not a mouse - `pointerType` is the whole difference. */
      const press = (row, x, y, type = 'touch') => row.onpointerdown?.({ pointerId: 3, button: 0, pointerType: type, clientX: x, clientY: y });
      const move = (x, y) => dom.win.fire('pointermove', { pointerId: 3, clientX: x, clientY: y });
      const up = (x, y) => dom.win.fire('pointerup', { pointerId: 3, clientX: x, clientY: y });
      const wait = (ms) => mock.timers.tick(ms);
      /** A raw touchmove, and whether the pane asked the browser to keep
       *  the gesture. `cancelable` false is what a move becomes once a
       *  scroll has already started. */
      const touchmove = ({ cancelable = true } = {}) => {
        let held = false;
        dom.win.fire('touchmove', { cancelable, preventDefault() { held = true; } });
        return held;
      };
      return fn({ dom, e, view, dropped, rows, panels, ghost, at, press, move, up, wait, touchmove });
    });
  } finally { mock.timers.reset(); }
}

// ── THE LAW, AS A LAW ────────────────────────────────────────────
test('INV3: the slop is PER AXIS, and only the axis that can scroll is judged tightly', () => {
  // A still finger is still still.
  assert.equal(holdBroken(0, 0), false);

  // THE SCROLLING AXIS. The list pans in y, so y is where a moving
  // finger really might have meant the scroller - judged at 12, and 12
  // is a number with two sides to it: over the 8 that was throwing
  // holds away, and UNDER the 16 at which Chromium takes the gesture
  // for itself, so this law is the one that fires.
  assert.equal(holdBroken(0, 12), false, 'twelve pixels down is still a hold');
  assert.equal(holdBroken(0, 13), true, 'thirteen is a finger that meant the scroller');
  assert.equal(holdBroken(0, -13), true, 'and upward is the same gesture');
  assert.equal(holdBroken(0, 15), true,
    'the pane gives up BEFORE the browser does - measured, Chromium cancels the pointer at 16 CSS px');

  // THE AXIS THAT CANNOT SCROLL. A pan-y surface has no sideways pan to
  // give, measured out to 160px with no pointercancel at any pixel
  // ratio, so horizontal travel is not evidence of a scroll. It is only
  // evidence that the finger is going somewhere, which takes twice as
  // much of it to prove.
  assert.equal(holdBroken(12, 0), false);
  assert.equal(holdBroken(24, 0), false, 'the axis nothing can steal is judged loosely');
  assert.equal(holdBroken(25, 0), true, 'but a finger that TRAVELS is not resting');
  assert.equal(holdBroken(-25, 0), true);
  assert.ok(holdBroken(25, 0) && !holdBroken(0, 25 - 13), 'the two axes really are different numbers');

  // AND THE TWO ARE NOT SUMMED. This is the shipped bug in one line: a
  // thumb 9 across and 9 down is 18 of Manhattan and was thrown away,
  // and neither axis could have scrolled a thing.
  assert.equal(holdBroken(9, 9), false, 'the drift that was losing the item');
  assert.equal(holdBroken(12, 12), false, 'both axes at their own limit is still a hold');
  assert.equal(holdBroken(24, 13), true, 'and either one past it is not');
});

// ── AND THE LAW, DRIVEN ──────────────────────────────────────────
test('INV3: a thumb that drifts in both axes still picks the item up', () => {
  withPack(({ dom, rows, ghost, at, press, move, wait, up }) => {
    const row = rows()[0];
    at(dom.body);
    press(row, 200, 300);
    assert.equal(ghost(), null, 'a press alone carries nothing - a tap is still a pick');
    // the contact patch wandering while the thumb settles: 18 of
    // Manhattan, and not one pixel of it could scroll anything
    move(209, 304);
    move(205, 309);
    move(209, 309);
    assert.equal(ghost(), null, 'and it has not armed yet - the hold is a HOLD');
    wait(320);
    assert.ok(ghost(), 'the hold survives a drifting finger');
    up(209, 309);
  });
});

test('INV3: the ghost arms under the FINGER, not under the point it landed on', () => {
  withPack(({ dom, rows, ghost, at, press, move, wait, up }) => {
    at(dom.body);
    press(rows()[0], 200, 300);
    move(210, 310);
    wait(320);
    const g = ghost();
    assert.ok(g, 'armed');
    // The origin is what the slop is measured from; it is not where the
    // item is. Arming on it lifts the icon a dozen pixels from the
    // finger AND asks `dropIntent` what is under a point the player is
    // not touching.
    assert.equal(g.style.left, '210px', 'the icon is where the finger is');
    assert.equal(g.style.top, `${310 - 52}px`, 'a thumb\'s height above it, as AUDIT INV2 A3 set');
    up(210, 310);
  });
});

test('INV3: a flick down the list is still a scroll and never a drag', () => {
  // AUDIT INV2 A1's law, which this slice must not have loosened: on a
  // phone "off the panel" is a thin band down each side, which is
  // exactly where a flick ends, and a failed scroll that became a drop
  // threw the item on the floor with no undo.
  withPack(({ dom, e, rows, ghost, at, press, move, wait, up, dropped }) => {
    const before = e.items.length;
    at(dom.body);
    press(rows()[0], 200, 300);
    move(201, 288);   // still inside the hold
    move(202, 272);   // and now it is a pan
    wait(320);
    assert.equal(ghost(), null, 'a finger that meant the scroller carries nothing');
    up(202, 200);
    assert.equal(dropped.length, 0, 'and a flick that ends off the panel drops NOTHING');
    assert.equal(e.items.length, before, 'the pack is untouched');
  });
});

test('INV3: a finger that CREEPS down the list is still scrolling', () => {
  // The slop is measured from where the finger LANDED, not from where
  // it was a frame ago. Measured against the moving point, a finger
  // that crawls ten pixels at a time never breaks the hold and the
  // pane arms a drag on a list the browser is about to scroll - which
  // is the two of them fighting over one gesture.
  withPack(({ dom, rows, ghost, at, press, move, wait, up }) => {
    at(dom.body);
    press(rows()[0], 200, 300);
    move(200, 290);
    move(200, 280);
    move(200, 270);
    wait(320);
    assert.equal(ghost(), null, 'thirty pixels in three steps is a pan, however slowly it was made');
    up(200, 270);
  });
});

test('INV3: an ARMED touch drag holds the gesture, and an unarmed one lets it go', () => {
  // INV3's second finding, and it is not in this module's own state: a
  // `touch-action` rule that lands when the hold arms does NOT reach a
  // gesture already in flight - Chromium reads the effective value when
  // the SEQUENCE begins. Measured in tools/invDragProbe.mjs: with
  // `.draglock` on, the list scrolled and the pointer was cancelled
  // exactly as with no lock at all, so the ghost vanished mid-carry.
  // What holds a live gesture is preventDefault on a cancelable
  // touchmove.
  withPack(({ dom, rows, ghost, at, press, move, wait, up, touchmove }) => {
    at(dom.body);
    press(rows()[0], 200, 300);
    assert.equal(touchmove(), false, 'before the hold arms it refuses nothing - a flick must still scroll');
    move(205, 305);
    assert.equal(touchmove(), false, 'and a drifting finger is still a finger that might have meant the list');
    wait(320);
    assert.ok(ghost(), 'armed');
    assert.equal(touchmove(), true, 'now the gesture is the drag\'s, and the scroller does not get it');
    assert.equal(touchmove({ cancelable: false }), false,
      'a move the browser has already acted on is not refused - that is only a console warning');
    up(205, 305);
    assert.equal(touchmove(), false, 'and the release gives the gesture back');
  });

  // THE MOUSE ASKS FOR NOTHING. There is no touch gesture to hold and
  // a wheel over a live mouse drag is AUDIT INV2 A-F5's business.
  withPack(({ dom, rows, ghost, at, press, move, up, touchmove }) => {
    at(dom.body);
    press(rows()[0], 200, 300, 'mouse');
    move(210, 310);
    assert.ok(ghost(), 'a mouse drag is live');
    assert.equal(touchmove(), false, 'and it takes no touchmove away from anything');
    up(210, 310);
  });
});

test('INV3: the hold listener is registered NON-passive, and it is given back', () => {
  // A window `touchmove` listener is passive by default in Chromium, so
  // the preventDefault above is a no-op unless the registration says
  // otherwise. It is the whole fix, and it is invisible from inside the
  // handler - so it is read off the registration.
  withPack(({ dom, view, rows, at, press }) => {
    at(dom.body);
    press(rows()[0], 200, 300);
    assert.equal(dom.win.count('touchmove'), 1, 'the drag listens for touchmoves');
    const [opt] = dom.win.opts('touchmove');
    assert.equal(opt?.passive, false, 'NON-passive, or preventDefault is ignored and the fix is decoration');
    assert.equal(opt?.capture, true, 'and capturing, like every other listener this drag owns');
    view.unmount();
    assert.equal(dom.win.count('touchmove'), 0, 'and the pane going away takes it with it - every listener has an owner');
  });
});

test('INV3: and the browser taking the gesture ends it too', () => {
  // The other half of the same law. Past 16 CSS px of vertical travel
  // Chromium cancels the pointer itself and no further move arrives;
  // the pane must already be out, and must not arm on the timer that is
  // still ticking.
  withPack(({ dom, rows, ghost, at, press, wait, up }) => {
    at(dom.body);
    press(rows()[0], 200, 300);
    dom.win.fire('pointercancel', { pointerId: 3 });
    wait(320);
    assert.equal(ghost(), null, 'a cancelled pointer never arms the hold');
    up(200, 300);
    assert.equal(ghost(), null);
  });
});

test('INV3: mouse drag is immediate on movement and deterministic on hold', () => {
  // Keep the fast path: a normal desktop drag should still feel instant.
  withPack(({ dom, rows, ghost, at, press, move, up }) => {
    at(dom.body);
    press(rows()[0], 200, 300, 'mouse');
    move(202, 301);
    assert.equal(ghost(), null, 'three pixels of Manhattan is still a click');
    move(203, 302);
    assert.ok(ghost(), 'five pixels starts the drag immediately');
    up(203, 302);
  });

  // And add the path the UI promises: click, hold, then drag. A precise
  // mouse no longer depends on accidentally crossing the movement slop.
  withPack(({ dom, rows, ghost, at, press, move, wait, up }) => {
    at(dom.body);
    press(rows()[0], 200, 300, 'mouse');
    wait(MOUSE_HOLD_MS - 1);
    assert.equal(ghost(), null, 'a normal click is still a click');
    wait(1);
    assert.ok(ghost(), 'the held mouse deterministically picks the item up');
    move(213, 300);
    assert.ok(ghost(), 'and it stays carried once movement begins');
    up(213, 300);
  });
});

test('INV3: the body\'s panels take the same drifting finger', () => {
  // MAC-M2 A hung the gesture on the worn panels too, on the same hold,
  // and they carry the same `touch-action: pan-y`. One law, both
  // surfaces - two would drift.
  withPack(({ dom, e, panels, ghost, at, press, move, wait, up }) => {
    const dock = dom.doc.querySelectorAll('.pack-dock')[0];
    const panel = panels()[0];
    assert.ok(panel, 'a filled family on the map');
    at(dock);
    press(panel, 200, 300);
    move(209, 309);
    wait(320);
    const g = ghost();
    assert.ok(g, 'the hold on the BODY survives the same drift');
    assert.equal(g.querySelector('.ghostact')?.textContent, 'Take off', 'and says what the release will do');
    up(209, 309);
    assert.equal(isEquipped(e.items.find((it) => it.name === 'Cuirass')), false, 'the piece came off');
  }, { wear: 'Cuirass' });
});

test('INV3: a hold on a worn panel really is the worn panel\'s', () => {
  withPack(({ dom, e, panels, ghost, at, press, move, wait, up }) => {
    const panel = panels()[0];
    at(dom.body);            // out over the world: the cancel gesture
    press(panel, 200, 300);
    move(205, 306);
    wait(320);
    assert.ok(ghost(), 'armed');
    assert.equal(ghost().querySelector('.ghostact')?.textContent, '',
      'off the panel a worn piece promises nothing - MAC-M2\'s law, under a drifting finger');
    up(205, 306);
    assert.equal(isEquipped(e.items.find((it) => it.name === 'Cuirass')), true, 'and still wears it');
  }, { wear: 'Cuirass' });
});
