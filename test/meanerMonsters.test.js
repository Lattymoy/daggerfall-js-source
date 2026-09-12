// MM1 (2026-09-12) - MEANER MONSTERS 1.5.2 (Ralzar), THE MOD, 1:1.
// Mac: "Next is this mod to integrate 1-1. Additionally for mod options,
// everything should be compatible across the board and there shouldn't
// be compatibility switches between mods."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  MEANER_MONSTERS_ROWS, MEANER_MONSTERS_PCO_ROWS, MEANER_MONSTERS_PCO_FLAG, MEANER_MONSTERS_EDIT, foldMeanerMonsters, unpackCorpseTexture,
  applyMeanerMonsters, meanerMonstersEnabled, MEANER_MONSTERS_BILLBOARD_XML, installMeanerMonsters, MEANER_MONSTERS_VENDOR,
} from '../src/characters/meanerMonsters.js';
import { registerBillboardXml, unregisterBillboardXml, billboardXmlScale, applyBillboardXml } from '../src/world/billboardXml.js';
import { billboardSize, mobileBillboardSize, scaledBillboardSize } from '../src/world/rmbFlats.js';
import { setTextureReplacements, clearTextureReplacements } from '../src/systems/textureReplacement.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { MEANER_MONSTERS as PCAAO_EDIT } from '../src/combat/pcaaoMeanerMonsters.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings, modSettingIfDeclared } from '../src/systems/modSettings.js';
import { CREDITS } from '../src/ui/credits.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const career = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });

test('MM1: the table is the DLL\'s, row for row - twenty-four rows in its order, the four id-35 rows folded so the LAST lands on the Fire Atronach, the name never applied, the pco array dead (mutants: a row reordered, the fold keeping the first, pco true)', () => {
  assert.equal(MEANER_MONSTERS_ROWS.length, 24);
  assert.deepEqual(MEANER_MONSTERS_ROWS.map((r) => r.id), [0, 3, 4, 5, 6, 9, 14, 16, 17, 19, 20, 30, 31, 32, 33, 7, 12, 21, 24, 35, 35, 35, 35, 40], 'the C#\'s order');
  assert.deepEqual(MEANER_MONSTERS_EDIT[0], { level: 1, minHealth: 15, maxHealth: 25, armorValue: 8, minDamage: 1, maxDamage: 4 }, 'the Rat, debuffed');
  assert.deepEqual(MEANER_MONSTERS_EDIT[4], { minHealth: 50, maxHealth: 100, armorValue: 7, minDamage: 1, maxDamage: 2, minDamage2: 8, maxDamage2: 12, minDamage3: 10, maxDamage3: 20 }, 'the Grizzly Bear: level -1 leaves the base level');
  assert.deepEqual(MEANER_MONSTERS_EDIT[35], { level: 21, minHealth: 25, maxHealth: 130, armorValue: 6, minDamage: 5, maxDamage: 15 }, 'id 35 four times: the "Ice Atronach" row lands on the FIRE Atronach');
  assert.equal(MEANER_MONSTERS_EDIT[36], undefined); assert.equal(MEANER_MONSTERS_EDIT[37], undefined); assert.equal(MEANER_MONSTERS_EDIT[38], undefined, 'the other atronachs are never touched');
  assert.equal(MEANER_MONSTERS_ROWS[21].minDmg, 55); assert.equal(MEANER_MONSTERS_ROWS[21].maxDmg, 15, 'the "Flesh Atronach" row\'s min over max, carried, overwritten');
  assert.equal(MEANER_MONSTERS_ROWS[23].name, 'Large Dragonling'); assert.equal(MEANER_MONSTERS_EDIT[40].name, undefined, 'the name write is commented out in InitMod');
  assert.deepEqual(MEANER_MONSTERS_EDIT[40], { level: 21, minHealth: 140, maxHealth: 250, armorValue: -12, minDamage: 50, maxDamage: 150 });
  assert.equal(Object.keys(MEANER_MONSTERS_EDIT).length, 21, 'twenty-one monsters edited');
  assert.equal(MEANER_MONSTERS_PCO_FLAG, false, '`private static bool pco = false;` - nothing sets it');
  assert.equal(MEANER_MONSTERS_PCO_ROWS.length, 22, 'the dead array carried as data');
  assert.deepEqual(foldMeanerMonsters(MEANER_MONSTERS_PCO_ROWS)[4].armorValue, 8, '...and foldable, were pco ever true');
  // no row sets a sound or a corpse
  assert.ok(MEANER_MONSTERS_ROWS.every((r) => r.moveSnd === -1 && r.barkSnd === -1 && r.attackSnd === -1 && r.corpseTex === -1));
  // AUDIT MM1: were a row ever to set one, CorpseTexture's packed int unpacks to the port's {archive, record}
  assert.deepEqual(unpackCorpseTexture((96 << 16) + 5), { archive: 96, record: 5 });
  assert.deepEqual(foldMeanerMonsters([{ id: 9, level: -1, minHp: -1, maxHp: -1, armor: -1, minDmg: -1, maxDmg: -1, minDmg2: -1, maxDmg2: -1, minDmg3: -1, maxDmg3: -1, moveSnd: 12, barkSnd: -1, attackSnd: -1, corpseTex: (405 << 16) + 2 }])[9], { moveSound: 12, corpseTexture: { archive: 405, record: 2 } });
});

test('MM1: the row at mint - the edit over the base row under the mod\'s Enabled, the base row otherwise, a class enemy untouched; the overhaul\'s edit over Ralzar\'s when both are on, with NO switch between them (mutant: the order swapped)', () => {
  const base = ENEMY_BASICS[0];
  assert.equal(applyMeanerMonsters(0, base, false), base);
  const on = applyMeanerMonsters(0, base, true);
  assert.equal(on.minHealth, 15); assert.equal(on.maxHealth, 25); assert.equal(on.armorValue, 8); assert.equal(on.maleTexture, base.maleTexture, 'the rest is the base row\'s');
  assert.equal(applyMeanerMonsters(128 + 17, ENEMY_BASICS[128 + 17], true), ENEMY_BASICS[128 + 17]);
  assert.equal(applyMeanerMonsters(1, ENEMY_BASICS[1], true), ENEMY_BASICS[1], 'an unnamed monster (the Imp) is untouched');
  _resetModSettings();
  assert.equal(meanerMonstersEnabled(), false, 'off by default - the player lists the mod');
  assert.equal(makeEnemyEntity(0, ENEMY_BASICS[0], career(), 5, () => 0.5).basics.maxHealth, ENEMY_BASICS[0].maxHealth);
  setModSetting('meanerMonsters', 'Enabled', true);
  const rat = makeEnemyEntity(0, ENEMY_BASICS[0], career(), 5, () => 0.5);
  assert.equal(rat.basics.maxHealth, 25, 'Ralzar\'s rat'); assert.equal(rat.basics.armorValue, 8);
  assert.equal(rat.maxHealth, 20, 'Range(15, 26) at a half roll');
  // both on: PCAAO lists Meaner Monsters as a dependency, so its Awake runs after and its values win
  setModSetting('pcaao', 'Enabled', true);
  const both = makeEnemyEntity(0, ENEMY_BASICS[0], career(), 5, () => 0.5);
  assert.equal(both.basics.maxHealth, PCAAO_EDIT[0].maxHealth); assert.equal(both.basics.armorValue, PCAAO_EDIT[0].armorValue);
  // ...a monster the overhaul's edit names but Ralzar's does not keeps the overhaul's; one Ralzar names and the overhaul does not (none - the overhaul names 42) keeps Ralzar's
  assert.equal(makeEnemyEntity(1, ENEMY_BASICS[1], career(), 5, () => 0.5).basics.maxHealth, PCAAO_EDIT[1].maxHealth, 'the Imp: the overhaul\'s row alone');
  setModSetting('meanerMonsters', 'Enabled', false);
  assert.equal(makeEnemyEntity(0, ENEMY_BASICS[0], career(), 5, () => 0.5).basics.maxHealth, ENEMY_BASICS[0].maxHealth, 'the overhaul on ALONE: DFU\'s "Meaner Monsters is loaded" arm is off, the base row stands');
  _resetModSettings();
  assert.equal(modSettingIfDeclared('roleplayRealism', 'advancedArchery'), undefined, 'a mod the port has not vendored reads as not loaded');
  assert.equal(modSettingIfDeclared('meanerMonsters', 'Enabled'), false);
});

test('MM1: the forty-six xml files - the vendored files equal the table (werewolf and wereboar x1.2, the dragonling x2.5, its corpse x2), and DFU\'s SetBillboardScale applies them after the record\'s own scale, under the switch alone (mutants: the scale before the truncation, or always on)', () => {
  // the vendored xml, parsed
  const parsed = {};
  for (const dir of ['Werewolf', 'Wereboar', 'AlternateDragon']) {
    for (const f of readdirSync(new URL(`../vendor/meanerMonsters/xml/${dir}`, import.meta.url))) {
      const m = /^(\d+)_(\d+)-0\.xml$/.exec(f); assert.ok(m, f);
      const x = rd(`vendor/meanerMonsters/xml/${dir}/${f}`);
      const sx = /<scaleX>([\d.]+)<\/scaleX>/.exec(x), sy = /<scaleY>([\d.]+)<\/scaleY>/.exec(x);
      (parsed[Number(m[1])] ??= {})[Number(m[2])] = [Number(sx[1]), Number(sy[1])];
    }
  }
  assert.equal(Object.values(parsed).reduce((n, a) => n + Object.keys(a).length, 0), 46);
  assert.deepEqual(JSON.parse(JSON.stringify(MEANER_MONSTERS_BILLBOARD_XML)), parsed, 'the table IS the files');
  const manifest = JSON.parse(rd('vendor/meanerMonsters/MeanerMonsters.dfmod.json'));
  assert.equal(manifest.Files.filter((f) => f.endsWith('.xml')).length, 46); assert.equal(manifest.ModVersion, '1.5.2'); assert.equal(manifest.ModAuthor, 'Ralzar');
  // the registry and the size law
  unregisterBillboardXml(MEANER_MONSTERS_VENDOR);
  let on = false;
  installMeanerMonsters({ read: (k) => (k === 'Enabled' ? on : undefined) });
  assert.equal(billboardXmlScale(264, 3), null, 'off: no xml');
  on = true;
  assert.deepEqual(billboardXmlScale(264, 3), { x: 1.2, y: 1.2 }); assert.deepEqual(billboardXmlScale(295, 14), { x: 2.5, y: 2.5 }); assert.deepEqual(billboardXmlScale(96, 0), { x: 2, y: 2 });
  assert.equal(billboardXmlScale(96, 5), null, 'the werewolf\'s corpse (96/5) has no file'); assert.equal(billboardXmlScale(264, 15), null);
  // a TEXTURE.264 stand-in: a 97x109 record with the classic -70 scale, as the werewolf's are - a MOBILE UNIT
  const t = { archive: 264, getSize: () => ({ width: 97, height: 109 }), getScale: () => ({ width: -70, height: -70 }) };
  const plain = scaledBillboardSize(t.getSize(0), t.getScale(0));
  const sized = mobileBillboardSize(t, 0);
  assert.ok(Math.abs(sized.w - plain.w * 1.2) < 1e-12 && Math.abs(sized.h - plain.h * 1.2) < 1e-12, 'the xml multiplies the TRUNCATED, scaled size (DaggerfallMobileUnit.cs:673-679)');
  on = false;
  assert.deepEqual(mobileBillboardSize(t, 0), plain, 'off: the record\'s own size');
  assert.deepEqual(mobileBillboardSize({ getSize: () => ({ width: 10, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }, 0), scaledBillboardSize({ width: 10, height: 10 }, { width: 0, height: 0 }), 'a texture with no archive: no xml');
  // AUDIT MM1: a STATIC billboard reads the xml only with an imported texture for the record
  // (GetStaticBillboardMaterial's `if (LoadFromCacheOrImport(...))`, TextureReplacement.cs:504-519) - so the
  // dragonling's corpse (96/0, x2 in the file) stays classic-sized under this mod, which ships no PNG
  on = true;
  const corpse = { archive: 96, getSize: () => ({ width: 60, height: 40 }), getScale: () => ({ width: 0, height: 0 }) };
  const corpsePlain = scaledBillboardSize(corpse.getSize(0), corpse.getScale(0));
  clearTextureReplacements();
  assert.deepEqual(billboardSize(corpse, 0), corpsePlain, 'no PNG for 96/0: the corpse xml is inert, as in DFU');
  assert.ok(Math.abs(mobileBillboardSize(corpse, 0).w - corpsePlain.w * 2) < 1e-12, '(a mobile unit on that archive would take it)');
  setTextureReplacements(['096_0-0.png'], async () => null);
  const doubled = billboardSize(corpse, 0);
  assert.ok(Math.abs(doubled.w - corpsePlain.w * 2) < 1e-12 && Math.abs(doubled.h - corpsePlain.h * 2) < 1e-12, 'a pack that replaces 96/0: the xml scales the corpse');
  assert.deepEqual(billboardSize({ archive: 96, getSize: () => ({ width: 60, height: 40 }), getScale: () => ({ width: 0, height: 0 }) }, 5), corpsePlain, 'the werewolf\'s corpse (96/5): no file, no PNG');
  clearTextureReplacements();
  on = false;
  // a later registrant wins, as a later-loaded mod's file does
  registerBillboardXml('later', { 264: { 3: [3, 3] } }, () => true);
  assert.deepEqual(billboardXmlScale(264, 3), { x: 3, y: 3 });
  unregisterBillboardXml('later');
  assert.deepEqual(applyBillboardXml(999, 0, { w: 1, h: 2 }), { w: 1, h: 2 });
  installMeanerMonsters();   // the real switch back
});

test('MM1: the seams - the archive on a parsed TEXTURE.###, every billboard sized through the one door, the boot install before the overhaul\'s, the Mods pane entry, the credit, the vendor README, and the overhaul\'s two compatibility switches GONE (mutant: any)', () => {
  assert.match(rd('src/formats/textureFile.js'), /this\.archive = Number\.parseInt\(fileName\.slice\('TEXTURE\.'\.length\), 10\);/);
  for (const f of readdirSync(new URL('../src/scenes', import.meta.url))) {
    const s = rd(`src/scenes/${f}`);
    assert.doesNotMatch(s, /scaledBillboardSize\(\w+(?:\.\w+)*\.getSize\(/, `${f}: a billboard sized past the xml door`);
  }
  // AUDIT MM1: the mobile units through the mobile door (DaggerfallMobileUnit / MobilePersonBillboard), everything else static
  assert.match(rd('src/characters/enemyAnchor.js'), /return mobileBillboardSize\(t, 0\)\.h;/, 'the idle height reads the scaled record');
  assert.match(rd('src/scenes/exteriorFoes.js'), /const sz = mobileBillboardSize\(f\.tex, o\.record\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /const sz = mobileBillboardSize\(f\.mobileTex, out\.record\);/);
  assert.match(rd('src/scenes/cityGuards.js'), /const sz = mobileBillboardSize\(g\.tex, o\.record\);/);
  assert.match(rd('src/scenes/world.js'), /const sz = mobileBillboardSize\(pt, out\.record\);/);
  assert.match(rd('src/scenes/exterior.js'), /const sz = mobileBillboardSize\(t, out\.record\);/);
  assert.match(rd('src/scenes/corpseMarker.js'), /const size = billboardSize\(t, record\) \?\? fallbackSize;/, 'a corpse is a static billboard');
  assert.equal((rd('src/scenes/exteriorFoes.js').match(/mobileBillboardSize\(/g) || []).length, 1, 'the corpse fallback stays static');
  const wt = rd('src/systems/worldTick.js');
  assert.ok(wt.indexOf('installMeanerMonsters();') < wt.indexOf('installPcaao();'), 'the dependency Awakes first');
  const m = MOD_SETTINGS.meanerMonsters;
  assert.equal(m.author, 'Ralzar'); assert.deepEqual(Object.keys(m.keys), ['Enabled']); assert.equal(m.keys.Enabled.default, false);
  assert.ok(Object.keys(MOD_SETTINGS).indexOf('meanerMonsters') < Object.keys(MOD_SETTINGS).indexOf('pcaao'), 'listed before the overhaul, as it loads');
  assert.equal(MOD_SETTINGS.pcaao.keys.meanerMonsters, undefined, 'Mac: no compatibility switches between mods');
  assert.equal(MOD_SETTINGS.pcaao.keys.rolePlayRealismArchery, undefined);
  const credit = CREDITS.mods.find((c) => c.title === 'Meaner Monsters');
  assert.ok(credit); assert.equal(credit.author, 'Ralzar'); assert.equal(credit.version, '1.5.2'); assert.deepEqual([...credit.vendor], ['meanerMonsters']); assert.match(credit.terms, /MIT/);
  assert.match(rd('vendor/meanerMonsters/README.md'), /Ralzar/); assert.match(rd('vendor/meanerMonsters/README.md'), /MIT/);
  assert.match(rd('src/characters/enemyEntity.js'), /const basics = pcaaoMeanerMonstersRow\(mobileType, applyMeanerMonsters\(mobileType, basicsIn\)\);/, 'Ralzar\'s row, then the overhaul\'s edit over it');
});
