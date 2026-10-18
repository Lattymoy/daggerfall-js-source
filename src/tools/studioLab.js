// STUDIO1 (2026-10-17, bible/07-Rendering/Studio-Art.md): THE STUDIO PAGE (studio.html) - every slot the port paints
// itself (systems/studioArt/studioSlots.js), drawn as the game wears it today, each with its template to download under
// the name the studio reads, and beside it the studio's own picture where an artist has drawn one (the listing the dev
// server and the build serve - scripts/studioArtIndex.mjs). No game data: these are the port's own numbers.
import { STUDIO_SETS, studioSlots } from '../systems/studioArt/studioSlots.js';
import { studioEntries, studioUrl, STUDIO_INDEX } from '../systems/studioArt/studioArt.js';

const $ = (id) => document.getElementById(id);
/** An element with its text and its children. */
const el = (tag, cls, text, kids = []) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  for (const k of kids) e.append(k);
  return e;
};

/** The studio's pictures by key, or none when the listing is not served (a page opened off a plain static server). */
async function studioByKey() {
  try {
    const r = await fetch(studioUrl(STUDIO_INDEX), { cache: 'no-store' });
    return r.ok ? new Map(studioEntries((await r.json()).files).map((e) => [e.key, e])) : new Map();
  } catch { return new Map(); }
}

/** A picture (top-down RGBA) on a canvas, shown at a whole multiple of its size. */
function canvasOf(p) {
  const c = document.createElement('canvas');
  c.width = p.width; c.height = p.height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  const k = Math.max(1, Math.floor(136 / Math.max(p.width, p.height)));
  c.style.width = `${p.width * k}px`; c.style.height = `${p.height * k}px`;
  return c;
}

/** Saves a canvas as a PNG under `name`. */
function save(canvas, name) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

const cells = [];
async function draw() {
  const own = await studioByKey();
  const root = $('sets');
  let n = 0;
  for (const set of STUDIO_SETS) {
    const slots = studioSlots(set);
    const grid = el('div', 'grid');
    const section = el('section', 'set', null, [
      el('h2', null, `${set.title} - archive ${set.archive}`),
      el('p', 'hint', `${slots.length} pictures.`),
      grid,
    ]);
    root.append(section);
    for (const s of slots) {
      const painted = canvasOf(await s.picture());
      const by = own.get(s.key);
      const pics = el('div', 'pics');
      if (by) { const img = el('img'); img.src = studioUrl(by.path); img.alt = by.path; pics.append(img); }
      pics.append(painted);
      const button = el('button', null, 'template');
      button.title = s.fileName;
      button.addEventListener('click', () => save(painted, s.fileName));
      const cell = el('div', by ? 'cell own' : 'cell', null, [pics, el('div', 'n', s.name), el('div', 'k', `${s.key} - ${painted.width} x ${painted.height}${s.cutout ? ' - glass' : ''}`), ...(by ? [el('div', 'by', by.path)] : []), button]);
      cells.push({ cell, section, text: `${s.name} ${s.key} ${set.title} ${by?.path ?? ''}`.toLowerCase(), own: !!by });
      grid.append(cell);
      own.delete(s.key);
      n++;
    }
  }
  if (own.size) {
    const grid = el('div', 'grid');
    root.append(el('section', 'set', null, [el('h2', null, "Daggerfall's own textures the studio replaces"), grid]));
    for (const e of own.values()) {
      const img = el('img'); img.src = studioUrl(e.path); img.alt = e.path;
      const cell = el('div', 'cell own', null, [el('div', 'pics', null, [img]), el('div', 'k', e.key), el('div', 'by', e.path)]);
      cells.push({ cell, section: grid.parentElement, text: `${e.key} ${e.path}`.toLowerCase(), own: true });
      grid.append(cell);
    }
  }
  $('status').textContent = `${n} slots, ${cells.filter((c) => c.own).length} with a studio picture`;
}

function filter() {
  const q = $('find').value.trim().toLowerCase(), mine = $('mine').checked;
  const shown = new Set();
  for (const c of cells) {
    const on = (!q || c.text.includes(q)) && (!mine || c.own);
    c.cell.classList.toggle('hidden', !on);
    if (on) shown.add(c.section);
  }
  for (const s of document.querySelectorAll('section.set')) s.classList.toggle('hidden', !shown.has(s));
}
// The page's own boot. A module the suite imports (test/tree/moduleload_smoke.test.js) has no document, and its body still
// runs - the slots' painters and the listing's reader with it.
if (globalThis.document) {
  $('find').addEventListener('input', filter);
  $('mine').addEventListener('change', filter);
  draw().catch((e) => { $('status').textContent = `the studio would not draw: ${e?.message ?? e}`; });
}
