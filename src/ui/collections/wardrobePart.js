// @ts-check
// COLLECTIONS-II (2026-10-22; bible/10-UI/Collections.md): THE WARDROBE'S PARTS of the Collections page - Titles, Auras,
// Icons and Glyphs, one kind a part, every thing of its kind listed whether the account holds it or not (the catalogue:
// ui/collections/wardrobeCatalogue.js), grouped by where it comes from, each row pressed open to say how it is had, whether
// it can be had now, what comes with it - and, held, worn from here as the account card wears it.
//
// THE ACCOUNT IS READ, NEVER KEPT. What is held is the service's word (ui/accountFlow.js: the wardrobe of /v1/account),
// asked once a menu visit through the flow the host hands over (`kit.account(onChange)` - the same constructor the
// account card is built by), and a Wear here is that flow's own press (equip, wearAura, wearIcon, toggleGlyph): the
// service answers, the answer replaces the wardrobe, and the name over the head, the feet and the portrait well learn it
// as they do from the card. AUDIT COLLECTIONS-II (lane 2): the read is the visit's, not the page's - leaving the page and
// coming back asks nothing (it asked on every tab press, and a press's answer landing after a new read was lost) - and
// the account card closing asks again (rereadWardrobeAccount: a wear, a sign-out or another account on the card), once
// any press of the page's own is answered. A host with no flow to give (a lab, a pin) lists the catalogue and holds
// nothing.
//
// Dressed by the kit's roles (ui/enhanced/enhancedFrame.js FRAME_ROLES): the filters are tiles, a row a list line, a row
// opened a panel, a tag a chip, Wear the kit's button - this sheet writes geometry and the words' colours alone.
import { t } from '../../systems/textManager.js';
import { titleBadge, paintTitle, glyphBadges, glyphSvgNode, TITLE_RGBA, TITLE_GRADIENT, AURA_PAINT, cssRgba } from '../playerBadge.js';
import { profileIconNode } from '../profileIcons.js';
import { inkColour, GRIMOIRE_DRESS } from '../grimoireDress.js';   // AUDIT COLLECTIONS-II (lane 3): a painted word inked on the Grimoire's page
import {
  WARDROBE_SOURCES, AVAIL_NOW, AVAIL_TAG, sourceName, wordPair, wardrobeEntries, wardrobeEntry, wardrobeName, wardrobeHeld, wardrobeWorn,
  wardrobeCounted, wardrobeKnown, wardrobeAvail, availLine, festivalUntilText,
} from './wardrobeCatalogue.js';

/** The filters, in their row's order. */
export const WARDROBE_FILTERS = Object.freeze([
  wordPair('all', () => t('coll.filter.all', 'All')),
  wordPair('held', () => t('coll.filter.held', 'Held')),
  wordPair('missing', () => t('coll.filter.missing', 'Not held')),
  wordPair('now', () => t('coll.filter.now', 'Obtainable')),
]);
/** Whether an entry passes a filter, against a wardrobe, now. Pure. */
export function wardrobeFilterPasses(/** @type {string} */ filter, /** @type {any} */ e, /** @type {any} */ wardrobe, nowMs = Date.now()) {
  if (filter === 'held') return wardrobeHeld(e.kind, e.key, wardrobe);
  if (filter === 'missing') return wardrobeKnown(e) && !wardrobeHeld(e.kind, e.key, wardrobe);   // a character's own is not "missing" from an account that never keeps it
  if (filter === 'now') return AVAIL_NOW.includes(wardrobeAvail(e, nowMs));
  return true;
}

let _filter = 'all';
let _open = /** @type {string|null} */ (null);   // the row opened whole, `kind:key`
/** @type {any} */
let _flow = null;
let _rereadOnceAnswered = false;   // the card closed while a press of the page's own was out: ask again once it is answered
let _noteKind = /** @type {string|null} */ (null);   // AUDIT COLLECTIONS-II (lane 3): the kind the flow's last word is about
/** The parts forgotten (a new visit): every row closed, the filter back to All, the account asked again next draw - the
 *  old visit's read let go, so its later answers repaint nothing. */
export function resetWardrobePart() { _filter = 'all'; _open = null; _flow = null; _rereadOnceAnswered = false; _noteKind = null; }
/** AUDIT COLLECTIONS-II (lane 2): THE ACCOUNT CARD CLOSED - what it did is the service's to say again: the visit's read
 *  asked anew (`start`: a sign-out lands on `out`, another account is read with its own session), at once while its flow
 *  is idle, else once the press in flight is answered (Home.md, ASYNC NEVER DROPS). Nothing to ask with no read yet. */
export function rereadWardrobeAccount() {
  if (!_flow) return;
  if (_flow.busy) { _rereadOnceAnswered = true; return; }
  startRead(_flow);
}
/** A read begun after the draw that asked - never inside it (a read's first word repaints, and a repaint inside a draw
 *  rebuilds the page under it). */
const startRead = (/** @type {any} */ flow) => { Promise.resolve().then(() => flow?.start?.()).catch(() => {}); };
/** A row to open (a "comes with" pressed, a landing). */
export function openWardrobeRow(/** @type {string} */ kind, /** @type {string} */ key) { _open = `${kind}:${key}`; if (_filter !== 'all') _filter = 'all'; }

/**
 * THE ACCOUNT THIS VISIT READS: the flow the host's `kit.account` builds, its first read begun after the draw that asked
 * (never inside it - a read's first word repaints, and a repaint inside a draw rebuilds the page under it), its every
 * change a repaint while it is still this visit's. Null where the host gives none.
 * @param {{ account?: (onChange: () => void) => any }} kit @param {() => void} rerender
 */
export function wardrobeAccount(kit, rerender) {
  if (_flow || typeof kit?.account !== 'function') return _flow;
  const flow = kit.account(() => {
    if (_flow !== flow) return;
    if (_rereadOnceAnswered && !flow.busy) { _rereadOnceAnswered = false; startRead(flow); }
    rerender();
  });
  _flow = flow;
  startRead(flow);
  return flow;
}
/** The wardrobe the account answered, or null (nobody signed in, the read not back, offline). */
export const wardrobeOfFlow = (/** @type {any} */ flow) => (flow?.stage === 'in' ? flow.wardrobe ?? null : null);

export const WARDROBE_PART_CSS = `
.px-sys .coll-acct { font-size: 12px; color: #b8b0a0; margin: 0 0 8px; }
.px-sys .coll-acct .said { color: #e9e4d9; }
.px-sys .coll-acct .fail { color: #ff8a78; }
.px-sys .coll-season { font-size: 12px; color: #a7e08a; margin: 0 0 8px; }
.px-sys .coll-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.px-sys .coll-filter { padding: 3px 10px; border-width: 2px; border-style: solid; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #b8b0a0; cursor: pointer; }
.px-sys .coll-filter.on { color: #f3cf86; }
.px-sys .coll-list { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 10px; }
.px-sys .coll-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 8px 6px; border-width: 0 0 1px; border-style: solid; text-align: left; cursor: pointer; }
.px-sys .coll-plate { display: inline-block; max-width: 100%; }
.px-sys .coll-word { display: inline; }
.px-sys .coll-row.nopic { grid-template-columns: minmax(0, 1fr) auto; min-height: 36px; }
.px-sys .coll-prev { display: flex; align-items: center; justify-content: center; width: 34px; height: 26px; }
.px-sys .coll-prev svg { display: block; }
.px-sys .coll-nm { min-width: 0; font-size: 14px; color: #e9e4d9; overflow-wrap: anywhere; }
.px-sys .coll-row:not(.held) .coll-prev, .px-sys .coll-row:not(.held) .coll-nm { opacity: 0.8; }
.px-sys .coll-row.on .coll-prev, .px-sys .coll-row.on .coll-nm { opacity: 1; }
.px-sys .coll-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.px-sys .coll-tag { flex: none; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 10px; line-height: 1.6; letter-spacing: 0.08em; text-transform: uppercase; color: #8b8578; white-space: nowrap; }
.px-sys .coll-tag.is-worn { color: #f3cf86; }
.px-sys .coll-tag.is-held { color: #8fc7a0; }
.px-sys .coll-tag.is-char { color: #b8b0a0; }
.px-sys .coll-tag.av-open, .px-sys .coll-tag.av-chance, .px-sys .coll-tag.av-ranked, .px-sys .coll-tag.av-patron { color: #b8b0a0; }
.px-sys .coll-tag.av-seasonal { color: #a7e08a; }
.px-sys .coll-tag.av-retired, .px-sys .coll-tag.av-closed, .px-sys .coll-tag.av-bestowed, .px-sys .coll-tag.av-staff { color: #c49a8a; }
.px-sys .coll-whole { margin: 2px 0 8px; padding: 10px 12px 12px; border-width: 2px; border-style: solid; display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; }
.px-sys .coll-text { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.px-sys .coll-show { display: flex; align-items: flex-start; justify-content: center; padding-top: 2px; }
.px-sys .coll-whole.nopic { grid-template-columns: minmax(0, 1fr); }
.px-sys .coll-text .coll-bigword { font-size: 17px; margin-bottom: 2px; overflow-wrap: anywhere; }
.px-sys .coll-foot { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.px-sys .coll-foot h5 { margin: 0; }
.px-sys .coll-whole h5 { margin: 4px 0 0; font-size: 11px; font-weight: normal; letter-spacing: 0.1em; text-transform: uppercase; color: #c08a3e; }
.px-sys .coll-whole p { margin: 0; font-size: 12px; color: #e9e4d9; }
.px-sys .coll-whole .coll-look { font-style: italic; color: #cfc6b2; }
.px-sys .coll-whole .coll-own { color: #8fc7a0; }
.px-sys .coll-whole .coll-own.no { color: #8b8578; }
.px-sys .coll-withs { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.px-sys .coll-with { padding: 2px 8px; border-width: 2px; border-style: solid; font-size: 12px; color: #e9e4d9; cursor: pointer; }
.px-sys .coll-acts { margin-top: 2px; }
.px-sys .coll-acct .coll-retry { margin-left: 8px; padding: 1px 8px; border-width: 2px; border-style: solid; font-size: 11px; }
.px-sys .coll-wear.busy { opacity: 0.6; cursor: default; }
@media (max-width: 520px) {
  .px-sys .coll-row { grid-template-columns: 30px minmax(0, 1fr); }
  .px-sys .coll-row.nopic { grid-template-columns: minmax(0, 1fr); }
  .px-sys .coll-tags { grid-column: 2; justify-content: flex-start; }
  .px-sys .coll-row.nopic .coll-tags { grid-column: 1; }
  .px-sys .coll-whole { grid-template-columns: minmax(0, 1fr); }
}
`;

/** AUDIT COLLECTIONS-II (lane 3): THE STONE THEME'S OWN - its grey ground took the painted names (Kynbane's red at 1.2:1)
 *  and the page's dim words: each name on a dark plate as wide as its letters, the words in the theme's bone, as the
 *  Holdings pages say theirs (ui/holdingsPages.js, ui/companionRoster.js). Every rule the theme's; a ground on the plate
 *  alone - never on a role the kit paints. */
export const WARDROBE_THEME_CSS = `
:root[data-plus-theme="stone"] .px-sys .coll-plate { background-color: rgba(10,12,16,0.82); padding: 1px 6px 2px; }
:root[data-plus-theme="stone"] .px-sys .coll-acct, :root[data-plus-theme="stone"] .px-sys .coll-whole .coll-own.no, :root[data-plus-theme="stone"] .px-sys .coll-part .coll-pcount, :root[data-plus-theme="stone"] .px-sys .coll-tag { color: #e2d9c4; }
:root[data-plus-theme="stone"] .px-sys .coll-whole h5 { color: #f3cf86; }
:root[data-plus-theme="stone"] .px-sys .coll-tag.is-worn { color: #f3cf86; }
:root[data-plus-theme="stone"] .px-sys .coll-tag.is-held, :root[data-plus-theme="stone"] .px-sys .coll-tag.av-seasonal { color: #b9f0a4; }
`;

/** A title's word in its own paint (the name over a head's: ui/playerBadge.js titlePaint) - an aura's in its title's.
 *  AUDIT COLLECTIONS-II (lane 3): the paint on a word as wide as its letters (an inline word in an inline-block plate) - on
 *  the row's whole cell a gradient title showed its first colour alone; and on the Grimoire's page each colour inked as the
 *  dress inks its sheets (grimoireDress.js inkColour), which never reach a paint written on the word itself. */
function paintedWord(el, /** @type {string} */ kind, /** @type {string} */ key, /** @type {string} */ cls) {
  const cell = el('span', cls);
  const plate = el('span', 'coll-plate');
  const word = el('span', 'coll-word', wardrobeName(kind, key));
  const paintKey = kind === 'title' ? key : kind === 'aura' ? AURA_PAINT[/** @type {keyof typeof AURA_PAINT} */ (key)] : null;
  if (paintKey && word.style) {
    paintTitle(word, titleBadge({ title: paintKey }));
    if (globalThis.document?.documentElement?.dataset?.plusDress === GRIMOIRE_DRESS) inkPaint(word);
  }
  plate.append(word);
  cell.append(plate);
  return cell;
}
/** A painted word's colours, each inked for the page. */
function inkPaint(/** @type {any} */ word) {
  const ink = (/** @type {string} */ s) => String(s).replace(/#[0-9a-f]{6}\b/gi, (h) => inkColour(h) ?? h);
  for (const k of ['color', 'backgroundImage', 'filter']) if (word.style[k]) word.style[k] = ink(word.style[k]);
}
/** AN AURA'S PICTURE: the ring it lights about the feet, in its title's colours (the account card's paint, AURA_PAINT) -
 *  a sign of the aura, never the aura (that is render/auraRing.js's, drawn in the world). Null with no SVG door. */
export function auraRingNode(/** @type {any} */ doc, /** @type {string} */ key, size = 32) {
  if (typeof doc?.createElementNS !== 'function') return null;
  const NS = 'http://www.w3.org/2000/svg';
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs) => { const n = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
  const paint = AURA_PAINT[/** @type {keyof typeof AURA_PAINT} */ (key)];
  const stops = TITLE_GRADIENT[/** @type {keyof typeof TITLE_GRADIENT} */ (paint)] ?? [TITLE_RGBA[/** @type {keyof typeof TITLE_RGBA} */ (paint)], TITLE_RGBA[/** @type {keyof typeof TITLE_RGBA} */ (paint)]];
  const id = `coll-aura-${key}-${++_ringSerial}`;
  const svg = node('svg', { viewBox: '0 0 40 26', width: size, height: Math.round(size * 0.65), class: 'coll-ring', 'aria-hidden': 'true' });
  const defs = node('defs', {});
  const grad = node('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '0' });
  stops.forEach((rgba, i) => grad.append(node('stop', { offset: String(stops.length > 1 ? i / (stops.length - 1) : 0), 'stop-color': cssRgba(rgba) ?? '#c08a3e' })));
  defs.append(grad);
  svg.append(defs,
    node('ellipse', { cx: 20, cy: 17, rx: 17, ry: 6.5, fill: `url(#${id})`, opacity: 0.22 }),
    node('ellipse', { cx: 20, cy: 17, rx: 15.5, ry: 5.5, fill: 'none', stroke: `url(#${id})`, 'stroke-width': 2.4 }),
    node('circle', { cx: 13, cy: 9, r: 1.4, fill: `url(#${id})`, opacity: 0.8 }),
    node('circle', { cx: 21, cy: 5, r: 1.1, fill: `url(#${id})`, opacity: 0.65 }),
    node('circle', { cx: 28, cy: 10, r: 1.6, fill: `url(#${id})`, opacity: 0.9 }));
  return svg;
}
let _ringSerial = 0;

/** A thing's picture at `size`: an aura's ring, an icon's drawing, a glyph's mark in its colour; a title has none but
 *  its painted word. */
function pictureOf(/** @type {any} */ doc, /** @type {string} */ kind, /** @type {string} */ key, size = 24) {
  if (kind === 'aura') return auraRingNode(doc, key, size + 8);
  if (kind === 'icon') return profileIconNode(doc, key, 'coll-icon', size);
  if (kind === 'glyph') {
    const g = glyphBadges({ glyphs: [key] })[0];
    const svg = g ? glyphSvgNode(doc, g, 'coll-glyph', 1.8) : null;
    if (svg) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }
    return svg;
  }
  return null;
}

/** The words of whose it is, for a thing the account holds: worn (shown, for a glyph), or held (hidden). */
function stateWord(/** @type {string} */ kind, /** @type {any} */ e, /** @type {any} */ wardrobe) {
  if (e.via) return t('coll.state.via', 'With {title}', { title: wardrobeName(kind, e.via) });
  if (wardrobeWorn(kind, e.key, wardrobe)) return kind === 'glyph' ? t('coll.state.shown', 'Shown') : t('coll.state.worn', 'Worn');
  return kind === 'glyph' ? t('coll.state.hidden', 'Hidden') : t('coll.state.held', 'Held');
}

/** The account's line over a part: what the visit's read says, or why there is nothing to say. */
function accountLine(el, /** @type {any} */ flow, /** @type {string} */ kind) {
  if (!flow) return null;
  const p = el('p', 'coll-acct');
  if (flow.stage === 'loading') p.append(el('span', null, t('coll.acct.loading', 'Reading your account…')));
  else if (flow.stage !== 'in') {
    if (flow.error) p.append(el('span', 'fail', flow.error), el('span', null, ' '));   // AUDIT COLLECTIONS-II (lane 2): why it signed out (`auth`), never swallowed
    p.append(el('span', null, t('coll.acct.out', 'Sign in from your profile to see which of these your account holds.')));
  }
  else if (!flow.wardrobe) {
    p.append(el('span', 'fail', flow.error || t('coll.acct.none', 'Your account could not be read just now.')));
    // AUDIT COLLECTIONS-II (lane 3): a read that failed is asked again here, never only by leaving the page
    const again = el('button', 'act coll-retry', t('coll.acct.retry', 'Try again'));
    again.type = 'button';
    again.setAttribute('data-focus', 'coll-retry');
    again.onclick = () => { Promise.resolve(flow.start?.()).catch(() => {}); };
    p.append(again);
  }
  else if (flow.account?.kind === 'guest') {
    // AUDIT COLLECTIONS-II (lane 1): a guest's row earns nothing but the sprout - every grant asks a registered account
    p.append(el('span', null, t('coll.acct.guest', 'A guest account keeps none of these but the sprout: add a username from your profile to earn them.')));
  } else {
    p.append(el('span', null, t('coll.acct.scope', 'Held by your account, on every character.')));
    // AUDIT COLLECTIONS-II (lane 3): a press waits in words, and its answer is said on its own kind's part alone
    if (flow.busy) p.append(el('span', null, ' '), el('span', 'said', t('coll.acct.busy', 'Asking your account…')));
    else if (flow.error && _noteKind === kind) p.append(el('span', null, ' '), el('span', 'fail', flow.error));
    else if (flow.note && _noteKind === kind) p.append(el('span', null, ' '), el('span', 'said', flow.note));
  }
  return p;
}

/**
 * A KIND'S PART into `detail`: the account's line, the festival's while one is on, the filters, then each source's rows
 * under its divider (its own "n of m"), a row opened whole beneath itself. `kit.goTo(kind)` takes the page to another
 * kind's part (a "comes with" pressed); `kit.now()` the clock the seasons are read by.
 * @param {any} detail @param {() => void} rerender @param {any} kit @param {string} kind @param {any} flow
 */
export function drawWardrobePart(detail, rerender, kit, kind, flow) {
  const { el, divider } = kit;
  const wardrobe = wardrobeOfFlow(flow);
  const now = typeof kit.now === 'function' ? kit.now() : Date.now();
  const ctx = { el, doc: kit.doc ?? (typeof document === 'undefined' ? null : document), wardrobe, flow, now, rerender, goTo: typeof kit.goTo === 'function' ? kit.goTo : () => {} };
  const line = accountLine(el, flow, kind);
  if (line) detail.append(line);
  const entries = wardrobeEntries(kind);
  const until = festivalUntilText(now);
  if (until && entries.some((e) => e.avail === 'seasonal')) detail.append(el('p', 'coll-season', t('coll.season.on', 'The Witches’ Festival is on until {date}: its pieces can be had now.', { date: until })));
  // AUDIT COLLECTIONS-II (lane 3): Held and Not held only where the account is read - unread, "Held" found nothing and
  // "Not held" listed everything
  if (!wardrobe && (_filter === 'held' || _filter === 'missing')) _filter = 'all';
  detail.append(filterRow(el, rerender, !!wardrobe));
  const shown = entries.filter((e) => wardrobeFilterPasses(_filter, e, wardrobe, now));
  if (!shown.length) { detail.append(el('p', 'px-note', t('coll.none', 'Nothing here.'))); return; }
  for (const [src] of WARDROBE_SOURCES) {
    const rows = shown.filter((e) => e.src === src);
    if (!rows.length) continue;
    const counted = entries.filter((e) => e.src === src && wardrobeCounted(e));
    const held = counted.filter((e) => wardrobeHeld(kind, e.key, wardrobe)).length;
    // AUDIT COLLECTIONS-II (lane 1): a group the account keeps none of (the seats' glyphs, each a character's) says no count
    detail.append(divider(counted.length ? t('coll.group', '{source} - {held}/{total}', { source: sourceName(src), held: wardrobe ? held : '–', total: counted.length }) : sourceName(src)));   // AUDIT COLLECTIONS-II (lane 3): a dash unread, as the tiles say
    const list = el('div', 'coll-list');
    for (const e of rows) list.append(...rowOf(ctx, e));
    detail.append(list);
  }
}

function filterRow(el, /** @type {() => void} */ rerender, /** @type {boolean} */ read) {
  const row = el('div', 'coll-filters');
  for (const [id, label] of WARDROBE_FILTERS) {
    if (!read && (id === 'held' || id === 'missing')) continue;
    const b = el('button', `coll-filter${id === _filter ? ' on' : ''}`, label());
    b.type = 'button';
    b.setAttribute('data-focus', `coll-filter-${id}`);
    b.setAttribute('aria-pressed', id === _filter ? 'true' : 'false');
    b.onclick = () => { _filter = id; rerender(); };
    row.append(b);
  }
  return row;
}

/** @typedef {{ el: Function, doc: any, wardrobe: any, flow: any, now: number, rerender: () => void, goTo: (kind: string) => void }} PartCtx */

/** One row - its picture, its name in its paint, whose it is and whether it can be had - and, opened, the whole of it.
 *  @param {PartCtx} ctx @param {any} e */
function rowOf(ctx, e) {
  const { el, wardrobe } = ctx;
  const id = `${e.kind}:${e.key}`;
  const held = wardrobeHeld(e.kind, e.key, wardrobe), worn = wardrobeWorn(e.kind, e.key, wardrobe);
  const known = wardrobeKnown(e);
  const row = el('button', `coll-row${e.kind === 'title' ? ' nopic' : ''}${held || !known ? ' held' : ''}${worn ? ' worn' : ''}${_open === id ? ' on' : ''}`);   // a character's own is never dimmed as not held
  row.type = 'button';
  row.dataset.wardrobe = id;
  row.setAttribute('data-focus', `coll-row-${e.kind}-${e.key}`);
  row.setAttribute('aria-expanded', _open === id ? 'true' : 'false');
  const pic = e.kind === 'title' ? null : pictureOf(ctx.doc, e.kind, e.key, 24);
  if (e.kind !== 'title') { const prev = el('span', 'coll-prev'); if (pic) prev.append(pic); row.append(prev); }
  // whose it is said only where it is the account's - a thing not held is the row's dimmed word, never a chip a row
  const tags = el('span', 'coll-tags');
  if (held) tags.append(el('span', `coll-tag ${worn ? 'is-worn' : 'is-held'}`, stateWord(e.kind, e, wardrobe)));
  else if (!known) tags.append(el('span', 'coll-tag is-char', t('coll.state.character', 'Per character')));
  const avail = wardrobeAvail(e, ctx.now);
  tags.append(el('span', ['coll-tag', `av-${avail}`].join(' '), AVAIL_TAG[/** @type {keyof typeof AVAIL_TAG} */ (avail)]()));
  row.append(paintedWord(el, e.kind, e.key, 'coll-nm'), tags);
  row.onclick = () => { _open = _open === id ? null : id; ctx.rerender(); if (_open) revealOpened(); };
  return _open === id ? [row, wholeOf(ctx, e)] : [row];
}

/** A row opened whole: its picture large, what it looks like (an aura), how it is had, whether it can be now, what comes
 *  with it (each a press to that thing), whose it is - and Wear, Take off, Show or Hide where the account holds it.
 *  @param {PartCtx} ctx @param {any} e */
function wholeOf(ctx, e) {
  const { el, wardrobe } = ctx;
  const pic = e.kind === 'title' ? null : pictureOf(ctx.doc, e.kind, e.key, 56);
  const box = el('div', `coll-whole${pic ? '' : ' nopic'}`);
  if (pic) { const show = el('div', 'coll-show'); show.append(pic); box.append(show); }
  const text = el('div', 'coll-text');
  text.append(paintedWord(el, e.kind, e.key, 'coll-bigword'));   // its name on top, every kind's (AUDIT COLLECTIONS-II lane 3: after a jump the row may be out of view)
  if (e.look) text.append(el('p', 'coll-look', e.look()));
  text.append(el('h5', null, t('coll.whole.how', 'How to get it')), el('p', 'coll-how', e.how()));
  text.append(el('h5', null, t('coll.whole.avail', 'Availability')), el('p', 'coll-availline', availLine(e, ctx.now)));
  const held = wardrobeHeld(e.kind, e.key, wardrobe);
  if (!wardrobeKnown(e)) text.append(el('p', 'coll-own', t('coll.whole.character', 'It shows beside the name of each member of such a guild, on that character - your account does not keep it.')));
  else if (wardrobe) text.append(el('p', `coll-own${held ? '' : ' no'}`, held ? t('coll.whole.held', 'Your account holds this.') : t('coll.whole.missing', 'Your account does not hold this yet.')));
  box.append(text);
  // AUDIT COLLECTIONS-II (lane 3): the presses in a foot across the whole box, each centred under the row - the pad steps
  // to the nearest thing along its way and twice as hard against it, so a Wear at the text's left was never reached
  const foot = el('div', 'coll-foot');
  if (e.with?.length) foot.append(el('h5', null, t('coll.whole.with', 'Comes with')), withRow(ctx, e));
  const act = held && !e.via ? wearPress(el, e, wardrobe, ctx.flow) : null;
  if (act) { const acts = el('div', 'coll-acts'); acts.append(act); foot.append(acts); }
  if (foot.children.length) box.append(foot);
  return box;
}

/** The things that come with an entry, each a press that opens it in its own part. @param {PartCtx} ctx @param {any} e */
function withRow(ctx, e) {
  const row = ctx.el('div', 'coll-withs');
  for (const w of e.with) {
    const [kind, key] = w.split(':');
    if (!wardrobeEntry(kind, key)) continue;
    const b = ctx.el('button', 'coll-with', `${WARDROBE_KIND_WORD[/** @type {keyof typeof WARDROBE_KIND_WORD} */ (kind)]()}: ${wardrobeName(kind, key)}`);
    b.type = 'button';
    b.setAttribute('data-focus', `coll-with-${kind}-${key}`);
    b.onclick = () => { openWardrobeRow(kind, key); ctx.goTo(kind); ctx.rerender(); focusRow(kind, key); };
    row.append(b);
  }
  return row;
}
/** AUDIT COLLECTIONS-II (lane 2): the keyboard's place after a "comes with" press - the row it opened, in its own part (the
 *  press itself is gone with the part it stood in, and the focus fell to the page's body). */
const focusRow = (/** @type {string} */ kind, /** @type {string} */ key) => {
  globalThis.requestAnimationFrame?.(() => {
    const row = /** @type {HTMLElement|null|undefined} */ (globalThis.document?.querySelector?.(`[data-focus="coll-row-${kind}-${key}"]`));
    row?.scrollIntoView?.({ block: 'start' });   // AUDIT COLLECTIONS-II (lane 3): the repaint kept the old part's scroll, the row 1,800px below it
    try { row?.focus?.({ preventScroll: true }); } catch { row?.focus?.(); }
  });
};
/** AUDIT COLLECTIONS-II (lane 3): a row opened at the pane's foot shows its box - the repaint keeps the scroll, and a box
 *  opened below the fold showed nothing (the journal's questReveal's law). */
const revealOpened = () => {
  globalThis.requestAnimationFrame?.(() => globalThis.document?.querySelector?.('.px-sys .coll-whole')?.scrollIntoView?.({ block: 'nearest' }));
};
/** Each kind's word, singular (a "comes with" press). */
export const WARDROBE_KIND_WORD = Object.freeze({
  title: () => t('coll.kind.title', 'Title'),
  aura: () => t('coll.kind.aura', 'Aura'),
  icon: () => t('coll.kind.icon', 'Icon'),
  glyph: () => t('coll.kind.glyph', 'Glyph'),
});

/** The press that wears it, takes it off, shows or hides it - the flow's own, its answer the service's. Null without a
 *  signed-in flow. */
function wearPress(el, /** @type {any} */ e, /** @type {any} */ wardrobe, /** @type {any} */ flow) {
  const press = { title: 'equip', aura: 'wearAura', icon: 'wearIcon', glyph: 'toggleGlyph' }[/** @type {'title'|'aura'|'icon'|'glyph'} */ (e.kind)];
  if (flow?.stage !== 'in' || typeof flow[press] !== 'function') return null;
  const worn = wardrobeWorn(e.kind, e.key, wardrobe);
  const word = e.kind === 'glyph'
    ? (worn ? t('coll.wear.hide', 'Hide') : t('coll.wear.show', 'Show'))
    : (worn ? t('coll.wear.off', 'Take off') : t('coll.wear.on', 'Wear'));
  const b = el('button', ['act', 'coll-wear', ...(flow.busy ? ['busy'] : [])].join(' '), word);
  b.type = 'button';
  // AUDIT COLLECTIONS-II (lane 2): NEVER `disabled` - a disabled button cannot take the focus back, and the keyboard and
  // the pad fell to the page's body while the press was out; it says it waits, and a press while it waits does nothing
  // (the flow refuses one too)
  b.setAttribute('aria-disabled', flow.busy ? 'true' : 'false');
  b.setAttribute('data-focus', `coll-wear-${e.kind}-${e.key}`);
  b.onclick = () => { if (flow.busy) return; _noteKind = e.kind; Promise.resolve(flow[press](e.key)).catch(() => {}); };
  return b;
}
