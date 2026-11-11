import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Profile } from "../types";

// Profil personnel : lisible et modifiable uniquement par son propriétaire (firestore.rules).
export const getProfile = async (uid: string): Promise<Profile | null> => {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? (snap.data() as Profile) : null;
};

export const saveProfile = async (uid: string, profile: Profile): Promise<void> => {
  const clean = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, "profiles", uid), { ...clean, updatedAt: new Date().toISOString() });
};
