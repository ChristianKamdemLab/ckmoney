// Modèle de contrat de prêt entre particuliers et de reconnaissance de dette.
// Texte FIXE (pas de génération par IA) : chaque prêt est rédigé à partir des mêmes
// clauses, et le texte signé est figé par une empreinte SHA-256.
import { Loan } from '../types';
import { amountToFrenchWords } from './frenchNumbers';
import { Installment, formatMoney, parseISODate } from './schedule';
import { DECLARATION_THRESHOLD_EUR, LEGAL_INTEREST_RATE } from '../config/legal';

export const CONTRACT_VERSION = '2026.11-3';

const fmtDate = (iso?: string) =>
  iso
    ? parseISODate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ')
    : '___';

const rateStr = (r: number) => `${r.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

const identity = (civ: string | undefined, name: string, birthDate: string, birthPlace: string, address: string) => {
  const ne = civ === 'Mme' ? 'née' : 'né';
  return `${civ || ''} ${name}, ${ne} le ${fmtDate(birthDate)} à ${birthPlace || '___'}, demeurant ${address || '___'}`.trim();
};

export interface ContractInput extends Pick<Loan,
  'lenderCivility' | 'lenderName' | 'lenderBirthDate' | 'lenderBirthPlace' | 'lenderAddress' | 'lenderIban' | 'lenderPaymentLink' |
  'borrowerCivility' | 'borrowerName' | 'borrowerBirthDate' | 'borrowerBirthPlace' | 'borrowerAddress' | 'borrowerEmail' |
  'amount' | 'currency' | 'loanDate' | 'repaymentDate' | 'interestRate' | 'repaymentType' | 'lateRateMode' | 'lateInterestRate' | 'city' | 'penaltyRate' | 'delayRate'> {
  schedule: Installment[];
}

export const scheduleTable = (schedule: Installment[], currency: string) =>
  schedule
    .map(i => `  Échéance ${i.index} — ${fmtDate(i.dueDate)} : ${formatMoney(i.amount, currency)} (capital ${formatMoney(i.principal, currency)}, intérêts ${formatMoney(i.interest, currency)})`)
    .join('\n');

/** Ville d'une adresse (« 12 rue de la Paix, 91120 Palaiseau » → « Palaiseau ») ; vide si elle n'y est pas
 *  (« 12 résidence du Val, 91120 » : le code postal seul ne suffit pas). Sert au « Fait à … » du contrat. */
export const cityOf = (address: string) => {
  const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const m = part.match(/\b\d{4,5}\s+([^\d].*)$/);
    if (m) return m[1].trim();
    if (/^(france|cameroun|belgique|suisse|canada)$/i.test(part) || /^\d+$/.test(part)) continue;
    if (!/\d/.test(part) && (i > 0 || parts.length === 1)) return part;
    return '';
  }
  return '';
};

/** Contrat de prêt signé par les deux parties. */
export const buildLoanContract = (l: ContractInput): string => {
  const words = amountToFrenchWords(l.amount, l.currency);
  const amountStr = `${formatMoney(l.amount, l.currency)} (${words})`;
  const rate = l.interestRate || 0;
  const totalInterest = l.schedule.reduce((s, i) => s + i.interest, 0);
  const totalDue = l.schedule.reduce((s, i) => s + i.amount, 0);
  const monthly = l.repaymentType === 'monthly' && l.schedule.length > 1;

  const interestClause = rate > 0
    ? `Intérêt conventionnel au taux fixe de ${rateStr(rate)} l’an (art. 1907 du Code civil), sans frais : le taux effectif global est donc de ${rateStr(rate)}. Total des intérêts : ${formatMoney(totalInterest, l.currency)} ; total à rembourser : ${formatMoney(totalDue, l.currency)}.`
    : `Prêt gratuit, sans intérêt : l’Emprunteur ne rembourse que la somme prêtée.`;

  const repaymentClause = monthly
    ? `${l.schedule.length} échéances mensuelles, du ${fmtDate(l.schedule[0].dueDate)} au ${fmtDate(l.schedule[l.schedule.length - 1].dueDate)} :\n${scheduleTable(l.schedule, l.currency)}\nRemboursement anticipé possible à tout moment, sans frais ; les intérêts ne sont alors dus que pour la période écoulée.`
    : `En une seule fois, ${formatMoney(totalDue, l.currency)} au plus tard le ${fmtDate(l.schedule[0].dueDate)}. Remboursement anticipé possible à tout moment, sans frais.`;

  let lateClause: string;
  if (l.lateRateMode === 'none') {
    lateClause = `Aucun intérêt de retard conventionnel. Les intérêts au taux légal restent dus après mise en demeure (art. 1231-6 du Code civil).`;
  } else if (l.lateRateMode === 'legal') {
    lateClause = `Toute somme impayée à son échéance produit, dès le lendemain et jusqu’au paiement, des intérêts au taux légal applicable aux particuliers (${rateStr(LEGAL_INTEREST_RATE)} à la signature, révisé chaque semestre).`;
  } else {
    lateClause = `Toute somme impayée à son échéance produit, dès le lendemain et jusqu’au paiement, des intérêts de retard au taux fixe de ${rateStr(l.lateInterestRate || 0)} l’an, que le juge peut modérer s’il est excessif (art. 1231-5 du Code civil).`;
  }

  if (l.penaltyRate && l.penaltyRate > 0) {
    lateClause += `\nEn outre, à défaut de paiement d’une échéance à sa date, une pénalité forfaitaire égale à ${rateStr(l.penaltyRate)} des sommes alors impayées est due, une seule fois par échéance (clause pénale, art. 1231-5 du Code civil).`;
  }
  const delayClause = l.delayRate && l.delayRate > 0
    ? ` Si un report est accordé à la demande de l’Emprunteur, les sommes reportées portent intérêt au taux de report de ${rateStr(l.delayRate)} l’an, depuis l’échéance d’origine jusqu’au paiement, dans la limite du seuil de l’usure.`
    : '';

  const paymentLines = ['Par virement ou tout moyen laissant une trace écrite.'];
  if (l.lenderIban) paymentLines.push(`IBAN du Prêteur : ${l.lenderIban}`);
  if (l.lenderPaymentLink) paymentLines.push(`Lien de paiement du Prêteur : ${l.lenderPaymentLink}`);
  paymentLines.push('Chaque paiement confirmé par le Prêteur dans CKMoney vaut quittance. Les paiements s’imputent d’abord sur les intérêts, puis sur les échéances les plus anciennes (art. 1342-10 et 1343-1 du Code civil).');

  const currencyClause = l.currency === 'EUR'
    ? ''
    : `\nPrêt libellé en ${l.currency} en raison de son caractère international (art. 1343-3 du Code civil) ; à défaut, paiement en euros à la contre-valeur du jour.`;

  const accelerationClause = monthly
    ? ` Après deux échéances consécutives impayées et une mise en demeure par lettre recommandée restée sans effet quinze jours, le Prêteur peut exiger le remboursement immédiat du capital restant dû.`
    : '';

  return `CONTRAT DE PRÊT D’ARGENT ENTRE PARTICULIERS
(Articles 1892 et suivants du Code civil)

ENTRE LES SOUSSIGNÉS :

${identity(l.lenderCivility, l.lenderName, l.lenderBirthDate, l.lenderBirthPlace, l.lenderAddress)},
ci-après « le Prêteur »,

ET

${identity(l.borrowerCivility, l.borrowerName, l.borrowerBirthDate, l.borrowerBirthPlace, l.borrowerAddress)}${l.borrowerEmail ? `, joignable à l’adresse ${l.borrowerEmail}` : ''},
ci-après « l’Emprunteur »,

IL A ÉTÉ CONVENU CE QUI SUIT :

ARTICLE 1 – OBJET
Le Prêteur prête à l’Emprunteur la somme de ${amountStr}, remise le ${fmtDate(l.loanDate)}. L’Emprunteur en reconnaît la réception par sa signature.

ARTICLE 2 – PRÊT ENTRE PROCHES
Prêt personnel et occasionnel entre proches. Le Prêteur ne pratique pas d’opérations de crédit à titre habituel (art. L. 511-5 du Code monétaire et financier) et n’agit pas à titre professionnel : les règles du crédit à la consommation ne s’appliquent pas.

ARTICLE 3 – INTÉRÊTS
${interestClause}

ARTICLE 4 – REMBOURSEMENT
${repaymentClause}

ARTICLE 5 – PAIEMENTS
${paymentLines.join('\n')}${currencyClause}

ARTICLE 6 – RETARD ET DÉFAILLANCE
${lateClause}${accelerationClause}

ARTICLE 7 – REPORT D’ÉCHÉANCE
Toute modification des dates ou des montants exige l’accord écrit des deux parties, enregistré dans CKMoney sous forme d’avenant.${delayClause}

ARTICLE 8 – DÉCLARATION FISCALE
Si le prêt, ou le cumul des prêts consentis la même année entre les mêmes parties, dépasse ${DECLARATION_THRESHOLD_EUR.toLocaleString('fr-FR')} €, il est déclaré sur le formulaire n° 2062 avec les revenus de l’année (art. 242 ter du Code général des impôts), par l’Emprunteur ou, à défaut, par le Prêteur. Les intérêts éventuels sont imposables pour le Prêteur.

ARTICLE 9 – PREUVE, SIGNATURE ET DONNÉES
Contrat signé électroniquement (art. 1366 et 1367 du Code civil) ; l’Emprunteur écrit lui-même la somme en lettres (art. 1376). L’empreinte du texte, la date, l’heure et l’identifiant de chaque signataire sont conservés. Les données des parties ne servent qu’à l’exécution et à la preuve du contrat, ne sont accessibles qu’à elles et sont conservées cinq ans après le dernier paiement (art. 2224 du Code civil).

ARTICLE 10 – LOI APPLICABLE ET LITIGES
Droit français. Les parties cherchent d’abord un accord amiable ; à défaut, le tribunal compétent selon le droit commun est saisi.

${l.city ? `Fait à ${l.city}, en` : 'Fait en'} deux exemplaires électroniques.`;
};

/** Reconnaissance de dette, signée par l'Emprunteur seul (article 1376 du Code civil). */
export const buildDebtAcknowledgment = (l: ContractInput): string => {
  const words = amountToFrenchWords(l.amount, l.currency);
  const rate = l.interestRate || 0;
  const last = l.schedule[l.schedule.length - 1];
  return `RECONNAISSANCE DE DETTE
(Article 1376 du Code civil)

Je soussigné(e), ${identity(l.borrowerCivility, l.borrowerName, l.borrowerBirthDate, l.borrowerBirthPlace, l.borrowerAddress)},

reconnais devoir à ${identity(l.lenderCivility, l.lenderName, l.lenderBirthDate, l.lenderBirthPlace, l.lenderAddress)},

la somme de ${formatMoney(l.amount, l.currency)} (${words}), qu’il (elle) m’a prêtée le ${fmtDate(l.loanDate)}.

${rate > 0 ? `Cette somme porte intérêt au taux fixe de ${rateStr(rate)} l’an.` : 'Ce prêt est consenti sans intérêt.'} Je m’engage à la rembourser ${l.schedule.length > 1 ? `en ${l.schedule.length} échéances mensuelles, la dernière au plus tard le ${fmtDate(last.dueDate)}` : `au plus tard le ${fmtDate(last.dueDate)}`}, selon les conditions du contrat de prêt conclu ce jour entre nous.

Mention écrite par l’Emprunteur lui-même, en toutes lettres et en chiffres :
« Bon pour la somme de [mention de l’Emprunteur] »

${l.city ? `Fait à ${l.city}.` : ''}`;
};

/** Empreinte SHA-256 (hexadécimal) d'un texte, pour figer le contrat signé. */
export const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};
