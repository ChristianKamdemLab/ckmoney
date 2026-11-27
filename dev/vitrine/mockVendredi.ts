const gala = { image: 'https://img.example.com/video.jpg', id: 'bar-exemple', name: 'Le Bar Exemple', address: '1 rue Imaginaire, 75000 Paris', url: 'https://example.com', budget: 'Cocktail à 12 €', hours: 'Tous les jours, 18 h – 2 h', review: 'Lieu inventé pour la vitrine : bonne musique, cocktails corrects.' };
export const listPlaces = async () => ({ places: [gala], admin: true });
export const savePlace = async () => 'x';
export const deletePlace = async () => undefined;

// Vendredi Show
let show: any = { date: '2026-11-27', canHome: true, admin: true, choices: [
  { id: 'p_a', kind: 'place', name: "Le Jip's", sub: 'Cocktail 15 €', review: 'Ambiance afro, bons cocktails.', address: '41 rue Saint-Denis, Paris', url: 'https://x.test', image: '', mine: false, count: 2, going: ['Inès', 'Yann'], me: false },
  { id: 'p_b', kind: 'place', name: 'Le Comptoir Général', sub: 'Chicha 70 €', address: '80 quai de Jemmapes, Paris', url: '', image: '', mine: false, count: 0, going: [], me: false },
  { id: 'home_christian', kind: 'home', name: 'Chill chez Christian', sub: 'Chill à domicile', address: '', url: '', image: '', hostUid: 'me', mine: false, count: 1, going: ['Ami'], me: true },
  { id: 'l_1', kind: 'place', name: 'Bar proposé', sub: 'Proposé par Inès', address: 'Paris 11e', url: '', image: '', mine: true, count: 0, going: [], me: false },
] };
export const getShow = async () => show;
export const pickShow = async (c: string | null) => { show = { ...show, choices: show.choices.map((x: any) => ({ ...x, me: x.id === c })) }; return show; };
export const addShow = async () => show;
export const removeShow = async () => show;
