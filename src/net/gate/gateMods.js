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
// WB14b: but the text core (systems/textManager.js - itself importless), which the portents' words are read through.
//
// Not a DFU member. Ledger A (WB8).
import { t } from '../../systems/textManager.js';

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

// ═══ WB14b: THE PORTENTS ═══════════════════════════════════════════════════════════════════════════════════════════
//
// (2026-10-19, Mac: "adding the chance of a gate to spawn with platforms of wave based adds that need to be defeated
// before encountering the boss ... the boss splitting and players having to split and navigate to beat both sides and
// then merging at the end for its final stand (chance based encounter modifer)", then "This is all yours to take on"):
// THE THIRD KIND OF MARK - beside his aspect and his trials, what else a night's breach holds. Drawn by the day
// (net/gate/gateLaw.js gatePortentsOf - a shuffle bag over the nights that are not the Legion-Lord's), kept on the fight
// (net/gate/gateBrain.js newFight's `pt`) and said in its every state. Names and numbers here; the law is the brain's.
// bible/11-Multiplayer/Breach-Portents.md.

/**
 * @typedef {{id: string, name: string, line: string, tip: string, bit: number}} GatePortent
 */
/** A portent's row: its words read through the text core where they are read (L10N4 - a player reads them in the
 *  language they chose; the relay's herald, which sets none, in English).
 * @param {string} id @param {number} bit @param {() => string} name @param {() => string} line @param {() => string} tip */
const portentRow = (id, bit, name, line, tip) => /** @type {Readonly<GatePortent>} */ (Object.freeze(Object.defineProperties({ id, bit }, {
  name: { enumerable: true, get: name }, line: { enumerable: true, get: line }, tip: { enumerable: true, get: tip },
})));
/** THE PORTENTS: each its name, the one line the omen and the card say it in, how to meet it (the card's tip), and its bit
 *  on the receipt (net/gate/gateReceipt.js `p` - what it pays, section 11).
 *  @type {ReadonlyArray<Readonly<GatePortent>>} */
export const GATE_PORTENTS = Object.freeze([
  portentRow('vanguard', 1, () => t('gate.portent.vanguard.name', 'The Vanguard'), () => t('gate.portent.vanguard.line', 'His vanguard holds the approach.'),
    () => t('gate.portent.vanguard.tip', 'Clear both platforms to open the way to him.')),
  portentRow('sunder', 2, () => t('gate.portent.sunder.name', 'The Sundering'), () => t('gate.portent.sunder.line', 'He tears in two at the second phase.'),
    () => t('gate.portent.sunder.tip', 'Bring both halves down within 20 seconds of each other.')),
  portentRow('captive', 4, () => t('gate.portent.captive.name', 'The Captive'), () => t('gate.portent.captive.line', 'A knight of the Covenant lies chained in the Pen.'),
    () => t('gate.portent.captive.tip', 'Free the knight to ward off one Reckoning.')),
]);
/** THE DIRE BREACH - no row of its own: the Vanguard and the Sundering on one night, said before their two lines. */
export const GATE_DIRE = Object.freeze(['vanguard', 'sunder']);
export const gateDireLine = () => t('gate.portent.dire.line', 'Dagon\'s Breach runs deep.');   // AUDIT WB14 (TEXT-13): "tonight" once - the marks' line says it
/** The portents a night may hold together: one, or the Dire Breach's two. */
export const GATE_PORTENTS_MAX = 2;
const PORTENT_BY_ID = new Map(GATE_PORTENTS.map((p) => [p.id, p]));
export const portentOf = (id) => PORTENT_BY_ID.get(id) ?? null;
/** The bits a receipt says for a set of portents (an unknown id none). */
export const portentBits = (pt) => (Array.isArray(pt) ? pt.reduce((m, id) => m | (PORTENT_BY_ID.get(id)?.bit ?? 0), 0) : 0);

/**
 * WB14b: A NIGHT'S PORTENTS ON THE WIRE (the relay's state `pt`, the fight's own, the day's draw): null for none, else
 * the ids in GATE_PORTENTS' order - one, or the Dire Breach's pair - each known; anything else is undefined (refused).
 * @param {unknown} pt
 * @returns {ReadonlyArray<string>|null|undefined}
 */
export function validGatePortents(pt) {
  if (pt == null) return null;
  if (!Array.isArray(pt) || pt.length < 1 || pt.length > GATE_PORTENTS_MAX) return undefined;
  if (!pt.every((id) => typeof id === 'string' && PORTENT_BY_ID.has(id)) || new Set(pt).size !== pt.length) return undefined;
  const ordered = GATE_PORTENTS.map((p) => p.id).filter((id) => pt.includes(id));
  if (ordered.length === 2 && !(ordered[0] === GATE_DIRE[0] && ordered[1] === GATE_DIRE[1])) return undefined;
  return Object.freeze(ordered);
}
/** Does a night's portents (the state's `pt`, validated or not) hold `id`? */
export const hasPortent = (pt, id) => Array.isArray(pt) && pt.includes(id);
/** The portents in words, for a card, a banner or a herald: "The Vanguard", "The Vanguard · The Sundering" - '' for none
 *  (AUDIT WB14 TEXT-16: each a name of its own - a comma read a capital "The" mid-list). */
export const gatePortentsWords = (pt) => (validGatePortents(pt) ?? []).map((id) => PORTENT_BY_ID.get(id).name).join(' · ');
/** WB14f: THE CAPTIVE'S NAME, by the day (net/gate/gateLaw.js captiveNameOf) - a knight of the Covenant, Daggerfall's Bay in
 *  its names: each a reader of it. */
export const CAPTIVE_NAMES = Object.freeze([
  () => t('gate.captive.evrard', 'Sir Evrard'), () => t('gate.captive.lysandre', 'Dame Lysandre'), () => t('gate.captive.gaelan', 'Sir Gaelan'),
  () => t('gate.captive.tavia', 'Dame Tavia'), () => t('gate.captive.aldric', 'Sir Aldric'), () => t('gate.captive.ysolde', 'Dame Ysolde'),
  () => t('gate.captive.corvin', 'Sir Corvin'), () => t('gate.captive.marisse', 'Dame Marisse'),
]);   // each read through the text core where it is said (L10N4)
/** WB14f: which of CAPTIVE_NAMES is a Dame's (drawn as Daggerfall's woman knight - world/gate/gateBoss.js knightLookOf). */
export const CAPTIVE_DAMES = Object.freeze([false, true, false, true, false, true, false, true]);
