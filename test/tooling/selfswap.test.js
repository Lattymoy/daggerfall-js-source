// UPDATE-SWAP (2026-10-30, as the owner asked): the Mac app and the Windows portable exe cannot
// install, so they download their own file from the release and swap it in once they have quit (app/lib/selfSwap.cjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assetCheck, swapPlan, swapScript, shq, cmdq } = require('../../app/lib/selfSwap.cjs');
const yes = () => true;
const no = () => false;

test('UPDATE-SWAP: the release\'s own size and sha256 are what a download is held to', () => {
  const sha = 'a'.repeat(64);
  assert.deepEqual(assetCheck({ size: 10, digest: `sha256:${sha}` }), { size: 10, sha256: sha });
  assert.deepEqual(assetCheck({ size: 10 }), { size: 10, sha256: null }, 'a release from before GitHub listed digests: the size alone');
  assert.equal(assetCheck({ size: 0 }), null);
  assert.equal(assetCheck(null), null);
  assert.deepEqual(assetCheck({ size: 10, digest: 'md5:abc' }), { size: 10, sha256: null });
});

test('UPDATE-SWAP: who swaps - the portable exe and a Mac app in a folder it can write; never the disk image, a translocated copy, or a folder it cannot', () => {
  const portable = swapPlan({ platform: 'win32', packaged: true, portableFile: 'C:\\Games\\DFO-Online-win-x64-portable.exe', execPath: 'C:\\x\\a.exe', file: 'DFO-Online-win-x64-portable.exe', writable: yes });
  assert.deepEqual(portable, { kind: 'portable', target: 'C:\\Games\\DFO-Online-win-x64-portable.exe', staged: 'C:\\Games\\DFO-Online-win-x64-portable.exe.new' });
  assert.equal(swapPlan({ platform: 'win32', packaged: true, portableFile: 'C:\\Games\\p.exe', execPath: '', file: 'DFO-Online-win-x64-portable.exe', writable: no }).kind, null);
  assert.equal(swapPlan({ platform: 'win32', packaged: true, execPath: 'C:\\Program Files\\DFO\\DFO.exe', file: 'DFO-Online-win-x64-setup.exe', writable: yes }).kind, null, 'an installed copy installs');
  const exec = '/Applications/DFO Online.app/Contents/MacOS/DFO Online';
  assert.deepEqual(swapPlan({ platform: 'darwin', packaged: true, execPath: exec, file: 'DFO-Online-mac-arm64.dmg', writable: yes }),
    { kind: 'mac', bundle: '/Applications/DFO Online.app', staged: '/Applications/.DFO Online.app.new' });
  assert.equal(swapPlan({ platform: 'darwin', packaged: true, execPath: '/Volumes/DFO Online/DFO Online.app/Contents/MacOS/DFO Online', file: 'DFO-Online-mac-arm64.dmg', writable: yes }).kind, null, 'run from the disk image');
  assert.equal(swapPlan({ platform: 'darwin', packaged: true, execPath: '/private/var/folders/x/AppTranslocation/1/d/DFO Online.app/Contents/MacOS/DFO Online', file: 'DFO-Online-mac-arm64.dmg', writable: yes }).kind, null, 'translocated');
  assert.equal(swapPlan({ platform: 'darwin', packaged: true, execPath: exec, file: 'DFO-Online-mac-arm64.dmg', writable: no }).kind, null);
  assert.equal(swapPlan({ platform: 'darwin', packaged: false, execPath: exec, file: 'x.dmg', writable: yes }).kind, null);
  assert.equal(swapPlan({ platform: 'linux', packaged: true, execPath: '/opt/x', file: 'x.AppImage', writable: yes }).kind, null);
});

test('UPDATE-SWAP: the scripts wait for the app to end, keep the old copy until the new one is in place, and start it straight into the game', () => {
  const win = swapScript({ kind: 'portable', target: 'C:\\Games\\100%\\p.exe', staged: 'C:\\Games\\100%\\p.exe.new' }, { pid: 42, relaunch: true, args: ['--play'] });
  assert.match(win, /tasklist \/FI "PID eq 42"/);
  assert.match(win, /move \/y "C:\\Games\\100%%\\p\.exe\.new" "C:\\Games\\100%%\\p\.exe"/, 'a percent sign is doubled');
  assert.match(win, /if %tries% geq 60 goto done/, 'the move is tried for a minute');
  assert.match(win, /start "" "C:\\Games\\100%%\\p\.exe" "--play"/);
  assert.match(swapScript({ kind: 'portable', target: 'C:\\p.exe', staged: 'C:\\p.exe.new' }, { pid: 42, relaunch: false }), /rem no restart/);
  const mac = swapScript({ kind: 'mac', bundle: "/Applications/Player's DFO.app", staged: "/Applications/.Player's DFO.app.new" }, { pid: 7, relaunch: true, args: ['--play'] });
  assert.match(mac, /while kill -0 7 2>\/dev\/null; do sleep 1; done/);
  assert.ok(mac.includes(`if mv ${shq("/Applications/Player's DFO.app")} ${shq("/Applications/Player's DFO.app.old")}; then`));
  assert.ok(mac.includes(`else mv ${shq("/Applications/Player's DFO.app.old")} ${shq("/Applications/Player's DFO.app")}; fi`), 'put back if the move fails');
  assert.ok(mac.includes(`open -n ${shq("/Applications/Player's DFO.app")} --args '--play'`));
  assert.equal(shq("a'b"), `'a'\\''b'`);
  assert.equal(cmdq('a%b'), '"a%%b"');
  assert.throws(() => swapScript({ kind: 'mac', bundle: '/a.app', staged: '/b' }, { pid: 0, relaunch: false }));
});

test('UPDATE-SWAP: the wiring - a notice starts the swap, the game is told it can restart, and the script starts only once the quit is sure', () => {
  const main = readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8');
  const notice = main.slice(main.indexOf('async function noticeCheck()'), main.indexOf('/** AUDIT INSTALL L2-6'));
  assert.match(notice, /startSwap\(version, latest\);/);
  assert.match(main, /if \(swapping\(r\.version\)\) return;/, 'no download-it line while the copy updates itself');
  assert.match(main, /updateReady = \{ version, told: false, swap: plan \};\s*updateReady\.told = tellGame\(\{ version, manual: false \}\);/);
  assert.match(main, /if \(updateReady\?\.swap\) \{ restartingForUpdate = true; quitForSwap\(\); return; \}/, 'the update screen\'s end');
  assert.match(main, /app\.on\('will-quit', \(\) => \{\s*const plan = updateReady\?\.swap;/, 'at will-quit: a quit called off swaps nothing');
  assert.match(main, /if \(size !== check\.size\) throw/);
  assert.match(main, /if \(check\.sha256 && hash\.digest\('hex'\) !== check\.sha256\) throw/);
});
