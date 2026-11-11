import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Profile } from "../types";

// Profil personnel : lisible et modifiable uniquement par son propriétaire (firestore.rules).
export const getProfile = async (uid: string): Promise<Profile | null> => {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? (snap.data() as Profile) : null;
};

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export const saveProfile = async (uid: string, profile: Profile): Promise<void> => {
  await setDoc(doc(db, "profiles", uid), { ...clean(profile), updatedAt: new Date().toISOString() });
};

/** Complète le profil sans effacer le reste (utilisé quand l'ami signe pour la première fois). */
export const mergeProfile = async (uid: string, partial: Partial<Profile>): Promise<void> => {
  await setDoc(doc(db, "profiles", uid), { ...clean(partial), updatedAt: new Date().toISOString() }, { merge: true });
};
