import { describe, it, expect } from 'vitest';
import { cityOf } from '../utils/contract';

// « Fait à … » du contrat : la ville vient de l'adresse du prêteur, jamais un mot de remplissage.
describe('ville du contrat', () => {
  it('trouve la ville après le code postal ou en dernier', () => {
    expect(cityOf('12 rue de la Paix, 91120 Palaiseau')).toBe('Palaiseau');
    expect(cityOf('12 rue de la Paix, 91120 Palaiseau, France')).toBe('Palaiseau');
    expect(cityOf('Quartier Bastos, Yaoundé, Cameroun')).toBe('Yaoundé');
    expect(cityOf('3 avenue Louise, 1050 Bruxelles')).toBe('Bruxelles');
    expect(cityOf('Gagny')).toBe('Gagny');
  });
  it('vide quand la ville manque (jamais « Ville »)', () => {
    expect(cityOf('12 résidence du Val Palaiseau, 91120')).toBe('');
    expect(cityOf('12 rue de la Paix')).toBe('');
    expect(cityOf('')).toBe('');
  });
});
