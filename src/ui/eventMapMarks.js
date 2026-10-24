// @ts-check
// EVENT-TIP (2026-09-28, Mac, answering how the gate's sealed hours should read: "I also want to add a tooltip to the
// map for these type of events. I think we should fold in the raid PR in the repo, since it has a new type of world
// event also"): THE WORLD'S EVENTS ON THE HELD MAP, AND THE CARD EACH ANSWERS A HOVER WITH.
//
// Two kinds stand on the enhanced map: the Oblivion Gate's ring (WB1, ui/gate/gateMapMark.js) and a TOWN UNDER ATTACK
// (RAID1, systems/raidingParties.js) - a raided town while its raid runs: begun, not withdrawn, not cleansed. Each
// answers the pointer with a TIP: a small card at the cursor saying what it is, where, and when it ends - the words the
// chat said once, kept where the player can ask again (the field's player, looking at a ring that said only "Oblivion
// Gate", could not). The held map asks in the order the player means (ui/heldMap.js _hoverLabel): a party member, a
// raided town, a place's mark, the gate's ring (it holds an area; a town inside it answers as the town), the province.
//
// PURE. The host (scenes/world.js) hands the map FUNCTIONS - `gate` (the omen's mapMark, its tip with it) and `raids`
// (raidMapMarks over the raids' state now) - and neither map learns what a raid is. The classic region page is DFU's
// window: it draws the gate's ring, as it did, and no raids and no card (the native-window rule).
//
// Not a DFU member. Ledger A (EVENT-TIP).
import { raidActive, raidKey, raidTypeName } from '../systems/raidingParties.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';

/** The bay, when a caller does not say. */
const BAY = Object.freeze({ width: MAP_WIDTH, height: MAP_HEIGHT });

/** A raided town's mark: a crimson apart from every colour the sheet already speaks in - the gate's burning orange, the
 *  player's brick, the party's green, the selection's gold, the hubs' blue and purple. */
export const RAID_MARK_CSS = '#d8284b';
/** What the legend calls it. */
export const RAID_LEGEND_TEXT = 'Town under attack';
/** A tip's title, in the card's own words. */
export const RAID_TIP_TITLE = 'Raiding Party';
/** A tip's bounds: a title and at most this many lines, each at most this long - a host's word is text, and a card that
 *  grew past the screen would be the CARD-FIT bug again. */
export const TIP_LINES_MAX = 5;
export const TIP_TEXT_MAX = 80;
/** SEAT-TIP (FIELD BUGS 2026-10-04e): a seat's card says whole sentences - its holder's and its battle's each name two
 *  guilds and run past 80 - so its lines are bounded here instead (the card wraps them in its 320 px). */
export const SEAT_TIP_TEXT_MAX = 160;
/** TOWN-ECON (bible/06-Systems/Town-Economy-Arc.md 3): a town's card holds its economy's lines above a held seat's own
 *  four (net/townEconLaw.js townTipOf: the economy, the prices, one reason, then the guild's lines - AUDIT TOWN-ECON UI-1:
 *  a held seat's Charter line left out, its holder line naming the guild), so it is bounded here. TE3's patrons' line
 *  comes last and only where the card has room for it (townEconLaw.js TOWN_TIP_PATRONS_ROOM - AUDIT TOWN-ECON 2 LIV-3,
 *  REC-17: it had been an eighth line this bound cut). */
export const TOWN_TIP_LINES_MAX = 7;
/** How near the pointer a raided town answers, paper pixels - the location marks' own 16 (_markerAt): the raid's ring
 *  stands on the town's mark, so pointing at either is pointing at the raid. */
export const RAID_HIT_PX = 16;

/** A classic minute on the game's clock, "16:40" (the minute of its day). */
const clockText = (minute) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** A raiding party as a player reads it: "Orcs", "Bandits", "Knights" (raidTypeName's words, capitalised). */
export const raidPartyWord = (type) => { const w = raidTypeName(type); return w[0].toUpperCase() + w.slice(1); };

/**
 * The raids a map marks at `nowMinutes` (classic minutes, the raids' own clock - systems/worldTick.js worldMinutes):
 * every raid RUNNING now (raidActive: begun, not withdrawn, not cleansed) at its town's pixel, with its label and its
 * tip. The deaths are said only once some are known here (a raid another runner holds counts none on this machine).
 * @param {ReadonlyArray<any>|null|undefined} raids systems/raidingParties.js raidState().raids
 * TIME1 (bible/06-Systems/Online-Time-Arc.md section 7): online a raid's withdrawal is said in this machine's LOCAL time
 * (`localTime`: the event clock's minute as "HH:MM", or null) - the raids keep the event clock's schedule and the sky the
 * player sees turns at its own rate, so the event clock's game time would contradict the clock in front of them.
 * Offline, or with no local time to say, the game clock's, as before: offline the sky is the one clock.
 * @param {number} nowMinutes
 * FIELD BUGS 2026-10-11g RAID-WORD: `relay` (systems/raidingParties.js raidRelayState) - the town's ledger at a raid
 * relay, `{ n, tg }`; its count and target are the card's, where it has one.
 * @param {{regionName?: (r: number) => string, localTime?: ((minute: number) => string|null)|null, relay?: ((key: string) => any)|null}} [o]
 */
export function raidMapMarks(raids, nowMinutes, { regionName = () => '', localTime = null, relay = null } = {}) {
  const out = [];
  for (const r of raids ?? []) {
    if (!r || !raidActive(r, nowMinutes) || !Number.isInteger(r.px) || !Number.isInteger(r.py)) continue;
    const town = String(r.locationName ?? '') || 'A town';
    const region = String(regionName(r.regionIndex) ?? '');
    const lines = [region ? `${town}, ${region}` : town, `${raidPartyWord(r.type)} attacking`];
    // FIELD BUGS 2026-10-11g RAID-WORD: at a raid relay the town's count is the ledger's (every defender's deaths, its
    // target the day's roll of 15 to 25), not this machine's share - "20 kills, and nothing pops up" read a share
    const led = typeof relay === 'function' ? relay(raidKey(r)) : null;
    const killed = Number.isInteger(led?.n) ? led.n : r.killed;
    const target = Number.isInteger(led?.tg) && led.tg > 0 ? led.tg : r.attackAmount;
    if (killed > 0 && target > 0) lines.push(`${Math.min(killed, target)} of ${target} driven off`);
    const local = typeof localTime === 'function' ? localTime(r.endMinute) : null;
    lines.push(local ? `Withdraws at ${local} your time` : `Withdraws at ${clockText(r.endMinute)}`);
    out.push({ key: raidKey(r), px: r.px, py: r.py, label: `${town} - under attack`, tip: { title: RAID_TIP_TITLE, lines } });
  }
  return out;
}

/** A tip read and checked: a title and its lines as bounded text (each line at most `textMax` - TIP_TEXT_MAX, or a seat's
 *  SEAT_TIP_TEXT_MAX; at most `linesMax` of them - TIP_LINES_MAX, or a town's TOWN_TIP_LINES_MAX), or null for anything
 *  else. */
export function readTip(tip, { textMax = TIP_TEXT_MAX, linesMax = TIP_LINES_MAX } = {}) {
  if (!tip || typeof tip !== 'object') return null;
  const title = String(tip.title ?? '').slice(0, TIP_TEXT_MAX);
  if (!title) return null;
  const lines = (Array.isArray(tip.lines) ? tip.lines : []).slice(0, linesMax).map((l) => String(l ?? '').slice(0, textMax)).filter(Boolean);
  return Object.freeze({ title, lines: Object.freeze(lines) });
}

/** What a tip repaints on: its words. */
export const tipKey = (tip) => (tip ? `${tip.title}\n${tip.lines.join('\n')}` : '');

/**
 * The host's raids, read and checked - [] for none, a throw, or anything a map could not place (the party marks'
 * shape, ui/partyMapMarks.js readPartyMarks): each `{key, px, py, x, y, label, tip}`, x/y the pixel's centre.
 * @param {(() => any) | undefined} fn
 * @param {{width:number, height:number}} [size]
 */
export function readRaidMarks(fn, size = BAY) {
  let list = null;
  try { list = typeof fn === 'function' ? fn() : null; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const { px, py } = m;
    if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= size.width || py >= size.height) continue;
    out.push(Object.freeze({ key: String(m.key ?? `${px},${py}`), px, py, x: px + 0.5, y: py + 0.5, label: String(m.label ?? '').slice(0, TIP_TEXT_MAX), tip: readTip(m.tip) }));
  }
  return out;
}

/** What the held map repaints its raids on: where they stand and what they say. */
export const raidMarksKey = (marks) => marks.map((m) => `${m.key}@${m.px},${m.py}|${m.label}|${tipKey(m.tip)}`).join(';');

/**
 * Where a tip card stands: beside the pointer (down and right by `gap`), turned to the other side of it where the
 * viewport would cut it, and never off the viewport's edge. Pure: the card's measured size in, its corner out.
 */
export function placeTip(x, y, w, h, vw, vh, gap = 16, edge = 8) {
  let left = x + gap, top = y + gap;
  if (left + w > vw - edge) left = x - gap - w;
  if (top + h > vh - edge) top = y - gap - h;
  return { left: Math.max(edge, Math.min(left, vw - edge - w)), top: Math.max(edge, Math.min(top, vh - edge - h)) };
}
