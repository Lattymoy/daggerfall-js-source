// LAYERED-WEAPONS (bible/04-Characters/Layered-Gearing.md): the layered body holds the weapon it uses - drawn by its
// kind and metal along the art's own hammer, the hammer taken out where the hands hold something else or nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  layeredWeaponOf, weaponShownFor, weaponRigOf, WEAPON_SHAPES, BARE_TWINS, ARMED_TWINS, GUN_FIRE_FRAME, isGunCode, removeWeapon,
  maskTile, fillFrom, weaponLen, WEAPON_SPAN,
} from '../../../src/player/eyeOfTheBeholder/layeredWeapon.js';
import { layeredSprite, outfitPieces, outfitCombo, decodeLayered } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { ALL_LOOKS, APPEARANCE_KINDS } from '../../../src/net/appearanceLaw.js';
import { bodyState } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { walkerWeapon } from '../../../src/net/peer/peerRiders.js';
import { GATHER_POSE_ACTS } from '../../../src/net/peer/peerGather.js';
import { WEAPONS } from '../../../src/characters/weapons.js';
import { THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE } from '../../../src/characters/thunderlockIds.js';
import { HAND_WRAPS_TEMPLATE } from '../../../src/characters/handWrapsIds.js';
import { EQUIP_SLOTS } from '../../../src/characters/paperdoll/paperdoll.js';

const V = new URL('../../../vendor/layered-armor/', import.meta.url);
const rig = JSON.parse(readFileSync(new URL('weapon/manifest.json', V), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('manifest.json', V), 'utf8'));
const weapon = (templateIndex, material = 0, extra = {}) => ({ group: 'Weapons', templateIndex, material, ...extra });

test('every Daggerfall weapon is drawn as its own shape, the port\'s guns and the RRI pair too', () => {
  assert.deepEqual({ ...WEAPON_SHAPES }, {
    [WEAPONS.Dagger]: 'dg', [WEAPONS.Tanto]: 'tn', [WEAPONS.Staff]: 'sf', [WEAPONS.Shortsword]: 'ss', [WEAPONS.Wakazashi]: 'wk',
    [WEAPONS.Broadsword]: 'bs', [WEAPONS.Saber]: 'sa', [WEAPONS.Longsword]: 'ls', [WEAPONS.Katana]: 'kt', [WEAPONS.Claymore]: 'cm',
    [WEAPONS.Dai_Katana]: 'dk', [WEAPONS.Mace]: 'mc', [WEAPONS.Flail]: 'fl', [WEAPONS.Warhammer]: 'wh', [WEAPONS.Battle_Axe]: 'ba',
    [WEAPONS.War_Axe]: 'wa', [WEAPONS.Short_Bow]: 'sb', [WEAPONS.Long_Bow]: 'lb', 513: 'ha', 514: 'lf',
    [THUNDERLOCK_TEMPLATE]: 'tl', [PISTOLET_TEMPLATE]: 'pt',
  });
});

test('a held item\'s code is its shape and its metal; bare hands, the Hand Wraps and a non-weapon hold none', () => {
  assert.equal(layeredWeaponOf(weapon(WEAPONS.Longsword, 7)), 'ls7');
  assert.equal(layeredWeaponOf(weapon(WEAPONS.Katana, 9)), 'kt9');
  assert.equal(layeredWeaponOf(weapon(WEAPONS.Dagger)), 'dg0');
  assert.equal(layeredWeaponOf(weapon(WEAPONS.Long_Bow, 3)), 'lb3');
  assert.equal(layeredWeaponOf(weapon(WEAPONS.Mace, 42)), 'mc0', 'a material out of range is iron');
  assert.equal(layeredWeaponOf(null), null);
  assert.equal(layeredWeaponOf(weapon(HAND_WRAPS_TEMPLATE)), null);
  assert.equal(layeredWeaponOf({ group: 'Armor', templateIndex: WEAPONS.Mace, material: 2 }), null);
  // APPEARANCES: a weapon wearing a look is drawn as the look (a look of its kind, another template of it)
  const own = WEAPONS.Longsword, look = ALL_LOOKS.find((l) => l.t !== own && l.kind === APPEARANCE_KINDS[own]);
  assert.ok(look, 'a look of the longsword\'s kind');
  assert.equal(layeredWeaponOf(weapon(own, 1, { appearance: { t: look.t, m: look.m, v: look.v } })), `${WEAPON_SHAPES[look.t]}${look.m}`);
});

test('what the hands show: nothing sheathed or casting, the weapon in a melee stance, the bow drawn, the loose\'s own bow', () => {
  const tables = ['Idle', 'Move', 'Death', 'IdleMelee', 'MoveMelee', 'AttackMelee', 'IdleRanged', 'MoveRanged', 'AttackRanged', 'IdleSpell', 'MoveSpell', 'AttackSpell'];
  const shown = (held) => Object.fromEntries(tables.map((t) => [t, weaponShownFor(t, held)]));
  assert.deepEqual(shown('ls7'), {
    Idle: '0', Move: '0', Death: '0', IdleMelee: 'ls7', MoveMelee: 'ls7', AttackMelee: 'ls7',
    IdleRanged: '0', MoveRanged: '0', AttackRanged: null, IdleSpell: '0', MoveSpell: '0', AttackSpell: '0',
  });
  assert.deepEqual(shown('lb3'), {
    Idle: '0', Move: '0', Death: '0', IdleMelee: '0', MoveMelee: '0', AttackMelee: '0',
    IdleRanged: 'lb3', MoveRanged: 'lb3', AttackRanged: null, IdleSpell: '0', MoveSpell: '0', AttackSpell: '0',
  });
  assert.deepEqual(shown(null), { ...shown('lb3'), IdleRanged: '0', MoveRanged: '0' });
});

test('the sprite\'s key carries what the hands show; an iron warhammer is the art as drawn', () => {
  const look = (w, gender = 'male') => ({ outfit: 'lll', gender, weapon: w });
  assert.match(layeredSprite('Move', 2, 0, 4, look('ls7'), false).key, /:2-0:lll@0$/);
  assert.match(layeredSprite('MoveMelee', 2, 0, 2, look('ls7'), false).key, /:2-0:lll@ls7$/);
  assert.match(layeredSprite('IdleMelee', 2, 0, 1, look('wh0'), false).key, /:17-0:lll$/);
  assert.match(layeredSprite('IdleMelee', 2, 0, 1, look('wh7'), false).key, /:17-0:lll@wh7$/);
  assert.match(layeredSprite('AttackRanged', 2, 0, 4, look('lb0'), false).key, /:22-0:lll$/, 'the loose keeps its own bow');
  assert.match(layeredSprite('IdleRanged', 2, 0, 1, look('lb0'), false).key, /:17-0:lll@lb0$/);
  // the cast is the swing's wind-up and throw, frame for frame, hands empty - never the bow
  const cast = [0, 1, 2, 3].map((f) => layeredSprite('AttackSpell', 2, f, 4, look('ls7'), false));
  assert.deepEqual(cast.map((s) => `${s.record}-${s.frame}`), ['7-0', '7-1', '7-2', '7-3']);
  assert.ok(cast.every((s) => s.key.endsWith('@0')));
  assert.equal(outfitPieces('p6cl~2@ls7').weapon, 'ls7');
  assert.equal(outfitPieces('lll@0').weapon, '0');
  assert.equal(outfitPieces('lll').weapon, null);
  assert.equal(outfitPieces('lll@ls'), null);
});

test('the front walk\'s hidden-arm frame: empty-handed its mirror twin, armed the next frame, the art as drawn', () => {
  for (const gender of ['male', 'female']) {
    assert.deepEqual({ ...BARE_TWINS[gender] }, { '0-2': '0-0' });
    assert.deepEqual({ ...ARMED_TWINS[gender] }, { '0-2': '0-3' });
    const bare = layeredSprite('Move', 0, 2, 4, { outfit: 'lll', gender, weapon: null }, false);
    assert.deepEqual([bare.record, bare.frame, bare.mirror], [0, 0, true]);
    assert.match(bare.rec, /_0-0m$/);
    const armed = layeredSprite('MoveMelee', 0, 1, 2, { outfit: 'lll', gender, weapon: 'ls1' }, false);
    assert.deepEqual([armed.record, armed.frame, armed.mirror], [0, 3, false], 'the sword keeps its hand');
    const art = layeredSprite('MoveMelee', 0, 1, 2, { outfit: 'lll', gender, weapon: 'wh0' }, false);
    assert.deepEqual([art.record, art.frame, art.mirror], [0, 2, false]);
  }
});

test('a gun fires from the hip in one frame; a flinch keeps what the hands held', () => {
  const look = (w) => ({ outfit: 'lll', gender: 'male', weapon: w });
  const shot = [0, 1, 2, 3, 4, 5].map((f) => layeredSprite('AttackMelee', 2, f, 6, look('tl0'), false));
  assert.ok(shot.every((s) => s.frame === GUN_FIRE_FRAME && s.key.endsWith('@tl0')));
  assert.ok(isGunCode('pt3') && !isGunCode('ls1') && !isGunCode(null));
  assert.equal(layeredSprite('AttackMelee', 2, 5, 6, look('ls7'), false).frame, 5, 'a sword swings through');
  assert.match(layeredSprite('Death', 2, 0, 1, { ...look('ls7'), armedTable: 'IdleMelee' }, false).key, /:12-0:lll@ls7$/);
  assert.match(layeredSprite('Death', 2, 0, 1, look('ls7'), false).key, /:12-0:lll@0$/, 'the fall drops it');
  const peerSrc = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(peerSrc, /flinch \? \{ armedTable: r\.table \} : \{\}/);
});

test('the rig covers every frame that holds the hammer, in all three chest families', () => {
  for (const body of ['male', 'female']) {
    const hammerFrames = manifest[body].outfits.leather_leather_leather.frames.filter((k) => Number(k.split('-')[0]) < 20);
    assert.deepEqual(Object.keys(rig[body].frames).sort(), [...hammerFrames].sort());
    assert.ok(weaponLen(body) > 20 && weaponLen(body) < 60);
    for (const rf of hammerFrames) {
      assert.ok(existsSync(new URL(`weapon/${body}/${rf}.png`, V)), `${body} ${rf}: no mask`);
      for (const top of ['l', 'c', 'p']) {
        const fr = weaponRigOf(body, rf, top);
        assert.equal(fr.d.length, WEAPON_SPAN[1] - WEAPON_SPAN[0] + 1);
        assert.ok([fr.q, fr.t].flat().every(Number.isFinite));
        assert.ok(fr.fill === 0 || (Array.isArray(fr.fill) && fr.fill.length === 3));
      }
    }
    assert.equal(weaponRigOf(body, '22-0'), null, 'the bow frames hold no hammer');
  }
  assert.notDeepEqual(weaponRigOf('male', '5-0', 'p').t, weaponRigOf('male', '5-0', 'l').t, 'a plate chest moves the hammer');
});

test('taking the hammer out: a hole in the body is filled from the body round it, an edge in open air is cleared', () => {
  // columns 0-2 the body, 3-5 open air; the hammer's px at (1, 1), inside the body, and at (4, 1), in the air
  const w = 6, h = 3, data = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < 3; x++) data.set([100, 50, 20, 255], (y * w + x) * 4);
  for (const i of [w + 1, w + 4]) { data.set([20, 20, 20, 255], i * 4); mask[i] = 1; }
  removeWeapon({ width: w, height: h, data }, mask, 0);
  assert.deepEqual([...data.subarray((w + 1) * 4, (w + 1) * 4 + 4)], [100, 50, 20, 255], 'the hole in the body is the body');
  assert.deepEqual([...data.subarray((w + 4) * 4, (w + 4) * 4 + 4)], [0, 0, 0, 0], 'the px in the air is air');
});

test('a thin piece out in the air goes with the air, though it touches the body at one end', () => {
  // the body at column 0; the hammer a stick along row 1 from it, open air above and below
  const w = 7, h = 3, data = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) data.set([100, 50, 20, 255], y * w * 4);
  for (let x = 1; x < 6; x++) { data.set([20, 20, 20, 255], (w + x) * 4); mask[w + x] = 1; }
  removeWeapon({ width: w, height: h, data }, mask, 0);
  for (let x = 1; x < 6; x++) assert.equal(data[(w + x) * 4 + 3], 0, `px ${x} cleared`);
});

test('a hole px copies its own source where the rig gives one, before the frame\'s shift or the blend', () => {
  const w = 8, h = 3, data = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h), from = new Int32Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) data.set([(i % w) * 20, 0, 0, 255], i * 4);
  mask[w + 3] = 1; from[w + 3] = w + 6;
  removeWeapon({ width: w, height: h, data }, mask, 0, from);
  assert.deepEqual([...data.subarray((w + 3) * 4, (w + 3) * 4 + 4)], [120, 0, 0, 255]);
  // the rig's tile: (dx, dy) + 128 in red and green, blue 255 where there is a source; one tile a chest family
  const strip = { width: 12, height: 1, data: new Uint8Array(12 * 4) };
  strip.data.set([130, 128, 255, 255], 1 * 4); strip.data.set([128, 128, 0, 255], 2 * 4); strip.data.set([127, 128, 255, 255], 9 * 4);
  assert.deepEqual([...fillFrom(strip, 'l')], [-1, 3, -1, -1]);
  assert.deepEqual([...fillFrom(strip, 'p')], [-1, 0, -1, -1]);
});

test('a mirror fill keeps what joins the body and drops a copied piece that floats', () => {
  // the body at columns 4-5, the other arm alone at 8; the hole at 0 (the arm's mirror) and 3 (the body's)
  const w = 9, h = 3, data = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (const x of [4, 5, 8]) data.set([100, 50, 20, 255], (y * w + x) * 4);
  for (let y = 0; y < h; y++) for (const x of [0, 3]) { data.set([20, 20, 20, 255], (y * w + x) * 4); mask[y * w + x] = 1; }
  removeWeapon({ width: w, height: h, data }, mask, [1, 4, 0]);
  for (let y = 0; y < h; y++) {
    assert.equal(data[(y * w + 3) * 4 + 3], 255, 'the body\'s side copied in');
    assert.equal(data[(y * w) * 4 + 3], 0, 'the other arm\'s copy, touching nothing, is air');
  }
});

const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
const decodePng = async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; };
const picture = async (path) => decodePng(readFileSync(new URL(`${path}.png`, V)));
const opts = { urlOf: (k) => k, cloakUrlOf: (k) => `cloak/${k}`, hoodFixUrlOf: (k) => `hoodfix/${k}`, weaponUrlOf: (k) => k, picture };

test('composed: empty hands lose the hammer and nothing else; a weapon adds itself; the iron warhammer is the art', { skip: !PNG && 'no pngjs' }, async () => {
  for (const [body, rf, outfit] of [['male', '2-1', 'lll'], ['female', '17-0', 'p0p0p0'], ['male', '5-0', 'p6p2c']]) {
    const top = outfitPieces(outfit).top[0];
    const plain = `LA:${body}:${outfitCombo(outfitPieces(outfit))}:${rf}:${outfit}`;
    const art = await decodeLayered(plain, decodePng, opts);
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts);
    const armed = await decodeLayered(`${plain}@ls1`, decodePng, opts);
    const mask = maskTile(await picture(`weapon/${body}/${rf}`), top);
    let outside = 0, left = 0, n = 0, drawn = 0;
    for (let i = 0; i < mask.length; i++) {
      const same = [0, 1, 2, 3].every((c) => art.data[i * 4 + c] === bare.data[i * 4 + c]);
      if (!mask[i] && !same) outside++;
      if (mask[i]) { n++; if (same && art.data[i * 4 + 3]) left++; }
      if ([0, 1, 2, 3].some((c) => armed.data[i * 4 + c] !== bare.data[i * 4 + c])) drawn++;
    }
    assert.equal(outside, 0, `${body} ${rf}: px off the hammer changed`);
    assert.ok(left < n * 0.25, `${body} ${rf}: ${left} of the hammer's ${n} px still the hammer's`);
    assert.ok(drawn > 15, `${body} ${rf}: the longsword drew ${drawn} px`);
  }
  const iron = layeredSprite('IdleMelee', 2, 0, 1, { outfit: 'lll', gender: 'male', weapon: 'wh0' }, false);
  assert.ok(!iron.key.includes('@'));
});

test('composed: the chest a swing crossed is the body\'s own px, copied from where the rig says', { skip: !PNG && 'no pngjs' }, async () => {
  const plain = 'LA:male:leather_leather_leather:7-4:lll', strip = await picture('weapon/male/7-4');
  const mask = maskTile(strip, 'l'), from = fillFrom(strip, 'l');
  const art = await decodeLayered(plain, decodePng, opts), bare = await decodeLayered(`${plain}@0`, decodePng, opts);
  let n = 0, same = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || from[i] < 0 || !bare.data[i * 4 + 3]) continue;
    n++; if ([0, 1, 2].every((c) => bare.data[i * 4 + c] === art.data[from[i] * 4 + c])) same++;
  }
  assert.ok(n > 40 && same > n * 0.9, `${same} of ${n} hole px are their source's`);
});

test('a walk whose hammer pointed at the camera hangs the weapon from the hand: down, the handle behind the fist', { skip: !PNG && 'no pngjs' }, async () => {
  for (const [body, rf] of [['male', '4-1'], ['female', '4-2'], ['male', '0-0'], ['female', '0-3'], ['male', '15-0']]) {
    const fr = weaponRigOf(body, rf);
    assert.ok(Array.isArray(fr.carry) && fr.carry[1] > 0.9, `${body} ${rf}: hangs down`);
    const [hx, hy] = fr.hang ?? fr.q, plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts), armed = await decodeLayered(`${plain}@ls1`, decodePng, opts);
    let n = 0, sy = 0, over = 0;
    for (let i = 0; i < bare.width * bare.height; i++) {
      if (![0, 1, 2, 3].some((c) => armed.data[i * 4 + c] !== bare.data[i * 4 + c])) continue;
      const y = (i / bare.width) | 0; n++; sy += y;
      if (y < hy - 1.5 && bare.data[i * 4 + 3]) over++;
    }
    assert.ok(n > 20 && sy / n > hy + 8, `${body} ${rf}: the sword hangs below the hand (${n} px, mean y ${(sy / n).toFixed(1)} vs ${hx}, ${hy})`);
    assert.equal(over, 0, `${body} ${rf}: the handle drawn over the arm`);
  }
  assert.equal(weaponRigOf('male', '2-0').carry, undefined, 'a side walk whose hammer trailed keeps its line');
});

test('a back walk keeps the fist: the dark glove round the grip is not the hammer', { skip: !PNG && 'no pngjs' }, async () => {
  // the shaft over the glove is the hammer's, so up to half the fist's box; female 4-0 holds the head up, by the fist
  const FIST_TAKEN = 0.5, back = { male: ['3-0', '3-1', '3-2', '3-3', '4-0', '4-1', '4-2', '4-3'], female: ['3-0', '3-1', '3-3', '4-1', '4-2', '4-3'] };
  for (const [body, frames] of Object.entries(back)) {
    for (const rf of frames) {
      const strip = await picture(`weapon/${body}/${rf}`), mask = maskTile(strip, 'l'), w = strip.width / 3;
      const [qx, qy] = weaponRigOf(body, rf).q.map(Math.round);
      let k = 0, n = 0;
      for (let y = qy - 8; y <= qy - 2; y++) for (let x = qx - 3; x <= qx + 3; x++) { n++; k += mask[y * w + x]; }
      assert.ok(k < n * FIST_TAKEN, `${body} ${rf}: ${k} of the fist's ${n} px taken`);
    }
  }
});

test('a walker holds the tool of its act, else the weapon in the hand its pose says it uses', () => {
  const look = { items: [{ ...weapon(WEAPONS.Longsword, 7), equipSlot: EQUIP_SLOTS.RightHand }, { ...weapon(WEAPONS.Battle_Axe, 2), equipSlot: EQUIP_SLOTS.LeftHand }] };
  assert.equal(walkerWeapon(look, {}), 'ls7');
  assert.equal(walkerWeapon(look, { lh: 1 }), 'ba2');
  assert.equal(walkerWeapon({ items: [] }, {}), null);
  const act = (name) => ({ ga: GATHER_POSE_ACTS.indexOf(name) + 1 });
  assert.equal(walkerWeapon(look, act('chop')), 'wa0', 'the woodcutter\'s axe, not the sword in hand');
  assert.equal(walkerWeapon(look, act('mine')), 'wh0');
  assert.equal(walkerWeapon(look, act('hand')), null, 'an act with bare hands holds nothing');
});

test('the body reads the held weapon off the rig, and its look carries the code', () => {
  const sword = weapon(WEAPONS.Saber, 5);
  assert.equal(bodyState({ heldWeapon: sword }).heldWeapon, sword);
  assert.equal(bodyState({}).heldWeapon, null);
  const rigSrc = readFileSync(new URL('../../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rigSrc, /heldWeapon: playerWeapon\.weapon \?\? null,/);
  const bodySrc = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');
  assert.match(bodySrc, /weapon: layeredWeaponOf\(last\.heldWeapon\)/);
});
