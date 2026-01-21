
import React from 'react';
import { Loan } from '../types';
import { calculateDueAmount } from '../utils/calculations';
import { X, Calculator, TrendingUp, AlertTriangle } from 'lucide-react';

interface PenaltyCalculatorProps {
  loan: Loan;
  onClose: () => void;
}

const PenaltyCalculator: React.FC<PenaltyCalculatorProps> = ({ loan, onClose }) => {
  const calc = calculateDueAmount(loan.amount, loan.repaymentDate, loan.status, loan.lateInterestRate || 0);
  const annualRate = loan.lateInterestRate || 0;
  
  // Explication du calcul
  // Montant Principal * (Taux / 100) / 365 = Coût par jour
  const formulaStep1 = `(${loan.amount} × ${annualRate}%) ÷ 365`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-0 animate-in zoom-in-95 overflow-hidden">
        
        <div className="bg-rose-50 p-6 flex justify-between items-center border-b border-rose-100">
           <div className="flex items-center gap-2 text-rose-800 font-black">
               <Calculator size={20} />
               <span>Calcul des Pénalités</span>
           </div>
           <button onClick={onClose} className="p-2 bg-white rounded-full text-rose-300 hover:text-rose-500 transition-colors">
               <X size={18} />
           </button>
        </div>

        <div className="p-6 space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Montant Actuel Dû</p>
                <h3 className="text-3xl font-black text-slate-900">
                    {calc.totalDue.toLocaleString('fr-FR')} {loan.currency}
                </h3>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3">
                    <span className="text-slate-500">Montant Principal</span>
                    <span className="font-bold text-slate-900">{loan.amount} {loan.currency}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3">
                    <span className="text-slate-500">Taux Annuel (Contrat)</span>
                    <span className="font-bold text-slate-900">{annualRate}%</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3">
                    <span className="text-slate-500">Retard accumulé</span>
                    <span className={`font-bold ${calc.isOverdue ? 'text-rose-600' : 'text-slate-400'}`}>
                        {calc.daysLate} jours
                    </span>
                </div>
            </div>

            <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase flex items-center gap-2">
                    <TrendingUp size={14} /> La Formule Appliquée
                </h4>
                <div className="text-xs font-mono text-indigo-800 bg-white/50 p-2 rounded-lg">
                    {formulaStep1} = {calc.dailyCost.toFixed(3)} {loan.currency} / jour
                </div>
                <p className="text-[10px] text-indigo-700/70 leading-relaxed">
                    Les intérêts sont calculés quotidiennement sur la base d'une année civile (365 jours), conformément au taux annuel défini dans le contrat.
                </p>
            </div>

            {calc.isOverdue ? (
                <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-700 text-xs font-bold">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>Le montant augmente chaque jour tant que le remboursement n'est pas effectué.</span>
                </div>
            ) : (
                <div className="text-center text-xs text-slate-400 font-medium">
                    Aucune pénalité pour le moment (Le prêt n'est pas en retard).
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PenaltyCalculator;
