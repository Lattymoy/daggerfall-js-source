// @ts-check
// WB8b (2026-09-28, Mac: "Make the oblivion gate boss not be able to be pacified, continue to refine and add detail to
// his encounters, and give him unique and different modifers on every 2 hour spawn"): THE WARDEN'S MARKS - what each
// gate's Warden comes marked with. Every gate (one a game day, every two real hours - net/gate/gateLaw.js) he wears ONE
// ASPECT - which of Oblivion's powers his elemental blows carry - and TWO TRIALS - what else the court asks of his
// challengers. The day's marks are its place in the cycle of marks (net/gate/gateLaw.js gateModsOf, marksCycle): no two gates
// running share an aspect or a trial, and every one comes round in turn. WB11a: nine trials - the ninth, Legion-Lord,
// brings his host.
//
// A MARK IS NAMES AND NUMBERS HERE; its law is the fight's profile (net/gate/gateBrain.js fightProfile), read by the relay
// that runs him and by every screen that draws and resolves his blows - one law, both ends. The relay says a fight's
// marks in its state (`md`), so a screen reads the fight it is in, whatever the day's draw would say.
//
// PURE and a LEAF: no imports - the relay's bundle (net/gate/gateBrain.js, net/gate/gateLaw.js, net/wire.js) reads it.
//
// Not a DFU member. Ledger A (WB8).

/**
 * @typedef {{id: string, name: string, epithet: string, el: string, ground: string, names: Readonly<Record<string, string>>,
 *   omen: string, stuff: string}} GateAspect
 * @typedef {{id: string, name: string, text: string, size?: number, hp?: number, slamR?: number, shieldMs?: number,
 *   hit?: number, dmg?: number, groundMs?: number, threatPick?: number, threatDecay?: number, heal?: number, feeds?: number,
 *   legion?: boolean}} GateTrial
 */
/** AUDIT PRE-MERGE 0929 W1-1: the most challengers a Soul-Hungry Warden feeds on in one fight - no number of accounts
 *  buys him more than this many feedings (the wire's `fed` word names at most this many). */
export const GATE_FEEDS_MAX = 5;
/** The ASPECTS: the element his elemental blows (and the ground they leave) carry, the epithet he wears, what each of
 *  those blows is called under it, and the words the court says of it (`omen` on the marks' card, `stuff` in the phases'
 *  lines - "Keep out of the fire."). Burning is the Warden as the court first knew him. WB13b: the line on stepping
 *  through and the floor's verb are gone with the lines that said them (the marks' card stands at that moment).
 *  @type {ReadonlyArray<Readonly<GateAspect>>} */
export const GATE_ASPECTS = Object.freeze([
  Object.freeze({
    id: 'burning', name: 'Burning', epithet: 'the Burning', el: 'fire', ground: 'Burning ground',
    names: Object.freeze({ hellfire: 'Hellfire', nova: 'Flame Nova', meteor: 'Meteor of Oblivion', spokes: 'Spokes of Dagon' }),
    omen: 'Dagon\'s fire burns in him.', stuff: 'fire',
  }),
  Object.freeze({
    id: 'rime', name: 'Rime-Wrought', epithet: 'the Rime-Wrought', el: 'frost', ground: 'Rime',
    names: Object.freeze({ hellfire: 'Rimefall', nova: 'Frost Nova', meteor: 'Hailstone of Oblivion', spokes: 'Spokes of Rime' }),
    omen: 'His fire burns cold.', stuff: 'rime',
  }),
  Object.freeze({
    id: 'storm', name: 'Storm-Crowned', epithet: 'the Storm-Crowned', el: 'shock', ground: 'Storm-scorched ground',
    names: Object.freeze({ hellfire: 'Stormfall', nova: 'Thunder Nova', meteor: 'Thunderbolt of Oblivion', spokes: 'Spokes of Storm' }),
    omen: 'Lightning crowns him.', stuff: 'lightning',
  }),
  Object.freeze({
    id: 'venom', name: 'Venom-Blooded', epithet: 'the Venom-Blooded', el: 'poison', ground: 'Venom',
    names: Object.freeze({ hellfire: 'Venomfall', nova: 'Venom Nova', meteor: 'Plague Star of Oblivion', spokes: 'Spokes of Venom' }),
    omen: 'Venom runs in his veins.', stuff: 'venom',
  }),
]);

/** The TRIALS: what else the court asks of his challengers - each a name, the one line that says it, and the numbers
 *  its law reads (net/gate/gateBrain.js fightProfile).
 *  @type {ReadonlyArray<Readonly<GateTrial>>} */
export const GATE_TRIALS = Object.freeze([
  Object.freeze({ id: 'colossal', name: 'Colossal', text: 'Larger and tougher, with a wider Ground Slam', size: 1.25, hp: 1.25, slamR: 8.5 }),
  Object.freeze({ id: 'unyielding', name: 'Unyielding', text: 'His ward lasts twice as long, and blows on him deal 15% less', shieldMs: 6000, hit: 0.85 }),
  Object.freeze({ id: 'vengeful', name: 'Vengeful', text: 'His blows and his ground deal 25% more', dmg: 1.25 }),
  Object.freeze({ id: 'scarring', name: 'Scarring', text: 'Ground Slam and Crushing Leap scar the floor, and his ground lasts 50% longer', groundMs: 1.5 }),
  Object.freeze({ id: 'grudge', name: 'Grudge-Bearer', text: 'He hunts whoever hurts him most', threatPick: 0.85, threatDecay: 0 }),
  Object.freeze({ id: 'soulhungry', name: 'Soul-Hungry', text: 'Each challenger who falls heals him 3%', heal: 0.03, feeds: GATE_FEEDS_MAX }),
  Object.freeze({ id: 'favoured', name: 'Dagon\'s Favoured', text: 'Hellfire and meteors from the first phase, the Spokes from the second' }),
  Object.freeze({ id: 'echoing', name: 'Echoing', text: 'Every meteor falls twice' }),
  // WB11a (2026-10-01, Mac: "1. All three ... 4. Trial rotation"): THE NINTH - his host fights beside him (net/gate/gateBrain.js
  // HOST_KINDS: the Harriers of the first phase, the Sappers of the second, the Ward-Bearers of each new court). The
  // rotation is built for nine (net/gate/gateLaw.js marksCycle - a bye beside an odd count of trials)
  Object.freeze({ id: 'legion', name: 'Legion-Lord', text: 'His Imps, Atronachs and Ward-Bearers fight beside him', legion: true }),
]);
/** How many trials a gate's Warden bears. */
export const GATE_TRIALS_A_DAY = 2;

const ASPECT_BY_ID = new Map(GATE_ASPECTS.map((a) => [a.id, a]));
const TRIAL_BY_ID = new Map(GATE_TRIALS.map((t) => [t.id, t]));
export const gateAspectOf = (id) => ASPECT_BY_ID.get(id) ?? null;
export const gateTrialOf = (id) => TRIAL_BY_ID.get(id) ?? null;

/**
 * A fight's marks, read: the aspect and the trials a word names (`md` - [aspect, trial, trial], the relay's state and
 * the day's draw alike). Unknown words are dropped; no aspect reads as Burning; a trial named twice counts once. Null or
 * nothing is the Warden unmarked (a fight checkpointed before WB8).
 * @param {unknown} md
 * @returns {{aspect: Readonly<GateAspect>, trials: Readonly<GateTrial>[]}}
 */
export function readGateMods(md) {
  const ids = Array.isArray(md) ? md.filter((x) => typeof x === 'string') : [];
  const aspect = ids.map(gateAspectOf).find(Boolean) ?? GATE_ASPECTS[0];
  const trials = [];
  for (const id of ids) { const t = gateTrialOf(id); if (t && !trials.includes(t)) trials.push(t); }
  return { aspect, trials };
}

/** The wire's shape of a fight's marks: at most one aspect and GATE_TRIALS_A_DAY + 1 words, each a known one - or null. */
export function validGateMods(md) {
  if (md == null) return null;
  if (!Array.isArray(md) || md.length > GATE_TRIALS_A_DAY + 1) return undefined;
  if (!md.every((x) => typeof x === 'string' && (ASPECT_BY_ID.has(x) || TRIAL_BY_ID.has(x)))) return undefined;
  if (md.filter((x) => ASPECT_BY_ID.has(x)).length > 1) return undefined;
  return [...md];
}

/** The marks in words, for a card, a banner or a herald: "the Rime-Wrought - Colossal, Echoing". */
export function gateModsWords(md) {
  const { aspect, trials } = readGateMods(md);
  return trials.length ? `${aspect.epithet} - ${trials.map((t) => t.name).join(', ')}` : aspect.epithet;
}
