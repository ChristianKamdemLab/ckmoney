import { describe, it, expect } from 'vitest';
import { decryptagePage } from '../api/_lib/decryptagePage';

describe('page publique du décryptage', () => {
  it('montre le lecteur et ouvre le décryptage dans l’appli', () => {
    const h = decryptagePage('https://x.test', '2026-11-25', { date: '2026-11-25', title: 'Titre <b>', minutes: 4, subjects: [] });
    expect(h).toContain('Titre &lt;b&gt;');
    expect(h).toContain('/api/articles?ecoute=2026-11-25&audio=voix');
    expect(h).toContain('href="/?decryptage=2026-11-25"');
  });
  it('dit quand il n’est plus en ligne', () => {
    expect(decryptagePage('https://x.test', '2026-11-01', null)).toContain('Décryptage introuvable');
  });
});
