import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { warningImage } from '../src/formats/mwTexture.js';
import {
  buildFpArm, createFpArm, fpSkeletonPath, FP_CLIP_PATH,
  collectArmTextures, resolveWeaponParts, weaponPartPaths,
} from '../src/combat/fpArm.js';

// MW-LOAD (2026-09-08, Mac: "improve the load time when Morrowind assets
// are enabled"): THE ARM READS A LAZILY OPENED ARCHIVE.
//
// dataSource no longer pulls each stored .bsa out of IndexedDB as one
// whole ArrayBuffer (150-300 MB apiece, one to three seconds each, three
// of them on a retail set). It OPENS each one off its stored Blob: the
// directory by range, an entry's bytes by range when a reader LOADS
// them. `get` stays synchronous and answers only what is in hand - and
// on such an archive it THROWS for an entry nobody asked for.
//
// Every existing fixture in this suite hands buildFpArm a resident
// two-door duck, which cannot see that law at all: it answers `get` for
// anything it carries, so a build that never loaded a single byte still
// passes. That is exactly the hole this file closes. Everything here
// drives the REAL MwBsaFile, opened off a real Blob, with nothing but
// the directory in memory - so a read that outruns its load is a test
// failure here and a black screen on Mac's machine.

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/**
 * A Morrowind BSA v0x100, written here from the layout doc at the head of
 * src/formats/mwBsaFile.js - the same independent writer
 * test/fixtures/mw/generate.py uses for fixture.bsa, in JS, so a test can
 * put ANY file map behind a genuinely lazy archive. Names are stored
 * backslashed and the hash table is zeroed, exactly as the committed
 * fixture is, because names are authoritative and hashes are ignored.
 */
function makeBsa(files) {
  const names = [...files.keys()];
  const enc = new TextEncoder();
  const nameBytes = names.map((n) => enc.encode(n.replace(/\//g, '\\')));
  let nameBufSize = 0;
  const nameOffsets = [];
  for (const nb of nameBytes) { nameOffsets.push(nameBufSize); nameBufSize += nb.length + 1; }
  const dirSize = 12 * names.length + nameBufSize;
  const dataSize = names.reduce((a, n) => a + files.get(n).length, 0);
  const out = new Uint8Array(12 + dirSize + 8 * names.length + dataSize);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x100, true);
  dv.setUint32(4, dirSize, true);
  dv.setUint32(8, names.length, true);
  let o = 12;
  let off = 0;
  for (const n of names) {
    dv.setUint32(o, files.get(n).length, true);
    dv.setUint32(o + 4, off, true);
    o += 8; off += files.get(n).length;
  }
  for (const no of nameOffsets) { dv.setUint32(o, no, true); o += 4; }
  for (const nb of nameBytes) { out.set(nb, o); o += nb.length; out[o++] = 0; }
  o += 8 * names.length;   // the hash table, zeroed
  for (const n of names) { out.set(files.get(n), o); o += files.get(n).length; }
  return out;
}

const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);   // mType at byte 8 (loadweap.hpp)
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};

const LONG_BOW = { templateIndex: 130 };
const IRON_STAFF = { templateIndex: 115, material: 0 };   // Staff -> BluntTwoWide

/** The first-person arm fixture, the bow, its arrow and a sword - the
 *  file map every existing fixture build uses, as archive bytes. */
function armFiles() {
  return new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
    ['meshes/w/arrow.nif', f('arrow.nif')],
    ['meshes/w/weapon.nif', f('weapon.nif')],
    // The meshes name "tx_fixture.TGA"; the archive has only the .dds,
    // which is the retail arrangement rule 36 exists for - and which
    // makes the texture PRELOAD walk that ladder rather than the name.
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
}

const WEAP_ESM = Uint8Array.from([
  ...wpdt('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
  ...wpdt('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
  ...wpdt('iron staff', 'w/weapon.nif', MW_WEAPON_TYPE.BluntTwoWide),
]);

const ARCHIVE_BYTES = makeBsa(armFiles());

const depsOver = (archive) => ({
  loadMorrowindArchives: async () => [archive],
  storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
  loadMorrowindFile: async (n) => (n === 'weap.esm' ? WEAP_ESM : f('armfp.esm')),
});

const lazyArchive = () => MwBsaFile.open(new Blob([ARCHIVE_BYTES]));
const wholeArchive = () => new MwBsaFile(ARCHIVE_BYTES);

const stubRenderer = () => ({
  createCharacterMesh: () => ({ vao: {}, buffers: [] }),
  updateCharacterMesh: () => {},
  createCharacterTexture: (mips) => ({ mips }),
  renderCharacterSpriteImage: (mesh, model, proj, view, w, h) =>
    ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
});

/** Everything about a build that a reader could get wrong by reading an
 *  entry the archive had not loaded: which meshes bound, which textures
 *  resolved and decoded, which records the weapon column found. */
const shapeOf = (res) => ({
  ok: res.ok,
  stage: res.stage ?? null,
  error: res.error ?? null,
  pieces: res.pieces,
  skeletonPath: res.skeletonPath,
  sourcePaths: res.sourcePaths,
  groups: res.groups,
  notes: res.notes,
  weapon: res.weapon,
  arrow: res.arrow,
  textures: [...(res.textures ?? new Map()).entries()]
    .map(([file, e]) => [file, e.ok, e.path, e.error ?? null, e.image.width, e.image.height]),
});

// ── the archive's own law, on the committed fixture ──────────────────

test('MW-LOAD: fixture.bsa opens LAZILY - the directory by range, an entry only once it is loaded', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/mw/fixture.bsa', import.meta.url)));
  const lazy = await MwBsaFile.open(new Blob([bytes]));
  const whole = new MwBsaFile(bytes);
  assert.equal(lazy.lazy, true, 'a blob-backed archive says so');
  assert.equal(whole.lazy, false, 'and a whole-buffer one does not');
  // THE DIRECTORY IS ALL THAT CAME IN. `has` and `list` are directory
  // questions and answer identically; `loaded` says no bytes are here.
  assert.deepEqual(lazy.list(), whole.list());
  assert.equal(lazy.has('meshes/fixture/mesh.nif'), true);
  assert.equal(lazy.loaded('meshes/fixture/mesh.nif'), false);
  assert.throws(() => lazy.get('meshes/fixture/mesh.nif'), /not loaded/,
    'the sync door refuses an entry nobody asked for - the law this whole file exists to keep');
  // and one ranged read later it is the same bytes the whole buffer has
  await lazy.load('meshes/fixture/mesh.nif');
  assert.equal(lazy.loaded('meshes/fixture/mesh.nif'), true);
  assert.deepEqual(lazy.get('meshes/fixture/mesh.nif'), whole.get('meshes/fixture/mesh.nif'));
  // a whole-buffer archive answers loaded for everything it carries, so
  // one body of code drives both and no fixture had to move.
  assert.equal(whole.loaded('meshes/fixture/mesh.nif'), true);
});

// ── the build, off a lazy archive ───────────────────────────────────

test('MW-LOAD: buildFpArm builds off a LAZY archive, with the SAME result as the whole buffer', async () => {
  const lazy = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: depsOver(await lazyArchive()) });
  const whole = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: depsOver(wholeArchive()) });
  assert.equal(lazy.ok, true, `the lazy build must stand (${lazy.stage}: ${lazy.error})`);
  assert.equal(whole.ok, true, `and so must the whole-buffer one (${whole.stage}: ${whole.error})`);
  // BYTE FOR BYTE THE SAME ARM. Every preload in fpArm.js exists to make
  // this line true; a missed one shows up here as a refusal, a missing
  // piece, or a magenta warning image where a texture used to be.
  assert.deepEqual(shapeOf(lazy), shapeOf(whole));
  // and the arm that came out is a real one, not an empty pass.
  assert.ok(lazy.pieces >= 2, `the lazy build bound its meshes (${lazy.pieces})`);
  assert.equal(lazy.weapon.id, 'long bow', 'rule 8\'s weapon column resolved off ranged reads');
  assert.equal(lazy.arrow.id, 'iron arrow', 'and rule 24\'s arrow with it');
  const tex = lazy.textures.get('tx_fixture.tga');
  assert.ok(tex && tex.ok, 'rule 36\'s ladder landed on the .dds and DECODED it');
  assert.equal(tex.path, 'textures/tx_fixture.dds', 'the AUTHORED .tga name resolved to the archived .dds');
  // and it is the FIXTURE's pixels, not ImageManager's 8x8 magenta -
  // which is the same size, so the size cannot tell them apart.
  const warn = warningImage().mips[0].rgba;
  assert.notDeepEqual(tex.image.mips[0].rgba, warn, 'a decoded texture, not the warning image');
});

test('MW-LOAD: nothing in a lazy build ever says "not loaded"', async () => {
  const res = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: depsOver(await lazyArchive()) });
  // The failure this file guards is not subtle and it is not silent: a
  // read that outruns its load surfaces either as MwBsaFile's own throw
  // ("not loaded - await load(path) first") or as findLoaded's named
  // MW-LOAD refusal. Neither may appear ANYWHERE in a build's output -
  // not as the refusal, not as a note, not as a texture's error.
  const said = JSON.stringify([res.error ?? '', res.stage ?? '', res.notes ?? [],
    [...res.textures.values()].map((e) => e.error ?? ''),
    res.third ? [res.third.error ?? '', res.third.notes ?? []] : []]);
  assert.ok(!/not loaded/.test(said), `a read outran its load: ${said}`);
  assert.ok(!/MW-LOAD:/.test(said), `a preload missed a read site: ${said}`);
});

test('MW-LOAD: the build reports its STAGE TIMINGS, and the total covers every stage', async () => {
  // Mac's question was "where does the time go", and one number cannot
  // answer it. Five disjoint spans (MF1 split the reach SWEEP out of
  // `meshes`) and their total, in whole milliseconds, printed once and
  // carried on the result.
  const res = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: depsOver(await lazyArchive()) });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.ok(res.timings, 'a successful build carries its timings');
  assert.deepEqual(Object.keys(res.timings).sort(), ['archives', 'esm', 'meshes', 'sweep', 'textures', 'total']);
  for (const [name, v] of Object.entries(res.timings)) {
    assert.equal(typeof v, 'number', `${name} is a number`);
    assert.ok(Number.isInteger(v), `${name} is whole milliseconds (${v})`);
    assert.ok(v >= 0, `${name} is not negative (${v})`);
  }
  for (const name of ['archives', 'esm', 'meshes', 'textures', 'sweep']) {
    assert.ok(res.timings.total >= res.timings[name],
      `total (${res.timings.total}) must cover ${name} (${res.timings[name]})`);
  }
  // ONE line, and it prints the numbers the result carries - never one
  // per file, which is what makes a slow boot slower.
  const src = rd('src/combat/fpArm.js');
  assert.equal((src.match(/console\.log\(/g) || []).length, 1, 'exactly one log in the whole file');
  assert.match(src, /\[mw\] arm built in \$\{timings\.total\} ms - archives \$\{timings\.archives\}, /);
  assert.match(src, /esm \$\{timings\.esm\}, meshes \$\{timings\.meshes\}, textures \$\{timings\.textures\}, sweep \$\{timings\.sweep\}/);
});

// ── the doors a build does not go through ───────────────────────────

test('MW-LOAD: collectArmTextures reads what the build already loaded, and preloadArmTextures is why', async () => {
  const archive = await lazyArchive();
  const res = await buildFpArm({ race: 'fprace', deps: depsOver(archive) });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  // The build's own preload walked rule 36's ladder and loaded what it
  // landed on, so the SYNCHRONOUS collector - called again here exactly
  // as the swap path calls it - reads bytes in hand.
  const again = collectArmTextures(res.arm.pieces, [archive]);
  for (const [file, entry] of again) {
    assert.equal(entry.ok, true, `${file}: ${entry.error}`);
    assert.equal(entry.path, 'textures/tx_fixture.dds');
  }
  assert.ok(again.size >= 1, 'the arm names a texture at all');
});

test('MW-LOAD: the live weapon swap resolves off a lazy archive', async () => {
  const archive = await lazyArchive();
  const arm = createFpArm();
  arm.attach(stubRenderer(), () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0 }));
  const built = await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: depsOver(archive) });
  assert.equal(built.ok, true, `${built.stage}: ${built.error}`);
  assert.equal(built.weapon.id, 'long bow');
  // THE SWAP TAKES ITS OWN PATH - it never calls build(), it re-resolves
  // through resolveWeaponParts and rebinds - so it needs its own
  // preload, and a sword whose mesh nothing has loaded yet is exactly
  // the read that would have thrown.
  assert.equal(await arm.setWeapon(IRON_STAFF, { hasAmmo: false }), true, 'the swap landed');
  const st = arm.status();
  assert.ok(st.weapon, `the swap resolved a record (${(st.notes ?? []).join(' | ')})`);
  assert.equal(st.weapon.id, 'iron staff', 'and the new weapon is in the hand');
  assert.ok(!(st.notes ?? []).some((n) => /not loaded|MW-LOAD:/.test(n)), 'with nothing outrunning its load');
});

test('MW-LOAD: the ITEM ICON is a two-phase door - null, a notify, then the picture', async () => {
  const archive = await lazyArchive();
  const arm = createFpArm();
  arm.attach(stubRenderer(), () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0 }));
  const built = await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: depsOver(archive) });
  assert.equal(built.ok, true, `${built.stage}: ${built.error}`);
  let notified = 0;
  arm.subscribe(() => { notified++; });
  const item = { group: 'Weapons', templateIndex: 130, material: 0 };
  // itemIcon is SYNCHRONOUS by design - the pack asks per tile, per
  // paint - so on a lazy archive the first ask cannot have the bytes.
  // It answers null (the classic sprite stands, which is what every
  // other miss here means), kicks the loads, and notifies when they
  // land; the pack repaints on that subscription and asks again.
  assert.equal(arm.itemIcon(item, { size: 32 }), null, 'the first ask has nothing to draw yet');
  assert.equal(arm.itemIcon(item, { size: 32 }), null, 'and asking again while it loads is still null');
  for (let i = 0; i < 100 && notified === 0; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(notified, 1, 'ONE kick per icon, and it notified when it landed - not one per paint');
  const img = arm.itemIcon(item, { size: 32 });
  assert.ok(img && img.width === 32 && img.height === 32, 'and the repaint\'s ask draws the ground mesh');
});

// ── the source law: no synchronous read outruns its load ────────────

test('MW-LOAD: every synchronous archive read in fpArm.js is covered, in its own function', () => {
  const src = rd('src/combat/fpArm.js');
  const lines = src.split('\n');
  // A function boundary: a `function` declaration at any of this file's
  // nesting levels, or a method of the createFpArm object literal. The
  // keyword exclusion keeps `for (...) {` and `if (...) {` from reading
  // as one.
  const FN_START = /^\s{0,4}(?:export\s+)?(?:async\s+)?function\s|^\s{4}(?!(?:if|for|while|switch|catch|try|else|do|return)\b)[A-Za-z][\w$]*\(.*\)\s*\{\s*$/;
  // A synchronous read of ARCHIVE bytes. Every one of them is
  // `<an archive>.get(<path>)`, and every archive here is named by the
  // find that produced it.
  const READ = /\b(?:arc|tarc|skelArc|ammoArc)\.get\(|find\((?:p|path)\)\.get\(/;
  // What makes a read legal: the load that brought its bytes in
  // (loadFromArchives and the three preloads that call it), or
  // findLoaded, which is the ASSERTION that some earlier function's
  // load covered this one - the shape a synchronous callback needs.
  // `preloadIcon` is itemIcon's own door: it is CALLED there, ahead of
  // the read, and it awaits inside itself because itemIcon may not
  // (the frame path forbids an await in that whole region).
  const COVER = /\b(?:loadFromArchives|preloadArmTextures|preloadClothingColour|prepareClothingColours|preloadIcon|findLoaded)\(/;
  // The two functions whose reads are covered by their CALLERS, because
  // both are synchronous doors somebody else must open first. Named
  // here, with the pin that checks each of their call sites below, so
  // the exemption is a statement rather than a hole.
  const EXEMPT = new Map([
    ['resolveWeaponParts', 'its `find` is the caller\'s; all four call sites preload through weaponPartPaths'],
    ['collectArmTextures', 'synchronous by contract; every call site preloads through preloadArmTextures'],
  ]);
  const nameOf = (line) => (line.match(/(?:function\s+)?([A-Za-z][\w$]*)\s*\(/) || [])[1] ?? '?';

  let fnAt = 0;
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    if (FN_START.test(lines[i])) { fnAt = i; continue; }
    if (!READ.test(lines[i])) continue;
    found++;
    const fn = nameOf(lines[fnAt]);
    if (EXEMPT.has(fn)) continue;
    // fnAt + 1: a preload's own DECLARATION must not count as its own
    // cover, or removing the load inside it would still read as covered.
    const before = lines.slice(fnAt + 1, i).join('\n');
    assert.ok(COVER.test(before),
      `${fn} (line ${i + 1}) reads archive bytes with no load ahead of it in the same function:\n  ${lines[i].trim()}`);
  }
  assert.ok(found >= 10, `the scan must actually find the read sites (${found})`);

  // The two exemptions, discharged: every call site of each opens the
  // door before it walks through.
  const callsCovered = (call, cover) => {
    let at = 0;
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
      if (FN_START.test(lines[i])) { at = i; continue; }
      if (!lines[i].includes(call)) continue;
      if (/^export function /.test(lines[i])) continue;   // the definition is not a call
      n++;
      assert.ok(new RegExp(cover).test(lines.slice(at + 1, i).join('\n')),
        `${call} at line ${i + 1} is not preceded by ${cover} in its own function`);
    }
    return n;
  };
  // resolveWeaponParts: buildTpBody, buildFpArm, and the swap's two
  // rigs (which share one load, the same records for both).
  assert.equal(callsCovered('resolveWeaponParts({', 'loadFromArchives\\([\\s\\S]*weaponPartPaths\\(|weaponPartPaths\\('), 4);
  // collectArmTextures: the two builds and the swap's two rigs.
  // renderGroundMesh's own call is the ICON's, and the icon opens its
  // door in preloadIcon before the synchronous getter is ever reached -
  // so it is listed here rather than swept, and preloadIcon is pinned
  // by the two-phase test above.
  let icons = 0;
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    if (FN_START.test(lines[i])) { at = i; continue; }
    if (!lines[i].includes('collectArmTextures(')) continue;
    if (/^export function collectArmTextures/.test(lines[i])) continue;
    const fn = nameOf(lines[at]);
    if (fn === 'renderGroundMesh') { icons++; continue; }
    assert.ok(/preloadArmTextures\(/.test(lines.slice(at + 1, i).join('\n')),
      `collectArmTextures at line ${i + 1} (in ${fn}) has no preloadArmTextures ahead of it`);
  }
  assert.equal(icons, 1, 'renderGroundMesh is the ONE synchronous texture collector, and the icon door covers it');
  assert.match(src, /if \(arc\) await preloadArmTextures\(flattenNif\(parseNif\(arc\.get\(path\)\.slice\(\)\)\), cat\.archives, cat\.gen\);/,
    'and preloadIcon is what opens it');
});

test('MW-LOAD: weaponPartPaths names exactly what resolveWeaponParts reads', () => {
  // The preload and the read must ask the SAME record questions or the
  // split is a second copy of rule 8's weapon column waiting to drift.
  const allWeapons = [
    { id: 'long bow', model: 'w/bowmesh.nif', name: 'W', type: MW_WEAPON_TYPE.MarksmanBow, enchanted: false },
    { id: 'iron arrow', model: 'w/arrow.nif', name: 'W', type: MW_WEAPON_TYPE.Arrow, enchanted: false },
  ];
  const files = new Map([['meshes/w/bowmesh.nif', f('bowmesh.nif')], ['meshes/w/arrow.nif', f('arrow.nif')]]);
  const read = [];
  const find = (p) => { read.push(p); return files.has(p) ? { get: () => files.get(p) } : null; };
  const named = weaponPartPaths({ weapon: LONG_BOW, hasAmmo: true, allWeapons });
  resolveWeaponParts({ weapon: LONG_BOW, hasAmmo: true, allWeapons, find, skeletonBytes: f('armfp.nif') });
  assert.deepEqual(named, ['meshes/w/bowmesh.nif', 'meshes/w/arrow.nif']);
  assert.deepEqual(read, named, 'the paths resolveWeaponParts asked for are the paths the preload named');
  // no ammo asked for, no arrow named - the same condition, once.
  assert.deepEqual(weaponPartPaths({ weapon: LONG_BOW, hasAmmo: false, allWeapons }), ['meshes/w/bowmesh.nif']);
  // and empty hands name nothing at all.
  assert.deepEqual(weaponPartPaths({ weapon: null, allWeapons }), []);
});
