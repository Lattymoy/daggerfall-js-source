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
const mem = new Map(); // NAME -> Uint8Array

/** Uppercase basename: the canonical ARENA2 key. Exported for tests. */
export function normalizeName(name) {
  const s = String(name);
  const base = s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);
  return base.toUpperCase();
}

function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
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

function idbPutAll(db, entries, onProgress) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let done = 0;
    for (const [key, buf] of entries) {
      const req = store.put(buf, key);
      req.onsuccess = () => onProgress && onProgress(++done, entries.length);
    }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

let db = null;
async function getDb() {
  if (!db) db = await openDb();
  return db;
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
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
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
    entries.push([key, await f.arrayBuffer()]);
  }
  return entries;
}

const PROBE = 'ART_PAL.COL'; // small, universally present, first thing most scenes touch

/** Boot gate: resolves when a data source can serve. Shows the
 *  folder-pick overlay only when neither IndexedDB nor the network
 *  path has data (i.e. the deployed site on first visit). */
export async function ensureArena2() {
  try { if (await idbCount(await getDb()) > 0) return; } catch { /* no IDB */ }
  try { const r = await fetch(`./arena2/${PROBE}`); if (r.ok) return; } catch { /* offline dev server */ }

  await new Promise((resolve) => {
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;inset:0;background:#111;color:#ddd;font:14px monospace;display:flex;align-items:center;justify-content:center;z-index:10';
    ui.innerHTML = `
      <div style="max-width:460px;text-align:center;border:1px solid #444;padding:24px" id="dz">
        <h2 style="margin-top:0">project-dagger</h2>
        <p>Daggerfall's game data is freeware but can't be bundled.</p>
        <p>Select your <b>ARENA2</b> folder (or drop it here) - it's stored
        locally in your browser, picked once.</p>
        <input type="file" id="pick" webkitdirectory multiple style="margin:8px">
        <p id="msg" style="color:#8a8"></p>
      </div>`;
    document.body.appendChild(ui);
    const msg = ui.querySelector('#msg');
    const ingest = async (files) => {
      msg.textContent = `reading ${files.length} files...`;
      const entries = await readPicked(files);
      if (!entries.length) { msg.textContent = 'no usable files in that selection'; return; }
      try {
        await idbPutAll(await getDb(), entries, (d, n) => { msg.textContent = `storing ${d}/${n}...`; });
      } catch { /* no IDB: memory-only session */ }
      for (const [k, buf] of entries) mem.set(k, new Uint8Array(buf));
      ui.remove();
      resolve();
    };
    ui.querySelector('#pick').addEventListener('change', (e) => ingest([...e.target.files]));
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
