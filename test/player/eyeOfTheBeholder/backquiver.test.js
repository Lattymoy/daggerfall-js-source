// QUIVER (2026-10-30, Mac: "For the bow, lets add a quiver to the holster"). The law is
// player/eyeOfTheBeholder/eotbQuiver.js: which weapons carry one, the picture painted round the Arrow's own, the hang
// by the holster's law with its own spec, the store - and my sprite's and the walkers', driven with fakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  QUIVER_BOWS, QUIVER_ARROW_TEMPLATE, quiverRidesWith, BACK_QUIVER, QUIVER_TUBE, QUIVER_LEATHER, quiverPicture,
  quiverArtArchive, createQuiverArt,
} from '../../../src/player/eyeOfTheBeholder/eotbQuiver.js';
import {
  BACK_HOLSTER, HOLSTER_RETRY_MS, SELF_OWNER, hangSpriteHolster, createSpriteHolster, redrawHolstersOver, holstersOnBack,
} from '../../../src/player/eyeOfTheBeholder/eotbHolster.js';
import { createSpriteBacks } from '../../../src/player/eyeOfTheBeholder/eotbGlow.js';
import { EOTB_FIGURE } from '../../../src/render/auraRing.js';
import { SHORT_BOW_TEMPLATE, LONG_BOW_TEMPLATE, ARROWS_TEMPLATE } from '../../../src/net/recipeLaw.js';
import { THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE } from '../../../src/characters/thunderlockIds.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { createPeerWalkers, createEotbArt } from '../../../src/net/peer/peerRiders.js';

const EIGHT = [0, 1, 2, 3, 4, 5, 6, 7];
const settle = (ms = 5) => new Promise((res) => setTimeout(res, ms));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The camera for view `o` of a figure facing +Z at `feet` (orientationFor's wheel: 0 in front, 4 behind). */
function cameraFor(o, feet, nudge = 0.05) {
  const a = o * Math.PI / 4 + nudge, tc = [Math.sin(a), 0, Math.cos(a)];
  const yaw = Math.atan2(-tc[0], -tc[2]);
  return { eye: [feet[0] + 2 * tc[0], feet[1] + 1.5, feet[2] + 2 * tc[2]], yaw, right: [Math.cos(yaw), 0, -Math.sin(yaw)] };
}
/** An upright arrow as uprightWeaponPicture answers it: a one-texel shaft, its top three rows a green fletching. */
function arrowPicture(W = 3, H = 20) {
  const colors = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fletch = y >= H - 3;
    if (!fletch && x !== 1) continue;
    const o = (y * W + x) * 4;
    colors.set(fletch ? [40, 200, 40, 255] : [120, 90, 50, 255], o);
  }
  return { width: W, height: H, colors };
}
const at = (pic, x, y) => Array.from(pic.colors.subarray((y * pic.width + x) * 4, (y * pic.width + x) * 4 + 4));
const BOW = { templateIndex: LONG_BOW_TEMPLATE, group: 'Weapons', equipSlot: 19, material: 1 };
const LONGSWORD = { templateIndex: 120, group: 'Weapons', equipSlot: 19, material: 1 };
const isQuiver = (a) => typeof a === 'string' && a.startsWith('eotb-quiver:');
const isHolster = (a) => typeof a === 'string' && a.startsWith('eotb-holster:');

test('QUIVER: the bows carry one - the short and the long bow - and nothing else does: not the Thunderlock, the Pistolet, a sword or an empty hand; every bow rides the back (mutants: the long bow left out; the Thunderlock given one)', () => {
  assert.deepEqual([...QUIVER_BOWS], [SHORT_BOW_TEMPLATE, LONG_BOW_TEMPLATE], 'net/recipeLaw.js\'s bows');
  assert.equal(QUIVER_ARROW_TEMPLATE, ARROWS_TEMPLATE, 'and its arrows the Arrow\'s');
  for (const t of QUIVER_BOWS) {
    assert.equal(quiverRidesWith({ ...BOW, templateIndex: t }), true, `bow ${t}`);
    assert.equal(holstersOnBack({ ...BOW, templateIndex: t }), true, `bow ${t} on the back, sheathed`);
  }
  for (const t of [THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE, 120, 113]) assert.equal(quiverRidesWith({ ...BOW, templateIndex: t }), false, `template ${t}`);
  assert.equal(quiverRidesWith(null), false);
});

test('QUIVER picture: a leather tube lit as a cylinder, its rim lighter, its strap and base darker; with arrows, three of the Arrow\'s own standing out of its mouth, fletching on top, staggered; mirrored by its columns; its quad at the sprites\' pixel size - and empty, the tube alone (mutants: no arrows; arrows inside the tube; the rim lost; flat shading; the mirror the same)', () => {
  const T = QUIVER_TUBE, arrow = arrowPicture();
  const full = quiverPicture(arrow, true), empty = quiverPicture(arrow, false);
  assert.deepEqual([full.width, full.height], [T.w, T.h + T.rise + 2], 'the tube, and the arrows over it (the highest two texels up)');
  assert.deepEqual([empty.width, empty.height], [T.w, T.h], 'the empty tube');
  assert.deepEqual([full.w, full.h], [T.w * EOTB_FIGURE.mpp, full.height * EOTB_FIGURE.mpp], 'in metres, one texel the sets\' metres a pixel');
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) assert.equal(at(full, x, y)[3], 255, `the tube is whole at ${x},${y}`);
  const mid = Math.floor(T.h / 3), shade = (x) => at(full, x, mid)[0];
  assert.ok(shade(2) > shade(1) && shade(1) > shade(0) && shade(2) > shade(3) && shade(3) > shade(4), 'lit as a cylinder, brightest in its middle');
  assert.equal(shade(2), QUIVER_LEATHER.body[0], 'the leather itself in the light');
  assert.equal(at(full, 2, T.h - 1)[0], QUIVER_LEATHER.rim[0], 'its rim at the mouth');
  assert.equal(at(full, 2, 0)[0], QUIVER_LEATHER.band[0], 'its base');
  // the arrows: the fletching (green) on top, each its column, the middle one highest
  const greenAt = (x, y) => at(full, x, y)[1] === 200;
  assert.ok(greenAt(2, full.height - 1), 'the middle arrow highest');
  let over = 0;
  for (let y = T.h; y < full.height; y++) for (let x = 0; x < T.w; x++) if (at(full, x, y)[3]) over++;
  assert.ok(over >= 3 * T.rise, `the arrows stand out of the mouth (${over} texels)`);
  for (let y = T.h; y < empty.height; y++) assert.fail('nothing over an empty quiver');
  // mirrored by its columns
  for (let y = 0; y < full.height; y++) for (let x = 0; x < T.w; x++) {
    const a = (y * T.w + x) * 4, b = (y * T.w + (T.w - 1 - x)) * 4;
    assert.deepEqual(Array.from(full.mirror.subarray(b, b + 4)), Array.from(full.colors.subarray(a, a + 4)));
  }
  assert.notDeepEqual(Array.from(full.mirror), Array.from(full.colors), 'shaded unevenly, so its mirror is its own');
  assert.deepEqual(quiverPicture(null, true).height, T.h, 'no arrow picture: the tube alone');
});

const FEET = [4, 0.5, 9];
const FIG = Object.freeze({ base: 0, mpp: EOTB_FIGURE.mpp, marks: null, shift: 0 });
const BOW_ART = Object.freeze({ w: 0.2, h: 1.4, archive: 'eotb-holster:bow' });
const QUIVER_ART = Object.freeze({ w: QUIVER_TUBE.w * EOTB_FIGURE.mpp, h: 38 * EOTB_FIGURE.mpp, archive: 'eotb-quiver:arrows' });

test('QUIVER hang: by the holster\'s law with its own spec - steeper than the bow, its mouth over the shoulders, nearer the body than the bow so the bow lies over it from behind, moved toward the body\'s right as the view sees it and not in depth, and the bow\'s own hang unchanged without it (mutants: the bow\'s spec; no side; the side moved in depth; behind the bow)', () => {
  const shoulder = FIG.base + EOTB_FIGURE.shoulder * FIG.mpp;
  for (const o of [3, 4, 5]) {
    const c = cameraFor(o, FEET);
    const q = hangSpriteHolster(createSpriteHolster(), FIG, o, FEET, c.eye, c.right, QUIVER_ART, BACK_QUIVER);
    const b = hangSpriteHolster(createSpriteHolster(), FIG, o, FEET, c.eye, c.right, BOW_ART);
    assert.ok(q && b);
    assert.ok(dot(q.up, c.right) > 0 && dot(q.up, c.right) < dot(b.up, c.right), `view ${o}: it leans as the bow does, less`);
    assert.ok(q.origin[1] + q.up[1] * q.h > FEET[1] + shoulder, `view ${o}: its arrows over the shoulders`);
    const d = (p) => Math.hypot(p[0] - c.eye[0], p[2] - c.eye[2]);
    assert.ok(d(b.mid) < d(q.mid), `view ${o}: the bow nearer the eye - over it`);
  }
  // `side`: toward the body's right as the view sees it - from behind the screen's right, from the side nothing
  const sideless = { ...BACK_QUIVER, side: 0 };
  const behind = cameraFor(4, FEET, 0), side = cameraFor(2, FEET, 0);
  const shift = (cam, o) => {
    const q = hangSpriteHolster(createSpriteHolster(), FIG, o, FEET, cam.eye, cam.right, QUIVER_ART, BACK_QUIVER);
    const z = hangSpriteHolster(createSpriteHolster(), FIG, o, FEET, cam.eye, cam.right, QUIVER_ART, sideless);
    return [0, 1, 2].map((k) => q.mid[k] - z.mid[k]);
  };
  const s4 = shift(behind, 4);
  assert.ok(Math.abs(dot(s4, behind.right) - BACK_QUIVER.side) < 1e-9, 'from behind, `side` along the screen\'s right - the body\'s right');
  assert.ok(Math.abs(s4[1]) < 1e-12);
  assert.ok(Math.hypot(...shift(side, 2)) < 1e-9, 'from the side, no shift - never nearer the eye than the card');
  const s0 = shift(cameraFor(0, FEET, 0), 0);
  assert.ok(dot(s0, cameraFor(0, FEET, 0).right) < 0, 'from the front, the body\'s right is the screen\'s left');
  // the bow's hang, given no spec, is BACK_HOLSTER's
  const c = cameraFor(4, FEET);
  const given = hangSpriteHolster(createSpriteHolster(), FIG, 4, FEET, c.eye, c.right, BOW_ART, BACK_HOLSTER);
  const plain = hangSpriteHolster(createSpriteHolster(), FIG, 4, FEET, c.eye, c.right, BOW_ART);
  assert.deepEqual([plain.mid, plain.up, plain.h], [given.mid, given.up, given.h]);
  assert.equal(BACK_HOLSTER.side, undefined, 'and the bow moves no side');
});

function recordingRenderer() {
  return {
    gl: { LESS: 513, LEQUAL: 515, depthFunc() {} },
    uploads: [], batches: [], draws: [], destroyed: [], textures: new Map(),
    uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); this.textures.set(`${archive}_${rec}`, img); },
    evictTexture(key) { this.textures.delete(key); },
    createBillboardBatch(archive, record, size) { const b = { archive, record, size: { ...size }, origin: [0, 0, 0] }; this.batches.push(b); return b; },
    destroyBillboardBatch(b) { this.destroyed.push(b); },
    drawBillboards(batches, right, up) { this.draws.push({ batch: batches[0], archive: batches[0].archive, record: batches[0].record, conceal: batches[0].conceal ?? null, right: [...right], up: [...up] }); },
  };
}

test('QUIVER store: the empty tube at once, never asking the arrow; with arrows once the Arrow\'s picture is up, the empty tube while it loads; each face uploaded once, again when the renderer let it go; a picture that did not come asked again after HOLSTER_RETRY_MS, never before; nothing with no renderer (mutants: asked for the empty; the empty uploaded every time; never asked again; asked again at once)', async () => {
  const r = recordingRenderer();
  let asked = 0, answer = arrowPicture(), now = 0;
  const store = createQuiverArt(() => r, async () => { asked++; return answer; }, () => now);
  const e = store.ensure(false);
  await settle();
  assert.ok(e && e.archive === quiverArtArchive(false) && asked === 0, 'the empty tube, no arrow asked');
  assert.deepEqual(r.uploads.map((u) => [u.archive, u.rec]), [[e.archive, 0], [e.archive, 1]], 'as drawn, and mirrored');
  assert.equal(store.ensure(true).archive, quiverArtArchive(false), 'arrows asked, the picture on its way: the empty tube meanwhile');
  store.ensure(true);
  await settle();
  assert.equal(asked, 1, 'asked once while on its way');
  const f = store.ensure(true);
  assert.ok(f.archive === quiverArtArchive(true) && f.pic.height > e.pic.height && asked === 1, 'with arrows, once up');
  const n = r.uploads.length;
  store.ensure(true); store.ensure(false);
  assert.equal(r.uploads.length, n, 'uploaded once');
  r.evictTexture(`${f.archive}_0`);
  store.ensure(true);
  assert.ok(r.textures.has(`${f.archive}_0`), 'let go by the renderer: uploaded again');
  // none came: the empty tube, asked again after HOLSTER_RETRY_MS
  answer = null; asked = 0;
  const slow = createQuiverArt(() => r, async () => { asked++; return answer; }, () => now);
  slow.ensure(true); await settle();
  now += HOLSTER_RETRY_MS - 1;
  assert.equal(slow.ensure(true).archive, quiverArtArchive(false));
  await settle();
  assert.equal(asked, 1, 'not before');
  answer = arrowPicture(); now += 1;
  slow.ensure(true); await settle();
  assert.ok(asked === 2 && slow.ensure(true).archive === quiverArtArchive(true), 'asked again, and up');
  assert.equal(createQuiverArt(() => null, async () => answer).ensure(true), null, 'no renderer, nothing');
});

async function liveBody(item = BOW) {
  const r = recordingRenderer();
  let weapon = item;
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 53, height: 110, colors: new Uint32Array(53 * 110) }),
    loadLantern: async () => null, loadHolster: async () => quiverPicture(arrowPicture(), false), loadQuiver: async () => arrowPicture(), holsterItem: () => weapon,
  });
  b.attach(r, () => ({}));
  await settle();
  b.toggle(true, false);
  return { b, r, wield: (it) => { weapon = it; } };
}
const bodyState = (cam, extra = {}) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: cam.yaw, cameraPos: cam.eye, hasAmmo: true, ...extra });
function viewFrom(b, o, extra = {}) {
  const cam = cameraFor(o, [0, 0, 0]);
  for (let i = 0; i < 12; i++) b.tick(1 / 60, bodyState(cam, extra));
  return b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw });
}

test('QUIVER (your sprite): a bow carries its quiver on the back from all eight views, after the body, mirrored from the front - sheathed, and drawn too, where the bow leaves the back; with arrows by the rig\'s word, empty without; listed with the bow for the redraw over the aura; none for a sword or the Thunderlock, in the saddle, as a beast, in first person or under the Overworld\'s grown body (mutants: the sheathed gate kept; the arrows ignored; never listed; drawn before the body)', async () => {
  const { b, r, wield } = await liveBody();
  const behind = cameraFor(4, [0, 0, 0]);   // a step away from the camera: the body faces +Z (the IL keeps a walk's facing)
  for (let i = 0; i < 12; i++) b.tick(1 / 60, { ...bodyState(behind), motion: { forward: 1, standing: false, speed: 5, grounded: true, height: 1.8 } });
  viewFrom(b, 4); await settle(); viewFrom(b, 4); await settle();
  for (const o of EIGHT) {
    const before = r.draws.length;
    viewFrom(b, o);
    assert.equal(b.state().shown.orientation, o);
    const mine = r.draws.slice(before), q = mine.findIndex((d) => isQuiver(d.archive));
    assert.ok(q > 0 && !isQuiver(mine[0].archive), `view ${o}: drawn, after the body`);
    assert.equal(mine[q].record, [0, 1, 7].includes(o) ? 1 : 0, `view ${o}: its face`);
    assert.equal(mine[q].archive, quiverArtArchive(true), `view ${o}: with arrows`);
  }
  const drawnWith = (extra) => { const before = r.draws.length; viewFrom(b, 4, extra); return r.draws.slice(before); };
  let d = drawnWith({});
  assert.ok(d.some((x) => isHolster(x.archive)) && d.some((x) => isQuiver(x.archive)), 'sheathed: the bow and its quiver');
  assert.deepEqual(b.holstersDrawn().map((l) => l.owner), [SELF_OWNER, SELF_OWNER], 'both listed, mine, for the redraw over the aura');
  d = drawnWith({ sheathed: false, weaponReady: true });
  assert.ok(!d.some((x) => isHolster(x.archive)) && d.some((x) => isQuiver(x.archive)), 'drawn: the bow in the hand, its quiver still on the back (WS1)');
  assert.equal(b.holstersDrawn().length, 1);
  assert.equal(drawnWith({ hasAmmo: false }).find((x) => isQuiver(x.archive))?.archive, quiverArtArchive(false), 'no arrows: an empty quiver');
  for (const [why, extra] of [['in the saddle', { riding: true }], ['a beast', { transformed: true, lycanthropyType: 1 }]]) {
    assert.ok(!drawnWith(extra).some((x) => isQuiver(x.archive)), why);
    assert.equal(b.state().quiver.drawn, false);
  }
  for (const [why, item] of [['a sword', LONGSWORD], ['the Thunderlock', { ...BOW, templateIndex: THUNDERLOCK_TEMPLATE }], ['an empty hand', null]]) {
    wield(item);
    assert.ok(!drawnWith({}).some((x) => isQuiver(x.archive)), why);
  }
  wield(BOW);
  assert.ok(drawnWith({}).some((x) => isQuiver(x.archive)));
  const cam = cameraFor(4, [0, 0, 0]), before = r.draws.length;
  b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw, face: { yaw: cam.yaw, grow: 4 } });
  assert.ok(!r.draws.slice(before).some((x) => isQuiver(x.archive)), 'the Overworld\'s grown body: none (OW-BIG)');
  assert.ok(drawnWith({}).some((x) => isQuiver(x.archive)));
  b.standDown();
  assert.equal(b.holstersDrawn().length, 0, 'the Morrowind body takes the frame: its own quiver (WS1), none listed here');
  b.toggle(true, true);
  assert.ok(!drawnWith({}).some((x) => isQuiver(x.archive)), 'first person: no back to see');
});

test('QUIVER (the others): a walker\'s bow - the hand in use, `lh` - carries its quiver, sheathed (`wd` 0) and drawn (`wd` 1, 2), with arrows by its pose\'s `am`; veiled as the walker is; follows the floating origin and goes with the walker; none for a sword or a grown walker (mutants: the walkers never sling it; `am` ignored; the hand in use ignored; the origin shift misses it; left behind)', async () => {
  const rr = recordingRenderer();
  let asked = 0;
  const art = createEotbArt({ renderer: rr, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }), loadHolster: async () => quiverPicture(arrowPicture(), false), loadQuiver: async () => { asked++; return arrowPicture(); } });
  const w = createPeerWalkers({ art });
  const pose = (o = {}) => ({ x: FEET[0], y: FEET[1], z: FEET[2], yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, am: 1, ...o });
  const walker = (o = {}, items = [BOW]) => ({ id: 'p1', look: { eo: 2, gender: 'male', race: 'Breton', items }, shown: pose(o) });
  const frame = (peers, o = 4, opts = {}) => { const cam = cameraFor(o, FEET); w.sync(peers, (p) => [p.x, p.y, p.z], { eye: cam.eye, right: cam.right, dt: 1 / 60, ...opts }); const before = rr.draws.length; w.drawLanterns(); return rr.draws.slice(before); };
  const quivers = (d) => d.filter((x) => isQuiver(x.archive));
  frame([walker()]); await settle(); frame([walker()]); await settle();
  for (const o of EIGHT) {
    const q = quivers(frame([walker()], o));
    assert.equal(q.length, 1, `view ${o}: one quiver`);
    assert.equal(q[0].record, [0, 1, 7].includes(o) ? 1 : 0, `view ${o}: its face`);
    assert.equal(q[0].archive, quiverArtArchive(true), `view ${o}: with arrows (am)`);
  }
  assert.equal(asked, 1, 'the arrow asked once');
  for (const wd of [1, 2]) {
    const d = frame([walker({ wd })]);
    assert.ok(quivers(d).length === 1 && !d.some((x) => isHolster(x.archive)), `wd ${wd}: the bow in the hand, the quiver on the back`);
  }
  assert.equal(quivers(frame([walker({ am: 0 })]))[0]?.archive, quiverArtArchive(false), 'no arrows: empty');
  assert.equal(quivers(frame([walker({}, [LONGSWORD])])).length, 0, 'a sword');
  assert.equal(w.walkers.get('p1').quiver, null, 'and its batch let go');
  const left = { ...BOW, equipSlot: 21 };
  assert.equal(quivers(frame([walker({ lh: 1 }, [LONGSWORD, left])])).length, 1, 'the left hand in use: its bow');
  assert.equal(quivers(frame([walker({}, [LONGSWORD, left])])).length, 0, 'the right hand in use: its sword');
  assert.equal(quivers(frame([walker()], 4, { conceal: () => ({ mode: 3, alpha: 0.4 }) }))[0]?.conceal?.mode, 3, 'veiled as the walker is');
  assert.equal(quivers(frame([walker()], 4, { grow: () => 3 })).length, 0, 'a grown walker (OW-PEERS): none');
  frame([walker()]);
  assert.ok(w.holstersDrawn().some((l) => l === w.walkers.get('p1').quiver && l.owner === 'p1'), 'listed under its walker for the redraw over the aura');
  const batch = w.walkers.get('p1').quiver.batch, o0 = [...batch.origin];
  w.offsetAll([10, 0, -4]);
  assert.deepEqual(batch.origin, [o0[0] + 10, o0[1], o0[2] - 4], 'the floating origin moved: the quiver with the walker');
  frame([]);
  assert.ok(rr.destroyed.includes(batch), 'the walker gone, its quiver\'s batch freed');
});

test('QUIVER over the aura and the wiring: the backs by wearer see a quiver alone (a bow drawn) and redraw it after its own aura; the rig says whether the hand\'s bow has arrows (mutants: a quiver alone unseen; the rig never says)', () => {
  const r = { gl: { LESS: 1, LEQUAL: 2, depthFunc() {} }, drew: [], drawBillboards(list) { this.drew.push(list[0].archive); }, drawBillboardGlow: () => true };
  const q = createSpriteHolster(SELF_OWNER);
  q.batch = { archive: quiverArtArchive(true) }; q.list[0] = q.batch;
  const backs = createSpriteBacks(r, () => [{ holstersDrawn: () => [q], glowsDrawn: () => [] }]);
  assert.equal(backs.has(SELF_OWNER), true, 'a quiver alone is a back to draw');
  backs.draw(SELF_OWNER);
  assert.deepEqual(r.drew, [quiverArtArchive(true)], 'drawn again over its own aura');
  assert.equal(redrawHolstersOver(r, null, [q]), 1);
  const rig = readFileSync(new URL('../../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rig, /hasAmmo: hasAmmoFor\(entity\?\.items, playerWeapon\.handItem\(playerWeapon\.leadHand\)\),/);
});
