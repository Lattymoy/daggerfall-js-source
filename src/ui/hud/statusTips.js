// STATUS-TIPS (2026-10-20, Dudey: "make every other icon of debuffs, buffs, hunger etc hoverable when hovering over
// it with the mouse so it tells you in a toolbox like in the inventory what it does") - WHAT A TILE OF THE STATUS WIDGET
// SAYS UNDER THE POINTER. Pure: a tile (ui/hud/hudStatus.js statusTiles) and the entity in, a tip out -
// `{ title, meta, lines, foot }`, which ui/hud/hudTip.js draws as the pack's own hover card.
//
// A spell says what each of its effects does, from the live entries that carry its bundle (systems/effects.js - the
// entry's kind and, where it has them, its attribute and magnitude); a need says what it is and what it costs now (the
// one survival entry's attribute changes, needs.js applySurvivalMods); a disease what it wears down (diseases.js
// DISEASE_DATA's own columns). Nothing here is drawn: no colour, no node.

import { DISEASE_NAMES, DISEASE_DATA } from '../../systems/diseases.js';
import { BOON } from '../../systems/survival/needs.js';
import { t } from '../../systems/textManager.js';   // L10N4: HEARTY-MEAL's line in the player's language
import { LEVEL_WORDS } from '../../systems/survival/status.js';
import { STIFF_PENALTY } from '../../systems/survival/rest.js';
import { WILD_TEXT, zoneWord } from '../../systems/wild/wildZone.js';
import { madeLevelRule } from '../../systems/madeLevel.js';   // EVENT-RULES: what a world event's made level holds
import { REGEN_HELD_HURT_MS, regenHeldNow } from '../../systems/courtRules.js';
import { EG_POTIONS_PER_HALL } from '../eliteGates/egHud.js';
import { SD_REZ_MS } from '../../net/superDungeon/sdLaw.js';   // SD-REZ: the Hour's window for a friend's Resurrect
import { SD_REZ_PAGE_SLACK_MS } from '../../systems/superDungeon/sdSlots.js';   // AUDIT WORLD-EVENTS L1-5: the page's own part of it
import { EG_DOWN_MS } from '../../net/eliteGates/egBrain.js';   // AUDIT WORLD-EVENTS L1-4: a fall's window to be raised in (the Ketch's KT_DOWN_MS pinned equal)

/** The attributes as the sheet names them. */
export const STAT_WORDS = Object.freeze({
  strength: 'Strength', intelligence: 'Intelligence', willpower: 'Willpower', agility: 'Agility',
  endurance: 'Endurance', personality: 'Personality', speed: 'Speed', luck: 'Luck',
});
const statWord = (k) => STAT_WORDS[k] ?? String(k ?? '');
/** ElementalResistance's subtypes (DFU ElementTypes order for the resist family). */
const RESIST_WORDS = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic']);

/** The words for a tile's frame kind. */
export const TIP_KIND_WORDS = Object.freeze({
  buff: 'Buff', debuff: 'Debuff', set: 'Set power', warn: 'Need', danger: 'Need', more: 'More effects',
});

/** What one live effect entry does, in a sentence - or null for an entry that says nothing a player can use. */
export const ENTRY_WORDS = Object.freeze({
  fortifyAttribute: (a) => (Number.isFinite(a.magnitude) ? `Raises ${statWord(a.stat)} by ${a.magnitude}.` : `Raises ${statWord(a.stat)}.`),
  drainAttribute: (a) => (Number.isFinite(a.magnitude) ? `Lowers ${statWord(a.stat)} by ${a.magnitude}.` : `Lowers ${statWord(a.stat)}.`),
  transferAttribute: (a) => `Takes ${statWord(a.stat)} from you.`,
  continuousDamage: () => 'Damages your health every round.',
  continuousDamageFatigue: () => 'Drains your fatigue every round.',
  continuousDamageSpellPoints: () => 'Drains your magicka every round.',
  regenerate: () => (regenHeldNow() ? t('madeRules.regenTip', 'Restores health every round - held here: half, and none for {s} seconds after you are hurt.', { s: REGEN_HELD_HURT_MS / 1000 }) : 'Restores health every round.'),   // EVENT-RULES: never a promise the place breaks
  paralyze: () => 'You cannot move.',
  shield: (a) => (Number.isFinite(a.shieldRemaining) ? `Absorbs ${Math.max(0, Math.round(a.shieldRemaining))} more damage.` : 'Absorbs damage.'),
  elementalResistance: (a) => `Resists ${RESIST_WORDS[a.element] ?? 'the element'}${Number.isFinite(a.chance) ? ` (${a.chance}% chance)` : ''}.`,
  slowfall: () => 'You fall slowly and take no damage from a fall.',
  waterWalking: () => 'You can walk on water.',
  waterBreathing: () => 'You can breathe under water.',
  levitate: () => 'You float and can move through the air.',
  chameleonNormal: () => 'You blend in: enemies find it harder to see you.',
  chameleonTrue: () => 'You blend in: enemies find it harder to see you.',
  invisNormal: () => 'You are invisible.',
  invisTrue: () => 'You are invisible.',
  shadeNormal: () => 'You are a shade: enemies find it harder to see you.',
  shadeTrue: () => 'You are a shade: enemies find it harder to see you.',
  freeAction: () => 'You cannot be paralyzed.',
  jumping: () => 'You jump higher.',
  climbing: () => 'You climb more easily.',
  detectMagic: () => 'Shows magic items nearby on your compass.',
  detectEnemy: () => 'Shows enemies nearby on your compass.',
  detectTreasure: () => 'Shows treasure nearby on your compass.',
  silenced: () => 'You cannot cast spells.',
  light: () => 'A light follows you.',
  soulTrap: () => 'A creature that dies under it gives up its soul to an empty soul gem.',
  openArmed: () => null,
  lockArmed: () => null,
});
/** An entry kind with no sentence of its own, said from its name ("waterWalkingSilent" - "Water walking silent"). */
export const kindSaid = (kind) => {
  const s = String(kind ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}.` : null;
};

/** The sentences a spell's live entries say - each once, in their order. */
export function spellTipLines(entity, bundleId) {
  const out = [];
  if (bundleId == null) return out;
  for (const a of entity?.activeEffects ?? []) {
    if (!a || a.ended || a.bundleId !== bundleId || a.instant) continue;
    const say = Object.hasOwn(ENTRY_WORDS, a.kind) ? ENTRY_WORDS[a.kind](a) : kindSaid(a.kind);
    if (say && !out.includes(say)) out.push(say);
  }
  return out;
}

/** A disease's columns in words: what it wears down each day. */
export function diseaseLines(id) {
  const d = DISEASE_DATA[id];
  if (!d) return [];
  const stats = [['STR', 'strength'], ['INT', 'intelligence'], ['WIL', 'willpower'], ['AGI', 'agility'], ['END', 'endurance'],
    ['PER', 'personality'], ['SPD', 'speed'], ['LUC', 'luck']].filter(([c]) => d[c]).map(([, k]) => statWord(k));
  const pools = [['HEA', 'health'], ['FAT', 'fatigue'], ['SPL', 'magicka']].filter(([c]) => d[c]).map(([, w]) => w);
  const all = [...stats, ...pools];
  const list = all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}` : all[0] ?? '';
  return [
    list ? `Each day it wears down your ${list}.` : 'It wears you down each day.',
    'A temple healer, a potion or a Cure Disease spell cures it.',
  ];
}

/** A need's own words, by its key (survival/status.js survivalHudChips). */
const NEED_LINES = Object.freeze({
  hunger: 'Your body needs food. Eat something to ease it.',
  thirst: 'Your body needs water. Drink to ease it.',
  sleep: 'You need sleep. Rest in a bed or by a fire.',
  wet: 'Your clothes are wet. A fire or dry weather dries them, and wet clothes let the cold in.',
  temp: 'How hot or cold you feel. Clothing, shelter and a fire change it.',
  stiff: `A rough night left you stiff: Speed and Agility are ${STIFF_PENALTY} lower until it wears off.`,
  drunk: 'Lowers Agility, Intelligence, Willpower and Speed, and makes you a little friendlier.',
});
/** A boon's own words (needs.js BOON's numbers, and the hearth's). */
function boonLines(id) {
  if (id === 'hearth') return ['A lit fire close by gives back fatigue while you are awake.'];
  if (id === 'meal') return [t('survival.boon.mealTip', 'A hearty tavern meal: you stay fed and your thirst is held while it lasts.')];   // HEARTY-MEAL (survival/needs.js)
  const b = BOON[id];
  if (!b) return [];
  return [`${Object.entries(b).map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${statWord(k)}`).join(', ')}.`];
}
/** What every felt need takes from the attributes right now (the one survival entry), or null. */
export function needCostLine(entity) {
  const e = (entity?.activeEffects ?? []).find((a) => a?.kind === 'survival');
  const mods = Object.entries(e?.statMods ?? {}).filter(([, n]) => n);
  if (!mods.length) return null;
  return `Your needs now: ${mods.map(([k, n]) => `${statWord(k)} ${n > 0 ? '+' : ''}${n}`).join(', ')}.`;
}

/**
 * THE TIP for one tile. `extra` the widget's own words: `endHint` (the right-click to end a spell, where it may be
 * ended), `setLine(tile)` (a set power's tier in words - the HUD's, which knows the worn sets).
 * @param {any} tile  @param {any} entity  @param {{ endHint?: string, setLine?: (tile: any) => string|null }} [extra]
 */
export function statusTip(tile, entity, extra = {}) {
  if (!tile) return null;
  const meta = TIP_KIND_WORDS[tile.kind] ?? '';
  const lines = [];
  let foot = null;
  let title = String(tile.name ?? '');
  if (tile.key === 'more') {
    return { title, meta, lines: ['Not every effect fits on the screen. Make room or open your character sheet to see them all.'], foot: null };
  }
  if (tile.key === 'wild') {
    title = WILD_TEXT.chip;
    lines.push(String(tile.name ?? ''), zoneWord('chipTip'));   // ETHER-WILD: the ground's own tip (the sea's past the Veil)
    return { title, meta: 'Zone', lines, foot: tile.foot ? `Ring ${tile.foot}` : null };
  }
  if (tile.key === 'rules') {   // EVENT-RULES: the made level's rules, every one it holds
    lines.push(...madeRulesLines(tile.level));
    return { title, meta: t('madeRules.meta', 'Event rules'), lines, foot: tile.foot ? t('madeRules.foot', 'Regeneration resumes in {foot}', { foot: tile.foot }) : null };
  }
  if (tile.key === 'rested') {
    lines.push('You have slept through a night. This is how long until another night of sleep counts.');
    return { title, meta, lines, foot: tile.foot ? `${tile.foot} left` : null };
  }
  if (tile.key === 'poison') {
    lines.push('Poison is in your blood and works on you over time.', 'A Cure Poison spell or potion stops it.');
    return { title, meta, lines, foot: null };
  }
  if (tile.key === 'bleed') {
    lines.push('An open wound: you lose health with each tick.');
    return { title, meta, lines, foot: tile.foot ? `${tile.foot} ticks left` : null };
  }
  if (String(tile.key).startsWith('disease:')) {
    const id = Number(String(tile.key).slice(8));
    title = DISEASE_NAMES[id] ?? title;
    lines.push(...diseaseLines(id));
    return { title, meta: 'Disease', lines, foot: null };
  }
  if (String(tile.key).startsWith('need:')) {
    const k = String(tile.key).slice(5);
    if (k.startsWith('boon:')) {
      lines.push(...boonLines(k.slice(5)));
      return { title, meta: 'Boon', lines, foot: tile.foot ? `${tile.foot} left` : null };
    }
    if (NEED_LINES[k]) lines.push(NEED_LINES[k]);
    const level = tile.kind === 'danger' ? LEVEL_WORDS.danger : LEVEL_WORDS.warn;
    lines.push(`${level.charAt(0).toUpperCase()}${level.slice(1)}.`);
    const cost = needCostLine(entity);
    if (cost) lines.push(cost);
    return { title, meta, lines, foot: tile.foot && /\//.test(tile.foot) ? `Stage ${tile.foot}` : null };
  }
  if (String(tile.key).startsWith('set:')) {
    const said = extra.setLine?.(tile) ?? null;
    if (said) lines.push(said);
    lines.push(tile.recovering ? 'Recovering.' : 'Active.');
    return { title, meta: tile.set === 'technique' ? 'Weapon technique' : meta, lines, foot: tile.foot ? (tile.recovering ? `Ready in ${tile.foot}` : tile.foot) : null };
  }
  if (String(tile.key).startsWith('spell')) {
    lines.push(...spellTipLines(entity, tile.bundle));
    if (!lines.length) lines.push(tile.kind === 'buff' ? 'A spell on you.' : 'A spell cast on you.');
    if (tile.item) foot = 'Lasts while you wear the item.';
    else if (tile.foot) foot = `${tile.foot} ${tile.foot === '1' ? 'round' : 'rounds'} left`;
    if (tile.endable && extra.endHint) lines.push(extra.endHint);
    return { title, meta, lines, foot };
  }
  return { title, meta, lines, foot: tile.foot ?? null };
}

// ── EVENT-RULES: a world event's rules, said (2026-10-25) ─────────────────────────────────────────────────────────────
// The owner: "A lot of people are unhappy with the world event restrictions including the regen not working". The made
// levels (systems/madeLevel.js - the Burning Court, the Shattered Hour, the Spire, the Sky-Ketch) each hold a handful of
// the game's ways, and said so only as each was refused - a regeneration not at all. Now one tile stands first on the
// status widget while the player stands in one (ui/enhanced/enhancedHud.js), its name the place's, its tip every rule
// the place holds in plain words off the law's own table, and its foot the regeneration's pause while it runs.

/** The places, as the tile names them. */
export const MADE_LEVEL_PLACE = Object.freeze({
  court: () => t('madeRules.place.court', 'The Burning Court'),
  hour: () => t('madeRules.place.hour', 'The Shattered Hour'),
  spire: () => t('madeRules.place.spire', 'The Spire'),
  ketch: () => t('madeRules.place.ketch', 'The Sky-Ketch'),
});

/** Every rule a made level holds, in the law's order, as a player reads it - none for no level. Pure but for the language.
 *  @param {string|null|undefined} level @returns {string[]} */
export function madeRulesLines(level) {
  const r = (k) => madeLevelRule(level, k);
  if (!level || !Object.hasOwn(MADE_LEVEL_PLACE, level)) return [];
  const out = [];
  if (r('regen') === 'held') out.push(t('madeRules.regen', 'Regeneration heals at half strength, and not at all for {s} seconds after you are hurt.', { s: REGEN_HELD_HURT_MS / 1000 }));
  if (r('save') === 'refused' && r('rest') === 'refused') out.push(t('madeRules.noSaveRest', 'No saving and no resting.'));
  if (r('automap') === 'off') out.push(t('madeRules.noMap', 'No map.'));
  if (r('mark') === 'refused') out.push(r('recall') === 'refused' ? t('madeRules.noMarkRecall', 'Mark and Recall do not work here.') : t('madeRules.noMark', 'Mark does not work here.'));
  if (r('portalStone') === 'refused') out.push(t('madeRules.noPortal', 'No Portal Stone.'));
  if (r('companions') === 'out') out.push(t('madeRules.companions', 'Companions wait outside.'));
  if (r('potions') === 'counted') out.push(t('madeRules.potions', '{n} restoring potions a hall.', { n: EG_POTIONS_PER_HALL }));
  if (r('levitate') === 'banned') out.push(r('slowfall') === 'banned' ? t('madeRules.noFlightFall', 'No Levitate and no Slowfall.') : t('madeRules.noFlight', 'No Levitate.'));
  if (r('techFlight') === 'refused') out.push(t('madeRules.techFlight', 'A weapon technique cannot carry you over a gap.'));
  if (r('runLeap') === 'refused') out.push(t('madeRules.runLeap', 'No running leap: every gap is a plain jump.'));
  if (r('avoidDeath') === 'refused') out.push(t('madeRules.avoidDeath', 'Stendarr\'s mercy does not reach here.'));
  if (r('unstuck') === 'refused') out.push(t('madeRules.noUnstuck', 'No /unstuck.'));   // AUDIT WORLD-EVENTS L5-14: every rule the place holds - this one was never said
  if (r('unstuck') === 'wayHome') out.push(t('madeRules.unstuckHome', '/unstuck takes you out by the way home.'));
  const death = r('death');
  if (death === 'castOut') out.push(t('madeRules.castOut', 'A death casts you out before the gate.'));
  if (death === 'final') out.push(t('madeRules.finalIn', 'A death is final for this Abyss Dungeon - unless a party member raises you within {s} seconds.', { s: (SD_REZ_MS - SD_REZ_PAGE_SLACK_MS) / 1000 }));   // AUDIT WORLD-EVENTS L1-5: the page's minute, the body's (it said two minutes; the body was gone at one)
  if (death === 'fall') out.push(t('madeRules.fallDown', 'A death lays you down for {s} seconds: a party member can raise you there. Past it, you fall.', { s: EG_DOWN_MS / 1000 }));   // AUDIT WORLD-EVENTS L1-4: raise before the fall (the Spire's and the Ketch's window, one minute each)
  if (r('deathPenalty') === 'none') out.push(t('madeRules.noPenalty', 'A death costs you no gold.'));
  return out;
}

/** The made level's tile, or null for none: the place's name, and the regeneration's pause at its foot while it runs.
 *  @param {string|null|undefined} level @param {number} pausedMs @returns {{ level: string, name: string, foot: string|null }|null} */
export function madeRulesTile(level, pausedMs = 0) {
  if (!level || !Object.hasOwn(MADE_LEVEL_PLACE, level)) return null;
  return { level, name: MADE_LEVEL_PLACE[/** @type {'court'|'hour'|'spire'|'ketch'} */ (level)](), foot: pausedMs > 0 ? `${Math.ceil(pausedMs / 1000)}s` : null };
}
