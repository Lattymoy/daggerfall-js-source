// AFFIX-LINES and REFORGE-REPLACE (2026-10-25). A player, SaberGGaming: carrying capacity on four Rare pieces in five,
// found and crafted alike - the owner: "No band aids". Two causes, both the roll's own: a pick drew a KIND at even
// weight, then its param, so carrying capacity (one line) came up as often as the eight attributes together; and a
// Rare's last pick was held to whichever name slot its lines left empty, and a jewel's one numeric prefix IS carrying
// capacity. THE FIX (bible/06-Systems/Loot-Rarity.md, the affix law): every pick drawn over the LINES still open - one
// roll, as `pick` took (LOOT1's law), so a seeded stream keeps its count - and the name following the lines. A product
// record made before (mint version 0 or 1, net/productRecord.js) mints the piece it always did.
//
// THE REFORGE (bible/06-Systems/Loot-Arc.md section 11; Professions-Arc.md 41.2 and 41.7): it could give a line its own
// kind back (a Rare's line held to its slot) and the first reforge locked the piece to that one line, at a flat price.
// The owner chose "Replace, price rises": a reforge always puts a line of ANOTHER kind in the line's place (across the
// name's slots, the piece renamed), any line, as often as the purse allows, each reforge twice the last - at the Mages
// Guild and with Essence alike, one `reforgeAffix`; a line nothing else can take the place of is not offered; an old
// piece's one-line mark is a reforge counted, never a lock.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as RF from '../../src/systems/reforge.js';
import { reforgeEssence } from '../../src/net/temperLaw.js';
import { MINT_VERSION, MINT_V_LAST_PASS, MINT_V_LINES } from '../../src/net/productRecord.js';
import { mintPiece, asMinted, reforgeItem, essenceReforgeRefusal } from '../../src/systems/smithItems.js';
import { RECIPES } from '../../src/net/recipeLaw.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon, weaponOfMaterial, armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { welkyndShards } from '../../src/systems/gate/gateSpoils.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { validGildedMarks, mintHourlock } from '../../src/systems/gilded.js';
import { withDom } from '../invdrag.mjs';
import { mountReforgeWindow, REFORGE_NOTE, REFORGE_REFUSALS, REFORGED } from '../../src/ui/reforgeWindow.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
/** A seed per mint, spread over the 32 bits (the service's are). */
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0);
const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 });
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', flags: 0 });
const sword = () => createWeapon(120, 1);
const gown = () => mintCondition({ group: 'WomensClothing', templateIndex: 195, name: 'garment', flags: 0, variant: 0 });
const known = (it) => Object.assign(it, { isIdentified: true });
const graded = (make, tier, seed) => known(LR.applyRarity(make(), tier, seededRng(seedOf(seed))));
const slotOf = (a) => LR.AFFIX_KINDS[a.id].slot;
const names = (it, slot) => it.affixes.some((a) => a.gem == null && slotOf(a) === slot && !LR.AFFIX_KINDS[a.id].proc);
/** The number kinds a group's roll draws, and the lines each may give a fresh piece. */
const lineTable = (item) => Object.fromEntries(LR.AFFIX_IDS.filter((id) => LR.AFFIX_KINDS[id].groups.includes(item.group) && !LR.AFFIX_KINDS[id].proc).map((id) => [id, LR.kindLines(id, item)]));

test('AFFIX-LINES: 10,000 seeded mints a piece - a line is drawn over the lines: no kind above its line share, carrying capacity at its own (a Rare jewel\'s one line in 49, where the old law put it on every one)', () => {
  assert.deepEqual(lineTable(ring()), { weight: 1, stat: 8, resist: 5, skill: 35 }, 'a jewel\'s lines');
  assert.deepEqual(lineTable(cuirass()), { armor: 1, weight: 1, stat: 8, resist: 5, skill: 35 }, 'armour\'s');
  assert.deepEqual(lineTable(sword()), { damage: 1, stat: 8, skill: 35 }, 'a weapon\'s');
  assert.deepEqual(lineTable(gown()), { stat: 1, skill: 35, standing: 5, warmth: 1, dry: 1 }, 'a garment\'s (LOOT14: Personality alone)');
  const N = 10_000;
  const tally = (make, tier, byLines) => {
    const lines = {}, pieces = {};
    let total = 0;
    for (let s = 0; s < N; s++) {
      const out = LR.rollAffixes(make(), tier, seededRng(seedOf(s)), { byLines });
      for (const a of out) { lines[a.id] = (lines[a.id] ?? 0) + 1; total++; }
      for (const id of new Set(out.map((a) => a.id))) pieces[id] = (pieces[id] ?? 0) + 1;
    }
    return { share: (id) => (lines[id] ?? 0) / total, on: (id) => (pieces[id] ?? 0) / N };
  };
  for (const [make, own] of [[ring, null], [cuirass, 'armor'], [sword, 'damage'], [gown, 'standing']]) {
    const table = lineTable(make());
    const all = Object.values(table).reduce((n, w) => n + w, 0);
    for (const tier of ['magic', 'rare']) {
      const t = tally(make, tier, true);
      for (const [id, n] of Object.entries(table)) {
        const share = n / all;
        if (id === own) { assert.ok(t.share(id) > share, `${make().group} ${tier}: its own number leans (LOOT1\'s law kept) - ${t.share(id)}`); continue; }
        assert.ok(t.share(id) <= share + 0.01, `${make().group} ${tier}: ${id} ${t.share(id).toFixed(4)} of the lines, its share ${share.toFixed(4)}`);
        if (!own) assert.ok(Math.abs(t.share(id) - share) < 0.01, `${tier} jewel: ${id} at its share - ${t.share(id).toFixed(4)} against ${share.toFixed(4)}`);
      }
    }
  }
  // the report's number, and the law that made it
  const rareJewel = tally(ring, 'rare', true), oldJewel = tally(ring, 'rare', false);
  assert.equal(oldJewel.on('weight'), 1, 'the old law: carrying capacity on every Rare jewel (the last pick held to the empty prefix)');
  assert.ok(rareJewel.on('weight') > 0.06 && rareJewel.on('weight') < 0.085, `carrying capacity on ${rareJewel.on('weight')} of Rare jewels - 3.5 lines in 49`);
  const magicJewel = tally(ring, 'magic', true);
  assert.ok(tally(ring, 'magic', false).on('weight') > 0.33, 'the old law: a Magic jewel\'s one kind in four');
  assert.ok(magicJewel.on('weight') > 0.022 && magicJewel.on('weight') < 0.04, `carrying capacity on ${magicJewel.on('weight')} of Magic jewels - 1.5 lines in 49`);
  const rareArmour = tally(cuirass, 'rare', true);
  assert.ok(tally(cuirass, 'rare', false).on('weight') > 0.55, 'the old law: carrying capacity on most Rare armour');
  assert.ok(rareArmour.on('weight') > 0.045 && rareArmour.on('weight') < 0.075, `carrying capacity on ${rareArmour.on('weight')} of Rare armour`);
});

test('AFFIX-LINES: one roll a pick, as `pick` took (LOOT1) - the roll\'s place lands on a line, a kind weighed by the lines it may still give; every mint draws as many rolls under either law', () => {
  const counted = (values) => { let n = 0; const f = () => values[n++ % values.length]; f.n = () => n; return f; };
  const jewel = ring();
  const linesOf = (id) => LR.drawWeight(id, jewel);
  for (const r of [0, 0.01, 0.5, 0.99]) {
    const rolls = counted([r]);
    LR._pickByLinesForTests(['weight', 'stat', 'resist', 'skill'], linesOf, rolls);
    assert.equal(rolls.n(), 1, 'one roll');
  }
  // weight 1, stat 8: the first ninth is carrying capacity's, the rest the attributes'
  const two = (r) => LR._pickByLinesForTests(['weight', 'stat'], linesOf, () => r);
  assert.deepEqual([0, 0.11, 0.112, 0.5, 0.999].map(two), ['weight', 'weight', 'stat', 'stat', 'stat']);
  // a kind with no line to give is never drawn - past the last weight's rounding, the last kind that has one
  assert.equal(LR._pickByLinesForTests(['weight', 'stat'], (id) => (id === 'weight' ? 1 : 0), () => 1), 'weight');
  assert.equal(LR._pickByLinesForTests(['stat', 'weight'], (id) => (id === 'weight' ? 1 : 0), () => 0), 'weight');
  // the lines a kind may still give: its params no held line names, or one for a kind without
  const sevenStats = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed'].map((param) => ({ id: 'stat', param, value: 3 }));
  assert.deepEqual([LR.kindLines('stat', jewel, sevenStats), LR.kindLines('stat', jewel), LR.kindLines('weight', jewel, [{ id: 'weight', value: 20 }]), LR.kindLines('weight', jewel)], [1, 8, 0, 1]);
  assert.equal(LR.kindLines('stat', gown()), 1, 'a garment\'s Personality alone');
  assert.deepEqual([LR.drawWeight('elemental', sword()), LR.drawWeight('stat', sword()), LR.drawWeight('elemental', sword(), [{ id: 'elemental', param: 'fire', value: 3 }])], [1, 8, 1],
    'a line that does something weighs one while it has a flavour to give - the proc pass\'s even draw');
  // the whole mint: a roll for the count, then each line's - the lean (its first, where the group has its own number: a
  // lean taken is the pick), the pick, the value, the param - under the new law as the old; only where the pick lands moved
  for (const [make, own] of [[ring, null], [cuirass, 'armor'], [sword, 'damage'], [gown, 'standing']]) {
    for (const tier of ['magic', 'rare']) {
      for (const byLines of [true, false]) {
        for (let s = 0; s < 400; s++) {
          const base = seededRng(seedOf(s));
          const seen = [];
          const rolls = () => { const r = base(); seen.push(r); return r; };
          const out = LR.rollAffixes(make(), tier, rolls, { byLines });
          const n = seen.length;
          const leaned = own != null && seen[1] < 0.5;   // the count's roll, then the lean's
          const want = 1 + (own ? 1 : 0) - (leaned ? 1 : 0) + out.reduce((k, a) => k + 2 + (LR.AFFIX_KINDS[a.id].params ? 1 : 0), 0);
          assert.equal(n, want, `${make().group} ${tier} ${byLines ? 'new' : 'old'} law, seed ${s}: ${n} rolls`);
        }
      }
    }
  }
});

test('AFFIX-LINES: the mint version - a record of 0 or 1 mints the old law\'s piece, one of 2 the new; a loot door the new; the old law\'s Rare names both parts', () => {
  assert.deepEqual([MINT_V_LAST_PASS, MINT_V_LINES, MINT_VERSION], [1, 2, 2], 'the craft stamps the lines\' law');
  const weapons = RECIPES.filter((r) => ['weapon', 'plate', 'shield'].includes(r.kind));
  let moved = 0;
  for (let i = 0; i < 300; i++) {
    const r = weapons[i % weapons.length], q = 3 + (i % 2), tier = q === 3 ? 'magic' : 'rare', seed = seedOf(i + 500);
    const door = (byLines, pass) => {
      const rolls = seededRng(seed >>> 0);
      const it = r.kind === 'weapon' ? weaponOfMaterial(r.templateIndex, r.material) : armorOfMaterial(r.templateIndex, r.material);
      LR.applyRarity(it, tier, rolls, null, { byLines });
      if (pass) LR.lastPass([it], rolls, { on: true });
      return it.affixes;
    };
    const mint = (version) => mintPiece({ recipe: r.id, quality: q, seed, maker: null, version }, '0123456789abcdef');
    assert.deepEqual(mint(0).affixes, door(false, false), `${r.id} v0: the old law, no last pass`);
    assert.deepEqual(mint(1).affixes, door(false, true), `${r.id} v1: the old law, the last pass`);
    assert.deepEqual(mint(2).affixes, door(true, true), `${r.id} v2: the lines\' law, the last pass - a loot door\'s`);
    assert.deepEqual(LR.applyRarity(r.kind === 'weapon' ? weaponOfMaterial(r.templateIndex, r.material) : armorOfMaterial(r.templateIndex, r.material), tier, seededRng(seed >>> 0)).affixes, door(true, false), 'a loot door draws over the lines');
    if (JSON.stringify(mint(1).affixes) !== JSON.stringify(mint(2).affixes)) moved++;
  }
  assert.ok(moved > 150, `${moved} of 300 pieces moved by the law`);
  // the report's jewel: a crafted Masterwork ring wore carrying capacity always, and does not now
  const rings = RECIPES.filter((r) => r.kind === 'jewel' && r.id.startsWith('ring:'));
  let was = 0, now = 0;
  for (let i = 0; i < 1000; i++) {
    const r = rings[i % rings.length];
    const at = (version) => mintPiece({ recipe: r.id, quality: 4, seed: seedOf(i), maker: null, version }, '0123456789abcdef');
    if (at(1).affixes.some((a) => a.id === 'weight')) was++;
    if (at(2).affixes.some((a) => a.id === 'weight')) now++;
    const old = at(1);
    assert.ok(names(old, 'prefix') && names(old, 'suffix'), 'the old law: both name parts');
  }
  assert.deepEqual([was, now < 100], [1000, true], `a Masterwork ring with carrying capacity: ${was} of 1,000 before, ${now} now`);
});

test('AFFIX-LINES: the Exalted\'s line, a curse\'s and a reforge\'s are drawn over the lines too - each kind of its pool at its lines\' share, never the even draw\'s', () => {
  on();
  const skills = (n) => [...Array(n).keys()].map((param) => ({ id: 'skill', param, value: 12 }));
  const N = 4000;
  /** Each door's line over N seeds, on a jewel whose lines leave a known pool - the share of each kind it draws. */
  const draw = (door) => {
    const got = {};
    for (let s = 0; s < N; s++) { const id = door(s); if (id) got[id] = (got[id] ?? 0) + 1; }
    return got;
  };
  // THE EXALTED: a Legendary jewel carrying a skill alone - its pool every other kind the group may carry, the four that
  // do something one line each: carrying capacity 1, the attributes 8, the resistances 5, focus, cast speed, potency and
  // the wellspring 1 each - 18 lines, where the even draw gave each of the seven kinds one in seven
  const exalt = draw((s) => {
    const leg = known(LR.applyRarity(ring(), 'legendary', seededRng(seedOf(s))));
    leg.affixes = skills(1);
    return LR.exaltLegendary(leg, seededRng(seedOf(s + 50_000))) ? leg.affixes[1].id : null;
  });
  // THE CURSE: a Rare jewel of three skills - its pool the numbers it does not carry: 1, 8 and 5 - 14 lines, not three kinds
  const curse = draw((s) => {
    const rare = known(LR.applyRarity(ring(), 'rare', seededRng(seedOf(s))));
    rare.affixes = skills(3);
    return LR.cursePiece(rare, seededRng(seedOf(s + 90_000))) ? rare.affixes[3].id : null;
  });
  // THE REFORGE: an attribute replaced on a Rare jewel of two skills - carrying capacity 1, the resistances 5, the 33 skills
  // left - 39 lines, not three kinds
  const reforge = draw((s) => {
    const rare = known(LR.applyRarity(ring(), 'rare', seededRng(seedOf(s))));
    rare.affixes = [...skills(2), { id: 'stat', param: 'strength', value: 6 }];
    return LR.reforgeAffix(rare, 2, seededRng(seedOf(s + 3)))?.id ?? null;
  });
  for (const [door, got, lines] of [
    ['exalt', exalt, { weight: 1, stat: 8, resist: 5, focus: 1, castSpeed: 1, potency: 1, wellspring: 1 }],
    ['curse', curse, { weight: 1, stat: 8, resist: 5 }],
    ['reforge', reforge, { weight: 1, resist: 5, skill: 33 }],
  ]) {
    const total = Object.values(lines).reduce((n, w) => n + w, 0);
    assert.deepEqual(Object.keys(got).sort(), Object.keys(lines).sort(), `${door}: every kind of its pool, and no other`);
    assert.equal(Object.values(got).reduce((n, w) => n + w, 0), N, `${door}: a line every time`);
    for (const [id, w] of Object.entries(lines)) {
      const share = got[id] / N, want = w / total, sd = Math.sqrt(want * (1 - want) / N);
      assert.ok(Math.abs(share - want) < 4 * sd + 0.002, `${door}: ${id} ${share.toFixed(4)} of the lines, its share ${want.toFixed(4)}`);
    }
  }
});

test('REFORGE-REPLACE: the Reforge replaces - never the line\'s own kind, never a kind or param another line carries, a proc a proc; a Rare\'s line across its name\'s slots, the name following; any line, again and again, the item law finding nothing', () => {
  on();
  let gained = 0, lost = 0, rounds = 0;
  for (const make of [ring, cuirass, sword, gown]) {
    for (const tier of ['magic', 'rare']) {
      for (let s = 0; s < 120; s++) {
        const it = graded(make, tier, s);
        LR.addProcLine(it, seededRng(seedOf(s + 11)));
        for (let round = 0; round < 3; round++) {
          for (const i of LR.reforgeableLines(it)) {
            const old = it.affixes[i];
            const others = it.affixes.filter((_, k) => k !== i).map((a) => ({ ...a }));
            const prefixed = names(it, 'prefix');
            const n = LR.reforgeCount(it);
            const line = LR.reforgeAffix(it, i, seededRng(seedOf(s * 7 + i + round * 1000)));
            assert.ok(line && LR.validAffix(line), `${make().group} ${tier} ${s} line ${i}`);
            assert.notEqual(line.id, old.id, 'never the line\'s own kind');
            assert.deepEqual(it.affixes.filter((_, k) => k !== i), others, 'the other lines untouched');
            for (const a of others) assert.ok(!(a.id === line.id && (LR.AFFIX_KINDS[a.id].params ? a.param === line.param : true)), 'never a kind or param another line carries');
            assert.equal(!!LR.AFFIX_KINDS[line.id].proc, !!LR.AFFIX_KINDS[old.id].proc, 'a proc a proc, a number a number');
            assert.equal(it.name, LR.rarityName(it, tier, it.affixes), 'the name follows its lines');
            assert.equal(LR.reforgeCount(it), n + 1, 'counted');
            assert.deepEqual(itemFindings(it), [], `the item law finds nothing: ${JSON.stringify(it.affixes)}`);
            if (tier === 'rare' && !prefixed && names(it, 'prefix')) gained++;
            if (tier === 'rare' && prefixed && !names(it, 'prefix')) lost++;
            rounds++;
          }
        }
      }
    }
  }
  assert.ok(rounds > 5000, `${rounds} reforges`);
  assert.ok(gained > 50 && lost > 50, `a Rare's name gains its prefix (${gained}) and loses it (${lost}) as its line crosses the slot`);
  // the press's word: the piece's new name and its new line
  const piece = graded(cuirass, 'rare', 4);
  const me = { items: [piece, welkyndShards(99)], goldPieces: 99_999 };
  const done = RF.reforgePiece(piece, 0, me, seededRng(5));
  assert.equal(done.ok, true);
  assert.equal(REFORGED(piece.name, LR.affixLine(piece, 0)), `Reforged: ${piece.name} - ${LR.affixLine(piece, 0)}.`);
});

test('REFORGE-REPLACE: a line nothing else can take the place of is never offered - armour\'s thorns, a technique; a jewel\'s proc is (three kinds besides it)', () => {
  on();
  const plate = graded(cuirass, 'magic', 3);
  plate.affixes = [...plate.affixes, { id: 'thorns', value: 4 }];
  const thorns = plate.affixes.length - 1;
  const me = { items: [plate, welkyndShards(99)], goldPieces: 99_999 };
  assert.ok(!LR.reforgeableLines(plate).includes(thorns), 'thorns: armour\'s one proc - its own kind never comes back');
  assert.deepEqual([RF.reforgeRefusal(plate, thorns, me), essenceReforgeRefusal(plate, thorns), LR.reforgeAffix(plate, thorns, () => 0.5)], ['line', 'line', null]);
  assert.ok(LR.reforgeableLines(plate).length === thorns && RF.reforgeRefusal(plate, 0, me) === null, 'its numbers are');
  assert.equal(REFORGE_REFUSALS.line, 'No other kind of line can take its place');
  const jewel = graded(ring, 'rare', 8);
  jewel.affixes = [...jewel.affixes, { id: 'focus', value: 5 }];
  const focus = jewel.affixes.length - 1;
  assert.ok(LR.reforgeableLines(jewel).includes(focus));
  const line = LR.reforgeAffix(jewel, focus, () => 0.5);
  assert.ok(['castSpeed', 'potency', 'wellspring'].includes(line.id), `${line.id}: another of the jewel's four`);
  const blade = graded(sword, 'rare', 2);
  LR.addTechniqueLine(blade, () => 0.5, { id: 'leap' });
  const tech = blade.affixes.findIndex(LR.isTechniqueAffix);
  assert.ok(tech >= 0 && !LR.reforgeableLines(blade).includes(tech), 'a technique: only a technique may stand there');
  // the window: no press on a line the Reforge may not take, and the card's word on the price
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, { items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name, reforge: () => ({ ok: false }), salvage: () => ({ ok: false }) });
    try {
      const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
      kids(host, 'broker-offer')[0].onclick();
      const card = kids(host, 'reforge-card')[0];
      const rows = kids(card, 'reforge-line');
      assert.equal(rows.length, plate.affixes.length, 'every line shown');
      assert.equal(kids(rows[thorns], 'reforge-press').length, 0, 'thorns has no press');
      assert.equal(kids(card, 'reforge-press').length, thorns, 'each number its press');
      assert.equal(kids(card, 'reforge-note')[0].textContent, REFORGE_NOTE(RF.REFORGE_PRICE.magic));
      assert.match(REFORGE_NOTE(RF.REFORGE_PRICE.magic), /^A reforge costs 2 Welkynd Shards and 100 gold\. It always replaces the line with a different kind, and the price doubles with each reforge on this piece\.$/);
    } finally { view.unmount(); }
  });
});

test('REFORGE-REPLACE: the price rises - each reforge on a piece twice the last, at both doors, one roll; an old piece\'s one-line mark is a reforge counted, never a lock; the count stops at its bound', () => {
  on();
  const magic = graded(sword, 'magic', 1), rare = graded(cuirass, 'rare', 2);
  const ex = LR.applyRarity(sword(), 'legendary', seededRng(3));
  known(ex);
  assert.ok(LR.exaltLegendary(ex, seededRng(4)));
  const me = { items: [magic, rare, ex, welkyndShards(999)], goldPieces: 10_000_000 };
  for (const [it, base, tier] of [[magic, RF.REFORGE_PRICE.magic, 'magic'], [rare, RF.REFORGE_PRICE.rare, 'rare'], [ex, RF.REFORGE_PRICE.exalted, null]]) {
    for (let k = 0; k < 4; k++) {
      const want = { shards: base.shards * 2 ** k, gold: base.gold * 2 ** k };
      assert.deepEqual(RF.reforgePrice(it), want, `${it.rarity}: reforge ${k + 1} at ${want.shards} shards`);
      if (tier) assert.equal(reforgeEssence(tier, LR.reforgeCount(it)), (tier === 'magic' ? 2 : 5) * 2 ** k, 'the Essence the same way');
      const lines = LR.reforgeableLines(it);
      const i = lines[k % lines.length];
      const shardsBefore = RF.shardsHeld(me.items), goldBefore = me.goldPieces;
      const r = RF.reforgePiece(it, i, me, seededRng(k + 1));
      assert.deepEqual([r.ok, r.price], [true, want], 'paid the price before it');
      assert.deepEqual([shardsBefore - RF.shardsHeld(me.items), goldBefore - me.goldPieces], [want.shards, want.gold]);
    }
  }
  // both doors one roll: the guild's (reforgePiece) and the Essence's (reforgeItem, the service's seed)
  for (let s = 0; s < 40; s++) {
    const a = graded(ring, 'rare', s + 100), b = structuredClone(a), c = structuredClone(a);
    const i = LR.reforgeableLines(a)[s % LR.reforgeableLines(a).length];
    const seed = seedOf(s);
    const one = reforgeItem(a, i, seed);
    const two = RF.reforgePiece(b, i, { items: [b, welkyndShards(9)], goldPieces: 9999 }, seededRng(seed >>> 0)).line;
    const three = LR.reforgeAffix(c, i, seededRng(seed >>> 0));
    assert.deepEqual([one, two], [three, three], 'one Reforge');
    assert.deepEqual([a, { ...b }], [c, c], 'the piece the same at either door');
  }
  // an old piece: the line it was locked to is one reforge counted, every line open, the mark folded into the count
  const old = graded(ring, 'rare', 9);
  old.reforged = 2;
  assert.deepEqual([LR.reforgeCount(old), RF.reforgePrice(old), reforgeEssence('rare', LR.reforgeCount(old))], [1, { shards: 8, gold: 800 }, 10]);
  assert.deepEqual(LR.reforgeableLines(old), old.affixes.map((_, i) => i), 'never a lock');
  assert.deepEqual(itemFindings(old), [], 'lawful as it was');
  LR.reforgeAffix(old, 0, seededRng(1));
  assert.deepEqual([old.reforges, 'reforged' in old, LR.reforgeCount(old), RF.reforgePrice(old)], [2, false, 2, { shards: 16, gold: 1600 }], 'the mark folded into the count');
  assert.deepEqual(itemFindings(old), []);
  // the bound: the count stops, and the price with it
  const worn = graded(ring, 'rare', 10);
  worn.reforges = LR.REFORGES_MAX;
  LR.reforgeAffix(worn, 0, seededRng(2));
  assert.deepEqual([worn.reforges, validLootItem(worn)?.reforges], [LR.REFORGES_MAX, LR.REFORGES_MAX], 'never past the field\'s bound');
});

test('REFORGE-REPLACE: the count is the Reforge\'s mark - the item law holds it to the tiers the Reforge takes, the Gilded rung and a record\'s mint never carry it', () => {
  on();
  const rare = graded(ring, 'rare', 1);
  LR.reforgeAffix(rare, 0, seededRng(1));
  assert.deepEqual([rare.reforges, itemFindings(rare)], [1, []], 'a Rare reforged is lawful');
  const ex = known(LR.applyRarity(ring(), 'legendary', seededRng(2)));
  LR.exaltLegendary(ex, seededRng(3));
  LR.reforgeAffix(ex, LR.reforgeableLines(ex)[0], seededRng(4));
  assert.deepEqual([ex.reforges, itemFindings(ex)], [1, []], 'an Exalted reforged is lawful');
  const leg = known(LR.applyRarity(ring(), 'legendary', seededRng(2)));
  assert.deepEqual(itemFindings(leg), []);
  assert.ok(itemFindings({ ...leg, reforges: 1 }).includes('reforged'), 'a Legendary no Exalted was never reforged');
  const plain = ring();
  assert.deepEqual(itemFindings(plain), []);
  assert.ok(itemFindings({ ...plain, reforges: 1 }).includes('rarity'), 'a piece of no tier carries no tier\'s mark');
  // a made piece reforged is not as its record mints it - the market never sells the record's piece for it
  const made = () => mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 9 }, '0123456789abcdef');
  assert.equal(asMinted(made()), true);
  const a = made();
  LR.reforgeAffix(a, 0, seededRng(1));
  assert.deepEqual([a.reforges, asMinted(a)], [1, false], 'counted, and off the market');
  assert.equal(asMinted({ ...made(), reforged: 0 }), false, 'an old mark the same');
  // the Gilded rung's piece is its record's, and a count on it a forgery (the Reforge never takes one)
  const hourlock = mintHourlock();
  assert.equal(validGildedMarks(hourlock), hourlock);
  assert.deepEqual([validGildedMarks({ ...hourlock, reforges: 1 }), RF.reforgePrice(hourlock), LR.reforgeableLines(hourlock)], [null, null, []]);
});
