// A1: the audio layer's pure parts - PCM conversion, clip constants
// vs DFU SoundClips.cs, swing/hit selection verbatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pcm8ToFloat32, QuestAudioSource, AudioEngine } from '../src/systems/audio.js';
import { readFileSync } from 'node:fs';
import { SOUND, swingSoundFor, hitSoundFor } from '../src/systems/soundClips.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('audio: pcm8 -> float32 verbatim (b - 128) / 128', () => {
  const f = pcm8ToFloat32(new Uint8Array([0, 128, 255, 64]));
  assert.equal(f[0], -1);
  assert.equal(f[1], 0);
  assert.ok(Math.abs(f[2] - 127 / 128) < 1e-9);
  assert.equal(f[3], -0.5);
});

test('audio: SoundClips indices verbatim from SoundClips.cs', () => {
  assert.equal(SOUND.DungeonDoorOpen, 25);
  assert.equal(SOUND.DungeonDoorClose, 24);
  assert.equal(SOUND.NormalDoorOpen, 94);
  assert.equal(SOUND.SwingLowPitch, 105);
  assert.equal(SOUND.SwingHighPitch, 106);
  assert.equal(SOUND.SwingMediumPitch, 347);
  assert.equal(SOUND.Hit1, 108);
  assert.equal(SOUND.Hit2, 109);
  assert.equal(SOUND.Parry6, 433);
  assert.equal(SOUND.ArrowShoot, 3);
  assert.equal(SOUND.None, -1);   // SoundClips.cs:24, and no valid DAGGER.SND index
});

test('audio: GetSwingSound pitch table + PlayHitSound families verbatim', () => {
  // AUDIT 39: the table keys on the TEMPLATE INDEX, which is what
  // DaggerfallUnityItem.cs:878-908 switches on. It used to key on
  // `weapon.name`, and a name is not the template: loot.
  // createRegularMagicItem renames an enchanted weapon to its MAGIC.DEF
  // name and itemTemplates.json spells 123 "Dai-katana", so this pin
  // moved from names to indices with the law.
  const w = (templateIndex, name = 'anything') => ({ templateIndex, name });
  assert.equal(swingSoundFor(w(126)), SOUND.SwingLowPitch, 'Warhammer');
  assert.equal(swingSoundFor(w(123)), SOUND.SwingLowPitch, 'Dai-Katana');
  assert.equal(swingSoundFor(w(120)), SOUND.SwingMediumPitch, 'Longsword');
  assert.equal(swingSoundFor(w(117)), SOUND.SwingMediumPitch, 'Wakazashi - MEDIUM in the source');
  assert.equal(swingSoundFor(w(113)), SOUND.SwingHighPitch, 'Dagger');
  assert.equal(swingSoundFor(w(130)), SOUND.ArrowShoot, 'a bow looses instead (:900-902)');
  assert.equal(swingSoundFor(null), SOUND.SwingHighPitch);                      // barehanded (SetMelee)
  // A MAGIC.DEF rename keeps the template, and now keeps the pitch.
  assert.equal(swingSoundFor({ templateIndex: 121, name: 'Wabbajack' }), SOUND.SwingLowPitch,
    'a renamed enchanted Katana is still a Katana');
  // DFU's `default:` is SoundClips.None - a swing table entry that does
  // not exist rings nothing rather than falling to the medium pitch.
  assert.equal(swingSoundFor({ templateIndex: 131, name: 'Arrow' }), SOUND.None);
  // weapon: Hit1 + [0,5) - boundaries
  assert.equal(hitSoundFor({ name: 'Dagger' }, seq(0)), 108);
  assert.equal(hitSoundFor({ name: 'Dagger' }, seq(0.999)), 112);
  // barehanded: Hit1 + [2,4)
  assert.equal(hitSoundFor(null, seq(0)), 110);
  assert.equal(hitSoundFor(null, seq(0.999)), 111);
});

test('AUDIT 39: a registered clip is decoded from the VIEW\'s range, not the whole archive', async () => {
  const { decodableCopy } = await import('../src/systems/audio.js');
  const { readFileSync } = await import('node:fs');
  // MwBsaFile.get returns a zero-copy subarray of the ARCHIVE buffer, so
  // `bytes.buffer.slice(0)` - what this used to be - handed the decoder
  // the whole .bsa: every clip served out of an archive failed to decode
  // behind registerSound's bare catch, after allocating a copy of the
  // archive per attempt.
  const archive = new Uint8Array([9, 9, 9, 1, 2, 3, 4, 9, 9]);
  const view = archive.subarray(3, 7);
  const copy = decodableCopy(view);
  assert.deepEqual([...new Uint8Array(copy)], [1, 2, 3, 4], 'the clip, not the archive');
  assert.equal(copy.byteLength, 4);
  // A plain ArrayBuffer is passed through - decodeAudioData detaches it,
  // which is the only reason a view is copied at all.
  const raw = new ArrayBuffer(8);
  assert.equal(decodableCopy(raw), raw);

  // Both decode doors take the same slice.
  const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  for (const f of ['src/systems/audio.js', 'src/systems/music.js']) {
    assert.ok(read(f).includes('decodeAudioData(decodableCopy(bytes))'), `${f} slices the view`);
    assert.ok(!read(f).includes('decodeAudioData(bytes.buffer'), `${f} must not slice from offset zero`);
  }
});

test('audio: enemy sound columns restored (rat/imp verbatim rows)', async () => {
  const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
  assert.equal(ENEMY_BASICS['0'].moveSound, 115);     // EnemyRatMove
  assert.equal(ENEMY_BASICS['0'].barkSound, 116);
  assert.equal(ENEMY_BASICS['0'].attackSound, 117);
  assert.equal(ENEMY_BASICS['1'].moveSound, 118);     // EnemyImpMove
  const withSounds = Object.values(ENEMY_BASICS).filter((e) => e.moveSound !== undefined).length;
  assert.equal(withSounds, 61);
});

test('audio: A2 ambient-source data verbatim (torches, animals, action sounds)', async () => {
  const {
    TORCH_ARCHIVE, TORCH_RECORDS, TORCH_MAX_DISTANCE, TORCH_VOLUME,
    ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD, ANIMAL_MAX_DISTANCE, AMBIENT_RANDOM_PLAY_MAX,
  } = await import('../src/systems/soundClips.js');
  // RDBLayout.IsTorchFlat: 210 / {0,1,6,16..20}; 5m linear, 0.7
  assert.equal(TORCH_ARCHIVE, 210);
  assert.deepEqual([...TORCH_RECORDS].sort((a, b) => a - b), [0, 1, 6, 16, 17, 18, 19, 20]);
  assert.equal(TORCH_MAX_DISTANCE, 5);
  assert.equal(TORCH_VOLUME, 0.7);
  assert.equal(SOUND.Burning, 420);
  // GameObjectHelper.AddAnimalAudioSource: 201, record pairs -> clip
  assert.equal(ANIMALS_ARCHIVE, 201);
  assert.equal(ANIMAL_SOUND_BY_RECORD[0], 99);    // horse
  assert.equal(ANIMAL_SOUND_BY_RECORD[1], 99);
  assert.equal(ANIMAL_SOUND_BY_RECORD[3], 103);   // cow
  assert.equal(ANIMAL_SOUND_BY_RECORD[5], 102);   // pig
  assert.equal(ANIMAL_SOUND_BY_RECORD[8], 101);   // cat
  assert.equal(ANIMAL_SOUND_BY_RECORD[10], 100);  // dog
  assert.equal(ANIMAL_SOUND_BY_RECORD[2], undefined);   // gap records stay silent
  assert.ok(Math.abs(ANIMAL_MAX_DISTANCE - 19.2) < 1e-9);   // 768 * GlobalScale
  assert.equal(AMBIENT_RANDOM_PLAY_MAX, 100);     // DFRandom.rand() <= 100 per classic update
});

test('audio: A2 the action Play sound seam - soundIndex > 0 fires from the object', async () => {
  const { ActionSystem } = await import('../src/world/actionSystem.js');
  const { ACTION_FLAGS } = await import('../src/world/rdbLayout.js');
  const c = { addMesh() {}, removeBucket() {}, raycast: () => Infinity };
  const a = new ActionSystem(c);
  const played = [];
  a.onActionSound = (o) => played.push([o.index, o.origin ?? [o.matrix[12], o.matrix[13], o.matrix[14]]]);
  // an effect action with soundIndex 12 speaks from its origin
  const eff = a.addEffect(0, 1, { actionFlag: ACTION_FLAGS.Poison, index: 12, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1 }, [3, 4, 5]);
  a.receive(eff);
  // a mover with soundIndex 3 speaks from its (base) matrix
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1]);
  const mover = a.addAction(0, 2, { positions: new Float32Array(3), indices: new Uint32Array(0) }, I, {
    index: 3, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: -1, triggerFlag: 0x02 });
  a.activate(mover.key);
  // index 0 stays silent (DFU: PlaySound && Index > 0)
  const silent = a.addEffect(0, 3, { actionFlag: ACTION_FLAGS.Poison, index: 0, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1 }, [0, 0, 0]);
  a.receive(silent);
  assert.deepEqual(played, [[12, [3, 4, 5]], [3, [7, 8, 9]]]);
});


// ═══ E6: the quest machine's own audio source ═══════════════════════

test('E6: the quest DaggerfallAudioSource is BUSY until the clip it started ends', () => {
  // DaggerfallAudioSource.IsPlaying (:244-247) is `audioSource
  // .isPlaying`; a WebAudio one-shot has no such flag, so the source
  // keeps the end time of the clip playOneShot reported.
  let t = 0;
  const played = [];
  const engine = { playOneShot: (i) => { played.push(i); return i === 999 ? undefined : 0.5; } };
  const src = new QuestAudioSource(engine, () => t);
  assert.equal(src.isPlaying(), false, 'a source that has played nothing is idle');
  assert.equal(src.playOneShot(386), 0.5, 'PlayOneShot answers the clip length');
  assert.equal(src.isPlaying(), true, 'busy for exactly the clip');
  t = 0.49;
  assert.equal(src.isPlaying(), true);
  t = 0.5;
  assert.equal(src.isPlaying(), false, 'the clip ran out');
  // A clip that never started leaves the source idle, exactly as Unity's
  // does when SoundReader.GetAudioClip answers null (:192-197).
  t = 1;
  src.playOneShot(999);
  assert.equal(src.isPlaying(), false);
  assert.deepEqual(played, [386, 999]);
});

test('E6: the world host reads that busy state as PlaySound.cs:110-116 does', () => {
  // The host cannot boot headless, so the wiring is source-pinned - the
  // shape is `if (source.IsPlaying()) skip; else { PlayOneShot; stamp }`,
  // over the ONE source the QuestMachine carries (PlaySound.cs:112).
  // AUDIT 58: and the value it plays goes through the ID door, because
  // the Quests-Sounds `id` column is a DAGGER.SND record ID.
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /const questAudioSource = new QuestAudioSource\(audio\);/,
    'one source, minted beside the quest bridge');
  assert.match(w, /playSound: \(id\) => \{\n\s+if \(questAudioSource\.isPlaying\(\)\) return false;\n\s+questAudioSource\.playOneShotId\(id\);\n\s+return true;\n\s+\},/,
    'busy skips without stamping; idle plays and stamps, through the ID door');
  // ...and its twin in the other host that owns a quest machine. The
  // dungeon and interior hosts have no source of their own - they are
  // handed world.js's / exterior.js's bridge (opts.questBridge).
  const x = readFileSync('src/scenes/exterior.js', 'utf8');
  assert.match(x, /playSound: \(id\) => \{\n\s+if \(_questAudioSource\.isPlaying\(\)\) return false;\n\s+_questAudioSource\.playOneShotId\(id\);\n\s+return true;\n\s+\},/,
    'the fixed-city host plays the same id the same way');
  assert.equal((w + x).includes('questAudioSource.playOneShot(id)'), false,
    'neither host may spend a table id as a record index');
});


// ═══ AUDIT 58: THE ID DOOR ══════════════════════════════════════════
// SoundReader.GetSoundIndex (SoundReader.cs:152-158) is
// `soundFile.GetRecordIndex(soundID)`. DaggerfallAudioSource carries
// TWO overloads of every entry point for exactly that reason - one
// taking an INDEX (:186-198) and one taking an ID (:232-238, and
// SetSound's pair at :154/:174) - so a caller's `(uint)` cast is a
// load-bearing choice, not a widening. Everything DFU names
// `...SoundID` comes through the ID door; everything typed SoundClips
// does not.

/** A DAGGER.SND-shaped NumberRecord archive: ids in DFU's own order,
 *  where the id is deliberately NOT the index (real DAGGER.SND is the
 *  same shape - test/snd.test.js pins index 0 -> id 3, id 6 -> index 3). */
function sndWithIds(ids) {
  const bytes = new Uint8Array([128, 129, 127, 128]);
  const out = new Uint8Array(4 + ids.length * (bytes.length + 8));
  const view = new DataView(out.buffer);
  view.setInt16(0, ids.length, true);
  view.setUint16(2, 0x0200, true);   // DIRECTORY_TYPES.NumberRecord
  let pos = 4;
  for (let i = 0; i < ids.length; i++) { out.set(bytes, pos); pos += bytes.length; }
  for (const id of ids) { view.setUint32(pos, id, true); view.setInt32(pos + 4, bytes.length, true); pos += 8; }
  return out;
}

test('AUDIT 58: the engine resolves a sound ID to its record INDEX before playing', async () => {
  const { SndFile } = await import('../src/formats/sndFile.js');
  const snd = new SndFile();
  // ids 3, 349, 6 - so id 349 lives at INDEX 1 and id 6 at INDEX 2
  assert.equal(snd.load(sndWithIds([3, 349, 6])), true);
  assert.equal(snd.getRecordIndex(349), 1, 'the archive numbers records independently of its order');

  const e = new AudioEngine();
  e.snd = snd;
  const flat = []; const spatial = [];
  e.playOneShot = (i, v, p) => { flat.push([i, v, p]); return 0.25; };
  e.play3d = (i, pos, v, o) => { spatial.push([i, pos, v, o]); return 0.25; };

  assert.equal(e.soundIndexForId(349), 1, 'GetSoundIndex');
  e.playOneShotId(349, 1);
  e.play3dId(6, [1, 2, 3], 1, { maxDistance: 16 });
  assert.deepEqual(flat, [[1, 1, undefined]], 'the ID overload plays the INDEX it resolved');
  assert.deepEqual(spatial, [[2, [1, 2, 3], 1, { maxDistance: 16 }]]);

  // an id with no record in the archive plays NOTHING - GetSoundIndex
  // answers -1 and GetAudioClip(-1) is null, which the index overload
  // swallows in silence (the Quests-Sounds table carries ids like
  // `11146, halt` that no archive has).
  e.playOneShotId(11146);
  e.play3dId(11146, [0, 0, 0]);
  assert.equal(flat.length, 1, 'no record, no shot');
  assert.equal(spatial.length, 1);
  assert.equal(e.soundIndexForId(11146), -1);

  // no archive at all is the same silence, not a throw
  const bare = new AudioEngine();
  assert.equal(bare.soundIndexForId(349), -1);
  assert.equal(bare.playOneShotId(349), undefined);
  assert.equal(bare.play3dId(349, [0, 0, 0]), undefined);
});

test('AUDIT 58: the quest source stamps busy off the ID door, not the index one', () => {
  // PlaySound.cs resolves at CREATE (:74-75) and plays the INT overload
  // (:112); the port moved the resolution behind the playSound hook
  // (Port-Ledger A), so the stamp has to ride the ID entry point.
  let t = 0;
  const played = [];
  const engine = {
    playOneShotId: (id) => { played.push(id); return id === 11146 ? undefined : 0.5; },
  };
  const src = new QuestAudioSource(engine, () => t);
  assert.equal(src.playOneShotId(386), 0.5);
  assert.equal(src.isPlaying(), true, 'busy for exactly the clip');
  t = 0.5;
  assert.equal(src.isPlaying(), false);
  // a table id the archive has no record for starts nothing and leaves
  // the source idle - Unity's own null-AudioClip behaviour
  src.playOneShotId(11146);
  assert.equal(src.isPlaying(), false);
  assert.deepEqual(played, [386, 11146]);
});

test('AUDIT 58: every DFU ...SoundID site takes the ID door, and no other site does', () => {
  const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  // EntityEffectManager's five cast constants (:44-48) are IDs, spent
  // through PlayCastSound's `(uint)castSoundID` (:1958).
  assert.match(read('src/scenes/hostMagic.js'),
    /audio\.playOneShotId\(SPELL_CAST_SOUND\[sp\.element\] \?\? SPELL_CAST_SOUND\[4\], 1\)/);
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(read(host), /play3dId\?*\.?\(SPELL_CAST_SOUND\[element\]/, `${host} casts through the ID door`);
  }
  // RDBLayout's action sound: `AddActionAudioSource(go, (uint)action
  // .Index)` (:1075) -> SetSound(uint) (DaggerfallAudioSource.cs
  // :174-182), the only SetSound overload that resolves.
  assert.match(read('src/scenes/dungeonContext.js'), /if \(p\) audio\.play3dId\(o\.index, p\);/);
  // CreateCharRaceSelect.cs:115 - `source.PlayOneShot((uint)selectedRace.ClipID)`
  assert.match(read('src/ui/chargen.js'),
    /audio\.playOneShotId\(RACE_TEMPLATES\[this\.raceIndex\]\?\.clipId, 1\)/);
  // ...and the conversion has ONE home: the DAGGER.SND id->index step
  // is reached only through the engine's own door now (ONE DFU MEMBER,
  // ONE EXPORT). Nothing outside src/systems/audio.js may ask the SND
  // archive for a record index itself - the Arch3dFile lookups that
  // share the member name are a different archive and not this law.
  for (const f of ['src/scenes/hostMagic.js', 'src/scenes/dungeonContext.js',
    'src/scenes/exteriorFoes.js', 'src/ui/chargen.js', 'src/scenes/world.js',
    'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.equal(/snd\??\.\s*getRecordIndex/.test(read(f)), false, `${f} must not resolve sound ids privately`);
  }
  assert.match(read('src/systems/audio.js'), /soundIndexForId\(id\) \{\n\s+return this\.snd\?\.getRecordIndex\(id\) \?\? -1;/,
    'the one home is the engine');
});
