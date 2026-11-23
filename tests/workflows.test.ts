import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse } from 'yaml';

// Le 23/11, un « : » dans une commande non protégée a rendu annonces.yml illisible pour GitHub :
// plus aucune annonce ni aucun article publié. Chaque workflow doit rester du YAML valide.
describe('Workflows GitHub', () => {
  for (const f of fs.readdirSync('.github/workflows').filter(f => /\.ya?ml$/.test(f))) {
    it(`${f} est lisible`, () => {
      const d = parse(fs.readFileSync(`.github/workflows/${f}`, 'utf8'));
      expect(d.jobs).toBeTruthy();
    });
  }
});
