import fs from 'node:fs';
import path from 'node:path';
import { parseRscCsv, parseRscMarkup } from '../src/formats/rscTable.js';
import { encodeRscRecord, RSC } from '../src/formats/textRsc.js';

const csvPath = 'c:/Users/Тралалело/Documents/antigravity/silly-bose/df_ru_temp/Text/Internal_RSC.csv';
const steamArena2 = 'C:/Program Files (x86)/Steam/steamapps/common/The Elder Scrolls Daggerfall/DF/DAGGER/ARENA2';
const targetRscPath = path.join(steamArena2, 'TEXT.RSC');

console.log('Reading Russian CSV...');
const csvText = fs.readFileSync(csvPath, 'utf-8');
const map = parseRscCsv(csvText);
console.log(`Parsed ${map.size} numeric records from CSV.`);

// Parse 9000.1 .. 9000.40 questions
const questions = [];
for (let q = 1; q <= 40; q++) {
  const key = `9000.${q}`;
  const idx = csvText.indexOf(`${key},"`);
  if (idx !== -1) {
    let end = csvText.indexOf('"\r\n', idx);
    if (end === -1) end = csvText.indexOf('"\n', idx);
    const val = csvText.slice(idx + key.length + 2, end);
    // clean DFU markup into plain text
    const parsed = parseRscMarkup(val);
    questions.push(parsed.join(''));
  }
}
console.log(`Extracted ${questions.length} questions for Record 9000.`);

if (questions.length === 40) {
  // Classic record 9000: '{' + q1 + '{' + q2 + ... + '{' + q40
  const combined9000 = '{' + questions.join('{');
  map.set(9000, combined9000);
}

// Convert all records to array of { id, variants }
const table = {};
for (const [id, rawVal] of map.entries()) {
  if (id === 9000) {
    table[id] = [map.get(9000)];
  } else {
    table[id] = parseRscMarkup(rawVal);
  }
}

// Save json to src/formats/russianRscData.json
const jsonPath = 'c:/Users/Тралалело/Documents/antigravity/silly-bose/daggerfall-server/src/formats/russianRscData.json';
fs.writeFileSync(jsonPath, JSON.stringify(table), 'utf-8');
console.log(`Wrote JSON table to ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB)`);

// Build binary TEXT.RSC
console.log('Building binary TEXT.RSC for Steam ARENA2...');
const ids = Object.keys(table).map(Number).sort((a, b) => a - b);
const count = ids.length;
const headerLength = (count + 1) * 6;

// Encode records
const encodedRecords = new Map();
let totalBodyBytes = 0;
for (const id of ids) {
  const enc = encodeRscRecord(table[id]);
  encodedRecords.set(id, enc);
  totalBodyBytes += enc.length;
}

const totalFileSize = headerLength + totalBodyBytes;
const buffer = Buffer.alloc(totalFileSize);

// Header
buffer.writeUInt16LE(headerLength, 0);
let curHeaderOffset = 2;
let curBodyOffset = headerLength;

for (const id of ids) {
  const enc = encodedRecords.get(id);
  buffer.writeUInt16LE(id, curHeaderOffset);
  buffer.writeUInt32LE(curBodyOffset, curHeaderOffset + 2);
  curHeaderOffset += 6;

  enc.forEach((byte, i) => {
    buffer[curBodyOffset + i] = byte;
  });
  curBodyOffset += enc.length;
}

// Write to Steam ARENA2
fs.writeFileSync(targetRscPath, buffer);
console.log(`Successfully generated and wrote binary TEXT.RSC to ${targetRscPath} (${buffer.length} bytes)!`);
