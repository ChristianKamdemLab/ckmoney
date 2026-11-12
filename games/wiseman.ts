import { normalize } from './bac.js';

// Le Wiseman (jeu de l'intrus) : règles sans interface.
//  - Les civils reçoivent un mot, l'intrus un mot proche ; personne ne connaît son rôle.
//  - En option (5 joueurs et plus), un joueur ne reçoit aucun mot et doit bluffer : le « sans mot ».
//  - À tour de rôle, chacun donne un indice ; puis tout le monde vote. Le plus désigné est éliminé
//    et son rôle révélé. Égalité : personne ne sort.
//  - Le sans mot éliminé peut deviner le mot des civils : s'il trouve, il gagne seul.
//  - Les civils gagnent quand tous les imposteurs sont sortis ; les imposteurs gagnent s'il ne reste
//    plus qu'un civil.
// Points : civil 2, intrus 10, sans mot 6.

export type Role = 'civil' | 'intrus' | 'blanc';
export type Winner = 'civils' | 'imposteurs' | 'blanc';
export const POINTS: Record<Role, number> = { civil: 2, intrus: 10, blanc: 6 };
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const BLANK_MIN_PLAYERS = 5;
export const ROLE_LABEL: Record<Role, string> = { civil: 'civil', intrus: 'intrus', blanc: 'sans mot' };

export const WORD_PAIRS: [string, string][] = [
  // Cameroun et Afrique
  ['Ndolé', 'Eru'], ['Bobolo', 'Miondo'], ['Plantain', 'Banane'], ['Makossa', 'Bikutsi'], ['Douala', 'Yaoundé'],
  ['Benskin', 'Taxi'], ['Beignet', 'Crêpe'], ['Arachide', 'Noix de cajou'], ['Safou', 'Avocat'], ['Poulet DG', 'Poulet braisé'],
  ['Maquis', 'Restaurant'], ['Tontine', 'Banque'], ['Dot', 'Mariage'], ['Pirogue', 'Bateau'], ['Savane', 'Forêt'],
  ['Jambo', 'Belote'], ['Coupe du monde', 'CAN'], ['Pagne', 'Boubou'], ['Okok', 'Ndolé'], ['Mangue', 'Papaye'],
  ['Bissap', 'Jus de gingembre'], ['Couscous', 'Riz'], ['Gombo', 'Épinard'], ['Igname', 'Patate douce'], ['Manioc', 'Macabo'],
  // Cuisine
  ['Café', 'Thé'], ['Pizza', 'Hamburger'], ['Lait', 'Yaourt'], ['Vin', 'Bière'], ['Chocolat', 'Caramel'],
  ['Glace', 'Sorbet'], ['Sucre', 'Sel'], ['Piment', 'Poivre'], ['Tomate', 'Poivron'], ['Oignon', 'Ail'],
  ['Pomme', 'Poire'], ['Orange', 'Mandarine'], ['Ananas', 'Noix de coco'], ['Citron', 'Pamplemousse'], ['Fraise', 'Framboise'],
  ['Coca', 'Fanta'], ['Whisky', 'Rhum'], ['Champagne', 'Vin blanc'], ['Pain', 'Brioche'], ['Poisson', 'Crevette'],
  ['Omelette', 'Œuf dur'], ['Frites', 'Chips'], ['Soupe', 'Sauce'], ['Gâteau', 'Tarte'], ['Miel', 'Confiture'],
  // Animaux
  ['Chat', 'Chien'], ['Lion', 'Tigre'], ['Éléphant', 'Hippopotame'], ['Crocodile', 'Lézard'], ['Singe', 'Gorille'],
  ['Poule', 'Canard'], ['Mouton', 'Chèvre'], ['Abeille', 'Guêpe'], ['Moustique', 'Mouche'], ['Requin', 'Dauphin'],
  ['Serpent', 'Ver de terre'], ['Cheval', 'Âne'], ['Hibou', 'Aigle'], ['Fourmi', 'Termite'], ['Tortue', 'Escargot'],
  // Lieux et voyages
  ['Plage', 'Piscine'], ['Avion', 'Hélicoptère'], ['Train', 'Métro'], ['Montagne', 'Colline'], ['Rivière', 'Lac'],
  ['Hôpital', 'Pharmacie'], ['École', 'Université'], ['Bureau', 'Usine'], ['Marché', 'Supermarché'], ['Boîte de nuit', 'Bar'],
  ['Cinéma', 'Théâtre'], ['Concert', 'Festival'], ['Valise', 'Sac à dos'], ['Passeport', 'Visa'], ['Aéroport', 'Gare'],
  ['Hôtel', 'Auberge'], ['Vacances', 'Week-end'], ['Vélo', 'Trottinette'], ['Prison', 'Commissariat'], ['Stade', 'Gymnase'],
  // Métiers et gens
  ['Médecin', 'Infirmier'], ['Policier', 'Gendarme'], ['Pompier', 'Ambulancier'], ['Boulanger', 'Pâtissier'], ['Coiffeur', 'Barbier'],
  ['Professeur', 'Directeur'], ['Chanteur', 'Rappeur'], ['Acteur', 'Mannequin'], ['Roi', 'Président'], ['Juge', 'Avocat'],
  ['Arbitre', 'Entraîneur'], ['Belle-mère', 'Tante'], ['Cousin', 'Frère'], ['Jumeaux', 'Triplés'], ['Copine', 'Épouse'],
  ['Ex', 'Crush'], ['Bébé', 'Enfant'], ['Grand-père', 'Oncle'], ['Voisin', 'Colocataire'], ['Patron', 'Collègue'],
  // Objets et maison
  ['Guitare', 'Violon'], ['Bague', 'Bracelet'], ['Collier', 'Boucle d’oreille'], ['Parfum', 'Déodorant'], ['Savon', 'Shampoing'],
  ['Brosse à dents', 'Dentifrice'], ['Miroir', 'Fenêtre'], ['Clé', 'Cadenas'], ['Télévision', 'Radio'], ['Ordinateur', 'Tablette'],
  ['Lit', 'Canapé'], ['Frigo', 'Congélateur'], ['Couteau', 'Fourchette'], ['Stylo', 'Crayon'], ['Livre', 'Cahier'],
  ['Chaussure', 'Sandale'], ['Lunettes', 'Montre'], ['Parapluie', 'Imperméable'], ['Casquette', 'Chapeau'], ['Ventilateur', 'Climatiseur'],
  // Numérique, sport et fêtes
  ['WhatsApp', 'Facebook'], ['Instagram', 'TikTok'], ['iPhone', 'Samsung'], ['Netflix', 'YouTube'], ['SMS', 'E-mail'],
  ['Appel', 'Visio'], ['Photo', 'Selfie'], ['Football', 'Basketball'], ['Boxe', 'Lutte'], ['Tennis', 'Ping-pong'],
  ['Échecs', 'Dames'], ['Cartes', 'Dominos'], ['Natation', 'Plongée'], ['Course', 'Marathon'], ['But', 'Penalty'],
  ['Anniversaire', 'Baptême'], ['Noël', 'Nouvel an'], ['Salaire', 'Prime'], ['Soleil', 'Lune'], ['Pluie', 'Orage'],
];

/** Rôles distribués au hasard : 1 intrus jusqu'à 5 joueurs, 2 au-delà ; un sans mot en option (5 joueurs et plus). */
export const assignRoles = (n: number, withBlank: boolean, rng: () => number = Math.random): Role[] => {
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error('nombre de joueurs');
  const intrus = n >= 6 ? 2 : 1;
  const blank = withBlank && n >= BLANK_MIN_PLAYERS ? 1 : 0;
  const roles: Role[] = [
    ...Array<Role>(intrus).fill('intrus'), ...Array<Role>(blank).fill('blanc'),
    ...Array<Role>(n - intrus - blank).fill('civil'),
  ];
  for (let i = roles.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [roles[i], roles[j]] = [roles[j], roles[i]]; }
  return roles;
};

/** Une paire de mots, dans un sens ou dans l'autre ; on évite celles déjà jouées à cette table. */
export const pickPair = (used: number[], rng: () => number = Math.random) => {
  const free = WORD_PAIRS.map((_, i) => i).filter(i => !used.includes(i));
  const pool = free.length ? free : WORD_PAIRS.map((_, i) => i);
  const index = pool[Math.floor(rng() * pool.length)];
  const [a, b] = WORD_PAIRS[index];
  return rng() < 0.5 ? { index, civil: a, intrus: b } : { index, civil: b, intrus: a };
};

/** Le plus désigné ; null en cas d'égalité ou sans vote. */
export const tally = (votes: Record<string, string>): string | null => {
  const count = new Map<string, number>();
  Object.values(votes).forEach(t => count.set(t, (count.get(t) || 0) + 1));
  let best: string | null = null, max = 0, tie = false;
  count.forEach((n, t) => { if (n > max) { best = t; max = n; tie = false; } else if (n === max) tie = true; });
  return tie ? null : best;
};

export const winnerOf = (aliveRoles: Role[]): Winner | null => {
  const impostors = aliveRoles.filter(r => r !== 'civil').length;
  const civils = aliveRoles.length - impostors;
  if (!impostors) return 'civils';
  if (civils <= 1) return 'imposteurs';
  return null;
};

export const guessMatches = (guess: string, word: string) => !!normalize(guess) && normalize(guess) === normalize(word);

/** Points de fin de partie pour chaque joueur, selon son rôle et le camp gagnant. */
export const pointsFor = (role: Role, winner: Winner) =>
  winner === 'blanc' ? (role === 'blanc' ? POINTS.blanc : 0)
  : winner === 'civils' ? (role === 'civil' ? POINTS.civil : 0)
  : role === 'civil' ? 0 : POINTS[role];
