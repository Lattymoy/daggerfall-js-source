// PSCALE-OWN (2026-09-27, Mac: "Finish the 2 gaps"). QUEST-PARTY phase 3c put a shared quest's foes underground on the
// room's own lane - the spawner steps them, the party strikes them through it - but PSCALE1's `_sharedFoe` asked only
// the room's predicate (the layout's run, a rest's encounter), so the one foe a party fights together underground was
// the one no party's size weighed: a four-player party met the vampire at its solo health, and it hit each of them as
// if alone. It is a shared foe now - mine, counted by me whoever holds the seat (`_runsFoe`), or a party member's,
// read off its owner's record like any puppet - and my private quest's foe and my summoned ally still are not.
// Mounted over the context's own statements (auditpscale1's harness) with the real partyScale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './modsOff.js';
import { PARTY_ME, noteFighter, foeFighters, partyFoeLoses, partyFoeHeals, partyFoeHits, _resetPartyScaleForTests } from '../src/systems/partyScale.js';

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };
const line = (head) => { const a = D.indexOf(head); assert.ok(a > 0, `src has ${head}`); return D.slice(a, D.indexOf('\n', a)); };

/** The helpers as the context declares them: the room's predicate, the party's word on my quest foe, and the run from
 *  `_sharedFoe` to the damage door - with the door's one subtraction. */
function helpers() {
  const a = D.indexOf('function _sharedFoe(f) {'), b = D.indexOf('function damageFoe(foe, damage,', a);
  assert.ok(a > 0 && b > a, 'the helpers are found');
  const door = strip(D.slice(b, D.indexOf('if (foe.entity.health <= 0) {', b))).match(/foe\.entity\.health -=[^;]*;/g);
  assert.equal(door?.length, 1, 'one subtraction at the door');
  return { src: [line('const isRoomFoe = '), line('const ownShare = '), line('const ownQuestTag = '), line('const ownLoose = '), line('const ownRides = '), strip(D.slice(a, b))].join('\n'), door: door[0] };
}
const tagOf = (f) => (f.questBehaviour && !f.questBehaviour.private ? { q: 'M0B00Y16', s: '_vampire_' } : null);
function side(authority, foes, layout = 1) {
  const h = helpers();
  const scope = { foes, _layoutFoes: layout, _authority: authority, opts: { questShare: () => ({ tagOf }) }, playerEntity: { maxHealth: 100 }, partyFoeLoses, partyFoeHits, partyFoeHeals, foeFighters, performance };
  return mount(h.src, scope, `return { _sharedFoe, _runsFoe, fightN, _weighHit, healFoe, door: (foe, healthDamage, bypassShield = false, _whole = false) => { ${h.door} } };`);
}
const mk = (over = {}) => ({ entity: { health: 100, maxHealth: 200 }, ...over });
const four = (f) => { const now = performance.now(); for (const who of [PARTY_ME, 'bob-0002', 'carl-0003', 'dave-0004']) noteFighter(f, who, now); };

test('PSCALE-OWN: my shared quest\'s foe underground is as tough as the party striking it, and hits each as hard as a party\'s foe - counted by me whether or not I hold the seat; the record the party reads carries the count', () => {
  for (const authority of [false, true]) {
    _resetPartyScaleForTests();
    const layout = mk(), vamp = mk({ questBehaviour: { questUID: 7 } });
    const d = side(authority, [layout, vamp]);
    assert.equal(d._sharedFoe(vamp), true, `shared (${authority ? 'the seat' : 'a joiner'})`);
    assert.equal(d._runsFoe(vamp), true, 'and run here - its spawner steps it');
    four(vamp);
    assert.equal(d.fightN(vamp), 4, 'four fight it, counted here');
    assert.equal(vamp._fightN, 4, 'kept on the foe for the Renown bonus and the sigils');
    d.door(vamp, 5); assert.equal(vamp.entity.health, 98, 'five at four fighters is two - the layout\'s weight (auditpscale1)');
    d.door(vamp, 10, false, true); assert.equal(vamp.entity.health, 88, 'a kill is whole');
    assert.equal(d._weighHit(vamp, 10), 13, 'its blow on me at four: 13 for 10');
    d.healFoe(vamp, 20); assert.equal(vamp.entity.health, 96, 'a heal of 20 on it fought by four is 8');
  }
  // the record: the own lane's (roomRecord), `n` because it is shared - what a party member's puppet reads
  assert.match(strip(D), /if \(!f\.dead && _sharedFoe\(f\)\) \{ const n = fightN\(f\); if \(n > 1\) r\.n = n; \}/);
  assert.match(strip(D), /const r = roomRecord\(f, f\._ownSeq, full \|\| !!heirOf\);/, 'the own lane\'s frame is that record');
});

test('PSCALE-OWN: a party member\'s quest foe stood here reads its owner\'s count - its blow on me weighed by it, a heal left to its owner, never counted on my screen (seat or none)', () => {
  for (const authority of [false, true]) {
    _resetPartyScaleForTests();
    const pup = mk({ _ownFrom: 'bob-0002', _ownI: 1, _fightN: 3, questBehaviour: { questUID: 7 } });
    const d = side(authority, [mk(), pup]);
    assert.equal(d._sharedFoe(pup), true, 'shared');
    assert.equal(d._runsFoe(pup), false, 'its owner runs it');
    four(pup);
    assert.equal(d.fightN(pup), 3, 'the owner\'s word, not my screen\'s blows');
    assert.equal(d._weighHit(pup, 10), 12, 'struck by three fighters\' weight');
    d.healFoe(pup, 20); assert.equal(pup.entity.health, 120, 'a heal is the owner\'s: whole here until its record');
  }
});

test('PSCALE-OWN: what stays unweighed - my PRIVATE quest\'s foe, a foe past the layout that is no quest\'s, my summoned ally even on a shared quest; and a joiner\'s layout copy still reads the host', () => {
  _resetPartyScaleForTests();
  const layout = mk({ _fightN: 2 }), priv = mk({ questBehaviour: { questUID: 8, private: true } }), stray = mk(), ally = mk({ questBehaviour: { questUID: 7 }, entity: { health: 100, maxHealth: 200, team: 'PlayerAlly' } });
  const d = side(false, [layout, priv, stray, ally]);
  for (const f of [priv, stray, ally]) {
    four(f);
    assert.equal(d._sharedFoe(f), false);
    d.door(f, 5); assert.equal(f.entity.health, 95, 'whole');
    assert.equal(d._weighHit(f, 10), 10);
  }
  assert.equal(d._runsFoe(layout), false, 'the layout\'s run while another holds the seat: a puppet');
  assert.equal(d.fightN(layout), 2, 'the host\'s word');
});
