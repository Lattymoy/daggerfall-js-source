import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ═══ AUDIT-EOTB: WHAT IS AND IS NOT PORTED ════════════════════════
//
// The arc called itself 1:1 in six places and shipped a camera whose
// settings reader had no caller. The claim was never checkable, which
// is why it survived seven slices - so this file makes it checkable.
//
// THE INVENTORY, and how to reproduce it. The mod's assembly is
// `Eye Of The Beholder.dll`, which EOTB-IL (2026-09-16) took out of
// the shipped `.dfmod` with `tools/eotbIl.mjs` and vendored beside the
// art, with its whole IL dumped by `tools/ilDump.py` (dnfile + dncil;
// `monodis` segfaults on it) to `vendor/eye-of-the-beholder/il/`.
// Every method body is in that dump; these were struck as
// compiler-generated rather than authored:
//
//   .ctor / .cctor                          - constructors
//   MoveNext, IEnumerator.Reset,            - the four coroutine
//   IEnumerator.get_Current,                  state machines Unity
//   IDisposable.Dispose                       builds for `yield`
//   add_* / remove_*                        - event accessors
//   <Method>b__N_M                          - the three lambdas the
//                                             compiler lifted out of
//                                             FixedUpdate, OnUpdateSailing
//                                             and ModCompatibilityChecking
//
// What is left is 61 AUTHORED methods: 28 on `EyeOfTheBeholder` (the
// camera), 32 on `PlayerBillboard` (the sprite) and one on
// `PlayerBillboardState`. AUDIT-EOTB, writing without the assembly,
// counted 62 and listed a `PlayerBillboard::InitializeTextures` that
// does not exist - the texture walk is `PlayerBillboardState`'s alone;
// the 33rd body on the sprite is `<FixedUpdate>b__96_0`, the one-line
// TravelOptions handler. Every authored method is a row below, and the
// dump is READ here: a row's method must be in it, and no authored
// method of the three types may be missing from this table.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const IL_DUMP = 'vendor/eye-of-the-beholder/il/Eye_Of_The_Beholder.il.txt';

/**
 * THE 61. `port` names the symbol carrying that method's arithmetic
 * and the module it lives in; `port: null` means the port does not
 * implement it, and `why` says whether that is "no twin here" or
 * "NOT DONE" - the distinction the first cut of the record lost.
 * EOTB-IL: every ported row is read off the IL now (there is no other
 * evidence class left), and no row is NOT DONE.
 */
const IL = {
  // ── EyeOfTheBeholder: the camera (28) ───────────────────────────
  'EyeOfTheBeholder::get_posOffset': { port: 'posOffset', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::get_offsetRidingMod': { port: 'posOffset', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::CheckBounds': { port: 'checkBounds', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::SetVectorBounds': { port: 'setVectorBounds', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::Update': { port: 'tick', mod: 'eotbCamera.js' },   // the scroll ladder (tick) and the target-and-smooth (eye)
  'EyeOfTheBeholder::ToggleOffset': { port: 'toggleOffset', mod: 'eotbCamera.js' },
  'EyeOfTheBeholder::LoadSettings': { port: 'readCameraSettings', mod: 'eotbCamera.js' },   // and loadSettings' ToggleOffset(offset) re-run
  'EyeOfTheBeholder::get_pivotLocal': { port: null, why: 'no twin: a Unity local transform. The port pivots on the host’s own feet/eye pair.' },
  'EyeOfTheBeholder::Awake': { port: null, why: 'no twin: Unity lifecycle and the mod-message receiver.' },
  'EyeOfTheBeholder::Start': { port: 'start', mod: 'eotbCamera.js' },   // EOTB-IL: `offset = offsetDefault; ToggleOffset(offset)` (IL_0668-IL_067b) - and the fields the .ctor would seed
  'EyeOfTheBeholder::Init': { port: null, why: 'no twin: the DFU mod loader’s entry point.' },
  'EyeOfTheBeholder::LateUpdate': { port: 'autoToggleRows', mod: 'eotbBillboard.js' },   // EOTB-IL: three "just changed" blocks and a fan-out (IL_1847-IL_1c6e), applied by eotbCamera.tick; UpdateWagon before the offset gate
  'EyeOfTheBeholder::OnPositionUpdate': { port: 'onPositionUpdate', mod: 'eotbCamera.js' },   // EOTB-IL: the floating origin re-seeds the smoothing (IL_1cb7-IL_1ccd)
  'EyeOfTheBeholder::SetKeyFromText': { port: null, why: 'no twin: KeyCode parsing. modSettings.js declares kinds instead of guessing.' },
  'EyeOfTheBeholder::ToggleBillboard': { port: 'toggle', mod: 'eotbBody.js' },   // EOTB-IL: the billboard shown/hidden, the FP flag, the torch, the hands (driven by toggleOffset)
  'EyeOfTheBeholder::SpawnBillboard': { port: null, why: 'no twin: it instantiates a Unity GameObject. The port’s body is a module instance the rig attaches.' },
  'EyeOfTheBeholder::CheckWagon': { port: 'checkWagon', mod: 'eotbWagon.js' },   // EOTB-IL: Info names it, any other mode opens the pack with the wagon (IL_224c-IL_22a4)
  'EyeOfTheBeholder::SpawnWagon': { port: 'createEotbWagon', mod: 'eotbWagon.js' },   // EOTB-IL: model 41239 through the host's pipeline, the seed offset, the 3.2 activation (IL_1e4c-IL_1f0a)
  'EyeOfTheBeholder::UpdateWagon': { port: 'updateWagon', mod: 'eotbWagon.js' },   // EOTB-IL: the follow, the teleport, the ground probe, LookAt and the wobble (IL_1f18-IL_223e)
  'EyeOfTheBeholder::OnUpdateSailing': { port: null, why: 'no twin: Come Sail Away. `sailing` is wired false and the boat arm is unreachable.' },
  'EyeOfTheBeholder::FreeRein_GetMoveVector': { port: null, why: 'no twin: the Free Rein mod.' },
  'EyeOfTheBeholder::MeleeDamage': { port: null, why: 'no twin: the attack-from-body ray. The port’s swing and activation already start at the player’s own head (cam.pos), which the view never moves - only the drawn eye moves - so there is nothing to re-origin and Don’tOffsetAttacks has nothing to stop.' },
  'EyeOfTheBeholder::MessageReceiver': { port: null, why: 'no twin: DFU’s inter-mod message bus.' },
  'EyeOfTheBeholder::ModCompatibilityChecking': { port: null, why: 'no twin: it looks for other DFU mods at runtime.' },
  'EyeOfTheBeholder::OnLoad': { port: 'onLoad', mod: 'eotbCamera.js' },   // EOTB-IL: armed, the transition row for where the player stands; disarmed, StartInThirdPerson (IL_0a08-IL_0ad0)
  'EyeOfTheBeholder::OnNewGame': { port: 'onNewGame', mod: 'eotbCamera.js' },   // EOTB-IL: the same shape (IL_0930-IL_09f8)
  'EyeOfTheBeholder::OnTransitionInterior': { port: 'transition', mod: 'eotbCamera.js' },   // EOTB-IL: registered on the building's doors AND the dungeon's (IL_06a2-IL_06e1)
  'EyeOfTheBeholder::OnTransitionExterior': { port: 'transition', mod: 'eotbCamera.js' },

  // ── PlayerBillboard: the sprite (32) ────────────────────────────
  'PlayerBillboard::InitializeStates': { port: 'STATE_TABLES', mod: 'eotbBillboard.js' },
  'PlayerBillboard::LoopIdleBillboard': { port: 'loopIdleBillboard', mod: 'eotbBody.js' },   // EOTB-IL: the loop itself; chooseTable (eotbBillboard.js) is its table arm (IL_4328-IL_4499)
  'PlayerBillboard::UpdateOrientation': { port: 'updateOrientation', mod: 'eotbBody.js' },   // EOTB-IL: the 0.1 s throttle and the torch modes; orientationFor (eotbBillboard.js) is its angle (IL_4779-IL_47a3)
  'PlayerBillboard::get_frameTime': { port: 'frameTime', mod: 'eotbBillboard.js' },
  'PlayerBillboard::get_sizeMod': { port: 'sizeMod', mod: 'eotbSprite.js' },
  'PlayerBillboard::get_scaleOffset': { port: null, why: 'no twin: DEAD IN THE ASSEMBLY. The getter has no caller anywhere in the IL - Animation.GlobalOffsetScale is read into a field nothing consumes - so the port declares the dial INERT and multiplies by nothing.' },
  'PlayerBillboard::PlayFootstep': { port: 'playFootstep', mod: 'eotbBody.js' },   // EOTB-IL: the clip PlayerFootsteps would pick, at FootstepVolumeScale * (FP ? 1 : 2) (IL_55e8-IL_5928)
  'PlayerBillboard::EnableVanillaFootsteps': { port: 'initialize', mod: 'eotbBody.js' },   // EOTB-IL: Initialize's SyncFootsteps fork (IL_3c78-IL_3c80) - off, the vanilla stride keeps its clips
  'PlayerBillboard::DisableVanillaFootsteps': { port: 'initialize', mod: 'eotbBody.js' },   // EOTB-IL: every clip index to -1 (IL_54f8-IL_554c); `vanillaDisabled` is what `footstep().owns` answers
  'PlayerBillboard::PlayMeleeAttackAnimation': { port: 'playMeleeAttack', mod: 'eotbBody.js' },
  'PlayerBillboard::PlayRangedAttackAnimation': { port: 'playRangedAttack', mod: 'eotbBody.js' },
  'PlayerBillboard::PlayRangedAttackAnimationHold': { port: 'playRangedAttackHold', mod: 'eotbBody.js' },
  'PlayerBillboard::PlaySpellAttackAnimation': { port: 'playSpellAttack', mod: 'eotbBody.js' },
  'PlayerBillboard::PlayLycanAttackAnimation': { port: 'playLycanAttack', mod: 'eotbBody.js' },
  'PlayerBillboard::PlayDeathAnimation': { port: 'playDeath', mod: 'eotbBody.js' },
  'PlayerBillboard::PlayAnimationCoroutine': { port: 'startClip', mod: 'eotbBody.js' },   // EOTB-IL: the forward kind, stepped by advanceClip
  'PlayerBillboard::PlayAnimationHoldCoroutine': { port: 'holdPhase', mod: 'eotbBody.js' },   // EOTB-IL: the draw then the held last frame (holdDrawFrames)
  'PlayerBillboard::PlayAnimationPingPongCoroutine': { port: 'pingPongFrames', mod: 'eotbBillboard.js' },   // EOTB-IL: forward while i < n/2 + offset, then down to 1 (pingPongTickFrames ticks)
  'PlayerBillboard::GetMeleeAnimTickTime': { port: 'meleeAnimTickTime', mod: 'eotbBillboard.js' },   // EOTB-IL: animTime * 5 / frames
  'PlayerBillboard::UpdateBillboard': { port: 'updateBillboard', mod: 'eotbBody.js' },   // EOTB-IL: the frame/orientation/table write the batch reads
  'PlayerBillboard::UpdateBillboardDelayed': { port: 'updateBillboardDelayed', mod: 'eotbBody.js' },
  'PlayerBillboard::UpdateBillboardDelayedCoroutine': { port: 'runDelayed', mod: 'eotbBody.js' },   // EOTB-IL: the three-frame queue (DELAYED_FRAMES)
  'PlayerBillboard::AssignMeshAndMaterial': { port: null, why: 'no twin: Unity mesh/material handling. The renderer’s billboard batch is the mesh.' },
  'PlayerBillboard::UpdateMaterial': { port: 'material', mod: 'eotbBody.js' },   // EOTB-IL: invisible / shade / blending by the concealment flags (MATERIAL)
  'PlayerBillboard::MakeBillboardMaterial': { port: null, why: 'no twin: Unity mesh/material handling.' },
  'PlayerBillboard::Initialize': { port: 'initialize', mod: 'eotbBody.js' },   // EOTB-IL: states, textures, footsteps, died cleared
  'PlayerBillboard::get_IsReady': { port: null, why: 'no twin: "my transform has a parent". The port’s ready() is its own law - the first sprite has decoded.' },
  'PlayerBillboard::Awake': { port: null, why: 'no twin: Unity lifecycle.' },
  'PlayerBillboard::Update': { port: 'update', mod: 'eotbBody.js' },   // EOTB-IL: the death door, the loop, the footstep frames
  'PlayerBillboard::LateUpdate': { port: 'lateUpdate', mod: 'eotbBody.js' },   // EOTB-IL: the camera read, the orientation, the placement, the material
  'PlayerBillboard::FixedUpdate': { port: null, why: 'no twin: the TravelOptions hook (fast travel’s own clock), which the port does not carry.' },
  'PlayerBillboard::OnLoad': { port: 'initialize', mod: 'eotbBody.js' },   // EOTB-IL: InitializeStates on the loaded game (IL_2abc-IL_2ac6) - the tables and `died` rebuilt

  // ── PlayerBillboardState (1) ────────────────────────────────────
  'PlayerBillboardState::InitializeTextures': { port: 'preload', mod: 'eotbBody.js' },   // EOTB-IL: every orientation and frame of a state, keyed off the bundle (TABLE_FRAMES is the frame count the IL loops)
};

const PORTED = Object.entries(IL).filter(([, v]) => v.port);
const NOT = Object.entries(IL).filter(([, v]) => !v.port);

test('AUDIT-EOTB scope: the inventory is whole, and every row has a verdict', () => {
  assert.equal(Object.keys(IL).length, 61, 'the 61 authored methods, all of them');
  const per = {};
  for (const k of Object.keys(IL)) {
    const [type] = k.split('::');
    per[type] = (per[type] ?? 0) + 1;
  }
  assert.deepEqual(per, { EyeOfTheBeholder: 28, PlayerBillboard: 32, PlayerBillboardState: 1 });
  for (const [k, v] of Object.entries(IL)) {
    if (v.port) assert.ok(v.mod, `${k} claims a port, so it must name the module`);
    else assert.match(v.why ?? '', /^no twin/, `${k} claims no port, so it must say why - and EOTB-IL leaves nothing NOT DONE`);
  }
  // EOTB-IL: there is one evidence class now. A row marked otherwise
  // is a reading made without the assembly, and the assembly is here.
  for (const [k, v] of PORTED) assert.equal(v.evidence, undefined, `${k}: every port is read off the IL`);
  assert.equal(PORTED.length, 45, 'forty-five of sixty-one');
  assert.equal(NOT.length, 16, 'sixteen with no twin here');
});

test('EOTB-IL scope: the table is checked AGAINST THE DUMP - every row is an authored method, and no authored method is missing', () => {
  assert.ok(existsSync(join(root, IL_DUMP)), 'the IL dump is vendored beside the art');
  const dump = rd(IL_DUMP);
  const authored = new Set();
  let lambdas = 0;
  for (const m of dump.matchAll(/^---- (EyeOfTheBeholder|PlayerBillboard|PlayerBillboardState)::(\S+) rva=/gm)) {
    const name = m[2];
    if (/^\.c?ctor$/.test(name)) continue;
    if (/^(add|remove)_/.test(name)) continue;
    if (/^<\w+>b__\d+_\d+$/.test(name)) { lambdas += 1; continue; }
    authored.add(`${m[1]}::${name}`);
  }
  assert.equal(lambdas, 3, 'the three compiler-lifted lambdas, struck');
  // the coroutine state machines are nested types (`<PlayAnimation>d__N`)
  // and never match the three type names above
  const missing = [...authored].filter((k) => !(k in IL));
  const extra = Object.keys(IL).filter((k) => !authored.has(k));
  assert.deepEqual(missing, [], 'authored methods in the dump with no row here');
  assert.deepEqual(extra, [], 'rows here that are not in the dump');
  assert.equal(authored.size, 61);
  // and the assembly itself is beside it
  assert.ok(existsSync(join(root, 'vendor/eye-of-the-beholder/Eye Of The Beholder.dll')), 'the assembly is vendored');
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
  // the arc continues: port `SpawnBillboard` and `spawnBillboard`
  // appears, this reddens, and whoever ported it must move the row.
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
    // the generic Unity names (Awake, Init, FixedUpdate...) would collide
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
  assert.ok(arc.length >= 5, 'the arc has its five modules');

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
    'eotbSprite.js:tableKeys': 'what a pre-load would fetch per table; the body’s preload walks TABLE_FRAMES itself, so nothing asks for a whole table by key. A pin drives it.',
    'eotbCamera.js:OVERRIDE_ORDER': 'the three override sections’ precedence, spelled once so posOffset’s arm order can be read against it.',
    'eotbBillboard.js:TURN_TO_VIEW': 'Graphics.TurnToView’s four labels by index, for the pane and the pins; facingFor reads the number.',
    'eotbBillboard.js:ATTACK_STRINGS': 'Graphics.AttackStrings’s four labels by index, for the pane and the pins; STRING is the number the laws read.',
  };
  assert.deepEqual(dead.sort(), Object.keys(ALLOWED).sort(),
    'every export the arc calls from nowhere is named here, with why');
  for (const [k, why] of Object.entries(ALLOWED)) {
    assert.ok(why.length > 40, `${k}: a reason, not a shrug`);
  }
});

test('AUDIT-EOTB scope: the bible page states THIS table, and no record says 1:1 as a claim', () => {
  const page = rd('bible/06-Systems/Eye-Of-The-Beholder.md');
  assert.match(page, /\*\*61 authored methods\*\*/, 'the page states the inventory this table holds');
  assert.match(page, /\*\*forty-five\b/i, 'and how many of them are ported');
  assert.match(page, /\*\*sixteen\b/i, 'and how many have no twin');
  assert.match(page, /test\/eotb_scope\.test\.js/, 'and points at this file');

  // Every IL name the page's no-twin list mentions must be a row
  // here with no port - so the prose cannot drift from the table.
  const section = page.split(/\*\*Sixteen (?:have )?no twin\*\*/)[1]?.split('\n## ')[0] ?? '';
  assert.ok(section.length > 200, 'the page carries the list');
  const named = [...section.matchAll(/`([A-Za-z_][\w]*)`/g)].map((m) => m[1]);
  assert.ok(named.length >= 10, 'and names methods in it');
  const notNames = new Set(NOT.map(([k]) => k.split('::')[1]));
  const portedNames = new Set(PORTED.map(([k]) => k.split('::')[1]));
  for (const n of named) {
    if (portedNames.has(n) && !notNames.has(n)) assert.fail(`the page lists ${n} as having no twin, but the table says it IS ported`);
  }
  assert.ok(named.some((n) => notNames.has(n)), 'and at least some are real rows');

  // AND THE CLAIM ITSELF. Six records said 1:1 before the assembly was
  // read. It is read now, and every law is pinned against it - but a
  // sentence saying "1:1" is still only as good as the table above, so
  // a record may say it only beside the thing that checks it.
  for (const f of ['bible/06-Systems/Eye-Of-The-Beholder.md', 'bible/01-Overview/Mod-Registry.md',
    'vendor/eye-of-the-beholder/README.md']) {
    const s = rd(f);
    for (const line of s.split('\n')) {
      if (!/1:1/.test(line)) continue;
      if (!/eye of the beholder|eotb/i.test(line)) continue;
      assert.match(line, /not|never|until|called itself|was called|checkable|eotb_scope|forty-five|no twin|IL/i,
        `${f}: a 1:1 claim for this mod must carry its check, not stand alone - "${line.trim()}"`);
    }
  }
});
