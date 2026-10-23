#!/usr/bin/env node
// PWR7 (2026-10-23, bible/05-Combat/Power-Arc.md): THE POWER MEASURE - what the stacked kit is worth, measured through the
// game's own code (tools/power/powerKit.mjs wears the pieces, tools/power/powerFight.mjs fights the chain). Seeded, so
// every figure the page quotes is a command away.
//
//   node tools/power/powerMeasure.mjs             # every section, the record's run (8 chains a cell)
//   node tools/power/powerMeasure.mjs --n 3       # a quicker sample
//   node tools/power/powerMeasure.mjs stack       # one section: stack | sources | ablate
//
// THE SECTIONS:
//   stack   - every build at levels 10, 20 and 30: foes killed in a row (to 50), a kill's net cost, the blow as landed
//             and its edge over the plain build at the same level; offline-hero and online-hero beside it (BAL11's
//             threat on the foes, at the build's own level and Renown).
//   sources - the stacked and the online kits' blow, source by source: what each registered blow modifier adds to a
//             blow of 100 (entityMods.js registerWeaponBlowMod, asked as the Stats page asks - `estimate`, nothing kept)
//             in five situations (an open fight; the foe unaware; the player under half; the foe under half; the foe
//             under a quarter), the critical's multiplier, and what the weapon's own lines add to its roll.
//   ablate  - the stacked kit at level 20, one source taken away at a time: what each one decides.
//
// Not a DFU member; tooling, never shipped.
import { isMain } from '../lib/isMain.mjs';
import * as K from './powerKit.mjs';
import * as FI from './powerFight.mjs';

const SRC = new URL('../../src/', import.meta.url);
const mod = (p) => import(new URL(p, SRC).href);
const [SG, SSP, LP, FP, WM, MP, LR, PC, SK, EM] = await Promise.all([
  mod('systems/sigil/sigil.js'), mod('systems/sigil/sigilSetPowers.js'), mod('systems/loot/lootPowers.js'), mod('systems/firmamentPowers.js'),
  mod('systems/weaponMastery.js'), mod('systems/martialPowers.js'), mod('systems/loot/lootRarity.js'), mod('combat/pcaao.js'), mod('systems/skills.js'),
  mod('systems/entityMods.js'),
]);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
/** One cell, as the tables print it: kills in a row, a kill's hurt, heal and net cost (shares of the maximum), its
 *  seconds, the landed blow. */
export const cellText = (c) => `kills ${c.kills.toFixed(1).padStart(4)} hurt ${pct(c.hurt).padStart(6)} heal ${pct(c.heal).padStart(6)} cost ${pct(c.cost).padStart(6)} ttk ${c.ttk.toFixed(1).padStart(5)}s blow ${c.blow.toFixed(1).padStart(6)}`;
const LEVELS = Object.freeze([10, 20, 30]);

/** THE STACK: a row a build and level - the cell's figures (powerFight.mjs cell), `edge` how many times cheaper in
 *  health a kill is than the plain build's at that level (its `hurt` over this one's: heroMeasure's "cheaper"), `hero`
 *  the same cell with BAL11's threat on the foes. */
export function stackRows({ n = 8 } = {}) {
  const rows = [];
  for (const L of LEVELS) {
    let plain = null;
    for (const b of K.BUILDS) {
      const make = () => K.dress(K.kitAt(b, L));
      const c = FI.cell(make, { n });
      const h = FI.cell(make, { n, hero: true });
      plain ??= c;
      rows.push({ build: b, L, ...c, edge: plain.hurt / Math.max(1e-6, c.hurt), hero: h });
    }
  }
  return rows;
}

/** The five situations a blow is asked in (the foe's health share and the player's). */
export const SITUATIONS = Object.freeze([
  { id: 'open', foe: 1, me: 1, unaware: false },
  { id: 'unaware', foe: 1, me: 1, unaware: true },
  { id: 'wounded', foe: 1, me: 0.4, unaware: false },
  { id: 'foe<1/2', foe: 0.4, me: 1, unaware: false },
  { id: 'foe<1/4', foe: 0.2, me: 1, unaware: false },
]);
const BLOW_SOURCES = Object.freeze([['sigil', SG.sigilBlow], ['sets', SSP.setBlow], ['loot', LP.lootBlow], ['firmament', FP.firmamentBlow],
  ['mastery', WM.weaponMasteryBlow], ['martial', MP.martialBlow]]);
/** THE BLOW'S SOURCES for a dressed kit: per situation, each source's percent of a blow of 100 alone, their sum, what the
 *  door lands (entityMods.js weaponBlowMods - PWR1's sum through the blow channel, then the skill's own climb and the
 *  flat sears), the critical's multiplier and the weapon line's roll percent. */
export function sourceRows(kit) {
  const p = kit.player, w = kit.weapon;
  const foe = { isPlayer: false, isClass: false, level: kit.level, health: 100, maxHealth: 100, careerIndex: 7, career: {}, armorValues: new Array(7).fill(0), stats: { ...p.stats }, skills: new Array(35).fill(50) };
  const out = [];
  for (const s of SITUATIONS) {
    foe.health = s.foe * foe.maxHealth;
    p.health = Math.round(s.me * p.maxHealth);
    const info = { unaware: s.unaware, estimate: true };
    const by = {};
    for (const [id, fn] of BLOW_SOURCES) by[id] = fn(w, 100, p, foe, info) - 100;
    const sum = Object.values(by).reduce((a, b) => a + b, 0);
    out.push({ situation: s.id, by, sum, landed: EM.weaponBlowMods(w, 100, p, foe, info) - 100 });
  }
  p.health = p.maxHealth;
  const crit = SK.skillValue(p, SK.SKILLS.CriticalStrike);
  const critMult = 1 + Math.trunc(crit / 5) * 0.05;
  const roll = LR.affixWeaponDamage(w, 1000) / 10 - 100;
  return { rows: out, crit, critMult, roll };
}

/** THE ABLATION: the stacked kit at level `L`, whole and with each source taken away. */
export function ablateRows({ L = 20, n = 8 } = {}) {
  const base = () => K.kitAt('stacked', L);
  const plateFor = (kit, t) => {
    const it = kit.player.items.find((x) => x.group === 'Armor' && x.templateIndex === t);
    return it;
  };
  const CUTS = [
    ['whole', (k) => k],
    ['no sky', (k) => ({ ...k, tree: null })],
    ['no sigil', (k) => { delete k.weapon.sigil; return k; }],
    ['no sets', (k) => { for (const it of k.player.items) if (it.sigil?.set) delete it.sigil; return k; }],
    ['no climb', (k) => { for (const s of [SK.SKILLS.LongBlade, SK.SKILLS.ShortBlade, SK.SKILLS.CriticalStrike]) k.player.skills[s] = 100; return k; }],
    ['no path', (k) => { k.player.martialPath = null; return k; }],
    ['no gems', (k) => { k.weapon.affixes = (k.weapon.affixes ?? []).filter((a) => !a.gem); return k; }],
    ['no Legendary jewels', (k) => { for (const it of [...k.player.items]) if (it.group === 'Jewellery') { K.EQ.unequipItem(k.player, it); k.player.items.splice(k.player.items.indexOf(it), 1); } return k; }],
    ['no imprints', (k) => { for (const it of k.player.items) delete it.imprint; return k; }],
    ['no Legendary armour powers', (k) => { for (const t of [102, 104, 105, 107]) { const it = plateFor(k, t); if (it) it.legendary = null; } return k; }],
  ];
  const rows = [];
  for (const [name, cut] of CUTS) {
    const make = () => K.dress(cut(base()));
    const c = FI.cell(make, { n });
    const h = FI.cell(make, { n, hero: true });
    rows.push({ name, ...c, hero: h });
  }
  return rows;
}

/** RENOWN'S GROWTH (PWR3, BAL11's own measure on the real kit): the online kit at levels 12, 20 and 30 at Renown 1 to
 *  30, no threat, the place unsynced - a kill's hurt, and how much cheaper it is than at Renown 15 (BAL11's base). What
 *  the hero's Renown arm answers three quarters of (systems/heroThreat.js). */
export const RENOWN_STEPS = Object.freeze([1, 5, 10, 15, 20, 25, 30]);
export function renownRows({ n = 8 } = {}) {
  const rows = [];
  for (const L of [12, 20, 30]) {
    const cells = RENOWN_STEPS.map((R) => FI.cell(() => K.dress(K.kitAt('online', L, { R })), { n, sync: false }));
    const base = cells[RENOWN_STEPS.indexOf(15)];
    rows.push({ L, cells, cheaper: cells.map((c) => base.hurt / Math.max(1e-6, c.hurt)) });
  }
  return rows;
}

/** THE PLACE (PWR3): the online and the stacked kits at levels 20, 25 and 30 with the place's sync off and on, each
 *  under BAL11's threat - what the place takes off a hero who has outgrown it. */
export function placeRows({ n = 8 } = {}) {
  const rows = [];
  for (const b of ['online', 'stacked']) {
    for (const L of [20, 25, 30]) {
      const make = () => K.dress(K.kitAt(b, L));
      rows.push({ build: b, L, off: FI.cell(make, { n, hero: true, sync: false }), on: FI.cell(make, { n, hero: true, sync: true }) });
    }
  }
  return rows;
}

/** THE EDGE (PWR3): one band of places - the dungeon kinds whose ceiling is 20, the bestiary's top band - a level-20
 *  online hero (a native there, never synced) against the same build at 25 and 30, synced and not, under the hero's
 *  threat: how much stronger than the place's own a hero who outgrew it stands (Mac: "keep a 15% edge"). */
export function edgeRows({ n = 8 } = {}) {
  const tables = [...Array(19).keys()].filter((k) => FI.ceilingOf(k) === 20);
  const at = (L, sync) => FI.cell(() => K.dress(K.kitAt('online', L)), { n, hero: true, sync, tables });
  const native = at(20, false);
  return { tables, native, rows: [25, 30].map((L) => { const off = at(L, false), on = at(L, true); return { L, off, on, edge: native.cost / Math.max(1e-6, on.cost) }; }) };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const nAt = args.indexOf('--n');
  const n = nAt >= 0 ? Number(args[nAt + 1]) : 8;
  const only = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? null;
  if (!only || only === 'stack') {
    console.log(`THE STACK (${n} chains a cell, to ${FI.MAX_KILLS} kills): kills in a row, a kill's net cost, the blow as landed, its edge over plain - and with the hero's threat (BAL11)`);
    for (const r of stackRows({ n })) console.log(`  L${r.L} ${r.build.padEnd(8)} hp ${String(r.maxHealth).padStart(3)} | ${cellText(r)} edge x${r.edge.toFixed(1).padStart(5)} | hero: ${cellText(r.hero)}`);
  }
  if (!only || only === 'sources') {
    for (const [b, L] of [['online', 30], ['stacked', 20]]) {
      const kit = K.dress(K.kitAt(b, L));
      const s = sourceRows(kit);
      console.log(`THE BLOW'S SOURCES - ${b} at level ${L} (Renown ${kit.renown}): percent of a blow of 100, each alone, their sum, and what the door lands`);
      console.log(`  the weapon's lines on its roll: +${s.roll.toFixed(0)}%; Critical Strike ${s.crit} -> a critical x${s.critMult.toFixed(2)}`);
      for (const r of s.rows) console.log(`  ${r.situation.padEnd(8)} ${Object.entries(r.by).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')} | sum +${r.sum.toFixed(0)}% landed +${r.landed.toFixed(0)}%`);
    }
  }
  if (!only || only === 'renown') {
    console.log(`RENOWN'S GROWTH - the online kit, no threat, unsynced (${n} chains a cell): a kill's hurt, and x cheaper than at Renown 15`);
    for (const r of renownRows({ n })) console.log(`  L${r.L} ${RENOWN_STEPS.map((R, i) => `R${R} ${pct(r.cells[i].hurt)} x${r.cheaper[i].toFixed(2)}`).join(' | ')}`);
  }
  if (!only || only === 'place') {
    console.log(`THE PLACE (PWR3) - under the hero's threat, the place's sync off and on (${n} chains a cell)`);
    for (const r of placeRows({ n })) console.log(`  L${r.L} ${r.build.padEnd(8)} off: ${cellText(r.off)} | on: ${cellText(r.on)}`);
  }
  if (!only || only === 'edge') {
    const e = edgeRows({ n });
    console.log(`THE EDGE (PWR3) - the dungeon kinds whose ceiling is 20 (${e.tables.join(', ')}), under the hero's threat (${n} chains a cell): a native at 20, ${cellText(e.native)}`);
    for (const r of e.rows) console.log(`  L${r.L} off: ${cellText(r.off)} | on: ${cellText(r.on)} | x${r.edge.toFixed(2)} the native`);
  }
  if (!only || only === 'ablate') {
    console.log(`THE ABLATION - the stacked kit at level 20, one source taken away (${n} chains a cell)`);
    for (const r of ablateRows({ n })) console.log(`  ${r.name.padEnd(28)} ${cellText(r)} | hero: ${cellText(r.hero)}`);
  }
}
