// @ts-check
// GUIDE5 (2026-09-29, Mac: "How can we set the foundation and improve the
// quest system substantially? Like really modernize it, make it more
// accessible", then, of the Quest Guide arc: "This is your baby. Take
// your time"): THE MARKS - where a quest points, on the held map and the
// enhanced compass.
//
// ONLY WHAT THE PLAYER'S MAP ALREADY KNOWS. A mark stands exactly where
// DFU's own logbook would offer the travel map: a target with `find`
// (ui/quest/questLens.js entryTarget) - a place the entry names, on the player's
// map (the host's canFindPlace, DFU's CanFindPlace: discovered), and not
// the place the player stands in. A named place not yet on the map gets
// no mark; it gets the talk arc's answer instead, the tracker card's "Not
// on your map yet. Ask around for directions." - which is what
// Daggerfall's directions are for (06-Systems/Talk-Arc.md, THE COMPASS
// MARK: a person who knows marks it). Nothing here is the quest
// debugger's knowledge; GUIDE8's Exact tier is that, off by default.
//
// THE MAP marks every active quest's place - the one the tracker follows
// filled, the rest hollow - each answering a hover with a card: the
// quest's title, where, and the time left. THE COMPASS carries one mark,
// the tracker's quest, on the street (the gate's bearing law). The host
// resolves a place to its map pixel (scenes/world.js questPixel - the held
// map's goto law, ui/travel/travelMapWindow.js placePixelOf, read once a place
// through the host's memo: AUDIT GUIDE O3); this
// module is PURE and imports nothing of the maps or the quest machine,
// because the HUD reads its switch (GUIDE3's lesson: the HUD stays light).
//
// Not a DFU member. Ledger A (GUIDE5).

import { isEnhanced } from '../../systems/uiSkin.js';
import { getPref } from '../../systems/uiPrefs.js';
import { timeLeftWords } from './questRail.js';   // the quest faces' one phrase for the time left
import { t } from '../../systems/textManager.js';   // AUDIT OW-REVISITED L5-6: the card's own words

/** The switch's prefs key (systems/features.js row `quest-marks`). */
export const MARKS_PREF = 'questMarks';
/** A quest's ink: the journal's gold, drawn as a DIAMOND so it never reads as the selection's amber ring. */
export const QUEST_MARK_CSS = '#c9962c';
/** What the map's legend calls it. */
export const QUEST_LEGEND_TEXT = 'Quest';
/** How near the pointer a quest's mark answers, paper pixels - the location marks' own reach (the raid's, 16): the
 *  mark stands over the place's own. */
export const QUEST_HIT_PX = 16;
/** How far above the place's mark the diamond stands, paper pixels (the raid's blades stand 18 up). */
export const QUEST_MARK_LIFT = 17;
/** AUDIT GUIDE K7: ...and over a raided town, clear of the blades' reach (18 up, RAID_HIT_PX 16 about them): the diamond
 *  stands above them, so neither overprints the other and each answers its own hover. */
export const QUEST_RAID_LIFT = 42;
/** AUDIT GUIDE U16: what the legend calls the followed quest's filled diamond. */
export const QUEST_FOLLOWED_TEXT = 'Followed quest';
/** The card's bounds (ui/eventMapMarks.js TIP_LINES_MAX / TIP_TEXT_MAX, the reader every map card passes - pinned equal),
 *  and the label's (readQuestMarks): a card is built inside them, never cut by them (AUDIT GUIDE K5). */
export const QUEST_TIP_LINES = 5;
export const QUEST_TIP_TEXT = 80;
export const QUEST_LABEL_MAX = 120;

/** `head` cut at a word (with an ellipsis) so that `head + sep + tail` fits `max`; the tail - a place, a time - whole. */
function fitHead(head, tail, max, sep = ' - ') {
  const room = max - (tail ? tail.length + sep.length : 0);
  let h = String(head ?? '');
  if (h.length > room) {
    const cut = h.lastIndexOf(' ', Math.max(0, room - 1));
    h = `${h.slice(0, cut > room / 2 ? cut : Math.max(0, room - 1)).replace(/[\s,;:/-]+$/, '')}\u2026`;
  }
  return tail ? (h ? `${h}${sep}${tail}` : tail) : h;
}

/** Are the marks on? The enhanced skin, the player's switch, and a page (the herald's reason). */
export const marksOn = () => isEnhanced() && !!getPref(MARKS_PREF) && typeof document !== 'undefined';

/**
 * The marks a map draws from the tracker's last look (ui/quest/questTracker.js `views`): one per active quest whose target
 * the player's map holds (`target.find`), at the host's pixel for it - `pixelOf(find)` answers `{x, y}` or null for a
 * place it cannot place. Two quests pointing at one place are one mark (the tracked one's, else the first), which
 * names them all. `trackedId` is the tracker's quest.
 * @param {ReadonlyArray<any>|null|undefined} views
 * @param {string|null} trackedId
 * @param {(find: any) => ({x:number, y:number}|null)} pixelOf
 */
export function questMapMarks(views, trackedId, pixelOf) {
  const byPixel = new Map();
  for (const v of views ?? []) {
    const find = v?.target?.find;
    if (!find) continue;
    let p = null;
    try { p = pixelOf(find); } catch { p = null; }
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) continue;
    const key = `${p.x},${p.y}`;
    const tracked = v.id != null && v.id === trackedId;
    // AUDIT GUIDE K2: a mark says its town; each quest says its own building (the entry's, when it names one)
    const at = byPixel.get(key) ?? { px: p.x, py: p.y, town: v.words?.town || find.locationName, quests: [], tracked: false };
    at.quests.push({ title: String(v.title ?? ''), clockSeconds: v.clockSeconds, tracked, building: v.target?.buildingName ?? null, where: v.words?.where || find.locationName });
    at.tracked = at.tracked || tracked;
    byPixel.set(key, at);
  }
  const left = (q) => (Number.isFinite(q.clockSeconds) ? timeLeftWords(q.clockSeconds) : '');
  return [...byPixel.values()].map((m) => {
    // AUDIT GUIDE K5: the followed quest first - it is the one a player looks for
    const quests = [...m.quests].sort((a, b) => Number(b.tracked) - Number(a.tracked));
    const titles = quests.map((q) => q.title).filter(Boolean);
    const one = quests.length === 1;
    const place = one ? quests[0].where : m.town;
    // several: the town alone, then each quest with its own building and its time whole, as many as the card holds
    const lineOf = (q) => fitHead(q.building ? `${q.title} (${q.building})` : q.title, left(q), QUEST_TIP_TEXT);
    const room = QUEST_TIP_LINES - 1;
    const listed = quests.length <= room ? quests : quests.slice(0, room - 1);
    const more = quests.length - listed.length;
    return {
      key: `quest:${m.px},${m.py}`,
      px: m.px,
      py: m.py,
      tracked: m.tracked,
      label: titles.length ? fitHead(titles.join(' / '), place, QUEST_LABEL_MAX) : place,   // the place kept, the titles cut
      // one quest: its title, where, and the time left; several: how many, the town, and each quest
      tip: one
        ? { title: fitHead(titles[0] || QUEST_LEGEND_TEXT, '', QUEST_TIP_TEXT), lines: [fitHead(place, '', QUEST_TIP_TEXT), left(quests[0])].filter(Boolean) }
        : { title: t('quest.mark.many', '{n, plural, one {# quest} other {# quests}}', { n: quests.length }), lines: [fitHead(place, '', QUEST_TIP_TEXT), ...listed.map(lineOf), ...(more ? [t('quest.mark.more', '+{n} more', { n: more })] : [])] },   // AUDIT OW-REVISITED L5-6: in the player's language
      // AUDIT GUIDE K8: the place card names them (a keyboard or a finger that never hovers learns them there)
      quests: quests.map((q) => ({ title: q.title, left: left(q) })),
    };
  });
}

/**
 * The host's marks, read and checked - [] for none, a throw, or anything a map could not place (the raids' shape,
 * ui/eventMapMarks.js readRaidMarks): each `{key, px, py, x, y, label, tip, tracked}`, x/y the pixel's centre. The
 * tip is the host's; the map bounds it with its own reader.
 * @param {(() => any) | undefined} fn
 * @param {{width:number, height:number}} size
 */
export function readQuestMarks(fn, size) {
  let list = null;
  try { list = typeof fn === 'function' ? fn() : null; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const { px, py } = m;
    if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= size.width || py >= size.height) continue;
    const quests = (Array.isArray(m.quests) ? m.quests : []).slice(0, 12).map((q) => ({ title: String(q?.title ?? '').slice(0, QUEST_TIP_TEXT), left: String(q?.left ?? '').slice(0, 40) }));
    out.push({ key: String(m.key ?? `quest:${px},${py}`), px, py, x: px + 0.5, y: py + 0.5, tracked: !!m.tracked, label: String(m.label ?? '').slice(0, QUEST_LABEL_MAX), tip: m.tip ?? null, quests, lift: QUEST_MARK_LIFT });
  }
  return out;
}

/** What the held map repaints its quest marks on: where they stand, which is followed, and what they say. */
export const questMarksKey = (marks) => marks.map((m) => `${m.key}@${m.px},${m.py}|${m.tracked ? 1 : 0}|${m.label}`).join(';');
