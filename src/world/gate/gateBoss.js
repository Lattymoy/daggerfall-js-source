// @ts-check
// WB4 (2026-09-25, Mac: "a large boss arena with an oversized enemy with telegraphed attacks (like wind ups, etc)"):
// THE BOSS AS HE IS SEEN AND HEARD - where he stands and what he is doing at a moment of the relay's clock, the frame
// of Daggerfall's own sprite that shows it, the glow on him and the words of his voice. Design:
// bible/11-Multiplayer/World-Bosses.md section 5 ("On him: the sprite holds its attack frame's first half through the
// wind-up, glows the attack's colour, and his voice gives the wind-up's cue; at the landing the attack frames play out").
//
// PURE. The court's state (net/gate/gateLink.js, the relay's words folded) and a clock in; a pose, a light, a cue out. The
// court's driver (scenes/gate/gateCourt.js) turns them into a billboard, a light in the court's channel and sounds.
//
// HIS BODY is the mobile the look names (a Daedra Lord for Valkynaz Ruhn - archive 286, the frames every client
// already has) drawn at BOSS_SCALE times its size, the orientation tables and clip rates its own (characters/
// mobileUnit.js). The frames an attack shows are the attack clip's (records 5-9): its first two HELD through the
// wind-up - the raise, the second from half way - and the rest played at the clip's own 10 a second from the landing.
// The charge is run on the walk's frames at a run's pace, his body carried down the lane as the brain carries it.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, BOSS_H, LEAP_AIR_MS, CROSS_AIR_MS, airOf, leapAt, profileOf, isDagons, HOST, HOST_KINDS, HOST_RISE_MS, hostAt, HALF } from '../../net/gate/gateBrain.js';
import { HIT_CAP_X, dpsRef, LV_MAX } from '../../net/gate/gateBrain.js';   // STAND-IN-WHOLE: the most one blow lands, the relay's own law
import { EG_BUCKET_X_MAX } from '../../net/eliteGates/egVestige.js';   // STAND-IN-WHOLE: and the most an Elite Breach's bucket grows by
import { bossAt } from '../../net/gate/gateLink.js';
import { telegraphAt, chargeHead, hostTelegraphAt } from '../../net/gate/gateStrike.js';
import {
  MOVE_ANIMS, PRIMARY_ATTACK_ANIMS, HURT_ANIMS, IDLE_ANIMS, mobileOrientation,
  MOVE_ANIM_SPEED, IDLE_ANIM_SPEED, PRIMARY_ATTACK_ANIM_SPEED,
  FLY_ANIM_SPEED, HURT_ANIM_SPEED, SEDUCER_IDLE_MOVE_ANIMS, SEDUCER_ATTACK_ANIMS,   // WB11c: his host's flight, its hurt, and the Seducer's winged form
  stateAnims,   // AUDIT WB11 C1: his host's tables by the port's own law
} from '../../characters/mobile/mobileUnit.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { t } from '../../systems/textManager.js';   // WB14c: the Vanguard's own names in the player's language (L10N4)
import { makeEnemyEntity } from '../../characters/enemy/enemyEntity.js';
import { courtToDungeon } from './gateArena.js';
import { hitFlashStrength } from '../../systems/hitFlash.js';   // WB13d: his body struck flashes on the game's own curve
import { fxBurstOf } from '../../render/gate/gateFx.js';   // WB13d: a landing whose burst carries its own light lights there, not him

/** Each boss's look, by its id (net/gate/gateLaw.js GATE_BOSSES): the mobile whose sprite he wears, and how many times its
 *  size he stands (BOSS_H is the body the blows are measured against - three Daedra Lords tall). */
export const BOSS_LOOKS = Object.freeze({ ruhn: Object.freeze({ mobile: 31, scale: 3 }) });
export const bossLookOf = (id) => BOSS_LOOKS[id] ?? BOSS_LOOKS.ruhn;
/** WB14d (bible/11-Multiplayer/Breach-Portents.md section 5): HIS FLAME, SEEN - his aspect's Atronach (the Fire, the Ice,
 *  the Iron under the storm, the Flesh under the venom - the Sapper's own sprites, enemyBasics.js 35-38) at his own scale,
 *  its profile's size three quarters of his: a second body across the fire, never his own sprite twice. */
export const FLAME_LOOKS = Object.freeze({ burning: 35, rime: 38, storm: 36, venom: 37 });
export const flameLookOf = (aspectId) => Object.freeze({ mobile: FLAME_LOOKS[aspectId] ?? FLAME_LOOKS.burning, scale: BOSS_LOOKS.ruhn.scale });
/** WB14d: the halves' names (read through the text core - L10N4) - his Blade, and his aspect's fire made flesh (`boss` his
 *  own name, the last word of it: "Ruhn's Blade", "Ruhn's Rime"). */
export const HALF_NAMES = Object.freeze({
  blade: (boss) => t('gate.sunder.blade', "{boss}'s Blade", { boss }),
  burning: (boss) => t('gate.sunder.flame', "{boss}'s Flame", { boss }),
  rime: (boss) => t('gate.sunder.rime', "{boss}'s Rime", { boss }),
  storm: (boss) => t('gate.sunder.storm', "{boss}'s Storm", { boss }),
  venom: (boss) => t('gate.sunder.venom', "{boss}'s Venom", { boss }),
});
/** WB14d: half `b`'s name under a profile, for a boss named `name`. */
export const halfName = (b, P, name) => {
  const boss = String(name ?? '').trim().split(/\s+/).pop() || 'Ruhn';
  return (b === HALF.flame ? HALF_NAMES[P?.aspect?.id] ?? HALF_NAMES.burning : HALF_NAMES.blade)(boss);
};

/**
 * WB4b: THE ENTITY A BLOW ON HIM IS COMPUTED AGAINST - on the striker's machine, by the port's own formulas (a swing's
 * and a shaft's calculateAttackDamage, a spell's applySpell), the number sent and the relay's caps deciding what lands
 * (net/gate/gateBrain.js applyHit). His look's own mobile's entity (characters/enemy/enemyEntity.js makeEnemyEntity) with three
 * things set for the fight: EVERY METAL BITES (a Daedra Lord's own needs Mithril - no level-1 player could touch him),
 * his armour a knight's in plate rather than a Daedra Lord's (BOSS_ARMOR: against his own dodging, a level-1 iron
 * longsword lands more than half its swings and a level-20 blade nearly all - bible section 5's numbers, measured in the
 * pins), and a health nothing here
 * can empty (the relay holds his real one - STAND_IN_WHOLE, below). Named for the numbers and the lines a blow says.
 * FIELD BUGS 2026-10-18f RELAY-SHARE: `share` - its owner's reader of the relay's own word of this body's health (a share,
 * 0..1, or null where none is heard; combat/healthShare.js wordShare builds one): what every "under its health" power
 * reads of it (combat/healthShare.js healthShare). Without one the share is unknown, as before.
 * FIELD BUGS 2026-10-19f STAND-IN-WHOLE: `blowX` - its owner's reader of the factor its relay grows my bucket by (an Elite
 * Breach's: my Vestiges' declared factor, net/eliteGates/egVestige.js egDeclaredX); none, the gate's own 1. What one blow of
 * mine can land on it reads it (standInBlowCap).
 */
export const BOSS_ARMOR = 60;
/**
 * FIELD BUGS 2026-10-19f STAND-IN-WHOLE (a player's private report: Disintegrate on an online breach's boss popped a huge
 * number, and his bar never moved): THE WHOLE A STAND-IN STANDS AT - a count, not a body. The relay holds every such
 * body's health and nothing here takes from a stand-in (a swing's and a shaft's number is sent, never subtracted; a spell
 * lands on it through counting sinks - scenes/gate/standInSpell.js), so one law alone reads its whole: a Disintegrate
 * deals its target what health it has left (systems/effects.js - DFU's Disintegrate.MagicRound, SetHealth(0)). It stood
 * at 1e9, and a claim of 1e9 is past every wire's ceiling - the gate's hit, ahit and xhit and the Abyss's
 * (net/wire.js GATE_DMG_WIRE_MAX, 100,000), an Elite Breach's (validEgIn, 1e6) and a refereed bout's
 * (net/arena/arenaLaw.js validArenaIn, 10,000) - so every relay refused the whole cast: the number rose, nothing landed.
 * It stands at the most one blow lands at any relay - HIT_CAP_X times the reference at LV_MAX, grown by the most an Elite
 * Breach's bucket grows (EG_BUCKET_X_MAX): 975, over the serpent's (net/serpent/serpentBrain.js, SERPENT_HIT_CAP_X of a
 * galley's reference) and a bout's (arenaBlowCap) - so a Disintegrate counts whole and the relay's own caps clip it, as
 * a duel's stand-in counts at the wire's vital ceiling (combat/duelCombat.js DUEL_STAND_IN); and under the least ceiling
 * nobody clamps (the bout's 10,000), with the rest of a spell's room beside it. Pinned against the real constants and
 * every validator (test/net/gate/fb1019f_standinwhole.test.js).
 */
export const STAND_IN_WHOLE = HIT_CAP_X * dpsRef(LV_MAX) * EG_BUCKET_X_MAX;
/**
 * STAND-IN-WHOLE: WHAT ONE BLOW OF MINE AT LEVEL `lv` CAN LAND ON STAND-IN `e` - the relay's one-blow cap (net/gate/
 * gateBrain.js applyHit and spendPurse: HIT_CAP_X times the reference at my level), grown by the factor its owner says my
 * bucket grows by (`relayBlowX` - an Elite Breach's, at most EG_BUCKET_X_MAX; 1 where none is said or it says no number).
 * Never past STAND_IN_WHOLE. The number a spell on it says (scenes/gate/standInSpell.js). Pure.
 * @param {any} e @param {number} lv
 */
export function standInBlowCap(e, lv) {
  let bx = 1;
  try { bx = typeof e?.relayBlowX === 'function' ? Number(e.relayBlowX()) : 1; } catch { bx = 1; }
  return HIT_CAP_X * dpsRef(lv) * (Number.isFinite(bx) ? Math.max(1, Math.min(EG_BUCKET_X_MAX, bx)) : 1);
}
export function bossStandIn(look, name, share = null, blowX = null) {
  const e = makeEnemyEntity(look.mobile, ENEMY_BASICS[look.mobile], null, 1, () => 0.5);
  e.minMetalToHit = 0;
  e.armor = BOSS_ARMOR;
  e.armorValues = new Array(7).fill(BOSS_ARMOR);
  e.maxHealth = e.health = STAND_IN_WHOLE;   // FIELD BUGS 2026-10-19f STAND-IN-WHOLE: a count the wire carries, never 1e9
  e.relayHealth = true;   // AUDIT MARTIAL L3 F2: the relay's to know - a share of the whole here is no word (systems/weaponMastery.js), nor is a blow's share of it (combat/blood/bloodDecals.js bloodHit)
  e.relayShare = typeof share === 'function' ? share : null;   // FIELD BUGS 2026-10-18f RELAY-SHARE: the relay's word of it, its owner's reader
  e.relayBlowX = typeof blowX === 'function' ? blowX : null;   // FIELD BUGS 2026-10-19f STAND-IN-WHOLE: the factor its relay grows my bucket by, its owner's reader
  e.name = name;
  e.spareGear = true;   // WBX6: a blow on him wears no weapon (combat/formulas.js damageEquipment)
  e.mobileType ??= look.mobile;   // WBX7: a soul trap reads the target's mobile (systems/effects.js) - his is a Daedra Lord's, no humanoid
  // WB8a (2026-09-28, Mac: "Make the oblivion gate boss not be able to be pacified"): NEVER SWAYED. No path reached him
  // before this, but only by accident - he is in no foe pool, so the language roll never met him, and his spell door
  // took harmful families alone - and a Pacify Daedra on a Daedra Lord's stand-in matches. Now it is his own word: the
  // language seam (scenes/hostCombat.js), the Pacify/Charm arm (systems/effects.js) and the flag's door
  // (scenes/hostMagic.js) all refuse a target that says it, and his door answers a sway with BOSS_SWAY_TEXT.
  e.pacifyImmune = true;
  return e;
}
/**
 * WB9c: THE ENTITY A BLOW ON A CRYSTAL OF OBLIVION IS COMPUTED AGAINST - his stand-in's law (every metal bites, a health
 * nothing here can empty - the relay holds its real one, never swayed), but it is glass grown out of stone, not a body:
 * no armour turns a blow (CRYSTAL_ARMOR, an unarmoured ArmorValues - DFU's 100) and nothing dodges (every skill
 * nothing - formulas.js CalculateSkillsToHit reads the target's Dodging). One a fight, shared by every crystal.
 */
export const CRYSTAL_ARMOR = 100;
export const CRYSTAL_NAME = 'Crystal of Oblivion';
export function crystalStandIn(look, c = null, share = null, blowX = null) {   // FIELD BUGS 2026-10-18f RELAY-SHARE: `share` its own word's reader (bossStandIn); 2026-10-19f STAND-IN-WHOLE: `blowX` its relay's bucket's
  const e = bossStandIn(look, CRYSTAL_NAME, share, blowX);
  e.armor = CRYSTAL_ARMOR;
  e.armorValues = new Array(7).fill(CRYSTAL_ARMOR);
  e.skills = 0;
  e.crystal = true;
  // AUDIT WB11 W1: which crystal it stands in for - a Cast When Strikes spell on it is that crystal's (the enchant door
  // asks; one stand-in for them all sent it to HIM)
  if (c !== null) e.crystalC = c;
  return e;
}
/** WB8a: what a Pacify or a Charm aimed at him says. */
export const BOSS_SWAY_TEXT = (name) => `${name || 'The Warden'} cannot be swayed.`;
/** WB8a: how often at most it is said - a Cast When Strikes sway rides every blow. */
export const BOSS_SWAY_TELL_MS = 4000;

/**
 * WB4b: WHERE A SWING MEETS HIM - the nearest point of his body's surface to an eye (his axis `radius` in from it, level
 * with the eye where his height allows) and the eye's distance to that surface. A point-centre law (a foe's: its middle,
 * its capsule's 0.45) would ask a swing to reach 1.8 m into him and 2.8 m up; the reach is measured to his skin.
 * @param {number[]} eye @param {{feet: number[], height: number, radius: number}} body
 */
export function bossReach(eye, body) {
  const { feet, height, radius } = body;
  const y = Math.min(Math.max(eye[1], feet[1] + radius), feet[1] + height - radius);
  const dx = feet[0] - eye[0], dz = feet[2] - eye[2], flat = Math.hypot(dx, dz) || 1;
  return {
    point: [feet[0] - (dx / flat) * radius, y, feet[2] - (dz / flat) * radius],
    dist: Math.max(0, Math.hypot(dx, y - eye[1], dz) - radius),
  };
}

/** The charge's run on the walk's frames, frames a second (the walk's own is MOVE_ANIM_SPEED). */
export const RUN_ANIM_SPEED = 14;
/** A blow of mine lands: he flinches this long (only while he does nothing else - a wind-up is never broken). */
export const FLINCH_MS = 450;
/** WB9c: his reel while stunned, frames a second (his hurt clip, slowed - he is dazed, not struck). */
export const STUN_ANIM_SPEED = 3;
/** The fall: the hurt frames played slowly this long, and then he is gone (WB5's spoils spill at the fall). */
export const FALL_MS = 2400;
/** WB13d (2026-10-01, Mac: "AAA grade polish"): HIS FIRE IS CAST, NOT SWUNG - the Daedra Lord's own spell frames
 *  (characters/enemy/enemyBasics.js spellAnimFrames, [1, 1, 3, 3]): his attack's frame CAST_RAISE_FRAME held through a fire's
 *  wind-up, CAST_LOOSE_FRAME as it is loosed. His blade and his weight keep the swing (frames 0, 1, then 2-4). */
export const CAST_RAISE_FRAME = 1;
export const CAST_LOOSE_FRAME = 3;
/** WB13f: SPENT - his heaviest blows (net/gate/gateBrain.js ATTACKS: their recovery the longer for it) leave him in their last
 *  frame until his recovery ends, a window to punish: his blade's last swing frame, his fire's loosing one. */
export const SPENT_ON = Object.freeze(['slam', 'leap', 'nova']);
export const SPENT_FRAME = 4;
/** WB13d: HIS BODY STRUCK, SEEN, as every foe's is (systems/hitFlash.js): a full flash for my own blow, GATE_FLASH_COURT
 *  of one for the court's - a fall in his health the relay says of GATE_FLASH_SHARE of his whole or more. His host's
 *  bodies the same, any fall. */
export const GATE_FLASH_COURT = 0.4;
export const GATE_FLASH_SHARE = 0.003;
/** The flash on a body this frame (0..1), from when my blow and the court's last met it (the court's clock, ms). Pure. */
export const gateHitFlash = (mineAt, courtAt, now) => Math.max(hitFlashStrength((now - mineAt) / 1000), GATE_FLASH_COURT * hitFlashStrength((now - courtAt) / 1000));
/** WB13d: a landing's light stands this high over the floor it lands on. */
export const LANDING_LIGHT_Y = 0.6;
/** WB13e (2026-10-01, Mac: "AAA grade polish"): HIS FALL, AN EVENT - his body meets the floor THUD_AT_MS into it, then
 *  sinks FALL_SINK_M into the stone over the rest of FALL_MS, in a column of embers, and leaves his corpse there at
 *  CORPSE_SCALE (his mobile's own, characters/enemy/enemyBasics.js corpseTexture). */
export const FALL_SINK_M = 1.5;
export const CORPSE_SCALE = 3;
/** WB13e: HIS WAKE - this long before the opening ends (the relay's `op`), his roar, his flare and his name. */
export const WAKE_LEAD_MS = 1200;
export const WAKE_FLARE_MS = 1500;
/** WB13e: under this share of his health his ember sputters (and the bar pulses - ui/gate/gateBossBar.js). */
export const LOW_HEALTH = 0.1;

/** The attacks' colours - the telegraph's on the ground and the glow on him - display-encoded (a foreign pass draws into
 *  an 8-bit display-encoded frame, render/duelWall.js). The ward's gold, and the ember he always carries. */
export const ATTACK_COLORS = Object.freeze({
  cleave: Object.freeze([1.0, 0.3, 0.12]),
  slam: Object.freeze([1.0, 0.52, 0.1]),
  charge: Object.freeze([1.0, 0.16, 0.08]),
  hellfire: Object.freeze([1.0, 0.64, 0.14]),
  nova: Object.freeze([1.0, 0.8, 0.28]),
  wrath: Object.freeze([0.9, 0.06, 0.03]),
  // WBX5: the Burning Court's reach and Dagon's Champion's lanes
  leap: Object.freeze([1.0, 0.42, 0.1]),
  meteor: Object.freeze([1.0, 0.56, 0.06]),
  spokes: Object.freeze([1.0, 0.14, 0.32]),
  // WB9b: the bound's landing, his weight's colour; WB9c: Dagon's Reckoning, the Wrath's blood-red deepened toward black
  cross: Object.freeze([1.0, 0.46, 0.12]),
  reckon: Object.freeze([0.95, 0.08, 0.16]),
  // WB14a: the new arsenal - the chain's hot iron, Dagon's brand, the Torment's gold (render/gate/gateTelegraph.js
  // TORMENT_COLOR draws its ring), the wheel's blades, the gaze's white, the Unmaking's void-violet
  chains: Object.freeze([1.0, 0.34, 0.1]),
  brand: Object.freeze([1.0, 0.24, 0.2]),
  torment: Object.freeze([1.0, 0.8, 0.28]),
  wheel: Object.freeze([1.0, 0.38, 0.16]),
  gaze: Object.freeze([1.0, 0.97, 0.9]),
  unmake: Object.freeze([0.78, 0.2, 0.62]),
  // WB14d: the Sundering's tear (his ember torn toward Oblivion's crimson) and the Rejoining's gold where the halves meet
  sunder: Object.freeze([1.0, 0.22, 0.4]),
  rejoin: Object.freeze([1.0, 0.62, 0.22]),
});
/** WB9c: the crystals of Oblivion - their heart's glow (his aspect's colour where he wears one: CRYSTAL_ASPECT), and the
 *  stunned Warden's daze (a pale ember). */
export const CRYSTAL_COLOR = Object.freeze([1.0, 0.18, 0.34]);
export const STUN_COLOR = Object.freeze([0.62, 0.7, 1.0]);
export const WARD_COLOR = Object.freeze([1.0, 0.86, 0.5]);
export const EMBER_COLOR = Object.freeze([0.9, 0.32, 0.1]);
/** WBX5: the burning ground's colour on the floor (render/gate/gateTelegraph.js draws each pool as a filled disc). */
export const POOL_COLOR = Object.freeze([1.0, 0.36, 0.05]);
/**
 * WB8b: HIS ASPECT, SEEN - the colours his elemental blows, his ground and his ember take under each aspect but his
 * burning one (net/gate/gateMods.js GATE_ASPECTS - the court's own fire above is the Burning Warden's): the rime's ice, the
 * storm's violet and its bolt's white, the venom's green. His blade, his slam, his charge and his leap keep the
 * colours of his weight; Dagon's Wrath is Dagon's red whatever he wears. Display-encoded, as the rest.
 */
const tint = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));
export const ASPECT_COLORS = Object.freeze({
  rime: tint({ hellfire: [0.5, 0.78, 1.0], nova: [0.72, 0.9, 1.0], meteor: [0.4, 0.68, 1.0], spokes: [0.46, 0.56, 1.0], pool: [0.28, 0.6, 1.0], ember: [0.34, 0.6, 0.95], brand: [0.42, 0.62, 1.0] }),   // WB14a: the Brand his element's (the Torment keeps its gold)
  storm: tint({ hellfire: [0.66, 0.52, 1.0], nova: [0.84, 0.8, 1.0], meteor: [0.96, 0.92, 0.5], spokes: [0.74, 0.46, 1.0], pool: [0.56, 0.4, 1.0], ember: [0.6, 0.42, 0.95], brand: [0.7, 0.4, 1.0] }),
  venom: tint({ hellfire: [0.5, 1.0, 0.26], nova: [0.68, 1.0, 0.38], meteor: [0.38, 0.92, 0.16], spokes: [0.28, 1.0, 0.52], pool: [0.3, 0.86, 0.12], ember: [0.36, 0.8, 0.16], brand: [0.4, 0.95, 0.2] }),
});
/** An attack's colour under a profile (net/gate/gateBrain.js fightProfile): his aspect's where it names one - his elemental
 *  blows alone, never Dagon's Wrath - else the attack's own. */
export const attackColor = (A, P) => ASPECT_COLORS[P?.aspect?.id]?.[A.key] ?? ATTACK_COLORS[A.key];
/** His ground's colour, and his ember's, under a profile. */
export const poolColor = (P) => ASPECT_COLORS[P?.aspect?.id]?.pool ?? POOL_COLOR;
export const emberColor = (P) => ASPECT_COLORS[P?.aspect?.id]?.ember ?? EMBER_COLOR;
/** WB9c: the crystals' colour under a profile - Oblivion's crimson under the Burning, his aspect's own blow colour
 *  otherwise (the rime's ice, the storm's violet, the venom's green): the Reckoning is Dagon's, the crystals his. */
export const crystalColor = (P) => ASPECT_COLORS[P?.aspect?.id]?.spokes ?? CRYSTAL_COLOR;

/** WBX5: THE LEAP'S FLIGHT - he is in the air LEAP_AIR_MS before it lands (the brain's law, net/gate/gateBrain.js leapAt),
 *  and this high at the top of his arc (metres). */
export { LEAP_AIR_MS, CROSS_AIR_MS };
export const LEAP_HEIGHT = 3.2;
/** WB9b: the bound's arc over the fire - high enough that the fire below lights his underside, and every court sees him
 *  go. */
export const CROSS_HEIGHT = 22;

/** Where he stands at `now`, in the court's frame: down the lane while the charge runs and at its end after (the brain
 *  carries him so, net/gate/gateBrain.js stepBrain - the next word finds him there); WBX5: through the air to where a leap
 *  lands over its last LEAP_AIR_MS, and there after; else his walk from the last word. */
export function bossPlace(s, now) {
  const atk = s?.atk;
  if (atk && ATTACK_BY_ID[atk.a] === ATTACKS.charge && now >= atk.at) {
    const head = chargeHead(atk, Math.min(now, atk.at + ATTACKS.charge.active));
    if (head) return head;
  }
  const leap = atk ? leapAt(atk, now) : null;   // WBX5: the brain's own flight - the relay settles a kill in the air there too
  if (leap) return leap;
  return bossAt(s, now);
}

/** WBX5: how high he stands over the floor at `now` - the leap's arc over its air time, else 0 (metres). */
export function bossHop(s, now) {
  const atk = s?.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  if (A !== ATTACKS.leap && A !== ATTACKS.cross) return 0;
  const air = airOf(A);
  if (now < atk.at - air || now >= atk.at) return 0;
  const k = (now - (atk.at - air)) / air;
  return 4 * (A === ATTACKS.cross ? CROSS_HEIGHT : LEAP_HEIGHT) * k * (1 - k);   // WB9b: the bound's arc is its own
}

/**
 * WHAT HE IS DOING at `now`: `act` one of gone, fall, stunned, windup, strike, spent, run, walk, flinch, idle; `anims`
 * the orientation table that shows it; `frame` the frame index within the record (held frames are indices, a loop's a
 * count to wrap); `loop` whether it wraps; `atk` the attack's key while one is shown; `t` its wind-up's share.
 * @param {any} s the court's state (net/gate/gateLink.js GateState) @param {number} now the relay's clock
 * @param {number} [hurtAt] when a blow of mine last landed on him
 */
export function bossAct(s, now, hurtAt = -Infinity) {
  if (!s || s.day === null) return { act: 'gone', anims: IDLE_ANIMS, frame: 0, loop: false, atk: null, t: 0 };
  if (s.fell) {
    const since = now - s.fell.at;
    if (since >= FALL_MS) return { act: 'gone', anims: HURT_ANIMS, frame: 0, loop: false, atk: null, t: 1 };
    // WB13e: his hurt frames until his body meets the floor, then he sinks into the stone
    const sink = since > THUD_AT_MS ? FALL_SINK_M * Math.min(1, (since - THUD_AT_MS) / (FALL_MS - THUD_AT_MS)) : 0;
    return { act: 'fall', anims: HURT_ANIMS, frame: Math.max(0, Math.min(4, Math.floor((since / THUD_AT_MS) * 5))), loop: false, atk: null, t: since / FALL_MS, sink };
  }
  // WB9c: STUNNED - his Reckoning broken, he reels on his hurt frames, slowly, until it passes (a blow still flinches him)
  if (now < (s.stunUntil ?? 0) && now >= (s.stunAt ?? 0)) return { act: 'stunned', anims: HURT_ANIMS, frame: Math.floor(((now - (s.stunAt ?? now)) / 1000) * STUN_ANIM_SPEED), loop: true, atk: null, t: 0 };
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  if (A) {
    const tel = telegraphAt(atk, s.phase, now);
    // WBX5: the leap in the air - his legs under him, as the charge runs; WB9b: and the bound's long flight
    const air = airOf(A);
    if ((A === ATTACKS.leap || A === ATTACKS.cross) && now < atk.at && now >= atk.at - air) return { act: 'run', anims: MOVE_ANIMS, frame: Math.floor(((now - atk.at + air) / 1000) * RUN_ANIM_SPEED), loop: true, atk: A.key, t: tel?.t ?? 1 };
    const cast = !!A.el;   // WB13d: his fire (his aspect's element is his fire) is cast
    if (tel && now < atk.at) return { act: 'windup', anims: PRIMARY_ATTACK_ANIMS, frame: cast ? CAST_RAISE_FRAME : tel.t < 0.5 ? 0 : 1, loop: false, atk: A.key, t: tel.t };
    if (A === ATTACKS.charge && now < atk.at + A.active) {
      return { act: 'run', anims: MOVE_ANIMS, frame: Math.floor(((now - atk.at) / 1000) * RUN_ANIM_SPEED), loop: true, atk: A.key, t: 1 };
    }
    const played = Math.floor(((now - atk.at) / 1000) * PRIMARY_ATTACK_ANIM_SPEED);
    if (A !== ATTACKS.charge && played < 3) return { act: 'strike', anims: PRIMARY_ATTACK_ANIMS, frame: cast ? CAST_LOOSE_FRAME : 2 + played, loop: false, atk: A.key, t: 1 };
    if (SPENT_ON.includes(A.key) && now < atk.at + A.active + A.recover) return { act: 'spent', anims: PRIMARY_ATTACK_ANIMS, frame: cast ? CAST_LOOSE_FRAME : SPENT_FRAME, loop: false, atk: A.key, t: 1 };   // WB13f
  }
  const at = s.move && s.move.v > 0 ? bossAt(s, now) : null;
  const walking = !!at && Math.hypot(s.move.tx - at[0], s.move.tz - at[1]) > 0.05;
  if (now - hurtAt >= 0 && now - hurtAt < FLINCH_MS) return { act: 'flinch', anims: HURT_ANIMS, frame: Math.floor(((now - hurtAt) / FLINCH_MS) * 2), loop: false, atk: null, t: 0 };
  if (walking) return { act: 'walk', anims: MOVE_ANIMS, frame: Math.floor((now / 1000) * MOVE_ANIM_SPEED), loop: true, atk: null, t: 0 };
  return { act: 'idle', anims: IDLE_ANIMS, frame: Math.floor((now / 1000) * IDLE_ANIM_SPEED), loop: true, atk: null, t: 0 };
}

/**
 * The frame that shows an act to an eye at `cam` (the dungeon's frame): the record by the orientation his facing turns
 * to it, mirrored where the table mirrors, the frame index held at the record's last or wrapped by its count.
 * @param {ReturnType<typeof bossAct>} act @param {number} yaw @param {number[]} feet @param {number[]} cam
 * @param {(record: number) => number} frameCount
 */
export function bossFrame(act, yaw, feet, cam, frameCount) {
  const o = mobileOrientation(yaw, feet, cam && cam.length === 3 ? cam : feet);
  const a = act.anims[o] ?? act.anims[0];
  const n = Math.max(1, frameCount(a.record) | 0);
  const frame = act.loop ? ((act.frame % n) + n) % n : Math.max(0, Math.min(n - 1, act.frame));
  return { record: a.record, frame, flip: !!a.flip };
}

/** The light's chest height on him, and its reaches: at rest, through a wind-up, and at a landing. */
/** AUDIT EG-FALL (L2-9): the share of his height his chest stands at, named (scenes/eliteGates/egLordFall.js reads it); and his
 *  glow's brightness as he falls, from this to nothing over FALL_MS. */
export const GLOW_UP_SHARE = 0.55;
export const FALL_GLOW_K = 2.2;
export const GLOW_UP = BOSS_H * GLOW_UP_SHARE;
export const GLOW_RANGE = Object.freeze({ ember: 7, windup: 12, landing: 18 });

/**
 * THE GLOW ON HIM: a light at his chest in the court's own channel (`{ x, y, z, range, color }`, colour times
 * intensity - world/gate/gateArena.js withCourtLights), the attack's colour climbing through its wind-up and flaring at the
 * landing, gold while the ward stands, a low ember otherwise; null when he is gone. WB8b: at his own chest (Colossal's
 * stands higher) and in his aspect's colours. WB13d: the landing's flare on the floor where it lands, LANDING_LIGHT_Y
 * over it - at his feet for his own; a landing that falls away from him (its burst carries its own light,
 * render/gate/gateFx.js FX_KINDS) leaves his ember.
 * LIGHT-ID (2026-10-14): `out`, a kept record, is refilled in place and answered (the court's own - his glow is ONE light
 * that follows him, and the shadow pass knows it moved by the record: render/lightId.js); none, a new record.
 */
export function bossGlow(s, now, out = null) {
  if (!s || s.day === null) return null;
  if (s.fell && now - s.fell.at >= FALL_MS) return null;
  const P = profileOf(s), ember = emberColor(P);
  const [cx, cz] = bossPlace(s, now);
  const [x, y, z] = courtToDungeon(cx, P.bossH * GLOW_UP_SHARE, cz);
  const lit = (color, k, range, ly = y) => {
    const o = out ?? { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] };
    o.x = x; o.y = ly; o.z = z; o.range = range;
    o.color[0] = color[0] * k; o.color[1] = color[1] * k; o.color[2] = color[2] * k;
    return o;
  };
  if (s.fell) return lit(ember, FALL_GLOW_K * (1 - (now - s.fell.at) / FALL_MS), GLOW_RANGE.landing);
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  if (A) {
    const tel = telegraphAt(atk, s.phase, now);
    const color = attackColor(A, P) ?? ember;
    const floor = courtToDungeon(cx, LANDING_LIGHT_Y, cz)[1], away = !!fxBurstOf(A)?.light;
    if (tel && !tel.over) {
      if (tel.landing) return away ? lit(ember, 0.45, GLOW_RANGE.ember) : lit(color, 2.4, GLOW_RANGE.landing, floor);
      return lit(color, 0.35 + 1.25 * tel.t * tel.t, GLOW_RANGE.windup);
    }
    if (tel && !away && tel.since < Math.max(A.active, 1) + 350) return lit(color, 2.4 * (1 - (tel.since - Math.max(A.active, 1)) / 350), GLOW_RANGE.landing, floor);
  }
  if (now < s.shieldUntil) return lit(WARD_COLOR, 0.9 + 0.3 * Math.sin(now / 90), GLOW_RANGE.windup);
  if (now < (s.stunUntil ?? 0)) return lit(STUN_COLOR, 0.55 + 0.25 * Math.sin(now / 160), GLOW_RANGE.windup);   // WB9c: dazed
  // WB13e: HIS WAKE - his ember flares as the opening ends (the relay's `op`)
  const wake = (s.openUntil ?? 0) > 0 ? now - (s.openUntil - WAKE_LEAD_MS) : -1;
  if (wake >= 0 && wake < WAKE_FLARE_MS) return lit(ember, 0.45 + 2.2 * Math.sin((Math.PI * wake) / WAKE_FLARE_MS), GLOW_RANGE.landing);
  // WB13e: under LOW_HEALTH his ember sputters - a step of light every SPUTTER_STEP_MS, never steady
  if (s.max > 0 && s.hp / s.max < LOW_HEALTH) return lit(ember, 0.45 * sputter(now), GLOW_RANGE.ember);
  return lit(ember, 0.45, GLOW_RANGE.ember);
}
/** WB13e: the sputter's step (ms) and its share of the ember's light at a moment - a hash of the step, 0.2 to 1. Pure. */
export const SPUTTER_STEP_MS = 90;
export const sputter = (now) => { const x = Math.sin(Math.floor(now / SPUTTER_STEP_MS) * 12.9898) * 43758.5453; return 0.2 + 0.8 * (x - Math.floor(x)); };

/** HIS VOICE - DAGGER.SND records by index (`clip`: his own mobile's bark and attack, enemyBasics.js, pitched down for
 *  his size) or sound IDs (`id`: the fire's cast, played through audio.play3dId - systems/enemySpells.js's law), with
 *  the loudness and the reach the court needs (the floor is 48 m across). `at` says where: at him, or at each of the
 *  attack's targets. */
const B = ENEMY_BASICS[31];
const voice = (clip, pitch, volume = 1.3) => Object.freeze({ clip, pitch, volume, reach: 60, at: 'him' });
export const BURNING = 420;   // systems/soundClips.js SOUND.Burning
export const BODY_FALL = 15;   // systems/soundClips.js SOUND.BodyFall - a body meeting the floor (WB7)
/** WB9c: the crystals' sounds - DAGGER.SND's own (SoundClips indices, verbatim): the dungeon's grind (AmbientGrind, 68) as
 *  one rises out of the stone, the parry's ring (Parry6, 433) pitched up into glass as it is struck, and the large
 *  splash (SplashLarge, 342) pitched high into a crash of shards as it breaks, with the parry's ring deep under it. */
export const CRYSTAL_CLIPS = Object.freeze({ rise: 68, hit: 433, shatter: 342 });
export const THUNDER_ROLL = 350;   // systems/ambientEffects.js AMBIENT_SOUNDS.storm's ThunderRoll (WB7)
export const FIRE_CAST_ID = 352;   // systems/enemySpells.js SPELL_CAST_SOUND[0], the fire's
export const SWING_LOW = 105;   // systems/soundClips.js SOUND.SwingLowPitch - WB13d: a great blade loosed
/** WB13d: THE RELEASE - this long before each landing, a sound of its coming (render/gate/gateTelegraph.js's last-moment
 *  burn, heard): the wind-up's bark says what, the release says now. */
export const RELEASE_LEAD_MS = 350;
const fireLoosed = (volume, reach, at = 'him') => Object.freeze({ id: FIRE_CAST_ID, pitch: 1.1, volume, reach, at });
export const BOSS_CUES = Object.freeze({
  // WB13d: the wind-ups his one bark and his one cast carry each stand at least four semitones from the next of their
  // clip in his rotation (2-3 apart, the Cleave, the Slam and the Leap were one sound)
  windup: Object.freeze({
    cleave: voice(B.barkSound, 0.96),
    slam: voice(B.barkSound, 0.76),
    charge: voice(B.moveSound, 0.7),
    hellfire: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.8, volume: 1.3, reach: 60, at: 'him' }),
    nova: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.63, volume: 1.4, reach: 60, at: 'him' }),
    wrath: voice(B.barkSound, 0.45, 1.8),
    // WBX5: the new three - a bark as he gathers himself to leap, the fire's cast as the meteor is called, a deep bark
    // over the spokes' lanes
    leap: voice(B.barkSound, 0.6, 1.5),
    meteor: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.5, volume: 1.5, reach: 70, at: 'him' }),
    spokes: voice(B.barkSound, 0.47, 1.6),
    // WB9b: the bound - his roar as he gathers himself, heard across every court; WB9c: the Reckoning - Dagon called,
    // the deepest roar and the fire's cast under it, heard from anywhere in the arena
    cross: Object.freeze({ clip: B.barkSound, pitch: 0.46, volume: 1.9, reach: 160, at: 'him' }),
    reckon: Object.freeze({ clip: B.barkSound, pitch: 0.38, volume: 2.1, reach: 160, at: 'him' }),
    // WB14a: the new arsenal - the chain thrown (his stride's own sound, higher than the Charge's), Dagon's brand called on
    // the fire's cast under the Meteor's and the Unmaking's under that, the Torment on his attack's own cry, the Wheel's
    // bark and the Gaze's under the Spokes' - each pitched down for his size, four semitones and more from the rest of its
    // clip (WB13d)
    chains: voice(B.moveSound, 0.9, 1.4),
    brand: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.39, volume: 1.4, reach: 60, at: 'him' }),
    torment: voice(B.attackSound, 0.85, 1.4),
    wheel: voice(B.barkSound, 0.37, 1.6),
    gaze: voice(B.barkSound, 0.29, 1.8),
    unmake: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.305, volume: 1.7, reach: 80, at: 'him' }),
    // WB14d: the Sundering - his attack's cry torn low, heard in every court; the Rejoining's lower still (the Torment's
    // clip, each four semitones and more below the last)
    sunder: Object.freeze({ clip: B.attackSound, pitch: 0.62, volume: 1.9, reach: 160, at: 'him' }),
    rejoin: Object.freeze({ clip: B.attackSound, pitch: 0.48, volume: 2.0, reach: 160, at: 'him' }),
  }),
  // WB13d: the release - his blade's swing, his weight gathered as it comes down, his fire loosed (Dagon's too)
  release: Object.freeze({
    cleave: Object.freeze({ clip: SWING_LOW, pitch: 0.45, volume: 1.5, reach: 40, at: 'him' }),
    charge: Object.freeze({ clip: SWING_LOW, pitch: 0.45, volume: 1.5, reach: 40, at: 'him' }),
    slam: Object.freeze({ clip: BODY_FALL, pitch: 0.5, volume: 1.4, reach: 50, at: 'him' }),
    leap: Object.freeze({ clip: BODY_FALL, pitch: 0.5, volume: 1.4, reach: 50, at: 'him' }),
    cross: Object.freeze({ clip: BODY_FALL, pitch: 0.4, volume: 1.7, reach: 120, at: 'him' }),
    hellfire: fireLoosed(1.1, 40, 'targets'),
    nova: fireLoosed(1.3, 50),
    meteor: fireLoosed(1.3, 60, 'targets'),
    spokes: fireLoosed(1.3, 50),
    wrath: fireLoosed(1.8, 120),
    reckon: fireLoosed(1.8, 160),
    chains: Object.freeze({ clip: SWING_LOW, pitch: 0.7, volume: 1.4, reach: 40, at: 'him' }),   // WB14a
    brand: fireLoosed(1.1, 40, 'targets'),
    torment: fireLoosed(1.1, 40, 'targets'),
    wheel: Object.freeze({ clip: SWING_LOW, pitch: 0.55, volume: 1.6, reach: 45, at: 'him' }),
    gaze: fireLoosed(1.4, 70),
    unmake: fireLoosed(1.5, 60),
    sunder: Object.freeze({ clip: BODY_FALL, pitch: 0.45, volume: 1.7, reach: 120, at: 'him' }),   // WB14d
    rejoin: Object.freeze({ clip: BODY_FALL, pitch: 0.36, volume: 1.8, reach: 160, at: 'him' }),
  }),
  land: Object.freeze({
    cleave: voice(B.attackSound, 0.8),
    slam: voice(B.attackSound, 0.6, 1.6),
    charge: voice(B.attackSound, 0.72),
    hellfire: Object.freeze({ clip: BURNING, pitch: 0.9, volume: 1.2, reach: 40, at: 'targets' }),
    nova: Object.freeze({ clip: BURNING, pitch: 0.7, volume: 1.8, reach: 60, at: 'him' }),
    wrath: Object.freeze({ clip: BURNING, pitch: 0.5, volume: 2, reach: 120, at: 'him' }),
    leap: voice(B.attackSound, 0.55, 1.7),
    meteor: Object.freeze({ clip: BURNING, pitch: 0.55, volume: 2, reach: 80, at: 'targets' }),
    spokes: Object.freeze({ clip: BURNING, pitch: 0.65, volume: 1.8, reach: 60, at: 'him' }),
    cross: Object.freeze({ clip: BODY_FALL, pitch: 0.24, volume: 2.2, reach: 160, at: 'him' }),
    reckon: Object.freeze({ clip: BURNING, pitch: 0.42, volume: 2.2, reach: 200, at: 'him' }),
    chains: voice(B.attackSound, 0.9),   // WB14a
    brand: Object.freeze({ clip: BURNING, pitch: 0.95, volume: 1.4, reach: 40, at: 'targets' }),
    torment: Object.freeze({ clip: BURNING, pitch: 0.8, volume: 1.6, reach: 40, at: 'targets' }),
    wheel: voice(B.attackSound, 0.66, 1.6),
    gaze: Object.freeze({ clip: BURNING, pitch: 0.85, volume: 1.6, reach: 70, at: 'him' }),
    unmake: Object.freeze({ clip: BURNING, pitch: 0.6, volume: 2, reach: 80, at: 'him' }),
    sunder: voice(B.attackSound, 0.5, 2),   // WB14d
    rejoin: Object.freeze({ clip: BODY_FALL, pitch: 0.22, volume: 2.2, reach: 160, at: 'him' }),
  }),
  roar: voice(B.barkSound, 0.5, 1.8),
  fall: voice(B.barkSound, 0.4, 1.8),
  // WB7 (Mac: "Proper boss audio during the boss fight"): HIS BODY. A stride's weight on the stone as he walks and
  // charges; a growl now and then while he is not striking; a grunt when he is hurt; the ground's shock under his
  // heavy landings; thunder over his roar when a phase turns; and his body meeting the floor, a moment into his fall.
  // The clips are Daggerfall's own - a body's fall and the storm's roll, pitched down for his size.
  step: Object.freeze({ clip: BODY_FALL, pitch: 0.42, volume: 1.0, reach: 45, at: 'him' }),
  growl: voice(B.barkSound, 0.36, 0.75),
  hurt: voice(B.barkSound, 0.62, 0.9),
  quake: Object.freeze({ clip: BODY_FALL, pitch: 0.3, volume: 1.8, reach: 70, at: 'him' }),
  thunder: Object.freeze({ clip: THUNDER_ROLL, pitch: 0.62, volume: 1.4, reach: 140, at: 'him' }),
  thud: Object.freeze({ clip: BODY_FALL, pitch: 0.26, volume: 2.0, reach: 90, at: 'him' }),
  // WB9c: THE CRYSTALS, heard - each one's rising (glass grinding up out of the stone), each blow on one, each one's
  // shattering, and the Reckoning broken (his roar cut short, the ward's ring as he falls to his knees)
  crystalRise: Object.freeze({ clip: CRYSTAL_CLIPS.rise, pitch: 0.7, volume: 1.3, reach: 60, at: 'point' }),
  crystalHit: Object.freeze({ clip: CRYSTAL_CLIPS.hit, pitch: 1.55, volume: 0.9, reach: 30, at: 'point' }),
  crystalBreak: Object.freeze({ clip: CRYSTAL_CLIPS.shatter, pitch: 1.9, volume: 1.7, reach: 80, at: 'point' }),
  crystalRing: Object.freeze({ clip: CRYSTAL_CLIPS.hit, pitch: 0.55, volume: 1.4, reach: 80, at: 'point' }),
  stunned: Object.freeze({ clip: B.barkSound, pitch: 0.7, volume: 1.8, reach: 120, at: 'him' }),
  // WB9d: a step into his burning ground - the fire's hiss under my own feet, at once (the bite is a tick off)
  groundStep: Object.freeze({ clip: BURNING, pitch: 1.35, volume: 0.9, reach: 14, at: 'point' }),
  // WB13e: a Meteor or a Leap aimed where I stand, at its word - the parry's ring, high and sharp, at my feet
  sting: Object.freeze({ clip: CRYSTAL_CLIPS.hit, pitch: 2.2, volume: 1.3, reach: 20, at: 'point' }),
});
/** GATE-MIX (2026-10-20, the owner: "the game hitches, audio becomes super loud and even distorts"): A CUE AT ITS
 *  TARGETS, THINNED. A cue `at: 'targets'` played one copy at every target - a Hellfire on five players was five of the
 *  fire's full-scale cast in one frame, ten in his third phase (its second volley within 3 m of the first), and over a
 *  reach of 40 to 80 m with a linear fall every copy near a group came in at nearly its whole level, so the copies
 *  summed far past the clip. Now the target nearest my ear first, then the next that stands CUE_TARGET_APART_M or
 *  more from every one kept, at most CUE_TARGET_COPIES: where it lands on me is still heard at my feet, a fall across
 *  the court still from across it, and no two copies of one clip stand on top of each other. */
export const CUE_TARGET_COPIES = 2;
export const CUE_TARGET_APART_M = 10;
/** The places a 'targets' cue sounds at, of `points` (each [x, y, z], the ear's frame) for an ear at `ear` - nearest
 *  first, thinned as above; with no ear, the first. Pure. */
export function cueTargetPlaces(points, ear) {
  if (!Array.isArray(points) || !points.length) return [];
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const order = Array.isArray(ear) ? points.slice().sort((p, q) => d2(p, ear) - d2(q, ear)) : points;
  const kept = [], apart = CUE_TARGET_APART_M * CUE_TARGET_APART_M;
  for (const p of order) {
    if (kept.length >= CUE_TARGET_COPIES) break;
    if (kept.every((k) => d2(k, p) >= apart)) kept.push(p);
  }
  return kept;
}
/**
 * WB8b: HIS ASPECT, HEARD - his elemental blows' wind-ups and landings under each aspect but his burning one: the
 * element's own cast (systems/enemySpells.js SPELL_CAST_SOUND - cold 353, shock 351, poison 350) as they are called,
 * and at the landing the cold's and the poison's cast again, deeper, and the storm's thunder (WB7's ThunderRoll). The
 * pitch and the reach of the burning cue it stands for are kept, so each blow still sounds its own weight.
 */
export const ASPECT_CUE_IDS = Object.freeze({ rime: 353, storm: 351, venom: 350 });
export const ASPECT_LAND = Object.freeze({
  rime: Object.freeze({ id: 353, pitch: 0.55 }),
  storm: Object.freeze({ clip: THUNDER_ROLL, pitch: 0.9 }),
  venom: Object.freeze({ id: 350, pitch: 0.5 }),
});
/** The cue of `kind` ('windup', WB13d 'release', or 'land') for an attack under a profile (net/gate/gateBrain.js fightProfile). */
export function bossCue(kind, A, P) {
  const cue = BOSS_CUES[kind]?.[A.key] ?? null;
  const aspect = P?.aspect?.id;
  if (!cue || isDagons(A) || !P?.atk?.[A.key]?.el || !(aspect in ASPECT_CUE_IDS)) return cue;   // Dagon's Wrath is Dagon's - WB9c: and his Reckoning
  if (kind === 'windup' || kind === 'release') return { id: ASPECT_CUE_IDS[aspect], pitch: cue.pitch, volume: cue.volume, reach: cue.reach, at: cue.at };
  const land = ASPECT_LAND[aspect];
  return { ...(land.clip != null ? { clip: land.clip } : { id: land.id }), pitch: land.pitch * (cue.pitch / 0.7), volume: cue.volume, reach: cue.reach, at: cue.at };
}
/** WB9d: the hiss of a step into his ground under a profile - the burning ground's own, or his aspect's element's cast
 *  (the rime's cold, the storm's shock, the venom's poison), high and short, at my feet. */
export function groundStepCue(P) {
  const id = ASPECT_CUE_IDS[P?.aspect?.id];
  return id != null ? { id, pitch: 1.3, volume: BOSS_CUES.groundStep.volume, reach: BOSS_CUES.groundStep.reach, at: 'point' } : BOSS_CUES.groundStep;
}
/** WB7: his stride (metres of his walk or his charge between two steps), how often he growls between his attacks
 *  (ms, the next drawn in this span), the least time between two grunts, the least share of his health a grunt
 *  needs, which landings shake the ground, and when in his fall his body meets the floor (ms). */
export const BOSS_STRIDE_M = 2.8;
export const GROWL_EVERY_MS = Object.freeze([7000, 13000]);
export const HURT_GAP_MS = 1400;
export const HURT_SHARE = 0.004;
export const QUAKE_ON = Object.freeze(['slam', 'charge', 'nova', 'wrath', 'leap', 'meteor', 'cross', 'reckon', 'sunder', 'rejoin']);   // WB14d: and the Sundering's and the Rejoining's   // WBX5: his leap's landing and a meteor's fall shake it too; WB9: the bound's and the Reckoning's
/** WB13d: A LANDING FELT - the camera's shake (systems/betterAmbience.js weaponKick, under the player's own maxShake) at
 *  nought metres from where it lands and the reach it fades to nothing over; a reach of none: the whole arena feels it. */
export const LAND_SHAKE = Object.freeze({
  slam: Object.freeze([2.5, 12]), leap: Object.freeze([2.5, 12]), cross: Object.freeze([4, 25]), meteor: Object.freeze([3.5, 15]),
  nova: Object.freeze([2, 24]), wrath: Object.freeze([6, 0]), reckon: Object.freeze([6, 0]),
});
/** AUDIT WB14 (SCREEN-12): his tearing and his making whole are felt as his bound is - they quake and burst as it does -
 *  through the bound's own shake, not two kinds more (SD16 holds the Hour to more kinds of shake than his court). */
export const SHAKE_AS = Object.freeze({ sunder: 'cross', rejoin: 'cross' });
/** The shake a landing of `A` gives feet `d` metres from it (a reach of none: everywhere). Pure. */
export const landShake = (A, d) => { const w = LAND_SHAKE[SHAKE_AS[A?.key] ?? A?.key]; return !w ? 0 : !(w[1] > 0) ? w[0] : w[0] * Math.max(0, 1 - d / w[1]); };
export const THUD_AT_MS = 1500;

// ═══ WB11c: HIS HOST, SEEN AND HEARD ═══════════════════════════════════════════════════════════════════════════
//
// (2026-10-01, Mac: "1. All three ... 4. Trial rotation" - the Legion-Lord's host; bible World-Bosses.md section 17.)
// The relay knows bodies (net/gate/gateBrain.js HOST_KINDS); WHO each one is, by his aspect, is the screen's: Daggerfall's
// own sprites at their own size, on their own tables - an Imp for every Harrier; the Atronach of his element for a
// Sapper; for a Ward-Bearer the Daedra nearest it (the Seducer in her winged form for the storm - her change is not
// played). PURE: a host body (net/gate/gateLink.js GateHost's) and a clock in; a look, an act, a frame and a cue out.

/** Who each kind is under each aspect: its mobile (its sprite, its sounds - enemyBasics.js), its name and its plural for
 *  the words; an Imp HOVERS this high over the floor (its behaviour is Flying); the Seducer is drawn WINGED. */
export const HOST_LOOKS = Object.freeze({
  harrier: Object.freeze({ burning: 1, rime: 1, storm: 1, venom: 1 }),
  sapper: Object.freeze({ burning: 35, rime: 38, storm: 36, venom: 37 }),
  bearer: Object.freeze({ burning: 26, rime: 25, storm: 29, venom: 27 }),
  // WB14c: the Vanguard's - a Daedroth's weight, a Daedra of his aspect's fire (a Lich under the venom), and his lieutenant a
  // Daedra Lord, as he is
  brute: Object.freeze({ burning: 27, rime: 27, storm: 27, venom: 27 }),
  caster: Object.freeze({ burning: 26, rime: 25, storm: 29, venom: 32 }),
  markynaz: Object.freeze({ burning: 31, rime: 31, storm: 31, venom: 31 }),
  tithe: Object.freeze({ burning: 1, rime: 1, storm: 1, venom: 1 }),   // WB14e: an Imp, at TITHE_SCALE, burning gold
  gaoler: Object.freeze({ burning: 26, rime: 25, storm: 29, venom: 27 }),   // WB14f: the Ward-Bearer's Daedra, by another name
});
/** WB14e: the Tithe-Imp drawn this much larger than an Imp, and its gold (its glow, its burst, its name's line). */
export const TITHE_SCALE = 1.3;
export const TITHE_GOLD = Object.freeze([1.0, 0.8, 0.3]);
export const HOST_NAMES = Object.freeze({
  1: Object.freeze(['Imp', 'Imps']), 35: Object.freeze(['Fire Atronach', 'Fire Atronachs']), 38: Object.freeze(['Ice Atronach', 'Ice Atronachs']),
  36: Object.freeze(['Iron Atronach', 'Iron Atronachs']), 37: Object.freeze(['Flesh Atronach', 'Flesh Atronachs']),
  26: Object.freeze(['Fire Daedra', 'Fire Daedra']), 25: Object.freeze(['Frost Daedra', 'Frost Daedra']), 29: Object.freeze(['Daedra Seducer', 'Daedra Seducers']), 27: Object.freeze(['Daedroth', 'Daedroths']),
  // WB14c: the Vanguard's Lich and its Markynaz (a Daedra Lord by his rank, read through the text core - L10N4)
  32: Object.freeze({ get 0() { return t('gate.host.lich', 'Lich'); }, get 1() { return t('gate.host.liches', 'Liches'); } }),
  31: Object.freeze({ get 0() { return t('gate.host.markynaz', 'Markynaz'); }, get 1() { return t('gate.host.markynazes', 'Markynazes'); } }),
});
export const HOST_HOVER_M = 0.9;
/** A host body's look - its mobile, its names, how high it hovers, whether it is drawn winged - for kind `k` under the
 *  aspect `aspectId` (the Burning's for one it does not know). Pure. */
export function hostLookOf(k, aspectId) {
  const key = HOST_KINDS[k]?.key ?? 'harrier', table = HOST_LOOKS[key];
  const mobile = table[aspectId] ?? table.burning;
  const names = HOST_NAMES[mobile], name = names?.[0] ?? 'Daedra', plural = names?.[1] ?? 'Daedra';   // WB14c: a row of getters reads as a pair
  const tithe = k === HOST.tithe;   // WB14e: an Imp by its sprite, the Tithe-Imp by its name and its size
  if (k === HOST.gaoler) return { mobile, name: t('gate.host.gaoler', 'Gaoler'), plural: t('gate.host.gaolers', 'Gaolers'), hover: 0, winged: mobile === 29, scale: 1 };   // WB14f: a Ward-Bearer's body, the Pen's name
  return { mobile, name: tithe ? t('gate.host.tithe', 'Tithe-Imp') : name, plural: tithe ? t('gate.host.tithes', 'Tithe-Imps') : plural, hover: ENEMY_BASICS[mobile]?.behaviour === 'Flying' ? HOST_HOVER_M : 0, winged: mobile === 29, scale: tithe ? TITHE_SCALE : 1 };
}
/** WB14f: THE CAPTIVE'S BODY - Daggerfall's Knight (mobile 145): his archive, or a Dame's her own (net/gate/gateMods.js
 *  CAPTIVE_DAMES). Pure. */
export const KNIGHT_MOBILE = 145;
export const knightLookOf = (dame) => Object.freeze({ mobile: KNIGHT_MOBILE, archive: (dame ? ENEMY_BASICS[KNIGHT_MOBILE]?.femaleTexture : null) ?? ENEMY_BASICS[KNIGHT_MOBILE]?.maleTexture ?? null });
/** WB14f: the hurt frame the captive is held bowed in while chained (bossFrame clamps it to the record's last). */
export const KNIGHT_BOWED_FRAME = 9;
/** WB14f: what the captive is doing at `now` - bowed in his chains, or standing free (his idle). Pure. */
export function knightAct(freed, now) {
  if (!freed) return { act: 'chained', anims: HURT_ANIMS, frame: KNIGHT_BOWED_FRAME, loop: false, sink: 0 };
  return { act: 'idle', anims: IDLE_ANIMS, frame: Math.floor((Math.max(0, now) / 1000) * IDLE_ANIM_SPEED), loop: true, sink: 0 };
}
/** WB11c: THE ENTITY A BLOW ON ONE OF HIS HOST IS COMPUTED AGAINST - his stand-in's law over its own mobile (every metal
 *  bites, a knight's plate for armour, a health nothing here can empty - the relay holds its real one, never swayed),
 *  named for the lines a blow says. AUDIT WB11 W1: one a BODY, naming it (`hostI`) - a Cast When Strikes spell on it is
 *  that body's (scenes/hostEnchant.js asks the stand-in it met), where one shared by a look sent it to HIM. */
export function hostStandIn(look, i = null, share = null, blowX = null) {   // FIELD BUGS 2026-10-18f RELAY-SHARE: `share` its own word's reader (bossStandIn); 2026-10-19f STAND-IN-WHOLE: `blowX` its relay's bucket's
  const e = bossStandIn({ mobile: look.mobile }, look.name, share, blowX);
  if (i !== null) e.hostI = i;
  return e;
}

/** WB11c: a host body's fall - its hurt frames played out over HOST_FALL_MS, and gone; a crumbling one sinks into the
 *  floor over the same span (the court's driver draws it so). A Sapper he drank is gone at once, into him. */
export const HOST_FALL_MS = 900;
/** How long a blow of mine flinches one (only while it does nothing else). */
export const HOST_FLINCH_MS = 350;
/**
 * WHAT ONE OF HIS HOST IS DOING at `now`: `act` one of rise, windup, strike, walk, flinch, idle; `anims` the table that
 * shows it (the Seducer's winged ones where its look says); `frame` and `loop` as bossAct's; `sink` metres under the floor
 * it still stands (rising - every screen sees it come up out of the stone). Pure.
 * @param {any} a a host body (net/gate/gateLink.js GateHost's `ads`) @param {number} now @param {{mobile?: number, winged?: boolean, hover?: number}} look
 * @param {number} [hurtAt] when a blow of mine last met it
 */
export function hostAct(a, now, look, hurtAt = -Infinity) {
  const winged = !!look?.winged;
  // AUDIT WB11 C1/C7: its tables and its clock by the port's own law for its mobile (characters/mobile/mobileUnit.js stateAnims,
  // and MobileUnit's flyer clock - DFU's GetStateAnims): an Imp has no idle frames (HasIdle false) and idles and rises
  // on its move loop - it rose and idled on records it does not have; a flyer (the Imp, the winged Seducer) moves and
  // idles at FLY_ANIM_SPEED, every other table at its own pace
  const tab = (state) => stateAnims(state, look?.mobile, !!ENEMY_BASICS[look?.mobile]?.hasIdle, false, false, true, false, winged);
  const moveT = tab('move'), idleT = tab('idle'), hurtT = tab('hurt'), atkT = tab('attack');
  const flyer = winged || (look?.hover ?? 0) > 0;
  const pace = flyer ? FLY_ANIM_SPEED : moveT[0].fps, idlePace = flyer ? FLY_ANIM_SPEED : idleT[0].fps;
  const riseMs = HOST_RISE_MS[a?.k] ?? 0, since = now - (a?.rose ?? -Infinity);
  if (since < riseMs) return { act: 'rise', anims: idleT, frame: Math.floor((Math.max(0, since) / 1000) * idlePace), loop: true, sink: HOST_KINDS[a.k].h * (1 - Math.max(0, since) / riseMs) };
  const tel = a?.atk ? hostTelegraphAt(a.atk, a.k, now) : null;
  if (tel && !tel.landing && !tel.over) return { act: 'windup', anims: atkT, frame: winged ? 0 : tel.t >= 0.5 ? 1 : 0, loop: false, sink: 0 };
  if (tel && tel.since < 600) return { act: 'strike', anims: atkT, frame: winged ? Math.floor((tel.since / 1000) * PRIMARY_ATTACK_ANIM_SPEED) : 2 + Math.floor((tel.since / 1000) * PRIMARY_ATTACK_ANIM_SPEED), loop: winged, sink: 0 };
  if (now - hurtAt >= 0 && now - hurtAt < HOST_FLINCH_MS) return { act: 'flinch', anims: hurtT, frame: Math.floor(((now - hurtAt) / 1000) * HURT_ANIM_SPEED), loop: winged, sink: 0 };
  const m = a?.mv;
  if (m && m.v > 0) {
    const [x, z] = hostAt(a, now);
    if (Math.hypot(m.tx - x, m.tz - z) > 0.05) return { act: 'walk', anims: moveT, frame: Math.floor((now / 1000) * pace), loop: true, sink: 0 };
  }
  return { act: 'idle', anims: idleT, frame: Math.floor((now / 1000) * idlePace), loop: true, sink: 0 };
}
/** WB11c: a gone body's last act at `now` - slain or crumbled, its hurt frames over HOST_FALL_MS (crumbling, it sinks the
 *  while); drunk, nothing (it went into him); and past its span, gone. */
export function hostFallAct(g, now, look) {
  const since = now - g.at, winged = !!look?.winged;
  if (g.w === 1 || since >= HOST_FALL_MS || since < 0) return { act: 'gone', anims: HURT_ANIMS, frame: 0, loop: false, sink: 0 };
  return { act: 'fall', anims: winged ? SEDUCER_IDLE_MOVE_ANIMS : HURT_ANIMS, frame: Math.floor((since / HOST_FALL_MS) * 4), loop: winged, sink: g.w === 2 || g.w === 3 ? HOST_KINDS[g.k].h * (since / HOST_FALL_MS) : 0 };   // WB14e: one that fled sinks into the fire, as one that crumbled
}
/** WB11c: HIS HOST, HEARD - each one's own clips (enemyBasics.js: its bark and its attack; its fall the body's thud) at its own place: rising
 *  out of the fire, winding a blow, landing it, hurt, falling; and a Sapper drunk - his growl over the fire's roar. */
export function hostCue(kind, mobile) {
  const E = ENEMY_BASICS[mobile] ?? ENEMY_BASICS[1];
  switch (kind) {
    case 'rise': return { clip: E.barkSound, pitch: 0.92, volume: 1.15, reach: 55, at: 'point' };
    case 'windup': return { clip: E.barkSound, pitch: 1, volume: 1, reach: 40, at: 'point' };
    case 'land': return { clip: E.attackSound, pitch: 1, volume: 1.1, reach: 40, at: 'point' };
    case 'hurt': return { clip: E.barkSound, pitch: 1.2, volume: 0.8, reach: 30, at: 'point' };
    case 'fall': return { clip: BODY_FALL, pitch: 1.1, volume: 1, reach: 40, at: 'point' };
    case 'drunk': return { clip: BURNING, pitch: 0.6, volume: 1.6, reach: 70, at: 'point' };
    default: return null;
  }
}
/** WB11c: his host's colours - a Bite's (his weight's, a little hotter), a Pulse's (his element's: the Nova's under his
 *  aspect, the fire's orange under the Burning - HOST_PULSE_FIRE), a Sapper's path to him (his ember, faint), a
 *  Ward-Bearer's tether (the ward's gold). Display-encoded. */
export const HOST_BITE_COLOR = Object.freeze([1.0, 0.4, 0.16]);
export const HOST_PULSE_FIRE = Object.freeze([1.0, 0.5, 0.12]);
export const hostPulseColor = (P) => ASPECT_COLORS[P?.aspect?.id]?.nova ?? HOST_PULSE_FIRE;   // AUDIT WB11 U2: the Burning's Nova gold was the ward's own - the disc that hurts read as the tether beside it
