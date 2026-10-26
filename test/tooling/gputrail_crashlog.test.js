// GPU-TRAIL (2026-10-24, app/lib/rendererGone.cjs trailFrom/trailLines): the shell's half of the GPU's last samples -
// what the game's page hands over, kept field by field, and written to crash.log under a process gone's line. The pure
// halves are driven by execution; the shell's wiring is pinned by source (it runs in Electron), as RENDERER-GONE's is
// (fb1021b_renderergone.test.js). The page's half is test/render/gputrail.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GPU_TRAIL_KEEP, gpuSample } from '../../src/render/gpuTrail.js';

const require = createRequire(import.meta.url);
const G = require('../../app/lib/rendererGone.cjs');
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const AT = Date.UTC(2026, 9, 24, 7, 47);
const LIVE = { textures: 812, buffers: 2300, vaos: 1100, framebuffers: 24, programs: 140 };
/** A sample as the page mints it (src/render/gpuTrail.js gpuSample). */
const minted = (at, extra = {}) => gpuSample({ at, upMs: 1_234_000, live: LIVE, frame: { fps: 60, meanMs: 16.7, worstMs: 33, draws: 430, binds: 900, viewDraws: 0, shadowDraws: 120, hitch: { ms: 121 } }, heap: 512 * 1048576, hidden: false, lost: false, ...extra });

test('GPU-TRAIL the shell keeps as many samples as the page rings (mutant: the shell\'s keep apart from the page\'s)', () => {
  assert.equal(G.TRAIL_KEEP, GPU_TRAIL_KEEP);
});

test('GPU-TRAIL crash.log\'s lines: the GPU\'s name, then a sample a line under the stop\'s own, oldest first; a number the page did not have is "-", a flag is written when set (mutants: a field\'s label dropped; the flags always written; the order turned)', () => {
  const trail = G.trailFrom({ gpu: 'ANGLE (AMD, Radeon RX 7800 XT)', samples: [minted(AT), gpuSample({ at: AT + 30_000, upMs: 1_264_000, live: LIVE, frame: null, heap: null, hidden: true, lost: true })] });
  assert.equal(G.trailLines(trail),
    '  gpu ANGLE (AMD, Radeon RX 7800 XT)\n'
    + '  2026-10-24T07:47:00.000Z up=1234s tex=812 buf=2300 vao=1100 fbo=24 prog=140 fps=60 ms=16.7 worst=33 hitch=121 draws=430 binds=900 view=0 shadow=120 heap=512MB\n'
    + '  2026-10-24T07:47:30.000Z up=1264s tex=812 buf=2300 vao=1100 fbo=24 prog=140 fps=- ms=- worst=- hitch=- draws=- binds=- view=- shadow=- heap=- hidden lost\n');
  assert.equal(G.trailLines(null), '', 'no trail, no lines');
  assert.equal(G.trailLines({ gpu: null, samples: [minted(AT)] }).split('\n')[0], '  gpu unknown');
  const log = G.logWith('', G.goneLine('renderer', { reason: 'oom', exitCode: -536870904 }, AT + 31_000) + G.trailLines(trail));
  assert.match(log, /^2026-10-24T07:47:31\.000Z renderer oom exitCode=-536870904\n {2}gpu ANGLE[^\n]*\n {2}2026-10-24T07:47:00\.000Z [^\n]*\n {2}2026-10-24T07:47:30\.000Z [^\n]*\n$/);
});

test('GPU-TRAIL what the page hands is read field by field: the newest TRAIL_KEEP samples, known numbers and true flags alone, a time a Date can print, a short one-line GPU name - so no line it makes outgrows crash.log\'s cap (mutants: the oldest kept; a string number kept; an unknown field kept; a time past a Date\'s kept; the name uncapped)', () => {
  for (const raw of [null, undefined, 'x', 42, {}, { samples: 'no' }, { samples: [] }, { samples: [{}, { at: 'now' }, { at: Infinity }, { at: 9e15 }] }]) assert.equal(G.trailFrom(raw), null, JSON.stringify(raw) ?? String(raw));
  const many = Array.from({ length: 50 }, (_, i) => minted(AT + i * 30_000));
  const kept = G.trailFrom({ samples: many });
  assert.equal(kept.samples.length, G.TRAIL_KEEP);
  assert.deepEqual(kept.samples.map((s) => s.at), many.slice(-G.TRAIL_KEEP).map((s) => s.at), 'the newest, oldest first');
  assert.equal(kept.gpu, null);
  const odd = G.trailFrom({ gpu: `AMD\nRadeon\t${'x'.repeat(500)}`, samples: [{ ...minted(AT), textures: '812', fps: NaN, draws: 1e400, lost: 'yes', hidden: 1, script: 'alert(1)', evil: 'x'.repeat(70_000) }] });
  const s = odd.samples[0];
  assert.deepEqual([s.textures, s.fps, s.draws, s.lost, s.hidden, s.buffers], [null, null, null, false, false, 2300]);
  assert.equal('script' in s || 'evil' in s, false, 'an unknown field is not kept');
  assert.ok(odd.gpu.startsWith('AMD Radeon x') && odd.gpu.length === 160, `one line, capped: ${odd.gpu.length}`);
  const lines = G.trailLines(odd).split('\n');
  assert.ok(lines.every((l) => l.length < 400), 'every line short');
  const huge = G.trailFrom({ gpu: 'y'.repeat(1e6), samples: Array.from({ length: 1e4 }, (_, i) => ({ ...minted(AT + i), textures: Number.MAX_VALUE })) });
  const log = G.logWith('', G.goneLine('renderer', { reason: 'crashed', exitCode: 1 }, AT) + G.trailLines(huge));
  assert.ok(log.length > 0 && log.length < G.CRASH_LOG_MAX && log.startsWith('2026-10-24T07:47:00.000Z renderer crashed'), 'the stop\'s own line kept with its trail');
});

test('GPU-TRAIL by source: the page hands each sample over without waiting, the shell keeps it from the game\'s window alone, every process gone writes it under its line, and a stopped page\'s trail is let go (mutants: the sender unchecked; the trail kept raw; the trail never written; a dead page\'s trail written again)', () => {
  const preload = rd('app/preload.cjs');
  assert.match(preload, /gpuTrail: \(trail\) => ipcRenderer\.send\('dagger:gpu-trail', trail\),/, 'not sendSync: the renderer never waits on it');
  const main = rd('app/main.cjs');
  assert.match(main, /const \{ trailFrom, trailLines \} = require\('\.\/lib\/rendererGone\.cjs'\);/);
  assert.match(main, /ipcMain\.on\('dagger:gpu-trail', \(e, trail\) => \{\n {2}if \(gameWindow && !gameWindow\.isDestroyed\(\) && e\.sender === gameWindow\.webContents\) gpuTrail = trailFrom\(trail\);\n\}\);/);
  assert.match(main, /fs\.writeFileSync\(file, logWith\(had, goneLine\(what, details, Date\.now\(\)\) \+ trailLines\(gpuTrail\)\)\);/);
  assert.match(main, /\n {2}if \(what === 'renderer'\) gpuTrail = null;\n\}/);
  assert.equal((main.match(/(?<!let )\bgpuTrail = /g) ?? []).length, 2, 'kept by the handler, let go by a stopped page - nothing else writes it');
  // RENDERER-GONE's two doors still write through logGone, the renderer's and the GPU's
  assert.match(main, /if \(details\?\.reason !== 'clean-exit'\) logGone\('renderer', details\);/);
  assert.match(main, /app\.on\('child-process-gone', \(_e, details\) => \{ if \(details\?\.type === 'GPU'\) logGone\('gpu', details\); \}\);/);
});
