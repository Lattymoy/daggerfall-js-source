// @ts-check
// FIXED-PVE stage 3 (bible/05-Combat/Fixed-PvE.md section 4): THE COMBAT SIMULATOR - a party of reference builds
// against foes made from templates, on the game's own clocks and rules: the tactics brain's two melee and two ranged
// tokens on each player (a foe without one waits, and goes in after TACT.PATIENCE), the boss traits' numbers, and the
// template's abilities on their cooldowns. Seeded, so a figure is a command away. It plans numbers; nothing in the
// game runs it. Ledger A (FIXED-PVE).

import { templateStats, GROUP_TEMPLATES, TEMPLATE_BY_KEY } from './pveTemplates.js';
import { FOE_BLOW_S } from './pveCategories.js';
import { COMBAT_ROLES } from './pveRoles.js';
import { ABILITIES } from './pveAbilities.js';
import { VIGIL_SHARE, VIGIL_BELOW, VIGIL_S } from './pveProfile.js';
import { TACT } from '../../ai/tactics.js';
import { CURB_SHARE, WARD_SHARE, WARD_REGROW_S, WARD_REFILL_S, WRATH_AFTER_S, WRATH_X, RESIST_SHARE, WEAPON_RESIST_SHARE,
  THORN_SHARE } from '../bossTraits.js';
import { mulberry32 } from '../soundscape/bedDsp.js';

export const SIM_STEP_S = 0.05;
export const SIM_MAX_S = 900;
/** A blow lands within this share either side of the build's mean. */
const PLAYER_SPREAD = 0.25;
/** Seconds a shield wall stands, and a rally or a war cry. */
const WALL_S = 6;
const AURA_S = 15;
/** Most summoned kin standing at once. */
const KIN_MAX = 4;
const PROOF = Object.freeze({ fire: 'flameproof', frost: 'frostproof', poison: 'venomproof', shock: 'stormproof', magic: 'spellproof' });

/** A probe template: one foe of `level` and `category` with `roles`, on an orc's body. */
export const probeTemplate = (level, category = 'normal', roles = ['fighter'], abilities = []) =>
  ({ key: `probe-${category}-${level}`, name: 'Probe', species: 'orc', level, category, roles, abilities, disposition: 'hostile' });

/** A group template's members, one template a foe. @param {string} key */
export function groupFoes(key) {
  const g = GROUP_TEMPLATES.find((x) => x.key === key);
  if (!g) throw new Error(`unknown group ${key}`);
  return g.members.flatMap(([k, n]) => Array.from({ length: n }, () => TEMPLATE_BY_KEY.get(k)));
}

function makeFoe(t, id, rng) {
  const s = templateStats(t), abil = new Set(t.abilities ?? []);
  const stances = t.roles.map((r) => COMBAT_ROLES[r]?.stance);
  return { id, t, abil, max: s.health, hp: s.health, dmg: s.damage, wardMax: abil.has('warded') ? WARD_SHARE * s.health : 0,
    ward: abil.has('warded') ? WARD_SHARE * s.health : 0, lastHit: -1e9, firstHit: null, next: rng() * FOE_BLOW_S, cd: {},
    wallUntil: 0, ranged: stances.some((x) => x === 'standOff' || x === 'back'), target: null, waitFrom: null,
    targetRule: COMBAT_ROLES[t.roles[0]]?.target ?? 'threat', healer: t.roles.includes('healer'), kin: false };
}

const ready = (f, key, now) => abilityOn(f, key) && !(f.cd[key] > now);
const abilityOn = (f, key) => f.abil.has(key) && ABILITIES[key];
const fire = (f, key, now) => { f.cd[key] = now + (ABILITIES[key].cooldown ?? 0); };

/**
 * One fight. `party` are builds (pveBuilds.js buildAt), `foes` templates; `log`, when given, takes every blow struck
 * as { s, by: 'player'|'foe', from, to }. Pure but for its seed.
 * @param {{ party: any[], foes: any[], seed?: number, focus?: 'healer'|'weakest', maxS?: number, log?: any[] }} o
 */
export function simulate({ party, foes, seed = 1, focus = 'healer', maxS = SIM_MAX_S, log }) {
  const rng = mulberry32(seed);
  const P = party.map((b, id) => ({ id, b, max: b.health, hp: b.health, next: rng() * b.actionS, dealt: 0, vigilAt: -1e9, melee: new Set(), ranged: new Set() }));
  const F = foes.map((t, i) => makeFoe(t, i, rng));
  let aura = { until: 0, value: 0 }, nextId = F.length;
  const controlSum = P.reduce((a, p) => a + p.b.control, 0);
  const alive = (xs) => xs.filter((x) => x.hp > 0);
  const roll = (lo, hi) => lo + (hi - lo) * rng();

  const takeFoe = (f, raw, p, now) => {
    const b = p.b, sp = b.spellShare, wp = 1 - sp;
    let wShare = 1, sShare = 1;
    if (f.abil.has('bladeturning') && b.blade) wShare = WEAPON_RESIST_SHARE;
    if (f.abil.has('stoneskin') && !b.blade && b.family === 'melee') wShare = WEAPON_RESIST_SHARE;
    if (b.element && f.abil.has(PROOF[b.element])) sShare = RESIST_SHARE;
    let d = raw * (wp * wShare + sp * sShare) * (f.wallUntil > now ? 1 - ABILITIES.shieldWall.value : 1);
    if (f.abil.has('curbing')) d = Math.min(d, CURB_SHARE * f.max);
    const guard = f.hp < f.max * 0.5 && alive(F).find((g) => g !== f && ready(g, 'guardAlly', now));
    if (guard) { fire(guard, 'guardAlly', now); const moved = d * ABILITIES.guardAlly.value; guard.hp -= moved; d -= moved; }
    if (f.ward > 0) { const soak = Math.min(f.ward, d); f.ward -= soak; d -= soak; }
    f.hp -= d; f.lastHit = now; if (f.firstHit == null) f.firstHit = now;
    p.dealt += d;
    if (f.abil.has('thorned') && wp > 0) p.hp -= THORN_SHARE * raw * wp * wShare;
  };

  const takePlayer = (p, raw, now) => {
    const b = p.b;
    if (rng() < b.evade || rng() < b.block) return;
    let d = raw * b.taken;
    if (b.hitCap) d = Math.min(d, b.hitCap * p.max);
    p.hp -= d;
    if (b.vigil && p.hp > 0 && p.hp < VIGIL_BELOW * p.max && now - p.vigilAt >= VIGIL_S) { p.hp += VIGIL_SHARE * p.max; p.vigilAt = now; }
  };

  const pickTarget = (f) => {
    const ps = alive(P);
    const rule = f.targetRule;
    const order = rule === 'weakest' || rule === 'lowestWard' ? [...ps].sort((a, c) => a.hp - c.hp) : [...ps].sort((a, c) => c.dealt - a.dealt || a.id - c.id);
    const kind = f.ranged ? 'ranged' : 'melee', max = f.ranged ? TACT.RANGED_TOKENS : TACT.MELEE_TOKENS;
    return order.find((p) => p[kind].has(f.id) || p[kind].size < max) ?? null;
  };

  let now = 0;
  for (; now < maxS; now += SIM_STEP_S) {
    const ps = alive(P), fs = alive(F);
    if (!ps.length || !fs.length) break;
    for (const p of ps) p.hp = Math.min(p.max, p.hp + p.b.regen * p.max * SIM_STEP_S);
    for (const f of fs) if (f.wardMax && now - f.lastHit > WARD_REGROW_S) f.ward = Math.min(f.wardMax, f.ward + (f.wardMax * SIM_STEP_S) / WARD_REFILL_S);
    for (const p of ps) {
      if (now < p.next) continue;
      p.next += p.b.actionS;
      const live = alive(F); if (!live.length) break;
      const healer = focus === 'healer' && live.find((f) => f.healer);
      const f = healer || live.reduce((a, c) => (c.hp < a.hp ? c : a));
      if (rng() < p.b.hit) { takeFoe(f, p.b.blow * roll(1 - PLAYER_SPREAD, 1 + PLAYER_SPREAD), p, now); log?.push({ s: now, by: 'player', from: p.id, to: f.id }); }
    }
    for (const f of alive(F)) {
      if (now < f.next) continue;
      const allies = alive(F), hurt = allies.filter((a) => a.hp < a.max * ABILITIES.mendAlly.below).sort((a, c) => a.hp / a.max - c.hp / c.max)[0];
      if (hurt && ready(f, 'mendAlly', now)) {
        fire(f, 'mendAlly', now); f.next = now + (ABILITIES.mendAlly.tell ?? 0);
        if (rng() >= Math.min(0.8, controlSum / 6)) hurt.hp = Math.min(hurt.max, hurt.hp + ABILITIES.mendAlly.value * hurt.max);
        continue;
      }
      if (f.hp < f.max * ABILITIES.mendSelf.below && ready(f, 'mendSelf', now)) {
        fire(f, 'mendSelf', now); f.next = now + (ABILITIES.mendSelf.tell ?? 0); f.hp += ABILITIES.mendSelf.value * f.max; continue;
      }
      if (f.hp < f.max * ABILITIES.shieldWall.below && ready(f, 'shieldWall', now)) { fire(f, 'shieldWall', now); f.wallUntil = now + WALL_S; }
      for (const k of ['rally', 'warCry']) if (ready(f, k, now)) { fire(f, k, now); aura = { until: now + AURA_S, value: Math.max(aura.value, ABILITIES[k].value ?? 0) }; }
      if (ready(f, 'summonKin', now) && F.filter((x) => x.kin && x.hp > 0).length < KIN_MAX) {
        fire(f, 'summonKin', now); f.next = now + (ABILITIES.summonKin.tell ?? 0);
        for (let k = 0; k < (ABILITIES.summonKin.value ?? 0); k++) F.push({ ...makeFoe(probeTemplate(f.t.level), nextId++, rng), kin: true });
        continue;
      }
      const target = pickTarget(f);
      if (f.target && f.target !== target) { f.target.melee.delete(f.id); f.target.ranged.delete(f.id); }
      const late = f.waitFrom != null && now - f.waitFrom >= TACT.PATIENCE;
      const hit = target ?? (late ? alive(P)[0] : null);
      if (!hit) { if (f.waitFrom == null) f.waitFrom = now; f.next = now + SIM_STEP_S; continue; }
      f.waitFrom = null; f.target = hit; (f.ranged ? hit.ranged : hit.melee).add(f.id);
      f.next = now + FOE_BLOW_S;
      let blow = roll(f.dmg[0], f.dmg[1]) * (aura.until > now ? 1 + aura.value : 1);
      if (f.abil.has('rage') && f.hp < f.max * ABILITIES.rage.below) blow *= 1 + (ABILITIES.rage.value ?? 0);
      if (f.abil.has('wrathful') && f.firstHit != null && now - f.firstHit >= WRATH_AFTER_S) blow *= WRATH_X;
      takePlayer(hit, blow, now); log?.push({ s: now, by: 'foe', from: f.id, to: hit.id });
      if (ready(f, 'cleave', now)) { fire(f, 'cleave', now); const other = alive(P).find((p) => p !== hit); if (other) takePlayer(other, blow, now); }
    }
  }
  const left = alive(P);
  return { win: !alive(F).length && left.length > 0, seconds: now, alive: left.length,
    hpLeft: left.reduce((a, p) => a + p.hp, 0) / P.reduce((a, p) => a + p.max, 0), foesLeft: alive(F).length };
}

/** `n` seeded fights: how often the party wins, the mean fight, and its health left (mean and the worst tenth). */
export function simMany(o, n = 40) {
  const runs = Array.from({ length: n }, (_, i) => simulate({ ...o, seed: (o.seed ?? 1) * 7919 + i }));
  const hp = runs.map((r) => (r.win ? r.hpLeft : 0)).sort((a, c) => a - c);
  return { winRate: runs.filter((r) => r.win).length / n, meanS: runs.reduce((a, r) => a + r.seconds, 0) / n,
    hpLeft: hp.reduce((a, v) => a + v, 0) / n, hpLeftP10: hp[Math.floor(n / 10)] };
}
