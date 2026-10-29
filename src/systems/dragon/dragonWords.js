// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md sections 3, 6 and 9): THE DRAGON'S WORDS ON THIS SCREEN - its names, the
// sighting, its blows, its turns, its fall, the bar's lines and the relay's refusal codes (net/wire.js DRAGON_NO_WORDS) said
// in the player's language. Each goes through the text core (`t`) when it is read, never at import. Not a DFU member.
// Ledger A (DRAGON).
import { t } from '../textManager.js';

/** Its names by look (0 the brass, 1 the Aetherbright), and its epithet. */
export const dragonName = (b) => (b ? t('dragon.name.shiny', 'The Aetherbright Dragon') : t('dragon.name', 'The Dwarven Dragon'));
export const dragonTitle = () => t('dragon.title', 'Rourken Outrider');

/** The lines of its fight and its sky. */
export const DRAGON_WORDS = Object.freeze({
  circles: (dir, b) => (b ? t('dragon.circles.shiny', 'A blue dragon circles in the sky to the {dir}.', { dir }) : t('dragon.circles', 'A dragon circles in the sky to the {dir}.', { dir })),
  get grounded() { return t('dragon.grounded', 'It crashes down! Strike it while it is on the ground.'); },
  get aloft() { return t('dragon.aloft', 'It beats its wings and climbs back into the sky.'); },
  get phase2() { return t('dragon.phase2', 'The dragon roars. Steam pours from its seams!'); },
  get phase3() { return t('dragon.phase3', 'Its coil spins wild. Shrapnel falls from the sky!'); },
  fell: (name) => t('dragon.fell', '{name} falls from the sky!', { name }),
  get gone() { return t('dragon.gone', 'The dragon climbs away into the clouds.'); },
});

/** Its blows' names, by the brain's keys (net/dragon/dragonBrain.js DRAGON_BLOWS). */
export const DRAGON_BLOW_NAMES = Object.freeze({
  get strafe() { return t('dragon.blow.strafe', 'Strafing Run'); },
  get volley() { return t('dragon.blow.volley', 'Cannon Volley'); },
  get breath() { return t('dragon.blow.breath', 'Scalding Breath'); },
  get crash() { return t('dragon.blow.crash', 'Crash Landing'); },
  get claw() { return t('dragon.blow.claw', 'Claw Rake'); },
  get tail() { return t('dragon.blow.tail', 'Tail Sweep'); },
  get gust() { return t('dragon.blow.gust', 'Takeoff Gust'); },
  get vent() { return t('dragon.blow.vent', 'Overpressure'); },
  get rain() { return t('dragon.blow.rain', 'Shrapnel Rain'); },
});

/** The bar's lines. */
export const DRAGON_BAR_WORDS = Object.freeze({
  get aloft() { return t('dragon.bar.aloft', 'Aloft'); },
  grounded: (s) => t('dragon.bar.grounded', 'Grounded {s}s', { s }),
  climbs: (left) => t('dragon.bar.climbs', 'It climbs away in {left}', { left }),
  fighters: (n) => (n === 1 ? t('dragon.bar.fighter', '1 fighting it') : t('dragon.bar.fighters', '{n} fighting it', { n })),
});

/** The relay's refusals, code by code (net/wire.js DRAGON_NO_WORDS). */
export const DRAGON_NO_TEXT = Object.freeze({
  get gone() { return t('dragon.no.gone', 'The dragon is gone.'); },
  get far() { return t('dragon.no.far', 'Come closer to the dragon to fight it.'); },
  get full() { return t('dragon.no.full', 'Too many fight this dragon already.'); },
  get slain() { return t('dragon.no.slain', 'The dragon is already slain.'); },
  get reload() { return t('dragon.no.reload', 'Your game is out of date. Save, then reload or update the app to fight the dragon.'); },
});
