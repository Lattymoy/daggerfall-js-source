// @ts-check
// REVENANT-VOICE (2026-10-02, Mac: "They should have their own unique personalities that affect their speach. One could
// be humorous, or witty, etc") - WHO A REVENANT IS, AND HOW IT TALKS. A leaf: the words and the pick, nothing else.
//
//  - TEN PERSONALITIES, one per revenant, drawn once from its id (so one revenant is always the same one, across a
//    save, a reload and every client that hears its name) and weighted by what it is: an orc leans brutal, a lich cold,
//    a daedra arrogant, a person anything at all.
//  - EVERY MOMENT IT HAS A WORD FOR, in that voice: its returns (by its last deed - it killed you, it ran from you, it
//    has risen three times), its flight, its cornering, its escape, its death, its gloat, its YIELD when beaten, its
//    last words under an execution, its oath when spared, its slip when you hesitate - and, sworn to you as a
//    companion, its arrival through a portal, its leaving, a fall, a kill, a fight and its farewell when released.
//  - A BEAST NEVER SPEAKS: the narrator says what it does, in its temperament ("with a nervous whine").
//
// `{p}` is the player's first name; RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): `{how}` a learned habit, `{item}` a
// piece it took, `{move}` its signature, `{ally}` the companion it felled (VOICE_PLACEHOLDERS - exactly these).

/** @typedef {'brutal'|'witty'|'humorous'|'arrogant'|'cold'|'zealous'|'unhinged'|'honourable'|'craven'|'weary'} PersonalityId */
/** @typedef {'taunt_slew'|'taunt_fled'|'taunt_risen'|'flee'|'cornered'|'escape'|'slain'|'rise'|'yield'|'executed'|'spared'|'slip'|'arrive'|'dismiss'|'downed'|'kill'|'battle'|'release'|'learned'|'signature'|'laststand'|'stole'|'festered'|'felled_return'|'routed_return'|'deserted'|'betrayed'|'devoted_warn'} VoiceEvent */

/** The ten, with the card's word for each, a line for the page, and a beast's manner. */
export const PERSONALITIES = Object.freeze({
  brutal: Object.freeze({ label: 'Brutal', blurb: 'Savage, blunt, and hungry for blood.', manner: 'with a savage snarl' }),
  witty: Object.freeze({ label: 'Witty', blurb: 'Sharp-tongued, sardonic, never short of a barb.', manner: 'with an almost knowing glint' }),
  humorous: Object.freeze({ label: 'Humorous', blurb: 'Laughs at everything - your death included.', manner: 'with a playful yip' }),
  arrogant: Object.freeze({ label: 'Arrogant', blurb: 'Proud, haughty, and certain it is your better.', manner: 'with its head held high' }),
  cold: Object.freeze({ label: 'Cold', blurb: 'Quiet, patient, and utterly without mercy.', manner: 'in eerie silence' }),
  zealous: Object.freeze({ label: 'Zealous', blurb: 'Fervent - sees the hand of the gods in every blow.', manner: 'with wild, burning eyes' }),
  unhinged: Object.freeze({ label: 'Unhinged', blurb: 'Manic, giggling, and impossible to predict.', manner: 'with a frenzied howl' }),
  honourable: Object.freeze({ label: 'Honourable', blurb: 'A duellist with a code - fights fair, and expects the same.', manner: 'with a steady, measured gaze' }),
  craven: Object.freeze({ label: 'Craven', blurb: 'All bluster and nerves - brave only from behind.', manner: 'with a nervous whine' }),
  weary: Object.freeze({ label: 'Weary', blurb: 'Tired of the killing, and of you most of all.', manner: 'with a tired, rumbling sigh' }),
});
/** @type {readonly PersonalityId[]} */
export const PERSONALITY_IDS = Object.freeze(/** @type {PersonalityId[]} */ (Object.keys(PERSONALITIES)));
export const isPersonality = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(PERSONALITIES, id);

/** Every moment with a word. */
/** @type {readonly VoiceEvent[]} */
export const VOICE_EVENTS = Object.freeze(/** @type {VoiceEvent[]} */ ([
  'taunt_slew', 'taunt_fled', 'taunt_risen', 'flee', 'cornered', 'escape', 'slain', 'rise',
  'yield', 'executed', 'spared', 'slip', 'arrive', 'dismiss', 'downed', 'kill', 'battle', 'release',
  // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): what it learned, its signature, its last stand, what it took, its
  // festering, its return after felling a companion or routing me, a sworn one's desertion and betrayal, a Devoted one's
  // warning
  'learned', 'signature', 'laststand', 'stole', 'festered', 'felled_return', 'routed_return', 'deserted', 'betrayed', 'devoted_warn',
]));

// ── the words ───────────────────────────────────────────────────────
/** @type {Readonly<Record<PersonalityId, Readonly<Record<VoiceEvent, readonly string[]>>>>} */
const LINES = deepFreeze({
  brutal: {
    taunt_slew: ["I broke you once, {p}. I'll break you slower this time.", 'Your skull still owes me a crack, {p}.', 'I remember the sound you made when you fell. Make it again.'],
    taunt_fled: ["You cut me, {p}. I've come for the meat you owe.", 'I bled for you. Now you bleed for me.', 'I ran to sharpen my blade. Feel how sharp.'],
    taunt_risen: ['Every time you fall, I come back hungrier.', "I've buried you before, {p}. The hole's still open.", 'Again and again I break you, {p}. I never tire of it.'],
    flee: ['Not here. Not like this!', "I'll come back and tear you apart!"],
    cornered: ["Fine. I'll gut you where I stand!", 'Cornered beasts bite hardest!'],
    escape: ['Next time, I take your head, {p}.', 'Heal up. I want you whole when I break you.'],
    slain: ["Should've... hit... harder...", 'Blood... for blood...'],
    rise: ["Get up, {p}. I'm not finished with you.", 'I licked your blood off my blade. I want more.'],
    yield: ['Do it, then! Or are you too soft?', "I'm beaten... for now. Choose quick.", "Finish it, {p}, or I'll finish you later."],
    executed: ['Make it... messy...', 'Ha! Hit like you mean it!', "I'll be waiting... in the dark..."],
    spared: ["Mercy? Stupid. ...But I'll fight for you. For now.", "You could've cut me down. Then I'll cut down whatever you point at.", 'Weakness. Fine. Point me at something to kill.'],
    slip: ['Too slow, {p}! Too soft!', "Hesitate again and I'll have your throat."],
    arrive: ['Who needs killing?', "Back. Where's the blood?"],
    dismiss: ["Fine. Call when there's killing to do.", "Bah. I'll be sharpening something."],
    downed: ['Just... a scratch...', 'Get them... for me...'],
    kill: ['Another one for the pile!', "Ha! That's how it's done!"],
    battle: ['Blood! Finally!', 'Leave the big one to me!'],
    release: ["Free? Then I go where the fighting is. Don't follow.", "Hmph. Next time we meet, maybe I'll kill you."],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ["I know your {how} now, {p}. You won't catch me twice.", "Your {how} again? My scars say I'm ready."],
    signature: ['Taste {move}!', '{move}! Break!'],
    laststand: ['Not yet! NOT YET!', "You'll have to cut me apart, {p}!", "I'm still standing. Your mistake."],
    stole: ['Still miss your {item}, {p}? Come and try me.', "I've bloodied your {item} since we last met."],
    festered: ['I waited, {p}. The waiting made me hungry.', "Too long, {p}. I'm starving for you."],
    felled_return: ["Where's {ally}, {p}? I'll break the rest of you.", "{ally} fell easy. You'll fall slower."],
    routed_return: ["You ran, {p}. Your legs won't save you twice.", 'Run again. I like the chase.'],
    deserted: ["I'm done fetching for you, {p}.", "Next time we meet, it's your blood I want."],
    betrayed: ["You're bleeding, {p}. I smell it.", "Weak. I don't follow the weak.", "Your throat's mine now."],
    devoted_warn: ['Behind you, {p}!', "Back! Something's at your back!"],
  },
  witty: {
    taunt_slew: ['Ah, {p}! Back from the dead? Even Arkay sent you back - he must have found you tiresome too.', 'Last time went so well for me. Shall we?', 'You again? I did enjoy our first dance, {p}.'],
    taunt_fled: ['Missed me, {p}? Clearly. You missed a great deal.', "I left early last time. Rude of me. I've come to finish the conversation.", "Remember me? I'm the one you couldn't catch."],
    taunt_risen: ['We really must stop meeting like this, {p}. You keep losing.', 'Your persistence is touching. Futile, but touching.', "I'd say you look well, {p}, but we both know how this ends."],
    flee: ['A strategic withdrawal! Write it down!', 'Lovely chat. Must dash!'],
    cornered: ["Ah. Well, that's inconvenient.", "Fine. I'll do this the tedious way."],
    escape: ['Do keep the scar I gave you, {p}. A keepsake.', 'Until next time. Do practise.'],
    slain: ['Well... that was... unexpected...', "At least... I had the last word... didn't I?"],
    rise: ['Dying suits you, {p}. Do it again sometime.', "I've been telling everyone about you. They laugh."],
    yield: ['Well. This is awkward. Perhaps we can be civil?', 'I concede, {p}. Graciously, mind you.', "You win. Don't let it go to your head - it's large enough."],
    executed: ['Clever. Predictable, but clever.', 'Remember... I let you win...', 'At least make it a good story, {p}.'],
    spared: ["Mercy? How refreshingly unwise. I'm yours, {p}.", 'Spared! Then I suppose I owe you my sparkling company.', "You'll regret this. Then again, so might they."],
    slip: ["Thinking it over, {p}? I'll save you the trouble.", 'Indecision is a terrible habit. Ta!'],
    arrive: ["Did you miss me? Don't answer.", 'The wit has arrived. You may continue.'],
    dismiss: ['Off I go, then. Try not to die without me.', 'A holiday! How generous.'],
    downed: ["I'm... resting... dramatically...", 'Tell them... I was magnificent...'],
    kill: ["Didn't even scuff my boots.", 'One less critic.'],
    battle: ['Ooh, company!', 'Shall we dance, then?'],
    release: ['Free? How novel. Do write.', 'Farewell, {p}. You were almost tolerable.'],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['Your {how} again? I took notes last time, {p}.', "I've studied your {how}. Rather dull, really."],
    signature: ['Allow me to introduce {move}.', 'And now, {move}. Do try to keep up.'],
    laststand: ["Ah, the second act. You didn't think I'd skip it?", 'Down? Merely resting my eyes.', "You'll find I'm terribly hard to finish, {p}."],
    stole: ['I do your {item} more justice, {p}. Admit that much.', "Lovely {item}. I've been taking excellent care, I promise."],
    festered: ['You kept me waiting, {p}. Rude.', 'I had time to sharpen my wit and my blade.'],
    felled_return: ['How is {ally}? Still seeing stars?', '{ally} sends regards. Faintly.'],
    routed_return: ['Back from your little sprint, {p}?', 'I do admire a strategic retreat. Yours was not one.'],
    deserted: ["It's been charming, {p}. Truly. Goodbye.", 'Consider this my resignation.'],
    betrayed: ['Nothing personal, {p}. Mostly.', 'You look tired. Let me help you rest.', "Did you really think I'd stay?"],
    devoted_warn: ['Do glance behind you, {p}!', 'Your back, {p} - it has company!'],
  },
  humorous: {
    taunt_slew: ['{p}! My favourite corpse! Ha!', "Back again? You're like a bad penny - you keep turning up!", 'Last time you fell so hard, I think you dented the road!'],
    taunt_fled: ["Ha! You're the one who chased me! I'm faster now - I've been practising!", "Remember me? I'm the one who got away! Best day of my life!", 'I ran so fast last time I lost a boot. Want to see where?'],
    taunt_risen: ["Round three! Or is it four? I've lost count - you haven't!", "I've killed you so often I've started a tally on my arm!", 'You again! Should I start charging you rent on my blade?'],
    flee: ["Look behind you! ...Hah, no, I'm leaving!", 'Time for my legs to do the fighting!'],
    cornered: ["Nowhere to run? Then I'll run at you!", 'Oh, bother. Fine, fine - fisticuffs!'],
    escape: ["Tag! You're it, {p}!", 'Catch me next time! Bring snacks!'],
    slain: ["Ha... hah... that one's... on me...", 'Tell the others... I died laughing...'],
    rise: ['Up you get, {p}! You owe me a rematch!', 'You make a lovely doormat, {p}!'],
    yield: ['All right, all right! I give! I give!', "Mercy? I'll tell you a joke! It's very funny! Please?", 'You win! Want to hear how good you were?'],
    executed: ['Is this... the punchline...?', 'Heh... worst joke yet...', "Well, that's... a killer ending."],
    spared: ["Ha! You won't regret this! You might regret this! Either way, it'll be fun!", "Friends? Friends! I'll carry the snacks!", 'Spared! Wait till they hear this one!'],
    slip: ['Whoops! Too slow! Byeee!', 'You blinked! I saw you blink!'],
    arrive: ['Did someone call for a good time?', "I'm back! Did you get lonely?"],
    dismiss: ['Off for a nap, then! Wake me for the fun bits!', "Right, I'll be at the tavern. Somewhere. Probably."],
    downed: ['Owie... somebody... kiss it better...', "I'm fine! I'm... lying down on purpose..."],
    kill: ['And stay down! Ha!', 'Did you see that? Tell me you saw that!'],
    battle: ['Party time!', "Ooh, this'll be a good one!"],
    release: ["Free! Ha! Don't forget me, {p}!", "I'll tell everyone about you! Mostly the good bits!"],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['Ha! Your {how} again? I know that one, {p}!', "Same old {how}? I've seen this act!"],
    signature: ['Here comes {move}! Hold still!', 'Ta-da! {move}!'],
    laststand: ['Ha! Did you think that was the end?', 'Encore! Encore!', "You'll have to try harder than that, {p}!"],
    stole: ['Your {item} makes a lovely joke, {p}!', "I've named your {item}. We get along famously."],
    festered: ['I got bored waiting, {p}! Bored and bigger!', "All that waiting - I'm bursting with jokes!"],
    felled_return: ['{ally} went down laughing! Well, I laughed.', 'Tell {ally} I said boo!'],
    routed_return: ["You ran so fast, {p}! Let's race again!", 'Ha! Run, run, as fast as you can!'],
    deserted: ["The joke's over, {p}. Ha! I'm leaving.", "Don't wait up for me, {p}!"],
    betrayed: ['Surprise! Ha!', 'Oh, your face, {p}!', 'The best joke is the last one, {p}!'],
    devoted_warn: ['Ha! Look behind you, {p}!', 'Duck, {p}! No - turn!'],
  },
  arrogant: {
    taunt_slew: ['Kneel, {p}. You did it so well last time.', 'Did you truly think you could best me twice?', 'I remember your fall, {p}. It was beneath me - as are you.'],
    taunt_fled: ['I did not flee, {p}. I declined to waste my time.', 'You wounded my pride. That was your mistake.', 'I have returned to correct your little victory.'],
    taunt_risen: ['Each time I rise, you shrink.', 'You are a footnote in my legend, {p}.', 'Kneel now, {p}, and spare us both the tedium of your death.'],
    flee: ['You are not worth the effort!', 'This is beneath me!'],
    cornered: ['You dare corner me? Then witness true power!', 'Very well. I shall end you myself.'],
    escape: ["Savour this, {p}. It is the last time you'll see my back.", 'I allow you to live. For now.'],
    slain: ['Impossible... I am... superior...', 'You... are nothing... to me...'],
    rise: ['Rise, {p}, and remember who put you down.', 'Your death was so very ordinary.'],
    yield: ['I... yield. Do not mistake this for respect.', 'Fine. You have won. Savour it - it will not happen again.', 'Spare me and I may yet find you useful.'],
    executed: ['I was... meant for... greater...', 'History... will remember me... not you...', 'Do it, then. Without me, you are nothing.'],
    spared: ['You recognise my worth. Wise. I shall serve - for now.', 'Very well. My blade is yours. Try to keep up.', 'Mercy from an inferior. How novel. I accept.'],
    slip: ['You hesitated. Of course you did.', 'Too weak to choose, {p}? I shall choose for you.'],
    arrive: ['I have graced you with my return.', 'You summoned me? Naturally.'],
    dismiss: ['I shall await your inevitable need of me.', 'Finally, some peace from your bumbling.'],
    downed: ['This... is undignified...', 'I... shall... recover...'],
    kill: ['As expected.', 'Know your place, wretch.'],
    battle: ['Stand aside. Watch how it is done.', 'They challenge us? Pitiful.'],
    release: ['You release me? I was never truly bound.', 'Remember that I chose to serve you, {p}.'],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['I am above your {how} now, {p}.', 'I have mastered your {how}. Bow.'],
    signature: ['Behold {move}!', 'Witness {move}, and despair.'],
    laststand: ['You cannot fell your betters, {p}.', 'I do not fall to the likes of you!', 'Rise? Of course I rise.'],
    stole: ['You wasted your {item}, {p}. I do not.', 'My {item} now. Fitting, yes?'],
    festered: ['You made me wait. I grew greater for it.', 'I do not wait, {p}. I gather.'],
    felled_return: ["{ally} knelt to me. You'll follow.", 'Your {ally} was the lesser. As are you.'],
    routed_return: ['You fled from me, {p}. Remember that.', 'Running suits you. Do it again.'],
    deserted: ['I serve no one, {p}. Least of all you.', 'My oath was a courtesy. It ends.'],
    betrayed: ["Did you think I'd kneel forever?", 'Your weakness disgusts me, {p}.', 'Bow to me now, {p}.'],
    devoted_warn: ['At your back, {p}! Turn!', 'Behind you - deal with it!'],
  },
  cold: {
    taunt_slew: ['You died by my hand once. The arithmetic has not changed.', 'I counted your heartbeats as they stopped, {p}.', 'Again, then. Quietly.'],
    taunt_fled: ['I withdrew to learn. I have learned.', 'Your blade was a lesson. I have studied it.', 'I left. I returned. That is all.'],
    taunt_risen: ['Each death is a lesson. Yours are many.', 'You keep returning. So do I. Only one of us improves.', 'I know how you fight now, {p}. That is why you keep dying.'],
    flee: ['Withdrawal is optimal.', 'Not now.'],
    cornered: ['Then we end it here.', 'Acceptable.'],
    escape: ['We will resume this later.', 'I will find you when you are tired.'],
    slain: ['...Noted.', 'So... this is the end... of it.'],
    rise: ['You are alive again. A temporary condition.', 'I am patient, {p}.'],
    yield: ['I am defeated. Decide.', 'Your choice, {p}. I will not beg.', 'Further resistance is wasteful. Decide.'],
    executed: ['Efficient.', '...Expected.', 'Make it clean.'],
    spared: ['An unexpected variable. I will follow it.', 'You spared me. I will repay the debt precisely.', 'Very well. My blade is yours until the account is settled.'],
    slip: ['You hesitated. I did not.', 'Indecision. Fatal, eventually.'],
    arrive: ['I am here.', 'Present.'],
    dismiss: ['Understood.', 'I will wait.'],
    downed: ['Damage... severe...', 'I must... withdraw...'],
    kill: ['One fewer.', 'Done.'],
    battle: ['Hostiles.', 'Engaging.'],
    release: ['The debt is paid. Farewell, {p}.', 'Then our account is closed.'],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['I have measured your {how}. Nothing remains.', 'I have adapted to your {how}, {p}.'],
    signature: ['{move}.', 'Now. {move}.'],
    laststand: ['Not yet.', 'Your blow was insufficient.', 'I continue.'],
    stole: ['I still hold your {item}.', 'I have kept your {item}, {p}. To good use.'],
    festered: ['The waiting changed nothing. Except me.', 'Time has made me more.'],
    felled_return: ['{ally} fell. You are next.', 'One down. {ally} first, then you.'],
    routed_return: ['You fled. It was noted.', 'Distance will not help you twice, {p}.'],
    deserted: ['This arrangement is concluded.', 'I am leaving, {p}. Do not follow.'],
    betrayed: ['It was always going to end here.', 'You are weak. I am not.', 'Goodbye, {p}.'],
    devoted_warn: ['Behind you.', '{p}. Your back.'],
  },
  zealous: {
    taunt_slew: ['The gods gave me your life once, {p}. They hunger again!', 'I offered your blood at the altar. It was not enough!', 'Your death was a prayer answered. Pray with me again!'],
    taunt_fled: ['I fled to seek a sign. You are the sign, {p}!', 'The Divines spared me so I could strike you down!', 'My wounds were a test. I have passed. Have you?'],
    taunt_risen: ['I am reborn each time in holy fire!', 'The heavens will not let me die until you do!', 'Every death of yours is a prayer answered, {p}!'],
    flee: ['The gods call me away!', 'This is not my appointed hour!'],
    cornered: ['Then I will die a martyr - and take you with me!', 'Witness my faith!'],
    escape: ['Fate binds us, {p}. We will meet again.', 'The heavens shelter the faithful!'],
    slain: ['Into the light... I go...', 'My gods... receive me...'],
    rise: ['You rise, {p}? The gods enjoy a long sacrifice.', "Pray, {p}. Pray I don't find you."],
    yield: ['I submit to the will of the gods... and to you.', 'If I am to die, let it be swift and holy.', 'The gods have humbled me. Judge me, {p}.'],
    executed: ['The light... takes me...', 'I go to my reward!', 'My god... will not... forgive you...'],
    spared: ['Mercy! A sign from the heavens! I will follow you, {p}!', 'The gods have spared me through your hand. I am yours.', 'A miracle! My blade is consecrated to your cause!'],
    slip: ['The gods have opened a door! Farewell!', 'Your doubt is my deliverance!'],
    arrive: ['The faithful answer!', 'I come, as the gods command!'],
    dismiss: ['I will pray for your return.', 'I go to meditate on your glory.'],
    downed: ['My faith... wavers...', 'Gods... grant me... strength...'],
    kill: ['Judged!', 'Sent to their gods!'],
    battle: ['For the Divines!', 'The heathen approach!'],
    release: ['My vow is fulfilled. The gods walk with you, {p}.', 'I go to spread the word of your mercy.'],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['The gods taught me your {how}, {p}!', 'Your {how}? A sin the gods forgave me!'],
    signature: ['By the gods - {move}!', '{move}, by their will!'],
    laststand: ['The gods will not let me fall!', 'I am lifted up! I rise again!', 'Not by your hand, {p}!'],
    stole: ['I have consecrated your {item}.', 'The gods gave me your {item}, {p}.'],
    festered: ['My fervour only grew, {p}.', 'The gods kept me waiting. Now they unleash me.'],
    felled_return: ['{ally} was judged, {p}. So will you be.', 'The gods struck {ally} down by my hand.'],
    routed_return: ['You fled judgement, {p}. It caught up.', 'No one outruns the gods, {p}.'],
    deserted: ['The gods call me elsewhere.', 'My faith was never in you, {p}.'],
    betrayed: ['The gods have turned from you, {p}!', 'Your judgement has come!', 'I serve a higher power, {p}!'],
    devoted_warn: ['The gods warn you - behind!', 'Turn, {p}! Behind you!'],
  },
  unhinged: {
    taunt_slew: ['Hee-hee! {p}! You died! I watched! Again, again!', "The voices said you'd come back! They're never wrong, {p}!", 'I kept your scream. In a jar. Want to hear it?'],
    taunt_fled: ["I ran! And ran! And ran! Now I'm here! Hello!", "Do you hear it, {p}? The buzzing? It's you. It's always been you.", 'I counted the stars while I healed. There were nine. NINE!'],
    taunt_risen: ["We keep dying! Isn't it wonderful?", 'Over and over and over and OVER, {p}!', "I count your deaths in my sleep, {p}! I've run out of fingers!"],
    flee: ['Not yet! Not YET! Hahaha!', 'The walls are talking! I must go!'],
    cornered: ['Trapped! Like old times! Hahaha!', "Then we'll dance, {p}! DANCE!"],
    escape: ["Bye-bye! Don't forget me! You can't!", "I'll be in your dreams, {p}! Every night!"],
    slain: ["Hee... it's so... quiet...", 'The voices... stopped...'],
    rise: ["Alive again! Let's do it all over!", 'I wrote your name on every tree, {p}!'],
    yield: ["Stop stop stop! I'll be good! I'll be SO good!", 'Hehe... you win! Do I get a prize?', 'Kill me? Keep me? Oh, the suspense! Hee-hee!'],
    executed: ['Ooh... colours...', 'Hehe... finally... quiet...', 'Wheee...'],
    spared: ["Friends! We're FRIENDS now! I'll keep the voices quiet - most of them!", "You let me live! I'll follow you EVERYWHERE!", 'Spared! Hee! Who do we stab first?'],
    slip: ['Too slow! Too SLOW! Hahaha!', "You're thinking! I can hear you thinking! Bye!"],
    arrive: ["I'M BACK! Did you miss me? You did!", 'Hello hello hello!'],
    dismiss: ["Leaving? I'll be RIGHT here. Watching.", "Okay! Byeee! Don't forget!"],
    downed: ["Ooh... the ground's... spinning...", 'Hee... ouch...'],
    kill: ['Broken! All broken! Hahaha!', 'Again! Do it again!'],
    battle: ['Ooh! Playmates!', 'Let me at them! LET ME AT THEM!'],
    release: ['Free! Free as a bird! A mad bird!', "Bye-bye, {p}! I'll visit! In your sleep!"],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ["Hee! I'm not scared of your {how} anymore!", 'I know your {how} now, {p}! Hee hee!'],
    signature: ['{move}! {move}! {move}!', 'Here it comes - {move}! Hee!'],
    laststand: ['Hee hee! Not dead! Not DEAD!', 'More! Do it again!', "I'm still laughing, {p}! Hear me?"],
    stole: ['I sleep with your {item}, {p}! Hee!', 'I hear your {item} whisper at night!'],
    festered: ['So long! So long I waited! Hee!', 'The waiting made the voices louder, {p}!'],
    felled_return: ['{ally} broke so nicely! Can I break you?', "Where's {ally}? Ha! Gone! Gone!"],
    routed_return: ['Run, rabbit, run! Again! Again!', 'You ran! I followed! Hee!'],
    deserted: ['Bye bye, {p}! Hee hee!', 'The voices say go. So I go!'],
    betrayed: ['Hee hee! Did you think I liked you?', "You're bleeding so pretty, {p}!", "Now it's MY turn, {p}!"],
    devoted_warn: ['Behind! Behind! BEHIND!', "{p}! There's one at your back! Hee!"],
  },
  honourable: {
    taunt_slew: ['You fought well, {p}, and you fell well. Let us do it properly again.', 'I bear you no hatred. Only unfinished business.', 'Draw, {p}. Let the better blade decide.'],
    taunt_fled: ['I fled our duel, {p}. That shame ends today.', 'I owe you a fair fight. I have come to pay.', 'You gave me my scars honestly. I return them the same way.'],
    taunt_risen: ['Each time we cross blades, you grow stronger. So do I.', 'No tricks, no ambush. Just steel, {p}.', 'Once more, {p}. I take no joy in it, but I will not hold back.'],
    flee: ['Forgive me - I must withdraw!', 'Another day, {p}!'],
    cornered: ['So be it. I face you with honour.', 'No more running. Have at you!'],
    escape: ['Live well until we meet again, {p}.', 'I will return when I am worthy.'],
    slain: ['A good death... thank you...', 'Well fought... {p}...'],
    rise: ['Rise, {p}. Heal, and find me.', "You fought bravely. I hope you'll do so again."],
    yield: ['I yield, {p}. Your blade is the better.', 'The fight is yours. I accept your judgement.', 'I have lost fairly. Do what honour demands.'],
    executed: ['An honourable end... I thank you.', 'Strike true.', 'I die... without regret.'],
    spared: ['You show mercy to a beaten foe. I am in your debt for life.', 'My sword is yours, {p}, until my debt is paid.', 'Spared with honour. I will serve with honour.'],
    slip: ['Forgive me. I will not wait to die.', 'You hesitate. I will not take that for mercy.'],
    arrive: ['I stand ready, {p}.', 'At your side.'],
    dismiss: ['As you command.', 'I will keep watch until you call.'],
    downed: ['Forgive me... I faltered...', 'Fight on... without me...'],
    kill: ['A clean blow.', 'Rest now, foe.'],
    battle: ['Stand with me!', 'Face me, if you dare!'],
    release: ['My debt is paid. Go with honour, {p}.', 'Farewell, friend. I will not forget your mercy.'],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['I have learned your {how}, {p}. Fight me fairly.', 'Your {how} will not serve you again.'],
    signature: ['Guard yourself - {move}!', 'I give you fair warning: {move}!'],
    laststand: ['I am not yet beaten, {p}.', 'Again, then. On your guard.', 'My honour holds me up.'],
    stole: ['I earned your {item} as a trophy.', 'Win back your {item}, {p}, if you can.'],
    festered: ['You did not come. I grew impatient.', 'I waited for an honest fight, {p}.'],
    felled_return: ['{ally} fought well. Tell them so.', 'I bested {ally} fairly. Now you.'],
    routed_return: ['You fled the field, {p}. Stand this time.', 'There is no shame in retreat. Once.'],
    deserted: ['My oath is broken, {p}. I am sorry for it.', 'You have not kept faith with me. I go.'],
    betrayed: ['You have no honour left to keep me, {p}.', 'Forgive me. I cannot follow you.', 'Face me, then. As enemies.'],
    devoted_warn: ['Have a care - behind you!', '{p}! Guard your back!'],
  },
  craven: {
    taunt_slew: ['I-I killed you once! I can do it again! Probably!', 'Stay back! Remember what happened last time!', 'Ha! It\'s you! The one I... the one I beat! Yes!'],
    taunt_fled: ["I wasn't running! I was... getting help!", 'You again? I mean - you again! Fear me!', "I've brought friends this time! ...They're hiding."],
    taunt_risen: ['I keep winning! So stop coming back!', 'Leave me alone! I mean - die!', "I-I've beaten you before! I can do it again! ...Probably!"],
    flee: ['Run! RUN!', 'Not my face! Not my face!'],
    cornered: ["No! No! Fine - I'll bite!", "Keep away! I'm warning you!"],
    escape: ["Ha! Can't catch me! ...Please don't try.", "Safe! Safe! I'm safe!"],
    slain: ['I... should have... stayed home...', 'Not... fair...'],
    rise: ["I-it's you again? I thought you'd stay dead!", "D-don't come looking for me, {p}!"],
    yield: ["Mercy! Mercy! I'll do anything!", 'Please, please, I have... I have a mother!', "Don't kill me! I'm useful! I'm very useful!"],
    executed: ['Not like this...!', 'Wait - WAIT -', 'Mother...!'],
    spared: ["Th-thank you! I'll carry your things! I'll do anything!", "You won't regret it! I'm very brave now! Mostly!", "Spared! Oh, thank the gods! I'll follow you - from behind!"],
    slip: ['Run run run run!', 'Bye! Sorry! BYE!'],
    arrive: ["I'm here! Is it safe?", 'D-did you need me?'],
    dismiss: ['Oh thank the gods - I mean, as you wish!', "I'll be... somewhere safe!"],
    downed: ["I'm dead! I'm dead! ...Am I dead?", 'Ow! Ow! Ow!'],
    kill: ['I did that! Did you see? I did that!', 'Is it dead? Poke it.'],
    battle: ['Oh no. Oh no no no.', 'You go first!'],
    release: ["Free? Truly? I'll never fight again!", "Thank you, {p}! Don't come looking for me!"],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['I-I know your {how} now, {p}! Ha!', "Your {how} won't scare me... much."],
    signature: ['Th-there! {move}!', 'Take {move}, and leave me be!'],
    laststand: ['N-no! Not like this!', "I-I'm not done! I'm not!", "Stay back! I'll fight! I will!"],
    stole: ['Y-your {item}? Finders keepers!', "I'm keeping your {item}, {p}. Please don't hurt me."],
    festered: ["I hid for days, {p}. Now I'm angry!", 'All that waiting made me brave. Almost.'],
    felled_return: ['I-I beat {ally}! Me!', 'Scared, {p}? {ally} was.'],
    routed_return: ["Even I didn't run that fast, {p}!", 'You ran! From ME! Ha!'],
    deserted: ["S-sorry, {p}. I'm off.", "It's too dangerous with you!"],
    betrayed: ["S-sorry, {p}! It's you or me!", "You're losing! I'm with the winners!", "Don't look at me like that!"],
    devoted_warn: ['B-behind you, {p}!', 'Look out! Your back!'],
  },
  weary: {
    taunt_slew: ['I took your life once, {p}. It brought me no peace.', 'Must we do this again? Yes... I suppose we must.', 'I have dreamt of your fall every night since.'],
    taunt_fled: ['I ran, and the running never ended. Let it end here.', 'My scars ache when you are near, {p}.', 'Old wounds, old grudges. Here we are.'],
    taunt_risen: ['So many deaths. So much blood. Let this be the last.', 'I am so tired of killing you, {p}.', 'Must we, {p}? I have buried you enough times already.'],
    flee: ['Not today... not today...', 'I have no more fight in me.'],
    cornered: ['Then let it be over.', 'So it ends here, then.'],
    escape: ['Another day of this. Another day.', 'We will meet again. We always do.'],
    slain: ['At last... rest...', "It's... so quiet now..."],
    rise: ['You live again, {p}. I envy you.', 'The road goes on. So do we.'],
    yield: ['Enough. I am done with this.', 'End it, or let me go. I care little which.', "I yield. I'm so very tired."],
    executed: ['Thank you...', 'Finally...', 'Rest... at last...'],
    spared: ["Mercy... I had forgotten what it was. I'll walk with you, {p}.", 'You let me live. Then let me live for something.', 'Very well. One more road, then. With you.'],
    slip: ["Forgive me. I'm too tired to die today.", 'Another time, perhaps.'],
    arrive: ["I'm here. Where to?", 'Back again. The road calls.'],
    dismiss: ["I'll rest a while.", 'Call me when the road needs walking.'],
    downed: ['Just... let me sleep...', 'So... tired...'],
    kill: ['Another one. Always another.', 'Rest, poor thing.'],
    battle: ['Again. Always again.', "Let's get this over with."],
    release: ["Free. I'll find somewhere quiet, {p}. Thank you.", 'Farewell. May your road be kinder than mine.'],
    // RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): FEUD's moments
    learned: ['Your {how} again. I learned the hard way.', "I've had enough of your {how}, {p}."],
    signature: ["Here. {move}. Let's be done.", '{move}, then. If I must.'],
    laststand: ['Not yet. Somehow, not yet.', 'Will this never end?', "Again, then. I'm so tired, {p}."],
    stole: ["I still have your {item}. So heavy.", 'Your {item}, {p}? Come for me, then. Please.'],
    festered: ['Waiting is tiring too, {p}.', 'I got older waiting. And angrier.'],
    felled_return: ['{ally} needed the rest, {p}.', '{ally} went down. Like we all do.'],
    routed_return: ['You ran, {p}. I would have too.', "Running's tiring. Stand for once."],
    deserted: ["I'm tired, {p}. Of all of it.", 'I need to be somewhere quiet.'],
    betrayed: ["I'm sorry, {p}. I'm just so tired.", "Let's end this. One way or another.", 'You look as tired as I feel.'],
    devoted_warn: ['Behind you, {p}. Look.', '{p}... your back.'],
  },
});

/** A beast's moment, as the narrator tells it - `{manner}` its temperament's. */
/** @type {Readonly<Record<VoiceEvent, string>>} */
const BEAST = deepFreeze({
  taunt_slew: 'Circles you {manner}. It remembers the taste of you.',
  taunt_fled: 'Circles you {manner}, scarred. It knows your scent.',
  taunt_risen: 'Stalks you {manner}. It has come back again, and again.',
  flee: 'Breaks and bolts {manner}!',
  cornered: 'Cornered, it turns on you {manner}.',
  escape: 'Gone into the wilds {manner}. It will remember this.',
  slain: 'Falls {manner}. It is no more.',
  rise: 'Somewhere out there it waits {manner}. It remembers your scent.',
  yield: 'Sinks low before you {manner}, beaten.',
  executed: 'Meets its end {manner}.',
  spared: 'Rises slowly and falls in at your side {manner}.',
  slip: 'Seizes your hesitation and is gone {manner}.',
  arrive: 'Steps through the portal {manner}.',
  dismiss: 'Pads away through the portal {manner}.',
  downed: 'Collapses {manner}, spent.',
  kill: 'Stands over its kill {manner}.',
  battle: 'Lunges into the fray {manner}.',
  release: 'Looks back once {manner}, and is gone.',
  // RVN12a (Feud-Arc.md 23)
  learned: 'Circles you {manner}. It knows your ways now.',
  signature: 'Gathers itself {manner} for something terrible.',
  laststand: 'Rises again {manner}, refusing to die.',
  stole: 'Circles you {manner}, guarding something of yours.',
  festered: 'Stalks you {manner}, swollen with long waiting.',
  felled_return: 'Circles you {manner}. It remembers your companion falling.',
  routed_return: 'Stalks you {manner}. It remembers you running.',
  deserted: 'Slinks away through its portal {manner}.',
  betrayed: 'Turns on you {manner}!',
  devoted_warn: 'Snarls a warning {manner} - behind you!',
});

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
}

// ── who it is ───────────────────────────────────────────────────────
/** A small stable hash (FNV-1a) - the personality's seed. */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
// what it is leans who it is (mobile types: characters/mobileTypes.js) - a person may be anyone
const BEASTS = new Set([0, 3, 4, 5, 6, 11, 20, 34, 40, 41]);   // rat, bat, bear, tiger, spider, slaughterfish, scorpion, dragonlings, dreugh
const UNDEAD = new Set([15, 17, 18, 19, 23, 28, 30, 32, 33]);   // skeleton, zombie, ghost, mummy, wraith, vampires, liches
const DAEDRA = new Set([1, 25, 26, 27, 29, 31, 35, 36, 37, 38]);   // imp, frost/fire daedra, daedroth, seducer, lord, atronachs
const ORCISH = new Set([7, 12, 16, 21, 24]);   // orcs, the giant
// AUDIT (2026-10-02): the kinds that never speak (systems/revenant.js revenantSpeaks) - beasts, and the mindless dead and
// atronachs: a skeleton is never a wit nor a preacher, so it leans as a beast does
export const MUTE_KINDS = Object.freeze(new Set([0, 3, 4, 5, 6, 11, 15, 17, 20, 34, 35, 36, 37, 38, 40, 41]));
/** @type {Readonly<Record<string, readonly PersonalityId[]>>} */
const LEANS = deepFreeze({
  beast: ['brutal', 'brutal', 'craven', 'humorous', 'cold', 'unhinged', 'weary', 'honourable'],
  undead: ['cold', 'cold', 'zealous', 'weary', 'weary', 'arrogant', 'unhinged', 'witty'],
  daedra: ['arrogant', 'arrogant', 'witty', 'unhinged', 'zealous', 'cold', 'humorous'],
  orcish: ['brutal', 'brutal', 'humorous', 'arrogant', 'craven', 'honourable', 'witty'],
  other: ['brutal', 'witty', 'humorous', 'arrogant', 'unhinged', 'craven', 'honourable', 'weary', 'zealous'],
  person: PERSONALITY_IDS,
});
const leanOf = (mobileType) => (mobileType >= 128 ? 'person' : BEASTS.has(mobileType) || MUTE_KINDS.has(mobileType) ? 'beast' : UNDEAD.has(mobileType) ? 'undead'
  : DAEDRA.has(mobileType) ? 'daedra' : ORCISH.has(mobileType) ? 'orcish' : 'other');

/** WHO IT IS: one personality per revenant id - the same on every read, every client and every load - leaning by kind.
 *  @returns {PersonalityId} */
export function personalityFor(id, mobileType) {
  const pool = LEANS[leanOf(mobileType | 0)];
  return pool[hashStr(`voice:${id ?? ''}`) % pool.length];
}
/** The card's word for one ("Witty"), or null. */
export const personalityLabel = (id) => (isPersonality(id) ? PERSONALITIES[id].label : null);

// ── what it says ────────────────────────────────────────────────────
/** RVN12a (bible/12-Enhanced-AI/Feud-Arc.md 23): THE PLACEHOLDERS, exactly - `{p}` the player's first name, `{how}` a
 *  learned habit's word ("blade", "arrows", "fire"), `{item}` a piece it took, `{move}` its signature's name, `{ally}` the
 *  companion it felled. A line naming one its caller did not hand is passed over: none is said with a `{` left in it. */
export const VOICE_PLACEHOLDERS = Object.freeze(['p', 'how', 'item', 'move', 'ally']);
const PLACEHOLDER = /\{(p|how|item|move|ally)\}/g;
const fill = (s, vars) => s.replace(PLACEHOLDER, (_, k) => String(vars[k]));   // AUDIT (2026-10-02): a `$` in a typed name is a letter, never a pattern
const sayable = (s, vars) => [...s.matchAll(PLACEHOLDER)].every((m) => vars[m[1]] != null && vars[m[1]] !== '');
/** A name's possessive, one rule for every title ("Varis' Rod", "Grushnak's Shadow"). */
export const possessive = (name) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;
/** Every line a personality has for a moment (the page's, the tests'). */
export const voiceLines = (personality, event) => LINES[isPersonality(personality) ? personality : 'brutal']?.[event] ?? [];
/**
 * ITS WORDS for a moment, in its own voice: a speaker's quoted line, or null for a beast (`beastBody` says what it
 * does). `p` the player's first name; `rolls` the pick (a moment said twice need not repeat); RVN12a: `how`, `item`,
 * `move`, `ally` its moment's words (a line needing one not handed is passed over).
 */
export function voiceLine(personality, event, { p = 'stranger', rolls = Math.random, how = null, item = null, move = null, ally = null } = {}) {
  const vars = { p, how, item, move, ally };
  const pool = voiceLines(personality, event).filter((l) => sayable(l, vars));   // RVN12a: never a line it cannot fill
  if (!pool.length) return null;
  return fill(pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))], vars);
}
/** What a beast does at a moment, in its temperament - the narrator's sentence. */
export function beastBody(personality, event) {
  const manner = PERSONALITIES[isPersonality(personality) ? personality : 'brutal'].manner;
  return (BEAST[event] ?? 'Watches you {manner}.').replace('{manner}', manner);
}
