import { adminAuth, adminDb, pushToUser, isAdmin, authorEmail } from './admin.js';
import type { Film } from '../../utils/films.js';
import { FILMS_2026_11_21 } from './filmsSeed.js';
import type { Place } from '../../utils/vendredi.js';
import { sendMail } from './mail.js';
import { importEvents, SeedEvent, SALONS_2026_2027 } from './salons.js';
import { pageImage } from './radioMeta.js';
import { importRadio, RadioSeed, RADIO_LANCEMENT, RADIO_2026_11_19, RADIO_2026_11_19_SOIR, RADIO_2026_11_20_ARTE, RADIO_2026_11_21_MEDIAS, LOGEMENT_POURQUOI, fillRadioComments, HEURE_DU_MONDE_POURQUOI, RADIO_2026_11_27_HDM } from './radioSeed.js';

// Annonces : une notification et/ou un e-mail envoyés une seule fois, à l'heure prévue.
//  - notification : à tous les appareils inscrits (l'appli installée avec les notifications) ;
//  - e-mail : aux comptes CKMoney dont l'adresse est vérifiée (tous, ou seulement ceux qui n'ont pas
//    les notifications), avec le détail des nouveautés et une invitation à installer l'appli.
// Les annonces sont écrites ici, dans le code : les mettre en ligne passe par une fusion validée par
// Christian. Une annonce peut aussi publier des sorties d'un coup (calendrier de salons), sans
// notification. Déclenchement : GitHub Actions toutes les heures à :30 (.github/workflows/annonces.yml),
// et le cron du matin en secours. Une annonce n'est plus envoyée 6 h après son heure.

const APP = 'https://ck-money.vercel.app';

export interface NewsEmail {
  subject: string;
  intro: string;
  sections: { title: string; text: string; link?: { label: string; url: string } }[];
}
export interface Announcement {
  id: string;
  sendAt: string;
  push?: { title: string; body: string; url: string };
  pushTo?: 'author';    // notification à Christian seul (essai ou renvoi)
  email?: NewsEmail;
  emailTo?: 'all' | 'no-push' | 'author' | 'others'; // 'author' : essai à Christian seul ; 'others' : tous sauf lui
  events?: SeedEvent[]; // sorties à publier (voir salons.ts)
  eventsRemove?: string[];                       // sorties à retirer (identifiants Firestore), avec l'accord de Christian
  eventImages?: { id: string; page?: string; clear?: boolean }[]; // visuel officiel (og:image de la page, sinon de l'adresse de la sortie) ; clear : retire le visuel
  radio?: RadioSeed[];  // recos Radio CK à publier (voir radioSeed.ts)
  radioRemove?: string[];   // recos à retirer (doublons), avec leurs commentaires
  radioComments?: { id: string; comment: string }[]; // « pourquoi je le recommande » à compléter, sans notification
  placeReviews?: { id: string; review: string }[]; // avis de Christian sur une adresse déjà publiée
  placeImages?: { id: string; image: string }[]; // photo d'une adresse déjà publiée (remplace celle tirée du lien)
  places?: (Omit<Place, 'updatedAt'>)[]; // « Mes adresses » à ajouter (identifiant fixe, jamais recréées)
  films?: (Omit<Film, 'updatedAt'>)[];   // « Films et séries » à ajouter (idem ; le premier est le plus récent)
  filmsReplace?: boolean;                // remplace le texte des fiches existantes (avec l'accord de Christian)
}

/** L'e-mail des nouveautés de la semaine (sert aussi d'aperçu avant envoi). */
export const NEWS_2026_11_13: NewsEmail = {
  subject: 'Quoi de neuf sur CKMoney : sorties, jeux et articles',
  intro: "CKMoney ne sert plus seulement aux prêts entre proches. Voici ce que tu peux faire dans l'appli depuis cette semaine.",
  sections: [
    {
      title: 'Sorties',
      text: "Partage un événement, dis où tu es ce soir avec un spot, ou organise un chill avec un thème et des boissons. Chacun peut en publier, et tes amis répondent « Je viens », même sans compte. À ne pas manquer : le Salon des Diasporas Africaines, les 4 et 5 décembre à Paris, entrée gratuite.",
      link: { label: 'Voir les sorties', url: `${APP}/?sorties` },
    },
    {
      title: 'Jeux entre amis',
      text: "Jambo (Fap Fap), Baccalauréat et Le Wiseman : chacun joue sur son téléphone, tes amis rejoignent la table avec un lien, sans compte. Les tables portent des noms de légendes du foot et de séries cultes. On joue pour des points, jamais pour de l'argent.",
      link: { label: 'Lancer une partie de Jambo', url: `${APP}/jambo` },
    },
    {
      title: 'Articles',
      text: 'Les textes de Christian, à lire directement dans l’appli.',
      link: { label: 'Lire les articles', url: `${APP}/` },
    },
  ],
};

/** Ouverture du prêt à tous (13/11, validé par Christian à 16 h 22). */
export const NEWS_2026_11_13_PRET: NewsEmail = {
  subject: 'CKMoney s’ouvre à tous : prête à tes proches, toi aussi',
  intro: "Jusqu'ici, seul Christian pouvait prêter avec CKMoney. Depuis aujourd'hui, l'appli est ouverte à tous : toi aussi, tu peux t'en servir pour prêter à tes proches.",
  sections: [
    {
      title: 'Prêter à tes proches',
      text: "Sur ton accueil, touche « Prêter à mes proches ». Le contrat se signe avec le doigt, les rappels partent tout seuls et tu suis chaque remboursement. Personne d'autre que tes emprunteurs ne voit que tu prêtes, et l'appli ne touche jamais à l'argent : il passe directement entre vous.",
      link: { label: 'Ouvrir CKMoney', url: `${APP}/` },
    },
    {
      title: 'Faire une demande',
      text: "Tu peux faire ta demande à tes prêteurs directement dans l'appli, sans attendre leur lien. Une demande à la fois : la suivante quand la précédente est remboursée.",
    },
    {
      title: 'Radio CK',
      text: "Les podcasts et vidéos que Christian recommande, à écouter dans l'appli. Écoute, réagis, et dis ce que tu en penses en commentaire.",
      link: { label: 'Écouter Radio CK', url: `${APP}/?radio` },
    },
  ],
};

export const NEWS_2026_11_21_FILMS: NewsEmail = {
  subject: 'Nouveau sur CKMoney : Films et séries',
  intro: "Une nouvelle rubrique est arrivée dans CKMoney : les films et séries que Christian a regardés, avec la bande-annonce, sa note sur 10 et son avis.",
  sections: [
    {
      title: 'Films et séries',
      text: "Pour commencer : MobLand saison 2 (8/10), WAR saison 1 (7/10) et Hope, le film du Coréen Na Hong-jin (9/10). La bande-annonce se regarde directement dans l'appli, et quand un avis dévoile l'intrigue, la partie concernée reste masquée tant que tu ne l'as pas demandée.",
      link: { label: 'Voir Films et séries', url: `${APP}/?films` },
    },
    {
      title: 'Et aussi cette semaine',
      text: "Un nouveau look pour l'appli, L'info du jour chaque matin (le sujet dont le monde parle, et celui du Cameroun et de l'Afrique), Le mot du jour (un mot à trouver en six essais), Mes adresses (les lieux que Christian recommande) et Mon vendredi soir, où tu votes pour le lieu de la soirée.",
      link: { label: 'Ouvrir CKMoney', url: `${APP}/` },
    },
  ],
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-11-28-notif-haze',
    sendAt: '2026-11-28T10:40:00.000Z', // accord de Christian le 28/11 à 11 h 39
    push: { title: 'Nouvelle adresse : le Haze', body: "Un speakeasy près de l'Arc de Triomphe, testé par Christian. Son avis et son cocktail préféré dans Mes adresses.", url: '/?adresses' },
  },
  {
    id: '2026-11-28-avis-haze',
    sendAt: '2026-11-28T10:30:00.000Z', // avis de Christian du 28/11, orthographe corrigée
    placeReviews: [{ id: 'haze-paris', review: "Speakeasy situé à quelques pas de l'Arc de Triomphe. Quand on arrive dans cette ruelle, rien sur la façade ne laisse présager que derrière se cachent certains des meilleurs barmen mixologues de Paris. Pour entrer il faut sonner. On est alors reçu par l'un des quatre barmen en veste rouge à col Mao, qui nous accueille très chaleureusement et propose une place au bar ou à l'une des tables de l'entrée. Petit spoiler avant de continuer : la réservation est fortement conseillée et il faut arriver en début de soirée (20 h – 21 h) pour espérer une place au bar si vous êtes accompagné.\nDès que vous êtes assis, un barman vous tend une carte invisible dans le noir. Pour la découvrir il faut s'armer d'une mini-torche fluorescente qui révèle l'ensemble des cocktails, comme un voyage à travers Paris. Mon conseil : le New Ice Pop ! Vous me ferez votre retour.\nCôté ambiance, la lumière rouge tamisée rappelle Chinatown et l'endroit est fréquenté par beaucoup d'anglophones.\nPour les fumeurs, une petite salle fumoir au sous-sol permet d'allumer sa cigarette ou son cigare tout en savourant paisiblement ses cocktails.\nRien à ajouter : les amoureux de bons cocktails peuvent y aller les yeux fermés." }],
  },
  {
    id: '2026-11-27-haze-photo',
    sendAt: '2026-11-27T17:40:00.000Z', // Instagram ne donnait que son logo : photo du lieu (fiche Privateaser du Haze)
    placeImages: [{ id: 'haze-paris', image: 'https://privateaser-media.s3.eu-west-1.amazonaws.com/etab_photos/52668/1500x750/456997.jpg' }],
  },
  {
    id: '2026-11-27-adresse-haze',
    sendAt: '2026-11-27T17:10:00.000Z', // Christian y va ce soir ; son avis viendra après (fiche à compléter dans l'appli)
    places: [{
      id: 'haze-paris', name: 'Haze', address: "4 rue de l'Arc de Triomphe, 75017 Paris", url: 'https://www.instagram.com/haze.paris/',
      budget: 'Cocktail autour de 19 €', hours: 'Lundi 18 h – 0 h 30, du mardi au jeudi 19 h 30 – 2 h, vendredi et samedi 19 h 30 – 4 h (à confirmer)',
      review: '',
    }],
  },
  {
    id: '2026-11-27-radio-doublon',
    sendAt: '2026-11-27T16:45:00.000Z', // doublon signalé par Christian : « Médias et extrême droite » ajouté le 19/11 et le 21/11 ; on garde celui du 19/11 (son texte validé)
    radioRemove: ['seed-heure-du-monde-medias-extreme-droit'], // identifiant coupé à 40 caractères (importRadio)
  },
  {
    id: '2026-11-27-essai-notif-christian',
    sendAt: '2026-11-27T14:00:00.000Z', // Christian n'a pas reçu les avis des fiches du 27/11 : essai vers son appareil inscrit
    pushTo: 'author',
    push: { title: 'Essai de notification', body: "Si tu lis ceci, ton téléphone reçoit bien les notifications de CKMoney.", url: '/' },
  },
  {
    id: '2026-11-27-radio-hdm-bardella',
    sendAt: '2026-11-27T12:45:00.000Z', // recommandé par Christian à 13 h 40, avec notification
    radio: RADIO_2026_11_27_HDM,
    push: {
      title: 'Nouveau podcast dans Radio CK',
      body: 'L’Heure du Monde : « De nouveaux messages antisémites de Jordan Bardella révélés par “Le Monde” »',
      url: '/?radio',
    },
  },
  {
    id: '2026-11-26-expo-ndop',
    sendAt: '2026-11-26T18:05:00.000Z', // demandé par Christian à 19 h 59 : à ajouter aux événements, avec notification
    events: [{
      id: 'expo-ndop-maison-gacha', title: 'Ndop, filer le bleu pour raconter un monde', start: '2026-10-21', end: '2027-02-27',
      venue: 'Maison Gacha', address: '5 rue des Épinettes, 75017 Paris', price: 'Entrée libre',
      url: 'https://www.arts-in-the-city.com/275516-exposition-ndop-filer-le-bleu-pour-raconter-un-monde-a-la-maison-gacha', organizer: 'Maison Gacha',
      description: "Exposition consacrée au ndop, le textile teint à l'indigo des chefferies de l'Ouest du Cameroun, présenté avec des œuvres contemporaines : tentures de cérémonie, costume de société secrète, ateliers pour les familles et les adultes.\nDu mardi au samedi, de 11 h à 18 h. Métro Guy Môquet (ligne 13).",
    }],
    eventImages: [{ id: 'salon-expo-ndop-maison-gacha', page: 'https://www.arts-in-the-city.com/275516-exposition-ndop-filer-le-bleu-pour-raconter-un-monde-a-la-maison-gacha' }],
    push: {
      title: 'Nouvel événement',
      body: "« Ndop, filer le bleu pour raconter un monde » : le textile des rois de l'Ouest du Cameroun à la Maison Gacha (Paris 17e), jusqu'au 27 février. Entrée libre.",
      url: '/?evenement=salon-expo-ndop-maison-gacha',
    },
  },
  {
    id: '2026-11-24-sorties-visuels',
    sendAt: '2026-11-24T06:20:00.000Z', // visuels vérifiés à l'œil : logo seul (Wine Paris), icône (Japan Expo), affiche de l'édition 2026 (Paris Games Week) retirés
    eventImages: [
      { id: 'salon-wine-paris-2027', clear: true },
      { id: 'salon-japan-expo-2027', clear: true },
      { id: 'salon-paris-games-week-2027', clear: true },
    ],
  },
  {
    id: '2026-11-24-sorties-tri',
    sendAt: '2026-11-24T06:20:00.000Z', // choix de Christian (24/11, 7 h) : ne garder que les sorties où il va ; visuels des organisateurs
    eventsRemove: [
      'salon-ambition-africa-2026',
      'salon-ocde-forum-afrique-2026',
      'salon-africa-infrastructure-forum-2026',
      'salon-msgbc-2026',
      'salon-entrepreneurship-forum-2026',
      'salon-akili-energy-2026',
      'salon-fitb-2027',
      'salon-retromobile-2027',
      'salon-nigeria-energy-summit-2027',
      'salon-vignerons-independants-2027',
      'salon-ecowas-investment-forum-2027',
      'salon-avca-2027',
      'salon-africa-ceo-forum-2027',
      'salon-invest-african-energy-2027',
      'salon-congo-energy-forum-2027',
      'salon-simppar-2027',
      'salon-wampex-2027',
      'salon-drc-mining-week-2027',
      'salon-nog-energy-week-2027',
      'salon-propak-west-africa-2027',
      'salon-s2ia-2027',
      'salon-sim-senegal-2027',
    ],
    eventImages: [
      { id: 'salon-wine-paris-2027', page: 'https://wineparis.com/' },
      { id: 'salon-paris-perfume-week-2027', page: 'https://www.perfume-week.com/' },
      { id: 'salon-rhum-fest-paris-2027', page: 'https://www.rhumfestparis.com/' },
      { id: 'salon-japan-expo-2027', page: 'https://paris.japan-expo.com/fr' },
      { id: 'salon-whisky-live-paris-2027', page: 'https://www.whiskylive.fr/' },
      { id: 'salon-equip-auto-2027', page: 'https://paris.equipauto.com/' },
      { id: 'salon-paris-games-week-2027', page: 'https://www.parisgamesweek.com/fr' },
      { id: 'IMSCRSS0te2cEjY65nTm' },
    ],
  },
  {
    id: '2026-11-23-article-immorenovv-renvoi-christian',
    sendAt: '2026-11-23T10:05:00.000Z', // l'avis du 23/11 à 9 h 58 a manqué Christian (jeton renouvelé à 9 h 59) : renvoi à lui seul
    pushTo: 'author',
    push: { title: 'Nouvel article de Christian', body: "ImmoRenovv : et si c'était la solution pour vous construire un patrimoine immobilier en France ?", url: '/?article=ObdSSl8SiaoLnv5LWtY0' },
  },
  {
    id: '2026-11-23-verif-mail-nodemailer',
    sendAt: '2026-11-23T07:30:00.000Z', // vérifie l'envoi d'e-mails après la mise à jour de nodemailer (à Christian seul)
    emailTo: 'author',
    email: {
      subject: 'CKMoney · vérification des e-mails',
      intro: "Petit e-mail technique, à toi seul : la bibliothèque qui envoie les e-mails de l'appli vient d'être mise à jour pour corriger une faille de sécurité. Si tu lis ceci, les e-mails (rappels, bilans, annonces) partent toujours bien. Rien à faire.",
      sections: [],
    },
  },
  {
    id: '2026-11-13-nouveautes',
    sendAt: '2026-11-13T07:30:00.000Z', // 8 h 30 à Paris (envoyée à 8 h 40)
    push: {
      title: 'Du nouveau sur CKMoney',
      body: 'Nouvelle rubrique Sorties : événements, spots et chills à partager. Et les tables de jeu ont maintenant de vrais noms. À découvrir !',
      url: '/?sorties',
    },
  },
  {
    id: '2026-11-13-email-essai',
    sendAt: '2026-11-13T08:30:00.000Z', // essai demandé par Christian vers 9 h 30
    emailTo: 'author',
    email: NEWS_2026_11_13,
  },
  {
    id: '2026-11-13-email-nouveautes',
    sendAt: '2026-11-13T08:45:00.000Z', // essai validé par Christian à 9 h 46 : tous les autres comptes
    emailTo: 'others',
    email: NEWS_2026_11_13,
  },
  {
    id: '2026-11-13-salons',
    sendAt: '2026-11-13T10:30:00.000Z', // calendrier envoyé par Christian à 11 h : salons de Paris et d'Afrique subsaharienne
    events: SALONS_2026_2027,
  },
  {
    id: '2026-11-13-salons-notif',
    sendAt: '2026-11-13T10:40:00.000Z', // une seule notification pour les 32 salons, validée par Christian à 11 h 35
    push: {
      title: '32 salons ajoutés dans Sorties',
      body: "Paris et Afrique : SIREXE, Ambition Africa, Africa CEO Forum, Rétromobile, Japan Expo… Filtre Paris ou Afrique, et ajoute-les à ton agenda.",
      url: '/?sorties',
    },
  },
  {
    id: '2026-11-13-demande-directe',
    sendAt: '2026-11-13T11:55:00.000Z', // 12 h 55 à Paris, après la mise en ligne : la nouveauté, en notification seulement
    push: {
      title: 'Ta demande, directement dans l’appli',
      body: 'Plus besoin d’attendre le lien de Christian : ouvre CKMoney et touche « Faire une demande à Christian ». Une demande à la fois.',
      url: '/',
    },
  },
  {
    id: '2026-11-13-radio-ck',
    sendAt: '2026-11-13T13:25:00.000Z', // 14 h 25 à Paris : les trois liens envoyés par Christian, une seule notification
    radio: RADIO_LANCEMENT,
    push: {
      title: 'Radio CK est en ligne',
      body: 'Les podcasts et vidéos que Christian recommande, à écouter dans l’appli : Le Nectar, L’Heure du Monde et une vidéo. Réagis et dis ce que tu en penses.',
      url: '/?radio',
    },
  },
  {
    id: '2026-11-13-radio-heure-du-monde',
    sendAt: '2026-11-13T13:45:00.000Z', // raison donnée par Christian à 14 h 39 ; pas de notification
    radioComments: [{ id: 'heure-du-monde-lfi', comment: HEURE_DU_MONDE_POURQUOI }],
  },
  {
    id: '2026-11-13-pret-pour-tous',
    sendAt: '2026-11-13T15:20:00.000Z', // validée par Christian à 16 h 17 : notification seulement, pas d'e-mail
    push: {
      title: 'Toi aussi, prête à tes proches',
      body: 'CKMoney s’ouvre à tous : contrat signé avec le doigt, rappels automatiques, suivi des remboursements. Touche « Prêter à mes proches » sur ton accueil.',
      url: '/',
    },
  },
  {
    id: '2026-11-13-email-pret-pour-tous',
    sendAt: '2026-11-13T15:25:00.000Z', // demandé par Christian à 16 h 22 : tous les comptes, lui compris
    emailTo: 'all',
    email: NEWS_2026_11_13_PRET,
  },
  {
    id: '2026-11-19-radio-heure-du-monde',
    sendAt: '2026-11-19T14:00:00.000Z', // 15 h à Paris : trois épisodes envoyés par Christian, une seule notification (validée à 14 h 40)
    radio: RADIO_2026_11_19,
    push: {
      title: '3 nouveaux podcasts dans Radio CK',
      body: 'Médias et extrême droite, GTA VI et l’enquête Inside Deutsche Bank, à écouter dans l’appli.',
      url: '/?radio',
    },
  },
  {
    id: '2026-11-19-radio-logement',
    sendAt: '2026-11-19T17:25:00.000Z', // podcast envoyé par Christian à 18 h 21
    radio: RADIO_2026_11_19_SOIR,
    push: {
      title: 'Nouveau podcast dans Radio CK',
      body: 'C ce soir : « Logement : la bombe sociale de 2027 ? », à écouter dans l’appli.',
      url: '/?radio',
    },
  },  {
    id: '2026-11-20-immorenovv',
    sendAt: '2026-11-20T18:45:00.000Z', // invitation envoyée par Christian à 19 h 35 : il y participe le 21/11 ; pas de notification
    events: [{
      id: 'immorenovv-2026', title: 'Les Rencontres ImmoRenovv (2e édition)', start: '2026-11-21', end: '2026-11-21',
      times: { startsAt: '2026-11-21T10:30:00.000Z', endsAt: '2026-11-21T17:30:00.000Z' }, // 11 h 30 – 18 h 30, heure de Paris
      venue: 'Four Seasons Hotel George V', address: '31 avenue George V, 75008 Paris', price: 'Sur invitation', url: '', organizer: 'ImmoRenovv',
      description: "Rencontre consacrée à l'investissement immobilier : investir, rénover, valoriser. 50 invités seulement, sur invitation personnelle.\nAu programme : 11 h 30 accueil et déjeuner ; 13 h conférences, retours d'expérience et échanges autour des projets immobiliers ; 17 h cocktail de clôture.\nChristian y participe.",
    }],
  },
  {
    id: '2026-11-20-adresse-chez-gala',
    sendAt: '2026-11-20T19:05:00.000Z', // avis envoyé par Christian à 19 h 37 (soirée du 19/11) ; pas de notification
    places: [{
      id: 'chez-gala-smoking-room', name: 'Chez Gala · Smoking Room', address: '27 rue du Colisée, 75008 Paris',
      url: 'https://www.chezgala.com/smoking-room', budget: 'Chicha à 70 €', hours: 'Bar et smoking room tous les jours, 19 h 30 – 2 h',
      review: "L'espace fumeur est bien climatisé, les cocktails sont excellents et le DJ passe de la bonne musique. Seul bémol : la chicha à 70 €. Mais pour écouter de la musique et être chillax, je recommande.",
    }],
  },
  {
    id: '2026-11-21-adresse-jips',
    sendAt: '2026-11-21T10:30:00.000Z', // avis envoyé par Christian à 11 h 18 ; adresse et horaires vérifiés (Schlouk Map) ; sans notification
    places: [{
      id: 'le-jips-tchapalodrome', name: "Le Jip's · « Le Tchapalodrome »", address: '41 rue Saint-Denis, 75001 Paris', url: '',
      budget: 'Pinte d’Heineken autour de 9 €', hours: 'Du lundi au samedi 9 h 30 – 2 h, le dimanche 13 h – minuit',
      review: "Le Jip's, c'est mon « Tchapalodrome » (oui, je lui ai donné ce surnom) : un bar en plein cœur de Paris, comme diraient certains, où je retrouve un peu l'atmosphère chaleureuse que j'ai quand je suis au Cameroun.\n\nL'ambiance y est assez cosmopolite, avec des clients venus de plusieurs pays d'Afrique subsaharienne, et très souvent les 3 C de l'Afrique francophone : Côte d'Ivoire, Cameroun et Congo RDC, sans oublier une clientèle gabonaise bien présente. Mais on y croise bien évidemment aussi une clientèle européenne, et c'est d'ailleurs là que j'ai eu mon premier contact ukrainien.\n\nCôté assiette, leur spécialité ce sont les tapas : les wings et les bananes plantains font fureur quand on décide de prendre sa pinte. Moi, j'ai mes habitudes : une pinte d'Heineken avec du sirop de citron, un mélange qui glisse facilement dans la gorge et réveille les papilles.\n\nJ'y vais souvent le vendredi soir pour retrouver ce moment chaleureux, d'autant qu'il y a souvent des musiciens qui viennent jouer.",
    }],
  },
  {
    id: '2026-11-21-films-notif',
    sendAt: '2026-11-21T10:15:00.000Z', // demandé par Christian à 11 h 06 : la nouveauté en notification
    push: {
      title: 'Nouveau : Films et séries',
      body: 'Les films et séries que Christian a regardés : bande-annonce, note et avis. MobLand, WAR et Hope pour commencer.',
      url: '/?films',
    },
  },
  {
    id: '2026-11-21-email-films',
    sendAt: '2026-11-21T10:15:00.000Z', // et par e-mail, à tous les comptes (Christian compris)
    emailTo: 'all',
    email: NEWS_2026_11_21_FILMS,
  },
  {
    id: '2026-11-21-films-avis-structures',
    sendAt: '2026-11-21T09:35:00.000Z', // avis restructurés, accord de Christian à 10 h 24 ; sans notification
    films: FILMS_2026_11_21,
    filmsReplace: true,
  },
  {
    id: '2026-11-21-films-series',
    sendAt: '2026-11-21T09:15:00.000Z', // avis envoyés par Christian à 10 h 02 ; nouvelle rubrique, sans notification
    films: FILMS_2026_11_21,
  },
  {
    id: '2026-11-21-radio-medias',
    sendAt: '2026-11-21T08:30:00.000Z', // envoyé par Christian à 2 h 11 ; publié et notifié à 9 h 30 (pas de notification la nuit)
    radio: RADIO_2026_11_21_MEDIAS,
    push: {
      title: 'Nouveau podcast dans Radio CK',
      body: 'L’Heure du Monde : « Médias et extrême droite, histoire d’un glissement ? »',
      url: '/?radio',
    },
  },
  {
    id: '2026-11-20-radio-arte-ia',
    sendAt: '2026-11-20T19:42:00.000Z', // vidéo envoyée par Christian à 20 h 30
    radio: RADIO_2026_11_20_ARTE,
    push: {
      title: 'Nouvelle vidéo dans Radio CK',
      body: 'ARTE : « Intelligence artificielle, l’ultime invention humaine ? », à voir dans l’appli.',
      url: '/?radio',
    },
  },
  {
    id: '2026-11-19-radio-logement-pourquoi',
    sendAt: '2026-11-19T17:35:00.000Z', // texte validé par Christian à 18 h 32 ; pas de notification
    radioComments: [{ id: 'cesoir-logement-2027', comment: LOGEMENT_POURQUOI }],
  },
];

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const renderNewsEmail = (m: NewsEmail, firstName: string) => {
  const hello = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const html = `<!doctype html><html><body style="margin:0;background:#F7F6F2;font-family:Figtree,Arial,sans-serif;color:#1C2551">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="display:inline-block;background:#C98A1E;color:#fff;font-weight:800;border-radius:10px;padding:8px 10px">CK</div>
    <span style="font-weight:800;font-size:18px;margin-left:8px">CK<span style="color:#C98A1E">Money</span></span>
    <div style="background:#fff;border-radius:18px;padding:22px;margin-top:20px">
      <p style="font-size:16px;margin:0 0 6px;font-weight:700">${esc(hello)}</p>
      <p style="font-size:15px;line-height:1.55;color:#3A3E52;margin:0">${esc(m.intro)}</p>
    </div>
    ${m.sections.map(s => `<div style="background:#fff;border-radius:18px;padding:20px 22px;margin-top:12px">
      <h2 style="font-family:Georgia,serif;font-size:20px;margin:0 0 8px">${esc(s.title)}</h2>
      <p style="font-size:15px;line-height:1.55;color:#3A3E52;margin:0">${esc(s.text)}</p>
      ${s.link ? `<p style="margin:12px 0 0"><a href="${esc(s.link.url)}" style="color:#8A5A0B;font-weight:700;text-decoration:none">${esc(s.link.label)} →</a></p>` : ''}
    </div>`).join('')}
    <div style="background:#1C2551;color:#fff;border-radius:18px;padding:22px;margin-top:12px">
      <div style="font-size:17px;font-weight:800">Installe l'appli, active les notifications</div>
      <p style="font-size:14.5px;line-height:1.55;color:rgba(255,255,255,.78);margin:8px 0 16px">Une icône sur ton écran d'accueil, et tu es prévenu(e) des prochaines sorties et nouveautés. Ça prend 30 secondes, l'appli te guide (iPhone ou Android).</p>
      <a href="${APP}/?installer" style="display:inline-block;background:#C98A1E;color:#1C2551;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:12px">Installer CKMoney</a>
    </div>
    <p style="font-size:12px;color:#6B6F80;line-height:1.5;margin-top:16px">Tu reçois cet e-mail parce que tu as un compte CKMoney. Pour ne plus recevoir les nouveautés, réponds simplement « stop ».</p>
  </div></body></html>`;
  const text = [
    hello, '', m.intro, '',
    ...m.sections.flatMap(s => [s.title.toUpperCase(), s.text, ...(s.link ? [`${s.link.label} : ${s.link.url}`] : []), '']),
    "Installe l'appli et active les notifications pour être prévenu(e) des prochaines sorties :", `${APP}/?installer`, '',
    'Tu reçois cet e-mail parce que tu as un compte CKMoney. Pour ne plus recevoir les nouveautés, réponds « stop ».',
  ].join('\n');
  return { subject: m.subject, html, text };
};

const WINDOW = 6 * 3_600_000;
const firstNameOf = (s: unknown) => String(s || '').trim().split(/\s+/)[0].replace(/[<>]/g, '').slice(0, 30);

/** Comptes qui recevront l'e-mail : adresse vérifiée, pas les invités des jeux, pas les comptes désactivés. */
const emailRecipients = async (to: Announcement['emailTo']) => {
  const [list, profiles, tokens] = await Promise.all([
    adminAuth.listUsers(1000), adminDb.collection('profiles').get(), adminDb.collection('pushTokens').get(),
  ]);
  const names = new Map<string, string>(profiles.docs.map((d: any) => [d.id, firstNameOf(d.data().fullName)]));
  const withPush = new Set<string>(tokens.docs.map((d: any) => d.id));
  return list.users
    .filter((u: any) => u.email && u.emailVerified && !u.disabled && (u.providerData || []).length > 0)
    .filter((u: any) => to !== 'no-push' || !withPush.has(u.uid))
    .filter((u: any) => to !== 'author' || isAdmin(u.email, true))
    .filter((u: any) => to !== 'others' || !isAdmin(u.email, true))
    .map((u: any) => ({ uid: u.uid as string, email: u.email as string, firstName: names.get(u.uid) || firstNameOf(u.displayName) }));
};

/** Envoie les annonces dues et pas encore parties. Renvoie, pour chacune, ce qui est parti. */
export const sendDueAnnouncements = async (now = Date.now(), list = ANNOUNCEMENTS) => {
  const out: Record<string, unknown> = {};
  for (const a of list) {
    const at = Date.parse(a.sendAt);
    if (!(at <= now && now - at < WINDOW)) continue;
    const ref = adminDb.collection('announcementsSent').doc(a.id);
    // Un seul envoi, même si deux déclenchements arrivent en même temps
    const mine = await adminDb.runTransaction(async (tx: any) => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { startedAt: new Date(now).toISOString() });
      return true;
    });
    if (!mine) { out[a.id] = 'déjà envoyée'; continue; }
    const result: Record<string, number> = {};
    if (a.events || a.eventsRemove || a.eventImages || a.radio || a.radioRemove || a.radioComments || a.places || a.placeImages || a.placeReviews || a.films) {
      // En cas d'échec, on libère l'annonce pour que le passage suivant réessaie (avant toute notification)
      try {
        if (a.events) Object.assign(result, await importEvents(a.events, now));
        if (a.eventsRemove) {
          let removed = 0;
          for (const id of a.eventsRemove) {
            const ref = adminDb.collection('events').doc(id);
            if (!(await ref.get()).exists) continue;
            await ref.delete();
            removed++;
          }
          result.eventsRemoved = removed;
        }
        if (a.eventImages) {
          let images = 0;
          for (const { id, page, clear } of a.eventImages) {
            const ref = adminDb.collection('events').doc(id);
            const d = (await ref.get()).data();
            if (!d) continue;
            if (clear) { await ref.set({ image: '' }, { merge: true }); continue; }
            let img = page ? await pageImage(page) : '';
            if (!img && d.url) img = await pageImage(String(d.url));
            if (!img && d.url) { try { img = await pageImage(new URL(String(d.url)).origin + '/'); } catch { /* adresse invalide */ } }
            if (img) { await ref.set({ image: img }, { merge: true }); images++; }
          }
          result.eventImages = images;
        }
        if (a.radio) { const r = await importRadio(a.radio, now); Object.assign(result, { radioAdded: r.added, radioAlready: r.already, radioInvalid: r.invalid }); }
        if (a.radioComments) Object.assign(result, await fillRadioComments(a.radioComments));
        if (a.radioRemove) {
          let radioRemoved = 0;
          for (const id of a.radioRemove) {
            const ref = adminDb.collection('radio').doc(id);
            if (!(await ref.get()).exists) continue;
            await adminDb.recursiveDelete(ref);
            radioRemoved++;
          }
          result.radioRemoved = radioRemoved;
        }
        if (a.placeReviews) {
          let placeReviewsSet = 0;
          for (const { id, review } of a.placeReviews) {
            const ref = adminDb.collection('places').doc(id);
            if (!(await ref.get()).exists || !review.trim()) continue;
            await ref.set({ review, updatedAt: new Date().toISOString() }, { merge: true });
            placeReviewsSet++;
          }
          result.placeReviewsSet = placeReviewsSet;
        }
        if (a.placeImages) {
          let placeImagesSet = 0;
          for (const { id, image } of a.placeImages) {
            const ref = adminDb.collection('places').doc(id);
            if (!(await ref.get()).exists || !/^https:\/\//.test(image)) continue;
            await ref.set({ image }, { merge: true });
            placeImagesSet++;
          }
          result.placeImagesSet = placeImagesSet;
        }
        if (a.places) {
          let placesAdded = 0;
          for (const p of a.places) {
            const ref = adminDb.collection('places').doc(p.id);
            if ((await ref.get()).exists) continue;
            const { id: _id, ...rest } = p;
            await ref.set({ ...rest, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() });
            placesAdded++;
          }
          result.placesAdded = placesAdded;
        }
        if (a.films) {
          let filmsAdded = 0;
          for (let i = 0; i < a.films.length; i++) {
            const { id, ...rest } = a.films[i];
            const ref = adminDb.collection('films').doc(id);
            const prev = (await ref.get()).data();
            if (prev && !a.filmsReplace) continue;
            if (prev) {
              const { title, teaser, review, spoilerText, spoilers } = rest;
              await ref.set({ title, teaser, review, spoilerText, spoilers }, { merge: true });
            } else {
              const at = new Date(now - i * 1000).toISOString();
              await ref.set({ ...rest, createdAt: at, updatedAt: at });
            }
            filmsAdded++;
          }
          result.filmsAdded = filmsAdded;
        }
      } catch (err) { await ref.delete(); throw err; }
    }
    if (a.push) {
      const uids = a.pushTo === 'author'
        ? [(await adminAuth.getUserByEmail(authorEmail())).uid]
        : (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id);
      const sent = await Promise.all(uids.map((u: string) => pushToUser(u, { ...a.push!, tag: `annonce-${a.id}` }).catch(() => 0)));
      result.people = sent.filter((n: number) => n > 0).length;
      result.devices = sent.reduce((s: number, n: number) => s + n, 0);
    }
    if (a.email) {
      let emails = 0;
      for (const r of await emailRecipients(a.emailTo || 'all')) {
        const msg = renderNewsEmail(a.email, r.firstName);
        if (await sendMail({ to: r.email, subject: msg.subject, html: msg.html, text: msg.text })) emails++;
      }
      result.emails = emails;
    }
    await ref.set({ sentAt: new Date().toISOString(), ...result }, { merge: true });
    out[a.id] = a.pushTo ? { people: result.people, devices: result.devices } : a.push && !a.email && !a.events && !a.eventsRemove && !a.eventImages && !a.radio && !a.radioComments && !a.places && !a.films ? result.people : result;
  }
  return out;
};
