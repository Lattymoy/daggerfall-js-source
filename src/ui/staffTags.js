// @ts-check
// STAFF-VIEW1 (2026-10-23, mob: "np player esp in staff panel?", "i need staff panel to have esp"; design doc "DFO Staff
// Panel: design", In game: the staff view - "every player has a name tag, and crowded tags group") - THE STAFF TAGS ON
// THE GROUND, the screen layer scenes/staffViewHost.js fills. render/partyPingLabels.js's shape: a fixed root at
// z-index 12 that takes no pointer, so a tag is the same size at any distance and shows through walls; each tag a button
// that does take it (a free cursor's - Y frees it on the ground, as it does for every window). One element per player,
// moved by its transform alone and its words written only when they change (ui/nameLayer.js's law), so a still frame
// writes nothing. Players this near one another on the screen are one box, "N players here", a row a player (the box
// scrolls; the host's cap holds it to STAFF_TAGS_MAX rows); past the cap a "+N". CROWD-CHIPS: a crowd shows its count
// alone, its rows while the pointer is over it or once it is clicked. One canvas, for an Admin's monster
// lines on the Overworld and a line to each flagged player (STAFF-FLAG-LINES: a report's, red), drawn again only when a line moved.
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { t } from '../systems/textManager.js';

/** The mockup's look (In game board): the name in the Ember look's cyan on a dark plate, a flag by its urgency - High
 *  red, Medium amber, Low grey; an Admin's monster lines in the enemy's red. */
export const STAFF_TAG_COLORS = Object.freeze({ name: '#7FE3F0', plate: 'rgba(16,19,23,0.86)', high: '#e0503c', medium: '#e0a43c', low: '#9a9a9a', plain: '#d8cfae', line: 'rgba(224,80,60,0.7)', review: '#ff5252' });
/** STAFF-FLAG-LINES: a line's kind (a segment's fifth number) - an Admin's monster line, a reported player's waiting on
 *  review. STAFF-LINES-REVIEW (mob, 2026-10-25: "no watch line gold show just a red review"): a watch has no line (its
 *  WATCH stays on the tag), so 1 is no kind. */
export const STAFF_LINE = Object.freeze({ monster: 0, review: 2 });
/** Each kind's pen: colour, width, glow, and whether its far end gets a dot. */
const PENS = Object.freeze({
  [STAFF_LINE.monster]: { ink: STAFF_TAG_COLORS.line, w: 1, glow: 0, dot: true },
  [STAFF_LINE.review]: { ink: STAFF_TAG_COLORS.review, w: 3, glow: 10, dot: false },
});
const ROOT_CSS = 'position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden;';
const BOX_CSS = `position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;${PIXEL_FONT_CSS}font-size:12px;line-height:1.2;color:${STAFF_TAG_COLORS.name};background:${STAFF_TAG_COLORS.plate};border:1px solid rgba(127,227,240,0.35);border-radius:3px;padding:2px 5px;text-align:center;white-space:nowrap;text-shadow:${PIXEL_TEXT_SHADOW};will-change:transform;`;
const ROW_CSS = `display:block;width:100%;pointer-events:auto;cursor:pointer;${PIXEL_FONT_CSS}font-size:12px;color:${STAFF_TAG_COLORS.name};background:none;border:0;padding:1px 0;text-align:left;white-space:nowrap;text-shadow:${PIXEL_TEXT_SHADOW};`;
const LIST_CSS = 'max-height:180px;overflow-y:auto;text-align:left;margin-top:2px;';
const MENU_CSS = `position:fixed;left:0;top:0;z-index:15;pointer-events:auto;min-width:150px;${PIXEL_FONT_CSS}font-size:12px;color:${STAFF_TAG_COLORS.name};background:rgba(16,19,23,0.94);border:1px solid rgba(127,227,240,0.45);border-radius:3px;padding:4px 8px;text-shadow:${PIXEL_TEXT_SHADOW};`;
const MENU_HEAD_CSS = 'font-weight:bold;padding-bottom:3px;margin-bottom:3px;border-bottom:1px solid rgba(127,227,240,0.25);white-space:nowrap;';
const MORE_CSS = `position:absolute;left:50%;top:8px;transform:translateX(-50%);${PIXEL_FONT_CSS}font-size:12px;color:${STAFF_TAG_COLORS.plain};background:${STAFF_TAG_COLORS.plate};padding:2px 6px;border-radius:3px;text-shadow:${PIXEL_TEXT_SHADOW};`;

/** A row's words under its name: the flag (and the host's other words) in its urgency's colour. @param {string} level */
const inkOf = (level) => STAFF_TAG_COLORS[level] ?? STAFF_TAG_COLORS.plain;

/**
 * @param {{ doc?: any, onPick: (id: string) => void }} deps
 */
export function createStaffTags({ doc = globalThis.document, onPick }) {
  if (!doc?.createElement || !doc.body) return { render() {}, strokes() {}, hide() {}, dispose() {}, size: () => 0 };
  const root = doc.createElement('div');
  root.setAttribute('data-staff-tags', '');
  root.style.cssText = ROOT_CSS;
  doc.body.append(root);
  /** @type {Map<string, any>} */
  const boxes = new Map();
  let shown = true, more = null, moreN = 0, canvas = null, lineSig = '';
  const put = (/** @type {any} */ o, /** @type {string} */ k, /** @type {any} */ v, /** @type {(v: any) => void} */ write) => { if (o[k] !== v) { o[k] = v; write(v); } };
  /** The press is the pick, and the world under it hears nothing of it (a swing, a look). */
  const pressable = (/** @type {any} */ n, /** @type {string} */ id) => {
    n.addEventListener?.('mousedown', (/** @type {any} */ e) => e.stopPropagation?.());
    n.addEventListener?.('pointerdown', (/** @type {any} */ e) => e.stopPropagation?.());
    n.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); at = { x: Number(e?.clientX) || 0, y: Number(e?.clientY) || 0 }; onPick(id); });
  };
  /** STAFF-TAG-MENU: where the last pick was pressed, the menu's corner. */
  let at = { x: 0, y: 0 };
  /** @type {any} the open menu, or null */
  let pop = null;
  const shut = () => { pop?.remove(); pop = null; };
  /** A player's two lines: the name, then the flag's words. */
  function lines2(/** @type {any} */ host) {
    const name = doc.createElement('span'), words = doc.createElement('span');
    name.style.display = 'block';
    words.style.display = 'block';
    host.append(name, words);
    return { name, words };
  }
  function write(/** @type {any} */ cache, /** @type {{ name: any, words: any }} */ el, /** @type {any} */ m) {
    put(cache, 'name', m.name, (v) => { el.name.textContent = v; });
    put(cache, 'line', m.line, (v) => { el.words.textContent = v; el.words.style.display = v ? 'block' : 'none'; });
    put(cache, 'level', m.level, (v) => { el.words.style.color = inkOf(v); });
  }
  function makeBox(/** @type {any} */ g) {
    const crowd = g.members.length > 1;
    const node = doc.createElement(crowd ? 'div' : 'button');
    node.setAttribute('data-staff-tag', g.key);
    node.style.cssText = BOX_CSS;
    root.append(node);
    if (!crowd) { pressable(node, g.members[0].id); return { node, crowd, v: {}, el: lines2(node) }; }
    const head = doc.createElement('span'), list = doc.createElement('div');
    head.style.display = 'block';
    list.style.cssText = LIST_CSS;
    node.append(head, list);
    // CROWD-CHIPS (mob: "to many ocerlapping how would we clean thaT UP"; the card's pick "Merge close boxes, count only"):
    // a crowd is its count alone - its names open while the pointer is over it, and stay open once it is clicked (a
    // second click shuts them)
    const b = { node, crowd, v: {}, head, list, rows: [], hover: false, pinned: false };
    const fit = () => { list.style.display = b.hover || b.pinned ? 'block' : 'none'; };
    fit();
    node.addEventListener?.('mouseenter', () => { b.hover = true; fit(); });
    node.addEventListener?.('mouseleave', () => { b.hover = false; fit(); });
    for (const k of ['mousedown', 'pointerdown']) head.addEventListener?.(k, (/** @type {any} */ e) => e.stopPropagation?.());
    head.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); b.pinned = !b.pinned; fit(); });
    return b;
  }
  function crowdRows(/** @type {any} */ b, /** @type {any[]} */ members) {
    put(b.v, 'head', t('net.staffView.crowd', '{n} players here', { n: members.length }), (v) => { b.head.textContent = v; });
    const key = members.map((m) => `${m.id}\u0001${m.name}\u0001${m.line}\u0001${m.level}`).join('\u0002');
    if (b.v.rows === key) return;
    b.v.rows = key;
    for (const r of b.rows) r.remove();
    b.rows = members.map((m) => {
      const row = doc.createElement('button');
      row.style.cssText = ROW_CSS;
      pressable(row, m.id);
      write({}, lines2(row), m);
      b.list.append(row);
      return row;
    });
  }
  function show(/** @type {boolean} */ on) { if (on !== shown) { shown = on; root.style.display = on ? '' : 'none'; } }
  return {
    /** This frame's tags: `groups` [{ key, x, y, members: [{ id, name, line, level }] }] (a group of one a tag, of more a
     *  crowd's box), `n` how many past the cap. @param {any[]} groups @param {number} n */
    render(groups, n) {
      show(true);
      const live = new Set();
      for (const g of groups) {
        if (!Number.isFinite(g.x) || !Number.isFinite(g.y) || !g.members?.length) continue;
        live.add(g.key);
        let b = boxes.get(g.key);
        if (b && b.crowd !== g.members.length > 1) { b.node.remove(); boxes.delete(g.key); b = null; }
        if (!b) { b = makeBox(g); boxes.set(g.key, b); }
        put(b.v, 'at', `translate(${Math.round(g.x)}px, ${Math.round(g.y)}px) translate(-50%, -100%)`, (v) => { b.node.style.transform = v; });
        if (b.crowd) crowdRows(b, g.members);
        else {
          write(b.v, b.el, g.members[0]);
          put(b.v, 'title', g.members[0].line ? `${g.members[0].name} - ${g.members[0].line}` : g.members[0].name, (v) => b.node.setAttribute('title', v));
        }
      }
      for (const [k, b] of boxes) if (!live.has(k)) { b.node.remove(); boxes.delete(k); }
      if (n > 0 && !more) { more = doc.createElement('div'); more.style.cssText = MORE_CSS; root.append(more); }
      if (more && n !== moreN) { moreN = n; more.textContent = n > 0 ? t('net.staffView.more', '+{n} more players in range', { n }) : ''; more.style.display = n > 0 ? '' : 'none'; }
    },
    /** The lines, [[x0, y0, x1, y1, kind?]] in CSS px over a `w` x `h` screen: an Admin's monster lines, each from the
     *  monster (its dot) to its owner; STAFF-FLAG-LINES (2026-10-24, mob: "need to port over my watch lines and review
     *  lines for flags in staff esp", "helps flag bad players") each player's with a report waiting on review from the
     *  screen's middle, thick and red (STAFF-LINES-REVIEW: a watch has none). Drawn again only when one moved.
     *  @param {number[][]} segs @param {number} w @param {number} h */
    strokes(segs, w, h) {
      const sig = segs.length ? `${w}x${h}|${segs.map((s) => s.map((v) => Math.round(v)).join(',')).join(';')}` : '';
      if (sig === lineSig) return;
      lineSig = sig;
      if (!canvas) { canvas = doc.createElement('canvas'); canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;'; root.append(canvas); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const g = canvas.getContext?.('2d');
      if (!g) return;
      g.clearRect(0, 0, w, h);
      g.lineCap = 'round';
      for (const kind of [STAFF_LINE.monster, STAFF_LINE.review]) {
        const pen = PENS[kind];
        g.strokeStyle = pen.ink; g.fillStyle = STAFF_TAG_COLORS.high; g.lineWidth = pen.w; g.shadowColor = pen.ink; g.shadowBlur = pen.glow;
        for (const [x0, y0, x1, y1, k = STAFF_LINE.monster] of segs) {
          if (k !== kind) continue;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
          if (pen.dot) { g.beginPath(); g.arc(x0, y0, 4, 0, Math.PI * 2); g.fill(); }
        }
      }
      g.shadowBlur = 0;
    },
    /** STAFF-TAG-MENU (2026-10-24, mob: "when u lcick on someon", "i mean the pop up"): a picked player's menu where the
     *  pick was pressed - `title` its head, `rows` [{ label, title?, run?, menu? }] (the chat line menu's own rows,
     *  scenes/chatSafetyHost.js playerActions): a row with its own `menu` opens that level in place, any other runs and
     *  closes it. A second menu replaces the first; Close shuts it. Over every staff sheet (the flat map's too), at `where`
     *  when given. @param {string} title @param {any[]} rows @param {{ x: number, y: number }} [where] */
    menu(title, rows, where = at) {
      shut();
      if (!rows?.length) return;
      pop = doc.createElement('div');
      pop.setAttribute('data-staff-menu', '');
      pop.style.cssText = `${MENU_CSS}transform:translate(${Math.round(where.x)}px, ${Math.round(where.y)}px);`;
      for (const k of ['pointerdown', 'mousedown', 'click']) pop.addEventListener?.(k, (/** @type {any} */ e) => e.stopPropagation?.());
      const fill = (/** @type {any[]} */ level) => {
        const head = doc.createElement('div');
        head.style.cssText = MENU_HEAD_CSS;
        head.textContent = title;
        const items = level.map((r) => {
          const b = doc.createElement('button');
          b.setAttribute('type', 'button');
          b.style.cssText = ROW_CSS;
          b.textContent = String(r.label ?? '');
          if (r.title) b.setAttribute('title', String(r.title));
          b.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); if (Array.isArray(r.menu)) { fill(r.menu); return; } shut(); r.run?.(); });
          return b;
        });
        const close = doc.createElement('button');
        close.setAttribute('type', 'button');
        close.setAttribute('data-staff-menu-close', '');
        close.style.cssText = `${ROW_CSS}color:${STAFF_TAG_COLORS.plain};`;
        close.textContent = t('net.staffView.close', 'Close');
        close.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); shut(); });
        pop.replaceChildren(head, ...items, close);
      };
      fill(rows);
      doc.body.append(pop);
    },
    /** Nothing shown: under a window, or the view off - the elements kept, to move again when it comes back. */
    hide() { show(false); shut(); },
    dispose() { shut(); root.remove(); boxes.clear(); },
    /** How many tags and boxes stand (the pins'). */
    size: () => boxes.size,
  };
}
