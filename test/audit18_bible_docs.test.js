import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EFFECT_COST_TABLE } from '../src/systems/spellcost.js';

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
  // The list existed with 109 entries at AUDIT 18; guard against it silently
  // emptying out (a regex that stops matching would make this test vacuous).
  assert.ok(seen >= 100, `only ${seen} open-flag citations parsed - the list or its format changed`);
  assert.deepEqual(wrong, [], `stale open-flags citations:\n${wrong.join('\n')}`);
});

test('AUDIT 18: the open-flags list and the FLAGGED/INTERIM sites in src/ agree BOTH ways', () => {
  const inSrc = new Set();
  for (const f of SRC_FILES) {
    lines(f).forEach((l, i) => { if (/FLAGGED|INTERIM/.test(l)) inSrc.add(`${f}:${i + 1}`); });
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
  assert.match(dungeon, /currentBreath/, 'P12 currentBreath is gone from dungeonContext.js');
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

test('AUDIT 18: UI-Arc does not claim the spellbook lists real spells while the fallback lives', () => {
  const fallbackLives = /INTERIM fallback/.test(read('src/ui/inventory.js'));
  const uiArc = read('bible/10-UI/UI-Arc.md');
  if (fallbackLives) {
    assert.doesNotMatch(uiArc, /SHIPPED via Systems S6 \(the spellbook lists\n?\s*the character's real known spells\)/,
      "UI-Arc's queue closes the starting-spell row on a claim ui/inventory.js contradicts");
    assert.match(uiArc, /INTERIM\n?\s*fallback/,
      'UI-Arc must name the fallback it used to paper over');
  }
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
