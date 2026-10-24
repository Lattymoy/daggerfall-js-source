// AUDIT INSTALL (lane 5 #1, 2026-09-29): THE SHELL'S QUESTIONS, AND WHICH
// ANSWER DOES WHAT.
//
// Each of these asks the player before something they cannot take back:
// leaving a game with progress at risk (UNLOAD-ASK), restarting it into an
// update, fetching an installer. The audit found nothing held the ANSWERS:
// "Not now" wired to restart, Escape bound to Restart, Enter bound to
// Leave, or the two labels swapped, each passed every suite and the probe.
// So the buttons, the default (what Enter presses) and the cancel (what
// Escape and the window's close press) are data here, the answer that
// DOES the thing is one predicate beside them, and
// test/tooling/audit_install.test.js holds both: the safe answer is always the
// cancel, and on UNLOAD-ASK the default too - Enter must not throw an
// evening away.
//
// Pure, no Electron: app/main.cjs passes these to dialog.showMessageBox*.
'use strict';

/** UNLOAD-ASK: the browser's "Leave site?", which Electron never draws. */
const UNLOAD_ASK = Object.freeze({
  type: 'question',
  buttons: Object.freeze(['Leave', 'Stay']),
  defaultId: 1,
  cancelId: 1,
  message: 'Leave the game?',
  detail: 'Progress since your last save will be lost.',
});
/** The answer to UNLOAD_ASK that leaves. */
const leaves = (choice) => choice === 0;

/** File > Restart to Update. The player chose it from the menu, so Enter
 *  restarts - but Escape, or closing the box, never does. */
const restartAsk = (version) => ({
  type: 'question',
  message: `Restart to install v${version}?`,
  detail: 'DFO Online closes, installs the update and reopens by itself. Save your game first - progress since your last save is lost.',
  buttons: ['Restart', 'Not now'],
  defaultId: 0,
  cancelId: 1,
});

/** The launcher's Reinstall. */
const reinstallAsk = () => ({
  type: 'question',
  message: 'Reinstall DFO Online?',
  detail: 'The newest installer downloads in your browser. Install it over this copy - your saves, settings and game files stay where they are.',
  buttons: ['Download', 'Cancel'],
  defaultId: 0,
  cancelId: 1,
});

/** Restart to Update that the installer did not take. */
const installFailedAsk = () => ({
  type: 'warning',
  message: 'The update could not be installed',
  detail: 'DFO Online stays open on this version. Get the installer and run it yourself - your saves, settings and game files stay where they are.',
  buttons: ['Get the installer', 'Not now'],
  defaultId: 0,
  cancelId: 1,
});

/** The answer to restartAsk, reinstallAsk and installFailedAsk that does
 *  the thing asked about: their first button, never their cancel. */
const goesAhead = (response) => response === 0;

module.exports = { UNLOAD_ASK, leaves, restartAsk, reinstallAsk, installFailedAsk, goesAhead };
