// DA13 (2026-10-14, Mac: "B only: per-file channel"; a player, Discord 2026-10-13: "Every update downloads around
// 130 MB and overwrites the entire game folder. I believe only the files that have actually changed should be
// updated"): THE GAME'S OWN UPDATE - ONLY THE FILES THAT CHANGED.
//
// Measured off the published blockmaps before this: an update electron-updater fetched was 18-45 MB for one merge and
// ~130 MB whenever the site's one archive (DA11) changed its header's length - every block of the archive after a file
// that changed size compressed to new bytes. Each release now carries the game as a pack of files compressed ONE BY
// ONE plus a manifest (app/lib/gameChannel.cjs), every installer the index of the copy it bundles (the seed), and a copy
// fetches only the files it lacks, by HTTP Range, each checked against its sha256, into a version of its own that is
// played from the game's next load and proved by its first boot (app/lib/gameStore.cjs). The installer runs for a
// release that changes the shell, and for anything the channel could not bring.
//
// Fixtures are built by the release's own producer (scripts/desktopRelease.mjs packGame and gameSeed) and applied by
// the real store over temp folders; the shell's wiring and the workflow are pinned by source (they run in Electron and
// on GitHub).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  EXPECTED_RELEASE_FILES, packGame, gameSeed, gameFilesOf, shellInputs, shellId, judgeDelta, MAX_UPDATE_SHARE,
} from '../../scripts/desktopRelease.mjs';

const require = createRequire(import.meta.url);
const G = require('../../app/lib/gameChannel.cjs');
const { openGameStore, loadSeed } = require('../../app/lib/gameStore.cjs');
const L = require('../../app/lib/launcherState.cjs');
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const main = rd('app/main.cjs');

const SHELL = 'a'.repeat(64);
const OTHER_SHELL = 'b'.repeat(64);

/** Bytes no compressor shrinks, the same every run: a PNG's or an OGG's, as far as brotli is concerned. */
const noise = (seed, n) => {
  const out = Buffer.alloc(n);
  let h = Buffer.from(String(seed));
  for (let i = 0; i < n; i += 32) { h = createHash('sha256').update(h).digest(); h.copy(out, i); }
  return out;
};
const text = (seed, n) => Buffer.from(Array.from({ length: n }, (_, i) => `const v${seed}_${i % 97} = ${i};\n`).join('').slice(0, n));

/** A built site, as dist/ is: path -> bytes. */
const V1 = {
  'play/index.html': Buffer.from('<!doctype html><script type="module" src="../assets/main-AAAA.js"></script>'),
  'assets/main-AAAA.js': text('main1', 40000),
  'assets/vendor-CCCC.js': text('vendor', 90000),
  'art/a.png': noise('a', 70000),
  'art/b.png': noise('b', 30000),
  'data/c.bin': noise('c1', 20000),
  'empty.txt': Buffer.alloc(0),
};
/** The next release: main renamed by its new hash, c changed in place, b removed, a new chunk, a's bytes again under a
 *  second name, the rest untouched. */
const V2 = {
  'play/index.html': Buffer.from('<!doctype html><script type="module" src="../assets/main-BBBB.js"></script>'),
  'assets/main-BBBB.js': text('main2', 41000),
  'assets/vendor-CCCC.js': V1['assets/vendor-CCCC.js'],
  'assets/new-DDDD.js': text('new', 5000),
  'art/a.png': V1['art/a.png'],
  'art/a-copy.png': V1['art/a.png'],
  'data/c.bin': noise('c2', 20000),
  'empty.txt': Buffer.alloc(0),
};

function writeSite(dir, files) {
  for (const [p, b] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), b);
  }
  return dir;
}

/** A release: its dist, its pack and manifest (the producer's), its seed. */
function release(root, name, files, { version, shell = SHELL } = {}) {
  const dist = writeSite(join(root, name, 'dist'), files);
  const out = join(root, name, 'release');
  const manifest = packGame(dist, out, { version, update: null, shell });
  const pack = readFileSync(join(out, G.GAME_FILES.pack));
  const seed = gameSeed(dist, { version, shell });
  return { dist, out, manifest, pack, seed, manifestFile: readFileSync(join(out, G.GAME_FILES.manifest)) };
}

/** The pack as GitHub's release-asset host answers it: one range a request, 206 with its Content-Range. */
function host(pack, { corrupt = null, status = 206 } = {}) {
  const asked = [];
  const fetchRange = async (start, end) => {
    asked.push([start, end]);
    let bytes = Buffer.from(pack.subarray(start, end));
    if (corrupt != null && corrupt >= start && corrupt < end) bytes[corrupt - start] ^= 0xff;
    if (status !== 206) return { status, contentRange: null, bytes: Buffer.from(pack) };
    return { status: 206, contentRange: `bytes ${start}-${end - 1}/${pack.length}`, bytes };
  };
  return { fetchRange, asked };
}

const tmp = () => mkdtempSync(join(tmpdir(), 'da13-'));
const listAll = (dir) => (existsSync(dir) ? gameFilesOf(dir) : []);

test('DA13: the release packs the game a file at a time - each file compressed ON ITS OWN, so a file that did not change is the same bytes in every pack', () => {
  const root = tmp();
  try {
    const a = release(root, 'r1', V1, { version: '0.1.10' });
    const b = release(root, 'r2', V2, { version: '0.1.11' });
    // the manifest every copy reads, read back by the copy's own law
    const m = G.parseManifestFile(b.manifestFile, { version: '0.1.11' });
    assert.deepEqual(m, b.manifest);
    assert.equal(m.channel, G.GAME_CHANNEL);
    assert.equal(m.shell, SHELL);
    assert.equal(m.pack.size, b.pack.length, 'the pack is every file end to end, nothing else');
    assert.deepEqual(m.files.map((f) => f.path), Object.keys(V2).sort(), 'every file of the site, in path order');
    let at = 0;
    for (const f of m.files) {
      assert.equal(f.offset, at, `${f.path} follows the one before it`);
      at += f.length;
      // each decodes from its own bytes alone, to the file, checked
      assert.deepEqual(G.decodeFile(f, b.pack.subarray(f.offset, f.offset + f.length)), V2[f.path], f.path);
    }
    // THE LAW THE FIX STANDS ON: an unchanged file's bytes in the pack do not move with its neighbours - the installer's
    // one archive failed exactly this, and every update re-downloaded what followed the first change
    const slice = (r, p) => { const f = r.manifest.files.find((x) => x.path === p); return r.pack.subarray(f.offset, f.offset + f.length); };
    for (const p of ['assets/vendor-CCCC.js', 'art/a.png', 'empty.txt']) assert.deepEqual(slice(b, p), slice(a, p), `${p}: the same bytes in both packs`);
    // text is brotli'd at its best; bytes brotli cannot shrink ride raw (the PNG's and the OGG's)
    const enc = Object.fromEntries(m.files.map((f) => [f.path, f.encoding]));
    assert.equal(enc['assets/vendor-CCCC.js'], 'br');
    assert.ok(m.files.find((f) => f.path === 'assets/vendor-CCCC.js').length < V2['assets/vendor-CCCC.js'].length / 5);
    assert.equal(enc['art/a.png'], 'raw', 'noise is stored as it is - never made bigger');
    assert.equal(G.encodeFile('x.png', noise('z', 4000)).data.length, 4000);
    assert.equal(G.TEXT_QUALITY, 11);
    assert.ok(G.TEXT_FILE_RE.test('assets/x.js') && G.TEXT_FILE_RE.test('a.json') && !G.TEXT_FILE_RE.test('a.png'));
    // the seed is the same files, the same hashes - what a copy compares the manifest with
    assert.deepEqual(b.seed.files, m.files.map(({ path, size, sha256 }) => ({ path, size, sha256 })));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: the manifest is held to its laws - a path that leaves the store, a path twice, another generation, another release, a file past the pack', () => {
  for (const ok of ['play/index.html', 'assets/a-B_c.js', 'art/diverse-weapons/x.png']) assert.equal(G.isSafeGamePath(ok), true, ok);
  for (const bad of ['', '/etc/x', '../x', 'a/../b', 'a/./b', 'a//b', 'a\\b', 'C:x', 'a/con.js', 'NUL', 'a/b.', 'a/b ', 'x\0y', 'a'.repeat(600)]) {
    assert.equal(G.isSafeGamePath(bad), false, JSON.stringify(bad.slice(0, 20)));
  }
  const root = tmp();
  try {
    const { manifest } = release(root, 'r', V1, { version: '0.1.10' });
    const raw = JSON.parse(JSON.stringify(manifest));
    const code = (m, opts) => { try { G.readManifest(m, opts); return null; } catch (e) { assert.ok(e instanceof G.GameChannelError); return e.code; } };
    assert.equal(code(raw, { version: '0.1.10' }), null, 'the producer\'s own passes');
    assert.equal(code({ ...raw, channel: G.GAME_CHANNEL + 1 }), 'channel', 'another generation is never read');
    assert.equal(code(raw, { version: '0.1.11' }), 'version', 'a manifest naming another release is not this one\'s');
    assert.equal(code({ ...raw, shell: 'x' }), 'shell');
    assert.equal(code({ ...raw, pack: { ...raw.pack, file: 'other.pack' } }), 'pack');
    const withFile = (i, over) => ({ ...raw, files: raw.files.map((f, j) => (j === i ? { ...f, ...over } : f)) });
    assert.equal(code(withFile(0, { path: '../../outside.js' })), 'path', 'never a write outside the store');
    assert.equal(code(withFile(1, { path: raw.files[0].path.toUpperCase() })), 'path', 'one file, named twice in another case, is one file on Windows and macOS');
    const br = raw.files.findIndex((f) => f.encoding === 'br');
    assert.equal(code(withFile(br, { offset: raw.pack.size - 1 })), 'file', 'past the pack\'s end');
    const r = raw.files.findIndex((f) => f.encoding === 'raw');
    assert.equal(code(withFile(r, { length: raw.files[r].length - 1 })), 'file', 'a raw file is its own size');
    assert.equal(code(withFile(0, { sha256: 'nothex' })), 'file');
    assert.equal(code({ ...raw, files: raw.files.filter((f) => f.path !== G.GAME_ENTRY) }), 'files', 'no game without its entry');
    assert.throws(() => G.parseManifestFile(Buffer.from('not gzip')), { code: 'shape' });
    assert.deepEqual(G.parseManifestFile(gzipSync(Buffer.from(JSON.stringify(raw)))), manifest);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: a copy plans only what changed - the seed\'s unchanged files stay, what it holds anywhere is copied, the rest fetched, and a removed file is in no list', () => {
  const root = tmp();
  try {
    const r1 = release(root, 'r1', V1, { version: '0.1.10' });
    const r2 = release(root, 'r2', V2, { version: '0.1.11' });
    const seed = new Map(r1.seed.files.map((f) => [f.path, f.sha256]));
    const plan = G.planUpdate(r2.manifest, { seed });
    assert.deepEqual(plan.seed.map((e) => e.path), ['art/a.png', 'assets/vendor-CCCC.js', 'empty.txt'], 'unchanged at the same path: served from the install');
    assert.deepEqual(plan.carry.map((e) => [e.path, e.from]), [['art/a-copy.png', { own: false, path: 'art/a.png' }]], 'the same bytes under a new name: copied, never fetched');
    assert.deepEqual(plan.fetch.map((e) => e.path), ['assets/main-BBBB.js', 'assets/new-DDDD.js', 'data/c.bin', 'play/index.html'],
      'what changed and what is new - nothing else');
    assert.equal(plan.bytes, plan.fetch.reduce((n, e) => n + e.length, 0));
    const listed = [...plan.seed, ...plan.carry, ...plan.fetch].map((e) => e.path);
    assert.ok(!listed.includes('art/b.png') && !listed.includes('assets/main-AAAA.js'), 'a file the release removed is in no list');
    // what the version in use fetched before is copied too - by content, at whatever path
    const own = new Map([['data/c.bin', r2.manifest.files.find((f) => f.path === 'data/c.bin').sha256]]);
    assert.deepEqual(G.planUpdate(r2.manifest, { seed, own }).carry.map((e) => [e.path, e.from.own]), [['art/a-copy.png', false], ['data/c.bin', true]]);
    // the release's publish step measures the same thing: the content a player of the release before lacks
    assert.deepEqual(G.deltaOf(r1.manifest, r2.manifest), {
      files: 4, bytes: plan.bytes, total: r2.pack.length, share: plan.bytes / r2.pack.length,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: the ranges - in pack order, neighbours within RANGE_GAP joined, none past RANGE_MAX, an empty file none', () => {
  const e = (path, offset, length) => ({ path, offset, length });
  const ranges = G.planRanges([e('c', 500, 100), e('a', 0, 100), e('b', 601 + G.RANGE_GAP, 50), e('d', 10 * G.RANGE_MAX, 2 * G.RANGE_MAX), e('z', 70, 0)], {});
  assert.deepEqual(ranges.map((r) => [r.start, r.end, r.entries.map((x) => x.path)]), [
    [0, 600, ['a', 'c']],
    [601 + G.RANGE_GAP, 651 + G.RANGE_GAP, ['b']],
    [10 * G.RANGE_MAX, 12 * G.RANGE_MAX, ['d']],
  ], 'a gap past RANGE_GAP is a request of its own; a file longer than RANGE_MAX is one range');
  assert.equal(G.planRanges([e('a', 0, G.RANGE_MAX), e('b', G.RANGE_MAX, 1)]).length, 2, 'never a range past RANGE_MAX');
  assert.equal(G.planRanges([e('a', 0, 10), e('b', 10 + G.RANGE_GAP, 10)]).length, 1, 'RANGE_GAP itself is close enough');
});

test('DA13: a range answer is the range asked or nothing - a 200 (the whole pack), another range, a body short or long are refused', () => {
  const want = { start: 100, end: 200, size: 1000 };
  const ok = Buffer.alloc(100, 7);
  assert.equal(G.checkRangeAnswer({ status: 206, contentRange: 'bytes 100-199/1000', bytes: ok }, want), ok);
  for (const [why, answer] of [
    ['a 200 is the whole pack', { status: 200, contentRange: null, bytes: Buffer.alloc(1000) }],
    ['a 200 is no range, whatever its headers say', { status: 200, contentRange: 'bytes 100-199/1000', bytes: ok }],
    ['a 416', { status: 416, contentRange: 'bytes */1000', bytes: Buffer.alloc(0) }],
    ['another range', { status: 206, contentRange: 'bytes 0-99/1000', bytes: ok }],
    ['another pack', { status: 206, contentRange: 'bytes 100-199/999', bytes: ok }],
    ['short', { status: 206, contentRange: 'bytes 100-199/1000', bytes: Buffer.alloc(99) }],
    ['long', { status: 206, contentRange: 'bytes 100-199/1000', bytes: Buffer.alloc(101) }],
  ]) assert.throws(() => G.checkRangeAnswer(answer, want), { code: 'range' }, why);
});

test('DA13: a version staged from ranges of the real pack is the release byte for byte - served from its own folder where it differs, from the install where it does not, and a removed file not at all', async () => {
  const root = tmp();
  try {
    const r1 = release(root, 'r1', V1, { version: '0.1.10' });
    const r2 = release(root, 'r2', V2, { version: '0.1.11' });
    const store = openGameStore({ root: join(root, 'Game'), seed: r1.seed, dist: r1.dist });
    assert.equal(store.version(), '0.1.10', 'the install\'s own copy, before anything');
    assert.equal(store.active(), false);
    const h = host(r2.pack);
    const seen = [];
    const got = await store.stage(r2.manifest, { fetchRange: h.fetchRange, onProgress: (p) => seen.push(p) });
    assert.equal(got.version, '0.1.11');
    const fetchPlan = store.planFor(r2.manifest).fetch;
    assert.deepEqual(h.asked, G.planRanges(fetchPlan).map((r) => [r.start, r.end]), 'the ranges the plan names, and no others');
    assert.ok(h.asked.every(([s, e]) => e - s <= G.RANGE_MAX));
    assert.equal(seen.at(-1).transferred, seen.at(-1).total);
    assert.ok(seen.at(-1).total < r2.pack.length / 2, 'a fraction of the pack');
    assert.equal(store.version(), '0.1.10', 'staged is not played - nothing moved yet');
    store.activate('0.1.11');
    assert.equal(store.version(), '0.1.11');
    assert.equal(store.active(), true);
    for (const [p, bytes] of Object.entries(V2)) assert.deepEqual(readFileSync(store.resolve(p)), bytes, `${p} is the release's`);
    assert.equal(store.resolve('art/b.png'), null, 'removed by the release: not served, though the install still holds it');
    assert.equal(store.resolve('assets/main-AAAA.js'), null);
    assert.equal(store.resolve('art/a.png'), join(r1.dist, 'art/a.png'), 'unchanged: the install\'s own file');
    assert.equal(store.resolve('../state.json'), null);
    // the version's own folder holds what differs from the install - and nothing else
    const ownDir = join(root, 'Game', 'v0.1.11', 'files');
    assert.deepEqual(listAll(ownDir), ['art/a-copy.png', 'assets/main-BBBB.js', 'assets/new-DDDD.js', 'data/c.bin', 'play/index.html']);
    // and the NEXT release copies what this one fetched rather than asking again
    const V3 = { ...V2, 'play/index.html': Buffer.from('<!doctype html>v3') };
    const r3 = release(root, 'r3', V3, { version: '0.1.12' });
    const h3 = host(r3.pack);
    await store.stage(r3.manifest, { fetchRange: h3.fetchRange });
    assert.deepEqual(h3.asked.length, 1, 'one changed file, one range');
    const f = r3.manifest.files.find((x) => x.path === 'play/index.html');
    assert.deepEqual(h3.asked[0], [f.offset, f.offset + f.length]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: a byte that is not the release\'s is refused - nothing staged, nothing played; and an answer that is not the range asked the same', async () => {
  const root = tmp();
  try {
    const r1 = release(root, 'r1', V1, { version: '0.1.10' });
    const r2 = release(root, 'r2', V2, { version: '0.1.11' });
    const store = openGameStore({ root: join(root, 'Game'), seed: r1.seed, dist: r1.dist });
    const victim = r2.manifest.files.find((x) => x.path === 'data/c.bin');
    for (const [why, h, code] of [
      ['a flipped byte', host(r2.pack, { corrupt: victim.offset + 5 }), 'hash'],
      ['the whole pack for a range', host(r2.pack, { status: 200 }), 'range'],
    ]) {
      await assert.rejects(store.stage(r2.manifest, { fetchRange: h.fetchRange }), { code }, why);
      assert.equal(existsSync(join(root, 'Game', 'v0.1.11')), false, `${why}: the half-written version is deleted`);
      assert.equal(store.version(), '0.1.10', `${why}: the game played is the one it was`);
      assert.throws(() => store.activate('0.1.11'), { code: 'state' }, `${why}: and it cannot be played`);
    }
    // a decode that does not hash to the manifest is refused by the one law, whatever brought the bytes
    const bad = { ...victim, sha256: '0'.repeat(64) };
    assert.throws(() => G.decodeFile(bad, r2.pack.subarray(victim.offset, victim.offset + victim.length)), { code: 'hash' });
    assert.throws(() => G.decodeFile(victim, r2.pack.subarray(victim.offset, victim.offset + victim.length - 1)), { code: 'hash' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: the swap and its trial - the version before kept until the new one boots, rolled back when it never came up, remembered, and a new install starts over', async () => {
  const root = tmp();
  const groot = join(root, 'Game');
  try {
    const r1 = release(root, 'r1', V1, { version: '0.1.10' });
    const r2 = release(root, 'r2', V2, { version: '0.1.11' });
    const V3 = { ...V2, 'data/c.bin': noise('c3', 20000) };
    const r3 = release(root, 'r3', V3, { version: '0.1.12' });
    const open = (seed = r1.seed, dist = r1.dist) => openGameStore({ root: groot, seed, dist });
    let store = open();
    await store.stage(r2.manifest, { fetchRange: host(r2.pack).fetchRange });
    store.activate('0.1.11');
    store.bootStarting();
    assert.equal(store.bootDone(), true, 'v0.1.11 came up: proved');
    assert.equal(store.state().trial, false);
    // the next one, on trial, with the proved one kept beside it
    await store.stage(r3.manifest, { fetchRange: host(r3.pack).fetchRange });
    store.activate('0.1.12');
    assert.deepEqual([store.state().current, store.state().previous, store.state().trial], ['0.1.12', '0.1.11', true]);
    assert.ok(existsSync(join(groot, 'v0.1.11', 'index.json')), 'the version it replaces stays until this one boots');
    store.bootStarting();
    // ...and the app dies before the game came up: the next launch gives it up
    store = open();
    assert.equal(store.version(), '0.1.12', 'the state is the one written - the old or the new, never half');
    assert.deepEqual(store.startup(), { rolledBack: '0.1.12' });
    assert.equal(store.version(), '0.1.11', 'the version that booted plays again');
    assert.deepEqual(readFileSync(store.resolve('data/c.bin')), V2['data/c.bin']);
    assert.equal(store.hasFailed('0.1.12'), true, 'and the bad one is remembered: the installer\'s path takes it');
    assert.equal(existsSync(join(groot, 'v0.1.12')), false);
    assert.equal(G.routeFor({ seed: store.seed, manifest: r3.manifest, failed: store.failed() }).route, 'installer');
    // a trial never booted at all (the launcher activated it, the player quit) is not given up
    await store.stage(r2.manifest, { fetchRange: host(r2.pack).fetchRange }).catch((e) => assert.equal(e.code, 'state', 'the version in use is never re-staged'));
    // a proved trial deletes the one before it
    const V4 = { ...V2, 'empty.txt': Buffer.from('four') };
    const r4 = release(root, 'r4', V4, { version: '0.1.13' });
    await store.stage(r4.manifest, { fetchRange: host(r4.pack).fetchRange });
    store.activate('0.1.13');
    assert.deepEqual(store.startup(), {}, 'activated, never booted: nothing to give up');
    store.bootStarting();
    store.bootDone();
    assert.deepEqual(readdirSync(groot).filter((n) => n.startsWith('v')), ['v0.1.13'], 'only the version played is left');
    // a version readied while the game ran becomes the one played at the next launch
    const V5 = { ...V4, 'empty.txt': Buffer.from('five') };
    const r5 = release(root, 'r5', V5, { version: '0.1.14' });
    await store.stage(r5.manifest, { fetchRange: host(r5.pack).fetchRange });
    store.markReady('0.1.14');
    assert.equal(store.version(), '0.1.13', 'never under a running page');
    store = open();
    assert.deepEqual(store.startup(), { activated: '0.1.14' });
    assert.deepEqual(readFileSync(store.resolve('empty.txt')), Buffer.from('five'));
    // a new install starts over, even an OLDER one put in by hand whose files the version in use would still read
    // against: the installer's copy is the game, and every version the channel brought goes with the install it came to
    const older = open({ ...r1.seed, version: '0.1.9' }, r1.dist);
    assert.equal(older.version(), '0.1.9');
    assert.deepEqual(readdirSync(groot).filter((n) => n.startsWith('v')), []);
    const fresh = open(r5.seed, r5.dist);
    assert.equal(fresh.version(), '0.1.14');
    assert.equal(fresh.active(), false);
    assert.deepEqual(readdirSync(groot).filter((n) => n.startsWith('v')), [], 'every version the channel brought is deleted');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: a version the store did not finish, or whose files are gone, is no version - the one before it plays, or the install\'s own', async () => {
  const root = tmp();
  const groot = join(root, 'Game');
  try {
    const r1 = release(root, 'r1', V1, { version: '0.1.10' });
    const r2 = release(root, 'r2', V2, { version: '0.1.11' });
    let store = openGameStore({ root: groot, seed: r1.seed, dist: r1.dist });
    await store.stage(r2.manifest, { fetchRange: host(r2.pack).fetchRange });
    store.activate('0.1.11');
    store.bootStarting();
    store.bootDone();
    // a file of its own deleted behind its back (an antivirus, a hand): it no longer reads, and the install's copy plays
    rmSync(join(groot, 'v0.1.11', 'files', 'data', 'c.bin'));
    store = openGameStore({ root: groot, seed: r1.seed, dist: r1.dist });
    assert.equal(store.version(), '0.1.10');
    assert.equal(store.active(), false);
    // a version folder with no index.json is a stage that never finished: swept at the next open
    mkdirSync(join(groot, 'v0.1.99', 'files'), { recursive: true });
    store = openGameStore({ root: groot, seed: r1.seed, dist: r1.dist });
    assert.equal(existsSync(join(groot, 'v0.1.99')), false);
    // the bundled index is read only for the install it was built into
    writeFileSync(join(root, 'seed.json'), JSON.stringify(r1.seed));
    assert.deepEqual(loadSeed(join(root, 'seed.json'), '0.1.10'), r1.seed);
    assert.equal(loadSeed(join(root, 'seed.json'), '0.1.11'), null, 'a seed never speaks for another install');
    assert.equal(loadSeed(join(root, 'none.json'), '0.1.10'), null, 'no seed, no channel: a build cut without a release');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DA13: which path a release takes - the channel for the same shell and generation, the installer for another shell, another generation, a version that failed here, or a copy with no seed', () => {
  const seed = { shell: SHELL };
  const m = { channel: G.GAME_CHANNEL, shell: SHELL, version: '0.1.11' };
  assert.equal(G.routeFor({ seed, manifest: m }).route, 'game');
  assert.equal(G.routeFor({ seed, manifest: { ...m, shell: OTHER_SHELL } }).route, 'installer', 'the release changes the app itself');
  assert.equal(G.routeFor({ seed, manifest: { ...m, channel: G.GAME_CHANNEL + 1 } }).route, 'installer');
  assert.equal(G.routeFor({ seed, manifest: m, failed: ['0.1.11'] }).route, 'installer', 'a version the channel failed on here');
  assert.equal(G.routeFor({ seed, manifest: m, failed: ['0.1.10'] }).route, 'game');
  assert.equal(G.routeFor({ seed: null, manifest: m }).route, 'installer');
  // the release's game, as the release lists it - its own download links, and the pack's size
  const base = 'https://github.com/Lattymoy/daggerfall-js-source/releases/download/app-v0.1.11/';
  const rel = { assets: [{ name: G.GAME_FILES.manifest, size: 9, browser_download_url: base + G.GAME_FILES.manifest }, { name: G.GAME_FILES.pack, size: 99, browser_download_url: base + G.GAME_FILES.pack }] };
  assert.deepEqual(G.gameAssetsOf(rel), { manifest: base + G.GAME_FILES.manifest, pack: base + G.GAME_FILES.pack, packSize: 99 });
  assert.equal(G.gameAssetsOf({ assets: rel.assets.slice(0, 1) }), null, 'a release with no pack carries no game');
  assert.equal(G.gameAssetsOf({ assets: rel.assets.map((a) => ({ ...a, browser_download_url: `https://elsewhere.example/${a.name}` })) }), null, 'only this repository\'s own downloads');
  assert.equal(G.versionOfTag('app-v0.1.11'), '0.1.11');
  assert.equal(G.versionOfTag('v0.1.11'), null);
  // macOS, the portable exe and the AppImage alike: nothing in the channel's choice asks the transport
  const ask = main.slice(main.indexOf('async function askGame() {'), main.indexOf('/** The files `manifest` asks of this copy'));
  assert.doesNotMatch(ask, /currentUpdateTransport|process\.platform|PORTABLE_EXECUTABLE_DIR|APPIMAGE/, 'every copy with a seed takes the channel - the transport is only the installer\'s path');
});

test('DA13: the launcher - the game\'s download held before play like an installer\'s, Play runs it at once with nothing installed, and a failure hands the release back to the installer\'s path', () => {
  const run = (state, ...events) => events.reduce(L.reduce, state);
  const fresh = (over = {}) => L.initialState({ current: '0.1.10', transport: 'notice', checkEnabled: true, arena2Dir: '/games/ARENA2', lastPlayed: '0.1.10', ...over });
  const dl = run(fresh(), { type: 'game-available', version: '0.1.11', total: 3.2e6 }, { type: 'progress', percent: 50, transferred: 1.6e6, total: 3.2e6 });
  assert.deepEqual([dl.update.status, dl.update.kind, dl.update.version], ['downloading', 'game', '0.1.11'], 'the notice transport (macOS, the portable exe) downloads it too');
  assert.equal(L.canPlay(dl), false, 'held before play, so everyone online is on one version');
  const v = L.viewOf(dl);
  assert.equal(v.status, 'Downloading v0.1.11');
  assert.match(v.detail, /^Only the files that changed\./);
  assert.equal(v.progress.label, '1.6 of 3.2 MB');
  assert.deepEqual(v.statusActions.map((a) => a.id), ['play-now']);
  // down and played: the launcher's version moves, Play runs it - no installing, no restart
  const applied = run(dl, { type: 'game-applied', version: '0.1.11' });
  assert.deepEqual([applied.current, applied.update.status, applied.update.kind], ['0.1.11', 'current', null]);
  assert.equal(L.nextStep(applied), 'wait', 'nothing installs');
  assert.equal(L.canPlay(applied), true);
  assert.equal(L.viewOf(applied).status, 'Updated to v0.1.11');
  assert.equal(L.nextStep(run(applied, { type: 'play' })), 'launch');
  // electron-updater's "downloaded" never turns the game's download into an install
  assert.equal(run(dl, { type: 'downloaded', version: '0.1.11' }).update.status, 'downloading');
  // the channel could not: the installer's path is asked next, and its answer lands
  const failed = run(dl, { type: 'game-failed' });
  assert.deepEqual([failed.update.status, failed.update.kind], ['checking', null]);
  assert.equal(run(failed, { type: 'check-available', version: '0.1.11', download: 'd' }).update.status, 'notice');
  assert.equal(run(fresh({ transport: 'updater' }), { type: 'game-available', version: '0.1.11' }, { type: 'game-failed' }, { type: 'check-available', version: '0.1.11' }).update.status, 'downloading',
    'on the updater transport its installer downloads');
  // played without it: it finishes while the game runs and plays from the next start
  const bg = run(dl, { type: 'play-now' });
  assert.deepEqual([bg.update.status, bg.launch], ['background', 'requested']);
  assert.equal(L.viewOf({ ...bg, launch: null }).status, 'v0.1.11 plays from your next start');
  // after Play the game hears it, never the launcher; and a game version found once the launch started changes nothing
  assert.equal(run({ ...fresh(), launch: 'started' }, { type: 'game-available', version: '0.1.11' }).update.status, 'checking');
  assert.equal(run({ ...fresh(), launch: 'started' }, { type: 'game-applied', version: '0.1.11' }).current, '0.1.10');
  // a version the channel brought while the launcher waited on nothing (a recheck, a launch with it readied) is shown
  assert.equal(run(run(fresh(), { type: 'check-none' }), { type: 'game-applied', version: '0.1.11' }).current, '0.1.11');
  // and the game's HUD says what to do with one: it plays from the next start - true of the installer's update as well
  return import('../../src/systems/shellUpdates.js').then(({ updateReadyText }) => {
    assert.equal(updateReadyText({ version: '0.1.11', manual: false }),
      'DFO Online 0.1.11 is ready. It runs the next time you start, or now from File > Restart to Update. Save first.');
    assert.doesNotMatch(updateReadyText({ version: '0.1.11', manual: false }), /installs/, 'nothing installs when the channel brought it');
  });
});

test('DA13: the shell - the game\'s channel asked first everywhere, served by the version in use, proved by its boot, and the installer\'s path on any failure', () => {
  const sliceOf = (from, to) => { const a = main.indexOf(from); assert.ok(a >= 0, from); const b = main.indexOf(to, a + from.length); assert.ok(b > a, to); return main.slice(a, b); };
  const ask = sliceOf('async function askGame() {', '/** The files `manifest` asks of this copy');
  assert.match(ask, /if \(!gameStore\) return 'installer';/, 'no seed: the installer\'s path, as before DA13');
  assert.match(ask, /if \(!latest\) return gameStore\.active\(\) \? 'offline' : 'installer';/, 'a game ahead of its installer is never compared by the installer\'s path');
  assert.match(ask, /if \(!isNewerRelease\(gameVersion\(\), latest\.tag\)\) return 'current';/, 'compared against the GAME this copy plays');
  assert.match(ask, /const manifest = parseManifestFile\(Buffer\.from\(await res\.arrayBuffer\(\)\), \{ version \}\);/);
  assert.match(ask, /if \(manifest\.pack\.size !== latest\.game\.packSize\) throw/);
  assert.match(ask, /\} catch \(err\) \{\s*if \(gameJob\?\.version === version\) gameJob = null;\s*if \(version\) gameStore\.fail\(version\);/, 'any failure is remembered - that release is the installer\'s');
  assert.match(sliceOf('function gameFailed(', '/** The installer\'s path, quietly'), /gameStore\.fail\(version\);[\s\S]*if \(launcher && !launcher\.state\.launch\) \{ launcherDispatch\(\{ type: 'game-failed' \}\); startLaunchCheck\(\); return; \}\s*if \(updateChecksEnabled\(\)\) askInstaller\(\);/,
    'a download that failed hands the release to the installer\'s path at once');
  assert.match(sliceOf('function downloadGame(', '/** A version of the game is here'), /\(err\) => \{ gameJob = null; gameFailed\(version, err\); \}/);
  const arrived = sliceOf('function gameArrived(', '/** The channel could not bring');
  assert.match(arrived, /if \(!gameWindow \|\| gameWindow\.isDestroyed\(\)\) \{\s*gameStore\.activate\(version\);\s*launcherDispatch\(\{ type: 'game-applied', version \}\);/, 'no page running: played at once');
  assert.match(arrived, /if \(gameStore\.ready\(\) !== version\) gameStore\.markReady\(version\);/, 'a page running: never switched under it');
  // every check asks it first: the launcher's, the hourly one, --play's, the menu's
  assert.match(sliceOf('function startLaunchCheck()', 'function runLauncher()'), /askGame\(\)\.then\(\(g\) => \{\s*if \(g === 'current'\) launcherDispatch\(\{ type: 'check-none' \}\);\s*else if \(g === 'offline'\) launcherDispatch\(\{ type: 'check-failed' \}\);\s*if \(g !== 'installer'\) return;/);
  assert.match(sliceOf('function startRechecks()', '// ---- the window'), /if \(await askGame\(\) !== 'installer'\) return;\s*if \(currentUpdateTransport\(\) === 'updater'\) \{/);
  assert.match(sliceOf('async function runDirect(', '// The launcher\'s two words.'), /askGame\(\)\.then\(\(g\) => \{ if \(g === 'installer'\) askInstaller\(\); \}\);/);
  assert.match(main, /click: \(\) => checkForUpdatesLoudly\(\),/);
  // served by the version in use
  const serve = sliceOf('function handleDagger(req) {', '// ---- updating:');
  assert.match(serve, /if \(gameStore\?\.active\(\)\) \{\s*const file = gameStore\.resolve\(rel\) \?\? gameStore\.resolve\(`\$\{rel\}\/index\.html`\);\s*return file \? fileResponse\(file\) : new Response\('not found', \{ status: 404 \}\);\s*\}/,
    'a path the version does not name is not served - whatever the install holds');
  assert.ok(serve.indexOf('gameStore?.active()') < serve.indexOf('let p = path.normalize(path.join(DIST, rel));'), 'before the install\'s own copy');
  // counted, switched at a document load, proved, given up
  const cw = sliceOf('async function createWindow(', '// ---- the launcher');
  assert.match(cw, /win\.webContents\.on\('did-start-navigation', \(d\) => \{ if \(d\?\.isMainFrame && !d\.isSameDocument\) playReadyGame\(\); \}\);/);
  assert.match(cw, /gameStore\?\.bootStarting\(\);\s*await win\.loadURL\('dagger:\/\/game\/play\/index\.html'\);/);
  assert.match(cw, /win\.webContents\.on\('did-fail-load', \(_e, code, _text, _url, isMainFrame\) => \{ if \(isMainFrame && code !== -3\) giveUp\('did not load'\); \}\);/);
  // PIN MOVED (FIELD BUGS 2026-10-21b RENDERER-GONE): the stop goes to the trial first, as ever - and a stop the trial does not
  // take is said and restarted (test/tooling/fb1021b_renderergone.test.js), where it had been met by nothing
  assert.match(cw, /win\.webContents\.on\('render-process-gone', async \(_e, details\) => \{[^]*?if \(giveUp\('stopped before it came up'\) \|\| /);
  assert.match(cw, /const bad = gameStore\?\.rollback\(\);\s*if \(!bad\) return false;/);
  assert.match(main, /ipcMain\.on\('dagger:game-up', \(e\) => \{\s*if \(gameWindow && !gameWindow\.isDestroyed\(\) && e\.sender === gameWindow\.webContents\) gameStore\?\.bootDone\(\);\s*\}\);/, 'the game\'s window\'s word only');
  const preload = rd('app/preload.cjs');
  assert.match(preload, /onUpdateReady: \(cb\) => \{\s*updateListeners\.push\(cb\);\s*if \(updateHeard\) cb\(updateHeard\);[\s\S]*?ipcRenderer\.send\('dagger:game-up'\);\s*\},/, 'the game\'s boot subscribing is its word that it came up');
  assert.match(rd('src/main.js'), /Promise\.all\(\[import\('\.\/systems\/shellUpdates\.js'\), import\('\.\/systems\/notify\.js'\)\]\)\s*\.then\(\(\[updates, notify\]\) => updates\.listenForShellUpdates\(globalThis\.daggerShell/, 'and it subscribes once its own lazy modules have loaded');
  // Restart to Update reloads onto a version the channel brought - the page's own Leave/Stay asks first
  assert.match(sliceOf('async function restartToUpdate()', '/** A box over the window'), /if \(updateReady\?\.game\) \{ reloadOntoUpdate\(\); return; \}/);
  assert.match(sliceOf('function reloadOntoUpdate()', '/** The menu\'s check, out loud'), /markLeaving\(gameWindow\.webContents\);\s*gameWindow\.webContents\.reload\(\);/);
  // opened once, by the one instance, before the first request
  assert.match(main, /if \(!isSingleInstance\) return;[^\n]*\n\s*openGame\(\);[^\n]*\n\s*protocol\.handle\('dagger', handleDagger\);/);
  assert.match(sliceOf('function openGame() {', '/** The version of the game this copy plays'), /const seed = app\.isPackaged \? loadSeed\(GAME_SEED, app\.getVersion\(\)\) : null;\s*if \(!seed\) return;/);
  // the game's version is what the player is told and what Play keeps
  assert.match(main, /const gameVersion = \(\) => gameStore\?\.version\(\) \?\? app\.getVersion\(\);/);
  assert.match(main, /current: gameVersion\(\),/);
  // one range a request, a refused answer never read whole
  const range = sliceOf('async function fetchPackRange(', '/** The channel\'s download in flight');
  assert.match(range, /Range: `bytes=\$\{start\}-\$\{end - 1\}`/);
  assert.match(range, /if \(res\.status !== 206 \|\| !res\.body\) \{ stop\.abort\(\); return \{ status: res\.status, contentRange, bytes: Buffer\.alloc\(0\) \}; \}/);
});

test('DA13: the release pipeline - one shell id, the bundled game indexed in every installer, the pack cut once beside them, and the publish step that fails an update that is no longer per file', () => {
  // the shell is app/ and what its build takes from outside it - derived from the build config, never a list to forget
  assert.deepEqual(shellInputs(), ['app', 'public/icons/icon-512.png', 'src/ui/menu/menuPad.js', 'src/assets/branding/dfo-online.png']);
  assert.deepEqual(shellInputs({ build: { files: [{ from: '../src/x', to: 'y', filter: ['a.js'] }, { from: '../dist', to: 'dist', filter: ['x.js'] }, 'lib/**'] } }), ['app', 'src/x/a.js'], 'the game is the channel\'s, never the shell\'s');
  const objects = { 'HEAD:app': 't1', 'HEAD:src/x/a.js': 'b1' };
  const id = shellId((args) => objects[args[1]], 'HEAD', ['app', 'src/x/a.js']);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(shellId((args) => objects[args[1]], 'HEAD', ['app', 'src/x/a.js']), id, 'the same objects, the same id - on every runner');
  assert.notEqual(shellId((args) => ({ ...objects, 'HEAD:src/x/a.js': 'b2' })[args[1]], 'HEAD', ['app', 'src/x/a.js']), id, 'any input changed, another id');
  // the release carries the game, and a set without it publishes nothing
  assert.ok(EXPECTED_RELEASE_FILES.includes(G.GAME_FILES.manifest) && EXPECTED_RELEASE_FILES.includes(G.GAME_FILES.pack));
  const wf = rd('.github/workflows/release-desktop.yml');
  assert.match(wf, /SHELL_ID=\$\(node scripts\/desktopRelease\.mjs shell\)\n\s+if ! \[\[ "\$SHELL_ID" =~ \^\[0-9a-f\]\{64\}\$ \]\]; then/, 'derived once, in the version job, held to its shape');
  assert.match(wf, /\n\s+shell: \$\{\{ steps\.reltag\.outputs\.shell \}\}\n/);
  const build = wf.slice(wf.indexOf('\n  build:\n'), wf.indexOf('\n  publish:\n'));
  assert.match(build, /- name: Index the bundled game\n\s+if: needs\.version\.outputs\.tag != ''\n\s+shell: bash\n\s+env:\n\s+VERSION: \$\{\{ needs\.version\.outputs\.version \}\}\n\s+DFO_SHELL: \$\{\{ needs\.version\.outputs\.shell \}\}\n\s+run: node scripts\/desktopRelease\.mjs seed dist app\/game-seed\.json/,
    'every leg indexes the game it bundles - on a release only (a "try this build" follows no channel)');
  assert.ok(build.indexOf('- name: Index the bundled game') < build.indexOf('- name: Build installers'), 'before electron-builder packs it');
  assert.ok(JSON.parse(rd('app/package.json')).build.files.includes('game-seed.json'), 'and electron-builder packs it into the shell');
  assert.match(rd('.gitignore'), /\napp\/game-seed\.json\n/, 'never committed');
  assert.match(build, /- name: Pack the game\n\s+if: needs\.version\.outputs\.tag != '' && matrix\.os == 'ubuntu-latest'\n\s+shell: bash\n[\s\S]*?run: node scripts\/desktopRelease\.mjs pack dist app\/release\n/, 'cut once, by one leg');
  assert.match(build, /app\/release\/DFO-Online-game\.\*\n/, 'and handed on with the installers');
  const publish = wf.slice(wf.indexOf('\n  publish:\n'));
  const delta = publish.slice(publish.indexOf('- name: The game\'s update is the files that changed'), publish.indexOf('- name: Write the notes'));
  assert.match(delta, /node scripts\/desktopRelease\.mjs delta previous\/DFO-Online-game\.json\.gz release\/DFO-Online-game\.json\.gz "\$PREV"/);
  assert.ok(publish.indexOf('- name: The set is whole') < publish.indexOf('- name: The game\'s update is the files that changed')
    && publish.indexOf('- name: The game\'s update is the files that changed') < publish.indexOf('- name: Stage the release as a draft'), 'measured before anything is staged');
  // the judgement: most of the game again, or a shell id that moved with no shell file changed, fails the release
  const m = (shell, files, size = 1000) => ({ shell, version: '0.1.1', pack: { size }, files });
  const f = (sha256, length) => ({ path: sha256, sha256, length });
  const prev = m(SHELL, [f('1'.repeat(64), 400), f('2'.repeat(64), 600)]);
  assert.deepEqual(judgeDelta(prev, m(SHELL, [f('1'.repeat(64), 400), f('3'.repeat(64), 600)])).problems.length, 1, '60% of the game again');
  assert.deepEqual(judgeDelta(prev, m(SHELL, [f('3'.repeat(64), 400), f('2'.repeat(64), 600)])).problems, [], '40%: the files that changed');
  assert.equal(MAX_UPDATE_SHARE, 0.5);
  assert.deepEqual(judgeDelta(prev, m(OTHER_SHELL, [f('3'.repeat(64), 1000)]), { shellChanged: true }).problems, [], 'a shell change goes out by the installer: measured, never failed');
  assert.equal(judgeDelta(prev, m(OTHER_SHELL, [f('1'.repeat(64), 1000)]), { shellChanged: false }).problems.length, 1, 'an id that moved with nothing changed would send every update to the installer');
  assert.match(judgeDelta(prev, prev).said, /0 files, 0\.00 MB/);
});

test('DA13: the release script\'s own commands, run - seed and pack from the environment\'s numbers, and delta exits 1 on a regressed update', () => {
  const script = new URL('../../scripts/desktopRelease.mjs', import.meta.url).pathname;
  const node = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  const root = tmp();
  try {
    const d1 = writeSite(join(root, 'd1'), V1);
    const env = { VERSION: '0.1.10', DFO_UPDATE: '0.0.5', DFO_SHELL: SHELL };
    assert.equal(node(['seed', d1, join(root, 'seed.json')], env).status, 0);
    assert.deepEqual(loadSeed(join(root, 'seed.json'), '0.1.10'), gameSeed(d1, { version: '0.1.10', shell: SHELL }));
    assert.notEqual(node(['seed', d1, join(root, 'x.json')], { ...env, DFO_SHELL: 'nope' }).status, 0, 'no shell id, no seed');
    assert.equal(node(['pack', d1, join(root, 'p1')], env).status, 0);
    const m1 = G.parseManifestFile(readFileSync(join(root, 'p1', G.GAME_FILES.manifest)), { version: '0.1.10' });
    assert.equal(m1.update, '0.0.5', 'the player\'s update number rides along');
    assert.equal(statSync(join(root, 'p1', G.GAME_FILES.pack)).size, m1.pack.size);
    // the next release changes almost every byte: the publish step stops it
    const d2 = writeSite(join(root, 'd2'), { ...V1, 'art/a.png': noise('a2', 70000), 'assets/vendor-CCCC.js': text('vendor2', 90000) });
    assert.equal(node(['pack', d2, join(root, 'p2')], { ...env, VERSION: '0.1.11' }).status, 0);
    const bad = node(['delta', join(root, 'p1', G.GAME_FILES.manifest), join(root, 'p2', G.GAME_FILES.manifest)]);
    assert.equal(bad.status, 1, 'most of the game again: nothing is published');
    assert.match(bad.stderr, /the game's update has regressed - nothing is published/);
    const d3 = writeSite(join(root, 'd3'), { ...V1, 'play/index.html': Buffer.from('<!doctype html>3') });
    assert.equal(node(['pack', d3, join(root, 'p3')], { ...env, VERSION: '0.1.12' }).status, 0);
    const good = node(['delta', join(root, 'p1', G.GAME_FILES.manifest), join(root, 'p3', G.GAME_FILES.manifest)]);
    assert.equal(good.status, 0);
    assert.match(good.stdout, /^v0\.1\.10 -> v0\.1\.12: 1 files, /);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
