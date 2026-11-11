import React from 'react';
import { Loan, User } from '../types';
import { Loader2, PenLine, ArrowRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { computeSituation, effectiveLateRate, formatMoney, parseISODate } from '../utils/schedule';
import { LEGAL_INTEREST_RATE, DECLARATION_THRESHOLD_EUR } from '../config/legal';

interface BorrowerHomeProps {
  loans: Loan[];
  user: User;
  loading: boolean;
  onOpen: (loan: Loan) => void;
  onSwitchToLender?: () => void;
}

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (iso: string) => parseISODate(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

/** Ce que voit un ami connecté : uniquement ses emprunts, ses échéances et les règles de son contrat. */
const LoanSummary: React.FC<{ loan: Loan; onOpen: (l: Loan) => void }> = ({ loan, onOpen }) => {
  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  const pending = loan.status === 'pending_borrower';
  const lateRate = effectiveLateRate(loan, LEGAL_INTEREST_RATE);
  const progress = s.totalScheduled > 0 ? Math.min(100, (s.confirmedPaid / s.totalScheduled) * 100) : 0;
  const monthly = s.schedule.length > 1;

  const terms: string[] = [
    loan.interestRate
      ? `Intérêts : ${loan.interestRate.toLocaleString('fr-FR')} % par an, soit ${formatMoney(s.totalInterest, loan.currency)} au total.`
      : 'Prêt sans intérêt : vous ne remboursez que la somme prêtée.',
    monthly
      ? `${s.schedule.length} mensualités de ${formatMoney(s.schedule[0].amount, loan.currency)}, du ${fmt(s.schedule[0].dueDate)} au ${fmt(s.schedule[s.schedule.length - 1].dueDate)}.`
      : `Remboursement en une fois, au plus tard le ${fmt(s.schedule[0].dueDate)}.`,
    lateRate > 0
      ? `En cas de retard : intérêts de ${lateRate.toLocaleString('fr-FR')} % par an sur les sommes échues, à partir du lendemain de l'échéance.`
      : 'Pas de pénalité de retard prévue au contrat.',
    'Remboursement anticipé possible à tout moment, sans frais.',
    'Besoin de plus de temps ? Demandez un report : il prend effet si le prêteur l’accepte.',
  ];
  if (loan.currency === 'EUR' && loan.amount > DECLARATION_THRESHOLD_EUR) {
    terms.push('Au-delà de 5 000 €, ce prêt se déclare avec vos revenus (formulaire 2062).');
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-500">Prêt de {loan.lenderName}</p>
            <h3 className="serif text-2xl sm:text-3xl font-semibold text-indigo-600 mt-1">{formatMoney(loan.amount, loan.currency)}</h3>
            <p className="text-xs text-slate-500 mt-1">reçus le {fmt(loan.loanDate)}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 ${
            pending ? 'bg-amber-100 text-amber-700'
              : s.isFullyPaid || loan.status === 'paid' ? 'bg-emerald-100 text-emerald-700'
                : s.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-600'}`}>
            {pending ? 'À signer' : s.isFullyPaid || loan.status === 'paid' ? 'Remboursé' : s.isOverdue ? `Retard ${s.daysLate} j` : 'En cours'}
          </span>
        </div>

        {pending ? (
          <button onClick={() => onOpen(loan)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700">
            <PenLine size={18} /> Lire et signer le contrat
          </button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-indigo-50 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reste à rembourser</p>
                <p className="serif text-xl font-semibold text-indigo-600">{formatMoney(s.totalDueNow, loan.currency)}</p>
              </div>
              <div className={`rounded-2xl p-4 ${s.isOverdue ? 'bg-rose-50' : 'bg-amber-50'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.isOverdue ? 'En retard' : 'Prochaine échéance'}</p>
                {s.nextInstallment ? (
                  <p className={`serif text-xl font-semibold ${s.isOverdue ? 'text-rose-600' : 'text-indigo-600'}`}>
                    {formatMoney(s.isOverdue ? s.overdueAmount + s.lateInterest : s.nextInstallment.outstanding, loan.currency)}
                    <span className="block text-xs font-sans font-bold text-slate-500 mt-0.5">{s.isOverdue ? `depuis le ${fmt(s.schedule.find(i => i.isOverdue)!.dueDate)}` : `le ${fmt(s.nextInstallment.dueDate)}`}</span>
                  </p>
                ) : <p className="serif text-xl font-semibold text-emerald-600">Aucune</p>}
              </div>
            </div>

            <div className="mb-6">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {formatMoney(s.confirmedPaid, loan.currency)} remboursés sur {formatMoney(s.totalScheduled, loan.currency)}
                {s.pendingDeclared > 0 ? ` · ${formatMoney(s.pendingDeclared, loan.currency)} en attente de confirmation` : ''}
              </p>
            </div>

            {monthly && (
              <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 mb-2">Échéances</p>
                <div className="flex flex-wrap gap-2">
                  {s.schedule.map(i => (
                    <div key={i.index} className={`px-3 py-2 rounded-xl border text-xs ${
                      i.outstanding <= 0.004 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : i.isOverdue ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>
                      <span className="font-bold">{fmtShort(i.dueDate)}</span> · {formatMoney(i.amount, loan.currency)}
                      {i.outstanding <= 0.004 && <CheckCircle2 size={12} className="inline ml-1 -mt-0.5" />}
                      {i.isOverdue && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="border-t border-slate-100 pt-5">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 mb-3">Ce que prévoit votre contrat</p>
          <ul className="space-y-2">
            {terms.map(t => (
              <li key={t} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!pending && (
        <button onClick={() => onOpen(loan)} className="w-full px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 text-sm font-bold text-indigo-600 flex items-center justify-between hover:bg-indigo-50">
          <span>Rembourser, demander un report ou télécharger le contrat</span>
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
};

const BorrowerHome: React.FC<BorrowerHomeProps> = ({ loans, user, loading, onOpen, onSwitchToLender }) => (
  <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 w-full">
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-500">Mon espace</p>
        <h2 className="serif text-3xl font-semibold text-indigo-600">Bonjour, {user.name.split(' ')[0]}</h2>
        <p className="text-slate-500 text-sm mt-1">Les prêts que vos proches vous ont accordés, et ce que vous devez rembourser.</p>
      </div>
      {onSwitchToLender && (
        <button onClick={onSwitchToLender} className="sm:hidden text-xs font-bold text-indigo-600">Mes prêts</button>
      )}
    </div>

    {loading ? (
      <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-indigo-600" size={36} /></div>
    ) : loans.length === 0 ? (
      <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-300">
        <Clock className="mx-auto text-slate-300 mb-4" size={40} />
        <p className="font-bold text-slate-700">Aucun prêt pour l'instant</p>
        <p className="text-sm text-slate-500 mt-1">Quand un proche vous enverra un contrat, il apparaîtra ici.</p>
      </div>
    ) : (
      <div className="space-y-6">
        {loans.map(l => <LoanSummary key={l.id} loan={l} onOpen={onOpen} />)}
      </div>
    )}
  </main>
);

export default BorrowerHome;
