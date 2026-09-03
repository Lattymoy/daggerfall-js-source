import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EFFECT_COST_TABLE } from '../src/systems/spellcost.js';
import { flagLines } from '../tools/flagSites.mjs';   // IN1: the ONE definition of an open-flag site

// AUDIT 18 - the DOC-TRUTH sweep.
//
// The bible is load-bearing: AUDIT 17m proved that a false "recorded in the
// Ledger" claim actively hid a live defect from the person checking whether
// it was known. These pins are the mechanical half of that audit's fix -
// every claim corrected there is held by a check here, and every check is
// TWO-WAY: it fails if the correction is reverted AND it fails the next time
// a slice makes the same claim false again.
//
// bible/ has zero execution coverage and cannot be "run", so most of these
// are source sweeps over the tree the doc is making claims about (the idiom
// this repo already uses for the scene hosts). Where real code can settle a
// doc claim it is imported instead of grepped - see the spell-cost pin.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const lines = (p) => read(p).split('\n');

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, ext, out);
    else if (entry.endsWith(ext)) out.push(rel);
  }
  return out;
}

const SRC_FILES = walk('src', '.js');
const BIBLE_FILES = walk('bible', '.md');

// ---------------------------------------------------------------------------
// 1. Home.md's open-flags list resolves - every citation, on the exact line.
// ---------------------------------------------------------------------------

const FLAG_ENTRY = /^- `(src\/[^`:]+):(\d+)` - (.*)$/;

/** The doc quotes the source line trimmed, optionally with its `// ` gone,
 *  and may truncate with a trailing "...". */
function citationMatches(rawLine, quoted) {
  const trimmed = rawLine.trim();
  const candidates = [trimmed, trimmed.replace(/^\/\/\s*/, '')];
  const truncated = quoted.endsWith('...');
  const want = truncated ? quoted.slice(0, -3) : quoted;
  return candidates.some((c) => (truncated ? c.startsWith(want) : c === want));
}

test('AUDIT 18: every open-flags citation in Home.md points at the line it quotes', () => {
  const home = lines('bible/Home.md');
  const wrong = [];
  let seen = 0;
  for (const l of home) {
    const m = FLAG_ENTRY.exec(l);
    if (!m) continue;
    seen++;
    const [, file, no, quoted] = m;
    if (!existsSync(join(root, file))) { wrong.push(`${file}:${no} - file does not exist`); continue; }
    const src = lines(file);
    if (!citationMatches(src[Number(no) - 1] ?? '', quoted.trim())) {
      const real = src.map((s, i) => (citationMatches(s, quoted.trim()) ? i + 1 : 0)).filter(Boolean);
      wrong.push(`${file}:${no} quotes "${quoted.trim()}" - really at ${real.join(',') || '(nowhere)'}`);
    }
  }
  // Guard against the list silently emptying out - a regex that stopped
  // matching would make this test vacuous. Deliberately NOT an exact count:
  // the BOTH-ways rule below already pins the list and src/ to exact
  // agreement, and a hard number here is one more thing to rot (AUDIT 21
  // found Testing.md still quoting 109 when the list had reached 115).
  // The floor is a floor: the Road-to-1:1 closeout retired 96 flags in
  // one afternoon (145 -> 53) and Wave D took it to 17, and a floor set at the old population
  // would have punished the retirement (CR-35's lesson).
  assert.ok(seen >= 5, `only ${seen} open-flag citations parsed - the list or its format changed`);
  assert.deepEqual(wrong, [], `stale open-flags citations:\n${wrong.join('\n')}`);
});

test('AUDIT 18: the open-flags list and the FLAGGED/INTERIM sites in src/ agree BOTH ways', () => {
  // IN1: the rule for "is this line a flag?" is imported, not copied.
  // This guard carried its own `/FLAGGED|INTERIM/` and the tool carried
  // another, which is two rules the day one of them moves - and one
  // moved: the guard went red the moment the tool learned that an
  // identifier and a quotation are not open work. One home, both sides.
  const inSrc = new Set();
  for (const f of SRC_FILES) {
    for (const n of flagLines(readFileSync(join(root, f), 'utf8'))) inSrc.add(`${f}:${n}`);
  }
  const inDoc = new Set();
  for (const l of lines('bible/Home.md')) {
    const m = FLAG_ENTRY.exec(l);
    if (m) inDoc.add(`${m[1]}:${m[2]}`);
  }
  const missing = [...inSrc].filter((s) => !inDoc.has(s));
  const extra = [...inDoc].filter((s) => !inSrc.has(s));
  assert.deepEqual(missing, [], `flagged in src/ but absent from Home.md's list:\n${missing.join('\n')}`);
  assert.deepEqual(extra, [], `listed in Home.md but not flagged in src/:\n${extra.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 2. The bible may not name a module that is not there.
// ---------------------------------------------------------------------------

test('AUDIT 18: every src/ path the bible names in backticks exists (or is marked DELETED)', () => {
  const pathRef = /`((?:src|test|tools)\/[A-Za-z0-9_./-]+\.(?:js|mjs|md|json|html))(?::\d+(?:-\d+)?)?`/g;
  const bad = [];
  for (const f of BIBLE_FILES) {
    lines(f).forEach((l, i) => {
      for (const m of l.matchAll(pathRef)) {
        if (existsSync(join(root, m[1]))) continue;
        // A historical milestone record may still NAME a module that has
        // since been deleted - but it has to say so on the same line.
        if (/DELETED|RETIRED/.test(l)) continue;
        bad.push(`${f}:${i + 1} names ${m[1]}, which does not exist`);
      }
    });
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('AUDIT 18: Rendering.md\'s "Current (src/render/)" list is exactly src/render/', () => {
  const doc = lines('bible/07-Rendering/Rendering.md');
  const start = doc.findIndex((l) => l.startsWith('Current (`src/render/`)'));
  assert.ok(start >= 0, 'Rendering.md lost its Current (`src/render/`) heading');
  const listed = [];
  for (let i = start + 1; i < doc.length; i++) {
    const l = doc[i];
    if (l.trim() === '') break;
    const m = /^- `([A-Za-z0-9_.-]+\.js)`/.exec(l);
    if (m) listed.push(m[1]);
  }
  const real = readdirSync(join(root, 'src/render')).filter((f) => f.endsWith('.js'));
  assert.deepEqual(listed.slice().sort(), real.slice().sort(),
    'Rendering.md lists modules src/render/ does not have, or misses ones it does');
});

// ---------------------------------------------------------------------------
// 3. A section index may not contradict its own arc file.
// ---------------------------------------------------------------------------

test('AUDIT 18: no section index says "Not started" while its arc records a SHIPPED slice', () => {
  const bad = [];
  for (const f of BIBLE_FILES) {
    if (f.endsWith('-Arc.md') || f === 'bible/Home.md') continue;
    const arc = f.replace(/\.md$/, '-Arc.md');
    if (!existsSync(join(root, arc))) continue;
    // The status claim is the index's OPENING paragraph, not any later
    // correction note that quotes what it used to say.
    const opening = read(f).split(/\n\s*\n/).slice(0, 2).join('\n');
    if (/Not started/.test(opening) && /SHIPPED/.test(read(arc))) {
      bad.push(`${f} says "Not started" while ${arc} records SHIPPED work`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

// ---------------------------------------------------------------------------
// 4. The Ledger may not exempt code that has shipped.
// ---------------------------------------------------------------------------

/** Section C rows, split into struck (~~...~~ SHIPPED) and live ones. */
function ledgerSectionC() {
  const doc = lines('bible/01-Overview/Port-Ledger.md');
  const start = doc.findIndex((l) => l.startsWith('## C. DFU features not yet ported'));
  assert.ok(start >= 0, 'Port-Ledger lost its section C heading');
  const rows = [];
  for (let i = start + 1; i < doc.length; i++) {
    const l = doc[i];
    if (l.startsWith('## ')) break;
    if (!l.startsWith('|') || /^\|\s*-+/.test(l) || /^\| What \|/.test(l)) continue;
    rows.push({ line: i + 1, text: l, struck: l.startsWith('| ~~') });
  }
  assert.ok(rows.length > 20, `only ${rows.length} Ledger C rows parsed - the table format changed`);
  return rows;
}

test('AUDIT 18: Ledger C does not list breath/drowning + the crouch motor, which P12 shipped', () => {
  // The code half of the claim, checked first so the pin cannot pass by
  // asserting a string about a feature that quietly went away.
  const dungeon = read('src/scenes/dungeonContext.js');
  assert.match(dungeon, /function breathTick/, 'P12 breathTick is gone from dungeonContext.js');
  assert.match(dungeon, /breathStep/, 'P18: dungeonContext no longer drives the extracted breath clause');
  assert.match(read('src/systems/breath.js'), /currentBreath/, 'the P12/P18 breath clause is gone from systems/breath.js');
  assert.match(read('src/systems/save.js'), /currentBreath/, 'save.js no longer persists currentBreath');
  assert.match(read('src/ui/hud.js'), /breathShort|breathNormal/, 'hud.js no longer draws the breath bar');
  assert.match(read('src/player/motor.js'), /CROUCH_HEIGHT/, 'the P12 crouch motor is gone from motor.js');

  const live = ledgerSectionC().filter((r) => !r.struck);
  const offenders = live.filter((r) => /Breath\/drowning/.test(r.text));
  assert.deepEqual(offenders.map((r) => `Port-Ledger.md:${r.line}`), [],
    'Ledger C lists breath/drowning as unported while P12 ships it - live code inside the "not yet ported" exemption');
  // ...and the row it replaced must still record what genuinely remains.
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /PlayerHeightChanger/,
    'the P12 residue (the timed crouch transition) lost its Ledger row');
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /Argonian breath refund/,
    'the P12 residue (the Argonian breath refund) lost its Ledger row');
});

test('AUDIT 18: Audio.md does not close the activation-sound row on a clip we do not have', () => {
  const clips = read('src/systems/soundClips.js');
  const audio = read('bible/08-Audio/Audio.md');
  const havePick = /ActivateLockUnlock|\b316\b/.test(clips);
  if (!havePick) {
    assert.doesNotMatch(audio, /both already ours/,
      'Audio.md still claims both PlayerActivate clips are ours; ActivateLockUnlock (316) is in neither soundClips.js nor any consumer');
    assert.match(audio, /ActivateLockUnlock[\s\S]{0,200}NOT OURS/,
      'Audio.md must say outright that ActivateLockUnlock is not ported');
    // ...and the mechanic that plays it has to be somewhere in the Ledger.
    assert.match(read('bible/01-Overview/Port-Ledger.md'), /ActivateLockUnlock/,
      'the unported clip has no Ledger row to live on');
  }
  // PlayerDoorBash is ours, and it is 7 - Audio.md used to call it "28".
  assert.match(clips, /PlayerDoorBash: 7/);
  assert.doesNotMatch(audio, /the bash 28/);
});

test('AUDIT 18: Ledger B no longer records the 0-hour rest as a preserved DFU quirk', () => {
  const ledger = read('bible/01-Overview/Port-Ledger.md');
  // DaggerfallRestWindow.Update tests hoursRemaining < 1 BEFORE TickRest, so
  // DFU ends a 0-hour rest at once. The old row asserted the opposite.
  assert.doesNotMatch(ledger, /hoursRemaining < 1 is only tested after an hour completes/);
  assert.doesNotMatch(ledger, /a 0-hour timed\/loiter request rests ONE full hour/);
  assert.match(ledger, /DaggerfallRestWindow\.Update/,
    'the correction must cite the C# that settles it, not just delete the sentence');
  // The half of that row that IS true must survive the deletion.
  assert.match(ledger, /waitTimePerHour \/\n?\s*minutesPerTick/,
    'the sub-tick-divisor quirk is verified true and must stay ledgered');
});

test('AUDIT 18: source comments that cite the Ledger cite a row that exists', () => {
  // The 17m shape. Both of these read "recorded in the Ledger"/"Ledger B"
  // while Port-Ledger.md said nothing about them.
  const ledger = read('bible/01-Overview/Port-Ledger.md');
  if (/recorded in the\n?\s*\*?\s*Ledger/.test(read('src/ui/chargen.js'))) {
    assert.match(ledger, /isCustom/,
      'ui/chargen.js says the isCustom quirk is recorded in the Ledger; no such row exists');
  }
  if (/Ledger B/.test(read('src/characters/encounterTables.js'))) {
    assert.match(ledger, /Cemetery/,
      'encounterTables.js cites Ledger B for the dead Cemetery block; no such row exists');
  }
});

test('AUDIT 18: the enemy-boots armour quirk is ledgered wherever the pass lives', () => {
  // EnemyEntity.cs:414 walks Head..Feet with a STRICT `<`, so an enemy's
  // boots never touch ArmorValues[Feet]. The port computes that pass, so the
  // quirk has to be on the page one way or the other - it was on neither.
  const eq = read('src/combat/enemyEquipment.js');
  assert.match(eq, /armorValues/, 'the enemy armour-value pass moved out of enemyEquipment.js');
  assert.match(eq, /Boots/, 'enemyEquipment.js no longer rolls boots at all - re-read ItemHelper.cs:1452');
  const ledger = read('bible/01-Overview/Port-Ledger.md');
  assert.match(ledger, /ENEMY BOOTS never reduce ArmorValues\[Feet\]/,
    'the SetEnemyEquipment Feet-slot quirk has no Ledger row');
  assert.match(ledger, /EquipSlots\.Feet/,
    'the row must carry the C# that settles it, not just the assertion');
});

test('AUDIT 18: the Ledger does not blame a missing subsystem for Athleticism', () => {
  // Both consumers ship: skills.jumpSpeedMultiplier and the per-minute
  // fatigue drain. The flag is unread, which is a different defect from
  // "the consuming subsystem does not exist".
  assert.match(read('src/systems/skills.js'), /export function jumpSpeedMultiplier/);
  assert.match(read('src/systems/rest.js'), /Athleticism/);
  const ledger = read('bible/01-Overview/Port-Ledger.md');
  const inertClause = /INERT, because the consuming subsystem does not exist:([^.|]*)/.exec(ledger);
  assert.ok(inertClause, 'the U20b career-flag row lost its INERT list');
  assert.doesNotMatch(inertClause[1], /Athleticism/,
    'Athleticism is listed as inert "because the consuming subsystem does not exist" - both consumers ship');
});

// ---------------------------------------------------------------------------
// 5. Doc claims settled by importing the code they describe.
// ---------------------------------------------------------------------------

test('AUDIT 18: Systems-Arc only claims a spell-cost row that spellcost.js actually has', () => {
  const doc = read('bible/06-Systems/Systems-Arc.md');
  const claimsRow = /already in the S10\n?\s*cost table/.test(doc);
  const hasRow = Object.prototype.hasOwnProperty.call(EFFECT_COST_TABLE, '4,2');
  assert.equal(claimsRow, hasRow,
    hasRow
      ? 'spellcost.js now has the 4,2 DamageSpellPoints row - Systems-Arc.md should say so'
      : 'Systems-Arc.md claims DamageSpellPoints (4,2) is already in the S10 cost table; EFFECT_COST_TABLE has no such key, so those spells fall through to the zero-component fudge');
  if (!hasRow) {
    assert.match(doc, /zero-component fudge/,
      'the correction must say what happens instead, not merely drop the false claim');
  }
});

// ---------------------------------------------------------------------------
// 6. Self-retiring pins: a doc claim that is only false while the code is.
//    Each of these stops asserting the moment the code fix lands.
// ---------------------------------------------------------------------------

test('AUDIT 18: Home.md does not call the port desktop-only while the touch layer ships', () => {
  const hosts = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js'];
  const wired = existsSync(join(root, 'src/ui/touch.js')) && hosts.every((h) => /attachTouch\(/.test(read(h)));
  assert.ok(wired, 'the touch layer is no longer wired into all four hosts - re-read Port-Doctrine.md:19 before editing Home.md');
  const home = read('bible/Home.md');
  // Scoped to the ground rules themselves: the Audits section below quotes
  // the retired sentence on purpose, as the record of what was fixed.
  const rules = home.slice(home.indexOf('## Ground rules carried from project-final'));
  assert.doesNotMatch(rules, /Desktop-only\.\s*No touch controls/,
    "Home.md's ground rules contradict Port-Doctrine.md and the code");
  assert.match(rules, /touch layer/,
    'deleting the false rule is not enough - the ground rules must state the true one');
});

test('AUDIT 18 / U42: the spellbook fallback is GONE, and UI-Arc says so', () => {
  // AUDIT 18 wrote this as a LATCH: while ui/inventory.js's
  // `knownSpells` still fell through to "every ranged damage spell in
  // SPELLS.STD", UI-Arc was forbidden from closing the starting-spell
  // row and required to name the fallback. U42 deleted the fallback,
  // which turned the latch's condition permanently false - and a latch
  // that can never fire reads as coverage while checking nothing.
  //
  // So it is inverted, the way U25's inventory pin was inverted at
  // U26: the pin now asserts the fallback is gone from EVERY module
  // that could hold it, that no host reaches for it, and that the
  // Queue row is closed with the reason. It goes red if anyone
  // reintroduces a "list something plausible when the book is empty"
  // arm, which is the failure the latch was really guarding.
  for (const f of SRC_FILES) {
    assert.equal(/INTERIM fallback/.test(read(f)) && /knownSpells/.test(read(f)), false,
      `${f} carries the interim known-spells fallback again`);
    assert.equal(/export function knownSpells/.test(read(f)), false,
      `${f} declares knownSpells again - the book is playerEntity.spells and nothing else`);
  }
  const uiArc = read('bible/10-UI/UI-Arc.md');
  assert.match(uiArc, /CLOSED at U42: the fallback is DELETED/,
    'the Queue row must record WHY it closed, not merely close');
  // ...and RefreshSpellsList really is the only source now
  const book = read('src/ui/spellbookWindow.js');
  assert.match(book, /this\.deps\.spells\?\.\(\)/, 'the list reads the host-supplied book');
  assert.equal(/isDamageHealthEffect/.test(book), false, 'and never synthesises one');
});

test('AUDIT 18: exterior static NPCs are recorded as unwired while nothing calls them', () => {
  const importers = SRC_FILES.filter((f) => f !== 'src/characters/exteriorNpcs.js' && /exteriorNpcs\.js/.test(read(f)));
  if (importers.length === 0) {
    assert.match(read('bible/01-Overview/Port-Ledger.md'), /collectExteriorNpcs/,
      'collectExteriorNpcs has no production caller and no Ledger row - the gap lives only inside a "C2 SHIPPED" heading');
    assert.match(read('bible/04-Characters/Characters-Arc.md'), /NOTHING IN `src\/` CALLS\n?IT/,
      'Characters-Arc still presents the exterior NPC registry as live');
  }
});

test('AUDIT 18: Home.md does not list MAP.PAL as verified-fetched while nothing fetches it', () => {
  // The only namer of MAP.PAL is ImgFile.paletteName for TMAP00I0.IMG, and
  // the one loader of that file must ask for the palette by name.
  const fetchesByPaletteName = /paletteName/.test(read('src/ui/chargenArt.js'));
  if (!fetchesByPaletteName) {
    assert.match(read('bible/Home.md'), /MAP\.PAL is NOT/,
      "Home.md still counts MAP.PAL in the diet's verified live fetch surface; no code path fetches it");
  }
});

// ---------------------------------------------------------------------------
// AUDIT 21: the list is regenerated MECHANICALLY, and now that is true.
//
// Testing.md has said so for three audits and no such tool existed, so the
// list rotted on every host edit and three audits spent time hand-patching
// line numbers - each patch a chance to point a citation at the wrong line.
// tools/regenOpenFlags.mjs writes the list; this asserts the checked-in list
// is what the tool would write, so the two can never drift apart again.
// ---------------------------------------------------------------------------

test('AUDIT 21: bible/Home.md open-flags list matches the regenerator', () => {
  const r = spawnSync(process.execPath, [join(root, 'tools/regenOpenFlags.mjs'), '--check'],
    { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0,
    `${r.stderr || r.stdout}\nthe checked-in open-flags list is not what the tool produces - `
    + 'run: node tools/regenOpenFlags.mjs');
});

// ---------------------------------------------------------------------------
// U42: the two arc pages COUNT their own modules, and nothing checked the
// number.
//
// UI.md said 52 while `src/ui/` held 56, and Systems.md said 37 while
// `src/systems/` held 93 - the systems figure had been wrong by a factor of
// two and a half since the S arc's early slices, on a page whose whole job
// is to tell a reader how big the arc is. Both pages already carry a
// standing gate for their PROSE (the "Not started" latch above); this is
// the same gate for their arithmetic, and the failure message carries the
// real number so the fix is a copy rather than a recount.
// ---------------------------------------------------------------------------

test('U42: every arc page that counts its own modules counts them right', () => {
  const PAGES = [
    ['bible/10-UI/UI.md', 'src/ui'],
    ['bible/06-Systems/Systems.md', 'src/systems'],
  ];
  for (const [page, dir] of PAGES) {
    const real = readdirSync(join(root, dir)).filter((f) => f.endsWith('.js')).length;
    const doc = read(page);
    const m = doc.match(/(\d+) modules\s*\n?\s*live under\s*\n?\s*`(src\/[a-z]+)\/`/);
    assert.ok(m, `${page} lost its "N modules live under \`${dir}/\`" line`);
    assert.equal(m[2], dir, `${page} counts the wrong directory`);
    assert.equal(Number(m[1]), real,
      `${page} says ${m[1]} modules live under ${dir}/; there are ${real}`);
  }
});

// ---------------------------------------------------------------------------
// WM2h: NO CONFLICT MARKER REACHES THE BIBLE, in any file.
//
// This has now happened three times. "Repair: the previous merge went out
// with conflict markers in Testing.md" is in the log; manifest.test.js
// grew a marker check for THAT ONE FILE because of it; and then markers
// went out in Port-Ledger.md's windmill row, which another lane had to
// fix - and the row arrived back here NESTED, a conflict inside a
// conflict, because the resolution that shipped them was a regex over
// the markers rather than a reading of the two sides.
//
// A per-file guard was the wrong shape: the file that breaks next is the
// one nobody has broken yet. This is every tracked bible document, and it
// costs one walk.
// ---------------------------------------------------------------------------

test('WM2h: no bible document carries a merge conflict marker', () => {
  const bad = [];
  for (const f of BIBLE_FILES) {
    lines(f).forEach((l, i) => {
      if (/^(<{7}|={7}|>{7})(\s|$)/.test(l)) bad.push(`${f}:${i + 1} ${l.slice(0, 40)}`);
    });
  }
  assert.deepEqual(bad, [], `merge conflict markers in the bible:\n${bad.join('\n')}`);
});

// ---------------------------------------------------------------------------
// AUDIT 39: the tripwire the EV arc said was already here.
//
// Enhanced-Visuals-Arc.md's hard-constraints section told every following
// slice that this file pins Rendering.md's "directional light 0.45 +
// 0.55*diffuse", and EV5's own record leans on that pin - but no test in the
// repo held the string. The base term is not a GLSL literal a shader-text
// sweep could catch either: it is renderer.js's JS defaults, so a retune
// would leave Rendering.md stating a formula the renderer no longer had with
// the suite green. Both halves are pinned, so the doc and the defaults can
// only move together.
// ---------------------------------------------------------------------------

test('AUDIT 39: Rendering.md\'s "0.45 + 0.55*diffuse" base is the renderer\'s real defaults', () => {
  const doc = read('bible/07-Rendering/Rendering.md').replace(/\s+/g, ' ');
  assert.match(doc, /directional light 0\.45 \+ 0\.55\*diffuse/,
    'Rendering.md lost the base-lighting formula the EV arc treats as pinned');
  const r = read('src/render/renderer.js');
  assert.match(r, /this\._ambient = new Float32Array\(\[0\.45, 0\.45, 0\.45\]\);/,
    "the solid programs' ambient default moved - Rendering.md still says 0.45");
  assert.match(r, /this\._sunScale = 0\.55;/,
    "the solid programs' sun scale moved - Rendering.md still says 0.55");
});

// ---------------------------------------------------------------------------
// AUDIT 39: the index indexes.
//
// Home.md declares "Bible is flat under `bible/`. This file is the index",
// and the two newest audit records (Audit-DA, Audit-EV) were reachable only
// from the arc pages they close - a reader following the instruction reached
// AUDIT 38 and stopped. The gate is the same both-ways shape as the
// open-flags list: a new record must be indexed, and a renamed one cannot
// leave a dead row behind.
//
// CR-39 widened it from RECORDS NAMED "Audit-*" to every record under
// 01-Overview/, because the prefix was doing the work the law does: the
// road-to-1:1 campaign ledger and the 2026-09-01 incident record - whose
// four Standing lessons are binding process law - both slipped in
// unindexed while this test reported green. What is deliberately NOT
// indexed is an explicit list, so leaving a record out is a decision
// somebody writes down rather than a name that happens not to match.
// ---------------------------------------------------------------------------

/** Records under 01-Overview/ the index deliberately does not name. */
const UNINDEXED_RECORDS = [
  'Bible-Review-2026-08-25.md',   // a one-off review OF the bible, not a record of the port
  'Port-Completion-Analysis.md',  // superseded for volume figures by Port-Status-2026-09.md
];

test('AUDIT 39: Home.md names every record under bible/01-Overview/', () => {
  const home = read('bible/Home.md');
  const records = readdirSync(join(root, 'bible/01-Overview'))
    .filter((f) => f.endsWith('.md') && !UNINDEXED_RECORDS.includes(f)).sort();
  const missing = records.filter((f) => !home.includes(f));
  assert.deepEqual(missing, [],
    `records the index does not name:\n${missing.join('\n')}`);
  // the allow-list may not outlive its files either
  const gone = UNINDEXED_RECORDS.filter((f) => !existsSync(join(root, 'bible/01-Overview', f)));
  assert.deepEqual(gone, [], `the not-indexed list names files that are gone:\n${gone.join('\n')}`);
  const named = [...home.matchAll(/`01-Overview\/([A-Za-z0-9._-]+\.md)`/g)].map((m) => m[1]);
  const dead = [...new Set(named)].filter((f) => !records.includes(f) && !UNINDEXED_RECORDS.includes(f));
  assert.deepEqual(dead, [], `the index names records that are gone:\n${dead.join('\n')}`);
});

// ---------------------------------------------------------------------------
// AUDIT 39r: the five passages the fix wave outdated and did not correct.
//
// AUDIT 39 rewrote source and moved pins under five bible passages without
// touching the prose, so each page went on teaching the law its own suite had
// just reversed - the exact failure mode AUDIT 17m named, where a confident
// doc hides a live defect from the person checking whether it is known. Each
// pin below is TWO-WAY in this file's own idiom: it fails if the prose
// correction is reverted, AND it fails if the source it mirrors moves back.
// ---------------------------------------------------------------------------

test('AUDIT 39r: three pages teach the move-sound RE-ARM, not the resume', () => {
  // LycanthropyEffect.cs calls InitMoveSoundTimer at THREE sites - :67
  // (curse), :209 (post-fire) and :521, inside MorphSelf's transform
  // branch - so a partial wait is replaced at every morph, never resumed.
  assert.match(read('src/systems/lycanthropy.js'), /the third call site[\s\S]{0,200}entry\.moveSoundTimer = initMoveSoundTimer\(rolls\);/,
    'the port lost the morph-side re-arm the three pages now teach');

  const testing = read('bible/09-Testing/Testing.md');
  assert.ok(!testing.includes('morphing back mid-wait RESUMES rather than restarting'),
    'Testing.md is teaching the resume again');
  assert.ok(!testing.includes('THE TIMER IS ARMED AT THE CURSE, in Start (:67), not at the first transform'),
    'Testing.md is billing the curse as the only arming site again');
  assert.match(testing, /THE TIMER IS ARMED AT THREE PLACES/);

  const arc = read('bible/06-Systems/Systems-Arc.md').replace(/\s+/g, ' ');
  assert.ok(!arc.includes('returning later **resumes** it'), 'Systems-Arc LM1 is teaching the resume again');
  assert.match(arc, /The timer is armed at three places/);

  assert.match(read('bible/01-Overview/Port-Ledger.md'), /every morph INTO beast form \(:521/,
    "the ledger's vampirism row dropped the third call site again");
});

test('AUDIT 39r: the three re-read Testing.md rows agree with the suites they describe', () => {
  const testing = read('bible/09-Testing/Testing.md');

  // bss: ReadImageData short-reads rather than throwing (BssFile.cs:210-222)
  assert.ok(!testing.includes('a truncated body is a load failure that leaves no record behind'),
    'the bss row is refusing files the reference loads again');
  assert.match(read('test/bss.test.js'), /'a truncated body still loads'/);

  // the guard corpse's key is a minted id, and the walk-away is spliced
  assert.ok(!testing.includes('the `guards` array stays index-stable because lootTargets keys corpses by index'),
    'the lifetimes row is teaching index-stability again');
  const cg = read('src/scenes/cityGuards.js');
  assert.match(cg, /idOf: \(g\) => g\.id,/);
  assert.match(cg, /guards\.splice\(i, 1\);/);

  // ImprovesTalents(0) writes the enchantment fold both readers read
  assert.ok(!testing.includes('x1.5 only with the unported ImprovedAcuteHearing'),
    'the careerflags row is calling a shipped enchantment a routed gap again');
  assert.match(read('src/characters/enemySounds.js'), /entityImprovedAcuteHearing\(playerEntity\) \? 1\.5 : 1\.25/);
});

test('AUDIT 39r: Rendering-Arc\'s sky orientation is skyRenderer\'s, and the save/restore is gone from both', () => {
  const doc = read('bible/07-Rendering/Rendering-Arc.md').replace(/\s+/g, ' ');
  assert.ok(!doc.includes('azimuth 0 (+X, map east)'),
    'the arc is back to a 90-degree-wrong reference point (F56)');
  assert.match(doc, /azimuth 0 \(\+Z, map north\) starts the east half/);
  assert.ok(!doc.includes('program/state saved and restored around the pass'),
    'the arc is advertising the save/restore EV6 retired');
  const sky = read('src/render/skyRenderer.js');
  assert.match(sky, /Azimuth 0 \(\+Z, map north\) starts the east half/);
  assert.match(sky, /no program save\/restore/);
});

test('AUDIT 39r: the foreign-pass count is the real call-site count', () => {
  // F55 took overworldRenderer's getParameter/useProgram pair and moved
  // the seam onto the host, making the overworld map the FOURTH pass.
  assert.ok(!read('src/render/overworldRenderer.js').includes('CURRENT_PROGRAM'),
    'the overworld pass restores its own program again - it is not a foreign seam then');
  const hosts = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/ui/overworldMap.js']
    .reduce((n, f) => n + read(f).split('renderer.markForeignPass();').length - 1, 0);
  assert.equal(hosts, 7, 'seven host call sites across the six passes (GR1: the lab\'s grass is the fifth; TR1: the trees the sixth)');
  const ev = read('bible/07-Rendering/Enhanced-Visuals-Arc.md').replace(/\s+/g, ' ');
  assert.ok(!ev.includes('three passes change programs behind the renderer\'s back'),
    'the EV arc is counting three passes again');
  assert.match(ev, /six passes change programs behind the renderer's back/);
  assert.match(read('src/render/renderer.js').replace(/\s+/g, ' '),
    /the six passes \/\/ that change programs behind the renderer's back/);
});

test('AUDIT 39r: three arc pages stop advertising work the wave closed or disproved', () => {
  // the 64 is a real bound, not a pre-sizing detail
  assert.ok(!read('bible/02-Formats/Readers-Arc.md').includes('Structural-only simplification'),
    'Readers-Arc is calling the record bound structural-only again');
  assert.match(read('src/formats/cifRciFile.js'), /const MAX_WEAPON_RECORDS = 64;/);

  // the two shopStock pend clauses shipped (F129/F130)
  const sys = read('bible/06-Systems/Systems-Arc.md');
  assert.ok(!sys.includes('MagicItems stock SKIPPED'), 'the shopStock pend list names closed work again');
  assert.ok(!sys.includes("Alchemist's 25% potion recipe pends recipes"));
  assert.match(read('src/systems/shopStock.js'), /two clauses were struck from this list/);

  // ImprovesTalents(0)/(2) both decode into the fold their readers read
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /AUDIT 39 RETIRED THAT CLAUSE TOO/);
  const ench = read('src/systems/enchantments.js');
  assert.match(ench, /export const entityImprovedAcuteHearing =/);
  assert.match(ench, /export const entityImprovedAdrenalineRush =/);
});

test('WAVE D: two ACTIVE arc pages stop describing work this wave shipped', () => {
  // The arc pages are not frozen chronicles - this same wave retro-
  // edited dated paragraphs in both of them the moment a slice made
  // them false (UI-Arc's "dungeonContext WIRED since WAVE D",
  // Systems-Arc's FS1 section moved to "had"/"ran"/"was"). Three live
  // claims were missed, and each has a mechanical answer in the tree,
  // so pin them the two-way way AUDIT 18 pins everything: the sentence
  // may not come back, AND the facility that retired it must still be
  // there.
  const ui = read('bible/10-UI/UI-Arc.md');
  const sys = read('bible/06-Systems/Systems-Arc.md');

  // 1. D10 shipped the two large-HUD offsets, and tiered both live.
  assert.equal(/both settings stay read by nothing/.test(ui), false,
    'UI-Arc still records the two large-HUD offsets as read by nothing');
  const hud = read('src/ui/hudLarge.js');
  assert.match(hud, /export function horseOffsetHeight\(/);
  assert.match(hud, /export function weaponOffsetHeight\(/);
  const settings = read('src/systems/settings.js');
  assert.match(settings, /'GUI\/LargeHUDOffsetHorse': 'src\/ui\/hudLarge\.js'/);
  assert.match(settings, /'GUI\/LargeHUDUndockedOffsetWeapon': 'src\/ui\/hudLarge\.js'/);

  // 2. D4 built the fade layer, so no page may say the port has none.
  assert.equal(/fade layer the port does not have/.test(ui), false,
    'UI-Arc still says the fast-travel smash waits on a fade layer that exists');
  assert.match(read('src/ui/fadeLayer.js'), /smashHUDToBlack/);
  assert.match(read('src/ui/travelPopUp.js'), /hudFade\.smashHUDToBlack\(\);/);

  // 3. ...and Systems-Arc's TP1 section cited a pin for a claim that
  //    pin now REFUTES: travelguild.test.js used to assert both flags
  //    were still named as open, and now asserts they are gone.
  assert.equal(/The two flags that genuinely DO still idle/.test(sys), false,
    'Systems-Arc still says the two D4 flags idle, citing a pin that asserts the opposite');
  assert.match(read('test/travelguild.test.js'),
    /no fade layer in the port\/\.test\(unquoted\), false/,
    'the cited pin is the INVERTED one');
  assert.match(read('src/ui/travelPopUp.js'), /this\.isCloseWindowDeferred = true;/);
});
