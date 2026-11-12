import React, { useEffect, useState } from 'react';
import { Loan, Notification, Profile, User } from '../../types';
import { Screen, Amount, Card, Avatar, Icon, Skeleton, Button, Sheet, Toast, C, euro2, firstName, relDays, dateFr, Note } from './ui';
import CKLogo from '../brand/CKLogo';
import FiscalPanel from '../FiscalPanel';
import PushCard from './PushCard';
import { ratesOutdated, RATES_VALID_UNTIL } from '../../config/legal';
import { sendTestReminder } from '../../services/push';
import { computeSituation } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../../config/legal';
import { fetchExchangeRate } from '../../services/exchangeRate';
import { getUserNotifications, markNotificationAsRead } from '../../services/notificationService';

type Tab = 'home' | 'loans' | 'activity' | 'profile';

interface Props {
  tab: Tab;
  user: User;
  profile: Profile | null;
  loans: Loan[];
  loading: boolean;
  onOpenLoan: (l: Loan) => void;
  onCreate: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onLegal: (v: 'cgu' | 'privacy') => void;
  onBorrowerSpace?: () => void;
  requestLink: string;
}

const nameOf = (l: Loan) => l.borrowerNickname || firstName(l.borrowerName);

/** Une ligne de prêt façon relevé de compte. */
const LoanRow: React.FC<{ loan: Loan; onOpen: (l: Loan) => void; first?: boolean }> = ({ loan, onOpen, first }) => {
  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  let sub: React.ReactNode, color = C.mute, amount = s.totalDueNow;
  if (loan.status === 'requested') { sub = 'Te demande ce prêt'; color = C.ochreText; amount = loan.amount; }
  else if (loan.status === 'pending_borrower') { sub = 'En attente de signature'; amount = loan.amount; }
  else if (loan.status === 'delay_requested') { sub = 'Demande un délai'; color = C.ochreText; }
  else if ((loan.payments || []).some(p => p.status === 'declared')) { sub = 'Paiement à confirmer'; color = C.ochreText; }
  else if (s.isOverdue) { sub = `En retard de ${s.daysLate} jour${s.daysLate > 1 ? 's' : ''}`; color = C.red; }
  else if (loan.status === 'paid' || s.isFullyPaid) { sub = 'Remboursé'; color = C.green; amount = loan.amount; }
  else if (s.nextInstallment) {
    const n = s.schedule.indexOf(s.nextInstallment) + 1;
    sub = `${s.schedule.length > 1 ? `Échéance ${n} sur ${s.schedule.length} · ` : ''}${relDays(s.nextInstallment.dueDate)}`;
    amount = s.nextInstallment.outstanding;
  }
  return (
    <button onClick={() => onOpen(loan)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={{ borderTop: first ? undefined : `1px solid ${C.line}` }}>
      <Avatar name={nameOf(loan)} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold truncate">{nameOf(loan)}</div>
        <div className="text-[13px] font-medium" style={{ color }}>{sub}</div>
      </div>
      <div className="text-[15px] font-bold tabular-nums">{euro2(amount, loan.currency)}</div>
    </button>
  );
};

const priority = (l: Loan) => {
  const s = computeSituation(l, LEGAL_INTEREST_RATE);
  if (l.status === 'requested') return 0;
  if (l.status === 'pending_borrower') return 4;
  if (l.status === 'delay_requested' || (l.payments || []).some(p => p.status === 'declared')) return 1;
  if (s.isOverdue) return 2;
  return 3;
};

const LenderTabs: React.FC<Props> = (p) => {
  const mine = p.loans.filter(l => l.lenderUid === p.user.id && l.status !== 'declined');
  const open = mine.filter(l => !['paid'].includes(l.status) && !computeSituation(l, LEGAL_INTEREST_RATE).isFullyPaid || l.status === 'pending_borrower' || l.status === 'requested');
  const [owed, setOwed] = useState<number | null>(null);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(mine.filter(l => !['pending_borrower', 'requested'].includes(l.status))
      .map(l => fetchExchangeRate(computeSituation(l, LEGAL_INTEREST_RATE).totalDueNow, l.currency)))
      .then(v => { if (alive) setOwed(v.reduce((a, b) => a + b, 0)); });
    return () => { alive = false; };
  }, [p.loans]);
  useEffect(() => { if (p.tab === 'activity') getUserNotifications(p.user.id).then(setNotifs); }, [p.tab, p.user.id]);

  const sorted = open.slice().sort((a, b) => priority(a) - priority(b));
  const overdueCount = open.filter(l => ['active', 'delay_requested'].includes(l.status) && computeSituation(l, LEGAL_INTEREST_RATE).isOverdue).length;
  const greeting = firstName(p.profile?.fullName || p.user.name);


  const shareText = `Salut ! Pour tes demandes de dépannage, passe désormais par mon appli : tu choisis le montant et la date de remboursement, je reçois la demande et je te réponds vite. Tout est au même endroit, même le lien pour me rembourser. ${p.requestLink}`;
  const shareSheet = (
    <>
      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Ton lien de demande">
        <div className="flex flex-col gap-3">
          <p className="text-[15px] leading-relaxed" style={{ color: C.text2 }}>
            Envoie-le une seule fois à tes proches. Quand ils ont besoin d'un dépannage, ils te font leur demande ici : montant, date de remboursement, signature. Tu n'as plus qu'à accepter.
          </p>
          <div className="rounded-[14px] px-4 py-3 text-[13px] font-mono break-all" style={{ background: C.soft, color: C.ink }}>{p.requestLink}</div>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
            className="h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white" style={{ background: C.green }}>
            <Icon name="chat" /> Envoyer sur WhatsApp
          </a>
          <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(p.requestLink); setToast('Lien copié'); }}><Icon name="copy" size={20} /> Copier le lien</Button>
        </div>
      </Sheet>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );

  if (p.tab === 'home') return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),20px)] flex items-center justify-between">
        <CKLogo size="sm" />
        <div className="text-[15px] font-semibold">Bonjour {greeting}</div>
      </div>
      <div className="px-5 pt-7">
        <div className="text-sm" style={{ color: C.mute }}>On te doit</div>
        {owed === null ? <Skeleton h={58} className="w-48 mt-1" /> : <Amount>{euro2(owed)}</Amount>}
        <div className="text-sm mt-1.5" style={{ color: C.mute }}>
          {open.length ? `${open.length} prêt${open.length > 1 ? 's' : ''} en cours${overdueCount ? ` · ${overdueCount} en retard` : ''}` : 'Aucun prêt en cours'}
        </div>
      </div>
      <div className="px-5 pt-6">
        <button onClick={p.onCreate} className="w-full h-14 rounded-2xl flex items-center justify-center gap-2.5 text-base font-bold text-white" style={{ background: C.ink }}>
          <Icon name="plus" /> Prêter à un proche
        </button>
        <button onClick={() => setShareOpen(true)} className="w-full mt-2.5 h-12 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-semibold" style={{ background: C.card, color: C.ink }}>
          <Icon name="chat" size={20} /> Partager mon lien de demande
        </button>
      </div>
      {ratesOutdated() && (
        <div className="px-5 pt-4"><Note tone="warn">Les taux légaux enregistrés dans l'appli datent d'avant le {dateFr(RATES_VALID_UNTIL, { day: 'numeric', month: 'long', year: 'numeric' })}. La mise à jour préparée par l'agent de veille attend ta validation sur GitHub.</Note></div>
      )}
      <div className="px-5 pt-4"><PushCard uid={p.user.id} text="Reçois les demandes de tes proches et leurs paiements dès qu'ils arrivent." /></div>
      <div className="px-5 pt-7 pb-3 flex justify-between items-baseline">
        <div className="text-[17px] font-bold">{sorted.some(l => priority(l) < 3) ? 'À traiter' : 'À venir'}</div>
      </div>
      <div className="px-5">
        {p.loading ? (
          <div className="flex flex-col gap-2"><Skeleton /><Skeleton /><Skeleton /></div>
        ) : sorted.length ? (
          <Card>{sorted.slice(0, 6).map((l, i) => <LoanRow key={l.id} loan={l} onOpen={p.onOpenLoan} first={i === 0} />)}</Card>
        ) : (
          <Card className="px-5 py-8 text-center">
            <div className="text-[15px] font-semibold">Aucun prêt en cours</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>Quand tu prêteras à un proche, tu suivras ici ses remboursements.</div>
          </Card>
        )}
      </div>
      {p.onBorrowerSpace && (
        <div className="px-5 pt-4"><Button variant="secondary" onClick={p.onBorrowerSpace}>Voir ce que je dois</Button></div>
      )}
      {shareSheet}
    </Screen>
  );

  if (p.tab === 'loans') {
    const done = mine.filter(l => !open.includes(l));
    return (
      <Screen bottomPad>
        <div className="px-5 pt-[max(env(safe-area-inset-top),20px)]"><h1 className="text-[26px] font-bold pt-3">Mes prêts</h1></div>
        <div className="px-5 pt-5">
          {open.length ? <Card>{sorted.map((l, i) => <LoanRow key={l.id} loan={l} onOpen={p.onOpenLoan} first={i === 0} />)}</Card>
            : <div className="text-sm" style={{ color: C.mute }}>Aucun prêt en cours.</div>}
        </div>
        {done.length > 0 && (
          <>
            <div className="px-5 pt-7 pb-3 text-[17px] font-bold">Remboursés</div>
            <div className="px-5"><Card>{done.map((l, i) => <LoanRow key={l.id} loan={l} onOpen={p.onOpenLoan} first={i === 0} />)}</Card></div>
          </>
        )}
      </Screen>
    );
  }

  if (p.tab === 'activity') return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),20px)]"><h1 className="text-[26px] font-bold pt-3">Activité</h1></div>
      <div className="px-5 pt-5">
        {notifs.length ? (
          <Card>
            {notifs.slice(0, 30).map((n, i) => (
              <button key={n.id} onClick={() => { markNotificationAsRead(n.id); const l = p.loans.find(x => x.id === n.loanId); if (l) p.onOpenLoan(l); }}
                className="w-full text-left flex gap-3 px-4 py-3.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: n.read ? 'transparent' : C.ochre }} />
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">{n.title}</div>
                  <div className="text-[13px]" style={{ color: C.mute }}>{n.message}</div>
                </div>
                <div className="text-xs shrink-0" style={{ color: C.mute }}>{dateFr(n.date, { day: 'numeric', month: 'short' })}</div>
              </button>
            ))}
          </Card>
        ) : <div className="text-sm" style={{ color: C.mute }}>Rien de nouveau pour l'instant.</div>}
      </div>
      <div className="px-5 pt-8 pb-3 text-[17px] font-bold">Impôts et obligations</div>
      <div className="px-5"><FiscalPanel loans={p.loans} lenderUid={p.user.id} /></div>
    </Screen>
  );

  // Profil
  return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),20px)]"><h1 className="text-[26px] font-bold pt-3">Profil</h1></div>
      <div className="px-5 pt-5 flex items-center gap-3.5">
        <Avatar name={p.profile?.fullName || p.user.name} size={56} />
        <div>
          <div className="text-[17px] font-bold">{p.profile?.fullName || p.user.name}</div>
          <div className="text-sm" style={{ color: C.mute }}>{p.user.email}</div>
        </div>
      </div>
      <div className="px-5 pt-6 flex flex-col gap-2.5">
        <Card>
          {[
            ['Mes informations pour les contrats', p.onEditProfile],
            ['Mon lien de demande', () => setShareOpen(true)],
            ["M'envoyer un rappel de test", async () => {
              setToast('Envoi en cours…');
              try {
                const r = await sendTestReminder();
                setToast(r.status !== 200 ? "L'envoi a échoué" : r.data.reason === 'gmail_non_configure' ? "Gmail n'est pas encore configuré"
                  : r.data.mail ? `E-mail envoyé à ${r.data.to}${r.data.pushed ? ' + notification' : ''}` : "L'e-mail n'a pas pu partir : vérifie le mot de passe d'application");
              } catch { setToast("L'envoi a échoué"); }
            }],
            ...(p.onBorrowerSpace ? [['Ce que je dois', p.onBorrowerSpace] as const] : []),
            ['Conditions d’utilisation', () => p.onLegal('cgu')],
            ['Confidentialité', () => p.onLegal('privacy')],
          ].map(([label, fn], i) => (
            <button key={label as string} onClick={fn as () => void} className="w-full flex items-center justify-between px-4 py-4 text-[15px] font-semibold" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              {label as string}<Icon name="chevron" size={18} />
            </button>
          ))}
        </Card>
        {p.profile?.paymentLink ? <Note>Tes proches voient un bouton « Payer » vers {/paypal/i.test(p.profile.paymentLink) ? 'ton PayPal, avec le montant déjà rempli' : 'ton lien de paiement'}.</Note> : <Note tone="warn">Ajoute ton lien PayPal.me dans tes informations : tes proches auront un bouton « Payer » avec le montant déjà rempli.</Note>}
        <Button variant="danger" onClick={p.onLogout}><Icon name="logout" size={20} /> Se déconnecter</Button>
        <p className="text-xs text-center px-4 pt-2 leading-relaxed" style={{ color: C.mute }}>
          CKMoney est un outil personnel de suivi de prêts entre proches. Il ne détient aucun fonds et ne remplace pas le conseil d'un professionnel du droit.
        </p>
      </div>
      {shareSheet}
    </Screen>
  );
};

export default LenderTabs;
