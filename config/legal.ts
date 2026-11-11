// Paramètres juridiques et fiscaux utilisés par CKMoney.
// ⚠️ À mettre à jour : taux d'usure chaque trimestre, intérêt légal chaque semestre.

/**
 * Plafond prudentiel des taux conventionnels (intérêts et retard), en % annuel.
 * Valeur retenue : seuil de l'usure le plus bas applicable aux prêts aux particuliers
 * hors immobilier (prêts personnels > 6 000 €), 4e trimestre 2026 : 8,56 %.
 * Bercy considère que l'usure ne vise pas les prêts entre particuliers, mais une partie
 * de la doctrine soutient l'inverse : on plafonne donc par prudence.
 */
export const RATE_CAP = 8.56;
export const RATE_CAP_LABEL = 'seuil de l’usure, prêts personnels > 6 000 €, T4 2026';

/** Taux de l'intérêt légal (créanciers personnes physiques non professionnelles), 2nd semestre 2026. */
export const LEGAL_INTEREST_RATE = 6.84;
export const LEGAL_INTEREST_LABEL = '2nd semestre 2026';

/** Seuil de déclaration fiscale des prêts (CGI art. 242 ter 3 ; ann. III art. 49 B), cumul annuel par prêteur/emprunteur. */
export const DECLARATION_THRESHOLD_EUR = 5000;

/** Seuil au-delà duquel un écrit est exigé pour prouver le prêt (C. civ. art. 1359 ; décret n° 80-533). */
export const WRITTEN_PROOF_THRESHOLD_EUR = 1500;

/**
 * Garde-fou « monopole bancaire » (CMF art. L511-5) : au-delà de ce nombre de prêts
 * consentis sur 12 mois glissants, l'application alerte sur le risque de caractère habituel.
 */
export const HABITUAL_LENDING_WARNING_COUNT = 4;

/** Durée maximale d'un échéancier mensuel proposée par l'appli. */
export const MAX_INSTALLMENTS = 60;

/**
 * Comptes autorisés à créer des prêts en tant que prêteur (outil personnel).
 * Renseignez VITE_LENDER_EMAILS dans Vercel, séparés par des virgules.
 * Vide = tout utilisateur connecté peut créer un prêt.
 */
export const LENDER_ALLOWLIST: string[] = ((import.meta as any).env?.VITE_LENDER_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export const canCreateLoans = (email: string | undefined | null) =>
  LENDER_ALLOWLIST.length === 0 || (!!email && LENDER_ALLOWLIST.includes(email.toLowerCase()));
