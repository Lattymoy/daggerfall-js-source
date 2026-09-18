// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SOC6 (2026-09-16, Mac: "Party members should be able to be seen on
// the world map, regardless of their location") - THE PARTY'S MARKS.
//
// ONE reading of the host's `party` dep, shared by BOTH maps.
//
// The two travel maps could not be less alike - the enhanced one is a
// parchment in the player's hands with the bay inked on (ui/heldMap.js), the classic
// one is a 320x160 region page painted out of TRAV0I00's art
// (ui/travelMapWindow.js) - and neither of them should be the place
// that decides what a party member IS. So the host says it once, in
// the plainest shape it can (`party: () => [{acct, name, px, py, in,
// loc, online, leader}]`, scenes/world.js partyMarkers), and this
// module is the one reading of that shape: validate, drop what cannot
// be drawn, and hand each map a mark it can place in its own idiom.
//
// WHY A FUNCTION AND NOT A LIST. A party changes while the map is
// open - a member travels, enters a dungeon, drops offline, is
// invited, leaves - and the map may be open for a minute of real
// time. A snapshot taken at open would be a lie by the second frame,
// so the dep is a FUNCTION and both maps read it on their own refresh
// cadence. Nothing here caches.
//
// WHAT "REGARDLESS OF THEIR LOCATION" MEANS HERE. The pose the hub
// relays (net/social.js PartyPose) is composed from the player's
// TRAVEL pixel (scenes/world.js composePartyPose), which inside a
// dungeon or a building is the PLACE's own pixel, not a pixel of
// nowhere. So a member in Privateer's Hold and a member standing in
// the rain outside it mark the same map pixel, and `in` (0 outside,
// 1 dungeon, 2 building) is what tells the two apart in words. A
// member is never hidden for being indoors - that was the whole of
// Mac's sentence.
//
// WHAT IS DROPPED, AND WHY IT IS DROPPED RATHER THAN CLAMPED. A row
// whose pixel is not a real map pixel is not drawn at all. A mark
// clamped to 0,0 is a party member reported to be in the Iliac Sea
// off Northmoor; an absent one is only "not yet", which is the truth
// while a member's first pose is still in flight (net/social.js keeps
// a seat's `p` null until then, and the host omits those seats).
//
// NOT A DFU MEMBER, and nothing here is ported from anything:
// Daggerfall Unity has neither parties nor online play, so this whole
// lane belongs with the rest of the online arc (SOC1's hub, SOC2's
// picture) rather than beside a .cs file. The travel maps' own laws
// are untouched by it - a party mark is drawn OVER a page whose every
// number is still DFU's.
// ═══════════════════════════════════════════════════════════════════

import { PARTY_GREEN, PARTY_GREEN_CSS } from '../net/social.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';

/** The bay, when a caller does not say (the overworld probe stands up a small synthetic one). */
const BAY = Object.freeze({ width: MAP_WIDTH, height: MAP_HEIGHT });

/** The mark's colour, in each map's own units. The GREEN is the one green the whole slice draws a party in
 *  (net/social.js PARTY_GREEN / PARTY_GREEN_CSS - "the players name who are in a party together should turn
 *  green"); a copy of it here would be the drift a shared constant exists to prevent. */
export const PARTY_MARK_RGBA = PARTY_GREEN;
export const PARTY_MARK_CSS = PARTY_GREEN_CSS;
/** ...and OFFLINE: the same mark with the life taken out of it. A member who logged out is still worth seeing -
 *  that is where they will be when they come back - so the mark stays and goes grey rather than vanishing. */
export const PARTY_OFFLINE_RGBA = Object.freeze([0.55, 0.58, 0.55, 0.85]);

/** The byte triple the classic page's dot buffer wants, derived from the one green rather than spelled twice. */
const bytes = (rgba) => Object.freeze([Math.round(rgba[0] * 255), Math.round(rgba[1] * 255), Math.round(rgba[2] * 255)]);
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
export const PARTY_DOT_RGB = bytes(PARTY_MARK_RGBA);
export const PARTY_OFFLINE_DOT_RGB = bytes(PARTY_OFFLINE_RGBA);
/** AUDIT SOC D7: the grey the DOM wears, DERIVED from the grey the maps' buffers wear rather than typed a second
 *  time - the two had already drifted (#8c948c against the bytes' #8c928c), which is one green channel between the
 *  enhanced map's label and the classic page's dot for the very same offline seat. One source, one grey. */
export const PARTY_OFFLINE_CSS = hex(PARTY_OFFLINE_DOT_RGB);

/** What a legend calls the mark, said once so both maps and the tests agree. */
export const PARTY_LEGEND_TEXT = 'Party member';

/**
 * @typedef {{ acct: string|null, name: string, px: number, py: number, in: number, loc: string,
 *             online: boolean, leader: boolean }} PartyMark
 */

/**
 * The host's `party` dep, read once and made safe to draw.
 *
 * `party` is the dep itself - a function, or absent. ABSENT IS THE
 * ORDINARY CASE, not an error: a solo player, an offline game and
 * every host that never heard of the hub all pass no `party` at all,
 * and they must get an empty list rather than a guard at each call
 * site.
 *
 * @param {(() => any[])|null|undefined} party
 * @param {{width: number, height: number}} [size] the map's own frame (MapsFile's, unless a probe says otherwise)
 * @returns {PartyMark[]}
 */
export function readPartyMarks(party, size = BAY) {
  const rows = typeof party === 'function' ? party() : null;
  if (!Array.isArray(rows)) return [];
  const width = size?.width ?? BAY.width, height = size?.height ?? BAY.height;
  const marks = [];
  for (const r of rows) {
    if (!r) continue;
    const px = Math.floor(Number(r.px)), py = Math.floor(Number(r.py));
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    marks.push({
      acct: r.acct ?? null,
      // a nameless seat still gets a mark: WHERE they are is the thing asked for, and a blank label
      // over a green ring reads as a bug rather than as an anonymous friend
      name: String(r.name ?? '').trim() || 'Party member',
      px,
      py,
      in: r.in === 1 ? 1 : r.in === 2 ? 2 : 0,
      loc: String(r.loc ?? '').trim(),
      online: r.online !== false,
      leader: !!r.leader,
    });
  }
  return marks;
}

/** The word for where a member stands, or '' outdoors - `in` is the pose's own 0/1/2. */
export function partyPlaceWords(mark) {
  return mark?.in === 1 ? 'dungeon' : mark?.in === 2 ? 'inside' : '';
}

/** The hover line both maps say: "Name - place (dungeon)". A member in open country has no place name in their
 *  pose (composePartyPose reads the location index, which is empty between locations), so the wilderness is
 *  named rather than left as a dangling dash. */
export function partyHoverText(mark) {
  if (!mark) return '';
  const place = mark.loc || 'the wilderness';
  const kind = partyPlaceWords(mark);
  return `${mark.name} - ${place}${kind ? ` (${kind})` : ''}${mark.online ? '' : ' - offline'}`;
}

/** What the label under the mark reads: the name, and the place's kind where there is one, so a member indoors
 *  is legible without hovering (Mac's "regardless of their location", said on the map itself). */
export function partyLabelText(mark) {
  const kind = partyPlaceWords(mark);
  return kind ? `${mark.name} (${kind})` : mark.name;
}

/** A signature of the marks as DRAWN - the one thing a map must repaint for. Poses arrive on a timer whether or
 *  not anything moved (net/wire.js PARTY_SEND_MS), so a map that repainted per pose would repaint forever; a map
 *  that compares this repaints when a member actually moves, goes indoors, drops offline, joins or leaves. */
export function partyMarksKey(marks) {
  // AUDIT SOC D6: `loc` is in the signature because `loc` is DRAWN - the enhanced label's second line
  // (the ink label under the ring) and both maps' hover sentence are the place's name, so a member who walked from Daggerfall into
  // Privateers Hold WITHOUT changing map pixel (the pose carries the place's own pixel, so that happens) left a
  // label naming the town they had left. `leader` is still absent, and deliberately: no map draws it.
  return marks.map((m) => `${m.acct ?? m.name}:${m.px},${m.py},${m.in},${m.online ? 1 : 0},${m.name},${m.loc}`).join('|');
}
