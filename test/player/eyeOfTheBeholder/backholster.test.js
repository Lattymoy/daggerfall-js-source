// BACK-HOLSTER (2026-10-30, Mac: "For layered/skins in third person. I want to implement back holstered weapon visuals
// for the sprites which rotate on the back properly in all directions"). The law is player/eyeOfTheBeholder/eotbHolster.js:
// which weapons ride the back, the picture stood upright, the line across the back laid into each of the eight views,
// and the batch. Driven through the real body (createEotbBody) and the real walker layer (createPeerWalkers) with fakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOLSTER_HAND_SLOT, BACK_HOLSTER, PAPERDOLL_MPP, holstersOnBack, holsterItemOfLook, uprightWeaponPicture, hangSpriteHolster,
  createSpriteHolster, createHolsterArt, HOLSTER_ART_KEPT, redrawHolstersOver, mintSpriteHolster, dropSpriteHolster,
  HOLSTER_ART_HOLD_MS, HOLSTER_RETRY_MS, SELF_OWNER, drawAurasThenBacks,
} from '../../../src/player/eyeOfTheBeholder/eotbHolster.js';
import { createSpriteBacks, createSpriteGlow, setSpriteGlow } from '../../../src/player/eyeOfTheBeholder/eotbGlow.js';
import { batchSphere } from '../../../src/render/bounds.js';
import { readFileSync } from 'node:fs';
import { EOTB_FIGURE, auraSpriteAcross, auraShiftAcross } from '../../../src/render/auraRing.js';
import { spriteMarks } from '../../../src/render/armoryPose.js';
import { EQUIP_SLOTS } from '../../../src/systems/equip.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { createPeerWalkers, createEotbArt } from '../../../src/net/peer/peerRiders.js';
import { PISTOLET_TEMPLATE, THUNDERLOCK_TEMPLATE } from '../../../src/characters/thunderlockIds.js';

const EIGHT = [0, 1, 2, 3, 4, 5, 6, 7];
const settle = (ms = 5) => new Promise((res) => setTimeout(res, ms));
const T = BACK_HOLSTER.tilt;

/** The camera for view `o` of a figure facing +Z at `feet` (orientationFor's wheel: 0 in front, 4 behind). */
function cameraFor(o, feet, nudge = 0, turn = 0) {
  const a = o * Math.PI / 4 + nudge + turn, tc = [Math.sin(a), 0, Math.cos(a)];   // `turn`: the figure faces that yaw
  const yaw = Math.atan2(-tc[0], -tc[2]);
  return { eye: [feet[0] + 2 * tc[0], feet[1] + 1.5, feet[2] + 2 * tc[2]], yaw, right: [Math.cos(yaw), 0, -Math.sin(yaw)] };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const flatDist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

test('BACK-HOLSTER: the weapon hand is EQUIP_SLOTS.RightHand, and the back carries the long blades, axes, blunt weapons, staffs, bows and the Thunderlock - not a short blade, an arrow, the Pistolet or anything not a weapon (mutants: a skill dropped; the short blades let in)', () => {
  assert.equal(HOLSTER_HAND_SLOT, EQUIP_SLOTS.RightHand);
  const riding = [];
  for (let t = 113; t <= 131; t++) if (holstersOnBack({ templateIndex: t })) riding.push(t);
  assert.deepEqual(riding, [115, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130],
    'Staff, Broadsword .. Long Bow - never the Dagger (113), Tanto (114), Shortsword (116), Wakizashi (117) nor the Arrow (131)');
  assert.equal(holstersOnBack({ templateIndex: THUNDERLOCK_TEMPLATE }), true, 'the Thunderlock, fired on Archery');
  assert.equal(holstersOnBack({ templateIndex: PISTOLET_TEMPLATE }), false, 'the Pistolet is a hand gun');
  for (const junk of [null, undefined, {}, { templateIndex: 'x' }, { templateIndex: 0 }]) assert.equal(holstersOnBack(junk), false);
  const sword = { templateIndex: 120, equipSlot: 19 };
  assert.equal(holsterItemOfLook([{ templateIndex: 101, equipSlot: 21 }, sword]), sword);
  assert.equal(holsterItemOfLook([{ templateIndex: 101, equipSlot: 21 }]), null);
  assert.equal(holsterItemOfLook(null), null);
});

/** A color32 picture (row 0 the bottom) with the pixels `on(x, y)` answers, coloured by `rgb(x, y)`. */
function picture(W, H, on, rgb = () => [200, 200, 200]) {
  const colors = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    const o = (y * W + x) * 4, [r, g, b] = rgb(x, y);
    colors[o] = r; colors[o + 1] = g; colors[o + 2] = b; colors[o + 3] = 255;
  }
  return { width: W, height: H, colors };
}
/** The opaque rows of an upright picture, and the widest. */
function rowsOf(p) {
  const widths = [];
  for (let y = 0; y < p.height; y++) { let n = 0; for (let x = 0; x < p.width; x++) if (p.colors[(y * p.width + x) * 4 + 3]) n++; widths.push(n); }
  return widths;
}

test('BACK-HOLSTER picture: a slanted sword stands upright, its guard (the widest end) on top, at the sprites\' pixel size - and turned end for end it stands the same way up; a mirror is its columns reversed (mutants: no flip to the widest end; the step dropped)', () => {
  // a blade from (6, 6) up to (66, 66) (row 0 the bottom), its guard across it near the upper end
  const onBlade = (x, y) => Math.abs(x - y) <= 1 && x >= 6 && x <= 66;
  const guardAt = (c) => (x, y) => Math.abs(x + y - 2 * c) <= 1 && Math.abs(x - y) <= 12;
  for (const [name, guard] of [['guard up-right', 56], ['guard down-left', 16]]) {
    const p = uprightWeaponPicture(picture(72, 72, (x, y) => onBlade(x, y) || guardAt(guard)(x, y)));
    assert.ok(p, name);
    const len = Math.hypot(60, 60) + 1, step = EOTB_FIGURE.mpp / PAPERDOLL_MPP;
    assert.ok(Math.abs(p.height - Math.ceil(len / step)) <= 2, `${name}: ${p.height} rows - the blade's length at the sprites' texel (${step.toFixed(2)} source px)`);
    assert.ok(p.width <= 15, `${name}: ${p.width} wide - stood upright, not on its slant`);
    const widths = rowsOf(p), widest = widths.indexOf(Math.max(...widths));
    assert.ok(widest > p.height * 0.6, `${name}: the guard (row ${widest} of ${p.height}) is in the top - row 0 is the bottom`);
    assert.ok(Math.abs(p.h - p.height * step * PAPERDOLL_MPP) < 1e-9 && Math.abs(p.w - p.width * step * PAPERDOLL_MPP) < 1e-9, 'its quad, in metres');
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      for (let k = 0; k < 4; k++) assert.equal(p.mirror[(y * p.width + x) * 4 + k], p.colors[(y * p.width + (p.width - 1 - x)) * 4 + k]);
    }
  }
  assert.equal(uprightWeaponPicture(picture(4, 4, (x, y) => x === y && x < 3)), null, 'three pixels are no weapon');
  assert.equal(uprightWeaponPicture(null), null);
});

test('BACK-HOLSTER picture: stood up by a half turn, never a mirror - an axe head on the haft\'s right stays on its right; the haft, not the head, is the axis (mutants: the turn made a flip; a mean axis pulled off the haft)', () => {
  // a haft up the middle (x 20, y 0..60) with a heavy head on its right near the top
  const axe = (x, y) => (Math.abs(x - 20) <= 1 && y <= 60) || (x >= 21 && x <= 34 && y >= 44 && y <= 58);
  const grey = () => [150, 150, 150];
  /** the head's pixels right of the haft (the fullest column) less those left of it */
  const side = (p) => {
    const col = (x) => { let n = 0; for (let y = 0; y < p.height; y++) if (p.colors[(y * p.width + x) * 4 + 3]) n++; return n; };
    let haft = 0;
    for (let x = 1; x < p.width; x++) if (col(x) > col(haft)) haft = x;
    let left = 0, right = 0;
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.colors[(y * p.width + x) * 4 + 3] && Math.abs(x - haft) > 1) (x < haft ? left++ : right++);
    return right - left;
  };
  const up = uprightWeaponPicture(picture(40, 64, axe, grey));
  assert.ok(side(up) > 0, 'upright already: the head on the haft\'s right');
  // the same axe turned end for end (head at the bottom, on the haft's left): a half turn puts it back as it was
  const turned = uprightWeaponPicture(picture(40, 64, (x, y) => axe(39 - x + 1, 63 - y), grey));
  assert.ok(side(turned) > 0, 'turned end for end and stood up again: the head on the right, as a half turn leaves it');
  // the haft is the axis: a column of the picture holds it whole
  let longest = 0;
  for (let x = 0; x < up.width; x++) { let n = 0; for (let y = 0; y < up.height; y++) if (up.colors[(y * up.width + x) * 4 + 3]) n++; longest = Math.max(longest, n); }
  assert.ok(longest >= up.height - 2, `the haft stands straight up a column (${longest} of ${up.height})`);
});

const FEET = [4, 0.5, 9];
const FIG = Object.freeze({ base: 0, mpp: EOTB_FIGURE.mpp, marks: null, shift: 0 });
const ART = Object.freeze({ w: 0.2, h: 1.4, archive: 'eotb-holster:t' });
/** The weapon's line as hung for view `o` - its slant along the view's right, its drawn length, its middle and ends. */
function hungFrom(o, { fig = FIG, nudge = 0, turn = 0 } = {}) {
  const cam = cameraFor(o, FEET, nudge, turn);
  const l = hangSpriteHolster(createSpriteHolster(), fig, o, FEET, cam.eye, cam.right, ART);
  assert.ok(l, `view ${o}: it hangs`);
  const top = [l.origin[0] + l.up[0] * l.h, l.origin[1] + l.up[1] * l.h, l.origin[2] + l.up[2] * l.h];
  return { l, cam, slant: dot(l.up, cam.right), top };
}

test('BACK-HOLSTER hang: the line across the back turns with the view - from behind its upper end leans to the screen\'s right (the right shoulder), from the front to the left and mirrored, from the side it stands upright and shortened; the diagonals between (mutants: the facing ignored; the tilt\'s sign; the side not shortened)', () => {
  const s = EIGHT.map((o) => hungFrom(o));
  const sinT = Math.sin(T), cosT = Math.cos(T);
  // the slant seen: sin T times the cosine between the figure's right and the view's right, over the drawn length
  for (const o of EIGHT) {
    const c = Math.cos(o * Math.PI / 4 + Math.PI);   // the figure's right against the view's: +1 from behind (4), -1 in front (0)
    const len = Math.hypot(sinT * c, cosT);
    assert.ok(Math.abs(s[o].slant - (sinT * c) / len) < 1e-9, `view ${o}: slant ${s[o].slant.toFixed(4)}`);
    assert.ok(Math.abs(s[o].l.h - ART.h * len) < 1e-9, `view ${o}: drawn ${s[o].l.h.toFixed(4)} m of ${ART.h}`);
    assert.ok(Math.abs(dot(s[o].l.up, s[o].l.right)) < 1e-12 && Math.abs(Math.hypot(...s[o].l.up) - 1) < 1e-12, 'a turn of the view plane, not a shear');
  }
  assert.ok(s[4].slant > 0.5 && s[3].slant > 0 && s[5].slant > 0, 'from behind and its diagonals: toward the screen\'s right');
  assert.ok(s[0].slant < -0.5 && s[1].slant < 0 && s[7].slant < 0, 'from the front and its diagonals: toward the left');
  assert.ok(Math.abs(s[2].slant) < 1e-9 && Math.abs(s[6].slant) < 1e-9, 'from the side: upright');
  assert.ok(Math.abs(s[2].l.h - ART.h * cosT) < 1e-9, 'and as long as the line stands tall');
  assert.deepEqual(EIGHT.filter((o) => s[o].l.mirror), [0, 1, 7], 'its other face from the front and its three-quarters');
  // the upper end stands the same height over the shoulders from every side
  const topY = FEET[1] + EOTB_FIGURE.shoulder * EOTB_FIGURE.mpp + BACK_HOLSTER.over * ART.h * cosT;
  for (const o of EIGHT) assert.ok(Math.abs(s[o].top[1] - topY) < 1e-9, `view ${o}: top at ${s[o].top[1].toFixed(3)}`);
});

test('BACK-HOLSTER hang: before the card only where the eye sees the back (3, 4, 5); behind it from the front, its diagonals and the side, so the body covers it where they meet - and from the side just past the PAINTED back, as deep as the picture draws it (Mac: "On the side facing, the holstered weapon is wrong and overlays the body") (mutants: no back offset; the nudge one way everywhere; the picture\'s depth ignored)', () => {
  for (const turn of [0, Math.PI / 2, 2.2]) {
    for (const o of EIGHT) {
      const { l, cam } = hungFrom(o, { turn });
      const nearer = flatDist(cam.eye, FEET) - flatDist(cam.eye, l.mid);
      if ([3, 4, 5].includes(o)) assert.ok(nearer > 0.05, `facing ${turn.toFixed(2)}, view ${o}: ${nearer.toFixed(3)} m before the card`);
      else assert.ok(nearer < -0.01, `facing ${turn.toFixed(2)}, view ${o}: ${(-nearer).toFixed(3)} m behind the card`);
    }
  }
  // a side view whose picture paints its torso 12 px either side of its middle, the middle 8 px off the quad's
  const fig = { ...FIG, marks: { chest: 8, chestHalf: 12 }, shift: 0 };
  for (const o of [2, 6]) {
    const { l, cam } = hungFrom(o, { fig });
    const fwd = o === 2 ? 1 : -1;   // the figure faces +Z; seen from +X (view 2) +Z is the view's right
    const body = 8 * EOTB_FIGURE.mpp, off = dot([l.mid[0] - FEET[0], 0, l.mid[2] - FEET[2]], cam.right) - body;
    assert.ok(Math.abs(off - -fwd * (12 * EOTB_FIGURE.mpp + BACK_HOLSTER.clear)) < 0.01, `view ${o}: ${off.toFixed(3)} m from the painted middle - just past its back`);
    assert.ok(flatDist(cam.eye, FEET) - flatDist(cam.eye, l.mid) < 0, `view ${o}: behind the card`);
  }
  const front = hungFrom(0, { fig }), plain = hungFrom(0);
  assert.ok(Math.abs(flatDist(front.cam.eye, front.l.mid) - flatDist(plain.cam.eye, plain.l.mid)) < 0.01, 'the picture\'s depth is a side view\'s alone');
});

test('BACK-HOLSTER the painted body: spriteMarks reads the torso\'s half width (`chestHalf`); auraSpriteAcross is where the painted body stands along the view\'s right - one law for the holster and the cape; auraShiftAcross moves a cape there and back; the aura host moves the capes for the pass alone (Mac: "Why is the cape backwards on the side facing?") (mutants: the half a whole; the shift ignored; the cape never moved; never moved back)', () => {
  const w = 60, h = 110, px = new Uint32Array(w * h), A = 0xff000000;
  const fill = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * w + x] = A; };
  fill(30, 49, 0, 90); fill(36, 43, 91, 104);   // a torso 20 px wide, its middle at 39.5 (10 px right of the picture's), and a head
  const m = spriteMarks(px, w, h, { arms: false });
  assert.equal(m.chestHalf, 10, 'half the torso\'s 20 px');
  assert.equal(m.chest, 10, 'its middle, 10 px off the picture\'s');
  assert.equal(auraSpriteAcross({ base: 0, mpp: 0.02, marks: m, shift: 0.1 }), 0.1 + 10 * 0.02, 'the quad\'s offset and the chest, in metres');
  assert.equal(auraSpriteAcross({ base: 0, mpp: 0.02, marks: { ...m, art: 2 }, shift: 0 }), 10 * 0.02, 'a mark is the picture\'s own pixels - never scaled by the art');
  assert.equal(auraSpriteAcross(null), 0);
  const wearer = { at: [1, 2, 3], across: 0.5 }, still = { at: [4, 5, 6] };
  auraShiftAcross([wearer, still], [0, 0, 1], 1);
  assert.deepEqual([wearer.at, still.at], [[1, 2, 3.5], [4, 5, 6]], 'along the view\'s right, the height kept; one with none stays');
  auraShiftAcross([wearer, still], [0, 0, 1], -1);
  assert.deepEqual(wearer.at, [1, 2, 3], 'and back');
  const host = readFileSync(new URL('../../../src/scenes/auraHost.js', import.meta.url), 'utf8');
  const on = host.indexOf('auraShiftAcross(auraDraw, acrossRight, 1)'), pass = host.indexOf('drawAurasThenBacks(auraDraw,'), off = host.indexOf('} finally { auraShiftAcross(auraDraw, acrossRight, -1); }');
  assert.ok(on > 0 && pass > on && off > pass, 'scenes/auraHost.js: moved for the pass, and back after it - AUDIT A9: whatever the pass did');
  assert.match(host, /w\.across = auraLookOf\(w\.aura\)\.mesh \? auraSpriteAcross\(/, 'a cape or wings alone - a ring at the feet stays at the feet');
});

test('BACK-HOLSTER hang: glued to the picture - turning the eye within one view changes nothing of the slant or the length (the picture\'s facing, portrayedYaw), and it centres on the painted body and grows with the sprite (mutants: the walk\'s own facing; marks ignored; the scale ignored)', () => {
  for (const o of EIGHT) {
    const a = hungFrom(o), b = hungFrom(o, { nudge: 0.3 });
    assert.ok(Math.abs(a.slant - b.slant) < 1e-9 && Math.abs(a.l.h - b.l.h) < 1e-9, `view ${o}: as the picture stands`);
  }
  const plain = hungFrom(4), shifted = hungFrom(4, { fig: { ...FIG, marks: { chest: 10 }, shift: 0.05 } });
  const moved = [0, 1, 2].map((k) => shifted.l.mid[k] - plain.l.mid[k]);
  const want = 0.05 + 10 * EOTB_FIGURE.mpp;
  assert.ok(Math.abs(dot(moved, plain.cam.right) - want) < 1e-9 && Math.abs(moved[1]) < 1e-9, 'across to the painted body\'s middle');
  const big = hungFrom(4, { fig: { ...FIG, mpp: EOTB_FIGURE.mpp * 2 } });
  assert.ok(Math.abs(big.l.h - plain.l.h * 2) < 1e-9 && Math.abs(big.l.w - plain.l.w * 2) < 1e-9, 'a sprite drawn twice the size carries a weapon twice the size');
  const c = cameraFor(4, FEET);
  assert.equal(hangSpriteHolster(createSpriteHolster(), null, 4, FEET, c.eye, c.right, ART), null, 'no figure, no hang');
  assert.equal(hangSpriteHolster(createSpriteHolster(), FIG, 4, FEET, null, c.right, ART), null, 'no eye, no hang');
});

function recordingRenderer() {
  return {
    _frameStamp: 1, depth: [],
    gl: { LESS: 513, LEQUAL: 515, depthFunc(f) { this.owner.depth.push(f); }, owner: null },
    uploads: [], batches: [], draws: [], destroyed: [], evicted: [], textures: new Map(),
    uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); this.textures.set(`${archive}_${rec}`, img); },
    evictTexture(key) { this.evicted.push(key); this.textures.delete(key); },
    createBillboardBatch(archive, record, size) { const b = { archive, record, size: { ...size }, origin: [0, 0, 0] }; this.batches.push(b); return b; },
    destroyBillboardBatch(b) { this.destroyed.push(b); },
    drawBillboards(batches, right, up) { this.draws.push({ batch: batches[0], archive: batches[0].archive, record: batches[0].record, right: [...right], up: [...up], noShadow: !!batches[0].noShadow, depth: this.depth.at(-1) ?? 513 }); },
  };
}
const renderer = () => { const r = recordingRenderer(); r.gl.owner = r; return r; };
const isHolster = (a) => typeof a === 'string' && a.startsWith('eotb-holster:');
const PIC = uprightWeaponPicture(picture(40, 64, (x, y) => (Math.abs(x - 20) <= 1 && y <= 60) || (x >= 21 && x <= 34 && y >= 44 && y <= 58)));
const LONGSWORD = { templateIndex: 120, group: 'Weapons', equipSlot: 19, material: 1 };

test('BACK-HOLSTER picture store: asked once while it loads, uploaded as drawn and mirrored, uploaded again when the renderer let it go; AUDIT A1: a crowd of more weapons than it keeps grows it, and only a picture unasked HOLSTER_ART_HOLD_MS goes, down to HOLSTER_ART_KEPT (both faces); A3: one that did not come is asked again after HOLSTER_RETRY_MS (mutants: asked every frame; no eviction; a picture on screen let go; never asked again; asked again at once)', async () => {
  const r = renderer();
  let asked = 0, now = 0;
  const store = createHolsterArt(() => r, async () => { asked++; return PIC; }, () => now);
  for (let i = 0; i < 3; i++) assert.equal(store.ensure(LONGSWORD, null), null);   // no wearer named: the pack's default
  await settle();
  const a = store.ensure(LONGSWORD, null);
  assert.ok(a && isHolster(a.archive) && asked === 1, 'one ask, coalesced');
  assert.deepEqual(r.uploads.map((u) => [u.archive === a.archive, u.rec]), [[true, 0], [true, 1]], 'as drawn, and mirrored');
  r.evictTexture(`${a.archive}_0`);
  store.ensure(LONGSWORD, null);
  assert.ok(r.textures.has(`${a.archive}_0`), 'let go by the renderer: uploaded again from the kept pixels');
  r.evicted.length = 0;
  const crowd = [LONGSWORD, ...[115, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128].map((t) => ({ ...LONGSWORD, templateIndex: t }))];   // twelve pictures
  for (let f = 0; f < 3; f++) { for (const it of crowd) store.ensure(it, null); await settle(); now += HOLSTER_ART_HOLD_MS / 2; }
  assert.equal(store.size, crowd.length, 'every one on screen kept');
  assert.ok(crowd.every((it) => store.ensure(it, null)) && r.evicted.length === 0, 'and up - none taking its turn letting another go');
  store.ensure({ ...LONGSWORD, material: 2 }, null);
  assert.ok(store.size === crowd.length + 1 && r.evicted.length === 0, 'asked every frame, long past the hold since first asked: still kept');
  now += HOLSTER_ART_HOLD_MS;
  store.ensure({ ...LONGSWORD, material: 3 }, null);
  assert.equal(store.size, HOLSTER_ART_KEPT, 'unasked past the hold: the oldest go, down to what it keeps');
  assert.ok(r.evicted.includes(`${a.archive}_0`) && r.evicted.includes(`${a.archive}_1`), 'the oldest picture let go, both faces');
  // A3: none, too slow, or a throw - asked again after HOLSTER_RETRY_MS, never before
  let answer = null, tries = 0;
  const slow = createHolsterArt(() => r, async () => { tries++; if (tries === 2) throw new Error('decode'); return answer; }, () => now);
  slow.ensure(LONGSWORD, null); await settle();
  now += HOLSTER_RETRY_MS - 1;
  assert.equal(slow.ensure(LONGSWORD, null), null); await settle();
  assert.equal(tries, 1, 'not before');
  now += 1;
  slow.ensure(LONGSWORD, null); await settle();
  assert.equal(tries, 2, 'asked again - and it threw');
  answer = PIC;
  now += HOLSTER_RETRY_MS;
  slow.ensure(LONGSWORD, null); await settle();
  assert.ok(tries === 3 && slow.ensure(LONGSWORD, null), 'asked again after the throw, and up');
});

async function liveBody(item = LONGSWORD) {
  const r = renderer();
  let weapon = item;
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 53, height: 110, colors: new Uint32Array(53 * 110) }),
    loadLantern: async () => null, loadHolster: async () => PIC, holsterItem: () => weapon,
  });
  b.attach(r, () => ({}));
  await settle();
  b.toggle(true, false);
  return { b, r, wield: (it) => { weapon = it; } };
}
const bodyState = (cam, extra = {}) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: cam.yaw, cameraPos: cam.eye, ...extra });
function viewFrom(b, o, extra = {}) {
  const cam = cameraFor(o, [0, 0, 0], 0.05);   // off the views' edges (a 45-degree tie is the rounding's to break)
  for (let i = 0; i < 12; i++) b.tick(1 / 60, bodyState(cam, extra));
  return b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw });
}

test('BACK-HOLSTER (your sprite): sheathed, the weapon is drawn on the back from all eight views, after the body, mirrored from the front - and not while it is drawn, in the saddle, in first person or for a dagger (mutants: the sheathed gate; drawn before the body)', async () => {
  const { b, r, wield } = await liveBody();
  const behind = cameraFor(4, [0, 0, 0]);   // a step away from the camera: the body faces +Z (the IL keeps a walk's facing)
  for (let i = 0; i < 12; i++) b.tick(1 / 60, { ...bodyState(behind), motion: { forward: 1, standing: false, speed: 5, grounded: true, height: 1.8 } });
  viewFrom(b, 4); await settle(); viewFrom(b, 4); await settle();
  for (const o of [...EIGHT, 4]) {
    const before = r.draws.length;
    viewFrom(b, o);
    const mine = r.draws.slice(before);
    const at = mine.findIndex((d) => isHolster(d.archive));
    assert.equal(b.state().shown.orientation, o);
    assert.ok(at > 0 && !isHolster(mine[0].archive), `view ${o}: drawn, after the body`);
    assert.equal(mine[at].record, [0, 1, 7].includes(o) ? 1 : 0, `view ${o}: its face`);
    assert.equal(b.state().holster.drawn, true);
  }
  const drawnWith = (extra) => { const before = r.draws.length; viewFrom(b, 4, extra); return r.draws.slice(before).some((d) => isHolster(d.archive)); };
  assert.equal(drawnWith({ sheathed: false, weaponReady: true }), false, 'drawn in the hand (the rig\'s own words, weaponRig.js eotbState): not on the back');
  assert.equal(b.state().holster.batch, false, 'and its batch let go');
  assert.equal(drawnWith({}), true, 'sheathed again: on the back again');
  assert.equal(drawnWith({ sheathed: true, weaponReady: true, spellcasting: true }), true, 'a spell readied over a sheathed weapon: still on the back');
  assert.equal(drawnWith({ riding: true }), false, 'in the saddle: the horse\'s picture, no back');
  assert.equal(drawnWith({ transformed: true, lycanthropyType: 1 }), false, 'a beast carries nothing');
  wield({ ...LONGSWORD, templateIndex: 113 });
  assert.equal(drawnWith({}), false, 'a dagger rides the hip, not the back');
  wield(null);
  assert.equal(drawnWith({}), false, 'nothing in the hand');
  wield(LONGSWORD);
  assert.equal(drawnWith({}), true);
  const cam = cameraFor(4, [0, 0, 0], 0.05), before = r.draws.length;
  b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw, face: { yaw: cam.yaw, grow: 4 } });
  assert.equal(r.draws.slice(before).some((d) => isHolster(d.archive)), false, 'the Overworld\'s grown body: no weapon at a giant\'s back (OW-BIG)');
  assert.equal(b.state().holster.batch, false);
  b.toggle(true, true);
  assert.equal(drawnWith({}), false, 'first person: no back to see');
});

test('BACK-HOLSTER (the others): a walker whose look holds a back weapon in the weapon hand carries it, sheathed (`wd` 0), drawn beside the lanterns - not with its weapon or bow drawn (`wd` 1, 2), not a dagger; it follows the floating origin and goes with the walker (mutants: the walkers never sling it; wd ignored; the origin shift misses it)', async () => {
  const rr = renderer();
  let asked = 0;
  const art = createEotbArt({ renderer: rr, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }), loadHolster: async () => { asked++; return PIC; } });
  const w = createPeerWalkers({ art });
  const pose = (o = {}) => ({ x: FEET[0], y: FEET[1], z: FEET[2], yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
  const walker = (o = {}, items = [LONGSWORD]) => ({ id: 'p1', look: { eo: 2, gender: 'male', race: 'Breton', items }, shown: pose(o) });
  const frame = (peers, o) => { const cam = cameraFor(o, FEET); w.sync(peers, (p) => [p.x, p.y, p.z], { eye: cam.eye, right: cam.right, dt: 1 / 60 }); const before = rr.draws.length; w.drawLanterns(); return rr.draws.slice(before).filter((d) => isHolster(d.archive)); };
  frame([walker()], 4); await settle(); frame([walker()], 4); await settle();
  for (const o of EIGHT) {
    const d = frame([walker()], o);
    assert.equal(d.length, 1, `view ${o}: one weapon on the back`);
    assert.equal(d[0].record, [0, 1, 7].includes(o) ? 1 : 0, `view ${o}: its face`);
  }
  assert.equal(asked, 1, 'the picture asked once');
  assert.equal(frame([walker({ wd: 1 })], 4).length, 0, 'its weapon drawn: in the hand, not on the back');
  assert.equal(w.walkers.get('p1').holster, null, 'and its batch let go');
  assert.equal(frame([walker({ wd: 2 }, [{ ...LONGSWORD, templateIndex: 130 }])], 4).length, 0, 'its bow drawn: not on the back');
  frame([walker({}, [{ ...LONGSWORD, templateIndex: 130 }])], 4); await settle();   // the bow's own picture, asked
  assert.equal(frame([walker({}, [{ ...LONGSWORD, templateIndex: 130 }])], 4).length, 1, 'its bow put away: on the back');
  assert.equal(frame([walker({}, [{ ...LONGSWORD, templateIndex: 113 }])], 4).length, 0, 'a dagger');
  assert.equal(frame([walker()], 4).length, 1);
  assert.equal(w.holstersDrawn().length, 1, 'over the aura: the walkers say what they drew this frame');
  frame([walker({ wd: 1 })], 4);
  assert.equal(w.holstersDrawn().length, 0);
  frame([walker()], 4); await settle(); frame([walker()], 4);
  const batch = w.walkers.get('p1').holster.batch, at = [...batch.origin];
  w.offsetAll([10, 0, -4]);
  assert.deepEqual(batch.origin, [at[0] + 10, at[1], at[2] - 4], 'the floating origin moved: the weapon with the walker');
  frame([], 4);
  assert.ok(rr.destroyed.includes(batch), 'the walker gone, its weapon\'s batch freed');
});

test('BACK-HOLSTER over the aura: the holsters each owner drew this frame - mine and the walkers\' - drawn again after the aura pass, at LEQUAL with no second shadow and LESS given back; a freed one skipped; the aura host asks both after the capes and before the armory over them (mutants: LESS kept; a second shadow; the shadow lost; the host never asks; an owner never says)', async () => {
  const r = renderer();
  const a = createSpriteHolster(), b = createSpriteHolster(), gone = createSpriteHolster(), c = cameraFor(4, FEET);
  for (const l of [a, b, gone]) { hangSpriteHolster(l, FIG, 4, FEET, c.eye, c.right, ART); mintSpriteHolster(l, r); }
  dropSpriteHolster(gone, r);
  assert.equal(redrawHolstersOver(r, null, [a], [b, gone]), 2, 'both owners\' - never a freed one');
  assert.deepEqual(r.draws.map((d) => [d.batch === a.batch || d.batch === b.batch, d.depth, d.noShadow]), [[true, 515, true], [true, 515, true]], 'at LEQUAL, casting nothing twice');
  assert.deepEqual(r.depth, [515, 513], 'and LESS, the baseline, given back');
  assert.equal(a.batch.noShadow, false, 'its own shadow kept for the next frame');
  assert.equal(redrawHolstersOver(r, null, [], undefined), 0, 'none drawn: nothing touched');
  assert.deepEqual(r.depth, [515, 513]);
  // my own body says what it drew this frame
  const { b: body, r: br } = await liveBody();
  const behind = cameraFor(4, [0, 0, 0]);
  for (let i = 0; i < 12; i++) body.tick(1 / 60, { ...bodyState(behind), motion: { forward: 1, standing: false, speed: 5, grounded: true, height: 1.8 } });
  viewFrom(body, 4); await settle(); viewFrom(body, 4);
  assert.equal(body.holstersDrawn().length, 1, 'mine, drawn this frame');
  const n = br.draws.length;
  assert.equal(body.holstersDrawn()[0].owner, SELF_OWNER, 'listed as mine');
  assert.equal(redrawHolstersOver(br, (o) => o === 'p1', body.holstersDrawn()), 0, 'an owner `keep` does not take: none');
  assert.equal(redrawHolstersOver(br, (o) => o === SELF_OWNER, body.holstersDrawn()), 1);
  assert.ok(isHolster(br.draws[n].archive));
  viewFrom(body, 4, { sheathed: false, weaponReady: true });
  assert.equal(body.holstersDrawn().length, 0, 'drawn in the hand: none to draw again');
  const host = readFileSync(new URL('../../../src/scenes/auraHost.js', import.meta.url), 'utf8');
  const capes = host.indexOf('drawAurasThenBacks(auraDraw, (run) => { pass.draw(run, proj, view, eye, now, fog); if (pass.drawn) renderer.markForeignPass(); return pass.drawn; }, (w) => backs.has(w.id), (w) => backs.draw(w.id), auraRun);'), armory = host.indexOf('drawArmory(armoryOver');
  assert.ok(capes > 0 && armory > capes, 'scenes/auraHost.js: each wearer\'s after its own aura, before the armory drawn over them');
  assert.match(host, /const backSources = \[eotbBody\]/, 'mine');
  assert.match(host, /backSources\.length = 1; for \(const l of deps\.sprites\(\) \?\? \[\]\) backSources\.push\(l\); return backSources;/, 'and every sprite layer\'s - the walkers\' (CAPE-CARD\'s one list, PIN MOVED)');
  assert.match(host, /const self = \{ id: SELF_OWNER,/, 'my aura under the owner my back is listed under');
});

test('AUDIT BACK-HOLSTER A2: over its OWN aura, under a nearer one - the auras drawn farthest first in runs, each wearer\'s back straight after its own aura (its weapon drawn again, its glows); a body wearing none has its glows drawn before every aura (mutants: one pass for all, the backs after; a back before its aura; the runs\' order turned; a bare body\'s glow after the auras)', () => {
  const near = { id: 'near' }, mid = { id: 'mid' }, far = { id: 'far' };
  const log = [];
  const n = drawAurasThenBacks([near, mid, far], (run) => { log.push(`auras ${run.map((w) => w.id).join(',')}`); return run.length; }, (w) => w !== mid, (w) => log.push(`back ${w.id}`), []);
  assert.equal(n, 3);
  assert.deepEqual(log, ['auras far', 'back far', 'auras near,mid', 'back near'], 'the pass draws a run farthest first: far, then mid and near, near\'s back last');
  log.length = 0;
  drawAurasThenBacks([near, mid], (run) => { log.push(run.map((w) => w.id).join(',')); return 0; }, () => false, () => log.push('back'), []);
  assert.deepEqual(log, ['near,mid'], 'no backs: one run, as the pass always drew');
  assert.equal(drawAurasThenBacks([], () => 1, () => true, () => {}, []), 0);
  // the backs by wearer: a holster and glows listed under their owner
  const drew = [], r = { gl: { LESS: 1, LEQUAL: 2, depthFunc() {} }, drawBillboards: (list) => drew.push(`holster ${list[0].owner}`), drawBillboardGlow: (key, glow, g) => { drew.push(`glow ${g.owner}`); return true; } };
  const h = createSpriteHolster('p1');
  h.batch = { owner: 'p1' }; h.list[0] = h.batch;
  const spec = { look: 'shock', code: 3 };
  const mine = setSpriteGlow(createSpriteGlow(SELF_OWNER), 'a', 0, spec, [0, 0, 0], [1, 0, 0], [0, 1, 0], 1, 1, 1, 1);
  const theirs = setSpriteGlow(createSpriteGlow('p1'), 'b', 0, spec, [0, 0, 0], [1, 0, 0], [0, 1, 0], 1, 1, 1, 1);
  const bare = setSpriteGlow(createSpriteGlow('p2'), 'c', 0, spec, [0, 0, 0], [1, 0, 0], [0, 1, 0], 1, 1, 1, 1);
  const sources = [{ holstersDrawn: () => [], glowsDrawn: () => [mine] }, { holstersDrawn: () => [h], glowsDrawn: () => [theirs, bare] }];
  const backs = createSpriteBacks(r, () => sources);
  assert.deepEqual([backs.has(SELF_OWNER), backs.has('p1'), backs.has('p2'), backs.has('p3')], [true, true, true, false]);
  backs.draw('p1');
  assert.deepEqual(drew, ['holster p1', 'glow p1'], 'one wearer\'s, nobody else\'s');
  drew.length = 0;
  assert.equal(backs.drawBare(new Set([SELF_OWNER, 'p1'])), 1);
  assert.deepEqual(drew, ['glow p2'], 'before the auras: the glows of a body wearing none');
});

test('AUDIT BACK-HOLSTER A4: the batch\'s cull sphere holds the weapon as it leans - from every view, every corner of its quad inside (mutants: the upright half-diagonal)', () => {
  for (const o of EIGHT) {
    const c = cameraFor(o, FEET, 0.05), l = createSpriteHolster();
    hangSpriteHolster(l, FIG, o, FEET, c.eye, c.right, ART);
    const b = mintSpriteHolster(l, { createBillboardBatch: (archive, record, size) => ({ archive, record, size: { ...size }, origin: [0, 0, 0], bounds: [0, 0, 0, 0] }) });
    const sph = batchSphere(b, new Float64Array(4));
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]]) {
      const p = [0, 1, 2].map((k) => l.origin[k] + l.right[k] * x * l.w + l.up[k] * y * l.h);
      assert.ok(Math.hypot(p[0] - sph[0], p[1] - sph[1], p[2] - sph[2]) <= sph[3] + 1e-9, `view ${o}: corner ${x},${y} inside`);
    }
  }
});

test('AUDIT BACK-HOLSTER A6: a walker\'s holster is made only when it hangs - the draw path allocates nothing for a walker with no weapon on its back (mutants: made every frame)', () => {
  const src = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(src, /const l = fig \? r\.holster \?\? createSpriteHolster\(peer\.id\) : null;/);
});
