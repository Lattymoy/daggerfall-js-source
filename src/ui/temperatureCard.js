// TEMP-UI (2026-10-12, the owner: "add a tempurature widget to the UI including allowing players to see their personal
// tempurature in their inventory") - THE PACK'S TEMPERATURE (enhanced pack only; the classic window keeps DFU's own
// window untouched - THE NATIVE-WINDOW RULE - and says the number on the Status page, survival/status.js).
//
// Three places, one reading:
//   - THE PLAQUE on the figure, top right of its column where the Armour plaque stands top left (under it where the
//     figure is too narrow for both - AUDIT C&C S1): the felt temperature and its word, in the strip's colours, with
//     what makes it on its title;
//   - THE CARD'S COMPARISON under a wearable's stats: the felt temperature now and as it would be in it - or, for a
//     piece already worn, without it - green where it brings the reading toward the comfortable band, red where away;
//   - THE STATS SIDE's Temperature section (ui/statsCard.js): every part that makes the number, one row each, adding up
//     to it.
//
// THE READING IS LIVE, NOT THE RECORD'S. The record's `felt` is the last game minute's, and the pack is often a paused
// window: a cloak put on under it would wait for the next minute to show. So the pack asks survival/env.js feltNow -
// the minute law's own sum (feltTemperature over needs.js feltCtx) where the body last stood - over the slots as they
// are, or as a wear would leave them (ui/armourCard.js wearComparison's `worn`, its wardrobe through modsForSlots). The
// HUD reads the same live reading - its plate and, AUDIT C&C S9, the strip's chip - each level the live tier's and its
// fire the live air's (survival/status.js temperatureReadout, needs.js warmedByFire), so the pack and the HUD say one thing.
import { survivalOn } from '../systems/survival/switch.js';
import { feltNow } from '../systems/survival/env.js';
import { temperatureBreakdown, signedDegrees } from '../systems/survival/temperature.js';
import { temperatureReadout, HUD_BOON_WORDS, boonEffect, restedLeft, levelSaid } from '../systems/survival/status.js';
import { survivalRules } from '../systems/survival/switch.js';
import { equipTableOf, isEquipped } from '../systems/equip.js';
import { modsForSlots } from './armourCard.js';

const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The comfortable band's edges (survival/temperature.js temperatureWord: comfortable from -10 to +10, both kept). */
export const COMFORT = Object.freeze({ low: -10, high: 10 });
/** How far a reading stands outside the comfortable band, in degrees - nought inside it. */
export const discomfort = (felt) => Math.max(0, COMFORT.low - felt, felt - COMFORT.high);
const BAND_TEXT = `comfortable from ${signedDegrees(COMFORT.low)} to ${signedDegrees(COMFORT.high)}`;

/**
 * THE PACK'S READING of `entity`: temperatureReadout's plate over the live felt temperature (the level, the word and the
 * way it runs, as the strip would wear them), its parts (temperature.js temperatureBreakdown) and the env it was read in
 * - or the record's last minute with no parts where the needs have not run in this session yet. Null with Climates &
 * Calories Off, or with no reading at all.
 */
export function packTemperature(entity) {
  if (!survivalOn() || !entity) return null;
  const t = feltNow(entity);
  if (t) {
    const r = temperatureReadout(entity, t.felt, { rules: survivalRules(), env: t.env });   // AUDIT C&C S5/S9: the live tier's level, the live air's fire
    return r ? { ...r, rows: temperatureBreakdown(t.env, t), live: true } : null;
  }
  const r = temperatureReadout(entity, undefined, { rules: survivalRules() });
  return r ? { ...r, rows: [], live: false } : null;
}

/** A breakdown as lines of text - the plaque's title: "Mountains -40", "Clothing +12 (+16 dry)", ... */
export const breakdownLines = (rows) => rows.map((r) => `${r.label} ${signedDegrees(r.value)}${r.note ? ` (${r.note})` : ''}`);

/** THE PLAQUE: "Felt" over the reading, coloured by the way it runs and framed by its level; its title the whole sum.
 *  Null where packTemperature is. */
export function temperaturePlaque(entity) {
  const r = packTemperature(entity);
  if (!r) return null;
  const n = el('div', 'worntemp-total');
  n.dataset.side = r.side;
  n.dataset.level = r.level;
  n.append(el('span', 'k', 'Felt'), el('span', 'v', r.text));
  const sum = breakdownLines(r.rows);
  // AUDIT C&C S14: and whether it costs, in words - its frame's colour said it alone
  n.title = `Felt temperature ${r.text}: ${levelSaid(r.label.toLowerCase(), r.level)} (${BAND_TEXT})${sum.length ? `\n${sum.join('\n')}` : ''}`;
  n.setAttribute('aria-label', `Felt temperature ${r.text}, ${levelSaid(r.label, r.level)}`);
  return n;
}

/**
 * WHAT A WEAR WOULD DO TO THE FELT TEMPERATURE - `{ label, before, after }` (live readings) for `item`: a piece not
 * worn, as wearing it would leave the table (`wear`, the card's one wearComparison - null where no wear is read), and a
 * piece worn, as taking it off would. Null with the arc Off, no feed, or a change under a degree (a ring, a sword).
 */
export function temperatureWear(entity, item, wear = null) {
  if (!survivalOn() || !entity || !item) return null;
  const before = feltNow(entity);
  if (!before) return null;
  let slots, label;
  if (isEquipped(item)) {
    slots = [...equipTableOf(entity)].map((it) => (it === item ? null : it));
    label = 'Without it';
  } else {
    if (!wear?.worn) return null;
    slots = wear.worn;
    label = 'Wearing it';
  }
  const after = feltNow(entity, { worn: slots, mods: modsForSlots(entity, slots) });
  if (!after || Math.round(after.felt) === Math.round(before.felt)) return null;
  return { label, before, after };
}

/** THE CARD'S COMPARISON BLOCK (the AC-COMPARE block's shape, `.cmp`): the reading now and after with their words, and
 *  the change - green toward the comfortable band, red away from it. Null where temperatureWear is. */
export function temperatureCompareBlock(entity, item, wear = null) {
  const w = temperatureWear(entity, item, wear);
  if (!w) return null;
  const a = temperatureReadout(entity, w.before.felt), b = temperatureReadout(entity, w.after.felt);   // the number and its word (no level is drawn here)
  const box = el('div', 'cmp tcmp');
  box.append(el('p', 'cmp-head', 'Temperature'));
  const dl = el('dl', 'stats cmp-rows');
  const g = el('div', 'pair');
  const dd = el('dd');
  dd.append(el('span', 'cmp-v', `${a.text} ${a.label} → ${b.text} ${b.label}`));
  const change = Math.round(w.after.felt) - Math.round(w.before.felt);
  const better = discomfort(w.after.felt) < discomfort(w.before.felt), worse = discomfort(w.after.felt) > discomfort(w.before.felt);
  dd.append(el('span', `cmp-d ${better ? 'up' : worse ? 'down' : 'same'}`, signedDegrees(change)));
  g.append(el('dt', null, w.label), dd);
  dl.append(g);
  box.append(dl);
  box.title = `The temperature you feel here, now and ${w.label === 'Without it' ? 'with it off' : 'wearing it'} (${BAND_TEXT}).`;
  return box;
}

/** THE STATS SIDE'S ROWS: [label, value text, title] - every part of the live sum and the total. Empty where
 *  packTemperature has no parts (Off, or before the needs have run). */
export function temperatureStatRows(entity) {
  const r = packTemperature(entity);
  if (!r || !r.rows.length) return [];
  return [
    ...r.rows.map((x) => [x.label, `${signedDegrees(x.value)}${x.note ? ` (${x.note})` : ''}`, null]),
    [`= Felt (${r.label.toLowerCase()})`, r.text, `The lines above added together (${BAND_TEXT}).`],
  ];
}

/** AUDIT SURV-BOONS C13: THE STATS SIDE'S BOONS - [name, what it gives] for each boon the body has, in Boons (nothing in
 *  any other tier): the attributes a sheet shows raised are explained where the sheet is. */
export function boonStatRows(entity) {
  if (!survivalOn() || !survivalRules()?.boons) return [];
  const s = entity?.survival;
  const ids = Array.isArray(s?.boons) ? s.boons : [];
  return ids.filter((id) => HUD_BOON_WORDS[id]).map((id) => [HUD_BOON_WORDS[id][0], `${boonEffect(id)}${id === 'rested' && restedLeft(s) ? ` (${restedLeft(s)} left)` : ''}`]);
}

