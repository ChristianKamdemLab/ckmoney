import { describe, it, expect } from 'vitest';
import { takeLock, summarize } from '../api/_lib/syncGuard';

const fakeRef = () => {
  let data: any = {};
  const ref: any = { firestore: { runTransaction: async (fn: any) => fn({ get: async () => ({ data: () => data }), set: (_r: any, v: any) => { data = { ...data, ...v }; } }) } };
  return ref;
};

describe('Garde-fous de la synchronisation', () => {
  it('un seul passage à la fois', async () => {
    const r = fakeRef();
    expect(await takeLock(r, 1000)).toBe(true);
    expect(await takeLock(r, 2000)).toBe(false);
    expect(await takeLock(r, 1000 + 90_001)).toBe(true);
  });
  it('aucun nom de fichier ni titre dans la réponse', () => {
    const s = summarize({ files: 3, done: { 'Mon PDF secret.pdf': 'press · Le Monde · avec l\'essentiel · Titre', 'Autre.pdf': 'journal', 'x.png': 'format' }, info: { '2026-11-23': 2 }, audio: { done: { abc: 'ok' } } });
    expect(JSON.stringify(s)).not.toMatch(/secret|Titre|Monde|Autre|abc/);
    expect(s.articles).toEqual({ press: 1, journal: 1, format: 1 });
    expect(s.files).toBe(3);
  });
});
