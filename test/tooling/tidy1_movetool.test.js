import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { planMove, rewriteSpecifiers, rewritePaths, rewriteRecords, rewriteQuotedImports, specifierChanges, blindSpots, brokenBy, relayHits, composeLedger, rebaseOwnDir, TEXT_EXT } from '../../tools/moveModule.mjs';

// TIDY1 (2026-10-16, bible/01-Overview/Code-Map.md): THE MOVE TOOL, RULE BY RULE (tools/moveModule.mjs). Each form of
// an address it rewrites, each it re-bases in a moved file, each it cannot follow and names (BLIND), and its command
// line - pinned on fixtures, because a form it misses is an address left pointing at nothing. The tree's own gates (the
// map, no address left, every import resolving, every glob) are tidy1_codemap.test.js's. AUDIT TIDY split the two:
// these run in seconds, so the tool's mutants (tools/mutants/tidy1.json) are judged against this file alone.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('TIDY1: the move tool rewrites every address of a moved file', () => {
  const moved = new Map([['src/systems/arenaBout.js', 'src/systems/arena/arenaBout.js'], ['src/systems/arenaText.js', 'src/systems/arena/arenaText.js']]);
  // an importer that stays: the four specifier forms, a query's tail, and a neighbour that did not move
  const importer = [
    "import { a } from '../systems/arenaBout.js';",
    "export * from '../systems/arenaBout.js';",
    "import '../systems/arenaBout.js';",
    "const m = await import('../systems/arenaBout.js');",
    "const u = new URL('../systems/arenaBout.js', import.meta.url);",
    "import raw from '../systems/arenaBout.js?raw';",
    "import { b } from '../systems/arenaBook.js';",
  ].join('\n');
  assert.equal(rewriteSpecifiers(importer, 'src/net/arenaLink.js', 'src/net/arenaLink.js', moved).text, [
    "import { a } from '../systems/arena/arenaBout.js';",
    "export * from '../systems/arena/arenaBout.js';",
    "import '../systems/arena/arenaBout.js';",
    "const m = await import('../systems/arena/arenaBout.js');",
    "const u = new URL('../systems/arena/arenaBout.js', import.meta.url);",
    "import raw from '../systems/arena/arenaBout.js?raw';",
    "import { b } from '../systems/arenaBook.js';",
  ].join('\n'));
  // the moved file itself: its specifiers re-based, a moved sibling kept beside it, a page's URL left alone
  const self = [
    "import { audio } from './audio.js';",
    "import { T } from './arenaText.js';",
    "const p = fetch('./sfx/crowd.ogg');",
    "const i = new URL('./art/x.png', document.baseURI);",
    "const s = (name) => new URL(`../../vendor/csa/Sounds/${name}.ogg`, import.meta.url).href;",
  ].join('\n');
  assert.equal(rewriteSpecifiers(self, 'src/systems/arenaBout.js', 'src/systems/arena/arenaBout.js', moved).text, [
    "import { audio } from '../audio.js';",
    "import { T } from './arenaText.js';",
    "const p = fetch('./sfx/crowd.ogg');",
    "const i = new URL('./art/x.png', document.baseURI);",
    "const s = (name) => new URL(`../../../vendor/csa/Sounds/${name}.ogg`, import.meta.url).href;",   // a template's file is chosen at run time, its folder is not
  ].join('\n'));
  // the paths: a pin's, a test's URL, a page's root path, the bible's src path and cite - and what only looks like them
  const prose = [
    "rd('src/systems/arenaBout.js')",
    "new URL('../src/systems/arenaBout.js', import.meta.url)",
    '<script type="module" src="/src/systems/arenaBout.js">',
    '`systems/arenaBout.js:' + '"export function newBout"`',   // a cite's path form, split so the cite scanner reads no anchor here
    '"file": "src/systems/arenaText.js"',
    "assert.ok(!from.includes('../systems/arenaBout.js'))",
    'server/src/systems/arenaBout.js',
    'src/systems/arenaBout.json',
    'xsystems/arenaBout.js',
  ].join('\n');
  const out = rewritePaths(prose, moved);
  assert.equal(out.text, [
    "rd('src/systems/arena/arenaBout.js')",
    "new URL('../src/systems/arena/arenaBout.js', import.meta.url)",
    '<script type="module" src="/src/systems/arena/arenaBout.js">',
    '`systems/arena/arenaBout.js:' + '"export function newBout"`',
    '"file": "src/systems/arena/arenaText.js"',
    "assert.ok(!from.includes('../systems/arena/arenaBout.js'))",
    'server/src/systems/arenaBout.js',
    'src/systems/arenaBout.json',
    'xsystems/arenaBout.js',
  ].join('\n'));
  assert.equal(out.n, 6, 'a pin quoting another file\'s import is rewritten too - or its negative pin would pass on nothing');
  assert.equal(rewritePaths(out.text, moved).n, 0, 'a second pass finds nothing: the rewrite is its own fixed point');
  // escaped for a pattern: the root path, the src path, and a specifier a pin quotes
  const pat = String.raw`/src\/systems\/arenaBout\.js/ /systems\/arenaBout\.js/ /from '\.\.\/systems\/arenaBout\.js'/ /xsystems\/arenaBout\.js/`;
  assert.equal(rewritePaths(pat, moved).text,
    String.raw`/src\/systems\/arena\/arenaBout\.js/ /systems\/arena\/arenaBout\.js/ /from '\.\.\/systems\/arena\/arenaBout\.js'/ /xsystems\/arenaBout\.js/`);
  // the bible's own spelling of a page, plain and escaped
  const page = new Map([['bible/01-Overview/Field-Bugs-2026-10-14.md', 'bible/01-Overview/records/Field-Bugs-2026-10-14.md']]);
  assert.equal(rewritePaths(String.raw`\`01-Overview/Field-Bugs-2026-10-14.md\` rd('bible/01-Overview/Field-Bugs-2026-10-14.md') /01-Overview\/Field-Bugs-2026-10-14\.md/`, page).text,
    String.raw`\`01-Overview/records/Field-Bugs-2026-10-14.md\` rd('bible/01-Overview/records/Field-Bugs-2026-10-14.md') /01-Overview\/records\/Field-Bugs-2026-10-14\.md/`);
  // the whole plan: the moved file is written at its new path, a migration is a record and is left as it stands
  const texts = new Map([
    ['src/systems/arenaBout.js', "import { audio } from './audio.js';\n"],
    ['src/net/arenaLink.js', "import { a } from '../systems/arenaBout.js';\n"],
    ['server-account/migrations/0074_arena.sql', '-- src/systems/arenaBout.js\n'],
  ]);
  const plan = planMove([...moved].slice(0, 1), texts);
  assert.deepEqual([...plan.writes.keys()].sort(), ['src/net/arenaLink.js', 'src/systems/arena/arenaBout.js']);
  assert.equal(plan.writes.get('src/systems/arena/arenaBout.js'), "import { audio } from '../audio.js';\n");
  // what the move broke is what named a file before and names none after - not what never named one
  const was = (p) => ['src/systems/arenaBout.js', 'src/systems/audio.js'].includes(p), now = (p) => ['src/systems/arena/arenaBout.js', 'src/systems/audio.js'].includes(p);
  assert.deepEqual(brokenBy("import { audio } from './audio.js';", 'src/systems/arenaBout.js', "import { audio } from './audio.js';", 'src/systems/arena/arenaBout.js', was, now),
    ['src/systems/arena/arenaBout.js: ./audio.js'], 'a moved file\'s import left un-based is broken');
  assert.deepEqual(brokenBy("await import('./src/systems/arenaBout.js');", 'test/x.test.js', "await import('./src/systems/arena/arenaBout.js');", 'test/x.test.js', was, now),
    [], 'a root-relative import run through node -e named nothing from test/ before either');
  const dirs = (p) => ['vendor/csa', 'src/systems/arena'].includes(p);
  const tpl = (at) => `new URL(\`${at}/csa/\${name}.ogg\`, import.meta.url)`;
  assert.deepEqual(brokenBy(tpl('../../vendor'), 'src/systems/arenaBout.js', tpl('../../vendor'), 'src/systems/arena/arenaBout.js', dirs, dirs),
    ['src/systems/arena/arenaBout.js: ../../vendor/csa/${name}.ogg'], 'a template whose folder is gone after the move is broken');
});

test('TIDY1: the move tool rewrites a mutant record\'s source as if it stood in the record\'s file', () => {
  const moved = new Map([['src/systems/arenaBout.js', 'src/systems/arena/arenaBout.js']]);
  const list = JSON.stringify([
    { name: 'a', file: 'src/ui/arenaHud.js', old: "import { b } from '../systems/arenaBout.js';", new: "import { b } from '../systems/arenaBout.js'; b();", tests: [] },
    { name: 'b', file: 'src/systems/arenaBout.js', old: "import { audio } from './audio.js';", new: '', tests: [] },
  ], null, 2);
  const r = rewriteRecords(list, moved, 'tools/mutants/x.json');
  assert.deepEqual(JSON.parse(r.text).map((x) => x.old), ["import { b } from '../systems/arena/arenaBout.js';", "import { audio } from '../audio.js';"]);
  assert.equal(JSON.parse(r.text)[0].new, "import { b } from '../systems/arena/arenaBout.js'; b();");
  assert.deepEqual(r.blind, []);
  // one quoted source two records need two ways is named, never guessed
  const twice = JSON.stringify([
    { name: 'a', file: 'src/ui/arenaHud.js', old: "from '../systems/arenaBout.js'", new: '', tests: [] },
    { name: 'b', file: 'src/ui/sub/deeper.js', old: "from '../systems/arenaBout.js'", new: '', tests: [] },
  ]);
  const t = rewriteRecords(twice, moved, 'tools/mutants/y.json');
  assert.equal(t.text, twice);
  assert.equal(t.blind.length, 1);
});

test('TIDY2: a pin quoting an import follows it where the move re-based it - read before the path pass, never against a file that kept it', () => {
  // the importer and its target both move: the pin's quote is found in its OLD spelling, before any path in it is rewritten
  const moves = [['src/ui/a.js', 'src/ui/q/a.js'], ['src/systems/x.js', 'src/systems/k/x.js']];
  const texts = new Map([
    ['src/ui/a.js', "import { x } from '../systems/x.js';\n"],
    ['src/systems/x.js', 'export const x = 1;\n'],
    ['test/a.test.js', String.raw`assert.match(rd('src/ui/a.js'), /from '\.\.\/systems\/x\.js'/); assert.ok(rd('src/ui/a.js').includes("from '../systems/x.js'"));`],
  ]);
  assert.equal(planMove(moves, texts).writes.get('test/a.test.js'),
    String.raw`assert.match(rd('src/ui/q/a.js'), /from '\.\.\/\.\.\/systems\/k\/x\.js'/); assert.ok(rd('src/ui/q/a.js').includes("from '../../systems/k/x.js'"));`);
  // a file the pin also names still spells it the old way: which file the pin reads is not known - named, not guessed
  const changes = new Map([
    ['src/ui/a.js', specifierChanges("from '../systems/x.js'", "from '../../systems/x.js'")],
    ['src/ui/b.js', new Map([['../systems/x.js', '../systems/x.js']])],
  ]);
  const both = "for (const f of ['src/ui/a.js', 'src/ui/b.js']) assert.match(rd(f), /from '\\.\\.\\/systems\\/x\\.js'/);";
  const r = rewriteQuotedImports(both, changes, 'test/b.test.js');
  assert.equal(r.text, both);
  assert.equal(r.blind.length, 1);
});

test('TIDY5: a file moved a folder deeper keeps every root it had - a folder, a require, a concatenated root, its own folder', () => {
  const moves = [['test/x.test.js', 'test/net/x.test.js'], ['test/y.test.js', 'test/net/y.test.js']];
  const x = [
    "import { join, dirname } from 'node:path';",
    "import { a } from '../src/net/wire.js';",
    "const root = join(dirname(fileURLToPath(import.meta.url)), '..');",
    'const here = dirname(fileURLToPath(import.meta.url));',
    "const top = path.join(path.dirname(new URL(import.meta.url).pathname), '..');",
    'const at = path.dirname(fileURLToPath(import.meta.url));',
    'const d = import.meta.dirname;',
    "const r = new URL('../', import.meta.url);",
    "const s = new URL('..', import.meta.url);",
    "const f = new URL('fixtures/a.json', import.meta.url);",
    "const req = require('../tools/lib/x.cjs');",
    "const L = createRequire(import.meta.url)('../app/lib/x.cjs');",
    "const rd = (p) => readFileSync(new URL('../' + p, import.meta.url));",
    "const read = (p) => readFileSync(new URL(p, import.meta.url));",
    "const png = (key) => new URL(`../vendor/skins/${key.split('_')[0]}/${key}.png`, import.meta.url);",
    "assert.ok(hosts.includes(`from '../ui/${door}.js'`));",
    `spawnSync('node', ['-e', "import('./src/net/wire.js')"]);   // test/y.test.js`,
  ].join('\n');
  const there = new Set(['src/net/wire.js', 'tools/lib/x.cjs', 'app/lib/x.cjs', 'test/fixtures/a.json']);
  const texts = new Map([['test/x.test.js', x], ['test/y.test.js', "import { a } from '../src/net/wire.js';\n"]]);
  const plan = planMove(moves, texts, (p) => there.has(p));
  assert.equal(plan.writes.get('test/net/x.test.js'), [
    "import { join, dirname } from 'node:path';",
    "import { a } from '../../src/net/wire.js';",   // once: a test's own import is no subject a pin of another test quotes
    "const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');",
    'const here = dirname(dirname(fileURLToPath(import.meta.url)));',
    "const top = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');",   // off the URL's pathname, path's own
    'const at = path.dirname(path.dirname(fileURLToPath(import.meta.url)));',
    "const d = join(import.meta.dirname, '..');",
    "const r = new URL('../../', import.meta.url);",   // a folder keeps its slash
    "const s = new URL('../..', import.meta.url);",
    "const f = new URL('../fixtures/a.json', import.meta.url);",
    "const req = require('../../tools/lib/x.cjs');",
    "const L = createRequire(import.meta.url)('../../app/lib/x.cjs');",
    "const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url));",
    "const read = (p) => readFileSync(new URL(p, import.meta.url));",
    "const png = (key) => new URL(`../../vendor/skins/${key.split('_')[0]}/${key}.png`, import.meta.url);",   // a template that quotes inside its ${}
    "assert.ok(hosts.includes(`from '../ui/${door}.js'`));",   // a static from takes no template: a host's import, quoted - left
    `spawnSync('node', ['-e', "import('./src/net/wire.js')"]);   // test/net/y.test.js`,   // a child's root-relative import named nothing from test/: left
  ].join('\n'));
  // a URL whose path its caller hands it - `read('../src/x.js')` - is no specifier the tool can see: named, not guessed
  assert.deepEqual(plan.blind.filter((b) => /from a variable/.test(b)).map((b) => b.split(':')[0]), ['test/net/x.test.js']);
  // a test's name escaped for a pattern escapes its own dots too: `online\.test\.js` is no test.js
  assert.equal(rewritePaths('/`test\\/online\\.test\\.js` \\(9\\)/', new Map([moves[0], ['test/online.test.js', 'test/net/online.test.js']])).text,
    '/`test\\/net\\/online\\.test\\.js` \\(9\\)/');
  // the parity scripts name tests and modules too (tools/parity/prepare.sh, tools/roadsOracle.py)
  assert.ok(TEXT_EXT.test('tools/parity/prepare.sh') && TEXT_EXT.test('tools/roadsOracle.py'), 'a .sh or .py is read for addresses');
  // and without the existence check: a test that names another is not re-based twice through it
  const pair = new Map([['test/x.test.js', "import { a } from '../src/a.js';   // test/y.test.js"], ['test/y.test.js', "import { a } from '../src/a.js';\n"]]);
  assert.equal(planMove(moves, pair).writes.get('test/net/x.test.js'), "import { a } from '../../src/a.js';   // test/net/y.test.js");
  // a gone file a negative pin names, from where the test stood: left by the existence check - a fixture's text reads the
  // same - and named for a reader to decide; a `node -e` child's root-relative import, whose folder is none, is not
  const gone = planMove([moves[0]], new Map([['test/x.test.js', "assert.ok(!existsSync(new URL('../src/ui/gone.js', import.meta.url)));"]]), (p) => ['src', 'src/ui'].includes(p));
  assert.equal(gone.blind.filter((b) => /a negative pin names/.test(b)).length, 1);
  assert.equal(plan.blind.filter((b) => /a negative pin names/.test(b)).length, 0);
  // a test is no subject a pin quotes: one that stays and names a moved test keeps a fixture in that test's spelling
  const fixture = planMove(moves, new Map([...pair, ['test/z.test.js', "// test/y.test.js\nconst src = \"import { a } from '../src/a.js';\";"]]));
  assert.equal(fixture.writes.get('test/z.test.js'), "// test/net/y.test.js\nconst src = \"import { a } from '../src/a.js';\";");
  // a file that stays has no root to re-base, however its URL is built
  const stay = "const rd = (p) => readFileSync(new URL('../' + p, import.meta.url));";
  assert.equal(rewriteSpecifiers(stay, 'test/z.test.js', 'test/z.test.js', new Map(moves)).text, stay);
});

test('TIDY2: the ledger leads every path a file ever stood at to where it stands, and forgets one moved home', () => {
  assert.deepEqual(composeLedger([['src/a/x.js', 'src/a/b/x.js'], ['src/c/y.js', 'src/c/d/y.js'], ['src/a/b/x.js', 'src/a/e/x.js'], ['src/c/d/y.js', 'src/c/y.js']]),
    [['src/a/x.js', 'src/a/e/x.js'], ['src/a/b/x.js', 'src/a/e/x.js'], ['src/c/d/y.js', 'src/c/y.js']]);
});

test('TIDY1: the move tool names the sweeps it cannot follow', () => {
  const dirs = ['src/systems'];
  const at = (line) => blindSpots(line, 'test/x.test.js', dirs);
  assert.equal(at("readdirSync(join(root, 'src/systems')).filter((f) => f.endsWith('.js'))").length, 1, 'a sweep that does not recurse');
  assert.equal(at("readdirSync(new URL('../src/systems/', import.meta.url))").length, 1, 'by its URL too');
  assert.equal(at("readdirSync(join(root, 'src/systems'), { recursive: true })").length, 0, 'a recursing sweep still sees a moved file');
  assert.equal(at('const m = await import(`../systems/${name}.js`);').length, 1, 'an import built from a template');
  assert.equal(at('const u = new URL(`../systems/${name}.js`, import.meta.url);').length, 1, 'a URL built from a template');
  assert.equal(at('const m = await import(`../src/systems/livingWorld/x.js?t=${Date.now()}`);').length, 0, 'a template whose path is whole');
  // what no rewrite can place: a sibling's quoted ./x.js outside the folder it moved to, and a path escaped for a pattern
  const moved = new Map([['src/systems/arenaBout.js', 'src/systems/arena/arenaBout.js'], ['src/systems/arenaText.js', 'src/systems/arena/arenaText.js']]);
  assert.equal(blindSpots("assert.match(src, /from '\\.\\/arenaBout\\.js'/); x.includes('./arenaBout.js')", 'test/x.test.js', dirs, moved).length, 1, 'a quoted ./arenaBout.js');
  assert.equal(blindSpots("import { T } from './arenaText.js';", 'src/systems/arena/arenaBout.js', dirs, moved).length, 0, 'an import\'s own ./ is the specifier pass\'s');
  assert.equal(blindSpots("const own = src.includes('./arenaText.js');", 'src/systems/arena/arenaBout.js', dirs, moved).length, 0, 'beside it in the new folder, a quoted ./ is right');
  // AUDIT TIDY A-1: a workflow's path glob that matched a moved file where it stood and not where it goes - the intro
  // workflow's `src/ui/intro*.js` lost the four intro modules to src/ui/intro/ and would have stopped running for them
  const wf = (glob) => planMove([['src/ui/introMap.js', 'src/ui/intro/introMap.js']], new Map([['.github/workflows/x.yml', `on:\n  pull_request:\n    paths:\n      - '${glob}'\n`]])).blind;
  assert.equal(wf('src/ui/intro*.js').length, 1, 'a glob the move left behind is named');
  assert.equal(wf('src/ui/intro/**').length + wf('src/**').length + wf('src/ui/**/*.js').length, 0, 'one that still matches is not');
});

test('TIDY1: the move tool names every file of the relay\'s bundle it would change', () => {
  // a byte of the relay's bundle is its version (test/net/relayversion.test.js), and a new version is a deploy that drops
  // every connected player - the tool refuses those moves unless told --relay (bible/01-Overview/Code-Map.md)
  const relay = new Set(['server/src/index.js', 'src/net/wire.js', 'src/systems/arenaBout.js']);
  const texts = new Map([['src/net/wire.js', "import { a } from '../systems/arenaBout.js';"], ['src/net/homeLaw.js', '// x'], ['server/src/index.js', '// y'],
    ['src/systems/arenaBout.js', "import { m } from '../world/mat4.js';"]]);
  const back = new Map([['src/systems/arena/arenaBout.js', 'src/systems/arenaBout.js']]);
  const hits = (moved) => relayHits(new Map([['src/net/wire.js', "import { a } from '../systems/arena/arenaBout.js';"], ['src/systems/arena/arenaBout.js', moved],
    ['src/net/homeLaw.js', '// z'], ['server/src/index.js', '// y']]), texts, back, relay);
  assert.deepEqual(hits("import { m } from '../../world/mat4.js';"), ['src/net/wire.js', 'src/systems/arena/arenaBout.js'],
    'the importer\'s specifier and the moved file\'s re-based one both change the relay\'s bytes; a file outside the bundle is not the relay\'s; one written back as it was is no change');
  assert.deepEqual(hits("import { m } from '../world/mat4.js';"), ['src/net/wire.js'], 'a moved file whose bytes stand changes no hash of its own');
});

test('AUDIT TIDY: the move tool re-bases a moved module\'s globs, names a glob a move empties, and reads a root path off a host', () => {
  // SRC-1: GLOBBED - a moved module's import.meta.glob, one pattern or an array (a negated one too), its static folder
  // re-based and its pattern kept; a module that stays keeps its globs
  const moved = new Map([['src/scenes/questData.js', 'src/scenes/quest/questData.js']]);
  const src = [
    "const q = import.meta.glob('../../vendor/dfu-quests/Quests/*.txt', { query: '?raw', import: 'default' });",
    "const b = import.meta.glob(['../../locales/*/pack/**/*.csv', '!../../locales/x/*.csv'], { eager: true });",
  ].join('\n');
  assert.equal(rewriteSpecifiers(src, 'src/scenes/questData.js', 'src/scenes/quest/questData.js', moved).text, [
    "const q = import.meta.glob('../../../vendor/dfu-quests/Quests/*.txt', { query: '?raw', import: 'default' });",
    "const b = import.meta.glob(['../../../locales/*/pack/**/*.csv', '!../../../locales/x/*.csv'], { eager: true });",
  ].join('\n'));
  assert.equal(rewriteSpecifiers(src, 'src/scenes/questData.js', 'src/scenes/questData.js', new Map()).text, src);
  // a module that stays, globbing a folder a file moved out of: named
  const left = planMove([['src/systems/skyA.js', 'src/systems/sky/skyA.js']], new Map([['src/scenes/loader.js', "const all = import.meta.glob('../systems/sky*.js');"]]));
  assert.equal(left.blind.filter((b) => /import\.meta\.glob/.test(b)).length, 1);
  // SRC-4: a root path in a URL off a host is a root path; a page's own spelling after a host is not
  const mv = new Map([['src/ui/profHud.js', 'src/ui/professions/profHud.js']]);
  assert.equal(rewritePaths("page.goto('http://localhost:5241/src/ui/profHud.js'); fetch('https://x.io/ui/profHud.js');", mv).text,
    "page.goto('http://localhost:5241/src/ui/professions/profHud.js'); fetch('https://x.io/ui/profHud.js');");
});

test('AUDIT TIDY TOOL-1..TOOL-6: a negative pin its subject outgrew is named; a kept spelling vetoes a quote; a frozen file keeps its fixtures; a bare name, another tree, a moved .css, a resolve', () => {
  const ex = (s) => (p) => s.includes(p);
  // TOOL-1: a pin that an import is ABSENT, quoting its subject's spelling where the subject no longer is
  const neg = planMove([['src/ui/enhancedHelm.js', 'src/ui/enhanced/enhancedHelm.js']], new Map([['src/ui/enhancedHelm.js', 'export const h = 1;'],
    ['test/x.test.js', "const helm = rd('src/ui/enhancedHelm.js');\nassert.ok(!helm.includes(\"from './hudLayout.js'\"));\nassert.doesNotMatch(helm, /from '\\.\\.\\/net\\//);\nassert.doesNotMatch(helm, /from '(?:\\.\\.\\/)+ui\\//);"]]),
    ex(['src/ui/hudLayout.js', 'src/ui', 'src', 'src/net', 'src/ui/enhancedHelm.js'])).blind.filter((b) => /a negative pin/.test(b));
  assert.deepEqual(neg.map((b) => b.split(':').slice(0, 2).join(':')), ['test/x.test.js:2', 'test/x.test.js:3'], 'the two that pass on anything; the one at any depth is sound');
  // the file a pin reads decides it: a moved one bound to a name, its spellings in an array, is named; a file that did
  // not move is sound whatever else the test names; a path a pin READS (`new URL('../../src/...')`) is no spelling
  const bind = planMove([['src/ui/enhancedHelm.js', 'src/ui/enhanced/enhancedHelm.js']], new Map([['src/ui/enhancedHelm.js', 'export const h = 1;'],
    ['test/y.test.js', [
      "const from = [...rd('src/ui/enhancedHelm.js').matchAll(/x/g)];",
      "for (const heavy of ['../systems/csa/boat.js']) assert.ok(!from.includes(heavy));",
      "const leaf = rd('src/systems/statusReadout.js');",
      "assert.equal(/from '\\.\\.\\/ui\\//.test(leaf), false);",
      "assert.doesNotMatch(readFileSync(new URL('../src/systems/loot.js', import.meta.url), 'utf8'), /x/);   // src/ui/enhancedHelm.js",
      "assert.doesNotMatch(readFileSync(new URL('../ui/enhancedHelm.js', import.meta.url), 'utf8'), /y/);",
    ].join('\n')]]), ex(['src/systems/csa/boat.js', 'src/systems/csa', 'src/systems', 'src/ui', 'src', 'src/systems/statusReadout.js', 'src/systems/loot.js', 'src/ui/enhancedHelm.js']))
    .blind.filter((b) => /a negative pin/.test(b));
  assert.deepEqual(bind.map((b) => b.split(':').slice(0, 2).join(':')), ['test/y.test.js:2']);
  // TOOL-2: a file the pin also names kept the spelling - named, not guessed; and the test's own import is its own
  const two = planMove([['src/ui/a.js', 'src/ui/q/a.js']], new Map([['src/ui/a.js', "import { b } from './b.js';\n"], ['src/ui/b.js', 'export const b = 1;'], ['src/ui/c.js', "import { b } from './b.js';\n"],
    ['test/t.test.js', "import { h } from './helpers.js';\nfor (const f of ['src/ui/a.js', 'src/ui/c.js']) assert.ok(rd(f).includes(\"from './b.js'\"));"]]), ex(['src/ui/b.js', 'src/ui', 'test/helpers.js']));
  assert.equal(two.writes.get('test/t.test.js'), "import { h } from './helpers.js';\nfor (const f of ['src/ui/q/a.js', 'src/ui/c.js']) assert.ok(rd(f).includes(\"from './b.js'\"));");
  assert.equal(two.blind.filter((b) => /two ways/.test(b)).length, 1);
  const own = planMove([['src/ui/a.js', 'src/ui/q/a.js']], new Map([['src/ui/a.js', "import { b } from './b.js';\n"], ['src/ui/b.js', 'export const b = 1;'],
    ['test/t2.test.js', "import { helper } from './b.js';\nassert.ok(rd('src/ui/a.js').includes(\"from './b.js'\"));"]]), ex(['src/ui/b.js', 'src/ui', 'test/b.js']));
  assert.equal(own.writes.get('test/t2.test.js'), "import { helper } from './b.js';\nassert.ok(rd('src/ui/q/a.js').includes(\"from '../b.js'\"));", 'the pin follows; the test\'s own import is its own');
  // TOOL-3: a frozen file that moves re-bases its own top-level lines, never a fixture it quotes
  const frozen = planMove([['test/tooling/tidy1_codemap.test.js', 'test/tooling/x/tidy1_codemap.test.js']], new Map([['test/tooling/tidy1_codemap.test.js',
    "import { a } from '../../src/a.js';\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');\ntest('x', () => {\n  const s = \"import { b } from '../src/b.js';\";\n});"]]), ex(['src/a.js', 'src/b.js', 'src']));
  assert.equal(frozen.writes.get('test/tooling/x/tidy1_codemap.test.js'),
    "import { a } from '../../../src/a.js';\nconst root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');\ntest('x', () => {\n  const s = \"import { b } from '../src/b.js';\";\n});");
  // TOOL-4: a file directly under src/ has no src spelling but its name, which the move keeps
  assert.equal(rewritePaths("src/main.js; main.js:\"if (params.has\"; the main.js boot", new Map([['src/main.js', 'src/boot/main.js']])).text, "src/boot/main.js; main.js:\"if (params.has\"; the main.js boot");
  // TOOL-10: a server's `../net/x.js` is its own tree's; a test's quote of the client's is the client's
  const net = new Map([['src/net/foo.js', 'src/net/foo/foo.js']]);
  assert.equal(rewritePaths("from '../net/foo.js'", net, undefined, 'server/src/rooms/x.js').text, "from '../net/foo.js'");
  assert.equal(rewritePaths("from '../net/foo.js'", net, undefined, 'test/net/x.test.js').text, "from '../net/foo/foo.js'");
  // TOOL-5: a moved file of any extension is looked for by its own
  assert.equal(rewritePaths("rd('src/ui/hud.css')", new Map([['src/ui/hud.css', 'src/ui/hud/hud.css']])).text, "rd('src/ui/hud/hud.css')");
  // TOOL-6: a path resolved without loading it
  assert.equal(rewriteSpecifiers("require.resolve('./a.js'); import.meta.resolve('./a.js');", 'src/x.js', 'src/x.js', new Map([['src/a.js', 'src/k/a.js']])).text,
    "require.resolve('./k/a.js'); import.meta.resolve('./k/a.js');");
  // and the guards a probe found unpinned: a page's own `/systems/x.js`, plain and escaped, is no src path
  const arena = new Map([['src/systems/arenaBout.js', 'src/systems/arena/arenaBout.js']]);
  assert.equal(rewritePaths(String.raw`fetch('/systems/arenaBout.js') /\/systems\/arenaBout\.js/`, arena).text, String.raw`fetch('/systems/arenaBout.js') /\/systems\/arenaBout\.js/`);
  // a moved file that finds its folder through import.meta.dirname with no join to raise it, or that moved UP: named
  assert.equal(rebaseOwnDir('const d = import.meta.dirname;', 1, 'test/a/x.test.js').blind.length, 1);
  assert.equal(rebaseOwnDir("import { join } from 'node:path';\nconst d = import.meta.dirname;", 1, 'test/a/x.test.js').blind.length, 0);
  assert.equal(planMove([['test/a/x.test.js', 'test/x.test.js']], new Map([['test/a/x.test.js', "const r = join(dirname(fileURLToPath(import.meta.url)), '..', '..');"]])).blind.filter((b) => /moved up/.test(b)).length, 1);
  // a root concatenated without its slash keeps going without one
  assert.equal(rewriteSpecifiers("new URL('..' + p, import.meta.url)", 'test/x.test.js', 'test/a/x.test.js', new Map([['test/x.test.js', 'test/a/x.test.js']])).text, "new URL('../..' + p, import.meta.url)");
  // a list that changed length is named whole, and is no rename
  assert.deepEqual(brokenBy('', 'x.js', "import a from './gone.js';", 'x.js', () => false, () => false), ['x.js: ./gone.js']);
  assert.equal(specifierChanges("from './a.js'", "from './b.js'; from './c.js'").size, 0);
  // a sweep that names its folder off src/ (`join(SRC, 'systems')`) is a sweep of it
  assert.equal(blindSpots("readdirSync(join(SRC, 'systems')).filter((f) => f.endsWith('.js'))", 'test/x.test.js', ['src/systems']).length, 1);
});

test('AUDIT TIDY TOOL-7..TOOL-9: the command line refuses the relay, a rename, a broken import, colliding moves and a revived path; it moves, keeps the ledger, and --fixup mends a branch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tidy-cli-'));
  try {
    const put = (p, s) => { mkdirSync(join(dir, dirname(p)), { recursive: true }); writeFileSync(join(dir, p), s); };
    for (const f of ['tools/moveModule.mjs', 'tools/lib/isMain.mjs', 'test/importGraph.mjs']) put(f, rd(f));
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
    put('.gitignore', 'node_modules\nplan.json\n');
    put('server/src/index.js', "import { w } from '../../src/net/wire.js';\nexport default w;\n");
    put('src/net/wire.js', 'export const w = 1;   // see src/systems/a.js\n');
    put('src/systems/a.js', 'export const a = 1;\n');
    put('src/systems/b.js', "import { a } from './a.js';\nexport const b = a;\n");
    put('test/tooling/tidy1_codemap.test.js', "export async function f() {\n  return import('../../src/systems/b.js');\n}\n");
    const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
    const commit = () => { git('add', '-A'); git('commit', '-qm', 'step'); };
    git('init', '-q'); commit();
    const run = (...a) => spawnSync(process.execPath, ['tools/moveModule.mjs', ...a], { cwd: dir, encoding: 'utf8' });
    const at = (p) => readFileSync(join(dir, p), 'utf8');
    // the relay's bundle names the file (a comment in wire.js): refused, nothing moved
    let r = run('src/systems/feat', 'src/systems/a.js');
    assert.equal(r.status, 1); assert.match(r.stdout, /RELAY src\/net\/wire\.js/); assert.ok(existsSync(join(dir, 'src/systems/a.js')));
    // a move keeps the name
    put('plan.json', JSON.stringify([['src/systems/b.js', 'src/systems/feat/c.js']]));
    r = run('--plan', 'plan.json'); assert.equal(r.status, 1); assert.match(r.stderr, /a move keeps the name/);
    // colliding moves, before any is made
    put('plan.json', JSON.stringify([['src/systems/a.js', 'src/x/a.js'], ['src/systems/a.js', 'src/y/a.js']]));
    r = run('--relay', '--plan', 'plan.json'); assert.equal(r.status, 1); assert.match(r.stderr, /moved twice: src\/systems\/a\.js/); assert.ok(existsSync(join(dir, 'src/systems/a.js')));
    // a frozen file's indented import is a fixture's, so it is not re-based - and the move that would break it is refused
    r = run('test/tooling/deep', 'test/tooling/tidy1_codemap.test.js'); assert.equal(r.status, 1); assert.match(r.stdout, /BROKEN test\/tooling\/deep\/tidy1_codemap\.test\.js/);
    // made, with --relay: the importer re-based, the comment rewritten, the ledger written
    r = run('--relay', 'src/systems/feat', 'src/systems/a.js'); assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(at('src/systems/b.js'), "import { a } from './feat/a.js';\nexport const b = a;\n");
    assert.match(at('src/net/wire.js'), /see src\/systems\/feat\/a\.js/);
    assert.deepEqual(JSON.parse(at('tools/moveLedger.json')), [['src/systems/a.js', 'src/systems/feat/a.js']]);
    commit();
    // a branch written against the old path, merged: --fixup mends it
    put('src/ui/c.js', "import { a } from '../systems/a.js';\n"); commit();
    r = run('--fixup'); assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(at('src/ui/c.js'), "import { a } from '../systems/feat/a.js';\n");
    commit();
    // a move whose destination was later deleted is no address to mend toward: a branch's old path is left, not re-aimed at nothing
    r = run('--relay', 'src/systems/gone', 'src/systems/b.js'); assert.equal(r.status, 0, r.stderr + r.stdout); commit();
    git('rm', '-q', 'src/systems/gone/b.js'); put('src/ui/d.js', "// was src/systems/b.js\n"); commit();
    r = run('--fixup'); assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(at('src/ui/d.js'), '// was src/systems/b.js\n');
    // the old path tracked again beside the moved file: two files - named, nothing written
    put('src/systems/a.js', 'export const a = 2;\n'); commit();
    r = run('--fixup'); assert.equal(r.status, 1); assert.match(r.stderr, /REVIVED src\/systems\/a\.js/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
