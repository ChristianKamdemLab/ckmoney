import { describe, it, expect } from 'vitest';
import { parseDecryptage, decryptageDate, minutesOf } from '../utils/decryptage';

const doc = [
  'Titre : Un dirigeant rappelé, une COP sans accord',
  'Statut : publié',
  'Sujet : Le retour du patron | /?article=abc123',
  'Sujet : La COP sans texte final | /?info',
  'Sujet : Lien piégé | javascript:alert(1)',
  'Source : Le Monde | https://www.lemonde.fr/x',
  '',
  'CHRISTIAN : Bonjour et bienvenue dans le décryptage du jour.',
  'AWA : Bonjour Christian. On commence par une histoire de puces.',
  'CHRISTIAN : Alors, que s’est-il passé ?',
  'AWA : Selon Le Monde, le conseil a changé d’avis en deux semaines.',
  'Note : une ligne qui n’est pas une réplique',
].join('\n');

describe('décryptage du jour', () => {
  it('lit le nom du document', () => {
    expect(decryptageDate('Décryptage · 2026-11-24')).toBe('2026-11-24');
    expect(decryptageDate('Decryptage - 2026-11-24.docx')).toBe('2026-11-24');
    expect(decryptageDate('Info du jour · 2026-11-24')).toBeNull();
  });
  it('lit titre, sujets, sources et répliques des deux voix', () => {
    const d = parseDecryptage(doc, '2026-11-24')!;
    expect(d.title).toBe('Un dirigeant rappelé, une COP sans accord');
    expect(d.draft).toBe(false);
    expect(d.subjects.map(s => s.link)).toEqual(['/?article=abc123', '/?info', '']);
    expect(d.sources).toHaveLength(1);
    expect(d.lines.map(l => l.who)).toEqual(['host', 'guest', 'host', 'guest']);
    expect(d.lines[1].name).toBe('Awa');
    expect(minutesOf(d)).toBe(1);
  });
  it('un brouillon est reconnu', () => {
    expect(parseDecryptage(doc.replace('Statut : publié', 'Statut : brouillon'), '2026-11-24')!.draft).toBe(true);
  });
  it('refuse un texte sans deux voix', () => {
    expect(parseDecryptage(doc.replace(/AWA/g, 'CHRISTIAN'), '2026-11-24')).toBeNull();
  });
});
