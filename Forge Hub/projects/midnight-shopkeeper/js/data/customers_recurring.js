// Recurring characters. Each has an ordered list of `appearances` — one authored encounter
// per visit. Relationship state advances automatically as encounters resolve well.
// desiredTags: tags that make a PERFECT match. goodTags: broader tags that still satisfy the need.
// avoidItems: items that produce a special poor/refused reaction because they misread the request.

export const RECURRING = {

  rin: {
    id: 'rin', name: 'Rin', title: 'The Traveler',
    portrait: { silhouette: 'slim', hair: 'short', hairColor: '#5b3a29', skin: '#caa377', outfit: '#3c5a52', accent: '#c9a24b', prop: 'satchel' },
    appearances: [
      {
        night: 1, tag: 'rin_1',
        greeting: "The bell over the door hasn't finished ringing before they're already halfway to the counter, dripping.",
        opening: '"Still open? Good. I need — I don\'t know exactly. Something for the road. I keep starting and not arriving."',
        request: 'I need something for the road. I keep starting and not arriving.',
        followups: [
          { q: 'Where are you trying to go?', a: '"That\'s the trouble. I know where I\'m leaving. I\'m less sure where I\'m going."', tagHint: 'direction' },
          { q: 'What happens when you don\'t arrive?', a: '"I turn around. Every time, a little further along, I turn around."', tagHint: 'travel' },
          { q: 'What\'s in the bag?', a: 'They glance down at the satchel like they forgot it was there. "Everything I own. It\'s not heavy. That\'s not the problem."', tagHint: 'direction' },
        ],
        desiredTags: ['direction', 'travel'], goodTags: ['courage', 'journey', 'practical'],
        avoidItems: { salt_twist: '"Salt? I\'m not haunted. I\'m lost. Different problem."' },
        reactions: {
          perfect: ['They turn the compass over twice, and for a second they look almost frightened of it. "It doesn\'t point home. Good. I was afraid it would." They tuck it away like it might change its mind.'],
          refused: ['They set the item back down, gently, like it deserves better than to be wrong. "Not this. But — thank you for trying."'],
        },
        onGood: { relationship: 2, flag: 'rin_1_good' },
        onPoor: { relationship: 0 },
      },
      {
        night: 3, tag: 'rin_2',
        greeting: 'They\'re back, same satchel, boots one color darker with new mud. They nod at you like an old acquaintance, which, now, you are.',
        opening: '"I got as far as the mill road and turned around again. The compass just — pointed back here. I need something else. Something for when knowing the direction isn\'t the problem."',
        request: 'I need something for when knowing the direction isn\'t the problem anymore.',
        followups: [
          { q: 'So what is the problem?', a: '"I think I\'m afraid of wherever I\'m going. Which is a stupid thing to be afraid of, since I chose it."', tagHint: 'courage' },
          { q: 'What did you choose it for?', a: 'They\'re quiet a moment. "Someone I used to be, mostly. I made her a promise before I knew how big it was."', tagHint: 'promise' },
        ],
        desiredTags: ['courage'], goodTags: ['travel', 'protection', 'boldness'],
        avoidItems: { brass_compass: '"I already have one of those. It\'s not the direction I\'m missing anymore." They say it kindly, but firmly.' },
        reactions: {
          perfect: ['They hold the bellflower like it might dissolve. "My grandmother used to say this before she\'d say anything hard." Something in their shoulders comes down half an inch. "I\'ll try the road again tomorrow."'],
          refused: ['"That\'s not courage. That\'s just — a thing." They say it without malice, just tired certainty.'],
        },
        onGood: { relationship: 2, flag: 'rin_2_good' },
      },
      {
        night: 5, tag: 'rin_3',
        greeting: 'Rin comes in dry for once — the rain\'s let up — and sits on the stool by the counter like they live here a little now.',
        opening: '"I made it past the mill this time. Slept in a field. It was terrible. I need something to leave behind, before I go further. Something I won\'t need where I\'m going, but can\'t just throw in a ditch."',
        request: 'I need something to leave behind. Something I can\'t just throw in a ditch.',
        followups: [
          { q: 'What is it, really?', a: '"A promise I made to someone who isn\'t here to release me from it. I\'ve been carrying it since before the satchel."', tagHint: 'memory' },
          { q: 'Who was the promise to?', a: '"Someone who\'d understand why I\'m leaving it in a shop, honestly. She liked strange solutions to ordinary problems."', tagHint: 'grief' },
        ],
        desiredTags: ['memory', 'grief'], goodTags: ['love', 'longing'],
        avoidItems: {},
        reactions: {
          perfect: ['They set it on the counter and don\'t take payment for it — they push a coin toward you instead. "Keep it here. Let someone else\'s dream use it." For the first time, they smile with their whole face.'],
          refused: ['"That doesn\'t let go of anything. I need to leave something, not carry something new."'],
        },
        onGood: { relationship: 3, flag: 'rin_left_something', reputationBonus: 2 },
      },
      {
        night: 7, tag: 'rin_4',
        greeting: 'Rin stands in the doorway a long moment before coming in, letting the fog curl past them into the shop.',
        opening: '"I think this is the last time you\'ll see me here. I wanted — I don\'t need anything, actually. I wanted to say I\'m going. Properly, this time." They hesitate. "Unless you have something for a last night of doubt. Just in case."',
        request: 'Do you have something for a last night of doubt? Just in case I turn around one more time.',
        followups: [
          { q: 'Are you ready?', a: '"No. I don\'t think you ever are. I\'m going anyway, which might be the actual definition of ready."', tagHint: 'courage' },
          { q: 'What will you do when you arrive?', a: 'They laugh, surprised by the question. "I haven\'t thought that far. Isn\'t that funny? All this time getting there."', tagHint: 'travel' },
        ],
        desiredTags: ['courage', 'travel', 'direction'], goodTags: ['light', 'protection'],
        avoidItems: {},
        reactions: {
          perfect: ['They hold it like it\'s the last thing they\'ll buy for a while, which it might be. "Thank you. For all the wrong compasses and right questions." They step out into the fog and, this time, don\'t turn around.'],
        },
        onGood: { relationship: 3, flag: 'rin_departed', reputationBonus: 3 },
        finalAppearance: true,
      },
    ],
  },

  sael: {
    id: 'sael', name: 'Sael', title: 'The Musician',
    portrait: { silhouette: 'tall', hair: 'long', hairColor: '#1e1e26', skin: '#e2b98f', outfit: '#5c3a63', accent: '#e0c26b', prop: 'lute' },
    appearances: [
      {
        night: 2, tag: 'sael_1',
        greeting: 'A tall figure in a rain-dark coat leans a battered lute case against the counter with exaggerated care, like it might bruise.',
        opening: '"I need something for inspiration. My own playing has started to sound like somebody else\'s memory of it."',
        request: 'I need something for inspiration. My playing sounds like a memory of itself.',
        followups: [
          { q: 'When did it start?', a: '"Gradually. Then all at once, the way a room goes quiet when everyone notices the same thing."', tagHint: 'music' },
          { q: 'What does it sound like now?', a: '"Correct. Every note exactly where it should be. I used to make mistakes I liked."', tagHint: 'inspiration' },
        ],
        desiredTags: ['music', 'inspiration'], goodTags: ['voice', 'calling'],
        avoidItems: { dream_tea: '"I don\'t need to sleep better. I need to hear better. Or — feel it better. I don\'t know which."' },
        reactions: {
          perfect: ['Sael turns the whistle over, doesn\'t play it, just holds it like a question. "I haven\'t touched an instrument I didn\'t already know how to disappoint. This one hasn\'t met me yet." They almost smile.'],
          refused: ['"That\'s a lovely object. It is not, however, useful to a musician who can\'t hear what\'s wrong with their own music."'],
        },
        onGood: { relationship: 2, flag: 'sael_1_good' },
      },
      {
        night: 4, tag: 'sael_2',
        greeting: 'Sael is already talking before the door shuts behind them. "I played at the Grey Lantern last night. Nobody clapped. Nobody booed either. I think that\'s worse."',
        opening: '"I need something honest. Something that will tell me the truth about my own music, since apparently the audience won\'t."',
        request: 'I need something that will tell me the truth about my own music.',
        followups: [
          { q: 'What do you think is wrong?', a: '"I think I stopped listening to myself around the same time everyone else did. Cruel coincidence, or not a coincidence at all."', tagHint: 'truth' },
          { q: 'Have you tried the whistle?', a: '"Every night. It plays like it\'s waiting for something I haven\'t worked out yet."', tagHint: 'music' },
        ],
        desiredTags: ['truth', 'clarity'], goodTags: ['knowledge', 'perception'],
        avoidItems: {},
        reactions: {
          perfect: ['Sael puts the spectacles on, looks at nothing in particular, and goes very still. "Oh," they say, quietly, like they heard something instead of saw it. They don\'t explain. They pay double the asking price without arguing.'],
          refused: ['"That doesn\'t tell me anything. That just sits there being strange at me."'],
        },
        onGood: { relationship: 2, flag: 'sael_2_good' },
      },
      {
        night: 6, tag: 'sael_3',
        greeting: 'Sael sets the lute case down harder than usual. There\'s a new crack along one corner.',
        opening: '"I dropped it. On purpose, I think, though I\'m telling myself it was an accident. I want — I don\'t know what I want. Something for when the thing you love stops loving you back."',
        request: 'Something for when the thing you love stops loving you back.',
        followups: [
          { q: 'Is it really the lute\'s fault?', a: 'Long pause. "No. I know that. Knowing it doesn\'t fix the part where I can\'t hear the good in it anymore."', tagHint: 'grief' },
          { q: 'What did it used to sound like?', a: '"Like it was finishing my sentences. It used to know things about me before I did."', tagHint: 'nostalgia' },
        ],
        desiredTags: ['nostalgia', 'memory'], goodTags: ['grief', 'music'],
        avoidItems: {},
        reactions: {
          perfect: ['You mention there might be a way to actually finish that unplayed tune — the whistle, and the cracked box gathering dust on your own shelf. Sael goes very still. "You have one too? Bring them both. I want to hear what it sounds like whole."'],
        },
        onGood: { relationship: 3, flag: 'sael_wants_second_melody' },
        specialCraftHint: 'second_melody',
      },
      {
        night: 8, tag: 'sael_4',
        greeting: 'Sael is already at the counter when you come down, having let themself half in out of the rain, the lute case at their feet like a sleeping animal.',
        opening: (flags) => flags.sael_wants_second_melody
          ? '"I couldn\'t stop thinking about it. The whole song. Did you ever — " they glance at your shelf, hopeful in a way they clearly find embarrassing.'
          : '"I think I\'m done chasing whatever this was. I wanted to say goodbye properly, and maybe buy something that isn\'t trying to fix me."',
        request: (flags) => flags.sael_wants_second_melody
          ? 'Did you ever finish it? The song the box couldn\'t play?'
          : 'Just something ordinary. Something that isn\'t trying to fix me.',
        followups: [
          { q: 'What will you play tonight?', a: '"Whatever comes. For the first time in months I don\'t have an answer prepared, and it doesn\'t feel like failing."', tagHint: 'inspiration' },
        ],
        desiredTags: ['inspiration', 'music', 'nostalgia'], goodTags: ['home', 'comfort'],
        avoidItems: {},
        reactions: {
          perfect: ['Sael listens to it once, all the way through, eyes closed, and doesn\'t say anything for a long moment. "That\'s the part I forgot," they finally say. "Not the notes. Just — that it was allowed to finish." They play a few bars right there at the counter before they remember to be embarrassed about it.'],
        },
        onGood: { relationship: 3, flag: 'sael_resolved', reputationBonus: 3 },
        finalAppearance: true,
      },
    ],
  },

  mrs_pell: {
    id: 'mrs_pell', name: 'Mrs. Aveline Pell', title: 'The Old Woman',
    portrait: { silhouette: 'small', hair: 'bun', hairColor: '#d9d9d9', skin: '#d8b48f', outfit: '#43394a', accent: '#8a6b3f', prop: 'cane' },
    appearances: [
      {
        night: 1, tag: 'pell_1',
        greeting: 'She doesn\'t knock, doesn\'t wait to be greeted — just shuffles in, sets a small tarnished object on your counter, and looks at you expectantly.',
        opening: '"This belongs here. I don\'t know why I had it. I don\'t much like keeping things that aren\'t mine." She taps the object — a small brass key — with one knuckle. "You\'ll want to put it somewhere safe."',
        request: 'I found this. It belongs to this shop. I don\'t want it in my house any longer.',
        followups: [
          { q: 'Where did you find it?', a: '"In a drawer that wasn\'t mine to open, in a house that used to belong to someone else. Don\'t ask which house. I won\'t answer twice."', tagHint: 'mystery' },
          { q: 'Do you need anything for yourself?', a: 'She considers this like it hadn\'t occurred to her. "...Something for a house too quiet at night. Since you ask."', tagHint: 'home' },
        ],
        desiredTags: ['home', 'comfort'], goodTags: ['calm', 'warmth'],
        isGift: true, giftNote: 'She hands you the small key without asking for payment — the first thread of the shop\'s buried history.',
        avoidItems: {},
        reactions: {
          perfect: ['She takes it, holds it a moment longer than necessary, and nods once, like a transaction with herself has been settled, not just with you. "Good shop, this. Always was."'],
          refused: ['"Hm." She doesn\'t argue. She just doesn\'t buy it, and lets you know exactly how she feels about that with one syllable.'],
        },
        onGood: { relationship: 2, flag: 'pell_gave_key' },
        storyItem: { give: 'iron_key_no_door' },
      },
      {
        night: 3, tag: 'pell_2',
        greeting: 'Mrs. Pell is back, dryer this time, with the particular energy of someone who has been thinking about something all week.',
        opening: '"That key. Does it open anything back there?" She nods toward the back of the shop without quite looking at it. "Never mind. Not my business. I need a gift for someone who remembers everything. Everything. It\'s exhausting, buying for her."',
        request: 'I need a gift for someone who remembers everything. Nothing I bring is ever new to her.',
        followups: [
          { q: 'Who is she?', a: '"My sister. Ninety-one years old and sharper than either of us. Getting her a gift is like performing for a critic who\'s already seen the show."', tagHint: 'memory' },
          { q: 'What has worked before?', a: '"Nothing predictable. She doesn\'t want things. She wants to be told something she doesn\'t already know."', tagHint: 'knowledge' },
        ],
        desiredTags: ['knowledge', 'memory'], goodTags: ['names', 'record'],
        avoidItems: { mourning_locket: '"She\'s not dead, dear. She\'ll be very put out if I bring her a mourning locket."' },
        reactions: {
          perfect: ['Mrs. Pell actually laughs — a short, surprised bark. "Oh, she\'ll hate that she didn\'t think to look for this herself. Perfect."'],
          refused: ['"She has three of those already, dear. I told you, she remembers everything."'],
        },
        onGood: { relationship: 2, flag: 'pell_2_good' },
      },
      {
        night: 6, tag: 'pell_3',
        greeting: 'She sits, this time, on the stool she\'s clearly decided is hers now, and doesn\'t make small talk first.',
        opening: '"I knew the person who kept this shop before you. Not well. Nobody knew them well. But I remember the night the lanterns went out and never came back on, and a young man I didn\'t recognize was suddenly behind that counter instead." She looks at you directly. "That was some time before you were born, dear. So you understand my confusion about how you got here."',
        request: 'I need something for a memory I\'m not sure I trust anymore.',
        followups: [
          { q: 'What happened that night?', a: '"Nobody agrees. That\'s the trouble with the shop\'s stories — they change depending who tells them. I need to know if mine is even still true."', tagHint: 'truth' },
          { q: 'Do you know what\'s in the back room?', a: 'She goes quiet, which for Mrs. Pell is its own kind of answer. "I know there is one. I know the last keeper never let anyone see inside it. That\'s all I know, and it\'s more than most."', tagHint: 'secrets' },
        ],
        desiredTags: ['truth', 'secrets'], goodTags: ['memory', 'mystery'],
        avoidItems: {},
        reactions: {
          perfect: ['She looks into it a long moment, then sets it down, careful, like it might still be looking back. "Well," she says. "That confirms it, then. Something did happen. I\'m not sure that\'s a comfort." She leaves a generous tip and doesn\'t explain why.'],
        },
        onGood: { relationship: 3, flag: 'pell_confirmed_mystery', mysteryPoint: true },
      },
      {
        night: 8, tag: 'pell_4',
        greeting: 'Mrs. Pell arrives early, before most of the night\'s custom, and stands for a moment just looking at the shelves like she\'s counting something only she can see.',
        opening: '"I think I know what\'s in the back room, dear. I think I\'ve known for years and didn\'t want to be the one to say it out loud." She sets her cane against the counter, an unusually vulnerable gesture. "I want something for saying a hard thing to a person who deserves to hear it."',
        request: 'I need something for saying a hard thing to someone who deserves to hear it.',
        followups: [
          { q: 'Is the hard thing about me?', a: '"It\'s about the shop, and the shop is rather a lot about you now, isn\'t it." She almost smiles. "Sell me something, and I\'ll tell you."', tagHint: 'truth' },
        ],
        desiredTags: ['courage', 'truth'], goodTags: ['protection', 'clarity'],
        avoidItems: {},
        reactions: {
          perfect: ['She takes it, breathes out slowly, and finally says it: "The last keeper didn\'t vanish, dear. They stepped back through their own door and never came back out. I think the room in the back isn\'t a room. I think it\'s a door that\'s still slightly open." She pats your hand, once. "Do be careful which way you walk through it."'],
        },
        onGood: { relationship: 3, flag: 'pell_final_truth', mysteryPoint: true, reputationBonus: 2 },
        finalAppearance: true,
      },
    ],
  },

  fenn: {
    id: 'fenn', name: 'Fenn', title: 'The Courier',
    portrait: { silhouette: 'stout', hair: 'hooded', hairColor: '#2b2b2b', skin: '#b98a5e', outfit: '#4a4038', accent: '#7d8a6b', prop: 'satchel' },
    appearances: [
      {
        night: 2, tag: 'fenn_1',
        greeting: 'A hooded figure sets a small brown-paper package on the counter, squared perfectly with the edge, and steps back like it might be dangerous.',
        opening: '"Delivery. For this address. No sender listed, which — happens more than you\'d think, in this line of work. I need to sell something too, while I\'m here. Something for a package I\'m afraid to open myself."',
        request: 'I need something for a package I\'m afraid to open. Not this one — one of my own.',
        followups: [
          { q: 'What do you think is in it?', a: '"I don\'t let myself guess. Guessing is how you end up disappointed twice."', tagHint: 'protection' },
          { q: 'Why are you afraid of it?', a: '"Because it\'s been in my satchel for three weeks and I still haven\'t worked up the nerve, and I deliver other people\'s frightening news for a living."', tagHint: 'courage' },
        ],
        desiredTags: ['courage', 'protection'], goodTags: ['boldness'],
        avoidItems: {},
        reactions: {
          perfect: ['Fenn pockets it without ceremony, the way someone pockets something they need and don\'t want to make a scene about. "Appreciated. I\'ll let you know how it goes. Or I won\'t. Depends how it goes."'],
        },
        onGood: { relationship: 2, flag: 'fenn_1_good' },
        deliveryFlag: 'fenn_package_1',
      },
      {
        night: 4, tag: 'fenn_2',
        greeting: 'Fenn again, hood back this time, looking marginally less haunted than last visit.',
        opening: '"Opened it. Old letters. Addressed to whoever\'s behind this counter, actually — should\'ve looked closer before I spent three weeks being dramatic about it." They slide a folded, water-stained page across. "I need something for a letter I\'m meant to answer and don\'t know how."',
        request: 'I need something for a letter I\'m meant to answer and don\'t know how.',
        followups: [
          { q: 'Who\'s it from?', a: '"No name. Just — instructions. About the shop. About someone finding their way back to it eventually." Fenn shrugs, uneasy. "Wasn\'t signed. Made my skin crawl a little, honestly."', tagHint: 'memory' },
          { q: 'What does it say?', a: '"Mostly it just says: keep the lanterns lit. Which is a strange thing to mail someone. And also somehow the only instruction in it that makes any sense."', tagHint: 'writing' },
        ],
        desiredTags: ['writing', 'memory'], goodTags: ['knowledge', 'clarity'],
        avoidItems: {},
        reactions: {
          perfect: ['Fenn takes it and actually sits down at your counter to draft a reply right there, murmuring the words as they write. "There. Whoever they are, they can\'t say I never answered." They leave the letter itself behind, "for the shop," and don\'t explain further.'],
        },
        onGood: { relationship: 3, flag: 'fenn_letter_answered', mysteryPoint: true, itemGivenToShop: 'ledger_debts' },
      },
      {
        night: 7, tag: 'fenn_3',
        greeting: 'Fenn arrives soaked through, out of breath, and doesn\'t sit down.',
        opening: '"Got another one. Same handwriting as the first letter. No postmark, no route, nothing — I checked every logbook in three towns and there\'s no record of it ever being handed to me." They set it down like it might bite. "I need something for delivering mail from someone who, best I can tell, isn\'t currently anywhere a letter could be sent from."',
        request: 'I need something for delivering mail from someone who isn\'t anywhere a letter could be sent from.',
        followups: [
          { q: 'What does this one say?', a: '"Just an address. This one. And underneath: \'they\'ll know what to do with the rest.\' I don\'t like this job as much as I used to."', tagHint: 'mystery' },
          { q: 'Are you scared?', a: '"Professionally, no. Personally? A little. But the pay\'s good and somebody has to carry it."', tagHint: 'protection' },
        ],
        desiredTags: ['protection', 'mystery'], goodTags: ['courage', 'ward'],
        avoidItems: {},
        reactions: {
          perfect: ['Fenn pockets it, visibly steadier. "Right. If I start getting letters from further back than that, you\'ll be the first to know. Lucky you." They leave the second letter on the counter too, next to the first.'],
        },
        onGood: { relationship: 3, flag: 'fenn_second_letter', mysteryPoint: true, itemGivenToShop: 'book_half_names' },
      },
      {
        night: 8, tag: 'fenn_4',
        greeting: 'Fenn steps in, looks at the two letters still sitting behind your counter, and finally seems to relax.',
        opening: '"No more letters tonight. I think that was the last of them — whatever \'the rest\' was supposed to mean, I think it already arrived, or it\'s already here." They glance toward the back of the shop. "I just wanted to see how it turned out. And maybe buy something ordinary, for once, like a person with a normal job."',
        request: 'Something ordinary. I\'ve earned ordinary.',
        followups: [
          { q: 'What will you do now?', a: '"Deliver things that make sense. Boring things. I\'m looking forward to it more than I expected to."', tagHint: 'practical' },
        ],
        desiredTags: ['practical', 'home'], goodTags: ['comfort', 'travel'],
        avoidItems: {},
        reactions: {
          perfect: ['Fenn actually laughs, relieved. "Perfect. Thoroughly unhaunted. Thank you." They tip generously, the way people do when they\'re paying off more than the item.'],
        },
        onGood: { relationship: 3, flag: 'fenn_resolved', reputationBonus: 2 },
        finalAppearance: true,
      },
    ],
  },

  moth: {
    id: 'moth', name: 'Moth', title: 'The Child',
    portrait: { silhouette: 'small', hair: 'curly', hairColor: '#e8d9a0', skin: '#e7c9a3', outfit: '#274a52', accent: '#e0c26b', prop: 'none' },
    appearances: [
      {
        night: 3, tag: 'moth_1',
        greeting: 'The bell rings, but nobody seems to be there — until you look down. A small child in a coat several sizes too large stands at the counter, having apparently let themself in.',
        opening: '"Is it midnight yet?" they ask, before anything else. When you say it\'s close, they nod like that\'s the correct answer to a test. "Good. I need something for the space under the stairs. It\'s gotten bigger."',
        request: 'I need something for the space under the stairs. It\'s gotten bigger.',
        followups: [
          { q: 'Bigger how?', a: '"It used to just be a space. Now it\'s a space with a draft. Drafts mean somewhere for the draft to come from." They say this with total, matter-of-fact confidence.', tagHint: 'protection' },
          { q: 'Where are your parents?', a: 'They tilt their head, like the question doesn\'t quite parse. "Around. Everywhere, eventually. That\'s how it works for me." They don\'t elaborate, and somehow you don\'t push.', tagHint: null },
        ],
        desiredTags: ['protection', 'ward'], goodTags: ['warning', 'boundary'],
        avoidItems: {},
        reactions: {
          perfect: ['Moth accepts it very solemnly, both hands, like receiving something ceremonial rather than purchased. "That\'ll do it. Thank you for having the right things." They leave without paying and you somehow don\'t mind, or even notice until later.'],
          refused: ['They look at it, unimpressed, and shake their head slowly. "No. That\'s for people-shaped problems. Mine isn\'t people-shaped."'],
        },
        onGood: { relationship: 2, flag: 'moth_1_good' },
        noPayment: true,
      },
      {
        night: 5, tag: 'moth_2',
        greeting: 'Moth is sitting on your counter when you turn around, having apparently arrived without the bell ringing at all this time.',
        opening: '"You have a door in the back that isn\'t a door yet," they say, swinging their legs. "It will be, eventually. I wanted to see the shop before it changes." They look around with unhurried, ancient curiosity. "I need light. But not enough for them to notice."',
        request: 'I need light, but not enough for them to notice.',
        followups: [
          { q: 'Who is "them"?', a: '"Whoever\'s listening for the wrong kind of light. It happens sometimes, when you\'re somewhere between places." They say it like discussing the weather.', tagHint: 'light' },
          { q: 'Are you between places right now?', a: 'They smile — the first fully childlike thing they\'ve done all conversation. "Aren\'t you? Isn\'t everyone, a little, at this hour?"', tagHint: null },
        ],
        desiredTags: ['light'], goodTags: ['warmth', 'protection'],
        avoidItems: { ember_root_candle: '"Too warm. Too bright. Whoever\'s listening likes warm bright things. I need something quieter than that."' },
        reactions: {
          perfect: ['Moth cups it in both hands and it seems, somehow, to dim obligingly, just for them. "That\'s the one. You\'re getting better at this." A compliment delivered with the total sincerity only children manage.'],
        },
        onGood: { relationship: 2, flag: 'moth_2_good' },
        noPayment: true,
      },
      {
        night: 7, tag: 'moth_3',
        greeting: 'Fog rolls in around Moth\'s ankles as the door opens, like it\'s reluctant to let them go.',
        opening: '"The door in the back is nearly a door now," they say, without preamble. "I came to tell you that when it opens, you should be holding something, not empty-handed. Nobody should walk through empty-handed. I never do." They look at you very seriously for a child. "I need something for someone who\'s about to remember everything at once."',
        request: 'I need something for someone who\'s about to remember everything at once.',
        followups: [
          { q: 'Is that someone you?', a: 'They laugh, delighted, like it\'s a silly question. "No. I already remember everything. I always have. It\'s not so bad once you get used to it."', tagHint: null },
          { q: 'Who is it, then?', a: 'They just smile and don\'t answer, which is somehow more informative than an answer would have been.', tagHint: 'memory' },
        ],
        desiredTags: ['memory', 'grief'], goodTags: ['calm', 'comfort'],
        avoidItems: {},
        reactions: {
          perfect: ['Moth takes it and, for once, looks satisfied rather than merely approving. "Good. Hold onto one for yourself, too, when the door opens. You\'ll want it." They\'re gone before the bell finishes ringing, the way they always are.'],
        },
        onGood: { relationship: 3, flag: 'moth_warned_door', mysteryPoint: true },
        noPayment: true,
      },
      {
        night: 8, tag: 'moth_4',
        greeting: 'Moth is waiting on the counter when you come down for the last time tonight, coat still too big, feet swinging, entirely unbothered by the strange hour.',
        opening: '"It\'s open now," they say simply. "Or it will be, the moment you\'re ready and not a moment before — the shop\'s always been polite about that much." They hold out a small, empty hand. "I don\'t need anything tonight. I came to walk you to the door, if you want company. I\'ve done this before, you know. Longer ago than you\'d believe."',
        request: 'I don\'t need anything. I just came to walk you to the door, if you want.',
        followups: [
          { q: 'Have you done this before?', a: '"Every keeper, eventually. I\'m very old, under the coat. Older than the coat, even." They say it lightly, like a joke they\'ve made a hundred times and never gotten tired of.', tagHint: null },
        ],
        desiredTags: [], goodTags: [],
        isCompanion: true,
        avoidItems: {},
        reactions: { perfect: ['You don\'t sell Moth anything tonight. You just let them walk beside you, small and unhurried, toward whatever the back room has become.'] },
        onGood: { relationship: 3, flag: 'moth_walked_with', mysteryPoint: true },
        finalAppearance: true,
        noPayment: true,
        alwaysAccept: true,
      },
    ],
  },

  ashe: {
    id: 'ashe', name: 'Dr. Corvin Ashe', title: 'The Scholar',
    portrait: { silhouette: 'tall', hair: 'short', hairColor: '#767676', skin: '#c79a6b', outfit: '#3a3a4a', accent: '#8a3f3f', prop: 'book' },
    appearances: [
      {
        night: 2, tag: 'ashe_1',
        greeting: 'A tall, ink-stained figure sweeps in shaking rain off a coat covered in loose papers, several of which escape onto your floor.',
        opening: '"Apologies. Corvin Ashe, formerly of the University, currently of nowhere respectable." They gather the papers with brisk efficiency. "I\'m researching what\'s beneath this town — tunnels, cellars, that sort of thing. I need something for knowledge that doesn\'t want to be found."',
        request: 'I need something for knowledge that doesn\'t want to be found.',
        followups: [
          { q: 'What are you looking for, exactly?', a: '"Records. Old maps. This town has a habit of losing its own history on purpose, which is, professionally speaking, fascinating."', tagHint: 'knowledge' },
          { q: 'Why here, specifically?', a: 'They glance at your shelves with open curiosity. "Because every old map I\'ve found marks something under this exact building. Usually as a blank space, which is its own kind of clue."', tagHint: 'mystery' },
        ],
        desiredTags: ['knowledge', 'mystery'], goodTags: ['record', 'truth'],
        avoidItems: {},
        reactions: {
          perfect: ['Ashe turns the pages slowly, reverently, muttering half-legible names under their breath. "Oh, this is — yes. This is exactly the sort of thing that gets ignored precisely because it looks unimportant." They buy it without haggling once.'],
        },
        onGood: { relationship: 2, flag: 'ashe_1_good' },
      },
      {
        night: 5, tag: 'ashe_2',
        greeting: 'Ashe arrives with considerably more energy than usual, practically vibrating with a held-in theory.',
        opening: '"I found a reference. An old permit, for renovations to this building, dated — well, dated wrong, frankly, by about eighty years, which either means the records office made an error or this shop has had the same address longer than it should." They set down a folded diagram. "I need something for seeing what a drawing is actually describing, not what it appears to describe."',
        request: 'I need something for seeing what a drawing is actually describing, not what it appears to.',
        followups: [
          { q: 'What does the permit say?', a: '"Renovation to add a \'storage annex,\' behind what\'s now your back wall. No further detail. Building permits from that era rarely elaborate."', tagHint: 'clarity' },
          { q: 'Do you think it\'s still there?', a: '"I think it never stopped being there. I think it\'s simply stopped being easy to find, which people have a habit of arranging on purpose."', tagHint: 'truth' },
        ],
        desiredTags: ['clarity', 'truth', 'perception'], goodTags: ['knowledge'],
        avoidItems: {},
        reactions: {
          perfect: ['Ashe puts them on and stares at the diagram for a long, silent minute. "The lines change," they say finally, hushed. "When you look properly, the lines change." They ask, very carefully, if they can come back and look at your back wall sometime.'],
        },
        onGood: { relationship: 3, flag: 'ashe_diagram_read', mysteryPoint: true },
      },
      {
        night: 7, tag: 'ashe_3',
        greeting: 'Ashe looks tired in a way that has nothing to do with sleep — the specific exhaustion of someone close to an answer they\'re not sure they want.',
        opening: '"I need to write something down that I don\'t want to be able to lie to myself about later. Do you understand? I need the ink to hold me to it." They look almost embarrassed by the request. "I think I know what\'s behind that wall now. I need to be honest with myself about whether to say so."',
        request: 'I need ink that will hold me to whatever I write with it. Something that won\'t let me lie to myself later.',
        followups: [
          { q: 'What do you think is back there?', a: '"A door. Not a storage annex. A door, sealed up and relabeled so nobody would go looking. I think the last keeper of this shop built the lie themself."', tagHint: 'truth' },
        ],
        desiredTags: ['truth', 'writing', 'knowledge'], goodTags: ['clarity'],
        avoidItems: {},
        reactions: {
          perfect: ['Ashe writes a single sentence, reads it back, and goes pale. They don\'t show you the page. "I\'ll tell you when I\'m sure," they say, folding it away with shaking hands. "I need to be sure before I say it out loud in a room with a door in it."'],
        },
        onGood: { relationship: 3, flag: 'ashe_wrote_truth', mysteryPoint: true },
        requiresWorkbench: true,
      },
      {
        night: 8, tag: 'ashe_4',
        greeting: 'Ashe is waiting outside before you\'ve even opened, papers held against their chest like they might blow away, though the night is still.',
        opening: '"I\'m sure now," they say, without any of the usual preamble. "I wrote it down, and it held, and I read it back every night since and it still says the same thing." They take a breath. "The last keeper of this shop didn\'t leave. They\'re still here, on the other side of a door your predecessor built to keep something *in*, not to keep something out. I don\'t know if that\'s better or worse news."',
        request: 'I don\'t need to buy anything tonight. I just needed somewhere to say that out loud.',
        followups: [],
        desiredTags: [], goodTags: [],
        isCompanion: true,
        avoidItems: {},
        reactions: { perfect: ['You don\'t need to sell Dr. Ashe anything tonight. They just needed a counter to say it across, and you to be the one who heard it.'] },
        onGood: { relationship: 3, flag: 'ashe_final_truth', mysteryPoint: true, reputationBonus: 2 },
        finalAppearance: true,
        noPayment: true,
        alwaysAccept: true,
      },
    ],
  },
};
