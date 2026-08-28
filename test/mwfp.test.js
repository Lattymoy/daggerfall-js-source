import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mwWeaponClass,
  mwSegmentForState,
  mwAnimForState,
  mwSegmentWindow,
  MW_WEAPON_MESH,
  MW_WEAPON_BONE,
} from '../src/combat/mwFpArms.js';
import { WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { mwFpEnabled } from '../src/combat/mwFpPref.js';
import { parseAnimGroups } from '../src/formats/mwAnim.js';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('mwfp: engine weapon types land in the right Morrowind class', () => {
  assert.equal(mwWeaponClass(WEAPON_TYPES.LongBlade), 'onehand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Dagger_Magic), 'onehand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Mace), 'onehand');
  // MWAUDIT: these three are Morrowind's two-handed WIDE weapons, not
  // its close ones. MW splits weapontwohand/idle2c (two-handed long
  // blades) from weapontwowide/idle2w (axes, war hammers, staves), and
  // an axe swung on the close grip is the wrong animation. They were
  // all mapped to 'twohand', which is why the module's own header
  // listed Idle2w among its idle groups while nothing ever asked for
  // it. INFERRED from MW's taxonomy - see the note at the mapping.
  assert.equal(mwWeaponClass(WEAPON_TYPES.Warhammer), 'twowide');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Battleaxe_Magic), 'twowide');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Staff), 'twowide');
  // ...and NO Daggerfall type reaches the close grip, because
  // weaponTypeForItem folds Claymore and Dai-Katana into LongBlade
  // beside Broadsword - Daggerfall draws no separate two-handed blade.
  const all = Object.values(WEAPON_TYPES);
  assert.equal(all.filter((t) => mwWeaponClass(t) === 'twohand').length, 0,
    'the close grip is unreachable from Daggerfall art, and the row says so');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Bow), 'bow');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Melee), 'handtohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Werecreature), 'handtohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.None), 'none');
});

test('mwfp: six classic swing directions fold onto MW three', () => {
  assert.equal(mwSegmentForState('StrikeDown'), 'chop');
  assert.equal(mwSegmentForState('StrikeDownLeft'), 'chop');
  assert.equal(mwSegmentForState('StrikeDownRight'), 'chop');
  assert.equal(mwSegmentForState('StrikeLeft'), 'slash');
  assert.equal(mwSegmentForState('StrikeRight'), 'slash');
  assert.equal(mwSegmentForState('StrikeUp'), 'thrust');
  assert.equal(mwSegmentForState('Idle'), null);
});

test('mwfp: the full decision - idle groups per class, attack group + segment', () => {
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.LongBlade, 'Idle'), {
    group: 'Idle1h',
    segment: null,
  });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.LongBlade, 'StrikeUp'), {
    group: 'WeaponOneHand',
    segment: 'thrust',
  });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.Warhammer, 'StrikeDown'), {
    group: 'WeaponTwoWide',
    segment: 'chop',
  });
  // the bow asks for its OWN idle now; idleFallback reaches Idle1h for
  // a file that does not carry one, which is what the chain is for
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.Bow, 'Idle'), { group: 'IdleBow', segment: null });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.Melee, 'StrikeLeft'), {
    group: 'HandToHand',
    segment: 'slash',
  });
  // Bare hands never resolve an attack group they don't have.
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.None, 'StrikeDown'), {
    group: 'Idle',
    segment: null,
  });
});

test('mwfp: segment windows read the group sub-markers, retail marker shapes', () => {
  const groups = parseAnimGroups([
    { time: 0, text: 'WeaponOneHand: Start' },
    { time: 0.1, text: 'WeaponOneHand: Chop Start' },
    { time: 0.3, text: 'WeaponOneHand: Chop Min Attack' },
    { time: 0.5, text: 'WeaponOneHand: Chop Max Attack' },
    { time: 0.7, text: 'WeaponOneHand: Chop Hit' },
    { time: 0.9, text: 'WeaponOneHand: Chop Follow Stop' },
    { time: 1.0, text: 'WeaponOneHand: Slash Start' },
    { time: 1.4, text: 'WeaponOneHand: Slash Hit' },
    { time: 2.0, text: 'WeaponOneHand: Stop' },
  ]);
  const g = groups.get('WeaponOneHand');
  assert.deepEqual(mwSegmentWindow(g, 'chop'), { start: 0.1, stop: 0.9 });
  // Partial marker sets fall back honestly: no follow -> hit ends it.
  assert.deepEqual(mwSegmentWindow(g, 'slash'), { start: 1.0, stop: 1.4 });
  // A segment the group never carries is null, not a guess.
  assert.equal(mwSegmentWindow(g, 'thrust'), null);
  assert.equal(mwSegmentWindow(null, 'chop'), null);
});

test('mwfp: the iron weapon-mesh table covers every drawable type; bone name fixed', () => {
  const drawable = Object.values(WEAPON_TYPES).filter(
    (t) => t !== WEAPON_TYPES.None && t !== WEAPON_TYPES.Melee && t !== WEAPON_TYPES.Werecreature,
  );
  for (const t of drawable) {
    assert.match(MW_WEAPON_MESH[t], /^meshes\\w\\w_/, `type ${t}`);
  }
  assert.equal(MW_WEAPON_BONE, 'weapon bone');
});

test('mwfp: the attach door is FINDABLE - settings row, its key, the one bootstrap', () => {
  // A feature reachable only by typing a query param is a feature nobody
  // finds - the M-EXT lesson, applied to the third domain. The dialog
  // reports the attachment, the button is labelled with its key, the key
  // is handled, the click path dispatches by BUTTON ID (three optional
  // picks broke the old index arithmetic), and registration rides the
  // one bootstrap all four hosts already call.
  const w = src('ui/settingsWindow.js');
  assert.match(w, /Morrowind archives attached: \$\{morrowindDataCount\(\)\}/);
  assert.match(w, /label: 'M - Morrowind'/, 'the button says which key');
  assert.match(w, /code === 'KeyM' && this\.dialog\.onAlt2/);
  assert.match(w, /b\.id === 'pickMw' && d\.onAlt2/);
  assert.match(src('scenes/shared.js'), /const morrowind = registerMorrowindData\(\)\.catch\(\(\) => 0\);/);
  assert.match(src('scenes/launcherScene.js'), /pickMorrowindFiles/);
  // The store never sweeps with ARENA2 recovery, and archives open in
  // engine override order - expansions answer before Morrowind.bsa.
  const d = src('scenes/dataSource.js');
  assert.match(d, /if \(l\.includes\('morrowind'\)\) return 3;/);
  assert.match(d, /return 0; \/\/ unknown packs override everything/);
});

test('mwfp: ON BY DEFAULT - the precedence matrix', () => {
  // Attaching Morrowind data IS the opt-in; with data present the 3D
  // viewmodel draws unless turned off. Query overrides preference
  // overrides the default-true.
  assert.equal(mwFpEnabled('', null), true);
  assert.equal(mwFpEnabled('', '0'), false);
  assert.equal(mwFpEnabled('', '1'), true);
  assert.equal(mwFpEnabled('?mwfp=0', '1'), false);
  assert.equal(mwFpEnabled('?mwfp=1', '0'), true);
  assert.equal(mwFpEnabled('?other=x', '0'), false);
  // The toggle sits beside the attach, labelled with its key, handled,
  // and in the id dispatch.
  const w = src('ui/settingsWindow.js');
  assert.match(w, /label: 'F - 3D toggle'/);
  assert.match(w, /code === 'KeyF' && this\.dialog\.onAlt3/);
  assert.match(w, /b\.id === 'fpToggle' && d\.onAlt3/);
  assert.match(w, /3D first-person \(with Morrowind data\)/);
});

// ── MWAUDIT: the fallback chain, and the teardown ──────────────────

test('MWAUDIT: a missing group falls back to an idle - it never freezes in the bind pose', () => {
  // THE DEFECT: every group lookup was a hard exact-case get, and every
  // miss returned null from pick(). update() then set `playing = null`
  // and draw() renders t=0 - so a rig that could not find its group
  // stood in its BIND POSE while active() still answered true. The
  // player got frozen 3D arms where the classic sprite would have been
  // correct. The chain is: the asked-for group, the class idle, any
  // idle, then whatever the file carries.
  const src = readFileSync(new URL('../src/combat/mwFpArms.js', import.meta.url), 'utf8');
  assert.match(src, /function idleFallback\(weaponType\) \{/, 'the chain has a home');
  assert.match(src, /for \(const name of \[wanted, 'Idle1h', 'Idle'\]\)/, 'class idle, then a generic one');
  assert.match(src, /const first = groups\.entries\(\)\.next\(\)\.value;/, 'then whatever the file does carry');
  // a swing with no clip stands in the idle rather than freezing mid-strike
  assert.match(src, /the swing has no clip here - stand in the class idle rather/, 'the striking arm falls back too');
  // and every lookup goes through the case-insensitive door
  // CODE only - the comment above the fix quotes the old call to say
  // what it replaced, and a pin that reads prose is testing the wrong
  // thing (the same trap the MWFIX swing pin hit).
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/groups\.get\(/.test(code), 'no raw exact-case group lookups survive');
  assert.match(src, /findAnimGroup\(groups, want\.group\)/, 'the wanted group');
  assert.match(src, /findAnimGroup\(groups, forced\)/, 'and the probe override');
});

test('MWAUDIT: the view hands its GL back - a rebuild must not leak the old one', () => {
  // Nothing ever disposed this view because it was built once per rig
  // and the process outlived it. MWFIX made the rig REBUILD on attach
  // and on toggle, which turned "no teardown" into a leak per press:
  // a texture per material, a VAO and four buffers per batch, and the
  // stream texture on the GAME's own context.
  // CODE only, again: a source pin that reads comments passes against
  // the very line commented OUT, which is the mutation it exists to
  // catch. (Proven: commenting out the streamTex delete did not fail
  // this test until the filter went in.)
  const raw = readFileSync(new URL('../src/combat/mwFpArms.js', import.meta.url), 'utf8');
  const src = raw.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.match(src, /view\.dispose = \(\) => \{/, 'the view has a teardown');
  assert.match(src, /if \(disposed\) return;/, 'idempotent - a double dispose would delete recycled names');
  assert.match(src, /view\.ready = false;/, 'and active() answers false the instant it is dropped');
  assert.match(src, /for \(const t of texCache\.values\(\)\) if \(t\) gl\.deleteTexture\(t\);/, 'material textures');
  assert.match(src, /gl\.deleteVertexArray\(geo\.vao\)/, 'the VAOs');
  assert.match(src, /for \(const b of \[geo\.pos, geo\.nrm, geo\.uv, geo\.idx\]\)/, 'ALL FOUR buffers - the uv one was never even kept before');
  assert.match(src, /mainGl\.deleteTexture\(streamTex\);/, "and the stream texture on the GAME's context");
  // the inert stub takes the same call, so a caller never has to ask which it holds
  assert.match(src, /const inert = \{ active: \(\) => false, update: \(\) => \{\}, draw: \(\) => \{\}, dispose: \(\) => \{\}/,
    'the inert view answers dispose too');
});

test('MWAUDIT: ready means POSEABLE, and the KF cannot erase the base\'s groups', () => {
  const raw = readFileSync(new URL('../src/combat/mwFpArms.js', import.meta.url), 'utf8');
  const src = raw.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // geometry with no playable group used to count as ready, which is
  // the bind-pose freeze wearing a different hat: the layer draws,
  // badly, where the sprite path was correct.
  assert.match(src, /view\.ready = skinnedSets\.length > 0 && groups\.size > 0;/,
    'both halves are required');
  assert.match(src, /'no animation groups - the sprite path stands'/,
    'and the status says WHICH half is missing');
  // retail's xbase_anim.1st.kf carries tracks AND keys, so the swap is
  // normally straight - but a KF with tracks and no keys used to
  // replace the base's groups with an empty map
  assert.match(src, /if \(kfGroups\.size\) groups = kfGroups;/,
    'the groups follow the tracks only if the KF actually has any');
});
