// SHADER-EASE CACHE-TURN (2026-10-29, the owner: the game locks up on load after each update, and clearing GPUCache,
// GrShaderCache and ShaderCache cures it): each update changes the GLSL, so the cache GPU-CACHE sized to 128 MiB fills
// with programs no page will link again - and Chromium reads every kept one into the GPU process at start. So when
// the version played is not the one the cache was last turned for, the shell deletes the caches before Chromium opens
// them (before ready, app/main.cjs) and records the version. Nothing here may stop a launch: a failure is logged, the
// record left as it was so the next launch tries again, and the game starts on whatever is still there.
'use strict';

const nodeFs = require('node:fs');
const path = require('node:path');

/** The caches under userData (Electron's session data), as Electron 42's Chromium 148 names them: a partition's
 *  GPUCache, DawnWebGPUCache, DawnGraphiteCache (gpu_disk_cache_type.cc GetGpuDiskCacheSubdir); the reserved caches
 *  newer Electron opens (electron_browser_client.cc, GpuCacheDirectory); and DawnCache, the older partition name. */
const CACHE_DIRS = Object.freeze([
  'GPUCache', 'DawnWebGPUCache', 'DawnGraphiteCache',
  'ShaderCache', 'GrShaderCache', 'GraphiteDawnCache', 'GPUPersistentCache',
  'DawnCache',
]);
const RECORD_NAME = 'gpu-cache-turn.json';

/** The version the cache was last turned for, or null: none recorded, or a record that does not read. */
function recordedVersion(userData, fs = nodeFs) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(userData, RECORD_NAME), 'utf8'))?.version;
    return typeof v === 'string' ? v : null;
  } catch { return null; }
}

/**
 * Turn the GPU caches over for `version`, when it is not the recorded one. Never throws.
 * @param {{ userData: string, version: string, fs?: typeof nodeFs, log?: (...a: any[]) => void }} opts
 * @returns {{ turned: boolean, from: string | null, failed: string[] }}
 */
function turnGpuCache({ userData, version, fs = nodeFs, log = console.warn }) {
  const from = recordedVersion(userData, fs);
  if (from === version) return { turned: false, from, failed: [] };
  const failed = [];
  for (const name of CACHE_DIRS) {
    try { fs.rmSync(path.join(userData, name), { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); } catch (err) {
      failed.push(name);
      log(`[gpu] ${name} could not be cleared - the game starts with it:`, err?.message ?? err);
    }
  }
  if (failed.length) return { turned: false, from, failed };
  try {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, RECORD_NAME), JSON.stringify({ version }));
  } catch (err) { log('[gpu] the cache turn could not be recorded:', err?.message ?? err); }
  return { turned: true, from, failed };
}

module.exports = { CACHE_DIRS, RECORD_NAME, recordedVersion, turnGpuCache };
