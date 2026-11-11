/** Clé publique Web Push du projet Firebase (Paramètres du projet > Cloud Messaging > Certificats Web Push). Publique par nature. */
export const FCM_VAPID_KEY: string = (import.meta as any).env?.VITE_FCM_VAPID_KEY
  || 'BEQde3BY_EZsgGv5kCT7OBYIy_DHEaRItWlszErvsGSSiD1wgN6EeOLgGe_SUU0us6FEcWBmygOmnn155pqYXe0';
