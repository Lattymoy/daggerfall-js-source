// AUDIT 17k - the parity pass over U16 + U17 + U18, and the FIST
// CRASH (Mac's report): a bare-handed swing in the DUNGEON host threw
// on the strike frame. Bare hands are a null weapon since U8h bound
// the rig to equip.slots[RightHand] - and the DEFAULT state, because
// starting weapons land in the bag unequipped (DFU adds them via
// AddItem, never equips) - so the crash was the dungeon's default
// attack. The exterior hosts guarded with ?.; the dungeon host had
// the raw deref at BOTH its swing sites. The fourth instance of the
// dungeon-host-falls-behind shape (17f x2, 17h, now this).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { MELEE_ANIMS, WEAPON_FILE, WEAPON_TYPES, weaponTypeForItem } from '../src/combat/fpsWeapon.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { constellationPalette, QSCROLL_H, QSCROLL_TEXT_OFFSET, QUESTION_ROW_H } from '../src/ui/chargenArt.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('17k F2: no scene dereferences the player weapon without the null guard', () => {
  // The fist-crash rule, enforced not remembered (the 17i sweep
  // shape): playerWeapon.weapon is NULL for bare hands, so every
  // member read in a host must go through ?. - the crash was
  // WEAPON_SKILL[playerWeapon.weapon.name] on the strike frame.
  const dir = join(root, 'src/scenes');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      if (/playerWeapon\.weapon\.[a-zA-Z]/.test(line)) {
        assert.fail(`${f}:${i + 1} dereferences playerWeapon.weapon without ?. - bare hands are null: ${line.trim()}`);
      }
    }
  }
});

test('17k F2: the bare-handed swing path itself never throws', () => {
  // The two sites the sweep now guards, driven functionally: a null
  // weapon readies without the draw sound (Melee is not a real
  // weapon), swings, and resolves a HandToHand hit.
  const pw = new PlayerWeapon({ weapon: null });
  assert.equal(pw.toggleSheath(), false, 'unsheathing fists plays NO draw sound (WeaponManager: not Melee/None)');
  assert.ok(pw.clickAttack(() => 0), 'the tap swings bare-handed');
  // the machine reaches its strike frames without a weapon
  for (let i = 0; i < 60; i++) pw.update(1 / 60);
  // and the damage path is CalculateHandToHandAttackDamage, not a
  // throw (the formulas fixtures' own entity shape)
  const attacker = { isPlayer: true, level: 1, skills: 50, stats: { strength: 50, agility: 50, luck: 50 } };
  const target = { isPlayer: false, level: 1, skills: 30, stats: { agility: 50, luck: 50 }, armor: 0 };
  const dmg = calculateAttackDamage(attacker, target, { weapon: null, rolls: () => 0.5 });
  assert.ok(Number.isFinite(dmg), `bare-handed damage resolves (${dmg})`);
});

test('17k F2 corpus: WEAPON10.CIF carries every record the fist table indexes', (t) => {
  // Bare hands are the DEFAULT draw now, so the Melee art is
  // load-bearing: every MELEE_ANIMS row must land on a real record
  // with at least its NumFrames frames.
  if (!process.env.ARENA2_PATH) return t.skip('ARENA2_PATH not set');
  assert.equal(weaponTypeForItem(null), WEAPON_TYPES.Melee, 'no item = fists');
  const name = WEAPON_FILE[WEAPON_TYPES.Melee];
  assert.equal(name, 'WEAPON10.CIF');
  const cif = new CifRciFile();
  const pal = new DFPalette();
  pal.load(readFileSync(join(process.env.ARENA2_PATH, 'ART_PAL.COL')));
  assert.ok(cif.load(readFileSync(join(process.env.ARENA2_PATH, name)), name, pal));
  for (const [row, anim] of MELEE_ANIMS.entries()) {
    assert.ok(anim.Record < cif.recordCount, `state row ${row} indexes record ${anim.Record} of ${cif.recordCount}`);
    assert.ok(cif.getFrameCount(anim.Record) >= anim.NumFrames,
      `record ${anim.Record}: ${cif.getFrameCount(anim.Record)} frames >= the table's ${anim.NumFrames}`);
  }
});

test('17k F1: a pristine redraw RESTORES the constellation slots', () => {
  // DFU constructs the questions window over a FRESH ImgFile every
  // time, so a re-entered screen always shows the file's own palette.
  // The port keeps ONE palette; without the restore, a second run's
  // un-answered screen re-uploaded the LAST run's brightened blues
  // under the 'pristine' texture key.
  const writes = [];
  const palette = { set: (i, r, g, b) => writes.push([i, r, g, b]) };
  const pristine = [{ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }, { r: 7, g: 8, b: 9 }];
  constellationPalette(palette, pristine, [32, 8, 8]);   // an answered run
  assert.deepEqual(writes, [[192, 0, 0, 32], [160, 0, 0, 8], [128, 0, 0, 8]],
    'answered runs write (0,0,blue) into warrior/rogue/mage slots 192/160/128');
  writes.length = 0;
  constellationPalette(palette, pristine, null);         // a fresh run's first draw
  assert.deepEqual(writes, [[192, 1, 2, 3], [160, 4, 5, 6], [128, 7, 8, 9]],
    'the pristine draw restores the FILE\'s own slot colours, not the last run\'s blues');
});

test('17k F3: the scroll-down clamp is STRICT at the text window edge', () => {
  // NativePanel_OnMouseScrollDown (:434): `labelY + labelH >
  // windowBottom` - strictly greater. Scrolling stops exactly when
  // the label's bottom REACHES the window edge; the U18 pin only
  // exercised far-from-boundary labels, so a >= mutation survived it.
  // A 7-row label is 49px; from labelY 16 its bottom is 65 (one past
  // the 64 edge) - one scroll is allowed, the next must be blocked.
  const f = new ChargenFlow([], () => 0);
  const edge = QSCROLL_H - QSCROLL_TEXT_OFFSET;   // 64
  f.qDisplay = { lines: Array.from({ length: 7 }, (_, i) => `r${i}`), aIndex: 1, bIndex: 2, cIndex: 3 };
  f.qLabelY = QSCROLL_TEXT_OFFSET;
  assert.equal(f.qLabelY + 7 * QUESTION_ROW_H, edge + 1, 'the fixture starts one pixel past the edge');
  f.scrollQuestion(1);
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET - 1, 'one pixel past the edge: down scrolls');
  f.scrollQuestion(1);
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET - 1, 'bottom exactly ON the edge: down is BLOCKED (strict >)');
});
