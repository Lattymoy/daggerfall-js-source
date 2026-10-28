#!/usr/bin/env node
// FIXED-PVE stage 3 (bible/05-Combat/Fixed-PvE.md section 4): THE BALANCE REPORT - every reference build's Combat
// Score, each one alone against a Normal and a Strong foe of its level, and every template and group against the party
// its category is made for, through the simulator, seeded. A template whose roles and abilities move
// its fight far from a plain foe of its category is named.
//
//   node tools/pveBalance.mjs            # 40 fights a cell
//   node tools/pveBalance.mjs --n 200    # a steadier sample
import { isMain } from './lib/isMain.mjs';
import { buildAt, BUILD_KIND_KEYS, TIERS } from '../src/systems/pve/pveBuilds.js';
import { combatScore, encounterEval, dangerWord } from '../src/systems/pve/pveProfile.js';
import { simMany, probeTemplate, groupFoes } from '../src/systems/pve/pveSim.js';
import { MOB_TEMPLATES, GROUP_TEMPLATES } from '../src/systems/pve/pveTemplates.js';
import { PVE_CATEGORIES } from '../src/systems/pve/pveCategories.js';

/** A party of `size` at `level`, the kinds taken in turn from the `from`th. */
export const partyFor = (level, size, from = 0) =>
  Array.from({ length: size }, (_, i) => buildAt(BUILD_KIND_KEYS[(from + i) % BUILD_KIND_KEYS.length], level));

/** Fights against foes at `level` by a party of `size`, over the six ways to start the turn of kinds, so no one
 *  party's make-up decides. */
export function fights(level, size, foes, n) {
  const rs = BUILD_KIND_KEYS.map((_, i) => simMany({ party: partyFor(level, size, i), foes }, n));
  const mean = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  return { winRate: mean((r) => r.winRate), meanS: mean((r) => r.meanS), hpLeft: mean((r) => r.hpLeft), hpLeftP10: mean((r) => r.hpLeftP10) };
}

/** The most a template's wins may stray from a plain foe of its level and category before it is named. */
export const STRAY_MAX = 0.15;

/** One template against the party its category is made for, beside a plain foe of its category: its roles and
 *  abilities should not move the fight far from what the category promises. */
export function templateVerdict(t, n = 40) {
  const c = PVE_CATEGORIES[t.category];
  const r = fights(t.level, c.party, [t], n), base = fights(t.level, c.party, [probeTemplate(t.level, t.category)], n);
  return { ...r, aim: c.party, base: base.winRate, ok: Math.abs(r.winRate - base.winRate) <= STRAY_MAX };
}

/** A group against as many players as it has members, beside as many plain Normal foes. */
export function groupVerdict(g, n = 40) {
  const foes = groupFoes(g.key), level = Math.round(foes.reduce((a, t) => a + t.level, 0) / foes.length);
  const r = fights(level, foes.length, foes, n), base = fights(level, foes.length, foes.map(() => probeTemplate(level)), n);
  return { ...r, level, aim: foes.length, base: base.winRate, ok: Math.abs(r.winRate - base.winRate) <= STRAY_MAX };
}

if (isMain(import.meta.url)) {
  const i = process.argv.indexOf('--n'), n = i > 0 ? Number(process.argv[i + 1]) : 40;
  const f2 = (v) => v.toFixed(2), pct = (v) => `${Math.round(100 * v)}%`;
  console.log('COMBAT SCORE by tier (advisory only)');
  for (const k of BUILD_KIND_KEYS) console.log(`  ${k.padEnd(10)} ${TIERS.map((t) => `L${t.level} ${combatScore(buildAt(k, t.level))}`).join('  ')}`);
  for (const cat of ['normal', 'strong']) {
    console.log(`ALONE against a ${cat} foe of its level: margin (1.2 is the planned edge), the word, the simulator's wins and health left`);
    for (const k of BUILD_KIND_KEYS) {
      console.log(`  ${k.padEnd(10)} ${TIERS.map(({ level: L }) => {
        const b = buildAt(k, L), t = probeTemplate(L, cat), e = encounterEval(b, t), s = simMany({ party: [b], foes: [t] }, n);
        return `L${L} ${f2(e.margin)} ${dangerWord(e.margin)} ${pct(s.winRate)}/${pct(s.hpLeft)}`;
      }).join(' | ')}`);
    }
  }
  console.log('TEMPLATES against the party their category is made for: wins (a plain foe\'s), mean seconds, health left');
  for (const t of MOB_TEMPLATES) {
    const v = templateVerdict(t, n);
    console.log(`  ${v.ok ? 'ok  ' : 'MISS'} ${t.key.padEnd(22)} L${t.level} ${t.category.padEnd(8)} x${v.aim}  ${pct(v.winRate)} (${pct(v.base)})  ${v.meanS.toFixed(0)} s  ${pct(v.hpLeft)}`);
  }
  console.log('GROUPS against as many players as members');
  for (const g of GROUP_TEMPLATES) {
    const v = groupVerdict(g, n);
    console.log(`  ${v.ok ? 'ok  ' : 'MISS'} ${g.key.padEnd(22)} L${v.level} x${v.aim}  ${pct(v.winRate)} (${pct(v.base)})  ${v.meanS.toFixed(0)} s  ${pct(v.hpLeft)}`);
  }
}
