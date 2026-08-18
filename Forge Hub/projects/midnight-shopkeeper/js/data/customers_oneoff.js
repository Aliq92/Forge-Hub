// One-off customers — each appears exactly once, on the given night, unless reused by an event.
export const ONEOFFS = {

  elenor: {
    id: 'elenor', name: 'Elenor Bright', title: 'A Nervous Clerk', night: 1,
    portrait: { silhouette: 'slim', hair: 'short', hairColor: '#3a2a1e', skin: '#e3c2a0', outfit: '#6b4a5a', accent: '#c9a24b', prop: 'satchel' },
    greeting: 'A young woman in a damp office coat hovers by the door like she\'s not sure shops are meant to be open this late.',
    opening: '"Sorry — is it alright that I\'m in here? I have a meeting in the morning that could change everything and I have not slept in three days. I need something to help me sleep. Just... sleep, properly, tonight."',
    request: 'I need something to help me sleep, properly, just for tonight.',
    followups: [
      { q: 'What\'s the meeting about?', a: '"A promotion. Or a very polite way of telling me I\'m not ready for one. I\'ll find out either way at nine sharp."', tagHint: 'calm' },
      { q: 'Have you tried anything already?', a: '"Counting. Warm milk. Lying very still and hoping. None of it works past the second hour."', tagHint: 'sleep' },
    ],
    desiredTags: ['sleep', 'calm'], goodTags: ['dreams'], budget: 10,
    avoidItems: {},
    reactions: { perfect: ['She actually laughs with relief, just once. "That\'s it. That\'s exactly what I needed. Thank you — truly." She leaves looking two pounds lighter than she arrived.'] },
  },

  thom: {
    id: 'thom', name: 'Old Thom', title: 'A Lamplighter', night: 1,
    portrait: { silhouette: 'stout', hair: 'bald', hairColor: '#888', skin: '#c79a6b', outfit: '#4a5240', accent: '#c9a24b', prop: 'cane' },
    greeting: 'A weathered old man leans his lighting-pole against your doorframe with the ease of someone who has walked this street ten thousand times.',
    opening: '"Last house on my round tonight is a long way off, and my knees aren\'t what they were. I need something for a road that feels shorter than it is."',
    request: 'I need something for a road that feels shorter than it is.',
    followups: [
      { q: 'How long have you lit these streets?', a: '"Forty-one years, come spring. I knew this shop when it had a different sign, and a different face behind the counter."', tagHint: 'travel' },
      { q: 'Is it just the distance?', a: '"Mostly the dark parts, if I\'m honest. My own lanterns don\'t light my own way home, funnily enough."', tagHint: 'light' },
    ],
    desiredTags: ['light', 'travel'], goodTags: ['warmth', 'courage'], budget: 9,
    avoidItems: {},
    reactions: { perfect: ['Thom holds it up and grins, the lines in his face deepening pleasantly. "That\'ll do it. That\'ll do it nicely." He tips his hat on the way out, an old-fashioned gesture that suits him.'] },
  },

  damp_stranger: {
    id: 'damp_stranger', name: 'A Damp Stranger', title: 'Just Passing Through', night: 1,
    portrait: { silhouette: 'tall', hair: 'hooded', hairColor: '#333', skin: '#b98a5e', outfit: '#37423a', accent: '#88897d', prop: 'none' },
    greeting: 'A stranger ducks in out of the rain, shakes off like a dog, and looks faintly embarrassed about it.',
    opening: '"Sorry. Just needed somewhere dry for a minute. Since I\'m here — you sell umbrellas? Nothing fancy. I don\'t need a story with it. Just something that keeps the rain off."',
    request: 'Do you sell umbrellas? Nothing fancy — just something practical.',
    followups: [
      { q: 'Are you sure that\'s all you need?', a: '"Positive. I know how this place has a reputation. Not everyone who walks in is here for a riddle." They say it kindly, not unkindly.', tagHint: 'practical' },
    ],
    desiredTags: ['practical', 'shelter'], goodTags: ['travel'], budget: 8,
    avoidItems: {},
    reactions: { perfect: ['"Perfect, thank you." They pay, nod, and head back out into the rain without ceremony — a reminder that not every customer is a mystery.'] },
    isTeachingBeat: true,
  },

  corin: {
    id: 'corin', name: 'Corin Hale', title: 'A Nervous Suitor', night: 2,
    portrait: { silhouette: 'slim', hair: 'curly', hairColor: '#2a2a2a', skin: '#d9ab7a', outfit: '#3a4a5c', accent: '#c9a24b', prop: 'none' },
    greeting: 'A young man paces outside your window twice before finally coming in, straightening his collar unnecessarily.',
    opening: '"I\'m asking someone an important question tomorrow. I need something for luck. Not fate — I don\'t want fate deciding this for me. Just a little luck, on my side, while I do the deciding myself."',
    request: 'I need something for luck. Not fate. Luck.',
    followups: [
      { q: 'Who is it for?', a: '"Someone who\'s known me long enough to say no properly if she means it. I\'d rather have that than someone new."', tagHint: 'connection' },
      { q: 'What are you willing to spend?', a: '"More than I should, honestly. This isn\'t really about money tonight."', tagHint: 'budget' },
      { q: 'Practical or sentimental?', a: '"Sentimental. Whatever I give her, she\'ll know I put thought into it and not just coin."', tagHint: 'sentimental' },
    ],
    desiredTags: ['luck', 'connection'], goodTags: ['promise', 'binding'], budget: 14,
    avoidItems: {},
    reactions: { perfect: ['He turns it over in his fingers, grinning helplessly. "This is exactly it. Not fate — luck. Thank you." He nearly forgets to pay, then does, generously.'] },
  },

  anne_callow: {
    id: 'anne_callow', name: 'Anne Callow', title: 'A Grieving Friend', night: 2,
    portrait: { silhouette: 'slim', hair: 'long', hairColor: '#5a4a3a', skin: '#e3c2a0', outfit: '#2f2f3a', accent: '#7d6a8a', prop: 'none' },
    greeting: 'A woman in dark clothes stands very straight, the way people stand when they\'re not sure they can sit down without something breaking.',
    opening: '"My dearest friend passed three weeks ago. I need something to remember her by. Not to forget her — I would never want to forget her. Just something to hold, on the nights it gets loud in my head."',
    request: 'I need something to remember her by. Not something to forget her with.',
    followups: [
      { q: 'What was she like?', a: '"Loud. Funny. Impossible to shop for, honestly — she already had opinions about everything." A small, genuine laugh escapes despite herself.', tagHint: 'love' },
      { q: 'What do you mean, "loud in your head"?', a: '"I keep hearing her voice mid-sentence, and then remembering there\'s no rest of the sentence coming. I don\'t want that to stop. I just want somewhere to put it."', tagHint: 'remembrance' },
    ],
    desiredTags: ['remembrance', 'memory', 'love'], goodTags: ['grief'], budget: 15,
    avoidItems: { dream_tea: '"No — no, I said I didn\'t want to forget her. I need the opposite of that, actually." She\'s not offended, just firm.' },
    reactions: { perfect: ['She holds it to her chest for a moment before she can speak. "Yes. This. Thank you for listening to what I actually said." She leaves a tip she can\'t really afford, and you don\'t have the heart to refuse it.'] },
  },

  innkeeper: {
    id: 'innkeeper', name: 'Bevin Marsh', title: 'A Sleepless Innkeeper', night: 3,
    portrait: { silhouette: 'stout', hair: 'short', hairColor: '#4a3a2a', skin: '#c79a6b', outfit: '#5a4632', accent: '#8a6b3f', prop: 'none' },
    greeting: 'A stocky man with permanent worry-lines drums his fingers on your counter, glancing at the door behind him twice.',
    opening: '"There\'s footsteps upstairs at my inn. Every night, same time, same hallway. Third floor\'s been empty for a month." He says it fast, like getting it out quickly makes it less true. "I need something that\'ll tell me if I should actually be worried."',
    request: 'I need something that will warn me if I should actually be worried, upstairs, at night.',
    followups: [
      { q: 'Have you checked the rooms?', a: '"Every one. Empty. Locked from the inside, some of them, which is worse, not better."', tagHint: 'warning' },
      { q: 'Does anyone else hear it?', a: '"My wife won\'t go up after dark anymore. So yes. It\'s not just me being tired."', tagHint: 'spirits' },
    ],
    desiredTags: ['warning', 'spirits'], goodTags: ['protection', 'listening'], budget: 16,
    avoidItems: {},
    reactions: { perfect: ['He hangs it that same night, apparently, because he\'s back three nights later just to report — unprompted — that it hasn\'t rung once. "Which either means nothing\'s up there, or it\'s being very well-behaved. I\'ll take either."'] },
    hintsRecipe: 'r_dream_ward',
  },

  bell_apprentice: {
    id: 'bell_apprentice', name: 'Tam Wren', title: 'A Bell-Ringer\'s Apprentice', night: 3,
    portrait: { silhouette: 'small', hair: 'braided', hairColor: '#7a3a2a', skin: '#e3c2a0', outfit: '#5c4a63', accent: '#c9a24b', prop: 'none' },
    greeting: 'A teenager in an oversized coat fidgets with a coil of rope, clearly rehearsing what to say.',
    opening: '"I ring the tower bell alone for the first time tomorrow. Everyone will be listening. I need something for courage. Not bravery — courage. My master says they\'re different and I still don\'t fully understand how, but I trust her."',
    request: 'I need something for courage. Not bravery. Courage.',
    followups: [
      { q: 'What\'s the difference, do you think?', a: '"She says bravery is not being scared. Courage is being scared and doing it anyway. I\'m extremely the second one right now."', tagHint: 'courage' },
      { q: 'What are you afraid of exactly?', a: '"Missing the count. Ringing it wrong in front of the whole square. Small thing, enormous feeling."', tagHint: 'confidence' },
    ],
    desiredTags: ['courage', 'confidence'], goodTags: ['voice'], budget: 8,
    avoidItems: {},
    reactions: { perfect: ['They tuck it into a coat pocket like a talisman. "Okay. Okay, I can do this." They say it to themself more than to you, and leave already looking a little taller.'] },
  },

  mirembe: {
    id: 'mirembe', name: 'Mirembe Solane', title: 'A Cartographer', night: 4,
    portrait: { silhouette: 'slim', hair: 'short', hairColor: '#1e1e1e', skin: '#8a5a3a', outfit: '#3a4a52', accent: '#c9a24b', prop: 'compass' },
    greeting: 'A woman with ink-stained fingertips and tired eyes unrolls a small map across your counter without quite asking permission.',
    opening: '"I map roads for a living. Lately I dream them too — roads I\'ve never actually walked, that don\'t connect to anything real. I need something for dreams that keep insisting on directions."',
    request: 'I need something for dreams that keep insisting on directions that don\'t exist.',
    followups: [
      { q: 'What do the roads look like?', a: '"Precise. Too precise for a dream. I wake up and I could draw them from memory, which is not how dreaming is supposed to work."', tagHint: 'dreams' },
      { q: 'Have you tried following one?', a: '"On paper, once. It led nowhere I recognized. I didn\'t try again."', tagHint: 'sleep' },
    ],
    desiredTags: ['sleep', 'dreams'], goodTags: ['calm'], budget: 12,
    avoidItems: { brass_compass: '"A compass would make it worse, wouldn\'t it? I need the roads to stop, not to trust them more." She says it with the particular clarity of someone who\'s already considered and rejected the obvious answer.' },
    reactions: { perfect: ['She exhales like she\'s been holding her breath for weeks. "That should quiet them down. Thank you — I was starting to think I\'d have to stop sleeping entirely to make it stop."'] },
    isTrapBeat: true,
  },

  errand_boy: {
    id: 'errand_boy', name: 'A Frightened Errand Boy', title: 'Sent by His Family', night: 4,
    portrait: { silhouette: 'small', hair: 'short', hairColor: '#3a2a1e', skin: '#d9ab7a', outfit: '#4a4038', accent: '#7d8a6b', prop: 'none' },
    greeting: 'A boy no older than ten counts a small handful of coins on your counter, silently, twice, before speaking.',
    opening: '"My mum sent me. She said get something for the door, quick, before you close, and don\'t spend more than this." He holds up the coins. "There\'s noises outside at night. She won\'t say what kind."',
    request: 'I need something for the door. It has to be cheap — this is all I have.',
    followups: [
      { q: 'What kind of noises?', a: '"Scratching, mostly. And once, someone said, a voice that knew our names, which nobody outside the house should know." He says it in the flat, unafraid voice of a kid repeating an adult\'s fear rather than owning it yet.', tagHint: 'protection' },
    ],
    desiredTags: ['protection', 'ward'], goodTags: ['boundary'], budget: 3,
    avoidItems: {},
    reactions: { perfect: ['He counts out exactly enough, no more, and pockets the change with great seriousness. "Thank you. I\'ll tell Mum it\'ll work." He believes it completely, which somehow makes you believe it too.'] },
  },

  memorial_bellringer: {
    id: 'memorial_bellringer', name: 'The Retired Bell-Ringer', title: 'An Old Friend of the Tower', night: 5,
    portrait: { silhouette: 'stout', hair: 'bald', hairColor: '#999', skin: '#c79a6b', outfit: '#3a3a4a', accent: '#8a6b3f', prop: 'cane' },
    greeting: 'An elderly man with enormous forearms and gentle eyes sets a small unlit candle stub on the counter, like an offering.',
    opening: '"Tomorrow\'s the anniversary of my wife\'s passing. Ten years. I light a candle at her grave every year, but this year I want something that burns warmer — smells like something, so it feels like she\'s there instead of just a flame."',
    request: 'I need a candle that smells like home. It has to smell like something, not just burn.',
    followups: [
      { q: 'What did home smell like, to her?', a: '"Bread, mostly. And rain on the window, which isn\'t a smell exactly, but you know what I mean if you\'ve loved someone that long."', tagHint: 'home' },
    ],
    desiredTags: ['home', 'comfort', 'memory'], goodTags: ['warmth'], budget: 10,
    avoidItems: {},
    reactions: { perfect: ['He holds it under his nose and closes his eyes for a long moment. "There she is," he says softly, and doesn\'t explain further, and doesn\'t need to.'] },
  },

  masked_reveler: {
    id: 'masked_reveler', name: 'A Masked Reveler', title: 'Fresh from the Festival', night: 5,
    portrait: { silhouette: 'tall', hair: 'hooded', hairColor: '#2a2a2a', skin: '#d9ab7a', outfit: '#7a2a3a', accent: '#d4af37', prop: 'none' },
    greeting: 'A figure in a gilded half-mask sweeps in trailing festival confetti and the unmistakable energy of someone who has already had a very good night.',
    opening: '"Darling shopkeeper! I need something extraordinary. Rare. A story to tell at the next party. Money is genuinely no object — I simply refuse to be seen with anything ordinary."',
    request: 'I need something extraordinary. Rare. Money is no object.',
    followups: [
      { q: 'What are you willing to spend?', a: '"However much makes you flinch slightly. That\'s usually the right number."', tagHint: 'budget' },
      { q: 'Practical or sentimental?', a: '"Neither! Impressive. There is a third category and it is the only one that matters tonight."', tagHint: 'impressive' },
    ],
    desiredTags: ['mystery', 'luck'], goodTags: ['secrets', 'value'], budget: 30, rarityPreferred: 'rare',
    avoidItems: {},
    reactions: { perfect: ['They gasp, genuinely delighted, and pay your asking price without a flicker of negotiation — then double it, "for the story." A very good customer to have on a slow night.'] },
    pricingBeat: 'expensive',
  },

  locksmith_widow: {
    id: 'locksmith_widow', name: 'Widow Okonkwo', title: 'A Locksmith\'s Widow', night: 6,
    portrait: { silhouette: 'slim', hair: 'bun', hairColor: '#3a3a3a', skin: '#8a5a3a', outfit: '#2f2f3a', accent: '#8a6b3f', prop: 'none' },
    greeting: 'A dignified woman sets a heavy iron key on your counter, the twin of one you may already recognize.',
    opening: '"My husband kept keys for half the town before he passed. Most I\'ve returned. This one matches nothing I can find, and it unsettles me to have it in the house any longer. I understand you buy odd things, as well as sell them."',
    request: 'I want to sell this. It doesn\'t fit any door I know, and I\'d rather it not be mine anymore.',
    followups: [
      { q: 'Did your husband ever mention it?', a: '"Once. He said it came from \'the shop with the good lanterns.\' I didn\'t think anything of it until I saw your sign." She studies you carefully. "Perhaps you\'ll know what it opens better than I did."', tagHint: null },
    ],
    isSellToShop: true, sellItem: 'iron_key_no_door', sellPrice: 12,
    desiredTags: [], goodTags: [], budget: 0,
    avoidItems: {},
    reactions: { perfect: ['She seems relieved to be rid of it, pressing the coin into her coat without counting it. "Good. Let it be someone else\'s question now."'] },
  },

  watchman: {
    id: 'watchman', name: 'A Weary Night-Watchman', title: 'Guarding Something Unnamed', night: 6,
    portrait: { silhouette: 'tall', hair: 'short', hairColor: '#2a2a2a', skin: '#b98a5e', outfit: '#37423a', accent: '#8a6b3f', prop: 'cane' },
    greeting: 'A tired man in a heavy coat leans against your doorframe rather than fully entering, as if he can\'t spare the time to come all the way in.',
    opening: '"Haven\'t slept properly in a fortnight. Can\'t — not while I\'m watching what I\'m watching. I need something for the noise in my own head, not the noise outside. That part I can handle myself."',
    request: 'I need something for the noise in my own head. Not outside — I can handle outside.',
    followups: [
      { q: 'What are you guarding?', a: 'He shakes his head slowly. "Can\'t say. Not won\'t — genuinely under orders not to. Don\'t make me regret coming in here."', tagHint: null },
      { q: 'How bad is it, really?', a: '"Bad enough I\'m buying from a shop that only opens after midnight instead of just going home. Draw your own conclusions."', tagHint: 'silence' },
    ],
    desiredTags: ['silence', 'calm'], goodTags: ['sleep', 'peace'], budget: 12,
    avoidItems: { sootglass_mirror: 'You start to reach for the mirror and stop yourself — it answers truth, not quiet, and this man very specifically did not ask to see anything. Offering it would be a mistake, not merely a poor match.' },
    reactions: { perfect: ['He almost smiles, which looks like it takes real effort. "That\'s the ticket. Cheers." He heads back out into the dark to whatever he\'s not allowed to name.'] },
  },

  sisters: {
    id: 'sisters', name: 'Priya Naeth', title: 'A Younger Sister', night: 7,
    portrait: { silhouette: 'slim', hair: 'long', hairColor: '#2a1e14', skin: '#a86f42', outfit: '#5c3a63', accent: '#e0c26b', prop: 'none' },
    greeting: 'A woman clutches a small wrapped box like it\'s already disappointing her.',
    opening: '"My sister and I don\'t talk much anymore. Long story. Her birthday is tomorrow and I want to give her something that says I remember — actually remember, not just the date. The little things. I need help; I don\'t trust myself to pick right anymore."',
    request: 'I need a gift that says I actually remember her, not just her birthday.',
    followups: [
      { q: 'What don\'t you trust about yourself?', a: '"We had a falling out. I\'ve second-guessed every gift I\'ve considered since, wondering if it\'s really for her or just to make myself feel better."', tagHint: 'grief' },
      { q: 'What does she love?', a: '"Small, specific things. She used to keep a little book of everyone\'s names and what mattered to them, so she\'d never forget a birthday or a favorite color. I always thought that was strange. I miss it."', tagHint: 'names' },
    ],
    desiredTags: ['names', 'memory'], goodTags: ['love', 'record'], budget: 18,
    avoidItems: {},
    reactions: { perfect: ['Her eyes well up before she\'s even finished reading the first page. "This is — yes. This is exactly her. Thank you." She leaves already rehearsing what she\'ll say.'] },
  },

  sailor: {
    id: 'sailor', name: 'A Feverish Sailor', title: 'Off the Late Tide', night: 7,
    portrait: { silhouette: 'stout', hair: 'short', hairColor: '#4a3a2a', skin: '#c79a6b', outfit: '#2f3a42', accent: '#7d8a6b', prop: 'none' },
    greeting: 'A sailor stumbles in, pale and sweating despite the cold, gripping the counter like it\'s the only steady thing in the room.',
    opening: '"Something\'s aboard my ship that shouldn\'t be. Crew won\'t say what, but nobody\'s slept right since we took on cargo at the last port. I need something for danger I can\'t see."',
    request: 'I need something for a danger I can\'t see, aboard a ship I can\'t leave.',
    followups: [
      { q: 'What happened at the last port?', a: '"Cargo came aboard at night, no manifest, captain\'s orders, no questions. I\'ve sailed twenty years and never seen the crew this rattled."', tagHint: 'danger' },
      { q: 'How dangerous is it, really?', a: '"Dangerous enough that I\'m here instead of asleep in my bunk. Dangerous enough I\'m not sure a ward will even help, but it\'s better than nothing."', tagHint: 'protection' },
    ],
    desiredTags: ['protection', 'danger'], goodTags: ['ward', 'courage'], budget: 14,
    avoidItems: { sootglass_mirror: 'The mirror seems tempting — danger, secrets, truth — but showing a frightened, feverish sailor "something true" about a threat he already can\'t escape feels needlessly cruel. He needs protection, not more to be afraid of.' },
    reactions: { perfect: ['He grips it like a lifeline, color returning to his face just slightly. "That\'s — yes. That helps. That actually helps." He hurries back out toward the docks before the tide turns.'] },
  },

  newcomer: {
    id: 'newcomer', name: 'A Bright-Eyed Newcomer', title: 'New to Town', night: 8,
    portrait: { silhouette: 'slim', hair: 'curly', hairColor: '#6a4a2a', skin: '#e3c2a0', outfit: '#4a5a6c', accent: '#c9a24b', prop: 'none' },
    greeting: 'A young stranger peers in with open delight rather than the usual midnight caution, clearly charmed rather than unsettled by the whole shop.',
    opening: '"I only just moved here — first week, actually. Everyone says this place is a little strange, but strange in a good way. I want something for my new room. Something that\'ll make it feel like mine already."',
    request: 'I need something for my new room. Something that\'ll make it feel like home already.',
    followups: [
      { q: 'What did your old home feel like?', a: '"Small, and loud, and full of people I already miss. I know that\'s a lot to ask an object to fix."', tagHint: 'home' },
    ],
    desiredTags: ['home', 'comfort'], goodTags: ['warmth', 'belonging'], budget: 10,
    avoidItems: {},
    reactions: { perfect: ['They hug it to their chest, beaming. "This town might be alright after all." A nice, uncomplicated note to end a long night on.'] },
  },
};
