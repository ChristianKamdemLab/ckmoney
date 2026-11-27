import React, { useEffect, useState } from 'react';
import { Loan, Profile, User } from '../../types';
import { Screen, Amount, Card, Avatar, Icon, Skeleton, Button, Sheet, Toast, C, euro2, firstName, relDays, dateFr, Note } from './ui';
import { InstallButton } from './Install';
import { ratesOutdated, RATES_VALID_UNTIL } from '../../config/legal';
import { sendTestReminder } from '../../services/push';
import { reopenRequest, hideDeclined } from '../../services/loanService';
import { computeSituation } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../../config/legal';
import { fetchExchangeRate } from '../../services/exchangeRate';

type Tab = 'loans' | 'profile';

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
  onBorrowerSpace?: () => void;   // accueil : « Voir ce que je dois » (seulement s'il emprunte)
  onBorrowerArea?: () => void;    // profil : ses emprunts et ses demandes à d'autres prêteurs (toujours)
  onArticles: () => void;
  onJambo: () => void;
  onBac: () => void;
  onWiseman: () => void;
  onEvents: () => void;
  onRadio?: () => void;
  onMot?: () => void;
  onInfo?: (scope?: 'monde' | 'afrique' | 'decryptage') => void; onVendredi?: () => void; onAdresses?: () => void; onFilms?: () => void;
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
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all(mine.filter(l => !['pending_borrower', 'requested'].includes(l.status))
      .map(l => fetchExchangeRate(computeSituation(l, LEGAL_INTEREST_RATE).totalDueNow, l.currency)))
      .then(v => { if (alive) setOwed(v.reduce((a, b) => a + b, 0)); });
    return () => { alive = false; };
  }, [p.loans]);

  const sorted = open.slice().sort((a, b) => priority(a) - priority(b));
  const overdueCount = open.filter(l => ['active', 'delay_requested'].includes(l.status) && computeSituation(l, LEGAL_INTEREST_RATE).isOverdue).length;
  const requests = open.filter(l => l.status === 'requested').length;
  const running = open.length - requests;


  const shareText = `Salut ! Pour tes demandes de dépannage, passe désormais par CKMoney : tu choisis le montant et la date de remboursement, je reçois la demande et je te réponds vite. Tout est au même endroit, même le lien pour me rembourser. ${p.requestLink}`;
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

  if (p.tab === 'loans') {
    const done = mine.filter(l => !open.includes(l));
    // Demandes classées depuis moins de 30 jours, sans contre-proposition envoyée : on peut y revenir
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const declined = p.loans.filter(l => l.lenderUid === p.user.id && l.status === 'declined' && l.initiatedBy === 'borrower' && !l.lenderHidden && !hidden.includes(l.id)
      && (l.createdAt || '') > since && !p.loans.some(x => x.counterOf === l.id));
    return (
      <Screen bottomPad>
        {/* Bandeau façon relevé (26/11) : le montant passe au premier plan, les ronds du wax restent dans les coins */}
        <div className="relative overflow-hidden px-5 pt-[max(env(safe-area-inset-top),22px)] pb-6 rounded-b-[28px]" style={{ background: C.night, color: C.nightText }}>
          <span aria-hidden="true" className="absolute rounded-full" style={{ width: 140, height: 140, background: C.mango, top: -92, right: -56 }} />
          <span aria-hidden="true" className="absolute rounded-full box-border" style={{ width: 76, height: 76, border: `12px solid ${C.coral}`, bottom: -30, right: -18 }} />
          <div className="relative z-[1]">
            <h1 className="display text-[22px]">Mes prêts</h1>
            <div className="mt-4 text-[13px] font-semibold" style={{ color: C.nightMute }}>On te doit</div>
            {owed === null ? <Skeleton h={40} className="w-40 mt-1 opacity-20" /> : <div className="display text-[34px] leading-none mt-1.5 tabular-nums whitespace-nowrap">{euro2(owed)}</div>}
            <div className="text-[13px] mt-2 font-semibold" style={{ color: C.nightMute }}>
              {running ? `${running} prêt${running > 1 ? 's' : ''} en cours${overdueCount ? ` · ${overdueCount} en retard` : ''}` : 'Aucun prêt en cours'}{requests ? ` · ${requests} demande${requests > 1 ? 's' : ''}` : ''}
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={p.onCreate} className="h-12 pl-4 pr-5 rounded-full flex items-center gap-2 text-[15px] font-extrabold" style={{ background: C.mango, color: C.ink }}><Icon name="plus" size={19} /> Prêter</button>
              <button onClick={() => setShareOpen(true)} className="h-12 px-4 rounded-full flex items-center gap-2 text-[14.5px] font-bold" style={{ color: C.nightText, border: '1.5px solid rgba(247,243,234,.3)' }}><Icon name="chat" size={18} /> Mon lien de demande</button>
            </div>
          </div>
        </div>
        {ratesOutdated() && (
          <div className="px-5 pt-4"><Note tone="warn">Les taux légaux enregistrés dans l'appli datent d'avant le {dateFr(RATES_VALID_UNTIL, { day: 'numeric', month: 'long', year: 'numeric' })}. La mise à jour préparée par l'agent de veille attend ta validation sur GitHub.</Note></div>
        )}
        {overdueCount > 0 && (
          <div className="px-5 pt-4">
            <div className="rounded-2xl px-4 py-3 flex gap-3 items-start text-[14px] leading-snug" style={{ background: C.redSoft, color: C.red }}>
              <Icon name="alert" size={20} /><span><b>{overdueCount} remboursement{overdueCount > 1 ? 's' : ''} en retard.</b> Les relances partent seules ; tu peux aussi relancer depuis le prêt.</span>
            </div>
          </div>
        )}
        <div className="px-5 pt-6 pb-3 text-[17px] font-bold">En cours</div>
        <div className="px-5">
          {open.length ? <Card>{sorted.map((l, i) => <LoanRow key={l.id} loan={l} onOpen={p.onOpenLoan} first={i === 0} />)}</Card>
            : <div className="text-sm" style={{ color: C.mute }}>Aucun prêt en cours.</div>}
        </div>
        {p.onBorrowerSpace && <div className="px-5 pt-4"><Button variant="secondary" onClick={p.onBorrowerSpace}>Voir ce que je dois</Button></div>}
        {done.length > 0 && (
          <>
            <div className="px-5 pt-7 pb-3 text-[17px] font-bold">Remboursés</div>
            <div className="px-5"><Card>{done.map((l, i) => <LoanRow key={l.id} loan={l} onOpen={p.onOpenLoan} first={i === 0} />)}</Card></div>
          </>
        )}
        {declined.length > 0 && (
          <>
            <div className="px-5 pt-7 pb-3 text-[17px] font-bold">Demandes refusées</div>
            <div className="px-5">
              <Card>
                {declined.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                    <Avatar name={l.borrowerNickname || firstName(l.borrowerName)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold truncate">{l.borrowerNickname || firstName(l.borrowerName)}</div>
                      <div className="text-[13px]" style={{ color: C.mute }}>{euro2(l.amount, l.currency)} · {dateFr(l.createdAt, { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <button disabled={reopening === l.id} className="h-10 px-3.5 rounded-xl text-[14px] font-bold shrink-0 disabled:opacity-50" style={{ background: C.soft, color: C.ink }}
                      onClick={async () => { setReopening(l.id); try { await reopenRequest(l); p.onOpenLoan({ ...l, status: 'requested' }); } catch { setToast("Ça n'a pas marché, réessaie."); } finally { setReopening(null); } }}>{reopening === l.id ? '…' : 'Reprendre'}</button>
                    {/* Retirer de la liste (27/11) : la demande reste refusée, l'ami garde son historique */}
                    <button aria-label={`Retirer la demande de ${l.borrowerNickname || firstName(l.borrowerName)}`} disabled={reopening === l.id} className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center disabled:opacity-50" style={{ color: C.mute }}
                      onClick={async () => { setHidden(h => [...h, l.id]); try { await hideDeclined(l); } catch { setHidden(h => h.filter(x => x !== l.id)); setToast("Ça n'a pas marché, réessaie."); } }}><Icon name="close" size={18} /></button>
                  </div>
                ))}
              </Card>
              <div className="text-[12.5px] mt-2 px-1" style={{ color: C.mute }}>« Reprendre » la repasse en « à traiter », pour l'accepter ou faire une contre-proposition. La croix la retire de ta liste.</div>
            </div>
          </>
        )}
        {shareSheet}
      </Screen>
    );
  }

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
                setToast(r.status !== 200 ? "L'envoi a échoué" : r.data.reason === 'notification_seulement' ? (r.data.pushed ? 'Notification envoyée' : 'Active les notifications pour recevoir le test') : r.data.reason === 'gmail_non_configure' ? "Gmail n'est pas encore configuré"
                  : r.data.mail ? `E-mail envoyé à ${r.data.to}${r.data.pushed ? ' + notification' : ''}` : "L'e-mail n'a pas pu partir : vérifie le mot de passe d'application");
              } catch { setToast("L'envoi a échoué"); }
            }],
            ...(p.onBorrowerArea || p.onBorrowerSpace ? [['Mes emprunts et demandes', (p.onBorrowerArea || p.onBorrowerSpace)!] as const] : []),
            ['Conditions d’utilisation', () => p.onLegal('cgu')],
            ['Confidentialité', () => p.onLegal('privacy')],
          ].map(([label, fn], i) => (
            <button key={label as string} onClick={fn as () => void} className="w-full flex items-center justify-between px-4 py-4 text-[15px] font-semibold" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              {label as string}<Icon name="chevron" size={18} />
            </button>
          ))}
        </Card>
        {p.profile?.paymentLink ? <Note>Tes proches voient un bouton « Payer » vers {/paypal/i.test(p.profile.paymentLink) ? 'ton PayPal, avec le montant déjà rempli' : 'ton lien de paiement'}.</Note> : <Note tone="warn">Ajoute ton lien PayPal.me dans tes informations : tes proches auront un bouton « Payer » avec le montant déjà rempli.</Note>}
        <InstallButton className="w-full" />
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
