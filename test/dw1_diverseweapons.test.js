// DW1 - DIVERSE WEAPONS 1.7.3 (2026-09-23, Mac: "Its a mod integration",
// with the shipped zip over a Drive link).
//
// THE MOD IS ONE LINE OF CODE AND 12,624 SPRITES. The line is
// `FPSWeapon.moddedWeaponHUDAnimsEnabled = true` and everything it
// switches on is Daggerfall Unity's own - so what is pinned here is a
// port OF DFU, gated on a vendored mod's switch, and a door that reads
// the sprites off the player's copy of the bundle. The bundle is not in
// the repository (58 MB, and the port ships no mod's art), so the door
// is driven on its loose-PNG arm and its refusals here, and was driven
// on the real bundle by hand when it was written (12,624 textures
// indexed, every ask at its painted size).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dfuFile, missingDfu } from './dfuRoot.mjs';
import {
  moddedWeaponHUDAnimsEnabled, moddedWeaponFilename, atlasFileName, customTextureNames,
  DIVERSE_WEAPONS_WIDGET_PRESET, diverseWeaponsWidgetPreset, diverseWeaponsPresetOn, withDiverseWeaponsPreset,
} from '../src/combat/diverseWeapons.js';
import {
  DIVERSE_WEAPONS_MOD, setDiverseWeaponsSources, clearDiverseWeaponsSources, diverseWeaponsSourcesCount,
  diverseWeaponsBundle, diverseWeaponsImage, customWeaponImage, diverseWeaponsTexturesAttached, _resetDiverseWeaponsImages,
} from '../src/combat/diverseWeaponsAssets.js';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings, flattenModPreset } from '../src/systems/modSettings.js';
import { readWidgetSettings } from '../src/combat/weaponWidgetMotion.js';
import { WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { MATERIAL_NAMES } from '../src/systems/itemInfo.js';
import { ENCHANTMENT_TYPES } from '../src/systems/enchantments.js';
import { ARTIFACTS } from '../src/systems/artifactEffects.js';
import { WEAPON_FILE, WEAPON_TYPES } from '../src/combat/fpsWeapon.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = (templateIndex, extra = {}) => ({ templateIndex, material: WEAPON_MATERIALS.Iron, enchantments: [], ...extra });
const MAGIC = [{ type: ENCHANTMENT_TYPES.CastWhenUsed ?? 1, param: 0 }];
const ARTIFACT = (subtype) => ({ artifact: true, enchantments: [{ type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: subtype }] });

// ── the flag ──────────────────────────────────────────────────────────

test('DW1: the flag is the mod’s Enabled switch, on by default, and the preset on by default too (DW-CLIP)', () => {
  _resetModSettings();
  const v = MOD_SETTINGS['diverse-weapons'];
  assert.ok(v, 'the vendor is declared');
  assert.equal(v.title, 'Diverse Weapons'); assert.equal(v.author, 'RealAKP');
  assert.deepEqual(Object.keys(v.keys), ['Enabled', 'WeaponWidgetPreset'], 'the mod has no settings of its own: the flag, and the port’s reading of its readme');
  assert.equal(moddedWeaponHUDAnimsEnabled(), true, 'FPSWeapon.moddedWeaponHUDAnimsEnabled, as DiverseWeaponsMain.Start sets it');
  assert.equal(diverseWeaponsPresetOn(), true, 'DW-CLIP (Mac: "mod should be defaulted on"): the look the readme asks for, without the hunt for the switch');
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', false);
  assert.equal(diverseWeaponsPresetOn(), false, 'and a player may take Weapon Widget\'s own settings back');
  setModSetting('diverse-weapons', 'Enabled', false);
  assert.equal(moddedWeaponHUDAnimsEnabled(), false);
  setModSetting('diverse-weapons', 'Enabled', true); setModSetting('diverse-weapons', 'WeaponWidgetPreset', true);
  assert.equal(diverseWeaponsPresetOn(), true);
  setModSetting('diverse-weapons', 'Enabled', false);
  assert.equal(diverseWeaponsPresetOn(), false, 'the preset rides the mod: off with it');
  _resetModSettings();
  // the one line the mod ships, carried verbatim
  const cs = src('vendor/diverse-weapons/DiverseWeaponsMain.cs');
  assert.match(cs, /FPSWeapon\.moddedWeaponHUDAnimsEnabled = true;/);
  assert.match(cs, /License:\s+MIT License/);
});

// ── WeaponBasics.GetModdedWeaponFilename ──────────────────────────────

test('DW1: GetModdedWeaponFilename - the three tables, regenerated from WeaponBasics.cs', { skip: missingDfu('Assets/Scripts/Utility/WeaponBasics.cs') && 'no DFU checkout (DFU_PATH)' }, () => {
  // PY1's shape: the port's table is not remembered here, it is READ
  // BACK out of DFU's own C# and compared case for case.
  const cs = readFileSync(dfuFile('Assets/Scripts/Utility/WeaponBasics.cs'), 'utf8');
  const body = cs.slice(cs.indexOf('GetModdedWeaponFilename'));
  const cases = [...body.matchAll(/case \(int\)Weapons\.(\w+):\s*\n\s*return "([A-Z0-9]+\.CIF)";/g)].map((m) => [m[1], m[2]]);
  assert.ok(cases.length >= 40, `the three switches (${cases.length} cases read)`);
  const artifactNames = /^(MEHRUNESRAZOR|EBONYBLADE|CHRYSAMERE|MACEOFMOLAGBAL|VOLENDRUNG|AURIELSBOW)\.CIF$/;
  for (const [name, file] of cases) {
    const t = WEAPONS[name];
    assert.ok(Number.isInteger(t), `the port knows Weapons.${name}`);
    if (artifactNames.test(file)) assert.equal(moddedWeaponFilename(W(t, ARTIFACT(0))), file, `artifact ${name}`);
    else if (/MAGIC\.CIF$/.test(file)) assert.equal(moddedWeaponFilename(W(t, { enchantments: MAGIC })), file, `enchanted ${name}`);
    else assert.equal(moddedWeaponFilename(W(t)), file, `plain ${name}`);
  }
  // the C# names WABBAJACK and STAFFOFMAGNUS inside the Staff's loop, not as cases
  assert.match(body, /return "WABBAJACK\.CIF";/); assert.match(body, /return "STAFFOFMAGNUS\.CIF";/);
});

test('DW1: the Staff arm walks the legacy enchantments IN ORDER, and the default arm is the empty string', () => {
  const S = WEAPONS.Staff;
  assert.equal(moddedWeaponFilename(W(S, ARTIFACT(ARTIFACTS.Wabbajack))), 'WABBAJACK.CIF');
  // the first entry that is NOT a SpecialArtifactEffect answers Magnus -
  // whatever comes after it
  assert.equal(moddedWeaponFilename(W(S, { artifact: true, enchantments: [{ type: 5, param: 0 }, { type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: ARTIFACTS.Wabbajack }] })), 'STAFFOFMAGNUS.CIF');
  // and the Wabbajack first wins over a later plain effect
  assert.equal(moddedWeaponFilename(W(S, { artifact: true, enchantments: [{ type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: ARTIFACTS.Wabbajack }, { type: 5, param: 0 }] })), 'WABBAJACK.CIF');
  // a list of OTHER artifact effects alone falls out of the loop: ""
  assert.equal(moddedWeaponFilename(W(S, ARTIFACT(16))), '');
  // "Just place-holder for now" - a custom template is "", at all three tables
  assert.equal(moddedWeaponFilename(W(560)), '');
  assert.equal(moddedWeaponFilename(W(560, { enchantments: MAGIC })), '');
  assert.equal(moddedWeaponFilename(W(560, ARTIFACT(0))), '');
  assert.equal(moddedWeaponFilename(null), '');
  // the artifact table is the FIRST question, so an enchanted artifact
  // katana is the Ebony Blade and not KATANAMAGIC
  assert.equal(moddedWeaponFilename(W(WEAPONS.Katana, ARTIFACT(22))), 'EBONYBLADE.CIF');
  assert.equal(moddedWeaponFilename(W(WEAPONS.Katana, { enchantments: MAGIC })), 'KATANAMAGIC.CIF');
  assert.equal(moddedWeaponFilename(W(WEAPONS.Katana)), 'KATANA.CIF');
});

// ── FPSWeapon.GetWeaponTextureAtlas's name choice ─────────────────────

test('DW1: the atlas asks by the per-template name under the flag, and by the classic name for everything else (FPSWeapon.cs:637-644)', () => {
  assert.equal(atlasFileName(W(WEAPONS.Longsword), 'WEAPON04.CIF', true), 'LONGSWORD.CIF');
  assert.equal(atlasFileName(W(WEAPONS.Longsword), 'WEAPON04.CIF', false), 'WEAPON04.CIF', 'the flag off is the classic name, byte for byte');
  assert.equal(atlasFileName(null, 'WEAPON04.CIF', true), 'WEAPON04.CIF', 'no weapon in hand - a spell, the fists - is the classic name');
  assert.equal(atlasFileName(W(560), 'WEAPON04.CIF', true), 'WEAPON04.CIF', 'a custom template answers "" and falls back to GetWeaponFilename (:642-643)');
  // and the classic table is untouched: every WEAPON_TYPES entry still names its WEAPON0x.CIF
  assert.equal(WEAPON_FILE[WEAPON_TYPES.LongBlade], 'WEAPON04.CIF');
  assert.equal(WEAPON_FILE[WEAPON_TYPES.LongBlade_Magic], 'WEAPO104.CIF');
  // BOTH LANES take it: the base FPSWeapon loader asks per frame and
  // keeps the classic record's width and height (:398-399), and the
  // widget clone asks through the same door
  const fp = src('src/combat/fpsWeapon.js');
  assert.match(fp, /const askName = atlasFileName\(item, fileName\);/);
  assert.match(fp, /export const frameName = \(askName, record, frame, metal\) => `\$\{askName\}_\$\{record\}-\$\{frame\}\$\{metal \? `_\$\{metal\}` : ''\}`;/, 'GetNameCifRci’s spelling, one home (AUDIT-DW)');
  assert.match(fp, /const name = frameName\(askName, r, f, metal\);/);
  assert.match(fp, /const customs = await customFrames\(askName, metal, cif, customImage\);/, 'AUDIT-DW F2: every frame asked together');
  assert.match(fp, /const custom = customs\[r\]\[f\];/);
  assert.match(fp, /records\.push\(\{ width: size\.width, height: size\.height, frames \}\);/, 'the record keeps the classic box');
  const ww = src('src/combat/weaponWidget.js');
  assert.match(ww, /const file = atlasFileName\(w\.specificWeapon, classic\);/);
  assert.match(ww, /for \(const name of customTextureNames\(file, record, frame, metal, w\.s\.doubleScale\)\) \{/);
  assert.match(ww, /customWeaponImage\(name\)\.then/);
  // and the rig's art cache carries the name the atlas is asked by, or
  // a longsword and a broadsword share the first one's frames
  const rig = src('src/combat/weaponRig.js');
  assert.match(rig, /const key = `\$\{type\}:\$\{item\?\.material \?\? 0\}:\$\{thunderlock \? '' : atlasFileName\(item, WEAPON_FILE\[type\] \?\? ''\)\}`;/);
  assert.match(rig, /loadFpsWeaponArt\(fetchBytes, palette, renderer, type, item\?\.material \?\? 0, item\)/, 'SpecificWeapon reaches the loader');
});

test('DW1: the names one frame is asked by - the metal suffix, and the w_ ask falling through to the plain one', () => {
  assert.deepEqual(customTextureNames('LONGSWORD.CIF', 3, 2, 'Elven', false), ['LONGSWORD.CIF_3-2_Elven']);
  assert.deepEqual(customTextureNames('LONGSWORD.CIF', 3, 2, 'Elven', true), ['w_LONGSWORD.CIF_3-2_Elven', 'LONGSWORD.CIF_3-2_Elven'],
    'under DoubleScaleTextures the w_ set first, the plain set behind it - or the preset the mod ships would discard every strike frame it paints');
  assert.deepEqual(customTextureNames('WEAPON04.CIF', 0, 0, null, true), ['w_WEAPON04.CIF_0-0', 'WEAPON04.CIF_0-0'], 'None has no suffix (TextureReplacement.cs:797-798)');
  // MetalTypes' names are the port's MATERIAL_NAMES, index for index
  assert.deepEqual(MATERIAL_NAMES, ['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
  for (const [name, i] of Object.entries(WEAPON_MATERIALS)) if (i >= 0) assert.equal(MATERIAL_NAMES[i], name);
  // the clone remembers a miss so the next name gets its turn, and
  // forgets them with the atlas
  const ww = src('src/combat/weaponWidget.js');
  assert.match(ww, /if \(misses\.has\(name\)\) continue;/);
  assert.match(ww, /if \(!img\) \{ misses\.add\(name\); return; \}/);
  assert.match(ww, /w\.customMisses = new Set\(\);/);
});

// ── the door ──────────────────────────────────────────────────────────

test('DW1: the door - the mod’s bundle and its spellings from the pick, nothing else; nothing attached is a fast miss and never a throw', async () => {
  assert.equal(DIVERSE_WEAPONS_MOD.guid, '8e83d67c-a0ac-4935-a8c5-6b18c9f35bfc');
  assert.equal(JSON.parse(src('vendor/diverse-weapons/diverse-weapons.dfmod.json')).GUID, DIVERSE_WEAPONS_MOD.guid, 'the manifest carried is the bundle’s');
  const loads = [];
  const load = async (n) => { loads.push(n); return null; };
  assert.equal(setDiverseWeaponsSources([
    'dfmod/Seasons.dfmod', 'dfmod/Diverse Weapons.dfmod', 'dfmod/diverseweapons.dfmod', 'dfmod/Weapon Widget.dfmod',
    'LONGSWORD.CIF_0-0_Iron.png', 'Textures/w_KATANAMAGIC.CIF_0-0_Ebony.png', '233_5-0_Elven.png', '233_5-0.png', 'w_WEAPON04.CIF_0-0_Elven.png', 'TEXTURE.001-0.png', 'other.txt',
  ], load), 6, 'two bundles spelt as the mod, three of its own spellings, and the classic-archive w_ set it also carries; the undyed icon and the other mods’ files are not its');
  assert.equal(diverseWeaponsSourcesCount(), 6);
  assert.equal(await diverseWeaponsBundle(), null, 'a loader answering nothing: no bundle, no throw');
  assert.deepEqual(loads, ['dfmod/Diverse Weapons.dfmod', 'dfmod/diverseweapons.dfmod'], 'each bundle asked once');
  assert.equal(await diverseWeaponsTexturesAttached(), false);
  assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron'), null);
  // NOTHING ATTACHED: the flag is on by default, so every weapon load
  // asks ~35 names - the miss must cost no work at all
  clearDiverseWeaponsSources();
  const before = loads.length;
  assert.equal(await customWeaponImage('LONGSWORD.CIF_0-0_Iron'), null);
  assert.equal(loads.length, before, 'no loader touched');
});

test('DW1: the door - a loose PNG spelt as the mod asks answers, keeps its rows, and a miss is cached', async () => {
  _resetDiverseWeaponsImages();
  // a 1x2 "PNG": the injected decode answers TOP-FIRST rows, as a
  // browser decode does; the door hands back the screen order a
  // first-person quad reads (WW3/HT3's law for the widget door)
  const TOP_FIRST = { width: 1, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]) };
  let decodes = 0;
  const decode = async () => { decodes++; return TOP_FIRST; };
  const loads = [];
  setDiverseWeaponsSources(['Textures/LONGSWORD.CIF_0-0_Iron.png'], async (n) => { loads.push(n); return new Uint8Array([137, 80, 78, 71]); });
  const img = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { decode });
  assert.ok(img && img.width === 1 && img.height === 2 && img.colors, 'a color32 the upload path reads');
  assert.equal(img.colors[0], 255, 'row 0 is still the red (top) row - the loose PNG keeps its rows');
  const again = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { decode });
  assert.equal(again, img, 'cached per name');
  assert.equal(decodes, 1); assert.equal(loads.length, 1);
  assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_0-1_Iron', { decode }), null, 'a name nothing carries');
  assert.equal(loads.length, 1, 'and a miss does not load');
  clearDiverseWeaponsSources();
  // BOTH DOORS behind the one ask, this mod's first
  const a = src('src/combat/diverseWeaponsAssets.js');
  assert.match(a, /return \(await diverseWeaponsImage\(name\)\) \?\? \(await weaponWidgetImage\(name\)\) \?\? null;/);
});

// ── the preset ────────────────────────────────────────────────────────

test('DW1: the Weapon Widget preset the bundle ships, restated exactly, laid over the player’s settings while the switch is on', () => {
  const json = JSON.parse(src('vendor/diverse-weapons/weapon-widget-preset.json'));
  assert.equal(json.Title, 'Diverse Weapons'); assert.equal(json.Description, 'Recommended settings for DW');
  assert.deepEqual(DIVERSE_WEAPONS_WIDGET_PRESET, json.Values, 'the restatement IS the JSON');
  const flat = diverseWeaponsWidgetPreset();
  assert.equal(Object.keys(flat).length, 38, 'every one of the preset’s 38 keys is a declared Weapon Widget key');
  assert.equal(flat['Modules.TrueTextureSize'], true); assert.equal(flat['Modules.DoubleScaleTextures'], true);
  assert.equal(flat['TrueTextureSize.TextureScaleFactor'], 1); assert.equal(flat['Bob.Length'], 142);
  assert.equal(flat['Swings.VanillaRecoveryOverride'], false, '"False" is false - not a non-empty string');
  assert.equal(flat['Miscellaneous.MirrorBows'], false);
  assert.equal(flat.Enabled, undefined, 'Weapon Widget’s own switch is not in the preset');
  // the overlay
  const mine = { Enabled: true, 'Modules.Inertia': false, 'Bob.Length': 100, 'Modules.TrueTextureSize': false };
  assert.equal(withDiverseWeaponsPreset(mine, false), mine, 'off: the player’s object, untouched');
  const on = withDiverseWeaponsPreset(mine, true);
  assert.equal(on['Modules.Inertia'], true); assert.equal(on['Bob.Length'], 142); assert.equal(on['Modules.TrueTextureSize'], true);
  assert.equal(on.Enabled, true, 'never touched');
  assert.equal(mine['Bob.Length'], 100, 'and the player’s values are still theirs underneath');
  // through the reader the clone actually uses
  _resetModSettings();
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', false);
  assert.equal(readWidgetSettings().trueSize, false, 'the preset off: Weapon Widget\'s own store');
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', true);
  const r = readWidgetSettings();
  assert.equal(r.trueSize, true); assert.equal(r.doubleScale, true); assert.equal(r.inertia, true); assert.equal(r.bobLength, 1.42);
  assert.equal(modSetting('weapon-widget', 'Modules.TrueTextureSize'), false, 'the Weapon Widget store was not written');
  _resetModSettings();
  // flattenModPreset drops what the vendor does not declare rather than inventing a switch
  assert.deepEqual(flattenModPreset('weapon-widget', { Modules: { Swings: 'True', NotAKey: 'True' }, Nope: { X: '1' } }), { 'Modules.Swings': true });
  assert.deepEqual(flattenModPreset('no-such-vendor', { Modules: { Swings: 'True' } }), {});
});

// ── the wiring ────────────────────────────────────────────────────────

test('DW1: the pick reaches the door at BOTH of its sites, the credits name the mod, and the vendor record is whole', () => {
  for (const f of ['src/scenes/dataSource.js', 'src/scenes/shared.js']) {
    assert.match(src(f), /setDiverseWeaponsSources\(names, loadTextureFile\);/, `${f} fans the pick out to the door`);
  }
  assert.match(src('src/scenes/dataSource.js'), /<b>Diverse Weapons<\/b>: its sprites ship\s+with the port; a folder holding a newer version's <b>\.dfmod<\/b>/, 'and the pick says so (DW2: the shipped set, the attached one winning)');
  const credits = src('src/ui/credits.js');
  assert.match(credits, /title: 'Diverse Weapons',\s*\n\s*version: '1\.7\.3',\s*\n\s*author: 'RealAKP',/);
  assert.match(credits, /vendor: Object\.freeze\(\['diverse-weapons'\]\),/);
  for (const f of ['README.md', 'DiverseWeaponsMain.cs', 'diverse-weapons.dfmod.json', 'weapon-widget-preset.json', 'Readme.txt']) {
    assert.ok(existsSync(new URL(`../vendor/diverse-weapons/${f}`, import.meta.url)), `vendor/diverse-weapons/${f}`);
  }
  const manifest = JSON.parse(src('vendor/diverse-weapons/diverse-weapons.dfmod.json'));
  assert.equal(manifest.ModVersion, DIVERSE_WEAPONS_MOD.version); assert.equal(manifest.ModAuthor, DIVERSE_WEAPONS_MOD.author);
  assert.equal(manifest.Files.length, 12937, 'the script, the manifest, the preset, and 12,934 textures');
  assert.ok(manifest.Files.some((f) => f.endsWith('DiverseWeaponsMain.cs')));
});
