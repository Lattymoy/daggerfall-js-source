// EF1 - THE EFFECT LIBRARY ANSWERS EXACTLY DAGGERFALL UNITY'S KEYS
// (2026-08-28). applySpell walks a spell's effect records and dispatches
// each to its family; a record no arm claims falls through to
// `out.skipped++`. That line carried the sentence "the library grows one
// family at a time" from the port's first magic slice to this one, and
// the sentence had gone stale without anyone measuring it.
//
// TWO THINGS CAME OUT OF MEASURING IT.
//
// The first: there is no gap. All 91 of DFU's classic keys land - the 82
// spelled as literals, plus ElementalResistance's five (8,0-8,4) and
// PacifyEffect's four (33,0-33,3), which build their keys from a loop
// variable and so are invisible to a grep for `MakeClassicKey(g, s)`.
// My own first count missed exactly those nine.
//
// The second, which is why this file exists as a PIN and not a note: the
// port answered 255 keys DFU has NO class for. The Teleport arm tested
// `e.type === 43` and never its subgroup, where DFU keys the class
// `MakeClassicKey(43, 255)` (Teleport.cs:51) - so every subgroup of
// group 43 raised the teleport marker and `continue`d past the counter.
// Its own comment read "(43,255)". Every other arm in the file tests
// `classicSub(e) === 255`; this one had lost it.
//
// A COVERAGE CLAIM MUST BE MEASURED FROM BOTH SIDES. "No key is missing"
// would have passed on the broken code - it was true. The defect was in
// the other direction, and only a pin that also asks "is any key ANSWERED
// that DFU does not define?" can see it. That is the sweep below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applySpell } from '../src/systems/effects.js';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const HERE = dirname(fileURLToPath(import.meta.url));

/** A one-effect spell record with every roll gate wide open. */
const eff = (type, subType) => ({
  type, subType,
  magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 10, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const mkTarget = () => ({
  level: 1, maxHealth: 100, health: 100, maxMagicka: 100, magicka: 50, maxFatigue: 100, fatigue: 100,
  career: {}, skills: new Array(40).fill(50),
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  activeEffects: [],
});
const SINKS = { hurt: () => {}, heal: () => {}, say: () => {}, drainFatigue: () => {}, restoreFatigue: () => {} };

/** Drive one classic key through applySpell and answer its `out`.
 *  rangeType 0 is CasterOnly, and the two bypass flags are set, so NO
 *  save, reflection, resistance or chance gate can `continue` past an
 *  arm and be mistaken for the family being absent. What is measured is
 *  dispatch alone. */
function drive(g, s) {
  return applySpell({ element: 0, rangeType: 0, effects: [eff(g, s)] }, 1, mkTarget(), SINKS,
    () => 0.5, { entity: mkTarget(), sinks: {} }, { bypassChance: true, bypassSavingThrows: true });
}
const handles = (g, s) => drive(g, s).skipped === 0;
/** EF1c: the same drive against a CALLER'S target, so the effect's
 *  residue can be inspected after the cast. */
function drive2(target, g, s) {
  return applySpell({ element: 0, rangeType: 0, effects: [eff(g, s)] }, 1, target, SINKS,
    () => 0.5, { entity: mkTarget(), sinks: {} }, { bypassChance: true, bypassSavingThrows: true });
}

test('EF1: the skip counter is DISCRIMINATING - a key no family owns is counted', () => {
  // THE CONTROL, FIRST. A coverage pin whose measurement cannot report
  // a miss proves nothing, and this one is cheap: keys outside the
  // classic space must reach the counter. Without this arm, an
  // `out.skipped` that had been accidentally wired to never increment
  // would make every assertion below pass vacuously.
  assert.equal(handles(99, 0), false, 'a group that does not exist');
  assert.equal(handles(7, 77), false, 'a real group, an unreal subgroup');
  assert.equal(handles(45, 255), false, 'one past the last classic group');
  assert.equal(drive(99, 0).skipped, 1, 'and the count is per-effect, not a flag');
});

test('EF1: Teleport is keyed (43,255) - the group alone does not answer', () => {
  // The defect this file was written for. DFU: Teleport.cs:51,
  // `properties.ClassicKey = MakeClassicKey(43, 255)`.
  const tele = drive(43, 255);
  assert.equal(tele.skipped, 0, '43,255 IS the teleport effect');
  assert.equal(tele.teleport, true, 'and a CasterOnly cast raises the host marker');
  // classic records store "no subgroup" as the signed byte -1, which
  // `classicSub` masks to 255 - the spelling the port's own teleport
  // fixtures use, and it must keep resolving to the same family.
  assert.equal(drive(43, -1).teleport, true, 'subType -1 masks to 255');
  // ...and every other subgroup of the group is NOT a teleport.
  for (const s of [0, 1, 42, 254]) {
    const out = drive(43, s);
    assert.equal(out.teleport, undefined, `43,${s} is not a teleport effect in DFU`);
    assert.equal(out.skipped, 1, `43,${s} has no effect class and must be counted as skipped`);
  }
});

// The DFU tree is an EXTERNAL reference (Port-Doctrine keeps it out of
// the repo, as ARENA2 is), so the regeneration arms below skip where it
// is absent - resolved through dfuRoot.mjs, which honours DFU_PATH.
const DFU_EFFECTS = dfuFile('Assets/Scripts/Game/MagicAndEffects/Effects/');
const noDfu = !existsSync(DFU_EFFECTS);

/** Every classic key DFU defines, read off the effect classes. */
function dfuClassicKeys() {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.cs')) files.push(p);
    }
  };
  walk(DFU_EFFECTS);
  const keys = new Map();
  // THE TWO FAMILIES A GREP CANNOT SEE. Both call MakeClassicKey with a
  // loop variable, not a literal - ElementalResistance.cs:194 over the
  // five DFCareer.Elements, PacifyEffect.cs:111 over the four
  // DFCareer.EnemyGroups. Reading only the literals undercounts DFU by
  // nine and would let nine real gaps through this pin.
  const VARIANTS = { 'ElementalResistance.cs': [8, 5], 'PacifyEffect.cs': [33, 4] };
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const name = f.pathname.split('/').pop();
    for (const m of src.matchAll(/MakeClassicKey\((\d+),\s*(?:\(byte\))?(\d+)\)/g)) keys.set(`${m[1]},${m[2]}`, name);
    const v = VARIANTS[name];
    if (v) for (let i = 0; i < v[1]; i++) keys.set(`${v[0]},${i}`, name);
  }
  return keys;
}

test('EF1: every DFU classic key REACHES a family - the library has no gap', { skip: noDfu }, () => {
  const dfu = dfuClassicKeys();
  assert.ok(dfu.size > 85, `found ${dfu.size} classic-keyed effect classes - the walk found the tree`);
  assert.ok(dfu.has('8,4') && dfu.has('33,3'), 'the two loop-keyed families are in the set');
  const gaps = [...dfu].filter(([k]) => {
    const [g, s] = k.split(',').map(Number);
    return !handles(g, s);
  }).map(([k, name]) => `${k} (${name})`).sort();
  assert.deepEqual(gaps, [],
    'these effect families exist in Daggerfall Unity and fall through applySpell to out.skipped');
});

test('EF1: and NO key outside DFU\'s set is answered - the sweep both ways', { skip: noDfu }, () => {
  // THE ARM THAT CAUGHT GROUP 43. The whole 256x256 classic key space,
  // driven through the real dispatcher; the set that does not skip must
  // be EXACTLY DFU's. An arm that widens past its own family shows up
  // here as an extra and nowhere else - the gap test above passes
  // happily while the port answers keys that do not exist.
  const dfu = dfuClassicKeys();
  const extra = [];
  for (let g = 0; g < 256; g++) {
    for (let s = 0; s < 256; s++) {
      if (dfu.has(`${g},${s}`)) continue;
      if (handles(g, s)) extra.push(`${g},${s}`);
    }
  }
  assert.deepEqual(extra, [],
    'applySpell claims these keys, but no Daggerfall Unity effect class defines them - an arm\n'
    + 'is testing its effect GROUP without its subgroup (the shape of the Teleport defect EF1 fixed)');
});

// ── EF1c: THE SENTENCES THE LIBRARY OUTGREW ─────────────────────────
// EF1 proved the library answers all 91 keys and retired the counter's
// flag. Four other sentences still deferred work to "the effect-library
// slice", and each was checked by RUNNING the thing it described rather
// than by reading around it:
//
//   dungeonContext.js - trap spells resolve "the classic damage-health
//     family... other effects FLAGGED to the effect-library slice".
//     M3 moved this host's missiles onto the shared cast engine, so a
//     landed bolt goes explodeAt / applySpellToPlayer -> applySpell.
//   spellcast.js header - a SCOPE note for a module that resolves no
//     effects at all; it owns the saving throw and the magnitude roll.
//   spellcast.js - ElementalResistance is a family "the effect library
//     has not reached, so nothing can raise one yet", written directly
//     above the function that sums the entries it says cannot exist.
//   spellcast.js - continuous damage as "instant application - the
//     rounds system pends the effect-library slice".
//
// The last two are pinned below by behaviour. THE LESSON IS THE FIRST
// ONE'S: a stale sentence is not one sentence. EF1 retired the flag on
// the counter and left the same claim in the module header four lines
// from the top, and these four besides. A claim usually has more than
// one home, so grep the claim, not the line.
import { tickActiveEffects } from '../src/systems/effects.js';
import { elementalResistanceChance, isDamageHealthEffect } from '../src/systems/spellcast.js';

test('EF1c: ElementalResistance (8,0..4) RAISES a resistance, per element', () => {
  const t = mkTarget();
  assert.equal(elementalResistanceChance(t, 0), 0, 'nothing resisted before the cast');
  const out = drive2(t, 8, 0);
  assert.equal(out.skipped, 0, 'the family lands');
  assert.equal(elementalResistanceChance(t, 0), 100, 'Fire is resisted after casting 8,0');
  // per-ELEMENT, not a blanket flag: the variant index IS the element
  // (ElementalResistance.cs:194 keys 8 + (byte)DFCareer.Elements).
  assert.equal(elementalResistanceChance(t, 1), 0, 'Frost is untouched by the Fire variant');
  const t2 = mkTarget();
  drive2(t2, 8, 4);
  assert.equal(elementalResistanceChance(t2, 4), 100, 'and the Magic variant resists Magic');
  assert.equal(elementalResistanceChance(t2, 0), 0);
});

test('EF1c: Continuous Damage Health (1,0) TICKS per round - it is not an instant hit', () => {
  const t = mkTarget();
  const hurt = [];
  const sinks = { hurt: (n) => hurt.push(n), heal: () => {}, say: () => {} };
  const out = applySpell({ element: 0, rangeType: 0, effects: [eff(1, 0)] }, 1, t, sinks,
    () => 0.5, null, { bypassChance: true, bypassSavingThrows: true });
  assert.equal(out.continuous, 1, 'it joins the round ticker rather than resolving whole');
  assert.equal(out.damage, 0, 'and none of it lands as direct damage');
  const entry = t.activeEffects.find((a) => a.kind === 'continuousDamage');
  assert.ok(entry, 'a continuousDamage entry is live on the target');
  // AssignBundle's "initial magic round" consumes round 1 at cast, so a
  // durationBase of 10 leaves 9 and the first tick has already been paid.
  assert.equal(hurt.length, 1, 'the INITIAL magic round fires at assignment');
  const before = entry.roundsRemaining;
  tickActiveEffects(t, sinks, () => 0.5);
  assert.equal(hurt.length, 2, 'and every round after it damages again');
  assert.equal(t.activeEffects.find((a) => a.kind === 'continuousDamage')?.roundsRemaining, before - 1);
  // the pair spellcast.js names is still exactly those two keys
  assert.equal(isDamageHealthEffect({ type: 4, subType: 0 }), true);
  assert.equal(isDamageHealthEffect({ type: 1, subType: 0 }), true);
  assert.equal(isDamageHealthEffect({ type: 1, subType: 1 }), false, 'ContinuousDamageFatigue is not the health pair');
});

test('EF1c: no source defers work to "the effect-library slice" any more', () => {
  // THE SOURCE SWEEP, the shape PY1's path pin and R6's bare-`this` pin
  // take: the rule "do not write that the library pends" is exactly the
  // kind the next reader breaks by copying a neighbouring header. Four
  // sentences said it; the sweep is what stops a fifth.
  //
  // IT BANS THE CLAIM AS AN ASSERTION, NOT AS A QUOTATION, and getting
  // that distinction right took two tries the campaign forced.
  //
  // Per LINE was the first attempt and it flagged EF1c's own
  // corrections, which quote the retired wording so the next reader can
  // see what was wrong; the quotes wrap across lines, so no same-line
  // exemption can tell quotation from assertion. Per BLOCK, exempting
  // any block naming EF1c, was the second - and the mutation campaign
  // killed it: a NEW "other effects pend the effect-library slice"
  // pasted into that same block SURVIVED, because one mention of the
  // slice bought the whole block a permanent pass. That is a sweep that
  // stops sweeping exactly where the next stale sentence would land.
  //
  // So: strip QUOTED spans from the block, then look for the claim in
  // what is left. A correction quotes the old wording; a defect states
  // it. (Banning the phrase outright was the other option and it is
  // worse - it makes the honest fix unwritable and teaches the next
  // person to launder the sentence instead of retiring it.)
  const SRC = join(HERE, '..', 'src');
  const CLAIM = /effect[- ]library slice|effect library has not reached/;
  // a quoted span may wrap lines, carrying `//` or `*` decoration
  const unquote = (s) => s.replace(/"[^"]*"/g, '""');
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const lines = readFileSync(p, 'utf8').split('\n');
      const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
      for (let i = 0; i < lines.length; i++) {
        if (!isComment(lines[i])) continue;
        let j = i;
        while (j + 1 < lines.length && isComment(lines[j + 1])) j++;
        const block = lines.slice(i, j + 1).join('\n');
        if (CLAIM.test(unquote(block))) {
          // report the first line whose own text still claims it once
          // the block's quotations are removed
          const rows = lines.slice(i, j + 1);
          const at = rows.findIndex((l, k) => CLAIM.test(unquote(rows.slice(0, k + 1).join('\n')).split('\n')[k] ?? ''));
          const hit = at >= 0 ? at : rows.findIndex((l) => CLAIM.test(l));
          offenders.push(`${relative(SRC, p)}:${i + hit + 1}: ${rows[hit].trim()}`);
        }
        i = j;
      }
    }
  };
  walk(SRC);
  assert.deepEqual(offenders, [],
    'the effect library answers all 91 of DFU\'s classic keys (EF1); a comment saying work\n'
    + 'waits on it is telling the next reader a gap exists where there is none');
});
