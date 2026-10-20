// AUDIT KG II (2026-10-15, bible/01-Overview/audits/Audit-Kings-Gambit-II.md, lane D): THE KING'S GAMBIT'S PANEL AND ITS
// WORDS, FOUND AND FIXED - the phone's strip (the watcher's presses and More, the clock first, the rest in More's sheet),
// a watcher's game read as nobody's own, a watched gold game's pot, the guide and the words at the board online, the
// stake picks first, a press that cannot act saying why, a rank and a seat read and never pressed, the season board
// hidden by its own press, the relay's own words with a way forward and a command's refusal naming its piece, the
// season's cap and a foe with no account said; and lane B's game gone while away and a look the gate refused asked again.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gambitHudModel, createGambitTableHud } from '../../../src/ui/gambitTableHud.js';
import {
  onlineRefusal, seasonKept, seasonFoeGuest, watchGold, gambitGuide, gambitWords, refusalWords, actionsLeftOf,
} from '../../../src/ui/gambitTableWords.js';
import { openGambitTableGame } from '../../../src/scenes/gambitTableGame.js';
import { createIliacClaims } from '../../../src/net/iliac/iliacClaims.js';
import { newGambitTable, gambitSit, gambitReady, gambitTick, gambitPublicView, GAMBIT_FIRST_MS } from '../../../src/net/gambit/gambitTable.js';
import { autoFill, KG_POINT_BUDGET, KG_MAX_UNITS, KG_ROSTER } from '../../../src/net/kingsGambit.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../../src/world/card/cardTableProp.js';
import { _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { xorshift } from '../../../tools/kgMeasure.mjs';
import { fakeDoc, text } from '../../decorFakes.mjs';

beforeEach(() => resetPrefs());
const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
const CHAIRS = [[0, 0, -0.9], [0.9, 0, 0], [0, 0, 0.9], [-0.9, 0, 0]];
const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
const find = (n, f, out = []) => { if (f(n)) out.push(n); for (const c of n.children ?? []) find(c, f, out); return out; };
function dealtTable() {
  const t = newGambitTable({ chairs: 4, gold: true }), rand32 = xorshift(3);
  gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' });
  gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' });
  gambitReady(t, { id: 'a', army: army(3), now: 0, stake: { j: 'ja', sub: 'acct-a', amount: 50 } });
  gambitReady(t, { id: 'b', army: army(4), now: 0, stake: { j: 'jb', sub: 'acct-b', amount: 50 } });
  gambitTick(t, GAMBIT_FIRST_MS, rand32);
  return t;
}
const online = (o = {}) => ({ seats: [{ name: 'Ana', ready: false, mine: false }, { name: 'Bors', ready: false, mine: false }], names: ['Ana', 'Bors'], canSit: false, ready: false, step: 'watch', stepArgs: { a: 'Ana', b: 'Bors' }, watching: true, clock: 42, gold: true, stakes: null, staking: false, canBoard: true, ...o });

test('AUDIT KG II D2 + D3 + D4 + D5 THE WATCHER\'S PANEL: its presses and More in the phone\'s strip; the clock first, the actions by whose turn, the rest in More\'s sheet; nobody\'s own pieces; a gold game\'s pot the winner\'s (mutants: the strip; the clock\'s order; the chips\' more; the watcher\'s title, actions and info; the pot\'s words)', () => {
  const st = dealtTable().game;
  const m = gambitHudModel({ phase: 'battle', online: online(), game: { state: st, crowns: ['daggerfall', 'wayrest'], name: 'Bors', stake: 0, pot: 100, over: null, dealt: [7, 7] }, touch: true, info: { piece: st.pieces.find((p) => p.side === 0 && p.king).id } });
  assert.deepEqual(m.actions.filter((a) => a.strip).map((a) => a.id), ['regulars', 'stand', 'more'], 'the strip holds the watcher\'s presses and More');
  assert.deepEqual(m.battle.chips.map((c) => c.key), ['clock', 'actions', 'potionsMine', 'potionsTheirs', 'fallenMine', 'fallenTheirs']);
  assert.deepEqual(m.battle.chips.filter((c) => !c.more).map((c) => c.key), ['clock', 'actions'], 'the strip\'s two');
  assert.equal(m.battle.chips[1].text, actionsLeftOf('Ana', st.actions));
  assert.equal(m.title, `Round ${st.round} - Ana's turn`, 'whose turn, never "your"');
  assert.ok(m.battle.info.lines.some((l) => /- Ana's$/.test(l)) && m.battle.info.lines.includes('If this king falls, Ana loses.'), m.battle.info.lines.join(' | '));
  const doc = fakeDoc();
  const hud = createGambitTableHud({ onPress() {}, doc });
  hud.render(m);
  const chips = find(hud.root, (n) => String(n.className).includes('dfgambit-chip') && !String(n.className).includes('dfgambit-chiprow') && n.attrs);
  assert.equal(chips.filter((n) => n.attrs['data-more'] === 'true').length, 4, 'potions and fallen are More\'s sheet\'s');
  assert.equal(watchGold({ winner: 0, by: 'king' }, 100, ['Ana', 'Bors']), 'Ana takes the pot: 100 gold.');
  assert.equal(watchGold({ winner: null, by: 'void' }, 100, ['Ana', 'Bors']), 'No contest. Each player gets their stake back.');
  const over = gambitHudModel({ phase: 'over', online: online(), game: { state: st, crowns: ['daggerfall', 'wayrest'], name: 'Bors', stake: 0, pot: 100, over: { winner: 1, by: 'forfeit', how: 'forfeit' }, dealt: [7, 7] } });
  assert.equal(over.result.gold, 'Bors takes the pot: 100 gold.');
});

test('AUDIT KG II D9 THE GUIDE AND THE WORDS AT THE BOARD ONLINE: another player and the table\'s gold, never a regular\'s; the words it prints defined (mutants: the guide online; the words online)', () => {
  const g = gambitHudModel({ phase: 'setup', online: online({ watching: false, step: 'sit', canSit: true }), canOnline: true, crown: 'daggerfall' });
  assert.deepEqual(g.guide.paras.slice(0, 2).map((p) => p.head), ['Play another player', 'Stake gold']);
  assert.match(g.guide.paras[1].body, /both players stake the same amount: 10, 50, 200, 1000, 5000 gold/);
  const terms = g.words.items.map((w) => w.term);
  for (const w of ['Ready', 'Turn clock', 'Pot', 'Season board', 'Rated game', 'Grandmaster (the title)']) assert.ok(terms.includes(w), w);
  assert.deepEqual(gambitGuide({ gold: false })[1].head, 'For fun');
  const off = gambitHudModel({ phase: 'setup', regulars: [], crown: 'daggerfall' });
  assert.equal(off.guide.paras[0].head, 'Choose a regular', 'offline, the regular\'s');
  assert.ok(!gambitWords(false).some((w) => w.term === 'Pot'));
  assert.match(gambitWords(false).find((w) => w.term === 'For fun').meaning, /and any game at a no-gold table/);
});

test('AUDIT KG II D14 + D17 + D18 THE ARMY AND THE BOARD: the stake picks first; Auto-fill, Clear, a pick while ready and Staking each say why; a seat and a rank are read, never pressed; the season board\'s press hides it when open (mutants: the order; the whys; the rows; the label)', () => {
  const doc = fakeDoc();
  const hud = createGambitTableHud({ onPress() {}, doc });
  const stakes = [10, 50].map((n) => ({ n, enabled: true, chosen: n === 50, why: null }));
  const full = autoFill([], KG_POINT_BUDGET, xorshift(3));
  const m = gambitHudModel({ phase: 'army', online: online({ watching: false, step: 'ready', ready: true, stakes }), army: full, crown: 'daggerfall' });
  hud.render(m);
  const secs = find(hud.root, (n) => String(n.className).includes('dfgambit-sec')).map((n) => text(n));
  assert.match(secs[0], /^Your stake/, 'the picks first');
  assert.equal(m.army.stakes.picks[0].why, 'Press Not ready to change your stake.');
  const fill = m.actions.find((a) => a.id === 'autofill');
  assert.equal(fill.enabled, false);
  assert.ok(fill.why === (full.length >= KG_MAX_UNITS ? `Your army is full: ${KG_MAX_UNITS} units.` : 'Your army has no points left for another unit.'), fill.why);
  const empty = gambitHudModel({ phase: 'army', online: online({ watching: false, step: 'ready' }), army: [], crown: 'daggerfall' });
  assert.equal(empty.actions.find((a) => a.id === 'clear').why, 'Your army is already empty.');
  const staking = gambitHudModel({ phase: 'army', online: online({ watching: false, step: 'ready', staking: true, stakes }), army: full, crown: 'daggerfall' });
  assert.equal(staking.actions.find((a) => a.id === 'ready').why, 'Placing your stake. Wait a moment.');
  const board = { season: { n: 4 }, rows: [{ rank: 1, name: 'Eira', rating: 1612, wins: 1, losses: 0, you: true }], me: { rating: 1612, wins: 1, losses: 0, games: 1 }, champion: null, titleNeeds: { games: 10, foes: 5 } };
  const set = gambitHudModel({ phase: 'setup', online: online({ watching: false, step: 'sit', canSit: true, seats: [{ name: 'Ana', ready: false, mine: true }, null] }), canOnline: true, crown: 'daggerfall', board, boardOpen: true });
  assert.equal(set.actions.find((a) => a.id === 'board').label, 'Hide the season board');
  assert.equal(set.board.rows[0].line, '1. Eira - rating 1612 (1 win, 0 losses)', 'the counts\' plurals (D20)');
  hud.render(set);
  assert.equal(find(hud.root, (n) => String(n.className).split(/\s+/).includes('dfgambit-seat')).length, 2);
  assert.equal(find(hud.root, (n) => String(n.className).split(/\s+/).includes('dfgambit-rank')).length, 1);
  assert.ok(find(hud.root, (n) => /dfgambit-(seat|rank)/.test(String(n.className))).every((n) => n.tag !== 'button' && !n.attrs?.tabindex), 'read, never pressed');
});

test('AUDIT KG II D10 + D11 + D16 THE WORDS: the relay\'s own words with a way forward; a command\'s refusal names its piece; the season\'s cap and a foe with no account said - the carrier says it (mutants: the words; the cap; onFoeGuest)', async () => {
  for (const [w, s] of [['seated', 'You already sit at this board.'], ['not seated', 'You are no longer seated at this board. Sit down again.'], ['no table', 'Nobody is at this board. Sit down to start a game.'], ['no game', 'That game has already ended.'], ['table differs', 'This board has changed. Stand up and sit down again.'], ['stale', 'Too late. That turn has already passed.']]) assert.equal(onlineRefusal(w), s);
  assert.notEqual(onlineRefusal('seated'), refusalWords('shape'), 'never the catch-all');
  assert.match(seasonKept('season'), /as often as this season allows/);
  assert.match(seasonKept('day'), /too often today/);
  assert.match(seasonKept(), /too often for now/);
  assert.match(seasonFoeGuest(), /the other player is not registered/);
  let said = 0;
  const c = createIliacClaims({ claim: async () => ({ ok: true, data: { recorded: false, why: 'foe-unregistered' } }), read: () => ({ j: '0123456789abcdef', f: ['acct-a', 'acct-b'], e: 1e12, signed: true }), me: () => 'acct-a', onFoeGuest: () => { said++; } });
  c.add('r1');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(said, 1, 'said, never a silent drop');
  // a command the relay refused names its piece
  const t = dealtTable();
  const sent = [];
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer: { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} }, entity: { name: 'a', items: [], goldPieces: 0 },
    say() {}, holdCursor: () => () => true, relock() {}, rand32: () => 7, now: () => 0, day: () => 1, key: 'k', friendly: true, regulars: [], frame: FRAME, mySeatFeet: CHAIRS[0], touch: () => false,
    onHoldem() {}, onIliac() {}, onStand() {},
    online: { send: (w) => { sent.push(w); return true; }, myId: () => 'a', now: () => 1e12, table: 1, chairs: 4, chair: 0, chairFeet: (k) => CHAIRS[k] },
  });
  g.relay({ t: 'gambit', table: 1, now: 1e12, events: [{ t: 'game', gameNo: 1 }], state: gambitPublicView(t) });
  const pc = g.g.session.state.pieces.find((p) => p.side === 0 && !p.king);
  g.g.lastOp = 'act'; g.g.lastCmd = { type: 'potion', piece: pc.id };
  g.relay({ t: 'gambit', table: 1, now: 1e12, error: 'full' });
  assert.match(g.g.why, new RegExp(`^${g.g.game.names.get(pc.id)} is at full health`), g.g.why);
  g.relay({ t: 'gambit', table: 1, now: 1e12, error: 'stale' });
  assert.equal(g.g.why, 'Too late. That turn has already passed.');
});

test('AUDIT KG II B2 + B17 A GAME GONE WHILE AWAY, AND A LOOK THE GATE REFUSED: a session whose game the relay holds neither under way nor ended is let go; a new socket\'s look asked again until it goes (mutants: the lost game; the look\'s count)', () => {
  const t = dealtTable();
  const sent = [];
  let welcomes = 1, open = true;
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer: { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} }, entity: { name: 'w', items: [], goldPieces: 0 },
    say() {}, holdCursor: () => () => true, relock() {}, rand32: () => 7, now: () => 0, day: () => 1, key: 'k', friendly: true, regulars: [], frame: FRAME, mySeatFeet: CHAIRS[3], touch: () => false,
    onHoldem() {}, onIliac() {}, onStand() {},
    online: { send: (w) => { if (!open && w.op === 'look') return false; sent.push(w); return true; }, myId: () => 'w', now: () => 1e12, table: 1, chairs: 4, chair: 3, chairFeet: (k) => CHAIRS[k], welcomes: () => welcomes },
  });
  g.relay({ t: 'gambit', table: 1, now: 1e12, events: [{ t: 'game', gameNo: 1 }], state: gambitPublicView(t) });
  assert.ok(g.g.session);
  g.relay({ t: 'gambit', table: 1, now: 1e12, events: [], state: { ...gambitPublicView(t), game: null, gameNo: 3, last: { gameNo: 3, winner: 0, how: 'king', names: ['Ana', 'Bors'], game: t.game } } });
  assert.equal(g.g.session, null, 'game 1 neither under way nor the table\'s last: let go');
  assert.equal(g.g.phase, 'setup');
  open = false; welcomes = 2;
  const looks = () => sent.filter((w) => w.op === 'look').length;
  const before = looks();
  g.frame(1);
  assert.equal(looks(), before, 'the gate refused it');
  open = true;
  g.frame(2);
  assert.equal(looks(), before + 1, 'asked again');
  g.frame(3);
  assert.equal(looks(), before + 1, 'once');
});

test('AUDIT KG II D1 THE ONLINE BOARD\'S THREE PRESSES IN THE THIRTEEN WHOLE LANGUAGES: Sit at the board, Play a regular instead and Not ready each its own words - the drafts had them rotated one key along (mutants: a row moved)', async () => {
  const { readFileSync } = await import('node:fs');
  const WANT = {
    'bg': ["Седни на дъската", "Играй със завсегдатай", "Не съм готов"],
    'cs': ["Přisednout k plánu", "Hrát radši se štamgastem", "Nepřipraven"],
    'da': ["Sæt dig ved brættet", "Spil mod en stamgæst i stedet", "Ikke klar"],
    'de': ["Ans Brett setzen", "Stattdessen gegen einen Stammgast spielen", "Nicht bereit"],
    'es': ["Sentarse al tablero", "Jugar contra un parroquiano", "No estoy listo"],
    'fr': ["S’asseoir au plateau", "Affronter plutôt un habitué", "Pas prêt"],
    'id': ["Duduk di papan", "Lawan pelanggan tetap saja", "Belum siap"],
    'it': ["Siediti al tabellone", "Gioca invece contro un avventore", "Non pronto"],
    'ko': ["판에 앉기", "단골과 대신 겨루기", "준비 취소"],
    'nb': ["Sett deg ved brettet", "Spill mot en stamgjest i stedet", "Ikke klar"],
    'pt-BR': ["Sentar ao tabuleiro", "Jogar contra um frequentador", "Não estou pronto"],
    'ro': ["Așază-te la tablă", "Joacă împotriva unui mușteriu", "Nu sunt pregătit"],
    'ru': ["Сесть за доску", "Сыграть с завсегдатаем", "Не готов"],
  };
  const keys = ['cards.kingsGambit.online.press.sit', 'cards.kingsGambit.online.press.regulars', 'cards.kingsGambit.online.press.unready'];
  for (const [lang, want] of Object.entries(WANT)) {
    const lines = readFileSync(new URL(`../../../locales/${lang}/Port_Strings.csv`, import.meta.url), 'utf8').split('\n');
    const got = keys.map((k) => lines.find((l) => l.startsWith(`${k},`)).slice(k.length + 1).trim().replace(/^"|"$/g, ''));
    assert.deepEqual(got, want, lang);
  }
});
