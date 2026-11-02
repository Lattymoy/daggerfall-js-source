// AUDIT UPDATE II (2026-10-25, bible/01-Overview/audits/Audit-Update-II-2026-10-25.md): the second cold read of the update
// as the first audit left it - lane A's laws (a set's sigil imbued, a scene's first elites and revenants, a conjured
// piece, a second Imbue's worth, the scope and the Imbue's put-back) and the words' own gate: no machine row of any
// language stands on an English that has moved (A4 - seven languages told their players the odds never read the level).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { registerRollerLevel, withRollerLevel, rollerLevel } from '../../src/systems/loot/lootLevelGate.js';
import { applyRarity, rarityEligible, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';   // registers the law the Imbue's guard reads
import { createRandomWeapon } from '../../src/systems/loot/loot.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { imbuePiece, imbueTarget } from '../../src/systems/reforge.js';
import { welkyndShards } from '../../src/systems/gate/gateSpoils.js';
import { counterValueOf } from '../../src/systems/tradeModes.js';
import { eliteLoot } from '../../src/systems/eliteFoes.js';
import { revenantLoot } from '../../src/systems/revenant/revenant.js';
import { parseStringTableCsv } from '../../src/systems/textManager.js';
import { hash } from '../../tools/translate.mjs';
import { setPref } from '../../src/systems/uiPrefs.js';

setPref(LOOT_RARITY_KEY, true);
registerRollerLevel(null);
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const purse = () => ({ level: 20, items: [welkyndShards(500)], goldPieces: 10_000_000 });

test('AUDIT UPDATE II A2: a found Magic piece carrying a set\'s sigil (no power - a set\'s, never a blow) is imbued Rare and lawful, its sigil as it was (mutants: a set\'s sigil raised to NaN)', () => {
  const r = lcg(5);
  for (let i = 0; i < 40; i++) {
    const a = mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 0x0200 }));
    applyRarity(a, 'magic', r); a.isIdentified = true; a.sigil = { set: 'mora', party: 2, xp: 0 };
    assert.deepEqual(itemFindings(a), []);
    const p = purse(); p.items.push(a);
    assert.equal(imbuePiece(a, p, r).ok, true, `piece ${i}`);
    assert.deepEqual([a.rarity, a.sigil, itemFindings(a)], ['rare', { set: 'mora', party: 2, xp: 0 }, []]);
  }
});

test('AUDIT UPDATE II A3: an elite\'s share and a revenant\'s before any host frame (no level registered) are held at the level they are minted at - the player\'s at every host (mutants: no registry, no gate)', () => {
  const tally = (mint) => { let top = 0; for (let seed = 1; seed <= 3000; seed++) for (const it of mint(lcg(seed))) if (it.rarity === 'rare' || it.rarity === 'legendary') top++; return top; };
  assert.equal(rollerLevel(), null, 'no door, no scope');
  const early = tally((r) => eliteLoot(2, r)), open = withRollerLevel(20, () => tally((r) => eliteLoot(2, r)));
  assert.ok(open >= 100 && early * 3 < open, `an elite minted at level 2 before the first frame: ${early} of ${open}`);
  const legs = (level, at) => withRollerLevel(at, () => { let n = 0; for (let s = 1; s <= 3000; s++) for (const it of revenantLoot(level, 3, lcg(s))) if (it.rarity === 'legendary') n++; return n; });
  const rEarly = (() => { let n = 0; for (let s = 1; s <= 3000; s++) for (const it of revenantLoot(2, 3, lcg(s))) if (it.rarity === 'legendary') n++; return n; })();
  assert.ok(legs(2, 20) >= 15 && rEarly * 5 < legs(2, 20), `a revenant's Legendaries before the first frame: ${rEarly} of ${legs(2, 20)}`);
});

test('AUDIT UPDATE II A5: a conjured piece (Create Item - it vanishes at its hour) is not the Imbue\'s (mutants: the conjured unasked)', () => {
  let w = null;
  for (let i = 0; i < 50 && !w; i++) { const c = createRandomWeapon(6, lcg(70 + i)); if (c && rarityEligible(c)) w = c; }
  assert.equal(imbueTarget(w), 'magic');
  assert.equal(imbueTarget({ ...w, timeForItemToDisappear: 123456 }), null);
});

test('AUDIT UPDATE II A7: plain to Magic to Rare, a counter still pays the plain piece\'s price - the second Imbue\'s worth added to the first\'s (mutants: the first\'s worth overwritten)', () => {
  let n = 0;
  for (let i = 0; i < 30; i++) {
    const w = createRandomWeapon(6, lcg(300 + i));
    if (!w || !rarityEligible(w)) continue;
    const was = counterValueOf(w);
    const p = purse(); p.items.push(w);
    if (!imbuePiece(w, p, lcg(i)).ok || !imbuePiece(w, p, lcg(i + 1000)).ok) continue;
    n++;
    assert.equal(w.rarity, 'rare');
    assert.equal(counterValueOf(w), was, `piece ${i}: the plain price`);
  }
  assert.ok(n >= 20, `pieces imbued twice: ${n}`);
});

test('AUDIT UPDATE II A9: the scope refuses an async body, and a throw after the Imbue\'s roll puts the piece back with nothing paid (mutants: an async body accepted; the throw left the piece rolled)', async () => {
  assert.throws(() => withRollerLevel(3, async () => 1), /synchronous/);
  assert.equal(rollerLevel(), null, 'and the scope is gone');
  let w = null;
  for (let i = 0; i < 50 && !w; i++) { const c = createRandomWeapon(6, lcg(900 + i)); if (c && rarityEligible(c)) w = c; }
  const before = structuredClone(w);
  const p = purse(); p.items.push(w);
  const { setItemLaw } = await import('../../src/systems/loot/loot.js');
  const { worthCeiling } = await import('../../src/systems/item/itemLaw.js');
  let calls = 0;
  setItemLaw((it) => { if (++calls > 1) throw new Error('the law threw'); return []; }, worthCeiling);
  try {
    assert.throws(() => imbuePiece(w, p, lcg(1)), /the law threw/);
  } finally { setItemLaw(itemFindings, worthCeiling); }
  assert.deepEqual(w, before, 'put back as it was');
  assert.equal(p.goldPieces, 10_000_000, 'nothing paid');
});

test('AUDIT UPDATE II A4: no machine row of any language stands on an English that has moved - the pipeline\'s hash of the English it was drafted from is the English\'s now (a person\'s row is theirs to review: l10nCoverage.mjs counts it stale) (mutants: a moved English\'s rows left)', () => {
  const english = new Map(parseStringTableCsv(readFileSync('locales/en/Port_Strings.csv', 'utf8')));
  const stale = [];
  for (const tag of readdirSync('locales')) {
    const metaPath = `locales/${tag}/Port_Strings.meta.json`;
    if (tag === 'en' || !existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    for (const [key, rec] of Object.entries(meta)) {
      if (rec?.by === 'human' || !english.has(key)) continue;
      if (rec?.en !== hash(english.get(key))) stale.push(`${tag}: ${key}`);
    }
  }
  assert.deepEqual(stale, [], 'redraft them in session (tools/l10nInSession.mjs) when their English moves');
});
