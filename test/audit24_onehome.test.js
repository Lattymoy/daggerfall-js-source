// AUDIT 24 (the full-codebase parity sweep), wave 24: ONE DFU MEMBER,
// ONE EXPORT - as a standing gate rather than a rule people remember.
//
// Wave 23 found five duplicated tables, one of them written by this
// audit two waves earlier. Every one of them AGREED in value on the
// day it was found; that is the only guarantee a duplicate ever
// offers, and it is worth nothing tomorrow.
//
// So: scan src/ for every symbol DECLARED (not re-exported) in more
// than one module, load both, and demand that either the values are
// identical or the pair is listed below as a deliberate homonym with
// a reason. A new duplicate fails here the day it lands, and an
// existing pair that DRIFTS fails the day it drifts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { staticNpcData, staticNpcName, positionHash } from '../src/characters/staticNpc.js';
import * as BRIDGE from '../src/scenes/questBridge.js';
import { GENDERS, getNameBank, fullName } from '../src/characters/nameHelper.js';
import { srand } from '../src/formats/dfRandom.js';

const ROOT = new URL('../', import.meta.url);

function walk(dir, out = []) {
  for (const e of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${dir}${e.name}/`, out);
    else if (e.name.endsWith('.js')) out.push(`${dir}${e.name}`);
  }
  return out;
}

// Deliberate homonyms: two DIFFERENT things that share a name. Each
// needs a reason, and each is still checked for existence, so a pair
// that quietly becomes one thing (or disappears) shows up as churn
// here rather than as silence.
const HOMONYMS = new Map([
  ['ROW_SPACING', 'a list picker row and a talk-window row are different heights'],
  ['SELECTED_TEXT_COLOR', 'the picker highlight and the talk highlight are different colours'],
  ['LABELS', 'settings labels vs special-advantage labels'],
  ['templateFor', 'a visual-preset lookup vs the item-template lookup'],
  ['ARMOR_MATERIAL', 'enemyEquipment carries the three-member mint subset; armorMaterials the full ItemEnums enum'],
  ['armorArchive', 'the material->archive number vs the paperdoll art filename'],
  ['ITEM_TEMPLATES', 'characters/paperdoll re-exports the RAW json; systems/itemTemplates adds the port aliases'],
  ['ITEM_GROUPS', 'equipRules carries the ItemGroups ENUM; loot carries the group->template-index lists'],
  ['firstName', 'a talk-session getter vs the name-bank generator'],
  ['_resetForTests', 'each settings store resets its own'],
  ['orderOf', 'a settings-page order vs a guild-variant order'],
]);

test('audit24 wave24: no symbol is DECLARED in two modules without a reason', async () => {
  const files = walk('src/');
  const decl = new Map();
  for (const f of files) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    for (const m of src.matchAll(/^export (?:async )?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (!decl.has(m[1])) decl.set(m[1], new Set());
      decl.get(m[1]).add(f);
    }
  }
  assert.ok(files.length > 250, `the scan must actually see the tree (${files.length} files)`);
  assert.ok(decl.size > 800, `and its exports (${decl.size} names)`);

  const dupes = [...decl.entries()].filter(([, v]) => v.size > 1);
  const norm = (v) => {
    if (typeof v === 'function') return `fn/${v.length}`;
    if (typeof v === 'object' && v !== null) { try { return JSON.stringify(v); } catch { return '[cyclic]'; } }
    return `${typeof v}:${String(v)}`;
  };

  const drifted = [];
  for (const [name, fset] of dupes) {
    const vals = [];
    for (const f of fset) {
      const mod = await import(new URL(f, ROOT));
      vals.push([f, norm(mod[name])]);
    }
    const kinds = new Set(vals.map(([, v]) => v));
    if (kinds.size === 1) continue;               // same value in both homes
    if (HOMONYMS.has(name)) continue;             // deliberately two things
    drifted.push(`${name}: ${vals.map(([f, v]) => `${f} = ${v.slice(0, 60)}`).join('  |  ')}`);
  }
  assert.deepEqual(drifted, [],
    `these are declared twice and DISAGREE - either they are one DFU member with one home, or they belong in HOMONYMS:\n  ${drifted.join('\n  ')}`);

  // And the allow-list must not rot: every homonym listed here must
  // still actually be a duplicate declaration.
  const dupeNames = new Set(dupes.map(([n]) => n));
  const stale = [...HOMONYMS.keys()].filter((n) => !dupeNames.has(n));
  assert.deepEqual(stale, [], `HOMONYMS lists names that are no longer declared twice: ${stale.join(', ')}`);
});

test('audit24 wave24: the duplicate-declaration count does not grow', () => {
  // The pairs that AGREE today are not bugs, they are drift waiting to
  // happen, and collapsing all of them is a bigger refactor than this
  // audit should do in one motion. This number is the ratchet: it may
  // go DOWN freely, and going up needs a deliberate edit here.
  // 43 when the scan was written; 26 after waves 23-24 collapsed the
  // seventeen that were one DFU member with two homes.
  const files = walk('src/');
  const decl = new Map();
  for (const f of files) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    for (const m of src.matchAll(/^export (?:async )?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (!decl.has(m[1])) decl.set(m[1], new Set());
      decl.get(m[1]).add(f);
    }
  }
  const dupes = [...decl.entries()].filter(([, v]) => v.size > 1);
  assert.ok(dupes.length <= 26,
    `${dupes.length} symbols are declared in more than one module (the ratchet is 26):\n  `
    + dupes.map(([n, v]) => `${n}  ${[...v].join(' ')}`).join('\n  '));
});

// ---- wave 24: StaticNPC.GetDisplayName, ported and never called ----

test('audit24 wave24: SetLayoutData has ONE implementation, and it is the corrected one', () => {
  // characters/staticNpc.js carried a STALE copy of the layout
  // overload that predated the seven-slice sweep: no race, no context,
  // no zero-struct base, and a gender written as the STRING 'female'
  // where C# writes the Genders enum. The corrected one lived in
  // questBridge. Both were exported under the same name.
  assert.equal(BRIDGE.staticNpcData, staticNpcData, 'the same function object');
  assert.equal(BRIDGE.positionHash, positionHash);

  const d = staticNpcData({ flags: 32, factionID: 0, rawX: 1, rawY: 2, rawZ: 3 }, {});
  assert.equal(d.gender, GENDERS.Female, 'the Genders ENUM, not the string');
  assert.equal(typeof d.gender, 'number');
  assert.ok('race' in d, 'race is written (SetLayoutData:220)');
  assert.ok('context' in d, 'and so is context');
  assert.equal(d.hash, positionHash(1, 2, 3));
});

test('audit24 wave24: GetDisplayName names the NPC from the seed, and the click uses it', () => {
  // StaticNPC.cs:315-328 - an Individual faction answers its own name;
  // everybody else is srand(nameSeed) + FullName(nameBank, gender).
  const individual = () => ({ type: 3, name: 'King Gothryd' });
  const ordinary = () => ({ type: 1, name: 'The Merchants' });
  const d = staticNpcData({ flags: 0, factionID: 88, position: 1234 }, { buildingKey: 7 });
  assert.equal(staticNpcName(d, { getFaction: individual }), 'King Gothryd');

  // generated, stable, and it is a NAME rather than the empty string
  const once = staticNpcName(d, { getFaction: ordinary });
  assert.ok(once.length > 1);
  assert.equal(staticNpcName(d, { getFaction: ordinary }), once, 'the seed makes it stable');

  // gender reaches FullName as the enum, so a female NPC gets a female
  // name - the string compare this used to do could never have worked
  // against the corrected staticNpcData
  const female = staticNpcData({ flags: 32, factionID: 0, position: 1234 }, { buildingKey: 7 });
  const male = staticNpcData({ flags: 0, factionID: 0, position: 1234 }, { buildingKey: 7 });
  assert.notEqual(staticNpcName(female), staticNpcName(male),
    'the same seed with a different gender is a different name');
  // compute the expectation FIRST: staticNpcName re-seeds, so reading
  // fullName after it would draw from the state it left behind
  srand(female.nameSeed);
  const expected = fullName(getNameBank('Breton'), GENDERS.Female);
  assert.equal(staticNpcName(female), expected,
    'and it is srand(nameSeed) then FullName(bank, gender), on the nose');

  // and the interior click actually calls it - `pn.displayName` is a
  // field collectInteriorPeople does not write, so every static NPC in
  // the game reached TalkManager as ''
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /const displayName = npcData\s*\n\s*\? staticNpcName\(npcData, \{ getFaction: \(id\) => dict\?\.get\(id\) \?\? null \}\)/);
  assert.match(wm, /\{ data: pn, isChildNPC: !!pn\.isChildNPC, displayName \},/);
  assert.doesNotMatch(wm, /displayName: pn\.displayName \?\? ''/, 'and not the field nothing writes');
  const ip = readFileSync(new URL('../src/characters/interiorPeople.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ip, /displayName/, 'collectInteriorPeople still does not write one - which is the point');
});
