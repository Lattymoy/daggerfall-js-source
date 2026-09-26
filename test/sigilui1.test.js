// SIGIL-UI + RARITY-UI (2026-09-26, Mac: "sigil weapons need a visible indicator within the info section, something
// that makes it stand out, along with progress as you use it. Rarity needs to be more noticable in the UI with the icon
// borders being color coded"). The view is pure (systems/sigil.js sigilView) and the block is BUILT here on the fake
// document (test/invdrag.mjs); the frames are the Plus sheet's own rules, read as text, and the four places that mark
// a frame are driven (the pack's helper) or pinned (the hotbar's and the diamond's writes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from './invdrag.mjs';
import {
  sigilView, sigilProgressText, setSigilOnline, setSigilRenown, _resetSigilForTests, SIGIL_STAGES,
} from '../src/systems/sigil.js';
import { sigilCard } from '../src/ui/sigilCard.js';
import { SIGIL_RUNE_SVG, SIGIL_RUNE_URL } from '../src/ui/sigilRune.js';
import { rarityLines, RARITIES, RARITY_ORDER, LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { markItemFrame } from '../src/ui/enhancedInventory.js';
import { ITEM_FRAME_CSS, PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sword = (xp, extra = {}) => ({ name: 'Longsword', group: 'Weapons', templateIndex: 117, rarity: 'rare', affixes: [], isIdentified: true, sigil: { power: 6, party: 3, xp }, ...extra });
const online = (renown) => { _resetSigilForTests(); setSigilOnline(true); setSigilRenown(renown); };
const kids = (n, cls) => (n.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;

test('SIGIL-UI the view: the stage it stands at in MY hand (the lower of its growth and my Renown), dormant offline, HELD when my Renown is short of its growth with the Renown that frees it, and the drink toward its next stage - fully grown at the last (mutants: the stage read off the growth alone, the held note lost, the bar measured from zero)', () => {
  online(15);
  const v = sigilView(sword(7420));
  assert.deepEqual([v.rank, v.stage, v.dormant, v.held, v.name], [1, 1, false, false, 'Kindled']);
  assert.deepEqual([v.from, v.to, v.next, v.full, v.party], [5000, 12500, 'Bright', 6, 3]);
  assert.ok(Math.abs(v.frac - (7420 - 5000) / (12500 - 5000)) < 1e-9, 'measured from the stage it reached, not from zero');
  assert.equal(v.pct, (6 * SIGIL_STAGES[1].share) / 100);
  assert.equal(sigilProgressText(v), '7,420 / 12,500 to Bright');
  assert.deepEqual(v.stages.map((s) => [s.grown, s.awake]), [[true, true], [true, true], [false, false], [false, false], [false, false]]);
  const held = sigilView(sword(23900));
  assert.deepEqual([held.rank, held.stage, held.held, held.name, held.unlock], [3, 1, true, 'Kindled', 20], 'grown to Radiant, held at Kindled until Renown 20');
  assert.deepEqual(held.stages.map((s) => [s.grown, s.awake]), [[true, true], [true, true], [true, false], [true, false], [false, false]]);
  const top = sigilView(sword(37500));
  assert.deepEqual([top.to, top.next, top.frac], [null, null, 1]);
  assert.equal(sigilProgressText(top), 'Fully grown');
  setSigilOnline(false);
  const off = sigilView(sword(7420));
  assert.deepEqual([off.dormant, off.stage, off.name, off.pct], [true, -1, 'Dormant', 0]);
  assert.ok(off.stages.every((s) => !s.awake), 'nothing burns offline');
  assert.equal(sigilView({ name: 'Mace' }), null);
  assert.equal(sigilView(sword(7420, { sigil: { power: 99, party: 1, xp: 0 } })), null, 'a forged record draws nothing');
  assert.equal(sigilProgressText(null), '');
  _resetSigilForTests();
});

test('SIGIL-UI the block: the rune, "Sigil" and the stage, what it gives now and at Ascendant, five gems (grown, and lit where my Renown lets it burn), a progress bar at its share with the numbers and the fight that won it; held says the Renown it waits for, fresh says how it grows, dormant says it wakes online (mutants: the gems unlit, the bar\'s share lost, the held note dropped)', () => {
  withDom(() => {
    online(15);
    const box = sigilCard(sword(7420));
    assert.equal(box.tagName, 'SECTION');
    assert.equal(box.className, 'sigilbox');
    assert.equal(box.dataset.stage, '1');
    assert.equal(one(box, 'sigil-rune').getAttribute('aria-hidden'), 'true');
    assert.equal(one(box, 'sigil-word').textContent, 'Sigil');
    assert.equal(one(box, 'sigil-stage').textContent, 'Kindled');
    assert.equal(one(box, 'sigil-effect').textContent, '+2.4% damage now · +6% at Ascendant');
    const gems = kids(box, 'sigil-gem');
    assert.equal(gems.length, 5);
    assert.deepEqual(gems.map((g) => g.className), ['sigil-gem grown awake', 'sigil-gem grown awake', 'sigil-gem', 'sigil-gem', 'sigil-gem']);
    const meter = one(box, 'sigil-meter');
    assert.equal(meter.getAttribute('role'), 'progressbar');
    assert.equal(meter.getAttribute('aria-valuenow'), '32');
    assert.equal(one(box, 'sigil-fill').style.width, '32.3%');
    assert.equal(one(box, 'sigil-progress').children[0].textContent, '7,420 / 12,500 to Bright');
    assert.equal(one(box, 'sigil-party').textContent, 'won in a fight of 3');
    assert.equal(one(box, 'sigil-note'), null, 'neither held nor fresh: no note');
    const held = sigilCard(sword(23900));
    assert.equal(one(held, 'sigil-note').textContent, 'Your Renown holds it at Kindled - Bright at Renown 20');
    assert.deepEqual(kids(held, 'sigil-gem').map((g) => g.className), ['sigil-gem grown awake', 'sigil-gem grown awake', 'sigil-gem grown', 'sigil-gem grown', 'sigil-gem']);
    const fresh = sigilCard(sword(0, { sigil: { power: 3, party: 1, xp: 0 } }));
    assert.equal(one(fresh, 'sigil-note').textContent, 'It grows as this weapon earns Renown in your hand.');
    assert.equal(one(fresh, 'sigil-party'), null, 'a fight of one is not a fight to boast of');
    setSigilOnline(false);
    const dormant = sigilCard(sword(7420));
    assert.equal(dormant.dataset.stage, 'dormant');
    assert.equal(one(dormant, 'sigil-effect').textContent, 'Wakes online, with your Renown: +6% damage at Ascendant');
    assert.equal(sigilCard({ name: 'Mace' }), null);
    _resetSigilForTests();
  });
  assert.match(SIGIL_RUNE_SVG, /shape-rendering="crispEdges"/, 'the rune is pixel art');
  assert.match(SIGIL_RUNE_URL, /^url\("data:image\/svg\+xml;utf8,/);
});

test('SIGIL-UI the card carries the BLOCK, not three more lines: the tier list leaves the sigil out where the block stands (the default keeps it for every other reader), and both of the pack\'s cards - the hover card and the Info box - append the block (mutants: the lines doubled under the block, the Info box without it)', () => {
  _resetForTests();
  setPref(LOOT_RARITY_KEY, true);
  online(15);
  const it = sword(7420);
  const all = rarityLines(it);
  const bare = rarityLines(it, { sigil: false });
  assert.ok(all.length > bare.length, 'the default still says the sigil (the classic tooltip, the trade window)');
  assert.ok(all.some((l) => /Kindled/.test(l)));
  assert.ok(!bare.some((l) => /Kindled|[Ss]igil/.test(l)), 'the card\'s own list does not');
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /rarityLines\(picked, \{ sigil: false \}\)[^\n]*\n[^\n]*\n[^\n]*\n\s+\{ const sb = sigilCard\(picked\); if \(sb\) c\.append\(sb\); \}/, 'the hover card: the list, then the block');
  assert.match(inv, /\{ const sb = sigilCard\(item\); if \(sb\) card\.append\(sb\); \}/, 'the Info box');
  _resetSigilForTests();
});

test('RARITY-UI the frame: a piece\'s tier and its rune are marked on every picture of it - the pack\'s helper (driven), the hotbar\'s slot and the quickslot diamond\'s cell (pinned) - and the Plus sheet colours each tier\'s border by its own colour, sets its pips, frames the grid, the lists, the worn panels, the sockets, the drag ghost, the hotbar and the diamond, and lays the rune in the corner (mutants: a tier left uncoloured, the hotbar unmarked, the rune never drawn)', () => {
  _resetForTests();
  setPref(LOOT_RARITY_KEY, true);
  const n = markItemFrame({ dataset: {} }, sword(0));
  assert.deepEqual({ ...n.dataset }, { rarity: 'rare', sigil: '' });
  assert.deepEqual({ ...markItemFrame({ dataset: {} }, { name: 'Mace', group: 'Weapons', templateIndex: 120 }).dataset }, {}, 'Common wears nothing');
  for (const tier of RARITY_ORDER.filter((t) => t !== 'common')) {
    assert.match(ITEM_FRAME_CSS, new RegExp(`\\[data-rarity="${tier}"\\] \\{ --rar: ${RARITIES[tier].colour};`), `${tier} wears its own colour`);
  }
  for (const sel of ['.pack-shell .pack-dock .itemrow[data-rarity] {', '.pack-shell .wornsock[data-rarity]', '.dragghost[data-rarity] .tile',
    '.hb .hb-slot[data-rarity] .hb-frame', '.hud-qdiamond .hud-qcell[data-rarity]:not(.socket) .hud-qframe', '.pack-shell .wornrow[data-rarity] .tile',
    '.pack-shell .pack-dock .itemrow[data-rarity]::before { content: var(--rar-pips);',
    '.pack-shell .pack-dock .itemrow[data-sigil]::after', '.hb .hb-slot[data-sigil]::before']) {
    assert.ok(ITEM_FRAME_CSS.includes(sel), sel);
  }
  assert.ok(PLUS_CSS.includes(ITEM_FRAME_CSS), 'the frames ride the Plus sheet');
  assert.match(read('src/ui/enhancedHotbar.js'), /if \(rar\) n\.dataset\.rarity = rar; else delete n\.dataset\.rarity;\n\s+if \(it && validSigil\(it\.sigil\)\) n\.dataset\.sigil = ''; else delete n\.dataset\.sigil;/);
  assert.match(read('src/ui/enhancedHud.js'), /if \(rar\) part\.cell\.dataset\.rarity = rar; else delete part\.cell\.dataset\.rarity;\n\s+if \(worn && validSigil\(worn\.sigil\)\) part\.cell\.dataset\.sigil = ''; else delete part\.cell\.dataset\.sigil;/);
  for (const f of ['src/ui/enhancedTrade.js', 'src/ui/enhancedPlayerTrade.js']) assert.match(read(f), /markItemFrame\(el\('button', 'itemrow'\), item\)/, f);
});
