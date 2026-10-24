// STUDIO1 (2026-10-17, bible/07-Rendering/Studio-Art.md): THE STUDIO'S LISTING, MADE WHERE IT IS SERVED.
//
// The studio (src/systems/studioArt/studioArt.js) is a folder the game's artists drop pictures into. What the game
// wears is what the folder holds: the dev server answers `art/studio/index.json` by reading the folder as it is asked,
// and the build writes the same listing beside the pictures it copies - so a picture dropped in (from a checkout, or
// through GitHub's own upload page) is worn on the next load and the next deploy, and there is no list for anyone to
// keep. Every other pack the port carries ships a committed index made by a tool (vendor/*/*.index.json); those are
// third-party archives that change when a tool re-extracts them, and this is a folder people paint into.
//
// The folder's rules live here once, for the listing, the doctrine sweep (test/tooling/doctrine.test.js) and the
// artists' check (tools/studioArt.mjs):
//
//   public/art/studio/README.md       the artists' guide
//   public/art/studio/artists.json    the roster - each artist's folder, name and the word that approved them
//   public/art/studio/<artist>/...    an artist's own drawings, any folders deep: PNG, named by what they replace
//
// A picture the rules refuse is left out of the listing (the game draws what it drew before) and named in the
// problems; the suite fails on any problem, so none ships.
import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { studioFile, STUDIO_DIR, STUDIO_INDEX, STUDIO_LABEL } from '../src/systems/studioArt/studioArt.js';

/** The studio in the tree. */
export const STUDIO_TREE = `public/${STUDIO_DIR}`;
/** The roster: `{ artists: [{ folder, name, approved }] }`. */
export const STUDIO_ROSTER = 'artists.json';
/** The artists' guide. */
export const STUDIO_README = 'README.md';
/** The largest side a picture may have, texels - a little over twice Vanilla Enhanced's largest (941), and the studio's
 *  pictures are decoded whole (the vendor tier takes no Texture detail cap). */
export const STUDIO_MAX_SIDE = 2048;
/** The largest file, bytes: every picture is published with the site and the desktop app. */
export const STUDIO_MAX_BYTES = 4 * 1024 * 1024;
/** What every name in the studio may be - an artist's folder, a folder in it, a picture's file: letters, digits and
 *  `_ . -`, a letter or digit at each end (AUDIT STUDIO1 C6). The game asks for a picture by its name over the web, where
 *  `#`, `?` and `+` are not a file's (a dev server answers the page instead), git lists an accented name quoted (the
 *  doctrine's sweep could not find it), and the desktop release is checked out on Windows (no `:` or `*`, no name ending
 *  in a dot). */
export const STUDIO_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/;
/** The names Windows keeps for itself, with or without an extension - a folder so named would not check out there. */
export const STUDIO_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
/** What an artist's computer leaves in a folder and git never commits (.gitignore's): passed over, never said. */
export const STUDIO_LITTER = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\._.*)$/;

/** Every file under `dir`, as paths under it, sorted - each with whether it is a link (`link`). */
function walk(dir, base = '') {
  let names;
  try { names = readdirSync(join(dir, base), { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of names) {
    if (STUDIO_LITTER.test(d.name)) continue;
    const rel = base ? `${base}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...walk(dir, rel));
    else out.push({ path: rel, link: d.isSymbolicLink() });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** A PNG's size off its header (the signature, then IHDR's width and height), or null when the bytes are no PNG. */
export function pngSize(bytes) {
  const b = Buffer.from(bytes ?? []);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || sig.some((v, i) => b[i] !== v) || b.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** The roster, read; `problems` gets what is wrong with it. */
export function readStudioRoster(root = process.cwd(), problems = []) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(root, STUDIO_TREE, STUDIO_ROSTER), 'utf8')); } catch (e) {
    problems.push(`${STUDIO_ROSTER}: the roster will not read (${e?.message ?? e}) - no artist's pictures are worn`);
    return [];
  }
  const artists = [];
  for (const a of Array.isArray(doc?.artists) ? doc.artists : []) {
    if (!STUDIO_NAME.test(a?.folder ?? '') || STUDIO_RESERVED.test(a.folder) || typeof a.name !== 'string' || !a.name || typeof a.approved !== 'string' || !a.approved) {
      problems.push(`${STUDIO_ROSTER}: ${JSON.stringify(a)} - an artist needs a folder (letters, digits, _ . -), a name, and the word that approved them`);
      continue;
    }
    if (artists.some((x) => x.folder.toLowerCase() === a.folder.toLowerCase())) { problems.push(`${STUDIO_ROSTER}: "${a.folder}" twice`); continue; }
    artists.push(a);
  }
  return artists;
}

/** The first bytes of a file - enough for a PNG's header. */
function head(file) {
  const fd = openSync(file, 'r');
  try { const b = Buffer.alloc(24); const n = readSync(fd, b, 0, 24, 0); return b.subarray(0, n); } finally { closeSync(fd); }
}

/**
 * THE FOLDER, READ: every picture the game may wear (`files`, paths under the studio, sorted), what keeps any other file
 * out (`problems`, one line each, said to the artist), and the roster.
 */
export function studioListing(root = process.cwd()) {
  const dir = join(root, STUDIO_TREE);
  const problems = [];
  const roster = readStudioRoster(root, problems);
  const folders = new Set(roster.map((a) => a.folder));
  const files = [];
  const keys = new Map();
  for (const { path, link } of walk(dir)) {
    if (!path.includes('/')) {
      if (path !== STUDIO_ROSTER && path !== STUDIO_README) problems.push(`${path}: the studio's own folder holds only ${STUDIO_README} and ${STUDIO_ROSTER} - a picture goes in its artist's folder`);
      continue;
    }
    const artist = path.split('/')[0];
    if (path.split('/').some((n) => !STUDIO_NAME.test(n) || STUDIO_RESERVED.test(n))) { problems.push(`${path}: a name here is letters, digits and _ . - only, a letter or digit at each end (no spaces, accents, # or ? - the game asks for the picture by its name over the web)`); continue; }
    if (!folders.has(artist)) { problems.push(`${path}: "${artist}" is not on the roster (${STUDIO_ROSTER}) - an artist is added there before their folder is worn`); continue; }
    if (!/\.png$/i.test(path)) { problems.push(`${path}: only PNG pictures go in the studio (keep working files - .psd, .aseprite, .kra - outside public/; everything here is published)`); continue; }
    const e = studioFile(path);
    if (!e) { problems.push(`${path}: the name says nothing the game wears - name it <archive>_<record>-<frame>.png (a dye after it as the game asks it: _Iron, never _iron or _Silver), a label after "${STUDIO_LABEL}" if you like (38181_1-0${STUDIO_LABEL}cart-side.png)`); continue; }
    if (link) { problems.push(`${path}: a link, not a picture - the picture itself goes here (what a link points at is not in the commit)`); continue; }
    const full = join(dir, path);
    let bytes, first;
    try { bytes = statSync(full).size; first = head(full); } catch (err) { problems.push(`${path}: will not read (${err?.code ?? err?.message ?? err})`); continue; }
    if (bytes > STUDIO_MAX_BYTES) { problems.push(`${path}: ${(bytes / 1048576).toFixed(1)} MB - a picture may be ${STUDIO_MAX_BYTES / 1048576} MB at most`); continue; }
    const size = pngSize(first);
    if (!size) { problems.push(`${path}: not a PNG inside (re-export it as PNG)`); continue; }
    if (!size.width || !size.height || size.width > STUDIO_MAX_SIDE || size.height > STUDIO_MAX_SIDE) { problems.push(`${path}: ${size.width} x ${size.height} - a side may be ${STUDIO_MAX_SIDE} at most`); continue; }
    if (keys.has(e.key)) { problems.push(`${path}: ${keys.get(e.key)} already paints ${e.key} - one picture a slot`); continue; }
    keys.set(e.key, path);
    files.push(path);
  }
  return { files, problems, roster };
}

/** The listing as the game reads it (studioArt.js STUDIO_INDEX). */
export const studioIndexJson = (listing) => `${JSON.stringify({ studio: 1, files: listing.files })}\n`;

/** The served path of the listing. */
export const STUDIO_INDEX_PATH = `/${STUDIO_DIR}/${STUDIO_INDEX}`;

/**
 * The Vite plugin: the dev server answers the listing fresh at every ask (a picture dropped in is worn on the next
 * load), and the build writes it beside the pictures. A problem is said in the dev server's log and the build's
 * warnings; the picture it names is left out.
 */
export function studioArtIndex(root = process.cwd()) {
  return {
    name: 'studio-art-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== STUDIO_INDEX_PATH) return next();
        const listing = studioListing(root);
        for (const p of listing.problems) server.config.logger.warn(`[studio] ${p}`);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(studioIndexJson(listing));
      });
    },
    generateBundle() {
      const listing = studioListing(root);
      for (const p of listing.problems) this.warn(`[studio] ${p}`);
      this.emitFile({ type: 'asset', fileName: `${STUDIO_DIR}/${STUDIO_INDEX}`, source: studioIndexJson(listing) });
    },
  };
}
