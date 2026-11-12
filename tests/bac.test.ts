import { describe, it, expect } from 'vitest';
import { normalize, startsWithLetter, autoCheck, rejectedByVote, scoreRound, pickLetter, LETTERS } from '../games/bac';

describe('Baccalauréat : règles', () => {
  it('ignore les accents, les articles et la casse', () => {
    expect(normalize('  Éléphant ')).toBe('elephant');
    expect(normalize("L'Oie")).toBe('oie');
    expect(normalize('La Rochelle')).toBe('rochelle');
    expect(normalize('les Pays-Bas')).toBe('pays bas');
    expect(normalize('Lapin')).toBe('lapin');
    expect(startsWithLetter('Éthiopie', 'E')).toBe(true);
    expect(startsWithLetter('Le Mans', 'M')).toBe(true);
  });

  it('refuse automatiquement le vide et la mauvaise lettre', () => {
    expect(autoCheck('', 'B')).toBe('vide');
    expect(autoCheck('Cameroun', 'B')).toBe('lettre');
    expect(autoCheck('Bénin', 'B')).toBe(null);
  });

  it('contestation : plus de la moitié des autres joueurs', () => {
    expect(rejectedByVote(1, 2)).toBe(true);   // 1 autre joueur
    expect(rejectedByVote(1, 3)).toBe(false);  // 1 sur 2 autres : égalité, gardée
    expect(rejectedByVote(2, 3)).toBe(true);
    expect(rejectedByVote(2, 5)).toBe(false);
    expect(rejectedByVote(3, 5)).toBe(true);
  });

  it('10 points pour une réponse unique, 5 si partagée, 0 si refusée', () => {
    const out = scoreRound({
      letter: 'B',
      categories: ['Pays', 'Animal'],
      players: ['ana', 'ben', 'cyr'],
      answers: { ana: ['Bénin', 'Baleine'], ben: ['benin', 'Bison'], cyr: ['Burkina Faso', 'Brouette'] },
      votes: { '1|cyr': ['ana', 'ben'] },     // une brouette n'est pas un animal
    });
    expect(out.detail['0|ana']).toBe(5);
    expect(out.detail['0|ben']).toBe(5);
    expect(out.detail['0|cyr']).toBe(10);
    expect(out.detail['1|cyr']).toBe(0);
    expect(out.status['1|cyr']).toBe('conteste');
    expect(out.points).toEqual({ ana: 15, ben: 15, cyr: 10 });
  });

  it("un joueur ne peut pas faire tomber sa propre réponse, et une réponse refusée ne rend pas l'autre « partagée »", () => {
    const out = scoreRound({
      letter: 'C', categories: ['Pays'], players: ['ana', 'ben'],
      answers: { ana: ['Cameroun'], ben: ['Camerounn'] }, votes: { '0|ana': ['ana'], '0|ben': ['ana'] },
    });
    expect(out.detail['0|ana']).toBe(10);
    expect(out.detail['0|ben']).toBe(0);
  });

  it('tire des lettres différentes au fil des manches', () => {
    const used: string[] = [];
    for (let i = 0; i < LETTERS.length; i++) used.push(pickLetter(used));
    expect(new Set(used).size).toBe(LETTERS.length);
  });
});
