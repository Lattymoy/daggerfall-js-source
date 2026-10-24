// @ts-check
// STAFF-FLATMAP (2026-10-24, mob: "did u get the flat map done?", "make sure the overwolrd map and flat map works"; design
// doc Flat map: a third in-game view, one region from above, dots red/grey, the Most urgent list) - THE FLAT MAP'S HOST,
// out of bootWorld (HOST-SPLIT): made by the staff view (scenes/staffViewHost.js) and opened with Shift+N. It watches one
// region at a time on the map's hidden link (net/staffMap.js - Hide me on, or nothing is sent and the sheet says so),
// opens on the region the staff member stands in, and steps to the previous or next one. The land is the politic map's
// own (`politicAt`, its region's map pixels against its neighbours' and the sea), each traveller a dot by their most
// urgent flag (the panel's tags, net/staffHook.js validTags), the Most urgent list beside it, and a press on either is
// the staff view's `choose` (the tag menu). What a region's room cannot say stays unsaid on the map and said in the hint:
// a player indoors or in a dungeon sends no mark (wire.js TV3).
import { CHAT_REGION_COUNT } from '../net/wire.js';
import { REGION_NAMES } from '../formats/mapsTables.js';
import { createStaffFlatMap } from '../ui/staffFlatMap.js';
import { t } from '../systems/textManager.js';

/** The politic map's size, map pixels. */
const MAP_W = 1000, MAP_H = 500;
/** A region's box is grown by this many map pixels each side, so its coast and borders show. */
const MARGIN = 4;
const RANK = Object.freeze({ high: 0, medium: 1, low: 2 });

/**
 * `map` the region map's link (net/staffMap.js createStaffMap), `politicAt(x, y)` the politic map's index at a map pixel
 * (128 + a region; under 128 the sea), `pixel()` the staff member's map pixel, `flagOf(sub)` the panel's most urgent flag
 * for an account, `words(flag)` a flag's words (staffTagWords), `choose(id, sub, name, at)` a dot's or a row's press.
 * @param {{ map: any, politicAt: (x: number, y: number) => number, pixel: () => { x: number, y: number } | null, flagOf: (sub: string|null) => any, words: (flag: any) => string, choose: (id: string, sub: string|null, name: string, at: { x: number, y: number }) => void, doc?: any, makeSheet?: typeof createStaffFlatMap }} deps
 */
export function createStaffFlatMapHost({ map, politicAt, pixel, flagOf, words, choose, doc = globalThis.document, makeSheet = createStaffFlatMap }) {
  let region = /** @type {number|null} */ (null), open = false;
  /** @type {Map<number, { x0: number, y0: number, x1: number, y1: number } | null>} */
  const boxes = new Map();
  /** A region's own box on the politic map (with a margin), found once. @param {number} r */
  function boxOf(r) {
    if (boxes.has(r)) return /** @type {any} */ (boxes.get(r));
    let x0 = MAP_W, y0 = MAP_H, x1 = -1, y1 = -1;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (politicAt(x, y) - 128 !== r) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const box = x1 < 0 ? null : { x0: Math.max(0, x0 - MARGIN), y0: Math.max(0, y0 - MARGIN), x1: Math.min(MAP_W - 1, x1 + MARGIN), y1: Math.min(MAP_H - 1, y1 + MARGIN) };
    boxes.set(r, box);
    return box;
  }
  const regionHere = () => { const p = pixel(); const r = p ? politicAt(p.x, p.y) - 128 : -1; return r >= 0 && r < CHAT_REGION_COUNT ? r : null; };
  let players = /** @type {any[]} */ ([]);
  const sheet = makeSheet({
    doc,
    onPick: (id, at) => { const p = players.find((x) => x.id === id); if (p) choose(p.id, p.sub, p.name, at); },
    onRegion: (step) => { const r = ((region ?? 0) + step + CHAT_REGION_COUNT) % CHAT_REGION_COUNT; region = r; map.pick(r); },
    onClose: () => host.toggle(),
  });
  const host = {
    /** Shift+N: open on the region the staff member stands in (else the last one), or close - the link let go with it. */
    toggle() {
      open = !open;
      if (open) { region = regionHere() ?? region ?? 0; map.pick(region); }
      else { map.pick(null); sheet.hide(); }
      return open;
    },
    isOpen: () => open,
    /** The game's frame, while open: the region's travellers as the link last heard them, most urgent first. */
    frame() {
      if (!open || region === null) return;
      const v = map.answer();
      players = (v?.region === region ? v.list : []).map((/** @type {any} */ p) => {
        const flag = flagOf(p.sub ?? null);
        return { id: p.id, sub: p.sub ?? null, name: String(p.name ?? ''), line: words(flag), level: flag?.level ?? (flag?.watch ? 'low' : ''), px: p.px, py: p.py };
      }).sort((/** @type {any} */ a, /** @type {any} */ b) => (RANK[/** @type {keyof typeof RANK} */ (a.level)] ?? 3) - (RANK[/** @type {keyof typeof RANK} */ (b.level)] ?? 3) || a.name.localeCompare(b.name));
      const state = v?.region === region ? v.state : 'connecting';
      const hint = state === 'hide' ? t('net.staffFlat.hideOff', 'Turn Hide me on (the bar at the top) to watch a region - it opens only while you are hidden.')
        : state === 'open' ? t('net.staffFlat.count', '{n, plural, one {# traveller} other {# travellers}} outdoors - indoors and dungeons send no position', { n: players.length })
          : t('net.staffFlat.connecting', 'Connecting…');
      const me = pixel();
      const box = boxOf(region);
      const inBox = me && box && me.x >= box.x0 && me.x <= box.x1 && me.y >= box.y0 && me.y <= box.y1;
      sheet.show({
        region, name: REGION_NAMES[region] ?? `#${region}`, hint, box, players, me: inBox ? { x: me.x + 0.5, y: me.y + 0.5 } : null,
        landAt: (/** @type {number} */ x, /** @type {number} */ y) => { const p = politicAt(x, y); return p - 128 === region ? 'own' : p < 128 ? 'sea' : 'other'; },
      });
    },
    dispose() { if (open) map.pick(null); open = false; sheet.dispose(); },
  };
  return host;
}
