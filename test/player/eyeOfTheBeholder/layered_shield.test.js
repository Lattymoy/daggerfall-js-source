// LAYERED-SHIELD (bible/04-Characters/Layered-Gearing.md, "The shield"): the layered body carries the shield it wears on
// its free arm - the paper doll's picture, its face toward the eye from the front, its inside from behind - and swings
// one-handed with it: the free arm out of the swing, the frames whose sword arm swings on its own side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  layeredShieldOf, shieldItemOf, SHIELD_SLOT, shieldPicture, drawShield, padFrame, removeShieldArm, SHIELD_VIEWS, SHIELD_CUTS,
  SHIELD_CAST, SHIELD_GUN, shieldCutOf, shieldPictureOf, withoutShield, outlineMask, graftArm,
} from '../../../src/player/eyeOfTheBeholder/layeredShield.js';
import { SWING_CUTS, swingKindOf, weaponRigOf, BARE_TWINS } from '../../../src/player/eyeOfTheBeholder/layeredWeapon.js';
import { layeredSprite, outfitPieces, outfitOfSlots, outfitOfItems, decodeLayered } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { spriteLookOf } from '../../../src/net/peer/peerRiders.js';
import { EQUIP_SLOTS } from '../../../src/characters/paperdoll/paperdoll.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';

const V = new URL('../../../vendor/layered-armor/', import.meta.url);
const rig = JSON.parse(readFileSync(new URL('weapon/manifest.json', V), 'utf8'));
const shield = (templateIndex, material = 0) => ({ group: 'Armor', templateIndex, material });

test('a worn shield\'s code is its shape and its material; anything else in the left hand is none', () => {
  assert.equal(SHIELD_SLOT, EQUIP_SLOTS.LeftHand);
  assert.equal(layeredShieldOf(shield(109)), 'bl');
  assert.equal(layeredShieldOf(shield(110, ARMOR_MATERIAL.Chain)), 'rc');
  assert.equal(layeredShieldOf(shield(111, ARMOR_MATERIAL.Chain2)), 'kc');
  assert.equal(layeredShieldOf(shield(112, ARMOR_MATERIAL.Iron)), 't0');
  assert.equal(layeredShieldOf(shield(111, ARMOR_MATERIAL.Daedric)), 'k9');
  assert.equal(layeredShieldOf(shield(102, ARMOR_MATERIAL.Steel)), null, 'a cuirass is no shield');
  assert.equal(layeredShieldOf({ group: 'Weapons', templateIndex: 111, material: 0 }), null);
  assert.equal(layeredShieldOf(null), null);
  for (const code of ['bl', 'rc', 'k0', 't9']) assert.equal(layeredShieldOf(shieldItemOf(code)), code, `${code} round trip`);
  assert.equal(shieldItemOf('x1'), null);
  assert.equal(shieldItemOf('k'), null);
});

test('the outfit carries the shield after `^` - my equip table and a peer\'s look alike - and the code reads it back', () => {
  const slots = { [SHIELD_SLOT]: shield(111, ARMOR_MATERIAL.Ebony) };
  assert.equal(outfitOfSlots(slots), 'lll^k7');
  assert.equal(outfitOfSlots({}), 'lll');
  assert.equal(outfitOfItems([{ ...shield(110, ARMOR_MATERIAL.Steel), equipSlot: SHIELD_SLOT }]), 'lll^r1');
  assert.deepEqual(outfitPieces('p6cl~2^k7@ls1!03'), { head: 'p6', top: 'c', legs: 'l', cloak: 2, shield: 'k7', weapon: 'ls1', offhand: null, spell: 0, stage: 3 });
  assert.equal(outfitPieces('lll^z1'), null);
  // the stores keep a cast's frames, stage and all, with the outfit's
  assert.equal(spriteLookOf({ key: 'LA:male:leather_leather_leather:8-2:lll^k7@ls1!03' }), 'LA:male:leather_leather_leather:lll^k7@ls1');
});

const OFF = [0, 1, 2, 3, 4];
const look = (extra) => ({ outfit: 'lll^k7', gender: 'male', weapon: 'ls3', ...extra });
const codeOf = (s) => s.key.split(':')[4];
test('the shield is in every frame but the loose\'s, never beside a pair or a bow; a bare walk keeps the frame unturned', () => {
  for (const table of ['Move', 'MoveMelee', 'IdleMelee', 'AttackMelee', 'Death', 'IdleSpell', 'AttackSpell']) {
    for (const off of OFF) {
      const s = layeredSprite(table, off, 0, 4, look({ cast: 1 }), false);
      assert.match(codeOf(s), /\^k7/, `${table} ${off}`);
    }
  }
  assert.doesNotMatch(codeOf(layeredSprite('AttackRanged', 0, 1, 4, look({ weapon: 'lb3' }), false)), /\^/, 'the loose');
  assert.doesNotMatch(codeOf(layeredSprite('AttackRanged', 0, 1, 4, { outfit: 'lll^k7', gender: 'male' }, false)), /\^/, 'the loose, the hands not named');
  assert.doesNotMatch(codeOf(layeredSprite('IdleRanged', 0, 0, 4, look({ weapon: 'lb3' }), false)), /\^/, 'a bow');
  assert.doesNotMatch(codeOf(layeredSprite('IdleMelee', 0, 0, 4, look({ offhand: 'dg3' }), false)), /\^/, 'a pair');
  // the front walk's 0-2 is drawn as another frame: bare, its twin turned over would move the shield to the other arm
  assert.equal(BARE_TWINS.male['0-2'], '0-0');
  const bare = layeredSprite('Move', 0, 2, 4, look({ weapon: null }), false);
  assert.deepEqual([bare.record, bare.frame, bare.mirror], [0, 3, false]);
  const noShield = layeredSprite('Move', 0, 2, 4, { ...look({ weapon: null }), outfit: 'lll' }, false);
  assert.deepEqual([noShield.record, noShield.frame, noShield.mirror], [0, 0, true], 'without one, as before');
});

test('a shield-bearer\'s swing plays the frames whose sword arm swings on its own side, view by view', () => {
  assert.deepEqual([...SHIELD_CUTS].map((c) => (c ? Object.keys(c).sort() : null)), [['chop', 'slash', 'thrust'], ['chop', 'slash', 'thrust'], null, ['chop', 'slash', 'thrust'], ['chop', 'slash', 'thrust']]);
  const allowed = [[0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5], [0, 1, 2], [0, 1, 2]];
  for (const code of ['ls3', 'dg3', 'mc3', '0']) {
    for (const off of OFF) {
      const frames = Array.from({ length: 6 }, (_, f) => layeredSprite('AttackMelee', off, f, 6, look({ weapon: code }), false).frame);
      assert.ok(frames.every((f) => allowed[off].includes(f)), `${code} view ${off}: ${frames}`);
      assert.ok(frames.includes(2), `${code} view ${off} strikes`);
      assert.deepEqual(frames, shieldCutOf(code, off) ?? SWING_CUTS[swingKindOf(code)], `${code} view ${off}`);
    }
  }
  // three quarters before plays the follow-through, the front and behind hold the strike
  assert.deepEqual(OFF.map((off) => layeredSprite('AttackMelee', off, 4, 6, look({ weapon: 'mc3' }), false).frame), [2, 3, 4, 2, 2]);
  // a shot and a cast keep to them too; a cast's frame drawn for another stage says its stage
  assert.deepEqual(OFF.map((off) => layeredSprite('AttackMelee', off, 0, 6, look({ weapon: 'pt1' }), false).frame), [...SHIELD_GUN]);
  for (const off of OFF) {
    const cast = Array.from({ length: 4 }, (_, f) => layeredSprite('AttackSpell', off, f, 4, look({ cast: 2 }), false));
    assert.deepEqual(cast.map((s) => s.frame), [...SHIELD_CAST[off]]);
    cast.forEach((s, stage) => assert.match(codeOf(s), new RegExp(`!2${s.frame === stage ? '' : stage}$`), `view ${off} stage ${stage}`));
  }
});

test('the rig: every frame a shield shows in has its grip; the free arm\'s outline in the swing frames it reaches into', () => {
  for (const body of ['male', 'female']) {
    const frames = rig[body].frames;
    for (let rec = 0; rec < 20; rec++) {
      const fs = Object.keys(frames).filter((k) => k.startsWith(`${rec}-`));
      const shown = rec >= 5 && rec <= 9 ? new Set(Array.from({ length: 6 }, (_, f) => f).filter((f) => [[0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5], [0, 1, 2], [0, 1, 2]][rec - 5].includes(f))) : null;
      for (const rf of fs) {
        const f = Number(rf.split('-')[1]), want = !shown || shown.has(f);
        for (const fam of frames[rf]) {
          assert.equal(Array.isArray(fam.sh), want, `${body} ${rf} grip`);
          if (fam.sh) assert.ok(fam.sh.length >= 2 && fam.sh.every(Number.isFinite), `${body} ${rf}`);
          if (fam.sa) {
            assert.ok(want, `${body} ${rf}: an outline where no shield shows`);
            for (const P of fam.sa) assert.ok(P.length >= 3 && P.every((p) => p.length === 2), `${body} ${rf} outline`);
          }
        }
      }
    }
    // the swing frames whose free arm reaches across: front and three quarters, and the far arm's cross from aside
    for (const rf of ['5-0', '5-1', '5-2', '6-0', '6-1', '6-2', '6-3', '7-3']) assert.ok(weaponRigOf(body, rf).sa, `${body} ${rf}`);
    // from before, each takes the idle's arm back, the shield in its hand
    for (const rf of ['5-0', '5-1', '5-2', '6-0', '6-1', '6-2', '6-3']) {
      const sg = weaponRigOf(body, rf).sg, idle = weaponRigOf(body, sg?.[0]);
      assert.equal(sg?.[0], rf.startsWith('5-') ? '15-0' : '16-0', `${body} ${rf}: the idle of its view`);
      assert.ok(idle.sp, `${body} ${sg[0]}: its arm's outline`);
      assert.deepEqual(weaponRigOf(body, rf).sh, [+(idle.sh[0] - sg[3]).toFixed(1), +(idle.sh[1] - sg[4]).toFixed(1)], `${body} ${rf}: the grip in the grafted hand`);
    }
    assert.equal(weaponRigOf(body, '7-3').sg, undefined, 'from aside the far arm needs none');
  }
});

/** A shield picture of `w` x `h`, its left half red, its right half blue (color32: row 0 the bottom). */
const card = (w, h) => {
  const colors = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) colors.set(x < w / 2 ? [200, 0, 0, 255] : [0, 0, 200, 255], (y * w + x) * 4);
  return { width: w, height: h, colors };
};
const canvas = (w, h, fill = null) => {
  const data = new Uint8Array(w * h * 4);
  if (fill) for (let y = fill[1]; y <= fill[3]; y++) for (let x = fill[0]; x <= fill[2]; x++) data.set([90, 90, 90, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
};
const at = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('the picture: its face as drawn, its inside boards and straps, the grip at its middle (a kite\'s above it)', () => {
  const P = shieldPicture(card(20, 30), 'k1');
  assert.equal(P.width, 20);
  assert.equal(P.gx, 10);
  assert.ok(P.gy < 15, 'a kite\'s grip is above its middle');
  assert.deepEqual([...P.face.subarray(0, 4)], [200, 0, 0, 255], 'top row first');
  const mid = (15 * 20 + 10) * 4;
  assert.notDeepEqual([...P.inside.subarray(mid, mid + 4)], [...P.face.subarray(mid, mid + 4)], 'the inside is not the face');
  assert.equal(shieldPicture({ width: 4, height: 4, colors: new Uint8Array(64) }, 'b1'), null, 'an empty picture');
});

test('drawn: over the body from the front, in open air only from behind and turned round, squeezed by the view', () => {
  const P = shieldPicture(card(20, 20), 'r1');
  const front = canvas(40, 40, [10, 10, 29, 29]);
  drawShield(front, [20, 20], P, 0, 1);
  assert.deepEqual(at(front, 15, 20), [200, 0, 0, 255], 'its face over the body');
  assert.deepEqual(at(front, 25, 20), [0, 0, 200, 255]);
  const over = canvas(40, 40, [10, 10, 29, 29]), { drawn } = drawShield(over, [20, 20], P, 0, 1);
  assert.deepEqual([drawn[20 * 40 + 20], drawn[20 * 40 + 11], drawn[5 * 40 + 20]], [0, 0, 0], 'the body it covers is still the body\'s outline');
  assert.equal(drawn[20 * 40 + 30] || drawn[20 * 40 + 9] || drawn[9 * 40 + 20], 0, 'a 20 px picture at a px a px');
  const back = canvas(40, 40, [15, 0, 24, 39]);
  drawShield(back, [20, 20], P, 4, 1);
  assert.deepEqual(at(back, 20, 20), [90, 90, 90, 255], 'the body before it');
  assert.equal(at(back, 12, 20)[3], 255, 'its inside in the air beside');
  assert.notDeepEqual(at(back, 12, 20), [200, 0, 0, 255]);
  // from behind, turned round: a picture with only its left half drawn falls right of the grip
  const half = card(20, 20);
  for (let y = 0; y < 20; y++) for (let x = 10; x < 20; x++) half.colors[(y * 20 + x) * 4 + 3] = 0;
  const H = shieldPicture(half, 'r1'), seen = (view) => { const c = canvas(60, 40); drawShield(c, [30, 20], H, view, 1); return [at(c, 25, 20)[3], at(c, 35, 20)[3]]; };
  assert.deepEqual(seen(0), [255, 0]);
  assert.deepEqual(seen(4), [0, 255]);
  const wide = (view) => { const c = canvas(60, 40); drawShield(c, [30, 20], P, view, 1); let n = 0; for (let x = 0; x < 60; x++) if (at(c, x, 20)[3]) n++; return n; };
  assert.ok(wide(0) > wide(1) && wide(1) > wide(2), 'turned from the eye, narrower');
  assert.equal(SHIELD_VIEWS[0].face && SHIELD_VIEWS[1].face && SHIELD_VIEWS[0].over, true);
  assert.equal([2, 3, 4].some((v) => SHIELD_VIEWS[v].face || SHIELD_VIEWS[v].over), false);
});

test('a shield past the canvas widens it on both sides and above, so the body stands where it was; its held px too', () => {
  const P = shieldPicture(card(20, 20), 'r1'), img = canvas(30, 30, [10, 5, 19, 29]);
  const { drawn, spill } = drawShield(img, [2, 4], P, 0, 1);
  assert.ok(spill.length > 0 && drawn[4 * 30 + 2] === 1);
  img.held = new Uint8Array(30 * 30); img.held[29 * 30 + 15] = 1; img.shield = drawn;
  const out = padFrame(img, spill);
  const side = (out.width - 30) / 2, top = out.height - 30;
  assert.ok(Number.isInteger(side) && side > 0 && top > 0);
  assert.deepEqual(at(out, 15 + side, 29 + top), [90, 90, 90, 255], 'the feet where they were, from the middle and the bottom');
  assert.equal(out.held[(29 + top) * out.width + 15 + side], 1);
  assert.equal(at(out, 0, top + 4)[3], 255, 'what fell off is on');
  assert.equal(out.shield[(top + 4) * out.width], 1, 'and is the shield\'s');
  assert.equal(out.shield[(4 + top) * out.width + 2 + side], 1);
  assert.equal(padFrame(img, []), img, 'nothing fell off');
});

test('where the body stands is read off the body, not off the shield it carries', () => {
  const w = 3, h = 2, colors = Uint32Array.from([1, 2, 3, 4, 5, 6]), shield = Uint8Array.from([1, 0, 0, 0, 0, 0]);   // the top left
  assert.deepEqual([...withoutShield(colors, shield, w, h)], [1, 2, 3, 0, 5, 6], 'row 0 the bottom');
  assert.deepEqual([...withoutShield(colors, shield, w, h, true)], [1, 2, 3, 4, 5, 0], 'mirrored');
  assert.equal(withoutShield(colors, null, w, h), colors);
  const body = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');
  const riders = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(body, /marks: spriteMarks\(withoutShield\(px, img\.shield, width, height, s\.mirror\)/);
  assert.match(riders, /marks: spriteMarks\(withoutShield\(px, raw\.shield, width, height, s\.mirror\)/);
});

test('a graft: the idle\'s torso fills the hole, not its arm; its arm is laid at the shoulder, the px it covers handed back', () => {
  const out = canvas(20, 20, [5, 0, 14, 19]);
  for (let y = 8; y <= 9; y++) for (let x = 15; x <= 19; x++) out.data.set([220, 170, 120, 255], (y * 20 + x) * 4);   // an arm out to the right
  const idle = canvas(20, 20, [5, 0, 14, 19]);
  for (let y = 0; y < 20; y++) for (let x = 5; x <= 14; x++) idle.data.set([10, 200, 10, 255], (y * 20 + x) * 4);
  for (let y = 4; y <= 15; y++) idle.data.set([200, 10, 200, 255], (y * 20 + 16) * 4);   // the idle's arm hangs at x 16
  const arm = new Uint8Array(400); for (let y = 4; y <= 15; y++) arm[y * 20 + 16] = 1;
  idle.data.set([200, 10, 200, 255], (8 * 20 + 13) * 4); arm[8 * 20 + 13] = 1;   // an arm px over the torso: never a fill
  const from = { img: idle, arm, fill: [0, 0], at: [-1, 0] };
  removeShieldArm(out, [[[12, 7], [20, 7], [20, 11], [12, 11]]], from);
  assert.deepEqual(at(out, 12, 8), [10, 200, 10, 255], 'the hole over the body: the idle\'s torso');
  assert.notDeepEqual(at(out, 13, 8), [200, 10, 200, 255], 'not its arm');
  assert.equal(at(out, 18, 8)[3], 0, 'the air the arm was in');
  const laid = graftArm(out, from);
  assert.deepEqual(at(out, 17, 10), [200, 10, 200, 255], 'the arm a px over, as `at` shifts it');
  assert.equal(laid[10 * 20 + 17], 1);
  assert.equal(laid[10 * 20 + 16], 0);
});

test('the free arm comes out: the body behind it filled, the air beside it cleared, no scrap of its edge left floating', () => {
  const img = canvas(40, 40, [10, 0, 29, 39]);
  for (let y = 18; y <= 21; y++) for (let x = 0; x <= 14; x++) img.data.set([220, 170, 120, 255], (y * 40 + x) * 4);   // an arm out to the left
  img.data.set([10, 10, 10, 255], (22 * 40 + 3) * 4);   // its edge, left a px below the outline
  const m = removeShieldArm(img, [[[-1, 17], [15, 17], [15, 22], [-1, 22]]]);
  assert.equal(m[19 * 40 + 5], 1);
  assert.equal(at(img, 5, 19)[3], 0, 'open air where it was out past the body');
  assert.ok(at(img, 14, 19)[3] === 255 && at(img, 14, 19)[0] < 100, 'the body where it lay over it');
  assert.equal(at(img, 3, 22)[3], 0, 'the scrap goes');
});

const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
const decodePng = async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; };
const picture = async (path) => decodePng(readFileSync(new URL(`${path}.png`, V)));
const shieldArt = async () => card(48, 67);
const opts = { urlOf: (k) => k, cloakUrlOf: (k) => `cloak/${k}`, hoodFixUrlOf: (k) => `hoodfix/${k}`, weaponUrlOf: (k) => k, picture, heldArt: async () => null, shieldArt };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i + 3] !== b.data[i + 3] || a.data[i] !== b.data[i]) n++; return n; };

test('composed: the shield before the weapon, never in its glow; the swing\'s free arm out; a picture not had yet is provisional', { skip: !PNG && 'no pngjs' }, async () => {
  for (const body of ['male', 'female']) {
    const plain = `LA:${body}:leather_leather_leather`;
    const walk = await decodeLayered(`${plain}:0-1:lll^k1@ls1`, decodePng, opts), bare = await decodeLayered(`${plain}:0-1:lll@ls1`, decodePng, opts);
    const dx = (walk.width - bare.width) / 2, dy = walk.height - bare.height;
    assert.ok(Number.isInteger(dx) && dx >= 0 && dy >= 0, `${body} padded evenly`);
    if (body === 'male') assert.ok(dx > 0, 'the male\'s walk is drawn on a canvas its shield is wider than');
    const [gx, gy] = weaponRigOf(body, '0-1').sh;
    assert.deepEqual(at(walk, Math.round(gx) + dx, Math.round(gy) + dy).slice(0, 3).map((v) => v > 100), [false, false, true], `${body}: the face at the free hand`);
    let glowOnShield = 0;
    for (let i = 0; i < walk.held.length; i++) if (walk.held[i] && walk.data[i * 4] === 0 && walk.data[i * 4 + 2] === 200) glowOnShield++;
    assert.equal(glowOnShield, 0, `${body}: the glow is the weapon's alone`);
    assert.ok(walk.shield && walk.shield.length === walk.width * walk.height && walk.shield.some((v) => v), `${body}: the air it fills, for the marks`);
    // the swing: the free arm out and the guard over it
    const swing = await decodeLayered(`${plain}:5-1:lll^k1@0`, decodePng, opts), two = await decodeLayered(`${plain}:5-1:lll@0`, decodePng, opts);
    assert.equal(swing.provisional, undefined);
    const late = await decodeLayered(`${plain}:5-1:lll^k1@0`, decodePng, { ...opts, shieldArt: async () => null });
    assert.equal(late.provisional, true, `${body}: drawn without the picture meanwhile, decoded again when it comes`);
    assert.ok(diff(swing, two) > diff(late, two) && diff(late, two) > 40, `${body}: the arm comes out, the shield over it`);
  }
  assert.ok(await shieldPictureOf('k1', 'male', shieldArt), 'a picture had');
  // from before, the idle's arm hangs back from the shoulder, as the idle draws it, and its torso fills the hole
  for (const [body, rf] of [['male', '5-1'], ['female', '6-2'], ['male', '6-3']]) {
    const sg = weaponRigOf(body, rf).sg, plain = `LA:${body}:leather_leather_leather`;
    const idle = await decodeLayered(`${plain}:${sg[0]}:lll@0`, decodePng, opts), arm = outlineMask(idle, weaponRigOf(body, sg[0]).sp);
    const swing = await decodeLayered(`${plain}:${rf}:lll^k1@0`, decodePng, { ...opts, shieldArt: async () => null });
    let laid = 0, all = 0;
    const onArm = new Uint8Array(swing.width * swing.height);
    for (let i = 0; i < arm.length; i++) {
      if (!arm[i]) continue;
      const X = (i % idle.width) - sg[3], Y = ((i / idle.width) | 0) - sg[4], j = (Y * swing.width + X) * 4;
      all++; onArm[Y * swing.width + X] = 1;
      if ([0, 1, 2, 3].every((c) => swing.data[j + c] === idle.data[i * 4 + c])) laid++;
    }
    assert.ok(all > 100 && laid / all > 0.95, `${body} ${rf}: the arm laid ${laid}/${all}`);
    const hole = outlineMask(await decodeLayered(`${plain}:${rf}:lll@0`, decodePng, opts), weaponRigOf(body, rf).sa);
    let filled = 0, torso = 0;
    for (let i = 0; i < hole.length; i++) {
      const X = (i % swing.width) + sg[1], Y = ((i / swing.width) | 0) + sg[2], j = Y * idle.width + X;
      if (!hole[i] || onArm[i] || !swing.data[i * 4 + 3] || X < 0 || Y < 0 || X >= idle.width || Y >= idle.height || !idle.data[j * 4 + 3] || arm[j]) continue;
      torso++;
      if ([0, 1, 2].every((c) => swing.data[i * 4 + c] === idle.data[j * 4 + c])) filled++;
    }
    assert.ok(torso > 20 && filled / torso > 0.95, `${body} ${rf}: the hole's torso the idle's, ${filled}/${torso}`);
  }
  // male 7-3, the far arm across before the body: its fill and its edge's scrap below the sword are open air
  const cross = await decodeLayered('LA:male:leather_leather_leather:7-3:lll^k1@0', decodePng, { ...opts, shieldArt: async () => null });
  let left = 0;
  for (let y = 71; y <= 77; y++) for (let x = 54; x <= 60; x++) if (cross.data[(y * cross.width + x) * 4 + 3]) left++;
  assert.equal(left, 0);
});

test('the body takes the shield from what it wears: my own outfit from the equip table, a walker\'s from its look', () => {
  const src = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');
  assert.match(src, /return \{ outfit: outfitOfSlots\(slots\), gender \};/);
  assert.match(src, /const plain = String\(lk\.outfit \?\? ''\)\.replace\(\/~\\d\/, ''\);/, 'a cloakless frame keeps the shield');
  const riders = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(riders, /outfit: outfitOfItems\(peer\.look\?\.items\)/);
});
