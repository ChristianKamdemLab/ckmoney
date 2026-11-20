import { describe, it, expect, vi } from 'vitest';
import { parseInfo, infoDate } from '../utils/infoDuJour';

const LONG = 'Un paragraphe de résumé suffisamment long pour être publié, avec des faits, des chiffres et des noms vérifiés.';
const DOC = `Info du jour · 2026-11-21

## Monde
Titre : Un sujet mondial inventé pour le test
Pourquoi on en parle : en tête des recherches en France et aux États-Unis
Source : Média A | https://exemple-a.test/article
Source : Média B | https://exemple-b.test/article
${LONG}
Deuxième paragraphe.

## Cameroun et Afrique
Titre : Un sujet africain inventé
Source : Média C | https://exemple-c.test/x
${LONG}
`;

describe("L'info du jour", () => {
  it('reconnaît le nom du document', () => {
    expect(infoDate('Info du jour · 2026-11-21')).toBe('2026-11-21');
    expect(infoDate('CKMoney · Info du jour · 2026-11-21')).toBe('2026-11-21');
    expect(infoDate('Info du jour - 2026-11-21.docx')).toBe('2026-11-21');
    expect(infoDate('Le Monde · L’info du jour')).toBeNull();
    expect(infoDate('Article sur l’info du jour 2026-11-21.pdf')).toBeNull();
  });

  it('lit les deux infos, et écarte celle qui a moins de deux sources', () => {
    const items = parseInfo(DOC);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ scope: 'monde', title: 'Un sujet mondial inventé pour le test', why: 'en tête des recherches en France et aux États-Unis' });
    expect(items[0].sources.map(s => s.name)).toEqual(['Média A', 'Média B']);
    expect(items[0].summary.split('\n\n')).toHaveLength(2);
    const both = parseInfo(DOC.replace('Source : Média C | https://exemple-c.test/x', 'Source : Média C | https://exemple-c.test/x\nSource : Média D | https://exemple-d.test/y'));
    expect(both.map(i => i.scope)).toEqual(['monde', 'afrique']);
  });

  it('refuse les liens non https, le HTML et les résumés vides', () => {
    expect(parseInfo(DOC.replace('https://exemple-a.test/article', 'http://exemple-a.test/article'))).toHaveLength(0);
    const x = parseInfo(DOC.replace('Un sujet mondial', '<b>Un sujet</b> mondial'));
    expect(x[0].title).not.toMatch(/[<>]/);
    expect(parseInfo('## Monde\nTitre : X\nSource : A | https://a.test\nSource : B | https://b.test\nCourt.')).toHaveLength(0);
  });
});

const store: Record<string, any> = {};
vi.mock('../api/_lib/admin.js', () => ({
  adminDb: { collection: () => ({ doc: (id: string) => ({ get: async () => ({ data: () => store[id] }), set: async (v: any) => { store[id] = v; } }) }) },
}));

describe('Publication depuis Drive', () => {
  it('publie quand le document change, pas sinon', async () => {
    const { syncInfo } = await import('../api/_lib/infoSync');
    const f = { id: '1', name: 'Info du jour · 2026-11-21', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-11-21T07:00:00Z' };
    const dl = vi.fn(async () => ({ text: DOC }));
    expect(await syncInfo([f, { ...f, id: '2', name: 'Autre.pdf', mimeType: 'application/pdf' }], dl)).toEqual({ '2026-11-21': 1 });
    expect(store['2026-11-21'].items[0].scope).toBe('monde');
    expect(await syncInfo([f], dl)).toEqual({});
    expect(dl).toHaveBeenCalledTimes(1);
    expect(await syncInfo([{ ...f, modifiedTime: '2026-11-21T08:00:00Z' }], dl)).toEqual({ '2026-11-21': 1 });
  });
});
