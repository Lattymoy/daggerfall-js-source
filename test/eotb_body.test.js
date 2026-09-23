import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sizeMod, spriteSize, spriteOffset, spriteFor, tableKeys, flipRows,
  spriteCount, eotbSpriteUrl, SIZE_ON_FOOT, SIZE_RIDING_OR_TRANSFORMED,
} from '../src/player/eotbSprite.js';
import { createEotbBody, bodyState } from '../src/player/eotbBody.js';
import { createEotbCamera, eotbCamera } from '../src/player/eotbCamera.js';
import { ARCHIVE_FOOT, ARCHIVE_HORSE, frameTime, TABLE_FRAMES } from '../src/player/eotbBillboard.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const MOD = 'eye-of-the-beholder';

// ═══ EOTB5: THE BODY ON SCREEN ════════════════════════════════════

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viteConfig = readFileSync(join(root, 'vite.config.js'), 'utf8');
const weaponRig = readFileSync(join(root, 'src/combat/weaponRig.js'), 'utf8');
const bodySrc = readFileSync(join(root, 'src/player/eotbBody.js'), 'utf8');

const renderer = () => ({
  uploads: [], batches: [], draws: 0,
  uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); },
  createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; },
  destroyBillboardBatch() {},
  drawBillboards() { this.draws++; },
});
/** A body with art present and an instant decode, driven by a camera
 *  of its own so the module-level one is left alone. */
async function liveBody(over = {}, { third = true } = {}) {
  const r = renderer();
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }),
    ...over,
  });
  b.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, !third);
  return { b, r };
}
const walk = (extra = {}) => ({ motion: { forward: 1, standing: false, speed: 3, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: 0, cameraPos: [0, 1.5, -2], ...extra });
const still = (extra = {}) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: 0, cameraPos: [0, 1.5, -2], ...extra });
const ticks = (b, n, state, dt = 1 / 60) => { for (let i = 0; i < n; i++) b.tick(dt, state); };

test('EOTB5: the sprite is sized in METRES PER PIXEL, and the saddle shares its size with the werewolf', () => {
  assert.equal(SIZE_ON_FOOT, 0.019);
  assert.equal(SIZE_RIDING_OR_TRANSFORMED, 0.029);
  assert.equal(sizeMod({}), 0.019);
  assert.equal(sizeMod({ riding: true }), 0.029);
  assert.equal(sizeMod({ transformed: true }), 0.029, 'the transformed forms take the RIDING size');
  assert.equal(sizeMod({ scale: 2 }), 0.038, 'BillboardScale multiplies it');
  const { w, h } = spriteSize(53, 110, {});
  assert.ok(h > 1.9 && h < 2.2, `a 110px sprite stands ${h.toFixed(2)}m - about a person`);
  assert.equal(Number(w.toFixed(4)), Number((53 * 0.019).toFixed(4)));
  assert.ok(spriteSize(53, 110, { riding: true }).h > h);
  // [IL] the XML scale divides the pixels before sizeMod (IL_5b3e-IL_5b7c, IL_49dd-IL_49f3)
  assert.equal(spriteSize(53, 110, {}, 2).h, 110 / 2 * 0.019);
});

test('EOTB-IL: the per-sprite offsets are the XML’s, in metres, six triples over 288 records, and GlobalOffsetScale never touches them', () => {
  const info = JSON.parse(readFileSync(join(root, 'vendor/eye-of-the-beholder/spriteInfo.json'), 'utf8'));
  assert.deepEqual(spriteOffset(ARCHIVE_FOOT, 0), { scale: 1, x: 0, y: 0 }, 'a record with no XML is the default');
  assert.deepEqual(spriteOffset(ARCHIVE_FOOT, 18), { scale: 1, x: -0.2, y: 0 }, 'ReadyMeleeBackwardLeft (record 18) sits a fifth of a metre to the left');
  assert.deepEqual(spriteOffset(ARCHIVE_FOOT, 48), { scale: 1, x: -0.76, y: 0 }, 'the largest');
  assert.equal(Object.keys(info.offsets).length, 288);
  const triples = new Set(Object.values(info.offsets).map((o) => `${o.scale},${o.x},${o.y}`));
  assert.equal(triples.size, 6);
  // the dial the pane still shows is inert in the assembly: get_scaleOffset has no caller
  assert.ok(!/(function|const|let)\s+scaleOffset\b/.test(readFileSync(join(root, 'src/player/eotbSprite.js'), 'utf8')), 'no scaleOffset in the port either');
});

test('EOTB-IL: bodyState reads the motion bag the way LoopIdleBillboard reads PlayerMotor', () => {
  const s = bodyState({ motion: { forward: 1, strafe: 1, speed: 4, standing: false, freeze: 0, sneaking: true, levitating: false, swimming: true, height: 0.9 } });
  assert.equal(s.stopped, false);
  assert.equal(Number(s.moveSpeed.toFixed(6)), Number((4 * Math.SQRT1_2).toFixed(6)), 'a diagonal is limited by .7071');
  assert.equal(s.floating, true, 'a swimmer floats');
  assert.equal(s.sneaking, true);
  assert.equal(s.height, 0.9);
  assert.equal(bodyState({ motion: { forward: 0, standing: false, freeze: 0.5 } }).stopped, true, 'a frozen motor is stopped');
  assert.equal(bodyState({ motion: { forward: 1, standing: false } }).moveSpeed, 0, 'no speed field: no speed');
  assert.equal(bodyState({}).height, 1.8, 'the standing capsule stands in');
  assert.equal(bodyState({ stopped: false, motion: { standing: true } }).stopped, false, 'a host\'s explicit word wins over the bag');
});

test('EOTB-IL: THE CHOP, FIXED - a standing player is ONE frame that never changes, and the walk cycles the art’s four', async () => {
  const { b } = await liveBody();
  ticks(b, 30, still());
  assert.equal(b.state().table, 'Idle');
  assert.equal(b.state().shown.frame, 0);
  ticks(b, 240, still());   // four seconds, sixteen of the old five-frame cycle
  assert.equal(b.state().shown.frame, 0, 'an idle has one frame and the clock never advances it (IL_41b7-IL_41cf)');
  assert.equal(b.state().pending.length, 0, 'no repaint is ever queued for a one-frame table');
  const seen = new Set();
  for (let i = 0; i < 120; i++) { b.tick(1 / 60, walk()); seen.add(b.state().shown.frame); }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3], 'the walk shows exactly the four frames the art has');
});

test('EOTB-IL: the walk clock is LoopIdleBillboard’s - frameTimer > frameTime * speedMod, a run at twice the rate, the repaint three frames late', async () => {
  const { b } = await liveBody();
  ticks(b, 10, walk());
  const t0 = b.state().shown.frame;
  // one frame time on foot is 0.25 s; the tick fires when the timer EXCEEDS it, and the paint lands 3 frames later
  const changes = [];
  for (let i = 0; i < 60; i++) { b.tick(1 / 60, walk()); if (b.state().shown.frame !== (changes.at(-1)?.frame ?? t0)) changes.push({ frame: b.state().shown.frame, at: i }); }
  assert.ok(changes.length >= 3, 'four frames a second');
  const gaps = changes.slice(1).map((c, i) => c.at - changes[i].at);
  assert.ok(gaps.every((g) => g >= 15 && g <= 17), `a quarter second between paints (${gaps})`);
  // a run halves the frame time
  const { b: runner } = await liveBody();
  const run = walk({ motion: { forward: 1, standing: false, running: true, speed: 6, grounded: true, height: 1.8 } });
  ticks(runner, 10, run);
  const r0 = runner.state().shown.frame;
  const rc = [];
  for (let i = 0; i < 60; i++) { runner.tick(1 / 60, run); if (runner.state().shown.frame !== (rc.at(-1)?.frame ?? r0)) rc.push({ frame: runner.state().shown.frame, at: i }); }
  const rg = rc.slice(1).map((c, i) => c.at - rc[i].at);
  assert.ok(rg.length >= 5 && rg.every((g) => g >= 7 && g <= 9), `an eighth of a second at a run (${rg})`);
  // the delayed repaint really waits three frames (IL_5c6a-IL_5ca1)
  const { b: d } = await liveBody();
  ticks(d, 10, still());
  d.tick(1 / 60, walk());   // the table changes: a delayed repaint is queued this frame
  assert.equal(d.state().pending.length, 1);
  assert.equal(d.state().shown.table, 'Idle', 'not yet');
  d.tick(1 / 60, walk()); d.tick(1 / 60, walk());
  assert.equal(d.state().shown.table, 'Idle', 'two frames on: still not');
  d.tick(1 / 60, walk());
  assert.equal(d.state().shown.table, 'Move', 'the third frame paints it');
});

test('EOTB-IL: the footfall is the picture’s - frames 0 and 2 of the four-frame walk, once each, at twice the volume, and a landing', async () => {
  const { b } = await liveBody();
  const fell = [];
  for (let i = 0; i < 130; i++) { b.tick(1 / 60, walk()); if (b.footstep().fell) fell.push(b.state().frame); }
  assert.deepEqual([...new Set(fell)].sort(), [0, 2], 'a foot on the even frames and no others');
  assert.ok(fell.length >= 4 && fell.length <= 5, `one step per frame held, not one per tick (${fell.length})`);
  assert.equal(b.footstep().owns, true, 'Initialize ran DisableVanillaFootsteps');
  assert.equal(b.footstep().volumeScale, 2, 'the third-person billboard steps at twice FootstepVolumeScale');
  // standing: no foot lands
  ticks(b, 30, still());
  assert.equal(b.footstep().fell, false);
  // a landing (IL_3f74-IL_3fa4): grounded after not being grounded plays a step at once
  b.tick(1 / 60, still({ motion: { forward: 0, standing: false, grounded: false, height: 1.8 } }));
  b.tick(1 / 60, still());
  assert.equal(b.footstep().fell, true, 'the landing step');
  // a swimmer is silent (IL_58c5)
  const { b: s } = await liveBody();
  const swim = walk({ motion: { forward: 1, standing: false, speed: 2, grounded: true, swimming: true, height: 1.8 } });
  let any = false;
  for (let i = 0; i < 130; i++) { s.tick(1 / 60, swim); any ||= s.footstep().fell; }
  assert.equal(any, false, 'no step while swimming');
  // in the saddle the mod's own footsteps still play - every fourth of eight - unless it is not on foot and not in water: they do not
  const { b: h } = await liveBody();
  const ride = walk({ riding: true, motion: { forward: 1, standing: false, speed: 12, grounded: true, riding: true, height: 2.6 } });
  let rode = false;
  for (let i = 0; i < 60; i++) { h.tick(1 / 60, ride); rode ||= h.footstep().fell; }
  assert.equal(rode, false, 'a mount is not on foot: PlayFootstep returns (IL_585b-IL_587c)');
  // the switch off: the next Initialize restores the vanilla stride (EnableVanillaFootsteps, IL_3c7f)
  setModSetting(MOD, 'Animation.SyncFootsteps', false);
  try {
    const { b: off } = await liveBody();
    assert.equal(off.footstep().owns, false, 'SyncFootsteps off: DFU\'s own stride');
  } finally { _resetModSettings(); }
});

test('EOTB5: a MIRRORED sprite is its own upload, and says so', () => {
  const left = spriteFor('Idle', 2, 0, {});     // mirrored
  const right = spriteFor('Idle', 6, 0, {});    // its unmirrored twin
  assert.equal(left.mirror, true);
  assert.equal(right.mirror, false);
  assert.equal(left.record, right.record, 'the same record...');
  assert.equal(left.key, right.key, '...and the same file on disk');
  assert.notEqual(left.rec, right.rec, '...but NOT the same texture cache key');
  assert.match(left.rec, /m$/, 'the mirrored copy is marked');
  const px = new Uint32Array([1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...flipRows(px, 3, 2)], [3, 2, 1, 6, 5, 4]);
  assert.deepEqual([...flipRows(flipRows(px, 3, 2), 3, 2)], [...px]);
  // the second flip cancels the wheel's
  assert.equal(spriteFor('Idle', 2, 0, {}, { flip: true }).mirror, false);
  assert.equal(spriteFor('Idle', 0, 0, {}, { flip: true }).rec, '0-0m');
});

test('EOTB5: one table asks for five files a frame, not eight - the wheel shares its records', () => {
  const keys = tableKeys('Idle', 0, {});
  assert.equal(keys.length, 5, 'eight orientations, five records');
  assert.deepEqual(keys, [0, 1, 2, 3, 4].map((r) => `${ARCHIVE_FOOT}_${r}-0`));
  assert.ok(tableKeys('GallopHorse', 0, { onHorse: 2 }).every((k) => k.startsWith(String(ARCHIVE_HORSE + 2))));
});

test('EOTB-IL: the body PRELOADS every frame of every table at attach, as InitializeTextures does', async () => {
  const { b, r } = await liveBody();
  await new Promise((res) => setTimeout(res, 5));
  // eight orientations a table, every frame: the five records and the
  // three mirrored twins, which are their own uploads in this port
  const expected = Object.entries(TABLE_FRAMES).reduce((n, [, f]) => n + f * 8, 0);
  assert.equal(r.uploads.length, expected, `${expected} sprites up - the three archives the settings pick, whole`);
  assert.equal(new Set(r.uploads.map((u) => `${u.archive}:${u.rec}`)).size, expected, 'each once');
  assert.equal(b.state().cached, expected);
});

test('EOTB5: in node there is no art, so the body can never claim to be ready', () => {
  assert.equal(spriteCount(), 0, 'no glob under node');
  assert.equal(eotbSpriteUrl('112364_0-0'), null);
  const b = createEotbBody();
  assert.equal(b.ready(), false, 'no renderer, no art: not ready');
  b.attach(null);
  assert.equal(b.ready(), false, 'and attaching nothing does not change that');
  assert.equal(b.draw(null, {}), false, 'nor does asking it to draw');
});

test('AUDIT-EOTB F7: the lane stays SHUT until the first sprite is really up, and never flaps back', async () => {
  const r = renderer();
  let release;
  const held = new Promise((res) => { release = res; });
  const b = createEotbBody({ count: () => 3035, urlFor: (key) => `/art/${key}.png`, decode: () => held });
  b.attach(r, () => ({}));
  assert.equal(b.ready(), false, 'art present, first sprite still decoding: SHUT');
  release({ width: 3, height: 2, colors: new Uint32Array([1, 2, 3, 4, 5, 6]) });
  await held;
  await new Promise((res) => setTimeout(res, 2));
  assert.equal(b.ready(), true, 'the first sprite is up: OPEN');
  const b2 = createEotbBody({ count: () => 3035, urlFor: () => '/art/x.png', decode: () => Promise.reject(new Error('404')) });
  b2.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 2));
  assert.equal(b2.ready(), false, 'a first sprite that FAILS does not open the lane');
  const b3 = createEotbBody({ count: () => 0, urlFor: () => '/a.png', decode: () => Promise.resolve({ width: 1, height: 1, colors: new Uint32Array([7]) }) });
  b3.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 2));
  assert.equal(b3.ready(), false, 'a decoded sprite the build does not carry is not art');
});

test('AUDIT-EOTB F7b: the MIRROR reaches the UPLOAD, and the draw keeps the LAST sprite while a new one is on its way', async () => {
  const pixels = new Uint32Array([1, 2, 3, 4, 5, 6]);   // 3 wide, 2 high
  const r = renderer();
  const gate = { open: true };
  // TurnToView Always, so the facing is the camera's forward (+z) and
  // the wheel turns with the camera alone
  setModSetting(MOD, 'Graphics.TurnToView', 3);
  // a decode held shut spins at most two seconds: a test helper that
  // can hang is a test suite that can hang (EOTB4's lesson)
  const wait = async () => { for (let i = 0; i < 2000 && !gate.open; i++) await new Promise((res) => setTimeout(res, 1)); };
  const b = createEotbBody({
    count: () => 3035, urlFor: (key) => `/art/${key}.png`,
    decode: async () => { await wait(); return { width: 3, height: 2, colors: pixels }; },
  });
  b.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);
  _resetModSettings();
  // FACING THE CAMERA: orientation 0, not mirrored
  ticks(b, 12, still({ cameraPos: [0, 1.5, 2] }));
  assert.equal(b.state().shown.orientation, 0);
  b.draw(null, { eye: [0, 1.5, 2], feet: [0, 0, 0], yaw: 0 });
  const plain = r.uploads.find((u) => u.rec === '0-0');
  assert.deepEqual([...plain.img.colors], [...pixels], 'uploaded exactly as decoded');
  // THE CAMERA OFF TO THE PLAYER'S RIGHT (+x): index 2, the mirrored record, its own pixels
  ticks(b, 12, still({ cameraPos: [2, 1.5, 0] }));
  assert.equal(b.state().shown.orientation, 2, 'the camera off the right: index 2 (EOTB-IL: the turn)');
  b.draw(null, { eye: [2, 1.5, 0], feet: [0, 0, 0], yaw: 0 });
  const flipped = r.uploads.find((u) => u.rec === '2-0m');
  assert.ok(flipped, 'a mirrored orientation uploads under its OWN key');
  assert.deepEqual([...flipped.img.colors], [3, 2, 1, 6, 5, 4], 'and the pixels are really flipped, row by row');
  // ...and off the LEFT (-x): index 6, the same record straight
  ticks(b, 12, still({ cameraPos: [-2, 1.5, 0] }));
  assert.equal(b.state().shown.orientation, 6, 'the camera off the left: index 6');
  // A SPRITE STILL ON ITS WAY: the last batch is drawn, not nothing
  gate.open = false;
  const b2 = createEotbBody({
    count: () => 3035, urlFor: (key) => `/art/${key}.png`,
    decode: async (url) => { if (/_5-/.test(url)) await wait(); return { width: 3, height: 2, colors: pixels }; },
  });
  try {
    const r2 = renderer();
    b2.attach(r2, () => ({}));
    await new Promise((res) => setTimeout(res, 5));
    b2.toggle(true, false);
    ticks(b2, 12, walk({ cameraPos: [0, 1.5, 2] }));   // the facing set (+z), then a stand facing the camera
    ticks(b2, 12, still({ cameraPos: [0, 1.5, 2] }));
    assert.equal(b2.state().shown.table, 'Idle');
    assert.equal(b2.draw(null, { eye: [0, 1.5, 2], feet: [0, 0, 0], yaw: 0 }), true, 'the idle draws');
    await new Promise((res) => setTimeout(res, 2));
    b2.draw(null, { eye: [0, 1.5, 2], feet: [0, 0, 0], yaw: 0 });
    assert.equal(r2.batches.at(-1).rec, '0-0');
    ticks(b2, 4, walk({ cameraPos: [0, 1.5, 2] }));
    assert.equal(b2.state().shown.table, 'Move');
    assert.equal(b2.draw(null, { eye: [0, 1.5, 2], feet: [0, 0, 0], yaw: 0 }), true, 'the walk\'s record is not up yet: the idle stays on screen rather than nothing');
    assert.equal(r2.batches.at(-1).rec, '0-0', 'the batch drawn is still the idle\'s');
  } finally { gate.open = true; }
});

test('EOTB-IL: the placement is UpdateBillboard’s - the feet on the ground, sunk by a crouch, the top at the swim line, the XML X along the right', async () => {
  const { b } = await liveBody();
  ticks(b, 10, still());
  b.draw(null, { eye: [0, 1.5, -2], feet: [0, 0, 0], yaw: 0 });
  await new Promise((res) => setTimeout(res, 2));
  b.draw(null, { eye: [0, 1.5, -2], feet: [0, 0, 0], yaw: 0 });
  const h = 6 * SIZE_ON_FOOT;
  // EOTB-FEET: `placed` is what the RENDERER is handed, and the
  // renderer's billboard is bottom-anchored (BB_VS: the base, the
  // centre half a height above it) - so the mod's centre arms land
  // here less size/2. The old pin asserted the CENTRE at h/2 and called
  // it "the bottom at the feet"; the body hovered by exactly that.
  let p = b.state().placed;
  assert.equal(Number(p[1].toFixed(6)), 0, 'standing: the sprite\'s bottom at the feet - the base handed over IS the feet');
  // crouching: origin + Y + size/2 - height, the crouched capsule 0.9 - the sprite sinks 0.45
  ticks(b, 2, still({ motion: { forward: 0, standing: true, grounded: true, crouching: true, height: 0.9 } }));
  p = b.state().placed;
  assert.equal(Number(p[1].toFixed(6)), Number((0.45 - 0.9).toFixed(6)), 'crouched: the base sunk by half the height difference (IL_4a67-IL_4acc)');
  // on exterior water: origin + Y - size/2 - the top at the capsule's centre
  ticks(b, 2, still({ motion: { forward: 0, standing: true, grounded: true, onExteriorWater: true, height: 1.8 } }));
  p = b.state().placed;
  assert.equal(Number(p[1].toFixed(6)), Number((0.9 - h).toFixed(6)), 'swimming: the top at the swim line (IL_4a1a-IL_4a62) - the base a whole size below it');
  // and the two conventions, pinned where they meet: the renderer's
  // shader anchors at the base, and place() converts the mod's centre.
  const vs = readFileSync(join(root, 'src/render/renderer.js'), 'utf8');
  assert.match(vs, /\+ uUp \* \(\(aCorner\.y \+ 0\.5\) \* uSize\.y\);/, 'the billboard shader is bottom-anchored');
  assert.match(readFileSync(join(root, 'src/player/eotbBody.js'), 'utf8'), /const base = y - size\.h \* 0\.5;\n\s+return \[origin\[0\] \+ right\[0\] \* x \+ fwd\[0\] \* z, origin\[1\] \+ base,/, 'and the body hands it the base');
  // the XML X: record 18 (x -0.2) is index 5 straight and index 3
  // mirrored, and UpdateBillboard negates X for the mirrored state
  // (IL_4ba7-IL_4bd1). A drawn weapon faces the camera's forward (+z);
  // the camera at the back-left is index 5, at the back-right 3.
  const { b: armed } = await liveBody();
  ticks(armed, 12, still({ sheathed: false, cameraPos: [-1.4, 1.5, -1.4] }));
  assert.equal(armed.state().shown.table, 'IdleMelee');
  assert.equal(armed.state().shown.orientation, 5, 'the camera at the back-left: index 5, record 18 straight');
  armed.draw(null, { eye: [-1.4, 1.5, -1.4], feet: [0, 0, 0], yaw: 0 });
  await new Promise((res) => setTimeout(res, 2));
  armed.draw(null, { eye: [-1.4, 1.5, -1.4], feet: [0, 0, 0], yaw: 0 });
  p = armed.state().placed;
  assert.equal(Number(p[0].toFixed(6)), -0.2, 'the -0.2 XML offset along the right');
  ticks(armed, 12, still({ sheathed: false, cameraPos: [1.4, 1.5, -1.4] }));
  assert.equal(armed.state().shown.orientation, 3, 'the back-right: index 3, the same record mirrored');
  armed.draw(null, { eye: [1.4, 1.5, -1.4], feet: [0, 0, 0], yaw: 0 });
  await new Promise((res) => setTimeout(res, 2));
  armed.draw(null, { eye: [1.4, 1.5, -1.4], feet: [0, 0, 0], yaw: 0 });
  assert.equal(Number(armed.state().placed[0].toFixed(6)), 0.2, 'and the offset negated for the mirrored state');
});

test('EOTB-IL: the first-person billboard - active while FirstPersonBillboard is not None, a quarter metre behind, the front record, mirrored when Visible', async () => {
  const { b, r } = await liveBody({}, { third: false });   // toggle(true, fp=true): ToggleOffset(false) with the setting on
  assert.equal(b.state().FP, true);
  assert.equal(b.state().active, true);
  ticks(b, 10, still({ cameraPos: [0, 1.7, 0] }));
  assert.equal(b.state().shown.orientation, 0, 'the camera point is the head: the zero vector reads the front record');
  assert.equal(b.draw(null, { eye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0 }), true, 'drawn in first person');
  await new Promise((res) => setTimeout(res, 2));
  b.draw(null, { eye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0 });
  const p = b.state().placed;
  assert.equal(Number(p[2].toFixed(6)), -0.25, 'a quarter metre behind the parent along the forward (IL_4cd7)');
  assert.equal(r.batches.at(-1).rec, '0-0', 'Shadows Only (1) draws the picture as it is');
  // Visible (2) faces the quad away from the camera: seen from behind, mirrored
  setModSetting(MOD, 'Graphics.FirstPersonBillboard', 2);
  try {
    b.toggle(true, true);
    ticks(b, 12, still({ cameraPos: [0, 1.7, 0] }));
    b.draw(null, { eye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0 });
    await new Promise((res) => setTimeout(res, 2));
    b.draw(null, { eye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0 });
    assert.equal(r.batches.at(-1).rec, '0-0m', 'Visible: the mirrored upload');
  } finally { _resetModSettings(); }
  // None: inactive in first person, nothing drawn (the camera's toggle passes false)
  const { b: none } = await liveBody({}, { third: false });
  none.toggle(false, false);
  assert.equal(none.state().active, false);
  assert.equal(none.draw(null, { eye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0 }), false);
});

test('EOTB-IL: the camera drives the billboard through ToggleOffset - shown out, the first-person one back, Initialize each time', async () => {
  const cam = createEotbCamera();
  cam.loadSettings((v, k) => (k === 'Camera.StartInThirdPerson' ? false : undefined));
  const r = renderer();
  const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  b.attach(r, () => ({}));
  cam.setBillboard(b);
  cam.toggleOffset(true);
  assert.deepEqual([b.state().active, b.state().FP], [true, false], 'out of the head: the third-person billboard');
  cam.toggleOffset(false);
  assert.deepEqual([b.state().active, b.state().FP], [true, true], 'back in it: the first-person billboard (FirstPersonBillboard ships at 1)');
  cam.loadSettings((v, k) => (k === 'Graphics.FirstPersonBillboard' ? 0 : undefined));
  cam.toggleOffset(false);
  assert.equal(b.state().active, false, 'FirstPersonBillboard None: hidden in first person');
  cam.loadSettings((v, k) => (k === 'Graphics.Enable' ? false : undefined));
  cam.toggleOffset(true);
  assert.equal(b.state().active, false, 'Graphics.Enable off: hidden in third person too');
  assert.equal(cam.spellHandsEnabled(), false, 'and the spell hands still go');
});

test('EOTB-IL: UpdateMaterial - invisible white at 0.4, a shade BLACK at 0.6, blending white at 0.8, in that order', async () => {
  const { b } = await liveBody();
  ticks(b, 2, still());
  assert.equal(b.state().material, null);
  ticks(b, 1, still({ concealment: { invisible: true, blending: true, shade: true } }));
  assert.deepEqual(b.state().material, { mode: 3, alpha: 0.4 }, 'invisible first');
  ticks(b, 1, still({ concealment: { blending: true, shade: true } }));
  assert.deepEqual(b.state().material, { mode: 4, alpha: 0.6 }, 'then the shade - the black mode');
  ticks(b, 1, still({ concealment: { blending: true } }));
  assert.deepEqual(b.state().material, { mode: 3, alpha: 0.8 }, 'then blending');
  // the renderer draws mode 4 as black
  const rs = readFileSync(join(root, 'src/render/renderer.js'), 'utf8');
  assert.match(rs, /if \(uConceal\.x == 4\.0\) lit = vec3\(0\.0\);/);
});

test('EOTB5: THE FOUR HOSTS are named, and the wiring is ONE site because all four reach it', () => {
  assert.match(weaponRig, /const bindBody = \(\) => eotbBody\.attach\(renderer, eotbState\);/, 'the body attaches in the weapon rig, with the state only the rig can answer');
  assert.match(weaponRig, /fpArm\.attach\(renderer, camera\)/, '...beside the arm');
  const hosts = ['exterior', 'world', 'worldModes', 'dungeonContext'];
  for (const h of hosts) {
    const src = readFileSync(join(root, `src/scenes/${h}.js`), 'utf8');
    assert.match(src, /createWeaponRig\(/, `${h}.js builds a weapon rig, so it gets the body`);
    assert.doesNotMatch(src, /eotbBody/, `${h}.js must NOT carry its own call - four sites is four chances to forget one`);
  }
  assert.match(weaponRig, /export function createWeaponRig/, 'one builder');
  assert.match(bodySrc, /scenes\/exterior\.js.*scenes\/world\.js|THE FOUR HOSTS/s, 'the body names them in its head');
  // and the rig no longer CALLS the body - the doors are polled off the record, as the mod polls DFU
  assert.doesNotMatch(weaponRig, /eotbBody\.(attack|cast|release)\(/, 'no strike call: PlayerBillboard polls IsAttacking itself');
  for (const f of ['attacking: playerWeapon.machine.state !== \'Idle\'', 'castPlaying: !!fpsSpellCasting.isPlayingAnim', 'bowDrawback: getBool(\'Controls\', \'BowDrawback\')', 'swingHeld: _held', 'concealment: entity ? concealmentFlags(entity) : null']) {
    assert.ok(weaponRig.includes(f), `the record carries ${f}`);
  }
});

test('EOTB5: the mod\u2019s art is EXCLUDED from Vite\u2019s inlining - and since INLINE1, so is every other mod\u2019s', () => {
  assert.match(viteConfig, /assetsInlineLimit:/, 'the rule exists');
  const m = /assetsInlineLimit: \(filePath\) => \((.*?)\),/.exec(viteConfig);
  assert.ok(m, 'and it is a callback, not a number');
  assert.match(m[1], /\?\s*false\s*:\s*undefined/, 'false for a mod\u2019s file, UNDEFINED for everything else');
  // INLINE1 (2026-09-20): this pin used to hold "every other vendor asset keeps
  // the default" and named dynamic-skies as the example. That was the premise
  // that failed - the allow-list of three folders was an enumeration, twenty
  // vendor folders landed after it and none joined, and Shield Widget's 275
  // small sprites went into the boot chunk as 1.34 MB of base64. INVERTED, not
  // deleted: the rule is now the CLASS (anything under vendor/), so the mod
  // this pin was written for is still held, and so is the one it once held OUT.
  // eslint-disable-next-line no-new-func
  const rule = new Function('filePath', `return (${m[1]});`);
  assert.equal(rule('/x/vendor/eye-of-the-beholder/Textures/112364/112364_0-0.png'), false, 'never inline a sprite');
  assert.equal(rule('/x/vendor/dynamic-skies/Textures/CdMSunny.png'), false, 'INLINE1: every vendor asset is a file - this one was the pinned exception');
  assert.equal(rule('/x/vendor/immersive-footsteps/Audio/Low_Quality/Climate/LQ_Grass_Footstep_1.mp3'), false, 'AUDIT-IF F1: Immersive Footsteps\' clips are the same class (test/if1_immersivefootsteps.test.js holds the measurement)');
  assert.equal(rule('C:\\x\\vendor\\eye-of-the-beholder\\Textures\\a.png'), false, 'and on a Windows path too');
  assert.equal(rule('/x/src/ui/icons/diamond.png'), undefined, 'and everything OUTSIDE vendor/ keeps Vite\u2019s default - the rule is the class, not the tree');
  assert.equal(rule('/x/src/assets/mw/textures/thunderlock.dds'), undefined, 'the port\u2019s own assets included');
});

test('EOTB5: the module-level body and camera are one pair', () => {
  assert.equal(typeof eotbCamera.setBillboard, 'function');
  assert.equal(frameTime(false, 1), 0.25);
});

test('MAC-O3: attach is RE-CLAIMED by the stepping rig - the same pair is a no-op, another rig takes the body over', async () => {
  const r = renderer();
  const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  const f = () => ({ sheathed: true });
  b.attach(r, f);
  await new Promise((res) => setTimeout(res, 5));
  const uploads = r.uploads.length;
  b.attach(r, f);
  b.attach(r, f);
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(r.uploads.length, uploads, 'the same renderer and thunk redo nothing - no second preload');
  // the rig re-claims it every frame, beside the arm
  assert.match(weaponRig, /const bindBody = \(\) => eotbBody\.attach\(renderer, eotbState\);/, 'one thunk, one bind');
  assert.match(weaponRig, /bindArm\(\);[^\n]*\n\s*bindBody\(\);/, 'frame() re-claims the body right after the arm');
  assert.doesNotMatch(weaponRig, /eotbBody\.attach\(renderer, \(\) => \(\{/, 'and the construction-only attach is gone');
  b.attach(null, null);
});
