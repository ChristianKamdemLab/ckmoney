// Paramètres juridiques et fiscaux utilisés par CKMoney.
// ⚠️ À mettre à jour : taux d'usure chaque trimestre, intérêt légal chaque semestre.

/**
 * Plafond des taux conventionnels (intérêts et retard), en % annuel : seuils de l'usure
 * des prêts aux particuliers hors immobilier, 4e trimestre 2026 (art. L314-6 C. conso.,
 * « tout prêt conventionnel »). Le seuil dépend du montant prêté.
 */
export const USURY_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 3000, rate: 23.60 },
  { upTo: 6000, rate: 15.76 },
  { upTo: Infinity, rate: 8.56 },
];
/** Plafond applicable à un prêt de ce montant (en euros ; autre devise : seuil le plus bas). */
export const rateCapFor = (amount: number, currency = 'EUR') =>
  currency !== 'EUR' ? USURY_BRACKETS[USURY_BRACKETS.length - 1].rate
    : (USURY_BRACKETS.find(b => amount <= b.upTo) || USURY_BRACKETS[USURY_BRACKETS.length - 1]).rate;
/** Seuil le plus bas, utilisé quand le montant n'est pas connu. */
export const RATE_CAP = 8.56;
export const RATE_CAP_LABEL = 'taux de l’usure, 4e trimestre 2026';

/** Taux de l'intérêt légal (créanciers personnes physiques non professionnelles), 2nd semestre 2026. */
export const LEGAL_INTEREST_RATE = 6.84;
export const LEGAL_INTEREST_LABEL = '2nd semestre 2026';

/**
 * Dernier jour de validité des taux ci-dessus (fin du trimestre pour l'usure, du semestre pour le taux légal).
 * Passé cette date, l'appli affiche une alerte au prêteur tant que les taux n'ont pas été mis à jour.
 * Mis à jour par l'agent « Veille des taux CKMoney » (2 janvier, avril, juillet, octobre).
 */
export const RATES_VALID_UNTIL = '2026-12-31';
export const ratesOutdated = (todayISO: string = new Date().toISOString().slice(0, 10)) => todayISO > RATES_VALID_UNTIL;

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
 * Administrateur de l'appli (Christian) : articles, Radio CK, annonces, liste des comptes.
 * VITE_LENDER_EMAILS dans Vercel (nom historique), séparés par des virgules. Vide = personne.
 * Prêter est ouvert à tous les comptes (bouton « Prêter à mes proches »).
 */
export const LENDER_ALLOWLIST: string[] = ((import.meta as any).env?.VITE_LENDER_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export const isAdminEmail = (email: string | undefined | null) =>
  !!email && LENDER_ALLOWLIST.includes(email.toLowerCase());

/**
 * Pénalité forfaitaire de retard (clause pénale, art. 1231-5 C. civ.) : pas de plafond légal
 * entre particuliers, mais le juge peut réduire une pénalité manifestement excessive.
 * Plafond retenu par l'appli : 10 % (les banques sont limitées à 8 % pour le crédit à la consommation).
 */
export const PENALTY_MAX = 10;
