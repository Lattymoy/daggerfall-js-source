// TECH1 (bible/05-Combat/Weapon-Techniques.md): THE KEY AND THE FOUR HOSTS - the registry's own action (appended, on the
// mouse's back side button, in the Controls page's Combat group, a touch corner's and a pad's to choose), the one runner
// every rig steps ahead of the gesture with the loose claimed at the frame's end, and THE FOUR HOSTS RULE (bible/Home.md):
// exterior.js, world.js, worldModes.js' interior arm and dungeonContext.js each hand their rig the technique's door and
// draw the player's marks in their ground pass - swept from the source, so a fifth host or a forgotten one fails here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS, PORT_ACTIONS, DEFAULT_BINDINGS, ACTION_GROUPS, actionLabel } from '../src/systems/inputActions.js';
import { TOUCH_BUTTON_ACTIONS } from '../src/ui/touchButtons.js';
import { DPAD_CHOICES } from '../src/ui/plusPad.js';
import { PLUS_BIND_ROWS } from '../src/ui/plusPadBinds.js';
import { TECHNIQUE_ACTION } from '../src/combat/techniques.js';
import { TECH_CHIP_COLOUR } from '../src/combat/techniqueRoster.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/** A file's text with its comments out - a pin on code reads code. */
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
/** The argument bag of a host's createWeaponRig call. */
const rigBag = (src, open) => { const i = src.indexOf(open); assert.ok(i >= 0, open); let d = 0, j = src.indexOf('({', i) + 1; const s = j; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) break; } } return src.slice(s, j + 1); };

test('TECH1 THE ACTION: WeaponTechnique appended last, a port row the classic windows yield, on Mouse3 alone, in Combat - and a touch corner\'s, a d-pad\'s and a pad button\'s to choose (mutants: inserted mid-list; another key; the group)', () => {
  assert.equal(TECHNIQUE_ACTION, 'WeaponTechnique');
  assert.equal(ACTIONS.at(-1), 'WeaponTechnique', 'appended - the classic grid and a saved file resolve by position');
  assert.ok(PORT_ACTIONS.includes('WeaponTechnique'));
  assert.deepEqual(DEFAULT_BINDINGS.filter(([, a]) => a === 'WeaponTechnique'), [['Mouse3', 'WeaponTechnique']]);
  assert.deepEqual(DEFAULT_BINDINGS.filter(([c]) => c === 'Mouse3'), [['Mouse3', 'WeaponTechnique']], 'one key, one action');
  const combat = ACTION_GROUPS.find((g) => g.title === 'Combat');
  assert.deepEqual(combat.rows.map((r) => r.action), ['ReadyWeapon', 'SwingWeapon', 'SwitchHand', 'WeaponTechnique']);
  assert.equal(actionLabel('WeaponTechnique'), 'Weapon technique (hold to aim)');
  assert.deepEqual(TOUCH_BUTTON_ACTIONS.find((a) => a.id === 'WeaponTechnique'), { id: 'WeaponTechnique', label: 'Weapon technique (hold to aim)', glyph: 'Tech', kind: 'hold', w: 60 });
  assert.deepEqual(DPAD_CHOICES.find(([v]) => v === 'WeaponTechnique'), ['WeaponTechnique', 'Weapon technique']);
  assert.deepEqual(PLUS_BIND_ROWS.find((r) => r.sec === 'WeaponTechnique'), { id: 'technique', label: 'Weapon technique (hold to aim)', sec: 'WeaponTechnique' });
  assert.match(read('bible/10-UI/Controls.md'), /\| `WeaponTechnique` \| MOUSE3 \|  \| Weapon technique \(hold to aim\) \|/);
});

test('TECH1 THE RIG: the one runner stepped AHEAD of the gesture on the swing\'s own gate, the key through the registry\'s held read, the loose claimed as the frame\'s events leave (mutants: stepped after the gesture; the gate dropped; the claim dropped)', () => {
  const rig = code('src/combat/weaponRig.js');
  assert.match(rig, /technique = null \}\)/, 'the host\'s door, defaulted');
  const step = rig.indexOf('stepTechnique(dt, _techCtx);');
  const gesture = rig.indexOf('? playerWeapon.gesture(_dx, _dy, _held, dt');
  assert.ok(step > 0 && gesture > step, 'the technique first: a click\'s strike and a technique\'s are one machine');
  assert.match(rig, /held: !!actionDown\?\.\(TECHNIQUE_ACTION\)/);
  assert.match(rig, /ready: !paralyzed && !!c && canAttack && !armLoosing && !_heldHit && !!camNow\?\.pos && !!camNow\?\.feet/, 'AUDIT TECH1: and no plain shot\'s hit held for the arm');
  assert.match(rig, /paralyzed: !!paralyzed,/, 'AUDIT TECH1: a held body\'s clock stops');
  assert.match(rig, /blocked: !!technique\?\.blocked\?\.\(\),/, 'AUDIT TECH1: a window holds the key');
  assert.match(rig, /const strike = !paralyzed && c && canAttack && !armLoosing && !techniqueFlying\(\)\s*\? playerWeapon\.gesture\(/, 'AUDIT TECH1: no gesture while a leap or a dash is in the air');
  assert.match(rig, /if \(techniqueFlying\(\)\) return;[^\n]*\n\s*const strike = playerWeapon\.clickAttack\(\);/, 'AUDIT TECH1: nor the touch button\'s swing');
  assert.match(rig, /startSwing: \(s\) => \{ if \(!playerWeapon\.techniqueStrike\(s\)\) return false; fpAttack\(s, dt\); return true; \}/);
  assert.match(rig, /return claimShot\(held\.evs, _techCtx\);/);
  assert.match(rig, /holding: !!_heldHit,/, 'a Morrowind arm\'s held hit is a loose still to come (MW-D42)');
  assert.match(code('src/combat/playerWeapon.js'), /techniqueStrike\(strike\) \{\s*if \(!machineAttack\(this\.machine, strike\)\) return false;/);
});

test('TECH1 THE FOUR HOSTS: exterior.js, world.js, worldModes.js\' interior arm and dungeonContext.js each hand their rig the door - the motor, their own arrow lane, their own fatigue door, the view - and draw the player\'s marks in their ground pass; the dungeon\'s motor and view are its outer host\'s (dungeon.js, worldModes.js) (mutants: a host\'s door dropped; a lane not its own; a ground pass without the marks)', () => {
  const hosts = {
    'src/scenes/exterior.js': { open: 'const weaponRig = createWeaponRig({', lane: 'arrows.fire(', drain: 'drainExteriorFatigue(n)' },
    'src/scenes/world.js': { open: 'const weaponRig = createWeaponRig({', lane: 'arrows.fire(', drain: 'drainExteriorFatigue(n)' },
    'src/scenes/worldModes.js': { open: 'const interiorWeapon = createWeaponRig({', lane: 'interiorArrows.fire(', drain: 'drainInteriorFatigue(n)' },
    'src/scenes/dungeonContext.js': { open: 'const weaponRig = createWeaponRig({', lane: 'fireArrow(from, dir, o?.weapon ?? playerWeapon.weapon, true', drain: 'drainFatigue(n)' },
  };
  for (const [file, h] of Object.entries(hosts)) {
    const src = code(file);
    const bag = rigBag(src, h.open);
    assert.match(bag, /technique: \{/, `${file}: the door`);
    for (const k of ['motor:', 'fireArrow:', 'drainFatigue:', 'face:']) assert.ok(bag.includes(k), `${file}: ${k}`);
    assert.ok(bag.includes(h.lane), `${file}: its own lane`);
    assert.ok(bag.includes(h.drain), `${file}: its own fatigue door`);
    assert.match(bag, /o\?\.sky \? \{ world: \[\.\.\.from\] \}/, `${file}: a Volley's shaft from the sky's own point`);
    assert.match(bag, /o\?\.weapon \?\? (?:weaponRig|interiorWeapon)?\.?playerWeapon\.weapon/, `${file}: AUDIT TECH1: the bow that loosed it`);
    assert.match(bag, /face: \(p, from\) =>/, `${file}: AUDIT TECH1: the turn from where the body lands`);
  }
  // the ground pass: every host that draws a foe's wind-up draws the player's marks with it
  for (const file of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const src = code(file);
    const foes = src.match(/renderer\.drawFoeTelegraphs\?\.\(drawableBlows\([^;]*\);/g) ?? [];
    const paired = src.match(/renderer\.drawFoeTelegraphs\?\.\(drawableBlows\([^;]*\);\s*renderer\.drawFoeTelegraphs\?\.\(techniqueMarksNow\(\)\);/g) ?? [];
    assert.ok(foes.length >= 1, file);
    assert.equal(paired.length, foes.length, `${file}: every foes' pass followed by the player's marks`);
  }
  // the pass draws a mark at its own size: its quad and its numbers set over its kind's, after the kind's own
  const pass = code('src/render/foeTelegraph.js');
  assert.match(pass, /else gl\.uniform4f\(U\.uP, P\.r, P\.ahead, 0, 0\);\s*if \(b\.technique\) \{\s*gl\.uniform1f\(U\.uHalf, techniqueQuadHalf\(b\)\);\s*gl\.uniform4f\(U\.uP, \.\.\.techniqueUniform\(b\)\);\s*\}/);
  // AUDIT TECH1: an area technique's blow is offered every pool it reaches - the watch's taking it no longer keeps it from
  // the encounter foes in its ring (the street's two hosts, a building's)
  assert.match(code('src/scenes/world.js'), /\} else if \(weaponRig\.playerWeapon\.techniqueBlow\) \{\s*if \(exteriorFoes\.resolvePlayerHit\(weaponRig\.playerWeapon, cam\.pos, lookFwd, player\.pos, makeInView\(proj, view, multiply\), guardHitSound, \{ swing \}\)\) surfacePlayer\(\);/);
  assert.match(code('src/scenes/exterior.js'), /\} else if \(weaponRig\.playerWeapon\.techniqueBlow\) \{\s*if \(exteriorFoes\.resolvePlayerHit\(weaponRig\.playerWeapon, eye, fwd, player\.pos, makeInView\(proj, view, multiply\), guardHitSound, \{ swing \}\)\) surfacePlayer\(\);/);
  assert.match(code('src/scenes/worldModes.js'), /if \(interiorWeapon\.playerWeapon\.techniqueBlow\) interiorFoes\?\.resolvePlayerHit\(interiorWeapon\.playerWeapon, cam\.pos, eyeDir\(\), player\.pos, makeInView\(proj, view, multiply\), interiorHitSound, \{ swing \}\);\s*continue;/);
  // the dungeon's outer hosts hand it their motor and view
  assert.match(code('src/scenes/dungeonContext.js'), /motor: \(\) => opts\.technique\?\.motor\?\.\(\) \?\? null,\s*face: \(p, from\) => opts\.technique\?\.face\?\.\(p, from\),/);
  assert.match(code('src/scenes/worldModes.js'), /technique: \{ motor: \(\) => player, face: \(p, from\) => \{ if \(!Array\.isArray\(p\)\) return; const o = Array\.isArray\(from\) \? from : player\.pos; cam\.yaw = Math\.atan2\(p\[0\] - o\[0\], p\[2\] - o\[2\]\); \} \},/);
  // AUDIT TECH1: the outdoor hosts hold the key under a window (their rig steps under one; the interior's and the dungeon's do not)
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rigBag(code(file), 'const weaponRig = createWeaponRig({'), /blocked: \(\) => gamePaused\(\),/, file);
  assert.match(code('src/scenes/dungeon.js'), /technique: \{ motor: \(\) => _motorRef, face:/);
  // the dungeon's lane meets a technique's shaft: struck once each, a piercing shot on through, a rival passed by
  const dc = code('src/scenes/dungeonContext.js');
  assert.match(dc, /const rv = m\.technique \? null : arenaRivalBody\(\);/);
  assert.match(dc, /const boss = struckBy\(gateBossBody\(\)\) \? null : gateBossBody\(\);/);
  assert.match(dc, /const cr = gateCrystalBodies\(\)\.find\(\(q\) => !struckBy\(q\) && missileHitsCapsule\(m\.pos, q\.ai\.feet, q\.ai\.height, q\.ai\.radius\)\);\s*if \(cr\) \{/, 'AUDIT TECH1: a struck crystal passed, the next one under the shaft met');
  assert.match(dc, /const hb = gateHostBodies\(\)\.find\(\(q\) => !struckBy\(q\) && missileHitsCapsule\(m\.pos, q\.ai\.feet, q\.ai\.height, q\.ai\.radius\)\);\s*if \(hb\) \{/, 'AUDIT TECH1: a struck body of his host passed, the next one met');
  assert.match(dc, /if \(f\.dead \|\| f\.companion != null\) continue;[^\n]*\n\s*if \(struckBy\(f\)\) continue;/);
  assert.match(dc, /if \(techniquePierces\(m, f\)\) continue;/);
  assert.match(dc, /if \(missileHitsFoe\(m\.pos, f\)\) \{\s*nextArenaQ\(\);\s*_arenaQ = shaftSequence\(m, _arenaQ\);/, 'AUDIT TECH1: a piercing shaft is one blow to the arena\'s referee');
});

test('TECH1 THE WORLD HOST\'S OWN: the chip off the MODE\'s rig with its key\'s name, the recentre\'s shift beside the foes\' (AUDIT TACT D3); the HUD\'s chip wears the marks\' blue from the leaf; every host keeps the browser\'s Back off the side buttons (mutants: the chip off world.js\'s own rig; the shift; the guard)', () => {
  const w = code('src/scenes/world.js');
  assert.match(w, /setHudTechniqueChips\(\(e\) => techniqueHudChips\(e, \(modes\?\.liveArm\?\.\(\)\?\.rig \?\? weaponRig\)\?\.playerWeapon, tagText\(getBinding\(bindings\(\), TECHNIQUE_ACTION\) \?\? ''\)\)\);/);
  assert.match(code('src/ui/enhancedHud.js'), /const powers = setPowerChips\(vitals\);\s*powers\.push\(\.\.\.techniqueChips\(vitals\)\);/, 'the chip after the set powers\'');
  assert.match(w, /offsetTactics\(r\.offset\);\s*offsetTechniques\(r\.offset\);/);
  assert.equal(TECH_CHIP_COLOUR, '#59c7ff');
  assert.match(code('src/ui/enhancedHud.js'), /const shade = t\.set === 'technique' \? TECH_CHIP_COLOUR : colour;/);
  assert.doesNotMatch(read('src/ui/enhancedHud.js'), /from '\.\.\/combat\/techniques\.js'/, 'the HUD never imports the runtime (it reaches half the game)');
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    assert.match(code(file), /for \(const kind of \['mousedown', 'mouseup'\]\) addEventListener\(kind, \(e\) => \{ if \(e\.button === 3 \|\| e\.button === 4\) e\.preventDefault\(\); \}\);/, file);
  }
});
