// LAYERED-WEAPONS (bible/04-Characters/Layered-Gearing.md): the layered body holds the weapon it uses - drawn by its
// kind and metal along the art's own hammer, the hammer taken out where the hands hold something else or nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  layeredWeaponOf, weaponShownFor, weaponRigOf, WEAPON_SHAPES, BARE_TWINS, ARMED_TWINS, GUN_FIRE_FRAME, isGunCode, removeWeapon,
  maskTile, fillFrom, weaponLen, WEAPON_SPAN, heldPicture, heldBow, heldImage, drawWeapon, chainWay, heldChain, layeredHands, offRigOf,
  SWING_CUTS, swingCutOf, thrustRigOf, artBowPx, dropSpecks, heldPictureExpected, LOOSE_BOW_FROM,
} from '../../../src/player/eyeOfTheBeholder/layeredWeapon.js';
import { worldOrderLayered } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { heldGlowPx, heldGlowRecord, evictHeld, HELD_SUFFIX, OFF_SUFFIX } from '../../../src/player/eyeOfTheBeholder/eotbGlow.js';
import { inventoryItemImage } from '../../../src/systems/item/itemTemplates.js';
import { layeredSprite, outfitPieces, outfitCombo, decodeLayered } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { SPELL_COLOURS } from '../../../src/player/eyeOfTheBeholder/layeredSpell.js';
import { ALL_LOOKS, APPEARANCE_KINDS } from '../../../src/net/appearanceLaw.js';
import { bodyState } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { walkerWeapon, walkerHeld, spriteLookOf } from '../../../src/net/peer/peerRiders.js';
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
  assert.match(layeredSprite('IdleMelee', 2, 0, 1, look('wh0'), false).key, /:17-0:lll@wh0$/, 'AUDIT: its code kept - the art as drawn, its glow round the hammer');
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
  assert.equal(layeredSprite('AttackMelee', 2, 5, 6, look('mc7'), false).frame, 5, 'a mace swings through');   // PIN MOVED (SWING-CUTS): a sword slashes
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
  // the iron warhammer is the art's own hammer: drawn as the art is, its code kept for its glow (AUDIT)
  const iron = layeredSprite('IdleMelee', 2, 0, 1, { outfit: 'lll', gender: 'male', weapon: 'wh0' }, false);
  const ironArt = await decodeLayered(iron.key, decodePng, opts), asDrawn = await decodeLayered(iron.key.replace('@wh0', ''), decodePng, opts);
  assert.deepEqual([...ironArt.data], [...asDrawn.data], 'the art as drawn');
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
  assert.match(bodySrc, /\.\.\.\(isAnimating\?\.hands \?\? layeredHands\(last\)\)/);   // PIN MOVED (LAYERED-DUAL): the hand in use's weapon, or the pair; (AUDIT) a clip's, as it started
  assert.match(bodySrc, /hands: cfg\.wornArmour \? layeredHands\(last\) : null/, 'AUDIT: a clip keeps the hands it started with');
  assert.deepEqual(layeredHands({ heldWeapon: sword }), { weapon: 'sa5' });
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

test('BACK-CARRY: from behind the blade hangs from the fist before the body, edge on; from the side the bow is in the near hand', { skip: !PNG && 'no pngjs' }, async () => {
  // a player (2026-10-31): "drawn claymore is visually not in character's hand" - the back walk hid the blade forward
  const withPic = { ...opts, heldArt: async () => sword({ handle: 24 }) };
  for (const body of ['male', 'female']) for (const rf of ['4-0', '4-1', '4-2', '4-3']) {
    const armed = await decodeLayered(`LA:${body}:leather_leather_leather:${rf}:lll@ls1`, decodePng, withPic);
    const fr = weaponRigOf(body, rf), [gx, gy, ex, ey] = fr.w, D = Math.hypot(ex - gx, ey - gy), nx = -(ey - gy) / D, ny = (ex - gx) / D;
    assert.ok((ey - gy) / D > 0.7, `${body} ${rf}: the line hangs down`);
    let red = 0, above = 0, across = 0, guard = 0;
    for (let i = 0; i < armed.width * armed.height; i++) {
      const [r, g, b] = armed.data.subarray(i * 4, i * 4 + 3), x = (i % armed.width) + 0.5, y = ((i / armed.width) | 0) + 0.5;
      if (r > 200 && g < 60 && b < 60) { red++; if (y < gy - 1) above++; }
      if (g > 200 && r < 60 && b < 60) { guard++; across = Math.max(across, Math.abs((x - gx) * nx + (y - gy) * ny)); }
    }
    assert.ok(red > 10 && above === 0, `${body} ${rf}: the blade below the fist (${red} px, ${above} above)`);
    // edge on: the guard's nine picture px reach 4.5 cm px from the line seen flat - well under that here
    assert.ok(guard > 0 && across <= 4.5 * rig[body].cm * 0.6, `${body} ${rf}: the guard edge on (${across.toFixed(1)} px across)`);
    // and the drawn shape, where no picture is had: its guard's 12 cm reach edge on too
    const shape = await decodeLayered(`LA:${body}:leather_leather_leather:${rf}:lll@ls1`, decodePng, { ...opts, heldArt: async () => null });
    const empty = await decodeLayered(`LA:${body}:leather_leather_leather:${rf}:lll@0`, decodePng, opts);
    let reach = 0;
    for (let i = 0; i < shape.width * shape.height; i++) {
      if ([0, 1, 2, 3].every((c) => shape.data[i * 4 + c] === empty.data[i * 4 + c])) continue;
      reach = Math.max(reach, Math.abs(((i % shape.width) + 0.5 - gx) * nx + (((i / shape.width) | 0) + 0.5 - gy) * ny));
    }
    assert.ok(reach > 0 && reach <= 12 * rig[body].cm * 0.6, `${body} ${rf}: the shape's guard edge on (${reach.toFixed(1)} px)`);
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
  // hanging, lagging the hand's move since the last frame; a swing's flung out along the handle, trailing the raise
  // (AUDIT) and leading from the blow on
  for (const frame of ['2-0', '1-1', '0-0', '15-0', '7-1', '5-1', '6-3']) {
    const flail = await decodeLayered(`LA:male:leather_leather_leather:${frame}:lll@fl1`, decodePng, { ...opts, heldArt: async () => ({ width: W, height: H, colors }) });
    const fr = weaponRigOf('male', frame), [qx, qy, tx, ty] = fr.w ?? [...fr.q, ...fr.t], D = Math.hypot(tx - qx, ty - qy), ux = (tx - qx) / D, uy = (ty - qy) / D;
    const along = rig.male.cm * Math.max(0.14, Math.min(1, D / rig.male.len)), hx = qx + ux * 21 * along, hy = qy + uy * 21 * along;
    const red = [];
    for (let i = 0; i < flail.width * flail.height; i++) {
      if (flail.data[i * 4] > 200 && flail.data[i * 4 + 2] < 60 && flail.data[i * 4 + 1] < 60) red.push([(i % flail.width) + 0.5, ((i / flail.width) | 0) + 0.5]);
    }
    assert.ok(red.length > 3, `${frame}: the chain drawn (${red.length} px)`);
    const [gx, gy] = chainWay(fr.cv, { ux, uy }, Number(frame.split('-')[0]) >= 5 && Number(frame.split('-')[0]) <= 9, Number(frame.split('-')[1]));
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
    assert.ok(bare.held.length === bare.width * bare.height && bare.held.every((v) => v === 0), 'bare hands: no weapon px - no glow, never the whole body (PIN MOVED, AUDIT)');
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

// ── LAYERED-DUAL ───────────────────────────────────────────────────────────────────────────────────────────────────
test('LAYERED-DUAL (2026-10-30, the owner: "We need to find a way to implement duel wielding perfectly"): a pair is both codes, the line\'s first; the art\'s hammer line holds the right weapon, the left\'s once flipped, the striking hand\'s in a swing; sheathed, a bow or empty hands hold no pair', () => {
  assert.deepEqual(outfitPieces('p6cl@ls1+dg3'), { head: 'p6', top: 'c', legs: 'l', cloak: null, shield: null, weapon: 'ls1', offhand: 'dg3', spell: null, stage: null });   // PIN MOVED (LAYERED-SHIELD): a shield and a cast's stage
  assert.equal(outfitPieces('lll@ls1+'), null, 'a pair names its second');
  const look = (o = {}) => ({ outfit: 'lll', gender: 'male', weapon: 'ls1', offhand: 'dg3', ...o });
  const held = (table, o = {}, mirror = false, offset = 2) => layeredSprite(table, offset, 0, 4, look(o), mirror).key.split(':')[4].split('@')[1];
  assert.equal(held('MoveMelee'), 'ls1+dg3', 'the right on the line, the left in the free hand');
  assert.equal(held('MoveMelee', {}, true), 'dg3+ls1', 'flipped: the hands swap, so the left weapon is on the line');
  assert.equal(held('IdleMelee', {}, false, 0), 'ls1+dg3');
  assert.equal(held('AttackMelee', { strike: 'L' }), 'dg3+ls1', 'the left hand\'s blow: its weapon on the line');
  assert.equal(held('AttackMelee', { strike: 'L' }, true), 'dg3+ls1', 'a blow keeps its striker, flipped or not');
  assert.equal(held('AttackMelee', { strike: 'R' }, true), 'ls1+dg3');
  assert.equal(held('Move'), '0', 'sheathed: both hands empty');
  assert.equal(held('MoveMelee', { weapon: null }), '0', 'no weapon of its own: no pair');
  assert.equal(held('MoveRanged', { weapon: 'lb1' }), 'lb1', 'a bow is no pair');
  assert.equal(held('MoveMelee', { offhand: 'nonsense' }), 'ls1', 'a code that is no weapon\'s: one weapon');
  // what the rig and the peers hand on
  const R = weapon(WEAPONS.Longsword, 1), L = weapon(WEAPONS.Dagger, 3);
  assert.deepEqual(layeredHands({ heldWeapon: R, pairRight: R, pairLeft: L, pairStrike: 'L' }), { weapon: 'ls1', offhand: 'dg3', strike: 'L' });
  assert.deepEqual(layeredHands({ heldWeapon: R, pairRight: R, pairLeft: null }), { weapon: 'ls1' }, 'one hand: no pair');
  const st = bodyState({ heldWeapon: L, pairRight: R, pairLeft: L, pairStrike: 'L' });
  assert.deepEqual([st.pairRight, st.pairLeft, st.pairStrike], [R, L, 'L'], 'the body keeps the rig\'s pair');
  const peer = { items: [{ ...R, equipSlot: EQUIP_SLOTS.RightHand }, { ...L, equipSlot: EQUIP_SLOTS.LeftHand }] };
  assert.deepEqual(walkerHeld(peer, { wd: 1, ah: 1 }), { weapon: 'ls1', offhand: 'dg3', strike: 'L', cast: 4 }, 'a walker\'s pair, its last blow the left\'s');
  assert.deepEqual(walkerHeld({ items: [{ ...R, equipSlot: EQUIP_SLOTS.RightHand }] }, { wd: 1, ce: 0 }), { weapon: 'ls1', cast: 0 });
  const rigSrc = readFileSync(new URL('../../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rigSrc, /\.\.\.layeredPair\(\),/);
  assert.match(rigSrc, /pairRight: playerWeapon\.handItem\('R'\), pairLeft: playerWeapon\.handItem\('L'\),/);
  const bodySrc = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');
  assert.match(bodySrc, /pair\.has\(a\) && pair\.has\(b\)/, 'a pair\'s pictures stand while the pair is held, either way round');
});

test('LAYERED-DUAL the second weapon\'s line: in the free hand where the art shows it - mirrored from the front and behind, the blade hidden from behind; none where both fists hold the haft or the body hides the free hand', () => {
  for (const body of ['male', 'female']) for (const rf of Object.keys(rig[body].frames)) {
    const fr = weaponRigOf(body, rf), [gx, gy, ex, ey] = fr.w ?? [...fr.q, ...fr.t], rec = Number(rf.split('-')[0]);
    // PIN MOVED (2026-10-31, the owner: "Fix all the minor issues and the attached innormalities"): fanned off the first
    // fist it read as two blades in one hand, and stuck out past the head - where the art has no free hand, none
    if (rec % 5 === 2 || (rec >= 5 && rec <= 14) || !fr.off) {
      assert.ok(!fr.off && !offRigOf(fr), `${body} ${rf}: no second line where the art has no free hand`);
      continue;
    }
    assert.deepEqual(fr.off.slice(0, 2), fr.bow.slice(0, 2), `${body} ${rf}: in the free hand`);
    const D = Math.hypot(ex - gx, ey - gy), [ox, oy, oex, oey, blade] = fr.off;
    assert.ok(Math.abs(Math.hypot(oex - ox, oey - oy) - D) < 0.3, `${body} ${rf}: as long as the first`);
    const o = offRigOf(fr);
    assert.ok(o.d.length === rig.span[1] - rig.span[0] + 1 && o.d.endsWith(blade), `${body} ${rf}: the blade on its side`);
  }
  // the walk: the free hand (the bow's), from the front mirrored; a swing: the fists together, 22 degrees off
  const front = weaponRigOf('male', '0-0'), [fx, fy] = front.bow;
  assert.deepEqual(front.off.slice(0, 2), [fx, fy]);
  const [ax, ay, bx, by] = front.w, [cx, cy, dx, dy] = front.off;
  assert.ok(Math.sign(dx - cx) === -Math.sign(bx - ax) && Math.abs((dy - cy) - (by - ay)) < 0.2, 'mirrored from the front');
  assert.equal(weaponRigOf('male', '4-0').off[4], 'x', 'from behind the blade is hidden');
  for (const body of ['male', 'female']) {
    const lines = Object.keys(rig[body].frames).filter((rf) => weaponRigOf(body, rf).off).length;
    assert.ok(lines >= 18, `${body}: the free hand's walks and idles (${lines})`);
  }
});

test('LAYERED-DUAL the free hand is open in the art: the second weapon\'s handle and guard pass behind its fingers, never over them', { skip: !PNG && 'no pngjs' }, async () => {
  const withPic = { ...opts, heldArt: async () => sword({ handle: 6 }) };
  for (const [body, rf] of [['male', '0-0'], ['male', '1-1'], ['female', '15-0'], ['female', '3-1']]) {
    const plain = `LA:${body}:leather_leather_leather:${rf}:lll`, [ox, oy] = weaponRigOf(body, rf).off;
    const bare = await decodeLayered(`${plain}@0`, decodePng, opts), two = await decodeLayered(`${plain}@ls1+dg3`, decodePng, withPic);
    let over = 0, guard = 0;
    for (let y = Math.floor(oy) - 5; y <= oy + 5; y++) for (let x = Math.floor(ox) - 5; x <= ox + 5; x++) {
      const i = (y * bare.width + x) * 4, g = two.data[i + 1] > 200 && two.data[i] < 60 && two.data[i + 2] < 60, b = two.data[i + 2] > 200 && two.data[i] < 60;
      if (g) guard++;
      if ((g || b) && bare.data[i + 3]) over++;
    }
    assert.ok(over === 0 && (guard > 0 || rf === '1-1'), `${body} ${rf}: the guard past the fingers (${guard} px), none over the hand (${over})`);   // 1-1: the hand before the body, the guard behind both
  }
});

test('LAYERED-DUAL composed: the second weapon is drawn in the other hand - every px the one weapon drew stays, more are drawn; the glow counts both', { skip: !PNG && 'no pngjs' }, async () => {
  for (const [body, rf] of [['male', '0-0'], ['male', '3-1'], ['female', '1-1'], ['female', '15-0']]) {
    const plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    const one = await decodeLayered(`${plain}@ls1`, decodePng, opts), two = await decodeLayered(`${plain}@ls1+dg3`, decodePng, opts);
    let more = 0, lost = 0;
    for (let i = 0; i < one.width * one.height; i++) {
      if (one.held[i] && !two.held[i]) lost++;
      if (two.held[i] && !one.held[i]) more++;
    }
    assert.ok(more > 4, `${body} ${rf}: the second weapon drew ${more} px`);
    assert.ok(lost <= 2, `${body} ${rf}: the first keeps its px (${lost} lost)`);
  }
  // a swing's fists both hold the first, and aside the body hides the free hand: the second is not drawn
  for (const [body, rf] of [['male', '7-3'], ['female', '5-2'], ['male', '2-1'], ['female', '17-0']]) {
    const plain = `LA:${body}:leather_leather_leather:${rf}:lll`;
    const one = await decodeLayered(`${plain}@ls1`, decodePng, opts), two = await decodeLayered(`${plain}@ls1+dg3`, decodePng, opts);
    assert.deepEqual([...two.data], [...one.data], `${body} ${rf}: one blade, in the hand the art draws`);
  }
});

// ── SWING-CUTS ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('SWING-CUTS (2026-10-30, the owner: "Is there anyway to switch up the animation?"): each weapon plays its own cut of the one swing - a short blade\'s and a fist\'s thrust, a long blade\'s slash, the rest the full chop; a gun\'s shot and the cast are their own', () => {
  const frames = (w, view = 2, o = {}) => [0, 1, 2, 3, 4, 5].map((f) => layeredSprite('AttackMelee', view, f, 6, { outfit: 'lll', gender: 'male', weapon: w, ...o }, false).frame);
  assert.deepEqual(frames('dg3'), SWING_CUTS.thrust, 'a dagger thrusts: the chest, the arms out held, back');
  assert.deepEqual(frames(null), SWING_CUTS.thrust, 'a bare fist jabs');
  assert.deepEqual(frames('ls3'), SWING_CUTS.slash, 'a longsword slashes from the chest');
  for (const w of ['mc3', 'ba3', 'sf3', 'cm3', 'fl3']) assert.deepEqual(frames(w), SWING_CUTS.chop, `${w}: the full chop`);
  assert.deepEqual(new Set(Object.values(SWING_CUTS).flat()), new Set([0, 1, 2, 3, 4, 5]), 'every cut is the art\'s own frames');
  assert.ok(SWING_CUTS.thrust.includes(2) && SWING_CUTS.slash.includes(2) && SWING_CUTS.chop.includes(2), 'every cut strikes');
  assert.deepEqual(swingCutOf('ls3', true), [...SWING_CUTS.slash].reverse(), 'backhand: the cut run the other way');
  assert.ok(frames('tl0').every((f) => f === GUN_FIRE_FRAME), 'a gun fires from the hip');
  assert.deepEqual([0, 1, 2, 3].map((f) => layeredSprite('AttackSpell', 2, f, 4, { outfit: 'lll', gender: 'male', weapon: 'dg3' }, false).frame), [0, 1, 2, 3], 'the cast: the swing\'s first frames');
});

test('SWING-CUTS a pair\'s blows alternate: the left hand\'s, from the front or behind, is the right\'s turned over (the picture flipped); from aside its cut runs backwards - a rising backhand', () => {
  const pair = { outfit: 'lll', gender: 'male', weapon: 'ls3', offhand: 'dg3' };
  const blow = (view, strike, mirror = false) => [0, 1, 2, 3, 4, 5].map((f) => layeredSprite('AttackMelee', view, f, 6, { ...pair, strike }, mirror));
  for (const view of [0, 4]) {
    const right = blow(view, 'R'), left = blow(view, 'L');
    assert.ok(right.every((s) => !s.mirror) && left.every((s) => s.mirror), `view ${view}: the left hand's blow flipped`);
    assert.deepEqual(left.map((s) => s.frame), SWING_CUTS.thrust, `view ${view}: the left's own weapon's cut, forwards`);
    assert.ok(left.every((s) => s.key.includes('@dg3+ls3')), 'its weapon on the line');
  }
  for (const view of [1, 2, 3]) {
    assert.deepEqual(blow(view, 'L').map((s) => s.frame), [...SWING_CUTS.thrust].reverse(), `view ${view}: the left's cut backwards`);
    assert.deepEqual(blow(view, 'R').map((s) => s.frame), SWING_CUTS.slash, `view ${view}: the right's forwards`);
    assert.ok(blow(view, 'L', true).every((s) => s.mirror), `view ${view}: the wheel's own flip stands`);
  }
  assert.deepEqual(blow(0, 'L').map((s) => s.frame), blow(0, 'L', true).map((s) => s.frame), 'one blow, whichever way the wheel stood');
  const one = { outfit: 'lll', gender: 'male', weapon: 'ls3', strike: 'L' };
  assert.ok([0, 1, 2, 3, 4, 5].every((f) => !layeredSprite('AttackMelee', 0, f, 6, one, false).mirror), 'no pair: no left blow');
});

test('SWING-CUTS a thrust\'s strike points the blade the way the body faces, along the arms: from aside the whole blade forward, from behind hidden past the fists; no second blade', { skip: !PNG && 'no pngjs' }, async () => {
  const withPic = { ...opts, heldArt: async () => sword() };
  const reds = (img) => { const r = []; for (let i = 0; i < img.width * img.height; i++) if (img.data[i * 4] > 200 && img.data[i * 4 + 1] < 60 && img.data[i * 4 + 2] < 60) r.push([i % img.width, (i / img.width) | 0]); return r; };
  for (const body of ['male', 'female']) {
    const fr = weaponRigOf(body, '7-2'), [gx, gy] = fr.w ?? fr.q;
    const side = reds(await decodeLayered(`LA:${body}:leather_leather_leather:7-2:lll@dg1`, decodePng, withPic));
    const ys = side.map((p) => p[1]);
    assert.ok(side.length > 10 && side.every(([x]) => x < gx) && Math.max(...ys) - Math.min(...ys) <= 6 && Math.abs(side.reduce((t, p) => t + p[1], 0) / side.length - gy) <= 5,
      `${body}: from aside the blade runs forward, level with the fists (${side.length} px)`);
    assert.equal(reds(await decodeLayered(`LA:${body}:leather_leather_leather:9-2:lll@dg1`, decodePng, withPic)).length, 0, `${body}: from behind the blade is hidden`);
    const chop = reds(await decodeLayered(`LA:${body}:leather_leather_leather:7-2:lll@mc1`, decodePng, withPic));
    assert.notDeepEqual(chop, side, `${body}: a mace keeps the chop's line`);
  }
  const t = thrustRigOf(weaponRigOf('male', '7-2'), 'dg1', 2, 2, rig.male.len);
  assert.equal(t.off, undefined, 'PIN MOVED (2026-10-31): no second blade - both fists hold the first');
  assert.equal(thrustRigOf(weaponRigOf('male', '7-3'), 'dg1', 2, 3, rig.male.len), null, 'only the strike');
  assert.equal(thrustRigOf(weaponRigOf('male', '7-2'), 'ls1', 2, 2, rig.male.len), null, 'only a thrust');
});

// ── SPELL-BURST ────────────────────────────────────────────────────────────────────────────────────────────────────
test('SPELL-BURST (2026-10-30, the owner, of a concept sheet\'s "Wrath of Sithis": "Do both. I wanna see what you can cook"): a cast carries its element; the spell is drawn in its hands - an orb at the fists, swelling with veins, a burst thrown ahead, specks after - in the element\'s colours; a weapon beside the spell stays in hand', { skip: !PNG && 'no pngjs' }, async () => {
  assert.equal(outfitPieces('lll@0!3').spell, 3);
  assert.equal(outfitPieces('lll@0!5'), null, 'five elements, 0-4');
  const look = (o = {}) => ({ outfit: 'lll', gender: 'male', cast: 0, ...o });
  const key = (o, table = 'AttackSpell', f = 1) => layeredSprite(table, 2, f, 4, look(o), false).key.split(':')[4];
  assert.equal(key({}), 'lll@0!0', 'the cast: hands empty, the fire in them');
  assert.equal(key({ weapon: 'dg3' }), 'lll@0!0', 'a weapon sheathed beside the cast: not in hand');
  assert.equal(key({ weapon: 'dg3', spellHand: true }), 'lll@dg3!0', 'the spell hand: the weapon stays');
  assert.equal(key({ cast: undefined }), 'lll@0', 'no element named: no spell drawn');
  assert.equal(key({ cast: 1.5 }), 'lll@0', 'nor one that is no element');
  assert.equal(key({}, 'AttackMelee'), 'lll@0', 'a blow carries none');
  assert.deepEqual(layeredHands({ heldWeapon: null, castElement: 1, spellHand: false }), { weapon: null, cast: 1 });
  // drawn: each stage's spell in its element's colours, at the fists then thrown ahead along the throw's line
  const px = (img, bare) => { const o = []; for (let i = 0; i < img.width * img.height; i++) if ([0, 1, 2, 3].some((c) => img.data[i * 4 + c] !== bare.data[i * 4 + c])) o.push([i % img.width, (i / img.width) | 0, [...img.data.subarray(i * 4, i * 4 + 3)]]); return o; };
  const bare = async (rf) => decodeLayered(`LA:male:leather_leather_leather:${rf}:lll@0`, decodePng, opts);
  const counts = [];
  for (const f of [0, 1, 2, 3]) {
    const rf = `7-${f}`, drawn = px(await decodeLayered(`LA:male:leather_leather_leather:${rf}:lll@0!0`, decodePng, opts), await bare(rf));
    counts.push(drawn.length);
    const fr = weaponRigOf('male', rf), [gx, gy] = fr.w ?? fr.q, cx = drawn.reduce((t, p) => t + p[0], 0) / drawn.length, cy = drawn.reduce((t, p) => t + p[1], 0) / drawn.length;
    if (f < 2) assert.ok(Math.hypot(cx - gx, cy - gy) < 8, `frame ${f}: at the fists (${cx.toFixed(1)}, ${cy.toFixed(1)} vs ${gx}, ${gy})`);
    else assert.ok(cx < gx - 4, `frame ${f}: thrown ahead (${cx.toFixed(1)} past the fists at ${gx})`);
    assert.ok(drawn.some(([, , c]) => c.join() === SPELL_COLOURS[0].body.join()), `frame ${f}: fire's own red`);
  }
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2] && counts[3] < counts[2] / 3, `it gathers, bursts, scatters to specks: ${counts}`);
  for (const e of [1, 2, 3, 4]) {
    const drawn = px(await decodeLayered(`LA:male:leather_leather_leather:7-2:lll@0!${e}`, decodePng, opts), await bare('7-2'));
    assert.ok(drawn.some(([, , c]) => c.join() === SPELL_COLOURS[e].body.join()), `element ${e}: its own colour`);
  }
  // thrown from behind it flies away from the eye: past the body only, flying on until most of it clears the body
  for (const rf of ['8-2', '8-3', '9-2', '9-3']) {
    const backBare = await bare(rf), back = px(await decodeLayered(`LA:male:leather_leather_leather:${rf}:lll@0!0`, decodePng, opts), backBare);
    assert.ok(back.every(([x, y]) => !backBare.data[(y * backBare.width + x) * 4 + 3]), `${rf}: past the body only`);
    assert.ok(back.length > (rf.endsWith('2') ? 120 : 40), `${rf}: seen, not lost behind the back (${back.length} px)`);
  }
  // the weapon's glow is the weapon's: the spell is not in its px
  const withDagger = await decodeLayered('LA:male:leather_leather_leather:7-2:lll@dg3!0', decodePng, opts), noSpell = await decodeLayered('LA:male:leather_leather_leather:7-2:lll@dg3', decodePng, opts);
  assert.deepEqual([...withDagger.held], [...noSpell.held], 'the held px the dagger\'s alone');
  const rigSrc = readFileSync(new URL('../../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rigSrc, /castElement: castPlaying\(\) \? cast\.element : null, spellHand: !!spellHandNow\(\)/);
});

// ── AUDIT (2026-10-31, the owner: "Lets do a comprehensive audit on everything and ensure all placements are absolutely
// perfect along with functionality") ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT the hands: a spell hand keeps its weapon readied too; a shot is the striking hand\'s gun; a flinch at the loose keeps the bow; a left blow turns over from as it stands; a clip keeps the hands it started with', () => {
  const L = (o) => ({ outfit: 'lll', gender: 'male', ...o });
  const code = (t, off, f, n, o, m = false) => layeredSprite(t, off, f, n, L(o), m).key.split(':').slice(3).join(':');
  for (const t of ['IdleSpell', 'MoveSpell']) {
    assert.equal(weaponShownFor(t, 'ls7', true), 'ls7', `${t}: the weapon beside the readied spell`);
    assert.equal(weaponShownFor(t, 'ls7', false), '0', `${t}: a readied spell alone, hands empty`);
    assert.equal(weaponShownFor(t, 'lb3', true), '0', `${t}: never a bow`);
  }
  // a gun in the right, a blade in the left that strikes: the blade's cut (a slash run backwards), never the shot
  const blade = [0, 1, 2, 3, 4, 5].map((f) => code('AttackMelee', 2, f, 6, { weapon: 'pt0', offhand: 'ls7', strike: 'L' }));
  assert.deepEqual(blade.map((k) => k.split(':')[0]), [...SWING_CUTS.slash].reverse().map((f) => `7-${f}`));
  assert.ok(blade.every((k) => k.endsWith('@ls7+pt0')), 'the blade on the line');
  // a blade in the right, a gun in the left that fires: the shot, the gun on the line
  const shot = [0, 1, 2, 3, 4, 5].map((f) => code('AttackMelee', 2, f, 6, { weapon: 'ls7', offhand: 'pt0', strike: 'L' }));
  assert.ok(shot.every((k) => k === `7-${GUN_FIRE_FRAME}:lll@pt0+ls7`), `the shot: ${shot}`);
  // a flinch while loosing: the bow as the ranged stance holds it - never the art's hammer
  assert.match(code('Death', 2, 0, 1, { weapon: 'lb3', armedTable: 'AttackRanged' }), /@lb3$/);
  // the iron warhammer: its own frames, never an armed twin's (the art's 0-2 holds its own hammer)
  assert.equal(code('MoveMelee', 0, 2, 4, { weapon: 'wh0' }), '0-2:lll@wh0');
  // a left blow from the front is the right's turned over - from as the picture stands (a visible first-person body's)
  const s0 = layeredSprite('AttackMelee', 0, 2, 6, L({ weapon: 'ls7', offhand: 'dg3', strike: 'L' }), false);
  const s1 = layeredSprite('AttackMelee', 0, 2, 6, L({ weapon: 'ls7', offhand: 'dg3', strike: 'L' }), true);
  assert.equal(s0.mirror, true); assert.equal(s1.mirror, false);
  assert.equal(s0.pair, 'L', 'the left\'s weapon on the line');
  assert.equal(layeredSprite('MoveMelee', 1, 0, 4, L({ weapon: 'ls7', offhand: 'dg3' }), false).pair, 'R');
  assert.equal(layeredSprite('MoveMelee', 1, 0, 4, L({ weapon: 'ls7' }), false).pair, null);
  // the hands as a clip starts, for all of it - mine and a walker's
  const peerSrc = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(peerSrc, /i: 0, hands: lgBody \? walkerHeld\(peer\.look, pose\) : null \}/, 'a worn-armour walker\'s alone');
  assert.match(peerSrc, /\.\.\.\(r\.shot\?\.hands \?\? walkerHeld\(peer\.look, pose\)\)/);
  // a walker's cast is the same look as its stance: its pictures go together
  assert.equal(spriteLookOf({ key: 'LA:male:c:7-2:lll@0!3' }), spriteLookOf({ key: 'LA:male:c:2-0:lll@0' }));
});

test('AUDIT the glow: none in empty hands, round the loose\'s own bow, round the iron warhammer; a pair\'s two weapons each in their own hand\'s colours; the art\'s own speck gone', { skip: !PNG && 'no pngjs' }, async () => {
  // the loose's own bow: its limbs and string, the thin px in pieces - a lone thin corner is not
  const W = 30, H = 30, img = { width: W, height: H, data: new Uint8Array(W * H * 4) }, on = (x, y) => img.data.set([90, 60, 30, 255], (y * W + x) * 4);
  for (let y = 2; y < 14; y++) on(3, y);   // a limb, a px wide
  for (let y = 10; y < 26; y++) for (let x = 12; x < 24; x++) on(x, y);   // the body
  on(27, 2); on(28, 2);   // a corner's two px
  const bow = artBowPx(img);
  for (let y = 2; y < 14; y++) assert.equal(bow[y * W + 3], 1, `the limb at ${y}`);
  assert.equal(bow[2 * W + 27] + bow[2 * W + 28], 0, 'a piece of two: no bow');
  assert.equal(bow[18 * W + 18], 0, 'the body: no bow');
  // the art's own speck in the air goes where the code holds the hands (female 9-2's, at 121,44)
  const speck = await picture('female/leather_leather_leather/9-2');
  assert.equal(speck.data[(44 * speck.width + 121) * 4 + 3], 255, 'the art has it');
  for (const code of ['lll@0', 'lll@ls1']) {
    const f = await decodeLayered(`LA:female:leather_leather_leather:9-2:${code}`, decodePng, opts);
    assert.equal(f.data[(44 * f.width + 121) * 4 + 3], 0, `${code}: the speck gone`);
  }
  const loose = await decodeLayered('LA:male:leather_leather_leather:22-1:lll', decodePng, opts);
  const n = loose.held.reduce((t, v) => t + v, 0);
  assert.ok(n > 30, `the loose's bow: ${n} px`);
  // a pair's second weapon's px are 2: its glow is its own hand's
  const pair = await decodeLayered('LA:male:leather_leather_leather:1-1:lll@ls1+dg3', decodePng, opts);
  const one = await decodeLayered('LA:male:leather_leather_leather:1-1:lll@ls1', decodePng, opts);
  let off = 0;
  for (let i = 0; i < pair.held.length; i++) {
    if (pair.held[i] !== 2) continue;
    off++;
    assert.ok([0, 1, 2, 3].some((c) => pair.data[i * 4 + c] !== one.data[i * 4 + c]), 'a 2 is the second weapon\'s');
  }
  assert.ok(off > 5 && pair.held.some((v) => v === 1), `both weapons: ${off} px the second's`);
  const w = pair.width, h = pair.height, colors = new Uint32Array(w * h).fill(7);
  const main = heldGlowPx(colors, pair.held, w, h), second = heldGlowPx(colors, pair.held, w, h, false, 2);
  assert.equal(second.idx.length, off);
  assert.equal(main.idx.length + second.idx.length, pair.held.filter((v) => v > 0).length);
  const up = new Map(), renderer = { textures: up, uploadTexture: (a, r) => up.set(`${a}_${r}`, 1), evictTexture: (k) => up.delete(k) };
  assert.equal(heldGlowRecord(renderer, 9, 'x', main, w, h), `x${HELD_SUFFIX}`);
  assert.equal(heldGlowRecord(renderer, 9, 'x', second, w, h, OFF_SUFFIX), `x${OFF_SUFFIX}`);
  evictHeld(renderer, '9_x');
  assert.equal(up.size, 0, 'both go with the sprite');
  // the body and the walkers glow each weapon by its own hand's item
  const bodySrc = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');
  assert.match(bodySrc, /const lineItem = batchPair === 'L' \? last\.pairLeft : batchPair === 'R' \? last\.pairRight : handItemNow\(\);/);
  assert.match(bodySrc, /glowNow\(batchPair === 'L' \? last\.pairRight : last\.pairLeft\)/);
  const peerSrc = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(peerSrc, /peerWeaponGlow\(h \? \(r\.pair === 'L' \? h\.left : h\.right\)/);
  assert.match(peerSrc, /peerWeaponGlow\(r\.pair === 'L' \? h\.right : h\.left, null\)/);
});

test('AUDIT the pictures: a notch in the haft past the hand is filled (a war axe\'s head, a flail\'s cap); a px alone in the air is a speck; a flail\'s ball leads from the blow on', () => {
  // a haft along row 10: the hand's gap (x 10-15), a 3-px notch (x 30-32) short of the head, the head a block
  const W = 50, H = 21, colors = new Uint8Array(W * H * 4), put = (x, y) => colors.set([...BLUE, 255], (y * W + x) * 4);
  for (let x = 2; x < 40; x++) if ((x < 10 || x > 15) && (x < 30 || x > 32)) put(x, 10);
  for (let y = 4; y < 17; y++) for (let x = 40; x < 48; x++) put(x, y);
  const P = heldPicture({ width: W, height: H, colors });
  for (let x = 30; x <= 32; x++) assert.ok(P.img.colors[(10 * W + x) * 4 + 3] > 127, `the notch filled at ${x}`);
  for (let x = 11; x <= 14; x++) assert.equal(P.img.colors[(10 * W + x) * 4 + 3], 0, `the hand's gap left at ${x}`);
  // a speck: drawn alone in the air goes; beside the picture or the body stays
  const w = 8, out = { width: w, height: 8, data: new Uint8Array(w * 8 * 4) }, was = out.data.slice();
  out.data.set([1, 2, 3, 255], (1 * w + 1) * 4);   // alone
  out.data.set([1, 2, 3, 255], (5 * w + 5) * 4); out.data.set([1, 2, 3, 255], (5 * w + 6) * 4);   // a pair
  was.set([9, 9, 9, 255], (2 * w + 6) * 4); out.data.set([9, 9, 9, 255], (2 * w + 6) * 4); out.data.set([1, 2, 3, 255], (2 * w + 5) * 4);   // beside the body
  dropSpecks(out, was);
  assert.equal(out.data[(1 * w + 1) * 4 + 3], 0, 'the speck goes');
  assert.equal(out.data[(5 * w + 5) * 4 + 3], 255); assert.equal(out.data[(2 * w + 5) * 4 + 3], 255);
  // the ball: out along the handle at the strike (foreshortened as it is), carried on through, hanging as the arms come back
  const Lh = { ux: -1, uy: 0 };
  const [x2, y2, a2] = chainWay([-10, 10], Lh, true, 2);
  assert.ok(x2 < -0.8 && y2 > 0 && a2 === 1, `the strike: along the handle (${x2.toFixed(2)}, ${y2.toFixed(2)})`);
  const [x3, y3] = chainWay([0, 10], Lh, true, 3);
  assert.ok(y3 > 0.8, `through: on with the blow, falling (${x3.toFixed(2)}, ${y3.toFixed(2)})`);
  const [x4, y4] = chainWay([10, -10], Lh, true, 4);
  assert.ok(y4 > 0.9 && x4 > 0, `back: hanging, a little ahead (${x4.toFixed(2)}, ${y4.toFixed(2)})`);
  const [x1, y1] = chainWay([0, -10], { ux: 0, uy: -1 }, true, 1);
  assert.ok(y1 > 0.3 && Math.abs(x1) < 0.1, `the raise: trailing (${x1.toFixed(2)}, ${y1.toFixed(2)})`);
});

// ── THE SHEETS (2026-10-31, the owner: "Fix all the minor issues and the attached innormalities") ─────────────────
test('SHEETS the art\'s own: the back-3/4 walk\'s metal tip at the free wrist goes with the hammer; the female\'s leather chest ghosts the loose\'s bow, which comes from the chain chest\'s render', { skip: !PNG && 'no pngjs' }, async () => {
  for (const [body, rf, x, y] of [['male', '3-0', 10, 51], ['female', '3-1', 53, 78]]) {
    const art = await picture(`${body}/leather_leather_leather/${rf}`);
    assert.equal(art.data[(y * art.width + x) * 4 + 3], 255, `${body} ${rf}: the art has it`);
    for (const code of ['lll@0', 'lll@ls1']) {
      const f = await decodeLayered(`LA:${body}:leather_leather_leather:${rf}:${code}`, decodePng, opts);
      assert.equal(f.data[(y * f.width + x) * 4 + 3], 0, `${body} ${rf} ${code}: the tip gone`);
    }
  }
  // the loose: a leather chest's bow, in open air, is the chain chest's px for px
  assert.deepEqual(LOOSE_BOW_FROM, { female: { leather: 'chain' } });
  for (const [combo, code, clean, cleanCode] of [['leather_leather_leather', 'lll', 'leather_chain_leather', 'lcl'], ['plate_leather_plate', 'p0lp0', 'plate_chain_plate', 'p0cp0']]) {
    for (const rf of ['21-2', '22-0', '22-2']) {
      const mine = await decodeLayered(`LA:female:${combo}:${rf}:${code}`, decodePng, opts), ref = await decodeLayered(`LA:female:${clean}:${rf}:${cleanCode}`, decodePng, opts);
      const w = mine.width, on = (img, X, Y) => X >= 0 && Y >= 0 && X < w && Y < img.height && img.data[(Y * w + X) * 4 + 3] > 0;
      let air = 0, differ = 0;
      for (let y = 0; y < mine.height; y++) for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (on(ref, x + dx, y + dy)) n++;
        if (n > 20 || (!on(ref, x, y) && !on(mine, x, y))) continue;
        air++;
        if (on(ref, x, y) !== on(mine, x, y)) differ++;
      }
      assert.ok(air > 20 && differ === 0, `${combo} ${rf}: the bow as the chain chest draws it (${differ} of ${air})`);
    }
  }
  const raw = await picture('female/leather_leather_leather/21-2'), cleanRaw = await picture('female/leather_chain_leather/21-2');
  let ghost = 0;
  for (let i = 0; i < raw.width * raw.height; i++) if (raw.data[i * 4 + 3] && !cleanRaw.data[i * 4 + 3]) ghost++;
  assert.ok(ghost > 20, `the art ghosts it (${ghost} px)`);
});

test('SHEETS a flinch holds the bow in the hammer\'s fist; a frame drawn before its picture came is decoded again; a gathering act\'s tool is in my own body\'s hands; a cast\'s frames stand with their hands', { skip: !PNG && 'no pngjs' }, async () => {
  for (const body of ['male', 'female']) for (let rec = 10; rec <= 14; rec++) {
    const fr = weaponRigOf(body, `${rec}-0`), [gx, gy] = fr.w ?? fr.q;
    assert.ok(Array.isArray(fr.bow) && fr.bow[3] === -1 && Math.hypot(fr.bow[0] - gx, fr.bow[1] - gy) <= 2.5, `${body} ${rec}-0: the bow at the hammer's fist`);
    assert.deepEqual(fr.bowM, fr.bow, `${body} ${rec}-0: flipped too`);
  }
  const bow = await decodeLayered('LA:male:leather_leather_leather:12-0:lll@lb3', decodePng, opts), none = await decodeLayered('LA:male:leather_leather_leather:12-0:lll@0', decodePng, opts);
  let drawn = 0;
  for (let i = 0; i < bow.data.length; i += 4) if (bow.data[i + 3] !== none.data[i + 3] || bow.data[i] !== none.data[i]) drawn++;
  assert.ok(drawn > 20, `the flinch's bow drawn (${drawn} px)`);
  // provisional: a pictured weapon whose picture is not had yet; none for one that has no picture to wait for
  assert.equal(heldPictureExpected('ls1', 'male'), true);
  assert.equal(heldPictureExpected('wh0', 'male'), false, 'the iron warhammer is the art');
  assert.equal(heldPictureExpected('pt0', 'male'), false, 'a gun keeps its drawn shape');
  const late = await decodeLayered('LA:male:leather_leather_leather:2-1:lll@ls1', decodePng, { ...opts, heldArt: async () => null });
  assert.equal(late.provisional, true, 'drawn before its picture came');
  assert.equal(worldOrderLayered(late).provisional, true, 'the store sees it');
  const had = await decodeLayered('LA:male:leather_leather_leather:2-1:lll@ls1', decodePng, { ...opts, heldArt: async () => sword() });
  assert.equal(had.provisional, undefined);
  assert.equal((await decodeLayered('LA:male:leather_leather_leather:2-1:lll@wh0', decodePng, { ...opts, heldArt: async () => null })).provisional, undefined);
  const bodySrc = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');
  const peerSrc = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  for (const src of [bodySrc, peerSrc]) {
    assert.match(src, /\.\.\.\((img|raw)\.provisional \? \{ retryAt: clock\(\) \+ PICTURE_RETRY_MS \} : \{\}\)/);
    assert.match(src, /have\.retryAt != null && clock\(\) >= have\.retryAt\)/);
  }
  // the tool: the rig hands it over, held ready, a blow a stroke; the weapon sheathed stays on the back
  const rigSrc = readFileSync(new URL('../../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rigSrc, /return tool \? \{ heldWeapon: tool, toolInHand: true, usingBow: false, spellcasting: false, attacking: strike, swingN: -\(2 \* toolBlows \+ 1\)/);
  assert.match(rigSrc, /layeredTool: layeredTool\(\),/, 'its own field: the rig\'s state as it is');
  const tool = { heldWeapon: { group: 'Weapons', templateIndex: 126, material: 0 }, toolInHand: true };
  assert.deepEqual(bodyState({ layeredTool: tool }).layeredTool, tool);
  assert.equal(bodyState({ layeredTool: tool }).toolInHand, false, 'not until the layered body takes it');
  // only the layered body takes it (2026-10-31, the owner: "revert any work done for the skin system ... This is only for layered")
  assert.match(bodySrc, /if \(cfg\.wornArmour && last\.layeredTool\) last = \{ \.\.\.last, \.\.\.last\.layeredTool \};/);
  assert.match(bodySrc, /chooseTable\(\{ \.\.\.last, sheathed: last\.sheathed && !last\.toolInHand,/);
  assert.match(bodySrc, /const drawn = grow === 1 && !FP && !last\.sheathed && !last\.toolInHand &&/, 'no weapon glow on the tool');
  // a cast's frames are the outfit's with its hands: kept when another outfit goes
  assert.match(bodySrc, /held = cast\?\.replace\(\/!\\d\\d\?\$\/, ''\)/);   // PIN MOVED (LAYERED-SHIELD): and a cast's stage
});

test('IRON-LEFT (the owner, 2026-10-31: "this glob of texture where the hammer was removed"): the back views leave none of the hammer\'s dark iron', { skip: !PNG && 'no pngjs' }, async () => {
  // where the iron was, a px each outfit draws alike (the hammer's - the legs behind differ) is never left as the art drew it
  const skin = (r, g, b) => r > 110 && r > g && g > b && r - b > 40;
  for (const [body, rf, [x0, y0, x1, y1]] of [['male', '4-0', [41, 56, 49, 65]], ['male', '4-2', [68, 55, 73, 62]], ['male', '3-2', [50, 57, 55, 60]],
    ['male', '19-0', [38, 40, 45, 43]], ['female', '19-0', [72, 79, 77, 84]]]) {
    const a = await decodeLayered(`LA:${body}:leather_chain_leather:${rf}:lcl`, decodePng, opts), b = await decodeLayered(`LA:${body}:leather_chain_plate:${rf}:lcp1`, decodePng, opts);
    const empty = await decodeLayered(`LA:${body}:leather_chain_leather:${rf}:lcl@0`, decodePng, opts);
    let left = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * a.width + x) * 4, px = [...a.data.subarray(i, i + 4)];
      if (!px[3] || skin(px[0], px[1], px[2]) || !px.every((v, c) => v === b.data[i + c])) continue;
      if (px.every((v, c) => v === empty.data[i + c])) left++;
    }
    assert.equal(left, 0, `${body} ${rf}: the hammer's iron left (${left} px)`);
  }
});
