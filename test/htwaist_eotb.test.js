// HT-WAIST (2026-09-24, Mac: "Let it be a separate animated item on
// movement with eye of the Beholder sprites also"). THE LANTERN ON THE
// EYE OF THE BEHOLDER SPRITE.
//
// Not the mod's (its billboard draws no light; TorchOffset only moves
// PlayerTorch), so a SECOND billboard, apart from the IL's machine: the
// Lantern template's own picture (TEXTURE.200 record 10, from the player's
// ARENA2 at run time), hung by its top from the sprite's right hip in the
// sprite's facing frame, swung by the one swing law off the sprite's own
// walk, drawn as a tilt of the quad in the view plane. Third person, on
// foot, alive, in your own form only. It lights you from where it hangs
// and stops doing so the moment it stops hanging. With the lantern not
// at the waist, NOTHING of this runs - no second batch, no second draw
// (eotb_body.test.js reads `batches.at(-1)` as the body's).
//
// HT-WAIST-BACK (2026-09-24, Mac: "Just have it show on the back of the
// sprite, not all angles"): the picture is drawn only from behind - the
// painted orientation 3, 4 or 5 (player/eotbLantern.js isRearView;
// test/htwaistback.test.js pins the rule and the peers'). So every body here
// is first walked a step away from the camera, sheathed and with no lantern,
// and stands with its back to the eye (orientation 4 - the IL keeps a
// sheathed body's last facing); a body that has never moved faces nowhere
// (the IL's Vector3.zero) and paints its FRONT, from which no lantern shows.
//
// Driven through createEotbBody with the eotb_body harness's renderer and
// an injected art door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createEotbBody, bodyState } from '../src/player/eotbBody.js';
import { loadLanternArt, LANTERN_ART_KEY, HIP_LANTERN_SPRITE } from '../src/player/eotbLantern.js';   // HT-WAIST-BACK: the one home of the lantern on every EOTB sprite
import { playerWaistLightOverride, setPlayerWaistLightOverride, LANTERN_TEMPLATE } from '../src/systems/playerTorch.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const renderer = () => ({
  uploads: [], batches: [], draws: [], destroyed: [],
  uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); },
  createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; },
  destroyBillboardBatch(b) { this.destroyed.push(b); },
  drawBillboards(batches, right, up) { this.draws.push({ batch: batches[0], right: [...right], up: [...up], origin: [...batches[0].origin], size: { ...batches[0].size } }); },
});
const ART = { width: 10, height: 20, colors: new Uint8ClampedArray(800) };
async function liveBody(over = {}) {
  const r = renderer();
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 53, height: 110, colors: new Uint32Array(53 * 110) }),   // a person-sized sprite: 110 px stands about 2 m (eotb_body's own measure)
    loadLantern: async () => ART,
    ...over,
  });
  b.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);
  faceAway(b);
  return { b, r };
}
const state = (extra = {}, motion = {}) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8, ...motion }, feet: [0, 0, 0], yaw: 0, cameraPos: [0, 1.5, -2], ...extra });
const ticks = (b, n, s, dt = 1 / 60) => { for (let i = 0; i < n; i++) b.tick(dt, s); };
/** HT-WAIST-BACK: a step away from the camera and a stand, no lantern - the body keeps that facing, its back to the eye */
function faceAway(b) { ticks(b, 12, state({}, { forward: 1, standing: false, speed: 5 })); ticks(b, 12, state()); }
const view = { eye: [0, 1.5, -2], feet: [0, 0, 0], yaw: 0 };
/** draw until the body and the lantern's art are both up */
async function drawn(b) { for (let i = 0; i < 4; i++) { b.draw(null, view); await new Promise((res) => setTimeout(res, 2)); } return b.draw(null, view); }
const lanternDraws = (r) => r.draws.filter((d) => d.batch.archive === LANTERN_ART_KEY);

test('HT-WAIST (EOTB): the frame state carries the lantern at the waist - bodyState passes it through, and the rig hands it over (mutant: the field dropped)', () => {
  assert.equal(bodyState({ hipLantern: true }).hipLantern, true);
  assert.equal(bodyState({}).hipLantern, false);
  assert.match(rd('src/combat/weaponRig.js'), /hipLantern: !!entity && lanternAtWaist\(entity\.lightSource\),/);
});

test('HT-WAIST (EOTB): lit at the waist, a SECOND billboard - Daggerfall\'s lantern picture under its own key, hung from the sprite\'s right hip; without it, the body draws alone (mutant: the lantern never drawn, or drawn with no lantern at the waist)', async () => {
  const { b, r } = await liveBody();
  ticks(b, 12, state({ hipLantern: false }));
  assert.equal(await drawn(b), true);
  assert.equal(lanternDraws(r).length, 0, 'no lantern at the waist: no lantern drawn');
  assert.ok(r.batches.every((x) => x.archive !== LANTERN_ART_KEY), 'and no batch minted for one - the body\'s is the last batch');
  assert.equal(r.uploads.filter((u) => u.archive === LANTERN_ART_KEY).length, 0, 'nor its picture asked for');
  ticks(b, 12, state({ hipLantern: true }));
  await drawn(b);
  const up = r.uploads.find((u) => u.archive === LANTERN_ART_KEY);
  assert.ok(up, 'the picture uploaded under its own key');
  assert.equal(up.rec, 0); assert.equal(up.img.width, 10); assert.equal(up.img.height, 20);
  const ld = lanternDraws(r);
  assert.ok(ld.length >= 1, 'the lantern drawn');
  const d = ld.at(-1);
  assert.equal(d.size.h, HIP_LANTERN_SPRITE.height, 'its height in metres at scale 1 - hanging straight, full length');
  assert.equal(d.size.w, HIP_LANTERN_SPRITE.height * 10 / 20, 'the picture\'s own proportions');
  // the hook: the top-centre, on the facing's RIGHT (+X at yaw 0, the sprite facing +Z), at half the sprite's height
  const top = [d.origin[0] + d.up[0] * d.size.h, d.origin[1] + d.up[1] * d.size.h, d.origin[2] + d.up[2] * d.size.h];
  const placed = b.state().placed;
  assert.ok(top[0] > placed[0] + 0.15, `the right hip (${top[0]})`);
  assert.ok(top[1] > placed[1] + 0.3 && top[1] < placed[1] + 1.4, `at the hip's height above the sprite's base (${top[1] - placed[1]})`);
  assert.ok(top[2] < placed[2], 'nudged toward the eye (the camera stands at -Z), so it never shares the body\'s depth');
  [0, 1, 0].forEach((v, i) => assert.ok(Math.abs(d.up[i] - v) < 1e-12, 'still: upright'));
  // BillboardScale grows it with the body - a new batch at the new size, the old one freed
  setModSetting('eye-of-the-beholder', 'Animation.BillboardScale', 2);
  try {
    b.reload();
    ticks(b, 2, state({ hipLantern: true }));
    b.draw(null, view);
    assert.equal(lanternDraws(r).at(-1).size.h, HIP_LANTERN_SPRITE.height * 2, 'twice the body, twice the lantern');
    assert.equal(r.destroyed.filter((x) => x.archive === LANTERN_ART_KEY).length, 1, 'the batch minted at the old size is freed');
  } finally { _resetModSettings(); }
});

test('HT-WAIST (EOTB): it SWINGS with the sprite\'s walk - a walk begun tilts the quad in the view plane and shortens it as it swings toward or away from the eye; it settles upright at rest; HT-WAIST-BACK: seen from the side it is not drawn (mutant: the swing not stepped, or not drawn)', async () => {
  const { b, r } = await liveBody();
  ticks(b, 12, state({ hipLantern: true }));
  await drawn(b);
  // walking away from the camera (facing +Z, the camera behind at -Z): the lantern lags BACK, toward the eye
  ticks(b, 12, state({ hipLantern: true }, { forward: 1, standing: false, speed: 5 }));
  assert.ok(b.state().lantern.swing.fore < -0.05, 'the swing lags the walk');
  b.draw(null, view);
  const walk = lanternDraws(r).at(-1);
  assert.ok(walk.size.h < HIP_LANTERN_SPRITE.height - 1e-6, 'swinging along the line of sight: foreshortened');
  // turning to walk away and to the right of the screen (HT-WAIST-BACK: a back diagonal, orientation 3 - still seen
  // from behind): it swings across the view plane now - the quad tilts
  const diagonal = state({ hipLantern: true }, { forward: 1, strafe: 1, standing: false, speed: 5 });
  ticks(b, 40, diagonal);
  b.draw(null, view);
  assert.equal(b.state().shown.orientation, 3, 'a back diagonal');
  const tilt = lanternDraws(r).at(-1);
  assert.ok(Math.abs(tilt.up[0]) > 0.02, `the quad tilts (${tilt.up})`);
  assert.ok(Math.abs(Math.hypot(...tilt.up) - 1) < 1e-9 && Math.abs(tilt.right[0] * tilt.up[0] + tilt.right[1] * tilt.up[1] + tilt.right[2] * tilt.up[2]) < 1e-9, 'a rotation of the view plane\'s basis');
  // HT-WAIST-BACK's negative: walking straight to the right, the sprite is seen from its SIDE - it swings on, undrawn
  const drawnBefore = lanternDraws(r).length;
  ticks(b, 40, state({ hipLantern: true }, { forward: 0, strafe: 1, standing: false, speed: 5 }));
  b.draw(null, view);
  assert.equal(b.state().shown.orientation, 2, 'the side view');
  assert.equal(lanternDraws(r).length, drawnBefore, 'seen from the side: not drawn');
  assert.equal(b.state().lantern.hangs, true, 'but it still hangs');
  // back to walking away, then a long stand: it settles
  ticks(b, 12, state({ hipLantern: true }, { forward: 1, standing: false, speed: 5 }));
  ticks(b, 300, state({ hipLantern: true }));
  b.draw(null, view);
  const rest = lanternDraws(r).at(-1);
  assert.ok(Math.abs(rest.up[0]) < 0.01 && rest.size.h > HIP_LANTERN_SPRITE.height - 0.001, 'at rest again: upright, full length');
});

test('HT-WAIST (EOTB): it lights you from where it hangs, and stops the moment it is not drawn - put out, first person, the saddle, the beast, the body toggled off, another lane (mutant: the light point never written, or left behind)', async () => {
  setPlayerWaistLightOverride(null);
  try {
    const { b, r } = await liveBody();
    ticks(b, 12, state({ hipLantern: true }));
    await drawn(b);
    const o = playerWaistLightOverride();
    assert.ok(o, 'the light point written');
    assert.ok(o.left < 0 && o.up > 0.3, `the right hip, above the feet (${JSON.stringify(o)})`);
    const minted = r.batches.filter((x) => x.archive === LANTERN_ART_KEY).length;
    // put out: the batch goes (its owner frees it) and so does the light point
    ticks(b, 1, state({ hipLantern: false }));
    assert.equal(playerWaistLightOverride(), null, 'put out: the light point cleared');
    assert.equal(r.destroyed.filter((x) => x.archive === LANTERN_ART_KEY).length, minted, 'and the lantern\'s batch destroyed');
    // riding / the beast: not drawn, nothing written
    for (const s of [state({ hipLantern: true, riding: true }), state({ hipLantern: true, transformed: true })]) {
      ticks(b, 12, s);
      const before = lanternDraws(r).length;
      b.draw(null, view);
      assert.equal(lanternDraws(r).length, before, 'not on the rider\'s or the beast\'s sprite');
      assert.equal(playerWaistLightOverride(), null);
    }
    // toggled off (the camera into the head) and another lane (mwView's Morrowind branch)
    ticks(b, 12, state({ hipLantern: true }));
    b.draw(null, view);
    assert.ok(playerWaistLightOverride());
    b.toggle(false, false);
    assert.equal(playerWaistLightOverride(), null, 'the body toggled off: the light point goes with it');
    b.toggle(true, false);
    ticks(b, 12, state({ hipLantern: true }));
    b.draw(null, view);
    assert.ok(playerWaistLightOverride());
    b.standDown();
    assert.equal(playerWaistLightOverride(), null, 'another body has the frame: stood down');
    assert.match(rd('src/player/mwView.js'), /eotbBody\.standDown\(\);\n\s*\/\/ RIDE-POV/, 'and mwView\'s Morrowind lane stands it down each frame');
    // first person: the billboard is the first-person one - no lantern (HT-WAIST-BACK: it does not hang, whatever the view)
    const fp = await liveBody();
    fp.b.toggle(true, true);
    ticks(fp.b, 12, state({ hipLantern: true }));
    fp.b.draw(null, view);
    assert.equal(lanternDraws(fp.r).length, 0, 'first person: no lantern at the hip');
  } finally { setPlayerWaistLightOverride(null); }
});

test('HT-WAIST (EOTB): the picture is the Lantern template\'s own world texture - read off the template, never a literal; no data, no throw (mutant: the art door throwing, or a hard-wired record)', async () => {
  const t = templateByIndex(LANTERN_TEMPLATE);
  assert.deepEqual([t.worldTextureArchive, t.worldTextureRecord], [200, 10], 'TEXTURE.200 record 10, the shipping template\'s own');
  const src = rd('src/player/eotbLantern.js');   // HT-WAIST-BACK: the art door every EOTB sprite takes
  assert.match(src, /const t = templateByIndex\(LANTERN_TEMPLATE\);/);
  assert.doesNotMatch(src, /getDFBitmap\(10\b|texName\(200\)/, 'no literal record');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await loadLanternArt(), null, 'no ARENA2 in this container: null, never a throw'); } finally { console.warn = warn; }
  // and a failed art door leaves the body drawing without it
  const { b, r } = await liveBody({ loadLantern: async () => { throw new Error('gone'); } });
  ticks(b, 12, state({ hipLantern: true }));
  assert.equal(await drawn(b), true, 'the body still draws');
  assert.equal(lanternDraws(r).length, 0, 'the lantern does not, and nothing threw');
});
