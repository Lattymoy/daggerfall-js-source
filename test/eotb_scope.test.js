import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ═══ AUDIT-EOTB: WHAT IS AND IS NOT PORTED ════════════════════════
//
// The arc called itself 1:1 in six places and shipped a camera whose
// settings reader had no caller. The claim was never checkable, which
// is why it survived seven slices - so this file makes it checkable.
//
// THE INVENTORY, and how to reproduce it. The mod's assembly is
// `Eye Of The Beholder.dll` inside the vendored `.dfmod` (386 KB,
// `vendor/eye-of-the-beholder/eyeofthebeholder.dfmod.json` is its
// manifest). `monodis` segfaults on it; `dncil`/`dnfile` read it. Every
// method body was dumped, then these were struck as compiler-generated
// rather than authored:
//
//   .ctor / .cctor                          - constructors
//   MoveNext, IEnumerator.Reset,            - the four coroutine
//   IEnumerator.get_Current,                  state machines Unity
//   IDisposable.Dispose                       builds for `yield`
//   add_* / remove_*                        - event accessors
//
// What is left is 62 AUTHORED methods: 28 on `EyeOfTheBeholder` (the
// camera), 33 on `PlayerBillboard` (the sprite) and one on
// `PlayerBillboardState`. Every one of them is a row below.
//
// WHAT THIS FILE CAN AND CANNOT SEE, said plainly. It cannot open the
// DLL - the bundle ships no IL and the suite must run offline - so the
// 62 names are a WRITTEN claim, reproducible by the recipe above and
// not by this process. What it does check is everything downstream of
// that list: that a row claiming a port names a symbol that exists,
// that a row claiming NO port has not quietly grown one, that the
// bible page's prose numbers are this table's own arithmetic, and that
// no record has gone back to saying 1:1.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/**
 * THE 62. `port` names the symbol carrying that method's arithmetic
 * and the module it lives in; `port: null` means the port does not
 * implement it, and `why` says whether that is "no twin here" or
 * "not done yet" - the distinction the first cut of the record lost.
 */
const IL = {
  // ── EyeOfTheBeholder: the camera (28) ───────────────────────────
  'EyeOfTheBeholder::get_posOffset': { port: 'posOffset', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::get_offsetRidingMod': { port: 'posOffset', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::CheckBounds': { port: 'checkBounds', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::SetVectorBounds': { port: 'setVectorBounds', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::Update': { port: 'tick', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::ToggleOffset': { port: 'toggleOffset', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::LoadSettings': { port: 'readCameraSettings', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::get_pivotLocal': { port: null, why: 'no twin: a Unity local transform. The port pivots on the host’s own feet/eye pair.' },
  'EyeOfTheBeholder::Awake': { port: null, why: 'no twin: Unity lifecycle and the mod-message receiver.' },
  'EyeOfTheBeholder::Start': { port: null, why: 'no twin: it caches Unity component handles.' },
  'EyeOfTheBeholder::Init': { port: null, why: 'no twin: the DFU mod loader’s entry point.' },
  'EyeOfTheBeholder::LateUpdate': { port: null, why: 'NOT DONE: the whole AutoTogglePerspective table - nine settings, all inert here.' },
  'EyeOfTheBeholder::OnPositionUpdate': { port: null, why: 'no twin: it re-seeds posCurrent from a Unity transform.' },
  'EyeOfTheBeholder::SetKeyFromText': { port: null, why: 'no twin: KeyCode parsing. modSettings.js declares kinds instead of guessing.' },
  'EyeOfTheBeholder::ToggleBillboard': { port: null, why: 'NOT DONE: hiding the FPV weapon and the horse, and enabling the spellCasting component.' },
  'EyeOfTheBeholder::SpawnBillboard': { port: null, why: 'no twin: it instantiates a Unity GameObject.' },
  'EyeOfTheBeholder::CheckWagon': { port: null, why: 'NOT DONE: ShowCart, the wagon that follows.' },
  'EyeOfTheBeholder::SpawnWagon': { port: null, why: 'NOT DONE: ShowCart.' },
  'EyeOfTheBeholder::UpdateWagon': { port: null, why: 'NOT DONE: ShowCart.' },
  'EyeOfTheBeholder::OnUpdateSailing': { port: null, why: 'no twin: Come Sail Away. `sailing` is wired false and the boat arm is unreachable.' },
  'EyeOfTheBeholder::FreeRein_GetMoveVector': { port: null, why: 'no twin: the Free Rein mod.' },
  'EyeOfTheBeholder::MeleeDamage': { port: null, why: 'NOT DONE: it belongs to the attack lane, which is not ported.' },
  'EyeOfTheBeholder::MessageReceiver': { port: null, why: 'no twin: DFU’s inter-mod message bus.' },
  'EyeOfTheBeholder::ModCompatibilityChecking': { port: null, why: 'no twin: it looks for other DFU mods at runtime.' },
  'EyeOfTheBeholder::OnLoad': { port: null, why: 'no twin: DFU’s save hook.' },
  'EyeOfTheBeholder::OnNewGame': { port: null, why: 'no twin: DFU’s new-game hook.' },
  'EyeOfTheBeholder::OnTransitionInterior': { port: null, why: 'NOT DONE: the mod re-seeds the camera across a transition.' },
  'EyeOfTheBeholder::OnTransitionExterior': { port: null, why: 'NOT DONE: as above.' },

  // ── PlayerBillboard: the sprite (33) ────────────────────────────
  'PlayerBillboard::InitializeStates': { port: 'STATE_TABLES', mod: 'eotbBillboard.js' },
  'PlayerBillboard::LoopIdleBillboard': { port: 'chooseTable', mod: 'eotbBillboard.js' },
  'PlayerBillboard::UpdateOrientation': { port: 'orientationFor', mod: 'eotbBillboard.js' },
  'PlayerBillboard::get_frameTime': { port: 'frameTime', mod: 'eotbBillboard.js' },
  'PlayerBillboard::get_sizeMod': { port: 'sizeMod', mod: 'eotbSprite.js' },
  'PlayerBillboard::get_scaleOffset': { port: 'scaleOffset', mod: 'eotbSprite.js' },
  'PlayerBillboard::PlayFootstep': { port: null, why: 'NOT DONE: the frame clock reports a footfall (advanceFrame) and nobody listens.' },
  'PlayerBillboard::EnableVanillaFootsteps': { port: null, why: 'NOT DONE: the other half of PlayFootstep.' },
  'PlayerBillboard::DisableVanillaFootsteps': { port: null, why: 'NOT DONE: the other half of PlayFootstep.' },
  'PlayerBillboard::PlayMeleeAttackAnimation': { port: null, why: 'NOT DONE: nothing enters an attack state. attackTable() is the chooser these four share, and it has no caller.' },
  'PlayerBillboard::PlayRangedAttackAnimation': { port: null, why: 'NOT DONE: see PlayMeleeAttackAnimation.' },
  'PlayerBillboard::PlayRangedAttackAnimationHold': { port: null, why: 'NOT DONE: see PlayMeleeAttackAnimation.' },
  'PlayerBillboard::PlaySpellAttackAnimation': { port: null, why: 'NOT DONE: see PlayMeleeAttackAnimation.' },
  'PlayerBillboard::PlayLycanAttackAnimation': { port: null, why: 'NOT DONE: see PlayMeleeAttackAnimation.' },
  'PlayerBillboard::PlayDeathAnimation': { port: null, why: 'NOT DONE: the Death and DeathLycan tables are generated and unreachable.' },
  'PlayerBillboard::PlayAnimationCoroutine': { port: null, why: 'NOT DONE: the one-shot player the five Play* methods drive.' },
  'PlayerBillboard::PlayAnimationHoldCoroutine': { port: null, why: 'NOT DONE: the bow’s hold-on-last-frame variant.' },
  'PlayerBillboard::PlayAnimationPingPongCoroutine': { port: null, why: 'NOT DONE: the ping-pong variant with its own offset.' },
  'PlayerBillboard::GetMeleeAnimTickTime': { port: null, why: 'NOT DONE: it times an attack clip, and there is no attack lane to time.' },
  'PlayerBillboard::UpdateBillboard': { port: null, why: 'no twin: it rewrites a Unity mesh. The port draws a billboard batch (eotbBody.draw).' },
  'PlayerBillboard::UpdateBillboardDelayed': { port: null, why: 'no twin: see UpdateBillboard.' },
  'PlayerBillboard::UpdateBillboardDelayedCoroutine': { port: null, why: 'no twin: see UpdateBillboard.' },
  'PlayerBillboard::AssignMeshAndMaterial': { port: null, why: 'no twin: Unity mesh/material handling.' },
  'PlayerBillboard::UpdateMaterial': { port: null, why: 'no twin: Unity mesh/material handling.' },
  'PlayerBillboard::MakeBillboardMaterial': { port: null, why: 'no twin: Unity mesh/material handling.' },
  'PlayerBillboard::Initialize': { port: null, why: 'no twin: it builds the Unity billboard object.' },
  'PlayerBillboard::InitializeTextures': { port: null, why: 'no twin: it loads the bundle’s Texture2Ds. eotbSprite.js resolves URLs at build time instead.' },
  'PlayerBillboard::get_IsReady': { port: null, why: 'no twin: "my transform has a parent". The port’s ready() is its own law - the first sprite has decoded.' },
  'PlayerBillboard::Awake': { port: null, why: 'no twin: Unity lifecycle.' },
  'PlayerBillboard::Update': { port: null, why: 'no twin: it polls Unity input and component state per frame.' },
  'PlayerBillboard::LateUpdate': { port: null, why: 'NOT DONE: the first-person visibility mode, so the sprite still casts a shadow from inside its own eyes.' },
  'PlayerBillboard::FixedUpdate': { port: null, why: 'no twin: Unity’s fixed step.' },
  'PlayerBillboard::OnLoad': { port: null, why: 'no twin: DFU’s save hook.' },

  // ── PlayerBillboardState (1) ────────────────────────────────────
  'PlayerBillboardState::InitializeTextures': { port: null, why: 'no twin: see PlayerBillboard::InitializeTextures.' },
};

const PORTED = Object.entries(IL).filter(([, v]) => v.port);
const NOT = Object.entries(IL).filter(([, v]) => !v.port);

test('AUDIT-EOTB scope: the inventory is whole, and every row has a verdict', () => {
  assert.equal(Object.keys(IL).length, 62, 'the 62 authored methods, all of them');
  const per = {};
  for (const k of Object.keys(IL)) {
    const [type] = k.split('::');
    per[type] = (per[type] ?? 0) + 1;
  }
  assert.deepEqual(per, { EyeOfTheBeholder: 28, PlayerBillboard: 33, PlayerBillboardState: 1 });
  for (const [k, v] of Object.entries(IL)) {
    if (v.port) assert.ok(v.mod, `${k} claims a port, so it must name the module`);
    else assert.match(v.why ?? '', /^(no twin|NOT DONE)/,
      `${k} claims no port, so it must say which kind of gap it is`);
  }
  assert.equal(PORTED.length, 13, 'thirteen of sixty-two');
});

test('AUDIT-EOTB scope: every row claiming a PORT names a symbol that is really there', () => {
  // The whole point. A row saying "ported" is a claim, and a claim
  // nothing checks is how "1:1" survived seven slices.
  for (const [k, v] of PORTED) {
    const src = rd(`src/player/${v.mod}`);
    const decl = new RegExp(`(?:function|const|let|var)\\s+${v.port}\\b|\\b${v.port}\\s*\\(`);
    assert.match(src, decl, `${k} -> ${v.mod}: ${v.port} must exist`);
  }
});

test('AUDIT-EOTB scope: no NOT-PORTED row has quietly grown a port', () => {
  // The other direction, and the one that keeps this file honest as
  // the arc continues: port `PlayFootstep` and `playFootstep` appears,
  // this reddens, and whoever ported it must move the row.
  //
  // NOT A PROOF, and it should not be read as one: a port under an
  // unrelated name walks past it. It is the cheap half; the dear half
  // is a person re-reading the IL, which is what wrote the table.
  const all = readdirSync(join(root, 'src/player'))
    .filter((f) => /^eotb.*\.js$/.test(f))
    .map((f) => rd(`src/player/${f}`))
    .join('\n');
  for (const [k, v] of NOT) {
    const bare = k.split('::')[1].replace(/^get_/, '');
    const camel = bare[0].toLowerCase() + bare.slice(1);
    // the generic Unity names (Update, Awake, OnLoad...) would collide
    // with ordinary port vocabulary, so only the mod's OWN names are
    // checked - the ones that could only mean this method
    if (['update', 'awake', 'start', 'init', 'lateUpdate', 'fixedUpdate', 'onLoad', 'initialize', 'isReady'].includes(camel)) continue;
    assert.doesNotMatch(all, new RegExp(`(?:function|const|let|var)\\s+${camel}\\b`),
      `${k} is recorded as NOT ported (${v.why}) - if that changed, move the row`);
  }
});

test('AUDIT-EOTB scope: THE DEAD EXPORTS - what is ported, exported, and called by nothing', () => {
  // AUDIT-EOTB F6. An export of the arc that no module imports AND its
  // own module never uses is a unit with no wiring - the exact shape
  // the whole audit is about. The set is DERIVED, not listed, so a new
  // one cannot be added without this reddening.
  //
  // Constants and helpers a module uses internally are NOT dead: the
  // pins drive them by name, which is the point of exporting them.
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.js')) files.push(`${dir}/${e.name}`);
    }
  };
  walk('src');
  const code = new Map(files.map((f) => [f, strip(rd(f))]));
  const arc = files.filter((f) => /\/player\/eotb[^/]*\.js$/.test(f));
  assert.ok(arc.length >= 4, 'the arc has its four modules');

  const dead = [];
  for (const m of arc) {
    const s = code.get(m);
    const names = new Set();
    for (const re of [/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
      /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g]) {
      for (const mm of s.matchAll(re)) names.add(mm[1]);
    }
    for (const n of names) {
      const own = (s.match(new RegExp(`\\b${n}\\b`, 'g')) ?? []).length;
      const elsewhere = [...code].some(([f, t]) => f !== m && new RegExp(`\\b${n}\\b`).test(t));
      if (own <= 1 && !elsewhere) dead.push(`${m.replace('src/player/', '')}:${n}`);
    }
  }

  // Each one with the reason it is allowed to be dead. A row here is a
  // DEBT, not a decoration: it is either wired or deleted by the slice
  // that next touches its lane.
  const ALLOWED = {
    'eotbBillboard.js:attackTable': 'the attack lane is not ported (five Play* methods above). Ported knowledge kept, not invented.',
    'eotbSprite.js:scaleOffset': 'get_scaleOffset is ported; spriteInfo.json’s per-sprite offsets are not applied yet, so nothing multiplies by it.',
    'eotbSprite.js:tableKeys': 'what a pre-load would fetch. eotbBody warms ONE sprite, so nothing asks for a whole table.',
    'eotbCamera.js:OVERRIDE_ORDER': 'the three override sections’ precedence, spelled once so posOffset’s arm order can be read against it.',
  };
  assert.deepEqual(dead.sort(), Object.keys(ALLOWED).sort(),
    'every export the arc calls from nowhere is named here, with why');
  for (const [k, why] of Object.entries(ALLOWED)) {
    assert.ok(why.length > 40, `${k}: a reason, not a shrug`);
  }
});

test('AUDIT-EOTB scope: the bible page states THIS table, and no record says 1:1 any more', () => {
  const page = rd('bible/06-Systems/Eye-Of-The-Beholder.md');
  assert.match(page, /\*\*62 (?:real|authored) methods\*\*/, 'the page states the inventory this table holds');
  assert.match(page, /\*\*thirteen\*\*/, 'and how many of them are ported');
  assert.match(page, /test\/eotb_scope\.test\.js/, 'and points at this file');

  // Every IL name the page's not-ported list mentions must be a row
  // here with no port - so the prose cannot drift from the table.
  const section = page.split('**Not ported at all**')[1]?.split('\n## ')[0] ?? '';
  assert.ok(section.length > 200, 'the page carries the list');
  const named = [...section.matchAll(/`([A-Za-z_][\w]*)`/g)].map((m) => m[1]);
  assert.ok(named.length >= 10, 'and names methods in it');
  const notNames = new Set(NOT.map(([k]) => k.split('::')[1]));
  const portedNames = new Set(PORTED.map(([k]) => k.split('::')[1]));
  for (const n of named) {
    if (portedNames.has(n)) assert.fail(`the page lists ${n} as not ported, but the table says it IS`);
  }
  assert.ok(named.some((n) => notNames.has(n)), 'and at least some are real rows');

  // AND THE CLAIM ITSELF. Six records said 1:1. The correction is only
  // as good as the thing that keeps it corrected.
  for (const f of ['bible/06-Systems/Eye-Of-The-Beholder.md', 'bible/01-Overview/Mod-Registry.md',
    'vendor/eye-of-the-beholder/README.md']) {
    const s = rd(f);
    for (const line of s.split('\n')) {
      if (!/1:1/.test(line)) continue;
      if (!/eye of the beholder|eotb/i.test(line)) continue;
      assert.match(line, /not|never|until|called itself|was called/i,
        `${f}: a 1:1 claim for this mod must be the correction, not the claim - "${line.trim()}"`);
    }
  }
});
