// Noms des tables de jeu (Jambo, Baccalauréat, Le Wiseman) : l'univers du foot et des séries.
// Le code reste la clé pour rejoindre (dans le lien) ; le nom est ce qu'on voit et ce qu'on partage.

export const TABLE_NAMES: string[] = [
  // Légendes et Ballons d'or
  'Pelé', 'Maradona', 'Zidane', 'Ronaldinho', 'Ronaldo R9', 'Messi', 'Cristiano', 'Kaká', 'Cruyff', 'Platini',
  'Van Basten', 'George Weah', "Eto'o", 'Drogba', 'Roger Milla', 'Yaya Touré', 'Okocha', 'Abedi Pelé', 'Thierry Henry', 'Beckenbauer',
  'Eusébio', 'Baggio', 'Figo', 'Modrić', 'Benzema', 'Rivaldo', 'Puskás', 'Di Stéfano', 'Yachine', 'Nedvěd',
  'Cannavaro', 'Shevchenko', 'Mbappé', 'Salah', 'Sadio Mané', 'Rigobert Song', 'Patrick Mboma', 'Pirlo', 'Iniesta', 'Kanu',
  // Stades mythiques
  'Maracanã', 'Camp Nou', 'Bernabéu', 'Wembley', 'San Siro', 'Anfield', 'Old Trafford', 'Parc des Princes', 'Vélodrome', 'Allianz Arena',
  'Azteca', 'La Bombonera', 'Ahmadou-Ahidjo', 'Japoma', 'Olembe', 'Stade de France', 'Soccer City', 'Signal Iduna', 'Geoffroy-Guichard', 'Monumental',
  // Séries cultes
  'Breaking Bad', 'The Wire', 'Les Soprano', 'Game of Thrones', 'Prison Break', 'Casa de Papel', 'Peaky Blinders', 'Friends', 'Narcos', 'Lupin',
  'Power', 'Empire', 'Dexter', 'Lost', 'Stranger Things', 'Squid Game', 'The Office', 'Suits', 'Kaamelott', 'Le Bureau des légendes',
  'Black Mirror', 'Better Call Saul', 'Ozark', 'Succession', 'Vikings', 'Sherlock', 'Le Prince de Bel-Air', 'How I Met Your Mother', 'Mad Men', 'Oz',
  // Personnages de séries
  'Walter White', 'Heisenberg', 'Tony Soprano', 'Omar Little', 'Stringer Bell', 'Tyrion Lannister', 'Jon Snow', 'Arya Stark', 'Michael Scofield', 'T-Bag',
  'Le Professeur', 'Berlin', 'Tokyo', 'Thomas Shelby', 'Pablo Escobar', 'Ghost', 'Cookie Lyon', 'Jack Bauer', 'Harvey Specter', 'Saul Goodman',
  'Gus Fring', 'Jesse Pinkman', 'Eleven', 'Joey Tribbiani', 'Barney Stinson', 'Assane Diop', 'Michael Scott', 'Ragnar', 'Don Draper', 'Kendall Roy',
];

/** Un nom au hasard, différent de celui qu'on veut éviter. */
export const pickTableName = (avoid?: string, rng: () => number = Math.random) => {
  const pool = TABLE_NAMES.filter(n => n !== avoid);
  return pool[Math.floor(rng() * pool.length)];
};

/** Nom d'une table créée avant les noms : tiré de son code, toujours le même. */
export const tableNameOf = (code: string) => {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TABLE_NAMES[h % TABLE_NAMES.length];
};

export const nameOf = (t: { code: string; name?: string }) => t.name || tableNameOf(t.code);
