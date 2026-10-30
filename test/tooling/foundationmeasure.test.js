// FOUNDATION F0 (bible/03-World/Foundation-Arc.md): THE MEASUREMENT PASS (tools/foundationMeasure.mjs) - each figure
// re-taken by one written method. On a fixture tree every count is known, so a method that drifts fails here; on the
// real tree the four hosts are found and the layers read. Pins mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { HOSTS, measureHosts, measureTests, measureLayer, measureArt, measureBible, measureTextRings, measureMessageRing, measureSkins, measureAll } from '../../tools/foundationMeasure.mjs';

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'foundation-'));
  const put = (p, text) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text); };
  for (const [file, name] of HOSTS) put(file, `export function ${name}() {\n  const a = 1;\n  // a comment\n  return a;\n}\nfunction small() { return 0; }\n`);
  put('test/a.test.js', "import { readFileSync } from 'node:fs';\nconst src = readFileSync('../src/x.js', 'utf8');\nassert.match(src, /x/);\nassert.equal(1, 1);\nassert.ok(src.includes('y'));\n");
  put('test/b.test.js', 'assert.deepEqual([1], [1]);\nassert(true);\n');
  put('test/helper.mjs', 'assert.match(a, /b/);\n');
  put('src/systems/pure.js', 'export const a = 1;\n');
  put('src/systems/drawn.js', "import { x } from '../render/renderer.js';\n");
  put('src/systems/paged.js', 'export const w = () => document.body;\n');
  put('src/formats/reader.js', 'export const r = 1;\n');
  put('src/scenes/townTalk.js', "const hud = new HudText('town');\n");
  put('public/art/a.png', 'xx');
  put('vendor/mod/b.PNG', 'xyz');
  put('bible/Home.md', 'one two three\nfour\n');
  put('src/ui/enhanced/enhancedPorts.js', 'export const PORT_SPECS = Object.freeze({ guild, bank });\nisEnhanced();\n');
  put('src/ui/talkDoor.js', 'isEnhancedPlus();\n');
  return root;
};

test('F0 the method on a fixture tree: a host\'s lines and logical lines, the assertions and the text pins and the files that read our source, a layer\'s files that reach presentation, the PNGs, the bible\'s words, the PopupText rings (mutants: each counter\'s pattern)', () => {
  const root = fixture();
  try {
    assert.deepEqual(measureHosts(root).map((h) => [h.name, h.lines, h.logical]), HOSTS.map(([, name]) => [name, 5, 2]));
    assert.deepEqual(measureTests(root), { files: 2, asserts: 5, textPins: 2, readerFiles: 1, readerAsserts: 3, readerTextPins: 2 });
    assert.deepEqual(measureLayer('src/systems', root), { dir: 'src/systems', files: 3, touching: 2, list: ['src/systems/drawn.js', 'src/systems/paged.js'] });
    assert.deepEqual(measureLayer('src/formats', root).touching, 0);
    assert.deepEqual(measureArt(root), { public: { files: 1, bytes: 2 }, vendor: { files: 1, bytes: 3 }, src: { files: 0, bytes: 0 } });
    assert.deepEqual(measureBible(root), { pages: 1, lines: 3, words: 4 });
    assert.deepEqual(measureTextRings(root), ['src/scenes/townTalk.js']);
    assert.deepEqual(measureMessageRing(root).map(([, w]) => w), [false, false, false, false]);
    assert.deepEqual(measureSkins(root), { enhancedFiles: 1, enhancedLines: 3, doors: 1, ports: 2, calls: 2 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('F0 on this tree: the four hosts found and measured, the suite and the layers read (the figures themselves are the audit\'s record, not pinned - they move with every change)', () => {
  const m = measureAll();
  assert.deepEqual(m.hosts.map((h) => h.name), ['bootWorld', 'createWorldModes', 'buildDungeonContext', 'bootExterior']);
  assert.ok(m.hosts.every((h) => h.lines > 1000 && h.logical > 1000));
  assert.ok(m.tests.files > 1000 && m.tests.readerFiles > 0 && m.tests.asserts > m.tests.textPins);
  assert.ok(m.systems.files > m.systems.touching && m.formats.files > 0);
  assert.ok(m.textRings.includes('src/scenes/dungeonContext.js'));
  assert.deepEqual(m.ring, HOSTS.map(([, name]) => [name, true]), 'all four hosts file the HUD\'s lines in the message ring');
  assert.ok(m.skins.doors > 0 && m.skins.ports > 0);
});
