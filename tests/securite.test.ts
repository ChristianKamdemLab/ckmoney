import { describe, it, expect } from 'vitest';
import { safeDisplayName } from '../api/_lib/mail';

describe('E-mails : nom affiché de l\'expéditeur', () => {
  it('garde un prénom normal', () => {
    expect(safeDisplayName('Christian')).toBe('Christian');
    expect(safeDisplayName('Jean-Éric')).toBe('Jean-Éric');
  });
  it('ne laisse pas glisser une autre adresse dans le From', () => {
    const n = safeDisplayName('Paul"<pirate@exemple.test>,"X');
    expect(n).not.toMatch(/["<>@,]/);
  });
  it('retire les retours à la ligne et garde un nom par défaut', () => {
    expect(safeDisplayName('A\r\nBcc: x')).not.toMatch(/[\r\n:]/);
    expect(safeDisplayName('')).toBe('CKMoney');
    expect(safeDisplayName('"<>')).toBe('CKMoney');
  });
});
