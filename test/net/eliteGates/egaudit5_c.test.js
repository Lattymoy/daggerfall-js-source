// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; fix group C, "client" - bible/11-Multiplayer/Elite-Gates.md
// sections 5, 6.4, 11.10, 16.2-16.5, 17.4, 27.7, 27.8 and 29) - THE BREACH CLIENT'S DOORS, PINNED on this screen's own
// client (scenes/eliteGates/egClient.js createEgClient) inside the director's own breach (net/eliteGates/egBrain.js egBreachNew, egEnter, egStep,
// egStateOf - every word through the wire, net/wire.js validEgOut):
//   L7-1   no `/breach` command with an argument reached the client: the host's door (scenes/world.js onSend) read one word;
//   L7-21  `/breach`'s words said whole (usage, `/breach help`, /help's own line), and a word it does not know outside the
//          Spire answering the call;
//   L7-2   at every Redoubt's rest Y and `/breach vote yes` voted on the respite, not the Ready (the director asks the
//          decrees, the Ready and the respite in one beat, the respite newest) - and the respite's own key and word;
//   L7-3   the pad reached only the offer's cards, then only the newest ask: its focus runs over every choice open;
//   L6-1   a witness whose socket closed for good walked out still a witness (no blow landing in the open world);
//   L6-6   the start window's preflight never judged again when it landed; away() closed the window before emptying its slot;
//   L7-14  a keyless player had no door to the start window's Rehearsal: `/breach` with no call standing opens it;
//   L7-5   the Annals kept on the account could never be read: the account's pages, read anywhere;
//   L7-11  egRefusalText kept a second copy of four catalog sentences: the catalog's own (net/accountClient.js REFUSALS);
//   L2-9   a rest healing less than whole gave no magicka or fatigue back;
//   L2-14  a reload refilled the hall's two potions;
//   L7-23  a first-time line whose word to the service was lost before a reload was shown again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgClient, egRefusalText, egBreachUsage, egBreachUsageOut, egRespiteHow, egRestVitals, EG_START_ASKING_TEXT, EG_POTIONS_KEY, EG_PAD_SHOULDERS } from '../../../src/scenes/eliteGates/egClient.js';
import { breachCommandOf, helpLines, breachHelpLine, HELP_LINES, HOST_COMMANDS, parseChatLine } from '../../../src/net/chatCommands.js';
import { egBreachNew, egEnter, egStateOf, egStep, EG_PING_MS } from '../../../src/net/eliteGates/egBrain.js';
import { egAsk } from '../../../src/net/eliteGates/egRun.js';
import { egCircleOfHall, egHallOf, EG_SEALED_MS, EG_TEXT, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { EG_ANNALS } from '../../../src/net/eliteGates/egAnnals.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { accountRefusalText } from '../../../src/net/accountClient.js';
import { maxFatigue } from '../../../src/systems/statMods.js';
import { egFirstOver, egFirstKey, egFirstRead, EG_FIRST_KEY } from '../../../src/ui/eliteGates/egBeats.js';
import { drawEgPanel, destroyEgHud, egPanelModel, EG_POTIONS_PER_HALL } from '../../../src/ui/eliteGates/egHud.js';
import { egPadAct, egPadPrompts, destroyEgSpireHud } from '../../../src/ui/eliteGates/egSpireHud.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000, ME = 'acct-0', BID = '0123456789abcdef';
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const WIN = { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) };
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r)); };
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k), m }; }
const rngOf = () => { let r = 0.37; return () => (r = ((r * 9301 + 49297) % 233280) / 233280); };

/**
 * The director's breach of `n` (me first) at hall `h`, stage `sg`, and this screen's client standing in it: the mode machine
 * stands the breach's circle while `st.inside`; the room's link records every word I say (`L.sent`); `tell` hands a word of the
 * room's through the wire (a word addressed to another member is not mine to hear).
 */
function spire(t, { n = 2, h = 20, sg = 'rest', store = memStore(), entity = null, account = {}, peers = () => [], party = null, startWindow = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  t.mock.method(Date, 'now', () => clock);
  const names = ['Mac', 'Ann', 'Bo', 'Cy'];
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, names[i], i + 1]);
  const B = egBreachNew({ b: BID, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: SITE, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 }; B.rd = Math.floor((h - 1) / 5); B.resp = 900_000;
  const L = { sent: [], said: [], mids: [], asked: [] };
  const st = { inside: true, terminal: false, error: null, mode: 'dungeon' };
  const ent = entity ?? { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 5, stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, intelligence: 50 }, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { get mode() { return st.inside ? 'dungeon' : st.mode; }, egHallBreach: () => (st.inside ? B.b : null), egHallCircle: () => (st.inside ? egCircleOfHall(B.h) : null),
    egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { st.inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => go(), enterEgHall: () => true, forceExitToExterior: () => { st.inside = false; }, egSwapDrop: () => {}, egBandsDown: () => 0, deathUp: () => false };
  const online = { welcomes: 1, get terminal() { return st.terminal; }, get error() { return st.error; }, sendEg: (k, f = {}) => { L.sent.push({ k, ...f }); return true; } };
  const acct = { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), ...account };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => ({ egOk: true, sendEg: () => true }), account: acct, now: () => clock, entity: ent, player, cam: { pos: [0, 1.6, 0], yaw: 0 },
    say: (s) => L.said.push(s), mid: (s) => L.mids.push(s), site: () => ({}), wire: () => SITE, landAt: () => true, hurt: (k) => { ent.health -= k; }, store, peers, win: WIN,
    party: party ?? (() => co.map(([sub, name]) => ({ sub, name }))), startWindow, keyFacts: () => ({ site: SITE }) });
  const tell = (w) => { const { to, ...rest } = w; if (to && to !== ME) return; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  const rng = rngOf();
  /** One beat of the director (no poses), its words told. */
  const beat = () => { for (const w of egStep(B, clock, [], rng)) tell(w); };
  /** THE REST WINDOW as the director lays it (section 16.2): the heal, the offers, the decrees, the Ready and the respite. */
  const restWindow = () => { B.sg = 'rest'; B.rdAt = clock - 6000; B.rdSeq = { recalled: 1, window: 0, valk: 0 }; B.su = clock + 90_000; tell(egStateOf(B, clock)); beat(); };
  return { B, client, L, st, store, entity: ent, player, tell, beat, restWindow, step: (ms) => { clock += ms; }, now: () => clock };
}

// ── L7-1 / L7-21 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-1 THE /breach DOOR TAKES ITS WORDS WHOLE (section 27.8\'s and the notes\' `/breach pick N`, `vote`, `buy`, `cant`, `surplus`, `ping`, `bequest`): the host\'s own send path (scenes/world.js onSend) asks net/chatCommands.js breachCommandOf, which hands every word after `/breach` to the client - each to its room word in the director\'s own rest - where a one-word door read every two-word command as no command (mutants: the door one word again; the tail cut; world.js\'s door its own regex)', (t) => {
  // the door, pure
  assert.equal(breachCommandOf('/breach pick 2'), 'pick 2');
  assert.equal(breachCommandOf('  /BREACH   vote yes  '), 'vote yes');
  assert.equal(breachCommandOf('/breach'), '');
  assert.equal(breachCommandOf('/breach ping danger'), 'ping danger');
  assert.equal(breachCommandOf('/breachx'), null, 'another word');
  assert.equal(breachCommandOf('say /breach pick 2'), null);
  // the host's own send path hands the door's words whole, and holds no door of its own
  const W = rd('src/scenes/world.js');
  assert.match(W, /\{ const arg = breachCommandOf\(text\); if \(arg != null\) \{ if \(!egClient\) chatLog\.push\(tabId, \{ text: 'Connect and sign in to use Elite Breaches\.', system: true \}\); else egClient\.command\(arg\); return true; \} \}/);
  assert.doesNotMatch(W, /\\\/breach\(\?:/, 'no second /breach regex in the host');
  assert.ok(HOST_COMMANDS.includes('breach'));
  assert.deepEqual(parseChatLine('/breach pick 2'), { kind: 'host', name: 'breach' }, 'the parser knows it for the host\'s');
  // through the door into the director's own rest: every two-word command reaches its room word
  const R = spire(t);
  R.B.mem[ME].cant = [2]; R.B.sur = 1;
  R.restWindow();
  const E = R.client.state();
  assert.ok(E.offer.v.length >= 3, 'the offer stands');
  const said = (line) => { R.L.sent.length = 0; R.client.command(breachCommandOf(line)); return R.L.sent.map(({ k, v, q, y, i, use, w }) => ({ k, v, q, y, i, use, w })); };
  assert.deepEqual(said('/breach pick 2'), [{ k: 'pick', v: E.offer.v[1], q: undefined, y: undefined, i: undefined, use: undefined, w: undefined }]);
  assert.deepEqual(said('/breach vote 2').map((x) => [x.k, x.q, x.y]), [['vote', 'dec:lord', 1]], 'the first decree unanswered, its second option');
  assert.deepEqual(said('/breach buy tonic').map((x) => [x.k, x.i]), [['buy', 1]]);
  assert.deepEqual(said('/breach cant 1').map((x) => [x.k, x.i]), [['cant', 0]]);
  assert.deepEqual(said('/breach surplus reroll').map((x) => [x.k, x.use]), [['surplus', 1]]);
  assert.deepEqual(said('/breach ping danger').map((x) => [x.k, x.w]), [['lping', 1]]);
  assert.deepEqual(said('/breach vote yes').map((x) => [x.k, x.q, x.y]), [['vote', 'ready', 1]]);
});

test('AUDIT EG V L7-21 /breach SAYS ITS WORDS WHOLE, AND A WORD IT DOES NOT KNOW OUTSIDE ANSWERS NOTHING (section 27.8): every word command() takes is in its usage - in the breach and out of it, the source swept so a new word without one fails - `/breach help` says them, /help carries /breach\'s line; outside the Spire an unknown word is told the words and never answers the call or opens a window (mutants: a word dropped from the usage; /help without /breach; the unknown word answering)', async (t) => {
  // every word the command takes, off its own source, is in a usage
  const C = rd('src/scenes/eliteGates/egClient.js');
  const body = C.slice(C.indexOf('    command(arg = \'\') {'), C.indexOf('    vote(y) {'));
  const words = new Set([...body.matchAll(/a === '([a-z?]+)'/g)].map((m) => m[1]));
  const alias = new Set(['rehearsal', 'boards', 'cantrip', 'engine', 'spirebridge', '?']);
  const inside = ['pick', 'vote', 'respite', 'cant', 'tonic', 'buy', 'surplus', 'use', 'bridge', 'annals', 'ping', 'watch', 'bequest', 'forsake', 'home', 'board'];
  const outside = ['rehearse', 'board', 'annals'];
  assert.deepEqual([...words].filter((w) => !alias.has(w)).sort(), [...new Set([...inside, ...outside, 'help'])].sort(), 'the command\'s words, swept');
  for (const w of inside) assert.match(egBreachUsage(), new RegExp(`\\b${w}\\b`), `the breach's usage names ${w}`);
  for (const w of outside) assert.match(egBreachUsageOut(), new RegExp(`/breach ${w}\\b`), `the open world's usage names ${w}`);
  // /help's own line
  assert.ok(helpLines().includes(breachHelpLine()) && /^\/breach /.test(breachHelpLine()));
  assert.equal(helpLines().at(-1), HELP_LINES.at(-1), 'the slash line stays last');
  assert.equal(helpLines().length, HELP_LINES.length + 1);
  assert.match(rd('src/scenes/world.js'), /if \(cmd\.kind === 'help'\) \{ for \(const line of helpLines\(\)\) note\(line\); return 'read'; \}/);
  // outside the Spire, with a call of mine standing: an unknown word is told the words - no admission, no portal
  const R = spire(t, { account: { admit: async (b) => { R.L.asked.push(['admit', b]); return { ok: true, data: { order: 'v1.order' } }; } } });
  R.st.inside = false; R.st.mode = 'exterior';
  R.tell({ k: 'call', b: BID, ew: 0, seed: 77, op: R.now() - EG_SEALED_MS - 1000, o: 'Mac', os: 'acct-1', co: [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]], rh: 0, site: SITE, sg: 'x'.repeat(86) });
  R.client.command('pick 2');
  await settle();
  assert.deepEqual(R.L.asked, [], 'never an answer');
  assert.equal(R.L.said.at(-1), egBreachUsageOut());
  R.client.command('help');
  assert.equal(R.L.said.at(-1), egBreachUsageOut());
});

// ── L7-2 / L7-3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-2 AT A REDOUBT\'S REST, Y AND `vote yes` NAME THE READY - THE RESPITE IS ITS OWN WORD (section 16.2: "A Ready vote ... ends it early"; the notes: "Ready up ... (Y, or /breach vote yes)"): in the director\'s own rest window (the decrees, the Ready and the respite asked in one beat, the respite newest) Y and `vote yes`/`vote no` answer the Ready; R, `/breach respite` and `/breach vote respite` the respite; a number names the first decree unanswered, then the newest but the respite; with only the respite asked a yes is told its word and sends nothing (mutants: the newest ask again; the respite reached by a yes; R deaf; a number on the respite)', (t) => {
  const R = spire(t);
  R.restWindow();
  assert.deepEqual(R.client.state().as.map((a) => a[0]), ['dec:lord', 'dec:covenant', 'ready', 'respite'], 'the director\'s ask order');
  const votes = () => R.L.sent.filter((w) => w.k === 'vote').map((w) => [w.q, w.y]);
  R.client.key({ code: 'KeyY' });
  assert.deepEqual(votes(), [['ready', 1]], 'Y readies');
  R.L.sent.length = 0; R.client.command('vote yes'); R.client.command('vote no');
  assert.deepEqual(votes(), [['ready', 1], ['ready', 0]]);
  R.L.sent.length = 0; R.client.key({ code: 'KeyR' }); R.client.command('respite'); R.client.command('respite no'); R.client.command('vote respite');
  assert.deepEqual(votes(), [['respite', 1], ['respite', 1], ['respite', 0], ['respite', 1]], 'the respite\'s own key and words');
  R.L.sent.length = 0; R.client.command('vote 1'); R.client.command('vote 2'); R.client.command('vote 2');
  assert.deepEqual(votes(), [['dec:lord', 0], ['dec:covenant', 1], ['ready', 1]], 'the decrees first, then the newest but the respite');
  // only the respite asked (the director's own ask): a yes is told the respite's word
  R.B.asks = []; const out = []; egAsk(R.B, 'respite', [1], R.now() + 20_000, out);
  R.step(11_000); for (const w of out) R.tell(w);
  R.L.sent.length = 0;
  assert.equal(R.client.key({ code: 'KeyY' }), false);
  assert.deepEqual(votes(), []);
  assert.equal(R.L.said.at(-1), egRespiteHow());
  R.client.key({ code: 'KeyR' });
  assert.deepEqual(votes(), [['respite', 1]]);
});

test('AUDIT EG V L7-3 THE PAD REACHES EVERY CHOICE THE PANEL SHOWS (section 27.8; the notes: "the panel, the votes and the Surplus work on ... gamepad"): over the director\'s own rest - the offer, a Surplus, two decrees, the Ready and the respite open in one beat - the d-pad\'s focus runs over the cards, the Surplus\'s two, then each choice\'s options in the panel\'s order, up takes the one it stands on, down says no to a yes-or-no; the panel marks that very button (mutants: the focus kept to the cards; to the newest ask; the panel\'s mark on another button)', (t) => {
  const R = spire(t);
  R.B.sur = 1;
  R.restWindow();
  const E = R.client.state();
  const model = egPanelModel(E, ME, R.now(), {});
  const labels = [...model.offer.cards.map((c) => `card ${c.card}`), 'surplus 0', 'surplus 1', ...model.asks.flatMap((a) => a.opts.map((o, y) => `${a.q} ${y}`))];
  assert.ok(labels.length >= 3 + 2 + 2 + 2 + 2);
  const took = [];
  for (let i = 0; i < labels.length; i++) {
    R.L.sent.length = 0;
    R.client.padGesture('up', 'tap');
    const w = R.L.sent[0];
    took.push(w.k === 'pick' ? `card ${w.v}` : w.k === 'surplus' ? `surplus ${w.use}` : `${w.q} ${w.y}`);
    // the panel marks the button the focus stands on
    const doc = fakeDocument();
    destroyEgHud();
    drawEgPanel(egPanelModel(R.client.state(), ME, R.now(), {}), { doc, focus: i });
    const marked = find(doc.body, 'eg-focus');
    assert.equal(marked.length, 1, `one button marked at ${i}`);
    R.client.padGesture('right', 'tap');
  }
  destroyEgHud();
  assert.deepEqual(took, labels, 'every choice, in the panel\'s order');
  // down answers the focused yes-or-no no
  const at = labels.indexOf('respite 1');
  for (let i = 0; i < labels.length; i++) R.client.padGesture('right', 'tap');   // round again to 0
  for (let i = 0; i < at; i++) R.client.padGesture('right', 'tap');
  R.L.sent.length = 0; R.client.padGesture('down', 'tap');
  assert.deepEqual(R.L.sent.map((w) => [w.k, w.q, w.y]), [['vote', 'respite', 0]]);
});

// ── L6-1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L6-1 THE WITNESS ENDS AT THE DOOR (section 16.5): a fallen member whose socket closes for good (another tab takes the seat, a relay policy close) walks out no longer a witness - every blow lands on them in the open world again and the camera is theirs - for walkOut, the one door every way out takes, empties the witness first (mutants: the terminal exit keeping the witness; walkOut leaving it)', (t) => {
  const R = spire(t, { h: 2, sg: 'trial' });
  R.tell(egStateOf(R.B, R.now()));
  R.client.frame();
  assert.equal(R.client.fallSave(), true, 'a killing blow in the Spire is a fall');
  assert.equal(R.client.witnessing(), true);
  R.client.frame(); R.step(1000);
  R.st.terminal = true; R.st.error = 'another tab, window or device has the seat';
  R.client.frame(); R.step(16);
  assert.equal(R.st.inside, false, 'walked out');
  assert.equal(R.client.witnessing(), false, 'and no longer a witness');
  assert.ok(R.entity.health >= 1);
  for (let k = 0; k < 30; k++) { R.client.frame(); R.step(16); }
  assert.equal(R.client.witnessing(), false);
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /function walkOut\(text\) \{\n {4}if \(leaving\) return;\n {4}leaving = true; returning = null;[^\n]*\n(?: {4}\/\/[^\n]*\n)* {4}if \(witness\) \{ witness = null; entity\.health = Math\.max\(1, entity\.health\); \}/, 'the walk out empties the witness first');
});

// ── L6-6 / L7-14 ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** This screen on open ground, its start window's preflight held until the test lands it. */
function open(t, { keys = 3 } = {}) {
  const st = { mode: 'exterior' }, opened = [], said = [], asked = [];
  const pending = [];
  let clock = T0;
  t.mock.method(Date, 'now', () => clock);
  const account = { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), starts: (subs) => { asked.push(subs); return new Promise((r) => { pending.push(r); }); }, admit: async (b) => { asked.push(['admit', b]); return { ok: true, data: { order: 'v1.order' } }; } };
  const modes = { get mode() { return st.mode; }, egHallBreach: () => null, egHallCircle: () => null };
  const client = createEgClient({ modes: () => modes, online: () => ({ welcomes: 1, terminal: false, sendEg: () => true }), hub: () => ({ egOk: true, sendEg: () => true }), account, now: () => clock,
    entity: { level: 30, health: 100, maxHealth: 100, items: [] }, player: { pos: [0, 0, 0] }, cam: { pos: [0, 0, 0], yaw: 0 }, say: (s) => said.push(s), mid: () => {}, site: () => ({}), wire: () => SITE, landAt: () => true, hurt: () => {},
    keyFacts: () => ({ site: SITE }), startWindow: (o) => { const w = { o, closed: 0, close() { w.closed++; w.onClose?.(); } }; opened.push(w); return w; }, party: () => [], win: WIN });
  return { client, st, opened, said, asked, land: (data = { keys, starts: {}, rehearsal: true }) => { for (const r of pending.splice(0)) r({ ok: true, data }); } };
}

test('AUDIT EG V L6-6 THE START WINDOW\'S PREFLIGHT IS JUDGED AGAIN WHEN IT LANDS (section 29 - "every refusal is checked again when its async answer lands"), AND ITS SLOT IS EMPTIED BEFORE IT IS CLOSED: a preflight landing after the screen let it go (away) opens nothing; one landing after a refusal came to stand (a step indoors) says the refusal and opens nothing; a key turned again after away() opens one window, not two; away() empties the slot before the window is told - its close finds it free (mutants: the window opened after away; after a refusal; the slot cleared after the close)', async (t) => {
  { const R = open(t); assert.equal(R.client.useKey(), ''); R.client.away(); R.land(); await settle(); assert.equal(R.opened.length, 0, 'let go meanwhile: no window'); }
  { const R = open(t); R.client.useKey(); R.st.mode = 'interior'; R.land(); await settle(); assert.equal(R.opened.length, 0, 'indoors meanwhile: no window'); assert.equal(R.said.at(-1), EG_TEXT.sky, 'the refusal come to stand, said'); }
  { const R = open(t); R.client.useKey(); R.client.away(); R.client.useKey(); R.land(); await settle(); assert.equal(R.opened.length, 1, 'two preflights, one window'); }
  // the slot emptied before its occupant is told: the window's close asks the key again, and finds the slot free
  { const R = open(t); R.client.useKey(); R.land(); await settle(); assert.equal(R.opened.length, 1);
    const w = R.opened[0]; let again = null; w.onClose = () => { again = R.client.useKey(); };
    R.client.away();
    assert.equal(w.closed, 1);
    assert.notEqual(again, EG_START_ASKING_TEXT, 'the slot was free when the window was told');
  }
});

test('AUDIT EG V L7-14 A KEYLESS PLAYER\'S DOOR TO THE REHEARSAL (sections 5 and 27.7; the notes: "No key yet? Choose Rehearse in the start window"): `/breach` with no call of mine standing opens the start window as the key does - its refusals first - and with no key it offers the day\'s Rehearsal; with a call of mine standing it answers the call (mutants: `/breach` alone telling the old line; opening a window over a call)', async (t) => {
  const R = open(t, { keys: 0 });
  R.client.command('');
  assert.equal(R.asked.length, 1, 'the preflight asked');
  R.land({ keys: 0, starts: {}, rehearsal: true });
  await settle();
  assert.equal(R.opened.length, 1, 'the start window opened');
  assert.equal(R.opened[0].o.keys, 0);
  assert.equal(R.opened[0].o.rehearsal, true, 'the Rehearsal offered to a keyless player');
  // indoors: the key's refusal, no window
  const I = open(t); I.st.mode = 'interior'; I.client.command(''); assert.equal(I.asked.length, 0); assert.ok(I.said.length > 0);
  // a call of mine standing: `/breach` answers it
  const C = open(t);
  C.client.word(validEgOut({ k: 'call', b: BID, ew: 0, seed: 77, op: T0 - EG_SEALED_MS - 1000, o: 'Ann', os: 'acct-1', co: [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]], rh: 0, site: SITE, sg: 'x'.repeat(86) }));
  C.client.command('');
  await settle();
  assert.deepEqual(C.asked, [['admit', BID]], 'the call answered, no window asked');
});

// ── L7-5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-5 THE ANNALS KEPT ON THE ACCOUNT ARE READ ANYWHERE (section 11.10; the notes: "the pages you find are kept on your account"): the account\'s pages (`/v1/eg/keys` `annals`, a bit a page) read at each answer, and `/breach annals` lists them and reads one in the open world, with this breach\'s gifts beside them (mutants: the account\'s bits unread; annals the Spire\'s alone)', async (t) => {
  const R = open(t);
  R.client.command('annals');
  assert.equal(R.said.at(-1), 'No page of the Annals is yours yet. Look behind the halls\' false walls.');
  const C = createEgClient({ modes: () => ({ mode: 'exterior', egHallBreach: () => null, egHallCircle: () => null }), online: () => null, hub: () => null, now: () => T0,
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: true, data: { keys: 0, annals: (1 << 20) | 0b101, first: 0 } }) }, entity: { items: [] }, player: { pos: [0, 0, 0] }, cam: {}, say: (s) => R.said.push(s), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, win: WIN });
  C.frame(); await settle();
  C.command('annals');
  assert.equal(R.said.at(-1), `Your pages of the Annals: 1. ${EG_ANNALS[0][0]}, 2. ${EG_ANNALS[2][0]}, 3. ${EG_ANNALS[20][0]}. /breach annals N to read one.`);
  C.command('annals 3');
  assert.equal(R.said.at(-1), `${EG_ANNALS[20][0]}: ${EG_ANNALS[20][1]}`);
});

// ── L7-11 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-11 THE SPIRE\'S REFUSALS ARE THE CATALOG\'S OWN (net/accountClient.js REFUSALS - in the player\'s language): every word the catalog holds and the Spire does not word its own way is said as the catalog says it, never a second English copy; the Spire\'s own words where they differ; a word nobody knows a shut road (mutants: the four copies back; a catalog word as a shut road)', () => {
  for (const w of ['unproven', 'rehearsed', 'spent', 'breach', 'rq', 'wager', 'subs', 'tier', 'start', 'none']) assert.equal(egRefusalText(w), accountRefusalText(w), w);
  assert.equal(egRefusalText('short'), EG_TEXT.noKeys);
  assert.equal(egRefusalText('live'), EG_TEXT.held);
  assert.equal(egRefusalText('offline'), EG_TEXT.shut);
  assert.equal(egRefusalText('no-such-word'), EG_TEXT.shut);
  assert.equal(egRefusalText(undefined), EG_TEXT.shut);
  const C = rd('src/scenes/eliteGates/egClient.js');
  for (const s of ["The Spire opens only to those who have closed a Dagon's Breach", 'You have rehearsed the Spire today', 'That breach is spent.', 'That breach is not one the Spire knows.']) assert.ok(!C.includes(s), `no second copy of "${s}"`);
});

// ── L2-9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-9 A REST THAT HEALS LESS THAN WHOLE GIVES MAGICKA AND FATIGUE BACK BY ITS SHARE (section 16.3 - "health, magicka and fatigue restored ... half under Ashen Vigil"): under Ashen Vigil the director\'s own rest heals half, and this screen\'s magicka and fatigue rise by half their whole with the health, never past it; a whole rest fills all three (mutants: magicka or fatigue left; the share whole; past the whole)', (t) => {
  const R = spire(t);
  R.B.dc = [[EG_DECREE_BY_KEY.ashen.id, 1]];
  R.entity.health = 20; R.entity.magicka = 10; R.entity.fatigue = 5;
  R.restWindow();
  const fm = maxFatigue(R.entity);
  assert.ok(fm > 40);
  assert.equal(R.entity.magicka, 10 + 25, 'half the magicka back');
  assert.equal(R.entity.fatigue, 5 + Math.round(fm * 0.5), 'half the fatigue back');
  assert.equal(R.entity.health, 20 + 50, 'and half the health');
  // the rest card says so, off the room's own heal word (the client's frame, its HUD drawn)
  globalThis.document = fakeDocument();
  try {
    R.client.frame();
    assert.match(find(globalThis.document.body, 'eg-stage')[0].textContent, /The rest heals 50%: Ashen Vigil\./);
  } finally { destroyEgSpireHud(); destroyEgHud(); delete globalThis.document; }
  // never past the whole
  const e = { magicka: 45, maxMagicka: 50, fatigue: fm - 1, stats: R.entity.stats };
  egRestVitals(e, 0.5);
  assert.deepEqual([e.magicka, e.fatigue], [50, fm]);
  // a whole rest: all three full
  const W = spire(t);
  W.entity.health = 20; W.entity.magicka = 0; W.entity.fatigue = 0;
  W.restWindow();
  assert.deepEqual([W.entity.health, W.entity.magicka, W.entity.fatigue], [100, 50, maxFatigue(W.entity)]);
});

// ── L2-14 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-14 A RELOAD REFILLS NO POTION (section 17.4, THE POTION LAW): the hall\'s count is kept on the device by its breach, hall and stage, so a client made again over the same store (a reload) in the same hall\'s trial holds what was left; the next hall\'s wake refills it; another breach\'s count is its own (mutants: the count kept in memory alone; a refill on the reload; another breach\'s count carried)', (t) => {
  const store = memStore();
  const R = spire(t, { h: 7, sg: 'trial', store });
  R.tell(egStateOf(R.B, R.now())); R.client.frame();
  assert.equal(R.client.potionAllowed(), true);
  R.client.potionUsed(); R.client.potionUsed();
  assert.equal(R.client.potionAllowed(), false, 'two a hall');
  assert.equal(JSON.parse(store.getItem(EG_POTIONS_KEY)).n, 0);
  // a reload: the same breach, the same hall, the same store
  const Q = spire(t, { h: 7, sg: 'trial', store });
  Q.tell(egStateOf(Q.B, Q.now())); Q.client.frame();
  assert.equal(Q.client.potionAllowed(), false, 'the reload refilled nothing');
  // the next hall's wake refills
  Q.B.h = 8; Q.tell(egStateOf(Q.B, Q.now())); Q.client.frame();
  assert.equal(Q.client.potionAllowed(), true);
  Q.client.potionUsed();
  assert.deepEqual(JSON.parse(store.getItem(EG_POTIONS_KEY)), { k: `${BID}:8:t`, n: EG_POTIONS_PER_HALL - 1 });
  // another breach: its own two
  store.setItem(EG_POTIONS_KEY, JSON.stringify({ k: 'ffffffffffffffff:8:t', n: 0 }));
  const O = spire(t, { h: 8, sg: 'closing', store });
  O.tell(egStateOf(O.B, O.now())); O.client.frame();
  assert.equal(O.client.potionAllowed(), true, 'another breach\'s count is not this one\'s');
});

// ── L7-23 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-23 A FIRST-TIME LINE IS SHOWN ONCE AN ACCOUNT, ITS LOST WORD CARRIED PAST A RELOAD (section 27.7): the device keeps each account\'s own bits (egFirstKey - another account on the device never silences mine), they are OR\'d in once the account answers, and a bit the account lacks is told it (mutants: the device\'s bits dropped once the account answers; one key for every account; the lost bit never told)', async (t) => {
  assert.equal(egFirstOver(1, 0, 0), 1, 'the device\'s bit kept over an account that lacks it');
  assert.equal(egFirstOver(0, 6, 1), 7);
  assert.equal(egFirstOver(4, null, 0), 4);
  assert.equal(egFirstKey(ME), `${EG_FIRST_KEY}:${ME}`);
  assert.equal(egFirstKey(null), EG_FIRST_KEY);
  // a reload: the device holds bit 0 for my account, the account answers 0 - the line is not due, and the account is told
  const store = memStore();
  store.setItem(egFirstKey(ME), '1');
  store.setItem(EG_FIRST_KEY, '0');
  const told = [];
  const R = spire(t, { h: 2, sg: 'trial', store, account: { keys: async () => ({ ok: true, data: { keys: 0, first: 0 } }), first: async (bits) => { told.push(bits); return { ok: true, data: { first: bits } }; } } });
  R.client.frame(); await settle();
  assert.deepEqual(told, [1], 'the account told the bit its lost word carried');
  R.tell(egStateOf(R.B, R.now())); R.client.frame(); R.step(500); R.client.frame();
  assert.ok(!R.L.said.includes('The count runs. Take a Redoubt to hold it back.'), 'the line is not shown again');
  // another account on the device: its own bits
  assert.equal(egFirstRead(store, egFirstKey('acct-other')), 0);
});

// ── the pad's witness rows (L7-7's pad half lives here beside its client) ───────────────────────────────────────────────
test('AUDIT EG V L7-7 (the pad) A WITNESS PINGS ON THE PAD\'S UP AND WATCHES ON ITS SHOULDERS (section 16.5 - "cycle with Q and E, the pad\'s shoulders"; "the ping ... its cooldown shown"): egPadAct\'s witness up is a ping and the prompt bar says it; the classic pad\'s LB and RB change whom; a ping inside its cooldown (EG_PING_MS, the room\'s own) is told its seconds and sends nothing (mutants: the up deaf; the shoulders deaf; the cooldown unheld)', (t) => {
  assert.deepEqual(egPadAct('up', 'tap', { witness: true }), { k: 'ping' });
  assert.ok(egPadPrompts({ witness: true }).some(([codes, label]) => codes.includes('JoystickAxis7Button0') && /Ping/.test(label)));
  assert.deepEqual(EG_PAD_SHOULDERS, { JoystickButton4: -1, JoystickButton5: 1 });
  assert.equal(EG_PING_MS, 3000);
  const R = spire(t, { n: 3, h: 2, sg: 'trial' });
  R.tell(egStateOf(R.B, R.now())); R.client.frame();
  R.client.fallSave(); R.client.frame();
  R.L.sent.length = 0;
  R.client.padGesture('up', 'tap');
  assert.deepEqual(R.L.sent.map((w) => [w.k, w.w]), [['ping', 0]], 'a witness\'s ping');
  R.step(1000); R.L.sent.length = 0;
  R.client.padGesture('up', 'tap');
  assert.deepEqual(R.L.sent, [], 'inside its cooldown nothing goes');
  assert.match(R.L.said.at(-1), /2s/);
  R.step(EG_PING_MS); R.client.touchAct('ping');
  assert.deepEqual(R.L.sent.map((w) => w.k), ['ping'], 'the touch layer\'s ping');
  // the shoulders change whom
  const before = R.client.state();
  assert.ok(before);
  assert.equal(R.client.key({ code: 'JoystickButton5' }), true);
  assert.equal(R.client.key({ code: 'JoystickButton4' }), true);
  // the director's own ping law holds the same cooldown
  assert.match(rd('src/net/eliteGates/egBrain.js'), /case 'ping': if \(!mm\.alive && now - \(mm\.pingAt \?\? 0\) >= EG_PING_MS\)/);
  assert.match(rd('src/net/eliteGates/egBrain.js'), /case 'lping': if \(mm\.alive && now - \(mm\.pingAt \?\? 0\) >= EG_PING_MS\)/);
});

// ── a fake document (EG-G1's, test/net/eliteGates/egpres_hud.test.js) ───────────────────────────────────────────────────────────────
function fakeDocument() {
  const doc = {};
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, _text: '', _cls: '', style: { setProperty() {} } };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); if (v === '') n.children = []; } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); } });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.replaceChildren = (...cs) => { n.children = []; n.append(...cs); };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.querySelectorAll = () => [];
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
void egHallOf;
