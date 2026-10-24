import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { planMove, composeLedger, unresolvedIn, globRe, byName, namesIn, extsOf, FROZEN, LEDGER, TEXT_EXT } from '../../tools/moveModule.mjs';

// TIDY1 (2026-10-16, bible/01-Overview/Code-Map.md): THE MAP OF WHERE THINGS LIVE, AND THE TREE THE MOVES LEFT.
// The map is held to the tree both ways - a directory of code nobody wrote a row for fails, and so does a row for a
// directory that is gone - and the tree to what the moves promise: no address of a moved file left, every relative
// import resolving, every glob naming files. The move tool's own rules are tidy1_movetool.test.js's (AUDIT TIDY).

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/** Every directory under src/ that holds a .js file - src/assets/ is art, and is mapped as one row. */
function codeDirs(dir = 'src', out = []) {
  const ents = readdirSync(join(root, dir), { withFileTypes: true });
  if (ents.some((e) => e.isFile() && e.name.endsWith('.js'))) out.push(dir);
  for (const e of ents) if (e.isDirectory() && `${dir}/${e.name}` !== 'src/assets') codeDirs(`${dir}/${e.name}`, out);
  return out;
}

test('TIDY1: every directory of code is on the map, and the map names none that is gone', () => {
  const doc = rd('bible/01-Overview/Code-Map.md');
  const rows = [...doc.matchAll(/^\| `(src\/[^`]*?)\/?` \|/gm)].map((m) => m[1]);
  const mapped = new Set(rows.map((r) => r.replace(/\/$/, '')));
  const missing = codeDirs().filter((d) => !mapped.has(d));
  assert.deepEqual(missing, [], 'a directory of code with no row on the Code Map - add its row (Code-Map.md, "Where a new file goes" 4)');
  const gone = [...mapped].filter((d) => !existsSync(join(root, d)));
  assert.deepEqual(gone, [], 'the Code Map has a row for a directory that is gone');
  assert.ok(mapped.has('src/systems/comeSailAway'), 'the pilot\'s folder has its row');
  assert.match(rd('bible/Home.md'), /01-Overview\/Code-Map\.md/, 'Home.md\'s Repo layout points at the map');
});

test('TIDY1: Come Sail Away lives in its folder', () => {
  const loose = readdirSync(join(root, 'src/systems')).filter((f) => /^(comeSailAway\w*|csa[A-Z]\w*)\.js$/.test(f));
  assert.deepEqual(loose, [], 'a Come Sail Away module back loose in src/systems/ - it goes in src/systems/comeSailAway/ (Code-Map.md, "Where a new file goes" 2)');
  assert.deepEqual(readdirSync(join(root, 'src/systems/comeSailAway')).sort(), [
    'comeSailAway.js', 'comeSailAwayActions.js', 'comeSailAwayBoat.js', 'comeSailAwayHulls.js', 'comeSailAwayItems.js',
    'comeSailAwayMap.js', 'comeSailAwayModels.js', 'comeSailAwayWaves.js', 'comeSailAwayWire.js', 'csaBoatMenu.js',
    'csaLoadWind.js',   // PIN MOVED (FIELD BUGS 2026-10-21b SAIL-WIND: a load outdoors never keeps the indoors' wind - the runtime's OnLoad seam, beside it)
    'peaceWay.js',   // PIN MOVED (NAVAL-REFIT PEACE-WAY: her way out of a fight - the runtime's own speed seam, beside it)
  ]);
});

/** The tracked files, as git has them. */
const tracked = () => execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter((f) => f && existsSync(join(root, f)));

test('TIDY2: no address of a moved file is left where the ledger says it went - a merged branch runs --fixup', () => {
  const files = tracked();
  const here = new Set(files);
  const gone = composeLedger(JSON.parse(rd(LEDGER))).filter(([f, t]) => !here.has(f) && here.has(t));
  assert.ok(gone.length >= 10, 'the ledger holds the moves');
  const texts = new Map(files.filter((f) => TEXT_EXT.test(f)).map((f) => [f, rd(f)]));
  const { counts } = planMove(gone, texts, null, { blind: false });   // AUDIT TIDY TOOL-11: the BLIND lines are the move's, not this gate's
  assert.deepEqual([...counts.keys()], [], 'these files name a moved file where it no longer stands - run `node tools/moveModule.mjs --fixup` (bible/01-Overview/Code-Map.md)');
  // AUDIT TIDY TOOL-6: and not by the tool's own reading alone - a form it cannot read (a path after a host, before
  // AUDIT TIDY's host rule) would pass the check above unseen. Every gone path, as a word anywhere in a text the tool
  // writes - but not inside another checkout's absolute path (a record quoting /home/user/<repo>/src/...)
  const names = byName(gone), exts = extsOf(names), left = [];
  for (const [f, text] of texts) {
    if (FROZEN.some((re) => re.test(f))) continue;
    for (const nm of namesIn(text, exts)) for (const [from] of names.get(nm) ?? []) {
      if (new RegExp(`(?<![\\w.-])(?<!\\/home\\/[\\w.-]+\\/[\\w.-]+\\/)${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text)) left.push(`${f}: ${from}`);
    }
  }
  assert.deepEqual(left, [], 'a moved file\'s old path, spelled as a word - in a form the tool does not read');
});

test('TIDY2: every relative import in the code resolves - the game, the two Workers, the tools, the scripts, the desktop shell', () => {
  const files = tracked();
  const KNOWN = new Map([
    ['app/launcher/pad.js: ./menuPad.js', 'the launcher\'s pad is copied beside it at packaging (app/ build), not tracked'],
    ['src/systems/racialLive.js: ./formulas.js', 'quoted in a comment: `node -e "import(\'./formulas.js\')"`'],
    ['tools/titleProbe.mjs: ../public/logo.png', 'the probe shoots the missing-asset arm when there is no logo'],
  ]);
  const code = files.filter((f) => /^(src|server\/src|server-account\/src|tools|scripts|app)\//.test(f) && /\.(m?js|cjs)$/.test(f) && f !== 'tools/moveModule.mjs');
  const bad = unresolvedIn(code.map((f) => [f, rd(f)]), files).filter((l) => !KNOWN.has(l));
  assert.deepEqual(bad, [], 'a relative import names nothing - a move left it behind, or a merged branch wrote it for a path that moved');
});

test('AUDIT TIDY SRC-1: every import.meta.glob names a folder that stands, and files in it - a moved module re-bases its globs', () => {
  // Vite's glob is a compile-time macro and node never runs it (each module guards it with IN_BROWSER): a pattern off a
  // module's folder that names nothing ships an empty map, silently. TIDY2 moved three modules a folder deeper and left
  // eleven of their globs one folder short - the build went out without the quest pack, Dynamic Skies' presets and every
  // Eye of the Beholder and class-skin sprite (the move tool now re-bases a moved module's globs, GLOBBED)
  const files = tracked();
  const all = new Set(files);
  const dirs = new Set(files.flatMap((f) => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))));
  const EMPTY = new Map([   // patterns that match nothing on purpose - a place a later file goes
    ['src/scenes/localeData.js', 'a bundled translation pack (`locales/<tag>/pack/`) and its credits (`translators.json`) are a translator\'s to add (locales/README.md)'],
  ]);
  const code = files.filter((f) => /^(src|server|server-account|app|tools|scripts)\/.*\.(m?js|cjs)$/.test(f) && f !== 'tools/moveModule.mjs');
  const bad = [];
  let n = 0;
  for (const f of code) {
    const text = rd(f);
    if (!text.includes('import.meta.glob(')) continue;
    for (const call of text.matchAll(/\bimport\.meta\.glob\(\s*(\[[^\]]*\]|(['"])[^'"\n]*\2)/g)) {
      for (const m of call[1].matchAll(/(['"])(!?)(\.{1,2}\/[^'"\n]*)\1/g)) {
        if (m[2]) continue;
        n++;
        const pat = posix.normalize(posix.join(posix.dirname(f), m[3]));
        const at = pat.search(/[*?{[]/);
        const dir = pat.slice(0, pat.lastIndexOf('/', at < 0 ? pat.length : at));
        if (!dirs.has(dir)) { bad.push(`${f}: ${m[3]} - ${dir}/ is no folder`); continue; }
        const re = globRe(pat);
        if (!EMPTY.has(f) && !files.some((x) => re.test(x))) bad.push(`${f}: ${m[3]} - matches no file`);
      }
    }
  }
  assert.ok(n >= 25, `only ${n} glob patterns read - the scan missed them`);
  assert.deepEqual(bad, []);
  assert.ok(all.has('src/scenes/localeData.js'), 'the empty-on-purpose list names a file that stands');
});

