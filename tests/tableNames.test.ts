import { describe, it, expect } from 'vitest';
import { TABLE_NAMES, pickTableName, tableNameOf, nameOf } from '../games/tableNames';

describe('noms des tables', () => {
  it('assez de noms, sans doublon ni nom trop long', () => {
    expect(TABLE_NAMES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(TABLE_NAMES).size).toBe(TABLE_NAMES.length);
    TABLE_NAMES.forEach(n => expect(n.length).toBeLessThanOrEqual(24));
  });
  it('« autre nom » ne redonne jamais le même', () => {
    for (let i = 0; i < 200; i++) expect(pickTableName('Maracanã')).not.toBe('Maracanã');
  });
  it('une ancienne table sans nom en reçoit un, toujours le même', () => {
    expect(tableNameOf('K7PM3Q')).toBe(tableNameOf('K7PM3Q'));
    expect(TABLE_NAMES).toContain(tableNameOf('K7PM3Q'));
    expect(nameOf({ code: 'K7PM3Q', name: 'Anfield' })).toBe('Anfield');
    expect(nameOf({ code: 'K7PM3Q' })).toBe(tableNameOf('K7PM3Q'));
  });
});
