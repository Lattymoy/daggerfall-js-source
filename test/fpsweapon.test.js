import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  WEAPON_TYPES, WEAPON_FILE, ALIGN, STATE_INDEX,
  MELEE_ANIMS, DAGGER_ANIMS, BOW_ANIMS, WERECREATURE_ANIMS, MAGIC_BATTLEAXE_ANIMS,
  getWeaponAnims, weaponTypeForItem, frameToColor32, drawFpsWeapon,
} from '../src/combat/fpsWeapon.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { DYE_COLORS } from '../src/characters/dyes.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { applyDyeToIndex, DYE_TARGETS } from '../src/characters/dyes.js';
import { weaponDyeColor, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';

// The TRUE classic FP weapons (pivot 2026-08-17): FPSWeapon /
// WeaponBasics / ConvertItemToAPIWeaponType verbatim, the CIF frames
// dyed and drawn on the 320x200 design surface.

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = ARENA2 ? false : 'ARENA2_PATH not set';

test('fpsweapon: template index -> animation set, verbatim (+ enchanted promotion)', () => {
  const T = WEAPON_TYPES, W = WEAPONS;
  assert.equal(weaponTypeForItem({ templateIndex: W.Dagger }), T.Dagger);
  assert.equal(weaponTypeForItem({ templateIndex: W.Katana }), T.LongBlade);
  assert.equal(weaponTypeForItem({ templateIndex: W.Saber }), T.LongBlade);
  assert.equal(weaponTypeForItem({ templateIndex: W.War_Axe }), T.Battleaxe);
  assert.equal(weaponTypeForItem({ templateIndex: W.Short_Bow }), T.Bow);
  assert.equal(weaponTypeForItem({ templateIndex: W.Long_Bow }), T.Bow);
  assert.equal(weaponTypeForItem({ templateIndex: W.Katana, enchantments: [{ type: 1, param: 5 }] }), T.LongBlade_Magic);
  assert.equal(weaponTypeForItem({ templateIndex: W.Battle_Axe, enchantments: [{ type: 1, param: 5 }] }), T.Battleaxe_Magic);
  assert.equal(weaponTypeForItem({ templateIndex: W.Short_Bow, enchantments: [{ type: 1, param: 5 }] }), T.Bow, 'no magic bow variant, verbatim');
  assert.equal(weaponTypeForItem(null), T.Melee, 'bare hands');
  assert.equal(weaponTypeForItem({ templateIndex: 300 }), T.None);
});

test('fpsweapon: the anim tables carry the verbatim rows', () => {
  // Melee: Right idle at 0.15, every strike Center.
  assert.equal(MELEE_ANIMS[STATE_INDEX.Idle].Offset, 0.15);
  assert.equal(MELEE_ANIMS[STATE_INDEX.StrikeDown].Alignment, ALIGN.Center);
  // Dagger: idle 0.04 Right; StrikeRight/DownRight Left-aligned.
  assert.equal(DAGGER_ANIMS[STATE_INDEX.Idle].Offset, 0.04);
  assert.equal(DAGGER_ANIMS[STATE_INDEX.StrikeRight].Alignment, ALIGN.Left);
  // MagicBattleAxe record shuffle: StrikeLeft rides record 4,
  // StrikeDownRight record 3 (verbatim WeaponBasics).
  assert.equal(MAGIC_BATTLEAXE_ANIMS[STATE_INDEX.StrikeLeft].Record, 4);
  assert.equal(MAGIC_BATTLEAXE_ANIMS[STATE_INDEX.StrikeDownRight].Record, 3);
  // Bow: record 0 everywhere; 7-frame draw states, 4-frame release.
  assert.ok(BOW_ANIMS.every((a) => a.Record === 0));
  assert.equal(BOW_ANIMS[STATE_INDEX.StrikeDown].NumFrames, 7);
  assert.equal(BOW_ANIMS[STATE_INDEX.StrikeUp].NumFrames, 4);
  // Werecreature strikes run at 20 fps.
  assert.equal(WERECREATURE_ANIMS[STATE_INDEX.StrikeDown].FramePerSecond, 20);
  // Routing.
  assert.equal(getWeaponAnims(WEAPON_TYPES.Battleaxe_Magic), MAGIC_BATTLEAXE_ANIMS);
  assert.equal(getWeaponAnims(WEAPON_TYPES.LongBlade), getWeaponAnims(WEAPON_TYPES.Mace), 'general set shared');
  // Filenames: magic variants + the melee/were files.
  assert.equal(WEAPON_FILE[WEAPON_TYPES.LongBlade_Magic], 'WEAPO104.CIF');
  assert.equal(WEAPON_FILE[WEAPON_TYPES.Melee], 'WEAPON10.CIF');
  assert.equal(WEAPON_FILE[WEAPON_TYPES.Werecreature], 'WEAPON11.CIF');
});

test('fpsweapon: frame bake dyes the 0x70 band and keeps index 0 transparent', () => {
  const palette = { get: (i) => ({ r: i, g: 0, b: 255 - i }) };   // identity-ish stub
  const bmp = { width: 3, height: 1, data: new Uint8Array([0, 0x70, 0x50]) };
  const c = frameToColor32(bmp, palette, DYE_COLORS.Iron);
  const u8 = new Uint8Array(c.colors.buffer);
  assert.equal(u8[3], 0, 'index 0 stays transparent');
  // Iron metal table[0] = 0x77: the band pixel reads palette 0x77.
  assert.equal(u8[4], 0x77);
  assert.equal(u8[7], 255);
  // Outside the band: unchanged.
  assert.equal(u8[8], 0x50);
});

test('fpsweapon: 320x200 placement math, verbatim FPSWeapon alignment', () => {
  const calls = [];
  const renderer = { drawScreenQuad: (tex, rect) => calls.push([tex, rect]) };
  const canvas = { width: 640, height: 400 };   // exact 2x of native
  const art = {
    weaponType: WEAPON_TYPES.Dagger,
    anims: DAGGER_ANIMS,
    records: [
      { width: 100, height: 80, frames: ['idle0'] },
      { width: 120, height: 90, frames: ['a', 'b', 'c', 'd', 'e'] },
      null, null,
      { width: 120, height: 90, frames: ['r0', 'r1', 'r2', 'r3', 'r4'] },
    ],
  };
  drawFpsWeapon(renderer, canvas, art, 'Idle', 0);
  let [tex, r] = calls.at(-1);
  assert.equal(tex, 'idle0');
  // Right at offset 0.04: x = 640 * 0.96 - 200 = 414.4; bottom anchor.
  assert.ok(Math.abs(r.x - 414.4) < 1e-9 && r.y === 240 && r.w === 200 && r.h === 160);
  // StrikeRight (Left-aligned, offset 0): record 4 frame 2.
  drawFpsWeapon(renderer, canvas, art, 'StrikeRight', 2);
  [tex, r] = calls.at(-1);
  assert.equal(tex, 'r2');
  assert.ok(r.x === 0 && r.y === 400 - 180 && r.w === 240 && r.h === 180);
});

test('fpsweapon: every mapped CIF satisfies its anim table on real data', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  for (const [type, fileName] of Object.entries(WEAPON_FILE)) {
    const path = join(ARENA2, fileName);
    assert.ok(existsSync(path), `${fileName} present in ARENA2`);
    const cif = new CifRciFile();
    cif.load(new Uint8Array(readFileSync(path)), fileName, pal);
    const anims = getWeaponAnims(Number(type));
    for (const [stateIdx, a] of anims.entries()) {
      const rec = Number(type) === WEAPON_TYPES.Bow ? 0 : a.Record;
      assert.ok(rec < cif.recordCount, `${fileName} has record ${rec}`);
      assert.ok(cif.getFrameCount(rec) >= a.NumFrames,
        `${fileName} r${rec} carries the ${a.NumFrames} frames state ${stateIdx} plays (has ${cif.getFrameCount(rec)})`);
      const size = cif.getSize(rec);
      assert.ok(size.width > 0 && size.height > 0 && size.width <= 320 && size.height <= 200,
        `${fileName} r${rec} fits the 320x200 design surface`);
    }
  }
});

test('fpsweapon: dye parity - Steel skips, Silver DYES through the aliased 18 (audit 2026-08-17)', () => {
  // DFU's DyeColors aliases Silver = SilverOrElven = Chain = Unchanged
  // = 18, and ChangeDye routes 18 into the SILVER metal table - so an
  // "Unchanged" short-circuit in the frame bake (which this module
  // used to carry) skipped the dye for every silver weapon. The
  // caller-guard is FPSWeapon's: Steel (and None) keep the files'
  // native colors; everything else dyes.
  assert.equal(weaponDyeColor(WEAPON_MATERIALS.Silver), 18);
  const silvered = applyDyeToIndex(0x75, weaponDyeColor(WEAPON_MATERIALS.Silver), DYE_TARGETS.WeaponsAndArmor);
  assert.notEqual(silvered, 0x75, 'a swatch-band index must remap under the Silver table');
  // frameToColor32: null dye = raw palette; Silver dye = changed pixels.
  const pal = { get: (i) => ({ r: i, g: 0, b: 0 }) };
  const bmp = { width: 2, height: 1, data: new Uint8Array([0x75, 0]) };
  const raw = new Uint8Array(frameToColor32(bmp, pal, null).colors.buffer);
  const dyed = new Uint8Array(frameToColor32(bmp, pal, weaponDyeColor(WEAPON_MATERIALS.Silver)).colors.buffer);
  assert.equal(raw[0], 0x75, 'null dye keeps the raw index through the palette');
  assert.equal(dyed[0], silvered, 'Silver dyes the band index');
  assert.equal(raw[7], 0, 'index 0 stays transparent either way');
});

test('fpsweapon: ToggleSheath verbatim - starts sheathed, the draw sound rule (audit 2026-08-17)', () => {
  const armed = new PlayerWeapon({});   // the interim Iron Dagger
  assert.equal(armed.sheathed, true, 'classic starts sheathed');
  assert.equal(armed.toggleSheath(), true, 'unsheathing a real weapon plays SOUND.DrawWeapon');
  assert.equal(armed.sheathed, false);
  assert.equal(armed.toggleSheath(), false, 'sheathing is silent');
  const fists = new PlayerWeapon({ weapon: null });
  assert.equal(fists.toggleSheath(), false, 'bare hands (Melee) never play the draw sound');
  assert.equal(fists.sheathed, false, 'but the toggle still flips');
});
