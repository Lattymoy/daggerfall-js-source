// WB13b (2026-10-01, Mac: "Also clean up text to be less explanatory and less AI"): THE WORDS - every line the breach,
// the court and the Broker say, rewritten to say one thing and stop (bible/11-Multiplayer/World-Bosses.md section 20,
// WB13b). The style held as a law over the tables, and the design changes beyond the wording pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { riseLine, wrathLine, marksLine, portentsLine } from '../../../src/net/gate/gateLaw.js';
import { GATE_ASPECTS, GATE_TRIALS, GATE_PORTENTS, gateDireLine } from '../../../src/net/gate/gateMods.js';
import { MARK_TIPS, MARKS_CARD_TEXT, marksCardModel } from '../../../src/ui/gate/gateMarksView.js';
import { COURT_STRIKE_TEXT, COURT_RECKON_TEXT, COURT_MARKS_TEXT, courtPhaseOrder, courtPhaseCard, COURT_WRATH_TEXT, SUNDER_CARD, COURT_TITHE_TEXT } from '../../../src/scenes/gate/gateCourt.js';
import { VANGUARD_TEXT } from '../../../src/scenes/gate/gateVanguard.js';   // WB14: the arc's own tables
import { ARSENAL_TEXT } from '../../../src/scenes/gate/gateArsenal.js';
import { SUNDER_TEXT } from '../../../src/scenes/gate/gateFlame.js';
import { CAPTIVE_TEXT } from '../../../src/scenes/gate/gateCaptive.js';   // WB14f: the Captive's own
import { COURT_HOST_TEXT } from '../../../src/scenes/gate/gateHost.js';
import { COURT_TEXT } from '../../../src/world/gate/gateArena.js';
import { GATE_TEXT } from '../../../src/scenes/gate/gatePool.js';
import { GATE_NO_TEXT } from '../../../src/net/gate/gateLink.js';
import { GATE_CLAIM_TEXT } from '../../../src/net/gate/gateClaims.js';
import { MARKS_TEXT } from '../../../src/net/marksBook.js';
import { omenPost, fellPost, ritePost } from '../../../src/net/gate/gateHerald.js';
import { fellLine, riteOmenLine, omenTimeLine, openTimeLine, sealTimeLine } from '../../../src/systems/gate/gateOmen.js';   // TIME1, at the merge: the three that name a time
import { RITE_TEXT } from '../../../src/scenes/riteHost.js';
import { SPOILS_TEXT } from '../../../src/scenes/spoilsPool.js';
import { INSIGNIA_SUB, INSIGNIA_LINE, INSIGNIA_CARD } from '../../../src/ui/brokerWindow.js';
import { dismantleAsk } from '../../../src/systems/sigil/sigilBroker.js';
import { accountRefusalText } from '../../../src/net/accountClient.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const P = { boss: 'Valkynaz Ruhn' };

/** Every line the tables hold, as said (a function called with plain words). */
function lines() {
  const out = [];
  const add = (where, v) => { if (typeof v === 'string') out.push([where, v]); };
  add('omen', omenTimeLine({ place: 'Copperham, Wrothgarian Mountains', at: '14:32' }));
  add('rise', riseLine({ near: 'Copperham', left: '4:07' }));
  add('open', openTimeLine({ near: 'Copperham', at: '16:32' }));
  add('seal', sealTimeLine({ near: 'Copperham', at: '16:52' }));
  add('wrath', wrathLine({ near: 'Copperham', boss: P.boss }));
  add('marks', marksLine({ boss: P.boss, md: ['rime', 'colossal', 'unyielding'] }));
  add('fell', fellLine({ near: 'Copperham', boss: P.boss, top: ['Ann', 'Bran'] }));
  for (const a of GATE_ASPECTS) add(`omen:${a.id}`, a.omen);
  for (const t of GATE_TRIALS) add(`trial:${t.id}`, t.text);
  for (const [k, v] of Object.entries(MARK_TIPS)) add(`tip:${k}`, v);
  add('strike.resisted', COURT_STRIKE_TEXT.resisted('Frost Nova')); add('strike.noSpoils', COURT_STRIKE_TEXT.noSpoils()); add('strike.spilled', COURT_STRIKE_TEXT.spilled());
  add('reckon.call', COURT_RECKON_TEXT.call(4)); add('reckon.shattered', COURT_RECKON_TEXT.shattered('Ann', 2)); add('reckon.broken', COURT_RECKON_TEXT.broken());
  for (const n of [2, 3]) add(`phase${n}`, courtPhaseOrder(n));   // WB13e: the card's one order
  for (const [k, v] of Object.entries(COURT_WRATH_TEXT)) add(`wrath.${k}`, v);   // WB13e
  for (const [k, v] of Object.entries(COURT_HOST_TEXT)) add(`host.${k}`, typeof v === 'function' ? v(P.boss, 'Imps', 2) : v);
  add('host.felled', COURT_HOST_TEXT.felled('Ann', 2));
  // WB14 (the Breach's portents): the arc's own tables - its Vanguard's stages, its arsenal's orders, the Sundering's
  // moments and cards, a Tithe-Imp's tithe and its words
  for (const [k, v] of Object.entries(VANGUARD_TEXT)) add(`vanguard.${k}`, v(P.boss));
  for (const [k, v] of Object.entries(ARSENAL_TEXT)) add(`arsenal.${k}`, v('Ann'));
  for (const [k, v] of Object.entries(SUNDER_TEXT)) add(`sunder.${k}`, v('Ruhn\'s Blade'));
  for (const [k, v] of Object.entries(SUNDER_CARD)) add(`sunderCard.${k}`, v());
  add('tithe.mine', COURT_TITHE_TEXT.mine(600, 'Ruby'));   // AUDIT WB14 (TEXT-1): the gem's bare name, as the court passes it add('host.titheCaught', COURT_HOST_TEXT.titheCaught('Ann'));
  for (const [k, v] of Object.entries(CAPTIVE_TEXT)) add(`captive.${k}`, k === 'felled' ? v('Ann', 2) : v('Sir Evrard'));   // WB14f: the Captive's moments
  // AUDIT WB14 (TEXT-10): the portents' own words - each one's name, line and tip, the Dire Breach's, and the chat's line
  for (const p of GATE_PORTENTS) { add(`portent:${p.id}.name`, p.name); add(`portent:${p.id}.line`, p.line); add(`portent:${p.id}.tip`, p.tip); }
  add('portent.dire', gateDireLine()); add('portents.line', portentsLine(['vanguard', 'sunder']));
  for (const [k, v] of Object.entries(COURT_TEXT)) add(`court.${k}`, v);
  add('gate.opensIn', GATE_TEXT.opensIn('3:12')); add('gate.collapsesIn', GATE_TEXT.collapsesIn('6:12'));
  for (const [k, v] of Object.entries(GATE_NO_TEXT)) add(`no:${k}`, v);
  add('claim.recorded', GATE_CLAIM_TEXT.recorded(4)); add('claim.guest', GATE_CLAIM_TEXT.guest); add('drakes.capped', MARKS_TEXT.capped);
  add('insignia.sub', INSIGNIA_SUB); for (const [k, v] of Object.entries(INSIGNIA_LINE)) add(`insignia.${k}`, v);
  for (const [k, v] of Object.entries(INSIGNIA_CARD)) v.forEach((x, i) => add(`card.${k}.${i}`, x));
  dismantleAsk('Ebony Cuirass', 2).forEach((x, i) => add(`dismantle.${i}`, x));
  for (const w of ['short', 'guest']) add(`refusal.${w}`, accountRefusalText(w));
  // AUDIT WB12d (D18): the faithful's rite, every line it says
  add('rite.omen', riteOmenLine());
  for (const [k, v] of Object.entries(RITE_TEXT)) add(`rite.${k}`, typeof v === 'function' ? (k === 'broken' ? v({ near: 'Copperham', by: ['Ann', 'Bran'], n: 5 }) : v(7)) : v);
  add('rite.post', ritePost({ place: 'Copperham, Wrothgarian Mountains', by: ['Ann', 'Bran'], n: 5 }).content);
  add('claim.rite', GATE_CLAIM_TEXT.rite); add('claim.guestRite', GATE_CLAIM_TEXT.guestRite);
  add('spoils.rite', SPOILS_TEXT.rite); add('strike.spilledRite', COURT_STRIKE_TEXT.spilledRite());
  return out;
}

test('WB13b THE STYLE, a law over every table: no "X, not Y"; no dash aside in a sentence (" - " only between a label and its value, which these lines never are); no colon gloss; no second sentence that comments ("will not suffer it long", "yours alone"); numbers as numerals (mutants: a line of the old style back)', () => {
  const all = lines();
  assert.ok(all.length > 80, `${all.length} lines read`);
  const bad = [];
  for (const [where, s] of all) {
    if (/, not (flame|after|before)\b|\bnot flame\b/.test(s)) bad.push(`${where}: "X, not Y" - ${s}`);
    if (/\S - \S/.test(s)) bad.push(`${where}: a dash aside - ${s}`);
    if (/[a-z]: [a-z]/i.test(s.replace(/\b\d{1,2}:\d{2}\b/g, '')) && !/^Breaches closed: /.test(s) && !/Breaches closed: \d/.test(s)) bad.push(`${where}: a colon gloss - ${s}`);
    if (/will not suffer it long|yours alone|you did not stand|he drinks it in|the coal, the fire and the ember|as often as you like|bring the whole court/i.test(s)) bad.push(`${where}: a comment - ${s}`);
    if (/\ba quarter more\b|\bhalf again\b/.test(s)) bad.push(`${where}: a number in words - ${s}`);
  }
  assert.deepEqual(bad, []);
  // the trial lines, as the card shows them: one statement, no full stop, more than a few words
  for (const t of GATE_TRIALS) assert.ok(t.text.length > 10 && !t.text.endsWith('.') && !t.text.includes(';'), t.id);
  // the tips: one order each, short
  for (const [k, v] of Object.entries(MARK_TIPS)) assert.ok(v.length <= 60 && v.endsWith('.'), `${k}: ${v.length}`);
  // AUDIT WB14 (TEXT-10): and the portents' tips by the same law - one order, short
  for (const p of GATE_PORTENTS) assert.ok(p.tip.length <= 60 && p.tip.endsWith('.') && !p.tip.includes(';'), `${p.id}: ${p.tip.length}`);
});

test('WB13b the chat names the marks - the card and the bar say what each does; Discord says the same sentence (mutants: the marks\' effects back in the chat; the herald\'s own sentence)', () => {
  assert.equal(marksLine({ boss: P.boss, md: ['rime', 'colossal', 'unyielding'] }), 'Valkynaz Ruhn comes the Rime-Wrought tonight, Colossal and Unyielding.');
  assert.equal(marksLine({ boss: P.boss, md: ['burning'] }), 'Valkynaz Ruhn comes the Burning tonight.');
  for (const t of GATE_TRIALS) assert.ok(!marksLine({ boss: P.boss, md: ['burning', t.id] }).includes(t.text), `${t.id}: named, never explained`);
  const post = omenPost({ day: 112, place: 'Copperham' }).content;
  assert.ok(post.endsWith('. The faithful work their rite nearby. Kill their Summoner before the breach opens. Valkynaz Ruhn comes **the Rime-Wrought** tonight, Colossal and Unyielding.'), post);   // WB12d: the rite, a line
  assert.ok(!/holds it|Tonight he comes/.test(post));
  assert.equal(fellPost({ day: 112, top: [], n: 0 }).content, '**Valkynaz Ruhn has fallen** at Dagon\'s Breach in the wilds. The breach collapses.');
  assert.equal(fellLine({ near: null, boss: P.boss, top: [] }), 'Valkynaz Ruhn has fallen at Dagon\'s Breach in the wilds. The breach collapses.', 'the chat says what Discord says');
  assert.match(read('src/scenes/world.js'), /chatNotice\(fellLine\(\{ near: site\?\.day === day \? site\.near : null,/, 'a screen that never found the site: no place ("near the wilds")');
});

test('WB13b nothing said on stepping into the court - the marks\' card stands at that moment, with the same subtitle as by the gate (mutants: the arrival line said again; two subtitles)', () => {
  assert.ok(!('arrive' in COURT_MARKS_TEXT));
  for (const a of GATE_ASPECTS) assert.ok(!('arrive' in a) && !('floor' in a), a.id);
  assert.equal(MARKS_CARD_TEXT.gate('Valkynaz Ruhn', 'the Burning'), MARKS_CARD_TEXT.arrive('Valkynaz Ruhn', 'the Burning'));
  const md = ['venom', 'grudge', 'echoing'];
  assert.equal(marksCardModel(md, { name: 'Valkynaz Ruhn' }, { mode: 'gate' }).sub, marksCardModel(md, { name: 'Valkynaz Ruhn' }, { mode: 'arrive', since: 0, now: 1000 }).sub);
  const gc = read('src/scenes/gate/gateCourt.js');
  assert.match(gc, /if \(!marksSaid\) \{ marksSaid = true; if \(P\.md && !s\.fell && s\.wrath == null\) marksAt = t; \}/);
});

test('WB13b a phase\'s turn is its name and (WB13e) its one order on its card; the Reckoning\'s call, its count and its break one line each (the bar counts it down) (mutants: the old turn)', () => {
  assert.deepEqual([courtPhaseCard(2).main, courtPhaseCard(2).sub], ['The Burning Court', 'Follow him over the walkway.']);
  assert.deepEqual([courtPhaseCard(3).main, courtPhaseCard(3).sub], ['Dagon\'s Champion', 'Follow him to the last court.']);
  for (const n of [2, 3]) assert.ok(courtPhaseOrder(n).split(' ').length <= 6, `${n}: one order, read at a glance`);
  assert.equal(COURT_RECKON_TEXT.call(4), 'Dagon\'s Reckoning! Shatter all 4 crystals!');
  assert.equal(COURT_RECKON_TEXT.broken(), 'The Reckoning breaks! Strike now!');
});

test('WB13b the notice board\'s card says where and the countdown\'s state - the subject is the name (it said the label again) (mutant: the label in the body)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const state = String\(mark\.label \?\? ''\)\.replace\(\/\^Dagon's Breach\(\?: - \)\?\/, ''\);/);
  assert.match(w, /body: state \? `Near \$\{near\}\. \$\{state\.charAt\(0\)\.toUpperCase\(\)\}\$\{state\.slice\(1\)\}\.` : `Near \$\{near\}\.`/);
  // the same transform, read as the card would say it
  const body = (label, near) => { const state = String(label ?? '').replace(/^Dagon's Breach(?: - )?/, ''); return state ? `Near ${near}. ${state.charAt(0).toUpperCase()}${state.slice(1)}.` : `Near ${near}.`; };
  assert.equal(body('Dagon\'s Breach - opens in 4:07', 'Copperham'), 'Near Copperham. Opens in 4:07.');
  assert.equal(body('Dagon\'s Breach - sealed, collapses in 6:12', 'Copperham'), 'Near Copperham. Sealed, collapses in 6:12.');
  assert.equal(body('Dagon\'s Breach', 'Copperham'), 'Near Copperham.');
});
