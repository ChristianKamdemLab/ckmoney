// Modèle de contrat de prêt entre particuliers et de reconnaissance de dette.
// Texte FIXE (pas de génération par IA) : chaque prêt est rédigé à partir des mêmes
// clauses, et le texte signé est figé par une empreinte SHA-256.
import { Loan } from '../types';
import { amountToFrenchWords } from './frenchNumbers';
import { Installment, formatMoney, parseISODate } from './schedule';
import { DECLARATION_THRESHOLD_EUR, LEGAL_INTEREST_RATE } from '../config/legal';

export const CONTRACT_VERSION = '2026.11-1';

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
  'amount' | 'currency' | 'loanDate' | 'repaymentDate' | 'interestRate' | 'repaymentType' | 'lateRateMode' | 'lateInterestRate' | 'city'> {
  schedule: Installment[];
}

export const scheduleTable = (schedule: Installment[], currency: string) =>
  schedule
    .map(i => `  Échéance ${i.index} — ${fmtDate(i.dueDate)} : ${formatMoney(i.amount, currency)} (capital ${formatMoney(i.principal, currency)}, intérêts ${formatMoney(i.interest, currency)})`)
    .join('\n');

/** Contrat de prêt signé par les deux parties. */
export const buildLoanContract = (l: ContractInput): string => {
  const words = amountToFrenchWords(l.amount, l.currency);
  const amountStr = `${formatMoney(l.amount, l.currency)} (${words})`;
  const rate = l.interestRate || 0;
  const totalInterest = l.schedule.reduce((s, i) => s + i.interest, 0);
  const totalDue = l.schedule.reduce((s, i) => s + i.amount, 0);
  const monthly = l.repaymentType === 'monthly' && l.schedule.length > 1;

  const interestClause = rate > 0
    ? `Le prêt est consenti moyennant un intérêt conventionnel au taux fixe de ${rateStr(rate)} l’an, fixé par écrit conformément à l’article 1907 du Code civil. Aucun frais n’étant mis à la charge de l’Emprunteur, le taux annuel effectif global est égal à ce taux, soit ${rateStr(rate)}. Le montant total des intérêts s’élève à ${formatMoney(totalInterest, l.currency)}, et le coût total du prêt à ${formatMoney(totalDue, l.currency)}.\nLes intérêts perçus constituent pour le Prêteur des revenus de capitaux mobiliers qu’il déclare à l’administration fiscale.`
    : `Le prêt est consenti à titre gratuit, sans intérêt (article 1905 du Code civil a contrario). L’Emprunteur ne rembourse que le capital emprunté.`;

  const repaymentClause = monthly
    ? `L’Emprunteur rembourse le prêt en ${l.schedule.length} échéances mensuelles selon le tableau ci-dessous, la première le ${fmtDate(l.schedule[0].dueDate)} et la dernière le ${fmtDate(l.schedule[l.schedule.length - 1].dueDate)} :\n${scheduleTable(l.schedule, l.currency)}`
    : `L’Emprunteur rembourse la totalité des sommes dues, soit ${formatMoney(totalDue, l.currency)}, en une seule fois au plus tard le ${fmtDate(l.schedule[0].dueDate)}.`;

  let lateClause: string;
  if (l.lateRateMode === 'none') {
    lateClause = `Les parties conviennent qu’aucun intérêt de retard conventionnel ne sera dû. Le Prêteur conserve le droit de réclamer les intérêts au taux légal à compter d’une mise en demeure, conformément à l’article 1231-6 du Code civil.`;
  } else if (l.lateRateMode === 'legal') {
    lateClause = `Toute somme échue et non payée produit de plein droit, à compter du lendemain de son échéance et jusqu’à complet paiement, des intérêts au taux de l’intérêt légal en vigueur applicable aux créanciers personnes physiques n’agissant pas pour des besoins professionnels (${rateStr(LEGAL_INTEREST_RATE)} à la date de signature, révisé chaque semestre).`;
  } else {
    lateClause = `Toute somme échue et non payée produit de plein droit, à compter du lendemain de son échéance et jusqu’à complet paiement, des intérêts de retard au taux fixe de ${rateStr(l.lateInterestRate || 0)} l’an. Les parties reconnaissent que ce taux n’est pas manifestement excessif ; il demeure soumis au pouvoir de modération du juge (article 1231-5 du Code civil).`;
  }

  const paymentLines = ['Les paiements sont effectués par virement ou par tout autre moyen convenu entre les parties et laissant une trace écrite.'];
  if (l.lenderIban) paymentLines.push(`IBAN du Prêteur : ${l.lenderIban}`);
  if (l.lenderPaymentLink) paymentLines.push(`Lien de paiement du Prêteur : ${l.lenderPaymentLink}`);
  paymentLines.push('Chaque paiement est enregistré dans l’application CKMoney et confirmé par le Prêteur, cette confirmation valant quittance. Les paiements s’imputent d’abord sur les intérêts, puis sur le capital des échéances les plus anciennes (articles 1342-10 et 1343-1 du Code civil).');

  const currencyClause = l.currency === 'EUR'
    ? ''
    : `\n\nARTICLE 6 BIS – MONNAIE\nLe prêt est libellé en ${l.currency} en raison du caractère international de l’opération (article 1343-3 du Code civil). Si le paiement intervient en France et que ce caractère international n’est pas établi, il est effectué en euros, à la contre-valeur au jour du paiement.`;

  const accelerationClause = monthly
    ? `\n\nARTICLE 8 BIS – DÉFAILLANCE\nEn cas de non-paiement de deux échéances consécutives, et quinze jours après une mise en demeure adressée par lettre recommandée avec avis de réception restée sans effet, le Prêteur peut exiger le remboursement immédiat du capital restant dû et des intérêts échus.`
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
Le Prêteur prête à l’Emprunteur, qui l’accepte, la somme de ${amountStr}. Les fonds sont remis le ${fmtDate(l.loanDate)}. Par sa signature, l’Emprunteur reconnaît les avoir reçus à cette date, ou s’engage à confirmer leur réception dans l’application dès leur versement s’ils sont remis ultérieurement.

ARTICLE 2 – CARACTÈRE PERSONNEL ET OCCASIONNEL DU PRÊT
Le présent prêt est consenti à titre personnel, occasionnel et non professionnel, dans le cadre de relations amicales ou familiales entre les parties. Le Prêteur déclare ne pas se livrer à titre habituel à des opérations de crédit (article L. 511-5 du Code monétaire et financier). Le présent prêt n’est pas un crédit à la consommation au sens des articles L. 311-1 et suivants du Code de la consommation, le Prêteur n’agissant pas à titre professionnel.

ARTICLE 3 – INTÉRÊTS
${interestClause}

ARTICLE 4 – REMBOURSEMENT
${repaymentClause}

ARTICLE 5 – REMBOURSEMENT ANTICIPÉ
L’Emprunteur peut à tout moment rembourser tout ou partie du prêt par anticipation, sans pénalité ni frais. Les intérêts conventionnels éventuels ne sont alors dus que pour la période écoulée.

ARTICLE 6 – MODALITÉS DE PAIEMENT
${paymentLines.join('\n')}${currencyClause}

ARTICLE 7 – RETARD DE PAIEMENT
${lateClause}

ARTICLE 8 – REPORT D’ÉCHÉANCE
Toute modification des dates ou montants de remboursement fait l’objet d’un accord écrit des deux parties, enregistré dans l’application sous forme d’avenant.${accelerationClause}

ARTICLE 9 – OBLIGATIONS FISCALES
Lorsque le montant du prêt, ou le cumul des prêts consentis au cours d’une même année civile entre les mêmes parties, excède ${DECLARATION_THRESHOLD_EUR.toLocaleString('fr-FR')} €, le prêt est déclaré à l’administration fiscale au moyen du formulaire n° 2062, joint à la déclaration de revenus de l’année de sa conclusion (article 242 ter 3 du Code général des impôts). Cette déclaration incombe à l’Emprunteur, et au Prêteur à défaut.

ARTICLE 10 – DONNÉES PERSONNELLES
Les données personnelles figurant au présent contrat sont traitées dans l’application CKMoney aux seules fins de son exécution et de la preuve de l’engagement. Elles ne sont accessibles qu’au Prêteur et à l’Emprunteur et sont conservées jusqu’à l’expiration de la prescription de l’action en paiement (cinq ans, article 2224 du Code civil). Chaque partie dispose d’un droit d’accès, de rectification et d’effacement dans ces limites.

ARTICLE 11 – PREUVE ET SIGNATURE ÉLECTRONIQUE
Le présent contrat est établi et signé sous forme électronique (articles 1366 et 1367 du Code civil). L’Emprunteur porte lui-même la mention de la somme due en toutes lettres et en chiffres (article 1376 du Code civil). L’empreinte numérique du texte, la date et l’heure de chaque signature et l’identifiant de connexion de chaque signataire sont conservés afin d’en garantir l’intégrité et l’imputabilité.

ARTICLE 12 – LOI APPLICABLE ET LITIGES
Le présent contrat est soumis au droit français. Les parties s’efforcent de régler à l’amiable tout différend relatif à son exécution. À défaut, le litige est porté devant la juridiction compétente selon les règles de droit commun.

Fait à ${l.city || '___'}, en deux exemplaires électroniques, un pour chaque partie.`;
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

Fait à ${l.city || '___'}.`;
};

/** Empreinte SHA-256 (hexadécimal) d'un texte, pour figer le contrat signé. */
export const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};
