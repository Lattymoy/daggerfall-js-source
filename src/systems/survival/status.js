// SURV5 - WHAT THE PLAYER IS TOLD: the HUD's needs strip and the
// status page's survival lines, PURE - both read the record
// (survival/needs.js) and say it in words. The mod's AdviceText
// (read off the DLL: "You could do with a decent meal.", "You are
// invigorated from your last meal.", "You are drunk." / "You are very
// drunk.", "You have no need for food or sleep." for a vampire) was a
// third message box chained after DFU's two status boxes; the port
// chains the same way (healthStatus.js's ActionTextBox.addNext) and
// keeps the words its own, plus a HUD strip the mod never had - one
// chip a need, shown only while the need is felt.
import { survivalOf, hungerStage, thirstStage, sleepStage, wetStage, hungerMinutes, NEED, BOON, warmedByFire, wakingHeld, heartyMealLeft } from './needs.js';   // HEARTY-MEAL: the tavern meal's hold
import { t } from '../textManager.js';   // L10N4: the Well Fed tile's word in the player's language
import { STAT_KEYS_ORDER } from '../statMods.js';   // AUDIT SURV-BOONS C11: the attributes, named as the sheet names them
import { temperatureWord, signedDegrees } from './temperature.js';
import { isStiff } from './rest.js';
import { SURVIVAL_RULES, SURVIVAL_DEFAULT } from './difficulty.js';   // AUDIT C&C S5: the tier a chip's level is read by

/** The chip's words, a need's stage each. AUDIT C&C S5: words alone - a chip's level ('warn' felt, 'danger' costing you)
 *  is the LIVE tier's (needLevel, below), never the table's: the table's Casual levels painted Hard's costing Tired, Warm
 *  and Stiff amber, and a Drenched red that costs nothing of its own. */
export const HUD_NEED_WORDS = Object.freeze({
  hunger: Object.freeze({ peckish: 'Peckish', hungry: 'Hungry', starving: 'Starving' }),
  thirst: Object.freeze({ thirsty: 'Thirsty', parched: 'Parched', dehydrated: 'Dehydrated' }),
  sleep: Object.freeze({ tired: 'Tired', drowsy: 'Drowsy', exhausted: 'Exhausted' }),
  wet: Object.freeze({ damp: 'Damp', wet: 'Wet', soaked: 'Soaked', drenched: 'Drenched' }),
  // AUDIT SURV-TIERS (the third pass): and Warm, the Cold's twin - Hard charges from twenty either way, and a warm day
  // drained six a minute under an empty strip while the same band's cold said Cold
  temp: Object.freeze({ warm: 'Warm', hot: 'Hot', scorching: 'Scorching', cold: 'Cold', freezing: 'Freezing', 'deadly cold': 'Deadly cold' }),
});
/**
 * AUDIT C&C S5 (2026-10-12, decisions D1 and D2): RED MEANS IT COSTS - IN THE TIER THAT IS LIVE. A need's chip, the HUD's
 * temperature plate and the pack's plaque are red exactly where the live tier's minute law charges for the stage
 * (needs.js survivalMinute's stamina, survivalStatMods' attributes) and amber where it is only felt - the one law the
 * three read. A tier whose needs may take stamina (`stamina.floor` short of the whole pool: Casual, Hard) charges a
 * Starving, a Parched or Dehydrated, an Exhausted and a felt reading at or past its band (`hotFrom` / `coldFrom`: Hard's
 * twenty either way - a Warm of 20 or a Cold of -20 is red there, of 19 amber - Casual's red words), unless a lit fire
 * answers the cold (`warmed` - needs.js warmedByFire: AUDIT SURV-TIERS, the third pass, beside a fire the strip had
 * said Deadly cold in red while nothing was charged); a tier that takes attributes (Hard - which takes stamina too)
 * charges the sleep from Tired and the stiff morning; Boons charges nothing, so none of it is red. DRENCHED IS AMBER in
 * every tier: its cost comes through the felt temperature, which has its own chip. The drink's two are the drink's
 * (survivalHudChips).
 */
export function needLevel(key, stage, { rules = null, felt = 0, warmed = false, held = false } = {}) {
  const r = rules ?? SURVIVAL_RULES[SURVIVAL_DEFAULT];
  const tires = r.stamina.floor < 1, takes = !!r.attributes;
  if (key === 'hunger') return tires && stage === 'starving' ? 'danger' : 'warn';
  if (key === 'thirst') return tires && (stage === 'parched' || stage === 'dehydrated') ? 'danger' : 'warn';
  // AUDIT C&C (S5, REST6): and never while the Waking Salts hold the sleep's penalties and its drain (`held`) - it costs nothing
  if (key === 'sleep') return !held && (takes || (tires && stage === 'exhausted')) ? 'danger' : 'warn';
  if (key === 'temp') return tires && !warmed && (felt >= r.stamina.hotFrom || felt <= r.stamina.coldFrom) ? 'danger' : 'warn';
  if (key === 'stiff') return takes ? 'danger' : 'warn';
  return 'warn';   // the wet
}
/** AUDIT C&C S14: A LEVEL IN WORDS, for a reader who cannot tell the amber from the red - a need's tile, the HUD's
 *  temperature plate and the pack's plaque say it on their title and label, and a costing one carries a mark (the
 *  sheets' `!`): the colour was the only thing that said a reading costs. */
export const LEVEL_WORDS = Object.freeze({ danger: 'it costs you', warn: 'no cost to you yet' });
/** "Freezing - it costs you"; the word alone where its level says nothing of a cost (comfortable, a boon). */
export const levelSaid = (word, level) => (Object.hasOwn(LEVEL_WORDS, level) ? `${word} - ${LEVEL_WORDS[level]}` : word);
/**
 * SURV-BOONS (2026-10-12): A BOON'S CHIP - its word and the glyph it stands on (ui/hud/hudStatus.js STATUS_GLYPHS): the need's
 * own for the need it rewards, a flame for the hearth (its own - REST1's Next night is the campfire), a sparkle for
 * Thriving. The strip reads them off the record's `boons` (needs.js survivalBoons, written by the minute law), so it
 * shows what the body has, in a rewarding tier (Boons), where nothing costs - so no need's chip there is red (RED MEANS
 * IT COSTS). The drink is the exception it is in every tier: its swing is the drink's.
 */
/** HEARTY-MEAL: the tavern meal's tile, keyed among the boons' tiles (`boon:meal`) - its words and its glyph - but never
 *  one of the minute law's boons (HUD_BOON_WORDS), which no tier grants it. */
export const HEARTY_MEAL_CHIP = 'meal';
export const heartyMealWord = () => t('survival.boon.meal', 'Well Fed');
export const HEARTY_MEAL_GLYPH = 'hunger';
export const HUD_BOON_WORDS = Object.freeze({
  fed: Object.freeze(['Well fed', 'hunger']), quenched: Object.freeze(['Quenched', 'thirst']), rested: Object.freeze(['Well rested', 'sleep']),
  thriving: Object.freeze(['Thriving', 'thriving']), hearth: Object.freeze(['Hearth', 'hearth']),   // AUDIT SURV-BOONS C7: its own flame - REST1's Next night is the campfire, and the two stood side by side
});
/** The tier a reader reads the record by: the LIVE tier's rules where the reader knows them (AUDIT SURV-BOONS C14: the
 *  HUD, the pack and - AUDIT C&C S11 - the Status page hand `rules` in, survival/switch.js survivalRules, so a turn of
 *  the tier shows at once and not a game minute later); else the record's word for it - a record that carries the
 *  minute law's `boons` is a rewarding tier's (Boons), any other a tier that costs, read as the gentlest of them,
 *  Casual. BOONS-DEFAULT (2026-10-13): that was "the default tier's" while the default was Casual - with Boons the
 *  default it would have read a record no rewarding tier wrote as Boons. */
const tierOf = (s, rules) => rules ?? (Array.isArray(s.boons) ? SURVIVAL_RULES.boons : SURVIVAL_RULES.casual);
/** The record's own word that a lit fire answered its last minute's cold (the minute law's `s.warmed`). */
const warmedBy = (s, word) => !!s.warmed && (word === 'cold' || word === 'freezing' || word === 'deadly cold');

/** NEED-TIER (2026-10-02, Mac: "the debuffs you get from Climates and Calories no longer show the severity (how much
 *  hunger your character has etc)"): a felt need's stage on its own ladder - read off the chips' table, mildest first;
 *  the temperature's two ways each a ladder of their own - so the tile's foot can say "2/3" where its word has no room. */
const COLD_WORDS = Object.freeze(['cold', 'freezing', 'deadly cold']);   // AUDIT NEED-TIER: the cold way named, not the table's second half by place
const NEED_LADDERS = Object.freeze({
  hunger: Object.keys(HUD_NEED_WORDS.hunger), thirst: Object.keys(HUD_NEED_WORDS.thirst), sleep: Object.keys(HUD_NEED_WORDS.sleep), wet: Object.keys(HUD_NEED_WORDS.wet),
  warm: Object.keys(HUD_NEED_WORDS.temp).filter((w) => !COLD_WORDS.includes(w)), cold: COLD_WORDS,
});
const needLadder = (key, stage) => (key === 'temp' ? (NEED_LADDERS.cold.includes(stage) ? NEED_LADDERS.cold : NEED_LADDERS.warm) : NEED_LADDERS[key]);

/** The strip's chips: [{ key, text, level, tier?, of? }] - empty when every need is met; `tier` of `of` is how bad
 *  (NEED-TIER), absent on a need with one stage (Stiff). `rules` the live tier's (tierOf); `live` the HUD's live reading
 *  (env.js feltNow), the temperature's. */
export function survivalHudChips(entity, now, { vampire = false, endurance = 50, rules = null, live = null } = {}) {
  if (!entity?.survival) return [];
  const s = survivalOf(entity, now);
  const tier = tierOf(s, rules);
  const out = [];
  const push = (key, table, stage, at = {}) => {
    const text = table[stage];
    if (!text) return;
    const ladder = needLadder(key, stage);
    out.push({ key, text, level: needLevel(key, stage, { rules: tier, ...at }), tier: ladder.indexOf(stage) + 1, of: ladder.length });
  };
  if (!vampire) push('hunger', HUD_NEED_WORDS.hunger, hungerStage(hungerMinutes(s, now)));   // AUDIT SURV C: no need for food or sleep
  if (!vampire) push('thirst', HUD_NEED_WORDS.thirst, thirstStage(s.thirst));   // AUDIT SURV-TIERS (the third pass): nor drink - the law freezes it, and its red chip never cost
  if (!vampire) push('sleep', HUD_NEED_WORDS.sleep, sleepStage(s.sleepDebt), { held: wakingHeld(s, now) });
  push('wet', HUD_NEED_WORDS.wet, wetStage(s.wet));
  // AUDIT C&C S9 (decision D3): ONE TEMPERATURE READING ON THE HUD - the live one the plate shows, where the HUD hands it
  // in (env.js feltNow), its fire read off the live air (needs.js warmedByFire); the record's last minute with no feed.
  // The chip read the record and the plate the live air, and for up to a game minute the strip said Freezing beside a
  // plate's -51 Deadly cold, and a step to a fire left the plate red until the minute turned
  const felt = live ? live.felt : s.felt;
  if (Number.isFinite(felt)) {
    const word = temperatureWord(felt);
    push('temp', HUD_NEED_WORDS.temp, word, { felt, warmed: live ? warmedByFire(tier, live.env, felt) : warmedBy(s, word) });
  }
  if (isStiff(s, now)) out.push({ key: 'stiff', text: 'Stiff', level: needLevel('stiff', 'stiff', { rules: tier }) });
  // HEARTY-MEAL (needs.js): a tavern meal's Well Fed hold - a buff in EVERY tier (it is the meal's, not a tier's reward),
  // the hunger's glyph, its hours left on its foot; in a rewarding tier it stands in for the Well fed boon it outlasts
  const meal = vampire ? 0 : heartyMealLeft(s, now);
  const mealChip = meal > 0 ? { key: `boon:${HEARTY_MEAL_CHIP}`, text: heartyMealWord(), level: 'boon', glyph: HEARTY_MEAL_GLYPH, foot: `${Math.ceil(meal / 60)}h` } : null;
  // AUDIT SURV C/D: the page's own bands (the mod's LiveEndurance / 2 and - 10), not a hard forty
  // AUDIT SURV-BOONS C6: before the boons, so the one red Boons keeps is never the first tile a full band folds away
  const drunk = s.drunk > endurance / 2 ? { key: 'drunk', text: s.drunk > endurance - 10 ? 'Very drunk' : 'Drunk', level: s.drunk > endurance - 10 ? 'danger' : 'warn', tier: s.drunk > endurance - 10 ? 2 : 1, of: 2 } : null;
  // SURV-BOONS: in a rewarding tier no need costs, so none is red (needLevel - the drink's swing is the drink's, and
  // stays); the boons follow, green (level 'boon')
  if (tier.boons) {
    if (drunk) out.push(drunk);
    if (mealChip) out.push(mealChip);
    for (const id of Array.isArray(s.boons) ? s.boons : []) {
      const w = HUD_BOON_WORDS[id];
      if (!w || (mealChip && id === 'fed')) continue;
      const chip = { key: `boon:${id}`, text: w[0], level: 'boon', glyph: w[1] };
      if (id === 'rested' && s.wellRested > 0) chip.foot = `${Math.ceil(s.wellRested / 60)}h`;   // the bank's hours left
      out.push(chip);
    }
  } else {
    if (drunk) out.push(drunk);
    if (mealChip) out.push(mealChip);
  }
  return out;
}

/**
 * TEMP-UI (2026-10-12, the owner: "add a temperature widget to the UI"): THE HUD'S TEMPERATURE PLATE, as data - a felt
 * reading (`felt`: the live one the HUD and the pack read, env.js feltNow - AUDIT C&C S9; the record's last minute,
 * `s.felt`, by default), its word, and the SAME level the strip's temperature chip wears (needLevel: RED MEANS IT COSTS,
 * in the live tier - `rules`; the fire read off the live air, `env`, where the reader hands it in, else the record's
 * `s.warmed`; the comfortable band 'ok'), the way it runs ('cold', 'hot', or 'mild' for comfortable) and where it
 * stands on the plate's scale (`at`, 0..1 over TEMP_SCALE, clamped - the deadly cold and the scorching are past its
 * ends). Null with no reading yet. Pure: the HUD draws it, test/systems/survival/tempui.test.js holds it to the chip.
 */
export const TEMP_SCALE = Object.freeze({ min: -60, max: 60 });
export function temperatureReadout(entity, felt = entity?.survival?.felt, { rules = null, env = null } = {}) {
  if (!Number.isFinite(felt)) return null;
  const s = entity?.survival && typeof entity.survival === 'object' ? entity.survival : {};
  const tier = tierOf(s, rules);
  const word = temperatureWord(felt);
  const label = HUD_NEED_WORDS.temp[word] ?? null;
  const warmed = env ? warmedByFire(tier, env, felt) : warmedBy(s, word);
  const level = label ? needLevel('temp', word, { rules: tier, felt, warmed }) : 'ok';
  const at = Math.min(1, Math.max(0, (felt - TEMP_SCALE.min) / (TEMP_SCALE.max - TEMP_SCALE.min)));
  return { felt, text: signedDegrees(felt), word, label: label ?? 'Comfortable', level, side: COLD_WORDS.includes(word) ? 'cold' : label ? 'hot' : 'mild', warmed, at };
}

/** AUDIT SURV-BOONS C13: what a boon gives, in words - the page's line and the Stats side's row say it through this one
 *  helper: the attributes as the sheet names them, in its order (C11), or the hearth's stamina. */
export function boonEffect(id) {
  if (id === 'hearth') return 'regain stamina beside a lit fire';
  return BOON[id] ? STAT_KEYS_ORDER.filter((k) => BOON[id][k]).map((k) => `+${BOON[id][k]} ${k[0].toUpperCase()}${k.slice(1)}`).join(', ') : '';
}
/** The hours a Well rested bank has left, whole, said singular at one (C10): "12 hours", "1 hour" - '' with none. */
export function restedLeft(s) {
  const h = Math.ceil(Math.max(0, s?.wellRested ?? 0) / 60);
  return h > 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '';
}

export const STATUS_TEXT = Object.freeze({
  hunger: Object.freeze({
    fed: 'You are well fed.', peckish: 'You could eat.', hungry: 'You could do with a decent meal.', starving: 'You are starving.',
  }),
  thirst: Object.freeze({ fine: 'You are not thirsty.', thirsty: 'You are thirsty.', parched: 'You are parched.', dehydrated: 'You are dehydrated.' }),
  sleep: Object.freeze({ rested: 'You are well rested.', tired: 'You are tired.', drowsy: 'You are drowsy.', exhausted: 'You are exhausted.' }),
  notTired: 'You are not tired.',   // AUDIT SURV-BOONS C5/D12: Boons' 'rested' stage with no bank - "well rested" is the boon's word there, and the page said it beside a strip with no Well rested
  wet: Object.freeze({ dry: null, damp: 'Your clothes are damp.', wet: 'Your clothes are wet.', soaked: 'You are soaked through.', drenched: 'You are drenched.' }),
  temp: (word) => (word === 'comfortable' ? 'You are comfortable.' : `You feel ${word}.`),
  // TEMP-UI: the number under the word - in plain characters, which every font the box is drawn in carries (no degree
  // sign: the classic's own faces have none), with the comfortable band it is read against
  felt: (felt) => `Felt temperature: ${signedDegrees(felt).replace('\u00b0', '')} (comfortable from -10 to +10).`,
  warmedByFire: 'The fire keeps the cold at bay.',
  stiff: 'You are stiff and sore from a hard night.',   // AUDIT SURV-TIERS (the third pass): the ground's or the tavern floor's (a Hard blackout)
  drunk: 'You are drunk.', veryDrunk: 'You are very drunk.',
  vampire: 'You have no need for food or sleep.',
  invigorated: 'You are invigorated from your last meal.',
  // SURV-BOONS: a boon's line - its word and what it gives, read off needs.js BOON (never restated), the attributes named
  // as the sheet names them (AUDIT SURV-BOONS C11) in the sheet's order; the hearth's own. Plain characters: the
  // classic's faces draw this box (TEMP-UI's felt line says why).
  boon: (id) => {
    if (id === 'hearth') return 'The fire\'s warmth restores your stamina.';
    const w = HUD_BOON_WORDS[id]?.[0];
    if (!w || !BOON[id]) return null;
    return `${w}: ${boonEffect(id)}.`;
  },
  // AUDIT C&C (lens S): Well rested's bank, a line of its own - the hours whole and singular at one (C10). The classic
  // box sizes itself to its widest line and never wraps (DaggerfallMessageBox), centred on a 320-pixel screen, and the
  // one line that said both ran 59 characters, past the felt line's 53 (STATUS_LINE_MAX).
  restedFor: (s) => (restedLeft(s) ? `Rested for another ${restedLeft(s)}.` : null),
});
/** AUDIT C&C (lens S): the widest a line of the status page's third box may run - the felt line's longest ("Felt
 *  temperature: -120 (comfortable from -10 to +10)."), which the classic box has drawn since TEMP-UI. The box takes its
 *  width from its widest line and wraps nothing, so every line the needs can say is held to it. */
export const STATUS_LINE_MAX = 53;

/**
 * The status page's third box: one line a need (the vampire's one line
 * in the needs' place - AUDIT SURV-BOONS C12: and then the body's
 * wet, temperature, drink and hearth, as the strip shows them). `endurance` is the live stat for the drunk words (the
 * mod's LiveEndurance / 2 and - 10 bands); `rules` the live tier's (tierOf - AUDIT C&C S11: the page's row builder,
 * ui/statusBox.js, reads it once).
 */
export function survivalStatusLines(entity, now, { vampire = false, endurance = 50, rules = null } = {}) {
  const s = survivalOf(entity, now);
  const kept = !!tierOf(s, rules).boons;
  const boons = kept && Array.isArray(s.boons) ? s.boons : [];
  const lines = [];
  if (vampire) lines.push(STATUS_TEXT.vampire);
  else {
    const hunger = hungerStage(hungerMinutes(s, now));
    lines.push(hunger === 'fed' && hungerMinutes(s, now) < NEED.PECKISH_AT / 2 ? STATUS_TEXT.invigorated : STATUS_TEXT.hunger[hunger]);
    lines.push(STATUS_TEXT.thirst[thirstStage(s.thirst)]);
    const sleep = sleepStage(s.sleepDebt);
    lines.push(sleep === 'rested' && kept && !boons.includes('rested') ? STATUS_TEXT.notTired : STATUS_TEXT.sleep[sleep]);   // AUDIT SURV-BOONS C5/D12
  }
  // AUDIT SURV-BOONS C12: and a vampire's body is still wet or dry, warm or cold, drunk or sober, and by a fire - the
  // strip said so while the page said only that it needs no food or sleep
  const wet = STATUS_TEXT.wet[wetStage(s.wet)];
  if (wet) lines.push(wet);
  if (Number.isFinite(s.felt)) { const word = temperatureWord(s.felt); lines.push(warmedBy(s, word) ? STATUS_TEXT.warmedByFire : STATUS_TEXT.temp(word), STATUS_TEXT.felt(s.felt)); }   // TEMP-UI: and its number
  if (isStiff(s, now)) lines.push(STATUS_TEXT.stiff);
  if (s.drunk > endurance / 2) lines.push(s.drunk > endurance - 10 ? STATUS_TEXT.veryDrunk : STATUS_TEXT.drunk);
  for (const id of boons) lines.push(STATUS_TEXT.boon(id), id === 'rested' ? STATUS_TEXT.restedFor(s) : null);   // SURV-BOONS: what the body has earned - AUDIT C&C: the bank's hours after it
  return lines.filter(Boolean);
}
/** The box's rows, in the hosts' `{ text, center }` shape. */
export const survivalStatusRows = (entity, now, opts) => survivalStatusLines(entity, now, opts).map((text) => ({ text, center: true }));
