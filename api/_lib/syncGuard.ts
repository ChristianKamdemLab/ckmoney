// Garde-fous de /api/articles-sync, route appelée par le workflow GitHub sans connexion.

/** Prend le verrou s'il est libre (un passage à la fois, 90 s maximum) ; false sinon. */
export const takeLock = async (ref: any, now: number, lease = 90_000): Promise<boolean> =>
  ref.firestore.runTransaction(async (t: any) => {
    const until = Number((await t.get(ref)).data()?.until || 0);
    if (until > now) return false;
    t.set(ref, { until: now + lease }, { merge: true });
    return true;
  });

/** Résumé sans noms de fichiers ni titres : le nombre de fichiers par état. */
export const summarize = (out: any) => {
  const count = (o: any) => {
    if (!o || typeof o !== 'object') return o;
    const c: Record<string, number> = {};
    for (const v of Object.values(o)) {
      const k = String(v).split(/[ ·:]/)[0] || 'autre';
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  };
  return {
    files: typeof out?.files === 'number' ? out.files : undefined,
    articles: count(out?.done),
    info: out?.info && typeof out.info === 'object' ? Object.keys(out.info).length : 0,
    // Le décryptage : date → état (« audio en cours (12/24) », « publié… ») ; jamais de titre
    diag: out?.diag,
    decryptage: out?.decryptage && typeof out.decryptage === 'object' ? out.decryptage : undefined,
    audio: out?.audio && typeof out.audio === 'object' ? (out.audio.voix ? { voix: out.audio.voix } : count(out.audio.done || out.audio)) : undefined,
  };
};
