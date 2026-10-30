// LAYERED-WEAPONS (bible/04-Characters/Layered-Gearing.md): the layered body holds the weapon it uses - drawn by its
// kind and metal along the art's own hammer, the hammer taken out where the hands hold something else or nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  layeredWeaponOf, weaponShownFor, weaponRigOf, WEAPON_SHAPES, BARE_TWINS, removeWeapon, maskTile, weaponLen, WEAPON_SPAN,
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

test('empty-handed, the female front walk\'s hidden-arm frame is its mirror twin; armed, it is itself', () => {
  assert.deepEqual({ ...BARE_TWINS.female }, { '0-2': '0-0' });
  const bare = layeredSprite('Move', 0, 2, 4, { outfit: 'lll', gender: 'female', weapon: null }, false);
  assert.deepEqual([bare.record, bare.frame, bare.mirror], [0, 0, true]);
  assert.match(bare.rec, /_0-0m$/);
  const armed = layeredSprite('MoveMelee', 0, 1, 2, { outfit: 'lll', gender: 'female', weapon: 'ls1' }, false);
  assert.deepEqual([armed.record, armed.frame, armed.mirror], [0, 2, false]);
  const male = layeredSprite('Move', 0, 2, 4, { outfit: 'lll', gender: 'male', weapon: null }, false);
  assert.deepEqual([male.record, male.frame, male.mirror], [0, 2, false]);
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
