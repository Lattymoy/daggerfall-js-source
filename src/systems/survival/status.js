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
import { survivalOf, hungerStage, thirstStage, sleepStage, wetStage, hungerMinutes, NEED } from './needs.js';
import { temperatureWord } from './temperature.js';
import { isStiff } from './rest.js';

/** The chip's severity: 'warn' is felt, 'danger' is costing you (SURV-TIERS: in Casual, a red NEED's stamina, lent - difficulty.js; Drenched is red as a warning and costs through the felt temperature, and the drink's swing starts at its amber Drunk). */
export const HUD_NEED_WORDS = Object.freeze({
  hunger: Object.freeze({ peckish: ['Peckish', 'warn'], hungry: ['Hungry', 'warn'], starving: ['Starving', 'danger'] }),
  thirst: Object.freeze({ thirsty: ['Thirsty', 'warn'], parched: ['Parched', 'danger'], dehydrated: ['Dehydrated', 'danger'] }),
  sleep: Object.freeze({ tired: ['Tired', 'warn'], drowsy: ['Drowsy', 'warn'], exhausted: ['Exhausted', 'danger'] }),
  wet: Object.freeze({ damp: ['Damp', 'warn'], wet: ['Wet', 'warn'], soaked: ['Soaked', 'warn'], drenched: ['Drenched', 'danger'] }),
  // AUDIT SURV-TIERS (the third pass): and Warm, the Cold's twin - Hard charges from twenty either way, and a warm day
  // drained six a minute under an empty strip while the same band's cold said Cold
  temp: Object.freeze({ warm: ['Warm', 'warn'], hot: ['Hot', 'warn'], scorching: ['Scorching', 'danger'], cold: ['Cold', 'warn'], freezing: ['Freezing', 'danger'], 'deadly cold': ['Deadly cold', 'danger'] }),
});
/** AUDIT SURV-TIERS (the third pass): the cold a lit fire answers (a tier whose `fireWarms` says so - Casual; the
 *  minute law's `s.warmed`) is felt, not paid, so its chip is the amber of a felt need - the same word, RED MEANS
 *  IT COSTS kept - and the page says what the fire does. Beside the fire the strip had said Deadly cold in red while
 *  nothing was charged and the pool refilled. */
const warmedBy = (s, word) => !!s.warmed && (word === 'cold' || word === 'freezing' || word === 'deadly cold');

/** The strip's chips: [{ key, text, level }] - empty when every need is met. */
export function survivalHudChips(entity, now, { vampire = false, endurance = 50 } = {}) {
  if (!entity?.survival) return [];
  const s = survivalOf(entity, now);
  const out = [];
  const push = (key, table, stage) => { const w = table[stage]; if (w) out.push({ key, text: w[0], level: w[1] }); };
  if (!vampire) push('hunger', HUD_NEED_WORDS.hunger, hungerStage(hungerMinutes(s, now)));   // AUDIT SURV C: no need for food or sleep
  if (!vampire) push('thirst', HUD_NEED_WORDS.thirst, thirstStage(s.thirst));   // AUDIT SURV-TIERS (the third pass): nor drink - the law freezes it, and its red chip never cost
  if (!vampire) push('sleep', HUD_NEED_WORDS.sleep, sleepStage(s.sleepDebt));
  push('wet', HUD_NEED_WORDS.wet, wetStage(s.wet));
  if (Number.isFinite(s.felt)) {
    const word = temperatureWord(s.felt);
    push('temp', HUD_NEED_WORDS.temp, word);
    if (warmedBy(s, word) && out.at(-1)?.key === 'temp') out.at(-1).level = 'warn';
  }
  if (isStiff(s, now)) out.push({ key: 'stiff', text: 'Stiff', level: 'warn' });
  // AUDIT SURV C/D: the page's own bands (the mod's LiveEndurance / 2 and - 10), not a hard forty
  if (s.drunk > endurance / 2) out.push({ key: 'drunk', text: s.drunk > endurance - 10 ? 'Very drunk' : 'Drunk', level: s.drunk > endurance - 10 ? 'danger' : 'warn' });
  return out;
}

export const STATUS_TEXT = Object.freeze({
  hunger: Object.freeze({
    fed: 'You are well fed.', peckish: 'You could eat.', hungry: 'You could do with a decent meal.', starving: 'You are starving.',
  }),
  thirst: Object.freeze({ fine: 'You are not thirsty.', thirsty: 'You are thirsty.', parched: 'You are parched.', dehydrated: 'You are dehydrated.' }),
  sleep: Object.freeze({ rested: 'You are well rested.', tired: 'You are tired.', drowsy: 'You are drowsy.', exhausted: 'You are exhausted.' }),
  wet: Object.freeze({ dry: null, damp: 'Your clothes are damp.', wet: 'Your clothes are wet.', soaked: 'You are soaked through.', drenched: 'You are drenched.' }),
  temp: (word) => (word === 'comfortable' ? 'You are comfortable.' : `You feel ${word}.`),
  warmedByFire: 'The fire keeps the cold at bay.',
  stiff: 'You are stiff and sore from a hard night.',   // AUDIT SURV-TIERS (the third pass): the ground's or the tavern floor's (a Hard blackout)
  drunk: 'You are drunk.', veryDrunk: 'You are very drunk.',
  vampire: 'You have no need for food or sleep.',
  invigorated: 'You are invigorated from your last meal.',
});

/**
 * The status page's third box: one line a need, the vampire's one
 * line instead. `endurance` is the live stat for the drunk words (the
 * mod's LiveEndurance / 2 and - 10 bands).
 */
export function survivalStatusLines(entity, now, { vampire = false, endurance = 50 } = {}) {
  if (vampire) return [STATUS_TEXT.vampire];
  const s = survivalOf(entity, now);
  const lines = [];
  const hunger = hungerStage(hungerMinutes(s, now));
  lines.push(hunger === 'fed' && hungerMinutes(s, now) < NEED.PECKISH_AT / 2 ? STATUS_TEXT.invigorated : STATUS_TEXT.hunger[hunger]);
  lines.push(STATUS_TEXT.thirst[thirstStage(s.thirst)]);
  lines.push(STATUS_TEXT.sleep[sleepStage(s.sleepDebt)]);
  const wet = STATUS_TEXT.wet[wetStage(s.wet)];
  if (wet) lines.push(wet);
  if (Number.isFinite(s.felt)) { const word = temperatureWord(s.felt); lines.push(warmedBy(s, word) ? STATUS_TEXT.warmedByFire : STATUS_TEXT.temp(word)); }
  if (isStiff(s, now)) lines.push(STATUS_TEXT.stiff);
  if (s.drunk > endurance / 2) lines.push(s.drunk > endurance - 10 ? STATUS_TEXT.veryDrunk : STATUS_TEXT.drunk);
  return lines.filter(Boolean);
}
/** The box's rows, in the hosts' `{ text, center }` shape. */
export const survivalStatusRows = (entity, now, opts) => survivalStatusLines(entity, now, opts).map((text) => ({ text, center: true }));
