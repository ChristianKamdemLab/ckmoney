import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Sur Vercel, les fonctions /api tournent en modules Node : un import relatif sans « .js »
// fait planter la fonction au démarrage (FUNCTION_INVOCATION_FAILED), alors que Vite et les tests
// l'acceptent. On vérifie tous les fichiers atteints depuis /api.

const root = path.resolve(__dirname, '..');
const IMPORT = /^\s*import\s+(type\s+)?[^'"]*from\s+['"](\.{1,2}\/[^'"]+)['"]/gm;
// Fichiers qui ne contiennent que des types (effacés à la compilation)
const TYPES_ONLY = new Set([path.join(root, 'types.ts')]);

const resolveTs = (from: string, spec: string) => {
  const base = path.resolve(path.dirname(from), spec.replace(/\.js$/, ''));
  return [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(f => fs.existsSync(f));
};

describe('fonctions serveur', () => {
  it('les imports relatifs atteints depuis /api portent l’extension .js', () => {
    const start = fs.readdirSync(path.join(root, 'api'), { recursive: true } as any)
      .map(f => path.join(root, 'api', String(f))).filter(f => f.endsWith('.ts'));
    const seen = new Set<string>();
    const bad: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(IMPORT)) {
        const [, typeOnly, spec] = m;
        const target = resolveTs(file, spec);
        if (!target) { bad.push(`${path.relative(root, file)} → ${spec} (introuvable)`); continue; }
        if (typeOnly || TYPES_ONLY.has(target)) continue;
        if (!spec.endsWith('.js')) bad.push(`${path.relative(root, file)} → ${spec}`);
        visit(target);
      }
    };
    start.forEach(visit);
    expect(bad).toEqual([]);
    expect(seen.size).toBeGreaterThan(10);
  });
});
