// DA11 (2026-09-30, Mac: "Everytime DFO updates, even with the launcher, it
// deletes itself").
//
// The built site shipped beside the app as `extraResources` - 18,354 loose
// files under resources/dist, 18,430 in the Windows install (read out of the
// published app-v0.1.5024 setup's app-64.7z). A Windows update is
// electron-builder's silent NSIS: the OLD uninstaller moves every installed
// file out to %TEMP% (un.atomicRMDir, one Rename a file), then the NEW
// installer unpacks every file to %TEMP% and copies each one in
// (extractUsing7za) - no window, the antivirus reading each new file. The
// install folder stood empty for as long as that took, while the launcher
// said "closes and reopens by itself in a few seconds": the player found
// the app gone, a shortcut clicked then was a dead one Windows offers to
// delete (and the install, keeping shortcuts, never makes it again), a
// setup run by hand quit on the silent one's lock, and a restart or a
// logoff in that window left no app at all.
//
// The site rides INSIDE app.asar now - one file - and the Linux build's
// install is 74 files where it was 18,428 (electron-builder --linux dir,
// before and after). Electron's fs and its file:// fetch read inside the
// archive, so the dagger:// handler is unchanged (tools/appShellProbe.mjs
// green against the packaged build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const b = JSON.parse(rd('app/package.json')).build;
const main = rd('app/main.cjs');

test('DA11 the built site is packed into app.asar, never shipped beside it as loose files', () => {
  const sets = b.files.filter((f) => typeof f === 'object');
  // DA12: and the game's pad loop, one module beside the launcher's page - into the archive too
  assert.deepEqual(sets, [{ from: '../src/ui', to: 'launcher', filter: ['menuPad.js'] }, { from: '../dist', to: 'dist' }], 'dist/ rides the app\'s own files - into the archive');
  assert.notEqual(b.asar, false, 'the archive is what makes it one file');
  assert.equal(b.asarUnpack, undefined, 'and nothing is unpacked back out beside it');
  const extra = [b.extraResources, b.extraFiles, b.win?.extraResources, b.linux?.extraResources, b.mac?.extraResources]
    .flat().filter(Boolean);
  assert.ok(!extra.some((e) => /dist/.test(typeof e === 'string' ? e : `${e.from} ${e.to}`)),
    'no copy of dist/ outside the archive: 18,354 loose files made every Windows update empty the install folder for as long as they took');
});

test('DA11 the shell reads the site from inside the archive when packaged, from the repo\'s dist/ when not', () => {
  assert.match(main, /const DIST = app\.isPackaged\s*\? path\.join\(__dirname, 'dist'\)\s*: path\.join\(__dirname, '\.\.', 'dist'\);/,
    'packaged, __dirname IS resources/app.asar');
  assert.doesNotMatch(main, /path\.join\(process\.resourcesPath, 'dist'\)/, 'resources/dist is gone');
  // the handler is the same one: stat, then a file:// fetch - both read inside an asar (measured on Electron 42)
  assert.match(main, /if \(!p\.startsWith\(DIST \+ path\.sep\)\) return new Response\('forbidden', \{ status: 403 \}\);/, 'still traversal-proofed into dist/');
  assert.match(main, /const fileResponse = \(p, mime\) => net\.fetch\(pathToFileURL\(p\)\.toString\(\), \{ bypassCustomProtocolHandlers: true \}\)/);
});
