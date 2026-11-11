import React, { useEffect, useState } from 'react';
import { Loan, Payment, Profile, User } from '../../types';
import { Screen, TopBar, Amount, Button, Card, Field, inputClass, inputStyle, Note, Sheet, Icon, IconName, C, euro2, dateFr, relDays, firstName, Avatar, Toast } from './ui';
import { computeSituation, effectiveLateRate, toISODate } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../../config/legal';
import {
  recordPaymentByLender, reviewPayment, markLoanPaid, declarePayment, requestDelay, respondToDelay, deleteOffer, inviteLinkFor,
  getLenderCard, payUrl, payProvider,
} from '../../services/loanService';
import ContractPreview from '../ContractPreview';

interface Props {
  loan: Loan;
  user: User;
  profile: Profile | null;
  onBack: () => void;
  onChanged: () => void;
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

const LoanDetail: React.FC<Props> = ({ loan, user, profile, onBack, onChanged }) => {
  const isLender = loan.lenderUid === user.id;
  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  const lateRate = effectiveLateRate(loan, LEGAL_INTEREST_RATE);
  const other = isLender ? (loan.borrowerNickname || firstName(loan.borrowerName)) : firstName(loan.lenderName);
  const pending = loan.status === 'pending_borrower';
  const [sheet, setSheet] = useState<null | 'pay' | 'delay' | 'more'>(null);
  const [showContract, setShowContract] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(String(s.isOverdue ? Math.round((s.overdueAmount + s.lateInterest) * 100) / 100 : (s.nextInstallment?.outstanding ?? s.totalDueNow)));
  const [payDate, setPayDate] = useState(toISODate(new Date()));
  const [payMethod, setPayMethod] = useState('Virement');
  const [delayDate, setDelayDate] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [lenderLink, setLenderLink] = useState<string | undefined>(loan.lenderPaymentLink || undefined);
  useEffect(() => {
    if (isLender) { if (profile?.paymentLink) setLenderLink(profile.paymentLink); return; }
    if (loan.lenderUid) getLenderCard(loan.lenderUid).then(c => { if (c?.paymentLink) setLenderLink(c.paymentLink); });
  }, [loan.lenderUid, isLender, profile?.paymentLink]);
  // Ce qu'il faut régler maintenant : l'arriéré et ses intérêts, sinon la prochaine échéance.
  const dueNow = Math.round((s.isOverdue ? s.overdueAmount + s.lateInterest : (s.nextInstallment ? s.nextInstallment.outstanding + s.lateInterest : s.totalDueNow)) * 100) / 100;
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
      ? `Salut ${other}, sauf erreur, ${euro2(s.overdueAmount, loan.currency)} étaient prévus le ${s.schedule.find(i => i.isOverdue) ? dateFr(s.schedule.find(i => i.isOverdue)!.dueDate) : ''} pour notre prêt${s.lateInterest > 0 ? ` (+ ${euro2(s.lateInterest, loan.currency)} d'intérêts de retard à ce jour)` : ''}.${payLink ? ` Tu peux régler ici : ${payLink}` : ''} Le détail est sur ${window.location.origin}`
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
            <Action icon="chat" label="Relancer" href={wa} onClick={() => undefined} />
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
                  {euro2(s.overdueAmount, loan.currency)} à régler{s.lateInterest > 0 ? <>, plus <strong>{euro2(s.lateInterest, loan.currency)}</strong> d'intérêts de retard</> : ''}.
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
        {pending && isLender && <Note icon="clock">{other} n'a pas encore signé. Tu peux lui renvoyer le lien avec « Relancer ».</Note>}
        {loan.status === 'delay_requested' && loan.delayProposedDate && (
          <Card className="p-4">
            <div className="text-[15px] font-semibold">{isLender ? `${other} demande un délai` : 'Délai demandé'}</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>Report des échéances impayées au {dateFr(loan.delayProposedDate)}.</div>
            {isLender && lateRate > 0 && (
              <label className="flex items-start gap-2.5 mt-3 text-sm leading-snug cursor-pointer">
                <input type="checkbox" checked={keepLate} onChange={e => setKeepLate(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1C2551]" />
                <span>Les intérêts de retard continuent de courir depuis l'échéance d'origine{unpaidFrom ? ` (${dateFr(unpaidFrom.lateFrom || unpaidFrom.dueDate, { day: 'numeric', month: 'long' })})` : ''} jusqu'au paiement.</span>
              </label>
            )}
            {isLender && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button busy={busy === 'dy'} onClick={() => run('dy', () => respondToDelay(loan, true, lateRate > 0 && keepLate), 'Délai accepté')}>Accepter</Button>
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
          {s.lateInterest > 0 && ` · intérêts de retard courus : ${euro2(s.lateInterest, loan.currency)}`}
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
      <Sheet open={sheet === 'delay'} onClose={() => setSheet(null)} title="Demander un délai">
        <div className="flex flex-col gap-4">
          <Field label="Nouvelle date souhaitée" htmlFor="dd"><input id="dd" type="date" min={toISODate(new Date())} value={delayDate} onChange={e => setDelayDate(e.target.value)} className={inputClass} style={inputStyle} /></Field>
          {lateRate > 0 ? (
            <Note tone="warn">
              Si {other} accepte, les échéances impayées sont reportées à cette date. En demandant ce délai, tu acceptes que les intérêts de retard
              ({lateRate.toLocaleString('fr-FR')} % par an) continuent de courir depuis le {unpaidFrom ? dateFr(unpaidFrom.lateFrom || unpaidFrom.dueDate, { day: 'numeric', month: 'long' }) : ''} jusqu'au paiement
              {delayDate && delayCost > 0 ? <> : environ <strong>{euro2(delayCost, loan.currency)}</strong> si tu paies le {dateFr(delayDate, { day: 'numeric', month: 'long' })}</> : null}.
            </Note>
          ) : <Note>Si {other} accepte, les échéances impayées sont reportées à cette date.</Note>}
          <Button disabled={!delayDate || loan.status !== 'active'} busy={busy === 'delay'} onClick={() => run('delay', () => requestDelay(loan, delayDate), 'Demande envoyée')}>Envoyer la demande</Button>
        </div>
      </Sheet>

      {/* Plus */}
      <Sheet open={sheet === 'more'} onClose={() => { setSheet(null); setConfirmDel(false); }} title="Plus">
        <div className="flex flex-col gap-2.5">
          {pending && loan.inviteToken && (
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(inviteLinkFor(loan.inviteToken!)); setToast('Lien copié'); setSheet(null); }}>Copier le lien de signature</Button>
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
