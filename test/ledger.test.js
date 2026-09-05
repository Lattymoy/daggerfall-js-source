// L2: the Port-Ledger's DERIVABLE figures, gated.
//
// The 2026-08-24 re-sweep found twenty stale rows in section C, and
// FOUR of them were wrong in their NUMBERS rather than their substance:
// "seventeen unbuilt guild service windows" when the real answer was
// two, "thirty unported effects" when it was six, "the only trace of
// banking is a weight constant" against a 419-line module. Prose has no
// way to notice that kind of drift, and it is the kind that most
// misleads - someone reading "seventeen windows to build" plans a very
// different week than someone reading "two".
//
// Every figure below is computable from a module. Stating it once in
// the ledger and pinning it here means the two cannot disagree
// silently: change the code and this fails until the doc is updated,
// and vice versa. That is the same contract manifest.test.js already
// holds over Testing.md's suite count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPELL_MAKER_EFFECTS } from '../src/systems/spellEffects.js';
import { SERVICE_DESTINATION } from '../src/systems/guildServiceFlow.js';
import { GENERATOR_VERSION } from '../src/world/roadsCache.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = readFileSync(join(ROOT, 'bible/01-Overview/Port-Ledger.md'), 'utf8');

/** The `{` positions still OPEN at `upto`, outermost first - the blocks
 *  a statement is nested inside. A hand scanner rather than a parse: it
 *  skips line and block comments and single/double/backtick strings,
 *  which is everything world.js puts braces inside of. */
function enclosingBraces(src, upto) {
  const stack = [];
  let i = 0, mode = 0, quote = '';
  while (i < upto) {
    const c = src[i], d = src[i + 1];
    if (mode === 1) { if (c === '\n') mode = 0; i++; continue; }
    if (mode === 2) { if (c === '*' && d === '/') { mode = 0; i += 2; continue; } i++; continue; }
    if (mode === 3) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) mode = 0;
      i++; continue;
    }
    if (c === '/' && d === '/') { mode = 1; i += 2; continue; }
    if (c === '/' && d === '*') { mode = 2; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = 3; quote = c; i++; continue; }
    if (c === '{') stack.push(i);
    else if (c === '}') stack.pop();
    i++;
  }
  return stack;
}

/** The whole line an index falls on. */
function lineAt(src, at) {
  const from = src.lastIndexOf('\n', at) + 1;
  const to = src.indexOf('\n', at);
  return src.slice(from, to === -1 ? src.length : to);
}

/** Read a "- <label>: **N**" bullet out of the gated block. */
function figure(label) {
  const m = LEDGER.match(new RegExp(`- ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}: \\*\\*(\\d+)\\*\\*`));
  assert.ok(m, `Port-Ledger.md is missing the gated figure "${label}"`);
  return Number(m[1]);
}

test('L2 ledger: the gated block exists and names its own test', () => {
  // If the block is renamed or dropped, the figures below stop being
  // gated silently - so the block's own presence is pinned first.
  assert.match(LEDGER, /### Derived figures \(GATED - `test\/ledger\.test\.js`\)/);
  assert.match(LEDGER, /Rows above may quote these figures but must not\s+restate them independently/,
    'the block states the rule that keeps rows from re-introducing drift');
});

test('L2 ledger: the effect catalog figures match the module', () => {
  const total = SPELL_MAKER_EFFECTS.length;
  const inert = SPELL_MAKER_EFFECTS.filter((e) => !e.ported).length;
  assert.equal(figure('SPELL_MAKER_EFFECTS rows'), total,
    `the ledger says ${figure('SPELL_MAKER_EFFECTS rows')} catalog rows, the module has ${total}`);
  assert.equal(figure('\\.\\.\\.of which still inert \\(no runtime arm\\)'), inert,
    `the ledger's inert count and the module's disagree (module: ${inert})`);
  // a sanity floor: the gate is worthless if it pins zero against zero
  assert.ok(total > 50 && inert >= 0 && inert < total, 'the figures are a real subset');
});

test('L2 ledger: the guild service figures match the module', () => {
  const all = Object.entries(SERVICE_DESTINATION);
  const open = all.filter(([, v]) => !v);
  assert.equal(figure('SERVICE_DESTINATION guild services'), all.length);
  assert.equal(figure('\\.\\.\\.of which still unbuilt \\(destination null\\)'), open.length,
    `the ledger's unbuilt count and the module's disagree (module: ${open.length} -> ${open.map(([k]) => k).join(', ')})`);
  assert.ok(all.length >= 20, 'DoGuildService has twenty arms; the map should not shrink');
});

test('L2 ledger: a superseded figure may be QUOTED but never left standing', () => {
  // The drift this gate exists to stop came from rows carrying their
  // own copy of a number that nothing checked. But a re-swept row
  // legitimately QUOTES the old figure while correcting it - "the
  // title said SEVENTEEN until the re-sweep" is history, not a claim.
  //
  // So the rule is per LINE (each table row is one line): a line that
  // mentions a superseded figure must ALSO carry a correction marker,
  // which is what turns a claim into a record. A blunt phrase ban
  // could not tell those apart and flagged the corrections themselves.
  const SUPERSEDED = [
    /SEVENTEEN/,
    /the port expands eleven/,
    /for 22 -/,
    /thirty/i,
  ];
  const MARKERS = /RE-SWEPT|STALE|Original text|re-sweep|~~/;
  const offenders = [];
  for (const line of LEDGER.split('\n')) {
    if (!line.startsWith('|')) continue;
    for (const re of SUPERSEDED) {
      if (re.test(line) && !MARKERS.test(line)) {
        offenders.push(`${String(re)} :: ${line.slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a superseded figure is stated without any marker saying it was corrected');
});

test('L2 ledger: a section-C "unported" claim whose facility shipped is struck, and the facility is really there', () => {
  // CR-36/37/38. The four tests above pin FIGURES; this pins the other
  // half of the same disease, the half section C is defined by
  // (Home.md: "a stale row is worse than a missing one - it sends the
  // next slice off to build what already ships"). Three rows survived
  // the road-to-1:1 campaign claiming a shipped, tested facility was
  // still unported.
  //
  // The gate is two-sided on purpose. The claim may still be READ - a
  // strike quotes what it retired, EF1c's rule - but the line must
  // carry the strike AND the slice that closed it; and that slice's
  // facility must still be in the tree, so ripping the code out fails
  // here instead of leaving the ledger boasting.
  const CLOSED = [
    { claim: /U24's list picker picks straight through/, slice: /ROAD-A7/,
      file: 'src/ui/listPicker.js', built: /if \(wasDouble\) \{ this\._lastRowClick = null; this\._use\(\); \}/ },
    { claim: /the vertical scroll bar's THUMB DRAG is not implemented/, slice: /ROAD-A7/,
      file: 'src/ui/verticalScrollBar.js', built: /this\.draggingThumb = true;/ },
    { claim: /what wa-4 still waits on is the CROSS-HOST arm/, slice: /ROAD-B B4 \+ ROAD-A A10/,
      file: 'src/world/actionSystem.js', built: /CASTLE_DAGGERFALL_MAP_ID = 1291010263;/ },
    { claim: /book VALUE from the file price pends the pricing row/, slice: /SHIPPED at ROAD-A A2/,
      file: 'src/systems/books.js', built: /export function bookValue\(id\) \{/ },
    { claim: /the value half pends the E1 book-file-pricing row/, slice: /ROAD-A A2/,
      file: 'src/systems/quest/item.js', built: /createBook\(itemKey\) \?\?/ },
  ];
  const rows = LEDGER.split('\n').filter((l) => l.startsWith('|'));
  const unstruck = [];
  for (const { claim, slice, file, built } of CLOSED) {
    const line = rows.find((l) => claim.test(l));
    if (!line) continue;                          // struck by deletion is struck
    if (!/~~/.test(line)) unstruck.push(`${claim} stands unstruck`);
    else if (!slice.test(line)) unstruck.push(`${claim} is struck without naming the slice that closed it`);
    assert.match(readFileSync(join(ROOT, file), 'utf8'), built,
      `the ledger says ${String(claim)} shipped; ${file} must still carry it`);
  }
  assert.deepEqual(unstruck, [], 'every closed section-C claim carries its strike and its slice');

  // CR (wave D): the same disease inside a RESIDUE list. The ENCHANTING
  // row's residue items are struck one by one as they close, and D9
  // edited that very row - striking the held-INSTANT clause - while
  // walking past "the dungeon host's ctx mount" two clauses to its
  // left, which D8 had already built. The generic loop above cannot
  // see it: the line carries strikes, just not on this item.
  const enchanting = rows.find((l) => /~~ENCHANTING, WHOLE~~/.test(l));
  assert.ok(enchanting, 'section C still carries the ENCHANTING row');
  assert.equal(/RESIDUE: the dungeon host's ctx mount/.test(enchanting), false,
    'a residue item D8 closed does not stand as a live "unported" claim');
  assert.match(enchanting, /RESIDUE: ~~the dungeon host's ctx mount~~ CLOSED D8/,
    'it is struck, and names the slice that closed it');
  // and the two-sided half: the mount must still be in the tree.
  assert.match(readFileSync(join(ROOT, 'src/scenes/dungeonContext.js'), 'utf8'),
    /setDefaultEnchantCtx\(createEnchantCtx\(\{/,
    'the ledger says the dungeon host mounts the enchant ctx; dungeonContext.js must still do it');
});

test('TC1 ledger: the six re-measured section-C rows are struck, and each names the tree it closed on', () => {
  // TC1 (2026-09-02). The re-measurement of section C found SIX routed
  // rows the road-to-1:1 campaign had closed in the tree and never
  // struck here - the disease the CR-36/37/38 pin above exists for,
  // one campaign later. That pin holds CLAUSES; this one holds the ROW
  // HEADS, because a head left unstruck is what a reader scanning
  // section C for the next slice actually sees.
  //
  // Two-sided, same contract: the head carries its strike AND the
  // slice that closed it, and the facility that slice named is still
  // in the tree - so ripping the code out fails here rather than
  // leaving the Ledger boasting.
  const CLOSED = [
    // UseItem's last three arms: DrinkPotion, RecordLocationFromMap, the quest-item click.
    { head: /~~UseItem's UNBUILT DESTINATIONS~~/, slice: /TC1 2026-09-02/,
      file: 'src/systems/useItem.js', built: /resource\.useClicked = true;/ },
    // The talk arc's last routed clause: AddNonQuestRumor's producer.
    { head: /~~THE TALK MANAGER~~/, slice: /TC1 2026-09-02/,
      file: 'src/systems/regionPower.js', built: /rumorMill\?\.addNonQuestRumor\?\./ },
    // Fast travel: transport ownership, the mint the row said nothing had.
    { head: /~~FAST TRAVEL residue~~/, slice: /TC1 2026-09-02/,
      file: 'src/systems/shopStock.js', built: /export const TRANSPORT_SMALL_CART = 93;/ },
    { head: /~~PatchRegionIndex legacy-save fix~~/, slice: /U32 \+ U41/,
      file: 'src/formats/mapsFile.js', built: /export function patchRegionIndex\(regionIndex, canonicalRegionName\)/ },
    { head: /~~Biography GP arm ledger note/, slice: /TC1 2026-09-02/,
      file: 'src/formats/faceUVTool.js', built: /Can not normalize a vector when it/ },
    { head: /~~THE MAGIC CRAFTING WINDOWS~~/, slice: /TC1 2026-09-02/,
      file: 'src/ui/spellIconPickerWindow.js', built: /SpellIconPickerWindow/ },
  ];
  const rows = LEDGER.split('\n').filter((l) => l.startsWith('|'));
  const missing = [];
  for (const { head, slice, file, built } of CLOSED) {
    const line = rows.find((l) => head.test(l));
    if (!line) { missing.push(`${head} - no section-C row carries this struck head`); continue; }
    if (!slice.test(line)) missing.push(`${head} is struck without naming the slice that closed it`);
    assert.match(readFileSync(join(ROOT, file), 'utf8'), built,
      `the Ledger says ${String(head)} closed on ${file}; the file must still carry it`);
  }
  assert.deepEqual(missing, [], 'every re-measured row carries its strike and its slice');

  // The two DFU windows nothing in src/ cited. Neither is a gap, and
  // the record of WHY has to be reachable from the code that points at
  // it: controlsWindow's JOYSTICK tab sends the reader to "the
  // Ledger", so the Ledger has to name the window and the flag.
  const keybind = rows.find((l) => /~~THE KEYBINDING REGISTRY~~/.test(l));
  assert.ok(keybind, 'section C still carries the keybinding-registry row');
  assert.match(keybind, /DaggerfallJoystickControlsWindow\.cs/,
    'the joystick window has no Ledger row while controlsWindow.js sends the player to one');
  assert.match(keybind, /DaggerfallUnityMouseControlsWindow\.cs \(411\)[\s\S]*?THE SETTINGS SURFACE/,
    "the mouse/advanced window must be recorded against section A's settings-surface row");
  // ROAD-G G3: the joystick clause cites the gamepad flag BY LINE, and
  // G3 moved that flag twelve lines down when it retired the held-order
  // remainder above it. A hard-coded `:465-468` here would have gone
  // green on a row naming a stranger, which is exactly CD's lesson, so
  // the cite is READ OUT of the row and RESOLVED against the file.
  const cite = /systems\/inputActions\.js:(\d+)-(\d+)/.exec(keybind);
  assert.ok(cite, 'the joystick row must point at the flag that carries the owner decision');
  const ia = readFileSync(join(ROOT, 'src/systems/inputActions.js'), 'utf8').split('\n');
  const cited = ia.slice(Number(cite[1]) - 1, Number(cite[2])).join('\n');
  assert.match(cited, /AXES \+ JOYSTICK \(AxisActions, JoystickUIActions\)/,
    `the Ledger cites the gamepad flag at inputActions.js:${cite[1]}-${cite[2]}, which is not it`);
  assert.match(cited, /loadKeyBinds ignores them in a DFU-written file/,
    'the cited range must hold the WHOLE flag, not its first line');
  // ROAD-G G6 (2026-09-04) BUILT the other one, so this half flipped
  // from "recorded against section A" to "shipped": the row must strike
  // the recorded clause, say so, and name the module - and the module
  // must still be in the tree, which is the two-sided contract the rest
  // of this test holds every re-swept row to.
  assert.match(keybind, /~~THE MOUSE\/ADVANCED WINDOW[\s\S]*?~~ \*\*THE MOUSE\/ADVANCED WINDOW SHIPPED WHOLE \(ROAD-G G6, 2026-09-04\) and this row's live clause is NARROWED TO THE JOYSTICK WINDOW ALONE\.\*\*/,
    'the mouse/advanced clause must be struck and re-stated as shipped, narrowing the row to the joystick');
  assert.match(keybind, /`ui\/mouseControlsWindow\.js` IS DaggerfallUnityMouseControlsWindow\.cs/,
    'the shipped clause must name the module it shipped');
  assert.match(readFileSync(join(ROOT, 'src/ui/mouseControlsWindow.js'), 'utf8'),
    /export class MouseControlsWindow/,
    'the Ledger says the mouse/advanced window shipped; the file must still carry it');
  assert.match(readFileSync(join(ROOT, 'src/ui/controlsWindow.js'), 'utf8'),
    /this\.advanced \?\?= new MouseControlsWindow\(this\.unsaved\);/,
    'the ADVANCED tab must still reach it, on the grid\'s own staged dicts');
  assert.match(readFileSync(join(ROOT, 'src/systems/inputActions.js'), 'utf8'),
    /AXES \+ JOYSTICK \(AxisActions, JoystickUIActions\)/,
    'the Ledger cites the gamepad flag at inputActions.js; the flag must still be there');
  assert.match(readFileSync(join(ROOT, 'src/ui/controlsWindow.js'), 'utf8'),
    /The port has no gamepad layer \(Ledger\)\./,
    'the JOYSTICK tab note that sends the reader to this row must still be there');
});

test('AUDIT 58 F5 ledger: the RE-INTEGRATED road system has its own section A row, and the removal row stops saying nothing ships', () => {
  // The file's only roads row said the system was "REMOVED WHOLE" and
  // "Nothing of this departure ships". Five modules, 2 MB of vendored
  // third-party data and an ungated call in the classic lane say
  // otherwise. Both halves are pinned two ways: rip the row out and the
  // doc half fails; rip the wiring out and the tree half does.
  const A = LEDGER.slice(
    LEDGER.indexOf('## A. Approved departures from DFU'),
    LEDGER.indexOf('## A-note (H1)'),
  );
  assert.ok(A.length > 1000, 'section A was not found');
  assert.ok(!/Nothing of this departure ships/.test(A),
    'the struck ROADS row still asserts that nothing of it ships');
  assert.match(A, /~~ROADS \(R1-R7, RA1, RF1\)~~/, 'the removal row is still there, struck');

  const row = A.split('\n').find((l) => l.startsWith('| **ROADS 22-25'));
  assert.ok(row, 'section A carries no approved-departure row for the re-integrated road system');
  assert.match(row, /Supersedes the struck row above/, 'the new row cites the removal row it supersedes');
  assert.match(row, /vendor\/roads-hazelnut\//, 'it names the vendored data');
  assert.match(row, /FALLBACK/, 'and says the port’s own network is what falls back');
  assert.match(row, /ALWAYS ON, IN BOTH LANES/, 'it states which lane ships what');
  assert.match(row, /Roads\.md:194/, 'and cites Mac’s always-on call');
  assert.match(row, /`systems\/travel\.js` stays the verbatim port/, 'and what stayed removed');
  // AUDIT 58 R1 (d): the bake's cache version is a DERIVABLE figure like
  // every other in this file - the row states it, roadsCache.js IS it.
  const ver = /GENERATOR_VERSION (\d+)/.exec(row);
  assert.ok(ver, 'the row no longer names the bake\u2019s cache version');
  assert.equal(Number(ver[1]), GENERATOR_VERSION, 'the row\u2019s GENERATOR_VERSION drifted from roadsCache.js');

  // The tree half: the row's claims are true of this checkout.
  const rootFile = (p) => readFileSync(join(ROOT, p), 'utf8');
  for (const f of ['roadData.bytes', 'trackData.bytes', 'riverData.bytes', 'streamData.bytes']) {
    assert.equal(readFileSync(join(ROOT, 'vendor/roads-hazelnut', f)).length, 500000, `${f} is his 500,000-byte array`);
  }
  for (const m of ['roadNetwork.js', 'roadPainter.js', 'roadsProducer.js', 'roadsCache.js']) {
    assert.ok(rootFile(`src/world/${m}`).length > 0, `src/world/${m} ships`);
  }
  const host = rootFile('src/scenes/world.js');
  // AUDIT 58 R1 (b): THE GATE IS THE STATEMENT ABOVE, NOT THE CALL LINE.
  // This read the two `terrainGen.setRoads*` LINES and rejected
  // `isEnhanced` inside them, which is not how a gate is written: wrapping
  // the whole block (`if (isEnhanced()) loadModRoads().then(...)`, or an
  // `if (isEnhanced()) { ... }` around it) left the 1:1 lane with no roads
  // at all - not his arrays, not ours, no rebuildRoadless - with this pin
  // and the whole suite green. So the wiring's ENCLOSING SCOPE is what is
  // pinned: it must be a bare statement in bootWorld's own body, at
  // brace depth one, with nothing conditional between.
  const start = host.indexOf('\n  loadModRoads().then((his) => {\n');
  assert.ok(start > 0, 'the road wiring is not a bare two-space statement - something prefixes or re-indents it');
  const scopes = enclosingBraces(host, start);
  assert.equal(scopes.length, 1, `the road wiring sits inside ${scopes.length} blocks, not just the scene builder\u2019s body`);
  assert.match(lineAt(host, scopes[0]), /^export async function bootWorld\(/,
    'the road wiring\u2019s only enclosing scope is no longer bootWorld itself');
  const block = host.slice(start, host.indexOf('\n  });', start));
  assert.ok(!/isEnhanced/.test(block), `the road wiring is ungated: ${block.trim().slice(0, 80)}`);
  const wiring = block.split('\n').filter((l) => /terrainGen\.setRoads(Data)?\(/.test(l));
  assert.equal(wiring.length, 2, 'both road wires are in that block');
  assert.equal(host.split('\n').filter((l) => /terrainGen\.setRoads(Data)?\(/.test(l)).length, 2,
    'and world.js holds no third wire outside it');

  // AUDIT 58 R1 (a): the row's own line cite RESOLVES. It read
  // `world.js:331-334` - four lines of the ROADS 3/22 comment block - from
  // the day it was written, and the pin above re-derived the no-gate fact
  // without ever reading the number, so the one pointer a reader is sent to
  // could name anything. The cite is now sliced and checked.
  const cite = /`src\/scenes\/world\.js:(\d+)-(\d+)`/.exec(row);
  assert.ok(cite, 'the row no longer cites the wiring by line');
  const citedLines = host.split('\n').slice(Number(cite[1]) - 1, Number(cite[2]));
  const cited = citedLines.join('\n');
  assert.match(cited, /terrainGen\.setRoadsData\(/, 'the cited range misses his-data wire');
  assert.match(cited, /terrainGen\.setRoads\(settlementsOf/, 'the cited range misses the fallback wire');
  assert.ok(!/isEnhanced/.test(cited), 'the cited range carries a gate');
  // ...and it is the WHOLE block, first line to last: a range that merely
  // happens to still contain the wires is how the old number stayed
  // plausible for a whole wave.
  assert.equal(citedLines.at(0), '  loadModRoads().then((his) => {', 'the cite does not start at the wiring statement');
  assert.equal(citedLines.at(-1), '  });', 'the cite does not end at the block\u2019s close');
  assert.match(rootFile('src/world/terrainGen.js'), /paintRoads\(tileData, tilemap/, 'the paint is in the shared kernel');
  const travel = rootFile('src/systems/travel.js');
  assert.ok(!/roadAt\(|path\.roadAt|byRoad/.test(travel), 'travel.js is still the verbatim port - the road term and its two deps stayed gone');
  assert.match(rootFile('src/ui/overworldMap.js'), /byRoad: false,/, 'and byRoad is still the permanent false the trip card reads');

  // ...and the two pages that repeated the stale claim were corrected.
  const status = rootFile('bible/01-Overview/Port-Status-2026-09-02.md');
  assert.ok(!/\*\*Removed whole:\*\* the road system/.test(status), 'the status page still says removed whole');
  assert.match(status, /Removed, then re-integrated/, 'and says what actually happened');
  assert.ok(!/Basic Roads' design credited, none of its data/.test(rootFile('bible/Home.md')),
    'Home.md still says none of his data ships');

  // AUDIT 58 (records): F5 swept the BIBLE and stopped there, so two
  // `src/` headers went on reasoning from the retired premise - and
  // both used it to say something about themselves. windmills.js
  // called itself "the only departure of its kind" because the roads
  // "were removed whole", and dataSource.js gave the removal as the
  // reason its derived store has no consumer. The store really has
  // none, and windmills really is enhanced-only; only the REASONS were
  // false. So the sweep is a sweep: no src/ site may rest on the
  // premise, and each one's own true claim is pinned beside it.
  /** A header read as PROSE: comment markers off, wraps closed. */
  const prose = (p2) => rootFile(p2).replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
  for (const f of ['src/world/windmills.js', 'src/scenes/dataSource.js']) {
    const flat = prose(f);
    assert.ok(!/road system was removed whole/.test(flat),
      `${f} still rests on "the road system was removed whole"`);
    assert.ok(!/the only departure of its kind/.test(flat),
      `${f} still calls itself the only departure of its kind - roads are one again`);
    assert.match(flat, /ROADS 22-25/, `${f} does not cite the row that retired the premise`);
  }
  const mills = prose('src/world/windmills.js');
  assert.match(mills, /ENHANCED-ONLY DEPARTURE \(Ledger A\)/, 'windmills is still enhanced-only, and must still say so');
  assert.match(mills, /ALWAYS ON IN BOTH LANES/, 'and must say how the roads row differs from it');
  const ds = rootFile('src/scenes/dataSource.js');
  assert.match(ds, /IT CURRENTLY HAS NO CONSUMER\./, 'the derived store’s true claim went with the false reason');
  assert.match(prose('src/scenes/dataSource.js'), /roadsCache\.js/, 'and must say where the rebuilt roads cache instead');
  const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`)
      : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []));
  const consumers = walk('src').filter((f) => f !== 'src/scenes/dataSource.js'
    && /storeDerived\(/.test(rootFile(f)));
  assert.deepEqual(consumers, [], 'the derived store has a consumer now - dataSource.js’s header says it has none');
});
