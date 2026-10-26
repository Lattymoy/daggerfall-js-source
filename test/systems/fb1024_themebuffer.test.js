// THEME-BUFFER (FB1024, 2026-10-24, #bug-reports: "Audio cutting out. During boss fights, or menu music" - "If you have
// SteelSeries headphones try disabling steelseriesGG app ... there is still audio cutting out from time to time"): the menu
// theme's own context plays the score alone, so it asks for the browser's largest buffer ('playback'), never the click-
// fast 'interactive' one a slow audio thread under-runs. Record: bible/01-Overview/bugs/Field-Bugs-2026-10-24.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { IntroTheme, audibleContextTime } from '../../src/systems/introTheme.js';

test('THEME-BUFFER: the theme\'s context is built for playback, and the film still reads the audible clock', () => {
  const made = [];
  const had = globalThis.AudioContext;
  globalThis.AudioContext = class { constructor(o) { made.push(o); } };
  try {
    const theme = new IntroTheme({ subscribe: () => () => {} });
    theme.makeContext();
  } finally {
    if (had === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = had;
  }
  assert.deepEqual(made, [{ latencyHint: 'playback' }]);
  // a longer output latency is subtracted, never heard as the film running ahead of the score
  assert.equal(audibleContextTime({ currentTime: 10, outputLatency: 0.12 }, 0), 10 - 0.12);
});
