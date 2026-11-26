import { describe, it, expect } from 'vitest';
import { parseRubrique } from '../utils/rubrique';
import { parseInfo } from '../utils/infoDuJour';

describe('rubriques du fil Actu', () => {
  it('lit la rubrique écrite par l’agent', () => {
    expect(parseRubrique('Cameroun, Éco')).toEqual(['cameroun', 'afrique', 'eco']);
    expect(parseRubrique('Monde')).toEqual(['monde']);
    expect(parseRubrique('Afrique / Économie')).toEqual(['afrique', 'eco']);
    expect(parseRubrique('')).toEqual([]);
  });
  it('lit la rubrique d’une info du jour', () => {
    const doc = ['## Cameroun et Afrique', 'Titre : Un titre inventé', 'Rubrique : Cameroun, Éco', 'Source : A | https://a.test/1', 'Source : B | https://b.test/2',
      'Un résumé inventé assez long pour passer le seuil de quatre-vingts caractères, avec des mots en plus.'].join('\n');
    expect(parseInfo(doc)[0].zones).toEqual(['cameroun', 'afrique', 'eco']);
  });
});
