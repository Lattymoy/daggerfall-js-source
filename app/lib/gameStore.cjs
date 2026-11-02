// DA13 (2026-10-14, Mac: "B only: per-file channel"): THE GAME'S FILES ON THIS COPY'S DISK - which version is played,
// and how a new one comes to be played without a byte of the old one moving until it has proved itself.
//
// The bundled copy inside the install is the SEED: app.asar's dist/, indexed at build time (app/game-seed.json). A
// version the channel brings lives under <userData>/Game/v<version>/ - its index.json (every file of that version:
// path, size, sha256, and whether this folder holds it or the seed does) and files/, ONLY the files that differ from
// the seed. So a release that changed forty files is forty files on disk, and the game is served from the two
// (app/main.cjs handleDagger): a path the index does not name is not served, whatever the seed holds - a file a
// version removed is gone with it.
//
// A NEW VERSION, STEP BY STEP (stage, activate, bootDone):
//   1. STAGED: its folder is written while it has no index.json - and a version folder without one is never read
//      (readIndex) and is swept. A file this copy holds already is copied (and hashed again on the way), the rest is
//      fetched from the pack, each checked against its sha256 before it is written (gameChannel.cjs decodeFile) and
//      flushed to disk. Any failure - a hash, a range, the network, the disk - deletes the folder and throws, and
//      nothing played has changed.
//   2. WHOLE: index.json is written under a temporary name and renamed into place - the version's one atomic step. Not
//      a rename of the folder: Windows refuses to rename a folder while another process holds a file in it, and the
//      antivirus opens every file just written (DA11) - a file's rename over its own temporary is what every save in
//      this shell already does (app/lib/fileStorage.cjs).
//   3. ON TRIAL: state.json - the same temporary-and-rename, so it is the old one or the new one, never half - names
//      it current, with the version it replaces kept as `previous`.
//   4. PROVED: the game's first boot on it that comes up (the page's own word: app/preload.cjs dagger:game-up) ends the
//      trial and deletes the previous version. A boot that never comes up - the app closed or crashed before it did -
//      is rolled back at the next launch (startup), one that fails while the app runs at once (rollback): the previous
//      version is current again, the bad one deleted and remembered (`failed`), and that release takes the installer's
//      path from then on.
//
// A NEW INSTALL starts over: a state.json from another seed (the installer brought a new one) is reset and every version
// folder deleted - the seed is now at least as new as anything the channel brought, or the player chose an older install
// by hand. Plain Node, no Electron: test/tooling/da13_gamechannel.test.js drives it over temp folders.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GAME_CHANNEL, GAME_ENTRY, GameChannelError, sha256, readSeed, planUpdate, planRanges, checkRangeAnswer, decodeFile, isSafeGamePath } = require('./gameChannel.cjs');
const { isNewerRelease } = require('./updateCheck.cjs');

/** How many failed versions are remembered. */
const FAILED_KEEP = 20;
/** Ranges fetched at once. */
const FETCH_CONCURRENCY = 4;

/** Is version a newer than version b. */
const newer = (a, b) => isNewerRelease(b, `app-v${a}`);

/** Written whole or not at all: a temporary name, flushed, then renamed over the old. */
function writeDurable(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.~${process.pid}`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}
const writeJson = (file, obj) => writeDurable(file, Buffer.from(JSON.stringify(obj)));

const freshState = (seedVersion) => ({ channel: GAME_CHANNEL, seed: seedVersion, current: null, previous: null, trial: false, tries: 0, ready: null, failed: [] });

/**
 * The game store over `root` (<userData>/Game), for an install whose bundled copy is `seed` (readSeed's) under `dist`.
 */
function openGameStore({ root, seed, dist }) {
  const seedFiles = new Map(seed.files.map((f) => [f.path, f.sha256]));
  const STATE = path.join(root, 'state.json');
  const versionDir = (v) => path.join(root, `v${v}`);
  const staging = new Set();   // the versions being written now - never swept from under the writer
  let state;
  let index = null;   // the current version's: { version, byPath: Map<path, { sha256, size, own }> }

  const save = () => writeJson(STATE, state);
  /** Every version folder but the ones named (and any being written) is deleted. */
  function sweep(keep) {
    let names = [];
    try { names = fs.readdirSync(root); } catch { return; }
    const kept = new Set([...keep, ...staging].filter(Boolean).map((v) => `v${v}`));
    for (const n of names) if (n.startsWith('v') && !kept.has(n)) fs.rmSync(path.join(root, n), { recursive: true, force: true });
  }

  /** A version's index, read and checked - every file of its own still on disk at its size, every other one the seed's
   *  at the same sha256 - or null (and a folder without one is a version never finished). */
  function readIndex(v) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(versionDir(v), 'index.json'), 'utf8'));
      if (j?.channel !== GAME_CHANNEL || j.version !== v || !Array.isArray(j.files)) return null;
      const byPath = new Map();
      for (const f of j.files) {
        if (!isSafeGamePath(f?.path) || typeof f.sha256 !== 'string' || !Number.isSafeInteger(f.size)) return null;
        if (f.own) {
          if (fs.statSync(path.join(versionDir(v), 'files', f.path)).size !== f.size) return null;
        } else if (seedFiles.get(f.path) !== f.sha256) return null;
        byPath.set(f.path, { sha256: f.sha256, size: f.size, own: !!f.own });
      }
      return byPath.has(GAME_ENTRY) ? { version: v, byPath } : null;
    } catch { return null; }
  }

  // open: a state.json from this seed, whose current version still reads - or a fresh start
  try {
    const s = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    state = { ...freshState(seed.version), ...s, failed: Array.isArray(s?.failed) ? s.failed.filter((v) => typeof v === 'string') : [] };
  } catch { state = null; }
  if (!state || state.channel !== GAME_CHANNEL || state.seed !== seed.version) {
    state = freshState(seed.version);
    save();
  } else if (state.current) {
    index = newer(state.current, seed.version) ? readIndex(state.current) : null;
    if (!index) {
      // the version in use no longer reads: the one before it, if it does - else the seed
      const back = state.previous && newer(state.previous, seed.version) ? readIndex(state.previous) : null;
      state = { ...state, current: back ? state.previous : null, previous: null, trial: false, tries: 0 };
      index = back;
      save();
    }
  }
  sweep([state.current, state.previous, state.ready]);

  const store = {
    root,
    seed,

    /** The version played: the channel's, or the install's own. */
    version: () => index?.version ?? seed.version,
    /** A version the channel brought is in use (else the seed is served from dist/ as it always was). */
    active: () => !!index,
    /** A version staged while the game ran, played from the next launch - or null. */
    ready: () => state.ready,
    hasFailed: (v) => state.failed.includes(v),
    failed: () => [...state.failed],
    state: () => ({ ...state, failed: [...state.failed] }),

    /** Where the file at `rel` of the version in use is on disk - its own folder, or the seed - or null: not this
     *  version's. Only an active version answers. */
    resolve(rel) {
      const e = index?.byPath.get(rel);
      if (!e) return null;
      return e.own ? path.join(versionDir(index.version), 'files', rel) : path.join(dist, rel);
    },

    /** What `manifest` asks of this copy (gameChannel.cjs planUpdate), against the seed and the version in use. */
    planFor(manifest) {
      const own = new Map();
      if (index) for (const [p, e] of index.byPath) if (e.own) own.set(p, e.sha256);
      return planUpdate(manifest, { seed: seedFiles, own });
    },

    /**
     * Steps 1 and 2: `manifest`'s version, staged and made whole in v<version>/ - or a throw, and nothing changed.
     * `fetchRange(start, end)` answers { status, contentRange, bytes } for bytes [start, end) of the pack.
     */
    async stage(manifest, { fetchRange, onProgress = () => {}, concurrency = FETCH_CONCURRENCY }) {
      const v = manifest.version;
      if (index?.version === v || staging.has(v)) throw new GameChannelError('state', `v${v} is in use here`);
      const plan = store.planFor(manifest);
      const dir = versionDir(v);
      const into = (rel) => path.join(dir, 'files', rel);
      const own = new Set();
      let stop = false;
      staging.add(v);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
        // what this copy holds already is copied, hashed again on the way - a file changed on disk is fetched instead
        const fetch = [...plan.fetch];
        for (const c of plan.carry) {
          const src = c.from.own ? path.join(versionDir(index.version), 'files', c.from.path) : path.join(dist, c.from.path);
          let bytes = null;
          try { bytes = fs.readFileSync(src); } catch { /* gone: fetched instead */ }
          if (!bytes || bytes.length !== c.size || sha256(bytes) !== c.sha256) { fetch.push(c); continue; }
          writeDurable(into(c.path), bytes);
          own.add(c.path);
        }
        const ranges = planRanges(fetch);
        const total = ranges.reduce((n, r) => n + r.end - r.start, 0);
        let transferred = 0, next = 0;
        onProgress({ transferred, total });
        const worker = async () => {
          while (!stop && next < ranges.length) {
            const r = ranges[next++];
            const answer = await fetchRange(r.start, r.end);
            if (stop) return;
            const bytes = checkRangeAnswer(answer, { start: r.start, end: r.end, size: manifest.pack.size });
            for (const e of r.entries) {
              writeDurable(into(e.path), decodeFile(e, bytes.subarray(e.offset - r.start, e.offset - r.start + e.length)));
              own.add(e.path);
            }
            transferred += r.end - r.start;
            onProgress({ transferred, total });
          }
        };
        const runs = await Promise.allSettled(Array.from({ length: Math.min(concurrency, ranges.length) },
          () => worker().catch((e) => { stop = true; throw e; })));
        const broke = runs.find((r) => r.status === 'rejected');
        if (broke) throw broke.reason;
        // an empty file has no bytes in the pack to fetch
        for (const e of fetch) if (e.length === 0 && !own.has(e.path)) { writeDurable(into(e.path), decodeFile(e, Buffer.alloc(0))); own.add(e.path); }
        // step 2: whole - the index, renamed into place, is the version's one atomic step
        writeJson(path.join(dir, 'index.json'), {
          channel: GAME_CHANNEL,
          version: v,
          files: manifest.files.map((e) => ({ path: e.path, size: e.size, sha256: e.sha256, own: own.has(e.path) })),
        });
        if (!readIndex(v)) throw new GameChannelError('state', `v${v} did not read back whole`);
        return { version: v, bytes: total, files: own.size };
      } catch (e) {
        stop = true;
        fs.rmSync(dir, { recursive: true, force: true });
        throw e;
      } finally {
        staging.delete(v);
      }
    },

    /** Step 3: a staged version is the one played, on trial. The version it replaces is kept until this one has booted -
     *  or, if the one in use was itself still on trial, the last that DID boot is kept, and the unproved one goes. */
    activate(v) {
      const next = readIndex(v);
      if (!next) throw new GameChannelError('state', `v${v} is not staged here`);
      const replaced = state.current;
      let previous = replaced;
      if (state.trial && replaced && replaced !== v) {
        fs.rmSync(versionDir(replaced), { recursive: true, force: true });
        previous = state.previous;
      }
      state = { ...state, current: v, previous, trial: true, tries: 0, ready: state.ready === v ? null : state.ready };
      index = next;
      save();
    },

    /** A staged version kept for the next launch - the game is running on the one in use. */
    markReady(v) {
      if (!readIndex(v)) throw new GameChannelError('state', `v${v} is not staged here`);
      const old = state.ready;
      state = { ...state, ready: v };
      save();
      if (old && old !== v && old !== state.current) fs.rmSync(versionDir(old), { recursive: true, force: true });
    },

    /** The channel failed on `v` (a download, a hash, a boot): it takes the installer's path from now on. */
    fail(v) {
      if (!v || state.failed.includes(v)) return;
      state = { ...state, failed: [...state.failed, v].slice(-FAILED_KEEP) };
      save();
    },

    /** At launch, before any window: a trial whose boot never came up is rolled back; a version readied while the game
     *  last ran becomes the one played. Says what it did. */
    startup() {
      const did = {};
      if (state.trial && state.tries >= 1) did.rolledBack = store.rollback();
      const r = state.ready;
      if (r) {
        if (newer(r, store.version()) && !state.failed.includes(r) && readIndex(r)) { store.activate(r); did.activated = r; } else {
          state = { ...state, ready: null };
          save();
          if (r !== state.current && r !== state.previous) fs.rmSync(versionDir(r), { recursive: true, force: true });
        }
      }
      return did;
    },

    /** The game's page starts loading. The first boot of a version on trial is counted - a launch that finds the count
     *  and no word that it came up rolls it back (startup). */
    bootStarting() {
      if (state.trial && state.tries === 0) { state = { ...state, tries: 1 }; save(); }
    },

    /** The game came up on the version in use (step 4): its trial is over, the one before it deleted, and every folder
     *  neither in use nor readied swept. True when that ended a trial. */
    bootDone() {
      if (!state.trial) return false;
      state = { ...state, trial: false, tries: 0, previous: null };
      save();
      sweep([state.current, state.ready]);
      return true;
    },

    /** The version on trial did not boot: the one before it is played again, and this one is deleted and remembered.
     *  Answers the version given up, or null when nothing was on trial. */
    rollback() {
      const bad = state.current;
      if (!bad || !state.trial) return null;
      const back = state.previous ? readIndex(state.previous) : null;
      state = {
        ...state, current: back ? state.previous : null, previous: null, trial: false, tries: 0,
        failed: [...state.failed.filter((v) => v !== bad), bad].slice(-FAILED_KEEP),
      };
      index = back;
      save();
      fs.rmSync(versionDir(bad), { recursive: true, force: true });
      return bad;
    },
  };
  return store;
}

/** The bundled copy's index (app/game-seed.json) for an install of `appVersion`, or null - none, unreadable, or written
 *  for another version (a seed never speaks for an install it was not built into). */
function loadSeed(file, appVersion) {
  try {
    const seed = readSeed(JSON.parse(fs.readFileSync(file, 'utf8')));
    return seed.version === appVersion ? seed : null;
  } catch { return null; }
}

module.exports = { openGameStore, loadSeed, FETCH_CONCURRENCY, FAILED_KEEP };
