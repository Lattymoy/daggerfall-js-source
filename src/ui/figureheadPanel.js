// @ts-check
// FIGUREHEAD (2026-10-30; bible/03-World/Naval-Refit.md FIGUREHEAD) - THE FIGUREHEAD PANEL on a ship's Fleet card
// (ui/fleetPage.js shipCard): the carving drawn as it will stand, in her trim paint, a button a carving and None, then
// Carve, Remove or Close. Its open card is kept here, not in the page's one `_open`: a panel the page opens shuts this
// one (`carvingShut`), and opening this one shuts the page's.
import { FIGUREHEADS, figureheadOfCode } from '../systems/naval/figurehead.js';
import { paintedCarving } from '../world/ships/figureheadModels.js';
import { recordRgb } from '../world/ships/figureheadArt.js';
import { t } from '../systems/textManager.js';

/** @type {Record<string, () => string>} */
const CARVING_WORDS = {
  dragon: () => t('naval.figurehead.c.dragon', 'Dragon'), serpent: () => t('naval.figurehead.c.serpent', 'Sea serpent'),
  lion: () => t('naval.figurehead.c.lion', 'Lion'), eagle: () => t('naval.figurehead.c.eagle', 'Eagle'),
  wolf: () => t('naval.figurehead.c.wolf', 'Wolf'), maiden: () => t('naval.figurehead.c.maiden', 'Crowned maiden'),
  horse: () => t('naval.figurehead.c.horse', 'Horse'), dreugh: () => t('naval.figurehead.c.dreugh', 'Dreugh'),
};
/** A carving's name (0: None). */
export const carvingName = (n) => { const id = FIGUREHEADS[figureheadOfCode(n)]; return id ? CARVING_WORDS[id]() : t('naval.figurehead.none', 'None'); };

const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
/** The light the picture is shaded by, from her starboard bow and above (unit). */
const LIGHT = (() => { const l = [0.55, 0.62, 0.56], n = Math.hypot(...l); return l.map((v) => v / n); })();
const _svgs = new Map();
/**
 * A CARVING'S PICTURE: its own mesh (world/ships/figureheadModels.js) seen from her starboard bow, each face its record's
 * colour shaded by LIGHT, drawn far to near - in `paint` (0 gilt as built). '' for none. Pure SVG, made once a pair.
 */
export function carvingSvg(n, paint, { width = 150 } = {}) {
  const id = FIGUREHEADS[figureheadOfCode(n)];
  if (!id) return '';
  const key = `${id}|${paint | 0}|${width}`;
  if (_svgs.has(key)) return _svgs.get(key);
  const m = paintedCarving(id, paint | 0);
  const yaw = -0.6, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const view = (x, z) => [x * cy - z * sy, x * sy + z * cy];   // turned about up: [depth toward the eye, across the picture]
  const tris = [];
  for (const s of m.subMeshes) {
    const rgb = recordRgb(s.textureRecord);
    for (let i = s.startIndex; i < s.startIndex + s.primitiveCount * 3; i += 3) {
      const at = [0, 1, 2].map((k) => { const v = m.indices[i + k] * 3; return [m.positions[v], m.positions[v + 1], m.positions[v + 2]]; });
      const nv = m.indices[i] * 3, nx = m.normals[nv], ny = m.normals[nv + 1], nz = m.normals[nv + 2];
      if (view(nx, nz)[0] <= 0) continue;   // facing away
      const lit = 0.4 + 0.6 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const pts = at.map((p) => { const [d, a] = view(p[0], p[2]); return [a, -p[1], d]; });
      tris.push({ pts, depth: (pts[0][2] + pts[1][2] + pts[2][2]) / 3, fill: `#${rgb.map((v) => hex2(v * lit)).join('')}` });
    }
  }
  tris.sort((a, b) => a.depth - b.depth);
  const xs = tris.flatMap((q) => q.pts.map((p) => p[0])), ys = tris.flatMap((q) => q.pts.map((p) => p[1]));
  const x0 = Math.min(...xs) - 0.04, y0 = Math.min(...ys) - 0.04, w = Math.max(...xs) + 0.04 - x0, h = Math.max(...ys) + 0.04 - y0;
  const f = (v) => v.toFixed(3);
  const body = tris.map((q) => `<path d="M${q.pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z" fill="${q.fill}" stroke="${q.fill}" stroke-width="0.004"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" width="${width}" height="${Math.round((width * h) / w)}" role="img" aria-label="${carvingName(n)}">${body}</svg>`;
  _svgs.set(key, svg);
  return svg;
}

let _open = null;   // the uid whose panel is open
let _pick = null;   // the carving chosen while it is open
/** Whether `uid`'s panel is open. */
export const carvingOpen = (uid) => _open != null && _open === uid;
/** Its panel opened (shut if it was open) - its choice as she wears it. */
export function toggleCarving(uid) { _open = carvingOpen(uid) ? null : uid; _pick = null; }
/** Shut, whatever was chosen (another panel opened, the page mounted again). */
export function carvingShut() { _open = null; _pick = null; }

/**
 * THE PANEL for ship row `s` (scenes/fleetHost.js model's: `figurehead`, `carvingPaint`): her carving drawn, a button a
 * carving, and Carve, Remove or Close - `act('figurehead', n)` sets it (0 takes it down).
 * @param {(tag: string, cls?: string, text?: string) => any} el @param {any} s @param {() => void} rerender
 * @param {(verb: string, arg?: any) => void} act @param {Function} button the page's button maker
 */
export function carvingPanel(el, s, rerender, act, button) {
  const box = el('div', 'hld-text hld-colours');
  const chosen = _pick ?? s.figurehead ?? 0;
  const pic = el('div', 'hld-flag');
  pic.setAttribute('aria-label', t('naval.figurehead.preview', 'Figurehead preview'));
  pic.innerHTML = carvingSvg(chosen, s.carvingPaint ?? 0, { width: 120 });
  box.append(pic);
  const row = el('div', 'hld-acts');
  row.setAttribute?.('role', 'radiogroup');
  row.setAttribute?.('aria-label', t('naval.figurehead.open', 'Figurehead'));
  for (let n = 0; n < FIGUREHEADS.length; n++) row.append(button(el, carvingName(n), null, () => { _pick = n; rerender(); }, n === chosen ? 'act primary' : 'act'));
  box.append(row);
  box.append(el('span', 'hld-sub', t('naval.figurehead.note', 'Free. It takes the ship\'s trim paint, or gilt. Other players see it.')));
  const acts = el('div', 'hld-acts');
  acts.append(button(el, t('naval.figurehead.apply', 'Carve figurehead'), null, () => { const n = chosen; carvingShut(); act('figurehead', n); }, 'act primary'));
  if (s.figurehead) acts.append(button(el, t('naval.figurehead.remove', 'Remove figurehead'), null, () => { carvingShut(); act('figurehead', 0); }));
  acts.append(button(el, t('naval.flag.close', 'Close'), null, () => { carvingShut(); rerender(); }));
  box.append(acts);
  return box;
}
