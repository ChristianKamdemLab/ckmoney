import React, { useEffect, useState } from 'react';
import { Loan } from '../types';
import { declarationSummary, DeclarationLine, loansInLast12Months } from '../utils/compliance';
import { computeSituation, parseISODate } from '../utils/schedule';
import { fetchExchangeRate } from '../services/exchangeRate';
import { DECLARATION_THRESHOLD_EUR, HABITUAL_LENDING_WARNING_COUNT, LEGAL_INTEREST_RATE } from '../config/legal';
import { Note, C } from './v2/ui';

/** Obligations fiscales (2062, intérêts perçus) et garde-fou « prêts habituels ». */
const FiscalPanel: React.FC<{ loans: Loan[]; lenderUid: string }> = ({ loans, lenderUid }) => {
  const [lines, setLines] = useState<DeclarationLine[]>([]);
  const [interestByYear, setInterestByYear] = useState<Record<number, number>>({});
  const recent = loansInLast12Months(loans, lenderUid);

  useEffect(() => {
    let alive = true;
    declarationSummary(loans, lenderUid).then(l => { if (alive) setLines(l); });
    (async () => {
      const byYear: Record<number, number> = {};
      for (const loan of loans) {
        if (loan.lenderUid !== lenderUid || !loan.interestRate) continue;
        const s = computeSituation(loan, LEGAL_INTEREST_RATE);
        if (s.totalScheduled <= 0) continue;
        const share = s.totalInterest / s.totalScheduled;
        for (const p of loan.payments || []) {
          if (p.status !== 'confirmed') continue;
          const y = parseISODate(p.date).getFullYear();
          byYear[y] = (byYear[y] || 0) + await fetchExchangeRate(p.amount * share, loan.currency);
        }
      }
      if (alive) setInterestByYear(byYear);
    })();
    return () => { alive = false; };
  }, [loans, lenderUid]);

  const toDeclare = lines.filter(l => l.mustDeclare);
  const years = Object.keys(interestByYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-2.5">
      {toDeclare.length === 0 ? (
        <Note tone="ok">Rien à déclarer : aucun proche n'a reçu plus de {DECLARATION_THRESHOLD_EUR.toLocaleString('fr-FR')} € sur une même année.</Note>
      ) : toDeclare.map(l => (
        <Note key={`${l.year}-${l.borrowerName}`} tone="warn" icon="file">
          <strong>Formulaire 2062 · {l.borrowerName}, {l.year}</strong> : {Math.round(l.totalEur).toLocaleString('fr-FR')} € prêtés. À joindre {l.declareBefore}, par ton proche ou par toi à défaut.
        </Note>
      ))}
      {years.length > 0 && (
        <Note>Intérêts perçus à déclarer : {years.map(y => `${y} : ${interestByYear[y].toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`).join(' · ')}</Note>
      )}
      {recent >= HABITUAL_LENDING_WARNING_COUNT && (
        <Note tone="danger" icon="alert">{recent} prêts en 12 mois. Reste sur des prêts ponctuels à des proches : prêter de façon habituelle est réservé aux banques (art. L511-5 du Code monétaire et financier).</Note>
      )}
      <a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F35751" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold px-1" style={{ color: C.ink }}>
        Fiche officielle sur la déclaration des prêts ↗
      </a>
    </div>
  );
};

export default FiscalPanel;
