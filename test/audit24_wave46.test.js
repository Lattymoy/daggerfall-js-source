// AUDIT 24, wave 46: the player's side of being hit.
//
// The C2 slice ported the race/gender voice tables whole and wired the
// ENEMY side of them. The player side was never wired at all, so you
// took every hit in the game in silence - and the one player voice
// that DID exist, the attack grunt, was routed through the wrong
// function and had been swapping a male High Elf's voice for a Wood
// Elf's since it shipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatVoice, playerVoice, raceGenderPainSound, raceGenderAttackSound, PAIN_VOICE_CHANCE, isHeavyDamage } from '../src/combat/combatVoices.js';
import { playerPainVoice, playPlayerVoice, playerAttackGrunt } from '../src/scenes/hostCombat.js';
import { RACES } from '../src/systems/races.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const player = (over = {}) => ({ race: 'HighElf', gender: 'male', maxHealth: 40, ...over });
/** rolls() queue, then 0 - so the 40% gate passes by default. */
const scripted = (...v) => { let i = 0; return () => (i < v.length ? v[i++] : 0); };

// Mutation campaign: 20 reintroductions, 20 killed, ZERO equivalents -
// after two rounds, and the first round found more about the PINS than
// about the code. Five survivors and one script bug:
//
//   - the heavy/light fork was pinned on a MALE player, and
//     GetRaceGenderPainSound's male arm returns the race's Pain2
//     whatever the damage. So `heavyDamage: true` hardcoded, and
//     heavyDamage read off CURRENT health, both passed. Pinned on a
//     female now, where the table really does fork.
//   - "the blow cries" was an `assert.ok(...some(line))`, and world.js
//     and dungeonContext.js each have TWO cry sites now (the blow and
//     the arrow). Deleting the blow's line left the arrow's, and the
//     pin stayed green. COUNTED per file now.
//   - the arrow arms' `if (dmg > 0)` gate had no pin at all.
//   - `!(damage > 0)` -> `damage <= 0` was filed as an equivalent and
//     is NOT one: they part company on a NaN, where the first refuses
//     and the second falls through to a NaN heavyDamage. Pinned, and
//     it is a kill.
//   - and the campaign SCRIPT was wrong about one: replacing the first
//     `dice100(PAIN_VOICE_CHANCE, ...)` in hostCombat.js hits
//     enemyPainVoice, which this file does not cover. A mutant aimed
//     at the first match of a shape that appears twice tests the other
//     one. Scoped to playerPainVoice, and it dies.

test('audit24 wave46: the male High Elf swap is the ENEMY\'s handling, and the player is not an enemy', () => {
  // EnemySounds.PlayCombatVoice:159-161 does the swap, and its comment
  // says why: "Male high elf sounds sound odd when coming from NPCs."
  // FPSWeapon.PlayAttackVoice:315 and PlayerFootsteps.RemoveHealth:358
  // both call GetRaceGender*Sound DIRECTLY and never reach it.
  const asEnemy = combatVoice({ race: RACES.HighElf, gender: 'male', isAttack: true, rolls: () => 0 });
  const asPlayer = playerVoice({ race: RACES.HighElf, gender: 'male', isAttack: true, rolls: () => 0 });
  assert.equal(asEnemy.clip, raceGenderAttackSound(RACES.WoodElf, 'male', () => 0), 'the enemy swaps');
  assert.equal(asPlayer.clip, raceGenderAttackSound(RACES.HighElf, 'male', () => 0), 'the player does NOT');
  assert.notEqual(asEnemy.clip, asPlayer.clip, 'and the two really are different clips');

  // the swap is male-only and High-Elf-only, so every other pairing
  // agrees between the two functions - which is why this went unseen
  for (const race of [RACES.Breton, RACES.Redguard, RACES.Nord, RACES.DarkElf, RACES.WoodElf, RACES.Khajiit, RACES.Argonian]) {
    for (const gender of ['male', 'female']) {
      assert.equal(combatVoice({ race, gender, isAttack: true, rolls: () => 0 }).clip,
        playerVoice({ race, gender, isAttack: true, rolls: () => 0 }).clip, `${race}/${gender}`);
    }
  }
  assert.equal(combatVoice({ race: RACES.HighElf, gender: 'female', isAttack: true, rolls: () => 0 }).clip,
    playerVoice({ race: RACES.HighElf, gender: 'female', isAttack: true, rolls: () => 0 }).clip,
    'a FEMALE High Elf is untouched either way');

  // the grunt goes through the player one now
  assert.match(rd('src/scenes/hostCombat.js'), /return playerVoice\(\{\n\s+race: RACES\[playerEntity\.race\]/);
  const grunt = playerAttackGrunt(player(), false, () => 0);
  assert.equal(grunt.clip, raceGenderAttackSound(RACES.HighElf, 'male', () => 0),
    'a male High Elf player grunts as a High Elf');
});

test('audit24 wave46: the pain voice - forty percent, the player\'s own race, heavy at a quarter', () => {
  assert.equal(PAIN_VOICE_CHANCE, 40);

  // the roll: 39 < 40 fires, 40 does not
  assert.ok(playerPainVoice(player(), 5, () => 0.39), '39 < 40');
  assert.equal(playerPainVoice(player(), 5, () => 0.40), null, '40 is not < 40');

  // no damage, no cry - DFU only reaches RemoveHealth on a landed blow
  assert.equal(playerPainVoice(player(), 0, () => 0), null);
  assert.equal(playerPainVoice(player(), -3, () => 0), null);
  // `!(damage > 0)` and `damage <= 0` part company on a NaN, and a
  // damage formula that has divided by something can hand one over.
  // The gate must refuse it, not fall through to a NaN heavyDamage.
  assert.equal(playerPainVoice(player(), NaN, () => 0), null, 'NaN is not damage');
  assert.equal(playerPainVoice(player(), undefined, () => 0), null);

  // heavyDamage = amount >= MaxHealth / 4, the PLAYER's max
  assert.equal(isHeavyDamage(10, 40), true, '10 >= 40/4');
  assert.equal(isHeavyDamage(9, 40), false);
  // The heavy/light fork must be pinned on a FEMALE. GetRaceGenderPainSound's
  // male arm returns the race's Pain2 whatever the damage - so a male
  // player cannot tell the two apart, and a pin written with one
  // passes against `heavyDamage: true` hardcoded. (It did.)
  assert.equal(raceGenderPainSound(RACES.HighElf, 'male', true, () => 0),
    raceGenderPainSound(RACES.HighElf, 'male', false, () => 0), 'the male table ignores it');
  const fem = (maxHealth) => player({ race: 'Breton', gender: 'female', maxHealth });
  const heavy = playerPainVoice(fem(40), 10, scripted(0, 0));
  const light = playerPainVoice(fem(40), 9, scripted(0, 0));
  assert.equal(heavy.clip, raceGenderPainSound(RACES.Breton, 'female', true, () => 0));
  assert.equal(light.clip, raceGenderPainSound(RACES.Breton, 'female', false, () => 0));
  assert.notEqual(heavy.clip, light.clip, 'and the female table really does fork');
  // it reads MAX health, not current - a player at 5 hp taking 9 is
  // not taking heavy damage, they are taking nine
  const hurt = player({ race: 'Breton', gender: 'female', maxHealth: 40, health: 5 });
  assert.equal(playerPainVoice(hurt, 9, scripted(0, 0)).clip, light.clip, 'MaxHealth, not Health');

  // the player's OWN race and gender, not a rolled voice race
  const argonianF = playerPainVoice(player({ race: 'Argonian', gender: 'female', maxHealth: 100 }), 50, scripted(0, 0));
  assert.equal(argonianF.clip, raceGenderPainSound(RACES.Argonian, 'female', true, () => 0));

  // and the 0..0.3 pitch lift rides along
  const v = playerPainVoice(player(), 5, scripted(0, 0.5));
  assert.ok(v.pitchLift >= 0 && v.pitchLift <= 0.3);

  // the play seam: one shot, and a clip of -1 (a race with no entry)
  // plays nothing rather than SoundClips[-1]
  const heard = [];
  const audio = { playOneShot: (c, v2) => heard.push([c, v2]) };
  assert.equal(playPlayerVoice(audio, { clip: 405, pitchLift: 0.1 }), 405);
  assert.deepEqual(heard, [[405, 1]]);
  assert.equal(playPlayerVoice(audio, { clip: -1 }), null, 'no clip, no play');
  assert.equal(playPlayerVoice(audio, null), null);
  assert.equal(heard.length, 1);
  assert.doesNotThrow(() => playPlayerVoice(null, { clip: 1 }), 'a host with no audio');
});

test('audit24 wave46: a fall flashes the screen and does NOT make you cry out', () => {
  // The distinction is real in the source, not an oversight in the
  // port. Both hang off RemoveHealth, but Unity's SendMessage reaches
  // every component while a direct C# call reaches one:
  //   EnemyAttack:406 and DaggerfallAction:739/:768 SEND it   -> both
  //   PlayerHealth:57 CALLS ITS OWN RemoveHealth for a fall   -> flash only
  // PlayerFootsteps' own fall arm (:306-311) plays the FallDamage clip
  // and nothing else.
  const shared = rd('src/scenes/shared.js');
  const fall = shared.slice(shared.indexOf('export function applyFallLanding'));
  assert.match(fall, /flashPlayerDamage\(\);/, 'the fall flashes');
  assert.doesNotMatch(fall.slice(0, fall.indexOf('\n}')), /playerPainVoice/, 'and does not cry');

  // the traps SEND it, so they get both... except the port's action
  // system has no audio seam, so the voice is RECORDED as owed there
  // rather than quietly skipped
  const act = rd('src/world/actionSystem.js');
  assert.match(act, /flashPlayerDamage\(\)/, 'the traps flash');
});

test('audit24 wave46: every blow and every ARROW now owes all three', () => {
  // EnemyAttack.cs:404-416 - SendDamageToPlayer sends RemoveHealth
  // (flash + cry) and then PlayWeaponHitSound / PlayWeaponlessHitSound.
  // BowDamage:140-141 routes an arrow through the very same
  // ApplyDamageToPlayer, so an arrow owes exactly what a blow owes.
  // COUNTED, not `.some()`. world.js and dungeonContext.js each have
  // TWO sites now (the blow and the arrow), so a `some` was satisfied
  // by the arrow after the blow's line was deleted - two mutants
  // walked through the first campaign on exactly that.
  const cries = (f) => rd(f).split('\n').filter((l) => l.trim().startsWith('playPlayerVoice(audio, playerPainVoice(')).length;
  assert.equal(cries('src/scenes/world.js'), 2, 'world: the blow AND the arrow');
  assert.equal(cries('src/scenes/dungeonContext.js'), 2, 'dungeon: the blow AND the arrow');
  assert.equal(cries('src/scenes/exterior.js'), 1, 'exterior: the blow (this host has no arrow pool)');
  // the two arrow-on-player sites, which had NONE of this
  const w = rd('src/scenes/world.js');
  const arrow = w.slice(w.indexOf('onPlayerHit: (m) =>'));
  const arrowArm = arrow.slice(0, arrow.indexOf('addItem(playerEntity.items'));
  assert.match(arrowArm, /hitSoundFor\(m\.weapon\)/, 'world: the arrow sounds');
  assert.match(arrowArm, /flashPlayerDamage\(\)/, 'world: the arrow flashes');
  assert.match(arrowArm, /playerPainVoice\(playerEntity, dmg\)/, 'world: the arrow cries');

  const d = rd('src/scenes/dungeonContext.js');
  const di = d.indexOf('an enemy ARROW reaches the player');
  assert.ok(di > 0, 'the dungeon arrow arm is annotated');
  const dArm = d.slice(di, d.indexOf('addItem(playerEntity.items', di));
  assert.match(dArm, /audio\.playOneShot\(hitSoundFor\(m\.weapon\), 1\.1\)/, 'dungeon: the arrow SOUNDS - it was silent');
  // and all three hang off a LANDED arrow: SendDamageToPlayer is only
  // reached from ApplyDamageToPlayer's `if (damage > 0)` arm, so a
  // miss must make no noise, no flash and no cry
  assert.match(dArm, /if \(dmg > 0\) \{/, 'dungeon: gated on a landed arrow');
  assert.match(arrowArm, /if \(dmg > 0\) \{/, 'world: likewise');
  assert.match(dArm, /flashPlayerDamage\(\)/, 'dungeon: and flashes');
  assert.match(dArm, /playerPainVoice\(playerEntity, dmg\)/, 'dungeon: and cries');
});

test('audit24 wave46: PlayArrowSound is DEAD in DFU and stays unported', () => {
  // PlayerFootsteps.cs:366-372 defines it with the comment "Capture
  // this message so we can play enemies' arrow sounds on player" - and
  // `grep SendMessage("PlayArrowSound")` over the whole DFU tree
  // returns nothing. Its siblings all have senders
  // (PlayWeaponHitSound and PlayWeaponlessHitSound from EnemyAttack
  // :413/:415, PlayLargeSplash from PlayerEnterExit:390). This one
  // never fires, so an enemy arrow in DFU makes the WEAPON hit sound
  // and no arrow sound at all - which is what the port now does.
  const src = rd('src/systems/soundClips.js');
  assert.doesNotMatch(src, /ArrowHit/, 'the clip is not ported, because nothing would play it');
  // hitSoundFor IS the two live ones, and the port uses it for arrows
  assert.match(src, /export function hitSoundFor\(weapon, rolls = Math\.random\)/);
  for (const f of ['src/scenes/world.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(f), /hitSoundFor\(m\.weapon\)/, `${f}: the arrow takes the WEAPON family`);
  }
});
