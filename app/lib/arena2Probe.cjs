// AUDIT INSTALL round 2 (lane D, 2026-09-29): EVERY LOOK AT THE PLAYER'S
// DISKS, IN A PROCESS OF ITS OWN.
//
// The shell forks this as an Electron utility process for each question it
// has about the player's Daggerfall files (app/main.cjs askArena2): the
// saved folder at launch, a folder the player picked, a found one taken,
// the first run's search. Round 1 moved only the search off the main
// process, into a worker thread - and the saved folder, every pick and
// every "Use these files" stayed on it, so a saved folder on a share that
// was down kept the launcher's window off the screen for as long as the
// share was (a hard mount that never answers: no window, ever). A worker
// thread was no answer either: one stuck in the kernel cannot be
// terminated, and the app could not quit while it was stuck (measured: 20
// s after the launcher closed, still running). A PROCESS can be let go: the
// shell kills it at its deadline, and a killed one holds nothing - the app
// quit at once with its probe stuck on a hung share (measured, Electron 42).
//
// One question per process: the answer (arena2Detect.cjs answerArena2), a
// search's finds streamed ahead of it, then the shell kills it. It loads
// from inside app.asar like any of the shell's own files.
'use strict';

const { answerArena2 } = require('./arena2Detect.cjs');

process.parentPort.once('message', ({ data }) => {
  let answer;
  try {
    answer = answerArena2(data, (found) => process.parentPort.postMessage({ found }));
  } catch {
    answer = { failed: true };
  }
  process.parentPort.postMessage({ answer });
});
