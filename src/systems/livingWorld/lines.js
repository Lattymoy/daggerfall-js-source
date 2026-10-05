// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): WHAT THE TOWN SAYS - the words of two or three residents met at
// a spot (meetups.js), of a traveller to the player, of a caravan at its fire. Original to the port, in the crew's own
// shape (naval/crewLife.js CREW_TALKS: a script of two or three lines, the first speaker first, then each in turn).
//
// A script may carry TOKENS the reader fills from where and when it is said (`fillLine`): {town} and {region} where it
// is said, {a} and {b} the first names of the first and second speaker, {place} a town of the road (a neighbour, or
// where the speaker last went), {player} the player's name. A token the reader cannot fill takes its fallback
// (`TOKEN_FALLBACK`) - never a brace on the screen.
//
// WHICH SCRIPT (`pickScript`) is a seeded draw over the pools that fit: the town's own talk always, the speakers'
// trades, the weather, the evening and the night, the season's holiday - so a smith and a farmer on a wet evening talk
// of iron, of rain or of the tavern, and every reader of that minute hears the same.
import { seededRng } from '../wind.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';

const S = (...lines) => Object.freeze(lines);

/** Any two of the town, any hour. */
export const TOWN_TALKS = Object.freeze([
  S('Morning, {b}.', 'Is it? I hadn\'t noticed.'),
  S('Did you hear about the miller\'s daughter?', 'Everyone\'s heard. Twice.', 'Well, I hadn\'t.'),
  S('Prices are up again.', 'They\'re always up again.', 'Not my wages.'),
  S('They say the Underking walks again.', 'They\'ve said that since my grandfather\'s day.'),
  S('Seen the new faces at the tavern?', 'Adventurers. They\'ll be gone by the week\'s end.', 'Or dead.'),
  S('The roads are bad this season.', 'The roads are bad every season.'),
  S('How\'s your mother, {b}?', 'Still telling me I married wrong.', 'So, well, then.'),
  S('Taxes again. The court at {region} must eat gold.', 'And drink it, by the look of the castle.'),
  S('I hear the Orcs of Orsinium want a kingdom of their own.', 'Let them have it, if it keeps them in the mountains.'),
  S('Wayrest or Sentinel, which would you pick?', 'Neither. {town} suits me.', 'Liar.'),
  S('There was a light in the old ruins last night.', 'Brigands.', 'Or worse.'),
  S('My knee says rain.', 'Your knee said rain yesterday.', 'And was it wrong? Wait.'),
  S('You owe me three septims.', 'Two. You ate half the pie.'),
  S('They hanged a thief in {place} last week.', 'Only one? Then they caught the slow one.'),
  S('Heard the Emperor\'s men passed through {place}.', 'Looking for something, no doubt.', 'They always are.'),
  S('Do you ever think of leaving {town}?', 'Every morning. Then I have breakfast.'),
  S('The well water tastes of iron.', 'Better than tasting of what\'s in the river.'),
  S('Someone\'s been stealing hens on the east side.', 'Foxes.', 'Foxes don\'t leave boot prints.'),
  S('Did the courier come?', 'Came and went. Nothing for you.', 'There never is.'),
  S('I saw a wolf at the edge of town.', 'In daylight?', 'Bold as a tax collector.'),
  S('Fine day.', 'For now.'),
  S('Mind the cart ruts by the gate.', 'Broke a wheel there myself, last spring.'),
  S('That adventurer paid in gold. Real gold.', 'Then count your fingers too.'),
  S('They say there\'s a vampire in {place}.', 'They say a lot in {place}.'),
  S('Have you been to the temple lately?', 'The gods know where I live.', 'That\'s what worries me.'),
]);

/** By a speaker's trade (the first speaker's, else the second's). */
export const JOB_TALKS = Object.freeze({
  keeper: Object.freeze([
    S('Business is slow.', 'Lower your prices.', 'Raise my hopes, you mean.'),
    S('A fellow tried to sell me a "Daedric" dagger.', 'Painted iron?', 'Painted badly.'),
    S('Stock came in from {place} at last.', 'Half of it broken, I\'ll wager.', 'Only a third.'),
  ]),
  smith: Object.freeze([
    S('Good iron\'s dear this year.', 'The mines in the hills went quiet.', 'Something in them, I hear.'),
    S('My arm aches from the hammer.', 'That\'s the trade.', 'That\'s the trade, and the trade aches.'),
    S('An adventurer wanted a sword by dawn.', 'Did you make it?', 'I made him a promise.'),
  ]),
  clerk: Object.freeze([
    S('The Bank had a run on letters of credit.', 'Someone\'s nervous.', 'Everyone\'s nervous.'),
  ]),
  scholar: Object.freeze([
    S('I found a book on the Dwemer today.', 'Any good?', 'Missing the last chapter. Typical.'),
  ]),
  priest: Object.freeze([
    S('Will we see you at prayers, {b}?', 'If my work allows.', 'Then the gods will make it allow.'),
    S('The offerings were thin this week.', 'So are the people.'),
  ]),
  guard: Object.freeze([
    S('Quiet watch?', 'Too quiet. I don\'t trust it.'),
    S('Caught a cutpurse by the market.', 'Only one?', 'Only one that ran slow enough.'),
    S('Keep your eyes on the gate tonight.', 'Something wrong?', 'Something always is.'),
    S('Captain wants the north wall walked twice.', 'Captain doesn\'t walk it.'),
  ]),
  farmer: Object.freeze([
    S('Field\'s too wet to plough.', 'Last year it was too dry.', 'There\'s no pleasing it.'),
    S('Lost two sheep to wolves.', 'Only two?', 'Two I could find.'),
    S('Barley\'s coming in well.', 'Don\'t say it aloud. The gods listen.'),
  ]),
  fisher: Object.freeze([
    S('Nets came up empty.', 'Slaughterfish took them again?', 'Took the nets too.'),
    S('Saw a ship on fire out past the point.', 'Pirates?', 'Or a careless cook.'),
  ]),
  sailor: Object.freeze([
    S('When do you ship out?', 'When the captain sobers.', 'So never.'),
    S('Heard of a wreck off the coast. Cargo and all.', 'And the crew?', 'Nobody asks about the crew.'),
  ]),
  innkeeper: Object.freeze([
    S('Full house tonight.', 'Full of what?', 'Trouble, mostly.'),
    S('Someone broke a bench last night.', 'Adventurers?', 'An adventurer. Over another adventurer.'),
  ]),
  server: Object.freeze([
    S('My feet are on fire.', 'Then stop running from table to table.', 'Tell that to the tables.'),
  ]),
  merchant: Object.freeze([
    S('I\'m taking a load to {place}.', 'Take guards.', 'I take guards. Guards take my profit.'),
    S('The road to {place} cost me a wheel and two days.', 'And the goods?', 'The goods arrived. My temper didn\'t.'),
    S('Silk from Sentinel fetches double here.', 'If you live to sell it.'),
  ]),
  mercenary: Object.freeze([
    S('Any work going?', 'A merchant wants blades for the road to {place}.', 'Paying?', 'Barely.'),
    S('I\'ve guarded worse.', 'You\'ve guarded better?', 'Once. He paid in wine.'),
  ]),
  adventurer: Object.freeze([
    S('There\'s a crypt west of here nobody\'s cleared.', 'Nobody\'s come back from it, you mean.'),
    S('Found a ring in the last ruin.', 'Magic?', 'It made my finger green. That\'s something.'),
    S('Next time, you take the first door.', 'I took the first door last time.', 'And you\'re still alive. Lucky door.'),
    S('Skeletons, three of them, and one with a crown.', 'Did you take the crown?', 'I took my legs out of there.'),
  ]),
  beggar: Object.freeze([
    S('Spare a coin?', 'For you? I\'ve none to spare for me.'),
  ]),
  courtier: Object.freeze([
    S('The court is all whispers this week.', 'About what?', 'If I knew, they wouldn\'t be whispers.'),
  ]),
  pilgrim: Object.freeze([
    S('I walk to the temple at {place} after the harvest.', 'Pray for my knees while you\'re there.'),
  ]),
  labourer: Object.freeze([
    S('Hauled stone since dawn.', 'For the castle?', 'For a man who calls himself a castle.'),
  ]),
  homemaker: Object.freeze([
    S('The baker\'s bread is getting smaller.', 'And his prices bigger.', 'Funny how that works.'),
  ]),
});

/** By the weather the reader passes (`weatherWord`). */
export const WEATHER_TALKS = Object.freeze({
  rain: Object.freeze([S('Wet again.', 'Good for the crops.', 'Bad for my roof.'), S('This rain will never stop.', 'It will. Then it\'ll snow.')]),
  thunder: Object.freeze([S('Hear that thunder?', 'Gods are arguing again.')]),
  snow: Object.freeze([S('Snow already.', 'Fetch the firewood while you can still find it.')]),
  fog: Object.freeze([S('Can\'t see the end of the street.', 'Then nobody can see you either. Hurry home.')]),
  sunny: Object.freeze([S('Warm today.', 'Enjoy it. It never lasts.')]),
});

/** After dusk (the evening), and deep in the night. */
export const EVENING_TALKS = Object.freeze([
  S('Long day.', 'They\'re all long.', 'This one longer.'),
  S('One for the road at the tavern?', 'One. Then two. Then the road forgets us.'),
  S('Lock your door tonight.', 'I always do.', 'Lock it twice.'),
]);
export const NIGHT_TALKS = Object.freeze([
  S('Shouldn\'t you be abed?', 'Shouldn\'t you?'),
  S('Did you hear something?', 'Just the wind.', '...I hope.'),
]);

/** LW6c: the words of one of a household handed home the keepsake of one of theirs the deep kept (livingTown.js moment) -
 *  `{who}` the fallen's first name, `{player}` the player's. */
export const LIVING_KEEPSAKE = Object.freeze([
  S('This is {who}\'s.', 'You found {who}? Down there?', 'We had given up hope of anything coming home. Thank you.'),
  S('Where did you get this?', '...So that is where {who} lies.', 'Thank you for bringing it home. We will not forget it.'),
  S('{who}\'s. I would know it anywhere.', 'You are welcome in this house, {player}. Always.'),
]);

/** LW8b: THE ROOM'S OWN TALK - two or three met inside a building, by the room's kind (`roomKindOf`): the tavern's, the
 *  temple's, a shop's, the guild hall's, the palace's, a home's. */
export const ROOM_TALKS = Object.freeze({
  tavern: Object.freeze([
    S('Another round?', 'If you\'re buying.', 'I\'m always buying. That\'s the trouble.'),
    S('This ale\'s been watered.', 'Then drink twice as much. Same effect.'),
    S('Who\'s the stranger by the door?', 'Don\'t stare, {a}.', 'I wasn\'t staring. I was wondering.'),
    S('Sing us the one about the miller and the Daedra.', 'Not before my third cup.'),
    S('The stew\'s better tonight.', 'It\'s the same stew. You\'re hungrier.'),
    S('A septim on the dice?', 'You still owe me from the last throw.', 'Then double or nothing.'),
    S('To {town}!', 'To {town}. Gods help it.'),
    S('Keep your voice down. The walls listen.', 'Walls? In here it\'s the serving girl.'),
    S('They say a dragon was seen over {region}.', 'They say that after the fourth cup in every tavern in the Bay.'),
    S('Is that seat taken?', 'It is now. Sit, {a}.'),
  ]),
  temple: Object.freeze([
    S('Have you made your offering?', 'Twice this week. The gods have dear tastes.'),
    S('Pray for me, {b}.', 'I already do. You need it.'),
    S('The sermon ran long.', 'Sin was up this month, I suppose.'),
    S('Do you think they hear us?', 'Someone does. I hope it\'s them.'),
    S('Hush. This is a holy place.', 'I was only whispering.', 'Whisper softer.'),
    S('I lit a candle for my father.', 'He\'d have liked that.', 'He\'d have called it a waste of tallow.'),
    S('A blessing before the road, {b}?', 'It couldn\'t hurt.', 'Not more than the road will.'),
  ]),
  shop: Object.freeze([
    S('Is that the real price?', 'For you, {a}? The real price and a little.'),
    S('Look at the work on this.', 'Look at the price on it.', 'I am. That\'s why I said look at the work.'),
    S('Do they have it in another colour?', 'You always ask that.', 'And they never do.'),
    S('I need a new one. Mine broke.', 'Again? What do you do with them?'),
    S('The last one I bought here fell apart in a week.', 'Then buy the dearer one.', 'That\'s what they want you to say.'),
    S('Just looking.', 'That\'s what you said yesterday.'),
  ]),
  guild: Object.freeze([
    S('Have you paid your dues?', 'Paid them. Regretted them.', 'Same as every month, then.'),
    S('There\'s a new contract on the board.', 'Dangerous?', 'Well paid. The same thing.'),
    S('The guildmaster wants a word with you.', 'A good word or a bad one?', 'With her it\'s hard to tell.'),
    S('Who\'s the new recruit?', 'Keen. Too keen.', 'We were all too keen once.'),
    S('I hear they\'re poaching our members in {region}.', 'Let them. We keep the good ones.'),
    S('Been practising, {b}?', 'Every day.', 'It shows. A little.'),
  ]),
  palace: Object.freeze([
    S('Has the court sat yet?', 'Not yet. They\'re still deciding who sits where.'),
    S('Mind what you say near the steward.', 'I mind what I say near everyone, {a}.'),
    S('The envoy\'s still waiting.', 'Let him wait. It\'s good for envoys.'),
    S('New tapestries.', 'Paid for out of the taxes, no doubt.', 'Hush.'),
    S('Who has the ear of the court these days?', 'Whoever spoke last.'),
  ]),
  home: Object.freeze([
    S('Did you bank the fire?', 'I banked it. You never trust me with the fire.'),
    S('What\'s for supper?', 'The same as yesterday.', 'Good. I liked yesterday.'),
    S('The roof\'s leaking again.', 'I\'ll see to it.', 'You said that last spring.'),
    S('Wipe your boots, {b}.', 'I did.', 'Wipe them again.'),
    S('Your sister wrote.', 'Asking for money?', 'Asking after you. And money.'),
    S('Come and sit by the fire.', 'In a moment.', 'Your moments last an hour.'),
  ]),
});

/** LW3: a party on the road, walking - the train's own talk. */
export const ROAD_TALKS = Object.freeze([
  S('How far to {place}?', 'Two days, if the weather holds.', 'It never holds.'),
  S('My feet are bleeding.', 'Walk on the grass, it\'s softer.', 'Then the snakes get me.'),
  S('Keep your eyes on the treeline.', 'Bandits?', 'Or worse.'),
  S('This road used to be safer.', 'Every road used to be safer.'),
  S('Smell that? Rain coming.', 'Then we camp early.'),
  S('Did you pack the salt pork?', 'I thought you did.', 'Wonderful.'),
  S('We\'ll make {place} by nightfall.', 'You said that yesterday.'),
  S('Sing something.', 'Not unless you want the wolves to come running.'),
  S('Mind the wheel ruts.', 'I see them.', 'You saw the last one too.'),
  S('Is that smoke ahead?', 'A farmstead, I hope.', 'Let\'s hope it\'s only a farmstead.'),
  S('Back home they\'ll be at the tavern by now.', 'And we\'ll be in a ditch. Keep walking.'),
]);
/** LW3: a party camped for the night, about its fire. */
export const CAMP_TALKS = Object.freeze([
  S('I\'ll take first watch.', 'Wake me if anything moves.', 'Everything moves out here.'),
  S('Pass the bread.', 'There\'s no bread.', 'Then pass whatever there is.'),
  S('Hear that howling?', 'Far off. Keep the fire high.'),
  S('Tell the one about the Wayrest sewer.', 'Not again.', 'Again!'),
  S('Stars are bright tonight.', 'Good for walking, bad for hiding.'),
  S('My grandmother said the dead walk on nights like this.', 'Your grandmother said a lot of things.'),
  S('Get some sleep. Long road tomorrow.', 'Every road is a long road.'),
]);
/** LW3: what a traveller says to the player met on the road, by their regard. */
export const ROAD_GREETINGS = Object.freeze({
  friend: Object.freeze(['{player}! Well met on the road.', 'Safe travels, {player}.', 'Good to see a friendly face out here, {player}.']),
  known: Object.freeze(['Safe travels.', 'The road\'s quiet today.', 'Mind yourself out here.']),
  stranger: Object.freeze(['Traveller.', 'Safe road.', 'Watch the road ahead.', 'Keep your blade close.']),
  enemy: Object.freeze(['Keep your distance.', 'Walk on.', 'I\'ve nothing for you.']),
});

/** What a resident says to the player in passing, by their regard (relations.js). */
export const LIVING_GREETINGS = Object.freeze({
  friend: Object.freeze(['Well met, {player}!', '{player}! Good to see you.', 'Ho, {player}. Keeping safe?', 'There\'s a friendly face.']),
  known: Object.freeze(['Good day.', 'Hello again.', 'You again.', 'Mind how you go.']),
  stranger: Object.freeze(['Good day, stranger.', 'Traveller.', 'Mm.', 'Fine day.']),
  enemy: Object.freeze(['You.', 'Keep walking.', 'I\'ve nothing to say to you.', 'Get away from me.']),
});

/** The fallback for a token the reader cannot fill. */
export const TOKEN_FALLBACK = Object.freeze({ town: 'town', region: 'the court', a: 'friend', b: 'friend', place: 'the next town', player: 'friend', who: 'someone', foe: 'brigands' });

/**
 * LW4: WHAT THE TOWN SAYS OF THE ROAD - two- and three-line scripts on a trouble its own travellers met: `{who}` the one
 * it befell (the party's leader, or the one who fell), `{foe}` what met them, `{place}` the town they were bound for.
 * By the end: driven off, won hard, fled home, and fallen.
 */
export const ROAD_NEWS = Object.freeze({
  driven: Object.freeze([
    Object.freeze(['{who} saw off a pack of {foe} on the road to {place}, I hear.', 'Good. The roads are no place for the timid.']),
    Object.freeze(['{foe} tried {who} on the way to {place}.', 'And?', 'And ran for it. {who} barely broke stride.']),
  ]),
  won: Object.freeze([
    Object.freeze(['{who} came through a hard fight with {foe} near {place}.', 'Hard enough to show?', 'Bandages and a new limp. {who} will live.']),
    Object.freeze(['They say {foe} fell on {who} on the {place} road.', 'And {who} is still walking. The gods favour the stubborn.']),
  ]),
  fled: Object.freeze([
    Object.freeze(['{who} turned back before {place}. {foe} on the road.', 'No shame in that. Better turned back than carried back.']),
    Object.freeze(['Did you hear? {who} ran from {foe}, all the way home.', 'I would have run faster.']),
  ]),
  fell: Object.freeze([
    Object.freeze(['{who} never came back from the road to {place}.', '{foe}?', 'So the ones who made it home say.']),
    Object.freeze(['Have you heard about {who}? {foe}, near {place}.', 'Gods. I spoke with {who} only last week.', 'The road takes the best of us.']),
    Object.freeze(['They buried what they could find of {who}.', 'The road to {place}. Always that road.']),
  ]),
});
/** LW6: what the town says of a DIVE - `{place}` the dungeon. */
export const DIVE_NEWS = Object.freeze({
  driven: Object.freeze([
    Object.freeze(['{who} went down into {place} and came back up grinning.', 'Grinning? Then there was gold in it.']),
  ]),
  won: Object.freeze([
    Object.freeze(['{who} is back from {place}. Bloodied, but back.', 'Most who go down there say that once.']),
    Object.freeze(['They say {who} cleared a nest of {foe} out of {place}.', 'Somebody had to.']),
  ]),
  fled: Object.freeze([
    Object.freeze(['{who} came running out of {place}, white as a sheet.', '{foe}?', 'Wouldn\'t say. Wouldn\'t stop shaking either.']),
  ]),
  fell: Object.freeze([
    Object.freeze(['{who} went down into {place} and never came up.', 'The deep keeps what it takes.']),
    Object.freeze(['Has anyone seen {who}?', 'Not since {place}. Not since the {foe} down there.', 'Then we won\'t.']),
  ]),
});
/**
 * LW7: what the town says of one of its own STRUCK DOWN by the player - `{who}` the slain; `seen`, `{player}` named
 * (someone saw whose hand it was), else a murder nobody can put a name to.
 */
export const SLAIN_NEWS = Object.freeze({
  seen: Object.freeze([
    Object.freeze(['{who} is dead. Cut down in the street, in plain sight.', 'By whose hand?', '{player}\'s. Half the street saw it.']),
    Object.freeze(['Did you hear what {player} did to {who}?', 'I heard. Keep your voice down - and your door barred.']),
    Object.freeze(['{who}\'s people want {player}\'s blood.', 'Can you blame them?']),
  ]),
  unseen: Object.freeze([
    Object.freeze(['They found {who} dead in the street. Nobody saw a thing.', 'Somebody did. Somebody always does.']),
    Object.freeze(['{who}, murdered. Here, of all places.', 'Bar your door tonight.']),
  ]),
});
/** LW7: of one of its own who died fighting at the player's side. */
export const DIED_NEWS = Object.freeze([
  Object.freeze(['{who} died fighting beside {player}, they say.', 'There are worse ways to go.']),
  Object.freeze(['Have you heard? {who} fell at {player}\'s side.', 'Then {player} owes {who} a debt that can\'t be paid.']),
]);
/** LW6d: of a keepsake of one of its own the deep kept, carried home by the player - `{who}` the one it was. */
export const HOME_NEWS = Object.freeze([
  Object.freeze(['Did you hear? {player} brought {who}\'s keepsake up out of the deep.', 'Home to the family? Gods bless them.']),
  Object.freeze(['{who}\'s people have something of theirs back, thanks to {player}.', 'Not many would go down there for the dead.']),
  Object.freeze(['That {player} - went into the dark and came back with {who}\'s keepsake.', 'There is kindness in the world yet.']),
]);
/** LW7: of a fight on the road the PLAYER turned for its party (the character's `won`) - `{player}` the one who came. */
export const HELPED_NEWS = Object.freeze({
  won: Object.freeze([
    Object.freeze(['{foe} set on {who} on the road to {place}. {player} was there.', 'And?', 'And now the crows are fat.']),
    Object.freeze(['They say {player} fought off {foe} for {who}, near {place}.', 'A stranger, doing that? There\'s hope for us yet.']),
  ]),
  fell: Object.freeze([
    Object.freeze(['{player} fought beside {who}\'s party near {place}. Not everyone came home.', 'More would be in the ground without {player}.']),
  ]),
});
/** LW5b: what the town says of a passage by sea that cost a life - `{place}` the port they sailed for. */
export const SEA_NEWS = Object.freeze({
  fell: Object.freeze([
    Object.freeze(['{who} was lost at sea, on the crossing to {place}.', 'The Bay takes its share.']),
    Object.freeze(['Did you hear? {who} went over the side, halfway to {place}.', 'In that weather?', 'In any weather. The sea does not ask.']),
  ]),
});
/** Of a meeting with news to tell, the share that tells it. */
export const NEWS_SHARE = 0.4;

/** LW7: a news item's words - a deed's (struck down by the player, seen or not; died at their side), a fight the player
 *  turned, a passage by sea's (LW5b), a dive's (LW6), the road's.
 *  @param {{ kind: string, dive?: boolean, helped?: boolean, seen?: boolean, sea?: boolean }} item */
const newsPool = (item) => (item.kind === 'slain' ? SLAIN_NEWS[item.seen ? 'seen' : 'unseen']
  : item.kind === 'died' ? DIED_NEWS
  : item.kind === 'home' ? HOME_NEWS   // LW6d: a keepsake carried home
    : item.helped && HELPED_NEWS[/** @type {keyof typeof HELPED_NEWS} */ (item.kind)] ? HELPED_NEWS[/** @type {keyof typeof HELPED_NEWS} */ (item.kind)]
      : item.sea ? SEA_NEWS[/** @type {keyof typeof SEA_NEWS} */ (item.kind)]   // LW5b: the sea's own words
        : (item.dive ? DIVE_NEWS : ROAD_NEWS)[/** @type {keyof typeof ROAD_NEWS} */ (item.kind)]);

/**
 * LW4: a meeting's news, if it tells one - NEWS_SHARE of the meetings with news to tell, the item drawn on the seed -
 * and its script by the news's end.
 * @param {number} seed @param {readonly { kind: string, dive?: boolean, helped?: boolean, seen?: boolean }[] | null | undefined} news
 * @returns {{ item: any, script: readonly string[] } | null}
 */
export function newsScript(seed, news) {
  if (!news?.length) return null;
  const rng = seededRng((seed ^ 0x4e455753) >>> 0);   // 'NEWS'
  if (rng() >= NEWS_SHARE) return null;
  const item = news[Math.floor(rng() * news.length)];
  const pool = newsPool(item);
  return pool ? { item, script: pool[Math.floor(rng() * pool.length)] } : null;
}

/** LW4: the names Daggerfall's foes take more than one at a time that no rule makes. */
const FOE_PLURALS = Object.freeze({ Werewolf: 'Werewolves', Wereboar: 'Wereboars', Thief: 'Thieves', Slaughterfish: 'Slaughterfish', Dreugh: 'Dreugh', Lich: 'Liches', 'Ancient Lich': 'Ancient Liches' });

/**
 * LW4: a foe's word for the town's talk and a mark - many ("Orcs", "Harpies", "Frost Daedra") or one ("a Giant", "an
 * Imp"). `name` the foe's own (enemyBasics.js enemyDisplayName).
 * @param {string} name @param {number} n
 */
export function foeWord(name, n) {
  const w = String(name ?? '').trim() || 'foe';
  if (n === 1) return `${/^[AEIOU]/i.test(w) ? 'an' : 'a'} ${w}`;
  if (FOE_PLURALS[/** @type {keyof typeof FOE_PLURALS} */ (w)]) return FOE_PLURALS[/** @type {keyof typeof FOE_PLURALS} */ (w)];
  if (/Daedra$/.test(w)) return w;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  if (/(s|sh|ch|x)$/i.test(w)) return `${w}es`;
  return `${w}s`;
}

/** A line with its tokens filled. @param {string} text @param {Record<string, string|undefined|null>} ctx */
export function fillLine(text, ctx = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ? String(ctx[k]) : TOKEN_FALLBACK[/** @type {keyof typeof TOKEN_FALLBACK} */ (k)] ?? ''));
}

/**
 * LW8b: a building's kind for its talk (ROOM_TALKS) - a tavern, a temple, the guild hall, the palace, a house (`home`),
 * any shop, bank or library (`shop`); else null (the town's talk alone).
 * @param {number} type - BUILDING_TYPES
 * @returns {keyof typeof ROOM_TALKS | null}
 */
export function roomKindOf(type) {
  if (type === BUILDING_TYPES.Tavern) return 'tavern';
  if (type === BUILDING_TYPES.Temple) return 'temple';
  if (type === BUILDING_TYPES.GuildHall) return 'guild';
  if (type === BUILDING_TYPES.Palace) return 'palace';
  if (type >= BUILDING_TYPES.House1 && type <= BUILDING_TYPES.House6) return 'home';
  return SHOP_ROOMS.has(type) ? 'shop' : null;
}
const SHOP_ROOMS = new Set(/** @type {number[]} */ ([BUILDING_TYPES.Alchemist, BUILDING_TYPES.Armorer, BUILDING_TYPES.Bank, BUILDING_TYPES.Bookseller, BUILDING_TYPES.ClothingStore,
  BUILDING_TYPES.FurnitureStore, BUILDING_TYPES.GemStore, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Library, BUILDING_TYPES.PawnShop, BUILDING_TYPES.WeaponSmith]));

/** A resident's first name (the walkers' FullName is "First Surname"; a single-part name is all first). @param {string} name */
export const firstNameOf = (name) => String(name ?? '').split(' ')[0] || '';

/**
 * A script for two or three speakers: the pools that fit, drawn on `seed`. `jobs` the speakers' trades; `weather` the
 * reader's weather word; `hour` the hour of the day; `road` a party's talk ('walk' on the road, 'camp' at its fire) in
 * place of the town's. LW8b: `room` a building's kind (`roomKindOf`) - its own talk two shares of three of the town's.
 * @param {number} seed @param {{ jobs?: readonly string[], weather?: string|null, hour?: number, road?: 'walk'|'camp'|null, room?: string|null }} [o]
 * @returns {readonly string[]}
 */
export function pickScript(seed, { jobs = [], weather = null, hour = 12, road = null, room = null } = {}) {
  const rng = seededRng(seed);
  /** @type {(readonly (readonly string[])[])[]} */
  const pools = road === 'camp' ? [CAMP_TALKS, CAMP_TALKS, CAMP_TALKS] : road === 'walk' ? [ROAD_TALKS, ROAD_TALKS, ROAD_TALKS] : [TOWN_TALKS, TOWN_TALKS];
  const own = !road && room ? ROOM_TALKS[/** @type {keyof typeof ROOM_TALKS} */ (room)] : null;
  if (own) pools.splice(0, 1, own, own);   // LW8b: inside, the room's own talk beside the town's
  for (const j of jobs) { const p = JOB_TALKS[/** @type {keyof typeof JOB_TALKS} */ (j)]; if (p) pools.push(p); }
  const w = weather ? WEATHER_TALKS[/** @type {keyof typeof WEATHER_TALKS} */ (weather)] : null;
  if (w) pools.push(w);
  if (!road && hour >= 18 && hour < 23) pools.push(EVENING_TALKS);
  if (!road && (hour >= 23 || hour < 5)) pools.push(NIGHT_TALKS, NIGHT_TALKS);
  const pool = pools[Math.floor(rng() * pools.length)];
  return pool[Math.floor(rng() * pool.length)];
}
