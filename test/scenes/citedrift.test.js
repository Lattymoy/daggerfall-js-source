// ---------------------------------------------------------------------------
// CD - THE CITATION IS PART OF THE CLAIM (ROAD-E fix-D, 2026-09-02).
//
// Wave E's review found the same defect four times over, and every
// instance was a POINTER rather than a behaviour: a comment, a status
// page or a test header naming a line that had been exact one commit
// earlier and named a stranger at the merge.
//
//   - `ui/spell/spellMakerWindow.js` declared "RECORDED DEPARTURES" and closed
//     the first with "Ledger A carries the widget row already
//     (Port-Ledger.md:988)". Section A carried no widget row at all -
//     the AUDIT 17m / F7 shape, a claim of approval standing in for one -
//     and :686 was the stat-colour NIT row by then. The row exists now
//     (Ledger A, TB1) and the sites cite it BY NAME.
//   - `Road-To-1-1.md` and `Port-Status-2026-09-02.md` both said the
//     wave left 17 open flags, one of them as the falsifiable claim
//     that "`regenOpenFlags --check` now answers 17". Six lanes each
//     retired a flag against their own 19-row base and none could see
//     the others; the tool answers 13.
//   - every Port-Ledger row identifier in Port-Status section 2 moved
//     when the wave inserted two rows above section C, so fourteen
//     `:NNN` cites named unrelated rows, as did the section's own bounds.
//   - three in-range comments and two test headers cited sibling-lane
//     files at lines those lanes had just moved.
//
// A line number is a claim like any other, and the only durable answer
// is to make it CHECKABLE: each pin below reads the citation out of the
// document that makes it and resolves it against the file it names. Bump
// any one of them by a line and the suite goes red at the citation, not
// three waves later at a reader.
//
// CITE-ANCHOR (2026-10-06): a cite into our code names its line by a QUOTE
// now (tools/citeAnchor.mjs, test/tooling/citeanchor.test.js) - a number was a
// claim about every line above it, and keeping thousands of them true
// rewrote the same doc lines on every branch that touched a host. The law
// here stands; what the pins read changed. A pick captures the anchor's
// quote (and an after-form's line) and resolves it as the gate does, and a
// range is named by its first line - so where a pin held a range's END,
// it holds the block that line opens. The records keep their numbers: a
// struck row's measurement, and a renumbering told as history.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dfuFile, missingDfu } from '../dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone
import { resolveAnchor, maskAnchors, citedLines, anchorLine, bracesAt, forbidAt } from '../../tools/citeAnchor.mjs';   // CITE-ANCHOR: the gate's own resolver

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
/** The tracked files under a directory - test/tooling/doctrine.test.js's own
 *  population, so a walk here and a walk there see the same tree. */
const lines = (rel) => read(rel).split('\n');

/** CITE-ANCHOR: the line an anchor's quote (and after-form line) names in `target`, as the gate resolves it - 0 for
 *  none. Masked as the gate masks: a quote counts outside the anchors. */
/** CITE-ANCHOR's brace rule: in a code file's comment a block's head with nothing to quote but its brace (a hook whose
 *  text stands twice, `onLevelUp: () => {`) is named at its block's first line - the tool's nudge (anchorLine). Whether
 *  the anchor at `n`, cited from `from`, is that nudge of a line `want` names: one of the three above it, which the
 *  tool's own rule names here. */
/** A pick's capture of an anchor: its quote, and an after-form's line. */
/** The block line `n` (1-based) opens: through the first later line at or above its indent that closes it. A range
 *  cited by its first line is that block. */

/** The Ledger's line N, 1-based, as the citations write it. */

/** A heading's line number, 1-based. */

/** Table rows in a line range: the doc's own `awk '/^\|/ && !/^\|---/'`. */

// ═══ CD4: the in-source citations the wave invalidated resolve again ═══
/** `<file> ... :<line>` cited from a comment, and what must be on it. */

// ---------------------------------------------------------------------------
// CD7 (ROAD-G G1 review, 2026-09-04): A RANGE WHOSE END PRECEDES ITS
// START IS NOT A CITATION AT ALL.
//
// The G1 lane re-resolved ~180 `:NNN` cites after moving code in four
// hosts, and the pass advanced only the LEADING number of every
// multi-number citation: cityGuards.js's 1108-1012, world.js's 16599-16503,
// worldModes.js's 1590 against 1356. Forty of them came out as ranges
// that cannot exist, and every pin in this file was green throughout,
// because each one resolves a single number a human chose to list.
//
// This pin needs no list. It reads every tracked source, test, tool and
// bible page and refuses any citation into a PORT file (`*.js`/`*.mjs`)
// whose second number is smaller than its first - the range form
// `A-B`, the slash pair `A/:B` and the `A against :B` form alike. C#
// reference cites are exempt: DFU's own members are legitimately cited
// out of order (a caller at :481 against its callee at :409).
// MUTANT: put any one of the forty back and this goes red.
// ---------------------------------------------------------------------------
test('CD7: no citation into a port file names a range that runs backwards', () => {
  const CITE = /([A-Za-z0-9_./-]+\.(?:js|mjs)):(\d+)\s*(?:-|\/:|\/|\s+against\s+:)\s*:?(\d+)/g;
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (/\.(js|mjs|md)$/.test(e.name) ? [rel] : []);
  });
  const backwards = [];
  // this file alone is exempt: it QUOTES the corrupted forms above, as
  // the record of what the check is for.
  for (const rel of ['src', 'test', 'tools', 'bible'].flatMap(walk).filter((r) => r !== 'test/scenes/citedrift.test.js')) {
    lines(rel).forEach((l, i) => {
      for (const m of l.matchAll(CITE)) {
        if (Number(m[3]) < Number(m[2])) backwards.push(`${rel}:${i + 1}: ${m[0]}`);
      }
    });
  }
  assert.deepEqual(backwards, [], 'a citation names a range whose end precedes its start');
});

// CD7b (AUDIT 625 D3, 2026-10-05): A RANGE IS WRITTEN WITH AN ASCII
// HYPHEN. citeShift and citeMerge read a range as `A-B`, and CD7 above
// reads the same, so a range set with a typographic dash (a hyphen, a
// non-breaking hyphen, a figure, en or em dash, a minus) is a cite of
// `A` alone to all three: every shift moved its head and left its tail,
// and CD7 never saw the backwards range that made. Settings-Screen-Spec
// set its sixteen ranges with U+2011 - eight had run backwards (the
// settings store's 89 to 81, the renderer's 4378 to 4053), and PR #625's
// own shift made a ninth (the settings pin's 35 to 35 became 36 to 35).
// The sixteen were re-resolved and set in ASCII.
// MUTANT: set any range's hyphen back to U+2011 and this goes red.
test('CD7b: no citation names a range with a typographic dash - the tools that keep cites read an ASCII hyphen', () => {
  const DASHED = /:\d+[‐-―−]\d+/g;
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (/\.(js|mjs|md)$/.test(e.name) ? [rel] : []);
  });
  const dashed = [];
  for (const rel of ['src', 'test', 'tools', 'bible'].flatMap(walk)) {
    lines(rel).forEach((l, i) => { for (const m of l.matchAll(DASHED)) dashed.push(`${rel}:${i + 1}: ${m[0]}`); });
  }
  assert.deepEqual(dashed, [], 'a range set with a typographic dash - write it A-B');
});

// ═══ CD9: THE VENDORED MOD IS IN THE TREE, SO ITS CITES ARE CHECKABLE ═══
//
// AUDIT-WH R3. World Tooltips 1.1 is vendored whole
// (`vendor/world-tooltips/`), and the WORLD-HOVER slice cites it
// nearly forty times - the container table, the sixteen Daedra, the
// action model ids, the four door arms, the mobile band. Not one of
// those cites was checked by anything, and the audit found them
// systematically off: the `<= Palace` gate was cited three lines
// early, the Store->Palace substitution six, the corpse arm one, the
// whole of GetStaticDoorText one. A cite into a file that is IN THE
// TREE and is never resolved is the worst kind: it reads as evidence
// and costs nothing to check.
//
// This is that check. Each entry is a cite as the port writes it, the
// line it must land on, and - for a range - the line it must end on.
// A `:NNN-MMM` whose ends are both anchored pins the WHOLE block: a
// reformat of the vendored file moves both, and the re-resolution is
// one edit per end rather than a guess.
const VENDOR = 'vendor/world-tooltips/Scripts/Modded_HUDTooltipWindow.cs';
const VENDOR_CITES = [
  // the tooltip's own body, top to bottom
  ['.cs:42', /const string hideInteractTooltipText = "HideDefaultInteractTooltip";/, null],
  [':465', /if \(!HideInteractTooltip && string\.IsNullOrEmpty\(ret\)\)/, null],
  ['.cs:169-172', /var text = GetHoverText\(\);/, /tooltip\.Draw\(text\);/],
  ['.cs:228-257', /private string EnumerateCustomHoverText\(RaycastHit hit\)/, /^ {8}\}$/, /^            return res;$/],
  ['.cs:266-275', /bool isSame = hit\.transform == prevHit;/, /return prevText;/],
  ['.cs:297-320', /if \(string\.IsNullOrEmpty\(ret\) && hit\.distance <= PlayerActivate\.MobileNPCActivationDistance\)/, /^ {24}\}$/],
  ['.cs:299-302', /if \(CheckComponent<MobilePersonNPC>\(hit, out comp\)\)/, /prevDistance = PlayerActivate\.MobileNPCActivationDistance;/],
  ['.cs:304-312', /else if \(CheckComponent<DaggerfallEntityBehaviour>\(hit, out comp\)\)/, /^ {32}\}$/, /^                                    prevDistance = PlayerActivate\.MobileNPCActivationDistance;$/],
  ['.cs:315-318', /else if \(CheckComponent<DaggerfallBulletinBoard>\(hit, out comp\)\)/, /prevDistance = PlayerActivate\.MobileNPCActivationDistance;/],
  ['.cs:325-393', /if \(CheckComponent<StaticNPC>\(hit, out comp\)\)/, /prevDistance = PlayerActivate\.StaticNPCActivationDistance;/],
  ['.cs:334-384', /if \(archive == 175\)/, /ret = "Vaermina";/],
  ['.cs:398', /if \(hit\.distance <= PlayerActivate\.DefaultActivationDistance\)/, null],
  ['.cs:400-471', /if \(CheckComponent<DaggerfallAction>\(hit, out comp\)\)/, /^ {32}\}$/],
  ['.cs:403-405', /if \(da\.TriggerFlag == DFBlock\.RdbTriggerFlags\.Direct$/, /\|\| da\.TriggerFlag == DFBlock\.RdbTriggerFlags\.MultiTrigger\)/],
  ['.cs:408-418', /var mesh = hit\.transform\.GetComponent<MeshFilter>\(\);/, /switch \(record\)/],
  ['.cs:420-431', /case 74037:/, /^ {52}break;$/, /^                                                    ret = "The Mantella";$/],
  ['.cs:432-437', /case 62323:/, /multiTriggerOkay = true;/],
  ['.cs:459-461', /if \(da\.TriggerFlag == DFBlock\.RdbTriggerFlags\.MultiTrigger && !multiTriggerOkay\)/, /ret = null;/],
  ['.cs:465-466', /if \(!HideInteractTooltip && string\.IsNullOrEmpty\(ret\)\)/, /ret = "<Interact>";/],
  ['.cs:473-476', /else if \(CheckComponent<DaggerfallLadder>\(hit, out comp\)\)/, /prevDistance = PlayerActivate\.DefaultActivationDistance;/],
  ['.cs:491-505', /if \(CheckComponent<DaggerfallBillboard>\(hit, out comp\)\)/, /^ {44}\}$/],   // AUDIT-WH2 L5-F23: the range named 493, the body's first LINE, not 491, the arm's own `if`
  // AUDIT-WH2 L5-F23: the hosts cited `.cs:481-512` for the quest-resource
  // arm, and 481 is `prevDistance = ...DefaultActivationDistance;` INSIDE
  // the bookshelf arm above it - off by two, in two places, and resolved
  // by nothing because the completeness sweep below exempted the hosts.
  ['.cs:483-512', /else if \(CheckComponent<QuestResourceBehaviour>\(hit, out comp\)\)/, /^ {36}\}$/],
  ['.cs:509', /ResolveItemLongName\(\(\(Item\)qrb\.TargetResource\)/, null],
  ['.cs:526', /ret = loot\.entityName \+ " \(dead\)";/, null],
  ['.cs:534-548', /case LootContainerTypes\.DroppedLoot:/, /^ {40}break;$/],
  ['.cs:549-551', /case LootContainerTypes\.ShopShelves:/, /^ {40}break;$/, /^                                        ret = "Shop Shelf";$/],
  ['.cs:552-633', /case LootContainerTypes\.HouseContainers:/, /^ {40}break;$/],   // AUDIT-WH2 L5-F4: the range ended at 629, which is the DEFAULT case's break inside the inner switch; the HouseContainers case's own break is 633
  ['.cs:627-628', /^\s+default:$/, /ret = "<Interact>";/],
  ['.cs:641-650', /if \(CheckComponent<DaggerfallActionDoor>\(hit, out comp\)\)/, /^ {28}\}$/, /^                                prevDistance = PlayerActivate\.DoorActivationDistance;$/],
  // GetStaticDoorText, arm by arm
  ['.cs:684-789', /string GetStaticDoorText\(DaggerfallStaticDoors doors/, /^ {8}\}$/, /^            return null;$/],
  ['.cs:692', /if \(door\.doorType == DoorTypes\.Building && !playerEnterExit\.IsPlayerInside\)/, null],
  ['.cs:701-702', /DaggerfallStaticBuildings buildings = GetBuildings\(hit\.transform, out buildingOwner\);/, /if \(buildings && buildings\.HasHit\(hit\.point, out building\)\)/],   // DOOR-NAME (FIELD BUGS 2026-10-13e): the mod's box test is the hit block's
  ['.cs:706-707', /if \(!buildingDirectory\)/, /return "<ERR: 010>";/],
  ['.cs:711-712', /if \(!buildingDirectory\.GetBuildingSummary\(building\.buildingKey, out buildingSummary\)\)/, /return "<ERR: 011>";/],
  ['.cs:719', /playerGPS\.DiscoverBuilding\(building\.buildingKey\);/, null],
  ['.cs:726-733', /if \(buildingType != DFLocation\.BuildingTypes\.Town23\)/, /^ {28}\}$/, /^                                tooltip = "To\\r" \+ playerGPS\.CurrentLocation\.Name \+ " City Walls";$/],
  ['.cs:735-738', /if \(!buildingUnlocked\)/, /^ {28}\}$/, /^                                tooltip \+= "\\rLock Level: " \+ buildingLockValue;$/],
  ['.cs:740-741', /if \(!buildingUnlocked && buildingType <= DFLocation\.BuildingTypes\.Palace/, /&& buildingType != DFLocation\.BuildingTypes\.HouseForSale\)/],
  ['.cs:747-748', /if \(buildingType == DFLocation\.BuildingTypes\.Palace\)/, /Replace\("Store", "Palace"\)/],
  ['.cs:762', /return prevDoorText;/, null],
  ['.cs:764-767', /else if \(door\.doorType == DoorTypes\.Building && playerEnterExit\.IsPlayerInside\)/, /return "To\\r" \+ playerGPS\.CurrentLocation\.Name;/],
  ['.cs:769-772', /else if \(door\.doorType == DoorTypes\.DungeonEntrance/, /return "To\\r" \+ playerGPS\.CurrentLocation\.Name;/],
  ['.cs:774-783', /else if \(door\.doorType == DoorTypes\.DungeonExit/, /^ {16}\}$/, /^                        return "To\\r" \+ playerGPS\.CurrentRegion\.Name \+ " Region";$/],
  ['.cs:777-782', /if \(playerGPS\.CurrentLocationType == DFRegion\.LocationTypes\.TownCity/, /return "To\\r" \+ playerGPS\.CurrentRegion\.Name \+ " Region";/],
  // the cites the HOSTS and the pins write, so the table is the whole
  // set the slice depends on and not only the three modules' own
  ['.cs:478-481', /else if \(CheckComponent<DaggerfallBookshelf>\(hit, out comp\)\)/, /prevDistance = PlayerActivate\.DefaultActivationDistance;/],
  ['.cs:549-551', /case LootContainerTypes\.ShopShelves:/, /^ {40}break;$/, /^                                        ret = "Shop Shelf";$/],
  ['.cs:684-762', /string GetStaticDoorText\(DaggerfallStaticDoors doors/, /return prevDoorText;/],
  ['.cs:719', /playerGPS\.DiscoverBuilding\(building\.buildingKey\);/, null],
  // AUDIT-WH2 L4-F1: the LIVE arm's member, which the port read from
  // the corpse's until this audit - `Entity.Name` is EnemyEntity.cs:314
  // `name = career.Name`, and `loot.entityName` (.cs:526) is not.
  // AUDIT-WH2: the four `prevHit`/`prevText` lines the door-text cache's
  // look-away drop is derived from - the mod's whole bound on a stale
  // door tooltip, and the half the port had not carried.
  ['.cs:266', /bool isSame = hit\.transform == prevHit;/, null],
  ['.cs:274-278', /if \(hit\.distance <= prevDistance\)/, /^ {16}\}$/, /^                        return null;$/],
  ['.cs:666', /prevHit = null;/, null],
  ['.cs:672', /prevHit = null;/, null],
  ['.cs:761', /\/\/If we caught ourselves hitting the same door again directly without touching the building, just return the previous text which should be the door's/, null],
  ['.cs:786', /prevHit = null;/, null],
  ['.cs:310', /ret = \(\(DaggerfallEntityBehaviour\)comp\)\.Entity\.Name;/, null],
  ['.cs:308-311', /if \(!enemyMotor \|\| !enemyMotor\.IsHostile\)/, /prevDistance = PlayerActivate\.MobileNPCActivationDistance;/],
  ['.cs:285', /ret = EnumerateCustomHoverText\(hit\);/, null],
  ['.cs:285-296', /ret = EnumerateCustomHoverText\(hit\);/, /\/\/ Objects with "Mobile NPC" activation distances/],
  ['.cs:420-437', /case 74037:/, /multiTriggerOkay = true;/],
  ['.cs:726', /if \(buildingType != DFLocation\.BuildingTypes\.Town23\)/, null],
  ['.cs:764', /else if \(door\.doorType == DoorTypes\.Building && playerEnterExit\.IsPlayerInside\)/, null],
  ['.cs:777', /if \(playerGPS\.CurrentLocationType == DFRegion\.LocationTypes\.TownCity/, null],
  // the panel's own anchor, which the plaque's placement is derived from
  ['.cs:1097-1112', /\/\/ Adjust tooltip position when large HUD is docked/, /^ {16}\}$/, /^                    Position = new Vector2\(Screen\.width \/ 2, Screen\.height \/ 2 \+ 1\);$/],
];

test('CD9: every cite into the VENDORED mod lands on the line it names', () => {
  // The vendored file ships with CRLF endings (it is a Windows mod
  // release, unpacked verbatim), so the line comes back with a
  // trailing \r and every `$` anchor below would miss it.
  const v = lines(VENDOR).map((l) => l.replace(/\r$/, ''));
  // AUDIT-WH2 L5-F22: THE END ANCHORS USED TO BE `/^\s+\}$/`.
  //
  // 117 of the vendored file's 1191 lines match that, and 41 match
  // `/^\s+break;$/` - so a HALF-SHIFTED range, which is the exact defect
  // this test's header says it exists to catch, passed on 16 of 54 rows.
  // `.cs:491-505` accepted six different wrong end values; `.cs:304-312`
  // accepted 320, which is another row's declared end in this same
  // table.
  //
  // Two things fixed it, both free. The anchor now pins the EXACT
  // indentation (`/^ {44}\}$/`), because the vendored file is deeply and
  // distinctively nested and a shifted range almost always lands at a
  // different depth; and a row may carry a third pattern, tested against
  // the line ABOVE the end, which is real text wherever the block's last
  // statement is not itself a brace.
  const bad = [];
  for (const [cite, first, last, prev] of VENDOR_CITES) {
    const m = /^(?:\.cs)?:?(\d+)(?:-(\d+))?$/.exec(cite.replace(/^\.cs/, ''));
    assert.ok(m, `malformed entry ${cite}`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : null;
    if (!first.test(v[a - 1] ?? '')) bad.push(`${cite} starts on ${JSON.stringify((v[a - 1] ?? '').trim().slice(0, 60))}`);
    if (b !== null) {
      assert.ok(b > a, `${cite} runs backwards`);
      if (!last.test(v[b - 1] ?? '')) bad.push(`${cite} ends on ${JSON.stringify((v[b - 1] ?? '').trim().slice(0, 60))}`);
      if (prev && !prev.test(v[b - 2] ?? '')) bad.push(`${cite} ends AFTER ${JSON.stringify((v[b - 2] ?? '').trim().slice(0, 60))}`);
    }
  }
  assert.deepEqual(bad, [], 'a cite into the vendored mod names a line that is not what it claims');
});

test('CD9: and every `.cs:` cite the slice writes is IN that table', () => {
  // The table is only a gate while it is COMPLETE. A cite added later
  // and not listed here is exactly the state the whole slice was in.
  // The three modules that ARE the mod's port: in these, every bare
  // `.cs:` is the vendor's, because that is what they are about. In a
  // HOST the same spelling is ambiguous - `worldModes.js` cites
  // PlayerActivate, DaggerfallInterior and the vendored mod within ten
  // lines of each other - so those cites are held by RESOLUTION above
  // (the table carries the ones the slice writes) rather than by a
  // completeness sweep that cannot tell the two apart.
  const SLICE = ['src/systems/worldTooltips.js', 'src/systems/worldHover.js', 'src/ui/worldPlaque.js'];
  // AUDIT-WH2 L5-F23: ...AND THE HOSTS, which this sweep used to exempt.
  //
  // The exemption's reason was real - `worldModes.js` cites
  // PlayerActivate, DaggerfallInterior and the vendored mod within ten
  // lines of each other - but the consequence was that the hosts wrote
  // forty vendor cites nothing ever checked, and two of them were
  // wrong: `.cs:297-313` named a BLANK LINE as the end of the mobile
  // band (the block runs to 320, which this table already carried), and
  // `.cs:481-512` opened the quest-resource arm two lines early, inside
  // the bookshelf arm above it. Both in two files at once.
  //
  // What makes the hosts sweepable is the WRAP rule below. A cite into
  // DFU carries its member name - `PlayerActivate.cs:87` - and the
  // lookbehind already skips those; what it could not see was a member
  // name that wrapped onto the previous comment line:
  //
  //     // PushWindow (DaggerfallUI.cs:1346-1353, UserInterfaceManager
  //     // .cs:79-91)
  //
  // which is `UserInterfaceManager.cs:79-91` and not the mod at all.
  // Reading back past the line break turns twelve false alarms into
  // none, and what is left over IS the vendored mod's.
  const HOSTS = [
    'src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js',
    'src/scenes/dungeonContext.js', 'src/scenes/dungeon.js', 'src/scenes/camps.js',
    'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/droppedLoot.js',
    'src/scenes/corpseMarker.js', 'src/player/activate.js', 'src/player/activationRace.js',
  ];
  const WRAPPED_MEMBER = /[A-Za-z0-9_]\s*(?:\/\/+|\*)?\s*$/;
  const known = new Set(VENDOR_CITES.map(([c]) => c.replace(/^\.cs/, '').replace(/^:/, '')));
  const missing = [];
  for (const f of [...SLICE, ...HOSTS]) {
    // a bare `.cs:` - one prefixed by a member name (PlayerActivate.cs,
    // ItemHelper.cs, DaggerfallInterior.cs) is a cite into DFU, which
    // CD1-CD3 already hold.
    const src = read(f);
    for (const m of src.matchAll(/(?<![A-Za-z0-9_])\.cs:(\d+(?:-\d+)?)/g)) {
      if (WRAPPED_MEMBER.test(src.slice(Math.max(0, m.index - 80), m.index))) continue;
      if (!known.has(m[1])) missing.push(`${f}: .cs:${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], 'a cite into the vendored mod that nothing resolves');
});
