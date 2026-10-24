// DEX0 (2026-10-19, Mac: "I want to implement this as our next mod 1:1. We also need to ensure these get proper
// morrowind model replacements if applicable") - DAGGERFALL ENEMY EXPANSION 1.3.4 (Kamer & Kab): THE RECORD.
//
// What vendor/daggerfall-enemy-expansion/ claims, each claim held: the manifest is the bundle's; the C# beside the
// compiled assembly is what the assembly was built from (every literal in its user-string heap, every member in its
// metadata - so the authors' repository at c187c97 is the shipped 1.3.4, not a later or an earlier one); the tables are
// verbatim; and the art is where tools/dexExtract.mjs put it - every shipped picture in its directory's listing by
// sha256 and every listing name on disk, the pictures that ARE Daggerfall's records specs naming the record and nothing
// else, and the generated index counting exactly the frames the three places hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { userStrings, metadataStreams } from '../../../tools/lib/clrUserStrings.mjs';
import { DEX_ART } from '../../../src/systems/enemyExpansion/dexArt.js';
import { DEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/dexTableText.js';
import { MOD_SETTINGS } from '../../../src/systems/modSettings.js';
import { splitCsvLine, parseArrayArg, parseBool, readCsvTable } from '../../../src/systems/enemyExpansion/dexCsv.js';
import { REPAINTED_ARCHIVES, SILHOUETTE_ALLOWED, SILHOUETTE_IOU, SILHOUETTE_TRACED, silhouetteLedger, outlinesBySize, bestTrace } from '../../../tools/dexExtract.mjs';
import { classicRecords } from '../../../tools/detailedShipsAssets.mjs';
import { readPng } from '../../../tools/pngIO.mjs';
import { DFPalette } from '../../../src/formats/dfPalette.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const V = join(ROOT, 'vendor/daggerfall-enemy-expansion');
const read = (p) => readFileSync(join(V, p));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const SCRIPTS = ['BestiaryEnemySpells', 'BestiaryMod', 'BestiarySaveInterface', 'BestiaryTextProvider', 'BestiaryTrollCorpseBillboard',
  'BestiaryTrollCorpseEntity', 'BestiaryTrollCorpseSerializer', 'Compatibility/DEX_RRICompat'];

test('DEX0 the manifest is the bundle\'s: Kamer & Kab\'s 1.3.4, its GUID, its 8,067 files and the eight scripts it names', () => {
  const m = JSON.parse(read('daggerfall-enemy-expansion.dfmod.json'));
  assert.equal(m.ModTitle, 'Daggerfall Enemy Expansion');
  assert.equal(m.ModVersion, '1.3.4');
  assert.equal(m.ModAuthor, 'Kamer & Kab');
  assert.equal(m.GUID, '76557441-7025-402e-a145-e3e1a28a093d');
  assert.equal(m.Files.length, 8067);
  assert.deepEqual(m.Dependencies, [{ Name: 'roleplayrealism-items', IsOptional: true, IsPeer: false }]);
  assert.deepEqual(m.Files.filter((f) => f.endsWith('.cs')).map((f) => f.replace(/^.*\/Scripts\//, '').replace(/\.cs$/, '')).sort(), [...SCRIPTS].sort());
  for (const s of SCRIPTS) assert.ok(existsSync(join(V, 'Scripts', `${s}.cs`)), `${s}.cs is carried`);
});

/** The string literals of the carried C#, as the compiler stores them: an interpolation's holes renumbered {0}, {1}...
 *  (string.Format's form, `format`), or - a one-hole interpolation is compiled to a concatenation instead - each literal
 *  piece between holes a string of its own (`pieces`). Comments and the attribute version strings ("v1", in the custom
 *  attribute blob, not the heap) are not code literals. */
function scriptLiterals() {
  const out = [];
  for (const s of SCRIPTS) {
    for (const line of readFileSync(join(V, 'Scripts', `${s}.cs`), 'utf8').split('\n')) {
      if (/^\s*\/\//.test(line) || /fsObject\("v1"\)/.test(line)) continue;
      for (const m of line.matchAll(/(\$?)"((?:[^"\\]|\\.)*)"/g)) {
        const text = m[2].replace(/\\(["\\])/g, '$1').replace(/\\n/g, '\n');
        if (text.length < 2) continue;
        let hole = 0;
        out.push(m[1]
          ? { script: s, pieces: text.split(/\{[^}]*\}/).filter((p) => p.length), format: text.replace(/\{[^}:,]*([,:][^}]*)?\}/g, (_, spec) => `{${hole++}${spec ?? ''}}`) }
          : { script: s, pieces: [text], format: text });
      }
    }
  }
  return out;
}
/** AUDIT DEX A4: held EXACTLY - the literal one string of the heap, an interpolation its format string or each piece one
 *  (a substring of a longer string is not the literal: "Defaulting to 1" is no piece of "Defaulting to 100"). */
const heldBy = (heap, lit) => heap.has(lit.format) || lit.pieces.every((p) => heap.has(p));

test('DEX0 the C# is what the DLL was built from: every literal is in its user-string heap and every declared member in its metadata', () => {
  const dll = read('Daggerfall Enemy Expansion.dll');
  assert.equal(sha(dll), '666ae571d62164abcc0b3d0ba3669ff46e88addf6a6bd23b01f3d2e48366da80', 'the assembly, byte for byte');
  const heap = new Set(userStrings(dll));
  const lits = scriptLiterals();
  assert.ok(lits.length > 200, `${lits.length} literals - the read is reading the scripts`);
  const missing = lits.filter((l) => !heldBy(heap, l)).map((l) => `${l.script}: ${l.format}`);
  assert.deepEqual(missing, []);
  // the #Strings heap holds every type, field and method name - every method the scripts declare is one. Roslyn shares
  // suffixes there (`Start` is the tail of `OnStart\0`, `Spellbook` of `GetSpellbook\0`), so a name is held when it
  // ends a string of the heap
  const str = metadataStreams(dll).get('#Strings');
  const heapText = Buffer.from(dll.subarray(str.offset, str.offset + str.size)).toString('latin1');
  const names = { has: (n) => heapText.includes(`${n}\0`) };
  const declared = new Set();
  for (const s of SCRIPTS) {
    for (const m of readFileSync(join(V, 'Scripts', `${s}.cs`), 'utf8').matchAll(/^\s+(?:public |private |internal |protected )?(?:static |override |async )*[\w<>[\],.? ]+?\s+([A-Z]\w*)\s*\([^;]*$/gm)) declared.add(m[1]);
  }
  for (const local of ['CreateDefaultTable', 'GetIndex', 'SetSpellReady', 'GetIndexOpt']) declared.delete(local);   // local functions: compiled as <Outer>g__Name|n_m
  assert.ok(declared.size > 50, `${declared.size} declared members`);
  assert.deepEqual([...declared].filter((n) => !names.has(n)), []);
  assert.ok(declared.has('Start') && declared.has('SelectDungeonTable'), 'the read finds the members');
  // A PIN MUST FAIL: a literal one character off, or a member the authors never wrote, is not held
  const lit = (pieces) => ({ pieces, format: pieces.join('{0}') });
  assert.equal(heldBy(heap, lit(['[DEX] Unknown enemy spell table \'X'])), false);
  assert.equal(heldBy(heap, lit(['The ', ' has recovered from its injuries.'])), true);
  assert.equal(heldBy(heap, lit(['The ', ' has recovered from its injuries!'])), false);
  assert.equal(heldBy(heap, lit(['The ', ' has recovered from its injuries'])), false, 'a piece cut short is not held (AUDIT DEX A4)');
  assert.equal(names.has('SelectDungeonTable'), true);
  assert.equal(names.has('SelectDungeonTables'), false);
});

/** AUDIT DEX A4: the eight scripts' git blob ids in the authors' tree at c187c97 ("Updated to 1.3.4",
 *  github.com/SquidKamer/DaggerfallBestiaryProject, `git ls-tree -r c187c972787d8ca3f5b77aa127694e72f4eb2705 Scripts`). */
const UPSTREAM_BLOBS = {
  BestiaryEnemySpells: 'cf6371f89363458188e2e1223745ad8898fca3a4',
  BestiaryMod: 'bde1ccab7541b4b364bb81a398eb771deab6ff4c',
  BestiarySaveInterface: '8c122a8fbec77a6cffb6f924e5f8152067b8fc87',
  BestiaryTextProvider: '14d872724453ef40ff0276d12ba3af29f3e43557',
  BestiaryTrollCorpseBillboard: 'cb0f55a01889dc956018f93a2c5a0e3c49fd3039',
  BestiaryTrollCorpseEntity: 'a308c016d9f464c7965ee32273caa1a10b2fc7b8',
  BestiaryTrollCorpseSerializer: 'd0340fea773c3b2e361c2e06c8f19931635510a3',
  'Compatibility/DEX_RRICompat': '93e59526c870e3cc27b7f281cd5d45093d751c2c',
};
const gitBlob = (b) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');

test('AUDIT DEX A4 the scripts are the authors\' c187c97, blob for blob - no line of the C# the port reads has moved since it was carried', () => {
  assert.deepEqual(Object.keys(UPSTREAM_BLOBS).sort(), [...SCRIPTS].sort());
  for (const s of SCRIPTS) assert.equal(gitBlob(read(`Scripts/${s}.cs`)), UPSTREAM_BLOBS[s], `${s}.cs`);
});

/** The DLL's IL (vendor/daggerfall-enemy-expansion/il/, tools/ilDump.py's dump): each method's integer loads - a switch
 *  table's cases among them (`ldc B; sub; switch [n targets]` is cases B..B+n-1) - and each constant stored to a field. */
function ilReading() {
  const lines = read('il/Daggerfall_Enemy_Expansion.il.txt').toString('utf8').split('\n');
  const ldc = (ins = '') => {
    let m = /: ldc\.i4\.(m1|\d)\s*$/.exec(ins); if (m) return m[1] === 'm1' ? -1 : Number(m[1]);
    m = /: ldc\.i4(?:\.s)?\s+(-?\d+)\s*$/.exec(ins); return m ? Number(m[1]) : null;
  };
  const methods = new Map(), stores = new Set(), strings = new Set();
  let cur = null, prev = [];
  for (const line of lines) {
    const h = /^---- (\w+)::(\S+) rva=/.exec(line);
    if (h) { cur = `${h[1]}::${h[2]}`; if (!methods.has(cur)) methods.set(cur, []); prev = []; continue; }
    if (!cur) continue;
    const v = ldc(line);
    if (v != null) methods.get(cur).push(v);
    const sw = /: switch\s+\[([^\]]*)\]/.exec(line);
    if (sw) { const base = /: sub\s*$/.test(prev[0] ?? '') ? (ldc(prev[1]) ?? 0) : 0; sw[1].split(',').forEach((_, c) => methods.get(cur).push(base + c)); }
    const st = /: st(?:s)?fld\s+\S*::(\w+)/.exec(line);
    if (st && ldc(prev[0]) != null) stores.add(`${st[1]}=${ldc(prev[0])}`);
    const str = /: ldstr\s+"(.*)"\s*$/.exec(line);
    if (str) strings.add(str[1]);
    prev = [line, ...prev].slice(0, 2);
  }
  return { methods, stores, strings };
}

test('AUDIT DEX A4 the C#\'s constants are the DLL\'s: every integer the C# stores in a field is stored so in the IL, and every integer past 8 a method names is one its IL loads (or a case of its switch table)', () => {
  const il = ilReading();
  const heap = new Set(userStrings(read('Daggerfall Enemy Expansion.dll')));
  assert.ok(il.strings.size > 150 && [...il.strings].every((x) => heap.has(x)), 'the dump is the DLL\'s: its strings, as it prints them (verbatim), are the heap\'s');
  const stores = [], misses = [];
  let methods = 0;
  for (const s of SCRIPTS) {
    const type = s.split('/').pop();
    const lines = readFileSync(join(V, 'Scripts', `${s}.cs`), 'utf8').split('\n');
    const code = (l) => l.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)'/g, "''");
    for (const [n, line] of lines.entries()) {
      for (const m of code(line).matchAll(/\.(\w+)\s*=\s*(-?\d+)\s*;/g)) stores.push(`${type}.cs:${n + 1} ${m[1]}=${Number(m[2])}`);
    }
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s{8}(?:(?:public|private|protected|internal|static|override|virtual|async)\s+)*[\w<>[\],. ]+\s+(\w+)\s*\([^;]*$/.exec(lines[i]);
      if (!m || /^(if|while|for|foreach|switch|return|new)\b/.test(lines[i].trim()) || !il.methods.has(`${type}::${m[1]}`)) continue;
      let j = i + 1; while (j < lines.length && !/^\s{8}\{/.test(lines[j])) j++;
      let k = j + 1; while (k < lines.length && !/^\s{8}\}/.test(lines[k])) k++;
      const loads = new Set([...il.methods].filter(([key]) => key === `${type}::${m[1]}` || key.includes(`<${m[1]}>`)).flatMap(([, v]) => v));
      methods++;
      for (const x of lines.slice(j, k).map(code).join('\n').matchAll(/(?<![\w.])(\d+)(?![\w.])/g)) {
        if (Number(x[1]) > 8 && !loads.has(Number(x[1]))) misses.push(`${type}::${m[1]} ${x[1]}`);
      }
    }
  }
  assert.ok(stores.length >= 18 && methods >= 90, `${stores.length} stores, ${methods} methods - the read is reading`);
  assert.deepEqual(stores.filter((x) => !il.stores.has(x.split(' ')[1])), [], 'each `.Field = n;` an `ldc n; stfld Field` of the IL');
  assert.deepEqual(misses, []);
  assert.ok(il.stores.has('ChanceForAttack2=50') && il.stores.has('ChanceForAttack3=25') && il.stores.has('ChanceForAttack4=12') && il.stores.has('ChanceForAttack5=6'), 'the monster attack chances the port reads (dexTables.js)');
  assert.ok(!il.stores.has('ChanceForAttack2=33'), 'A PIN MUST FAIL: a constant the authors never wrote is not held');
});

/** The bundle's text, byte for byte (tools/dexExtract.mjs writes each from its TextAsset and checks the tree
 *  against the bundle; these pin the bytes it wrote). */
const VERBATIM = {
  'CareerBase.cdb.csv': '02df73790037e80d5f79ef915b5ae7d97b747397e4ccd3bf1904a6a657d378b3',
  'ClassBase.mdb.csv': '6029a3d741ba0a46b17c5822e0bac744c7b200c52f3f89a243f8a7ba6e92aff9',
  'ClassicClassBase.mdb.csv': '6ca7c7a002ce19676cb553541605993a86767d79f43128e0d913f9b847be69a9',
  'ClassicMonsterReplacement.mdb.csv': '6ff710623d856d5ee54b0efe2b9580939cc2513ad3e651797991e56f96ffdb26',
  'DefaultTableReplacement.tdb.csv': '1fcd7e48540b6684064370cecf989009cefe51c676133614ec78c32e723617d7',
  'MonsterBase.mdb.csv': 'a481c2f0aa7016df0c0f606200aefdb3d1b27eab982684fd3ea7102feb3e6f7c',
  'SpellRecords.json': '8bdcf34029f72b8d07a8400849ab141a0dc5b9365d859ffd8ed125a605351274',
  'modsettings.json': '5c7001011eb41d2c0ab8d2f43ac80061beda4d8db5dbeaf1af4ba5fc3dcbe063',
  'Prefabs/1618_20.imported.json': '77a1af20e262041926bbedeeffe8567f09c009e1870ae70901bdd5f0d3cf3777',
};

test('DEX0 the tables are the bundle\'s, verbatim: their bytes, the rows and the columns the mod reads', () => {
  for (const [f, h] of Object.entries(VERBATIM)) assert.equal(sha(read(f)), h, `${f}: the bundle's bytes`);
  const rows = { 'MonsterBase.mdb.csv': 35, 'ClassBase.mdb.csv': 15, 'CareerBase.cdb.csv': 43, 'ClassicMonsterReplacement.mdb.csv': 16, 'ClassicClassBase.mdb.csv': 2, 'DefaultTableReplacement.tdb.csv': 39 };
  for (const [f, n] of Object.entries(rows)) assert.equal(readCsvTable(read(f).toString('utf8')).rows.length, n, f);
  const monsters = readCsvTable(read('MonsterBase.mdb.csv').toString('utf8'));
  assert.deepEqual(monsters.rows.map((r) => Number(r.tokens[0])), Array.from({ length: 35 }, (_, i) => 256 + i));
  const classes = readCsvTable(read('ClassBase.mdb.csv').toString('utf8'));
  assert.deepEqual(classes.rows.map((r) => Number(r.tokens[0])), Array.from({ length: 15 }, (_, i) => 384 + i));
  // the bundle's encounter tables, not the repository's at c187c97: the Rainforest's day row as the build shipped it
  const tables = readCsvTable(read('DefaultTableReplacement.tdb.csv').toString('utf8'));
  assert.deepEqual(tables.rows.find((r) => r.tokens[0] === 'DefaultRainforestDay').tokens.slice(1),
    ['27', '0', '4', '5', '6', '138', '13', '136', '283', '142', '16', '144', '145', '138', '143', '142', '141', '137', '134', '128', '129']);
  assert.equal(JSON.parse(read('SpellRecords.json')).map((s) => s.index).join(), '500,501,502,503');
  assert.deepEqual(JSON.parse(read('Prefabs/1618_20.imported.json')).Components[0], { ...JSON.parse(read('Prefabs/1618_20.imported.json')).Components[0], Archive: 1618, Record: 20, AshArchive: 1618, AshRecord: 21, RespawnTime: 10 });
});

test('DEX0 the text the game parses is the vendored files, byte for byte, in the manifest\'s order', () => {
  const manifest = JSON.parse(read('daggerfall-enemy-expansion.dfmod.json'));
  const tables = manifest.Files.map((f) => f.slice(f.lastIndexOf('/') + 1)).filter((n) => /\.(cdb|mdb|tdb)\.csv$/.test(n));
  assert.deepEqual(Object.keys(DEX_TABLE_TEXT), [...tables, 'SpellRecords.json', 'Prefabs/1618_20.imported.json']);
  for (const [f, text] of Object.entries(DEX_TABLE_TEXT)) assert.equal(Buffer.from(text, 'utf8').equals(read(f)), true, `${f}: the game's text is the vendored bytes`);
});

test('DEX1 the mod\'s own CSV reading, quirks and all (BestiaryMod.SplitCsvLine / ParseArrayArg / ParseBool)', () => {
  assert.deepEqual(splitCsvLine('256,Goblin,"{0,1,2,3,-1,3,4}",,TRUE'), ['256', 'Goblin', '{0,1,2,3,-1,3,4}', '', 'TRUE']);
  assert.deepEqual(splitCsvLine('a,'), ['a', '']);
  // the one quirk: an empty first cell is a zero-length match, added twice, and the scan resumes past the next comma
  assert.deepEqual(splitCsvLine(',a,b'), ['', '', 'b']);
  assert.deepEqual(splitCsvLine(',a'), ['', '']);
  assert.deepEqual(splitCsvLine('a,,b'), ['a', '', 'b']);
  assert.deepEqual(splitCsvLine('"x\\"y",z'), ['x"y', 'z']);
  assert.deepEqual(parseArrayArg('{ 0, 1, -1, 3 }'), [0, 1, -1, 3]);
  assert.deepEqual(parseArrayArg('7,10,29,44'), [7, 10, 29, 44]);
  assert.deepEqual(parseArrayArg('{0,,1}'), [0, -1, 1]);
  assert.throws(() => parseArrayArg('{0,1]'), /mismatched brackets/);
  assert.equal(parseBool('TRUE'), true);
  assert.equal(parseBool(''), false);
  assert.throws(() => parseBool('yes'), /invalid boolean/);
});

/** The listing a directory answers to, and the PNGs it holds. */
const listingOf = (file) => JSON.parse(read(file));
const pngsIn = (dir) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.png')).sort() : []);

test('DEX0 the art: every shipped picture is in its listing by sha256 and every listing name is shipped, in the right directory', () => {
  for (const [file, dir] of [['daggerfall-enemy-expansion.files.json', 'public/art/daggerfall-enemy-expansion'], ['repainted.files.json', 'public/art/daggerfall-enemy-expansion-repainted']]) {
    const l = listingOf(file);
    assert.equal(l.BundleSha256, '6824c32daca8e9c5e9702b49b261aeaee01f7d66569ec7a86559ca4afe443959');
    assert.deepEqual(pngsIn(dir), l.Files, `${dir} holds exactly what ${file} names`);
    for (const f of l.Files) assert.equal(sha(readFileSync(join(ROOT, dir, f))), l.Sha256[f], `${dir}/${f}`);
  }
  const repainted = listingOf('repainted.files.json').Files.map((f) => Number(f.split('_')[0]));
  assert.deepEqual([...new Set(repainted)].sort((a, b) => a - b), [1504, 1505, 1509, 1511, 1512, 1530, 1531, 1532, 1533, 1609], 'the fourth exception\'s archives, no more (AUDIT DEX B1: the Royal Knight, 1505, among them)');
  assert.deepEqual([...REPAINTED_ARCHIVES], [...new Set(repainted)].sort((a, b) => a - b), 'the extractor\'s list is the directory\'s');
  assert.equal(listingOf('daggerfall-enemy-expansion.files.json').Files.length, 4726, 'the authors\' own');
  assert.equal(listingOf('repainted.files.json').Files.length, 774, 'the repaints');
  assert.equal(listingOf('daggerfall-enemy-expansion.files.json').Files.length + listingOf('repainted.files.json').Files.length, 5500);
  assert.equal(DEX_ART[399], undefined, 'the guard\'s 399: DFU never wears it (no 399_0-0, and TEXTURE.399 ends at record 19)');
});

// AUDIT DEX B1: THE SILHOUETTE GUARD (tools/dexExtract.mjs). The extractor found a copy by its colours and a repaint by
// its hand list alone, so the Royal Knight (1505) - TEXTURE.482's Barbarian under the authors' armour, all sixty pictures
// - shipped as the authors' own. Paint keeps an outline, so every picture is measured by its outline too, and an archive
// that follows Daggerfall's is refused unless the fourth exception (REPAINTED_ARCHIVES) or the owner (SILHOUETTE_ALLOWED)
// carries it; both ways - a listed archive the measure does not find is refused as well.
/** A picture `w` x `h`, drawn where `inside(x, y)` says, in one colour. */
const drawn = (w, h, inside, rgb = [200, 40, 40]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) data.set([...rgb, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
};
/** "Daggerfall's" frame: a body - a head, a torso, a leg forward, one back (not its own mirror). */
const BODY = (x, y) => (y < 6 && x >= 7 && x < 13) || (y >= 6 && y < 20 && x >= 4 && x < 15) || (y >= 20 && ((x >= 2 && x < 7) || (x >= 11 && x < 14)));
const CLASSIC = [
  { archive: 482, record: 0, frame: 0, rgba: drawn(20, 30, BODY, [90, 60, 30]) },
  { archive: 1, record: 0, frame: 0, rgba: drawn(20, 30, () => true) },   // a wall: a full rectangle, no outline
];
const REPAINT = drawn(20, 30, (x, y) => BODY(x, y) || (y >= 8 && y < 13 && x >= 15 && x < 17));   // the body, a cape painted on
const MIRRORED = drawn(20, 30, (x, y) => BODY(19 - x, y));
const TWICE = drawn(40, 60, (x, y) => BODY(x >> 1, y >> 1));
const OWN = drawn(20, 30, (x, y) => y >= 15 && x >= 1 && x < 19);   // another drawing at the same size

test('DEX0 the silhouette guard\'s measure: a picture traces the TEXTURE frame whose outline it follows - painted over, mirrored, at twice its size - and not another drawing of its size; a full rectangle has no outline to trace (mutants: no mirror, no twice, a rectangle traced)', () => {
  const outlines = outlinesBySize(CLASSIC);
  assert.deepEqual([...outlines.keys()], ['20x30'], 'the wall carries no outline');
  assert.equal(outlines.get('20x30').length, 1);
  const t = bestTrace(REPAINT, outlines);
  assert.deepEqual([t.from, t.scale, t.mirrored], [[482, 0, 0], 1, false]);
  assert.ok(t.iou > 0.95 && t.iou < 1, `the cape costs a little of the union (${t.iou})`);
  assert.deepEqual(bestTrace(drawn(20, 30, BODY, [1, 2, 3]), outlines).iou, 1, 'recoloured: its outline exactly');
  assert.deepEqual([bestTrace(MIRRORED, outlines).iou, bestTrace(MIRRORED, outlines).mirrored], [1, true], 'the other way round');
  assert.deepEqual([bestTrace(TWICE, outlines).iou, bestTrace(TWICE, outlines).scale], [1, 2], 'drawn at twice its size');
  assert.ok(bestTrace(OWN, outlines).iou < SILHOUETTE_IOU, 'another drawing of a body at its size does not');
  assert.equal(bestTrace(drawn(20, 30, () => true), outlines), null, 'a full picture: no outline to measure (the wall would be its twin)');
  assert.deepEqual(bestTrace(drawn(21, 30, BODY), outlines), { iou: 0, from: null, scale: 1, mirrored: false }, 'no frame of its size: measured, tracing none');
});

test('DEX0 THE SILHOUETTE GUARD REFUSES A PLANTED REPAINT - an archive whose pictures follow a TEXTURE frame\'s outline, on neither list, is refused by name; carried by the exception or allowed by the owner it passes; and a listed archive the measure does not find is refused too (mutants: the threshold unread, the allowance unread, either list unheld)', () => {
  const ledger = silhouetteLedger(CLASSIC);
  const plant = (archive, pics) => pics.forEach((p, i) => ledger.measure(archive, `${archive}_${i}-0`, p));
  plant(9001, [REPAINT, REPAINT, MIRRORED, TWICE]);   // a repaint the list missed
  plant(9002, [OWN, OWN, OWN, OWN]);                  // the authors' own
  plant(9003, [REPAINT, OWN, OWN, OWN, OWN]);         // one in five meets a frame: two drawings of a body, by chance
  plant(9004, [REPAINT, REPAINT, OWN, OWN, OWN]);     // two in five: past SILHOUETTE_TRACED
  plant(9005, [drawn(20, 30, () => true)]);           // nothing with an outline: unmeasured
  assert.equal(SILHOUETTE_TRACED, 0.25);
  assert.deepEqual(ledger.traced().map((e) => [e.archive, e.traced, e.of]), [[9001, 4, 4], [9004, 2, 5]]);
  const refused = ledger.refusals({ repainted: [], allowed: {} });
  assert.equal(refused.length, 2);
  assert.match(refused[0], /^9001: 4 of its 4 pictures trace a TEXTURE frame's outline \(9001_\d-0 follows TEXTURE\.482 record 0 frame 0/);
  assert.match(refused[0], /REPAINTED_ARCHIVES\) or as the owner allows it \(SILHOUETTE_ALLOWED/);
  assert.match(refused[1], /^9004: 2 of its 5 pictures/);
  assert.deepEqual(ledger.refusals({ repainted: [9001], allowed: { 9004: 'the owner\'s word' } }), [], 'carried, or allowed: passed');
  assert.match(ledger.refusals({ repainted: [9001] , allowed: {} })[0], /^9004:/, 'the allowance is per archive');
  // both ways
  const listed = ledger.refusals({ repainted: [9001, 9002], allowed: { 9004: 'x' } });
  assert.equal(listed.length, 1);
  assert.match(listed[0], /^9002: REPAINTED_ARCHIVES names it and the measure finds no repaint \(0 of its 4 pictures/);
  const stale = ledger.refusals({ repainted: [9001], allowed: { 9004: 'x', 9003: 'y' } });
  assert.equal(stale.length, 1);
  assert.match(stale[0], /^9003: SILHOUETTE_ALLOWED names it and the measure finds nothing to allow \(1 of its 5 pictures/);
  assert.match(ledger.refusals({ repainted: [9001, 9004, 9005], allowed: {} })[0], /^9005: .*no picture of it measured/);
});

const ARENA2 = process.env.ARENA2_PATH && existsSync(join(process.env.ARENA2_PATH, 'ART_PAL.COL')) ? process.env.ARENA2_PATH : null;
test('DEX0 THE SILHOUETTE GUARD ON THE SHIPPED ART (ARENA2): the archives whose pictures follow Daggerfall\'s outlines are the fourth exception\'s and the owner\'s one allowance, exactly - the Royal Knight among the repaints, all sixty over TEXTURE.482\'s Barbarian', { skip: !ARENA2 && 'ARENA2_PATH not set' }, () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const ledger = silhouetteLedger([...classicRecords(ARENA2, palette)]);
  for (const dir of ['public/art/daggerfall-enemy-expansion', 'public/art/daggerfall-enemy-expansion-repainted']) {
    for (const f of pngsIn(dir).filter((n) => !/_[A-Za-z]+\.png$/.test(n))) ledger.measure(Number(f.split('_')[0]), f.replace(/\.png$/, ''), readPng(readFileSync(join(ROOT, dir, f))));
  }
  assert.deepEqual(ledger.refusals(), [], 'the lists are the measure\'s');
  assert.deepEqual(ledger.traced().map((e) => e.archive), [...REPAINTED_ARCHIVES, ...Object.keys(SILHOUETTE_ALLOWED).map(Number)].sort((a, b) => a - b));
  const knight = ledger.traced().find((e) => e.archive === 1505);
  assert.deepEqual([knight.traced, knight.of, knight.best.from[0]], [60, 60, 482]);
  assert.deepEqual(Object.keys(SILHOUETTE_ALLOWED), ['1603'], 'the demo\'s Bat alone');
});

test('DEX0 the fourth exception\'s paragraph names every archive the extractor carries under it', () => {
  const para = readFileSync(join(ROOT, 'bible/01-Overview/Port-Doctrine.md'), 'utf8').split('\n').find((l) => l.includes('**THE FOURTH EXCEPTION'));
  for (const a of REPAINTED_ARCHIVES) assert.ok(new RegExp(`\\b${a}\\b`).test(para) || (a >= 1530 && a <= 1533 && para.includes('1530-1533')), `${a} named`);
  assert.match(para, /the Royal Knight \(1504 and 1505, over TEXTURE\.482\)|Royal Knight[^.]*1505/);
  assert.match(para, /The mod's 774 ship under `public\/art\/daggerfall-enemy-expansion-repainted\/`/);
});

test('DEX0 the pictures that ARE Daggerfall\'s records are specs naming the record and nothing else - no pixel of them is carried', () => {
  const derived = JSON.parse(read('derived.json'));
  assert.equal(Object.keys(derived).length, 858);
  const shipped = new Set([...listingOf('daggerfall-enemy-expansion.files.json').Files, ...listingOf('repainted.files.json').Files].map((f) => f.replace(/\.png$/, '')));
  for (const [name, spec] of Object.entries(derived)) {
    assert.deepEqual(Object.keys(spec), ['from'], `${name}: a record, whole - no edits, no size, no offset`);
    assert.ok(!shipped.has(name), `${name} is derived and shipped both`);
    const archive = Number(name.split('_')[0]);
    const want = { 1500: 492, 1501: 493, 1502: 494, 1503: 495, 1506: 491, 1610: 379 }[archive];
    assert.equal(spec.from[0], want, `${name} rebuilds from TEXTURE.${want}`);
  }
  // the wisp is TEXTURE.379's record 0 in each of its twenty records, albedo and emission alike
  assert.deepEqual(derived['1610_13-7'], { from: [379, 0, 7] });
  assert.deepEqual(derived['1610_13-7_Emission'], { from: [379, 0, 7] });
});

test('DEX0 the generated index counts the frames the three places hold as DFU imports them, and says where each archive\'s come from', () => {
  const derived = Object.keys(JSON.parse(read('derived.json')));
  const names = [...derived, ...[...listingOf('daggerfall-enemy-expansion.files.json').Files, ...listingOf('repainted.files.json').Files].map((f) => f.replace(/\.png$/, ''))];
  const held = {}, lit = {};   // archive -> record -> frames
  for (const n of names) {
    const [, a, r, f, map] = /^(\d+)_(\d+)-(\d+)(?:_(\w+))?$/.exec(n);
    (((map === 'Emission' ? lit : held)[a] ??= {})[Number(r)] ??= new Set()).add(Number(f));
  }
  assert.deepEqual(Object.keys(DEX_ART).map(Number).sort((a, b) => a - b), Object.keys(held).map(Number).sort((a, b) => a - b));
  // DEX2: TextureReplacement.GetMobileBillboardMaterial's import - a record's frames from 0 to the first one missing
  const imported = (set) => { let n = 0; while (set?.has(n)) n++; return n; };
  for (const [a, e] of Object.entries(DEX_ART)) {
    const records = Math.max(...Object.keys(held[a]).map(Number)) + 1;
    assert.deepEqual(e.frames, Array.from({ length: records }, (_, r) => imported(held[a][r])), `${a}'s frames`);
    const maps = Object.fromEntries(Object.entries(lit[a] ?? {}).map(([r, set]) => [r, [...set].filter((f) => f < e.frames[r]).sort((x, y) => x - y)]).filter(([, fs]) => fs.length));
    assert.deepEqual(e.emissive ?? {}, maps, `${a}'s emission maps, by frame`);
  }
  assert.deepEqual([DEX_ART[1500].frames[14], DEX_ART[1500].frames[4], DEX_ART[1614].emissive[20]], [1, 2, [0, 1]], 'the gaps: 1500_14 holds frames 0 and 7, 1500_4 lacks frame 2, 1614_20-2 has no map of its own');
  assert.equal(DEX_ART[1610].from, 'derived');
  assert.equal(DEX_ART[1500].from, 'own', 'the riders\' corpse (1500_20-0) is the authors\' own; the rest of the set is derived');
  assert.equal(DEX_ART[1609].from, 'repainted');
  assert.equal(DEX_ART[1505].from, 'repainted', 'AUDIT DEX B1: the Royal Knight, TEXTURE.482 under the authors\' armour');
  assert.equal(DEX_ART[1618].from, 'own');
  assert.deepEqual(DEX_ART[1611].scale[1], [0.8, 0.8], 'the Medusa\'s scale, out of 1611_1-0.xml');
  assert.equal(DEX_ART[1610].emission, true, '1610.xml: <emission>True</emission>');
  assert.equal(DEX_ART[1614].emission, true, '1614.xml');
});

test('DEX0 the mod\'s switch and its one key, as modsettings.json ships it', () => {
  const shipped = JSON.parse(read('modsettings.json'));
  const key = shipped.Sections[0].Keys[0];
  const ours = MOD_SETTINGS['daggerfall-enemy-expansion'];
  assert.equal(ours.author, JSON.parse(read('daggerfall-enemy-expansion.dfmod.json')).ModAuthor);
  assert.deepEqual(Object.keys(ours.keys), ['Enabled', `${shipped.Sections[0].Name}.${key.Name}`]);
  assert.equal(ours.keys.Enabled.default, true);
  assert.equal(ours.keys['Cheat.DisableTrollRespawn'].default, key.Value);
  assert.equal(ours.keys['Cheat.DisableTrollRespawn'].description, key.Description);
});
