// MF1 - THE FIGURE STANDS (2026-09-12).
//
// Mac: "the morrowind (paperdoll) when in the inventory is kinda
// glitchy. Like it takes time for things to equip or change stances
// and is just overall clunky."
//
// Two faults under one complaint. THE POSE: PX32 posed the portrait at
// the wheel's live playhead, and when the pack opens from first person
// that playhead is a FIRST-PERSON clip - the .1st.kf's tracks and time
// on the third-person body, by bone name: the camera-arm pose, shifting
// with the arm's idle loop and jumping on every rebuild. THE PICTURE:
// every fresh yaw and every settlement was a GPU readback, a PNG encode
// and an <img> decode a frame late. The body now poses with ITS OWN
// stance idle at that clip's start, and its pixels go onto a canvas.
//
// Source-pinned, as PX32 and AUDIT 33 are: a live pin needs a third-
// person BUILD and the fixtures reach the first-person arm only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('MF1: the portrait poses the body with ITS OWN stance idle, at its start, before the upload', () => {
  const arm = read('src/combat/fpArm.js');
  const start = arm.indexOf('    figure({ yaw = 0, height = 384 } = {}) {');
  assert.ok(start > 0);
  const fig = arm.slice(start, start + 3600);
  const pose = fig.indexOf('const pose = portraitPose(t);');
  const upload = fig.indexOf('uploadThirdMesh(t);');
  assert.ok(pose > 0, 'the figure asks the body for its own pose');
  assert.ok(upload > pose, 'and poses BEFORE the upload (PX32 stands)');
  assert.match(fig, /tracks: pose\.source\.trackMap,[\s\S]{0,80}time: pose\.state\.startTime,/, 'the picked source\'s tracks at the clip\'s START - the standing frame');
  assert.ok(!/poseSource|shown\.time|actionState \|\| movementState/.test(fig), 'the wheel\'s playhead is not read - in first person it is the ARM\'s clip');
  // portraitPose: the body's sources, the DRAWN stance (a paperdoll
  // holds what it carries - PX26), the reference's own idle ladder,
  // memoised per body and group.
  const pp = arm.slice(arm.indexOf('  function portraitPose(t) {'), arm.indexOf('  function portraitPose(t) {') + 900);
  assert.match(pp, /animWeaponType\(t\.mwType \?\? \(built && built\.mwType\), false, spellReady\)/);
  assert.match(pp, /composeStanceGroup\(FP_IDLE_BASE, type, \(n\) => anySourceHasGroup\(t\.sources, n\)\)/, 'the ladder climbs the BODY\'s sources, never the arm\'s');
  assert.match(pp, /pickAnimSource\(t\.sources, composed\.group, resetClip, \{ loopFallback: true \}\)/);
  assert.match(pp, /portraitPicks\.get\(t\)/, 'the pick is kept per body');
  assert.match(pp, /if \(!t \|\| !t\.ok \|\| !t\.sources\) return null;/, 'no body, no pose - the figure keeps the build\'s matrices');
});

test('MF1: the pack draws the figure\'s PIXELS on a canvas - no PNG, no data URL, one repaint per frame while dragging', () => {
  const pack = read('src/ui/enhancedInventory.js');
  // the figure's own functions (the MW-D38 icon between them still
  // encodes its data URL - a list of thirty icons is the case for one)
  const block = pack.slice(pack.indexOf('// ── MW-D36: the model figure'), pack.indexOf('/** MW-D38: a Daggerfall item'))
    + pack.slice(pack.indexOf('function attachFigureTurn'), pack.indexOf('/** The avatar, at whatever scale the column gives it. */'));
  assert.ok(!/toDataURL|modelFigureUrl|\.src = /.test(block), 'the figure block encodes nothing and sets no src');
  assert.match(block, /_figureCache = \{ key, img \};/, 'the cache holds the ImageData');
  assert.match(block, /new ImageData\(px\.data, px\.width, px\.height\)/);
  assert.match(block, /const yaw = Math\.round\(_figureYaw \/ 0\.1\) \* 0\.1;/, 'AUDIT 33 F2 stands: the yaw is quantised');
  assert.match(block, /armMod\.figure\(\{ yaw, height: 384 \}\)/);
  assert.match(block, /function paintFigure\(cv, img\) \{[\s\S]*?putImageData\(img, 0, 0\)/);
  // the drag: record, then ONE animation frame; a repaint under the
  // drag hands the next frame to the new canvas.
  const turn = block.slice(block.indexOf('function attachFigureTurn'));
  assert.match(turn, /if \(_figureRaf\) return;\s*_figureRaf = requestAnimationFrame\(/, 'one pending repaint at a time');
  assert.match(turn, /if \(!cv\.isConnected\) return;/);
  assert.ok(!/takeOff|slotAtPaperDoll|onclick/.test(turn), 'display only (MW-D36): the canvas never unequips');
  // the doll frame takes the canvas, and the classic doll stays the fallback
  assert.match(pack, /const figure = modelFigure\(\);\s*\n\s*const dollUrl = figure \? null : paperDollDataUrl\(paperDollPixels\(\), \{ scale: 4 \}\);/);
  assert.match(pack, /if \(figure\) \{\s*\n\s*figure\.setAttribute\('role', 'img'\);[\s\S]{0,200}attachFigureTurn\(figure\);\s*\n\s*dollFrame\.append\(figure\);/);
  assert.match(pack, /subscribe\(\(\) => \{ _figureCache = \{ key: null, img: null \}; if \(host\) render\(\); \}\)/, 'a settlement drops the pixels and repaints');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.pack-shell \.wornmap-doll\.model img, \.pack-shell \.wornmap-doll\.model canvas \{ cursor: ew-resize;/);
  assert.match(css, /\.pack-shell \.wornmap-doll img, \.pack-shell \.wornmap-doll canvas \{ display: block; height: 100%; width: 100%;/);
});

test('MF1: the build clock names the reach SWEEP as its own span', () => {
  const arm = read('src/combat/fpArm.js');
  assert.match(arm, /const spans = \{ archives: 0, esm: 0, meshes: 0, textures: 0, sweep: 0 \};/);
  const i = arm.indexOf("    stage('meshes');   // MF1");
  const j = arm.indexOf('const sweep = clipSweepTimes(sources, idleCheck);');
  const k = arm.indexOf("    stage('sweep');");
  assert.ok(i > 0 && j > i && k > j, 'meshes closes before the sweep begins, and the sweep closes after the reaches are measured');
  assert.match(arm, /sweep: Math\.round\(spans\.sweep\),/);
  assert.match(arm, /textures \$\{timings\.textures\}, sweep \$\{timings\.sweep\}/, 'and the one log line prints it');
});
