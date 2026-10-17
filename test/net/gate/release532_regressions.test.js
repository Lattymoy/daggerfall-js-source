import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { timersWindow } from '../../../src/ui/enhanced/enhancedTimers.js';
import { createRiteHost, RITE_RESTAND_MS } from '../../../src/scenes/riteHost.js';
import { gateTimes } from '../../../src/net/gate/gateLaw.js';
import { riteLocalOf, riteFaithfulOf, RITE_SUMMONER_CAREER } from '../../../src/net/gate/gateRite.js';
import { restoreModSaveRecords } from '../../../src/systems/modSaveData.js';

function fakeDoc() {
  const node = () => {
    const n = { children: [], className: '', attrs: {}, style: {}, append(...cs) { this.children.push(...cs); }, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {} };
    Object.defineProperty(n, 'textContent', { get() { return this._text ?? ''; }, set(v) { this._text = v; this.children = []; } });
    return n;
  };
  return { createElement: node };
}
const all = (n, cls) => [...(n.className.split(' ').includes(cls) ? [n] : []), ...n.children.flatMap(c => all(c, cls))];

test('timers refresh the remaining raid count when a different raid is cleared', () => {
  const now = Date.UTC(2026, 9, 2, 12, 20);
  const raids = [
    { name: 'A', region: 'Elsewhere', startMs: now - 1000, endMs: now + 5000 },
    { name: 'B', region: 'Elsewhere', startMs: now + 10000, endMs: now + 20000, done: false },
  ];
  const view = timersWindow(fakeDoc(), { read: () => ({ now, region: 'Home', raids }), onClose() {} });
  try {
    assert.equal(all(all(view.root, 'tm-raid')[0], 'tm-detail')[0].textContent, '1 more today across the Iliac Bay');
    raids[1].done = true;
    view.draw();
    assert.equal(all(all(view.root, 'tm-raid')[0], 'tm-detail').length, 0, 'the cleared raid must leave the detail immediately');
  } finally { view.stop(); }
});

for (const failure of ['null', 'rejected']) test(`a ${failure} Summoner spawn recovers without duplicating surviving faithful`, async () => {
  restoreModSaveRecords({});
  const day = 700, times = gateTimes(day), [x, z] = riteLocalOf(day);
  let now = times.omenAt + 60000, failSummoner = true;
  const list = [], attempts = [];
  const host = createRiteHost({
    now: () => now, omen: () => ({ site: { day, px: 300, py: 200, near: 'Audit town' } }),
    pixelTranslation: () => [0, 0, 0], groundAt: () => 0, feet: () => [x, 0, z], online: () => true,
    foes: {
      spawn: async (career, at, opts) => {
        attempts.push(career);
        if (career === RITE_SUMMONER_CAREER && failSummoner) { failSummoner = false; if (failure === 'rejected') throw new Error('simulated texture fetch failure'); return null; }
        const f = { mobileType: career, site: opts.site, ai: { feet: [at[0], 0, at[1]] }, entity: { health: 50, maxHealth: 50 } };
        list.push(f); return f;
      },
      list: () => list, campId: () => 7, drop() {}, remove(f) { list.splice(list.indexOf(f), 1); },
    },
  });
  try {
    host.frame(); await new Promise(setImmediate); host.frame();
    const survivors = [...list];
    assert.equal(survivors.length, riteFaithfulOf(day).length - 1);
    now += RITE_RESTAND_MS + 1;
    host.frame(); await new Promise(setImmediate); host.frame();
    assert.equal(list.filter(f => f.mobileType === RITE_SUMMONER_CAREER).length, 1, 'a recoverable spawn failure must not make the rite impossible');
    assert.equal(list.length, riteFaithfulOf(day).length, 'no duplicate faithful');
    assert.ok(survivors.every(f => list.includes(f)), 'existing enemies stay intact');
    assert.equal(attempts.filter(c => c === RITE_SUMMONER_CAREER).length, 2);
  } finally { host.destroyAll(); restoreModSaveRecords({}); }
});

// THE MERGE (#534 B01 x BROKER-CAGE): a failed slot waits for its retry past survivors() - and the hub's word that every
// one of the faithful fell (the Broker's cage open) ends it, never stood after the cage opened
test('a failed Summoner slot is never retried once the hub says the cage open', async () => {
  restoreModSaveRecords({});
  const day = 700, times = gateTimes(day), [x, z] = riteLocalOf(day);
  let now = times.omenAt + 60000;
  const list = [], attempts = [];
  const host = createRiteHost({
    now: () => now, omen: () => ({ site: { day, px: 300, py: 200, near: 'Audit town' } }),
    pixelTranslation: () => [0, 0, 0], groundAt: () => 0, feet: () => [x, 0, z], online: () => true,
    foes: {
      spawn: async (career, at, opts) => {
        attempts.push(career);
        if (career === RITE_SUMMONER_CAREER) return null;
        const f = { mobileType: career, site: opts.site, ai: { feet: [at[0], 0, at[1]] }, entity: { health: 50, maxHealth: 50 } };
        list.push(f); return f;
      },
      list: () => list, campId: () => 7, drop() {}, remove(f) { list.splice(list.indexOf(f), 1); },
    },
  });
  try {
    host.frame(); await new Promise(setImmediate); host.frame();
    assert.equal(attempts.filter(c => c === RITE_SUMMONER_CAREER).length, 1);
    host.onBroken({ k: 'cl', d: day, px: 300, py: 200, at: now });
    now += RITE_RESTAND_MS + 1;
    host.frame(); await new Promise(setImmediate); host.frame();
    assert.equal(attempts.filter(c => c === RITE_SUMMONER_CAREER).length, 1, 'the cage is open: the failed Summoner is not stood again');
  } finally { host.destroyAll(); restoreModSaveRecords({}); }
});
