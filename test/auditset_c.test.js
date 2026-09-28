// AUDIT SET (2026-09-27, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md, "AUDIT SET"): slice C - the drops, the
// economy, the wire, the saves and the tooltips. What the audit found and each fix's own pins; the powers' fixes live
// beside the powers (set3_powers.test.js), the Broker's beside the Broker (set7_*.test.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testRoomOnlineRefused, TEST_ROOM_OFFLINE_TEXT } from '../src/systems/testRoom.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { validLootItem, validLootList } from '../src/systems/loot.js';
import { REGALIA, mintAetheric, aethericById, validSetMarks } from '../src/systems/aetheric.js';
import { brokerStock } from '../src/systems/sigilBroker.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { createWeapon, ARROW_TEMPLATE } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { LEGENDARIES } from '../src/systems/lootRarity.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { fitTip, TIP_FITS } from '../src/ui/enhancedInventory.js';
import { wrapToolTipRows, TOOLTIP_WRAP_W, ToolTip } from '../src/ui/toolTip.js';
import { makeSlotToolTip } from '../src/ui/itemScroller.js';
import { NATIVE_W } from '../src/ui/nativePanel.js';
import { SIGIL_SETS, tierValues } from '../src/systems/sigilSets.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mkEntity = (over = {}) => ({
  name: 'T', level: 3, health: 20, maxHealth: 30, fatigue: 100, magicka: 10, maxMagicka: 40,
  stats: { strength: 50 }, skills: new Array(35).fill(20), items: [], spells: [],
  ...over,
});

test('AUDIT SET D4: a Test Room character stays offline - the mark rides its saves, the boot asks the save it is about to load (by its key, or the most recent) and drops `online` for a marked one, whatever door the URL came by; a character of the world, a boot that loads nothing, or an offline boot is never asked about (mutants: the mark never set; the mark dropped by the save; the refusal never asked; the most recent save unread; a built room character let online; the check\'s own parse)', () => {
  const q = (s) => new URLSearchParams(s);
  const marked = { testRoom: true }, plain = { name: 'Mac' };
  const saves = (byKey, recent = null) => ({ loadSlot: (k) => byKey[k] ?? null, mostRecent: () => (recent ? { snap: recent } : null) });
  assert.equal(testRoomOnlineRefused(q('online=1&load=1&loadkey=3'), saves({ 3: marked })), true, 'the picked save, marked');
  assert.equal(testRoomOnlineRefused(q('online=1&load=1&loadkey=3'), saves({ 3: plain })), false, 'the picked save, a character of the world');
  assert.equal(testRoomOnlineRefused(q('online=1&load=1'), saves({}, marked)), true, 'the most recent save, marked');
  assert.equal(testRoomOnlineRefused(q('online=1&load=1'), saves({}, plain)), false);
  assert.equal(testRoomOnlineRefused(q('load=1&loadkey=3'), saves({ 3: marked })), false, 'offline: the room\'s character plays');
  assert.equal(testRoomOnlineRefused(q('online=1'), saves({}, marked)), false, 'a boot that loads nothing');
  assert.equal(testRoomOnlineRefused(q('online=1&load=1&loadkey=9'), saves({})), false, 'a key with no save');
  assert.equal(testRoomOnlineRefused(q('online=1&load=1&loadkey=3'), { loadSlot: () => { throw new Error('bad store'); }, mostRecent: () => null }), false, 'a store that throws');
  assert.equal(testRoomOnlineRefused(q('online=1&load=1&loadkey=3'), saves({ 3: { testRoom: 'yes' } })), false, 'the mark is true, nothing else');
  assert.match(TEST_ROOM_OFFLINE_TEXT, /^A Test Room character plays offline/);
  // AUDIT FINAL F8: a room character the URL BUILDS is refused too - `?test=loot` hands the armory to a character no save
  // marked, straight into a live session; offline it plays, and a word that names no entry is nobody's
  assert.equal(testRoomOnlineRefused(q('world&online&test=loot'), saves({})), true, 'the armory, built online');
  assert.equal(testRoomOnlineRefused(q('world&online&test=nord-warrior'), saves({})), true, 'a preset, built online');
  assert.equal(testRoomOnlineRefused(q('world&test=loot'), saves({})), false, 'offline: the room plays');
  assert.equal(testRoomOnlineRefused(q('world&online&test=nonsense'), saves({})), false, 'no entry of the room\'s');
  // AUDIT FINAL F9: the boot hands its own pick - one parse (main's MW-EARLY F3), the load door's own save
  let parses = 0;
  const pick = () => { parses++; return marked; };
  assert.equal(testRoomOnlineRefused(q('online=1&load=1&loadkey=3'), { snap: pick, loadSlot: () => { throw new Error('asked the store'); } }), true);
  assert.equal(parses, 1, 'the boot\'s pick, not a store read of its own');
  // the mark, through a real save and load - and a save without it restores a character of the world
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity({ testRoom: true }))));
  assert.equal(snap.testRoom, true, 'the save carries it');
  const back = mkEntity();
  restorePlayer(back, snap, null);
  assert.equal(back.testRoom, true, 'the load restores it');
  const worldly = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity())));
  assert.equal('testRoom' in worldly, false, 'a character of the world writes nothing');
  const was = mkEntity({ testRoom: true });
  restorePlayer(was, worldly, null);
  assert.equal(was.testRoom, undefined, 'loading a character of the world over the room\'s leaves no mark behind');
  // the room sets it, after the chargen that builds the character afresh
  const tr = strip(read('src/systems/testRoom.js'));
  assert.match(tr, /await applyHeadlessChargen\(playerEntity, preset\.classIndex, \{ fetchBytes, spellsByIndex \}\);\s*playerEntity\.testRoom = true;/);
  // the boot asks before anything reads `online`, drops it from the URL the lane reads, and says why once the world stands
  const W = strip(read('src/scenes/world.js'));
  const boot = W.indexOf('export async function bootWorld(');
  const ask = W.indexOf('const testRoomOffline = testRoomOnlineRefused(params, { snap: bootSnap });');
  assert.ok(boot > 0 && ask > boot, 'asked in the boot');
  const snapDecl = W.indexOf('const bootSnap = () => (bootSnapRead === undefined ? (bootSnapRead = pickedSaveSnap(bootLoadPick ?? {})) : bootSnapRead);');
  assert.ok(snapDecl > boot && snapDecl < ask, 'AUDIT FINAL F9: off the load door\'s own pick and parse, declared first');
  assert.ok(ask < W.indexOf("params.has('online')", boot), 'before the first read of `online`');
  assert.match(W, /if \(testRoomOffline\) \{ params\.delete\('online'\); publishBootParams\(params\); \}/);
  const said = W.indexOf('if (testRoomOffline) townTalk.say(TEST_ROOM_OFFLINE_TEXT);');
  assert.ok(said > W.indexOf("? { key: Number(params.get('loadkey')) }") && said < W.indexOf('if (!_loadedGame) mwViewNewGame('), 'said after the load, once the boot has its character');
  // the Online pane: the tile's button is dead and says why
  const M = strip(read('src/ui/enhancedMenu.js'));
  assert.match(M, /testRoom: snap\.testRoom === true,/);
  assert.match(M, /label: save\.testRoom \? 'Test Room: offline only' : 'Play online',/);
  assert.match(M, /disabled: !who \|\| save\.testRoom,/);
});

test('AUDIT SET D6: the wire\'s item law cross-checks the marks - a set\'s sigil only on a piece a set counts, a blow only on a weapon (never ammunition), the Regalia\'s set only on an Aetheric piece, an Aetheric piece only as its record mints it (the record, its group and template, Daedric); the sigil projected to its own keys; every honest piece passes - the Regalia, a day of the Broker\'s stock, a won weapon (mutants: a set sigil on a ring; a blow on armour; a Regalia sigil on any Daedric piece; the sigil unprojected; an Aetheric off its record; an Aetheric of any metal; the marks never asked)', () => {
  const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
  const cuirass = () => mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Daedric, flags: 0 }));
  const sword = () => createWeapon(120, 9, () => 0.5);
  const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 133, name: 'Ring', flags: 0 });
  // a set's sigil
  assert.ok(wire({ ...cuirass(), rarity: 'rare', sigil: { set: 'mora', party: 1, xp: 0 } }), 'a set piece');
  assert.equal(wire({ ...ring(), sigil: { set: 'mora', party: 1, xp: 0 } }), null, 'a set\'s sigil on a ring');
  // a blow
  assert.ok(wire({ ...sword(), rarity: 'rare', sigil: { power: 5, party: 1, xp: 0 } }), 'a sigil weapon');
  assert.ok(wire({ ...sword(), rarity: 'rare', sigil: { power: 5, set: 'dagon', party: 1, xp: 0 } }), 'a set weapon');
  assert.equal(wire({ ...cuirass(), rarity: 'rare', sigil: { power: 5, set: 'mora', party: 1, xp: 0 } }), null, 'a blow on armour');
  const arrows = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
  assert.equal(wire({ ...arrows, sigil: { power: 5, party: 1, xp: 0 } }), null, 'a blow on arrows');
  // the Regalia's set, and the Aetheric
  assert.equal(wire({ ...cuirass(), rarity: 'legendary', sigil: { set: 'ruhn', party: 1, xp: 0 } }), null, 'a Regalia sigil on a Daedric cuirass that is no Aetheric piece');
  for (const r of REGALIA) assert.ok(wire(mintAetheric(r)), `${r.id} passes`);
  const plate = mintAetheric(aethericById('ruhn-warden-plate'));
  assert.equal(wire({ ...plate, aetheric: 'ruhn-nothing' }), null, 'a record that is none');
  assert.equal(wire({ ...plate, templateIndex: 108 }), null, 'off its record\'s template');
  assert.equal(wire({ ...plate, group: 'Weapons', templateIndex: 127 }), null, 'off its record\'s group');
  assert.equal(wire({ ...plate, material: ARMOR_MATERIAL.Iron }), null, 'of another metal');
  assert.equal(wire({ ...plate, rarity: 'legendary' }), null, 'an Aetheric record on another tier');
  assert.equal(wire({ ...cuirass(), rarity: 'aetheric' }), null, 'the tier with no record');
  // the projection
  const odd = wire({ ...sword(), rarity: 'rare', sigil: { power: 5, set: 'dagon', party: 2, xp: 7, note: 'x'.repeat(50), evil: { deep: 1 } } });
  assert.deepEqual(odd.sigil, { power: 5, set: 'dagon', party: 2, xp: 7 }, 'the four keys, nothing else');
  assert.deepEqual(wire({ ...cuirass(), rarity: 'rare', sigil: { set: 'mora', party: 1, xp: 3 } }).sigil, { set: 'mora', party: 1, xp: 3 });
  // a list with one forged piece is no list (the law every other forged field meets)
  assert.equal(validLootList([JSON.parse(JSON.stringify(sword())), { ...ring(), sigil: { set: 'mora', party: 1, xp: 0 } }]), null);
  // honest stock: a day of the Broker's, whole
  for (let d = 20500; d < 20510; d++) for (const o of brokerStock(d)) assert.ok(wire(o.item), `the Broker's ${o.kind} on day ${d}`);
  assert.equal(validSetMarks(null), null);
  assert.match(strip(read('src/systems/loot.js')), /if \(!validItemFields\(out\)\) return null;\s*if \(!validSetMarks\(out\)\) return null;/, 'asked after each field is its kind');
});

test('AUDIT SET U8: every lore line a classic tooltip draws - a Legendary\'s, an Aetheric piece\'s - is ASCII, as the classic font draws (mutants: a curly apostrophe in the lore)', () => {
  for (const r of LEGENDARIES) assert.match(r.lore ?? '', /^[\x20-\x7e]*$/, r.id);
  for (const r of REGALIA) assert.match(r.lore, /^[\x20-\x7e]*$/, r.id);
});

test('AUDIT SET U9: in the pack\'s card the sigil block\'s three lines are the block\'s - each outranks the card\'s own paragraph rule (centred, 14px, parchment) and says the block\'s size, colour and alignment; the dormant colour outranks the awake one (mutants: the lines left to the card\'s rule; the dormant colour lost)', () => {
  /** [ids, classes/attributes/pseudo-classes, elements] - enough for these selectors (no :not, no ::). */
  const spec = (sel) => [(sel.match(/#[\w-]+/g) ?? []).length, (sel.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length,
    (sel.replace(/\.[\w-]+|\[[^\]]+\]|#[\w-]+|:[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) ?? []).length];
  const beats = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  assert.deepEqual(spec('.pack-shell .card p'), [0, 2, 1]);
  const body = (sel) => { const at = PLUS_CSS.indexOf(`${sel} {`); assert.ok(at >= 0, `the sheet has ${sel}`); return PLUS_CSS.slice(at, PLUS_CSS.indexOf('}', at)); };
  for (const [cls, size, colour] of [['sigil-effect', '13px', '#e6fbf6'], ['sigil-progress', '11px', '#9fded2'], ['sigil-note', '11px', '#85a8a1']]) {
    const sel = `.pack-shell .card .sigilbox p.${cls}`;
    assert.ok(beats(spec(sel), spec('.pack-shell .card p')), `${sel} outranks the card's paragraph`);
    const b = body(sel);
    assert.match(b, new RegExp(`font-size: ${size};`)); assert.match(b, new RegExp(`color: ${colour};`)); assert.match(b, /text-align: left;/);
  }
  const dormant = '.pack-shell .card .sigilbox[data-stage="dormant"] p.sigil-effect';
  assert.ok(beats(spec(dormant), spec('.pack-shell .card .sigilbox p.sigil-effect')), 'the dormant line outranks the awake one');
  assert.ok(PLUS_CSS.includes(`${dormant}, .pack-shell .card .sigilbox[data-stage="dormant"] p.sigil-progress { color: #9aa6a3; }`));
});

test('AUDIT SET U13: a hover card taller than the screen sheds what a glance can spare, a step at a time - the tiers\' words small and the sigil\'s note gone, then the tiers\' names alone - until it stands whole; one that fits sheds nothing; the sheet caps it at the screen (tools/setUiProbe.mjs measures the real card at three screens) (mutants: the card never fitted; a step skipped; shed with room to spare; the tight card keeping the tiers\' words)', () => {
  const tip = (heights) => { const on = new Set(); return { on, classList: { add: (c) => on.add(c) }, get scrollHeight() { return heights[on.size] ?? heights.at(-1); } }; };
  let t = tip([782, 700, 504]); fitTip(t, 684);
  assert.deepEqual([...t.on], ['tip-compact', 'tip-tight'], 'the Regalia\'s shield on a 700px laptop: both steps');
  t = tip([782, 650, 504]); fitTip(t, 684);
  assert.deepEqual([...t.on], ['tip-compact'], 'the first step was enough');
  t = tip([620]); fitTip(t, 884);
  assert.deepEqual([...t.on], [], 'a card that fits sheds nothing');
  t = tip([2000]); fitTip(t, 684);
  assert.deepEqual([...t.on], [...TIP_FITS], 'every step, and the sheet\'s cap is the last word');
  assert.deepEqual([...TIP_FITS], ['tip-compact', 'tip-tight']);
  assert.match(PLUS_CSS, /\.inv-tip \{ pointer-events: none; width: min\(290px, 80vw\); max-height: calc\(100vh - 16px\); overflow: hidden; \}/);
  assert.ok(PLUS_CSS.includes('.inv-tip.tip-compact .set-tier-text { font-size: 11px; line-height: 1.2; }'));
  assert.ok(PLUS_CSS.includes('.inv-tip.tip-compact .sigil-note { display: none; }'));
  assert.ok(PLUS_CSS.includes('.inv-tip.tip-tight .set-tier-text, .inv-tip.tip-tight .set-role, .inv-tip.tip-tight .sigil-progress { display: none; }'));
  assert.match(strip(read('src/ui/enhancedInventory.js')), /document\.body\.append\(tipEl\);\s*fitTip\(tipEl\);\s*placeBeside\(tipEl, row\);/, 'fitted before it is placed');
});

test('AUDIT SET U2: in the item lists\' classic tooltip a row of the port\'s own wider than TOOLTIP_WRAP_W wraps at its spaces, each continuation indented two, so a set\'s line never runs off the 320px screen; a row that fits is drawn exactly as it was, spaces and all; a word wider than the whole stands alone; DFU\'s rows - the item\'s name, every other window\'s tips - never wrap (mutants: the wrap never asked; a continuation unindented; a short row wrapped; wrapped past the width; the name wrapped; every tooltip wrapped)', () => {
  const measure = (s) => s.length * 5;   // the classic font's four-pixel glyph and its one of spacing
  assert.equal(TOOLTIP_WRAP_W, 240);
  assert.ok(TOOLTIP_WRAP_W < NATIVE_W - 4, 'inside the screen, margins and all');
  const dfu = ['Longsword', 'Weight:  2.5 kg', 'Rare'];
  assert.deepEqual(wrapToolTipRows(dfu, measure), dfu, 'rows that fit: untouched, their spaces too');
  const long = '4 pieces - Bloodfury: Your weapon blows deal +4% damage, +8% below half health (1 more)';
  const out = wrapToolTipRows(['Rare', long], measure);
  assert.equal(out[0], 'Rare');
  const wrapped = out.slice(1);
  assert.ok(wrapped.length >= 2, 'wrapped');
  for (const r of wrapped) assert.ok(measure(r) <= TOOLTIP_WRAP_W, `"${r}" fits`);
  assert.ok(wrapped.slice(1).every((r) => r.startsWith('  ') && !r.startsWith('   ')), 'each continuation indented two');
  assert.equal(wrapped.map((r) => r.trim()).join(' '), long, 'every word, in order');
  assert.deepEqual(wrapToolTipRows(['x'.repeat(60)], measure), ['x'.repeat(60)], 'a word wider than the whole stands alone');
  const lead = wrapToolTipRows([`  ${long}`], measure);
  assert.ok(lead[0].startsWith('  ') && lead.slice(1).every((r) => r.startsWith('    ')), 'an indented row keeps its indent, and its continuations go two further');
  // every set's lines, as a classic tooltip prints them
  for (const set of Object.values(SIGIL_SETS)) {
    for (const t of set.tiers) {
      const row = `${t.at} pieces - ${t.name}: ${t.text(tierValues(t, 4))} (5 more)`;
      for (const r of wrapToolTipRows([row], measure)) assert.ok(measure(r) <= TOOLTIP_WRAP_W || !r.trim().includes(' '), `${set.id} ${t.name}: "${r}"`);
    }
  }
  const name = 'Ebony Dai-Katana of the Unseen Blade, Rusty and Forgotten'.repeat(2);
  assert.deepEqual(wrapToolTipRows([name, long], measure, TOOLTIP_WRAP_W, 1)[0], name, 'a row before `wrapFrom` - the item\'s name, DFU\'s - never wraps');
  const T = strip(read('src/ui/toolTip.js'));
  assert.match(T, /const rows = wrapFrom == null \? toolTipRows\(text\) : wrapToolTipRows\(toolTipRows\(text\), \(r\) => measureText\(font\.fnt, r\), TOOLTIP_WRAP_W, wrapFrom\);/, 'the box wraps only when asked');
  assert.match(T, /drawToolTipBox\(renderer, m, font, this\.text, this\.x, this\.y, \{ wrapFrom: this\.wrapFrom \}\);/);
  assert.equal(new ToolTip().wrapFrom, null, 'a window\'s own tip (DFU\'s) wraps nothing');
  assert.equal(makeSlotToolTip().tip.wrapFrom, 1, 'the item lists\' tip wraps the lines under the name');
});
