import { AppEvent, dayStart, dayEnd } from '../../utils/events';
const now = Date.now();
const h = (n: number) => new Date(now + n * 3_600_000).toISOString();
const base = { status: 'published' as const, url: '', theme: '', drinks: '', capacity: null, price: '', organizer: 'Christian', description: '', audience: 'all' as const, invitees: [] };
let list: AppEvent[] = [
  { ...base, id: 'concert', kind: 'event', by: 'Marc', organizer: 'New Morning', title: 'Concert Makossa au New Morning', startsAt: '2027-01-16T19:30:00.000Z', endsAt: '2027-01-16T22:00:00.000Z', venue: 'New Morning', address: '7-9 rue des Petites-Écuries, 75010 Paris', price: '25 €', url: 'https://www.newmorning.com' },
  { ...base, mine: true, id: 'spot', kind: 'spot', title: 'Ce soir, je suis au Comptoir Général', startsAt: h(-1), endsAt: h(5), venue: 'Le Comptoir Général', address: '80 quai de Jemmapes, 75010 Paris', description: 'Passez si vous êtes dans le coin, je suis au fond près du bar.' },
  { ...base, id: 'salon26', kind: 'event', title: 'Salon des Diasporas Africaines 2026', startsAt: '2026-12-04T12:00:00.000Z', endsAt: '2026-12-05T18:00:00.000Z',
    venue: 'Palais de la Porte Dorée', address: '293 avenue Daumesnil, 75012 Paris', price: 'Gratuit', organizer: 'Expertise France (CRPM)', url: 'https://www.billetweb.fr/salon-des-diasporas-africaines-2026',
    description: "Six pays membres du CRPM invitent leurs diasporas à découvrir les opportunités du continent." },
  { ...base, mine: true, id: 'chill', kind: 'chill', title: 'Chill du vendredi', startsAt: '2026-11-20T19:00:00.000Z', endsAt: '2026-11-20T23:30:00.000Z', venue: 'Chez moi', address: 'Paris 20e',
    theme: "L'argent entre amis : prêter ou pas ?", drinks: 'Vin, bières et softs. Ramène ce que tu aimes.', capacity: 8, placesLeft: 5, going: 3, audience: 'some', invitees: ['pm', 'sara', 'nina'],
    description: 'Petit chill tranquille, musique douce et grosses discussions.' },
  { ...base, mine: true, id: 'old', kind: 'spot', title: 'Brunch au Pavillon', startsAt: '2026-09-13T10:00:00.000Z', endsAt: '2026-09-13T14:00:00.000Z', venue: 'Pavillon des Canaux', address: '', audience: 'link' },
];

const salon = (id: string, title: string, a: string, z: string, venue: string, address: string, price: string, description = '') =>
  ({ ...base, mine: true, by: 'Christian', organizer: '', id, kind: 'event' as const, allDay: true, title, startsAt: dayStart(a), endsAt: dayEnd(z), venue, address, price, url: 'https://example.com', description });
list.push(
  salon('sirexe', 'SIREXE', '2026-11-12', '2026-11-16', 'Parc des expositions d’Abidjan', 'Abidjan, Côte d’Ivoire', 'Dès 250 000 FCFA HT', 'Salon des mines, du pétrole et de l’énergie.\nTarifs : 250 000 FCFA HT le pass professionnel, 750 000 FCFA HT le pass premium. Disponibilité à vérifier sur le site.'),
  salon('siimmoaf', 'SIIMMOAF – Soirée investissement immobilier en Afrique', '2026-11-19', '2026-11-19', 'InterContinental Champs-Élysées Étoile, Paris', 'Paris, France', 'Prix sur la billetterie'),
  salon('gabs', 'German-African Business Summit', '2026-11-23', '2026-11-25', 'Hôtel Kempinski, Accra', 'Accra, Ghana', '420 € HT'),
  salon('ocde', 'Forum économique international sur l’Afrique (OCDE)', '2026-11-25', '2026-11-25', 'Centre de conférences de l’OCDE, Paris', 'Paris, France', 'Prix non communiqué'),
  salon('msgbc', 'MSGBC Oil, Gas & Power', '2026-12-01', '2026-12-03', 'CICAD, Diamniadio', 'Diamniadio, Sénégal', 'Dès 1 000 €'),
  salon('retro', 'Rétromobile 2027', '2027-02-03', '2027-02-07', 'Paris Expo Porte de Versailles', 'Paris, France', 'Dès 23 €'),
  salon('nog', 'NOG Energy Week 2027', '2027-06-27', '2027-07-01', 'Bola Ahmed Tinubu International Conference Centre, Abuja', 'Abuja, Nigeria', 'Prix non communiqué', 'La semaine de l’énergie au Nigeria : pétrole, gaz et investissements.'),
);
export const listEvents = async () => list.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
export const saveEvent = async (e: any, notify?: boolean) => { const id = e.id || 'new'; list = [...list.filter(x => x.id !== id), { ...e, id, status: 'published', mine: true }]; return { id, notified: notify ? 4 : 0 }; };
export const deleteEvent = async (id: string) => { list = list.filter(x => x.id !== id); };
export const rsvp = async (id: string, going: boolean) => { const e = list.find(x => x.id === id)!; return { going, placesLeft: (e.placesLeft ?? 0) + (going ? -1 : 1) }; };
export const listRsvps = async () => [{ name: 'Marc', at: '1', member: true }, { name: 'Sara', at: '2', member: true }, { name: 'Nina', at: '3', member: false }];
export const listPeople = async () => [{ uid: 'nina', name: 'Nina' }, { uid: 'sara', name: 'Sara' }, { uid: 'pm', name: 'Marc Essomba' }, { uid: 'charles', name: 'Léo' }];
