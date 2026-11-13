import React, { useState } from 'react';
import { Loan, Profile, User } from '../../types';
import { Screen, TopBar, Amount, Button, KV, Card, Note, Avatar, C, euro2, dateFr, firstName, Toast } from './ui';
import { acceptRequest, declineRequest, KnownFriend } from '../../services/loanService';
import { computeSituation } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../../config/legal';
import SignaturePad from '../SignaturePad';
import { receiveLabel } from './ReceiveFields';
import { openLoanWith } from '../../utils/requests';

/** Le prêteur reçoit la demande d'un proche : accepter (vaut signature), modifier ou refuser. */
const RequestReview: React.FC<{
  loan: Loan; user: User; profile: Profile; loans: Loan[];
  onBack: () => void; onChanged: () => void; onModify: (friend: KnownFriend, amount: number, dueDate?: string) => void;
}> = ({ loan, user, profile, loans, onBack, onChanged, onModify }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [sig, setSig] = useState(profile.signature || '');
  const [toast, setToast] = useState<string | null>(null);
  const name = loan.borrowerNickname || firstName(loan.borrowerName);
  const s = loan.schedule || [];
  const past = loans.filter(l => l.id !== loan.id && l.borrowerUid === loan.borrowerUid && l.lenderUid === user.id && ['active', 'paid', 'delay_requested'].includes(l.status));
  const already = loan.borrowerUid ? openLoanWith(loans, loan.borrowerUid, user.id, loan.id) : null;
  const paidOnTime = past.filter(l => l.status === 'paid' || !computeSituation(l, LEGAL_INTEREST_RATE).isOverdue).length;

  const act = async (key: string, fn: () => Promise<void>, stay = false) => {
    setBusy(key);
    try { await fn(); onChanged(); if (!stay) onBack(); }
    catch (e) { console.error(e); setToast("Ça n'a pas marché, réessaie."); setBusy(null); }
  };

  return (
    <Screen>
      <TopBar onBack={onBack} title="Nouvelle demande" />
      <div className="px-6 pt-4 flex items-center gap-3.5">
        <Avatar name={name} size={52} />
        <div>
          <div className="text-[15px] font-semibold">{name} te demande</div>
          <Amount size={40}>{euro2(loan.amount, loan.currency)}</Amount>
        </div>
      </div>
      {loan.requestNote && <div className="px-6 pt-4"><Card className="px-4 py-3.5 text-[15px] leading-[1.45]" style={{ color: C.text2 }}>« {loan.requestNote} »</Card></div>}
      <div className="px-6 pt-3">
        <KV rows={[
          ['Il propose', s.length > 1 ? `${s.length} × ${euro2(s[0].amount, loan.currency)}` : `En une fois`],
          [s.length > 1 ? 'Échéances' : 'Date', s.length > 1 ? `du ${dateFr(s[0].dueDate, { day: 'numeric', month: 'short' })} au ${dateFr(s[s.length - 1].dueDate, { day: 'numeric', month: 'short' })}` : dateFr(s[0]?.dueDate || loan.repaymentDate)],
          ['Intérêts · retard', `${loan.interestRate ? `${loan.interestRate} %` : 'Aucun'} · ${loan.lateRateMode === 'none' ? 'rien' : 'taux légal'}`],
          ['Il veut recevoir', loan.borrowerReceive ? receiveLabel(loan.borrowerReceive) : loan.borrowerPaymentLink || 'Non précisé'],
          ['Historique avec lui', past.length ? `${past.length} prêt(s), ${paidOnTime === past.length ? 'à jour' : 'retard en cours'}` : 'Premier prêt'],
        ]} />
      </div>
      {!profile.signature && (
        <div className="px-6 pt-4">
          <div className="text-[13px] font-semibold mb-1.5" style={{ color: C.text2 }}>Ta signature</div>
          <SignaturePad label="Signe dans le cadre" onSave={setSig} />
        </div>
      )}
      {already && <div className="px-6 pt-3"><Note tone="warn">{name} a déjà {already.status === 'requested' ? 'une autre demande' : already.status === 'pending_borrower' ? 'une proposition à signer' : 'un prêt en cours'} avec toi. Une demande à la fois : tu peux refuser celle-ci.</Note></div>}
      <div className="px-6 pt-3"><Note>Accepter vaut ta signature : le contrat est créé avec ton identité et celle de {name}, qui a déjà signé sa demande. Avec une contre-proposition, tu changes le montant, la date ou les intérêts, et {name} signe tes nouvelles conditions.</Note></div>
      <div className="mt-auto px-5 pt-4 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button disabled={!sig} busy={busy === 'ok'} onClick={() => act('ok', () => acceptRequest(loan, user, profile, sig), true)}>Accepter et signer</Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" className="!text-[15px] whitespace-nowrap" onClick={async () => {
            await declineRequest(loan, firstName(profile.fullName), true).catch(() => undefined);
            onModify({ uid: loan.borrowerUid, nickname: name, phone: loan.borrowerPhone, lastLoan: loan }, loan.amount, s[s.length - 1]?.dueDate);
          }}>Contre-proposition</Button>
          <Button variant="danger" busy={busy === 'no'} onClick={() => act('no', () => declineRequest(loan, firstName(profile.fullName)))}>Refuser</Button>
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default RequestReview;
