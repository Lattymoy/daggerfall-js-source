// BODY-CARD (2026-10-14, the owner: "Reimplement the billboard morrowind look as a toggle"; asked which, the upright card
// BODY-LEAN replaced): THE BILLBOARD LOOK. Before BODY-LEAN every Morrowind body and 3D horse stood on an UPRIGHT card, as
// Daggerfall's flats do, so it drew cos(pitch) of its height - shorter as the camera rose over it. BODY-LEAN leaned the
// card by the picture's own up so a body keeps its true size from any eye. The Billboard Look (features.js
// mw-billboard-look, `mwBillboardLook`, off by default) stands the card upright again, read where the card is stood
// (render/characterSprite.js drawRigSpriteBox) - by the lone pass and the batch alike, at once. A lean the host hands
// (the travel view's, AUDIT OW4 J6) stands as handed either way.
// BODY-FLAT (2026-10-23, a player: "The billboard look still has the same issue"; asked, a true flat sprite): the upright
// card's picture is taken LEVEL, as a Daggerfall flat's art is drawn, so the body stands its true height from any eye -
// it drew cos(pitch) of it, and a sliver up close. PINS MOVED here: the cos(pitch) law is the one retired.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawRigSpriteBox } from '../../src/render/characterSprite.js';
import { multiply, perspective, lookAt } from '../../src/world/mat4.js';
import { setPref, getPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../../src/systems/features.js';
import { CATEGORIES, categoryOf } from '../../src/ui/settings/settingsMap.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const canvas = { clientWidth: 1600, clientHeight: 1000 };
const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
const ndc = (m, p) => { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w]; };

/** a renderer that keeps the picture's camera and the card, by the lone pass or the batch's queue (bodylean.test.js's) */
function capturing(batch) {
  const c = {};
  return {
    c,
    characterSpriteBatchOpen: batch,
    queueCharacterSprite: (it) => Object.assign(c, { op: it.proj, ov: it.view, center: it.quad.at, hw: it.quad.halfW, hh: it.quad.halfH, right: it.quad.right, up: it.quad.up }),
    renderCharacterSprite: (mesh, model, op, ov) => { Object.assign(c, { op, ov }); return {}; },
    drawCharacterSpriteQuad: (tex, center, hw, hh, right, u1, v1, hitFlash, conceal, up) => Object.assign(c, { center, hw, hh, right, up }),
  };
}
/** a body's drawn height on screen against its true one, through the picture's ortho, the card and the main camera */
function drawnOverTrue(eye, batch, up = null) {
  const box = { center: [0, 0.9, 0], halfW: 0.45, halfH: 0.95, anchor: [0, 0.9, 0], up };
  const r = capturing(batch), c = r.c;
  const view = lookAt(eye, box.anchor, [0, 1, 0]);
  drawRigSpriteBox(r, canvas, null, null, box, proj, view, eye, 3);
  const mini = multiply(c.op, c.ov);
  const U = c.up ?? [0, 1, 0];
  const place = (p) => { const [nx, ny] = ndc(mini, p); return [0, 1, 2].map((k) => c.center[k] + c.right[k] * c.hw * nx + U[k] * c.hh * ny); };
  const pv = multiply(proj, view), scr = (p) => ndc(pv, p)[1];
  return { ratio: (scr(place([0, 1.8, 0])) - scr(place([0, 0, 0]))) / (scr([0, 1.8, 0]) - scr([0, 0, 0])), c };
}
afterEach(() => { setPref('mwBillboardLook', false); });

test('BODY-CARD x BODY-FLAT: the Billboard Look stands every body\'s card upright - world up, by the lone pass and the batch - with its picture taken level, so a body draws its true height from any eye, up close too (before BODY-FLAT: cos(pitch) of it, a sliver up close); off (the default) the card leans and the body keeps its true height', () => {
  for (const batch of [false, true]) {
    for (const [eye, pitch] of [[[0, 1.7, -3], Math.atan2(0.8, 3)], [[0, 8, -6], Math.atan2(7.1, 6)], [[0, 12, -4], Math.atan2(11.1, 4)]]) {
      const at = `${batch ? 'batch' : 'lone'}, eye ${eye}`;
      assert.equal(getPref('mwBillboardLook'), false, 'off by default');
      const leaned = drawnOverTrue(eye, batch);
      assert.ok(Math.abs(leaned.ratio - 1) < 0.02, `${at}, off: ${leaned.ratio.toFixed(3)} of its height`);
      assert.ok(leaned.c.up[1] < 1 - 1e-6 || pitch < 0.3, `${at}, off: the card leans`);
      setPref('mwBillboardLook', true);
      const upright = drawnOverTrue(eye, batch);
      assert.deepEqual(upright.c.up, [0, 1, 0], `${at}, on: the card upright`);
      assert.ok(Math.abs(upright.c.ov[6]) < 1e-9, `${at}, on: the picture taken level`);
      assert.ok(Math.abs(upright.ratio - 1) < 0.02, `${at}, on: ${upright.ratio.toFixed(3)} of its height, where cos(pitch) is ${Math.cos(pitch).toFixed(3)}`);
      // the travel view's lean stands as handed, the look on or off - and its picture is taken down the pitched ray
      const handed = [0, 0.8, 0.6];
      const handedOn = drawnOverTrue(eye, batch, handed).c;
      assert.deepEqual(handedOn.up, handed, `${at}, on: the handed lean stands`);
      assert.ok(Math.abs(handedOn.ov[6]) > 0.1, `${at}, on: the handed lean's picture is the pitched one, not the flat's`);
      setPref('mwBillboardLook', false);
      assert.deepEqual(drawnOverTrue(eye, batch, handed).c.up, handed, `${at}, off: the handed lean stands`);
    }
    // up close - the third-person eye at mwCamera's MIN_DISTANCE behind the head, the ray to the body's middle 62 degrees
    // down: the flat card stands the body true (before BODY-FLAT it drew 0.16 of it)
    setPref('mwBillboardLook', true);
    try {
      const near = drawnOverTrue([0, 1.77, -0.43], batch);
      assert.ok(Math.abs(near.ratio - 1) < 0.02, `${batch ? 'batch' : 'lone'}, up close: ${near.ratio.toFixed(3)} of its height`);
    } finally { setPref('mwBillboardLook', false); }
  }
});

test('BODY-FLAT: a body nearly or straight below the eye - the flat\'s picture is taken level from its full reach, never from inside its box, and straight over the body along the view\'s own heading', () => {
  setPref('mwBillboardLook', true);
  try {
    for (const eye of [[0.01, 8, 0.01], [0, 8, 0]]) {
      const r = capturing(false), c = r.c;
      const view = lookAt(eye, [eye[0], 0.9, eye[2] + 1], [0, 1, 0]);   // looking down toward +z, the body under the eye
      drawRigSpriteBox(r, canvas, null, null, { center: [0, 0.9, 0], halfW: 0.45, halfH: 0.95, anchor: [0, 0.9, 0] }, proj, view, eye, 3);
      const ov = c.ov;
      assert.ok([...ov].every(Number.isFinite), `eye ${eye}: a picture camera with no NaN`);
      const mini = [0, 1, 2].map((k) => -(ov[k * 4] * ov[12] + ov[k * 4 + 1] * ov[13] + ov[k * 4 + 2] * ov[14]));
      const back = Math.hypot(mini[0], mini[1] - 0.9, mini[2]);
      assert.ok(back > 4 - 1e-4, `eye ${eye}: the picture's camera ${back.toFixed(3)} m off the body's middle - its full reach, outside the box`);
      assert.ok(Math.abs(ov[6]) < 1e-6, `eye ${eye}: level`);
    }
  } finally { setPref('mwBillboardLook', false); }
});

test('BODY-CARD: the switch - a Features row, Billboard Look, enhanced, the viewer\'s own and off by default, in Combat > With Morrowind data beside Morrowind People; read where the card is stood, so it takes effect at once', () => {
  const row = FEATURES.find((f) => f.id === 'mw-billboard-look');
  assert.ok(row, 'the row');
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online], ['world', ['enhanced'], 'prefs', 'mwBillboardLook', false, 'player']);
  assert.equal(row.title, 'Billboard Look');
  assert.match(row.note, /upright/);
  assert.equal(FEATURE_PREF_DEFAULTS.mwBillboardLook, false);
  assert.equal(PREF_DEFAULTS.mwBillboardLook, false);
  assert.ok(JSON.stringify(CATEGORIES).includes('"feat:mw-npc-bodies","feat:mw-billboard-look"'), 'beside Morrowind People');
  assert.equal(categoryOf('feat:mw-billboard-look'), categoryOf('feat:mw-npc-bodies'));
  // PIN MOVED (BODY-FLAT, 2026-10-23): the switch is read once - the card's flatness, its level picture and its upright
  assert.match(src('src/render/characterSprite.js'), /const flat = up == null && !!getPref\('mwBillboardLook'\);/);
  assert.match(src('src/render/characterSprite.js'), /const qUp = up \?\? \(flat \? WORLD_UP : pictureUp\(camDir\)\);/);
});
