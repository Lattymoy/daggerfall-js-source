// BODY-LEAN (2026-10-12, the owner: "Theres an issue that when using morrowind models, depending on your camera position
// other sprites can shrink or grow, same goes for the horse"): every Morrowind body and 3D horse is a picture taken down
// the eye's pitched ray (render/characterSprite.js drawRigSpriteBox) - already the figure as that eye sees it - and was
// pasted on an UPRIGHT quad, which the same eye foreshortened a second time: a figure stood cos(pitch) of its height,
// 0.97 from a level third-person eye, 0.64 from a camera 50 degrees above it, 0.34 at 70. The quad now leans by the
// picture's own up (lookAt's y for the ray), so a figure draws its true size from wherever the camera stands; a lean
// the host hands (the travel view's, AUDIT OW4 J6) stands as handed. These pins route a figure through the pass's own
// ortho and quad onto the main camera - the chain every pixel of a body takes - by both doors: the lone pass and the
// batch (MWNPC2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawRigSpriteBox, pictureUp } from '../../src/render/characterSprite.js';
import { multiply, perspective, lookAt } from '../../src/world/mat4.js';

const canvas = { clientWidth: 1600, clientHeight: 1000 };
const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
const ndc = (m, p) => { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w]; };

/** a renderer that keeps the picture's camera and the quad, by the lone pass or the batch's queue */
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

/** a figure's drawn height on screen against its true one: the segment `lo`..`hi` through the picture's ortho, laid
 *  on the quad along its own up, then the main camera - over the segment as a mesh would draw it */
function drawnOverTrue(box, lo, hi, eye, batch, up = null) {
  const r = capturing(batch), c = r.c;
  const view = lookAt(eye, box.anchor ?? box.center, [0, 1, 0]);
  drawRigSpriteBox(r, canvas, null, null, { ...box, up }, proj, view, eye, 3);
  const mini = multiply(c.op, c.ov);
  const U = c.up ?? [0, 1, 0];
  const place = (p) => { const [nx, ny] = ndc(mini, p); return [0, 1, 2].map((k) => c.center[k] + c.right[k] * c.hw * nx + U[k] * c.hh * ny); };
  const pv = multiply(proj, view), scr = (p) => ndc(pv, p)[1];
  return { ratio: (scr(place(hi)) - scr(place(lo))) / (scr(hi) - scr(lo)), c };
}

const BODY = { center: [0, 0.9, 0], halfW: 0.45, halfH: 0.95, anchor: [0, 0.9, 0] };   // a person, feet at the origin
const HORSE = { center: [0.1, 0.85, 0], halfW: 1.3, halfH: 0.95, anchor: [0, 0.8, 0] };   // a horse, broadside to the eyes behind it
const EYES = [[0, 1.7, -3], [0, 1.7, -8], [0, 4, -4], [0, 8, -6], [0, 12, -4], [5, 7, 3]];   // level third person, far, then rising over it

test('BODY-LEAN (the owner: "depending on your camera position other sprites can shrink or grow, same goes for the horse"): a Morrowind body and a 3D horse draw their TRUE height from every camera - level, far, and from 4, 8 and 12 m up - by the lone pass and the batch alike (unfixed: cos(pitch) of it, 0.64 at 50 degrees, 0.34 at 70)', () => {
  for (const batch of [false, true]) {
    for (const eye of EYES) {
      const at = `${batch ? 'batch' : 'lone'}, eye ${eye}`;
      const body = drawnOverTrue(BODY, [0, 0, 0], [0, 1.8, 0], eye, batch).ratio;
      assert.ok(Math.abs(body - 1) < 0.02, `${at}: the body stands ${body.toFixed(3)} of its height`);
      const horse = drawnOverTrue(HORSE, [0.8, 0, 0], [0.8, 1.7, 0], eye, batch).ratio;   // a foreleg to the withers
      assert.ok(Math.abs(horse - 1) < 0.03, `${at}: the horse stands ${horse.toFixed(3)} of its height`);
    }
  }
});

test('BODY-LEAN: the quad leans by the picture\'s OWN up - lookAt\'s y for the ray it was taken down (world up from a level eye); a lean the host hands (the travel view\'s) stands as handed; pictureUp is unit, square to the ray and leans away from an eye above', () => {
  for (const batch of [false, true]) {
    for (const eye of EYES) {
      const { c } = drawnOverTrue(BODY, [0, 0, 0], [0, 1.8, 0], eye, batch);
      const y = [c.ov[1], c.ov[5], c.ov[9]];
      assert.ok(c.up.every((v, k) => Math.abs(v - y[k]) < 1e-6), `${batch ? 'batch' : 'lone'}, eye ${eye}: the quad's up ${c.up} is the picture's ${y}`);
    }
    const level = drawnOverTrue({ center: [0, 1.7, 0], halfW: 0.45, halfH: 0.95 }, [0, 0.8, 0], [0, 2.6, 0], [0, 1.7, -4], batch).c;
    assert.ok(Math.abs(level.up[1] - 1) < 1e-9 && Math.abs(level.up[2]) < 1e-9, 'a level eye: world up, as it stood');
    const handed = [0, 0.8, 0.6];
    assert.deepEqual(drawnOverTrue(BODY, [0, 0, 0], [0, 1.8, 0], [0, 8, -6], batch, handed).c.up, handed, 'the travel view\'s lean stands');
  }
  for (const dir of [[0, -0.6, 0.8], [0.3, -0.9, -0.2], [-2, 1, 1]]) {
    const u = pictureUp(dir), l = Math.hypot(...dir);
    assert.ok(Math.abs(Math.hypot(...u) - 1) < 1e-12, 'unit');
    assert.ok(Math.abs((u[0] * dir[0] + u[1] * dir[1] + u[2] * dir[2]) / l) < 1e-12, 'square to the ray');
    assert.ok(u[1] > 0, 'never upside down');
    if (dir[1] < 0) assert.ok(u[0] * dir[0] + u[2] * dir[2] > 0, 'looking down, it leans away from the eye');
  }
});
