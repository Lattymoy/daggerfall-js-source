import fs from 'fs';
const { ENEMY_BASICS } = await import('../../../src/characters/enemyBasics.js');
const ids = Object.keys(ENEMY_BASICS);
console.log('port entries:', ids.length);
const keys = new Set(); let n=0;
for (const id of ids) for (const k of Object.keys(ENEMY_BASICS[id])) { keys.add(k); n++; }
console.log('port field assignments:', n);
console.log(JSON.stringify([...keys].sort()));
fs.writeFileSync('port_enemies.json', JSON.stringify(ENEMY_BASICS,null,1));
