// AUDIT 18 pins. Each one is mutation-proven: restoring the defect it
// describes FAILS it. See bible/Home.md "Audits".
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { weaponAttackDamage, baseDamageMin, baseDamageMax, chooseEnemyWeapon } from '../src/combat/formulas.js';
import { WEAPONS, weaponMinDamage, weaponMaxDamage } from '../src/characters/weapons.js';
import { assignStartingGear } from '../src/systems/startingGear.js';
import { KEEP } from '../src/scenes/dataSource.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(join(dir, d.name)) : (d.name.endsWith('.js') ? [join(dir, d.name)] : []));

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// ---------------------------------------------------------------------------
// F1: GetBaseDamageMin/Max resolve the TEMPLATE, never a baked field.
//
// DaggerfallUnityItem.cs:969-977 -> FormulaHelper.CalculateWeaponMin/MaxDamage
// ((Weapons)TemplateIndex). The port read weapon.minDamage/maxDamage, which
// ONLY enemyEquipment.createWeapon baked. S3d's assignStartingGear mints from
// the item templates, so every armed player swing computed NaN.
// ---------------------------------------------------------------------------

test('AUDIT 18 F1: a starting-gear weapon does finite, table-exact damage', () => {
  // The exact shape assignStartingGear mints (S3d) - no baked damage fields.
  const player = {
    level: 1, isPlayer: true, skills: 35,
    stats: { strength: 50, agility: 50, luck: 50 },
    attackModifierFlags: null,
  };
  const foe = { isPlayer: false, careerIndex: 3, group: null };

  for (const [name, templateIndex] of Object.entries(WEAPONS)) {
    if (name === 'Arrow') continue;                      // ammunition, never swung
    const item = { group: 'Weapons', templateIndex, material: 0, name, value: 30 };

    // The defect: `undefined + ...` is NaN, and NaN survives every later term.
    const lo = weaponAttackDamage(player, foe, 0, item, seq(0));
    const hi = weaponAttackDamage(player, foe, 0, item, seq(0.999));
    assert.ok(Number.isFinite(lo), `${name}: min-roll damage must be finite, got ${lo}`);
    assert.ok(Number.isFinite(hi), `${name}: max-roll damage must be finite, got ${hi}`);

    // And table-exact: roll 0 takes the template minimum, 0.999 the maximum.
    // str 50 -> DamageModifier 0; iron -> material modifier -1.
    assert.equal(lo, weaponMinDamage(templateIndex) - 1, `${name} min roll`);
    assert.equal(hi, weaponMaxDamage(templateIndex) - 1, `${name} max roll`);
  }
});

test('AUDIT 18 F1: baseDamageMin/Max ARE the verbatim template tables', () => {
  for (const templateIndex of Object.values(WEAPONS)) {
    assert.equal(baseDamageMin({ templateIndex }), weaponMinDamage(templateIndex));
    assert.equal(baseDamageMax({ templateIndex }), weaponMaxDamage(templateIndex));
  }
  // A weapon with baked fields but no template resolves through the TEMPLATE
  // path only - a stale baked field can never be read again.
  assert.equal(baseDamageMin({ minDamage: 99, maxDamage: 99 }), 0);
});

test('AUDIT 18 F1: chooseEnemyWeapon compares template damage, not baked fields', () => {
  // CalculateAttackDamage's weapon-vs-weaponless choice (FormulaHelper.cs:700).
  // A Dagger averages (1+6)/2 = 3; a monster whose fists average 5 keeps them.
  const dagger = { templateIndex: WEAPONS.Dagger, material: 0 };
  assert.equal(chooseEnemyWeapon(dagger, { minDamage: 5, maxDamage: 5 }), null);
  assert.equal(chooseEnemyWeapon(dagger, { minDamage: 1, maxDamage: 1 }), dagger);
});

test('AUDIT 18 F1: every weapon assignStartingGear mints carries a template', () => {
  // The seam that broke: gear minted from templates flows straight into
  // weaponRig.syncWorn -> playerWeapon.weapon -> weaponAttackDamage.
  const seen = [];
  for (let classIndex = 0; classIndex < 18; classIndex++) {
    const e = { gender: 'male', race: 'Breton' };
    assignStartingGear(e, { classIndex, rolls: () => 0.5 });
    for (const it of e.items) {
      if (it?.group !== 'Weapons') continue;
      assert.ok(Number.isInteger(it.templateIndex),
        `class ${classIndex}: minted weapon ${it.name} has no templateIndex`);
      // Arrows are ammunition - CalculateWeaponMinDamage has no Arrow case
      // and returns 0, exactly as DFU does. Only swung weapons need damage.
      if (it.templateIndex === WEAPONS.Arrow) continue;
      seen.push(it);
      assert.ok(Number.isFinite(baseDamageMin(it)) && baseDamageMax(it) > 0,
        `class ${classIndex}: ${it.name} resolves no template damage`);
    }
  }
  assert.ok(seen.length >= 18, `expected a starting weapon per class, saw ${seen.length}`);
});

// ---------------------------------------------------------------------------
// F2: the ingest diet must not starve a live reader.
//
// dataSource.KEEP decides what reaches IndexedDB. On the deployed site the
// network arm 404s, so a name KEEP rejects has NO source at all. The diet was
// written before U18 (CLASSES.DAT), T3a (FACTION.TXT) and S3e (BIOG*.TXT)
// shipped, and silently starved all three.
//
// This is a RULE, not a spot check: it re-derives the fetch list from the
// source on every run, so the next reader that lands is covered automatically.
// ---------------------------------------------------------------------------

test('AUDIT 18 F2: every ARENA2 name live code fetches survives the ingest diet', () => {
  const LITERAL = /(?:fetchBytes|getBytes)\(\s*'([A-Z0-9_.]+)'/g;
  const names = new Set();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(LITERAL)) names.add(m[1]);
  }
  assert.ok(names.size >= 15, `expected the real fetch list, found ${names.size}`);

  // Both diets: desktop (lean=false) and the phone diet (lean=true). A file
  // may only be lean-dropped if the port has a documented fallback - today
  // that is the sky sets alone.
  for (const name of [...names].sort()) {
    assert.ok(KEEP(name, false), `desktop diet drops ${name}, which live code fetches`);
    if (!/^SKY\d+\.DAT$/.test(name)) {
      assert.ok(KEEP(name, true), `lean diet drops ${name}, which live code fetches`);
    }
  }

  // The three the diet actually starved, named so a regression is legible.
  for (const n of ['CLASSES.DAT', 'FACTION.TXT']) assert.ok(KEEP(n, true), n);
  for (let i = 0; i < 18; i++) {
    const biog = `BIOG${String(i).padStart(2, '0')}T0.TXT`;
    assert.ok(KEEP(biog, true), `lean diet drops ${biog}`);
  }

  // And the diet still refuses the bulk it exists to refuse.
  for (const n of ['PACKED.DAT', 'MASTER.DAT', 'BIO.DAT', 'ANIM0000.VID']) {
    assert.ok(!KEEP(n, true), `${n} must stay out of the lean diet`);
  }
});

test('AUDIT 18 F2: the template-built CLASS**.CFG fetches all survive the diet', () => {
  // dungeonContext.js:384 and chargenSession.js:90/105 build these by index.
  for (let i = 0; i < 19; i++) {
    assert.ok(KEEP(`CLASS${String(i).padStart(2, '0')}.CFG`, true));
  }
});
