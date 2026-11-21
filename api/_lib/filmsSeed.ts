import type { Film } from '../../utils/films.js';

// Avis envoyés par Christian le 21/11 à 10 h 02 (orthographe corrigée, ses mots gardés). Faits
// vérifiés : MobLand saison 2 (Paramount+, Frankie Cooper, Kat McAllister), WAR (HBO Max, octobre
// 2026, Sienna Miller et Dominic West), Hope (Na Hong-jin, Cannes 2026 ; Ma'veyyo, Hope Harbor).
export const FILMS_2026_11_21: (Omit<Film, 'updatedAt'>)[] = [
  {
    id: 'mobland-s2', kind: 'serie', title: 'MobLand', season: 'Saison 2', by: '', where: 'Paramount+', rating: 8, spoilers: true, trailer: 'VvYl1a1Px5Y', poster: '', // bande-annonce officielle Paramount Plus
    teaser: 'Harry, toujours loyal aux Harrigan, face à Frankie Cooper qui veut leur trône.',
    review: "La saison 2 nous montre l'évolution du personnage principal, Harry, toujours lié et loyal à la famille Harrigan. Sa loyauté met sa propre famille en danger : il se retrouve à deux doigts de la perdre dans la guerre qui l'oppose à Frankie Cooper, l'autre chef de gang de la ville, qui veut récupérer le trône des Harrigan. Toute la saison repose sur cet affrontement, qui atteint son paroxysme à l'épisode 10.\n\nDerrière Frankie, on a aussi ce personnage magnifique, Kat, l'ambassadrice des États-Unis à Londres, qui décide de la vie ou de la mort des barons locaux. On a Eddie, qu'on aime détester tellement il est psychopathe, et Maeve, qui est totalement folle : son union avec Conrad est dingue et part dans tous les sens. Seraphina, considérée comme la plus intelligente de la fratrie, essaie tant bien que mal de se défaire de l'emprise de son père, mais finit toujours par revenir au bercail. Et que dire de Kevin et de son épouse ? Depuis la saison 1, on sait qu'il n'est pas le père d'Eddie : sa femme avait couché avec Conrad, et Eddie serait en fait le fils de Conrad.\n\nBref, l'épisode 10 nous donne un aperçu de ce qui nous attend dans la saison 3 : le fils de la Pieuvre (condamné plusieurs fois pour meurtre) sera aux trousses d'Eddie. Comment Harry, avec son sang-froid légendaire, va-t-il faire face à la famille Harrigan ? Va-t-il rester éternellement fidèle, même après la disparition de sa femme, à cause d'Eddie qui avait piégé sa voiture ? Et quelle relation aura-t-il désormais avec Maeve, qui a commandité son meurtre via Eddie ?",
  },
  {
    id: 'war-s1', kind: 'serie', title: 'WAR', season: 'Saison 1', by: '', where: 'HBO Max', rating: 7, spoilers: false, trailer: 'ZybkHGaoPvQ', poster: '', // bande-annonce officielle HBO Max
    teaser: "Le divorce d'un couple milliardaire, deux cabinets d'avocats, et presque tous les coups permis.",
    review: "La série plonge dans l'univers du divorce d'un couple milliardaire. Deux cabinets d'avocats s'opposent et presque tous les coups sont permis. Au fil des épisodes, on ne sait plus quel camp choisir : celui de la femme ou celui de l'homme.\n\nQui est réellement le fautif dans ce mariage ? Le fait qu'il était infidèle justifie-t-il qu'elle ait demandé à son amie de tester son mari ? A-t-elle le droit de réclamer des parts de la société qu'il a créée, même si elle ne participait pas à son fonctionnement au quotidien ? Bref, une très bonne série, assez enivrante.",
  },
  {
    id: 'hope-na-hong-jin', kind: 'film', title: 'Hope', season: '', by: 'Na Hong-jin', where: 'Au cinéma', rating: 9, spoilers: false, trailer: 'R5jcEBVBEbQ', poster: '', // bande-annonce officielle NEON
    teaser: 'Des extraterrestres face aux humains autour de Hope Harbor : une claque visuelle.',
    review: "En termes d'images, on en ressort bouche bée. On prend une claque avec les scènes de poursuite dans la petite ville de Hope ou dans la forêt. Extraterrestres face aux humains : au début, on ne comprend pas pourquoi les extraterrestres s'en prennent aux humains, mais à mesure que le film avance, on commence à comprendre d'où tout est parti et pourquoi.\n\nLes scènes de combat sont époustouflantes, et les poursuites de Ma'veyyo dans la forêt font baver tellement elles sont bien filmées. Je ne peux pas trop spoiler, mais à la fin du film, on se dit qu'il reste de l'espoir des deux côtés, pour les humains comme pour les extraterrestres.\n\nLes acteurs, l'humour noir, les scènes : un chef-d'œuvre cinématographique.",
  },
];
