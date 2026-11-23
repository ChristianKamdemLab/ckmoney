import type { Film } from '../../utils/films.js';

// Avis envoyés par Christian le 21/11 à 10 h 02, restructurés le même jour à sa demande (10 h 24 :
// « tu peux remplacer direct ») : de quoi ça parle, ce qui marche, ses questions, son verdict ; ses
// mots et ses expressions gardés. Faits vérifiés : MobLand saison 2 (Paramount+, Frankie Cooper,
// Kat McAllister), WAR (HBO Max, octobre 2026), Hope (Na Hong-jin, Cannes 2026 ; Ma'veyyo, Hope Harbor).
// Bandes-annonces des chaînes officielles (Paramount Plus, HBO Max, NEON).
export const FILMS_2026_11_21: (Omit<Film, 'updatedAt'>)[] = [
  {
    id: 'mobland-s2', kind: 'serie', title: 'MobLand', season: 'Saison 2', by: '', where: 'Paramount+', rating: 8, spoilers: false,
    trailer: 'VvYl1a1Px5Y', poster: '',
    teaser: 'Harry, toujours loyal aux Harrigan, pris dans la guerre que leur déclare Frankie Cooper.',
    review: "MobLand, c'est l'histoire de Harry, l'homme de confiance des Harrigan, ce clan criminel londonien qu'il sert avec un sang-froid légendaire. Dans cette saison 2, sa loyauté envers la famille Harrigan finit par mettre en danger sa propre famille : Frankie Cooper, l'autre chef de gang de la ville, veut récupérer le trône des Harrigan, et toute la saison repose sur cet affrontement, qui atteint son paroxysme à l'épisode 10.\n\nCe qui fait la force de la série, ce sont ses personnages. Derrière Frankie, il y a Kat, l'ambassadrice des États-Unis à Londres, un personnage magnifique qui décide de la vie ou de la mort des barons locaux. Chez les Harrigan, on a Eddie, qu'on aime détester tellement il est psychopathe, Maeve, qui est totalement folle (son union avec Conrad est dingue et part dans tous les sens), et Seraphina, considérée comme la plus intelligente de la fratrie, qui essaie tant bien que mal de se défaire de l'emprise de son père mais finit toujours par revenir au bercail.\n\nBref, une saison qui tient en haleine jusqu'au bout et qui donne déjà envie de voir la suite. Un 8/10.",
    spoilerText: "Côté secrets de famille, on sait depuis la saison 1 que Kevin n'est pas le père d'Eddie : sa femme avait couché avec Conrad, et Eddie serait en fait le fils de Conrad.\n\nL'épisode 10 nous donne un aperçu de ce qui nous attend dans la saison 3 : le fils de la Pieuvre (condamné plusieurs fois pour meurtre) sera aux trousses d'Eddie. Mais la vraie question, c'est Harry. Comment va-t-il faire face à la famille Harrigan ? Va-t-il rester éternellement fidèle, même après la disparition de sa femme, à cause d'Eddie qui avait piégé sa voiture ? Et quelle relation aura-t-il désormais avec Maeve, qui a commandité son meurtre via Eddie ?",
  },
  {
    id: 'war-s1', kind: 'serie', title: 'WAR', season: 'Saison 1', by: '', where: 'HBO Max', rating: 7, spoilers: false,
    trailer: 'ZybkHGaoPvQ', poster: '',
    teaser: "Le divorce d'un couple milliardaire, deux cabinets d'avocats, et presque tous les coups permis.",
    review: "WAR nous plonge dans l'univers du divorce au sein d'un couple milliardaire : deux cabinets d'avocats s'affrontent, et presque tous les coups sont permis.\n\nEt c'est là que la série est forte, parce qu'au fur et à mesure des épisodes, on ne sait plus quel camp choisir, celui de la femme ou celui de l'homme. Qui est réellement le fautif dans ce mariage ? Le fait qu'il était infidèle justifie-t-il qu'elle ait demandé à son amie de tester son mari ? A-t-elle le droit de réclamer des parts de la société qu'il a créée, même si elle ne participait pas à son fonctionnement au quotidien ?\n\nBref, une très bonne série, assez enivrante. Un 7/10.",
    spoilerText: '',
  },
  {
    id: 'hope-na-hong-jin', kind: 'film', title: 'Hope', season: '', by: 'Na Hong-jin', where: 'Au cinéma', rating: 9, spoilers: false,
    trailer: 'R5jcEBVBEbQ', poster: '',
    teaser: 'Des extraterrestres face aux humains autour de Hope Harbor : une claque visuelle.',
    review: "Hope, c'est l'affrontement entre des extraterrestres et les humains, dans la petite ville de Hope et dans la forêt qui l'entoure, signé du réalisateur coréen Na Hong-jin. Au début, on ne comprend pas pourquoi les extraterrestres s'en prennent aux humains, mais à mesure que le film avance, on commence à comprendre d'où tout est parti, et pourquoi.\n\nEn termes d'images, on en ressort bouche bée. On prend une claque avec les scènes de poursuite dans la ville et dans la forêt, les scènes de combat sont époustouflantes, et les poursuites de Ma'veyyo dans la forêt font baver tellement elles sont bien filmées. Ajoutez à ça les acteurs et l'humour noir.\n\nJe ne peux pas trop spoiler, mais à la fin du film, on se dit qu'il reste de l'espoir des deux côtés, pour les humains comme pour les extraterrestres. Un chef-d'œuvre cinématographique : 9/10.",
    spoilerText: '',
  },
];
