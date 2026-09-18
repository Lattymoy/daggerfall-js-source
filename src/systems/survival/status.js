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

/** The chip's severity: 'warn' is felt, 'danger' is costing you. */
export const HUD_NEED_WORDS = Object.freeze({
  hunger: Object.freeze({ peckish: ['Peckish', 'warn'], hungry: ['Hungry', 'warn'], starving: ['Starving', 'danger'] }),
  thirst: Object.freeze({ thirsty: ['Thirsty', 'warn'], parched: ['Parched', 'danger'], dehydrated: ['Dehydrated', 'danger'] }),
  sleep: Object.freeze({ tired: ['Tired', 'warn'], drowsy: ['Drowsy', 'warn'], exhausted: ['Exhausted', 'danger'] }),
  wet: Object.freeze({ damp: ['Damp', 'warn'], wet: ['Wet', 'warn'], soaked: ['Soaked', 'warn'], drenched: ['Drenched', 'danger'] }),
  temp: Object.freeze({ hot: ['Hot', 'warn'], scorching: ['Scorching', 'danger'], cold: ['Cold', 'warn'], freezing: ['Freezing', 'danger'], 'deadly cold': ['Deadly cold', 'danger'] }),
});

/** The strip's chips: [{ key, text, level }] - empty when every need is met. */
export function survivalHudChips(entity, now, { vampire = false, endurance = 50 } = {}) {
  if (!entity?.survival) return [];
  const s = survivalOf(entity, now);
  const out = [];
  const push = (key, table, stage) => { const w = table[stage]; if (w) out.push({ key, text: w[0], level: w[1] }); };
  if (!vampire) push('hunger', HUD_NEED_WORDS.hunger, hungerStage(hungerMinutes(s, now)));   // AUDIT SURV C: no need for food or sleep
  push('thirst', HUD_NEED_WORDS.thirst, thirstStage(s.thirst));
  if (!vampire) push('sleep', HUD_NEED_WORDS.sleep, sleepStage(s.sleepDebt));
  push('wet', HUD_NEED_WORDS.wet, wetStage(s.wet));
  if (Number.isFinite(s.felt)) push('temp', HUD_NEED_WORDS.temp, temperatureWord(s.felt));
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
  stiff: 'You are stiff and sore from a night on the ground.',
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
  if (Number.isFinite(s.felt)) lines.push(STATUS_TEXT.temp(temperatureWord(s.felt)));
  if (isStiff(s, now)) lines.push(STATUS_TEXT.stiff);
  if (s.drunk > endurance / 2) lines.push(s.drunk > endurance - 10 ? STATUS_TEXT.veryDrunk : STATUS_TEXT.drunk);
  return lines.filter(Boolean);
}
/** The box's rows, in the hosts' `{ text, center }` shape. */
export const survivalStatusRows = (entity, now, opts) => survivalStatusLines(entity, now, opts).map((text) => ({ text, center: true }));
