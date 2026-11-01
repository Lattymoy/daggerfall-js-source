// UPDATE-SWAP (2026-10-30): THE COPIES THAT CANNOT INSTALL, UPDATED ANYWAY.
//
// electron-updater replaces only an installed Windows copy and an AppImage (lib/autoUpdate.cjs). The macOS app
// (unsigned: Squirrel.Mac refuses it) and the Windows portable exe (a bare file, no install) were told to download
// each release that changes the app itself by hand. Now the app downloads its own file from the release, checks it
// against the release's size and sha256, and swaps it in once it has quit: a small script waits for this process to
// end, puts the new copy where the old one was, and starts it. Where that cannot work - a Mac app run from the disk
// image or from macOS's translocated copy, a folder this user cannot write - the plan is null and the HUD line stays.
//
// Pure, no Electron: test/tooling/selfswap.test.js pins the plan and the scripts; app/main.cjs keeps the wiring.
'use strict';
const path = require('node:path');

/** The download a release's asset must match: its size, and its sha256 where GitHub lists one. */
function assetCheck(asset) {
  const size = Number.isSafeInteger(asset?.size) && asset.size > 0 ? asset.size : null;
  const m = typeof asset?.digest === 'string' ? asset.digest.match(/^sha256:([0-9a-f]{64})$/) : null;
  return size ? { size, sha256: m ? m[1] : null } : null;
}

/**
 * How this copy swaps itself, or null with why. `writable(dir)` answers whether this user may write `dir`.
 * @param {{ platform: string, packaged: boolean, portableFile?: string, execPath: string, file?: string|null,
 *   writable: (dir: string) => boolean }} env
 * @returns {{ kind: 'portable', target: string, staged: string } | { kind: 'mac', bundle: string, staged: string } | { kind: null, why: string }}
 */
function swapPlan({ platform, packaged, portableFile, execPath, file, writable }) {
  if (!packaged) return { kind: null, why: 'an unpackaged run' };
  if (platform === 'win32' && portableFile) {
    if (!/\.exe$/i.test(portableFile) || !/portable\.exe$/i.test(file ?? '')) return { kind: null, why: 'not the portable exe' };
    const dir = path.win32.dirname(portableFile);
    if (!writable(dir)) return { kind: null, why: `cannot write ${dir}` };
    return { kind: 'portable', target: portableFile, staged: `${portableFile}.new` };
  }
  if (platform === 'darwin') {
    if (!/\.dmg$/i.test(file ?? '')) return { kind: null, why: 'no disk image to take' };
    const bundle = path.posix.resolve(execPath, '../../..');
    if (!/\.app$/.test(bundle)) return { kind: null, why: 'not run from an app bundle' };
    if (bundle.startsWith('/Volumes/')) return { kind: null, why: 'run from the disk image' };
    if (bundle.includes('/AppTranslocation/')) return { kind: null, why: 'run from macOS\'s translocated copy' };
    const dir = path.posix.dirname(bundle);
    if (!writable(dir)) return { kind: null, why: `cannot write ${dir}` };
    return { kind: 'mac', bundle, staged: path.posix.join(dir, `.${path.posix.basename(bundle)}.new`) };
  }
  return { kind: null, why: 'this copy installs by itself' };
}

/** A path in a POSIX shell's single quotes. */
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
/** A path in a cmd batch file's double quotes: a quote cannot be in a Windows path, a percent sign is doubled. */
const cmdq = (s) => `"${String(s).replace(/%/g, '%%')}"`;

/**
 * The script that swaps the staged copy in once process `pid` has ended, and starts it with `args` when `relaunch`.
 * The old copy is kept until the new one is in place, and put back if the move fails.
 * @param {{ kind: 'portable'|'mac', target?: string, bundle?: string, staged: string }} plan
 * @param {{ pid: number, relaunch: boolean, args?: string[] }} opts
 */
function swapScript(plan, { pid, relaunch, args = [] }) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('a process id is a positive whole number');
  if (plan.kind === 'portable') {
    const exe = plan.target;
    const run = relaunch ? `start "" ${cmdq(exe)} ${args.map(cmdq).join(' ')}`.trimEnd() : 'rem no restart';
    // the portable launcher holds the exe until it has cleaned up after the app: the move is tried for a minute
    return [
      '@echo off',
      ':wait',
      // the one-second waits are ping's: timeout quits at once when the script has no console input to read
      `tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul && (ping -n 2 127.0.0.1 >nul & goto wait)`,
      'set tries=0',
      ':move',
      `move /y ${cmdq(plan.staged)} ${cmdq(exe)} >nul 2>&1 && goto done`,
      'set /a tries+=1',
      'if %tries% geq 60 goto done',
      'ping -n 2 127.0.0.1 >nul',
      'goto move',
      ':done',
      run,
      '(goto) 2>nul & del "%~f0"',
      '',
    ].join('\r\n');
  }
  const app = plan.bundle;
  const old = `${app}.old`;
  const run = relaunch ? `open -n ${shq(app)}${args.length ? ` --args ${args.map(shq).join(' ')}` : ''}` : ':';
  return [
    '#!/bin/sh',
    `while kill -0 ${pid} 2>/dev/null; do sleep 1; done`,
    `rm -rf ${shq(old)}`,
    `if mv ${shq(app)} ${shq(old)}; then`,
    `  if mv ${shq(plan.staged)} ${shq(app)}; then rm -rf ${shq(old)}; else mv ${shq(old)} ${shq(app)}; fi`,
    'fi',
    `xattr -dr com.apple.quarantine ${shq(app)} 2>/dev/null`,
    run,
    'rm -f "$0"',
    '',
  ].join('\n');
}

/**
 * The Windows script's starter, run by wscript. A detached cmd.exe gets no console, so every tool
 * its script ran (tasklist, find, timeout) opened a console window of its own; Run with window style 0 gives cmd one
 * hidden console that they all share. The starter deletes itself once cmd is going.
 * @param {string} script the .cmd file's path (a Windows path holds no double quote)
 */
function swapStarterVbs(script) {
  if (String(script).includes('"')) throw new Error('a Windows path holds no double quote');
  return [
    `CreateObject("WScript.Shell").Run "cmd.exe /d /c ""${script}""", 0, False`,
    'CreateObject("Scripting.FileSystemObject").DeleteFile WScript.ScriptFullName',
    '',
  ].join('\r\n');
}

module.exports = { assetCheck, swapPlan, swapScript, swapStarterVbs, shq, cmdq };
