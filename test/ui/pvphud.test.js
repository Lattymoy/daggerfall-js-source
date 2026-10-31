// PVP-HUD (the owner's mockup of the PvP screens, 2026-10-29: the combat timer ring and the flag cooldown
// ring, as the mockup showed; bible/11-Multiplayer/PvP-Rework.md PVP-HUD): the combat lock shown - the ring round the flag button, the
// banner, the last hits - and the lines the lock's doors say, the kill's lines, the party's plate, the villain's mark and
// the level 29 sheet.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PVP_RING, PVP_FLAG_SPOT, pvpRing, pvpLockSecs, pvpHitLine, pvpHitsAdd, createPvpHud, pvpPortalLockText, pvpRestLockText, pvpLockOverText, pvpSlewText, PVP_SAY_S } from '../../src/ui/pvpHud.js';
import { createPvpFlagHost, pvpFightLeft } from '../../src/scenes/pvpFlagHost.js';
import { createPvpRulesHost } from '../../src/scenes/pvpRulesHost.js';
import { createPortalStoneHost } from '../../src/scenes/portalStoneHost.js';
import { setPvpLimitedSource } from '../../src/systems/wild/pvpRules.js';
import { getPreventedRestMessage, clearPreventRestConditions } from '../../src/systems/rest/restSession.js';
import { registerMoveCap } from '../../src/player/motor.js';
import { PVP_FLAG } from '../../src/systems/wild/pvpFlag.js';
import { pvpBarLow, PVP_BAR_LOW } from '../../src/ui/nameLayer.js';
import { setWildDeath, wildDeathSlain, wildDeathLines } from '../../src/systems/wild/wildZone.js';
import { pvp30Owed, pvp30Go } from '../../src/ui/levelUp/pvp30Ask.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const L = PVP_FLAG.lockMs, C = 2 * Math.PI * PVP_RING.r;
afterEach(() => { setPvpLimitedSource(null); registerMoveCap('pvpRules', null); clearPreventRestConditions(); setWildDeath(null); });

/** A DOM just big enough for the HUD: elements keep their style, attributes, children and text. */
function el(tag) {
  return { tag, style: {}, attrs: {}, children: [], textContent: '', setAttribute(k, v) { this.attrs[k] = String(v); }, addEventListener() {},
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); }, replaceChildren(...c) { this.children = c; } };
}
const fakeDoc = () => ({ body: el('body'), addEventListener: () => {}, createElement: el, createElementNS: (_ns, tag) => el(tag) });
const dashOf = (frac) => `${(frac * C).toFixed(2)} ${C.toFixed(2)}`;

/** The flag host on a fake page, flagged in the zone at level 30: its clock, its lines, its 1 s tick and its HUD's nodes. */
function page() {
  const realInterval = globalThis.setInterval, ticks = [];
  globalThis.setInterval = (fn) => { ticks.push(fn); return 0; };
  const s = { clock: 0, said: [], talk: [] };
  const doc = fakeDoc();
  try {
    s.f = createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: () => {} }), { level: 30 }, (l, sec) => s.said.push([l, sec]), { say: (l) => s.talk.push(l) }, { doc, now: () => s.clock, zone: () => true });
  } finally { globalThis.setInterval = realInterval; }
  const [, ring, secs, banner, hits] = doc.body.children;
  Object.assign(s, { tick: () => ticks[0](), ring, arc: ring.children[0], secs, banner, hits, lines: () => hits.children.slice(1).map((c) => c.textContent) });
  return s;
}

test('PVP-HUD THE RING (ui/pvpHud.js pvpRing): none unflagged or white out of the lock; in the lock the share of PVP_FLAG.lockMs left, full at a blow; a villain\'s full outside it; the seconds as the flag counts them (mutants: the share unread; the villain\'s ring empty; the seconds floored)', () => {
  assert.deepEqual(PVP_RING, { size: 52, r: 24, stroke: 3, hits: 3 });
  assert.equal(L, 60_000);
  assert.deepEqual(pvpRing(null, L), { show: false, frac: 0, dash: dashOf(0) });
  assert.equal(pvpRing('white', 0).show, false);
  assert.deepEqual(pvpRing('gold', L), { show: true, frac: 1, dash: dashOf(1) });
  assert.deepEqual(pvpRing('gold', 0.4 * L), { show: true, frac: 0.4, dash: dashOf(0.4) });
  assert.equal(pvpRing('gold', 0).show, false, 'the lock over: gone');
  assert.deepEqual(pvpRing('red', 0), { show: true, frac: 1, dash: dashOf(1) }, 'a villain: red, full');
  assert.equal(pvpRing('red', L / 2).frac, 0.5, 'a villain in the lock empties too');
  assert.deepEqual([pvpLockSecs(24_100), pvpLockSecs(24_000), pvpLockSecs(1), pvpLockSecs(0), pvpLockSecs(-5)], [25, 24, 1, 0, 0]);
});

test('PVP-HUD THE PAGE (scenes/pvpFlagHost.js, ui/pvpHud.js): a blow starts the ring, its seconds and the banner "In combat"; they count down with the lock and go when it ends, "You are out of combat." said 3 s mid-screen once; the last hits list my three newest blows, named as the layer names them, and clear with the lock (mutants: the HUD unpainted; the end unsaid; said twice; the hits unkept; a stranger named)', () => {
  const s = page();
  assert.equal(s.f.toggle(), true);
  s.tick();
  assert.equal(s.ring.style.display, 'none', 'flagged, no fight: no ring');
  assert.equal(s.banner.style.display, 'none');
  s.f.mask((p) => (p.id === 'peer-y' ? p : null))({ id: 'peer-y', name: 'Example Player' });
  s.f.mask((p) => (p.id === 'peer-y' ? p : null))({ id: 'peer-s', name: 'Hidden Name' });
  s.f.heard({ k: 'hp', by: 'peer-s', to: 'peer-me', d: 188, r: 0, h: [] });
  assert.equal(s.ring.style.display, 'block');
  assert.equal(s.arc.attrs['stroke-dasharray'], dashOf(1));
  assert.deepEqual({ ...PVP_FLAG_SPOT }, { lift: 64, size: 36 });
  assert.deepEqual([s.ring.style.top, s.ring.style.transform, s.secs.style.top], ['calc(50% - 72px)', undefined, 'calc(50% - 90px)'], 'PVP-FLAG-SPOT: the ring on the skull where it stands, its seconds over it');
  assert.deepEqual([s.banner.style.display, s.banner.children[0].textContent, s.banner.children[1].textContent, s.secs.textContent], ['block', 'In combat', '60 s', '60 s']);
  assert.deepEqual(s.lines(), ['A player hit you: 188'], 'a stranger the layer leaves nameless: no name');
  assert.equal(s.hits.style.display, 'block');
  s.clock = 0.6 * L;
  s.f.heard({ k: 'hp', by: 'peer-me', to: 'peer-y', d: 312, r: 2, h: [] });
  s.clock = 0.6 * L + 0.6 * L;
  s.tick();
  assert.equal(s.arc.attrs['stroke-dasharray'], dashOf(0.4), 'the lock restarted at the blow, 40% left');
  assert.equal(s.banner.children[1].textContent, '24 s');
  assert.equal(pvpFightLeft(), 0.4 * L, 'the door outside the host');
  for (const d of [1, 2, 3]) s.f.heard({ k: 'hp', by: 'peer-me', to: 'peer-y', d, r: 0, h: [] });
  s.tick();
  assert.deepEqual(s.lines(), ['You hit Example Player: 3', 'You hit Example Player: 2', 'You hit Example Player: 1'], 'three, newest first');
  assert.equal(s.hits.children[0].textContent, 'Last hits');
  assert.equal(s.said.some(([l]) => l === 'You are out of combat.'), false);
  s.clock += L;
  s.tick();
  assert.deepEqual([s.ring.style.display, s.banner.style.display, s.secs.style.display, s.hits.style.display], ['none', 'none', 'none', 'none']);
  assert.deepEqual(s.said.filter(([l]) => l === 'You are out of combat.'), [['You are out of combat.', PVP_SAY_S]]);
  assert.equal(PVP_SAY_S, 3);
  s.tick();
  assert.equal(s.said.filter(([l]) => l === 'You are out of combat.').length, 1, 'once');
  assert.deepEqual(s.f.hits(), [], 'the panel cleared with the lock');
});

test('PVP-HUD THE VILLAIN AND THE OFF FLAG (scenes/pvpFlagHost.js): a villain wears the red ring, full, with no fight; my flag down, no ring and no hits panel - a blow on me still shows the banner (mutants: the villain ringless; the panel shown unflagged)', () => {
  const s = page();
  s.f.heard({ k: 'hp', by: 'peer-x', to: 'peer-me', d: 50, r: 0, h: [] });
  assert.deepEqual([s.ring.style.display, s.banner.style.display, s.hits.style.display], ['none', 'block', 'none'], 'unflagged: the banner alone');
  s.clock = L;
  s.tick();
  s.f.heard({ k: 'flag', id: 'peer-me', f: 1 });
  s.f.heard({ k: 'vil', n: 5_000 });
  s.tick();
  assert.equal(s.f.mySkull(), 'red');
  assert.deepEqual([s.ring.style.display, s.arc.attrs['stroke-dasharray'], s.banner.style.display], ['block', dashOf(1), 'none']);
});

test('PVP-HUD THE HUD\'S FRAMES (ui/pvpHud.js createPvpHud): in the lock the next frame is asked, one at a time; out of it none; the list rebuilt only when its lines change; the bronze ground and border (mutants: the frame unasked; asked twice)', () => {
  const frames = [];
  let ticks = 0;
  const doc = fakeDoc();
  const hud = createPvpHud(/** @type {any} */ (doc), () => { ticks++; }, { raf: (fn) => frames.push(fn) });
  hud.draw({ kind: 'gold', left: L / 2, shown: true, hits: ['x'] });
  hud.draw({ kind: 'gold', left: L / 2, shown: true, hits: ['x'] });
  assert.equal(frames.length, 1, 'one frame asked');
  const list = hud.hits.children;
  frames.shift()();
  assert.equal(ticks, 1);
  hud.draw({ kind: 'gold', left: L / 2 - 100, shown: true, hits: ['x'] });
  assert.equal(hud.hits.children, list, 'the same lines: not rebuilt');
  frames.shift()();
  hud.draw({ kind: 'gold', left: 0, shown: true, hits: [] });
  assert.equal(frames.length, 0, 'out of the lock: no frame');
  assert.deepEqual([hud.banner.style.background, hud.banner.style.border, hud.hits.style.width], ['#2a241c', '2px solid #8a7246', '230px']);
  hud.draw({ kind: 'gold', left: L, shown: false, hits: ['x'] });
  assert.deepEqual([hud.ring.style.display, hud.banner.style.display], ['none', 'none'], 'out of the zone: nothing');
});

test('PVP-HUD THE LINES (ui/pvpHud.js): each blow\'s line, a nameless one\'s too; three kept; the doors\' lines with their seconds; the kill (mutants: by and to swapped; four kept)', () => {
  const nameOf = (id) => (id === 'peer-y' ? 'Example Player' : null);
  assert.equal(pvpHitLine({ by: 'me', to: 'peer-y', d: 312 }, 'me', nameOf), 'You hit Example Player: 312');
  assert.equal(pvpHitLine({ by: 'peer-y', to: 'me', d: 188 }, 'me', nameOf), 'Example Player hit you: 188');
  assert.equal(pvpHitLine({ by: 'me', to: 'peer-z', d: 9 }, 'me', nameOf), 'You hit a player: 9');
  assert.equal(pvpHitLine({ by: 'peer-z', to: 'me', d: 9 }, 'me', nameOf), 'A player hit you: 9');
  assert.deepEqual(pvpHitsAdd(['c', 'b', 'a'], 'd'), ['d', 'c', 'b']);
  assert.equal(pvpPortalLockText(24), 'You are in combat. Wait 24 s to use a Portal Stone.');
  assert.equal(pvpRestLockText(24), 'You cannot rest in combat. 24 s left.');
  assert.equal(pvpLockOverText(), 'You are out of combat.');
  assert.equal(pvpSlewText('Example Player'), 'You slew Example Player.');
  assert.equal(pvpSlewText(null), 'You slew another player.');
});

test('PVP-HUD THE LOCK\'S DOORS (scenes/pvpFlagHost.js, scenes/portalStoneHost.js, scenes/pvpRulesHost.js): in the lock a Portal Stone is refused with the seconds left, mid-screen 3 s, flagged or not (PVP-PORTAL); the rest refusal counts the seconds; the flag\'s own drop says its seconds 3 s; out of the lock none of it (mutants: the stone\'s lock unasked; unflagged free in the lock; the rest line static)', () => {
  const s = page();
  const stone = createPortalStoneHost({});
  s.f.toggle();
  assert.equal(stone.lockRefused(), false, 'no fight: the stone is free of the lock');
  s.f.heard({ k: 'hp', by: 'peer-x', to: 'peer-me', d: 10, r: 0, h: [] });
  s.clock = 0.6 * L;
  assert.equal(stone.lockRefused(), true);
  assert.deepEqual(s.said.at(-1), ['You are in combat. Wait 24 s to use a Portal Stone.', 3]);
  assert.equal(s.talk.at(-1), 'You are in combat. Wait 24 s to use a Portal Stone.');
  assert.equal(s.f.toggle(), false);
  assert.deepEqual(s.said.at(-1), ['You are in combat. You can turn PvP off in 24 s.', 3]);
  const rules = createPvpRulesHost(s.f, {}, { activeEffects: [] }, () => {}, { zone: () => true, every: null });
  rules.tick();
  assert.equal(getPreventedRestMessage(), 'You cannot rest in combat. 24 s left.');
  s.clock = 0.9 * L;
  rules.tick();
  assert.equal(getPreventedRestMessage(), 'You cannot rest in combat. 6 s left.');
  s.clock = L;
  assert.equal(getPreventedRestMessage(), 'You cannot rest or wait with PvP on.', 'the lock over: the flag\'s own line');
  assert.equal(stone.lockRefused(), false);
  s.f.toggle();
  s.clock = 0;
  s.f.heard({ k: 'hp', by: 'peer-x', to: 'peer-me', d: 10, r: 0, h: [] });
  assert.equal(s.f.on(), false);
  assert.equal(stone.lockRefused(), true, 'unflagged in the lock: held too (PVP-PORTAL, as the owner asked)');
  s.clock = L;
  assert.equal(stone.lockRefused(), false, 'the lock over: free');
  const src = rd('src/scenes/portalStoneHost.js');
  assert.ok(src.includes("    if (lockRefused()) return false;\n    const why = portalDoorRefusal();"), 'the door asks it first');
  assert.ok(src.includes('if (!pick?.pixel || lockRefused()) return;'), 'and the pick');
});

test('PVP-HUD THE KILL AND THE FALL (scenes/pvpFlagHost.js, systems/wild/wildZone.js, ui/deathScreen.js, ui/enhanced/enhancedDeath.js): my kill says "You slew" its name; the fallen\'s screen heads its lines "Slain by" the killer, another player when unnamed, nothing at a foe\'s death (mutants: the kill unsaid; the head unread on either face)', () => {
  const s = page();
  s.f.mask((p) => p)({ id: 'peer-y', name: 'Example Player' });
  assert.equal(s.f.heard({ k: 'fell', id: 'peer-y', by: 'peer-me', r: 'ab' }), false, 'handed on to the host');
  assert.deepEqual(s.said.at(-1), ['You slew Example Player.', 3]);
  s.f.heard({ k: 'fell', id: 'peer-me', by: 'peer-y', r: 'ab' });
  assert.deepEqual(s.said.at(-1), ['You slew Example Player.', 3], 'my own fall: no kill line');
  setWildDeath({ killer: 'Example Player', dropped: 0 });
  assert.equal(wildDeathSlain(), 'Slain by Example Player.');
  assert.equal(wildDeathLines()[0], 'Example Player may take one uninsured worn piece of yours, or gold.', 'the lines below as they were');
  setWildDeath(null);
  setWildDeath({ kill: true });
  assert.equal(wildDeathSlain(), 'Slain by another player.');
  setWildDeath(null);
  setWildDeath({ dropped: 0 });
  assert.equal(wildDeathSlain(), '', 'a foe\'s death: no head');
  assert.ok(rd('src/ui/deathScreen.js').includes('for (const l of [wildDeathSlain(this.wild), ...wildDeathLines(this.wild)].filter(Boolean)) {'));
  assert.ok(rd('src/ui/enhanced/enhancedDeath.js').includes('lines = [slain, ...wildDeathLines(screen.wild ?? null)].filter(Boolean);'));
});

test('PVP-HUD THE PLATES (scenes/pvpFlagHost.js mask, ui/nameLayer.js): a flagged party member wears its bar and no skull; a stranger its skull; a bar under 20% flashes, never at 0 (mutants: the party\'s skull kept; the edge moved)', () => {
  const s = page();
  s.f.heard({ k: 'flag', id: 'peer-p', f: 1 });
  s.f.heard({ k: 'flag', id: 'peer-x', f: 1 });
  s.f.heard({ k: 'bar', id: 'peer-p', h: 15, s: 0 });
  const mask = s.f.mask((p) => p, { isPartyPeer: (id) => id === 'peer-p' });
  const mate = mask({ id: 'peer-p', name: 'Example Player' });
  assert.equal(mate.skull, undefined, 'my party: no skull');
  assert.deepEqual([mate.name, mate.bar, mate.near], ['Example Player', { h: 15, s: 0 }, true]);
  assert.equal(mask({ id: 'peer-x', name: 'B' }).skull, 'white');
  assert.equal(PVP_BAR_LOW, 20);
  assert.deepEqual([pvpBarLow({ h: 19 }), pvpBarLow({ h: 20 }), pvpBarLow({ h: 0 }), pvpBarLow(null)], [true, false, false, false]);
  const layer = rd('src/ui/nameLayer.js');
  assert.ok(layer.includes("setCls(tag.bar, !b ? 'dfname-bar off' : pvpBarLow(b) ? 'dfname-bar low' : 'dfname-bar');"));
  assert.ok(layer.includes('.dfname-bar.low { animation: dfname-low'));
});

test('PVP-HUD THE VILLAIN ON THE MAP AND LEVEL 29 (scenes/travelViewMarks.js, ui/growth/growthTab.js): a red villain the zone\'s law would hide from the Overworld is marked nameless in red, my party never; the owed level 29 reads "Level 29 · 1 level owed" and its button "Go to 30" (mutants: the villain hidden; the words lost)', () => {
  const marks = rd('src/scenes/travelViewMarks.js');
  assert.ok(marks.includes("if (host.social?.isPartyPeer(id) || pvpSkullOf(id) !== 'red' || !dropped()) return false;"));
  assert.ok(marks.includes("marks.push({ key: `peer:${id}`, at, label: WILD_TEXT.stranger, kind: 'stranger', edge: true, skull: 'red' });"));
  assert.ok(marks.includes("if (villainMark(d.id, [f[0], f[1] + TV_PEER_HEAD_M, f[2]], () =>"), 'a drawn peer');
  assert.ok(marks.includes("{ if (pvpSkullOf(t.id) === 'red') villainMark(t.id, tvSceneKept("), 'a region traveller');
  assert.equal(pvp30Owed(29), 'Level 29 · 1 level owed');
  assert.equal(pvp30Go(), 'Go to 30');
  const tab = rd('src/ui/growth/growthTab.js');
  assert.ok(tab.includes("const go = el('button', 'act primary', pvp30Go());"));
  assert.ok(tab.includes("el('h3', 'gr-doorhead', pvp30Owed(entity.level))"));
});
