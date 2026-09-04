// S3c/U9: the CHARGEN SESSION - one place that owns "load the
// careers, run the flow, apply the result".
//
// THE FOUR HOSTS RULE: chargen used to live entirely inside
// dungeonContext, so a player who booted straight into a town
// (either exterior host) never created a character at all - they
// played the pre-chargen placeholder entity (flat skills 30,
// maxHealth 50, Warrior-shaped nothing; it is described at
// characters/playerEntity.js:5). The dungeon kept its own copy of
// the load/apply code, which is exactly the duplication the audit's
// rules forbid, so both live here now. FIXED, not pending: world.js:
// 126/:1364-1366 and exterior.js:107/:958-960 both import and run
// createChargenFlow + createChargenWindow from here, so a town boot
// runs the wizard.
//
// The returned object is shaped for the exterior hosts' overlay seam
// (townTalk.showOverlay): isChoiceWindow so it receives RAW key
// codes, which it translates through the SHARED overlayAction table
// rather than a second mapping of its own.

import { ClassFile } from '../formats/classFile.js';
import { TextRsc } from '../formats/textRsc.js';   // U18: the class questions ride TEXT.RSC 9000
import { parseQuestionLibrary } from './classQuestions.js';   // U18
import { ChargenFlow } from '../ui/chargen.js';
import { applyCharacter, createCharacter, startingSpells, CLASS_CAREERS } from './chargen.js';
import { levelUpSkillSum } from './advancement.js';   // AUDIT 18: SetCurrentLevelUpSkillSum, one home
import { overlayAction } from '../ui/input.js';
import { isEnhanced } from './uiSkin.js';   // THE SKIN: which wizard
import { assignStartingGear } from './startingGear.js';   // S3d
import { NUMBER_BODY_PARTS } from './armorMaterials.js';   // wave 28: CharacterDocument's 7-part table
import { readSpellsStd, spellsByIndexMap } from '../formats/spellsStd.js';
import { parseBiog, biogFileName } from '../formats/biogFile.js';   // S3e
import { applyBiographyEffects } from './biography.js';   // S3e
import { customSpellSetIndex } from './customClass.js';   // U20a
import { SOCIAL_GROUP_COUNT, FactionFile } from '../formats/factionFile.js';   // U20a + S25
import { attachFactionRep } from './factionRep.js';   // S25
import { createRegionConditions } from './regionConditions.js';
import { bootstrapRegionPower } from './regionPower.js';   // AUDIT 26 F107   // PlayerEntity.InitializeRegionData (:2189-2218), at every new game

/** SPELLS.STD as an index -> spell map. AUDIT 17f: the exterior
 *  hosts ran chargen without one and called finishChargen with no
 *  spell table at all, so a Mage or Spellsword created in a TOWN
 *  started with an EMPTY spellbook - the same character created in
 *  the dungeon host got their three starting spells. One loader, so
 *  a host cannot forget it. Returns null (loud) when the file is
 *  unavailable, which is the pre-existing no-magic fallback. */
export async function loadSpellIndex(fetchBytes) {
  try {
    return spellsByIndexMap(readSpellsStd(await fetchBytes('SPELLS.STD')));   // AUDIT 23 (FTD-2): FIRST record wins a duplicate index (RebuildClassicSpellsDict)
  } catch (e) {
    console.warn('[chargen] SPELLS.STD unavailable; the starting spellbook stays empty', e);
    return null;
  }
}

/** All 18 classes' question sets, index-keyed - the shape
 *  createChargenWindow wants. A class whose file is missing is simply
 *  absent, and its biography screen is skipped. */
export async function loadBiogs(fetchBytes) {
  const out = [];
  for (let i = 0; i < CLASS_CAREERS.length; i++) out.push(await loadBiog(fetchBytes, i));
  return out;
}

/** S3e: one class's BIOGRAPHY questions (BIOG<class>T0.TXT). The
 *  file is latin1 text, not a binary record table. Returns null
 *  (loud) when unavailable, which skips the biography screen. */
export async function loadBiog(fetchBytes, classIndex) {
  try {
    const bytes = await fetchBytes(biogFileName(classIndex));
    const text = new TextDecoder('latin1').decode(bytes);
    return parseBiog(text, classIndex);
  } catch (e) {
    console.warn(`[chargen] ${biogFileName(classIndex)} unavailable; the biography questions are skipped`, e);
    return null;
  }
}

/** U18: the class-questions data - TEXT.RSC 9000's forty questions
 *  and CLASSES.DAT's results table. Null halves are LOUD and skip the
 *  questions path (the method screen's questions arm falls to the
 *  list); DFU throws on both. */
export async function loadClassQuestionData(fetchBytes) {
  let questionLibrary = null, classesData = null;
  try {
    questionLibrary = parseQuestionLibrary(new TextRsc().load(await fetchBytes('TEXT.RSC')));
    if (!questionLibrary) console.warn('[chargen] TEXT.RSC has no record 9000; the class questions are skipped');
  } catch (e) { console.warn('[chargen] TEXT.RSC unavailable; the class questions are skipped', e); }
  try {
    classesData = await fetchBytes('CLASSES.DAT');
  } catch (e) { console.warn('[chargen] CLASSES.DAT unavailable; the class questions are skipped', e); }
  return { questionLibrary, classesData };
}

/** The 18 classic careers (CLASS00..17.CFG). */
export async function loadCareers(fetchBytes) {
  const careers = [];
  for (let i = 0; i < CLASS_CAREERS.length; i++) {
    const cf = new ClassFile();
    cf.load(await fetchBytes(`CLASS${String(i).padStart(2, '0')}.CFG`));
    careers.push({ name: cf.career.name || CLASS_CAREERS[i], career: cf.career });
  }
  return careers;
}

/** AUDIT 17f: the HEADLESS skip (?class=N) - the rolls-and-go path
 *  the dungeon host has had since U2b. It lived only there, so the
 *  exterior hosts parsed ?class for the dungeon they might build and
 *  ignored it for their OWN chargen: a probe (or anyone booting a
 *  town) had no way past the overlay, which is how S3c broke the
 *  U8d/U8e/U8g probes without a gate noticing. One implementation,
 *  three hosts. */
export async function applyHeadlessChargen(playerEntity, classIndex, { fetchBytes, spellsByIndex = null } = {}) {
  const cf = new ClassFile();
  cf.load(await fetchBytes(`CLASS${String(classIndex).padStart(2, '0')}.CFG`));
  createCharacter(playerEntity, cf.career, classIndex);
  playerEntity.spells = startingSpells(classIndex, spellsByIndex);
  // S3d: the same kit every other creation path gets
  playerEntity.items = [];
  playerEntity.equip = null;
  // AUDIT 24 (wave 28): [100 x 7], not null. CharacterDocument.cs:86-88
  // fills the seven parts with 100 ("no armor") at creation and
  // PlayerEntity.AssignCharacter copies it wholesale (:853), so a fresh
  // DFU character carries the array from the first frame.
  //
  // The null was a lazy-rebuild trick that never fired:
  // updateEquippedArmorValues (equip.js:250) early-returns for a
  // non-Armor, non-footwear item BEFORE it reaches armorValuesOf, and
  // the starting kit is a shirt and pants. So the array stayed null
  // until the first armour equip or a save-and-reload, and
  // CalculateArmorToHit fell through to the scalar `armor: 0` - where
  // DFU reads 100. A rat at chance-to-hit 30 computes 30+100-50 = 80%
  // in DFU and 30+0-50 = -20 in the port, clamped to the 3% floor.
  // Enemies essentially could not hit a new character.
  playerEntity.armorValues = new Array(NUMBER_BODY_PARTS).fill(100);
  assignStartingGear(playerEntity, { classIndex });
  // AUDIT 20 / THE ONE CONSTRUCTION SEAM, again. This path is a SECOND
  // copy of the construction - it hand-rolls the kit rather than going
  // through applyCreationExtras - and so it silently missed the faction
  // store S25 added, exactly the shape 17f/17h/17i each found before.
  // A ?class= character had no factionRep at all: crimes moved no
  // faction, and guild rank could not be computed.
  attachFactionRep(playerEntity, await loadFactions(fetchBytes));
  // StartGameBehaviour.cs:433 InitializeRegionData - the same store the
  // wizard's path mints, on the second construction copy above.
  playerEntity.regionConditions = createRegionConditions();
  // AUDIT 26 F107: InitializeRegionData's own tail (:2211-2217).
  bootstrapRegionPower(playerEntity.factionRep, { regionConditions: playerEntity.regionConditions });
  console.log(`[chargen] ${CLASS_CAREERS[classIndex]}: HP ${playerEntity.maxHealth}, spells ${playerEntity.spells.length}`);
  return playerEntity;
}

/** U20a follow-up / THE ONE SEAM: everything a NEW character gets
 *  besides its rolled career - the starting spellbook, the starting
 *  kit and the custom reputations. finishChargen and the hosts'
 *  font-less fallback both come through here, because the dungeon
 *  fallback had hand-rolled its own copy and so silently dropped
 *  every field the flow grew (17f found that shape for the
 *  spellbook, 17h for the biography, and it had regrown for U20a's
 *  isCustom and reputations).
 *
 *  - spells: SetStartingSpells (StartGameBehaviour.cs:802-826) - a
 *    CUSTOM class takes the Spellsword set only with a magic primary
 *    or major, a standard one takes its own class set.
 *  - the kit: AssignStartingGear runs ONCE, at creation; the bag is
 *    cleared first so an interim seed leaves no stray dagger.
 *  - the reputations: PlayerEntity.AssignCharacter (:844-848) seeds
 *    the five social groups BEFORE any biography effect adds to them.
 *  - the biography and the faction store (AUDIT 39): ApplyEffects runs
 *    BEFORE AssignStartingEquipment in DFU, and the store the `rf`
 *    deltas drain into is what InitializeRegionData then walks. A
 *    result carrying neither (the hosts' font-less fallback) skips
 *    both arms and keeps the rest of the seam. */
export function applyCreationExtras(playerEntity, result, spellsByIndex = null, { rolls = Math.random } = {}) {
  if (spellsByIndex) {
    const setIndex = result.isCustom ? customSpellSetIndex(result.career) : result.careerIndex;
    playerEntity.spells = setIndex == null ? [] : startingSpells(setIndex, spellsByIndex);
  }
  playerEntity.items = [];
  playerEntity.equip = null;
  // AUDIT 24 (wave 28): [100 x 7], not null. CharacterDocument.cs:86-88
  // fills the seven parts with 100 ("no armor") at creation and
  // PlayerEntity.AssignCharacter copies it wholesale (:853), so a fresh
  // DFU character carries the array from the first frame.
  //
  // The null was a lazy-rebuild trick that never fired:
  // updateEquippedArmorValues (equip.js:250) early-returns for a
  // non-Armor, non-footwear item BEFORE it reaches armorValuesOf, and
  // the starting kit is a shirt and pants. So the array stayed null
  // until the first armour equip or a save-and-reload, and
  // CalculateArmorToHit fell through to the scalar `armor: 0` - where
  // DFU reads 100. A rat at chance-to-hit 30 computes 30+100-50 = 80%
  // in DFU and 30+0-50 = -20 in the port, clamped to the 3% floor.
  // Enemies essentially could not hit a new character.
  playerEntity.armorValues = new Array(NUMBER_BODY_PARTS).fill(100);
  if (result.customReps) {
    if (!playerEntity.sGroupReputations) playerEntity.sGroupReputations = new Array(SOCIAL_GROUP_COUNT).fill(0);
    for (let i = 0; i < result.customReps.length; i++) playerEntity.sGroupReputations[i] = result.customReps[i];
  }
  // AUDIT 39: THE BIOGRAPHY LANDS BEFORE THE KIT, as DFU orders it -
  // BiogFile.ApplyEffects (StartGameBehaviour.cs:415-416) then
  // AssignStartingEquipment (:419). AddItem's default is
  // AddPosition.Back, so the collection order IS the bag order: an
  // answer's IT item heads the list in classic and trailed the torches
  // here, and its GP arithmetic ran against the kit's 100 gold instead
  // of an empty purse (a "-" command clamps at 0, so the sign of the
  // divergence is real money). The reputations stay ahead of it -
  // AssignCharacter seeds the five groups (:844-848) before any
  // biography effect adds to them.
  if (result.biographyEffects?.length) applyBiographyEffects(playerEntity, result.biographyEffects, { rolls });
  // S25/AUDIT 39: the faction store, built and drained of whatever the
  // biography parked - BiogFile.cs:339 applies its `rf` deltas INSIDE
  // ApplyEffects, so the drain belongs immediately after it. It must
  // also precede the region bootstrap below, which walks this very
  // store: this call used to sit in finishChargen, thirty lines LATER,
  // so InitializeRegionData's 24 passes walked an undefined dict and
  // returned at once - and even a store attached by some other route
  // was then thrown away, since attachFactionRep rebuilds fresh
  // records out of the dictionary.
  if (result.factionDict) attachFactionRep(playerEntity, result.factionDict);
  assignStartingGear(playerEntity, { classIndex: result.careerIndex, isCustom: result.isCustom ?? false, rolls });
  // StartGameBehaviour.cs:432-433 "Initialize region data" ->
  // PlayerEntity.InitializeRegionData (:2189-2218): every new character
  // is born with the 62-region condition store, so the writers that
  // read it work from day one. The store's only other assignment was
  // the save restore, so a session started FRESH ran with none: the
  // PricesHigh/PricesLow half of UpdateRegionalPrices (shopStock.js,
  // `if (!conditions) continue;`) never executed and the first save
  // recorded a blank store. Nothing in the mint reads the character,
  // so it sits with the rest of what creation hands out.
  playerEntity.regionConditions = createRegionConditions();
  bootstrapRegionPower(playerEntity.factionRep, { regionConditions: playerEntity.regionConditions });   // AUDIT 26 F107: InitializeRegionData's tail (:2211-2217)
  return playerEntity;
}

/** Apply a finished flow result onto the entity: the career/stat/
 *  skill derivations (applyCharacter), the starting spellbook, and
 *  the IDENTITY the paperdoll reads. */
export function finishChargen(playerEntity, result, spellsByIndex = null, { rolls = Math.random } = {}) {
  applyCharacter(playerEntity, result.career, result.careerIndex, result);
  // U13: the reflex pick. Both consumers were already live - the
  // EnemyAttack melee timer (450ms per step from Average) and the
  // monster multi-attack gate (50 - 10*(reflexes-2)) - reading a
  // hardcoded Average until the screen existed.
  if (result.reflexes != null) playerEntity.reflexes = result.reflexes;
  // U13 / AUDIT 18: the composed biography prose. AssignCharacter
  // copies it onto the entity (PlayerEntity.cs:871 `BackStory =
  // character.backStory;`) and DaggerfallPlayerHistoryWindow reads it
  // back; nothing here assigned it, so save.js only ever serialised [].
  playerEntity.backStory = [...(result.backStory ?? [])];
  // S3e: the biography effects land over the BUILT character (after
  // applyCharacter's rolls, so a skill bonus rides on top of the
  // distributed value) and the faction store is attached and drained
  // with them - both inside applyCreationExtras since AUDIT 39, where
  // DFU's own order puts them: ahead of the starting kit, and ahead of
  // the region bootstrap that reads the store.
  applyCreationExtras(playerEntity, result, spellsByIndex, { rolls });
  // AUDIT 18: and the LEVEL-UP ANCHOR is taken AFTER them
  // (StartGameBehaviour.cs:424-426 - SetCurrentLevelUpSkillSum, then
  // StartingLevelUpSkillSum = CurrentLevelUpSkillSum), unconditionally.
  // applyCharacter's anchor is the pre-biography sum, so every SKILL
  // line a biography answer carried used to read as post-creation
  // progress: calculatePlayerLevel saw ~+20 already banked and the
  // first raiseSkills raise jumped the character straight to level 3.
  playerEntity.currentLevelUpSkillSum = levelUpSkillSum(playerEntity);
  playerEntity.startingLevelUpSkillSum = playerEntity.currentLevelUpSkillSum;
  return playerEntity;
}

/** FACTION.TXT for the chargen flow. TOLERANT on purpose: the talk
 *  host already wraps its own load in a try/catch, and a missing
 *  faction file must not stop a character being made. Null means the
 *  biography's `rf` deltas stay parked on the entity exactly as they
 *  did before S25 - degraded, not broken, and not silent. */
async function loadFactions(fetchBytes) {
  try {
    const ff = new FactionFile();
    ff.load(await fetchBytes('FACTION.TXT'));
    return ff.factionDict;
  } catch (e) {
    console.warn('[chargen] FACTION.TXT unavailable, faction reputation stays parked:', e.message);
    return null;
  }
}

/** AUDIT 17i / THE ONE-SEAM RULE: everything the flow needs, loaded
 *  and ATTACHED in one place.
 *
 *  The dungeon host built its own ChargenFlow by hand while the
 *  exterior hosts went through createChargenWindow, so it
 *  structurally missed every dependency the flow grew: 17f found it
 *  for the starting spellbook and again for the starting kit, 17h for
 *  the biography. Three instances of one shape. The fix is not to
 *  remember the dungeon host - it is that a host may no longer
 *  CONSTRUCT a flow. Both call this, and a future dependency is added
 *  HERE, once, where no host can miss it.
 *
 *  Returns { flow, careers, spellsByIndex, biogs } - the flow ready to
 *  run, plus the tables a host needs for finishChargen. */
export async function createChargenFlow(fetchBytes, { rolls = Math.random } = {}) {
  const [careers, spellsByIndex, biogs, questionData, factionDict] = await Promise.all([
    loadCareers(fetchBytes), loadSpellIndex(fetchBytes), loadBiogs(fetchBytes),
    loadClassQuestionData(fetchBytes),   // U18
    loadFactions(fetchBytes),            // S25
  ]);
  const flow = new ChargenFlow(careers, rolls);
  flow.biogFor = (i) => biogs[i] ?? null;   // S3e
  flow.questionLibrary = questionData.questionLibrary;   // U18
  flow.classesData = questionData.classesData;
  // S25: FACTION.TXT rides the FLOW, so it reaches finishChargen
  // through flow.result() rather than through a fifth return value a
  // host has to remember to unpack. dungeonContext takes `.flow` off
  // this call and drops everything else - the exact shape THE ONE
  // CONSTRUCTION SEAM exists to defeat - so a new dependency that
  // travels on the RESULT cannot be missed by any of the three hosts.
  flow.factionDict = factionDict;
  return { flow, careers, spellsByIndex, biogs, factionDict };
}

/** An overlay-shaped chargen window for the exterior hosts.
 *  onDone(result) fires once, after the flow reaches 'done'.
 *
 *  THE SKIN IS CHOSEN HERE AND NOWHERE ELSE. This is already THE ONE
 *  CONSTRUCTION SEAM (AUDIT 17i split it out because three separate
 *  bugs came from hosts wiring chargen by hand), so the enhanced
 *  wizard mounts through the same door rather than teaching each host
 *  a second one. A host that reached for ui/enhancedChargen.js itself
 *  would be the 17i shape again, and a sweep fails the suite if one
 *  does.
 *
 *  THE FOUR HOSTS, each named as the rule demands:
 *    - scenes/world.js       WIRED (it calls this)
 *    - scenes/exterior.js    WIRED (it calls this)
 *    - scenes/worldModes.js  N/A - interiors never run the wizard
 *    - scenes/dungeonContext.js  WIRED (wave D - it calls this). It
 *      held the RAW flow as its own overlay and drew it directly, so
 *      it could reach neither the skin fork nor the fire-once latch;
 *      routing it here also stopped it letterboxing the wizard TWICE
 *      (its non-native draw arm applied a screen offset under art
 *      that reads nativeMetrics off the real canvas itself). Since
 *      U31 that path is the `?dungeon` dev scene alone, which is why
 *      it stayed open so long - but small is not the same as absent. */
export function createChargenWindow(flow, { onDone, onCancel, hudScale = 2 } = {}) {
  let _fired = false;
  // A DOM view needs a DOM. The headless suite constructs this window
  // to pin the fire-once law and has no document, so the fork asks
  // rather than assuming - and a host without one keeps the canvas
  // wizard, which is the never-traps law rather than a special case
  // for tests.
  if (isEnhanced() && typeof document !== 'undefined') {
    return enhancedChargenOverlay(flow, { onDone, onCancel });
  }
  return {
    flow,
    isChoiceWindow: true,   // raw key codes through the overlay seam
    get done() { return flow.done; },
    input(code, ev) {
      // AUDIT 17f / THE MODAL CONTRACT: the doc above promised onDone
      // fires once and the code did not - every key after the flow
      // reached 'done' fired it again, and each call re-ran
      // applyCharacter and re-rolled the starting kit. A host that
      // tears the overlay down on `.done` hid it; a key repeat inside
      // the same frame did not.
      if (_fired) return;
      // the SHARED overlay table (ui/input.js) - not a second copy
      // ROAD-E2: the EVENT is built once and handed BOTH to the table
      // and to the flow. The flow asks the DaggerfallShortcut table
      // about modifiers (the builder's Ctrl-U ResetBonusPool), and the
      // action string alone cannot carry them - 'char:u' is what Ctrl-U
      // and a bare u both look like here.
      const kev = ev ?? { key: codeToKey(code) };
      const a = overlayAction(kev);
      if (a) flow.input(a, kev);
      // ui-chargen-4: backing out of the race screen cancels the
      // wizard (the flow flags it; the host unwinds) - once, like done
      if (flow.cancelled) { _fired = true; onCancel?.(); return; }
      if (flow.done) { _fired = true; onDone?.(flow.result()); }
    },
    // U10: the shared overlay pointer seam hands NATIVE coords; the
    // classic screens are clickable exactly where DFU's buttons are.
    click(vx, vy) {
      if (_fired) return;
      flow.clickNative(vx, vy);
      if (flow.cancelled) { _fired = true; onCancel?.(); return; }
      if (flow.done) { _fired = true; onDone?.(flow.result()); }
    },
    // ROAD-E2 / THE FOUR HOSTS RULE: the HOVER seam, which the wizard
    // had no use for until the list pickers' scroll bar gained a
    // thumb drag. VerticalScrollBar.Update (:101-130) polls
    // InputManager.GetMouseButton(0) every frame, and `e.buttons` is
    // the port's only reading of it - without this the thumb could
    // latch on the press and then never move. Every host that runs
    // the wizard already routes a mousemove here: world.js and
    // exterior.js through `townTalk.hover` (townTalk.js:1076-1087,
    // the route itself :1085), dungeonContext.js through `overlayHover`
    // (:4574), which dungeon.js:351 and worldModes.js:6506 both feed.
    // (ROAD-G G4 review: all four were stale - re-resolved by content,
    // against the same six routes G4-11 sweeps.) Hovering never
    // advances the flow, so no done check.
    hover(vx, vy, e = null) { if (!_fired) flow.hover?.(vx, vy, e); },
    // ROAD-G G4: THE OTHER EDGE, on the same rule. The hover seam above
    // is GetMouseButton(0)'s per-frame poll; this is the frame it turns
    // false (VerticalScrollBar.Update's else arm, :123-129), and every
    // host that routes the hover routes it - `townTalk.pointer('up')`
    // reaches a window that has only `release()`, `worldModes`' interior
    // slot and `dungeonContext.overlayPointer`'s up arm call it beside
    // their pointer route, and `interior.js` has its own listener.
    // Releasing never advances the flow, so no done check.
    release() { if (!_fired) flow.releasePickBar?.(); },
    // U-scroll: the hosts' wheel seam (scroll never advances the flow,
    // so no done check).
    wheel(dir) { if (!_fired) flow.wheel?.(dir); },
    // F2 / THE FOUR-HOSTS RULE: every host that runs the wizard drives
    // the overlay's clock through this wrapper - dungeonContext reached
    // flow.tick directly until wave D put it through this door too.
    tick(dt) { flow.tick?.(dt); },
    // FS-slice (wave D): the host's OWN scale wins when it hands one
    // in. Every overlay seam in the tree passes the letterbox scale it
    // just computed off the real canvas (townTalk:881,
    // dungeonContext's drawOverlay), and this arm dropped it on the
    // floor for the constructed default - so the art-less interim
    // panels drew at 2 on a canvas the rest of the UI was drawing at 3
    // or 4. `hudScale` stays the default for a caller that passes none.
    draw(renderer, canvas, font, scale = hudScale) { flow.draw(renderer, canvas, font, scale); },
  };
}

/**
 * THE ENHANCED WIZARD, in the shape the hosts already push.
 *
 * It answers the same overlay contract and does almost nothing with
 * it, because the DOM view owns its own input: the div is fixed and
 * opaque over the canvas, so pointers never reach the host's seam, and
 * the wizard's own keydown listener answers keys through the same
 * overlayAction table this window uses. The host's arms are therefore
 * NO-OPS BY DESIGN rather than by omission, and each says so - a
 * silently empty input() here would look identical to a broken one.
 *
 * `done` stays FALSE until the view has been taken down. The hosts
 * tear an overlay down when it reports done, and a DOM node outlives
 * the object that reports it, so the order is: unmount, then fire.
 */
function enhancedChargenOverlay(flow, { onDone, onCancel } = {}) {
  let fired = false;
  let view = null;
  const finish = (why) => {
    if (fired) return;
    fired = true;
    view?.unmount();
    view = null;
    if (why === 'cancel') onCancel?.();
    else onDone?.(flow.result());
  };
  // Mounted lazily and asynchronously: the module carries the whole
  // enhanced design and a player on the classic skin must not pay for
  // it. A failure to load costs the wizard, so it says so loudly
  // rather than leaving a host with an overlay that draws nothing.
  const host = document.createElement('div');
  host.id = 'enhanced-chargen';
  host.style.cssText = 'position:fixed;inset:0;z-index:14;background:#0e1013;overflow:hidden';
  document.body.append(host);
  import('../ui/enhancedChargen.js').then(async ({ mountEnhancedChargen, attachChargenText }) => {
    const deps = await chargenViewDeps();
    attachChargenText(flow, deps.textRsc);
    view = mountEnhancedChargen(host, { flow, ...deps, onExit: finish });
    view.unmount = ((inner) => () => { inner(); host.remove(); })(view.unmount);
  }).catch((e) => {
    console.warn('[chargen] the enhanced wizard would not mount', e);
    host.remove();
  });
  return {
    flow,
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the view's own keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    tick() { /* no constellation animation on this side yet */ },
    draw() { /* DOM, not canvas */ },
    dispose() { view?.unmount(); view = null; host.remove(); },
  };
}

/** The art the DOM view needs and the GL path never did: both map
 *  files with a palette, the ten head records as canvases, and
 *  TEXT.RSC for the five injectable text sources. Every one is
 *  optional - the wizard runs without any of them and says what it
 *  lost. */
async function chargenViewDeps() {
  const out = { picker: null, picture: null, palette: null, loadFaces: null, textRsc: null };
  const [{ ImgFile }, { DFPalette }, { CifRciFile }, { TextRsc }, races, { bitmapCanvas }] =
    await Promise.all([
      import('../formats/imgFile.js'), import('../formats/dfPalette.js'),
      import('../formats/cifRciFile.js'), import('../formats/textRsc.js'),
      import('./races.js'), import('../ui/bitmapCanvas.js'),
    ]);
  const { getBytes } = await import('../scenes/dataSource.js');
  const img = async (name) => {
    const f = new ImgFile();
    f.load(await getBytes(name), name, new DFPalette());
    return f.getDFBitmap(0, 0);
  };
  try { out.textRsc = new TextRsc().load(await getBytes('TEXT.RSC')); }
  catch (e) { console.warn('[chargen] TEXT.RSC unavailable; descriptions stay empty', e); }
  try {
    const pal = new DFPalette();
    pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
    const rgb = (i) => { const c = pal.get(i); return [c.r, c.g, c.b]; };
    out.palette = rgb;
    out.picker = await img('TAMRIEL2.IMG');
    try { out.picture = await img('TMAP00I0.IMG'); }
    catch (e) { console.warn('[chargen] TMAP00I0 unavailable; the Imperial Province is absent', e); }
    out.loadFaces = async (raceKey, gender) => {
      const name = races.raceArt(raceKey, gender).heads;
      const cif = new CifRciFile();
      cif.load(await getBytes(name), name, pal);
      const set = [];
      for (let i = 0; i < races.FACES_PER_RACE; i++) {
        set.push(bitmapCanvas(cif.getDFBitmap(i, 0), rgb, { scale: 2 }));
      }
      return set;
    };
  } catch (e) {
    console.warn('[chargen] the map art is unavailable; the homelands fall to a list', e);
  }
  return out;
}

/** The hosts hand us KeyboardEvent.code strings; overlayAction reads
 *  .key. Translate the codes chargen actually needs. */
function codeToKey(code) {
  if (typeof code !== 'string') return '';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  return ({
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Enter: 'Enter',
    Backspace: 'Backspace', Escape: 'Escape', Space: ' ',
    Equal: '=', Minus: '-', NumpadAdd: '+', NumpadSubtract: '-',
  })[code] ?? '';
}
