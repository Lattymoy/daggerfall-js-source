// L10N3d (2026-09-27): DFU'S OWN INTERFACE WORDS, IN THE PLAYER'S LANGUAGE. The port holds DFU's Internal_Strings
// values as constants in tables keyed by DFU's own key; each such table now reads through the text core at the moment
// it is read (localizedStrings - GetLocalizedText(key) where DFU asks for it). Pinned: every key of every converted
// table is one of DFU's 990 and holds DFU's English byte for byte (vendor/dfu-text/Internal_Strings.csv - a parity pin
// the tables never had); each table answers a translation's row in its language and its own English everywhere else;
// the module-private tables by source; the table stays frozen, enumerable, and English byte-identical.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import * as tm from '../src/systems/textManager.js';
import { REP_GROUPS } from '../src/systems/customClass.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DFU = new Map(tm.loadStringTableCsv(rd('vendor/dfu-text/Internal_Strings.csv')));
beforeEach(() => tm._resetTextManagerForTests());

/** The exported tables, by module and name. */
const EXPORTED = [
  ['src/systems/answerPipeline.js', 'TALK_STRINGS'],
  ['src/systems/decorCatalogue.js', 'DECOR_SIZES'],
  ['src/systems/mysticism.js', 'DISPEL_MAGIC_TEXT'], ['src/systems/mysticism.js', 'SOUL_TRAP_TEXT'], ['src/systems/mysticism.js', 'DOOR_SPELL_TEXT'],
  ['src/systems/specialAdvantages.js', 'LABELS'],
  ['src/systems/talk.js', 'DIRECTION_HINTS'],
  ['src/systems/useItem.js', 'USE_TEXT'],
  ['src/ui/automapText.js', 'AUTOMAP_STRINGS'], ['src/ui/automapText.js', 'EXTERIOR_AUTOMAP_STRINGS'],
  ['src/ui/saveWindow.js', 'SW_TEXT'],
  ['src/ui/spellMakerWindow.js', 'SPELL_MAKER_TIPS'],
];
/** The tables a module keeps to itself, read off its source. */
const PRIVATE = [
  ['src/scenes/world.js', 'REVEAL_NOTE_TEXT'], ['src/systems/notebook.js', 'EN'], ['src/systems/quest/questMacros.js', 'EN'],
  ['src/ui/enhancedChargen.js', 'REP_LABELS'], ['src/ui/questJournal.js', 'TITLES'],
];

/** The one key whose English is the port's own: the reputation window's group DFU calls 'commoners' ("Commoners") is
 *  "Peasants" on the painted art the port's label copies - its English stays, a translation takes DFU's row. */
const OWN_ENGLISH = new Map([['src/ui/enhancedChargen.js REP_LABELS.commoners', 'Peasants']]);
const english = (file, name, k) => OWN_ENGLISH.get(`${file} ${name}.${k}`) ?? DFU.get(k);

/** A private table's literal: [key, English] pairs off the `const NAME = localizedStrings({...})` in `file`. */
function privateTable(file, name) {
  const ast = parse(rd(file), { ecmaVersion: 'latest', sourceType: 'module' });
  let found = null;
  const walk = (n) => {
    if (!n || typeof n.type !== 'string' || found) return;
    if (n.type === 'VariableDeclarator' && n.id?.name === name && n.init?.type === 'CallExpression') { found = n.init; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  };
  walk(ast);
  assert.ok(found, `${file} has no ${name}`);
  assert.equal(found.callee.name, 'localizedStrings', `${file} ${name} reads through the text core`);
  return found.arguments[0].properties.map((p) => [p.key.name ?? p.key.value, p.value.value]);
}

test('L10N3d parity: every key of every converted table is one of DFU\'s 990, holding DFU\'s English byte for byte', async () => {
  let keys = 0;
  for (const [file, name] of EXPORTED) {
    const table = (await import(new URL('../' + file, import.meta.url).href))[name];
    for (const [k, en] of Object.entries(table)) {
      assert.ok(DFU.has(k), `${file} ${name}.${k} is no Internal_Strings key`);
      assert.equal(en, english(file, name, k), `${file} ${name}.${k} is not DFU's English`);
      keys++;
    }
  }
  for (const [file, name] of PRIVATE) {
    for (const [k, en] of privateTable(file, name)) {
      assert.ok(DFU.has(k), `${file} ${name}.${k} is no Internal_Strings key`);
      assert.equal(en, english(file, name, k), `${file} ${name}.${k} is not DFU's English`);
      keys++;
    }
  }
  assert.equal(keys, 223, "every converted table's keys");
  assert.equal(DFU.get('commoners'), 'Commoners', 'the exception names a DFU key');
  const [, from, to] = /repLabel = \(g\) => REP_LABELS\[g === '(\w+)' \? '(\w+)' : g\]/.exec(rd('src/ui/enhancedChargen.js')) ?? [];
  const repKeys = new Set(privateTable('src/ui/enhancedChargen.js', 'REP_LABELS').map(([k]) => k));
  for (const g of REP_GROUPS) assert.ok(repKeys.has(g === from ? to : g), `the reputation group ${g} reads its label`);
});

test('L10N3d each table answers a translation\'s row in its language and its own English everywhere else - frozen, enumerable, and English byte for byte', async () => {
  for (const [file, name] of EXPORTED) {
    tm._resetTextManagerForTests();
    const table = (await import(new URL('../' + file, import.meta.url).href))[name];
    const [first, second] = Object.keys(table);
    const english = { ...table };
    assert.ok(Object.isFrozen(table), `${name} frozen`);
    tm.patchLocaleTable('fr', 'Internal_Strings', [[first, `«${first}» en français`]]);
    assert.deepEqual({ ...table }, english, `${name}: English stands until French is chosen`);
    tm.setLocale('fr');
    assert.equal(table[first], `«${first}» en français`, `${name}.${first} reads the French row`);
    if (second) assert.equal(table[second], english[second], `${name}.${second}: no French row, its English`);
    tm.setLocale('en');
    assert.deepEqual({ ...table }, english, `${name}: English again`);
  }
});

test('L10N3d localizedStrings itself: a key\'s English as the fallback, a row of the runtime collection (a mod\'s redirect) as the answer, another collection when asked', () => {
  const T = tm.localizedStrings({ saveGame: 'Save Game', loadGame: 'Load Game' });
  assert.deepEqual(Object.keys(T), ['saveGame', 'loadGame']);
  assert.throws(() => { T.saveGame = 'x'; }, TypeError, 'frozen');
  tm.patchLocaleTable('de', 'Mod_Strings', [['saveGame', 'Spiel speichern']]);
  tm.setRuntimeCollectionName(tm.TextCollections.Internal, 'Mod_Strings');
  tm.setLocale('de');
  assert.equal(T.saveGame, 'Spiel speichern');
  assert.equal(T.loadGame, 'Load Game');
  const S = tm.localizedStrings({ 1: 'Fireball' }, tm.TextCollections.TextSpells);
  tm.patchLocaleTable('de', 'Internal_Spells', [['1', 'Feuerball']]);
  assert.equal(S[1], 'Feuerball');
});
