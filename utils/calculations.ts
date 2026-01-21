
import { CalculationResult } from "../types";

export const calculateDueAmount = (amount: number, repaymentDate: string, status: string, annualRate: number = 0): CalculationResult => {
  // Calcul basé sur le taux annuel (Année de 365 jours)
  // Taux journalier = Taux Annuel / 365
  const dailyRate = (annualRate / 100) / 365;
  const dailyCost = amount * dailyRate;

  if (status === 'paid') {
    return { daysLate: 0, interestAmount: 0, totalDue: amount, isOverdue: false, daysRemaining: 0, dailyCost };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(repaymentDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Si diffDays > 0, on est en retard
  // Si diffDays <= 0, c'est le nombre de jours restants (négatif)
  
  const isOverdue = diffDays > 0;
  const daysLate = isOverdue ? diffDays : 0;
  const daysRemaining = isOverdue ? 0 : Math.abs(diffDays);

  const interestAmount = isOverdue ? dailyCost * daysLate : 0;
  const totalDue = amount + interestAmount;

  return {
    daysLate,
    interestAmount,
    totalDue,
    isOverdue,
    daysRemaining,
    dailyCost
  };
};

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};
