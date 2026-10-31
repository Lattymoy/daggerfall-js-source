// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md sections 3, 6 and 9): THE DRAGON'S WORDS ON THIS SCREEN - its names, the
// sighting, its blows, its turns, its fall, the bar's lines and the relay's refusal codes (net/wire.js DRAGON_NO_WORDS) said
// in the player's language. Each goes through the text core (`t`) when it is read, never at import. Not a DFU member.
// Ledger A (DRAGON).
import { t } from '../textManager.js';
import { DRAGON_MOUNT_ONLINE } from './dragonMount.js';

/** Its names by look (0 the brass, 1 the Aetherbright), and its epithet. */
export const dragonName = (b) =>
  b ? t('dragon.name.shiny', 'The Aetherbright Dragon') : t('dragon.name', 'The Dwarven Dragon');
export const dragonTitle = () => t('dragon.title', 'Rourken Outrider');

/** Where it circles, by systems/compassWords.js's English ways - a whole phrase, so each language words it its own way. */
const DRAGON_WAY = Object.freeze({
  north: () => t('dragon.way.north', 'to the north'),
  'north-east': () => t('dragon.way.northEast', 'to the north-east'),
  east: () => t('dragon.way.east', 'to the east'),
  'south-east': () => t('dragon.way.southEast', 'to the south-east'),
  south: () => t('dragon.way.south', 'to the south'),
  'south-west': () => t('dragon.way.southWest', 'to the south-west'),
  west: () => t('dragon.way.west', 'to the west'),
  'north-west': () => t('dragon.way.northWest', 'to the north-west'),
});

/** The lines of its fight and its sky. */
export const DRAGON_WORDS = Object.freeze({
  circles: (dir, b) => {
    const way = DRAGON_WAY[dir]?.() ?? DRAGON_WAY.north();
    return b
      ? t('dragon.circles.shiny', 'A blue dragon circles in the sky {way}.', { way })
      : t('dragon.circles', 'A dragon circles in the sky {way}.', { way });
  },
  get grounded() {
    return t('dragon.grounded', 'It crashes down! Strike it while it is on the ground.');
  },
  get aloft() {
    return t('dragon.aloft', 'It beats its wings and climbs back into the sky.');
  },
  get phase2() {
    return t('dragon.phase2', 'The dragon roars. Steam pours from its seams!');
  },
  get phase3() {
    return t('dragon.phase3', 'Its coil spins wild. Shrapnel falls from the sky!');
  },
  fell: (name) => t('dragon.fell', '{name} falls from the sky!', { name }),
  get gone() {
    return t('dragon.gone', 'The dragon climbs away into the clouds.');
  },
});

/** Its blows' names, by the brain's keys (net/dragon/dragonBrain.js DRAGON_BLOWS). */
export const DRAGON_BLOW_NAMES = Object.freeze({
  get strafe() {
    return t('dragon.blow.strafe', 'Strafing Run');
  },
  get volley() {
    return t('dragon.blow.volley', 'Cannon Volley');
  },
  get breath() {
    return t('dragon.blow.breath', 'Scalding Breath');
  },
  get crash() {
    return t('dragon.blow.crash', 'Crash Landing');
  },
  get claw() {
    return t('dragon.blow.claw', 'Claw Rake');
  },
  get tail() {
    return t('dragon.blow.tail', 'Tail Sweep');
  },
  get gust() {
    return t('dragon.blow.gust', 'Takeoff Gust');
  },
  get vent() {
    return t('dragon.blow.vent', 'Overpressure');
  },
  get rain() {
    return t('dragon.blow.rain', 'Shrapnel Rain');
  },
});

/** The bar's lines. */
export const DRAGON_BAR_WORDS = Object.freeze({
  get aloft() {
    return t('dragon.bar.aloft', 'Aloft');
  },
  grounded: (s) => t('dragon.bar.grounded', 'Grounded {s}s', { s }),
  climbs: (left) => t('dragon.bar.climbs', 'It climbs away in {left}', { left }),
  fighters: (n) =>
    n === 1 ? t('dragon.bar.fighter', '1 fighting it') : t('dragon.bar.fighters', '{n} fighting it', { n }),
});

/** The relay's refusals, code by code (net/wire.js DRAGON_NO_WORDS). */
export const DRAGON_NO_TEXT = Object.freeze({
  get gone() {
    return t('dragon.no.gone', 'The dragon is gone.');
  },
  get far() {
    return t('dragon.no.far', 'Come closer to the dragon to fight it.');
  },
  get full() {
    return t('dragon.no.full', 'Too many fight this dragon already.');
  },
  get slain() {
    return t('dragon.no.slain', 'The dragon is already slain.');
  },
  get reload() {
    return t('dragon.no.reload', 'Your game is out of date. Save, then reload or update the app to fight the dragon.');
  },
});

/** DRAGON4: its hoard's lines (systems/dragon/dragonSpoils.js) and its claim's (net/dragon/dragonClaims.js). */
export const DRAGON_SPOILS_TEXT = Object.freeze({
  granted: (b) => t('dragon.spoils.granted', "{name}'s hoard is yours. It is in your pack.", { name: dragonName(b) }),
  recovered: () => t('dragon.spoils.recovered', "A dragon's hoard is in your pack."),
  kept: (who) =>
    who
      ? t('dragon.spoils.kept', "The dragon's hoard waits for {who}.", { who })
      : t('dragon.spoils.keptAnyone', "The dragon's hoard waits for the one who fought it."),
});
export const DRAGON_CLAIM_TEXT = Object.freeze({
  recorded: (n) => t('dragon.claim.recorded', "The dragon's fall is on your record. Dragons slain: {n}.", { n }),
  guest: () =>
    t(
      'dragon.claim.guest',
      'This dragon is not on your record yet: only registered accounts keep one. Add a username this week and it counts.',
    ),
  // AUDIT DRAGON: while the mount waits (DRAGON_MOUNT_ONLINE off - REST6's law), the line says so, never a dragon not given
  tamed: () =>
    DRAGON_MOUNT_ONLINE
      ? t('dragon.claim.tamed', 'Its core still turns. The Dwarven Dragon is yours.')
      : t('dragon.claim.tamedWaits', 'Its core still turns. The Dwarven Dragon is yours to ride after a later update.'),
  /** DRAGON5: bound into the pack. */
  bound: () => t('dragon.claim.bound', 'The Dwarven Dragon is yours. Ride it from the Transport window.'),
});
