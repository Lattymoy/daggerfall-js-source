// DW3 - DIVERSE WEAPONS' ICONS, AND THE DYE IN THE ASK (2026-09-23).
// The mod ships its inventory (233) and paper-doll (234) weapon icons in
// every metal and the Wabbajack's two (432/433); DFU finds them by the
// item's dye - GetItemImage asks TryImportTexture(archive, record, 0,
// item.dyeColor) (ItemHelper.cs:458) and GetName spells the dye into the
// name (TextureReplacement.cs:725-735), every dye but Unchanged, which is
// 18 and so is Silver. The port's replacement key dropped the dye, and
// none of its three icon doors carried one. Pins: GetName's dye arm and
// the names DFU prints, the key with the dye in it (a pack's two dyes no
// longer collide), DaggerfallUnityItem.dyeColor as the port's items
// carry it (the four writers), the registration off the shipped index
// behind the mod's switch, the preload's lanes, the DOM door and the
// classic list drawer executed by dye, the paper doll's arm by source,
// and the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DYE_COLORS, DYE_NAMES, dyeToken } from '../src/characters/dyes.js';
import { itemDyeColor, armorDyeColor } from '../src/systems/itemDye.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import {
  textureKey, textureEntry, setTextureReplacements, clearTextureReplacements, hasTextureReplacement, decodedTexture, decodedTextureTopDown,
  addVendorTextures, clearVendorTextures, vendorTextureCount, preloadTextureArchive, preloadTextureRecord, PRELOAD_CONCURRENCY,
} from '../src/systems/textureReplacement.js';
import { setValue } from '../src/systems/settings.js';
import { diverseWeaponsIconEntries, installDiverseWeaponsIcons, _resetDiverseWeaponsIcons, ICON_ARCHIVES } from '../src/combat/diverseWeaponsIcons.js';
import { hasDiverseWeaponsSprite, DIVERSE_WEAPONS_SPRITE_COUNT } from '../src/combat/diverseWeaponsAssets.js';
import { DIVERSE_WEAPONS_STEMS, DIVERSE_WEAPONS_BARE } from '../src/combat/diverseWeaponsIndex.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { makeIconDrawer } from '../src/ui/itemScroller.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const on = () => setValue('Enhancements', 'AssetInjection', 'True');

/** A top-down 2x2 raster whose rows differ, so a flip shows. */
const topDown = () => ({ width: 2, height: 2, data: new Uint8Array([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]) });

test('DW3 law: GetName\'s dye arm - `_<Dye>` for every dye but Unchanged, and Unchanged IS 18, so a silver weapon asks by the bare name; the names are the enum\'s', () => {
  assert.equal(dyeToken(DYE_COLORS.Iron), 'Iron');
  assert.equal(dyeToken(DYE_COLORS.Daedric), 'Daedric');
  assert.equal(dyeToken(DYE_COLORS.Blue), 'Blue');
  assert.equal(dyeToken(DYE_COLORS.DarkBrown), 'DarkBrown', 'the C# name, not a display name');
  assert.equal(dyeToken(DYE_COLORS.Unchanged), '', 'TextureReplacement.cs:729: `if (dye != DyeColors.Unchanged)`');
  assert.equal(dyeToken(DYE_COLORS.Silver), '', 'Silver = 18 = Unchanged: never printed');
  assert.equal(dyeToken(null), ''); assert.equal(dyeToken(undefined), ''); assert.equal(dyeToken(''), '');
  assert.equal(dyeToken('Iron'), 'Iron', 'a name read off a file is kept');
  assert.equal(dyeToken(12), '12', 'an unnamed value prints as C# would print it');
  assert.equal(DYE_NAMES[18], 'Silver'); assert.equal(DYE_NAMES[15], 'Iron'); assert.equal(DYE_NAMES[25], 'Daedric'); assert.equal(DYE_NAMES[0], 'Blue');
  assert.equal(Object.keys(DYE_NAMES).length, 20, 'ten clothing dyes, ten metals');
  // the key: archive_record-frame[_dye][_map] - GetName's order
  assert.equal(textureKey(233, 5, 0, 'Albedo', DYE_COLORS.Iron), '233_5-0_Iron');
  assert.equal(textureKey(233, 5, 0, 'Normal', DYE_COLORS.Iron), '233_5-0_Iron_Normal', 'the dye before the map');
  assert.equal(textureKey(233, 5, 0, 'Albedo', DYE_COLORS.Silver), '233_5-0');
  assert.equal(textureKey(233, 5, 0), '233_5-0', 'no dye: the key it always was');
  assert.equal(textureKey(233, 5, 0, 'Albedo', 'Elven'), '233_5-0_Elven');
});

test('DW3 key: a pack\'s two dyes of one record are two entries now (they collided on one), each answering its own ask and neither the bare one', async () => {
  on(); clearTextureReplacements(); clearVendorTextures();
  try {
    assert.equal(textureEntry('233_5-0_Iron.png').dye, 'Iron');
    assert.equal(setTextureReplacements(['233_5-0_Iron.png', '233_5-0_Daedric.png', '233_6-0.png'], async () => new Uint8Array([1])), 3, 'three entries, not two');
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', DYE_COLORS.Iron), true);
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', DYE_COLORS.Daedric), true);
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', DYE_COLORS.Steel), false, 'no Steel file: no bare fallback (TryImportTexture asks once, by the dyed name)');
    assert.equal(hasTextureReplacement(233, 5, 0), false, 'the bare ask finds no bare file');
    assert.equal(hasTextureReplacement(233, 6, 0, 'Albedo', DYE_COLORS.Silver), true, 'a silver weapon asks bare, and the bare file answers');
    assert.equal(hasTextureReplacement(233, 6, 0, 'Albedo', DYE_COLORS.Iron), false, 'a bare file does not answer a dyed ask');
    let n = 0;
    const decode = async () => { n++; const d = topDown(); d.data[0] = 10 + n; return d; };
    assert.equal(await preloadTextureArchive(233, { decode }), 3);
    const iron = decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Iron), daedric = decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Daedric);
    assert.ok(iron && daedric && iron !== daedric, 'two textures');
    assert.notEqual(iron.colors[8], daedric.colors[8], 'and not the same pixels');
    assert.equal(decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Steel), null);
    const td = decodedTextureTopDown(233, 5, 0, 'Albedo', DYE_COLORS.Iron);
    assert.deepEqual([td.width, td.height], [2, 2]);
    assert.deepEqual([...td.rgba].slice(0, 4), [...iron.colors].slice(8, 12), 'top-down: the doll\'s row 0 is color32\'s last row');
    assert.equal(decodedTextureTopDown(233, 5, 0, 'Albedo', DYE_COLORS.Steel), null);
  } finally { clearTextureReplacements(); clearVendorTextures(); }
});

test('DW3 law: DaggerfallUnityItem.dyeColor as the port\'s items carry it - a weapon\'s by its metal, an armor\'s by its material, clothing\'s its dye, an artifact\'s Unchanged, anything else Unchanged', () => {
  assert.equal(itemDyeColor({ group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Iron, dyeColor: DYE_COLORS.Iron }), DYE_COLORS.Iron, 'the field CreateWeapon wrote (ItemBuilder.cs:412)');
  assert.equal(itemDyeColor({ group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Daedric }), DYE_COLORS.Daedric, 'derived when the field is missing (a save from before the field)');
  assert.equal(itemDyeColor({ group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Silver }), DYE_COLORS.Silver, '18 - the bare name');
  assert.equal(itemDyeColor({ group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Daedric, dyeColor: DYE_COLORS.Daedric, artifact: true }), DYE_COLORS.Unchanged, 'SetArtifact :611 is the last writer');
  assert.equal(itemDyeColor({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Elven }), DYE_COLORS.Elven, 'CreateArmor :510');
  assert.equal(itemDyeColor({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Leather }), DYE_COLORS.Unchanged, 'GetArmorDyeColor\'s default');
  assert.equal(itemDyeColor({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Chain }), DYE_COLORS.Unchanged);
  assert.equal(itemDyeColor({ group: 'MensClothing', templateIndex: 200, dye: DYE_COLORS.Red }), DYE_COLORS.Red);
  assert.equal(itemDyeColor({ group: 'WomensClothing', templateIndex: 180 }), DYE_COLORS.Unchanged, 'SetItem :559');
  assert.equal(itemDyeColor({ group: 'Books', templateIndex: 277 }), DYE_COLORS.Unchanged);
  assert.equal(itemDyeColor(null), DYE_COLORS.Unchanged);
  // GetArmorDyeColor, cell for cell
  const M = ARMOR_MATERIAL, D = DYE_COLORS;
  assert.deepEqual([M.Iron, M.Steel, M.Silver, M.Elven, M.Dwarven, M.Mithril, M.Adamantium, M.Ebony, M.Orcish, M.Daedric].map(armorDyeColor),
    [D.Iron, D.Steel, D.Silver, D.Elven, D.Dwarven, D.Mithril, D.Adamantium, D.Ebony, D.Orcish, D.Daedric]);
  // and the image carries it (GetItemImage :402 reads it first)
  assert.deepEqual(inventoryItemImage({ group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Iron, dyeColor: DYE_COLORS.Iron }), { archive: 234, record: 5, dye: DYE_COLORS.Iron });
  assert.equal(inventoryItemImage({ group: 'Books', templateIndex: 277 }).dye, DYE_COLORS.Unchanged);
});

test('DW3 registration: every icon the shipped index names, as a vendor entry by its dye (the bare stem for Unchanged), behind the mod\'s switch - decoded once, answering only while on', async () => {
  const entries = diverseWeaponsIconEntries();
  assert.ok(entries.length > 500 && entries.length <= 561, `${entries.length}: the 561 shipped icons on 233/234/432/433, less the Silver-named`);
  assert.deepEqual([...new Set(entries.map((e) => e.archive))].sort(), [233, 234, 432, 433]);
  for (const e of entries) {
    assert.ok(hasDiverseWeaponsSprite(e.fileName), e.fileName);
    assert.equal(e.frame, 0);
    if (e.dye === null) assert.ok(!/_[A-Za-z]+$/.test(e.fileName), 'a bare stem has no suffix');
    else assert.equal(e.fileName, `${e.archive}_${e.record}-0_${DYE_NAMES[e.dye]}`, 'a dyed one spells its dye as GetName would');
  }
  const iconStems = Object.entries(DIVERSE_WEAPONS_STEMS).filter(([k]) => /^(233|234|432|433)_/.test(k));
  const silverNamed = iconStems.filter(([, b]) => b & (1 << 2)).length;
  assert.equal(entries.length, iconStems.reduce((n, [, b]) => n + (b.toString(2).split('1').length - 1), 0) - silverNamed, 'nothing dropped but the Silver-named files, nothing invented');
  assert.ok(silverNamed > 0, 'the mod does ship some `_Silver` icons; keyed by their dye they would be the bare key');
  const rri = Object.entries(DIVERSE_WEAPONS_STEMS).filter(([k]) => /^(513|514)_/.test(k)).reduce((n, [, b]) => n + (b.toString(2).split('1').length - 1), 0);
  assert.equal(rri, 40, 'Roleplay & Realism: Items\' two archives are in the index and not registered - no template here draws them');
  assert.deepEqual([...ICON_ARCHIVES], [233, 234, 432, 433]);
  assert.ok(entries.some((e) => e.archive === 432 && e.record === 25 && e.dye === null), 'the Wabbajack\'s icon is bare - a minted artifact\'s dye is Unchanged');
  assert.ok(!entries.some((e) => e.dye === DYE_COLORS.Silver), 'no Silver entries: they could never be asked (DYE_NAMES)');
  assert.ok(iconStems.filter(([, b]) => b & DIVERSE_WEAPONS_BARE).length >= 50, 'and ships the bare stem for most: the name a silver weapon asks by');
  assert.ok(DIVERSE_WEAPONS_SPRITE_COUNT > entries.length);

  _resetModSettings(); clearVendorTextures(); _resetDiverseWeaponsIcons();
  try {
    const loads = [];
    let inFlight = 0, most = 0;
    const fetchBytes = async (name) => { loads.push(name); inFlight++; most = Math.max(most, inFlight); await Promise.resolve(); await Promise.resolve(); inFlight--; return new Uint8Array([1]); };
    assert.equal(installDiverseWeaponsIcons({ fetchBytes }), entries.length);
    assert.equal(installDiverseWeaponsIcons({ fetchBytes }), 0, 'once');
    assert.equal(vendorTextureCount(), entries.length);
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', DYE_COLORS.Iron), true, 'on by default (MO1)');
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', DYE_COLORS.Silver), true, 'the bare stem answers the silver ask');
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', 'Glass'), false);
    setModSetting('diverse-weapons', 'Enabled', false);
    assert.equal(hasTextureReplacement(233, 5, 0, 'Albedo', DYE_COLORS.Iron), false, 'the gate, read at lookup');
    setModSetting('diverse-weapons', 'Enabled', true);
    // AUDIT-DW F1: the icons are LAZY - the archive's preload fetches none
    // of them (it used to fetch all 280 before the first classic icon could
    // draw); a record decodes when an item wearing it is drawn
    assert.equal(await preloadTextureArchive(233, { decode: async () => topDown() }), 0, 'the archive preload skips lazy entries');
    assert.equal(loads.length, 0);
    assert.equal(decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Iron), null, 'nothing decoded yet');
    const decode = async () => topDown();
    const [a, b] = await Promise.all([preloadTextureRecord(233, 5, 0, 'Albedo', DYE_COLORS.Iron, { decode }), preloadTextureRecord(233, 5, 0, 'Albedo', DYE_COLORS.Iron, { decode })]);
    assert.ok(a?.colors && a === b, 'one record, one fetch shared by the asks in flight');
    assert.deepEqual(loads, ['233_5-0_Iron'], 'the one file');
    const iron = decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Iron);
    assert.equal(iron, a, 'decoded, in color32 order');
    assert.equal(await preloadTextureRecord(233, 5, 0, 'Albedo', DYE_COLORS.Iron, { decode }), iron, 'idempotent');
    assert.equal((await preloadTextureRecord(233, 5, 0, 'Albedo', DYE_COLORS.Silver, { decode }))?.width, 2, 'the bare one too');
    assert.equal(await preloadTextureRecord(233, 5, 0, 'Albedo', 'Glass', { decode }), null, 'nothing registered: null, no fetch');
    assert.equal(loads.length, 2);
    setModSetting('diverse-weapons', 'Enabled', false);
    assert.equal(decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Iron), null, 'off: the classic draws, the decode is kept');
    assert.equal(await preloadTextureRecord(233, 5, 0, 'Albedo', DYE_COLORS.Daedric, { decode }), null, 'off: a gated-off icon costs no fetch');
    assert.equal(loads.length, 2);
    setModSetting('diverse-weapons', 'Enabled', true);
    assert.equal(decodedTexture(233, 5, 0, 'Albedo', DYE_COLORS.Iron), iron, 'on again: the same texture, no second fetch');
    // a pack's (non-lazy) entries still preload with the archive, in lanes
    on(); clearTextureReplacements();
    setTextureReplacements(['233_7-0_Iron.png', '233_7-0_Steel.png', '233_7-0_Elven.png'], async (n) => { loads.push(n); inFlight++; most = Math.max(most, inFlight); await Promise.resolve(); inFlight--; return new Uint8Array([1]); });
    assert.equal(await preloadTextureArchive(233, { decode }), 3);
    assert.ok(most > 1 && most <= PRELOAD_CONCURRENCY, `${most} in flight: lanes, bounded`);
    clearTextureReplacements();
  } finally { _resetModSettings(); clearVendorTextures(); _resetDiverseWeaponsIcons(); }
});

test('DW3 DOM door: requestIcon by dye - the replacement drawn as it is, keyed apart per dye, the bare ask for a silver weapon, and nothing for a dye the set lacks', async () => {
  _resetModSettings(); clearVendorTextures(); _resetDiverseWeaponsIcons();
  const { requestIcon, loadIcon } = await import('../src/ui/textureCanvas.js');
  const puts = [];
  const canvasStub = () => ({
    width: 0, height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img) => { puts.push(img); },
      drawImage: () => {}, imageSmoothingEnabled: true,
    }),
    toDataURL: () => `data:image/png;base64,STUB${puts.length}`,
  });
  const hadDocument = globalThis.document;
  globalThis.document = { createElement: canvasStub };
  try {
    const loads = [];
    installDiverseWeaponsIcons({ fetchBytes: async (n) => { loads.push(n); return new Uint8Array([1]); } });
    // AUDIT-DW F1: the door decodes the record it draws (preloadTextureRecord);
    // node has no PNG decoder, so the records this pin draws are decoded
    // here with one, and the door finds them - the archive's preload
    // fetches none (lazy)
    const decode = async () => topDown();
    for (const dye of [DYE_COLORS.Iron, DYE_COLORS.Daedric, DYE_COLORS.Silver]) await preloadTextureRecord(233, 5, 0, 'Albedo', dye, { decode });
    assert.deepEqual(loads, ['233_5-0_Iron', '233_5-0_Daedric', '233_5-0'], 'three records, three fetches, nothing else');
    assert.equal(requestIcon(233, 5, { scale: 1, dye: DYE_COLORS.Iron }), null, 'cold, as every requestIcon is');
    const iron = await loadIcon(233, 5, { scale: 1, dye: DYE_COLORS.Iron });
    assert.match(iron ?? '', /^data:image\/png;base64,STUB/, 'the replacement, drawn');
    assert.equal(requestIcon(233, 5, { scale: 1, dye: DYE_COLORS.Iron }), iron, 'warm on the next repaint');
    assert.deepEqual([...puts.at(-1).data.slice(0, 4)], [1, 1, 1, 255], 'the canvas\'s top row is the PNG\'s top row (the color32 flip undone)');
    const daedric = await loadIcon(233, 5, { scale: 1, dye: DYE_COLORS.Daedric });
    assert.ok(daedric && daedric !== iron, 'a second key for the second dye');
    const silver = await loadIcon(233, 5, { scale: 1, dye: DYE_COLORS.Silver });
    assert.ok(silver && silver !== daedric, 'the bare stem answers the silver ask');
    assert.equal(await loadIcon(233, 5, { scale: 1, dye: 'Glass' }), null, 'no such file: the classic arm, which has no ARENA2 here');
    assert.equal(loads.length, 3, 'the door fetched nothing the pin had not: a record decodes once');
  } finally { globalThis.document = hadDocument; _resetModSettings(); clearVendorTextures(); _resetDiverseWeaponsIcons(); }
});

test('DW3 GL door: the list drawer asks the pipeline by dye and reads back the variant the upload answered - an Iron dagger and a Daedric one two textures, a silver one the shared #ui', async () => {
  const ups = [];
  const textures = new Map();
  const icons = {
    getTexture: async () => ({ recordCount: 30, getSize: () => ({ width: 8, height: 8 }) }),
    uploadRecord: (archive, record, opts) => { ups.push({ archive, record, ...opts }); const t = dyeToken(opts.dye); const v = t === 'Iron' || t === 'Daedric' ? `#ui_${t}` : '#ui'; textures.set(`${archive}_${record}${v}`, `gl:${v}`); return v; },
    textures,
  };
  const drawer = makeIconDrawer(icons);
  const draws = [];
  const renderer = { drawScreenQuad: (tex) => draws.push(tex) };
  const m = { s: 1, ox: 0, oy: 0 };
  const iron = { group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Iron, dyeColor: DYE_COLORS.Iron };
  const daedric = { group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Daedric, dyeColor: DYE_COLORS.Daedric };
  const silver = { group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Silver, dyeColor: DYE_COLORS.Silver };
  for (const it of [iron, daedric, silver]) drawer(renderer, m, it, [0, 0, 100, 100], 0);   // cold: warms three keys
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.deepEqual(ups.map((u) => [u.archive, u.record, u.dye, u.mips, u.removeMask]), [[234, 5, DYE_COLORS.Iron, false, true], [234, 5, DYE_COLORS.Daedric, false, true], [234, 5, DYE_COLORS.Silver, false, true]], 'three asks, by dye (GetItemImage :458), the UI variant with the mask stripped (HM1)');
  assert.deepEqual([...drawer._warm], ['234_5_Iron', '234_5_Daedric', '234_5'], 'the warm key carries the dye; the silver one is the bare key');
  for (const it of [iron, daedric, silver]) assert.ok(drawer(renderer, m, it, [0, 0, 100, 100], 0));
  assert.deepEqual(draws, ['gl:#ui_Iron', 'gl:#ui_Daedric', 'gl:#ui'], 'each drawn from the variant its upload answered');
});

test('DW3 wiring: the paper doll asks by item.dyeColor and blits an imported texture as it is; the DOM callers pass the dye; the install rides the scene boot; the drawers and the pipeline forward it', () => {
  const doll = rd('src/ui/paperDoll.js');
  assert.match(doll, /async function loadRecord\(archive, record, getTexture, dye = null\) \{/);
  assert.match(doll, /const swap = decodedTextureTopDown\(archive, record, 0, 'Albedo', dye\);\n\s+if \(swap\) \{\n[\s\S]{0,900}?return \{ bmp: \{ width: swap\.width, height: swap\.height, data: null, rgba: swap\.rgba \}, off, mask \};/, 'the import arm first, in the RGBA shape the vendor arm blits - no ChangeDye (RRI1 adds the mask beside it)');
  assert.match(doll, /loadRecord\(res\.archive, res\.record, deps\.getTexture, itemDyeColor\(it\)\)/, 'the item\'s own dyeColor, not the remap\'s (an artifact\'s is Unchanged)');
  assert.match(doll, /loadRecord\(t\.playerTextureArchive \+ \(raceByKey\(deps\.race\)\?\.morphologyIndex \?\? HUMAN_MORPHOLOGY\), t\.playerTextureRecord, deps\.getTexture, itemDyeColor\(it\)\)/, 'the cloak interior too');
  // DISC24-B: the pack's tile and detail ask through its one picture door (linePictureUrl), and the door asks by the dye
  assert.match(rd('src/ui/enhancedInventory.js'), /if \(line\.image\) return requestIcon\(line\.image\.archive, line\.image\.record, \{ scale, dye: line\.image\.dye, onReady \}\);/);
  assert.match(rd('src/ui/enhancedInventory.js'), /linePictureUrl\(line, \{ scale: 2, onReady: render \}\)/);
  assert.match(rd('src/ui/enhancedInventory.js'), /linePictureUrl\(line, \{ scale: 4, onReady: render \}\)/);
  assert.match(rd('src/ui/enhancedHud.js'), /requestIcon\(image\.archive, image\.record, \{ scale: 2, dye: image\.dye, onReady:/);
  assert.match(rd('src/scenes/shared.js'), /installDiverseWeaponsIcons\(\);[^\n]*\n\s+installRoleplayRealismItems\(\);[^\n]*\n\s+installRoleplayRealism\(\);[^\n]*\n\s+const textures = storedTextureNames\(\)/, 'installed at the scene boot, before the archives load - not at worldTick\'s module scope (a TDZ through the cycle)');
  assert.ok(!/installDiverseWeaponsIcons/.test(rd('src/systems/worldTick.js')));
  for (const f of ['src/ui/itemScroller.js', 'src/ui/nativeInventory.js']) {
    assert.match(rd(f), /icons\.uploadRecord\(img\.archive, img\.record, \{ mips: false, removeMask: true, dye: img\.dye \}\)/, f);
    assert.match(rd(f), /sizes\.set\(key, tex\.getSize\(img\.record\)\);/, `${f}: the CLASSIC record's size (ItemListScroller.cs:440-441)`);
  }
  const pipe = rd('src/scenes/dataPipeline.js');
  assert.match(pipe, /const swap = decodedTexture\(archive, record, 0, 'Albedo', dye\);/);
  assert.match(pipe, /const variant = mips === false \? \(swap && token \? `#ui_\$\{token\}` : '#ui'\) : undefined;/);
  assert.match(pipe, /return variant;/);
  assert.match(rd('src/systems/itemTemplates.js'), /return \{ archive, record, dye: itemDyeColor\(item\) \};/);
  assert.match(rd('src/systems/textureReplacement.js'), /const lane = async \(\) => \{ while \(next < todo\.length\) await one\(todo\[next\+\+\]\); \};/, 'the preload runs in lanes');
  assert.equal(PRELOAD_CONCURRENCY, 8);
});
