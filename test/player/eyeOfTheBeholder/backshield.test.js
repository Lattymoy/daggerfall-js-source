// BACK-SHIELD (2026-10-31, the owner: "Implement the shield holstered on the back. The weapon should sit behind the
// shield"). The law is player/eyeOfTheBeholder/eotbBackShield.js: a sheathed layered body's shield hangs on its back by
// the holster's law, farther out than the weapon - and the sprite draws it on the arm no more while it is there.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BACK_SHIELD, BACK_SHIELD_SQUEEZE, backShieldPicture, backShieldArchive, createBackShieldArt, backShieldSeen,
} from '../../../src/player/eyeOfTheBeholder/eotbBackShield.js';
import { BACK_HOLSTER, HOLSTER_RETRY_MS, PAPERDOLL_MPP, hangSpriteHolster, createSpriteHolster } from '../../../src/player/eyeOfTheBeholder/eotbHolster.js';
import { RECORD_OFFSETS } from '../../../src/player/eyeOfTheBeholder/eotbBillboard.js';
import { shieldPicture } from '../../../src/player/eyeOfTheBeholder/layeredShield.js';
import { layeredSprite } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { layeredHands } from '../../../src/player/eyeOfTheBeholder/layeredWeapon.js';
import { EOTB_FIGURE } from '../../../src/render/auraRing.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { createPeerWalkers, createEotbArt, walkerHeld } from '../../../src/net/peer/peerRiders.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { equipTableOf } from '../../../src/systems/equip.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';

const EIGHT = [0, 1, 2, 3, 4, 5, 6, 7];
const settle = (ms = 5) => new Promise((res) => setTimeout(res, ms));
const FEET = [4, 0.5, 9];
const FIG = Object.freeze({ base: 0, mpp: EOTB_FIGURE.mpp, marks: null, shift: 0 });
const SWORD_ART = Object.freeze({ w: 0.12, h: 1.1, archive: 'eotb-holster:sword' });
const SHIELD_ART = Object.freeze({ w: 0.48, h: 0.67, archive: 'eotb-backshield:male:k1' });
/** The camera for view `o` of a figure facing +Z at `feet` (orientationFor's wheel: 0 in front, 4 behind). */
function cameraFor(o, feet, nudge = 0.05) {
  const a = o * Math.PI / 4 + nudge, tc = [Math.sin(a), 0, Math.cos(a)];
  const yaw = Math.atan2(-tc[0], -tc[2]);
  return { eye: [feet[0] + 2 * tc[0], feet[1] + 1.5, feet[2] + 2 * tc[2]], yaw, right: [Math.cos(yaw), 0, -Math.sin(yaw)] };
}
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A shield picture of `w` x `h` (color32, row 0 the bottom): its left half red, its right half blue. */
const card = (w, h) => {
  const colors = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) colors.set(x < w / 2 ? [200, 0, 0, 255] : [0, 0, 200, 255], (y * w + x) * 4);
  return { width: w, height: h, colors };
};

test('BACK-SHIELD hang: farther out than the weapon - from behind nearer the eye, so the weapon sits under it; from before farther, both behind the body\'s card; upright on the spine, its top over the shoulders (mutants: the weapon\'s depth; nearer the body than the weapon; tilted)', () => {
  assert.ok(BACK_SHIELD.back > BACK_HOLSTER.back && BACK_SHIELD.clear > BACK_HOLSTER.clear, 'farther out, and from aside farther past the back');
  assert.equal(BACK_SHIELD.tilt, 0);
  const shoulder = FIG.base + EOTB_FIGURE.shoulder * FIG.mpp;
  for (const o of EIGHT) {
    const c = cameraFor(o, FEET);
    const s = hangSpriteHolster(createSpriteHolster(), FIG, o, FEET, c.eye, c.right, SHIELD_ART, BACK_SHIELD);
    const w = hangSpriteHolster(createSpriteHolster(), FIG, o, FEET, c.eye, c.right, SWORD_ART);
    assert.ok(s && w, `view ${o}: both hang`);
    if ([3, 4, 5].includes(o)) assert.ok(flat(c.eye, s.mid) < flat(c.eye, w.mid), `view ${o}: the shield nearer the eye - over the weapon`);
    if ([0, 1, 7].includes(o)) {
      assert.ok(flat(c.eye, s.mid) > flat(c.eye, w.mid), `view ${o}: the shield farther - behind the weapon`);
      assert.ok(flat(c.eye, s.mid) > flat(c.eye, FEET), `view ${o}: behind the body's card`);
    }
    assert.ok(Math.abs(s.up[1] - 1) < 1e-9, `view ${o}: upright`);
    assert.ok(s.origin[1] + s.h > FEET[1] + shoulder, `view ${o}: its top over the shoulders`);
    assert.equal(s.mirror, [0, 1, 7].includes(o), `view ${o}: from before, its inside`);
  }
});

test('BACK-SHIELD picture: the face as drawn and the inside turned round, row 0 the bottom, at the sprites\' texel size; turned with the body by view, edge on from aside (mutants: the inside unturned; the face upside down; no squeeze)', () => {
  const P = shieldPicture(card(38, 19), 'r1'), B = backShieldPicture(P);
  const step = EOTB_FIGURE.mpp / PAPERDOLL_MPP;
  assert.deepEqual([B.width, B.height], [Math.ceil(38 / step), Math.ceil(19 / step)]);
  assert.ok(Math.abs(B.w - B.width * EOTB_FIGURE.mpp) < 1e-12 && Math.abs(B.h - B.height * EOTB_FIGURE.mpp) < 1e-12);
  const at = (buf, x, y) => [...buf.subarray((y * B.width + x) * 4, (y * B.width + x) * 4 + 4)];
  assert.deepEqual(at(B.colors, 0, 0), [200, 0, 0, 255], 'the face: its left red');
  assert.deepEqual(at(B.colors, B.width - 1, 0), [0, 0, 200, 255]);
  assert.notDeepEqual(at(B.mirror, 0, 0), [200, 0, 0, 255], 'the inside: boards, not the face');
  const half = card(20, 20);
  for (let y = 0; y < 20; y++) for (let x = 10; x < 20; x++) half.colors[(y * 20 + x) * 4 + 3] = 0;   // only the left half drawn
  const H = backShieldPicture(shieldPicture(half, 'b1'));
  assert.equal(H.colors[3], 255, 'the face: its left');
  assert.equal(H.mirror[3], 0, 'the inside turned round: its right');
  assert.equal(H.mirror[(H.width - 1) * 4 + 3], 255);
  const top = shieldPicture(card(20, 20), 'b1');
  for (let x = 0; x < 20; x++) top.face.set([0, 255, 0, 255], x * 4);   // the top row green
  const T = backShieldPicture(top);
  const topRow = [...T.colors.subarray(((T.height - 1) * T.width) * 4, ((T.height - 1) * T.width) * 4 + 3)], bottom = [...T.colors.subarray(0, 3)];
  assert.ok(topRow[1] > topRow[0] && topRow[1] > topRow[2], 'the top row last (row 0 the bottom): green');
  assert.ok(bottom[1] === 0, 'the bottom row none of it');
  assert.equal(backShieldPicture(null), null);
  const a = { archive: 'x', w: 0.5, h: 0.7 };
  for (const o of EIGHT) assert.equal(backShieldSeen(a, o).w, 0.5 * BACK_SHIELD_SQUEEZE[RECORD_OFFSETS[o]], `view ${o}`);
  assert.ok(BACK_SHIELD_SQUEEZE[2] < 0.5 && BACK_SHIELD_SQUEEZE[4] > 0.9, 'edge on from aside, whole from behind');
  assert.equal(backShieldSeen(null, 4), null);
});

function recordingRenderer() {
  return {
    gl: { LESS: 513, LEQUAL: 515, depthFunc() {} },
    uploads: [], batches: [], draws: [], destroyed: [], textures: new Map(),
    uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); this.textures.set(`${archive}_${rec}`, img); },
    evictTexture(key) { this.textures.delete(key); },
    createBillboardBatch(archive, record, size) { const b = { archive, record, size: { ...size }, origin: [0, 0, 0] }; this.batches.push(b); return b; },
    destroyBillboardBatch(b) { this.destroyed.push(b); },
    drawBillboards(batches, right, up) { this.draws.push({ batch: batches[0], archive: batches[0].archive, record: batches[0].record, origin: [...batches[0].origin] }); },
  };
}

test('BACK-SHIELD store: up once its picture comes, both faces uploaded, again when the renderer let them go; a picture that did not come asked again after HOLSTER_RETRY_MS; nothing without a renderer or a shield (mutants: never uploaded again; asked again at once; one face)', async () => {
  const r = recordingRenderer();
  let asked = 0, now = 0, answer = card(48, 67);
  const art = createBackShieldArt(() => r, async () => { asked++; return answer; }, () => now);
  assert.equal(art.ensure('k1', 'male'), null, 'in flight');
  await settle();
  const a = art.ensure('k1', 'male');
  assert.equal(a.archive, backShieldArchive('male', 'k1'));
  assert.deepEqual(r.uploads.map((u) => u.rec), [0, 1], 'its face and its inside');
  assert.equal(art.ensure('k1', 'male'), a);
  assert.equal(asked, 1);
  r.textures.clear();
  art.ensure('k1', 'male');
  assert.equal(r.uploads.length, 4, 'uploaded again when the renderer let it go');
  answer = null;
  assert.equal(art.ensure('t7', 'female'), null); await settle();
  assert.equal(art.ensure('t7', 'female'), null, 'none came');
  now += HOLSTER_RETRY_MS - 1; art.ensure('t7', 'female'); await settle();
  assert.equal(asked, 2, 'not asked again before HOLSTER_RETRY_MS');
  answer = card(58, 112); now += 1; art.ensure('t7', 'female'); await settle();
  assert.ok(asked === 3 && art.ensure('t7', 'female')?.archive === backShieldArchive('female', 't7'), 'asked again, and up');
  assert.equal(createBackShieldArt(() => null, async () => answer).ensure('k1', 'male'), null);
  assert.equal(art.ensure(null, 'male'), null);
});

test('BACK-SHIELD the sprite: sheathed, no shield on the arm - my hands and a walker\'s say so; drawn, on the arm again (mutants: the arm keeps it sheathed; the hands never say sheathed)', () => {
  const look = (sheathed) => ({ outfit: 'lll^k1', gender: 'male', weapon: '0', ...(sheathed ? { sheathed: true } : {}) });
  for (const table of ['Idle', 'Move', 'Death', 'IdleSpell']) assert.doesNotMatch(layeredSprite(table, 4, 0, 4, look(true), false).key, /\^/, `${table}, sheathed`);
  for (const table of ['IdleMelee', 'MoveMelee', 'AttackMelee']) assert.match(layeredSprite(table, 4, 0, 4, look(false), false).key, /\^k1/, table);
  assert.equal(layeredHands({ sheathed: true }).sheathed, true);
  assert.equal(layeredHands({ sheathed: false }).sheathed, undefined);
  assert.equal(walkerHeld({ items: [] }, { wd: 0 }).sheathed, true);
  assert.equal(walkerHeld({ items: [] }, { wd: 1 }).sheathed, undefined);
});

const SHIELD = { templateIndex: 111, group: 'Armor', equipSlot: 21, material: 0x201 };
const LONGSWORD = { templateIndex: 120, group: 'Weapons', equipSlot: 19, material: 1 };
const isBackShield = (a) => typeof a === 'string' && a.startsWith('eotb-backshield:');
const isHolster = (a) => typeof a === 'string' && a.startsWith('eotb-holster:');

test('BACK-SHIELD (your sprite): sheathed, the layered body hangs its shield on its back from all eight views, over the weapon from behind and behind it from before; drawn, the shield goes to the arm; none in a class skin (mutants: never drawn; drawn unsheathed; the skins given one)', async () => {
  _resetModSettings();
  setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 2);   // the male body in the armour worn
  const slots = equipTableOf(playerEntity), saved = { ...slots };
  try {
    for (const k of Object.keys(slots)) delete slots[k];
    slots[21] = SHIELD;
    const r = recordingRenderer();
    const b = createEotbBody({
      count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => ({ width: 53, height: 110, colors: new Uint32Array(53 * 110) }),
      loadLantern: async () => null, loadHolster: async () => ({ ...card(4, 40), mirror: card(4, 40).colors, w: 0.08, h: 0.8 }), loadBackShield: async () => card(48, 67), holsterItem: () => LONGSWORD,
    });
    b.attach(r, () => ({}));
    await settle();
    b.toggle(true, false);
    const still = (cam, extra) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: cam.yaw, cameraPos: cam.eye, sheathed: true, ...extra });
    const view = (o, extra = {}) => { const cam = cameraFor(o, [0, 0, 0]); for (let i = 0; i < 12; i++) b.tick(1 / 60, still(cam, extra)); const n = r.draws.length; b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw }); return { cam, d: r.draws.slice(n) }; };
    const behind = cameraFor(4, [0, 0, 0]);   // a step away from the camera: the body faces +Z (the IL keeps a walk's facing)
    for (let i = 0; i < 12; i++) b.tick(1 / 60, { ...still(behind, {}), motion: { forward: 1, standing: false, speed: 5, grounded: true, height: 1.8 } });
    for (let i = 0; i < 6; i++) { view(4); await settle(); }
    for (const o of EIGHT) {
      const { cam, d } = view(o);
      assert.equal(b.state().shown.orientation, o);
      const s = d.find((x) => isBackShield(x.archive)), w = d.find((x) => isHolster(x.archive));
      assert.ok(s && w, `view ${o}: the weapon and the shield on the back`);
      const st = b.state(), near = flat(cam.eye, st.backShield.mid) - flat(cam.eye, st.holster.mid);
      if ([3, 4, 5].includes(o)) assert.ok(near < 0, `view ${o}: from behind, the shield nearer the eye - over the weapon`);
      if ([0, 1, 7].includes(o)) assert.ok(near > 0, `view ${o}: from before, the shield farther - behind the weapon`);
    }
    assert.equal(b.state().backShield.drawn, true);
    assert.ok(b.holstersDrawn().some((l) => isBackShield(l.archive)), 'listed for the redraw over the aura');
    const bodyRec = (d) => String(d.find((x) => x.archive === 1700)?.record ?? '');
    assert.doesNotMatch(bodyRec(view(4).d), /\^/, 'sheathed: the sprite carries none on its arm');
    let drawn = view(4, { sheathed: false, weaponReady: true }).d;
    for (let i = 0; i < 10 && !/\^k1/.test(bodyRec(drawn)); i++) { await settle(); drawn = view(4, { sheathed: false, weaponReady: true }).d; }
    assert.ok(!drawn.some((x) => isBackShield(x.archive)), 'drawn: the shield on the arm, not the back');
    assert.match(bodyRec(drawn), /\^k1/, 'its arm\'s');
    setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 0);
    b.ready();
    assert.ok(!view(4).d.some((x) => isBackShield(x.archive)), 'a class skin: none');
  } finally {
    for (const k of Object.keys(slots)) delete slots[k];
    Object.assign(slots, saved);
    _resetModSettings();
  }
});

test('BACK-SHIELD (the others): a layered walker sheathed (`wd` 0) slings its shield on its back, drawn (`wd` 1) carries it on the arm; a walker in a class skin none; its batch goes with the walker (mutants: the walkers never sling it; slung drawn; left behind)', async () => {
  const rr = recordingRenderer();
  const art = createEotbArt({ renderer: rr, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }), loadHolster: async () => null, loadQuiver: async () => null, loadBackShield: async () => card(48, 67) });
  const w = createPeerWalkers({ art });
  const pose = (o = {}) => ({ x: FEET[0], y: FEET[1], z: FEET[2], yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
  const walker = (o = {}, lg = 2) => ({ id: 'p1', look: { eo: 2, lg, gender: 'male', race: 'Breton', items: [SHIELD, LONGSWORD] }, shown: pose(o) });
  const frame = (peers, o = 4) => { const cam = cameraFor(o, FEET); w.sync(peers, (p) => [p.x, p.y, p.z], { eye: cam.eye, right: cam.right, dt: 1 / 60 }); const before = rr.draws.length; w.drawLanterns(); return rr.draws.slice(before); };
  frame([walker()]); await settle(); frame([walker()]); await settle(); frame([walker()]); await settle();
  for (const o of EIGHT) assert.equal(frame([walker()], o).filter((x) => isBackShield(x.archive)).length, 1, `view ${o}: on its back`);
  assert.equal(frame([walker({ wd: 1 })]).filter((x) => isBackShield(x.archive)).length, 0, 'drawn: on the arm');
  assert.equal(w.walkers.get('p1').backShield, null, 'its batch let go');
  frame([walker()]);
  const l = w.walkers.get('p1').backShield;
  assert.ok(l?.batch);
  setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 0);   // nor I in it: a walker that chose none is its class skin
  try { assert.equal(frame([walker({}, 0)]).filter((x) => isBackShield(x.archive)).length, 0, 'a class skin: none'); } finally { _resetModSettings(); }
  frame([walker()]);
  const held = w.walkers.get('p1').backShield.batch;
  frame([]);
  assert.ok(rr.destroyed.includes(held), 'gone with the walker');
});
