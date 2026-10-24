// @ts-check
// EG-ZR (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 15, EG-ZP's "Not built"): THE
// VESTIGES ON THEIR HOLDER - every Vestige section 15 gives its holder's own client, applied on the holder's screen while it
// stands alive in an Elite Breach holding it, each through the door the port already has for its kind, and let go at every
// way out:
//   STONESKIN       +10 / 18 / 25% maximum health - the live maximum's online term (systems/renownLayer.js setSpireHp,
//                   read by systems/chargen.js defineLiveMaxHealth), the fraction kept as it goes on and off; the room's
//                   shares of a body stay shares of the body without it (spireBodyMax), so the points are a cushion;
//   SECOND WIND     once a hall, a hurt that takes me under 30% heals 15 / 25 / 35% - a hurt listener on the one damage
//                   door (characters/playerEntity.js registerPlayerHurtListener), never a killing blow a save turned aside;
//   SPELLBANE       every resistance +10 / 18 / 25 - the resist channel's fold (systems/entityMods.js) on each element the
//                   saving throw names (systems/loot/lootRarity.js RESIST_ELEMENTS), as the Battlemage's Bearing rides it;
//   BATTLEMAGE'S FOCUS  spell cost -10 / 18 / 25% - the cost modifiers (systems/spellcost.js registerSpellCostMod);
//   SHIELDWEAVER    my own Shield spell soaks +20 / 35 / 50% - the Shield pool's soak (characters/playerEntity.js
//                   registerShieldSoakMod), a party mate's Shield on me as it was;
//   FLEETFOOT       run speed +4 / 7 / 10% - the run's modifiers (player/motor.js registerRunSpeedMod);
//   FEATHERSTEP     my crumbles wait +0.2 / 0.35 / 0.5 s (scenes/eliteGates/egSpan.js reads spireCrumbleWait); its cast-back cost is
//                   the census's own law (net/eliteGates/egBrain.js egCastBackCost, scenes/eliteGates/egClient.js castBack); AUDIT EG III (lane1
//                   #5): LONG STEP, the Cantrip, +0.5 s more for one span on the same reading (the holder's `ls`);
//   and ON A BLOW of mine on a Spire body - SEARING EDGE, MOMENTUM, BLOODIED FURY, OVERCHARGE (egHolderBlow) and ARCANE
//   ECHO's repeat - at the one door every such blow leaves by (scenes/eliteGates/egFight.js hostHit), where the relay's bucket, grown
//   by the declared factor (net/eliteGates/egVestige.js egDeclaredX), meets the claim.
// The holder - `{ entity, vs, mast, b, h }`, its Vestiges as the room says its run - is handed in every frame by the
// breach's client (scenes/eliteGates/egClient.js, spireHolderStep): null outside the Spire, as a witness, or once the room counts me
// out, and every door here then answers as if nothing were held. Every number is net/eliteGates/egVestige.js's, never declared again.
// EG-ZS (2026-10-12, section 15's resonance; EG-ZR's "Not built"): two capstones' client halves -
//   SPELLWEAVE (Arcana's)  every fourth damage spell costs nothing - my damage spells counted as each leaves the hands
//                   (systems/playerCasts.js registerPlayerCastListener), the next priced at nothing when it is the fourth
//                   (systems/spellcost.js registerSpellFreeCast - the ready, the spend and the book's figure all read it);
//   RALLYING CRY (Fellowship's)  every Second Wind in the company refreshes when a hall's door opens - the holder's `dn` (the
//                   door's instant, the room's) and `cry` (a living member of the company resonating in Fellowship) handed in
//                   with it; a Second Wind spent in this hall is mine again from the door.
// AUDIT EG III (2026-10-13, section 27.5's last rows): THE HOLDER'S NEWS - a Second Wind taken (its points), Spellweave's free
// spell leaving the hands and Rallying Cry giving back a spent Second Wind, each kept for the breach client to say as a beat on
// THE SPIRE MIX (`spireVestigeNews`, drained by scenes/eliteGates/egClient.js; let go with the holder), and whether my next damage spell
// is Spellweave's free one (`spireWeaveReady` - its chip).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egVOf, EG_SECOND_WIND_UNDER, EG_MOMENTUM_STEP } from '../../net/eliteGates/egVestige.js';
import { egResonance, EG_WEAVE_N } from '../../net/eliteGates/egVestige.js';   // EG-ZS: Spellweave's resonance and its fourth spell
import { registerSpellFreeCast } from '../spellcost.js';   // EG-ZS: Spellweave's free cast
import { registerPlayerCastListener } from '../playerCasts.js';   // EG-ZS: my casts, told as they leave the hands
import { isDamageHealthEffect } from '../spellcast.js';   // EG-ZS: a damage spell (Damage Health, its continuous twin)
import { HIT_KINDS } from '../../net/gate/gateBrain.js';
import { registerEntityFold, computeEntityMods, newMods, EMPTY_MODS } from '../entityMods.js';
import { RESIST_ELEMENTS } from '../loot/lootRarity.js';   // the five elements the resistance channel names (EG15's Bearing reads them too)
import { registerSpellCostMod } from '../spellcost.js';
import { registerPlayerHurtListener, registerShieldSoakMod } from '../../characters/playerEntity.js';
import { registerRunSpeedMod } from '../../player/motor.js';
import { setSpireHp, spireBodyMax } from '../renownLayer.js';
import { healMine } from '../playerHeal.js';

/** The registries' one name. */
export const SPIRE_VESTIGES = 'spire-vestiges';

/** @type {{ entity: any, vs: number[][], mast: number, b: string, h: number, ls?: boolean } | null} the holder this frame */
let _held = null;
/** AUDIT EG III (lane4 #10): the holder handed in last, and the entity - the same again is the same holder, made once */
let _from = null, _fromEntity = null;
/** AUDIT EG III (lane1 #5) - LONG STEP (section 17.2: "your crumbles wait +0.5 s for one span (private, as crumbles are)"):
 *  the half second more, while the breach's client says it holds (the holder's `ls`). */
export const EG_LONG_STEP_S = 0.5;
/** Spellbane's value the fold last answered (a change folds the entity again); the breach's hall Second Wind was spent in */
let _bane = 0, _wind = '';
/** EG-ZS: the door Rallying Cry last refreshed Second Wind at (`b:h:dn`); my damage spells cast while Spellweave was mine */
let _cried = '', _woven = 0;
/** AUDIT EG III: what the holder's doors did since the breach client last asked (`{ k, t }` - a key of ui/eliteGates/egBeats.js EG_BEATS) */
const _news = [];

/** The holder's value of a Vestige (0 none, or nothing held, or another entity). */
const heldV = (key, entity = _held?.entity) => (_held && entity === _held.entity ? egVOf(_held.vs, key) : 0);

/**
 * THE HOLDER, THIS FRAME (scenes/eliteGates/egClient.js, every frame and at `away`): `holder` - `{ vs, mast, b, h }` while I stand
 * alive in the breach the room counts me in, null otherwise. Stoneskin's points put on the entity (or taken off - the
 * fraction kept), and Spellbane's fold folded again when its value moved; every other door reads the holder live. EG-ZS:
 * RALLYING CRY - with `cry` (a living member of my company resonates in Fellowship) and the hall's door open (`dn`, its instant
 * on the room's clock), a Second Wind spent in this hall is mine again, once a door. AUDIT EG III: the same holder handed in
 * again (the client's memo - lane4 #10) is the one held, made once; `ls` LONG STEP holding (lane1 #5).
 * @param {any} entity @param {{ vs: number[][], mast: number, b: string, h: number, dn?: number, cry?: boolean, ls?: boolean } | null} holder
 */
export function spireHolderStep(entity, holder) {
  if (holder !== _from || entity !== _fromEntity) { _from = holder; _fromEntity = entity; _held = holder && entity ? { entity, vs: holder.vs ?? [], mast: holder.mast ?? -1, b: holder.b ?? '', h: holder.h | 0, ...(holder.ls === true ? { ls: true } : {}) } : null; }
  if (!_held) _news.length = 0;   // AUDIT EG III: nothing held, nothing to say
  if (_held && holder?.cry === true && holder.dn > 0 && _cried !== `${_held.b}:${_held.h}:${holder.dn}`) {
    _cried = `${_held.b}:${_held.h}:${holder.dn}`;
    if (_wind === `${_held.b}:${_held.h}`) _news.push({ k: 'rallyingCry' });   // AUDIT EG III: a wind spent in this hall given back, said
    _wind = '';
  }
  if (!entity) return;
  const skin = heldV('stoneskin', entity);
  setSpireHp(entity, skin ? Math.round(spireBodyMax(entity) * skin) : 0);
  const bane = heldV('spellbane', entity);
  if (bane !== _bane) { _bane = bane; computeEntityMods(entity); }
}
/** AUDIT EG IV (lane10 #14; section 15) - RALLYING CRY AT A COURT'S PHASE TURN: the room's word (`eheal` `cry` - net/eliteGates/egBrain.js
 *  rallyingCry) gives back a Second Wind spent in this hall, said as the door's refresh says it. Answers whether one was given
 *  back. */
export function spireRallyingCry() {
  if (!_held) return false;
  const spent = _wind === `${_held.b}:${_held.h}`;
  if (spent) _news.push({ k: 'rallyingCry' });
  _wind = '';
  return spent;
}
/** The holder as this frame has it (tests). */
export const spireHeld = () => _held;

/** FEATHERSTEP: how much longer my crumbles wait (s) - 0 with none held. AUDIT EG III (lane1 #5): and LONG STEP's half second
 *  while it holds. */
export const spireCrumbleWait = () => heldV('featherstep') + (_held?.ls ? EG_LONG_STEP_S : 0);

/**
 * A BLOW OF THE HOLDER'S ON A SPIRE BODY (section 15's client Vestiges on a blow): `d` what the game's own law dealt, `r` its
 * kind (net/gate/gateBrain.js HIT_KINDS). Searing Edge's fire on a melee blow (whole: every body of the Spire is the relay's,
 * which keeps no element, and its stand-in takes fire whole), then Momentum's `stacks` on that body (its rank's cap at
 * most), Bloodied Fury while `low` (under half my health), Overcharge on a spell. Pure.
 * @param {number[][]} vs @param {number} d @param {number} r @param {{ stacks?: number, low?: boolean }} [o]
 */
export function egHolderBlow(vs, d, r, { stacks = 0, low = false } = {}) {
  let x = d;
  if (r === HIT_KINDS.Melee) x += egVOf(vs, 'searing');
  x *= 1 + EG_MOMENTUM_STEP * Math.min(stacks, egVOf(vs, 'momentum'));
  if (low) x *= 1 + egVOf(vs, 'bloodied');
  if (r === HIT_KINDS.Spell) x *= 1 + egVOf(vs, 'overcharge');
  return x;
}

// ── the doors ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** SPELLBANE: every element the resistance channel names, +its value (the saving throw - systems/spellcast.js). */
function baneFold(entity) {
  const v = heldV('spellbane', entity);
  if (!v) return EMPTY_MODS;
  const m = newMods();
  for (const el of RESIST_ELEMENTS) m.resist[el] = v;
  return m;
}
/** BATTLEMAGE'S FOCUS: my cast's spell points less its share (the cost door rounds, and never under 1). */
const focusCost = (entity, sp) => { const v = heldV('focus', entity); return v ? sp * (1 - v) : sp; };
/** SHIELDWEAVER: a point of my own Shield's pool soaks 1 + its share - a Shield I cast on myself (a mate's gift, ALLY-CAST's,
 *  lands with no caster and is no self-cast). */
const weaverSoak = (entity, a) => (a?.bundleSelfCast ? 1 + heldV('shieldweaver', entity) : 1);
/** FLEETFOOT: the run on foot +its share. */
const fleetRun = () => 1 + heldV('fleetfoot');
/** SECOND WIND: a hurt that takes me under EG_SECOND_WIND_UNDER of my maximum heals its share of it - once a hall of the
 *  breach, never on a killing blow a death save turned aside (`saved`). */
function secondWind(entity, { before, after, saved = false }) {
  const v = heldV('secondwind', entity), max = entity?.maxHealth;
  if (!v || saved || !(after > 0) || !(max > 0)) return;
  const line = max * EG_SECOND_WIND_UNDER, hall = `${_held?.b}:${_held?.h}`;
  if (!(before >= line && after < line) || _wind === hall) return;
  _wind = hall;
  const healed = healMine(entity, max * v);
  _news.push({ k: 'secondWind', t: healed > 0 ? healed : 0 });   // AUDIT EG III: said as Shed Skin says its heal
}

/** EG-ZS - SPELLWEAVE (Arcana's capstone: "every fourth damage spell costs nothing"): a damage spell is one with a Damage Health
 *  effect or its continuous twin (systems/spellcast.js isDamageHealthEffect); while the holder resonates in Arcana each of mine
 *  that leaves the hands is counted (over the breach - `_woven` restarts in another), and the next is priced at nothing when it
 *  is the fourth, the eighth... (the ready captures the price, so the spend is nothing too). */
const damageSpell = (spell) => Array.isArray(spell?.effects) && spell.effects.some(isDamageHealthEffect);
const weaves = (entity) => !!_held && entity === _held.entity && egResonance(_held.vs).includes('arcana');
let _weaveB = '';
const weaveFree = (entity, spell) => weaves(entity) && damageSpell(spell) && _weaveB === _held?.b && _woven % EG_WEAVE_N === EG_WEAVE_N - 1;
function weaveCast(entity, spell) {
  if (!weaves(entity) || !damageSpell(spell)) return;
  if (_weaveB !== _held?.b) { _weaveB = _held?.b ?? ''; _woven = 0; }
  if (_woven % EG_WEAVE_N === EG_WEAVE_N - 1) _news.push({ k: 'spellweave' });   // AUDIT EG III: the free one left the hands
  _woven++;
}
/** AUDIT EG III: is my next damage spell Spellweave's free one (its chip) - the price door's own reading of a damage spell (a
 *  Damage Health effect, systems/spellcast.js isDamageHealthEffect's first). */
const DAMAGE_SPELL = Object.freeze({ effects: Object.freeze([Object.freeze({ type: 4, subType: 0 })]) });
export const spireWeaveReady = () => !!_held && weaveFree(_held.entity, DAMAGE_SPELL);
/** AUDIT EG III: THE HOLDER'S NEWS since the last ask, drained (scenes/eliteGates/egClient.js says each as a beat). */
export const spireVestigeNews = () => _news.splice(0);

registerEntityFold(SPIRE_VESTIGES, baneFold);
registerSpellCostMod(SPIRE_VESTIGES, focusCost);
registerShieldSoakMod(SPIRE_VESTIGES, weaverSoak);
registerRunSpeedMod(SPIRE_VESTIGES, fleetRun);
registerPlayerHurtListener(SPIRE_VESTIGES, secondWind);
registerSpellFreeCast(SPIRE_VESTIGES, weaveFree);   // EG-ZS
registerPlayerCastListener(SPIRE_VESTIGES, weaveCast);   // EG-ZS

/** Tests only: nothing held, nothing spent. */
export function _resetSpireVestigesForTests() { _held = null; _from = null; _fromEntity = null; _bane = 0; _wind = ''; _cried = ''; _woven = 0; _weaveB = ''; _news.length = 0; }
