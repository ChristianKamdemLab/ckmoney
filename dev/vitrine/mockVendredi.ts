const gala = { id: 'bar-exemple', name: 'Le Bar Exemple', address: '1 rue Imaginaire, 75000 Paris', url: 'https://example.com', budget: 'Cocktail à 12 €', hours: 'Tous les jours, 18 h – 2 h', review: 'Lieu inventé pour la vitrine : bonne musique, cocktails corrects.' };
let friday: any = { date: '2026-11-27', intro: "Grosse semaine, j'ai envie de musique et de bonnes discussions.", decided: null, myVote: 'b', total: 7, options: [
  { id: 'a', kind: 'home', name: 'Chez moi', address: '', why: 'Chill tranquille : ndolè, jeux de société et playlist makossa. On refait le monde jusqu’à 2 h.', votes: 2 },
  { id: 'b', kind: 'place', placeId: gala.id, name: gala.name, address: gala.address, why: 'Le DJ est bon et la salle climatisée ; parfait pour décompresser après la semaine.', votes: 4 },
  { id: 'c', kind: 'place', name: 'Le Comptoir Général', address: '80 quai de Jemmapes, 75010 Paris', why: 'Ambiance afro, pas cher, et on peut danser.', votes: 1 },
] };
export const getFriday = async () => ({ friday, admin: true });
export const voteFriday = async (_d: string, o: string | null) => { friday = { ...friday, myVote: o }; return friday; };
export const saveFriday = async () => 3;
export const decideFriday = async (_d: string, o: string) => { friday = { ...friday, decided: o }; return { friday, notified: 6 }; };
export const listPlaces = async () => ({ places: [gala], admin: true });
export const savePlace = async () => 'x';
export const deletePlace = async () => undefined;

// Vendredi Show
let show: any = { date: '2026-11-27', canHome: true, admin: true, choices: [
  { id: 'p_a', kind: 'place', name: "Le Jip's", sub: 'Cocktail 15 €', review: 'Ambiance afro, bons cocktails.', address: '41 rue Saint-Denis, Paris', url: 'https://x.test', image: '', mine: false, going: ['Inès', 'Yann'], me: false },
  { id: 'p_b', kind: 'place', name: 'Le Comptoir Général', sub: 'Chicha 70 €', address: '80 quai de Jemmapes, Paris', url: '', image: '', mine: false, going: [], me: false },
  { id: 'home_christian', kind: 'home', name: 'Chill chez Christian', sub: 'Chill à domicile', address: '', url: '', image: '', hostUid: 'me', mine: false, going: ['Ami'], me: true },
  { id: 'l_1', kind: 'place', name: 'Bar proposé', sub: 'Proposé par Inès', address: 'Paris 11e', url: '', image: '', mine: true, going: [], me: false },
] };
export const getShow = async () => show;
export const pickShow = async (c: string | null) => { show = { ...show, choices: show.choices.map((x: any) => ({ ...x, me: x.id === c })) }; return show; };
export const addShow = async () => show;
export const removeShow = async () => show;
