// HARNESS-WIN (2026-10-25): HOW A TOOL STARTS WRANGLER AND STOPS WHAT IT STARTED, on Linux, macOS and Windows - the one
// place the platforms differ, for tools/loadHarness.mjs and tools/accountProbe.mjs.
//
// Off Windows (Linux, macOS) the tools run as they always have: the wrangler named, or `npx --yes wrangler@4`, spawned
// DETACHED so it leads its own process group, and stopped by killing that group (`kill(-pid)`) - npx -> wrangler ->
// workerd, and the grandchild holds the port.
//
// On Windows none of that exists, and each piece fails differently:
//   - `npx` is `npx.cmd`, and Node refuses to spawn a .cmd without a shell (EINVAL; ENOENT for the bare name). npm's
//     own npx-cli.js is run under this node instead - the layout the Node installer ships, npm beside node.exe.
//   - `node_modules/.bin/wrangler` is a sh script. The package's own bin/wrangler.js is run under this node instead.
//   - There are no process groups. The tree is killed by parent links (`taskkill /T /F`), so the child stays attached:
//     `detached` would also open a console window for every wrangler.
import { spawnSync as nodeSpawnSync } from 'node:child_process';
import { win32 } from 'node:path';

const NPX_WRANGLER = ['--yes', 'wrangler@4'];
/** npm's shim for an installed wrangler, as `npm ci` writes it (the .cmd beside it, for a WRANGLER_BIN set to that). */
const WRANGLER_SHIM = /node_modules[\\/]\.bin[\\/]wrangler(?:\.cmd)?$/i;

/** [file, args] that run wrangler with `args`: the wrangler at `bin` when one is named, `npx --yes wrangler@4` without. */
export function wranglerCommand(args, { bin = '', platform = process.platform, execPath = process.execPath } = {}) {
  if (platform !== 'win32') {
    return bin ? [bin, args] : ['npx', [...NPX_WRANGLER, ...args]];
  }
  if (!bin) {
    const npxCli = win32.join(win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
    return [execPath, [npxCli, ...NPX_WRANGLER, ...args]];
  }
  if (WRANGLER_SHIM.test(bin)) {
    const wranglerJs = win32.join(win32.dirname(win32.dirname(bin)), 'wrangler', 'bin', 'wrangler.js');
    return [execPath, [wranglerJs, ...args]];
  }
  return [bin, args];
}

/** `options` for spawning a long-lived wrangler (`wrangler dev`) that `killTree` can later stop whole. */
export function devSpawnOptions(options, platform = process.platform) {
  if (platform !== 'win32') return { ...options, detached: true };
  return { ...options, detached: false, windowsHide: true };
}

/** Kill the process tree a `devSpawnOptions` spawn started. Throws when there is nothing left to kill, as
 *  `process.kill` does; `signal` is the group's off Windows, where taskkill's /F is always a hard kill. */
export function killTree(pid, signal, { platform = process.platform, kill = (id, sig) => process.kill(id, sig), spawnSync = nodeSpawnSync } = {}) {
  if (platform !== 'win32') {
    kill(-pid, signal);
    return;
  }
  const taskkill = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  if (taskkill.status !== 0) throw new Error(`taskkill ${pid}: ${String(taskkill.stderr ?? taskkill.error)}`);
}
