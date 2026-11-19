/**
 * NPC conversations: practical English in realistic campus situations.
 * Nodes are data-only so they can be tested and translated easily.
 * Palette is used by the procedural pixel portraits and sprites.
 */
export const npcs = {
  guide: {
    id: 'guide',
    name: 'Miss Rivera',
    role: 'Club Guide',
    palette: { skin: '#e8b48a', hair: '#2b1c17', shirt: '#5ce1a6', accent: '#ffc857' },
    reward: 10,
    start: 'welcome',
    nodes: {
      welcome: {
        text: 'Welcome to the American Corner English Club! I am Miss Rivera, your guide for the next three minutes.',
        fr: 'Bienvenue au English Club ! Je suis Miss Rivera, votre guide pour les trois prochaines minutes.',
        next: 'brief',
      },
      brief: {
        text: 'The campus is yours: vocabulary, grammar, reading, writing, culture — and the Final Challenge Arena. Every correct answer powers the beacon.',
        next: 'ask',
      },
      ask: {
        text: 'Before you go — what would you like to know?',
        choices: [
          { text: 'Where should I start?', next: 'start' },
          { text: 'How does the timer work?', next: 'timer' },
          { text: 'I am ready. Thank you!', next: 'ready' },
        ],
      },
      start: {
        text: 'Start in the Vocabulary Garden, just west of here. Follow the glowing pads and press the action button when you arrive.',
        next: 'ask',
      },
      timer: {
        text: 'The clock starts now and stops at zero. Pausing stops the clock, so use it if you need a breath. Accuracy beats speed — always.',
        next: 'ask',
      },
      ready: {
        text: 'Perfect. One more thing: talk to people on campus. Real conversations are part of the mission.',
        fr: 'Parfait. Dernière chose : parlez aux personnes du campus. Les vraies conversations font partie de la mission.',
        close: true,
      },
    },
  },

  cafe: {
    id: 'cafe',
    name: 'Marcus',
    role: 'Café Volunteer',
    palette: { skin: '#8d5a3c', hair: '#141414', shirt: '#ff8fd8', accent: '#ffc857' },
    reward: 10,
    start: 'greet',
    nodes: {
      greet: {
        text: 'Hi! Welcome to the Campus Café. What can I get you?',
        fr: 'Bonjour ! Bienvenue au café du campus. Qu’est-ce que je vous sers ?',
        choices: [
          { text: 'Can I have a tea and a sandwich, please?', next: 'polite' },
          { text: 'Give me tea.', next: 'rude' },
          { text: 'I would like to pay later.', next: 'pay' },
        ],
      },
      polite: {
        text: 'Of course! Tea and a cheese sandwich. That will be six dollars. Your English is very polite.',
        next: 'smalltalk',
      },
      rude: {
        text: 'Sure… Here you are. By the way, “Can I have…, please?” sounds friendlier in a café.',
        next: 'smalltalk',
      },
      pay: {
        text: 'No problem — you can pay at the end. Anything else?',
        next: 'smalltalk',
      },
      smalltalk: {
        text: 'Are you here for the English Club exhibition?',
        choices: [
          { text: 'Yes, I am. I am trying the three-minute mission.', next: 'goodluck' },
          { text: 'Yes. What do you recommend in the club?', next: 'recommend' },
        ],
      },
      recommend: {
        text: 'The Reading Library has short texts, and the Culture Zone has real maps. I would start with the Vocabulary Garden, though.',
        next: 'goodluck',
      },
      goodluck: {
        text: 'Good luck! Come back if you need a reading tip.',
        close: true,
      },
    },
  },

  student: {
    id: 'student',
    name: 'Leo',
    role: 'First-year Student',
    palette: { skin: '#f0c39a', hair: '#6b3f1d', shirt: '#63c5ff', accent: '#a78bfa' },
    reward: 10,
    start: 'hi',
    nodes: {
      hi: {
        text: 'Hey! I am Leo. Is this your first time at the English Club?',
        fr: 'Salut ! Je suis Leo. C’est ta première fois au English Club ?',
        choices: [
          { text: 'Yes, it is. Nice to meet you, Leo.', next: 'nice' },
          { text: 'Yes. I am from Madagascar.', next: 'origin' },
          { text: 'No.', next: 'short' },
        ],
      },
      nice: {
        text: 'Nice to meet you too! Where are you from?',
        next: 'origin',
      },
      origin: {
        text: 'That is great. I am from Ohio. What do you like doing in your free time?',
        choices: [
          { text: 'I like music and football. What about you?', next: 'exchange' },
          { text: 'I like study English.', next: 'correct' },
        ],
      },
      correct: {
        text: 'Almost! Say “I like studying English” or “I like to study English”. “Like” is followed by -ing or to + verb.',
        next: 'exchange',
      },
      exchange: {
        text: 'I play basketball and I am learning Spanish. Maybe we can practise together after the mission?',
        next: 'bye',
      },
      short: {
        text: 'No problem. Well, welcome anyway! The guide is by the fountain if you need directions.',
        close: true,
      },
      bye: {
        text: 'See you around! And good luck with the timer.',
        close: true,
      },
    },
  },

  librarian: {
    id: 'librarian',
    name: 'Ms Chen',
    role: 'Reading Library',
    palette: { skin: '#e6b48f', hair: '#1c1c24', shirt: '#ffc857', accent: '#5ce1a6' },
    reward: 10,
    start: 'welcome',
    nodes: {
      welcome: {
        text: 'Welcome to the Reading Library. Are you looking for something in particular?',
        choices: [
          { text: 'Could you recommend a short book for an A2 learner?', next: 'recommend' },
          { text: 'Where is the exit?', next: 'exit' },
        ],
      },
      recommend: {
        text: 'Try a graded reader with short chapters. Read one page aloud each day — it helps pronunciation and fluency.',
        next: 'question',
      },
      exit: {
        text: 'The exit is behind you, next to the notice board. But since you are here, may I suggest a reading tip?',
        next: 'question',
      },
      question: {
        text: 'When you meet a new word, what do you usually do?',
        choices: [
          { text: 'I try to guess from the sentence, then check a dictionary.', next: 'good' },
          { text: 'I stop reading immediately.', next: 'tip' },
        ],
      },
      good: {
        text: 'Exactly. Context first, dictionary second. That builds independence.',
        next: 'close',
      },
      tip: {
        text: 'Try guessing first: the words around a new word often reveal its meaning. Then check the dictionary to confirm.',
        next: 'close',
      },
      close: {
        text: 'Enjoy the library, and remember: reading slowly is still reading.',
        close: true,
      },
    },
  },

  president: {
    id: 'president',
    name: 'Ava',
    role: 'Club President',
    palette: { skin: '#c98a63', hair: '#2a1410', shirt: '#a78bfa', accent: '#ff6b6b' },
    reward: 10,
    start: 'hey',
    nodes: {
      hey: {
        text: 'Hi, I am Ava, president of the English Club. Are you interested in joining?',
        choices: [
          { text: 'Yes, I would like to join. What activities do you have?', next: 'activities' },
          { text: 'Maybe. Is it free?', next: 'free' },
        ],
      },
      activities: {
        text: 'We meet on Fridays: debates, film evenings and conversation tables. Members also run the exhibition stands.',
        next: 'invite',
      },
      free: {
        text: 'Yes, membership is free for students. We meet on Fridays for debates, films and conversation practice.',
        next: 'invite',
      },
      invite: {
        text: 'Would you like to introduce yourself to the group on Friday?',
        choices: [
          { text: 'Sure. I can say my name, my city and one hobby.', next: 'great' },
          { text: 'I am not sure. I am a little nervous.', next: 'support' },
        ],
      },
      great: {
        text: 'Perfect — that is exactly the right amount for a first introduction. See you Friday!',
        close: true,
      },
      support: {
        text: 'That is normal. Prepare three short sentences and we will practise before the meeting. You will be fine.',
        close: true,
      },
    },
  },

  visitor: {
    id: 'visitor',
    name: 'Daniel',
    role: 'Exhibition Visitor',
    palette: { skin: '#f2c6a0', hair: '#8a8a8a', shirt: '#ff6b6b', accent: '#63c5ff' },
    reward: 10,
    start: 'lost',
    nodes: {
      lost: {
        text: 'Excuse me, I am a bit lost. Could you tell me how to get to the Final Challenge Arena?',
        choices: [
          { text: 'Go past the fountain, then turn left at the Culture Zone.', next: 'thanks' },
          { text: 'Arena there.', next: 'repair' },
          { text: 'Sorry, I do not know. Ask the guide near the fountain.', next: 'honest' },
        ],
      },
      thanks: {
        text: 'Thank you! Your directions were clear. Are you playing the mission too?',
        next: 'chat',
      },
      repair: {
        text: 'I think I understood, but “Arena there” is very short. Try “Go straight and turn left at the Culture Zone.”',
        next: 'chat',
      },
      honest: {
        text: 'No problem — thank you for being honest. I will ask the guide. Good luck in your mission!',
        close: true,
      },
      chat: {
        text: 'The campus looks great. Which station is your favourite so far?',
        choices: [
          { text: 'The Reading Library — I like short texts with real details.', next: 'end' },
          { text: 'The Culture Zone, because the maps are real.', next: 'end' },
        ],
      },
      end: {
        text: 'Nice choice. Enjoy the rest of your mission — and do not forget the timer!',
        close: true,
      },
    },
  },
};
