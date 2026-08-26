// AUDIT 26, misc group: two seams where a SHIPPED law was thrown away
// at the edge of the codebase - a dev tuner nothing could reach, and a
// villager's authored skin tone discarded by a lookup left over from an
// earlier era of the race table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTES, HUMAN_SKINS } from '../src/characters/palettes.js';
import { RACE_TONE as DESIGN_TONE, VILLAGER_DESIGNS } from '../src/characters/villagerDesigns.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viewerPath = join(root, 'src/tools/paperdollViewer.js');
const viewerSrc = readFileSync(viewerPath, 'utf8');

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test('audit26 misc F039: the C6L paint overlay is not a module nothing can reach', () => {
  // The overlay tuned the SPRITE-TRACE body sheets ({front,back}
  // ImageData + silhouette masks + rebuild()), and that rig is retired -
  // interiorContext builds the neutral paperdoll instead and produces no
  // sheets at all. So mountPaintOverlay had no possible caller and no
  // possible kit: 154 lines that could only ever be dead. It is gone
  // rather than left standing as an affordance nobody can take.
  assert.equal(
    existsSync(join(root, 'src/scenes/paintOverlay.js')), false,
    'src/scenes/paintOverlay.js is back - a mount for a rig that no longer exists',
  );
  const holders = walk(join(root, 'src'))
    .filter((p) => p.endsWith('.js') && /mountPaintOverlay/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(holders, [], 'something under src/ names mountPaintOverlay again');
});

// ── F134: the villager tone seam, executed ─────────────────────────
// paperdollViewer.js is a page module (it touches THREE and `document`
// at import), so the seam is lifted out of the shipped source TEXT and
// run against the real palettes and the real design table. A pin that
// re-implemented applyVillagerTone here would restate the port instead
// of testing it; this one executes the file's own bytes.
const cut = (name) => {
  const start = viewerSrc.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from paperdollViewer.js`);
  let depth = 0, i = viewerSrc.indexOf('{', start);
  for (let j = i; j < viewerSrc.length; j++) {
    if (viewerSrc[j] === '{') depth++;
    else if (viewerSrc[j] === '}' && --depth === 0) return viewerSrc.slice(start, j + 1);
  }
  throw new Error(`${name} has no closing brace`);
};
const decl = (re) => {
  const m = viewerSrc.match(re);
  assert.ok(m, `paperdollViewer.js no longer declares ${re}`);
  return m[0];
};

/** The seam under test, with the viewer's OWN tables, the real
 *  PALETTES payload and a recording document stub. */
function mountSeam(startRaceIx = 0) {
  const tables = [
    decl(/^const RACES = \[[^\]]*\];/m),
    decl(/^const RACE_FAMILY = \{[\s\S]*?\};/m),
    decl(/^const RACE_TONE = \{[\s\S]*?\};/m),
    decl(/^const PKEY = \{[^}]*\};/m),
    decl(/^const toneIx = .*;$/m),
  ].join('\n');
  const label = { textContent: '' };
  let synced = 0;
  const make = new Function('D', 'document', 'syncRace', 'startRaceIx', `
    let raceIx = startRaceIx;
    ${tables}
    ${cut('applyVillagerTone')}
    return { applyVillagerTone, toneIx, RACES, RACE_TONE, get raceIx() { return raceIx; } };
  `);
  // assigned, never spread - raceIx is a live getter over the seam's own
  // closure and a spread would freeze it at its starting value.
  const seam = make({ PALETTES }, { getElementById: () => label }, () => { synced++; }, startRaceIx);
  seam.label = label;
  seam.synced = () => synced;
  return seam;
}

test('audit26 misc F134: a villager tone lands on the design\'s OWN race', () => {
  // RACES carries the eight real races; the "Human" row the four-family
  // editor collapsed Breton/Redguard/Nord into is gone, so looking it up
  // answers -1 - RACES[-1] is undefined, applyTone's `if (!pal) return`
  // bails, and the design's authored tone is silently discarded.
  const seam = mountSeam();
  assert.equal(seam.RACES.includes('Human'), false, 'RACES is the eight-race table');

  // Every villager race and the tone it ships (villagerDesigns.js:296-299).
  const expect = { Redguard: 'Deep', Nord: 'Pale', Breton: 'Fair' };
  for (const [race, tone] of Object.entries(expect)) {
    assert.equal(DESIGN_TONE[race], tone, `${race} ships the ${tone} tone`);
    const ti = HUMAN_SKINS.findIndex((e) => e.name === tone);
    assert.ok(ti >= 0, `${tone} is a human palette entry`);
    seam.applyVillagerTone({ race, tone });
    assert.equal(seam.raceIx, seam.RACES.indexOf(race), `${race} selects its own rig race`);
    assert.equal(seam.toneIx[race], ti, `${race} takes the ${tone} tone index`);
    assert.equal(seam.label.textContent, `tone: ${tone}`, 'the tone control relabels');
  }
  // Deep is HUMAN_SKINS[5] and Pale is [0] - a Redguard and a Nord are
  // not the same skin, which is the whole point of the per-race tone.
  assert.deepEqual(
    [seam.toneIx.Redguard, seam.toneIx.Nord, seam.toneIx.Breton], [5, 0, 1],
    'the three human races resolve to three different palette rows',
  );
  assert.equal(seam.synced() >= 3, true, 'every selection re-syncs the race');
});

test('audit26 misc F134: the Guard keeps the viewer\'s race and deselect restores its default', () => {
  // The city watch spawns for ANY race, so its design carries no rig
  // race - it names a middle tone only. The viewer's own race stands.
  const seam = mountSeam(2);   // the viewer sitting on Nord (default tone Fair)
  assert.equal(seam.RACES[2], 'Nord');
  assert.equal(seam.RACE_TONE.Nord, 1, 'Nord defaults to the second human tone');
  assert.equal(DESIGN_TONE.Guard, 'Tan', 'the watch ships the middle tone');
  seam.applyVillagerTone({ race: 'Guard', tone: 'Tan' });
  assert.equal(seam.raceIx, 2, 'a non-rig race does not move the race pick');
  assert.equal(seam.toneIx.Nord, HUMAN_SKINS.findIndex((e) => e.name === 'Tan'), 'the tone still lands');
  assert.equal(seam.label.textContent, 'tone: Tan');
  // Deselecting restores the RACE's own default (RACE_TONE), not the
  // last villager's, and not a key ('Human') no reader ever looks at.
  seam.applyVillagerTone(null);
  assert.equal(seam.toneIx.Nord, 1, 'Nord falls back to its own default tone');
  assert.equal(seam.label.textContent, 'tone: Fair', 'the control shows the restored tone');
});

test('audit26 misc F134: the race and tone controls read the FAMILY palette', () => {
  // PKEY is keyed by family (Human/Elf/Khajiit/Argonian). Keyed by race -
  // the four-family era, where the two were the same word - it answers
  // undefined for all eight, so the race button never relabels the tone
  // and the tone button's `if(!pal)return` makes the control inert.
  const handlers = viewerSrc.match(/^document\.getElementById\('(race|tone)'\)\.onclick[^\n]*$/gm) || [];
  assert.equal(handlers.length, 2, 'the race and tone controls are still one line each');
  for (const h of handlers) {
    assert.ok(/PKEY\[RACE_FAMILY\[/.test(h), `a control indexes PKEY by race: ${h.slice(0, 80)}`);
    assert.equal(/PKEY\[(?!RACE_FAMILY)/.test(h), false, `a control still indexes PKEY by race: ${h.slice(0, 80)}`);
  }
  // and every family key a race maps to is a real palette.
  const seam = mountSeam();
  for (const R of seam.RACES) {
    const fam = { Breton: 'human', Redguard: 'human', Nord: 'human', 'High Elf': 'elf',
      'Wood Elf': 'elf', 'Dark Elf': 'elf', Khajiit: 'khajiit', Argonian: 'argonian' }[R];
    assert.ok(PALETTES[fam], `${R} has no family palette`);
    assert.ok(seam.toneIx[R] < PALETTES[fam].length, `${R}'s default tone is inside its palette`);
  }
  // and the design table names no race the viewer cannot place.
  for (const d of VILLAGER_DESIGNS) {
    assert.ok(seam.RACES.includes(d.race) || d.race === 'Guard', `${d.name} names race ${d.race}`);
  }
});
