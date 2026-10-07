// FIELD BUGS 2026-09-30b (FISH-TIRED) - "you can get instakilled when fishing".
//
// Fishing's net works in its water (Foraging's test, FORAGE0 6.4): swimming, or at sea. On a lake that is swimming, and
// the minute's band charges a swimmer holding still the swim's price (systems/worldTick.js; FATIGUE-IDLE spares dry
// ground only - treading water is not standing): 33 fatigue a game minute on a failed Swimming roll, 8 on a passed one,
// a game minute every five real seconds - 6.3 a real second at Swimming 5, a 6,400 bar (STR and END 50) gone in 17 real
// minutes. The day's forty hauls take about that long. At 0 in the water DFU's collapse was death whatever the health -
// PlayerEntity.OnExhausted SetHealth(0)s a swimmer - and nothing was said before it: no line, only the HUD's bar, while
// the act's meter holds the eye. Measured on the real modules: from a full bar at Swimming 5, nine of twenty seeded days
// died inside the forty (hauls 36-39); from three quarters at haul 30 with full health.
//
// SWIM-SPENT (systems/rest.js; Mac: "I dont care about DFU") ends the death: a drain to nothing in the water now costs a
// tenth of the health a game minute, said on the HUD. The net still keeps its angler off it: no net is cast in
// the water on the last quarter of the fatigue bar, and an act there ends when the bar falls into it - the prompt, and
// E, say "too tired to fish in the water - get out and rest", with a quarter of the bar to swim out on (of 6,400, four
// minutes of treading water at the worst rate). On a pier or a deck (not swimming) the bar asks nothing. The real
// gathering host (scenes/gatherHost.js), Fishing's real kind and act (scenes/fishHost.js, systems/fishAct.js), the real
// player ticker (scenes/shared.js createPlayerTicker -> systems/worldTick.js) and world.js's collapse over it (a collapse in
// the water, drowned or not, is what the pins count).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGatherHost, ACT_STOPPED_LINE } from '../src/scenes/gatherHost.js';
import { fishKind } from '../src/scenes/fishHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { setSharedClock, setWorldMinutes, resetMagicRoundMarker } from '../src/systems/worldTick.js';
import { exhaustionOutcome } from '../src/systems/rest.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { SKILLS } from '../src/systems/skills.js';
import { onMonsterHit } from '../src/systems/diseases.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const NOON = 100000 * 1440 + 12 * 60;   // a day's noon on the classic clock
const TIRED = 'too tired to fish in the water - get out and rest';

/** An angler with a Fishing-Net, in a lake (swimming) or on a pier at sea (not), `share` of the fatigue pool left. */
function stand({ swimming = true, share = 1 } = {}) {
  // the act's wait and the haul's wander, the Swimming roll and the haul's name drawn from one seeded generator, so a run repeats
  const random = Math.random;
  let seed = 0x5eed;
  Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const skills = new Array(35).fill(30);
  skills[SKILLS.Swimming] = 5;
  const entity = {
    isPlayer: true, level: 1, raceId: 0, name: 'Angler', health: 100, maxHealth: 100, magicka: 0, maxMagicka: 0,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills, skillUses: new Array(35).fill(0), activeEffects: [],
    items: [{ templateIndex: 1603, group: 'UselessItems2', currentCondition: 1000, maxCondition: 1000, name: 'Fishing-Net' }],
  };
  entity.fatigue = Math.round(maxFatigue(entity) * share);
  // Foraging's world as world.js answers it: a Woodlands lake, sunk (swimming); or the Ocean's pixel, on the boards
  const w = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12,
    climate: swimming ? CLIMATES.Woodlands : CLIMATES.Ocean, region: 17, enemiesNear: false, carriedWeight: 5, maxEncumbrance: 150,
    swimming, exteriorWater: swimming ? 'Swimming' : 'None' };
  const prev = setForagingHost({ world: () => w, entity: () => entity });
  const taken = new Set();
  const book = {   // an account book that answers every haul at once
    state: { open: true, hauls: 0, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, taken: (k) => taken.has(k), counting: () => false, held: () => 0,
    track: () => ({ rank: 0, specs: { 50: null, 100: null } }),
    harvest: async (h) => { taken.add(h.node); book.state.hauls++; return { ok: true, data: { node: h.node, qty: 1, xp: 15, track: { profession: 'fishing', rank: 0 } } }; },
  };
  const said = [];
  let prompt = null;
  let input = { held: false, attack: false, choice: false };
  let phase = null;
  const hud = {
    setPrompt: (p) => { prompt = p; }, toast: (t) => said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    setMeter: (a) => {   // the angler's hand, off the meter: the tug taken, the band kept on the weight
      phase = a?.state.phase ?? null;
      if (!a) return;
      const st = a.state;
      if (st.phase === 'tug') input = { held: false, attack: true, choice: false };
      else if (st.phase === 'haul') input = { held: st.bandAt + st.bandW / 2 < st.weight, attack: false, choice: false };
    },
  };
  const eye = { pos: [0, 1.6, 0], dir: [0, 0, 1] };
  const kind = fishKind({ book, host: {
    pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: w.climate, region: 17 }), eye: () => eye, feet: () => [0, 0, 0],
    hour: () => 12, storm: () => false, climateAt: () => w.climate, trophy: () => false, day: () => 20724,
  } });
  const gather = createGatherHost({
    book, hud, kinds: [kind], renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => null,
    uploadRecord: () => {}, billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = out[1] = out[2] = 0; return out; }, pixelInfo: () => ({ climate: w.climate, region: 17 }),
    nowMs: () => Date.UTC(2026, 8, 30, 12), eye: () => eye, view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0],
    entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => true,
  });
  setSharedClock(null); setWorldMinutes(NOON); resetMagicRoundMarker(NOON); entity.lastGameMinutes = NOON;
  const deaths = [];
  const ticker = createPlayerTicker(entity, {
    isInside: () => false,
    onExhausted: () => {   // scenes/world.js onExhaustedExterior, its three arms (SWIM-SPENT: the water's is a share of the health)
      const out = exhaustionOutcome({ enemiesNearby: false, swimming: !!w.swimming, entity, day: true, inside: false });
      if (out.kind === 'rest') { ticker.advance(60); entity.fatigue = Math.min(maxFatigue(entity), entity.fatigue + out.fatigue); }
      else { deaths.push({ health: entity.health, hauls: book.state.hauls, kind: out.kind }); hurtPlayer(entity, out.kind === 'drown' ? out.damage : entity.health, { bypassShield: true }); }
    },
  });
  const dt = 1 / 30;
  let windLeft = 0;
  /** One world.js frame of an angler still in the water: E at a cast, held 0.9 s to wind, the act played; the minute's band. */
  const frame = () => {
    if (!gather.acting()) { const took = gather.press() || (gather.sayNeed() && gather.acting()); if (took) windLeft = 0.9; input = { held: took, attack: false, choice: false }; }   // CAST-E: the cast is the press's when nothing else took it - the world's ladder hands it back
    else if (windLeft > 0) { input = { held: true, attack: false, choice: false }; windLeft -= dt; }
    else if (phase !== 'tug' && phase !== 'haul') input = { held: false, attack: false, choice: false };   // let go: the net flies, then waits
    gather.tick(dt);
    ticker.tick(dt, { running: false, runningTally: false, swimming: !!w.swimming, climbing: false, jumped: false, standing: true });
  };
  /** The day's forty, pressed for as long as the net takes the press (an angler it refuses stays a minute, no more). */
  const fishDay = async () => {
    let last = -1, idle = 0;
    for (let f = 0; f < 2_000_000 && book.state.hauls < 40 && entity.health > 0; f++) {
      frame();
      if (f % 50 === 0) await null;   // the book's answers land
      if (book.state.hauls === last && !gather.acting()) { if ((idle += dt) > 60) break; } else { idle = 0; last = book.state.hauls; }
    }
  };
  return { entity, w, book, said, prompt: () => prompt, gather, ticker, deaths, frame, fishDay, done: () => { setForagingHost(prev); gather.dispose(); Math.random = random; } };
}

test('FISH-TIRED: an angler who starts the day\'s forty in a lake at three quarters of the fatigue bar is not killed by the collapse - the net stops on the last quarter and says why', async () => {
  const s = stand({ swimming: true, share: 0.75 });
  try {
    await s.fishDay();
    assert.deepEqual(s.deaths, [], `no collapse in the water (health ${s.entity.health}, ${s.book.state.hauls} hauls, fatigue ${s.entity.fatigue} of ${maxFatigue(s.entity)})`);
    assert.equal(s.entity.health, 100);
    assert.ok(s.book.state.hauls >= 10 && s.book.state.hauls < 40, `the net fished, then stopped short of the forty (${s.book.state.hauls})`);
    assert.ok(s.entity.fatigue > 0, 'with the pool not spent');
    assert.equal(s.prompt()?.verb, 'Cast the net');
    assert.equal(s.prompt()?.rest, TIRED, 'the prompt says why');
    assert.equal(s.gather.press(), false, 'E casts nothing');
    assert.equal(s.gather.sayNeed(), true);
    assert.equal(s.said.at(-1), `Cast the net: ${TIRED}`, 'and says why');
  } finally { s.done(); }
});

test('FISH-TIRED: on the last quarter of the bar the net is refused in the water (E passes on - a boat, a door); on a pier at sea the same bar fishes, and over the line it fishes in the water', () => {
  for (const [swimming, share, ready] of [[true, 0.2, false], [true, 0.24, false], [false, 0.2, true], [false, 0.05, true], [true, 0.26, true], [true, 1, true]]) {
    const s = stand({ swimming, share });
    try {
      const where = `${swimming ? 'in the water' : 'on a pier'} at ${Math.round(share * 100)}% of the bar`;
      s.frame();   // the cast found, its prompt said
      assert.equal(s.prompt()?.rest === TIRED, !ready, where);
      s.frame();   // E
      assert.equal(s.gather.acting(), ready, `${where}: the press was ${ready ? 'the net\'s' : 'passed on'}`);
    } finally { s.done(); }
  }
});

test('FISH-TIRED: a cast under way in the water ends when a Lamia\'s hits (her fatigue rider: damage x 128) take the bar under the line - never held there to the collapse; on a pier the same fall leaves the act alone', async () => {
  const s = stand({ swimming: true, share: 0.5 });
  try {
    for (let i = 0; i < 60 && !s.gather.acting(); i++) s.frame();
    assert.ok(s.gather.acting(), 'casting');
    for (let i = 0; i < 30; i++) s.frame();   // the net in the air, then waiting
    const lamia = { careerIndex: MOBILE_TYPES.Lamia };
    let hits = 0;
    while (s.entity.health > 0 && s.gather.acting() && hits < 20) {
      hurtPlayer(s.entity, 10); onMonsterHit(lamia, s.entity, 10, { sinks: s.ticker.sinks }); hits++;
      for (let i = 0; i < 2; i++) s.frame();
    }
    assert.deepEqual(s.deaths, [], `no collapse (after ${hits} hits, fatigue ${s.entity.fatigue})`);
    assert.equal(s.gather.acting(), false, 'the act ended');
    assert.equal(hits, 2, 'at the hit that crossed the line');
    assert.ok(s.said.includes(ACT_STOPPED_LINE));
    assert.equal(s.prompt()?.rest, TIRED);
  } finally { s.done(); }
  const p = stand({ swimming: false, share: 0.5 });
  try {
    for (let i = 0; i < 60 && !p.gather.acting(); i++) p.frame();
    assert.ok(p.gather.acting(), 'casting from the pier');
    p.entity.fatigue = Math.round(maxFatigue(p.entity) * 0.1);
    for (let i = 0; i < 30 * 5; i++) p.frame();
    assert.equal(p.gather.acting(), true, 'the act plays on');
    assert.ok(!p.said.includes(ACT_STOPPED_LINE));
  } finally { p.done(); }
});
