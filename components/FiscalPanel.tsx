import React, { useEffect, useState } from 'react';
import { Loan } from '../types';
import { FileWarning, CheckCircle2, ExternalLink, Scale } from 'lucide-react';
import { declarationSummary, DeclarationLine, loansInLast12Months } from '../utils/compliance';
import { computeSituation, parseISODate } from '../utils/schedule';
import { fetchExchangeRate } from '../services/exchangeRate';
import { DECLARATION_THRESHOLD_EUR, HABITUAL_LENDING_WARNING_COUNT, LEGAL_INTEREST_RATE } from '../config/legal';

interface FiscalPanelProps {
  loans: Loan[];
  userEmail: string;
}

/** Obligations fiscales (2062, intérêts perçus) et garde-fou « prêts habituels ». */
const FiscalPanel: React.FC<FiscalPanelProps> = ({ loans, userEmail }) => {
  const [lines, setLines] = useState<DeclarationLine[]>([]);
  const [interestByYear, setInterestByYear] = useState<Record<number, number>>({});
  const recent = loansInLast12Months(loans, userEmail);

  useEffect(() => {
    let alive = true;
    declarationSummary(loans, userEmail).then(l => { if (alive) setLines(l); });

    // Intérêts conventionnels encaissés par année (part « intérêts » des paiements confirmés, approchée)
    (async () => {
      const byYear: Record<number, number> = {};
      for (const loan of loans) {
        if ((loan.lenderEmail || '').toLowerCase() !== userEmail.toLowerCase() || !loan.interestRate) continue;
        const s = computeSituation(loan, LEGAL_INTEREST_RATE);
        if (s.totalScheduled <= 0) continue;
        const interestShare = s.totalInterest / s.totalScheduled;
        for (const p of loan.payments || []) {
          if (p.status !== 'confirmed') continue;
          const year = parseISODate(p.date).getFullYear();
          byYear[year] = (byYear[year] || 0) + await fetchExchangeRate(p.amount * interestShare, loan.currency);
        }
      }
      if (alive) setInterestByYear(byYear);
    })();
    return () => { alive = false; };
  }, [loans, userEmail]);

  const toDeclare = lines.filter(l => l.mustDeclare);
  const years = Object.keys(interestByYear).map(Number).sort((a, b) => b - a);
  if (lines.length === 0) return null;

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm mb-10">
      <h4 className="font-black text-slate-900 text-xl mb-1 tracking-tight flex items-center gap-2">
        <Scale className="text-indigo-500" size={22} /> Obligations fiscales et légales
      </h4>
      <p className="text-xs text-slate-400 mb-6">Calculé sur vos prêts en tant que prêteur. Montants convertis en euros.</p>

      <div className="space-y-3">
        {toDeclare.length === 0 ? (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl text-sm text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span>Aucun prêt à déclarer : aucun ami n'a reçu plus de {DECLARATION_THRESHOLD_EUR.toLocaleString('fr-FR')} € sur une même année.</span>
          </div>
        ) : toDeclare.map(l => (
          <div key={`${l.year}-${l.borrowerEmail || l.borrowerName}`} className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl text-sm text-amber-900 border border-amber-100">
            <FileWarning size={18} className="shrink-0 mt-0.5" />
            <span>
              <strong>Formulaire 2062 — {l.borrowerName}, {l.year}</strong> : {Math.round(l.totalEur).toLocaleString('fr-FR')} € prêtés ({l.loansCount} prêt{l.loansCount > 1 ? 's' : ''}).
              À déposer {l.declareBefore}, par l'emprunteur ou par vous à défaut (amende de 150 € sinon).
            </span>
          </div>
        ))}

        {years.length > 0 && (
          <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-700">
            <strong>Intérêts perçus à déclarer</strong> (revenus de capitaux mobiliers) :{' '}
            {years.map(y => `${y} : ${interestByYear[y].toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`).join(' · ')}
          </div>
        )}

        {recent >= HABITUAL_LENDING_WARNING_COUNT && (
          <div className="p-4 bg-rose-50 rounded-2xl text-sm text-rose-900 border border-rose-100">
            <strong>{recent} prêts en 12 mois.</strong> Restez sur des prêts ponctuels à des proches : prêter de façon habituelle est réservé aux établissements agréés (art. L511-5 CMF).
          </div>
        )}
      </div>

      <a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F35751" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
        Fiche officielle sur la déclaration des prêts <ExternalLink size={12} />
      </a>
    </div>
  );
};

export default FiscalPanel;
