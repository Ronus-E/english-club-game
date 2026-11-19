import { choice, match } from './schema.js';

const O = 'Build everyday vocabulary for campus life and daily situations.';
const I = 'Choose the best answer.';

export const vocabulary = {
  A1: [
    match({
      id: 'voc-a1-01', level: 'A1',
      objective: 'Recognise three classroom objects in English.',
      pairs: [{ term: 'book', icon: 'book' }, { term: 'pencil', icon: 'pencil' }, { term: 'clock', icon: 'clock' }],
      explanation: 'A book is for reading, a pencil is for writing and a clock shows the time.',
      fr: 'book = livre, pencil = crayon, clock = horloge.',
    }),
    match({
      id: 'voc-a1-02', level: 'A1',
      objective: 'Recognise three common food and drink words.',
      pairs: [{ term: 'apple', icon: 'apple' }, { term: 'sandwich', icon: 'sandwich' }, { term: 'water', icon: 'water' }],
      explanation: 'An apple is a fruit, a sandwich is bread with food inside, and water is a drink.',
      fr: 'apple = pomme, sandwich = sandwich, water = eau.',
    }),
    match({
      id: 'voc-a1-03', level: 'A1',
      objective: 'Recognise places in a town.',
      pairs: [{ term: 'house', icon: 'house' }, { term: 'school', icon: 'school' }, { term: 'park', icon: 'tree' }],
      explanation: 'A house is a home, a school is a place for lessons, and a park is an open green space.',
      fr: 'house = maison, school = école, park = parc.',
    }),
    match({
      id: 'voc-a1-04', level: 'A1',
      objective: 'Recognise three means of transport.',
      pairs: [{ term: 'bus', icon: 'bus' }, { term: 'bicycle', icon: 'bicycle' }, { term: 'airplane', icon: 'airplane' }],
      explanation: 'A bus and a bicycle travel on roads; an airplane flies in the sky.',
      fr: 'bus = bus, bicycle = vélo, airplane = avion.',
    }),
    choice({
      id: 'voc-a1-05', level: 'A1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'I ___ my teeth every morning.',
      options: ['brush', 'cook', 'wash', 'draw'], answer: 0,
      explanation: 'In English we brush our teeth. “Wash” is used for hands, face or clothes.',
    }),
    choice({
      id: 'voc-a1-06', level: 'A1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'The opposite of “big” is ___.',
      options: ['tall', 'small', 'fast', 'new'], answer: 1,
      explanation: 'Big and small are opposites, like hot and cold or old and new.',
    }),
    choice({
      id: 'voc-a1-07', level: 'A1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'You sleep in a ___.',
      options: ['bed', 'chair', 'table', 'door'], answer: 0,
      explanation: 'We sleep in a bed. A chair is for sitting and a table is for working or eating.',
    }),
    choice({
      id: 'voc-a1-08', level: 'A1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'We borrow books from the ___.',
      options: ['library', 'bakery', 'station', 'market'], answer: 0,
      explanation: 'A library lends books. A bakery sells bread and a station is for trains or buses.',
    }),
    choice({
      id: 'voc-a1-09', level: 'A1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'Which word means “a person who teaches”?',
      options: ['student', 'teacher', 'doctor', 'driver'], answer: 1,
      explanation: 'A teacher teaches. A student learns, a doctor treats patients and a driver drives.',
    }),
    choice({
      id: 'voc-a1-10', level: 'A1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'It is very hot. I need some ___.',
      options: ['water', 'bread', 'shoes', 'paper'], answer: 0,
      explanation: 'When you are hot or thirsty, you drink water.',
    }),
  ],
  A2: [
    match({
      id: 'voc-a2-01', level: 'A2',
      objective: 'Use travel vocabulary for a trip.',
      pairs: [{ term: 'passport', icon: 'passport' }, { term: 'ticket', icon: 'ticket' }, { term: 'suitcase', icon: 'suitcase' }],
      explanation: 'You show a passport at a border, a ticket lets you travel, and a suitcase carries your clothes.',
      fr: 'passport = passeport, ticket = billet, suitcase = valise.',
    }),
    match({
      id: 'voc-a2-02', level: 'A2',
      objective: 'Describe the weather with three nouns.',
      pairs: [{ term: 'sun', icon: 'sun' }, { term: 'umbrella', icon: 'umbrella' }, { term: 'snow', icon: 'snowflake' }],
      explanation: 'The sun gives light, an umbrella protects you from rain, and snow falls in cold weather.',
      fr: 'sun = soleil, umbrella = parapluie, snow = neige.',
    }),
    match({
      id: 'voc-a2-03', level: 'A2',
      objective: 'Name three jobs.',
      pairs: [{ term: 'chef', icon: 'chef' }, { term: 'engineer', icon: 'laptop' }, { term: 'nurse', icon: 'hospital' }],
      explanation: 'A chef cooks, an engineer designs or builds systems, and a nurse cares for patients.',
      fr: 'chef = chef cuisinier, engineer = ingénieur, nurse = infirmier/ère.',
    }),
    choice({
      id: 'voc-a2-04', level: 'A2', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'I am looking ___ my keys. I cannot find them.',
      options: ['for', 'at', 'after', 'up'], answer: 0,
      explanation: '“Look for” means search. “Look after” means take care of, and “look at” means observe.',
    }),
    choice({
      id: 'voc-a2-05', level: 'A2', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'Could you ___ the window? It is hot in here.',
      options: ['open', 'turn', 'make', 'break'], answer: 0,
      explanation: 'You open a window to let air in. “Turn” is used with knobs and pages, not windows in this sense.',
    }),
    choice({
      id: 'voc-a2-06', level: 'A2', skill: 'vocabulary', objective: 'Understand a synonym for “very tired”.', instruction: I,
      prompt: 'Which word means “very tired”?',
      options: ['exhausted', 'excited', 'expensive', 'exact'], answer: 0,
      explanation: 'Exhausted means extremely tired. Excited means very happy and interested.',
    }),
    choice({
      id: 'voc-a2-07', level: 'A2', skill: 'vocabulary', objective: 'Use restaurant vocabulary.', instruction: I,
      prompt: 'We need to ___ a table for six people.',
      options: ['book', 'buy', 'take', 'write'], answer: 0,
      explanation: 'You book (or reserve) a table in a restaurant. “Buy a table” would mean buying the furniture.',
    }),
    choice({
      id: 'voc-a2-08', level: 'A2', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'She is very good ___ mathematics.',
      options: ['at', 'in', 'on', 'for'], answer: 0,
      explanation: 'The usual collocation is “good at” + skill or subject: good at maths, good at drawing.',
    }),
    choice({
      id: 'voc-a2-09', level: 'A2', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'Take an umbrella. It is ___ outside.',
      options: ['pouring', 'shining', 'freezing', 'boiling'], answer: 0,
      explanation: '“It is pouring” means it is raining heavily.',
    }),
    choice({
      id: 'voc-a2-10', level: 'A2', skill: 'vocabulary', objective: 'Identify opposites.', instruction: I,
      prompt: 'The opposite of “expensive” is ___.',
      options: ['cheap', 'rich', 'large', 'heavy'], answer: 0,
      explanation: 'Expensive and cheap describe price. Rich describes a person with money.',
    }),
  ],
  B1: [
    match({
      id: 'voc-b1-01', level: 'B1',
      objective: 'Use environmental vocabulary accurately.',
      pairs: [{ term: 'recycling', icon: 'recycle' }, { term: 'pollution', icon: 'factory' }, { term: 'traffic', icon: 'car' }],
      explanation: 'Recycling reuses materials, pollution damages the environment, and traffic is the movement of vehicles.',
      fr: 'recycling = recyclage, pollution = pollution, traffic = circulation.',
    }),
    choice({
      id: 'voc-b1-02', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'The company decided to ___ the meeting until Friday.',
      options: ['postpone', 'cancel', 'attend', 'announce'], answer: 0,
      explanation: 'To postpone means to move something to a later time. To cancel means it will not happen.',
    }),
    choice({
      id: 'voc-b1-03', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'She has a strong ___ of humour.',
      options: ['sense', 'feeling', 'taste', 'mind'], answer: 0,
      explanation: 'The fixed expression is “a sense of humour”.',
    }),
    choice({
      id: 'voc-b1-04', level: 'B1', skill: 'vocabulary', objective: 'Understand a word from context.', instruction: I,
      prompt: 'The instructions were so ___ that nobody understood them.',
      options: ['confusing', 'confused', 'confidence', 'confuse'], answer: 0,
      explanation: '“Confusing” describes something that makes people confused. “Confused” describes a person.',
    }),
    choice({
      id: 'voc-b1-05', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'He apologised ___ being late.',
      options: ['for', 'of', 'about', 'to'], answer: 0,
      explanation: 'The verb pattern is “apologise for (doing) something”.',
    }),
    choice({
      id: 'voc-b1-06', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'This is the most ___ solution: it works well and costs little.',
      options: ['practical', 'possible', 'personal', 'polite'], answer: 0,
      explanation: 'Practical means useful and sensible in real situations.',
    }),
    choice({
      id: 'voc-b1-07', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'The gallery is ___ on Mondays, so we cannot visit it today.',
      options: ['closed', 'close', 'closing', 'closer'], answer: 0,
      explanation: '“Closed” is the adjective describing a place that is not open.',
    }),
    choice({
      id: 'voc-b1-08', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'I would rather ___ at home tonight.',
      options: ['stay', 'to stay', 'staying', 'stayed'], answer: 0,
      explanation: '“Would rather” is followed by the bare infinitive: would rather stay.',
    }),
    choice({
      id: 'voc-b1-09', level: 'B1', skill: 'vocabulary', objective: 'Understand an idiomatic expression.', instruction: I,
      prompt: 'Despite the rain, the match ___.',
      options: ['went ahead', 'went off', 'went out', 'went over'], answer: 0,
      explanation: '“Go ahead” means continue as planned. “Go off” can mean explode or stop working.',
    }),
    choice({
      id: 'voc-b1-10', level: 'B1', skill: 'vocabulary', objective: O, instruction: I,
      prompt: 'She is responsible ___ the club budget.',
      options: ['for', 'of', 'to', 'with'], answer: 0,
      explanation: 'The collocation is “responsible for” something.',
    }),
  ],
};
