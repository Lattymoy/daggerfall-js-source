// DA9 (2026-09-29, Mac: "How can we drastically improve the install
// experience? ... I really want to make it AAA grade"): THE SHELL LOOKS
// BEFORE IT ASKS (app/lib/arena2Detect.cjs), AND HOLDS EVERY FOLDER TO
// THE GAME'S OWN SEVEN FILES.
//
// The shell's ARENA2 test was ART_PAL.COL alone while the game's has been
// seven files since A2-WHOLE - so a partial folder the website refuses
// was accepted by the app, saved, and died on the first model with the
// shell never asking again. The detector reads the places a copy of
// Daggerfall is actually installed (Daggerfall Unity's settings, every
// Steam library, GOG, an unpacked DaggerfallGameFiles.zip) and offers
// only WHOLE folders. Driven here over real temp trees, one per source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { REQUIRED_ARENA2 as GAME_REQUIRED } from '../../src/scenes/dataSource.js';

const require = createRequire(import.meta.url);
const {
  REQUIRED_ARENA2, STEAM_APP_ID, GOG_PRODUCT_ID, SEARCH_DIRS_MAX, resolveArena2, diagnoseArena2, missingArena2, searchArena2,
  judgeArena2, pickArena2, walkForArena2, answerArena2, vdfValues, dfuDaggerfallPath, regFileValues, detectArena2,
} = require('../../app/lib/arena2Detect.cjs');
const L = require('../../app/lib/launcherState.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'da9-'));
/** A folder holding `names` (default: a whole ARENA2), in the case given. */
const arena2At = (dir, names = REQUIRED_ARENA2) => {
  fs.mkdirSync(dir, { recursive: true });
  for (const n of names) fs.writeFileSync(path.join(dir, n), 'x');
  return dir;
};
const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const noReg = () => [];

test('DA9: the shell\'s list IS the game\'s - one law for a whole ARENA2, on both sides of the bridge', () => {
  assert.deepEqual([...REQUIRED_ARENA2], [...GAME_REQUIRED], 'app/lib/arena2Detect.cjs and src/scenes/dataSource.js must name the same seven files');
  assert.equal(STEAM_APP_ID, '1812390');
  assert.match(fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8'), /store\.steampowered\.com\/app\/1812390\//, 'the id the landing page links');
});

test('DA9: a folder is ARENA2 only when WHOLE - itself or its arena2/ child, any case; a partial one names what it lacks', () => {
  const root = tmp();
  try {
    const whole = arena2At(path.join(root, 'whole'));
    assert.equal(resolveArena2(whole), whole);
    // the install folder picked instead: descended, and the child's case is the disk's
    const install = path.join(root, 'install');
    const child = arena2At(path.join(install, 'Arena2'), REQUIRED_ARENA2.map((n) => n.toLowerCase()));
    assert.equal(resolveArena2(install), child, 'the parent is the honest mistake - it costs nothing');
    // A2-WHOLE's own case: a DOS install's small ARENA2 - the palettes, no BSAs
    const dos = arena2At(path.join(root, 'dos', 'ARENA2'), ['ART_PAL.COL', 'TEXT.RSC']);
    assert.equal(resolveArena2(dos), null, 'the old one-file test accepted this, and the boot died on ARCH3D.BSA');
    assert.equal(resolveArena2(path.dirname(dos)), null);
    assert.deepEqual(diagnoseArena2(path.dirname(dos)), ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD'],
      'the picker can say WHICH files are missing');
    assert.equal(diagnoseArena2(root), null, 'a folder with no Daggerfall file at all is a wrong folder, not a partial one');
    assert.equal(missingArena2(path.join(root, 'nope')), null, 'unreadable is not "missing everything"');
    assert.equal(resolveArena2(''), null);
    assert.equal(resolveArena2(undefined), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('DA9: Daggerfall Unity\'s settings.ini - [Daggerfall] MyDaggerfallPath, absolute paths only', () => {
  assert.equal(dfuDaggerfallPath('[Video]\nMyDaggerfallPath = C:\\nope\n[Daggerfall]\r\nMyDaggerfallPath = D:\\Games\\DF\\DAGGER\r\n'), 'D:\\Games\\DF\\DAGGER',
    'the key in its own section, not a namesake elsewhere');
  assert.equal(dfuDaggerfallPath('[Daggerfall]\nMyDaggerfallPath =\n'), null, 'unset');
  assert.equal(dfuDaggerfallPath(null), null);
  const home = tmp();
  try {
    const game = arena2At(path.join(home, 'dfdata', 'DAGGER', 'ARENA2'));
    write(path.join(home, '.config', 'unity3d', 'Daggerfall Workshop', 'Daggerfall Unity', 'settings.ini'),
      `[Daggerfall]\nMyDaggerfallPath = ${path.join(home, 'dfdata', 'DAGGER')}\n`);
    // a distribution's suffixed file, holding a PORTABLE (relative) path - unknowable, so skipped
    write(path.join(home, '.config', 'unity3d', 'Daggerfall Workshop', 'Daggerfall Unity', 'settings-dist.ini'),
      '[Daggerfall]\nMyDaggerfallPath = ..\\DF\\DAGGER\n');
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, regQuery: noReg }), [{ dir: fs.realpathSync(game), source: 'dfu' }]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: Steam - every library in libraryfolders.vdf, at the installdir app 1812390\'s manifest names, ARENA2 found under it', () => {
  assert.deepEqual(vdfValues('"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"D:\\\\SteamLibrary"\n\t}\n}', 'path'),
    ['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'], 'Valve escapes its backslashes');
  const home = tmp();
  try {
    const root = path.join(home, '.local', 'share', 'Steam');
    const lib2 = path.join(home, 'drive2', 'SteamLibrary');
    write(path.join(root, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${root}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${lib2}"\n\t}\n}\n`);
    const manifest = '"AppState"\n{\n\t"appid"\t\t"1812390"\n\t"installdir"\t\t"The Elder Scrolls Daggerfall"\n}\n';
    // the main library holds one copy - and ~/.steam/steam is a LINK to it, so it is reachable twice
    write(path.join(root, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), manifest);
    const inRoot = arena2At(path.join(root, 'steamapps', 'common', 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    fs.mkdirSync(path.join(home, '.steam'), { recursive: true });
    fs.symlinkSync(root, path.join(home, '.steam', 'steam'));
    // a second library, on another drive, holds another - only libraryfolders.vdf knows it is there
    write(path.join(lib2, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), manifest);
    const inLib2 = arena2At(path.join(lib2, 'steamapps', 'common', 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, regQuery: noReg }), [
      { dir: fs.realpathSync(inRoot), source: 'steam' },
      { dir: fs.realpathSync(inLib2), source: 'steam' },
    ], 'one install reached down two paths is offered once, by its real path');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: Windows - Steam where the registry says it is, GOG where Galaxy says, each held to the whole set', () => {
  const home = tmp();
  try {
    const steam = path.join(home, 'D', 'Steam');   // not under Program Files: only the registry knows
    write(path.join(steam, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), '"AppState" { "installdir" "The Elder Scrolls Daggerfall" }');
    const viaSteam = arena2At(path.join(steam, 'steamapps', 'common', 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    // GOG 1.07's own layout: arena2 in the game folder, beside FALL.EXE - no DF/DAGGER (lane 4 #6)
    const gog = path.join(home, 'GOG', 'Daggerfall');
    const viaGog = arena2At(path.join(gog, 'arena2'));
    const partialGog = path.join(home, 'GOG', 'Daggerfall Demo');
    arena2At(path.join(partialGog, 'ARENA2'), ['ART_PAL.COL']);
    // a game Galaxy lists that is NOT Daggerfall is never walked - whatever it holds
    arena2At(path.join(home, 'GOG', 'Witcher', 'data', 'ARENA2'));
    const asked = [];
    const regQuery = (key, value, opts) => {
      asked.push(`${key}|${value}|${!!opts?.recursive}`);
      if (/Valve\\Steam$/.test(key)) return [steam];
      if (/GOG\.com\\Games$/.test(key)) return [path.join(home, 'GOG', 'Witcher'), gog, partialGog];
      return [];
    };
    const env = { USERPROFILE: home, 'ProgramFiles(x86)': path.join(home, 'pf86'), ProgramFiles: path.join(home, 'pf'), SystemDrive: path.join(home, 'C') };
    assert.deepEqual(detectArena2({ platform: 'win32', home, env, regQuery }), [
      { dir: fs.realpathSync(viaSteam), source: 'steam' },
      { dir: fs.realpathSync(viaGog), source: 'gog' },
    ], 'the partial GOG folder is not offered, and a game not named for Daggerfall is never searched');
    assert.ok(asked.includes('HKCU\\Software\\Valve\\Steam|SteamPath|false'));
    assert.ok(asked.includes('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games|path|true'));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: the shell takes its ARENA2 law from the detector - one test for a whole folder, no second spelling in main.cjs', () => {
  const main = fs.readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8');
  assert.match(main, /const \{ findCaseInsensitive, answerArena2 \} = require\('\.\/lib\/arena2Detect\.cjs'\);/);
  assert.doesNotMatch(main, /detectArena2\(|judgeArena2\(|pickArena2\(/, 'AUDIT INSTALL L4-1, R2-D1: the looking itself runs in its own process, never on the main one');
  assert.doesNotMatch(main, /function (resolveArena2|findCaseInsensitive)\(/, 'the one-file test is gone, not shadowed');
  assert.doesNotMatch(main, /'ART_PAL\.COL'/, 'no file stands in for the whole set');
  // a saved folder is held to the law on every launch - a partial one is asked about again (R2-D1: beside the window)
  assert.match(main, /if \(savedDir\) judgeSaved\(launcher, savedDir\);/);
  assert.match(main, /function judgeSaved\(l, dir\) \{\s*askArena2\(\{ op: 'judge', dir \}, \{ deadline: JUDGE_DEADLINE_MS, signal: l\.stop\.signal \}\)/);
});

test('DA9: a DaggerfallGameFiles.zip unpacked into Downloads is found; nothing found is an empty list, never a throw', () => {
  const home = tmp();
  try {
    assert.deepEqual(detectArena2({ platform: 'darwin', home, env: {}, regQuery: noReg }), [], 'a machine without Daggerfall');
    const unpacked = arena2At(path.join(home, 'Downloads', 'DaggerfallGameFiles', 'DAGGER', 'arena2'));
    arena2At(path.join(home, 'Downloads', 'Some Other Game', 'ARENA2'));   // not named for Daggerfall: never walked
    assert.deepEqual(detectArena2({ platform: 'darwin', home, env: {}, regQuery: noReg }), [{ dir: fs.realpathSync(unpacked), source: 'folder' }]);
    // a filesystem that throws on everything is no find, not a crash
    const broken = new Proxy({}, { get: () => () => { throw new Error('EIO'); } });
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, fs: broken, regQuery: noReg }), []);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: the walk is bounded - a vast folder costs at most SEARCH_DIRS_MAX opens, and ARENA2 deeper than the depth is not found', () => {
  const root = tmp();
  try {
    let opens = 0;
    const counting = { ...fs, readdirSync: (...a) => { opens++; return fs.readdirSync(...a); } };
    for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) fs.mkdirSync(path.join(root, 'vast', `d${i}`, `e${j}`), { recursive: true });
    assert.equal(searchArena2(path.join(root, 'vast'), counting), null);
    // an opened folder is read at most three times: its own names, its arena2/ probe, its children
    assert.ok(opens <= SEARCH_DIRS_MAX * 3, `bounded (${opens} reads)`);
    // the reach is SEARCH_DEPTH folders down, plus the arena2/ child of the last one opened
    const deep = arena2At(path.join(root, 'deep', 'a', 'b', 'c', 'd', 'e', 'ARENA2'));
    assert.equal(searchArena2(path.join(root, 'deep')), null, 'six levels down is past the reach');
    assert.equal(searchArena2(path.join(root, 'deep', 'a')), deep, 'five is within it - a Steam install\'s DF/DAGGER/ARENA2 is three');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// ---- AUDIT INSTALL, lane 4 (2026-09-29): where the files really are, and a search that cannot freeze the app ----

test('L4-1/R2-D1: every look at the disks runs in a process of its own, killed at its deadline - finds stream out, and the search goes on past it', () => {
  // the probe: one question per process, answered by the detector's own function
  const probe = fs.readFileSync(new URL('../../app/lib/arena2Probe.cjs', import.meta.url), 'utf8');
  assert.match(probe, /process\.parentPort\.once\('message', \(\{ data \}\) => \{[\s\S]*?answer = answerArena2\(data, \(found\) => process\.parentPort\.postMessage\(\{ found \}\)\);[\s\S]*?process\.parentPort\.postMessage\(\{ answer \}\);/);
  assert.ok(!fs.existsSync(new URL('../../app/lib/arena2DetectWorker.cjs', import.meta.url)), 'a worker THREAD stuck in the kernel cannot be terminated, and the app could not quit while it was');
  const main = fs.readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8');
  const ask = main.slice(main.indexOf('function askArena2('), main.indexOf('/** A probe\'s answer about one folder'));
  assert.match(ask, /child = utilityProcess\.fork\(PROBE, \[\], \{ serviceName: 'Daggerfall files', stdio: 'ignore' \}\);/, 'a utility process (it loads from inside app.asar like any shell file)');
  assert.match(ask, /if \(child\) \{ probes\.delete\(child\); try \{ child\.kill\(\); \} catch/, 'let go the moment it has answered, or has not by its deadline');
  assert.match(ask, /if \(deadline\) timer = setTimeout\(\(\) => settle\(\{ late: true \}\), deadline\);/);
  assert.match(ask, /child\.once\('exit', \(\) => \{ if \(!settled\) settle\(here\(\)\); \}\);/, 'a probe that could not start is answered here - never unanswered');
  assert.match(ask, /signal\?\.addEventListener\('abort', stop\);/, 'and one its launcher no longer needs is let go');
  assert.match(main, /app\.on\('will-quit', \(\) => \{ for \(const p of probes\) \{ try \{ p\.kill\(\); \}/);
  const bg = main.slice(main.indexOf('function detectInBackground(l)'), main.indexOf('/** A dialog over the launcher'));
  assert.match(bg, /const deadline = setTimeout\(\(\) => \{\s*shown = true;\s*if \(launcher === l\) launcherDispatch\(\{ type: 'found', found: \[\.\.\.found\], searching: true \}\);/, 'at the deadline the card shows what there is - and says the search goes on');
  assert.match(bg, /onFound: \(f\) => \{\s*found\.push\(f\);/, 'each find kept as it comes');
  assert.match(bg, /if \(shown && launcher === l\) launcherDispatch\(\{ type: 'found-more', found: f \}\);/, 'R2-D4: a later find is added, never thrown away');
  assert.match(bg, /launcherDispatch\(shown \? \{ type: 'detect-done' \} : \{ type: 'found', found, searching: false \}\);/);
  assert.match(bg, /signal: AbortSignal\.any\(\[l\.stop\.signal, l\.search\.signal\]\)/, 'let go when the launcher closes, or once the player has chosen');
  assert.match(main, /if \(launcher\.search && \(launcher\.state\.setup\.status === 'ready' \|\| launcher\.state\.setup\.status === 'skipped'\)\) \{\s*launcher\.search\.abort\(\);/);
  assert.match(bg, /\['downloads', 'desktop', 'documents'\]\.map\(\(n\) => \{ try \{ return app\.getPath\(n\); \} catch \{ return null; \} \}\)/, 'the loose folders are the shell\'s to name');
  assert.match(main, /if \(launcher\.detecting\) return;\s*launcher\.detecting = true;/, 'one search per launcher');
  assert.ok(L.DETECT_DEADLINE_MS >= 2000 && L.DETECT_DEADLINE_MS <= 10000, `${L.DETECT_DEADLINE_MS} ms`);
  // the probe's question, answered as the process answers it; a find is heard the moment it is made, and a listener's
  // fault is not the search's
  const home = tmp();
  try {
    const heard = [];
    const unpacked = arena2At(path.join(home, 'Downloads', 'Daggerfall', 'arena2'));
    detectArena2({ platform: 'linux', home, env: {}, regQuery: noReg, onFound: (f) => { heard.push(f); throw new Error('listener fault'); } });
    assert.deepEqual(heard, [{ dir: fs.realpathSync(unpacked), source: 'folder' }]);
    assert.deepEqual(answerArena2({ op: 'judge', dir: unpacked }), { dir: unpacked });
    assert.deepEqual(answerArena2({ op: 'pick', dir: path.join(home, 'Downloads') }), { dir: unpacked });
    assert.deepEqual(answerArena2({ op: 'nonsense' }), { failed: true });
    assert.deepEqual(answerArena2(null), { failed: true });
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('L4-3: a zip unpacked with "Extract Here" (a bare arena2 in Downloads), the shell\'s own folder names, links and junctions - all found', () => {
  const home = tmp();
  try {
    // "Extract Here": arena2/ straight into Downloads, beside everything else - no folder named for Daggerfall
    const bare = arena2At(path.join(home, 'Downloads', 'arena2'));
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, regQuery: noReg }), [{ dir: fs.realpathSync(bare), source: 'folder' }]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
  const home2 = tmp();
  try {
    // OneDrive's Known Folder Move, a localized XDG Downloads: only the shell (app.getPath) knows where it is
    const moved = path.join(home2, 'OneDrive', 'Documentos');
    const inMoved = arena2At(path.join(moved, 'DaggerfallGameFiles', 'arena2'));
    assert.deepEqual(detectArena2({ platform: 'win32', home: home2, env: { USERPROFILE: home2 }, regQuery: noReg, looseDirs: [moved, 'relative/nope'] }),
      [{ dir: fs.realpathSync(inMoved), source: 'folder' }], 'the named folder is read - and a relative one is not');
    // a link (a symlink, a Windows junction - libuv types both as links) to the install is followed, once
    const target = arena2At(path.join(home2, 'elsewhere', 'DAGGER', 'ARENA2'));
    fs.mkdirSync(path.join(home2, 'Games'), { recursive: true });
    fs.symlinkSync(path.join(home2, 'elsewhere'), path.join(home2, 'Games', 'Daggerfall'));
    fs.symlinkSync(path.join(home2, 'Games'), path.join(home2, 'elsewhere', 'loop'));   // a link back up the tree
    const found = detectArena2({ platform: 'linux', home: home2, env: {}, regQuery: noReg });
    assert.ok(found.some((f) => f.dir === fs.realpathSync(target)), `a linked install is found (got ${JSON.stringify(found)})`);
  } finally { fs.rmSync(home2, { recursive: true, force: true }); }
});

test('L4-3/L4-10: on a Mac the privacy-guarded folders are read only when nothing else was found, and an app bundle is never walked', () => {
  const home = tmp();
  try {
    const dfuPath = path.join(home, 'DFU-data', 'DAGGER');
    const viaDfu = arena2At(path.join(dfuPath, 'ARENA2'));
    write(path.join(home, 'Library', 'Application Support', 'Daggerfall Workshop', 'Daggerfall Unity', 'settings.ini'), `[Daggerfall]\nMyDaggerfallPath = ${dfuPath}\n`);
    arena2At(path.join(home, 'Downloads', 'Daggerfall', 'arena2'));   // would be a second find - and a system prompt to get it
    let reads = [];
    const watching = { ...fs, readdirSync: (p, ...a) => { reads.push(String(p)); return fs.readdirSync(p, ...a); } };
    assert.deepEqual(detectArena2({ platform: 'darwin', home, env: {}, fs: watching, regQuery: noReg }), [{ dir: fs.realpathSync(viaDfu), source: 'dfu' }]);
    for (const guarded of ['Downloads', 'Desktop', 'Documents']) {
      assert.ok(!reads.some((p) => p === path.join(home, guarded) || p.startsWith(path.join(home, guarded) + path.sep)), `${guarded} is not read - a prompt the player did not need`);
    }
    // with nothing else found, they are
    fs.rmSync(path.join(home, 'Library'), { recursive: true, force: true });
    reads = [];
    assert.equal(detectArena2({ platform: 'darwin', home, env: {}, fs: watching, regQuery: noReg }).length, 1);
    assert.ok(reads.some((p) => p === path.join(home, 'Downloads')));
    // and this app's own bundle is no install - here an older copy of it, by the name it had before BR5 (spelled in
    // parts: the name a folder search matches, which brand.test.js's sweep would otherwise read as a surface)
    arena2At(path.join(home, 'Games', `${['Daggerfall', 'Online'].join(' ')}.app`, 'Contents', 'arena2'));
    assert.ok(!detectArena2({ platform: 'darwin', home, env: {}, regQuery: noReg }).some((f) => f.dir.includes('.app')));
    // Daggerfall Unity's older macOS folder (the bundle id Unity used before)
    const old = path.join(home, 'old-dfu', 'DAGGER');
    arena2At(path.join(old, 'arena2'));
    write(path.join(home, 'Library', 'Application Support', 'unity.Daggerfall Workshop.Daggerfall Unity', 'settings.ini'), `[Daggerfall]\nMyDaggerfallPath = ${old}\n`);
    assert.equal(detectArena2({ platform: 'darwin', home, env: {}, regQuery: noReg })[0].source, 'dfu', 'L4-12');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('L4-7/L4-8: GOG by Daggerfall\'s own product key, whatever the folder is called; reg.exe by its own path; its file read as UTF-16', () => {
  const home = tmp();
  try {
    const tes2 = path.join(home, 'D', 'Games', 'TES2');   // a folder the player named - nothing says "daggerfall"
    const inTes2 = arena2At(path.join(tes2, 'arena2'));
    const regQuery = (key, value) => (key.endsWith(`\\GOG.com\\Games\\${GOG_PRODUCT_ID}`) && value === 'path' ? [tes2] : []);
    assert.deepEqual(detectArena2({ platform: 'win32', home, env: { USERPROFILE: home, SystemDrive: path.join(home, 'C') }, regQuery }),
      [{ dir: fs.realpathSync(inTes2), source: 'gog' }]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
  assert.equal(GOG_PRODUCT_ID, '1435829353');
  // a `reg export` file: [sections], "name"="value" with backslashes doubled - a Cyrillic path intact
  const text = '\uFEFFWindows Registry Editor Version 5.00\r\n\r\n[HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games]\r\n\r\n'
    + '[HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1435829353]\r\n"gameName"="The Elder Scrolls II: Daggerfall"\r\n"path"="D:\\\\Игры\\\\TES2"\r\n\r\n'
    + '[HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1207658924]\r\n"PATH"="C:\\\\GOG Games\\\\Witcher"\r\n';
  const games = 'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games';
  assert.deepEqual(regFileValues(text, games, 'path', { recursive: true }), ['D:\\Игры\\TES2', 'C:\\GOG Games\\Witcher'], 'every key below, any case of the name');
  assert.deepEqual(regFileValues(text, games, 'path'), [], 'the key itself holds none');
  assert.deepEqual(regFileValues(text, `${games}\\1435829353`, 'path'), ['D:\\Игры\\TES2']);
  assert.deepEqual(regFileValues(null, games, 'path'), []);
  const src = fs.readFileSync(new URL('../../app/lib/arena2Detect.cjs', import.meta.url), 'utf8');
  assert.match(src, /const regExe = \(env\) => path\.join\(env\.SystemRoot \|\| env\.windir \|\| 'C:\\\\Windows', 'System32', 'reg\.exe'\);/, 'a bare `reg` runs whatever reg.exe sits in the current folder');
  assert.match(src, /execFileSync\(regExe\(process\.env\), \['export', key, tmp, '\/y'\]/);
  assert.match(src, /regFileValues\(fs\.readFileSync\(tmp\)\.toString\('utf16le'\), key, value, \{ recursive \}\)/, '`reg query` writes a pipe in the OEM code page');
  assert.doesNotMatch(src, /execFileSync\('reg'/);
});

test('L4-9: ARENA2 and arena2 side by side (Linux): whichever is whole is the one', () => {
  const root = tmp();
  try {
    arena2At(path.join(root, 'install', 'arena2'), ['ART_PAL.COL']);
    const whole = arena2At(path.join(root, 'install', 'ARENA2'));
    assert.equal(resolveArena2(path.join(root, 'install')), whole);
    // and the other way round - whichever the disk lists first, every variant is asked
    const whole2 = arena2At(path.join(root, 'install2', 'arena2'));
    arena2At(path.join(root, 'install2', 'ARENA2'), ['ART_PAL.COL']);
    assert.equal(resolveArena2(path.join(root, 'install2')), whole2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('L4-4/L4-5/R2-D3: a picked game folder is searched, Daggerfall first - not refused; an unreadable one is said as such; a saved folder that fails is NAMED', () => {
  const root = tmp();
  try {
    // Steam's "Browse local files" opens the game folder, three levels above ARENA2 - and a player may pick
    // steamapps/common itself: forty other games (ten folders each) beside Daggerfall, and breadth first the whole
    // budget went on them before DAGGER was ever opened ("It holds no Daggerfall files", measured on a real tree)
    const common = path.join(root, 'steamapps', 'common');
    for (let g = 0; g < 40; g++) for (let k = 0; k < 10; k++) fs.mkdirSync(path.join(common, `Game ${String(g).padStart(2, '0')}`, `part${k}`), { recursive: true });
    const df = arena2At(path.join(common, 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    assert.deepEqual(pickArena2(common), { dir: df }, 'led by its name, the walk opens Daggerfall first');
    // and everything under a folder named for it, whatever those are called (a hand-made install's own layout)
    const odd = arena2At(path.join(root, 'odd', 'common', 'Daggerfall Classic', 'install', 'data', 'ARENA2'));
    for (let g = 0; g < 40; g++) for (let k = 0; k < 10; k++) fs.mkdirSync(path.join(root, 'odd', 'common', `Game ${String(g).padStart(2, '0')}`, `part${k}`), { recursive: true });
    assert.deepEqual(pickArena2(path.join(root, 'odd', 'common')), { dir: odd }, 'a lead\'s children are leads');
    assert.deepEqual(pickArena2(path.join(root, 'steamapps')), { dir: df });
    assert.deepEqual(pickArena2(path.join(common, 'The Elder Scrolls Daggerfall')), { dir: df });
    // the budget, and what running out of it says: never "holds no Daggerfall files" of a folder not looked through
    const vast = path.join(root, 'vast');
    for (let i = 0; i < SEARCH_DIRS_MAX + 20; i++) fs.mkdirSync(path.join(vast, `d${i}`), { recursive: true });
    assert.deepEqual(pickArena2(vast), { missing: null, unreadable: false, cut: true });
    assert.equal(walkForArena2(vast).cut, true);
    assert.deepEqual(walkForArena2(path.join(root, 'steamapps', 'common', 'Game 00')), { dir: null, cut: false }, 'a folder looked through to its end is not cut');
    assert.deepEqual(pickArena2(path.join(root, 'nope')), { missing: null, unreadable: true });
    const dos = arena2At(path.join(root, 'dos', 'ARENA2'), ['ART_PAL.COL', 'TEXT.RSC']);
    assert.deepEqual(pickArena2(path.dirname(dos)), { missing: ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD'], unreadable: false, cut: false });
    // judged in ONE pass: whole, the install folder above it, a wrong folder, one that cannot be read
    assert.deepEqual(judgeArena2(df), { dir: df });
    assert.deepEqual(judgeArena2(path.dirname(df)), { dir: df }, 'the install folder is the honest mistake');
    assert.deepEqual(judgeArena2(common), { missing: null, unreadable: false });
    assert.deepEqual(judgeArena2(path.join(root, 'nope')), { missing: null, unreadable: true });
    assert.deepEqual(judgeArena2(path.dirname(dos)), { missing: ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD'], unreadable: false });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  // the shell: a pick, the saved folder and Try again are each asked of a probe, under their deadlines
  const main = fs.readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8');
  const choose = main.slice(main.indexOf('async function chooseArena2Folder('), main.indexOf('/** The folder the shell reads from now on'));
  assert.match(choose, /return folderAnswer\(await askArena2\(\{ op: 'pick', dir: pick \}, \{ deadline: PICK_DEADLINE_MS \}\)\);/);
  assert.match(main, /const r = await judgeForLauncher\(\{ op: 'pick', dir: pick \}, PICK_DEADLINE_MS\);/, 'the launcher\'s door too');
  assert.match(main, /case 'retry-saved': \{[\s\S]*?const r = await judgeForLauncher\(\{ op: 'judge', dir: savedDir \}, JUDGE_DEADLINE_MS\);\s*if \(!r \|\| !launcher\) break;\s*if \(r\.dir\) useArena2\(r\.dir\);\s*else launcherDispatch\(\{ type: 'saved-bad', missing: r\.missing, unreadable: r\.unreadable \}\);/);
  assert.ok(L.JUDGE_DEADLINE_MS >= 2000 && L.JUDGE_DEADLINE_MS <= 10000 && L.PICK_DEADLINE_MS >= L.JUDGE_DEADLINE_MS && L.PICK_DEADLINE_MS <= 30000);
  // the words: unreadable, and GOG's own layout
  assert.match(L.notArena2Detail(null, { unreadable: true }), /^It could not be read - is its drive connected\?/);
  assert.match(L.notArena2Detail(['MAPS.BSA']), /on Steam it is under DF\/DAGGER\/ARENA2, on GOG it is in the game's own folder\.$/);
  // the saved folder: looked at while the front door shows, then - not whole - named with a Try again, never the
  // first run's "Where is Daggerfall?"
  const st = L.initialState({ current: '0.1.1', transport: 'notice', checkEnabled: false, savedDir: 'E:/Games/ARENA2' });
  assert.deepEqual([st.setup.status, L.viewOf(st).panel, L.viewOf(st).play.enabled, L.viewOf(st).busy], ['checking', 'news', false, true]);
  assert.equal(L.nextStep(st), 'wait', 'no search while the saved folder may yet answer');
  const named = L.reduce(st, { type: 'saved-judged', missing: null, unreadable: true });
  assert.deepEqual([named.setup.status, named.setup.saved], ['looking', { dir: 'E:/Games/ARENA2', missing: null, unreadable: true }]);
  const card = L.viewOf(L.reduce(named, { type: 'found', found: [] })).setup;
  assert.equal(card.title, 'Your Daggerfall folder cannot be reached');
  assert.match(card.detail, /E:\/Games\/ARENA2/);
  assert.deepEqual(card.actions.map((a) => [a.id, !!a.primary]), [['retry-saved', true], ['choose-folder', false], ['skip-setup', false]]);
  const partial = L.reduce(L.reduce(named, { type: 'found', found: [] }), { type: 'saved-bad', missing: ['MAPS.BSA'], unreadable: false });
  assert.match(L.viewOf(partial).setup.detail, /has no MAPS\.BSA\./, 'Try again says what it found this time');
  assert.equal(L.viewOf(L.reduce(partial, { type: 'picked', dir: '/new/ARENA2' })).panel, 'news', 'a folder picked ends it');
  const whole = L.reduce(st, { type: 'saved-judged', dir: 'E:/Games/whole-arena2' });
  assert.deepEqual([whole.setup.status, whole.setup.dir, L.viewOf(whole).play.enabled], ['ready', 'E:/Games/whole-arena2', true], 'whole: the one the game reads');
  const unreadable = L.reduce(L.reduce(L.initialState({ current: '0.1.1', transport: 'notice', checkEnabled: false }), { type: 'found', found: [] }), { type: 'picked-bad', missing: null, unreadable: true });
  assert.equal(L.viewOf(unreadable).setup.title, 'That folder cannot be read');
});

