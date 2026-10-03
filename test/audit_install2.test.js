// AUDIT INSTALL, ROUND 2 (2026-09-29, Mac: "Audit this"): PR #429's
// install work read again by five fresh lanes - the launcher's lifecycle,
// security, the release pipeline and its notes, ARENA2 detection, and the
// tests, docs and the player's eye - after round 1's fixes had landed.
// Round 2 looked hardest at the fixes themselves. The worst finding was
// one of them: L1-5 kept a tag's text out of the build legs' scripts, and
// in doing so broke the Windows leg. Every finding a lane verified is
// fixed at its root and pinned here; the record, finding by finding, is
// bible/01-Overview/Audit-Install.md ("Round 2"). Lane C's notes findings
// (C1, C4, E-48..E-51) pinned the PATCH-NOTES-*.md reader REL6 retired -
// the notes come off the pull requests now (test/rel4_release.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsModule, { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---- the workflows, read as GitHub reads them -------------------------------

const WORKFLOWS = readdirSync(new URL('../.github/workflows/', import.meta.url)).filter((f) => f.endsWith('.yml')).sort();
/** A workflow's jobs, each from its two-space `name:` line to the next. */
const jobsOf = (wf) => [...wf.slice(wf.indexOf('\njobs:\n')).matchAll(/\n {2}([A-Za-z0-9_-]+):\n([\s\S]*?)(?=\n {2}[A-Za-z0-9_-]+:\n|$)/g)]
  .map((m) => ({ name: m[1], text: m[2] }));
/** A job's steps, each from its `      - ` line to the next. */
const stepsOf = (job) => {
  const at = job.indexOf('\n    steps:\n');
  return at < 0 ? [] : job.slice(at + '\n    steps:\n'.length).split(/\n(?= {6}- )/).filter((s) => /^ {6}- /.test(s));
};
/** A step's script: the inline value of its `run:`, or the block under it (the lines indented past the key). */
const runOf = (step) => {
  const lines = step.split('\n');
  const i = lines.findIndex((l) => /^ {6}(?:- | {2})run:/.test(l));
  if (i < 0) return null;
  const inline = lines[i].replace(/^ {6}(?:- | {2})run:\s*/, '');
  if (!/^[|>][-+]?\s*$/.test(inline)) return inline;
  const block = [];
  for (const l of lines.slice(i + 1)) {
    if (l.trim() && !/^ {9,}/.test(l)) break;
    block.push(l);
  }
  return block.join('\n');
};
const nameOf = (step) => /^ {6}(?:- | {2})name: (.*)$/m.exec(step)?.[1] ?? step.split('\n')[0].trim();

test('R2-B1: a step that reads a shell variable names its shell wherever a leg can be Windows - there `run` is PowerShell, and "$VERSION" is not the environment', () => {
  // L1-5 moved the version out of the stamp's script and into its
  // environment - right for bash, and silently wrong on windows-latest,
  // whose default shell is pwsh: "$VERSION" is an unset PowerShell
  // variable ($env:VERSION is the environment), npm got "" (or nothing),
  // the Windows leg failed or stamped 0.1.0, and `publish` - which needs
  // every leg - never ran. A script's dialect is the shell's, so any script
  // that reads a variable says which shell it is written for.
  let windowsJobs = 0;
  const unnamed = [];
  for (const f of WORKFLOWS) {
    const wf = rd(`.github/workflows/${f}`);
    const wfBash = /\ndefaults:\n {2}run:\n {4}shell: bash\n/.test(wf);
    for (const job of jobsOf(wf)) {
      if (!/\bwindows-(?:latest|\d+)\b/.test(job.text)) continue;
      windowsJobs++;
      const jobShell = wfBash || /\n {4}defaults:\n {6}run:\n {8}shell: \w+\n/.test(job.text);
      for (const step of stepsOf(job.text)) {
        const script = runOf(step);
        if (script === null || !/\$(?!\{\{)/.test(script)) continue;
        if (!jobShell && !/^ {8}shell: \w+/m.test(step)) unnamed.push(`${f} ${job.name}: "${nameOf(step)}"`);
      }
    }
  }
  assert.ok(windowsJobs >= 1, 'the desktop build has a Windows leg - this law is not vacuous');
  assert.deepEqual(unnamed, [], 'a script that reads a variable runs in whatever shell the leg defaults to');
  const build = jobsOf(rd('.github/workflows/release-desktop.yml')).find((j) => j.name === 'build');
  const stamp = stepsOf(build.text).find((s) => nameOf(s) === 'Stamp the version');
  assert.match(stamp, /^ {8}shell: bash$/m, 'the stamp is bash on every leg');
  assert.equal(runOf(stamp), 'npm version "$VERSION" --no-git-tag-version --allow-same-version', 'and reads the environment, never pasted text (L1-5)');
});

test('R2-B4: an action nobody at GitHub owns is pinned to a commit - the release job holds contents: write, and the launcher installs what it publishes', () => {
  const loose = [];
  let thirdParty = 0;
  for (const f of WORKFLOWS) {
    for (const m of rd(`.github/workflows/${f}`).matchAll(/^\s*(?:- )?uses: ([^\s#]+)(.*)$/gm)) {
      const [, ref, rest] = m;
      if (ref.startsWith('./') || ref.startsWith('actions/')) continue;
      thirdParty++;
      const [, sha] = /@([^@]+)$/.exec(ref) ?? [];
      if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !/^\s+# v\d+\.\d+\.\d+$/.test(rest)) loose.push(`${f}: ${ref}${rest}`);
    }
  }
  assert.ok(thirdParty >= 1, 'softprops is third-party - this law is not vacuous');
  assert.deepEqual(loose, [], 'a tag can be moved under the job; a commit cannot - and the comment says which release it was');
  assert.match(rd('.github/workflows/release-desktop.yml'), /uses: softprops\/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2\.6\.2\n/,
    'the commit v2 and v2.6.2 both named (git ls-remote, 2026-09-29)');
});

test('R2-C2: a draft a failed run left at the tag is deleted before staging - softprops would keep it, with its old notes and its old commit', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  const publish = jobsOf(wf).find((j) => j.name === 'publish');
  const steps = stepsOf(publish.text);
  const guard = steps.findIndex((s) => nameOf(s) === 'The tag has no published release, and no draft left over');
  const stage = steps.findIndex((s) => /uses: softprops\/action-gh-release@/.test(s));
  assert.ok(guard >= 0 && stage > guard, 'the guard stands before anything is staged');
  const script = runOf(steps[guard]);
  // an ASSIGNMENT, so a listing that fails fails the step (bash -e) - a `for` over a failed $(...) would carry on
  assert.match(script, /\n\s*LEFT=\$\(gh api --paginate "repos\/\$GITHUB_REPOSITORY\/releases\?per_page=100" --jq '\.\[\] \| select\(\.draft and \.tag_name == env\.TAG\) \| \.id'\)\n/,
    'every page: softprops itself only scans two');
  assert.match(script, /for ID in \$LEFT; do\s*gh api -X DELETE "repos\/\$GITHUB_REPOSITORY\/releases\/\$ID" --silent/);
  assert.ok(script.indexOf('LEFT=') > script.indexOf("grep -q 'HTTP 404' lookup-error.txt"), 'only once the tag is known to have no published release');
  assert.match(steps[stage], /target_commitish: \$\{\{ github\.sha \}\}/, 'staged afresh, the tag is cut where these files were built (AUDIT 68)');
});

// ---- the launcher's fences ---------------------------------------------------

const main = rd('app/main.cjs');
const fences = main.slice(main.indexOf("app.on('web-contents-created'"), main.indexOf('// The preload asks for its storage root'));

test('R2-B2: a launcher that finds itself anywhere but its own origin goes home - about:blank makes no request, so will-navigate never saw it', () => {
  // will-navigate is raised as a navigation's request starts; location = 'about:blank' commits with none, and the
  // launcher sat on a page that was not its own with its bridge still on it (tools/appShellProbe.mjs drives it)
  assert.match(fences, /contents\.on\('did-navigate', \(_e, url\) => \{\s*if \(launcherContents\.has\(contents\) && !url\.startsWith\(LAUNCHER_ORIGIN\)\) contents\.loadURL\(LAUNCHER_URL\)\.catch\(\(\) => \{\}\);\s*\}\);/);
  const origin = /const LAUNCHER_ORIGIN = '([^']+)';/.exec(main)?.[1];
  const home = /const LAUNCHER_URL = '([^']+)';/.exec(main)?.[1];
  assert.ok(origin && home?.startsWith(origin), 'home is inside the origin - going home can never be a reason to go home again');
  assert.match(rd('app/launcherPreload.cjs'), /onView: \(cb\) => \{[\s\S]*?ipcRenderer\.send\('launcher:ready'\);/, 'and the page asks for its view each time it loads - home is drawn, not blank');
});

test('R2-B3: the launcher is granted nothing it ASKS for and nothing it merely CHECKS; every other page keeps Electron\'s defaults', () => {
  // the predicate, run: the launcher's own window, or any page of its origin (a check may come with no WebContents)
  const src = /const isLauncherPage = (\(wc, url\) => .*);\n/.exec(main)?.[1];
  assert.ok(src, 'one predicate, for both sides');
  const launcherWc = { id: 1 }, gameWc = { id: 2 };
  const isLauncherPage = new Function('launcherContents', 'LAUNCHER_ORIGIN', `return ${src};`)(new WeakSet([launcherWc]), 'dagger://launcher/');
  assert.equal(isLauncherPage(launcherWc, undefined), true, 'its window');
  assert.equal(isLauncherPage(null, 'dagger://launcher/'), true, 'its origin, with no WebContents');
  assert.equal(isLauncherPage(gameWc, 'dagger://launcher/index.html'), true, 'a launcher page some other window opened');
  assert.equal(isLauncherPage(gameWc, 'dagger://game/'), false, 'the game');
  assert.equal(isLauncherPage(null, null), false);
  assert.equal(isLauncherPage(null, 'dagger://launcherx/'), false, 'an origin that only begins the same way is not it');
  assert.match(main, /session\.defaultSession\.setPermissionRequestHandler\(\(wc, _permission, callback, details\) => callback\(!isLauncherPage\(wc, details\?\.requestingUrl\)\)\);/);
  assert.match(main, /session\.defaultSession\.setPermissionCheckHandler\(\(wc, permission, requestingOrigin\) => !isLauncherPage\(wc, requestingOrigin\) && permission !== 'deprecated-sync-clipboard-read'\);/,
    'the check side - and with no handler Electron grants every check but the deprecated synchronous paste, which the game keeps');
  const ready = main.slice(main.indexOf('app.whenReady().then(() => {'));
  assert.ok(ready.indexOf('setPermissionCheckHandler(') >= 0 && ready.indexOf('setPermissionCheckHandler(') < ready.indexOf('runLauncher();'), 'both fences stand before the first window');
});

// ---- the release notes -------------------------------------------------------

// ---- ARENA2: every look at the disks off the main process (lane D) ---------------------------------------------

const L = createRequire(import.meta.url)('../app/lib/launcherState.cjs');
const { looseRoots, detectArena2 } = createRequire(import.meta.url)('../app/lib/arena2Detect.cjs');
const state = (over = {}) => L.initialState({ current: '0.1.4700', transport: 'updater', checkEnabled: false, ...over });
const apply = (s, ...events) => events.reduce(L.reduce, s);
const body = (decl) => {
  const at = main.indexOf(decl);
  assert.ok(at >= 0, `${decl} is in app/main.cjs`);
  const next = main.slice(at + decl.length).search(/\n(?:async )?function |\n\/\*\* |\nconst [A-Z_]+ = |\nlet |\nipcMain\.|\napp\./);
  return next < 0 ? main.slice(at) : main.slice(at, at + decl.length + next);
};

test('R2-D1: the saved folder is looked at BESIDE the window, never before it - a share that is down kept the launcher off the screen', () => {
  // round 1's L4-1 moved the search off the main process and left the saved folder on it: three blocking reads before
  // the window, and on a hard mount that never answers, no window at all. Measured on lane D's hung share since: the
  // launcher on screen in 0.36 s, "cannot be reached" at the deadline, and a quit with the probe stuck exits in 0.1 s.
  const run = body('function runLauncher()');
  assert.match(run, /setArena2\(null\);/);
  assert.doesNotMatch(run, /readdirSync|existsSync|statSync|askArena2\(|judgeArena2|resolveArena2/, 'nothing on the disk before the window');
  assert.ok(run.indexOf('win: openLauncherWindow()') < run.indexOf('if (savedDir) judgeSaved(launcher, savedDir);'), 'the window first');
  assert.match(body('function judgeSaved('), /if \(r\.dir\) setArena2\(r\.dir\);\s*launcherDispatch\(\{ type: 'saved-judged', \.\.\.r \}\);/);
  // meanwhile: the front door, Play held, the gem breathing - and a late answer changes nothing once decided
  const checking = state({ savedDir: '/nas/ARENA2' });
  assert.deepEqual([checking.setup.status, L.canPlay(checking), L.viewOf(checking).panel, L.viewOf(checking).busy], ['checking', false, 'news', true]);
  assert.deepEqual(L.viewOf(checking).options.files, { path: '/nas/ARENA2', note: '', label: 'Change folder' });
  // not whole with the game's own picker kept (the probe's env, a config from before): the picker, as before
  assert.equal(apply(state({ savedDir: '/nas/ARENA2', inGamePicker: true }), { type: 'saved-judged', missing: null, unreadable: true }).setup.status, 'skipped');
  assert.equal(apply(state({ savedDir: '/nas/ARENA2' }), { type: 'saved-judged', missing: null, unreadable: true }).setup.status, 'looking');
  assert.equal(L.reduce(apply(checking, { type: 'saved-judged', dir: '/nas/ARENA2' }), { type: 'saved-judged', missing: null, unreadable: true }).setup.status, 'ready', 'judged once');
  // a folder that did not answer in time is out of reach, and says so
  assert.deepEqual(folderAnswerOf({ late: true }), { missing: null, unreadable: true, late: true, cut: false });
  assert.deepEqual(folderAnswerOf({ failed: true }), { missing: null, unreadable: true, late: false, cut: false });
  assert.deepEqual(folderAnswerOf({ dir: '/a/ARENA2', missing: ['X'] }), { dir: '/a/ARENA2' });
  // an install downloaded meanwhile waits for the files to be SET - checking included (lane A A8)
  const waiting = apply(state({ savedDir: '/nas/ARENA2', checkEnabled: true }), { type: 'check-available', version: '0.1.4701' }, { type: 'downloaded', version: '0.1.4701' });
  assert.equal(L.nextStep(waiting), 'wait');
  assert.equal(L.viewOf(waiting).status, 'v0.1.4701 is ready to install');
  assert.equal(L.nextStep(apply(waiting, { type: 'saved-judged', dir: '/nas/ARENA2' })), 'install');
});

/** main.cjs's folderAnswer, run. */
function folderAnswerOf(a) {
  const src = main.slice(main.indexOf('function folderAnswer('), main.indexOf('/** The native folder dialog: the folder picked'));
  return new Function(`${src}; return folderAnswer;`)()(a);
}

test('R2-D4: the search goes on past its deadline, and a later find is added - never "go and get it" for a search cut short', () => {
  const looking = state();
  const none = apply(looking, { type: 'found', found: [], searching: true });
  assert.deepEqual([none.setup.status, none.setup.searching, L.viewOf(none).busy], ['none', true, true]);
  assert.match(L.viewOf(none).setup.detail, /^Still looking on slower drives - they are added here if they turn up\./);
  const late = apply(none, { type: 'found-more', found: { dir: '/mnt/steam/ARENA2', source: 'steam' } });
  assert.deepEqual([late.setup.status, late.setup.found.map((f) => f.dir)], ['found', ['/mnt/steam/ARENA2']]);
  assert.equal(L.viewOf(late).setup.found[0].primary, true, 'the one thing found is the card\'s answer');
  assert.deepEqual(apply(late, { type: 'found-more', found: { dir: '/mnt/steam/ARENA2', source: 'steam' } }).setup.found.length, 1, 'once');
  assert.equal(apply(late, { type: 'found-more', found: { dir: '/b/ARENA2', source: 'folder' } }).setup.found.length, 2);
  const refused = apply(none, { type: 'picked-bad', missing: null }, { type: 'found-more', found: { dir: '/c/ARENA2', source: 'gog' } });
  assert.deepEqual([refused.setup.status, refused.setup.found.length], ['bad', 1], 'offered on a refusal\'s card too');
  // once the player has chosen - a folder, or the game's own picker - a late find is nothing
  assert.equal(apply(apply(none, { type: 'picked', dir: '/x' }), { type: 'found-more', found: { dir: '/y', source: 'steam' } }).setup.found.length, 0);
  assert.equal(apply(none, { type: 'skip-setup' }).setup.searching, false);
  assert.equal(apply(none, { type: 'picked', dir: '/x' }).setup.searching, false, 'and the search is let go');
  const done = apply(none, { type: 'detect-done' });
  assert.equal(done.setup.searching, false);
  assert.doesNotMatch(L.viewOf(done).setup.detail, /Still looking/, 'concluded: the card says where to get it, plainly');
  assert.equal(L.viewOf(done).busy, false);
  assert.equal(apply(looking, { type: 'found-more', found: { dir: '/z', source: 'dfu' } }).setup.found.length, 0, 'before the deadline the finds are the shell\'s to hold');
});

test('R2-D5: on a Mac the privacy-guarded folders are read LAST - after ~/Games, as "only when nothing else was found" says', () => {
  const roots = looseRoots({ platform: 'darwin', home: '/Users/p', env: {} }, ['/Users/p/Downloads']);
  assert.deepEqual(roots.map((r) => [r.dir, r.guarded]), [
    ['/Users/p/Games', false], ['/Users/p/Downloads', true], ['/Users/p/Desktop', true], ['/Users/p/Documents', true],
  ]);
  assert.deepEqual(looseRoots({ platform: 'linux', home: '/h', env: {} }, []).map((r) => r.dir), ['/h/Downloads', '/h/Desktop', '/h/Documents', '/h/Games'], 'elsewhere the order stands');
  // run: the files in ~/Games, and not one guarded folder read on the way (each read would be a system prompt)
  const home = mkdtempSync(join(tmpdir(), 'r2-mac-'));
  try {
    const a2 = join(home, 'Games', 'Daggerfall', 'arena2');
    for (const d of [a2, join(home, 'Downloads'), join(home, 'Desktop'), join(home, 'Documents')]) fsModule.mkdirSync(d, { recursive: true });
    for (const n of ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD', 'TEXT.RSC', 'ART_PAL.COL']) writeFileSync(join(a2, n), 'x');
    const read = [];
    const fs2 = new Proxy(fsModule, { get: (t, k) => (k === 'readdirSync' ? (d, o) => { read.push(String(d)); return t.readdirSync(d, o); } : t[k]) });
    const found = detectArena2({ platform: 'darwin', home, env: {}, fs: fs2, regQuery: () => [] });
    assert.equal(found.length, 1);
    const guarded = read.filter((d) => ['Downloads', 'Desktop', 'Documents'].some((g) => d.startsWith(join(home, g))));
    assert.deepEqual(guarded, [], 'three prompts for files that were elsewhere');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('R2-D6/D7/D8: the doors - a refusal said where it can be seen, "cannot be read" said as such, a saved folder never lost to one launch\'s choice', () => {
  // D7: decided once the answer is in - during the search a refusal meant for the card was dropped without a word
  const choose = body('async function launcherChooseFolder()');
  assert.doesNotMatch(choose, /const onCard = viewOf/, 'not decided before the dialog');
  assert.match(choose, /if \(reduce\(l\.state, \{ type: 'picked-bad', \.\.\.r \}\)\.setup\.status === 'bad'\) \{ launcherDispatch\(\{ type: 'picked-bad', \.\.\.r \}\); return; \}\s*await launcherDialog\(\(\) => dialog\.showMessageBox\(l\.win,/);
  assert.equal(L.reduce(state(), { type: 'picked-bad', missing: null }).setup.status, 'looking', 'the card while looking cannot say it - so the box does');
  // D8: a found folder whose drive went away is "could not be read", not "holds no Daggerfall files"
  const gone = apply(state(), { type: 'found', found: [{ dir: '/usb/ARENA2', source: 'folder' }] }, { type: 'picked-bad', missing: null, unreadable: true });
  assert.equal(L.viewOf(gone).setup.title, 'That folder cannot be read');
  assert.match(L.viewOf(gone).setup.detail, /^It could not be read - is its drive connected\?/);
  // D3 (words): a pick that did not answer in time, or whose search ran out of budget, is never "no Daggerfall files"
  assert.match(L.notArena2Detail(null, { unreadable: true, late: true }), /^It did not answer in time - is its drive asleep, or disconnected\?/);
  assert.match(L.notArena2Detail(null, { cut: true }), /^It holds too many folders to look through them all\./);
  assert.match(L.notArena2Detail(['MAPS.BSA'], { cut: true }), /^It has no MAPS\.BSA\./, 'a partial folder names what it lacks, cut or not');
  // D6: the game's own picker chosen on the SAVED folder's card is this launch's alone - kept, it hid the folder for good
  const acts = main.slice(main.indexOf("ipcMain.on('launcher:act'"), main.indexOf('// THE NAVIGATION FENCES'));
  assert.match(acts, /saveConfig\(st\.setup\.saved \? \{ \.\.\.loadConfig\(\), arena2IngestClear: true \} : \{ \.\.\.loadConfig\(\), arena2InGame: true \}\);/);
  // D8, the shell's half: the whole answer reaches the card - unreadable and late with it
  assert.match(acts, /case 'use-found': \{[\s\S]*?if \(r\.dir\) useArena2\(r\.dir\);\s*else launcherDispatch\(\{ type: 'picked-bad', \.\.\.r \}\);/);
  // one judgment at a time, and an install waits on it as on a dialog
  const judge = body('async function judgeForLauncher(');
  assert.match(judge, /if \(!l \|\| l\.judging\) return null;/);
  assert.match(judge, /return await launcherDialog\(async \(\) => folderAnswer\(await askArena2\(question, \{ deadline, signal: l\.stop\.signal \}\)\)\);/);
  assert.match(choose, /if \(!launcher \|\| launcher\.state\.launch \|\| launcher\.judging\) return;/);
  assert.equal(L.viewOf(apply(state({ arena2Dir: '/a' }), { type: 'judging', on: true })).busy, true);
});

test('R2-E5: a Mac\'s refusal points at DaggerfallGameFiles.zip, never Steam or GOG, and keeps its door', () => {
  const mac = L.notArena2Detail(['MAPS.BSA'], { platform: 'darwin' });
  assert.match(mac, /Choose the arena2 folder inside the unpacked DaggerfallGameFiles\.zip\.$/);
  assert.doesNotMatch(mac, /Steam|GOG/);
  const bad = apply(state({ platform: 'darwin' }), { type: 'found', found: [] }, { type: 'picked-bad', missing: null });
  assert.deepEqual(L.viewOf(bad).setup.actions.map((a) => [a.id, a.arg ?? null]), [['choose-folder', null], ['open', 'zip'], ['skip-setup', null]]);
  assert.doesNotMatch(L.viewOf(bad).setup.detail, /Steam|GOG/);
  const win = apply(state(), { type: 'found', found: [] }, { type: 'picked-bad', missing: null });
  assert.deepEqual(L.viewOf(win).setup.actions.map((a) => a.id), ['choose-folder', 'skip-setup']);
  assert.match(body('async function locateArena2('), /detail: notArena2Detail\(r\.missing, \{ \.\.\.r, platform: process\.platform \}\),/, 'the File menu\'s door says it the same way');
});

// ---- the update lifecycle (lane A) ------------------------------------------------------------------------------

test('R2-A2: a check made while a download runs never takes the download\'s place - its token, and its end, stay the download\'s', async () => {
  // askUpdater, run against electron-updater's own rule: a check during a download returns the SAME download under a
  // NEW token that stops nothing (AppUpdater.downloadUpdate, 6.8.9)
  const src = main.slice(main.indexOf('function askUpdater()'), main.indexOf('/** DA10: news.json'));
  const events = [];
  let settle = null;
  let running = null;
  let fail = false;
  const au = {
    checkForUpdates: async () => {
      if (fail) throw new Error('HTTP 500');
      const token = { id: Math.random() };
      running ??= new Promise((res, rej) => { settle = { res, rej }; });
      return { cancellationToken: token, downloadPromise: running, updateInfo: { version: '0.1.4701' } };
    },
  };
  const shell = new Function('autoUpdater', 'stopStallWatch', 'launcherDispatch', `let downloading = null;\n${src}\nreturn { askUpdater, now: () => downloading };`)(
    () => au, () => events.push('stop-watch'), (ev) => events.push(ev.type));
  const first = await shell.askUpdater();
  const token = shell.now().token;
  assert.equal(token, first.cancellationToken, 'the check that STARTED the download keeps its token');
  const second = await shell.askUpdater();
  assert.notEqual(second.cancellationToken, token);
  assert.equal(shell.now().token, token, 'a later check\'s token stops nothing - it is never taken');
  fail = true;
  await assert.rejects(shell.askUpdater(), /HTTP 500/, 'a CHECK that fails rejects its own promise');
  assert.deepEqual(events, [], 'and is no download\'s failure');
  settle.rej(new Error('ECONNRESET'));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(events, ['stop-watch', 'download-failed'], 'the download breaking off is said once, by the download');
  assert.equal(shell.now(), null, 'and the next check may start afresh');
  // the hourly re-check never asks over a running download
  assert.match(main, /if \(!updateReady && !installStarted && !downloading\) askUpdater\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(body('async function checkForUpdatesViaUpdater()'), /try \{ result = await askUpdater\(\); \}/, 'the File menu\'s check too - one place keeps the download');
});

test('R2-A1/A5: an update\'s quit hands the lock to the new copy - and a quit queued behind an install that already failed is held', () => {
  const quitFor = main.slice(main.indexOf("require('electron').autoUpdater.on('before-quit-for-update'"), main.indexOf('/** AUDIT INSTALL L2-2/L2-3: THE ONE DOOR'));
  // A5 first: the install already failed (NSIS: the spawn's error lands before electron-updater's queued quit) - held
  assert.match(quitFor, /if \(installFault\) \{ holdQuit = true; return; \}\s*leaveForUpdate = true;/);
  // A1: the new AppImage is started before this copy quits - the lock is released so its requestSingleInstanceLock is yes
  assert.match(quitFor, /leaveForUpdate = true;\s*(\/\/[^\n]*\n\s*)*app\.releaseSingleInstanceLock\(\);\s*\}\);/);
  assert.match(quitFor, /app\.on\('before-quit', \(e\) => \{ if \(holdQuit\) \{ holdQuit = false; e\.preventDefault\(\); \} \}\);/);
  assert.match(body('function installNow('), /installStarted = true;\s*installFault = false;/, 'each try starts clean');
  assert.match(body('function installFailed()'), /installStarted = false;\s*installFault = true;/);
  assert.equal((main.match(/releaseSingleInstanceLock\(\)/g) ?? []).length, 1, 'only an update\'s quit gives it up');
});

test('R2-A6/A10: the in-game switch starts the hourly check; the File menu\'s check never says "up to date" off a check never made', () => {
  const sw = body('function setCheckOnLaunch(');
  assert.ok(sw.indexOf('if (on) startRechecks();') >= 0 && sw.indexOf('if (on) startRechecks();') < sw.indexOf('if (!launcher) return;'), 'before the launcher-only half returned');
  const manual = body('async function checkForUpdatesViaUpdater()');
  assert.match(manual, /if \(!result\) \{ await checkForUpdates\(\); return; \}/, 'electron-updater declined: GitHub is asked directly');
  const loud = main.slice(main.indexOf('async function checkForUpdatesViaUpdater'), main.indexOf('/** { tag, url, download } of the latest release'))
    + main.slice(main.indexOf('async function checkForUpdates()'), main.indexOf('/** While the app runs, ask again'));
  assert.doesNotMatch(loud, /dialog\.showMessageBox\(/, 'no box without a window over it');
  assert.match(body('function tellBox('), /const parent = BrowserWindow\.getFocusedWindow\(\) \?\? \(gameWindow && !gameWindow\.isDestroyed\(\) \? gameWindow : null\);\s*return parent \? dialog\.showMessageBox\(parent, opts\) : dialog\.showMessageBox\(opts\);/,
    'over the window found - a parentless box can open behind a fullscreen game');
  assert.match(main, /appImage: !!process\.env\.APPIMAGE,/, 'the table knows whether this copy runs as its AppImage');
});

// ---- the launcher's page, run (lane E) ---------------------------------------------------------------------------
// app/launcher/launcher.js over app/launcher/index.html in test/launcherDom.mjs, fed views the real state makes

const view = (s) => L.viewOf(s);
const foundOne = () => apply(state(), { type: 'found', found: [{ dir: '/games/DF/DAGGER/ARENA2', source: 'steam' }] });

test('R2-E1: after the first run\'s card the focus is on PLAY - Enter plays (it stayed on the card\'s answer, hidden, and pressed nothing)', async () => {
  const { bootLauncher } = await import('./launcherDom.mjs');
  const p = bootLauncher();
  p.show(view(foundOne()));
  assert.equal(p.doc.activeElement.textContent, 'Use these files', 'the card\'s answer first');
  p.show(view(apply(foundOne(), { type: 'picked', dir: '/games/DF/DAGGER/ARENA2' })));
  assert.equal(p.$('setup').hidden, true);
  assert.equal(p.doc.activeElement.id, 'play', 'the answer taken, the card gone: Enter plays');
  // the player's own control keeps the focus: Play never takes it from a switch they are on (E-13)
  const q = bootLauncher();
  q.show(view(state({ arena2Dir: '/a', checkEnabled: true })));
  q.$('update-check').focus();
  q.show(view(apply(state({ arena2Dir: '/a', checkEnabled: true }), { type: 'check-none' })));
  assert.equal(q.doc.activeElement.id, 'update-check');
  // and a view that changes nothing it keys on moves nothing (E-14): the card's answer is not retaken on every view
  const r = bootLauncher();
  r.show(view(foundOne()));
  r.$('update-check').focus();
  r.show(view(foundOne()));
  assert.equal(r.doc.activeElement.id, 'update-check', 'the same card again leaves the focus where the player put it');
});

test('R2-E4/E8: one live region, and the notes as written - nested bullets stay nested, titles without "Patch Notes:"', async () => {
  const html = rd('app/launcher/index.html');
  assert.deepEqual([...html.matchAll(/<([a-z0-9]+)[^>]*\saria-live="[^"]+"[^>]*>/g)].map((m) => /id="([^"]+)"/.exec(m[0])?.[1]), ['status'],
    'the status line alone - the card is announced by the focus that moves to its answer');
  const { bootLauncher } = await import('./launcherDom.mjs');
  const p = bootLauncher();
  const text = '# Patch Notes: The Warden\n\n## Phases\n- **Three phases:**\n  - **The Burning Court**: fire.\n  - **Champion**: spokes.\n- He leaps.\n\nA paragraph\nthat wraps.';
  p.show(view(state({ arena2Dir: '/a', news: [{ version: '0.1.4700', date: '2026-09-29T00:00:00Z', text }] })));
  const release = p.doc.querySelector('#news .feed .release');
  assert.equal(release.querySelector('h4').textContent, 'The Warden', 'E-21: the title as a player reads it');
  const top = release.querySelector('ul');
  assert.deepEqual(top.children.map((li) => li.childNodes.filter((c) => !(c.tagName === 'UL')).map((c) => c.textContent).join('')), ['Three phases:', 'He leaps.']);
  const nested = top.children[0].querySelector('ul');
  assert.ok(nested, 'the sub-points inside their point');
  assert.deepEqual(nested.children.map((li) => li.textContent), ['The Burning Court: fire.', 'Champion: spokes.']);
  assert.equal(release.querySelector('p').textContent, 'A paragraph that wraps.');
});

test('R2-E (L5-21, L5-12): the page redraws what changed and nothing else - a button under the pointer is never rebuilt between press and release', async () => {
  const { bootLauncher } = await import('./launcherDom.mjs');
  const p = bootLauncher();
  // a download: views many times a second, only the percent moving - "Play without updating" stays the same element
  const dl = (pct) => view(apply(state({ arena2Dir: '/a', checkEnabled: true }), { type: 'check-available', version: '0.1.4701', total: 100e6 }, { type: 'progress', percent: pct, transferred: pct * 1e6, total: 100e6 }));
  p.show(dl(10));
  const button = p.$('status-actions').children[0];
  const rebuilt = p.$('status-actions').replaced;
  for (const pct of [11, 12, 13]) p.show(dl(pct));
  assert.equal(p.$('status-actions').replaced, rebuilt, 'E-16: not rebuilt on every tick');
  assert.equal(p.$('status-actions').children[0], button);
  assert.equal(button.textContent, 'Play without updating');
  // E-17/E-18: the bar shows while there is progress, and says how far
  const track = p.doc.querySelector('#progress .track');
  assert.equal(p.$('progress').hidden, false);
  assert.equal(track.getAttribute('aria-valuenow'), '13');
  assert.equal(track.getAttribute('aria-valuetext'), '13.0 of 100.0 MB');
  p.show(view(state({ arena2Dir: '/a' })));
  assert.equal(p.$('progress').hidden, true, 'and hides when there is none');
  // E-15: the card is not rebuilt by a view that leaves it as it was
  const q = bootLauncher();
  q.show(view(foundOne()));
  const cardBuilds = q.$('setup-actions').replaced;
  q.show(view(foundOne()));
  assert.equal(q.$('setup-actions').replaced, cardBuilds);
  // E-19: the card and the news trade places; E-20: the switch shows the setting; E-22: the files door's own words
  assert.deepEqual([q.$('setup').hidden, q.$('news').hidden], [false, true]);
  q.show(view(state({ arena2Dir: '/games/ARENA2', checkEnabled: false, checkOnLaunch: false })));
  assert.deepEqual([q.$('setup').hidden, q.$('news').hidden], [true, false]);
  assert.equal(q.$('update-check').checked, false);
  q.show(view(state({ arena2Dir: '/games/ARENA2', checkEnabled: true })));
  assert.equal(q.$('update-check').checked, true);
  assert.equal(q.doc.querySelector('[data-act="choose-folder"]').textContent, 'Change folder');
  q.show(view(state({ inGamePicker: true })));
  assert.equal(q.doc.querySelector('[data-act="choose-folder"]').textContent, 'Choose folder');
  assert.equal(q.$('files').textContent, 'Chosen in the game');
});

test('R2-E (L5-23, E-23/24, E-25..31): the page\'s own rules - every small word at AA, the keyboard\'s way in, hidden that hides, a bar that holds still', () => {
  const css = rd('app/launcher/launcher.css');
  const html = rd('app/launcher/index.html');
  // contrast, computed: WCAG's relative luminance, for every text colour a small word wears and what it sits on
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const vars = { '--ruby': /--ruby: (#[0-9a-f]{6})/.exec(css)[1], '--brass': /--brass: (#[0-9a-f]{6})/.exec(css)[1] };
  const rule = (sel) => {
    const m = new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css);
    assert.ok(m, `${sel} is a rule`);
    const val = (prop) => { const v = new RegExp(`(?:^|;)\\s*${prop}: ([^;]+);`).exec(m[1])?.[1]?.trim(); return v?.startsWith('var(') ? vars[v.slice(4, -1)] : v; };
    return { color: val('color'), background: val('background') };
  };
  const night = '#0a0c11';
  for (const [sel, on] of [['.badge.new', null], ['.badge.update', null], ['.release .date', night], ['.release p', night], ['#detail', night], ['.progress .label', night], ['.files', night]]) {
    const r = rule(sel);
    const c = ratio(r.color, on ?? r.background);
    assert.ok(c >= 4.5, `${sel}: ${r.color} on ${on ?? r.background} is ${c.toFixed(2)}:1 - small text needs 4.5 (WCAG AA)`);
  }
  // the keyboard's way in: the news is a tab stop that scrolls (E-23, E-29), the switch is named by its label (E-24)
  assert.match(html, /<div class="feed" tabindex="0"><\/div>/);
  assert.match(css, /\.feed \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/);
  assert.match(html, /<label class="check"><input id="update-check" type="checkbox"> Check automatically<\/label>/);
  // a focused control shows it (E-26, E-27)
  assert.match(css, /\.plaque:hover, \.plaque:focus-visible \{[^}]*border-color: var\(--brass\);/);
  assert.match(css, /\.check input:focus-visible \{ outline: none; border-color: var\(--brass\); \}/);
  // hidden wins over every region's own display (E-25); a long path shows its END (E-28); one bar height (E-30)
  assert.match(css, /^\[hidden\] \{ display: none !important; \}$/m);
  assert.match(css, /\.path \{[^}]*direction: rtl;/);
  assert.match(css, /\.bar \{[^}]*[^-]height: 100px;/);
  assert.doesNotMatch(css, /\.bar \{[^}]*min-height/);
  // the gem holds still for a player who asked for less motion (E-31), and the card scrolls in the brand's bar (E-7)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*body\[data-busy\] \.gem \{ animation: none; \}/);
  assert.match(css, /\.setup::-webkit-scrollbar-thumb \{ background: rgba\(125,116,96,0\.45\); \}/);
});

// ---- the laws round 1 left unpinned (lane E's survivors) ---------------------------------------------------------

test('R2-E (E-01..E-12): the launcher state\'s own laws - timings a player can read, the right names, a fresh bar, the notes in order', () => {
  // E-01/E-02: "Installing" stays long enough to read, and an installer that never takes over frees Play soon after
  assert.ok(L.INSTALL_NOTICE_MS >= 1000 && L.INSTALL_NOTICE_MS <= 3000, `${L.INSTALL_NOTICE_MS} ms`);
  assert.ok(L.INSTALL_GIVEUP_MS > L.INSTALL_NOTICE_MS && L.INSTALL_GIVEUP_MS <= 30000, `${L.INSTALL_GIVEUP_MS} ms`);
  // E-03: each source by its own name
  assert.deepEqual(L.SOURCE_LABEL, { dfu: 'from Daggerfall Unity', steam: 'Steam', gog: 'GOG', folder: 'on this computer' });
  // E-04: a download tried again starts from nothing - not the failed one's percent and megabytes
  const failed = apply(state({ arena2Dir: '/a', checkEnabled: true }), { type: 'check-available', version: '0.1.4701', total: 100e6 },
    { type: 'progress', percent: 60, transferred: 60e6, total: 100e6 }, { type: 'download-failed' });
  const again = apply(failed, { type: 'check-available', version: '0.1.4701', total: 100e6 });
  assert.deepEqual([again.update.percent, again.update.transferred], [0, 0]);
  // E-12: before the first byte it says it is starting - never "0.0 of 0.0 MB"
  const starting = apply(state({ arena2Dir: '/a', checkEnabled: true }), { type: 'check-available', version: '0.1.4701' });
  assert.equal(view(starting).progress.label, 'Starting the download');
  // E-05: a stray refusal never sends a player whose files are set back to the card
  assert.equal(L.reduce(state({ arena2Dir: '/a' }), { type: 'picked-bad', missing: null }).setup.status, 'ready');
  // E-06: the news newest first, whatever order GitHub answers in (a hand re-cut of an old build is listed late)
  const news = L.newsFrom([{ tag_name: 'app-v0.1.4600', body: 'old' }, { tag_name: 'app-v0.1.4701', body: 'new' }, { tag_name: 'app-v0.1.4650', body: 'mid' }]);
  assert.deepEqual(news.map((n) => n.version), ['0.1.4701', '0.1.4650', '0.1.4600']);
  // E-07: the version under Play; E-11: a stuck install says it tries again at quit, and how to run it by hand
  assert.equal(view(state({ arena2Dir: '/a' })).version, 'v0.1.4700');
  const stuck = apply(state({ arena2Dir: '/a', checkEnabled: true, installFailedFor: '0.1.4701' }), { type: 'check-available', version: '0.1.4701' }, { type: 'downloaded', version: '0.1.4701' });
  assert.match(view(stuck).detail, /^Play this version - it tries again when you quit\. Or run the installer yourself/);
});

test('R2-E (E-43..E-47): the places a copy of Daggerfall is installed - each one run, not assumed', () => {
  const root = mkdtempSync(join(tmpdir(), 'r2-roots-'));
  const whole = (d) => { fsModule.mkdirSync(d, { recursive: true }); for (const n of ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD', 'TEXT.RSC', 'ART_PAL.COL']) writeFileSync(join(d, n), 'x'); return d; };
  try {
    // E-43: Daggerfall Unity's settings on Windows are in LocalLow (Unity's persistentDataPath), never Roaming
    const home = join(root, 'win');
    const dfu = whole(join(root, 'dfu-data', 'arena2'));
    fsModule.mkdirSync(join(home, 'AppData', 'LocalLow', 'Daggerfall Workshop', 'Daggerfall Unity'), { recursive: true });
    writeFileSync(join(home, 'AppData', 'LocalLow', 'Daggerfall Workshop', 'Daggerfall Unity', 'settings.ini'), `[Daggerfall]\nMyDaggerfallPath = ${join(root, 'dfu-data')}\n`);
    assert.deepEqual(detectArena2({ platform: 'win32', home, env: { USERPROFILE: home }, regQuery: () => [] }).map((f) => [f.source, f.dir]), [['dfu', fsModule.realpathSync(dfu)]]);
    // E-44: the registry's HKCU (Steam's own key) is read as HKEY_CURRENT_USER
    const reg = 'Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Software\\Valve\\Steam]\r\n"SteamPath"="d:/games/steam"\r\n';
    assert.deepEqual(createRequire(import.meta.url)('../app/lib/arena2Detect.cjs').regFileValues(reg, 'HKCU\\Software\\Valve\\Steam', 'SteamPath'), ['d:/games/steam']);
    // E-45/E-47: Flatpak's Steam and Heroic's GOG, on Linux
    const lin = join(root, 'lin');
    const flat = join(lin, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam', 'steamapps');
    fsModule.mkdirSync(flat, { recursive: true });
    writeFileSync(join(flat, 'appmanifest_1812390.acf'), '"AppState" { "installdir" "The Elder Scrolls Daggerfall" }');
    const steamA2 = whole(join(flat, 'common', 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    const heroicA2 = whole(join(lin, 'Games', 'Heroic', 'Daggerfall', 'ARENA2'));
    const linFound = detectArena2({ platform: 'linux', home: lin, env: {}, regQuery: () => [] });
    assert.deepEqual(linFound.map((f) => [f.source, f.dir]), [['steam', fsModule.realpathSync(steamA2)], ['gog', fsModule.realpathSync(heroicA2)]]);
    // E-46: on Windows a folder reached down two spellings of one path is offered once (the disk ignores case)
    const winHome = join(root, 'w2');
    for (const pf of ['ProgramFiles', 'programfiles']) {
      const lib = join(root, pf, 'Steam', 'steamapps');
      fsModule.mkdirSync(lib, { recursive: true });
      writeFileSync(join(lib, 'appmanifest_1812390.acf'), '"AppState" { "installdir" "DF" }');
      whole(join(lib, 'common', 'DF', 'ARENA2'));
    }
    const twice = detectArena2({ platform: 'win32', home: winHome, env: { ProgramFiles: join(root, 'ProgramFiles'), 'ProgramFiles(x86)': join(root, 'programfiles') }, regQuery: () => [] });
    assert.equal(twice.length, 1, `one install, offered once (got ${twice.map((f) => f.dir).join(', ')})`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('R2-E (E-32..E-42, E-52..E-54): the shell\'s and the workflow\'s wiring the suite never read', () => {
  // E-32: Play is heard once - the launch is marked before the game's window is built, or the next event opens another
  assert.match(body('function launchGame()'), /^function launchGame\(\) \{\s*launcherDispatch\(\{ type: 'launching' \}\);/);
  // E-33: the launcher is shown (built hidden, shown when ready)
  assert.match(body('function openLauncherWindow()'), /win\.once\('ready-to-show', \(\) => \{ if \(!win\.isDestroyed\(\)\) win\.show\(\); \}\);/);
  // E-36: the version last played reaches the state - the NEW marks and "Updated to" read it
  assert.match(body('function runLauncher()'), /lastPlayed: cfg\.lastPlayed,/);
  // E-37: the saves folder exists before it is opened - a fresh install has none
  assert.match(body('function openSavesFolder()'), /fs\.mkdirSync\(dir, \{ recursive: true \}\);\s*shell\.openPath\(dir\);/);
  // E-38: the menu's checkbox follows the launcher's switch (the macOS menu bar outlives it)
  assert.match(body('function setCheckOnLaunch('), /saveConfig\(\{ \.\.\.loadConfig\(\), updateCheck: !!on \}\);\s*buildMenu\(\);/);
  // E-41/E-42: the news asks GitHub for ten seconds at most, and a refusal (a 403 rate limit) never overwrites the kept news
  const news = body('async function fetchNews()');
  assert.match(news, /signal: AbortSignal\.timeout\(10000\),/);
  assert.ok(news.indexOf("if (!res.ok) throw new Error(`HTTP ${res.status}`);") >= 0 && news.indexOf("if (!res.ok) throw new Error(`HTTP ${res.status}`);") < news.indexOf('saveNews(items);'));
  // E-52: no ${{ }} text reaches ANY script in the release workflow - multi-line blocks included (L1-5's pin read one line)
  const wf = rd('.github/workflows/release-desktop.yml');
  const pasted = jobsOf(wf).flatMap((j) => stepsOf(j.text).map((s) => [nameOf(s), runOf(s)])).filter(([, run]) => run && /\$\{\{/.test(run));
  assert.deepEqual(pasted, [], 'every value a script reads comes through its env');
  // E-53: an artifacts-only run stamps nothing - `npm version ""` would fail the leg
  const build = jobsOf(wf).find((j) => j.name === 'build');
  assert.match(stepsOf(build.text).find((s) => nameOf(s) === 'Stamp the version'), /\n {8}if: needs\.version\.outputs\.version != ''\n/);
  // E-54: no signing identity is hunted for on the Mac leg
  assert.match(build.text, /\n {4}env:\n(?: {6}#[^\n]*\n)* {6}CSC_IDENTITY_AUTO_DISCOVERY: 'false'\n/);
});
