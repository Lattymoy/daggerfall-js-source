// STATUS-LIVE (2026-09-22, kurkku via Mac: "minor thing: would be nice
// if the info panel that comes up when you press i didn't pause the
// game, that way you could quickly check your status while walking
// around"): THE STATUS READOUT, AND WHY IT IS THE ONE BOX THAT DOES
// NOT STOP THE WORLD.
//
// WHAT WAS ACTUALLY WRONG. DFU's Status action raises
// DisplayStatusInfo (DaggerfallUI.cs:1615-1628): a DaggerfallMessageBox
// carrying record 22, chained by AddNextMessageBox into
// CreateHealthStatusBox. A message box is a window, a window raises
// `PauseWhileOpen` (UserInterfaceWindow.cs:141), and the game stops -
// which is RIGHT for DFU, because the parchment lands in the middle of
// the screen and there is nothing to see past it. ENH-NOTICE1 moved
// that box to a panel at the EDGE of the screen and kept the modality,
// so the port ended up with a readout you can see the world behind and
// still cannot move under. The pause was a leftover of the classic
// PRESENTATION, not a law of the thing being shown.
//
// SO: a readout is the player's (AUDIT-WH R8, the law the hover plaque
// was built on). This box declares `pauseWhileOpen: false` - DFU's own
// field, which ui/windowStack.js has read off every window in every
// host's slot since ROAD-B - and the four hosts' pause latches answer
// false for it. The world runs; the panel stands at the edge; the
// player walks.
//
// THE THREE THINGS THAT FOLLOW FROM NOT PAUSING.
//   1. NO CHAIN. AddNextMessageBox advances on a dismissal, and a box
//      nothing routes a key to can never be dismissed page by page.
//      The three pages - the record-22 status text, the health box,
//      and SURV5's survival advice - are ONE page here, blank-line
//      separated, which is what "quickly check your status" wants
//      anyway.
//   2. NO ClickAnywhereToClose. A click while the world runs is a
//      swing, not a dismissal; `click()` declines, and the panel's
//      caption names the keys that really close it.
//   3. IT IS A TOGGLE, AND IT YIELDS. The Status key opens it and the
//      Status key closes it; Escape closes it and does nothing else;
//      and any action that RAISES A WINDOW takes the slot it is
//      standing in, so the readout leaves first. That last rule lives
//      in systems/statusReadout.js with the live box - see its header
//      for why it is a leaf - and without it a dungeon's own
//      free-slot guards would simply refuse the character sheet while
//      a readout stood in the slot: a key that silently does nothing,
//      which is the drawn-door-that-opens-nothing defect this port has
//      paid for four times.
//
// AND ONE COMPOSER, NOT FOUR. The chain was written out by hand in
// world.js, worldModes' interior arm, dungeonContext and exterior.js -
// four copies of the same three lines, which is four places to forget
// when the law moves. It moved today.

import { ActionTextBox } from './actionText.js';
import { statusInfoRows, healthStatusRows } from '../systems/healthStatus.js';
import { survivalStatusRows } from '../systems/survival/status.js';
import { statusReadoutHint, holdStatusReadout, forgetStatusReadout, closeStatusReadout } from '../systems/statusReadout.js';

/** DisplayStatusInfo's box, minus the pause and minus the chain. */
export class StatusReadout extends ActionTextBox {
  constructor(lines) {
    super(lines, { pauseWhileOpen: false, noticeHint: statusReadoutHint() });
  }

  input(...a) { super.input(...a); if (this.done) forgetStatusReadout(this); }
  dispose() { super.dispose(); forgetStatusReadout(this); }

  /** A click is the world's while the world is running. Answering
   *  false leaves the press to the host, which is what makes swinging
   *  with the readout up work at all. */
  click() { return false; }

  /** UserInterfaceManager.RemoveWindow's OnReturn (:190-216): a window
   *  that was pushed OVER this one has just popped and this is the top
   *  again. A readout you left to open something else is stale by the
   *  time you come back - and, worse, the stack's pause latch only
   *  falls when the stack DRAINS (ui/windowStack.js's `removeWindow`),
   *  so a non-pausing window left underneath would hold the game
   *  paused with nothing on the screen to explain why. It closes
   *  itself. */
  onReturn() { this.input(); }
}

/**
 * DisplayStatusInfo's rows, all three pages at once.
 *
 * `lines(id)` is the host's TEXT.RSC reader (the two shapes
 * statusInfoRows' own note describes - plain strings underground,
 * `{ text, center }` records elsewhere); `survival` is SURV5's
 * `{ minutes, vampire, endurance }`, or null when Climates & Calories
 * is off.
 */
export function statusReadoutRows({ lines, macroContext = null, entity, survival = null }) {
  const rows = [
    ...statusInfoRows(lines, macroContext),
    '',
    ...healthStatusRows(entity, lines),
  ];
  if (survival) rows.push('', ...survivalStatusRows(entity, survival.minutes, survival));
  return rows;
}

/**
 * Open the readout in a host's slot. `mount` puts the box there,
 * `drop` takes it back out - the host's OWN two doors, because the
 * four slots are not the same object and only the host knows which of
 * its close paths is the identity-guarded one.
 *
 * A second call while one is up CLOSES it (the toggle) and answers
 * false, so the caller's ladder stops - which is exactly what the
 * Status key wants, and what a host's "is the slot free" guard would
 * otherwise turn into a dead key.
 */
export function toggleStatusReadout({ mount, drop = null, ...rows }) {
  if (closeStatusReadout()) return false;
  const box = new StatusReadout(statusReadoutRows(rows));
  holdStatusReadout(box, drop);
  mount(box);
  return true;
}
