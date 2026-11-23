import { describe, it, expect } from 'vitest';
import { classify, todayDate } from '../api/_lib/articleIngest';

// Fixture inventée : un article de presse dont la seule date écrite est celle d'une photo
const blocks = [
  { t: 'p', text: 'Un dirigeant rappelé à la tête de son entreprise' },
  { t: 'p', text: 'Le conseil a changé d’avis après deux semaines de crise.' },
  { t: 'p', text: 'Le Monde' },
  { t: 'p', text: 'Publié aujourd’hui à 15h21' },
  { t: 'p', text: 'Un dirigeant, à Paris, le 4 mai 2026. JEAN DUPONT / AFP' },
  { t: 'p', text: 'Le conseil d’administration a rappelé son ancien patron, lundi, après une crise de deux semaines dans l’entreprise.' },
] as any[];

describe('date d’une fiche de presse', () => {
  it('« Publié aujourd’hui » : le jour où le PDF a été enregistré, jamais la date d’une photo', () => {
    const r: any = classify(blocks[0].text, blocks.slice(1), { fileName: 'Un dirigeant rappelé - Le Monde.pdf', created: '2026-11-23' });
    expect(r.kind).toBe('press');
    expect(r.publishedAt).toBe('2026-11-23T09:00:00.000Z');
  });
  it('sans date d’enregistrement, la légende de la photo ne donne pas la date', () => {
    const r: any = classify(blocks[0].text, blocks.slice(1), { fileName: 'Un dirigeant rappelé - Le Monde.pdf' });
    expect(r.publishedAt).not.toBe('2026-05-04T09:00:00.000Z');
  });
  it('« Publié hier »', () => {
    expect(todayDate('Publié hier à 18h00', '2026-11-23')).toBe('2026-11-22T09:00:00.000Z');
    expect(todayDate('Publié le 12 novembre 2026', '2026-11-23')).toBeUndefined();
  });
});
