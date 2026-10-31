// @ts-check
// PVP-VITALS (2026-10-30, as the owner asked): while its flag is up in the open zone, a fighter's three pools are the relay's. A game could freeze or set
// its own bars, and the relay believed it. Now health rises by report only out of a credit the relay grants (a slow
// regen, a potion on its own 15 s clock, a heal it saw paid for); magicka and fatigue are its ledgers, anchored at the
// game's word while the flag is down, each refereed cast and swing paying the PvP bar's cheapest price or landing nothing;
// a Shield counts only paid for. An honest game spends at least that, so it is never refused. Pure. DFU has no PvP.

/** A ledger's whole, in parts (net/siege/refereeHealthShare.js HEALTH_SHARE_WHOLE, pinned equal). */
export const VITAL_WHOLE = 10_000;

/** The PvP bar's price list, per cent of maximum magicka (systems/wild/pvpKit.js KIT_SPELLS' `cost`, pinned equal), by the
 *  kit's order (KIT_IDS). The relay charges these, never plate's surcharge on them. */
export const KIT_COSTS = Object.freeze({
  damage: 8,
  heal: 12,
  shield: 15,
  resist: 12,
  reflect: 12,
  absorb: 12,
  fortify: 10,
  regen: 10,
  jump: 6,
  speed: 6,
  resurrect: 25,
});
export const KIT_ORDER = Object.freeze(Object.keys(KIT_COSTS));
/** An ally cast frame's first effect type to its cheapest kit price (Fortify and Speed share 9: the cheaper is charged). */
export const KIT_COST_BY_TYPE = Object.freeze({
  10: KIT_COSTS.heal,
  35: KIT_COSTS.shield,
  8: KIT_COSTS.resist,
  21: KIT_COSTS.reflect,
  20: KIT_COSTS.absorb,
  9: KIT_COSTS.speed,
  18: KIT_COSTS.regen,
  27: KIT_COSTS.jump,
});

/** The numbers (parts of the whole unless named): health and magicka regen a second (gear and powers, with room); the
 *  potion clock (combat/pvpPotions.js, pinned equal); a magicka and a fatigue potion; a paid buff's minute (pvpKit.js);
 *  the kit heal's share at Restoration 100 and 300; a swing (hostCombat's 8 over the largest honest bar, 260 x 64) and a
 *  second's run past the fastest walk (`walkMps`, DFU's GetWalkSpeed at Speed 200); one cast's area window; the most
 *  health credit held, the most regen banks, and how long a paid heal's credit waits (a potion is no store of health);
 *  PVP-KIT-REGEN's most a second, per cent of health (the kit's top share, a round taken as a second at the shortest). */
export const PVP_VITALS = Object.freeze({
  hpRegen: 10,
  mpRegen: 5,
  potionMs: 15_000,
  mpPotion: 6_000,
  fpPotion: 5_000,
  buffMs: 60_000,
  healLo: 25,
  healHi: 35,
  swing: 5,
  runPerS: 80,
  walkMps: 8.9,
  castMs: 1_500,
  creditMax: 1,
  regenBank: 0.05,
  creditMs: 5_000,
  shaftMs: 250,
  shaftBurst: 2,
  swingMs: 450,
  regenKit: 4,
});

/** BOW-RATE: `shaftMs` is the closest two honest arrows come - the bow's loose at no reload, four ticks
 *  (characters/weaponStates.js BOW_NUM_FRAMES.StrikeUp x CLASSIC_UPDATE_INTERVAL, pinned equal);
 *  `shaftBurst` the arrows a late network may bunch together. SWING-RATE: `swingMs` the quickest honest swing
 *  (MELEE_NUM_FRAMES.StrikeDown x SWING_FRAME_MIN, pinned equal), per target - a Cleave lands on several. */

/** BOW-FAST: a shaft landing within `within` seconds of the shooter's last takes a stack, at most `most`, and each takes
 *  `cut` per cent off it, at least 1 kept (combat/bowBloom.js BOW_FAST, pinned equal). The relay counts it for a shaft it
 *  judges, so a game cannot leave the cut off. */
export const RELAY_BOW_FAST = Object.freeze({ cut: 20, most: 4, within: 1 });
/** BOW-KINDS: a bow's own window by its template (bowBloom.js BOW_KINDS, pinned equal) - the Short Bow quicker, the Long slower. */
export const BOW_FAST_WITHIN = Object.freeze({ 129: 0.75, 130: 1.25 });

/** Declarations a report may carry (`u`): a potion drunk (health, magicka, other), or a kit spell cast on myself (10 + its
 *  place in KIT_ORDER). */
export const DECLARE = Object.freeze({ hpPotion: 1, mpPotion: 2, otherPotion: 3, kit: 10 });
export const DECLARE_MAX = DECLARE.kit + KIT_ORDER.length - 1;
export const DECLARES_PER_REPORT = 8;

/** PVP-VITALS: the most health a character of signed level `cl` may claim - the best level-45 body (25 + 30 + 44 x 35)
 *  scaled to its level, at PVP_HEALTH_MAX's room over it. An unsigned level gets the whole cap. */
export function healthCapAt(cl, cap = 3000) {
  if (!Number.isSafeInteger(cl) || cl < 1) return cap;
  return Math.min(cap, Math.ceil((cap * (55 + 35 * (Math.min(cl, 45) - 1))) / 1595));
}
/** A Heal Health potion's most at signed level `cl` (Heal True's 5 + 19 a level - systems/potionRecipes.js). */
export const potionHealAt = (cl) => 5 + 19 * (Number.isSafeInteger(cl) && cl >= 1 ? cl : 45);

/**
 * @typedef {{ heard: boolean, mp: number, fp: number, credit: number, creditAt: number, at: number, potion: Record<string, number>, shieldTo: number, absorbTo: number, regenTo: number, castC: number, castAt: number, castTo: string[], shafts: number, shaftAt: number, fastK: number, fastAt: number, swings: Record<string, [number, number]> }} Vitals
 */
/** A fighter's ledgers - made unheard (full until the game's word anchors them). @param {any} f @param {number} now @returns {Vitals} */
export function vitalsOf(f, now) {
  if (!f.vitals)
    f.vitals = {
      heard: false,
      mp: VITAL_WHOLE,
      fp: VITAL_WHOLE,
      credit: 0,
      creditAt: -Infinity,
      at: now,
      potion: {},
      shieldTo: 0,
      absorbTo: 0,
      regenTo: 0,
      castC: 0,
      castAt: 0,
      castTo: [],
      shafts: PVP_VITALS.shaftBurst,
      shaftAt: now,
      fastK: 0,
      fastAt: -Infinity,
      swings: {},
    };
  return f.vitals;
}
/** The regen since the ledgers last moved: magicka, and health credit (to `creditMax` of the whole). */
function accrue(f, v, now) {
  const s = Math.max(0, now - v.at) / 1000,
    from = v.at;
  v.at = now;
  v.mp = Math.min(VITAL_WHOLE, v.mp + s * PVP_VITALS.mpRegen);
  const bank = f.max * PVP_VITALS.regenBank;
  if (now - (v.creditAt ?? -Infinity) > PVP_VITALS.creditMs) v.credit = Math.min(v.credit, bank); // a paid heal's credit not taken in time
  if (v.credit < bank) v.credit = Math.min(bank, v.credit + (s * PVP_VITALS.hpRegen * f.max) / VITAL_WHOLE);
  const rs = Math.max(0, Math.min(now, v.regenTo ?? 0) - from) / 1000; // PVP-KIT-REGEN: a paid Regenerate's rounds
  if (rs > 0) {
    v.credit = Math.min(f.max * PVP_VITALS.creditMax, v.credit + (rs * PVP_VITALS.regenKit * f.max) / 100);
    v.creditAt = now;
  }
}
const share = (n) => Math.max(0, Math.min(VITAL_WHOLE, Math.round(Number(n))));
/** A kit price in parts. */
const parts = (pct) => Math.round((pct * VITAL_WHOLE) / 100);
/** A kit heal's share of the whole at Restoration `resto`, per cent (pvpKit.js kitScale). */
export const kitHealShare = (resto) =>
  PVP_VITALS.healLo +
  (PVP_VITALS.healHi - PVP_VITALS.healLo) * Math.max(0, Math.min(1, ((Number(resto) || 0) - 100) / 200));

/** Pay `pct` of magicka now - false (nothing spent) where the ledger is short. */
export function payMagicka(f, pct, now) {
  const v = vitalsOf(f, now);
  accrue(f, v, now);
  const p = parts(pct);
  if (v.mp < p) return false;
  v.mp -= p;
  return true;
}
/** Pay `n` parts of fatigue - false (nothing spent) where the ledger is short. */
export function payFatigue(f, n, now) {
  const v = vitalsOf(f, now);
  if (v.fp < n) return false;
  v.fp -= n;
  return true;
}
/** BOW-RATE: an arrow loosed now - false (none spent) where it comes sooner than the bow allows. */
export function shaftPaid(f, now) {
  const v = vitalsOf(f, now);
  v.shafts = Math.min(
    PVP_VITALS.shaftBurst,
    (v.shafts ?? PVP_VITALS.shaftBurst) + Math.max(0, now - (v.shaftAt ?? now)) / PVP_VITALS.shaftMs,
  );
  v.shaftAt = now;
  if (v.shafts < 1) return false;
  v.shafts -= 1;
  return true;
}
/** BOW-FAST: a judged shaft's claim `d` landing now from the bow of template `w`, after its stacks. */
export function bowFastCut(f, d, now, w = null) {
  const v = vitalsOf(f, now);
  const within = BOW_FAST_WITHIN[/** @type {129|130} */ (w)] ?? RELAY_BOW_FAST.within;
  v.fastK = now - (v.fastAt ?? -Infinity) < within * 1000 ? Math.min(RELAY_BOW_FAST.most, (v.fastK ?? 0) + 1) : 0;
  v.fastAt = now;
  return v.fastK > 0 && d > 0 ? Math.max(1, Math.round((d * (100 - RELAY_BOW_FAST.cut * v.fastK)) / 100)) : d;
}
/** SWING-RATE: a melee blow on `to` now - false where it comes sooner than the quickest swing allows (two may bunch). */
export function swingPaid(f, to, now) {
  const v = vitalsOf(f, now);
  v.swings ??= {};
  const [n, at] = v.swings[to] ?? [PVP_VITALS.shaftBurst, now];
  const left = Math.min(PVP_VITALS.shaftBurst, n + Math.max(0, now - at) / PVP_VITALS.swingMs);
  if (left < 1) return false;
  for (const k in v.swings) if (now - v.swings[k][1] > 10_000) delete v.swings[k]; // a target long left
  v.swings[to] = [left - 1, now];
  return true;
}
/** A heal of `hp` the relay saw paid for, credited to `f`'s rise. */
export function creditHeal(f, hp, now) {
  const v = vitalsOf(f, now);
  accrue(f, v, now);
  v.credit = Math.min(f.max * PVP_VITALS.creditMax, v.credit + Math.max(0, hp));
  v.creditAt = now;
}
/** The health credit `f` holds now (its regen counted), and its spending. */
export function healCredit(f, now) {
  const v = vitalsOf(f, now);
  accrue(f, v, now);
  return v.credit;
}
export function spendCredit(f, n, now) {
  const v = vitalsOf(f, now);
  v.credit = Math.max(0, v.credit - Math.max(0, n));
}
/** Whether a paid Shield runs on `f`. */
export const shieldPaid = (f, now) => (f?.vitals?.shieldTo ?? 0) > now;

/** A paid kit spell's effect on its target `t`: a heal's credit (`hp` - the frame's own magnitude where it has one, else
 *  the kit's share at `resto`), a Shield's or an Absorb's minute. */
export function kitLanded(t, id, now, { hp = null, resto = 0 } = {}) {
  const v = vitalsOf(t, now);
  if (id === 'heal')
    creditHeal(t, Math.min((t.max * PVP_VITALS.healHi) / 100, hp ?? (t.max * kitHealShare(resto)) / 100), now);
  else if (id === 'shield') v.shieldTo = now + PVP_VITALS.buffMs;
  else if (id === 'absorb') v.absorbTo = now + PVP_VITALS.buffMs;
  else if (id === 'regen') {
    accrue(t, v, now);
    v.regenTo = now + PVP_VITALS.buffMs;
  } // PVP-KIT-REGEN
}

/**
 * A REPORT'S VITALS (net/wire.js validVitIn: `mp`, `fp` shares, `use` declarations), on the fighter `f` (a referee fighter)
 * - `flagged` its flag. Unflagged, or never heard, the game's word anchors both ledgers. Flagged, each declaration is
 * paid for and credited (a fresh report's alone: `fresh`), and nothing else moves the ledgers. `cl` the signed level.
 */
export function vitalsReport(f, report, now, { flagged = false, fresh = true, cl = null, resto = 0 } = {}) {
  const v = vitalsOf(f, now);
  accrue(f, v, now);
  if (!flagged || !v.heard) {
    v.mp = Number.isFinite(report.mp) ? share(report.mp) : VITAL_WHOLE;
    v.fp = Number.isFinite(report.fp) ? share(report.fp) : VITAL_WHOLE;
    v.heard = true;
    if (!flagged) return;
  }
  if (!fresh || !Array.isArray(report.use)) return;
  for (const u of report.use.slice(0, DECLARES_PER_REPORT)) {
    if (u === DECLARE.hpPotion || u === DECLARE.mpPotion || u === DECLARE.otherPotion) {
      if (now - (v.potion[u] ?? -Infinity) < PVP_VITALS.potionMs) continue; // the relay's own potion clock
      v.potion[u] = now;
      if (u === DECLARE.hpPotion) creditHeal(f, potionHealAt(cl), now);
      else if (u === DECLARE.mpPotion) v.mp = Math.min(VITAL_WHOLE, v.mp + PVP_VITALS.mpPotion);
      else v.fp = Math.min(VITAL_WHOLE, v.fp + PVP_VITALS.fpPotion);
    } else if (Number.isInteger(u) && u >= DECLARE.kit && u <= DECLARE_MAX) {
      const id = KIT_ORDER[u - DECLARE.kit];
      if (id === 'damage' || !payMagicka(f, KIT_COSTS[id], now)) continue; // damage is paid where it lands (castPaid)
      kitLanded(f, id, now, { resto });
    }
  }
}

/**
 * A HARMFUL CAST'S PRICE (`c` the caster's cast number - one cast's area lands on several targets under one number,
 * net/wire.js validDuelData `c`): the first landing of a cast pays the kit's Damage; a landing of the same cast on another
 * target inside PVP_VITALS.castMs is free. No number, or the same target again, pays again. False where it cannot pay.
 */
export function castPaid(f, c, to, now) {
  const v = vitalsOf(f, now);
  if (Number.isSafeInteger(c) && c === v.castC && now - v.castAt < PVP_VITALS.castMs && !v.castTo.includes(to)) {
    v.castTo.push(to);
    return true;
  }
  if (!payMagicka(f, KIT_COSTS.damage, now)) return false;
  if (Number.isSafeInteger(c)) {
    v.castC = c;
    v.castAt = now;
    v.castTo = [to];
  }
  return true;
}
/** An Absorb on `t` takes a landed harmful cast's price back into its magicka. */
export function absorbLanded(t, now) {
  const v = vitalsOf(t, now);
  if (v.absorbTo > now) v.mp = Math.min(VITAL_WHOLE, v.mp + parts(KIT_COSTS.damage));
}
/** A step of `metres` in `ms` past the fastest walk is a run: its seconds paid from fatigue (never refused - a step is
 *  believed; an empty ledger refuses the next swing). */
export function runPaid(f, metres, ms, now) {
  if (!(ms > 0) || !(metres > 0) || metres / (ms / 1000) <= PVP_VITALS.walkMps) return;
  const v = vitalsOf(f, now);
  v.fp = Math.max(0, v.fp - Math.min(1, ms / 1000) * PVP_VITALS.runPerS);
}

/** What the ledgers carry into another room (net/wild/wildRef.js wildCarry), and taken from one. */
export const vitalsCarry = (f) =>
  f?.vitals?.heard ? { mp: Math.round(f.vitals.mp), fp: Math.round(f.vitals.fp) } : null;
export function vitalsTake(f, c, now) {
  if (!c || !Number.isFinite(c.mp) || !Number.isFinite(c.fp)) return;
  const v = vitalsOf(f, now);
  v.mp = share(c.mp);
  v.fp = share(c.fp);
  v.heard = true;
}
