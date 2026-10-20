// WORN-ARMOUR (player/eyeOfTheBeholder/layeredArmor.js): the on-foot body drawn in the helmet, chest and legs armour it wears - the
// slot -> family / metal reading (own equip table and a peer's look items alike), every outfit's art on disk for both
// bodies, the strip composition, and the one door every sprite reader takes (eotbSprite.js spriteFor / eotbSpriteUrl).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  pieceCode, outfitOfSlots, outfitOfItems, OUTFIT_SLOTS, layeredSprite, composeStrip, isLayeredKey, LAYERED_ARCHIVE,
  CLOAK_SLOTS, cloakOfSlots, outfitPieces, dyeCloth, applyHoodFix, decodeLayered, layeredGenderOf, layeredPreviewUrl, LAYERED_OWN,
} from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { MOD_CURATED } from '../../../src/systems/features.js';
import { composeLook, ownLayeredGear } from '../../../src/net/remotePlayers.js';
import { validLook } from '../../../src/net/wire.js';
import { skinCard, skinSets } from '../../../src/ui/skinCard.js';
import { EQUIP_SLOTS } from '../../../src/characters/paperdoll/paperdoll.js';
import { DYE_COLORS } from '../../../src/characters/dyes.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { spriteFor, eotbSpriteUrl } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { frameCount } from '../../../src/player/eyeOfTheBeholder/eotbBillboard.js';

const M = ARMOR_MATERIAL;
const strip = (key) => { const [, body, combo, rf] = key.split(':'); return new URL(`../../../vendor/layered-armor/${body}/${combo}/${rf}.png`, import.meta.url); };

test('the three slots are the paperdoll\'s, and a piece reads its family and metal', () => {
  assert.deepEqual(OUTFIT_SLOTS, { head: EQUIP_SLOTS.Head, top: EQUIP_SLOTS.ChestArmor, legs: EQUIP_SLOTS.LegsArmor });
  assert.equal(pieceCode(null), 'l');                                   // nothing worn: the plain leather body
  assert.equal(pieceCode({ material: M.Leather }), 'l');
  assert.equal(pieceCode({ material: M.Chain }), 'c');
  assert.equal(pieceCode({ material: M.Chain2 }), 'c');
  assert.equal(pieceCode({ material: M.Iron }), 'p0');
  assert.equal(pieceCode({ material: M.Daedric }), 'p6');
  for (const m of [M.Silver, M.Elven, M.Dwarven]) assert.equal(pieceCode({ material: m }), 'p1');   // no art: steel
  const slots = []; slots[EQUIP_SLOTS.Head] = { material: M.Ebony }; slots[EQUIP_SLOTS.LegsArmor] = { material: M.Chain };
  slots[EQUIP_SLOTS.Gloves] = { material: M.Daedric };                  // gloves never change the picture
  assert.equal(outfitOfSlots(slots), 'p4lc');
  // a peer's look items (net/wire.js validLookItem) read the same
  assert.equal(outfitOfItems([{ equipSlot: EQUIP_SLOTS.ChestArmor, material: M.Orcish, group: 'Armor' }]), 'lp5l');
});

test('every outfit, table, view and frame has its strip, for both bodies', () => {
  const outfits = ['lll', 'ccc', 'p0p0p0', 'lcp6', 'p3lc', 'cp1l', 'llc', 'p2cc'];
  for (const gender of ['male', 'female']) {
    for (const outfit of outfits) {
      for (const table of ['Idle', 'Move', 'AttackMelee', 'AttackRanged', 'AttackSpell', 'Death']) {
        for (let o = 0; o < 5; o++) {   // the wheel's five record offsets (front .. back; the rest are mirrors)
          for (let f = 0; f < frameCount(table); f++) {
            const s = layeredSprite(table, o, f, frameCount(table), { gender, outfit }, false);
            assert.ok(s, `${gender} ${outfit} ${table}`);
            assert.equal(s.archive, LAYERED_ARCHIVE[gender]);
            assert.ok(existsSync(strip(s.key)), s.key);
          }
        }
      }
    }
  }
});

test('the option routes spriteFor to the worn armour, and leaves it alone when off or mounted', () => {
  const look = { onFoot: 3, wornArmour: true, outfit: 'p6cl', gender: 'female' };
  const s = spriteFor('AttackMelee', 2, 3, look);
  assert.equal(s.key, 'LA:female:plate_chain_leather:7-3:p6cl');
  assert.ok(isLayeredKey(s.key) && eotbSpriteUrl(s.key) === s.key);   // the decoders compose it (decodeLayered)
  assert.ok(!isLayeredKey(spriteFor('AttackMelee', 2, 3, { ...look, wornArmour: false }).key));
  assert.ok(!isLayeredKey(spriteFor('IdleHorse', 0, 0, { onHorse: 0, wornArmour: true, outfit: 'p6cl' }).key));
  // LAYERED-GEAR: mounted or turned beast, the rider's and the lycanthrope's own skins - the layered gear is on foot only
  for (const table of ['IdleLycan', 'MoveLycan']) {
    const lyc = spriteFor(table, 0, 0, { onFoot: 3, wornArmour: true, outfit: 'p6cl', gender: 'female', lycanthropyType: 1 });
    assert.ok(lyc && !isLayeredKey(lyc.key), table);
  }
  // the flinch: the hurt pose (records 10-14) on both bodies now
  assert.equal(spriteFor('Death', 0, 0, look).record, 10);
  assert.equal(spriteFor('Death', 0, 0, { ...look, gender: 'male' }).record, 10);
  // and the bow / cast: records 20-24 on both - the female has her own bow now, not her idle stance
  for (const gender of ['female', 'male']) for (const table of ['AttackRanged', 'AttackSpell']) {
    const b = spriteFor(table, 2, 1, { ...look, gender });
    assert.equal(b.record, 22, `${gender} ${table}`);
    assert.ok(existsSync(strip(b.key)), b.key);
  }
});

test('a strip composes: each plate slot takes its own metal and that metal\'s trim, the rest stays the base', () => {
  // 1 x 1 pixel per tile, 11 tiles: base, slot map, 7 metals, rim trim, cuff trim
  const px = (r, g, b, a = 255) => [r, g, b, a];
  const tiles = [px(9, 9, 9), px(0, 255, 0), ...[0, 1, 2, 3, 4, 5, 6].map((i) => px(10 + i, 0, 0)), px(0, 0, 0, 0), px(0, 0, 0, 0)];
  const data = new Uint8Array(tiles.flat());
  assert.deepEqual([...composeStrip({ width: 11, height: 1, data }, 'lp6l').data], [16, 0, 0, 255]);   // top in daedric
  assert.deepEqual([...composeStrip({ width: 11, height: 1, data }, 'p6ll').data], [9, 9, 9, 255]);    // the pixel is the top's
  assert.deepEqual([...composeStrip({ width: 1, height: 1, data: new Uint8Array([5, 6, 7, 255]) }, 'lll').data], [5, 6, 7, 255]);
});

test('a worn cloak: its slot and dye read from the equip table and from a peer, and the art exists where it is claimed', () => {
  assert.deepEqual(CLOAK_SLOTS, [EQUIP_SLOTS.Cloak1, EQUIP_SLOTS.Cloak2]);
  const slots = []; slots[EQUIP_SLOTS.Cloak2] = { templateIndex: 154, dye: 4 };      // a Casual Cloak, dyed Purple
  assert.equal(cloakOfSlots(slots), 4);
  assert.equal(outfitOfSlots(slots), 'lll~4');
  slots[EQUIP_SLOTS.Cloak2] = { templateIndex: 191 };                                 // a woman's, no dye: Light Brown, the default
  assert.equal(cloakOfSlots(slots), DYE_COLORS.LightBrown);
  slots[EQUIP_SLOTS.Cloak2] = { templateIndex: 155, dyeColor: 7 };                   // the dye under its other name
  assert.equal(cloakOfSlots(slots), 7);
  slots[EQUIP_SLOTS.Cloak2] = { templateIndex: 5, dye: 4 };                           // not a cloak
  assert.equal(cloakOfSlots(slots), null);
  assert.equal(outfitOfItems([{ equipSlot: EQUIP_SLOTS.Cloak1, templateIndex: 155, dye: 2, group: 'MensClothing' }]), 'lll~2');
  assert.deepEqual(outfitPieces('p6cl~9'), { head: 'p6', top: 'c', legs: 'l', cloak: 9 });
  assert.equal(outfitPieces('lll').cloak, null);
  assert.equal(outfitPieces('lll~10'), null);
  // every on-foot frame carries it, both bodies: walk / attack / hurt / idle and the bow / cast
  const look = { gender: 'male', outfit: 'ccc~2' };
  assert.ok(layeredSprite('Move', 1, 0, 4, look, false).key.endsWith(':ccc~2'));
  assert.ok(layeredSprite('AttackMelee', 2, 3, 6, look, false).key.endsWith(':ccc~2'));
  assert.ok(layeredSprite('Death', 4, 0, 1, look, false).key.endsWith(':ccc~2'));
  assert.ok(layeredSprite('Idle', 0, 0, 1, look, false).key.endsWith(':ccc~2'));
  assert.ok(layeredSprite('AttackRanged', 0, 0, 4, look, false).key.endsWith(':ccc~2'));
  // the worn helmet stays under the hood, both bodies; the bow / cast frames (records 20-24) carry the cloak too
  assert.equal(layeredSprite('Move', 1, 0, 4, { gender: 'female', outfit: 'p6cl~2' }, false).key, 'LA:female:plate_chain_leather:1-0:p6cl~2');
  assert.equal(layeredSprite('AttackRanged', 0, 0, 4, { gender: 'female', outfit: 'p6cl~2' }, false).key, 'LA:female:plate_chain_leather:20-0:p6cl~2');
  assert.equal(layeredSprite('AttackSpell', 2, 1, 4, { gender: 'male', outfit: 'ccc~5' }, false).key, 'LA:male:chain_chain_chain:22-1:ccc~5');
  assert.equal(layeredSprite('Move', 1, 0, 4, { gender: 'male', outfit: 'p6cl~2' }, false).key, 'LA:male:plate_chain_leather:1-0:p6cl~2');
});

test('the dye is the clothing band, step for step: the green ramp maps onto the dye\'s sixteen colours', () => {
  const man = JSON.parse(readFileSync(new URL('../../../vendor/layered-armor/cloak/manifest.json', import.meta.url), 'utf8'));
  for (let d = 0; d < 10; d++) for (const i of [0, 5, 10, 15]) assert.deepEqual(dyeCloth(...man.ramp[i], d), man.dyes[d][i], `dye ${d} step ${i}`);
});

test('every cloak frame is seven tiles on the outfit canvas, and composing it changes the picture', async () => {
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
  if (!PNG) return;   // no decoder in this checkout
  const man = JSON.parse(readFileSync(new URL('../../../vendor/layered-armor/cloak/manifest.json', import.meta.url), 'utf8'));
  for (const body of ['male', 'female']) {
    assert.equal(man[body].frames.length, 80, body);
    for (const rf of man[body].frames) {
      const c = PNG.sync.read(readFileSync(new URL(`../../../vendor/layered-armor/cloak/${body}/${rf}.png`, import.meta.url)));
      const b = PNG.sync.read(readFileSync(new URL(`../../../vendor/layered-armor/${body}/chain_chain_chain/${rf}.png`, import.meta.url)));
      assert.equal(c.width, b.width * 7, `${body} ${rf}`); assert.equal(c.height, b.height, `${body} ${rf}`);
      const plain = composeStrip(b, 'ccc'), cloaked = composeStrip(b, 'ccc~0', { strip: c, over: false });
      assert.ok(Buffer.compare(Buffer.from(plain.data), Buffer.from(cloaked.data)) !== 0, `${body} ${rf}`);
    }
  }
});

test('a hood fix lays its px over the cloaked picture: by slot and metal, dyed when it is cloth, or cleared', () => {
  const man = JSON.parse(readFileSync(new URL('../../../vendor/layered-armor/cloak/manifest.json', import.meta.url), 'utf8'));
  const px = (r, g, b, a = 255) => [r, g, b, a], none = px(0, 0, 0, 0);
  const pic = () => ({ width: 1, height: 1, data: new Uint8Array([9, 9, 9, 255]) });
  // 9 tiles: base, slot map, 7 metals - a legs px with only daedric set, exact (128)
  const fix = { width: 9, height: 1, data: new Uint8Array([none, px(0, 0, 255), none, none, none, none, none, none, px(40, 50, 60, 128)].flat()) };
  let out = pic(); applyHoodFix(out, fix, { head: 'l', top: 'l', legs: 'p6' }, 5);
  assert.deepEqual([...out.data], [40, 50, 60, 255]);
  out = pic(); applyHoodFix(out, fix, { head: 'l', top: 'l', legs: 'p0' }, 5);   // iron has nothing there, the base neither
  assert.deepEqual([...out.data], [9, 9, 9, 255]);
  out = pic(); applyHoodFix(out, fix, { head: 'p6', top: 'l', legs: 'l' }, 5);    // the px is the legs', not the helmet's
  assert.deepEqual([...out.data], [9, 9, 9, 255]);
  // one tile (no plate piece): the ramp's green takes the dye, alpha 1 clears
  out = pic(); applyHoodFix(out, { width: 1, height: 1, data: new Uint8Array(px(...man.ramp[5])) }, { head: 'l', top: 'l', legs: 'l' }, 2);
  assert.deepEqual([...out.data], [...man.dyes[2][5], 255]);
  out = pic(); applyHoodFix(out, { width: 1, height: 1, data: new Uint8Array(px(0, 0, 0, 1)) }, { head: 'l', top: 'l', legs: 'l' }, 2);
  assert.equal(out.data[3], 0);
  out = pic(); applyHoodFix(out, { width: 2, height: 1, data: new Uint8Array(8).fill(255) }, { head: 'l', top: 'l', legs: 'l' }, 2);   // not this canvas
  assert.deepEqual([...out.data], [9, 9, 9, 255]);
});

test('every hood fix strip sits on its body strip\'s canvas, and decodeLayered lays it on only with a cloak', async () => {
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
  if (!PNG) return;   // no decoder in this checkout
  const man = JSON.parse(readFileSync(new URL('../../../vendor/layered-armor/manifest.json', import.meta.url), 'utf8'));
  const dir = (p) => new URL(`../../../vendor/layered-armor/${p}`, import.meta.url);
  let n = 0;
  for (const body of ['male', 'female']) {
    for (const combo of readdirSync(dir(`hoodfix/${body}`))) {
      assert.ok(man[body].outfits[combo], `${body} ${combo}`);
      for (const f of readdirSync(dir(`hoodfix/${body}/${combo}`))) {
        const fx = PNG.sync.read(readFileSync(dir(`hoodfix/${body}/${combo}/${f}`)));
        const b = PNG.sync.read(readFileSync(dir(`${body}/${combo}/${f}`)));
        const w = man[body].outfits[combo].plate ? b.width / man.tiles.length : b.width;
        assert.equal(fx.width, man[body].outfits[combo].plate ? w * 9 : w, `${body} ${combo} ${f}`);
        assert.equal(fx.height, b.height, `${body} ${combo} ${f}`);
        n++;
      }
    }
  }
  assert.ok(n > 0);
  // the decoder fetches the strip, the cloak and the hood fix, and composes them; without a cloak no fix is asked for
  const asked = [];
  const file = (k) => readFileSync(dir(k));
  const opts = {
    fetchUrl: async (u) => { asked.push(u); return { ok: true, arrayBuffer: async () => file(u) }; },
    urlOf: (k) => `${k}.png`, cloakUrlOf: (k) => `cloak/${k}.png`, hoodFixUrlOf: (k) => (existsSync(dir(`hoodfix/${k}.png`)) ? `hoodfix/${k}.png` : null),
  };
  const decode = async (bytes) => PNG.sync.read(Buffer.from(bytes));
  const [body, combo, rf] = ['male', 'chain_chain_leather', '2-3'];
  assert.ok(existsSync(dir(`hoodfix/${body}/${combo}/${rf}.png`)));
  await decodeLayered(`LA:${body}:${combo}:${rf}:ccl`, decode, opts);
  assert.deepEqual(asked, [`${body}/${combo}/${rf}.png`]);
  asked.length = 0;
  const pic = await decodeLayered(`LA:${body}:${combo}:${rf}:ccl~5`, decode, opts);
  assert.deepEqual(asked, [`${body}/${combo}/${rf}.png`, `cloak/${body}/${rf}.png`, `hoodfix/${body}/${combo}/${rf}.png`]);
  const bare = await decodeLayered(`LA:${body}:${combo}:${rf}:ccl~5`, decode, { ...opts, hoodFixUrlOf: () => null });
  assert.ok(Buffer.compare(Buffer.from(pic.data), Buffer.from(bare.data)) !== 0);   // the fix changes the picture
});

test('LAYERED-GEAR: a skin chosen on the profile, not a feature\'s dial - off, female, male or the character\'s own (LAYERED-GEAR-ON: the default), and the look carries the body (mutants: LAYERED-ON-default-off, LAYERED-ON-own-unread)', () => {
  _resetModSettings();
  const V = 'eye-of-the-beholder', key = MOD_SETTINGS[V].keys['Graphics.LayeredGear'];
  // PIN MOVED (LAYERED-GEAR-ON, the owner 2026-10-19: "Make sure this is on by default"): on, in the character's own body
  assert.equal(key.default, LAYERED_OWN, 'on until Skins is chosen');
  assert.equal(LAYERED_OWN, 3);
  assert.deepEqual([...key.labels], ['Off', 'Female', 'Male', 'Your own body']);
  assert.ok(!MOD_CURATED[V].includes('Graphics.LayeredGear'), 'not in the mod\'s details (the Features drawer)');
  assert.equal(MOD_SETTINGS[V].keys['Graphics.WornArmour'], undefined, 'the old switch is gone');
  assert.deepEqual([0, 1, 2, 4, null].map((c) => layeredGenderOf(c, 'female')), [null, 'female', 'male', null, null]);
  assert.deepEqual(['female', 'male', undefined].map((g) => layeredGenderOf(LAYERED_OWN, g)), ['female', 'male', 'male'], 'the own body: the character\'s, else male (playerEntity\'s own default)');
  assert.equal(layeredPreviewUrl('female'), null, 'node: no bundle, no picture');
  const who = { race: 'Nord', gender: 'male' };
  // the default: the character's own body is sent as the body it is - never 3 on the wire
  assert.equal(ownLayeredGear(who), 2);
  assert.equal(composeLook(who).lg, 2);
  assert.equal(composeLook({ race: 'Nord', gender: 'female' }).lg, 1);
  // the look: OMITTED while off (Skins), `class`'s law - a look without it keeps the bytes it always had
  setModSetting(V, 'Graphics.LayeredGear', 0);
  assert.equal(ownLayeredGear(who), null);
  assert.ok(!('lg' in composeLook(who)));
  setModSetting(V, 'Graphics.LayeredGear', 1);
  assert.equal(ownLayeredGear(), 1);
  assert.equal(composeLook(who).lg, 1, 'a male character may choose the female body');
  setModSetting(V, 'Enabled', false);
  assert.ok(!('lg' in composeLook(who)), 'the mod off: no sprite body, nothing to dress');
  setModSetting(V, 'Enabled', true);
  // the relay keeps 1 and 2 and nothing else
  const v = (lg) => validLook({ race: 'Nord', gender: 'male', faceIndex: 0, lg, items: [] });
  assert.equal(v(1).lg, 1); assert.equal(v(2).lg, 2);
  for (const bad of [0, undefined, -1, 'female', null]) assert.ok(!('lg' in v(bad)), String(bad));
  assert.equal(v(7).lg, 2, 'clamped, as every uint of the look');
  _resetModSettings();
});

test('LAYERED-GEAR: the skin card offers the bodies - PIN MOVED (the owner, 2026-10-19: "a proper toggle in the account profile"): no third panel; the Look toggle opens on Layered Gearing, the own body marked, and a body pressed is worn (test/ui/skinmode_toggle.test.js pins the toggle)', () => {
  _resetModSettings();
  const el = (tag) => {
    const n = { tag, children: [], attrs: {}, className: '', textContent: '', parent: null };
    n.append = (...cs) => { for (const c of cs) { n.children.push(c); c.parent = n; } };
    n.setAttribute = (k, val) => { n.attrs[k] = val; };
    Object.defineProperty(n, 'textContent', { get: () => n._t ?? '', set: (val) => { n._t = val; if (val === '') n.children = []; } });
    return n;
  };
  const find = (n, cls, out = []) => {
    if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
    for (const c of n.children ?? []) find(c, cls, out);
    return out;
  };
  const card = skinCard({ createElement: el }, { gender: () => 'female' });
  const label = (h) => find(h, 'fieldlabel')[0].textContent;
  const name = (x) => find(x, 'skinname')[0].textContent;
  assert.deepEqual(find(card.root, 'skinhead').map(label), ['Mounted'], 'no On foot panel, no third panel');
  assert.deepEqual(skinSets().layered.map((x) => x.name), ['Off', 'Female', 'Male', 'Your own body']);
  const tiles = () => find(card.root, 'skintile');
  assert.deepEqual(tiles().map(name), ['Female', 'Male']);
  assert.deepEqual(tiles().map((x) => x.attrs['aria-pressed']), ['true', 'false'], 'the own body, a female character\'s');
  tiles()[1].onclick();
  assert.equal(modSetting('eye-of-the-beholder', 'Graphics.LayeredGear'), 2, 'the store the body reads and the look sends');
  assert.deepEqual(tiles().map((x) => x.attrs['aria-pressed']), ['false', 'true']);
  _resetModSettings();
});
