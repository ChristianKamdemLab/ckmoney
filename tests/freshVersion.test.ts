import { describe, it, expect } from 'vitest';
import { scriptOf } from '../utils/freshVersion';

describe('version à jour', () => {
  it('lit le script principal de la page en ligne', () => {
    expect(scriptOf('<script type="module" crossorigin src="/assets/main-AbC123.js"></script>')).toBe('/assets/main-AbC123.js');
    expect(scriptOf('<html></html>')).toBe('');
  });
});
