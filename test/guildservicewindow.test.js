import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GUILD_RECTS, PANEL_W, PANEL_H, PANEL_X, PANEL_Y, SERVICE_LABEL_OFFSET_Y,
  GuildServiceWindow,
} from '../src/ui/guildServiceWindow.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';

// U23 - DaggerfallGuildServicePopupWindow. THE NATIVE-WINDOW RULE: the
// geometry pins are DFU literals, not the port's own arithmetic.

test('U23: the panel is 130x51, centred and middled on the 320x200 screen', () => {
  // mainPanel.Size (:124), and the size of both GILD IMGs.
  assert.equal(PANEL_W, 130);
  assert.equal(PANEL_H, 51);
  // HorizontalAlignment.Center + VerticalAlignment.Middle (:121-122)
  // make BaseScreenComponent ignore Position entirely, so the declared
  // `Position = new Vector2(0, 50)` (:123) never applies. Pinning 95/75
  // rather than 0/50 is the whole point of this test.
  assert.equal(PANEL_X, 95);
  assert.equal(PANEL_Y, 75);
  assert.notEqual(PANEL_Y, 50);
});

test('U23: the four button rects are the #region UI Rects literals (:36-39)', () => {
  assert.deepEqual(GUILD_RECTS, {
    join: [5, 5, 120, 7],
    talk: [5, 14, 120, 7],
    service: [5, 23, 120, 7],
    exit: [44, 33, 43, 15],
  });
  // the three rows stack 9 apart and do not overlap
  assert.equal(GUILD_RECTS.talk[1] - GUILD_RECTS.join[1], 9);
  assert.equal(GUILD_RECTS.service[1] - GUILD_RECTS.talk[1], 9);
  assert.equal(SERVICE_LABEL_OFFSET_Y, 1);   // serviceLabel.Position (:135)
});

// A window with no OnPush steps and every hook counted.
function makeWindow(over = {}) {
  const log = [];
  const w = new GuildServiceWindow({
    member: () => false,
    service: () => 'Training',
    rows: (id) => [{ text: `rsc:${id}`, center: true }],
    steps: () => [],
    onJoin: () => { log.push('join'); return null; },
    onTalk: () => log.push('talk'),
    onService: () => { log.push('service'); return { rows: ['nope'] }; },
    onClose: () => log.push('close'),
    ...over,
  });
  return { w, log };
}

/** A point INSIDE a panel-relative rect, in native screen coords. */
const at = (rect, dx = 1, dy = 1) => [PANEL_X + rect[0] + dx, PANEL_Y + rect[1] + dy];

test('U23: each button rect routes to its own handler', () => {
  const { w, log } = makeWindow();
  assert.equal(w.click(...at(GUILD_RECTS.join)), true);
  assert.deepEqual(log, ['join', 'close']);   // onJoin returning null closes, as DFU's does

  const b = makeWindow();
  b.w.click(...at(GUILD_RECTS.talk));
  assert.deepEqual(b.log, ['talk', 'close']);

  const c = makeWindow();
  c.w.click(...at(GUILD_RECTS.service));
  assert.deepEqual(c.log, ['service']);   // a refusal keeps the popup open
  assert.equal(c.w.done, false);

  const d = makeWindow();
  d.w.click(...at(GUILD_RECTS.exit));
  assert.deepEqual(d.log, ['close']);
  assert.equal(d.w.done, true);
});

test('U23: a MEMBER has no join button at all - the rect is dead, not just unpainted', () => {
  // Setup only ADDS the join button when !member (:127-132), so a click
  // where its row would be must not join. This is the pin that fails if
  // the window ever draws the member IMG but keeps the non-member rects.
  const { w, log } = makeWindow({ member: () => true });
  assert.equal(w.click(...at(GUILD_RECTS.join)), false);
  assert.deepEqual(log, []);
  assert.equal(w.done, false);
  // and the keyboard accelerator is gated the same way
  w.input('KeyJ');
  assert.deepEqual(log, []);
});

test('U23: a click outside every rect is not consumed', () => {
  const { w } = makeWindow();
  assert.equal(w.click(0, 0), false);
  assert.equal(w.click(PANEL_X + 200, PANEL_Y + 5), false);
});

test('U23: OnPush steps stack in front of the buttons and clear one click each', () => {
  const cured = [];
  const { w, log } = makeWindow({
    steps: () => [
      { textId: 350, clickAnywhere: true },
      { textId: 403, buttons: 'YesNo', onYes: () => cured.push('yes') },
    ],
  });
  assert.equal(w.top.textId, 350);
  // the buttons underneath are unreachable while a box stands
  w.click(...at(GUILD_RECTS.exit));
  assert.equal(w.done, false, 'the box ate the click');
  assert.equal(w.top.textId, 403);
  // a YesNo box does NOT clear on a stray click
  w.click(0, 0);
  assert.equal(w.top?.textId, 403);
  w.input('KeyY');
  assert.deepEqual(cured, ['yes']);
  assert.equal(w.top, null);
  // now the exit works
  w.click(...at(GUILD_RECTS.exit));
  assert.deepEqual(log, ['close']);
});

test('U23: the YesNo box\'s No branch does not run onYes', () => {
  const cured = [];
  const { w } = makeWindow({
    steps: () => [{ textId: 403, buttons: 'YesNo', onYes: () => cured.push('yes') }],
  });
  w.input('KeyN');
  assert.deepEqual(cured, []);
  assert.equal(w.top, null);
  assert.equal(MB_BUTTONS.Yes, 3);   // BUTTONS.RCI record indices, unchanged
  assert.equal(MB_BUTTONS.No, 4);
});

test('U23: a join that offers a YesNo closes the popup with the box, as DFU does', () => {
  // JoinButton_OnMouseClick calls CloseWindow() BEFORE showing the
  // eligibility box, so the popup is gone either way the player answers.
  let joined = 0;
  const { w } = makeWindow({
    onJoin: () => ({ rows: ['eligible?'], buttons: 'YesNo', onYes: () => { joined++; } }),
  });
  w.click(...at(GUILD_RECTS.join));
  assert.equal(w.done, false, 'the box is still up');
  assert.equal(w.top.buttons, 'YesNo');
  w.input('KeyY');
  assert.equal(joined, 1);
  assert.equal(w.done, true);
});
