// « Vendredi Show » (26/11, idée de Christian) : pour le vendredi soir, une rangée de choix sans vote.
// Ses lieux recommandés (Mes adresses), « Chill chez Christian », et ce que chacun ajoute : un lieu
// (nom, adresse, lien dont l'appli tire la photo) ou « Chill chez moi ». Chacun touche « J'y vais » sur
// le choix qui lui plaît. Seuls les chills à domicile prévennent quelqu'un : l'hôte, à chaque venue.
// L'adresse d'un domicile n'est montrée qu'à l'hôte et à ceux qui y vont.

export type ShowKind = 'place' | 'home';
export interface ShowChoice {
  id: string;
  kind: ShowKind;
  name: string;
  sub: string;            // budget d'un lieu recommandé, « Proposé par Aya », « Chill à domicile »
  review?: string;        // l'avis de Christian (lieux recommandés)
  address: string;        // vide pour un domicile quand on n'y va pas
  url: string;
  image: string;
  hostUid?: string;       // domicile : la personne qui reçoit
  mine: boolean;          // ajouté par moi (je peux le retirer)
  going: string[];        // prénoms de ceux qui y vont
  me: boolean;            // j'y vais
}
export interface Show { date: string; choices: ShowChoice[]; canHome: boolean; admin: boolean }

const clip = (v: unknown, n: number) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Ce qu'un proche ajoute : un lieu (nom obligatoire) ou son chill (adresse facultative). */
export const cleanShowInput = (b: any): { kind: ShowKind; name: string; address: string; url: string } | null => {
  const kind: ShowKind = b?.kind === 'home' ? 'home' : 'place';
  const name = clip(b?.name, 80);
  const address = clip(b?.address, 160);
  const url = clip(b?.url, 500);
  if (url && !/^https:\/\/[^\s]+\.[^\s]+$/i.test(url)) return null;
  if (kind === 'place' && name.length < 2) return null;
  return { kind, name, address, url };
};
