// @ts-check
// SD18b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD18b;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S MARKS, SEEN - its Ending and its two omens
// (net/sdMarks.js) as the gate shows the Warden's (ui/gateMarksView.js, WB9a): a row under the Remnant's bar all fight
// long, and the marks' card as a fighter steps into the Hour. The gate's own card and row draw them (one node each - the
// Hour and a court are never stood in at once); the signs are the Hour's own - the six stones' (the lion, the sun, the
// ship, the tusk, the crown of bone, the dragon) and one for each omen - drawn as paths, nothing loaded.
//
// Pure: `sdMarksViewOf` and `sdMarksCardModel` are the pins' door. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { sdEndingOf, sdOmensOf, validSdMarks, sdMarksOf } from '../net/sdMarks.js';
import { SD_STONES, SD_STONE_POS, realmToDungeon } from '../net/sdBrain.js';

/** THE SIGNS - one path each on a 24-unit box (`fill` a solid sign; the rest stroked). */
export const SD_MARK_ICONS = Object.freeze({
  daggerfall: Object.freeze({ fill: false, d: 'M12 2.5l2 2.6 3.1-1 .2 3.2 3.1 1.1-1.8 2.7 1.8 2.7-3.1 1.1-.2 3.2-3.1-1-2 2.6-2-2.6-3.1 1-.2-3.2-3.1-1.1 1.8-2.7-1.8-2.7 3.1-1.1.2-3.2 3.1 1zM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0' }),
  sentinel: Object.freeze({ fill: false, d: 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' }),
  wayrest: Object.freeze({ fill: false, d: 'M3 16h18l-3 5H6zM12 3v13M12 4l6 8h-6M12 6l-5 8h5' }),
  orsinium: Object.freeze({ fill: true, d: 'M6 21.5c0-8.5 4.2-14.8 12.5-19-3.2 5.3-4.3 10.6-3.2 19z' }),
  underking: Object.freeze({ fill: false, d: 'M3 19h18M4 19L3 7l5 5 4-8 4 8 5-5-1 12M9 15.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0M13 15.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0' }),
  blades: Object.freeze({ fill: true, d: 'M2.5 20.5c3.2-6.4 7.4-9.5 12.6-10.3L13 6l8.5 2.2-3.2 3.1c1.1 3.2 0 7.4-4.2 9.5-2.1-3.2-5.3-3.2-11.6-.3z' }),
  brazen: Object.freeze({ fill: false, d: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z' }),
  quickened: Object.freeze({ fill: false, d: 'M4 6l6 6-6 6M12 6l6 6-6 6' }),
  short: Object.freeze({ fill: false, d: 'M6 2h12M6 22h12M7 2c0 6 10 8 10 20M17 2c0 6-10 8-10 20' }),
  hardened: Object.freeze({ fill: false, d: 'M12 2l5 7-5 13-5-13zM7 9h10' }),
  burning: Object.freeze({ fill: true, d: 'M12 2c2 4-2 6 0 9 1-2 3-3 3-5 3 3 4 6 4 8a7 7 0 0 1-14 0c0-5 4-7 7-12z' }),
  fraying: Object.freeze({ fill: false, d: 'M2 12c3-5 5 5 8 0M14 12c3-5 5 5 8 0' }),
  restless: Object.freeze({ fill: false, d: 'M2 12h5l2-5 3 10 3-7 2 2h5' }),
  unending: Object.freeze({ fill: false, d: 'M7 9a3 3 0 1 0 0 6c3 0 7-6 10-6a3 3 0 1 1 0 6c-3 0-7-6-10-6z' }),
  twin: Object.freeze({ fill: false, d: 'M12 13L4 6M12 13l8-7M12 13v9' }),
});
/** The element as a player names it. */
export const SD_ELEMENT_WORD = Object.freeze({ fire: 'Fire', frost: 'Frost', shock: 'Lightning', poison: 'Poison', magic: 'Magic' });
/** HOW TO MEET EACH MARK - the card's advice (the tables' `text` says what it does). */
export const SD_MARK_TIPS = Object.freeze({
  daggerfall: 'Jump its Stomp\'s ring - it reaches the rim.',
  sentinel: 'Spread out; its brass burns long.',
  wayrest: 'Its Hand reaches three quarters round - keep a pillar near.',
  orsinium: 'It closes fast; give its Stomp a wider berth.',
  underking: 'Heal between Pulses; they come quicker.',
  blades: 'Fell gold and silver within ten seconds.',
  brazen: 'Bring more damage.',
  quickened: 'Move at the word, not the fill.',
  short: 'Fell it in twelve minutes.',
  hardened: 'Bring everyone to the Hearts.',
  burning: 'Fight clear of the brass.',
  fraying: 'Learn the gearing before you spend turns.',
  restless: 'Heal after every Pulse.',
  unending: 'Keep near the Hearts\' ring.',
  twin: 'Keep a pillar between you and the pair.',
});
const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
/** An Ending's colour on the screen: its light. */
export const sdEndingCss = (id) => hex(sdEndingOf([id, '', ''])?.light ?? [1, 0.8, 0.4]);
/** Its epithet under the Remnant's name. */
export const sdEndingEpithet = (E) => `Keeper of the Ending of ${E.stone}`;

const _views = new Map();
/**
 * THE HOUR'S MARKS AS THEY ARE SHOWN (the gate's view's shape - ui/gateMarksView.js marksViewOf - so its card and its
 * row draw them): the Ending first, its signature in its light and its element, then each omen - or null for marks that
 * are none. Made once a set of marks and kept (the bar asks every frame).
 * @param {unknown} mk
 */
export function sdMarksViewOf(mk) {
  if (!validSdMarks(mk)) return null;
  const key = /** @type {string[]} */ (mk).join(',');
  const had = _views.get(key);
  if (had) return had;
  const E = sdEndingOf(mk), el = SD_ELEMENT_WORD[E.el] ?? 'Magic', I = SD_MARK_ICONS[E.id];
  const view = Object.freeze({
    key,
    aspect: Object.freeze({ id: E.id, kind: 'aspect', name: E.sig, epithet: sdEndingEpithet(E), element: el, text: E.text,
      tip: `Resist ${el === 'Lightning' ? 'shock' : el.toLowerCase()} to blunt its own blows and brass. ${SD_MARK_TIPS[E.id]}`, color: sdEndingCss(E.id), path: I.d, fill: I.fill }),
    trials: Object.freeze(sdOmensOf(mk).map((o) => Object.freeze({ id: o.id, kind: 'trial', name: o.name, text: o.text, tip: SD_MARK_TIPS[o.id] ?? '', path: SD_MARK_ICONS[o.id].d, fill: SD_MARK_ICONS[o.id].fill }))),
  });
  _views.set(key, view);
  return view;
}
/** The omens' line under the bar (the gate's trials line). */
export const sdOmensLine = (mk) => sdOmensOf(mk).map((o) => o.name).join(' - ');

/** SD18b: THE ENDING'S STONE LIT in the Orrery's hall - the stone its Hollow keeps glowing in its light, breathing on the
 *  hall's clock (`t` seconds): `{ x, y, z, range, color }` in the dungeon's frame, for the Hour's light channel; null for a
 *  slot with no Ending. Pure. */
export const SD_STONE_LIGHT = Object.freeze({ y: 2.4, range: 9, gain: 1.8, breathe: 0.15, hz: 0.25 });
export function sdEndingStoneLight(slot, t = 0) {
  const E = slot != null ? sdEndingOf(sdMarksOf(slot)) : null;
  const k = E ? SD_STONES.findIndex((st) => st.key === E.id) : -1;
  if (k < 0) return null;
  const P = SD_STONE_POS[k], d = realmToDungeon(P.x, SD_STONE_LIGHT.y, P.z), b = SD_STONE_LIGHT.gain * (1 - SD_STONE_LIGHT.breathe + SD_STONE_LIGHT.breathe * Math.sin(t * Math.PI * 2 * SD_STONE_LIGHT.hz));
  return { x: d[0], y: d[1], z: d[2], range: SD_STONE_LIGHT.range, color: E.light.map((v) => v * b), stone: k };
}

/** The card's words, and how long it stands as a fighter steps into the Hour (the gate's own span). */
export const SD_MARKS_CARD_TEXT = Object.freeze({
  title: 'The Hour\'s Marks',
  sub: (E) => `The Brass Remnant keeps the Ending of ${E.stone}`,
});
export const SD_MARKS_ARRIVE_MS = 9000;
export const SD_MARKS_FADE_MS = 700;
/**
 * What the Hour's card shows now, or null: from the moment `since` a fighter stepped into the Hour, gone
 * SD_MARKS_ARRIVE_MS later (its last SD_MARKS_FADE_MS a fade) - the gate's card's model (ui/gateMarksView.js
 * drawGateMarksCard draws it), low on the right, clear of the crosshair.
 * @param {unknown} mk @param {{ since?: number, now?: number }} [o]
 */
export function sdMarksCardModel(mk, { since = 0, now = 0 } = {}) {
  const view = sdMarksViewOf(mk);
  if (!view) return null;
  const age = now - since;
  if (!(age >= 0) || age >= SD_MARKS_ARRIVE_MS) return null;
  const alpha = Math.min(1, age / 250, (SD_MARKS_ARRIVE_MS - age) / SD_MARKS_FADE_MS);
  return {
    mode: 'arrive', key: view.key, alpha: Math.round(alpha * 100) / 100,
    title: SD_MARKS_CARD_TEXT.title, sub: SD_MARKS_CARD_TEXT.sub(sdEndingOf(mk)),
    aspect: view.aspect, trials: view.trials,
  };
}
