// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SET3 (2026-09-26) — WHAT THE SETS DO.
//
// The law (systems/sigilSets.js) says which tiers are awake and every
// number in them; this file does what each tier says, through the seams
// SET2 opened - registered here at import, each a no-op for anyone but
// MY entity with the set worn and awake (online, my Renown known, no
// duel). Design and numbers: bible/11-Multiplayer/Sigil-Sets.md.
//
//   the 2-piece stat tiers     an entity FOLD (RF1): armour a part,
//                              attributes, skills, a resistance -
//                              liveStat, skillValue, the hit formula
//                              and the saving throw read them
//   Bloodfury, Rampage,        the BLOW modifier (my weapon's blow at
//   Nightfall, the Burning     a foe, under either core): per cents
//   Gate's sear, the Wrath's   summed and taken of the whole blow, the
//   fury                       fraction carried per weapon; a flat sear
//   Cleave                     a STRIKE listener (AUDIT SET M2: the
//                              blow that LANDED, the formula's final
//                              damage): the nearest other foe near the
//                              one struck takes its share through the
//                              door (systems/playerDoor.js)
//   Spite of the Spurned       a STRUCK listener: the foe that struck
//                              me takes its share back, through the door
//   Unbroken                   a DEATH SAVE and a DAMAGE modifier on my
//                              one damage door
//   Wrath of the Warden        a HURT listener: the Nova through the door
//   Rampage, Eventide          the player's KILL listener
//   Waters of Oblivion         a player's CAST COST modifier
//   Eye of Mora                an ABSORPTION chance
//
// RAID4b (2026-09-28) - THE RAIDING PARTIES' OWN SETS, through the same seams (bible/03-World/Raiding-Parties.md, "The
// rewards (RAID4)"; the numbers in Sigil-Sets.md section 6b):
//   Oath of the Watch,         the FOLD
//   Keen-Eyed, Thick-Skinned
//   Riposte, Blood for Blood   the HURT listener arms them (a foe's blow that took health); the BLOW spends Riposte and
//                              reads the Blood's stacks
//   Run Them Down, No Escape   the BLOW (a foe under half health; the marked foe); No Escape's mark is the KILL's
//   Hold the Line, Iron Hide   the DAMAGE modifier (under half health; the ward's points); Iron Hide's ward the KILL's
//
// SERPENT-SET (2026-10-05) - THE OLD COIL'S OWN, Sethrakul's Coilscale (Sigil-Sets.md section 6c), through the same seams:
//   Sea-Scale                  the FOLD
//   Constrict                  the STRIKE listener tightens the coil (a weapon blow that LANDED on a foe, a bow's too);
//                              the BLOW reads its stacks at the coiled foe; the KILL of that foe ends it - AUDIT 625 P3
//                              (Mac: "A coil per foe"): every foe its own coil
//   Shed Skin                  the HURT listener: a foe's blow that takes me under its line heals me
//                              (systems/playerHeal.js, the loot's own heal)
//
// SD9d (2026-10-07) - THE BRASS OF NUMIDIUM, the Brass Remnant's own (bible/11-Multiplayer/Super-Dungeons.md section 11),
// through the same seams:
//   Dwemer Brass               the FOLD (magic and shock resistance)
//   Gearward                   the DAMAGE modifier: while the gear is wound, a foe's BLOW (the door's mark - never a
//                              fall, a poison's round or a spell) lands its share lighter, and the gear winds again
//   The Hour Turns             a DEATH SAVE (Unbroken's door, tried after it): the killing blow leaves me at 1, and the
//                              HURT listener heals its share as the door says so (the loot's own heal)
//
// THE CLOCK is real seconds (performance.now): an online session never
// pauses, and a recovery is a thing a player times with a watch. What a
// power remembers (a recovery, a halving window, the Rampage) lives here
// for the session - a reload starts every power ready, which is no
// exploit worth a save field (Unbroken recovers in at most five minutes).
// ═══════════════════════════════════════════════════════════════════

import { SKILLS, MAGIC_SKILLS } from './skills.js';
import { registerEntityFold, registerWeaponBlowMod, newMods, EMPTY_MODS, NUMBER_BODY_PARTS } from './entityMods.js';
import { registerPlayerStruckListener, registerPlayerStrikeListener } from '../combat/formulas.js';
import { registerPlayerDamageMod, registerPlayerDeathSave, registerPlayerHurtListener, registerPlayerDoorOpen } from '../characters/playerEntity.js';
import { registerPlayerKillListener } from './playerKills.js';
import { registerSpellCostMod } from './spellcost.js';
import { healMine } from './playerHeal.js';   // SERPENT-SET: Shed Skin heals through the loot's own heal
import { registerAbsorptionChance } from './absorption.js';
import { registerMagicRoundHook } from './worldTick.js';
import { playerDoor } from './playerDoor.js';
import { hudText } from './notify.js';
import { weaponSkillUsed } from '../characters/weapons.js';
import { friendlyProtected } from '../combat/playerWeapon.js';
import { careerTolerance, EFFECT_FLAGS } from './spellcast.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import {
  wornSets, setsAwake, RAMPAGE_SECONDS, RAMPAGE_STACKS, CLEAVE_METRES, WRATH_BELOW, NOVA_METRES, WRATH_SECONDS,
  RIPOSTE_SECONDS, MARK_METRES, MARK_SECONDS, BLOOD_SECONDS, BLOOD_STACKS, COIL_STACKS, COIL_SECONDS, SHED_BELOW,
} from './sigilSets.js';

// ── the session's memory, and its voice ────────────────────────────
let _now = () => performance.now() / 1000;
const fresh = () => ({
  unbrokenReady: 0, halvedUntil: 0,   // Malacath (6)
  wrathReady: 0, wrathUntil: 0,       // Ruhn (6)
  eventideReady: 0,                   // Nocturnal (6)
  rampage: 0, rampageUntil: 0,        // Dagon (6)
  riposteUntil: 0,                    // RAID4b: the Broken Oath (4)
  marked: null, markUntil: 0,         // RAID4b: the Thief-Taker's Garb (6) - the marked foe's entity
  blood: 0, bloodUntil: 0,            // RAID4b: Orcsbane Harness (4)
  ward: 0, wardReady: 0,              // RAID4b: Orcsbane Harness (6) - the ward's points left
  coils: new WeakMap(),               // SERPENT-SET: Sethrakul's Coilscale (4) - AUDIT 625 P3: each foe's own coil, entity -> { n, until }
  coilFoe: null,                      // the foe my last landed blow coiled - the one the states say
  shedReady: 0,                       // SERPENT-SET: Sethrakul's Coilscale (6)
  gearReady: 0,                       // SD9d: the Brass of Numidium (4) - when the gear is wound again
  hourReady: 0, hourHeal: 0,          // SD9d: the Brass of Numidium (6) - its recovery, and the heal its save owes
  recovering: new Set(),              // the powers whose "ready again" is still to be said
});
let _s = fresh();
/** The host's voice (scenes/world.js): a line on the HUD, and a sound by the power's name ('unbroken', 'wrath',
 *  'eventide'; RAID4b 'mark', 'ward'; SERPENT-SET 'shed'). The line defaults to the HUD's own door; the sound to none. */
let _say = (line) => { hudText(line); };
let _sound = null;   // SD9d: and 'gear', 'hour'
export function setSetPowersVoice({ say = null, sound = null } = {}) {
  if (typeof say === 'function') _say = say;
  _sound = typeof sound === 'function' ? sound : null;
}
const sound = (name) => { try { _sound?.(name); } catch { /* a sound is not the power's problem */ } };
/** AUDIT SET L10: the voice, never the power's problem - Unbroken's save had spent its recovery before a voice that
 *  threw could say so, and a throw there turned the save into a death. */
const say = (line) => { try { _say(line); } catch { /* a line is not the power's problem */ } };

/** THE ONE READ: every set MY entity wears, as `id -> [tier 1's numbers | null, tier 2's, tier 3's]` - awake tiers only;
 *  null for anyone but me, or while sets sleep. */
export function awakeTiersOf(entity) {
  if (!entity?.isPlayer || entity.peer || !setsAwake()) return null;
  const out = new Map();
  for (const st of wornSets(entity, undefined, undefined, { text: false })) out.set(st.id, st.tiers.map((t) => (t.awake ? t.values : null)));   // AUDIT SET L5: the numbers alone - the HUD and every blow ask, and no reader here reads a tier's words
  return out;
}
const tierOf = (entity, id, i) => awakeTiersOf(entity)?.get(id)?.[i] ?? null;

// ── the 2-piece stat tiers: the fold ────────────────────────────────
const add = (rec, key, v) => { rec[key] = (rec[key] ?? 0) + v; };
/** The awake stat tiers as one mods record (RF1's channels) - EMPTY for anyone but me. */
export function setFold(entity) {
  const t = awakeTiersOf(entity);
  if (!t || !t.size) return EMPTY_MODS;
  let mods = null;
  const m = () => (mods ??= newMods());
  const mal = t.get('malacath')?.[0];
  if (mal) { for (let p = 0; p < NUMBER_BODY_PARTS; p++) m().armorParts[p] += mal.armor; add(m().stats, 'endurance', mal.endurance); }
  const dag = t.get('dagon')?.[0];
  if (dag) { add(m().stats, 'strength', dag.strength); add(m().skills, SKILLS.CriticalStrike, dag.critical); }
  const noc = t.get('nocturnal')?.[0];
  if (noc) { add(m().skills, SKILLS.Stealth, noc.stealth); add(m().stats, 'agility', noc.agility); }
  const mor = t.get('mora')?.[0];
  if (mor) { add(m().stats, 'intelligence', mor.intelligence); for (const s of MAGIC_SKILLS) add(m().skills, s, mor.schools); }
  const ruhn = t.get('ruhn')?.[0];
  if (ruhn) add(m().resist, 'fire', ruhn.fire);
  const oath = t.get('oath')?.[0];   // RAID4b: Oath of the Watch
  if (oath) { for (let p = 0; p < NUMBER_BODY_PARTS; p++) m().armorParts[p] += oath.armor; add(m().stats, 'willpower', oath.willpower); }
  const keen = t.get('thieftaker')?.[0];   // RAID4b: Keen-Eyed
  if (keen) { add(m().stats, 'agility', keen.agility); add(m().skills, SKILLS.Archery, keen.archery); }
  const hide = t.get('orcsbane')?.[0];   // RAID4b: Thick-Skinned
  if (hide) { add(m().stats, 'endurance', hide.endurance); add(m().skills, SKILLS.BluntWeapon, hide.blunt); }
  const scale = t.get('coilscale')?.[0];   // SERPENT-SET: Sea-Scale
  if (scale) { add(m().resist, 'frost', scale.frost); add(m().stats, 'endurance', scale.endurance); }
  const brass = t.get('numidium')?.[0];   // SD9d: Dwemer Brass
  if (brass) { add(m().resist, 'magic', brass.magic); add(m().resist, 'shock', brass.shock); }
  return mods ?? EMPTY_MODS;
}

// ── the blow ────────────────────────────────────────────────────────
/** The Rampage's standing stacks now - none once its window has run out. */
export const rampageStacks = (now = _now()) => (now < _s.rampageUntil ? _s.rampage : 0);
/** RAID4b: Blood for Blood's standing stacks now, and the foe No Escape has marked (its entity) - none once its window
 *  has run out. */
export const bloodStacks = (now = _now()) => (now < _s.bloodUntil ? _s.blood : 0);
export const markedFoe = (now = _now()) => (now < _s.markUntil && !(_s.marked?.health <= 0) ? _s.marked : null);   // AUDIT SETS L1: a mark on a body is none (a peer's kill of it reaches no setKill of mine)
/** SERPENT-SET, AUDIT 625 P3 (Mac: "A coil per foe"): A FOE'S OWN COIL - its stacks now, none once its window has run
 *  out, or over a body (a peer's kill of it reaches no setKill of mine: the mark's own law). One coil once, moved to
 *  whichever foe a blow landed on last, so a swing that met two foes - a crowd's, a sweep's - unwound it on each in
 *  turn and never built it; every foe holds its own now, each its stacks and its window. */
export const coilStacksAt = (foe, now = _now()) => {
  const c = foe && !(foe.health <= 0) ? _s.coils.get(foe) : null;
  return c && now < c.until ? c.n : 0;
};
/** The foe my last landed blow coiled, while its coil holds, and its stacks (the states' - a card's, the pins'). */
export const coiledFoe = (now = _now()) => (coilStacksAt(_s.coilFoe, now) ? _s.coilFoe : null);
export const coilStacks = (now = _now()) => coilStacksAt(_s.coilFoe, now);
const belowHalf = (e) => Number.isFinite(e?.health) && e.maxHealth > 0 && e.health < e.maxHealth / 2;
const ranged = (w) => weaponSkillUsed(w?.templateIndex) === SKILLS.Archery;
/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();
/**
 * MY weapon's blow at a foe: the per cents of Bloodfury (twice below half health), the Rampage's stacks, Nightfall at a
 * foe that had not noticed me (`info.unaware`) and the Wrath's fury - RAID4b: and Riposte (the one blow it sharpens,
 * spent by it), Run Them Down at a foe under half health, No Escape at the marked foe and Blood for Blood's stacks -
 * SERPENT-SET: and Constrict's stacks at the coiled foe - summed and taken of the whole blow with the fraction carried on the weapon; then the Burning Gate's sear, flat. And
 * from the same blow, Cleave: the nearest other foe within CLEAVE_METRES of the one struck takes its share of the blow
 * - a MELEE blow (never a bow's or the Thunderlock's). Nothing for a miss, a blow at a player (a duel), a peer's blow
 * resolved here, or a foe's.
 */
export function setBlow(weapon, damage, attacker, target, info) {
  if (!(damage > 0) || !attacker?.isPlayer || attacker.peer || !target || target.isPlayer) return damage;
  if (target.warded) return damage;   // AUDIT SETS L4: the Warden's ward turns the blow whole - Riposte is not spent on it (dungeonContext.js gateBossBody marks his stand-in)
  const t = awakeTiersOf(attacker);
  if (!t || !t.size) return damage;
  const now = _now();
  let pct = 0, flat = 0;
  const dag = t.get('dagon');
  if (dag?.[1]) pct += dag[1].more * (belowHalf(attacker) ? 2 : 1);
  if (dag?.[2]) pct += dag[2].stack * rampageStacks(now);
  const noc = t.get('nocturnal');
  if (noc?.[1] && info?.unaware) pct += noc[1].more;
  const ruhn = t.get('ruhn');
  if (ruhn?.[0] && !fireProof(target)) flat += ruhn[0].sear;   // AUDIT SET L7: the gate's fire, never on a foe the fire cannot touch
  if (ruhn?.[2] && now < _s.wrathUntil) pct += ruhn[2].more;
  const oath = t.get('oath');
  if (oath?.[1] && now < _s.riposteUntil) { pct += oath[1].more; _s.riposteUntil = 0; }   // RAID4b: Riposte - the next blow alone
  const taker = t.get('thieftaker');
  if (taker?.[1] && belowHalf(target)) pct += taker[1].more;   // RAID4b: Run Them Down
  if (taker?.[2] && markedFoe(now) === target) pct += taker[2].more;   // RAID4b: No Escape
  const orcs = t.get('orcsbane');
  if (orcs?.[1]) pct += orcs[1].stack * bloodStacks(now);   // RAID4b: Blood for Blood
  const coil = t.get('coilscale');
  if (coil?.[1]) pct += coil[1].stack * coilStacksAt(target, now);   // SERPENT-SET: Constrict, at that foe's own coil (AUDIT 625 P3)
  let out = damage;
  if (pct > 0) {
    const key = weapon ?? attacker;
    const exact = (damage * pct) / 100 + (_carry.get(key) ?? 0);
    const more = Math.floor(exact + 1e-9);
    _carry.set(key, Math.max(0, exact - more));
    out += more;
  }
  out += flat;
  return out;   // AUDIT SET M2: Cleave shares the blow that LANDED - setStrike, at the formula's tail
}
/** AUDIT SET M2: MY WEAPON'S BLOW, LANDED (formulas.js registerPlayerStrikeListener - the attack's final damage, after
 *  either core's crits, materials and armour): Cleave's share of it, a MELEE blow's alone. Taken here, at the blow
 *  modifiers, the share was of a number PCAAO then reduced for the struck foe's armour alone, so its neighbour could take
 *  more than it did. SERPENT-SET: and Constrict's coil tightens - a bow's blow too (the tier says a weapon blow). */
export function setStrike(attacker, target, damage, weapon) {
  if (!(damage > 0) || !weapon) return;
  coiled(attacker, target);
  if (ranged(weapon)) return;
  const v = tierOf(attacker, 'ruhn', 1);
  if (v) cleave(target, (damage * v.share) / 100, weapon);
}
/** SERPENT-SET, CONSTRICT: a weapon blow of mine that LANDED on a foe tightens the coil on it - a stack more, up to
 *  COIL_STACKS, its window renewed to COIL_SECONDS; a blow that lands on another foe starts that foe's own coil, and the
 *  first keeps its own (AUDIT 625 P3, Mac: "A coil per foe"). Never on a player (a duel: the sets sleep), and only while
 *  the tier is awake on me. */
function coiled(attacker, target) {
  if (!target || target.isPlayer || !tierOf(attacker, 'coilscale', 1)) return;
  const now = _now();
  _s.coils.set(target, { n: Math.min(COIL_STACKS, coilStacksAt(target, now) + 1), until: now + COIL_SECONDS });   // AUDIT 625 P3: its own
  _s.coilFoe = target;
}

const flat2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** AUDIT SET M4: a reach power's reach in height - a foe a storey above or below is on another floor, not beside me. */
export const REACH_RISE_M = 2.5;
const rise = (a, b) => Math.abs((a[1] ?? 0) - (b[1] ?? 0));
/** AUDIT SET H1: WHO A REACH POWER SPARES - my own allies (a summoned daedra, a quest's companion) and a foe at peace
 *  with me (Calmed, talked down, a quest's non-hostile): the melee swing's own rule, never the setting's to turn off
 *  (combat/playerWeapon.js friendlyProtected - a swing is aimed, Cleave and the Nova are not). A blow on either went
 *  through the pool's door as mine, turned the ally and woke the whole area. */
const spared = (f) => friendlyProtected(f, { protection: true });
/** AUDIT SET L7: a foe the gate's fire cannot touch (a fire daedra's IMMUNITY, the career's own word). */
const fireProof = (entity) => careerTolerance(entity?.career ?? {}, EFFECT_FLAGS.Fire) === 'Immune';
/** Cleave: the nearest other live foe within CLEAVE_METRES of the struck one takes `amount` (whole, at least 1) - never
 *  an ally or a foe at peace (H1), never one on another floor (M4), never one my weapon's metal cannot bite (M2: the
 *  formula's own `minMetalToHit` refusal, which the struck foe had to pass and its neighbour never was asked), and
 *  (AUDIT FINAL F11, the page's own word) never one behind a wall from the struck foe - the host's own ray, as the Nova
 *  asks it (`door.clear`), and only of a foe nearer than the best so far. */
function cleave(targetEntity, amount, weapon) {
  const door = playerDoor();
  if (!door || !(amount > 0)) return;
  const foes = door.foes();
  const struck = foes.find((f) => f.entity === targetEntity);
  if (!struck?.ai?.feet) return;
  let best = null, bestD = CLEAVE_METRES;
  for (const f of foes) {
    if (f === struck || f.dead || !f.ai?.feet || spared(f)) continue;
    if (rise(f.ai.feet, struck.ai.feet) > REACH_RISE_M) continue;
    if ((f.entity?.minMetalToHit ?? -1) > (weapon?.material ?? 0)) continue;
    const d = flat2(f.ai.feet, struck.ai.feet);
    if (d > bestD) continue;
    if (door.clear && !door.clear(struck.ai.feet, f.ai.feet)) continue;
    bestD = d; best = f;
  }
  if (best) door.hurtFoe(best, Math.max(1, Math.round(amount)));
}

// ── a foe's blow at me: struck, then landed ─────────────────────────
// AUDIT SET L2/L3: THE BLOW, AND WHAT IT DID. The formula's struck tail names the foe whose blow reached me - before my
// damage door has decided what it does: the trial's veto withholds it, a Shield spell's pool swallows it, Unbroken
// halves it. Spite answered the tail, so a blow the Shield took whole was paid back; and the Wrath answered every
// hurt, a fall's and a poison's too. So the tail only MARKS the blow, and the door's word on it (the hurt, in the same
// call) is what both answer: Spite pays back its share of the health the blow took, the Wrath wakes only on a blow.
/** How long a marked blow waits for the door (the tail and the door run in one call; this only bounds a mark nobody
 *  took, so a later poison tick is never read as the blow). */
export const BLOW_WINDOW_S = 0.1;
let _blow = null;
export function setStruck(attacker, target, damage) {
  if (!target?.isPlayer || target.peer) return;
  _blow = damage > 0 && attacker ? { attacker, at: _now() } : null;
}
/** AUDIT SETS L3: THE BLOW A HOST HOLDS BACK - the arrest flow's "surrender or fight on" withholds a guard's blow and
 *  lands it seconds later, when the mark had long lapsed (Riposte, Blood for Blood and Spite never heard it), and a
 *  blow withheld for good left its mark lying for the next hurt. A host keeps the mark (`heldPlayerBlow`) and marks it
 *  again as the blow lands (`remarkPlayerBlow`); a blow it withholds is the door's word "nothing"
 *  (playerEntity.js playerBlowCameToNothing). */
export const heldPlayerBlow = () => (_blow && _now() - _blow.at <= BLOW_WINDOW_S ? { attacker: _blow.attacker } : null);
export function remarkPlayerBlow(b) { if (b?.attacker) _blow = { attacker: b.attacker, at: _now() }; }
/** The mark, taken - or null for a hurt no foe's blow dealt (a mark older than the window is nobody's). */
function landedBlow() {
  const b = _blow;
  _blow = null;
  return b && _now() - b.at <= BLOW_WINDOW_S ? b : null;
}
/** Spite of the Spurned: the foe that struck me takes its share of what its blow took from me. */
function spite(entity, blow, took) {
  const v = tierOf(entity, 'malacath', 1);
  if (!v || !(took > 0)) return;
  const door = playerDoor();
  const f = door?.foes().find((x) => x.entity === blow.attacker);
  if (f) door.hurtFoe(f, Math.max(1, Math.round((took * v.back) / 100)));
}

// ── the damage I take: Unbroken's halving, Hold the Line, Iron Hide ──
function unbrokenHalves(entity, dmg) {
  return _now() < _s.halvedUntil && tierOf(entity, 'malacath', 2) ? Math.floor(dmg / 2) : dmg;   // AUDIT SET L1: whole points - a half point left health fractional, and a later blow of the rest spent Unbroken's save on a wound that was never lethal
}
/** RAID4b: Hold the Line's share of a hurt, in whole points - the fraction carried to the next hurt (the blow's own
 *  law), so a Faint tenth takes a point of every ten a run of small blows deals, not none of them. */
let _holdOwed = 0;
/** THE DAMAGE MODIFIER (my one damage door, before a Shield spell's pool): Unbroken's halving, then (RAID4b) Hold the
 *  Line while I stand under half health, then Iron Hide's ward, spent point for point on whatever is left. */
export function setDamageMod(entity, dmg) {
  let d = unbrokenHalves(entity, dmg);
  const hold = tierOf(entity, 'oath', 2);
  if (hold && d > 0 && belowHalf(entity)) {
    const owed = (d * hold.less) / 100 + _holdOwed;
    const cut = Math.min(d, Math.floor(owed + 1e-9));
    _holdOwed = owed - cut;
    d -= cut;
  }
  if (_s.ward > 0 && d > 0 && tierOf(entity, 'orcsbane', 2)) {
    const took = Math.min(_s.ward, d);
    _s.ward -= took;
    d -= took;
  }
  // SD9d: GEARWARD - a foe's blow (the door's mark, never a fall or a spell) while the gear is wound lands lighter, in whole
  // points, and the gear winds again
  const gear = d > 0 && (_pending || _pendingBoss) ? tierOf(entity, 'numidium', 1) : null;   // AUDIT SD: and a world boss's blow
  if (gear) {
    const now = _now();
    if (now >= _s.gearReady) {
      const cut = Math.round((d * gear.lighter) / 100);
      if (cut > 0) {   // AUDIT SD: a blow too small to lighten by a whole point spends no winding
        d -= cut;
        _s.gearReady = now + gear.recover;
        sound('gear');
      }
    }
  }
  return d;
}
export function setDeathSave(entity) {
  const v = tierOf(entity, 'malacath', 2);
  if (!v) return hourTurns(entity);   // SD9d: no Bulwark worn - the Brass's own save (the two are never worn at once: 6 and 6 is past nine places)
  const now = _now();
  if (now < _s.unbrokenReady) return false;
  _s.unbrokenReady = now + v.recover;
  _s.halvedUntil = now + v.halved;
  _s.recovering.add('unbroken');
  say(`Unbroken! Damage halved for ${v.halved} s.`);   // WB13b
  sound('unbroken');
  return true;
}

/** SD9d, THE HOUR TURNS: a blow that would kill me does not - the door leaves me at 1 - and, as it says so (setHurt), its
 *  share of my health returns; then it recovers. */
function hourTurns(entity) {
  const v = tierOf(entity, 'numidium', 2);
  if (!v) return false;
  const now = _now();
  if (now < _s.hourReady) return false;
  _s.hourReady = now + v.recover;
  _s.hourHeal = v.heal;
  _s.recovering.add('hour');
  sound('hour');
  return true;
}

// AUDIT FINAL F10: THE DOOR TAKES THE MARK AS IT OPENS, not when a hurt lands. Only a landed hurt had taken it, so a
// blow the door swallowed (the veto, Unbroken halving 1 to 0, a Shield spell's pool) or a party weighed to nothing left
// it lying, and the next hurt inside the window - an orc's Fireball, a poison's round - was read as that blow: the
// Wrath's Nova on a spell, Spite paying a rat for a fall.
let _pending = null;
/** AUDIT SD: A WORLD BOSS'S BLOW. The Brass Remnant strikes through the court's door, never the attack formula's struck
 *  tail, so its blows carry no foe's mark - no reach power answers a world boss (Sigil-Sets.md section 8). The one
 *  power its own set brings to the fight it drops in, Gearward, reads this mark of its own instead: the Remnant's
 *  driver marks a body's own blow as it lands (scenes/sdRemnantBlows.js bodysBlow - never the Hour's magic, never the
 *  burning brass); nothing else reads it. */
let _bossBlowAt = -Infinity, _pendingBoss = false;
export function setBossStruck() { _bossBlowAt = _now(); }
function setDoorOpen(entity) {
  if (!entity?.isPlayer || entity.peer) return;
  _pending = landedBlow();
  _pendingBoss = _now() - _bossBlowAt <= BLOW_WINDOW_S;
  _bossBlowAt = -Infinity;
}
/** LOOT4 (the Loot arc, bible/06-Systems/Loot-Arc.md section 6): THE BLOW THIS HURT CARRIES - the foe's blow the door
 *  took as it opened (`{ attacker }`), or null: a fall, a poison's round, a spell. Read by a damage modifier asked before
 *  the hurt lands (the loot's ward, hex and evasion answer a foe's BLOW and nothing else), so the one law of what a blow
 *  is - the struck tail's mark, taken by the door as it opens - is this file's alone. */
export const pendingPlayerBlow = () => (_pending ? { attacker: _pending.attacker } : null);
/** LOOT4: A FOE'S BLOW LANDED - named listeners `fn(entity, attacker, took)`, told when the door's blow took health
 *  (the moment Spite answers), whatever set is worn: the loot's thorns, hexes and charges answer it. A name
 *  re-registered replaces, `null` removes; one that throws is skipped. */
const _landed = new Map();
export function registerPlayerBlowLanded(name, fn) { if (typeof fn === 'function') _landed.set(name, fn); else _landed.delete(name); }

// ── Wrath of the Warden: a blow that leaves me under the line ───────
export function setHurt(entity, { before, after, saved = false }) {
  if (!entity?.isPlayer || entity.peer) return;
  const blow = _pending;
  _pending = null;
  _pendingBoss = false;   // AUDIT SD: the boss's mark is this hurt's alone
  // SD9d: THE HOUR TURNS - the death it turned back said, and its share of my health returned, as the door left me at 1
  // (whatever dealt it: the save is a death save's, a fall's as a blow's)
  if (saved && _s.hourHeal > 0) {
    const share = _s.hourHeal;
    _s.hourHeal = 0;
    const max = entity?.maxHealth;
    const healed = max > 0 ? healMine(entity, (max * share) / 100) : 0;
    say(healed > 0 ? `The Hour Turns! ${healed} health returns.` : 'The Hour Turns!');
  }
  if (!blow) return;   // L3: a fall, a poison's tick, a spell's burn - no foe's blow, no Spite and no Wrath
  if (before - after > 0) for (const fn of _landed.values()) { try { fn(entity, blow.attacker, before - after); } catch { /* the loot is not the blow's problem */ } }   // LOOT4
  spite(entity, blow, before - after);
  if (before - after > 0) bloodied(entity);   // RAID4b: Riposte, Blood for Blood
  shed(entity, before, after, saved);   // SERPENT-SET: Shed Skin
  const v = tierOf(entity, 'ruhn', 2);
  const max = entity?.maxHealth;
  if (!v || !(max > 0) || !(after > 0)) return;
  const line = max * WRATH_BELOW;
  if (!(before >= line && after < line)) return;
  const now = _now();
  if (now < _s.wrathReady) return;
  _s.wrathReady = now + v.recover;
  _s.wrathUntil = now + WRATH_SECONDS;
  _s.recovering.add('wrath');
  const struck = nova(v.nova);
  say(struck ? `Wrath of the Warden! ${struck} ${struck === 1 ? 'foe' : 'foes'} struck.` : 'Wrath of the Warden!');   // WB12a; WB13b: the burst is seen - the count is the news
  sound('wrath');
}
/** RAID4b: A FOE'S BLOW TOOK MY HEALTH - Riposte's window opens (the next blow of mine inside it is sharpened), and
 *  Blood for Blood gains a stack, the new one refreshing every one. */
function bloodied(entity) {
  const t = awakeTiersOf(entity);
  if (!t) return;
  const now = _now();
  if (t.get('oath')?.[1]) _s.riposteUntil = now + RIPOSTE_SECONDS;
  if (t.get('orcsbane')?.[1]) {
    _s.blood = Math.min(BLOOD_STACKS, bloodStacks(now) + 1);
    _s.bloodUntil = now + BLOOD_SECONDS;
  }
}

/** SERPENT-SET, SHED SKIN: a foe's blow that takes me under SHED_BELOW of my health - from at or over it, still standing,
 *  and while it is ready - sheds my skin: its share of my health returns at once (systems/playerHeal.js), and it must
 *  recover. A blow that kills me sheds nothing (the death is another tier's: Unbroken's), nor does a fall or a spell
 *  (no foe's blow - setHurt's own law). AUDIT 625 P1: nor a killing blow a death save turned aside (`saved` - Unbroken,
 *  Divine Grace: the door left me at 1, standing) - it was a killing blow, and the save was the save; Shed Skin on top
 *  healed a second time and spent its recovery on a death it never met. */
function shed(entity, before, after, saved = false) {
  const v = tierOf(entity, 'coilscale', 2);
  const max = entity?.maxHealth;
  if (!v || !(max > 0) || !(after > 0) || saved) return;
  const line = max * SHED_BELOW;
  if (!(before >= line && after < line)) return;
  const now = _now();
  if (now < _s.shedReady) return;
  _s.shedReady = now + v.recover;
  _s.recovering.add('shed');
  const healed = healMine(entity, (max * v.heal) / 100);
  say(healed > 0 ? `Shed Skin! ${healed} health returns.` : 'Shed Skin!');
  sound('shed');
}

/** The Nova: every live foe within NOVA_METRES of my feet takes `n` - never an ally or a foe at peace (H1), one on
 *  another floor (M4), one behind a wall (M4: the host's own ray, where it has one - `door.clear`), or one the fire
 *  cannot touch (L7). Answers how many it struck. */
function nova(n) {
  const door = playerDoor();
  const feet = door?.feet();
  if (!door || !feet) return 0;
  let struck = 0;
  for (const f of door.foes()) {
    if (f.dead || !f.ai?.feet || flat2(f.ai.feet, feet) > NOVA_METRES || spared(f)) continue;
    if (rise(f.ai.feet, feet) > REACH_RISE_M || fireProof(f.entity)) continue;
    if (door.clear && !door.clear(feet, f.ai.feet)) continue;
    door.hurtFoe(f, n);
    struck++;
  }
  return struck;
}

// ── a kill of mine: the Rampage, Eventide ───────────────────────────
/** Eventide's shadow: Chameleon (classic 23,0 - it breaks when I strike) for `rounds` magic rounds, no save, no roll.
 *  AUDIT SET M5: one round MORE than it names - an effect ends at its Nth round's tick, and online the ticks fall every
 *  five seconds wherever the shared clock says, so N rounds lasted between N-1 and N of them (a Faint shadow could end
 *  at once); N+1 lasts N rounds at the least, as the card says. */
export const eventideBundle = (rounds) => ({
  name: 'Eventide', rangeType: 0, element: 4,
  effects: [{
    type: 23, subType: 0, durationBase: Math.max(1, rounds | 0) + 1, durationMod: 0, durationPerLevel: 1,
    chanceBase: 1, chanceMod: 1, chancePerLevel: 1,
    magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 1,
  }],
});
/** AUDIT SET L8: a kill that never counts - the city watch, and my own ally (Renown's own rule, net/renownTracker.js
 *  neverPays): a summoned daedra of mine fed the Rampage. */
const neverCounts = (entity) => entity?.mobileType === KNIGHT_CITY_WATCH || entity?.team === 'PlayerAlly' || entity?.mobileTeam === 'PlayerAlly';
export function setKill(entity = null) {
  if (neverCounts(entity)) return;
  const door = playerDoor();
  const me = door?.player?.();
  const t = awakeTiersOf(me);
  if (!t) return;
  const now = _now();
  if (t.get('dagon')?.[2]) {
    const had = rampageStacks(now);
    _s.rampage = Math.min(RAMPAGE_STACKS, had + 1);
    _s.rampageUntil = now + RAMPAGE_SECONDS;   // a kill refreshes them all
    if (_s.rampage > had) say(`Rampage ${'I'.repeat(_s.rampage)}`);
  }
  const noc = t.get('nocturnal')?.[2];
  if (noc && now >= _s.eventideReady) {
    _s.eventideReady = now + noc.recover;
    _s.recovering.add('eventide');
    door.castOnPlayer(eventideBundle(noc.rounds));
    say('Eventide! Nocturnal\'s shadows take you.');   // WB13b: the procs one shape
    sound('eventide');
  }
  if (entity && _s.marked === entity) _s.markUntil = 0;   // AUDIT SETS L1: the marked foe's own death ends its mark (its chip counted on over a body)
  if (entity) _s.coils.delete(entity);   // SERPENT-SET: a coiled foe's death ends its coil (AUDIT 625 P3: its own - every other foe keeps theirs)
  if (t.get('thieftaker')?.[2]) markNext(door, entity, now);
  const hide = t.get('orcsbane')?.[2];
  if (hide && now >= _s.wardReady) {   // RAID4b: Iron Hide - a fresh ward, never one on top of another
    _s.ward = hide.ward;
    _s.wardReady = now + hide.recover;
    _s.recovering.add('ward');
    say(`Iron Hide - the next ${hide.ward} damage is turned aside.`);
    sound('ward');
  }
}
/** RAID4b, NO ESCAPE: the nearest other live foe within MARK_METRES of my feet is marked for MARK_SECONDS - never the
 *  one just killed, an ally or a foe at peace (H1), one on another floor (M4) or one behind a wall (M4's ray, where the
 *  host has one). A kill with no such foe leaves the mark as it stood. */
function markNext(door, killed, now) {
  const feet = door.feet?.();
  if (!feet) return;
  let best = null, reach = MARK_METRES;
  for (const f of door.foes()) {
    if (f.dead || f.entity === killed || !f.entity || !f.ai?.feet || spared(f) || rise(f.ai.feet, feet) > REACH_RISE_M) continue;
    const d = flat2(f.ai.feet, feet);
    if (d > reach || door.clear?.(feet, f.ai.feet) === false) continue;
    reach = d; best = f;
  }
  if (!best) return;
  const had = markedFoe(now);
  _s.marked = best.entity;
  _s.markUntil = now + MARK_SECONDS;
  if (had === best.entity) return;   // AUDIT SETS L5: the same foe marked again - its time renewed, nothing said (Rampage's own law)
  say('No Escape - the nearest of them is marked.');
  sound('mark');
}

// ── Mora's Mantle: the cost and the Eye ─────────────────────────────
export function setCastCost(entity, sp) {
  const v = tierOf(entity, 'mora', 1);
  return v ? (sp * (100 - v.less)) / 100 : sp;
}
export const setAbsorbChance = (target) => tierOf(target, 'mora', 2)?.absorb ?? 0;

// ── the round: "ready again" ────────────────────────────────────────
// AUDIT SETS L5: each line said only while its tier is worn and awake - "Wrath of the Warden is ready again." was said
// with the Regalia in the pack - and Iron Hide's only once its ward is spent (it was said over a ward still standing)
const READY = Object.freeze({
  unbroken: { at: () => _s.unbrokenReady, line: 'Unbroken is ready again.', set: 'malacath', tier: 2 },
  wrath: { at: () => _s.wrathReady, line: 'Wrath of the Warden is ready again.', set: 'ruhn', tier: 2 },
  eventide: { at: () => _s.eventideReady, line: 'Eventide is ready again.', set: 'nocturnal', tier: 2 },
  ward: { at: () => _s.wardReady, line: 'Iron Hide is ready again.', set: 'orcsbane', tier: 2, spent: () => !(_s.ward > 0) },   // RAID4b
  shed: { at: () => _s.shedReady, line: 'Shed Skin is ready again.', set: 'coilscale', tier: 2 },   // SERPENT-SET
  hour: { at: () => _s.hourReady, line: 'The Hour Turns is ready again.', set: 'numidium', tier: 2 },   // SD9d
});
export function setRound(entity) {
  if (!entity?.isPlayer || entity.peer || !_s.recovering.size) return;
  const now = _now();
  for (const k of [..._s.recovering]) {
    const r = READY[k];
    if (now < r.at()) continue;
    _s.recovering.delete(k);
    if (tierOf(entity, r.set, r.tier) && (!r.spent || r.spent())) say(r.line);
  }
}

// ── registered at import ───────────────────────────────────────────
export const SIGIL_SETS_POWER = 'sigilSets';
registerEntityFold(SIGIL_SETS_POWER, setFold);
registerWeaponBlowMod(SIGIL_SETS_POWER, setBlow);
registerPlayerStruckListener(SIGIL_SETS_POWER, setStruck);
registerPlayerStrikeListener(SIGIL_SETS_POWER, setStrike);   // AUDIT SET M2
registerPlayerDamageMod(SIGIL_SETS_POWER, setDamageMod);
registerPlayerDeathSave(SIGIL_SETS_POWER, setDeathSave);
registerPlayerHurtListener(SIGIL_SETS_POWER, setHurt);
registerPlayerDoorOpen(SIGIL_SETS_POWER, setDoorOpen);   // AUDIT FINAL F10
registerPlayerKillListener(SIGIL_SETS_POWER, setKill);
registerSpellCostMod(SIGIL_SETS_POWER, setCastCost);
registerAbsorptionChance(SIGIL_SETS_POWER, setAbsorbChance);
registerMagicRoundHook(SIGIL_SETS_POWER, setRound);

/** What the HUD may show of the powers now (SET5): the Rampage's stacks and the time left on each window and each
 *  recovery, in whole seconds - 0 for one not running. */
export function setPowerStates(now = _now()) {
  const left = (t) => Math.max(0, Math.ceil(t - now));
  return {
    rampage: rampageStacks(now), rampageLeft: rampageStacks(now) ? left(_s.rampageUntil) : 0,
    halvedLeft: left(_s.halvedUntil), unbrokenLeft: left(_s.unbrokenReady),
    wrathLeft: left(_s.wrathUntil), wrathRecoverLeft: left(_s.wrathReady),
    eventideLeft: left(_s.eventideReady),
    // RAID4b: Riposte's window, Blood for Blood's stacks, No Escape's mark, Iron Hide's ward (its points) and recovery
    riposteLeft: left(_s.riposteUntil), blood: bloodStacks(now), bloodLeft: bloodStacks(now) ? left(_s.bloodUntil) : 0,
    markLeft: markedFoe(now) ? left(_s.markUntil) : 0, ward: _s.ward, wardRecoverLeft: left(_s.wardReady),
    // SERPENT-SET: Constrict's stacks and window, Shed Skin's recovery
    coil: coilStacks(now), coilLeft: coilStacks(now) ? left(_s.coils.get(_s.coilFoe).until) : 0, shedRecoverLeft: left(_s.shedReady),
    // SD9d: Gearward's winding, The Hour Turns' recovery
    gearLeft: left(_s.gearReady), hourRecoverLeft: left(_s.hourReady),
  };
}

/** SET5: THE HUD'S CHIPS for the set powers now - each `{ key, set, name, text, state }`: a window running
 *  (`state` 'active' - the Rampage's stacks and seconds, Unbroken's halving, the Wrath's fury) or, while I wear the
 *  power awake, its recovery ('recovering'). Only a power whose 6-piece tier is awake on me shows (a stack or a window
 *  left over from a set taken off does nothing, and says nothing); [] for anyone but me, and while the sets sleep. */
export function setHudChips(entity, now = _now()) {
  const t = awakeTiersOf(entity);
  if (!t) return [];
  const st = setPowerStates(now);
  const time = (n) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`);
  const out = [];
  if (t.get('dagon')?.[2] && st.rampage) out.push({ key: 'rampage', set: 'dagon', name: `Rampage ${'I'.repeat(st.rampage)}`, text: time(st.rampageLeft), state: 'active' });
  if (t.get('malacath')?.[2]) {
    if (st.halvedLeft) out.push({ key: 'unbroken', set: 'malacath', name: 'Unbroken', text: time(st.halvedLeft), state: 'active' });
    else if (st.unbrokenLeft) out.push({ key: 'unbroken', set: 'malacath', name: 'Unbroken', text: time(st.unbrokenLeft), state: 'recovering' });
  }
  if (t.get('ruhn')?.[2]) {
    if (st.wrathLeft) out.push({ key: 'wrath', set: 'ruhn', name: 'Wrath', text: time(st.wrathLeft), state: 'active' });
    else if (st.wrathRecoverLeft) out.push({ key: 'wrath', set: 'ruhn', name: 'Wrath', text: time(st.wrathRecoverLeft), state: 'recovering' });
  }
  if (t.get('nocturnal')?.[2] && st.eventideLeft) out.push({ key: 'eventide', set: 'nocturnal', name: 'Eventide', text: time(st.eventideLeft), state: 'recovering' });
  // RAID4b: No Escape's mark while it stands; Iron Hide's ward while it holds (its points), else its recovery
  if (t.get('thieftaker')?.[2] && st.markLeft) out.push({ key: 'mark', set: 'thieftaker', name: 'No Escape', text: time(st.markLeft), state: 'active' });
  if (t.get('orcsbane')?.[2]) {
    if (st.ward) out.push({ key: 'ward', set: 'orcsbane', name: 'Iron Hide', text: String(st.ward), state: 'active' });
    else if (st.wardRecoverLeft) out.push({ key: 'ward', set: 'orcsbane', name: 'Iron Hide', text: time(st.wardRecoverLeft), state: 'recovering' });
  }
  // SERPENT-SET: Shed Skin's recovery, while it recovers
  if (t.get('coilscale')?.[2] && st.shedRecoverLeft) out.push({ key: 'shed', set: 'coilscale', name: 'Shed Skin', text: time(st.shedRecoverLeft), state: 'recovering' });
  // SD9d: The Hour Turns' recovery, while it recovers
  if (t.get('numidium')?.[2] && st.hourRecoverLeft) out.push({ key: 'hour', set: 'numidium', name: 'The Hour Turns', text: time(st.hourRecoverLeft), state: 'recovering' });
  return out;
}

/** Tests only: a clock of their own (seconds), and every power fresh. */
export function _setSetPowersClockForTests(fn) { _now = typeof fn === 'function' ? fn : () => performance.now() / 1000; }
export function _resetSetPowersForTests() { _s = fresh(); _carry = new WeakMap(); _blow = null; _bossBlowAt = -Infinity; _pendingBoss = false; _holdOwed = 0; _say = (line) => { hudText(line); }; _sound = null; }
