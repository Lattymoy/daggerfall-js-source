// HARNESS-WIN: how tools/loadHarness.mjs and tools/accountProbe.mjs start wrangler and stop what they started, asked
// of tools/lib/wranglerLaunch.mjs for each platform on any runner. Off Windows the answers are the ones the two tools
// gave before the helper, unchanged; on Windows each is the replacement for a piece that does not exist there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wranglerCommand, devSpawnOptions, killTree } from '../../tools/lib/wranglerLaunch.mjs';

const ARGS = ['dev', '--local', '--port', '8872'];
const NODE_EXE = 'C:\\Program Files\\nodejs\\node.exe';
const SHIM_WINDOWS = 'E:\\repo\\server\\node_modules\\.bin\\wrangler';
const STDIO = ['ignore', 'pipe', 'pipe'];

/** A killTree whose primitives record their calls instead of killing anything. */
function recordedKill(pid, signal, platform, taskkillStatus = 0) {
  const kills = [];
  const spawns = [];
  const kill = (id, sig) => { kills.push([id, sig]); };
  const spawnSync = (file, args, options) => {
    spawns.push([file, args, options]);
    return { status: taskkillStatus, stderr: 'ERROR: The process "4242" not found.' };
  };
  const run = () => killTree(pid, signal, { platform, kill, spawnSync });
  return { kills, spawns, run };
}

for (const platform of ['linux', 'darwin']) {
  test(`HARNESS-WIN ${platform}: wrangler runs as named, or through npx, exactly as before the helper`, () => {
    assert.deepEqual(wranglerCommand(ARGS, { bin: '/repo/server/node_modules/.bin/wrangler', platform }),
      ['/repo/server/node_modules/.bin/wrangler', ARGS]);
    assert.deepEqual(wranglerCommand(ARGS, { bin: '', platform }), ['npx', ['--yes', 'wrangler@4', ...ARGS]]);
  });

  test(`HARNESS-WIN ${platform}: a dev server leads its own process group, and the group is killed`, () => {
    assert.deepEqual(devSpawnOptions({ cwd: '/repo/server', stdio: STDIO }, platform),
      { cwd: '/repo/server', stdio: STDIO, detached: true });
    const tree = recordedKill(4242, 'SIGKILL', platform);
    tree.run();
    assert.deepEqual(tree.kills, [[-4242, 'SIGKILL']]);
    assert.deepEqual(tree.spawns, []);
  });
}

test('HARNESS-WIN win32: npm\'s wrangler shim runs as the package\'s wrangler.js under this node', () => {
  const expected = [NODE_EXE, ['E:\\repo\\server\\node_modules\\wrangler\\bin\\wrangler.js', ...ARGS]];
  assert.deepEqual(wranglerCommand(ARGS, { bin: SHIM_WINDOWS, platform: 'win32', execPath: NODE_EXE }), expected);
  assert.deepEqual(wranglerCommand(ARGS, { bin: `${SHIM_WINDOWS}.cmd`, platform: 'win32', execPath: NODE_EXE }), expected,
    'the .cmd shim beside it, when WRANGLER_BIN names that');
  assert.deepEqual(wranglerCommand(ARGS, { bin: 'E:/repo/server/node_modules/.bin/wrangler', platform: 'win32', execPath: NODE_EXE }), expected,
    'a forward-slash path, as Git Bash writes one');
});

test('HARNESS-WIN win32: without a wrangler, npx runs as npm\'s npx-cli.js beside node.exe - npx.cmd cannot be spawned', () => {
  assert.deepEqual(wranglerCommand(ARGS, { bin: '', platform: 'win32', execPath: NODE_EXE }),
    [NODE_EXE, ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js', '--yes', 'wrangler@4', ...ARGS]]);
});

test('HARNESS-WIN win32: any other wrangler named runs as named', () => {
  assert.deepEqual(wranglerCommand(ARGS, { bin: 'C:\\tools\\wrangler.exe', platform: 'win32', execPath: NODE_EXE }),
    ['C:\\tools\\wrangler.exe', ARGS]);
});

test('HARNESS-WIN win32: a dev server stays attached and hidden, and its tree is killed by taskkill', () => {
  assert.deepEqual(devSpawnOptions({ cwd: 'E:\\repo\\server', stdio: STDIO }, 'win32'),
    { cwd: 'E:\\repo\\server', stdio: STDIO, detached: false, windowsHide: true });
  const tree = recordedKill(4242, 'SIGTERM', 'win32');
  tree.run();
  assert.deepEqual(tree.kills, [], 'no process group on Windows');
  assert.deepEqual(tree.spawns, [['taskkill', ['/PID', '4242', '/T', '/F'], { windowsHide: true }]]);
});

test('HARNESS-WIN win32: a tree already gone throws, as process.kill does off Windows - the callers\' catch reads it as gone', () => {
  const tree = recordedKill(4242, 'SIGKILL', 'win32', 128);
  assert.throws(tree.run, /taskkill 4242: ERROR: The process "4242" not found\./);
});
