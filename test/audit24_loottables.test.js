// AUDIT 24 (the seven-slice sweep), THE TABLE GATE.
//
// The mutation campaign over the AUDIT 24 line ranges came back with
// exactly one file at 0 of 8 caught: src/systems/loot.js. Every
// survivor was a DATA TABLE constant - a LootChanceMatrix cell, an
// ingredient template index - flipped by one and noticed by nothing.
// That is the shape a transcription typo takes, and no amount of
// behavioural testing finds it: a wrong 10 for an 11 still produces
// loot, just the wrong loot, for ever.
//
// The only pin that catches that class of error is one that REBUILDS
// the table from the source, which is the idiom
// audit24_systems2.test.js already uses for MAGIC_ONLY_KEYS. The
// vendored DFU tree is gitignored, so this gate skips wherever it is
// absent - the same charter the ARENA2-backed pins run under.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LOOT_MATRICES, ITEM_GROUPS } from '../src/systems/loot.js';

const LOOT_TABLES = new URL('../tools/parity/dfu/Assets/Scripts/Game/Items/LootTables.cs', import.meta.url);
const ITEM_ENUMS = new URL('../tools/parity/dfu/Assets/Scripts/Game/Items/ItemEnums.cs', import.meta.url);
const noDfu = !existsSync(LOOT_TABLES) || !existsSync(ITEM_ENUMS);

test('audit24 tables: LOOT_MATRICES is REBUILT from LootTables.cs, cell for cell', { skip: noDfu }, () => {
  const cs = readFileSync(LOOT_TABLES, 'utf8');
  const rows = [...cs.matchAll(/new LootChanceMatrix\(\)\s*\{([^}]*)\}/g)];
  assert.ok(rows.length >= 21, `found ${rows.length} matrix rows in the source`);
  const fromSource = {};
  for (const [, inner] of rows) {
    const key = /key\s*=\s*"([^"]+)"/.exec(inner)[1];
    const row = {};
    for (const [, f, v] of inner.matchAll(/(\w+)\s*=\s*(-?\d+)/g)) row[f] = Number(v);
    fromSource[key] = row;
  }
  assert.deepEqual(Object.keys(LOOT_MATRICES).sort(), Object.keys(fromSource).sort(),
    'the same 21 keys, no more and no fewer');
  for (const [key, row] of Object.entries(fromSource)) {
    assert.deepEqual(LOOT_MATRICES[key], row, `matrix ${key} matches LootTables.cs cell for cell`);
  }
  // a RULE, not a tautology: the sweep really read numbers
  const cells = Object.values(fromSource).flatMap((r) => Object.values(r));
  assert.ok(cells.length >= 21 * 15, `${cells.length} cells compared`);
  assert.ok(cells.some((v) => v === 100) && cells.some((v) => v === 0),
    'and the range is real - the matrix runs 0..100');
});

test('audit24 tables: the ingredient ITEM_GROUPS are REBUILT from ItemEnums.cs', { skip: noDfu }, () => {
  const cs = readFileSync(ITEM_ENUMS, 'utf8');
  const wanted = ['PlantIngredients1', 'PlantIngredients2', 'CreatureIngredients1',
    'CreatureIngredients2', 'CreatureIngredients3', 'MetalIngredients',
    'Gems', 'MiscellaneousIngredients1', 'MiscellaneousIngredients2'];
  let checked = 0;
  for (const name of wanted) {
    if (!(name in ITEM_GROUPS)) continue;
    const m = new RegExp(`public enum ${name}[^{]*\\{([^}]*)\\}`).exec(cs);
    assert.ok(m, `${name} is in ItemEnums.cs`);
    const values = [...m[1].matchAll(/=\s*(-?\d+)/g)].map((x) => Number(x[1]));
    assert.deepEqual(ITEM_GROUPS[name], values, `${name} matches the enum, in order`);
    checked++;
  }
  assert.ok(checked >= 5, `${checked} ingredient groups rebuilt - the sweep found real enums`);
});
