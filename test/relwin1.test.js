// REL2 (2026-09-21, a player on Discord: "Is there a way to install
// Daggerfall Enhanced to a specific directory, I notice the installer is
// installing to Temp/3JbF0qpIzCVkNiHRDQuHljOnrjW/Daggerfall Enhanced.exe").
//
// That path is the signature of electron-builder's PORTABLE target: the
// exe unpacks itself into a random folder under %TEMP% and runs from
// there. It is not an installer and has no directory to choose. The
// build declares BOTH Windows targets - nsis and portable - under ONE
// `artifactName`, so both wrote DaggerfallEnhanced-<v>-win-x64.exe and the
// second overwrote the first; app-v0.1.4's release carries exactly one
// Windows exe, and the player's temp path says which one survived. The
// record claimed "NSIS + portable exe" shipped. It never had.
//
// Each Windows target names its own artifact now (-setup, -portable), the
// NSIS installer is the assisted kind (oneClick false) and lets the
// player choose the directory, and the release attaches every exe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = JSON.parse(rd('app/package.json'));
const b = app.build;

/** The artifact name a target resolves to: its own, or the build's. */
const nameOf = (target) => b[target]?.artifactName ?? b.artifactName;

test('REL2 every Windows target resolves to its OWN artifact name (derived over win.target) - two targets on one name is one exe on the release', () => {
  const targets = b.win.target;
  assert.ok(targets.includes('nsis') && targets.includes('portable'), 'the installer and the portable exe both ship');
  const names = targets.map(nameOf);
  assert.equal(new Set(names).size, names.length, `each target its own name: ${names.join(' | ')}`);
  for (const t of targets) {
    assert.match(nameOf(t), /^DaggerfallEnhanced-\$\{version\}-win-\$\{arch\}-\w+\.\$\{ext\}$/, `${t}: the brand, the version, the arch, a suffix that says which`);
  }
  assert.match(nameOf('nsis'), /-setup\.\$\{ext\}$/, 'the installer says setup');
  assert.match(nameOf('portable'), /-portable\.\$\{ext\}$/, 'the portable says portable');
  // the other platforms keep the one name (the brand pin reads it)
  assert.equal(b.artifactName, 'DaggerfallEnhanced-${version}-${os}-${arch}.${ext}');
});

test('REL2 the NSIS installer is the assisted kind and lets the player choose the directory, per user', () => {
  assert.equal(b.nsis.oneClick, false, 'a one-click installer offers no directory page');
  assert.equal(b.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(b.nsis.perMachine, false, 'per-user: no elevation, and the saves folder is the user\'s');
});

test('REL2 the release attaches every exe the Windows leg wrote, and the update check still reads the TAG, never an asset name', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  assert.match(wf, /app\/release\/\*\.exe/, 'both Windows artifacts ride the same glob');
  assert.doesNotMatch(wf, /-setup\.exe|-portable\.exe/, 'the workflow names no single exe');
  const main = rd('app/main.cjs');
  assert.doesNotMatch(main, /win-x64\.exe|-setup\.exe|-portable\.exe/, 'the shell never names a download file');
});

test('REL2 the landing page tells a Windows player which file is which', () => {
  // (the version is derived per merge now - REL3, test/updatecheck.test.js)
  const landing = rd('index.html');
  assert.match(landing, /<code>-setup<\/code> file installs where you choose/);
  assert.match(landing, /<code>-portable<\/code> one runs from wherever you put it/);
});
