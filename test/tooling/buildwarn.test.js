// BUILD-LEFTOVERS (2026-10-15): THE BUILD'S WARNINGS STAY WORTH READING. Vite 8's build printed two ineffective
// dynamic imports and a chunk-size warning on every run, so a new one would have been lost among them. mwFirstPerson's
// was a dynamic import of a module it already imported statically (gone); hudLayout -> revenantCard's is the design
// (the dynamic edge keeps the two out of a cycle), and vite.config.js's onLog quiets that one pair - and must quiet
// nothing else, or the next real warning is silent. Held by a build: a scratch tree with that pair and another, built
// by Vite through the config's own onLog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createLogger } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** build.rollupOptions.onLog, as vite.config.js actually spells it - not a copy. */
function onLog() {
  const cfg = readFileSync(join(root, 'vite.config.js'), 'utf8');
  const m = /^ {6}onLog\(level, log, handler\) \{\n([\s\S]*?)\n {6}\},$/m.exec(cfg);
  assert.ok(m, 'vite.config.js no longer carries build.rollupOptions.onLog');
  // and it is the BUILD's: inside `build: {`'s `rollupOptions: {`, before its `input: {` (a worker's would read the same)
  const b = cfg.indexOf('\n  build: {\n'), r = cfg.indexOf('\n    rollupOptions: {\n', b), i = cfg.indexOf('\n      input: {\n', r);
  assert.ok(b > 0 && r > b && m.index > r && m.index < i, 'the onLog read here is build.rollupOptions.onLog');
  // eslint-disable-next-line no-new-func
  return new Function('level', 'log', 'handler', m[1]);
}

/** A module both imported and dynamically imported by its neighbour: the warning's own shape. */
const pair = (dir, dyn, stat) => ({
  [`${dir}/${dyn}.js`]: `import { tag } from './${stat}.js';\nexport const load = () => import('./${stat}.js');\nexport const use = () => tag;\n`,
  [`${dir}/${stat}.js`]: `export const tag = '${stat}';\n`,
});

/** The HUD's own shape (AUDIT BUILD-LEFTOVERS, the second read - the pair above was hudLayout importing the card
 *  statically too, which the real tree never does and the filter must not quiet): hudLayout.js loads revenantCard.js
 *  dynamically, the cycle's edge, and hud.js imports it statically. */
const HUD = {
  'src/ui/hud/hudLayout.js': "export const load = () => import('../revenant/revenantCard.js');\n",
  'src/ui/hud/hud.js': "import { tag } from '../revenant/revenantCard.js';\nexport const use = () => tag;\n",
  'src/ui/revenant/revenantCard.js': "export const tag = 'card';\n",
};

/** Built by Vite through the config's own onLog, FROM its tree: each ineffective dynamic import it printed, as
 *  `<module> <- <its dynamic importers>`. `main` is src/main.js's imports. */
async function warnings(files, main) {
  const dir = mkdtempSync(join(tmpdir(), 'buildwarn-'));
  try {
    const all = {
      'index.html': '<!doctype html><script type="module" src="./src/main.js"></script>\n',
      'src/main.js': main.map(([what, from], i) => `import { ${what} as m${i} } from '${from}';\nconsole.log(m${i});\n`).join(''),
      ...files,
    };
    for (const [p, text] of Object.entries(all)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); }
    const warned = [];
    // AUDIT BUILD-LEFTOVERS: built FROM the tree, as a real build runs from the repo - so the warning names its paths bare,
    // as the real one does (a tree built from elsewhere names them `../../tmp/...`, and the filter was only ever tried so)
    const cwd = process.cwd();
    process.chdir(dir);
    const logger = createLogger('warn', { allowClearScreen: false });
    logger.warn = (msg) => warned.push(msg);
    await build({
      root: dir, configFile: false, logLevel: 'warn', customLogger: logger,
      build: { outDir: join(dir, 'dist'), rollupOptions: { onLog: onLog() } },
    }).finally(() => process.chdir(cwd));
    return [...warned.join('\n').matchAll(/(src\/[\w/]+\.js) is dynamically imported by ([^\n]*?) but/g)]
      .map((m) => `${m[1]} <- ${m[2].split(', ').sort().join(', ')}`).sort();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const HUD_MAIN = [['load', './ui/hud/hudLayout.js'], ['use', './ui/hud/hud.js']];

test('BUILD-LEFTOVERS THE BUILD\'S WARNINGS STAY WORTH READING: built by Vite through vite.config.js\'s own onLog, hudLayout -> revenantCard\'s ineffective dynamic import (the edge that keeps them out of a cycle) is quiet - and another pair\'s still warns, the same file name under another caller\'s, the card loaded by a second importer, and the card imported statically by hudLayout too (mutants: every ineffective dynamic import quiet; the pair quiet by its file name alone; the importer anchored to the message\'s start; the importer clause dropped; the static list unread)', async () => {
  assert.deepEqual(await warnings({
    ...HUD,
    ...pair('src/x', 'caller', 'callee'),
    ...pair('src/y', 'notHudLayout', 'revenantCard'),   // the same file name under another caller is another pair - it warns
  }, [...HUD_MAIN, ['use', './x/caller.js'], ['use', './y/notHudLayout.js']]), [
    'src/x/callee.js <- src/x/caller.js',
    'src/y/revenantCard.js <- src/y/notHudLayout.js',
  ], 'the HUD\'s pair quiet, every other warning printed');
  // AUDIT BUILD-LEFTOVERS, the second read: the importer and the static list are the filter's, not decoration
  assert.deepEqual(await warnings({ ...HUD, 'src/ui/other.js': "export const load = () => import('./revenant/revenantCard.js');\n" }, [...HUD_MAIN, ['load', './ui/other.js']]),
    ['src/ui/revenant/revenantCard.js <- src/ui/hud/hudLayout.js, src/ui/other.js'], 'a second dynamic importer of the card warns');
  assert.deepEqual(await warnings({ ...HUD, 'src/ui/hud/hudLayout.js': "import { tag } from '../revenant/revenantCard.js';\nexport const load = () => import('../revenant/revenantCard.js');\nexport const use = () => tag;\n" }, [...HUD_MAIN, ['use', './ui/hud/hudLayout.js']]),
    ['src/ui/revenant/revenantCard.js <- src/ui/hud/hudLayout.js'], 'hudLayout importing the card statically too - mwFirstPerson\'s mistake, and the cycle back - warns');
});
