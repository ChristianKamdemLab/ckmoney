import { Loan } from '../types';
import { computeSituation } from './schedule';
import { LEGAL_INTEREST_RATE } from '../config/legal';

// Demandes de prêt d'un proche : une seule à la fois avec un même prêteur. Une nouvelle demande n'est
// possible que quand rien n'est en cours entre eux (demande en attente, offre à signer, prêt pas remboursé).

const OPEN = ['requested', 'pending_borrower', 'active', 'delay_requested'];

/** Le prêt ou la demande en cours entre ce proche et ce prêteur, s'il y en a un. */
export const openLoanWith = (loans: Loan[], borrowerUid: string, lenderUid: string, exceptId?: string): Loan | null =>
  loans.find(l => l.id !== exceptId && l.borrowerUid === borrowerUid && l.lenderUid === lenderUid && OPEN.includes(l.status)
    && !((l.status === 'active' || l.status === 'delay_requested') && computeSituation(l, LEGAL_INTEREST_RATE).isFullyPaid)) || null;

/** Les prêteurs à qui ce compte peut faire une demande depuis son espace : ceux avec qui il a déjà un prêt
 *  ou une demande, et ceux dont il a ouvert le lien de demande. Jamais un inconnu (pas de mise en relation). */
export const requestTargets = (loans: Loan[], userId: string, viaLenders: string[] = []) =>
  Array.from(new Set([...loans.filter(l => l.borrowerUid === userId).map(l => l.lenderUid || ''), ...viaLenders]))
    .filter(uid => !!uid && uid !== userId);

/** Pourquoi ce proche ne peut pas faire de nouvelle demande à ce prêteur (texte affiché sous le bouton). */
export const blockedReason = (l: Loan, lenderFirstName: string) =>
  l.status === 'requested' ? `Ta demande est en attente : ${lenderFirstName} va l'accepter, la refuser ou te faire une autre proposition.`
    : l.status === 'pending_borrower' ? `${lenderFirstName} t'a fait une proposition : ouvre-la pour la signer.`
    : `Une demande à la fois : tu pourras en faire une nouvelle quand ton prêt en cours sera remboursé.`;
