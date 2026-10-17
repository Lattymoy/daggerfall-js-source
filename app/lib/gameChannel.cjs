// DA13 (2026-10-14, Mac: "B only: per-file channel"; the player's report, Discord 2026-10-13: "Every update
// downloads around 130 MB and overwrites the entire game folder"): THE GAME'S OWN UPDATE - ONLY THE FILES THAT
// CHANGED. The pure half: the release's manifest and what it may say, a file's own encoding in the pack, the plan of
// what one copy must fetch, the ranges it fetches it in, and which path a release takes.
//
// WHY. DA11 put the whole site into app.asar - one 195 MB file - and an installer compresses that one file in blocks at
// fixed offsets (Windows: 7z LZMA2, ~4 MB blocks; Linux: squashfs, 128 KB). Any file in it that changes size moves every
// byte after it, so every block after it compresses to new bytes, and electron-updater's blockmap - which can reuse only
// identical compressed bytes - fetched most of the archive again: 18-45 MB for one merge, ~130 MB whenever the archive's
// header changed length (measured off the published blockmaps; before DA11, 3-4.7 MB). And macOS and the portable exe
// had no updater at all: a full download per release.
//
// WHAT. Each release also carries the game as ONE PACK (GAME_FILES.pack): every file of the built site compressed ON ITS
// OWN and laid end to end, so a file that did not change is the same bytes in every pack - and a MANIFEST
// (GAME_FILES.manifest, gzipped JSON): each file's path, size and sha256, and where its bytes stand in the pack. A copy
// compares the manifest with what it already holds - the bundled copy inside its own install (the seed, app/game-seed.json,
// written at build time from the same files) and the files it fetched before - and fetches the rest with HTTP Range
// requests against the pack, one range a request (GitHub's release-asset host answers a single range 206 and several
// ranges 501 - read 2026-10-14 off app-v0.1.8548), every file checked against its sha256 before it is used. Vite's
// content-hashed assets keep their names and bytes while they do not change, so a merge is the files it changed: the
// per-file floor measured on real releases was 2.5-6.8 MB.
//
// WHEN THE INSTALLER STILL RUNS. The channel carries the GAME; the shell (app/) is the installer's. A manifest names
// the shell it was built for (`shell`: a digest of the shell's sources at the release's commit, scripts/desktopRelease.mjs
// shellId) and the channel generation it is written in (GAME_CHANNEL); a copy whose own shell or generation differs - or
// that met any failure on the channel - takes the installer's path (DA7's updater, or DA6's notice) exactly as before.
//
// TRUST is electron-updater's for latest.yml: the manifest comes over HTTPS from the same release as the installers, and
// nothing it names is used before its bytes hash to it. Pure, no Electron (node:crypto and node:zlib only): the store
// that applies it is app/lib/gameStore.cjs, the release side is scripts/desktopRelease.mjs, and test/tooling/da13_gamechannel.test.js
// drives both.
'use strict';

const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { parseVersion, parseReleaseTag } = require('./updateCheck.cjs');
const { releaseAssetUrl } = require('./downloads.cjs');

/** The channel's generation: the manifest's shape and the shell<->game contract. A shell meeting a manifest of another
 *  generation takes the installer's path - so it is the one field an old shell can always read. Raised only when a
 *  release must not be carried by the channel to the shells already out there. */
const GAME_CHANNEL = 1;

/** The game's two files on every release (the downloads are app/lib/downloads.cjs's). */
const GAME_FILES = Object.freeze({
  manifest: 'DFO-Online-game.json.gz',
  pack: 'DFO-Online-game.pack',
});

/** The entry a copy loads - a manifest without it is no game. */
const GAME_ENTRY = 'play/index.html';

/** How a file's bytes stand in the pack: brotli, or as they are where brotli would not make them smaller. */
const ENCODINGS = Object.freeze(['br', 'raw']);

/** Text compresses; brotli's best on it, and a quick pass on the rest (PNG, OGG, MP3 barely move - measured on the
 *  2026-10-14 build: 27 MB of text to 6.6 MB at 11, 7.4 at 5; the 160 MB of media at 5 in seconds). */
const TEXT_FILE_RE = /\.(?:js|mjs|cjs|json|html|css|svg|txt|xml|map|glsl)$/i;
const TEXT_QUALITY = 11;
const MEDIA_QUALITY = 5;

/** Two ranges closer than this are fetched as one - the bytes between cost less than another request. */
const RANGE_GAP = 64 * 1024;
/** ...and no one range is longer than this, so a request is never the whole pack. */
const RANGE_MAX = 4 * 1024 * 1024;

/** The most files a manifest may name, and the longest path. */
const MAX_FILES = 200000;
const MAX_PATH = 512;

const HEX64 = /^[0-9a-f]{64}$/;
/** A segment no file system the game runs on can hold as a plain file: Windows' devices, a trailing dot or space. */
const RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com\d|lpt\d)(?:\..*)?$/i;

/** A manifest, a seed or a range that cannot be used - `code` says which law it broke. */
class GameChannelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameChannelError';
    this.code = code;
  }
}
const fail = (code, message) => { throw new GameChannelError(code, message); };

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** A path the store may write and the protocol may serve: relative, '/'-separated, every segment a plain name - none
 *  empty, none ending in a dot or a space (which is '.' and '..' too, and a name Windows cannot hold), none a device. */
function isSafeGamePath(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > MAX_PATH) return false;
  if (p.startsWith('/') || /[\\\0:]/.test(p)) return false;
  return p.split('/').every((s) => s !== '' && !/[. ]$/.test(s) && !RESERVED_SEGMENT.test(s));
}

const isCount = (n) => Number.isSafeInteger(n) && n >= 0;

/** The files of a seed or a manifest, checked: safe paths, one each (case-insensitively - Windows and macOS hold
 *  "a.js" and "A.js" as one file), a size and a sha256 apiece, and the game's entry among them. */
function checkFiles(files, { pack } = {}) {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) fail('files', 'no file list');
  const seen = new Set();
  const out = [];
  for (const f of files) {
    if (!isSafeGamePath(f?.path)) fail('path', `an unsafe path: ${String(f?.path).slice(0, 80)}`);
    const key = f.path.toLowerCase();
    if (seen.has(key)) fail('path', `a path named twice: ${f.path}`);
    seen.add(key);
    if (!isCount(f.size) || typeof f.sha256 !== 'string' || !HEX64.test(f.sha256)) fail('file', `a file without its size and sha256: ${f.path}`);
    const e = { path: f.path, size: f.size, sha256: f.sha256 };
    if (pack) {
      if (!ENCODINGS.includes(f.encoding) || !isCount(f.offset) || !isCount(f.length)) fail('file', `a file without its place in the pack: ${f.path}`);
      if (f.offset + f.length > pack.size) fail('file', `a file past the pack's end: ${f.path}`);
      if (f.encoding === 'raw' && f.length !== f.size) fail('file', `a raw file of the wrong length: ${f.path}`);
      Object.assign(e, { offset: f.offset, length: f.length, encoding: f.encoding });
    }
    out.push(e);
  }
  if (!seen.has(GAME_ENTRY)) fail('files', `no ${GAME_ENTRY}`);
  return out;
}

/** The generation, the version and the shell every seed and manifest carry. */
function checkHead(m, version) {
  if (!m || typeof m !== 'object') fail('shape', 'not a manifest');
  if (m.channel !== GAME_CHANNEL) fail('channel', `channel ${m.channel} - this shell reads ${GAME_CHANNEL}`);
  if (!parseVersion(m.version)) fail('version', `no version: ${m.version}`);
  if (version != null && m.version !== version) fail('version', `it is v${m.version}, the release v${version}`);
  if (typeof m.shell !== 'string' || !HEX64.test(m.shell)) fail('shell', 'no shell');
}

/**
 * A release's manifest, held to every law above - or a GameChannelError. `version` is the release's own (its tag less
 * `app-v`): a manifest that names another is not this release's.
 * @returns {{ channel: number, version: string, update: string|null, shell: string, pack: { file: string, size: number },
 *   files: Array<{ path: string, size: number, sha256: string, offset: number, length: number, encoding: string }> }}
 */
function readManifest(m, { version = null } = {}) {
  checkHead(m, version);
  if (m.pack?.file !== GAME_FILES.pack || !isCount(m.pack?.size)) fail('pack', 'no pack');
  const pack = { file: m.pack.file, size: m.pack.size };
  return {
    channel: m.channel,
    version: m.version,
    update: typeof m.update === 'string' && /^\d+\.\d+\.\d+$/.test(m.update) ? m.update : null,
    shell: m.shell,
    pack,
    files: checkFiles(m.files, { pack }),
  };
}

/** The bundled copy's own index (app/game-seed.json): the files the install carries, its version and its shell. */
function readSeed(s) {
  checkHead(s, null);
  return { channel: s.channel, version: s.version, shell: s.shell, files: checkFiles(s.files) };
}

/** The gzipped manifest as the release carries it, read. */
function parseManifestFile(bytes, opts) {
  let json;
  try { json = JSON.parse(zlib.gunzipSync(bytes).toString('utf8')); } catch { fail('shape', 'the manifest does not read'); }
  return readManifest(json, opts);
}

/** One file's bytes as the pack holds them: brotli, at the quality its kind earns, or raw where that is no smaller. */
function encodeFile(filePath, bytes) {
  const quality = TEXT_FILE_RE.test(filePath) ? TEXT_QUALITY : MEDIA_QUALITY;
  const br = zlib.brotliCompressSync(bytes, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: quality, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bytes.length },
  });
  return br.length < bytes.length ? { encoding: 'br', data: br } : { encoding: 'raw', data: Buffer.from(bytes) };
}

/** A file's bytes out of the pack, decoded and CHECKED - its size and its sha256 are the manifest's, or it is refused. */
function decodeFile(entry, data) {
  let bytes;
  if (data.length !== entry.length) fail('hash', `${entry.path}: ${data.length} bytes where the pack holds ${entry.length}`);
  try { bytes = entry.encoding === 'br' ? zlib.brotliDecompressSync(data) : Buffer.from(data); } catch { fail('hash', `${entry.path} does not decode`); }
  if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) fail('hash', `${entry.path} is not the file the manifest names`);
  return bytes;
}

/**
 * What this copy must do to hold `manifest`: per file, `seed` (the bundled copy has it at that path, unchanged - served
 * from the install), `carry` (it is on disk already, at `from`: a file this copy fetched before, or the bundled copy's
 * under another path - copied, never fetched) or `fetch` (from the pack). A path the manifest does not name is in no
 * list: the new version does not have it, and the store removes it with the version that did.
 *
 * @param {ReturnType<typeof readManifest>} manifest
 * @param {{ seed: Map<string, string>, own?: Map<string, string> }} have
 *   seed: path -> sha256 of the bundled copy; own: path -> sha256 of the files the active version fetched
 */
function planUpdate(manifest, { seed, own = new Map() }) {
  const ownBySha = new Map(), seedBySha = new Map();
  for (const [p, h] of own) if (!ownBySha.has(h)) ownBySha.set(h, p);
  for (const [p, h] of seed) if (!seedBySha.has(h)) seedBySha.set(h, p);
  const plan = { seed: [], carry: [], fetch: [], bytes: 0 };
  for (const e of manifest.files) {
    if (seed.get(e.path) === e.sha256) plan.seed.push(e);
    else if (ownBySha.has(e.sha256)) plan.carry.push({ ...e, from: { own: true, path: ownBySha.get(e.sha256) } });
    else if (seedBySha.has(e.sha256)) plan.carry.push({ ...e, from: { own: false, path: seedBySha.get(e.sha256) } });
    else { plan.fetch.push(e); plan.bytes += e.length; }
  }
  return plan;
}

/** The ranges of the pack that hold `entries`: in pack order, neighbours closer than `gap` joined, none longer than
 *  `max` (a file longer than `max` is a range of its own). [{ start, end, entries }], `end` exclusive. */
function planRanges(entries, { gap = RANGE_GAP, max = RANGE_MAX } = {}) {
  const sorted = [...entries].filter((e) => e.length > 0).sort((a, b) => a.offset - b.offset);
  const ranges = [];
  let cur = null;
  for (const e of sorted) {
    const end = e.offset + e.length;
    if (cur && e.offset - cur.end <= gap && end - cur.start <= max) {
      cur.end = Math.max(cur.end, end);
      cur.entries.push(e);
    } else {
      cur = { start: e.offset, end, entries: [e] };
      ranges.push(cur);
    }
  }
  return ranges;
}

/** A Range answer, held to the range asked: 206, its Content-Range exactly `start`-`end - 1` of a pack of `size`, and
 *  that many bytes. A 200 (the whole pack), a 416 or another range is refused - never sliced as if it were the one. */
function checkRangeAnswer({ status, contentRange, bytes }, { start, end, size }) {
  if (status !== 206) fail('range', `the pack answered ${status} to a range`);
  if (contentRange !== `bytes ${start}-${end - 1}/${size}`) fail('range', `the pack answered ${contentRange} for bytes ${start}-${end - 1}/${size}`);
  if (bytes.length !== end - start) fail('range', `${bytes.length} bytes for a range of ${end - start}`);
  return bytes;
}

/**
 * Which path a newer release takes on this copy: 'game' (the channel carries it) or 'installer' (DA7's updater, or
 * DA6's notice), and why. The installer's when this copy has no seed (an unpackaged run, a build cut without a release),
 * when the release's game was built for another shell or written in another generation, or when the channel already
 * failed on that version here.
 */
function routeFor({ seed, manifest, failed = [] }) {
  if (!seed) return { route: 'installer', why: 'this copy carries no game index' };
  if (manifest.channel !== GAME_CHANNEL) return { route: 'installer', why: `channel ${manifest.channel}` };
  if (manifest.shell !== seed.shell) return { route: 'installer', why: 'the release changes the app itself' };
  if (failed.includes(manifest.version)) return { route: 'installer', why: `the channel failed on v${manifest.version} here` };
  return { route: 'game', why: '' };
}

/**
 * The update a player on `prev` takes to `next`, as a copy plans it: the files whose content `prev` did not hold, and
 * their bytes in the pack - against the whole pack. What the release's publish step measures (desktopRelease.mjs delta).
 */
function deltaOf(prev, next) {
  const had = new Set(prev.files.map((f) => f.sha256));
  let bytes = 0, files = 0;
  for (const f of next.files) if (!had.has(f.sha256)) { files++; bytes += f.length; }
  return { files, bytes, total: next.pack.size, share: next.pack.size ? bytes / next.pack.size : 0 };
}

/** The release's game - its manifest's and pack's links as the release itself lists them (GitHub's own download links
 *  for this repository only, downloads.cjs releaseAssetUrl) and the pack's size - or null where it carries no game. */
function gameAssetsOf(release) {
  const manifest = releaseAssetUrl(release, GAME_FILES.manifest);
  const pack = releaseAssetUrl(release, GAME_FILES.pack);
  const packSize = (Array.isArray(release?.assets) ? release.assets : []).find((a) => a?.name === GAME_FILES.pack)?.size;
  return manifest && pack && isCount(packSize) ? { manifest, pack, packSize } : null;
}

/** The version a release tag names ('app-v0.1.9' -> '0.1.9'), or null. */
const versionOfTag = (tag) => (parseReleaseTag(tag) ? String(tag).trim().replace(/^app-v/, '') : null);

module.exports = {
  GAME_CHANNEL, GAME_FILES, GAME_ENTRY, ENCODINGS, TEXT_FILE_RE, TEXT_QUALITY, MEDIA_QUALITY, RANGE_GAP, RANGE_MAX,
  GameChannelError, sha256, isSafeGamePath, readManifest, readSeed, parseManifestFile, encodeFile, decodeFile,
  planUpdate, planRanges, checkRangeAnswer, routeFor, deltaOf, gameAssetsOf, versionOfTag,
};
