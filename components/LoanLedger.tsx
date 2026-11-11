import React, { useState } from 'react';
import { Loan } from '../types';
import { X, CheckCircle2, XCircle, Clock, Loader2, Plus, Receipt, AlertTriangle } from 'lucide-react';
import { computeSituation, effectiveLateRate, formatMoney, parseISODate, toISODate } from '../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../config/legal';
import { recordPaymentByLender, reviewPayment, markLoanPaid } from '../services/loanService';

interface LoanLedgerProps {
  loan: Loan;
  isLender: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString('fr-FR');

/** Échéancier, paiements et intérêts de retard d'un prêt. Le prêteur y confirme les paiements. */
const LoanLedger: React.FC<LoanLedgerProps> = ({ loan, isLender, onClose, onChanged }) => {
  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  const lateRate = effectiveLateRate(loan, LEGAL_INTEREST_RATE);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: s.nextInstallment ? String(s.nextInstallment.outstanding) : String(s.totalDueNow),
    date: toISODate(new Date()),
    method: 'Virement',
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      onChanged();
    } catch (e) {
      console.error(e);
      alert("L'opération a échoué. Vérifiez votre connexion et vos droits sur ce prêt.");
    } finally {
      setBusy(null);
    }
  };

  const payments = (loan.payments || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="font-black text-slate-900 text-lg">Suivi du prêt — {isLender ? loan.borrowerName : loan.lenderName}</h2>
            <p className="text-xs text-slate-400 font-medium">
              {formatMoney(loan.amount, loan.currency)} · {loan.interestRate ? `${loan.interestRate} %/an` : 'sans intérêt'} · retard : {lateRate ? `${lateRate.toLocaleString('fr-FR')} %/an` : 'aucun'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Total prévu', formatMoney(s.totalScheduled, loan.currency), 'text-slate-900'],
              ['Reçu (confirmé)', formatMoney(s.confirmedPaid, loan.currency), 'text-emerald-600'],
              ['Intérêts de retard', formatMoney(s.lateInterest, loan.currency), s.lateInterest > 0 ? 'text-rose-600' : 'text-slate-400'],
              ['Reste dû', formatMoney(s.totalDueNow, loan.currency), s.isOverdue ? 'text-rose-600' : 'text-indigo-600'],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-slate-50 rounded-2xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className={`font-black text-sm sm:text-base ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {s.pendingDeclared > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-800 font-bold">
              {formatMoney(s.pendingDeclared, loan.currency)} déclarés par l'emprunteur, en attente de confirmation.
            </div>
          )}

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Échéancier</h3>
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[10px]">
                  <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Montant</th><th className="p-2 text-right">Payé</th><th className="p-2 text-right">État</th></tr>
                </thead>
                <tbody>
                  {s.schedule.map(i => (
                    <tr key={i.index} className="border-t border-slate-100">
                      <td className="p-2 text-slate-400">{i.index}</td>
                      <td className="p-2 font-medium text-slate-700">{fmt(i.dueDate)}</td>
                      <td className="p-2 text-right font-bold text-slate-900">{formatMoney(i.amount, loan.currency)}</td>
                      <td className="p-2 text-right text-slate-500">{formatMoney(i.paid, loan.currency)}</td>
                      <td className="p-2 text-right">
                        {i.outstanding <= 0.004
                          ? <span className="text-emerald-600 font-bold">Payée</span>
                          : i.isOverdue
                            ? <span className="text-rose-600 font-bold">Retard {i.daysLate} j</span>
                            : <span className="text-slate-400">À venir</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lateRate > 0 && (
              <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
                Intérêts de retard : {lateRate.toLocaleString('fr-FR')} % par an, calculés chaque jour sur les échéances échues et impayées
                (montant × taux ÷ 365 × jours). Les paiements s'imputent d'abord sur ces intérêts, puis sur les échéances les plus anciennes.
              </p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Paiements</h3>
              {isLender && loan.status !== 'pending_borrower' && (
                <button onClick={() => setShowAdd(!showAdd)} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                  <Plus size={14} /> Enregistrer un paiement reçu
                </button>
              )}
            </div>

            {showAdd && (
              <div className="p-4 mb-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input type="number" step="0.01" min="0" value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Montant" />
                <input type="date" value={newPayment.date} onChange={e => setNewPayment({ ...newPayment, date: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <select value={newPayment.method} onChange={e => setNewPayment({ ...newPayment, method: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option>Virement</option><option>Paiement mobile</option><option>Espèces</option><option>Autre</option>
                </select>
                <button
                  disabled={!!busy || !(parseFloat(newPayment.amount) > 0)}
                  onClick={() => run('add', async () => {
                    await recordPaymentByLender(loan, { amount: parseFloat(newPayment.amount), date: newPayment.date, method: newPayment.method });
                    setShowAdd(false);
                  })}
                  className="py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase disabled:opacity-50"
                >
                  {busy === 'add' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Valider'}
                </button>
              </div>
            )}

            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun paiement enregistré.</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      {p.status === 'confirmed' ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : p.status === 'rejected' ? <XCircle size={18} className="text-rose-400" />
                          : <Clock size={18} className="text-purple-500" />}
                      <div>
                        <p className="text-sm font-bold text-slate-900">{formatMoney(p.amount, loan.currency)}</p>
                        <p className="text-[10px] text-slate-400">
                          {fmt(p.date)} · {p.method} · {p.status === 'confirmed' ? 'reçu confirmé (quittance)' : p.status === 'rejected' ? 'non reçu' : 'déclaré, à confirmer'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.proof && <a href={p.proof} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 flex items-center gap-1"><Receipt size={12} /> Preuve</a>}
                      {isLender && p.status === 'declared' && (
                        <>
                          <button disabled={!!busy} onClick={() => run(p.id, () => reviewPayment(loan.id, p.id, true))} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase">
                            {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer'}
                          </button>
                          <button disabled={!!busy} onClick={() => run(p.id + 'r', () => reviewPayment(loan.id, p.id, false))} className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase">
                            Non reçu
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isLender && s.isFullyPaid && loan.status !== 'paid' && (
            <button
              disabled={!!busy}
              onClick={() => run('close', () => markLoanPaid(loan.id))}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {busy === 'close' ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={18} /> Clôturer le prêt (soldé)</>}
            </button>
          )}
          {isLender && !s.isFullyPaid && loan.status !== 'pending_borrower' && (
            <p className="text-[10px] text-slate-400 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              Le prêt pourra être clôturé quand le reste dû sera nul. Vous pouvez aussi enregistrer un paiement final ou renoncer au solde en accord avec votre ami.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanLedger;
