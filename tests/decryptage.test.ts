import { describe, it, expect } from 'vitest';
import { parseDecryptage, decryptageDate, minutesOf, decryptageKeepFrom } from '../utils/decryptage';

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
  it('accepte un décryptage en solo, avec des virgules sonores entre les sujets', () => {
    const solo = [
      'Titre : Solo', 'Statut : publié',
      '[VIRGULE]',
      'CHRISTIAN : Bienvenue sur CKMoney.',
      '[VIRGULE]',
      'CHRISTIAN : Premier sujet.',
      'Virgule',
      'VIRGULE',
      'CHRISTIAN : Deuxième sujet.',
      '[virgule sonore]',
    ].join('\n');
    const d = parseDecryptage(solo, '2026-11-24')!;
    expect(d.lines.map(l => l.who)).toEqual(['host', 'sting', 'host', 'sting', 'host']);
  });
  it('refuse un texte trop court', () => {
    expect(parseDecryptage('Titre : X\nCHRISTIAN : Bonjour.\n[VIRGULE]\nCHRISTIAN : Au revoir.', '2026-11-24')).toBeNull();
  });
  it('ne garde que la veille et le jour même (heure de Paris)', () => {
    expect(decryptageKeepFrom(Date.parse('2026-11-24T17:00:00Z'))).toBe('2026-11-23');
    expect(decryptageKeepFrom(Date.parse('2026-11-24T23:30:00Z'))).toBe('2026-11-24'); // déjà le 25 à Paris
    expect(decryptageKeepFrom(Date.parse('2026-03-01T10:00:00Z'))).toBe('2026-02-28');
  });
});
