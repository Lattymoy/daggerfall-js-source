// @ts-check
// ═════════════════════════════════════════════════════════════════════
// PVP-REF (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and
// do sieges"; "Continue") - THE REFEREED BLOW AND STEP
// (bible/11-Multiplayer/Seats-Arc.md 6.1).
//
// FACT: no server sees a blow between players today - a duel's blow is
// the defender's to judge, on its own machine (DUEL1). A siege cannot be
// fought that way: a town's Charter changes hands on it. So in a siege's
// room the RELAY holds every fighter's vitality, and every blow, cast and
// step is judged here, the gate's law (net/gateBrain.js applyHit) grown
// from one foe to many fighters:
//
//   - VITALITY is normalised: 300 + 2 x the Renown level the account
//     service signed (the token's `lv`), 302 to 400 - flat on purpose, so
//     a lie about Renown buys a third more at most. A siege never touches
//     the save's health, items or gold.
//   - A BLOW is a claim `{ to, w, m, d, r }`: accepted while both stand,
//     the target's last pose within the weapon's reach (melee 2.5 m, a
//     shaft 60 m) and POSE_SLACK, the striker under 4 a second - and its
//     damage CLIPPED to the weapon's bucket: DFU's own range for that
//     weapon at that material, the attacker's bonuses at the game's caps,
//     doubled for a critical, never more. The weapon is the one the
//     striker's LOOK carries in hand (the paperdoll every other player
//     draws), never the claim's own word alone.
//   - A CAST: at most 3 damaging a 5 seconds, each to 60; a heal to 40,
//     three a 5 seconds of its own.
//   - A STEP: no faster than 18 m/s and half a metre (MEASURED below) -
//     AUDIT-SEATS R1/R2: its run and its climb together, on an allowance
//     the fighter carries (a second's run and the slack at most); past it
//     the relay pulls the fighter back to its last good pose. A fall is
//     gravity's, never refused.
//   - A FALLEN fighter rises at its side's next wave, with 3 seconds no
//     blow touches.
//
// A LEAF: the relay bundles every byte it imports (test/relayversion
// .test.js), so DFU's damage tables are copied here and pinned EQUAL to
// characters/weapons.js and combat/formulas.js by test, not imported
// (the gate's way - test/wb4b_gate_blows.test.js).
//
// Pure: no clock (every `now` an argument), no DOM, no network.
// ═════════════════════════════════════════════════════════════════════

/** A siege's room: `siege:<seat key>:<seat week>` - one a battle (Seats-Arc 6.2). */
export const SIEGE_ROOM = /^siege:(0|[1-9]\d{0,9}):(0|[1-9]\d{0,5})$/;
export const siegeRoomKey = (key, week) => `siege:${key}:${week}`;
export const isSiegeRoom = (k) => SIEGE_ROOM.test(String(k ?? ''));
/** A siege room's seat and week, or null. */
export function siegeOfRoom(k) {
  const m = SIEGE_ROOM.exec(String(k ?? ''));
  return m ? { key: Number(m[1]), week: Number(m[2]) } : null;
}

/** VITALITY (6.1): 300 + 2 x the Renown level, the level held to the token's own bound (1-50). */
export const SIEGE_VITALITY = Object.freeze({ base: 300, perLevel: 2, levelMax: 50 });
export const siegeVitality = (lv) => SIEGE_VITALITY.base + SIEGE_VITALITY.perLevel * Math.max(1, Math.min(SIEGE_VITALITY.levelMax, Math.trunc(Number(lv) || 1)));

/** World units a metre in a siege's room - a town's cell (world natives, net/duelSession.js NATIVES_PER_M). */
export const SIEGE_UNITS_PER_M = 40;
/** REACH (6.1): DFU's effective melee reach (WeaponManager.cs:35's 2.25 m and the sphere cast's 0.25), a shaft's 60 m,
 *  and the slack a pose's own lag earns (the gate's POSE_SLACK), in metres. */
export const SIEGE_REACH = Object.freeze({ melee: 2.5, shaft: 60, spell: 60, slack: 3 });
/** The kinds of blow on the wire: the gate's HIT_KINDS order. */
export const SIEGE_HIT = Object.freeze({ Melee: 0, Shaft: 1, Spell: 2 });
/** Blows a second a striker, one second deep (the gate's GATE_HIT_HZ_MAX). */
export const SIEGE_BLOWS_HZ = 4;
/** CASTS (6.1): damaging casts in a window, each one's damage, a heal's. A heal is bounded on a window of the same shape,
 *  its own (DECIDED here: 6.1 clamped a heal's size and named no rate, and at the frame gate's 8 a second an unbounded heal
 *  is 320 a second - a fighter nobody can fell; the referee has no unbounded verb). */
export const SIEGE_CASTS = Object.freeze({ max: 3, windowMs: 5000, damageMax: 60, healMax: 40 });
/**
 * THE STEP (6.1): the fastest a fighter may move across the ground, and the slack a step earns, in metres. MEASURED (6.1:
 * "the fastest legal run the motor allows with every Speed buff ... the ceiling 25% above it"): player/motor.js runSpeed
 * at live Speed's cap (statMods.js MAX_STAT_VALUE 100 - a Fortify past it reads 100), Running at the softcap's top
 * (skillSoftcap.js EFFECTIVE_SKILL_MAX 140, a mastered 200) with the lycanthrope's +30 and an Enhances Skill item's +15 -
 * (100 + 150) / 39.5 x (1.35 + 185 / 200) = 14.4 m/s; x 1.25 = 18. The design's starting 12.5 would have pulled back
 * every mastered runner (13.0 m/s); 18 still holds a stack of eight Running items, and refuses any teleport or doubled
 * run. A horse is dismounted on entry (SEAT2a's client).
 */
export const SIEGE_SPEED = Object.freeze({ mps: 18, slackM: 0.5 });
/** THE WAVES (6.2): a fallen fighter rises at its side's next wave - every 20 s at a palace seat, 30 at a crown - with
 *  3 s that no blow touches. */
export const SIEGE_WAVE_MS = Object.freeze({ palace: 20000, crown: 30000 });
export const SIEGE_PROTECT_MS = 3000;
/** The most fighters a siege's room keeps (6.4: a crown's 20 a side and its 4 sellswords a side). */
export const SIEGE_FIGHTERS_MAX = 48;

// ─── THE BUCKET (6.1: "DFU's own damage range for that weapon at that material, doubled for a critical") ───

/** DFU's weapon templates (characters/weapons.js WEAPONS), and the port's own Thunderlock (its 7-26 span). */
export const SIEGE_WEAPONS = Object.freeze({
  Dagger: 113, Tanto: 114, Staff: 115, Shortsword: 116, Wakazashi: 117, Broadsword: 118, Saber: 119, Longsword: 120,
  Katana: 121, Claymore: 122, Dai_Katana: 123, Mace: 124, Flail: 125, Warhammer: 126, Battle_Axe: 127, War_Axe: 128,
  Short_Bow: 129, Long_Bow: 130,
});
/** FormulaHelper.CalculateWeaponMaxDamage, by template (characters/weapons.js MAX_DAMAGE, pinned equal). */
export const SIEGE_WEAPON_MAX = Object.freeze({
  113: 6, 114: 8, 115: 8, 116: 8, 117: 10, 118: 12, 119: 12, 120: 16, 121: 16, 122: 18, 123: 21, 124: 12, 125: 14,
  126: 18, 127: 12, 128: 16, 129: 16, 130: 18,
});
/** The Thunderlock's template and span (characters/thunderlockIds.js, weapons.js THUNDERLOCK_SPAN - pinned equal). */
export const SIEGE_THUNDERLOCK = Object.freeze({ template: 560, max: 26 });
/** DaggerfallUnityItem.GetWeaponMaterialModifier by material, Iron to Daedric (characters/weapons.js, pinned equal). */
export const SIEGE_MATERIAL_MOD = Object.freeze([-1, 0, 0, 1, 2, 3, 3, 4, 5, 6]);
/** Hand-to-hand's most at the skill's top (combat/formulas.js handToHandMaxDamage(100), pinned equal). */
export const SIEGE_FIST_MAX = 21;
/**
 * THE ATTACKER'S BONUSES AT THE GAME'S CAPS (combat/formulas.js weaponAttackDamage): Strength 100's damage modifier
 * (floor((100 - 50) / 5)), the heaviest swing (playerWeapon.js SWING_MODS' StrikeDown), an expert's proficiency and a
 * racial bonus at level 30 (trunc(30 / 3) + 1, trunc(30 / 3)) - DECIDED here: a siege fighter's character level is not on
 * the wire, so the bucket takes the game's level 30 for the two that grow with it.
 */
export const SIEGE_BONUS = Object.freeze({ strength: 10, swing: 4, proficiency: 11, racial: 10 });
export const SIEGE_BONUS_MAX = SIEGE_BONUS.strength + SIEGE_BONUS.swing + SIEGE_BONUS.proficiency + SIEGE_BONUS.racial;
/** A critical's most (PCAAO's criticalStrikesIncreaseDamage ceiling - classic DFU's critical adds to-hit alone). */
export const SIEGE_CRIT_MAX = 2;

/**
 * THE MOST ONE BLOW MAY DEAL: (the weapon's top + its material + the attacker's bonuses at their caps) x a critical's
 * most. `w` a weapon template (null or -1 hand-to-hand), `m` its material (0 Iron to 9 Daedric). 0 for a template this
 * table does not name. INT7: a weapon's top and material never past the striker's SIGNED arms (`wa`, armsOk - the most
 * any weapon its judged record holds reaches); a fist is every character's, its own most.
 */
export function siegeBlowMax(w, m, wa = null) {
  if (w == null || w === -1) return (SIEGE_FIST_MAX + SIEGE_BONUS_MAX) * SIEGE_CRIT_MAX;
  const reach = armsTop(w, m);
  if (reach == null) return 0;
  return Math.max(0, (armsOk(wa) ? Math.min(reach, wa[0]) : reach) + SIEGE_BONUS_MAX) * SIEGE_CRIT_MAX;
}

// ─── INT7: THE ARMS SIGNED (bible/06-Systems/Integrity-Arc.md, lane 2) ───

/** A weapon's REACH: its top (SIEGE_WEAPON_MAX, the Thunderlock's span) plus its material's modifier (Iron's -1 to
 *  Daedric's 6) - the one number both referees' caps grow with (arenaLaw.js arenaBlowCap's table is this one, pinned
 *  equal). Null for a template neither names. */
export function armsTop(w, m) {
  const top = w === SIEGE_THUNDERLOCK.template ? SIEGE_THUNDERLOCK.max : SIEGE_WEAPON_MAX[/** @type {any} */ (w)];
  if (!top) return null;
  return top + (Number.isInteger(m) && m >= 0 && m < SIEGE_MATERIAL_MOD.length ? SIEGE_MATERIAL_MOD[m] : 0);
}
/** The most reach a weapon has: a Daedric Thunderlock's (26 + 6) - net/identityToken.js ARMS_TOP_MAX, pinned equal. */
export const ARMS_TOP_MAX = SIEGE_THUNDERLOCK.max + SIEGE_MATERIAL_MOD[SIEGE_MATERIAL_MOD.length - 1];
/** A signed arms claim's shape (identityToken.js `wa`): `[reach, bow]` - the reach a whole number 0..ARMS_TOP_MAX (0: no
 *  weapon), the bow 0 or 1. */
export const armsOk = (wa) => Array.isArray(wa) && wa.length === 2 && Number.isInteger(wa[0]) && wa[0] >= 0 && wa[0] <= ARMS_TOP_MAX && (wa[1] === 0 || wa[1] === 1);
/**
 * A CHARACTER'S ARMS, off its pack (`items` - the save's own list: every weapon it can take in hand without a trip
 * elsewhere, worn or carried): `[reach, bow]` - the most reach any LAWFUL weapon there has (armsTop; 0 for none), and 1
 * where a lawful bow is among them (siegeIsBow - a shaft is a bow's). `lawful(item)` is the item law's word on one piece
 * (server-account/src/judge.js - a piece the law refuses arms nobody). DECIDED: the pack, never the one in hand - a
 * fighter swaps weapons mid-fight, and the signature is minted once a room; the cap is the honest most of what it
 * carries, never what one swing claimed.
 * @param {unknown} items @param {(it: any) => boolean} lawful
 * @returns {[number, 0|1]}
 */
export function armsOf(items, lawful) {
  let reach = 0, bow = /** @type {0|1} */ (0);
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== 'object' || it.group !== 'Weapons') continue;
    const r = armsTop(it.templateIndex, it.material ?? 0);
    if (r == null || !lawful(it)) continue;
    reach = Math.max(reach, Math.max(0, r));
    if (siegeIsBow(it.templateIndex)) bow = 1;
  }
  return [reach, bow];
}
/** Whether a template is a bow (its blow a shaft's). */
export const siegeIsBow = (w) => w === SIEGE_WEAPONS.Short_Bow || w === SIEGE_WEAPONS.Long_Bow || w === SIEGE_THUNDERLOCK.template;
/** AUDIT-SEATS R8: THE HANDS - the look's two slots a weapon is wielded from (DFU's EquipSlots RightHand 19 and LeftHand
 *  21: characters/paperdoll.js EQUIP_SLOTS, pinned equal - this leaf imports nothing; net/remotePlayers.js composeLook
 *  writes each item's `equipSlot` off the equip table's own index). */
export const SIEGE_HAND_SLOTS = Object.freeze([19, 21]);
/**
 * THE WEAPON A STRIKER HOLDS, off its look (net/wire.js validLook's items): the claimed template and material where a
 * `Weapons` item of the look carries them IN A HAND, else null - hand-to-hand (`w` -1) is always held. AUDIT-SEATS R8: in
 * a hand - any Weapons item anywhere in the look was taken as held, so a Daedric Dai-Katana in an amulet's slot (a look
 * the wire admits: validLookItem bounds the slot, never its kind) struck as one.
 */
export function siegeHeld(look, w, m) {
  if (w === -1 || w == null) return { w: -1, m: 0 };
  const it = (look?.items ?? []).find((i) => i?.group === 'Weapons' && SIEGE_HAND_SLOTS.includes(i.equipSlot) && i.templateIndex === w && (i.material ?? 0) === m);
  return it ? { w, m } : null;
}

// ─── THE REFEREE ─────────────────────────────────────────────────────

/** A fighter's state as the room keeps it. */
export const newFighter = (lv, now) => {
  const max = siegeVitality(lv);
  return { lv: Math.max(1, Math.min(SIEGE_VITALITY.levelMax, Math.trunc(Number(lv) || 1))), hp: max, max, down: false, upAt: 0, safeTo: 0, rate: SIEGE_BLOWS_HZ, rateAt: now, casts: [], heals: [], dealt: 0, clipped: 0 };
};
const metres = (a, b) => Math.hypot((a.x - b.x) / SIEGE_UNITS_PER_M, (a.y - b.y) / SIEGE_UNITS_PER_M, (a.z - b.z) / SIEGE_UNITS_PER_M);
/** The striker's rate bucket, refilled to `now` (one second deep) - true where a blow may be spent. */
function spend(f, now) {
  f.rate = Math.min(SIEGE_BLOWS_HZ, f.rate + ((now - f.rateAt) / 1000) * SIEGE_BLOWS_HZ);
  f.rateAt = now;
  if (f.rate < 1) return false;
  f.rate -= 1;
  return true;
}

/**
 * A BLOW JUDGED (6.1) - `by` and `to` the two fighters' states, `from` and `at` their last poses (null: unknown), `held`
 * the weapon the striker's look carries (siegeHeld - null: none matching the claim), `d` the damage claimed, `r` its kind
 * (SIEGE_HIT). Answers `{ ok, dealt, fell, why }` and moves the states: the striker's bucket spent first (as the gate's),
 * the target's vitality down by the clipped damage, a fall at none left. INT7: `wa` the striker's SIGNED arms (the
 * token's, armsOk - null: a token from before them): the clip never past their reach, and a shaft only where they hold
 * a bow.
 * @param {any} by @param {any} to
 * @param {{ from?: any, at?: any, held?: any, d?: number, r?: number, wa?: any }} o
 * @param {number} now
 */
export function refereeBlow(by, to, { from = null, at = null, held = null, d = 0, r = SIEGE_HIT.Melee, wa = null } = {}, now) {
  if (!by || !to || by === to) return { ok: false, dealt: 0, fell: false, why: 'no-fighter' };
  if (by.down || to.down) return { ok: false, dealt: 0, fell: false, why: 'down' };
  if (!spend(by, now)) return { ok: false, dealt: 0, fell: false, why: 'rate' };
  if (now < to.safeTo) return { ok: false, dealt: 0, fell: false, why: 'protected' };
  if (!held) return { ok: false, dealt: 0, fell: false, why: 'weapon' };
  if (!from || !at) return { ok: false, dealt: 0, fell: false, why: 'reach' };
  const shaft = r === SIEGE_HIT.Shaft;
  if (shaft !== siegeIsBow(held.w) || (shaft && armsOk(wa) && wa[1] !== 1)) return { ok: false, dealt: 0, fell: false, why: 'weapon' };   // INT7: a shaft a signed bow's
  const reach = (shaft ? SIEGE_REACH.shaft : SIEGE_REACH.melee) + SIEGE_REACH.slack;
  if (metres(from, at) > reach) return { ok: false, dealt: 0, fell: false, why: 'reach' };
  const want = Math.max(0, Math.trunc(Number(d) || 0));
  const got = Math.min(want, siegeBlowMax(held.w, held.m, wa), to.hp);
  by.clipped += want - got;
  by.dealt += got;
  to.hp -= got;
  const fell = to.hp <= 0;
  if (fell) to.down = true;
  return { ok: true, dealt: got, fell, why: null };
}

/**
 * A CAST JUDGED (6.1) - a damaging one (`heal` false) at most SIEGE_CASTS.max in a window, each to its damage's most; a
 * heal as many in a window of its own, to its own most, never past the target's whole. Reach a spell's. Answers
 * `{ ok, dealt, fell, why }`.
 * @param {any} by @param {any} to
 * @param {{ from?: any, at?: any, d?: number, heal?: boolean }} o
 * @param {number} now
 */
export function refereeCast(by, to, { from = null, at = null, d = 0, heal = false } = {}, now) {
  if (!by || !to) return { ok: false, dealt: 0, fell: false, why: 'no-fighter' };
  if (by.down || to.down) return { ok: false, dealt: 0, fell: false, why: 'down' };
  if (!from || !at || metres(from, at) > SIEGE_REACH.spell + SIEGE_REACH.slack) return { ok: false, dealt: 0, fell: false, why: 'reach' };
  const want = Math.max(0, Math.trunc(Number(d) || 0));
  if (heal) {
    by.heals = (by.heals ?? []).filter((t) => now - t < SIEGE_CASTS.windowMs);
    if (by.heals.length >= SIEGE_CASTS.max) return { ok: false, dealt: 0, fell: false, why: 'rate' };
    by.heals.push(now);
    const got = Math.min(want, SIEGE_CASTS.healMax, to.max - to.hp);
    to.hp += got;
    return { ok: true, dealt: -got, fell: false, why: null };
  }
  if (by === to) return { ok: false, dealt: 0, fell: false, why: 'no-fighter' };
  by.casts = by.casts.filter((t) => now - t < SIEGE_CASTS.windowMs);
  if (by.casts.length >= SIEGE_CASTS.max) return { ok: false, dealt: 0, fell: false, why: 'rate' };
  by.casts.push(now);
  if (now < to.safeTo) return { ok: false, dealt: 0, fell: false, why: 'protected' };
  const got = Math.min(want, SIEGE_CASTS.damageMax, to.hp);
  by.clipped += want - got;
  by.dealt += got;
  to.hp -= got;
  const fell = to.hp <= 0;
  if (fell) to.down = true;
  return { ok: true, dealt: got, fell, why: null };
}

/** AUDIT-SEATS R2: the longest a step's allowance runs - a second's run and the slack, however long the silence before. */
export const SIEGE_STEP_WINDOW_MS = 1000;
/**
 * A STEP JUDGED (6.1): `next` a pose `dtMs` after `last` (both in the room's units) - kept when it moved no faster than
 * SIEGE_SPEED and its slack, else refused (the relay pulls the fighter back to `last`). A first pose is always kept.
 *
 * AUDIT-SEATS R1: THE RISE IS JUDGED - a step's length is its run across the ground and its climb together
 * (+y is up: player/motor.js's gravity takes `pos[1]` down); a fall is still gravity's, never refused (it outruns any
 * run). PVP-REF judged the ground alone (its DECIDED: "a climb buys no reach") - and a climb bought everything: a
 * fighter rose 2,000 m in 50 ms to stand over a banner where no blow reached it, contesting it for ever.
 *
 * AUDIT-SEATS R2: AND THE ALLOWANCE IS CARRIED on the fighter `f` (`f.stepM`, metres): refilled at SIEGE_SPEED.mps, up
 * to SIEGE_STEP_WINDOW_MS's run and the slack ONCE, each kept step spending its length; a refused step spends nothing
 * (the relay keeps `last` and its time, so the next step earns the whole gap again). PVP-REF gave every pose its own
 * slack and every gap its whole run - 180 poses 60 ms apart took a fighter 441 m in 300 ms, and ten silent seconds let
 * one pose land 180 m away. The window is generous to the honest: a burst after a stalled link spends the second's run
 * the stall earned, never more. Without `f` (the law alone) a step earns its own gap, held to the window, and the slack.
 */
export function refereeStep(last, next, dtMs, f = null) {
  const full = SIEGE_SPEED.mps * SIEGE_STEP_WINDOW_MS / 1000 + SIEGE_SPEED.slackM;
  if (!last) { if (f) f.stepM = full; return true; }
  const earned = SIEGE_SPEED.mps * Math.min(SIEGE_STEP_WINDOW_MS, Math.max(0, dtMs)) / 1000;
  const allowed = f ? Math.min(full, (Number.isFinite(f.stepM) ? f.stepM : full) + earned) : earned + SIEGE_SPEED.slackM;
  const rise = Math.max(0, (next.y - last.y) || 0);   // a pose with no height climbs nothing (the relay's are all finite - validPose)
  const len = Math.hypot((next.x - last.x) / SIEGE_UNITS_PER_M, (next.z - last.z) / SIEGE_UNITS_PER_M, rise / SIEGE_UNITS_PER_M);
  if (len > allowed) return false;
  if (f) f.stepM = allowed - len;
  return true;
}

/** The next wave after `now` (6.2): its boundary on the room's own clock - every `waveMs` from the epoch. */
export const siegeNextWave = (now, waveMs) => (Math.floor(now / waveMs) + 1) * waveMs;
/** A fallen fighter's rise at its wave: whole again, and SIEGE_PROTECT_MS no blow touches. Answers whether it rose. */
export function siegeRise(f, now) {
  if (!f.down || now < f.upAt) return false;
  f.down = false; f.hp = f.max; f.safeTo = now + SIEGE_PROTECT_MS; f.casts = []; f.heals = [];
  return true;
}

// ═════════════════════════════════════════════════════════════════════
// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and
// do sieges"; "Continue") - THE BATTLEFIELD (Seats-Arc 6.2, 6.5, 6.7, 6.8):
// the banners and the Throne, the clock, the no-shows, the result and who
// earned Honours. Pure, as the referee above: every `now` an argument.
// ═════════════════════════════════════════════════════════════════════

/** A BANNER (6.2): stand within 8 m with no living enemy there - 20 seconds raises it; a contested point freezes; an
 *  abandoned half-raised banner falls back at 1 second a second. */
export const SIEGE_BANNER = Object.freeze({ radiusM: 8, raiseS: 20, decayPerS: 1 });
/** THE THRONE (6.2): open to the attackers while they hold 2 of a palace's 3 banners (3 of a crown's 4 - DECIDED: until
 *  SEAT2b raises the Gatehouse, the banners alone open a crown's Throne); held uncontested 120 seconds at a palace, 180
 *  at a crown, takes the seat; its progress decays 1 second a second while it is not held. */
export const SIEGE_THRONE = Object.freeze({ palace: Object.freeze({ banners: 2, holdS: 120 }), crown: Object.freeze({ banners: 3, holdS: 180 }), decayPerS: 1 });
/** How long a battle runs, ms (6.2, 6.7 - net/townSeatLaw.js BATTLE_LENGTH_MS, pinned equal: the relay bundles this leaf).
 *  SEAT2b part two (c) (7.7: "inside the window's two hours"): a revolt its whole window (SIEGE_REVOLT.windowMs). */
export const SIEGE_LENGTH_MS = Object.freeze({ palace: 30 * 60_000, crown: 45 * 60_000, tourney: 20 * 60_000, revolt: 2 * 3600 * 1000 });
/** No attacker in the room 10 minutes after the start: a forfeit (6.5). */
export const SIEGE_FORFEIT_MS = 10 * 60_000;
/** Spectators a siege's room admits (6.6). */
export const SIEGE_SPECTATORS_MAX = 60;
/** The battle's beat on the room's alarm, ms. */
export const SIEGE_TICK_MS = 1000;
/** A battlefield's banner points, in order: a palace's three, a crown's four (6.2). */
export const SIEGE_BANNER_NAMES = Object.freeze(['Gate', 'Market', 'Temple', 'Palace']);
export const siegeBannerCount = (tier) => (tier === 'crown' ? 4 : 3);
/** A battle's sides, and a spectator's word on a pass. */
export const SIEGE_SIDES = Object.freeze(['attack', 'defend']);

/** THE FIELD a pass carries (net/identityToken.js's `siege` order `sf`): the banners' points, the Throne's, the two
 *  camps' - each `[x, z]` in the room's units. `{ banners, throne, camps: { attack, defend } }`, or null. */
export function fieldOf(sf, tier, kind = 'siege') {
  if (kind === 'royal') return royalFieldOf(sf);   // CROWN1 part two: a Royal Tourney's field is its ring
  const n = siegeBannerCount(tier);
  if (!Array.isArray(sf) || sf.length !== n + 3) return null;
  if (!sf.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9))) return null;
  return { banners: sf.slice(0, n).map((p) => [p[0], p[1]]), throne: [sf[n][0], sf[n][1]], camps: { attack: [sf[n + 1][0], sf[n + 1][1]], defend: [sf[n + 2][0], sf[n + 2][1]] } };
}

/** A NEW BATTLE: a siege's banners start the holder's (`defend`), a Tourney's no one's. CROWN1 part two: a Royal
 *  Tourney's ladder, open from `startMs` to `endMs` (its pass's week). SEAT2b part two (b): a siege's `works` (worksOf -
 *  the pass's `sx`; none given, none but a crown's own Gatehouse) - the Gatehouse standing whole at the Throne and the
 *  first of the camp's Rams fielded before it. SEAT2b part two (c): a siege's Barracks' guards at their posts
 *  (siegeGuards); a REVOLT (7.7) its whole window long, no banner and no Throne in it - its Captain and his rebels at the
 *  palace door (revoltRising). */
export function newBattle({ kind, tier, startMs, field, endMs = 0, works = null }) {
  if (kind === 'royal') return newRoyal({ startMs, endMs, field });
  const length = kind === 'tourney' ? SIEGE_LENGTH_MS.tourney : kind === 'revolt' ? SIEGE_LENGTH_MS.revolt : (SIEGE_LENGTH_MS[tier] ?? SIEGE_LENGTH_MS.palace);
  const w = kind === 'siege' ? (works ?? worksOf(undefined, tier)) : null;
  const gate = w && w.gate >= 0 ? siegeGateVitality(w.gate) : 0;
  return {
    kind, tier, startMs, endMs: startMs + length, field,
    banners: kind === 'revolt' ? [] : field.banners.map(() => ({ side: kind === 'tourney' ? null : 'defend', raise: 0, by: null })),
    throne: 0, raised: false, attackSeen: false, defendSeen: false, at: startMs, result: null,
    reached: false,   // AUDIT-SEATS T1: whether the attackers ever stood alone at the open Throne (battleStep)
    // SEAT2b part two (b): the works - the Gatehouse (null: none), its breach, the Ram fielded and those still in the camp
    works: w, gate: gate ? { hp: gate, max: gate } : null, breached: false, ground: null,
    ram: gate && w.rams > 0 ? newRam(w) : null, ramsLeft: gate ? Math.max(0, w.rams - 1) : 0, ramAt: null,
    // SEAT2b part two (c): the relay's own fighters - the Barracks' guards, or a revolt's rising
    npcs: kind === 'revolt' ? revoltRising(field) : w ? siegeGuards(field, w.barracks) : [],
  };
}
const flat = (p, q) => Math.hypot((p.x - q[0]) / SIEGE_UNITS_PER_M, (p.z - q[1]) / SIEGE_UNITS_PER_M);
/** AUDIT-SEATS R1: how far above or below THE FIELD'S GROUND a fighter may stand and still stand at a point, metres - the
 *  banner's own 8 m, so a point is a sphere about its ground, never a column to the sky. */
export const SIEGE_HEIGHT_M = 8;
/**
 * AUDIT-SEATS R1: THE FIELD'S GROUND - the middle height (the median; two middles, their mean) of the sided fighters
 * standing in the room (`fighters` as battleStep takes them), in the room's units, or null with none.
 *
 * DECIDED here: the pass's points are `[x, z]` alone (net/identityToken.js's field - the service signs no height, and
 * the relay holds no ground), and presence was judged flat - a fighter 2,000 m over a banner stood at it, contesting it
 * for ever where no blow reached (a lone floater took two banners and the Throne). A seat town's ground is level (DFU
 * flattens a location's terrain - the camps and points all stand in or at its edge), and the fighters standing on it are
 * the room's honest many, so their middle height is the ground: a floater or a sinker more than SIEGE_HEIGHT_M off it
 * stands at no point. Its limit, recorded: a whole side lying together moves the middle by half - then nobody stands at
 * any point, and a siege's banners keep the holder's (a Tourney's whoever held them). The cure is a height in the
 * field's points, the service's to sign (SEAT2b's to ask).
 */
export function siegeGround(fighters) {
  const ys = [];
  for (const f of fighters) if (!f.down && f.pose && f.here && (f.side === 'attack' || f.side === 'defend') && Number.isFinite(f.pose.y)) ys.push(f.pose.y);
  if (!ys.length) return null;
  ys.sort((p, q) => p - q);
  const h = ys.length >> 1;
  return ys.length % 2 ? ys[h] : (ys[h - 1] + ys[h]) / 2;
}
/** AUDIT SEATS-3 B1: how far `p` stands above or below the field's `ground` (both in the room's units), metres - 0 where
 *  either is unknown (no ground judges no height). */
export const siegeOffGround = (ground, p) => (ground == null || !Number.isFinite(ground) || !Number.isFinite(p?.y) ? 0 : Math.abs(p.y - ground) / SIEGE_UNITS_PER_M);
/** AUDIT SEATS-3 B1: THE GROUND A FIGHTER (`sub`) IS HELD TO in battle `b`, in the room's units, or null for none - a
 *  siege's the field's (`b.ground`, siegeGround's at the last beat); a Royal Tourney's the bout's (`bout.y`, its marks'
 *  height - royalMarks) for the bout's two alone, a contender outside a bout held to none (it strikes nobody). */
export function siegeGroundOf(b, sub) {
  if (!b) return null;
  if (b.kind === 'royal') return b.bout && (b.bout.a === sub || b.bout.b === sub) && Number.isFinite(b.bout.y) ? b.bout.y : null;
  return Number.isFinite(b.ground) ? b.ground : null;
}
/**
 * AUDIT SEATS-3 B1: A STEP'S HEIGHT JUDGED - `next` kept within SIEGE_HEIGHT_M of the field's `ground`, or nearer it than
 * `last` (a fighter the ground left behind walks back to it, never further off); a first pose, or no ground, is kept.
 * refereeStep prices a climb as a run and a fall as nothing, and the ground was judged at a point alone - so a defender
 * climbed 45 m over the Rebel Captain, where no rebel's blow reached and every one of its own shafts did, a Tourney's
 * contender rose 30 m out of its rival's reach, and a fighter sunk 100 m under the field stood where nothing struck it.
 */
export const siegeStepLevel = (ground, last, next) => {
  const off = siegeOffGround(ground, next);
  return off <= SIEGE_HEIGHT_M || !last || off < siegeOffGround(ground, last);
};
/** The standing fighters of each side within a point's radius - AUDIT-SEATS R1: and within SIEGE_HEIGHT_M of the field's
 *  `ground` (siegeGround; null judges no height). */
function presentAt(fighters, point, ground = null) {
  let attack = 0, defend = 0;
  for (const f of fighters) {
    if (f.down || !f.pose || !f.here) continue;
    if (flat(f.pose, point) > SIEGE_BANNER.radiusM) continue;
    if (ground != null && Math.abs(f.pose.y - ground) / SIEGE_UNITS_PER_M > SIEGE_HEIGHT_M) continue;   // AUDIT-SEATS R1: above or below the field
    if (f.side === 'attack') attack++; else if (f.side === 'defend') defend++;
  }
  return { attack, defend };
}

// ═════════════════════════════════════════════════════════════════════
// SEAT2b part two (b) (2026-10-01, Mac: "Finish the seats"; "Let's pick up
// 482") - THE WORKS IN BATTLE (Seats-Arc 6.2, 7.5): the Walls' faster
// wave, the Gatehouse that bars the Throne, the Rams that batter it. The
// numbers are net/fortLaw.js's (GATEHOUSE, RAM, WALLS_WAVE_*), COPIED here
// and pinned EQUAL by test: this leaf imports nothing. The pass carries the
// works the service froze at the battle's first pass (`sx`); the Barracks'
// tier rides beside them for the guards (part two (c)).
// ═════════════════════════════════════════════════════════════════════

/** THE GATEHOUSE (6.2): vitality 20,000, +50% a tier (7.5); a fighter's blow deals a tenth of its damage to it.
 *  DECIDED here: it stands at the Throne's point - 6.2's crown Gatehouse "at the castle's entrance", its Throne "the
 *  castle entrance"; a palace's own gate at its palace door, which is its Throne - a body `sizeM` about the point (a
 *  blow's reach is measured to its edge). */
export const SIEGE_GATEHOUSE = Object.freeze({ vitality: 20000, perTier: 0.5, blowShare: 0.1, sizeM: 3 });
/** A RAM (6.2): vitality 3,000 (+50% with a Siegewright on the attacking roster - Professions-Arc 3.3), 500 to the
 *  Gatehouse every 10 seconds while two attackers stand within 3 m of it; one fielded at a time, a destroyed Ram gone.
 *  DECIDED here: a Ram stands at the Gatehouse (brought to the gate - nobody wheels it across the town), a body
 *  `sizeM` about the point; its strokes are crewed time, as a banner's raise is - ten crewed seconds a stroke, the
 *  charge falling back a second a second while it stands uncrewed; the camp's next Ram is fielded at the attackers'
 *  next wave after one is destroyed. */
export const SIEGE_RAM = Object.freeze({ vitality: 3000, damage: 500, everyMs: 10000, crew: 2, crewM: 3, siegewright: 0.5, sizeM: 2 });
/** THE WALLS (7.5): the defenders' wave 3 s faster a tier, never under 5 s. */
export const SIEGE_WALLS = Object.freeze({ stepMs: 3000, minMs: 5000 });
/** A work's tier at most (7.5: three). */
export const SIEGE_WORK_TIER_MAX = 3;
/** The most Rams a pass carries - a camp's kits are a week of its writs. */
export const SIEGE_RAMS_MAX = 999;
/** The works a blow may name as its target (net/wire.js validSiegeIn): the Gatehouse and the Ram - two letters, never a
 *  peer's id (four at least). */
export const SIEGE_WORK_IDS = Object.freeze({ gate: 'gh', ram: 'rm' });

const tierOk = (t) => Number.isSafeInteger(t) && t >= 0 && t <= SIEGE_WORK_TIER_MAX;
/**
 * THE WORKS A PASS CARRIES (net/identityToken.js's `sx`): `[walls, gatehouse, rams, siegewright, barracks]` - each a
 * tier (the Gatehouse's -1 where the seat has none), the Rams its challenger's camp sent (net/fortLaw.js campSpent),
 * whether a Siegewright stands on the attacking roster (0 or 1). Answers `{ walls, gate, rams, siegewright, barracks }`,
 * or null for a bad one. A siege's alone: a Tourney (no holder to defend) and a Royal Tourney carry none. Absent - a pass
 * of a battle whose works were never frozen - no works, but a crown's own Gatehouse at tier 0 (6.2: a crown's stands
 * from the first; a palace's is raised).
 */
export function worksOf(sx, tier, kind = 'siege') {
  if (kind !== 'siege') return sx == null ? { walls: 0, gate: -1, rams: 0, siegewright: 0, barracks: 0 } : null;
  if (sx == null) return { walls: 0, gate: tier === 'crown' ? 0 : -1, rams: 0, siegewright: 0, barracks: 0 };
  if (!Array.isArray(sx) || sx.length !== 5) return null;
  const [walls, gate, rams, sw, barracks] = sx;
  if (!tierOk(walls) || !(gate === -1 || tierOk(gate)) || !Number.isSafeInteger(rams) || rams < 0 || rams > SIEGE_RAMS_MAX || (sw !== 0 && sw !== 1) || !tierOk(barracks)) return null;
  if (tier === 'crown' && gate < 0) return null;   // a crown's Gatehouse always stands
  if (gate < 0 && rams > 0) return null;   // a Ram strikes a Gatehouse or nothing (campSpent sends none to a seat without)
  return { walls, gate, rams, siegewright: sw, barracks };
}
/** The Gatehouse's vitality at tier `t` (7.5: +50% a tier). */
export const siegeGateVitality = (t) => Math.round(SIEGE_GATEHOUSE.vitality * (1 + SIEGE_GATEHOUSE.perTier * Math.max(0, Math.min(SIEGE_WORK_TIER_MAX, Number(t) || 0))));
/** A Ram's vitality - a Siegewright's +50%. */
export const siegeRamVitality = (siegewright) => Math.round(SIEGE_RAM.vitality * (siegewright ? 1 + SIEGE_RAM.siegewright : 1));
/** A Ram fielded whole, its charge empty. */
function newRam(works) {
  const max = siegeRamVitality(works?.siegewright);
  return { hp: max, max, charge: 0 };
}
/** THE WAVE A SIDE RISES ON (6.2; 7.5's Walls): the tier's - a defender's 3 s faster a tier of Walls, never under 5 s. */
export function siegeWaveMs(b, side) {
  const base = SIEGE_WAVE_MS[b?.tier] ?? SIEGE_WAVE_MS.palace;
  if (side !== 'defend') return base;
  return Math.max(SIEGE_WALLS.minMs, base - SIEGE_WALLS.stepMs * Math.max(0, Math.min(SIEGE_WORK_TIER_MAX, Number(b?.works?.walls) || 0)));
}
/** Whether a siege's Throne is barred - a Gatehouse stands and is not breached (6.2: "opens while the attackers hold 3
 *  of 4 banners AND the Gatehouse is breached"; a palace with a gate of its own the same). */
export const siegeThroneBarred = (b) => !!b?.gate && !b.breached;
/**
 * A BLOW ON A WORK JUDGED (6.2): `by` the striker, `work` the Gatehouse's or a Ram's state (`{ hp, max }`), `point` its
 * `[x, z]` in the room's units and `size` its body's metres about it, `from` the striker's last pose, `ground` the
 * field's ground (siegeGround - null judges no height), `held` the weapon its look carries (siegeHeld), `d` the damage
 * claimed, `share` the part the work takes (the Gatehouse a tenth, a Ram the whole). The striker's bucket spent first, as
 * a blow on a fighter; a melee blow alone (DECIDED: a gate is battered and a Ram hacked at close quarters - a shaft does
 * neither, and a spell's harm is a fighter's), within the weapon's reach of the work's edge, standing on the field's
 * ground; the damage clipped to the weapon's bucket, the work's share of it at least 1. Answers `{ ok, dealt, broke, why }`
 * with the work's vitality moved - `broke` at none left. INT7: `wa` the striker's signed arms, the clip held to them as a
 * blow on a fighter's is (siegeBlowMax).
 * @param {any} by @param {any} work
 * @param {{ point?: any, size?: number, from?: any, ground?: number|null, held?: any, d?: number, r?: number, share?: number, wa?: any }} o
 * @param {number} now
 */
export function refereeWorkBlow(by, work, { point = null, size = 0, from = null, ground = null, held = null, d = 0, r = SIEGE_HIT.Melee, share = 1, wa = null } = {}, now) {
  if (!by || !work || !point) return { ok: false, dealt: 0, broke: false, why: 'no-work' };
  if (by.down || work.hp <= 0) return { ok: false, dealt: 0, broke: false, why: 'down' };
  if (!spend(by, now)) return { ok: false, dealt: 0, broke: false, why: 'rate' };
  if (!held || r !== SIEGE_HIT.Melee || siegeIsBow(held.w)) return { ok: false, dealt: 0, broke: false, why: 'weapon' };
  if (!from || flat(from, point) > SIEGE_REACH.melee + SIEGE_REACH.slack + size) return { ok: false, dealt: 0, broke: false, why: 'reach' };
  if (ground != null && Math.abs(from.y - ground) / SIEGE_UNITS_PER_M > SIEGE_HEIGHT_M) return { ok: false, dealt: 0, broke: false, why: 'reach' };
  const want = Math.max(0, Math.trunc(Number(d) || 0));
  const got = Math.min(want, siegeBlowMax(held.w, held.m, wa));
  if (got <= 0) return { ok: false, dealt: 0, broke: false, why: 'nothing' };
  by.clipped += want - got;
  by.dealt += got;
  const dealt = Math.min(work.hp, Math.max(1, Math.round(got * share)));
  work.hp -= dealt;
  return { ok: true, dealt, broke: work.hp <= 0, why: null };
}
/** THE RAM'S CREW (6.2): the attackers standing within SIEGE_RAM.crewM of the Gatehouse's point (the Ram's), on the
 *  field's ground - presentAt's law at the Ram's own radius. */
function crewAt(fighters, point, ground) {
  let n = 0;
  for (const f of fighters) {
    if (f.down || !f.pose || !f.here || f.side !== 'attack') continue;
    if (flat(f.pose, point) > SIEGE_RAM.crewM) continue;
    if (ground != null && Math.abs(f.pose.y - ground) / SIEGE_UNITS_PER_M > SIEGE_HEIGHT_M) continue;
    n++;
  }
  return n;
}
/**
 * THE WORKS' BEAT (inside battleStep, a siege joined): the Ram fielded at the Gatehouse batters it - SIEGE_RAM.everyMs
 * of crewed time a stroke of SIEGE_RAM.damage, its charge falling back a second a second uncrewed; the Gatehouse breached
 * at none left (the Throne unbarred); the camp's next Ram fielded at its wave after one was destroyed (`ramAt`, the
 * relay's). Events: `{ k: 'gate', hp }` a stroke landed, `{ k: 'breach' }`, `{ k: 'ram' }` a Ram fielded.
 */
function worksStep(b, fighters, nowMs, dt, ground, out) {
  if (!b.gate || b.breached) return;
  if (!b.ram && b.ramsLeft > 0 && b.ramAt != null && nowMs >= b.ramAt) {
    b.ram = newRam(b.works); b.ramsLeft--; b.ramAt = null;
    out.push({ k: 'ram' });
  }
  if (!b.ram) return;
  const every = SIEGE_RAM.everyMs / 1000;
  if (crewAt(fighters, b.field.throne, ground) >= SIEGE_RAM.crew) {
    b.ram.charge += dt;
    while (b.ram.charge >= every && !b.breached) {
      b.ram.charge -= every;
      b.gate.hp = Math.max(0, b.gate.hp - SIEGE_RAM.damage);
      out.push({ k: 'gate', hp: b.gate.hp });
      if (b.gate.hp <= 0) { b.breached = true; out.push({ k: 'breach' }); }
    }
  } else b.ram.charge = Math.max(0, b.ram.charge - dt);
}
/** A Ram destroyed by the defenders' blows (6.2: "a destroyed Ram is gone"): the camp's next fielded at the attackers'
 *  next wave, none left none. */
export function siegeRamDown(b, nowMs) {
  b.ram = null;
  b.ramAt = b.ramsLeft > 0 ? siegeNextWave(nowMs, siegeWaveMs(b, 'attack')) : null;
}
/** The Gatehouse breached by a blow (worksStep's own breach is a stroke's). */
export function siegeBreach(b) {
  if (b.gate) b.gate.hp = 0;
  b.breached = true;
}

// ═════════════════════════════════════════════════════════════════════
// SEAT2b part two (c) (2026-10-01, Mac: "Finish the seats"; "Let's pick up
// 482") - THE RELAY'S OWN FIGHTERS (Seats-Arc 6.1, 7.5, 7.7): the
// Barracks' town guards fighting for the holder (2, 4, 6 a tier) and a
// revolt's Rebel Captain and his 12 rebels at the palace door - "the gate's
// brain with adds" (World-Bosses.md 17: a body the relay owns, walking at
// its mark and winding up a blow the mark may step out of). The Barracks'
// and the revolt's numbers are net/fortLaw.js's (barracksGuards, REVOLT),
// COPIED here and pinned EQUAL by test: this leaf imports nothing. Each is
// a body the referee judges as it judges a fighter - a blow on it clipped
// to the weapon's bucket, a cast to its cap - and its own blow is the
// relay's, landing on the room's held vitality: a siege never touches the
// save's health. Pure, as above.
// ═════════════════════════════════════════════════════════════════════

/**
 * THE RELAY'S FIGHTERS, by kind: `code` its number on the wire, `side` the side it fights on, `lv` the Renown its vitality
 * is a fighter's of (6.1's 300 + 2 x Renown; 7.7's Captain "as a siege fighter of Renown 50"), its pace (`speed` m/s - a
 * player runs 7.6, so every one of them is outrun), its blow - begun on a mark within `strikeM`, wound up `windupMs` (one
 * beat: the mark may step away), landing for `damage` where the mark still stands within `landM`, the next begun no
 * sooner than `everyMs` after - and its ground: it marks a foe within `aggroM` of itself and follows none past `leashM`
 * from its post.
 * DECIDED here (the bible names the Captain's vitality alone): a guard a fighter of Renown 30 striking 20 a blow, a rebel
 * of Renown 20 striking 14, the Captain 28 - a lone fighter outlasts one guard half a minute, and twelve rebels fell it in
 * five seconds, so a revolt is put down by a party (or by patience: a felled rebel never rises).
 */
export const SIEGE_NPC = Object.freeze({
  guard: Object.freeze({ code: 1, side: 'defend', lv: 30, speed: 5, strikeM: 2, landM: 3.5, windupMs: 1000, everyMs: 2000, damage: 20, aggroM: 12, leashM: 24 }),
  rebel: Object.freeze({ code: 2, side: 'attack', lv: 20, speed: 4.5, strikeM: 2, landM: 3.5, windupMs: 1000, everyMs: 2000, damage: 14, aggroM: 16, leashM: 30 }),
  captain: Object.freeze({ code: 3, side: 'attack', lv: 50, speed: 4, strikeM: 2, landM: 3.5, windupMs: 1000, everyMs: 2000, damage: 28, aggroM: 16, leashM: 30 }),
});
/** The kinds by their wire code (0 none). */
export const SIEGE_NPC_KINDS = Object.freeze(['', 'guard', 'rebel', 'captain']);
/** The Barracks' guards by tier (7.5: "2, 4, 6" - net/fortLaw.js barracksGuards, pinned equal). */
export const SIEGE_BARRACKS_GUARDS = Object.freeze([0, 2, 4, 6]);
/** THE REVOLT (7.7 - net/fortLaw.js REVOLT, pinned equal): the Captain's Renown, his rebels, the window's two hours;
 *  DECIDED here: the rebels stand on a ring `ringM` about the palace door, the Captain at it. */
export const SIEGE_REVOLT = Object.freeze({ captainRenown: 50, rebels: 12, windowMs: 2 * 3600 * 1000, ringM: 4 });
/** The most of them a room holds - a revolt's Captain and his twelve (6.1: "a revolt's 13 rebels stand in the guards'
 *  place"; the Barracks' six fewer). */
export const SIEGE_NPC_MAX = 1 + SIEGE_REVOLT.rebels;
/** Their ids on the wire: `n` and a number under SIEGE_NPC_MAX - never a peer's id (four characters at least) nor a
 *  work's (SIEGE_WORK_IDS). */
export const isSiegeNpcId = (id) => typeof id === 'string' && /^n(?:0|[1-9]\d?)$/.test(id) && Number(id.slice(1)) < SIEGE_NPC_MAX;
/** How long one keeps its mark before it looks for the nearest again, ms (the gate host's HOST_RETARGET_MS). */
export const SIEGE_NPC_RETARGET_MS = 3000;
/** A walk at a mark stops this short of it - inside the blow's strike. */
export const SIEGE_NPC_STOP_M = 1.5;

const metresFlat = (ax, az, bx, bz) => Math.hypot((ax - bx) / SIEGE_UNITS_PER_M, (az - bz) / SIEGE_UNITS_PER_M);
/** One of them made whole at its post: its id (`n<i>`), kind, post and walk (`[x, z]` where it stood at `at`, walking
 *  to `[tx, tz]`, room units), its vitality as a fighter's of its Renown, its blow in flight (`atk` `{ at, to }` - when it
 *  lands and on whom), when it may begin the next, its mark and since when. */
function newNpc(i, kind, post) {
  const K = SIEGE_NPC[kind], max = siegeVitality(K.lv);
  return { id: `n${i}`, kind, post: [post[0], post[1]], x: post[0], z: post[1], tx: post[0], tz: post[1], at: 0, lv: K.lv, hp: max, max,
    down: false, upAt: 0, safeTo: 0, atk: null, next: 0, tg: null, tgAt: 0 };
}
/**
 * THE BARRACKS' GUARDS (7.5: "relay-run town guards fight for the holder: 2, 4, 6") - each at a post: the Throne first
 * (the holder's last ground), then the banners from the palace's end back to the Gate, round again where there are more
 * guards than points. DECIDED here: a guard counts where it stands as a defender does (a banner or the Throne it stands
 * at is contested, never raised past it); it marks the nearest attacker within its reach, follows it no farther than its
 * leash from its post, and walks home with none; felled, it rises with the defenders' wave AT THEIR CAMP (6.2: where
 * every fallen defender rises) and walks back to its post.
 */
export function siegeGuards(field, barracks) {
  const n = SIEGE_BARRACKS_GUARDS[Math.max(0, Math.min(SIEGE_WORK_TIER_MAX, Math.trunc(Number(barracks) || 0)))];
  const posts = [field.throne, ...[...field.banners].reverse()];
  const out = [];
  for (let i = 0; i < n; i++) out.push(newNpc(i, 'guard', posts[i % posts.length]));
  return out;
}
/**
 * THE RISING (7.7: "a Rebel Captain ... and 12 rebels at the palace door"): the Captain (`n0`) at the door - the field's
 * Throne point, 6.2's palace door - and his rebels (`n1`-`n12`) on a ring SIEGE_REVOLT.ringM about it, evenly, each its
 * own post. DECIDED here: they hold the door - each marks the nearest defender within its reach and follows it no farther
 * than its leash; a felled rebel never rises (the uprising thins), and the Captain's fall puts the revolt down.
 */
export function revoltRising(field) {
  const [cx, cz] = field.throne, r = SIEGE_REVOLT.ringM * SIEGE_UNITS_PER_M;
  const out = [newNpc(0, 'captain', [cx, cz])];
  for (let i = 0; i < SIEGE_REVOLT.rebels; i++) {
    const a = (i / SIEGE_REVOLT.rebels) * 2 * Math.PI;
    out.push(newNpc(i + 1, 'rebel', [Math.round(cx + Math.sin(a) * r), Math.round(cz + Math.cos(a) * r)]));
  }
  return out;
}
/** Where one of them stands at `now`, `[x, z]` in the room's units: its walk carried on from the beat that said it, at its
 *  kind's pace (every screen carries it so - the gate host's law, net/gateBrain.js hostAt). Pure. */
export function siegeNpcAt(n, now) {
  const len = Math.hypot(n.tx - n.x, n.tz - n.z);
  if (len < 1e-6) return [n.x, n.z];
  const along = Math.min(len, (Math.max(0, now - (n.at || now)) / 1000) * (SIEGE_NPC[n.kind]?.speed ?? 0) * SIEGE_UNITS_PER_M);
  return [n.x + ((n.tx - n.x) / len) * along, n.z + ((n.tz - n.z) / len) * along];
}
/** One of them as the referee measures a blow to it: a pose at `now` on the field's ground (`ground`; unknown, the
 *  striker's own height `y` - judged across the ground alone). */
export function siegeNpcPose(n, now, ground, y = 0) {
  const [x, z] = siegeNpcAt(n, now);
  return { x, y: ground ?? y, z };
}
/** One of them felled by a fighter's blow or cast at `now`: stopped where it stands, its blow dropped - a guard to rise
 *  with the defenders' next wave (the Walls' quicker), a rebel and the Captain for good. */
export function siegeNpcFell(b, n, now) {
  [n.x, n.z] = siegeNpcAt(n, now);
  n.tx = n.x; n.tz = n.z; n.at = now;
  n.hp = 0; n.down = true; n.atk = null; n.tg = null;
  n.upAt = n.kind === 'guard' ? siegeNextWave(now, siegeWaveMs(b, 'defend')) : 0;
}
/** AUDIT SEATS-2 R1: WHERE A BLOW ON ONE OF THEM MAY COME FROM - a striker standing within its leash of its post and a
 *  blow's reach beyond (`from` a pose in the room's units): ground it could come to and answer. A shaft or a spell from
 *  farther lands on none of them, so none is felled from where it can never strike back. */
export const siegeNpcInReach = (n, from, ground = null) => !!n && !!from && Array.isArray(n.post)
  && metresFlat(from.x, from.z, n.post[0], n.post[1]) <= (SIEGE_NPC[n.kind]?.leashM ?? 0) + (SIEGE_NPC[n.kind]?.landM ?? 0)
  && siegeOffGround(ground, from) <= SIEGE_HEIGHT_M;   // AUDIT SEATS-3 B1: and on the field's ground (`ground`, the room's units - null judges no height), as their own blow asks of its mark
/** AUDIT SEATS-2 R1: ONE OF THEM STRUCK MARKS ITS STRIKER (`sub`) at `now` - it comes for whoever struck it, the gate
 *  host's own answer to a blow. */
export function siegeNpcProvoked(n, sub, now) {
  if (!n || n.down || !sub) return;
  n.tg = sub; n.tgAt = now;
}
/** Whether `side`'s fighter may strike one of them - a foe of its own side's (SEAT2a's sides kept: a defender strikes no
 *  guard, an attacker no rebel). A heal reaches none (DECIDED: they are the relay's, never a side-mate's to mend). */
export const siegeNpcFoe = (n, side) => !!n && (side === 'attack' || side === 'defend') && SIEGE_NPC[n.kind]?.side !== side;
/** Whether a revolt is put down - its Captain fallen (or none). */
export const siegeRevoltDown = (b) => !(b.npcs ?? []).some((n) => n.kind === 'captain' && !n.down);
/**
 * THEIR BEAT (inside battleStep, the battle joined): a fallen guard risen where its wave has come (at the defenders' camp,
 * whole, SIEGE_PROTECT_MS no blow touches); each one standing carried along its walk to `nowMs`; its blow in flight
 * landed - on its mark where the mark still stands within its reach, on the field's ground and unprotected: the room's
 * held vitality down by its damage, a fall at none left (risen at its side's wave); then its mark kept, or the nearest
 * taken (a foe of its side's within its aggro and its leash of its post, on the field's ground); a blow begun on a mark
 * within its strike once its last is spent, else a walk at it SIEGE_NPC_STOP_M short (never past its leash), or home with
 * none. `fighters` battleStep's, each with its account (`sub`). Events: `{ k: 'nhit', n, to, h, m, fell }` a blow landed
 * on fighter `to` (its vitality after), `{ k: 'nup', n }` one risen.
 */
function npcStep(b, fighters, nowMs, ground, out) {
  const foeOf = (K, f) => !!f && !f.down && !!f.here && !!f.pose && (f.side === 'attack' || f.side === 'defend') && f.side !== K.side
    && (ground == null || Math.abs(f.pose.y - ground) / SIEGE_UNITS_PER_M <= SIEGE_HEIGHT_M);
  for (const n of b.npcs ?? []) {
    const K = SIEGE_NPC[n.kind];
    if (!K) continue;
    if (n.down) {
      if (n.kind === 'guard' && n.upAt && nowMs >= n.upAt) {
        const c = b.field.camps.defend;
        Object.assign(n, { x: c[0], z: c[1], tx: c[0], tz: c[1], at: nowMs, hp: n.max, down: false, upAt: 0, safeTo: nowMs + SIEGE_PROTECT_MS, atk: null, tg: null, tgAt: 0 });
        out.push({ k: 'nup', n: n.id });
      }
      continue;
    }
    [n.x, n.z] = siegeNpcAt(n, nowMs);
    n.at = nowMs;
    const fromMe = (f) => metresFlat(f.pose.x, f.pose.z, n.x, n.z), fromPost = (f) => metresFlat(f.pose.x, f.pose.z, n.post[0], n.post[1]);
    if (n.atk && nowMs >= n.atk.at) {
      const to = n.atk.to, f = fighters.find((x) => x.sub === to);
      n.atk = null;
      if (foeOf(K, f) && fromMe(f) <= K.landM && nowMs >= (f.safeTo ?? 0)) {
        f.hp -= Math.min(K.damage, f.hp);
        const fell = f.hp <= 0;
        if (fell) { f.down = true; f.upAt = siegeNextWave(nowMs, siegeWaveMs(b, f.side)); }
        out.push({ k: 'nhit', n: n.id, to, h: f.hp, m: f.max, fell });
      }
    }
    if (n.atk) { n.tx = n.x; n.tz = n.z; continue; }   // winding up: it stands
    const held = n.tg ? fighters.find((x) => x.sub === n.tg) ?? null : null;
    const holds = held && foeOf(K, held) && fromPost(held) <= K.leashM ? held : null;
    let mark = holds && nowMs - n.tgAt < SIEGE_NPC_RETARGET_MS ? holds : null;
    if (!mark) {
      for (const f of fighters) {
        if (!foeOf(K, f) || fromPost(f) > K.leashM || (f !== holds && fromMe(f) > K.aggroM)) continue;
        if (!mark || fromMe(f) < fromMe(mark)) mark = f;
      }
      if (mark?.sub !== n.tg) n.tg = mark?.sub ?? null;
      n.tgAt = nowMs;
    }
    if (mark && fromMe(mark) <= K.strikeM && nowMs >= n.next) {
      n.atk = { at: nowMs + K.windupMs, to: mark.sub };
      n.next = nowMs + K.everyMs;
      n.tx = n.x; n.tz = n.z;
      continue;
    }
    let gx = n.post[0], gz = n.post[1];
    if (mark) {
      const d = fromMe(mark), go = Math.max(0, d - SIEGE_NPC_STOP_M) / Math.max(d, 1e-6);
      gx = n.x + (mark.pose.x - n.x) * go; gz = n.z + (mark.pose.z - n.z) * go;
      const fp = metresFlat(gx, gz, n.post[0], n.post[1]);
      if (fp > K.leashM) { gx = n.post[0] + ((gx - n.post[0]) * K.leashM) / fp; gz = n.post[1] + ((gz - n.post[1]) * K.leashM) / fp; }
    }
    n.tx = Math.round(gx); n.tz = Math.round(gz);
  }
}
/** The standing ones as the points count them - a guard a defender where it stands, on the field's ground. */
function npcBodies(b, ground, nowMs) {
  const out = [];
  for (const n of b.npcs ?? []) {
    if (n.down || !SIEGE_NPC[n.kind]) continue;
    const [x, z] = siegeNpcAt(n, nowMs);
    out.push({ side: SIEGE_NPC[n.kind].side, pose: { x, y: ground ?? 0, z }, down: false, here: true });
  }
  return out;
}

/**
 * ONE BEAT OF THE BATTLE (6.2, 6.5): `fighters` every fighter's `{ side, pose, down, here }` (`here` its socket in the
 * room), the battle moved on to `nowMs`. Each banner raised by the side alone at it (twenty seconds; the other side's
 * half-raise begun again), frozen while both stand there, falling back a second a second when left; a siege's Throne,
 * open while the attackers hold enough banners, raised by attackers alone at it and falling back otherwise - held its
 * time, the seat is taken. The clock: at its end a siege is the holder's, a Tourney the side with more banners' (a dead
 * heat `tie` - the service reads the higher influence). No attacker in a siege's room by ten minutes past the start: a
 * forfeit (`absent` when no defender came either - the holder keeps it, nothing more; DECIDED: 6.5's no-shows are a
 * siege's - a Tourney's absent contender simply holds no banners at its end). Each fighter in the room is credited its
 * seconds there (`stood`, Honours' half). Answers the beat's events (`{ k: 'banner', i, side }`, `{ k: 'end', result }`);
 * the battle's `result` once ended.
 */
export function battleStep(b, fighters, nowMs) {
  if (b.result || nowMs < b.startMs) return [];
  const dt = Math.max(0, Math.min(nowMs - Math.max(b.at, b.startMs), 5 * SIEGE_TICK_MS)) / 1000;
  b.at = nowMs;
  const out = [];
  for (const f of fighters) {
    if (!f.here || (f.side !== 'attack' && f.side !== 'defend')) continue;
    f.stood = (f.stood ?? 0) + dt;   // Honours' half (6.8): its seconds in the room since the start
    if (f.side === 'attack') b.attackSeen = true; else b.defendSeen = true;
  }
  const ground = siegeGround(fighters);   // AUDIT-SEATS R1: the field's ground, this beat
  b.ground = ground;   // SEAT2b part two (b): kept for a blow on a work between beats (refereeWorkBlow)
  // SEAT2b part two (c): the relay's own fighters' beat - and a guard counted where it stands, as a defender is
  npcStep(b, fighters, nowMs, ground, out);
  const bodies = b.npcs?.length ? [...fighters, ...npcBodies(b, ground, nowMs)] : fighters;
  if (b.kind === 'revolt') {
    if (siegeRevoltDown(b)) return end(b, 'defend', out);   // 7.7: the Captain felled - the revolt put down
    return nowMs >= b.endMs ? end(b, 'attack', out) : out;   // its window out with him standing - the Charter lapses
  }
  b.banners.forEach((bn, i) => {
    const p = presentAt(bodies, b.field.banners[i], ground);
    const alone = p.attack && !p.defend ? 'attack' : p.defend && !p.attack ? 'defend' : null;
    if (p.attack && p.defend) return;   // contested: frozen
    if (alone && bn.side !== alone) {
      if (bn.by !== alone) { bn.by = alone; bn.raise = 0; }
      bn.raise += dt;
      if (bn.raise >= SIEGE_BANNER.raiseS) {
        bn.side = alone; bn.raise = 0; bn.by = null;
        if (alone === 'attack') b.raised = true;
        out.push({ k: 'banner', i, side: alone });
      }
      return;
    }
    bn.raise = Math.max(0, bn.raise - SIEGE_BANNER.decayPerS * dt);
    if (!bn.raise) bn.by = null;
  });
  if (b.kind === 'siege') {
    worksStep(b, fighters, nowMs, dt, ground, out);   // SEAT2b part two (b): the Ram at the Gatehouse
    const rule = SIEGE_THRONE[b.tier] ?? SIEGE_THRONE.palace;
    // SEAT2b part two (b) (6.2): and the Gatehouse breached, where one stands
    const open = b.banners.filter((bn) => bn.side === 'attack').length >= rule.banners && !siegeThroneBarred(b);
    const p = presentAt(bodies, b.field.throne, ground);
    if (open && p.attack && !p.defend) b.throne += dt;
    else if (!(open && p.attack && p.defend)) b.throne = Math.max(0, b.throne - SIEGE_THRONE.decayPerS * dt);
    // AUDIT-SEATS T1 (7.3: "A siege held only after the Throne was reached: -5"; 9.2: "The Throne was never reached"):
    // REACHED once its progress was ever above nought - the attackers stood alone at the open Throne for a beat; kept
    // for good (`th` on every receipt - net/siegeReceipt.js), never undone by the decay
    if (b.throne > 0) b.reached = true;
    if (b.throne >= rule.holdS) return end(b, 'attack', out);
  }
  if (b.kind === 'siege' && !b.attackSeen && nowMs >= b.startMs + SIEGE_FORFEIT_MS) return end(b, b.defendSeen ? 'forfeit' : 'absent', out);
  if (nowMs >= b.endMs) {
    if (b.kind === 'siege') return end(b, 'defend', out);
    const a = b.banners.filter((bn) => bn.side === 'attack').length, d = b.banners.filter((bn) => bn.side === 'defend').length;
    return end(b, a > d ? 'attack' : d > a ? 'defend' : 'tie', out);
  }
  return out;
}
function end(b, result, out) {
  b.result = result;
  out.push({ k: 'end', result });
  return out;
}

/** HONOURS (6.8): "Every fighter who stood half the siege or felled a foe" - `stood` its seconds in the room standing,
 *  `felled` how many it brought down (SEAT2b part two (c): a guard among them), against the battle's own run (`b.at` its
 *  end, from its start). DECIDED (part two (c)): a revolt earns none - a holder's own town risen against it is no war for
 *  the Spoils; putting it down is its own reward (7.7: its Standing back to 20). */
export const honoured = (f, b) => b.kind !== 'revolt' && ((f.felled ?? 0) > 0 || (f.stood ?? 0) * 1000 >= (Math.max(b.at, b.startMs) - b.startMs) / 2);

/** The room's door opens this long before the battle is joined - the sides gather at their camps (6.4: signing closes
 *  ten minutes before the start; DECIDED here: the door opens as it closes). */
export const SIEGE_OPENS_MS = 10 * 60_000;
/** A side's camp as a pose (6.2: the fallen rise there, a fighter enters there) - the height and facing kept from `was`,
 *  the ground's to settle. */
export const siegeCampPose = (b, side, was) => {
  const c = b.field.camps[side];
  return { x: c[0], y: Number.isFinite(was?.y) ? was.y : 0, z: c[1], yaw: Number.isFinite(was?.yaw) ? was.yaw : 0, pitch: 0 };
};

// ─── AUDIT-SEATS T3: A DISCONNECTED FIGHTER'S PLACE (Seats-Arc 16: "their place on the roster is kept 5 minutes; they
// return at their camp with the next wave. After 5 minutes a signed-up substitute may take the place"; 6.4) ───

/** A SIDE'S PLACES in the field - ten at a palace, twenty at a crown, its Sellswords within them (net/townSeatLaw.js
 *  SIEGE_SIDE_MAX, pinned equal: the service's roster counts no more) - and how long a fighter gone keeps its own. */
export const SIEGE_PLACES = Object.freeze({ palace: 10, crown: 20 });
export const SIEGE_PLACE_KEPT_MS = 5 * 60_000;
/** Whether a fighter holds its side's place at `now`: `here` (a socket in the room), or gone (`f.goneAt`, stamped by the
 *  relay at the leave it sees) less than SIEGE_PLACE_KEPT_MS. A fighter gone with no stamp is held. */
export const siegeHoldsPlace = (f, here, now) => here || !Number.isFinite(f?.goneAt) || now - f.goneAt < SIEGE_PLACE_KEPT_MS;
/** Whether `side` has a place free at `now` for an account that holds none: `fighters` the room's (`{ [sub]: f }`),
 *  `here(sub)` whether a socket of that account is in the room, `except` the account asking (its own place is not in
 *  the count - a fighter back inside its five minutes has one). */
export function siegePlaceFree(fighters, side, tier, here, now, except = null) {
  let held = 0;
  for (const [sub, f] of Object.entries(fighters ?? {})) if (sub !== except && f?.side === side && siegeHoldsPlace(f, here(sub), now)) held++;
  return held < (SIEGE_PLACES[tier] ?? SIEGE_PLACES.palace);
}
/**
 * A FIGHTER BACK FROM A DROP (its `in` after a leave): at its side's camp - and, the battle joined and not over, down
 * until its side's next wave, when it rises whole and protected as any fallen fighter does (siegeRise; a fighter that
 * fell before it dropped keeps its own wave). Before the start it simply stands at its camp; after the end nothing moves
 * (it came for its receipt). So a drop is never a way out of a fall: the place is kept, the ground is not. Answers
 * whether it waits for a wave (`f.upAt`).
 */
export function siegeReturn(b, f, now) {
  delete f.goneAt;
  if (!b || b.result || (f.side !== 'attack' && f.side !== 'defend')) return false;
  f.pose = siegeCampPose(b, f.side, f.pose); f.poseAt = now;
  if (now < b.startMs || f.down) return false;
  f.down = true;
  f.upAt = siegeNextWave(now, siegeWaveMs(b, f.side));   // SEAT2b part two (b): a defender's wave the Walls' quicker
  return true;
}
const sideCode = (s) => (s === 'attack' ? 1 : s === 'defend' ? 2 : 0);
/**
 * THE FIELD'S FRAME (the relay's `f`, each second): `b` each banner `[held, its raise in whole seconds, by whom]` (0 no
 * one, 1 the attackers, 2 the defenders), `th` the Throne's whole seconds, `s` and `e` the battle's start and end (ms),
 * `n` who is in - `[attackers, defenders, spectators]`. SEAT2b part two (b): a siege's works - `g` the Gatehouse
 * `[vitality, whole]` where one stands, `r` the Ram `[vitality, whole, its charge in whole seconds, Rams left in the
 * camp]` while one stands or waits, `w` the Walls' tier where they stand (the defenders' wave). SEAT2b part two (c): `v`
 * 1 for a revolt; `np` the relay's own fighters, each `[id, kind's code, vitality, whole, x, z, tx, tz, down (0|1), its
 * blow's landing (ms - 0 none)]` - where it stands at `now` (the frame's moment: the beat's, or an `in`'s) and where it
 * walks, in the room's units, whole.
 */
export const siegeFieldFrame = (b, n, now = b.at) => ({
  k: 'f', b: b.banners.map((bn) => [sideCode(bn.side), Math.floor(bn.raise), sideCode(bn.by)]), th: Math.min(Math.floor(b.throne), (SIEGE_THRONE[b.tier] ?? SIEGE_THRONE.palace).holdS), s: b.startMs, e: b.endMs, n,   // AUDIT SEATS-2 R3: the Throne's seconds held to its hold - a late beat past it never outruns the wire's bound
  ...(b.gate ? { g: [b.gate.hp, b.gate.max] } : {}),
  ...(b.gate && (b.ram || b.ramsLeft > 0) ? { r: b.ram ? [b.ram.hp, b.ram.max, Math.floor(b.ram.charge), b.ramsLeft] : [0, 0, 0, b.ramsLeft] } : {}),
  ...(b.works?.walls > 0 ? { w: b.works.walls } : {}),
  ...(b.kind === 'revolt' ? { v: 1 } : {}),
  ...(b.npcs?.length ? { np: b.npcs.map((x) => { const [px, pz] = siegeNpcAt(x, now); return [x.id, SIEGE_NPC[x.kind].code, Math.max(0, Math.round(x.hp)), x.max, Math.round(px), Math.round(pz), Math.round(x.tx), Math.round(x.tz), x.down ? 1 : 0, x.atk ? x.atk.at : 0]; }) } : {}),
});
/** The battle's next beat after `now`: a second on, or sooner where its start, a siege's forfeit mark or its end falls
 *  first - so a battle ends on its own clock, never a beat late. */
export function siegeNextBeat(b, now) {
  let next = now + SIEGE_TICK_MS;
  const marks = [b.startMs, b.endMs];
  if (b.kind === 'siege' && !b.attackSeen) marks.push(b.startMs + SIEGE_FORFEIT_MS);
  for (const m of marks) if (m > now && m < next) next = m;
  return next;
}

// ═════════════════════════════════════════════════════════════════════
// CROWN1 part two (2026-10-01, Mac: "Finish the seats"; "Continue";
// "Hurry up") - THE ROYAL TOURNEY (Seats-Arc 7.6): "a duel ladder all week
// in the crown's city, at the castle's entrance square: DUEL1's ring, but
// every blow refereed by PVP-REF in a siege:-shaped room - a
// defender-resolved duel cannot award a title - the relay keeping the
// ladder". Its room is `royal:<crown seat key>:<seat week>` (DECIDED: not
// `siege:` itself - a crown's siege and its Royal Tourney may fall in the
// same week), open the whole week its Edict rules, by the service's pass
// (`sn` 'royal': a contender `duel`, or a spectator). One bout at a time in
// the ring: a contender challenges another, the other accepts, both are
// set on their marks whole, and after DUEL1's countdown only the two may
// strike each other - the referee above judging every blow, the ring held
// by the step (a bout's fighter past its edge pulled back). A fall ends the
// bout; DUEL1's longest a draw; a bout's fighter gone from the room loses.
// The winner is handed a signed receipt (net/siegeReceipt.js `t1`), the
// ladder counts it - the same two at most ROYAL_PAIR_DAY_MAX a UTC day,
// as the service counts the receipts it is given (the champion is the
// service's to name, at the Turning). Pure, as above.
// ═════════════════════════════════════════════════════════════════════

/** A Royal Tourney's room - one a crown a week. */
export const ROYAL_ROOM = /^royal:(0|[1-9]\d{0,9}):(0|[1-9]\d{0,5})$/;
export const royalRoomKey = (key, week) => `royal:${key}:${week}`;
export const isRoyalRoom = (k) => ROYAL_ROOM.test(String(k ?? ''));
/** A room the referee keeps: a siege's, or a Royal Tourney's. */
export const isBattleRoom = (k) => isSiegeRoom(k) || isRoyalRoom(k);
/** A battle room's kind, seat and week - `{ kind: 'siege' | 'royal', key, week }` - or null. */
export function battleOfRoom(k) {
  const s = siegeOfRoom(k);
  if (s) return { kind: 'siege', ...s };
  const m = ROYAL_ROOM.exec(String(k ?? ''));
  return m ? { kind: 'royal', key: Number(m[1]), week: Number(m[2]) } : null;
}
/** THE RING - DUEL1's (net/duelSession.js DUEL_RADIUS_M, DUEL_COUNTDOWN_MS, DUEL_MAX_MS, DUEL_ASK_TTL_MS, DUEL_GONE_MS,
 *  DUEL_OUT_SLACK_M - pinned equal: this leaf imports nothing): its radius, the countdown, a bout's longest (then a draw),
 *  how long an ask stands, how long a bout's fighter may be gone from the room before it loses, the slack past the edge
 *  a step is given; and DECIDED here, each fighter's mark this far either side of the centre. */
export const ROYAL_RING = Object.freeze({ radiusM: 12, countdownMs: 3000, boutMs: 5 * 60_000, askMs: 30_000, goneMs: 10_000, outSlackM: 4, markM: 4 });
/** DECIDED: the same two contenders' bouts count at most this many a UTC day - a rematch or two, never a farm (the
 *  service's own count, net/townSeatLaw.js ROYAL_PAIR_DAY, pinned equal). */
export const ROYAL_PAIR_DAY_MAX = 3;
/** The ladder's rows the room says. */
export const ROYAL_LADDER_SHOWN = 10;
/** A winner's receipts the room keeps for its reconnect, newest last. */
export const ROYAL_RC_KEEP = 20;

/** A Royal Tourney's field as its pass carries it: the ring's centre, one point - `{ ring: [x, z] }`, or null. */
export function royalFieldOf(sf) {
  if (!Array.isArray(sf) || sf.length !== 1) return null;
  const p = sf[0];
  if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9)) return null;
  return { ring: [p[0], p[1]] };
}
/** A NEW ROYAL TOURNEY: no bout, an empty ladder. */
export const newRoyal = ({ startMs, endMs, field }) => ({
  kind: 'royal', tier: 'crown', startMs, endMs, field, bout: null, n: 0, ladder: {}, pairs: {}, asks: {}, at: startMs, result: null,
});
const utcDayOf = (ms) => Math.floor(ms / 86_400_000);
const pairOf = (x, y, ms) => `${x < y ? x : y}|${x < y ? y : x}|${utcDayOf(ms)}`;
/** A CHALLENGE: `from` asks `to` (account subjects) - it stands ROYAL_RING.askMs. A reason it may not, or null. */
export function royalAsk(b, from, to, now) {
  if (b?.kind !== 'royal' || b.result || now < b.startMs || now >= b.endMs) return 'the tourney is not open';
  if (!from || !to || from === to) return 'no such contender';
  if (b.bout && [b.bout.a, b.bout.b].some((x) => x === from || x === to)) return 'a bout is on';
  b.asks[from] = { to, at: now };
  return null;
}
/** AN ACCEPT: `by` takes `from`'s standing challenge, and the bout begins - after the countdown, to DUEL1's longest (never
 *  past the week). One at a time: refused while the ring holds another. `{ bout }` or `{ no }`. */
export function royalAccept(b, by, from, now) {
  if (b?.kind !== 'royal' || b.result || now >= b.endMs - ROYAL_RING.countdownMs) return { no: 'the tourney is not open' };
  const ask = b.asks[from];
  if (!ask || ask.to !== by || now - ask.at > ROYAL_RING.askMs) return { no: 'no such challenge' };
  if (b.bout) return { no: 'the ring is taken' };
  delete b.asks[from];
  b.n += 1;
  const startMs = now + ROYAL_RING.countdownMs;
  b.bout = { n: b.n, a: from, b: by, startMs, endMs: Math.min(b.endMs, startMs + ROYAL_RING.boutMs), gone: {} };
  return { bout: b.bout };
}
/** The bout's two marks as poses - the challenger's west of the centre, the other's east, each facing it (the height
 *  kept from `was`, the ground's to settle). AUDIT SEATS-3 B1: and the bout's ground recorded (`bout.y`, the marks'
 *  middle height - siegeGroundOf), each step and blow of its two held within SIEGE_HEIGHT_M of it. */
export function royalMarks(b, wasA, wasB) {
  const [x, z] = b.field.ring, d = ROYAL_RING.markM * SIEGE_UNITS_PER_M;
  const at = (dx, was, yaw) => ({ x: x + dx, y: Number.isFinite(was?.y) ? was.y : 0, z, yaw, pitch: 0 });
  const marks = [at(-d, wasA, Math.PI / 2), at(d, wasB, -Math.PI / 2)];
  if (b.bout) b.bout.y = (marks[0].y + marks[1].y) / 2;   // AUDIT SEATS-3 B1
  return marks;
}
/** AUDIT SEATS-3 B1: whether a bout's two stand level enough to meet - within SIEGE_HEIGHT_M of each other's height (an
 *  unknown height level), so neither starts a bout from where its marks' ground leaves the other out of reach. */
export const royalLevel = (p, q) => !Number.isFinite(p?.y) || !Number.isFinite(q?.y) || Math.abs(p.y - q.y) / SIEGE_UNITS_PER_M <= SIEGE_HEIGHT_M;
/** Whether `by` may strike `to` now: the running bout's two, its countdown run. */
export const royalMayStrike = (b, by, to, now) => !!b?.bout && now >= b.bout.startMs && now < b.bout.endMs
  && ((b.bout.a === by && b.bout.b === to) || (b.bout.b === by && b.bout.a === to));
/** Whether a bout's fighter may step to `p` - within the ring and its slack; anyone else anywhere. */
export function royalStepOk(b, sub, p) {
  if (!b?.bout || (b.bout.a !== sub && b.bout.b !== sub) || !p) return true;
  return Math.hypot((p.x - b.field.ring[0]) / SIEGE_UNITS_PER_M, (p.z - b.field.ring[1]) / SIEGE_UNITS_PER_M) <= ROYAL_RING.radiusM + ROYAL_RING.outSlackM;
}
/** A BOUT ENDED - `winner` its subject, or null for a draw: the ladder's win and loss, where the same two have not met
 *  ROYAL_PAIR_DAY_MAX times today (`counted`). `{ n, w, l, a, b, counted }` (`w`, `l` null in a draw), or null. */
export function royalEnd(b, winner, now) {
  const bt = b?.bout;
  if (!bt) return null;
  b.bout = null;
  const loser = winner === bt.a ? bt.b : winner === bt.b ? bt.a : null;
  let counted = false;
  if (loser) {
    const k = pairOf(bt.a, bt.b, now);
    counted = (b.pairs[k] ?? 0) < ROYAL_PAIR_DAY_MAX;
    if (counted) {
      b.pairs[k] = (b.pairs[k] ?? 0) + 1;
      (b.ladder[winner] ??= { w: 0, l: 0 }).w++;
      (b.ladder[loser] ??= { w: 0, l: 0 }).l++;
      (b.wonAt ??= {})[winner] = now;   // AUDIT-SEATS R10: its last counted win, on the room's clock (royalLadder's tie)
    }
  }
  return { n: bt.n, w: loser ? winner : null, l: loser, a: bt.a, b: bt.b, counted };
}
/** ONE BEAT OF A ROYAL TOURNEY: the lapsed asks forgotten; a bout past its time a draw; a bout's fighter gone from the room
 *  (`here(sub)` false) ROYAL_RING.goneMs loses it; at the week's end any bout a draw and the tourney over. Answers its
 *  events - `{ k: 'bout', ...royalEnd }`, `{ k: 'end', result: 'over' }`. */
export function royalStep(b, here, now) {
  if (b?.kind !== 'royal' || b.result) return [];
  const out = [];
  for (const [k, a] of Object.entries(b.asks)) if (now - a.at > ROYAL_RING.askMs) delete b.asks[k];
  const bt = b.bout;
  if (bt && now >= bt.endMs) out.push({ k: 'bout', ...royalEnd(b, null, now) });
  else if (bt) {
    for (const who of [bt.a, bt.b]) {
      if (here(who)) { delete bt.gone[who]; continue; }
      bt.gone[who] ??= now;
      if (now - bt.gone[who] >= ROYAL_RING.goneMs) { out.push({ k: 'bout', ...royalEnd(b, who === bt.a ? bt.b : bt.a, now) }); break; }
    }
  }
  if (now >= b.endMs) {
    if (b.bout) out.push({ k: 'bout', ...royalEnd(b, null, now) });
    b.result = 'over';
    out.push({ k: 'end', result: 'over' });
  }
  b.at = now;
  return out;
}
/** THE LADDER as the room says it: `[subject, wins, losses]`, the most wins first, then the fewest losses - AUDIT-SEATS
 *  R10: then the EARLIER last win, then the account: the service's champion rule (net/townSeatLaw.js royalStandings),
 *  so the room's first row is the one the Turning crowns. The tie went to the account alone, and with b winning first
 *  and a later the room showed a over b while the service crowned b. The last win is `b.wonAt` (royalEnd - the ladder's
 *  rows keep their `{ w, l }`); a contender with none (losses alone) reads 0, as the service's does. */
export const royalLadder = (b) => Object.entries(b?.ladder ?? {})
  .sort(([x, p], [y, q]) => q.w - p.w || p.l - q.l || (b.wonAt?.[x] ?? 0) - (b.wonAt?.[y] ?? 0) || (x < y ? -1 : 1)).slice(0, ROYAL_LADDER_SHOWN).map(([sub, r]) => [sub, r.w, r.l]);
/**
 * AUDIT-SEATS R5: THE CONTENDERS' RECORDS PRUNED - a contender whose socket is gone (`here(sub)` false) and who holds
 * nothing of the tourney (no ladder row, not in the bout, no challenge standing from or to it) is forgotten. Its record
 * is a whole fighter at its Renown (every bout ends both whole), so one that comes back is made again the same. The
 * field's bound was a count of records never deleted - forty-eight contenders entering on a Monday and leaving held the
 * ring shut to everyone until the Turning; the room's bound is now the contenders IN it (the relay's), and this keeps the
 * records it stores to the ones that mean something. Answers how many went.
 */
export function royalPrune(b, fighters, here) {
  let n = 0;
  const asked = new Set(Object.values(b?.asks ?? {}).map((a) => a.to));
  for (const sub of Object.keys(fighters ?? {})) {
    if (here(sub) || b?.ladder?.[sub] || b?.bout?.a === sub || b?.bout?.b === sub || b?.asks?.[sub] || asked.has(sub)) continue;
    delete fighters[sub];
    n++;
  }
  return n;
}
/** A Royal Tourney's next beat: each second while a bout is on (its draw, a fighter gone), else at the week's end. */
export function royalNextBeat(b, now) {
  if (b.bout) return Math.min(now + SIEGE_TICK_MS, Math.max(now + 1, b.bout.endMs));
  return Math.max(now + 1, b.endMs);
}
