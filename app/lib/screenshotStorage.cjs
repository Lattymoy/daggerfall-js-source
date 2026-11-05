// SCREENSHOT-STORE: THE FILE-BACKED SCREENSHOT STORE.
//
// In a browser, screenshots live in IndexedDB. In the desktop shell,
// screenshots are stored as REAL FILES on the player's disk in a dedicated
// Screenshots/ folder:
//   - Portable build: beside the portable executable (<PORTABLE_EXECUTABLE_DIR>/Screenshots)
//   - Installed build: beside Saves (<userData>/Screenshots)
//
// Any image (.png, .jpg, .jpeg, .webp) placed in this folder is automatically
// discovered and read by the game ("as many as are in the folder") and can appear
// on loading screens. Metadata (loading screen toggle, caption/place, timestamp)
// is tracked in a sidecar screenshots.json file inside the folder.
//
// Plain Node.js, no Electron imports - preload requires it, and node --test exercises it.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VALID_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const META_FILE = 'screenshots.json';
const SCREENSHOTS_DIR = 'Screenshots';

/** Determine where the screenshots folder should live based on platform & environment. */
function getScreenshotsDir(userDataRoot, env = process.env) {
  if (env.PORTABLE_EXECUTABLE_DIR) {
    const portableDir = path.join(env.PORTABLE_EXECUTABLE_DIR, SCREENSHOTS_DIR);
    try {
      fs.mkdirSync(portableDir, { recursive: true });
      fs.accessSync(portableDir, fs.constants.W_OK);
      return portableDir;
    } catch {
      // Fallback to userData if portable directory is not writable
    }
  }
  if (env.DAGGER_USER_DATA) {
    return path.join(env.DAGGER_USER_DATA, SCREENSHOTS_DIR);
  }
  return path.join(userDataRoot, SCREENSHOTS_DIR);
}

function createScreenshotStorage(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('[screenshotStorage] could not create dir:', dir, e?.message);
  }

  const metaPath = path.join(dir, META_FILE);

  function readMeta() {
    try {
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
      }
    } catch {}
    return {};
  }

  function writeMeta(meta) {
    try {
      const tmp = metaPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf8');
      fs.renameSync(tmp, metaPath);
    } catch (e) {
      console.warn('[screenshotStorage] writeMeta failed:', e?.message);
    }
  }

  function list() {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const meta = readMeta();
    const records = [];

    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (ent.name === META_FILE || ent.name.endsWith('.tmp')) continue;

      const ext = path.extname(ent.name).toLowerCase();
      if (!VALID_EXTS.has(ext)) continue;

      const filePath = path.join(dir, ent.name);
      let mtime = Date.now();
      try {
        mtime = fs.statSync(filePath).mtimeMs;
      } catch {}

      const m = meta[ent.name] || {};
      records.push({
        id: ent.name,
        name: ent.name,
        at: typeof m.at === 'number' && Number.isFinite(m.at) ? m.at : Math.round(mtime),
        place: typeof m.place === 'string' ? m.place : '',
        loading: m.loading !== false,
      });
    }

    records.sort((a, b) => b.at - a.at || b.name.localeCompare(a.name));
    return records;
  }

  function read(name) {
    if (!name || typeof name !== 'string') return null;
    const safeName = path.basename(name);
    const filePath = path.join(dir, safeName);
    try {
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    } catch {
      return null;
    }
  }

  function save({ name, buffer, place = '', at = Date.now(), loading = true } = {}) {
    if (!buffer) throw new Error('screenshot buffer required');
    let filename = name ? path.basename(name) : `dfo-${new Date(at).toISOString().replace(/[:.]/g, '-')}.png`;
    const ext = path.extname(filename) || '.png';
    const base = path.basename(filename, ext);
    let target = path.join(dir, filename);
    let counter = 1;
    while (fs.existsSync(target)) {
      filename = `${base}-${counter++}${ext}`;
      target = path.join(dir, filename);
    }

    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, target);

    const meta = readMeta();
    meta[filename] = { place: String(place || ''), at, loading: !!loading };
    writeMeta(meta);

    return {
      id: filename,
      name: filename,
      at,
      place: String(place || ''),
      loading: !!loading,
    };
  }

  function del(name) {
    if (!name || typeof name !== 'string') return false;
    const safeName = path.basename(name);
    const filePath = path.join(dir, safeName);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      return false;
    }
    const meta = readMeta();
    if (Object.hasOwn(meta, safeName)) {
      delete meta[safeName];
      writeMeta(meta);
    }
    return true;
  }

  function setLoading(name, on) {
    if (!name || typeof name !== 'string') return false;
    const safeName = path.basename(name);
    const meta = readMeta();
    meta[safeName] = { ...(meta[safeName] || {}), loading: !!on };
    writeMeta(meta);
    return true;
  }

  return {
    dir,
    list,
    read,
    save,
    del,
    setLoading,
  };
}

module.exports = {
  getScreenshotsDir,
  createScreenshotStorage,
  VALID_EXTS,
  META_FILE,
  SCREENSHOTS_DIR,
};

