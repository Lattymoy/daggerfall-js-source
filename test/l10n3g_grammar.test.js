// L10N3g (2026-09-27): THE FRENCH PACK'S GRAMMAR. "DFU en français" writes its text with grammar tokens and ships an
// MIT processor (FrenchGrammarRules.cs, Daneel53) that DFU runs wherever it calls GrammarManager.ProcessGrammar; the
// port carries it as src/systems/grammar/frenchGrammar.js. Pinned over made-up French (no pack text is committed):
// the text core chooses the rules for French and only for French - English, and a language with no rules, read their
// text as it stands; the articles by the gender/number token behind them (le/la/l'/les, un/une/des, ce/cet/cette/ces,
// de/du/de la/de l'/des/d', à/au/à la/à l'/aux, mon/ton/son), with the h aspiré and the article already in the text;
// the double articles condensed (de le -> du, à les -> aux); the article behind its word; the hero's and the NPC's
// gender ({monsieur/madame}, {NPCGender?cousin#cousine}), the getters shared across a language switch; the adjective's
// four forms and the fifth before a masculine vowel word; {IsPlural?..} and {Number?..}; {.min}, {.Min} and {.Maj};
// a DFU token ({0}) left in place, an unknown one marked as the pack's processor marks it.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { FrenchGrammarRules, _resetFrenchGrammarForTests } from '../src/systems/grammar/frenchGrammar.js';

beforeEach(() => { tm._resetTextManagerForTests(); _resetFrenchGrammarForTests(); });
const fr = () => { tm.setLocale('fr'); return (s) => tm.processGrammar(s); };

test('L10N3g the rules are French\'s: chosen for fr and fr-CA, never for English or a language with no rules; English reads its text untouched', () => {
  const token = 'Prenez {.le}{.FS}épée.';
  assert.equal(tm.processGrammar(token), token, 'English: the identity');
  tm.setLocale('fr');
  assert.ok(tm.GrammarManager.grammarProcessor instanceof FrenchGrammarRules);
  assert.equal(tm.processGrammar(token), "Prenez l'épée.");
  tm.setLocale('de');
  assert.equal(tm.processGrammar(token), token, 'a language with no rules');
  tm.registerLocale({ code: 'fr-CA', name: 'Français (Canada)' });
  tm.setLocale('fr-CA');
  assert.equal(tm.processGrammar(token), "Prenez l'épée.", 'fr-CA reads fr\'s rules down its chain');
  tm.setLocale('en');
  assert.equal(tm.processGrammar(token), token);
});

test('L10N3g the articles by the gender token behind them - le, un, ce, de, du, à, mon/ton/son - with the h aspiré, the article already in the text, and the doubles condensed', () => {
  const g = fr();
  assert.equal(g('Prenez {.le}{.MS}bouclier.'), 'Prenez le bouclier.');
  assert.equal(g('Prenez {.le}{.FS}lance.'), 'Prenez la lance.');
  assert.equal(g('Prenez {.le}{.MS}arc.'), "Prenez l'arc.");
  assert.equal(g('Prenez {.le}{.FP}bottes.'), 'Prenez les bottes.');
  assert.equal(g('{.Le}{.MS}roi arrive.'), 'Le roi arrive.', 'a capital token, a capital article');
  assert.equal(g('Prenez {.le}{.FP}bottes et {.le} ramenez.'), 'Prenez les bottes et les ramenez.', 'the article behind its word');
  assert.equal(g('Voici {.un}{.FS}lame.'), 'Voici une lame.');
  assert.equal(g('Voici {.un}{.MP}gants.'), 'Voici des gants.');
  assert.equal(g('{.Ce}{.MS}arbre'), 'Cet arbre');
  assert.equal(g('{.ce}{.FS}route'), 'cette route');
  assert.equal(g('Le vin {.de}{.MS}roi'), 'Le vin du roi');
  assert.equal(g('La lame {.de}{.FS}reine'), 'La lame de la reine');
  assert.equal(g("L'or {.de}{.MS}ogre"), "L'or de l'ogre");
  assert.equal(g('Le chemin {.de}Daggerfall'), 'Le chemin de Daggerfall', 'no gender: a town');
  assert.equal(g('Le chemin {.de}Aldmar'), 'Le chemin de Aldmar', 'the C#\'s own: the word behind a genderless article is never read, so a vowel does not elide it');
  assert.equal(g('Allez {.à}{.MS}temple.'), 'Allez au temple.');
  assert.equal(g('Allez {.à}{.FS}taverne.'), 'Allez à la taverne.');
  assert.equal(g('Allez {.à}{.FS}{.h}halle.'), 'Allez à la halle.', 'an h aspiré: a consonant');
  assert.equal(g("Allez {.à}{.MS}hôpital."), "Allez à l'hôpital.", 'an h muet: a vowel');
  assert.equal(g('Parlez {.à}{.MP}gardes.'), 'Parlez aux gardes.');
  assert.equal(g('Allez {.à}Sentinel.'), 'Allez à Sentinel.');
  assert.equal(g('Allez {.à}le temple.'), 'Allez au temple.', 'à le -> au');
  assert.equal(g('Le prix {.de}les armes'), 'Le prix des armes', 'de les -> des');
  assert.equal(g('Allez {.à}{.MS}le temple.'), 'Allez au temple.', 'the word behind the gender token is itself an article: à le -> au');
  assert.equal(g('Le prix {.de}{.MP}les armes'), 'Le prix des armes', 'de les -> des, likewise');
  assert.equal(g('{.Mon}{.FS}épée et {.son}{.MP}gants'), 'Mon épée et ses gants');
  assert.equal(g('{.ton}{.FS}lame'), 'ta lame');
});

test('L10N3g the hero\'s and the NPC\'s gender through getters the game hands in - shared, so a getter set while English was chosen still answers in French', () => {
  tm.GrammarManager.grammarProcessor.setHeroGenderGetter(() => 'female');   // handed in under English
  tm.GrammarManager.grammarProcessor.setNPCGenderGetter(() => 'male');
  const g = fr();
  assert.equal(g('Merci, {monsieur/madame}.'), 'Merci, madame.');
  assert.equal(g('Vous êtes prêt{/e}.'), 'Vous êtes prête.');
  assert.equal(g('Mon {NPCGender?cousin#cousine} vous attend.'), 'Mon cousin vous attend.');
  tm.GrammarManager.grammarProcessor.setHeroGenderGetter(() => 'male');
  tm.GrammarManager.grammarProcessor.setNPCGenderGetter(() => 'female');
  assert.equal(g('Merci, {monsieur/madame}.'), 'Merci, monsieur.');
  assert.equal(g('Ma {NPCGender?cousin#cousine} vous attend.'), 'Ma cousine vous attend.');
});

test('L10N3g the adjective\'s forms by gender and number (and the fifth before a masculine vowel word), {IsPlural?..} and {Number?..}', () => {
  const g = fr();
  assert.equal(g('Une {#beau#beaux#belle#belles#bel} {.FS}épée'), 'Une belle épée');
  assert.equal(g('Un {#beau#beaux#belle#belles#bel} {.MS}arbre'), 'Un bel arbre', 'before a masculine vowel word');
  assert.equal(g('Un {#beau#beaux#belle#belles#bel} {.MS}cheval'), 'Un beau cheval');
  assert.equal(g('Des {#beau#beaux#belle#belles#bel} {.MP}chevaux'), 'Des beaux chevaux');
  assert.equal(g('{.Le}{.FP}bottes {IsPlural?est#sont} usées.'), 'Les bottes sont usées.');
  assert.equal(g('{.Le}{.FS}lame {IsPlural?est#sont} usée.'), 'La lame est usée.');
  assert.equal(g('Durée : 3 {Number?tour#tours}'), 'Durée : 3 tours');
  assert.equal(g('Durée : 1 {Number?tour#tours}'), 'Durée : 1 tour');
  assert.equal(g('Durée : un {Number?tour#tours}'), 'Durée : un tour', 'no number before: the singular');
});

test('L10N3g {.min}, {.Min} and {.Maj}; a DFU token left in place; an unknown token marked as the pack\'s processor marks it; the gender carried to the next text as the C# carries it', () => {
  const g = fr();
  assert.equal(g('Vous trouvez du Minerai{.min} ici'), 'Vous trouvez du minerai ici');
  assert.equal(g('Il Est Venu Ici{.Min}'), 'Il est venu ici');
  assert.equal(g('ceci est la fin{.Maj}.'), 'Ceci est la fin.');
  assert.equal(g('Bonjour. voici la suite{.Maj}!'), 'Bonjour. Voici la suite!');
  assert.equal(g('Il reste {0} jours {.à}{.MS}temple'), 'Il reste {0} jours au temple', 'a DFU token: left for its own pass');
  assert.equal(g('Le {xyz} ici'), 'Le  -UT: Le {xyz} ici -  ici');
  g('Prenez {.le}{.FP}bottes.');
  assert.equal(g('Elles sont {#usé#usés#usée#usées}.'), 'Elles sont usées.', 'no gender in this text: the last one defined (a static in the C#) stands');
  assert.equal(g('Prenez-{.le} vite.'), 'Prenez- vite.', 'but an article with none behind it says nothing - genderDefined starts each text false');
  assert.equal(g('Sans jeton'), 'Sans jeton');
});
