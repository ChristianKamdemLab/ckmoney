// Firestore simulé en mémoire pour l'aperçu (navigateur)
export const store = new Map<string, any>();
const listeners = new Set<() => void>();
export const onChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const snap = (path: string) => ({ exists: store.has(path), data: () => clone(store.get(path)) });
const docRef = (path: string): any => ({ path, collection: (c: string) => colRef(`${path}/${c}`), get: async () => snap(path), set: async (d: any) => { store.set(path, clone(d)); setTimeout(() => listeners.forEach(l => l()), 30); } });
const colRef = (path: string) => ({ doc: (id?: string) => docRef(`${path}/${id || Math.random().toString(36).slice(2)}`) });
export const adminAuth = { verifyIdToken: async (t: string) => ({ uid: t, name: t }) };
export const adminDb = {
  collection: colRef,
  runTransaction: async (fn: (tx: any) => Promise<any>) => {
    const writes: (() => void)[] = [];
    const tx = {
      get: async (ref: any) => snap(ref.path),
      set: (ref: any, data: any) => writes.push(() => store.set(ref.path, clone(data))),
      update: (ref: any, data: any) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...clone(data) })),
      delete: (ref: any) => writes.push(() => store.delete(ref.path)),
    };
    const r = await fn(tx);
    writes.forEach(w => w());
    setTimeout(() => listeners.forEach(l => l()), 30);
    return r;
  },
};
export const adminMessaging = {};
export const pushToUser = async () => 0;
export const verifiedEmail = async () => undefined;
export const isAllowedLender = () => false;
