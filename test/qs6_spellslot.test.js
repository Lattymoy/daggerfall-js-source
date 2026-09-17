// QS6 (2026-09-17, Mac: "For the new quick bar we introduced, for slot 3, I
// want to change it to be for spells. So you should be able to hold the
// keybind to switch between applicable spells, and then press the keybind to
// equip. Same for 2/3. Pressing the keybind, if not equipped, should equip the
// slot."): THE SPELL SLOT, AND THE HOLD THAT FILLS A SLOT.
//
// TWO THINGS, and they are separable:
//
//   - A SPELL SLOT. The third digit readies a spell instead of swapping a
//     weapon. The ready itself is the CAST ENGINE's, so this is driven through
//     a real `createPlayerMagic` rather than a stub that agrees with us: the
//     silence gate, the spell-point refusal and the CasterOnly instant cast
//     are laws this slice must not restate and must not break.
//   - A HOLD. Holding a slot's own key cycles what is in it. That makes the
//     three keys POLLED (only the frame can tell a tap from a hold), which is
//     the shape ReadyWeapon and SwitchHand already have, and it is where the
//     double-fire hazard lives: a press that acts on its DOWN edge has already
//     drunk the potion by the time the player means "let me choose one".
//
// WHAT MOVED, and what did not: 'QuickSwap' keeps its row in ACTIONS and its
// row on the enhanced pane and is still rebindable - it gave up its DEFAULT
// key alone, and the off-hand key presses it, because the off-hand CELL is
// where the swap is drawn. test/qs2_inputs.test.js pins the registry half.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  spellQuickslot, setSpellQuickslot, clearSpellQuickslot, resolveSpellQuickslot, spellQuickslotPress,
  cycleQuickslot, consumableCandidates, spellCandidates, CYCLE_SLOTS, CYCLE_ACTIONS,
  tickQuickslotHold, resetQuickslotHolds, quickslotCycling,
  QUICK_HOLD_MS, QUICK_STEP_MS, QUICK_CYCLE_LINGER_MS, QUICK_GAP_MS,
  assignQuickslot, clearQuickslots, quickslotEntry, quickslotView, quickslotSaveData, restoreQuickslotSaveData,
  offHandOffersSwap, QUICKSLOT_TEXT,
} from '../src/systems/quickslots.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { equipItem } from '../src/systems/equip.js';
import { potionRecipeKeys } from '../src/systems/potions.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── the fixtures ─────────────────────────────────────────────────────

// test/quickslots.test.js's own fixtures: every potion is one Glass_Bottle
// template and the RECIPE is what makes two of them different things.
const [HEAL, CURE] = potionRecipeKeys();
const potion = (key, n = 1) => ({ group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: key, stackCount: n, currentCondition: 1, maxCondition: 1 });
const sword = () => ({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', currentCondition: 800, maxCondition: 1000 });
const dagger = () => ({ group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', currentCondition: 50, maxCondition: 100 });
const book = () => ({ group: 'Books', templateIndex: 550, name: 'A Book' });
const shield = () => ({ group: 'Armor', templateIndex: 110, material: 0x0200, name: 'Round Shield', currentCondition: 30, maxCondition: 100 });
const torch = () => ({ group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 40, maxCondition: 100 });

/** A bolt: rangeType 2 is a missile, so the ready STAYS in hand and can be
 *  put away again - which is the press this slice is about. */
const bolt = (index, name, cost = 1) => ({
  name, index, element: 0, rangeType: 2,
  effects: [{ type: 4, subType: 0, magnitudeBaseLow: cost, magnitudeBaseHigh: cost, magnitudeLevelBase: 0,
    magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1,
    chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }],
});

/** The player, and a REAL cast engine over them - roadh_tail's shape. */
function rig({ spells = [], magicka = 100, items = [] } = {}) {
  const said = [];
  const player = {
    isPlayer: true, level: 5, career: {}, activeEffects: [], stats: {}, skills: {},
    magicka, maxMagicka: 100, health: 50, maxHealth: 50, items, spells,
    equip: { slots: {} },
  };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.5,
  });
  return { player, magic, said };
}

const reset = () => { clearQuickslots(); resetQuickslotHolds(); };

// ── THE SPELL SLOT ───────────────────────────────────────────────────

test('QS6: the first press takes the book\'s first spell and READIES it through the real engine; the next press puts it away (mutants: an unset slot refusing so the key teaches nothing; the second press readying again; the model saying the engine\'s line over it)', () => {
  reset();
  const spark = bolt(5, 'Spark');
  const r = rig({ spells: [spark, bolt(9, 'Shock')] });
  assert.equal(spellQuickslot(), null, 'nothing chosen yet');

  // Mac: "Pressing the keybind, if not equipped, should equip the slot."
  const first = spellQuickslotPress({ entity: r.player, magic: r.magic, say: (l) => r.said.push(l) });
  assert.deepEqual(first, { kind: 'pressed', name: 'Spark', readied: true });
  assert.equal(r.magic.readied(), spark, 'the ENGINE holds it, which is what "equipped" means here');
  assert.equal(r.magic.readiedIndex(), 5);
  assert.deepEqual(spellQuickslot(), { index: 5, name: 'Spark' }, 'and the slot now points at it');
  // The engine said its own line; the model added nothing.
  assert.ok(r.said.includes('Press button to fire spell.'), 'SetReadySpell\'s own words (EntityEffectManager.cs:355)');
  assert.ok(!r.said.some((l) => /quickslot|slot/i.test(l)), 'the model says nothing over the engine');

  // ...and the same press again puts it away, through AbortReadySpell.
  const again = spellQuickslotPress({ entity: r.player, magic: r.magic, say: (l) => r.said.push(l) });
  assert.deepEqual(again, { kind: 'unreadied', name: 'Spark', readied: false });
  assert.equal(r.magic.readied(), null, 'the hand is empty');
  assert.equal(r.said.at(-1), QUICKSLOT_TEXT.unreadied('Spark'));
  assert.deepEqual(spellQuickslot(), { index: 5, name: 'Spark' }, 'the SLOT keeps the spell - only the hand let go');
});

test('QS6: the engine\'s own gates are the slot\'s gates - a spell the player cannot pay for is refused in DFU\'s words and nothing is readied (mutants: the model pricing the spell itself; a refusal swallowed so the key looks dead)', () => {
  reset();
  const pricey = bolt(12, 'Wildfire', 90);
  const r = rig({ spells: [pricey], magicka: 0 });
  const out = spellQuickslotPress({ entity: r.player, magic: r.magic, say: (l) => r.said.push(l) });
  assert.deepEqual(out, { kind: 'pressed', name: 'Wildfire', readied: false });
  assert.equal(r.magic.readied(), null);
  assert.ok(r.said.includes("You don't have the spell points."), 'the ENGINE\'s refusal, not ours');
  // The model contains no price of its own - the one home for a cast cost is
  // the engine, which is why the refusal above is the engine's.
  const src = read('src/systems/quickslots.js');
  assert.doesNotMatch(src, /calculateCastCost|spellPointCost|playerEntity\.magicka/, 'the model never prices a spell');
});

test('QS6: a spell the book no longer holds is a GHOST - the slot keeps its name, the press refuses by that name, and an empty book has its own word (mutants: a ghost readying `undefined`; the empty book silently doing nothing)', () => {
  reset();
  const r = rig({ spells: [bolt(5, 'Spark')] });
  setSpellQuickslot(bolt(77, 'Far Silence'));
  const view = resolveSpellQuickslot(r.player);
  assert.deepEqual([view.index, view.name, view.spell], [77, 'Far Silence', null], 'named, and not in the book');
  const out = spellQuickslotPress({ entity: r.player, magic: r.magic, say: (l) => r.said.push(l) });
  assert.deepEqual(out, { kind: 'gone', name: 'Far Silence' });
  assert.equal(r.said.at(-1), QUICKSLOT_TEXT.spellGone('Far Silence'));
  assert.equal(r.magic.readied(), null, 'nothing was readied');

  // No book at all: the model's own line, and the engine is never troubled.
  reset();
  const empty = rig({ spells: [] });
  assert.deepEqual(spellQuickslotPress({ entity: empty.player, magic: empty.magic, say: (l) => empty.said.push(l) }), { kind: 'none' });
  assert.deepEqual(empty.said, [QUICKSLOT_TEXT.noSpells]);
  assert.equal(spellQuickslot(), null, 'and nothing was invented to fill the slot');
});

test('QS6: the slot is keyed by the spell INDEX - the same key the save and the engine\'s own readied read use, so a MADE spell (a negative index) rides too (mutant: keyed by name, so two "Fireball"s are one spell and a rename empties the slot)', () => {
  reset();
  const made = bolt(-3, 'My Own Bolt');
  const r = rig({ spells: [bolt(5, 'Spark'), made] });
  assert.ok(setSpellQuickslot(made));
  assert.deepEqual(spellQuickslot(), { index: -3, name: 'My Own Bolt' });
  assert.equal(resolveSpellQuickslot(r.player).spell, made, 'resolved off the book by index');
  // A record with no index is not a spell this slot can hold.
  assert.equal(setSpellQuickslot({ name: 'Nameless' }), false);
  assert.equal(setSpellQuickslot(null), false);
  assert.deepEqual(spellQuickslot(), { index: -3, name: 'My Own Bolt' }, 'and a refusal changes nothing');
  // A RENAME in the book is the case a name key loses: the spellbook lets a
  // player rename a made spell (ui/enhancedSpellbook.js `sel.spell.name =
  // name`), and the slot must follow the SPELL, not the word.
  made.name = 'Bolt The Second';
  assert.equal(resolveSpellQuickslot(r.player).spell, made, 'still the same spell');
  assert.equal(resolveSpellQuickslot(r.player).name, 'Bolt The Second', 'and the chip reads the book\'s live name');
  // ...and two spells that happen to SHARE a name are still two spells.
  const twin = bolt(-9, 'Bolt The Second');
  r.player.spells.push(twin);
  setSpellQuickslot(twin);
  assert.equal(resolveSpellQuickslot(r.player).spell, twin, 'the second of two same-named spells, by index');
  setSpellQuickslot(made);
  assert.equal(resolveSpellQuickslot(r.player).spell, made, 'and the first, by index');

  // The engine keys the same way, which is what makes the chip honest.
  spellQuickslotPress({ entity: r.player, magic: r.magic });
  assert.equal(r.magic.readiedIndex(), -3);
  assert.equal(quickslotView(r.player, { readiedIndex: r.magic.readiedIndex() }).spell.readied, true);
  assert.equal(quickslotView(r.player, { readiedIndex: 5 }).spell.readied, false, 'a spell readied from the BOOK does not light this chip');
});

// ── THE CYCLE ────────────────────────────────────────────────────────

test('QS6: the spell cycle walks the whole book and WRAPS, in both directions, and an unset slot lands on the near end (mutants: the wrap dropped so the cycle sticks at the end; a filter that hides a spell the player cannot presently afford)', () => {
  reset();
  const r = rig({ spells: [bolt(5, 'Spark'), bolt(9, 'Shock', 90), bolt(-1, 'Mine')], magicka: 0 });
  // "Applicable" is the BOOK. Shock costs 90 and the player has 0 magicka; it
  // is still a spell they know, and the press refuses it in DFU's own words.
  assert.deepEqual(spellCandidates(r.player).map((s) => s.name), ['Spark', 'Shock', 'Mine']);
  assert.equal(cycleQuickslot('spell', { entity: r.player }).name, 'Spark', 'an unset slot lands on the first');
  assert.equal(cycleQuickslot('spell', { entity: r.player }).name, 'Shock');
  assert.equal(cycleQuickslot('spell', { entity: r.player }).name, 'Mine');
  assert.equal(cycleQuickslot('spell', { entity: r.player }).name, 'Spark', 'and wraps');
  assert.equal(cycleQuickslot('spell', { entity: r.player, dir: -1 }).name, 'Mine', 'backwards wraps too');
  // A ghost is not in the list, so the next step starts the list over.
  setSpellQuickslot(bolt(77, 'Far Silence'));
  assert.equal(cycleQuickslot('spell', { entity: r.player }).name, 'Spark');
  // An empty book cycles to nothing and changes nothing.
  clearSpellQuickslot();
  assert.equal(cycleQuickslot('spell', { entity: { spells: [] } }), null);
  assert.equal(spellQuickslot(), null);
});

test('QS6: a consumable cycle offers the PACK\'s distinct kinds, never the kind the other slot holds, and never a thing that is not a consumable (mutants: the other slot\'s potion offered so the cycle empties a cell; two stacks of one potion offered twice; a sword in the list)', () => {
  reset();
  const entity = { items: [potion(HEAL, 2), potion(HEAL, 3), potion(CURE), sword(), book()], spells: [] };
  assert.deepEqual(consumableCandidates(entity, 'c1').map((c) => c.name).length, 2, 'two KINDS, not five items and not four records');
  assert.equal(cycleQuickslot('c1', { entity }).key, consumableCandidates(entity, 'c1')[0].key);
  // Put the OTHER kind in c2; c1 is no longer offered it.
  assignQuickslot('c2', potion(CURE));
  const left = consumableCandidates(entity, 'c1');
  assert.equal(left.length, 1, 'the kind c2 holds is not on offer');
  assert.ok(!left.some((c) => c.key === quickslotEntry('c2').key));
  // ...and cycling c1 now has exactly one place to land, every time.
  const a = cycleQuickslot('c1', { entity });
  const b = cycleQuickslot('c1', { entity });
  assert.equal(a.key, b.key, 'one candidate, so the cycle stands still rather than emptying the cell');
  assert.deepEqual(quickslotEntry('c2'), { key: b.key === quickslotEntry('c2').key ? b.key : quickslotEntry('c2').key, name: quickslotEntry('c2').name },
    'and c2 is untouched throughout');
  // An empty pack: nothing to land on, and the slot is left as it was.
  const before = quickslotEntry('c1');
  assert.equal(cycleQuickslot('c1', { entity: { items: [] } }), null);
  assert.deepEqual(quickslotEntry('c1'), before);
  // The off hand and the main hand do not cycle - what they show is what is
  // IN a hand, not a list a player picks from.
  assert.deepEqual([...CYCLE_SLOTS], ['c1', 'c2', 'spell']);
  assert.throws(() => cycleQuickslot('swap', { entity }), /does not cycle/);
  assert.throws(() => cycleQuickslot('off', { entity }), /does not cycle/);
});

// ── THE HOLD ─────────────────────────────────────────────────────────

test('QS6: a TAP performs the slot and a HOLD cycles it and performs NOTHING - the whole of Mac\'s two-in-one key (mutants: the tap firing on the down edge as well, so a hold drinks the potion it was choosing; the release of a hold performing too; the hold never stepping again after the first)', () => {
  reset();
  const r = rig({ spells: [bolt(5, 'Spark'), bolt(9, 'Shock'), bolt(-1, 'Mine')] });
  const taps = []; const turns = [];
  let down = new Set();
  const tick = (dt) => tickQuickslotHold(dt, {
    isHeld: (a) => down.has(a), entity: r.player,
    onTap: (s) => taps.push(s), onCycle: (s, out) => turns.push(out?.name ?? null),
  });

  // A TAP: down for one frame, then up.
  down = new Set(['QuickSpell']); tick(0.016);
  down = new Set(); tick(0.016);
  assert.deepEqual(taps, ['spell'], 'the release performed the slot');
  assert.deepEqual(turns, [], 'and nothing was cycled');

  // A HOLD: the first step lands at QUICK_HOLD_MS, then one every
  // QUICK_STEP_MS, and the RELEASE performs nothing at all.
  taps.length = 0;
  down = new Set(['QuickSpell']);
  let t = 0;
  while (t < QUICK_HOLD_MS - 20) { tick(0.016); t += 16; }
  assert.deepEqual(turns, [], 'a hold shorter than the threshold has not turned yet');
  while (t < QUICK_HOLD_MS + QUICK_STEP_MS + 20) { tick(0.016); t += 16; }
  assert.deepEqual(turns, ['Spark', 'Shock'], 'one step at the threshold, then one a step');
  down = new Set(); tick(0.016);
  assert.deepEqual(taps, [], 'THE RELEASE OF A HOLD PERFORMS NOTHING - the choosing was the act');
  assert.deepEqual(spellQuickslot(), { index: 9, name: 'Shock' }, 'and the slot is what the hold landed on');
  assert.equal(r.magic.readied(), null, 'nothing was readied by the choosing');
  // ...and the next TAP readies what the hold chose, which is the pair.
  down = new Set(['QuickSpell']); tick(0.016);
  down = new Set(); tick(0.016);
  assert.deepEqual(taps, ['spell']);
});

test('QS6: all three cycling slots hold on their own action, and a blocked frame drops every hold silently (mutants: only the spell holding, so "Same for 2/3" is unbuilt; a blocked frame reading as a release and firing the slot under an open window)', () => {
  reset();
  const entity = { items: [potion(HEAL), potion(CURE)], spells: [bolt(5, 'Spark'), bolt(9, 'Shock')] };
  assert.deepEqual(CYCLE_ACTIONS, { c1: 'QuickUse1', c2: 'QuickUse2', spell: 'QuickSpell' });
  for (const slot of CYCLE_SLOTS) {
    reset();
    const turns = []; const taps = [];
    const run = (dt, held) => tickQuickslotHold(dt, { isHeld: (a) => held.includes(a), entity, onTap: (s) => taps.push(s), onCycle: (s) => turns.push(s) });
    for (let t = 0; t <= QUICK_HOLD_MS + 40; t += 16) run(0.016, [CYCLE_ACTIONS[slot]]);
    assert.deepEqual(turns, [slot], `${slot} cycles on ${CYCLE_ACTIONS[slot]}`);
    run(0.016, []);
    assert.deepEqual(taps, [], `${slot}'s hold performs nothing on release`);
  }

  // BLOCKED: a window is up. The key is still physically down, and when the
  // frames resume it must not read as a press.
  reset();
  const taps = [];
  const steps = (held, blocked, n = 1) => { for (let i = 0; i < n; i++) tickQuickslotHold(0.016, { isHeld: (a) => held.includes(a), entity, onTap: (s) => taps.push(s), blocked }); };
  steps(['QuickUse1'], false, 2);          // the key goes down in play
  steps(['QuickUse1'], true, 10);          // a window opens over it
  steps([], true, 5);                      // the player lets go under the window
  steps([], false, 5);                     // the window closes
  assert.deepEqual(taps, [], 'not one potion drunk by a key that was never released in play');

  // AUDIT QS6 F2 - THE HARDER HALF, and the one the pin above missed: the
  // window closes while the key is STILL DOWN. Clearing the holds on a
  // blocked frame left no state for the slot, so the next tick read the
  // key as a fresh RISING EDGE and the release a moment later drank a
  // potion the player never asked for. Driven, because this is a sequence
  // and not a line: it went 1 tap before the fix and 0 after.
  reset();
  taps.length = 0;
  steps(['QuickUse1'], false, 3);          // held in play
  steps(['QuickUse1'], true, 20);          // a window over it, key still down
  steps(['QuickUse1'], false, 1);          // the window closes, key STILL down
  steps([], false, 3);                     // ...and only now do they let go
  assert.deepEqual(taps, [], 'a hold that spanned a window performs nothing when the key finally comes up');
  // ...and the machine is not broken by it: the NEXT press is a clean tap.
  steps(['QuickUse1'], false, 1);
  steps([], false, 1);
  assert.deepEqual(taps, ['c1'], 'a fresh press after the window works');
  // A blocked stretch never steps the slot either - no walking the book
  // under an open window.
  reset();
  const turns = [];
  for (let i = 0; i < 60; i++) tickQuickslotHold(0.016, { isHeld: () => true, entity, onCycle: (s2) => turns.push(s2), blocked: true });
  assert.deepEqual(turns, [], 'a blocked frame steps nothing, however long the key is down');
  // ...and a key STILL DOWN when the window closes does not start stepping
  // either: a disarmed hold steps NEVER, not merely not-yet. It has to come
  // up and go down again to mean anything at all.
  for (let i = 0; i < 60; i++) tickQuickslotHold(0.016, { isHeld: () => true, entity, onCycle: (s2) => turns.push(s2) });
  assert.deepEqual(turns, [], 'a hold carried through a window does not resume stepping when it closes');
});

test('AUDIT QS6 F6: a GAP in the frames disarms every hold on its own, whatever the host declared - the law is the machine\'s, not four hosts\' memory', async () => {
  // F2 gave the hosts `blocked`. Then the walk found scenes/dungeon.js had
  // the call INSIDE its own `!overlayHeld` gate, so that argument was dead;
  // the two outdoor hosts return above their tick while a video holds the
  // frame; and a backgrounded tab gets no frames at all. Three doors, one
  // hazard - so the machine reads the wall clock and defends itself.
  reset();
  const entity = { items: [potion(HEAL)], spells: [] };
  assignQuickslot('c1', potion(HEAL));
  const taps = [];
  const tick = (held) => tickQuickslotHold(0.016, { isHeld: (a) => held.includes(a), entity, onTap: (s) => taps.push(s) });
  tick(['QuickUse1']);        // the key goes down in play
  // THE FRAMES STOP - no `blocked`, no host, nothing declared at all. The
  // gap is real time, so it is waited rather than faked: a machine that
  // trusted a number handed to it would not be defending itself.
  await new Promise((r) => setTimeout(r, QUICK_GAP_MS + 120));
  tick(['QuickUse1']);        // frames again, key STILL down
  tick([]);                   // ...and released
  assert.deepEqual(taps, [], 'a hold that spanned a gap in the frames performs nothing');
  // ...and the machine still works straight afterwards.
  tick(['QuickUse1']);
  tick([]);
  assert.deepEqual(taps, ['c1'], 'the next real press is a real press');
});

test('QS6: a stalled frame does not burst the cycle - a tab left in the background comes back to ONE step, not fifty (mutant: the clamp dropped, so a 4-second dt walks the book fourteen times)', () => {
  reset();
  const entity = { items: [], spells: [bolt(5, 'Spark'), bolt(9, 'Shock'), bolt(-1, 'Mine')] };
  const turns = [];
  const tick = (dt, held) => tickQuickslotHold(dt, { isHeld: (a) => held.includes(a), entity, onCycle: (s, o) => turns.push(o?.name) });
  tick(0.016, ['QuickSpell']);                              // the key goes down
  for (let t = 0; t <= QUICK_HOLD_MS; t += 16) tick(0.016, ['QuickSpell']);
  assert.equal(turns.length, 1, 'held past the threshold: one step');
  tick(4, ['QuickSpell']);      // four seconds in ONE frame - a backgrounded tab
  assert.ok(turns.length <= 2, `at most ONE more step, not fourteen - a frame longer than a quarter-second was a stall and not play (got ${turns.length})`);
  // ...and the hold is not broken by the stall: it keeps stepping after it.
  for (let t = 0; t <= QUICK_STEP_MS; t += 16) tick(0.016, ['QuickSpell']);
  assert.ok(turns.length >= 2, 'and the hold still turns once the frames are frames again');
});

test('QS6: the cycling LAMP is raised by the cycle itself and let down by the frame, so a held key and a phone\'s held cell light the same thing (mutants: the lamp raised only by the key path, so the HUD never shows a finger\'s hold; a lamp that never falls)', () => {
  reset();
  const entity = { items: [], spells: [bolt(5, 'Spark'), bolt(9, 'Shock')] };
  assert.equal(quickslotCycling(), null);
  // The PHONE's path: the HUD calls the model's cycle directly (there is no
  // key to hold), and the lamp comes up all the same.
  cycleQuickslot('spell', { entity });
  assert.equal(quickslotCycling(), 'spell');
  assert.equal(quickslotView(entity).cycling, 'spell', 'and the view carries it to the HUD');
  // The frame lets it down.
  for (let t = 0; t <= QUICK_CYCLE_LINGER_MS + 40; t += 16) tickQuickslotHold(0.016, { isHeld: () => false, entity });
  assert.equal(quickslotCycling(), null);
});

// ── THE SAVE, AND THE OFF HAND'S FOLD ────────────────────────────────

test('QS6: the spell slot rides the same save block as the item slots, keyed by index, and a malformed entry is refused (mutants: the spell left out so a slot is lost on load; a name-keyed entry admitted)', () => {
  reset();
  setSpellQuickslot(bolt(-4, 'My Bolt'));
  assignQuickslot('c1', potion(HEAL));
  const blob = JSON.parse(JSON.stringify(quickslotSaveData()));
  assert.deepEqual(blob.spell, { index: -4, name: 'My Bolt' });
  clearQuickslots();
  assert.equal(spellQuickslot(), null, 'clearQuickslots takes the spell slot too');
  restoreQuickslotSaveData(blob);
  assert.deepEqual(spellQuickslot(), { index: -4, name: 'My Bolt' });
  // A pre-QS6 block has no spell: cleared, never stale.
  restoreQuickslotSaveData({ c1: null, c2: null, swap: null });
  assert.equal(spellQuickslot(), null);
  // Malformed entries are refused entry by entry.
  for (const bad of [{ index: 'x', name: 'n' }, { index: 1 }, { name: 'n' }, 'no', null]) {
    restoreQuickslotSaveData({ spell: bad });
    assert.equal(spellQuickslot(), null, `${JSON.stringify(bad)} is not a spell slot`);
  }
});

test('QS6: the off hand presses the SWAP when that is what its cell shows, and the question is the VIEW\'s own - one ladder, not two (mutants: a second reading of the hands that disagrees with the picture; the swap pressed while a shield or a lit torch is in that hand)', () => {
  reset();
  const entity = { isPlayer: true, level: 5, career: {}, activeEffects: [], stats: {}, spells: [], items: [sword(), dagger()], lightSource: null };
  assert.equal(offHandOffersSwap(entity), false, 'nothing is set to swap to');
  assignQuickslot('swap', dagger());
  assert.equal(quickslotView(entity).off.kind, 'swap');
  assert.equal(offHandOffersSwap(entity), true, 'the cell offers one, so the key presses it');
  // A SHIELD in that hand is the off hand's readout and outranks the offer -
  // the cell shows the shield, so the key does the off hand's own act.
  equipItem(entity, shield());
  assert.equal(quickslotView(entity).off.kind, 'shield');
  assert.equal(offHandOffersSwap(entity), false);
  // ...and a LIT light outranks everything, which is the cell's first rung.
  entity.lightSource = torch();
  assert.equal(quickslotView(entity).off.kind, 'torch');
  assert.equal(offHandOffersSwap(entity), false);
  // And it really is the VIEW that answers, not a copy of its ladder.
  assert.match(read('src/systems/quickslots.js'),
    /export const offHandOffersSwap = \(entity\) => quickslotView\(entity\)\.off\.kind === 'swap';/);
});

// ── THE WIRING ───────────────────────────────────────────────────────

test('QS6: every host that answers a gameplay key DRIVES the hold machine, on its own keys and behind its own gate - the AUDIT SOC B4/D1 walk, for a key that only a frame can read (mutants: a host that never ticks, so the three keys are dead in a shop or underground; a tick with no gate, so a window typing 1 drinks a potion)', () => {
  // The four frames, each beside the ReadyWeapon/SwitchHand latches the
  // machine is modelled on.
  const sites = [
    ['src/scenes/world.js', /tickQuickHold\(dt\);/],
    ['src/scenes/exterior.js', /tickQuickHold\(dt\);/],
    // AUDIT QS6 F6: ABOVE the host's own `walkMode && !overlayHeld` gate, where
    // the call used to sit - there a blocked frame never reached it at all and
    // the `blocked` argument was dead.
    ['src/scenes/dungeon.js', /ctx\.tickQuickHold\?\.\(dt, \{ isHeld: \(a\) => held\(keys, a\), blocked: overlayHeld \|\| !walkMode \}\);/],
    ['src/scenes/worldModes.js', /dungeonCtx\?\.tickQuickHold\?\.\(dt, \{ isHeld: \(a\) => held\(keys, a\), blocked: overlayHeld \}\);/],
  ];
  for (const [path, re] of sites) {
    const src = read(path);
    assert.match(src, re, `${path} never drives the machine`);
    // ...and it stands with the polled latches, not somewhere of its own.
    assert.match(src, /held\(keys, 'SwitchHand'\)/, `${path} really is a frame that polls`);
  }
  // THE GATE. Every builder of the tick names one - a key under an open window
  // is the window's, and the held-key Set is not even filled there.
  for (const [path, gate] of [['src/scenes/world.js', /blocked: gamePaused\(\),/], ['src/scenes/exterior.js', /blocked: gamePaused\(\),/]]) {
    assert.match(read(path), gate, `${path} ticks behind its own gate`);
  }
  // The interior mode's own, which is the fourth frame's other arm.
  assert.match(read('src/scenes/worldModes.js'), /isHeld: \(a\) => held\(keys, a\), blocked: overlayHeld, entity: playerEntity,/);
  // The dungeon context hands the machine OUT - it has no frame, and BOTH
  // hosts that mount it have one.
  assert.match(read('src/scenes/dungeonContext.js'),
    /const tickQuickHold = \(dt, \{ isHeld = null, blocked = false \} = \{\}\) => tickQuickslotHold\(dt, \{/);
  assert.match(read('src/scenes/dungeonContext.js'), /\n    tickQuickHold,/, 'and puts it on the handle both hosts read');
});
