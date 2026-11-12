import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { app, auth, db } from "./firebase";
import { FCM_VAPID_KEY } from "../config/push";

// Notifications push (Firebase Cloud Messaging, gratuit). Le jeton de l'appareil est
// rangé dans pushTokens/{uid} ; seul le serveur (Vercel) le lit pour envoyer.

export const pushSupported = async () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && !!FCM_VAPID_KEY && (await isSupported().catch(() => false));

export const pushPermission = (): NotificationPermission | 'unsupported' =>
  typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

/** Demande l'autorisation, récupère le jeton de l'appareil et l'enregistre. */
export const enablePush = async (uid: string): Promise<boolean> => {
  if (!(await pushSupported())) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  return refreshPushToken(uid);
};

/** Ré-enregistre le jeton (il peut changer) quand l'autorisation est déjà donnée. */
export const refreshPushToken = async (uid: string): Promise<boolean> => {
  try {
    if (!(await pushSupported()) || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return false;
    await setDoc(doc(db, "pushTokens", uid), { tokens: arrayUnion(token), updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('Notifications push indisponibles', e);
    return false;
  }
};

/** Demande au serveur d'envoyer en push une notification déjà enregistrée dans l'appli. */
export const pushNotification = async (notificationId: string) => {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ notificationId }),
      keepalive: true,
    });
  } catch { /* le push est un plus : l'appli reste la référence */ }
};

export const callApi = async (path: string, body: object = {}) => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('auth');
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
};

/** Le prêteur s'envoie un rappel d'exemple (e-mail + notification). */
export const sendTestReminder = () => callApi('/api/test-mail');

/** Le prêteur envoie tout de suite un rappel à son proche (notification + e-mail). */
export const sendReminderNow = (loanId: string) => callApi('/api/remind', { loanId });
