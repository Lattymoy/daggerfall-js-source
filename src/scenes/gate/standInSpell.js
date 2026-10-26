// @ts-check
// FIELD BUGS 2026-10-19f STAND-IN-WHOLE (a player's private report: a Disintegrate on an online breach's boss popped a
// huge number, and his bar never moved): A HARMFUL SPELL OF MINE ON A BODY THE RELAY RUNS - the court's Warden, his
// crystals and his host (WB4b, WB9c, WB11c); in the Shattered Hour the Brass Remnant, its Echoes and its Hearts (SD8c);
// every lord, add and struck object of an Elite Breach's hall (EG-PLAY, through the host seam); my opponent on a relay's
// sand (ARENA4b). HOST-SPLIT (bible/01-Overview/Host-Split.md): out of buildDungeonContext, which kept this one door four
// times over (spellOnBoss, spellOnCrystal, spellOnHost, spellOnRival) - and the host wires it where they stood.
//
// THE DOOR. The spell's harmful families (combat/duelCombat.js duelSpellOf) land on the body's stand-in
// (world/gate/gateBoss.js) by the one door every spell lands through (systems/effects.js applySpell - the magnitude, its
// save), its hurts COUNTED - nothing here takes from a stand-in, the relay holds the health - and every lasting family
// forgotten at once. The sum is the claim, out through the host's door for that body; the relay's caps decide what lands.
//
// THE NUMBER IT SAYS is what can land (standInShown): the claim, never past the most one blow of mine lands there - the
// relay's one-blow cap at my level (world/gate/gateBoss.js standInBlowCap; an Elite Breach's grown by my Vestiges' declared
// factor), a bout referee's spell cap (net/arena/arenaLaw.js arenaBlowCap). The paths' riders are told the same (`took`:
// what the foe could lose - AUDIT SCHOOLS L1 M6). It said the claim whole, and a Disintegrate's claim is its target's whole
// (STAND_IN_WHOLE; 1e9 until this fix, which no wire carried): a number rose that nothing landed.
//
// FIELD BUGS 2026-10-19f BOSS-DOT (the owner, 2026-10-19: "Carry DoTs"): ITS LASTING HARM IS CARRIED. The stand-in forgot
// every lasting family the moment the count was done, so a Continuous Damage spell landed its cast's round alone (a level-20
// Burn - 10 a round for 25 rounds, 8 of each through his save at even dice: 8 of its 200; the other 24 rounds gone) - WB4b's
// comment, never a decision; WBX7 carried the Soul Trap alone. A
// relay body's Continuous Damage on its health (carriedOnStandIn) is lifted off the stand-in before the wipe and kept a body
// (createStandInRounds), fed back as the incumbent so a recast renews it (systems/effects.js renewRounds, STACK-CAP), and
// ticked on the shared world's round (gateCourt.js COURT_ROUND_MS - the court's trap's clock) by the one law every entity's
// rounds run by (tickActiveEffects - a save rolled each round, its caster's power), each round's sum out through the door a
// spell's claim takes. Its body gone, the fight over, my death or the context's end - its rounds end. The sea serpent's door
// came here with it (createSerpentSpell, out of bootWorld). A bout's rounds are not carried (BAL8: the referee's blow alone).
//
// Not a DFU member (every DFU foe is its own); the whole a Disintegrate counts here is gateBoss.js's (STAND_IN_WHOLE).
import { applySpell, spellSways, isSoulTrapEffect, tickActiveEffects } from '../../systems/effects.js';
import { bossStrike } from '../../systems/bossTraits.js';   // BOSS-TRAITS: the striker's half on a stand-in
import { duelSpellOf } from '../../combat/duelCombat.js';
import { reportPlayerAttack } from '../../combat/formulas.js';
import { tellSpellLanded } from '../../systems/spell/spellPower.js';
import { SOUL_TRAP_TEXT } from '../../systems/mysticism.js';
import { HIT_KINDS } from '../../net/gate/gateBrain.js';
import { ARENA_HIT, arenaBlowCap } from '../../net/arena/arenaLaw.js';
import { BOSS_SWAY_TEXT, BOSS_SWAY_TELL_MS, standInBlowCap } from '../../world/gate/gateBoss.js';
import { COURT_ROUND_MS } from './gateCourt.js';   // BOSS-DOT: the round a relay body's lasting harm ticks on - the court's trap's
import { SERPENT_HIT_CAP_X, SERPENT_HAND_REF } from '../../net/serpent/serpentBrain.js';   // BOSS-DOT: the most a hand's blow lands on the serpent

/** BOSS-DOT: THE LASTING HARM A RELAY BODY CARRIES - an entry of Continuous Damage on its health (DUEL_SPELL_TYPES' type 1,
 *  sub 0; DFU's ContinuousDamageHealth) with a round still to run. Its two siblings on fatigue and magicka have nothing to
 *  fall on - a relay body is health alone - and the duel's other lasting families (Paralyze, Silence, Drain) are the relay
 *  brain's to know, never a claim: none of those is carried. */
export const carriedOnStandIn = (a) => a?.kind === 'continuousDamage' && !a.ended && a.roundsRemaining > 0;
const NO_ROUNDS = Object.freeze([]);
/** The sinks a stand-in's rounds and casts land through: every hurt summed into `got.n`, every other family nothing. */
/** The sinks a count on a stand-in runs through - `resist` its body (AUDIT WORLD-EVENTS L2-2: a carried round is resisted by
 *  its element as it ticks, as the cast's own claim is in onBody - it went out whole). */
const counting = (got, resist = null) => ({ hurt: (n, o) => { got.n += Math.max(0, resist && n > 0 ? bossStrike(resist, n, { kind: 'spell', element: o?.element ?? null }).damage : n); }, heal() {}, drainFatigue() {}, restoreFatigue() {}, drainMagicka() {}, restoreMagicka() {} });

/**
 * A HARMFUL SPELL'S FAMILIES ON A STAND-IN, COUNTED: `harm` (duelSpellOf's) landed on `entity` by the one door every spell
 * lands through - at my `level`, `caster` its caster, `rolls` the dice - its hurts summed, every other family nothing,
 * and the stand-in forgetting every lasting family at once. Nothing is taken from it. BOSS-DOT: `carried` the body's
 * running rounds, laid on it as copies first - the incumbent a recast renews (never stacks: STACK-CAP) - so nothing it kept
 * changes unless the caller keeps what comes back. `{ dealt, r, kept }`: the sum, the door's answer, and the body's lasting
 * harm after the cast (carriedOnStandIn), to keep.
 * @param {any} harm @param {any} entity @param {number} level @param {any} caster @param {() => number} [rolls]
 * @param {ReadonlyArray<any>} [carried]
 */
export function countOnStandIn(harm, entity, level, caster, rolls = Math.random, carried = NO_ROUNDS) {
  const got = { n: 0 };
  let r = null, kept = NO_ROUNDS;
  entity.activeEffects = carried.map((a) => ({ ...a }));
  try {
    r = applySpell(harm, level, entity, counting(got), rolls, { entity: caster });
    kept = (entity.activeEffects ?? []).filter(carriedOnStandIn);
  } finally { entity.activeEffects = []; }
  return { dealt: got.n, r, kept };
}

/**
 * BOSS-DOT: THE ROUNDS RELAY BODIES CARRY - each body's running Continuous Damage, by its key, ticked together on every
 * round of the shared world's clock (COURT_ROUND_MS: one game minute online, five seconds - the court's soul trap's clock,
 * the relay's own; never this machine's magic round, which a rest or a wait moves in a burst). A round runs each body's
 * entries against its stand-in (`tickActiveEffects` - DFU's DoMagicRound: the save rolled fresh, its caster's power), counts
 * what they deal, and sends the sum through the body's door (`land`): one claim a body a round, every body's in the same
 * frame - one blow's sequence where the court's grouping takes them. A round missed (a frame that stalled) is run with the
 * next, its sum one claim. `bodyOf(key)` answers `{ entity, land(dealt) }`, or null for a body gone (fallen, withdrawn, the
 * fight over, out of reach of the screen): its rounds end; and `alive` false (my death) ends them all.
 * @param {{ now?: () => number, rolls?: () => number }} [o]
 */
export function createStandInRounds({ now = Date.now, rolls = Math.random } = {}) {
  const kept = new Map();
  let round = null;
  return {
    /** The body's running rounds (the incumbent a cast on it renews). */
    carried: (key) => kept.get(key) ?? NO_ROUNDS,
    /** A cast on the body landed: what it carries now - the first a keeper holds ticks from the next round, never from a
     *  round before it was laid. */
    keep(key, entries) {
      if (!entries?.length) { kept.delete(key); return; }
      if (!kept.size) round = Math.floor(now() / COURT_ROUND_MS);
      kept.set(key, entries);
    },
    /** The keys running. */
    keys: () => [...kept.keys()],
    /** One frame. */
    frame(bodyOf, alive = true) {
      const r = Math.floor(now() / COURT_ROUND_MS);
      if (!alive) kept.clear();
      if (!kept.size || round === null || r < round) { round = r; return; }   // none running: the clock stands at this round - one laid now ticks from the next
      if (r === round) return;
      const due = r - round;
      round = r;
      for (const [key, entries] of [...kept]) {
        const body = bodyOf(key);
        if (!body?.entity) { kept.delete(key); continue; }
        const got = { n: 0 }, e = body.entity;
        let left = NO_ROUNDS;
        e.activeEffects = entries;
        try {
          for (let k = 0; k < due && e.activeEffects.some(carriedOnStandIn); k++) tickActiveEffects(e, counting(got, e), rolls);
          left = e.activeEffects.filter(carriedOnStandIn);
        } finally { e.activeEffects = []; }
        if (left.length) kept.set(key, left); else kept.delete(key);
        if (got.n >= 1) body.land(got.n);
      }
    },
  };
}

/** STAND-IN-WHOLE: WHAT A CLAIM OF `dealt` CAN LAND where one blow lands at most `cap` - the number it says. Pure.
 *  @param {number} dealt @param {number} cap */
export const standInShown = (dealt, cap) => Math.min(Math.max(0, dealt), cap);

/**
 * THE DOORS, made once a context (scenes/dungeonContext.js, where its own stood). `host`:
 *   player        my entity - the level and the caster a cast lands with
 *   say(line)     the mid-screen line (his refusal of a sway, a trap's word)
 *   boss()        his body as a foe-shaped record, or null (the Remnant in the Hour); crystals() the crystals' (the
 *                 Hearts), host() his host's (the Echoes; an Elite Breach's bodies), rival() my opponent's
 *   landOnBoss, landOnCrystal, landOnHost (body, d, r) and landOnRival (body, d, kind) - the doors a claim leaves through
 *   nextArenaQ()  a bout's next blow (ARENA4b: each spell its own)
 *   trapNow(), onTrap(trap) - the court's keeping of my trap on him (WBX7, AUDIT WBX F6)
 *   rolls, now    the dice and the clock (Math.random, Date.now)
 * Answers the four doors and the one a Cast When Strikes spell takes (spellOnStandIn).
 * @param {any} host
 */
export function createStandInSpell(host) {
  const { player, say, rolls = Math.random, now = Date.now } = host;
  let swayToldAt = -Infinity;   // WB8a: when his refusal was last said
  const rounds = createStandInRounds({ now, rolls });   // BOSS-DOT: the lasting harm each body carries - him `b`, one of his host `h<i>`, a crystal `c<n>`
  /** AUDIT SCHOOLS L2 F4: MY SPELL LANDED ON A STAND-IN OF THE COURT - told to the paths' riders as any landing of mine is
   *  (hostMagic.js applySpellToFoe), with no foe record: the relay holds the body, so no arc or second burn reaches it.
   *  What it took is what can land (STAND-IN-WHOLE). `caster` the cast's wrapper (its token and cost), when the cast
   *  engine's. */
  function tellStandIn(sp, entity, r, took, caster) {
    tellSpellLanded({ caster: player, target: entity, foe: null, spell: sp, r, self: false, took, cast: caster?.cast ?? null });
  }
  /** A body of the court met (him, a crystal, one of his host): the spell counted on its stand-in, told, its number risen
   *  as a blow's does (HN1) - what can land, by the body it met (AUDIT FB1018f L3-2: a turned one says its word) - and the
   *  claim out through `land`. Answers whether it went. BOSS-DOT: on its running rounds (`key`), and what it carries after
   *  kept when the claim went - a spell its ward or the ground turns lays nothing; one whose first round dealt nothing lays
   *  its rounds (it met the body: DFU pushes the entry whatever the round dealt). */
  function onBody(sp, body, harm, caster, land, key) {
    const { dealt: counted, r, kept } = countOnStandIn(harm, body.entity, player.level, player, rolls, rounds.carried(key));
    const dealt = counted >= 1 ? bossStrike(body.entity, counted, { kind: 'spell', element: sp.element ?? null }).damage : counted;   // BOSS-TRAITS: a relay boss's resistance to the spell's element (systems/bossTraits.js)
    if (!(dealt >= 1)) {
      const laid = kept.length > 0 && !turned(body);
      if (laid) rounds.keep(key, kept);
      return laid;
    }
    const shown = standInShown(dealt, standInBlowCap(body.entity, player.level));
    tellStandIn(sp, body.entity, r, shown, caster);
    reportPlayerAttack({ hit: true, damage: Math.round(shown), target: body.entity });
    const went = land(body, dealt, HIT_KINDS.Spell);
    if (went) rounds.keep(key, kept);
    return went;
  }
  /** A body its referee turns whole this moment (his ward, the Remnant shut, the Spire's ground - the stand-in says it). */
  const turned = (body) => !!(body.warded || body.entity?.warded);
  /** BOSS-DOT: the body a key names as it stands now, and the door a round's claim leaves through (`true`: a round, which
   *  an Elite Breach's Vestiges weigh as no blow - scenes/eliteGates/egFight.js hostHit) - none turned, its round lost as
   *  any blow into the ward is; null for a body no longer offered. */
  function bodyOf(key) {
    const n = Number(key.slice(1));
    const body = key === 'b' ? host.boss() : key[0] === 'h' ? host.host().find((q) => q.host === n) : host.crystals().find((q) => q.crystal === n);
    if (!body) return null;
    const land = key === 'b' ? host.landOnBoss : key[0] === 'h' ? host.landOnHost : host.landOnCrystal;
    return { entity: body.entity, land: (d) => !turned(body) && !!land(body, d, HIT_KINDS.Spell, true) };
  }
  /** BOSS-DOT: one frame of the rounds - every body's that is due, out; my death ends them all. */
  const standInRound = () => rounds.frame(bodyOf, player.health > 0);
  /** WB9c: a harmful spell of mine that met a crystal (hostMagic's crystal seam). */
  function spellOnCrystal(sp, c, caster = null) {
    const cr = host.crystals().find((q) => q.crystal === c), harm = duelSpellOf(sp);
    if (!cr || !harm) return false;
    return onBody(sp, cr, harm, caster, host.landOnCrystal, `c${c}`);
  }
  /** WB11c: a harmful spell of mine that met one of his host (hostMagic's host seam). */
  function spellOnHost(sp, i, caster = null) {
    const hb = host.host().find((q) => q.host === i), harm = duelSpellOf(sp);
    if (!hb || !harm) return false;
    return onBody(sp, hb, harm, caster, host.landOnHost, `h${i}`);
  }
  /** ARENA4b: A HARMFUL SPELL OF MINE THAT MET MY OPPONENT (hostMagic's duel seam): out to the referee as a spell - its own
   *  sequence, PVP-REF's three casts in five seconds and its spell cap deciding what lands (swingOnRival's road); its
   *  number what that cap lets land. No rider is told: the powers sleep in a bout. BOSS-DOT: and no round is carried - the
   *  referee counts every spell claim a cast, and a bout takes the referee's blow alone (BAL8, as OPEN-HAND drops what a
   *  follow-up owes a player). */
  function spellOnRival(sp) {
    const rb = host.rival(), harm = duelSpellOf(sp);
    if (!rb || !harm) return false;
    const { dealt } = countOnStandIn(harm, rb.entity, player.level, player, rolls);
    if (!(dealt >= 1)) return false;
    reportPlayerAttack({ hit: true, damage: Math.round(standInShown(dealt, arenaBlowCap({ r: ARENA_HIT.Spell }))) });   // HN1: the number pops as a blow's does
    host.nextArenaQ();
    return host.landOnRival(rb, dealt, 'spell');
  }
  /** WB4b: a harmful spell of mine that met him (hostMagic's boss seam). BOSS-DOT: its Continuous Damage carried on the
   *  shared round (it said "continuous families are not his to carry - the stand-in forgets them"). */
  function spellOnBoss(sp, caster = null) {
    const boss = host.boss(), harm = duelSpellOf(sp);
    if (!boss) return false;
    // WB8a: A SWAY ON HIM. A Pacify or a Charm in the spell is refused by his own word (world/gate/gateBoss.js bossStandIn's
    // pacifyImmune) and said so - the rest of the spell lands as it would; alone, the refusal is what met him
    const sways = spellSways(sp) && !!boss.entity.pacifyImmune;
    if (sways && now() - swayToldAt >= BOSS_SWAY_TELL_MS) { swayToldAt = now(); say(BOSS_SWAY_TEXT(boss.entity.name)); }
    // WBX7 (2026-09-26, Swololo on Discord: "soul trap didnt seem to work"): A SOUL TRAP ON HIM. The trap is laid on his
    // stand-in by the one door every spell lands through (applySpell - its rounds, its chance frozen at the cast by my
    // level, his save against a new trap, "Trap active."), and handed to the court, which keeps it on the fight's clock:
    // he is the relay's to kill, so the kill's roll is the court's, at his fall (scenes/gate/gateCourt.js). The stand-in
    // forgets it at once, as it forgets every lasting family.
    const trapFx = (sp.effects ?? []).filter((e) => e && isSoulTrapEffect(e));
    let laid = false;
    if (trapFx.length) {
      const noSink = () => {};
      // AUDIT WBX F6: a trap of mine already running on him (the court keeps it) is his incumbent for this cast - a recast
      // renews its rounds with no new save (effects.js renewRounds, STACK-CAP), where the stand-in's forgotten trap made every
      // recast a new one against his save
      const running = host.trapNow();
      if (running) boss.entity.activeEffects = [{ kind: 'soulTrap', chance: running.chance, roundsRemaining: 0 }];
      try {
        const res = applySpell({ ...sp, effects: trapFx }, player.level, boss.entity, { hurt: noSink, heal: noSink, drainFatigue: noSink, restoreFatigue: noSink, drainMagicka: noSink, restoreMagicka: noSink }, rolls, { entity: player });
        const trap = (boss.entity.activeEffects ?? []).find((a) => a.kind === 'soulTrap' && !a.ended);
        if (trap) laid = !!host.onTrap({ chance: trap.chance, rounds: (trap.roundsRemaining ?? 0) + 1 });
        if (res?.trapAlert && SOUL_TRAP_TEXT[res.trapAlert]) say(SOUL_TRAP_TEXT[res.trapAlert]);
      } catch (e) { console.warn('[gate] the trap on him', e?.message ?? e); } finally { boss.entity.activeEffects = []; }
    }
    if (!harm) return laid || sways;
    return onBody(sp, boss, harm, caster, host.landOnBoss, 'b');
  }
  /** AUDIT WB11 W1: A CAST WHEN STRIKES SPELL ON A STAND-IN OF THE COURT - the one it names: one of his host (`hostI`),
   *  a crystal (`crystalC`), else him. Every one went to his door, wherever he stood: a blade that cut an Imp cast on him. */
  function spellOnStandIn(record, target = null) {
    if (target?.hostI != null) return spellOnHost(record, target.hostI);
    if (target?.crystalC != null) return spellOnCrystal(record, target.crystalC);
    return spellOnBoss(record);
  }
  return { spellOnBoss, spellOnCrystal, spellOnHost, spellOnRival, spellOnStandIn, standInRound };
}

/**
 * BOSS-DOT: THE SEA SERPENT'S SPELL DOOR (SERPENT4's, out of bootWorld - scenes/world.js wires it): a hand's harmful missile
 * on its hide, its harmful families counted on its stand-in (`standIn()`, world.js serpentStandIn), the paths' riders told
 * what can land (a hand's purse's cap - net/serpent/serpentBrain.js SERPENT_HIT_CAP_X of SERPENT_HAND_REF), and the claim to
 * its host's hand door (`land(box, dealt)` - scenes/serpentHost.js handStruck, which holds it to 5,000 and sends it); no
 * number rises, as it never did. Its Continuous Damage carried as the court's is, each round's sum to the segment the spell
 * last met. `frame(alive)` each frame of the serpent's fight: none (the fight over, my ship's deck, my death) ends its rounds.
 * @param {{ player: any, standIn: () => any, land: (box: any, d: number) => any, now?: () => number, rolls?: () => number }} o
 */
export function createSerpentSpell({ player, standIn, land, now = Date.now, rolls = Math.random }) {
  const rounds = createStandInRounds({ now, rolls });
  let met = null;
  return {
    cast(sp, box, caster = null) {
      const harm = duelSpellOf(sp), e = standIn();
      if (!harm) return false;
      const { dealt, r, kept } = countOnStandIn(harm, e, player.level, player, rolls, rounds.carried('s'));
      if (kept.length) met = box;
      rounds.keep('s', kept);
      if (!(dealt >= 1)) return kept.length > 0;
      tellSpellLanded({ caster: player, target: e, foe: null, spell: sp, r, self: false, took: standInShown(dealt, SERPENT_HIT_CAP_X * SERPENT_HAND_REF), cast: caster?.cast ?? null });   // AUDIT SCHOOLS L2 F4: told to the riders - what can land, STAND-IN-WHOLE's law
      land(box, dealt);
      return true;
    },
    frame(alive) { rounds.frame(() => (met ? { entity: standIn(), land: (d) => land(met, d) } : null), !!alive && player.health > 0); },
  };
}
