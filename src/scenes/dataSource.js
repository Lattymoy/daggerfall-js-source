// ARENA2 data source (production data integration). Port-Doctrine:
// the game data is freeware but NOT redistributable - it never enters
// the repo or the build. Readers load user-supplied data at runtime.
// This module is that runtime path:
//
//   getBytes(name): memory cache -> IndexedDB -> network ./arena2/*
//   ensureArena2(): boot gate - if no source can serve, a DOM overlay
//     asks for the local ARENA2 folder (directory input or drag-drop)
//     and persists it into IndexedDB, so the pick happens ONCE.
//
// The network fallback keeps the dev middleware path (vite serves
// /arena2/* from ARENA2_PATH) working unchanged; on the deployed site
// it 404s and the picker is the source. Names are normalized to
// UPPERCASE basenames - real ARENA2 ships uppercase, user folders vary.

const DB_NAME = 'project-dagger';
const STORE = 'arena2';
/** M-EXT: user-supplied music lives in its OWN store, and that is not
 *  tidiness. The ARENA2 store is filtered by KEEP - the download diet -
 *  which rejects every audio extension by design and is guarded by a
 *  pin that fails if the filter moves without a MANIFEST_V bump. Music
 *  replacements are not game data, have their own lifecycle (re-pick
 *  the pack without re-picking the game), and must not be swept by
 *  clearStoredData's recovery wipe. */
const MUSIC_STORE = 'music';
/** M-TEX: the same reasoning as the music store, one domain over. */
const TEXTURE_STORE = 'textures';
/** R6: DERIVED artifacts - bytes the game GENERATED from the player's
 *  own data, not bytes the player supplied. The road network is the
 *  first: a whole-map bake costs about twenty-six seconds, so it is
 *  computed once and kept.
 *
 *  It is a store of its own for the reason the others are, plus one
 *  more: a derived artifact is only valid FOR the data it came from,
 *  so it must die with an ARENA2 re-pick. clearStoredData sweeps it -
 *  the only injected store that recovery touches, and deliberately,
 *  because keeping a road network baked from a folder the player has
 *  just replaced is worse than paying for a rebake. */
const DERIVED_STORE = 'derived';
/** Every injected-asset store, so the upgrade and the helpers below
 *  cannot drift from each other - adding a domain is one entry. */
const ASSET_STORES = [MUSIC_STORE, TEXTURE_STORE, DERIVED_STORE];
const mem = new Map(); // NAME -> Uint8Array

// Ingest DIET (2026-08-14, the mobile storage fix): ARENA2 is 517MB
// but the engine reads ~155MB - TEXTURE archives, the BSAs, palettes,
// PAKs, CFGs, fonts, WOODS.WLD, MAGIC.DEF, SPELLS.STD, IMG/CIF art,
// RSC text, RCI, SND, the .TXT set (BIOG*.TXT biographies + FACTION.TXT)
// and CLASSES.DAT. The other 362MB (VIDs 83, SKY/PACKED DATs 247,
// FLCs, quest QBN/QRC) is unread by the port - ingesting it tripled
// storage + memory pressure and quota-killed phones. When a future
// slice needs a dropped kind: bump MANIFEST_V - stale stored sets
// auto-wipe to the picker.
//
// AUDIT 18 F2: the diet outlived three slices that shipped readers for
// kinds it drops, and each degraded SILENTLY through a warn-and-skip.
// CLASSES.DAT (the U18 class-questions results walk, chargenSession.js),
// FACTION.TXT (the T3a reaction layer, townTalk.js) and every BIOG*.TXT
// (the S3e biography, biogFile.js) are fetched by LIVE code and were all
// filtered out - so on the deployed and phone paths the whole biography
// stage, the class-questions screen and every faction datum were simply
// absent. Dev hid it: the vite ARENA2_PATH middleware serves the network
// fallback, which production 404s.
// The whole .TXT set is 19 files / 148KB, so it rides WHOLESALE rather
// than by name - a future .TXT reader is then covered without anyone
// remembering. CLASSES.DAT is named EXACTLY, because a bare \.DAT$ would
// drag in the 247MB SKY/PACKED sets the diet exists to refuse.
//
// AUDIT 19 F8: .GFX joined the wholesale list. There are exactly TWO
// (SCRL00I0/SCRL01I0, the U18 class-questions parchment scroll) and they
// were STARVED - fetched in a `for (const name of [...])` loop, which the
// F2 pin's single-literal regex could not see, so the deployed and phone
// paths fell back to the text panel and the pin passed. The pin now scans
// every ARENA2 filename the source NAMES, not just the ones it fetches in
// a shape the regex recognises.
//
// U22: the VIDs are the same trap and CANNOT ride wholesale - the set is
// 86MB and \.VID$ would undo the diet's single biggest saving. So they
// are named one at a time, and ONLY when something actually plays them:
// ANIM0001 is the splash (1.4MB) and is wired in main.js; ANIM0012 is
// the death video (DaggerfallUI.cs:50), wired by D1 and ingested below.
// V1 wired the two dream videos, so the rule fed them: ANIM0002 (the
// lycanthropy dream, 1.3MB) and ANIM0004 (the vampire dream, 1.3MB)
// now play from scenes/shared.js's wireInfectionVideos, and the fake
// death reuses ANIM0012, already here for D1. DFU names three more -
// ANIM0000/ANIM0011/DAG2, the new-game cinematics
// (DaggerfallStartNewGameWizard.cs:33-35, 26.6MB between them) - and
// none of THOSE is wired here yet, so none is ingested. (The merge audit found
// this comment and the Ledger row it mirrors both still saying the
// diet held ANIM0001 alone, fourteen lines above the KEEP that names
// ANIM0012 - the exact drift the rule below exists to prevent.) Adding a file nobody plays costs every user the bytes for
// nothing; forgetting one that IS played is the F2 silent degradation.
// Which is why the rule is ENFORCED, not remembered - and the enforcement
// was already here: AUDIT 18 F2's pin re-derives the fetch list from the
// source on every run, so main.js's getBytes('ANIM0001.VID') put the
// splash under the rule the moment it was written. Proven by mutation -
// drop the name below and F2 fails with "desktop diet drops
// ANIM0001.VID". Wire a video, and the pin makes you feed it.
const LEAN = typeof window !== 'undefined' &&
  ('ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0);
export const KEEP = (name, lean = LEAN) => /^TEXTURE\.\d+$/.test(name) ||
  /\.(BSA|COL|PAL|PAK|CFG|FNT|WLD|DEF|STD|IMG|CIF|RSC|RCI|SND|TXT|GFX|BSS)$/.test(name) ||   // U45 added BSS: the three compass needles, 116KB for all three
  name === 'CLASSES.DAT' ||
  name === 'ANIM0001.VID' ||                // the U22 splash - see the VID note above
  name === 'ANIM0012.VID' ||                // D1 the death video (DaggerfallUI.cs:50), reused as V1's fake death
  name === 'ANIM0002.VID' ||                // V1 the lycanthropy dream (LycanthropyInfection.cs:95)
  name === 'ANIM0004.VID' ||                // V1 the vampire dream (VampirismInfection.cs:109)
  name === 'ROGUE.CEL' || name === 'MAGE.CEL' || name === 'WARRIOR.CEL' ||   // F2 the chargen constellations
  (!lean && /^SKY\d+\.DAT$/.test(name));   // skies: 247MB - full sets on desktop, gradient fallback on the lean diet
const MANIFEST_KEY = '__MANIFEST__';
const MANIFEST_V = 8;   // v1 = the broken-era sets (pre-diet), v2 = the sets missing BIOG*/FACTION/CLASSES, v3 = the sets missing the U22 splash VID, v4 = the sets missing the .GFX scroll (AUDIT 19 F8), v5 = the sets missing the D1 death video + the F2 constellation CELs, v6 = the sets missing V1's two dream VIDs, v7 = the sets missing U45's .BSS compass needles - all auto-wiped

/** Uppercase basename: the canonical ARENA2 key. Exported for tests. */
export function normalizeName(name) {
  const s = String(name);
  const base = s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);
  return base.toUpperCase();
}

function openDb() {
  return new Promise((res, rej) => {
    // M-EXT bumped this to 2 for the music store. The handler creates
    // whatever is MISSING rather than assuming a fresh database: an
    // existing player arrives here at version 1 holding a full ARENA2
    // ingest, and re-creating `arena2` would throw and take their data
    // with it.
    // 5 (R6): the derived store. The upgrade is ADDITIVE and every arm
    // below is guarded by `contains`, so a player arriving at any older
    // version gains the new store and keeps every byte of the old ones.
    const req = indexedDB.open(DB_NAME, 5);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      for (const name of ASSET_STORES) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name);
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    // RA1: a version-bump open WAITS FOREVER while any other tab still
    // holds the database at an older version - onblocked, not onerror -
    // and every boot await upstream of getDb() hangs with it, wearing
    // whatever status line was set last ("baking roads", famously).
    // The wait itself is correct (the open proceeds the moment the old
    // tab closes); waiting SILENTLY is the bug. Say so, in the console
    // and on the title bar the status convention already uses.
    req.onblocked = () => {
      console.warn('[dataSource] database upgrade blocked - close other tabs running this game');
      try { document.title = 'Daggerfall JavaScript - close other game tabs to continue'; } catch { /* no-DOM host */ }
    };
  });
}

function idbGet(db, key) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
  });
}

function idbCount(db) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).count();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function idbPutBatch(db, batch) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const [key, buf] of batch) store.put(buf, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/** Store in BATCHES (mobile-safe, 2026-08-14): one transaction over
 *  the whole ~250MB set held every buffer live at once - on phones
 *  that peak (zip + inflated entries + IDB copies) got the tab's
 *  WebGL context killed and the game went black after ingest. Small
 *  batches let stored buffers release as we go. */
async function idbPutAll(db, entries, onProgress) {
  const BATCH = 24;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await idbPutBatch(db, batch);
    for (let j = i; j < Math.min(i + BATCH, entries.length); j++) entries[j] = null;   // release
    if (onProgress) onProgress(Math.min(i + BATCH, entries.length), entries.length);
  }
}

let db = null;
async function getDb() {
  if (!db) db = await openDb();
  return db;
}

async function idbPut(db, key, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGetManifest(db) {
  try {
    const m = await idbGet(db, MANIFEST_KEY);
    return m ? JSON.parse(new TextDecoder().decode(m)) : null;
  } catch { return null; }
}

/** Finish an ingest: batched store, MANIFEST LAST (its presence IS
 *  the completeness proof - a mid-ingest death leaves no manifest and
 *  the next visit auto-wipes to the picker instead of bricking).
 *  Returns null on success, else a user-facing failure message
 *  (quota/full device is the mobile reality) - the partial store is
 *  wiped before returning so no poison remains. */
async function finishIngest(entries, msg) {
  try {
    const d = await getDb();
    await idbPutAll(d, entries, (done, n) => { msg.textContent = `storing ${done}/${n}...`; });
    await idbPut(d, MANIFEST_KEY, new TextEncoder().encode(JSON.stringify({ v: MANIFEST_V, diet: LEAN ? 'lean' : 'full', count: entries.length })));
    return null;
  } catch (err) {
    try { await clearStoredData(); } catch { /* wipe best-effort */ }
    // no-IDB (private mode): a memory-only session still works if the
    // buffers survived (nothing was nulled when the FIRST write threw)
    let kept = 0;
    for (const e of entries) if (e) { mem.set(e[0], new Uint8Array(e[1])); kept++; }
    if (kept === entries.length) return null;
    mem.clear();
    return `storage failed (${err?.name || err}) - your device may be low on space. Freed the partial data; clear some space and pick again.`;
  }
}

/** Recovery: wipe the stored set (a mid-ingest tab death leaves a
 *  PARTIAL store - idbCount > 0 skips the picker, then boot dies on
 *  the first missing file with no way back). */
export async function clearStoredData() {
  mem.clear();
  const d = await getDb();
  // The ARENA2 set AND every artifact DERIVED from it. The injected
  // stores (music, textures) are the player's own packs and
  // survive - re-picking the game files is not asking to lose them -
  // but a road network baked from the folder being replaced is not a
  // pack, it is an ANSWER ABOUT that folder, and keeping it would hand
  // the new data the old map. Sweeping it costs one rebake.
  await new Promise((res, rej) => {
    const tx = d.transaction([STORE, DERIVED_STORE], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(DERIVED_STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ---- M-EXT: the user's own music folder -----------------------------
//
// DFU keeps replacement songs as loose files in StreamingAssets/Sound
// and asks for one by name before playing a built-in song. There is no
// such folder in a browser, so the "folder" is a pick, stored the way
// ARENA2 is, and the lookup runs over the stored names.
//
// NOTHING SHIPS WITH THE GAME. This reads a directory the player
// chooses and stores it in their own browser; the repo carries no
// audio and the deploy serves none.

// ONE implementation, two domains. The music and texture ingests are
// the same four operations over different stores and different
// accept-filters, and writing them twice is how the second one drifts.

/** Put the accepted files from a pick into `store`. `accept(name)`
 *  answers whether a file belongs to this domain, so a pack folder
 *  with its readme and cover art in it just works. Returns the count. */
async function storeAssets(store, files, accept) {
  const d = await getDb();
  let kept = 0;
  for (const f of files) {
    const base = f.name.slice(f.name.lastIndexOf('/') + 1);
    if (!accept(base)) continue;
    const buf = await f.arrayBuffer();
    await new Promise((res, rej) => {
      const tx = d.transaction(store, 'readwrite');
      tx.objectStore(store).put(buf, base);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    kept++;
  }
  return kept;
}

/** Every stored filename in `store`. Empty when there is no IndexedDB
 *  (private mode), which reads as "no pack" and plays the classics. */
async function assetNames(store) {
  try {
    const d = await getDb();
    return await new Promise((res, rej) => {
      const tx = d.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => res(req.result ?? []);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return [];
  }
}

/** Bytes for one stored asset, or null. */
async function assetBytes(store, fileName) {
  const d = await getDb();
  const stored = await new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(fileName);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
  });
  return stored ? new Uint8Array(stored) : null;
}

/** Drop a whole domain. Deliberately NOT part of clearStoredData: that
 *  is ARENA2 recovery, and re-picking the game files is not asking to
 *  lose the packs. */
async function clearAssets(store) {
  const d = await getDb();
  await new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function storeMusicFiles(files) {
  const { replacementEntry } = await import('../systems/musicReplacement.js');
  return storeAssets(MUSIC_STORE, files, (n) => !!replacementEntry(n));
}
export const storedMusicNames = () => assetNames(MUSIC_STORE);
export const loadMusicFile = (fileName) => assetBytes(MUSIC_STORE, fileName);
export const clearStoredMusic = () => clearAssets(MUSIC_STORE);

/** R6: one derived artifact, by key. Bytes in, bytes out - this door
 *  knows nothing about what it holds, and the artifact's OWN envelope
 *  (systems/roadBake.js: magic, version, checksum) is what decides
 *  whether what comes back is usable. That is why there is no version
 *  here: a stale or torn record is refused by the reader and rebaked,
 *  which is strictly better than a store-level stamp that can only
 *  answer "different", never "damaged". */
export async function storeDerived(key, bytes) {
  const d = await getDb();
  await new Promise((res, rej) => {
    const tx = d.transaction(DERIVED_STORE, 'readwrite');
    tx.objectStore(DERIVED_STORE).put(bytes, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  return true;
}
export const loadDerived = (key) => assetBytes(DERIVED_STORE, key);
export const clearDerived = () => clearAssets(DERIVED_STORE);

export async function storeTextureFiles(files) {
  const { textureEntry } = await import('../systems/textureReplacement.js');
  return storeAssets(TEXTURE_STORE, files, (n) => !!textureEntry(n));
}
export const storedTextureNames = () => assetNames(TEXTURE_STORE);
export const loadTextureFile = (fileName) => assetBytes(TEXTURE_STORE, fileName);
export const clearStoredTextures = () => clearAssets(TEXTURE_STORE);

/**
 * The asset-pack pick, in the shape of the ARENA2 one. ONE overlay,
 * parameterised - the music and texture picks differ only in their
 * words and their store.
 *
 * DFU's equivalent is "put files in StreamingAssets/<domain>"; a
 * browser has no such folder, so the player points at one and it is
 * stored here. Resolves to the number of assets the pick can replace.
 *
 * CANCELLING IS NOT AN ERROR. The overlay has its own way out and
 * resolves 0 - a player who opens this to see what it is and closes it
 * has not broken anything, and the classic assets were already there.
 */
/**
 * MWFIX: THE PICKER OUTRANKS WHATEVER OPENED IT.
 *
 * This overlay stood at z-index 11 while the enhanced shell that opens
 * it stands at 12 - so pressing "Attach data" built the picker BEHIND
 * an opaque full-screen pane. Nothing appeared to happen; the file
 * input was there, unreachable, with `document.elementFromPoint` at
 * its own centre answering a shell element. And because the only exit
 * was a Close button under that same pane, the overlay was never
 * removed and its promise never resolved: it lingered in the DOM and
 * surfaced later - a flash when the shell came down at New Game, then
 * again once chargen (14) finished - which is exactly what the bug
 * report described.
 *
 * The landscape it has to clear: 12 the enhanced shell, 13 the pause /
 * inventory / character doors, 14 chargen, 20 the top overlays. This
 * modal is opened FROM those, so it must sit above all of them. The
 * number is not eyeballed - test/datasourcepicker.test.js reads every
 * z-index literal in src/ and fails if any reaches this one.
 */
export const ASSET_PICKER_Z = 40;

/** MWFIX: is the asset picker on screen? A modal opened FROM another
 *  overlay has to be able to say so, because the opener may own the
 *  keyboard - the enhanced shell takes Escape on `globalThis` in
 *  CAPTURE and stops it (enhancedMenu.js:1529), which is right for a
 *  screen with nothing above it and wrong the moment something is.
 *  Its own stated law is that a modal overlay owns its input; this is
 *  how the one above it says "that's me". */
let _pickerOpen = false;
export const assetPickerOpen = () => _pickerOpen;

async function pickAssetFolder({ title, blurb, store, register }) {
  return new Promise((resolve) => {
    const ui = document.createElement('div');
    _pickerOpen = true;
    ui.style.cssText = `position:fixed;inset:0;background:#111;color:#ddd;font:14px monospace;display:flex;align-items:center;justify-content:center;z-index:${ASSET_PICKER_Z}`;
    ui.innerHTML = `
      <div style="max-width:460px;text-align:center;border:1px solid #444;padding:24px">
        <h2 style="margin-top:0">${title}</h2>
        ${blurb}
        <input type="file" id="pickassets" webkitdirectory multiple style="margin:8px">
        <p id="amsg" style="color:#8a8"></p>
        <button id="adone" style="margin-top:8px">Close</button>
      </div>`;
    document.body.appendChild(ui);
    const msg = ui.querySelector('#amsg');
    let count = 0;
    ui.querySelector('#pickassets').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      msg.textContent = `reading ${files.length} files...`;
      try {
        await store(files);
        count = await register();
        msg.textContent = count ? `${count} files will be used` : 'nothing usable in that folder';
      } catch (err) {
        // NEVER TRAPS: a storage failure costs the pack, not the game.
        msg.textContent = `could not store that: ${err?.message ?? err}`;
      }
    });
    // THREE WAYS OUT, because a modal that can be covered must never be
    // a trap - the function's own contract above says cancelling is not
    // an error, and until MWFIX that was only true of the one button.
    // Escape and a backdrop click join it; `close` is idempotent, so
    // whichever fires first wins and the rest are no-ops.
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      _pickerOpen = false;
      globalThis.removeEventListener('keydown', onKey, true);
      ui.remove();
      resolve(count);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    globalThis.addEventListener('keydown', onKey, true);
    ui.addEventListener('click', (e) => { if (e.target === ui) close(); });   // the backdrop, never the card
    ui.querySelector('#adone').addEventListener('click', close);
  });
}

export async function pickMusicFolder() {
  const { setMusicReplacements } = await import('../systems/musicReplacement.js');
  return pickAssetFolder({
    title: 'Your own music',
    blurb: `<p>Pick a folder of audio to play instead of Daggerfall's
      built-in songs. Nothing is uploaded - it is stored in this
      browser.</p>
      <p style="color:#999">A <b>Daggerfall Unity music pack works
      as-is</b> - its <b>song_*.ogg</b> names are already the ones this
      looks for.</p>`,
    store: storeMusicFiles,
    register: async () => setMusicReplacements(await storedMusicNames(), loadMusicFile),
  });
}

export async function pickTextureFolder() {
  const { setTextureReplacements } = await import('../systems/textureReplacement.js');
  return pickAssetFolder({
    title: 'Your own textures',
    blurb: `<p>Pick a folder of PNGs to draw instead of Daggerfall's
      built-in textures. Nothing is uploaded - it is stored in this
      browser.</p>
      <p style="color:#999">A <b>Daggerfall Unity texture pack works
      as-is</b>: its <b>003_5-0.png</b> names are already the ones this
      looks for. Anything you skip keeps the classic art.</p>`,
    store: storeTextureFiles,
    register: async () => setTextureReplacements(await storedTextureNames(), loadTextureFile),
  });
}

/** The single data seam every reader goes through (via fetchBytes). */
export async function getBytes(name) {
  const key = normalizeName(name);
  const hit = mem.get(key);
  if (hit) return hit;
  try {
    const stored = await idbGet(await getDb(), key);
    if (stored) { const u8 = new Uint8Array(stored); mem.set(key, u8); return u8; }
  } catch { /* no IDB (private mode etc.) - fall through to network */ }
  const res = await fetch(`./arena2/${name}`);
  if (!res.ok) throw new Error(`${name}: ${res.status} - not in the stored ARENA2 selection and no server copy; re-pick a complete ARENA2 folder`);
  const u8 = new Uint8Array(await res.arrayBuffer());
  mem.set(key, u8);
  return u8;
}

/** Read a picked FileList into (NAME, ArrayBuffer) entries: uppercase
 *  basenames, flat-name filter (the dev middleware's own rule). */
async function readPicked(files) {
  const entries = [];
  for (const f of files) {
    const key = normalizeName(f.name);
    if (!/^[A-Za-z0-9._-]+$/.test(key)) continue;
    if (!KEEP(key)) continue;   // the engine's diet only
    entries.push([key, await f.arrayBuffer()]);
  }
  return entries;
}

const PROBE = 'ART_PAL.COL'; // small, universally present, first thing most scenes touch

// ---- ZIP ingest (mobile path, 2026-08-13) ----
// iOS Safari has no directory picker, so phones supply the data as a
// ZIP (the official DaggerfallGameFiles.zip or a self-zipped arena2).
// Minimal reader, no dependency: EOCD scan -> central directory ->
// per-entry local header -> DecompressionStream('deflate-raw') for
// method 8, passthrough for method 0. No zip64 (the game files are
// well under the 4GB shapes). If the archive carries an arena2/
// folder, only those entries ingest (the full gamefiles zip ships
// siblings we must not swallow).
export async function readZip(file, onProgress) {   // exported for the harness
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // EOCD: scan the tail for PK\x05\x06 (comment can pad up to 64KB)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a ZIP (no end-of-central-directory)');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dirs = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('bad central directory');
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
    if (!name.endsWith('/')) dirs.push({ name, method, compSize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  const hasArena2 = dirs.some((d) => /(^|\/)arena2\//i.test(d.name));
  const picked = hasArena2 ? dirs.filter((d) => /(^|\/)arena2\//i.test(d.name)) : dirs;
  const entries = [];
  let seen = 0;
  for (const d of picked) {
    const key = normalizeName(d.name);
    if (onProgress && ++seen % 50 === 0) onProgress(seen, picked.length);
    if (!/^[A-Za-z0-9._-]+$/.test(key)) continue;
    if (!KEEP(key)) continue;   // skip BEFORE inflating - the 362MB of unread data never touches memory
    // Local header: its own name/extra lengths position the data
    const lnl = dv.getUint16(d.localOff + 26, true);
    const lel = dv.getUint16(d.localOff + 28, true);
    const data = buf.subarray(d.localOff + 30 + lnl + lel, d.localOff + 30 + lnl + lel + d.compSize);
    if (d.method === 0) {
      entries.push([key, data.slice().buffer]);
    } else if (d.method === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      entries.push([key, out]);
    }
    // other methods: skip (classic zips are 0/8 only)
  }
  return entries;
}


/** Boot gate: resolves when a data source can serve. Shows the
 *  folder-pick overlay only when neither IndexedDB nor the network
 *  path has data (i.e. the deployed site on first visit). */
export async function ensureArena2() {
  try {
    const d = await getDb();
    const m = await idbGetManifest(d);
    if (m && m.v === MANIFEST_V) return;   // complete, current-diet set
    if (await idbCount(d) > 0) await clearStoredData();   // partial or stale-diet: poison, wipe to the picker
  } catch { /* no IDB */ }
  try { const r = await fetch(`./arena2/${PROBE}`); if (r.ok) return; } catch { /* offline dev server */ }

  await new Promise((resolve) => {
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;inset:0;background:#111;color:#ddd;font:14px monospace;display:flex;align-items:center;justify-content:center;z-index:10';
    ui.innerHTML = `
      <div style="max-width:460px;text-align:center;border:1px solid #444;padding:24px" id="dz">
        <h2 style="margin-top:0">Daggerfall JavaScript</h2>
        <p>Daggerfall's game data is freeware but can't be bundled.</p>
        <p>Select your <b>ARENA2</b> folder (or drop it here) - it's stored
        locally in your browser, picked once.</p>
        <input type="file" id="pick" webkitdirectory multiple style="margin:8px">
        <p style="margin:4px 0">on a phone: pick a <b>.zip</b> instead
        (DaggerfallGameFiles.zip or a zipped arena2 folder)</p>
        <input type="file" id="pickzip" accept=".zip,application/zip" style="margin:8px">
        <p id="msg" style="color:#8a8"></p>
      </div>`;
    document.body.appendChild(ui);
    const msg = ui.querySelector('#msg');
    const ingest = async (files) => {
      msg.textContent = `reading ${files.length} files...`;
      const entries = await readPicked(files);
      if (!entries.length) { msg.textContent = 'no usable files in that selection'; return; }
      const fail = await finishIngest(entries, msg);
      if (fail) { msg.textContent = fail; return; }   // stay on the picker
      ui.remove();
      resolve();
    };
    ui.querySelector('#pick').addEventListener('change', (e) => ingest([...e.target.files]));
    ui.querySelector('#pickzip').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      msg.textContent = `unpacking ${f.name}...`;
      try {
        const entries = await readZip(f, (done, n) => { msg.textContent = `unpacking ${done}/${n}...`; });
        if (!entries.length) { msg.textContent = 'no ARENA2 files in that zip'; return; }
        const fail = await finishIngest(entries, msg);
        if (fail) { msg.textContent = fail; return; }   // stay on the picker
        ui.remove();
        resolve();
      } catch (err) {
        msg.textContent = `zip failed: ${err.message}`;
      }
    });
    ui.addEventListener('dragover', (e) => e.preventDefault());
    ui.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = [];
      const walk = async (entry) => {
        if (entry.isFile) files.push(await new Promise((r) => entry.file(r)));
        else if (entry.isDirectory) {
          const reader = entry.createReader();
          let batch;
          do {
            batch = await new Promise((r) => reader.readEntries(r));
            for (const en of batch) await walk(en);
          } while (batch.length);
        }
      };
      for (const item of e.dataTransfer.items) { const en = item.webkitGetAsEntry?.(); if (en) await walk(en); }
      ingest(files);
    });
  });
}
