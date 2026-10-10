// FIELD BUGS 2026-10-10 (bible/01-Overview/Field-Bugs-2026-10-10.md), SPAM-TAKE - the Discord's "Bounty Board: Click
// order": "if you spam click accept it just accepts the 4 in order", where the card stayed on the notice just taken and
// put Give up where Take had stood, so a run of presses took and gave back the top notice. Driven on the real host's
// board (scenes/bountyHost.js openBoard's deps - the shape the producer mints) mounted on the minimal DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byClass } from './chargenDom.mjs';
import { createBountyHost } from '../src/scenes/bountyHost.js';
import { mountBountyBoard, nextOpenNotice } from '../src/ui/bountyWindow.js';
import { BOUNTY_CSS } from '../src/ui/enhancedPlusStyle.js';
import { BOUNTY_ACTIVE_MAX } from '../src/systems/bountyBoard.js';

const TOWN = { px: 300, py: 200, name: 'Daggerfall' };

/** The host on day 900 at level 5, its board opened, and the window mounted on the deps it handed over. */
function boardOf({ inParty = false } = {}) {
  let deps = null;
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 5, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'Daggerfall',
    siteOk: () => true, playerPixel: () => null, canStand: () => true,
    standPack: () => ({ foes: Promise.resolve([]), dx: 0, dz: 80 }), foePool: () => [], say: () => {}, showNotice: () => true,
    openBoardWindow: (d) => { deps = d; }, rolls: () => 0.3,
    social: inParty ? () => ({ acct: 'a-1', inParty: true, mates: [] }) : null,
  });
  host.openBoard(TOWN);
  const el = document.createElement('div');
  const view = mountBountyBoard(el, deps);
  return { host, deps, el, view };
}
const cardTitle = (el) => byClass(el, 'bounty-card')[0]?.children[0]?.textContent;

test('SPAM-TAKE: Take pressed again and again takes the four notices in order, top to bottom, the press\'s focus carried to the next', () => {
  const { host, deps, el, view } = boardOf();
  const rows = deps.rows();
  assert.equal(rows.length, BOUNTY_ACTIVE_MAX, 'four notices, and hands for four');
  assert.ok(rows.every((r) => r.state === 'open'));
  const order = rows.map((r) => r.posting.slotKey);
  for (let k = 0; k < order.length; k++) {
    assert.equal(cardTitle(el), rows[k].posting.title, `the card stands on notice ${k}`);
    const take = byClass(el, 'bounty-take')[0];
    take.focus();
    take.click();
    if (k < order.length - 1) assert.equal(document.activeElement, byClass(el, 'bounty-take')[0], 'the next notice\'s Take has the focus - Enter again takes it');
  }
  assert.deepEqual(host.held().map((h) => h.posting.slotKey), order, 'all four, in the board\'s order');
  assert.deepEqual(byClass(el, 'bounty-take'), [], 'nothing left to take');
  assert.equal(cardTitle(el), rows.at(-1).posting.title, 'the card stays on the last one taken');
  view.unmount();
});

test('SPAM-TAKE: Give up asks twice - a stray press arms it, and a pick elsewhere disarms it', () => {
  const { host, el, view } = boardOf();
  byClass(el, 'bounty-take')[0].click();
  assert.equal(host.held().length, 1);
  byClass(el, 'bounty-post-i0')[0].click();
  const give = () => byClass(el, 'bounty-drop')[0];
  assert.equal(give().textContent, 'Give up');
  give().click();
  assert.equal(host.held().length, 1, 'the first press gives nothing up');
  assert.equal(give().textContent, 'Click again to give up');
  view.repaint();
  assert.equal(give().textContent, 'Click again to give up', 'armed through the five-second repaint');
  byClass(el, 'bounty-post-i1')[0].click();
  byClass(el, 'bounty-post-i0')[0].click();
  assert.equal(give().textContent, 'Give up', 'another notice picked: disarmed');
  give().click();
  give().click();
  assert.equal(host.held().length, 0, 'the second press gives it up');
  assert.ok(byClass(el, 'bounty-take')[0], 'and the notice is open again');
  view.unmount();
});

test('SPAM-TAKE: Give up stands at the card\'s left, first in the row, never where Take stood (the row is right-aligned)', () => {
  const { el, view } = boardOf({ inParty: true });
  byClass(el, 'bounty-take')[0].click();
  byClass(el, 'bounty-post-i0')[0].click();
  const acts = byClass(el, 'bounty-acts')[0];
  assert.deepEqual(acts.children.map((b) => b.className), ['act bounty-drop', 'act bounty-share'], 'Give up first, Share at the right');
  assert.match(BOUNTY_CSS, /\.bounty-acts \{ display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; \}/, 'Take stands at the row\'s right');
  assert.match(BOUNTY_CSS, /\.bounty-acts \.bounty-drop \{ margin-right: auto; \}/, 'Give up is pushed to its left');
  view.unmount();
});

test('SPAM-TAKE: the next open notice - below, around to the top, past a claimed or held one; none open, the card stays', () => {
  const R = (...s) => s.map((state) => ({ state }));
  assert.equal(nextOpenNotice(R('held', 'open', 'open', 'open'), 0), 1);
  assert.equal(nextOpenNotice(R('open', 'held', 'held', 'held'), 3), 0, 'around to the top');
  assert.equal(nextOpenNotice(R('open', 'held', 'held', 'held'), 1), 0);
  assert.equal(nextOpenNotice(R('held', 'paid', 'open', 'held'), 0), 2, 'past a claimed one');
  assert.equal(nextOpenNotice(R('held', 'full', 'full', 'full'), 0), 0, 'hands full: the card stays');
  assert.equal(nextOpenNotice(R('open'), 0), 0, 'itself is never "next"');
  assert.equal(nextOpenNotice([], 0), 0);
});
