// TP-slice: the Teleport (Recall) effect - Teleport.cs whole minus
// the cross-host arm (flagged loud). The (43,255) effect PROMPTS on
// a self arrival (:63-68), the anchor stores on the entity (:115),
// teleporting consumes it on arrival (:133 and :255 both null it),
// no anchor says 4001, and a cast inside a mode leaves it first
// (:151's immediate transition).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySpell } from '../src/systems/effects.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const teleportEffect = () => ({ type: 43, subType: -1 });

test('TP: a self-cast Teleport RAISES the prompt marker; a hostile arrival never does', () => {
  const target = { stats: { willpower: 0 }, career: {} };
  // CasterOnly: the marker rises, nothing assigns (Start prompts, :63-68)
  const r = applySpell({ rangeType: 0, element: 4, effects: [teleportEffect()] }, 1, target, {}, seq(0));
  assert.equal(r.teleport, true);
  assert.equal(target.activeEffects?.length ?? 0, 0, 'the effect assigns nothing - the host owns the box');
  // TargetFlags_Self (:52): a ranged arrival is dropped silently
  const r2 = applySpell({ rangeType: 2, element: 4, effects: [teleportEffect()] }, 1, target, {}, seq(0));
  assert.ok(!r2.teleport, 'the property gate holds');
  // a bundle carrying teleport + heal still heals
  const t3 = { stats: { willpower: 0 }, career: {}, health: 5, maxHealth: 20 };
  let healed = 0;
  const r3 = applySpell({ rangeType: 0, element: 4, effects: [teleportEffect(), { type: 10, subType: 8, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] },
    1, t3, { heal: (n) => { healed += n; } }, seq(0));
  assert.equal(r3.teleport, true);
  assert.equal(healed, 3, 'the rest of the bundle processes');
});

test('TP: the anchor rides the save envelope; pre-TP saves restore null', () => {
  const entity = { stats: { endurance: 50 }, skills: [], skillUses: [], items: [], spells: [],
    anchorPosition: { mode: 'world-exterior', pixel: { x: 40, y: 100 }, nativeX: 123, nativeZ: 456, y: 7 } };
  const snap = snapshotPlayer(entity, {});
  assert.deepEqual(snap.anchorPosition, entity.anchorPosition);
  assert.notEqual(snap.anchorPosition, entity.anchorPosition, 'a copy, not an alias');
  const back = { stats: {} };
  restorePlayer(back, snap);
  assert.deepEqual(back.anchorPosition, entity.anchorPosition);
  delete snap.anchorPosition;
  const old = { stats: {} };
  restorePlayer(old, snap);
  assert.equal(old.anchorPosition, null, 'pre-TP saves restore no anchor');
});

test('TP: the engine seam, the world prompt, the consume, the mode exit', () => {
  const hm = readFileSync(new URL('../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.ok(hm.includes('if (r.teleport) onTeleport?.();'), 'every player arrival routes the prompt');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes("code: 'KeyA', label: 'A - set anchor'"), 'the 4000 box: the anchor arm');
  // teleportOrSetAnchor is a TEXT.RSC ID, not a localization key, so
  // the box's words are record 4000's own (Internal_RSC.csv:4819).
  assert.ok(w.includes("lines: ['Do you want to Teleport or Set an Anchor?'],"),
    'the 4000 box speaks the record, not a paraphrase');
  assert.ok(w.includes("code: 'KeyT', label: 'T - teleport'"), 'the 4000 box: the teleport arm');
  assert.ok(w.includes("townTalk.say('You must set an anchor first.')"), 'the 4001 refusal');
  assert.ok(w.includes('playerEntity.anchorPosition = null;   // consumed on arrival, both DFU arms'),
    'the arrival consumes the anchor (:133/:255)');
  // wave 37: `modes?.` - the binding is hoisted and this line is above
  // its assignment, so the guard belongs on the OBJECT (audit24_wave37).
  // A10 MOVED THIS PIN. The call now carries an argument: the three-way
  // "cache scene before departing" arm (Teleport.cs:145-151) decides
  // whether the interior being left is cached, and the flag is how the
  // exit is told. The law the pin guards is unchanged - a cast inside a
  // mode leaves it first - so the pin follows the call rather than
  // being deleted, and a10_world_misc.test.js pins the arm itself.
  assert.ok(w.includes("!== 'exterior') {\n        modes?.forceExitToExterior({ cacheScene: plan.cacheScene === 'building' });"),
    'a cast inside a mode leaves it first (:151)');
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const i = wm.indexOf('forceExitToExterior(');   // IS1 grew the signature ({ cacheScene })
  const fn = wm.slice(i, wm.indexOf('},', i));
  assert.ok(fn.includes("mode = 'exterior';"), 'the forced exit lands the mode');
  assert.ok(fn.includes('player.collider = baseCollider();'), 'and restores the exterior collider');
  // TP2: the FIXED-CITY host raises the same 4000 box now, off its own
  // prompt - it used to say "Recall pends here" for the whole spell,
  // which was true of one arm and false as a refusal.
  const ex = readFileSync(new URL('../src/scenes/exterior.js', import.meta.url), 'utf8');
  // TP2 REVIEW: BOTH SITES, ANCHORED. `exterior.js` carries the same
  // `onTeleport: () => teleportPrompt(),` line TWICE - once on its own
  // spell engine and once in the bag it hands DOWN to the mode machine
  // - and a bare `includes` is satisfied by either, so nulling the
  // modes one (which is what keeps a MOUNTED dungeon off the standalone
  // host's refusal, worldModes -> dungeonContext) passed the suite.
  const bag = (src, open) => {
    const i = src.indexOf(open);
    assert.notEqual(i, -1, `exterior.js no longer opens ${open}`);
    const end = src.indexOf('\n  });', i);
    assert.ok(end > i, `exterior.js's ${open} bag is not closed the way this pin reads it`);
    return src.slice(i, end);
  };
  assert.ok(bag(ex, 'const magic = createPlayerMagic({').includes('onTeleport: () => teleportPrompt(),'),
    'the fixed-city host routes its own arrivals to the prompt');
  assert.ok(bag(ex, 'var modes = createWorldModes({').includes('onTeleport: () => teleportPrompt(),'),
    'and hands the SAME prompt down to the modes it mounts - without it the mounted dungeon keeps its standalone refusal');
  assert.ok(ex.includes("lines: ['Do you want to Teleport or Set an Anchor?'],"), 'and speaks record 4000');
  // ...and the 4001 refusal is the RECORD, in DFU's own box shape -
  // not a HUD line paraphrasing it (Internal_RSC.csv:4821).
  assert.ok(ex.includes('new ActionTextBox(plainLines(townTalk.lines(ANCHOR_MUST_BE_SET))'),
    'the fixed-city host raises record 4001 through the same TEXT.RSC door its other boxes read');
  assert.ok(ex.includes("?? ['An Anchor must be set before you can Teleport.']"),
    '...with the record\'s own words as the no-TEXT.RSC fallback');
  assert.equal(/You must set an anchor first/.test(ex), false, 'the paraphrase is gone');
  assert.equal(/Recall pends here/.test(ex), false, 'the whole-spell refusal is gone');
  // the STANDALONE dungeon still refuses LOUDLY (INTERIM doctrine),
  // never silently - it has no outer host to hand the plan's arms to.
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.ok(dc.includes('onTeleport: () =>') && dc.includes('Recall pends'), 'dungeonContext says the interim line');
});
