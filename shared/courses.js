// Course versions of the chatbot. Each course has its own link (e.g. /francais-4),
// its own ACTFL level range, and its own unit topics on top of the general topics.
//
// To add a unit later, add an object to that course's `units` list. Each topic needs:
//   id       unique, lowercase, no spaces
//   label    "French title — English subtitle" (shown on the tile)
//   emoji    shown on the tile
//   guide    instructions for Camille: what to talk about and good questions to ask.
//            Write it in English; Camille adapts the questions to the learner's level.

export const COURSES = [
  {
    id: 'francais-4',
    name: 'Français 4',
    tagline: 'Target: Intermediate Mid',
    learner: 'a high-school student in French 4',
    levels: ['intermediate-low', 'intermediate-mid', 'intermediate-high'],
    target: 'intermediate-mid',
    badges: { 'intermediate-mid': 'Target', 'intermediate-high': 'Challenge' },
    units: [
      {
        id: 'f4-u1',
        title: 'Unité 1 · Les arts et les artistes',
        subtitle: 'Artists, their art, and how it shaped their lives',
        topics: [
          {
            id: 'f4-musique',
            label: 'La musique — artists & songs that matter to you',
            emoji: '🎵',
            guide: `Talk about music in the learner's life: favourite artists and genres, when and where they listen, a concert or performance they remember, a song tied to a memory, whether they play an instrument or sing. Bring in how an artist's life (childhood, struggles, culture, success) influenced their music. You may mention francophone artists (Stromae, Angèle, Aya Nakamura, Céline Dion, Édith Piaf, Youssou N'Dour…) if the learner is curious, but let them talk about artists THEY love.
Good questions: « Qui est ton artiste préféré ? Pourquoi ? » « Quelle chanson te rappelle un moment important ? » « Qu'est-ce que tu sais de la vie de cet artiste ? » « Comment sa vie a influencé sa musique ? » « Comment la musique influence ta vie ? »`,
          },
          {
            id: 'f4-arts',
            label: 'Les arts — painting, film, dance, theatre, photo…',
            emoji: '🎨',
            guide: `Let the learner CHOOSE an art form they care about: painting, drawing, photography, film, dance, theatre, sculpture, fashion, street art, video games, writing… Ask them to describe a work or artist they love, whether they practise an art themselves, and what art means to them. Francophone examples (Monet, Matisse, Frida Kahlo's time in Paris, JR's street art, Cirque du Soleil, French cinema) only if useful.
Good questions: « Quel art est important pour toi ? » « Décris une œuvre que tu aimes. » « Qu'est-ce que tu ressens quand tu la regardes ? » « Est-ce que tu fais de l'art ? Depuis quand ? »`,
          },
          {
            id: 'f4-art-vie',
            label: "L'art et la vie — how art shaped an artist's life (and yours)",
            emoji: '🌟',
            guide: `Explore the unit's big question: how does an artist's life influence their art, and how does art influence people's lives? Invite the learner to tell the story of an artist they studied or admire (where they grew up, challenges, turning points, success), which is a great chance to narrate in the past. Then connect it to the learner: how has art (music, film, a book, a painting) influenced their own life, mood, identity or friendships?
Good questions: « Raconte-moi l'histoire de cet artiste. » « Quel moment a changé sa vie ? » « Comment ses expériences se voient dans son art ? » « Est-ce qu'une œuvre a changé quelque chose dans ta vie ? »`,
          },
        ],
      },
      {
        id: 'f4-u2',
        title: "Unité 2 · L'amitié et les relations",
        subtitle: 'Friends, family and community',
        topics: [
          {
            id: 'f4-bon-ami',
            label: 'Un bon ami — what makes a good friend?',
            emoji: '🤝',
            guide: `Discuss what makes a good friend: qualities (fidèle, honnête, drôle, à l'écoute, généreux…), what friends do together, how friendships change over time, online vs. in-person friends. Ask the learner to describe their best friend and why that friendship works. Share your own (invented) view so it feels like a real exchange.
Good questions: « Pour toi, c'est quoi un bon ami ? » « Décris ton meilleur ami ou ta meilleure amie. » « Comment vous vous êtes rencontrés ? » « Qu'est-ce que vous aimez faire ensemble ? »`,
          },
          {
            id: 'f4-souvenir',
            label: 'Un souvenir — a great memory with a friend',
            emoji: '📸',
            guide: `Invite the learner to TELL A STORY about a great memory with a friend: a trip, a party, a funny moment, an adventure. This is a storytelling task: help them narrate in the past with follow-ups (when, where, who, what happened, then what, how did they feel). React like a friend listening to a story ("Non ! C'est pas vrai !", "Et après ?"). You can share a short memory of your own.
Good questions: « Raconte-moi un super souvenir avec un ami. » « C'était quand ? Où ? » « Qu'est-ce qui s'est passé ensuite ? » « Pourquoi c'est un souvenir important pour toi ? »`,
          },
          {
            id: 'f4-difficile',
            label: 'Un moment difficile — a tough time with a friend',
            emoji: '🌧️',
            guide: `Talk about a difficult moment in a friendship: a disagreement, a misunderstanding, jealousy, moving away, drifting apart, and how it was resolved (or not). The learner decides how much to share. Make clear they can talk about a real situation, a made-up one, or a character from a film or book. Focus on what happened, feelings, and what they learned. Be warm and non-judgemental; never push for private details.
Good questions: « Est-ce que tu t'es déjà disputé avec un ami ? » « Qu'est-ce qui s'est passé ? » « Comment vous avez résolu le problème ? » « Qu'est-ce que tu as appris ? » « Quels conseils tu donnerais à quelqu'un dans cette situation ? »`,
          },
          {
            id: 'f4-famille',
            label: 'La famille — siblings, parents, grandparents',
            emoji: '👨‍👩‍👧',
            guide: `Talk about relationships in the family: siblings (getting along, arguing, sharing), parents, grandparents, cousins, family traditions and memories. Families come in many forms: never assume a family structure, and let the learner choose who to talk about (they can also talk about a TV family or an invented one). Invite descriptions and stories (a memory with a grandparent, a family tradition).
Good questions: « Avec qui tu t'entends bien dans ta famille ? » « Tu as des frères et sœurs ? Comment est votre relation ? » « Tu as un souvenir avec tes grands-parents ? » « Quelle est une tradition dans ta famille ? »`,
          },
          {
            id: 'f4-communaute',
            label: 'La communauté — neighbours & community',
            emoji: '🏘️',
            guide: `Talk about relationships beyond family and friends: neighbours, teammates, coaches, teachers, people at a place of worship, a club or a job, volunteering, community events. What makes a good neighbour? How do people help each other in their community? Invite a story about someone in the community who made a difference.
Good questions: « Tu connais tes voisins ? Comment ils sont ? » « Qui est une personne importante dans ta communauté ? Pourquoi ? » « Tu fais du bénévolat ? » « Comment on peut créer une bonne communauté ? »`,
          },
        ],
      },
    ],
  },
  {
    id: 'francais-5',
    name: 'Français 5',
    tagline: 'Moving toward Intermediate High',
    learner: 'a high-school student in French 5',
    levels: ['intermediate-mid', 'intermediate-high', 'advanced-low'],
    target: 'intermediate-high',
    badges: { 'intermediate-high': 'Target', 'advanced-low': 'Challenge' },
    units: [
      {
        id: 'f5-u1',
        title: 'Unité 1 · Les défis des ados',
        subtitle: 'Challenges teenagers face today',
        topics: [
          {
            id: 'f5-ecole',
            label: "La pression scolaire — homework, grades, tests",
            emoji: '📚',
            guide: `Discuss academic pressure: homework load, grades, tests, competition, expectations from teachers, how it affects sleep and free time. Ask for the learner's experiences and opinions, compare with school in France (le bac, les notes sur 20) if they are curious, and invite them to propose solutions (what should schools change?).
Good questions: « Combien d'heures de devoirs tu as par soir ? » « Est-ce que les notes sont trop importantes ? Pourquoi ? » « Si tu étais directeur ou directrice, qu'est-ce que tu changerais ? »`,
          },
          {
            id: 'f5-parents',
            label: 'Les attentes des parents — family expectations',
            emoji: '🏠',
            guide: `Discuss pressure and expectations from parents or family: grades, activities, future careers, chores, rules, independence. Explore both sides (why parents have expectations, how teens feel), and how to communicate about it. The learner chooses how personal to be; they can speak generally about "les ados" instead of themselves.
Good questions: « Qu'est-ce que les parents attendent des ados aujourd'hui ? » « Est-ce que c'est juste ? » « Comment un ado peut parler à ses parents quand il se sent sous pression ? »`,
          },
          {
            id: 'f5-stress',
            label: 'Le stress et le bien-être — stress, anxiety, balance',
            emoji: '🧘',
            guide: `Discuss stress and anxiety among teenagers in a general, supportive way: causes, how stress feels, healthy ways to cope (sport, music, sleep, friends, talking to someone), and what schools or families could do. Keep it a conversation about ideas and strategies; you are NOT a therapist. Let the learner talk about teens in general if they prefer. Follow the WELL-BEING rule in your instructions if anything suggests the learner is struggling seriously.
Good questions: « Qu'est-ce qui stresse le plus les ados aujourd'hui ? » « Qu'est-ce qui t'aide à te détendre ? » « Quels conseils tu donnerais à un ami stressé ? »`,
          },
          {
            id: 'f5-temps',
            label: 'Gérer son temps — sports, activities, schedule',
            emoji: '⏰',
            guide: `Talk about time management: balancing school, homework, sports, clubs, a job, family, friends, sleep and screens. Ask the learner to describe a typical busy week, compare with a calm one, and share strategies (agendas, priorities, saying no). Sports at school are a great angle: the benefits and the pressure of competition, practices and games.
Good questions: « Décris-moi une semaine typique. » « Tu fais du sport ? Combien d'entraînements par semaine ? » « Comment tu organises ton temps ? » « Qu'est-ce que tu sacrifierais si tu avais trop de choses à faire ? »`,
          },
          {
            id: 'f5-avenir',
            label: "L'université et l'avenir — applications & future plans",
            emoji: '🎓',
            guide: `Talk about the future: applying to university or college, choosing a major, gap years, jobs, trade school, other paths, the stress of applications and essays, and dreams for the future. Encourage future and conditional tenses naturally ("Si tu pouvais…", "Dans dix ans…"). Respect all paths; university is not the only option.
Good questions: « Qu'est-ce que tu aimerais faire après le lycée ? » « Qu'est-ce qui est stressant dans les candidatures ? » « Si tu pouvais étudier n'importe quoi n'importe où, qu'est-ce que tu choisirais ? »`,
          },
          {
            id: 'f5-reseaux',
            label: 'Les réseaux sociaux — pressure & comparison',
            emoji: '📱',
            guide: `Discuss social media in teens' lives: which apps they use, the good (connection, creativity, information) and the bad (comparison, FOMO, cyberbullying, screen time, fake images, influencers). Invite opinions and debate: should there be age limits? Should phones be banned at school (as in France)? Ask them to support their opinion with examples.
Good questions: « Quelle appli tu utilises le plus ? Pourquoi ? » « Est-ce que les réseaux sociaux mettent la pression sur les ados ? Comment ? » « Tu es pour ou contre l'interdiction des portables à l'école ? »`,
          },
        ],
      },
      {
        id: 'f5-u2',
        title: "Unité 2 · L'immigration et la communauté",
        subtitle: 'How immigration changes a community',
        topics: [
          {
            id: 'f5-partir',
            label: 'Pourquoi partir ? — reasons people leave their country',
            emoji: '🌍',
            guide: `Discuss why people leave their country: difficult reasons (war, persecution, poverty, natural disasters and climate change, lack of safety) and hopeful reasons (better job or education opportunities, joining family, freedom, adventure). Help the learner compare and explain causes and consequences. You can bring in francophone examples (migration from Haiti, West Africa, the Maghreb, Lebanon to France or Québec).
Good questions: « Pourquoi est-ce que les gens quittent leur pays ? » « Quelle est la différence entre partir par choix et partir par obligation ? » « Qu'est-ce que tu emporterais si tu devais partir demain ? »`,
          },
          {
            id: 'f5-defis',
            label: "S'installer ailleurs — challenges of starting over",
            emoji: '🧳',
            guide: `Discuss the challenges immigrants face when they move: learning a new language, culture shock, finding work and housing, paperwork, discrimination, homesickness, kids translating for parents, keeping one's culture while adapting. Invite the learner to imagine and hypothesize ("Si tu déménageais dans un pays où tu ne parles pas la langue…"). They may share a family story if THEY choose to.
Good questions: « Quel serait le plus grand défi pour toi ? » « Comment une école peut aider un nouvel élève qui vient d'un autre pays ? » « Comment garder sa culture dans un nouveau pays ? »`,
          },
          {
            id: 'f5-commerces',
            label: 'Notre communauté — immigrant-owned businesses & contributions',
            emoji: '🏪',
            guide: `Discuss how immigration changes and enriches a community: restaurants, bakeries, markets, shops and businesses started by immigrants in the learner's town; food, festivals, music, languages, religions, and the economy. Ask the learner to describe a place they know (what it sells, the atmosphere, the owners' story if they know it) and how it has changed their neighbourhood.
Good questions: « Tu connais un restaurant ou un magasin tenu par des immigrés dans ta ville ? Décris-le. » « Comment l'immigration a changé ta communauté ? » « Qu'est-ce qu'une ville gagne avec la diversité ? »`,
          },
        ],
      },
    ],
  },
];

export function getCourse(id) {
  return COURSES.find((c) => c.id === id) ?? null;
}

export function courseTopic(courseId, topicId) {
  const course = getCourse(courseId);
  for (const u of course?.units ?? []) {
    const t = u.topics.find((t) => t.id === topicId);
    if (t) return { ...t, unitTitle: u.title };
  }
  return null;
}
