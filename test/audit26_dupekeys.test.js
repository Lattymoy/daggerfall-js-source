// AUDIT 26, wave "duplicate-key guard".
//
// `{ toggleRest: A, ...200 chars..., toggleRest: B }` is legal JavaScript.
// The later key silently wins and A - a complete, correct code path - is
// dead. node --check accepts it, vite builds it, headless tests run it.
// Three live instances shipped this way (scenes/world.js, scenes/exterior.js,
// systems/settings.js), then two more (characters/paperdollPayload.js,
// world/rdbLayout.js). The structural cause: eslint.config.js enabled
// essentially only no-undef, so `no-dupe-keys` - which flags every one of
// them - was off.
//
// This file pins the guard itself (the rule must stay ON, and must actually
// fire) and the one behavioural fix the class produced:
//
//   paperdollPayload's Argonian tail was being shaded with `ramps.skin`,
//   sampled from BODY00I0.IMG. RaceTemplate.cs:183 assigns BODY00I0 to the
//   BRETON paper doll; the Argonian's body is BODY07I0.IMG
//   (RaceTemplate.cs:336) and the Khajiit's BODY06I0.IMG
//   (RaceTemplate.cs:315). DFU swaps the paper-doll body image per race
//   precisely because one race's body never carries another's colour, so
//   the tail takes the race hide ramp - which is what raceCharacter.js:48-49
//   shades the in-engine bake with.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildPaperdollPayload } from '../src/characters/paperdollPayload.js';
import { ARGONIAN_HIDES, KHAJIIT_FURS, HUMAN_SKINS } from '../src/characters/palettes.js';
import eslintConfig from '../eslint.config.js';

const GUARDED = ['no-dupe-keys', 'no-dupe-class-members', 'no-unsafe-negation'];

// --- the guard ------------------------------------------------------------

test('audit26 dupekeys: the guard rules are enabled as errors on src/', () => {
  const blocks = eslintConfig.filter((b) => (b.files || []).includes('src/**/*.js'));
  assert.ok(blocks.length > 0, 'eslint.config.js no longer configures src/**/*.js');
  const rules = Object.assign({}, ...blocks.map((b) => b.rules || {}));
  // no-undef is the leg that was already here; the three below are AUDIT 26's.
  for (const r of ['no-undef', ...GUARDED]) {
    assert.equal(rules[r], 'error', `${r} must be enabled as an error - it is the only thing standing between this defect class and main`);
  }
});

test('audit26 dupekeys: the configured rules actually fire', () => {
  // Static presence is not enough: lint a fixture through the REAL project
  // config and require each rule to report. Skips only if eslint is absent.
  const lint = (src) => {
    let out;
    try {
      out = execFileSync('npx', ['eslint', '--stdin', '--stdin-filename', 'src/__audit26_fixture__.js', '--format', 'json'],
        { cwd: new URL('..', import.meta.url).pathname, input: src, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      // eslint exits non-zero when it reports errors; that is the normal path.
      if (e.stdout) out = e.stdout; else return null;
    }
    try { return JSON.parse(out)[0].messages.map((m) => m.ruleId); } catch { return null; }
  };

  const cases = {
    'no-dupe-keys': 'export const o = { a: 1, b: 2, a: 3 };\n',
    'no-dupe-class-members': 'export class C { m() { return 1; } m() { return 2; } }\n',
    'no-unsafe-negation': 'export const f = (a, b) => !a in b;\n',
  };
  for (const [rule, src] of Object.entries(cases)) {
    const ids = lint(src);
    if (ids === null) { console.log(`(eslint unavailable - skipping the ${rule} fire check)`); continue; }
    assert.ok(ids.includes(rule), `${rule} did not fire on its fixture; reported: ${JSON.stringify(ids)}`);
  }
});

// --- the behavioural fix the guard surfaced -------------------------------

const colourSet = (pack) => {
  const s = new Set();
  for (let i = 0; i < pack.C.length; i += 3) s.add(pack.C.slice(i, i + 3).join(','));
  return s;
};
const rampSet = (ramp) => new Set(ramp.map((c) => c.join(',')));
const subset = (a, b) => [...a].every((v) => b.has(v));

test('audit26 dupekeys: the paperdoll tails are shaded from the RACE ramp, not BODY00I0', () => {
  // null pal/img/cif is the no-ARENA2 path: `ramps.skin` then falls back to
  // HUMAN_SKINS[1] ("Fair"), so a Breton-shaded tail is directly detectable.
  const D = buildPaperdollPayload(null, null, null);
  assert.ok(D.tail && D.tail.C.length > 0, 'D.tail must be packed');
  assert.ok(D.tailCat && D.tailCat.C.length > 0, 'D.tailCat must be packed');

  const argonian = rampSet(ARGONIAN_HIDES[0].ramp); // "Swamp" - tone 0, what raceCharacter.js bakes
  const khajiit = rampSet(KHAJIIT_FURS[0].coat);    // "Tabby" - tone 0
  const breton = rampSet(HUMAN_SKINS[1].ramp);      // the ramps.skin fallback

  assert.ok(subset(colourSet(D.tail), argonian),
    'the Argonian tail carries a colour outside ARGONIAN_HIDES[0] - it is being shaded from another race\'s body');
  assert.ok(subset(colourSet(D.tailCat), khajiit),
    'the Khajiit tail carries a colour outside KHAJIIT_FURS[0]');

  // The specific regression: not one Breton skin step anywhere on either tail.
  for (const [name, pack] of [['tail', D.tail], ['tailCat', D.tailCat]]) {
    for (const c of colourSet(pack)) {
      assert.ok(!breton.has(c), `D.${name} contains BODY00I0/Breton skin colour ${c} (RaceTemplate.cs:183 gives that body to the Breton, not to a beast race)`);
    }
  }
});

test('audit26 dupekeys: rdbLayout action doors carry exactly one position key', () => {
  // RDBLayout.cs:888/936 key the action-link dictionary by obj.Position and
  // LinkActionNodes (RDBLayout.cs:1094) resolves nextKey/prevKey against it,
  // so the door's chain key is `position`. It was written twice in the same
  // literal with the same value - harmless, but the same defect shape.
  const src = execFileSync('node', ['-e', 'process.stdout.write(require("fs").readFileSync("src/world/rdbLayout.js","utf8"))'],
    { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  const block = src.slice(src.indexOf('actionDoors.push({'), src.indexOf('objectPositions.set', src.indexOf('actionDoors.push({')));
  const hits = block.match(/^\s*position:/gm) || [];
  assert.equal(hits.length, 1, `the actionDoors literal declares \`position\` ${hits.length} times`);
});
