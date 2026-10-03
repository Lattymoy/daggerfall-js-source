// ARENA2 (2026-10-02, Mac: "All UI elements and text must be enhanced UI plus"): THE BOUT'S HUD (ui/arenaHud.js) - its
// pure model (the versus bar's two sides, my own row, the darling and the villain, the clock, the crowd's band, my
// stamina, the yield hint, the crowd's shout), its DOM (textContent only, written on change, hidden never removed, no
// colour inline, the touch size, reduced motion), its dress through the kit's roles and the Plus sheet; THE HERALD'S
// CHOICE (systems/arenaHerald.js - what he says, which choices stand and the sentence for one that does not); and THE
// WORDS (systems/arenaText.js): frozen, plain player English, no long dash, the house's " - " between clauses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arenaHudModel, drawArenaHud, destroyArenaHud, ARENA_HUD_CSS, ARENA_HUD_STYLE_ID, HUD_ROWS_MAX } from '../src/ui/arenaHud.js';
import { newBout, boutTick, boutAtMarks, callMs, COUNT_MS, boutHealth, BOUT_LIMIT_MS } from '../src/systems/arenaBout.js';
import { newCrowd } from '../src/systems/arenaCrowd.js';
import { heraldChoice, FIGHT_HEALTH_MIN } from '../src/systems/arenaHerald.js';
import { newArenaLadder, ladderAfter } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT, allArenaLines } from '../src/systems/arenaText.js';
import { FRAME_ROLES } from '../src/ui/enhancedFrame.js';
import { ONLINE_DRESS_CSS } from '../src/ui/enhancedPlusStyle.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const RING = { centre: [0, 0], radius: 14 };
function live(fighters) {
  const b = newBout({ id: 'x', fighters, ring: RING, now: 0 });
  boutTick(b, callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, callMs(b));
  boutTick(b, callMs(b) + COUNT_MS);
  return { b, t: callMs(b) + COUNT_MS };
}
const F2 = [{ id: 'you', name: 'Hero', side: 0, maxHealth: 100, ai: false }, { id: 'f0', name: 'Gorlak gro-Mazgul', side: 1, maxHealth: 80, home: 'Daggerfall' }];

test('ARENA2 HUD model: the versus bar - my side left, the rest right; the clock, the crowd, my stamina, the hint at the line', () => {
  const { b, t } = live(F2);
  const crowd = newCrowd({ fighters: b.fighters });
  const m = arenaHudModel(b, crowd, t + 61000, { you: 'you', stamina: 0.42 });
  assert.equal(m.phase, 'fight');
  assert.deepEqual(m.left.map((r) => [r.id, r.name, r.frac, r.you, r.banner]), [['you', 'Hero', 1, true, 'you']]);
  assert.deepEqual(m.right.map((r) => [r.id, r.frac, r.you, r.banner, r.tag]), [['f0', 1, false, 'them', 'Darling']], 'Daggerfall\'s own, the home crowd\'s darling');
  assert.equal(m.timer, ARENA_TEXT.hud.timeLeft(Math.ceil((BOUT_LIMIT_MS - 61000) / 1000)));
  assert.equal(m.timer, '1:59');
  assert.equal(m.stamina, 0.42);
  assert.equal(m.hint, '');
  assert.deepEqual(m.crowd, { frac: 0.5, band: 'murmur', word: 'Murmuring' });
  boutHealth(b, 'you', 15);
  assert.equal(arenaHudModel(b, crowd, t, { you: 'you' }).hint, ARENA_TEXT.hud.yieldHint, 'at the line: how to yield');
  assert.equal(arenaHudModel(b, crowd, t, { you: 'you' }).left[0].frac, 0.15);
  crowd.mood = 0.9;
  assert.deepEqual(arenaHudModel(b, crowd, t).crowd, { frac: 0.95, band: 'roar', word: 'Roaring' });
  // a watcher: no stamina, no hint, banners a and b
  const w = arenaHudModel(b, crowd, t);
  assert.equal(w.stamina, null);
  assert.equal(w.hint, '');
  assert.deepEqual([w.left[0].banner, w.right[0].banner], ['a', 'b']);
  assert.equal(arenaHudModel(b, crowd, t, { bark: 'Again!' }).bark, 'Again!');
  // my side is the left whatever the roster's order
  const r = live([F2[1], F2[0]]);
  const mr = arenaHudModel(r.b, newCrowd({ fighters: r.b.fighters }), r.t, { you: 'you' });
  assert.deepEqual([mr.left[0].id, mr.right[0].id], ['you', 'f0']);
  assert.equal(arenaHudModel(null, crowd, t), null);
  b.phase = 'done';
  assert.equal(arenaHudModel(b, crowd, t), null, 'a bout done shows nothing');
});

test('ARENA2 HUD model: a Grand Melee lists three a side at most; the out are named so', () => {
  const fighters = [{ id: 'you', name: 'Hero', side: 0, maxHealth: 100, ai: false }, ...[1, 2, 3, 4].map((i) => ({ id: `f${i}`, name: `F${i}`, side: i, maxHealth: 50 }))];
  const { b, t } = live(fighters);
  b.fighters[1].out = 'yield';
  b.fighters[2].out = 'ringout';
  const m = arenaHudModel(b, newCrowd({ fighters }), t, { you: 'you' });
  assert.equal(m.right.length, HUD_ROWS_MAX);
  assert.deepEqual(m.right.map((r) => r.out), ['Yielded', 'Out', '']);
});

// ── THE DOM ──────────────────────────────────────────────────────────────────────────────────────────────
function fakeDoc() {
  const doc = { writes: 0, built: 0 };
  const node = (tag) => {
    const style = new Proxy({}, { set(o, k, v) { doc.writes++; o[k] = v; return true; } });
    const n = { tag, className: '', id: '', children: [], style, dataset: {}, attrs: {}, parent: null, _text: '',
      get textContent() { return this._text; }, set textContent(v) { doc.writes++; this._text = String(v); },
      append(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } },
      setAttribute(k, v) { this.attrs[k] = v; }, remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); },
      classList: { _s: new Set(), toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      set innerHTML(v) { throw new Error('no markup is ever written'); },
    };
    return n;
  };
  doc.createElement = (t) => { doc.built++; return node(t); };
  doc.head = node('head'); doc.body = node('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls) => { if (n.className.split(' ').includes(cls)) return n; for (const c of n.children) { const f = find(c, cls); if (f) return f; } return null; };
const findAll = (n, cls, out = []) => { if (n.className.split(' ').includes(cls)) out.push(n); for (const c of n.children) findAll(c, cls, out); return out; };

test('ARENA2 HUD DOM: built once on the first bout, written on change only, textContent only, hidden never removed, no colour inline', () => {
  destroyArenaHud();
  const doc = fakeDoc();
  drawArenaHud(null, { doc });
  assert.equal(doc.built, 0, 'nothing built before a bout');
  const { b, t } = live(F2);
  const crowd = newCrowd({ fighters: b.fighters });
  const m = arenaHudModel(b, crowd, t, { you: 'you', stamina: 0.5, bark: 'Blood! Blood on the sand!' });
  drawArenaHud(m, { doc });
  assert.ok(doc.getElementById(ARENA_HUD_STYLE_ID), 'its own sheet, once');
  const root = find(doc.body, 'arena-hud');
  assert.ok(root);
  assert.equal(root.attrs['aria-hidden'], 'true');
  const names = findAll(root, 'arena-ftr-name').map((n) => n.textContent).filter(Boolean);
  assert.deepEqual(names, ['Hero', 'Gorlak gro-Mazgul']);
  assert.equal(find(root, 'arena-timer').textContent, '3:00');
  assert.equal(find(root, 'arena-crowd-word').textContent, 'Murmuring');
  assert.equal(find(root, 'arena-bark').textContent, 'Blood! Blood on the sand!');
  assert.equal(find(root, 'arena-stam').style.display, '');
  const built = doc.built, writes = doc.writes;
  drawArenaHud(m, { doc });
  assert.equal(doc.built, built, 'never rebuilt');
  assert.equal(doc.writes, writes, 'nothing written when nothing changed');
  // inline: widths and display only - never a colour
  const styles = [];
  const walk = (n) => { for (const [k, v] of Object.entries(n.style)) styles.push([k, v]); n.children.forEach(walk); };
  walk(root);
  assert.ok(styles.every(([k]) => k === 'width' || k === 'display'), JSON.stringify(styles.filter(([k]) => k !== 'width' && k !== 'display')));
  drawArenaHud(m, { doc, hidden: true });
  assert.equal(root.style.display, 'none', 'hidden with the HUD');
  assert.ok(find(doc.body, 'arena-hud'), 'never removed');
  drawArenaHud(m, { doc, touch: true });
  assert.ok(root.classList.contains('touch'));
  drawArenaHud(null, { doc });
  assert.equal(root.style.display, 'none');
  destroyArenaHud();
  assert.equal(find(doc.body, 'arena-hud'), null);
});

test('ARENA2 HUD sheet and dress: the pixel face, reduced motion, touch sizes, the phone; the kit\'s roles and the Plus sheet\'s fills', () => {
  assert.match(ARENA_HUD_CSS, /@font-face \{ font-family: 'Pixelify Five'/);
  assert.match(ARENA_HUD_CSS, /-webkit-font-smoothing: none/);
  assert.match(ARENA_HUD_CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.arena-fill \{ transition: none; \} \}/);
  assert.match(ARENA_HUD_CSS, /\.arena-hud\.touch \{ font-size: 15px; \}/);
  assert.match(ARENA_HUD_CSS, /@media \(max-width: 640px\)/);
  assert.match(ARENA_HUD_CSS, /pointer-events: none/, 'a readout takes no click');
  assert.match(ARENA_HUD_CSS, /var\(--hud-scale, 1\)/);
  assert.ok(FRAME_ROLES.panel.includes('body .arena-plate'));
  assert.ok(FRAME_ROLES.chip.includes('body .arena-timer') && FRAME_ROLES.chip.includes('body .arena-tag'));
  for (const sel of ['body .arena-hud', 'body .arena-track', 'body .arena-fill', 'body .arena-stam .arena-fill', 'body .arena-crowd .arena-fill', 'body .arena-tag[data-tag="villain"]', 'body .arena-crowd-word[data-band="roar"]']) {
    assert.ok(ONLINE_DRESS_CSS.includes(sel), `the Plus sheet dresses ${sel}`);
  }
  const hud = rd('src/ui/arenaHud.js');
  assert.ok(!/innerHTML/.test(hud), 'textContent only');
  assert.ok(!/style\.(color|background)/.test(hud), 'no colour written inline');
});

// ── THE HERALD ───────────────────────────────────────────────────────────────────────────────────────────
test('ARENA2 Herald: his choice - watch while a bout stands or the hour\'s is open, fight when fit, the hall, leave; each refusal said', () => {
  const day = 400 * 1440;
  const open = heraldChoice({ gameMinutes: day + 12 * 60 + 5, ladder: newArenaLadder() });
  // ARENA3 moved this pin: the Herald is the Arena window's first door (bible/11-Multiplayer/Arena.md 5 - "opened by the
  // Herald"), so his choice carries "A - The Arena window" between Fight and the hall
  assert.deepEqual(open.options.map((o) => o.act), ['watch', 'fight', 'window', 'hall', 'leave', 'leave']);
  assert.deepEqual(open.options.map((o) => o.code), ['KeyW', 'KeyF', 'KeyA', 'KeyH', 'KeyL', 'Escape']);
  assert.equal(open.options[5].label, null, 'Escape is a key alone');
  assert.ok(open.lines.includes(ARENA_TEXT.herald.ladderNext('The Pit', 'bout 1 of 3')));
  const shut = heraldChoice({ gameMinutes: day + 23 * 60, ladder: newArenaLadder() });
  assert.ok(!shut.options.some((o) => o.act === 'watch'));
  assert.ok(shut.lines.includes(ARENA_TEXT.herald.noWatch), 'the refusal is a sentence');
  assert.ok(shut.lines.includes(ARENA_TEXT.herald.nextAt('08:00')));
  const on = heraldChoice({ gameMinutes: day + 23 * 60, cityBout: { a: 'Aldo', b: 'Bran' }, ladder: null });
  assert.ok(on.options.some((o) => o.act === 'watch'), 'a bout standing can be watched whatever the hour');
  assert.ok(on.lines.includes('On the sand now: Aldo against Bran.'));
  const hurt = heraldChoice({ gameMinutes: day + 12 * 60, ladder: null, healthShare: FIGHT_HEALTH_MIN - 0.01 });
  assert.ok(!hurt.options.some((o) => o.act === 'fight'));
  assert.ok(hurt.lines.includes(ARENA_TEXT.herald.noFight));
  let L = newArenaLadder();
  for (let i = 0; i < 4; i++) L = ladderAfter(L, { won: true }).ladder;
  assert.ok(heraldChoice({ gameMinutes: day, ladder: L }).lines.includes(ARENA_TEXT.herald.title('Pit Fighter')), 'the title the arena calls you by');
  const done = { ...L, grand: true };
  const g = heraldChoice({ gameMinutes: day + 12 * 60, ladder: done });
  assert.ok(g.lines.includes(ARENA_TEXT.herald.ladderDone));
  assert.ok(!g.options.some((o) => o.act === 'fight'));
  for (const o of open.options.filter((x) => x.label)) assert.match(o.label, /^[A-Z] - [A-Z]/, 'ChoiceWindow\'s "K - Label"');
});

// ── THE WORDS ────────────────────────────────────────────────────────────────────────────────────────────
test('ARENA2 words: one frozen table, every line plain - no long dash, no engine word, short; the house\'s separator', () => {
  const deepFrozen = (o) => Object.isFrozen(o) && Object.values(o).every((v) => typeof v !== 'object' || v === null || deepFrozen(v));
  assert.ok(deepFrozen(ARENA_TEXT));
  const lines = allArenaLines();
  assert.ok(lines.length > 150, `${lines.length} lines`);
  for (const l of lines) {
    assert.ok(!/[—–]/.test(l), `no long dash: ${l}`);
    assert.ok(!/\b(NPC|spawn|entity|undefined|null|HUD|mob|aggro|DPS)\b/i.test(l), `no engine word: ${l}`);
    assert.ok(l.length <= 90, `short: ${l}`);
    assert.ok(!/ {2}/.test(l.replace(/^ +/, '')), `one space between words: "${l}"`);
  }
  assert.ok(ARENA_TEXT.barks.crit.includes('Blood! Blood on the sand!'), 'the design\'s own bark');
  assert.ok(ARENA_TEXT.barks.knockdown.includes('Get up, you dog!'));
  assert.ok(ARENA_TEXT.barks.stall.includes('Is that a sword or a spoon?'));
  assert.equal(ARENA_TEXT.chant('Wayrest'), 'Wayrest! Wayrest!');
  assert.deepEqual(ARENA_TEXT.count, ['3', '2', '1', 'Fight!']);
  assert.equal(ARENA_TEXT.verdict.yield('Aldo', 'Bran'), 'Bran yields! The bout goes to Aldo.');
  assert.equal(ARENA_TEXT.verdict.judges('Aldo'), 'Time! The judges give it to Aldo.');
  assert.equal(ARENA_TEXT.purse.won(50), 'The purse - 50 gold.');
  assert.equal(ARENA_TEXT.hud.timeLeft(65), '1:05');
  assert.equal(ARENA_TEXT.titles.length, 10);
  assert.equal(ARENA_TEXT.titles[9], 'Grand Champion');
  assert.ok(ARENA_TEXT.epithets.length >= 20);
  assert.match(ARENA_TEXT.deedMoved.join(' '), /furnishings/, 'the bank\'s letter says where the furniture went');
  assert.match(ARENA_TEXT.deedMoved.join(' '), /chest in the new house/);
});

test('ARENA2 sheet: the character sheet carries the arena\'s title and record - and nothing for one who never fought', async () => {
  const { sheetModel } = await import('../src/ui/enhancedCharSheet.js');
  const hero = { name: 'A', race: 'Breton', level: 2, career: { name: 'Knight', primarySkills: [], majorSkills: [], minorSkills: [] },
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    activeEffects: [], skills: {}, health: 10, maxHealth: 10, magicka: 0, maxMagicka: 0, fatigue: 100, goldPieces: 0, items: [] };
  assert.equal(sheetModel(hero).arena, null, 'no ladder, no line');
  assert.equal(sheetModel({ ...hero, arenaLadder: newArenaLadder() }).arena, null, 'a ladder never fought, no line');
  let L = newArenaLadder();
  L = ladderAfter(L, { won: true }).ladder;
  L = ladderAfter(L, { won: false, how: 'fall' }).ladder;
  const line = sheetModel({ ...hero, arenaLadder: L }).arena;
  assert.equal(line.record, '1 won, 1 lost');
  assert.equal(typeof line.title === 'string' || line.title === null, true);
});
