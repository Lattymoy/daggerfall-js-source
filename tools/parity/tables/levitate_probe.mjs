import fs from 'fs';
const { readSpellsStd } = await import('../../../src/formats/spellsStd.js').catch(e=>({}));
const mod = await import('../../../src/formats/spellsStd.js');
console.log('spellsStd exports:', Object.keys(mod));
