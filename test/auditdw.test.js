// AUDIT-DW (2026-09-23, Mac: "a proper audit of your previous work") -
// the audit of DW1 (the law and the two first-person lanes), DW2 (the
// shipped sprites) and DW3 (the icons and the dye in the ask), three
// lenses: DFU's law re-read (FPSWeapon.cs, WeaponBasics.cs, ItemHelper.cs,
// TextureReplacement.cs), the port's own seams (the rig, the widget
// clone, the three icon doors, the pipeline, the boot order), and the
// player's view (what the first draw costs on a site where every sprite
// is a fetch). Four findings, three paid and one named:
//   F1 - the icon door decoded all 280 of an archive's icons before the
//        first classic icon could draw; a record decodes when drawn.
//   F2 - a weapon's custom frames were fetched one after the other, the
//        weapon invisible for the run; they go out together.
//   F3 - a plain name answering through the `w_` fall-through was drawn
//        into the doubled box; only a `w_` texture is.
//   F4 - DFU keeps the first template's custom frames within a class and
//        metal (its cache slot); the port keys by the asked name - named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { customFrames, WEAPON_TYPES, STATE_INDEX, GENERAL_ANIMS } from '../src/combat/fpsWeapon.js';
import { makeIconDrawer } from '../src/ui/itemScroller.js';
import { createWeaponWidget, readWidgetSettings, WEAPON_WIDGET_VENDOR } from '../src/combat/weaponWidget.js';
import { createWeaponMachine, machineStep } from '../src/characters/weaponStates.js';
import { WEAPON_MATERIALS, WEAPONS } from '../src/characters/weapons.js';
import { modSettingsOf, _resetModSettings } from '../src/systems/modSettings.js';
import { DYE_COLORS } from '../src/characters/dyes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('AUDIT-DW F2: a weapon atlas\'s custom frames are asked TOGETHER - every ask is out before the first answers, a rejected ask is that frame\'s miss, the answer is indexed [record][frame]', async () => {
  const asked = [];
  let resolveAll = null;
  const gate = new Promise((r) => { resolveAll = r; });
  const ask = (name) => { asked.push(name); if (name.endsWith('_1-1_Iron')) return Promise.reject(new Error('no')); return gate.then(() => (name.endsWith('_0-0_Iron') ? { width: 1, height: 1, name } : null)); };
  const shape = { recordCount: 3, getFrameCount: (r) => [1, 2, 3][r] };
  const p = customFrames('LONGSWORD.CIF', 'Iron', shape, ask);
  await Promise.resolve();
  assert.deepEqual(asked, ['LONGSWORD.CIF_0-0_Iron', 'LONGSWORD.CIF_1-0_Iron', 'LONGSWORD.CIF_1-1_Iron', 'LONGSWORD.CIF_2-0_Iron', 'LONGSWORD.CIF_2-1_Iron', 'LONGSWORD.CIF_2-2_Iron'], 'six asks, all out, none answered yet');
  resolveAll();
  const customs = await p;
  assert.equal(customs.length, 3);
  assert.deepEqual(customs.map((r) => r.length), [1, 2, 3]);
  assert.equal(customs[0][0].name, 'LONGSWORD.CIF_0-0_Iron', 'the hit');
  assert.equal(customs[1][1], null, 'the rejected ask is a miss, not a throw');
  assert.equal(customs[2][2], null);
  const bare = await customFrames('WEAPON10.CIF', null, { recordCount: 1, getFrameCount: () => 1 }, (n) => { asked.push(n); return null; });
  assert.equal(asked.at(-1), 'WEAPON10.CIF_0-0', 'MetalTypes.None adds nothing (bare hands)');
  assert.deepEqual(bare, [[null]]);
  const fp = rd('src/combat/fpsWeapon.js');
  assert.match(fp, /const customs = await customFrames\(askName, metal, cif, customImage\);/, 'the loader takes the batch');
  assert.ok(!/const custom = await customWeaponImage\(name\);/.test(fp), 'and no frame is awaited on its own');
  assert.match(fp, /await Promise\.all\(asks\);/);
});

test('AUDIT-DW F1: the list drawer decodes THE RECORD it draws before the upload - getTexture, then preloadRecord(archive, record, dye), then uploadRecord - and a host without the seam still draws', async () => {
  const calls = [];
  const textures = new Map();
  const icons = {
    getTexture: async () => { calls.push('getTexture'); return { recordCount: 30, getSize: () => ({ width: 8, height: 8 }) }; },
    preloadRecord: async (a, r, dye) => { calls.push(`preloadRecord ${a} ${r} ${dye}`); await Promise.resolve(); },
    uploadRecord: (a, r, opts) => { calls.push(`uploadRecord ${a} ${r} ${opts.dye}`); textures.set(`${a}_${r}#ui_Iron`, 'gl'); return '#ui_Iron'; },
    textures,
  };
  const drawer = makeIconDrawer(icons);
  const draws = [];
  const renderer = { drawScreenQuad: (tex) => draws.push(tex) };
  const iron = { group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Iron, dyeColor: DYE_COLORS.Iron };
  drawer(renderer, { s: 1, ox: 0, oy: 0 }, iron, [0, 0, 100, 100], 0);
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.deepEqual(calls, ['getTexture', `preloadRecord 234 5 ${DYE_COLORS.Iron}`, `uploadRecord 234 5 ${DYE_COLORS.Iron}`], 'the record\'s replacement is decoded before it is uploaded, and nothing else\'s');
  assert.ok(drawer(renderer, { s: 1, ox: 0, oy: 0 }, iron, [0, 0, 100, 100], 0));
  assert.deepEqual(draws, ['gl']);
  // a host whose icons object predates the seam (the trade window's test double) is not broken by it
  const bare = { getTexture: icons.getTexture, uploadRecord: (a, r) => { textures.set(`${a}_${r}#ui`, 'gl2'); return '#ui'; }, textures };
  const d2 = makeIconDrawer(bare);
  d2(renderer, { s: 1, ox: 0, oy: 0 }, { group: 'Books', templateIndex: 277 }, [0, 0, 100, 100], 0);
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.ok(d2(renderer, { s: 1, ox: 0, oy: 0 }, { group: 'Books', templateIndex: 277 }, [0, 0, 100, 100], 0));
  // the same seam in the other three doors, by source
  for (const f of ['src/ui/itemScroller.js', 'src/ui/nativeInventory.js']) assert.match(rd(f), /await icons\.preloadRecord\?\.\(img\.archive, img\.record, img\.dye\);/, f);
  assert.match(rd('src/ui/textureCanvas.js'), /\? preloadTextureRecord\(archive, record, 0, 'Albedo', dye\)\.catch\(\(\) => null\)/, 'the DOM door');
  assert.match(rd('src/ui/paperDoll.js'), /await preloadTextureRecord\(archive, record, 0, 'Albedo', dye\);[^\n]*\n\s+const swap = decodedTextureTopDown/, 'the doll');
  assert.match(rd('src/scenes/dataPipeline.js'), /const preloadRecord = \(archive, record, dye = null\) => preloadTextureRecord\(archive, record, 0, 'Albedo', dye\)\.catch\(\(\) => null\);/, 'the pipeline hands it out');
  assert.match(rd('src/combat/diverseWeaponsIcons.js'), /gate: moddedWeaponHUDAnimsEnabled, lazy: true/, 'the mod\'s icons are lazy');
  assert.match(rd('src/systems/textureReplacement.js'), /entry\.archive === Number\(archive\) && !entry\.lazy && !_decoded\.has\(key\)/, 'and the archive preload skips them');
});

// ── the widget clone's bench, the WW1 suite's shape ───────────────────
function settingsOf(over = {}) {
  _resetModSettings();
  const base = modSettingsOf(WEAPON_WIDGET_VENDOR);
  return () => readWidgetSettings(() => ({ ...base, ...over }));
}
function artFor(weaponType, anims = GENERAL_ANIMS, { width = 100, height = 60 } = {}) {
  const records = [];
  for (let r = 0; r < 7; r++) records.push({ width, height, frames: Array.from({ length: r === 0 ? 1 : 5 }, (_, i) => `tex:${weaponType}:${r}:${i}`) });
  return { weaponType, anims, records };
}
function bench({ weapon = { templateIndex: WEAPONS.Longsword, group: 'Weapons', name: 'Longsword' }, weaponType = WEAPON_TYPES.LongBlade, over = {}, material = WEAPON_MATERIALS.Steel } = {}) {
  const widget = createWeaponWidget({ settings: settingsOf(over), audio: { playOneShot: () => {} }, rolls: () => 0, missEffect: null, envHit: null, handedness: () => false, bowDrawback: () => true });
  const machine = createWeaponMachine(false, false);
  const draws = [];
  const canvas = { width: 640, height: 400 };
  const renderer = { drawScreenQuad: (tex, rect, uv) => draws.push({ tex, rect: { ...rect }, uv: { ...uv } }), uploadTexture: () => 'up' };
  const ctx = {
    renderer, canvas, entity: null, art: artFor(weaponType, GENERAL_ANIMS), weapon, weaponType, material, machine, sheathed: false, usingRightHand: true,
    equipCountdown: 0, shown: true, castPlaying: false, spellArmed: false, thirdPerson: false, reach: 2.5,
    motion: { grounded: true, crouching: false, riding: false, standing: true, speedRatio: 1, baseSpeed: 4, localVel: [0, 0, 0] },
    look: [0, 0], swingHeld: false, cursorActive: false, camera: () => ({ pos: [0, 1, 0], forward: [0, 0, 1] }), activateStarted: () => false,
  };
  const frame = (dt = 0.05, liveSpeed = 50) => { machineStep(machine, dt, liveSpeed); widget.lateUpdate(dt, ctx); widget.draw(renderer, canvas); widget.endOfFrame(); };
  return { widget, ctx, draws, frame };
}

test('AUDIT-DW F3: under DoubleScaleTextures a `w_` hit draws into the doubled box and a PLAIN hit through the fall-through draws at its own size', () => {
  const b = bench({ over: { 'Modules.DoubleScaleTextures': true } });
  b.frame();
  const w = b.widget._w;
  assert.equal(w.weaponState, STATE_INDEX.Idle);
  const names = [...w.customCache.keys()];
  assert.ok(names.includes('w_LONGSWORD.CIF_0-0_Steel'), `asked by the w_ name (${names})`);
  // the w_ name misses, the plain one answers: NOT doubled
  w.customMisses.add('w_LONGSWORD.CIF_0-0_Steel');
  w.customCache.set('LONGSWORD.CIF_0-0_Steel', { tex: 'plain', width: 50, height: 40, doubled: false });
  b.frame();
  let d = b.draws.at(-1);
  assert.equal(d.tex, 'plain');
  assert.deepEqual([d.rect.w, d.rect.h], [100 * 2, 60 * 2], 'the plain texture into the CLASSIC record box, undoubled (x2 is the 640/320 screen scale; TrueTextureSize is the module that would draw it at its own 50x40)');
  // the w_ name answers: doubled, as the clone's IL has it
  w.customMisses.delete('w_LONGSWORD.CIF_0-0_Steel');
  w.customCache.set('w_LONGSWORD.CIF_0-0_Steel', { tex: 'double', width: 100, height: 80, doubled: true });
  b.frame();
  d = b.draws.at(-1);
  assert.equal(d.tex, 'double');
  assert.deepEqual([d.rect.w, d.rect.h], [100 * 2 * 2, 60 * 2 * 2], 'the double-scale texture into the DOUBLED classic box');
  // an entry from before the flag (no `doubled`) keeps the clone's own reading
  w.customCache.set('w_LONGSWORD.CIF_0-0_Steel', { tex: 'legacy', width: 100, height: 80 });
  b.frame();
  assert.deepEqual([b.draws.at(-1).rect.w, b.draws.at(-1).rect.h], [400, 240]);
  assert.match(rd('src/combat/weaponWidget.js'), /doubled: name\.startsWith\('w_'\)/);
  assert.match(rd('src/combat/weaponWidget.js'), /else if \(w\.s\.doubleScale && custom\.doubled !== false\) \{/);
});

test('AUDIT-DW F4 (named, not changed): DFU keeps the first template\'s custom frames within a class and metal; the port keys the atlas by the name it is asked by', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const key = `\$\{type\}:\$\{item\?\.material \?\? 0\}:\$\{thunderlock \? '' : atlasFileName\(item, WEAPON_FILE\[type\] \?\? ''\)\}`;/);
  assert.match(rig, /WHICH IS WHAT DFU DOES \(AUDIT-DW\n\s+\/\/ F4, a named departure\): FPSWeapon reloads its atlas only when\n\s+\/\/ WeaponType or MetalType change \(FPSWeapon\.cs:138\)/, 'the departure is named where the key is');
  assert.match(rd('bible/05-Combat/Diverse-Weapons.md'), /## AUDIT-DW/, 'and recorded');
});

test('AUDIT-DW: checked and standing - the shipped set, the index, the door order, the dye law, the install site; the suites and campaign the audit leaves behind', () => {
  // the attached bundle still answers first, the shipped set second, the miss third
  const door = rd('src/combat/diverseWeaponsAssets.js');
  assert.match(door, /const attached = _names\.length \? await attachedImage\(name, decode\) : null;/);
  assert.match(door, /if \(!hasDiverseWeaponsSprite\(name\) \|\| typeof fetchFn !== 'function'\) return null;/);
  // the icon install sits at the scene boot, after the survival pair and before the archives load
  assert.match(rd('src/scenes/shared.js'), /installDiverseWeaponsIcons\(\);[^\n]*\n\s+const textures = storedTextureNames\(\)/);
  // GetName's dye arm and its one exception, in one home
  assert.match(rd('src/characters/dyes.js'), /if \(!Number\.isFinite\(v\) \|\| v === DYE_COLORS\.Unchanged\) return '';/);
  // the records
  const testing = rd('bible/09-Testing/Testing.md');
  for (const f of ['dw1_diverseweapons.test.js', 'dw2_shipped.test.js', 'dw3_icons.test.js', 'unitybundleworker.test.js', 'auditdw.test.js']) assert.match(testing, new RegExp(`\\| ${f.replace('.', '\\.')} \\| \\d+ \\|`), f);
  assert.match(rd('bible/05-Combat/Diverse-Weapons.md'), /## AUDIT-DW \(2026-09-23\)/);
});
