// GATE-UX (2026-10-01, Mac: "1. In the oblivion boss gate, move the modifer panel that shows away from center of the
// screen, it's obstructive 2. Remove the text below each boss health bar that shows phase details 3. Loot at the end can
// still be walked over and picked up 4. Develop a detailed damage chart after the boss kill, showing and ranking
// everyone's damage"): THE COURT, LESS IN THE WAY AND MORE TO READ. The marks' card to the side (ui/gate/gateMarksView.js);
// the bar's foot without its phase line (ui/gate/gateBossBar.js); the spoils taken by the press alone (scenes/spoilsPool.js -
// the walk-over's own pins moved with it: wb5, wb9f, wbx); and THE DAMAGE CHART - counted by the relay's brain
// (net/gate/gateBrain.js damageChart), carried with the kill (net/wire.js `dm`, relay world136), folded (net/gate/gateLink.js) and
// drawn to the side once he has fallen (ui/gate/gateDamageChart.js, scenes/gate/gateCourt.js). Design:
// bible/11-Multiplayer/World-Bosses.md section 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MARKS_CARD_CSS } from '../../../src/ui/gate/gateMarksView.js';
import { BOSS_BAR_CSS, BOSS_BAR_TOP, bossBarModel, drawGateBossBar, destroyGateBossBar, BOSS_BAR_TEXT } from '../../../src/ui/gate/gateBossBar.js';
import { PHASE_NAMES, newFight, joinFight, applyHit, applyCrystalHit, stepBrain, stateOf, damageChart, topDealers, DAMAGE_CHART_MAX, HIT_KINDS, COURTS, GATE_FIGHTERS_MAX, ATTACKS } from '../../../src/net/gate/gateBrain.js';
import { validGateOut, GATE_CHART_MAX, GATE_TOP_MAX, RELAY_VERSION } from '../../../src/net/wire.js';
import { foldGate, createGateLink, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import {
  damageChartModel, drawGateDamageChart, destroyGateDamageChart, chartNumber, chartShare,
  DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_MS, DAMAGE_CHART_FADE_MS, DAMAGE_CHART_ROWS, DAMAGE_CHART_TEXT, DAMAGE_CHART_CSS,
} from '../../../src/ui/gate/gateDamageChart.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const BOSS = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };

/** A document of plain objects: nodes that remember what was written to them (test/net/gate/wb9a_gate_marks_seen.test.js's). */
function fakeDoc() {
  const made = [];
  const node = (tag) => {
    const n = { tag, style: {}, className: '', textContent: '', children: [], attrs: {}, append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute(k, v) { this.attrs[k] = v; } };
    made.push(n);
    return n;
  };
  const styles = [];
  return { made, styles, doc: { createElement: node, body: node('body'), head: { append: (s) => styles.push(s) }, getElementById: (id) => styles.find((s) => s.id === id) ?? null } };
}
/** A fight of `n` challengers at level 10, its first court, the opening over and every purse deep. */
function fightOf(n = 3) {
  const f = newFight(9, T0, T0 + 3_600_000, 'ruhn');
  for (let i = 0; i < n; i++) assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, 10, T0, true));
  f.shieldUntil = 0;
  for (const p of Object.values(f.players)) { p.bucket = 1e9; p.rate = 4; }
  return f;
}
const C1 = COURTS[0];
const near = { x: C1[0] + 2, z: C1[1] + 2 };
/** A blow landed whole: the purse and the rate refilled first, so the caps never decide it here. */
function blow(f, sub, d, t) { const p = f.players[sub]; p.bucket = 1e9; p.rate = 4; return applyHit(f, sub, d, HIT_KINDS.Spell, near, t); }

// ═══ 1. THE MARKS' CARD, TO THE SIDE ═══════════════════════════════════════════════════════════════════════════════

test('GATE-UX 1 the marks\' card as a fighter steps in stands low on the right, never over the middle of the screen; by the gate it keeps its own side place (mutants: the card centred again; the gate\'s place moved)', () => {
  const arrive = /\.wb-marks-card\.wb-marks-arrive \{([^}]*)\}/.exec(MARKS_CARD_CSS)?.[1];
  assert.ok(arrive, 'the arrive mode has its own place');
  assert.match(arrive, /right: 18px;/);
  assert.match(arrive, /bottom: max\(96px, 14vh\);/);
  assert.doesNotMatch(arrive, /left: 50%|translateX\(-50%\)|top:/, 'not centred, not hung from the top');
  assert.match(MARKS_CARD_CSS, /\.wb-marks-card\.wb-marks-gate \{ right: 18px; top: 104px; width: 340px; \}/, 'by the gate: as it was');
  assert.match(read('src/ui/enhanced/enhancedPlusStyle.js'), /body \.wb-marks-card \{/, 'Plus dresses it, and places it nowhere else');
  assert.doesNotMatch(/body \.wb-marks-card \{[^}]*\}/.exec(read('src/ui/enhanced/enhancedPlusStyle.js'))[0], /left:|top:|transform:/);
});

// ═══ 2. THE BAR'S FOOT WITHOUT ITS PHASE LINE ══════════════════════════════════════════════════════════════════════

test('GATE-UX 2 under his health no phase is said - the foot says the court\'s fighters, the next Reckoning and the Wrath as before; a turn is still said over the screen as it comes (mutants: the phase line back in the foot; the fighters lost with it)', () => {
  const s = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', phase: 2, hp: 500, max: 1000, fighters: 3, wrathAt: T0 + 3_600_000 };
  const m = bossBarModel(s, T0, BOSS);
  assert.equal('phaseName' in m, false);
  assert.equal(BOSS_BAR_TEXT.phase, undefined);
  const { doc } = fakeDoc();
  destroyGateBossBar();
  drawGateBossBar(m, { doc });
  const root = doc.body.children[0];
  const foot = root.children.find((c) => c.className === 'wb-boss-foot');
  const said = () => foot.children.filter((c) => c.style.display !== 'none').map((c) => c.textContent);   // WB13c: a chip each
  assert.deepEqual(said(), [BOSS_BAR_TEXT.fighters(3)], 'the fighters alone');
  for (const n of PHASE_NAMES) assert.equal(foot.children.some((c) => c.textContent.includes(n)), false, `"${n}" not said under his health`);
  const late = bossBarModel({ ...s, phase: 3, rk: T0 + 42_000, wrathAt: T0 + 61_000 }, T0, BOSS);
  drawGateBossBar(late, { doc });
  assert.deepEqual(said(), [BOSS_BAR_TEXT.fighters(3), BOSS_BAR_TEXT.reckonIn('0:42'), BOSS_BAR_TEXT.wrathIn('1:01')], 'the countdowns kept');
  destroyGateBossBar();
  assert.match(read('src/scenes/gate/gateCourt.js'), /const c = courtPhaseCard\(s\.phase, s\.pt\); if \(c && !\(s\.phase === 3 && rjCarded\)\) beat = \{ kind: 'phase', at: t, until: t \+ TITLE_HOLD_MS, \.\.\.c \};/, 'the turn shown as it comes (WB13e: its card)');   // PIN MOVED (WB14d): a Sundering night's own cards, the last one shown at the Rejoining's start
  assert.equal(BOSS_BAR_TOP, '58px');
  assert.match(BOSS_BAR_CSS, /\.wb-boss-foot \{/);
});

// ═══ 3. THE SPOILS BY THE PRESS ALONE (the walk-over's pins: wb5, wb9f, wbx) ═══════════════════════════════════════

test('GATE-UX 3 the pool asks for no feet and takes nothing underfoot; the host hands it none; the press is its one hand (mutants: the walk-over back; the host still wiring feet)', () => {
  const pool = read('src/scenes/spoilsPool.js');
  assert.doesNotMatch(pool, /export const SPOILS_TAKE_|const f0 = feet\(\)|feet = \(\) => null|takeOne\(f\);\n\s*\}\);\n\s*\},/);
  assert.match(pool, /pick\(key\) \{ const f = pieceAt\(key\); if \(!f\) return false; takeOne\(f\); return true; \}/);
  const w = read('src/scenes/world.js');
  const made = /const spoilsPool = createSpoilsPool\(\{[\s\S]*?\n {2}\}\);/.exec(w)?.[0];
  assert.ok(made);
  assert.doesNotMatch(made, /feet:/, 'the host hands the pool no feet');
  assert.match(w, /takeSpoil: \(key\) => !!floorPool\(\)\?\.pick\(key\),/, 'the press reaches it');   // SD9e: the floor of the place I stand in (PIN MOVED)
});

// ═══ 4. THE DAMAGE CHART ═══════════════════════════════════════════════════════════════════════════════════════════

test('GATE-UX 4 the brain counts each fighter\'s part: the blows that landed on him and the heaviest, what went into the crystals apart, and each fall once - a fall again only after standing up alive (mutants: a refused blow counted; a fall every beat it lies; the crystals not split out)', () => {
  const f = fightOf(2);
  assert.deepEqual(['cxd', 'hits', 'best', 'falls', 'down'].map((k) => f.players.s1[k]), [0, 0, 0, 0, false], 'a newcomer starts at nothing');
  assert.equal(blow(f, 's1', 30, T0 + 1000), 30);
  assert.equal(blow(f, 's1', 80, T0 + 2000), 80);
  assert.equal(blow(f, 's1', 12, T0 + 3000), 12);
  assert.equal(applyHit(f, 's1', 50, HIT_KINDS.Spell, null, T0 + 4000), 0, 'a blow with no pose is refused');
  assert.deepEqual([f.players.s1.hits, f.players.s1.best, f.players.s1.dealt], [3, 80, 122], 'three landed, the heaviest 80');
  // the crystals: counted as dealt, and apart
  const g = fightOf(1);
  g.atk = { i: 5, a: ATTACKS.reckon.id, at: T0 + 30_000, x: C1[0], z: C1[1], yw: 0, tg: [] };   // a Reckoning winding up
  g.cx = { i: 5, m: 1000, c: [{ x: near.x, z: near.z, h: 1000 }] };
  applyCrystalHit(g, 's1', 0, 40, HIT_KINDS.Spell, near, T0 + 1000);
  assert.deepEqual([g.players.s1.cxd, g.players.s1.dealt, g.players.s1.hits], [40, 40, 0], 'a crystal is dealt, not a blow on him');
  // the falls: once a fall, however many beats it lies; again after standing up
  const h = fightOf(1);
  const at = (dead) => [{ sub: 's1', x: near.x, z: near.z, dead }];
  let t = T0;
  for (const dead of [false, true, true, true, false, false, true, true]) stepBrain(h, (t += 250), at(dead), () => 0.5);
  assert.equal(h.players.s1.falls, 2);
  // a fight checkpointed before the chart reads its missing counts as none
  const old = fightOf(1);
  for (const k of ['cxd', 'hits', 'best', 'falls', 'down']) delete old.players.s1[k];
  assert.equal(blow(old, 's1', 7, T0 + 1000), 7);
  assert.deepEqual([old.players.s1.hits, old.players.s1.best], [1, 7]);
  stepBrain(old, T0 + 2000, at(true), () => 0.5);
  assert.equal(old.players.s1.falls, 1);
});

test('GATE-UX 4 the chart at the kill: every fighter with a part, most dealt first (ties by the earlier to join - topDealers\' own order), whole numbers, at most DAMAGE_CHART_MAX rows; on the fall, the court\'s word and the state (mutants: unranked; a fighter with no part listed; the chart missing from the state)', () => {
  const f = fightOf(4);
  joinFight(f, 'idle', 'Idle', 10, T0, true);   // joined and did nothing - no part, no row
  f.players.s2.stoodMs = 5000;   // stood and dealt nothing: a part
  blow(f, 's3', 20.4, T0 + 1000);
  blow(f, 's1', 60, T0 + 1500);
  blow(f, 's4', 60, T0 + 2000);   // ties s1 - s1 joined first
  f.players.s4.falls = 2;
  f.hp = 15;
  assert.equal(blow(f, 's3', 40, T0 + 3000), 15, 'the last blow takes what is left');
  assert.ok(f.fell, 'he has fallen');
  const dm = f.fell.dm;
  assert.deepEqual(dm.map((r) => r.n), ['P1', 'P4', 'P3', 'P2'], 'ranked, the idle left out');
  assert.deepEqual(dm[0], { n: 'P1', l: 10, d: 60, x: 0, h: 1, b: 60, f: 0 });
  assert.deepEqual(dm[2], { n: 'P3', l: 10, d: 35, x: 0, h: 2, b: 20, f: 0 }, 'whole numbers - 20.4 + 15 says 35, its best 20');
  assert.equal(dm[1].f, 2);
  assert.deepEqual(dm[3], { n: 'P2', l: 10, d: 0, x: 0, h: 0, b: 0, f: 0 });
  assert.deepEqual(f.fell.top, topDealers(f, 3));
  assert.deepEqual(stateOf(f).fell, { at: f.fell.at, top: f.fell.top, n: f.fell.n, dm }, 'a late door and a reconnect are told it');
  assert.deepEqual(damageChart(f), dm, 'one law');
  // the cap
  const big = newFight(9, T0, T0 + 3_600_000, 'ruhn');
  for (let i = 0; i < DAMAGE_CHART_MAX + 8; i++) { joinFight(big, `b${i}`, `B${i}`, 10, T0, true); big.players[`b${i}`].dealt = 1000 - i; }
  const rows = damageChart(big);
  assert.equal(rows.length, DAMAGE_CHART_MAX);
  assert.equal(rows[0].n, 'B0'); assert.equal(rows.at(-1).n, `B${DAMAGE_CHART_MAX - 1}`);
  assert.equal(DAMAGE_CHART_MAX, GATE_CHART_MAX, 'the wire\'s bound is the brain\'s');
  assert.ok(GATE_CHART_MAX <= GATE_FIGHTERS_MAX && GATE_CHART_MAX > GATE_TOP_MAX);
  // the relay fans it with the kill, and tells the hub the names alone
  const relay = read('server/src/index.js');
  assert.match(relay, /this\._gateFan\(\[\{ k: 'fell', at: f\.fell\.at, top: f\.fell\.top, n: f\.fell\.n, \.\.\.\(f\.fell\.dm \? \{ dm: f\.fell\.dm \} : \{\}\) \}\]\);/);
  assert.match(relay, /_gateTellHub\(\{ d: f\.day, at: f\.fell\.at, top: f\.fell\.top, n: f\.fell\.n, rc:/, 'the hub\'s word carries no chart');
  assert.equal(RELAY_VERSION, 'world246');   // PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); CHAP4c moved it on last (world183: the chapters' seats' titles - five ids and their claim on the token; NOT YET DEPLOYED - world177, world178, world179, world180, world181 then world182 on its branch, renumbered past THE WROTHGARIAN ZONE's, TAVERN CARDS', HOURS-FIRST's, TAVERN-TABLES', TV-BEYOND's and CARDS10's at the merges of main); CARDS10 moved it on (world182: Iliac Hand's season board, its champion's title in the token's vocabulary); TV-BEYOND moved it on (world181: the world's pixels on the wire Tamriel's, not the Bay's); TAVERN-TABLES moved it on (world180: the gold table an index - two card tables a tavern); HOURS-FIRST moved it on (world179: Hour's First and The First Hour in the token's vocabulary); TAVERN CARDS moved it on (world178: the card tables); THE WROTHGARIAN ZONE moved it on (world177: the open zone, its halls and its giants); SUPER-DUNGEONS moved it on (world176: the Super Dungeons arc, one version - SD-ONLINE first: a dungeon re-laid at the size the world gives it, small or medium, stands in a room of its own, so a page that lays it whole shares no stream and no memory with it; world171 on its branch, renumbered past CRYSTAL-FIST's world171 at one merge and past WATCH-FIX's world172, SERPENT3's world173 and LEGACY7's world174 at the next, and past TEXT-F1's world175 at the one after; TEXT-F1 moved it on (world175: the words a player types starred in sanitizeChat and wordsLine, a custom class the filter catches dropped from a look); LEGACY7 moved it on (world174: the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's world172 and SERPENT3's world173 at the merge); SERPENT3 moved it on (world173: the sea serpent brain swims every leg it shows - no leap - a slept fight taken up where it was and a blow judged where it struck; its law version 2; world171 on its branch, renumbered past CRYSTAL-FIST's world171 and WATCH-FIX's world172 at the merges); WATCH-FIX moved it on (world172: the foe record names the living-world resident a watchman stands for, `lr`); CRYSTAL-FIST moved it on (world171: the Crystal Fist's title and glyph and the Crystal Resonance's aura join the token's vocabulary - a relay before it refuses Flylighter's token; world170 on its branch, renumbered past FEUD's world170 at the merge); FEUD moved it on (world170: the foe record's wind-ups, staggers and blow classes and a revenant's adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main's world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token's aura vocabulary - a relay before it refuses SirMcMobdon's token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub's party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub's live events gain the sun baby's word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch's title and glyph and the Golden Radiance's aura join the token's vocabulary - a relay before it refuses GA00250's token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion's title and glyph and the Oblivion Ward's aura join the token's vocabulary - a relay before it refuses Sureme's token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room), SEAT1c (world145) and SEAT1b (world144) before it - the Seats arc's, past main's; ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the Legion-Lord's host, and the chart row's `a`; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`); GATE-UX's chart rides from world136
});

test('GATE-UX 4 the chart on the wire: each row a name and its whole numbers, most dealt first, at most GATE_CHART_MAX; names cleaned; anything malformed is no chart - and never costs the kill its word (mutants: a junk chart taken; the fall dropped with a bad chart)', () => {
  const row = (n, d, o = {}) => ({ n, l: 10, d, x: 0, h: 3, b: Math.min(d, 9), f: 0, ...o });
  const dm = [row('Ann', 300, { x: 40 }), row('Bran', 120), row('Cy', 0, { h: 0, b: 0, f: 2 })];
  const fell = validGateOut({ k: 'fell', at: T0, top: ['Ann', 'Bran'], n: 3, dm });
  assert.deepEqual(fell, { k: 'fell', at: T0, top: ['Ann', 'Bran'], n: 3, dm });
  assert.deepEqual(validGateOut({ k: 'fell', at: T0, top: [], n: 1 }), { k: 'fell', at: T0, top: [], n: 1 }, 'no chart: the fall as it always was');
  assert.equal(validGateOut({ k: 'fell', at: T0, top: [], n: 3, dm: [row('A\u0007nn', 5)] }).dm[0].n, 'Ann', 'a name cleaned as every name is');
  for (const [why, bad] of [
    ['unranked', [row('A', 10), row('B', 20)]],
    ['too many', Array.from({ length: GATE_CHART_MAX + 1 }, (_, i) => row(`N${i}`, 1000 - i))],
    ['a fraction', [row('A', 10.5)]],
    ['the crystals past the whole', [row('A', 10, { x: 11 })]],
    ['a best past the whole', [row('A', 10, { b: 11 })]],
    ['no name', [{ ...row('A', 10), n: 5 }]],
    ['a level of nothing', [row('A', 10, { l: 0 })]],
    ['a negative fall', [row('A', 10, { f: -1 })]],
    ['not a list', { 0: row('A', 10) }],
  ]) {
    const out = validGateOut({ k: 'fell', at: T0, top: ['A'], n: 2, dm: bad });
    assert.ok(out, `${why}: the fall kept`);
    assert.equal('dm' in out, false, `${why}: no chart`);
  }
  assert.equal(validGateOut({ k: 'fell', at: T0, top: [], n: 2, dm: [] }).dm.length, 0, 'an empty chart is a chart of no one');
  // the state's fall carries it too
  const st = { k: 'st', d: 9, b: 'ruhn', ph: 3, h: 0, m: 1000, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: T0 + 3_600_000, n: 3, fell: { at: T0, top: ['Ann'], n: 3, dm }, wrath: null };
  assert.deepEqual(validGateOut(st).fell, { at: T0, top: ['Ann'], n: 3, dm });
});

test('GATE-UX 4 the fold keeps the chart with the fall - and takes it from the court\'s word when the hub\'s chartless echo came first; another day\'s word is not this fight\'s (mutants: the chart dropped in the fold; the echo\'s nothing kept over the court\'s chart)', () => {
  const dm = [{ n: 'Ann', l: 10, d: 300, x: 0, h: 3, b: 120, f: 0 }];
  const s = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', hp: 10, max: 1000 };
  const a = foldGate(s, { k: 'fell', at: T0, top: ['Ann'], n: 1, dm }, T0, () => [0, 0]);
  assert.deepEqual(a.fell, { at: T0, top: ['Ann'], n: 1, dm });
  const echo = foldGate(s, { k: 'fell', d: 9, at: T0, top: ['Ann'], n: 1 }, T0, () => [0, 0]);
  assert.equal(echo.fell.dm, undefined);
  const after = foldGate(echo, { k: 'fell', at: T0, top: ['Ann'], n: 1, dm }, T0 + 5, () => [0, 0]);
  assert.deepEqual(after.fell.dm, dm, 'the court\'s chart, after the hub\'s word');
  assert.equal(foldGate(a, { k: 'fell', d: 9, at: T0, top: ['Ann'], n: 1 }, T0 + 9, () => [0, 0]).fell.dm, dm, 'an echo never takes it away');
  assert.equal(foldGate(s, { k: 'fell', d: 8, at: T0, top: [], n: 1, dm }, T0, () => [0, 0]).fell, null, 'another day\'s kill');
  const link = createGateLink({ now: () => T0 });
  link.word({ k: 'st', d: 9, b: 'ruhn', ph: 3, h: 0, m: 1000, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: T0 + 3_600_000, n: 1, fell: { at: T0, top: ['Ann'], n: 1, dm }, wrath: null, md: null, ct: 0, xa: [], cx: null, su: 0, rk: 0 });
  assert.deepEqual(link.state().fell.dm, dm, 'a whole state brings it');
});

const DM = (n, o = {}) => Array.from({ length: n }, (_, i) => ({ n: `P${i + 1}`, l: 10 + i, d: (n - i) * 1000, x: i === 0 ? 400 : 0, h: 20 - i, b: 900 - i, f: i % 3, ...o }));

test('GATE-UX 4 the chart\'s clock: from DAMAGE_CHART_DELAY_MS after the fall was seen, DAMAGE_CHART_MS long, in over a quarter second and out over its last DAMAGE_CHART_FADE_MS; none without a chart (mutants: over the fall itself; for ever; no fade)', () => {
  const fell = { at: 0, top: [], n: 3, dm: DM(3) };
  assert.equal(damageChartModel(null, { since: 0, now: 5000 }), null);
  assert.equal(damageChartModel({ ...fell, dm: [] }, { since: 0, now: 5000 }), null, 'a chart of no one shows nothing');
  assert.equal(damageChartModel({ at: 0, top: ['A'], n: 1 }, { since: 0, now: 5000 }), null, 'an older relay\'s fall: nothing');
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS - 1 }), null, 'his fall first');
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + 125 }).alpha, 0.5);
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + 10_000 }).alpha, 1);
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS - DAMAGE_CHART_FADE_MS / 2 }).alpha, 0.5);
  assert.equal(damageChartModel(fell, { since: 1000, now: 1000 + DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS }), null, 'gone');
  assert.ok(DAMAGE_CHART_MS >= 30_000, 'long enough to read the court\'s every row');
});

test('GATE-UX 4 the chart\'s rows: ranked as the relay ranked them, each bar against the most dealt, each share of the whole, the numbers grouped; my row marked in words; under the first DAMAGE_CHART_ROWS my own at my rank, and the rest counted (mutants: the bar against the whole; my row lost past the tenth; the count off by mine)', () => {
  const base = { since: 0, now: DAMAGE_CHART_DELAY_MS + 5000 };
  const three = damageChartModel({ at: 0, top: [], n: 3, dm: DM(3) }, { ...base, boss: BOSS.name, me: 'p2' });
  assert.equal(three.title, DAMAGE_CHART_TEXT.title);
  assert.equal(three.sub, `${BOSS.name} has fallen - 3 challengers`);
  assert.deepEqual(three.rows.map((r) => [r.rank, r.name, r.damage, r.frac, r.share]), [[1, 'P1', '3,000', 1, '50%'], [2, 'P2', '2,000', 2 / 3, '33%'], [3, 'P3', '1,000', 1 / 3, '17%']]);
  assert.deepEqual([three.rows[0].level, three.rows[0].crystals, three.rows[0].blows, three.rows[0].best, three.rows[2].falls], ['Lv 10', '400', '20', '900', '2']);
  assert.deepEqual(three.rows.map((r) => r.mine), [false, true, false], 'mine by my name, any case');
  assert.equal(three.mine, null); assert.equal(three.more, '');
  assert.deepEqual(three.head, ['#', 'Challenger', 'Damage', 'Share', 'Blows', 'Best', 'Crystals', 'Falls']);
  // a big court: my row under the first ten at my rank; the rest counted
  const big = damageChartModel({ at: 0, top: [], n: 40, dm: DM(GATE_CHART_MAX) }, { ...base, me: 'P17' });
  assert.equal(big.rows.length, DAMAGE_CHART_ROWS);
  assert.deepEqual([big.mine.rank, big.mine.name, big.mine.mine], [17, 'P17', true]);
  assert.equal(big.more, DAMAGE_CHART_TEXT.more(40 - DAMAGE_CHART_ROWS - 1));
  const notMe = damageChartModel({ at: 0, top: [], n: 12, dm: DM(12) }, { ...base, me: 'Nobody' });
  assert.equal(notMe.mine, null); assert.equal(notMe.more, DAMAGE_CHART_TEXT.more(2));
  assert.equal(damageChartModel({ at: 0, top: [], n: 1, dm: DM(1) }, base).sub, 'The Warden has fallen - 1 challenger');
  // the words of a number
  assert.deepEqual([0, 7, 999, 1000, 1234567, -3, NaN, 12.6].map(chartNumber), ['0', '7', '999', '1,000', '1,234,567', '0', '0', '13']);
  assert.deepEqual([chartShare(1, 3), chartShare(1, 400), chartShare(0, 10), chartShare(5, 0), chartShare(10, 10)], ['33%', '<1%', '0%', '0%', '100%']);
  // a chart of nothing dealt: every bar empty, no division by nothing
  const none = damageChartModel({ at: 0, top: [], n: 2, dm: DM(2, { d: 0, x: 0, b: 0 }) }, base);
  assert.deepEqual(none.rows.map((r) => [r.frac, r.share]), [[0, '0%'], [0, '0%']]);
});

test('GATE-UX 4 the chart\'s node: made once, its rows written when the chart changes (never a frame), my row ringed and said, hidden with the HUD; to the side, never the middle; its sheet once and dressed under Plus (mutants: rebuilt; centred; a class undressed)', () => {
  const { made, styles, doc } = fakeDoc();
  destroyGateDamageChart();
  drawGateDamageChart(null, { doc });
  assert.equal(made.length, 1, 'nothing made for nothing');
  const m = damageChartModel({ at: 0, top: [], n: 14, dm: DM(14) }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 3000, boss: BOSS.name, me: 'P12' });
  drawGateDamageChart(m, { doc });
  const count = made.length;
  const root = doc.body.children[0];
  assert.equal(root.className, 'wb-dmg-chart');
  assert.equal(root.attrs['aria-hidden'], 'true');
  const [title, sub, head, ...rest] = root.children;
  assert.equal(title.textContent, 'Damage Dealt');
  assert.equal(sub.textContent, `${BOSS.name} has fallen - 14 challengers`);
  assert.deepEqual(head.children.map((c) => c.textContent), [...DAMAGE_CHART_TEXT.head, '', ''], 'WB11c: and the host\'s cell, empty (and hidden) outside a Legion-Lord\'s court; GATE-HEAL: and the healed\'s, in a court nobody healed in');
  const rows = rest.slice(0, DAMAGE_CHART_ROWS), [gap, mine, more] = rest.slice(DAMAGE_CHART_ROWS);
  const cells = (r) => r.children.map((c, i) => (i === 1 ? c.children[0].children.map((x) => x.textContent).join('|') : c.textContent));
  assert.deepEqual(cells(rows[0]), ['1', 'P1|Lv 10|', '14,000', '13%', '20', '900', '400', '0', '', '']);
  assert.equal(rows[0].children[1].children[1].children[0].style.width, '100.0%', 'the most dealt fills its bar');
  assert.equal(rows[1].children[1].children[1].children[0].style.width, `${((13 / 14) * 100).toFixed(1)}%`);
  assert.equal(gap.style.display, '');
  assert.deepEqual(cells(mine), ['12', 'P12|Lv 21|(you)', '3,000', '3%', '9', '889', '0', '2', '', '']);
  assert.equal(mine.className, 'wb-dmg-row wb-dmg-mine');
  assert.equal(more.textContent, DAMAGE_CHART_TEXT.more(14 - DAMAGE_CHART_ROWS - 1));
  const before = rows.map((r) => r.children[2].textContent);
  rows[0].children[2].textContent = 'scribbled';
  drawGateDamageChart({ ...m, alpha: 0.4 }, { doc });
  assert.equal(made.length, count, 'updated, not rebuilt');
  assert.equal(rows[0].children[2].textContent, 'scribbled', 'the same chart is not written again');
  assert.equal(root.style.opacity, '0.4');
  // a short chart hides the rows it has no one for, and the gap and the count
  const short = damageChartModel({ at: 0, top: [], n: 2, dm: DM(2) }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 3000, me: 'P1' });
  drawGateDamageChart(short, { doc });
  assert.deepEqual(rows.map((r) => r.style.display), ['', '', ...Array(DAMAGE_CHART_ROWS - 2).fill('none')]);
  assert.equal(rows[0].className, 'wb-dmg-row wb-dmg-mine');
  assert.deepEqual([gap.style.display, mine.style.display, more.style.display], ['none', 'none', 'none']);
  void before;
  drawGateDamageChart(short, { doc, hidden: true });
  assert.equal(root.style.display, 'none');
  drawGateDamageChart(short, { doc });
  assert.equal(root.style.display, '');
  assert.equal(styles.filter((s) => s.textContent === DAMAGE_CHART_CSS).length, 1, 'the sheet, once');
  destroyGateDamageChart();
  assert.equal(root.gone, true);
  // the place: to the side, the marks' card's own
  const box = /\.wb-dmg-chart \{([^}]*)\}/.exec(DAMAGE_CHART_CSS)[1];
  assert.match(box, /right: 18px; bottom: max\(96px, 14vh\);/);
  assert.match(box, /pointer-events: none;/, 'a readout: no click');
  assert.doesNotMatch(box, /left: 50%|translateX/);
  const plus = read('src/ui/enhanced/enhancedPlusStyle.js');
  for (const c of ['wb-dmg-chart', 'wb-dmg-title', 'wb-dmg-sub', 'wb-dmg-head', 'wb-dmg-name', 'wb-dmg-lv', 'wb-dmg-you', 'wb-dmg-num', 'wb-dmg-track', 'wb-dmg-fill', 'wb-dmg-mine', 'wb-dmg-more']) {
    assert.match(DAMAGE_CHART_CSS, new RegExp(`\\.${c} \\{`), c);
    assert.match(plus, new RegExp(`body \\.${c}\\b`), `${c} is dressed under Plus`);
  }
});

test('GATE-UX 4 the seams: the court draws the chart once he has fallen - from when this screen saw it, with my name, hidden with the HUD and under the step\'s fire - and puts it away as I leave; the host hands it my name on the relay and hides it with a held frame (mutants: the chart never drawn; drawn over the veil; left up after the court)', () => {
  const c = read('src/scenes/gate/gateCourt.js');
  assert.match(c, /if \(s\.fell && chartAt === null\) chartAt = t;\n\s*drawGateDamageChart\(chartAt !== null \? damageChartModel\(s\.fell, \{ boss: bossOf\(s\)\.name, me: me\(\), since: chartAt, now: t \}\) : null, \{ hidden: hudHidden\(\) \|\| veiled\(\) \}\);/);
  assert.match(c, /marksSaid = false; fedHeard = null; marksAt = null; chartAt = null;/, 'a new fight (or none) forgets it');
  assert.match(c, /drawGateMarksCard\(null\);   \/\/ WB9a\n\s*drawGateDamageChart\(null\);/, 'gone as I leave');
  const w = read('src/scenes/world.js');
  assert.match(w, /me: \(\) => online\?\.name \?\? null,/);
  assert.match(w, /drawGateMarksCard\(null\); drawGateDamageChart\(null\); drawGateGround\(null\);/);
});
