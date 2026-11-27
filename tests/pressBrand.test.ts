import { describe, it, expect } from 'vitest';
import { pressBrand, themeColorIn, textOn, cleanHex, NEUTRAL } from '../utils/pressBrand';

describe('Couleur des journaux (étiquette des cartes)', () => {
  it('journal de la liste : sa couleur, quel que soit l’accent ou la casse', () => {
    expect(pressBrand('Le Monde').bg).toBe('#000B15');
    expect(pressBrand('LES ÉCHOS').bg).toBe(pressBrand('Les Echos').bg);
    expect(pressBrand('Financial Times')).toEqual({ bg: '#FFF1E5', fg: '#990F3D' });
  });
  it('nouveau journal : la couleur lue sur son site, avec un texte lisible', () => {
    expect(pressBrand('La Gazette inventée', '#123456')).toEqual({ bg: '#123456', fg: '#FFFFFF' });
    expect(pressBrand('Le Jaune inventé', '#ffd400').fg).toBe('#0E1533');
  });
  it('rien de trouvé, ou une couleur trop pâle : étiquette neutre', () => {
    expect(pressBrand('Inconnu', '')).toEqual(NEUTRAL);
    expect(pressBrand('Inconnu', '#ffffff')).toEqual(NEUTRAL);
    expect(pressBrand('Inconnu', 'rouge')).toEqual(NEUTRAL);
  });
  it('lit theme-color, sans la variante du mode sombre', () => {
    const html = '<head><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000"><meta content="#c00" name="theme-color"></head>';
    expect(themeColorIn(html)).toBe('#CC0000');
    expect(themeColorIn('<meta name="description" content="x">')).toBeNull();
  });
  it('outils', () => {
    expect(cleanHex('#abc')).toBe('#AABBCC');
    expect(textOn('#000000')).toBe('#FFFFFF');
    expect(textOn('#FFF1E5')).toBe('#0E1533');
  });
});
