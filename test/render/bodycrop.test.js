// BODY-CROP x MW-DETAIL (2026-10-22, a player's report: "when the player's camera gets too close to a morrowind 3d character
// model, the model starts to stretch in weird ways and it gets shorter", and "morrowind 3d models are always pixelated ...
// this should probably be optional") - bible/04-Characters/Morrowind-NPCs.md section 32.
//
// BODY-CROP: a Morrowind body's picture was an ortho down the eye's ray, laid on one quad square to that ray - the reverse
// of a perspective up close. It is now the main camera's own picture, cut to the window the body's box covers on the
// screen (render/characterSprite.js cropPicture), laid on that window's own rectangle (cropQuad) and written at the frame's
// own depth (renderer.js drawCharacterSpriteQuad `depth.window`). MW-DETAIL: the viewer's texel - Pixelated (MW_ARM_PIXEL)
// or Sharp (one pixel), the sprite target grown to hold a Sharp picture (renderer.js charSpriteRoom).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cropPicture, cropQuad, drawBodyPicture, drawRigSpriteBox, mwModelPixel } from '../../src/render/characterSprite.js';
import { Renderer, CHAR_SPRITE_RT_SIZE, CHAR_SPRITE_RT_MAX, MW_ARM_PIXEL } from '../../src/render/renderer.js';
import { multiply, perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { setPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../../src/systems/features.js';
import { CATEGORIES } from '../../src/ui/settings/settingsMap.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const canvas = { clientWidth: 1600, clientHeight: 1000 };
const W = canvas.clientWidth, H = canvas.clientHeight;
/** the street's lens (world.js): 0.2 to 6000, and mirrored in x as every world lens is (mat4.js mirrorProjectionX) */
const lens = (mirror = true) => { const p = perspective(Math.PI / 3, W / H, 0.2, 6000); return mirror ? mirrorProjectionX(p) : p; };
const ndc = (m, p) => { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w, w]; };

/** a renderer that keeps the picture's camera, size and quad - by the lone pass or the batch's queue */
function capturing(batch, extra = {}) {
  const c = {};
  return {
    c,
    characterSpriteBatchOpen: batch,
    queueCharacterSprite: (it) => Object.assign(c, { via: 'queue', op: it.proj, ov: it.view, pw: it.pw, ph: it.ph, at: it.quad.at, hw: it.quad.halfW, hh: it.quad.halfH, right: it.quad.right, up: it.quad.up, depth: it.quad.depth }),
    renderCharacterSprite: (mesh, model, op, ov, pw, ph) => { Object.assign(c, { via: 'lone', op, ov, pw, ph }); return {}; },
    drawCharacterSpriteQuad: (tex, at, hw, hh, right, u1, v1, hitFlash, conceal, up, origin, fx, depth) => Object.assign(c, { at, hw, hh, right, up, depth }),
    ...extra,
  };
}
/** where a world point is DRAWN: its picture NDC laid on the quad, along the quad's own axes */
const placer = (c) => { const mini = multiply(c.op, c.ov); return (p) => { const [nx, ny] = ndc(mini, p); return [0, 1, 2].map((k) => c.at[k] + c.right[k] * c.hw * nx + (c.up ?? [0, 1, 0])[k] * c.hh * ny); }; };

const EYE_H = 124 / 69.99125109;   // mwCamera FOCAL_HEIGHT, in metres
const BODY = { center: [0, 0.9, 0], halfW: 0.45, halfH: 0.95, anchor: [0, 0.9, 0] };   // a person, feet at the origin
const POINTS = [[0, 1.75, -0.15], [0.22, 1.45, -0.15], [-0.22, 1.45, -0.15], [0, 1.0, -0.15], [0.15, 0.5, -0.12], [0, 0.05, -0.1]];   // head, shoulders, waist, knee, foot - the side facing the eye
/** the third-person eye `d` metres behind the body at the focal height, looking level past its head */
const thirdPerson = (d) => { const eye = [0, EYE_H, -d]; return { eye, view: lookAt(eye, [0, EYE_H, 1], [0, 1, 0]) }; };

afterEach(() => { setPref('mwBillboardLook', false); setPref('mwModelDetail', 'pixel'); });

test('BODY-CROP: every point of the body is drawn where the main camera puts it - at 3 m and up close to mwCamera\'s MIN_DISTANCE (0.43 m), the world\'s mirrored lens and a plain one, the lone pass and the batch (unfixed, the leaned card at 1 m: the head 0.55 of the screen low and two-fifths too narrow)', () => {
  for (const mirror of [true, false]) {
    const proj = lens(mirror);
    for (const batch of [false, true]) {
      for (const d of [3, 1.5, 1, 0.75, 0.5, 30 / 69.99125109]) {
        const { eye, view } = thirdPerson(d);
        const r = capturing(batch);
        drawBodyPicture(r, canvas, null, null, BODY, proj, view, eye);
        assert.equal(r.c.via, batch ? 'queue' : 'lone', 'an open batch takes the picture (MWNPC2)');
        const place = placer(r.c), pv = multiply(proj, view);
        for (const p of POINTS) {
          const [tx, ty] = ndc(pv, p), [x, y] = ndc(pv, place(p));
          assert.ok(Math.hypot(x - tx, y - ty) < 1e-5, `${mirror ? 'mirrored' : 'plain'}, ${batch ? 'batch' : 'lone'}, ${d.toFixed(2)} m: ${p} drawn ${Math.hypot(x - tx, y - ty).toExponential(2)} off where it stands`);
        }
      }
    }
  }
  // the card it replaced (drawRigSpriteBox, leaned by BODY-LEAN), on the same eye: the report's shape
  const proj = lens(), { eye, view } = thirdPerson(1), r = capturing(false);
  drawRigSpriteBox(r, canvas, null, null, BODY, proj, view, eye, MW_ARM_PIXEL);
  const pv = multiply(proj, view), place = placer(r.c);
  const head = POINTS[0], [, ty] = ndc(pv, head), [, y] = ndc(pv, place(head));
  assert.ok(ty - y > 0.4, `the card drew the head ${(ty - y).toFixed(2)} of the screen below where it stands`);
  const wide = (q) => Math.abs(ndc(pv, q(POINTS[1]))[0] - ndc(pv, q(POINTS[2]))[0]);
  assert.ok(wide(place) / wide((p) => p) < 0.75, 'and its shoulders narrower than they are');
});

test('BODY-CROP: the window - the box\'s eight corners rounded OUT to whole texels counted from the image\'s corner, no wider than a texel past them; the crop moves x and y alone, so the picture\'s depth is the frame\'s', () => {
  const proj = lens(), { view } = thirdPerson(3);
  const pv = multiply(proj, view);
  for (const texel of [1, 3, 5]) {
    const pic = cropPicture(proj, view, BODY, texel, [W, H]);
    const [x0, y0, x1, y1] = pic.ndc;
    const px = (n, size) => (n + 1) / 2 * size;
    for (const v of [px(x0, W), px(x1, W), px(y0, H), px(y1, H)]) assert.ok(Math.abs(v / texel - Math.round(v / texel)) < 1e-9, `texel ${texel}: an edge at ${v} px is on the grid`);
    assert.equal(pic.pw * texel, Math.round(px(x1, W) - px(x0, W)), 'its columns');
    assert.equal(pic.ph * texel, Math.round(px(y1, H) - px(y0, H)), 'its rows');
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (let i = 0; i < 8; i++) {
      const [x, y] = ndc(pv, [BODY.center[0] + (i & 1 ? 1 : -1) * BODY.halfW, BODY.center[1] + (i & 2 ? 1 : -1) * BODY.halfH, BODY.center[2] + (i & 4 ? 1 : -1) * BODY.halfW]);
      lo = [Math.min(lo[0], x), Math.min(lo[1], y)]; hi = [Math.max(hi[0], x), Math.max(hi[1], y)];
    }
    // cut at the image's edge: from 3 m the feet stand below the screen
    assert.ok(lo[1] < -1, 'the fixture: the feet off the bottom');
    lo = lo.map((v) => Math.max(-1, v)); hi = hi.map((v) => Math.min(1, v));
    assert.ok(x0 <= lo[0] && y0 <= lo[1] && x1 >= hi[0] && y1 >= hi[1], 'every corner inside, as far as the image goes');
    assert.equal(y0, -1, 'the window stops at the image\'s bottom');
    const t = (k) => 2 * texel / k;
    assert.ok(lo[0] - x0 < t(W) && lo[1] - y0 < t(H) && x1 - hi[0] < t(W) && y1 - hi[1] < t(H), 'and no texel to spare');
    for (const k of [2, 3, 6, 7, 10, 11, 14, 15]) assert.equal(pic.proj[k], proj[k], `the crop's z and w rows are the lens's (${k})`);
    // a point through the crop, laid back over the window, is the point through the lens
    for (const p of POINTS) {
      const [cx, cy] = ndc(multiply(pic.proj, view), p), [mx, my] = ndc(pv, p);
      assert.ok(Math.abs(x0 + (cx + 1) / 2 * (x1 - x0) - mx) < 1e-6 && Math.abs(y0 + (cy + 1) / 2 * (y1 - y0) - my) < 1e-6, `${p}: the crop is the lens, stretched`);
    }
  }
  // padded by its tells' and outline's texels a side, given its rows before the pad - a body wholly on the screen
  const whole = lookAt([0, 1.2, -6], BODY.center, [0, 1, 0]);
  const plain = cropPicture(proj, whole, BODY, 3, [W, H]);
  const rows = [];
  const padded = cropPicture(proj, whole, BODY, 3, [W, H], (n) => { rows.push(n); return 4; });
  assert.deepEqual([padded.pw, padded.ph], [plain.pw + 8, plain.ph + 8], 'four texels a side');
  assert.equal(rows[0], plain.ph, 'the pad asked of the unpadded rows');
  const cut = cropPicture(proj, view, BODY, 3, [W, H]), cutPad = cropPicture(proj, view, BODY, 3, [W, H], () => 4);
  assert.deepEqual([cutPad.pw, cutPad.ph], [cut.pw + 8, cut.ph + 4], 'and none past the image\'s edge');
});

test('BODY-CROP: the box is cut at the near plane - an eye inside it takes the whole image, a body beside the eye only the window its seen part covers; a box wholly behind the eye or off the image takes nothing; a window past the target\'s room takes a coarser whole texel', () => {
  const proj = lens();
  const inside = lookAt([0, 1.2, -0.1], [0, 1.2, 1], [0, 1, 0]);
  const pic = cropPicture(proj, inside, BODY, 3, [W, H]);
  assert.deepEqual([pic.pw, pic.ph], [Math.ceil(W / 3), Math.ceil(H / 3)], 'the whole image, in whole texels');
  assert.deepEqual(pic.ndc.slice(0, 2), [-1, -1]);
  assert.equal(cropPicture(proj, lookAt([0, 1, 5], [0, 1, 10], [0, 1, 0]), BODY, 3, [W, H]), null, 'behind the eye');
  // a body at the eye's elbow, half behind it: the window its seen part covers - never the whole screen (a whole screen
  // of texels a frame for every body brushing past the camera)
  const cols = Math.ceil(W / 3);
  const beside = cropPicture(proj, lookAt([0.75, 1.2, -0.3], [0.75, 1.2, 1], [0, 1, 0]), BODY, 3, [W, H]);
  assert.ok(beside && beside.pw < cols / 2, `beside the eye: ${beside?.pw} columns of ${cols}`);
  // and one the eye stands half out of: its far corners alone span less than the screen; where its edges cross the near
  // plane, they reach both of its sides
  const straddled = cropPicture(proj, lookAt([0.2, 1.2, -0.3], [0.2, 1.2, 1], [0, 1, 0]), BODY, 3, [W, H]);
  assert.equal(straddled.pw, cols, 'the edges\' crossings of the near plane hold the window open');
  assert.equal(cropPicture(proj, lookAt([0, 1, -5], [10, 1, -4], [0, 1, 0]), BODY, 3, [W, H]), null, 'ahead of the eye, off the side of the image');
  const sharp = cropPicture(proj, inside, BODY, 1, [W, H], undefined, 1024);
  assert.ok(sharp.pw <= 1024 && sharp.ph <= 1024, 'inside the room');
  assert.equal(sharp.texel, 2, 'two pixels a texel - the first whole texel that fits 1600 columns in 1024');
  const r = capturing(false, { charSpriteRoom: (n) => { r.asked = n; return 1024; }, charSpriteEdge: 1024 });
  setPref('mwModelDetail', 'sharp');
  drawBodyPicture(r, canvas, null, null, BODY, proj, inside, [0, 1.2, -0.1]);
  assert.equal(r.asked, W, 'Sharp asked the target for the screen\'s width');
  assert.ok(r.c.pw <= 1024 && r.c.ph <= 1024, 'and drew what the target holds');
  const off = capturing(false);
  const diag = drawBodyPicture(off, canvas, null, null, BODY, proj, lookAt([0, 1, 5], [0, 1, 10], [0, 1, 0]), [0, 1, 5]);
  assert.deepEqual([off.c.op, diag.pw, diag.ph], [undefined, 0, 0], 'a body behind the eye draws nothing');
});

test('BODY-CROP: the quad - the window\'s rectangle on the plane square to the view at the anchor\'s distance, its axes the view\'s own and signed with the window\'s (mirrored or not); each corner projects onto its corner of the window', () => {
  for (const mirror of [true, false]) {
    const proj = lens(mirror), { view } = thirdPerson(2);
    const win = [-0.3, -0.8, 0.25, 0.4];
    const q = cropQuad(proj, view, win, BODY.anchor);
    const pv = multiply(proj, view);
    for (const [sx, sy, nx, ny] of [[-1, -1, win[0], win[1]], [1, -1, win[2], win[1]], [1, 1, win[2], win[3]], [-1, 1, win[0], win[3]]]) {
      const p = [0, 1, 2].map((k) => q.at[k] + q.right[k] * q.halfW * sx + q.up[k] * q.halfH * sy);
      const [x, y] = ndc(pv, p);
      assert.ok(Math.abs(x - nx) < 1e-6 && Math.abs(y - ny) < 1e-6, `${mirror ? 'mirrored' : 'plain'}: corner ${sx},${sy} lands on the window's`);
    }
    const back = [view[2], view[6], view[10]];
    const depthOf = (p) => -(back[0] * (p[0] - 0) + back[1] * (p[1] - EYE_H) + back[2] * (p[2] + 2));
    assert.ok(Math.abs(depthOf(q.at) - depthOf(BODY.anchor)) < 1e-6, 'at the anchor\'s distance ahead');
  }
});

test('BODY-CROP: the card stands only where one is asked for - the Billboard Look\'s upright card and the travel view\'s handed lean (drawRigSpriteBox, an ortho); otherwise the picture is the main camera\'s, and its quad writes the frame\'s own depth', () => {
  const proj = lens(), { eye, view } = thirdPerson(3);
  const crop = capturing(true);
  drawBodyPicture(crop, canvas, null, null, BODY, proj, view, eye);
  assert.deepEqual([...crop.c.ov], [...view], 'the main view');
  assert.equal(crop.c.op[11], -1, 'through a perspective');
  assert.deepEqual(crop.c.depth, { window: true }, 'the frame\'s own depth');
  const handed = capturing(true);
  drawBodyPicture(handed, canvas, null, null, { ...BODY, up: [0, 0.8, 0.6] }, proj, view, eye);
  assert.deepEqual([handed.c.op[11], handed.c.up], [0, [0, 0.8, 0.6]], 'the travel view\'s lean: the card');
  const flatLens = capturing(true);
  drawBodyPicture(flatLens, canvas, null, null, BODY, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), view, eye);
  assert.equal(flatLens.c.op?.[11], 0, 'a lens with no perspective (a probe\'s identity): the card, never a crop through a near plane it has not');
  setPref('mwBillboardLook', true);
  const card = capturing(true);
  drawBodyPicture(card, canvas, null, null, BODY, proj, view, eye);
  assert.deepEqual([card.c.op[11], card.c.up], [0, [0, 1, 0]], 'the Billboard Look: the upright card');
  // MW-DETAIL: a Sharp card up close runs far off the screen; it asks the target for the screen's rows at most
  setPref('mwModelDetail', 'sharp');
  const near = thirdPerson(0.5), asked = [];
  drawBodyPicture(capturing(true, { charSpriteRoom: (n) => { asked.push(n); return 1024; } }), canvas, null, null, BODY, proj, near.view, near.eye);
  assert.deepEqual(asked, [H], 'the screen\'s own rows, and no more');
});

test('MW-DETAIL: the texel - Pixelated, the default, MW_ARM_PIXEL (3) screen pixels; Sharp one; under retro a whole number of the image\'s pixels, never none', () => {
  const proj = lens(), { eye, view } = thirdPerson(3);
  assert.equal(mwModelPixel(), MW_ARM_PIXEL);
  const rows = (extra = {}) => { const r = capturing(false, extra); return drawBodyPicture(r, canvas, null, null, BODY, proj, view, eye); };
  const pix = rows();
  setPref('mwModelDetail', 'sharp');
  assert.equal(mwModelPixel(), 1);
  const sharp = rows();
  assert.ok(Math.abs(sharp.ph - 3 * pix.ph) < 6 && Math.abs(sharp.pw - 3 * pix.pw) < 6, `Sharp: three times the texels a side, each window rounded out to its own grid (${pix.pw}x${pix.ph} -> ${sharp.pw}x${sharp.ph})`);
  // retro: 1000 canvas rows shown by a 250-row image - a Sharp texel is one image pixel, a Pixelated one round(3 / 4) = 1
  const retro = rows({ retroImageSpan: [250, 1000], worldImageSize: [400, 250] });
  setPref('mwModelDetail', 'pixel');
  const retroPix = rows({ retroImageSpan: [250, 1000], worldImageSize: [400, 250] });
  assert.deepEqual([retroPix.pw, retroPix.ph], [retro.pw, retro.ph], 'one image pixel a texel either way');
  assert.ok(retro.ph > 1 && retro.ph < sharp.ph / 3, 'counted in the image\'s pixels');
});

/** a GL that records every call (mwnpc2_onepass.test.js's shape), MAX_TEXTURE_SIZE 8192 */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE1: 33985, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, FRAMEBUFFER: 36160, MAX_TEXTURE_SIZE: 3379, ARRAY_BUFFER: 34962 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'checkFramebufferStatus') return () => 36053;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return (p) => (p === 3379 ? 8192 : new Float32Array(4));
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 1600, clientHeight: 1000, width: 1600, height: 1000 } };
}

test('MW-DETAIL: the sprite target grows to the room a picture asks for - in steps of 256, never past CHAR_SPRITE_RT_MAX nor the GPU\'s own most, never smaller; the old target let go and the new one made at its next use; a batch queued before the growth packs and samples against the edge it finds at the flush', () => {
  const { calls, canvas: cv } = recordingGl();
  const r = new Renderer(cv);
  const made = () => calls.filter((c) => c[0] === 'texImage2D').map((c) => [c[4], c[5]]);
  calls.length = 0;
  const first = r._charSpriteRT();
  assert.deepEqual(made(), [[CHAR_SPRITE_RT_SIZE, CHAR_SPRITE_RT_SIZE], [CHAR_SPRITE_RT_SIZE, CHAR_SPRITE_RT_SIZE]], 'the colour and the depth at 1024');
  assert.equal(r.charSpriteRoom(900), CHAR_SPRITE_RT_SIZE, 'room already');
  assert.equal(r._charSpriteRT(), first, 'the same target');
  calls.length = 0;
  assert.equal(r.charSpriteRoom(1500), 1536, 'grown to the next 256');
  assert.deepEqual(calls.filter((c) => /^delete/.test(c[0])).map((c) => [c[0], c[1].id]), [['deleteFramebuffer', first.fbo.id], ['deleteTexture', first.tex.id], ['deleteTexture', first.depth.id]], 'the old one let go');
  assert.notEqual(r._charSpriteRT(), first, 'and made again');
  assert.deepEqual(made(), [[1536, 1536], [1536, 1536]]);
  assert.equal(r.charSpriteRoom(1200), 1536, 'never smaller');
  assert.equal(r.charSpriteRoom(100000), CHAR_SPRITE_RT_MAX, 'never past the most');
  assert.equal(r.charSpriteEdge, CHAR_SPRITE_RT_MAX);
  // the flush: a body queued at 1536, the target grown under it, packed and sampled against the edge the flush finds
  const proj = lens(), { eye, view } = thirdPerson(3);
  const r2 = new Renderer(recordingGl().canvas);
  r2.beginFrame(proj, view, new Float32Array([0.3, 0.8, 0.2]));
  r2.beginCharacterSpriteBatch();
  drawBodyPicture(r2, cv, { vao: { id: 'b' }, count: 3 }, new Float32Array(16), BODY, proj, view, eye);
  const it = r2._spriteBatch.items[0];
  r2.charSpriteRoom(3000);
  const spans = [];
  r2.drawCharacterSpriteQuad = (tex, at, hw, hh, right, u1, v1, hf, cc, up, origin) => spans.push([u1, v1, origin]);
  r2.flushCharacterSpriteBatch();
  assert.deepEqual(spans, [[it.pw / 3072, it.ph / 3072, [0, 0]]], 'its span over the grown edge');
});

test('BODY-CROP: the quad writes a window picture\'s depth as it stands (uDepthK w 2, no ray) and lays its corners along a right that tilts (a card\'s is level, as it was)', () => {
  const { calls, canvas: cv } = recordingGl();
  const r = new Renderer(cv);
  const cs = r._charSpriteRT();
  calls.length = 0;
  const right = [0.8, 0.6, 0];
  r.drawCharacterSpriteQuad(cs.tex, [0, 1, -5], 2, 1, right, 0.5, 0.5, 0, null, [-0.6, 0.8, 0], [0, 0], null, { window: true });
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4f' && c[1] === 'uDepthK').slice(2), [0, 0, 0, 2], 'the frame\'s own depth');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3f' && c[1] === 'uDepthDir').slice(2), [0, 0, 0], 'no ray');
  const v = calls.find((c) => c[0] === 'bufferSubData')[3];
  const corner = (i) => v.slice(i * 5, i * 5 + 3);
  const want = (sx, sy) => [0, 1, 2].map((k) => [0, 1, -5][k] + right[k] * 2 * sx + [-0.6, 0.8, 0][k] * sy);
  for (const [i, sx, sy] of [[0, -1, -1], [1, -1, 1], [2, 1, 1], [3, 1, -1]]) {
    assert.ok(corner(i).every((x, k) => Math.abs(x - want(sx, sy)[k]) < 1e-6), `corner ${i} along the tilted right`);
  }
  const fs = rd('src/render/renderer.js');
  assert.ok(fs.includes('  if (uDepthK.w > 1.5) return d;   // BODY-CROP: the frame\'s own depth, as the picture took it'), 'the shader takes the texel\'s depth');
  const body = fs.slice(fs.indexOf('float bodyDepth(float d) {'), fs.indexOf('// eliteRim\'s twin'));
  const floor = body.indexOf('return gl_FragCoord.z;   // AUDIT WEAPON-GLOW MW-1'), own = body.indexOf('if (uDepthK.w > 1.5) return d;');
  assert.ok(floor > 0 && own > floor, 'after the glow\'s floor: a ring or an ember keeps the quad\'s depth');
});

test('MW-DETAIL: the switch - a Features row, Morrowind Model Detail, enhanced, the viewer\'s own, Pixelated by default, beside the Billboard Look; read where each Morrowind picture is sized - the bodies and horses (drawBodyPicture), the first-person arm and the rider\'s horse in first person', () => {
  const row = FEATURES.find((f) => f.id === 'mw-model-detail');
  assert.ok(row, 'the row');
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online], ['world', ['enhanced'], 'prefs', 'mwModelDetail', 'pixel', 'player']);
  assert.deepEqual(row.control.tiers.map(([v, l]) => [v, l]), [['pixel', 'Pixelated'], ['sharp', 'Sharp']]);
  assert.equal(row.title, 'Morrowind Model Detail');
  assert.match(row.note, /full resolution/);
  assert.equal(FEATURE_PREF_DEFAULTS.mwModelDetail, 'pixel');
  assert.equal(PREF_DEFAULTS.mwModelDetail, 'pixel');
  assert.ok(JSON.stringify(CATEGORIES).includes('"feat:mw-billboard-look","feat:mw-model-detail"'), 'beside the Billboard Look');
  const arm = rd('src/combat/fpArm.js');
  const draw = arm.slice(arm.indexOf('    draw(canvas) {'), arm.indexOf('    status()'));
  assert.match(draw, /const pixel = mwModelPixel\(\);\s*\n\s*const wantW = canvas\.clientWidth \/ pixel;\s*\n\s*const wantH = canvas\.clientHeight \/ pixel;/, 'the first-person arm');
  assert.equal(arm.match(/drawBodyPicture\(renderer, canvas, thirdMesh, model, /g)?.length, 2, 'the body, and the rider with the horse');
  assert.ok(!/drawRigSpriteBox\(/.test(arm), 'and no card of its own');
  const horse = rd('src/world/horseRig.js');
  assert.match(horse, /drawBodyPicture\(renderer, canvas, h\.mesh, h\.model, \{ \.\.\.bx, up, conceal, hitFlash \}, proj, view, eye\);/, 'a horse alone');
  assert.match(horse, /const pixel = mwModelPixel\(\);[^\n]*\n\s*const wantW = canvas\.clientWidth \/ pixel, wantH = canvas\.clientHeight \/ pixel;\s*\n\s*const edge = renderer\.charSpriteRoom\?\.\(Math\.ceil\(Math\.max\(wantW, wantH\)\)\) \?\? CHAR_SPRITE_RT_SIZE;/, 'the rider\'s horse in first person, and its room');
});
