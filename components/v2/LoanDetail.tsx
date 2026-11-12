import React, { useEffect, useState } from 'react';
import { formatIban, Loan, Payment, Profile, User } from '../../types';
import { Screen, TopBar, Amount, Button, Card, Field, inputClass, inputStyle, Note, Sheet, Icon, IconName, C, euro2, dateFr, relDays, firstName, Avatar, Toast } from './ui';
import { computeSituation, effectiveLateRate, toISODate } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE, rateCapFor } from '../../config/legal';
import {
  recordPaymentByLender, reviewPayment, markLoanPaid, declarePayment, requestDelay, respondToDelay, deleteOffer, inviteLinkFor,
  getLenderCard, payUrl, payProvider, markFundsSent, verifyContract,
} from '../../services/loanService';
import ContractPreview from '../ContractPreview';
import { sendReminderNow } from '../../services/push';

interface Props {
  loan: Loan;
  user: User;
  profile: Profile | null;
  onBack: () => void;
  onChanged: () => void;
  onEdit?: (loan: Loan) => void;
}

const Ring: React.FC<{ done: number; total: number }> = ({ done, total }) => {
  const r = 44, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${done} échéance(s) sur ${total} réglée(s)`} className="shrink-0">
      <circle cx="52" cy="52" r={r} fill="none" stroke={C.border} strokeWidth="9" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={C.ochre} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 52 52)" style={{ transition: 'stroke-dashoffset .6s' }} />
      <text x="52" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill={C.ink}>{done}/{total}</text>
      <text x="52" y="68" textAnchor="middle" fontSize="11" fill={C.mute}>payées</text>
    </svg>
  );
};

const Action: React.FC<{ icon: IconName; label: string; primary?: boolean; onClick: () => void; href?: string }> = ({ icon, label, primary, onClick, href }) => {
  const inner = (
    <>
      <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: primary ? C.ink : C.card, color: primary ? '#fff' : C.ink }}><Icon name={icon} /></span>
      {label}
    </>
  );
  const cls = 'flex flex-col items-center gap-1.5 text-xs font-semibold';
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>{inner}</a>
    : <button className={cls} onClick={onClick}>{inner}</button>;
};

const LoanDetail: React.FC<Props> = ({ loan, user, profile, onBack, onChanged, onEdit }) => {
  const isLender = loan.lenderUid === user.id;
  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  const lateRate = effectiveLateRate(loan, LEGAL_INTEREST_RATE);
  const other = isLender ? (loan.borrowerNickname || firstName(loan.borrowerName)) : firstName(loan.lenderName);
  const pending = loan.status === 'pending_borrower';
  const [sheet, setSheet] = useState<null | 'pay' | 'delay' | 'more' | 'remind'>(null);
  const [showContract, setShowContract] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(String(s.isOverdue ? Math.round((s.overdueAmount + s.lateInterest + s.penalty) * 100) / 100 : (s.nextInstallment?.outstanding ?? s.totalDueNow)));
  const [payDate, setPayDate] = useState(toISODate(new Date()));
  const [payMethod, setPayMethod] = useState('Virement');
  const [delayDate, setDelayDate] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [contractCheck, setContractCheck] = useState(loan.contractCheck);
  useEffect(() => {
    if (isLender && !loan.contractCheck) verifyContract(loan).then(r => { if (r) setContractCheck(r); }).catch(() => undefined);
  }, [loan.id, loan.borrowerSignedAt]);
  const [lenderLink, setLenderLink] = useState<string | undefined>(loan.lenderPaymentLink || undefined);
  const [lenderDelayRate, setLenderDelayRate] = useState<number | undefined>(isLender ? profile?.delayRate : undefined);
  useEffect(() => {
    if (isLender) { if (profile?.paymentLink) setLenderLink(profile.paymentLink); return; }
    if (loan.lenderUid) getLenderCard(loan.lenderUid).then(c => { if (c?.paymentLink) setLenderLink(c.paymentLink); if (c?.delayRate) setLenderDelayRate(c.delayRate); });
  }, [loan.lenderUid, isLender, profile?.paymentLink]);
  // Ce qu'il faut régler maintenant : l'arriéré et ses intérêts, sinon la prochaine échéance.
  const dueNow = Math.round((s.isOverdue ? s.overdueAmount + s.lateInterest + s.penalty : (s.nextInstallment ? s.nextInstallment.outstanding + s.lateInterest + s.penalty : s.totalDueNow)) * 100) / 100;
  // Échéance d'origine d'où courent les intérêts de retard (report accordé en les maintenant)
  const lateSince = s.schedule.find(i => i.outstanding > 0.004 && i.lateFrom)?.lateFrom;
  const [keepLate, setKeepLate] = useState(true);
  const unpaidFrom = s.schedule.find(i => i.outstanding > 0.004);
  const delayCost = (() => {
    if (!lateRate || !delayDate || !unpaidFrom) return 0;
    const start = unpaidFrom.lateFrom || unpaidFrom.dueDate;
    const days = Math.max(0, Math.round((new Date(delayDate).getTime() - new Date(start).getTime()) / 86400000));
    const base = s.schedule.filter(i => i.outstanding > 0.004 && (i.lateFrom || i.dueDate) < delayDate).reduce((a, i) => a + i.outstanding, 0);
    return Math.round(base * lateRate / 100 * days / 365 * 100) / 100;
  })();
  // Taux de report : fixé par le prêteur, appliqué automatiquement à toute nouvelle date proposée
  // (jamais moins que le taux du contrat, jamais plus que le seuil de l'usure du montant prêté).
  const delayRate = Math.min(rateCapFor(loan.amount, loan.currency), Math.max(lateRate, loan.delayRate || lenderDelayRate || 0));
  const delayRateApplies = delayRate > lateRate;
  /** Ce que le proche devra payer à une date donnée : sommes dues à cette date + intérêts de retard courus au taux de report. */
  const quoteAt = (date?: string) => {
    if (!date) return null;
    const simulated = delayRateApplies ? { ...loan, schedule: (loan.schedule || []).map(i => ({ ...i, lateRate: delayRate })) } : loan;
    const q = computeSituation(simulated, LEGAL_INTEREST_RATE, new Date(date + 'T12:00:00'));
    const principal = Math.round(q.schedule.filter(i => i.dueDate <= date || (i.lateFrom && i.lateFrom <= date)).reduce((a, i) => a + i.outstanding, 0) * 100) / 100 || q.overdueAmount;
    const interest = Math.round(q.lateInterest * 100) / 100;
    const penalty = Math.round(q.penalty * 100) / 100;
    const start = unpaidFrom ? (unpaidFrom.lateFrom || unpaidFrom.dueDate) : undefined;
    return { principal, interest, penalty, total: Math.round((principal + interest + penalty) * 100) / 100, start };
  };
  const QuoteTable: React.FC<{ date: string }> = ({ date }) => {
    const q = quoteAt(date);
    if (!q) return null;
    const rows: [string, string][] = [
      ['Nouvelle date', dateFr(date)],
      ['Somme due', euro2(q.principal, loan.currency)],
      ...(loan.interestRate ? [['Intérêts du prêt', `${loan.interestRate.toLocaleString('fr-FR')} % par an (compris dans les échéances)`] as [string, string]] : []),
      delayRateApplies
        ? ['Taux de report', `${delayRate.toLocaleString('fr-FR')} % par an au lieu de ${lateRate.toLocaleString('fr-FR')} %${q.start ? `, depuis le ${dateFr(q.start, { day: 'numeric', month: 'long' })}` : ''}`]
        : ['Taux de retard', lateRate ? `${lateRate.toLocaleString('fr-FR')} % par an${loan.lateRateMode === 'legal' ? ' (taux légal)' : ''}${q.start ? `, depuis le ${dateFr(q.start, { day: 'numeric', month: 'long' })}` : ''}` : 'Aucun'],
      ...(q.penalty > 0 ? [['Pénalité forfaitaire', `${euro2(q.penalty, loan.currency)} (${(loan.penaltyRate || 0).toLocaleString('fr-FR')} %, due une fois)`] as [string, string]] : []),
      ['Intérêts de retard', euro2(q.interest, loan.currency)],
      ['Total à payer', euro2(q.total, loan.currency)],
    ];
    return (
      <div className="rounded-2xl overflow-hidden mt-3" style={{ border: `1px solid ${C.line}` }}>
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between gap-3 px-3.5 py-2.5 text-sm" style={{ borderTop: i ? `1px solid ${C.line}` : undefined, background: i === rows.length - 1 ? C.soft : '#fff', fontWeight: i === rows.length - 1 ? 700 : 400 }}>
            <span style={{ color: i === rows.length - 1 ? C.ink : C.mute }}>{k}</span><span className="text-right">{v}</span>
          </div>
        ))}
      </div>
    );
  };
  const payLink = payUrl(lenderLink, dueNow, loan.currency);
  const dailyLate = lateRate && s.overdueAmount > 0 ? Math.round(s.overdueAmount * lateRate / 100 / 365 * 100) / 100 : 0;

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); setToast(ok); setSheet(null); onChanged(); }
    catch (e) { console.error(e); setToast("Ça n'a pas marché, réessaie."); }
    finally { setBusy(null); }
  };

  if (showContract) return <ContractPreview loan={loan} onClose={() => setShowContract(false)} />;

  const declared = (loan.payments || []).filter(p => p.status === 'declared');
  const history = (loan.payments || []).filter(p => p.status !== 'rejected').slice().sort((a, b) => b.date.localeCompare(a.date));
  const reminderText = pending
    ? `Salut ${other}, petit rappel : le contrat pour les ${euro2(loan.amount, loan.currency)} t'attend ici : ${loan.inviteToken ? inviteLinkFor(loan.inviteToken) : window.location.origin}`
    : s.isOverdue
      ? `Salut ${other}, sauf erreur, ${euro2(s.overdueAmount, loan.currency)} étaient prévus le ${s.schedule.find(i => i.isOverdue) ? dateFr(s.schedule.find(i => i.isOverdue)!.dueDate) : ''} pour notre prêt${s.penalty > 0 ? `, + ${euro2(s.penalty, loan.currency)} de pénalité de retard` : ''}${s.lateInterest > 0 ? ` (+ ${euro2(s.lateInterest, loan.currency)} d'intérêts de retard à ce jour)` : ''}.${payLink ? ` Tu peux régler ici : ${payLink}` : ''} Le détail est sur ${window.location.origin}`
      : `Salut ${other}, petit rappel : prochaine échéance de ${euro2(s.nextInstallment?.outstanding || 0, loan.currency)} le ${s.nextInstallment ? dateFr(s.nextInstallment.dueDate) : ''}.${payLink ? ` Pour régler : ${payLink}` : ''}`;
  const wa = `https://wa.me/${loan.borrowerPhone || ''}?text=${encodeURIComponent(reminderText)}`;

  return (
    <Screen>
      <TopBar onBack={onBack} title={isLender ? `Prêt à ${other}` : `Prêt de ${other}`} />

      {loan.status === 'requested' || loan.status === 'declined' ? null : pending ? (
        <div className="px-6 pt-3 flex items-center gap-4">
          <Avatar name={other} size={56} />
          <div>
            <div className="text-sm" style={{ color: C.mute }}>En attente de signature</div>
            <Amount size={34}>{euro2(loan.amount, loan.currency)}</Amount>
          </div>
        </div>
      ) : (
        <div className="px-6 pt-3 flex items-center gap-5">
          <Ring done={s.schedule.filter(i => i.outstanding <= 0.004).length} total={s.schedule.length} />
          <div className="min-w-0">
            <div className="text-sm" style={{ color: C.mute }}>{isLender ? 'Reste à recevoir' : 'Reste à rembourser'}</div>
            <Amount size={34}>{euro2(s.totalDueNow, loan.currency)}</Amount>
            <div className="text-[13px] mt-0.5" style={{ color: C.mute }}>sur {euro2(loan.amount, loan.currency)} {isLender ? 'prêtés' : 'reçus'} le {dateFr(loan.loanDate, { day: 'numeric', month: 'short' })}</div>
          </div>
        </div>
      )}

      {!isLender && (loan.status === 'requested' || loan.status === 'declined') ? (
        <div className="px-5 pt-2 flex flex-col gap-3">
          <div className="px-1">
            <div className="text-sm" style={{ color: C.mute }}>Ta demande</div>
            <Amount size={40}>{euro2(loan.amount, loan.currency)}</Amount>
          </div>
          <Note tone={loan.status === 'declined' ? 'warn' : 'info'} icon="clock">
            {loan.status === 'declined'
              ? `${other} n'a pas pu accepter cette demande.`
              : `Envoyée le ${dateFr(loan.createdAt, { day: 'numeric', month: 'long' })}. ${other} doit l'accepter ; tu seras prévenu dès qu'il répond. Le contrat sera alors disponible ici.`}
          </Note>
          <Card className="px-4 py-3">
            {(loan.schedule || []).map((i, idx) => (
              <div key={i.index} className="flex justify-between text-[15px] py-1.5" style={{ borderTop: idx ? `1px solid ${C.line}` : undefined }}>
                <span>{dateFr(i.dueDate, { day: 'numeric', month: 'long' })}</span>
                <span className="font-semibold tabular-nums">{euro2(i.amount, loan.currency)}</span>
              </div>
            ))}
          </Card>
        </div>
      ) : (<>
      {/* Actions */}
      <div className={`px-6 pt-6 grid ${isLender && pending ? "grid-cols-3" : "grid-cols-4"} gap-2`}>
        {isLender ? (
          <>
            {!pending && <Action icon="check" label="Encaisser" primary onClick={() => setSheet('pay')} />}
            {pending ? <Action icon="chat" label="Relancer" href={wa} onClick={() => undefined} />
              : <Action icon="chat" label="Relancer" onClick={() => setSheet('remind')} />}
            <Action icon="file" label="Contrat" onClick={() => setShowContract(true)} />
            <Action icon="dots" label="Plus" onClick={() => setSheet('more')} />
          </>
        ) : (
          <>
            <Action icon="check" label="J'ai payé" primary onClick={() => setSheet('pay')} />
            <Action icon="calendar" label="Délai" onClick={() => setSheet('delay')} />
            <Action icon="file" label="Contrat" onClick={() => setShowContract(true)} />
            {payLink ? <Action icon="arrow" label="Payer" href={payLink} onClick={() => undefined} /> : <div />}
          </>
        )}
      </div>

      <div className="px-5 pt-5 flex flex-col gap-2.5">
        {!isLender && !pending && loan.status !== 'paid' && !s.isFullyPaid && (
          <Card className="p-4">
            {s.isOverdue ? (
              <>
                <div className="text-[15px] font-semibold" style={{ color: C.red }}>En retard de {s.daysLate} jour{s.daysLate > 1 ? 's' : ''}</div>
                <div className="text-sm mt-1 leading-relaxed" style={{ color: C.text2 }}>
                  {euro2(s.overdueAmount, loan.currency)} à régler{s.penalty > 0 ? <>, plus <strong>{euro2(s.penalty, loan.currency)}</strong> de pénalité de retard</> : ''}{s.lateInterest > 0 ? <>, plus <strong>{euro2(s.lateInterest, loan.currency)}</strong> d'intérêts de retard</> : ''}.
                  {dailyLate > 0 && <> Chaque jour de retard ajoute environ {euro2(dailyLate, loan.currency)}.</>}
                </div>
              </>
            ) : s.nextInstallment && (
              <>
                <div className="text-[15px] font-semibold">Prochaine échéance {relDays(s.nextInstallment.dueDate)}</div>
                <div className="text-sm mt-1 leading-relaxed" style={{ color: C.text2 }}>
                  {euro2(s.nextInstallment.outstanding, loan.currency)} le {dateFr(s.nextInstallment.dueDate)}.
                  {s.lateInterest > 0 && lateSince
                    ? <> S'y ajoutent <strong>{euro2(s.lateInterest, loan.currency)}</strong> d'intérêts de retard courus depuis le {dateFr(lateSince, { day: 'numeric', month: 'long' })}, qui augmentent jusqu'au paiement.</>
                    : lateRate ? <> Passé cette date, des intérêts de retard de {lateRate.toLocaleString('fr-FR')} % par an s'appliquent.</> : null}
                </div>
              </>
            )}
            {payLink && (
              <a href={payLink} target="_blank" rel="noopener noreferrer" className="mt-3 h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-white" style={{ background: C.ink }}>
                Payer {euro2(dueNow, loan.currency)} avec {payProvider(lenderLink)}
              </a>
            )}
            <div className="text-xs mt-2" style={{ color: C.mute }}>Une fois payé, appuie sur « J'ai payé » pour que {other} le confirme.</div>
          </Card>
        )}
        {isLender && loan.status === 'active' && !loan.fundsSentAt && !(loan.payments || []).length && loan.loanDate >= (loan.createdAt || '').slice(0, 10) && (
          <Card className="p-4">
            <div className="text-[15px] font-semibold">Envoie {euro2(loan.amount, loan.currency)} à {other}</div>
            {(() => {
              const rcv = loan.borrowerReceive || (loan.borrowerPaymentLink ? { method: (/paypal/i.test(loan.borrowerPaymentLink) ? 'paypal' : 'lien') as 'paypal' | 'lien', value: loan.borrowerPaymentLink } : null);
              const isEmail = rcv?.method === 'paypal' && /@/.test(rcv.value);
              const url = rcv && rcv.method !== 'virement' && !isEmail ? payUrl(rcv.value, loan.amount, loan.currency) : null;
              const copy = (text: string, msg: string) => { navigator.clipboard?.writeText(text); setToast(msg); };
              const ask = `https://wa.me/${(loan.borrowerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Salut ${other}, c'est validé pour les ${euro2(loan.amount, loan.currency)}. Envoie-moi ton PayPal ou ton RIB et je t'envoie ça.`)}`;
              return (
                <>
                  <div className="text-sm mt-1 leading-relaxed" style={{ color: C.text2 }}>
                    {!rcv ? <>Il n'a pas indiqué où recevoir l'argent. Demande-lui son PayPal ou son RIB.</>
                      : rcv.method === 'virement' ? (
                        <span className="flex flex-col gap-0.5">
                          <span>Par virement instantané :</span>
                          <span className="font-mono font-semibold" style={{ color: C.ink }}>{formatIban(rcv.value)}</span>
                          <span>Titulaire : {rcv.holder}{rcv.bic ? ` · BIC ${rcv.bic}` : ''}</span>
                        </span>)
                      : isEmail ? <>Par PayPal, à l'adresse <strong>{rcv.value}</strong>. Ouvre ton appli PayPal et envoie-lui {euro2(loan.amount, loan.currency)}.</>
                      : <>Il veut le recevoir sur {payProvider(rcv.value)}. Le montant est déjà rempli.</>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {!rcv ? <a href={ask} target="_blank" rel="noopener noreferrer" className="h-12 rounded-[14px] flex items-center justify-center text-[15px] font-bold text-white" style={{ background: C.green }}>Lui demander</a>
                      : rcv.method === 'virement' ? <Button onClick={() => copy(rcv.value.replace(/\s/g, ''), 'IBAN copié')}>Copier l'IBAN</Button>
                      : isEmail ? <Button onClick={() => copy(rcv.value, 'Adresse PayPal copiée')}>Copier l'adresse</Button>
                      : <a href={url!} target="_blank" rel="noopener noreferrer" className="h-12 rounded-[14px] flex items-center justify-center text-[15px] font-bold text-white" style={{ background: C.ink }}>Envoyer</a>}
                    <button disabled={busy === 'sent'} onClick={() => run('sent', () => markFundsSent(loan), "Noté, c'est envoyé")} className="h-12 rounded-[14px] text-[15px] font-bold" style={{ background: C.soft, color: C.ink }}>C'est envoyé</button>
                  </div>
                </>
              );
            })()}
          </Card>
        )}
        {isLender && contractCheck === 'mismatch' && (
          <Note tone="danger" icon="alert">Le texte du contrat enregistré lors de la signature de {other} ne correspond pas aux conditions que tu as signées. Ne te fie pas à ce document : compare-le avec les conditions affichées ici et demande-lui de signer à nouveau.</Note>
        )}
        {pending && isLender && <Note icon="clock">{other} n'a pas encore signé. Tu peux lui renvoyer le lien avec « Relancer ».</Note>}
        {loan.status === 'delay_requested' && loan.delayProposedDate && (
          <Card className="p-4">
            <div className="text-[15px] font-semibold">{isLender ? `${other} demande un délai` : 'Délai demandé'}</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>{isLender ? `${other} propose de payer le ${dateFr(loan.delayProposedDate)}. Voici ce que ça représente :` : `Tu as proposé de payer le ${dateFr(loan.delayProposedDate)}.`}</div>
            <QuoteTable date={loan.delayProposedDate} />
            {isLender && (lateRate > 0 || delayRateApplies) && (
              <label className="flex items-start gap-2.5 mt-3 text-sm leading-snug cursor-pointer">
                <input type="checkbox" checked={keepLate} onChange={e => setKeepLate(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1C2551]" />
                <span>{delayRateApplies ? `Taux de report de ${delayRate.toLocaleString('fr-FR')} %, ` : 'Les intérêts de retard continuent de courir '}depuis l'échéance d'origine{unpaidFrom ? ` (${dateFr(unpaidFrom.lateFrom || unpaidFrom.dueDate, { day: 'numeric', month: 'long' })})` : ''} jusqu'au paiement.</span>
              </label>
            )}
            {isLender && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button busy={busy === 'dy'} onClick={() => run('dy', () => respondToDelay(loan, true, (lateRate > 0 || delayRateApplies) && keepLate, delayRateApplies ? delayRate : undefined), 'Délai accepté')}>Accepter</Button>
                <Button variant="danger" busy={busy === 'dn'} onClick={() => run('dn', () => respondToDelay(loan, false), 'Délai refusé')}>Refuser</Button>
              </div>
            )}
          </Card>
        )}
        {declared.map((p: Payment) => (
          <Card key={p.id} className="p-4">
            <div className="text-[15px] font-semibold">{isLender ? `${other} dit avoir payé ${euro2(p.amount, loan.currency)}` : `Paiement de ${euro2(p.amount, loan.currency)} en attente`}</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>{dateFr(p.date)} · {p.method}{isLender ? '' : ` · ${other} doit confirmer l'avoir reçu`}</div>
            {isLender && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button busy={busy === p.id} onClick={() => run(p.id, () => reviewPayment(loan.id, p.id, true), 'Paiement confirmé')}>Reçu</Button>
                <Button variant="danger" busy={busy === p.id + 'x'} onClick={() => run(p.id + 'x', () => reviewPayment(loan.id, p.id, false), 'Marqué non reçu')}>Pas reçu</Button>
              </div>
            )}
          </Card>
        ))}
        {isLender && s.isFullyPaid && loan.status !== 'paid' && !pending && (
          <Button variant="secondary" busy={busy === 'close'} onClick={() => run('close', () => markLoanPaid(loan.id), 'Prêt soldé')}>Clôturer le prêt (tout est remboursé)</Button>
        )}
      </div>

      <div className="px-6 pt-6 pb-2.5 text-[17px] font-bold">Échéances</div>
      <div className="mx-5">
        <Card>
          {s.schedule.map((i, idx) => {
            const paid = i.outstanding <= 0.004;
            const dot = paid ? C.green : i.isOverdue ? C.red : idx === s.schedule.findIndex(x => x.outstanding > 0.004) ? C.ochre : '#D9D2C3';
            const note = paid ? 'Payée' : i.isOverdue ? `En retard de ${i.daysLate} j` : relDays(i.dueDate);
            return (
              <div key={i.index} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx ? `1px solid ${C.line}` : undefined }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">{dateFr(i.dueDate, { day: 'numeric', month: 'long' })}</div>
                  <div className="text-[13px]" style={{ color: paid ? C.green : i.isOverdue ? C.red : C.mute }}>{note}</div>
                </div>
                <div className="text-[15px] font-semibold tabular-nums">{euro2(i.amount, loan.currency)}</div>
              </div>
            );
          })}
        </Card>
        <div className="text-xs mt-2 px-1 leading-relaxed" style={{ color: C.mute }}>
          {loan.interestRate ? `${loan.interestRate.toLocaleString('fr-FR')} % d'intérêt par an` : 'Sans intérêt'} · {lateRate ? `retard : ${lateRate.toLocaleString('fr-FR')} % par an sur les sommes échues` : 'pas de pénalité de retard'} · remboursement anticipé sans frais
          {s.lateInterest > 0 && ` · intérêts de retard courus : ${euro2(s.lateInterest, loan.currency)}`}{loan.penaltyRate ? ` · pénalité forfaitaire : ${loan.penaltyRate.toLocaleString('fr-FR')} % des sommes impayées à l'échéance` : ''}{s.penalty > 0 ? ` (${euro2(s.penalty, loan.currency)} dus)` : ''}
        </div>
      </div>

      {history.length > 0 && (
        <>
          <div className="px-6 pt-6 pb-2.5 text-[17px] font-bold">Activité</div>
          <div className="px-6 pb-8 flex flex-col gap-3">
            {history.map(p => (
              <div key={p.id} className="flex gap-3 text-sm">
                <div className="w-16 shrink-0" style={{ color: C.mute }}>{dateFr(p.date, { day: 'numeric', month: 'short' })}</div>
                <div>{euro2(p.amount, loan.currency)} · {p.method} · <span style={{ color: p.status === 'confirmed' ? C.green : C.ochreText, fontWeight: 600 }}>{p.status === 'confirmed' ? 'confirmé' : 'à confirmer'}</span></div>
              </div>
            ))}
            {loan.borrowerSignedAt && (
              <div className="flex gap-3 text-sm">
                <div className="w-16 shrink-0" style={{ color: C.mute }}>{dateFr(loan.borrowerSignedAt, { day: 'numeric', month: 'short' })}</div>
                <div>Contrat signé par vous deux</div>
              </div>
            )}
          </div>
        </>
      )}
      </>)}
      <div className="h-8" />

      {/* Paiement */}
      <Sheet open={sheet === 'pay'} onClose={() => setSheet(null)} title={isLender ? 'Enregistrer un paiement reçu' : 'Déclarer un paiement'}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant" htmlFor="pa"><input id="pa" type="number" inputMode="decimal" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={inputClass} style={inputStyle} /></Field>
            <Field label="Date" htmlFor="pd"><input id="pd" type="date" value={payDate} max={toISODate(new Date())} onChange={e => setPayDate(e.target.value)} className={inputClass} style={inputStyle} /></Field>
          </div>
          <Field label="Moyen" htmlFor="pm">
            <select id="pm" value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputClass} style={inputStyle}>
              {['Virement', 'Revolut', 'PayPal', 'Lydia', 'Espèces', 'Autre'].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          {!isLender && <Note>{other} confirmera l'avoir reçu ; sa confirmation vaut quittance.</Note>}
          <Button busy={busy === 'pay'} disabled={!(parseFloat(payAmount) > 0)} onClick={() => run('pay', () => isLender
            ? recordPaymentByLender(loan, { amount: parseFloat(payAmount), date: payDate, method: payMethod })
            : declarePayment(loan, { amount: parseFloat(payAmount), date: payDate, method: payMethod }), isLender ? 'Paiement enregistré' : 'Paiement déclaré')}>
            {isLender ? 'Enregistrer' : 'Déclarer'}
          </Button>
        </div>
      </Sheet>

      {/* Délai */}
      <Sheet open={sheet === 'delay'} onClose={() => setSheet(null)} title="Proposer une nouvelle date">
        <div className="flex flex-col gap-4">
          <Field label="Nouvelle date souhaitée" htmlFor="dd"><input id="dd" type="date" min={toISODate(new Date())} value={delayDate} onChange={e => setDelayDate(e.target.value)} className={inputClass} style={inputStyle} /></Field>
          {delayDate && <QuoteTable date={delayDate} />}
          {lateRate > 0 || delayRateApplies ? (
            <Note tone="warn">
              En proposant cette date, tu acceptes {delayRateApplies ? <>le taux de report de <strong>{delayRate.toLocaleString('fr-FR')} % par an</strong> fixé par {other}, appliqué depuis l'échéance manquée</> : <>que les intérêts de retard ({lateRate.toLocaleString('fr-FR')} % par an) continuent de courir</>} jusqu'au paiement. {other} reçoit ta proposition avec ce détail, et l'accepte ou la refuse.
            </Note>
          ) : <Note>{other} reçoit ta proposition et l'accepte ou la refuse.</Note>}
          <Button disabled={!delayDate || loan.status !== 'active'} busy={busy === 'delay'} onClick={() => run('delay', () => requestDelay(loan, delayDate, quoteAt(delayDate) || undefined, delayRate), 'Proposition envoyée')}>Envoyer la proposition</Button>
        </div>
      </Sheet>

      {/* Plus */}
      <Sheet open={sheet === 'remind'} onClose={() => setSheet(null)} title={`Relancer ${other}`}>
        <div className="flex flex-col gap-2.5">
          <Button busy={busy === 'remind'} onClick={async () => {
            setBusy('remind');
            try {
              const r = await sendReminderNow(loan.id);
              setToast(r.status === 200 ? `Rappel envoyé${r.data.mailed ? ' par e-mail' : ''}${r.data.pushed ? (r.data.mailed ? ' et notification' : ' par notification') : ''}${!r.data.mailed && !r.data.pushed ? ' dans son appli' : ''}`
                : r.status === 429 ? "Déjà relancé aujourd'hui" : r.status === 409 ? "Il n'a pas encore signé" : "Le rappel n'a pas pu partir");
              setSheet(null);
            } catch { setToast("Le rappel n'a pas pu partir"); }
            setBusy(null);
          }}>Envoyer un rappel maintenant</Button>
          <div className="text-[13px] text-center -mt-1" style={{ color: C.mute }}>Par notification et par e-mail, avec le bouton Payer. Un par jour au plus.</div>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white" style={{ background: C.green }}>
            <Icon name="chat" /> Relancer sur WhatsApp
          </a>
        </div>
      </Sheet>

      <Sheet open={sheet === 'more'} onClose={() => { setSheet(null); setConfirmDel(false); }} title="Plus">
        <div className="flex flex-col gap-2.5">
          {pending && loan.inviteToken && (
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(inviteLinkFor(loan.inviteToken!)); setToast('Lien copié'); setSheet(null); }}>Copier le lien de signature</Button>
          )}
          {pending && isLender && !loan.borrowerSignedAt && onEdit && (
            <Button variant="secondary" onClick={() => { setSheet(null); onEdit(loan); }}>Modifier les conditions</Button>
          )}
          <Button variant="secondary" onClick={() => { setSheet(null); setShowContract(true); }}>Voir ou télécharger le contrat</Button>
          {pending && (
            confirmDel ? (
              <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: C.redSoft }}>
                <div className="text-[15px] font-semibold" style={{ color: C.red }}>Supprimer définitivement ce contrat non signé ?</div>
                <div className="text-sm" style={{ color: C.text2 }}>Le lien envoyé à {other} ne fonctionnera plus. Cette action est irréversible.</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setConfirmDel(false)}>Annuler</Button>
                  <button disabled={busy === 'del'} onClick={() => run('del', async () => { await deleteOffer(loan); onBack(); }, 'Contrat supprimé')}
                    className="h-14 rounded-2xl text-base font-bold text-white disabled:opacity-50" style={{ background: C.red }}>{busy === 'del' ? 'Suppression…' : 'Supprimer'}</button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDel(true)}>Supprimer ce contrat non signé</Button>
            )
          )}
        </div>
      </Sheet>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default LoanDetail;
