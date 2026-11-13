import { adminAuth, adminDb, isAdmin } from './admin.js';
import { cleanEvent, cleanName, dayStart, dayEnd, isUpcoming } from '../../utils/events.js';

// Sorties publiées d'un coup à partir d'un calendrier (salons…), au nom de Christian, sans notification.
// Chaque sortie a un identifiant fixe (salon-…) : une sortie déjà là n'est ni recréée ni modifiée, et
// une sortie que Christian a supprimée ne revient pas (l'import ne passe qu'une fois, voir annonces.ts).

export interface SeedEvent {
  id: string;            // identifiant stable (sirexe-2026)
  title: string;
  start: string;         // premier jour, « 2026-11-18 »
  end: string;           // dernier jour
  venue: string;
  address: string;
  price: string;
  url: string;
  description: string;
}

export const importEvents = async (list: SeedEvent[], now = Date.now()) => {
  const users = (await adminAuth.listUsers(1000)).users;
  const author = users.find((u: any) => isAdmin(u.email, u.emailVerified === true));
  if (!author) throw new Error('auteur introuvable');
  const profile = (await adminDb.collection('profiles').doc(author.uid).get()).data();
  const authorName = cleanName(String(profile?.fullName || author.displayName || '').split(' ')[0]);
  const at = new Date(now).toISOString();
  let added = 0, already = 0, past = 0, invalid = 0;
  for (const s of list) {
    const e = cleanEvent({
      kind: 'event', audience: 'all', allDay: true, title: s.title, startsAt: dayStart(s.start), endsAt: dayEnd(s.end),
      venue: s.venue, address: s.address, price: s.price, url: s.url, description: s.description,
    });
    if (!e) { invalid++; continue; }
    if (!isUpcoming(e, now)) { past++; continue; }
    const ref = adminDb.collection('events').doc(`salon-${s.id}`.slice(0, 40));
    if ((await ref.get()).exists) { already++; continue; }
    await ref.set({
      ...e, status: 'published', authorUid: author.uid, authorName, createdAt: at, updatedAt: at, goingCount: 0, importedFrom: 'calendrier',
    });
    added++;
  }
  return { added, already, past, invalid };
};

/** Calendrier « Afrique & salons 2026–2027 » envoyé par Christian le 13/11/2026 (données vérifiées à
 *  cette date) : salons de Paris et d'Île-de-France, et d'Afrique subsaharienne. Le Salon des Diasporas
 *  Africaines (4–5 décembre) est déjà dans les sorties. */
export const SALONS_2026_2027: SeedEvent[] = [
  { id: "sirexe-2026", title: "SIREXE", start: "2026-11-18", end: "2026-11-22",
    venue: "Parc des expositions d’Abidjan", address: "Abidjan, Côte d’Ivoire", price: "Dès 250 000 FCFA HT",
    url: "https://www.sirexe.ci/fr/participant",
    description: "Salon des mines, du pétrole et de l’énergie.\nTarifs : 250 000 FCFA HT le pass professionnel, 750 000 FCFA HT le pass premium. Disponibilité à vérifier sur le site." },
  { id: "siimmoaf-2026", title: "SIIMMOAF – Soirée investissement immobilier en Afrique", start: "2026-11-19", end: "2026-11-19",
    venue: "InterContinental Champs-Élysées Étoile, Paris", address: "Paris, France", price: "Prix sur la billetterie",
    url: "https://www.billetweb.fr/siimmoaf-2026-soiree-de-l-investissement-immobilier-en-afrique-4eme-edition-paris",
    description: "Soirée consacrée à l’investissement immobilier en Afrique, pour la diaspora (4e édition).\nInscriptions annoncées jusqu’au 17 novembre, pas de vente sur place." },
  { id: "gabs-2026", title: "German-African Business Summit", start: "2026-11-23", end: "2026-11-25",
    venue: "Hôtel Kempinski, Accra", address: "Accra, Ghana", price: "420 € HT",
    url: "https://www.gabs2026.com/tickets",
    description: "Sommet d’affaires germano-africain : investissements et partenariats.\nBillet professionnel à 420 € HT, plus la TVA locale." },
  { id: "ambition-africa-2026", title: "Ambition Africa 2026", start: "2026-11-24", end: "2026-11-25",
    venue: "Ministère de l’Économie, Paris", address: "Paris, France", price: "450 € HT, gratuit sous conditions",
    url: "https://event.businessfrance.fr/ambition-africa/",
    description: "Rencontres d’affaires France–Afrique organisées par Business France.\nTarifs : 450 € HT pour une entreprise française, gratuit sous conditions pour une entreprise africaine. Inscriptions jusqu’au 20 novembre 2026, 18 h." },
  { id: "ocde-forum-afrique-2026", title: "Forum économique international sur l’Afrique (OCDE)", start: "2026-11-25", end: "2026-11-25",
    venue: "Centre de conférences de l’OCDE, Paris", address: "Paris, France", price: "Prix non communiqué",
    url: "https://www.oecd.org/en/events/2026/11/25th-international-economic-forum-on-africa.html",
    description: "Le forum de l’OCDE sur le financement et le développement de l’Afrique.\nModalités de participation sur la page de l’événement." },
  { id: "africa-infrastructure-forum-2026", title: "Africa Infrastructure Forum", start: "2026-11-26", end: "2026-11-28",
    venue: "Parc des expositions, Abidjan", address: "Abidjan, Côte d’Ivoire", price: "Prix non communiqué",
    url: "https://africaiforum.com/",
    description: "Forum sur le financement des infrastructures en Afrique.\nConditions d’accès et pass à vérifier sur le site de l’organisateur." },
  { id: "msgbc-2026", title: "MSGBC Oil, Gas & Power", start: "2026-12-01", end: "2026-12-03",
    venue: "CICAD, Diamniadio", address: "Diamniadio, Sénégal", price: "Dès 1 000 €",
    url: "https://fr.msgbcoilgasandpower.com/delegate-packages",
    description: "Énergie et projets régionaux : pétrole, gaz et électricité en Afrique de l’Ouest.\nTarifs : 1 000 € le pass national, 2 000 € le pass international. Éligibilité au tarif national et taxes éventuelles à vérifier." },
  { id: "entrepreneurship-forum-2026", title: "African Entrepreneurship Forum", start: "2026-12-04", end: "2026-12-05",
    venue: "CRRAE-UMOA, Abidjan", address: "Abidjan, Côte d’Ivoire", price: "Prix non communiqué",
    url: "https://www.clubafricaindesentrepreneurs.com/en/forum",
    description: "Forum de l’entrepreneuriat et du financement des PME.\nProgramme et tarifs à vérifier auprès de l’organisateur." },
  { id: "akili-energy-2026", title: "Akili Energy Investment Forum", start: "2026-12-05", end: "2026-12-05",
    venue: "Hôtel Meliá Paris La Défense", address: "Courbevoie, France", price: "Prix sur la billetterie",
    url: "https://www.billetweb.fr/akili-energy-investment-forum-2026",
    description: "Forum sur les investissements dans l’énergie.\nLa prévente est terminée : le tarif actuel est sur la billetterie." },
  { id: "fitb-2027", title: "FITB – Forum international du tourisme de Brazzaville", start: "2027-01-12", end: "2027-01-14",
    venue: "Palais des Congrès, Brazzaville", address: "Brazzaville, Congo", price: "Prix non communiqué",
    url: "https://www.fitbcongo.org/",
    description: "Forum international du tourisme de Brazzaville : réseautage, tourisme et affaires." },
  { id: "retromobile-2027", title: "Rétromobile 2027", start: "2027-02-03", end: "2027-02-07",
    venue: "Paris Expo Porte de Versailles", address: "Paris, France", price: "Dès 23 €",
    url: "https://www.retromobile.com/fr-FR/billetterie/acheter-mon-ticket",
    description: "Le salon de l’automobile de collection.\nBillet à 23 € sur internet pendant le salon, 25 € sur place ; le prix varie selon la date d’achat." },
  { id: "wine-paris-2027", title: "Wine Paris / Be Spirits 2027", start: "2027-02-15", end: "2027-02-17",
    venue: "Paris Expo Porte de Versailles", address: "Paris, France", price: "Prix non communiqué",
    url: "https://vinexposium.mybadgeonline.com/",
    description: "Salon professionnel du vin et des spiritueux.\nBadge à commander sur la plateforme Vinexposium ; tarif 2027 pas encore publié." },
  { id: "nigeria-energy-summit-2027", title: "Nigeria International Energy Summit", start: "2027-03-15", end: "2027-03-18",
    venue: "Abuja (lieu à confirmer)", address: "Abuja, Nigeria", price: "Prix non communiqué",
    url: "https://nigeriaenergysummit.com/",
    description: "Sommet de l’énergie au Nigeria, pour les professionnels du secteur.\nLieu exact et ouverture des inscriptions à suivre." },
  { id: "vignerons-independants-2027", title: "Salon des Vignerons Indépendants – Paris Champerret", start: "2027-03-18", end: "2027-03-21",
    venue: "Espace Champerret, Paris", address: "Paris, France", price: "Prix non communiqué",
    url: "https://www.vignerons-independants.com/nos-evenements",
    description: "Le salon des vignerons indépendants : dégustation et vente directe, ouvert au public.\nInvitations et billetterie 2027 sur le site officiel." },
  { id: "ecowas-investment-forum-2027", title: "ECOWAS Investment Forum (EIF)", start: "2027-04-07", end: "2027-04-08",
    venue: "Palais des congrès, Lomé", address: "Lomé, Togo", price: "Gratuit sur inscription",
    url: "https://bidc-ebid.org/eif/",
    description: "Forum de la BIDC (banque de la CEDEAO) sur le financement de projets en Afrique de l’Ouest.\nGratuit sur inscription, mais la page de l’organisateur indique des inscriptions fermées : à revérifier." },
  { id: "paris-perfume-week-2027", title: "Paris Perfume Week 2027", start: "2027-04-15", end: "2027-04-17",
    venue: "Palais Brongniart, Paris", address: "Paris, France", price: "Prix non communiqué",
    url: "https://www.perfume-week.com/billetterie/",
    description: "Salon du parfum.\nBilletterie 2027 annoncée, pas encore ouverte." },
  { id: "rhum-fest-paris-2027", title: "Rhum Fest Paris 2027", start: "2027-04-17", end: "2027-04-19",
    venue: "Parc Floral de Paris", address: "Bois de Vincennes, Paris, France", price: "Dès 65 €",
    url: "https://www.rhumfestparis.com/billetterie",
    description: "Le festival du rhum.\nBillet standard : 70 € le samedi, 65 € le dimanche. Grand public les 17 et 18 avril ; le 19 avril est réservé aux professionnels." },
  { id: "avca-2027", title: "AVCA Annual Conference & VC Summit", start: "2027-04-19", end: "2027-04-23",
    venue: "Abidjan (lieu à confirmer)", address: "Abidjan, Côte d’Ivoire", price: "Prix non communiqué",
    url: "https://www.avca.africa/events/events-calendar/annual-avca-conference/",
    description: "Conférence annuelle de l’AVCA : capital-investissement et capital-risque en Afrique.\nLieu exact, réservation et tarifs 2027 pas encore publiés." },
  { id: "africa-ceo-forum-2027", title: "Africa CEO Forum 2027", start: "2027-05-03", end: "2027-05-04",
    venue: "Abidjan (lieu à confirmer)", address: "Abidjan, Côte d’Ivoire", price: "Prix non communiqué",
    url: "https://registration.theafricaceoforum.com/event/summary/register",
    description: "Le rendez-vous des dirigeants et investisseurs du continent.\nPublic professionnel ; inscription soumise à validation." },
  { id: "invest-african-energy-2027", title: "Invest in African Energy 2027", start: "2027-05-11", end: "2027-05-13",
    venue: "Paris (lieu à confirmer)", address: "Paris, France", price: "Dès 2 000 €",
    url: "https://invest-africa-energy.com/delegate-packages",
    description: "Forum sur l’investissement dans l’énergie en Afrique.\nPass dès 2 000 € (tarif anticipé, susceptible de changer). Lieu exact à confirmer." },
  { id: "congo-energy-forum-2027", title: "Congo Energy & Investment Forum 2027", start: "2027-06-01", end: "2027-06-03",
    venue: "Grand Hôtel Kintélé, Brazzaville", address: "Brazzaville, Congo", price: "Dès 150 € (exposition)",
    url: "https://congoenergyinvestment.com/delegate-packages",
    description: "Forum sur l’énergie et l’investissement en Afrique centrale.\nTarifs : 150 € l’exposition (ouverte les 2 et 3 juin), 800 € le pass délégué local, 1 600 € le pass international, à vérifier." },
  { id: "simppar-2027", title: "SIMPPAR 2027", start: "2027-06-01", end: "2027-06-03",
    venue: "Espace Champerret, Paris", address: "Paris, France", price: "Prix non communiqué",
    url: "https://www.simppar.fr/fr/page/Visiter",
    description: "Salon professionnel des matières premières de la parfumerie.\nDemandes de badge visiteur à partir du 4 janvier 2027." },
  { id: "wampex-2027", title: "WAMPEX 2027", start: "2027-06-02", end: "2027-06-04",
    venue: "La Palm Royal Beach Hotel, Accra", address: "Accra, Ghana", price: "Prix non communiqué",
    url: "https://www.wampexwestafrica.com/event-at-a-glance-copy-2/",
    description: "Salon des mines et de l’énergie en Afrique de l’Ouest.\nInscriptions pas encore ouvertes : le site propose une alerte." },
  { id: "drc-mining-week-2027", title: "DRC Mining Week 2027", start: "2027-06-16", end: "2027-06-18",
    venue: "Pullman Grand Karavia, Lubumbashi", address: "Lubumbashi, RD Congo", price: "Salon gratuit, conférence payante",
    url: "https://fr.wearevuka.com/mining/drc-mining-week/tickets-options/",
    description: "Salon et conférence de l’industrie minière en RDC.\nSalon gratuit ; conférence dès 2 145 USD HT en prévente (jusqu’au 12 février 2027), taxes en sus." },
  { id: "nog-energy-week-2027", title: "NOG Energy Week 2027", start: "2027-06-27", end: "2027-07-01",
    venue: "Bola Ahmed Tinubu International Conference Centre, Abuja", address: "Abuja, Nigeria", price: "Prix non communiqué",
    url: "https://www.nogenergyweek.com/",
    description: "La semaine de l’énergie au Nigeria : pétrole, gaz et investissements." },
  { id: "japan-expo-2027", title: "Japan Expo Paris 2027", start: "2027-07-08", end: "2027-07-11",
    venue: "Parc des expositions Paris Nord Villepinte", address: "Villepinte, France", price: "Prix non communiqué",
    url: "https://paris.japan-expo.com/fr",
    description: "Manga, jeux vidéo et pop culture japonaise.\nTarifs 2027 pas encore annoncés." },
  { id: "propak-west-africa-2027", title: "Propak West Africa 2027", start: "2027-09-07", end: "2027-09-09",
    venue: "Landmark Centre, Lagos", address: "Lagos, Nigeria", price: "Prix non communiqué",
    url: "https://www.propakwestafrica.com/",
    description: "Salon d’affaires de l’industrie et de la transformation, plus commercial que tourné vers l’investissement." },
  { id: "s2ia-2027", title: "S2IA – Salon international de l’industrie d’Afrique", start: "2027-09-17", end: "2027-09-23",
    venue: "Parc des expositions, Abidjan", address: "Abidjan, Côte d’Ivoire", price: "Prix non communiqué",
    url: "https://www.salondelindustrie.com/",
    description: "Salon international de l’industrie d’Afrique : industrie et partenariats financiers.\nTarifs d’entrée 2027 pas encore publiés." },
  { id: "whisky-live-paris-2027", title: "Whisky Live Paris 2027", start: "2027-09-25", end: "2027-09-27",
    venue: "Grande Halle de la Villette, Paris", address: "Paris, France", price: "Prix non communiqué",
    url: "https://www.whiskylive.fr/billetterie/",
    description: "Le salon du whisky et des spiritueux.\nGrand public les 25 et 26 septembre, journée professionnelle le 27." },
  { id: "equip-auto-2027", title: "Equip Auto Paris 2027", start: "2027-10-12", end: "2027-10-16",
    venue: "Paris Expo Porte de Versailles", address: "Paris, France", price: "Prix non communiqué",
    url: "https://paris.equipauto.com/",
    description: "Salon de l’équipement et de l’après-vente automobile, surtout pour les professionnels." },
  { id: "paris-games-week-2027", title: "Paris Games Week 2027", start: "2027-10-28", end: "2027-10-31",
    venue: "Paris Expo Porte de Versailles", address: "Paris, France", price: "Prix non communiqué",
    url: "https://www.parisgamesweek.com/fr",
    description: "Le salon du jeu vidéo.\nCertaines pages du site affichent encore les informations 2026." },
  { id: "sim-senegal-2027", title: "SIM Sénégal 2027", start: "2027-11-02", end: "2027-11-04",
    venue: "CICAD et Centre des expositions, Diamniadio", address: "Diamniadio, Sénégal", price: "Prix non communiqué",
    url: "https://simsenegal.com/",
    description: "Salon des mines du Sénégal, pour les professionnels.\nInscriptions 2027 à suivre." },
];
