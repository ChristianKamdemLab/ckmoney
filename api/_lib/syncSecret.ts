import { createHash, timingSafeEqual } from 'node:crypto';

// Secret partagé entre GitHub Actions (secret SYNC_SECRET) et Vercel (variable SYNC_SECRET), envoyé
// dans l'en-tête « x-sync-secret » par le workflow « Annonces et articles ».
// Tant que la variable Vercel n'est pas définie, les routes restent ouvertes (comme avant) pour ne pas
// casser la synchronisation : définir d'abord le secret GitHub, puis la variable Vercel.

const digest = (s: string) => createHash('sha256').update(s).digest();

export const syncAllowed = (req: any, expected = process.env.SYNC_SECRET): boolean => {
  if (!expected) return true;
  const got = req?.headers?.['x-sync-secret'];
  if (typeof got !== 'string' || !got) return false;
  return timingSafeEqual(digest(got), digest(expected));
};
