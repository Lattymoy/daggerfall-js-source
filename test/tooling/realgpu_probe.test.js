// REAL-GPU PROBE (tools/realGpu/): THE PROBE JUDGES ITS OWN RUNS, AND NOTHING RUNS IT ON PUSH.
//
// A probe that lies is worse than none (probehygiene.test.js's lesson). This one reads a real GPU, and a run can look
// measured and not be: a machine whose browser fell back to a software renderer reports SwiftShader's compile times
// as a GPU's; a covered window draws no frame; a profile that could not be aligned to the frames leaves every long
// frame unattributed. judgeRun names each, and the probe reports no measurement (exit 1). The readers are held to
// small profiles and pictures whose answers are known.
//
// The owner: "definitely don't run this in ci on push". It needs a GPU, a visible window and minutes per phase; the
// last test holds that no workflow and no npm script runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { judgeRun, analysePhase, bootFigures, frameFigures } from '../../tools/realGpu/realGpuProbe.mjs';
import { compileWaits } from '../../tools/realGpu/compileWaits.mjs';
import { profileAttribution } from '../../tools/realGpu/profileAttr.mjs';
import { pngDiff } from '../../tools/realGpu/pngDiff.mjs';
import { pngMask } from '../../tools/realGpu/pngMask.mjs';

const GPU = { renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 Direct3D11 vs_5_0 ps_5_0, D3D11)', parallelCompile: true };
const measuredBoot = { frames: 5000, aligned: true, firstFrameS: 37.9 };

test('REAL-GPU: a measured run passes its own judgement', () => {
  assert.deepEqual(judgeRun({ backend: GPU, phases: { boot: measuredBoot, settled: { frames: 2500, aligned: false } }, errors: [] }), []);
});

test('REAL-GPU: the run judges itself - a software renderer, a phase that drew nothing, an unaligned or frameless boot, a page that threw', () => {
  const judge = (over) => judgeRun({ backend: GPU, phases: { boot: measuredBoot }, errors: [], ...over });
  for (const renderer of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)', 'llvmpipe (LLVM 15.0.7, 256 bits)']) {
    assert.match(judge({ backend: { renderer, parallelCompile: true } }).join(), /software renderer/, renderer);
  }
  assert.match(judge({ backend: null }).join(), /no backend/);
  assert.match(judge({ phases: { boot: measuredBoot, out: { frames: 0, aligned: false } } }).join(), /out: no frame drawn/);
  assert.match(judge({ phases: { boot: { ...measuredBoot, aligned: false } } }).join(), /boot: the profile could not be aligned/);
  assert.match(judge({ phases: { boot2: { ...measuredBoot, firstFrameS: null } } }).join(), /boot2: no world frame/);
  assert.match(judge({ errors: ['TypeError: x is undefined'] }).join(), /the page threw 1 time/);
  assert.deepEqual(judge({ phases: { settled: { frames: 10, aligned: false } } }), [], 'a phase after the boot needs no alignment of its own');
});

/** A profile of three nodes - root, frame, buildProgram - and the marker the probe aligns by, sampled every 10 ms. */
function profileOf(sampleNames) {
  const fn = (id, functionName, children = []) => ({ id, callFrame: { functionName, url: functionName.startsWith('(') ? '' : 'http://localhost/src/fixture/linkFixture.js', lineNumber: 10 * id }, children });
  const nodes = [fn(1, '(root)', [2, 3, 5, 6]), fn(2, 'frame', [4]), fn(3, '(idle)'), fn(4, 'buildProgram'), fn(5, '__realGpuAlign'), fn(6, '(garbage collector)')];
  const idOf = { root: 1, frame: 2, idle: 3, build: 4, align: 5, gc: 6 };
  return { nodes, samples: sampleNames.map((n) => idOf[n]), timeDeltas: sampleNames.map(() => 10000), startTime: 0 };
}

test('REAL-GPU: a long frame is attributed to the code that ran inside it, on the page clock the marker aligns', () => {
  // samples at 10..100 ms of the profile's clock: the marker at 10 ms, idle, then 50 ms in a build, then idle
  const profile = profileOf(['align', 'idle', 'idle', 'build', 'build', 'build', 'build', 'build', 'idle', 'idle']);
  // the marker ran at page time 1000, so page time = profile time + 990; the long frame ended at page 1080 after 50 ms
  const phase = analysePhase(profile, 1000, [[1030, 8], [1080, 50.5], [1090, 8]], 40);
  assert.equal(phase.aligned, true);
  assert.equal(phase.hitches.length, 1);
  assert.equal(phase.hitches[0].inclusive[0][0], 'buildProgram src/fixture/linkFixture.js:41');
  assert.ok(phase.hitches[0].kinds.script >= 40, 'its time is the build\'s');
  assert.ok(phase.share.idle > 0 && phase.share.script > 0);
  const unaligned = analysePhase(profileOf(['idle', 'build']), null, [[100, 500]], 40);
  assert.equal(unaligned.aligned, false);
  assert.deepEqual(unaligned.hitches, [], 'no attribution it cannot place');
});

test('REAL-GPU: the frame figures and the boot\'s own - the first world frame, the slow frames of play, the link waits by caller', () => {
  const figures = frameFigures([8, 8, 8, 120, 300, 8]);
  assert.deepEqual([figures.frames, figures.over50, figures.over100, figures.over250, figures.frameMs.max], [6, 2, 2, 1, 300]);
  const boot = bootFigures({
    // a 20 s freeze before the first world frame at 30 s; two slow frames in play, one past the 25 s window
    gapsRaw: [[25000, 20000], [30000, 16], [31000, 150], [40000, 200], [60000, 400]],
    firstFrame: 30000,
    compileLog: [
      { fn: 'getProgramParameter', ms: 1500, at: 6000, by: ['link fixture/linkFixture.js:45:6', 'buildProgram fixture/linkFixture.js:128:36', 'new SkyFixture fixture/skyFixture.js:1482:25'] },
      { fn: 'getProgramParameter', ms: 500, at: 31000, by: ['buildProgram fixture/linkFixture.js:128:36', 'new FoeFixture fixture/foeFixture.js:183:20'] },
    ],
  });
  assert.equal(boot.firstFrameS, 30);
  assert.equal(boot.longestS, 20);
  assert.equal(boot.over100Play, 2);
  assert.equal(boot.sumOver100PlayS, 0.35);
  assert.deepEqual(boot.glWaitS, { total: 2, beforeFirstFrame: 1.5, afterFirstFrame: 0.5 });
  assert.match(boot.byCaller[0][1], /new SkyFixture/);
});

test('REAL-GPU: the readers - time inside buildProgram by caller, a whole phase by function', () => {
  const profile = profileOf(['frame', 'build', 'build', 'idle', 'gc']);
  const waits = compileWaits(profile);
  assert.ok(Math.abs(waits.total - 20) < 1e-6, `two samples of 10 ms (${waits.total})`);
  assert.match(waits.byCaller[0][0], /^frame /);
  const attribution = profileAttribution(profile);
  assert.ok(Math.abs(attribution.busy - 30) < 1e-6, 'idle left out, and the last sample, whose end is unknown, weighs nothing');
  assert.equal(attribution.inclusive.find(([k]) => k.startsWith('frame '))[1], 30);
});

test('REAL-GPU: two pictures compared, and the mask marks only what differs', () => {
  const picture = (fill) => {
    const png = new PNG({ width: 8, height: 8 });
    for (let i = 0; i < png.data.length; i += 4) png.data.set([fill, fill, fill, 255], i);
    return png;
  };
  const a = picture(100);
  const b = picture(100);
  b.data.set([200, 100, 100, 255], 0);   // one pixel of 64, in the top eighth
  const diff = pngDiff(a, b, 8);
  assert.equal(diff.overPct, 1.563);
  assert.equal(diff.bigPct, 1.563);
  assert.equal(diff.bandsPct[0], 12.5);
  assert.equal(pngDiff(a, picture(100)).overPct, 0);
  const mask = pngMask(a, b, 8);
  assert.deepEqual([...mask.data.slice(0, 4)], [255, 40, 40, 255], 'the differing pixel red');
  assert.deepEqual([...mask.data.slice(4, 8)], [25, 25, 25, 255], 'the rest the first picture, darkened');
  assert.throws(() => pngDiff(a, new PNG({ width: 4, height: 4 })), /8x8 against 4x4/);
});

test('REAL-GPU: no workflow and no npm script runs the probe - it is a machine\'s own instrument, never CI\'s on push', () => {
  const root = new URL('../../', import.meta.url);
  const dir = new URL('.github/workflows/', root);
  const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(workflows.length > 5, `the workflows read (${workflows.length})`);
  const runners = workflows.filter((f) => /realGpu|realgpu/.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(runners, [], 'a workflow runs tools/realGpu/');
  const scripts = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).scripts;
  assert.deepEqual(Object.entries(scripts).filter(([, s]) => /realGpu/.test(s)).map(([k]) => k), [], 'an npm script runs tools/realGpu/');
  assert.ok(readdirSync(join(new URL('tools/realGpu/', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'))).includes('realGpuProbe.mjs'), 'the sweep looked for the probe that stands');
});
