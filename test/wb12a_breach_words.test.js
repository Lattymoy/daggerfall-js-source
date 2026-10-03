// WB12a (2026-10-01, Mac: "getting feedback that our oblivion gates arent lore friendly to the current daggerfall
// timeline" - then "Dagon's Breach", and "I'd like to rename the stones" - "Deadlands Ember"): THE BREACH AND ITS WORDS.
// The game is 3E 417: the Covenant bars a Prince's door forced from without, never one opened from within, so the gates
// are Dagon's Breaches - torn open by his mortal faithful, sealed and torn shut by the Covenant. Every player-facing
// line that named an Oblivion Gate says so; the Sigil Stone is the Deadlands Ember, its NAME alone moved, and every
// stone a save, a crash record or a stack kept under the old name takes the new one. bible/11-Multiplayer/
// World-Bosses.md section 19 A.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as acorn from 'acorn';
import { riseLine, wrathLine, gateBossOf } from '../src/net/gateLaw.js';
import { omenPost, fellPost } from '../src/net/gateHerald.js';
import { GATE_NO_WORDS } from '../src/net/wire.js';
import { fellLine, omenTimeLine, openTimeLine, sealTimeLine } from '../src/systems/gateOmen.js';   // TIME1, at the merge: the three that name a time, in local time alone
import { GATE_TEXT } from '../src/scenes/gatePool.js';
import { GATE_LEGEND_TEXT } from '../src/ui/gateMapMark.js';
import { MARKS_CARD_TEXT } from '../src/ui/gateMarksView.js';
import { GATE_CLAIM_TEXT } from '../src/net/gateClaims.js';
import { MARKS_TEXT } from '../src/net/marksBook.js';
import { profileGateLine } from '../src/ui/profileWindow.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { BROKER_TEXT } from '../src/scenes/sigilBrokerPool.js';
import { INSIGNIA_LINE, INSIGNIA_CARD } from '../src/ui/brokerWindow.js';
import { SIGIL_STONE, SIGIL_STONE_TEMPLATE, sigilStone, nameEmbers, isSigilStone } from '../src/systems/gateSpoils.js';
import { stonesText, BROKER_REFUSALS, DISMANTLED } from '../src/systems/sigilBroker.js';
import { recoverSpoils, SPOILS_RECORD_V } from '../src/scenes/spoilsPool.js';
import { mintCondition, setItemFields, templateByIndex } from '../src/systems/itemTemplates.js';
import { addItem } from '../src/systems/inventory.js';
import { restorePlayer, snapshotPlayer } from '../src/systems/save.js';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const OLD = /Oblivion Gate|Sigil Stone/i;

/** Every string a shipped file can show or send: its literals and its template text - never a comment. */
function shippedStrings() {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(join(ROOT, d))) { const p = join(d, f); if (statSync(join(ROOT, p)).isDirectory()) walk(p); else if (/\.(m?js|cjs)$/.test(f)) files.push(p); } };
  for (const d of ['src', 'server/src', 'server-account/src', 'app']) walk(d);
  const out = [];
  for (const f of files) {
    const src = read(f);
    let ast = null;
    for (const sourceType of ['module', 'script']) { try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType, locations: true, allowHashBang: true }); break; } catch { /* the other */ } }
    assert.ok(ast, `${f} parses`);
    const visit = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { for (const c of n) visit(c); return; }
      if (n.type === 'Literal' && typeof n.value === 'string') out.push([f, n.loc.start.line, n.value]);
      else if (n.type === 'TemplateElement') out.push([f, n.loc.start.line, n.value.cooked ?? n.value.raw]);
      for (const k of Object.keys(n)) if (k !== 'loc') { const v = n[k]; if (v && typeof v === 'object') visit(v); }
    };
    visit(ast);
  }
  return out;
}

test('WB12a the guard: no shipped string names an Oblivion Gate or a Sigil Stone - not a chat line, a card, a plaque, a Discord post, a refusal nor a console line (as DRAKES pinned the old currency\'s name) (mutants: an old line put back)', () => {
  const strings = shippedStrings();
  assert.ok(strings.length > 10000, `the walk read the tree (${strings.length} strings)`);
  const left = strings.filter(([, , s]) => OLD.test(s)).map(([f, l, s]) => `${f}:${l} ${JSON.stringify(s).slice(0, 80)}`);
  assert.deepEqual(left, []);
});

test('WB12a the chat\'s lines (WB13b: each the event, where and when; TIME1, at the merge: a time the player\'s own alone): Dagon\'s faithful open a breach, it rises and opens, the Covenant seals it and tears it shut, and his fall collapses the breach (mutants: a line of the old frame)', () => {
  assert.equal(omenTimeLine({ place: 'Copperham, Wrothgarian Mountains', at: '14:32' }),
    'The sky burns near Copperham, Wrothgarian Mountains. Dagon\'s faithful open a breach at 14:32 your time.');
  assert.equal(riseLine({ near: 'Copperham', left: '4:07' }), 'Dagon\'s Breach rises near Copperham. It opens in 4:07.');
  assert.equal(openTimeLine({ near: 'Copperham', at: '16:32' }), 'Dagon\'s Breach near Copperham is open. The Covenant seals it at 16:32 your time.');
  assert.equal(sealTimeLine({ near: 'Copperham', at: '16:52' }), 'The Covenant has sealed Dagon\'s Breach near Copperham. It collapses at 16:52 your time.');
  assert.equal(wrathLine({ near: 'Copperham', boss: 'Valkynaz Ruhn' }), 'The Covenant tears Dagon\'s Breach near Copperham shut. Valkynaz Ruhn is cast back into the Deadlands.');
  assert.equal(fellLine({ near: 'Copperham', boss: 'Valkynaz Ruhn', top: ['Mac', 'Bran'] }), 'Valkynaz Ruhn has fallen at Dagon\'s Breach near Copperham, struck down by Mac and Bran. The breach collapses.');
  assert.equal(fellLine({ near: null, boss: 'Valkynaz Ruhn', top: [] }), 'Valkynaz Ruhn has fallen at Dagon\'s Breach in the wilds. The breach collapses.', 'WB13b: a screen that never found the site says what Discord says');
});

test('WB12a Discord: the omen post says Dagon\'s faithful open a breach and the Covenant seals it; his fall\'s post names Dagon\'s Breach and the breach collapsing; his title is his (mutants: the old post)', () => {
  const day = 700, boss = gateBossOf(day);
  const p = omenPost({ day, place: 'Copperham, Wrothgarian Mountains' }).content;
  assert.match(p, /^\*\*The sky burns near Copperham, Wrothgarian Mountains\.\*\* Dagon's faithful open a breach <t:\d+:R> \(<t:\d+:t>\)\. The Covenant seals it at <t:\d+:t>\. /);
  assert.ok(p.includes(`${boss.name} comes **`) && !p.includes('holds it'), 'WB13b: the marks in the chat\'s sentence');
  assert.equal(boss.title, 'Warden of the Burning Gate', 'the faithful\'s name for the arch the breach wears stays his');
  assert.equal(fellPost({ day, place: 'Copperham', top: ['Ann'], n: 1 }).content, `**${boss.name} has fallen** at Dagon's Breach near Copperham, struck down by Ann. The breach collapses.`);
});

test('WB12a the names on screen: the plaque, the banner and the map\'s legend say Dagon\'s Breach; the marks card, the record, the Drakes line, the profile, the account\'s refusal, the Broker\'s plaque and her insignia speak of breaches; the notice card names it (mutants: a name left)', () => {
  assert.equal(GATE_TEXT.name, 'Dagon\'s Breach');
  assert.equal(GATE_LEGEND_TEXT, 'Dagon\'s Breach');
  assert.equal(MARKS_CARD_TEXT.gate('Valkynaz Ruhn', 'the Rime-Wrought'), 'Valkynaz Ruhn comes the Rime-Wrought tonight', 'WB13b: one subtitle near the gate and inside');
  assert.equal(GATE_CLAIM_TEXT.recorded(4), 'Breach recorded. Breaches closed: 4.');
  assert.equal(GATE_CLAIM_TEXT.guest, 'Breach not recorded. Add a username within a week to keep it.');
  assert.equal(MARKS_TEXT.capped, 'No silver for this breach. The counting-houses strike 150 silver a day for breaches closed and towns defended.');   // SILVER: the currency's name; PIN MOVED (SILVER-WAYS): the day's cap the gates' and the raids'
  assert.equal(profileGateLine({ gates: { closed: 3 } }), 'Breaches closed: 3');
  assert.match(read('src/ui/enhancedAccount.js'), /if \(gates\) row\('Breaches closed', gates\);/);
  assert.equal(accountRefusalText('short'), 'Your account has too few embers for that.');   // AUDIT WB12d (A4): a rite's ember counts
  assert.deepEqual([BROKER_TEXT.trade, BROKER_TEXT.steal, BROKER_TEXT.gone], ['Trades in Deadlands Embers', 'The Broker\'s eyes never leave her embers.', 'The Sigil Broker leaves for the night.']);   // BROKER-CAGE: midnight takes her, not the breach (a Warden fallen early leaves her standing)
  assert.equal(INSIGNIA_LINE.title, 'A title worn over your name');
  assert.ok(INSIGNIA_CARD.title[1].includes('the breach\'s fire') && /your account's embers/.test(INSIGNIA_CARD.title[2]) && /your account's embers/.test(INSIGNIA_CARD.aura[2]));   // AUDIT WB12d (A4)
  assert.match(read('src/scenes/world.js'), /return \{ subject: 'Dagon\\'s Breach', body: state \? `Near \$\{near\}\. /);
  assert.match(read('src/systems/sigilSetPowers.js'), /Wrath of the Warden! \$\{struck\} \$\{struck === 1 \? 'foe' : 'foes'\} struck\./);
});

test('WB12a the arch is still the gate: pressed it answers as a gate, the relay\'s refusal words are protocol and keep their bytes, the Gatebreaker title and the Burning Court stay (mutants: the protocol renamed)', () => {
  assert.equal(GATE_TEXT.opensIn('3:12'), 'The gate opens in 3:12.');
  assert.equal(GATE_TEXT.notYet, 'The gate will not open to you yet.');
  assert.deepEqual([...GATE_NO_WORDS], ['the gate is closed', 'the gate is sealed', 'the gate is closing', 'the court is full']);
  assert.equal(INSIGNIA_CARD.title[0], 'Gatebreaker');
});

test('WB12a the ember: template 570 is the Deadlands Ember - minted, priced and counted under it - its id, binding and keys the stone\'s (mutants: the old name kept)', () => {
  assert.equal(SIGIL_STONE.name, 'Deadlands Ember');
  assert.equal(SIGIL_STONE_TEMPLATE, 570, 'the id moved nowhere');
  assert.equal(templateByIndex(570).name, 'Deadlands Ember');
  assert.equal(templateByIndex(570).bound, true);
  assert.equal(sigilStone().name, 'Deadlands Ember');
  assert.deepEqual([stonesText(1), stonesText(4)], ['1 Deadlands Ember', '4 Deadlands Embers']);
  assert.equal(BROKER_REFUSALS.stones, 'Not enough Deadlands Embers');
  assert.equal(DISMANTLED('a Helm', 2), 'Dismantled: a Helm, for 2 Deadlands Embers.');
  assert.ok(Object.keys(BROKER_REFUSALS).includes('stones'), 'the refusal\'s key is the stone\'s');
});

const oldStone = (n = 1) => Object.assign(sigilStone(), { name: 'Sigil Stone', stackCount: n });
const ruby = () => mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 }));

test('WB12a the repair: every record of the template under another name takes the ember\'s - once, and nothing else of the list is touched (mutants: the repair never runs; every item renamed)', () => {
  const list = [oldStone(3), ruby(), Object.assign(sigilStone(), { name: 'Sigil Stone' }), sigilStone()];
  const before = list[1].name;
  assert.equal(nameEmbers(list), 2);
  assert.deepEqual(list.map((i) => i.name), ['Deadlands Ember', before, 'Deadlands Ember', 'Deadlands Ember']);
  assert.equal(nameEmbers(list), 0, 'again: nothing left to rename');
  assert.equal(nameEmbers(null), 0);
  assert.ok(list.filter(isSigilStone).every((i) => i.templateIndex === 570), 'only the name moved');
});

const makeEntity = (over = {}) => ({
  name: 'Tester', race: 'Breton', gender: 'male', level: 3,
  stats: { strength: 50, endurance: 40, agility: 30, speed: 30, willpower: 30, intelligence: 30, luck: 30, personality: 30 },
  skills: new Array(35).fill(10), skillUses: new Array(35).fill(0),
  items: [], wagonItems: [], activeEffects: [], spells: [],
  health: 30, fatigue: 100, magicka: 10, gold: 0,
  ...over,
});

test('WB12a a save from before: the stones it kept as Sigil Stones load as Deadlands Embers - in the pack, the wagon and the other things - and a stone won after joins one stack under one name (mutants: the load never repairs)', () => {
  const e = makeEntity({ items: [oldStone(4), ruby()], wagonItems: [oldStone(2)], otherItems: [oldStone(1)] });
  const snap = snapshotPlayer(e, {});
  assert.equal(snap.items[0].name, 'Sigil Stone', 'the save holds the old name');
  const t = makeEntity();
  const info = console.info, lines = [];
  console.info = (s) => lines.push(String(s));
  try { restorePlayer(t, snap); } finally { console.info = info; }
  assert.deepEqual(t.items.filter(isSigilStone).map((i) => [i.name, i.stackCount]), [['Deadlands Ember', 4]]);
  assert.deepEqual(t.wagonItems.map((i) => i.name), ['Deadlands Ember']);
  assert.deepEqual((t.otherItems ?? []).filter(isSigilStone).map((i) => i.name), ['Deadlands Ember']);
  assert.ok(lines.some((l) => l.includes('WB12a') && l.includes('named Deadlands Embers')), 'said, in the console');
  addItem(t.items, sigilStone());
  assert.deepEqual(t.items.filter(isSigilStone).map((i) => [i.name, i.stackCount]), [['Deadlands Ember', 5]], 'one stack, one name');
});

test('WB12a the crash\'s door: a stone a crash record kept under its old name is handed over as a Deadlands Ember (mutants: the record\'s name kept)', () => {
  const rec = { v: SPOILS_RECORD_V, id: 'r1', who: 'char-A', at: 1, pieces: [{ kind: 'item', item: oldStone(1) }, { kind: 'gold', gold: 40 }] };
  const box = new Map([['wb5.spoils', [rec]]]);
  const store = { get: (k) => box.get(k), set: (k, v) => box.set(k, v), remove: (k) => box.delete(k) };
  const taken = [];
  assert.equal(recoverSpoils(store, (p) => taken.push(p), { who: 'char-A' }), 2);
  assert.equal(taken.find((p) => p.kind === 'item').item.name, 'Deadlands Ember');
});
