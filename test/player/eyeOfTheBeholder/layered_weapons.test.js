// LAYERED-WEAPONS (bible/04-Characters/Layered-Gearing.md): the layered body holds the weapon it uses - drawn by its
// kind and metal along the art's own hammer, the hammer taken out where the hands hold something else or nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  layeredWeaponOf, weaponShownFor, weaponRigOf, WEAPON_SHAPES, BARE_TWINS, ARMED_TWINS, GUN_FIRE_FRAME, isGunCode, removeWeapon,
  maskTile, fillFrom, weaponLen, WEAPON_SPAN, heldPicture, heldBow, heldImage, drawWeapon, chainWay, heldChain,
} from '../../../src/player/eyeOfTheBeholder/layeredWeapon.js';
import { inventoryItemImage } from '../../../src/systems/item/itemTemplates.js';
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
  // the body at columns 4-5, the other arm alone at 8; the hole at 0 (the arm's mirror) and 3 (the body's); the arm's
  // copy is longer than a speck, so only the mirror's own rule drops it
  const w = 9, h = 48, data = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h);
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

test('a walk whose hammer hides its shaft draws on Daggerfall\'s sword: pointed at the camera, or behind the body', { skip: !PNG && 'no pngjs' }, async () => {
  const diff = async (body, rf, code) => {
    const plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts), armed = await decodeLayered(`${plain}@${code}`, decodePng, opts);
    const px = [];
    for (let i = 0; i < bare.width * bare.height; i++) {
      if ([0, 1, 2, 3].some((c) => armed.data[i * 4 + c] !== bare.data[i * 4 + c])) px.push([i % bare.width, (i / bare.width) | 0, bare.data[i * 4 + 3] > 0]);
    }
    return px;
  };
  // a front view's blade comes at the camera: up from the hand, before the body - never hanging below it
  for (const [body, rf] of [['male', '0-0'], ['male', '0-1'], ['male', '15-0'], ['female', '0-1'], ['female', '0-2'], ['female', '15-0']]) {
    const fr = weaponRigOf(body, rf), [gx, gy] = fr.w, px = await diff(body, rf, 'ls1');
    assert.ok(fr.carry === undefined && fr.hang === undefined, `${body} ${rf}: no carry`);
    assert.ok(px.length > 15 && px.reduce((t, p) => t + p[1], 0) / px.length < gy, `${body} ${rf}: the blade rises from the hand`);
    assert.ok(px.some((p) => p[2]), `${body} ${rf}: drawn before the body`);
    assert.ok(Math.min(...px.map(([x, y]) => Math.hypot(x + 0.5 - gx, y + 0.5 - gy))) <= 3, `${body} ${rf}: drawn from the hand`);
  }
  // a back-3/4 view's blade is behind the body: drawn only where the body is not, the butt out of the fist
  for (const [body, rf] of [['male', '3-0'], ['male', '3-1'], ['female', '3-1'], ['female', '3-3']]) {
    const fr = weaponRigOf(body, rf), [gx, gy, ex, ey] = fr.w, px = await diff(body, rf, 'cm1');
    const blade = px.filter(([x, y]) => (x - gx) * (ex - gx) + (y - gy) * (ey - gy) > 4 * Math.hypot(ex - gx, ey - gy));
    assert.ok(blade.length > 0 && blade.every((p) => !p[2]), `${body} ${rf}: the blade shows only past the body`);
  }
  assert.equal(weaponRigOf('male', '2-0').w, undefined, 'a side walk keeps the hammer\'s own line');
});

test('a bow is held upright in the free hand, its string toward the body; the fist closes over the grip', { skip: !PNG && 'no pngjs' }, async () => {
  for (const [body, rf] of [['male', '0-0'], ['male', '3-1'], ['female', '1-1'], ['female', '16-0'], ['male', '2-0'], ['female', '4-2']]) {
    const fr = weaponRigOf(body, rf), [hx, hy, before] = fr.bow, plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts);
    for (const [code, part] of [['lb0', 1], ['sb0', 0.75]]) {
      const armed = await decodeLayered(`${plain}@${code}`, decodePng, opts);
      let y0 = Infinity, y1 = -Infinity, over = 0, fist = 0;
      for (let i = 0; i < bare.width * bare.height; i++) {
        if (![0, 1, 2, 3].some((c) => armed.data[i * 4 + c] !== bare.data[i * 4 + c])) continue;
        const x = i % bare.width, y = (i / bare.width) | 0;
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (bare.data[i * 4 + 3]) over++;
        if ((x + 0.5 - hx) ** 2 + (y + 0.5 - hy) ** 2 <= 4.4 && bare.data[i * 4 + 3]) fist++;
      }
      assert.equal(fist, 0, `${body} ${rf} ${code}: the fist covers the grip`);
      if (!before) { assert.equal(over, 0, `${body} ${rf} ${code}: a hand behind the body shows its bow in open air only`); continue; }
      const len = rig[body].bow * part;
      assert.ok(Math.abs(y1 - y0 - len * Math.cos(Math.PI / 15)) <= 3, `${body} ${rf} ${code}: tip to tip ${y1 - y0} px`);
      assert.ok(Math.abs((y0 + y1) / 2 - hy) <= 2, `${body} ${rf} ${code}: held at its middle`);
    }
  }
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

// THE PAPER DOLL'S PICTURE: a synthetic picture (color32, row 0 the bottom) - a handle, the doll's hand's gap, a guard,
// a blade - each part its own colour, so a composed frame says which part landed where
const RED = [255, 0, 0], GREEN = [0, 255, 0], BLUE = [0, 0, 255];
function sword({ flip = false, gap = true, handle = 0 } = {}) {
  const W = 60 + handle, H = 9, colors = new Uint8Array(W * H * 4);
  const put = (x, y, c) => colors.set([...c, 255], (y * W + (flip ? W - 1 - x - handle : x + handle)) * 4);
  for (let x = -handle; x < 8; x++) put(x, 4, BLUE);                             // the handle
  if (!gap) for (let x = 8; x < 12; x++) put(x, 4, BLUE);
  for (let y = 0; y < H; y++) for (const x of [12, 13]) put(x, y, GREEN);        // the guard
  for (let x = 14; x < W - handle; x++) for (const y of [3, 4, 5]) put(x, y, RED);   // the blade
  return { width: W, height: H, colors };
}

test('a paper-doll picture held: its grip the hand\'s gap, its head the longer side; a cut-off handle at the guard', () => {
  const a = heldPicture(sword());
  assert.ok(Math.abs(a.gx - 11.5) <= 1 && Math.abs(a.gy - 4) <= 1, `grip ${a.gx},${a.gy}`);
  assert.ok(a.ux > 0.99 && a.to > 40 && a.from < -8, 'the blade along +u, the handle behind the grip');
  const b = heldPicture(sword({ flip: true }));
  assert.ok(b.ux < -0.99 && Math.abs(b.gx - (59 - 11.5)) <= 1, 'mirrored, the blade the other way');
  const c = heldPicture(sword({ gap: false }));   // no gap: a tanto whose handle the picture cuts off - at the guard
  assert.ok(c && c.ux > 0.99 && Math.abs(c.gx - 11.5) <= 1.5, `guard grip ${c?.gx}`);
});

function bow() {   // a string along row 2, a limb bulging to row 14 with the hand's gap at its middle; the right limb cut short
  const W = 80, H = 18, colors = new Uint8Array(W * H * 4);
  for (let x = 0; x < 64; x++) colors.set([40, 40, 40, 255], (2 * W + x) * 4);
  for (let x = 0; x < 64; x++) {
    if (x >= 36 && x <= 42) continue;
    const y = Math.round(2 + 12 * (1 - ((x - 39) / 39) ** 2));
    for (const dy of [0, 1]) colors.set([...RED, 255], ((y + dy) * W + x) * 4);
  }
  return { width: W, height: H, colors };
}

test('a bow picture held: the grip the limb\'s gap, the string its axis, drawn from its longer limb', () => {
  const h = heldBow(bow());
  assert.ok(Math.abs(h.gx - 39) <= 1.5 && h.gy > 10, `grip ${h.gx},${h.gy}`);
  assert.ok(Math.abs(h.ux) > 0.99 && h.reach >= 38, `the string along x, reach ${h.reach}`);
  assert.equal(h.long, h.ux > 0 ? -1 : 1, 'the left limb is the whole one');
  // a short bow's limb is thick and nearly straight, more px on one line than its string: the string is still the axis
  const W = 80, H = 24, colors = new Uint8Array(W * H * 4);
  for (let x = 0; x < 80; x++) if (x < 30 || x > 49) colors.set([40, 40, 40, 255], (2 * W + x) * 4);   // the string, row 2
  for (let x = 0; x < 80; x++) {
    if (x >= 36 && x <= 42) continue;   // the hand's gap
    const y0 = x < 8 || x > 71 ? 12 : 16;   // the limb: straight but for its tips
    for (let dy = 0; dy < 5; dy++) colors.set([...RED, 255], ((y0 + dy) * W + x) * 4);
  }
  const t = heldBow({ width: W, height: H, colors });
  assert.ok(t && Math.abs(t.gx - 39) <= 1.5 && t.gy > 12, `grip on the limb ${t?.gx},${t?.gy}`);
  assert.ok(t.ry > 0.9, 'the back is away from the string, toward the limb');
});

test('the held picture is drawn on the frame\'s line from the fist; a bow from its longer limb both ways', { skip: !PNG && 'no pngjs' }, async () => {
  const pic = sword(), withPic = { ...opts, heldArt: async () => pic }, plain = 'LA:male:leather_leather_leather:2-0:lll';
  const bare = await decodeLayered(`${plain}@0`, decodePng, opts), armed = await decodeLayered(`${plain}@ls1`, decodePng, withPic);
  const fr = weaponRigOf('male', '2-0'), [qx, qy] = fr.q, D = Math.hypot(fr.t[0] - qx, fr.t[1] - qy), ux = (fr.t[0] - qx) / D, uy = (fr.t[1] - qy) / D;
  let red = 0, off = 0, behind = 0;
  for (let i = 0; i < bare.width * bare.height; i++) {
    const r = armed.data[i * 4], g = armed.data[i * 4 + 1], b = armed.data[i * 4 + 2];
    if (!(r > 200 && g < 60 && b < 60)) continue;
    const x = (i % bare.width) + 0.5 - qx, y = ((i / bare.width) | 0) + 0.5 - qy, proj = x * ux + y * uy;
    red++;
    if (Math.abs(x * -uy + y * ux) > 2.5) off++;
    if (proj < 0) behind++;
  }
  assert.ok(red > 15, `the blade drew ${red} px`);
  assert.equal(off, 0, 'the blade lies on the line');
  assert.equal(behind, 0, 'the blade is past the fist, the handle behind it');
  // the bow: the picture's right limb is cut short; the drawn bow reaches as far above the hand as below it
  const fb = weaponRigOf('male', '0-0'), [hx, hy] = fb.bow, bowArt = { ...opts, heldArt: async () => bow() };
  const held = await decodeLayered('LA:male:leather_leather_leather:0-0:lll@lb0', decodePng, bowArt);
  const plain0 = await decodeLayered('LA:male:leather_leather_leather:0-0:lll@0', decodePng, opts);
  let top = Infinity, bottom = -Infinity;
  for (let i = 0; i < held.width * held.height; i++) {
    if (![0, 1, 2, 3].some((c) => held.data[i * 4 + c] !== plain0.data[i * 4 + c])) continue;
    const y = (i / held.width) | 0; top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert.ok(Math.abs((hy - top) - (bottom - hy)) <= 3, `above ${hy - top}, below ${bottom - hy}`);
  assert.ok(Math.abs(bottom - top - rig.male.bow * Math.cos(Math.PI / 15)) <= 3, `tip to tip ${bottom - top}: the loose's own bow`);
});

test('from behind the blade is hidden behind the arm and the pommel shows; from the side the bow is in the near hand', { skip: !PNG && 'no pngjs' }, async () => {
  const withPic = { ...opts, heldArt: async () => sword({ handle: 24 }) };
  for (const [body, frames] of [['male', ['4-0', '4-1', '4-2', '4-3']], ['female', ['4-0', '4-1', '4-2', '4-3']]]) {
    let pommel = 0;
    for (const rf of frames) {
      const armed = await decodeLayered(`LA:${body}:leather_leather_leather:${rf}:lll@ls1`, decodePng, withPic);
      let red = 0;
      for (let i = 0; i < armed.width * armed.height; i++) {
        const [r, g, b] = armed.data.subarray(i * 4, i * 4 + 3);
        if (r > 200 && g < 60 && b < 60) red++;
        if (b > 200 && r < 60 && g < 60) pommel++;
      }
      assert.equal(red, 0, `${body} ${rf}: no blade from behind`);
    }
    assert.ok(pommel > 0, `${body}: the pommel shows below the fist`);
  }
  for (const body of ['male', 'female']) for (const rf of ['2-0', '2-1', '2-2', '2-3', '17-0']) {
    const fr = weaponRigOf(body, rf), [gx, gy] = fr.w ?? fr.q;
    assert.ok(fr.bow[2] === 1 && Math.hypot(fr.bow[0] - gx, fr.bow[1] - gy) <= 2.5, `${body} ${rf}: the bow in the near fist`);
  }
});

test('a flail\'s chain hangs; a katana is held as its flat picture, not the pack\'s foreshortened one', { skip: !PNG && 'no pngjs' }, async () => {
  // a flail: the handle along row 20 with the hand's gap, the chain and ball hanging off one side of it (the picture's heavier side)
  const W = 40, H = 40, colors = new Uint8Array(W * H * 4);
  for (let x = 0; x < 30; x++) if (x < 4 || x > 7) colors.set([...BLUE, 255], (20 * W + x) * 4);
  for (let y = 21; y < 38; y++) colors.set([...RED, 255], (y * W + 29) * 4);
  // the handle's head end is 21 picture px past the grip (x 8): the chain runs from there the way chainWay says - a walk's
  // hanging, lagging the hand's move since the last frame; a swing's flung out along the handle, trailing the blow
  for (const frame of ['2-0', '1-1', '0-0', '15-0', '7-1', '5-1', '6-3']) {
    const flail = await decodeLayered(`LA:male:leather_leather_leather:${frame}:lll@fl1`, decodePng, { ...opts, heldArt: async () => ({ width: W, height: H, colors }) });
    const fr = weaponRigOf('male', frame), [qx, qy, tx, ty] = fr.w ?? [...fr.q, ...fr.t], D = Math.hypot(tx - qx, ty - qy), ux = (tx - qx) / D, uy = (ty - qy) / D;
    const along = rig.male.cm * Math.max(0.14, Math.min(1, D / rig.male.len)), hx = qx + ux * 21 * along, hy = qy + uy * 21 * along;
    const red = [];
    for (let i = 0; i < flail.width * flail.height; i++) {
      if (flail.data[i * 4] > 200 && flail.data[i * 4 + 2] < 60 && flail.data[i * 4 + 1] < 60) red.push([(i % flail.width) + 0.5, ((i / flail.width) | 0) + 0.5]);
    }
    assert.ok(red.length > 3, `${frame}: the chain drawn (${red.length} px)`);
    const [gx, gy] = chainWay(fr.cv, { ux, uy }, Number(frame.split('-')[0]) >= 5 && Number(frame.split('-')[0]) <= 9);
    assert.ok(red.every(([x, y]) => Math.abs((x - hx) * gy - (y - hy) * gx) <= 1.6 && (x - hx) * gx + (y - hy) * gy > 0), `${frame}: the chain runs from the head end along (${gx.toFixed(2)}, ${gy.toFixed(2)})`);
    if (!fr.cv) assert.deepEqual([gx, gy], [0, 1], `${frame}: at rest it hangs plumb`);
  }  const kt = { group: 'Weapons', templateIndex: WEAPONS.Katana, material: 0 }, ls = { group: 'Weapons', templateIndex: WEAPONS.Longsword, material: 0 };
  assert.equal(heldImage(kt, { gender: 'male' }).record, inventoryItemImage(kt, { gender: 'male' }).record - 1);
  assert.deepEqual(heldImage(ls, { gender: 'female' }), inventoryItemImage(ls, { gender: 'female' }));
});

test('the bow is in the left hand: the free hand the art draws, or the near fist where it hides it - none where that fist lies flat on the body; a flipped picture\'s left hand is the art\'s other - the hammer\'s fist, on the far side, behind the body', { skip: !PNG && 'no pngjs' }, async () => {
  // unflipped: the back-3/4 walk's free hand is the near one, before the body; the idle and the female's 3-2 hold the hammer near
  for (const [body, frames] of [['male', ['3-0', '3-1', '3-2', '3-3']], ['female', ['3-0', '3-1', '3-3']]]) {
    for (const rf of frames) assert.equal(weaponRigOf(body, rf).bow[2], 1, `${body} ${rf}: the near hand, before the body`);
  }
  // the back-3/4 idle and the female's 3-2 press the bow hand flat to the body: the body hides the bow, flipped or not
  for (const [body, rf] of [['male', '18-0'], ['female', '18-0'], ['female', '3-2']]) {
    const fr = weaponRigOf(body, rf), plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    assert.ok(fr.bow === undefined && fr.bowM === undefined, `${body} ${rf}: no bow hand`);
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts), armed = await decodeLayered(`${plain}@lb1`, decodePng, opts);
    assert.deepEqual(armed.data, bare.data, `${body} ${rf}: none drawn, no hammer left`);
  }
  assert.ok(!layeredSprite('IdleRanged', 3, 0, 1, { outfit: 'lll', gender: 'male', weapon: 'lb3' }, true).key.endsWith(':m'), 'a flipped frame with no bow is the same picture flipped');
  // flipped (eotbBillboard.js MIRRORED: records 1-3 and their idles): the hammer's fist, behind the body, turned to its side
  const flippable = Object.keys(rig.male.frames).filter((rf) => [1, 2, 3, 16, 17, 18].includes(Number(rf.split('-')[0])));
  for (const body of ['male', 'female']) for (const rf of flippable) {
    const fr = weaponRigOf(body, rf), [gx, gy] = fr.w ?? fr.q;
    if (!fr.bow) continue;   // the body hides it (above)
    assert.ok(Array.isArray(fr.bowM) && fr.bowM[2] === 0 && fr.bowM[3] === -1 && Math.hypot(fr.bowM[0] - gx, fr.bowM[1] - gy) <= 2.5, `${body} ${rf}: the flipped bow at the hammer's fist ${JSON.stringify(fr.bowM)}`);
  }
  for (const rf of ['0-0', '4-0', '15-0', '19-0']) assert.equal(weaponRigOf('male', rf).bowM, undefined, `${rf}: never flipped`);
  // the sprite asks for it: a flipped bow frame is its own picture (`:m`), a sword's flip is the same picture turned
  const look = { outfit: 'lll', gender: 'male', weapon: 'lb3' };
  const [plainS, flipS] = [false, true].map((m) => layeredSprite('MoveRanged', 3, 0, 2, look, m));
  assert.ok(flipS.mirror && flipS.key === `${plainS.key}:m`, `flipped: ${flipS.key}`);
  assert.ok(!layeredSprite('MoveMelee', 3, 0, 2, { ...look, weapon: 'ls3' }, true).key.endsWith(':m'), 'a sword is the same picture flipped');
  // drawn: the flipped bow stands where the body hides it, on the hammer's side of the body - the far side once turned
  for (const [body, rf] of [['male', '3-1'], ['female', '3-0'], ['male', '1-1'], ['male', '2-2']]) {
    const plain = `LA:${body}:leather_leather_leather:${rf}:lll`, fr = weaponRigOf(body, rf);
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts);
    const [near, far] = await Promise.all([decodeLayered(`${plain}@lb1`, decodePng, opts), decodeLayered(`${plain}@lb1:m`, decodePng, opts)]);
    let over = 0, n = 0, sx = 0;
    for (let i = 0; i < bare.width * bare.height; i++) {
      if (![0, 1, 2, 3].some((c) => far.data[i * 4 + c] !== bare.data[i * 4 + c])) continue;
      n++; sx += i % bare.width;
      if (bare.data[i * 4 + 3]) over++;
    }
    assert.ok(n > 3 && over === 0, `${body} ${rf}: the far bow in open air only (${over} of ${n} over the body)`);
    assert.ok(Math.abs(sx / n - fr.bowM[0]) < Math.abs(sx / n - fr.bow[0]) || fr.bow[0] === fr.bowM[0], `${body} ${rf}: at the hammer's fist, not the free hand`);
    assert.notDeepEqual(near.data, far.data, `${body} ${rf}: the flipped picture is its own`);
  }
  // turned to its own hand's side: from behind-left the far hand's bow shows more of its edge than the near hand's
  const width = (mirror) => {
    const out = { width: 100, height: 100, data: new Uint8Array(100 * 100 * 4) };
    drawWeapon(out, { bow: [50, 50, 1], bowM: [50, 50, 1, -1] }, 'lb1', 30, 3, { bow: 75, cm: 0.6, pic: heldBow(bow()), mirror });
    let x0 = 100, x1 = -1;
    for (let i = 0; i < 100 * 100; i++) if (out.data[i * 4 + 3]) { x0 = Math.min(x0, i % 100); x1 = Math.max(x1, i % 100); }
    return x1 - x0;
  };
  assert.ok(width(true) < width(false) - 2, `the far hand's bow ${width(true)} px wide, the near's ${width(false)}`);
});

test('the doll\'s hand gap carries the handle where no fist of the art covers it - never over the body', { skip: !PNG && 'no pngjs' }, async () => {
  // the side flinch: the far fist is lost with the hammer, the grip in open air
  const pic = sword({ handle: 10 }), held = heldPicture(pic);
  assert.ok(held.bridge, 'a gap of its own: a bridge');
  let n = 0;
  for (let i = 0; i < held.bridge.colors.length; i += 4) if (held.bridge.colors[i + 3]) { n++; assert.deepEqual([...held.bridge.colors.subarray(i, i + 3)], BLUE, 'the handle\'s own colour'); }
  assert.ok(n >= 4, `${n} px across the gap`);
  assert.equal(heldPicture(sword({ gap: false })).bridge, null, 'no gap, no bridge');
  const plain = 'LA:male:leather_leather_leather:12-0:lll', withPic = { ...opts, heldArt: async () => pic };
  const bare = await decodeLayered(`${plain}@0`, decodePng, opts), armed = await decodeLayered(`${plain}@ls1`, decodePng, withPic);
  const fr = weaponRigOf('male', '12-0'), [qx, qy, tx, ty] = fr.w ?? [...fr.q, ...fr.t], D = Math.hypot(tx - qx, ty - qy);
  const ux = (tx - qx) / D, uy = (ty - qy) / D, along = rig.male.cm * Math.max(0.14, Math.min(1, D / rig.male.len));
  const isBlue = (x, y) => { const i = (y * bare.width + x) * 4; return armed.data[i + 2] > 200 && armed.data[i] < 60; };
  let air = 0, blue = 0, over = 0;
  for (let s = -0.5; s >= -(4 + 10) * along + 0.5; s -= 0.5) {   // from the fist back down the gap to the pommel
    const x = Math.floor(qx + ux * s), y = Math.floor(qy + uy * s);
    if (bare.data[(y * bare.width + x) * 4 + 3]) { if (isBlue(x, y)) over++; continue; }
    air++; if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isBlue(x + dx, y + dy)))) blue++;   // a line a px wide, unbroken
  }
  assert.ok(air > 4 && blue === air, `the handle joins guard and pommel in open air (${blue} of ${air})`);
  assert.equal(over, 0, 'the bridge is never over the body');
  // the side walk's fist is the art's: the gap under it stays the fist, never the handle over it
  const walk = 'LA:male:leather_leather_leather:2-1:lll', fw = weaponRigOf('male', '2-1'), [wx, wy] = fw.q;
  const wBare = await decodeLayered(`${walk}@0`, decodePng, opts), wArmed = await decodeLayered(`${walk}@ls1`, decodePng, withPic);
  let fist = 0, covered = 0;
  for (let y = Math.floor(wy) - 2; y <= wy + 2; y++) for (let x = Math.floor(wx) - 2; x <= wx + 2; x++) {
    const i = (y * wBare.width + x) * 4;
    if (!wBare.data[i + 3]) continue;
    fist++; if (wArmed.data[i + 2] > 200 && wArmed.data[i] < 60 && wArmed.data[i + 1] < 60) covered++;
  }
  assert.ok(fist > 5 && covered === 0, `the fist round the grip (${covered} of ${fist} px under the handle)`);
});

test('a bow seen edge on - from the front, from behind - is a line, not dashes', { skip: !PNG && 'no pngjs' }, async () => {
  const bowArt = { ...opts, heldArt: async () => bow() };
  for (const [body, rf] of [['male', '0-0'], ['male', '4-0'], ['female', '19-0'], ['female', '0-1']]) {
    const plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts), held = await decodeLayered(`${plain}@lb0`, decodePng, bowArt);
    const rows = new Map();
    for (let i = 0; i < held.width * held.height; i++) {
      if ([0, 1, 2, 3].some((c) => held.data[i * 4 + c] !== bare.data[i * 4 + c])) rows.set((i / held.width) | 0, true);
    }
    const ys = [...rows.keys()], top = Math.min(...ys), bottom = Math.max(...ys), [, hy, before] = weaponRigOf(body, rf).bow;
    let gaps = 0;
    for (let y = top; y <= bottom; y++) if (!rows.has(y) && (before || Math.abs(y - hy) > 6)) gaps++;   // behind the body, the body hides the grip's rows
    assert.ok(bottom - top > 30 && gaps <= (before ? 0 : 2), `${body} ${rf}: ${gaps} rows missing of ${bottom - top}`);
  }
});

test('a hole px the rig marks open air (a head out past the hand, over a dark lining) is cleared whatever its edge says', { skip: !PNG && 'no pngjs' }, async () => {
  const w = 4, h = 1, data = new Uint8Array(w * h * 4), mask = Uint8Array.from([0, 1, 1, 0]);
  for (let x = 0; x < w; x++) data.set([90, 60, 30, 255], x * 4);   // the body all round: a hole inside it
  removeWeapon({ width: w, height: h, data }, mask, 0, Int32Array.from([-1, -1, -2, -1]));
  assert.equal(data[1 * 4 + 3], 255, 'its own edge: the body');
  assert.equal(data[2 * 4 + 3], 0, 'marked open air: cleared');
  const strip = { width: 12, height: 1, data: new Uint8Array(12 * 4) };
  strip.data.set([128, 128, 64, 255], 1 * 4); strip.data.set([128, 128, 0, 255], 2 * 4);
  assert.deepEqual([...fillFrom(strip, 'l')], [-1, -2, -1, -1], 'blue 1..127: open air; 0: none');
  // the female's back walk: the hammer's head and its dark underside are gone, not filled with the lining
  for (const outfit of ['lll', 'p3cp3']) {
    const plain = `LA:female:${outfitCombo(outfitPieces(outfit))}:4-0:${outfit}`, bare = await decodeLayered(`${plain}@0`, decodePng, opts);
    let left = 0;
    for (let y = 79; y <= 101; y++) for (let x = 83; x <= 93; x++) if (bare.data[(y * bare.width + x) * 4 + 3]) left++;
    assert.equal(left, 0, `${outfit}: ${left} px of the head left past the hand`);
  }
});

test('LAYERED-GLOW the compose keeps the weapon\'s own px: those its drawing changed, the iron warhammer\'s the art\'s; none in bare hands', { skip: !PNG && 'no pngjs' }, async () => {
  for (const [body, rf, outfit] of [['male', '2-1', 'lll'], ['female', '17-0', 'p0p0p0~2']]) {
    const plain = `LA:${body}:${outfitCombo(outfitPieces(outfit))}:${rf}:${outfit}`;
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts), armed = await decodeLayered(`${plain}@ls1`, decodePng, opts);
    assert.equal(bare.held, undefined, 'bare hands: no weapon of its own');
    let n = 0;
    for (let i = 0; i < armed.held.length; i++) {
      const changed = [0, 1, 2, 3].some((c) => armed.data[i * 4 + c] !== bare.data[i * 4 + c]);
      assert.equal(armed.held[i], changed ? 1 : 0, `${body} ${rf}: px ${i}`);
      n += armed.held[i];
    }
    assert.ok(n > 15, `${body} ${rf}: ${n} weapon px`);
  }
  const iron = await decodeLayered('LA:male:leather_leather_leather:2-1:lll@wh0', decodePng, opts), mask = maskTile(await picture('weapon/male/2-1'), 'l');
  let k = 0;
  for (let i = 0; i < mask.length; i++) { assert.ok(!iron.held[i] || mask[i], 'only the hammer\'s'); k += iron.held[i]; }
  assert.ok(k > 20, `the art's own hammer: ${k} px`);
});

test('a flail\'s chain swings: in a walk it lags the hand\'s move since the frame before, no further than a tilt; in a swing it is flung out along the handle and trails the blow; the ball stays in the picture', { skip: !PNG && 'no pngjs' }, async () => {
  assert.deepEqual(chainWay(undefined, { ux: 1, uy: 0 }, false), [0, 1], 'at rest: plumb');
  const [lx, ly] = chainWay([8, 0], { ux: 1, uy: 0 }, false);
  assert.ok(lx < -0.2 && ly > 0.8, `the hand goes right, the chain lags left (${lx.toFixed(2)}, ${ly.toFixed(2)})`);
  const [fx, fy] = chainWay([80, 0], { ux: 1, uy: 0 }, false);
  assert.ok(Math.atan2(-fx, fy) <= 0.56, 'never past the tilt, however fast');
  const [sx, sy] = chainWay([-20, 0], { ux: 0, uy: -1 }, true);
  assert.ok(sy < 0 && sx > 0, `a swing: out along the raised handle, trailing the blow (${sx.toFixed(2)}, ${sy.toFixed(2)})`);
  // the rig: a walk loops (its first frame's move is from its last), a swing starts at rest, a held pose has none
  for (const body of ['male', 'female']) {
    assert.ok(Array.isArray(weaponRigOf(body, '2-0').cv) && Array.isArray(weaponRigOf(body, '5-2').cv), `${body}: a walk's and a swing's move`);
    for (const rf of ['5-0', '15-0', '12-0']) assert.equal(weaponRigOf(body, rf).cv, undefined, `${body} ${rf}: at rest`);
  }
  // a swing that flings the ball off the picture's top, and a walk's toward its side: it stays inside
  const W = 40, H = 80, colors = new Uint8Array(W * H * 4);
  for (let x = 0; x < 30; x++) if (x < 4 || x > 7) colors.set([0, 0, 255, 255], (20 * W + x) * 4);
  for (let y = 21; y < 70; y++) for (let x = 27; x <= 31; x++) colors.set([255, 0, 0, 255], (y * W + x) * 4);
  for (const [body, rf] of [['male', '8-1'], ['male', '6-1'], ['male', '0-0'], ['female', '0-0']]) {
    const f = await decodeLayered(`LA:${body}:leather_leather_leather:${rf}:lll@fl1`, decodePng, { ...opts, heldArt: async () => ({ width: W, height: H, colors }) });
    let red = 0, edge = 0;
    for (let i = 0; i < f.width * f.height; i++) {
      if (!(f.data[i * 4] > 200 && f.data[i * 4 + 1] < 60 && f.data[i * 4 + 2] < 60)) continue;
      red++; if (i % f.width === 0 || i % f.width === f.width - 1 || i < f.width) edge++;
    }
    assert.ok(red > 20 && edge === 0, `${body} ${rf}: the ball whole in the picture (${red} px, ${edge} on its edge)`);
  }
  // a chain a picture px thin keeps a screen px, hung on a px's edge: x 20.0 exactly
  const thin = new Uint8Array(W * H * 4);
  for (let x = 0; x < 30; x++) if (x < 4 || x > 7) thin.set([0, 0, 255, 255], (20 * W + x) * 4);
  for (let y = 21; y < 38; y++) thin.set([255, 0, 0, 255], (y * W + 29) * 4);
  const pic = heldChain(heldPicture({ width: W, height: H, colors: thin })), along = 0.62 * (20 / 30), qx = 20 - 21 * along;
  const out = { width: 60, height: 60, data: new Uint8Array(60 * 60 * 4) };
  drawWeapon(out, { q: [qx, 10], t: [qx + 20, 10], d: 'f'.repeat(87), side: 1 }, 'fl1', 30, 2, { cm: 0.62, pic, swing: false });
  const rows = new Set();
  for (let i = 0; i < 60 * 60; i++) if (out.data[i * 4] > 200 && out.data[i * 4 + 2] < 60) rows.add((i / 60) | 0);
  assert.ok(rows.size >= 8, `the thin chain drawn on ${rows.size} rows`);
});

test('the loose\'s frames hold the art\'s own bow: with no bow in hand they are the ranged stance, hands empty', () => {
  const look = (weapon) => ({ outfit: 'lll', gender: 'male', weapon });
  const sword = layeredSprite('AttackRanged', 0, 1, 4, look('ls3'), false), none = layeredSprite('AttackRanged', 0, 1, 4, look(null), false);
  for (const s of [sword, none]) assert.ok(s.key.endsWith('@0') && s.record === 15, `the stance, hands empty: ${s.key}`);
  const bow = layeredSprite('AttackRanged', 0, 1, 4, look('lb3'), false);
  assert.ok(!bow.key.includes('@') && bow.record === 20, `a bow's loose is the art's: ${bow.key}`);
  const unnamed = layeredSprite('AttackRanged', 0, 1, 4, { outfit: 'lll', gender: 'male' }, false);
  assert.ok(!unnamed.key.includes('@') && unnamed.record === 20, 'a look that names no weapon keeps the art\'s loose');
});
